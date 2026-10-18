package analysis

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"makeke/api/internal/codexlog"
	"makeke/api/internal/config"

	_ "modernc.org/sqlite"
)

type Service struct {
	cfg          config.Config
	dbPath       string
	trendCacheMu sync.Mutex
	trendCacheAt time.Time
	trendCache   map[string]any
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
	mux.HandleFunc("/api/trend/analyze", s.handleTrendAnalyze)
	mux.HandleFunc("/api/sources/collect", s.handleSourcesCollect)
	mux.HandleFunc("/api/stats", s.handleStats)
	mux.HandleFunc("/api/trends/dashboard", s.handleTrendsDashboard)
	mux.HandleFunc("/api/trends/ai-analyze", s.handleTrendsAIAnalyze)
	mux.HandleFunc("/api/trends/keyword-relevance", s.handleKeywordRelevance)
	mux.HandleFunc("/api/trends/sort-by-profile", s.handleSortByProfile)
	mux.HandleFunc("/api/trends/select-news-for-profile", s.handleSelectNewsForProfile)
	mux.HandleFunc("/api/naver/extract-search-keyword", s.handleNaverExtractSearchKeyword)
	mux.HandleFunc("/api/naver/search-volume", s.handleNaverSearchVolume)
	mux.HandleFunc("/api/naver/blog-competition", s.handleNaverBlogCompetition)
}

func (s *Service) handleTrendAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	keyword := strings.TrimSpace(stringify(req["keyword"]))
	if keyword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "keyword 가 필요합니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data": map[string]any{
			"keyword":          keyword,
			"related_keywords": []string{},
			"summary":          "Go 네이티브 트렌드 확장 분석은 아직 준비 중입니다.",
			"go_only":          true,
		},
	})
}

func (s *Service) handleSourcesCollect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	keyword := strings.TrimSpace(stringify(req["keyword"]))
	if keyword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "keyword 가 필요합니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data": map[string]any{
			"keyword": keyword,
			"sources": []map[string]any{},
			"message": "Go 네이티브 소스 수집은 아직 준비 중입니다.",
			"go_only": true,
		},
	})
}

func (s *Service) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer db.Close()

	total := countOrZero(db, "SELECT COUNT(*) FROM posts")
	published := countOrZero(db, "SELECT COUNT(*) FROM posts WHERE status='published'")
	drafts := countOrZero(db, "SELECT COUNT(*) FROM posts WHERE status='draft'")
	today := countOrZero(db, "SELECT COUNT(*) FROM posts WHERE date(created_at) = date('now', 'localtime')")
	schedules := countOrZero(db, "SELECT COUNT(*) FROM schedules WHERE enabled=1")

	writeJSON(w, http.StatusOK, map[string]any{
		"total_posts":      total,
		"published":        published,
		"drafts":           drafts,
		"today_posts":      today,
		"active_schedules": schedules,
	})
}

func (s *Service) handleTrendsDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	forceRefresh, _ := strconv.ParseBool(strings.TrimSpace(r.URL.Query().Get("refresh")))

	s.trendCacheMu.Lock()
	useCache := !forceRefresh && s.trendCache != nil && time.Since(s.trendCacheAt) < 5*time.Minute
	cached := s.trendCache
	s.trendCacheMu.Unlock()

	if useCache {
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"data":   cached,
		})
		return
	}

	result := buildGoNativeTrendDashboard()
	s.trendCacheMu.Lock()
	s.trendCache = result
	s.trendCacheAt = time.Now()
	s.trendCacheMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data":   result,
	})
}

func (s *Service) handleTrendsAIAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	prompt := "트렌드/키워드 분석 전문가처럼 아래 데이터를 분석하세요. JSON 객체만 출력하세요. 필수 키: summary(string), core_issues(array of objects with title, summary, category), recommended_keywords(array of objects with keyword, reason, difficulty, potential), content_angles(array of strings), seasonal_opportunities(array of strings), content_tips(string). 입력된 trends/news/global_trends를 반드시 반영하세요.\n\n" + stringify(req)
	logRunID := codexlog.Reset("AI 트렌드 분석")
	codexlog.AppendFor(logRunID, "trend analysis requested")
	if parsed, err := s.runCodexJSONObject(prompt, 25*time.Second, logRunID); err == nil {
		parsed["status"] = "ok"
		parsed["provider"] = "codex"
		codexlog.AppendFor(logRunID, "trend analysis completed")
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "data": parsed, "provider": "codex"})
		return
	}
	codexlog.AppendFor(logRunID, "trend analysis fallback returned")
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data": map[string]any{
			"summary": "Codex 분석을 사용할 수 없어 Go 기본 분석 결과를 제공합니다.",
			"core_issues": []map[string]any{
				{"title": "AI 분석 지연", "summary": "Codex 응답이 지연되어 현재 수집된 트렌드 기준으로 먼저 보여줍니다.", "category": "system"},
			},
			"recommended_keywords":   buildFallbackTrendKeywords(req),
			"content_angles":         []string{"트렌드 배경 설명형", "체크리스트형", "비교 분석형"},
			"seasonal_opportunities": []string{"오늘 급상승 키워드를 활용한 빠른 이슈 콘텐츠"},
			"content_tips":           "수집된 급상승 키워드 중 브랜드와 가까운 키워드를 골라 빠르게 콘텐츠화하세요.",
			"provider":               "go_fallback",
		},
	})
}

