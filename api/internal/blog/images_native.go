package blog

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"makeke/api/internal/atlas"
	"makeke/api/internal/codexcli"
	"makeke/api/internal/prompts"
)

type blogImageBatchRequest struct {
	Content        string   `json:"content"`
	Count          int      `json:"count"`
	Keyword        string   `json:"keyword"`
	BrandName      string   `json:"brand_name"`
	ProfileID      int      `json:"profile_id"`
	ImagePrompts   []string `json:"image_prompts"`
	UserImageURLs  []string `json:"user_image_urls"`
	LogoImageURL   string   `json:"logo_image_url"`
	SourceContext  string   `json:"source_context"`
	DesignRules    string   `json:"design_rules"`
	PromptTemplate string   `json:"prompt_template"`
	ImageProvider  string   `json:"image_provider"`
	ImageModel     string   `json:"image_model"`
}

type blogImageSingleRequest struct {
	Keyword        string   `json:"keyword"`
	BrandName      string   `json:"brand_name"`
	ProfileID      int      `json:"profile_id"`
	ImageIndex     int      `json:"image_index"`
	ImageCount     int      `json:"image_count"`
	Title          string   `json:"title"`
	Body           string   `json:"body"`
	VisualPrompt   string   `json:"visual_prompt"`
	ProjectDir     string   `json:"project_dir"`
	UserImageURLs  []string `json:"user_image_urls"`
	LogoImageURL   string   `json:"logo_image_url"`
	SourceContext  string   `json:"source_context"`
	DesignRules    string   `json:"design_rules"`
	PromptTemplate string   `json:"prompt_template"`
	ImageProvider  string   `json:"image_provider"`
	ImageModel     string   `json:"image_model"`
}

var blogImageSafeNamePattern = regexp.MustCompile(`[^\w가-힣\s-]`)

func (s *Service) handleGenerateImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req blogImageSingleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	result, err := s.generateSingleBlogImage(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) generateBlogImages(req blogImageBatchRequest) (map[string]any, error) {
	if strings.TrimSpace(req.Content) == "" {
		return nil, fmt.Errorf("블로그 본문이 필요합니다.")
	}
	count := req.Count
	if count <= 0 {
		count = 3
	}
	sourceContext := strings.TrimSpace(req.SourceContext)
	if sourceContext == "" {
		sourceContext = strings.TrimSpace(req.Content)
	}
	designRules := strings.TrimSpace(req.DesignRules)
	if designRules == "" {
		designRules = s.resolveBlogImageDesignRules(req.ProfileID)
	}
	promptTemplate := strings.TrimSpace(req.PromptTemplate)
	if promptTemplate == "" {
		promptTemplate = s.resolveBlogImagePromptTemplate(req.ProfileID, sourceContext, designRules)
	}
	slides := buildBlogImageSlides(req.Content, req.Keyword, count, req.ImagePrompts)
	projectDir, err := s.createBlogImageProjectDir(req.Keyword)
	if err != nil {
		return nil, err
	}
	images := make([]map[string]any, 0, len(slides))
	failures := make([]string, 0, len(slides))
	imageProvider := ""
	imageModel := ""
	for idx, slide := range slides {
		singleReq := blogImageSingleRequest{
			Keyword:        req.Keyword,
			BrandName:      req.BrandName,
			ProfileID:      req.ProfileID,
			ImageIndex:     idx,
			ImageCount:     len(slides),
			Title:          blogStringify(slide["title"]),
			Body:           blogStringify(slide["body"]),
			VisualPrompt:   blogStringify(slide["visual_prompt"]),
			ProjectDir:     projectDir,
			UserImageURLs:  req.UserImageURLs,
			LogoImageURL:   req.LogoImageURL,
			SourceContext:  sourceContext,
			DesignRules:    designRules,
			PromptTemplate: promptTemplate,
			ImageProvider:  req.ImageProvider,
			ImageModel:     req.ImageModel,
		}
		item, err := s.generateSingleBlogImage(singleReq)
		if err != nil {
			item, err = s.generateSingleBlogImage(singleReq)
		}
		if err != nil {
			failures = append(failures, fmt.Sprintf("%d번 이미지: %s", idx+1, err.Error()))
			continue
		}
		images = append(images, map[string]any{
			"index":          idx,
			"filename":       blogStringify(item["filename"]),
			"url":            blogStringify(item["url"]),
			"image_provider": blogStringify(item["image_provider"]),
			"image_model":    blogStringify(item["image_model"]),
		})
		if imageProvider == "" {
			imageProvider = blogStringify(item["image_provider"])
		}
		if imageModel == "" {
			imageModel = blogStringify(item["image_model"])
		}
	}
	if len(images) == 0 && len(failures) > 0 {
		return nil, fmt.Errorf("블로그 이미지 생성에 실패했습니다: %s", strings.Join(failures, " / "))
	}
	result := map[string]any{
		"images":         images,
		"count":          len(images),
		"project_dir":    projectDir,
		"image_provider": imageProvider,
		"image_model":    imageModel,
	}
	if len(failures) > 0 {
		result["failures"] = failures
		result["failed_count"] = len(failures)
	}
	return result, nil
}

