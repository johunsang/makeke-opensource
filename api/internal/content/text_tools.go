package content

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

var (
	koreanTokenPattern = regexp.MustCompile(`[가-힣A-Za-z0-9][가-힣A-Za-z0-9\-]{1,19}`)
	tagBadWords        = map[string]struct{}{
		"많은": {}, "분들이": {}, "있는": {}, "하는": {}, "되는": {}, "없는": {}, "같은": {},
		"위한": {}, "대한": {}, "통해": {}, "함께": {}, "이런": {}, "그런": {}, "정말": {},
		"제목": {}, "브랜드": {}, "본문": {}, "사회": {}, "경제": {}, "문화": {}, "바로": {},
		"정리": {}, "소식": {}, "내용": {}, "공유": {}, "그리고": {}, "하지만": {},
	}
)

func (s *Service) translateToKorean(text string, provider string) (string, error) {
	cfg := s.resolveTextProvider(provider)
	prompt := fmt.Sprintf("다음 영어 문장을 자연스러운 한국어로 번역하세요. 고유명사와 브랜드명은 유지하세요. 최종 번역문만 출력하세요.\n\n%s", truncate(text, 5000))
	translated, err := s.runTextPrompt(prompt, cfg, 180000000000)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(translated), nil
}

func (s *Service) translateKeywordToEnglish(keyword string) (string, error) {
	cfg := s.resolveTextProvider("")
	prompt := fmt.Sprintf("이 한국어 검색어를 Google 뉴스 검색에 적합한 짧은 영어 검색어로 번역하세요. 설명 없이 영어 검색어만 출력하세요: %s", keyword)
	translated, err := s.runTextPrompt(prompt, cfg, 120000000000)
	if err != nil {
		return "", err
	}
	return strings.Trim(strings.TrimSpace(translated), "\"'` "), nil
}

func extractKeywordFromTextGo(text string) string {
	tags := extractLocalTags(text, 1)
	if tags != "" {
		return strings.Split(tags, ",")[0]
	}
	cleaned := strings.Join(strings.Fields(text), " ")
	return truncate(cleaned, 30)
}

func (s *Service) extractTagsGo(text string, count int, provider string) string {
	cfg := s.resolveTextProvider(provider)
	prompt := fmt.Sprintf(`네이버 블로그 태그를 %d개 만드세요.

규칙:
- 명사 또는 명사구만 출력
- 각 태그는 2~12자
- 쉼표로만 구분
- URL, 도메인명, 설명 문장, 해시태그 기호 금지

글 내용:
%s

태그만 출력:`, count, truncate(text, 1200))
	if generated, err := s.runTextPrompt(prompt, cfg, 180000000000); err == nil {
		if cleaned := normalizeTagCSV(generated, count); cleaned != "" {
			return cleaned
		}
	}
	return extractLocalTags(text, count)
}

func normalizeTagCSV(raw string, count int) string {
	parts := regexp.MustCompile(`[,\n#/]+`).Split(raw, -1)
	tags := make([]string, 0, count)
	seen := map[string]struct{}{}
	for _, part := range parts {
		tag := cleanTag(part)
		if tag == "" {
			continue
		}
		if _, exists := seen[tag]; exists {
			continue
		}
		seen[tag] = struct{}{}
		tags = append(tags, tag)
		if len(tags) >= count {
			break
		}
	}
	return strings.Join(tags, ", ")
}

func extractLocalTags(text string, count int) string {
	freq := map[string]int{}
	for _, token := range koreanTokenPattern.FindAllString(text, -1) {
		tag := cleanTag(token)
		if tag != "" {
			freq[tag]++
		}
	}
	type scoredTag struct {
		tag   string
		score int
	}
	scored := make([]scoredTag, 0, len(freq))
	for tag, score := range freq {
		scored = append(scored, scoredTag{tag: tag, score: score})
	}
	sort.Slice(scored, func(i, j int) bool {
		if scored[i].score == scored[j].score {
			return utf8.RuneCountInString(scored[i].tag) > utf8.RuneCountInString(scored[j].tag)
		}
		return scored[i].score > scored[j].score
	})
	tags := make([]string, 0, count)
	for _, item := range scored {
		tags = append(tags, item.tag)
		if len(tags) >= count {
			break
		}
	}
	return strings.Join(tags, ", ")
}

func cleanTag(raw string) string {
	tag := strings.TrimSpace(raw)
	tag = strings.Trim(tag, ".:;[]()\"'`…·~!? ")
	tag = strings.ReplaceAll(tag, "#", "")
	lower := strings.ToLower(tag)
	if strings.Contains(lower, "http") || strings.Contains(lower, "www.") || strings.Contains(lower, ".com") || strings.Contains(lower, ".kr") || strings.Contains(lower, "youtube") || strings.Contains(lower, "naver") || strings.Contains(lower, "google") {
		return ""
	}
	if _, bad := tagBadWords[tag]; bad {
		return ""
	}
	runes := utf8.RuneCountInString(tag)
	if runes < 2 || runes > 12 {
		return ""
	}
	for bad := range tagBadWords {
		if strings.Contains(tag, bad) {
			return ""
		}
	}
	return tag
}

