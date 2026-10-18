package content

import (
	"context"
	"html"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"makeke/api/internal/config"
)

type scrapeStage struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Method  string `json:"method,omitempty"`
	Message string `json:"message,omitempty"`
	Success bool   `json:"success"`
}

type scrapePipelineError struct {
	message string
	stages  []scrapeStage
}

func (e scrapePipelineError) Error() string {
	return e.message
}

func ScrapeArticleWithPipeline(cfg config.Config, rawURL string, fallbackTitle string) (map[string]any, error) {
	return scrapeArticleWithPipeline(cfg, rawURL, fallbackTitle)
}

// scrapeArticleWithPipeline is the only backend entry point for URL article scraping.
// Official policy is fixed in docs/content_scrape_pipeline.md:
// resolve original URL -> Lightpanda -> HTTP fallback.
// The shared frontend source client may use the optional Chrome extension bridge as the final user-session fallback.
// Stage additions or reordering must be done here and in static/modules/shared/source_client.js together.
func scrapeArticleWithPipeline(cfg config.Config, rawURL string, fallbackTitle string) (map[string]any, error) {
	return scrapeArticleWithPipelineStage(cfg, rawURL, fallbackTitle, "")
}

func scrapeArticleWithPipelineStage(cfg config.Config, rawURL string, fallbackTitle string, onlyStage string) (map[string]any, error) {
	targetURL := rawURL
	stages := make([]scrapeStage, 0, 4)
	if resolved := resolveGoogleNewsTarget(rawURL, fallbackTitle); resolved != "" && resolved != rawURL {
		targetURL = resolved
		stages = append(stages, scrapeStage{
			Key:     "resolve",
			Label:   "구글 뉴스 원문 복원",
			Method:  "title_lookup",
			Message: resolved,
			Success: true,
		})
	}

	stage := strings.ToLower(strings.TrimSpace(onlyStage))
	if stage == "lightpanda" || stage == "panda" {
		result, err := scrapeArticleViaLightpanda(cfg, targetURL, fallbackTitle)
		if err != nil {
			stages = append(stages, scrapeStage{
				Key:     "lightpanda",
				Label:   "판다 브라우저 수집",
				Method:  "lightpanda",
				Message: err.Error(),
				Success: false,
			})
			return nil, scrapePipelineError{message: err.Error(), stages: stages}
		}
		stages = append(stages, scrapeStage{
			Key:     "lightpanda",
			Label:   "판다 브라우저 수집",
			Method:  stringify(result["method"]),
			Message: "판다 브라우저 단일 단계로 본문을 수집했습니다.",
			Success: true,
		})
		result["stages"] = appendStageMaps(stages)
		return result, nil
	}

	if stage == "requests" || stage == "request" || stage == "colly" || stage == "http" {
		result, err := scrapeArticleGo(targetURL, fallbackTitle)
		if err != nil {
			stages = append(stages, scrapeStage{
				Key:     "requests",
				Label:   "요청 기반 수집",
				Method:  "requests_html",
				Message: err.Error(),
				Success: false,
			})
			return nil, scrapePipelineError{message: err.Error(), stages: stages}
		}
		stages = append(stages, scrapeStage{
			Key:     "requests",
			Label:   "요청 기반 수집",
			Method:  stringify(result["method"]),
			Message: "요청 기반 단일 단계로 본문을 수집했습니다.",
			Success: true,
		})
		result["stages"] = appendStageMaps(stages)
		return result, nil
	}

	if result, err := scrapeArticleViaLightpanda(cfg, targetURL, fallbackTitle); err == nil {
		stages = append(stages, scrapeStage{
			Key:     "lightpanda",
			Label:   "판다 브라우저 수집",
			Method:  stringify(result["method"]),
			Message: "판다 브라우저로 본문을 수집했습니다.",
			Success: true,
		})
		result["stages"] = appendStageMaps(stages)
		return result, nil
	} else {
		stages = append(stages, scrapeStage{
			Key:     "lightpanda",
			Label:   "판다 브라우저 수집",
			Method:  "lightpanda",
			Message: err.Error(),
			Success: false,
		})
	}

	result, err := scrapeArticleGo(targetURL, fallbackTitle)
	if err != nil {
		stages = append(stages, scrapeStage{
			Key:     "requests",
			Label:   "요청 기반 수집",
			Method:  "requests_html",
			Message: err.Error(),
			Success: false,
		})
		return nil, scrapePipelineError{message: err.Error(), stages: stages}
	}

	stages = append(stages, scrapeStage{
		Key:     "requests",
		Label:   "요청 기반 수집",
		Method:  stringify(result["method"]),
		Message: "HTTP 요청 기반으로 본문을 수집했습니다.",
		Success: true,
	})
	result["stages"] = appendStageMaps(stages)
	return result, nil
}