func (s *Service) GenerateImagesForContent(content string, count int, keyword string, brandName string, profileID int, imagePrompts []string, userImageURLs []string, logoImageURL string, sourceContext string, designRules string, promptTemplate string, imageProvider string, imageModel string) (map[string]any, error) {
	return s.generateBlogImages(blogImageBatchRequest{
		Content:        content,
		Count:          count,
		Keyword:        keyword,
		BrandName:      brandName,
		ProfileID:      profileID,
		ImagePrompts:   imagePrompts,
		UserImageURLs:  userImageURLs,
		LogoImageURL:   logoImageURL,
		SourceContext:  sourceContext,
		DesignRules:    designRules,
		PromptTemplate: promptTemplate,
		ImageProvider:  imageProvider,
		ImageModel:     imageModel,
	})
}

func (s *Service) generateSingleBlogImage(req blogImageSingleRequest) (map[string]any, error) {
	if strings.TrimSpace(req.Keyword) == "" {
		req.Keyword = "블로그"
	}
	if strings.TrimSpace(req.SourceContext) == "" {
		req.SourceContext = strings.TrimSpace(req.Body)
	}
	if strings.TrimSpace(req.DesignRules) == "" {
		req.DesignRules = s.resolveBlogImageDesignRules(req.ProfileID)
	}
	if strings.TrimSpace(req.PromptTemplate) == "" {
		req.PromptTemplate = s.resolveBlogImagePromptTemplate(req.ProfileID, req.SourceContext, req.DesignRules)
	}
	projectDir := strings.TrimSpace(req.ProjectDir)
	if projectDir == "" {
		var err error
		projectDir, err = s.createBlogImageProjectDir(req.Keyword)
		if err != nil {
			return nil, err
		}
	}
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return nil, err
	}
	filename := fmt.Sprintf("blog_img_%02d.png", req.ImageIndex+1)
	outputPath := filepath.Join(projectDir, filename)
	prompt := s.buildSingleBlogImagePrompt(req)
	referencePaths := make([]string, 0, 6)
	logoPath := resolveBlogLocalImagePath(s.dataDir, req.LogoImageURL)
	if logoPath != "" {
		referencePaths = append(referencePaths, logoPath)
	}
	remainingRefs := 6 - len(referencePaths)
	if remainingRefs > 0 {
		referencePaths = append(referencePaths, resolveBlogLocalImagePaths(s.dataDir, req.UserImageURLs, remainingRefs)...)
	}
	remainingRefs = 6 - len(referencePaths)
	if remainingRefs > 0 {
		referencePaths = appendUniqueBlogPaths(referencePaths, s.collectProfileReferenceImagePaths(req.ProfileID, remainingRefs)...)
	}
	provider := strings.TrimSpace(req.ImageProvider)
	if provider == "" {
		provider = strings.TrimSpace(s.getSettingValue("MODELS.image_provider", ""))
	}
	model := strings.TrimSpace(req.ImageModel)
	if model == "" {
		model = strings.TrimSpace(s.getSettingValue("MODELS.image_model", ""))
	}
	if inferred := inferBlogImageProviderFromModel(model); inferred != "" && (provider == "" || strings.EqualFold(provider, "cli") || strings.EqualFold(provider, "codex")) {
		provider = inferred
	}
	if strings.HasPrefix(strings.ToLower(model), "openai/gpt-image-2") || strings.HasPrefix(strings.ToLower(model), "qwen/") || strings.HasPrefix(strings.ToLower(model), "baidu/") || strings.HasPrefix(strings.ToLower(model), "alibaba/") {
		provider = "atlas"
	}
	provider = strings.ToLower(strings.TrimSpace(provider))
	if provider == "" {
		if strings.TrimSpace(s.getSettingValue("API.gemini_api_key", s.getSettingValue("API.google_api_key", ""))) != "" {
			provider = "gemini"
		} else if strings.TrimSpace(s.getSettingValue("API.atlas_key", "")) != "" || strings.TrimSpace(os.Getenv("ATLASCLOUD_API_KEY")) != "" {
			provider = "atlas"
		} else {
			provider = "codex"
		}
	}
	switch provider {
	case "gemini", "google":
		provider = "gemini"
		apiKey := strings.TrimSpace(s.getSettingValue("API.gemini_api_key", s.getSettingValue("API.google_api_key", "")))
		if model == "" || model == "codex-cli" || model == "kimi-cli" {
			model = "gemini-3.1-flash-image-preview"
		}
		if err := runGeminiBlogImageFile(prompt, outputPath, apiKey, model, 180*time.Second, referencePaths); err != nil {
			return nil, err
		}
	case "atlas", "atlascloud", "atlas-cloud":
		provider = "atlas"
		apiKey := strings.TrimSpace(s.getSettingValue("API.atlas_key", ""))
		if apiKey == "" {
			apiKey = strings.TrimSpace(os.Getenv("ATLASCLOUD_API_KEY"))
		}
		if model == "" || model == "codex-cli" {
			model = atlas.DefaultImageModel
		}
		if err := atlas.GenerateImageFile(atlas.GenerateImageOptions{
			APIKey:         apiKey,
			Model:          model,
			Prompt:         prompt,
			AspectRatio:    "16:9",
			OutputPath:     outputPath,
			ReferencePaths: referencePaths,
			Timeout:        180 * time.Second,
		}); err != nil {
			return nil, err
		}
	default:
		provider = "codex"
		model = "codex-cli"
		if err := runCodexBlogImageFile(prompt, outputPath, s.codexImageTimeout(), referencePaths); err != nil {
			return nil, err
		}
	}
	return map[string]any{
		"status":         "ok",
		"filename":       filename,
		"url":            "/api/blog/images/" + filepath.Base(projectDir) + "/" + filename,
		"project_dir":    projectDir,
		"index":          req.ImageIndex,
		"image_provider": provider,
		"image_model":    model,
	}, nil
}

