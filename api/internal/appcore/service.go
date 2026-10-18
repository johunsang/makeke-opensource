package appcore

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
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

	"makeke/api/internal/config"
	contentapi "makeke/api/internal/content"

	_ "modernc.org/sqlite"
)

type Service struct {
	cfg         config.Config
	dataDir     string
	dbPath      string
	libraryDir  string
	staticDir   string
	browserMu   sync.RWMutex
	browser     browserState
	browserLogs []string
	bridge      *browserBridge
	liveAgents  map[string]*liveAgentState
	agentSeq    int
}

type browserState struct {
	Connected      bool
	CurrentProfile string
	Port           int
	ExtensionPath  string
}

type liveAgentState struct {
	AgentID      string           `json:"agent_id"`
	Task         string           `json:"task"`
	TaskFull     string           `json:"task_full"`
	MaxSteps     int              `json:"max_steps"`
	ScenarioName string           `json:"scenario_name,omitempty"`
	Running      bool             `json:"running"`
	Done         bool             `json:"done"`
	Error        string           `json:"error,omitempty"`
	FinalAnswer  string           `json:"final_answer,omitempty"`
	StatusText   string           `json:"status_text"`
	CreatedAt    string           `json:"created_at,omitempty"`
	UpdatedAt    string           `json:"updated_at,omitempty"`
	Logs         []map[string]any `json:"logs,omitempty"`
}

type configUpdateRequest struct {
	Section string `json:"section"`
	Key     string `json:"key"`
	Value   string `json:"value"`
}

func New(cfg config.Config) *Service {
	dataDir := resolveDataDir(cfg)
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(dataDir, "naver_blog.db")
	}

	s := &Service{
		cfg:         cfg,
		dataDir:     dataDir,
		dbPath:      dbPath,
		libraryDir:  filepath.Join(dataDir, "output", "library"),
		staticDir:   filepath.Join(cfg.ProjectRoot, "static"),
		browserLogs: []string{},
		liveAgents:  map[string]*liveAgentState{},
	}
	_ = s.deleteSetting("AUTH.current_user")
	s.bridge = newBrowserBridge(s)
	s.bridge.start()
	return s
}

func (s *Service) BridgeCommand(command string, params map[string]any, timeout time.Duration) (map[string]any, error) {
	return s.bridge.command(command, params, timeout)
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/app-icon", s.handleAppIcon)
	mux.HandleFunc("/api/config", s.handleConfig)
	mux.HandleFunc("/api/config/update", s.handleConfigUpdate)
	mux.HandleFunc("/api/verify/gemini", s.handleVerifyGemini)
	mux.HandleFunc("/api/verify/naver-datalab", s.handleVerifyNaverDatalab)
	mux.HandleFunc("/api/verify/naver-searchad", s.handleVerifyNaverSearchAd)

	mux.HandleFunc("/api/library/profiles", s.handleLibraryProfiles)
	mux.HandleFunc("/api/library/profiles/", s.handleLibraryProfileSubroutes)
	mux.HandleFunc("/api/library/design-consult", s.handleLibraryDesignConsult)
	mux.HandleFunc("/api/library/default", s.handleLibraryDefault)
	mux.HandleFunc("/api/library/default/", s.handleLibraryDefaultByID)
	mux.HandleFunc("/api/library/image/", s.handleLibraryImage)
	mux.HandleFunc("/api/articles/profile/", s.handleProfileArticlesSubroutes)
	mux.HandleFunc("/api/articles/", s.handleProfileArticleByID)

	mux.HandleFunc("/api/projects", s.handleProjects)
	mux.HandleFunc("/api/projects/", s.handleProjectSubroutes)
	mux.HandleFunc("/api/open-folder", s.handleOpenFolder)
	mux.HandleFunc("/api/ce2/open-folder", s.handleOpenFolder)
	mux.HandleFunc("/api/ce2/assist", s.handleCE2Assist)
	mux.HandleFunc("/api/bag/history", s.handleBlogAgentHistory)
	mux.HandleFunc("/api/bag/history/delete", s.handleBlogAgentHistoryDelete)
	mux.HandleFunc("/api/bag/save-edit", s.handleBlogAgentSaveEdit)
	mux.HandleFunc("/api/ce2/history", s.handleCardnewsHistory)
	mux.HandleFunc("/api/ce2/history/image", s.handleHistoryMedia)
	mux.HandleFunc("/api/ce2/history/delete", s.handleCardnewsHistoryDelete)
	mux.HandleFunc("/api/ce2/history/delete-image", s.handleCardnewsHistoryDeleteImage)
	mux.HandleFunc("/api/sag/history", s.handleSNSAgentHistory)
	mux.HandleFunc("/api/sag/save", s.handleSNSAgentSave)
	mux.HandleFunc("/api/sag/history/delete", s.handleSNSAgentHistoryDelete)
	mux.HandleFunc("/api/sag/save-edit", s.handleSNSAgentSaveEdit)
	mux.HandleFunc("/api/vag/history", s.handleVideoAgentHistory)
	mux.HandleFunc("/api/vag/history/delete", s.handleVideoAgentHistoryDelete)
	mux.HandleFunc("/api/vag/characters", s.handleVideoAgentCharacters)
	mux.HandleFunc("/api/vag/characters/", s.handleVideoAgentCharacterByID)

	mux.HandleFunc("/api/browser/status", s.handleBrowserStatus)
	mux.HandleFunc("/api/browser/bridge-status", s.handleBrowserBridgeStatus)
	mux.HandleFunc("/api/browser/scrape-url", s.handleBrowserBridgeScrapeURL)
	mux.HandleFunc("/api/browser/chrome-diagnostics", s.handleChromeDiagnostics)
	mux.HandleFunc("/api/browser/chrome-profiles", s.handleChromeProfiles)
	mux.HandleFunc("/api/browser/extension-status", s.handleBrowserExtensionStatus)
	mux.HandleFunc("/api/browser/install-extension", s.handleBrowserInstallExtension)
	mux.HandleFunc("/api/browser/launch", s.handleBrowserLaunch)
	mux.HandleFunc("/api/browser/open-extension-folder", s.handleBrowserOpenExtensionFolder)
	mux.HandleFunc("/api/browser/open-chrome-extensions", s.handleBrowserOpenChromeExtensions)
	mux.HandleFunc("/api/browser/reset-extension", s.handleBrowserResetExtension)
	mux.HandleFunc("/api/browser/logs", s.handleBrowserLogs)
	mux.HandleFunc("/api/browser/eval", s.handleBrowserEval)
	mux.HandleFunc("/api/browser/live-agent/start", s.handleBrowserLiveAgentStart)
	mux.HandleFunc("/api/browser/live-agent/list", s.handleBrowserLiveAgentList)
	mux.HandleFunc("/api/browser/live-agent/status", s.handleBrowserLiveAgentStatus)
	mux.HandleFunc("/api/browser/live-agent/stop", s.handleBrowserLiveAgentStop)
	mux.HandleFunc("/api/browser/live-agent/", s.handleBrowserLiveAgentDelete)
	mux.HandleFunc("/api/browser/ai-scenario", s.handleBrowserAIScenario)
	mux.HandleFunc("/api/browser/publish-blog", s.handleBrowserPublishBlog)

	mux.HandleFunc("/api/usage", s.handleUsage)
	mux.HandleFunc("/api/usage/project/", s.handleProjectUsage)
	mux.HandleFunc("/api/template-versions/status", s.handleTemplateVersionStatus)
	mux.HandleFunc("/api/admin/files/summary", s.handleAdminFilesSummary)
	mux.HandleFunc("/api/admin/files/content", s.handleAdminFileContent)
	mux.HandleFunc("/api/admin/files", s.handleAdminFiles)
	mux.HandleFunc("/api/admin/db/tables", s.handleAdminDBTables)
	mux.HandleFunc("/api/admin/db/table/", s.handleAdminDBTable)
	mux.HandleFunc("/api/auto-schedule", s.handleAutoSchedule)
	mux.HandleFunc("/api/auto-schedule/", s.handleAutoScheduleByID)
	mux.HandleFunc("/api/writing-styles", s.handleWritingStyles)
	mux.HandleFunc("/api/writing-styles/", s.handleWritingStylesSubroute)
	mux.HandleFunc("/api/bgm/list", s.handleBGMList)
	mux.HandleFunc("/api/bgm/file/", s.handleBGMFile)
	mux.HandleFunc("/api/bgm/play/", s.handleBGMPlay)
}

func (s *Service) handleAppIcon(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	candidates := []string{
		filepath.Join(s.staticDir, "logo-icon.png"),
		filepath.Join(s.cfg.ProjectRoot, "electron", "icon.png"),
		filepath.Join(s.cfg.ProjectRoot, "electron", "icon128.png"),
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			http.ServeFile(w, r, candidate)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "icon not found"})
}

func (s *Service) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, maskSensitiveSettings(s.loadAllSettings()))
}

func (s *Service) handleConfigUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req configUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	req.Section = strings.TrimSpace(req.Section)
	req.Key = strings.TrimSpace(req.Key)
	if req.Section == "" || req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "section and key are required"})
		return
	}
	value := strings.TrimSpace(req.Value)
	if strings.Contains(strings.ToLower(req.Key), "key") && strings.HasPrefix(value, "- ") {
		value = strings.TrimSpace(strings.TrimPrefix(value, "- "))
	}
	if err := s.setSetting(req.Section+"."+req.Key, value); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"message": fmt.Sprintf("[%s] %s 업데이트 완료", req.Section, req.Key),
	})
}

func (s *Service) handleVerifyGemini(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", ""))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": "Gemini API 키가 설정되지 않았습니다"})
		return
	}
	body := map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": "hi"}}},
		},
	}
	raw, _ := json.Marshal(body)
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + url.QueryEscape(apiKey)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": readResponseSnippet(resp.Body)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"valid": true, "model": "gemini-2.5-flash", "message": "Gemini API 키가 유효합니다"})
}

func (s *Service) handleCE2Assist(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	action := strings.TrimSpace(stringify(req["action"]))
	if action != "organize_biz" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported action"})
		return
	}
	sourceText := strings.TrimSpace(stringify(req["text"]))
	if len([]rune(sourceText)) < 10 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "정리할 내용이 너무 짧습니다"})
		return
	}
	result := fallbackBizDetailMarkdown(sourceText)
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	if apiKey != "" {
		if text, err := callGeminiText(apiKey, "gemini-3.1-pro-preview", buildBizDetailMarkdownPrompt(sourceText), 25*time.Second); err == nil {
			if parsed, parseErr := parseJSONMapFromText(text); parseErr == nil {
				if markdown := strings.TrimSpace(stringify(parsed["markdown"])); markdown != "" {
					result = normalizeBizDetailMarkdown(markdown, sourceText)
				}
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

func buildBizDetailMarkdownPrompt(sourceText string) string {
	return fmt.Sprintf(`당신은 한국 소상공인/브랜드 비즈니스 컨설턴트입니다.
아래 원문을 바탕으로 브랜드 프로필의 "세부 비즈니스 설명"에 저장할 Markdown 문서를 작성하세요.

[작성 기준]
- 결과는 반드시 Markdown 문서여야 합니다.
- 원문에 없는 정보를 확정적으로 지어내지 말고, 추론은 "추정" 또는 "확인 필요"로 표시하세요.
- 블로그 글, 카드뉴스, 상세페이지, SNS, HyperFrames 생성 프롬프트에 바로 들어가도 될 만큼 구체적으로 정리하세요.
- 단순 요약이 아니라 서비스 구조, 고객, 문제, 해결, 차별점, 신뢰 근거, CTA 목적까지 정리하세요.
- 빈 제목이나 콜론만 있는 항목은 금지합니다.
- 반드시 아래 섹션 제목을 포함하세요:
  # 세부 비즈니스 설명.md
  ## 1. 브랜드 한 줄 정의
  ## 2. 핵심 고객
  ## 3. 고객의 문제와 욕구
  ## 4. 제공 서비스와 상품
  ## 5. 차별점과 신뢰 근거
  ## 6. 상담/구매/이용 흐름
  ## 7. 콘텐츠에 반드시 반영할 메시지
  ## 8. 확인 필요 정보

[원문]
%s

[출력 JSON]
{"markdown":"# 세부 비즈니스 설명.md\n..."}

JSON 외 설명은 출력하지 마세요.`, truncateRunes(sourceText, 16000))
}

func normalizeBizDetailMarkdown(markdown string, sourceText string) string {
	markdown = strings.TrimSpace(markdown)
	if markdown == "" {
		return fallbackBizDetailMarkdown(sourceText)
	}
	if !strings.HasPrefix(markdown, "# ") {
		markdown = "# 세부 비즈니스 설명.md\n\n" + markdown
	}
	return markdown
}

func fallbackBizDetailMarkdown(sourceText string) string {
	cleaned := strings.TrimSpace(sourceText)
	lines := splitNonEmptyLines(cleaned)
	summary := truncateRunes(cleaned, 700)
	if len(lines) > 0 {
		summary = truncateRunes(strings.Join(lines[:minInt(len(lines), 5)], "\n"), 700)
	}
	return strings.TrimSpace(fmt.Sprintf(`# 세부 비즈니스 설명.md

## 1. 브랜드 한 줄 정의
- 입력된 정보를 바탕으로 브랜드의 핵심 서비스를 정리해야 합니다.
- 현재 확인된 핵심 설명: %s

## 2. 핵심 고객
- 원문에서 명확한 고객군이 확인되지 않으면 상담/구매 가능성이 높은 고객을 별도로 확인해야 합니다.
- 확인 필요: 주요 고객의 연령, 지역, 예산, 구매 동기.

## 3. 고객의 문제와 욕구
- 고객이 해결하고 싶은 문제, 비교 기준, 선택 불안을 콘텐츠에서 먼저 다뤄야 합니다.
- 확인 필요: 고객이 가장 자주 묻는 질문과 거절 사유.

## 4. 제공 서비스와 상품
- 대표 서비스, 보조 서비스, 추가 옵션을 분리해 정리해야 합니다.
- 확인 필요: 가격 공개 여부, 상담 방식, 예약/구매 경로.

## 5. 차별점과 신뢰 근거
- 경력, 사례, 수치, 후기, 인증, 운영 방식처럼 검증 가능한 근거를 우선 사용합니다.
- 확인 필요: 실제 사용 가능한 증빙 자료.

## 6. 상담/구매/이용 흐름
- 인지 → 문의 → 상담/진단 → 제안 → 구매/예약 → 사후관리 순서로 설명합니다.
- 각 단계의 고객 불안을 줄이는 메시지를 콘텐츠에 반영합니다.

## 7. 콘텐츠에 반드시 반영할 메시지
- 고객의 문제를 먼저 말하고, 서비스가 해결하는 방식을 근거 중심으로 설명합니다.
- 과장 표현보다 실제 과정, 비교 포인트, 선택 기준을 보여줍니다.

## 8. 확인 필요 정보
- 대표 상품/서비스명
- 핵심 고객군
- 지역/운영 시간/문의 채널
- 가격 또는 견적 안내 방식
- 사용 가능한 후기, 사례, 인증, 포트폴리오

## 원문 메모
%s`, truncateRunes(summary, 260), truncateRunes(cleaned, 3000)))
}

func splitNonEmptyLines(text string) []string {
	raw := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(raw))
	for _, line := range raw {
		line = strings.TrimSpace(line)
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func (s *Service) handleLibraryDesignConsult(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	name := strings.TrimSpace(stringify(req["name"]))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "브랜드명을 입력하세요"})
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
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Gemini API 키가 없습니다. 설정에서 Gemini API 키를 저장하세요"})
		return
	}
	prompt := buildBrandDesignConsultPrompt(req)
	text, err := callGeminiText(apiKey, "gemini-3.1-pro-preview", prompt, 180*time.Second)
	if err != nil {
		if isGeminiTimeoutError(err) {
			result := fallbackDesignConsultResult(req, "")
			normalizeDesignConsultResult(req, result)
			result["warning"] = "Gemini 응답 지연으로 로컬 CI/BI Markdown 초안을 생성했습니다. 다시 누르면 AI 컨설팅으로 보강할 수 있습니다."
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
			return
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	result, err := parseJSONMapFromText(text)
	if err != nil {
		result = fallbackDesignConsultResult(req, text)
	}
	normalizeDesignConsultResult(req, result)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "result": result})
}

func isGeminiTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "context deadline exceeded") ||
		strings.Contains(msg, "client.timeout") ||
		strings.Contains(msg, "timeout")
}

func buildBrandDesignConsultPrompt(req map[string]any) string {
	return fmt.Sprintf(`당신은 한국 브랜드 CI/BI 컨설턴트이자 아트 디렉터입니다.
아래 브랜드 프로필의 기본 정보 전체를 근거로 짧고 단순한 콘텐츠 생성용 디자인 가이드를 JSON 하나로만 작성하세요.
업체명, 업종, 서비스 설명, 세부 비즈니스 설명, 비즈니스 목적, 대표 색상, 웹사이트/채널, 연락/위치, 키워드가 서로 어긋나면 안 됩니다.

[브랜드 프로필]
- 브랜드명: %s
- 업종: %s
- 서비스 설명: %s
- 세부 비즈니스: %s
- 연락/위치: %s
- 웹사이트/채널: %s
- 키워드: %s
- 비즈니스 목적: %s
- 현재 대표 색상: %s
- 현재 팔레트: %s
- 기존 브랜드 무드/톤: %s
- 기존 타이포그래피 규칙: %s
- 기존 레이아웃 규칙: %s
- 기존 이미지 규칙: %s
- 기존 CTA 규칙: %s
- 기존 금지 디자인: %s
- 기존 종합 디자인 규칙: %s

[컨설팅 기준]
- 목적은 복잡한 운영 문서가 아니라 생성 모델이 과하게 얽매이지 않는 "짧은 브랜드 힌트"입니다.
- 이미 입력된 대표 색상이나 팔레트가 있으면 최대한 존중하고, 부족한 색만 보정하세요.
- brand_colors는 반드시 5개 HEX 색상 배열로 제안하세요. 순서는 메인, 보조, 배경, 텍스트, 강조입니다.
- design_rules는 Markdown으로 작성하되 12줄 안팎으로 짧게 끝내세요.
- design_rules에는 긴 카드뉴스 표지/본문/CTA 배치 지시, URL 버튼, Before & After 상세 구도, 매체별 세부 운영 규칙을 넣지 마세요.
- 이미지 생성에 전달될 수 있으므로 텍스트 배치, 가격표, CTA 버튼, URL, 가짜 로고를 이미지 안에 그리라는 지시는 절대 쓰지 마세요.
- 카드뉴스/블로그 이미지/영상 배경은 색상과 간단한 컨셉만 참고하고, 카피와 CTA는 앱 편집 레이어에서 처리한다고 적으세요.
- 의료/법률/금융 등 신뢰 업종이면 과장·선정성·효과 보장 금지만 짧게 넣으세요.
- design_rules는 반드시 Markdown 문서 형식으로 작성하세요. 여러 필드로 쪼갠 설명이 아니라 색상부터 컨셉까지 하나의 md 파일처럼 읽혀야 합니다.
- design_rules Markdown에는 아래 제목을 반드시 포함하세요:
  # 브랜드 디자인 규칙.md
  ## 1. 간단 컨셉
  ## 2. 대표 색상 팔레트
  ## 3. 기본 생성 규칙
  ## 4. 금지 규칙
- 빈 항목, 콜론만 있는 항목, "적절히", "명확히", "브랜드답게", "고급스럽게" 같은 추상 표현만 있는 항목은 금지합니다.
- 전체 문서는 350~700자 안에서 끝내세요.

[출력 JSON 스키마]
{
  "brand_colors": ["#123456", "#234567", "#F7F7F2", "#111111", "#D4AF37"],
  "design_rules_lines": ["# 브랜드 디자인 규칙.md", "", "## 1. 간단 컨셉", "- 한 줄 컨셉: ..."]
}

JSON 외 설명은 출력하지 마세요.`,
		stringify(req["name"]),
		stringify(req["business_type"]),
		stringify(req["description"]),
		stringify(req["biz_detail"]),
		stringify(req["contact_info"]),
		stringify(req["website"]),
		stringify(req["keywords"]),
		stringify(req["business_goal"]),
		stringify(req["brand_color"]),
		stringify(req["brand_colors"]),
		stringify(req["design_tone"]),
		stringify(req["typography_rules"]),
		stringify(req["layout_rules"]),
		stringify(req["image_rules"]),
		stringify(req["cta_rules"]),
		stringify(req["design_forbidden"]),
		stringify(req["current_design_rules"]),
	)
}

