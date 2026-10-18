const WebSocket = require('ws');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ver = await (await fetch('http://127.0.0.1:9222/json/version')).json();
  const browserWsUrl = ver.webSocketDebuggerUrl;
  const ws = new WebSocket(browserWsUrl, { handshakeTimeout: 5000 });
  let seq = 0, pending = new Map(), jsErrors = [], netFails = [];

  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });

  function send(m, p = {}, sid) {
    const id = ++seq;
    const msg = { id, method: m, params: p };
    if (sid) msg.sessionId = sid;
    ws.send(JSON.stringify(msg));
    return new Promise((r, j) => {
      const timer = setTimeout(() => { pending.delete(id); j(new Error(m + ' timeout')); }, 15000);
      pending.set(id, { r, j, timer });
    });
  }

  ws.on('message', d => {
    const msg = JSON.parse(d.toString());
    if (msg.method === 'Runtime.exceptionThrown' || (msg.params?.method === 'Runtime.exceptionThrown')) {
      const details = msg.params?.params || msg.params;
      jsErrors.push((details?.exceptionDetails?.exception?.description || details?.exceptionDetails?.text || '').substring(0, 100));
    }
    if ((msg.method === 'Network.responseReceived' || msg.params?.method === 'Network.responseReceived')) {
      const params = msg.params?.params || msg.params;
      const r = params?.response;
      if (r && r.status >= 400 && r.url?.includes('/api/'))
        netFails.push({ url: r.url?.split('?')[0]?.replace('http://127.0.0.1:8818', ''), status: r.status });
    }
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      clearTimeout(item.timer);
      pending.delete(msg.id);
      if (msg.error) item.j(new Error(msg.error.message));
      else item.r(msg.result || {});
    }
  });

  // Get targets and attach
  const { targetInfos } = await send('Target.getTargets');
  const pageTarget = targetInfos.find(t => t.type === 'page' && t.url?.includes('8818'));
  if (!pageTarget) { console.error('페이지 타겟 없음'); ws.close(); process.exit(1); }

  // Close existing target and create new one
  await send('Target.closeTarget', { targetId: pageTarget.targetId });
  await wait(500);
  const { targetId } = await send('Target.createTarget', { url: 'http://127.0.0.1:8818/static/index.html' });
  await wait(3000);

  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await wait(2000);

  async function ev(expr) {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
      return r.result?.value;
    } catch { return null; }
  }

  // Wait for app ready
  for (let i = 0; i < 20; i++) {
    const ready = await ev(`document.readyState === 'complete' && Boolean(document.querySelector('[data-page]'))`);
    if (ready) break;
    await wait(500);
  }

  const menuJSON = await ev(`JSON.stringify(
    Array.from(document.querySelectorAll('[data-page]')).map(a => ({
      page: a.dataset.page,
      text: a.textContent.trim().substring(0, 30)
    }))
  )`);
  if (!menuJSON) { console.error('메뉴 로드 실패'); ws.close(); process.exit(1); }
  const menus = JSON.parse(menuJSON);

  console.log('=== 수정 후 전체 메뉴 순회 점검 (' + menus.length + '개) ===\n');

  for (const menu of menus) {
    jsErrors.length = 0;
    netFails.length = 0;

    await ev(`(() => {
      const el = document.querySelector('[data-page="${menu.page}"]');
      if (!el) return;
      const g = el.closest('.nav-group');
      if (g) { const h = g.querySelector('.nav-group-header'); if (h && el.offsetHeight === 0) h.click(); }
    })()`);
    await wait(100);
    await ev(`document.querySelector('[data-page="${menu.page}"]')?.click()`);
    await wait(800);

    const state = await ev(`(() => {
      for (const p of document.querySelectorAll('.page')) {
        if (window.getComputedStyle(p).display !== 'none') {
          const bi = Array.from(p.querySelectorAll('img')).filter(i => i.complete && i.naturalWidth===0 && i.src && !i.src.startsWith('data:') && i.offsetHeight>0).map(i => i.src.replace('http://127.0.0.1:8818','')).slice(0,3);
          return JSON.stringify({ id: p.id, ok: true, btns: p.querySelectorAll('button').length, inp: p.querySelectorAll('input,textarea,select').length, bi });
        }
      }
      return '{"ok":false}';
    })()`);

    const s = JSON.parse(state || '{"ok":false}');
    const errs = [...jsErrors];
    const nets = [...new Set(netFails.map(n => n.status + ' ' + n.url))].slice(0, 3);
    const issues = [];
    if (!s.ok) issues.push('안 보임');
    if (s.bi?.length) issues.push('깨진이미지:' + s.bi.join(','));
    if (errs.length) issues.push('JS' + errs.length);
    if (nets.length) issues.push(nets.join('; '));

    const icon = issues.length === 0 ? '✓' : '✗';
    let line = `${icon} [${menu.page}] ${menu.text}`;
    if (s.ok) line += ` (btn${s.btns} inp${s.inp})`;
    if (issues.length) line += '\n    ⚠ ' + issues.join(' | ');
    console.log(line);
  }

  // Check sidebar photo fix
  const photoCheck = await ev(`(() => {
    const p = document.getElementById('app-auth-photo');
    if (!p) return 'element없음';
    if (p.style.display === 'none') return '✓ 비표시(수정됨)';
    if (!p.hasAttribute('src')) return '✓ src없음(수정됨)';
    if (p.src && p.complete && p.naturalWidth === 0) return '✗ 깨짐: ' + p.src;
    return '✓ 정상';
  })()`);
  console.log('\n프로필 사진: ' + photoCheck);

  ws.close();
  process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
