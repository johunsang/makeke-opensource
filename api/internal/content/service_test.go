package content

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"makeke/api/internal/config"
)

func TestBuildNaverOpenSearchItemsCleansHTMLText(t *testing.T) {
	items := buildNaverOpenSearchItems("blog", []naverOpenSearchItem{
		{
			Title:       "<b>마케케</b> 블로그",
			Link:        "https://blog.naver.com/makeke/1",
			Description: "설명 <b>강조</b>",
			BloggerName: "브랜드 블로그",
		},
	})

	if len(items) != 1 {
		t.Fatalf("expected one item, got %d", len(items))
	}
	if got := stringify(items[0]["title"]); got != "마케케 블로그" {
		t.Fatalf("expected cleaned title, got %q", got)
	}
	if got := stringify(items[0]["description"]); got != "설명 강조" {
		t.Fatalf("expected cleaned description, got %q", got)
	}
	if got := stringify(items[0]["source"]); got != "블로그" {
		t.Fatalf("expected blog source label, got %q", got)
	}
}

func TestHandleCE2NaverSearchRequiresQuery(t *testing.T) {
	var service Service
	req := httptest.NewRequest(http.MethodPost, "/api/ce2/naver-search", strings.NewReader(`{"query":""}`))
	rec := httptest.NewRecorder()

	service.handleCE2NaverSearch(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "검색어") {
		t.Fatalf("expected Korean query error, got %s", rec.Body.String())
	}
}

func TestCleanYouTubeCaptionTextDropsVTTTiming(t *testing.T) {
	raw := `WEBVTT

00:00:00.000 --> 00:00:02.000 align:start position:0%
안녕하세요

00:00:02.000 --> 00:00:04.000
마케케 설명회입니다`

	got := cleanYouTubeCaptionText(raw)
	if got != "안녕하세요 마케케 설명회입니다" {
		t.Fatalf("expected cleaned captions, got %q", got)
	}
}

func TestHandleYouTubeTranscriptRequiresURL(t *testing.T) {
	var service Service
	req := httptest.NewRequest(http.MethodPost, "/api/content/youtube-transcript", strings.NewReader(`{"url":""}`))
	rec := httptest.NewRecorder()

	service.handleYouTubeTranscript(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "YouTube 링크") {
		t.Fatalf("expected Korean youtube link error, got %s", rec.Body.String())
	}
}

func TestResolveCLIPathUsesExplicitEnvPath(t *testing.T) {
	tempDir := t.TempDir()
	cliPath := filepath.Join(tempDir, "codex")
	if err := os.WriteFile(cliPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CODEX_CLI", cliPath)

	got, err := resolveCLIPath("codex")
	if err != nil {
		t.Fatalf("expected env cli path, got error: %v", err)
	}
	if got != cliPath {
		t.Fatalf("expected %q, got %q", cliPath, got)
	}
}

func TestResolveTextProviderUsesGeminiCLIModel(t *testing.T) {
	tempDir := t.TempDir()
	cliPath := filepath.Join(tempDir, "gemini")
	if err := os.WriteFile(cliPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GEMINI_CLI", cliPath)
	t.Setenv("MAKEKE_DB_PATH", filepath.Join(tempDir, "makeke.db"))

	service := New(config.Config{ProjectRoot: tempDir, DataDir: tempDir})
	db, err := service.openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES
		('MODELS.text_provider', 'cli'),
		('MODELS.text_model', 'gemini-cli')`); err != nil {
		t.Fatal(err)
	}

	got := service.resolveTextProvider("")
	if got.Provider != "gemini-cli" || got.Model != "gemini-cli" {
		t.Fatalf("expected gemini-cli provider/model, got %#v", got)
	}
}

func TestResolveTextProviderUsesClaudeCodeModel(t *testing.T) {
	tempDir := t.TempDir()
	cliPath := filepath.Join(tempDir, "claude")
	if err := os.WriteFile(cliPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CLAUDE_CLI", cliPath)
	t.Setenv("MAKEKE_DB_PATH", filepath.Join(tempDir, "makeke.db"))

	service := New(config.Config{ProjectRoot: tempDir, DataDir: tempDir})
	db, err := service.openDB()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := ensureSettingsTable(db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES
		('MODELS.text_provider', 'cli'),
		('MODELS.text_model', 'claude-code')`); err != nil {
		t.Fatal(err)
	}

	got := service.resolveTextProvider("")
	if got.Provider != "claude" || got.Model != "claude-code" {
		t.Fatalf("expected claude provider/model, got %#v", got)
	}
}