func callGeminiText(apiKey, model, prompt string, timeout time.Duration) (string, error) {
	body := map[string]any{
		"contents": []map[string]any{{
			"parts": []map[string]string{{"text": prompt}},
		}},
		"generationConfig": map[string]any{
			"temperature":      0.35,
			"responseMimeType": "application/json",
		},
	}
	raw, _ := json.Marshal(body)
	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" + url.PathEscape(model) + ":generateContent?key=" + url.QueryEscape(apiKey)
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	rawResp, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Gemini API 오류 %d: %s", resp.StatusCode, truncateRunes(strings.TrimSpace(string(rawResp)), 500))
	}
	var data map[string]any
	if err := json.Unmarshal(rawResp, &data); err != nil {
		return "", err
	}
	if candidates, ok := data["candidates"].([]any); ok && len(candidates) > 0 {
		if cand, ok := candidates[0].(map[string]any); ok {
			if content, ok := cand["content"].(map[string]any); ok {
				if parts, ok := content["parts"].([]any); ok {
					for _, part := range parts {
						if p, ok := part.(map[string]any); ok {
							if text := strings.TrimSpace(stringify(p["text"])); text != "" {
								return text, nil
							}
						}
					}
				}
			}
		}
	}
	return "", fmt.Errorf("Gemini 응답에 텍스트가 없습니다")
}

func parseJSONMapFromText(text string) (map[string]any, error) {
	cleaned := strings.TrimSpace(text)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)
	if start := strings.Index(cleaned, "{"); start >= 0 {
		if end := strings.LastIndex(cleaned, "}"); end > start {
			cleaned = cleaned[start : end+1]
		}
	}
	var result map[string]any
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, err
	}
	return result, nil
}

func fallbackDesignConsultResult(req map[string]any, text string) map[string]any {
	markdown := strings.TrimSpace(text)
	markdown = strings.TrimPrefix(markdown, "```markdown")
	markdown = strings.TrimPrefix(markdown, "```md")
	markdown = strings.TrimPrefix(markdown, "```")
	markdown = strings.TrimSuffix(markdown, "```")
	markdown = strings.TrimSpace(markdown)
	if markdown == "" {
		markdown = defaultBrandDesignMarkdown(req, designColorsFromAny(req["brand_colors"], req["brand_color"]))
	}
	return map[string]any{
		"brand_colors": designColorsFromAny(req["brand_colors"], req["brand_color"]),
		"design_rules": markdown,
	}
}

func normalizeDesignConsultResult(req map[string]any, result map[string]any) {
	colors := designColorsFromAny(result["brand_colors"], req["brand_colors"], req["brand_color"])
	if len(colors) == 0 {
		colors = []string{"#FF8C00", "#FF6B00", "#FFFFFF", "#1C1C1E", "#FBBF24"}
	}
	result["brand_colors"] = colors

	if lines, ok := result["design_rules_lines"].([]any); ok && len(lines) > 0 {
		parts := make([]string, 0, len(lines))
		for _, line := range lines {
			parts = append(parts, stringify(line))
		}
		result["design_rules"] = strings.Join(parts, "\n")
	}
	if lines, ok := result["design_rules_lines"].([]string); ok && len(lines) > 0 {
		result["design_rules"] = strings.Join(lines, "\n")
	}

	markdown := strings.TrimSpace(stringify(result["design_rules"]))
	if markdown == "" {
		markdown = defaultBrandDesignMarkdown(req, colors)
	}
	if isWeakBrandDesignMarkdown(markdown) {
		markdown = defaultBrandDesignMarkdown(req, colors)
	}
	result["design_rules"] = ensureBrandDesignMarkdown(markdown, colors)
	delete(result, "design_rules_lines")
}

func designColorsFromAny(values ...any) []string {
	seen := map[string]bool{}
	colors := []string{}
	add := func(value string) {
		for _, match := range regexp.MustCompile(`#?[0-9a-fA-F]{6}\b`).FindAllString(value, -1) {
			color := strings.ToUpper(match)
			if !strings.HasPrefix(color, "#") {
				color = "#" + color
			}
			if !seen[color] {
				seen[color] = true
				colors = append(colors, color)
			}
		}
	}
	for _, value := range values {
		switch v := value.(type) {
		case []any:
			for _, item := range v {
				add(stringify(item))
			}
		case []string:
			for _, item := range v {
				add(item)
			}
		default:
			add(stringify(v))
		}
		if len(colors) >= 5 {
			return colors[:5]
		}
	}
	return colors
}

func ensureBrandDesignMarkdown(markdown string, colors []string) string {
	if !strings.Contains(markdown, "# 브랜드 디자인 규칙.md") {
		markdown = "# 브랜드 디자인 규칙.md\n\n" + markdown
	}
	if !strings.Contains(markdown, "## 2. 대표 색상 팔레트") {
		markdown += "\n\n" + brandPaletteMarkdown(colors)
	}
	return markdown
}

func isWeakBrandDesignMarkdown(markdown string) bool {
	cleaned := strings.TrimSpace(markdown)
	if len([]rune(cleaned)) < 220 {
		return true
	}
	weakPhrases := []string{
		"사용처와 금지 사용처를 적습니다",
		"사용처와 금지 사용처를 명확히 정합니다",
		"브랜드가 보여야 하는 첫인상:",
		"핵심 고객이 느껴야 하는 감정:",
		"제목/본문/숫자/자막 사용 규칙:",
		"적절히 사용",
		"고급스럽게 표현",
	}
	for _, phrase := range weakPhrases {
		if strings.Contains(cleaned, phrase) {
			return true
		}
	}
	return strings.Count(cleaned, "\n- ") < 4
}

func defaultBrandDesignMarkdown(req map[string]any, colors []string) string {
	name := defaultText(stringify(req["name"]), "이 브랜드")
	businessType := defaultText(stringify(req["business_type"]), "해당 업종")
	description := defaultText(stringify(req["description"]), "핵심 서비스")
	return strings.Join([]string{
		"# 브랜드 디자인 규칙.md",
		"",
		"## 1. 간단 컨셉",
		"- 한 줄 컨셉: `" + name + "`은 `" + businessType + "` 고객에게 `" + description + "`을 쉽고 신뢰감 있게 보여줍니다.",
		"- 시각 분위기: 밝은 배경, 선명한 메인색, 과하지 않은 보조색으로 정리된 마케팅 도구 느낌을 유지합니다.",
		"",
		brandPaletteMarkdown(colors),
		"",
		"## 3. 기본 생성 규칙",
		"- 카드뉴스, 블로그 이미지, 영상 배경은 위 색상과 간단 컨셉만 참고합니다.",
		"- 카피, CTA, URL, 버튼, 수치 강조는 이미지 안이 아니라 앱의 텍스트/편집 레이어에서 처리합니다.",
		"",
		"## 4. 금지 규칙",
		"- 이미지 안에 글자, 가격표, CTA 버튼, URL, 가짜 로고를 직접 생성하지 않습니다.",
		"- `" + businessType + "` 업종에서 과장, 선정적 비교, 검증되지 않은 효과 보장을 피합니다.",
	}, "\n")
}

func brandPaletteMarkdown(colors []string) string {
	roles := []string{"메인", "보조", "배경", "텍스트", "강조"}
	fallback := []string{"#FF8C00", "#FF6B00", "#FFFFFF", "#1C1C1E", "#FBBF24"}
	lines := []string{"## 2. 대표 색상 팔레트"}
	for i, role := range roles {
		color := fallback[i]
		if i < len(colors) && strings.TrimSpace(colors[i]) != "" {
			color = strings.TrimSpace(colors[i])
		}
		lines = append(lines, fmt.Sprintf("- %s: %s", role, color))
	}
	return strings.Join(lines, "\n")
}

func (s *Service) handleVerifyNaverDatalab(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	clientID := strings.TrimSpace(s.getSetting("NAVER_API.client_id", ""))
	clientSecret := strings.TrimSpace(s.getSetting("NAVER_API.client_secret", ""))
	if clientID == "" || clientSecret == "" {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": "Client ID/Secret이 설정되지 않았습니다"})
		return
	}
	now := time.Now()
	payload := map[string]any{
		"startDate": now.AddDate(0, 0, -7).Format("2006-01-02"),
		"endDate":   now.Format("2006-01-02"),
		"timeUnit":  "date",
		"keywordGroups": []map[string]any{
			{"groupName": "test", "keywords": []string{"네이버"}},
		},
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://openapi.naver.com/v1/datalab/search", bytes.NewReader(raw))
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	req.Header.Set("X-Naver-Client-Id", clientID)
	req.Header.Set("X-Naver-Client-Secret", clientSecret)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": readResponseSnippet(resp.Body)})
		return
	}
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	if results, ok := data["results"].([]any); ok && len(results) > 0 {
		writeJSON(w, http.StatusOK, map[string]any{"valid": true, "message": "네이버 데이터랩 API 키가 유효합니다"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": "응답은 왔지만 데이터가 없습니다"})
}

func (s *Service) handleVerifyNaverSearchAd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	adLicense := strings.TrimSpace(s.getSetting("NAVER_API.ad_api_license", ""))
	adSecret := strings.TrimSpace(s.getSetting("NAVER_API.ad_api_secret", ""))
	adCustomer := strings.TrimSpace(s.getSetting("NAVER_API.ad_customer_id", ""))
	if adLicense == "" || adSecret == "" || adCustomer == "" {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": "검색광고 API License/Secret/Customer ID가 설정되지 않았습니다"})
		return
	}
	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	method := http.MethodGet
	uri := "/keywordstool"
	signature := signNaverSearchAd(timestamp, method, uri, adSecret)
	endpoint := "https://api.searchad.naver.com" + uri + "?hintKeywords=" + url.QueryEscape("테스트") + "&showDetail=1"
	req, err := http.NewRequest(method, endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-API-KEY", adLicense)
	req.Header.Set("X-Customer", adCustomer)
	req.Header.Set("X-Signature", signature)
	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": readResponseSnippet(resp.Body)})
		return
	}
	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": err.Error()})
		return
	}
	if keywordList, ok := data["keywordList"].([]any); ok && len(keywordList) > 0 {
		writeJSON(w, http.StatusOK, map[string]any{"valid": true, "message": fmt.Sprintf("검색광고 API 유효 (키워드 %d개 조회됨)", len(keywordList))})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"valid": false, "error": "응답은 왔지만 데이터가 없습니다"})
}

func (s *Service) handleLibraryProfiles(w http.ResponseWriter, r *http.Request) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	switch r.Method {
	case http.MethodGet:
		if !tableExists(db, "brand_profiles") {
			writeJSON(w, http.StatusOK, []map[string]any{})
			return
		}

		rows, err := db.Query(`SELECT * FROM brand_profiles ORDER BY updated_at DESC`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		items, err := rowsToMaps(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		for _, item := range items {
			normalizeProfile(item)
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		if err := ensureBrandProfilesTable(db); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		name := strings.TrimSpace(stringify(req["name"]))
		if name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "업체명을 입력하세요"})
			return
		}
		now := time.Now().Format("2006-01-02 15:04:05")
		result, err := db.Exec(`INSERT INTO brand_profiles (
			name, business_type, description, contact_info, website, biz_detail, brand_color,
			brand_colors, design_rules, design_tone, typography_rules, layout_rules,
			image_rules, cta_rules, design_forbidden, keywords, tone, writing_style,
			business_goal, platform_accounts, content_options, cta_text,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			name,
			stringify(req["business_type"]),
			stringify(req["description"]),
			stringify(req["contact_info"]),
			stringify(req["website"]),
			stringify(req["biz_detail"]),
			stringify(req["brand_color"]),
			stringify(req["brand_colors"]),
			stringify(req["design_rules"]),
			stringify(req["design_tone"]),
			stringify(req["typography_rules"]),
			stringify(req["layout_rules"]),
			stringify(req["image_rules"]),
			stringify(req["cta_rules"]),
			stringify(req["design_forbidden"]),
			stringify(req["keywords"]),
			defaultText(stringify(req["tone"]), "mystyle"),
			stringify(req["writing_style"]),
			stringify(req["business_goal"]),
			stringify(req["platform_accounts"]),
			stringify(req["content_options"]),
			stringify(req["cta_text"]),
			now,
			now,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		profileID, _ := result.LastInsertId()
		_ = os.MkdirAll(filepath.Join(s.libraryDir, strconv.FormatInt(profileID, 10)), 0o755)
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": profileID})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleLibraryProfileSubroutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/library/profiles/")
	if path == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	parts := strings.Split(path, "/")
	profileID, err := strconv.Atoi(parts[0])
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if len(parts) > 1 {
		switch {
		case len(parts) == 2 && parts[1] == "chrome-profile":
			s.handleLibraryChromeProfile(w, r, profileID)
		case len(parts) == 2 && parts[1] == "logo":
			s.handleLibraryProfileLogo(w, r, profileID)
		case len(parts) == 2 && parts[1] == "images":
			s.handleLibraryProfileImages(w, r, profileID)
		case len(parts) == 3 && parts[1] == "images":
			s.handleLibraryProfileImageDelete(w, r, profileID, parts[2])
		case len(parts) == 2 && parts[1] == "ai-image":
			s.handleLibraryProfileAIImage(w, r, profileID)
		case len(parts) == 2 && parts[1] == "design-ref":
			s.handleLibraryProfileDesignRef(w, r, profileID)
		case len(parts) == 2 && parts[1] == "design-refs":
			s.handleLibraryProfileDesignRefs(w, r, profileID)
		case len(parts) == 3 && parts[1] == "design-ref":
			s.handleLibraryProfileDesignRefDelete(w, r, profileID, parts[2])
		case len(parts) == 2 && parts[1] == "biz-detail-file":
			s.handleLibraryProfileBizDetailFile(w, r, profileID)
		default:
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		}
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	if r.Method != http.MethodGet {
		if err := ensureBrandProfilesTable(db); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	switch r.Method {
	case http.MethodGet:
		if !tableExists(db, "brand_profiles") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
			return
		}

		row, err := querySingleMap(db, `SELECT * FROM brand_profiles WHERE id = ?`, profileID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		normalizeProfile(row)
		writeJSON(w, http.StatusOK, row)
	case http.MethodPut:
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM brand_profiles WHERE id = ?`, profileID).Scan(&exists); err != nil || exists == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
			return
		}
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		if err := updateBrandProfileFields(db, profileID, req); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	case http.MethodDelete:
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM brand_profiles WHERE id = ?`, profileID).Scan(&exists); err != nil || exists == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
			return
		}
		if _, err := db.Exec(`DELETE FROM brand_profiles WHERE id = ?`, profileID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		_ = os.RemoveAll(filepath.Join(s.libraryDir, strconv.Itoa(profileID)))
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleLibraryProfileLogo(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		s.serveProfileLogo(w, r, profileID)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.ensureLibraryProfileExists(profileID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	files, err := s.saveProfileMultipartImages(r, profileID, "", "logo")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "업로드할 이미지가 없습니다"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if _, err := db.Exec(`UPDATE brand_profiles SET logo_path = ?, updated_at = ? WHERE id = ?`, files[0], time.Now().Format("2006-01-02 15:04:05"), profileID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"filename": files[0],
		"url":      fmt.Sprintf("/api/library/image/%d/%s", profileID, url.PathEscape(files[0])),
	})
}

func (s *Service) serveProfileLogo(w http.ResponseWriter, r *http.Request, profileID int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	var logoPath string
	row := db.QueryRow(`SELECT COALESCE(logo_path,'') FROM brand_profiles WHERE id = ?`, profileID)
	if err := row.Scan(&logoPath); err != nil || logoPath == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "로고를 찾을 수 없습니다."})
		return
	}
	target := filepath.Join(s.libraryDir, fmt.Sprintf("%d", profileID), filepath.Clean(logoPath))
	if !fileExists(target) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "로고 파일을 찾을 수 없습니다."})
		return
	}
	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(target))); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	http.ServeFile(w, r, target)
}

func (s *Service) handleLibraryProfileImages(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.ensureLibraryProfileExists(profileID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	files, err := s.saveProfileMultipartImages(r, profileID, "", "image")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	images, err := s.appendLibraryProfileImages(profileID, files)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "filenames": files, "images": images})
}

func (s *Service) handleLibraryProfileImageDelete(w http.ResponseWriter, r *http.Request, profileID int, rawFilename string) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	filename := safeProfileAssetFilename(rawFilename)
	if filename == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}
	_ = os.Remove(filepath.Join(s.libraryDir, strconv.Itoa(profileID), filename))
	images, err := s.removeLibraryProfileImage(profileID, filename)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "images": images})
}

func (s *Service) handleLibraryProfileDesignRef(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.ensureLibraryProfileExists(profileID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	files, err := s.saveProfileMultipartImages(r, profileID, "design_refs", "design-ref")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "업로드할 이미지가 없습니다"})
		return
	}
	relative := pathJoinURL("design_refs", files[0])
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"filename": files[0],
		"url":      fmt.Sprintf("/api/library/image/%d/%s", profileID, relative),
	})
}

func (s *Service) handleLibraryProfileDesignRefs(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	dir := filepath.Join(s.libraryDir, strconv.Itoa(profileID), "design_refs")
	entries, err := os.ReadDir(dir)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"items": []map[string]any{}, "refs": []map[string]any{}})
		return
	}
	items := make([]map[string]any, 0)
	for _, entry := range entries {
		if entry.IsDir() || !isProfileImageFilename(entry.Name()) {
			continue
		}
		items = append(items, map[string]any{
			"filename": entry.Name(),
			"url":      fmt.Sprintf("/api/library/image/%d/%s", profileID, pathJoinURL("design_refs", entry.Name())),
		})
	}
	sort.Slice(items, func(i, j int) bool { return stringify(items[i]["filename"]) < stringify(items[j]["filename"]) })
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "refs": items})
}

func (s *Service) handleLibraryProfileDesignRefDelete(w http.ResponseWriter, r *http.Request, profileID int, rawFilename string) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	filename := safeProfileAssetFilename(rawFilename)
	if filename == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid filename"})
		return
	}
	_ = os.Remove(filepath.Join(s.libraryDir, strconv.Itoa(profileID), "design_refs", filename))
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleLibraryProfileBizDetailFile(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	rawContent := strings.TrimSpace(stringify(req["content"]))
	if len([]rune(rawContent)) < 20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "저장할 내용이 너무 짧습니다"})
		return
	}
	content := normalizeBizDetailMarkdown(rawContent, "")
	dir := filepath.Join(s.libraryDir, strconv.Itoa(profileID))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	filename := "세부 비즈니스 설명.md"
	target := filepath.Join(dir, filename)
	if err := os.WriteFile(target, []byte(content+"\n"), 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"filename": filename,
		"path":     target,
	})
}

func (s *Service) handleLibraryProfileAIImage(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.ensureLibraryProfileExists(profileID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	var req struct {
		Prompt          string   `json:"prompt"`
		Aspect          string   `json:"aspect"`
		Provider        string   `json:"provider"`
		Model           string   `json:"model"`
		ReferenceImages []string `json:"reference_images"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "프롬프트를 입력하세요"})
		return
	}
	provider := strings.TrimSpace(req.Provider)
	if provider == "" {
		provider = strings.TrimSpace(s.getSetting("MODELS.image_provider", ""))
	}
	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = strings.TrimSpace(s.getSetting("MODELS.image_model", ""))
	}
	referenceImages := append([]string{}, req.ReferenceImages...)
	if len(referenceImages) == 0 {
		referenceImages = s.collectLibraryProfileReferenceImages(profileID, 6)
	}
	if len(referenceImages) == 0 && strings.Contains(strings.ToLower(model), "/edit") {
		if strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", ""))) != "" || strings.TrimSpace(os.Getenv("GEMINI_API_KEY")) != "" || strings.TrimSpace(os.Getenv("GOOGLE_API_KEY")) != "" {
			provider = "gemini"
			model = "gemini-3.1-flash-image-preview"
		} else {
			provider = "codex"
			model = "codex-cli"
		}
	}
	imageURL, detail, err := s.generateProfileAIImage(req.Prompt, defaultText(req.Aspect, "1:1"), provider, model, referenceImages)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	imageBytes, mimeType, err := s.downloadProfileGeneratedImage(imageURL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	ext := imageExtensionFromContent(mimeType, imageURL)
	filename := fmt.Sprintf("ai-%d%s", time.Now().UnixNano(), ext)
	dir := filepath.Join(s.libraryDir, strconv.Itoa(profileID))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := os.WriteFile(filepath.Join(dir, filename), imageBytes, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := s.appendLibraryProfileImages(profileID, []string{filename}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"filename": filename,
		"url":      fmt.Sprintf("/api/library/image/%d/%s", profileID, url.PathEscape(filename)),
		"detail":   detail,
	})
}

