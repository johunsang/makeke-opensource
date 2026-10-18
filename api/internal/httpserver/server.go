package httpserver

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"makeke/localhttp"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"makeke/api/internal/analysis"
	"makeke/api/internal/appcore"
	"makeke/api/internal/blog"
	"makeke/api/internal/codingagent"
	"makeke/api/internal/config"
	"makeke/api/internal/content"
	"makeke/api/internal/presets"
	"makeke/api/internal/prompts"
	"makeke/api/internal/settings"

	_ "modernc.org/sqlite"
)

type Server struct {
	config         config.Config
	server         *http.Server
	activityDBOnce sync.Once
}

type healthResponse struct {
	Status      string `json:"status"`
	Service     string `json:"service"`
	Version     string `json:"version"`
	Runtime     string `json:"runtime"`
	Mode        string `json:"mode"`
	WorkingDir  string `json:"working_dir,omitempty"`
	DataDir     string `json:"data_dir,omitempty"`
	ProjectRoot string `json:"project_root,omitempty"`
}

type claudeDesignSaveRequest struct {
	ID          string `json:"id"`
	HTML        string `json:"html"`
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	AspectRatio string `json:"aspect_ratio"`
}

const (
	claudeDesignImportMaxUploadBytes = 110 << 20
	claudeDesignImportMaxTotalBytes  = 100 << 20
	claudeDesignImportMaxFileBytes   = 25 << 20
	claudeDesignImportMaxFiles       = 5000
)

type claudeDesignImportedFile struct {
	Path string
	Body []byte
}

type claudeDesignArtifactManifest struct {
	Version  int      `json:"version"`
	Kind     string   `json:"kind"`
	Title    string   `json:"title"`
	Entry    string   `json:"entry"`
	Renderer string   `json:"renderer"`
	Status   string   `json:"status"`
	Exports  []string `json:"exports"`
}

func New(cfg config.Config) *Server {
	mux := http.NewServeMux()

	instance := &Server{
		config: cfg,
		server: &http.Server{
			Addr:              fmt.Sprintf("127.0.0.1:%d", cfg.Port),
			Handler:           withCORS(mux),
			ReadHeaderTimeout: 5 * time.Second,
		},
	}

	appCoreService := appcore.New(cfg)
	appCoreService.Register(mux)
	codingAgentService := codingagent.New(cfg)
	codingAgentService.Register(mux)
	settingsService := settings.New(cfg)
	settingsService.Register(mux)
	blogService := blog.New(cfg)
	blogService.Register(mux)
	promptService := prompts.New(cfg)
	promptService.Register(mux)
	presetsService := presets.New(cfg)
	presetsService.Register(mux)
	analysisService := analysis.New(cfg)
	analysisService.Register(mux)
	contentService := content.New(cfg)
	contentService.Register(mux)
	mux.HandleFunc("/static/launcher.html", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
	})
	staticDir := filepath.Join(cfg.ProjectRoot, "static")
	if info, err := os.Stat(staticDir); err == nil && info.IsDir() {
		staticHandler := http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir)))
		mux.Handle("/static/", noCacheForStaticCode(staticHandler))
	}

	mux.HandleFunc("/api/health", instance.handleHealth)
	mux.HandleFunc("/api/runtime/status", instance.handleRuntimeStatus)
	mux.HandleFunc("/api/notices", instance.handleNotices)
	mux.HandleFunc("/api/notices/", instance.handleNoticeItem)
	mux.HandleFunc("/api/atlas/models", instance.handleAtlasModels)
	mux.HandleFunc("/api/openai-compatible/chat/completions", instance.handleOpenAICompatibleChatCompletions)
	mux.HandleFunc("/api/advideo/director-personas", instance.handleDirectorPersonas)
	mux.HandleFunc("/api/advideo/director-note", instance.handleDirectorNote)
	mux.HandleFunc("/api/claude-design/generate", instance.handleClaudeDesignGenerate)
	mux.HandleFunc("/api/claude-design/edit", instance.handleClaudeDesignEdit)
	mux.HandleFunc("/api/claude-design/autofill-template", instance.handleClaudeDesignAutofillTemplate)
	mux.HandleFunc("/api/claude-design/save", instance.handleClaudeDesignSave)
	mux.HandleFunc("/api/claude-design/import", instance.handleClaudeDesignImport)
	mux.HandleFunc("/api/claude-design/import-asset/", instance.handleClaudeDesignImportAsset)
	mux.HandleFunc("/api/claude-design/comments/", instance.handleClaudeDesignComments)
	mux.HandleFunc("/api/claude-design/list", instance.handleClaudeDesignList)
	mux.HandleFunc("/api/claude-design/item/", instance.handleClaudeDesignItem)
	mux.HandleFunc("/api/claude-design/proxy-image", instance.handleClaudeDesignProxyImage)
	mux.HandleFunc("/api/claude-design/export/pptx", instance.handleClaudeDesignExportPPTX)
	mux.HandleFunc("/api/claude-design/export/images", instance.handleClaudeDesignExportImages)
	mux.HandleFunc("/api/claude-design/pptx/", instance.handleClaudeDesignPPTXDownload)
	mux.HandleFunc("/api/claude-design/images/", instance.handleClaudeDesignImagesDownload)
	mux.HandleFunc("/api/hyperframes/render-native-async", instance.handleHyperframesRenderNativeAsync)
	mux.HandleFunc("/api/hyperframes/render-jobs/", instance.handleHyperframesRenderJob)
	mux.HandleFunc("/api/hyperframes/output/", instance.handleHyperframesOutput)
	mux.HandleFunc("/api/hyperframes/ai-generate", instance.handleHyperframesAIGenerate)
	mux.HandleFunc("/api/hyperframes/generate-scenario-plan", instance.handleHyperframesGenerateScenarioPlan)
	mux.HandleFunc("/api/hyperframes/generate-narration-script", instance.handleHyperframesGenerateNarrationScript)
	mux.HandleFunc("/api/hyperframes/generate-bg-image", instance.handleHyperframesGenerateBackgroundImage)
	mux.HandleFunc("/api/hyperframes/generate-image-video", instance.handleHyperframesGenerateImageVideo)
	mux.HandleFunc("/api/hyperframes/concat-videos", instance.handleHyperframesConcatVideos)
	mux.HandleFunc("/api/hyperframes/generate-bgm", instance.handleHyperframesGenerateBGM)
	mux.HandleFunc("/api/hyperframes/generate-narration", instance.handleHyperframesGenerateNarration)
	mux.HandleFunc("/api/hyperframes/audio/", instance.handleHyperframesAudio)
	mux.HandleFunc("/api/hyperframes/save", instance.handleHyperframesSave)
	mux.HandleFunc("/api/hyperframes/studio-api/projects/", instance.handleHyperframesStudioProjectFile)
	mux.HandleFunc("/api/hyperframes/studio", instance.handleHyperframesStudio)
	mux.HandleFunc("/api/animation-ad/history", instance.handleAnimationAdHistory)
	mux.HandleFunc("/api/animation-ad/history/", instance.handleAnimationAdHistoryItem)
	mux.HandleFunc("/api/animation-ad/semantics", instance.handleAnimationAdSemantics)
	mux.HandleFunc("/api/animation-ad/success-cases", instance.handleAnimationAdSuccessCases)
	mux.HandleFunc("/api/animation-ad/recommend-brief-packs", instance.handleAnimationAdRecommendBriefPacks)
	mux.HandleFunc("/api/video-use/status", instance.handleVideoUseStatus)
	mux.HandleFunc("/api/activity-log/summary", instance.handleActivityLogSummary)
	mux.HandleFunc("/api/activity-log", instance.handleActivityLog)
	mux.HandleFunc("/", instance.handleRoot)

	return instance
}

func (s *Server) ListenAndServe() error {
	log.Printf("[Makeke Go API] starting gateway on %s", s.server.Addr)
	err := s.server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	health := healthResponse{
		Status:      "ok",
		Service:     s.config.Service,
		Version:     s.config.Version,
		Runtime:     s.config.Runtime,
		Mode:        "go-native",
		WorkingDir:  s.config.WorkingDir,
		DataDir:     s.config.DataDir,
		ProjectRoot: s.config.ProjectRoot,
	}
	writeJSON(w, http.StatusOK, health)
}

func (s *Server) handleVideoUseStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	home, _ := os.UserHomeDir()
	repoPath := filepath.Join(home, "Developer", "video-use")
	codexHome := strings.TrimSpace(os.Getenv("CODEX_HOME"))
	if codexHome == "" {
		codexHome = filepath.Join(home, ".codex")
	}
	skillPath := filepath.Join(codexHome, "skills", "video-use")
	envPath := filepath.Join(repoPath, ".env")

	ffmpegPath, _ := exec.LookPath("ffmpeg")
	ffprobePath, _ := exec.LookPath("ffprobe")
	uvPath, _ := exec.LookPath("uv")
	ytDlpPath, _ := exec.LookPath("yt-dlp")

	repoInstalled := fileExists(filepath.Join(repoPath, "SKILL.md"))
	skillLinked := fileExists(filepath.Join(skillPath, "SKILL.md"))
	elevenLabsSource := ""
	if strings.TrimSpace(os.Getenv("ELEVENLABS_API_KEY")) != "" {
		elevenLabsSource = "env"
	} else if hasDotenvKey(envPath, "ELEVENLABS_API_KEY") {
		elevenLabsSource = ".env"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"repo_path":       repoPath,
		"skill_path":      skillPath,
		"repo_installed":  repoInstalled,
		"skill_linked":    skillLinked,
		"ffmpeg_path":     ffmpegPath,
		"ffprobe_path":    ffprobePath,
		"uv_path":         uvPath,
		"yt_dlp_path":     ytDlpPath,
		"elevenlabs_key":  elevenLabsSource != "",
		"elevenlabs_from": elevenLabsSource,
		"ready":           repoInstalled && skillLinked && ffmpegPath != "" && ffprobePath != "",
	})
}

func (s *Server) handleRuntimeStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"runtime":      s.config.Runtime,
		"mode":         "go-native",
		"gateway_port": s.config.Port,
	})
}

type claudeDesignGenerateRequest struct {
	Prompt                string           `json:"prompt"`
	Kind                  string           `json:"kind"`
	AspectRatio           string           `json:"aspect_ratio"`
	Provider              string           `json:"provider"`
	Model                 string           `json:"model"`
	BrandName             string           `json:"brand_name"`
	BrandColors           []string         `json:"brand_colors"`
	BusinessType          string           `json:"business_type"`
	BusinessDesc          string           `json:"business_description"`
	CTAText               string           `json:"cta_text"`
	DesignRules           string           `json:"design_rules"`
	DesignStyle           string           `json:"design_style"`
	DesignPurpose         string           `json:"design_purpose"`
	DesignDensity         string           `json:"design_density"`
	PreviousDesignSummary string           `json:"previous_design_summary"`
	ReferenceImages       []string         `json:"reference_images"`
	ReferenceSources      []map[string]any `json:"reference_sources"`
}

type claudeDesignEditRequest struct {
	HTML             string           `json:"html"`
	Instruction      string           `json:"instruction"`
	Provider         string           `json:"provider"`
	Model            string           `json:"model"`
	ReferenceImages  []string         `json:"reference_images"`
	ReferenceSources []map[string]any `json:"reference_sources"`
}

type claudeDesignAutofillTemplateRequest struct {
	Brief      string         `json:"brief"`
	Custom     string         `json:"custom"`
	Kind       string         `json:"kind"`
	Label      string         `json:"label"`
	Prompt     string         `json:"prompt"`
	Provider   string         `json:"provider"`
	Model      string         `json:"model"`
	Brand      string         `json:"brand"`
	Audience   string         `json:"audience"`
	Goal       string         `json:"goal"`
	Materials  string         `json:"materials"`
	Size       string         `json:"size"`
	Scope      string         `json:"scope"`
	InsertMode string         `json:"insert_mode"`
	Profile    map[string]any `json:"profile"`
}

func (s *Server) handleClaudeDesignGenerate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "EMPTY_PROMPT", "message": "요청 내용을 입력하세요."})
		return
	}
	prompt := s.buildClaudeDesignGeneratePrompt(req)
	provider := strings.TrimSpace(req.Provider)
	model := strings.TrimSpace(req.Model)
	var text string
	var err error
	if provider == "atlas" || provider == "claude" {
		apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_ATLAS_KEY", "message": "Atlas Cloud API 키가 설정되지 않았습니다. 설정에서 Atlas Cloud API 키를 저장해주세요."})
			return
		}
		if provider == "claude" && model == "" {
			model = "anthropic/claude-opus-4.7"
		}
		model = firstNonEmpty(model, "openai/gpt-5.4")
		text, err = s.runLangGraphDesignAgent("generate", prompt, "", "", req.ReferenceImages, apiKey, model, 220*time.Second)
		provider = "atlas"
	} else {
		apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_GEMINI_KEY", "message": "Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 저장해주세요."})
			return
		}
		model = normalizeGeminiGenerateContentModel(firstNonEmpty(model, s.getSetting("MODELS.text_model", "")))
		model = firstNonEmpty(model, s.defaultGeminiGenerateContentModel(apiKey))
		text, err = s.runGeminiDesignPrompt(prompt, req.ReferenceImages, apiKey, model, 180*time.Second)
		provider = "gemini"
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "DESIGN_MODEL_FAILED", "message": err.Error()})
		return
	}
	html := extractClaudeDesignHTML(text)
	if html == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "NO_HTML", "message": "모델 응답에서 HTML을 찾지 못했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"html":     html,
		"provider": provider,
		"model":    model,
	})
}

