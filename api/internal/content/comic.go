package content

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

type comicScriptRequest struct {
	Topic          string   `json:"topic"`
	Style          string   `json:"style"`
	Layout         string   `json:"layout"`
	Reference      string   `json:"reference"`
	PanelsOverride []any    `json:"panels_override"`
	PanelCount     int      `json:"panel_count"`
	ProfileID      int      `json:"profile_id"`
	UserImageURLs  []string `json:"user_image_urls"`
}

type comicGenerateRequest struct {
	Topic                string   `json:"topic"`
	Style                string   `json:"style"`
	Layout               string   `json:"layout"`
	Reference            string   `json:"reference"`
	ScriptPromptOverride string   `json:"script_prompt_override"`
	PanelsOverride       []any    `json:"panels_override"`
	PanelCount           int      `json:"panel_count"`
	BrandName            string   `json:"brand_name"`
	LogoText             string   `json:"logo_text"`
	LogoPosition         string   `json:"logo_position"`
	LogoEnabled          bool     `json:"logo_enabled"`
	ProfileID            int      `json:"profile_id"`
	UserImageURLs        []string `json:"user_image_urls"`
}

type comicPanelGenerateRequest struct {
	Panel         map[string]any `json:"panel"`
	Topic         string         `json:"topic"`
	Style         string         `json:"style"`
	ProjectDir    string         `json:"project_dir"`
	LogoEnabled   bool           `json:"logo_enabled"`
	ProfileID     int            `json:"profile_id"`
	UserImageURLs []string       `json:"user_image_urls"`
}

type comicRecomposeRequest struct {
	ProjectDir string           `json:"project_dir"`
	Layout     string           `json:"layout"`
	Topic      string           `json:"topic"`
	Style      string           `json:"style"`
	ComicID    int64            `json:"comic_id"`
	Panels     []map[string]any `json:"panels"`
}

var comicSafeNamePattern = regexp.MustCompile(`[^\w가-힣\s-]`)

func (s *Service) handleGenerateComicScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicScriptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.Topic) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "주제를 입력하세요."})
		return
	}
	projectDir, err := s.createComicProjectDir(req.Topic)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	panels, err := s.buildComicPanels(comicGenerateRequest{
		Topic:          req.Topic,
		Style:          req.Style,
		Layout:         req.Layout,
		Reference:      req.Reference,
		PanelsOverride: req.PanelsOverride,
		PanelCount:     req.PanelCount,
		ProfileID:      req.ProfileID,
		UserImageURLs:  req.UserImageURLs,
	}, "")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_ = os.WriteFile(filepath.Join(projectDir, "panels.json"), mustJSON(panels), 0o644)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"project_dir": projectDir,
		"panel_count": len(panels),
		"panels":      panels,
	})
}

func (s *Service) handleGenerateComic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.Topic) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "주제를 입력하세요."})
		return
	}
	projectDir, err := s.createComicProjectDir(req.Topic)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	result, err := s.generateComicProject(req, projectDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleGenerateComicPanel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicPanelGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if len(req.Panel) == 0 || strings.TrimSpace(req.ProjectDir) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "panel과 project_dir이 필요합니다."})
		return
	}
	panelNumber := intFromAny(req.Panel["panel_number"])
	if panelNumber <= 0 {
		panelNumber = 1
	}
	imagePath := filepath.Join(req.ProjectDir, fmt.Sprintf("panel_%02d.png", panelNumber))
	referencePaths := s.resolveLocalImagePathsFromURLs(req.UserImageURLs, 4)
	logoVisual := s.resolveCardnewsBrandVisuals(req.ProfileID, "", "", req.LogoEnabled)
	logoPath := ""
	if logoVisual.LogoEnabled && strings.TrimSpace(logoVisual.LogoPath) != "" {
		logoPath = logoVisual.LogoPath
		referencePaths = append(referencePaths, logoPath)
	}
	if err := s.generateComicPanelImage(req.Panel, req.Topic, fallbackText(req.Style, "cute"), imagePath, referencePaths, logoPath, "", logoPath != ""); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"image_path": imagePath,
		"image_url":  filepath.ToSlash(filepath.Base(req.ProjectDir) + "/" + filepath.Base(imagePath)),
	})
}

