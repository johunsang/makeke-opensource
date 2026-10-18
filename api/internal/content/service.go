package content

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"html"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"makeke/api/internal/codexlog"
	"makeke/api/internal/config"
)

type Service struct {
	cfg        config.Config
	dataDir    string
	dbPath     string
	lastMu     sync.Mutex
	last       map[string]any
	codexLogMu sync.Mutex
	codexLogs  []string
}

type googleNewsRSS struct {
	Items []googleNewsItem `xml:"channel>item"`
}

type googleNewsItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
	Source  string `xml:"source"`
}

type naverOpenSearchResponse struct {
	Items []naverOpenSearchItem `json:"items"`
}

type naverOpenSearchItem struct {
	Title       string `json:"title"`
	Link        string `json:"link"`
	Description string `json:"description"`
	BloggerName string `json:"bloggername"`
	BloggerLink string `json:"bloggerlink"`
	PostDate    string `json:"postdate"`
	PubDate     string `json:"pubDate"`
	OriginLink  string `json:"originallink"`
}

type youtubeAnalysisData struct {
	URL       string `json:"url"`
	Title     string `json:"title"`
	Channel   string `json:"channel"`
	Duration  string `json:"duration"`
	Thumbnail string `json:"thumbnail"`
	Language  string `json:"language"`
	Text      string `json:"text"`
	Summary   string `json:"summary"`
}

var (
	htmlCommentPattern   = regexp.MustCompile(`(?is)<!--.*?-->`)
	htmlTagPattern       = regexp.MustCompile(`(?is)<[^>]+>`)
	htmlSpacePattern     = regexp.MustCompile(`[ \t]+`)
	htmlBreakPattern     = regexp.MustCompile(`(?i)<\s*br\s*/?\s*>`)
	htmlBlockEndPattern  = regexp.MustCompile(`(?i)</\s*(p|div|section|article|main|li|ul|ol|h1|h2|h3|h4|h5|h6|blockquote)\s*>`)
	titlePattern         = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
	imageURLPattern      = regexp.MustCompile(`(?is)<img[^>]+(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']`)
	htmlStripTagPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`),
		regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`),
		regexp.MustCompile(`(?is)<noscript[^>]*>.*?</noscript>`),
		regexp.MustCompile(`(?is)<svg[^>]*>.*?</svg>`),
		regexp.MustCompile(`(?is)<iframe[^>]*>.*?</iframe>`),
		regexp.MustCompile(`(?is)<form[^>]*>.*?</form>`),
		regexp.MustCompile(`(?is)<button[^>]*>.*?</button>`),
		regexp.MustCompile(`(?is)<header[^>]*>.*?</header>`),
		regexp.MustCompile(`(?is)<footer[^>]*>.*?</footer>`),
		regexp.MustCompile(`(?is)<nav[^>]*>.*?</nav>`),
	}
	mainArticlePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?is)<article[^>]*>(.*?)</article>`),
		regexp.MustCompile(`(?is)<main[^>]*>(.*?)</main>`),
		regexp.MustCompile(`(?is)<div[^>]+(?:id|class)=["'][^"']*(article|content|post|entry|main|story|news|body)[^"']*["'][^>]*>(.*?)</div>`),
		regexp.MustCompile(`(?is)<section[^>]+(?:id|class)=["'][^"']*(article|content|post|entry|main|story|news|body)[^"']*["'][^>]*>(.*?)</section>`),
	}
)

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
	mux.HandleFunc("/api/content/search", s.handleSearch)
	mux.HandleFunc("/api/content/search-global", s.handleSearchGlobal)
	mux.HandleFunc("/api/ce2/naver-search", s.handleCE2NaverSearch)
	mux.HandleFunc("/api/ce2/youtube-analyze", s.handleCE2YouTubeAnalyze)
	mux.HandleFunc("/api/content/youtube-transcript", s.handleYouTubeTranscript)
	mux.HandleFunc("/api/content/translate", s.handleTranslate)
	mux.HandleFunc("/api/content/extract-keyword", s.handleExtractKeyword)
	mux.HandleFunc("/api/content/extract-tags", s.handleExtractTags)
	mux.HandleFunc("/api/content/extract-file-path", s.handleExtractFilePath)
	mux.HandleFunc("/api/content/extract-file", s.handleExtractFile)
	mux.HandleFunc("/api/content/upload-image", s.handleUploadImage)
	mux.HandleFunc("/api/content/user-image/", s.handleUserImage)
	mux.HandleFunc("/api/content/fetch-images", s.handleFetchImages)
	mux.HandleFunc("/api/content/deep-scrape", s.handleDeepScrape)
	mux.HandleFunc("/api/content/scrape-article", s.handleScrapeArticle)
	mux.HandleFunc("/api/content/validate-article-text", s.handleValidateArticleText)
	mux.HandleFunc("/api/content/collect-from-popup", s.handleCollectFromPopup)
	mux.HandleFunc("/api/content/last-collected", s.handleLastCollected)
	mux.HandleFunc("/api/content/generate-sns", s.handleGenerateSNS)
	mux.HandleFunc("/api/content/convert-narration", s.handleConvertNarration)
	mux.HandleFunc("/api/content/generate-ig-caption", s.handleGenerateIGCaption)
	mux.HandleFunc("/api/content/prompt-preview", s.handlePromptPreview)
	mux.HandleFunc("/api/content/refine-prompts", s.handleRefinePrompts)
	mux.HandleFunc("/api/content/generate", s.handleGenerateContent)
	mux.HandleFunc("/api/content/codex-logs", s.handleCodexLogs)
	mux.HandleFunc("/api/cardnews/generate-texts", s.handleGenerateCardnewsTexts)
	mux.HandleFunc("/api/cardnews/generate-single", s.handleGenerateSingleCardnewsSlide)
	mux.HandleFunc("/api/cardnews/image/", s.handleCardnewsImage)
	mux.HandleFunc("/api/comic/script", s.handleGenerateComicScript)
	mux.HandleFunc("/api/comic/generate", s.handleGenerateComic)
	mux.HandleFunc("/api/comic/story-series", s.handleComicStorySeries)
	mux.HandleFunc("/api/comic/story-series/preview", s.handleComicStoryPreview)
	mux.HandleFunc("/api/comic/story-series/episode", s.handleComicStoryEpisode)
	mux.HandleFunc("/api/comic/story-message", s.handleComicStoryMessage)
	mux.HandleFunc("/api/comic/story-topics", s.handleComicStoryTopics)
	mux.HandleFunc("/api/comic/generate-panel", s.handleGenerateComicPanel)
	mux.HandleFunc("/api/comic/recompose", s.handleRecomposeComic)
	mux.HandleFunc("/api/comic/image/", s.handleComicImage)
	mux.HandleFunc("/api/comic/history", s.handleComicHistory)
	mux.HandleFunc("/api/comic/delete", s.handleComicDelete)
	mux.HandleFunc("/api/cag/history", s.handleComicHistory)
	mux.HandleFunc("/api/cag/history/delete", s.handleComicDelete)
}