func appendStageMaps(stages []scrapeStage) []map[string]any {
	items := make([]map[string]any, 0, len(stages))
	for _, stage := range stages {
		items = append(items, map[string]any{
			"key":     stage.Key,
			"label":   stage.Label,
			"method":  stage.Method,
			"message": stage.Message,
			"success": stage.Success,
		})
	}
	return items
}

func scrapeArticleViaLightpanda(cfg config.Config, rawURL string, fallbackTitle string) (map[string]any, error) {
	if runtime.GOOS == "windows" {
		return nil, errUnavailable("Windows 환경에서는 판다 브라우저를 건너뜁니다.")
	}
	if !canHandleLightpandaURL(rawURL) {
		return nil, errUnavailable("판다 브라우저 미지원 URL이라 요청 기반 수집으로 넘어갑니다.")
	}

	binaryPath := findLightpandaBinary(cfg)
	if binaryPath == "" {
		return nil, errUnavailable("판다 브라우저 바이너리를 찾지 못했습니다.")
	}

	titleFromTree := ""
	if tree, err := runLightpandaFetch(binaryPath, rawURL, "semantic_tree_text", 20*time.Second); err == nil {
		titleFromTree = extractLightpandaTreeTitle(tree)
	}

	markdown, err := runLightpandaFetch(binaryPath, rawURL, "markdown", 20*time.Second)
	if err != nil {
		return nil, err
	}

	text := extractLightpandaArticleText(markdown)
	if isLightpandaFailureOutput(markdown, text) {
		return nil, errUnavailable("판다 브라우저 탐색 실패로 요청 기반 수집으로 넘어갑니다.")
	}
	if len(text) < 50 {
		return nil, errUnavailable("판다 브라우저가 본문을 충분히 추출하지 못했습니다.")
	}

	title := strings.TrimSpace(titleFromTree)
	if title == "" {
		title = extractLightpandaMarkdownTitle(markdown)
	}
	if title == "" {
		title = strings.TrimSpace(fallbackTitle)
	}
	if title == "" {
		title = rawURL
	}

	text = truncate(text, 8000)
	return map[string]any{
		"title":             title,
		"text":              text,
		"images":            []string{},
		"url":               rawURL,
		"char_count":        len(text),
		"method":            "lightpanda",
		"validation_reason": "",
	}, nil
}