func (s *Server) handleClaudeDesignEdit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignEditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.HTML) == "" || strings.TrimSpace(req.Instruction) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "EMPTY_EDIT", "message": "수정할 HTML과 지시문이 필요합니다."})
		return
	}
	prompt := s.buildClaudeDesignEditPrompt(req)
	provider := strings.TrimSpace(req.Provider)
	model := strings.TrimSpace(req.Model)
	var text string
	var err error
	if provider == "atlas" || provider == "claude" {
		apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_ATLAS_KEY", "message": "Atlas Cloud API 키가 설정되지 않았습니다. 설정에서 Atlas Cloud API 키를 저장해주세요."})
			return
		}
		if provider == "claude" && model == "" {
			model = "anthropic/claude-opus-4.7"
		}
		model = firstNonEmpty(model, "openai/gpt-5.4")
		text, err = s.runLangGraphDesignAgent("edit", "", req.HTML, prompt, req.ReferenceImages, apiKey, model, 220*time.Second)
		provider = "atlas"
	} else {
		apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_GEMINI_KEY", "message": "Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 저장해주세요."})
			return
		}
		model = normalizeGeminiGenerateContentModel(firstNonEmpty(model, s.getSetting("MODELS.text_model", "")))
		model = firstNonEmpty(model, s.defaultGeminiGenerateContentModel(apiKey))
		text, err = s.runGeminiDesignPrompt(prompt, req.ReferenceImages, apiKey, model, 180*time.Second)
		provider = "gemini"
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "DESIGN_MODEL_FAILED", "message": err.Error()})
		return
	}
	html := extractClaudeDesignHTML(text)
	if html == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "NO_HTML", "message": "모델 응답에서 HTML을 찾지 못했습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"html":     html,
		"provider": provider,
		"model":    model,
	})
}

func (s *Server) handleClaudeDesignAutofillTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignAutofillTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.Brief+req.Custom+req.Prompt+req.Label) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "EMPTY_TEMPLATE_CONTEXT", "message": "자동 채우기에 사용할 내용이 없습니다."})
		return
	}
	provider := strings.TrimSpace(req.Provider)
	model := strings.TrimSpace(req.Model)
	prompt := buildClaudeDesignAutofillPrompt(req)
	var text string
	var err error
	if provider == "atlas" || provider == "claude" {
		apiKey := strings.TrimSpace(s.getSetting("API.atlas_key", ""))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_ATLAS_KEY", "message": "Atlas Cloud API 키가 설정되지 않았습니다."})
			return
		}
		model = firstNonEmpty(model, "openai/gpt-5.4")
		text, err = s.runAtlasDesignPrompt(prompt, nil, apiKey, model, 45*time.Second)
		provider = "atlas"
	} else {
		apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
		if apiKey == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error_code": "MISSING_GEMINI_KEY", "message": "Gemini API 키가 설정되지 않았습니다."})
			return
		}
		model = normalizeGeminiGenerateContentModel(firstNonEmpty(model, s.getSetting("MODELS.text_model", "")))
		model = firstNonEmpty(model, s.defaultGeminiGenerateContentModel(apiKey))
		text, err = s.runGeminiDesignPrompt(prompt, nil, apiKey, model, 45*time.Second)
		provider = "gemini"
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "AUTOFILL_MODEL_FAILED", "message": err.Error()})
		return
	}
	fields, err := parseClaudeDesignAutofillFields(text)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error_code": "AUTOFILL_PARSE_FAILED", "message": err.Error()})
		return
	}
	fields["status"] = "ok"
	fields["provider"] = provider
	fields["model"] = model
	writeJSON(w, http.StatusOK, fields)
}

func (s *Server) handleClaudeDesignSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	saved, err := s.saveClaudeDesignHistoryItem(req, nil)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errClaudeDesignInvalidHTML) {
			status = http.StatusBadRequest
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

var errClaudeDesignInvalidHTML = errors.New("html is required")

func (s *Server) saveClaudeDesignHistoryItem(req claudeDesignSaveRequest, extraMeta map[string]any) (map[string]any, error) {
	html := strings.TrimSpace(req.HTML)
	if html == "" {
		return nil, errClaudeDesignInvalidHTML
	}
	dir := s.claudeDesignHistoryDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	id := cleanDesignHistoryID(req.ID)
	if id == "" {
		base := sanitizeDesignName(firstNonEmpty(req.Name, req.Kind, "makeke-design"))
		id = uniqueClaudeDesignHistoryID(dir, base)
	}
	path := filepath.Join(dir, id)
	if err := os.WriteFile(path, []byte(html), 0o644); err != nil {
		return nil, err
	}
	now := time.Now().Format(time.RFC3339)
	metaPath := strings.TrimSuffix(path, ".html") + ".json"
	meta := map[string]any{}
	if raw, err := os.ReadFile(metaPath); err == nil {
		_ = json.Unmarshal(raw, &meta)
	}
	if strings.TrimSpace(fmt.Sprint(meta["created_at"])) == "" {
		meta["created_at"] = now
	}
	meta["updated_at"] = now
	meta["id"] = id
	meta["name"] = firstNonEmpty(req.Name, strings.TrimSuffix(id, ".html"))
	meta["kind"] = req.Kind
	meta["aspect_ratio"] = req.AspectRatio
	meta["file"] = path
	for key, value := range extraMeta {
		meta[key] = value
	}
	if raw, err := json.MarshalIndent(meta, "", "  "); err == nil {
		_ = os.WriteFile(metaPath, raw, 0o644)
	}
	return map[string]any{
		"status": "ok",
		"id":     id,
		"name":   meta["name"],
		"url":    "/api/claude-design/item/" + url.PathEscape(id) + "?raw=1",
		"file":   path,
	}, nil
}

func (s *Server) handleClaudeDesignImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, claudeDesignImportMaxUploadBytes)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart upload"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()

	raw, err := io.ReadAll(io.LimitReader(file, claudeDesignImportMaxUploadBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if len(raw) > claudeDesignImportMaxUploadBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "import file is too large"})
		return
	}

	filename := strings.TrimSpace(header.Filename)
	name := firstNonEmpty(r.FormValue("name"), strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)), "imported-design")
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".html", ".htm":
		saved, err := s.saveClaudeDesignHistoryItem(claudeDesignSaveRequest{
			HTML:        string(raw),
			Name:        name,
			Kind:        "imported-html",
			AspectRatio: r.FormValue("aspect_ratio"),
		}, map[string]any{
			"source":        "claude-design-import",
			"import_format": "html",
			"original_file": filename,
		})
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, saved)
	case ".zip":
		saved, err := s.importClaudeDesignZip(raw, name, filename, r.FormValue("aspect_ratio"))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, saved)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "only .html, .htm, and .zip files are supported"})
	}
}

func (s *Server) importClaudeDesignZip(raw []byte, name string, filename string, aspectRatio string) (map[string]any, error) {
	reader, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if err != nil {
		return nil, err
	}
	files := make([]claudeDesignImportedFile, 0, len(reader.File))
	totalBytes := int64(0)
	for _, entry := range reader.File {
		if entry.FileInfo().IsDir() {
			continue
		}
		if len(files) >= claudeDesignImportMaxFiles {
			return nil, errors.New("zip contains too many files")
		}
		if entry.Method != zip.Store && entry.Method != zip.Deflate {
			return nil, fmt.Errorf("unsupported zip compression method: %d", entry.Method)
		}
		relPath, err := sanitizeClaudeDesignZipPath(entry.Name)
		if err != nil {
			return nil, err
		}
		if entry.UncompressedSize64 > claudeDesignImportMaxFileBytes {
			return nil, fmt.Errorf("zip file too large: %s", relPath)
		}
		rc, err := entry.Open()
		if err != nil {
			return nil, err
		}
		body, readErr := io.ReadAll(io.LimitReader(rc, claudeDesignImportMaxFileBytes+1))
		closeErr := rc.Close()
		if readErr != nil {
			return nil, readErr
		}
		if closeErr != nil {
			return nil, closeErr
		}
		if len(body) > claudeDesignImportMaxFileBytes {
			return nil, fmt.Errorf("zip file too large: %s", relPath)
		}
		totalBytes += int64(len(body))
		if totalBytes > claudeDesignImportMaxTotalBytes {
			return nil, errors.New("zip is too large")
		}
		files = append(files, claudeDesignImportedFile{Path: relPath, Body: body})
	}
	if len(files) == 0 {
		return nil, errors.New("zip contains no files")
	}
	entryFile, manifestMeta := chooseClaudeDesignImportEntry(files)
	if entryFile == "" {
		return nil, errors.New("zip does not contain an HTML file")
	}
	if title := strings.TrimSpace(fmt.Sprint(manifestMeta["title"])); title != "" {
		name = title
	}

	historyDir := s.claudeDesignHistoryDir()
	if err := os.MkdirAll(historyDir, 0o755); err != nil {
		return nil, err
	}
	id := uniqueClaudeDesignHistoryID(historyDir, sanitizeDesignName(name))
	assetID := strings.TrimSuffix(id, ".html")
	assetRoot := s.claudeDesignImportAssetDir(assetID)
	if err := os.RemoveAll(assetRoot); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(assetRoot, 0o755); err != nil {
		return nil, err
	}

	fileMap := make(map[string][]byte, len(files))
	for _, file := range files {
		fileMap[file.Path] = file.Body
		target := filepath.Join(assetRoot, filepath.FromSlash(file.Path))
		if !isPathInside(assetRoot, target) {
			return nil, errors.New("zip path escapes import asset dir")
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return nil, err
		}
		if err := os.WriteFile(target, file.Body, 0o644); err != nil {
			return nil, err
		}
	}
	html := string(fileMap[entryFile])
	html = rewriteClaudeDesignImportAssetRefs(html, entryFile, assetID, fileMap)
	saved, err := s.saveClaudeDesignHistoryItem(claudeDesignSaveRequest{
		ID:          id,
		HTML:        html,
		Name:        name,
		Kind:        "imported-zip",
		AspectRatio: aspectRatio,
	}, map[string]any{
		"source":        "claude-design-import",
		"import_format": "zip",
		"original_file": filename,
		"entry_file":    entryFile,
		"asset_id":      assetID,
		"files_count":   len(files),
		"manifest":      manifestMeta,
	})
	if err != nil {
		return nil, err
	}
	saved["entry_file"] = entryFile
	saved["files_count"] = len(files)
	return saved, nil
}

func (s *Server) handleClaudeDesignImportAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	rest := strings.TrimPrefix(r.URL.EscapedPath(), "/api/claude-design/import-asset/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) != 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid asset path"})
		return
	}
	assetID, err := url.PathUnescape(parts[0])
	if err != nil || cleanDesignImportAssetID(assetID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid asset id"})
		return
	}
	assetPath, err := url.PathUnescape(parts[1])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid asset path"})
		return
	}
	cleanPath, err := sanitizeClaudeDesignZipPath(assetPath)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid asset path"})
		return
	}
	assetRoot := s.claudeDesignImportAssetDir(assetID)
	target := filepath.Join(assetRoot, filepath.FromSlash(cleanPath))
	if !isPathInside(assetRoot, target) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid asset path"})
		return
	}
	http.ServeFile(w, r, target)
}

func (s *Server) handleClaudeDesignList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	dir := s.claudeDesignHistoryDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": []any{}, "folder": dir})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	items := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".html") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		id := entry.Name()
		meta := map[string]any{}
		metaPath := filepath.Join(dir, strings.TrimSuffix(id, ".html")+".json")
		if raw, err := os.ReadFile(metaPath); err == nil {
			_ = json.Unmarshal(raw, &meta)
		}
		items = append(items, map[string]any{
			"id":           id,
			"name":         firstNonEmpty(fmt.Sprint(meta["name"]), strings.TrimSuffix(id, ".html")),
			"kind":         strings.TrimSpace(fmt.Sprint(meta["kind"])),
			"aspect_ratio": strings.TrimSpace(fmt.Sprint(meta["aspect_ratio"])),
			"mtime":        info.ModTime().Format("2006-01-02 15:04"),
			"updated_at":   info.ModTime().Format(time.RFC3339),
			"size":         info.Size(),
			"url":          "/api/claude-design/item/" + url.PathEscape(id) + "?raw=1",
		})
	}
	sort.SliceStable(items, func(i, j int) bool {
		return fmt.Sprint(items[i]["updated_at"]) > fmt.Sprint(items[j]["updated_at"])
	})
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": items, "folder": dir})
}

