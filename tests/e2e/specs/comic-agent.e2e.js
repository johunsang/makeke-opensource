const assert = require('node:assert/strict');

async function waitForComicReady() {
  await browser.waitUntil(async () => browser.execute(() => (
    document.readyState === 'complete' &&
    typeof window.cagGenerate === 'function' &&
    typeof window.cagInit === 'function'
  )), {
    timeout: 30000,
    timeoutMsg: '만화 에이전트 화면 함수를 불러오지 못했습니다.',
  });
}

async function showComicPage() {
  await browser.execute(() => {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('page-comic-agent')?.classList.add('active');
    window.cagInit();
    window.scrollTo(0, 0);
  });
}

async function installComicApiMock() {
  await browser.execute(() => {
    window.__comicAgentRequests = [];
    const originalFetch = window.fetch.bind(window);
    const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
    const panelsFor = (count) => Array.from({ length: count }, (_v, idx) => ({
      panel_number: idx + 1,
      situation: `${idx + 1}컷 장면`,
      dialogue: `${idx + 1}컷 대사`,
      narration: `${idx + 1}컷 설명`,
      visual_prompt: `${idx + 1}컷 이미지 지시`,
      emotion: 'neutral',
    }));

    window.fetch = async (input, init = {}) => {
      const url = String(typeof input === 'string' ? input : input?.url || '');
      let body = null;
      if (typeof init.body === 'string') {
        try { body = JSON.parse(init.body); } catch {}
      }

      if (url.includes('/api/comic/script')) {
        window.__comicAgentRequests.push({ endpoint: 'script', body });
        const count = Number(body?.panel_count || 4);
        return jsonResponse({
          status: 'ok',
          project_dir: '/tmp/makeke-comic-e2e',
          panel_count: count,
          panels: panelsFor(count),
        });
      }

      if (url.includes('/api/comic/generate-panel')) {
        window.__comicAgentRequests.push({ endpoint: 'generate-panel', body });
        const n = Number(body?.panel?.panel_number || 1);
        return jsonResponse({
          status: 'ok',
          image_path: `/tmp/makeke-comic-e2e/panel_${String(n).padStart(2, '0')}.png`,
          image_url: `makeke-comic-e2e/panel_${String(n).padStart(2, '0')}.png`,
        });
      }

      if (url.includes('/api/comic/recompose')) {
        window.__comicAgentRequests.push({ endpoint: 'recompose', body });
        return jsonResponse({
          status: 'ok',
          project_dir: body?.project_dir || '/tmp/makeke-comic-e2e',
          composed_image: '/tmp/makeke-comic-e2e/comic_full.png',
        });
      }

      if (url.includes('/api/comic/story-series')) {
        window.__comicAgentRequests.push({ endpoint: 'story-series', body });
        const episodes = Number(body?.episode_count || 1);
        const panels = Number(body?.panel_count || 4);
        return jsonResponse({
          status: 'ok',
          episode_count: episodes,
          panel_count: panels,
          project_dir: '/tmp/makeke-comic-series-e2e',
          episodes: Array.from({ length: episodes }, (_v, idx) => ({
            episode_number: idx + 1,
            title: `${idx + 1}회차`,
            panels: panelsFor(panels),
            composed_image: `/tmp/makeke-comic-series-e2e/episode_${String(idx + 1).padStart(2, '0')}/comic_full.png`,
          })),
        });
      }

      if (url.includes('/api/cag/save')) {
        window.__comicAgentRequests.push({ endpoint: 'cag-save', body });
        return jsonResponse({ ok: true });
      }

      return originalFetch(input, init);
    };
  });
}

async function runComicFlow({ episodesLabel, panelsLabel }) {
  return browser.executeAsync(({ episodesLabel, panelsLabel }, done) => {
    const waitFor = (predicate, timeout = 15000) => new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        try {
          if (predicate()) return resolve();
        } catch (error) {
          return reject(error);
        }
        if (Date.now() - start > timeout) return reject(new Error('대기 시간이 초과되었습니다.'));
        setTimeout(tick, 80);
      };
      tick();
    });
    const clickButton = (label) => {
      const button = [...document.querySelectorAll('button')]
        .find(btn => btn.offsetParent && btn.textContent.trim() === label);
      if (!button) throw new Error(`${label} 버튼을 찾지 못했습니다.`);
      button.click();
    };

    (async () => {
      window._globalProfileId = 901;
      window._globalProfileData = { name: '마케케', brand_color: '#ff8c00' };
      window._contentOpts = { ...(window._contentOpts || {}), comic_style: 'cute' };
      window.cagRestart();
      const flow = window.cagGenerate();
      await waitFor(() => document.getElementById('cag-chat-topic-input'));
      document.getElementById('cag-chat-topic-input').value = '방문 전 준비사항';
      document.getElementById('cag-chat-topic-go').click();
      await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === '소재 없이 진행'));
      clickButton('소재 없이 진행');
      await waitFor(() => document.querySelector('.cag-multi-style-options [data-role="confirm"]'));
      document.querySelector('.cag-multi-style-options [data-role="confirm"]').click();
      await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === episodesLabel));
      clickButton(episodesLabel);
      await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === panelsLabel));
      clickButton(panelsLabel);
      if (episodesLabel === '1회') {
        await waitFor(() => document.querySelector('.cag-inline-card [data-role="submit"]'));
        document.querySelector('.cag-inline-card [data-role="submit"]').click();
      }
      await flow;
      done({
        requests: window.__comicAgentRequests,
        text: document.getElementById('cag-chat-body')?.innerText || '',
        hiddenEpisodes: document.getElementById('cag-episodes')?.value || '',
        hiddenPanels: document.getElementById('cag-panels')?.value || '',
      });
    })().catch(error => done({ error: error.message, stack: error.stack }));
  }, { episodesLabel, panelsLabel });
}

describe('만화 에이전트 회차와 컷 수', () => {
  beforeEach(async () => {
    await waitForComicReady();
    await installComicApiMock();
    await showComicPage();
  });

  it('단편 만화는 선택한 컷 수를 스크립트, 컷 생성, 합성에 그대로 전달한다', async () => {
    const state = await runComicFlow({ episodesLabel: '1회', panelsLabel: '6컷' });
    assert.equal(state.error, undefined);

    const script = state.requests.find(req => req.endpoint === 'script')?.body || {};
    const panelRequests = state.requests.filter(req => req.endpoint === 'generate-panel');
    const recompose = state.requests.find(req => req.endpoint === 'recompose')?.body || {};

    assert.equal(state.hiddenEpisodes, '1');
    assert.equal(state.hiddenPanels, '6');
    assert.equal(script.panel_count, 6);
    assert.equal(script.layout, '3x2');
    assert.equal(panelRequests.length, 6);
    assert.equal(recompose.layout, '3x2');
    assert.equal(recompose.panels.length, 6);
    assert.match(state.text, /1회차 · 각 6컷/);
  });

  it('연재 만화는 회차 수와 각 회차 컷 수를 story-series에 함께 전달한다', async () => {
    const state = await runComicFlow({ episodesLabel: '3회', panelsLabel: '2컷' });
    assert.equal(state.error, undefined);

    const series = state.requests.find(req => req.endpoint === 'story-series')?.body || {};
    assert.equal(state.hiddenEpisodes, '3');
    assert.equal(state.hiddenPanels, '2');
    assert.equal(series.episode_count, 3);
    assert.equal(series.panel_count, 2);
    assert.equal(series.layout, '2x1');
    assert.match(state.text, /3회차 · 각 2컷/);
  });
});
