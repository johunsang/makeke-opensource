const assert = require('node:assert/strict');
const path = require('node:path');

const screenshotPath = (name) => path.join(process.cwd(), 'artifacts', 'wdio', `${name}.png`);
const logStep = (message) => console.log(`[wdio:video-agent] ${message}`);

async function waitForMakekeReady() {
  await browser.waitUntil(async () => {
    return browser.execute(() => document.readyState === 'complete' && !!document.querySelector('[data-page="video-agent"]'));
  }, {
    timeout: 30000,
    timeoutMsg: '마케케 첫 화면을 불러오지 못했습니다.',
  });
}

describe('광고영상 Electron 화면', () => {
  beforeEach(async () => {
    await waitForMakekeReady();
  });

  it('배경음악 실패 체크포인트가 있으면 이어하기 화면을 보여준다', async () => {
    logStep('테스트 체크포인트를 localStorage에 저장');
    await browser.execute(() => {
      const checkpoint = {
        savedAt: '2026-04-28T16:00:00.000Z',
        stage: 'bgm_failed',
        topic: 'WebdriverIO 체크포인트 테스트',
        aspect: '9:16',
        duration: 12,
        html: '<!doctype html><html><body><main id="stage"><section data-start="0" data-duration="12">체크포인트 화면</section></main></body></html>',
        narrationScript: '체크포인트에서 다시 시작합니다.',
        sceneNarrationPlan: [{
          title: '체크포인트 화면',
          body: '저장된 장면을 다시 엽니다.',
          narration: '체크포인트에서 다시 시작합니다.',
        }],
        sceneImages: [],
        bgmAttempt: 1,
        bgmError: '테스트용 배경음악 실패',
      };
      localStorage.setItem('makeke:vag:lastCheckpoint', JSON.stringify(checkpoint));
    });

    logStep('광고영상 메뉴 클릭');
    await $('[data-page="video-agent"]').click();
    await browser.waitUntil(async () => {
      return browser.execute(() => document.body.innerText.includes('이전에 멈춘 영상이 있습니다.'));
    }, {
      timeout: 20000,
      timeoutMsg: '체크포인트 이어하기 안내가 표시되지 않았습니다.',
    });

    logStep('체크포인트 함수 로드 상태 확인');
    const apiTypes = await browser.execute(() => ({
      save: typeof window.__VAG?._vagSaveCheckpoint,
      load: typeof window.__VAG?._vagLoadCheckpoint,
      resume: typeof window.__VAG?._vagResumeLastCheckpoint,
      renderCheckpoint: typeof window.__VAG?._vagRenderCheckpointVideo,
    }));
    assert.deepEqual(apiTypes, {
      save: 'function',
      load: 'function',
      resume: 'function',
      renderCheckpoint: 'function',
    });

    await browser.saveScreenshot(screenshotPath('video-agent-checkpoint-offer'));
    logStep('이어하기 안내 화면 캡처 저장: artifacts/wdio/video-agent-checkpoint-offer.png');

    logStep('이어서 하기 클릭');
    await $('//button[normalize-space(.)="이어서 하기"]').click();
    await browser.waitUntil(async () => {
      return browser.execute(() => {
        const text = document.body.innerText;
        return text.includes('배경음악 다시 만들고 영상 생성') && text.includes('배경음악 없이 영상 생성');
      });
    }, {
      timeout: 20000,
      timeoutMsg: '체크포인트 복원 후 재개 버튼이 표시되지 않았습니다.',
    });

    logStep('복원된 세션 값 확인');
    const restored = await browser.execute(() => ({
      topic: window.__VAG?._vagSession?.baseTopic,
      stage: window.__VAG?._vagSession?.resumePoint,
      hasHtml: !!window.__VAG?._vagHyperHtml,
      hasPreview: !!document.querySelector('#vag-html-motion-preview'),
    }));
    assert.equal(restored.topic, 'WebdriverIO 체크포인트 테스트');
    assert.equal(restored.stage, 'bgm_failed');
    assert.equal(restored.hasHtml, true);
    assert.equal(restored.hasPreview, true);

    await browser.saveScreenshot(screenshotPath('video-agent-checkpoint-resumed'));
    logStep('이어하기 복원 화면 캡처 저장: artifacts/wdio/video-agent-checkpoint-resumed.png');
  });
});
