const assert = require('node:assert/strict');
const path = require('node:path');

const screenshotPath = (name) => path.join(process.cwd(), 'artifacts', 'wdio', `${name}.png`);
const logStep = (message) => console.log(`[wdio:cardnews] ${message}`);

async function waitForMakekeReady() {
  await browser.waitUntil(async () => {
    return browser.execute(() => (
      document.readyState === 'complete' &&
      typeof window.kcGenerateCardnewsImages === 'function' &&
      typeof window.ce2Init === 'function'
    ));
  }, {
    timeout: 30000,
    timeoutMsg: '마케케 카드뉴스 화면 함수를 불러오지 못했습니다.',
  });
}

async function installCardnewsApiMock() {
  await browser.execute(() => {
    window.__cardnewsIntegrationRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = String(typeof input === 'string' ? input : input?.url || '');
      let body = null;
      if (typeof init.body === 'string') {
        try { body = JSON.parse(init.body); } catch {}
      }

      const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

      if (url.includes('/api/cardnews/generate-texts')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'generate-texts', body });
        return jsonResponse({
          project_dir: 'output/cardnews/e2e',
          cardnews_id: 777,
          slides: [{
            slide_number: 1,
            role: '표지',
            title: '방문 전 준비사항',
            body: '처음 방문해도 헷갈리지 않게 핵심만 확인하세요.',
            visual_prompt: 'complete Korean card news cover with clear title and body inside image',
          }],
        });
      }

      if (url.includes('/api/cardnews/generate-single')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'generate-single', body });
        const number = body?.slide?.slide_number || window.__cardnewsIntegrationRequests.filter(r => r.endpoint === 'generate-single').length;
        return jsonResponse({
          image_url: `e2e/slide_${String(number).padStart(2, '0')}.png`,
          project_dir: 'output/cardnews/e2e',
          cardnews_id: 777,
        });
      }

      if (url.includes('/api/cardnews/ai-style')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'ai-style', body });
        return jsonResponse({ style: 'modern' });
      }

      if (url.includes('/api/ce2/save')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'ce2-save', body });
        return jsonResponse({ ok: true, folder: 'output/cardnews/e2e', files: ['slide_01.png'] });
      }

      if (url.includes('/api/ce2/assist')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'ce2-assist', body });
        return jsonResponse({
          ok: true,
          caption: '테스트 캡션',
          items: ['전문성 어필', '방문 유도', '브랜드 인지도'],
        });
      }

      if (url.includes('/api/ce2/naver-search')) {
        window.__cardnewsIntegrationRequests.push({ endpoint: 'naver-search', body });
        return jsonResponse({
          ok: true,
          items: [{
            title: '네이버 검색 결과',
            description: '검색 결과 설명',
            url: 'https://blog.naver.com/test/123',
            link: 'https://blog.naver.com/test/123',
            source: '블로그',
            type: 'blog',
          }],
        });
      }

      return originalFetch(input, init);
    };
  });
}

async function showPage(pageId) {
  await browser.execute((targetId) => {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const page = document.getElementById(targetId);
    if (page) page.classList.add('active');
    window.scrollTo(0, 0);
  }, pageId);
}