func buildBlogImageSlides(content, keyword string, count int, prompts []string) []map[string]any {
	blocks := strings.Split(content, "\n\n")
	sections := make([]string, 0, len(blocks))
	for _, block := range blocks {
		trimmed := strings.TrimSpace(block)
		if len(trimmed) > 40 {
			sections = append(sections, trimmed)
		}
	}
	if len(sections) == 0 {
		sections = append(sections, truncate(content, 280))
	}
	target := make([]map[string]any, 0, count)
	for idx := 0; idx < count; idx++ {
		body := sections[minInt(idx, len(sections)-1)]
		prompt := ""
		if idx < len(prompts) {
			prompt = strings.TrimSpace(prompts[idx])
		}
		if prompt == "" {
			prompt = fmt.Sprintf("블로그 삽입용 이미지. 주제: %s. 섹션 핵심: %s. 16:9 비율, 이미지 안 문자 금지, 영문/숫자/라벨 금지, 같은 템플릿 반복 금지.", keyword, truncate(body, 220))
		}
		target = append(target, map[string]any{
			"title":         fmt.Sprintf("%s 이미지 %d", strings.TrimSpace(keyword), idx+1),
			"body":          body,
			"visual_prompt": prompt,
		})
	}
	return target
}

func (s *Service) buildSingleBlogImagePrompt(req blogImageSingleRequest) string {
	referenceHint := ""
	if logoPath := resolveBlogLocalImagePath(s.dataDir, req.LogoImageURL); logoPath != "" {
		referenceHint += "\n- 프로필 로고 참조 이미지 경로: " + logoPath
	}
	for _, rawURL := range req.UserImageURLs {
		if path := resolveBlogLocalImagePath(s.dataDir, rawURL); path != "" {
			referenceHint += "\n- 참조 이미지 경로: " + path
		}
	}
	for _, path := range s.collectProfileReferenceImagePaths(req.ProfileID, 6) {
		referenceHint += "\n- 프로필에 저장된 참고 이미지 경로: " + path
	}
	outputPath := filepath.Join(req.ProjectDir, fmt.Sprintf("blog_img_%02d.png", req.ImageIndex+1))
	hardRules := blogImageHardVisualRules()
	if template := strings.TrimSpace(req.PromptTemplate); template != "" {
		rendered := renderBlogImagePromptTemplate(template, req, outputPath)
		return strings.TrimSpace(hardRules + "\n\n" + rendered + `

[저장 규칙]
- 최종 결과물은 반드시 실제 래스터 이미지 파일 1개입니다.
- 아래 절대 경로에 정확히 저장하세요: ` + outputPath + `
- PNG 권장, 블로그 본문에 바로 넣을 수 있는 완성 이미지를 만드세요.
- 이미지 안에는 읽을 수 있는 글자, 영어 단어, 알파벳, 숫자, UI 라벨, 차트 라벨, 워터마크를 절대 만들지 마세요.
- 한국어 글자도 만들지 마세요. 개념은 아이콘, 사물, 색, 구도, 추상 UI 블록으로만 표현하세요.
- 예외: 프로필 로고 참조 이미지가 있으면 그 실제 로고만 장면 안에 자연스럽게 녹이세요.
- 제공된 프로필 저장 이미지는 색감, 공간, 상품, 인물, 소재 참고로 우선 활용하세요.
- 브랜드명을 별도 텍스트로 쓰지 마세요. 로고 reference가 있으면 실제 로고 형태만 자연스럽게 녹이세요.
- 작업이 끝나면 stdout에는 IMAGE_READY 한 줄만 출력하세요.
` + "\n\n" + hardRules + `
`)
	}
	return strings.TrimSpace(fmt.Sprintf(`
당신은 블로그 삽입용 이미지를 생성합니다.

%s

중요 규칙:
- 최종 결과물은 반드시 실제 래스터 이미지 파일 1개입니다.
- 16:9 비율을 유지하세요.
- 이미지 안에는 읽을 수 있는 글자, 영어 단어, 알파벳, 숫자, UI 라벨, 차트 라벨, 워터마크를 절대 만들지 마세요.
- 한국어 글자도 만들지 마세요. 개념은 아이콘, 사물, 색, 구도, 추상 UI 블록으로만 표현하세요.
- 예외: 프로필 로고 참조 이미지가 있으면 간판, 제품 표식, 패키지 라벨, 공간 소품처럼 실제 로고만 장면 안에 자연스럽게 녹이세요.
- 제공된 프로필 저장 이미지는 색감, 공간, 상품, 인물, 소재 참고로 우선 활용하세요.
- 브랜드명을 별도 텍스트로 쓰지 마세요. 로고 reference가 있으면 실제 로고 형태만 자연스럽게 녹이세요.
- 같은 템플릿처럼 보이지 않게 장면과 구도를 바꾸세요.
- 작업이 끝나면 stdout에는 IMAGE_READY 한 줄만 출력하세요.

이미지 정보:
- 주제: %s
- 브랜드명: %s
- 현재 이미지: %d/%d
- 섹션 제목: %s
- 섹션 내용: %s
- 비주얼 프롬프트: %s
- 디자인 참고: %s
- 블로그 전체 맥락: %s%s

저장 규칙:
- 아래 절대 경로에 정확히 저장하세요: %s
`, hardRules, sanitizeBlogImagePromptText(req.Keyword), sanitizeBlogImagePromptText(req.BrandName), req.ImageIndex+1, maxInt(req.ImageCount, 1), sanitizeBlogImagePromptText(req.Title), truncate(sanitizeBlogImagePromptText(req.Body), 260), sanitizeBlogImagePromptText(req.VisualPrompt), sanitizeBlogImagePromptText(req.DesignRules), truncate(sanitizeBlogImagePromptText(req.SourceContext), 1200), referenceHint, outputPath))
}

