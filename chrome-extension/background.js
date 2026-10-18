// 마케케 — Background Service Worker (최적화)
let ws = null, connectedTabId = null, isDebugging = false, debugTabId = null, debugTimer = null;
const DEBUGGER_IDLE_DETACH_MS = 500; // CDP 완료 후 즉시 detach
const tabCommandQueues = new Map();
let connectTimer = null;
let heartbeatTimer = null;
let idleDisconnectTimer = null;
let connectInFlight = false;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_ALARM_NAME = 'makekeReconnect';
const MAX_TIMER_RETRIES_BEFORE_ALARM = 4;
const BACKEND_HEALTH_URL = 'http://127.0.0.1:8818/api/browser/bridge-status';
const BACKEND_HEALTH_TIMEOUT_MS = 1500;
let wasEverConnected = false;
let coldRetries = 0;
const MAX_BRIDGE_MESSAGE_SIZE = 1024 * 1024;
const HEARTBEAT_INTERVAL_MS = 20000;  // 20초: MV3 서비스워커 idle timeout(30초) 전에 ping
const IDLE_DISCONNECT_MS = 180000;
const KEEP_CONNECTION_DURING_IDLE = true;

// ═══ CDP 디버거 (permissions에 선언됨 — 항상 사용 가능) ═══
let hasDebugger = true;

function requestDebuggerPermission() {
  return Promise.resolve(true);
}

function scheduleDetach() {
  if (!hasDebugger) return;
  if (debugTimer) clearTimeout(debugTimer);
  debugTimer = setTimeout(() => {
    if (isDebugging && debugTabId) {
      try { chrome.debugger.detach({ tabId: debugTabId }); } catch(e) {}
      isDebugging = false; debugTabId = null;
    }
  }, DEBUGGER_IDLE_DETACH_MS);
}

function sendCDP(tabId, method, params) {
  scheduleDetach();
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, r => {
      const e = chrome.runtime.lastError;
      e ? reject(new Error(e.message)) : resolve(r);
    });
  });
}

function ensureDebugger(tabId) {
  const doAttach = () => new Promise((resolve, reject) => {
    if (isDebugging && debugTabId === tabId) { scheduleDetach(); return resolve(); }
    const attach = () => chrome.debugger.attach({ tabId }, "1.3", () => {
      const e = chrome.runtime.lastError;
      if (e && !e.message.includes("Already attached")) return reject(new Error(e.message));
      isDebugging = true; debugTabId = tabId;
      scheduleDetach();
      resolve();
    });
    if (isDebugging && debugTabId !== tabId) {
      chrome.debugger.detach({ tabId: debugTabId }, () => { isDebugging = false; debugTabId = null; attach(); });
    } else attach();
  });
  if (hasDebugger) return doAttach();
  return requestDebuggerPermission().then(ok => {
    if (!ok) throw new Error('debugger permission denied');
    return doAttach();
  });
}

if (chrome.debugger?.onDetach) {
  chrome.debugger.onDetach.addListener(s => { if (s?.tabId === debugTabId) { isDebugging = false; debugTabId = null; } });
}

// ═══ WebSocket ═══
let retryCount = 0;

function requestPermissions() { return Promise.resolve(true); }

function updateBadge(connected) {
  chrome.action.setBadgeText({ text: connected ? "ON" : "" });
  if (connected) chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
}

function clearReconnectAlarm() {
  chrome.alarms.clear(RECONNECT_ALARM_NAME);
}

function armReconnectAlarm(delayInMinutes = 1) {
  chrome.alarms.create(RECONNECT_ALARM_NAME, {
    delayInMinutes,
    periodInMinutes: 1,
  });
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function stopIdleDisconnectTimer() {
  if (idleDisconnectTimer) {
    clearTimeout(idleDisconnectTimer);
    idleDisconnectTimer = null;
  }
}

function scheduleIdleDisconnect() {
  if (KEEP_CONNECTION_DURING_IDLE) {
    stopIdleDisconnectTimer();
    return;
  }
  stopIdleDisconnectTimer();
  idleDisconnectTimer = setTimeout(() => {
    const queueBusy = tabCommandQueues.size > 0;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      stopIdleDisconnectTimer();
      return;
    }
    if (isDebugging || queueBusy) {
      scheduleIdleDisconnect();
      return;
    }
    console.log('[Makeke] 유휴 상태 감지 — WebSocket 연결 정리');
    ws._manualClose = true;
    try { ws.close(); } catch (_) {}
  }, IDLE_DISCONNECT_MS);
}

function touchConnectionActivity() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    scheduleIdleDisconnect();
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }
    safeWsSend({ type: 'ping', ts: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);
}

function safeWsSend(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (message.length > MAX_BRIDGE_MESSAGE_SIZE) {
      console.warn('[Makeke] 메시지 크기 초과로 전송 중단');
      return false;
    }
    ws.send(message);
    touchConnectionActivity();
    return true;
  } catch (e) {
    console.warn('[Makeke] WebSocket 전송 실패', e);
    return false;
  }
}

function isScriptableUrl(url) {
  const value = String(url || '').trim().toLowerCase();
  return value.startsWith('http://') || value.startsWith('https://');
}

function isUsableTab(tab) {
  return !!(tab && tab.id && isScriptableUrl(tab.url));
}

function selectBestTab(tabs) {
  if (!Array.isArray(tabs) || !tabs.length) return null;
  return tabs.find(tab => isUsableTab(tab) && tab.active)
    || tabs.find(tab => isUsableTab(tab))
    || null;
}

function refreshConnectedTabFromChrome() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
      const best = selectBestTab(tabs);
      if (best?.id) {
        connectedTabId = best.id;
        resolve(connectedTabId);
        return;
      }
      chrome.tabs.query({}, allTabs => {
        const fallback = selectBestTab(allTabs);
        if (fallback?.id) connectedTabId = fallback.id;
        else connectedTabId = null;
        resolve(connectedTabId);
      });
    });
  });
}

async function isBackendHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKEND_HEALTH_URL}?ts=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    if (payload && typeof payload === 'object' && 'bridge_ready' in payload) {
      return !!payload.bridge_ready;
    }
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleReconnect(reason = 'retry') {
  if (connectTimer) return;
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  if (retryCount >= MAX_TIMER_RETRIES_BEFORE_ALARM) {
    console.log(`[Makeke] ${reason} — 짧은 재시도 한도 도달, 1분 주기 재연결 대기`);
    armReconnectAlarm(1);
    return;
  }
  const attempt = Math.max(0, retryCount++);
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, Math.min(attempt, 4))) + Math.floor(Math.random() * 400);
  connectTimer = setTimeout(() => {
    connectTimer = null;
    connect();
  }, delay);
}