describe('카드뉴스 통합 화면', () => {
  beforeEach(async () => {
    await waitForMakekeReady();
    await installCardnewsApiMock();
  });

  it('통합 콘텐츠 카드뉴스는 AI 완성 이미지만 표시하고 앱 제목/본문을 덧붙이지 않는다', async () => {
    logStep('통합 콘텐츠 카드뉴스 화면 상태 준비');
    await showPage('page-keyword-content');
    await browser.execute(() => {
      window._globalProfileId = 901;
      window._globalProfileData = {
        name: '마케케',
        logo_path: 'makeke.png',
        brand_color: '#ff8c00',
      };
      window._contentOpts = {
        ...window._contentOpts,
        cn_style: 'modern',
        cn_ratio: '1:1',
        cn_resolution: '1K',
        logo_insert: true,
      };
      document.getElementById('kc-keyword').value = '방문 전 준비사항';
      document.getElementById('kc-brand-name').value = '마케케';
      const slides = [{
        slide_number: 1,
        title: '방문 전 준비사항',
        body: '처음 방문해도 헷갈리지 않게 핵심만 확인하세요.',
        visual_prompt: 'complete Korean card news cover',
      }];
      window._cnCarouselUrls = [];
      document.getElementById('kc-cardnews-result').style.display = 'block';
      document.getElementById('kc-cn-editor').style.display = 'block';
      window.kcRenderCardnewsImages({ texts: slides, slides: [], project_dir: '' });
    });

    logStep('통합 콘텐츠 이미지 생성 실행');
    await browser.executeAsync((done) => {
      window.kcGenerateCardnewsImages().then(done).catch(error => done({ error: error.message }));
    });

    await browser.waitUntil(async () => browser.execute(() => (
      document.querySelectorAll('#kc-cn-carousel-img .kc-cn-card-preview img').length === 1
    )), {
      timeout: 15000,
      timeoutMsg: '통합 콘텐츠 카드뉴스 이미지 미리보기가 표시되지 않았습니다.',
    });

    const state = await browser.execute(() => {
      const carousel = document.getElementById('kc-cn-carousel-img');
      const request = window.__cardnewsIntegrationRequests.find(r => r.endpoint === 'generate-single')?.body || {};
      return {
        carouselText: carousel?.innerText.trim() || '',
        imageCount: document.querySelectorAll('#kc-cn-carousel-img .kc-cn-card-preview img').length,
        payloadKeys: Object.keys(request).sort(),
        slideCount: request.slide_count,
        logoEnabled: request.logo_enabled,
        visualPrompt: request.slide?.visual_prompt || '',
      };
    });

    assert.equal(state.imageCount, 1);
    assert.equal(state.carouselText, '');
    assert.equal(state.slideCount, 1);
    assert.equal(state.logoEnabled, true);
    assert.equal(state.payloadKeys.includes('logo_position'), false);
    assert.equal(state.payloadKeys.includes('logo_size'), false);
    assert.equal(state.payloadKeys.includes('logo_opacity'), false);
    assert.match(state.visualPrompt, /complete card news image/i);
    assert.match(state.visualPrompt, /방문 전 준비사항/);
    assert.match(state.visualPrompt, /처음 방문해도/);

    await browser.saveScreenshot(screenshotPath('cardnews-integrated-image-only'));
  });

  it('기본 콘텐츠 카드뉴스는 1장 생성이 가능하고 생성 이미지 아래에 앱 문구를 붙이지 않는다', async () => {
    logStep('기본 콘텐츠 카드뉴스 화면 상태 준비');
    await showPage('page-cardnews-editor2');
    await browser.execute(() => {
      window._globalProfileId = 901;
      window._globalProfileData = {
        name: '마케케',
        logo_path: 'makeke.png',
        brand_color: '#ff8c00',
      };
      window._contentOpts = {
        ...window._contentOpts,
        cn_photo_count: '1',
        logo_insert: true,
      };
      window.ce2Reset();
      document.getElementById('ce2-industry').value = '마케팅 자동화';
      document.getElementById('ce2-topic-input').value = '방문 전 준비사항';
      document.getElementById('ce2-topic').value = '방문 전 준비사항';
      document.getElementById('ce2-purpose').value = '전문성 어필';
    });

    logStep('기본 콘텐츠 1장 카드뉴스 생성 흐름 실행');
    await browser.executeAsync((done) => {
      const clickVisibleButton = (label) => {
        const buttons = [...document.querySelectorAll('button')];
        const button = buttons.find(btn => btn.offsetParent && btn.textContent.trim() === label);
        if (!button) throw new Error(`${label} 버튼을 찾지 못했습니다.`);
        button.click();
      };
      const waitFor = (predicate, timeout = 12000) => new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          try {
            if (predicate()) return resolve();
          } catch (error) {
            return reject(error);
          }
          if (Date.now() - start > timeout) return reject(new Error('대기 시간이 초과되었습니다.'));
          setTimeout(tick, 100);
        };
        tick();
      });

      (async () => {
        await window.ce2OnIndustryEnter();
        await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.includes('전문성 어필')));
        clickVisibleButton('전문성 어필');
        await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === '1장'));
        clickVisibleButton('1장');
        await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === '빼기'));
        clickVisibleButton('빼기');
        await waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.includes('확인하고 이미지 생성 시작')));
        [...document.querySelectorAll('button')].find(btn => btn.textContent.includes('확인하고 이미지 생성 시작')).click();
        await waitFor(() => document.querySelectorAll('#ce2-slides-grid .ce2-slide-card img').length === 1, 20000);
        done({ ok: true });
      })().catch(error => done({ error: error.message }));
    });

    const result = await browser.execute(() => {
      const request = window.__cardnewsIntegrationRequests.find(r => r.endpoint === 'generate-single')?.body || {};
      const grid = document.getElementById('ce2-slides-grid');
      return {
        imageCount: grid?.querySelectorAll('.ce2-slide-card img').length || 0,
        cardText: grid?.querySelector('.ce2-slide-card')?.innerText.trim() || '',
        slideCount: request.slide_count,
        logoEnabled: request.logo_enabled,
        payloadKeys: Object.keys(request).sort(),
        slideTitle: request.slide?.title || '',
        slideBody: request.slide?.body || '',
      };
    });

    assert.equal(result.imageCount, 1);
    assert.doesNotMatch(result.cardText, /방문 전 준비사항|처음 방문해도|마케케|Makeke/);
    assert.equal(result.slideCount, 1);
    assert.equal(result.logoEnabled, true);
    assert.equal(result.payloadKeys.includes('logo_position'), false);
    assert.equal(result.payloadKeys.includes('logo_size'), false);
    assert.equal(result.payloadKeys.includes('logo_opacity'), false);
    assert.equal(result.slideTitle, '방문 전 준비사항');
    assert.match(result.slideBody, /처음 방문해도/);

    await browser.saveScreenshot(screenshotPath('cardnews-basic-one-slide-image-only'));
  });

  it('프로필 로고 설정은 출력별 체크와 위치/크기/투명도 입력을 노출하지 않는다', async () => {
    const hiddenControls = await browser.execute(() => {
      const ids = [
        'lib-opt-logo-cardnews',
        'lib-opt-logo-blogimg',
        'lib-opt-logo-comic',
        'lib-opt-logo-position',
        'lib-opt-logo-size',
        'lib-opt-logo-opacity',
        'go-logo-cardnews',
        'go-logo-blogimg',
        'go-logo-comic',
        'go-logo-position',
        'go-logo-size',
        'go-logo-opacity',
      ];
      return ids.filter(id => document.getElementById(id));
    });

    assert.deepEqual(hiddenControls, []);
  });

  it('Codex 터미널은 자동으로 사용자 화면에 노출되지 않는다', async () => {
    const state = await browser.execute(() => {
      if (typeof window.kcStartCodexLogPolling === 'function') {
        window.kcStartCodexLogPolling();
      }
      const panel = document.getElementById('kc-codex-log-panel');
      return {
        exists: !!panel,
        display: panel ? getComputedStyle(panel).display : '',
        ariaHidden: panel?.getAttribute('aria-hidden') || '',
      };
    });

    assert.equal(state.exists, true);
    assert.equal(state.display, 'none');
    assert.equal(state.ariaHidden, 'true');
  });

  it('네이버 검색 소재 선택은 URL을 보존하고 공통 크롤링 본문을 함께 넣는다', async () => {
    await showPage('page-cardnews-editor2');
    const state = await browser.executeAsync((done) => {
      const waitFor = (predicate, timeout = 10000) => new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          try {
            if (predicate()) return resolve();
          } catch (error) {
            return reject(error);
          }
          if (Date.now() - start > timeout) return reject(new Error('대기 시간이 초과되었습니다.'));
          setTimeout(tick, 100);
        };
        tick();
      });
      (async () => {
        const originalSource = window._VAGSource || {};
        window._VAGSource = {
          ...originalSource,
          scrapeSelectedSources: async (items) => items.map((item) => {
            const url = item.url || item.link || '';
            const textBlock = [
              `[${item.title || ''}]`,
              `URL: ${url}`,
              `크롤링 본문입니다. 네이버 블로그 원문 URL ${url}에서 가져온 테스트 본문입니다.`,
            ].join('\n');
            return {
              title: item.title || '',
              snippet: item.description || '',
              url,
              link: url,
              source: item.source || '',
              type: item.type || 'blog',
              checked: true,
              scrapedText: `크롤링 본문입니다. 네이버 블로그 원문 URL ${url}에서 가져온 테스트 본문입니다.`,
              scrapedImages: ['https://example.com/naver-blog-image.jpg'],
              scrapeStatus: 'mock-scrape',
              textBlock,
            };
          }),
        };
        window.ce2OpenNaverSearchModal({ query: '마케팅 자동화', autoSearch: true });
        await waitFor(() => document.querySelector('#ce2-naver-modal-results input[type="checkbox"]'));
        document.querySelector('#ce2-naver-modal-results input[type="checkbox"]').checked = true;
        await window.ce2NaverApply();
        done({
          content: window._sharedSourceContent || '',
          source: (window._sharedSelectedSources || [])[0] || {},
        });
      })().catch(error => done({ error: error.message }));
    });

    assert.equal(state.error, undefined);
    assert.match(state.content, /https:\/\/blog\.naver\.com\/test\/123/);
    assert.match(state.content, /크롤링 본문입니다/);
    assert.equal(state.source.url, 'https://blog.naver.com/test/123');
    assert.match(state.source.scrapedText, /네이버 블로그 원문 URL/);
    assert.deepEqual(state.source.scrapedImages, ['https://example.com/naver-blog-image.jpg']);
  });
});
