package content

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveLocalImagePathFromRemoteURLDownloadsImage(t *testing.T) {
	var buf bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(buf.Bytes())
	}))
	defer server.Close()

	service := &Service{dataDir: t.TempDir()}
	got := service.resolveLocalImagePathFromURL(server.URL + "/sample.png?ref=1")
	if got == "" {
		t.Fatal("expected remote image to resolve to a local file")
	}
	if !strings.Contains(got, filepath.Join("output", "user_images", "remote_refs")) {
		t.Fatalf("expected cached remote ref path, got %q", got)
	}
	if _, err := os.Stat(got); err != nil {
		t.Fatalf("expected cached file to exist: %v", err)
	}
}

func TestBuildComicPanelPromptIncludesLogoRuleForLastPanel(t *testing.T) {
	prompt := buildComicPanelPrompt(map[string]any{
		"situation":     "마지막 컷",
		"dialogue":      "문의해보자",
		"narration":     "브랜드를 기억한다",
		"emotion":       "hopeful",
		"visual_prompt": "밝은 엔딩 컷",
	}, "테스트 만화", "cute", "/tmp/panel.png", []string{"/tmp/ref.png", "/tmp/logo.png"}, "/tmp/logo.png", "bottom-right", true)

	for _, want := range []string{"/tmp/logo.png", "자연스럽게 녹이세요", "마지막 컷"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("expected prompt to include %q\n%s", want, prompt)
		}
	}
	if strings.Contains(prompt, "bottom-right") {
		t.Fatalf("expected prompt not to force logo placement\n%s", prompt)
	}
}