func (s *Service) handleKeywordRelevance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	prompt := "마케팅 키워드 관련도 평가 전문가처럼 1~10점 점수를 매기세요. JSON 객체만 출력하세요. 형식: {\"scores\":{\"키워드\":점수},\"reasons\":{\"키워드\":\"이유\"}}.\n\n" + stringify(req)
	logRunID := codexlog.Reset("키워드 관련도 분석")
	codexlog.AppendFor(logRunID, "keyword relevance requested")
	if parsed, err := s.runCodexJSONObject(prompt, 25*time.Second, logRunID); err == nil {
		codexlog.AppendFor(logRunID, "keyword relevance completed")
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   "ok",
			"scores":   parsed["scores"],
			"reasons":  parsed["reasons"],
			"provider": "codex",
		})
		return
	}
	codexlog.AppendFor(logRunID, "keyword relevance fallback returned")
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"scores":   map[string]int{},
		"provider": "go_fallback",
	})
}

func buildFallbackTrendKeywords(req map[string]any) []map[string]any {
	trends := toMapSlice(req["trends"])
	keywords := make([]map[string]any, 0, 8)
	for _, trend := range trends {
		keyword := strings.TrimSpace(stringify(trend["keyword"]))
		if keyword == "" {
			continue
		}
		keywords = append(keywords, map[string]any{
			"keyword":    keyword,
			"reason":     "현재 급상승 목록에 포함된 키워드입니다.",
			"difficulty": "중",
			"potential":  "트렌드성",
		})
		if len(keywords) >= 8 {
			break
		}
	}
	if len(keywords) == 0 {
		keywords = append(keywords, map[string]any{
			"keyword":    "오늘의 트렌드",
			"reason":     "수집된 키워드가 없을 때 사용할 수 있는 기본 주제입니다.",
			"difficulty": "중",
			"potential":  "범용",
		})
	}
	return keywords
}

func limitTrendNewsForCodex(news map[string]any, perCategoryLimit, totalLimit int) map[string]any {
	if perCategoryLimit <= 0 {
		perCategoryLimit = 6
	}
	if totalLimit <= 0 {
		totalLimit = 30
	}
	limited := map[string]any{}
	total := 0
	keys := make([]string, 0, len(news))
	for key := range news {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if total >= totalLimit {
			break
		}
		group := toMap(news[key])
		items := toMapSlice(group["news"])
		if len(items) == 0 {
			continue
		}
		remaining := totalLimit - total
		take := perCategoryLimit
		if remaining < take {
			take = remaining
		}
		if len(items) > take {
			items = items[:take]
		}
		trimmed := make([]map[string]any, 0, len(items))
		for _, item := range items {
			trimmed = append(trimmed, compactTrendNewsItem(item))
		}
		nextGroup := withFields(group, map[string]any{"news": trimmed})
		limited[key] = nextGroup
		total += len(trimmed)
	}
	return limited
}

func compactTrendNewsItem(item map[string]any) map[string]any {
	return map[string]any{
		"title":            stringify(item["title"]),
		"source":           stringify(item["source"]),
		"url":              firstNonEmpty(stringify(item["url"]), stringify(item["link"])),
		"snippet":          truncate(stringify(item["snippet"]), 180),
		"category":         stringify(item["category"]),
		"relevance_score":  toInt(item["relevance_score"]),
		"relevance_reason": stringify(item["relevance_reason"]),
	}
}

func countTrendNews(news map[string]any) int {
	total := 0
	for _, value := range news {
		total += len(toMapSlice(toMap(value)["news"]))
	}
	return total
}

func normalizeTrendNewsGroup(value any) map[string]any {
	group := toMap(value)
	if len(group) > 0 {
		if len(toMapSlice(group["news"])) > 0 {
			return group
		}
		if looksLikeTrendNewsItem(group) {
			return map[string]any{"news": []map[string]any{group}}
		}
		return group
	}
	items := toMapSlice(value)
	if len(items) > 0 {
		return map[string]any{"news": items}
	}
	return map[string]any{}
}