func (s *Server) handleClaudeDesignItem(w http.ResponseWriter, r *http.Request) {
	id := cleanDesignHistoryID(strings.TrimPrefix(r.URL.Path, "/api/claude-design/item/"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid item id"})
		return
	}
	path := filepath.Join(s.claudeDesignHistoryDir(), id)
	switch r.Method {
	case http.MethodGet:
		raw, err := os.ReadFile(path)
		if err != nil {
			status := http.StatusInternalServerError
			if os.IsNotExist(err) {
				status = http.StatusNotFound
			}
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}
		if r.URL.Query().Get("raw") == "1" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(raw)
			return
		}
		meta := map[string]any{}
		if metaRaw, err := os.ReadFile(strings.TrimSuffix(path, ".html") + ".json"); err == nil {
			_ = json.Unmarshal(metaRaw, &meta)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"id":     id,
			"html":   string(raw),
			"meta":   meta,
			"url":    "/api/claude-design/item/" + url.PathEscape(id) + "?raw=1",
		})
	case http.MethodDelete:
		meta := map[string]any{}
		metaPath := strings.TrimSuffix(path, ".html") + ".json"
		if metaRaw, err := os.ReadFile(metaPath); err == nil {
			_ = json.Unmarshal(metaRaw, &meta)
		}
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		_ = os.Remove(metaPath)
		if assetID := cleanDesignImportAssetID(strings.TrimSpace(fmt.Sprint(meta["asset_id"]))); assetID != "" {
			_ = os.RemoveAll(s.claudeDesignImportAssetDir(assetID))
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) handleClaudeDesignProxyImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	rawURL := strings.TrimSpace(r.URL.Query().Get("url"))
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed == nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid image url is required"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 18*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("User-Agent", "Makeke/claude-design-image-proxy")
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.1")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("image fetch failed: %d", resp.StatusCode)})
		return
	}
	contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(contentType, "image/") {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "remote resource is not an image"})
		return
	}
	const maxImageBytes = 12 << 20
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	if len(raw) > maxImageBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "image is too large"})
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func (s *Server) claudeDesignHistoryDir() string {
	return filepath.Join(resolveHTTPDataDir(s.config), "claude-design", "history")
}

func (s *Server) claudeDesignImportAssetDir(assetID string) string {
	return filepath.Join(resolveHTTPDataDir(s.config), "claude-design", "import-assets", cleanDesignImportAssetID(assetID))
}

func uniqueClaudeDesignHistoryID(dir string, base string) string {
	base = sanitizeDesignName(base)
	for i := 0; i < 100; i++ {
		suffix := time.Now().Format("20060102_150405")
		if i > 0 {
			suffix = fmt.Sprintf("%s_%02d", suffix, i)
		}
		id := fmt.Sprintf("%s_%s.html", base, suffix)
		if !fileExists(filepath.Join(dir, id)) {
			return id
		}
	}
	return fmt.Sprintf("%s_%d.html", base, time.Now().UnixNano())
}

func cleanDesignHistoryID(raw string) string {
	decoded, err := url.PathUnescape(strings.TrimSpace(raw))
	if err == nil {
		raw = decoded
	}
	raw = filepath.Base(raw)
	if raw == "." || raw == string(filepath.Separator) || raw == "" {
		return ""
	}
	if !strings.HasSuffix(strings.ToLower(raw), ".html") {
		return ""
	}
	return raw
}

func cleanDesignImportAssetID(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.Contains(raw, "/") || strings.Contains(raw, "\\") {
		return ""
	}
	if len([]rune(raw)) > 140 {
		return ""
	}
	if !regexp.MustCompile(`^[a-zA-Z0-9가-힣._-]+$`).MatchString(raw) {
		return ""
	}
	return raw
}

func sanitizeDesignName(raw string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		name = "makeke-design"
	}
	re := regexp.MustCompile(`[^a-zA-Z0-9가-힣._-]+`)
	name = strings.Trim(re.ReplaceAllString(name, "-"), "-._")
	if name == "" {
		name = "makeke-design"
	}
	if len([]rune(name)) > 50 {
		name = string([]rune(name)[:50])
	}
	return name
}

func (s *Server) buildClaudeDesignGeneratePrompt(req claudeDesignGenerateRequest) string {
	size := designCanvasSize(req.AspectRatio)
	sourceText := formatDesignSources(req.ReferenceSources)
	imageRule := ""
	if len(req.ReferenceImages) > 0 {
		imageRule = fmt.Sprintf("\n[첨부 이미지]\n- 첨부 이미지 %d장은 장식 참고가 아니라 실제 결과물의 시각 자산입니다.\n- 최소 1장은 hero, 제품/서비스 증거, 스크린샷, 인물/장소 컷 중 하나로 화면에서 분명히 보이게 배치하세요.\n- 이미지가 필요한 위치에는 <img src=\"#reference-image-N\"> 형태의 명확한 placeholder를 쓰세요. N은 1부터 시작합니다.\n- 로고/제품/인물/스크린샷처럼 보이는 이미지는 억지로 재생성하지 말고 실제 이미지가 들어갈 위치를 디자인하세요.\n- 첨부 이미지가 있는데 순수 도형/그라데이션/일반 아이콘만으로 끝내면 실패입니다.\n", len(req.ReferenceImages))
	}
	return fmt.Sprintf(`[역할] 당신은 Canva급 마케팅 디자인을 HTML 하나로 만드는 시니어 프론트엔드 디자이너입니다.

[절대 출력 규칙]
- 설명, 마크다운, 코드펜스 없이 완전한 HTML 문서만 출력하세요.
- 반드시 <!DOCTYPE html>로 시작하고 </html>로 끝나야 합니다.
- CSS와 JavaScript는 HTML 안에 포함하세요.
- 로컬 파일 경로에 의존하지 마세요.
- 상대 이미지 경로, source.unsplash.com, via.placeholder.com을 쓰지 마세요.
- 사용자가 4장, 5장, 8장처럼 장수를 말하면 정확히 그 개수의 <section class="makeke-page" data-slide="0">...</section>을 하나의 HTML 안에 만드세요.
- 여러 장을 여러 개의 독립 HTML 문서로 나누지 마세요.
%s

[레이아웃 안전 규칙]
- 모든 주요 콘텐츠는 캔버스 안쪽 64px 이상 안전 여백 안에 완전히 보여야 합니다.
- 제목, 본문, CTA, 버튼 텍스트는 절대 잘리거나 캔버스 밖으로 나가면 안 됩니다.
- 큰 장식 타이포를 쓰더라도 한글 단어가 쪼개지거나 프레임 밖으로 밀리면 실패입니다.
- hero 제목은 CSS clamp()로 제한하고 최대 96px를 넘기지 마세요. 본문은 34px 이하, 보조 텍스트는 24px 이하를 기본으로 하세요.
- 텍스트가 들어가는 카드/박스/버튼에는 고정 height를 쓰지 말고 min-height와 padding, gap을 사용하세요. 내용이 늘어나면 카드도 같이 커져야 합니다.
- 여러 블록은 CSS grid/flex와 gap으로 배치하고, 텍스트 블록끼리 position:absolute로 겹치게 배치하지 마세요.
- position:absolute는 로고/장식/배경 이미지에만 제한적으로 쓰고, 텍스트·카드·CTA에는 쓰지 않는 것을 원칙으로 하세요. 꼭 쓰면 max-width, left/right/top/bottom 안전값을 함께 지정하세요.
- 한글 텍스트에는 word-break: keep-all; overflow-wrap: break-word; line-height: 1.08 이상을 적용하세요.
- 카드 내부에는 min-width: 0을 넣고, 긴 문장은 줄바꿈되게 하세요.
- overflow:hidden에 의존해 텍스트를 자르지 말고, 첫 화면 스크린샷에서 모든 문구가 온전히 보여야 합니다.

[요청]
%s
%s

[산출물]
- 형식: %s
- 캔버스: %s
- 브랜드: %s
- 브랜드 색상: %s
- 프로필 업종: %s
- 프로필 기본 비즈니스 설명: %s
- 프로필 CTA: %s
- 프로필 상세 디자인 규칙: %s
- 스타일: %s
%s
- 목적: %s
- 정보 밀도: %s
%s
%s

[품질 기준]
- 첫 화면에서 바로 완성된 결과물이 보여야 합니다.
- 텍스트는 실제 DOM 텍스트로 유지해 사용자가 클릭 편집할 수 있게 하세요.
- 주요 블록에는 의미 있는 class 이름을 붙이세요.
- 주요 section, card, headline, paragraph, CTA, image에는 고유한 data-makeke-id를 붙여 클릭한 요소만 안정적으로 수정할 수 있게 하세요.
- 버튼, 카드, 이미지, 타이포 위계와 여백을 전문적으로 맞추세요.
- 프로필 기본 비즈니스 설명이 있으면 결과물의 메시지, 고객 문제, 증거, CTA에 우선 반영하세요.
- 브랜드 색상이 있으면 그 색을 결과물의 주요 포인트, CTA, 배지, 라인, 그래프 색으로 우선 사용하세요.
- 프로필 상세 디자인 규칙이 있으면 색상, 타이포그래피, 여백, 이미지 스타일, CTA, 금지 디자인을 그 규칙 그대로 우선 적용하세요.
- 브랜드 색상이 없으면 첨부 이미지/업종/주제에서 새 팔레트를 추론하고, 마케케 앱 UI의 앱 기본 강조색(#ff8c00, #ff6b00)을 기본 브랜드 색처럼 쓰지 마세요.
%s
`, req.Prompt, designVisualDiversityRule(req.Kind, req.Prompt, req.PreviousDesignSummary), previousDesignAvoidanceBlock(req.PreviousDesignSummary), firstNonEmpty(req.Kind, "general"), size, firstNonEmpty(req.BrandName, "없음"), strings.Join(req.BrandColors, ", "), firstNonEmpty(req.BusinessType, "없음"), firstNonEmpty(req.BusinessDesc, "없음"), firstNonEmpty(req.CTAText, "없음"), firstNonEmpty(req.DesignRules, "없음"), firstNonEmpty(req.DesignStyle, "auto"), designStyleExtraRule(req.DesignStyle), firstNonEmpty(req.DesignPurpose, "auto"), firstNonEmpty(req.DesignDensity, "balanced"), imageRule, sourceText, designKindExtraRule(req.Kind))
}

func previousDesignAvoidanceBlock(summary string) string {
	trimmed := strings.TrimSpace(summary)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) > 1200 {
		trimmed = trimmed[:1200]
	}
	return fmt.Sprintf(`

[최근 결과 회피 메모리]
- 아래 최근 결과와 같은 골격/색감/카드 구성을 반복하면 실패입니다.
%s
`, trimmed)
}

