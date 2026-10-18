package content

import (
	"fmt"
	"strings"
	"time"
)

func (s *Service) maybeEnhanceSourceSummaryWithCodexWeb(req keywordContentRequest, sourceSummary string) (string, map[string]any) {
	if !req.WebSearchEnhance {
		return sourceSummary, nil
	}

	searchKeyword := strings.TrimSpace(req.WebSearchKeyword)
	if searchKeyword == "" {
		searchKeyword = strings.TrimSpace(req.Keyword)
	}
	if searchKeyword == "" {
		searchKeyword = strings.TrimSpace(req.BrandName)
	}
	if searchKeyword == "" {
		return sourceSummary, map[string]any{
			"status": "skipped",
			"reason": "검색 키워드가 비어 있습니다.",
		}
	}

	sourceHints := make([]string, 0, 5)
	for _, item := range req.SelectedSources {
		title := strings.TrimSpace(item.Title)
		if title == "" {
			title = strings.TrimSpace(item.URL)
		}
		if title == "" {
			continue
		}
		line := title
		if urlValue := strings.TrimSpace(item.URL); urlValue != "" {
			line += " (" + urlValue + ")"
		}
		sourceHints = append(sourceHints, line)
		if len(sourceHints) >= 5 {
			break
		}
	}

	s.appendCodexLog("web research requested via Codex: " + searchKeyword)
	prompt := strings.TrimSpace(fmt.Sprintf(`
당신은 마케케 콘텐츠 생성을 위한 웹 리서처입니다.
반드시 실제 웹 검색을 수행해 최신 공개 자료를 확인한 뒤 결과를 JSON 객체로만 출력하세요.

[검색 키워드]
%s

[브랜드명]
%s

[참고 소스]
%s

[이미 수집된 자료]
%s

[반환 규칙]
- 설명, 머리말, 코드블록 없이 JSON 객체만 출력
- 형식:
{
  "search_keyword": "실제 사용한 검색어",
  "summary": "생성 프롬프트에 바로 붙일 수 있는 한국어 보강 요약",
  "research_points": [
    {
      "title": "핵심 포인트 제목",
      "fact": "확인된 사실 요약",
      "source": "출처명",
      "url": "https://..."
    }
  ]
}
- summary는 6문장 이하로 간결하게
- research_points는 최대 5개
- 마케팅 과장 문구 대신 사실, 숫자, 정책, 사례, 비교 포인트 위주로 정리
- URL은 실제 확인한 공개 출처만 넣기
- 한국어로 출력
`, searchKeyword, strings.TrimSpace(req.BrandName), strings.Join(sourceHints, "\n"), truncate(sourceSummary, 5000)))

	data, err := s.runJSONObjectPrompt(prompt, providerConfig{
		Provider: "codex",
		Model:    "codex-cli",
	}, 420*time.Second)
	if err != nil {
		s.appendCodexLog("web research failed: " + err.Error())
		return sourceSummary, map[string]any{
			"status":         "error",
			"search_keyword": searchKeyword,
			"error":          err.Error(),
		}
	}

	block := s.formatCodexWebResearchBlock(data, searchKeyword)
	if block == "" {
		s.appendCodexLog("web research returned empty supplement")
		return sourceSummary, map[string]any{
			"status":         "empty",
			"search_keyword": searchKeyword,
		}
	}

	s.appendCodexLog("web research completed via Codex")
	combined := strings.TrimSpace(sourceSummary)
	if combined != "" {
		combined += "\n\n"
	}
	combined += block
	return truncate(combined, 12000), map[string]any{
		"status":          "ok",
		"search_keyword":  fallbackText(strings.TrimSpace(stringify(data["search_keyword"])), searchKeyword),
		"summary":         strings.TrimSpace(stringify(data["summary"])),
		"research_points": data["research_points"],
	}
}

func (s *Service) formatCodexWebResearchBlock(data map[string]any, fallbackKeyword string) string {
	if len(data) == 0 {
		return ""
	}
	lines := []string{"[Codex 웹검색 보강]"}
	keyword := fallbackText(strings.TrimSpace(stringify(data["search_keyword"])), fallbackKeyword)
	if keyword != "" {
		lines = append(lines, "검색 키워드: "+keyword)
	}
	summary := strings.TrimSpace(stringify(data["summary"]))
	if summary != "" {
		lines = append(lines, "보강 요약: "+summary)
	}
	points, _ := data["research_points"].([]any)
	count := 0
	for _, item := range points {
		point, ok := item.(map[string]any)
		if !ok {
			continue
		}
		title := strings.TrimSpace(stringify(point["title"]))
		fact := strings.TrimSpace(stringify(point["fact"]))
		source := strings.TrimSpace(stringify(point["source"]))
		rawURL := strings.TrimSpace(stringify(point["url"]))
		if title == "" && fact == "" {
			continue
		}
		line := "- "
		if title != "" {
			line += title
			if fact != "" {
				line += ": "
			}
		}
		line += fact
		meta := make([]string, 0, 2)
		if source != "" {
			meta = append(meta, source)
		}
		if rawURL != "" {
			meta = append(meta, rawURL)
		}
		if len(meta) > 0 {
			line += " (" + strings.Join(meta, " · ") + ")"
		}
		lines = append(lines, line)
		count++
		if count >= 5 {
			break
		}
	}
	if len(lines) <= 1 {
		return ""
	}
	return strings.Join(lines, "\n")
}