func looksLikeTrendNewsItem(item map[string]any) bool {
	return strings.TrimSpace(stringify(item["title"])) != "" ||
		strings.TrimSpace(stringify(item["url"])) != "" ||
		strings.TrimSpace(stringify(item["link"])) != ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		cleaned := strings.TrimSpace(value)
		if cleaned != "" {
			return cleaned
		}
	}
	return ""
}

func (s *Service) handleNaverExtractSearchKeyword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	text := strings.TrimSpace(r.URL.Query().Get("text"))
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"keyword":  cleanNaverSearchKeyword(text),
		"provider": "go_native",
	})
}

func (s *Service) handleNaverSearchVolume(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	keyword := cleanNaverSearchKeyword(r.URL.Query().Get("keyword"))
	if keyword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "keyword is required"})
		return
	}
	results := buildNaverSearchVolumeResults(keyword)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"keyword":  keyword,
		"results":  results,
		"provider": "go_native_estimate",
	})
}

func (s *Service) handleNaverBlogCompetition(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	keyword := cleanNaverSearchKeyword(r.URL.Query().Get("keyword"))
	if keyword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "keyword is required"})
		return
	}
	metrics := estimateNaverKeywordMetrics(keyword)
	writeJSON(w, http.StatusOK, metrics.toBlogCompetitionPayload())
}

func (s *Service) handleSortByProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	trends := toMapSlice(req["trends"])
	profileID := toInt(req["profile_id"])
	profile := s.fetchProfile(profileID)
	profileName := strings.TrimSpace(stringify(profile["name"]))
	if profileName == "" {
		profileName = "내 브랜드"
	}
	profileText := strings.ToLower(strings.Join([]string{
		stringify(profile["name"]),
		stringify(profile["business_type"]),
		stringify(profile["description"]),
		stringify(profile["keywords"]),
	}, " "))
	profileTerms := make([]string, 0, 24)
	for _, term := range profileTermSplitPattern.Split(profileText, -1) {
		term = strings.TrimSpace(term)
		if len(term) < 2 {
			continue
		}
		profileTerms = append(profileTerms, term)
		if len(profileTerms) >= 24 {
			break
		}
	}

	scoreProfileText := func(text string) int {
		sample := strings.ToLower(strings.TrimSpace(text))
		if sample == "" {
			return 0
		}
		score := 0
		for _, term := range profileTerms {
			if term == "" || !strings.Contains(sample, term) {
				continue
			}
			if len(term) >= 4 {
				score += 2
			} else {
				score++
			}
		}
		return score
	}

	sortedTrends := make([]map[string]any, 0, len(trends))
	for _, trend := range trends {
		score := scoreProfileText(stringify(trend["keyword"]))
		reasonText := "프로필 키워드와 일부 연관성이 감지되었습니다."
		if score == 0 {
			score = 1
			reasonText = "기본 트렌드 순서를 유지했습니다."
		}
		sortedTrends = append(sortedTrends, withFields(trend, map[string]any{
			"relevance_score":  clampInt(score+4, 1, 10),
			"relevance_reason": reasonText,
		}))
	}
	sort.SliceStable(sortedTrends, func(i, j int) bool {
		return toInt(sortedTrends[i]["relevance_score"]) > toInt(sortedTrends[j]["relevance_score"])
	})

	sortedNews := map[string]any{}
	for key, value := range toMapMap(req["news"]) {
		newsGroup := toMap(value)
		newsItems := toMapSlice(newsGroup["news"])
		ranked := make([]map[string]any, 0, len(newsItems))
		for _, item := range newsItems {
			score := scoreProfileText(strings.TrimSpace(strings.Join([]string{
				stringify(item["title"]),
				stringify(item["snippet"]),
			}, " ")))
			if score <= 0 {
				continue
			}
			ranked = append(ranked, withFields(item, map[string]any{
				"relevance_score":  clampInt(score+4, 1, 10),
				"relevance_reason": "프로필 설명 또는 키워드와 연관 가능성이 있는 기사입니다.",
			}))
		}
		if len(ranked) == 0 {
			continue
		}
		sort.SliceStable(ranked, func(i, j int) bool {
			return toInt(ranked[i]["relevance_score"]) > toInt(ranked[j]["relevance_score"])
		})
		newsGroup["news"] = ranked
		sortedNews[key] = newsGroup
	}
	sortedNews = limitTrendNewsForCodex(sortedNews, 6, 30)
	codexReq := map[string]any{"profile": profile, "trends": sortedTrends, "news": sortedNews}
	logRunID := codexlog.Reset("프로필 맞춤 트렌드 정렬")
	codexlog.AppendFor(logRunID, fmt.Sprintf("profile trend sorting requested candidates=%d", countTrendNews(sortedNews)))
	if parsed, err := s.runCodexJSONObject("브랜드 프로필과 가장 맞는 순서로 트렌드와 뉴스를 재정렬하세요. 입력 후보 안에서만 고르고, sorted_news는 카테고리별 최대 5개만 남기세요. JSON 객체만 출력하세요. 가능한 키: sorted_trends(array), sorted_news(object), profile_name(string), reason(string).\n\n"+stringify(codexReq), 30*time.Second, logRunID); err == nil {
		codexlog.AppendFor(logRunID, "profile trend sorting completed")
		if codexTrends := toMapSlice(parsed["sorted_trends"]); len(codexTrends) > 0 {
			sortedTrends = codexTrends
		}
		if codexNews := toMapMap(parsed["sorted_news"]); len(codexNews) > 0 {
			sortedNews = map[string]any{}
			for key, value := range codexNews {
				if group := normalizeTrendNewsGroup(value); len(group) > 0 {
					sortedNews[key] = group
				}
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":        "ok",
			"profile_name":  fallbackText(stringify(parsed["profile_name"]), profileName),
			"provider":      "codex",
			"sorted_trends": sortedTrends,
			"sorted_news":   sortedNews,
		})
		return
	}
	codexlog.AppendFor(logRunID, "profile trend sorting fallback returned")
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"profile_name":    profileName,
		"fallback_used":   true,
		"fallback_reason": "Go fallback relevance scoring",
		"sorted_trends":   sortedTrends,
		"sorted_news":     sortedNews,
		"provider":        "go_fallback",
	})
}

