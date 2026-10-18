package content

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type comicStoryRequest struct {
	Message          string         `json:"message"`
	Style            string         `json:"style"`
	Layout           string         `json:"layout"`
	EpisodeCount     int            `json:"episode_count"`
	PanelCount       int            `json:"panel_count"`
	ProfileID        int            `json:"profile_id"`
	BrandName        string         `json:"brand_name"`
	BrandColor       string         `json:"brand_color"`
	LogoText         string         `json:"logo_text"`
	LogoPosition     string         `json:"logo_position"`
	LogoEnabled      bool           `json:"logo_enabled"`
	UserImageURLs    []string       `json:"user_image_urls"`
	SeriesProjectDir string         `json:"series_project_dir"`
	EpisodeIndex     int            `json:"episode_index"`
	StoryBundle      map[string]any `json:"story_bundle"`
	Seed             string         `json:"seed"`
	Limit            int            `json:"limit"`
}

type comicStoryProfile struct {
	Name         string
	BusinessType string
	Description  string
	Keywords     string
	BusinessGoal string
	CTAText      string
	BrandColor   string
	LogoPath     string
}

func (s *Service) handleComicStoryTopics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicStoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if req.ProfileID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "프로필을 먼저 선택하세요."})
		return
	}
	panelCount := normalizeComicStoryPanelCount(req.PanelCount)
	limit := req.Limit
	if limit <= 0 {
		limit = 24
	}
	if limit < 20 {
		limit = 20
	}
	if limit > 30 {
		limit = 30
	}
	profile := s.loadComicStoryProfile(req.ProfileID)
	if strings.TrimSpace(profile.Name) == "" && strings.TrimSpace(profile.Description) == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
		return
	}
	prompt := fmt.Sprintf(`
당신은 브랜드 맞춤형 단편 스토리만화 아이템을 기획하는 마케팅 콘텐츠 플래너입니다.
아래 브랜드 정보를 바탕으로 %d개의 서로 다른 스토리 아이템 후보를 JSON 배열로 작성하세요.

[브랜드 프로필]
%s

[사용자 추가 힌트]
%s

[기획 목표]
- 모든 아이템은 한 편짜리 %d컷 스토리만화로 바로 확장될 수 있어야 합니다.
- 재미만 있는 일상툰이 아니라 실제 상품, 서비스, 가게, 매장을 자연스럽게 알리는 홍보형 스토리여야 합니다.
- 고객 고민, 첫 발견, 비교 포인트, 방문 계기, 사용 장면, 후기, 재방문, 추천, 오해 해소, 시즌성, 직원 시점 등 진입 각도를 다양하게 섞으세요.
- 서로 비슷한 문제 상황과 해결 구조를 반복하지 마세요.
- 스타일 힌트: %s

[출력 규칙]
- 설명 문장, 마크다운, 코드블록 없이 JSON 배열만 출력하세요.
- 배열 길이는 정확히 %d개여야 합니다.
- 각 항목은 topic, hook, summary, story_message 키를 모두 포함해야 합니다.
- story_message는 사용자가 그대로 붙여넣을 수 있는 완성형 한국어 메시지 1개여야 합니다.
- story_message에는 반드시 "1편", "%d컷"에 해당하는 단편 구조가 드러나야 합니다.
`,
		limit,
		profile.contextBlock(),
		fallbackText(strings.TrimSpace(req.Seed), "없음"),
		panelCount,
		comicStoryStyleDesc(req.Style),
		limit,
		panelCount,
	)
	items, err := s.runJSONArrayPrompt(prompt, s.resolveTextProvider(""), 180*time.Second)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	normalized := normalizeComicStoryTopics(items, limit, panelCount)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"items":           normalized,
		"count":           len(normalized),
		"profile_context": profile.contextBlock(),
	})
}