func (s *Service) handleCodexLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"logs":   s.snapshotCodexLogs(),
	})
}

func (s *Service) resetCodexLogs(label string) {
	codexlog.Reset(label)
}

func (s *Service) appendCodexLog(line string) {
	codexlog.Append(line)
}

func (s *Service) snapshotCodexLogs() []string {
	return codexlog.Snapshot()
}

func formatCodexLogLine(line string) string {
	return time.Now().Format("15:04:05") + " " + line
}

func (s *Service) handleSearch(w http.ResponseWriter, r *http.Request) {
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "키워드를 입력하세요."})
		return
	}

	related := buildRelatedKeywords(keyword)
	sources := collectGoSearchSources(keyword, related)

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data": map[string]any{
			"keyword":          keyword,
			"related_keywords": related,
			"trend_score":      estimateTrendScore(sources),
			"sources":          sources,
			"source_count":     len(sources),
			"youtube_count":    0,
		},
	})
}

func buildRelatedKeywords(keyword string) []string {
	base := strings.TrimSpace(keyword)
	if base == "" {
		return []string{}
	}
	candidates := []string{
		base,
		base + " 트렌드",
		base + " 사례",
		base + " 전망",
		base + " 방법",
	}
	seen := map[string]struct{}{}
	related := make([]string, 0, len(candidates))
	for _, item := range candidates {
		cleaned := strings.TrimSpace(item)
		if cleaned == "" {
			continue
		}
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		related = append(related, cleaned)
	}
	return related
}

func collectGoSearchSources(keyword string, related []string) []map[string]any {
	sources := make([]map[string]any, 0, 24)
	seen := map[string]struct{}{}
	appendFeed := func(query string, limit int) {
		items, err := fetchGoogleNewsRSS(query)
		if err != nil {
			return
		}
		for _, item := range items {
			if len(sources) >= limit {
				return
			}
			link := strings.TrimSpace(item.Link)
			if link == "" {
				continue
			}
			if _, exists := seen[link]; exists {
				continue
			}
			seen[link] = struct{}{}
			sources = append(sources, map[string]any{
				"title":    strings.TrimSpace(item.Title),
				"snippet":  strings.TrimSpace(item.Title),
				"url":      link,
				"source":   strings.TrimSpace(item.Source),
				"press":    strings.TrimSpace(item.Source),
				"pub_date": item.PubDate,
				"type":     "news",
			})
		}
	}
	appendFeed(keyword, 18)
	for idx, item := range related {
		if idx >= 3 {
			break
		}
		appendFeed(item, 24)
		if len(sources) >= 12 {
			break
		}
	}
	return sources
}

func estimateTrendScore(sources []map[string]any) int {
	score := 35 + len(sources)*3
	if score > 100 {
		return 100
	}
	return score
}

func (s *Service) handleCE2NaverSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	query := strings.TrimSpace(firstNonEmpty(stringify(req["query"]), stringify(req["keyword"])))
	if query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "검색어를 입력하세요."})
		return
	}

	items, provider := s.collectNaverSearchItems(query)
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"ok":       true,
		"query":    query,
		"items":    items,
		"count":    len(items),
		"provider": provider,
	})
}

func (s *Service) collectNaverSearchItems(query string) ([]map[string]any, string) {
	clientID := strings.TrimSpace(s.getSetting("NAVER_API.client_id", ""))
	clientSecret := strings.TrimSpace(s.getSetting("NAVER_API.client_secret", ""))
	if clientID != "" && clientSecret != "" {
		items := make([]map[string]any, 0, 16)
		seen := map[string]struct{}{}
		appendUnique := func(next []map[string]any) {
			for _, item := range next {
				link := strings.TrimSpace(stringify(item["link"]))
				if link == "" {
					link = strings.TrimSpace(stringify(item["url"]))
				}
				if link == "" {
					continue
				}
				if _, exists := seen[link]; exists {
					continue
				}
				seen[link] = struct{}{}
				items = append(items, item)
			}
		}
		if blogs, err := s.fetchNaverOpenSearch(query, "blog", 8); err == nil {
			appendUnique(blogs)
		}
		if news, err := s.fetchNaverOpenSearch(query, "news", 8); err == nil {
			appendUnique(news)
		}
		if len(items) > 0 {
			return items, "naver_openapi"
		}
	}

	items := collectDuckDuckGoNaverSearchItems(query, 16)
	if len(items) > 0 {
		return items, "naver_site_fallback"
	}
	return []map[string]any{}, "empty"
}

func (s *Service) fetchNaverOpenSearch(query string, kind string, limit int) ([]map[string]any, error) {
	clientID := strings.TrimSpace(s.getSetting("NAVER_API.client_id", ""))
	clientSecret := strings.TrimSpace(s.getSetting("NAVER_API.client_secret", ""))
	if clientID == "" || clientSecret == "" {
		return nil, errUnavailable("네이버 검색 API 키가 설정되지 않았습니다.")
	}
	if limit <= 0 {
		limit = 8
	}
	if limit > 100 {
		limit = 100
	}
	endpointKind := "blog"
	if kind == "news" {
		endpointKind = "news"
	}
	endpoint := "https://openapi.naver.com/v1/search/" + endpointKind + ".json?query=" + url.QueryEscape(query) + "&display=" + strconv.Itoa(limit) + "&sort=sim"
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Naver-Client-Id", clientID)
	req.Header.Set("X-Naver-Client-Secret", clientSecret)
	req.Header.Set("Accept", "application/json")

	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errUnavailable("네이버 검색 API 오류: HTTP " + resp.Status)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, err
	}
	var parsed naverOpenSearchResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}
	return buildNaverOpenSearchItems(kind, parsed.Items), nil
}