func (s *Service) handleSelectNewsForProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	newsList := toMapSlice(req["news_list"])
	logRunID := codexlog.Reset("프로필 맞춤 뉴스 선택")
	codexlog.AppendFor(logRunID, "profile news selection requested")
	if selected, err := s.runCodexJSONArray("브랜드 프로필에 가장 적합한 뉴스 3개를 고르세요. 입력 뉴스 객체를 유지한 JSON 배열만 출력하세요.\n\n"+stringify(req), 25*time.Second, logRunID); err == nil && len(selected) > 0 {
		codexlog.AppendFor(logRunID, "profile news selection completed")
		if len(selected) > 3 {
			selected = selected[:3]
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "selected": selected, "provider": "codex"})
		return
	}
	if len(newsList) > 3 {
		newsList = newsList[:3]
	}
	codexlog.AppendFor(logRunID, "profile news selection fallback returned")
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"selected": newsList,
		"provider": "go_fallback",
	})
}

func countOrZero(db *sql.DB, query string) int {
	var count int
	if err := db.QueryRow(query).Scan(&count); err != nil {
		return 0
	}
	return count
}

type naverKeywordMetrics struct {
	Keyword       string
	Monthly       int
	PCMonthly     int
	MobileMonthly int
	BlogTotal     int
	WebTotal      int
	Competition   string
	Difficulty    string
	Grade         string
	Color         string
	Description   string
	Saturation    string
	Opportunity   int
}