func (s *Service) generateProfileAIImage(prompt string, aspect string, provider string, model string, referenceImages []string) (string, string, error) {
	payload := map[string]any{
		"topic":            "브랜드 프로필 이미지",
		"objective":        "브랜드 프로필 라이브러리 이미지",
		"tone":             "brand-safe",
		"aspect":           aspect,
		"provider":         provider,
		"model":            model,
		"prompt":           prompt,
		"scene_title":      "프로필 이미지",
		"scene_body":       "브랜드 콘텐츠 제작에 재사용할 참고 이미지",
		"scene_index":      1,
		"reference_images": referenceImages,
	}
	raw, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(context.Background(), 11*time.Minute)
	defer cancel()
	endpoint := fmt.Sprintf("http://127.0.0.1:%d/api/hyperframes/generate-bg-image", s.cfg.Port)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("이미지 생성 API 오류 %d: %s", resp.StatusCode, truncateRunes(strings.TrimSpace(string(body)), 600))
	}
	var data map[string]any
	if err := json.Unmarshal(body, &data); err != nil {
		return "", "", err
	}
	imageURL := strings.TrimSpace(stringify(data["url"]))
	if imageURL == "" {
		return "", "", errors.New("이미지 생성 응답에 URL이 없습니다")
	}
	return imageURL, strings.TrimSpace(stringify(data["detail"])), nil
}

func (s *Service) downloadProfileGeneratedImage(imageURL string) ([]byte, string, error) {
	imageURL = strings.TrimSpace(imageURL)
	if imageURL == "" {
		return nil, "", errors.New("이미지 URL이 비어 있습니다")
	}
	if strings.HasPrefix(imageURL, "/") {
		imageURL = fmt.Sprintf("http://127.0.0.1:%d%s", s.cfg.Port, imageURL)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("생성 이미지 다운로드 실패 %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, "", err
	}
	if len(raw) == 0 {
		return nil, "", errors.New("생성 이미지가 비어 있습니다")
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(raw)
	}
	return raw, contentType, nil
}

func (s *Service) collectLibraryProfileReferenceImages(profileID int, limit int) []string {
	if limit <= 0 {
		limit = 6
	}
	base := filepath.Join(s.libraryDir, strconv.Itoa(profileID))
	candidates := make([]string, 0, limit)
	db, err := s.openDB()
	if err == nil {
		func() {
			defer db.Close()
			var logoPath, imagesJSON string
			if scanErr := db.QueryRow(`SELECT logo_path, images_json FROM brand_profiles WHERE id = ?`, profileID).Scan(&logoPath, &imagesJSON); scanErr != nil {
				return
			}
			if safe := safeProfileAssetFilename(logoPath); safe != "" {
				candidates = append(candidates, filepath.Join(base, safe))
			}
			for _, filename := range parseJSONArrayStrings(imagesJSON) {
				if safe := safeProfileAssetFilename(filename); safe != "" {
					candidates = append(candidates, filepath.Join(base, safe))
				}
				if len(candidates) >= limit {
					return
				}
			}
		}()
	}
	if len(candidates) < limit {
		refDir := filepath.Join(base, "design_refs")
		if entries, readErr := os.ReadDir(refDir); readErr == nil {
			for _, entry := range entries {
				if entry.IsDir() || !isProfileImageFilename(entry.Name()) {
					continue
				}
				candidates = append(candidates, filepath.Join(refDir, entry.Name()))
				if len(candidates) >= limit {
					break
				}
			}
		}
	}
	refs := make([]string, 0, len(candidates))
	seen := map[string]struct{}{}
	for _, path := range candidates {
		if _, ok := seen[path]; ok {
			continue
		}
		seen[path] = struct{}{}
		dataURL, err := localImageFileDataURL(path)
		if err != nil || dataURL == "" {
			continue
		}
		refs = append(refs, dataURL)
		if len(refs) >= limit {
			break
		}
	}
	return refs
}

func (s *Service) saveProfileMultipartImages(r *http.Request, profileID int, subdir string, prefix string) ([]string, error) {
	if err := r.ParseMultipartForm(128 << 20); err != nil {
		return nil, err
	}
	if r.MultipartForm == nil || r.MultipartForm.File == nil {
		return []string{}, nil
	}
	headers := append([]*multipart.FileHeader{}, r.MultipartForm.File["files"]...)
	headers = append(headers, r.MultipartForm.File["file"]...)
	if len(headers) == 0 {
		return []string{}, nil
	}
	dir := filepath.Join(s.libraryDir, strconv.Itoa(profileID))
	if subdir != "" {
		dir = filepath.Join(dir, subdir)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	saved := make([]string, 0, len(headers))
	for i, header := range headers {
		filename, err := s.saveProfileMultipartImage(header, dir, prefix, i)
		if err != nil {
			return saved, err
		}
		if filename != "" {
			saved = append(saved, filename)
		}
	}
	return saved, nil
}

func (s *Service) saveProfileMultipartImage(header *multipart.FileHeader, dir string, prefix string, index int) (string, error) {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !isProfileImageExt(ext) {
		ext = ".png"
	}
	source, err := header.Open()
	if err != nil {
		return "", err
	}
	defer source.Close()
	namePart := safeProfileAssetFilename(strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename)))
	if namePart == "" {
		namePart = "asset"
	}
	filename := fmt.Sprintf("%s-%d-%02d-%s%s", defaultText(prefix, "image"), time.Now().UnixNano(), index+1, namePart, ext)
	target := filepath.Join(dir, filename)
	out, err := os.Create(target)
	if err != nil {
		return "", err
	}
	defer out.Close()
	if _, err := io.Copy(out, io.LimitReader(source, 32<<20)); err != nil {
		return "", err
	}
	return filename, nil
}

func (s *Service) ensureLibraryProfileExists(profileID int) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureBrandProfilesTable(db); err != nil {
		return err
	}
	var exists int
	if err := db.QueryRow(`SELECT COUNT(*) FROM brand_profiles WHERE id = ?`, profileID).Scan(&exists); err != nil {
		return err
	}
	if exists == 0 {
		return errors.New("프로필을 찾을 수 없습니다")
	}
	return nil
}

func (s *Service) appendLibraryProfileImages(profileID int, filenames []string) ([]string, error) {
	db, err := s.openDB()
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if err := ensureBrandProfilesTable(db); err != nil {
		return nil, err
	}
	var raw string
	if err := db.QueryRow(`SELECT images_json FROM brand_profiles WHERE id = ?`, profileID).Scan(&raw); err != nil {
		return nil, err
	}
	images := parseJSONArrayStrings(raw)
	seen := map[string]struct{}{}
	for _, item := range images {
		seen[item] = struct{}{}
	}
	for _, filename := range filenames {
		filename = safeProfileAssetFilename(filename)
		if filename == "" {
			continue
		}
		if _, ok := seen[filename]; ok {
			continue
		}
		seen[filename] = struct{}{}
		images = append(images, filename)
	}
	encoded, _ := json.Marshal(images)
	_, err = db.Exec(`UPDATE brand_profiles SET images_json = ?, updated_at = ? WHERE id = ?`, string(encoded), time.Now().Format("2006-01-02 15:04:05"), profileID)
	return images, err
}

func (s *Service) removeLibraryProfileImage(profileID int, filename string) ([]string, error) {
	db, err := s.openDB()
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if err := ensureBrandProfilesTable(db); err != nil {
		return nil, err
	}
	var raw string
	if err := db.QueryRow(`SELECT images_json FROM brand_profiles WHERE id = ?`, profileID).Scan(&raw); err != nil {
		return nil, err
	}
	images := parseJSONArrayStrings(raw)
	next := make([]string, 0, len(images))
	for _, item := range images {
		if item != filename {
			next = append(next, item)
		}
	}
	encoded, _ := json.Marshal(next)
	_, err = db.Exec(`UPDATE brand_profiles SET images_json = ?, updated_at = ? WHERE id = ?`, string(encoded), time.Now().Format("2006-01-02 15:04:05"), profileID)
	return next, err
}

func (s *Service) handleProfileArticlesSubroutes(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/articles/profile/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	profileID, err := strconv.Atoi(parts[0])
	if err != nil || profileID <= 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}
	switch {
	case action == "" && r.Method == http.MethodGet:
		s.handleProfileArticlesList(w, r, profileID)
	case action == "manual" && r.Method == http.MethodPost:
		s.handleProfileArticleManual(w, r, profileID)
	case action == "naver-blog" && r.Method == http.MethodPost:
		s.handleProfileNaverBlogCollect(w, r, profileID)
	case action == "style-text" && r.Method == http.MethodGet:
		s.handleProfileArticlesStyleText(w, r, profileID)
	case action == "reset" && r.Method == http.MethodDelete:
		s.handleProfileArticlesReset(w, r, profileID, "", "")
	case action == "naver-reset" && r.Method == http.MethodDelete:
		s.handleProfileArticlesReset(w, r, profileID, "blog", "naver")
	case action == "threads-reset" && r.Method == http.MethodDelete:
		s.handleProfileArticlesReset(w, r, profileID, "threads", "threads")
	case action == "threads-chrome" && r.Method == http.MethodPost:
		s.handleProfileThreadsCollect(w, r, profileID)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleProfileArticleByID(w http.ResponseWriter, r *http.Request) {
	id := parseIntDefault(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/articles/"), "/"), 0)
	if id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid article id"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleProfileArticleDetail(w, r, id)
	case http.MethodDelete:
		s.handleProfileArticleDelete(w, r, id)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleProfileArticleDetail(w http.ResponseWriter, r *http.Request, articleID int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	var profileID int
	var title, content, source, platform, account, postURL, publishedAt, createdAt string
	err = db.QueryRow(`SELECT profile_id, title, content, source, platform, account, post_url, published_at, created_at FROM profile_articles WHERE id = ?`, articleID).
		Scan(&profileID, &title, &content, &source, &platform, &account, &postURL, &publishedAt, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "article not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id": articleID, "profile_id": profileID, "title": title, "content": content,
		"source": source, "platform": platform, "account": account, "post_url": postURL,
		"published_at": publishedAt, "created_at": createdAt, "text_length": len([]rune(content)),
	})
}

func (s *Service) handleProfileArticleDelete(w http.ResponseWriter, r *http.Request, articleID int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	res, err := db.Exec(`DELETE FROM profile_articles WHERE id = ?`, articleID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "article not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "deleted": affected})
}

func (s *Service) handleProfileArticlesList(w http.ResponseWriter, r *http.Request, profileID int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	rows, err := db.Query(`SELECT id, title, content, source, platform, account, post_url, published_at, created_at FROM profile_articles WHERE profile_id = ? ORDER BY id DESC LIMIT 500`, profileID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	articles := []map[string]any{}
	counts := map[string]int{"total": 0, "blog": 0, "threads": 0, "twitter": 0}
	for rows.Next() {
		var id int
		var title, content, source, platform, account, postURL, publishedAt, createdAt string
		if err := rows.Scan(&id, &title, &content, &source, &platform, &account, &postURL, &publishedAt, &createdAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		counts["total"]++
		counts[platform]++
		articles = append(articles, map[string]any{
			"id": id, "title": title, "preview": truncateRunes(content, 120),
			"chunk_count": 1, "created_at": createdAt, "source": source, "platform": platform,
			"text_length": len([]rune(content)), "account": account, "published_at": publishedAt, "post_url": postURL,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"articles": articles, "counts": counts, "total_chunks": counts["total"],
		"total_articles": len(articles), "min_required": 100, "style_ready": counts["total"] >= 100,
	})
}

func (s *Service) handleProfileArticleManual(w http.ResponseWriter, r *http.Request, profileID int) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	title := defaultText(strings.TrimSpace(stringify(req["title"])), "직접 입력")
	content := strings.TrimSpace(stringify(req["content"]))
	platform := defaultText(strings.TrimSpace(stringify(req["platform"])), "blog")
	source := defaultText(strings.TrimSpace(stringify(req["source"])), "manual")
	account := strings.TrimSpace(stringify(req["account"]))
	postURL := strings.TrimSpace(stringify(req["post_url"]))
	if len([]rune(content)) < 30 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "본문을 30자 이상 입력하세요."})
		return
	}
	item, err := s.storeProfileArticle(profileID, title, content, source, platform, account, postURL, "")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Service) handleProfileNaverBlogCollect(w http.ResponseWriter, r *http.Request, profileID int) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	blogID := strings.TrimSpace(stringify(req["blog_id"]))
	if blogID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "블로그 ID를 입력하세요."})
		return
	}
	maxPosts := clampInt(parseIntDefault(req["max_posts"], 500), 1, 5000)
	skipExisting := true
	if rawSkip, ok := req["skip_existing"]; ok {
		skipExisting = truthy(rawSkip)
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)
	emit := func(payload map[string]any) {
		raw, _ := json.Marshal(payload)
		_, _ = fmt.Fprintf(w, "data: %s\n\n", raw)
		if flusher != nil {
			flusher.Flush()
		}
	}
	postURLs := discoverNaverBlogPostURLs(blogID, maxPosts)
	emit(map[string]any{"status": "progress", "message": fmt.Sprintf("Colly로 %d개 글 후보를 찾았습니다.", len(postURLs)), "total": len(postURLs)})
	existingURLs := map[string]struct{}{}
	if skipExisting {
		existingURLs = s.existingProfileArticleURLs(profileID, "blog", blogID)
		if len(existingURLs) > 0 {
			emit(map[string]any{"status": "progress", "message": fmt.Sprintf("이미 저장된 글 %d개는 건너뛰고 이어서 수집합니다.", len(existingURLs)), "saved": len(existingURLs), "total": len(postURLs)})
		}
	}
	crawled := 0
	skipped := 0
	failed := 0
	for idx, postURL := range postURLs {
		if _, ok := existingURLs[postURL]; ok {
			skipped++
			if skipped == 1 || skipped%25 == 0 {
				emit(map[string]any{"status": "progress", "message": fmt.Sprintf("이미 저장된 글 %d개 건너뜀", skipped), "current": crawled, "saved": len(existingURLs), "skipped": skipped, "total": len(postURLs)})
			}
			continue
		}
		title, text, err := scrapeNaverBlogPostDirect(postURL)
		if err != nil || len([]rune(text)) < 50 {
			result, scrapeErr := contentapi.ScrapeArticleWithPipeline(s.cfg, postURL, "")
			if scrapeErr != nil {
				failed++
				emit(map[string]any{"status": "error", "message": fmt.Sprintf("[%d] %s", idx+1, truncateRunes(scrapeErr.Error(), 120))})
				continue
			}
			text = strings.TrimSpace(stringify(result["text"]))
			title = defaultText(strings.TrimSpace(stringify(result["title"])), postURL)
		}
		if len([]rune(text)) < 50 {
			failed++
			emit(map[string]any{"status": "error", "message": fmt.Sprintf("[%d] 본문이 너무 짧아 건너뜀", idx+1)})
			continue
		}
		if _, err := s.storeProfileArticle(profileID, title, text, "naver-colly", "blog", blogID, postURL, ""); err != nil {
			failed++
			emit(map[string]any{"status": "error", "message": fmt.Sprintf("[%d] 저장 실패: %s", idx+1, truncateRunes(err.Error(), 120))})
			continue
		}
		crawled++
		emit(map[string]any{"status": "ok", "title": truncateRunes(title, 60), "current": crawled, "saved": len(existingURLs) + crawled, "skipped": skipped, "failed": failed, "total": len(postURLs), "account": blogID, "post_url": postURL})
	}
	emit(map[string]any{"status": "done", "total": len(existingURLs) + crawled, "crawled": crawled, "skipped": skipped, "failed": failed, "found": len(postURLs), "max_posts": maxPosts})
}

func (s *Service) handleProfileThreadsCollect(w http.ResponseWriter, r *http.Request, profileID int) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	username := normalizeThreadsAccount(stringify(req["username"]))
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "스레드 계정을 입력하세요."})
		return
	}
	maxPosts := clampInt(parseIntDefault(req["max_posts"], 100), 1, 500)
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)
	emit := func(payload map[string]any) {
		raw, _ := json.Marshal(payload)
		_, _ = fmt.Fprintf(w, "data: %s\n\n", raw)
		if flusher != nil {
			flusher.Flush()
		}
	}
	emit(map[string]any{"status": "progress", "message": "Chrome 확장 브릿지로 Threads 화면 수집을 시작합니다.", "account": username})
	source := "chrome-extension"
	crawled := 0
	collected := 0
	err := s.collectThreadsFromExtensionStreaming(username, maxPosts, func(message string, fields map[string]any) {
		payload := map[string]any{"status": "progress", "message": message, "account": username}
		for key, value := range fields {
			payload[key] = value
		}
		emit(payload)
	}, func(post threadCollectedPost, found int) error {
		collected = found
		text := strings.TrimSpace(post.Text)
		title := fmt.Sprintf("Threads @%s %02d", username, found)
		if _, err := s.storeProfileArticle(profileID, title, text, source, "threads", username, post.URL, post.PublishedAt); err != nil {
			emit(map[string]any{"status": "error", "message": fmt.Sprintf("[%d] 저장 실패: %s", found, truncateRunes(err.Error(), 120))})
			return nil
		}
		crawled++
		emit(map[string]any{"status": "ok", "title": truncateRunes(text, 60), "current": crawled, "total": maxPosts, "found": found, "account": username, "source": source})
		return nil
	})
	if err != nil {
		extDir := s.managedChromeExtensionDir()
		emit(map[string]any{"status": "error", "message": truncateRunes(err.Error(), 320)})
		emit(map[string]any{"status": "blocked", "message": "스레드 글 수집은 Chrome 확장 프로그램 연결이 필수입니다. 설정 > 일반 설정 > Chrome 확장 연결에서 먼저 연결하세요.", "total": 0, "crawled": 0, "collected": 0, "max_posts": maxPosts, "source": "extension-not-ready", "extension_path": extDir, "limited": true})
		return
	}
	if crawled == 0 {
		extDir := s.managedChromeExtensionDir()
		emit(map[string]any{"status": "blocked", "message": "현재 Chrome 화면에서 수집 가능한 스레드 글을 찾지 못했습니다. Threads 탭이 로그인된 상태인지, 게시글이 화면에 보이는지 확인한 뒤 다시 시도하세요.", "total": 0, "crawled": 0, "collected": 0, "max_posts": maxPosts, "source": "extension-empty", "extension_path": extDir, "limited": true})
		return
	}
	doneMessage := "수집을 완료했습니다."
	if collected < maxPosts {
		doneMessage = "요청한 개수보다 먼저 화면에서 새 글이 멈춰 수집을 마무리했습니다. 로그인 화면이나 공개 노출 제한이 있으면 여기서 멈출 수 있습니다."
	}
	emit(map[string]any{"status": "done", "message": doneMessage, "total": crawled, "crawled": crawled, "collected": collected, "max_posts": maxPosts, "source": source, "limited": collected < maxPosts})
}