func buildNaverOpenSearchItems(kind string, rawItems []naverOpenSearchItem) []map[string]any {
	items := make([]map[string]any, 0, len(rawItems))
	for _, raw := range rawItems {
		title := cleanNaverSearchText(raw.Title)
		description := cleanNaverSearchText(raw.Description)
		link := strings.TrimSpace(raw.Link)
		if kind == "blog" {
			link = normalizeNaverBlogSearchLink(link, raw.BloggerLink)
		}
		if kind == "news" && strings.TrimSpace(raw.OriginLink) != "" {
			link = strings.TrimSpace(raw.OriginLink)
		}
		if title == "" || link == "" {
			continue
		}
		sourceLabel := "블로그"
		itemType := "blog"
		sourceName := cleanNaverSearchText(raw.BloggerName)
		if kind == "news" {
			sourceLabel = "뉴스"
			itemType = "news"
			sourceName = sourceLabel
		}
		items = append(items, map[string]any{
			"title":       title,
			"description": description,
			"link":        link,
			"url":         link,
			"source":      sourceLabel,
			"source_name": sourceName,
			"type":        itemType,
			"date":        firstNonEmpty(strings.TrimSpace(raw.PostDate), strings.TrimSpace(raw.PubDate)),
		})
	}
	return items
}

func normalizeNaverBlogSearchLink(rawLink string, bloggerLink string) string {
	link := strings.TrimSpace(html.UnescapeString(rawLink))
	if link == "" {
		return ""
	}
	parsed, err := url.Parse(link)
	if err != nil {
		return link
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || (!strings.HasSuffix(host, "blog.naver.com") && host != "m.blog.naver.com") {
		return link
	}
	blogID := strings.TrimSpace(parsed.Query().Get("blogId"))
	logNo := strings.TrimSpace(parsed.Query().Get("logNo"))
	parts := strings.FieldsFunc(strings.Trim(parsed.Path, "/"), func(r rune) bool { return r == '/' || r == '\\' })
	if host == "m.blog.naver.com" && len(parts) >= 2 {
		blogID = parts[0]
		logNo = parts[1]
	}
	if len(parts) >= 2 && blogID == "" && logNo == "" && isDigits(parts[1]) {
		blogID = parts[0]
		logNo = parts[1]
	}
	if blogID == "" && strings.TrimSpace(bloggerLink) != "" {
		if bloggerURL, err := url.Parse(strings.TrimSpace(bloggerLink)); err == nil {
			bloggerParts := strings.FieldsFunc(strings.Trim(bloggerURL.Path, "/"), func(r rune) bool { return r == '/' || r == '\\' })
			if len(bloggerParts) >= 1 {
				blogID = bloggerParts[0]
			}
		}
	}
	if blogID == "" || logNo == "" {
		return link
	}
	q := url.Values{}
	q.Set("blogId", blogID)
	q.Set("logNo", logNo)
	q.Set("redirect", "Dlog")
	q.Set("widgetTypeCall", "true")
	q.Set("directAccess", "false")
	return "https://blog.naver.com/PostView.naver?" + q.Encode()
}

func isDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func collectDuckDuckGoNaverSearchItems(query string, limit int) []map[string]any {
	if limit <= 0 {
		limit = 16
	}
	items := make([]map[string]any, 0, limit)
	seen := map[string]struct{}{}
	appendItems := func(next []map[string]any) {
		for _, item := range next {
			link := strings.TrimSpace(stringify(item["link"]))
			if link == "" {
				continue
			}
			if _, exists := seen[link]; exists {
				continue
			}
			seen[link] = struct{}{}
			items = append(items, item)
			if len(items) >= limit {
				return
			}
		}
	}
	appendItems(fetchDuckDuckGoSearchItems("site:blog.naver.com "+query, "블로그", "blog", limit/2))
	if len(items) < limit {
		appendItems(fetchDuckDuckGoSearchItems("site:news.naver.com "+query, "뉴스", "news", limit-len(items)))
	}
	return items
}

func fetchDuckDuckGoSearchItems(query, sourceLabel, itemType string, limit int) []map[string]any {
	if limit <= 0 {
		limit = 8
	}
	searchURL := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(query)
	req, err := http.NewRequest(http.MethodGet, searchURL, nil)
	if err != nil {
		return []map[string]any{}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Accept-Language", "ko,en-US;q=0.9,en;q=0.8")

	resp, err := (&http.Client{Timeout: 12 * time.Second}).Do(req)
	if err != nil {
		return []map[string]any{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return []map[string]any{}
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return []map[string]any{}
	}
	htmlText := string(body)
	linkPattern := regexp.MustCompile(`(?is)<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>`)
	items := make([]map[string]any, 0, limit)
	for _, match := range linkPattern.FindAllStringSubmatch(htmlText, -1) {
		if len(match) < 3 {
			continue
		}
		link := unwrapDuckDuckGoResultURL(html.UnescapeString(strings.TrimSpace(match[1])))
		if link == "" || !isUsableArticleURL(link) {
			continue
		}
		title := cleanNaverSearchText(match[2])
		if title == "" {
			continue
		}
		items = append(items, map[string]any{
			"title":       title,
			"description": "",
			"link":        link,
			"url":         link,
			"source":      sourceLabel,
			"source_name": sourceLabel,
			"type":        itemType,
			"date":        "",
		})
		if len(items) >= limit {
			break
		}
	}
	return items
}

func unwrapDuckDuckGoResultURL(candidate string) string {
	if candidate == "" {
		return ""
	}
	parsed, err := url.Parse(candidate)
	if err == nil {
		if uddg := strings.TrimSpace(parsed.Query().Get("uddg")); uddg != "" {
			return uddg
		}
	}
	return candidate
}

func cleanNaverSearchText(value string) string {
	cleaned := htmlTagPattern.ReplaceAllString(value, " ")
	cleaned = html.UnescapeString(cleaned)
	cleaned = strings.ReplaceAll(cleaned, "\u00a0", " ")
	cleaned = htmlSpacePattern.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

func (s *Service) handleCE2YouTubeAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	data, err := s.readYouTubeAnalysisRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"url":       data.URL,
		"title":     data.Title,
		"channel":   data.Channel,
		"duration":  data.Duration,
		"thumbnail": data.Thumbnail,
		"language":  data.Language,
		"text":      data.Text,
		"summary":   data.Summary,
	})
}

func (s *Service) handleYouTubeTranscript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	data, err := s.readYouTubeAnalysisRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data":   data,
	})
}

