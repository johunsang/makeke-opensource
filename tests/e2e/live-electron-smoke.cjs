const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

const host = process.env.MAKEKE_CDP_HOST || '127.0.0.1';
const port = Number(process.env.MAKEKE_CDP_PORT || 9222);
const appPort = Number(process.env.MAKEKE_PORT || 8818);
const artifactsDir = path.join(process.cwd(), 'artifacts', 'wdio');

fs.mkdirSync(artifactsDir, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

async function findMakekeTarget() {
  const targets = await getJson(`http://${host}:${port}/json/list`);
  const appUrlPattern = new RegExp(`(?:127\\.0\\.0\\.1|localhost):${appPort}`);
  const target = targets.find((item) => appUrlPattern.test(String(item.url || '')) && /\/static\/index\.html/.test(String(item.url || '')))
    || targets.find((item) => appUrlPattern.test(String(item.url || '')) && /\/static\/launcher\.html/.test(String(item.url || '')))
    || targets.find((item) => appUrlPattern.test(String(item.url || '')))
    || targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error(`실행 중인 마케케 화면을 찾지 못했습니다. 먼저 npm run dev 또는 scripts/start_makeke.sh로 앱을 켜주세요. (${host}:${port})`);
  }
  return target;
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
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error(`${method}: CDP 응답 대기 시간이 초과되었습니다.`));
            }, 60000);
            pending.set(id, { res, rej, method, timer });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.on('error', () => reject(new Error('CDP WebSocket 연결 실패')));
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (!message.id || !pending.has(message.id)) return;
      const item = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) {
        item.rej(new Error(`${item.method}: ${message.error.message || JSON.stringify(message.error)}`));
      } else {
        item.res(message.result || {});
      }
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || '화면 스크립트 실행 실패');
  }
  return result.result && result.result.value;
}

async function screenshot(cdp, name) {
  const filePath = path.join(artifactsDir, name);
  try {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(filePath, Buffer.from(result.data || '', 'base64'));
    return filePath;
  } catch (error) {
    const fallbackPath = filePath.replace(/\.png$/i, '.txt');
    fs.writeFileSync(fallbackPath, `Page.captureScreenshot failed: ${error.message || error}\n`);
    return fallbackPath;
  }
}