func (s *Service) handleProfileArticlesStyleText(w http.ResponseWriter, r *http.Request, profileID int) {
	platform := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("platform")))
	limit := clampInt(parseIntDefault(r.URL.Query().Get("limit"), 100), 1, 200)
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	where := "profile_id = ?"
	args := []any{profileID}
	if platform == "blog" || platform == "threads" || platform == "twitter" {
		where += " AND platform = ?"
		args = append(args, platform)
	}
	args = append(args, limit)
	rows, err := db.Query(`SELECT title, source, platform, content FROM profile_articles WHERE `+where+` ORDER BY id DESC LIMIT ?`, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	sections := []string{}
	for rows.Next() {
		var title, source, itemPlatform, content string
		if err := rows.Scan(&title, &source, &itemPlatform, &content); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		sections = append(sections, fmt.Sprintf("[%s 글 %d]\n제목: %s\n출처: %s\n%s", itemPlatform, len(sections)+1, title, source, truncateRunes(content, 2500)))
	}
	if len(sections) == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"detail": "분석할 수집 글이 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "profile_id": profileID, "platform": defaultText(platform, "all"), "article_count": len(sections), "sample_text": truncateRunes(strings.Join(sections, "\n\n"), 24000)})
}

func (s *Service) handleProfileArticlesReset(w http.ResponseWriter, r *http.Request, profileID int, platform string, sourceFilter string) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	query := `DELETE FROM profile_articles WHERE profile_id = ?`
	args := []any{profileID}
	if platform != "" {
		query += ` AND platform = ?`
		args = append(args, platform)
	}
	if sourceFilter != "" {
		query += ` AND source LIKE ?`
		args = append(args, "%"+sourceFilter+"%")
	}
	result, err := db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	deleted, _ := result.RowsAffected()
	writeJSON(w, http.StatusOK, map[string]any{"message": "프로필 학습 데이터 삭제 완료", "deleted_chunks": deleted})
}

func (s *Service) existingProfileArticleURLs(profileID int, platform string, account string) map[string]struct{} {
	db, err := s.openDB()
	if err != nil {
		return map[string]struct{}{}
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		return map[string]struct{}{}
	}
	query := `SELECT post_url FROM profile_articles WHERE profile_id = ? AND post_url != ''`
	args := []any{profileID}
	if strings.TrimSpace(platform) != "" {
		query += ` AND platform = ?`
		args = append(args, platform)
	}
	if strings.TrimSpace(account) != "" {
		query += ` AND account = ?`
		args = append(args, account)
	}
	rows, err := db.Query(query, args...)
	if err != nil {
		return map[string]struct{}{}
	}
	defer rows.Close()
	urls := map[string]struct{}{}
	for rows.Next() {
		var postURL string
		if err := rows.Scan(&postURL); err != nil {
			continue
		}
		postURL = strings.TrimSpace(postURL)
		if postURL != "" {
			urls[postURL] = struct{}{}
		}
	}
	return urls
}

func ensureProfileArticlesTable(db *sql.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS profile_articles (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	profile_id INTEGER NOT NULL,
	title TEXT DEFAULT '',
	content TEXT NOT NULL,
	source TEXT DEFAULT 'manual',
	platform TEXT DEFAULT 'blog',
	account TEXT DEFAULT '',
	post_url TEXT DEFAULT '',
	published_at TEXT DEFAULT '',
	text_length INTEGER DEFAULT 0,
	created_at TEXT DEFAULT (datetime('now','localtime'))
)`)
	return err
}

func (s *Service) storeProfileArticle(profileID int, title string, content string, source string, platform string, account string, postURL string, publishedAt string) (map[string]any, error) {
	content = strings.TrimSpace(content)
	if len([]rune(content)) < 30 {
		return nil, errors.New("본문을 30자 이상 입력하세요")
	}
	title = defaultText(strings.TrimSpace(title), "제목 없음")
	source = defaultText(strings.TrimSpace(source), "manual")
	platform = defaultText(strings.TrimSpace(platform), "blog")

	db, err := s.openDB()
	if err != nil {
		return nil, err
	}
	defer db.Close()
	if err := ensureProfileArticlesTable(db); err != nil {
		return nil, err
	}
	if strings.TrimSpace(postURL) != "" {
		if _, err := db.Exec(`DELETE FROM profile_articles WHERE profile_id = ? AND post_url = ?`, profileID, postURL); err != nil {
			return nil, err
		}
	}
	result, err := db.Exec(
		`INSERT INTO profile_articles (profile_id, title, content, source, platform, account, post_url, published_at, text_length) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		profileID, title, content, source, platform, account, postURL, publishedAt, len([]rune(content)),
	)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	return map[string]any{
		"id": id, "title": title, "source": source, "platform": platform,
		"account": account, "post_url": postURL, "published_at": publishedAt,
		"text_length": len([]rune(content)), "chunk_count": estimateChunkCount(content),
	}, nil
}

func estimateChunkCount(content string) int {
	length := len([]rune(strings.TrimSpace(content)))
	if length <= 0 {
		return 0
	}
	count := length / 600
	if length%600 != 0 {
		count++
	}
	if count < 1 {
		return 1
	}
	return count
}

func parseIntDefault(value any, fallback int) int {
	switch cast := value.(type) {
	case int:
		if cast > 0 {
			return cast
		}
	case int64:
		if cast > 0 {
			return int(cast)
		}
	case float64:
		if cast > 0 {
			return int(cast)
		}
	case string:
		if parsed, err := strconv.Atoi(strings.TrimSpace(cast)); err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}

func truthy(value any) bool {
	switch cast := value.(type) {
	case bool:
		return cast
	case string:
		v := strings.ToLower(strings.TrimSpace(cast))
		return v == "1" || v == "true" || v == "yes" || v == "on"
	case float64:
		return cast != 0
	case int:
		return cast != 0
	default:
		return false
	}
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

type naverRSS struct {
	Items []naverRSSItem `xml:"channel>item"`
}

type naverRSSItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
}

func discoverNaverBlogPostURLs(blogIDOrURL string, maxPosts int) []string {
	blogID := extractNaverBlogID(blogIDOrURL)
	if blogID == "" {
		return []string{}
	}
	limit := clampInt(maxPosts, 1, 5000)
	urls := make([]string, 0, limit)
	seen := map[string]bool{}
	appendURL := func(postURL string) bool {
		postURL = strings.TrimSpace(postURL)
		if postURL == "" || seen[postURL] {
			return len(urls) >= limit
		}
		seen[postURL] = true
		urls = append(urls, postURL)
		return len(urls) >= limit
	}

	rssURL := "https://rss.blog.naver.com/" + url.PathEscape(blogID) + ".xml"
	req, err := http.NewRequest(http.MethodGet, rssURL, nil)
	if err != nil {
		return []string{}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 Makeke/Colly")
	req.Header.Set("Accept", "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		defer resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20)); readErr == nil {
				var feed naverRSS
				if xml.Unmarshal(body, &feed) == nil {
					for _, item := range feed.Items {
						if appendURL(item.Link) {
							return urls
						}
					}
				}
			}
		}
	}

	for page := 1; page <= 200 && len(urls) < limit; page++ {
		listURL := fmt.Sprintf("https://blog.naver.com/PostTitleListAsync.naver?blogId=%s&currentPage=%d&countPerPage=30", url.QueryEscape(blogID), page)
		req, err := http.NewRequest(http.MethodGet, listURL, nil)
		if err != nil {
			break
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 Makeke/Colly")
		req.Header.Set("Accept", "application/json,text/plain,*/*")
		resp, err := client.Do(req)
		if err != nil || resp == nil {
			break
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		_ = resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 || readErr != nil {
			break
		}
		logNos := extractNaverLogNos(string(body))
		if len(logNos) == 0 {
			break
		}
		for _, logNo := range logNos {
			if appendURL("https://m.blog.naver.com/" + url.PathEscape(blogID) + "/" + url.PathEscape(logNo)) {
				return urls
			}
		}
		if len(logNos) < 30 {
			break
		}
	}
	return urls
}

func extractNaverLogNos(raw string) []string {
	matches := regexp.MustCompile(`(?:"logNo"|logNo)\s*[:=]\s*"?(\d{6,})"?`).FindAllStringSubmatch(raw, -1)
	items := make([]string, 0, len(matches))
	seen := map[string]bool{}
	for _, match := range matches {
		if len(match) < 2 || seen[match[1]] {
			continue
		}
		seen[match[1]] = true
		items = append(items, match[1])
	}
	return items
}

func extractNaverBlogID(input string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return ""
	}
	input = strings.TrimPrefix(input, "@")
	if parsed, err := url.Parse(input); err == nil && parsed.Host != "" {
		host := strings.ToLower(parsed.Host)
		if strings.Contains(host, "blog.naver.com") {
			parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
			if len(parts) > 0 && parts[0] != "" {
				return parts[0]
			}
			if id := strings.TrimSpace(parsed.Query().Get("blogId")); id != "" {
				return id
			}
		}
		return ""
	}
	input = strings.Trim(input, "/ ")
	if strings.ContainsAny(input, " ?#&") {
		return ""
	}
	return input
}

func scrapeNaverBlogPostDirect(postURL string) (string, string, error) {
	blogID, logNo := extractNaverBlogPostIdentity(postURL)
	if blogID == "" || logNo == "" {
		return "", "", errors.New("네이버 글 주소를 해석하지 못했습니다")
	}
	targetURL := fmt.Sprintf("https://m.blog.naver.com/PostView.naver?blogId=%s&logNo=%s", url.QueryEscape(blogID), url.QueryEscape(logNo))
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("네이버 모바일 글 응답 오류 %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return "", "", err
	}
	htmlText := string(raw)
	title := extractMetaContent(htmlText, "og:title")
	text := extractNaverSmartEditorText(htmlText)
	if len([]rune(text)) < 50 {
		return title, text, errors.New("네이버 본문이 너무 짧습니다")
	}
	return defaultText(title, postURL), text, nil
}

func extractNaverBlogPostIdentity(rawURL string) (string, string) {
	rawURL = strings.TrimSpace(rawURL)
	if parsed, err := url.Parse(rawURL); err == nil && parsed.Host != "" {
		blogID := strings.TrimSpace(parsed.Query().Get("blogId"))
		logNo := strings.TrimSpace(parsed.Query().Get("logNo"))
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		if blogID == "" && len(parts) >= 1 {
			blogID = parts[0]
		}
		if logNo == "" && len(parts) >= 2 {
			logNo = parts[1]
		}
		if strings.Contains(strings.ToLower(parsed.Host), "blog.naver.com") {
			return blogID, strings.Trim(logNo, "/")
		}
	}
	return "", ""
}

func extractMetaContent(raw string, property string) string {
	pattern := regexp.MustCompile(`(?is)<meta[^>]+property=["']` + regexp.QuoteMeta(property) + `["'][^>]+content=["']([^"']*)["'][^>]*>`)
	if match := pattern.FindStringSubmatch(raw); len(match) >= 2 {
		return strings.TrimSpace(html.UnescapeString(match[1]))
	}
	return ""
}

func extractNaverSmartEditorText(raw string) string {
	start := strings.Index(raw, `class="se-main-container"`)
	if start < 0 {
		start = strings.Index(raw, `id="postViewArea"`)
	}
	if start >= 0 {
		raw = raw[start:]
	}
	for _, marker := range []string{"SE_DOC_FOOTER", "post_footer", "post_btn2_wrap", "spiLayer"} {
		if end := strings.Index(raw, marker); end > 0 {
			raw = raw[:end]
			break
		}
	}
	paragraphPattern := regexp.MustCompile(`(?is)<p[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>(.*?)</p>`)
	matches := paragraphPattern.FindAllStringSubmatch(raw, -1)
	if len(matches) == 0 {
		matches = regexp.MustCompile(`(?is)<div[^>]*class=["'][^"']*(?:se-module-text|post_ct)[^"']*["'][^>]*>(.*?)</div>`).FindAllStringSubmatch(raw, -1)
	}
	lines := make([]string, 0, len(matches))
	seen := map[string]struct{}{}
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		text := stripHTMLToText(match[1])
		text = strings.ReplaceAll(text, "\u200b", "")
		text = strings.ReplaceAll(text, "​", "")
		text = regexp.MustCompile(`[ \t\r\f\v]+`).ReplaceAllString(text, " ")
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		if _, ok := seen[text]; ok {
			continue
		}
		seen[text] = struct{}{}
		lines = append(lines, text)
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func stripHTMLToText(raw string) string {
	raw = regexp.MustCompile(`(?is)<br\s*/?>`).ReplaceAllString(raw, "\n")
	raw = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`).ReplaceAllString(raw, "")
	raw = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`).ReplaceAllString(raw, "")
	raw = regexp.MustCompile(`(?is)<[^>]+>`).ReplaceAllString(raw, "")
	raw = html.UnescapeString(raw)
	raw = regexp.MustCompile(`\n{3,}`).ReplaceAllString(raw, "\n\n")
	return strings.TrimSpace(raw)
}

func normalizeThreadsAccount(raw string) string {
	value := strings.TrimSpace(raw)
	if decoded, err := url.PathUnescape(value); err == nil {
		value = decoded
	}
	value = stripControlRunes(value)
	value = strings.TrimPrefix(value, "@")
	if value == "" {
		return ""
	}
	if parsed, err := url.Parse(value); err == nil && parsed.Host != "" {
		parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
		for _, part := range parts {
			part = strings.TrimPrefix(strings.TrimSpace(stripControlRunes(part)), "@")
			if part != "" && part != "post" && part != "t" {
				return sanitizeThreadsUsername(part)
			}
		}
	}
	value = strings.Trim(strings.Split(value, "?")[0], "/")
	if strings.Contains(value, "/") {
		parts := strings.Split(value, "/")
		value = parts[len(parts)-1]
	}
	return sanitizeThreadsUsername(strings.TrimPrefix(value, "@"))
}

func stripControlRunes(value string) string {
	return strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, value)
}

func sanitizeThreadsUsername(value string) string {
	value = strings.TrimSpace(strings.TrimPrefix(value, "@"))
	value = regexp.MustCompile(`[^A-Za-z0-9._]+`).ReplaceAllString(value, "")
	return strings.Trim(value, "._")
}

type threadCollectedPost struct {
	Text        string `json:"text"`
	URL         string `json:"url"`
	PublishedAt string `json:"published_at"`
}

func collectThreadsPublicPosts(cfg config.Config, username string, limit int) ([]threadCollectedPost, string, error) {
	if limit <= 0 {
		limit = 100
	}
	profileURL := "https://www.threads.com/@" + url.PathEscape(username)
	req, err := http.NewRequest(http.MethodGet, profileURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if posts := extractThreadsTextsFromHTML(string(raw), limit); len(posts) > 0 {
			return wrapThreadTexts(posts, "", limit), "threads-web", nil
		}
	}
	if posts := collectThreadsViaJinaReader(profileURL, limit); len(posts) > 0 {
		return posts, "threads-jina", nil
	}
	result, scrapeErr := contentapi.ScrapeArticleWithPipeline(cfg, profileURL, "Threads @"+username)
	if scrapeErr != nil {
		return nil, "", fmt.Errorf("Threads 공개 페이지에서 글을 찾지 못했습니다: %s", scrapeErr.Error())
	}
	posts := splitThreadsFallbackText(strings.TrimSpace(stringify(result["text"])), limit)
	if len(posts) == 0 {
		return nil, "", errors.New("Threads 공개 페이지에서 분석할 글을 찾지 못했습니다")
	}
	return wrapThreadTexts(posts, "", limit), "threads-web", nil
}

func collectThreadsViaJinaReader(profileURL string, limit int) []threadCollectedPost {
	readerURL := "https://r.jina.ai/http://r.jina.ai/http://" + profileURL
	req, err := http.NewRequest(http.MethodGet, readerURL, nil)
	if err != nil {
		return []threadCollectedPost{}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 Makeke/ThreadsCollector")
	resp, err := (&http.Client{Timeout: 35 * time.Second}).Do(req)
	if err != nil {
		return []threadCollectedPost{}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return []threadCollectedPost{}
	}
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	return extractThreadsTextsFromMarkdown(string(raw), limit)
}

func extractThreadsTextsFromMarkdown(raw string, limit int) []threadCollectedPost {
	pattern := regexp.MustCompile(`(?m)^\[(.+)\]\(https://www\.threads\.(?:net|com)/@[^)]+/post/[^)]+\)$`)
	seen := map[string]struct{}{}
	posts := make([]threadCollectedPost, 0, limit)
	for _, match := range pattern.FindAllStringSubmatch(raw, -1) {
		text := strings.TrimSpace(strings.TrimSuffix(decodeJSONStringFragment(match[1]), "Read more"))
		text = cleanThreadsCandidateText(text)
		if !isLikelyThreadsPost(text) {
			continue
		}
		if _, ok := seen[text]; ok {
			continue
		}
		seen[text] = struct{}{}
		posts = append(posts, threadCollectedPost{Text: text})
		if len(posts) >= limit {
			break
		}
	}
	return posts
}

func wrapThreadTexts(texts []string, sourceURL string, limit int) []threadCollectedPost {
	items := make([]threadCollectedPost, 0, len(texts))
	for _, text := range texts {
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		items = append(items, threadCollectedPost{Text: text, URL: sourceURL})
		if len(items) >= limit {
			break
		}
	}
	return items
}

func normalizeThreadCollectedPosts(posts []threadCollectedPost, limit int) []threadCollectedPost {
	seen := map[string]struct{}{}
	items := make([]threadCollectedPost, 0, len(posts))
	for _, post := range posts {
		text := cleanThreadsCandidateText(post.Text)
		if !isLikelyThreadsPost(text) {
			continue
		}
		if _, ok := seen[text]; ok {
			continue
		}
		seen[text] = struct{}{}
		post.Text = text
		items = append(items, post)
		if len(items) >= limit {
			break
		}
	}
	return items
}

func extractThreadsTextsFromHTML(raw string, limit int) []string {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?s)"text"\s*:\s*"((?:\\.|[^"\\]){30,900})"`),
		regexp.MustCompile(`(?s)\\"text\\"\s*:\s*\\"((?:\\\\.|[^\\"\\\\]){30,900})\\"`),
		regexp.MustCompile(`(?s)"caption"\s*:\s*\{[^{}]*"text"\s*:\s*"((?:\\.|[^"\\]){30,900})"`),
	}
	seen := map[string]struct{}{}
	posts := make([]string, 0, limit)
	for _, pattern := range patterns {
		for _, match := range pattern.FindAllStringSubmatch(raw, -1) {
			text := cleanThreadsCandidateText(decodeJSONStringFragment(match[1]))
			if !isLikelyThreadsPost(text) {
				continue
			}
			if _, ok := seen[text]; ok {
				continue
			}
			seen[text] = struct{}{}
			posts = append(posts, text)
			if len(posts) >= limit {
				return posts
			}
		}
	}
	return posts
}