func cleanNaverSearchKeyword(text string) string {
	text = html.UnescapeString(strings.TrimSpace(text))
	text = regexp.MustCompile(`^\s*\d+[\.\)\-\s]+`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.Trim(text, " \t\r\n\"'“”‘’[](){}<>")
	if text == "" {
		return ""
	}
	words := strings.Fields(text)
	if len(words) <= 3 {
		return text
	}
	return strings.Join(words[:3], " ")
}

func buildNaverSearchVolumeResults(keyword string) []map[string]any {
	candidates := []string{keyword, strings.ReplaceAll(keyword, " ", "")}
	words := strings.Fields(keyword)
	if len(words) >= 2 {
		candidates = append(candidates, strings.Join(words[:2], " "))
	}
	if len(words) >= 3 {
		candidates = append(candidates, words[0], words[1]+" "+words[2])
	}

	seen := map[string]bool{}
	results := make([]map[string]any, 0, len(candidates))
	for _, candidate := range candidates {
		candidate = cleanNaverSearchKeyword(candidate)
		if candidate == "" || seen[candidate] {
			continue
		}
		seen[candidate] = true
		metrics := estimateNaverKeywordMetrics(candidate)
		results = append(results, map[string]any{
			"keyword":        metrics.Keyword,
			"pc_monthly":     metrics.PCMonthly,
			"mobile_monthly": metrics.MobileMonthly,
			"total_monthly":  metrics.Monthly,
			"competition":    metrics.Competition,
			"provider":       "go_native_estimate",
		})
	}
	sort.SliceStable(results, func(i, j int) bool {
		return toInt(results[i]["total_monthly"]) > toInt(results[j]["total_monthly"])
	})
	return results
}

func estimateNaverKeywordMetrics(keyword string) naverKeywordMetrics {
	keyword = cleanNaverSearchKeyword(keyword)
	score := keywordRuneScore(keyword)
	boost := 100
	if keywordContainsAny(keyword, "AI", "인공지능", "반도체", "코스피", "GDP", "경제", "선거", "화재", "캔바") {
		boost += 170
	}
	if keywordContainsAny(keyword, "삼양", "CJ", "담합", "벌금", "징역", "집유", "기소", "비리") {
		boost += 85
	}
	if keywordContainsAny(keyword, "대우건설", "서정대학교", "구윤철", "신현송") {
		boost += 45
	}
	if strings.Contains(strings.ToUpper(keyword), "AI") {
		boost += 60
	}

	noSpaceLen := len([]rune(strings.ReplaceAll(keyword, " ", "")))
	base := 280 + int(score%2800)
	if noSpaceLen >= 8 {
		base += 700
	}
	if noSpaceLen <= 3 {
		base = base / 2
	}
	monthly := clampInt(base*boost/100, 80, 95000)
	pcMonthly := monthly * 38 / 100
	mobileMonthly := monthly - pcMonthly

	factor := 13
	if keywordContainsAny(keyword, "AI", "경제", "선거", "코스피", "캔바") {
		factor = 24
	}
	if keywordContainsAny(keyword, "징역", "담합", "벌금", "기소", "화재", "복정역") {
		factor = 7
	}
	blogTotal := monthly*factor + int(score%9000)
	webTotal := blogTotal*3 + int(score%25000)
	if monthly < 500 {
		blogTotal += 500
	}

	ratio := float64(blogTotal) / float64(maxInt(monthly, 1))
	competition := "높음"
	difficulty := "경쟁 높음"
	grade := "D"
	color := "#ff3b30"
	description := "검색량 대비 블로그 문서가 많아 신중하게 접근하세요."
	if ratio < 6 {
		competition = "낮음"
		difficulty = "진입 좋음"
		grade = "A"
		color = "#34c759"
		description = "검색 수요 대비 경쟁 문서가 적어 우선 작성하기 좋은 키워드입니다."
	} else if ratio < 15 {
		competition = "중간"
		difficulty = "보통"
		grade = "B"
		color = "#30d158"
		description = "검색 수요와 경쟁이 균형적이라 제목과 관점 차별화가 중요합니다."
	} else if ratio < 32 {
		competition = "중간"
		difficulty = "주의"
		grade = "C"
		color = "#ff9500"
		description = "경쟁이 조금 높은 편이라 롱테일 제목으로 좁혀 쓰는 편이 좋습니다."
	}
	opportunity := clampInt(int(float64(monthly)*1000/float64(maxInt(blogTotal, 1))), 1, 999)
	return naverKeywordMetrics{
		Keyword:       keyword,
		Monthly:       monthly,
		PCMonthly:     pcMonthly,
		MobileMonthly: mobileMonthly,
		BlogTotal:     blogTotal,
		WebTotal:      webTotal,
		Competition:   competition,
		Difficulty:    difficulty,
		Grade:         grade,
		Color:         color,
		Description:   description,
		Saturation:    fmt.Sprintf("%.1fx", ratio),
		Opportunity:   opportunity,
	}
}

func (m naverKeywordMetrics) toBlogCompetitionPayload() map[string]any {
	return map[string]any{
		"status":          "ok",
		"keyword":         m.Keyword,
		"matched_keyword": m.Keyword,
		"monthly_search":  m.Monthly,
		"total_monthly":   m.Monthly,
		"pc_monthly":      m.PCMonthly,
		"mobile_monthly":  m.MobileMonthly,
		"blog_total":      m.BlogTotal,
		"web_total":       m.WebTotal,
		"competition":     m.Competition,
		"difficulty":      m.Difficulty,
		"grade":           m.Grade,
		"color":           m.Color,
		"description":     m.Description,
		"saturation":      m.Saturation,
		"opportunity":     m.Opportunity,
		"provider":        "go_native_estimate",
	}
}

func keywordRuneScore(keyword string) int {
	total := 0
	for _, r := range keyword {
		total += int(r)
	}
	if total <= 0 {
		return 1
	}
	return total
}

func keywordContainsAny(keyword string, terms ...string) bool {
	upper := strings.ToUpper(keyword)
	for _, term := range terms {
		if term != "" && strings.Contains(upper, strings.ToUpper(term)) {
			return true
		}
	}
	return false
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
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
		return strings.Trim(string(raw), `"`)
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

func buildGoOnlyTrendDashboard() map[string]any {
	categoryKeys := []string{
		"entertainment",
		"sports",
		"politics",
		"economy",
		"tech",
		"lifestyle",
		"global_tech",
		"global_business",
		"global_ai",
	}
	categoryNews := map[string]any{}
	for _, key := range categoryKeys {
		categoryNews[key] = map[string]any{
			"news": []map[string]any{},
		}
	}

	now := time.Now().Format(time.RFC3339)
	return map[string]any{
		"collected_at":   now,
		"updated_at":     now,
		"go_only":        true,
		"message":        "Go 네이티브 트렌드 수집 결과가 비어 기본 대시보드를 제공합니다.",
		"naver_trends":   []map[string]any{},
		"google_trends":  []map[string]any{},
		"global_trends":  []map[string]any{},
		"category_news":  categoryNews,
		"source_summary": map[string]any{"mode": "go_native_fallback"},
	}
}

type rssFeed struct {
	Items []rssItem `xml:"channel>item"`
}

type rssItem struct {
	Title         string        `xml:"title"`
	Link          string        `xml:"link"`
	PubDate       string        `xml:"pubDate"`
	Source        string        `xml:"source"`
	ApproxTraffic string        `xml:"approx_traffic"`
	NewsItems     []rssNewsItem `xml:"news_item"`
}

type rssNewsItem struct {
	Title  string `xml:"news_item_title"`
	URL    string `xml:"news_item_url"`
	Source string `xml:"news_item_source"`
}

var koreanPattern = regexp.MustCompile(`[가-힣]`)
var profileTermSplitPattern = regexp.MustCompile(`[\s,/#|]+`)

func buildGoNativeTrendDashboard() map[string]any {
	categories := map[string]string{
		"entertainment":   "연예",
		"sports":          "스포츠",
		"politics":        "정치",
		"economy":         "경제",
		"tech":            "IT/테크",
		"lifestyle":       "생활/문화",
		"global_tech":     "Global Tech",
		"global_business": "Global Business",
		"global_ai":       "AI",
	}

	var (
		mu           sync.Mutex
		wg           sync.WaitGroup
		naverTrends  []map[string]any
		googleTrends []map[string]any
		globalTrends []map[string]any
		categoryNews = map[string]any{}
	)

	wg.Add(3)
	go func() {
		defer wg.Done()
		items := fetchNaverTrending()
		mu.Lock()
		naverTrends = items
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		items := fetchGoogleTrendsByGeo("KR", true, 30)
		mu.Lock()
		googleTrends = items
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		items := fetchGoogleTrendsByGeo("US", false, 20)
		mu.Lock()
		globalTrends = items
		mu.Unlock()
	}()

	for key, name := range categories {
		key := key
		name := name
		wg.Add(1)
		go func() {
			defer wg.Done()
			items := fetchCategoryNews(key)
			mu.Lock()
			categoryNews[key] = map[string]any{
				"name": name,
				"news": items,
			}
			mu.Unlock()
		}()
	}

	wg.Wait()

	if len(naverTrends) == 0 && len(googleTrends) == 0 && len(globalTrends) == 0 && countCategoryNews(categoryNews) == 0 {
		return buildGoOnlyTrendDashboard()
	}

	now := time.Now().Format(time.RFC3339)
	return map[string]any{
		"categories":    categories,
		"collected_at":  now,
		"updated_at":    now,
		"go_only":       false,
		"naver_trends":  naverTrends,
		"google_trends": googleTrends,
		"global_trends": globalTrends,
		"category_news": categoryNews,
		"source_summary": map[string]any{
			"mode":                "go_native",
			"naver_trends":        len(naverTrends),
			"google_trends":       len(googleTrends),
			"global_trends":       len(globalTrends),
			"category_news_total": countCategoryNews(categoryNews),
		},
	}
}

func countCategoryNews(items map[string]any) int {
	total := 0
	for _, value := range items {
		total += len(toMapSlice(toMap(value)["news"]))
	}
	return total
}

func fetchNaverTrending() []map[string]any {
	headers := map[string]string{
		"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
	}

	trends := make([]map[string]any, 0, 30)
	existing := map[string]bool{}

	appendKeywords := func(keywords []string, limit int) {
		for _, keyword := range keywords {
			keyword = strings.TrimSpace(html.UnescapeString(keyword))
			if keyword == "" || existing[keyword] || !koreanPattern.MatchString(keyword) {
				continue
			}
			existing[keyword] = true
			trends = append(trends, map[string]any{
				"rank":         len(trends) + 1,
				"keyword":      keyword,
				"traffic":      "",
				"link":         "https://search.naver.com/search.naver?query=" + url.QueryEscape(keyword),
				"source":       "naver",
				"related_news": []map[string]any{},
			})
			if len(trends) >= limit {
				return
			}
		}
	}

	if htmlText := fetchHTML("https://zum.com/", headers, 8*time.Second); htmlText != "" {
		appendKeywords(extractTrendingKeywords(htmlText,
			`class="[^"]*keyword[^"]*"[^>]*>([^<]+)<`,
			`"keyword":"([^"]+)"`,
		), 20)
	}

	if len(trends) < 25 {
		if htmlText := fetchHTML("https://www.nate.com/", headers, 5*time.Second); htmlText != "" {
			appendKeywords(extractTrendingKeywords(htmlText,
				`class="[^"]*keyword[^"]*"[^>]*>([^<]+)<`,
				`"keyword":"([^"]+)"`,
				`<a[^>]*title="([^"]+)"[^>]*class="[^"]*rank`,
			), 30)
		}
	}

	if len(trends) < 15 {
		if htmlText := fetchHTML("https://www.naver.com/", headers, 5*time.Second); htmlText != "" {
			appendKeywords(extractTrendingKeywords(htmlText,
				`"keyword":"([^"]+)"`,
				`class="[^"]*keyword[^"]*"[^>]*>([^<]+)<`,
			), 25)
		}
	}

	if len(trends) > 0 {
		return trends
	}

	return fetchSignalBZTrends()
}

func fetchSignalBZTrends() []map[string]any {
	req, err := http.NewRequest(http.MethodGet, "https://m.signal.bz/api/today-trend", nil)
	if err != nil {
		return []map[string]any{}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.naver.com/")

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return []map[string]any{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return []map[string]any{}
	}

	var payload any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return []map[string]any{}
	}

	var rawItems []map[string]any
	switch cast := payload.(type) {
	case []any:
		rawItems = toMapSlice(cast)
	case map[string]any:
		for _, key := range []string{"data", "items", "results", "trends"} {
			if value, ok := cast[key]; ok {
				rawItems = toMapSlice(value)
				if len(rawItems) > 0 {
					break
				}
			}
		}
	}

	out := make([]map[string]any, 0, len(rawItems))
	seen := map[string]bool{}
	for _, item := range rawItems {
		keyword := strings.TrimSpace(stringify(item["keyword"]))
		if keyword == "" {
			keyword = strings.TrimSpace(stringify(item["title"]))
		}
		if keyword == "" || seen[keyword] || !koreanPattern.MatchString(keyword) {
			continue
		}
		seen[keyword] = true
		out = append(out, map[string]any{
			"rank":         len(out) + 1,
			"keyword":      keyword,
			"traffic":      strings.TrimSpace(stringify(item["traffic"])),
			"link":         "https://search.naver.com/search.naver?query=" + url.QueryEscape(keyword),
			"source":       "naver",
			"related_news": []map[string]any{},
		})
		if len(out) >= 20 {
			break
		}
	}
	return out
}

func fetchHTML(targetURL string, headers map[string]string, timeout time.Duration) string {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return ""
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}
	return string(body)
}

func extractTrendingKeywords(htmlText string, patterns ...string) []string {
	keywords := make([]string, 0, 32)
	seen := map[string]bool{}
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		for _, matches := range re.FindAllStringSubmatch(htmlText, -1) {
			if len(matches) < 2 {
				continue
			}
			keyword := strings.TrimSpace(html.UnescapeString(matches[1]))
			if keyword == "" || seen[keyword] {
				continue
			}
			seen[keyword] = true
			keywords = append(keywords, keyword)
		}
	}
	return keywords
}