func (s *Service) handleComicStoryMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicStoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if req.ProfileID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "프로필을 먼저 선택하세요."})
		return
	}
	panelCount := normalizeComicStoryPanelCount(req.PanelCount)
	profile := s.loadComicStoryProfile(req.ProfileID)
	if strings.TrimSpace(profile.Name) == "" && strings.TrimSpace(profile.Description) == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
		return
	}
	prompt := fmt.Sprintf(`
당신은 브랜드 프로필을 바탕으로 인스타그램용 홍보형 스토리만화 메시지를 만드는 마케팅 작가입니다.
아래 브랜드 정보를 기준으로 한 편짜리 %d컷 스토리만화를 시작할 수 있는 완성형 한국어 메시지 1개만 작성하세요.

[브랜드 프로필]
%s

[사용자 추가 힌트]
%s

[작성 규칙]
- 단순 소개문이 아니라 고객 문제와 해결 경험이 살아 있는 한 편짜리 스토리 기획 메시지여야 합니다.
- 상품, 서비스, 매장 분위기, 차별점이 자연스럽게 드러나야 합니다.
- 주인공, 상황, 갈등, 변화, 마무리 방향이 보여야 합니다.
- 분량은 3~6문장으로 유지하세요.
- "1편", "%d컷" 구조가 자연스럽게 드러나게 작성하세요.
- 마지막에는 방문, 예약, 문의, 구매 같은 행동 유도를 부드럽게 녹이세요.
- 설명, 제목, 따옴표, 마크다운 없이 메시지 본문만 출력하세요.
`,
		panelCount,
		profile.contextBlock(),
		fallbackText(strings.TrimSpace(req.Seed), "없음"),
		panelCount,
	)
	message, err := s.runTextPrompt(prompt, s.resolveTextProvider(""), 180*time.Second)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	message = strings.TrimSpace(message)
	if message == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "스토리 메시지 생성 결과가 비어 있습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"message":         message,
		"profile_context": profile.contextBlock(),
	})
}

func (s *Service) handleComicStoryPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicStoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "스토리 메시지를 입력하세요."})
		return
	}
	bundle := s.buildComicStoryBundle(message, req.Style, req.ProfileID, req.EpisodeCount, req.PanelCount)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":        "ok",
		"story_bundle":  bundle,
		"series_title":  stringify(bundle["series_title"]),
		"episode_count": len(anySlice(bundle["episodes"])),
		"panel_count":   normalizeComicStoryPanelCount(req.PanelCount),
	})
}

func (s *Service) handleComicStoryEpisode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicStoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "스토리 메시지를 입력하세요."})
		return
	}
	bundle := req.StoryBundle
	if len(bundle) == 0 {
		bundle = s.buildComicStoryBundle(message, req.Style, req.ProfileID, req.EpisodeCount, req.PanelCount)
	}
	episode, projectDir, err := s.generateComicStoryEpisode(bundle, req, req.EpisodeIndex, req.SeriesProjectDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"project_dir": projectDir,
		"episode":     episode,
	})
}

func (s *Service) handleComicStorySeries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicStoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	message := strings.TrimSpace(req.Message)
	if message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "스토리 메시지를 입력하세요."})
		return
	}
	bundle := req.StoryBundle
	if len(bundle) == 0 {
		bundle = s.buildComicStoryBundle(message, req.Style, req.ProfileID, req.EpisodeCount, req.PanelCount)
	}
	episodes := anySlice(bundle["episodes"])
	resolvedProjectDir := strings.TrimSpace(req.SeriesProjectDir)
	resultEpisodes := make([]map[string]any, 0, len(episodes))
	successCount := 0
	for idx := range episodes {
		item, projectDir, err := s.generateComicStoryEpisode(bundle, req, idx, resolvedProjectDir)
		if strings.TrimSpace(projectDir) != "" {
			resolvedProjectDir = projectDir
		}
		if err != nil {
			draft := mapFromAny(episodes[idx])
			resultEpisodes = append(resultEpisodes, map[string]any{
				"episode_number": intFromAny(draft["episode_number"]),
				"title":          fallbackText(strings.TrimSpace(stringify(draft["title"])), fmt.Sprintf("%d화", idx+1)),
				"summary":        stringify(draft["summary"]),
				"cliffhanger":    stringify(draft["cliffhanger"]),
				"error":          err.Error(),
				"project_dir":    resolvedProjectDir,
				"panels":         normalizeComicStoryPanels(draft["panels"], normalizeComicStoryPanelCount(req.PanelCount), stringify(draft["title"]), stringify(draft["summary"])),
			})
			continue
		}
		if strings.TrimSpace(stringify(item["composed_url"])) != "" {
			successCount++
		}
		resultEpisodes = append(resultEpisodes, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":        "ok",
		"series_title":  stringify(bundle["series_title"]),
		"story_bible":   bundle["story_bible"],
		"episode_count": len(resultEpisodes),
		"success_count": successCount,
		"project_dir":   resolvedProjectDir,
		"episodes":      resultEpisodes,
	})
}

