package appcore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

func (s *Service) handleBlogAgentHistory(w http.ResponseWriter, r *http.Request) {
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
	if !tableExists(db, "posts") {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": []map[string]any{}})
		return
	}
	withProfile := tableExists(db, "projects") && tableExists(db, "brand_profiles")
	query := `SELECT id, keyword, title, content, char_count, status, created_at, tags FROM posts ORDER BY created_at DESC, id DESC LIMIT 500`
	if withProfile {
		query = `SELECT po.id, po.keyword, po.title, po.content, po.char_count, po.status, po.created_at, po.tags,
			COALESCE(p.profile_id, 0), COALESCE(bp.name, ''), COALESCE(bp.logo_path, '')
			FROM posts po
			LEFT JOIN projects p ON p.blog_id = po.id
			LEFT JOIN brand_profiles bp ON bp.id = p.profile_id
			ORDER BY po.created_at DESC, po.id DESC LIMIT 500`
	}
	rows, err := db.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int
		var keyword, title, body, status, created, tags sql.NullString
		var charCount sql.NullInt64
		var profileID sql.NullInt64
		var profileName, profileLogo sql.NullString
		if withProfile {
			if err := rows.Scan(&id, &keyword, &title, &body, &charCount, &status, &created, &tags, &profileID, &profileName, &profileLogo); err != nil {
				continue
			}
		} else {
			if err := rows.Scan(&id, &keyword, &title, &body, &charCount, &status, &created, &tags); err != nil {
				continue
			}
		}
		content := body.String
		item := map[string]any{
			"id":         id,
			"folder":     "post:" + strconv.Itoa(id),
			"keyword":    keyword.String,
			"title":      title.String,
			"body":       content,
			"char_count": fallbackInt64(charCount, int64(len([]rune(content)))),
			"status":     status.String,
			"created":    created.String,
			"created_at": created.String,
			"tags":       tags.String,
			"images":     []string{},
		}
		attachHistoryProfile(item, profileID.Int64, profileName.String, profileLogo.String)
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Service) handleBlogAgentSaveEdit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Folder string `json:"folder"`
		Title  string `json:"title"`
		Body   string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	id := historyIDFromFolder(req.Folder)
	if id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid history item"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if _, err := db.Exec(`UPDATE posts SET title = ?, content = ?, char_count = ? WHERE id = ?`, strings.TrimSpace(req.Title), strings.TrimSpace(req.Body), len([]rune(req.Body)), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleBlogAgentHistoryDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	id, err := decodeHistoryDeleteID(r)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid history item"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	_, _ = db.Exec(`DELETE FROM posts WHERE id = ?`, id)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleCardnewsHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	items := s.cardnewsHistoryFromDB()
	items = append(items, s.cardnewsHistoryFromFolders(items)...)
	sort.SliceStable(items, func(i, j int) bool {
		return stringify(items[i]["created"]) > stringify(items[j]["created"])
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Service) cardnewsHistoryFromDB() []map[string]any {
	db, err := s.openDB()
	if err != nil {
		return nil
	}
	defer db.Close()
	if !tableExists(db, "cardnews") {
		return nil
	}
	if err := ensureTextColumn(db, "cardnews", "source", "'keyword'"); err != nil {
		return nil
	}
	withProfile := tableExists(db, "projects") && tableExists(db, "brand_profiles")
	query := `SELECT id, topic, style, aspect_ratio, slide_count, project_dir, created_at, COALESCE(source, '') FROM cardnews ORDER BY created_at DESC, id DESC LIMIT 500`
	if withProfile {
		query = `SELECT c.id, c.topic, c.style, c.aspect_ratio, c.slide_count, c.project_dir, c.created_at, COALESCE(c.source, ''),
			COALESCE(p.profile_id, 0), COALESCE(bp.name, ''), COALESCE(bp.logo_path, '')
			FROM cardnews c
			LEFT JOIN projects p ON p.cardnews_id = c.id
			LEFT JOIN brand_profiles bp ON bp.id = p.profile_id
			ORDER BY c.created_at DESC, c.id DESC LIMIT 500`
	}
	rows, err := db.Query(query)
	if err != nil {
		return nil
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int
		var topic, style, aspect, dir, created, source sql.NullString
		var slides sql.NullInt64
		var profileID sql.NullInt64
		var profileName, profileLogo sql.NullString
		if withProfile {
			if err := rows.Scan(&id, &topic, &style, &aspect, &slides, &dir, &created, &source, &profileID, &profileName, &profileLogo); err != nil {
				continue
			}
		} else {
			if err := rows.Scan(&id, &topic, &style, &aspect, &slides, &dir, &created, &source); err != nil {
				continue
			}
		}
		projectDir := strings.TrimSpace(dir.String)
		images, videos := listHistoryMedia(projectDir)
		sourceValue := inferCardnewsHistorySource(source.String, topic.String, projectDir)
		item := map[string]any{
			"id":          id,
			"folder":      projectDir,
			"project_dir": projectDir,
			"topic":       topic.String,
			"style":       style.String,
			"aspect":      aspect.String,
			"slides":      fallbackInt64(slides, int64(len(images))),
			"images":      images,
			"videos":      videos,
			"created":     created.String,
			"created_at":  created.String,
			"source":      sourceValue,
			"industry":    sourceValue,
		}
		attachHistoryProfile(item, profileID.Int64, profileName.String, profileLogo.String)
		items = append(items, item)
	}
	return items
}

func (s *Service) cardnewsHistoryFromFolders(existing []map[string]any) []map[string]any {
	seen := map[string]bool{}
	for _, item := range existing {
		if folder := stringify(item["folder"]); folder != "" {
			if abs, err := filepath.Abs(folder); err == nil {
				seen[abs] = true
			}
		}
	}
	roots := []string{
		filepath.Join(s.dataDir, "output", "cardnews_agent"),
		filepath.Join(s.dataDir, "output", "cardnews"),
	}
	items := []map[string]any{}
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			dir := filepath.Join(root, entry.Name())
			abs, _ := filepath.Abs(dir)
			if seen[abs] {
				continue
			}
			images, videos := listHistoryMedia(dir)
			if len(images) == 0 && len(videos) == 0 {
				continue
			}
			items = append(items, map[string]any{
				"folder":      dir,
				"project_dir": dir,
				"topic":       humanizeHistoryName(entry.Name()),
				"slides":      len(images),
				"images":      images,
				"videos":      videos,
				"created":     historyModTime(dir),
				"source":      inferCardnewsHistorySource("", entry.Name(), dir),
				"industry":    inferCardnewsHistorySource("", entry.Name(), dir),
			})
		}
	}
	return items
}