async function connect(force = false) {
  if (connectInFlight) return;
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
  connectInFlight = true;
  console.log('[Makeke] connect() called, force=' + force);
  try {
    if (!force) {
      const healthy = await isBackendHealthy();
      console.log('[Makeke] isBackendHealthy=' + healthy);
      if (!healthy) {
        coldRetries++;
        scheduleReconnect('backend-unhealthy');
        return;
      }
    }
    try {
      console.log('[Makeke] Creating WebSocket to ws://127.0.0.1:9878...');
      ws = new WebSocket("ws://127.0.0.1:9878");
    } catch(e) {
      console.error('[Makeke] WebSocket create failed:', e);
      scheduleReconnect('ws-create-failed');
      return;
    }
  } finally {
    connectInFlight = false;
  }
  ws.onopen = () => {
    retryCount = 0;
    wasEverConnected = true;
    coldRetries = 0;
    clearReconnectAlarm();
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });  // 24초 간격
    updateBadge(true);
    startHeartbeat();
    // 연결 직후 즉시 ping 전송 — 서비스워커 활성 상태 유지
    safeWsSend({ type: 'ping' });
    scheduleIdleDisconnect();
    console.log('[Makeke] WebSocket 연결 성공');
    requestPermissions();
    refreshConnectedTabFromChrome();
    // 프로필 이메일 전송 — 서버가 원하는 프로필인지 확인용
    if (chrome.identity?.getProfileUserInfo) {
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, info => {
        safeWsSend({ type: 'identify', email: info?.email || '', extensionId: chrome.runtime.id, tabId: connectedTabId || 0 });
      });
    } else {
      safeWsSend({ type: 'identify', email: '', extensionId: chrome.runtime.id, tabId: connectedTabId || 0 });
    }
  };
  ws._openedAt = Date.now();
  ws.onclose = () => {
    if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
    const manual = ws?._manualClose;
    const openedAt = ws?._openedAt || 0;
    const hadConnection = wasEverConnected;
    ws = null;
    if (isDebugging && debugTabId) { try { chrome.debugger.detach({ tabId: debugTabId }); } catch(e) {} isDebugging = false; debugTabId = null; }
    // keepAlive 알람은 유지 — 자동 재연결용
    stopHeartbeat();
    stopIdleDisconnectTimer();
    updateBadge(false);
    if (!manual) {
      if (openedAt && Date.now() - openedAt < 2000) {
        retryCount = Math.max(retryCount, 3);
      }
      // 이전에 연결된 적 있으면 재연결 시도, 없으면 cold retry 제한
      if (hadConnection) {
        wasEverConnected = false; // 재연결 실패하면 다시 cold 모드로
      }
      scheduleReconnect('socket-closed');
    }
  };
  ws.onerror = (e) => { console.warn('[Makeke] WS error', e?.message || ''); };
  ws.onmessage = e => {
    let id = null;
    try {
      touchConnectionActivity();
      const msg = JSON.parse(e.data); id = msg.id;
      if (msg.type === 'rejected') {
        console.log('[Makeke] 서버가 연결 거부 — 다른 프로필이 활성화됨');
        ws._manualClose = true;
        ws.close();
        return;
      }
      if (msg.type === 'pong') return;
      handleCommand(msg)
        .then(r => safeWsSend({ id, result: r }))
        .catch(err => { if (id) safeWsSend({ id, error: err.message }); });
    } catch(err) { if (id) safeWsSend({ id, error: err.message }); }
  };
}

// 시작/설치 시 1회 연결 시도 — 서버 없으면 대기 모드
function ensureAutoConnect() {
  console.log('[Makeke] ensureAutoConnect() called');
  retryCount = 0;
  coldRetries = 0;
  clearReconnectAlarm();
  // keepAlive 알람 항상 유지 — 연결 끊겨도 자동 재연결
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
  connect();
}

console.log('[Makeke] Service worker starting...');
ensureAutoConnect();
chrome.runtime.onStartup?.addListener(() => ensureAutoConnect());
chrome.runtime.onInstalled?.addListener(() => ensureAutoConnect());

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'keepAlive') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // 연결 끊김 → 자동 재연결 시도
      console.log('[Makeke] keepAlive: 연결 끊김 감지, 재연결 시도...');
      connect();
    } else {
      safeWsSend({ type: 'ping' });
      touchConnectionActivity();
    }
    return;
  }
  if (a.name === RECONNECT_ALARM_NAME) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      clearReconnectAlarm();
      return;
    }
    connect();
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const nextTabId = activeInfo?.tabId;
  if (!nextTabId) return;
  chrome.tabs.get(nextTabId, tab => {
    if (chrome.runtime.lastError || !isUsableTab(tab)) {
      refreshConnectedTabFromChrome();
      return;
    }
    connectedTabId = nextTabId;
    touchConnectionActivity();
  });
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (connectedTabId === tabId) {
    connectedTabId = null;
    if (ws && ws.readyState === WebSocket.OPEN) refreshConnectedTabFromChrome();
  }
  if (debugTabId === tabId) {
    isDebugging = false;
    debugTabId = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (connectedTabId !== tabId) return;
  if (changeInfo.url && !isScriptableUrl(changeInfo.url)) {
    connectedTabId = null;
    refreshConnectedTabFromChrome();
    return;
  }
  if (!isUsableTab(tab)) {
    refreshConnectedTabFromChrome();
  }
});

chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  refreshConnectedTabFromChrome().finally(() => touchConnectionActivity());
});

