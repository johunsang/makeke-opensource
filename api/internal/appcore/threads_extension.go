package appcore

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const threadsExtensionMaxStalls = 24

type threadsCollectProgress func(message string, fields map[string]any)
type threadsPostHandler func(post threadCollectedPost, found int) error

func emitThreadsCollectProgress(progress threadsCollectProgress, message string, fields map[string]any) {
	if progress == nil {
		return
	}
	if fields == nil {
		fields = map[string]any{}
	}
	progress(message, fields)
}

func (s *Service) collectThreadsFromExtension(username string, limit int, progress threadsCollectProgress) ([]threadCollectedPost, error) {
	posts := []threadCollectedPost{}
	err := s.collectThreadsFromExtensionStreaming(username, limit, progress, func(post threadCollectedPost, _ int) error {
		posts = append(posts, post)
		return nil
	})
	return posts, err
}

func (s *Service) collectThreadsFromExtensionStreaming(username string, limit int, progress threadsCollectProgress, onPost threadsPostHandler) error {
	if s.bridge == nil || !s.bridge.connected() {
		return errors.New("스레드 글 수집은 Chrome 확장 프로그램 연결이 필수입니다. 설정 > 일반 설정 > Chrome 확장 연결에서 먼저 연결하세요")
	}
	limit = clampInt(limit, 1, 500)
	profileURL := "https://www.threads.com/@" + url.PathEscape(username)
	emitThreadsCollectProgress(progress, "Chrome 확장 프로그램으로 Threads 계정 화면을 엽니다.", map[string]any{"current": 0, "limit": limit})
	if _, err := s.bridge.command("openNewTab", map[string]any{"url": profileURL}, 25*time.Second); err != nil {
		return err
	}
	posts := []threadCollectedPost{}
	seen := map[string]struct{}{}
	if _, err := s.collectVisibleThreadPostsFromExtension(username, limit, &posts, seen, onPost); err != nil {
		return err
	}
	emitThreadsCollectProgress(progress, fmt.Sprintf("기존 Chrome 첫 화면에서 %d개를 확인했습니다.", len(posts)), map[string]any{"current": len(posts), "limit": limit})
	stalls := 0
	maxScrolls := clampInt(limit*4, 48, 600)
	for round := 0; round < maxScrolls && len(posts) < limit; round++ {
		before := len(posts)
		_, _ = s.bridge.command("scroll", map[string]any{"direction": "down", "amount": 1400 + minInt(round, 6)*180}, 8*time.Second)
		time.Sleep(900 * time.Millisecond)
		added, err := s.collectVisibleThreadPostsFromExtension(username, limit, &posts, seen, onPost)
		if err != nil {
			return err
		}
		if len(posts) == before {
			stalls++
		} else {
			stalls = 0
			emitThreadsCollectProgress(progress, fmt.Sprintf("기존 Chrome 스크롤 %d회차: 새 글 %d개, 총 %d개까지 바로 저장했습니다.", round+1, added, len(posts)), map[string]any{"current": len(posts), "limit": limit, "scroll": round + 1, "added": added})
		}
		if (round+1)%8 == 0 && stalls > 0 {
			emitThreadsCollectProgress(progress, fmt.Sprintf("기존 Chrome 스크롤 %d회차 진행 중입니다. 새 글 대기 %d회입니다.", round+1, stalls), map[string]any{"current": len(posts), "limit": limit, "scroll": round + 1, "stalls": stalls})
		}
		if stalls >= threadsExtensionMaxStalls {
			emitThreadsCollectProgress(progress, "기존 Chrome 화면에서 더 이상 새 스레드 글이 나타나지 않아 마무리합니다.", map[string]any{"current": len(posts), "limit": limit, "stalls": stalls})
			break
		}
	}
	return nil
}

