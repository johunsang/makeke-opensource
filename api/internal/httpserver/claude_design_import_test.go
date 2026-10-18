package httpserver

import (
	"strings"
	"testing"
)

func TestRewriteClaudeDesignImportAssetRefs(t *testing.T) {
	files := map[string][]byte{
		"project/index.html":      []byte("<html></html>"),
		"project/assets/card.png": []byte("asset"),
		"project/styles/app.css":  []byte("css"),
	}
	html := `<html><head><link href="styles/app.css"><style>.hero{background:url("../project/assets/card.png")}</style></head><body><img src="assets/card.png"><a href="https://example.com">external</a></body></html>`

	rewritten := rewriteClaudeDesignImportAssetRefs(html, "project/index.html", "imported_20260509_122300", files)

	if !strings.Contains(rewritten, `/api/claude-design/import-asset/imported_20260509_122300/project/assets/card.png`) {
		t.Fatalf("expected local asset URL rewrite, got: %s", rewritten)
	}
	if !strings.Contains(rewritten, `/api/claude-design/import-asset/imported_20260509_122300/project/styles/app.css`) {
		t.Fatalf("expected stylesheet URL rewrite, got: %s", rewritten)
	}
	if !strings.Contains(rewritten, `https://example.com`) {
		t.Fatalf("external URL should be preserved, got: %s", rewritten)
	}
}

func TestChooseClaudeDesignImportEntryUsesArtifactManifest(t *testing.T) {
	files := []claudeDesignImportedFile{
		{Path: "index.html", Body: []byte("<h1>wrong</h1>")},
		{Path: "slides/deck.html", Body: []byte("<h1>right</h1>")},
		{Path: "slides/deck.html.artifact.json", Body: []byte(`{"version":1,"kind":"deck","renderer":"deck-html","title":"Manifest Deck","entry":"slides/deck.html","exports":["html","zip"]}`)},
	}

	entry, manifest := chooseClaudeDesignImportEntry(files)

	if entry != "slides/deck.html" {
		t.Fatalf("expected manifest entry, got %q", entry)
	}
	if manifest["title"] != "Manifest Deck" {
		t.Fatalf("expected manifest title, got %#v", manifest)
	}
}

func TestSanitizeClaudeDesignZipPathRejectsEscapes(t *testing.T) {
	badPaths := []string{"../secret.html", "/tmp/secret.html", `C:\tmp\secret.html`, "safe/../../secret.html"}
	for _, badPath := range badPaths {
		if _, err := sanitizeClaudeDesignZipPath(badPath); err == nil {
			t.Fatalf("expected %q to be rejected", badPath)
		}
	}
}