func decodeJSONStringFragment(value string) string {
	value = strings.ReplaceAll(value, `\\u`, `\u`)
	value = strings.ReplaceAll(value, `\\"`, `"`)
	decoded, err := strconv.Unquote(`"` + strings.ReplaceAll(value, `"`, `\"`) + `"`)
	if err != nil {
		return html.UnescapeString(value)
	}
	return html.UnescapeString(decoded)
}

func cleanThreadsCandidateText(text string) string {
	text = strings.ReplaceAll(text, `\n`, "\n")
	text = strings.ReplaceAll(text, `\t`, " ")
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func isLikelyThreadsPost(text string) bool {
	runes := len([]rune(text))
	if runes < 25 || runes > 1800 {
		return false
	}
	lower := strings.ToLower(text)
	blocked := []string{"threads", "log in", "sign up", "meta", "instagram", "cookie", "privacy policy", "terms"}
	for _, item := range blocked {
		if lower == item || strings.HasPrefix(lower, item+" ") {
			return false
		}
	}
	return strings.Count(text, "http://")+strings.Count(text, "https://") < 3
}

func splitThreadsFallbackText(text string, limit int) []string {
	parts := regexp.MustCompile(`\n{2,}|(?m)^\s*[-•]\s+`).Split(text, -1)
	posts := make([]string, 0, limit)
	seen := map[string]struct{}{}
	for _, part := range parts {
		candidate := cleanThreadsCandidateText(part)
		if !isLikelyThreadsPost(candidate) {
			continue
		}
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}
		posts = append(posts, candidate)
		if len(posts) >= limit {
			break
		}
	}
	return posts
}

func (s *Service) handleLibraryChromeProfile(w http.ResponseWriter, r *http.Request, profileID int) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	if !tableExists(db, "brand_profiles") {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
		return
	}

	row, err := querySingleMap(db, `SELECT * FROM brand_profiles WHERE id = ?`, profileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	chromeProfile := "Default"

	platformAccounts := map[string]any{}
	rawPlatformAccounts := strings.TrimSpace(stringify(row["platform_accounts"]))
	if rawPlatformAccounts != "" {
		_ = json.Unmarshal([]byte(rawPlatformAccounts), &platformAccounts)
	}
	platformAccounts["chrome_profile"] = chromeProfile
	encodedAccounts := mustJSONObjectString(platformAccounts)

	if _, err := db.Exec(`UPDATE brand_profiles SET platform_accounts = ? WHERE id = ?`, encodedAccounts, profileID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	updatedRow, err := querySingleMap(db, `SELECT * FROM brand_profiles WHERE id = ?`, profileID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	normalizeProfile(updatedRow)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"chrome_profile": chromeProfile,
		"profile":        updatedRow,
	})
}

func (s *Service) handleLibraryDefault(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getDefaultProfile(w)
	case http.MethodDelete:
		if err := s.deleteSetting("default_profile_id"); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleLibraryDefaultByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	profileID, err := strconv.Atoi(strings.TrimPrefix(r.URL.Path, "/api/library/default/"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if !tableExists(db, "brand_profiles") {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
		return
	}
	var exists int
	if err := db.QueryRow(`SELECT COUNT(*) FROM brand_profiles WHERE id = ?`, profileID).Scan(&exists); err != nil || exists == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로필을 찾을 수 없습니다."})
		return
	}
	if err := s.setRawSetting("default_profile_id", strconv.Itoa(profileID)); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "default_profile_id": profileID})
}

func (s *Service) getDefaultProfile(w http.ResponseWriter) {
	defaultID := strings.TrimSpace(s.getSetting("default_profile_id", ""))
	if defaultID == "" {
		writeJSON(w, http.StatusOK, map[string]any{"profile": nil})
		return
	}
	profileID, err := strconv.Atoi(defaultID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"profile": nil})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if !tableExists(db, "brand_profiles") {
		writeJSON(w, http.StatusOK, map[string]any{"profile": nil})
		return
	}
	row, err := querySingleMap(db, `SELECT * FROM brand_profiles WHERE id = ?`, profileID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"profile": nil})
		return
	}
	normalizeProfile(row)
	writeJSON(w, http.StatusOK, map[string]any{"profile": row})
}

func (s *Service) handleLibraryImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/library/image/")
	parts := strings.SplitN(path, "/", 2)
	if len(parts) != 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	profileID := parts[0]
	relative := filepath.Clean(parts[1])
	base := filepath.Join(s.libraryDir, profileID)
	target := filepath.Join(base, relative)
	if !strings.HasPrefix(target, base+string(os.PathSeparator)) && target != base {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
		return
	}
	if !fileExists(target) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(target))); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	http.ServeFile(w, r, target)
}

func (s *Service) handleProjects(w http.ResponseWriter, r *http.Request) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if !tableExists(db, "projects") {
		if r.Method == http.MethodGet {
			writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "items": []map[string]any{}, "total": 0})
			return
		}
		if err := ensureProjectsTable(db); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	switch r.Method {
	case http.MethodGet:
		s.listProjects(w, r, db)
	case http.MethodPost:
		s.createProject(w, r, db)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleProjectSubroutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/projects/")
	switch {
	case path == "migrate-existing":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "count": 0, "migrated": 0})
		return
	case strings.HasPrefix(path, "by-blog/"):
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		blogID, err := strconv.Atoi(strings.TrimPrefix(path, "by-blog/"))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		s.getProjectByBlog(w, blogID)
		return
	default:
		projectID, err := strconv.Atoi(strings.Split(path, "/")[0])
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		db, dbErr := s.openDB()
		if dbErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": dbErr.Error()})
			return
		}
		defer db.Close()
		if !tableExists(db, "projects") {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로젝트를 찾을 수 없습니다."})
			return
		}
		switch r.Method {
		case http.MethodGet:
			s.getProject(w, db, projectID)
		case http.MethodPut:
			s.updateProject(w, r, db, projectID)
		case http.MethodDelete:
			s.deleteProject(w, db, projectID)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	}
}