func designVisualDiversityRule(kind, prompt, previousSummary string) string {
	trimmedKind := strings.TrimSpace(kind)
	if trimmedKind == "shader" || strings.HasPrefix(trimmedKind, "threejs") {
		recipes := []struct {
			Name string
			Rule string
		}{
			{"풀블리드 3D 캔버스", "3D canvas가 화면 대부분을 차지하고 텍스트/CTA는 safe area에 얇게 얹는 구조."},
			{"Webflow식 3D 랜딩", "히어로 전체를 3D 씬으로 쓰고 카피와 버튼은 엣지에 두는 구조."},
			{"카툰 3D 제품 쇼케이스", "MeshToonMaterial, OutlineEffect, 단순 배경, 제품/캐릭터 중심 구도."},
			{"파티클 3D 모션", "점/오브/텍스트 파티클이 주 시각 요소이며 정보 카드는 거의 쓰지 않는 구조."},
			{"3D 제품 히어로", "제품 모델, 조명, 하이라이트, 회전, 핫스팟, 캡처 가능한 씬이 중심인 구조."},
		}
		layoutContracts := []string{
			"3D 캔버스가 카드보다 먼저 눈에 들어와야 하고, 정보 박스는 보조 요소로만 둬야 합니다.",
			"씬별 카메라/조명/재질/애니메이션이 명확해야 하며, 정적 포스터처럼 보이면 실패입니다.",
			"텍스트와 CTA는 3D 오브젝트를 가리지 않는 safe area에 배치해야 합니다.",
			"빈 배경 대신 절차적 지오메트리 또는 fallback 오브젝트를 반드시 둬야 합니다.",
		}
		seed := time.Now().UnixNano()
		for _, r := range trimmedKind + "|" + prompt + "|" + previousSummary {
			seed += int64(r)
			seed = seed*31 + 17
		}
		if seed < 0 {
			seed = -seed
		}
		primary := recipes[int(seed%int64(len(recipes)))]
		secondary := recipes[int((seed+2)%int64(len(recipes)))]
		contractA := layoutContracts[int(seed%int64(len(layoutContracts)))]
		contractB := layoutContracts[int((seed+1)%int64(len(layoutContracts)))]
		return fmt.Sprintf(`
[시각 다양성 강제 규칙]
- 이번 생성 ID: %d. 이 ID마다 다른 3D 장면 구성을 선택하세요.
- 이번 생성의 시각 시스템은 반드시 "%s"로 시작하고, 필요하면 "%s"의 요소를 보조로 섞으세요.
- 카드형 랜딩/브루탈 카드/종이 질감 템플릿을 기본값으로 쓰지 마세요.
- %s
- 보조 변주: %s
- 이번 결과의 필수 구조 차이: %s
- 이번 결과의 추가 구조 차이: %s
- body 또는 main에 data-visual-system="%s" 속성을 넣고, 주요 wrapper class 이름도 이 시스템에 맞게 새로 붙이세요.
- 3D 결과물은 WebGLRenderer 기반 풀블리드 장면을 우선하고, WebGPU 실험 코드는 선택적으로만 둡니다.
- 3D 캔버스는 장식 카드 안에 넣지 말고 화면의 주연으로 배치하세요.
- 브랜드 색은 유지하되, 3D 장면의 조명/재질/배경/심도와 함께 살아야 합니다.
`, time.Now().UnixNano(), primary.Name, secondary.Name, primary.Rule, secondary.Rule, contractA, contractB, primary.Name)
	}
	if strings.HasPrefix(trimmedKind, "remotion") {
		recipes := []struct {
			Name string
			Rule string
		}{
			{"타임라인 보드", "장면을 세로 타임라인으로 배열하고 duration, narration, transition cue가 한눈에 보이게 하는 구조."},
			{"씬 스토리보드", "하나의 키비주얼보다 여러 씬 카드가 중심이며 컷 순서와 에너지 곡선이 읽히는 구조."},
			{"광고 컷 플로우", "후킹 오프닝, 증거, 전개, 엔드컷이 순차적으로 이어지고 각 씬 역할이 분명한 구조."},
			{"브랜드 영상 플레이트", "큰 카드보다 시간축과 레이어가 중요하며 자막/CTA/브랜드 락업이 씬별로 변하는 구조."},
		}
		layoutContracts := []string{
			"씬 카드와 타임라인이 화면 주연이 되어야 하고, 단일 포스터형 레이아웃으로 수렴하면 안 됩니다.",
			"각 씬은 duration과 cue가 분명해야 하며, 정지 이미지처럼만 보이면 실패입니다.",
			"전개, 증거, CTA, 엔드컷이 시간축을 따라 읽혀야 합니다.",
		}
		seed := time.Now().UnixNano()
		for _, r := range trimmedKind + "|" + prompt + "|" + previousSummary {
			seed += int64(r)
			seed = seed*31 + 17
		}
		if seed < 0 {
			seed = -seed
		}
		primary := recipes[int(seed%int64(len(recipes)))]
		secondary := recipes[int((seed+1)%int64(len(recipes)))]
		contractA := layoutContracts[int(seed%int64(len(layoutContracts)))]
		contractB := layoutContracts[int((seed+2)%int64(len(layoutContracts)))]
		return fmt.Sprintf(`
[시각 다양성 강제 규칙]
- 이번 생성 ID: %d. 이 ID마다 다른 Remotion 타임라인 구성을 선택하세요.
- 이번 생성의 시각 시스템은 반드시 "%s"로 시작하고, 필요하면 "%s"의 요소를 보조로 섞으세요.
- 포스터형 한 장 완성보다 씬 카드와 시간축이 보이게 하세요.
- %s
- 보조 변주: %s
- 이번 결과의 필수 구조 차이: %s
- 이번 결과의 추가 구조 차이: %s
- body 또는 main에 data-visual-system="%s" 속성을 넣고, 주요 wrapper class 이름도 이 시스템에 맞게 새로 붙이세요.
- Remotion 결과는 scene, duration, narration, transition cue, caption cue가 분리되어 있어야 합니다.
`, time.Now().UnixNano(), primary.Name, secondary.Name, primary.Rule, secondary.Rule, contractA, contractB, primary.Name)
	}
	recipes := []struct {
		Name string
		Rule string
	}{
		{"스위스 에디토리얼 포스터", "비대칭 그리드, 큰 여백, 굵은 산세리프 제목, 얇은 라인과 번호 체계."},
		{"앱 런칭 대시보드 히어로", "layered screen/mock panel, KPI 칩, 짧은 가치 제안 중심."},
		{"매거진 커버형", "강한 키비주얼, masthead, 기사형 서브라인, 캡션 중심."},
		{"프리미엄 브랜드 룩북", "큰 이미지/제품 영역, 절제된 카피, 넓은 여백, 조용한 CTA."},
		{"브루탈리스트 세일즈 카드", "굵은 테두리, 강한 대비, 큰 숫자, 스티커/태그 CTA."},
		{"데이터 리포트 인포그래픽", "차트/표/프로세스/수치 카드가 주연인 증거 중심 구조."},
		{"모바일 스토리 시퀀스", "세로형 화면 카드, scene stack, 큰 훅 문장과 핵심 카드 중심."},
		{"이벤트 티켓/초대장", "일정/장소/참여 대상/혜택이 티켓처럼 분리되는 구조."},
		{"풀블리드 키비주얼 캠페인", "큰 이미지/제품/브랜드 씬이 화면 대부분을 차지하고 텍스트는 가장자리 안전 영역에 얇게 배치."},
		{"타이포그래픽 런칭 카드", "글자 자체가 주인공이며 굵기, 크기, 방향, 리듬 차이로 메시지를 구성."},
		{"운영 플로우 맵", "중앙 경로, 노드, 화살표, 상태 칩으로 프로세스를 보여주는 흐름형 구조."},
	}
	layoutContracts := []string{
		"hero-title을 상단 중앙에 두지 말고 좌측 25% 또는 우측 25%의 좁은 컬럼에 배치하세요.",
		"정보 카드는 2개 이하로 제한하고 나머지는 timeline, chart, split-panel, quote, checklist 중 다른 요소로 바꾸세요.",
		"CTA는 하단 전체 띠가 아니라 floating pill, corner badge, ticket stub, sidebar button 중 하나로 만드세요.",
		"배경은 베이지 종이/격자가 아니라 solid, photo wash, dark, duotone, editorial white 중 하나를 선택하세요.",
		"제목이 큰 경우 본문 블록은 반대편이 아니라 아래/대각선/오버레이 캡션으로 배치하세요.",
		"이미지/로고/첨부가 있으면 작은 장식이 아니라 35% 이상 면적의 주 시각 요소로 쓰세요.",
	}
	seed := time.Now().UnixNano()
	for _, r := range kind + "|" + prompt + "|" + previousSummary {
		seed += int64(r)
		seed = seed*31 + 17
	}
	if seed < 0 {
		seed = -seed
	}
	primary := recipes[int(seed%int64(len(recipes)))]
	secondary := recipes[int((seed+3)%int64(len(recipes)))]
	contractA := layoutContracts[int(seed%int64(len(layoutContracts)))]
	contractB := layoutContracts[int((seed+2)%int64(len(layoutContracts)))]
	return fmt.Sprintf(`
[시각 다양성 강제 규칙]
- 이번 생성 ID: %d. 이 ID마다 다른 화면 골격을 선택하세요.
- 이번 생성의 시각 시스템은 반드시 "%s"로 시작하고, 필요하면 "%s"의 요소를 보조로 섞으세요.
- 이전 결과처럼 베이지 종이 질감/격자 배경, 왼쪽 큰 제목 + 오른쪽 정보 카드/대시보드, 하단 CTA 띠가 반복되는 템플릿을 기본값으로 쓰지 마세요.
- 같은 주제를 다시 생성해도 레이아웃 골격, 카드 모양, 제목 위치, 이미지 사용 방식, 배경 질감 중 최소 3가지는 달라야 합니다.
- %s
- 보조 변주: %s
- 이번 결과의 필수 구조 차이: %s
- 이번 결과의 추가 구조 차이: %s
- body 또는 main에 data-visual-system="%s" 속성을 넣고, 주요 wrapper class 이름도 이 시스템에 맞게 새로 붙이세요.
- 마케케 앱의 앱 기본 강조색(#ff8c00/#ff6b00)은 앱 UI 색상일 뿐입니다. 프로필 브랜드 색상에 앱 기본 강조색이 없고 사용자가 요구하지 않았다면 결과물의 메인 포인트/CTA/배지 색으로 쓰지 마세요.
`, time.Now().UnixNano(), primary.Name, secondary.Name, primary.Rule, secondary.Rule, contractA, contractB, primary.Name)
}

func (s *Server) buildClaudeDesignEditPrompt(req claudeDesignEditRequest) string {
	sourceText := formatDesignSources(req.ReferenceSources)
	imageRule := ""
	if len(req.ReferenceImages) > 0 {
		imageRule = fmt.Sprintf("\n[첨부 이미지]\n- 첨부 이미지 %d장은 수정 결과의 실제 시각 자산입니다.\n- 현재 HTML에 첨부 이미지가 보이지 않으면 최소 1장은 주요 이미지 영역이나 증거/로고 영역에 반영하세요.\n- 이미지가 필요한 위치에는 <img src=\"#reference-image-N\"> placeholder를 사용하세요.\n", len(req.ReferenceImages))
	}
	return fmt.Sprintf(`[역할] HTML 디자인 편집자입니다.

[절대 출력 규칙]
- 설명 없이 수정된 완전한 HTML만 출력하세요.
- 반드시 <!DOCTYPE html>로 시작하고 </html>로 끝나야 합니다.
- 기존 HTML의 의도와 구조는 유지하되 사용자의 수정 지시를 반영하세요.
- 수정 후에도 제목/본문/CTA가 캔버스 밖으로 나가거나 잘리면 안 됩니다.
- 큰 글자는 clamp()로 제한하고, 한글은 word-break: keep-all; overflow-wrap: break-word를 유지하세요.

[수정 지시]
%s
%s
%s

[현재 HTML]
%s`, req.Instruction, imageRule, sourceText, req.HTML)
}

func (s *Server) runGeminiDesignPrompt(prompt string, images []string, apiKey, model string, timeout time.Duration) (string, error) {
	model = firstNonEmpty(model, s.defaultGeminiGenerateContentModel(apiKey))
	parts := []map[string]any{{"text": prompt}}
	for _, raw := range images {
		mimeType, data := parseDataURL(raw)
		if mimeType == "" || data == "" {
			continue
		}
		parts = append(parts, map[string]any{
			"inline_data": map[string]any{
				"mime_type": mimeType,
				"data":      data,
			},
		})
	}
	payload := map[string]any{
		"contents": []map[string]any{{"parts": parts}},
		"generationConfig": map[string]any{
			"temperature":     0.45,
			"maxOutputTokens": 24000,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return "", fmt.Errorf("Gemini API 요청 실패: %s", redactExternalSecret(err.Error()))
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Gemini API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	candidates, _ := parsed["candidates"].([]any)
	for _, candidate := range candidates {
		c, _ := candidate.(map[string]any)
		content, _ := c["content"].(map[string]any)
		parts, _ := content["parts"].([]any)
		for _, part := range parts {
			partMap, _ := part.(map[string]any)
			if text := strings.TrimSpace(fmt.Sprint(partMap["text"])); text != "" && text != "<nil>" {
				return text, nil
			}
		}
	}
	return "", fmt.Errorf("Gemini 응답 텍스트가 비어 있습니다")
}

type geminiListModelsResponse struct {
	Models []struct {
		Name                       string   `json:"name"`
		SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
	} `json:"models"`
}

func (s *Server) defaultGeminiGenerateContentModel(apiKey string) string {
	candidates := s.geminiGenerateContentCandidates(apiKey, []string{
		s.getSetting("MODELS.gemini_model", s.getSetting("API.gemini_model", "")),
		s.getSetting("MODELS.fast_text_model", ""),
	}, true)
	if len(candidates) > 0 {
		return candidates[0]
	}
	return "gemini-2.5-flash"
}

func (s *Server) geminiGenerateContentCandidates(apiKey string, candidates []string, includeDefaults bool) []string {
	preferred := []string{}
	for _, candidate := range candidates {
		if model := normalizeGeminiGenerateContentModel(candidate); model != "" {
			preferred = append(preferred, model)
		}
	}
	if includeDefaults {
		preferred = append(preferred,
			"gemini-2.5-pro",
			"gemini-2.5-flash",
			"gemini-2.0-flash",
			"gemini-1.5-pro",
			"gemini-1.5-flash",
		)
	}
	preferred = uniqueNonEmptyStrings(preferred)
	available, err := s.listGeminiGenerateContentModels(apiKey, 8*time.Second)
	if err != nil || len(available) == 0 {
		if err != nil {
			log.Printf("[gemini] list models failed, using configured candidates only: %v", err)
		}
		return preferred
	}
	availableSet := map[string]bool{}
	for _, model := range available {
		availableSet[model] = true
	}
	filtered := make([]string, 0, len(preferred))
	for _, model := range preferred {
		if availableSet[model] {
			filtered = append(filtered, model)
		}
	}
	if len(filtered) > 0 {
		return filtered
	}
	for _, model := range available {
		if strings.Contains(model, "pro") && !strings.Contains(model, "image") {
			return []string{model}
		}
	}
	return available[:1]
}

func (s *Server) listGeminiGenerateContentModels(apiKey string, timeout time.Duration) ([]string, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, fmt.Errorf("missing gemini api key")
	}
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models?key=" + url.QueryEscape(apiKey)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Gemini 모델 목록 요청 실패: %s", redactExternalSecret(err.Error()))
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Gemini 모델 목록 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 300))
	}
	var parsed geminiListModelsResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(parsed.Models))
	for _, item := range parsed.Models {
		name := strings.TrimPrefix(strings.TrimSpace(item.Name), "models/")
		if normalizeGeminiGenerateContentModel(name) == "" {
			continue
		}
		for _, method := range item.SupportedGenerationMethods {
			if strings.EqualFold(strings.TrimSpace(method), "generateContent") {
				models = append(models, name)
				break
			}
		}
	}
	return uniqueNonEmptyStrings(models), nil
}

func normalizeGeminiGenerateContentModel(value string) string {
	model := strings.TrimSpace(strings.TrimPrefix(value, "models/"))
	if model == "" {
		return ""
	}
	lower := strings.ToLower(model)
	if strings.Contains(lower, "/") ||
		strings.Contains(lower, "image") ||
		strings.Contains(lower, "imagen") ||
		strings.Contains(lower, "tts") ||
		strings.Contains(lower, "lyria") ||
		strings.Contains(lower, "embedding") ||
		strings.Contains(lower, "aqa") ||
		strings.Contains(lower, "atlas") ||
		strings.Contains(lower, "codex") {
		return ""
	}
	return model
}

func safeExternalErrorDetail(err error) string {
	if err == nil {
		return ""
	}
	return redactExternalSecret(err.Error())
}

