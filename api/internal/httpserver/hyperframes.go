package httpserver

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"makeke/api/internal/codexcli"
)

type hyperframesRenderRequest struct {
	HTML     string  `json:"html"`
	Name     string  `json:"name"`
	FPS      int     `json:"fps"`
	Quality  string  `json:"quality"`
	Format   string  `json:"format"`
	Duration float64 `json:"duration"`
}

type hyperframesSaveRequest struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	Duration float64 `json:"duration"`
	HTML     string  `json:"html"`
}

type hyperframesNarrationRequest struct {
	Text     string  `json:"text"`
	Voice    string  `json:"voice"`
	Model    string  `json:"model"`
	Duration float64 `json:"duration"`
}

type hyperframesNarrationScriptRequest struct {
	Topic      string   `json:"topic"`
	Objective  string   `json:"objective"`
	Tone       string   `json:"tone"`
	CTA        string   `json:"cta"`
	Aspect     string   `json:"aspect"`
	Duration   float64  `json:"duration"`
	KeyPoints  []string `json:"key_points"`
	Source     string   `json:"source"`
	SceneTexts []string `json:"scene_texts"`
}

type hyperframesScenarioPlanRequest struct {
	Topic       string   `json:"topic"`
	Source      string   `json:"source"`
	Objective   string   `json:"objective"`
	Tone        string   `json:"tone"`
	Provider    string   `json:"provider"`
	Model       string   `json:"model"`
	PlanMode    string   `json:"plan_mode"`
	CTA         string   `json:"cta"`
	Aspect      string   `json:"aspect"`
	Duration    float64  `json:"duration"`
	SceneCount  int      `json:"scene_count"`
	KeyPoints   []string `json:"key_points"`
	DesignRules string   `json:"design_rules"`
}

func isFastHyperframesScenarioPlan(req hyperframesScenarioPlanRequest) bool {
	mode := strings.ToLower(strings.TrimSpace(req.PlanMode))
	return mode == "fast" || mode == "draft" || mode == "quick"
}

func requiredScenarioMicroCutCount(req hyperframesScenarioPlanRequest) int {
	if isFastHyperframesScenarioPlan(req) {
		return 3
	}
	return 5
}

type hyperframesScenarioScene struct {
	Title               string           `json:"title"`
	Body                string           `json:"body"`
	Narration           string           `json:"narration"`
	Emphasis            []string         `json:"emphasis"`
	MicroCuts           []map[string]any `json:"micro_cuts,omitempty"`
	OverlaySlogan       string           `json:"overlay_slogan,omitempty"`
	SloganMotion        string           `json:"slogan_motion,omitempty"`
	Role                string           `json:"role,omitempty"`
	ImagePrompt         string           `json:"image_prompt,omitempty"`
	VisualMode          string           `json:"visual_mode,omitempty"`
	CutPlan             string           `json:"cut_plan,omitempty"`
	ShotType            string           `json:"shot_type,omitempty"`
	SubjectAction       string           `json:"subject_action,omitempty"`
	Camera              string           `json:"camera,omitempty"`
	Lens                string           `json:"lens,omitempty"`
	Lighting            string           `json:"lighting,omitempty"`
	ArtDirection        string           `json:"art_direction,omitempty"`
	PropsWardrobe       string           `json:"props_wardrobe,omitempty"`
	Composition         string           `json:"composition,omitempty"`
	Transition          string           `json:"transition,omitempty"`
	SoundCue            string           `json:"sound_cue,omitempty"`
	EditBeat            string           `json:"edit_beat,omitempty"`
	LipSyncHint         string           `json:"lip_sync_hint,omitempty"`
	NegativeConstraints string           `json:"negative_constraints,omitempty"`
}

type hyperframesBackgroundImageRequest struct {
	Topic              string   `json:"topic"`
	Objective          string   `json:"objective"`
	Tone               string   `json:"tone"`
	Aspect             string   `json:"aspect"`
	Provider           string   `json:"provider"`
	Model              string   `json:"model"`
	Prompt             string   `json:"prompt"`
	DesignRules        string   `json:"design_rules"`
	SceneTitle         string   `json:"scene_title"`
	SceneBody          string   `json:"scene_body"`
	Narration          string   `json:"narration"`
	ReferenceImages    []string `json:"reference_images"`
	CharacterReference string   `json:"character_reference"`
	CharacterPrompt    string   `json:"character_prompt"`
	CharacterLabel     string   `json:"character_label"`
	PersonMode         string   `json:"person_mode"`
	SceneIndex         int      `json:"scene_index"`
	Duration           float64  `json:"duration"`
}

type hyperframesImageToVideoRequest struct {
	Topic              string   `json:"topic"`
	Objective          string   `json:"objective"`
	Tone               string   `json:"tone"`
	Aspect             string   `json:"aspect"`
	Model              string   `json:"model"`
	ImageURL           string   `json:"image_url"`
	Prompt             string   `json:"prompt"`
	SceneName          string   `json:"scene_name"`
	Duration           float64  `json:"duration"`
	ReferenceImages    []string `json:"reference_images"`
	CharacterReference string   `json:"character_reference"`
	CharacterPrompt    string   `json:"character_prompt"`
	CharacterLabel     string   `json:"character_label"`
	LipSyncText        string   `json:"lip_sync_text"`
	LipSyncEnabled     bool     `json:"lip_sync_enabled"`
}

type hyperframesConcatVideosRequest struct {
	Name string   `json:"name"`
	URLs []string `json:"urls"`
}

type hyperframesBGMRequest struct {
	Topic      string   `json:"topic"`
	Tone       string   `json:"tone"`
	Objective  string   `json:"objective"`
	Source     string   `json:"source"`
	Model      string   `json:"model"`
	Duration   float64  `json:"duration"`
	Attempt    int      `json:"attempt"`
	SceneTexts []string `json:"scene_texts"`
}

type hyperframesAIGenerateRequest struct {
	Topic       string   `json:"topic"`
	Product     string   `json:"product"`
	Source      string   `json:"source"`
	Objective   string   `json:"objective"`
	Goal        string   `json:"goal"`
	Tone        string   `json:"tone"`
	CTA         string   `json:"cta"`
	Aspect      string   `json:"aspect"`
	Duration    float64  `json:"duration"`
	Provider    string   `json:"provider"`
	KeyPoints   []string `json:"key_points"`
	SceneCount  int      `json:"scene_count"`
	LogoURL     string   `json:"logo_url"`
	BrandColor  string   `json:"brand_color"`
	DesignRules string   `json:"design_rules"`
	Extras      string   `json:"extras"`
}

type atlasModelListResponse struct {
	Code string `json:"code"`
	Data []struct {
		Model       string   `json:"model"`
		Type        string   `json:"type"`
		DisplayName string   `json:"displayName"`
		FamilyName  string   `json:"familyName"`
		Categories  []string `json:"categories"`
		Tags        []string `json:"tags"`
		Priority    int      `json:"priority"`
	} `json:"data"`
}

type hyperframesRenderLog struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	Time    string `json:"time,omitempty"`
}

type hyperframesRenderJob struct {
	JobID      string                 `json:"jobId"`
	Status     string                 `json:"status"`
	Stage      string                 `json:"stage"`
	Progress   int                    `json:"progress"`
	Logs       []hyperframesRenderLog `json:"logs"`
	Error      string                 `json:"error,omitempty"`
	OutputPath string                 `json:"outputPath,omitempty"`
	OutputURL  string                 `json:"outputUrl,omitempty"`
	Filename   string                 `json:"filename,omitempty"`
	ProjectDir string                 `json:"projectDir,omitempty"`
	CreatedAt  string                 `json:"createdAt,omitempty"`
	UpdatedAt  string                 `json:"updatedAt,omitempty"`
}

var hyperframesJobs = struct {
	sync.Mutex
	items map[string]*hyperframesRenderJob
}{items: map[string]*hyperframesRenderJob{}}

func (s *Server) handleAtlasModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.atlascloud.ai/api/v1/models", nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "atlas model list failed", "detail": err.Error()})
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "atlas model list failed", "detail": truncate(string(raw), 500)})
		return
	}
	var parsed atlasModelListResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid atlas model list", "detail": err.Error()})
		return
	}
	items := make([]map[string]any, 0, len(parsed.Data))
	for _, model := range parsed.Data {
		id := strings.TrimSpace(model.Model)
		if id == "" || !atlasModelIsLLM(model.Type, model.Categories, model.Tags) {
			continue
		}
		label := strings.TrimSpace(model.DisplayName)
		if label == "" {
			label = id
		}
		items = append(items, map[string]any{
			"id":       id,
			"label":    label,
			"family":   model.FamilyName,
			"type":     model.Type,
			"tags":     model.Tags,
			"priority": model.Priority,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func atlasModelIsLLM(kind string, categories, tags []string) bool {
	if strings.EqualFold(strings.TrimSpace(kind), "Text") {
		return true
	}
	for _, value := range append(categories, tags...) {
		if strings.EqualFold(strings.TrimSpace(value), "LLM") {
			return true
		}
	}
	return false
}

func (s *Server) handleHyperframesAIGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesAIGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing gemini api key", "detail": "Gemini API 키가 없어 로컬 모션 안전망으로 전환됩니다."})
		return
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	aspect := strings.TrimSpace(req.Aspect)
	if aspect == "" {
		aspect = "9:16"
	}
	model := normalizeHyperframesGeminiTextModel(s.getSetting("MODELS.video_model", s.getSetting("MODELS.gemini_model", s.getSetting("API.gemini_model", ""))), "")
	prompt := buildGeminiHyperframesPrompt(req, aspect, duration)
	models := s.geminiGenerateContentCandidates(apiKey, []string{
		normalizeHyperframesGeminiTextModel(s.getSetting("MODELS.fast_text_model", ""), ""),
		model,
	}, true)
	var text string
	var lastErr error
	var usedModel string
	for idx, candidate := range models {
		timeout := 300 * time.Second
		if idx > 0 {
			timeout = 180 * time.Second
		}
		text, lastErr = s.runGeminiDesignPrompt(prompt, nil, apiKey, candidate, timeout)
		if lastErr == nil {
			usedModel = candidate
			break
		}
		if !isTransientGeminiMotionError(lastErr) {
			break
		}
		log.Printf("[hyperframes] Gemini motion generation retry with fallback model: model=%s err=%v", candidate, lastErr)
	}
	if lastErr != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "gemini motion generation failed", "detail": lastErr.Error()})
		return
	}
	html := extractClaudeDesignHTML(text)
	if html == "" {
		html = strings.TrimSpace(text)
	}
	if !strings.Contains(strings.ToLower(html), "<html") || !strings.Contains(html, "data-composition-id") {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "gemini returned invalid html", "detail": truncate(text, 800)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"item": map[string]any{
			"html":     normalizeHyperframesHTML(html, duration),
			"duration": duration,
			"provider": "gemini",
			"model":    usedModel,
		},
	})
}

func (s *Server) handleHyperframesGenerateScenarioPlan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesScenarioPlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	sceneCount := req.SceneCount
	if sceneCount <= 0 {
		sceneCount = expectedScenarioSceneCount(req.Duration)
	}
	if sceneCount < 1 {
		sceneCount = 1
	}
	if sceneCount > 24 {
		sceneCount = 24
	}
	fastPlan := isFastHyperframesScenarioPlan(req)
	if strings.EqualFold(strings.TrimSpace(req.Provider), "codex") || strings.EqualFold(strings.TrimSpace(req.Provider), "codex-cli") {
		scenes, text, err := s.generateCodexHyperframesScenarioPlan(req, sceneCount)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "codex scenario plan generation failed", "detail": err.Error(), "raw": truncate(text, 1200)})
			return
		}
		storyboardMeta := parseHyperframesScenarioStoryboardMeta(text)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":              true,
			"provider":        "codex",
			"model":           "codex-cli",
			"plan_mode":       req.PlanMode,
			"scene_count":     sceneCount,
			"ai_scenes":       len(scenes),
			"scenes":          scenes,
			"storyboard_meta": storyboardMeta,
		})
		return
	}
	targets, targetErr := s.resolveHyperframesWritingPromptTargets(req.Model)
	if targetErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing writing model key", "detail": targetErr.Error()})
		return
	}
	prompt := buildHyperframesScenarioPlanPrompt(req, sceneCount)
	var text string
	var err error
	var usedModel string
	var usedTarget hyperframesWritingPromptTarget
	for idx, target := range targets {
		timeout := 240 * time.Second
		if idx > 0 {
			timeout = 180 * time.Second
		}
		if target.Provider == "atlas" {
			timeout = 90 * time.Second
		}
		if fastPlan {
			timeout = 55 * time.Second
			if idx > 0 {
				timeout = 35 * time.Second
			}
			if target.Provider == "atlas" {
				timeout = 35 * time.Second
			}
		}
		text, err = s.runHyperframesWritingDesignPrompt(prompt, target, timeout)
		if err == nil {
			usedModel = target.Model
			usedTarget = target
			break
		}
		if !isTransientGeminiMotionError(err) {
			break
		}
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "scenario plan generation failed", "detail": safeExternalErrorDetail(err)})
		return
	}
	if usedTarget.Model == "" {
		usedTarget = targets[0]
	}
	scenes, err := parseHyperframesScenarioScenes(text)
	warning := ""
	missingFields := []string(nil)
	aiSceneCount := 0
	repairTimeout := 180 * time.Second
	if fastPlan {
		repairTimeout = 25 * time.Second
	}
	if err != nil {
		repairPrompt := buildHyperframesScenarioRepairPrompt(req, sceneCount, text, 0, []string{"JSON 파싱 오류: " + err.Error()})
		repaired := false
		for _, repairTarget := range prependHyperframesWritingTarget(targets, usedTarget) {
			repairText, repairErr := s.runHyperframesWritingDesignPrompt(repairPrompt, repairTarget, repairTimeout)
			if repairErr != nil {
				if !isTransientGeminiMotionError(repairErr) {
					break
				}
				continue
			}
			repairedScenes, parseErr := parseHyperframesScenarioScenes(repairText)
			if parseErr != nil {
				continue
			}
			aiSceneCount = len(repairedScenes)
			scenes = normalizeHyperframesScenarioScenes(repairedScenes, req, sceneCount)
			missingFields = scenarioScenesMissingSurfaceFields(scenes, sceneCount, req)
			if len(scenes) == sceneCount && len(missingFields) == 0 {
				text = repairText
				warning = "AI 시나리오 JSON을 자동 수리해 진행했습니다."
				repaired = true
				break
			}
		}
		if !repaired {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "scenario plan parse failed", "detail": scenarioPlanParseErrorDetail(err, text), "raw": truncate(text, 1200)})
			return
		}
	} else {
		aiSceneCount = len(scenes)
		scenes = normalizeHyperframesScenarioScenes(scenes, req, sceneCount)
		missingFields = scenarioScenesMissingSurfaceFields(scenes, sceneCount, req)
	}
	if len(scenes) != sceneCount || len(missingFields) > 0 {
		repairPrompt := buildHyperframesScenarioRepairPrompt(req, sceneCount, text, len(scenes), missingFields)
		for _, repairTarget := range prependHyperframesWritingTarget(targets, usedTarget) {
			repairText, repairErr := s.runHyperframesWritingDesignPrompt(repairPrompt, repairTarget, repairTimeout)
			if repairErr != nil {
				if !isTransientGeminiMotionError(repairErr) {
					break
				}
				continue
			}
			if repairedScenes, parseErr := parseHyperframesScenarioScenes(repairText); parseErr == nil {
				aiSceneCount = len(repairedScenes)
				repairedNormalizedScenes := normalizeHyperframesScenarioScenes(repairedScenes, req, sceneCount)
				repairedMissingFields := scenarioScenesMissingSurfaceFields(repairedNormalizedScenes, sceneCount, req)
				if len(repairedNormalizedScenes) == sceneCount && len(repairedMissingFields) == 0 {
					scenes = repairedNormalizedScenes
					missingFields = nil
					text = repairText
					warning = "AI 시나리오 응답을 재작성해 씬 수를 맞췄습니다."
					break
				}
			}
		}
	}
	if len(scenes) != sceneCount {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "scenario scene count mismatch", "detail": fmt.Sprintf("AI returned %d scenes, expected %d", len(scenes), sceneCount), "raw": truncate(text, 1200)})
		return
	}
	if len(missingFields) > 0 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "scenario scene fields missing", "detail": "AI returned incomplete scenes: " + strings.Join(missingFields, "; "), "raw": truncate(text, 1200)})
		return
	}
	resp := map[string]any{
		"ok":              true,
		"provider":        firstNonEmpty(usedTarget.Provider, targets[0].Provider),
		"model":           firstNonEmpty(usedModel, usedTarget.Model, targets[0].Model),
		"plan_mode":       req.PlanMode,
		"scene_count":     sceneCount,
		"ai_scenes":       aiSceneCount,
		"scenes":          scenes,
		"storyboard_meta": parseHyperframesScenarioStoryboardMeta(text),
	}
	if warning != "" {
		resp["warning"] = warning
	} else if aiSceneCount != sceneCount {
		resp["warning"] = fmt.Sprintf("AI가 %d개 씬을 반환해 %d개 씬으로 보정했습니다.", aiSceneCount, sceneCount)
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleHyperframesRenderNativeAsync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesRenderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.HTML) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "html is required"})
		return
	}
	html := normalizeHyperframesHTML(req.HTML, req.Duration)
	npxPath := resolveNpxPath(s.config.ProjectRoot)
	if npxPath == "" {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "npx not found", "detail": "영상 효과 영상 만들기에는 Node.js/npx가 필요합니다."})
		return
	}

	jobID := fmt.Sprintf("hf-%d", time.Now().UnixNano())
	dataDir := s.hyperframesDataDir()
	projectDir := filepath.Join(dataDir, "hyperframes", "jobs", jobID)
	outputDir := filepath.Join(dataDir, "hyperframes", "outputs")
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create project dir"})
		return
	}
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create output dir"})
		return
	}
	html = s.materializeHyperframesAudioAssets(html, projectDir)
	html = s.materializeHyperframesImageAssets(html, projectDir)
	html = s.materializeHyperframesVideoAssets(html, projectDir)
	html = s.normalizeHyperframesMediaDurations(html, projectDir)
	html = setHyperframesCompositionDuration(html, inferHyperframesDuration(html))
	if err := os.WriteFile(filepath.Join(projectDir, "index.html"), []byte(html), 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to write index.html"})
		return
	}

	format := sanitizeHyperframesFormat(req.Format)
	quality := sanitizeHyperframesQuality(req.Quality)
	fps := req.FPS
	if fps != 24 && fps != 30 && fps != 60 {
		fps = 30
	}
	name := sanitizeHyperframesName(req.Name)
	if name == "" {
		name = "makeke-motion"
	}
	filename := fmt.Sprintf("%s-%s.%s", name, jobID, format)
	outputPath := filepath.Join(outputDir, filename)

	now := time.Now().Format(time.RFC3339)
	job := &hyperframesRenderJob{
		JobID:      jobID,
		Status:     "queued",
		Stage:      "queued",
		Progress:   1,
		ProjectDir: projectDir,
		Filename:   filename,
		OutputPath: outputPath,
		OutputURL:  "/api/hyperframes/output/" + filename,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	job.addLog("info", "HyperFrames 렌더 작업을 접수했습니다.")
	hyperframesJobs.Lock()
	hyperframesJobs.items[jobID] = job
	hyperframesJobs.Unlock()

	go s.runHyperframesRender(jobID, projectDir, outputPath, fps, quality, format, npxPath)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "jobId": jobID, "job": job})
}

func (s *Server) runHyperframesRender(jobID, projectDir, outputPath string, fps int, quality, format, npxPath string) {
	updateJob(jobID, func(job *hyperframesRenderJob) {
		job.Status = "running"
		job.Stage = "prepare"
		job.Progress = 5
		job.addLog("info", "index.html을 HyperFrames 프로젝트로 준비했습니다.")
	})

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	args := []string{"--yes", "hyperframes", "render", "--fps", fmt.Sprintf("%d", fps), "--quality", quality, "--format", format}
	if workers := s.hyperframesRenderWorkers(); workers != "" {
		args = append(args, "--workers", workers)
	}
	args = append(args, "--output", outputPath)
	cmd := exec.CommandContext(ctx, npxPath, args...)
	cmd.Dir = projectDir
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		failHyperframesJob(jobID, err)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		failHyperframesJob(jobID, err)
		return
	}
	if err := cmd.Start(); err != nil {
		failHyperframesJob(jobID, err)
		return
	}
	updateJob(jobID, func(job *hyperframesRenderJob) {
		job.Stage = "rendering"
		job.Progress = 10
		job.addLog("info", "npx hyperframes render를 시작했습니다.")
	})

	var wg sync.WaitGroup
	wg.Add(2)
	go scanHyperframesOutput(jobID, stdout, "info", &wg)
	go scanHyperframesOutput(jobID, stderr, "error", &wg)
	waitCh := make(chan error, 1)
	go func() {
		wg.Wait()
		waitCh <- cmd.Wait()
	}()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	var lastSize int64
	stableTicks := 0
	for {
		select {
		case err = <-waitCh:
			if ctx.Err() == context.DeadlineExceeded {
				failHyperframesJob(jobID, fmt.Errorf("렌더 시간이 15분을 초과했습니다"))
				return
			}
			if err != nil {
				if outputReady(outputPath) {
					completeHyperframesJob(jobID, "렌더 프로세스 종료 신호가 있었지만 MP4 파일이 준비되어 완료 처리했습니다.")
					return
				}
				failHyperframesJob(jobID, err)
				return
			}
			if !outputReady(outputPath) {
				failHyperframesJob(jobID, fmt.Errorf("렌더 결과 파일이 없거나 비어 있습니다"))
				return
			}
			completeHyperframesJob(jobID, "MP4 렌더 파일이 준비되었습니다.")
			return
		case <-ticker.C:
			if ctx.Err() == context.DeadlineExceeded {
				killHyperframesCommand(cmd, outputPath)
				<-waitCh
				failHyperframesJob(jobID, fmt.Errorf("렌더 시간이 15분을 초과했습니다"))
				return
			}
			size := outputFileSize(outputPath)
			if size <= 0 {
				stableTicks = 0
				lastSize = 0
				continue
			}
			if size == lastSize {
				stableTicks++
			} else {
				stableTicks = 0
				lastSize = size
			}
			if stableTicks >= 3 && size > 256*1024 {
				completeHyperframesJob(jobID, "MP4 파일이 준비되어 렌더 프로세스 종료 대기 없이 완료 처리했습니다.")
				killHyperframesCommand(cmd, outputPath)
				<-waitCh
				return
			}
		}
	}
}

func killHyperframesCommand(cmd *exec.Cmd, outputPath string) {
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	if runtime.GOOS == "windows" {
		return
	}
	if outputPath != "" {
		_ = exec.Command("pkill", "-f", outputPath).Run()
	}
}

func outputReady(outputPath string) bool {
	info, err := os.Stat(outputPath)
	return err == nil && info.Size() > 0
}

func outputFileSize(outputPath string) int64 {
	info, err := os.Stat(outputPath)
	if err != nil {
		return 0
	}
	return info.Size()
}

func completeHyperframesJob(jobID, message string) {
	updateJob(jobID, func(job *hyperframesRenderJob) {
		job.Status = "complete"
		job.Stage = "complete"
		job.Progress = 100
		job.Error = ""
		job.addLog("success", message)
	})
}