// ═══ 팝업 메시지 ═══
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.action === 'getStatus') {
    const connected = ws?.readyState === WebSocket.OPEN;
    // 확인 시 배지 업데이트
    updateBadge(connected);
    send({ connected });
  }
  else if (msg.action === 'retryConnection') {
    retryCount = 0;
    coldRetries = 0;
    clearReconnectAlarm();
    connect(true);
    setTimeout(() => {
      const connected = ws?.readyState === WebSocket.OPEN;
      updateBadge(connected);
      send({ connected });
    }, 2000);
    return true;
  }
  else if (msg.action === 'scrapeInstagram') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url?.includes('instagram.com')) {
          send({ success: false, error: 'Instagram 페이지를 열어주세요' });
          return;
        }
        // 1) DOM에서 이미지/영상 + shortcode 수집
        const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeInstagramDOM });
        const data = results?.[0]?.result;
        if (!data?.success) {
          send({ success: false, error: data?.error || '스크래핑 실패' });
          return;
        }
        // 2) 각 게시물의 전체 캡션을 GraphQL API로 가져오기 (실패해도 진행)
        try {
          data.posts = await enrichPostsWithCaptions(data.posts, tab.id);
        } catch (_) { /* GraphQL 보강 실패 — 기본 데이터로 진행 */ }

        const resp = await fetch('http://127.0.0.1:8818/apps/insight/api/instagram/save-scraped', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: data.profile, posts: data.posts })
        });
        const saved = await resp.json();
        send({ success: saved.success, count: saved.count || data.posts?.length || 0, username: data.profile?.username, error: saved.error });
      } catch (e) {
        send({ success: false, error: e.message });
      }
    })();
    return true;
  }
});

async function enrichPostsWithCaptions(posts, tabId) {
  const enrichable = posts.filter(p => p.shortcode && !p.shortcode.startsWith('img_') && !p.shortcode.startsWith('vid_'));
  if (enrichable.length === 0) return posts;

  for (const post of enrichable) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (shortcode) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', 'https://www.instagram.com/graphql/query', false);
          xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
          xhr.setRequestHeader('x-ig-app-id', '936619743392459');
          xhr.send('variables=' + encodeURIComponent(JSON.stringify({ shortcode })) + '&doc_id=8845758582119845');
          if (xhr.status !== 200) return null;
          try {
            const json = JSON.parse(xhr.responseText);
            const media = json?.data?.xdt_shortcode_media;
            if (!media) return null;
            const mediaUrls = [];
            if (media.display_url) mediaUrls.push(media.display_url);
            (media.edge_sidecar_to_children?.edges || []).forEach(edge => {
              const node = edge?.node || {};
              if (node.display_url) mediaUrls.push(node.display_url);
              if (node.video_url) mediaUrls.push(node.video_url);
            });
            return {
              caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || '',
              like_count: media.edge_media_preview_like?.count || 0,
              comment_count: media.edge_media_to_comment?.count || 0,
              display_url: media.display_url || '',
              media_urls: [...new Set(mediaUrls.filter(Boolean))],
              is_video: !!media.is_video,
              taken_at: media.taken_at_timestamp || 0
            };
          } catch { return null; }
        },
        args: [post.shortcode],
        world: 'MAIN'
      });
      const detail = results?.[0]?.result;
      if (detail) {
        if (detail.caption) post.caption = detail.caption;
        if (detail.like_count) post.like_count = detail.like_count;
        if (detail.comment_count) post.comment_count = detail.comment_count;
        if (detail.display_url) post.thumbnail_url = detail.display_url;
        if (detail.media_urls?.length) post.media_urls = detail.media_urls;
        if (detail.is_video) post.media_type = 'video';
        else if (detail.media_urls?.length > 1) post.media_type = 'carousel';
        if (detail.taken_at) post.taken_at = detail.taken_at;
      }
    } catch { /* skip */ }
  }
  return posts;
}

function scrapeInstagramDOM() {
  try {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const username = (pathParts[0] || '').replace(/^@/, '') || 'unknown';
    const seen = new Set();
    const posts = [];

    // 1) /p/ 또는 /reel/ 링크 안의 이미지
    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]').forEach(el => {
      const href = el.getAttribute('href') || '';
      const m = href.match(/\/(p|reel)\/([\w-]+)/);
      if (!m || seen.has(m[2])) return;
      seen.add(m[2]);
      const img = el.querySelector('img');
      const video = el.querySelector('video');
      const thumbUrl = img?.src || video?.poster || '';
      if (!thumbUrl) return;
      posts.push({
        shortcode: m[2],
        thumbnail_url: thumbUrl,
        media_urls: [thumbUrl],
        caption: img?.alt || '',
        media_type: video ? 'video' : 'photo',
        permalink: 'https://www.instagram.com' + href
      });
    });

    // 2) 링크 없어도 Instagram CDN 이미지 수집 (scontent, cdninstagram)
    if (posts.length === 0) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || '';
        if (!src || seen.has(src)) return;
        if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
        if (img.closest('header') || img.closest('nav')) return;
        if (!src.includes('scontent') && !src.includes('cdninstagram')) return;
        seen.add(src);
        posts.push({
          shortcode: 'img_' + seen.size + '_' + Date.now().toString(36),
          thumbnail_url: src,
          media_urls: [src],
          caption: img.alt || '',
          media_type: 'photo',
          permalink: window.location.href
        });
      });
      // 영상도 수집
      document.querySelectorAll('video').forEach(vid => {
        const src = vid.src || vid.querySelector('source')?.src || '';
        const poster = vid.poster || '';
        if (!src && !poster) return;
        if (seen.has(src || poster)) return;
        seen.add(src || poster);
        posts.push({
          shortcode: 'vid_' + seen.size + '_' + Date.now().toString(36),
          thumbnail_url: poster || src,
          media_urls: [poster || src],
          caption: '',
          media_type: 'video',
          permalink: window.location.href
        });
      });
    }

    if (posts.length === 0) return { success: false, error: '이미지/영상을 찾을 수 없습니다. 게시물이 보이는 페이지에서 시도해주세요.' };
    return { success: true, profile: { username }, posts };
  } catch (e) { return { success: false, error: e.message }; }
}

// ═══ 사이트 제외 ═══
function isExcluded(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    try {
      const host = new URL(url).hostname;
      chrome.storage.local.get({ excludedSites: [] }, d => resolve(d.excludedSites.includes(host)));
    } catch { resolve(false); }
  });
}

// ═══ 탭 헬퍼 ═══
function getTabId() {
  return new Promise((resolve, reject) => {
    if (connectedTabId) {
      chrome.tabs.get(connectedTabId, t => {
        if (chrome.runtime.lastError || !isUsableTab(t)) { connectedTabId = null; findTab(resolve, reject); }
        else resolve(connectedTabId);
      });
    } else findTab(resolve, reject);
  });
}
function findTab(resolve, reject) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const current = selectBestTab(tabs);
    if (current?.id) { connectedTabId = current.id; resolve(current.id); return; }
    // currentWindow 없으면 lastFocusedWindow 시도
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs2 => {
      const focused = selectBestTab(tabs2);
      if (focused?.id) { connectedTabId = focused.id; resolve(focused.id); return; }
      // 그것도 없으면 아무 탭이나
      chrome.tabs.query({}, all => {
        const fallback = selectBestTab(all);
        if (fallback?.id) { connectedTabId = fallback.id; resolve(fallback.id); return; }
        reject(new Error("실행 가능한 브라우저 탭 없음"));
      });
    });
  });
}