func (s *Service) handleRecomposeComic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req comicRecomposeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.ProjectDir) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "project_dir이 필요합니다."})
		return
	}
	composedPath := filepath.Join(req.ProjectDir, "comic_full.png")
	if err := composeComicGrid(req.ProjectDir, composedPath, fallbackText(req.Layout, "2x2")); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	comicID := req.ComicID
	if strings.TrimSpace(req.Topic) != "" {
		panels := req.Panels
		if len(panels) == 0 {
			panels = collectComicPanelsFromDir(req.ProjectDir)
		}
		successCount := countComicSuccessPanels(panels)
		var err error
		if comicID > 0 {
			err = s.updateComicProject(comicID, req.Topic, fallbackText(req.Style, "cute"), req.ProjectDir, panels, composedPath, successCount)
		} else {
			comicID, err = s.saveComicProject(req.Topic, fallbackText(req.Style, "cute"), req.ProjectDir, panels, composedPath, successCount)
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"comic_id":       comicID,
		"project_dir":    req.ProjectDir,
		"composed_image": composedPath,
	})
}

func (s *Service) handleComicImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	rel := strings.TrimPrefix(r.URL.Path, "/api/comic/image/")
	rel = strings.TrimLeft(filepath.Clean("/"+rel), string(filepath.Separator))
	if rel == "" || strings.Contains(rel, "..") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid image path"})
		return
	}
	target := filepath.Join(s.dataDir, "output", "comics", rel)
	if _, err := os.Stat(target); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	http.ServeFile(w, r, target)
}

func (s *Service) handleComicHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureComicsTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	query := `SELECT * FROM comics ORDER BY datetime(created_at) DESC LIMIT 50`
	if tableExists(db, "projects") && tableExists(db, "brand_profiles") {
		query = `SELECT c.*, COALESCE(p.profile_id, 0) AS profile_id, COALESCE(bp.name, '') AS profile_name, COALESCE(bp.logo_path, '') AS profile_logo
			FROM comics c
			LEFT JOIN projects p ON p.comic_id = c.id
			LEFT JOIN brand_profiles bp ON bp.id = p.profile_id
			ORDER BY datetime(c.created_at) DESC LIMIT 50`
	}
	rows, err := db.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items, err := comicRowsToMaps(rows)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	for _, item := range items {
		var panels []map[string]any
		_ = json.Unmarshal([]byte(stringify(item["panels_json"])), &panels)
		item["panels"] = panels
		item["folder"] = stringify(item["project_dir"])
		profileID := intFromAny(item["profile_id"])
		if profileID > 0 {
			if logo := strings.TrimSpace(stringify(item["profile_logo"])); logo != "" {
				item["profile_logo_url"] = fmt.Sprintf("/api/library/image/%d/%s", profileID, url.PathEscape(logo))
			} else {
				item["profile_logo_url"] = fmt.Sprintf("/api/library/profiles/%d/logo", profileID)
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": items})
}

func (s *Service) handleComicDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	id := int64(intFromAny(req["id"]))
	folder := strings.TrimSpace(stringify(req["folder"]))
	if id <= 0 && folder == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "삭제할 만화 기록이 없습니다."})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureComicsTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	var projectDir string
	if id > 0 {
		_ = db.QueryRow(`SELECT project_dir FROM comics WHERE id = ?`, id).Scan(&projectDir)
	} else {
		projectDir = folder
	}
	if strings.TrimSpace(projectDir) != "" {
		_ = os.RemoveAll(projectDir)
	}
	if id > 0 {
		_, err = db.Exec(`DELETE FROM comics WHERE id = ?`, id)
	} else {
		_, err = db.Exec(`DELETE FROM comics WHERE project_dir = ?`, folder)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Service) buildComicPanels(req comicGenerateRequest, promptOverride string) ([]map[string]any, error) {
	if len(req.PanelsOverride) > 0 {
		panels := normalizeComicPanels(req.PanelsOverride, req.PanelCount)
		if len(panels) > 0 {
			return panels, nil
		}
	}
	panelCount := req.PanelCount
	if panelCount <= 0 {
		panelCount = 6
	}
	if panelCount > 10 {
		panelCount = 10
	}
	cfg := s.resolveTextProvider("")
	prompt := strings.TrimSpace(promptOverride)
	if prompt == "" {
		prompt = fmt.Sprintf(`
한국어 스토리 만화 컷 구성을 작성하세요.
설명 없이 JSON 배열만 출력합니다. 정확히 %d개 항목을 만듭니다.

각 항목 스키마:
{
  "panel_number": 1,
  "situation": "장면 설명",
  "dialogue": "짧은 대사",
  "narration": "짧은 내레이션",
  "visual_prompt": "이미지 생성용 시각 지시",
  "emotion": "감정 키워드"
}

조건:
- 주제: %s
- 스타일: %s
- 참고 자료: %s
- 1컷은 도입, 중간은 전개/갈등/변화, 마지막은 해결 또는 CTA로 이어지게 구성
- 각 컷의 장면, 구도, 표정이 분명히 달라야 함
- dialogue/narration은 한국어 한두 문장으로 짧게
- visual_prompt는 영어가 아니어도 되지만, 이미지 장면이 바로 그려질 정도로 구체적이어야 함
`, panelCount, strings.TrimSpace(req.Topic), fallbackText(req.Style, "cute"), truncate(strings.TrimSpace(req.Reference), 2400))
	}
	rawPanels, err := s.runJSONArrayPrompt(prompt, cfg, s.comicScriptTimeout())
	if err != nil {
		return fallbackComicPanels(req.Topic, fallbackText(req.Reference, req.Topic), panelCount), nil
	}
	panels := normalizeComicPanels(rawPanels, panelCount)
	if len(panels) == 0 {
		return fallbackComicPanels(req.Topic, fallbackText(req.Reference, req.Topic), panelCount), nil
	}
	return panels, nil
}

