package blog

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"

	"makeke/api/internal/config"

	_ "modernc.org/sqlite"
)

type Service struct {
	cfg     config.Config
	dataDir string
	dbPath  string
}

func New(cfg config.Config) *Service {
	dataDir := resolveDataDir(cfg)
	dbPath := strings.TrimSpace(os.Getenv("MAKEKE_DB_PATH"))
	if dbPath == "" {
		dbPath = filepath.Join(dataDir, "naver_blog.db")
	}
	return &Service{
		cfg:     cfg,
		dataDir: dataDir,
		dbPath:  dbPath,
	}
}

func (s *Service) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/blog/posts", s.handlePosts)
	mux.HandleFunc("/api/blog/posts/", s.handlePostByID)
	mux.HandleFunc("/api/blog/images-list", s.handleImagesList)
	mux.HandleFunc("/api/blog/images-by-keyword", s.handleImagesByKeyword)
	mux.HandleFunc("/api/blog/images/", s.handleImageFile)
	mux.HandleFunc("/api/blog/generate", s.handleGenerate)
	mux.HandleFunc("/api/blog/generate-image", s.handleGenerateImage)
	mux.HandleFunc("/api/blog/generate-images", s.handleGenerateImages)
	mux.HandleFunc("/api/blog/publish", s.handlePublish)
	mux.HandleFunc("/api/blog/scrape", s.handleScrape)
}

func (s *Service) handlePosts(w http.ResponseWriter, r *http.Request) {
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

	limit := intQuery(r, "limit", 50)
	offset := intQuery(r, "offset", 0)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	sortBy := strings.TrimSpace(r.URL.Query().Get("sort"))
	if sortBy == "" {
		sortBy = "newest"
	}

	orderMap := map[string]string{
		"newest": "id DESC",
		"oldest": "id ASC",
		"name":   "title ASC",
	}
	orderBy := orderMap[sortBy]
	if orderBy == "" {
		orderBy = orderMap["newest"]
	}

	var whereParts []string
	var params []any
	if status != "" {
		whereParts = append(whereParts, "status = ?")
		params = append(params, status)
	}
	if q != "" {
		whereParts = append(whereParts, "title LIKE ?")
		params = append(params, "%"+q+"%")
	}

	whereClause := ""
	if len(whereParts) > 0 {
		whereClause = " WHERE " + strings.Join(whereParts, " AND ")
	}

	var total int
	if err := db.QueryRow("SELECT COUNT(*) FROM posts"+whereClause, params...).Scan(&total); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	query := "SELECT * FROM posts" + whereClause + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?"
	rows, err := db.Query(query, append(params, limit, offset)...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	posts, err := rowsToMaps(rows)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"posts":  posts,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (s *Service) handlePostByID(w http.ResponseWriter, r *http.Request) {
	postID, ok := parseID(r.URL.Path, "/api/blog/posts/")
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	switch r.Method {
	case http.MethodGet:
		s.getPost(w, db, postID)
	case http.MethodPut:
		s.updatePost(w, r, db, postID)
	case http.MethodDelete:
		s.deletePost(w, db, postID)
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Service) getPost(w http.ResponseWriter, db *sql.DB, postID int) {
	row, err := querySingleMap(db, "SELECT * FROM posts WHERE id = ?", postID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "게시물을 찾을 수 없습니다."})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"post":   row,
	})
}

func (s *Service) updatePost(w http.ResponseWriter, r *http.Request, db *sql.DB, postID int) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	if _, hasTags := req["tags"]; hasTags {
		if _, hasTitle := req["title"]; !hasTitle {
			tags := stringify(req["tags"])
			if _, err := db.Exec("UPDATE posts SET tags = ? WHERE id = ?", tags, postID); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"status":  "ok",
				"message": "태그 업데이트 완료",
			})
			return
		}
	}

	title := strings.TrimSpace(stringify(req["title"]))
	content := strings.TrimSpace(stringify(req["content"]))
	if title == "" || content == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "제목과 본문을 입력하세요."})
		return
	}
	tags := stringify(req["tags"])

	if _, err := db.Exec(
		"UPDATE posts SET title = ?, content = ?, char_count = ?, tags = ? WHERE id = ?",
		title, content, len(content), tags, postID,
	); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"message": "게시물 수정 완료",
	})
}

func (s *Service) deletePost(w http.ResponseWriter, db *sql.DB, postID int) {
	if _, err := db.Exec("DELETE FROM posts WHERE id = ?", postID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"message": "게시물 삭제 완료",
	})
}

func (s *Service) handleImagesList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	dir := strings.TrimSpace(r.URL.Query().Get("dir"))
	if dir == "" {
		writeJSON(w, http.StatusOK, map[string]any{"images": []any{}})
		return
	}

	targetDir := filepath.Clean(dir)
	if !filepath.IsAbs(targetDir) {
		targetDir = filepath.Join(s.dataDir, "output", "blog_images", filepath.Base(targetDir))
	}

	images := collectImages(targetDir, filepath.Base(targetDir))
	writeJSON(w, http.StatusOK, map[string]any{"images": images})
}