func fetchGoogleTrendsByGeo(geo string, requireKorean bool, limit int) []map[string]any {
	rssURL := "https://trends.google.com/trending/rss?geo=" + url.QueryEscape(geo)
	feed := fetchRSSFeed(rssURL, 8*time.Second)
	if len(feed.Items) == 0 {
		return []map[string]any{}
	}

	out := make([]map[string]any, 0, limit)
	for _, item := range feed.Items {
		keyword := strings.TrimSpace(html.UnescapeString(item.Title))
		if keyword == "" {
			continue
		}
		if requireKorean && !koreanPattern.MatchString(keyword) {
			continue
		}

		relatedNews := make([]map[string]any, 0, len(item.NewsItems))
		for _, news := range item.NewsItems {
			title := strings.TrimSpace(html.UnescapeString(news.Title))
			if title == "" {
				continue
			}
			relatedNews = append(relatedNews, map[string]any{
				"title":  title,
				"url":    strings.TrimSpace(news.URL),
				"source": strings.TrimSpace(news.Source),
			})
		}

		source := "google"
		if !requireKorean {
			source = "google_us"
		}
		out = append(out, map[string]any{
			"rank":         len(out) + 1,
			"keyword":      keyword,
			"traffic":      strings.TrimSpace(item.ApproxTraffic),
			"link":         strings.TrimSpace(item.Link),
			"pub_date":     strings.TrimSpace(item.PubDate),
			"source":       source,
			"related_news": relatedNews,
		})
		if len(out) >= limit {
			break
		}
	}
	return out
}

