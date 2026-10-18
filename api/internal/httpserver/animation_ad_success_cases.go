package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type animationAdSuccessCaseRequest struct {
	Title          string         `json:"title"`
	SourceURL      string         `json:"source_url"`
	Notes          string         `json:"notes"`
	RawText        string         `json:"raw_text"`
	ProfileContext map[string]any `json:"profile_context"`
	Model          string         `json:"model"`
}

type animationAdSuccessCaseItem struct {
	ID        int64                     `json:"id"`
	Title     string                    `json:"title"`
	SourceURL string                    `json:"source_url"`
	Notes     string                    `json:"notes"`
	Summary   string                    `json:"summary"`
	Nodes     []animationAdSemanticSeed `json:"nodes"`
	Model     string                    `json:"model"`
	CreatedAt string                    `json:"created_at"`
	UpdatedAt string                    `json:"updated_at"`
}

type animationAdSuccessCaseExtraction struct {
	Title     string                    `json:"title"`
	Summary   string                    `json:"summary"`
	Nodes     []animationAdSemanticSeed `json:"nodes"`
	CaseTrace string                    `json:"case_trace"`
	UsageRule string                    `json:"usage_rule"`
}

func (s *Server) handleAnimationAdSuccessCases(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.listAnimationAdSuccessCases(w, r)
	case http.MethodPost:
		s.createAnimationAdSuccessCase(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func ensureAnimationAdSuccessCaseSchema(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS animation_ad_success_cases (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL DEFAULT '',
			source_url TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			raw_text TEXT NOT NULL DEFAULT '',
			summary TEXT NOT NULL DEFAULT '',
			nodes_json TEXT NOT NULL DEFAULT '[]',
			model TEXT NOT NULL DEFAULT '',
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`); err != nil {
		return err
	}
	_, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_animation_ad_success_cases_updated ON animation_ad_success_cases(updated_at DESC, id DESC)`)
	return err
}

func (s *Server) listAnimationAdSuccessCases(w http.ResponseWriter, r *http.Request) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	rows, err := db.Query(`
		SELECT id, title, source_url, notes, summary, nodes_json, model, created_at, updated_at
		FROM animation_ad_success_cases
		WHERE enabled = 1
		ORDER BY updated_at DESC, id DESC
		LIMIT 30`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]animationAdSuccessCaseItem, 0)
	for rows.Next() {
		var item animationAdSuccessCaseItem
		var nodesRaw string
		if err := rows.Scan(&item.ID, &item.Title, &item.SourceURL, &item.Notes, &item.Summary, &nodesRaw, &item.Model, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		_ = json.Unmarshal([]byte(nodesRaw), &item.Nodes)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Server) createAnimationAdSuccessCase(w http.ResponseWriter, r *http.Request) {
	var req animationAdSuccessCaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request json", "detail": "성공 광고 사례 입력 데이터가 깨졌습니다."})
		return
	}
	req.Title = truncate(strings.TrimSpace(req.Title), 160)
	req.SourceURL = truncate(strings.TrimSpace(req.SourceURL), 800)
	req.Notes = truncate(strings.TrimSpace(req.Notes), 3000)
	req.RawText = truncate(strings.TrimSpace(req.RawText), 6000)
	if req.Title == "" && req.SourceURL == "" && req.Notes == "" && req.RawText == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "empty success case", "detail": "성공 광고 URL, 제목, 메모, 원문 중 하나 이상을 입력해주세요."})
		return
	}

	targets, targetErr := s.resolveHyperframesWritingPromptTargets(req.Model)
	if targetErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing writing model key", "detail": targetErr.Error()})
		return
	}
	prompt, err := buildAnimationAdSuccessCasePrompt(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	var text string
	var usedModel string
	var lastErr error
	for idx, target := range targets {
		timeout := 180 * time.Second
		if idx > 0 {
			timeout = 150 * time.Second
		}
		if target.Provider == "atlas" {
			timeout = 90 * time.Second
		}
		if target.Provider == "codex" {
			timeout = 240 * time.Second
		}
		text, lastErr = s.runHyperframesWritingDesignPrompt(prompt, target, timeout)
		if lastErr == nil {
			usedModel = target.Model
			break
		}
		if !isTransientGeminiMotionError(lastErr) {
			break
		}
	}
	if lastErr != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "success case extraction failed", "detail": safeExternalErrorDetail(lastErr)})
		return
	}

	extraction, err := parseAnimationAdSuccessCaseExtraction(text, req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "success case parse failed", "detail": err.Error(), "raw": truncate(text, 1200)})
		return
	}

	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	item, err := s.saveAnimationAdSuccessCase(db, req, extraction, usedModel)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "item": item, "nodes": item.Nodes, "model": usedModel})
}

