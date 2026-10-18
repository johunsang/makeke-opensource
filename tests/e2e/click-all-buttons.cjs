const fs = require('node:fs');
const WebSocket = require('ws');

const host = '127.0.0.1';
const port = 9222;
const appPort = 8818;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const targets = await (await fetch(`http://${host}:${port}/json/list`)).json();
  const t = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!t) { console.error('앱을 찾을 수 없습니다.'); process.exit(1); }

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  const jsErrors = [];

  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  function send(m, p = {}) {
    const id = ++seq;
    ws.send(JSON.stringify({ id, method: m, params: p }));
    return new Promise((r, j) => {
      const timer = setTimeout(() => { pending.delete(id); j(new Error(m + ' timeout')); }, 20000);
      pending.set(id, { r, j, timer });
    });
  }
  ws.on('message', d => {
    const msg = JSON.parse(d.toString());
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params?.exceptionDetails?.exception?.description
        || msg.params?.exceptionDetails?.text || 'unknown';
      jsErrors.push(desc.substring(0, 150));
    }
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      clearTimeout(item.timer);
      pending.delete(msg.id);
      if (msg.error) item.j(new Error(msg.error.message));
      else item.r(msg.result || {});
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');

  async function eval_(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.text || 'eval error' };
    return r.result?.value;
  }

  function clearErrors() { jsErrors.length = 0; }

  // ─────────────────────────────────────────────
  // STEP 1: 런처 페이지
  // ─────────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('  STEP 1: 런처 페이지');
  console.log('════════════════════════════════════');
  await send('Page.navigate', { url: `http://${host}:${appPort}/static/launcher.html` });
  await wait(3000);

  const launcher = await eval_(`(() => {
    const btns = Array.from(document.querySelectorAll('button, [onclick], a.btn, .card-action'));
    return JSON.stringify({
      loggedIn: Boolean(document.querySelector('#launcher-user-email, [id*=logout]')?.offsetHeight),
      userName: (document.querySelector('#launcher-user-name')?.textContent || '').trim(),
      email: (document.querySelector('#launcher-user-email')?.textContent || '').trim(),
      buttons: btns.filter(b => b.offsetHeight > 0).map(b => ({
        text: b.textContent.trim().substring(0, 40),
        id: b.id || '',
        tag: b.tagName,
        disabled: b.disabled || false
      })).slice(0, 30)
    });
  })()`);
  const launcherData = JSON.parse(launcher);
  console.log('로그인 상태:', launcherData.loggedIn ? '✓ 로그인됨' : '✗ 미로그인');
  console.log('사용자:', launcherData.userName, launcherData.email);
  console.log('버튼 목록:');
  for (const b of launcherData.buttons) {
    console.log(`  [${b.tag}] ${b.text}${b.id ? ' #' + b.id : ''}${b.disabled ? ' (비활성)' : ''}`);
  }

  // Click each launcher card/button
  console.log('\n--- 런처 카드 클릭 테스트 ---');
  const launcherCards = await eval_(`(() => {
    const cards = document.querySelectorAll('.app-card, .launcher-service-card');
    return JSON.stringify(Array.from(cards).map((c, i) => ({
      index: i,
      title: (c.querySelector('h3, .card-title, strong')?.textContent || '').trim().substring(0, 30),
      visible: c.offsetHeight > 0
    })));
  })()`);
  const cards = JSON.parse(launcherCards);
  for (const card of cards) {
    if (!card.visible) continue;
    clearErrors();
    await eval_(`document.querySelectorAll('.app-card, .launcher-service-card')[${card.index}]?.click(); true`);
    await wait(500);
    const errs = [...jsErrors];
    console.log(`  ${errs.length === 0 ? '✓' : '✗'} 카드: "${card.title}"${errs.length > 0 ? ' → JS에러: ' + errs[0].substring(0, 80) : ''}`);
  }

  // ─────────────────────────────────────────────
  // STEP 2: 메인 앱 - 사이드바 메뉴 전체 클릭
  // ─────────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('  STEP 2: 메인 앱 사이드바 메뉴');
  console.log('════════════════════════════════════');
  await send('Page.navigate', { url: `http://${host}:${appPort}/static/index.html` });
  await wait(3000);

  let ready = false;
  for (let i = 0; i < 20; i++) {
    ready = await eval_(`document.readyState === 'complete' && Boolean(document.querySelector('[data-page]'))`);
    if (ready) break;
    await wait(500);
  }
  if (!ready) { console.error('메인 앱 로드 실패'); ws.close(); process.exit(1); }

  const menuItems = await eval_(`JSON.stringify(
    Array.from(document.querySelectorAll('[data-page]')).map(a => ({
      page: a.dataset.page,
      text: a.textContent.trim().substring(0, 30),
      visible: a.offsetHeight > 0 || a.closest('.nav-group')?.querySelector('.nav-group-header')?.offsetHeight > 0
    }))
  )`);
  const menus = JSON.parse(menuItems);

  const results = { ok: 0, issue: 0, skip: 0, details: [] };

  for (const menu of menus) {
    clearErrors();

    // First expand parent group if needed
    await eval_(`(() => {
      const el = document.querySelector('[data-page="${menu.page}"]');
      if (!el) return false;
      const group = el.closest('.nav-group');
      if (group) {
        const header = group.querySelector('.nav-group-header');
        if (header && el.offsetHeight === 0) header.click();
      }
      return true;
    })()`);
    await wait(200);

    const clicked = await eval_(`(() => {
      const el = document.querySelector('[data-page="${menu.page}"]');
      if (!el) return false;
      el.click();
      return true;
    })()`);

    if (!clicked) {
      results.skip++;
      continue;
    }
    await wait(1200);

    const pageState = await eval_(`(() => {
      const activePage = document.querySelector('.page[style*="display: block"], .page[style*="display:block"]');
      if (!activePage) {
        const all = document.querySelectorAll('.page');
        for (const p of all) {
          const s = window.getComputedStyle(p);
          if (s.display !== 'none') return JSON.stringify({ id: p.id, visible: true, text: p.innerText.substring(0, 100), hasContent: p.innerText.trim().length > 20, buttons: p.querySelectorAll('button:not([style*="display:none"])').length, inputs: p.querySelectorAll('input,textarea,select').length });
        }
        return JSON.stringify({ id: '', visible: false, text: '', hasContent: false, buttons: 0, inputs: 0 });
      }
      return JSON.stringify({
        id: activePage.id,
        visible: true,
        text: activePage.innerText.substring(0, 100),
        hasContent: activePage.innerText.trim().length > 20,
        buttons: activePage.querySelectorAll('button:not([style*="display:none"])').length,
        inputs: activePage.querySelectorAll('input,textarea,select').length
      });
    })()`);

    const state = JSON.parse(pageState || '{}');
    const errs = [...jsErrors];
    const issues = [];
    if (!state.visible) issues.push('페이지 안 보임');
    if (!state.hasContent) issues.push('콘텐츠 없음');
    if (errs.length > 0) issues.push(`JS에러 ${errs.length}개`);

    const status = issues.length === 0 ? 'OK' : 'ISSUE';
    if (status === 'OK') results.ok++;
    else results.issue++;

    const icon = status === 'OK' ? '✓' : '✗';
    const detail = { page: menu.page, label: menu.text, status, buttons: state.buttons, inputs: state.inputs, issues };
    results.details.push(detail);

    let line = `${icon} [${menu.page}] ${menu.text} — 버튼 ${state.buttons}개, 입력 ${state.inputs}개`;
    if (issues.length > 0) line += ' ⚠ ' + issues.join(', ');
    if (errs.length > 0) line += '\n    에러: ' + errs.slice(0, 2).map(e => e.substring(0, 80)).join(' | ');
    console.log(line);
  }

  // ─────────────────────────────────────────────
  // STEP 3: 주요 페이지 내부 버튼 클릭 테스트
  // ─────────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('  STEP 3: 주요 페이지 내부 버튼');
  console.log('════════════════════════════════════');

  const keyPages = ['super-agent', 'claude-design', 'video-agent', 'blog-agent', 'keyword-content', 'library', 'settings'];

  for (const pageName of keyPages) {
    clearErrors();
    await eval_(`(() => {
      const el = document.querySelector('[data-page="${pageName}"]');
      if (!el) return false;
      const group = el.closest('.nav-group');
      if (group) { const h = group.querySelector('.nav-group-header'); if (h && el.offsetHeight === 0) h.click(); }
      return true;
    })()`);
    await wait(200);
    await eval_(`document.querySelector('[data-page="${pageName}"]')?.click(); true`);
    await wait(1500);

    console.log(`\n--- [${pageName}] 내부 버튼 ---`);

    const btns = await eval_(`(() => {
      const page = Array.from(document.querySelectorAll('.page')).find(p => window.getComputedStyle(p).display !== 'none');
      if (!page) return '[]';
      const buttons = Array.from(page.querySelectorAll('button, [role="button"], .btn, select, [onclick]'));
      return JSON.stringify(buttons.filter(b => b.offsetHeight > 0 && b.offsetWidth > 0).map((b, i) => ({
        index: i,
        tag: b.tagName,
        text: b.textContent.trim().substring(0, 40),
        id: b.id || '',
        type: b.type || '',
        disabled: b.disabled || false,
        isSelect: b.tagName === 'SELECT',
        options: b.tagName === 'SELECT' ? Array.from(b.options).length : 0
      })).slice(0, 40));
    })()`);

    const buttonList = JSON.parse(btns);
    if (buttonList.length === 0) {
      console.log('  (버튼 없음)');
      continue;
    }

    for (const btn of buttonList) {
      if (btn.disabled) {
        console.log(`  ⊘ [${btn.tag}] "${btn.text}" — 비활성${btn.id ? ' #' + btn.id : ''}`);
        continue;
      }
      if (btn.isSelect) {
        console.log(`  ⊙ [SELECT] ${btn.text.substring(0, 20)} — ${btn.options}개 옵션${btn.id ? ' #' + btn.id : ''}`);
        continue;
      }
      // Skip dangerous buttons (생성, 발행, 삭제 등)
      const dangerKeywords = ['생성', '발행', '삭제', '제거', '초기화', '시작', 'start', 'generate', 'publish', 'delete', '만들기', '보내기', '전송', '결제', '신청', '실행'];
      const isDangerous = dangerKeywords.some(kw => btn.text.toLowerCase().includes(kw));
      if (isDangerous) {
        console.log(`  ⊘ [${btn.tag}] "${btn.text}" — 위험 버튼 스킵${btn.id ? ' #' + btn.id : ''}`);
        continue;
      }

      clearErrors();
      try {
        await eval_(`(() => {
          const page = Array.from(document.querySelectorAll('.page')).find(p => window.getComputedStyle(p).display !== 'none');
          if (!page) return false;
          const buttons = Array.from(page.querySelectorAll('button, [role="button"], .btn, select, [onclick]')).filter(b => b.offsetHeight > 0 && b.offsetWidth > 0);
          const b = buttons[${btn.index}];
          if (b) { b.click(); return true; }
          return false;
        })()`);
        await wait(500);
        const errs = [...jsErrors];
        if (errs.length > 0) {
          console.log(`  ✗ [${btn.tag}] "${btn.text}" → JS에러: ${errs[0].substring(0, 80)}${btn.id ? ' #' + btn.id : ''}`);
        } else {
          console.log(`  ✓ [${btn.tag}] "${btn.text}"${btn.id ? ' #' + btn.id : ''}`);
        }
      } catch (e) {
        console.log(`  ✗ [${btn.tag}] "${btn.text}" → 클릭 실패: ${e.message.substring(0, 60)}`);
      }

      // Close any modals that may have opened
      await eval_(`(() => {
        const modals = document.querySelectorAll('.modal-overlay, .modal-backdrop, [class*="modal"]');
        modals.forEach(m => {
          if (window.getComputedStyle(m).display !== 'none') {
            const close = m.querySelector('.modal-close, [class*="close"], button');
            if (close) close.click();
          }
        });
        return true;
      })()`);
      await wait(200);
    }
  }

  // ─────────────────────────────────────────────
  // STEP 4: 프로필 선택 모달 테스트
  // ─────────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('  STEP 4: 프로필 선택 모달');
  console.log('════════════════════════════════════');
  clearErrors();
  await eval_(`typeof openProfilePickerModal === 'function' && openProfilePickerModal(); true`);
  await wait(1000);
  const profileModal = await eval_(`(() => {
    const modal = document.querySelector('#profile-picker-modal, [class*="profile-picker"], [class*="profile-modal"]');
    if (!modal || window.getComputedStyle(modal).display === 'none') return JSON.stringify({ visible: false });
    const items = modal.querySelectorAll('.profile-item, [class*="profile-card"], li, .list-item');
    return JSON.stringify({
      visible: true,
      itemCount: items.length,
      text: modal.innerText.substring(0, 200)
    });
  })()`);
  const pmData = JSON.parse(profileModal);
  if (pmData.visible) {
    console.log(`✓ 프로필 선택 모달 열림 — ${pmData.itemCount}개 프로필`);
  } else {
    console.log('✗ 프로필 선택 모달이 안 보임');
  }
  const pErrs = [...jsErrors];
  if (pErrs.length > 0) console.log('  에러:', pErrs.join(' | '));
  // Close modal
  await eval_(`(() => { const modals = document.querySelectorAll('.modal-overlay, [class*="modal"]'); modals.forEach(m => { if (window.getComputedStyle(m).display !== 'none') { const close = m.querySelector('.modal-close, [class*="close"], button[class*="close"]'); if (close) close.click(); else m.style.display = 'none'; } }); })()`);
  await wait(300);

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('  최종 요약');
  console.log('════════════════════════════════════');
  console.log(`사이드바 메뉴: 정상 ${results.ok}, 문제 ${results.issue}, 건너뜀 ${results.skip}`);
  if (results.issue > 0) {
    console.log('\n문제 페이지:');
    for (const d of results.details.filter(d => d.status === 'ISSUE')) {
      console.log(`  [${d.page}] ${d.label}: ${d.issues.join(', ')}`);
    }
  }

  ws.close();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