func scanHyperframesOutput(jobID string, reader io.Reader, fallbackLevel string, wg *sync.WaitGroup) {
	defer wg.Done()
	scanner := bufio.NewScanner(reader)
	progressRe := regexp.MustCompile(`(\d{1,3})%`)
	ansiRe := regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]`)
	for scanner.Scan() {
		raw := scanner.Text()
		line := strings.TrimSpace(ansiRe.ReplaceAllString(raw, ""))
		if line == "" {
			continue
		}
		if isNoisyHyperframesLog(line) {
			continue
		}
		updateJob(jobID, func(job *hyperframesRenderJob) {
			level := fallbackLevel
			if strings.Contains(strings.ToLower(line), "complete") || strings.Contains(line, "완료") {
				level = "success"
			}
			if fallbackLevel == "error" && (strings.Contains(strings.ToLower(line), "non-blocking") || isHyperframesFontWarning(line)) {
				level = "info"
			}
			if match := progressRe.FindStringSubmatch(line); len(match) == 2 {
				var pct int
				fmt.Sscanf(match[1], "%d", &pct)
				if pct > job.Progress {
					job.Progress = pct
				}
				if pct >= 75 {
					job.Stage = "encoding"
				} else if pct >= 20 {
					job.Stage = "rendering"
				}
			}
			job.addLog(level, line)
		})
	}
}

func isNoisyHyperframesLog(line string) bool {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "non-blocking") && strings.Contains(lower, "failed to load resource") && strings.Contains(lower, "404") {
		return true
	}
	if strings.Contains(lower, "to fix, pick one") ||
		strings.Contains(lower, "use a mapped font name") ||
		strings.Contains(lower, "see list above") {
		return true
	}
	if isHyperframesFontWarning(line) ||
		strings.Contains(lower, "mapped fonts:") ||
		strings.Contains(lower, "injected deterministic @font-face") ||
		strings.Contains(lower, "font_aliases") ||
		strings.Contains(lower, "docs: https://hyperframes") {
		return true
	}
	return false
}

func isHyperframesFontWarning(line string) bool {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "font") {
		return strings.Contains(lower, "warning") ||
			strings.Contains(lower, "deterministic") ||
			strings.Contains(lower, "font-face") ||
			strings.Contains(lower, "font_aliases") ||
			strings.Contains(lower, "mapped fonts:") ||
			strings.Contains(lower, "mapped font name") ||
			strings.Contains(lower, "install the font") ||
			strings.Contains(lower, "docs: https://hyperframes")
	}
	return false
}

func (s *Server) handleHyperframesRenderJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	jobID := strings.TrimPrefix(r.URL.Path, "/api/hyperframes/render-jobs/")
	hyperframesJobs.Lock()
	job := hyperframesJobs.items[jobID]
	hyperframesJobs.Unlock()
	if job == nil {
		if restored := s.restoreHyperframesJobFromOutput(jobID); restored != nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "job": restored})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "render job not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "job": job})
}

func (s *Server) restoreHyperframesJobFromOutput(jobID string) *hyperframesRenderJob {
	if strings.TrimSpace(jobID) == "" || strings.Contains(jobID, "/") {
		return nil
	}
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	matches, err := filepath.Glob(filepath.Join(outputDir, "*"+jobID+".*"))
	if err != nil || len(matches) == 0 {
		return nil
	}
	path := matches[0]
	info, err := os.Stat(path)
	if err != nil || info.Size() == 0 {
		return nil
	}
	filename := filepath.Base(path)
	now := time.Now().Format(time.RFC3339)
	job := &hyperframesRenderJob{
		JobID:      jobID,
		Status:     "complete",
		Stage:      "complete",
		Progress:   100,
		OutputPath: path,
		OutputURL:  "/api/hyperframes/output/" + filename,
		Filename:   filename,
		UpdatedAt:  now,
	}
	job.addLog("success", "서버 재시작 후 기존 MP4 렌더 파일을 찾아 완료 상태로 복구했습니다.")
	hyperframesJobs.Lock()
	hyperframesJobs.items[jobID] = job
	hyperframesJobs.Unlock()
	return job
}

func (s *Server) handleHyperframesOutput(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	filename, _ := url.PathUnescape(filepath.Base(strings.TrimPrefix(r.URL.Path, "/api/hyperframes/output/")))
	if filename == "." || filename == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "filename is required"})
		return
	}
	path := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs", filename)
	http.ServeFile(w, r, path)
}

func (s *Server) handleHyperframesConcatVideos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesConcatVideosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	paths, err := s.resolveHyperframesOutputVideoPaths(req.URLs)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid video list", "detail": err.Error()})
		return
	}
	if len(paths) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "video list is empty"})
		return
	}
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create output dir"})
		return
	}
	name := sanitizeFilenamePart(firstNonEmpty(req.Name, "image-video-final"))
	if name == "" {
		name = "image-video-final"
	}
	outputName := fmt.Sprintf("%s-%d.mp4", name, time.Now().UnixNano())
	outputPath := filepath.Join(outputDir, outputName)
	if len(paths) == 1 {
		if err := copyFile(paths[0], outputPath); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to copy video", "detail": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "url": "/api/hyperframes/output/" + outputName, "path": outputPath, "count": 1})
		return
	}
	if err := concatVideosWithFFmpeg(paths, outputPath); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "video concat failed", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "url": "/api/hyperframes/output/" + outputName, "path": outputPath, "count": len(paths)})
}

func (s *Server) resolveHyperframesOutputVideoPaths(urls []string) ([]string, error) {
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	var paths []string
	for _, raw := range urls {
		item := strings.TrimSpace(raw)
		if item == "" {
			continue
		}
		if strings.HasPrefix(item, "/api/hyperframes/output/") {
			rawFilename := filepath.Base(strings.TrimPrefix(item, "/api/hyperframes/output/"))
			filename, _ := url.PathUnescape(rawFilename)
			if filename == "" {
				filename = rawFilename
			}
			path := filepath.Join(outputDir, filename)
			if !strings.HasPrefix(filepath.Clean(path), filepath.Clean(outputDir)+string(os.PathSeparator)) {
				return nil, fmt.Errorf("invalid output path")
			}
			if !outputReady(path) {
				return nil, fmt.Errorf("video not found: %s", filename)
			}
			paths = append(paths, path)
			continue
		}
		if filepath.IsAbs(item) {
			clean := filepath.Clean(item)
			if !strings.HasPrefix(clean, filepath.Clean(outputDir)+string(os.PathSeparator)) {
				return nil, fmt.Errorf("outside output dir: %s", filepath.Base(clean))
			}
			if !outputReady(clean) {
				return nil, fmt.Errorf("video not found: %s", filepath.Base(clean))
			}
			paths = append(paths, clean)
			continue
		}
		return nil, fmt.Errorf("unsupported video url: %s", truncate(item, 80))
	}
	return paths, nil
}

func concatVideosWithFFmpeg(paths []string, outputPath string) error {
	ffmpegPath, err := exec.LookPath("ffmpeg")
	if err != nil {
		return fmt.Errorf("ffmpeg를 찾을 수 없습니다: %w", err)
	}
	listFile, err := os.CreateTemp(filepath.Dir(outputPath), "concat-*.txt")
	if err != nil {
		return err
	}
	listPath := listFile.Name()
	defer os.Remove(listPath)
	writer := bufio.NewWriter(listFile)
	for _, path := range paths {
		escaped := strings.ReplaceAll(path, "'", "'\\''")
		if _, err := fmt.Fprintf(writer, "file '%s'\n", escaped); err != nil {
			_ = listFile.Close()
			return err
		}
	}
	if err := writer.Flush(); err != nil {
		_ = listFile.Close()
		return err
	}
	if err := listFile.Close(); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	copyArgs := []string{"-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath}
	if raw, err := exec.CommandContext(ctx, ffmpegPath, copyArgs...).CombinedOutput(); err == nil && outputReady(outputPath) {
		return nil
	} else if ctx.Err() != nil {
		return ctx.Err()
	} else {
		_ = os.Remove(outputPath)
		reencodeArgs := []string{"-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "18", "-an", outputPath}
		if raw2, err2 := exec.CommandContext(ctx, ffmpegPath, reencodeArgs...).CombinedOutput(); err2 != nil {
			return fmt.Errorf("ffmpeg concat 실패: %v / %s", err2, truncate(string(append(raw, raw2...)), 1200))
		}
	}
	if !outputReady(outputPath) {
		return fmt.Errorf("합본 파일이 생성되지 않았습니다")
	}
	return nil
}

func (s *Server) handleHyperframesGenerateNarrationScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesNarrationScriptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	script := s.generateHyperframesNarrationScript(req)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"script":   script,
		"provider": "makeke",
	})
}

func (s *Server) handleHyperframesGenerateBackgroundImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesBackgroundImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	imageURL, detail, err := s.generateHyperframesBackgroundImage(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":     false,
			"error":  "background image generation failed",
			"detail": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"url":    imageURL,
		"detail": detail,
	})
}

func (s *Server) handleHyperframesGenerateImageVideo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesImageToVideoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	videoURL, detail, actualDuration, err := s.generateAtlasHyperframesImageVideo(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":     false,
			"error":  "image to video generation failed",
			"detail": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"url":             videoURL,
		"detail":          detail,
		"model":           normalizeAtlasImageVideoModel(req.Model),
		"duration":        actualDuration,
		"actual_duration": actualDuration,
		"has_audio":       true,
	})
}

func (s *Server) generateHyperframesBackgroundImage(req hyperframesBackgroundImageRequest) (string, string, error) {
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	modelOverride := strings.TrimSpace(req.Model)
	if provider == "" {
		provider = "gemini"
	}
	modelLower := strings.ToLower(modelOverride)
	if provider == "codex" || modelLower == "codex-cli" {
		return s.generateCodexHyperframesBackgroundImage(req)
	}
	if strings.Contains(modelLower, "nano-banana") {
		provider = "gemini"
	}
	if provider == "atlas" || strings.HasPrefix(provider, "atlas") || strings.Contains(modelOverride, "ERNIE-Image") || strings.HasPrefix(modelOverride, "baidu/") || strings.HasPrefix(strings.ToLower(modelOverride), "openai/gpt-image-2") || strings.HasPrefix(strings.ToLower(modelOverride), "qwen/") || strings.HasPrefix(strings.ToLower(modelOverride), "alibaba/") {
		if modelOverride == "" {
			modelOverride = "openai/gpt-image-2-developer/text-to-image"
		}
		return s.generateAtlasHyperframesBackgroundImage(req, modelOverride)
	}
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey == "" {
		return "", "", fmt.Errorf("Gemini 이미지 생성 API 키가 없습니다")
	}
	model := modelOverride
	if model == "" {
		model = strings.TrimSpace(s.getSetting("MODELS.image_model", s.getSetting("API.gemini_image_model", "")))
	}
	if strings.Contains(strings.ToLower(model), "nano-banana") || model == "" || model == "codex-cli" {
		model = "gemini-3-pro-image-preview"
	}
	aspect := normalizeGeminiImageAspect(req.Aspect)
	prompt := buildHyperframesBackgroundImagePrompt(req)
	referenceInputs := append([]string{}, req.ReferenceImages...)
	if strings.TrimSpace(req.CharacterReference) != "" {
		referenceInputs = append([]string{req.CharacterReference}, referenceInputs...)
	}
	contentParts := []map[string]any{{"text": prompt}}
	contentParts = append(contentParts, s.geminiReferenceImageParts(referenceInputs, 4)...)
	payload := map[string]any{
		"contents": []map[string]any{{
			"parts": contentParts,
		}},
		"generationConfig": map[string]any{
			"responseModalities": []string{"TEXT", "IMAGE"},
			"imageConfig": map[string]any{
				"aspectRatio": aspect,
				"imageSize":   "1K",
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("Gemini 이미지 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	imageBytes, mimeType, err := extractGeminiInlineImage(raw)
	if err != nil {
		return "", "", err
	}
	ext := imageExtensionFromMime(mimeType)
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", "", err
	}
	sceneIndex := req.SceneIndex
	if sceneIndex <= 0 {
		sceneIndex = 1
	}
	name := fmt.Sprintf("scene-bg-%02d-%d%s", sceneIndex, time.Now().UnixNano(), ext)
	if err := validateGeneratedImageAspect(imageBytes, req.Aspect); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(filepath.Join(outputDir, name), imageBytes, 0o644); err != nil {
		return "", "", err
	}
	return "/api/hyperframes/output/" + url.PathEscape(name), "Gemini image background generated with " + model, nil
}

func (s *Server) generateCodexHyperframesBackgroundImage(req hyperframesBackgroundImageRequest) (string, string, error) {
	cliPath, err := exec.LookPath("codex")
	if err != nil {
		return "", "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", "", err
	}
	sceneIndex := req.SceneIndex
	if sceneIndex <= 0 {
		sceneIndex = 1
	}
	name := fmt.Sprintf("scene-bg-%02d-codex-%d.png", sceneIndex, time.Now().UnixNano())
	outputPath := filepath.Join(outputDir, name)
	startedAt := time.Now().Add(-1 * time.Second)
	prompt := strings.TrimSpace(buildHyperframesBackgroundImagePrompt(req) + `

[Codex 이미지 생성 규칙]
- 최종 결과물은 반드시 실제 래스터 이미지 파일 1개입니다.
- 화면비는 반드시 ` + normalizeAtlasImageAspect(req.Aspect) + `이고, 권장 캔버스는 ` + codexImageCanvasRule(req.Aspect) + `입니다.
- 아래 절대 경로에 정확히 PNG 파일로 저장하세요: ` + outputPath + `
- 화면 문구, 자막, CTA, 가격표, 워터마크, 가짜 로고는 이미지에 넣지 마세요. 단, 사용자가 제공한 실제 브랜드 로고 reference가 있으면 새로 그리지 말고 배경 이미지 안의 간판, 제품 표식, 앱 아이콘, 공간 소품처럼 자연스럽게 합성할 수 있습니다.
- 모든 텍스트와 CTA는 이후 HyperFrames HTML/GSAP 레이어에서 합성합니다.
- 배경 컨셉 이미지로만 사용되므로 중앙/하단 문구 영역은 비워두고, 소재/브랜드 색/디자인 규칙은 시각 분위기와 오브젝트에만 반영하세요.
- 작업이 끝나면 stdout에는 IMAGE_READY 한 줄만 출력하세요.
`)
	tmpRefs := make([]string, 0)
	defer func() {
		for _, path := range tmpRefs {
			_ = os.Remove(path)
		}
	}()
	args := codexcli.ExecArgs(cliPath)
	for _, ref := range append([]string{req.CharacterReference}, req.ReferenceImages...) {
		ref = strings.TrimSpace(ref)
		if ref == "" {
			continue
		}
		lower := strings.ToLower(ref)
		if strings.HasPrefix(lower, "data:image/") {
			path, err := writeDataURLTempFile(ref)
			if err == nil && path != "" {
				tmpRefs = append(tmpRefs, path)
				args = append(args, "--image", path)
			}
		} else if strings.HasPrefix(ref, "/api/hyperframes/output/") {
			filename := filepath.Base(strings.TrimPrefix(ref, "/api/hyperframes/output/"))
			path := filepath.Join(outputDir, filename)
			if _, err := os.Stat(path); err == nil {
				args = append(args, "--image", path)
			}
		}
		if len(args) > 18 {
			break
		}
	}
	args = append(args, "-")
	cmd := exec.Command(cliPath, args...)
	cmd.Dir = outputDir
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", "", err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return "", "", err
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
		return "", "", err
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
			return "", "", fmt.Errorf("Codex CLI 이미지 생성 실패: %s", truncate(msg, 320))
		}
	case <-time.After(10 * time.Minute):
		_ = cmd.Process.Kill()
		return "", "", fmt.Errorf("Codex CLI 이미지 생성 시간이 초과되었습니다")
	}
	found := findRecentHyperframesImage(outputPath, startedAt)
	if found == "" {
		return "", "", fmt.Errorf("Codex CLI가 이미지 파일을 만들지 않았습니다")
	}
	raw, err := os.ReadFile(found)
	if err != nil {
		return "", "", err
	}
	if err := validateGeneratedImageAspect(raw, req.Aspect); err != nil {
		return "", "", err
	}
	if found != outputPath {
		if err := os.WriteFile(outputPath, raw, 0o644); err != nil {
			return "", "", err
		}
	}
	return "/api/hyperframes/output/" + url.PathEscape(name), "Codex CLI image background generated", nil
}

func (s *Server) generateCodexHyperframesScenarioPlan(req hyperframesScenarioPlanRequest, sceneCount int) ([]hyperframesScenarioScene, string, error) {
	cliPath, err := exec.LookPath("codex")
	if err != nil {
		return nil, "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	microCutRule := "각 micro_cuts는 최소 5개이며"
	if isFastHyperframesScenarioPlan(req) {
		microCutRule = "빠른 초안이므로 각 micro_cuts는 정확히 3개이며"
	}
	prompt := strings.TrimSpace(buildHyperframesScenarioPlanPrompt(req, sceneCount) + `