function enqueueTabCommand(tabId, task) {
  const prev = tabCommandQueues.get(tabId) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (tabCommandQueues.get(tabId) === next) tabCommandQueues.delete(tabId);
    });
  tabCommandQueues.set(tabId, next);
  return next;
}

function withActiveTab(task) {
  return getTabId().then(tid => enqueueTabCommand(tid, () => task(tid)));
}

// ═══ 명령 라우터 ═══
function handleCommand(msg) {
  const cmd = msg.command, p = msg.params || {};
  const allowed = ["getTabs", "selectTab", "navigate", "openNewTab"];
  if (!allowed.includes(cmd)) {
    return getTabId().then(tid => new Promise(r => chrome.tabs.get(tid, t => r(t?.url || "")))).then(url =>
      isExcluded(url).then(ex => ex ? { error: "제외된 사이트", excluded: true } : route(cmd, p))
    ).catch(err => {
      // 탭 없으면 에러 반환 (무한 대기 방지)
      if (cmd === 'evaluate' || cmd === 'getText' || cmd === 'getHtml') {
        return { error: '실행 가능한 탭 없음: ' + (err.message || ''), result: null };
      }
      return route(cmd, p);
    });
  }
  return route(cmd, p);
}

function route(cmd, p) {
  const cmds = {
    getTabs: () => new Promise(r => chrome.tabs.query({}, tabs => r(tabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active }))))),
    selectTab: () => new Promise(r => chrome.tabs.update(p.tabId, { active: true }, () => { connectedTabId = p.tabId; r({ success: true }); })),
    navigate: () => getTabId().catch(() => {
      // 활성 탭 없으면 새 탭 생성
      return new Promise((r, j) => chrome.tabs.create({ url: p.url, active: true }, tab => {
        if (chrome.runtime.lastError) return j(new Error(chrome.runtime.lastError.message));
        connectedTabId = tab.id;
        r(tab.id);
      }));
    }).then(tid => new Promise(r => {
      chrome.tabs.update(tid, { url: p.url });
      const fn = (id, info) => { if (id === tid && info.status === "complete") { chrome.tabs.onUpdated.removeListener(fn); r({ success: true }); } };
      chrome.tabs.onUpdated.addListener(fn);
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); r({ success: true, timeout: true }); }, 15000);
    })),
    openNewTab: () => new Promise(r => {
      chrome.tabs.create({ url: p.url, active: true }, tab => {
        connectedTabId = tab.id;
        // 창도 포커스
        chrome.windows.update(tab.windowId, { focused: true });
        const fn = (id, info) => { if (id === tab.id && info.status === "complete") { chrome.tabs.onUpdated.removeListener(fn); connectedTabId = tab.id; r({ success: true, tabId: tab.id }); } };
        chrome.tabs.onUpdated.addListener(fn);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(fn); connectedTabId = tab.id; r({ success: true, tabId: tab.id, timeout: true }); }, 15000);
      });
    }),
    screenshot: () => new Promise(r => chrome.tabs.captureVisibleTab(null, { format: "png" }, d => r({ screenshot: d }))),
    click: () => execTab(p.selector, clickFn),
    fill: () => execTab2(p.selector, p.value, fillFn),
    press: () => execTab(p.key, pressFn),
    scroll: () => withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid }, func: (d, a) => { a = a || 500; const m = { up: [0, -a], down: [0, a], left: [-a, 0], right: [a, 0] }; window.scrollBy(...(m[d] || [0, a])); return { success: true, scrollY: window.scrollY }; }, args: [p.direction, p.amount] }).then(r => r[0].result)),
    getText: () => withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid }, func: () => document.body.innerText }).then(r => ({ text: r[0].result || "" }))),
    getHtml: () => withActiveTab(tid => { const lim = Math.min(Number(p.maxChars) || 200000, 2000000); return chrome.scripting.executeScript({ target: { tabId: tid }, func: m => { const h = document.documentElement?.outerHTML || ""; return h.length > m ? h.slice(0, m) : h; }, args: [lim] }).then(r => ({ html: r[0].result || "" })); }),
    collectThreads: () => withActiveTab(tid => chrome.scripting.executeScript({
      target: { tabId: tid, allFrames: false },
      func: collectThreadsFn,
      args: [p.username || '', p.limit || 100]
    }).then(r => r?.[0]?.result || { posts: [] })),
    evaluate: () => withActiveTab(tid => {
      // 방법1: CDP Runtime.evaluate (CSP 우회 — 가장 안정적)
      return ensureDebugger(tid).then(() =>
        sendCDP(tid, "Runtime.evaluate", {
          expression: p.script,
          returnByValue: true,
          awaitPromise: true,
        })
      ).then(r => {
        if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text || "CDP eval error");
        return { result: r?.result?.value };
      }).catch(cdpErr => {
        // 방법2: script 태그 주입 (MAIN world)
        return chrome.scripting.executeScript({
          target: { tabId: tid, allFrames: false }, world: "MAIN",
          func: code => {
            return new Promise(resolve => {
              const id = '__makeke_eval_' + Date.now() + '_' + Math.random().toString(36).slice(2);
              const script = document.createElement('script');
              script.textContent = `try { window["${id}"] = (${code.trim().endsWith(';') ? code.slice(0,-1) : code}); } catch(e) { window["${id}"] = {__eval_error: e.message}; }`;
              document.documentElement.appendChild(script);
              script.remove();
              const val = window[id];
              delete window[id];
              resolve(val);
            });
          }, args: [p.script]
        }).then(r => {
          const v = r?.[0]?.result;
          if (v === null || v === undefined) throw new Error("null result");
          if (v && typeof v === 'object' && v.__eval_error) throw new Error(v.__eval_error);
          return { result: v };
        });
      }).catch(() => {
        // 방법3: ISOLATED world에서 eval (최후 수단)
        return chrome.scripting.executeScript({
          target: { tabId: tid, allFrames: false },
          func: c => { try { return eval(c); } catch(e) { return { __eval_error: e.message }; } },
          args: [p.script]
        }).then(r => {
          const v = r?.[0]?.result;
          return v?.__eval_error ? { error: v.__eval_error } : { result: v };
        });
      }).catch(() => ({ error: "evaluate failed on all methods" }));
    }),
    cdpUploadFile: () => withActiveTab(tid => ensureDebugger(tid).then(() => {
      // 1. 파일 input 찾기
      return sendCDP(tid, "Runtime.evaluate", {
        expression: `(() => {
          const inputs = document.querySelectorAll('${(p.selector || 'input[type="file"]').replace(/'/g, "\\'")}');
          for (const inp of inputs) { if (inp.type === 'file') return true; }
          return false;
        })()`,
        returnByValue: true
      }).then(() => {
        // 2. DOM.getDocument → querySelector로 노드 찾기
        return sendCDP(tid, "DOM.getDocument", { depth: 0 });
      }).then(doc => {
        return sendCDP(tid, "DOM.querySelector", {
          nodeId: doc.root.nodeId,
          selector: p.selector || 'input[type="file"]'
        });
      }).then(node => {
        if (!node || !node.nodeId) throw new Error("file input not found");
        // 3. DOM.setFileInputFiles로 파일 설정
        return sendCDP(tid, "DOM.setFileInputFiles", {
          files: p.files || [],
          nodeId: node.nodeId
        });
      }).then(() => ({ success: true, method: "cdp-setFileInputFiles" }));
    }).catch(err => ({ error: err.message || "cdpUploadFile failed" }))),
    cdpClick: () => withActiveTab(tid => ensureDebugger(tid).then(() =>
      sendCDP(tid, "Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 })
        .then(() => sendCDP(tid, "Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 }))
        .then(() => ({ success: true, method: "cdp" }))
    ).catch(() =>
      // CDP 실패 시 JS 폴백
      chrome.scripting.executeScript({ target: { tabId: tid, allFrames: false }, world: "MAIN", func: (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return { success: false };
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        el.focus?.();
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        return { success: true, method: "js", tag: el.tagName };
      }, args: [p.x, p.y] }).then(r => r[0]?.result)
    )),
    cdpType: () => withActiveTab(tid => ensureDebugger(tid).then(() =>
      sendCDP(tid, "Input.insertText", { text: p.text || '' })
        .then(() => ({ success: true, method: "cdp-insertText" }))
    ).catch(() => chrome.scripting.executeScript({ target: { tabId: tid, allFrames: false }, func: typeIntoActiveFn, args: [p.text] }).then(r => r[0].result))),
    cdpKey: () => withActiveTab(tid => ensureDebugger(tid).then(() => {
      const key = p.key || '';
      if (key === 'Enter') {
        return sendCDP(tid, "Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 13, key: "Enter" })
          .then(() => sendCDP(tid, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 13, key: "Enter" }))
          .then(() => ({ success: true }));
      }
      if (key === 'Backspace') {
        return sendCDP(tid, "Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 8, key: "Backspace" })
          .then(() => sendCDP(tid, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 8, key: "Backspace" }))
          .then(() => ({ success: true }));
      }
      // 특수 키 (char 이벤트 보내면 안 됨)
      const specialKeys = { End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Tab: 9, Escape: 27 };
      if (specialKeys[key]) {
        return sendCDP(tid, "Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: specialKeys[key], key })
          .then(() => sendCDP(tid, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: specialKeys[key], key }))
          .then(() => ({ success: true }));
      }
      // 일반 문자 (한 글자)
      return sendCDP(tid, "Input.dispatchKeyEvent", { type: "rawKeyDown", key, text: key })
        .then(() => sendCDP(tid, "Input.dispatchKeyEvent", { type: "char", text: key }))
        .then(() => sendCDP(tid, "Input.dispatchKeyEvent", { type: "keyUp", key }))
        .then(() => ({ success: true }));
    }).catch(() => chrome.scripting.executeScript({ target: { tabId: tid, allFrames: false }, func: pressActiveKeyFn, args: [p.key] }).then(r => r[0].result))),
    getCookies: () => withActiveTab(tid => ensureDebugger(tid).then(() =>
      sendCDP(tid, "Network.getCookies", { urls: p.urls || ["https://naver.com", "https://nid.naver.com", "https://blog.naver.com"] })
        .then(r => ({ success: true, cookies: r.cookies || [] }))
    )),
    setCookies: () => withActiveTab(tid => ensureDebugger(tid).then(async () => {
      const cookies = p.cookies || [];
      for (const c of cookies) {
        try {
          await sendCDP(tid, "Network.setCookie", {
            name: c.name, value: c.value, domain: c.domain, path: c.path || "/",
            secure: c.secure || false, httpOnly: c.httpOnly || false,
            sameSite: c.sameSite || "Lax",
          });
        } catch(e) {}
      }
      return { success: true, count: cookies.length };
    })),
    clearCookies: () => withActiveTab(tid => ensureDebugger(tid).then(() =>
      sendCDP(tid, "Network.clearBrowserCookies", {}).then(() => ({ success: true }))
    )),
    cdpPaste: () => withActiveTab(tid => chrome.scripting.executeScript({
      target: { tabId: tid, allFrames: false },
      world: "MAIN",
      func: (text) => {
        // clipboardData를 사용한 paste 이벤트로 텍스트 삽입
        const el = document.activeElement;
        if (!el) return { success: false };
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        el.dispatchEvent(evt);
        return { success: true };
      },
      args: [p.text || '']
    }).then(r => r?.[0]?.result || { success: false })),
    cdpSetFile: () => withActiveTab(tid => ensureDebugger(tid).then(() => {
      // DOM에서 file input의 nodeId를 찾아서 파일 설정
      return sendCDP(tid, "DOM.getDocument", {}).then(doc =>
        sendCDP(tid, "DOM.querySelector", { nodeId: doc.root.nodeId, selector: p.selector || 'input[type="file"]' }).then(node => {
          if (!node || !node.nodeId) return { success: false, error: "file input not found" };
          return sendCDP(tid, "DOM.setFileInputFiles", { nodeId: node.nodeId, files: p.filePaths || [] })
            .then(() => ({ success: true }));
        })
      );
    }).catch(err => ({ success: false, error: err.message }))),
    fetchPageCdp: () => fetchPageCdp(p.url),
    fetchPage: () => fetchPage(p.url),
    getDomTree: () => withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid }, func: domTreeFn, args: [p.maxDepth || 5, p.maxNodes || 200] }).then(r => r[0].result)),
    clickByIndex: () => withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid }, func: clickByIdxFn, args: [p.index] }).then(r => r[0].result)),
    fillByIndex: () => withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid }, func: fillByIdxFn, args: [p.index, p.value] }).then(r => r[0].result)),
  };
  return (cmds[cmd] || (() => Promise.reject(new Error("알 수 없는 명령: " + cmd))))();
}