func (s *Service) readYouTubeAnalysisRequest(r *http.Request) (youtubeAnalysisData, error) {
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return youtubeAnalysisData{}, errors.New("YouTube 링크를 읽지 못했습니다")
	}
	rawURL := strings.TrimSpace(firstNonEmptyLocal(stringify(req["url"]), stringify(req["youtube_url"]), stringify(req["link"])))
	if rawURL == "" {
		return youtubeAnalysisData{}, errors.New("YouTube 링크를 입력하세요")
	}
	data, err := analyzeYouTubeWithYTDLP(rawURL)
	if err != nil {
		return youtubeAnalysisData{}, err
	}
	return data, nil
}

func analyzeYouTubeWithYTDLP(rawURL string) (youtubeAnalysisData, error) {
	meta, err := runYTDLPJSON(rawURL)
	if err != nil {
		return youtubeAnalysisData{}, err
	}
	text := ""
	subtitleURL, language := selectYouTubeSubtitleURL(meta)
	if subtitleURL != "" {
		text = fetchYouTubeSubtitleText(subtitleURL)
	}
	if text == "" {
		text = youtubeFallbackText(meta)
	}
	if strings.TrimSpace(text) == "" {
		return youtubeAnalysisData{}, errUnavailable("YouTube 자막이나 설명을 가져오지 못했습니다")
	}

	title := strings.TrimSpace(stringify(meta["title"]))
	if title == "" {
		title = "YouTube 영상"
	}
	channel := strings.TrimSpace(firstNonEmptyLocal(stringify(meta["channel"]), stringify(meta["uploader"])))
	thumbnail := strings.TrimSpace(stringify(meta["thumbnail"]))
	if thumbnail == "" {
		thumbnail = pickLastThumbnailURL(meta["thumbnails"])
	}
	text = truncateRunes(text, 24000)

	return youtubeAnalysisData{
		URL:       strings.TrimSpace(firstNonEmptyLocal(stringify(meta["webpage_url"]), rawURL)),
		Title:     title,
		Channel:   channel,
		Duration:  formatDurationSeconds(meta["duration"]),
		Thumbnail: thumbnail,
		Language:  language,
		Text:      text,
		Summary:   truncateRunes(text, 1200),
	}, nil
}

func runYTDLPJSON(rawURL string) (map[string]any, error) {
	ytDlpPath, err := exec.LookPath("yt-dlp")
	if err != nil {
		return nil, errUnavailable("유튜브 내용을 가져오는 도구를 찾지 못했습니다. yt-dlp 설치가 필요합니다")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, ytDlpPath, "--dump-json", "--skip-download", "--no-warnings", "--no-playlist", rawURL)
	output, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return nil, errUnavailable("YouTube 응답이 너무 늦어 중단했습니다")
	}
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return nil, errUnavailable("YouTube 내용을 가져오지 못했습니다: " + truncateRunes(message, 220))
	}
	var parsed map[string]any
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, errUnavailable("YouTube 응답을 읽지 못했습니다")
	}
	return parsed, nil
}

func selectYouTubeSubtitleURL(meta map[string]any) (string, string) {
	preferredLangs := []string{"ko", "ko-KR", "en", "en-US"}
	if subURL, lang := collectSubtitleCandidates(meta["subtitles"], preferredLangs); subURL != "" {
		return subURL, lang
	}
	if subURL, lang := collectSubtitleCandidates(meta["automatic_captions"], preferredLangs); subURL != "" {
		return subURL, lang
	}
	if subURL, lang := collectSubtitleCandidates(meta["subtitles"], nil); subURL != "" {
		return subURL, lang
	}
	return collectSubtitleCandidates(meta["automatic_captions"], nil)
}

func collectSubtitleCandidates(value any, preferredLangs []string) (string, string) {
	tracks, ok := value.(map[string]any)
	if !ok || len(tracks) == 0 {
		return "", ""
	}
	langs := preferredLangs
	if len(langs) == 0 {
		langs = make([]string, 0, len(tracks))
		for lang := range tracks {
			langs = append(langs, lang)
		}
	}
	for _, preferred := range langs {
		if rawFormats, ok := tracks[preferred]; ok {
			if subURL := pickSubtitleFormatURL(rawFormats); subURL != "" {
				return subURL, preferred
			}
		}
		for lang, rawFormats := range tracks {
			if strings.EqualFold(lang, preferred) || strings.HasPrefix(strings.ToLower(lang), strings.ToLower(preferred)+"-") {
				if subURL := pickSubtitleFormatURL(rawFormats); subURL != "" {
					return subURL, lang
				}
			}
		}
	}
	return "", ""
}

func pickSubtitleFormatURL(rawFormats any) string {
	formats, ok := rawFormats.([]any)
	if !ok {
		return ""
	}
	preferredExts := []string{"json3", "vtt", "srv3", "srv2", "srv1", "ttml"}
	for _, ext := range preferredExts {
		for _, rawFormat := range formats {
			format, ok := rawFormat.(map[string]any)
			if !ok {
				continue
			}
			if !strings.EqualFold(strings.TrimSpace(stringify(format["ext"])), ext) {
				continue
			}
			if subURL := strings.TrimSpace(stringify(format["url"])); subURL != "" {
				return subURL
			}
		}
	}
	for _, rawFormat := range formats {
		format, ok := rawFormat.(map[string]any)
		if !ok {
			continue
		}
		if subURL := strings.TrimSpace(stringify(format["url"])); subURL != "" {
			return subURL
		}
	}
	return ""
}

func fetchYouTubeSubtitleText(subURL string) string {
	req, err := http.NewRequest(http.MethodGet, subURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return ""
	}
	var parsed any
	if json.Unmarshal(raw, &parsed) == nil {
		chunks := make([]string, 0, 256)
		collectYouTubeJSONCaptionStrings(parsed, &chunks)
		if len(chunks) > 0 {
			return normalizeCaptionLines(chunks)
		}
	}
	return cleanYouTubeCaptionText(string(raw))
}

func collectYouTubeJSONCaptionStrings(value any, chunks *[]string) {
	switch cast := value.(type) {
	case map[string]any:
		if rawText, ok := cast["utf8"]; ok {
			if text := strings.TrimSpace(stringify(rawText)); text != "" {
				*chunks = append(*chunks, text)
			}
		}
		for _, child := range cast {
			collectYouTubeJSONCaptionStrings(child, chunks)
		}
	case []any:
		for _, child := range cast {
			collectYouTubeJSONCaptionStrings(child, chunks)
		}
	}
}