[Codex CLI 출력 규칙]
- 반드시 JSON 객체만 출력하세요. 마크다운, 설명, 코드블록을 붙이지 마세요.
- 최상위 객체는 storyboard_meta와 scenes만 포함하고, scenes 배열 길이는 정확히 ` + strconv.Itoa(sceneCount) + `개입니다.
- storyboard_meta에는 creative_field, selection_strategy, selection_criteria, creative_audit, diversity_axes, required_roles, field_questions, field_constraints를 포함합니다.
- 각 씬 객체는 title, body, narration, emphasis, overlay_slogan, slogan_motion, image_prompt, shot_type, subject_action, camera, lens, lighting, art_direction, composition, transition, sound_cue, edit_beat, negative_constraints, micro_cuts를 포함합니다.
- ` + microCutRule + ` title, action, camera, copy, overlay_slogan, slogan_motion, sound_cue, vfx_preset, vfx_cue, role, importance, selected_priority, field_coupling_score, creative_mass, field_coupling_reason, shot_diversity_reason, image_prompt, video_prompt를 포함합니다.
- 모든 문장은 한국어로 작성하고 이미지 픽셀 안 텍스트는 금지합니다.
- overlay_slogan은 나레이션이나 설명 자막이 아니라 최종 HyperFrames에서 0.8~1.6초만 치고 지나갈 8~18자 핵심 표어입니다. CTA 문구, 가격, 혜택 나열은 금지하고 장면 감정/반전/기억을 한 문장처럼 압축하세요.
- slogan_motion은 표어 모션 큐입니다. 예: spark snap, glass wipe, shock pulse, quiet glow.
- 광고 문구와 CTA는 narration/body/emphasis에 넣더라도 쇼츠 광고 화면에서는 긴 자막으로 쓰지 않고, 핵심 표어와 마지막 브랜드만 최종 HyperFrames 오버레이에서 합성합니다.
`)
	args := codexcli.ExecArgs(cliPath, "-m", "gpt-5.4-mini", "-c", "model_reasoning_effort=\"medium\"", "-")
	cmd := exec.Command(cliPath, args...)
	cmd.Dir = s.config.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(prompt)
	var stdout strings.Builder
	var stderr strings.Builder
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, "", err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, "", err
	}
	readPipe := func(reader io.Reader, target *strings.Builder) {
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 1024), 1024*1024)
		for scanner.Scan() {
			target.WriteString(scanner.Text())
			target.WriteByte('\n')
		}
	}
	if err := cmd.Start(); err != nil {
		return nil, "", err
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
			return nil, strings.TrimSpace(stdout.String()), fmt.Errorf("Codex CLI 콘티 생성 실패: %s", truncate(msg, 640))
		}
	case <-time.After(codexScenarioPlanTimeout(req)):
		_ = cmd.Process.Kill()
		return nil, strings.TrimSpace(stdout.String()), fmt.Errorf("Codex CLI 콘티 생성 시간이 초과되었습니다")
	}
	text := strings.TrimSpace(stdout.String())
	scenes, err := parseHyperframesScenarioScenes(text)
	if err != nil {
		return nil, text, fmt.Errorf("%s", scenarioPlanParseErrorDetail(err, text))
	}
	scenes = normalizeHyperframesScenarioScenes(scenes, req, sceneCount)
	if missingFields := scenarioScenesMissingSurfaceFields(scenes, sceneCount, req); len(missingFields) > 0 {
		return nil, text, fmt.Errorf("Codex CLI 콘티 필드가 부족합니다: %s", strings.Join(missingFields, "; "))
	}
	return scenes, text, nil
}

func codexScenarioPlanTimeout(req hyperframesScenarioPlanRequest) time.Duration {
	if isFastHyperframesScenarioPlan(req) {
		return 75 * time.Second
	}
	return 4 * time.Minute
}

func (s *Server) generateAtlasHyperframesBackgroundImage(req hyperframesBackgroundImageRequest, model string) (string, string, error) {
	apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("ATLASCLOUD_API_KEY"))
	}
	if apiKey == "" {
		return "", "", fmt.Errorf("Atlas Cloud API 키가 없습니다. 설정 > API > Atlas Cloud 키를 저장하세요")
	}
	prompt := buildHyperframesBackgroundImagePrompt(req)
	width, height := atlasImageSizeForAspect(req.Aspect)
	payload := map[string]any{
		"model":        firstNonEmpty(model, "baidu/ERNIE-Image-Turbo/text-to-image"),
		"prompt":       prompt,
		"aspect_ratio": normalizeAtlasImageAspect(req.Aspect),
		"width":        width,
		"height":       height,
	}
	applyAtlasImageModelOptions(payload, model, req.Aspect)
	if strings.Contains(strings.ToLower(model), "/edit") {
		referenceInputs := append([]string{}, req.ReferenceImages...)
		if strings.TrimSpace(req.CharacterReference) != "" {
			referenceInputs = append([]string{req.CharacterReference}, referenceInputs...)
		}
		images := s.prepareAtlasReferenceImages(apiKey, referenceInputs, 14)
		if len(images) == 0 {
			return "", "", fmt.Errorf("Atlas 이미지 편집 모델은 참고 이미지가 필요합니다. 이미지를 첨부하거나 텍스트 이미지 생성 옵션을 선택하세요")
		}
		payload["images"] = images
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.atlascloud.ai/api/v1/model/generateImage", bytes.NewReader(body))
	if err != nil {
		return "", "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("Atlas 이미지 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	predictionID, directOutput, err := parseAtlasImageGenerateResponse(raw)
	if err != nil {
		return "", "", err
	}
	outputURL := directOutput
	if outputURL == "" {
		outputURL, err = s.pollAtlasImagePrediction(apiKey, predictionID, atlasImagePollTimeout(model))
		if err != nil {
			return "", "", err
		}
	}
	localURL, err := s.cacheRemoteHyperframesImage(outputURL, req.SceneIndex, req.Aspect)
	if err == nil && localURL != "" {
		return localURL, "Atlas Cloud image generated with " + firstNonEmpty(model, "baidu/ERNIE-Image-Turbo/text-to-image"), nil
	}
	if err != nil && strings.Contains(err.Error(), "이미지 비율 오류") {
		return "", "", err
	}
	return outputURL, "Atlas Cloud image generated with " + firstNonEmpty(model, "baidu/ERNIE-Image-Turbo/text-to-image"), nil
}

func findRecentHyperframesImage(outputPath string, since time.Time) string {
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
	return picked
}

func (s *Server) generateAtlasHyperframesImageVideo(req hyperframesImageToVideoRequest) (string, string, float64, error) {
	apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("ATLASCLOUD_API_KEY"))
	}
	if apiKey == "" {
		return "", "", 0, fmt.Errorf("Atlas Cloud API 키가 없습니다. 설정 > API > Atlas Cloud 키를 저장하세요")
	}
	model := normalizeAtlasImageVideoModel(req.Model)
	imageURL, err := s.ensureAtlasPublicMediaURL(apiKey, req.ImageURL)
	if err != nil {
		return "", "", 0, err
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 5
	}
	if duration > 12 {
		duration = 12
	}
	duration = normalizeAtlasImageVideoDuration(model, duration)
	prompt := compactAtlasImageVideoPrompt(buildHyperframesImageVideoPrompt(req))
	payload := map[string]any{
		"model":    model,
		"prompt":   prompt,
		"image":    imageURL,
		"duration": int(math.Round(duration)),
	}
	if isAtlasWanTurboSpicyImageVideo(model) {
		payload["duration"] = atlasWanTurboSpicyDuration(duration)
		payload["resolution"] = "480p"
		payload["seed"] = -1
	} else {
		payload["aspect_ratio"] = normalizeAtlasVideoAspect(req.Aspect)
		payload["resolution"] = "720p"
		payload["enable_audio"] = true
		payload["generate_audio"] = true
		payload["with_audio"] = true
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", 0, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.atlascloud.ai/api/v1/model/generateVideo", bytes.NewReader(body))
	if err != nil {
		return "", "", 0, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", "", 0, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", 0, fmt.Errorf("Atlas 영상 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	predictionID, directOutput, err := parseAtlasImageGenerateResponse(raw)
	if err != nil {
		return "", "", 0, err
	}
	outputURL := directOutput
	if outputURL == "" {
		outputURL, err = s.pollAtlasVideoPrediction(apiKey, predictionID, 10*time.Minute)
		if err != nil {
			return "", "", 0, err
		}
	}
	localURL, actualDuration, err := s.cacheRemoteHyperframesVideo(outputURL, sanitizeFilenamePart(req.SceneName))
	if err == nil && localURL != "" {
		if actualDuration <= 0 {
			actualDuration = duration
		}
		return localURL, "Atlas Cloud image-to-video generated with " + model, actualDuration, nil
	}
	return outputURL, "Atlas Cloud image-to-video generated with " + model, duration, nil
}

const atlasDefaultKlingImageVideoModel = "kwaivgi/kling-v3.0-pro/image-to-video"
const atlasImageVideoPromptMaxBytes = 2400

func normalizeAtlasImageVideoModel(model string) string {
	value := strings.TrimSpace(model)
	lower := strings.ToLower(value)
	if value == "" || strings.Contains(lower, "seedance-2.0") || strings.Contains(lower, "dreamina-seedance") {
		return atlasDefaultKlingImageVideoModel
	}
	return value
}

func compactAtlasImageVideoPrompt(prompt string) string {
	text := strings.Join(strings.Fields(strings.TrimSpace(prompt)), " ")
	if text == "" {
		text = "Keep the input image composition, subject, color, and identity. Add only subtle commercial camera motion. Do not add text, subtitles, watermark, new people, new objects, or scene changes."
	}
	return trimUTF8Bytes(text, atlasImageVideoPromptMaxBytes)
}

func trimUTF8Bytes(value string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	text := strings.TrimSpace(value)
	if len([]byte(text)) <= maxBytes {
		return text
	}
	var builder strings.Builder
	for _, r := range text {
		part := string(r)
		if builder.Len()+len([]byte(part)) > maxBytes {
			break
		}
		builder.WriteString(part)
	}
	return strings.TrimSpace(builder.String())
}

func isAtlasWanTurboSpicyImageVideo(model string) bool {
	lower := strings.ToLower(strings.TrimSpace(model))
	return strings.Contains(lower, "wan-2.2-turbo-spicy") && strings.Contains(lower, "image-to-video")
}

func isAtlasSeedanceImageVideo(model string) bool {
	lower := strings.ToLower(strings.TrimSpace(model))
	return strings.Contains(lower, "seedance-2.0") && strings.Contains(lower, "image-to-video")
}

func isAtlasSeedanceFastImageVideo(model string) bool {
	lower := strings.ToLower(strings.TrimSpace(model))
	return strings.Contains(lower, "seedance-2.0-fast") && strings.Contains(lower, "image-to-video")
}

func resolveNpxPath(projectRoot string) string {
	// npx를 우선 사용 (Node.js 의존성 호환이 더 안정적)
	if p, err := exec.LookPath("npx"); err == nil {
		return p
	}

	// npx 없으면 번들된 bunx 사용
	suffix := ""
	if runtime.GOOS == "windows" {
		suffix = ".exe"
	}
	bunName := "bunx" + suffix
	var platform string
	switch runtime.GOOS {
	case "darwin":
		if runtime.GOARCH == "arm64" {
			platform = "darwin-arm64"
		} else {
			platform = "darwin-x64"
		}
	case "windows":
		platform = "win32-x64"
	default:
		platform = "linux-x64"
	}
	for _, base := range []string{projectRoot, filepath.Dir(projectRoot)} {
		c := filepath.Join(base, "vendor", "bun", platform, bunName)
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	if p, err := exec.LookPath("bunx"); err == nil {
		return p
	}

	home, _ := os.UserHomeDir()
	nvmPaths := []string{
		filepath.Join(home, ".nvm", "versions", "node"),
		filepath.Join(home, ".bun", "bin"),
	}
	for _, base := range nvmPaths {
		if entries, err := os.ReadDir(base); err == nil {
			for i := len(entries) - 1; i >= 0; i-- {
				npxCandidate := filepath.Join(base, entries[i].Name(), "bin", "npx")
				if _, err := os.Stat(npxCandidate); err == nil {
					return npxCandidate
				}
			}
		}
	}
	bunCandidate := filepath.Join(home, ".bun", "bin", bunName)
	if _, err := os.Stat(bunCandidate); err == nil {
		return bunCandidate
	}

	return ""
}

func hyperframesImageVideoHasPeopleRisk(req hyperframesImageToVideoRequest) bool {
	seed := strings.Join(compactTextItems([]string{
		req.Prompt,
		req.SceneName,
		req.CharacterReference,
		req.CharacterPrompt,
		req.CharacterLabel,
		req.LipSyncText,
	}, 6, 1200), " ")
	if regexp.MustCompile(`(?i)사람\s*(없이|빼|제외|금지|넣지)|인물\s*(없이|빼|제외|금지|넣지)|얼굴\s*(없이|빼|제외|금지|넣지)|손\s*(없이|빼|제외|금지|넣지)|no\s*(people|person|face|hand)|without\s*(people|person|face|hand)`).MatchString(seed) {
		return false
	}
	if req.LipSyncEnabled || strings.TrimSpace(req.CharacterReference) != "" || strings.TrimSpace(req.CharacterPrompt) != "" || strings.TrimSpace(req.CharacterLabel) != "" {
		return true
	}
	return regexp.MustCompile(`(?i)사람|인물|얼굴|손|모델|진행자|강사|대표|인터뷰|말하는|입모양|립싱크|미소|표정|시선|헤어|의상|presenter|person|people|face|hand|model|lip.?sync|talk`).MatchString(seed)
}

func atlasWanTurboSpicyDuration(seconds float64) int {
	if seconds > 5 {
		return 8
	}
	return 5
}

func normalizeAtlasImageVideoDuration(model string, seconds float64) float64 {
	if isAtlasWanTurboSpicyImageVideo(model) {
		return float64(atlasWanTurboSpicyDuration(seconds))
	}
	if isAtlasSeedanceImageVideo(model) {
		switch {
		case seconds <= 0:
			return 5
		case seconds <= 7.5:
			return 5
		case seconds <= 12.5:
			return 10
		default:
			return 15
		}
	}
	if seconds < 1 {
		return 1
	}
	return seconds
}

func applyAtlasImageModelOptions(payload map[string]any, model, aspect string) {
	if payload == nil {
		return
	}
	lower := strings.ToLower(strings.TrimSpace(model))
	if strings.Contains(lower, "gpt-image-2") {
		payload["size"] = atlasOpenAIImageSizeForAspect(aspect)
		payload["n"] = 1
		payload["quality"] = "high"
		payload["output_format"] = "png"
		payload["background"] = "auto"
		return
	}
	if strings.Contains(lower, "qwen") || strings.Contains(lower, "ernie") || strings.Contains(lower, "baidu") || strings.Contains(lower, "alibaba") {
		payload["num_images"] = 1
	}
}

func atlasOpenAIImageSizeForAspect(aspect string) string {
	switch normalizeAtlasImageAspect(aspect) {
	case "16:9", "4:3":
		return "1536x1024"
	case "9:16", "3:4":
		return "1024x1536"
	default:
		return "1024x1024"
	}
}

func atlasImagePollTimeout(model string) time.Duration {
	lower := strings.ToLower(strings.TrimSpace(model))
	if strings.Contains(lower, "gpt-image-2") {
		return 6 * time.Minute
	}
	if strings.Contains(lower, "qwen") || strings.Contains(lower, "alibaba") {
		return 4 * time.Minute
	}
	return 3 * time.Minute
}

func parseAtlasImageGenerateResponse(raw []byte) (string, string, error) {
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", "", err
	}
	data, _ := parsed["data"].(map[string]any)
	id := firstAtlasPredictionID(parsed)
	if id == "" {
		id = firstAtlasPredictionID(data)
	}
	output := firstAtlasOutput(parsed)
	if output == "" && data != nil {
		output = firstAtlasOutput(data)
	}
	if id == "" && output == "" {
		return "", "", fmt.Errorf("Atlas 이미지 응답에서 prediction id를 찾지 못했습니다: %s", truncate(strings.TrimSpace(string(raw)), 500))
	}
	return id, output, nil
}

func (s *Server) pollAtlasImagePrediction(apiKey, predictionID string, timeout time.Duration) (string, error) {
	if strings.TrimSpace(predictionID) == "" {
		return "", fmt.Errorf("Atlas prediction id가 비어 있습니다")
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.atlascloud.ai/api/v1/model/prediction/"+url.PathEscape(predictionID), nil)
		if err != nil {
			cancel()
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			cancel()
			return "", err
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		_ = resp.Body.Close()
		cancel()
		var parsed map[string]any
		_ = json.Unmarshal(raw, &parsed)
		data, _ := parsed["data"].(map[string]any)
		status := strings.ToLower(firstNonEmpty(cleanAtlasString(parsed["status"]), cleanAtlasString(valueFromMap(data, "status"))))
		if status == "failed" || status == "error" || status == "canceled" || status == "cancelled" {
			return "", fmt.Errorf("Atlas 이미지 생성 실패: %s", firstNonEmpty(cleanAtlasString(parsed["error"]), cleanAtlasString(valueFromMap(data, "error")), cleanAtlasString(parsed["message"]), "unknown error"))
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("Atlas prediction API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
		}
		if parsed == nil {
			if err := json.Unmarshal(raw, &parsed); err != nil {
				return "", err
			}
			data, _ = parsed["data"].(map[string]any)
			status = strings.ToLower(firstNonEmpty(cleanAtlasString(parsed["status"]), cleanAtlasString(valueFromMap(data, "status"))))
		}
		if parsed == nil {
			return "", fmt.Errorf("Atlas prediction 응답을 해석하지 못했습니다")
		}
		if status == "completed" || status == "succeeded" {
			output := firstAtlasOutput(parsed)
			if output == "" && data != nil {
				output = firstAtlasOutput(data)
			}
			if output == "" {
				return "", fmt.Errorf("Atlas 이미지 생성은 완료됐지만 output URL이 없습니다")
			}
			return output, nil
		}
		if status == "failed" {
			return "", fmt.Errorf("Atlas 이미지 생성 실패: %s", firstNonEmpty(cleanAtlasString(parsed["error"]), cleanAtlasString(valueFromMap(data, "error")), "unknown error"))
		}
		time.Sleep(2 * time.Second)
	}
	return "", fmt.Errorf("Atlas 이미지 생성 시간이 초과되었습니다")
}

func (s *Server) pollAtlasVideoPrediction(apiKey, predictionID string, timeout time.Duration) (string, error) {
	if strings.TrimSpace(predictionID) == "" {
		return "", fmt.Errorf("Atlas prediction id가 비어 있습니다")
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		status, output, retry, err := s.fetchAtlasVideoPredictionStatus(apiKey, predictionID)
		if err != nil {
			return "", err
		}
		if output != "" {
			return output, nil
		}
		if !retry {
			return "", fmt.Errorf("Atlas 영상 생성 상태를 해석하지 못했습니다: %s", firstNonEmpty(status, "unknown"))
		}
		time.Sleep(3 * time.Second)
	}
	return "", fmt.Errorf("Atlas 영상 생성 시간이 초과되었습니다")
}

func (s *Server) fetchAtlasVideoPredictionStatus(apiKey, predictionID string) (string, string, bool, error) {
	escapedID := url.PathEscape(predictionID)
	endpoints := []string{
		"https://api.atlascloud.ai/api/v1/model/prediction/" + escapedID,
		"https://api.atlascloud.ai/api/v1/model/result/" + escapedID,
	}
	var lastErr error
	for _, endpoint := range endpoints {
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			cancel()
			return "", "", false, err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			cancel()
			return "", "", false, err
		}
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
		_ = resp.Body.Close()
		cancel()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("Atlas prediction API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
			continue
		}
		var parsed map[string]any
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", "", false, err
		}
		if parsed == nil {
			return "", "", false, fmt.Errorf("Atlas prediction 응답을 해석하지 못했습니다")
		}
		data, _ := parsed["data"].(map[string]any)
		status := strings.ToLower(firstNonEmpty(cleanAtlasString(parsed["status"]), cleanAtlasString(valueFromMap(data, "status"))))
		if status == "failed" || status == "error" || status == "canceled" || status == "cancelled" {
			return status, "", false, fmt.Errorf("Atlas 영상 생성 실패: %s", firstNonEmpty(cleanAtlasString(parsed["error"]), cleanAtlasString(valueFromMap(data, "error")), cleanAtlasString(parsed["message"]), "unknown error"))
		}
		if status == "completed" || status == "complete" || status == "succeeded" || status == "success" {
			output := firstAtlasOutput(parsed)
			if output == "" && data != nil {
				output = firstAtlasOutput(data)
			}
			if output == "" {
				return status, "", false, fmt.Errorf("Atlas 영상 생성은 완료됐지만 output URL이 없습니다")
			}
			return status, output, false, nil
		}
		return status, "", true, nil
	}
	if lastErr != nil {
		return "", "", false, lastErr
	}
	return "", "", true, nil
}

func (s *Server) ensureAtlasPublicMediaURL(apiKey, rawValue string) (string, error) {
	value := strings.TrimSpace(rawValue)
	if value == "" {
		return "", fmt.Errorf("이미지 URL이 비어 있습니다")
	}
	lower := strings.ToLower(value)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return value, nil
	}
	localPath := ""
	if strings.HasPrefix(value, "/api/hyperframes/output/") {
		filename := filepath.Base(strings.TrimPrefix(value, "/api/hyperframes/output/"))
		localPath = filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs", filename)
	}
	if localPath == "" && strings.HasPrefix(lower, "data:image/") {
		path, err := writeDataURLTempFile(value)
		if err != nil {
			return "", err
		}
		defer os.Remove(path)
		localPath = path
	}
	if localPath == "" {
		return "", fmt.Errorf("Atlas image-to-video에는 공개 URL 또는 앱이 저장한 이미지가 필요합니다")
	}
	return uploadAtlasMedia(apiKey, localPath)
}

func uploadAtlasMedia(apiKey, localPath string) (string, error) {
	file, err := os.Open(localPath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filepath.Base(localPath))
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, file); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.atlascloud.ai/api/v1/model/uploadMedia", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Atlas 업로드 API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	data, _ := parsed["data"].(map[string]any)
	out := firstNonEmpty(
		cleanAtlasString(valueFromMap(data, "download_url")),
		cleanAtlasString(valueFromMap(data, "url")),
		cleanAtlasString(parsed["download_url"]),
		cleanAtlasString(parsed["url"]),
	)
	if out == "" {
		return "", fmt.Errorf("Atlas 업로드 응답에서 URL을 찾지 못했습니다: %s", truncate(strings.TrimSpace(string(raw)), 500))
	}
	return out, nil
}

func (s *Server) cacheRemoteHyperframesImage(rawURL string, sceneIndex int, expectedAspect string) (string, error) {
	if strings.TrimSpace(rawURL) == "" {
		return "", fmt.Errorf("image URL is empty")
	}
	rawURL = strings.TrimSpace(rawURL)
	raw := []byte(nil)
	contentType := ""
	if strings.HasPrefix(strings.ToLower(rawURL), "data:image/") {
		decoded, mimeType, err := decodeImageDataURL(rawURL)
		if err != nil {
			return "", err
		}
		raw = decoded
		contentType = mimeType
	} else {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			return "", err
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("image download failed: %d", resp.StatusCode)
		}
		raw, err = io.ReadAll(io.LimitReader(resp.Body, 32<<20))
		if err != nil {
			return "", err
		}
		contentType = resp.Header.Get("Content-Type")
	}
	if len(raw) == 0 {
		return "", fmt.Errorf("downloaded image is empty")
	}
	if err := validateGeneratedImageAspect(raw, expectedAspect); err != nil {
		normalized, normErr := cropImageToAspect(raw, expectedAspect)
		if normErr != nil {
			return "", err
		}
		raw = normalized
		if err := validateGeneratedImageAspect(raw, expectedAspect); err != nil {
			return "", err
		}
	}
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", err
	}
	if sceneIndex <= 0 {
		sceneIndex = 1
	}
	ext := imageExtensionFromMime(contentType)
	if ext == ".png" {
		if parsed, err := url.Parse(rawURL); err == nil {
			pathExt := strings.ToLower(filepath.Ext(parsed.Path))
			if pathExt == ".jpg" || pathExt == ".jpeg" || pathExt == ".webp" || pathExt == ".png" {
				ext = pathExt
			}
		}
	}
	name := fmt.Sprintf("scene-bg-%02d-atlas-%d%s", sceneIndex, time.Now().UnixNano(), ext)
	if err := os.WriteFile(filepath.Join(outputDir, name), raw, 0o644); err != nil {
		return "", err
	}
	return "/api/hyperframes/output/" + url.PathEscape(name), nil
}

func validateGeneratedImageAspect(raw []byte, expectedAspect string) error {
	aspect := normalizeAtlasImageAspect(expectedAspect)
	if aspect == "" {
		return nil
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return nil
	}
	isPortrait := cfg.Height > cfg.Width
	isLandscape := cfg.Width > cfg.Height
	ratio := float64(cfg.Width) / math.Max(1, float64(cfg.Height))
	switch aspect {
	case "9:16", "3:4":
		if !isPortrait {
			return fmt.Errorf("이미지 비율 오류: 요청은 %s 세로형인데 생성 결과는 %dx%d 가로/정사각입니다. 회전되거나 가로세로가 뒤집힌 이미지는 사용할 수 없습니다", aspect, cfg.Width, cfg.Height)
		}
	case "16:9", "4:3":
		if !isLandscape {
			return fmt.Errorf("이미지 비율 오류: 요청은 %s 가로형인데 생성 결과는 %dx%d 세로/정사각입니다. 회전되거나 가로세로가 뒤집힌 이미지는 사용할 수 없습니다", aspect, cfg.Width, cfg.Height)
		}
	}
	targetRatio := targetRatioForAspect(aspect)
	if targetRatio > 0 && math.Abs(ratio-targetRatio)/targetRatio > 0.06 {
		return fmt.Errorf("이미지 비율 오류: 요청은 %s인데 생성 결과는 %dx%d입니다", aspect, cfg.Width, cfg.Height)
	}
	return nil
}

func cropImageToAspect(raw []byte, expectedAspect string) ([]byte, error) {
	aspect := normalizeAtlasImageAspect(expectedAspect)
	targetRatio := targetRatioForAspect(aspect)
	if targetRatio <= 0 {
		return raw, nil
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return nil, fmt.Errorf("invalid image bounds")
	}
	currentRatio := float64(width) / float64(height)
	crop := bounds
	if currentRatio > targetRatio {
		newWidth := int(math.Round(float64(height) * targetRatio))
		if newWidth <= 0 || newWidth > width {
			return nil, fmt.Errorf("invalid crop width")
		}
		left := bounds.Min.X + (width-newWidth)/2
		crop = image.Rect(left, bounds.Min.Y, left+newWidth, bounds.Max.Y)
	} else if currentRatio < targetRatio {
		newHeight := int(math.Round(float64(width) / targetRatio))
		if newHeight <= 0 || newHeight > height {
			return nil, fmt.Errorf("invalid crop height")
		}
		top := bounds.Min.Y + (height-newHeight)/2
		crop = image.Rect(bounds.Min.X, top, bounds.Max.X, top+newHeight)
	}
	if crop.Dx() == width && crop.Dy() == height {
		return raw, nil
	}
	canvas := image.NewRGBA(image.Rect(0, 0, crop.Dx(), crop.Dy()))
	draw.Draw(canvas, canvas.Bounds(), img, crop.Min, draw.Src)
	var out bytes.Buffer
	if err := png.Encode(&out, canvas); err != nil {
		if jpegErr := jpeg.Encode(&out, canvas, &jpeg.Options{Quality: 94}); jpegErr != nil {
			return nil, err
		}
	}
	return out.Bytes(), nil
}

func targetRatioForAspect(aspect string) float64 {
	switch normalizeAtlasImageAspect(aspect) {
	case "16:9":
		return 16.0 / 9.0
	case "9:16":
		return 9.0 / 16.0
	case "4:3":
		return 4.0 / 3.0
	case "3:4":
		return 3.0 / 4.0
	case "1:1":
		return 1
	default:
		return 0
	}
}

func (s *Server) cacheRemoteHyperframesVideo(rawURL string, stem string) (string, float64, error) {
	if strings.TrimSpace(rawURL) == "" {
		return "", 0, fmt.Errorf("video URL is empty")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", 0, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", 0, fmt.Errorf("video download failed: %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 256<<20))
	if err != nil {
		return "", 0, err
	}
	if len(raw) == 0 {
		return "", 0, fmt.Errorf("downloaded video is empty")
	}
	outputDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs")
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return "", 0, err
	}
	ext := ".mp4"
	if parsed, err := url.Parse(rawURL); err == nil {
		pathExt := strings.ToLower(filepath.Ext(parsed.Path))
		if pathExt == ".mp4" || pathExt == ".mov" || pathExt == ".webm" {
			ext = pathExt
		}
	}
	name := fmt.Sprintf("%s-%d%s", firstNonEmpty(stem, "image-video"), time.Now().UnixNano(), ext)
	if err := os.WriteFile(filepath.Join(outputDir, name), raw, 0o644); err != nil {
		return "", 0, err
	}
	outputPath := filepath.Join(outputDir, name)
	return "/api/hyperframes/output/" + url.PathEscape(name), estimateMediaFileDuration(outputPath), nil
}

func atlasImageSizeForAspect(aspect string) (int, int) {
	switch strings.TrimSpace(aspect) {
	case "16:9":
		return 1024, 576
	case "1:1":
		return 768, 768
	case "4:3":
		return 1024, 768
	case "3:4":
		return 768, 1024
	default:
		return 576, 1024
	}
}

func codexImageCanvasRule(aspect string) string {
	width, height := atlasImageSizeForAspect(aspect)
	return fmt.Sprintf("%dx%d px", width, height)
}

func normalizeAtlasImageAspect(aspect string) string {
	switch strings.TrimSpace(aspect) {
	case "16:9", "9:16", "1:1", "4:3", "3:4":
		return strings.TrimSpace(aspect)
	default:
		return "9:16"
	}
}

func normalizeAtlasVideoAspect(aspect string) string {
	switch strings.TrimSpace(aspect) {
	case "16:9", "9:16", "1:1":
		return strings.TrimSpace(aspect)
	default:
		return "9:16"
	}
}

func cleanAtlasReferenceImages(images []string, limit int) []string {
	if limit <= 0 {
		limit = 14
	}
	capacity := len(images)
	if capacity > limit {
		capacity = limit
	}
	cleaned := make([]string, 0, capacity)
	for _, image := range images {
		text := strings.TrimSpace(image)
		if text == "" {
			continue
		}
		if !strings.HasPrefix(strings.ToLower(text), "data:image/") && !strings.HasPrefix(strings.ToLower(text), "http://") && !strings.HasPrefix(strings.ToLower(text), "https://") {
			continue
		}
		cleaned = append(cleaned, text)
		if len(cleaned) >= limit {
			break
		}
	}
	return cleaned
}

func (s *Server) prepareAtlasReferenceImages(apiKey string, images []string, limit int) []string {
	if limit <= 0 {
		limit = 14
	}
	prepared := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, raw := range images {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		lower := strings.ToLower(value)
		if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
			if !seen[value] {
				seen[value] = true
				prepared = append(prepared, value)
			}
		} else if strings.HasPrefix(lower, "data:image/") || strings.HasPrefix(value, "/api/hyperframes/output/") {
			if publicURL, err := s.ensureAtlasPublicMediaURL(apiKey, value); err == nil && strings.TrimSpace(publicURL) != "" && !seen[publicURL] {
				seen[publicURL] = true
				prepared = append(prepared, publicURL)
			}
		}
		if len(prepared) >= limit {
			break
		}
	}
	return prepared
}

func (s *Server) geminiReferenceImageParts(images []string, limit int) []map[string]any {
	if limit <= 0 {
		limit = 4
	}
	parts := make([]map[string]any, 0, limit)
	seen := map[string]bool{}
	for _, raw := range images {
		value := strings.TrimSpace(raw)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		imageBytes, mimeType, err := s.loadGeminiReferenceImage(value)
		if err != nil || len(imageBytes) == 0 || !strings.HasPrefix(strings.ToLower(mimeType), "image/") {
			continue
		}
		parts = append(parts, map[string]any{
			"inlineData": map[string]any{
				"mimeType": mimeType,
				"data":     base64.StdEncoding.EncodeToString(imageBytes),
			},
		})
		if len(parts) >= limit {
			break
		}
	}
	return parts
}

func (s *Server) loadGeminiReferenceImage(value string) ([]byte, string, error) {
	lower := strings.ToLower(strings.TrimSpace(value))
	if strings.HasPrefix(lower, "data:image/") {
		return decodeImageDataURL(value)
	}
	if localPath, ok := s.localPathForHyperframesImageAsset(value); ok {
		raw, err := os.ReadFile(localPath)
		if err != nil {
			return nil, "", err
		}
		return raw, detectImageMime(raw, localPath), nil
	}
	if strings.HasPrefix(value, "/api/hyperframes/output/") {
		filename := filepath.Base(strings.TrimPrefix(value, "/api/hyperframes/output/"))
		raw, err := os.ReadFile(filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs", filename))
		if err != nil {
			return nil, "", err
		}
		return raw, detectImageMime(raw, filename), nil
	}
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, value, nil)
		if err != nil {
			return nil, "", err
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, "", fmt.Errorf("reference image download failed: %d", resp.StatusCode)
		}
		raw, err := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
		if err != nil {
			return nil, "", err
		}
		mimeType := resp.Header.Get("Content-Type")
		if !strings.HasPrefix(strings.ToLower(mimeType), "image/") {
			mimeType = detectImageMime(raw, "")
		}
		return raw, mimeType, nil
	}
	return nil, "", fmt.Errorf("unsupported reference image")
}

func decodeImageDataURL(value string) ([]byte, string, error) {
	header, payload, ok := strings.Cut(value, ",")
	if !ok || strings.TrimSpace(payload) == "" {
		return nil, "", fmt.Errorf("data URL 형식이 올바르지 않습니다")
	}
	mimeType := "image/png"
	if strings.HasPrefix(strings.ToLower(header), "data:") {
		mimeType = strings.TrimPrefix(strings.Split(strings.TrimPrefix(header, "data:"), ";")[0], "data:")
	}
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", err
	}
	return raw, mimeType, nil
}

func detectImageMime(raw []byte, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".png":
		return "image/png"
	}
	detected := http.DetectContentType(raw)
	if strings.HasPrefix(strings.ToLower(detected), "image/") {
		return detected
	}
	return "image/png"
}

func writeDataURLTempFile(value string) (string, error) {
	raw, mimeType, err := decodeImageDataURL(value)
	if err != nil {
		return "", err
	}
	ext := imageExtensionFromMime(mimeType)
	tmp, err := os.CreateTemp("", "makeke-atlas-image-*"+ext)
	if err != nil {
		return "", err
	}
	defer tmp.Close()
	if _, err := tmp.Write(raw); err != nil {
		_ = os.Remove(tmp.Name())
		return "", err
	}
	return tmp.Name(), nil
}

func sanitizeFilenamePart(value string) string {
	text := strings.ToLower(strings.TrimSpace(value))
	text = regexp.MustCompile(`[^a-z0-9가-힣_-]+`).ReplaceAllString(text, "-")
	text = strings.Trim(text, "-")
	if text == "" {
		return "image-video"
	}
	if len([]rune(text)) > 40 {
		return string([]rune(text)[:40])
	}
	return text
}

func uniqueNonEmptyStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		text := strings.TrimSpace(value)
		if text == "" || seen[text] {
			continue
		}
		seen[text] = true
		out = append(out, text)
	}
	return out
}

func normalizeHyperframesGeminiTextModel(value string, fallback string) string {
	model := strings.TrimSpace(value)
	if model == "" {
		return strings.TrimSpace(fallback)
	}
	lower := strings.ToLower(model)
	if strings.Contains(lower, "hyperframes") ||
		strings.Contains(lower, "image-motion") ||
		strings.Contains(lower, "image-to-video") ||
		strings.Contains(lower, "/") ||
		strings.Contains(lower, "veo") ||
		strings.Contains(lower, "imagen") ||
		strings.Contains(lower, "image-preview") ||
		strings.Contains(lower, "tts") ||
		strings.HasPrefix(lower, "atlas:") {
		return strings.TrimSpace(fallback)
	}
	return model
}

type hyperframesWritingPromptTarget struct {
	Provider string
	Model    string
	APIKey   string
}

func (s *Server) resolveHyperframesWritingPromptTargets(requested string) ([]hyperframesWritingPromptTarget, error) {
	provider := normalizeHyperframesWritingProvider(s.getSetting("MODELS.text_provider", ""))
	model := strings.TrimSpace(firstNonEmpty(s.getSetting("MODELS.text_model", ""), requested))
	if provider == "" {
		provider = normalizeHyperframesWritingProvider(model)
	}
	if provider == "" {
		provider = "gemini"
	}
	if provider == "atlas" {
		key := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		if key == "" {
			key = strings.TrimSpace(os.Getenv("ATLAS_API_KEY"))
		}
		if key == "" {
			return nil, fmt.Errorf("설정 글쓰기 모델이 Atlas Cloud(%s)인데 Atlas API 키가 없습니다.", fallbackHTTPText(model, "모델 미설정"))
		}
		targets := []hyperframesWritingPromptTarget{{
			Provider: "atlas",
			Model:    firstNonEmpty(model, "openai/gpt-5.5"),
			APIKey:   key,
		}}
		targets = append(targets, s.hyperframesGeminiWritingTargets(requested)...)
		return targets, nil
	}
	if provider == "cli" {
		targets := []hyperframesWritingPromptTarget{{
			Provider: "codex",
			Model:    firstNonEmpty(model, "codex-cli"),
		}}
		targets = append(targets, s.hyperframesGeminiWritingTargets(requested)...)
		return targets, nil
	}
	targets := s.hyperframesGeminiWritingTargets(firstNonEmpty(model, requested))
	if len(targets) == 0 {
		return nil, fmt.Errorf("설정 글쓰기 모델이 Gemini(%s)인데 Gemini API 키가 없습니다.", fallbackHTTPText(model, "모델 미설정"))
	}
	return targets, nil
}

func (s *Server) hyperframesGeminiWritingTargets(requested string) []hyperframesWritingPromptTarget {
	key := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if key == "" {
		key = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if key == "" {
		key = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if key == "" {
		return nil
	}
	primary := normalizeHyperframesGeminiTextModel(firstNonEmpty(requested, s.getSetting("MODELS.gemini_model", s.getSetting("API.gemini_model", ""))), "")
	models := s.geminiGenerateContentCandidates(key, []string{primary, s.getSetting("MODELS.fast_text_model", "")}, true)
	targets := make([]hyperframesWritingPromptTarget, 0, len(models))
	for _, item := range models {
		targets = append(targets, hyperframesWritingPromptTarget{Provider: "gemini", Model: item, APIKey: key})
	}
	return targets
}

func normalizeHyperframesWritingProvider(value string) string {
	raw := strings.ToLower(strings.TrimSpace(value))
	switch {
	case raw == "":
		return ""
	case raw == "atlas" || raw == "atlascloud" || raw == "atlas-cloud" || strings.Contains(raw, "atlas"):
		return "atlas"
	case strings.Contains(raw, "/") || strings.HasPrefix(raw, "openai/") || strings.HasPrefix(raw, "anthropic/") || strings.HasPrefix(raw, "deepseek") || strings.HasPrefix(raw, "moonshot") || strings.HasPrefix(raw, "qwen/"):
		return "atlas"
	case raw == "gemini" || raw == "google" || strings.Contains(raw, "gemini"):
		return "gemini"
	case raw == "cli" || strings.Contains(raw, "codex") || strings.Contains(raw, "kimi-cli") || strings.HasSuffix(raw, "-cli"):
		return "cli"
	default:
		return ""
	}
}

func (s *Server) runHyperframesWritingDesignPrompt(prompt string, target hyperframesWritingPromptTarget, timeout time.Duration) (string, error) {
	if target.Provider == "atlas" {
		return s.runAtlasDesignPrompt(prompt, nil, target.APIKey, target.Model, timeout)
	}
	if target.Provider == "codex" {
		return s.runCodexWritingDesignPrompt(prompt, target.Model, timeout)
	}
	return s.runGeminiDesignPrompt(prompt, nil, target.APIKey, target.Model, timeout)
}

func (s *Server) runCodexWritingDesignPrompt(prompt string, model string, timeout time.Duration) (string, error) {
	cliPath, err := exec.LookPath("codex")
	if err != nil {
		return "", fmt.Errorf("Codex CLI를 찾지 못했습니다")
	}
	codexModel := strings.TrimSpace(s.getSetting("MODELS.codex_model", ""))
	if codexModel == "" && strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "gpt-") {
		codexModel = strings.TrimSpace(model)
	}
	codexModel = firstNonEmpty(codexModel, "gpt-5.4-mini")
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	args := codexcli.ExecArgs(cliPath, "-m", codexModel, "-c", "model_reasoning_effort=\"medium\"", "-")
	cmd := exec.CommandContext(ctx, cliPath, args...)
	cmd.Dir = s.config.ProjectRoot
	cmd.Env = append(os.Environ(), "TERM=dumb", "NO_COLOR=1", "CI=1")
	cmd.Stdin = strings.NewReader(strings.TrimSpace(prompt) + "\n\nJSON만 출력하세요. 설명, 마크다운, 코드블록 금지.\n")
	var stdout strings.Builder
	var stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("Codex CLI 글쓰기 시간이 초과되었습니다")
		}
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = strings.TrimSpace(stdout.String())
		}
		return strings.TrimSpace(stdout.String()), fmt.Errorf("Codex CLI 글쓰기 실패: %s", truncate(msg, 640))
	}
	text := strings.TrimSpace(stdout.String())
	if text == "" {
		return "", fmt.Errorf("Codex CLI 응답 텍스트가 비어 있습니다")
	}
	return text, nil
}

func prependHyperframesWritingTarget(targets []hyperframesWritingPromptTarget, first hyperframesWritingPromptTarget) []hyperframesWritingPromptTarget {
	if first.Model == "" {
		return targets
	}
	out := []hyperframesWritingPromptTarget{first}
	for _, target := range targets {
		if strings.EqualFold(target.Provider, first.Provider) && strings.EqualFold(target.Model, first.Model) {
			continue
		}
		out = append(out, target)
	}
	return out
}

func isTransientGeminiMotionError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "timeout") ||
		strings.Contains(text, "deadline exceeded") ||
		strings.Contains(text, "context deadline") ||
		strings.Contains(text, "temporar") ||
		strings.Contains(text, "try again") ||
		strings.Contains(text, "overload") ||
		strings.Contains(text, "unavailable") ||
		strings.Contains(text, "bad gateway") ||
		strings.Contains(text, " is not found for api") ||
		(strings.Contains(text, "models/") && strings.Contains(text, "not found")) ||
		strings.Contains(text, " 429") ||
		strings.Contains(text, " 500") ||
		strings.Contains(text, " 502") ||
		strings.Contains(text, " 503") ||
		strings.Contains(text, " 504")
}

func firstAtlasOutput(parsed map[string]any) string {
	if parsed == nil {
		return ""
	}
	for _, key := range []string{
		"output", "outputs", "data", "result", "results", "images", "image",
		"url", "urls", "output_url", "download_url", "image_url", "video_url", "file_url",
		"b64_json", "base64", "data_url",
	} {
		if out := firstAtlasOutputValue(parsed[key]); out != "" {
			return out
		}
	}
	return ""
}

func firstAtlasOutputValue(value any) string {
	switch v := value.(type) {
	case string:
		text := strings.TrimSpace(v)
		if looksLikeAtlasMediaOutput(text) {
			return text
		}
		if strings.HasPrefix(text, "iVBOR") || strings.HasPrefix(text, "/9j/") {
			return "data:image/png;base64," + text
		}
	case []any:
		for _, item := range v {
			if out := firstAtlasOutputValue(item); out != "" {
				return out
			}
		}
	case map[string]any:
		if out := firstAtlasOutput(v); out != "" {
			return out
		}
	}
	return ""
}

func looksLikeAtlasMediaOutput(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	return strings.HasPrefix(lower, "http://") ||
		strings.HasPrefix(lower, "https://") ||
		strings.HasPrefix(lower, "data:image/") ||
		strings.HasPrefix(lower, "data:video/")
}

func firstAtlasPredictionID(parsed map[string]any) string {
	if parsed == nil {
		return ""
	}
	for _, key := range []string{"id", "prediction_id", "predictionId", "task_id", "taskId", "request_id", "requestId"} {
		if id := cleanAtlasString(parsed[key]); id != "" {
			return id
		}
	}
	for _, key := range []string{"data", "prediction", "task", "result"} {
		if nested, ok := parsed[key].(map[string]any); ok {
			if id := firstAtlasPredictionID(nested); id != "" {
				return id
			}
		}
	}
	return ""
}

func valueFromMap(parsed map[string]any, key string) any {
	if parsed == nil {
		return nil
	}
	return parsed[key]
}

func cleanAtlasString(value any) string {
	switch v := value.(type) {
	case string:
		text := strings.TrimSpace(v)
		if text == "" || text == "<nil>" {
			return ""
		}
		return text
	case json.Number:
		return strings.TrimSpace(v.String())
	}
	return ""
}

func buildHyperframesBackgroundImagePrompt(req hyperframesBackgroundImageRequest) string {
	aspect := normalizeAtlasImageAspect(req.Aspect)
	orientationRule := "정확한 화면 비율은 " + aspect + "입니다. 카메라/이미지가 90도 회전되거나, 피사체가 누워 보이거나, 세로/가로가 뒤집히면 실패입니다. 피사체와 배경은 upright orientation을 유지하세요."
	if aspect == "16:9" {
		orientationRule = "정확한 화면 비율은 16:9 가로형입니다. 세로 이미지, 회전된 이미지, 누운 인물/제품, 가로세로 뒤집힘은 실패입니다. 넓은 가로 프레임 안에 피사체를 upright orientation으로 배치하세요."
	} else if aspect == "9:16" {
		orientationRule = "정확한 화면 비율은 9:16 세로형입니다. 가로 이미지, 회전된 이미지, 누운 인물/제품, 가로세로 뒤집힘은 실패입니다. 세로 프레임 안에 피사체를 upright orientation으로 배치하세요."
	}
	parts := []string{
		"[절대 규칙] 글자 없는 이미지로 만드세요. 읽을 수 있는 텍스트가 하나라도 있으면 실패입니다.",
		"가짜 브랜드명, 가짜 로고, 가짜 앱 화면, 대시보드의 읽히는 UI 글자는 만들지 말고 텍스트 없는 추상 인터페이스와 빈 패널로만 표현하세요.",
		"이 씬의 메시지와 역할에 맞는 구도를 AI가 직접 설계하세요.",
		"모든 씬이 같은 구도(예: 중앙 인물 정면)이면 실패입니다. 씬 역할에 따라 와이드, 클로즈업, 오버숄더, 탑뷰, 제품 매크로, 공간 풀샷, 손 디테일 등 실제 광고 촬영처럼 다양한 카메라 앵글을 사용하세요.",
		orientationRule,
		"텍스트가 올라갈 여백을 남기세요.",
	}
	if len(req.ReferenceImages) > 0 || strings.TrimSpace(req.CharacterReference) != "" {
		parts = append(parts, "모델 일관성: 제공된 reference 이미지는 로고, 상품, 공간, 주인공, 색감의 정체성을 고정하는 기준입니다. 씬마다 다른 로고·다른 인물·다른 상품·다른 브랜드로 바꾸지 말고, 같은 reference 묶음을 유지하세요.")
	}
	if designRules := strings.TrimSpace(req.DesignRules); designRules != "" {
		parts = append(parts,
			"[프로필 CI/BI 디자인 규칙 최우선]\n"+
				"아래 규칙은 배경 컨셉, 자동 스타일, 모델 기본 스타일보다 우선합니다. 대표 색상, 타이포 인상, 레이아웃/여백, 이미지 톤, 금지 규칙을 이 씬 이미지에 반드시 반영하세요. 앱 기본 강조색이나 임의 템플릿 스타일로 덮어쓰지 마세요.\n"+
				truncate(designRules, 2600))
	}
	if clean := cleanImageGenerationPrompt(req.Prompt); clean != "" {
		parts = append(parts, "이미지 방향: "+clean)
	}
	if strings.TrimSpace(req.PersonMode) == "사람 없이 제품·공간·그래픽 중심" {
		parts = append(parts, "인물 정책: 사람 얼굴, 전신 모델, 손 모델, 배경 인물을 새로 만들지 말고 제품·공간·그래픽만으로 구성하세요.")
	}
	if characterBlock := buildCharacterConsistencyPrompt(req.CharacterLabel, req.CharacterPrompt, req.CharacterReference); characterBlock != "" {
		parts = append(parts, characterBlock)
	}
	contextLines := compactTextItems([]string{
		"주제: " + cleanImageGenerationPrompt(req.Topic),
		"목적: " + cleanImageGenerationPrompt(req.Objective),
		"톤: " + cleanImageGenerationPrompt(req.Tone),
		"씬 제목: " + cleanImageGenerationPrompt(req.SceneTitle),
		"씬 본문: " + cleanImageGenerationPrompt(req.SceneBody),
		"나레이션: " + cleanImageGenerationPrompt(req.Narration),
	}, 8, 220)
	if len(contextLines) > 0 {
		parts = append(parts, "맥락:\n- "+strings.Join(contextLines, "\n- "))
	}
	return strings.Join(parts, "\n")
}

func cleanImageGenerationPrompt(raw string) string {
	text := strings.TrimSpace(raw)
	if text == "" {
		return ""
	}
	replacements := []struct {
		pattern string
		with    string
	}{
		{`https?://\S+`, ` `},
		{`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`, ` `},
		{`(?i)\b[a-z0-9-]+\.(kr|com|net|org|co|io|ai|shop|store)\b`, ` `},
		{`(?i)\bMAKEKE\b`, `브랜드`},
		{`(?i)\bmakeke\b`, `브랜드`},
		{`마케케`, `브랜드`},
		{`(?i)\blogo\b`, `브랜드 상징`},
		{`로고`, `브랜드 상징`},
		{`(?i)\b(app\s*ui|ui\s*mockup|dashboard|interface|screen|tablet\s*screen|laptop\s*screen|phone\s*screen|smartphone\s*screen)\b`, `textless abstract interface blocks with blank panels and unreadable geometric lines`},
		{`앱\s*UI|대시보드|인터페이스|화면|모형|목업|태블릿\s*화면|노트북\s*화면|스마트폰\s*화면|휴대폰\s*화면`, `텍스트 없는 추상 인터페이스 블록과 빈 패널`},
		{`(?i)\btext on screen\b`, `textless negative space`},
		{`(?i)\bwith text\b`, `with no text`},
		{`상담\s*문의`, `행동 유도`},
		{`CTA`, `행동 유도`},
		{`문구`, `텍스트 없는 여백`},
		{`글자`, `텍스트 없는 여백`},
		{`중앙에\s*['"“”‘’]?[A-Za-z가-힣0-9 .·:_-]+['"“”‘’]?\s*(가|이)?\s*명확히\s*보`, `중앙 피사체가 명확히 보`},
	}
	for _, item := range replacements {
		text = regexp.MustCompile(item.pattern).ReplaceAllString(text, item.with)
	}
	text = regexp.MustCompile(`[“”"']([^“”"']{1,40})[“”"']`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`(?m)^\s*[-*]?\s*(브랜드명|CTA|URL|도메인|출처|링크)\s*[:：].*$`).ReplaceAllString(text, " ")
	text = strings.Join(strings.Fields(text), " ")
	if len([]rune(text)) > 900 {
		runes := []rune(text)
		text = string(runes[:900])
	}
	return strings.TrimSpace(text)
}