func inferCardnewsHistorySource(rawSource, topic, projectDir string) string {
	source := strings.TrimSpace(rawSource)
	if looksLikeDetailpageHistory(topic, projectDir) {
		return "detailpage"
	}
	if source == "" {
		return "keyword"
	}
	return source
}

func looksLikeDetailpageHistory(topic, projectDir string) bool {
	value := strings.ToLower(strings.Join([]string{topic, projectDir, filepath.Base(projectDir)}, " "))
	return strings.Contains(value, "detailpage") || strings.Contains(value, "상세페이지")
}

func (s *Service) handleHistoryMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	target := strings.TrimSpace(r.URL.Query().Get("path"))
	if target == "" {
		folder := strings.TrimSpace(r.URL.Query().Get("folder"))
		name := filepath.Base(strings.TrimSpace(r.URL.Query().Get("name")))
		if folder != "" && name != "" && name != "." {
			target = filepath.Join(folder, name)
		}
	}
	if target == "" || !s.isAllowedHistoryPath(target) || !fileExists(target) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
		return
	}
	http.ServeFile(w, r, target)
}

func (s *Service) handleCardnewsHistoryDelete(w http.ResponseWriter, r *http.Request) {
	s.deleteHistoryFolder(w, r)
}

func (s *Service) handleCardnewsHistoryDeleteImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Folder string `json:"folder"`
		Name   string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	target := filepath.Join(req.Folder, filepath.Base(req.Name))
	if target == "" || !s.isAllowedHistoryPath(target) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
		return
	}
	_ = os.Remove(target)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleSNSAgentHistory(w http.ResponseWriter, r *http.Request) {
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
	if !tableExists(db, "projects") {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": []map[string]any{}})
		return
	}
	withProfile := tableExists(db, "brand_profiles")
	query := `SELECT id, name, threads_text, twitter_text, ig_caption, updated_at, created_at FROM projects WHERE COALESCE(threads_text, '') != '' OR COALESCE(twitter_text, '') != '' OR COALESCE(ig_caption, '') != '' ORDER BY updated_at DESC, id DESC LIMIT 500`
	if withProfile {
		query = `SELECT p.id, p.name, p.threads_text, p.twitter_text, p.ig_caption, p.updated_at, p.created_at,
			COALESCE(p.profile_id, 0), COALESCE(bp.name, ''), COALESCE(bp.logo_path, '')
			FROM projects p
			LEFT JOIN brand_profiles bp ON bp.id = p.profile_id
			WHERE COALESCE(p.threads_text, '') != '' OR COALESCE(p.twitter_text, '') != '' OR COALESCE(p.ig_caption, '') != ''
			ORDER BY p.updated_at DESC, p.id DESC LIMIT 500`
	}
	rows, err := db.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int
		var name, threadsText, twitterText, igCaption, updated, created sql.NullString
		var profileID sql.NullInt64
		var profileName, profileLogo sql.NullString
		if withProfile {
			if err := rows.Scan(&id, &name, &threadsText, &twitterText, &igCaption, &updated, &created, &profileID, &profileName, &profileLogo); err != nil {
				continue
			}
		} else {
			if err := rows.Scan(&id, &name, &threadsText, &twitterText, &igCaption, &updated, &created); err != nil {
				continue
			}
		}
		item := map[string]any{
			"id":           id,
			"folder":       "project:" + strconv.Itoa(id),
			"topic":        name.String,
			"threads_text": threadsText.String,
			"twitter_text": twitterText.String,
			"ig_caption":   igCaption.String,
			"created":      firstNonEmptyString(updated.String, created.String),
			"created_at":   created.String,
		}
		attachHistoryProfile(item, profileID.Int64, profileName.String, profileLogo.String)
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Service) handleSNSAgentSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Topic       string `json:"topic"`
		ThreadsText string `json:"threads_text"`
		TwitterText string `json:"twitter_text"`
		IGCaption   string `json:"ig_caption"`
		Industry    string `json:"industry"`
		ProfileID   int    `json:"profile_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	topic := strings.TrimSpace(req.Topic)
	if topic == "" {
		topic = "SNS 글"
	}
	threadsText := strings.TrimSpace(req.ThreadsText)
	twitterText := strings.TrimSpace(req.TwitterText)
	igCaption := strings.TrimSpace(req.IGCaption)
	if threadsText == "" && twitterText == "" && igCaption == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "저장할 SNS 글이 없습니다."})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	if err := ensureProjectsTable(db); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	result, err := db.Exec(`INSERT INTO projects (
		name, keyword, description, profile_id, threads_text, twitter_text, ig_caption, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
		topic,
		topic,
		strings.TrimSpace(req.Industry),
		nullableInt(req.ProfileID),
		threadsText,
		twitterText,
		igCaption,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"status": "ok",
		"id":     id,
		"folder": "project:" + strconv.FormatInt(id, 10),
	})
}