func cleanYouTubeCaptionText(raw string) string {
	raw = strings.ReplaceAll(raw, "\r", "\n")
	raw = htmlTagPattern.ReplaceAllString(raw, " ")
	raw = html.UnescapeString(raw)
	lines := strings.Split(raw, "\n")
	chunks := make([]string, 0, len(lines))
	timestampPattern := regexp.MustCompile(`\d{1,2}:\d{2}:\d{2}\.\d{3}\s+-->|^\d{1,2}:\d{2}\.\d{3}\s+-->`)
	for _, line := range lines {
		cleaned := strings.TrimSpace(line)
		if cleaned == "" || cleaned == "WEBVTT" || cleaned == "NOTE" {
			continue
		}
		if strings.HasPrefix(cleaned, "Kind:") || strings.HasPrefix(cleaned, "Language:") {
			continue
		}
		if timestampPattern.MatchString(cleaned) || regexp.MustCompile(`^\d+$`).MatchString(cleaned) {
			continue
		}
		if strings.Contains(cleaned, "align:") || strings.Contains(cleaned, "position:") {
			continue
		}
		chunks = append(chunks, cleaned)
	}
	return normalizeCaptionLines(chunks)
}

func normalizeCaptionLines(lines []string) string {
	seenPrevious := ""
	cleanedLines := make([]string, 0, len(lines))
	for _, line := range lines {
		cleaned := strings.TrimSpace(strings.ReplaceAll(line, "\n", " "))
		cleaned = htmlSpacePattern.ReplaceAllString(cleaned, " ")
		if cleaned == "" || cleaned == seenPrevious {
			continue
		}
		seenPrevious = cleaned
		cleanedLines = append(cleanedLines, cleaned)
	}
	return strings.TrimSpace(strings.Join(cleanedLines, " "))
}

func youtubeFallbackText(meta map[string]any) string {
	parts := []string{
		strings.TrimSpace(stringify(meta["title"])),
		strings.TrimSpace(stringify(meta["channel"])),
		strings.TrimSpace(stringify(meta["description"])),
	}
	joined := strings.Join(parts, "\n")
	return truncateRunes(strings.TrimSpace(htmlSpacePattern.ReplaceAllString(joined, " ")), 24000)
}

func pickLastThumbnailURL(value any) string {
	thumbnails, ok := value.([]any)
	if !ok {
		return ""
	}
	for i := len(thumbnails) - 1; i >= 0; i-- {
		item, ok := thumbnails[i].(map[string]any)
		if !ok {
			continue
		}
		if thumbURL := strings.TrimSpace(stringify(item["url"])); thumbURL != "" {
			return thumbURL
		}
	}
	return ""
}

func formatDurationSeconds(value any) string {
	seconds, err := strconv.Atoi(strings.TrimSpace(stringify(value)))
	if err != nil || seconds <= 0 {
		return ""
	}
	minutes := seconds / 60
	remaining := seconds % 60
	if minutes >= 60 {
		hours := minutes / 60
		return strconv.Itoa(hours) + ":" + twoDigit(minutes%60) + ":" + twoDigit(remaining)
	}
	return strconv.Itoa(minutes) + ":" + twoDigit(remaining)
}

func twoDigit(value int) string {
	if value < 10 {
		return "0" + strconv.Itoa(value)
	}
	return strconv.Itoa(value)
}

func firstNonEmptyLocal(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (s *Service) handleTranslate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	text := strings.TrimSpace(stringify(req["text"]))
	if text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "번역할 텍스트가 없습니다."})
		return
	}

	translated, err := s.translateToKorean(text, stringify(req["text_provider"]))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "번역 실패: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"translated":      translated,
		"original_length": len(text),
	})
}

func (s *Service) handleSearchGlobal(w http.ResponseWriter, r *http.Request) {
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "키워드를 입력하세요."})
		return
	}

	enKeyword := keyword
	if regexp.MustCompile(`[가-힣]`).MatchString(keyword) {
		if translated, err := s.translateKeywordToEnglish(keyword); err == nil {
			if translated != "" {
				enKeyword = translated
			}
		}
	}

	sources := make([]map[string]any, 0)
	seen := map[string]struct{}{}

	appendFeed := func(query string, kind string, limit int) {
		fetched, err := fetchGoogleNewsRSS(query)
		if err != nil {
			return
		}
		for _, item := range fetched {
			if _, exists := seen[item.Link]; exists {
				continue
			}
			seen[item.Link] = struct{}{}
			sources = append(sources, map[string]any{
				"title":    item.Title,
				"url":      item.Link,
				"source":   item.Source,
				"pub_date": item.PubDate,
				"language": "en",
				"type":     kind,
			})
			if len(sources) >= limit {
				return
			}
		}
	}

	appendFeed(enKeyword, "news", 15)
	appendFeed(enKeyword+" blog OR guide OR tips", "blog", 25)

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data": map[string]any{
			"keyword":      keyword,
			"en_keyword":   enKeyword,
			"sources":      sources,
			"source_count": len(sources),
		},
	})
}

func (s *Service) handleExtractKeyword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	text := strings.TrimSpace(stringify(req["text"]))
	if text == "" {
		writeJSON(w, http.StatusOK, map[string]any{"keyword": ""})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"keyword": extractKeywordFromTextGo(text)})
}

func (s *Service) handleExtractTags(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	text := strings.TrimSpace(stringify(req["text"]))
	if text == "" {
		writeJSON(w, http.StatusOK, map[string]any{"tags": ""})
		return
	}
	count := stringify(req["count"])
	if count == "" {
		count = "7"
	}
	countInt, _ := strconv.Atoi(count)
	if countInt <= 0 {
		countInt = 7
	}
	tags := s.extractTagsGo(text, countInt, stringify(req["text_provider"]))
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func (s *Service) handleExtractFilePath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	targetPath := strings.TrimSpace(stringify(req["path"]))
	if targetPath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "파일을 찾을 수 없습니다."})
		return
	}
	result, err := s.extractFilePathNative(targetPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleExtractFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	file, header, err := readFirstMultipartFile(r, "file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	defer file.Close()

	tempFile, err := os.CreateTemp("", "makeke-upload-*"+filepath.Ext(header.Filename))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath)

	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	tempFile.Close()

	result, err := s.extractFilePathNative(tempPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if filename := strings.TrimSpace(header.Filename); filename != "" {
		result["filename"] = filename
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) extractFilePathNative(path string) (map[string]any, error) {
	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return nil, errors.New("파일을 찾을 수 없습니다")
	}
	info, err := os.Stat(cleanPath)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, errors.New("폴더가 아니라 파일을 선택하세요")
	}
	raw, err := os.ReadFile(cleanPath)
	if err != nil {
		return nil, err
	}

	filename := filepath.Base(cleanPath)
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(filename)), ".")
	text := ""
	switch ext {
	case "txt", "md", "csv", "json", "html", "htm", "xml", "log":
		text = string(raw)
	default:
		text = string(raw)
		if strings.ContainsRune(text, '\x00') {
			return nil, errors.New("현재 Go 서버에서는 텍스트 기반 파일만 바로 추출할 수 있습니다")
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("파일에서 텍스트를 추출할 수 없습니다")
	}
	charCount := len([]rune(text))
	return map[string]any{
		"status":     "ok",
		"filename":   filename,
		"ext":        ext,
		"text":       truncateRunes(text, 20000),
		"char_count": charCount,
	}, nil
}