func buildHyperframesImageVideoPrompt(req hyperframesImageToVideoRequest) string {
	parts := []string{
		"이 이미지를 거의 그대로 유지하면서 아주 미세한 카메라 움직임만 추가하세요.",
		"이미지의 내용, 구도, 피사체, 색감을 절대 바꾸지 마세요. 새로운 물체, 사람, 장면, 글자를 추가하지 마세요.",
		"움직임은 아주 천천히, 최소한으로. 과한 변형이나 새로운 장면 전환은 금지입니다.",
	}
	if clean := strings.TrimSpace(req.Prompt); clean != "" {
		parts = append(parts, "영상 움직임 지시: "+clean)
	}
	if characterBlock := buildCharacterConsistencyPrompt(req.CharacterLabel, req.CharacterPrompt, req.CharacterReference); characterBlock != "" {
		parts = append(parts, characterBlock)
	}
	if req.LipSyncEnabled && strings.TrimSpace(req.LipSyncText) != "" {
		parts = append(parts, "Lip sync 지시: 화면에 주인공 얼굴이 말하는 컷이면 입모양, 턱 움직임, 표정 변화, 시선 호흡을 다음 나레이션 문장 길이에 맞추세요. 과장된 더빙 입모양이나 다른 사람 목소리처럼 보이는 표정은 금지합니다.\n나레이션: "+strings.TrimSpace(req.LipSyncText))
	}
	contextLines := compactTextItems([]string{
		"주제: " + req.Topic,
		"목적: " + req.Objective,
		"톤: " + req.Tone,
		"씬: " + req.SceneName,
	}, 8, 220)
	if len(contextLines) > 0 {
		parts = append(parts, "맥락:\n- "+strings.Join(contextLines, "\n- "))
	}
	return strings.Join(parts, "\n")
}

func buildCharacterConsistencyPrompt(label, prompt, reference string) string {
	lines := compactTextItems([]string{
		"모델 이름/라벨: " + strings.TrimSpace(label),
		"모델 세팅: " + strings.TrimSpace(prompt),
		"모델 기준 이미지: " + strings.TrimSpace(reference),
	}, 3, 520)
	if len(lines) == 0 {
		return ""
	}
	return "[주인공 캐릭터 고정]\n" +
		"이 캠페인은 사용자가 선택하거나 생성한 주인공 모델을 사용합니다. 사람이 등장하는 모든 씬은 아래 동일 인물의 성별, 얼굴형, 헤어, 연령대, 의상 계열, 에너지, 분위기를 유지하세요.\n" +
		"화면에 보이는 유일한 성인 모델, 얼굴, 손 모델은 이 주인공이어야 합니다. 다른 성별/다른 얼굴/무작위 남녀 모델/랜덤 손 모델/배경 인물로 대체하지 마세요. 고객/상담자/직원 역할도 같은 주인공 1명이 연기하거나 사람 없이 처리하세요.\n- " +
		strings.Join(lines, "\n- ")
}

func normalizeGeminiImageAspect(aspect string) string {
	switch strings.TrimSpace(aspect) {
	case "16:9", "9:16", "1:1", "4:3", "3:4":
		return strings.TrimSpace(aspect)
	default:
		return "9:16"
	}
}

func (s *Server) handleHyperframesGenerateBGM(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesBGMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	audioDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "audio")
	if err := os.MkdirAll(audioDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create audio dir"})
		return
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	if duration > 90 {
		duration = 90
	}
	req.Duration = duration
	stem := fmt.Sprintf("bgm-%d", time.Now().UnixNano())
	geminiResult, err := s.generateGeminiLyriaProBGM(req, audioDir, stem)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "gemini lyria 3 pro bgm failed", "detail": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, geminiResult)
}

func (s *Server) generateGeminiLyriaProBGM(req hyperframesBGMRequest, audioDir, stem string) (map[string]any, error) {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey == "" {
		return nil, fmt.Errorf("Gemini API 키가 없습니다")
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	model := strings.TrimSpace(req.Model)
	if model == "" || model == "gemini-auto" {
		model = "lyria-3-pro-preview"
	}
	prompt := buildGeminiLyriaPrompt(req, duration)
	payload := map[string]any{
		"contents": []map[string]any{{
			"parts": []map[string]any{{"text": prompt}},
		}},
		"generationConfig": map[string]any{
			"responseModalities": []string{"AUDIO", "TEXT"},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 90 * time.Second}).Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Gemini Lyria 3 Pro API 오류 %d: %s", resp.StatusCode, truncate(string(raw), 700))
	}
	audioData, mimeType, err := extractGeminiInlineAudio(raw)
	if err != nil || len(audioData) == 0 {
		return nil, fmt.Errorf("Gemini Lyria 3 Pro 응답에서 오디오를 찾지 못했습니다: %v / %s", err, truncate(string(raw), 700))
	}
	ext := audioExtensionFromMime(mimeType)
	outputPath := filepath.Join(audioDir, stem+ext)
	if err := os.WriteFile(outputPath, audioData, 0o644); err != nil {
		return nil, err
	}
	actualDuration := estimateMediaFileDuration(outputPath)
	if actualDuration <= 0 {
		actualDuration = duration
	}
	return map[string]any{
		"ok":                 true,
		"url":                "/api/hyperframes/audio/" + filepath.Base(outputPath),
		"path":               outputPath,
		"duration":           actualDuration,
		"target_duration":    duration,
		"requested_duration": req.Duration,
		"provider":           "gemini-lyria-3",
		"model":              model,
		"mime":               mimeType,
	}, nil
}

func buildGeminiLyriaPrompt(req hyperframesBGMRequest, duration float64) string {
	seconds := int(math.Round(duration))
	if seconds <= 0 {
		seconds = 30
	}
	topic := cleanBgmPromptText(req.Topic, 120)
	objective := cleanBgmPromptText(req.Objective, 100)
	tone := cleanBgmPromptText(req.Tone, 120)
	sceneArc := cleanBgmPromptText(strings.Join(compactTextItems(req.SceneTexts, 4, 220), " / "), 260)
	sourceHint := cleanBgmPromptText(req.Source, 180)
	retryNote := ""
	if req.Attempt > 1 {
		topic = "fresh, friendly Korean advertising video"
		objective = "support a short product or service ad"
		tone = "bright, optimistic, clean, lightly upbeat"
		sceneArc = "soft opening pulse, gentle lift at scene change, clean CTA ending"
		sourceHint = "use only generic ad energy; do not echo any source text"
		retryNote = "This is a retry after a copyright-similarity filter. Make it very generic, abstract, sparse, and clearly original: light percussion, soft plucks, airy pads, simple pulses, no hook, no lead melody, no hummable motif, no chord progression that feels like a known song. "
	}
	return strings.TrimSpace(fmt.Sprintf(
		"Create a %d-second fully original instrumental background music track for an advertising video. Let the music direction follow the ad brief and scene rhythm instead of using a fixed template. Ad topic: %s. Objective: %s. Tone: %s. Scene rhythm: %s. Context: %s. Unless the brief explicitly asks for a calm or serious mood, keep the default ad energy bright, optimistic, lightly upbeat, clean, and forward-moving. Avoid sad, gloomy, melancholic, dark, funeral, or heavy minor-key moods. The track should support Korean voiceover, feel polished and slightly energetic, include natural scene-change lift and a clean CTA ending. %sNo vocals, no lyrics, no spoken words, no sampled material, no artist references, no song references, no genre imitation, no recognizable melody.",
		seconds,
		firstNonEmpty(topic, "brand advertising video"),
		firstNonEmpty(objective, "viewer action"),
		firstNonEmpty(tone, "modern and confident"),
		firstNonEmpty(sceneArc, "hook, message, CTA"),
		firstNonEmpty(sourceHint, "none"),
		retryNote,
	))
}

func cleanBgmPromptText(value string, limit int) string {
	clean := strings.TrimSpace(strings.ReplaceAll(value, "\x00", " "))
	clean = strings.Join(strings.Fields(clean), " ")
	if limit > 0 && len([]rune(clean)) > limit {
		r := []rune(clean)
		clean = string(r[:limit])
	}
	return clean
}

func buildGeminiHyperframesPrompt(req hyperframesAIGenerateRequest, aspect string, duration float64) string {
	width, height := 1080, 1920
	switch aspect {
	case "16:9":
		width, height = 1920, 1080
	case "1:1":
		width, height = 1080, 1080
	}
	referenceText := strings.TrimSpace(strings.Join(compactTextItems([]string{
		req.Source,
		req.DesignRules,
		req.Extras,
	}, 3, 7000), "\n\n"))
	topic := cleanNarrationTopic(firstNonEmpty(req.Topic, req.Product), referenceText)
	if topic == "" {
		topic = strings.TrimSpace(firstNonEmpty(req.Topic, req.Product))
	}
	if topic == "" {
		topic = "마케팅 모션 영상"
	}
	objective := firstNonEmpty(req.Objective, req.Goal, "광고 전환")
	sceneCount := req.SceneCount
	if sceneCount <= 0 {
		sceneCount = int(math.Ceil(duration / 7))
	}
	if sceneCount < 1 {
		sceneCount = 1
	}
	if sceneCount > 24 {
		sceneCount = 24
	}
	logoRule := "- 외부 이미지는 금지. 폰트는 Google Fonts 한글 웹폰트와 system-ui 폴백을 함께 사용. 새 로고나 가짜 로고를 만들지 마라."
	if strings.TrimSpace(req.LogoURL) != "" {
		logoRule = "- 제공된 브랜드 로고 URL/data URL은 배경 이미지 생성/편집 참고 자산이다. 최종 HyperFrames HTML에서 로고 이미지를 별도 오버레이처럼 덜렁 얹지 마라. 로고가 필요하면 씬 배경 이미지 안에서 간판, 제품 표식, 앱 아이콘, 공간 소품처럼 자연스럽게 녹아든 상태를 사용한다. 다른 외부 이미지는 금지."
	}
	designRuleBlock := ""
	if designRules := strings.TrimSpace(req.DesignRules); designRules != "" {
		designRuleBlock = "[프로필 CI/BI 디자인 규칙 최우선]\n" +
			"- 아래 디자인 규칙은 참고 자료나 자동 배경 컨셉보다 우선한다. 색상, 타이포, 레이아웃, 이미지 톤, CTA, 금지 규칙을 CSS/HTML/GSAP와 씬별 화면 구성에 반드시 적용하라.\n" +
			"- 앱 기본 강조색, 일반 템플릿 색, 임의 폰트/카드 스타일로 프로필 규칙을 덮어쓰면 실패다.\n" +
			truncate(designRules, 3200)
	}
	brandColor := strings.TrimSpace(req.BrandColor)
	if brandColor == "" {
		brandColor = "#ff8c00"
	}
	return fmt.Sprintf(`너는 HyperFrames HTML 모션 영상 감독이자 프론트엔드 애니메이터다.
아래 조건으로 바로 렌더 가능한 단일 HTML만 출력하라. 설명, 마크다운, 코드펜스 금지.

[영상 정보]
- 주제: %s
- 목적: %s
- 톤: %s
- CTA: %s
- 비율: %s
- 크기: %dx%d
- 길이: %.0f초
- 정확한 장면 수: %d개
- 브랜드 기본색: %s
- 브랜드 로고 URL/data URL: %s

[참고 자료]
%s

%s

[소재 반영 계약]
- 참고 자료와 확정 씬 플랜에 있는 소재, 숫자, 서비스명, 디자인 규칙은 선택 사항이 아니라 화면 설계의 최상위 계약이다.
- 모든 씬은 참고 자료에서 나온 구체 소재 1개 이상을 title, body, 칩, data-vag-narration, 이미지 레이어 중 최소 한 곳에 반영해야 한다.
- "콘텐츠 지옥", "업무 압박", "브랜드 통일" 같은 일반 문구만 반복하고, 하루 3포스트, 113개 문체, 프로필 디자인 규칙, 카드뉴스/SNS/HyperFrames 통합 같은 입력 소재를 화면에서 놓치면 실패다.
- 참고 자료에 [확정 씬 플랜]이 있으면 그 순서, title, body, narration, visual_mode, cut_plan을 우선 사용하라. 새 주제로 바꾸거나 씬 수를 줄이지 마라.

[핵심 메시지 계약]
- 영상 전체를 관통하는 핵심 메시지 1문장을 먼저 정하고, 모든 장면은 그 메시지를 증명하거나 행동으로 연결해야 한다.
- 1씬 첫 3초에는 핵심 메시지를 문제형/질문형으로 각인시켜라.
- 마지막 씬 마지막 5초에는 같은 핵심 메시지를 해결/CTA 형태로 다시 말해라.
- 핵심 메시지와 무관한 장식 문구, 추상 수식어, 내부 옵션명은 넣지 마라.

[메시지 압축 규칙]
- 30초 이하도 최소 5씬 구성이 기본이다: 후크, 문제/맥락, 증거/숫자, 해결/데모, CTA로 나눈다.
- 자료가 많아도 이슈를 산만하게 나열하지 말고, 핵심 문제 1개 + 근거/상황 1개 + 해결 방식 1개 + CTA를 5개 이상 씬에 나눠 배치하라.
- 내용 없는 수식어만 쓰지 마라. "무엇이 문제인지", "왜 믿을 만한지", "무엇을 해주는지", "다음 행동"이 보여야 한다.
- 참고 자료의 URL, RSS 문자열, Google News 링크, 영문 기사 제목, 출처명, 날짜/GMT 표기는 화면 문구와 data-vag-narration에 넣지 마라.
- 화면 문구는 씬마다 핵심 문장 1개, 보조 문장 1개, 짧은 근거/행동 칩 1개까지 허용한다.
- 화면 제목은 2줄 이내, 보조 문장은 2줄 이내로 보이게 짧게 줄여라. 한 씬에 긴 문단을 넣지 마라.
- 강조 칩/배지/숫자는 반드시 같은 씬의 핵심 문장, 보조 문장, data-vag-narration에서 나온 표현만 사용한다. 장식용 영어 단어(BEAT/RHYTHM/IMPACT 등)나 다른 씬의 문제/해결 문구를 넣지 마라.
- 모든 씬에 텍스트 박스와 칩을 억지로 넣지 마라. 이미지가 메시지를 충분히 전달하는 장면은 텍스트를 거의 없애거나 완전히 없앤 이미지 호흡 씬으로 둔다.

[배경 이미지 합성 규칙]
- 참고 자료에 씬별 배경 이미지 URL이 있으면 각 .clip.scene 안에 해당 씬 이미지를 full-bleed <img> 또는 background-image로 반드시 배치하라.
- 배경 이미지는 장식이 아니라 씬의 주 시각 자산이다. 전체 화면을 어두운 패널/검은 오버레이/불투명 카드로 덮어 이미지가 보이지 않게 만들면 실패다.
- 좌우/상하를 반으로 나누는 split layout, 큰 흰 패널, 큰 색 패널, 정보판 레이아웃으로 배경 이미지를 가리면 실패다. 텍스트와 CTA는 배경 이미지 위에 작은 대비 레이어로만 얹어라.
- 이미지 위 오버레이는 그라데이션 또는 반투명 레이어만 허용하며, 평균 opacity는 0.55 이하로 유지하라. 텍스트 가독성이 필요하면 국소적인 작은 패널을 쓰고 이미지 면적의 절반 이상은 확인 가능해야 한다.
- 이미지 안에 글자, 로고, CTA, 가격표가 생겼더라도 그것을 확대하거나 강조하지 말고, HyperFrames HTML 레이어의 실제 텍스트만 메시지로 사용하라.
- 로고는 별도 오버레이처럼 덜렁 얹지 않는다. 제공된 로고가 있다면 씬 배경 이미지 생성/편집 단계에서 간판, 제품 표식, 앱 아이콘, 공간 소품처럼 자연스럽게 배경과 합성된 상태를 사용하라. HTML 레이어는 문구, 자막, 강조선, CTA 모션을 담당한다.
- 브랜드명/워터마크/로고 텍스트를 화면 오른쪽 위나 왼쪽 위에 고정 배치하지 마라. 브랜드 표기는 입력 CTA나 마지막 문구에 꼭 필요할 때만 자연스럽게 사용하라.

[씬 구성 다양성]
- visual_mode를 장면마다 다르게 설계하라. 후보: image_only, cinematic_image, kinetic_type, data_proof, product_focus, cta_lockup.
- image_only/cinematic_image 씬은 배경 이미지 자체가 주인공이다. 화면 텍스트는 0개 또는 아주 작은 브랜드/진행 표시 1개까지만 허용하고, data-vag-narration만 해당 이미지의 의미를 읽는다.
- 짧은 영상도 최소 1개 씬은 텍스트를 덜어낸 비주얼 호흡 또는 이미지 중심 씬으로 둘 수 있다. 단, 마지막 CTA 씬은 행동 유도가 읽혀야 한다.
- 연속된 씬이 같은 카드/패널/칩 구성으로 반복되면 실패다. 어떤 씬은 풀블리드 이미지, 어떤 씬은 키네틱 타이포, 어떤 씬은 데이터/증거, 어떤 씬은 CTA 락업처럼 역할과 밀도를 바꿔라.
- 전체 구성은 광고 감독이 만든 것처럼 보여야 한다. 장면별 밀도는 high / low / high / lockup처럼 리듬을 만들고, 정보 전달 씬과 감정/이미지 호흡 씬을 교차시켜라.
- 모든 씬은 같은 브랜드 세계 안에 있어야 하지만 카메라 거리, 타이포 크기, 여백, 오버레이 강도, 움직임 방향은 달라야 한다.
- image_only 씬은 “비어 있는 씬”이 아니라 기억에 남는 비주얼 펀치 또는 감정 전환 씬이어야 한다. 피사체, 조명, 구도, 질감을 image_prompt에 구체적으로 적어라.
- 최종 결과는 하드코딩 템플릿처럼 보이면 실패다. 주제, 자료, 확정 씬 플랜, 배경 이미지에 맞춰 장면 구성을 새로 설계하라.

[필수 구현]
- 루트는 <div data-composition-id="makeke-html-motion" data-width="%d" data-height="%d" data-start="0" data-duration="%.0f"> 로 작성.
- GSAP CDN을 포함하고 window.__timelines["makeke-html-motion"] 와 window.__hf.seek(t)를 반드시 등록.
- 정확히 %d개의 시각 장면을 만들어라. 장면은 .clip.scene 클래스를 갖고 data-scene-index="1"부터 순서대로 넣어라.
- .clip.scene 또는 data-start가 있는 주요 시각 장면을 %d개보다 많이 만들면 실패다. 보조 문장/칩/패널은 같은 장면 내부 요소로만 넣어라.
- 각 .clip.scene마다 data-start, data-duration, data-track-index, data-vag-narration을 넣어라. data-vag-narration은 그 장면 화면 내용과 직접 연결되는 한국어 1~2문장이다.
- 전체 길이 %.0f초를 %d개 장면이 빈틈 없이 나눠 갖게 하라. 한 장면짜리 긴 래퍼로 만들지 마라.
- 각 장면 역할은 중복하지 마라. 5씬이면 1씬 후크, 2씬 문제/맥락, 3씬 증거/숫자, 4씬 해결/데모, 5씬 CTA 락업으로 나눈다.
- 각 장면은 단순 카드 반복 금지. full-bleed image hold, kinetic typography, parallax shapes, scan line, progress line, chips, panels, line drawing 중 장면 성격에 맞게 다르게 섞어라.
- 폰트는 macOS/Windows 기본 한글 폰트와 system-ui를 우선 사용하라. font-family는 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif 순서를 기본으로 둔다. 장식용 Google Fonts에 의존해 글자가 깨지는 구성을 만들지 마라.
- 텍스트 레이아웃은 먼저 완성 위치를 CSS로 잡고, GSAP는 그 위치로 들어오는 움직임만 담당한다. 주요 문구 컨테이너는 장면 전체를 기준으로 padding과 flex/grid를 사용하고, top/left 절대좌표로 가운데에 긴 문장을 박아 넣지 마라.
- 모든 문구는 화면 가장자리에서 최소 7%% 이상 떨어진 안전 여백 안에 둔다. 세로 영상에서는 상단/하단 8%%, 좌우 7%% 안쪽에 배치하고, 제목/본문/CTA가 서로 겹치거나 잘리지 않게 한다.
- 한국어 문구는 word-break: keep-all, overflow-wrap: break-word, line-height 1.05~1.35, letter-spacing 0을 사용한다. 음수 letter-spacing 금지.
- 이미지 위 텍스트는 얇은 그림자, 1px 이하 외곽선, 아주 작은 반투명 받침만 사용한다. 화면 절반을 덮는 큰 카드, 검은 박스, 이미지 반쪽 분할은 금지다.
- 정확한 장면 경계에서 빈 프레임이 나오지 않게 장면 시작 시 opacity는 즉시 보이게 하고 내부 요소만 등장 애니메이션을 준다.
- 나레이션 문구나 내부 옵션명("자료 기반", "직설 톤", "CTA")을 화면 제목처럼 반복하지 마라.
- 화면 문구와 data-vag-narration은 서로 같은 장면의 같은 메시지를 말해야 한다. 장면 3의 화면에 없는 내용을 장면 3 나레이션에 넣지 마라.
- 강조 칩/배지/숫자도 같은 장면의 data-vag-narration과 맞아야 한다. 제목은 문제인데 칩은 리듬/비트/다른 문제를 말하는 식으로 분리하지 마라.
- GSAP selector는 반드시 실제 DOM에 존재하는 요소만 사용하라. gsap.to/from/fromTo/set 호출 전 document.querySelector 또는 gsap.utils.toArray(selector).length로 존재 여부를 확인하고, 없는 selector 애니메이션은 호출하지 마라.
- .scene-chips span을 애니메이션하려면 해당 장면 DOM 안에 .scene-chips와 span을 실제로 생성하라. 생성하지 않은 class/id를 타임라인에 넣으면 실패다.
%s
- 마지막 장면은 입력 CTA가 있으면 그 CTA만 자연스럽게 행동 유도로 연결한다. CTA가 비어 있으면 주제와 자료에 맞는 다음 행동을 AI가 정하되, 특정 브랜드/URL을 임의로 넣지 마라.

[브랜드 적용]
- CSS :root에 --brand:%s; --accent:%s; 를 선언하고 CTA, progress bar, 강조 배지, key shape, chart/line 중 최소 4곳에 브랜드 기본색을 직접 사용.
- 브랜드 기본색이 있으면 앱 기본 CSS 변수 색을 메인 액센트로 반복하지 말고, 브랜드색을 중심으로 팔레트를 구성.
- 로고 URL/data URL을 HTML 레이어 이미지로 삽입하지 마라. 로고는 이미 씬 배경 이미지 안에 자연스럽게 합성된 결과만 사용하고, HTML은 텍스트/강조선/CTA 모션을 담당한다.
- .watermark, .brand-logo, .brand-name, .logo-lockup 같은 상단 고정 브랜드 표식 클래스를 만들지 마라.

[크리에이티브 디렉션 — AI가 전부 알아서 판단하되 디자인 규칙은 반드시 따른다]
- 폰트, 글자색, 텍스트 위치, 애니메이션, 모션, 전환 효과를 AI가 자율적으로 결정하라.
- 단, 프로필에 디자인 규칙(색상 팔레트, 텍스트 색상, 금지 규칙 등)이 있으면 그것이 최우선이다. 디자인 규칙의 텍스트 색상, 메인 색상, 배경 색상을 반드시 사용하라.
- 글자색은 전부 흰색(#fff)으로 통일하지 마라. 디자인 규칙에 텍스트 색상이 지정되어 있으면 그 색을 쓰고, 없으면 배경 밝기에 맞게 AI가 판단하라.
- 배경 이미지는 정지 화면이 아니라 살짝 움직여야 한다.

반드시 <!DOCTYPE html>부터 </html>까지 완전한 HTML만 출력.`,
		topic,
		fallbackHTTPText(objective, "광고 전환"),
		fallbackHTTPText(req.Tone, "직설"),
		fallbackHTTPText(req.CTA, "(AI가 주제에 맞게 판단)"),
		aspect,
		width,
		height,
		duration,
		sceneCount,
		brandColor,
		fallbackHTTPText(req.LogoURL, "(없음)"),
		truncate(referenceText, 6000),
		designRuleBlock,
		width,
		height,
		duration,
		sceneCount,
		sceneCount,
		duration,
		sceneCount,
		logoRule,
		brandColor,
		brandColor,
	)
}

