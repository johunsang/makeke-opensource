// keyword_content/cardnews.js — 카드뉴스 편집/재생성/캐러셀

function kcCardnewsImageUrl(raw, withCache = true) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^(data:|blob:)/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return withCache ? value + (value.includes('?') ? '&' : '?') + 't=' + Date.now() : value;
  }

  let path = value.split('#')[0].split('?')[0].replace(/\\/g, '/');
  if (path.startsWith('/api/cardnews/image/')) {
    path = path.slice('/api/cardnews/image/'.length);
  }
  const marker = '/cardnews/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex >= 0) {
    path = path.slice(markerIndex + marker.length);
  }
  path = path.replace(/^\/+/, '');

  const encoded = path
    .split('/')
    .filter(Boolean)
    .map(part => {
      try { return encodeURIComponent(decodeURIComponent(part)); }
      catch { return encodeURIComponent(part); }
    })
    .join('/');
  const url = '/api/cardnews/image/' + encoded;
  return withCache ? url + '?t=' + Date.now() : url;
}

function kcCardnewsLogoUrl() {
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  const profile = window._globalProfileData || {};
  const logoPath = String(profile.logo_path || '').trim();
  if (!profileId || !logoPath) return '';
  return encImg('/api/library/image/' + profileId + '/' + logoPath);
}

function kcCardnewsLogoEnabled() {
  try {
    return !!(
      typeof getOpt === 'function' &&
      getOpt('logo_insert', false) &&
      kcCardnewsLogoUrl()
    );
  } catch {}
  return false;
}

function kcCardnewsCurrentRatio() {
  if (window.MKK_CARDNEWS_RATIOS?.currentKeyword) return window.MKK_CARDNEWS_RATIOS.currentKeyword();
  return document.querySelector('input[name="kc-cn-ratio"]:checked')?.value || (typeof getOpt === 'function' ? getOpt('cn_ratio', '1:1') : '1:1');
}

function kcCardnewsAspectCss(ratio) {
  if (window.MKK_CARDNEWS_RATIOS?.css) return window.MKK_CARDNEWS_RATIOS.css(ratio || kcCardnewsCurrentRatio());
  if (ratio === '9:16') return '9 / 16';
  if (ratio === '16:9') return '16 / 9';
  if (ratio === '4:5') return '4 / 5';
  return '1 / 1';
}

function kcCardnewsSlideCardHtml(imageUrl, slide, index, options = {}) {
  const safeUrl = kcCardnewsImageUrl(imageUrl);
  const clickable = options.clickable !== false;
  const aspectRatio = kcCardnewsAspectCss(options.ratio || options.aspectRatio);
  return `
    <div class="kc-cn-card-preview" style="position:relative;aspect-ratio:${escapeHtml(aspectRatio)};border-radius:${options.radius || 12}px;overflow:hidden;background:#111;box-shadow:${options.shadow || 'none'};cursor:${clickable ? 'pointer' : 'default'};" ${clickable ? `onclick="kcShowImagePreview('${safeUrl}', ${index})"` : ''}>
      <img src="${safeUrl}" alt="카드뉴스 슬라이드 ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block;">
    </div>
  `;
}

// ── 카드뉴스 중간 편집 ──