func (s *Service) buildComicStoryBundle(message, style string, profileID, episodeCount, panelCount int) map[string]any {
	episodeCount = normalizeComicStoryEpisodeCount(episodeCount)
	panelCount = normalizeComicStoryPanelCount(panelCount)
	profile := s.loadComicStoryProfile(profileID)
	prompt := fmt.Sprintf(`
당신은 스토리만화 작가이자 마케팅 콘텐츠 기획자입니다.
아래 메시지를 바탕으로 %d편짜리 스토리만화 구조를 JSON 객체로 설계하세요.

[사용자 메시지]
%s

[브랜드 프로필]
%s

[공통 규칙]
- 각 편은 한 편의 완성된 스토리만화여야 하며, 편 수가 2편 이상이면 앞 편의 결과가 다음 편에 반영되어야 합니다.
- 각 편은 정확히 %d컷으로 구성하세요.
- 같은 주인공과 핵심 캐릭터를 유지하세요.
- 마지막 컷은 해결, 반전, CTA 중 하나가 분명히 읽히게 만드세요.
- 스타일 톤: %s
- 한국어로 작성하세요.

[출력 규칙]
- 설명 문장, 마크다운, 코드블록 없이 JSON 객체만 출력하세요.
- episodes 배열 길이는 정확히 %d개여야 합니다.
- 각 episode.panels 길이는 정확히 %d개여야 합니다.

[JSON 스키마]
{
  "series_title": "스토리 제목",
  "story_bible": {
    "premise": "전체 설정 요약",
    "setting": "배경",
    "tone": "톤",
    "characters": ["캐릭터1", "캐릭터2"],
    "continuity_rules": ["연속성 규칙1", "연속성 규칙2"]
  },
  "episodes": [
    {
      "episode_number": 1,
      "title": "1화 제목",
      "summary": "핵심 사건 요약",
      "cliffhanger": "다음 편 연결 포인트",
      "panels": [
        {
          "panel_number": 1,
          "situation": "컷 상황",
          "dialogue": "말풍선 대사",
          "narration": "지문 또는 내레이션",
          "visual_prompt": "이미지로 그릴 핵심 장면 설명",
          "emotion": "감정"
        }
      ]
    }
  ]
}
`,
		episodeCount,
		truncate(message, 8000),
		profile.contextBlock(),
		panelCount,
		comicStoryStyleDesc(style),
		episodeCount,
		panelCount,
	)
	raw, err := s.runJSONObjectPrompt(prompt, s.resolveTextProvider(""), s.comicScriptTimeout())
	if err != nil {
		return fallbackComicStoryBundle(message, episodeCount, panelCount)
	}
	return normalizeComicStoryBundle(raw, message, episodeCount, panelCount)
}

