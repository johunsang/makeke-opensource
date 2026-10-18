package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"makeke/api/internal/config"
)

func TestHandleClaudeDesignCommentsRoundTrip(t *testing.T) {
	server := &Server{config: config.Config{DataDir: t.TempDir()}}
	saved, err := server.saveClaudeDesignHistoryItem(claudeDesignSaveRequest{
		HTML: "<html><body><h1 data-makeke-id=\"title\">Hello</h1></body></html>",
		Name: "Comment Target",
		Kind: "poster",
	}, nil)
	if err != nil {
		t.Fatalf("save history item: %v", err)
	}
	id := saved["id"].(string)

	putBody := `{"comments":[{"id":"note-1","selector":"[data-makeke-id=\"title\"]","element_id":"title","label":"H1","text":"Hello","note":"제목을 더 짧게","status":"open"}]}`
	putReq := httptest.NewRequest(http.MethodPut, "/api/claude-design/comments/"+id, strings.NewReader(putBody))
	putRec := httptest.NewRecorder()
	server.handleClaudeDesignComments(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("put status = %d, body = %s", putRec.Code, putRec.Body.String())
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/claude-design/comments/"+id, nil)
	getRec := httptest.NewRecorder()
	server.handleClaudeDesignComments(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get status = %d, body = %s", getRec.Code, getRec.Body.String())
	}
	var got struct {
		Comments []claudeDesignComment `json:"comments"`
	}
	if err := json.NewDecoder(getRec.Body).Decode(&got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Comments) != 1 || got.Comments[0].Note != "제목을 더 짧게" {
		t.Fatalf("comments = %#v", got.Comments)
	}
	metaPath := filepath.Join(server.claudeDesignHistoryDir(), strings.TrimSuffix(id, ".html")+".json")
	raw, err := os.ReadFile(metaPath)
	if err != nil {
		t.Fatalf("read meta: %v", err)
	}
	if !strings.Contains(string(raw), "comments_updated_at") {
		t.Fatalf("meta should include comments_updated_at, got %s", string(raw))
	}
}

func TestNormalizeClaudeDesignCommentsValidatesTarget(t *testing.T) {
	if _, err := normalizeClaudeDesignComments([]claudeDesignComment{{Note: "no target"}}); err == nil {
		t.Fatal("expected target validation error")
	}
	if _, err := normalizeClaudeDesignComments([]claudeDesignComment{{Selector: "body", Status: "closed"}}); err == nil {
		t.Fatal("expected status validation error")
	}
}