function kcRenderCnEditor(slides) {
  const container = document.getElementById('kc-cn-slides-edit');
  if (!container) return;
  container.innerHTML = slides.map((s, i) => `
    <div style="background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="font-size:13px;font-weight:600;color:#ff9500;margin-bottom:8px;">슬라이드 ${s.slide_number || i+1}</div>
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:11px;color:rgba(0,0,0,0.4);">제목</label>
        <input type="text" id="kc-cn-title-${i}" value="${escapeHtml(s.title || '')}" style="font-size:13px;padding:8px 12px;" onchange="kcMarkPromptStale(${i})">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <label style="font-size:11px;color:rgba(0,0,0,0.4);">본문</label>
        <textarea id="kc-cn-body-${i}" rows="2" style="font-size:13px;padding:8px 12px;" onchange="kcMarkPromptStale(${i})">${escapeHtml(s.body || '')}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <label style="font-size:11px;color:rgba(0,0,0,0.4);">이미지 프롬프트 (영문)</label>
          <button class="btn btn-sm" id="kc-cn-regen-${i}" onclick="kcRegenPrompt(${i})" style="font-size:10px;padding:2px 8px;background:#007aff;color:#fff;border:none;border-radius:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>AI 재생성</button>
        </div>
        <input type="text" id="kc-cn-prompt-${i}" value="${escapeHtml(s.visual_prompt || '')}" style="font-size:12px;padding:8px 12px;color:rgba(0,0,0,0.5);margin-top:4px;">
      </div>
    </div>
  `).join('');
}

// 제목/본문 변경 시 프롬프트가 오래됨 표시
function kcMarkPromptStale(idx) {
  const btn = document.getElementById('kc-cn-regen-' + idx);
  if (btn) { btn.style.background = '#ff3b30'; btn.textContent = '프롬프트 갱신 필요'; }
}