func (s *Service) listProjects(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	limit := intQuery(r, "limit", 50)
	offset := intQuery(r, "offset", 0)
	queryText := strings.TrimSpace(r.URL.Query().Get("q"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	profileID := intQuery(r, "profile_id", 0)

	var whereParts []string
	var params []any
	if status != "" {
		whereParts = append(whereParts, "p.status = ?")
		params = append(params, status)
	}
	if queryText != "" {
		whereParts = append(whereParts, "p.name LIKE ?")
		params = append(params, "%"+queryText+"%")
	}
	if profileID > 0 {
		whereParts = append(whereParts, "p.profile_id = ?")
		params = append(params, profileID)
	}
	savedFilter := "(p.blog_id IS NOT NULL OR p.cardnews_id IS NOT NULL OR p.comic_id IS NOT NULL OR (p.threads_text IS NOT NULL AND p.threads_text != '') OR (p.twitter_text IS NOT NULL AND p.twitter_text != '') OR (p.ig_caption IS NOT NULL AND p.ig_caption != '') OR (p.blog_images_dir IS NOT NULL AND p.blog_images_dir != '') OR (p.detail_page_dir IS NOT NULL AND p.detail_page_dir != ''))"
	whereParts = append(whereParts, savedFilter)
	whereClause := " WHERE " + strings.Join(whereParts, " AND ")

	var total int
	if err := db.QueryRow("SELECT COUNT(*) FROM projects p"+whereClause, params...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	profileSelect := "'' as profile_name, '' as profile_logo, 0 as bp_id"
	profileJoin := ""
	if tableExists(db, "brand_profiles") {
		profileSelect = "bp.name as profile_name, bp.logo_path as profile_logo, bp.id as bp_id"
		profileJoin = " LEFT JOIN brand_profiles bp ON p.profile_id = bp.id"
	}
	rows, err := db.Query(`SELECT p.*, `+profileSelect+`
		FROM projects p`+profileJoin+whereClause+` ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`, append(params, limit, offset)...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items, err := rowsToMaps(rows)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	blogTags := map[int]string{}
	if tableExists(db, "posts") {
		var blogIDs []int
		for _, item := range items {
			if id := intFromAny(item["blog_id"]); id > 0 {
				blogIDs = append(blogIDs, id)
			}
		}
		if len(blogIDs) > 0 {
			placeholders := make([]string, 0, len(blogIDs))
			args := make([]any, 0, len(blogIDs))
			for _, id := range blogIDs {
				placeholders = append(placeholders, "?")
				args = append(args, id)
			}
			tagRows, err := db.Query(`SELECT id, tags FROM posts WHERE id IN (`+strings.Join(placeholders, ",")+`)`, args...)
			if err == nil {
				defer tagRows.Close()
				for tagRows.Next() {
					var id int
					var tags string
					if scanErr := tagRows.Scan(&id, &tags); scanErr == nil {
						blogTags[id] = tags
					}
				}
			}
		}
	}

	for _, item := range items {
		item["has_blog"] = intFromAny(item["blog_id"]) > 0
		item["has_cardnews"] = intFromAny(item["cardnews_id"]) > 0
		item["has_detail_page"] = stringify(item["detail_page_dir"]) != ""
		item["has_blog_images"] = stringify(item["blog_images_dir"]) != ""
		item["has_comic"] = intFromAny(item["comic_id"]) > 0
		item["has_video"] = stringify(item["video_path"]) != ""
		item["has_sns"] = stringify(item["threads_text"]) != "" || stringify(item["twitter_text"]) != ""
		if blogID := intFromAny(item["blog_id"]); blogID > 0 {
			if tags, ok := blogTags[blogID]; ok {
				item["blog_tags"] = tags
			}
		}
		if logo := stringify(item["profile_logo"]); logo != "" && intFromAny(item["bp_id"]) > 0 {
			item["profile_logo_url"] = fmt.Sprintf("/api/library/image/%d/%s", intFromAny(item["bp_id"]), logo)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"items":  items,
		"total":  total,
	})
}

func (s *Service) createProject(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	name := strings.TrimSpace(stringify(req["name"]))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "프로젝트 이름을 입력하세요."})
		return
	}
	sourceURLs := normalizeStringList(req["source_urls"])
	result, err := db.Exec(`INSERT INTO projects (name, keyword, description, profile_id, source_urls)
		VALUES (?, ?, ?, ?, ?)`,
		name,
		stringify(req["keyword"]),
		stringify(req["description"]),
		nullableInt(req["profile_id"]),
		mustJSONString(sourceURLs),
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": id})
}

func (s *Service) getProject(w http.ResponseWriter, db *sql.DB, projectID int) {
	profileSelect := "'' as profile_name"
	profileJoin := ""
	if tableExists(db, "brand_profiles") {
		profileSelect = "bp.name as profile_name"
		profileJoin = " LEFT JOIN brand_profiles bp ON p.profile_id = bp.id"
	}
	row, err := querySingleMap(db, `SELECT p.*, `+profileSelect+`
		FROM projects p`+profileJoin+`
		WHERE p.id = ?`, projectID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프로젝트를 찾을 수 없습니다."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	project := row
	project["source_urls"] = parseJSONArrayStrings(project["source_urls"])

	var blog map[string]any
	if tableExists(db, "posts") && intFromAny(project["blog_id"]) > 0 {
		if entry, entryErr := querySingleMap(db, `SELECT id, title, content, status, created_at, tags FROM posts WHERE id = ?`, intFromAny(project["blog_id"])); entryErr == nil {
			blog = entry
		}
	}

	var cardnews map[string]any
	if tableExists(db, "cardnews") && intFromAny(project["cardnews_id"]) > 0 {
		if entry, entryErr := querySingleMap(db, `SELECT * FROM cardnews WHERE id = ?`, intFromAny(project["cardnews_id"])); entryErr == nil {
			entry["slides"] = parseJSONArray(entry["slides_json"])
			cardnews = entry
		}
	}

	var comic map[string]any
	if tableExists(db, "comics") && intFromAny(project["comic_id"]) > 0 {
		if entry, entryErr := querySingleMap(db, `SELECT * FROM comics WHERE id = ?`, intFromAny(project["comic_id"])); entryErr == nil {
			entry["panels"] = parseJSONArray(entry["panels_json"])
			comic = entry
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"project":  project,
		"blog":     blog,
		"cardnews": cardnews,
		"blog_images": map[string]any{
			"project_dir": stringify(project["blog_images_dir"]),
			"count":       len(collectImageEntries(s.dataDir, stringify(project["blog_images_dir"]), "blog_images", "/api/blog/images")),
			"images":      collectImageEntries(s.dataDir, stringify(project["blog_images_dir"]), "blog_images", "/api/blog/images"),
		},
		"detail_images": map[string]any{
			"project_dir": stringify(project["detail_page_dir"]),
			"count":       len(collectImageEntries(s.dataDir, stringify(project["detail_page_dir"]), "cardnews", "/api/cardnews/image")),
			"images":      collectImageEntries(s.dataDir, stringify(project["detail_page_dir"]), "cardnews", "/api/cardnews/image"),
		},
		"comic": comic,
	})
}

func (s *Service) updateProject(w http.ResponseWriter, r *http.Request, db *sql.DB, projectID int) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	var sets []string
	var args []any
	for _, field := range projectUpdateFieldNames() {
		if value, ok := req[field]; ok {
			normalized, err := normalizeProjectUpdateValue(field, value)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			sets = append(sets, field+" = ?")
			args = append(args, normalized)
		}
	}
	if value, ok := req["source_urls"]; ok {
		sets = append(sets, "source_urls = ?")
		args = append(args, mustJSONString(normalizeStringList(value)))
	}
	if len(sets) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
		return
	}
	sets = append(sets, "updated_at = datetime('now', 'localtime')")
	args = append(args, projectID)
	if _, err := db.Exec(`UPDATE projects SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func projectUpdateFieldNames() []string {
	return []string{
		"name", "keyword", "description", "status",
		"blog_id", "cardnews_id", "comic_id", "profile_id",
		"video_path", "video_path_slide", "threads_text", "twitter_text", "ig_caption",
		"blog_uploaded_at", "blog_url", "ig_uploaded_at", "ig_url", "threads_uploaded_at", "threads_url",
		"twitter_uploaded_at", "twitter_url", "youtube_uploaded_at", "youtube_url", "blog_images_dir", "detail_page_dir",
	}
}

func normalizeProjectUpdateValue(field string, value any) (any, error) {
	switch field {
	case "blog_id", "cardnews_id", "comic_id", "profile_id":
		return nullableInt(value), nil
	default:
		switch value.(type) {
		case []any, []string, map[string]any:
			return "", fmt.Errorf("%s 값은 문자열 또는 숫자여야 합니다.", field)
		default:
			return stringify(value), nil
		}
	}
}

func (s *Service) deleteProject(w http.ResponseWriter, db *sql.DB, projectID int) {
	if _, err := db.Exec(`DELETE FROM projects WHERE id = ?`, projectID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Service) getProjectByBlog(w http.ResponseWriter, blogID int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if !tableExists(db, "projects") {
		writeJSON(w, http.StatusOK, map[string]any{"project_id": nil})
		return
	}
	var projectID int
	err = db.QueryRow(`SELECT id FROM projects WHERE blog_id = ?`, blogID).Scan(&projectID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"project_id": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project_id": projectID})
}

func (s *Service) handleBrowserStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	s.browserMu.RLock()
	state := s.browser
	s.browserMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected":       state.Connected,
		"port":            defaultInt(state.Port, 9878),
		"email":           "",
		"wanted_email":    "",
		"current_profile": nullableString(state.CurrentProfile),
	})
}

func (s *Service) handleBrowserBridgeStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	status := map[string]any{"status": "ok", "ws_port": 9878, "ws_server_running": false, "connected": false, "bridge_ready": false}
	if s.bridge != nil {
		for key, value := range s.bridge.status() {
			status[key] = value
		}
	}
	writeJSON(w, http.StatusOK, status)
}

func (s *Service) handleBrowserBridgeScrapeURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	targetURL := strings.TrimSpace(stringify(req["url"]))
	if !isHTTPURL(targetURL) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "http/https URL만 수집할 수 있습니다."})
		return
	}
	minLength := clampInt(parseIntDefault(req["min_length"], 100), 1, 5000)
	result, err := s.scrapeURLWithBrowserBridge(targetURL, strings.TrimSpace(stringify(req["title"])), minLength)
	if err != nil {
		writeJSON(w, http.StatusFailedDependency, map[string]any{
			"ok":        false,
			"error":     err.Error(),
			"method":    "chrome_extension_bridge",
			"connected": s.bridge != nil && s.bridge.connected(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "data": result})
}

func (s *Service) scrapeURLWithBrowserBridge(targetURL string, fallbackTitle string, minLength int) (map[string]any, error) {
	if s.bridge == nil || !s.bridge.connected() {
		return nil, errors.New("Chrome 확장 브릿지가 연결되지 않았습니다. 설정 > 일반 설정의 Chrome 확장 옵션에서 선택 설치/연결을 완료하세요.")
	}
	if _, err := s.bridge.command("openNewTab", map[string]any{"url": targetURL}, 25*time.Second); err != nil {
		return nil, err
	}
	time.Sleep(1200 * time.Millisecond)
	resp, err := s.bridge.command("evaluate", map[string]any{"script": browserBridgeArticleScrapeJS(minLength)}, 25*time.Second)
	if err != nil {
		return nil, err
	}
	resultMap, _ := resp["result"].(map[string]any)
	rawResult := resultMap["result"]
	result := map[string]any{}
	raw, _ := json.Marshal(rawResult)
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, errors.New("Chrome 확장 브릿지 수집 결과를 읽지 못했습니다")
	}
	text := strings.TrimSpace(stringify(result["text"]))
	if len([]rune(text)) < minLength {
		return nil, fmt.Errorf("Chrome 확장 브릿지가 충분한 본문을 얻지 못했습니다. 본문 %d자", len([]rune(text)))
	}
	title := strings.TrimSpace(stringify(result["title"]))
	if title == "" {
		title = fallbackTitle
	}
	if title == "" {
		title = targetURL
	}
	result["ok"] = true
	result["title"] = title
	result["text"] = text
	result["method"] = "chrome_extension_bridge"
	resultURL := strings.TrimSpace(stringify(result["url"]))
	if resultURL == "" {
		resultURL = targetURL
	}
	result["url"] = resultURL
	result["char_count"] = len([]rune(text))
	result["stages"] = []map[string]any{{
		"key":     "chrome_bridge",
		"label":   "Chrome 확장 브릿지 수집",
		"method":  "chrome_extension_bridge",
		"message": "기존 Chrome 탭에서 본문을 수집했습니다.",
		"success": true,
	}}
	return result, nil
}

func isHTTPURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func browserBridgeArticleScrapeJS(minLength int) string {
	payload, _ := json.Marshal(map[string]any{"minLength": minLength})
	return fmt.Sprintf(`(() => {
	  const input = %s;
	  const norm = value => String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
	  const scoreText = value => {
	    const text = norm(value);
	    if (!text) return 0;
	    const hangul = (text.match(/[가-힣]/g) || []).length;
	    const sentence = (text.match(/[.!?。！？다요죠니다까]/g) || []).length;
	    return text.length + hangul * 0.4 + sentence * 20;
	  };
	  const blocks = [];
	  const selectors = [
	    'article',
	    'main article',
	    '[role="article"]',
	    'main [data-testid]',
	    '.se-main-container',
	    '#postViewArea',
	    '.entry-content',
	    '.post-content',
	    '.article-content',
	    'main',
	    '#content',
	    '#contents',
	    'body'
	  ];
	  for (const selector of selectors) {
	    for (const el of Array.from(document.querySelectorAll(selector))) {
	      const text = norm(el.innerText || el.textContent || '');
	      if (text.length >= Number(input.minLength || 100)) {
	        blocks.push({ text, score: scoreText(text), selector });
	      }
	    }
	  }
	  blocks.sort((a, b) => b.score - a.score);
	  const best = blocks[0] || { text: norm(document.body?.innerText || ''), selector: 'body' };
	  const title = norm(
	    document.querySelector('meta[property="og:title"]')?.content ||
	    document.querySelector('meta[name="twitter:title"]')?.content ||
	    document.title ||
	    ''
	  );
	  const imageSet = new Set();
	  for (const meta of Array.from(document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]'))) {
	    if (meta.content) imageSet.add(meta.content);
	  }
	  for (const img of Array.from(document.images || [])) {
	    const src = img.currentSrc || img.src || '';
	    if (src && !src.startsWith('data:')) imageSet.add(src);
	    if (imageSet.size >= 40) break;
	  }
	  return {
	    title,
	    text: best.text.slice(0, 50000),
	    images: Array.from(imageSet).slice(0, 40),
	    url: location.href,
	    selector: best.selector || '',
	    method: 'chrome_extension_bridge',
	    char_count: best.text.length
	  };
	})()`, string(payload))
}

func (s *Service) handleChromeDiagnostics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	chromePath, checked := findChromeExecutable()
	writeJSON(w, http.StatusOK, map[string]any{
		"installed":          chromePath != "",
		"chrome_path":        chromePath,
		"checked_paths":      checked,
		"is_default_browser": false,
		"default_browser":    map[string]any{"name": ""},
	})
}

func (s *Service) handleChromeProfiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"profiles": scanChromeProfiles()})
}

func (s *Service) handleBrowserExtensionStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	extDir := s.managedChromeExtensionDir()
	s.browserMu.RLock()
	connected := s.browser.Connected
	s.browserMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"needs_manual_install": !connected,
		"extension_path":       extDir,
		"platform":             runtime.GOOS,
		"connected":            connected,
		"version":              "",
		"signature":            "",
	})
}

func (s *Service) handleBrowserInstallExtension(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	extDir := s.managedChromeExtensionDir()
	if err := os.MkdirAll(extDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	openChromeExtensionsPage()
	openChromeExtensionFolder(extDir)
	s.appendBrowserLog("Chrome 확장 프로그램 안내 페이지와 폴더를 열었습니다.")

	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"extension_path": extDir,
	})
}

func (s *Service) handleBrowserLaunch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	profileDir := "Default"
	openURL := strings.TrimSpace(stringFromAny(req["open_url"]))
	chromePath, checked := findChromeExecutable()
	if chromePath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"error":         "chrome not found",
			"checked_paths": checked,
		})
		return
	}
	userDataDir := defaultChromeUserDataDir()
	extDir := s.managedChromeExtensionDir()
	_ = os.MkdirAll(extDir, 0o755)
	args := []string{
		fmt.Sprintf("--user-data-dir=%s", userDataDir),
		fmt.Sprintf("--profile-directory=%s", profileDir),
		"--silent-debugger-extension-api",
		"--no-first-run",
		"--no-default-browser-check",
	}
	if extDir != "" {
		args = append(args, fmt.Sprintf("--load-extension=%s", extDir))
	}
	if openURL != "" {
		args = append(args, openURL)
	}
	cmd := exec.Command(chromePath, args...)
	if err := cmd.Start(); err != nil {
		s.appendBrowserLog("Chrome 실행 실패: " + err.Error())
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error":   "chrome launch failed",
			"message": err.Error(),
		})
		return
	}
	s.browserMu.Lock()
	s.browser = browserState{
		Connected:      true,
		CurrentProfile: profileDir,
		Port:           9878,
		ExtensionPath:  extDir,
	}
	s.browserMu.Unlock()
	s.appendBrowserLog("Chrome 프로필 연결: " + profileDir)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":                 "ok",
		"connected":              true,
		"launched":               true,
		"needs_manual_extension": false,
		"extension_path":         extDir,
		"profile_dir":            profileDir,
		"message":                "Chrome profile launched in go-only mode",
	})
}

func (s *Service) handleBrowserOpenExtensionFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	extDir := s.managedChromeExtensionDir()
	if err := os.MkdirAll(extDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	openChromeExtensionFolder(extDir)
	s.appendBrowserLog("Chrome 확장 폴더를 열었습니다.")
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"path":   extDir,
	})
}

func (s *Service) handleBrowserOpenChromeExtensions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	openChromeExtensionsPage()
	s.appendBrowserLog("Chrome 확장 프로그램 페이지를 열었습니다.")
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
	})
}

func (s *Service) handleOpenFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	target, err := s.resolveOpenFolderTarget(stringify(req["folder"]))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := os.MkdirAll(target, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := openFolderInOS(target); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "ok": true, "path": target})
}

func (s *Service) resolveOpenFolderTarget(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		value = "output"
	}
	value = strings.ReplaceAll(value, "\\", string(filepath.Separator))
	if strings.Contains(value, "\x00") {
		return "", errors.New("올바르지 않은 폴더 경로입니다.")
	}
	if strings.HasPrefix(value, "~") {
		if home, err := os.UserHomeDir(); err == nil {
			value = filepath.Join(home, strings.TrimLeft(strings.TrimPrefix(value, "~"), `/\`))
		}
	}
	if filepath.IsAbs(value) {
		if info, err := os.Stat(value); err == nil && !info.IsDir() {
			return filepath.Dir(value), nil
		}
		if filepath.Ext(value) != "" {
			return filepath.Dir(value), nil
		}
		return filepath.Clean(value), nil
	}
	target := filepath.Join(s.dataDir, value)
	if strings.HasPrefix(value, "output"+string(filepath.Separator)) || value == "output" {
		target = filepath.Join(s.dataDir, value)
	}
	if info, err := os.Stat(target); err == nil && !info.IsDir() {
		return filepath.Dir(target), nil
	}
	if filepath.Ext(target) != "" {
		return filepath.Dir(target), nil
	}
	return filepath.Clean(target), nil
}

func (s *Service) handleBrowserResetExtension(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	extDir := s.managedChromeExtensionDir()
	if err := os.MkdirAll(extDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	s.browserMu.RLock()
	connected := s.browser.Connected
	s.browserMu.RUnlock()
	s.appendBrowserLog("관리 중인 Chrome 확장 경로를 재확인했습니다.")
	writeJSON(w, http.StatusOK, map[string]any{
		"status":               "ok",
		"message":              "go-only 환경에서 확장 경로를 다시 준비했습니다.",
		"extension_path":       extDir,
		"needs_manual_install": !connected,
		"connected":            connected,
	})
}

func (s *Service) handleBrowserLogs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		lines := intQuery(r, "lines", 20)
		logs := s.recentBrowserLogs(lines)
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"logs":   logs,
		})
	case http.MethodDelete:
		s.browserMu.Lock()
		s.browserLogs = []string{}
		s.browserMu.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleBrowserEval(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	code := strings.TrimSpace(stringFromAny(req["code"]))
	s.browserMu.RLock()
	connected := s.browser.Connected
	profile := s.browser.CurrentProfile
	s.browserMu.RUnlock()

	result := any(false)
	switch {
	case strings.Contains(code, "'ok'") || strings.Contains(code, "\"ok\""):
		result = "ok"
	case strings.Contains(code, "document.cookie.includes(\"NID_AUT\")") || strings.Contains(code, "document.cookie.includes(\"NID_SES\")"):
		result = connected && strings.TrimSpace(profile) != ""
	default:
		result = connected
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"result": result,
	})
}

func (s *Service) handleBrowserLiveAgentStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	task := strings.TrimSpace(stringFromAny(req["task"]))
	if task == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "task is required"})
		return
	}
	maxSteps := intFromAny(req["max_steps"])
	if maxSteps <= 0 {
		maxSteps = 20
	}
	scenarioName := ""
	if scenario, ok := req["scenario"].(map[string]any); ok {
		scenarioName = strings.TrimSpace(stringFromAny(scenario["name"]))
	}
	now := time.Now().Format(time.RFC3339)

	s.browserMu.Lock()
	s.agentSeq++
	agentID := fmt.Sprintf("agent-%03d", s.agentSeq)
	agent := &liveAgentState{
		AgentID:      agentID,
		Task:         task,
		TaskFull:     task,
		MaxSteps:     maxSteps,
		ScenarioName: scenarioName,
		Running:      true,
		Done:         false,
		StatusText:   "실행 중",
		CreatedAt:    now,
		UpdatedAt:    now,
		Logs: []map[string]any{
			{"message": "작업을 접수했습니다.", "color": "#007aff"},
			{"message": "go-only 브라우저 워커가 준비 중입니다.", "color": "#ff8c00"},
		},
	}
	s.liveAgents[agentID] = agent
	s.browserMu.Unlock()
	s.appendBrowserLog("라이브 에이전트 시작: " + agentID + " · " + task)
	go s.completeLiveAgent(agentID)

	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"agent_id": agentID,
	})
}

func (s *Service) handleBrowserLiveAgentList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"agents": s.listLiveAgents(),
	})
}

func (s *Service) handleBrowserLiveAgentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
		return
	}
	s.browserMu.RLock()
	agent, ok := s.liveAgents[agentID]
	if !ok {
		s.browserMu.RUnlock()
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
		return
	}
	logs := cloneLogEntries(agent.Logs)
	running := agent.Running
	done := agent.Done
	statusText := agent.StatusText
	finalAnswer := agent.FinalAnswer
	errText := agent.Error
	s.browserMu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"agent_id":     agentID,
		"running":      running,
		"done":         done,
		"status_text":  statusText,
		"final_answer": finalAnswer,
		"error":        errText,
		"logs":         logs,
	})
}

func (s *Service) handleBrowserLiveAgentStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	_ = json.NewDecoder(r.Body).Decode(&req)
	agentID := strings.TrimSpace(stringFromAny(req["agent_id"]))
	stopped := []string{}

	s.browserMu.Lock()
	if agentID != "" {
		if agent, ok := s.liveAgents[agentID]; ok {
			s.stopLiveAgentLocked(agent, "사용자 중지 요청")
			stopped = append(stopped, agentID)
		}
	} else {
		for _, agent := range s.liveAgents {
			if agent != nil && agent.Running {
				s.stopLiveAgentLocked(agent, "일괄 중지 요청")
				stopped = append(stopped, agent.AgentID)
			}
		}
	}
	s.browserMu.Unlock()

	if len(stopped) > 0 {
		s.appendBrowserLog("라이브 에이전트 중지: " + strings.Join(stopped, ", "))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"stopped": stopped,
	})
}

func (s *Service) handleBrowserLiveAgentDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	agentID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/browser/live-agent/"))
	if agentID == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
		return
	}
	s.browserMu.Lock()
	_, ok := s.liveAgents[agentID]
	if ok {
		delete(s.liveAgents, agentID)
	}
	s.browserMu.Unlock()
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "agent not found"})
		return
	}
	s.appendBrowserLog("라이브 에이전트 삭제: " + agentID)
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "agent_id": agentID})
}

func (s *Service) handleBrowserAIScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	prompt := strings.TrimSpace(stringFromAny(req["prompt"]))
	if prompt == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "prompt is required"})
		return
	}
	steps := []map[string]any{
		{"action": "open", "target": "브라우저", "note": "관련 서비스와 페이지를 엽니다."},
		{"action": "search", "target": prompt, "note": "요청한 주제를 기준으로 필요한 정보를 수집합니다."},
		{"action": "organize", "target": "결과 정리", "note": "핵심 내용과 비교 포인트를 정리합니다."},
		{"action": "report", "target": "최종 보고", "note": "실행 결과와 다음 액션을 요약합니다."},
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"name":   truncateRunes(prompt, 30),
		"steps":  steps,
	})
}

func (s *Service) handleBrowserPublishBlog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	s.appendBrowserLog("네이버 블로그 발행 요청 수신")
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      false,
		"success": false,
		"error":   "go-only 모드에서는 실제 네이버 블로그 자동 발행을 아직 지원하지 않습니다.",
	})
}

func (s *Service) handleUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"days":         intQuery(r, "days", 30),
		"total_cost":   0,
		"total_input":  0,
		"total_output": 0,
		"by_model":     []map[string]any{},
		"projects":     []map[string]any{},
	})
}

func (s *Service) handleProjectUsage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"project_id":   strings.TrimPrefix(r.URL.Path, "/api/usage/project/"),
		"total_cost":   0,
		"total_input":  0,
		"total_output": 0,
		"by_model":     []map[string]any{},
	})
}

func (s *Service) handleTemplateVersionStatus(w http.ResponseWriter, r *http.Request) {
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
	templatesInDB := countTable(db, "biz_templates")
	scenariosInDB := countTable(db, "biz_scenarios")
	activeVersion := ""
	if tableExists(db, "template_versions") {
		_ = db.QueryRow(`SELECT version FROM template_versions WHERE is_active = 1 LIMIT 1`).Scan(&activeVersion)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"templates_in_db": templatesInDB,
		"scenarios_in_db": scenariosInDB,
		"active_version":  nullableString(activeVersion),
		"needs_sync":      templatesInDB == 0 && scenariosInDB == 0,
	})
}

type adminFileCategory struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Dir   string `json:"dir"`
}

type adminFileItem struct {
	Name         string `json:"name"`
	Ext          string `json:"ext"`
	Path         string `json:"path"`
	Folder       string `json:"folder"`
	RelativePath string `json:"relative_path"`
	Size         int64  `json:"size"`
	SizeText     string `json:"size_text"`
	ModifiedAt   string `json:"modified_at"`
}

func (s *Service) adminFileCategories() []adminFileCategory {
	output := filepath.Join(s.dataDir, "output")
	return []adminFileCategory{
		{Key: "videos", Label: "영상", Dir: filepath.Join(output, "videos")},
		{Key: "images", Label: "이미지", Dir: filepath.Join(output, "images")},
		{Key: "audio", Label: "오디오", Dir: filepath.Join(output, "audio")},
		{Key: "blog", Label: "블로그", Dir: filepath.Join(output, "blog")},
		{Key: "cardnews", Label: "카드뉴스", Dir: filepath.Join(output, "cardnews")},
		{Key: "library", Label: "브랜드 프로필", Dir: filepath.Join(output, "library")},
		{Key: "downloads", Label: "다운로드", Dir: filepath.Join(output, "downloads")},
		{Key: "projects", Label: "프로젝트", Dir: filepath.Join(output, "projects")},
	}
}

func (s *Service) handleAdminFilesSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	categories := make([]map[string]any, 0)
	totalFiles := 0
	totalSize := int64(0)
	for _, category := range s.adminFileCategories() {
		files := collectAdminFiles(category.Dir)
		size := int64(0)
		for _, file := range files {
			size += file.Size
		}
		totalFiles += len(files)
		totalSize += size
		categories = append(categories, map[string]any{
			"key":       category.Key,
			"label":     category.Label,
			"dir":       category.Dir,
			"count":     len(files),
			"size":      size,
			"size_text": formatBytes(size),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"output_dir":      filepath.Join(s.dataDir, "output"),
		"total_files":     totalFiles,
		"total_size":      totalSize,
		"total_size_text": formatBytes(totalSize),
		"categories":      categories,
	})
}

func (s *Service) handleAdminFiles(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		categoryKey := strings.TrimSpace(r.URL.Query().Get("category"))
		category, ok := s.findAdminFileCategory(categoryKey)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown file category"})
			return
		}
		files := collectAdminFiles(category.Dir)
		offset := intFromString(r.URL.Query().Get("offset"), 0)
		limit := intFromString(r.URL.Query().Get("limit"), 50)
		if limit <= 0 || limit > 500 {
			limit = 50
		}
		total := len(files)
		if offset < 0 {
			offset = 0
		}
		if offset > total {
			offset = total
		}
		end := offset + limit
		if end > total {
			end = total
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"key":    category.Key,
			"label":  category.Label,
			"dir":    category.Dir,
			"total":  total,
			"files":  files[offset:end],
		})
	case http.MethodDelete:
		var req struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		target, ok := s.safeAdminPath(req.Path)
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid file path"})
			return
		}
		if err := os.Remove(target); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleAdminFileContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	target, ok := s.safeAdminPath(r.URL.Query().Get("path"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, target)
}

func (s *Service) handleAdminDBTables(w http.ResponseWriter, r *http.Request) {
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
	rows, err := db.Query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	names := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		names = append(names, name)
	}
	tables := make([]map[string]any, 0, len(names))
	for _, name := range names {
		tables = append(tables, map[string]any{
			"name":  name,
			"count": countTable(db, name),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "db_path": s.dbPath, "tables": tables})
}

func (s *Service) handleAdminDBTable(w http.ResponseWriter, r *http.Request) {
	table := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/admin/db/table/"), "/")
	if table == "" || !isSafeDBIdentifier(table) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid table"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleAdminDBTableGet(w, r, table)
	case http.MethodDelete:
		s.handleAdminDBTableDelete(w, r, table)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleAdminDBTableGet(w http.ResponseWriter, r *http.Request, table string) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if !tableExists(db, table) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "table not found"})
		return
	}
	columns, primaryKey := tableColumns(db, table)
	limit := intFromString(r.URL.Query().Get("limit"), 50)
	offset := intFromString(r.URL.Query().Get("offset"), 0)
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := db.Query(fmt.Sprintf(`SELECT rowid, * FROM "%s" LIMIT ? OFFSET ?`, table), limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	colNames, _ := rows.Columns()
	items := []map[string]any{}
	for rows.Next() {
		values := make([]any, len(colNames))
		ptrs := make([]any, len(colNames))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		item := map[string]any{}
		for i, name := range colNames {
			item[name] = dbValueToJSON(values[i])
		}
		if rowID, ok := item["rowid"]; ok {
			item["_rowid"] = rowID
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"table":       table,
		"columns":     columns,
		"primary_key": primaryKey,
		"total":       countTable(db, table),
		"rows":        items,
	})
}

func (s *Service) handleAdminDBTableDelete(w http.ResponseWriter, r *http.Request, table string) {
	var req struct {
		Value any `json:"value"`
		RowID int `json:"rowid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	_, primaryKey := tableColumns(db, table)
	if primaryKey != "" && req.Value != nil && strings.TrimSpace(fmt.Sprint(req.Value)) != "" {
		_, err = db.Exec(fmt.Sprintf(`DELETE FROM "%s" WHERE "%s" = ?`, table, primaryKey), fmt.Sprint(req.Value))
	} else {
		_, err = db.Exec(fmt.Sprintf(`DELETE FROM "%s" WHERE rowid = ?`, table), req.RowID)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Service) findAdminFileCategory(key string) (adminFileCategory, bool) {
	for _, category := range s.adminFileCategories() {
		if category.Key == key {
			return category, true
		}
	}
	return adminFileCategory{}, false
}

func (s *Service) safeAdminPath(raw string) (string, bool) {
	target := strings.TrimSpace(raw)
	if target == "" {
		return "", false
	}
	abs, err := filepath.Abs(target)
	if err != nil {
		return "", false
	}
	outputRoot, err := filepath.Abs(filepath.Join(s.dataDir, "output"))
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(outputRoot, abs)
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return "", false
	}
	info, err := os.Stat(abs)
	if err != nil || info.IsDir() {
		return "", false
	}
	return abs, true
}

func collectAdminFiles(root string) []adminFileItem {
	items := []adminFileItem{}
	if strings.TrimSpace(root) == "" {
		return items
	}
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry == nil || entry.IsDir() {
			return nil
		}
		info, statErr := entry.Info()
		if statErr != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))
		items = append(items, adminFileItem{
			Name:         entry.Name(),
			Ext:          ext,
			Path:         path,
			Folder:       filepath.Dir(path),
			RelativePath: rel,
			Size:         info.Size(),
			SizeText:     formatBytes(info.Size()),
			ModifiedAt:   info.ModTime().Format(time.RFC3339),
		})
		return nil
	})
	sort.Slice(items, func(i, j int) bool {
		return items[i].ModifiedAt > items[j].ModifiedAt
	})
	return items
}