func redactExternalSecret(text string) string {
	cleaned := regexp.MustCompile(`(?i)([?&](?:key|api_key|token|access_token)=)[^\s"&]+`).ReplaceAllString(text, `${1}[redacted]`)
	cleaned = regexp.MustCompile(`AIza[0-9A-Za-z_-]{20,}`).ReplaceAllString(cleaned, "AIza[redacted]")
	return cleaned
}

func (s *Server) runAtlasDesignPrompt(prompt string, images []string, apiKey, model string, timeout time.Duration) (string, error) {
	model = firstNonEmpty(model, "openai/gpt-5.4")
	callAtlas := func(includeImages bool) (string, error) {
		content := []map[string]any{{"type": "text", "text": prompt}}
		if includeImages {
			for _, raw := range images {
				if mimeType, data := parseDataURL(raw); mimeType != "" && data != "" {
					content = append(content, map[string]any{
						"type": "image_url",
						"image_url": map[string]any{
							"url": "data:" + mimeType + ";base64," + data,
						},
					})
				}
			}
		}
		message := map[string]any{"role": "user", "content": prompt}
		if len(content) > 1 {
			message["content"] = content
		}
		payload := map[string]any{
			"model":       model,
			"messages":    []map[string]any{message},
			"temperature": 0.45,
			"max_tokens":  24000,
		}
		body, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}
		req, err := http.NewRequest(http.MethodPost, "https://api.atlascloud.ai/v1/chat/completions", bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: timeout}).Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return "", fmt.Errorf("Atlas API 오류 %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(raw)), 500))
		}
		var parsed map[string]any
		if err := json.Unmarshal(raw, &parsed); err != nil {
			return "", err
		}
		choices, _ := parsed["choices"].([]any)
		for _, choice := range choices {
			c, _ := choice.(map[string]any)
			message, _ := c["message"].(map[string]any)
			if text := strings.TrimSpace(fmt.Sprint(message["content"])); text != "" && text != "<nil>" {
				return text, nil
			}
		}
		return "", fmt.Errorf("Atlas 응답 텍스트가 비어 있습니다")
	}
	text, err := callAtlas(true)
	if err == nil || len(images) == 0 {
		return text, err
	}
	// 일부 텍스트 전용 모델은 image_url content 를 거부한다. 그 경우 HTML 안의
	// #reference-image-N placeholder 규칙으로 다시 요청해 첨부 이미지는 후처리에서 채운다.
	return callAtlas(false)
}

func (s *Server) runLangGraphDesignAgent(mode, prompt, html, instruction string, images []string, apiKey, model string, timeout time.Duration) (string, error) {
	scriptPath := filepath.Join(s.config.ProjectRoot, "scripts", "langgraph_design_agent.mjs")
	if _, err := os.Stat(scriptPath); err != nil {
		return "", fmt.Errorf("LangGraph 디자인 에이전트 스크립트를 찾지 못했습니다: %w", err)
	}
	payload := map[string]any{
		"mode":        mode,
		"prompt":      prompt,
		"html":        html,
		"instruction": instruction,
		"images":      images,
		"api_key":     apiKey,
		"model":       firstNonEmpty(model, "openai/gpt-5.4"),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "node", scriptPath)
	cmd.Dir = s.config.ProjectRoot
	cmd.Stdin = bytes.NewReader(body)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("LangGraph 디자인 에이전트 시간 초과")
		}
		return "", fmt.Errorf("LangGraph 디자인 에이전트 실패: %v %s", err, truncate(strings.TrimSpace(stderr.String()), 500))
	}
	var parsed map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &parsed); err != nil {
		return "", fmt.Errorf("LangGraph 디자인 에이전트 응답 파싱 실패: %w", err)
	}
	if strings.TrimSpace(fmt.Sprint(parsed["status"])) != "ok" {
		return "", fmt.Errorf("%s", firstNonEmpty(fmt.Sprint(parsed["error"]), "LangGraph 디자인 에이전트 실패"))
	}
	result := strings.TrimSpace(fmt.Sprint(parsed["html"]))
	if result == "" || result == "<nil>" {
		return "", fmt.Errorf("LangGraph 디자인 에이전트 HTML이 비어 있습니다")
	}
	return result, nil
}

func (s *Server) getSetting(key, fallback string) string {
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(resolveHTTPDataDir(s.config), "naver_blog.db")
	}
	db, err := sql.Open("sqlite", dbPath)
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

func resolveHTTPDataDir(cfg config.Config) string {
	if strings.TrimSpace(cfg.DataDir) != "" {
		return cfg.DataDir
	}
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "Makeke")
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "Makeke")
		}
		return filepath.Join(home, "AppData", "Roaming", "Makeke")
	default:
		return filepath.Join(home, ".makeke")
	}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func hasDotenvKey(path, key string) bool {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	prefix := key + "="
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) && strings.TrimSpace(strings.TrimPrefix(line, prefix)) != "" {
			return true
		}
	}
	return false
}

func parseDataURL(raw string) (string, string) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "data:") {
		return "", ""
	}
	parts := strings.SplitN(raw, ",", 2)
	if len(parts) != 2 {
		return "", ""
	}
	meta := strings.TrimPrefix(parts[0], "data:")
	mimeType := strings.Split(meta, ";")[0]
	if !strings.HasPrefix(mimeType, "image/") {
		return "", ""
	}
	if _, err := base64.StdEncoding.DecodeString(parts[1]); err != nil {
		return "", ""
	}
	return mimeType, parts[1]
}

func extractClaudeDesignHTML(raw string) string {
	text := strings.TrimSpace(raw)
	text = strings.TrimPrefix(text, "```html")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	re := regexp.MustCompile(`(?is)<!DOCTYPE\s+html[\s\S]*?</html>`)
	matches := re.FindAllString(text, -1)
	if len(matches) > 1 {
		return mergeClaudeDesignHTMLDocuments(matches)
	}
	if len(matches) == 1 && strings.TrimSpace(matches[0]) != "" {
		return strings.TrimSpace(matches[0])
	}
	re = regexp.MustCompile(`(?is)<html[\s\S]*?</html>`)
	matches = re.FindAllString(text, -1)
	if len(matches) > 1 {
		return mergeClaudeDesignHTMLDocuments(matches)
	}
	if len(matches) == 1 && strings.TrimSpace(matches[0]) != "" {
		return "<!DOCTYPE html>\n" + strings.TrimSpace(matches[0])
	}
	return ""
}

func buildClaudeDesignAutofillPrompt(req claudeDesignAutofillTemplateRequest) string {
	profileJSON := "{}"
	if len(req.Profile) > 0 {
		if raw, err := json.Marshal(req.Profile); err == nil {
			profileJSON = string(raw)
		}
	}
	return fmt.Sprintf(`마케케디자인의 빠른 템플릿 입력값을 실제 사용자가 바로 쓸 수 있게 채워주세요.

반드시 JSON 객체만 출력하세요. 설명, 마크다운, 코드펜스는 금지합니다.
키는 정확히 brief, brand, audience, goal, materials, size, scope 만 사용하세요.
빈 값은 추론해서 채우되, 사용자가 이미 적은 값은 더 구체적으로 다듬는 정도로 유지하세요.
브랜드/제품명은 명시되지 않았으면 억지로 잘라 만들지 말고 입력 전체의 주제를 자연스럽게 요약하세요.
프로필에 브랜드 색상, 업종, 비즈니스 설명, CTA가 있으면 brand, audience, goal, materials, scope에 자연스럽게 반영하세요.
장수/크기는 형식에 맞게 현실적으로 제안하세요.

[현재 형식]
- kind: %s
- label: %s
- option prompt: %s
- custom option: %s
- insert mode: %s

[사용자 입력]
- 한 줄 설명: %s
- 브랜드/제품: %s
- 대상 고객: %s
- 목적: %s
- 자료/숫자/문구: %s
- 장수/크기: %s
- 프로젝트 범위: %s

[프로필 참고]
%s

[출력 예시]
{"brief":"편의점 신제품 출시를 알리는 카드뉴스","brand":"편의점 신제품","audience":"20~30대 편의점 간식 구매자","goal":"저장과 구매 관심 유도","materials":"제품 사진과 출시일, 가격, 주요 맛 포인트를 우선 사용","size":"5장, 1:1","scope":"훅, 제품 소개, 장점, 구매 상황, 저장/구매 CTA"}`,
		req.Kind,
		req.Label,
		truncate(req.Prompt, 500),
		truncate(req.Custom, 300),
		req.InsertMode,
		truncate(req.Brief, 500),
		req.Brand,
		req.Audience,
		req.Goal,
		req.Materials,
		req.Size,
		req.Scope,
		truncate(profileJSON, 1200),
	)
}

func parseClaudeDesignAutofillFields(raw string) (map[string]any, error) {
	text := strings.TrimSpace(raw)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	if !strings.HasPrefix(text, "{") {
		start := strings.Index(text, "{")
		end := strings.LastIndex(text, "}")
		if start >= 0 && end > start {
			text = text[start : end+1]
		}
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, fmt.Errorf("자동 채우기 JSON 파싱 실패: %w", err)
	}
	fields := map[string]any{}
	for _, key := range []string{"brief", "brand", "audience", "goal", "materials", "size", "scope"} {
		fields[key] = truncate(strings.TrimSpace(fmt.Sprint(parsed[key])), 500)
	}
	return fields, nil
}