func (s *Service) handleUploadImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "multipart parse failed"})
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		files = r.MultipartForm.File["file"]
	}
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "업로드된 이미지가 없습니다."})
		return
	}

	uploadDir := filepath.Join(s.dataDir, "output", "user_images")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	uploaded := make([]map[string]any, 0)
	for _, header := range files {
		contentType := strings.ToLower(header.Header.Get("Content-Type"))
		if contentType != "" && !strings.HasPrefix(contentType, "image/") {
			continue
		}
		src, err := header.Open()
		if err != nil {
			continue
		}

		timestamp := time.Now().Format("20060102_150405_000000")
		safeName := sanitizeFilename(header.Filename)
		saveName := timestamp + "_" + safeName
		savePath := filepath.Join(uploadDir, saveName)

		dst, err := os.Create(savePath)
		if err != nil {
			src.Close()
			continue
		}
		size, err := io.Copy(dst, src)
		dst.Close()
		src.Close()
		if err != nil {
			_ = os.Remove(savePath)
			continue
		}

		uploaded = append(uploaded, map[string]any{
			"filename": header.Filename,
			"path":     "output/user_images/" + saveName,
			"url":      "/api/content/user-image/" + saveName,
			"size":     size,
		})
	}

	if len(uploaded) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "업로드된 이미지가 없습니다."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"images": uploaded,
	})
}

func (s *Service) handleFetchImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var urls []string
	if err := json.NewDecoder(r.Body).Decode(&urls); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	imageLists := make([]map[string]any, 0, len(urls))
	flat := make([]string, 0)
	seen := map[string]struct{}{}
	for _, rawURL := range urls {
		images := collectImagesForURL(rawURL, 8)
		imageLists = append(imageLists, map[string]any{"url": rawURL, "images": images})
		for _, imageURL := range images {
			if _, exists := seen[imageURL]; exists {
				continue
			}
			seen[imageURL] = struct{}{}
			flat = append(flat, imageURL)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "images": flat, "image_lists": imageLists})
}

func (s *Service) handleDeepScrape(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	result, err := scrapeArticleGo(stringify(req["url"]), stringify(req["title"]))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleScrapeArticle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	targetURL := strings.TrimSpace(stringify(req["url"]))
	if targetURL == "" || (!strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://")) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "올바른 URL을 입력하세요."})
		return
	}
	result, err := scrapeArticleWithPipelineStage(s.cfg, targetURL, strings.TrimSpace(stringify(req["title"])), strings.TrimSpace(stringify(req["only_stage"])))
	if err != nil {
		var pipelineErr scrapePipelineError
		if errors.As(err, &pipelineErr) {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"error": err.Error(),
				"data": map[string]any{
					"stages": appendStageMaps(pipelineErr.stages),
				},
			})
			return
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data":   result,
	})
}

func (s *Service) handleValidateArticleText(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	text := stringify(req["text"])
	title := strings.TrimSpace(stringify(req["title"]))
	urlValue := strings.TrimSpace(stringify(req["url"]))
	result := validateArticleTextGo(urlValue, title, text)
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleCollectFromPopup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}

	title := stringify(req["title"])
	text := stringify(req["text"])
	images, _ := req["images"].([]any)
	urlValue := stringify(req["url"])
	data := map[string]any{
		"title":        title,
		"text":         truncate(text, 10000),
		"images":       truncateSlice(images, 15),
		"url":          urlValue,
		"char_count":   len(text),
		"collected_at": time.Now().Format(time.RFC3339),
	}
	s.lastMu.Lock()
	s.last = data
	s.lastMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"status":      "ok",
		"char_count":  len(text),
		"image_count": len(images),
	})
}

func (s *Service) handleLastCollected(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	s.lastMu.Lock()
	defer s.lastMu.Unlock()
	if s.last == nil {
		writeJSON(w, http.StatusOK, map[string]any{"status": "empty"})
		return
	}
	data := s.last
	s.last = nil
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"data":   data,
	})
}

func (s *Service) handleGenerateSNS(w http.ResponseWriter, r *http.Request) {
	s.handleGenerateSNSGo(w, r)
}

func (s *Service) handleConvertNarration(w http.ResponseWriter, r *http.Request) {
	s.handleConvertNarrationGo(w, r)
}

func (s *Service) handleGenerateIGCaption(w http.ResponseWriter, r *http.Request) {
	s.handleGenerateIGCaptionGo(w, r)
}

