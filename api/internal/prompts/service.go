package prompts

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"makeke/api/internal/config"

	_ "modernc.org/sqlite"
)

type Service struct {
	cfg    config.Config
	dbPath string
}

type resolvedPrompt struct {
	ID          int64    `json:"id,omitempty"`
	Category    string   `json:"category"`
	Subcategory string   `json:"subcategory"`
	Name        string   `json:"name,omitempty"`
	Content     string   `json:"content"`
	Variables   []string `json:"variables,omitempty"`
	ProfileID   int      `json:"profile_id"`
	IsCustom    bool     `json:"is_custom"`
	Source      string   `json:"source,omitempty"`
}

type promptCreateRequest struct {
	Category     string `json:"category"`
	Subcategory  string `json:"subcategory"`
	Name         string `json:"name"`
	Content      string `json:"content"`
	Variables    any    `json:"variables"`
	ProfileID    int    `json:"profile_id"`
	BusinessType string `json:"business_type"`
}

type promptRestoreRequest struct {
	ProfileID   int    `json:"profile_id"`
	Category    string `json:"category"`
	Subcategory string `json:"subcategory"`
}

type promptRow struct {
	ID          int64
	Category    string
	Subcategory string
	Name        string
	Content     string
	Variables   string
	IsDefault   int
	ProfileID   int
}

func New(cfg config.Config) *Service {
	dataDir := resolveDataDir(cfg)
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(dataDir, "naver_blog.db")
	}
	return &Service{
		cfg:    cfg,
		dbPath: dbPath,
	}
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/prompts", s.handleCollection)
	mux.HandleFunc("/api/prompts/resolve", s.handleResolve)
	mux.HandleFunc("/api/prompts/restore-defaults", s.handleRestoreDefaults)
	mux.HandleFunc("/api/prompts/reset/", s.handleReset)
}

func (s *Service) handleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleList(w, r)
	case http.MethodPost:
		s.handleCreate(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensurePromptTables(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	category := strings.TrimSpace(r.URL.Query().Get("category"))
	subcategory := strings.TrimSpace(r.URL.Query().Get("subcategory"))
	profileID, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("profile_id")))

	query := `SELECT DISTINCT category, subcategory FROM prompt_templates`
	args := make([]any, 0, 2)
	conditions := make([]string, 0, 2)
	if category != "" {
		conditions = append(conditions, "category = ?")
		args = append(args, category)
	}
	if subcategory != "" {
		conditions = append(conditions, "subcategory = ?")
		args = append(args, subcategory)
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY category, subcategory"

	rows, err := db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := make([]resolvedPrompt, 0, 32)
	for rows.Next() {
		var cat string
		var sub string
		if err := rows.Scan(&cat, &sub); err != nil {
			continue
		}
		record, ok := resolvePromptRecord(db, cat, sub, profileID)
		if !ok {
			continue
		}
		items = append(items, promptRowToResolved(record))
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Service) handleResolve(w http.ResponseWriter, r *http.Request) {
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
	if err := ensurePromptTables(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	category := strings.TrimSpace(r.URL.Query().Get("category"))
	subcategory := strings.TrimSpace(r.URL.Query().Get("subcategory"))
	profileID, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("profile_id")))
	if category == "" || subcategory == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category와 subcategory가 필요합니다."})
		return
	}
	record, ok := resolvePromptRecord(db, category, subcategory, profileID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "프롬프트를 찾을 수 없습니다."})
		return
	}
	writeJSON(w, http.StatusOK, promptRowToResolved(record))
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req promptCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	req.Category = strings.TrimSpace(req.Category)
	req.Subcategory = strings.TrimSpace(req.Subcategory)
	req.Name = strings.TrimSpace(req.Name)
	req.Content = strings.TrimSpace(req.Content)
	req.BusinessType = strings.TrimSpace(req.BusinessType)
	if req.Category == "" || req.Subcategory == "" || req.Content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category, subcategory, content는 필수입니다."})
		return
	}
	if req.Name == "" {
		req.Name = req.Category + " " + req.Subcategory
	}

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensurePromptTables(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	variablesJSON := "[]"
	if req.Variables != nil {
		if raw, err := json.Marshal(req.Variables); err == nil && len(raw) > 0 {
			variablesJSON = string(raw)
		}
	}

	var nextVersion int
	if err := db.QueryRow(
		`SELECT COALESCE(MAX(version), 0) + 1 FROM prompt_templates
		 WHERE category=? AND subcategory=? AND profile_id=?`,
		req.Category,
		req.Subcategory,
		req.ProfileID,
	).Scan(&nextVersion); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	res, err := db.Exec(
		`INSERT INTO prompt_templates
		 (category, subcategory, name, content, variables, is_default, profile_id, business_type, version, updated_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now','localtime'))`,
		req.Category,
		req.Subcategory,
		req.Name,
		req.Content,
		variablesJSON,
		req.ProfileID,
		req.BusinessType,
		nextVersion,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"id":      id,
		"version": nextVersion,
	})
}

func (s *Service) handleRestoreDefaults(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req promptRestoreRequest
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
	if err := ensurePromptTables(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	deleted, err := deleteCustomPrompts(db, req.ProfileID, strings.TrimSpace(req.Category), strings.TrimSpace(req.Subcategory))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"deleted": deleted,
	})
}

func (s *Service) handleReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	category := strings.TrimPrefix(r.URL.Path, "/api/prompts/reset/")
	category = strings.TrimSpace(strings.Trim(category, "/"))
	if category == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category가 필요합니다."})
		return
	}
	subcategory := strings.TrimSpace(r.URL.Query().Get("subcategory"))
	profileID, _ := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("profile_id")))

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensurePromptTables(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	deleted, err := deleteCustomPrompts(db, profileID, category, subcategory)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"deleted": deleted,
	})
}