func (s *Server) generateHyperframesNarrationScript(req hyperframesNarrationScriptRequest) string {
	topic := cleanNarrationTopic(req.Topic, req.Source)
	if topic == "" {
		topic = "브랜드 캠페인"
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	source := cleanNarrationSource(req.Source)
	sceneTexts := compactNarrationItems(req.SceneTexts, 8, 80)
	keyPoints := compactNarrationItems(req.KeyPoints, 6, 80)
	prompt := fmt.Sprintf(`
당신은 한국어 광고 영상 나레이션 작가입니다.
아래 정보를 바탕으로 %.0f초 분량의 자연스러운 홍보 나레이션 대본만 작성하세요.

[주제]
%s

[목적/톤/CTA]
- 목적: %s
- 톤: %s
- CTA: %s

[핵심 포인트]
%s

[화면에 있는 주요 문구]
%s

[참고 자료]
%s

[작성 규칙]
- 화면 UI, 레이아웃, 색상, 카드, 버튼, 숫자 배치 같은 "화면 설명"을 하지 마세요.
- "자료 기반", "광고 전환", "직설 톤", "CTA", "9:16", "60초", "모션 광고" 같은 내부 옵션명은 절대 읽지 마세요.
- 화면 문구를 그대로 길게 읽지 말고, 시청자에게 말하듯 핵심 이득과 행동 이유를 설명하세요.
- 주제명보다 실제 서비스가 해결하는 문제, 사용 장면, 고객 이득을 먼저 말하세요.
- 영어 단어, 영어 약어, 도메인, 모델명, 내부 기술명은 그대로 쓰지 말고 반드시 자연스러운 한글 표현으로 바꾸세요.
- %.0f초 분량에 맞게 문장 수를 조절하세요. 60초 이상이면 7~9문장, 30초면 4~5문장, 15초면 2~3문장.
- 나레이션은 화면보다 앞서가지 말고 씬별 문구와 같은 의미의 짧은 한국어 문장만 사용하세요.
- 억지로 길이를 채우기 위해 기술 설명, 화면 설명, 옵션명을 추가하지 마세요.
- 줄바꿈은 문장 단위로만 사용하세요.
- 마크다운, 제목, 따옴표, 주석 없이 대본 본문만 출력하세요.
	`,
		duration,
		topic,
		fallbackHTTPText(req.Objective, "전환"),
		fallbackHTTPText(req.Tone, "신뢰감 있게"),
		fallbackHTTPText(req.CTA, "(필요할 때만 자연스럽게 마무리)"),
		fallbackHTTPText(strings.Join(keyPoints, "\n- "), "-"),
		fallbackHTTPText(strings.Join(sceneTexts, "\n- "), "-"),
		truncate(source, 1200),
		duration,
	)
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey != "" {
		model := strings.TrimSpace(s.getSetting("MODELS.gemini_model", s.getSetting("API.gemini_model", "")))
		if model == "" {
			model = "gemini-2.5-flash"
		}
		if text, err := s.runGeminiDesignPrompt(prompt, nil, apiKey, model, 10*time.Second); err == nil {
			cleaned := cleanNarrationScript(text)
			if cleaned != "" {
				return fitNarrationScriptToDuration(req, sanitizeNarrationScript(expandNarrationScriptForDuration(req, cleaned, sceneTexts, keyPoints)))
			}
		}
	}
	return fitNarrationScriptToDuration(req, sanitizeNarrationScript(expandNarrationScriptForDuration(req, fallbackHyperframesNarrationScript(req, sceneTexts, keyPoints), sceneTexts, keyPoints)))
}

func expectedScenarioSceneCount(duration float64) int {
	switch {
	case duration <= 20:
		return 2
	case duration <= 35:
		return 4
	case duration <= 45:
		return 5
	case duration <= 75:
		return 6
	case duration <= 135:
		return 8
	default:
		return 10
	}
}

func buildFastHyperframesScenarioPlanPrompt(req hyperframesScenarioPlanRequest, sceneCount int) string {
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	designRules := strings.TrimSpace(req.DesignRules)
	if designRules != "" {
		designRules = "\n[브랜드/디자인 핵심]\n" + truncate(designRules, 450)
	}
	return fmt.Sprintf(`한국어 쇼츠 광고 콘티 초안을 빠르게 만드세요.
JSON 객체만 출력하세요. 설명, 마크다운, 코드펜스 금지. 문자열은 모두 한 줄.

[입력]
주제: %s
목표: %s
톤: %s
비율: %s
길이: %.0f초
씬 수: %d
CTA: %s

[자료]
%s%s

[빠른 초안 규칙]
- 지금은 상세 콘티가 아니라 1차 초안입니다. 짧고 완성된 JSON을 우선합니다.
- 광고처럼 보이는 로고 인트로/혜택 나열로 시작하지 말고 첫 1초에 사건을 만드세요.
- 각 씬은 다른 역할이어야 합니다: hook, problem, proof, peak, transition, brand 중에서 고르세요.
- 각 씬 micro_cuts는 정확히 3개만 작성하세요.
- 각 컷 camera는 정면 고정/단순 줌 금지. handheld macro, orbit, whip-pan, rack focus, tracking, top-down 중 하나를 넣으세요.
- storyboard_meta.creative_field는 짧게 작성하세요.

[필수 JSON]
{
  "storyboard_meta": {
    "creative_field": {
      "name": "12자 이하",
      "core": "핵심 의미",
      "tension": "갈등",
      "desire": "욕망",
      "exception": "예외성",
      "gravity": "브랜드라 가능한 이유",
      "mass_rule": "무거운 컷 기준"
    },
    "selection_strategy": "실제 영상화 컷 선별 기준"
  },
  "scenes": [
    {
      "role": "hook",
      "title": "8~16자",
      "body": "18~42자",
      "narration": "55자 이하 한국어",
      "image_prompt": "80~150자, 텍스트/가짜 로고 금지, 구도와 피사체 명시",
      "shot_type": "macro detail",
      "subject_action": "실제 행동",
      "camera": "움직이는 카메라",
      "sound_cue": "BGM/SFX 큐",
      "overlay_slogan": "8~18자 표어",
      "slogan_motion": "표어 모션",
      "micro_cuts": [
        {
          "title": "컷 제목",
          "action": "사건",
          "camera": "카메라 움직임",
          "copy": "편집 의미",
          "overlay_slogan": "8~18자",
          "slogan_motion": "모션",
          "sound_cue": "소리 큐",
          "vfx_preset": "VFX",
          "vfx_cue": "효과 큐",
          "role": "hook",
          "importance": 90,
          "selected_priority": 90,
          "field_coupling_score": 90,
          "creative_mass": 90,
          "field_coupling_reason": "짧은 이유",
          "shot_diversity_reason": "다른 컷과 다른 점",
          "image_prompt": "컷 이미지 프롬프트",
          "video_prompt": "컷 영상 움직임 프롬프트"
        }
      ]
    }
  ]
}
scenes 배열은 정확히 %d개. 각 scene의 micro_cuts는 정확히 3개.`,
		cleanNarrationTopic(req.Topic, req.Source),
		fallbackHTTPText(req.Objective, "광고 목표"),
		fallbackHTTPText(req.Tone, "브랜드에 맞는 톤"),
		fallbackHTTPText(req.Aspect, "9:16"),
		duration,
		sceneCount,
		fallbackHTTPText(req.CTA, "(없음)"),
		truncate(strings.TrimSpace(req.Source), 900),
		designRules,
		sceneCount,
	)
}

func buildHyperframesScenarioPlanPrompt(req hyperframesScenarioPlanRequest, sceneCount int) string {
	if isFastHyperframesScenarioPlan(req) {
		return buildFastHyperframesScenarioPlanPrompt(req, sceneCount)
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 15
	}
	sourceLimit := 7000
	designRuleLimit := 3200
	outputRule := "출력 안정성 규칙: 마지막 닫는 중괄호까지 반드시 완성하세요. 모든 문자열은 짧고 압축적으로 씁니다. title 18자 이하, body 55자 이하, narration 90자 이하, image_prompt/video_prompt 220자 이하, reason 필드 70자 이하입니다."
	microCutPlanningRule := "콘티는 미친 듯이 자세해야 한다. 각 씬은 반드시 micro_cuts 배열을 포함하고, 씬당 최소 5개 마이크로 컷으로 쪼갠다."
	microCutSchemaRule := "각 씬의 micro_cuts는 최소 5개입니다."
	designRuleBlock := ""
	if designRules := strings.TrimSpace(req.DesignRules); designRules != "" {
		designRuleBlock = "[프로필 CI/BI 디자인 규칙 최우선]\n" +
			"- 아래 디자인 규칙은 배경 컨셉, 자동 스타일, 씬별 연출보다 우선한다. title/body/narration/image_prompt/cut_plan/색상/타이포/CTA/금지 규칙에 반드시 반영하라.\n" +
			"- 앱 기본 강조색이나 일반 템플릿 색으로 덮어쓰지 말고, 프로필 대표 색상과 이미지 톤을 씬 플랜의 art_direction/composition에 구체적으로 써라.\n" +
			truncate(designRules, designRuleLimit)
	}
	return fmt.Sprintf(`당신은 한국어 광고 영상 크리에이티브 디렉터입니다.
아래 자료를 보고 HyperFrames 이미지 모션 합성 전에 확정할 씬 플랜과 내레이션을 직접 작성하세요.
출력은 JSON 객체만 가능합니다. 설명, 마크다운, 코드펜스는 금지합니다.
%s
필드값 안에 줄바꿈을 넣지 말고 한 줄 문자열만 사용하세요.

[입력]
- 주제: %s
- 목적: %s
- 톤: %s
- 비율: %s
- 길이: %.0f초
- 정확한 씬 수: %d
- 마지막 CTA: %s

[참고 자료]
%s

%s

[광고 설계 원칙]
- 먼저 creative_field를 생성하세요. 이것은 화면에 직접 보이지 않지만 모든 컷의 의미, 감정, 예외성, 브랜드 중력을 결정하는 광고 중심장입니다.
- creative_field는 name, core, tension, desire, exception, gravity, mass_rule을 가집니다. 이 값은 브랜드와 소재에서 매번 새로 도출하며 고정 장르나 고정 공식으로 채우지 마세요.
- 모든 micro_cuts는 creative_field와 얼마나 강하게 결합하는지 field_coupling_score(0~100), creative_mass(0~100), field_coupling_reason, shot_diversity_reason을 가져야 합니다.
- storyboard_meta의 selection_criteria와 creative_audit는 이 광고의 creative_field에서 나온 동적 기준이어야 하며, 고정 체크리스트를 복붙하지 마세요.
- 참고 자료와 브랜드 디자인 규칙은 선택 참고가 아니라 최상위 입력이다. title/body/narration/emphasis/image_prompt/cut_plan에 참고 자료의 핵심 문제, 수치, 고유명사, 제품/서비스 특징, 고객 상황 중 최소 1개 이상을 직접 반영하라.
- 브랜드 디자인 규칙이 있으면 색상, 타이포, 레이아웃, 이미지 톤, CTA, 금지 규칙을 모든 씬과 image_prompt에 반영하라. 앱 기본 강조색이나 일반 템플릿 색으로 덮어쓰지 마라.
- 참고 자료가 있는데 일반적인 브랜드 소개, 추상 광고 문구, 앱 기본 템플릿 문구만 만들면 실패다.
- 영상 전체를 관통하는 핵심 메시지 1개를 먼저 잡고 모든 씬이 그 메시지에 기여하게 하세요.
- 자료를 그대로 나열하지 말고, 문제 1개, 믿을 이유 1개, 해결 방식 1개, 행동 1개로 압축하세요.
- 광고 기법은 AI가 주제와 자료에 맞게 고르세요. 예: 패턴 인터럽트, 문제-증거-해결, 비교, 전후 대비, 데모, 사회적 증거, 리스크 제거, CTA 락업 등.
- 첫 씬은 후크/문제/긴장만 담당합니다. 마지막 CTA 문구를 첫 씬 또는 중간 씬에 넣지 마세요.
- CTA는 마지막 씬 narration 또는 body에서만 자연스럽게 사용하세요.
- 화면에 없는 내용을 narration에 넣지 말고, narration은 한국어로만 작성하세요.
- URL, 출처명, RSS, 영문 기사 제목, 내부 옵션명은 title/body/narration에 넣지 마세요.
- 장면마다 visual_mode를 다르게 정하세요. 후보: image_only, cinematic_image, kinetic_type, data_proof, product_focus, cta_lockup.
- image_only 또는 cinematic_image 씬도 title/body/narration/image_prompt는 절대 비우지 마세요. 화면 텍스트를 적게 쓰는 씬이라도 title/body에는 HTML 레이어가 사용할 짧은 메시지와 보조 문장을 작성하세요.
- 모든 씬을 텍스트 카드처럼 만들지 말고, 풀블리드 이미지 씬과 타이포/데이터/CTA 씬을 섞으세요.
- 씬은 각각 따로 노는 카드가 아니라 하나의 광고 시퀀스여야 합니다. 같은 주인공/상품/공간/색감/조명/렌즈 질감이 이어지고, 이전 씬의 감정·동작·시선이 다음 씬으로 연결되게 작성하세요.
- 사람이 등장하는 전략이면 가상 주인공 1명을 정하고 모든 image_prompt와 cut_plan에서 같은 인물 정체성을 유지하세요. 사람이 등장하지 않는 전략이면 사람 얼굴/손 모델을 만들지 마세요.
- 각 씬의 cut_plan을 직접 설계하세요. 카메라 움직임, 이미지 홀드/줌/팬, 전환 방식, 텍스트 등장 타이밍, 컷의 감정 리듬을 한 문장으로 정하세요.
- 각 씬은 광고 제작소의 콘티처럼 아주 구체적이어야 합니다. shot_type, subject_action, camera, lens, lighting, art_direction, props_wardrobe, composition, transition, sound_cue, edit_beat, negative_constraints를 비우지 마세요.
- shot_type은 예: extreme close-up, macro detail, medium lifestyle, over-shoulder, top-down flatlay, proof detail, hero packshot, CTA lockup처럼 구체적으로 쓰세요.
- subject_action은 모델/손/제품/공간이 실제로 무엇을 하는지 한 문장으로 씁니다. “멋지게 보여줌” 같은 추상어는 금지합니다.
- camera/lens/lighting/composition은 실제 촬영감이 나도록 거리, 움직임, 초점, 심도, 광원 방향, 프레임 여백을 명확히 씁니다.
- art_direction과 props_wardrobe는 브랜드 톤, 소품, 의상, 표면 질감, 배경 공간을 설명합니다. 모든 씬이 같은 오피스/노트북/카드처럼 반복되면 실패입니다.
- sound_cue와 edit_beat는 나레이션/BGM/HyperFrames 모션이 어느 타이밍에 반응할지 씁니다.
- overlay_slogan은 AI가 만드는 핵심 표어입니다. 나레이션 대본이나 설명 자막이 아니라 중간중간 0.8~1.6초만 등장할 짧은 감정 펀치로 쓰세요. 8~18자 한국어, CTA/가격/혜택 나열 금지.
- slogan_motion은 표어가 들어올 모션을 한 구로 씁니다. 예: spark snap, glass wipe, shock pulse, quiet glow.
- 나레이션이 있고 주인공 얼굴이 말하는 컷이면 lip_sync_hint에 입모양, 표정, 시선, 제스처가 문장 호흡과 맞는 방식을 씁니다. 얼굴이 말하지 않는 컷이면 "lip sync 없음"이라고 명확히 쓰세요.
- 로컬 템플릿처럼 보이는 고정 구성을 피하고, 주제와 자료에 맞게 AI가 컷 구성을 주도하세요.
 - %s

[JSON 스키마]
{
  "storyboard_meta": {
    "creative_field": {
      "name": "이 광고의 창조장 이름",
      "core": "전체 컷을 묶는 핵심 의미",
      "tension": "시청자가 느낄 갈등/압력",
      "desire": "시청자가 무의식적으로 원하는 감정",
      "exception": "카테고리 공식을 깨는 예외성",
      "gravity": "왜 이 브랜드라 가능한지",
      "mass_rule": "어떤 컷이 무거운 컷인지 판단하는 규칙"
    },
    "selection_strategy": "후보 컷 중 실제 영상화 컷을 고르는 전략",
    "selection_criteria": [{"name": "동적 기준명", "detail": "이 광고에서만 성립하는 선별 이유"}],
    "creative_audit": [{"name": "검토 항목", "status": "검토 결과", "detail": "실제 확인 내용"}],
    "diversity_axes": [{"name": "시각/감정 다양성 축", "detail": "반복을 피하는 방식"}],
    "required_roles": [{"name": "필수 컷 역할", "detail": "왜 필요한지"}],
    "field_questions": [{"name": "창조장 질문", "detail": "이 광고가 답해야 하는 질문"}],
    "field_constraints": [{"name": "제약", "detail": "브랜드/소재상 지켜야 할 제약"}]
  },
  "scenes": [
    {
    "role": "hook|problem|proof|solution|cta 등 AI가 정한 역할",
    "visual_mode": "image_only|cinematic_image|kinetic_type|data_proof|product_focus|cta_lockup 중 하나",
    "cut_plan": "이 씬의 컷 연출. 예: 풀블리드 이미지 1.5초 홀드 후 느린 push-in, 마지막 0.6초 타이포 펀치",
    "shot_type": "촬영 쇼트 타입. 예: macro product detail, medium lifestyle, top-down flatlay",
    "subject_action": "피사체/모델/손/제품/공간이 실제로 하는 행동",
    "camera": "카메라 움직임과 프레이밍",
    "lens": "렌즈/심도/초점 질감",
    "lighting": "조명 방향, 색온도, 명암",
    "art_direction": "미술/공간/표면 질감/브랜드 무드",
    "props_wardrobe": "소품, 의상, 손/모델 스타일",
    "composition": "구도, 여백, 텍스트가 올라갈 안전 영역",
    "transition": "이전/다음 씬과 이어지는 전환",
    "sound_cue": "BGM/SFX/나레이션 호흡 큐",
    "edit_beat": "컷 타이밍과 감정 비트",
    "lip_sync_hint": "주인공이 말하는 컷이면 나레이션과 입모양/표정/제스처를 맞추는 지시, 아니면 lip sync 없음",
    "negative_constraints": "이 씬에서 피해야 할 이미지/모션/텍스트 요소",
    "title": "화면 핵심 문구",
    "body": "화면 보조 문구",
    "narration": "해당 씬에서 읽을 한국어 나레이션 1~2문장",
    "overlay_slogan": "최종 HyperFrames가 중간 컷에 짧게 얹을 8~18자 핵심 표어. 설명 자막, CTA, 가격 금지",
    "slogan_motion": "핵심 표어 모션 큐. 예: spark snap, glass wipe, shock pulse, quiet glow",
    "emphasis": ["강조 칩 1", "강조 칩 2"],
    "image_prompt": "이 씬 배경 이미지 프롬프트. 씬 역할에 맞는 카메라 앵글(와이드/클로즈업/오버숄더/탑뷰/매크로 등)과 구도를 구체적으로 지정. 모든 씬이 같은 정면 구도이면 실패. 텍스트/로고 금지.",
    "micro_cuts": [
      {
        "title": "컷 제목",
        "action": "컷에서 일어나는 사건",
        "camera": "카메라 거리, 앵글, 움직임",
        "copy": "화면 안 텍스트가 아니라 편집자가 이해할 짧은 의미",
        "overlay_slogan": "8~18자 핵심 표어",
        "slogan_motion": "표어 모션 큐",
        "sound_cue": "영상 API BGM/SFX 큐",
        "vfx_preset": "컷별 VFX 방향",
        "vfx_cue": "빛/파티클/속도/전환 큐",
        "role": "hook|product|proof|peak|transition|rhythm 등",
        "importance": 0,
        "selected_priority": 0,
        "field_coupling_score": 0,
        "creative_mass": 0,
        "field_coupling_reason": "creative_field와 결합하는 이유",
        "shot_diversity_reason": "직전/주변 컷과 달라지는 이유",
        "image_prompt": "이 컷 기준 이미지 프롬프트",
        "video_prompt": "이 컷 영상 모델 움직임 프롬프트"
      }
    ]
    }
  ]
}
정확히 %d개 씬 객체만 출력하세요.
%s
모든 객체의 title, body, narration, image_prompt는 빈 문자열이면 실패입니다.
title은 8~18자 한국어 핵심 문구, body는 18~55자 한국어 보조 문장, narration은 1문장 한국어 대본, image_prompt는 80~220자 배경 이미지 지시로 작성하세요.`,
		outputRule,
		cleanNarrationTopic(req.Topic, req.Source),
		fallbackHTTPText(req.Objective, "광고 목표"),
		fallbackHTTPText(req.Tone, "브랜드에 맞는 톤"),
		fallbackHTTPText(req.Aspect, "9:16"),
		duration,
		sceneCount,
		fallbackHTTPText(req.CTA, "(없음)"),
		truncate(strings.TrimSpace(req.Source), sourceLimit),
		designRuleBlock,
		microCutPlanningRule,
		sceneCount,
		microCutSchemaRule,
	)
}

func buildFastHyperframesScenarioRepairPrompt(req hyperframesScenarioPlanRequest, sceneCount int, raw string, parsedCount int, missingFields []string) string {
	return fmt.Sprintf(`콘티 초안 JSON을 다시 작성하세요. JSON 객체만 출력하세요.

실패: scenes %d/%d, 누락: %s
주제: %s
목표: %s
자료: %s
이전 응답: %s

필수:
- 최상위는 storyboard_meta와 scenes만.
- scenes는 정확히 %d개.
- 각 scene은 title, body, narration, image_prompt, micro_cuts를 비우지 마세요.
- 각 scene의 micro_cuts는 정확히 3개.
- 각 cut은 title, action, camera, role, importance, image_prompt, video_prompt를 포함.
- 문자열은 짧게, 한 줄로.
- JSON 밖 설명 금지.`,
		parsedCount,
		sceneCount,
		fallbackHTTPText(strings.Join(missingFields, "; "), "(필드 누락 없음)"),
		cleanNarrationTopic(req.Topic, req.Source),
		fallbackHTTPText(req.Objective, "광고 목표"),
		truncate(strings.TrimSpace(req.Source), 900),
		truncate(raw, 600),
		sceneCount,
	)
}

func buildHyperframesScenarioRepairPrompt(req hyperframesScenarioPlanRequest, sceneCount int, raw string, parsedCount int, missingFields []string) string {
	fastPlan := isFastHyperframesScenarioPlan(req)
	if fastPlan {
		return buildFastHyperframesScenarioRepairPrompt(req, sceneCount, raw, parsedCount, missingFields)
	}
	sourceLimit := 5000
	designRuleLimit := 2500
	rawLimit := 1600
	microCutRule := "각 micro_cuts는 최소 5개이며 title, action, camera, copy, overlay_slogan, slogan_motion, sound_cue, vfx_preset, vfx_cue, role, importance, selected_priority, field_coupling_score, creative_mass, field_coupling_reason, shot_diversity_reason, image_prompt, video_prompt를 포함"
	return fmt.Sprintf(`아래 AI 응답은 HyperFrames 씬 콘티 JSON 검증에 실패했습니다.
절대 임시 콘티를 만들지 말고, 주제와 참고 자료를 다시 읽어 실제 광고 시나리오를 정확히 %d개 씬 JSON 객체로 재작성하세요.
설명, 마크다운, 코드펜스 없이 JSON 객체만 출력하세요.

[검증 실패]
- 파싱된 씬 수: %d
- 필요한 씬 수: %d
- 누락 필드: %s

[입력]
- 주제: %s
- 목적: %s
- 톤: %s
- 비율: %s
- 길이: %.0f초
- 마지막 CTA: %s

[참고 자료]
%s

[프로필 디자인 규칙]
%s

[이전 AI 응답]
%s

[필수]
- JSON 객체만 출력. 최상위 객체는 storyboard_meta와 scenes만 포함
- scenes에는 정확히 %d개 객체만 출력
- JSON 문법을 반드시 지키세요. 모든 key와 문자열 value는 큰따옴표로 감싸고, 문자열 밖에 한국어 설명을 쓰지 마세요. trailing comma, 주석, 마크다운, 코드펜스 금지
- 마지막 닫는 중괄호까지 반드시 완성하세요. 모든 문자열은 짧게 압축하세요. title 18자 이하, body 55자 이하, narration 90자 이하, image_prompt/video_prompt 220자 이하, reason 필드 70자 이하.
- storyboard_meta에는 creative_field, selection_strategy, selection_criteria, creative_audit, diversity_axes, required_roles, field_questions, field_constraints를 포함
- 각 씬 객체에는 role, visual_mode, cut_plan, shot_type, subject_action, camera, lens, lighting, art_direction, props_wardrobe, composition, transition, sound_cue, edit_beat, lip_sync_hint, negative_constraints, title, body, narration, overlay_slogan, slogan_motion, emphasis, image_prompt, micro_cuts를 모두 포함
- %s
- title, body, narration, image_prompt는 절대 빈 문자열 금지. 비주얼 호흡 씬도 짧은 title/body와 실제 나레이션, 80자 이상 image_prompt를 작성
- JSON key를 생략하지 말고, null/빈 문자열/빈 배열로 보내지 마세요. 강조 칩이 적어도 emphasis에는 장면 문맥과 맞는 짧은 한국어 1개 이상을 넣으세요.
- image_prompt는 이미지 안에 한글/영문/숫자/로고/워터마크가 생성되지 않게 작성
- 프로필 CI/BI 디자인 규칙과 참고 자료를 씬마다 반영`,
		sceneCount,
		parsedCount,
		sceneCount,
		fallbackHTTPText(strings.Join(missingFields, "; "), "(필드 누락 없음)"),
		cleanNarrationTopic(req.Topic, req.Source),
		fallbackHTTPText(req.Objective, "광고 목표"),
		fallbackHTTPText(req.Tone, "브랜드에 맞는 톤"),
		fallbackHTTPText(req.Aspect, "9:16"),
		req.Duration,
		fallbackHTTPText(req.CTA, "(없음)"),
		truncate(strings.TrimSpace(req.Source), sourceLimit),
		truncate(strings.TrimSpace(req.DesignRules), designRuleLimit),
		truncate(raw, rawLimit),
		sceneCount,
		microCutRule,
	)
}

func cleanHyperframesJSONText(text string) string {
	raw := strings.TrimSpace(text)
	if strings.HasPrefix(raw, "```") {
		lines := strings.Split(raw, "\n")
		if len(lines) > 1 && strings.HasPrefix(strings.TrimSpace(lines[0]), "```") {
			lines = lines[1:]
		}
		if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
			lines = lines[:len(lines)-1]
		}
		raw = strings.TrimSpace(strings.Join(lines, "\n"))
	}
	trimmedRaw := strings.TrimSpace(raw)
	start := strings.Index(raw, "{")
	if strings.HasPrefix(trimmedRaw, "[") {
		start = strings.Index(raw, "[")
	} else if start < 0 {
		start = strings.Index(raw, "[")
	}
	if start > 0 {
		raw = raw[start:]
	}
	end := -1
	for _, token := range []string{"}", "]"} {
		if idx := strings.LastIndex(raw, token); idx >= 0 && idx > end {
			end = idx
		}
	}
	if end >= 0 && end+1 < len(raw) {
		raw = raw[:end+1]
	}
	return strings.TrimSpace(raw)
}