func blogImageHardVisualRules() string {
	return strings.TrimSpace(`
[절대 우선 시각 규칙]
- 블로그 이미지는 사진/일러스트/추상 그래픽이어야 합니다. 카드뉴스, 포스터, 발표 슬라이드, 대시보드 화면처럼 글자가 박힌 이미지를 만들지 마세요.
- 이미지 안에 읽을 수 있는 문자 자체를 만들지 마세요. 영어, 알파벳, 숫자, 웹주소, 버튼명, 메뉴명, 차트 라벨, 단계명, 워터마크, 임의 로고 텍스트를 모두 금지합니다.
- 영문 라벨, 영문 약어, 영문 서비스명, 영문 단계명을 절대 넣지 마세요.
- 컴퓨터 화면이나 그래프가 필요하면 글자 없는 선, 도형, 막대, 흐릿한 UI 블록으로만 표현하세요.
- 제공된 실제 프로필 로고 reference만 예외입니다. 로고는 억지 오버레이가 아니라 장면 안의 간판, 제품 표식, 소품처럼 자연스럽게 녹이세요.
`)
}

func (s *Service) resolveBlogImageDesignRules(profileID int) string {
	db, err := s.openDB()
	if err != nil {
		return defaultBlogImageDesignRules()
	}
	defer db.Close()
	if template := strings.TrimSpace(prompts.ResolvePromptContent(db, "blog_image", "design_rules", profileID)); template != "" {
		return template
	}
	return defaultBlogImageDesignRules()
}