func attachHistoryProfile(item map[string]any, profileID int64, profileName string, logoPath string) {
	if item == nil || profileID <= 0 {
		return
	}
	item["profile_id"] = profileID
	item["bp_id"] = profileID
	if strings.TrimSpace(profileName) != "" {
		item["profile_name"] = strings.TrimSpace(profileName)
	}
	if strings.TrimSpace(logoPath) != "" {
		cleanLogo := strings.TrimSpace(logoPath)
		item["profile_logo"] = cleanLogo
		item["profile_logo_url"] = fmt.Sprintf("/api/library/image/%d/%s", profileID, url.PathEscape(cleanLogo))
		return
	}
	item["profile_logo_url"] = fmt.Sprintf("/api/library/profiles/%d/logo", profileID)
}

func (s *Service) handleSNSAgentSaveEdit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Folder      string `json:"folder"`
		ThreadsText string `json:"threads_text"`
		TwitterText string `json:"twitter_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	id := historyIDFromFolder(req.Folder)
	if id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid history item"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	_, err = db.Exec(`UPDATE projects SET threads_text = ?, twitter_text = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`, strings.TrimSpace(req.ThreadsText), strings.TrimSpace(req.TwitterText), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleSNSAgentHistoryDelete(w http.ResponseWriter, r *http.Request) {
	id, err := decodeHistoryDeleteID(r)
	if err != nil || id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid history item"})
		return
	}
	db, err := s.openDB()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()
	_, _ = db.Exec(`UPDATE projects SET threads_text = '', twitter_text = '', ig_caption = '', updated_at = datetime('now', 'localtime') WHERE id = ?`, id)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Service) handleVideoAgentHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	items := []map[string]any{}
	for _, root := range []string{
		filepath.Join(s.dataDir, "output", "video_agent"),
		filepath.Join(s.dataDir, "output", "videos"),
		filepath.Join(s.dataDir, "hyperframes", "studio"),
		filepath.Join(s.dataDir, "hyperframes", "outputs"),
	} {
		items = append(items, s.videoHistoryFromRoot(root)...)
	}
	sort.SliceStable(items, func(i, j int) bool {
		return stringify(items[i]["created"]) > stringify(items[j]["created"])
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "items": items})
}

func (s *Service) videoHistoryFromRoot(root string) []map[string]any {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	items := []map[string]any{}
	for _, entry := range entries {
		if !entry.IsDir() {
			if item := videoHistoryFileItem(root, entry); item != nil {
				items = append(items, item)
			}
			continue
		}
		dir := filepath.Join(root, entry.Name())
		images, videos := listHistoryMedia(dir)
		videoPath := ""
		if len(videos) > 0 {
			videoPath = videos[0]
		}
		if videoPath == "" && len(images) == 0 {
			continue
		}
		items = append(items, map[string]any{
			"folder":      dir,
			"project_dir": dir,
			"topic":       humanizeHistoryName(entry.Name()),
			"scene_count": len(images),
			"images":      images,
			"videos":      videos,
			"video_path":  videoPath,
			"created":     historyModTime(dir),
		})
	}
	return items
}

func videoHistoryFileItem(root string, entry os.DirEntry) map[string]any {
	name := entry.Name()
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".mp4" && ext != ".mov" && ext != ".webm" {
		return nil
	}
	videoPath := filepath.Join(root, name)
	return map[string]any{
		"folder":      videoPath,
		"project_dir": root,
		"topic":       humanizeHistoryName(strings.TrimSuffix(name, ext)),
		"scene_count": 0,
		"images":      []string{},
		"videos":      []string{videoPath},
		"video_path":  videoPath,
		"created":     historyModTime(videoPath),
	}
}

func (s *Service) handleVideoAgentHistoryDelete(w http.ResponseWriter, r *http.Request) {
	s.deleteHistoryFolder(w, r)
}

func (s *Service) deleteHistoryFolder(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req struct {
		Folder string `json:"folder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if !s.isAllowedHistoryPath(req.Folder) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid path"})
		return
	}
	_ = os.RemoveAll(req.Folder)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func listHistoryMedia(dir string) ([]string, []string) {
	if strings.TrimSpace(dir) == "" {
		return []string{}, []string{}
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []string{}, []string{}
	}
	images := []string{}
	videos := []string{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp", ".gif":
			images = append(images, name)
		case ".mp4", ".mov", ".webm":
			videos = append(videos, filepath.Join(dir, name))
		}
	}
	sort.Strings(images)
	sort.Strings(videos)
	return images, videos
}