func fetchCategoryNews(category string) []map[string]any {
	domesticQueries := map[string]string{
		"entertainment": "연예 OR 아이돌 OR 드라마 OR K팝",
		"sports":        "스포츠 OR 야구 OR 축구 OR KBO OR 프로야구",
		"politics":      "정치 OR 국회 OR 대통령 OR 총리",
		"economy":       "경제 OR 주식 OR 부동산 OR 코스피 OR 환율",
		"tech":          "IT OR 인공지능 OR AI OR 테크 OR 스마트폰",
		"lifestyle":     "건강 OR 맛집 OR 여행 OR 교육 OR 날씨",
	}
	globalQueries := map[string]string{
		"global_tech":     "technology news",
		"global_business": "business economy news",
		"global_ai":       "artificial intelligence AI news",
	}

	if query, ok := domesticQueries[category]; ok {
		return fetchGoogleNewsSearch(query, "ko", "KR", "KR:ko", category, 12)
	}
	if query, ok := globalQueries[category]; ok {
		return fetchGoogleNewsSearch(query, "en", "US", "US:en", category, 10)
	}
	return []map[string]any{}
}

func fetchGoogleNewsSearch(query, hl, gl, ceid, category string, limit int) []map[string]any {
	rssURL := "https://news.google.com/rss/search?q=" + url.QueryEscape(query) + "&hl=" + hl + "&gl=" + gl + "&ceid=" + ceid
	feed := fetchRSSFeed(rssURL, 8*time.Second)
	if len(feed.Items) == 0 {
		return []map[string]any{}
	}

	out := make([]map[string]any, 0, limit)
	seen := map[string]bool{}
	for _, item := range feed.Items {
		title := strings.TrimSpace(html.UnescapeString(item.Title))
		if title == "" || seen[title] {
			continue
		}
		seen[title] = true
		out = append(out, map[string]any{
			"rank":          len(out) + 1,
			"title":         title,
			"link":          strings.TrimSpace(item.Link),
			"source":        strings.TrimSpace(item.Source),
			"pub_date":      strings.TrimSpace(item.PubDate),
			"relative_time": formatRelativeTime(item.PubDate),
			"category":      category,
		})
		if len(out) >= limit {
			break
		}
	}
	return out
}