func (s *Service) handleImagesByKeyword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	root := filepath.Join(s.dataDir, "output", "blog_images")
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]any{"images": []any{}})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	safeKeyword := regexp.MustCompile(`[^\w가-힣]`).ReplaceAllString(keyword, "")
	if len(safeKeyword) > 20 {
		safeKeyword = safeKeyword[:20]
	}

	type dirInfo struct {
		name    string
		modTime int64
	}
	var dirs []dirInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		dirs = append(dirs, dirInfo{name: entry.Name(), modTime: info.ModTime().UnixNano()})
	}
	sort.Slice(dirs, func(i, j int) bool { return dirs[i].modTime > dirs[j].modTime })

	images := make([]map[string]any, 0)
	for _, dir := range dirs {
		if safeKeyword != "" && !strings.Contains(dir.name, safeKeyword) {
			continue
		}
		images = collectImages(filepath.Join(root, dir.name), dir.name)
		if len(images) > 0 {
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"images": images})
}

func (s *Service) handleImageFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	raw := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/blog/images/"), "/")
	parts := strings.Split(raw, "/")
	if len(parts) != 2 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	target := filepath.Join(s.dataDir, "output", "blog_images", parts[0], parts[1])
	if _, err := os.Stat(target); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	http.ServeFile(w, r, target)
}

func (s *Service) handleGenerate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusGone, map[string]string{"error": "legacy blog generate endpoint removed", "detail": "Go 네이티브 콘텐츠 생성 API를 사용하세요."})
}

func (s *Service) handleGenerateImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req blogImageBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	result, err := s.generateBlogImages(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handlePublish(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusGone, map[string]string{"error": "legacy blog publish endpoint removed", "detail": "레거시 발행 경로는 제거되었습니다."})
}

func (s *Service) handleScrape(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusGone, map[string]string{"error": "legacy blog scrape endpoint removed", "detail": "Go 네이티브 수집 API를 사용하세요."})
}

func collectImages(targetDir, dirName string) []map[string]any {
	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return []map[string]any{}
	}
	images := make([]map[string]any, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp":
			images = append(images, map[string]any{
				"filename": entry.Name(),
				"url":      "/api/blog/images/" + dirName + "/" + entry.Name(),
			})
		}
	}
	return images
}

func (s *Service) openDB() (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(s.dbPath), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return nil, err
	}
	if err := ensurePostsTable(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func ensurePostsTable(db *sql.DB) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			keyword TEXT NOT NULL,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			char_count INTEGER DEFAULT 0,
			keyword_density REAL DEFAULT 0,
			status TEXT DEFAULT 'draft',
			published_at TEXT,
			created_at TEXT DEFAULT (datetime('now', 'localtime')),
			trend_score INTEGER DEFAULT 0,
			source_count INTEGER DEFAULT 0,
			model_used TEXT DEFAULT '',
			content_hash TEXT DEFAULT ''
		)
	`); err != nil {
		return err
	}

	rows, err := db.Query(`PRAGMA table_info('posts')`)
	if err != nil {
		return err
	}
	defer rows.Close()

	hasTags := false
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == "tags" {
			hasTags = true
			break
		}
	}
	if !hasTags {
		if _, err := db.Exec(`ALTER TABLE posts ADD COLUMN tags TEXT DEFAULT ''`); err != nil && !strings.Contains(strings.ToLower(err.Error()), "duplicate column") {
			return err
		}
	}
	return nil
}

func rowsToMaps(rows *sql.Rows) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result []map[string]any
	for rows.Next() {
		values := make([]any, len(columns))
		scanTargets := make([]any, len(columns))
		for i := range values {
			scanTargets[i] = &values[i]
		}
		if err := rows.Scan(scanTargets...); err != nil {
			return nil, err
		}

		item := make(map[string]any, len(columns))
		for i, column := range columns {
			item[column] = normalizeSQLValue(values[i])
		}
		result = append(result, item)
	}
	return result, rows.Err()
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
	switch cast := value.(type) {
	case []byte:
		return string(cast)
	default:
		return cast
	}
}

func stringify(value any) string {
	switch cast := value.(type) {
	case string:
		return cast
	case nil:
		return ""
	case float64:
		return strconv.FormatFloat(cast, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(cast), 'f', -1, 32)
	case int:
		return strconv.Itoa(cast)
	case int64:
		return strconv.FormatInt(cast, 10)
	case int32:
		return strconv.FormatInt(int64(cast), 10)
	case bool:
		if cast {
			return "true"
		}
		return "false"
	default:
		raw, err := json.Marshal(cast)
		if err != nil {
			return ""
		}
		return string(raw)
	}
}

func intQuery(r *http.Request, key string, fallback int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
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