func parseHyperframesScenarioStoryboardMeta(text string) map[string]any {
	raw := cleanHyperframesJSONText(text)
	var wrapped struct {
		StoryboardMeta map[string]any `json:"storyboard_meta"`
		Meta           map[string]any `json:"meta"`
	}
	if err := json.Unmarshal([]byte(raw), &wrapped); err != nil {
		return map[string]any{}
	}
	if len(wrapped.StoryboardMeta) > 0 {
		return wrapped.StoryboardMeta
	}
	if len(wrapped.Meta) > 0 {
		return wrapped.Meta
	}
	return map[string]any{}
}

func parseHyperframesScenarioScenes(text string) ([]hyperframesScenarioScene, error) {
	raw := cleanHyperframesJSONText(text)
	scenes, err := decodeHyperframesScenarioScenesJSON([]byte(raw))
	if err != nil {
		extracted := raw
		if start := strings.Index(extracted, "["); start >= 0 {
			if end := strings.LastIndex(extracted, "]"); end > start {
				extracted = extracted[start : end+1]
			}
		}
		if extracted == raw {
			return nil, err
		}
		extractedScenes, err2 := decodeHyperframesScenarioScenesJSON([]byte(extracted))
		if err2 != nil {
			return nil, err
		}
		scenes = extractedScenes
	}
	cleaned := make([]hyperframesScenarioScene, 0, len(scenes))
	for _, scene := range scenes {
		scene.Title = cleanNarrationLine(scene.Title)
		scene.Body = cleanNarrationLine(scene.Body)
		scene.Narration = cleanNarrationLine(scene.Narration)
		scene.OverlaySlogan = cleanNarrationLine(scene.OverlaySlogan)
		scene.SloganMotion = cleanNarrationLine(scene.SloganMotion)
		scene.Role = cleanNarrationLine(scene.Role)
		scene.VisualMode = cleanNarrationLine(scene.VisualMode)
		scene.CutPlan = cleanNarrationLine(scene.CutPlan)
		scene.ImagePrompt = cleanNarrationLine(scene.ImagePrompt)
		scene.ShotType = cleanNarrationLine(scene.ShotType)
		scene.SubjectAction = cleanNarrationLine(scene.SubjectAction)
		scene.Camera = cleanNarrationLine(scene.Camera)
		scene.Lens = cleanNarrationLine(scene.Lens)
		scene.Lighting = cleanNarrationLine(scene.Lighting)
		scene.ArtDirection = cleanNarrationLine(scene.ArtDirection)
		scene.PropsWardrobe = cleanNarrationLine(scene.PropsWardrobe)
		scene.Composition = cleanNarrationLine(scene.Composition)
		scene.Transition = cleanNarrationLine(scene.Transition)
		scene.SoundCue = cleanNarrationLine(scene.SoundCue)
		scene.EditBeat = cleanNarrationLine(scene.EditBeat)
		scene.LipSyncHint = cleanNarrationLine(scene.LipSyncHint)
		scene.NegativeConstraints = cleanNarrationLine(scene.NegativeConstraints)
		scene.MicroCuts = cleanHyperframesScenarioMicroCuts(scene.MicroCuts)
		emphasis := make([]string, 0, len(scene.Emphasis))
		for _, item := range scene.Emphasis {
			if clean := cleanNarrationLine(item); clean != "" {
				emphasis = append(emphasis, clean)
			}
		}
		scene.Emphasis = emphasis
		if scenarioSceneHasContent(scene) {
			cleaned = append(cleaned, scene)
		}
	}
	return cleaned, nil
}

func decodeHyperframesScenarioScenesJSON(data []byte) ([]hyperframesScenarioScene, error) {
	var direct []hyperframesScenarioScene
	if err := json.Unmarshal(data, &direct); err == nil {
		return direct, nil
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(data, &object); err != nil {
		return nil, err
	}
	if scenes, ok := decodeHyperframesScenarioSceneObject(object); ok {
		return scenes, nil
	}
	return nil, fmt.Errorf("scenario scenes array not found")
}

func decodeHyperframesScenarioSceneObject(object map[string]json.RawMessage) ([]hyperframesScenarioScene, bool) {
	for _, key := range []string{
		"scenes",
		"items",
		"plan",
		"scene_list",
		"storyboard_scenes",
		"storyboard",
		"storyboard_plan",
		"scenario",
		"scenario_plan",
		"result",
		"data",
		"content",
		"sections",
		"acts",
		"segments",
		"sequence",
		"story",
		"script",
		"ad_plan",
	} {
		raw, ok := object[key]
		if !ok {
			continue
		}
		if scenes, decoded := decodeHyperframesScenarioSceneValue(raw); decoded {
			return scenes, true
		}
	}

	type keyedScene struct {
		order int
		key   string
		scene hyperframesScenarioScene
	}
	keyed := make([]keyedScene, 0, len(object))
	for key, raw := range object {
		scene, ok := decodeHyperframesScenarioSceneFromRaw(raw)
		if !ok {
			continue
		}
		keyed = append(keyed, keyedScene{
			order: scenarioSceneKeyOrder(key),
			key:   key,
			scene: scene,
		})
	}
	if len(keyed) > 0 {
		sort.SliceStable(keyed, func(i, j int) bool {
			if keyed[i].order == keyed[j].order {
				return keyed[i].key < keyed[j].key
			}
			return keyed[i].order < keyed[j].order
		})
		scenes := make([]hyperframesScenarioScene, 0, len(keyed))
		for _, item := range keyed {
			scenes = append(scenes, item.scene)
		}
		return scenes, true
	}

	if scene, ok := decodeHyperframesScenarioSceneFromObject(object); ok {
		return []hyperframesScenarioScene{scene}, true
	}
	return nil, false
}

func decodeHyperframesScenarioSceneValue(raw json.RawMessage) ([]hyperframesScenarioScene, bool) {
	if scenes, ok := decodeHyperframesScenarioSceneArray(raw); ok {
		return scenes, true
	}
	var nested map[string]json.RawMessage
	if err := json.Unmarshal(raw, &nested); err == nil {
		if scenes, ok := decodeHyperframesScenarioSceneObject(nested); ok {
			return scenes, true
		}
	}
	if scene, ok := decodeHyperframesScenarioSceneFromRaw(raw); ok {
		return []hyperframesScenarioScene{scene}, true
	}
	return nil, false
}

func decodeHyperframesScenarioSceneArray(raw json.RawMessage) ([]hyperframesScenarioScene, bool) {
	var direct []hyperframesScenarioScene
	if err := json.Unmarshal(raw, &direct); err == nil {
		scenes := make([]hyperframesScenarioScene, 0, len(direct))
		for _, scene := range direct {
			if scenarioSceneHasContent(scene) {
				scenes = append(scenes, scene)
			}
		}
		if len(scenes) > 0 {
			return scenes, true
		}
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, false
	}
	scenes := make([]hyperframesScenarioScene, 0, len(items))
	for _, item := range items {
		if scene, ok := decodeHyperframesScenarioSceneFromRaw(item); ok {
			scenes = append(scenes, scene)
		}
	}
	return scenes, len(scenes) > 0
}

func decodeHyperframesScenarioSceneFromRaw(raw json.RawMessage) (hyperframesScenarioScene, bool) {
	var scene hyperframesScenarioScene
	if err := json.Unmarshal(raw, &scene); err == nil && scenarioSceneHasContent(scene) {
		return scene, true
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err == nil {
		return decodeHyperframesScenarioSceneFromObject(object)
	}
	return hyperframesScenarioScene{}, false
}

func decodeHyperframesScenarioSceneFromObject(object map[string]json.RawMessage) (hyperframesScenarioScene, bool) {
	scene := hyperframesScenarioScene{
		Title:               firstScenarioString(object, "title", "scene_title", "name", "headline", "hook_title", "beat_title"),
		Body:                firstScenarioString(object, "body", "description", "scene_description", "summary", "content", "beat", "visual_description", "action_description"),
		Narration:           firstScenarioString(object, "narration", "voiceover", "voice_over", "script", "line", "copy", "caption"),
		Role:                firstScenarioString(object, "role", "scene_role", "purpose", "function", "beat_role"),
		ImagePrompt:         firstScenarioString(object, "image_prompt", "visual_prompt", "image", "image_description", "visual", "visual_direction", "key_visual", "prompt"),
		VisualMode:          firstScenarioString(object, "visual_mode", "mode", "style", "visual_style"),
		CutPlan:             firstScenarioString(object, "cut_plan", "shot_plan", "scene_plan", "production_plan", "edit_plan"),
		ShotType:            firstScenarioString(object, "shot_type", "shot", "framing", "frame", "camera_shot"),
		SubjectAction:       firstScenarioString(object, "subject_action", "action", "movement", "performance", "direction"),
		Camera:              firstScenarioString(object, "camera", "camera_move", "camera_movement", "camera_direction", "camera_work"),
		Lens:                firstScenarioString(object, "lens", "lens_choice", "focus", "focal_length"),
		Lighting:            firstScenarioString(object, "lighting", "light", "mood", "lighting_mood"),
		ArtDirection:        firstScenarioString(object, "art_direction", "art", "art_style", "production_design", "set_design"),
		PropsWardrobe:       firstScenarioString(object, "props_wardrobe", "props", "wardrobe", "costume", "objects"),
		Composition:         firstScenarioString(object, "composition", "layout", "blocking", "staging"),
		Transition:          firstScenarioString(object, "transition", "edit_transition", "cut_transition"),
		SoundCue:            firstScenarioString(object, "sound_cue", "sound", "sfx", "audio", "audio_cue", "bgm"),
		EditBeat:            firstScenarioString(object, "edit_beat", "editing", "rhythm", "pace", "timing"),
		LipSyncHint:         firstScenarioString(object, "lip_sync_hint", "lip_sync", "dialogue_hint"),
		NegativeConstraints: firstScenarioString(object, "negative_constraints", "negative", "avoid", "do_not"),
		OverlaySlogan:       firstScenarioString(object, "overlay_slogan", "slogan", "key_phrase", "tagline", "text_overlay"),
		SloganMotion:        firstScenarioString(object, "slogan_motion", "slogan_animation", "text_motion", "motion"),
		Emphasis:            firstScenarioStringSlice(object, "emphasis", "keywords", "chips", "key_points", "beats"),
		MicroCuts:           firstScenarioMicroCuts(object, "micro_cuts", "microcuts", "cuts", "shots", "shot_list", "beats"),
	}
	if scene.Narration == "" {
		scene.Narration = scene.Body
	}
	if scene.ImagePrompt == "" {
		scene.ImagePrompt = strings.Join(compactTextItems([]string{scene.ArtDirection, scene.Composition, scene.SubjectAction, scene.Camera}, 3, 180), ", ")
	}
	if scene.CutPlan == "" {
		scene.CutPlan = strings.Join(compactTextItems([]string{scene.SubjectAction, scene.Camera, scene.Transition}, 3, 180), " / ")
	}
	if scenarioSceneHasContent(scene) {
		return scene, true
	}
	return hyperframesScenarioScene{}, false
}

func firstScenarioString(object map[string]json.RawMessage, keys ...string) string {
	for _, key := range keys {
		raw, ok := object[key]
		if !ok {
			continue
		}
		if value := rawMessageString(raw); value != "" {
			return value
		}
	}
	return ""
}

func rawMessageString(raw json.RawMessage) string {
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text)
	}
	var number json.Number
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.UseNumber()
	if err := decoder.Decode(&number); err == nil {
		return number.String()
	}
	var items []string
	if err := json.Unmarshal(raw, &items); err == nil {
		return strings.TrimSpace(strings.Join(items, ", "))
	}
	return ""
}

func firstScenarioStringSlice(object map[string]json.RawMessage, keys ...string) []string {
	for _, key := range keys {
		raw, ok := object[key]
		if !ok {
			continue
		}
		var items []string
		if err := json.Unmarshal(raw, &items); err == nil {
			cleaned := make([]string, 0, len(items))
			for _, item := range items {
				if clean := strings.TrimSpace(item); clean != "" {
					cleaned = append(cleaned, clean)
				}
			}
			if len(cleaned) > 0 {
				return cleaned
			}
		}
		if value := rawMessageString(raw); value != "" {
			return []string{value}
		}
	}
	return nil
}

func firstRawMessage(object map[string]json.RawMessage, keys ...string) (json.RawMessage, bool) {
	for _, key := range keys {
		if raw, ok := object[key]; ok {
			return raw, true
		}
	}
	return nil, false
}

func firstScenarioMicroCuts(object map[string]json.RawMessage, keys ...string) []map[string]any {
	raw, ok := firstRawMessage(object, keys...)
	if !ok {
		return nil
	}
	var cuts []map[string]any
	if err := json.Unmarshal(raw, &cuts); err == nil {
		for i := range cuts {
			cuts[i] = normalizeScenarioMicroCutAliases(cuts[i])
		}
		return cuts
	}
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	cuts = make([]map[string]any, 0, len(items))
	for _, item := range items {
		var cut map[string]any
		if err := json.Unmarshal(item, &cut); err == nil && len(cut) > 0 {
			cuts = append(cuts, normalizeScenarioMicroCutAliases(cut))
		}
	}
	return cuts
}

func normalizeScenarioMicroCutAliases(cut map[string]any) map[string]any {
	aliases := map[string][]string{
		"title":                 {"title", "name", "beat_title", "cut_title"},
		"action":                {"action", "movement", "subject_action", "direction"},
		"camera":                {"camera", "camera_move", "camera_movement", "camera_direction"},
		"copy":                  {"copy", "caption", "meaning", "edit_meaning"},
		"image_prompt":          {"image_prompt", "visual_prompt", "image", "visual"},
		"video_prompt":          {"video_prompt", "motion_prompt", "movement_prompt"},
		"sound_cue":             {"sound_cue", "sound", "sfx", "audio_cue"},
		"vfx_cue":               {"vfx_cue", "vfx", "effect"},
		"field_coupling_reason": {"field_coupling_reason", "reason", "why"},
		"shot_diversity_reason": {"shot_diversity_reason", "diversity_reason"},
	}
	for canonical, keys := range aliases {
		if _, ok := cut[canonical]; ok {
			continue
		}
		for _, key := range keys {
			if value, exists := cut[key]; exists {
				cut[canonical] = value
				break
			}
		}
	}
	return cut
}

func scenarioSceneKeyOrder(key string) int {
	digits := strings.Builder{}
	for _, r := range key {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	if digits.Len() == 0 {
		return 1_000_000
	}
	if parsed, err := strconv.Atoi(digits.String()); err == nil {
		return parsed
	}
	return 1_000_000
}

func scenarioPlanParseErrorDetail(err error, raw string) string {
	if err == nil {
		return ""
	}
	if strings.TrimSpace(raw) == "" {
		return "AI 콘티 응답이 비어 있습니다. 글쓰기 모델이 빈 응답을 반환했습니다."
	}
	msg := err.Error()
	lower := strings.ToLower(msg)
	switch {
	case strings.Contains(lower, "unexpected end of json input") || strings.Contains(lower, "unexpected eof"):
		return "AI 콘티 JSON이 중간에 끊겼습니다. 응답이 너무 길거나 모델이 마지막 닫는 괄호까지 출력하지 못했습니다."
	case strings.Contains(lower, "invalid character"):
		return "AI 콘티 응답에 JSON 밖의 설명 문구가 섞였습니다. JSON 객체만 다시 생성해야 합니다."
	default:
		return "AI 콘티 JSON을 읽지 못했습니다: " + msg
	}
}

func cleanHyperframesScenarioMicroCuts(cuts []map[string]any) []map[string]any {
	if len(cuts) == 0 {
		return nil
	}
	cleaned := make([]map[string]any, 0, len(cuts))
	for _, cut := range cuts {
		if len(cut) == 0 {
			continue
		}
		item := make(map[string]any, len(cut))
		for key, value := range cut {
			switch typed := value.(type) {
			case string:
				if clean := cleanNarrationLine(typed); clean != "" {
					item[key] = clean
				}
			default:
				item[key] = value
			}
		}
		if len(item) > 0 {
			cleaned = append(cleaned, item)
		}
	}
	return cleaned
}

func scenarioSceneHasContent(scene hyperframesScenarioScene) bool {
	return strings.TrimSpace(strings.Join([]string{
		scene.Title,
		scene.Body,
		scene.Narration,
		scene.Role,
		scene.VisualMode,
		scene.CutPlan,
		scene.ImagePrompt,
		scene.ShotType,
		scene.SubjectAction,
		scene.Camera,
		scene.ArtDirection,
	}, " ")) != ""
}

func scenarioScenesMissingSurfaceFields(scenes []hyperframesScenarioScene, sceneCount int, req hyperframesScenarioPlanRequest) []string {
	missing := []string{}
	requiredMicroCuts := requiredScenarioMicroCutCount(req)
	if len(scenes) != sceneCount {
		missing = append(missing, fmt.Sprintf("scene count %d/%d", len(scenes), sceneCount))
	}
	limit := len(scenes)
	if limit > sceneCount {
		limit = sceneCount
	}
	for i := 0; i < limit; i++ {
		fields := []string{}
		if strings.TrimSpace(scenes[i].Title) == "" {
			fields = append(fields, "title")
		}
		if strings.TrimSpace(scenes[i].Body) == "" {
			fields = append(fields, "body")
		}
		if strings.TrimSpace(scenes[i].Narration) == "" {
			fields = append(fields, "narration")
		}
		if strings.TrimSpace(scenes[i].ImagePrompt) == "" {
			fields = append(fields, "image_prompt")
		}
		if len(scenes[i].MicroCuts) < requiredMicroCuts {
			fields = append(fields, "micro_cuts")
		}
		if len(fields) > 0 {
			missing = append(missing, fmt.Sprintf("scene %d missing %s", i+1, strings.Join(fields, ",")))
		}
	}
	return missing
}

func normalizeHyperframesScenarioScenes(scenes []hyperframesScenarioScene, req hyperframesScenarioPlanRequest, sceneCount int) []hyperframesScenarioScene {
	scenes = pickScenarioScenesForRequestedCount(scenes, sceneCount)
	cta := strings.TrimSpace(req.CTA)
	for i := range scenes {
		if i < len(scenes)-1 && cta != "" {
			scenes[i].Title = removeExactCTAFragments(scenes[i].Title, cta)
			scenes[i].Body = removeExactCTAFragments(scenes[i].Body, cta)
			scenes[i].Narration = removeExactCTAFragments(scenes[i].Narration, cta)
			filtered := make([]string, 0, len(scenes[i].Emphasis))
			for _, item := range scenes[i].Emphasis {
				if clean := removeExactCTAFragments(item, cta); clean != "" {
					filtered = append(filtered, clean)
				}
			}
			scenes[i].Emphasis = filtered
		}
		if scenes[i].Narration == "" {
			scenes[i].Narration = strings.Join(compactTextItems([]string{scenes[i].Title, scenes[i].Body}, 2, 120), ". ")
		}
		if strings.TrimSpace(scenes[i].Body) == "" {
			scenes[i].Body = buildScenarioBodyFromProductionFields(scenes[i], req)
		}
		if strings.TrimSpace(scenes[i].Title) == "" {
			scenes[i].Title = buildScenarioTitleFromProductionFields(scenes[i], i)
		}
		if strings.TrimSpace(scenes[i].OverlaySlogan) == "" {
			sloganSource := strings.TrimSpace(scenes[i].Title)
			if sloganSource == "" {
				sloganSource = strings.TrimSpace(scenes[i].Body)
			}
			if sloganSource == "" {
				sloganSource = strings.TrimSpace(scenes[i].Role)
			}
			if sloganSource == "" {
				sloganSource = "멈추는 순간"
			}
			scenes[i].OverlaySlogan = truncate(sloganSource, 36)
		}
		if strings.TrimSpace(scenes[i].SloganMotion) == "" {
			sloganMotion := strings.TrimSpace(scenes[i].EditBeat)
			if sloganMotion == "" {
				sloganMotion = strings.TrimSpace(scenes[i].Transition)
			}
			if sloganMotion == "" {
				sloganMotion = "spark snap"
			}
			scenes[i].SloganMotion = sloganMotion
		}
		if scenes[i].Narration == "" {
			scenes[i].Narration = strings.Join(compactTextItems([]string{scenes[i].Title, scenes[i].Body}, 2, 120), ". ")
		}
		if strings.TrimSpace(scenes[i].ImagePrompt) == "" {
			scenes[i].ImagePrompt = buildScenarioImagePromptFromProductionFields(scenes[i], req)
		}
		scenes[i].ImagePrompt = enforceNoTextImagePrompt(scenes[i].ImagePrompt)
		if strings.TrimSpace(scenes[i].VisualMode) == "" {
			scenes[i].VisualMode = "ai_directed"
		}
		if strings.TrimSpace(scenes[i].CutPlan) == "" {
			scenes[i].CutPlan = "AI가 이 씬의 메시지와 이미지에 맞춰 카메라, 전환, 텍스트 타이밍을 자연스럽게 설계"
		}
		if strings.TrimSpace(scenes[i].ShotType) == "" {
			scenes[i].ShotType = "medium cinematic advertising shot"
		}
		if strings.TrimSpace(scenes[i].SubjectAction) == "" {
			scenes[i].SubjectAction = "피사체가 씬 메시지를 보여주는 구체적인 행동을 수행"
		}
		if strings.TrimSpace(scenes[i].Camera) == "" {
			scenes[i].Camera = "안정적인 프레이밍에서 느린 push-in 또는 subtle pan"
		}
		if strings.TrimSpace(scenes[i].Lens) == "" {
			scenes[i].Lens = "광고 촬영용 얕은 심도와 자연스러운 초점 이동"
		}
		if strings.TrimSpace(scenes[i].Lighting) == "" {
			scenes[i].Lighting = "브랜드 톤에 맞춘 방향성 있는 소프트 라이트"
		}
		if strings.TrimSpace(scenes[i].ArtDirection) == "" {
			scenes[i].ArtDirection = "브랜드 색감과 실제 자료 맥락을 반영한 공간/소품 미술"
		}
		if strings.TrimSpace(scenes[i].Composition) == "" {
			scenes[i].Composition = "핵심 피사체와 텍스트 안전 여백이 분리된 구도"
		}
		if strings.TrimSpace(scenes[i].Transition) == "" {
			scenes[i].Transition = "이전/다음 씬과 색감과 움직임이 이어지는 soft transition"
		}
		if strings.TrimSpace(scenes[i].SoundCue) == "" {
			scenes[i].SoundCue = "나레이션 핵심어와 BGM 에너지 변화가 만나는 짧은 큐"
		}
		if strings.TrimSpace(scenes[i].EditBeat) == "" {
			scenes[i].EditBeat = "문장 호흡에 맞춘 hold, reveal, cut 비트"
		}
		if strings.TrimSpace(scenes[i].NegativeConstraints) == "" {
			scenes[i].NegativeConstraints = "텍스트/로고/워터마크/무관한 인물/다른 브랜드 무드 금지"
		}
		scenes[i].MicroCuts = ensureHyperframesScenarioMicroCuts(scenes[i])
	}
	return scenes
}

func ensureHyperframesScenarioMicroCuts(scene hyperframesScenarioScene) []map[string]any {
	cuts := cleanHyperframesScenarioMicroCuts(scene.MicroCuts)
	for len(cuts) < 5 {
		index := len(cuts)
		role := []string{"hook", "product", "proof", "peak", "transition"}[index]
		importance := []int{95, 78, 82, 88, 74}[index]
		title := []string{"첫 장면 훅", "문제 압축", "증거 디테일", "감정 피크", "전환 연결"}[index]
		actionSource := firstNonEmpty(scene.SubjectAction, scene.CutPlan, scene.Body, scene.Title)
		cameraSource := firstNonEmpty(scene.Camera, scene.ShotType, "cinematic commercial camera move")
		imagePrompt := firstNonEmpty(scene.ImagePrompt, buildScenarioImagePromptFromProductionFields(scene, hyperframesScenarioPlanRequest{}))
		cuts = append(cuts, map[string]any{
			"title":                 title,
			"action":                actionSource,
			"camera":                cameraSource,
			"copy":                  firstNonEmpty(scene.OverlaySlogan, scene.Title),
			"overlay_slogan":        firstNonEmpty(scene.OverlaySlogan, scene.Title),
			"slogan_motion":         firstNonEmpty(scene.SloganMotion, scene.EditBeat, "spark snap"),
			"sound_cue":             firstNonEmpty(scene.SoundCue, scene.EditBeat, "motion accent"),
			"vfx_preset":            firstNonEmpty(scene.VisualMode, "cinematic-light"),
			"vfx_cue":               firstNonEmpty(scene.Transition, "light sweep"),
			"role":                  role,
			"importance":            importance,
			"selected_priority":     importance,
			"field_coupling_score":  importance,
			"creative_mass":         importance - 8,
			"field_coupling_reason": firstNonEmpty(scene.Role, scene.Body, scene.Title),
			"shot_diversity_reason": firstNonEmpty(scene.ShotType, scene.Camera, scene.Composition),
			"image_prompt":          imagePrompt,
			"video_prompt":          strings.Join(compactTextItems([]string{scene.CutPlan, scene.SubjectAction, scene.Camera, scene.Transition}, 4, 160), " / "),
		})
	}
	return cuts
}

func pickScenarioScenesForRequestedCount(scenes []hyperframesScenarioScene, sceneCount int) []hyperframesScenarioScene {
	if sceneCount <= 0 || len(scenes) <= sceneCount {
		return scenes
	}
	if sceneCount == 1 {
		return scenes[:1]
	}
	picked := make([]hyperframesScenarioScene, 0, sceneCount)
	picked = append(picked, scenes[0])
	if sceneCount > 2 {
		lastMiddleIndex := len(scenes) - 2
		for i := 1; i < sceneCount-1; i++ {
			sourceIndex := 1 + int(math.Round(float64(i-1)*float64(lastMiddleIndex)/float64(sceneCount-2)))
			if sourceIndex >= len(scenes)-1 {
				sourceIndex = len(scenes) - 2
			}
			picked = append(picked, scenes[sourceIndex])
		}
	}
	picked = append(picked, scenes[len(scenes)-1])
	return picked
}

func buildScenarioTitleFromProductionFields(scene hyperframesScenarioScene, index int) string {
	candidates := compactTextItems([]string{
		scene.Role,
		scene.VisualMode,
		scene.SubjectAction,
		scene.CutPlan,
	}, 4, 80)
	for _, candidate := range candidates {
		words := []rune(strings.TrimSpace(candidate))
		if len(words) > 22 {
			return string(words[:22])
		}
		if len(words) >= 4 {
			return string(words)
		}
	}
	return fmt.Sprintf("장면 %d 핵심 메시지", index+1)
}

func buildScenarioBodyFromProductionFields(scene hyperframesScenarioScene, req hyperframesScenarioPlanRequest) string {
	candidates := compactTextItems([]string{
		scene.Narration,
		scene.SubjectAction,
		scene.CutPlan,
		scene.ArtDirection,
		scene.Composition,
		req.Objective,
		req.Source,
	}, 7, 180)
	for _, candidate := range candidates {
		clean := strings.TrimSpace(candidate)
		if clean == "" {
			continue
		}
		runes := []rune(clean)
		if len(runes) > 45 {
			return string(runes[:45])
		}
		return clean
	}
	return "자료와 브랜드 규칙을 반영한 장면 메시지입니다."
}

func buildScenarioImagePromptFromProductionFields(scene hyperframesScenarioScene, req hyperframesScenarioPlanRequest) string {
	lines := compactTextItems([]string{
		scene.Title,
		scene.Body,
		scene.Role,
		scene.VisualMode,
		scene.ShotType,
		scene.SubjectAction,
		scene.Camera,
		scene.Lens,
		scene.Lighting,
		scene.ArtDirection,
		scene.PropsWardrobe,
		scene.Composition,
		req.Tone,
		req.Source,
	}, 14, 420)
	prompt := strings.Join(lines, ". ")
	if strings.TrimSpace(prompt) == "" {
		prompt = "브랜드 색감과 자료 맥락을 반영한 16:9 광고 배경 이미지, 텍스트를 올릴 여백이 있는 구성"
	}
	return prompt
}

func enforceNoTextImagePrompt(prompt string) string {
	clean := strings.TrimSpace(prompt)
	if clean == "" {
		return clean
	}
	if !regexp.MustCompile(`(?i)(텍스트|글자|문구|로고|watermark|no text|without text)`).MatchString(clean) {
		clean += ", 이미지 안 글자/숫자/UI 문구/로고/워터마크 금지, 노트북/스마트폰/화상회의 화면 속 이름표와 채팅 문구도 금지"
	}
	if regexp.MustCompile(`(?i)(app ui|screen|dashboard|interface|앱 UI|화면|대시보드|인터페이스)`).MatchString(clean) &&
		!regexp.MustCompile(`(?i)(텍스트 없는|textless|no text)`).MatchString(clean) {
		clean += ", 화면 속 UI가 필요하면 텍스트 없는 추상 인터페이스 블록과 와이어프레임으로만 표현, 읽히는 글자처럼 보이는 글리프도 실패"
	}
	return clean
}

func removeExactCTAFragments(text string, cta string) string {
	out := strings.TrimSpace(text)
	if out == "" || strings.TrimSpace(cta) == "" {
		return out
	}
	parts := regexp.MustCompile(`[·|/,\n]+`).Split(cta, -1)
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if len([]rune(part)) < 2 {
			continue
		}
		out = regexp.MustCompile(`(?i)`+regexp.QuoteMeta(part)).ReplaceAllString(out, " ")
	}
	out = regexp.MustCompile(`\s+`).ReplaceAllString(out, " ")
	return strings.TrimSpace(strings.Trim(out, " ·ㆍ|/,.，。"))
}