// ═══ 스크립트 함수들 ═══
function execTab(arg, fn) { return withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid, allFrames: false }, func: fn, args: [arg] }).then(r => r[0].result)); }
function execTab2(a1, a2, fn) { return withActiveTab(tid => chrome.scripting.executeScript({ target: { tabId: tid, allFrames: false }, func: fn, args: [a1, a2] }).then(r => r[0].result)); }

function clickFn(sel) {
  function find(s) { let r = document.querySelector(s); if (r) return r; function tr(n) { if (r) return; if (n.shadowRoot) { r = n.shadowRoot.querySelector(s); if (r) return; [...n.shadowRoot.children].forEach(tr); } if (n.children) [...n.children].forEach(tr); } tr(document.documentElement); return r; }
  const el = find(sel); if (!el) throw new Error("Not found: " + sel);
  el.scrollIntoView({ behavior: "instant", block: "center" }); const rect = el.getBoundingClientRect(); let x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const ev = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
  el.dispatchEvent(new MouseEvent("mousedown", { ...ev, button: 0 })); el.focus(); el.dispatchEvent(new MouseEvent("mouseup", { ...ev, button: 0 })); el.dispatchEvent(new MouseEvent("click", { ...ev, button: 0 }));
  return { success: true, tag: el.tagName };
}

