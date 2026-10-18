package settings

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"makeke/api/internal/config"

	_ "modernc.org/sqlite"
)

type Service struct {
	cfg          config.Config
	settingsPath string
	dbPath       string
}

type keyValueRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

func New(cfg config.Config) *Service {
	projectRoot := strings.TrimSpace(cfg.ProjectRoot)
	if projectRoot == "" {
		projectRoot, _ = os.Getwd()
	}

	settingsPath := filepath.Join(projectRoot, "data", "settings.json")
	dataDir := resolveDataDir(cfg)
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(dataDir, "naver_blog.db")
	}

	return &Service{
		cfg:          cfg,
		settingsPath: settingsPath,
		dbPath:       dbPath,
	}
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/settings", s.handleSettings)
}

func (s *Service) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleGet(w)
	case http.MethodPut:
		s.handlePut(w, r)
	case http.MethodPost:
		s.handlePost(w, r)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) handleGet(w http.ResponseWriter) {
	data, err := s.loadJSONSettings()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func (s *Service) handlePut(w http.ResponseWriter, r *http.Request) {
	var incoming map[string]any
	if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	current, err := s.loadJSONSettings()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	for key, value := range incoming {
		current[key] = value
	}
	if err := s.saveJSONSettings(current); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, current)
}

func (s *Service) handlePost(w http.ResponseWriter, r *http.Request) {
	var req keyValueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	req.Key = strings.TrimSpace(req.Key)
	if req.Key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key is required"})
		return
	}

	if err := s.ensureDBReady(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	value := stringifyValue(req.Value)
	if _, err := db.Exec(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, req.Key, value); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"key":    req.Key,
		"value":  value,
	})
}

func (s *Service) loadJSONSettings() (map[string]any, error) {
	defaults := map[string]any{
		"naver_blog_id":    "",
		"tistory_blog_id":  "",
		"brunch_user_id":   "",
		"velog_username":   "",
		"threads_username": "",
	}

	raw, err := os.ReadFile(s.settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return defaults, nil
		}
		return nil, err
	}

	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, err
	}
	for key, value := range defaults {
		if _, exists := data[key]; !exists {
			data[key] = value
		}
	}
	return data, nil
}

func (s *Service) saveJSONSettings(data map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(s.settingsPath), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.settingsPath, raw, 0o644)
}

func (s *Service) ensureDBReady() error {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return err
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`)
	return err
}

func stringifyValue(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	default:
		return fmt.Sprint(cast)
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