func (s *Service) openDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return nil, err
	}
	return sql.Open("sqlite", s.dbPath)
}

func ensurePromptTables(db *sql.DB) error {
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS prompt_templates (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		category TEXT NOT NULL,
		subcategory TEXT DEFAULT '',
		name TEXT NOT NULL,
		content TEXT NOT NULL,
		variables TEXT DEFAULT '[]',
		is_default INTEGER DEFAULT 1,
		profile_id INTEGER DEFAULT 0,
		business_type TEXT DEFAULT '',
		version INTEGER DEFAULT 1,
		created_at TEXT DEFAULT (datetime('now', 'localtime')),
		updated_at TEXT DEFAULT (datetime('now', 'localtime'))
	)`); err != nil {
		return err
	}
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS prompt_sets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		profile_id INTEGER DEFAULT 0,
		data TEXT NOT NULL DEFAULT '{}',
		created_at TEXT DEFAULT (datetime('now', 'localtime')),
		updated_at TEXT DEFAULT (datetime('now', 'localtime'))
	)`)
	return err
}

func ResolvePromptContent(db *sql.DB, category string, subcategory string, profileID int) string {
	record, ok := resolvePromptRecord(db, category, subcategory, profileID)
	if !ok {
		return ""
	}
	return strings.TrimSpace(record.Content)
}

func resolvePromptRecord(db *sql.DB, category string, subcategory string, profileID int) (promptRow, bool) {
	category = strings.TrimSpace(category)
	subcategory = strings.TrimSpace(subcategory)
	if category == "" || subcategory == "" {
		return promptRow{}, false
	}
	if !tableExists(db, "prompt_templates") {
		return promptRow{}, false
	}

	if profileID > 0 {
		if row, ok := queryPromptRow(
			db,
			`SELECT id, category, subcategory, name, content, variables, is_default, profile_id
			 FROM prompt_templates
			 WHERE category=? AND subcategory=? AND profile_id=?
			 ORDER BY version DESC LIMIT 1`,
			category,
			subcategory,
			profileID,
		); ok {
			return row, true
		}

		if businessType := lookupBusinessType(db, profileID); businessType != "" {
			if row, ok := queryPromptRow(
				db,
				`SELECT id, category, subcategory, name, content, variables, is_default, profile_id
				 FROM prompt_templates
				 WHERE category=? AND subcategory=? AND business_type=? AND profile_id=0
				 ORDER BY is_default ASC, version DESC LIMIT 1`,
				category,
				subcategory,
				businessType,
			); ok {
				return row, true
			}
		}
	}

	if row, ok := queryPromptRow(
		db,
		`SELECT id, category, subcategory, name, content, variables, is_default, profile_id
		 FROM prompt_templates
		 WHERE category=? AND subcategory=? AND profile_id=0 AND is_default=0
		 ORDER BY version DESC LIMIT 1`,
		category,
		subcategory,
	); ok {
		return row, true
	}

	return queryPromptRow(
		db,
		`SELECT id, category, subcategory, name, content, variables, is_default, profile_id
		 FROM prompt_templates
		 WHERE category=? AND subcategory=? AND profile_id=0 AND is_default=1
		 ORDER BY version DESC LIMIT 1`,
		category,
		subcategory,
	)
}

func queryPromptRow(db *sql.DB, query string, args ...any) (promptRow, bool) {
	var row promptRow
	if err := db.QueryRow(query, args...).Scan(
		&row.ID,
		&row.Category,
		&row.Subcategory,
		&row.Name,
		&row.Content,
		&row.Variables,
		&row.IsDefault,
		&row.ProfileID,
	); err != nil {
		return promptRow{}, false
	}
	row.Content = strings.TrimSpace(row.Content)
	return row, true
}

func promptRowToResolved(row promptRow) resolvedPrompt {
	return resolvedPrompt{
		ID:          row.ID,
		Category:    row.Category,
		Subcategory: row.Subcategory,
		Name:        row.Name,
		Content:     row.Content,
		Variables:   parseVariables(row.Variables),
		ProfileID:   row.ProfileID,
		IsCustom:    row.ProfileID > 0 || row.IsDefault == 0,
		Source:      promptSource(row),
	}
}

func promptSource(row promptRow) string {
	if row.ProfileID > 0 {
		return "profile"
	}
	if row.IsDefault == 0 {
		return "global"
	}
	return "default"
}

func parseVariables(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var arr []string
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		return arr
	}
	var generic []any
	if err := json.Unmarshal([]byte(raw), &generic); err != nil {
		return nil
	}
	out := make([]string, 0, len(generic))
	for _, item := range generic {
		text := strings.TrimSpace(stringify(item))
		if text != "" {
			out = append(out, text)
		}
	}
	return out
}

func deleteCustomPrompts(db *sql.DB, profileID int, category string, subcategory string) (int64, error) {
	query := `DELETE FROM prompt_templates WHERE is_default=0 AND profile_id=?`
	args := []any{profileID}
	if category != "" {
		query += ` AND category=?`
		args = append(args, category)
	}
	if subcategory != "" {
		query += ` AND subcategory=?`
		args = append(args, subcategory)
	}
	res, err := db.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func lookupBusinessType(db *sql.DB, profileID int) string {
	if profileID <= 0 || !tableExists(db, "brand_profiles") {
		return ""
	}
	var businessType string
	if err := db.QueryRow(`SELECT business_type FROM brand_profiles WHERE id = ?`, profileID).Scan(&businessType); err != nil {
		return ""
	}
	return strings.TrimSpace(businessType)
}

func tableExists(db *sql.DB, table string) bool {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&count); err != nil {
		return false
	}
	return count > 0
}

func stringify(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(cast))
	}
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
