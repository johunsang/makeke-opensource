package presets

import (
	"database/sql"
	"encoding/json"
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

type presetRequest struct {
	Name       string `json:"name"`
	PresetData any    `json:"preset_data"`
	IsDefault  bool   `json:"is_default"`
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
	mux.HandleFunc("/api/content-presets", s.handleCollection)
	mux.HandleFunc("/api/content-presets/", s.handleItem)
}

func (s *Service) handleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.list(w)
	case http.MethodPost:
		s.create(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleItem(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(r.URL.Path, "/api/content-presets/")
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	switch r.Method {
	case http.MethodPut:
		s.update(w, r, id)
	case http.MethodDelete:
		s.delete(w, id)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) list(w http.ResponseWriter) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	rows, err := db.Query("SELECT * FROM content_presets ORDER BY is_default DESC, updated_at DESC")
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
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"presets": items,
	})
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	var req presetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "프리셋 이름을 입력하세요."})
		return
	}
	presetData, err := json.Marshal(req.PresetData)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid preset_data"})
		return
	}

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if req.IsDefault {
		if _, err := tx.Exec("UPDATE content_presets SET is_default = 0"); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	res, err := tx.Exec(
		"INSERT INTO content_presets (name, preset_data, is_default) VALUES (?, ?, ?)",
		name, string(presetData), boolToInt(req.IsDefault),
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"id":     id,
	})
}

func (s *Service) update(w http.ResponseWriter, r *http.Request, id int) {
	var req presetRequest
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

	existing, err := querySingleMap(db, "SELECT * FROM content_presets WHERE id = ?", id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "프리셋을 찾을 수 없습니다."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = stringify(existing["name"])
	}

	presetData := stringify(existing["preset_data"])
	if req.PresetData != nil {
		raw, err := json.Marshal(req.PresetData)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid preset_data"})
			return
		}
		presetData = string(raw)
	}

	tx, err := db.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if req.IsDefault {
		if _, err := tx.Exec("UPDATE content_presets SET is_default = 0"); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	if _, err := tx.Exec(
		"UPDATE content_presets SET name=?, preset_data=?, is_default=?, updated_at=datetime('now','localtime') WHERE id=?",
		name, presetData, boolToInt(req.IsDefault), id,
	); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Service) delete(w http.ResponseWriter, id int) {
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	if _, err := db.Exec("DELETE FROM content_presets WHERE id = ?", id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Service) openDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return nil, err
	}
	if err := ensureContentPresetsTable(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func ensureContentPresetsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS content_presets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			preset_data TEXT DEFAULT '{}',
			is_default INTEGER DEFAULT 0,
			created_at TEXT DEFAULT (datetime('now', 'localtime')),
			updated_at TEXT DEFAULT (datetime('now', 'localtime'))
		)
	`)
	return err
}

func rowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	var items []map[string]any
	for rows.Next() {
		values := make([]any, len(columns))
		targets := make([]any, len(columns))
		for i := range values {
			targets[i] = &values[i]
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, err
		}
		item := map[string]any{}
		for i, column := range columns {
			item[column] = normalizeSQLValue(values[i])
		}
		items = append(items, item)
	}
	return items, rows.Err()
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

func normalizeSQLValue(value any) any {
	if cast, ok := value.([]byte); ok {
		return string(cast)
	}
	return value
}

func stringify(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	default:
		raw, err := json.Marshal(cast)
		if err != nil {
			return ""
		}
		return string(raw)
	}
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func parseID(pathValue, prefix string) (int, bool) {
	raw := strings.Trim(strings.TrimPrefix(pathValue, prefix), "/")
	if raw == "" || strings.Contains(raw, "/") {
		return 0, false
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false
	}
	return value, true
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