func normalizeComicPanels(raw []any, panelCount int) []map[string]any {
	panels := make([]map[string]any, 0, panelCount)
	for idx, item := range raw {
		panel, ok := item.(map[string]any)
		if !ok {
			continue
		}
		panels = append(panels, map[string]any{
			"panel_number":  idx + 1,
			"situation":     strings.TrimSpace(stringify(panel["situation"])),
			"dialogue":      strings.TrimSpace(stringify(panel["dialogue"])),
			"narration":     strings.TrimSpace(stringify(panel["narration"])),
			"visual_prompt": strings.TrimSpace(stringify(panel["visual_prompt"])),
			"emotion":       fallbackText(strings.TrimSpace(stringify(panel["emotion"])), "neutral"),
		})
		if len(panels) >= panelCount {
			break
		}
	}
	return panels
}

func fallbackComicPanels(topic, reference string, panelCount int) []map[string]any {
	steps := []string{
		"주인공이 문제를 마주한다",
		"문제의 원인이 드러난다",
		"해결 실마리를 찾는다",
		"해결 방법을 시도한다",
		"변화가 나타난다",
		"결과와 행동 유도가 정리된다",
	}
	panels := make([]map[string]any, 0, panelCount)
	for idx := 0; idx < panelCount; idx++ {
		stepText := steps[idx%len(steps)]
		panels = append(panels, map[string]any{
			"panel_number":  idx + 1,
			"situation":     stepText,
			"dialogue":      fmt.Sprintf("%s %d컷", strings.TrimSpace(topic), idx+1),
			"narration":     truncate(strings.TrimSpace(reference), 90),
			"visual_prompt": stepText + " scene for " + strings.TrimSpace(topic),
			"emotion":       []string{"curious", "worried", "focused", "hopeful", "relieved", "excited"}[idx%6],
		})
	}
	return panels
}

func (s *Service) generateComicPanelImage(panel map[string]any, topic, style, outputPath string, referencePaths []string, logoPath string, logoPosition string, logoEnabled bool) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	prompt := buildComicPanelPrompt(panel, topic, style, outputPath, referencePaths, logoPath, logoPosition, logoEnabled)
	if err := s.runCodexImageFile(prompt, outputPath, s.comicCodexImageTimeout(), referencePaths); err != nil {
		return err
	}
	return nil
}