func (s *Service) generateComicStoryEpisode(bundle map[string]any, req comicStoryRequest, episodeIndex int, seriesProjectDir string) (map[string]any, string, error) {
	episodes := anySlice(bundle["episodes"])
	if len(episodes) == 0 {
		return nil, "", fmt.Errorf("스토리 구성이 없습니다. 먼저 미리보기를 생성하세요.")
	}
	if episodeIndex < 0 {
		episodeIndex = 0
	}
	if episodeIndex >= len(episodes) {
		return nil, "", fmt.Errorf("유효하지 않은 회차입니다.")
	}
	panelCount := normalizeComicStoryPanelCount(req.PanelCount)
	layout := comicStoryLayout(panelCount, req.Layout)
	profile := s.loadComicStoryProfile(req.ProfileID)
	brandName := fallbackText(strings.TrimSpace(req.BrandName), profile.Name)
	if strings.TrimSpace(req.BrandColor) == "" {
		req.BrandColor = profile.BrandColor
	}
	logoEnabled := req.LogoEnabled || strings.TrimSpace(req.LogoText) != ""
	logoText := req.LogoText
	logoPosition := fallbackText(strings.TrimSpace(req.LogoPosition), "bottom-right")
	if !logoEnabled {
		logoText = ""
		logoPosition = ""
	}
	storyBible := mapFromAny(bundle["story_bible"])
	storyBibleText := strings.Join(filterEmptyStrings([]string{
		stringify(storyBible["premise"]),
		stringify(storyBible["setting"]),
		stringify(storyBible["tone"]),
		strings.Join(stringSliceFromAny(storyBible["characters"]), " / "),
		strings.Join(stringSliceFromAny(storyBible["continuity_rules"]), " / "),
		profile.contextBlock(),
	}), "\n")
	seriesTitle := fallbackText(strings.TrimSpace(stringify(bundle["series_title"])), fmt.Sprintf("%d컷 스토리", panelCount))

	projectDir := strings.TrimSpace(seriesProjectDir)
	if projectDir == "" {
		var err error
		projectDir, err = s.createComicProjectDir(seriesTitle)
		if err != nil {
			return nil, "", err
		}
	} else if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return nil, "", err
	}

	episodeMap := mapFromAny(episodes[episodeIndex])
	episodeNumber := intFromAny(episodeMap["episode_number"])
	if episodeNumber <= 0 {
		episodeNumber = episodeIndex + 1
	}
	title := fallbackText(strings.TrimSpace(stringify(episodeMap["title"])), fmt.Sprintf("%d화", episodeNumber))
	summary := strings.TrimSpace(stringify(episodeMap["summary"]))
	cliffhanger := strings.TrimSpace(stringify(episodeMap["cliffhanger"]))
	panels := normalizeComicStoryPanels(episodeMap["panels"], panelCount, title, summary)
	episodeDir := filepath.Join(projectDir, fmt.Sprintf("episode_%02d", episodeNumber))
	if err := os.MkdirAll(episodeDir, 0o755); err != nil {
		return nil, projectDir, err
	}
	reference := strings.Join(filterEmptyStrings([]string{
		"[사용자 원문]\n" + truncate(strings.TrimSpace(req.Message), 3000),
		"[스토리 설정]\n" + storyBibleText,
		"[이번 편 요약]\n" + summary,
		"[다음 편 연결 포인트]\n" + cliffhanger,
	}), "\n\n")

	comicReq := comicGenerateRequest{
		Topic:          strings.TrimSpace(seriesTitle + " " + title),
		Style:          fallbackText(strings.TrimSpace(req.Style), "cute"),
		Layout:         layout,
		Reference:      reference,
		PanelsOverride: make([]any, 0, len(panels)),
		PanelCount:     panelCount,
		BrandName:      brandName,
		LogoEnabled:    logoEnabled,
		LogoText:       fallbackText(strings.TrimSpace(logoText), brandName),
		LogoPosition:   logoPosition,
		ProfileID:      req.ProfileID,
		UserImageURLs:  req.UserImageURLs,
	}
	for _, panel := range panels {
		comicReq.PanelsOverride = append(comicReq.PanelsOverride, panel)
	}

	result, err := s.generateComicProject(comicReq, episodeDir)
	if err != nil {
		return nil, projectDir, err
	}
	composedImage := stringify(result["composed_image"])
	composedURL := ""
	if rel, ok := comicImageRelativePath(composedImage); ok {
		composedURL = rel
	}
	return map[string]any{
		"episode_number": episodeNumber,
		"title":          title,
		"summary":        summary,
		"cliffhanger":    cliffhanger,
		"comic_id":       result["comic_id"],
		"project_dir":    result["project_dir"],
		"success_count":  result["success_count"],
		"composed_image": composedImage,
		"composed_url":   composedURL,
		"panels":         panels,
	}, projectDir, nil
}