func buildAnimationAdSuccessCasePrompt(req animationAdSuccessCaseRequest) (string, error) {
	profileJSON, err := json.MarshalIndent(req.ProfileContext, "", "  ")
	if err != nil {
		return "", fmt.Errorf("invalid profile context")
	}
	return fmt.Sprintf(`너는 쇼츠/릴스 성공 광고를 온톨로지로 분석하는 광고 전략가다.
아래 성공 광고 사례에서 다음 광고 컨셉 생성에 재사용할 수 있는 "성공 방정식" 노드를 추출하라.

절대 규칙:
- 반환은 JSON 객체 하나만 한다. markdown, 코드블록, 설명 문장을 쓰지 않는다.
- 단순 요약이 아니라 다음 광고 기획에 재사용 가능한 구조 노드만 만든다.
- 노드는 반드시 success_formula kind로 만든다.
- 노드는 3~7개만 만든다.
- 각 노드는 "왜 성공했는지", "어떤 장면/감정/리듬/공유 장치를 만들었는지", "다음 컨셉에서 어떻게 써야 하는지"가 들어가야 한다.
- 원본 브랜드명이나 플랫폼명을 그대로 베끼는 대신 구조만 일반화한다.
- 노골적 성적 표현, 혐오, 위험 행동은 학습 노드로 만들지 말고 안전한 감정/긴장/리액션 구조로 번역한다.

반환 스키마:
{
  "title": "사례 이름",
  "summary": "성공 이유 2문장",
  "case_trace": "사례 입력 -> 성공 장치 -> 재사용 규칙 추론 경로",
  "usage_rule": "다음 쇼츠 광고 컨셉에 반영하는 방법",
  "nodes": [
    {
      "kind": "success_formula",
      "slug": "short-ascii-slug",
      "name": "한국어 노드명",
      "description": "성공 광고에서 발견한 구조",
      "linked_slugs": ["scroll-stop-irregularity"],
      "prompt": "다음 광고 컨셉 생성 프롬프트에 들어갈 실행 지시",
      "weight": 70
    }
  ]
}

현재 마케케 브랜드 프로필:
%s

성공 광고 사례 입력:
- 제목: %s
- URL: %s
- 메모: %s
- 원문/관찰: %s`, string(profileJSON), fallbackHTTPText(req.Title, "제목 없음"), req.SourceURL, truncate(req.Notes, 2200), truncate(req.RawText, 4200)), nil
}

func parseAnimationAdSuccessCaseExtraction(text string, req animationAdSuccessCaseRequest) (animationAdSuccessCaseExtraction, error) {
	var lastErr error
	for _, raw := range animationAdBriefJSONCandidates(text) {
		var item animationAdSuccessCaseExtraction
		if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &item); err != nil {
			lastErr = err
			continue
		}
		normalized, err := normalizeAnimationAdSuccessCaseExtraction(item, req)
		if err != nil {
			lastErr = err
			continue
		}
		return normalized, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("AI 응답에서 JSON 객체를 찾지 못했습니다")
	}
	return animationAdSuccessCaseExtraction{}, lastErr
}