func compactTextItems(items []string, limit int, maxLen int) []string {
	result := make([]string, 0, limit)
	seen := map[string]bool{}
	for _, item := range items {
		text := strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(item, " "))
		if text == "" {
			continue
		}
		if len([]rune(text)) > maxLen {
			text = string([]rune(text)[:maxLen])
		}
		key := strings.ToLower(text)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, text)
		if len(result) >= limit {
			break
		}
	}
	return result
}

func compactNarrationItems(items []string, limit int, maxLen int) []string {
	cleaned := make([]string, 0, len(items))
	for _, item := range items {
		text := cleanNarrationLine(item)
		if text == "" {
			continue
		}
		cleaned = append(cleaned, text)
	}
	return compactTextItems(cleaned, limit, maxLen)
}

func cleanNarrationTopic(raw string, source string) string {
	sourceText := cleanNarrationSource(source)
	if strings.Contains(sourceText, "마케케") {
		return "마케케"
	}
	text := normalizeNarrationSpace(raw)
	text = regexp.MustCompile(`(?i)\bCTA\b\s*[:：]?\s*`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`(?i)자료\s*기반\s*[·,:\-]?\s*`).ReplaceAllString(text, " ")
	parts := regexp.MustCompile(`[·,|/]+`).Split(text, -1)
	for _, part := range parts {
		clean := cleanNarrationLine(part)
		if clean == "" || isNarrationMetaLine(clean) {
			continue
		}
		runes := []rune(clean)
		if len(runes) > 28 {
			clean = string(runes[:28])
		}
		return strings.TrimSpace(clean)
	}
	return cleanNarrationLine(text)
}

func cleanNarrationSource(source string) string {
	lines := regexp.MustCompile(`[\r\n]+`).Split(source, -1)
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		clean := cleanNarrationLine(line)
		if clean == "" || isNarrationMetaLine(clean) {
			continue
		}
		out = append(out, clean)
	}
	if len(out) == 0 {
		return cleanNarrationLine(source)
	}
	return strings.Join(out, "\n")
}

func cleanNarrationLine(value string) string {
	text := normalizeNarrationSpace(value)
	if text == "" {
		return ""
	}
	text = regexp.MustCompile(`https?://\S+`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`(?i)\bCTA\b\s*[:：]?\s*`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`(?i)자료\s*기반\s*[·,:\-]?\s*`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`(?i)(광고\s*전환|인지도|후기\s*/\s*신뢰|직설\s*톤|감성\s*톤|프리미엄\s*톤|트렌디\s*톤|모션\s*광고)`).ReplaceAllString(text, " ")
	text = normalizeNarrationSpace(text)
	text = strings.Trim(text, "·,|/- ")
	if isNarrationMetaLine(text) {
		return ""
	}
	return text
}

func normalizeNarrationSpace(value string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(value, " "))
}

func isNarrationMetaLine(text string) bool {
	clean := strings.ToLower(normalizeNarrationSpace(text))
	if clean == "" {
		return true
	}
	metaPatterns := []string{
		`^9:16$`, `^16:9$`, `^1:1$`, `^\d+\s*초$`, `^\d+\s*분$`,
		`^(광고\s*전환|직설|감성|프리미엄|트렌디|후기\s*/\s*신뢰)$`,
		`^(상담\s*문의|문의|예약|신청)$`,
		`^(hook|pain|problem|source|script|visual|audio|flow|proof|impact|render|action)$`,
	}
	for _, pattern := range metaPatterns {
		if regexp.MustCompile(pattern).MatchString(clean) {
			return true
		}
	}
	return strings.Contains(clean, "data-composition-id") ||
		strings.Contains(clean, "hyperframes") ||
		strings.Contains(clean, "data-start") ||
		strings.Contains(clean, "톤,") ||
		strings.Contains(clean, "cta")
}

func sanitizeNarrationScript(script string) string {
	lines := splitNarrationLines(script)
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		clean := cleanNarrationLine(line)
		if clean == "" || isNarrationMetaLine(clean) {
			continue
		}
		clean = localizeNarrationPronunciation(clean)
		out = append(out, clean)
	}
	return strings.Join(out, "\n")
}

func localizeNarrationPronunciation(value string) string {
	text := value
	replacements := []struct {
		pattern string
		repl    string
	}{
		{`(?i)makeke\.kr`, `마케케 닷 케이알`},
		{`(?i)makeke`, `마케케`},
		{`(?i)\bAI가\b`, `인공지능이`},
		{`(?i)\bAI는\b`, `인공지능은`},
		{`(?i)\bAI를\b`, `인공지능을`},
		{`(?i)\bAI로\b`, `인공지능으로`},
		{`(?i)\bURL\b`, `주소`},
		{`(?i)\bSNS\b`, `소셜 미디어`},
		{`(?i)\bBGM\b`, `배경음악`},
		{`(?i)\bCTA\b`, `행동 유도 문구`},
		{`(?i)\bTTS\b`, `음성 합성`},
		{`(?i)\bAI\b`, `인공지능`},
		{`(?i)\bMP4\b`, `엠피포`},
		{`(?i)\bHTML\b`, `에이치티엠엘`},
		{`(?i)\bGSAP\b`, `지에스에이피`},
		{`(?i)\bAPI\b`, `에이피아이`},
		{`(?i)\bCLI\b`, `씨엘아이`},
		{`(?i)\bHyperFrames\b`, `하이퍼프레임`},
		{`(?i)\bMotionFrames\b`, `모션 프레임`},
		{`(?i)\bGemini\b`, `제미나이`},
		{`(?i)\bAtlas\s*Cloud\b`, `아틀라스 클라우드`},
		{`(?i)\bAtlas\b`, `아틀라스`},
		{`(?i)\bCodex\b`, `코덱스`},
		{`(?i)\bKimi\b`, `키미`},
		{`(?i)\bClaude\b`, `클로드`},
		{`(?i)\bDeepSeek\b`, `딥시크`},
		{`(?i)\bQwen\b`, `큐원`},
		{`(?i)\bGoogle\b`, `구글`},
		{`(?i)\bNaver\b`, `네이버`},
		{`(?i)\bInstagram\b`, `인스타그램`},
		{`(?i)\bFacebook\b`, `페이스북`},
		{`(?i)\bTikTok\b`, `틱톡`},
		{`(?i)\bYouTube\b`, `유튜브`},
		{`(?i)\bmarketing\b`, `마케팅`},
		{`(?i)\bbrand\b`, `브랜드`},
		{`(?i)\bdata\b`, `데이터`},
		{`(?i)\btargeting\b`, `타겟팅`},
		{`(?i)\btarget\b`, `타겟`},
		{`(?i)\bconversion\b`, `전환`},
		{`(?i)\bperformance\b`, `성과`},
		{`(?i)\bcampaign\b`, `캠페인`},
		{`(?i)\bkeyword\b`, `키워드`},
		{`(?i)\bclick\b`, `클릭`},
		{`(?i)\blead\b`, `리드`},
		{`(?i)\bsales\b`, `매출`},
		{`(?i)\bROAS\b`, `로아스`},
		{`(?i)\bCTR\b`, `씨티알`},
		{`(?i)\bCPA\b`, `씨피에이`},
		{`(?i)\bCPC\b`, `씨피씨`},
		{`(?i)\bROI\b`, `알오아이`},
		{`(?i)\bKPI\b`, `케이피아이`},
		{`(?i)\bCRM\b`, `씨알엠`},
	}
	for _, item := range replacements {
		text = regexp.MustCompile(item.pattern).ReplaceAllString(text, item.repl)
	}
	text = regexp.MustCompile(`([A-Za-z0-9._%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})`).ReplaceAllString(text, `이메일 주소`)
	text = regexp.MustCompile(`\b[A-Za-z][A-Za-z0-9._-]*\.(?:com|net|org|co\.kr|kr)\b`).ReplaceAllStringFunc(text, func(match string) string {
		return strings.NewReplacer(
			".co.kr", " 닷 씨오 닷 케이알",
			".com", " 닷 컴",
			".net", " 닷 넷",
			".org", " 닷 오알지",
			".kr", " 닷 케이알",
			"-", " ",
			"_", " ",
		).Replace(strings.ToLower(match))
	})
	text = regexp.MustCompile(`\b[A-Za-z]{2,}\b`).ReplaceAllStringFunc(text, spellLatinForKorean)
	text = strings.NewReplacer(
		"인공지능가", "인공지능이",
		"인공지능를", "인공지능을",
		"인공지능로", "인공지능으로",
		"주소이나", "주소나",
		"주소 이나", "주소나",
		"주소이나요", "주소나요",
		"와 ,", "와",
		"과 ,", "과",
		"은 ,", "은",
		"는 ,", "는",
		"을 ,", "을",
		"를 ,", "를",
		" ,", ",",
		", ,", ",",
	).Replace(text)
	return normalizeNarrationSpace(text)
}

func spellLatinForKorean(value string) string {
	replacer := strings.NewReplacer(
		"a", "에이",
		"b", "비",
		"c", "씨",
		"d", "디",
		"e", "이",
		"f", "에프",
		"g", "지",
		"h", "에이치",
		"i", "아이",
		"j", "제이",
		"k", "케이",
		"l", "엘",
		"m", "엠",
		"n", "엔",
		"o", "오",
		"p", "피",
		"q", "큐",
		"r", "알",
		"s", "에스",
		"t", "티",
		"u", "유",
		"v", "브이",
		"w", "더블유",
		"x", "엑스",
		"y", "와이",
		"z", "제트",
	)
	return replacer.Replace(strings.ToLower(value))
}

func cleanNarrationScript(text string) string {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)
	cleaned = regexp.MustCompile(`(?i)^나레이션\s*[:：]\s*`).ReplaceAllString(cleaned, "")
	return strings.TrimSpace(cleaned)
}

func fallbackHyperframesNarrationScript(req hyperframesNarrationScriptRequest, sceneTexts []string, keyPoints []string) string {
	topic := cleanNarrationTopic(req.Topic, req.Source)
	if topic == "" {
		topic = "이 서비스"
	}
	cta := strings.TrimSpace(req.CTA)
	if cta == "" {
		cta = "지금 확인해보세요"
	}
	if topic == "마케케" {
		return strings.Join([]string{
			"콘텐츠를 꾸준히 만들어야 하는데, 자료 찾기부터 글쓰기와 영상 제작까지 매번 따로 처리하고 있다면 시간이 빠르게 사라집니다.",
			"마케케는 블로그, 카드뉴스, SNS, 영상 콘텐츠를 하나의 흐름에서 만들도록 돕는 마케팅 자동화 앱입니다.",
			"URL이나 참고 자료를 넣으면 핵심 메시지를 정리하고, 브랜드 톤에 맞는 장면 구성과 문장을 이어서 준비합니다.",
			"영상 제작에서는 장면 흐름, 나레이션 대본, 배경음악, 렌더링까지 한 번에 연결해 반복 작업을 줄입니다.",
			"특히 렌더 전에 나레이션 길이와 CTA, 오디오 구성을 먼저 확인해 어색한 결과가 그대로 나가지 않도록 막습니다.",
			"작은 팀도 매번 처음부터 고민하지 않고, 캠페인에 맞는 콘텐츠 자산을 더 빠르게 쌓을 수 있습니다.",
			"콘텐츠 제작과 운영을 한 화면에서 정리하고 싶다면, 상담 문의 마케케 닷 케이알에서 마케케를 확인해보세요.",
		}, "\n")
	}
	point := ""
	if len(keyPoints) > 0 {
		point = keyPoints[0]
	} else if len(sceneTexts) > 0 {
		point = sceneTexts[0]
	}
	if point == "" {
		point = "필요한 결정을 더 빠르고 쉽게 만들 수 있습니다"
	}
	return strings.Join([]string{
		fmt.Sprintf("%s은 지금 필요한 선택을 더 명확하게 만들어줍니다.", topic),
		fmt.Sprintf("복잡한 정보는 줄이고, %s.", strings.TrimSuffix(point, ".")),
		"망설이던 고객이 바로 이해하고 행동할 수 있도록 핵심만 전달합니다.",
		cta + ".",
	}, "\n")
}

func expandNarrationScriptForDuration(req hyperframesNarrationScriptRequest, script string, sceneTexts []string, keyPoints []string) string {
	target := req.Duration
	if target <= 0 {
		target = 15
	}
	if target < 25 {
		return strings.Join(splitNarrationLines(script), "\n")
	}
	minDuration := target * 0.88
	if target <= 45 {
		minDuration = target * 0.84
	}
	lines := splitNarrationLines(script)
	if estimateNarrationDuration(strings.Join(lines, "\n")) >= minDuration {
		return strings.Join(lines, "\n")
	}
	topic := cleanNarrationTopic(req.Topic, req.Source)
	if topic == "" {
		topic = "이 서비스"
	}
	cta := strings.TrimSpace(req.CTA)
	if cta == "" {
		cta = "지금 확인해보세요"
	}
	candidates := []string{
		fmt.Sprintf("%s는 흩어진 콘텐츠 제작 과정을 하나의 흐름으로 묶어줍니다.", topic),
		"먼저 트렌드와 참고 자료를 정리하고, 그 안에서 고객이 바로 이해할 핵심 메시지를 골라냅니다.",
		"그 다음 블로그, 카드뉴스, SNS, 영상에 맞는 문장과 화면 구성을 이어서 만듭니다.",
		"브랜드 프로필에 저장된 말투와 색상, 콘텐츠 목적을 반영해 결과물의 방향이 흔들리지 않게 돕습니다.",
		"반복되는 자료 수집과 초안 작성 시간을 줄이면, 작은 팀도 더 꾸준하게 마케팅을 운영할 수 있습니다.",
		"필요한 순간에는 자동 발행 준비까지 이어져 제작과 운영 사이의 빈틈을 줄입니다.",
		"복잡한 작업은 뒤로 숨기고, 시청자에게는 이해하기 쉬운 한 가지 메시지만 남깁니다.",
		fmt.Sprintf("지금 필요한 콘텐츠 제작 흐름을 정리하고 싶다면, %s.", strings.TrimSuffix(cta, ".")),
	}
	for _, point := range append(keyPoints, sceneTexts...) {
		if strings.TrimSpace(point) == "" {
			continue
		}
		candidates = append(candidates, fmt.Sprintf("특히 %s 같은 핵심 포인트를 놓치지 않고 영상 흐름 안에 배치합니다.", strings.TrimSuffix(point, ".")))
	}
	for _, line := range candidates {
		clean := strings.TrimSpace(line)
		if clean == "" || containsTextLine(lines, clean) {
			continue
		}
		lines = append(lines, clean)
		if estimateNarrationDuration(strings.Join(lines, "\n")) >= minDuration {
			break
		}
	}
	return strings.Join(lines, "\n")
}

func fitNarrationScriptToDuration(req hyperframesNarrationScriptRequest, script string) string {
	target := req.Duration
	if target <= 0 {
		target = 15
	}
	maxDuration := target * 0.98
	minDuration := target * 0.84
	if target <= 20 {
		maxDuration = target * 0.84
		minDuration = target * 0.48
	} else if target <= 45 {
		maxDuration = target * 0.96
		minDuration = target * 0.78
	}
	lines := splitNarrationLines(script)
	for len(lines) > 1 && estimateNarrationDuration(strings.Join(lines, "\n")) > maxDuration {
		next := lines[:len(lines)-1]
		if estimateNarrationDuration(strings.Join(next, "\n")) < minDuration {
			break
		}
		lines = next
	}
	out := strings.Join(lines, "\n")
	if estimateNarrationDuration(out) <= maxDuration {
		return out
	}
	maxRunes := int(math.Floor((maxDuration - 1.5) / 0.14))
	if maxRunes < 24 {
		maxRunes = 24
	}
	runes := []rune(out)
	if len(runes) <= maxRunes {
		return out
	}
	trimmed := string(runes[:maxRunes])
	if cut := strings.LastIndexAny(trimmed, ".!?。！？"); cut >= 0 && len([]rune(trimmed[:cut])) > maxRunes/2 {
		trimmed = trimmed[:cut+1]
	}
	return strings.TrimSpace(trimmed)
}

func splitNarrationLines(script string) []string {
	parts := regexp.MustCompile(`[\r\n]+`).Split(strings.TrimSpace(script), -1)
	lines := make([]string, 0, len(parts))
	for _, part := range parts {
		clean := strings.TrimSpace(part)
		if clean != "" {
			lines = append(lines, clean)
		}
	}
	return lines
}

func containsTextLine(lines []string, target string) bool {
	needle := strings.ToLower(strings.TrimSpace(target))
	for _, line := range lines {
		if strings.ToLower(strings.TrimSpace(line)) == needle {
			return true
		}
	}
	return false
}

func fallbackHTTPText(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func (s *Server) handleHyperframesGenerateNarration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesNarrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "text is required"})
		return
	}
	audioDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "audio")
	if err := os.MkdirAll(audioDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create audio dir"})
		return
	}
	stem := fmt.Sprintf("narration-%d", time.Now().UnixNano())
	if geminiResult, ok := s.generateGeminiNarrationAudio(text, req.Voice, req.Model, audioDir, stem); ok {
		writeJSON(w, http.StatusOK, geminiResult)
		return
	}
	writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "gemini tts unavailable", "detail": "나레이션 음성은 Gemini TTS만 사용합니다. Gemini API 키 또는 TTS 모델 응답을 확인해주세요."})
}

func (s *Server) generateGeminiNarrationAudio(text, voice, modelOverride, audioDir, stem string) (map[string]any, bool) {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey == "" {
		return nil, false
	}
	model := strings.TrimSpace(modelOverride)
	if model == "" || model == "gemini-auto" {
		model = strings.TrimSpace(s.getSetting("MODELS.tts_model", s.getSetting("API.gemini_tts_model", "")))
	}
	if model == "" {
		model = "gemini-2.5-flash-preview-tts"
	}
	voiceName := geminiTTSVoiceName(voice)
	spokenText := localizeNarrationPronunciation(text)
	payload := map[string]any{
		"contents": []map[string]any{{
			"parts": []map[string]any{{
				"text": "다음 문장을 자연스러운 한국어 홍보 나레이션으로 읽어주세요. 영문 약어와 도메인은 한국어 발음으로 읽어주세요.\n\n" + spokenText,
			}},
		}},
		"generationConfig": map[string]any{
			"responseModalities": []string{"AUDIO"},
			"speechConfig": map[string]any{
				"voiceConfig": map[string]any{
					"prebuiltVoiceConfig": map[string]any{
						"voiceName": voiceName,
					},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", url.PathEscape(model), url.QueryEscape(apiKey))
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, false
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[hyperframes] Gemini TTS request failed: %v", err)
		return nil, false
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 24<<20))
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[hyperframes] Gemini TTS response failed: status=%d body=%s", resp.StatusCode, truncate(string(raw), 300))
		return nil, false
	}
	audioData, mimeType, err := extractGeminiInlineAudio(raw)
	if err != nil || len(audioData) == 0 {
		log.Printf("[hyperframes] Gemini TTS audio parse failed: %v", err)
		return nil, false
	}
	outputPath := filepath.Join(audioDir, stem+".wav")
	if strings.Contains(strings.ToLower(mimeType), "wav") {
		if err := os.WriteFile(outputPath, audioData, 0o644); err != nil {
			return nil, false
		}
	} else if err := writePCM16WAV(outputPath, audioData, sampleRateFromMime(mimeType)); err != nil {
		return nil, false
	}
	duration := estimateWAVDuration(outputPath, estimateNarrationDuration(text))
	return map[string]any{
		"ok":        true,
		"url":       "/api/hyperframes/audio/" + filepath.Base(outputPath),
		"path":      outputPath,
		"duration":  duration,
		"provider":  "gemini",
		"model":     model,
		"voiceName": voiceName,
	}, true
}

func (s *Server) handleHyperframesAudio(w http.ResponseWriter, r *http.Request) {
	filename := filepath.Base(strings.TrimPrefix(r.URL.Path, "/api/hyperframes/audio/"))
	if filename == "." || filename == "" {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(s.hyperframesDataDir(), "hyperframes", "audio", filename)
	if !fileExists(path) {
		http.NotFound(w, r)
		return
	}
	lower := strings.ToLower(filename)
	if strings.HasSuffix(lower, ".wav") {
		w.Header().Set("Content-Type", "audio/wav")
	} else if strings.HasSuffix(lower, ".mp3") {
		w.Header().Set("Content-Type", "audio/mpeg")
	} else {
		w.Header().Set("Content-Type", "audio/aiff")
	}
	http.ServeFile(w, r, path)
}

func (s *Server) materializeHyperframesAudioAssets(html string, projectDir string) string {
	audioDir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "audio")
	assetDir := filepath.Join(projectDir, "assets", "audio")
	re := regexp.MustCompile(`(?i)(src=["'])(?:https?://[^"']+)?/api/hyperframes/audio/([^"']+)(["'])`)
	return re.ReplaceAllStringFunc(html, func(match string) string {
		parts := re.FindStringSubmatch(match)
		if len(parts) != 4 {
			return match
		}
		filename := filepath.Base(parts[2])
		if filename == "." || filename == "" {
			return match
		}
		src := filepath.Join(audioDir, filename)
		if !fileExists(src) {
			return match
		}
		if err := os.MkdirAll(assetDir, 0o755); err != nil {
			return match
		}
		dst := filepath.Join(assetDir, filename)
		if err := copyFile(src, dst); err != nil {
			return match
		}
		return parts[1] + "assets/audio/" + filename + parts[3]
	})
}

func (s *Server) normalizeHyperframesMediaDurations(html string, projectDir string) string {
	re := regexp.MustCompile(`(?is)<(audio|video)\b[^>]*>`)
	return re.ReplaceAllStringFunc(html, func(tag string) string {
		src := hyperframesTagAttr(tag, "src")
		mediaPath := s.localHyperframesMediaPath(src, projectDir)
		if mediaPath == "" || !fileExists(mediaPath) {
			return tag
		}
		actual := estimateMediaFileDuration(mediaPath)
		if actual <= 0 {
			return tag
		}
		declared := 0.0
		if raw := hyperframesTagAttr(tag, "data-duration"); raw != "" {
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil {
				declared = parsed
			}
		}
		mediaStart := 0.0
		hasMediaStart := false
		if raw := hyperframesTagAttr(tag, "data-media-start"); raw != "" {
			hasMediaStart = true
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil && parsed > 0 {
				mediaStart = parsed
			}
		}
		playable := actual - mediaStart
		if playable <= 0 {
			playable = actual
		}
		if hasMediaStart && strings.HasPrefix(strings.ToLower(tag), "<audio") && declared > 0 && declared <= playable+0.2 {
			return tag
		}
		if declared > 0 && declared+0.12 >= playable {
			return tag
		}
		return setHyperframesTagAttr(tag, "data-duration", formatHyperframesDuration(playable))
	})
}

func (s *Server) normalizeHyperframesAudioDurations(html string, projectDir string) string {
	return s.normalizeHyperframesMediaDurations(html, projectDir)
}

func (s *Server) localHyperframesMediaPath(rawSrc string, projectDir string) string {
	value := strings.TrimSpace(rawSrc)
	if value == "" || strings.HasPrefix(strings.ToLower(value), "http://") || strings.HasPrefix(strings.ToLower(value), "https://") {
		return ""
	}
	if strings.HasPrefix(value, "/api/hyperframes/output/") {
		if path, ok := s.localPathForHyperframesOutputAsset(value); ok {
			return path
		}
	}
	if path := s.localHyperframesAudioPath(rawSrc, projectDir); path != "" && fileExists(path) {
		return path
	}
	value = strings.TrimPrefix(value, "./")
	if strings.HasPrefix(value, "assets/video/") {
		return filepath.Join(projectDir, filepath.FromSlash(value))
	}
	return filepath.Join(projectDir, filepath.FromSlash(value))
}

func (s *Server) localHyperframesAudioPath(rawSrc string, projectDir string) string {
	value := strings.TrimSpace(rawSrc)
	if value == "" || strings.HasPrefix(strings.ToLower(value), "http://") || strings.HasPrefix(strings.ToLower(value), "https://") {
		return ""
	}
	if strings.HasPrefix(value, "/api/hyperframes/audio/") {
		filename := filepath.Base(strings.TrimPrefix(value, "/api/hyperframes/audio/"))
		if filename == "." || filename == "" {
			return ""
		}
		return filepath.Join(s.hyperframesDataDir(), "hyperframes", "audio", filename)
	}
	value = strings.TrimPrefix(value, "./")
	if strings.HasPrefix(value, "assets/audio/") {
		return filepath.Join(projectDir, filepath.FromSlash(value))
	}
	if !strings.Contains(value, "/") && !strings.Contains(value, `\`) {
		return filepath.Join(projectDir, "assets", "audio", filepath.Base(value))
	}
	return filepath.Join(projectDir, filepath.FromSlash(value))
}

func (s *Server) materializeHyperframesImageAssets(html string, projectDir string) string {
	assetDir := filepath.Join(projectDir, "assets", "images")
	materialized := map[string]string{}
	materialize := func(rawPath string) (string, bool) {
		local, ok := s.localPathForHyperframesImageAsset(rawPath)
		if !ok || !fileExists(local) || !isHyperframesImageAssetExt(local) {
			return "", false
		}
		if cached := materialized[rawPath]; cached != "" {
			return cached, true
		}
		if err := os.MkdirAll(assetDir, 0o755); err != nil {
			return "", false
		}
		filename := uniqueAssetFilename(rawPath, local)
		dst := filepath.Join(assetDir, filename)
		if !fileExists(dst) {
			if err := copyFile(local, dst); err != nil {
				return "", false
			}
		}
		relative := "assets/images/" + filename
		materialized[rawPath] = relative
		return relative, true
	}
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(src=["'])(?:https?://[^"']+)?(/api/(?:hyperframes/output|library/image)/[^"']+)(["'])`),
		regexp.MustCompile(`(?i)(url\((?:["']|&quot;)?)(?:https?://[^"')&]+)?(/api/(?:hyperframes/output|library/image)/[^"')&]+)((?:["']|&quot;)?\))`),
		regexp.MustCompile(`(?i)(background\s*:\s*url\((?:["']|&quot;)?)(?:https?://[^"')&]+)?(/api/(?:hyperframes/output|library/image)/[^"')&]+)((?:["']|&quot;)?\)[^;"]*)`),
	}
	out := html
	for _, re := range patterns {
		out = re.ReplaceAllStringFunc(out, func(match string) string {
			parts := re.FindStringSubmatch(match)
			if len(parts) != 4 {
				return match
			}
			relative, ok := materialize(parts[2])
			if !ok {
				return match
			}
			return parts[1] + relative + parts[3]
		})
	}
	apiImagePath := regexp.MustCompile(`(?i)/api/(?:hyperframes/output|library/image)/[^"'<>)\s&]+`)
	out = apiImagePath.ReplaceAllStringFunc(out, func(match string) string {
		relative, ok := materialize(match)
		if !ok {
			return match
		}
		return relative
	})
	return normalizeHyperframesStyleTagURLQuotes(out)
}