func (s *Service) resolveBlogImagePromptTemplate(profileID int, sourceContext string, designRules string) string {
	db, err := s.openDB()
	if err != nil {
		return defaultBlogImagePromptTemplate(sourceContext, designRules)
	}
	defer db.Close()
	if template := strings.TrimSpace(prompts.ResolvePromptContent(db, "blog_image", "prompt_template", profileID)); template != "" {
		return template
	}
	return defaultBlogImagePromptTemplate(sourceContext, designRules)
}

func defaultBlogImageDesignRules() string {
	return strings.TrimSpace(`
- 표현 방식은 내용에 따라 자유롭게 결정하세요.
- 같은 구도, 같은 색조, 같은 아이콘 배치를 반복하지 마세요.
- 16:9 비율을 유지하고 텍스트 없이 핵심 의미가 읽히게 구성하세요.
- 브랜드 톤은 참고만 하고 모든 이미지를 같은 템플릿으로 만들지 마세요.
`)
}

func defaultBlogImagePromptTemplate(sourceContext string, designRules string) string {
	return strings.TrimSpace(fmt.Sprintf(`블로그 삽입용 이미지를 생성하세요.

블로그 주제: {keyword}
블로그 전체 맥락: %s
현재 이미지: {index}/{total}
이 섹션의 제목: {title}
이 섹션의 내용: {body}

디자인 참고:
%s`, truncate(sanitizeBlogImagePromptText(sourceContext), 1800), sanitizeBlogImagePromptText(designRules)))
}

func renderBlogImagePromptTemplate(template string, req blogImageSingleRequest, outputPath string) string {
	replacer := strings.NewReplacer(
		"{keyword}", sanitizeBlogImagePromptText(req.Keyword),
		"{키워드}", sanitizeBlogImagePromptText(req.Keyword),
		"{brand_name}", sanitizeBlogImagePromptText(req.BrandName),
		"{브랜드명}", sanitizeBlogImagePromptText(req.BrandName),
		"{index}", strconv.Itoa(req.ImageIndex+1),
		"{image_index}", strconv.Itoa(req.ImageIndex+1),
		"{total}", strconv.Itoa(maxInt(req.ImageCount, 1)),
		"{image_count}", strconv.Itoa(maxInt(req.ImageCount, 1)),
		"{title}", sanitizeBlogImagePromptText(req.Title),
		"{제목}", sanitizeBlogImagePromptText(req.Title),
		"{body}", sanitizeBlogImagePromptText(req.Body),
		"{본문}", sanitizeBlogImagePromptText(req.Body),
		"{visual_prompt}", sanitizeBlogImagePromptText(req.VisualPrompt),
		"{비주얼프롬프트}", sanitizeBlogImagePromptText(req.VisualPrompt),
		"{source_context}", sanitizeBlogImagePromptText(req.SourceContext),
		"{참고자료}", sanitizeBlogImagePromptText(req.SourceContext),
		"{design_rules}", sanitizeBlogImagePromptText(req.DesignRules),
		"{output_path}", outputPath,
		"{출력경로}", outputPath,
	)
	return strings.TrimSpace(replacer.Replace(template))
}