function fillFn(sel, val) {
  function find(s) { let r = document.querySelector(s); if (r) return r; function tr(n) { if (r) return; if (n.shadowRoot) { r = n.shadowRoot.querySelector(s); if (r) return; [...n.shadowRoot.children].forEach(tr); } if (n.children) [...n.children].forEach(tr); } tr(document.documentElement); return r; }
  let el = find(sel) || find('[contenteditable="true"]') || find('[role="textbox"]'); if (!el) throw new Error("Not found: " + sel);
  el.focus(); const tag = el.tagName.toLowerCase(); const isCE = el.getAttribute("contenteditable") === "true" || el.isContentEditable;
  if (isCE) { el.innerText = ""; el.innerText = val; el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: val })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  else if (tag === "input" || tag === "textarea") { const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const set = Object.getOwnPropertyDescriptor(proto, "value"); if (set?.set) set.set.call(el, val); else el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  return { success: true, tag };
}

function pressFn(k) {
  const km = { Enter: { key: "Enter", code: "Enter", keyCode: 13 }, Tab: { key: "Tab", code: "Tab", keyCode: 9 }, Escape: { key: "Escape", code: "Escape", keyCode: 27 }, Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 } };
  const info = km[k] || { key: k, code: k, keyCode: k.charCodeAt(0) }; const el = document.activeElement;
  if (el) { el.dispatchEvent(new KeyboardEvent("keydown", { ...info, bubbles: true })); el.dispatchEvent(new KeyboardEvent("keyup", { ...info, bubbles: true })); }
  return { success: true };
}

function collectThreadsFn(rawUsername, rawLimit) {
  const username = String(rawUsername || '').replace(/^@/, '');
  const limit = Math.max(1, Math.min(Number(rawLimit || 100), 500));
  const out = [];
  const seen = new Set();
  const norm = value => String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const escapeRe = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const actionWords = /^(Like|Reply|Repost|Share|Send|Follow|Following|Translate|See translation|More|더 보기|좋아요|답글|공유|재게시|팔로우|인용|보내기)$/i;
  const noiseLine = line => {
    const text = norm(line);
    if (!text) return true;
    if (actionWords.test(text)) return true;
    if (/^@?[A-Za-z0-9._]+$/.test(text)) return true;
    if (/^\d+\s*(분|시간|일|주|개월|년|m|h|d|w)$/i.test(text)) return true;
    if (/^\d+(\.\d+)?[KkMm]?$/.test(text)) return true;
    return false;
  };
  const clean = value => norm(value)
    .split('\n')
    .map(line => norm(line))
    .filter(line => !noiseLine(line))
    .join(' ')
    .replace(new RegExp('^@?' + escapeRe(username) + '\\s+', 'i'), '')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
    .replace(/\b\d+\s*(?:likes?|replies|reposts?|views?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const addPost = (textValue, hrefValue, timeValue) => {
    const text = clean(textValue);
    const href = String(hrefValue || '');
    const key = (href.split('?')[0] || text).trim();
    if (text.length < 25 || seen.has(key)) return;
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
    if (out.length >= limit) return { posts: out };
  }
  const containers = Array.from(document.querySelectorAll('article, [role="article"], main div[dir="auto"], main span[dir="auto"]'));
  for (const el of containers) {
    const text = norm(el.innerText || el.textContent || '');
    if (text.length < 25 || text.length > 1800) continue;
    const root = el.closest('article,[role="article"],div') || el;
    const postLink = root.querySelector && root.querySelector('a[href*="/post/"]');
    const timeNode = root.querySelector && root.querySelector('time');
    addPost(text, postLink ? postLink.href : '', timeNode ? (timeNode.getAttribute('datetime') || '') : '');
    if (out.length >= limit) return { posts: out };
  }
  if (out.length === 0) {
    const lines = norm(document.body?.innerText || '').split('\n').map(line => norm(line)).filter(Boolean);
    let buf = [];
    const flush = () => {
      const candidate = clean(buf.join(' '));
      buf = [];
      if (candidate.length >= 25 && candidate.length <= 1800) addPost(candidate, '', '');
    };
    for (const line of lines) {
      if (noiseLine(line)) {
        flush();
        continue;
      }
      buf.push(line);
      if (buf.join(' ').length > 500) flush();
      if (out.length >= limit) return { posts: out };
    }
    flush();
  }
  return { posts: out };
}

function clickAtPointFn(x, y) {
  const el = document.elementFromPoint(Number(x), Number(y));
  if (!el) throw new Error("Point target not found");
  el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const ev = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy };
  el.dispatchEvent(new MouseEvent("mousedown", { ...ev, button: 0 }));
  el.focus?.();
  el.dispatchEvent(new MouseEvent("mouseup", { ...ev, button: 0 }));
  el.dispatchEvent(new MouseEvent("click", { ...ev, button: 0 }));
  return { success: true, tag: el.tagName };
}

function typeIntoActiveFn(text) {
  const el = document.activeElement;
  if (!el) throw new Error("No active element");
  const str = String(text ?? "");
  const tag = el.tagName?.toLowerCase();
  if (el.isContentEditable || el.getAttribute?.("contenteditable") === "true") {
    document.execCommand("insertText", false, str);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: str }));
    return { success: true, length: str.length, mode: "contenteditable" };
  }
  if (tag === "input" || tag === "textarea") {
    const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const current = el.value || "";
    const next = current + str;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, next);
    else el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, length: str.length, mode: tag };
  }
  throw new Error("Active element is not text-editable");
}