func formatBytes(size int64) string {
	units := []string{"B", "KB", "MB", "GB", "TB"}
	value := float64(size)
	unit := 0
	for value >= 1024 && unit < len(units)-1 {
		value /= 1024
		unit++
	}
	if unit == 0 {
		return fmt.Sprintf("%dB", size)
	}
	return fmt.Sprintf("%.1f%s", value, units[unit])
}

func intFromString(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return value
}

func isSafeDBIdentifier(value string) bool {
	if strings.TrimSpace(value) == "" {
		return false
	}
	return regexp.MustCompile(`^[A-Za-z0-9_]+$`).MatchString(value)
}

func tableColumns(db *sql.DB, table string) ([]string, string) {
	rows, err := db.Query(`PRAGMA table_info("` + table + `")`)
	if err != nil {
		return []string{}, ""
	}
	defer rows.Close()
	columns := []string{}
	primaryKey := ""
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var defaultValue any
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultValue, &pk); err != nil {
			continue
		}
		columns = append(columns, name)
		if pk > 0 && primaryKey == "" {
			primaryKey = name
		}
	}
	return columns, primaryKey
}

func dbValueToJSON(value any) any {
	switch cast := value.(type) {
	case nil:
		return nil
	case []byte:
		return string(cast)
	case time.Time:
		return cast.Format(time.RFC3339)
	default:
		return cast
	}
}

func (s *Service) handleAutoSchedule(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "schedules": []map[string]any{}})
	case http.MethodPost:
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":         "ok",
			"id":             0,
			"profile_id":     intFromAny(req["profile_id"]),
			"times_per_day":  intFromAny(req["times_per_day"]),
			"schedule_times": stringify(req["schedule_times"]),
		})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleAutoScheduleByID(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPut, http.MethodDelete:
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleWritingStyles(w http.ResponseWriter, r *http.Request) {
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
	if !tableExists(db, "writing_styles") {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "styles": []map[string]any{}})
		return
	}
	rows, err := db.Query(`SELECT * FROM writing_styles ORDER BY is_default DESC, created_at DESC`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	styles, err := rowsToMaps(rows)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "styles": styles})
}

func (s *Service) handleWritingStylesSubroute(w http.ResponseWriter, r *http.Request) {
	action := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/writing-styles/"), "/")
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	switch action {
	case "analyze-create":
		s.handleWritingStyleAnalyzeCreate(w, req)
	case "ai-create":
		s.handleWritingStyleAICreate(w, req)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func (s *Service) handleWritingStyleAnalyzeCreate(w http.ResponseWriter, req map[string]any) {
	sampleText := strings.TrimSpace(stringify(req["sample_text"]))
	if len([]rune(sampleText)) < 50 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "분석할 글은 최소 50자 이상 필요합니다."})
		return
	}
	name := strings.TrimSpace(stringify(req["name"]))
	if name == "" {
		name = "글쓰기 스타일"
	}
	styleData, provider, warning := s.buildWritingStyleFromSample(name, sampleText)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"name":       name,
		"style_data": styleData,
		"provider":   provider,
		"warning":    warning,
	})
}

func (s *Service) handleWritingStyleAICreate(w http.ResponseWriter, req map[string]any) {
	description := strings.TrimSpace(stringify(req["description"]))
	if len([]rune(description)) < 5 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "스타일 설명을 입력하세요."})
		return
	}
	name := strings.TrimSpace(stringify(req["name"]))
	if name == "" {
		name = "AI 글쓰기 스타일"
	}
	styleData, provider, warning := s.buildWritingStyleFromDescription(name, description)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":     "ok",
		"name":       name,
		"style_data": styleData,
		"provider":   provider,
		"warning":    warning,
	})
}

func (s *Service) buildWritingStyleFromSample(name string, sampleText string) (map[string]any, string, string) {
	apiKey := s.geminiAPIKey()
	if apiKey != "" {
		model := strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		if model == "" || strings.Contains(strings.ToLower(model), "cli") || strings.Contains(strings.ToLower(model), "/") {
			model = "gemini-2.5-flash"
		}
		if text, err := callGeminiText(apiKey, model, buildWritingStyleAnalyzePrompt(name, sampleText), 45*time.Second); err == nil {
			if parsed, parseErr := parseJSONMapFromText(text); parseErr == nil {
				return normalizeWritingStyleData(parsed, sampleText, name), "gemini", ""
			}
		}
	}
	return fallbackWritingStyleData(sampleText, name), "local", "Gemini 분석을 사용할 수 없어 로컬 문체 요약으로 저장했습니다."
}

func (s *Service) buildWritingStyleFromDescription(name string, description string) (map[string]any, string, string) {
	apiKey := s.geminiAPIKey()
	if apiKey != "" {
		model := strings.TrimSpace(s.getSetting("MODELS.text_model", ""))
		if model == "" || strings.Contains(strings.ToLower(model), "cli") || strings.Contains(strings.ToLower(model), "/") {
			model = "gemini-2.5-flash"
		}
		if text, err := callGeminiText(apiKey, model, buildWritingStyleDescriptionPrompt(name, description), 45*time.Second); err == nil {
			if parsed, parseErr := parseJSONMapFromText(text); parseErr == nil {
				return normalizeWritingStyleData(parsed, description, name), "gemini", ""
			}
		}
	}
	return fallbackWritingStyleData(description, name), "local", "Gemini 생성을 사용할 수 없어 입력 설명 기반 스타일로 저장했습니다."
}

func (s *Service) geminiAPIKey() string {
	apiKey := strings.TrimSpace(s.getSetting("API.gemini_api_key", s.getSetting("API.google_api_key", "")))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_API_KEY"))
	}
	return apiKey
}

func buildWritingStyleAnalyzePrompt(name string, sampleText string) string {
	return fmt.Sprintf(`다음 글 샘플을 분석해서 한국어 글쓰기 스타일 JSON만 출력하세요.

[스타일 이름]
%s

[샘플]
%s

[출력 JSON 스키마]
{
  "tone": "전체 톤 한 문장",
  "sentence_style": "문장 길이, 호흡, 리듬",
  "ending_style": "종결어미와 마무리 습관",
  "paragraph_style": "문단 구성 방식",
  "vocabulary_level": "어휘 난이도와 전문성",
  "expressions": ["자주 쓰는 표현"],
  "forbidden_expressions": ["피해야 할 표현"],
  "connector_words": ["자주 쓰는 연결어"],
  "rhetoric": "비유/질문/강조 방식",
  "unique_features": ["고유한 문체 특징"],
  "opening_pattern": "글 시작 방식",
  "closing_pattern": "글 마무리 방식",
  "sample_sentences": ["이 스타일을 재현한 예시 문장 3개"]
}`, name, truncateRunes(sampleText, 20000))
}

func buildWritingStyleDescriptionPrompt(name string, description string) string {
	return fmt.Sprintf(`아래 설명을 바탕으로 한국어 글쓰기 스타일 JSON만 만드세요.

[스타일 이름]
%s

[설명]
%s

[출력 JSON 스키마]
{
  "tone": "전체 톤 한 문장",
  "sentence_style": "문장 길이, 호흡, 리듬",
  "ending_style": "종결어미와 마무리 습관",
  "paragraph_style": "문단 구성 방식",
  "vocabulary_level": "어휘 난이도와 전문성",
  "expressions": ["자주 쓰는 표현"],
  "forbidden_expressions": ["피해야 할 표현"],
  "connector_words": ["자주 쓰는 연결어"],
  "rhetoric": "비유/질문/강조 방식",
  "unique_features": ["고유한 문체 특징"],
  "opening_pattern": "글 시작 방식",
  "closing_pattern": "글 마무리 방식",
  "sample_sentences": ["이 스타일을 재현한 예시 문장 3개"]
}`, name, truncateRunes(description, 8000))
}

func normalizeWritingStyleData(parsed map[string]any, sourceText string, name string) map[string]any {
	fallback := fallbackWritingStyleData(sourceText, name)
	result := map[string]any{}
	for _, key := range []string{"tone", "sentence_style", "ending_style", "paragraph_style", "vocabulary_level", "rhetoric", "opening_pattern", "closing_pattern"} {
		value := strings.TrimSpace(stringify(parsed[key]))
		if value == "" {
			value = stringify(fallback[key])
		}
		result[key] = value
	}
	for _, key := range []string{"expressions", "forbidden_expressions", "connector_words", "unique_features", "sample_sentences"} {
		values := stringSliceFromAny(parsed[key])
		if len(values) == 0 {
			values = stringSliceFromAny(fallback[key])
		}
		result[key] = values
	}
	return result
}

func fallbackWritingStyleData(sourceText string, name string) map[string]any {
	text := strings.TrimSpace(sourceText)
	sentences := splitStyleSentences(text)
	avg := 0
	if len(sentences) > 0 {
		total := 0
		for _, sentence := range sentences {
			total += len([]rune(sentence))
		}
		avg = total / len(sentences)
	}
	lengthStyle := "짧고 빠른 문장 중심"
	if avg > 90 {
		lengthStyle = "긴 설명형 문장과 충분한 맥락 제공"
	} else if avg > 45 {
		lengthStyle = "중간 길이 문장으로 설명과 리듬을 균형 있게 사용"
	}
	samples := sentences
	if len(samples) > 3 {
		samples = samples[:3]
	}
	if len(samples) == 0 {
		samples = []string{name + "의 핵심을 자연스럽고 분명하게 전달합니다."}
	}
	return map[string]any{
		"tone":                  "담백하고 실무적인 한국어 톤",
		"sentence_style":        lengthStyle,
		"ending_style":          "과장보다 명확한 설명으로 마무리",
		"paragraph_style":       "핵심 내용을 짧은 문단으로 나누어 전달",
		"vocabulary_level":      "일상어와 실무 표현을 함께 사용",
		"expressions":           topStyleTokens(text, 8),
		"forbidden_expressions": []string{"과장된 보장 표현", "근거 없는 최상급 표현"},
		"connector_words":       extractConnectorWords(text),
		"rhetoric":              "문제와 해결을 차례로 설명하는 방식",
		"unique_features":       []string{"구체적인 상황 설명", "읽기 쉬운 문장 호흡", "실행 가능한 표현"},
		"opening_pattern":       "상황이나 문제를 먼저 짚고 시작",
		"closing_pattern":       "독자가 다음 행동을 떠올리게 마무리",
		"sample_sentences":      samples,
	}
}

func splitStyleSentences(text string) []string {
	parts := regexp.MustCompile(`[.!?\n。！？]+`).Split(text, -1)
	items := make([]string, 0, 6)
	for _, part := range parts {
		candidate := strings.TrimSpace(part)
		if len([]rune(candidate)) < 10 {
			continue
		}
		items = append(items, truncateRunes(candidate, 140))
		if len(items) >= 6 {
			break
		}
	}
	return items
}

func topStyleTokens(text string, limit int) []string {
	words := regexp.MustCompile(`[^\p{L}\p{N}_]+`).Split(text, -1)
	counts := map[string]int{}
	for _, word := range words {
		word = strings.TrimSpace(word)
		runes := len([]rune(word))
		if runes < 2 || runes > 16 {
			continue
		}
		counts[word]++
	}
	type pair struct {
		word  string
		count int
	}
	pairs := make([]pair, 0, len(counts))
	for word, count := range counts {
		pairs = append(pairs, pair{word: word, count: count})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].count == pairs[j].count {
			return pairs[i].word < pairs[j].word
		}
		return pairs[i].count > pairs[j].count
	})
	items := make([]string, 0, limit)
	for _, item := range pairs {
		items = append(items, item.word)
		if len(items) >= limit {
			break
		}
	}
	return items
}

func extractConnectorWords(text string) []string {
	candidates := []string{"그리고", "그래서", "하지만", "다만", "또한", "결국", "먼저", "이렇게", "예를 들어", "반대로"}
	items := make([]string, 0, 5)
	for _, word := range candidates {
		if strings.Contains(text, word) {
			items = append(items, word)
		}
	}
	if len(items) == 0 {
		items = []string{"그리고", "그래서", "다만"}
	}
	return items
}

func stringSliceFromAny(value any) []string {
	switch v := value.(type) {
	case []string:
		items := make([]string, 0, len(v))
		for _, item := range v {
			item = strings.TrimSpace(item)
			if item != "" {
				items = append(items, item)
			}
		}
		return items
	case []any:
		items := make([]string, 0, len(v))
		for _, item := range v {
			text := strings.TrimSpace(stringify(item))
			if text != "" {
				items = append(items, text)
			}
		}
		return items
	default:
		text := strings.TrimSpace(stringify(value))
		if text == "" {
			return []string{}
		}
		parts := strings.Split(text, ",")
		items := make([]string, 0, len(parts))
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part != "" {
				items = append(items, part)
			}
		}
		return items
	}
}

func (s *Service) handleBGMList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	profileID := intQuery(r, "profile_id", 0)
	files := collectBGMFiles(s.dataDir, profileID)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"files":        files,
		"external_dir": "",
	})
}

func (s *Service) handleBGMFile(w http.ResponseWriter, r *http.Request) {
	s.serveBGMByName(w, r, strings.TrimPrefix(r.URL.Path, "/api/bgm/file/"))
}

func (s *Service) handleBGMPlay(w http.ResponseWriter, r *http.Request) {
	s.serveBGMByName(w, r, strings.TrimPrefix(r.URL.Path, "/api/bgm/play/"))
}

func (s *Service) serveBGMByName(w http.ResponseWriter, r *http.Request, filename string) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	cleanName := filepath.Base(strings.TrimSpace(filename))
	if cleanName == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
		return
	}
	for _, dir := range bgmSearchDirs(s.dataDir, 0) {
		target := filepath.Join(dir, cleanName)
		if fileExists(target) {
			http.ServeFile(w, r, target)
			return
		}
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
}

func (s *Service) openDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if _, err := db.Exec(`PRAGMA busy_timeout = 10000`); err != nil {
		db.Close()
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA journal_mode = WAL`); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (s *Service) loadAllSettings() map[string]map[string]string {
	db, err := s.openDB()
	if err != nil {
		return map[string]map[string]string{}
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		return map[string]map[string]string{}
	}
	rows, err := db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return map[string]map[string]string{}
	}
	defer rows.Close()
	result := map[string]map[string]string{}
	for rows.Next() {
		var key, value string
		if scanErr := rows.Scan(&key, &value); scanErr != nil {
			continue
		}
		parts := strings.SplitN(key, ".", 2)
		section := "GENERAL"
		subKey := key
		if len(parts) == 2 {
			section = parts[0]
			subKey = parts[1]
		}
		if _, ok := result[section]; !ok {
			result[section] = map[string]string{}
		}
		result[section][subKey] = value
	}
	return result
}

func (s *Service) getSetting(key, fallback string) string {
	db, err := s.openDB()
	if err != nil {
		return fallback
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		return fallback
	}
	var value string
	if err := db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value); err != nil {
		return fallback
	}
	return value
}

func (s *Service) setSetting(key, value string) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		return err
	}
	_, err = db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, key, value)
	return err
}

func (s *Service) setRawSetting(key, value string) error {
	return s.setSetting(key, value)
}

func (s *Service) ensureBlankCodexDefaults() error {
	defaults := map[string]string{
		"MODELS.text_provider":     "cli",
		"MODELS.image_provider":    "cli",
		"MODELS.director_provider": "cli",
	}
	for key, value := range defaults {
		if strings.TrimSpace(s.getSetting(key, "")) != "" {
			continue
		}
		if err := s.setSetting(key, value); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) deleteSetting(key string) error {
	db, err := s.openDB()
	if err != nil {
		return err
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM settings WHERE key = ?`, key)
	return err
}

func signNaverSearchAd(timestamp, method, uri, secret string) string {
	message := timestamp + "." + method + "." + uri
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func readResponseSnippet(body io.Reader) string {
	raw, _ := io.ReadAll(io.LimitReader(body, 2048))
	text := strings.TrimSpace(string(raw))
	if text == "" {
		return "응답 본문이 비어 있습니다"
	}
	return text
}

func normalizeProfile(profile map[string]any) {
	profileID := intFromAny(profile["id"])
	if logo := stringify(profile["logo_path"]); logo != "" && profileID > 0 {
		profile["logo_url"] = fmt.Sprintf("/api/library/image/%d/%s", profileID, logo)
	}
	images := parseJSONArrayStrings(profile["images_json"])
	imageURLs := make([]string, 0, len(images))
	for _, item := range images {
		imageURLs = append(imageURLs, fmt.Sprintf("/api/library/image/%d/%s", profileID, item))
	}
	profile["image_urls"] = imageURLs
}

func ensureBrandProfilesTable(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS brand_profiles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		business_type TEXT DEFAULT '',
		description TEXT DEFAULT '',
		contact_info TEXT DEFAULT '',
		keywords TEXT DEFAULT '',
		tone TEXT DEFAULT 'mystyle',
		logo_path TEXT DEFAULT '',
		images_json TEXT DEFAULT '[]',
		created_at TEXT DEFAULT (datetime('now', 'localtime')),
		updated_at TEXT DEFAULT (datetime('now', 'localtime'))
	)`); err != nil {
		return err
	}
	for _, col := range []string{
		"writing_style", "business_goal", "platform_accounts", "content_options",
		"cta_text", "design_ref_path", "website", "biz_detail", "brand_color",
		"brand_colors", "design_rules", "design_tone", "typography_rules", "layout_rules",
		"image_rules", "cta_rules", "design_forbidden",
	} {
		if err := ensureTextColumn(db, "brand_profiles", col, "''"); err != nil {
			return err
		}
	}
	return nil
}

func ensureTextColumn(db *sql.DB, table, column, defaultValue string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var defaultVal any
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultVal, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN %s TEXT DEFAULT %s`, table, column, defaultValue))
	return err
}

func updateBrandProfileFields(db *sql.DB, profileID int, req map[string]any) error {
	allowed := []string{
		"name", "business_type", "description", "contact_info", "website", "biz_detail",
		"brand_color", "brand_colors", "design_rules", "design_tone", "typography_rules",
		"layout_rules", "image_rules", "cta_rules", "design_forbidden",
		"keywords", "tone", "writing_style", "business_goal",
		"platform_accounts", "content_options", "cta_text",
	}
	updates := make([]string, 0, len(allowed)+1)
	values := make([]any, 0, len(allowed)+2)
	for _, col := range allowed {
		value, ok := req[col]
		if !ok || value == nil {
			continue
		}
		updates = append(updates, col+" = ?")
		values = append(values, stringify(value))
	}
	if len(updates) == 0 {
		return nil
	}
	updates = append(updates, "updated_at = ?")
	values = append(values, time.Now().Format("2006-01-02 15:04:05"), profileID)
	_, err := db.Exec(`UPDATE brand_profiles SET `+strings.Join(updates, ", ")+` WHERE id = ?`, values...)
	return err
}

