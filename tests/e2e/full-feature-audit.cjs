const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

const host = process.env.MAKEKE_CDP_HOST || '127.0.0.1';
const port = Number(process.env.MAKEKE_CDP_PORT || 9222);
const appPort = Number(process.env.MAKEKE_PORT || 8818);
const artifactsDir = path.join(process.cwd(), 'artifacts', 'audit');

fs.mkdirSync(artifactsDir, { recursive: true });

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let seq = 0;
    socket.on('open', () => {
      resolve({
        send(method, params = {}) {
          const id = ++seq;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => {
            const timer = setTimeout(() => { pending.delete(id); rej(new Error(`${method}: timeout`)); }, 30000);
            pending.set(id, { res, rej, method, timer });
          });
        },
        onEvent(cb) { socket._eventCb = cb; },
        close() { socket.close(); },
      });
    });
    socket.on('error', () => reject(new Error('CDP WebSocket 연결 실패')));
    socket.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method && socket._eventCb) socket._eventCb(msg);
      if (!msg.id || !pending.has(msg.id)) return;
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(item.timer);
      if (msg.error) item.rej(new Error(`${item.method}: ${msg.error.message}`));
      else item.res(msg.result || {});
    });
  });
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval failed');
  return r.result && r.result.value;
}

async function screenshot(cdp, name) {
  const filePath = path.join(artifactsDir, name);
  try {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(filePath, Buffer.from(r.data || '', 'base64'));
    return filePath;
  } catch (e) {
    return null;
  }
}

const ALL_PAGES = [
  'super-agent',
  'claude-design',
  'video-agent',
  'animation-ad',
  'trend-dashboard',
  'keyword-content',
  'blog-agent',
  'cardnews-editor2',
  'sns-agent',
  'comic-agent',
  'detailpage-agent',
  'claude-design-history',
  'video-agent-history',
  'project-history',
  'unified-history',
  'ec-branding',
  'ec-seo-audit',
  'geo-seo-consultant',
  'ec-smartstore',
  'ec-offlineshop',
  'ec-logo',
  'ec-backlink-checker',
  'ec-broken-link-checker',
  'ec-banner',
  'ec-advideo',
  'ec-detailpage',
  'ec-rebuild',
  'ec-thumbnail',
  'ec-model',
  'ec-outfit',
  'ec-influencer',
  'ec-art',
  'ec-cartoon',
  'ec-interior',
  'ec-pet',
  'ec-pet-outfit',
  'video-studio',
  'video-utils',
  'browser-auto',
  'desktop-agent',
  'meta-ads-auto',
  'youtube-ads-auto',
  'threads-lab',
  'naver-blog-lab',
  'library',
  'settings',
  'prompt-admin',
];

