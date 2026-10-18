package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	claudeDesignMaxComments        = 200
	claudeDesignMaxCommentNote     = 2000
	claudeDesignMaxCommentText     = 300
	claudeDesignMaxCommentLabel    = 120
	claudeDesignMaxCommentSelector = 500
)

type claudeDesignComment struct {
	ID        string `json:"id"`
	Selector  string `json:"selector"`
	ElementID string `json:"element_id"`
	Label     string `json:"label"`
	Text      string `json:"text"`
	Note      string `json:"note"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type claudeDesignCommentsRequest struct {
	Comments []claudeDesignComment `json:"comments"`
}

func (s *Server) handleClaudeDesignComments(w http.ResponseWriter, r *http.Request) {
	id := cleanDesignHistoryID(strings.TrimPrefix(r.URL.Path, "/api/claude-design/comments/"))
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid item id"})
		return
	}
	htmlPath := filepath.Join(s.claudeDesignHistoryDir(), id)
	if _, err := os.Stat(htmlPath); err != nil {
		status := http.StatusInternalServerError
		if os.IsNotExist(err) {
			status = http.StatusNotFound
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	metaPath := strings.TrimSuffix(htmlPath, ".html") + ".json"
	switch r.Method {
	case http.MethodGet:
		meta, err := readClaudeDesignMetaFile(metaPath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   "ok",
			"id":       id,
			"comments": claudeDesignCommentsFromMeta(meta),
		})
	case http.MethodPut:
		var req claudeDesignCommentsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		comments, err := normalizeClaudeDesignComments(req.Comments)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		meta, err := readClaudeDesignMetaFile(metaPath)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		meta["comments"] = comments
		meta["comments_updated_at"] = time.Now().Format(time.RFC3339)
		if err := writeClaudeDesignMetaFile(metaPath, meta); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "id": id, "comments": comments})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func readClaudeDesignMetaFile(path string) (map[string]any, error) {
	meta := map[string]any{}
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return meta, nil
		}
		return nil, err
	}
	if len(strings.TrimSpace(string(raw))) == 0 {
		return meta, nil
	}
	if err := json.Unmarshal(raw, &meta); err != nil {
		return nil, err
	}
	return meta, nil
}

func writeClaudeDesignMetaFile(path string, meta map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, raw, 0o644)
}

func claudeDesignCommentsFromMeta(meta map[string]any) []claudeDesignComment {
	raw, err := json.Marshal(meta["comments"])
	if err != nil || string(raw) == "null" {
		return []claudeDesignComment{}
	}
	var comments []claudeDesignComment
	if err := json.Unmarshal(raw, &comments); err != nil {
		return []claudeDesignComment{}
	}
	return comments
}

func normalizeClaudeDesignComments(input []claudeDesignComment) ([]claudeDesignComment, error) {
	if len(input) > claudeDesignMaxComments {
		return nil, fmt.Errorf("comments exceed limit: %d", claudeDesignMaxComments)
	}
	now := time.Now().Format(time.RFC3339)
	comments := make([]claudeDesignComment, 0, len(input))
	seen := map[string]bool{}
	for index, comment := range input {
		selector := trimRuneLimit(comment.Selector, claudeDesignMaxCommentSelector)
		elementID := trimRuneLimit(comment.ElementID, claudeDesignMaxCommentLabel)
		if selector == "" && elementID == "" {
			return nil, errors.New("comment target is required")
		}
		status := strings.ToLower(strings.TrimSpace(comment.Status))
		if status == "" {
			status = "open"
		}
		if status != "open" && status != "resolved" {
			return nil, errors.New("comment status must be open or resolved")
		}
		id := cleanClaudeDesignCommentID(comment.ID)
		if id == "" {
			id = fmt.Sprintf("cd-comment-%d-%d", time.Now().UnixNano(), index)
		}
		for seen[id] {
			id = fmt.Sprintf("%s-%d", id, index)
		}
		seen[id] = true
		createdAt := strings.TrimSpace(comment.CreatedAt)
		if createdAt == "" {
			createdAt = now
		}
		comments = append(comments, claudeDesignComment{
			ID:        id,
			Selector:  selector,
			ElementID: elementID,
			Label:     trimRuneLimit(comment.Label, claudeDesignMaxCommentLabel),
			Text:      trimRuneLimit(comment.Text, claudeDesignMaxCommentText),
			Note:      trimRuneLimit(comment.Note, claudeDesignMaxCommentNote),
			Status:    status,
			CreatedAt: createdAt,
			UpdatedAt: now,
		})
	}
	return comments, nil
}

func cleanClaudeDesignCommentID(id string) string {
	id, _ = url.PathUnescape(strings.TrimSpace(id))
	var b strings.Builder
	for _, r := range id {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_':
			b.WriteRune(r)
		}
		if b.Len() >= 80 {
			break
		}
	}
	return b.String()
}

func trimRuneLimit(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