func normalizeAnimationAdSuccessCaseExtraction(item animationAdSuccessCaseExtraction, req animationAdSuccessCaseRequest) (animationAdSuccessCaseExtraction, error) {
	item.Title = truncate(firstNonEmpty(item.Title, req.Title, req.SourceURL, "성공 광고 사례"), 160)
	item.Summary = truncate(strings.TrimSpace(item.Summary), 900)
	item.CaseTrace = truncate(strings.TrimSpace(item.CaseTrace), 900)
	item.UsageRule = truncate(strings.TrimSpace(item.UsageRule), 900)
	nodes := make([]animationAdSemanticSeed, 0, 7)
	seen := map[string]bool{}
	for index, node := range item.Nodes {
		node.Kind = "success_formula"
		node.Name = truncate(strings.TrimSpace(node.Name), 120)
		node.Description = truncate(strings.TrimSpace(node.Description), 700)
		node.Prompt = truncate(strings.TrimSpace(node.Prompt), 900)
		node.Slug = slugifyAnimationAdBriefValue(node.Slug)
		if node.Slug == "" {
			node.Slug = fmt.Sprintf("learned-success-%d-%02d", time.Now().Unix(), index+1)
		}
		if !strings.HasPrefix(node.Slug, "learned-") {
			node.Slug = "learned-" + node.Slug
		}
		if node.Name == "" || node.Description == "" || node.Prompt == "" || seen[node.Slug] {
			continue
		}
		if node.Weight < 1 || node.Weight > 100 {
			node.Weight = 78
		}
		if len(node.LinkedSlugs) > 8 {
			node.LinkedSlugs = node.LinkedSlugs[:8]
		}
		seen[node.Slug] = true
		nodes = append(nodes, node)
		if len(nodes) >= 7 {
			break
		}
	}
	if len(nodes) < 3 {
		return animationAdSuccessCaseExtraction{}, fmt.Errorf("성공 광고 사례에서 온톨로지 노드를 3개 이상 추출하지 못했습니다: %d개", len(nodes))
	}
	item.Nodes = nodes
	return item, nil
}

func (s *Server) saveAnimationAdSuccessCase(db *sql.DB, req animationAdSuccessCaseRequest, extraction animationAdSuccessCaseExtraction, model string) (animationAdSuccessCaseItem, error) {
	nodesRaw, _ := json.Marshal(extraction.Nodes)
	tx, err := db.Begin()
	if err != nil {
		return animationAdSuccessCaseItem{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(`
		INSERT INTO animation_ad_success_cases (title, source_url, notes, raw_text, summary, nodes_json, model, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
		extraction.Title, req.SourceURL, req.Notes, req.RawText, extraction.Summary, string(nodesRaw), model)
	if err != nil {
		return animationAdSuccessCaseItem{}, err
	}
	caseID, err := result.LastInsertId()
	if err != nil {
		return animationAdSuccessCaseItem{}, err
	}
	for _, node := range extraction.Nodes {
		linkedRaw, _ := json.Marshal(node.LinkedSlugs)
		if _, err := tx.Exec(`
			INSERT INTO animation_ad_semantics (kind, slug, name, description, linked_slugs_json, prompt, weight, enabled, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
			ON CONFLICT(slug) DO UPDATE SET
				kind = excluded.kind,
				name = excluded.name,
				description = excluded.description,
				linked_slugs_json = excluded.linked_slugs_json,
				prompt = excluded.prompt,
				weight = excluded.weight,
				enabled = 1,
				updated_at = CURRENT_TIMESTAMP`,
			node.Kind, node.Slug, node.Name, node.Description, string(linkedRaw), node.Prompt, node.Weight); err != nil {
			return animationAdSuccessCaseItem{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return animationAdSuccessCaseItem{}, err
	}
	return animationAdSuccessCaseItem{
		ID:        caseID,
		Title:     extraction.Title,
		SourceURL: req.SourceURL,
		Notes:     req.Notes,
		Summary:   extraction.Summary,
		Nodes:     extraction.Nodes,
		Model:     model,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
	}, nil
}