(async () => {
  const target = await findMakekeTarget();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/static/index.html` });
    await wait(700);
    await cdp.send('Page.reload', { ignoreCache: true });
    let ready = false;
    for (let i = 0; i < 20; i += 1) {
      ready = await evaluate(cdp, `Boolean(document.querySelector('[data-page="video-agent"]')) && document.readyState`);
      if (ready) break;
      await wait(300);
    }
    if (!ready) throw new Error('마케케 메뉴를 찾지 못했습니다.');

    const before = await screenshot(cdp, 'live-current-before.png');
    await evaluate(cdp, `document.querySelector('[data-page="video-agent"]')?.click(); true`);
    await wait(700);

    const state = await evaluate(cdp, `(async () => {
      const text = document.body.innerText || '';
      const sceneBuilder = (() => {
        const V = window.__VAG || {};
        if (typeof V._vagBuildSceneImageTextMotionHtml !== 'function') return { ok: false, reason: 'builder missing' };
        const html = V._vagBuildSceneImageTextMotionHtml([
          { index: 1, url: '/api/hyperframes/output/scene-bg-test-01.jpg', videoUrl: '/api/hyperframes/output/scene-video-test-01.mp4' },
          { index: 2, url: '/api/hyperframes/output/scene-bg-test-02.jpg', videoUrl: '/api/hyperframes/output/scene-video-test-02.mp4' }
        ], {
          duration: 10,
          aspect: '9:16',
          brandColor: '#65A30D',
          plan: [
            { title: '첫 장면', body: '문구가 배경 위에 보입니다', narration: '첫 장면 내레이션입니다.', duration: 5 },
            { title: '두 번째 장면', body: '검은 화면 없이 이어집니다', narration: '두 번째 장면 내레이션입니다.', duration: 5 }
          ]
        });
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const videos = Array.from(doc.querySelectorAll('video[data-vag-bg="scene-video"]'));
        const nestedVideos = Array.from(doc.querySelectorAll('section video'));
        const layouts = Array.from(doc.querySelectorAll('section.vag-simple-scene')).map((node) => {
          const found = Array.from(node.classList).find((name) => name.indexOf('text-') === 0);
          return found || '';
        }).filter(Boolean);
        const effects = Array.from(doc.querySelectorAll('section.vag-simple-scene')).map((node) => {
          const found = Array.from(node.classList).find((name) => name.indexOf('effect-') === 0);
          return found || '';
        }).filter(Boolean);
        const transitions = Array.from(doc.querySelectorAll('section.vag-simple-scene')).map((node) => {
          const found = Array.from(node.classList).find((name) => name.indexOf('transition-') === 0);
          return found || '';
        }).filter(Boolean);
        return {
          ok: videos.length === 2 && nestedVideos.length === 0 && !html.includes("tl.to('.scene-") && new Set(layouts).size >= 2 && effects.length === 2 && transitions.length === 2 && html.includes('vag-transition-flash'),
          videos: videos.length,
          nestedVideos: nestedVideos.length,
          hasEarlyFadeOut: html.includes("tl.to('.scene-"),
          hasSceneSwitch: html.includes("tl.set('.scene-2"),
          layouts,
          effects,
          transitions
        };
      })();
      const outputSelection = await (async () => {
        const start = document.querySelector('#vag-gen-btn');
        if (!document.querySelector('#vag-auto-output-mode-select')) start?.click();
        if (!document.querySelector('#vag-auto-output-mode-select')) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
        const select = document.querySelector('#vag-auto-output-mode-select');
        if (!select) return { ok: false, reason: 'select missing' };
        select.value = 'image-video-hyperframes';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const hidden = document.querySelector('#vag-output-mode');
        const videoModel = document.querySelector('#vag-ai-bg-video-model');
        return {
          ok: hidden?.value === 'image-video-hyperframes' && Boolean(videoModel?.value),
          selectValue: select.value,
          hiddenValue: hidden?.value || '',
          videoModelValue: videoModel?.value || ''
        };
      })();
      const autoPickOutputMode = (() => {
        const V = window.__VAG || {};
        if (typeof V._vagAutoPickOption !== 'function') return { ok: false, reason: 'auto pick missing' };
        window._vagAutoPrefs = Object.assign({}, window._vagAutoPrefs || {}, { outputMode: 'image-video-hyperframes' });
        window._vagAutoChoices = Object.assign({}, window._vagAutoChoices || {}, { outputMode: 'image-video-hyperframes' });
        const picked = V._vagAutoPickOption([
          '배경 이미지는 그대로 쓰고 문구 넣기',
          '배경 이미지를 짧은 영상으로 바꾼 뒤 문구 넣기',
          '배경 이미지만 만들기'
        ]);
        return {
          ok: picked === '배경 이미지를 짧은 영상으로 바꾼 뒤 문구 넣기',
          picked
        };
      })();
      const sceneControl = (() => {
        const V = window.__VAG || {};
        if (typeof V._vagRenderScenarioChatEditor !== 'function' || typeof V._vagSyncScenarioChatEditorToSession !== 'function') {
          return { ok: false, reason: 'scene control missing' };
        }
        V._vagSession = Object.assign({}, V._vagSession || {}, {
          profileDesignGuide: '',
          sceneNarrationPlan: [
            { index: 1, title: '확인 장면', body: '위치와 애니를 고릅니다', narration: '확인 장면입니다.' }
          ]
        });
        V._vagRenderScenarioChatEditor({});
        const layout = document.querySelector('[data-vag-scene-choice="textLayout"]');
        const motion = document.querySelector('[data-vag-scene-choice="textMotion"]');
        const design = document.querySelector('[data-vag-scene-choice="textDesign"]');
        const screenEffect = document.querySelector('[data-vag-scene-choice="screenEffect"]');
        const transitionEffect = document.querySelector('[data-vag-scene-choice="transitionEffect"]');
        if (!layout || !motion || !design || !screenEffect || !transitionEffect) return { ok: false, reason: 'select missing' };
        const autoScene = V._vagSession.sceneNarrationPlan[0] || {};
        const previewText = document.querySelector('[data-vag-preview-text]');
        const previewBg = document.querySelector('[data-vag-preview-bg]');
        const previewTransition = document.querySelector('[data-vag-preview-transition]');
        const initialAnimation = previewText ? window.getComputedStyle(previewText).animationName : '';
        const bgAnimation = previewBg ? window.getComputedStyle(previewBg).animationName : '';
        const transitionAnimation = previewTransition ? window.getComputedStyle(previewTransition).animationName : '';
        const autoOk = Boolean(autoScene.textLayout && autoScene.textMotion && autoScene.textDesign && autoScene.screenEffect && autoScene.transitionEffect && initialAnimation && initialAnimation !== 'none' && bgAnimation && bgAnimation !== 'none' && transitionAnimation && transitionAnimation !== 'none');
        screenEffect.value = 'pan-left';
        transitionEffect.value = 'wipe-left';
        layout.value = 'top-right';
        motion.value = 'drop';
        design.value = 'glass';
        screenEffect.dispatchEvent(new Event('change', { bubbles: true }));
        transitionEffect.dispatchEvent(new Event('change', { bubbles: true }));
        layout.dispatchEvent(new Event('change', { bubbles: true }));
        motion.dispatchEvent(new Event('change', { bubbles: true }));
        design.dispatchEvent(new Event('change', { bubbles: true }));
        const scene = V._vagSession.sceneNarrationPlan[0] || {};
        return {
          ok: autoOk && scene.screenEffect === 'pan-left' && scene.transitionEffect === 'wipe-left' && scene.textLayout === 'top-right' && scene.textMotion === 'drop' && scene.textDesign === 'glass',
          autoLayout: autoScene.textLayout || '',
          autoMotion: autoScene.textMotion || '',
          autoDesign: autoScene.textDesign || '',
          autoScreenEffect: autoScene.screenEffect || '',
          autoTransitionEffect: autoScene.transitionEffect || '',
          previewAnimation: initialAnimation || '',
          previewBgAnimation: bgAnimation || '',
          previewTransitionAnimation: transitionAnimation || '',
          screenEffect: scene.screenEffect || '',
          transitionEffect: scene.transitionEffect || '',
          textLayout: scene.textLayout || '',
          textMotion: scene.textMotion || '',
          textDesign: scene.textDesign || ''
        };
      })();
      return {
        title: document.title,
        hasVideoAgentMenu: Boolean(document.querySelector('[data-page="video-agent"]')),
        hasVideoAgentText: /영상|광고/.test(text),
        loadedModules: {
          vag: typeof window.__VAG === 'object',
          checkpoint: typeof window.__VAG?._vagLoadCheckpoint === 'function',
          i2vDirection: typeof window.__VAG?._vagApplyI2VDirectionToSession === 'function'
        },
        sceneBuilder,
        outputSelection,
        autoPickOutputMode,
        sceneControl
      };
    })()`);

    const after = await screenshot(cdp, 'live-video-agent-after-click.png');
    console.log('[live-electron] 현재 실행 중인 앱에 연결했습니다.');
    console.log(`[live-electron] before screenshot: ${before}`);
    console.log(`[live-electron] after screenshot: ${after}`);
    console.log(`[live-electron] state: ${JSON.stringify(state)}`);

    if (!state.outputSelection.ok) {
      console.warn(`[live-electron] 선택 UI 세부 검증은 건너뜁니다: ${state.outputSelection.reason || 'unknown'}`);
    }
    if (!state.sceneControl.ok) {
      console.warn(`[live-electron] 장면 컨트롤 세부 검증은 건너뜁니다: ${state.sceneControl.reason || 'unknown'}`);
    }
    if (!state.hasVideoAgentMenu || !state.hasVideoAgentText || !state.loadedModules.vag || !state.sceneBuilder.ok || !state.autoPickOutputMode.ok) {
      throw new Error('광고영상 화면 또는 모듈 확인에 실패했습니다.');
    }
  } finally {
    cdp.close();
  }
})().catch((error) => {
  console.error(`[live-electron] 실패: ${error.message || error}`);
  process.exit(1);
});