func normalizeComicStoryBundle(raw map[string]any, message string, episodeCount, panelCount int) map[string]any {
	episodesRaw := anySlice(raw["episodes"])
	if len(episodesRaw) == 0 {
		if len(anySlice(raw["panels"])) > 0 {
			episodesRaw = []any{raw}
		}
	}
	seriesTitle := strings.TrimSpace(stringify(raw["series_title"]))
	if seriesTitle == "" {
		seriesTitle = strings.TrimSpace(stringify(raw["title"]))
	}
	if seriesTitle == "" {
		seriesTitle = fmt.Sprintf("%d컷 스토리", panelCount)
	}
	storyBible := mapFromAny(raw["story_bible"])
	premise := fallbackText(strings.TrimSpace(stringify(storyBible["premise"])), truncate(strings.TrimSpace(message), 120))
	normalizedBible := map[string]any{
		"premise":          premise,
		"setting":          strings.TrimSpace(stringify(storyBible["setting"])),
		"tone":             strings.TrimSpace(stringify(storyBible["tone"])),
		"characters":       stringSliceFromAny(storyBible["characters"]),
		"continuity_rules": stringSliceFromAny(storyBible["continuity_rules"]),
	}

	episodes := make([]map[string]any, 0, episodeCount)
	lastSummary := premise
	for idx := 0; idx < episodeCount; idx++ {
		var episodeMap map[string]any
		if idx < len(episodesRaw) {
			episodeMap = mapFromAny(episodesRaw[idx])
		}
		if len(episodeMap) == 0 {
			episodeMap = map[string]any{}
		}
		title := fallbackText(strings.TrimSpace(stringify(episodeMap["title"])), fmt.Sprintf("%d화", idx+1))
		summary := fallbackText(strings.TrimSpace(stringify(episodeMap["summary"])), lastSummary)
		cliffhanger := strings.TrimSpace(stringify(episodeMap["cliffhanger"]))
		panels := normalizeComicStoryPanels(episodeMap["panels"], panelCount, title, summary)
		episodes = append(episodes, map[string]any{
			"episode_number": idx + 1,
			"title":          title,
			"summary":        summary,
			"cliffhanger":    cliffhanger,
			"panels":         panels,
		})
		lastSummary = summary
	}
	return map[string]any{
		"series_title": seriesTitle,
		"story_bible":  normalizedBible,
		"episodes":     episodes,
	}
}

func normalizeComicStoryTopics(items []any, limit, panelCount int) []map[string]any {
	normalized := make([]map[string]any, 0, limit)
	for idx, item := range items {
		topic := ""
		hook := ""
		summary := ""
		storyMessage := ""
		switch v := item.(type) {
		case map[string]any:
			topic = fallbackText(strings.TrimSpace(stringify(v["topic"])), fallbackText(strings.TrimSpace(stringify(v["title"])), fmt.Sprintf("스토리 아이템 %d", idx+1)))
			hook = strings.TrimSpace(stringify(v["hook"]))
			summary = fallbackText(strings.TrimSpace(stringify(v["summary"])), hook)
			storyMessage = strings.TrimSpace(stringify(v["story_message"]))
		case string:
			topic = fallbackText(strings.TrimSpace(v), fmt.Sprintf("스토리 아이템 %d", idx+1))
		}
		if storyMessage == "" {
			storyMessage = fmt.Sprintf("%s 콘셉트로 고객의 고민과 해결 경험이 자연스럽게 드러나는 %d컷 한 편짜리 홍보형 스토리만화를 만들어줘.", topic, panelCount)
		}
		normalized = append(normalized, map[string]any{
			"topic":         topic,
			"hook":          hook,
			"summary":       summary,
			"story_message": storyMessage,
		})
		if len(normalized) >= limit {
			break
		}
	}
	for len(normalized) < limit {
		idx := len(normalized) + 1
		topic := fmt.Sprintf("스토리 아이템 %d", idx)
		normalized = append(normalized, map[string]any{
			"topic":         topic,
			"hook":          "고객의 일상 문제에서 시작되는 홍보 포인트",
			"summary":       "브랜드의 강점이 자연스럽게 드러나는 한 편짜리 스토리 아이템",
			"story_message": fmt.Sprintf("%s 콘셉트로 고객의 고민과 해결 경험이 자연스럽게 드러나는 %d컷 한 편짜리 홍보형 스토리만화를 만들어줘.", topic, panelCount),
		})
	}
	return normalized
}

