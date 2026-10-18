const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const appPort = Number(process.env.MAKEKE_PORT || 8818);
const cdpPort = Number(process.env.MAKEKE_CDP_PORT || 9222);
const base = `http://127.0.0.1:${appPort}`;
const artifacts = path.join(process.cwd(), 'artifacts', 'wdio');
fs.mkdirSync(artifacts, { recursive: true });
const forbiddenRequests = [];
const runtimeErrors = [];
const screenshots = [];
const connections = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function targets() { return (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); }
function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    socket.on('open', () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const requestId = ++id;
          const timer = setTimeout(() => { pending.delete(requestId); rej(new Error(`${method} timeout`)); }, 30000);
          pending.set(requestId, { res, rej, timer });
          socket.send(JSON.stringify({ id: requestId, method, params }));
        });
      },
      close() { socket.close(); },
    }));
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.method === 'Network.requestWillBeSent') {
        const url = new URL(message.params.request.url);
        if (url.hostname === 'makeke.kr' || url.hostname.endsWith('.makeke.kr') || url.hostname === 'firestore.googleapis.com' || /\/api\/(auth|access|payment|license)(\/|$)/.test(url.pathname)) forbiddenRequests.push(url.origin + url.pathname);
      }
      if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (!pending.has(message.id)) return;
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
      message.error ? item.rej(new Error(message.error.message)) : item.res(message.result || {});
    });
    socket.on('error', reject);
  });
}
async function attach(target) {
  const cdp = await connect(target.webSocketDebuggerUrl); connections.push(cdp);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
  return cdp;
}
async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
}
async function until(check, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await check()) return; await wait(250); }
  throw new Error(`${label} timeout`);
}
async function ready(cdp) { await until(() => evaluate(cdp, "document.readyState === 'complete'"), 'page ready'); await wait(1500); }
async function snap(cdp, label) {
  await cdp.send('Page.bringToFront');
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
  const destination = path.join(artifacts, `makeke-v1791-no-login-${label}.png`);
  fs.writeFileSync(destination, Buffer.from(result.data, 'base64')); screenshots.push(destination);
}
async function clickVisible(cdp, selector) {
  const point = await evaluate(cdp, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing menu');
    node.scrollIntoView({block:'center'});
    const rect=node.getBoundingClientRect();
    const x=rect.x+rect.width/2, y=rect.y+rect.height/2;
    const hit=document.elementFromPoint(x,y);
    if (!hit || !(node===hit || node.contains(hit))) throw new Error('Menu is covered by '+(hit?.id||hit?.tagName));
    return {x,y};
  })()`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
async function dismissProfileEditor(cdp) {
  const visible = await evaluate(cdp, "(() => { const el=document.getElementById('libEditModal'); return !!el && getComputedStyle(el).display!=='none' && el.getBoundingClientRect().height>0; })()");
  if (!visible) return;
  await clickVisible(cdp, '#libEditModal .modal-close');
  await wait(250);
}
async function assertNoGate(cdp) {
  const state = await evaluate(cdp, `({title:document.title,profileStartupModal:(()=>{const el=document.getElementById('libEditModal');return !!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;})(),providerStartupModal:!!document.getElementById('apikey-required-modal'),overlay:!!document.getElementById('login-required-overlay'),loginModal:!!document.getElementById('login-modal'),token:sessionStorage.getItem('makeke_token')||localStorage.getItem('makeke_token'),text:document.body.innerText})`);
  assert.equal(state.profileStartupModal, false); assert.equal(state.providerStartupModal, false); assert.equal(state.overlay, false); assert.equal(state.loginModal, false); assert.equal(state.token, null);
  for (const retired of ['런처에서 로그인해주세요', '접근 권한이 필요합니다', '전체 앱 월요금 신청']) assert.ok(!state.text.includes(retired), retired);
  assert.ok(!/Bbarit|빠릿디자인|빠릿마케팅/.test(state.title), `wrong product title ${state.title}`);
  return state.title;
}
(async () => {
  let verificationPassed = false;
  try {
    let target;
    await until(async () => { const list = await targets(); target = list.find(item => item.type === 'page' && item.url.startsWith(base)); return !!target; }, 'Makeke app');
    assert.equal(target.url, base + '/', 'app must start directly at the Makeke core workspace');
    const pageTargets = (await targets()).filter(item => item.type === 'page' && item.url.startsWith(base));
    assert.equal(pageTargets.length, 1, 'only one Makeke window should be open at startup');
    const main = await attach(target);
    await main.send('Page.reload', { ignoreCache: true }); await ready(main);
    const mainTitle = await assertNoGate(main); await snap(main, 'main-direct');
    await until(() => evaluate(main, "typeof navigateToPage === 'function'"), 'main navigation');
    await clickVisible(main, 'nav a[data-page="library"]'); await wait(700);
    assert.ok(await evaluate(main, "document.getElementById('page-library').classList.contains('active')")); await snap(main, 'profiles-core');
    await dismissProfileEditor(main); await clickVisible(main, 'nav a[data-page="settings"]'); await wait(700);
    assert.ok(await evaluate(main, "document.getElementById('page-settings').classList.contains('active')")); await dismissProfileEditor(main); await snap(main, 'settings-core');
    await main.send('Page.reload', { ignoreCache: true }); await ready(main); await assertNoGate(main); await snap(main, 'reloaded-core');
    const apiStatuses = await evaluate(main, `(async()=>{const paths=['/api/library/profiles','/api/config'];return Promise.all(paths.map(async pathname=>({pathname,status:(await fetch(pathname)).status})));})()`);
    apiStatuses.forEach(result => assert.equal(result.status, 200, result.pathname));
    const retiredStatuses = [];
    for (const pathname of ['/apps/insight/', '/apps/seller-booster/', '/static/xiaohongshu.html', '/static/kekelink.html', '/api/xiaohongshu/search', '/api/auth/status', '/api/auth/login-url', '/api/access/check']) {
      const response = await fetch(base + pathname);
      retiredStatuses.push({ pathname, status: response.status });
      assert.equal(response.status, 404, pathname);
    }
    const legacy = await fetch(base + '/static/launcher.html', { redirect: 'manual' });
    assert.equal(legacy.status, 307); assert.equal(legacy.headers.get('location'), '/');
    assert.deepEqual(forbiddenRequests, [], 'retired product API or website requested by the UI');
    await main.send('Page.navigate', { url: base + '/' }); await ready(main); await assertNoGate(main);
    await snap(main, 'main-final');
    assert.deepEqual(runtimeErrors, [], 'the core UI must have no runtime errors');
    verificationPassed = true;
    console.log(JSON.stringify({ verificationPassed, mainTitle, apiStatuses, retiredStatuses, screenshots, forbiddenRequests, runtimeErrors }, null, 2));
  } finally {
    fs.writeFileSync(path.join(artifacts, 'makeke-v1791-no-login-result.json'), JSON.stringify({ verificationPassed, screenshots, forbiddenRequests, runtimeErrors }, null, 2));
    connections.forEach(connection => connection.close());
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
