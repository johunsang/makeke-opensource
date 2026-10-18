package httpserver

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type animationAdHistoryRequest struct {
	ID           int64           `json:"id"`
	Title        string          `json:"title"`
	Topic        string          `json:"topic"`
	ProfileID    int64           `json:"profile_id"`
	Duration     int             `json:"duration"`
	Aspect       string          `json:"aspect"`
	ThumbnailURL string          `json:"thumbnail_url"`
	FinalURL     string          `json:"final_url"`
	Payload      json.RawMessage `json:"payload"`
}

type animationAdHistoryItem struct {
	ID           int64           `json:"id"`
	Title        string          `json:"title"`
	Topic        string          `json:"topic"`
	ProfileID    int64           `json:"profile_id"`
	Duration     int             `json:"duration"`
	Aspect       string          `json:"aspect"`
	ThumbnailURL string          `json:"thumbnail_url"`
	FinalURL     string          `json:"final_url"`
	Payload      json.RawMessage `json:"payload,omitempty"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
}

func (s *Server) handleAnimationAdHistory(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.listAnimationAdHistory(w, r)
	case http.MethodPost:
		s.saveAnimationAdHistory(w, r)
	case http.MethodDelete:
		s.deleteAllAnimationAdHistory(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) handleAnimationAdHistoryItem(w http.ResponseWriter, r *http.Request) {
	id, err := parseAnimationAdHistoryID(r.URL.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.getAnimationAdHistory(w, id)
	case http.MethodDelete:
		s.deleteAnimationAdHistory(w, id)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) listAnimationAdHistory(w http.ResponseWriter, r *http.Request) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	limit := 30
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		if parsed, parseErr := strconv.Atoi(rawLimit); parseErr == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 100 {
		limit = 100
	}

	rows, err := db.Query(`
		SELECT id, title, topic, profile_id, duration, aspect, thumbnail_url, final_url, created_at, updated_at
		FROM animation_ad_history
		ORDER BY updated_at DESC, id DESC
		LIMIT ?`, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]animationAdHistoryItem, 0)
	for rows.Next() {
		var item animationAdHistoryItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Topic, &item.ProfileID, &item.Duration, &item.Aspect, &item.ThumbnailURL, &item.FinalURL, &item.CreatedAt, &item.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Server) saveAnimationAdHistory(w http.ResponseWriter, r *http.Request) {
	var req animationAdHistoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if len(req.Payload) == 0 || !json.Valid(req.Payload) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "payload is required"})
		return
	}

	item := normalizeAnimationAdHistoryRequest(req)
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	now := time.Now().Format(time.RFC3339)
	if item.ID > 0 {
		result, err := db.Exec(`
			UPDATE animation_ad_history
			SET title = ?, topic = ?, profile_id = ?, duration = ?, aspect = ?, payload_json = ?, thumbnail_url = ?, final_url = ?, updated_at = ?
			WHERE id = ?`,
			item.Title, item.Topic, item.ProfileID, item.Duration, item.Aspect, string(item.Payload), item.ThumbnailURL, item.FinalURL, now, item.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "history not found"})
			return
		}
	} else {
		result, err := db.Exec(`
			INSERT INTO animation_ad_history (title, topic, profile_id, duration, aspect, payload_json, thumbnail_url, final_url, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.Title, item.Topic, item.ProfileID, item.Duration, item.Aspect, string(item.Payload), item.ThumbnailURL, item.FinalURL, now, now)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		item.ID, _ = result.LastInsertId()
	}

	saved, err := s.fetchAnimationAdHistory(db, item.ID, true)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": saved.ID, "item": saved})
}

func (s *Server) getAnimationAdHistory(w http.ResponseWriter, id int64) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	item, err := s.fetchAnimationAdHistory(db, id, true)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "history not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "item": item})
}

func (s *Server) deleteAnimationAdHistory(w http.ResponseWriter, id int64) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	result, err := db.Exec(`DELETE FROM animation_ad_history WHERE id = ?`, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "history not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) deleteAllAnimationAdHistory(w http.ResponseWriter, r *http.Request) {
	db, err := s.openAnimationAdDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	result, err := db.Exec(`DELETE FROM animation_ad_history`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": affected})
}

func (s *Server) fetchAnimationAdHistory(db *sql.DB, id int64, includePayload bool) (animationAdHistoryItem, error) {
	var item animationAdHistoryItem
	var payload string
	err := db.QueryRow(`
		SELECT id, title, topic, profile_id, duration, aspect, thumbnail_url, final_url, payload_json, created_at, updated_at
		FROM animation_ad_history
		WHERE id = ?`, id).
		Scan(&item.ID, &item.Title, &item.Topic, &item.ProfileID, &item.Duration, &item.Aspect, &item.ThumbnailURL, &item.FinalURL, &payload, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return item, err
	}
	if includePayload {
		item.Payload = json.RawMessage(payload)
	}
	return item, nil
}

func (s *Server) openAnimationAdDB() (*sql.DB, error) {
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(resolveHTTPDataDir(s.config), "naver_blog.db")
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", dbPath)
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
	if err := s.ensureAnimationAdSchema(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func (s *Server) ensureAnimationAdSchema(db *sql.DB) error {
	if err := ensureAnimationAdHistorySchema(db); err != nil {
		return err
	}
	if err := s.ensureAnimationAdSemanticSchema(db); err != nil {
		return err
	}
	return ensureAnimationAdSuccessCaseSchema(db)
}

func ensureAnimationAdHistorySchema(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS animation_ad_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL DEFAULT '',
			topic TEXT NOT NULL DEFAULT '',
			profile_id INTEGER NOT NULL DEFAULT 0,
			duration INTEGER NOT NULL DEFAULT 30,
			aspect TEXT NOT NULL DEFAULT '9:16',
			payload_json TEXT NOT NULL,
			thumbnail_url TEXT NOT NULL DEFAULT '',
			final_url TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_animation_ad_history_updated ON animation_ad_history(updated_at DESC, id DESC)`); err != nil {
		return err
	}
	return nil
}

func normalizeAnimationAdHistoryRequest(req animationAdHistoryRequest) animationAdHistoryItem {
	title := strings.TrimSpace(req.Title)
	topic := strings.TrimSpace(req.Topic)
	if topic == "" {
		topic = "애니메이션 광고"
	}
	if title == "" {
		title = topic
	}
	duration := req.Duration
	if duration >= 45 {
		duration = 60
	} else {
		duration = 30
	}
	aspect := strings.TrimSpace(req.Aspect)
	if aspect == "" {
		aspect = "9:16"
	}
	return animationAdHistoryItem{
		ID:           req.ID,
		Title:        title,
		Topic:        topic,
		ProfileID:    req.ProfileID,
		Duration:     duration,
		Aspect:       aspect,
		ThumbnailURL: strings.TrimSpace(req.ThumbnailURL),
		FinalURL:     strings.TrimSpace(req.FinalURL),
		Payload:      req.Payload,
	}
}

func parseAnimationAdHistoryID(path string) (int64, error) {
	raw := strings.TrimPrefix(path, "/api/animation-ad/history/")
	raw = strings.Trim(raw, "/")
	if raw == "" {
		return 0, fmt.Errorf("history id is required")
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid history id")
	}
	return id, nil
}