func ensureSettingsTable(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	return err
}

func ensureProjectsTable(db *sql.DB) error {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		keyword TEXT DEFAULT '',
		description TEXT DEFAULT '',
		status TEXT DEFAULT 'active',
		profile_id INTEGER,
		blog_id INTEGER,
		cardnews_id INTEGER,
		comic_id INTEGER,
		video_path TEXT DEFAULT '',
		video_path_slide TEXT DEFAULT '',
		threads_text TEXT DEFAULT '',
		twitter_text TEXT DEFAULT '',
		ig_caption TEXT DEFAULT '',
		blog_uploaded_at TEXT DEFAULT '',
		blog_url TEXT DEFAULT '',
		ig_uploaded_at TEXT DEFAULT '',
		ig_url TEXT DEFAULT '',
		threads_uploaded_at TEXT DEFAULT '',
		threads_url TEXT DEFAULT '',
		twitter_uploaded_at TEXT DEFAULT '',
		twitter_url TEXT DEFAULT '',
		youtube_uploaded_at TEXT DEFAULT '',
		youtube_url TEXT DEFAULT '',
		blog_images_dir TEXT DEFAULT '',
		detail_page_dir TEXT DEFAULT '',
		source_urls TEXT DEFAULT '[]',
		created_at TEXT DEFAULT (datetime('now', 'localtime')),
		updated_at TEXT DEFAULT (datetime('now', 'localtime'))
	)`)
	return err
}

func tableExists(db *sql.DB, table string) bool {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?`, table).Scan(&count); err != nil {
		return false
	}
	return count > 0
}

func countTable(db *sql.DB, table string) int {
	if !isSafeDBIdentifier(table) || !tableExists(db, table) {
		return 0
	}
	var count int
	if err := db.QueryRow(fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, table)).Scan(&count); err != nil {
		return 0
	}
	return count
}

func querySingleMap(db *sql.DB, query string, args ...any) (map[string]any, error) {
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := rowsToMaps(rows)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, sql.ErrNoRows
	}
	return items[0], nil
}

func rowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	result := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		scans := make([]any, len(columns))
		for i := range values {
			scans[i] = &values[i]
		}
		if err := rows.Scan(scans...); err != nil {
			return nil, err
		}
		item := map[string]any{}
		for i, column := range columns {
			switch v := values[i].(type) {
			case []byte:
				item[column] = string(v)
			default:
				item[column] = v
			}
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func parseJSONArrayStrings(raw any) []string {
	value := strings.TrimSpace(stringify(raw))
	if value == "" {
		return []string{}
	}
	var items []string
	if err := json.Unmarshal([]byte(value), &items); err == nil {
		return items
	}
	return []string{}
}

func safeProfileAssetFilename(raw string) string {
	if decoded, err := url.PathUnescape(raw); err == nil {
		raw = decoded
	}
	raw = filepath.Base(strings.TrimSpace(raw))
	raw = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '.', r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, raw)
	raw = strings.Trim(raw, ".- _")
	if raw == "" || raw == "." || raw == ".." {
		return ""
	}
	if len(raw) > 180 {
		ext := filepath.Ext(raw)
		raw = strings.TrimSuffix(raw[:180], ".- _") + ext
	}
	return raw
}

func isProfileImageExt(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".webp":
		return true
	default:
		return false
	}
}

func isProfileImageFilename(filename string) bool {
	return safeProfileAssetFilename(filename) != "" && isProfileImageExt(filepath.Ext(filename))
}

func imageExtensionFromContent(contentType string, imageURL string) string {
	if ext := strings.ToLower(filepath.Ext(strings.Split(imageURL, "?")[0])); isProfileImageExt(ext) {
		return ext
	}
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch contentType {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	default:
		return ".png"
	}
}

func localImageFileDataURL(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))
	if !isProfileImageExt(ext) {
		return "", fmt.Errorf("unsupported image extension")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(raw) == 0 {
		return "", errors.New("empty image")
	}
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = http.DetectContentType(raw)
	}
	if !strings.HasPrefix(strings.ToLower(mimeType), "image/") {
		return "", fmt.Errorf("unsupported image mime")
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(raw), nil
}

func pathJoinURL(parts ...string) string {
	escaped := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.Trim(part, "/")
		if part == "" {
			continue
		}
		escaped = append(escaped, url.PathEscape(part))
	}
	return strings.Join(escaped, "/")
}

func parseJSONArray(raw any) []map[string]any {
	value := strings.TrimSpace(stringify(raw))
	if value == "" {
		return []map[string]any{}
	}
	var items []map[string]any
	if err := json.Unmarshal([]byte(value), &items); err == nil {
		return items
	}
	return []map[string]any{}
}

func normalizeStringList(raw any) []string {
	switch cast := raw.(type) {
	case []string:
		return cast
	case []any:
		items := make([]string, 0, len(cast))
		for _, item := range cast {
			text := strings.TrimSpace(stringify(item))
			if text != "" {
				items = append(items, text)
			}
		}
		return items
	default:
		return []string{}
	}
}

func collectImageEntries(dataDir, projectDir, fallbackFolder, urlPrefix string) []map[string]any {
	if strings.TrimSpace(projectDir) == "" {
		return []map[string]any{}
	}
	dir := projectDir
	if !filepath.IsAbs(dir) {
		dir = filepath.Join(dataDir, "output", fallbackFolder, filepath.Base(projectDir))
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []map[string]any{}
	}
	items := make([]map[string]any, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" {
			continue
		}
		items = append(items, map[string]any{
			"filename": name,
			"url":      strings.TrimRight(urlPrefix, "/") + "/" + filepath.Base(dir) + "/" + name,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return stringify(items[i]["filename"]) < stringify(items[j]["filename"])
	})
	return items
}

func collectBGMFiles(dataDir string, profileID int) []map[string]any {
	files := make([]map[string]any, 0)
	seen := map[string]struct{}{}
	for _, dir := range bgmSearchDirs(dataDir, profileID) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		type bgmEntry struct {
			path string
			info os.FileInfo
		}
		collected := make([]bgmEntry, 0)
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			fullPath := filepath.Join(dir, entry.Name())
			info, infoErr := entry.Info()
			if infoErr != nil {
				continue
			}
			collected = append(collected, bgmEntry{path: fullPath, info: info})
		}
		sort.Slice(collected, func(i, j int) bool {
			return collected[i].info.ModTime().After(collected[j].info.ModTime())
		})
		for _, item := range collected {
			ext := strings.ToLower(filepath.Ext(item.path))
			if ext != ".mp3" && ext != ".wav" && ext != ".ogg" && ext != ".m4a" && ext != ".aac" && ext != ".webm" {
				continue
			}
			name := filepath.Base(item.path)
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			files = append(files, map[string]any{
				"name":        strings.TrimSuffix(name, filepath.Ext(name)),
				"filename":    name,
				"path":        name,
				"url":         "/api/bgm/file/" + name,
				"size":        item.info.Size(),
				"dir":         dir,
				"is_external": false,
			})
		}
	}
	return files
}

func bgmSearchDirs(dataDir string, profileID int) []string {
	dirs := make([]string, 0, 2)
	if profileID > 0 {
		profileDir := filepath.Join(dataDir, "output", "library", strconv.Itoa(profileID), "bgm")
		dirs = append(dirs, profileDir)
	}
	dirs = append(dirs, filepath.Join(dataDir, "output", "bgm"))
	return dirs
}

func resolveDataDir(cfg config.Config) string {
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

func intQuery(r *http.Request, key string, fallback int) int {
	value := strings.TrimSpace(r.URL.Query().Get(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func intFromAny(value any) int {
	switch cast := value.(type) {
	case int:
		return cast
	case int64:
		return int(cast)
	case float64:
		return int(cast)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(cast))
		if err == nil {
			return parsed
		}
	}
	return 0
}

func nullableInt(value any) any {
	if intValue := intFromAny(value); intValue > 0 {
		return intValue
	}
	text := strings.TrimSpace(stringify(value))
	if text == "" {
		return nil
	}
	return text
}

func stringify(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	default:
		raw, err := json.Marshal(cast)
		if err == nil {
			return strings.Trim(string(raw), `"`)
		}
		return fmt.Sprint(cast)
	}
}

func defaultText(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func boolFromAnyDefault(value any, fallback bool) bool {
	switch cast := value.(type) {
	case bool:
		return cast
	case string:
		switch strings.ToLower(strings.TrimSpace(cast)) {
		case "1", "true", "yes", "y":
			return true
		case "0", "false", "no", "n":
			return false
		}
	case float64:
		return cast != 0
	case int:
		return cast != 0
	}
	return fallback
}

func mustJSONString(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func mustJSONObjectString(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func cloneMap(src map[string]any) map[string]any {
	if len(src) == 0 {
		return map[string]any{}
	}
	dst := make(map[string]any, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func maskSensitiveSettings(input map[string]map[string]string) map[string]map[string]string {
	result := map[string]map[string]string{}
	for section, values := range input {
		result[section] = map[string]string{}
		for key, value := range values {
			result[section][key] = value
		}
		if pw, ok := result[section]["naver_pw"]; ok {
			result[section]["naver_pw"] = maskPrefix(pw, 2)
		}
		if pw, ok := result[section]["instagram_pw"]; ok {
			result[section]["instagram_pw"] = maskPrefix(pw, 2)
		}
		if key, ok := result[section]["openai_api_key"]; ok {
			result[section]["openai_api_key"] = maskPrefix(key, 8)
		}
		if key, ok := result[section]["gemini_api_key"]; ok {
			result[section]["gemini_api_key"] = maskPrefix(key, 8)
		}
		if key, ok := result[section]["atlas_key"]; ok {
			result[section]["atlas_key"] = maskPrefix(key, 6)
		}
		if key, ok := result[section]["access_token"]; ok {
			result[section]["access_token"] = maskPrefix(key, 10)
		}
		for _, secretKey := range []string{"developer_token", "client_secret", "refresh_token"} {
			if key, ok := result[section][secretKey]; ok {
				result[section][secretKey] = maskPrefix(key, 8)
			}
		}
	}
	return result
}

func maskPrefix(value string, keep int) string {
	if value == "" {
		return ""
	}
	if len(value) <= keep {
		return value
	}
	if keep >= 10 {
		return value[:keep] + "..."
	}
	return value[:keep] + "***"
}

func findChromeExecutable() (string, []string) {
	candidates := []string{}
	if runtime.GOOS == "darwin" {
		candidates = append(candidates,
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			filepath.Join(os.Getenv("HOME"), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
		)
	} else if runtime.GOOS == "windows" {
		localAppData := os.Getenv("LOCALAPPDATA")
		programFiles := os.Getenv("ProgramFiles")
		programFilesX86 := os.Getenv("ProgramFiles(x86)")
		candidates = append(candidates,
			filepath.Join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
		)
	} else {
		candidates = append(candidates, "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium")
	}

	for _, candidate := range candidates {
		if candidate != "" && fileExists(candidate) {
			return candidate, candidates
		}
	}
	if path, err := exec.LookPath("google-chrome"); err == nil {
		return path, append(candidates, path)
	}
	if path, err := exec.LookPath("chrome"); err == nil {
		return path, append(candidates, path)
	}
	return "", candidates
}

func openChromeExtensionsPage() {
	chromePath, _ := findChromeExecutable()
	switch runtime.GOOS {
	case "darwin":
		if chromePath != "" {
			_ = exec.Command(chromePath, "chrome://extensions").Start()
			return
		}
		_ = exec.Command("open", "-a", "Google Chrome", "chrome://extensions").Start()
	case "windows":
		if chromePath != "" {
			_ = exec.Command(chromePath, "chrome://extensions").Start()
			return
		}
		_ = exec.Command("cmd", "/c", "start", "chrome://extensions").Start()
	default:
		if chromePath != "" {
			_ = exec.Command(chromePath, "chrome://extensions").Start()
			return
		}
		_ = exec.Command("xdg-open", "chrome://extensions").Start()
	}
}

func openURLInDefaultBrowser(targetURL string) {
	targetURL = strings.TrimSpace(targetURL)
	if targetURL == "" {
		return
	}
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", targetURL).Start()
	case "windows":
		_ = exec.Command("cmd", "/c", "start", "", targetURL).Start()
	default:
		_ = exec.Command("xdg-open", targetURL).Start()
	}
}

func openChromeExtensionFolder(extDir string) {
	switch runtime.GOOS {
	case "darwin":
		_ = exec.Command("open", "-R", extDir).Start()
	case "windows":
		_ = exec.Command("explorer", "/select,", extDir).Start()
	default:
		_ = exec.Command("xdg-open", filepath.Dir(extDir)).Start()
	}
}

func openFolderInOS(folder string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", folder).Start()
	case "windows":
		return exec.Command("explorer", folder).Start()
	default:
		return exec.Command("xdg-open", folder).Start()
	}
}

func (s *Service) managedChromeExtensionDir() string {
	return filepath.Join(s.dataDir, "chrome-extension")
}

func defaultChromeUserDataDir() string {
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "Google", "Chrome")
	case "windows":
		return filepath.Join(os.Getenv("LOCALAPPDATA"), "Google", "Chrome", "User Data")
	default:
		return filepath.Join(os.Getenv("HOME"), ".config", "google-chrome")
	}
}

func scanChromeProfiles() []map[string]any {
	userDataDir := defaultChromeUserDataDir()
	entries, err := os.ReadDir(userDataDir)
	if err != nil {
		return []map[string]any{
			{"dir": "Default", "name": "기본 프로필", "full_name": "", "email": ""},
		}
	}
	profiles := []map[string]any{}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if name != "Default" && !strings.HasPrefix(name, "Profile") {
			continue
		}
		profileName := name
		email := ""
		fullName := ""
		prefPath := filepath.Join(userDataDir, name, "Preferences")
		if raw, readErr := os.ReadFile(prefPath); readErr == nil {
			var prefs map[string]any
			if jsonErr := json.Unmarshal(raw, &prefs); jsonErr == nil {
				if profileMap, ok := prefs["profile"].(map[string]any); ok {
					if parsed := strings.TrimSpace(stringFromAny(profileMap["name"])); parsed != "" {
						profileName = parsed
					}
				}
				if accountInfo, ok := prefs["account_info"].([]any); ok && len(accountInfo) > 0 {
					if primary, ok := accountInfo[0].(map[string]any); ok {
						email = strings.TrimSpace(stringFromAny(primary["email"]))
						fullName = strings.TrimSpace(stringFromAny(primary["full_name"]))
						if fullName == "" {
							fullName = strings.TrimSpace(stringFromAny(primary["given_name"]))
						}
					}
				}
			}
		}
		profiles = append(profiles, map[string]any{
			"dir":       name,
			"name":      profileName,
			"full_name": fullName,
			"email":     email,
		})
	}
	if len(profiles) == 0 {
		return []map[string]any{
			{"dir": "Default", "name": "기본 프로필", "full_name": "", "email": ""},
		}
	}
	sort.Slice(profiles, func(i, j int) bool {
		return stringify(profiles[i]["dir"]) < stringify(profiles[j]["dir"])
	})
	return profiles
}

func stringFromAny(v any) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return stringify(v)
	}
}

func defaultInt(v int, fallback int) int {
	if v > 0 {
		return v
	}
	return fallback
}

func (s *Service) appendBrowserLog(message string) {
	message = strings.TrimSpace(message)
	if message == "" {
		return
	}
	line := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), message)
	s.browserMu.Lock()
	s.browserLogs = append(s.browserLogs, line)
	if len(s.browserLogs) > 200 {
		s.browserLogs = append([]string{}, s.browserLogs[len(s.browserLogs)-200:]...)
	}
	s.browserMu.Unlock()
}

func (s *Service) recentBrowserLogs(lines int) []string {
	if lines <= 0 {
		lines = 20
	}
	s.browserMu.RLock()
	defer s.browserMu.RUnlock()
	if len(s.browserLogs) == 0 {
		return []string{}
	}
	if lines >= len(s.browserLogs) {
		return append([]string{}, s.browserLogs...)
	}
	return append([]string{}, s.browserLogs[len(s.browserLogs)-lines:]...)
}

func (s *Service) completeLiveAgent(agentID string) {
	steps := []struct {
		message string
		color   string
		delay   time.Duration
	}{
		{message: "브라우저 작업 계획을 정리했습니다.", color: "#007aff", delay: 500 * time.Millisecond},
		{message: "실행 가능한 단계로 시나리오를 분해했습니다.", color: "#ff8c00", delay: 700 * time.Millisecond},
		{message: "go-only 모드 샘플 워크플로를 완료했습니다.", color: "#34c759", delay: 900 * time.Millisecond},
	}
	for _, step := range steps {
		time.Sleep(step.delay)
		s.browserMu.Lock()
		agent, ok := s.liveAgents[agentID]
		if !ok || !agent.Running {
			s.browserMu.Unlock()
			return
		}
		agent.Logs = append(agent.Logs, map[string]any{"message": step.message, "color": step.color})
		agent.UpdatedAt = time.Now().Format(time.RFC3339)
		s.browserMu.Unlock()
	}

	s.browserMu.Lock()
	agent, ok := s.liveAgents[agentID]
	if ok && agent.Running {
		agent.Running = false
		agent.Done = true
		agent.StatusText = "완료"
		agent.FinalAnswer = "go-only 브라우저 워커가 요청을 수용했습니다. 실제 브라우저 자동화는 추후 연결되더라도 UI에서는 동일한 흐름으로 이어질 수 있도록 상태와 로그를 정리했습니다."
		agent.Logs = append(agent.Logs, map[string]any{"message": "작업이 완료되었습니다.", "color": "#34c759"})
		agent.UpdatedAt = time.Now().Format(time.RFC3339)
	}
	s.browserMu.Unlock()
	s.appendBrowserLog("라이브 에이전트 완료: " + agentID)
}

func (s *Service) stopLiveAgentLocked(agent *liveAgentState, reason string) {
	if agent == nil || !agent.Running {
		return
	}
	agent.Running = false
	agent.Done = false
	agent.StatusText = "중지"
	if strings.TrimSpace(reason) != "" {
		agent.Logs = append(agent.Logs, map[string]any{"message": reason, "color": "#ff3b30"})
	}
	agent.UpdatedAt = time.Now().Format(time.RFC3339)
}

func (s *Service) listLiveAgents() []map[string]any {
	s.browserMu.RLock()
	defer s.browserMu.RUnlock()
	items := make([]map[string]any, 0, len(s.liveAgents))
	for _, agent := range s.liveAgents {
		if agent == nil {
			continue
		}
		items = append(items, map[string]any{
			"agent_id":      agent.AgentID,
			"task":          agent.Task,
			"task_full":     agent.TaskFull,
			"max_steps":     agent.MaxSteps,
			"scenario_name": nullableString(agent.ScenarioName),
			"running":       agent.Running,
			"done":          agent.Done,
			"error":         nullableString(agent.Error),
			"final_answer":  nullableString(agent.FinalAnswer),
			"status_text":   agent.StatusText,
			"log_count":     len(agent.Logs),
			"created_at":    nullableString(agent.CreatedAt),
			"updated_at":    nullableString(agent.UpdatedAt),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return stringify(items[i]["agent_id"]) > stringify(items[j]["agent_id"])
	})
	return items
}

func cloneLogEntries(input []map[string]any) []map[string]any {
	if len(input) == 0 {
		return []map[string]any{}
	}
	output := make([]map[string]any, 0, len(input))
	for _, item := range input {
		output = append(output, cloneMap(item))
	}
	return output
}

func truncateRunes(value string, limit int) string {
	runes := []rune(strings.TrimSpace(value))
	if limit <= 0 || len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit])
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