func mergeClaudeDesignHTMLDocuments(docs []string) string {
	var styles strings.Builder
	var scripts strings.Builder
	var pages strings.Builder
	styleRe := regexp.MustCompile(`(?is)<style[^>]*>(.*?)</style>`)
	scriptRe := regexp.MustCompile(`(?is)<script[^>]*>(.*?)</script>`)
	bodyRe := regexp.MustCompile(`(?is)<body[^>]*>(.*?)</body>`)
	for i, doc := range docs {
		for _, match := range styleRe.FindAllStringSubmatch(doc, -1) {
			if len(match) > 1 {
				styles.WriteString(scopeMergedPageCSS(match[1], i+1))
				styles.WriteString("\n")
			}
		}
		for _, match := range scriptRe.FindAllStringSubmatch(doc, -1) {
			if len(match) > 1 {
				scripts.WriteString(match[1])
				scripts.WriteString("\n")
			}
		}
		body := doc
		if match := bodyRe.FindStringSubmatch(doc); len(match) > 1 {
			body = match[1]
		}
		pages.WriteString(fmt.Sprintf(`<section class="makeke-page" data-slide="%d" data-makeke-page="%d">%s</section>`, i, i+1, body))
		pages.WriteString("\n")
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Makeke Multi Page Design</title>
<style>
html,body{margin:0;min-height:100%%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1c1c1e;}
.makeke-deck{display:flex;flex-direction:column;gap:40px;padding:40px;box-sizing:border-box;}
.makeke-page{position:relative;overflow:hidden;background:#fff;border-radius:24px;box-shadow:0 18px 55px rgba(0,0,0,.10);min-height:720px;}
%s
html,body{background:#f5f5f7!important;color:#1c1c1e;}
.makeke-deck{background:#f5f5f7!important;}
.makeke-page{background:#fff;color:#1c1c1e;}
</style>
</head>
<body>
<main class="makeke-deck" data-makeke-multi-html="true" data-slide-count="%d">
%s
</main>
<script>%s</script>
</body>
</html>`, styles.String(), len(docs), pages.String(), scripts.String())
}

func scopeMergedPageCSS(css string, pageNumber int) string {
	scope := fmt.Sprintf(`.makeke-page[data-makeke-page="%d"]`, pageNumber)
	out := css
	out = regexp.MustCompile(`(?i)(^|})\s*html\s*,\s*body\s*\{`).ReplaceAllString(out, `${1} `+scope+`{`)
	out = regexp.MustCompile(`(?i)(^|})\s*body\s*\{`).ReplaceAllString(out, `${1} `+scope+`{`)
	out = regexp.MustCompile(`(?i)(^|})\s*html\s*\{`).ReplaceAllString(out, `${1} `+scope+`{`)
	return out
}

func designCanvasSize(aspect string) string {
	switch strings.TrimSpace(aspect) {
	case "9:16":
		return "1080x1920"
	case "1:1":
		return "1080x1080"
	case "A4":
		return "2480x3508"
	case "4:3":
		return "1440x1080"
	default:
		return "1920x1080"
	}
}

func formatDesignSources(sources []map[string]any) string {
	if len(sources) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n[참고 자료 - 반드시 반영]\n")
	b.WriteString("- 아래 자료의 고유명사, 숫자, 문제, 혜택, 출처 맥락을 제목/본문/섹션/캡션/차트 중 적절한 위치에 구체적으로 반영하세요.\n")
	b.WriteString("- 자료가 있는데 일반론만 쓰거나 출처 맥락을 모두 생략하면 실패입니다.\n")
	for i, src := range sources {
		if i >= 12 {
			break
		}
		title := truncate(strings.TrimSpace(fmt.Sprint(src["title"])), 140)
		sourceType := truncate(strings.TrimSpace(fmt.Sprint(firstAny(src["type"], src["source_type"]))), 80)
		snippet := truncate(strings.TrimSpace(fmt.Sprint(firstAny(src["snippet"], src["text"], src["content"]))), 1600)
		link := truncate(strings.TrimSpace(fmt.Sprint(firstAny(src["url"], src["link"]))), 220)
		if sourceType == "" || sourceType == "<nil>" {
			sourceType = "자료"
		}
		b.WriteString(fmt.Sprintf("%d. [%s] %s\n요약/본문: %s\n출처: %s\n", i+1, sourceType, title, snippet, firstNonEmpty(link, "없음")))
	}
	return b.String()
}

func designKindExtraRule(kind string) string {
	trimmedKind := strings.TrimSpace(kind)
	switch {
	case strings.HasPrefix(trimmedKind, "od-"):
		return `[Open Design 흡수 규칙]
- Open Design의 SKILL.md 런타임을 그대로 복제하지 않고, 마케케디자인 안에서 바로 편집 가능한 HTML 아티팩트로 재작성하세요.
- 예쁜 데모 카드가 아니라 웹 프로토타입, SaaS 랜딩, 대시보드, 모바일 온보딩, 소셜 캐러셀, 포스터, 이메일, 디지털 가이드, 문서 페이지처럼 선택한 유형의 실사용 산출물이어야 합니다.
- 첫 화면에서 산출물 유형과 핵심 메시지가 즉시 보여야 하며, CTA/다음 행동과 검토 가능한 상태가 있어야 합니다.
- 빈 상태, 활성 상태, 선택 상태, 진행 상태, 주석/출처, 다운로드/문의 CTA 중 최소 2개 이상을 포함하세요.
- 타이포그래피, 색상, 여백, 계층, 디테일, 기능성, 독창성 관점으로 자체 검토한 것처럼 완성도를 높이세요.
- 브랜드 색상과 프로필 디자인 규칙을 우선하고, 마케케 앱 기본 주황색은 브랜드 색상으로 명시된 경우에만 사용하세요.
- generic placeholder, 의미 없는 아이콘 나열, stock-like 추상 배경, 한 가지 색만 반복하는 단조로운 팔레트는 실패입니다.
- 여러 화면/장면이 필요한 산출물은 section.makeke-page 단위로 나누고, 각 section과 주요 텍스트/카드/CTA/이미지는 data-makeke-id를 가진 독립적으로 클릭 편집 가능한 DOM이어야 합니다.
` + designDeviceFrameRule(trimmedKind)
	case trimmedKind == "mobile-app" || trimmedKind == "mockup" || trimmedKind == "onboarding-flow" || trimmedKind == "landing-app" || trimmedKind == "social-profile":
		return designDeviceFrameRule(trimmedKind)
	case trimmedKind == "shader" || strings.HasPrefix(trimmedKind, "threejs"):
		return `[3D/Three.js 규칙]
- Three.js를 CDN module import로 사용해 실제 3D 씬을 렌더링하세요.
- canvas가 첫 화면 대부분을 차지해야 하며, 카메라/조명/재질/애니메이션 루프/리사이즈 대응을 포함하세요.
- OrbitControls 또는 마우스 드래그 회전 상호작용을 넣으세요.
- 빈 화면 방지를 위한 로딩/오류 fallback을 포함하세요.`
	case trimmedKind == "video" || strings.HasPrefix(trimmedKind, "video-"):
		return `[영상 규칙]
- 영상은 정적인 HTML 카드가 아니라 광고 솔루션용 씬/컷 설계안으로 만드세요.
- 오프닝 훅, 전개, 증거, CTA, 엔드카드 흐름이 시간축에서 읽혀야 합니다.
- scene, caption, cue, transition, sound cue를 분리하고, 장면별 CTA나 신뢰 요소를 명확히 배치하세요.
- 첫 화면에는 단일 포스터형 카드만 두지 말고 흐름 블록이나 장면 미리보기를 함께 보여주세요.`
	case strings.HasPrefix(trimmedKind, "remotion"):
		return `[Remotion 규칙]
- Remotion은 최종 렌더러가 아니라, 나중에 영상화할 수 있는 타임라인/컴포지션 설계안으로 만드세요.
- HTML 결과는 scene, duration, layer, transition, narration cue를 담을 수 있게 구성하고, 씬별로 재사용 가능한 구조를 유지하세요.
- 포스터형 한 장보다는 시간 흐름이 보이는 여러 씬 블록이나 장면 미리보기를 함께 보여주세요.
- 타이포그래피, 마스크, 배경, CTA, 증거 요소는 시간축에 따라 등장/퇴장하도록 설계하세요.`
	case trimmedKind == "mckinsey-pptx":
		return `[컨설팅 PPTX 덱 규칙]
- 특정 회사의 공식 로고/상표/템플릿을 사칭하지 말고, 글로벌 컨설팅 문서에서 기대되는 절제된 비즈니스 덱 스타일로 작성하세요.
- 사용자가 장수를 말하지 않으면 6~8장의 section.makeke-page 슬라이드로 구성하세요.
- 표지, Executive Summary, 이슈 트리, 핵심 분석 차트, 2x2 매트릭스, 권고안, 실행 로드맵을 포함하세요.
- 각 슬라이드는 결론형 헤드라인, 근거 차트/표, 시사점, 페이지 번호, 출처/가정 영역을 갖춰야 합니다.
- PPTX 내보내기에 맞게 16:9 단일 화면 안에서 완결하고, 텍스트가 잘리거나 캔버스 밖으로 나가지 않게 하세요.`
	default:
		if strings.HasPrefix(trimmedKind, "consulting-") {
			return `[컨설팅 산출물 규칙]
- 전략 컨설팅 문서처럼 결론형 헤드라인, 근거 영역, 시사점 영역을 명확히 나누세요.
- 표, 차트, 매트릭스, 타임라인은 편집 가능한 HTML/CSS/SVG 요소로 직접 구성하세요.
- 흰 배경, 얇은 회색 선, 작은 캡션, 페이지 번호, 출처/가정 표기를 포함하세요.
- PPTX 내보내기 시 깨지지 않도록 한 화면 안에 안정적으로 배치하세요.`
		}
		return ""
	}
}

func designDeviceFrameRule(kind string) string {
	trimmed := strings.TrimSpace(kind)
	if trimmed == "" {
		return ""
	}
	return `
[Open Design 공유 기기 프레임]
- 앱/모바일/웹 프로토타입 산출물에는 필요한 경우 마케케에 설치된 공유 프레임 자산을 사용하세요.
- 사용 가능 경로: /static/open-design/frames/iphone-15-pro.html, /static/open-design/frames/android-pixel.html, /static/open-design/frames/ipad-pro.html, /static/open-design/frames/macbook.html, /static/open-design/frames/browser-chrome.html
- 프레임은 <iframe src="/static/open-design/frames/iphone-15-pro.html?screen=...">처럼 ?screen= 경로로 내부 화면을 끼우는 장식 chrome입니다.
- 한 파일 안에서 바로 미리보기가 필요하면 내부 화면을 별도 data URL이나 같은 문서의 srcdoc으로 구성하고, 프레임은 장식 chrome으로만 사용하세요.
- 프레임 안의 실제 앱/웹 화면은 편집 가능한 HTML DOM이어야 하며, 핵심 텍스트/CTA/이미지는 data-makeke-id를 유지하세요.
- 모바일 온보딩은 iPhone 15 Pro 또는 Android Pixel 프레임 3개를 나란히 배치하고, 웹/SaaS 프로토타입은 Browser Chrome 또는 MacBook 프레임으로 첫 화면을 보여주세요.`
}

func designStyleExtraRule(style string) string {
	trimmedStyle := strings.TrimSpace(style)
	switch trimmedStyle {
	case "od-editorial-monocle":
		return `[Open Design 스타일/시스템 팩]
- 시각 방향: 에디토리얼 모노클. 큰 제목, 강한 흑백 대비, 얇은 구분선, 작은 캡션, 잡지형 정보 위계를 사용하세요.
- 장식보다 타이포그래피와 기사식 리듬을 우선하고, 한 화면에서 표지/본문/캡션 관계가 분명해야 합니다.`
	case "od-modern-minimal":
		return `[Open Design 스타일/시스템 팩]
- 시각 방향: 모던 미니멀. 여백, 부드러운 표면, 절제된 색, 명확한 CTA, 단순한 카드 위계를 사용하세요.
- 흐릿한 장식 배경보다 실제 제품/문구/상태가 또렷하게 읽히는 구조를 우선하세요.`
	case "od-tech-utility":
		return `[Open Design 스타일/시스템 팩]
- 시각 방향: 테크 유틸리티. 대시보드형 그리드, 상태 배지, 데이터 카드, 명확한 표와 필터를 사용하세요.
- SaaS/운영 도구처럼 반복 사용자가 빠르게 스캔할 수 있게 밀도와 가독성을 함께 맞추세요.`
	case "od-brutalist":
		return `[Open Design 스타일/시스템 팩]
- 시각 방향: 브루탈리스트 실험. 두꺼운 테두리, 강한 블록, 큰 숫자, 의도적인 대비를 사용하세요.
- 거칠게 보이더라도 정보 구조와 버튼 가독성은 무너지면 안 됩니다.`
	case "od-soft-warm":
		return `[Open Design 스타일/시스템 팩]
- 시각 방향: 소프트 웜. 따뜻한 여백, 부드러운 그림자, 사람 중심의 카피, 편안한 이미지 영역을 사용하세요.
- 베이지 일색으로 흐르지 않게 브랜드 색상과 보조색을 함께 사용하세요.`
	case "od-system-openai":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: OpenAI식 절제와 지성. 넓은 여백, 차분한 흑백/중성 팔레트, 또렷한 문장 위계, 최소한의 선을 사용하세요.
- 특정 회사 로고나 UI를 사칭하지 말고, 조용하고 정확한 정보 설계 원칙만 반영하세요.`
	case "od-system-stripe":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: Stripe식 제품 마케팅. 선명한 그라데이션은 제한적으로, 제품 카드/코드/대시보드 조각을 레이어로 배치하고 CTA를 분명히 하세요.
- 과도한 보라/파랑 반복을 피하고 현재 브랜드 색상을 주 색상으로 재해석하세요.`
	case "od-system-apple":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: Apple식 프리미엄 제품 표현. 큰 제품/이미지, 짧은 문장, 깊은 여백, 정밀한 타이포그래피를 사용하세요.
- 특정 제품 UI나 상표를 복제하지 말고 프리미엄 제품 서사의 구성만 반영하세요.`
	case "od-system-material":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: Material식 체계. 명확한 elevation, 상태, 입력, 토글, 카드, 접근성 있는 컬러 대비를 사용하세요.
- 컴포넌트 상태가 실제 앱처럼 보이게 hover/active/empty 상태를 포함하세요.`
	case "od-system-shadcn":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: Shadcn식 현대 SaaS. 얇은 경계선, 작은 radius, 중성 배경, 깔끔한 form/table/card 구조를 사용하세요.
- 마케팅 과장보다 도구다운 정돈과 재사용 가능한 컴포넌트 계층을 우선하세요.`
	case "od-system-xiaohongshu":
		return `[Open Design 스타일/시스템 팩]
- 디자인 시스템 참고: Xiaohongshu식 콘텐츠 커머스. 세로/정사각 카드, 강한 훅, 이미지 우선 구성, 저장/공유 맥락을 사용하세요.
- 원본 서비스를 복제하지 말고 콘텐츠 발견, 신뢰 후기, 짧은 CTA 구조만 현재 브랜드에 맞게 재작성하세요.`
	default:
		return ""
	}
}

func firstAny(values ...any) any {
	for _, value := range values {
		if strings.TrimSpace(fmt.Sprint(value)) != "" && fmt.Sprint(value) != "<nil>" {
			return value
		}
	}
	return ""
}

func truncate(value string, limit int) string {
	if limit <= 0 || len([]rune(value)) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit]) + "..."
}

type claudeDesignPPTXRequest struct {
	Slides         []string                    `json:"slides"`
	EditableSlides []claudeDesignEditableSlide `json:"editable_slides"`
	AspectRatio    string                      `json:"aspect_ratio"`
	Title          string                      `json:"title"`
	Name           string                      `json:"name"`
}

type claudeDesignEditableSlide struct {
	Width    float64                       `json:"width"`
	Height   float64                       `json:"height"`
	BgColor  string                        `json:"bg_color"`
	Elements []claudeDesignEditableElement `json:"elements"`
}

type claudeDesignEditableElement struct {
	Text     string  `json:"text"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	W        float64 `json:"w"`
	H        float64 `json:"h"`
	FontSize float64 `json:"font_size"`
	Color    string  `json:"color"`
	BgColor  string  `json:"bg_color"`
	Bold     bool    `json:"bold"`
	Align    string  `json:"align"`
}

func (s *Server) handleClaudeDesignExportPPTX(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignPPTXRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	images := decodeClaudeDesignImageSlides(req.Slides)
	if len(images) == 0 && len(req.EditableSlides) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slides 이미지 또는 편집 가능한 슬라이드 배열이 비어있습니다."})
		return
	}
	var pptx []byte
	var err error
	if len(req.EditableSlides) > 0 {
		pptx, err = buildEditablePPTX(req.EditableSlides, images, req.AspectRatio)
	} else {
		pptx, err = buildImagePPTX(images, req.AspectRatio)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	dir := filepath.Join(s.config.DataDir, "output", "claude-design")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	stem := sanitizePPTXName(firstNonEmpty(req.Name, req.Title, "design"))
	name := fmt.Sprintf("%s_%s.pptx", stem, time.Now().Format("20060102_150405"))
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, pptx, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"name":         name,
		"url":          "/api/claude-design/pptx/" + url.PathEscape(name),
		"slides_count": len(images),
		"size_mb":      float64(len(pptx)) / 1024.0 / 1024.0,
	})
}

func (s *Server) handleClaudeDesignExportImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req claudeDesignPPTXRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	images := decodeClaudeDesignImageSlides(req.Slides)
	if len(images) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slides 이미지 배열이 비어있습니다."})
		return
	}
	archive, err := buildImageZIP(images)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	dir := filepath.Join(s.config.DataDir, "output", "claude-design")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	stem := sanitizePPTXName(firstNonEmpty(req.Name, req.Title, "design"))
	name := fmt.Sprintf("%s_images_%s.zip", stem, time.Now().Format("20060102_150405"))
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, archive, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"name":         name,
		"url":          "/api/claude-design/images/" + url.PathEscape(name),
		"images_count": len(images),
		"size_mb":      float64(len(archive)) / 1024.0 / 1024.0,
	})
}

func (s *Server) handleClaudeDesignPPTXDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/claude-design/pptx/")
	if decoded, err := url.PathUnescape(name); err == nil {
		name = decoded
	}
	if name == "" || strings.Contains(name, "/") || !strings.HasSuffix(strings.ToLower(name), ".pptx") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid pptx name"})
		return
	}
	path := filepath.Join(s.config.DataDir, "output", "claude-design", name)
	http.ServeFile(w, r, path)
}

func (s *Server) handleClaudeDesignImagesDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/claude-design/images/")
	if decoded, err := url.PathUnescape(name); err == nil {
		name = decoded
	}
	if name == "" || strings.Contains(name, "/") || !strings.HasSuffix(strings.ToLower(name), ".zip") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid images archive name"})
		return
	}
	path := filepath.Join(s.config.DataDir, "output", "claude-design", name)
	http.ServeFile(w, r, path)
}

func decodeClaudeDesignImageSlides(slides []string) [][]byte {
	images := make([][]byte, 0, len(slides))
	for _, slide := range slides {
		raw := strings.TrimSpace(slide)
		if raw == "" {
			continue
		}
		if idx := strings.Index(raw, ","); strings.HasPrefix(raw, "data:") && idx >= 0 {
			raw = raw[idx+1:]
		}
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err == nil && len(decoded) > 0 {
			images = append(images, decoded)
		}
	}
	return images
}

func buildImageZIP(images [][]byte) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for i, image := range images {
		f, err := zw.Create(fmt.Sprintf("slide_%02d.png", i+1))
		if err != nil {
			_ = zw.Close()
			return nil, err
		}
		if _, err := f.Write(image); err != nil {
			_ = zw.Close()
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildImagePPTX(images [][]byte, aspect string) ([]byte, error) {
	width, height := pptxSlideSize(aspect)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name, body string) error {
		f, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = io.WriteString(f, body)
		return err
	}
	addBytes := func(name string, body []byte) error {
		f, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = f.Write(body)
		return err
	}
	if err := add("[Content_Types].xml", pptxContentTypes(len(images))); err != nil {
		return nil, err
	}
	if err := add("_rels/.rels", pptxRootRels()); err != nil {
		return nil, err
	}
	if err := add("ppt/presentation.xml", pptxPresentationXML(len(images), width, height)); err != nil {
		return nil, err
	}
	if err := add("ppt/_rels/presentation.xml.rels", pptxPresentationRels(len(images))); err != nil {
		return nil, err
	}
	if err := add("ppt/presProps.xml", pptxPresProps()); err != nil {
		return nil, err
	}
	if err := add("ppt/viewProps.xml", pptxViewProps()); err != nil {
		return nil, err
	}
	if err := add("ppt/tableStyles.xml", pptxTableStyles()); err != nil {
		return nil, err
	}
	if err := add("ppt/slideMasters/slideMaster1.xml", pptxSlideMasterXML()); err != nil {
		return nil, err
	}
	if err := add("ppt/slideMasters/_rels/slideMaster1.xml.rels", pptxSlideMasterRels()); err != nil {
		return nil, err
	}
	if err := add("ppt/slideLayouts/slideLayout1.xml", pptxSlideLayoutXML()); err != nil {
		return nil, err
	}
	if err := add("ppt/slideLayouts/_rels/slideLayout1.xml.rels", pptxSlideLayoutRels()); err != nil {
		return nil, err
	}
	if err := add("ppt/theme/theme1.xml", pptxThemeXML()); err != nil {
		return nil, err
	}
	if err := add("docProps/core.xml", pptxCoreProps()); err != nil {
		return nil, err
	}
	if err := add("docProps/app.xml", pptxAppProps(len(images))); err != nil {
		return nil, err
	}
	for i, img := range images {
		n := i + 1
		if err := add(fmt.Sprintf("ppt/slides/slide%d.xml", n), pptxSlideXML(n, width, height, img)); err != nil {
			return nil, err
		}
		if err := add(fmt.Sprintf("ppt/slides/_rels/slide%d.xml.rels", n), pptxSlideRels(n)); err != nil {
			return nil, err
		}
		if err := addBytes(fmt.Sprintf("ppt/media/image%d.png", n), img); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func buildEditablePPTX(slides []claudeDesignEditableSlide, fallbackImages [][]byte, aspect string) ([]byte, error) {
	width, height := pptxSlideSize(aspect)
	if len(slides) == 0 {
		return buildImagePPTX(fallbackImages, aspect)
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	add := func(name, body string) error {
		f, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = io.WriteString(f, body)
		return err
	}
	if err := add("[Content_Types].xml", pptxContentTypes(len(slides))); err != nil {
		return nil, err
	}
	if err := add("_rels/.rels", pptxRootRels()); err != nil {
		return nil, err
	}
	if err := add("ppt/presentation.xml", pptxPresentationXML(len(slides), width, height)); err != nil {
		return nil, err
	}
	if err := add("ppt/_rels/presentation.xml.rels", pptxPresentationRels(len(slides))); err != nil {
		return nil, err
	}
	staticParts := map[string]string{
		"ppt/presProps.xml":                            pptxPresProps(),
		"ppt/viewProps.xml":                            pptxViewProps(),
		"ppt/tableStyles.xml":                          pptxTableStyles(),
		"ppt/slideMasters/slideMaster1.xml":            pptxSlideMasterXML(),
		"ppt/slideMasters/_rels/slideMaster1.xml.rels": pptxSlideMasterRels(),
		"ppt/slideLayouts/slideLayout1.xml":            pptxSlideLayoutXML(),
		"ppt/slideLayouts/_rels/slideLayout1.xml.rels": pptxSlideLayoutRels(),
		"ppt/theme/theme1.xml":                         pptxThemeXML(),
		"docProps/core.xml":                            pptxCoreProps(),
		"docProps/app.xml":                             pptxAppProps(len(slides)),
	}
	for name, body := range staticParts {
		if err := add(name, body); err != nil {
			return nil, err
		}
	}
	for i, slide := range slides {
		n := i + 1
		if err := add(fmt.Sprintf("ppt/slides/slide%d.xml", n), pptxEditableSlideXML(n, slide, width, height)); err != nil {
			return nil, err
		}
		if err := add(fmt.Sprintf("ppt/slides/_rels/slide%d.xml.rels", n), pptxEditableSlideRels()); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func pptxSlideSize(aspect string) (int, int) {
	switch strings.TrimSpace(aspect) {
	case "9:16":
		return 5143500, 9144000
	case "1:1":
		return 9144000, 9144000
	case "4:3":
		return 9144000, 6858000
	case "A4":
		return 7567920, 10690848
	case "Letter":
		return 7772400, 10058400
	default:
		return 12192000, 6858000
	}
}

func pptxContentTypes(count int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`)
	for i := 1; i <= count; i++ {
		b.WriteString(fmt.Sprintf(`<Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`, i))
	}
	b.WriteString(`</Types>`)
	return b.String()
}

func pptxRootRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
}

func pptxPresentationXML(count, width, height int) string {
	var ids strings.Builder
	for i := 1; i <= count; i++ {
		ids.WriteString(fmt.Sprintf(`<p:sldId id="%d" r:id="rId%d"/>`, 255+i, i))
	}
	masterRelID := count + 1
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId%d"/></p:sldMasterIdLst><p:sldIdLst>%s</p:sldIdLst><p:sldSz cx="%d" cy="%d" type="custom"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="ko-KR"/></a:defPPr></p:defaultTextStyle></p:presentation>`, masterRelID, ids.String(), width, height)
}

func pptxPresentationRels(count int) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`)
	for i := 1; i <= count; i++ {
		b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide%d.xml"/>`, i, i))
	}
	b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`, count+1))
	b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>`, count+2))
	b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>`, count+3))
	b.WriteString(fmt.Sprintf(`<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>`, count+4))
	b.WriteString(`</Relationships>`)
	return b.String()
}

func pptxSlideRels(index int) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image%d.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`, index)
}

