/* 단일콘텐츠 화면 상단 이미지 모델 표시 */
(function () {
  const PROVIDER_LABELS = {
    cli: 'CLI',
    codex: 'Codex CLI',
    claude: 'Claude Code',
    'gemini-cli': 'Gemini CLI',
    gemini: 'Gemini API',
    atlas: 'Atlas Cloud',
  };

  let cachedModel = null;
  let cachedAt = 0;
  const CONTENT_MODEL_PAGES = {
    'keyword-content': '종합 콘텐츠 생성 전 현재 설정 모델을 사용합니다.',
    'blog-agent': '블로그 글과 블로그 이미지 생성 전 현재 설정 모델을 사용합니다.',
    'cardnews-editor2': '카드뉴스 글과 이미지 생성 전 현재 설정 모델을 사용합니다.',
    'comic-agent': '만화 스토리와 이미지 생성 전 현재 설정 모델을 사용합니다.',
    'detailpage-agent': '상세페이지 섹션 이미지 생성 시작 전 설정 모델을 사용합니다.',
    'single-blog': '블로그 이미지 생성 시 설정 모델을 사용합니다.',
    'single-cardnews': '카드뉴스 이미지 생성 시작 전 이 모델을 사용합니다.',
    'single-comic-story': '스토리만화 이미지 생성 전 설정 모델을 먼저 확인합니다.',
    'manual-cardnews': '카드뉴스 편집 생성 전 현재 설정 모델을 사용합니다.',
    'biz-cardnews': '카드뉴스와 영상 생성 전 현재 설정 모델을 사용합니다.',
    'cardnews': '카드뉴스 생성 전 현재 설정 모델을 사용합니다.',
  };

  function inferProviderFromModel(model, kind) {
    const value = String(model || '').trim().toLowerCase();
    if (!value) return '';
    if (value === 'claude-code' || value === 'claude-cli') return 'claude';
    if (value === 'gemini-cli' || value.includes('gemini cli')) return 'gemini-cli';
    if (value.startsWith('gemini') || value.startsWith('imagen')) return 'gemini';
    if (
      value.startsWith('openai/') ||
      value.startsWith('qwen/') ||
      value.startsWith('baidu/') ||
      value.startsWith('alibaba/') ||
      value.startsWith('atlascloud/')
    ) return 'atlas';
    if (value.includes('codex-cli')) return 'cli';
    if (kind === 'text' && (value.includes('claude') || value.includes('gpt') || value.includes('qwen') || value.includes('deepseek') || value.includes('kimi'))) return 'atlas';
    return '';
  }

  function providerLabel(provider) {
    const key = String(provider || '').trim().toLowerCase();
    return PROVIDER_LABELS[key] || provider || '설정';
  }

  async function loadImageModelSetting(force) {
    const now = Date.now();
    if (!force && cachedModel && now - cachedAt < 3000) return cachedModel;

    let models = {};
    try {
      const config = typeof api === 'function'
        ? await api('/api/config')
        : await fetch('/api/config').then(res => res.json());
      models = config?.MODELS || {};
    } catch (e) {
      models = window._contentOpts || {};
    }

    let textProvider = String(models.text_provider || '').trim();
    let textModel = String(models.text_model || '').trim();
    let imageProvider = String(models.image_provider || '').trim();
    let imageModel = String(models.image_model || '').trim();
    if (!textProvider) textProvider = String(window._contentOpts?.text_provider || '').trim();
    if (!textModel) textModel = String(window._contentOpts?.text_model || '').trim();
    if (!imageProvider) imageProvider = String(window._contentOpts?.image_provider || '').trim();
    if (!imageModel) imageModel = String(window._contentOpts?.image_model || '').trim();

    const inferredText = inferProviderFromModel(textModel, 'text');
    const inferredImage = inferProviderFromModel(imageModel, 'image');
    if (inferredText && (!textProvider || textProvider === 'cli' || textProvider === 'codex')) textProvider = inferredText;
    if (inferredImage && (!imageProvider || imageProvider === 'cli' || imageProvider === 'codex')) imageProvider = inferredImage;
    if (!textProvider) textProvider = '설정';
    if (!textModel) textModel = '설정값';
    if (!imageProvider) imageProvider = '설정';
    if (!imageModel) imageModel = '설정값';

    cachedModel = {
      textProvider,
      textModel,
      imageProvider,
      imageModel,
      label: `글: ${providerLabel(textProvider)} · ${textModel}  /  이미지: ${providerLabel(imageProvider)} · ${imageModel}`,
    };
    cachedAt = now;
    return cachedModel;
  }

  function ensureBanner(pageId, options = {}) {
    const page = document.getElementById(`page-${pageId}`) || document.getElementById(pageId);
    if (!page) return null;
    const id = `mkk-single-image-model-banner-${pageId}`;
    let banner = document.getElementById(id);
    if (banner) return banner;

    banner = document.createElement('div');
    banner.id = id;
    banner.className = 'mkk-single-image-model-banner';
    banner.style.cssText = [
      'margin:0 0 16px',
      'padding:12px 14px',
      'border:1px solid rgba(255,140,0,0.18)',
      'border-radius:14px',
      'background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,255,255,0.92))',
      'box-shadow:0 8px 22px rgba(15,23,42,0.04)',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:12px',
      'flex-wrap:wrap',
    ].join(';');
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:220px;">
        <div style="width:34px;height:34px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(255,140,0,0.22);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:17px;height:17px;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
        </div>
        <div>
          <div style="font-size:11px;font-weight:900;color:#ff8c00;letter-spacing:0;">사용 모델</div>
          <div data-single-image-model-label style="font-size:14px;font-weight:900;color:#1c1c1e;margin-top:2px;">설정 확인 중...</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
        <div style="font-size:12px;color:rgba(0,0,0,0.46);line-height:1.55;text-align:right;">
          ${options.note || '생성 시작 전 이 설정으로 요청을 보냅니다.'}
        </div>
        <button type="button" onclick="mkkOpenModelSettings()" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#ff8c00;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(255,140,0,0.08);">변경하기</button>
      </div>
    `;

    const header = page.querySelector(':scope > .page-header');
    if (header && header.nextSibling) {
      page.insertBefore(banner, header.nextSibling);
    } else if (header) {
      page.appendChild(banner);
    } else {
      page.insertBefore(banner, page.firstChild);
    }
    return banner;
  }

  async function renderSingleImageModelBanner(pageId, options = {}) {
    const banner = ensureBanner(pageId, options);
    if (!banner) return;
    const label = banner.querySelector('[data-single-image-model-label]');
    try {
      const setting = await loadImageModelSetting(!!options.force);
      if (label) label.textContent = setting.label;
    } catch (e) {
      if (label) label.textContent = '설정값 확인 실패';
    }
  }

  function renderActiveContentModelBanners() {
    Object.entries(CONTENT_MODEL_PAGES).forEach(([pageId, note]) => {
      const page = document.getElementById(`page-${pageId}`);
      if (page && page.classList.contains('active')) {
        renderSingleImageModelBanner(pageId, { note });
      }
    });
  }

  window.mkkLoadImageModelSetting = loadImageModelSetting;
  window.mkkRenderSingleImageModelBanner = renderSingleImageModelBanner;
  window.mkkRenderActiveContentModelBanners = renderActiveContentModelBanners;
  window.mkkOpenModelSettings = function () {
    if (typeof navigateToPage === 'function') {
      navigateToPage('settings', { skipConfirm: true });
    }
    setTimeout(() => {
      const target = document.getElementById('set-image-provider') || document.getElementById('set-text-provider');
      const section = target?.closest('[style*="background"]')?.parentElement || target;
      if (section && typeof section.scrollIntoView === 'function') {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (target && typeof target.focus === 'function') target.focus();
    }, 350);
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderActiveContentModelBanners();
    const observer = new MutationObserver(renderActiveContentModelBanners);
    document.querySelectorAll('.page').forEach(page => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
  });
})();