func (s *Service) generateComicProject(req comicGenerateRequest, projectDir string) (map[string]any, error) {
	panels, err := s.buildComicPanels(req, req.ScriptPromptOverride)
	if err != nil {
		return nil, err
	}
	referencePaths := s.resolveLocalImagePathsFromURLs(req.UserImageURLs, 4)
	logoVisual := s.resolveCardnewsBrandVisuals(req.ProfileID, "", "", req.LogoEnabled)
	logoPath := ""
	if logoVisual.LogoEnabled && strings.TrimSpace(logoVisual.LogoPath) != "" {
		logoPath = logoVisual.LogoPath
	}
	results := make([]map[string]any, 0, len(panels))
	successCount := 0
	for idx, panel := range panels {
		imagePath := filepath.Join(projectDir, fmt.Sprintf("panel_%02d.png", idx+1))
		panelRefs := append([]string{}, referencePaths...)
		panelLogoPath := ""
		panelLogoEnabled := false
		if logoPath != "" && idx == len(panels)-1 {
			panelRefs = append(panelRefs, logoPath)
			panelLogoPath = logoPath
			panelLogoEnabled = true
		}
		if err := s.generateComicPanelImage(panel, req.Topic, fallbackText(req.Style, "cute"), imagePath, panelRefs, panelLogoPath, "", panelLogoEnabled); err != nil {
			results = append(results, map[string]any{
				"panel_number": idx + 1,
				"situation":    stringify(panel["situation"]),
				"dialogue":     stringify(panel["dialogue"]),
				"narration":    stringify(panel["narration"]),
				"image_path":   "",
				"status":       "error: " + err.Error(),
			})
			continue
		}
		successCount++
		results = append(results, map[string]any{
			"panel_number": idx + 1,
			"situation":    stringify(panel["situation"]),
			"dialogue":     stringify(panel["dialogue"]),
			"narration":    stringify(panel["narration"]),
			"image_path":   imagePath,
			"status":       "ok",
		})
	}
	_ = os.WriteFile(filepath.Join(projectDir, "panels.json"), mustJSON(results), 0o644)
	composedPath := ""
	if successCount > 0 {
		composedPath = filepath.Join(projectDir, "comic_full.png")
		if err := composeComicGrid(projectDir, composedPath, fallbackText(req.Layout, "2x2")); err != nil {
			composedPath = ""
		}
	}
	comicID, err := s.saveComicProject(req.Topic, fallbackText(req.Style, "cute"), projectDir, results, composedPath, successCount)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"status":         "ok",
		"comic_id":       comicID,
		"topic":          req.Topic,
		"panel_count":    len(results),
		"success_count":  successCount,
		"project_dir":    projectDir,
		"composed_image": composedPath,
		"panels":         results,
	}, nil
}

func buildComicPanelPrompt(panel map[string]any, topic, style, outputPath string, referencePaths []string, logoPath string, logoPosition string, logoEnabled bool) string {
	refHint := ""
	if len(referencePaths) > 0 {
		lines := make([]string, 0, len(referencePaths)+1)
		lines = append(lines, "- 참조 이미지 경로:")
		for _, ref := range referencePaths {
			if strings.TrimSpace(ref) != "" {
				lines = append(lines, "  - "+ref)
			}
		}
		lines = append(lines, "- 참조 이미지는 색감과 캐릭터 무드만 참고하고 그대로 복사하지 마세요.")
		refHint = "\n" + strings.Join(lines, "\n")
	}
	logoHint := ""
	if logoEnabled && strings.TrimSpace(logoPath) != "" {
		logoHint = fmt.Sprintf(`
- 제공된 브랜드 로고 이미지 경로: %s
- 이 컷은 마지막 컷이므로 제공된 실제 로고 이미지를 장면 안에 자연스럽게 녹이세요.
- 로고를 새로 그리거나 텍스트로 다시 쓰지 말고, 간판, 제품 표식, 소품, 패키지 라벨처럼 만화 분위기 안에 어울리게 반영하세요.
- 앱이 나중에 로고를 얹지 않으므로, 별도 워터마크처럼 보이게 강제 배치하지 마세요.`, logoPath)
	}
	return strings.TrimSpace(fmt.Sprintf(`
당신은 스토리 만화의 개별 컷 이미지를 생성합니다.

중요 규칙:
- 최종 결과물은 반드시 실제 래스터 이미지 파일 1개입니다.
- 아래 절대 경로에 정확히 저장하세요: %s
- PNG 권장, 정사각 컷 이미지로 저장하세요.
- 이미지 안에 큰 제목, 숫자 배지, 워터마크는 넣지 마세요.
- 만화 스타일: %s
- 주제: %s
- 상황: %s
- 대사: %s
- 내레이션: %s
- 감정: %s
- 시각 프롬프트: %s
- 한 컷 안에서 표정과 행동이 분명히 읽히게 그리세요.
- 작업이 끝나면 stdout에는 IMAGE_READY 한 줄만 출력하세요.%s%s
`, outputPath, style, topic, stringify(panel["situation"]), stringify(panel["dialogue"]), stringify(panel["narration"]), stringify(panel["emotion"]), stringify(panel["visual_prompt"]), refHint, logoHint))
}