func normalizeHyperframesStyleTagURLQuotes(html string) string {
	styleRe := regexp.MustCompile(`(?is)<style\b[^>]*>.*?</style>`)
	return styleRe.ReplaceAllStringFunc(html, func(styleBlock string) string {
		styleBlock = regexp.MustCompile(`(?i)url\(&quot;([^"()<>]+)&quot;\)`).ReplaceAllString(styleBlock, `url("$1")`)
		styleBlock = regexp.MustCompile(`(?i)url\(&#34;([^"()<>]+)&#34;\)`).ReplaceAllString(styleBlock, `url("$1")`)
		return styleBlock
	})
}

func (s *Server) materializeHyperframesVideoAssets(html string, projectDir string) string {
	assetDir := filepath.Join(projectDir, "assets", "video")
	materialized := map[string]string{}
	materialize := func(rawPath string) (string, bool) {
		local, ok := s.localPathForHyperframesOutputAsset(rawPath)
		if !ok || !fileExists(local) || !isHyperframesVideoAssetExt(local) {
			return "", false
		}
		if cached := materialized[rawPath]; cached != "" {
			return cached, true
		}
		if err := os.MkdirAll(assetDir, 0o755); err != nil {
			return "", false
		}
		filename := uniqueAssetFilename(rawPath, local)
		dst := filepath.Join(assetDir, filename)
		if !fileExists(dst) {
			if err := copyFile(local, dst); err != nil {
				return "", false
			}
		}
		relative := "assets/video/" + filename
		materialized[rawPath] = relative
		return relative, true
	}
	re := regexp.MustCompile(`(?i)(src=["'])(?:https?://[^"']+)?(/api/hyperframes/output/[^"']+\.(?:mp4|mov|webm|m4v))(["'])`)
	return re.ReplaceAllStringFunc(html, func(match string) string {
		parts := re.FindStringSubmatch(match)
		if len(parts) != 4 {
			return match
		}
		relative, ok := materialize(parts[2])
		if !ok {
			return match
		}
		return parts[1] + relative + parts[3]
	})
}

func (s *Server) localPathForHyperframesImageAsset(rawPath string) (string, bool) {
	value := strings.TrimSpace(rawPath)
	if value == "" {
		return "", false
	}
	if strings.HasPrefix(value, "/api/hyperframes/output/") {
		return s.localPathForHyperframesOutputAsset(value)
	}
	if strings.HasPrefix(value, "/api/library/image/") {
		rest := strings.TrimPrefix(value, "/api/library/image/")
		parts := strings.SplitN(rest, "/", 2)
		if len(parts) != 2 {
			return "", false
		}
		profileID := filepath.Clean(parts[0])
		relative, err := url.PathUnescape(parts[1])
		if err != nil {
			relative = parts[1]
		}
		relative = filepath.Clean(relative)
		base := filepath.Join(s.hyperframesDataDir(), "output", "library", profileID)
		target := filepath.Join(base, relative)
		if !strings.HasPrefix(target, base+string(os.PathSeparator)) && target != base {
			return "", false
		}
		return target, true
	}
	return "", false
}

func (s *Server) localPathForHyperframesOutputAsset(rawPath string) (string, bool) {
	value := strings.TrimSpace(rawPath)
	if !strings.HasPrefix(value, "/api/hyperframes/output/") {
		return "", false
	}
	filename, _ := url.PathUnescape(filepath.Base(strings.TrimPrefix(value, "/api/hyperframes/output/")))
	if filename == "." || filename == "" {
		return "", false
	}
	return filepath.Join(s.hyperframesDataDir(), "hyperframes", "outputs", filename), true
}

func uniqueAssetFilename(rawPath, localPath string) string {
	ext := strings.ToLower(filepath.Ext(localPath))
	if ext == "" {
		ext = ".png"
	}
	stem := sanitizeFilenamePart(strings.TrimSuffix(filepath.Base(localPath), filepath.Ext(localPath)))
	if stem == "" {
		stem = "asset"
	}
	sum := sha256.Sum256([]byte(rawPath))
	return fmt.Sprintf("%s-%x%s", stem, sum[:4], ext)
}

func isHyperframesImageAssetExt(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg":
		return true
	default:
		return false
	}
}

func isHyperframesVideoAssetExt(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".mp4", ".mov", ".webm", ".m4v":
		return true
	default:
		return false
	}
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Close()
}

func (s *Server) handleHyperframesSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req hyperframesSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	id := sanitizeHyperframesName(req.ID)
	if id == "" {
		id = fmt.Sprintf("studio-%d", time.Now().UnixNano())
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = id
	}
	dir := filepath.Join(s.hyperframesDataDir(), "hyperframes", "studio", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create studio dir"})
		return
	}
	if req.HTML != "" {
		html := normalizeHyperframesHTML(req.HTML, req.Duration)
		if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(html), 0o644); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to save html"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
		"item": map[string]any{
			"id":       id,
			"name":     name,
			"width":    req.Width,
			"height":   req.Height,
			"duration": req.Duration,
		},
	})
}

func normalizeHyperframesHTML(raw string, requestedDuration float64) string {
	html := strings.TrimSpace(raw)
	html = strings.ReplaceAll(html, `<\/script>`, `</script>`)
	html = strings.ReplaceAll(html, `<\\/script>`, `</script>`)
	duration := requestedDuration
	if duration <= 0 {
		duration = inferHyperframesDuration(html)
	}
	if duration <= 0 {
		duration = 8
	}
	zeroDurationRe := regexp.MustCompile(`data-duration=(["'])0(?:\.0+)?["']`)
	html = zeroDurationRe.ReplaceAllStringFunc(html, func(_ string) string {
		return `data-duration="` + formatHyperframesDuration(duration) + `"`
	})
	html = stripExternalHyperframesFontLoads(html)
	html = normalizeHyperframesFonts(html)
	html = ensureTimedMediaIDs(html)
	html = injectHyperframesFontFallback(html)
	html = injectHyperframesSeekAPI(html, duration)
	return html
}

func ensureTimedMediaIDs(html string) string {
	re := regexp.MustCompile(`(?is)<(audio|video)\b([^>]*)>`)
	counter := 0
	return re.ReplaceAllStringFunc(html, func(match string) string {
		lower := strings.ToLower(match)
		if strings.Contains(lower, " id=") || strings.Contains(lower, "\tid=") || strings.Contains(lower, "\nid=") {
			return match
		}
		if !strings.Contains(lower, "data-start=") {
			return match
		}
		parts := re.FindStringSubmatch(match)
		if len(parts) != 3 {
			return match
		}
		counter++
		id := fmt.Sprintf("hf-%s-%02d", strings.ToLower(parts[1]), counter)
		return "<" + parts[1] + ` id="` + id + `"` + parts[2] + ">"
	})
}

func hyperframesTagAttr(tag string, key string) string {
	re := regexp.MustCompile(`(?is)\b` + regexp.QuoteMeta(key) + `\s*=\s*["']([^"']*)["']`)
	parts := re.FindStringSubmatch(tag)
	if len(parts) < 2 {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func setHyperframesTagAttr(tag string, key string, value string) string {
	attr := key + `="` + escapeHyperframesAttr(value) + `"`
	re := regexp.MustCompile(`(?is)\b` + regexp.QuoteMeta(key) + `\s*=\s*["'][^"']*["']`)
	if re.MatchString(tag) {
		return re.ReplaceAllString(tag, attr)
	}
	idx := strings.LastIndex(tag, ">")
	if idx < 0 {
		return tag + " " + attr
	}
	return tag[:idx] + " " + attr + tag[idx:]
}

func escapeHyperframesAttr(value string) string {
	escaped := strings.ReplaceAll(value, "&", "&amp;")
	escaped = strings.ReplaceAll(escaped, `"`, "&quot;")
	return escaped
}

func stripExternalHyperframesFontLoads(html string) string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?is)<link[^>]+href=["'][^"']*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|pretendard|font)[^"']*["'][^>]*>`),
		regexp.MustCompile(`(?is)<link[^>]+rel=["']preconnect["'][^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>`),
		regexp.MustCompile(`(?is)@import\s+url\(["'][^"']*(?:fonts\.googleapis\.com|pretendard|font)[^"']*["']\)\s*;?`),
		regexp.MustCompile(`(?is)@font-face\s*\{[^}]*\}`),
	}
	for _, pattern := range patterns {
		html = pattern.ReplaceAllString(html, "")
	}
	html = regexp.MustCompile(`(?i)["']?Noto Sans KR["']?`).ReplaceAllString(html, "Arial")
	html = regexp.MustCompile(`(?i)["']?Pretendard["']?`).ReplaceAllString(html, "Arial")
	return html
}

func normalizeHyperframesFonts(html string) string {
	replacements := map[string]string{
		`"Apple SD Gothic Neo"`: `Arial`,
		`'Apple SD Gothic Neo'`: `Arial`,
		`Apple SD Gothic Neo`:   `Arial`,
		`"Malgun Gothic"`:       `Arial`,
		`'Malgun Gothic'`:       `Arial`,
		`Malgun Gothic`:         `Arial`,
		`"Pretendard"`:          `Arial`,
		`'Pretendard'`:          `Arial`,
		`Pretendard`:            `Arial`,
	}
	for old, next := range replacements {
		html = strings.ReplaceAll(html, old, next)
	}
	return html
}

func inferHyperframesDuration(html string) float64 {
	durationRe := regexp.MustCompile(`data-duration=(["'])([0-9]+(?:\.[0-9]+)?)["']`)
	matches := durationRe.FindAllStringSubmatch(html, -1)
	var maxDuration float64
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		var duration float64
		if _, err := fmt.Sscanf(match[2], "%f", &duration); err == nil && duration > maxDuration {
			maxDuration = duration
		}
	}
	tagRe := regexp.MustCompile(`(?is)<[^>]+data-duration=["'][0-9]+(?:\.[0-9]+)?["'][^>]*>`)
	for _, tag := range tagRe.FindAllString(html, -1) {
		rawDuration := hyperframesTagAttr(tag, "data-duration")
		duration, err := strconv.ParseFloat(strings.TrimSpace(rawDuration), 64)
		if err != nil || duration <= 0 {
			continue
		}
		start := 0.0
		if rawStart := hyperframesTagAttr(tag, "data-start"); rawStart != "" {
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(rawStart), 64); err == nil && parsed > 0 {
				start = parsed
			}
		}
		if end := start + duration; end > maxDuration {
			maxDuration = end
		}
	}
	return maxDuration
}

func setHyperframesCompositionDuration(html string, duration float64) string {
	if duration <= 0 {
		return html
	}
	re := regexp.MustCompile(`(?is)<div\b[^>]*data-composition-id=["'][^"']+["'][^>]*>`)
	replaced := false
	return re.ReplaceAllStringFunc(html, func(tag string) string {
		if replaced {
			return tag
		}
		replaced = true
		current := 0.0
		if raw := hyperframesTagAttr(tag, "data-duration"); raw != "" {
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil {
				current = parsed
			}
		}
		if current+0.12 >= duration {
			return tag
		}
		return setHyperframesTagAttr(tag, "data-duration", formatHyperframesDuration(duration))
	})
}

func formatHyperframesDuration(duration float64) string {
	if duration <= 0 {
		return "8"
	}
	if duration == float64(int(duration)) {
		return fmt.Sprintf("%d", int(duration))
	}
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.2f", duration), "0"), ".")
}

func injectHyperframesFontFallback(html string) string {
	if strings.Contains(html, "makeke-render-font-fallback") {
		return html
	}
	style := `<style id="makeke-render-font-fallback">` +
		`html,body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}` +
		`</style>`
	if strings.Contains(strings.ToLower(html), "</head>") {
		headCloseRe := regexp.MustCompile(`(?i)</head>`)
		return headCloseRe.ReplaceAllString(html, style+"</head>")
	}
	return style + html
}

func injectHyperframesSeekAPI(html string, duration float64) string {
	if strings.Contains(html, "window.__hf") {
		return html
	}
	if !strings.Contains(html, "window.__timelines") {
		return html
	}
	durationText := formatHyperframesDuration(duration)
	timelineID := inferHyperframesCompositionID(html)
	api := `window.__hf={duration:` + durationText + `,seek:function(t){var v=Number(t)||0;var tl=window.__timelines&&window.__timelines["` + timelineID + `"];if(tl&&tl.seek){tl.seek(Math.max(0,Math.min(` + durationText + `,v)),false);}}};`
	registration := `window.__timelines["` + timelineID + `"]=tl;`
	if strings.Contains(html, registration) {
		return strings.Replace(html, registration, registration+"\n"+api, 1)
	}
	scriptCloseRe := regexp.MustCompile(`(?i)</script>`)
	locs := scriptCloseRe.FindAllStringIndex(html, -1)
	if len(locs) == 0 {
		return html + "\n<script>" + api + "</script>"
	}
	last := locs[len(locs)-1]
	return html[:last[0]] + api + "\n" + html[last[0]:]
}

func inferHyperframesCompositionID(html string) string {
	idRe := regexp.MustCompile(`data-composition-id=["']([^"']+)["']`)
	if match := idRe.FindStringSubmatch(html); len(match) == 2 && strings.TrimSpace(match[1]) != "" {
		return strings.TrimSpace(match[1])
	}
	return "makeke-html-motion"
}

func (s *Server) handleHyperframesStudioProjectFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/hyperframes/studio-api/projects/")
	parts := strings.SplitN(rest, "/files/", 2)
	if len(parts) != 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid studio file path"})
		return
	}
	projectID := sanitizeHyperframesName(parts[0])
	rel := filepath.Clean(strings.ReplaceAll(parts[1], "\\", "/"))
	if projectID == "" || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
		return
	}
	data, readErr := io.ReadAll(io.LimitReader(r.Body, 20<<20))
	if readErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	path := filepath.Join(s.hyperframesDataDir(), "hyperframes", "studio", projectID, rel)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create dir"})
		return
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to write file"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "path": rel})
}

func (s *Server) handleHyperframesStudio(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>Makeke HyperFrames Studio</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1c1c1e;display:grid;place-items:center;height:100vh}.card{background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:18px;padding:28px;box-shadow:0 18px 48px rgba(0,0,0,.08);max-width:560px;line-height:1.7}.accent{color:#ff8c00;font-weight:900}</style></head><body><main class="card"><h1>HyperFrames Studio</h1><p><span class="accent">Go-native 로컬 Studio</span> 저장소가 준비되었습니다. 마케케 영상 에이전트에서 생성한 HTML은 로컬 프로젝트로 저장되고, MP4 렌더는 앱 내부 렌더 큐에서 처리됩니다.</p></main></body></html>`))
}

func updateJob(jobID string, fn func(*hyperframesRenderJob)) {
	hyperframesJobs.Lock()
	defer hyperframesJobs.Unlock()
	job := hyperframesJobs.items[jobID]
	if job == nil {
		return
	}
	fn(job)
	job.UpdatedAt = time.Now().Format(time.RFC3339)
	if len(job.Logs) > 200 {
		job.Logs = job.Logs[len(job.Logs)-200:]
	}
}

func (s *Server) hyperframesDataDir() string {
	if strings.TrimSpace(s.config.DataDir) != "" {
		return s.config.DataDir
	}
	if dir, err := os.UserConfigDir(); err == nil && strings.TrimSpace(dir) != "" {
		return filepath.Join(dir, "Makeke")
	}
	return filepath.Join(s.config.ProjectRoot, "data")
}

func (s *Server) hyperframesRenderWorkers() string {
	workers := strings.TrimSpace(s.getSetting("HYPERFRAMES.workers", ""))
	if workers == "" {
		workers = strings.TrimSpace(os.Getenv("MAKEKE_HYPERFRAMES_WORKERS"))
	}
	if workers == "" {
		return "2"
	}
	if strings.EqualFold(workers, "auto") {
		return "auto"
	}
	var parsed int
	if _, err := fmt.Sscanf(workers, "%d", &parsed); err != nil || parsed < 1 || parsed > 8 {
		return ""
	}
	return fmt.Sprintf("%d", parsed)
}

func failHyperframesJob(jobID string, err error) {
	msg := ""
	if err != nil {
		msg = err.Error()
	}
	updateJob(jobID, func(job *hyperframesRenderJob) {
		job.Status = "failed"
		job.Stage = "failed"
		job.Error = msg
		job.addLog("error", msg)
	})
	log.Printf("[hyperframes] render job %s failed: %s", jobID, msg)
}

func (j *hyperframesRenderJob) addLog(level, message string) {
	if isNoisyHyperframesLog(message) {
		return
	}
	j.Logs = append(j.Logs, hyperframesRenderLog{
		Level:   level,
		Message: message,
		Time:    time.Now().Format("15:04:05"),
	})
}

func sanitizeHyperframesName(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	re := regexp.MustCompile(`[^a-z0-9가-힣_-]+`)
	s = strings.Trim(re.ReplaceAllString(s, "-"), "-_")
	if len([]rune(s)) > 70 {
		s = string([]rune(s)[:70])
	}
	return s
}

func geminiTTSVoiceName(value string) string {
	raw := strings.ToLower(strings.TrimSpace(value))
	raw = strings.TrimPrefix(raw, "gemini-")
	voices := map[string]string{
		"kore":          "Kore",
		"zephyr":        "Zephyr",
		"puck":          "Puck",
		"charon":        "Charon",
		"fenrir":        "Fenrir",
		"leda":          "Leda",
		"orus":          "Orus",
		"aoede":         "Aoede",
		"callirrhoe":    "Callirrhoe",
		"autonoe":       "Autonoe",
		"enceladus":     "Enceladus",
		"iapetus":       "Iapetus",
		"umbriel":       "Umbriel",
		"algieba":       "Algieba",
		"despina":       "Despina",
		"erinome":       "Erinome",
		"algenib":       "Algenib",
		"rasalgethi":    "Rasalgethi",
		"laomedeia":     "Laomedeia",
		"achernar":      "Achernar",
		"alnilam":       "Alnilam",
		"schedar":       "Schedar",
		"gacrux":        "Gacrux",
		"pulcherrima":   "Pulcherrima",
		"achird":        "Achird",
		"zubenelgenubi": "Zubenelgenubi",
		"vindemiatrix":  "Vindemiatrix",
		"sadachbia":     "Sadachbia",
		"sadaltager":    "Sadaltager",
		"sulafat":       "Sulafat",
	}
	if raw == "" || raw == "ko" {
		return "Kore"
	}
	for key, name := range voices {
		if strings.Contains(raw, key) {
			return name
		}
	}
	return "Kore"
}

func extractGeminiInlineAudio(raw []byte) ([]byte, string, error) {
	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
					InlineDataSnake *struct {
						MimeType string `json:"mime_type"`
						Data     string `json:"data"`
					} `json:"inline_data"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, "", err
	}
	for _, candidate := range parsed.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && strings.TrimSpace(part.InlineData.Data) != "" {
				decoded, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
				if err != nil {
					return nil, "", err
				}
				return decoded, part.InlineData.MimeType, nil
			}
			if part.InlineDataSnake == nil || strings.TrimSpace(part.InlineDataSnake.Data) == "" {
				continue
			}
			decoded, err := base64.StdEncoding.DecodeString(part.InlineDataSnake.Data)
			if err != nil {
				return nil, "", err
			}
			return decoded, part.InlineDataSnake.MimeType, nil
		}
	}
	return nil, "", fmt.Errorf("Gemini 응답에 오디오 데이터가 없습니다")
}

func extractGeminiInlineImage(raw []byte) ([]byte, string, error) {
	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
					InlineDataSnake *struct {
						MimeType string `json:"mime_type"`
						Data     string `json:"data"`
					} `json:"inline_data"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, "", err
	}
	for _, candidate := range parsed.Candidates {
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && strings.HasPrefix(strings.ToLower(part.InlineData.MimeType), "image/") && strings.TrimSpace(part.InlineData.Data) != "" {
				decoded, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
				if err != nil {
					return nil, "", err
				}
				return decoded, part.InlineData.MimeType, nil
			}
			if part.InlineDataSnake == nil || !strings.HasPrefix(strings.ToLower(part.InlineDataSnake.MimeType), "image/") || strings.TrimSpace(part.InlineDataSnake.Data) == "" {
				continue
			}
			decoded, err := base64.StdEncoding.DecodeString(part.InlineDataSnake.Data)
			if err != nil {
				return nil, "", err
			}
			return decoded, part.InlineDataSnake.MimeType, nil
		}
	}
	return nil, "", fmt.Errorf("Gemini 응답에 이미지 데이터가 없습니다")
}

func imageExtensionFromMime(mimeType string) string {
	mime := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.Contains(mime, "jpeg"), strings.Contains(mime, "jpg"):
		return ".jpg"
	case strings.Contains(mime, "webp"):
		return ".webp"
	case strings.Contains(mime, "png"):
		return ".png"
	default:
		return ".png"
	}
}

func audioExtensionFromMime(mimeType string) string {
	mime := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.Contains(mime, "mpeg"), strings.Contains(mime, "mp3"):
		return ".mp3"
	case strings.Contains(mime, "wav"):
		return ".wav"
	case strings.Contains(mime, "aiff"), strings.Contains(mime, "aifc"):
		return ".aiff"
	default:
		return ".mp3"
	}
}

func sampleRateFromMime(mimeType string) int {
	re := regexp.MustCompile(`rate=(\d+)`)
	if match := re.FindStringSubmatch(mimeType); len(match) == 2 {
		var rate int
		if _, err := fmt.Sscanf(match[1], "%d", &rate); err == nil && rate > 0 {
			return rate
		}
	}
	return 24000
}

func writePCM16WAV(path string, pcm []byte, sampleRate int) error {
	if sampleRate <= 0 {
		sampleRate = 24000
	}
	var buf bytes.Buffer
	dataSize := uint32(len(pcm))
	byteRate := uint32(sampleRate * 2)
	blockAlign := uint16(2)
	buf.WriteString("RIFF")
	_ = binary.Write(&buf, binary.LittleEndian, uint32(36)+dataSize)
	buf.WriteString("WAVE")
	buf.WriteString("fmt ")
	_ = binary.Write(&buf, binary.LittleEndian, uint32(16))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint16(1))
	_ = binary.Write(&buf, binary.LittleEndian, uint32(sampleRate))
	_ = binary.Write(&buf, binary.LittleEndian, byteRate)
	_ = binary.Write(&buf, binary.LittleEndian, blockAlign)
	_ = binary.Write(&buf, binary.LittleEndian, uint16(16))
	buf.WriteString("data")
	_ = binary.Write(&buf, binary.LittleEndian, dataSize)
	buf.Write(pcm)
	return os.WriteFile(path, buf.Bytes(), 0o644)
}

func estimateWAVDuration(path string, fallback float64) float64 {
	raw, err := os.ReadFile(path)
	if err != nil || len(raw) < 44 || string(raw[0:4]) != "RIFF" || string(raw[8:12]) != "WAVE" {
		return fallback
	}
	sampleRate := int(binary.LittleEndian.Uint32(raw[24:28]))
	byteRate := int(binary.LittleEndian.Uint32(raw[28:32]))
	if sampleRate <= 0 || byteRate <= 0 {
		return fallback
	}
	dataSize := len(raw) - 44
	if dataSize <= 0 {
		return fallback
	}
	return float64(dataSize) / float64(byteRate)
}

func estimateMediaFileDuration(path string) float64 {
	if strings.HasSuffix(strings.ToLower(path), ".wav") {
		return estimateWAVDuration(path, 0)
	}
	ffprobePath, err := exec.LookPath("ffprobe")
	if err != nil {
		return 0
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, ffprobePath, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path).Output()
	if err != nil {
		return 0
	}
	duration, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil || duration <= 0 || math.IsNaN(duration) || math.IsInf(duration, 0) {
		return 0
	}
	return duration
}

func estimateNarrationDuration(text string) float64 {
	runes := []rune(strings.TrimSpace(text))
	if len(runes) == 0 {
		return 0
	}
	seconds := float64(len(runes))*0.14 + 1.5
	if seconds < 2 {
		return 2
	}
	return seconds
}

func sanitizeHyperframesQuality(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "draft", "standard", "high":
		return strings.ToLower(strings.TrimSpace(raw))
	default:
		return "standard"
	}
}

func sanitizeHyperframesFormat(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "webm":
		return "webm"
	default:
		return "mp4"
	}
}