func (s *Service) isAllowedHistoryPath(path string) bool {
	if strings.TrimSpace(path) == "" {
		return false
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	roots := []string{
		s.dataDir,
		filepath.Join(s.cfg.ProjectRoot, "generated"),
		filepath.Join(s.cfg.ProjectRoot, "static"),
	}
	for _, root := range roots {
		rootAbs, err := filepath.Abs(root)
		if err != nil {
			continue
		}
		if abs == rootAbs || strings.HasPrefix(abs, rootAbs+string(os.PathSeparator)) {
			return true
		}
	}
	return false
}

func decodeHistoryDeleteID(r *http.Request) (int, error) {
	var req struct {
		Folder string `json:"folder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return 0, err
	}
	return historyIDFromFolder(req.Folder), nil
}

func historyIDFromFolder(folder string) int {
	parts := strings.Split(strings.TrimSpace(folder), ":")
	if len(parts) == 2 && (parts[0] == "post" || parts[0] == "project") {
		id, _ := strconv.Atoi(parts[1])
		return id
	}
	id, _ := strconv.Atoi(strings.TrimSpace(folder))
	return id
}

func fallbackInt64(value sql.NullInt64, fallback int64) int64 {
	if value.Valid {
		return value.Int64
	}
	return fallback
}

func historyModTime(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return info.ModTime().Format("2006-01-02 15:04:05")
}

func humanizeHistoryName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.TrimPrefix(name, "cn_")
	name = strings.TrimPrefix(name, "vag-")
	name = strings.ReplaceAll(name, "_", " ")
	name = strings.ReplaceAll(name, "-", " ")
	return strings.TrimSpace(name)
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