func (s *Service) collectVisibleThreadPostsFromExtension(username string, limit int, posts *[]threadCollectedPost, seen map[string]struct{}, onPost threadsPostHandler) (int, error) {
	resp, err := s.bridge.command("collectThreads", map[string]any{"username": username, "limit": limit}, 20*time.Second)
	if err != nil {
		return 0, err
	}
	resultMap, _ := resp["result"].(map[string]any)
	if errText := strings.TrimSpace(stringify(resultMap["error"])); errText != "" {
		return 0, errors.New(errText)
	}
	rawCandidates := resultMap["posts"]
	candidates := []threadCollectedPost{}
	raw, _ := json.Marshal(rawCandidates)
	_ = json.Unmarshal(raw, &candidates)
	if len(candidates) == 0 {
		candidates = s.collectVisibleThreadPostsFromText(username, limit)
	}
	added := 0
	for _, post := range candidates {
		text := cleanThreadsCandidateText(post.Text)
		if !isLikelyThreadsPost(text) {
			continue
		}
		key := threadPostKey(post)
		if key == "" {
			key = text
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		post.Text = text
		*posts = append(*posts, post)
		added++
		if onPost != nil {
			if err := onPost(post, len(*posts)); err != nil {
				return added, err
			}
		}
		if len(*posts) >= limit {
			break
		}
	}
	return added, nil
}

func (s *Service) collectVisibleThreadPostsFromText(username string, limit int) []threadCollectedPost {
	resp, err := s.bridge.command("getText", map[string]any{}, 12*time.Second)
	if err != nil {
		return []threadCollectedPost{}
	}
	resultMap, _ := resp["result"].(map[string]any)
	rawText := stringify(resultMap["text"])
	return extractThreadPostsFromVisibleText(rawText, username, limit)
}

func threadsExtractPostsJS(username string, limit int) string {
	payload, _ := json.Marshal(map[string]any{"username": username, "limit": limit})
	return fmt.Sprintf(`(() => {
	  const input = %s;
	  const username = String(input.username || '').replace(/^@/, '');
	  const limit = Number(input.limit || 100);
	  const out = [];
	  const seen = new Set();
	  const norm = value => String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
	  const actionWords = /^(Like|Reply|Repost|Share|Send|Follow|Following|Translate|See translation|More|더 보기|좋아요|답글|공유|재게시|팔로우)$/i;
	  const clean = value => norm(value)
	    .split('\n')
	    .map(line => norm(line))
	    .filter(line => line && !actionWords.test(line))
	    .filter(line => !/^@?[A-Za-z0-9._]+$/.test(line))
	    .filter(line => !/^\d+\s*(분|시간|일|주|개월|년|m|h|d|w)$/i.test(line))
	    .join(' ')
	    .replace(new RegExp('^@?' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '')
	    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
	    .replace(/\b\d+\s*(?:likes?|replies|reposts?|views?)\b/gi, ' ')
	    .replace(/\s+/g, ' ')
	    .trim();
	  const addPost = (textValue, hrefValue, timeValue) => {
	    const text = clean(textValue);
	    const href = String(hrefValue || '');
	    const key = (href.split('?')[0] || text).trim();
	    if (!text || seen.has(key)) return;
	    seen.add(key);
	    out.push({ text, url: href, published_at: timeValue || '' });
	  };
	  const anchors = Array.from(document.querySelectorAll('a[href*="/post/"], a[href*="/@' + username + '/"]'));
	  for (const a of anchors) {
	    let node = a;
	    let picked = '';
	    let timeValue = '';
	    for (let depth = 0; depth < 12 && node; depth += 1, node = node.parentElement) {
	      const txt = norm(node.innerText || node.textContent || '');
	      if (txt.length > picked.length && txt.length < 4200) picked = txt;
	      const timeNode = node.querySelector && node.querySelector('time');
	      if (timeNode && !timeValue) timeValue = timeNode.getAttribute('datetime') || '';
	    }
	    addPost(picked, a.href || '', timeValue);
	    if (out.length >= limit) return out;
	  }
	  const containers = Array.from(document.querySelectorAll('article, [role="article"], main div[dir="auto"], main span[dir="auto"]'));
	  for (const el of containers) {
	    const text = norm(el.innerText || el.textContent || '');
	    if (text.length < 25 || text.length > 1800) continue;
	    const postLink = el.closest('article,[role="article"],div')?.querySelector?.('a[href*="/post/"]');
	    const timeNode = el.closest('article,[role="article"],div')?.querySelector?.('time');
	    addPost(text, postLink ? postLink.href : '', timeNode ? (timeNode.getAttribute('datetime') || '') : '');
	    if (out.length >= limit) return out;
	  }
	  if (out.length === 0) {
	    const text = norm(document.body?.innerText || '');
	    const lines = text.split('\n').map(line => norm(line)).filter(Boolean);
	    let buf = [];
	    const flush = () => {
	      const candidate = clean(buf.join(' '));
	      buf = [];
	      if (candidate.length >= 25 && candidate.length <= 1800) addPost(candidate, '', '');
	    };
	    for (const line of lines) {
	      if (actionWords.test(line) || /^@?[A-Za-z0-9._]+$/.test(line) || /^\d+\s*(분|시간|일|주|개월|년|m|h|d|w)$/i.test(line)) {
	        flush();
	        continue;
	      }
	      buf.push(line);
	      if (buf.join(' ').length > 500) flush();
	      if (out.length >= limit) return out;
	    }
	    flush();
	  }
	  return out;
	})()`, string(payload))
}

func extractThreadPostsFromVisibleText(rawText string, username string, limit int) []threadCollectedPost {
	lines := strings.Split(rawText, "\n")
	items := make([]threadCollectedPost, 0, limit)
	seen := map[string]struct{}{}
	buffer := []string{}
	flush := func() {
		candidate := cleanThreadsCandidateText(strings.Join(buffer, " "))
		buffer = []string{}
		candidate = stripThreadChromeNoise(candidate, username)
		if !isLikelyThreadsPost(candidate) {
			return
		}
		key := truncateRunes(candidate, 500)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		items = append(items, threadCollectedPost{Text: candidate})
	}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			flush()
			continue
		}
		if isThreadChromeNoiseLine(line, username) {
			flush()
			continue
		}
		buffer = append(buffer, line)
		if len([]rune(strings.Join(buffer, " "))) > 520 {
			flush()
		}
		if len(items) >= limit {
			break
		}
	}
	flush()
	if len(items) > limit {
		return items[:limit]
	}
	return items
}