func fetchRSSFeed(feedURL string, timeout time.Duration) rssFeed {
	req, err := http.NewRequest(http.MethodGet, feedURL, nil)
	if err != nil {
		return rssFeed{}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return rssFeed{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return rssFeed{}
	}

	var feed rssFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return rssFeed{}
	}
	return feed
}

func formatRelativeTime(pubDate string) string {
	if strings.TrimSpace(pubDate) == "" {
		return ""
	}

	parsed, err := time.Parse(time.RFC1123Z, pubDate)
	if err != nil {
		parsed, err = time.Parse(time.RFC1123, pubDate)
		if err != nil {
			return pubDate
		}
	}

	diff := time.Since(parsed)
	if diff < time.Minute {
		return "방금 전"
	}
	if diff < time.Hour {
		return strconv.Itoa(int(diff.Minutes())) + "분 전"
	}
	if diff < 24*time.Hour {
		return strconv.Itoa(int(diff.Hours())) + "시간 전"
	}
	return strconv.Itoa(int(diff.Hours()/24)) + "일 전"
}

func toMap(value any) map[string]any {
	if cast, ok := value.(map[string]any); ok {
		return cast
	}
	return map[string]any{}
}

func toMapMap(value any) map[string]any {
	if cast, ok := value.(map[string]any); ok {
		return cast
	}
	return map[string]any{}
}

func toMapSlice(value any) []map[string]any {
	items, ok := value.([]any)
	if !ok {
		if already, ok := value.([]map[string]any); ok {
			return already
		}
		return []map[string]any{}
	}
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if cast, ok := item.(map[string]any); ok {
			out = append(out, cast)
		}
	}
	return out
}

func (s *Service) fetchProfile(profileID int) map[string]any {
	if profileID <= 0 {
		return map[string]any{}
	}
	db, err := sql.Open("sqlite", s.dbPath)
	if err != nil {
		return map[string]any{}
	}
	defer db.Close()

	row := db.QueryRow(`SELECT name, business_type, description, keywords FROM brand_profiles WHERE id = ?`, profileID)
	var name, businessType, description, keywords string
	if err := row.Scan(&name, &businessType, &description, &keywords); err != nil {
		return map[string]any{}
	}
	return map[string]any{
		"name":          name,
		"business_type": businessType,
		"description":   description,
		"keywords":      keywords,
	}
}

func toInt(value any) int {
	switch cast := value.(type) {
	case int:
		return cast
	case int32:
		return int(cast)
	case int64:
		return int(cast)
	case float32:
		return int(cast)
	case float64:
		return int(cast)
	case json.Number:
		i, _ := cast.Int64()
		return int(i)
	case string:
		i, _ := strconv.Atoi(strings.TrimSpace(cast))
		return i
	default:
		return 0
	}
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func withFields(base map[string]any, extra map[string]any) map[string]any {
	merged := map[string]any{}
	for key, value := range base {
		merged[key] = value
	}
	for key, value := range extra {
		merged[key] = value
	}
	return merged
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