func sanitizeBlogImagePromptText(value string) string {
	text := strings.TrimSpace(value)
	if text == "" {
		return ""
	}
	text = regexp.MustCompile(`[A-Za-z0-9][A-Za-z0-9_./:%+\-]*`).ReplaceAllString(text, "문자 없는 시각 요소")
	return strings.Join(strings.Fields(text), " ")
}

func (s *Service) createBlogImageProjectDir(keyword string) (string, error) {
	safeKeyword := blogImageSafeNamePattern.ReplaceAllString(strings.TrimSpace(keyword), "")
	safeKeyword = strings.TrimSpace(strings.ReplaceAll(safeKeyword, " ", "_"))
	if safeKeyword == "" {
		safeKeyword = "blog"
	}
	if len([]rune(safeKeyword)) > 30 {
		safeKeyword = string([]rune(safeKeyword)[:30])
	}
	projectDir := filepath.Join(s.dataDir, "output", "blog_images", fmt.Sprintf("%s_%s", safeKeyword, time.Now().Format("20060102_150405")))
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return "", err
	}
	return projectDir, nil
}

func resolveBlogLocalImagePath(dataDir string, rawURL string) string {
	value := strings.TrimSpace(strings.Split(rawURL, "?")[0])
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "/api/content/user-image/") {
		return filepath.Join(dataDir, "output", "user_images", filepath.Base(value))
	}
	if strings.HasPrefix(value, "/api/library/image/") {
		parts := strings.Split(strings.TrimPrefix(value, "/api/library/image/"), "/")
		if len(parts) >= 2 {
			return filepath.Join(dataDir, "output", "library", parts[0], filepath.Join(parts[1:]...))
		}
	}
	if strings.HasPrefix(value, "/api/cardnews/image/") {
		return filepath.Join(dataDir, "output", "cardnews", strings.TrimPrefix(value, "/api/cardnews/image/"))
	}
	if filepath.IsAbs(value) {
		return value
	}
	return ""
}

func resolveBlogLocalImagePaths(dataDir string, rawURLs []string, limit int) []string {
	paths := make([]string, 0, len(rawURLs))
	seen := make(map[string]struct{}, len(rawURLs))
	for _, rawURL := range rawURLs {
		path := strings.TrimSpace(resolveBlogLocalImagePath(dataDir, rawURL))
		if path == "" {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		seen[path] = struct{}{}
		paths = append(paths, path)
		if limit > 0 && len(paths) >= limit {
			break
		}
	}
	return paths
}

func appendUniqueBlogPaths(base []string, extra ...string) []string {
	seen := make(map[string]struct{}, len(base)+len(extra))
	for _, path := range base {
		seen[path] = struct{}{}
	}
	for _, path := range extra {
		clean := strings.TrimSpace(path)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		base = append(base, clean)
	}
	return base
}

func (s *Service) collectProfileReferenceImagePaths(profileID int, limit int) []string {
	if profileID <= 0 || limit <= 0 {
		return []string{}
	}
	db, err := s.openDB()
	if err != nil {
		return []string{}
	}
	defer db.Close()
	var imagesJSON string
	if err := db.QueryRow(`SELECT images_json FROM brand_profiles WHERE id = ?`, profileID).Scan(&imagesJSON); err != nil {
		return []string{}
	}
	var files []string
	if err := json.Unmarshal([]byte(strings.TrimSpace(imagesJSON)), &files); err != nil {
		return []string{}
	}
	paths := make([]string, 0, minInt(limit, len(files)))
	base := filepath.Join(s.dataDir, "output", "library", strconv.Itoa(profileID))
	for _, raw := range files {
		if len(paths) >= limit {
			break
		}
		rel := cleanProfileReferenceImagePath(raw)
		if rel == "" {
			continue
		}
		path := filepath.Join(base, rel)
		if info, err := os.Stat(path); err == nil && !info.IsDir() && info.Size() > 0 {
			paths = append(paths, path)
		}
	}
	return paths
}

func cleanProfileReferenceImagePath(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if decoded, err := url.PathUnescape(value); err == nil {
		value = decoded
	}
	value = strings.TrimPrefix(strings.ReplaceAll(value, "\\", "/"), "/")
	clean := filepath.Clean(value)
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return ""
	}
	return clean
}