function pressActiveKeyFn(key) {
  const el = document.activeElement;
  if (!el) throw new Error("No active element");
  const km = {
    Enter: { key: "Enter", code: "Enter", keyCode: 13 },
    Tab: { key: "Tab", code: "Tab", keyCode: 9 },
    Escape: { key: "Escape", code: "Escape", keyCode: 27 },
    Backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
    End: { key: "End", code: "End", keyCode: 35 },
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 }
  };
  const info = km[key] || { key, code: key, keyCode: key?.charCodeAt?.(0) || 0 };
  el.dispatchEvent(new KeyboardEvent("keydown", { ...info, bubbles: true }));
  if (key === "Backspace" && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const next = (el.value || "").slice(0, -1);
    if (setter) setter.call(el, next);
    else el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (key === "Enter" && el.isContentEditable) {
    document.execCommand("insertParagraph", false);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
  }
  el.dispatchEvent(new KeyboardEvent("keyup", { ...info, bubbles: true }));
  return { success: true, key };
}

function domTreeFn(mD, mN) {
  let cnt = 0; const INT = ["a","button","input","textarea","select","details","summary","label"]; window.__piDomMap = [];
  function tr(el, d) { if (cnt >= mN || d > mD) return null; const tag = el.tagName?.toLowerCase(); if (!tag) return null;
    let vis = true; try { const r = el.getBoundingClientRect(); if (!r.width && !r.height) vis = false; const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden") vis = false; } catch { vis = false; }
    const isI = INT.includes(tag) || el.hasAttribute?.("onclick") || el.getAttribute?.("role") === "button" || el.isContentEditable;
    let node = null; if (isI && vis) { const idx = window.__piDomMap.length; window.__piDomMap.push(el); cnt++; node = "[" + idx + "]<" + tag + ">" + (el.innerText || el.value || el.placeholder || "").substring(0, 80) + "</" + tag + ">"; el.setAttribute("data-pi-idx", idx); }
    const ch = []; [...(el.children || [])].forEach(c => { const r = tr(c, d + 1); if (r) ch.push(r); }); if (el.shadowRoot) [...el.shadowRoot.children].forEach(c => { const r = tr(c, d + 1); if (r) ch.push(r); });
    if (node) return node; if (ch.length === 1) return ch[0]; if (ch.length > 0) return ch.join("\n"); return null; }
  return { tree: tr(document.documentElement, 0) || "", count: window.__piDomMap.length };
}

function clickByIdxFn(idx) {
  if (!window.__piDomMap?.[idx]) throw new Error("Index " + idx + " not found");
  const el = window.__piDomMap[idx]; el.scrollIntoView({ behavior: "instant", block: "center" }); const r = el.getBoundingClientRect();
  const ev = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new MouseEvent("mousedown", { ...ev, button: 0 })); el.focus(); el.dispatchEvent(new MouseEvent("mouseup", { ...ev, button: 0 })); el.dispatchEvent(new MouseEvent("click", { ...ev, button: 0 }));
  return { success: true, tag: el.tagName, text: (el.textContent || "").substring(0, 50) };
}