func normalizeComicStoryPanels(raw any, panelCount int, title, summary string) []map[string]any {
	items := anySlice(raw)
	normalized := make([]map[string]any, 0, panelCount)
	for idx, item := range items {
		panel := mapFromAny(item)
		if len(panel) == 0 {
			continue
		}
		situation := fallbackText(strings.TrimSpace(stringify(panel["situation"])), fallbackText(strings.TrimSpace(stringify(panel["scene"])), fmt.Sprintf("%s 장면 %d", title, idx+1)))
		dialogue := strings.TrimSpace(stringify(panel["dialogue"]))
		narration := strings.TrimSpace(stringify(panel["narration"]))
		visualPrompt := fallbackText(strings.TrimSpace(stringify(panel["visual_prompt"])), summary)
		emotion := fallbackText(strings.TrimSpace(stringify(panel["emotion"])), "neutral")
		normalized = append(normalized, map[string]any{
			"panel_number":  idx + 1,
			"situation":     situation,
			"dialogue":      dialogue,
			"narration":     narration,
			"visual_prompt": visualPrompt,
			"emotion":       emotion,
		})
		if len(normalized) >= panelCount {
			break
		}
	}
	if len(normalized) == 0 {
		return fallbackComicPanels(title, summary, panelCount)
	}
	for len(normalized) < panelCount {
		idx := len(normalized) + 1
		normalized = append(normalized, map[string]any{
			"panel_number":  idx,
			"situation":     fmt.Sprintf("%s 장면 %d", title, idx),
			"dialogue":      "",
			"narration":     truncate(summary, 120),
			"visual_prompt": summary,
			"emotion":       "neutral",
		})
	}
	return normalized
}

func fallbackComicStoryBundle(message string, episodeCount, panelCount int) map[string]any {
	episodes := make([]map[string]any, 0, episodeCount)
	baseSummary := fallbackText(strings.TrimSpace(message), fmt.Sprintf("%d컷 스토리만화", panelCount))
	for idx := 0; idx < episodeCount; idx++ {
		title := fmt.Sprintf("%d화", idx+1)
		summary := baseSummary
		if episodeCount > 1 {
			summary = fmt.Sprintf("%s의 %d번째 편", baseSummary, idx+1)
		}
		episodes = append(episodes, map[string]any{
			"episode_number": idx + 1,
			"title":          title,
			"summary":        summary,
			"cliffhanger":    "",
			"panels":         fallbackComicPanels(title, summary, panelCount),
		})
	}
	return map[string]any{
		"series_title": fmt.Sprintf("%d컷 스토리", panelCount),
		"story_bible": map[string]any{
			"premise":          truncate(baseSummary, 160),
			"setting":          "",
			"tone":             "친근하고 몰입감 있는 홍보형 스토리",
			"characters":       []string{},
			"continuity_rules": []string{},
		},
		"episodes": episodes,
	}
}