func (s *Service) handlePromptPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req keywordContentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	result, err := s.buildPromptPreview(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleRefinePrompts(w http.ResponseWriter, r *http.Request) {
	s.handleRefinePromptsGo(w, r)
}

func (s *Service) handleGenerateContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req keywordContentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	result, err := s.generateKeywordContent(req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleGenerateCardnewsTexts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var raw map[string]any
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	payload, err := json.Marshal(raw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	var req keywordContentRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.Keyword) == "" {
		req.Keyword = strings.TrimSpace(stringify(raw["topic"]))
	}
	if req.CardnewsSlides <= 0 {
		req.CardnewsSlides = intFromAny(raw["count"])
	}
	if strings.TrimSpace(req.TextProvider) == "" {
		req.TextProvider = strings.TrimSpace(stringify(raw["text_provider"]))
	}
	if strings.TrimSpace(req.ImageProvider) == "" {
		req.ImageProvider = strings.TrimSpace(stringify(raw["image_provider"]))
	}
	if strings.TrimSpace(req.ImageModel) == "" {
		req.ImageModel = strings.TrimSpace(stringify(raw["image_model"]))
	}
	if len(req.ScrapedTexts) == 0 {
		if body := strings.TrimSpace(stringify(raw["body"])); body != "" {
			req.ScrapedTexts = []string{body}
		}
	}
	if strings.TrimSpace(req.Keyword) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "주제가 필요합니다."})
		return
	}
	if req.CardnewsSlides <= 0 {
		req.CardnewsSlides = 5
	}
	sourceSummary := s.buildSourceSummary(req)
	textCfg := s.resolveTextProvider(req.TextProvider)
	result, err := s.generateCardnewsTexts(req, sourceSummary, textCfg)
	if err != nil {
		result, err = s.generateFallbackCardnewsTexts(req, sourceSummary, textCfg, err)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleUserImage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	filename := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/content/user-image/"), "/")
	if filename == "" || strings.Contains(filename, "/") || strings.Contains(filename, `\`) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	target := filepath.Join(s.dataDir, "output", "user_images", filename)
	if _, err := os.Stat(target); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "이미지를 찾을 수 없습니다."})
		return
	}
	http.ServeFile(w, r, target)
}

func scrapeArticleGo(rawURL string, fallbackTitle string) (map[string]any, error) {
	if resolved := resolveGoogleNewsTarget(rawURL, fallbackTitle); resolved != "" && resolved != rawURL {
		rawURL = resolved
	}
	htmlText, finalURL, err := fetchHTMLDocument(rawURL, 15*time.Second)
	if err != nil {
		return nil, err
	}

	contentHTML := pickMainContentHTML(htmlText)
	text := cleanArticleText(contentHTML)
	if len(text) < 80 {
		text = cleanArticleText(htmlText)
	}
	if len(text) < 50 {
		return nil, errUnavailable("본문 수집은 되었지만 실제 콘텐츠 본문으로 판별되지 않았거나, 본문 수집에 실패했습니다.")
	}

	title := extractArticleTitle(htmlText)
	if strings.TrimSpace(title) == "" {
		title = strings.TrimSpace(fallbackTitle)
	}
	if title == "" {
		title = finalURL
	}

	images := collectArticleImages(finalURL, htmlText, contentHTML, 15)
	text = truncate(text, 8000)

	return map[string]any{
		"title":             title,
		"text":              text,
		"images":            images,
		"url":               finalURL,
		"char_count":        len(text),
		"method":            "go_html",
		"validation_reason": "",
	}, nil
}

func fetchHTMLDocument(targetURL string, timeout time.Duration) (string, string, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return "", targetURL, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "ko,en-US;q=0.9,en;q=0.8")

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", targetURL, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return "", targetURL, errUnavailable("페이지 요청 실패: HTTP " + resp.Status)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return "", targetURL, err
	}
	finalURL := targetURL
	if resp.Request != nil && resp.Request.URL != nil {
		finalURL = resp.Request.URL.String()
	}
	return string(body), finalURL, nil
}

func resolveGoogleNewsTarget(rawURL, fallbackTitle string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "news.google.com" || strings.TrimSpace(fallbackTitle) == "" {
		return rawURL
	}
	if discovered := discoverArticleURLByTitle(fallbackTitle); discovered != "" {
		return discovered
	}
	return rawURL
}

func discoverArticleURLByTitle(title string) string {
	query := strings.TrimSpace(title)
	query = strings.TrimSpace(strings.Split(query, " - ")[0])
	query = strings.TrimSpace(strings.Split(query, " | ")[0])
	if query == "" {
		return ""
	}

	searchURL := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(`"`+query+`"`)
	req, err := http.NewRequest(http.MethodGet, searchURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return ""
	}
	htmlText := string(body)
	linkPattern := regexp.MustCompile(`(?is)<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"`)
	for _, match := range linkPattern.FindAllStringSubmatch(htmlText, -1) {
		if len(match) < 2 {
			continue
		}
		candidate := strings.TrimSpace(html.UnescapeString(match[1]))
		if candidate == "" {
			continue
		}
		if parsed, err := url.Parse(candidate); err == nil {
			if uddg := strings.TrimSpace(parsed.Query().Get("uddg")); uddg != "" {
				candidate = uddg
			}
		}
		if isUsableArticleURL(candidate) {
			return candidate
		}
	}
	return ""
}

func isUsableArticleURL(rawURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	blockedHosts := []string{
		"news.google.com",
		"google.com",
		"www.google.com",
		"duckduckgo.com",
		"html.duckduckgo.com",
		"lh3.googleusercontent.com",
	}
	for _, blocked := range blockedHosts {
		if host == blocked {
			return false
		}
	}
	return true
}

func pickMainContentHTML(htmlText string) string {
	bestHTML := ""
	bestLen := 0
	for _, pattern := range mainArticlePatterns {
		matches := pattern.FindAllStringSubmatch(htmlText, -1)
		for _, match := range matches {
			if len(match) == 0 {
				continue
			}
			candidate := match[len(match)-1]
			cleaned := cleanArticleText(candidate)
			if len(cleaned) > bestLen {
				bestLen = len(cleaned)
				bestHTML = candidate
			}
		}
	}
	if bestHTML != "" {
		return bestHTML
	}
	return htmlText
}

func cleanArticleText(htmlText string) string {
	if strings.TrimSpace(htmlText) == "" {
		return ""
	}
	cleaned := htmlCommentPattern.ReplaceAllString(htmlText, " ")
	for _, pattern := range htmlStripTagPatterns {
		cleaned = pattern.ReplaceAllString(cleaned, " ")
	}
	cleaned = htmlBreakPattern.ReplaceAllString(cleaned, "\n")
	cleaned = htmlBlockEndPattern.ReplaceAllString(cleaned, "\n")
	cleaned = htmlTagPattern.ReplaceAllString(cleaned, " ")
	cleaned = html.UnescapeString(cleaned)

	lines := make([]string, 0, 128)
	seen := map[string]int{}
	for _, line := range strings.Split(cleaned, "\n") {
		line = htmlSpacePattern.ReplaceAllString(strings.TrimSpace(line), " ")
		if len(line) < 2 || isLikelyBoilerplateLine(line) {
			continue
		}
		seen[line]++
		if seen[line] > 2 {
			continue
		}
		lines = append(lines, line)
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func validateArticleTextGo(urlValue, title, text string) map[string]any {
	cleaned := cleanArticleText(text)
	if cleaned == "" {
		cleaned = strings.TrimSpace(text)
	}
	if len(cleaned) < 50 {
		return map[string]any{
			"status":       "ok",
			"valid":        false,
			"reason":       "본문 길이가 너무 짧습니다.",
			"cleaned_text": "",
			"url":          urlValue,
			"title":        title,
		}
	}

	lineCount := 0
	for _, line := range strings.Split(cleaned, "\n") {
		if strings.TrimSpace(line) != "" {
			lineCount++
		}
	}
	if lineCount < 2 && len(cleaned) < 180 {
		return map[string]any{
			"status":       "ok",
			"valid":        false,
			"reason":       "콘텐츠 본문으로 보기 어려운 짧은 텍스트입니다.",
			"cleaned_text": "",
			"url":          urlValue,
			"title":        title,
		}
	}

	boilerplateHits := 0
	for _, token := range []string{"로그인", "회원가입", "전체기사", "기사검색", "주요서비스", "매체정보", "본문 바로가기", "copyright"} {
		if strings.Contains(strings.ToLower(cleaned), strings.ToLower(token)) {
			boilerplateHits++
		}
	}
	if boilerplateHits >= 4 {
		return map[string]any{
			"status":       "ok",
			"valid":        false,
			"reason":       "반복되는 메뉴성 문구가 많아 본문으로 보기 어렵습니다.",
			"cleaned_text": "",
			"url":          urlValue,
			"title":        title,
		}
	}

	return map[string]any{
		"status":       "ok",
		"valid":        true,
		"reason":       "",
		"cleaned_text": truncate(cleaned, 8000),
		"url":          urlValue,
		"title":        title,
	}
}

func isLikelyBoilerplateLine(line string) bool {
	lowered := strings.ToLower(strings.TrimSpace(line))
	if lowered == "" {
		return true
	}
	boilerplates := []string{
		"로그인", "회원가입", "전체기사", "기사검색", "주요서비스", "매체정보",
		"본문 바로가기", "copyright", "all rights reserved", "구독", "댓글",
		"facebook", "instagram", "youtube", "twitter", "x.com",
	}
	for _, token := range boilerplates {
		if strings.Contains(lowered, strings.ToLower(token)) {
			return true
		}
	}
	return false
}

func extractArticleTitle(htmlText string) string {
	for _, key := range []string{"og:title", "twitter:title"} {
		if value := extractMetaContent(htmlText, key); value != "" {
			return value
		}
	}
	if matches := titlePattern.FindStringSubmatch(htmlText); len(matches) > 1 {
		return strings.TrimSpace(html.UnescapeString(matches[1]))
	}
	return ""
}

func extractMetaContent(htmlText string, key string) string {
	pattern := regexp.MustCompile(`(?is)<meta[^>]+(?:property|name)=["']` + regexp.QuoteMeta(key) + `["'][^>]+content=["']([^"']+)["'][^>]*>`)
	if matches := pattern.FindStringSubmatch(htmlText); len(matches) > 1 {
		return strings.TrimSpace(html.UnescapeString(matches[1]))
	}
	return ""
}

func collectArticleImages(pageURL, htmlText, contentHTML string, maxImages int) []string {
	candidates := make([]string, 0, maxImages)
	seen := map[string]bool{}
	appendCandidate := func(raw string) {
		imageURL := normalizeImageURL(pageURL, raw)
		if imageURL == "" || seen[imageURL] {
			return
		}
		seen[imageURL] = true
		candidates = append(candidates, imageURL)
	}

	for _, key := range []string{"og:image", "twitter:image"} {
		appendCandidate(extractMetaContent(htmlText, key))
	}
	for _, source := range []string{contentHTML, htmlText} {
		for _, matches := range imageURLPattern.FindAllStringSubmatch(source, -1) {
			if len(matches) > 1 {
				appendCandidate(matches[1])
			}
			if len(candidates) >= maxImages {
				return candidates
			}
		}
	}
	if len(candidates) > maxImages {
		return candidates[:maxImages]
	}
	return candidates
}

func collectImagesForURL(rawURL string, maxImages int) []string {
	htmlText, finalURL, err := fetchHTMLDocument(rawURL, 15*time.Second)
	if err != nil {
		return []string{}
	}
	contentHTML := pickMainContentHTML(htmlText)
	return collectArticleImages(finalURL, htmlText, contentHTML, maxImages)
}

func normalizeImageURL(pageURL, raw string) string {
	value := strings.TrimSpace(html.UnescapeString(raw))
	if value == "" || strings.HasPrefix(value, "data:") || strings.HasPrefix(value, "javascript:") {
		return ""
	}
	if strings.Contains(value, "{") || strings.Contains(value, "}") || strings.Contains(value, "=") && strings.Contains(value, "Url") {
		return ""
	}
	base, err := url.Parse(pageURL)
	if err != nil {
		return ""
	}
	ref, err := url.Parse(value)
	if err != nil {
		return ""
	}
	resolved := base.ResolveReference(ref).String()
	lowered := strings.ToLower(resolved)
	if strings.Contains(lowered, "logo") || strings.Contains(lowered, "icon") || strings.Contains(lowered, "sprite") {
		return ""
	}
	return resolved
}

func errUnavailable(message string) error {
	return &contentUnavailableError{message: message}
}

type contentUnavailableError struct {
	message string
}

func (e *contentUnavailableError) Error() string {
	return e.message
}

func fetchGoogleNewsRSS(query string) ([]googleNewsItem, error) {
	hl, gl, ceid := googleNewsLocale(query)
	rssURL := "https://news.google.com/rss/search?q=" + url.QueryEscape(query) + "&hl=" + hl + "&gl=" + gl + "&ceid=" + ceid
	req, err := http.NewRequest(http.MethodGet, rssURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := (&http.Client{Timeout: 3500 * time.Millisecond}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errUnavailable("Google News RSS 응답 오류")
	}

	var feed googleNewsRSS
	if err := xml.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&feed); err != nil {
		return nil, err
	}
	return feed.Items, nil
}

func googleNewsLocale(query string) (string, string, string) {
	if regexp.MustCompile(`[가-힣]`).MatchString(query) {
		return "ko", "KR", "KR:ko"
	}
	return "en", "US", "US:en"
}

func readFirstMultipartFile(r *http.Request, key string) (multipart.File, *multipart.FileHeader, error) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		return nil, nil, err
	}
	files := r.MultipartForm.File[key]
	if len(files) == 0 {
		return nil, nil, http.ErrMissingFile
	}
	src, err := files[0].Open()
	if err != nil {
		return nil, nil, err
	}
	return src, files[0], nil
}

func sanitizeFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "image.png"
	}
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, `\`, "_")
	return name
}

func truncate(text string, limit int) string {
	if len(text) <= limit {
		return text
	}
	return text[:limit]
}

func truncateRunes(text string, limit int) string {
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return string(runes[:limit])
}

func truncateSlice(values []any, limit int) []any {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