function fillByIdxFn(idx, val) {
  if (!window.__piDomMap?.[idx]) throw new Error("Index " + idx + " not found");
  const el = window.__piDomMap[idx]; el.focus(); const tag = el.tagName.toLowerCase(); const isCE = el.isContentEditable;
  if (isCE) { el.innerText = val; el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: val })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  else if (tag === "input" || tag === "textarea") { const set = Object.getOwnPropertyDescriptor(tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value"); if (set?.set) set.set.call(el, val); else el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  return { success: true, tag };
}

// ═══ 페이지 콘텐츠 추출 ═══
function _cleanupExtractTab(tid) {
  try {
    if (debugTabId === tid) {
      chrome.debugger.detach({ tabId: tid }, () => {});
      isDebugging = false;
      debugTabId = null;
    }
  } catch (_) {}
  try { chrome.tabs.remove(tid); } catch (_) {}
}

function _buildExtractExpression() {
  return `(() => {
    const SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,SVG:1,PATH:1,LINK:1,META:1,BR:1,HR:1,IFRAME:1};
    const BLOCK = /^(P|DIV|H[1-6]|LI|TR|BLOCKQUOTE|SECTION|ARTICLE|PRE|UL|OL|TABLE|MAIN)$/;
    const SELS = ['#newsct_article','#dic_area','.se-main-container','#postViewArea','.post-view','article','#article-body','.article_body','main','#content','#contents','.post-content','.entry-content','#news_body','.product-detail','#prdDetail','[data-testid="product-detail"]'];
    function norm(v) { return String(v || '').replace(/\\s+/g, ' ').trim(); }
    function findRoot() { for (const s of SELS) { const e = document.querySelector(s); if (e && norm(e.innerText || '').length > 100) return e; } return document.body; }
    function walk(node, out, seen, depth) {
      if (!node || depth > 30) return;
      if (node.nodeType === 3) {
        const t = norm(node.textContent || '');
        if (t.length > 1 && !seen.has(t)) { seen.add(t); out.push(t); }
        return;
      }
      if (node.nodeType !== 1 || SKIP[node.tagName]) return;
      const isBlock = BLOCK.test(node.tagName);
      if (isBlock && out.length && out[out.length - 1] !== '\\n') out.push('\\n');
      for (const child of node.childNodes || []) walk(child, out, seen, depth + 1);
      if (isBlock && out.length && out[out.length - 1] !== '\\n') out.push('\\n');
    }
    function pickDescription(text) {
      const lines = String(text || '').split(/\\n+/).map(norm).filter(Boolean);
      const good = lines.filter(line => line.length >= 20 && !/로그인|회원가입|장바구니|고객센터|배송|쿠폰|공유|더보기/.test(line));
      return (good.slice(0, 4).join(' ').trim() || norm(text).slice(0, 500)).slice(0, 800);
    }
    let parts = [], seen = new Set();
    walk(findRoot(), parts, seen, 0);
    let text = parts.join(' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').replace(/ {2,}/g, ' ').trim();
    if (text.length < 100) {
      parts = []; seen = new Set();
      walk(document.body, parts, seen, 0);
      text = parts.join(' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').replace(/ {2,}/g, ' ').trim();
    }
    const images = [];
    const seenImages = new Set();
    const pushImage = (src) => {
      const value = String(src || '').trim();
      if (!value || value.startsWith('data:') || seenImages.has(value)) return;
      if (/\\.(gif|svg|ico)(\\?|$)/i.test(value)) return;
      if (/icon|logo|sprite|avatar|badge|emoji/i.test(value)) return;
      seenImages.add(value);
      images.push(value);
    };
    const og = document.querySelector('meta[property="og:image"]');
    if (og?.content) pushImage(og.content);
    document.querySelectorAll('img').forEach(im => {
      pushImage(im.currentSrc || im.src || im.dataset.src || im.dataset.original || '');
    });
    let title = '';
    const h1 = document.querySelector('h1');
    if (h1) title = norm(h1.innerText || '');
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle?.content) title = norm(ogTitle.content);
    }
    if (!title) title = norm(document.title || '').slice(0, 200);
    return {
      title: title.slice(0, 200),
      text: text.slice(0, 12000),
      description: pickDescription(text),
      images: images.slice(0, 30),
      url: location.href
    };
  })()`;
}

function fetchPageCdp(url) {
  return new Promise(resolve => {
    chrome.tabs.create({ url, active: false }, tab => {
      const tid = tab.id;
      let done = false;
      const finish = payload => {
        if (done) return;
        done = true;
        clearTimeout(safetyTimer);
        _cleanupExtractTab(tid);
        resolve(payload);
      };
      const extract = () => {
        ensureDebugger(tid)
          .then(() => sendCDP(tid, "Runtime.evaluate", {
            expression: _buildExtractExpression(),
            returnByValue: true,
            awaitPromise: true,
          }))
          .then(result => {
            if (result?.exceptionDetails) {
              throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
            }
            const value = result?.result?.value || {};
            finish({ ...value, method: 'cdp' });
          })
          .catch(error => {
            finish({ title: '', text: '', description: '', images: [], url, error: error?.message || 'cdp_fetch_failed' });
          });
      };
      const safetyTimer = setTimeout(() => finish({ title: '', text: '', description: '', images: [], url, error: 'cdp_safety_timeout' }), 30000);
      const listener = (id, info) => {
        if (id === tid && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(extract, 1800);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        extract();
      }, 15000);
    });
  });
}

function fetchPage(url) {
  return new Promise(resolve => {
    chrome.tabs.create({ url, active: false }, tab => {
      const tid = tab.id; let done = false;
      // 안전장치: 30초 후 무조건 탭 정리
      const safetyTimer = setTimeout(() => { if (!done) { done = true; _cleanupExtractTab(tid); resolve({ title: '', text: '', images: [], url, error: 'safety_timeout' }); } }, 30000);
      const extract = () => {
        if (done) return; done = true; clearTimeout(safetyTimer);
        // 스크롤 없이 바로 추출 (CPU 과부하 방지)
        chrome.scripting.executeScript({ target: { tabId: tid }, func: () => {
          const SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,SVG:1,PATH:1,LINK:1,META:1,BR:1,HR:1,IFRAME:1};
          const BLOCK = /^(P|DIV|H[1-6]|LI|TR|BLOCKQUOTE|SECTION|ARTICLE|PRE|UL|OL|TABLE|MAIN)$/;
          const SELS = ['#newsct_article','#dic_area','.se-main-container','#postViewArea','.post-view','article','#article-body','.article_body','main','#content','#contents','.post-content','.entry-content','#news_body','.product-detail','#prdDetail'];
          function findArt() { for (const s of SELS) { const e = document.querySelector(s); if (e && (e.innerText||'').trim().length > 100) return e; } return document.body; }
          function walk(n, p, s, d) { if (!n || d > 30) return; if (n.nodeType === 3) { const t = (n.textContent||'').trim(); if (t.length > 1 && !s.has(t)) { s.add(t); p.push(t); } return; } if (n.nodeType !== 1) return; if (SKIP[n.tagName]) return; const isB = BLOCK.test(n.tagName); if (isB && p.length && p[p.length-1] !== '\n') p.push('\n'); for (const c of n.childNodes) walk(c, p, s, d+1); if (isB && p.length && p[p.length-1] !== '\n') p.push('\n'); }
          let parts = [], seen = new Set(); walk(findArt(), parts, seen, 0);
          let text = parts.join(' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
          if (text.length < 100) { parts = []; seen = new Set(); walk(document.body, parts, seen, 0); text = parts.join(' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim(); }
          const imgs = [], iS = {}; const og = document.querySelector('meta[property="og:image"]'); if (og?.content) { imgs.push(og.content); iS[og.content] = 1; }
          document.querySelectorAll('img').forEach(im => { const s = im.src || im.dataset.src || ''; if (!s || s.startsWith('data:') || iS[s] || /\.(gif|svg|ico)/.test(s) || /icon|logo|sprite/.test(s)) return; iS[s] = 1; imgs.push(s); });
          let title = ''; const h = document.querySelector('h1'); if (h) title = h.innerText.trim().substring(0, 200); if (!title) { const ot = document.querySelector('meta[property="og:title"]'); if (ot) title = ot.content.substring(0, 200); } if (!title) title = (document.title || '').substring(0, 200);
          return { title, text: text.substring(0, 10000), images: imgs.slice(0, 20), url: location.href, method: 'content-script' };
        }}).then(r => { _cleanupExtractTab(tid); resolve(r?.[0]?.result || { title: '', text: '', images: [], url, error: 'extraction_failed' }); })
        .catch(err => { _cleanupExtractTab(tid); resolve({ title: '', text: '', images: [], url, error: err.message }); });
      };
      const listener = (id, info) => { if (id === tid && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(listener); setTimeout(extract, 2000); } };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); extract(); }, 15000);
    });
  });
}
