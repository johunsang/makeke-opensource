package httpserver

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type appNotice struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Type      string `json:"type"`
	Active    bool   `json:"active"`
	Source    string `json:"source"`
	EventKey  string `json:"event_key"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func (s *Server) handleNotices(w http.ResponseWriter, r *http.Request) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db open failed: " + err.Error()})
		return
	}
	defer db.Close()
	if err := ensureAppNoticesSchema(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "notice schema failed: " + err.Error()})
		return
	}

	switch r.Method {
	case http.MethodGet:
		items, err := listAppNotices(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "notice list failed: " + err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var req struct {
			Title   string `json:"title"`
			Content string `json:"content"`
			Type    string `json:"type"`
			Source  string `json:"source"`
			Active  *bool  `json:"active"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
			return
		}
		title := strings.TrimSpace(req.Title)
		if title == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
			return
		}
		active := 1
		if req.Active != nil && !*req.Active {
			active = 0
		}
		noticeType := strings.TrimSpace(req.Type)
		if noticeType == "" {
			noticeType = "info"
		}
		source := strings.TrimSpace(req.Source)
		if source == "" {
			source = "manual"
		}
		result, err := db.Exec(`
			INSERT INTO app_notices (title, content, type, active, source, updated_at)
			VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
		`, title, strings.TrimSpace(req.Content), noticeType, active, source)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "notice create failed: " + err.Error()})
			return
		}
		id, _ := result.LastInsertId()
		item, err := fetchAppNotice(db, id)
		if err != nil {
			writeJSON(w, http.StatusCreated, map[string]any{"id": id, "ok": true})
			return
		}
		writeJSON(w, http.StatusCreated, item)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) handleNoticeItem(w http.ResponseWriter, r *http.Request) {
	idText := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/notices/"), "/")
	id, err := strconv.ParseInt(idText, 10, 64)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid notice id"})
		return
	}
	if r.Method != http.MethodDelete {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db open failed: " + err.Error()})
		return
	}
	defer db.Close()
	if err := ensureAppNoticesSchema(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "notice schema failed: " + err.Error()})
		return
	}
	result, err := db.Exec(`DELETE FROM app_notices WHERE id = ?`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "notice delete failed: " + err.Error()})
		return
	}
	deleted, _ := result.RowsAffected()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": deleted})
}

func ensureAppNoticesSchema(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS app_notices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			type TEXT DEFAULT 'info',
			active INTEGER DEFAULT 1,
			created_at TEXT DEFAULT (datetime('now','localtime')),
			source TEXT NOT NULL DEFAULT 'manual',
			event_key TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL DEFAULT ''
		)
	`)
	return err
}

func listAppNotices(db *sql.DB) ([]appNotice, error) {
	rows, err := db.Query(`
		SELECT id, title, content, COALESCE(type,'info'), COALESCE(active,1), COALESCE(source,''), COALESCE(event_key,''), COALESCE(created_at,''), COALESCE(updated_at,'')
		FROM app_notices
		WHERE COALESCE(active,1) != 0
		ORDER BY COALESCE(NULLIF(updated_at,''), created_at) DESC, id DESC
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []appNotice{}
	for rows.Next() {
		var item appNotice
		var active int
		if err := rows.Scan(&item.ID, &item.Title, &item.Content, &item.Type, &active, &item.Source, &item.EventKey, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.Active = active != 0
		items = append(items, item)
	}
	return items, rows.Err()
}

func fetchAppNotice(db *sql.DB, id int64) (appNotice, error) {
	var item appNotice
	var active int
	err := db.QueryRow(`
		SELECT id, title, content, COALESCE(type,'info'), COALESCE(active,1), COALESCE(source,''), COALESCE(event_key,''), COALESCE(created_at,''), COALESCE(updated_at,'')
		FROM app_notices
		WHERE id = ?
	`, id).Scan(&item.ID, &item.Title, &item.Content, &item.Type, &active, &item.Source, &item.EventKey, &item.CreatedAt, &item.UpdatedAt)
	item.Active = active != 0
	return item, err
}