(async () => {
  const targets = await getJson(`http://${host}:${port}/json/list`);
  const appUrlPattern = new RegExp(`(?:127\\.0\\.0\\.1|localhost):${appPort}`);
  const target = targets.find(t => appUrlPattern.test(String(t.url || '')) && t.type === 'page' && t.webSocketDebuggerUrl)
    || targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!target) { console.error('앱을 찾을 수 없습니다.'); process.exit(1); }

  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  const consoleErrors = [];
  const networkErrors = [];

  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Log.enable');

    cdp.onEvent((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params?.exceptionDetails?.exception?.description
          || msg.params?.exceptionDetails?.text || 'unknown';
        consoleErrors.push({ time: Date.now(), error: desc });
      }
      if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
        consoleErrors.push({ time: Date.now(), error: msg.params.entry.text || 'log error' });
      }
      if (msg.method === 'Network.loadingFailed') {
        networkErrors.push({
          time: Date.now(),
          url: msg.params?.request?.url || msg.params?.requestId || '',
          error: msg.params?.errorText || msg.params?.blockedReason || 'failed',
        });
      }
    });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/static/index.html` });
    await wait(2000);

    let ready = false;
    for (let i = 0; i < 20; i++) {
      ready = await evaluate(cdp, `document.readyState === 'complete'`);
      if (ready) break;
      await wait(500);
    }
    if (!ready) { console.error('앱 로딩 실패'); process.exit(1); }

    console.log('=== 마케케 전체 기능 점검 시작 ===\n');

    const results = [];

    for (const pageName of ALL_PAGES) {
      consoleErrors.length = 0;
      networkErrors.length = 0;

      const clickResult = await evaluate(cdp, `(() => {
        const el = document.querySelector('[data-page="${pageName}"]');
        if (!el) return { found: false };
        el.click();
        return { found: true, text: el.textContent.trim().substring(0, 50) };
      })()`);

      if (!clickResult || !clickResult.found) {
        results.push({ page: pageName, status: 'SKIP', reason: '메뉴 못 찾음' });
        continue;
      }

      await wait(1500);

      const pageState = await evaluate(cdp, `(() => {
        const content = document.querySelector('#content-area, .content-area, main, .main-content');
        const visible = content ? content.offsetHeight > 0 : false;
        const bodyText = document.body.innerText || '';
        const hasError = /에러|오류|Error|Failed|undefined is not|Cannot read/.test(bodyText);
        const emptyContent = content ? (content.innerText || '').trim().length < 10 : true;

        const brokenImgs = Array.from(document.querySelectorAll('img')).filter(img =>
          img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')
        ).map(img => img.src).slice(0, 5);

        const buttons = Array.from(document.querySelectorAll('button:not([disabled]):not([style*="display:none"]):not([style*="display: none"])')).length;
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select')).length;
        const modals = Array.from(document.querySelectorAll('.modal, [class*="modal"]')).filter(m => {
          const s = window.getComputedStyle(m);
          return s.display !== 'none' && s.visibility !== 'hidden';
        }).length;

        return {
          visible,
          hasError,
          emptyContent,
          brokenImgs,
          buttons,
          inputs,
          modals,
          titleSnippet: bodyText.substring(0, 200),
        };
      })()`);

      await screenshot(cdp, `page-${pageName}.png`);

      const jsErrors = [...consoleErrors];
      const netErrors = [...networkErrors];

      const issues = [];
      if (!pageState) issues.push('페이지 상태 읽기 실패');
      else {
        if (pageState.hasError) issues.push('화면에 에러 텍스트 노출');
        if (pageState.emptyContent) issues.push('콘텐츠 영역 비어있음');
        if (pageState.brokenImgs && pageState.brokenImgs.length > 0) issues.push(`깨진 이미지 ${pageState.brokenImgs.length}개: ${pageState.brokenImgs.join(', ')}`);
      }
      if (jsErrors.length > 0) issues.push(`JS 에러 ${jsErrors.length}개: ${jsErrors.map(e => e.error.substring(0, 100)).join(' | ')}`);
      if (netErrors.length > 0) {
        const relevant = netErrors.filter(e => !e.error.includes('net::ERR_BLOCKED_BY_CLIENT'));
        if (relevant.length > 0) issues.push(`네트워크 에러 ${relevant.length}개: ${relevant.map(e => `${e.url} (${e.error})`).slice(0, 3).join(' | ')}`);
      }

      const status = issues.length > 0 ? 'ISSUE' : 'OK';
      results.push({
        page: pageName,
        label: clickResult.text,
        status,
        issues: issues.length > 0 ? issues : undefined,
        buttons: pageState?.buttons,
        inputs: pageState?.inputs,
      });

      const icon = status === 'OK' ? '✓' : '✗';
      console.log(`${icon} [${pageName}] ${clickResult.text} — ${status}${issues.length > 0 ? '\n    ' + issues.join('\n    ') : ''}`);
    }

    console.log('\n=== 점검 결과 요약 ===');
    const okCount = results.filter(r => r.status === 'OK').length;
    const issueCount = results.filter(r => r.status === 'ISSUE').length;
    const skipCount = results.filter(r => r.status === 'SKIP').length;
    console.log(`총 ${results.length}개 페이지 — 정상 ${okCount}, 문제 ${issueCount}, 건너뜀 ${skipCount}`);

    if (issueCount > 0) {
      console.log('\n--- 문제 발견된 페이지 ---');
      for (const r of results.filter(r => r.status === 'ISSUE')) {
        console.log(`\n[${r.page}] ${r.label || ''}`);
        for (const issue of r.issues) console.log(`  → ${issue}`);
      }
    }

    const reportPath = path.join(artifactsDir, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n전체 리포트: ${reportPath}`);
    console.log(`스크린샷: ${artifactsDir}/page-*.png`);

    await evaluate(cdp, `document.querySelector('[data-page="claude-design"]')?.click(); true`);

  } finally {
    cdp.close();
  }
})().catch(e => {
  console.error(`실패: ${e.message || e}`);
  process.exit(1);
});