func pptxSlideXML(index, width, height int, imageBytes []byte) string {
	rect := pptxImageContainRect(imageBytes, width, height)
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/><a:chOff x="0" y="0"/><a:chExt cx="%d" cy="%d"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide Image %d"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`, width, height, width, height, index, rect.X, rect.Y, rect.W, rect.H)
}

type pptxRect struct {
	X     int
	Y     int
	W     int
	H     int
	Scale float64
}

func pptxImageContainRect(imageBytes []byte, width, height int) pptxRect {
	sourceW := float64(width)
	sourceH := float64(height)
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(imageBytes)); err == nil && cfg.Width > 0 && cfg.Height > 0 {
		sourceW = float64(cfg.Width)
		sourceH = float64(cfg.Height)
	}
	return pptxContainRect(sourceW, sourceH, width, height)
}

func pptxContainRect(sourceW, sourceH float64, width, height int) pptxRect {
	if sourceW <= 0 {
		sourceW = float64(width)
	}
	if sourceH <= 0 {
		sourceH = float64(height)
	}
	scaleX := float64(width) / sourceW
	scaleY := float64(height) / sourceH
	scale := scaleX
	if scaleY < scale {
		scale = scaleY
	}
	w := int(sourceW * scale)
	h := int(sourceH * scale)
	return pptxRect{
		X:     (width - w) / 2,
		Y:     (height - h) / 2,
		W:     w,
		H:     h,
		Scale: scale,
	}
}

func pptxEditableSlideRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`
}

func pptxEditableSlideXML(index int, slide claudeDesignEditableSlide, width, height int) string {
	sourceW := slide.Width
	sourceH := slide.Height
	if sourceW <= 0 {
		sourceW = 1200
	}
	if sourceH <= 0 {
		sourceH = 675
	}
	rect := pptxContainRect(sourceW, sourceH, width, height)
	bg := pptxHexColor(slide.BgColor, "FFFFFF")
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="%s"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="%d" cy="%d"/><a:chOff x="0" y="0"/><a:chExt cx="%d" cy="%d"/></a:xfrm></p:grpSpPr>`, bg, width, height, width, height))
	shapeID := 2
	for _, el := range slide.Elements {
		text := strings.TrimSpace(el.Text)
		if text == "" {
			continue
		}
		x := rect.X + int(el.X*rect.Scale)
		y := rect.Y + int(el.Y*rect.Scale)
		w := int(el.W * rect.Scale)
		h := int(el.H * rect.Scale)
		if w < 91440 {
			w = 91440
		}
		if h < 91440 {
			h = 91440
		}
		fontSize := int((el.FontSize * rect.Scale / 12700) * 100)
		if fontSize < 800 {
			fontSize = 1200
		}
		if fontSize > 9600 {
			fontSize = 9600
		}
		align := pptxAlign(el.Align)
		color := pptxHexColor(el.Color, "1C1C1E")
		fill := `<a:noFill/>`
		if hex := pptxOptionalHexColor(el.BgColor); hex != "" {
			fill = fmt.Sprintf(`<a:solidFill><a:srgbClr val="%s"/></a:solidFill>`, hex)
		}
		bold := "0"
		if el.Bold {
			bold = "1"
		}
		b.WriteString(fmt.Sprintf(`<p:sp><p:nvSpPr><p:cNvPr id="%d" name="Editable Text %d"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>%s<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="%s"/><a:r><a:rPr lang="ko-KR" sz="%d" b="%s"><a:solidFill><a:srgbClr val="%s"/></a:solidFill><a:latin typeface="Noto Sans KR"/><a:ea typeface="Noto Sans KR"/></a:rPr><a:t>%s</a:t></a:r><a:endParaRPr lang="ko-KR" sz="%d"/></a:p></p:txBody></p:sp>`, shapeID, shapeID, x, y, w, h, fill, align, fontSize, bold, color, xmlEscape(text), fontSize))
		shapeID++
	}
	b.WriteString(`</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)
	return b.String()
}

func pptxAlign(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "center", "centre":
		return "ctr"
	case "right", "end":
		return "r"
	default:
		return "l"
	}
}

func pptxHexColor(value, fallback string) string {
	if hex := pptxOptionalHexColor(value); hex != "" {
		return hex
	}
	return fallback
}

func pptxOptionalHexColor(value string) string {
	raw := strings.TrimSpace(value)
	raw = strings.TrimPrefix(raw, "#")
	if len(raw) == 3 {
		raw = string([]byte{raw[0], raw[0], raw[1], raw[1], raw[2], raw[2]})
	}
	if matched, _ := regexp.MatchString(`^[0-9a-fA-F]{6}$`, raw); matched {
		return strings.ToUpper(raw)
	}
	return ""
}

func xmlEscape(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;")
	return replacer.Replace(value)
}

func pptxSlideMasterXML() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`
}

func pptxSlideMasterRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`
}

func pptxSlideLayoutXML() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
}

func pptxSlideLayoutRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`
}