func (s *Service) loadComicStoryProfile(profileID int) comicStoryProfile {
	if profileID <= 0 {
		return comicStoryProfile{}
	}
	db, err := s.openDB()
	if err != nil {
		return comicStoryProfile{}
	}
	defer db.Close()
	if !tableExists(db, "brand_profiles") {
		return comicStoryProfile{}
	}
	var profile comicStoryProfile
	if err := db.QueryRow(
		`SELECT name, business_type, description, keywords, business_goal, cta_text, brand_color, logo_path
		 FROM brand_profiles WHERE id = ?`,
		profileID,
	).Scan(
		&profile.Name,
		&profile.BusinessType,
		&profile.Description,
		&profile.Keywords,
		&profile.BusinessGoal,
		&profile.CTAText,
		&profile.BrandColor,
		&profile.LogoPath,
	); err != nil {
		return comicStoryProfile{}
	}
	return profile
}

func (p comicStoryProfile) contextBlock() string {
	return strings.Join(filterEmptyStrings([]string{
		"브랜드명: " + strings.TrimSpace(p.Name),
		"업종: " + strings.TrimSpace(p.BusinessType),
		"설명: " + strings.TrimSpace(p.Description),
		"핵심 키워드: " + strings.TrimSpace(p.Keywords),
		"비즈니스 목표: " + strings.TrimSpace(p.BusinessGoal),
		"주요 CTA: " + strings.TrimSpace(p.CTAText),
	}), "\n")
}

func normalizeComicStoryEpisodeCount(value int) int {
	if value <= 0 {
		return 1
	}
	if value > 10 {
		return 10
	}
	return value
}

func normalizeComicStoryPanelCount(value int) int {
	if value <= 0 {
		value = 6
	}
	if value < 1 {
		value = 1
	}
	if value > 10 {
		value = 10
	}
	return value
}

func comicStoryLayout(panelCount int, requested string) string {
	panelCount = normalizeComicStoryPanelCount(panelCount)
	requested = strings.TrimSpace(strings.ToLower(requested))
	if requested != "" {
		cols, rows := parseComicLayout(requested, panelCount)
		if cols*rows >= panelCount {
			return fmt.Sprintf("%dx%d", cols, rows)
		}
	}
	switch {
	case panelCount <= 4:
		return "2x2"
	case panelCount <= 6:
		return "3x2"
	case panelCount <= 8:
		return "4x2"
	default:
		return "5x2"
	}
}

func comicStoryStyleDesc(style string) string {
	switch strings.TrimSpace(strings.ToLower(style)) {
	case "webtoon":
		return "한국 웹툰 스타일, 깔끔한 선, 강렬한 표정"
	case "comic":
		return "미국 코믹스 스타일, 역동적인 구도와 선명한 대비"
	case "realistic":
		return "사실적인 일러스트, 세밀한 표현"
	case "manga":
		return "일본만화 스타일, 큰 눈과 스크린톤 감성"
	case "gag":
		return "개그만화 스타일, 과장된 표정과 빠른 리액션"
	default:
		return "귀여운 캐릭터, 밝은 색감, 동글동글한 그림체"
	}
}

func comicImageRelativePath(path string) (string, bool) {
	normalized := strings.ReplaceAll(strings.TrimSpace(path), `\`, "/")
	if normalized == "" {
		return "", false
	}
	marker := "/comics/"
	index := strings.Index(normalized, marker)
	if index < 0 {
		return "", false
	}
	rel := normalized[index+len(marker):]
	return rel, strings.TrimSpace(rel) != ""
}

func anySlice(value any) []any {
	switch v := value.(type) {
	case []any:
		return v
	case []map[string]any:
		items := make([]any, 0, len(v))
		for _, item := range v {
			items = append(items, item)
		}
		return items
	default:
		return nil
	}
}

func mapFromAny(value any) map[string]any {
	switch v := value.(type) {
	case map[string]any:
		return v
	default:
		return map[string]any{}
	}
}

func stringSliceFromAny(value any) []string {
	raw := anySlice(value)
	items := make([]string, 0, len(raw))
	for _, item := range raw {
		text := strings.TrimSpace(stringify(item))
		if text != "" {
			items = append(items, text)
		}
	}
	return items
}

func filterEmptyStrings(values []string) []string {
	filtered := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			filtered = append(filtered, value)
		}
	}
	return filtered
}