func isThreadChromeNoiseLine(line string, username string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return true
	}
	lower := strings.ToLower(trimmed)
	blocked := []string{"like", "reply", "repost", "share", "send", "follow", "following", "threads", "log in", "sign up", "더 보기", "좋아요", "답글", "공유", "팔로우"}
	for _, item := range blocked {
		if lower == item {
			return true
		}
	}
	if strings.EqualFold(strings.TrimPrefix(trimmed, "@"), strings.TrimPrefix(username, "@")) {
		return true
	}
	if regexp.MustCompile(`^\d+\s*(분|시간|일|주|개월|년|m|h|d|w)$`).MatchString(trimmed) {
		return true
	}
	if regexp.MustCompile(`^@?[A-Za-z0-9._]{2,}$`).MatchString(trimmed) {
		return true
	}
	return false
}

func stripThreadChromeNoise(text string, username string) string {
	text = strings.TrimSpace(text)
	text = regexp.MustCompile(`(?i)^@?`+regexp.QuoteMeta(strings.TrimPrefix(username, "@"))+`\s+`).ReplaceAllString(text, "")
	text = regexp.MustCompile(`(?i)\b(like|reply|repost|share|send|follow|following)\b`).ReplaceAllString(text, " ")
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func threadPostKey(post threadCollectedPost) string {
	value := strings.TrimSpace(post.URL)
	if value != "" {
		value = strings.Split(value, "?")[0]
		value = strings.TrimRight(value, "/")
		return value
	}
	return truncateRunes(cleanThreadsCandidateText(post.Text), 500)
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