func findLightpandaBinary(cfg config.Config) string {
	name := "lightpanda"
	if runtime.GOOS == "windows" {
		name = "lightpanda.exe"
	}
	candidates := []string{
		filepath.Join(cfg.ProjectRoot, "electron", "bin", name),
		filepath.Join(cfg.ProjectRoot, "tools", name),
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

func canHandleLightpandaURL(rawURL string) bool {
	blockedHosts := []string{
		"blog.naver.com",
		"m.blog.naver.com",
		"cafe.naver.com",
		"threads.net",
		"www.threads.net",
		"instagram.com",
		"www.instagram.com",
		"x.com",
		"twitter.com",
	}
	lowered := strings.ToLower(rawURL)
	for _, host := range blockedHosts {
		if strings.Contains(lowered, host) {
			return false
		}
	}
	return true
}

func runLightpandaFetch(binaryPath string, rawURL string, output string, timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binaryPath, "fetch", "--dump", output, rawURL)
	cmd.Env = os.Environ()
	result, err := cmd.CombinedOutput()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", errUnavailable("판다 브라우저 타임아웃")
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			message := strings.TrimSpace(string(exitErr.Stderr))
			if message == "" {
				message = strings.TrimSpace(string(result))
			}
			if message == "" {
				message = exitErr.Error()
			}
			return "", errUnavailable("판다 브라우저 실패: " + truncate(message, 200))
		}
		return "", errUnavailable("판다 브라우저 실행 실패: " + err.Error())
	}
	return string(result), nil
}

func extractLightpandaTreeTitle(tree string) string {
	firstLine := strings.TrimSpace(strings.Split(strings.TrimSpace(tree), "\n")[0])
	pattern := regexp.MustCompile(`RootWebArea '(.+)'`)
	matches := pattern.FindStringSubmatch(firstLine)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func extractLightpandaMarkdownTitle(markdown string) string {
	for _, line := range strings.Split(markdown, "\n") {
		candidate := strings.TrimSpace(strings.TrimLeft(line, "#"))
		if len(candidate) > 10 {
			return candidate
		}
	}
	return ""
}

func extractLightpandaArticleText(markdown string) string {
	skipPatterns := []*regexp.Regexp{
		regexp.MustCompile(`^\[.*\]\(.*\)$`),
		regexp.MustCompile(`^!\[.*\]\(.*\)$`),
		regexp.MustCompile(`^\*.*\*$`),
		regexp.MustCompile(`^-\s*\[`),
		regexp.MustCompile(`^(로그인|프로필|좋아요|댓글|공유|구독|뉴스|스포츠|연예|홈|랭킹|최신)`),
		regexp.MustCompile(`^(공감|응원|축하|기대|놀랐어요|슬퍼요)`),
		regexp.MustCompile(`^(입력|수정|기사원문|성별|나이|지역|바로가기)`),
		regexp.MustCompile(`구독되었습니다|구독 해지|선정한 기사|언론사별`),
		regexp.MustCompile(`바로가기 설정|전체 서비스|보러가기|닫기$`),
		regexp.MustCompile(`^\d+$`),
	}

	lines := make([]string, 0, 128)
	for _, rawLine := range strings.Split(markdown, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			if len(lines) > 0 && lines[len(lines)-1] != "" {
				lines = append(lines, "")
			}
			continue
		}
		skip := false
		for _, pattern := range skipPatterns {
			if pattern.MatchString(line) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		cleaned := regexp.MustCompile(`\[(.*?)\]\([^)]+\)`).ReplaceAllString(line, "$1")
		cleaned = regexp.MustCompile(`!\[.*?\]\(.*?\)`).ReplaceAllString(cleaned, "")
		cleaned = strings.TrimSpace(html.UnescapeString(cleaned))
		if len(cleaned) > 15 {
			lines = append(lines, cleaned)
		}
	}

	text := strings.TrimSpace(strings.Join(lines, "\n"))
	text = regexp.MustCompile(`\n{3,}`).ReplaceAllString(text, "\n\n")
	return text
}

func isLightpandaFailureOutput(markdown string, text string) bool {
	lowered := strings.ToLower(strings.TrimSpace(markdown + "\n" + text))
	failureTokens := []string{
		"navigation failed",
		"navigate failed",
		"$scope=page $level=error",
		"$scope=browser $level=error",
		"http2stream",
		"session wait",
	}
	for _, token := range failureTokens {
		if strings.Contains(lowered, token) {
			return true
		}
	}
	return strings.HasPrefix(strings.TrimSpace(text), "$time=")
}