func inferBlogImageProviderFromModel(model string) string {
	value := strings.ToLower(strings.TrimSpace(model))
	switch {
	case value == "":
		return ""
	case strings.HasPrefix(value, "gemini-"), strings.Contains(value, "gemini"):
		return "gemini"
	case strings.HasPrefix(value, "openai/gpt-image-2"), strings.HasPrefix(value, "qwen/"), strings.HasPrefix(value, "baidu/"), strings.HasPrefix(value, "alibaba/"):
		return "atlas"
	case value == "codex-cli":
		return "codex"
	}
	return ""
}

func (s *Service) getSettingValue(key, fallback string) string {
	db, err := s.openDB()
	if err != nil {
		return fallback
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`); err != nil {
		return fallback
	}
	var value string
	if err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value); err != nil {
		return fallback
	}
	return value
}

func (s *Service) codexImageTimeout() time.Duration {
	const fallback = 10 * time.Minute
	if envValue := strings.TrimSpace(os.Getenv("MAKEKE_CODEX_IMAGE_TIMEOUT_SECONDS")); envValue != "" {
		if seconds, err := strconv.Atoi(envValue); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	if raw := strings.TrimSpace(s.getSettingValue("TIMEOUTS.codex_image_timeout_seconds", "")); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
	}
	return fallback
}

func runCodexBlogImageFile(prompt, outputPath string, timeout time.Duration, imagePaths []string) error {
	cliPath, err := exec.LookPath("codex")
	if err != nil {
		return fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	_ = os.Remove(outputPath)
	startedAt := time.Now().Add(-1 * time.Second)
	args := codexcli.ExecArgs(cliPath)
	for _, imagePath := range sanitizeBlogCodexImagePaths(imagePaths, 6) {
		args = append(args, "--image", imagePath)
	}
	args = append(args, "-")
	cmd := exec.Command(cliPath, args...)
	cmd.Dir = filepath.Dir(outputPath)
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	var stdout strings.Builder
	var stderr strings.Builder
	readPipe := func(reader io.Reader, target *strings.Builder) {
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 1024), 1024*1024)
		for scanner.Scan() {
			target.WriteString(scanner.Text())
			target.WriteByte('\n')
		}
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go readPipe(stdoutPipe, &stdout)
	go readPipe(stderrPipe, &stderr)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			msg := strings.TrimSpace(stderr.String())
			if msg == "" {
				msg = strings.TrimSpace(stdout.String())
			}
			return fmt.Errorf("Codex CLI 실행 실패: %s", truncate(msg, 280))
		}
	case <-time.After(timeout):
		_ = cmd.Process.Kill()
		return fmt.Errorf("Codex CLI 실행 타임아웃 (%s)", timeout)
	}
	if found := findBlogGeneratedImage(outputPath, startedAt); found != "" {
		return nil
	}
	return fmt.Errorf("Codex CLI가 이미지 파일을 만들지 않았습니다")
}

func runGeminiBlogImageFile(prompt, outputPath, apiKey, model string, timeout time.Duration, imagePaths []string) error {
	if strings.TrimSpace(apiKey) == "" {
		return fmt.Errorf("Gemini 이미지 생성 API 키가 설정되지 않았습니다")
	}
	if strings.TrimSpace(model) == "" {
		model = "gemini-3.1-flash-image-preview"
	}
	parts := []map[string]any{{"text": prompt}}
	parts = append(parts, geminiBlogInlineImageParts(imagePaths)...)
	payload := map[string]any{
		"contents": []map[string]any{
			{"parts": parts},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"TEXT", "IMAGE"},
			"imageConfig": map[string]any{
				"aspectRatio": "16:9",
				"imageSize":   "1K",
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Gemini 이미지 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 300))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return err
	}
	imageData := findBlogGeminiImageData(parsed)
	if imageData == "" {
		return fmt.Errorf("Gemini 응답에 이미지 데이터가 없습니다")
	}
	decoded, err := base64.StdEncoding.DecodeString(imageData)
	if err != nil {
		return err
	}
	if img, _, err := image.Decode(bytes.NewReader(decoded)); err == nil {
		var pngBytes bytes.Buffer
		if err := png.Encode(&pngBytes, img); err == nil {
			return os.WriteFile(outputPath, pngBytes.Bytes(), 0o644)
		}
	}
	return os.WriteFile(outputPath, decoded, 0o644)
}

func geminiBlogInlineImageParts(imagePaths []string) []map[string]any {
	parts := make([]map[string]any, 0, len(imagePaths))
	for _, imagePath := range sanitizeBlogCodexImagePaths(imagePaths, 6) {
		data, err := os.ReadFile(imagePath)
		if err != nil || len(data) == 0 {
			continue
		}
		mimeType := http.DetectContentType(data)
		if !strings.HasPrefix(mimeType, "image/") {
			continue
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]any{
				"mime_type": mimeType,
				"data":      base64.StdEncoding.EncodeToString(data),
			},
		})
	}
	return parts
}

func findBlogGeminiImageData(parsed map[string]any) string {
	candidates, _ := parsed["candidates"].([]any)
	for _, candidate := range candidates {
		candidateMap, _ := candidate.(map[string]any)
		content, _ := candidateMap["content"].(map[string]any)
		parts, _ := content["parts"].([]any)
		for _, part := range parts {
			partMap, _ := part.(map[string]any)
			inlineData, _ := partMap["inlineData"].(map[string]any)
			if inlineData == nil {
				inlineData, _ = partMap["inline_data"].(map[string]any)
			}
			if data := strings.TrimSpace(stringify(inlineData["data"])); data != "" {
				return data
			}
		}
	}
	return ""
}

func findBlogGeneratedImage(outputPath string, since time.Time) string {
	if info, err := os.Stat(outputPath); err == nil && !info.IsDir() && info.Size() > 0 && !info.ModTime().Before(since) {
		return outputPath
	}
	parent := filepath.Dir(outputPath)
	entries, err := os.ReadDir(parent)
	if err != nil {
		return ""
	}
	var picked string
	var pickedMod time.Time
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" {
			continue
		}
		info, err := entry.Info()
		if err != nil || info.Size() == 0 || info.ModTime().Before(since) {
			continue
		}
		path := filepath.Join(parent, entry.Name())
		if picked == "" || info.ModTime().After(pickedMod) {
			picked = path
			pickedMod = info.ModTime()
		}
	}
	if picked == "" {
		return ""
	}
	if picked != outputPath {
		data, err := os.ReadFile(picked)
		if err == nil {
			_ = os.WriteFile(outputPath, data, 0o644)
		}
	}
	return outputPath
}

func blogStringify(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	case int:
		return strconv.Itoa(cast)
	case int64:
		return strconv.FormatInt(cast, 10)
	case float64:
		return strconv.FormatFloat(cast, 'f', -1, 64)
	default:
		raw, _ := json.Marshal(cast)
		return string(raw)
	}
}

func sanitizeBlogCodexImagePaths(imagePaths []string, limit int) []string {
	safe := make([]string, 0, len(imagePaths))
	seen := make(map[string]struct{}, len(imagePaths))
	for _, raw := range imagePaths {
		path := strings.TrimSpace(raw)
		if path == "" || !filepath.IsAbs(path) {
			continue
		}
		if _, exists := seen[path]; exists {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || info.IsDir() || info.Size() == 0 {
			continue
		}
		switch strings.ToLower(filepath.Ext(path)) {
		case ".png", ".jpg", ".jpeg", ".webp":
		default:
			continue
		}
		seen[path] = struct{}{}
		safe = append(safe, path)
		if limit > 0 && len(safe) >= limit {
			break
		}
	}
	return safe
}

func truncate(value string, limit int) string {
	text := strings.TrimSpace(value)
	if limit <= 0 || len([]rune(text)) <= limit {
		return text
	}
	return string([]rune(text)[:limit]) + "..."
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