func composeComicGrid(projectDir string, outputPath string, layout string) error {
	panelPaths, err := filepath.Glob(filepath.Join(projectDir, "panel_*.png"))
	if err != nil {
		return err
	}
	sort.Strings(panelPaths)
	if len(panelPaths) == 0 {
		return fmt.Errorf("컷 이미지가 없습니다")
	}
	type decodedImage struct {
		Image image.Image
		Path  string
	}
	decoded := make([]decodedImage, 0, len(panelPaths))
	for _, path := range panelPaths {
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		img, _, err := image.Decode(file)
		_ = file.Close()
		if err != nil {
			continue
		}
		decoded = append(decoded, decodedImage{Image: img, Path: path})
	}
	if len(decoded) == 0 {
		return fmt.Errorf("합성할 컷 이미지를 읽지 못했습니다")
	}
	cols, rows := parseComicLayout(layout, len(decoded))
	gap := 12
	border := 4
	panelSize := comicPanelSize(cols, rows, gap)
	canvasW := cols*panelSize + (cols+1)*gap
	canvasH := rows*panelSize + (rows+1)*gap
	canvas := image.NewRGBA(image.Rect(0, 0, canvasW, canvasH))
	draw.Draw(canvas, canvas.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	for idx, item := range decoded {
		col := idx % cols
		row := idx / cols
		x := gap + col*(panelSize+gap)
		y := gap + row*(panelSize+gap)
		borderRect := image.Rect(x-border, y-border, x+panelSize+border, y+panelSize+border)
		draw.Draw(canvas, borderRect, &image.Uniform{C: color.RGBA{R: 30, G: 30, B: 30, A: 255}}, image.Point{}, draw.Src)
		dstRect := image.Rect(x, y, x+panelSize, y+panelSize)
		scaled := resizeNearest(item.Image, panelSize, panelSize)
		draw.Draw(canvas, dstRect, scaled, scaled.Bounds().Min, draw.Src)
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return err
	}
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()
	return png.Encode(file, canvas)
}

func parseComicLayout(layout string, itemCount int) (int, int) {
	cols := 2
	rows := 1
	raw := strings.TrimSpace(strings.ToLower(layout))
	if matches := regexp.MustCompile(`^(\d+)x(\d+)$`).FindStringSubmatch(raw); len(matches) == 3 {
		parsedCols := intFromAny(matches[1])
		parsedRows := intFromAny(matches[2])
		if parsedCols > 0 {
			cols = parsedCols
		}
		if parsedRows > 0 {
			rows = parsedRows
		}
	} else if itemCount > 4 {
		switch {
		case itemCount <= 6:
			cols, rows = 3, 2
		case itemCount <= 8:
			cols, rows = 4, 2
		default:
			cols, rows = 5, 2
		}
	} else if itemCount <= 2 {
		cols, rows = itemCount, 1
	} else {
		cols, rows = 2, 2
	}
	if cols <= 0 {
		cols = 1
	}
	if rows <= 0 {
		rows = 1
	}
	if itemCount > cols*rows {
		rows = (itemCount + cols - 1) / cols
	}
	return cols, rows
}

func comicPanelSize(cols, rows, gap int) int {
	const maxCanvas = 1800
	panelByWidth := (maxCanvas - gap*(cols+1)) / maxInt(cols, 1)
	panelByHeight := (maxCanvas - gap*(rows+1)) / maxInt(rows, 1)
	panelSize := minInt(panelByWidth, panelByHeight)
	if panelSize > 540 {
		panelSize = 540
	}
	if panelSize < 220 {
		panelSize = 220
	}
	return panelSize
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func resizeNearest(src image.Image, width, height int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW == 0 || srcH == 0 {
		return dst
	}
	for y := 0; y < height; y++ {
		srcY := srcBounds.Min.Y + (y*srcH)/height
		for x := 0; x < width; x++ {
			srcX := srcBounds.Min.X + (x*srcW)/width
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}
	return dst
}

func (s *Service) createComicProjectDir(topic string) (string, error) {
	safeTopic := comicSafeNamePattern.ReplaceAllString(strings.TrimSpace(topic), "")
	safeTopic = strings.TrimSpace(strings.ReplaceAll(safeTopic, " ", "_"))
	if safeTopic == "" {
		safeTopic = "comic"
	}
	if len([]rune(safeTopic)) > 30 {
		safeTopic = string([]rune(safeTopic)[:30])
	}
	projectDir := filepath.Join(s.dataDir, "output", "comics", fmt.Sprintf("%s_%s", safeTopic, time.Now().Format("20060102_150405")))
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		return "", err
	}
	return projectDir, nil
}

func (s *Service) saveComicProject(topic, style, projectDir string, panels []map[string]any, composedImage string, successCount int) (int64, error) {
	db, err := s.openDB()
	if err != nil {
		return 0, err
	}
	defer db.Close()
	if err := ensureComicsTable(db); err != nil {
		return 0, err
	}
	raw, _ := json.Marshal(panels)
	result, err := db.Exec(
		`INSERT INTO comics (topic, style, panel_count, success_count, project_dir, panels_json, composed_image, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
		topic,
		style,
		len(panels),
		successCount,
		projectDir,
		string(raw),
		composedImage,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Service) updateComicProject(comicID int64, topic, style, projectDir string, panels []map[string]any, composedImage string, successCount int) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureComicsTable(db); err != nil {
		return err
	}
	raw, _ := json.Marshal(panels)
	_, err = db.Exec(
		`UPDATE comics SET topic=?, style=?, panel_count=?, success_count=?, project_dir=?, panels_json=?, composed_image=? WHERE id=?`,
		topic,
		style,
		len(panels),
		successCount,
		projectDir,
		string(raw),
		composedImage,
		comicID,
	)
	return err
}

func countComicSuccessPanels(panels []map[string]any) int {
	successCount := 0
	for _, panel := range panels {
		status := strings.ToLower(stringify(panel["status"]))
		imagePath := strings.TrimSpace(stringify(panel["image_path"]))
		if imagePath != "" && (status == "" || status == "ok" || strings.Contains(status, "ok")) {
			successCount++
		}
	}
	return successCount
}

func collectComicPanelsFromDir(projectDir string) []map[string]any {
	entries, err := os.ReadDir(projectDir)
	if err != nil {
		return []map[string]any{}
	}
	panels := make([]map[string]any, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		lowerName := strings.ToLower(name)
		if !strings.HasPrefix(lowerName, "panel_") {
			continue
		}
		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" {
			continue
		}
		panels = append(panels, map[string]any{
			"panel_number": len(panels) + 1,
			"image_path":   filepath.Join(projectDir, name),
			"status":       "ok",
		})
	}
	return panels
}

func ensureComicsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS comics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			topic TEXT NOT NULL,
			style TEXT DEFAULT 'cute',
			panel_count INTEGER DEFAULT 0,
			success_count INTEGER DEFAULT 0,
			project_dir TEXT DEFAULT '',
			panels_json TEXT DEFAULT '[]',
			composed_image TEXT DEFAULT '',
			created_at TEXT DEFAULT (datetime('now', 'localtime'))
		)
	`)
	return err
}

func mustJSON(value any) []byte {
	raw, _ := json.MarshalIndent(value, "", "  ")
	return raw
}

func comicRowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	result := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		holders := make([]any, len(columns))
		for i := range values {
			holders[i] = &values[i]
		}
		if err := rows.Scan(holders...); err != nil {
			return nil, err
		}
		item := make(map[string]any, len(columns))
		for i, column := range columns {
			switch cast := values[i].(type) {
			case []byte:
				item[column] = string(cast)
			default:
				item[column] = cast
			}
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func decodeImageFile(path string) (image.Image, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if img, err := png.Decode(bytes.NewReader(data)); err == nil {
		return img, nil
	}
	img, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	return img, nil
}