func pptxThemeXML() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Makeke"><a:themeElements><a:clrScheme name="Makeke"><a:dk1><a:srgbClr val="1C1C1E"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="2F2F33"/></a:dk2><a:lt2><a:srgbClr val="F5F5F7"/></a:lt2><a:accent1><a:srgbClr val="FF8C00"/></a:accent1><a:accent2><a:srgbClr val="FF6B00"/></a:accent2><a:accent3><a:srgbClr val="FBBF24"/></a:accent3><a:accent4><a:srgbClr val="34C759"/></a:accent4><a:accent5><a:srgbClr val="007AFF"/></a:accent5><a:accent6><a:srgbClr val="5856D6"/></a:accent6><a:hlink><a:srgbClr val="007AFF"/></a:hlink><a:folHlink><a:srgbClr val="5856D6"/></a:folHlink></a:clrScheme><a:fontScheme name="Makeke"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Noto Sans KR"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Noto Sans KR"/></a:minorFont></a:fontScheme><a:fmtScheme name="Makeke"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`
}

func pptxPresProps() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
}

func pptxViewProps() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
}

func pptxTableStyles() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`
}

func pptxCoreProps() string {
	now := time.Now().UTC().Format(time.RFC3339)
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Makeke Design</dc:title><dc:creator>Makeke</dc:creator><cp:lastModifiedBy>Makeke</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">%s</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">%s</dcterms:modified></cp:coreProperties>`, now, now)
}

func pptxAppProps(slideCount int) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Makeke</Application><PresentationFormat>On-screen Show</PresentationFormat><Slides>%d</Slides><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Slides</vt:lpstr></vt:variant><vt:variant><vt:i4>%d</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="%d" baseType="lpstr">%s</vt:vector></TitlesOfParts></Properties>`, slideCount, slideCount, slideCount, pptxSlideTitles(slideCount))
}

func pptxSlideTitles(slideCount int) string {
	var b strings.Builder
	for i := 1; i <= slideCount; i++ {
		b.WriteString(fmt.Sprintf(`<vt:lpstr>Slide %d</vt:lpstr>`, i))
	}
	return b.String()
}

func sanitizePPTXName(name string) string {
	name = regexp.MustCompile(`[^a-zA-Z0-9가-힣_-]+`).ReplaceAllString(strings.TrimSpace(name), "_")
	name = strings.Trim(name, "_")
	if name == "" {
		return "design"
	}
	if len([]rune(name)) > 80 {
		return string([]rune(name)[:80])
	}
	return name
}

func sanitizeClaudeDesignZipPath(raw string) (string, error) {
	name := strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if name == "" || strings.Contains(name, "\x00") {
		return "", errors.New("invalid zip file name")
	}
	if strings.HasPrefix(name, "/") || regexp.MustCompile(`^[A-Za-z]:`).MatchString(name) {
		return "", errors.New("absolute zip paths are not allowed")
	}
	cleaned := pathpkg.Clean(name)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", errors.New("zip paths may not escape the archive root")
	}
	return cleaned, nil
}

func chooseClaudeDesignImportEntry(files []claudeDesignImportedFile) (string, map[string]any) {
	if entry, manifest := chooseClaudeDesignManifestEntry(files); entry != "" {
		return entry, manifest
	}
	html := make([]string, 0)
	for _, file := range files {
		if strings.HasSuffix(strings.ToLower(file.Path), ".html") || strings.HasSuffix(strings.ToLower(file.Path), ".htm") {
			html = append(html, file.Path)
		}
	}
	if len(html) == 0 {
		return "", map[string]any{}
	}
	for _, candidate := range html {
		if strings.EqualFold(candidate, "index.html") {
			return candidate, map[string]any{}
		}
	}
	for _, candidate := range html {
		if strings.EqualFold(pathpkg.Base(candidate), "index.html") {
			return candidate, map[string]any{}
		}
	}
	for _, candidate := range html {
		if !strings.Contains(candidate, "/") {
			return candidate, map[string]any{}
		}
	}
	return html[0], map[string]any{}
}

func chooseClaudeDesignManifestEntry(files []claudeDesignImportedFile) (string, map[string]any) {
	fileMap := make(map[string]bool, len(files))
	for _, file := range files {
		fileMap[file.Path] = true
	}
	for _, file := range files {
		lower := strings.ToLower(pathpkg.Base(file.Path))
		if lower != "artifact-manifest.json" && !strings.HasSuffix(lower, ".artifact.json") {
			continue
		}
		var manifest claudeDesignArtifactManifest
		if err := json.Unmarshal(file.Body, &manifest); err != nil {
			continue
		}
		entry, err := sanitizeClaudeDesignZipPath(manifest.Entry)
		if err != nil || !fileMap[entry] {
			continue
		}
		if !strings.HasSuffix(strings.ToLower(entry), ".html") && !strings.HasSuffix(strings.ToLower(entry), ".htm") {
			continue
		}
		return entry, map[string]any{
			"version":  manifest.Version,
			"kind":     strings.TrimSpace(manifest.Kind),
			"title":    strings.TrimSpace(manifest.Title),
			"entry":    entry,
			"renderer": strings.TrimSpace(manifest.Renderer),
			"status":   strings.TrimSpace(manifest.Status),
			"exports":  manifest.Exports,
			"file":     file.Path,
		}
	}
	return "", map[string]any{}
}

func rewriteClaudeDesignImportAssetRefs(html string, entryFile string, assetID string, files map[string][]byte) string {
	attrRe := regexp.MustCompile(`(?i)\b(src|href)=("([^"]*)"|'([^']*)')`)
	html = attrRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := attrRe.FindStringSubmatch(match)
		if len(parts) < 5 {
			return match
		}
		value := parts[3]
		quote := `"`
		if value == "" {
			value = parts[4]
			quote = `'`
		}
		if rewritten, ok := claudeDesignImportAssetURL(value, entryFile, assetID, files); ok {
			return parts[1] + "=" + quote + rewritten + quote
		}
		return match
	})
	urlRe := regexp.MustCompile(`(?i)url\(\s*['"]?([^'")]+)['"]?\s*\)`)
	html = urlRe.ReplaceAllStringFunc(html, func(match string) string {
		parts := urlRe.FindStringSubmatch(match)
		if len(parts) < 2 {
			return match
		}
		if rewritten, ok := claudeDesignImportAssetURL(strings.TrimSpace(parts[1]), entryFile, assetID, files); ok {
			return "url('" + rewritten + "')"
		}
		return match
	})
	return html
}

func claudeDesignImportAssetURL(rawRef string, entryFile string, assetID string, files map[string][]byte) (string, bool) {
	ref := strings.TrimSpace(rawRef)
	if ref == "" || strings.HasPrefix(ref, "#") {
		return "", false
	}
	lower := strings.ToLower(ref)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "data:") || strings.HasPrefix(lower, "blob:") || strings.HasPrefix(lower, "mailto:") || strings.HasPrefix(lower, "tel:") || strings.HasPrefix(lower, "javascript:") {
		return "", false
	}
	refPath, suffix := splitClaudeDesignImportRef(ref)
	refPath = strings.TrimSpace(strings.ReplaceAll(refPath, "\\", "/"))
	if refPath == "" || strings.Contains(refPath, "\x00") || strings.HasPrefix(refPath, "/") || regexp.MustCompile(`^[A-Za-z]:`).MatchString(refPath) {
		return "", false
	}
	candidates := []string{pathpkg.Clean(refPath)}
	entryDir := pathpkg.Dir(entryFile)
	if entryDir != "." {
		candidates = append(candidates, pathpkg.Clean(pathpkg.Join(entryDir, refPath)))
	}
	for _, candidate := range candidates {
		cleanCandidate, err := sanitizeClaudeDesignZipPath(candidate)
		if err == nil {
			if _, ok := files[cleanCandidate]; ok && cleanCandidate != entryFile {
				return "/api/claude-design/import-asset/" + url.PathEscape(assetID) + "/" + escapeClaudeDesignAssetPath(cleanCandidate) + suffix, true
			}
		}
	}
	return "", false
}

func splitClaudeDesignImportRef(ref string) (string, string) {
	idx := strings.IndexAny(ref, "?#")
	if idx < 0 {
		return ref, ""
	}
	return ref[:idx], ref[idx:]
}

func escapeClaudeDesignAssetPath(assetPath string) string {
	segments := strings.Split(assetPath, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func isPathInside(root string, target string) bool {
	cleanRoot, err := filepath.Abs(root)
	if err != nil {
		cleanRoot = filepath.Clean(root)
	}
	cleanTarget, err := filepath.Abs(target)
	if err != nil {
		cleanTarget = filepath.Clean(target)
	}
	return cleanTarget == cleanRoot || strings.HasPrefix(cleanTarget, cleanRoot+string(filepath.Separator))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (s *Server) openActivityDB() (*sql.DB, error) {
	dbPath := filepath.Join(resolveHTTPDataDir(s.config), "makeke.db")
	return sql.Open("sqlite", dbPath)
}

func (s *Server) ensureActivityTable() {
	s.activityDBOnce.Do(func() {
		db, err := s.openActivityDB()
		if err != nil {
			return
		}
		defer db.Close()
		db.Exec(`CREATE TABLE IF NOT EXISTS activity_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			page TEXT NOT NULL DEFAULT '',
			action TEXT NOT NULL DEFAULT 'view',
			detail TEXT NOT NULL DEFAULT '',
			profile_id INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
		)`)
	})
}

func (s *Server) handleActivityLog(w http.ResponseWriter, r *http.Request) {
	s.ensureActivityTable()
	db, err := s.openActivityDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	if r.Method == http.MethodPost {
		var body struct {
			Page      string `json:"page"`
			Action    string `json:"action"`
			Detail    string `json:"detail"`
			ProfileID int    `json:"profile_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if body.Action == "" {
			body.Action = "view"
		}
		body.Page = truncate(body.Page, 200)
		body.Action = truncate(body.Action, 100)
		body.Detail = truncate(body.Detail, 2000)
		db.Exec(`INSERT INTO activity_log (page, action, detail, profile_id) VALUES (?, ?, ?, ?)`,
			body.Page, body.Action, body.Detail, body.ProfileID)
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}

	if r.Method == http.MethodGet {
		limit := 50
		if v := r.URL.Query().Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		pageFilter := r.URL.Query().Get("page")
		var rows *sql.Rows
		if pageFilter != "" {
			rows, err = db.Query(`SELECT id, page, action, detail, profile_id, created_at FROM activity_log WHERE page = ? ORDER BY id DESC LIMIT ?`, pageFilter, limit)
		} else {
			rows, err = db.Query(`SELECT id, page, action, detail, profile_id, created_at FROM activity_log ORDER BY id DESC LIMIT ?`, limit)
		}
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": []any{}})
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			var id, profileID int
			var page, action, detail, createdAt string
			rows.Scan(&id, &page, &action, &detail, &profileID, &createdAt)
			items = append(items, map[string]any{"id": id, "page": page, "action": action, "detail": detail, "profile_id": profileID, "created_at": createdAt})
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": items})
		return
	}

	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func (s *Server) handleActivityLogSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	db, err := s.openActivityDB()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "pages": []any{}, "total": 0})
		return
	}
	defer db.Close()

	days := 7
	if v := r.URL.Query().Get("days"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 365 {
			days = n
		}
	}

	rows, err := db.Query(`SELECT page, COUNT(*) as cnt FROM activity_log WHERE created_at >= datetime('now', '-' || ? || ' days', 'localtime') GROUP BY page ORDER BY cnt DESC`, days)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "pages": []any{}, "total": 0})
		return
	}
	defer rows.Close()
	pages := []map[string]any{}
	total := 0
	for rows.Next() {
		var page string
		var cnt int
		rows.Scan(&page, &cnt)
		pages = append(pages, map[string]any{"page": page, "count": cnt})
		total += cnt
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "pages": pages, "total": total, "days": days})
}

func (s *Server) handleProxy(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotImplemented, map[string]any{
		"error":           "endpoint not implemented in go-native mode",
		"message":         "이 기능은 현재 Go 서버에서 제공되지 않습니다.",
		"gateway_runtime": s.config.Runtime,
		"mode":            "go-native",
	})
}

func isRetiredAppRoute(path string) bool {
	for _, prefix := range []string{"/api/xiaohongshu/", "/api/kekelink/", "/api/auth/", "/api/access/", "/api/payment/", "/api/license/"} {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	if isRetiredAppRoute(r.URL.Path) {
		http.NotFound(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		s.handleProxy(w, r)
		return
	}
	if r.URL.Path == "/" {
		s.servePage(w, r, filepath.Join(s.config.ProjectRoot, "static", "index.html"))
		return
	}
	if r.URL.Path == "/writer" {
		s.servePage(w, r, filepath.Join(s.config.ProjectRoot, "templates", "index.html"))
		return
	}
	if r.URL.Path == "/automation" {
		s.servePage(w, r, filepath.Join(s.config.ProjectRoot, "templates", "automation.html"))
		return
	}
	http.NotFound(w, r)
}

func (s *Server) servePage(w http.ResponseWriter, r *http.Request, path string) {
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	http.ServeFile(w, r, path)
}

func noCacheForStaticCode(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.ToLower(r.URL.Path)
		if path == "/static/xiaohongshu.html" || path == "/static/kekelink.html" {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || strings.HasPrefix(path, "/static/modules/") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}
		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler) http.Handler {
	return localhttp.CORS(next)
}

func (s *Server) handleProxyError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("[Makeke Go API] reverse proxy error: %v", err)
	writeJSON(w, http.StatusBadGateway, map[string]any{
		"error":           "backend request failed",
		"message":         err.Error(),
		"gateway_runtime": s.config.Runtime,
		"mode":            "go-native",
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}