// AI로 이미지 프롬프트 재생성
async function kcRegenPrompt(idx) {
  const title = document.getElementById('kc-cn-title-' + idx)?.value || '';
  const body = document.getElementById('kc-cn-body-' + idx)?.value || '';
  const promptEl = document.getElementById('kc-cn-prompt-' + idx);
  const btn = document.getElementById('kc-cn-regen-' + idx);
  if (!title && !body) { toast('제목이나 본문을 입력하세요', 'error'); return; }

  btn.disabled = true;
  btn.textContent = '생성 중...';
  btn.style.background = '#ff9500';

  try {
    const res = await api('/api/content/translate', {
      method: 'POST',
      body: { text: `Generate an image prompt in English for a complete Korean Instagram card news slide. Return ONLY the English image prompt, nothing else.\n\nTitle: ${title}\nBody: ${body}\n\nThe prompt should tell the AI image model to include the provided Korean title and body text inside the card, while freely deciding the natural composition, layout, hierarchy, and typography. If a brand logo/reference image is supplied later, integrate it naturally into the card design rather than relying on an app overlay. Do not add unrelated English labels, fake text, random labels, or watermarks.` },
    });
    promptEl.value = res.translated || '';
    btn.textContent = 'AI 재생성';
    btn.style.background = '#34c759';
    toast(`슬라이드 ${idx + 1} 프롬프트 재생성 완료`);
    setTimeout(() => { btn.style.background = '#007aff'; }, 2000);
  } catch (e) {
    btn.textContent = '실패';
    btn.style.background = '#ff3b30';
    toast('프롬프트 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// 개별 슬라이드 재생성
async function kcRetrySlide(idx) {
  const slides = kcGetEditedSlides();
  if (!slides[idx]) return;
  const keyword = document.getElementById('kc-keyword').value.trim();
  const style = [...document.querySelectorAll('input[name="kc-cn-style"]:checked')].map(c => c.value).join(',') || 'modern';
  const ratio = kcCardnewsCurrentRatio();
  const brand = document.getElementById('kc-business-name')?.value || '';
  const profileId = parseInt(window._globalProfileId || 0);
  const profile = window._globalProfileData || {};
  const logoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
  const logoEnabled = kcCardnewsLogoEnabled();

  const container = document.getElementById('kc-slide-' + idx);
  if (container) container.innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span><div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:6px;">재생성 중...</div></div>';

  try {
    const selectedImages = kcGetSelectedImageUrls();
    const res = await api('/api/cardnews/generate-single', {
      method: 'POST',
      body: {
        slide: slides[idx],
        topic: keyword,
        style,
        aspect_ratio: ratio,
        project_dir: _kcCardnewsDir || '',
        cardnews_id: _kcCnCardnewsId || null,
        brand_name: brand,
        brand_logo_url: logoUrl,
        logo_enabled: logoEnabled,
        logo_text: '',
        user_image_url: selectedImages[idx % Math.max(1, selectedImages.length)] || '',
        user_image_urls: selectedImages,
        design_ref_url: _kcSelectedDesignRef || '',
        image_provider: window._contentOpts?.image_provider || '',
        image_model: window._contentOpts?.image_model || '',
        profile_id: parseInt(window._globalProfileId || 0),
        use_profile_design_ref: selectedImages.length === 0 && !_kcSelectedDesignRef,
      },
    });
    if (res.image_url) {
      if (!_kcCardnewsDir && res.project_dir) _kcCardnewsDir = res.project_dir;
      if (!_kcCnCardnewsId && res.cardnews_id) _kcCnCardnewsId = res.cardnews_id;
      const fullUrl = kcCardnewsImageUrl(res.image_url);
      container.innerHTML = kcCardnewsSlideCardHtml(fullUrl, slides[idx], idx, { radius: 10, ratio });
      toast(`슬라이드 ${idx + 1} 재생성 성공!`);
    } else {
      throw new Error('이미지 없음');
    }
  } catch (e) {
    if (container) container.innerHTML = `<div style="padding:20px;text-align:center;background:rgba(0,0,0,0.03);border:1px dashed rgba(255,59,48,0.3);border-radius:10px;">
      <div style="color:#ff3b30;font-size:12px;margin-bottom:8px;">재생성 실패</div>
      <button class="btn btn-sm" onclick="kcRetrySlide(${idx})" style="background:#007aff;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:11px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 시도</button>
    </div>`;
    toast('재생성 실패: ' + e.message, 'error');
  }
}

function kcGetEditedSlides() {
  return _kcCnTexts.map((s, i) => ({
    slide_number: s.slide_number || i + 1,
    title: document.getElementById('kc-cn-title-' + i)?.value || s.title,
    body: document.getElementById('kc-cn-body-' + i)?.value || s.body,
    visual_prompt: document.getElementById('kc-cn-prompt-' + i)?.value || s.visual_prompt,
  }));
}

function kcRenderCardnewsMeta(meta) {
  const el = document.getElementById('kc-cn-meta');
  if (!el) return;
  const textProvider = String(meta?.text_provider || '').trim();
  const textModel = String(meta?.text_model || '').trim();
  const imageProvider = String(meta?.image_provider || '').trim();
  const imageModel = String(meta?.image_model || '').trim();
  if (!textProvider && !imageProvider && !textModel && !imageModel) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  const items = [];
  if (textProvider || textModel) items.push(`텍스트: ${(textProvider || '-')} / ${(textModel || '-')}`);
  if (imageProvider || imageModel) items.push(`이미지: ${(imageProvider || '-')} / ${(imageModel || '-')}`);
  el.innerHTML = items.map(item => `<span style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.12);border:1px solid rgba(255,140,0,0.18);font-size:11px;font-weight:700;color:#ff8c00;">${escapeHtml(item)}</span>`).join('');
  el.style.display = 'flex';
}


async function kcLoadDesignRefs() {
  const profileId = window._globalProfileId;
  const containers = [
    { el: document.getElementById('kc-design-ref-select'), grid: document.getElementById('kc-design-ref-grid') },
    { el: document.getElementById('kc-design-ref-main'), grid: document.getElementById('kc-design-ref-main-grid') },
  ];

  if (!profileId) {
    containers.forEach(c => { if (c.el) c.el.style.display = 'none'; });
    return;
  }

  try {
    const res = await api(`/api/library/profiles/${profileId}/design-refs`);
    const refs = res.refs || [];
    if (refs.length === 0) {
      containers.forEach(c => { if (c.el) c.el.style.display = 'none'; });
      return;
    }

    const html = `<div onclick="kcSelectDesignRef('')" style="width:60px;height:60px;border-radius:8px;border:2px solid ${!_kcSelectedDesignRef ? '#007aff' : 'rgba(0,0,0,0.08)'};display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(0,0,0,0.02);">
      <span style="font-size:10px;color:rgba(0,0,0,0.3);text-align:center;">없음</span>
    </div>` + refs.map(f => {
      const url = `/api/library/image/${profileId}/design_refs/${f}`;
      const selected = _kcSelectedDesignRef === url;
      return `<div onclick="kcSelectDesignRef('${url}')" style="width:60px;height:60px;border-radius:8px;overflow:hidden;border:2px solid ${selected ? '#007aff' : 'rgba(0,0,0,0.08)'};cursor:pointer;transition:border-color 0.2s;">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;${selected ? '' : 'opacity:0.6;'}">
      </div>`;
    }).join('');

    containers.forEach(c => {
      if (c.el) c.el.style.display = 'block';
      if (c.grid) c.grid.innerHTML = html;
    });
  } catch {
    containers.forEach(c => { if (c.el) c.el.style.display = 'none'; });
  }
}

function kcSelectDesignRef(url) {
  _kcSelectedDesignRef = url;
  kcLoadDesignRefs(); // 리렌더
  if (url) toast('디자인 참조 선택됨');
}

function kcEnsureCardnewsLiveProgress(slides) {
  const result = document.getElementById('kc-cardnews-result');
  if (!result) return null;
  let board = document.getElementById('kc-cn-live-progress');
  const aspectRatio = kcCardnewsAspectCss(kcCardnewsCurrentRatio());

  if (!board) {
    board = document.createElement('div');
    board.id = 'kc-cn-live-progress';
    board.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;';
    result.prepend(board);
  } else if (board.parentNode !== result) {
    board.remove();
    result.prepend(board);
  }

  board.innerHTML = (slides || []).map((slide, idx) => `
    <div id="kc-cn-live-${idx}" style="border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 18px rgba(15,23,42,0.05);">
      <div style="aspect-ratio:${escapeHtml(aspectRatio)};display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,107,0,0.04));color:rgba(0,0,0,0.36);font-size:12px;font-weight:800;">
        대기
      </div>
      <div style="padding:10px;">
        <div style="font-size:11px;font-weight:800;color:#1c1c1e;">슬라이드 ${idx + 1}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);line-height:1.5;margin-top:4px;">${escapeHtml(slide?.title || '')}</div>
        <div class="kc-cn-live-meta" style="font-size:10px;color:#ff8c00;margin-top:6px;">생성 대기</div>
      </div>
    </div>
  `).join('');
  return board;
}

function kcSetCardnewsLiveProgress(index, status, imageUrl = '', slide = null, message = '', ratio = '') {
  const card = document.getElementById(`kc-cn-live-${index}`);
  if (!card) return;
  const meta = card.querySelector('.kc-cn-live-meta');
  if (status === 'loading') {
    card.querySelector('div').innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span>생성 중';
    if (meta) meta.textContent = '이미지 생성 중...';
    return;
  }
  if (status === 'done') {
    const safeUrl = kcCardnewsImageUrl(imageUrl);
    card.innerHTML = `
      ${kcCardnewsSlideCardHtml(safeUrl, slide, index, { radius: 0, badge: '완료', ratio: ratio || kcCardnewsCurrentRatio() })}
    `;
    return;
  }
  card.querySelector('div').innerHTML = '<span style="color:#ff3b30;font-size:16px;margin-right:8px;">!</span>실패';
  if (meta) {
    meta.textContent = message || '생성 실패';
    meta.style.color = '#ff3b30';
  }
}

async function kcGenerateCardnewsImages(options = {}) {
  const reviewPrompts = false;
  if (_kcCnGenerating) { toast('이미 생성 중입니다', 'error'); return; }
  _kcCnGenerating = true;

  // 즉시 버튼 비활성화 + 로딩 표시
  const btn = document.getElementById('kc-cn-gen-img-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 이미지 생성 중...';

  let slides = kcGetEditedSlides();
  if (reviewPrompts) {
    const reviewedSlides = await kcOpenCardnewsImagePromptModal(slides);
    if (!reviewedSlides) {
      _kcCnGenerating = false;
      btn.disabled = false;
      btn.innerHTML = '이미지 생성';
      return false;
    }
    slides = reviewedSlides;
    slides.forEach((slide, i) => {
      const input = document.getElementById('kc-cn-prompt-' + i);
      if (input) input.value = slide.visual_prompt || '';
    });
  }
  slides = slides.map((slide, idx) => ({
    ...slide,
    visual_prompt: kcBuildCardnewsImagePrompt(slide, idx, slides),
  }));
  const keyword = document.getElementById('kc-keyword').value.trim();
  syncUIToOpts('kc');
  let style = getOpt('cn_style', 'modern');
  const ratio = kcCardnewsCurrentRatio();

  // AI 자동 스타일 선택
  if (style.includes('ai-auto')) {
    btn.innerHTML = '<span class="spinner"></span> AI 스타일 선택 중...';
    try {
      const slideTexts = slides.map(s => `${s.title || ''}: ${s.body || ''}`).join('\n');
      const aiStyleRes = await api('/api/cardnews/ai-style', {
        method: 'POST',
        body: { keyword, slide_texts: slideTexts },
      });
      style = aiStyleRes.style || 'modern';
      toast(`AI가 "${style}" 스타일을 선택했습니다`);
    } catch {
      style = 'modern';
    }
    btn.innerHTML = '<span class="spinner"></span> 이미지 생성 중...';
  }

  const slidesContainer = document.getElementById('kc-cardnews-slides');
  const cardnewsResult = document.getElementById('kc-cardnews-result');
  const editor = document.getElementById('kc-cn-editor');
  slidesContainer.innerHTML = '';
  window._cnCarouselUrls = [];
  window._cnCarouselIdx = 0;
  if (cardnewsResult) cardnewsResult.style.display = 'block';
  if (editor) editor.style.display = 'block';
  document.getElementById('kc-cn-carousel').style.display = 'block';
  kcRevealGeneratedContent('cardnews');
  kcEnsureCardnewsLiveProgress(slides);

  // 선택된 이미지를 슬라이드에 배분 (라운드로빈)
  const selectedImages = kcGetSelectedImageUrls();

  let successCount = 0;
  let prevImageUrl = ''; // 이전 이미지 참조 (디자인 일관성)
  for (let i = 0; i < slides.length; i++) {
    btn.innerHTML = `<span class="spinner"></span> ${i+1}/${slides.length} 생성 중...`;
    kcSetCardnewsLiveProgress(i, 'loading', '', null, '', ratio);

    try {
      const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';
      const profileId = parseInt(window._globalProfileId || 0);
      const profile = window._globalProfileData || {};
      const brandColor = profile.brand_color || '';
      const logoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
      const logoEnabled = kcCardnewsLogoEnabled();
      // 사용자 선택 이미지 (라운드로빈) + 디자인 참조 + 이전 슬라이드 참조 (각각 독립 전달)
      const userImg = selectedImages.length > 0 ? selectedImages[i % selectedImages.length] : '';
      const designRef = _kcSelectedDesignRef || '';
      const res = await api('/api/cardnews/generate-single', {
        method: 'POST',
        body: {
          slide: slides[i],
          topic: keyword,
          style: style,
          aspect_ratio: ratio,
          slide_count: slides.length,
          project_dir: _kcCardnewsDir || '',
          cardnews_id: _kcCnCardnewsId || null,
          brand_name: brandName,
          brand_color: brandColor,
          brand_logo_url: logoUrl,
          logo_enabled: logoEnabled,
          logo_text: '',
          user_image_url: userImg || designRef || '',
          user_image_urls: selectedImages,
          prev_image_url: i > 0 ? prevImageUrl : '',
          design_ref_url: designRef,
          image_provider: window._contentOpts?.image_provider || '',
          image_model: window._contentOpts?.image_model || '',
          image_size: getOpt('cn_resolution', '1K'),
          profile_id: profileId,
          use_profile_design_ref: !userImg && !designRef,
        },
      });

      if (res.image_url) {
        if (!_kcCardnewsDir && res.project_dir) _kcCardnewsDir = res.project_dir;
        if (!_kcCnCardnewsId && res.cardnews_id) _kcCnCardnewsId = res.cardnews_id;
        // 직전 슬라이드를 다음 슬라이드의 디자인 참조로 사용
        prevImageUrl = kcCardnewsImageUrl(res.image_url, false);
        const fullUrl = kcCardnewsImageUrl(res.image_url);
        // 히든 컨테이너에도 추가 (다른 곳에서 querySelectorAll로 읽음)
        slidesContainer.innerHTML += `<img src="${fullUrl}" style="display:none;">`;
        // 캐러셀에 추가
        window._cnCarouselUrls.push(fullUrl);
        kcCnCarouselShow(window._cnCarouselUrls.length - 1);
        kcSetCardnewsLiveProgress(i, 'done', fullUrl, slides[i], '', ratio);
        successCount++;
        // 1장이라도 생성되면 바로 보여주기
        if (successCount === 1) {
          document.getElementById('kc-cn-actions').style.display = 'block';
          document.getElementById('kc-cn-carousel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else {
        throw new Error('이미지 URL 없음');
      }
    } catch (e) {
      kcSetCardnewsLiveProgress(i, 'error', '', slides[i], e.message, ratio);
      slidesContainer.innerHTML += `<div id="kc-slide-${i}" style="padding:24px;text-align:center;background:rgba(0,0,0,0.03);border:1px dashed rgba(255,59,48,0.3);border-radius:10px;">
        <div style="color:#ff3b30;font-size:13px;font-weight:600;margin-bottom:8px;">슬라이드 ${i+1} 생성 실패</div>
        <div style="color:rgba(0,0,0,0.4);font-size:11px;margin-bottom:10px;">${escapeHtml(e.message).substring(0,50)}</div>
        <button class="btn btn-sm" onclick="kcRetrySlide(${i})" style="background:#007aff;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 생성</button>
      </div>`;
    }
  }

  _kcCnGenerating = false;
  btn.disabled = false;
  btn.innerHTML = '이미지 재생성';
  // 이미지 생성 후에도 슬라이드 문구를 함께 보여준다.
  if (successCount > 0) {
    if (editor) {
      editor.style.display = 'block';
      editor.querySelector('details')?.setAttribute('open', 'open');
    }
  }
  document.getElementById('kc-cn-actions').style.display = 'block';
  document.getElementById('kc-cardnews-result').style.display = 'block';

  // 인스타 캡션 자동 생성
  if (successCount > 0 && !document.getElementById('kc-cn-ig-caption')?.value) {
    kcAutoCaption();
  }

  // 영상 버튼에 폴더 경로 직접 저장 (변수 유실 방지)
  const videoDir = _kcCardnewsDir;
  const videoBtn = document.getElementById('kc-cn-to-video-btn');
  if (videoBtn && videoDir) {
    videoBtn.setAttribute('data-dir', videoDir);
    console.log(`[카드뉴스] 영상용 폴더 저장: ${videoDir}`);
  }
  const veoBtn = document.getElementById('kc-cn-to-veo-btn');
  if (veoBtn && videoDir) veoBtn.setAttribute('data-dir', videoDir);

  // Enable video tab now that cardnews images exist
  kcUpdateContentTabs();

  toast(`카드뉴스 이미지 ${successCount}/${slides.length}장 생성 완료!`);
  return true;
}

// === 카드뉴스 캐러셀 ===

function kcCnCarouselShow(idx) {
  const urls = window._cnCarouselUrls || [];
  if (urls.length === 0) return;
  window._cnCarouselIdx = idx;
  const container = document.getElementById('kc-cn-carousel-img');
  // 전체 이미지를 그리드로 한번에 표시
  container.innerHTML = urls.map((url, i) => `<div style="position:relative;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:8px;box-shadow:0 10px 24px rgba(0,0,0,0.04);">
    ${kcCardnewsSlideCardHtml(url, {}, i, { radius: 12, shadow: '0 0 0 1px rgba(0,0,0,0.08)', ratio: kcCardnewsCurrentRatio() })}
  </div>`).join('');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = urls.length <= 3 ? 'repeat(' + urls.length + ', 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))';
  container.style.gap = '10px';
  const prevBtn = document.getElementById('kc-cn-carousel-prev');
  const nextBtn = document.getElementById('kc-cn-carousel-next');
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  document.getElementById('kc-cn-carousel-idx').textContent = `${urls.length}장`;
}

function kcCnCarouselNav(dir) {
  kcCnCarouselShow((window._cnCarouselIdx || 0) + dir);
}

async function kcCnCarouselSave() {
  const urls = window._cnCarouselUrls || [];
  const idx = window._cnCarouselIdx || 0;
  if (!urls[idx]) return;
  try {
    const resp = await fetch(urls[idx]);
    const blob = await resp.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cardnews_${idx + 1}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`슬라이드 ${idx + 1} 저장 완료`);
  } catch { toast('저장 실패', 'error'); }
}

async function kcCnCarouselCopy() {
  const urls = window._cnCarouselUrls || [];
  const idx = window._cnCarouselIdx || 0;
  if (!urls[idx]) return;
  try {
    const resp = await fetch(urls[idx]);
    const blob = await resp.blob();
    const pngBlob = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    toast(`슬라이드 ${idx + 1} 복사 완료`);
  } catch { toast('복사 실패 — 브라우저에서 권한을 허용해주세요', 'error'); }
}

function kcShowCnCarousel(urls) {
  window._cnCarouselUrls = urls;
  window._cnCarouselIdx = 0;
  const carousel = document.getElementById('kc-cn-carousel');
  if (carousel && urls.length > 0) {
    carousel.style.display = 'block';
    kcCnCarouselShow(0);
  }
}

function kcRenderCardnewsImages(cardnewsData) {
  const slidesContainer = document.getElementById('kc-cardnews-slides');
  const slides = cardnewsData.slides || [];
  _kcCnTexts = cardnewsData.texts || slides;
  kcRenderCnEditor(_kcCnTexts);
  kcRenderCardnewsMeta(cardnewsData.meta || {});
  if (cardnewsData.project_dir) _kcCardnewsDir = cardnewsData.project_dir;
  if (typeof kcRefreshCardnewsFolderHint === 'function') kcRefreshCardnewsFolderHint();
  const urls = [];
  slides.forEach(s => {
    if (s.image_url) {
      urls.push(kcCardnewsImageUrl(s.image_url));
    } else if (s.image_path) {
      const normImagePath = s.image_path.replace(/\\/g, '/');
      const marker = '/cardnews/';
      const imageMarkerIndex = normImagePath.indexOf(marker);
      if (imageMarkerIndex >= 0) {
        urls.push(kcCardnewsImageUrl(normImagePath.slice(imageMarkerIndex + marker.length)));
      } else {
        const normDir = String(cardnewsData.project_dir || '').replace(/\\/g, '/');
        const dirParts = normDir.split('/cardnews/');
        const relDir = dirParts.length > 1 ? dirParts[1] : '';
        const imgFile = normImagePath.split('/').pop();
        urls.push(kcCardnewsImageUrl([relDir, imgFile].filter(Boolean).join('/')));
      }
    }
  });
  // 히든 컨테이너에 img 태그 유지 (다른 곳에서 querySelectorAll로 읽음)
  slidesContainer.innerHTML = urls.map(u => `<img src="${u}" style="display:none;">`).join('');
  // 캐러셀로 표시
  kcShowCnCarousel(urls);
  const editor = document.getElementById('kc-cn-editor');
  if (editor) {
    editor.style.display = 'block';
    editor.querySelector('details')?.setAttribute('open', 'open');
  }
  document.getElementById('kc-cn-actions').style.display = 'block';
  kcUpdateContentTabs();
}

// 이미지 크게 보기
function kcShowImagePreview(src, idx) {
  let modal = document.getElementById('imagePreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'imagePreviewModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;cursor:pointer;padding:24px;';
    modal.innerHTML = `
      <button id="imagePreviewPrev" onclick="event.stopPropagation();imgPreviewNav(-1)" style="position:absolute;left:24px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.16);backdrop-filter:blur(8px);color:#fff;border:1px solid rgba(255,255,255,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px;"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <img id="imagePreviewImg" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.4);object-fit:contain;">
      <button id="imagePreviewNext" onclick="event.stopPropagation();imgPreviewNav(1)" style="position:absolute;right:24px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.16);backdrop-filter:blur(8px);color:#fff;border:1px solid rgba(255,255,255,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:22px;height:22px;"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div id="imagePreviewCounter" style="position:absolute;bottom:22px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:999px;background:rgba(0,0,0,0.45);color:#fff;font-size:12px;font-weight:700;"></div>
      <div style="position:absolute;top:20px;right:20px;display:flex;gap:10px;">
        <button onclick="event.stopPropagation();imgPreviewDownload()" style="padding:10px 18px;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">다운로드</button>
        <button onclick="document.getElementById('imagePreviewModal').style.display='none'" style="padding:10px 18px;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">닫기</button>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    document.body.appendChild(modal);
  }
  modal.querySelectorAll('button').forEach(btn => {
    if (/뉴스|콘텐츠/.test((btn.textContent || '').trim())) btn.remove();
  });
  const urls = window._cnCarouselUrls || [];
  let nextIdx = Number.isFinite(idx) ? idx : urls.indexOf(src);
  if (nextIdx < 0) nextIdx = 0;
  window._cnCarouselIdx = nextIdx;
  document.getElementById('imagePreviewImg').src = urls[nextIdx] || src;
  imgPreviewUpdateNav();
  modal.style.display = 'flex';
}

function imgPreviewUpdateNav() {
  const urls = window._cnCarouselUrls || [];
  const idx = window._cnCarouselIdx || 0;
  const hasMany = urls.length > 1;
  const prev = document.getElementById('imagePreviewPrev');
  const next = document.getElementById('imagePreviewNext');
  const counter = document.getElementById('imagePreviewCounter');
  if (prev) prev.style.display = hasMany ? 'flex' : 'none';
  if (next) next.style.display = hasMany ? 'flex' : 'none';
  if (counter) {
    counter.style.display = hasMany ? 'block' : 'none';
    counter.textContent = `${idx + 1} / ${urls.length}`;
  }
}

function imgPreviewNav(dir) {
  const urls = window._cnCarouselUrls || [];
  if (urls.length <= 1) return;
  const nextIdx = ((window._cnCarouselIdx || 0) + dir + urls.length) % urls.length;
  window._cnCarouselIdx = nextIdx;
  const img = document.getElementById('imagePreviewImg');
  if (img) img.src = urls[nextIdx];
  imgPreviewUpdateNav();
}

document.addEventListener('keydown', e => {
  const modal = document.getElementById('imagePreviewModal');
  if (!modal || modal.style.display === 'none') return;
  if (e.key === 'ArrowLeft') imgPreviewNav(-1);
  if (e.key === 'ArrowRight') imgPreviewNav(1);
  if (e.key === 'Escape') modal.style.display = 'none';
});

async function imgPreviewDownload() {
  const img = document.getElementById('imagePreviewImg');
  if (!img?.src) return;
  try {
    const resp = await fetch(img.src);
    const blob = await resp.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const name = `cardnews_${new Date().toISOString().slice(0,10)}_${Date.now()}.${ext}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('이미지 저장 완료');
  } catch (e) { toast('저장 실패', 'error'); }
}