func (s *Service) handleGenerateSNSGo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	topic := fallbackText(stringify(req["topic"]), stringify(req["keyword"]))
	source := fallbackText(stringify(req["source_text"]), stringify(req["content"]))
	platform := fallbackText(stringify(req["platform"]), "threads")
	profileID := intFromAny(req["profile_id"])
	limit := 1500
	if platform == "twitter" {
		limit = 250
	}
	textCfg := s.resolveTextProvider(stringify(req["text_provider"]))
	imageCfg := s.resolveImageProvider(stringify(req["image_provider"]), stringify(req["image_model"]))
	styleBlock := ""
	if styleText := s.formatPlatformStyle(s.loadProfileStyle(profileID), "sns"); styleText != "" {
		styleBlock = "\n[내 문체 스타일 - 반드시 최우선 적용]\n" + styleText + "\n\n문체 적용 규칙:\n- 위 문체는 기본 마케팅 톤보다 우선합니다.\n- 문장 길이, 끝맺음, 문단 호흡, 자주 쓰는 표현, 금지 표현을 플랫폼 길이에 맞게 유지하세요.\n- 프로필 문체와 충돌하는 일반적인 마케팅 말투를 쓰지 마세요.\n"
	}
	prompt := fmt.Sprintf("SNS 마케팅 전문가처럼 %s용 게시글을 한국어로 작성하세요. 이모지와 해시태그는 쓰지 마세요. %d자 이내로 최종 게시글만 출력하세요.\n프로필 문체 스타일이 제공되면 그 문체를 가장 먼저 따르세요.%s\n\n주제: %s\n내용:\n%s", platform, limit, styleBlock, topic, truncate(source, 5000))
	text, err := s.runTextPrompt(prompt, textCfg, 180000000000)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "SNS 글 생성 실패: " + err.Error()})
		return
	}
	text = strings.Join(strings.Fields(text), " ")
	if platform == "twitter" && utf8.RuneCountInString(text) > limit {
		text = string([]rune(text)[:limit-1]) + "…"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"text":       text,
		"char_count": utf8.RuneCountInString(text),
		"safe_limit": limit,
		"meta": map[string]any{
			"text_provider":  textCfg.Provider,
			"text_model":     textCfg.Model,
			"image_provider": imageCfg.Provider,
			"image_model":    imageCfg.Model,
		},
	})
}

func (s *Service) handleConvertNarrationGo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	texts, _ := req["texts"].([]any)
	if len(texts) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"narrations": []string{}})
		return
	}
	prompt := fmt.Sprintf("다음 카드뉴스 슬라이드 텍스트를 자연스러운 한국어 영상 나레이션으로 바꾸세요. JSON 배열만 출력하세요.\n\n%s", stringify(texts))
	items, err := s.runJSONArrayPrompt(prompt, s.resolveTextProvider(stringify(req["text_provider"])), 180000000000)
	if err != nil {
		fallback := make([]string, 0, len(texts))
		for _, item := range texts {
			fallback = append(fallback, strings.TrimSpace(stringify(item)))
		}
		writeJSON(w, http.StatusOK, map[string]any{"narrations": fallback})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"narrations": items})
}

func (s *Service) handleGenerateIGCaptionGo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	profileID := intFromAny(req["profile_id"])
	textCfg := s.resolveTextProvider(stringify(req["text_provider"]))
	imageCfg := s.resolveImageProvider(stringify(req["image_provider"]), stringify(req["image_model"]))
	styleBlock := ""
	if styleText := s.formatPlatformStyle(s.loadProfileStyle(profileID), "sns"); styleText != "" {
		styleBlock = "\n[내 문체 스타일 - 반드시 최우선 적용]\n" + styleText + "\n\n문체 적용 규칙:\n- 위 문체는 기본 캡션 공식보다 우선합니다.\n- 문장 호흡, 끝맺음, 자주 쓰는 표현, 금지 표현을 유지하세요.\n- 프로필 문체와 충돌하는 일반적인 홍보 말투를 쓰지 마세요.\n"
	}
	prompt := fmt.Sprintf(`다음 블로그 글을 바탕으로 인스타그램 캡션을 작성하세요.

규칙:
- 첫 줄은 후킹 문장
- 본문은 핵심 정보를 3~5줄로 요약
- 마지막은 저장/댓글/공유를 유도
- 전체 300~500자
- 이모지, 해시태그 금지
- 캡션만 출력
- 프로필 문체 스타일이 제공되면 그 문체를 가장 먼저 따르세요.
%s

키워드: %s
브랜드: %s
제목: %s
본문:
%s`, styleBlock, stringify(req["keyword"]), stringify(req["brand_name"]), stringify(req["title"]), truncate(stringify(req["content"]), 2200))
	caption, err := s.runTextPrompt(prompt, textCfg, 180000000000)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "캡션 생성 실패: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"caption": strings.TrimSpace(caption),
		"meta": map[string]any{
			"text_provider":  textCfg.Provider,
			"text_model":     textCfg.Model,
			"image_provider": imageCfg.Provider,
			"image_model":    imageCfg.Model,
		},
	})
}

func (s *Service) handleRefinePromptsGo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	prompt := fmt.Sprintf("다음 콘텐츠 생성 프롬프트 묶음을 더 명확하고 실행 가능하게 다듬어 JSON 객체로 반환하세요. 원래 키 구조를 유지하세요.\n\n%s", stringify(req))
	refined, err := s.runJSONObjectPrompt(prompt, s.resolveTextProvider(stringify(req["text_provider"])), 180000000000)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "refined": req, "warning": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, refined)
}
