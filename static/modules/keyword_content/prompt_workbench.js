// keyword_content/prompt_workbench.js — 프롬프트 워크벤치 빌더

function kcBuildGeneratePayload() {
  const keyword = document.getElementById('kc-keyword')?.value?.trim() || '';
  const selectedSources = _kcSelectedSources.filter(s => s.checked);
  const scrapedTexts = selectedSources.filter(s => s.scrapedText).map(s => s.scrapedText);
  const snippetTexts = selectedSources
    .filter(s => !s.scrapedText && s.snippet)
    .map(s => `${s.title}\n${s.snippet}`);
  const titleTexts = selectedSources
    .filter(s => !s.scrapedText && !s.snippet && s.title)
    .map(s => s.title);
  const allTexts = [...scrapedTexts, ...snippetTexts, ...titleTexts];
  // 사용자 선택 이미지 + 소스에서 수집된 이미지 + 라이브러리 이미지 합치기
  const userSelectedImages = _kcFinalImages.filter(x => x.selected).map(x => x.url);
  const scrapedImages = selectedSources.flatMap(s => (s.scrapedImages || []).slice(0, 3));
  const libraryImages = Array.isArray(window._kcLibraryImages) ? window._kcLibraryImages.slice(0, 10) : [];
  const collectedImages = [...new Set([...userSelectedImages, ...scrapedImages, ...libraryImages])].filter(Boolean);
  syncUIToOpts('kc');
  const _o = getContentOpts();
  const cardnewsPhotoCount = Math.max(1, Math.min(3, parseInt(_o.cn_photo_count || '1', 10) || 1));
  const cardnewsImages = collectedImages.slice(0, cardnewsPhotoCount);
  const profile = window._globalProfileData || {};
  const profileId = parseInt(window._globalProfileId || 0);
  const brandColor = profile.brand_color || '';
  const brandLogoUrl = profile.logo_path && profileId
    ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path)
    : '';

  return {
    keyword,
    selectedSources,
    allTexts,
    collectedImages,
    opts: _o,
    body: {
      keyword,
      selected_sources: selectedSources.map(s => ({ title: s.title, snippet: s.snippet, url: s.url })),
      scraped_texts: allTexts,
      brand_name: document.getElementById('kc-brand-name')?.value?.trim() || '',
      brand_description: (document.getElementById('kc-brand-desc')?.value?.trim() || '')
        + (window._globalProfileData?.business_type ? ' (업종: ' + window._globalProfileData.business_type + ')' : '')
        + (window._globalProfileData?.keywords ? ' (키워드: ' + window._globalProfileData.keywords + ')' : ''),
      brand_color: brandColor,
      brand_logo_url: brandLogoUrl,
      logo_insert: !!_o.logo_insert,
      business_goal: document.getElementById('kc-business-goal')?.value?.trim() || '',
      contact_info: document.getElementById('kc-contact')?.value?.trim() || '',
      user_image_urls: cardnewsImages,
      cardnews_photo_count: cardnewsPhotoCount,
      generate_blog: _o.gen_blog,
      generate_cardnews: _o.gen_cardnews || _o.gen_detail_page,
      generate_video: false,
      generate_sns: _o.gen_sns,
      tone: _o.tone,
      blog_length: _o.blog_length,
      threads_length: _o.threads_length || 'medium',
      threads_mode: _o.threads_mode || 'auto',
      twitter_length: _o.twitter_length || 'medium',
      comma_rate: _o.comma_rate,
      period_rate: _o.period_rate,
      human_level: _o.human_level,
      text_provider: window._contentOpts?.text_provider || '',
      image_provider: window._contentOpts?.image_provider || '',
      image_model: window._contentOpts?.image_model || '',
      profile_id: profileId,
      cardnews_style: _o.cn_style,
      cardnews_slides: parseInt(_o.cn_slides || '5'),
      blog_image_count: _o.gen_blog_images ? 5 : 0,
      blog_img_source: _kcImageSlots.some(s => s.url) ? 'slots' : 'ai',
      blog_header_images: kcGetSlotImages().header.map(x => x.url),
      blog_footer_images: kcGetSlotImages().footer.map(x => x.url),
      blog_image_slots: _kcImageSlots.filter(s => s.url).map(s => ({ position: s.position, role: s.role, url: s.url })),
      // 파일 업로드/직접 입력 소스만 있으면 웹 검색 보강 비활성화 (원본 내용 왜곡 방지)
      web_search_enhance: selectedSources.every(s => s.type === 'manual') ? false : (_o.web_search_enhance || false),
      web_search_keyword: _o.web_search_keyword || '',
      prompt_overrides: _kcPromptOverrides || {},
    },
  };
}

function kcGetSelectedImageUrls() {
  return (_kcFinalImages || []).filter(x => x.selected).map(x => x.url).filter(Boolean);
}

function kcBuildPromptReviewSignature(payload) {
  const selected = (payload?.selectedSources || []).map((s) => ({
    title: s.title || '',
    url: s.url || '',
    snippet: String(s.snippet || '').slice(0, 180),
    scraped: String(s.scrapedText || '').slice(0, 500),
    checked: !!s.checked,
  }));
  return JSON.stringify({
    keyword: payload?.keyword || '',
    profile_id: parseInt(window._globalProfileId || 0),
    brand_name: document.getElementById('kc-brand-name')?.value?.trim() || '',
    brand_desc: document.getElementById('kc-brand-desc')?.value?.trim() || '',
    business_goal: document.getElementById('kc-business-goal')?.value?.trim() || '',
    opts: payload?.opts || {},
    selected,
  });
}

function kcResetPromptReviewState(reason = '') {
  _kcPromptOverrides = {};
  _kcLastPromptSourceSummary = '';
  _kcPromptReviewed = false;
  kcUpdatePromptReviewStatus();
  kcClearPromptInlineRoot();
  if (reason) console.log('[KC] 프롬프트 상태 초기화:', reason);
}

function kcEnsureFreshPromptReviewState(payload) {
  const nextSignature = kcBuildPromptReviewSignature(payload);
  if (_kcLastPromptReviewSignature && _kcLastPromptReviewSignature !== nextSignature) {
    kcResetPromptReviewState('선택 소스/옵션 변경');
  }
  return nextSignature;
}

function kcPromptFieldStyle(rows = 7) {
  return `width:100%;padding:14px 16px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;font-size:14px;line-height:1.85;resize:vertical;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif;min-height:${rows * 28}px;background:#fff;color:#1c1c1e;`;
}


function kcPromptFieldZone(tab, field) {
  return (KC_FIXED_PROMPT_FIELDS[tab] || []).includes(field) ? 'fixed' : 'dynamic';
}

function kcIsGeneratingSourcePlaceholder(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  return text === '한국어 핵심 자료 생성중입니다.\n잠시 후 다시 열면 최신 요약본이 반영됩니다.';
}

function kcPromptStageCard(tab, field, title, desc, value, rows = 6, extraAttrs = '') {
  const zoneBg = 'rgba(0,0,0,0.02)';
  const zoneBorder = 'rgba(0,0,0,0.06)';
  const zoneText = '#1c1c1e';
  const showLoadingOnly = ['source_context', 'reference_context', 'content_context'].includes(field) && kcIsGeneratingSourcePlaceholder(value);
  const bodyHtml = showLoadingOnly
    ? `
      <textarea data-prompt-tab="${tab}" data-prompt-stage="${field}" ${extraAttrs} rows="${rows}" style="display:none;">${escapeHtml(value || '')}</textarea>
      <div style="min-height:${rows * 28}px;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,140,0,0.18);border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,242,0.98));">
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;color:rgba(0,0,0,0.45);text-align:center;padding:24px 18px;">
          <span class="spinner" style="width:26px;height:26px;border-width:3px;"></span>
          <div style="font-size:13px;font-weight:700;color:#ff8c00;">핵심 자료 생성중</div>
        </div>
      </div>
    `
    : `<textarea data-prompt-tab="${tab}" data-prompt-stage="${field}" ${extraAttrs} rows="${rows}" style="${kcPromptFieldStyle(rows)}">${escapeHtml(value || '')}</textarea>`;
  return `
    <div style="border:1px solid ${zoneBorder};border-radius:18px;padding:18px;background:${zoneBg};box-shadow:0 12px 28px rgba(15,23,42,0.04);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="font-size:15px;font-weight:800;color:#1c1c1e;line-height:1.4;">${title}</div>
          </div>
          <div style="font-size:12px;color:rgba(0,0,0,0.48);margin-top:5px;line-height:1.65;">${desc}</div>
        </div>
        ${showLoadingOnly ? '' : '<button type="button" onclick="kcTogglePromptEditor(this)" style="padding:8px 11px;border:none;border-radius:10px;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.58);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">크게 보기</button>'}
      </div>
      ${bodyHtml}
    </div>
  `;
}

function kcPromptStageWrap(content, visibility = 'basic') {
  return `<div data-prompt-visibility="${visibility}">${content}</div>`;
}

function kcGetPromptFieldElements(modal, target = 'all') {
  if (!modal) return [];
  if (target === 'all') return Array.from(modal.querySelectorAll('[data-prompt-stage]'));
  return Array.from(modal.querySelectorAll(`[data-prompt-tab="${target}"][data-prompt-stage]`));
}

function kcSetPromptFieldsLocked(modal, target = 'all', locked = true) {
  kcGetPromptFieldElements(modal, target).forEach(el => {
    if (locked) {
      el.setAttribute('readonly', 'readonly');
      el.dataset.lockedByAi = 'true';
      el.style.background = 'rgba(0,0,0,0.03)';
      el.style.borderColor = 'rgba(255,140,0,0.22)';
      el.style.boxShadow = 'inset 0 0 0 1px rgba(255,140,0,0.06)';
    } else {
      el.removeAttribute('readonly');
      delete el.dataset.lockedByAi;
      el.style.background = '#fff';
      el.style.borderColor = 'rgba(0,0,0,0.08)';
      el.style.boxShadow = 'none';
    }
  });
}

function kcUnlockPromptFields(target = 'all') {
  const container = kcGetPromptWorkbenchContainer();
  if (!container) return;
  kcSetPromptFieldsLocked(container, target, false);
  toast(target === 'all' ? '프롬프트 잠금을 해제했습니다.' : '현재 탭 프롬프트 잠금을 해제했습니다.');
}

function kcGetPromptWorkbenchContainer() {
  return document.getElementById('kc-prompt-preview-panel') || document.getElementById('kc-prompt-preview-modal');
}

function kcGetPromptInlineRoot() {
  return document.getElementById('kc-prompt-inline-root');
}

function kcClearPromptInlineRoot() {
  const root = kcGetPromptInlineRoot();
  if (!root) return;
  root.innerHTML = '';
  root.style.display = 'none';
}

function kcCloseOverlappingPromptModals(exceptId = '') {
  ['kc-detail-prompt-modal', 'kc-cardnews-prompt-modal', 'kc-blog-image-prompt-modal', 'kc-prompt-preview-modal'].forEach(id => {
    if (id === exceptId) return;
    document.getElementById(id)?.remove();
  });
}

function kcBringModalToFront(modal) {
  if (!modal) return;
  modal.style.zIndex = '2147483647';
  document.body.appendChild(modal);
}

function kcRenderPromptTabPanel(tabId, innerHtml, visible = false) {
  return `<div class="kc-prompt-tab-panel" data-prompt-tab-panel="${tabId}" style="display:${visible ? 'block' : 'none'};">${innerHtml}</div>`;
}

function kcSwitchPromptTab(tabId) {
  const container = kcGetPromptWorkbenchContainer();
  if (!container) return;
  container.querySelectorAll('[data-prompt-tab-button]').forEach(el => {
    const active = el.getAttribute('data-prompt-tab-button') === tabId;
    el.dataset.active = active ? 'true' : 'false';
    el.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.05)';
    el.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
    el.style.boxShadow = active ? '0 8px 18px rgba(255,140,0,0.18)' : 'none';
  });
  container.querySelectorAll('[data-prompt-tab-panel]').forEach(el => {
    el.style.display = el.getAttribute('data-prompt-tab-panel') === tabId ? 'block' : 'none';
  });
  kcApplyPromptComplexity(container, container.dataset.promptComplexity || 'simple');
}

function kcApplyPromptComplexity(modal, mode = 'simple') {
  if (!modal) return;
  modal.dataset.promptComplexity = mode;
  modal.querySelectorAll('[data-prompt-grid]').forEach(el => {
    el.style.gridTemplateColumns = mode === 'advanced' ? (el.dataset.promptGridAdvanced || 'repeat(auto-fit,minmax(320px,1fr))') : '1fr';
  });
  modal.querySelectorAll('[data-prompt-visibility="advanced"]').forEach(el => {
    el.style.display = mode === 'advanced' ? '' : 'none';
  });
  modal.querySelectorAll('[data-prompt-complexity-button]').forEach(el => {
    const active = el.getAttribute('data-prompt-complexity-button') === mode;
    el.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.05)';
    el.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
    el.style.boxShadow = active ? '0 8px 18px rgba(255,140,0,0.18)' : 'none';
  });
}

function kcTogglePromptEditor(btn) {
  const card = btn?.closest('div[style*="border:1px solid"]');
  const textarea = card?.querySelector('textarea');
  if (!textarea || !btn) return;
  const expanded = btn.dataset.expanded === 'true';
  if (expanded) {
    textarea.style.minHeight = textarea.dataset.baseMinHeight || textarea.style.minHeight;
    btn.dataset.expanded = 'false';
    btn.textContent = '크게 보기';
  } else {
    if (!textarea.dataset.baseMinHeight) textarea.dataset.baseMinHeight = textarea.style.minHeight || '';
    textarea.style.minHeight = '480px';
    textarea.focus();
    btn.dataset.expanded = 'true';
    btn.textContent = '접기';
  }
}

function kcPromptSourceDigest(payload, promptMeta = null, limit = 8000) {
  const blogBody = (document.getElementById('kc-blog-body')?.value || '').trim();
  if (blogBody) return blogBody.slice(0, limit);
  const summarized = promptMeta?.source_summary?.trim?.() || '';
  // 파일/직접 입력 소스가 있으면 원본 텍스트를 요약보다 우선 사용
  const isManualSource = (payload?.selectedSources || []).every(s => s.type === 'manual');
  if (isManualSource && payload?.allTexts?.length) {
    const rawText = payload.allTexts.join('\n\n').slice(0, limit);
    if (rawText.length > 100) return rawText;
  }
  if (summarized) return summarized.slice(0, limit);
  const cachedSummary = String(_kcLastPromptSourceSummary || '').trim();
  if (cachedSummary) return cachedSummary.slice(0, limit);
  return '한국어 핵심 자료 생성중입니다.\n잠시 후 다시 열면 최신 요약본이 반영됩니다.'.slice(0, limit);
}

function kcGetCurrentBlogBody(limit = 0) {
  const blogBody = (document.getElementById('kc-blog-body')?.value || '').trim();
  if (!blogBody) return '';
  return limit > 0 ? blogBody.slice(0, limit) : blogBody;
}

function kcFallbackSourceSummaryText() {
  return [
    '[핵심 사실]',
    '- 핵심 자료 응답이 지연되거나 일부 누락되어 임시 편집용 요약본으로 전환했습니다.',
    '',
    '[주요 인사이트]',
    '- 지금은 프롬프트 구조와 생성 옵션을 먼저 정리할 수 있습니다.',
    '',
    '[활용 포인트]',
    '- 카드뉴스, 만화, 블로그 이미지, 상세페이지 프롬프트는 이 요약본 기준으로 먼저 완성됩니다.',
    '',
    '[주의할 점]',
    '- 민감한 수치와 사실 문장은 최종 생성 전에 한 번 더 확인하세요.',
  ].join('\n');
}

function kcComposeBlogPromptText(parts = {}) {
  return [
    parts.customer_context ? `[브랜드/고객 맥락]\n${parts.customer_context}` : '',
    parts.business_bridge ? `[비즈니스 연결 포인트]\n${parts.business_bridge}` : '',
    parts.source_context ? `[핵심 자료]\n${parts.source_context}` : '',
    parts.style_applied ? `[문체 반영]\n${parts.style_applied}` : '',
    parts.output_rules ? `[출력 규칙]\n${parts.output_rules}` : '',
    '★★★ 가장 중요한 규칙 ★★★',
    '1. 제목은 원본 기사의 핵심 팩트/이슈를 반영해야 합니다. 브랜드명을 제목에 넣지 마세요.',
    '2. 글의 80% 이상은 핵심 자료의 구체적인 내용(팩트, 수치, 사례)으로 채우세요.',
    '3. 브랜드/업체 언급은 10% 이하로 최소화하세요. 정보 전달이 목적입니다.',
    '4. 원문 문장을 복붙하지 말고 핵심만 정리해서 쓰세요.',
    '5. 일반론이나 뻔한 이야기 대신 원본 기사에만 있는 독자적인 정보를 쓰세요.',
  ].filter(Boolean).join('\n\n');
}

function kcComposeCardnewsPromptText(parts = {}) {
  return [
    parts.system_prompt ? `[역할]\n${parts.system_prompt}` : '',
    parts.customer_context ? `[브랜드/고객 맥락]\n${parts.customer_context}` : '',
    parts.business_bridge ? `[비즈니스 연결 포인트]\n${parts.business_bridge}` : '',
    parts.reference_context ? `[핵심 자료]\n${parts.reference_context}` : '',
    parts.output_rules ? `[출력 규칙]\n${parts.output_rules}` : '',
    '위 내용을 바탕으로 카드뉴스 슬라이드 텍스트를 작성하세요.',
  ].filter(Boolean).join('\n\n');
}

function kcDefaultCardnewsImagePromptTemplate(styleGuide = '') {
  return [
    'Create a polished Korean card news slide illustration for social media.',
    'Topic: {keyword}',
    'Slide {slide_number} of {slide_count}',
    'Title: {title}',
    'Body summary: {body}',
    'Base visual concept: {base_visual_prompt}',
    styleGuide ? `Style guide: ${styleGuide}` : '',
    'This slide must feel clearly different from the neighboring slides in composition, focal object, background treatment, and camera distance while staying in the same series family.',
    'Do not add chapter badges, slide numbers, corner labels, ribbons, or small meta tags such as "핵심 기능 소개", "가치 및 기대 효과", or "요약".',
    'Important rules: create a complete card news image with the provided Korean title and body text included inside the design. Let the AI image model decide the natural composition, layout, hierarchy, and typography. Use only the provided Korean title/body text for in-image words. Use the supplied brand logo/reference images only when provided. Do not add unrelated English labels, fake text, random watermarks, or extra labels.',
  ].filter(Boolean).join('\n');
}

function kcBuildCardnewsImagePrompt(slide, index, slides = []) {
  const workbench = _kcPromptOverrides?.cardnews_workbench || {};
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || '');
  const styleGuide = _kcCardnewsStyleGuide(getOpt('cn_style', 'ai-auto'));
  const template = String(workbench.image_prompt_template || kcDefaultCardnewsImagePromptTemplate(styleGuide)).trim();
  const baseVisualPrompt = String(slide?.visual_prompt || '').trim() || 'clean editorial infographic illustration';
  return template
    .replaceAll('{keyword}', keyword)
    .replaceAll('{slide_number}', String(slide?.slide_number || (index + 1)))
    .replaceAll('{slide_count}', String(slides.length || 1))
    .replaceAll('{title}', String(slide?.title || '').trim())
    .replaceAll('{body}', String(slide?.body || '').trim())
    .replaceAll('{base_visual_prompt}', baseVisualPrompt)
    .replaceAll('{style_guide}', styleGuide);
}

function kcStringifyPromptBundle(items = []) {
  try {
    return JSON.stringify(Array.isArray(items) ? items : [], null, 2);
  } catch {
    return '[]';
  }
}

function kcParsePromptBundle(text, fallback = []) {
  const raw = String(text || '').trim();
  if (!raw) return Array.isArray(fallback) ? fallback : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (Array.isArray(fallback) ? fallback : []);
  } catch {
    return Array.isArray(fallback) ? fallback : [];
  }
}

function kcBuildCardnewsSlideDrafts(workbenchOverride = null) {
  const workbench = workbenchOverride || _kcPromptOverrides?.cardnews_workbench || {};
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || '카드뉴스');
  const reference = String(kcGetCurrentBlogBody(8000) || workbench.reference_context || _kcLastPromptSourceSummary || '').trim();
  const count = Math.max(1, parseInt(getOpt('cn_slides', '5'), 10) || 5);
  const sections = kcBuildSourceDrivenSections(keyword, reference, count);
  const styleGuide = _kcCardnewsStyleGuide(getOpt('cn_style', 'ai-auto'));
  return sections.slice(0, count).map((section, idx, arr) => {
    const body = String(section.body || '').replace(/\s+/g, ' ').trim();
    const title = String(section.title || `${keyword} ${idx + 1}`).replace(/\s+/g, ' ').trim().slice(0, 28);
    const slide = {
      slide_number: idx + 1,
      title,
      body: body.slice(0, 90),
      visual_prompt: body
        ? `${title}. ${body.slice(0, 160)}. ${styleGuide}`
        : `${title}. ${styleGuide}`,
    };
    slide.image_prompt = kcBuildCardnewsImagePrompt(slide, idx, arr);
    return slide;
  });
}

function kcBuildComicPanelDrafts(workbenchOverride = null) {
  const workbench = workbenchOverride || _kcPromptOverrides?.comic_workbench || {};
  const topic = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || '스토리 만화');
  const reference = String(kcGetCurrentBlogBody(8000) || workbench.reference_context || _kcLastPromptSourceSummary || '').trim();
  const sections = kcBuildSourceDrivenSections(topic, reference, 4);
  return sections.slice(0, 4).map((section, idx) => {
    const body = String(section.body || '').replace(/\s+/g, ' ').trim();
    return {
      panel_number: idx + 1,
      situation: String(section.title || `${topic} ${idx + 1}`).replace(/\s+/g, ' ').trim().slice(0, 15),
      dialogue: body.slice(0, 30),
      narration: body.slice(0, 20),
      visual_prompt: `${topic}, ${section.title || `panel ${idx + 1}`}, ${body.slice(0, 160)}`,
      emotion: idx === 0 ? 'neutral' : idx === 2 ? 'surprised' : idx === 3 ? 'happy' : 'neutral',
    };
  });
}

function kcBuildVideoSceneDrafts(workbenchOverride = null) {
  const workbench = workbenchOverride || _kcPromptOverrides?.video_workbench || {};
  const topic = String(workbench.subject || kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || 'AI 영상')).trim();
  const sceneSeed = String(kcGetCurrentBlogBody(4000) || workbench.scene || _kcLastPromptSourceSummary || '').trim();
  const sections = kcBuildSourceDrivenSections(topic, sceneSeed, 4);
  return sections.slice(0, 4).map((section, idx) => ({
    scene_number: idx + 1,
    title: String(section.title || `${topic} 장면 ${idx + 1}`).trim(),
    scene: String(section.body || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    camera: idx === 0 ? '인트로 와이드 샷' : idx === 3 ? '클로징 포인트 샷' : '중간 리듬 컷',
    mood: idx === 0 ? '집중감 있게' : idx === 3 ? '정리되게' : '정보가 또렷하게',
  }));
}

function kcComposeSnsPromptText(parts = {}) {
  return [
    parts.system_prompt ? `[역할]\n${parts.system_prompt}` : '',
    parts.customer_context ? `[브랜드/고객 맥락]\n${parts.customer_context}` : '',
    parts.business_bridge ? `[비즈니스 연결 포인트]\n${parts.business_bridge}` : '',
    parts.content_context ? `[핵심 내용]\n${parts.content_context}` : '',
    parts.style_applied ? `[문체 반영]\n${parts.style_applied}` : '',
    parts.threads_rules ? `[스레드 작성 규칙]\n${parts.threads_rules}` : '',
    parts.twitter_rules ? `[트위터 작성 규칙]\n${parts.twitter_rules}` : '',
    '출력 형식은 반드시 JSON 객체로 하고 keys는 threads, twitter 입니다.',
  ].filter(Boolean).join('\n\n');
}

function kcComposeComicPromptText(parts = {}) {
  return [
    parts.system_prompt ? `[역할]\n${parts.system_prompt}` : '',
    parts.business_bridge ? `[비즈니스 연결 포인트]\n${parts.business_bridge}` : '',
    parts.reference_context ? `[핵심 자료]\n${parts.reference_context}` : '',
    parts.style_applied ? `[문체 반영]\n${parts.style_applied}` : '',
    parts.character_rules ? `[연출 규칙]\n${parts.character_rules}` : '',
    '위 내용을 바탕으로 스토리 만화 스크립트를 JSON 배열로 작성하세요.',
  ].filter(Boolean).join('\n\n');
}

function kcComposeDetailSectionTemplate() {
  const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';
  return [
    '블로그 내용을 상세페이지용 섹션 이미지로 바꿔주세요.',
    brandName ? `브랜드 참고: ${brandName}` : '',
    '{cover_instruction}',
    '섹션 제목: "{title}"',
    '섹션 내용: "{body}"',
    '',
    '블로그 전체 맥락:',
    '{source_summary}',
    '',
    '중요:',
    '- 블로그 내용을 새로 기획하거나 다른 상품 설명으로 바꾸지 마세요',
    '- 이 섹션의 핵심만 남기고 제목, 포인트, 보조 설명 위계가 바로 보이게 정리하세요',
    '- 텍스트는 짧고 선명하게 줄이고 모바일에서 읽기 쉬운 세로형 상세페이지처럼 구성하세요',
    '- 표지라면 첫인상이 강하게, 본문이라면 정보가 바로 읽히게 구성하세요',
    '- 그래픽/인포그래픽/일러스트 느낌으로 정리하고 과한 사진 콜라주 느낌은 피하세요',
    '- CTA 버튼, 연락 유도, 과한 광고 문구, 브랜드 홍보 문구는 넣지 마세요',
    '- 블로그 문맥과 어긋나는 새 주장이나 새 정보를 추가하지 마세요',
  ].filter(Boolean).join('\n');
}

function kcNormalizeDetailSectionTemplate(sectionTemplate = '', designRules = '') {
  const rules = String(designRules || '').trim();
  const hasLegacyPlaceholders = ['{product_name}', '{description}', '{features}', '{price}']
    .some(token => String(sectionTemplate || '').includes(token));
  let template = String(sectionTemplate || '').trim();
  if (!template || hasLegacyPlaceholders) {
    template = kcComposeDetailSectionTemplate();
  }
  if (template.includes('{design_rules}')) {
    template = template.replaceAll('{design_rules}', rules);
  }
  if (rules && !template.includes(rules)) {
    if (template.includes('중요:')) {
      const [head, ...tail] = template.split('중요:');
      template = `${head.trim()}\n\n디자인 참고:\n${rules}\n\n중요:\n${tail.join('중요:').trim()}`;
    } else {
      template = `${template.trim()}\n\n디자인 참고:\n${rules}`;
    }
  }
  return template.trim();
}

function kcBuildBlogImagePromptPreviewText(workbenchOverride = null) {
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || document.getElementById('kc-blog-title')?.value?.trim() || '블로그');
  const content = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const count = parseInt(window._contentOpts?.blog_image_count || 0, 10) || 3;
  const slides = kcBuildBlogImagePromptSlides(content, keyword, count, workbenchOverride);
  if (!slides.length) return '';
  return slides.map((slide, idx) => `[이미지 ${idx + 1}]\n${slide.visual_prompt}`).join('\n\n');
}

function kcBuildBlogImagePromptBundle(workbenchOverride = null) {
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || document.getElementById('kc-blog-title')?.value?.trim() || '블로그');
  const content = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const count = parseInt(window._contentOpts?.blog_image_count || 0, 10) || 3;
  return kcBuildBlogImagePromptSlides(content, keyword, count, workbenchOverride);
}

function kcBuildDetailPromptDrafts(workbenchOverride = null) {
  const workbench = workbenchOverride || (_kcPromptOverrides && _kcPromptOverrides.detail_page_workbench) || {};
  const title = document.getElementById('kc-blog-title')?.value?.trim()
    || kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || '')
    || '상세페이지';
  // 블로그 본문이 있으면 블로그 기반, 없으면 핵심요약 기반
  const blogBody = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const sourceContext = blogBody || String(workbench.source_context || _kcLastPromptSourceSummary || '').trim();
  // 블로그 본문을 소제목/빈줄 기준으로 자연스럽게 섹션 분할
  const targetCount = Math.max(1, Math.min(7, parseInt(getOpt('cn_slides', '5'), 10) || 5));
  const sections = kcBuildBlogDrivenSections(title, sourceContext, targetCount);
  return kcBuildDetailPromptSlides(title, sections.length ? sections : [{ title, body: sourceContext, iscover: true }]);
}

function kcBuildDetailPromptPreviewText(workbenchOverride = null) {
  const slides = kcBuildDetailPromptDrafts(workbenchOverride);
  if (!slides.length) return '';
  return slides.map((slide, idx) => `[섹션 ${idx + 1}]\n${slide.visual_prompt || ''}`).join('\n\n');
}

function kcRefreshDerivedPromptPreviews() {
  const container = kcGetPromptWorkbenchContainer();
  if (!container) return;

  const blogImageWorkbench = {
    source_context: container.querySelector('[data-prompt-tab="blog_image"][data-prompt-stage="source_context"]')?.value || '',
    design_rules: container.querySelector('[data-prompt-tab="blog_image"][data-prompt-stage="design_rules"]')?.value || '',
    prompt_template: container.querySelector('[data-prompt-tab="blog_image"][data-prompt-stage="prompt_template"]')?.value || '',
  };
  const detailWorkbench = {
    source_context: container.querySelector('[data-prompt-tab="detail_page"][data-prompt-stage="source_context"]')?.value || '',
    section_template: container.querySelector('[data-prompt-tab="detail_page"][data-prompt-stage="section_template"]')?.value || '',
  };
  const cardnewsWorkbench = {
    system_prompt: container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="system_prompt"]')?.value || '',
    customer_context: container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="customer_context"]')?.value || '',
    reference_context: container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="reference_context"]')?.value || '',
    output_rules: container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="output_rules"]')?.value || '',
    image_prompt_template: container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="image_prompt_template"]')?.value || '',
  };
  const comicWorkbench = {
    system_prompt: container.querySelector('[data-prompt-tab="comic"][data-prompt-stage="system_prompt"]')?.value || '',
    reference_context: container.querySelector('[data-prompt-tab="comic"][data-prompt-stage="reference_context"]')?.value || '',
    character_rules: container.querySelector('[data-prompt-tab="comic"][data-prompt-stage="character_rules"]')?.value || '',
  };
  const videoWorkbench = {
    subject: container.querySelector('[data-prompt-tab="video"][data-prompt-stage="subject"]')?.value || '',
    scene: container.querySelector('[data-prompt-tab="video"][data-prompt-stage="scene"]')?.value || '',
  };

  const blogPreview = container.querySelector('#kc-blog-image-preview');
  if (blogPreview) blogPreview.value = kcBuildBlogImagePromptPreviewText(blogImageWorkbench);
  const blogBundle = container.querySelector('[data-prompt-tab="blog_image"][data-prompt-stage="prompt_bundle"]');
  if (blogBundle) blogBundle.value = kcStringifyPromptBundle(kcBuildBlogImagePromptBundle(blogImageWorkbench));

  const detailPreview = container.querySelector('#kc-detail-page-preview');
  if (detailPreview) detailPreview.value = kcBuildDetailPromptPreviewText(detailWorkbench);
  const detailBundle = container.querySelector('[data-prompt-tab="detail_page"][data-prompt-stage="prompt_bundle"]');
  if (detailBundle) detailBundle.value = kcStringifyPromptBundle(kcBuildDetailPromptDrafts(detailWorkbench));

  const cardnewsBundle = container.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="slides_bundle"]');
  if (cardnewsBundle) cardnewsBundle.value = kcStringifyPromptBundle(kcBuildCardnewsSlideDrafts(cardnewsWorkbench));

  const comicBundle = container.querySelector('[data-prompt-tab="comic"][data-prompt-stage="panel_bundle"]');
  if (comicBundle) comicBundle.value = kcStringifyPromptBundle(kcBuildComicPanelDrafts(comicWorkbench));

  const videoScenePlan = container.querySelector('[data-prompt-tab="video"][data-prompt-stage="scene_plan"]');
  if (videoScenePlan) videoScenePlan.value = kcStringifyPromptBundle(kcBuildVideoSceneDrafts(videoWorkbench));
}

function kcProfilePromptContext(payload) {
  const brand = payload?.body?.brand_name || '';
  const brandDesc = payload?.body?.brand_description || '';
  const goal = payload?.body?.business_goal || '';
  const contact = payload?.body?.contact_info || '';
  const businessType = window._globalProfileData?.business_type || '';
  return [
    businessType ? `업종: ${businessType}` : '',
    brand ? `브랜드명: ${brand}` : '',
    brandDesc ? `서비스 설명: ${brandDesc}` : '',
    goal ? `비즈니스 목표: ${goal}` : '',
    contact ? `연락처/위치: ${contact}` : '',
  ].filter(Boolean).join('\n').trim();
}

function kcDefaultBusinessBridge(payload) {
  const businessType = window._globalProfileData?.business_type || '';
  const goal = payload?.body?.business_goal || '';
  return [
    '원본 기사/자료의 핵심 내용이 글의 중심이어야 합니다.',
    '브랜드, 업체명, 서비스 홍보 문구는 자동으로 덧붙이지 말고 정보 전달을 우선하세요.',
    businessType ? `참고 업종: ${businessType}` : '',
    goal ? `콘텐츠 목적: ${goal}` : '',
  ].filter(Boolean).join('\n');
}

function kcBuildBlogWorkbench(prompt, payload, promptMeta = null) {
  // 우선순위: 서버(DB/프롬프트 관리) → 프롬프트 세트 override → 클라이언트 폴백
  const serverPrompt = prompt || {};
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.blog_workbench || _kcPromptOverrides.blog) || {}) : {};
  const opts = payload?.opts || {};
  const sourceContext = kcPromptSourceDigest(payload, promptMeta, 8000);
  const customerContext = kcProfilePromptContext(payload);
  const businessBridge = kcDefaultBusinessBridge(payload);
  const styleApplied = promptMeta?.style_meta?.blog || '';
  const outputRules = [
    opts.tone === 'mystyle' ? '프로필에 저장된 내 스타일 문체를 그대로 유지하세요.' : `문체는 ${opts.tone || 'professional'} 톤으로 작성하세요.`,
    kcGetBlogLengthInstruction(opts.blog_length),
    `쉼표 사용 빈도: ${opts.comma_rate ?? 50}%`,
    `마침표 사용 빈도: ${opts.period_rate ?? 70}%`,
    kcGetHumanInstruction(opts.human_level),
  ].filter(Boolean).join('\n');
  return {
    system_prompt: setOverride.system_prompt || serverPrompt.system_prompt || '',
    customer_context: customerContext,
    business_bridge: businessBridge,
    source_context: sourceContext,
    style_applied: styleApplied,
    output_rules: outputRules,
    user_prompt: setOverride.user_prompt || serverPrompt.user_prompt || kcComposeBlogPromptText({
      customer_context: customerContext, business_bridge: businessBridge,
      source_context: sourceContext, style_applied: styleApplied, output_rules: outputRules,
    }),
  };
}



function kcBuildCardnewsWorkbench(prompt, payload, promptMeta = null) {
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.cardnews_workbench || _kcPromptOverrides.cardnews) || {}) : {};
  const serverPrompt = prompt || {};
  const opts = payload?.opts || {};
  const customerContext = setOverride.customer_context || kcProfilePromptContext(payload);
  const businessBridge = setOverride.business_bridge || kcDefaultBusinessBridge(payload);
  const referenceContext = kcGetCurrentBlogBody(8000) || setOverride.reference_context || kcPromptSourceDigest(payload, promptMeta, 8000);
  const styleApplied = setOverride.style_applied || promptMeta?.style_meta?.cardnews || '';
  const cnStyleKey = opts.cn_style || 'ai-auto';
  const cnStyleGuide = _kcCardnewsStyleGuide(cnStyleKey);
  const outputRules = setOverride.output_rules || [
    opts.cn_slides ? `전체 슬라이드는 ${opts.cn_slides}장으로 구성하세요.` : 'AI가 주제에 적합한 슬라이드 수를 자동으로 결정하세요.',
    cnStyleGuide,
    `결과 비율은 ${opts.cn_ratio || '1:1'} 기준을 따르세요.`,
    '카드뉴스에 CTA, 브랜드 홍보, 연락처를 넣지 마세요. 정보 전달만 하세요.',
    '전체 흐름은 정보형으로 유지하되 슬라이드마다 메시지가 겹치지 않게 차별화하세요.',
  ].join('\n');
  const systemPrompt = setOverride.system_prompt || '당신은 한국어 카드뉴스 기획자입니다. 한 장씩 넘겨볼 때 메시지가 분명하고, 실제 정보와 맥락이 살아 있는 슬라이드를 설계합니다.';
  const imagePromptTemplate = setOverride.image_prompt_template || kcDefaultCardnewsImagePromptTemplate(cnStyleGuide);
  // slides_bundle을 먼저 만들어야 final_prompt에 포함 가능
  const tempWorkbench = {
    system_prompt: systemPrompt,
    customer_context: customerContext,
    reference_context: referenceContext,
    output_rules: outputRules,
  };
  const slidesBundle = setOverride.slides_bundle || kcStringifyPromptBundle(kcBuildCardnewsSlideDrafts(tempWorkbench));
  const workbench = {
    system_prompt: systemPrompt,
    customer_context: customerContext,
    business_bridge: businessBridge,
    reference_context: referenceContext,
    style_applied: styleApplied,
    output_rules: outputRules,
    image_prompt_template: imagePromptTemplate,
    slides_bundle: slidesBundle,
    final_prompt: setOverride.final_prompt || serverPrompt.text_prompt || kcComposeCardnewsPromptText({
      system_prompt: systemPrompt,
      customer_context: customerContext,
      business_bridge: businessBridge,
      reference_context: referenceContext,
      output_rules: outputRules,
      slides_bundle: slidesBundle,
    }),
  };
  return workbench;
}

function kcBuildSnsWorkbench(prompt, payload, promptMeta = null) {
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.sns_workbench || _kcPromptOverrides.sns) || {}) : {};
  const serverSns = prompt || {};
  const existing = serverSns;
  const systemPrompt = setOverride.system_prompt || serverSns.common_rules || serverSns.prompt || '당신은 Threads와 Twitter(X) 동시 운영 마케터입니다. 같은 핵심 메시지를 플랫폼 제약에 맞게 짧고 강하게 재구성합니다.';
  const customerContext = setOverride.customer_context || kcProfilePromptContext(payload);
  const businessBridge = setOverride.business_bridge || kcDefaultBusinessBridge(payload);
  const contentContext = setOverride.content_context || kcPromptSourceDigest(payload, promptMeta, 8000);
  const styleApplied = setOverride.style_applied || promptMeta?.style_meta?.sns || '';
  const opts = payload?.opts || {};
  const threadsLen = opts.threads_length || getOpt('threads_length', 'medium');
  const threadsMode = opts.threads_mode || getOpt('threads_mode', 'auto');
  const twitterLen = opts.twitter_length || getOpt('twitter_length', 'medium');
  const threadsLenRule = {
    short: '스레드는 핵심만 간결하게 쓰세요. 500자 이내.',
    medium: '스레드는 충분히 상세하게 쓰세요. 글자 수 제한 없이 내용을 충실하게 전달하세요.',
    long: '스레드는 길고 상세하게 쓰세요. 여러 개로 나눠도 됩니다. 내용이 풍부할수록 좋습니다.',
  }[threadsLen] || '스레드는 충분히 상세하게 쓰세요. 글자 수 제한 없이 내용을 충실하게 전달하세요.';
  const threadsModeRule = threadsMode === 'single'
    ? '스레드는 길어도 한 번에 맞춰 줄일 수 있게 너무 늘어지지 마세요.'
    : '스레드는 길어지면 여러 개로 나눠 이어서 게시할 수 있게 문장 단위를 분명하게 나눠주세요.';
  const twitterLenRule = twitterLen === 'short'
    ? '트위터(X)는 매우 짧고 강하게 압축하세요. 120~180자 안쪽이 좋습니다.'
    : '트위터(X)는 짧지만 정보가 보이게 쓰세요. 180~250자 안쪽이 좋습니다.';
  const threadsRules = setOverride.threads_rules || serverSns.threads_rules || [
    threadsLenRule,
    threadsModeRule,
    `쉼표 사용 빈도: ${opts.comma_rate ?? 50}%`,
    `마침표 사용 빈도: ${opts.period_rate ?? 70}%`,
  ].join('\n');
  const twitterRules = setOverride.twitter_rules || serverSns.twitter_rules || [
    twitterLenRule,
    '짧고 날카로운 2~3문장으로 끝내세요.',
    '불필요한 군더더기 없이 핵심만 남기세요.',
    `쉼표 사용 빈도: ${opts.comma_rate ?? 50}%`,
    `마침표 사용 빈도: ${opts.period_rate ?? 70}%`,
  ].join('\n');
  return {
    system_prompt: systemPrompt,
    customer_context: customerContext,
    business_bridge: businessBridge,
    content_context: contentContext,
    style_applied: styleApplied,
    threads_rules: threadsRules,
    twitter_rules: twitterRules,
    final_prompt: setOverride.final_prompt || existing.final_prompt || kcComposeSnsPromptText({
      system_prompt: systemPrompt,
      customer_context: customerContext,
      business_bridge: businessBridge,
      content_context: contentContext,
      style_applied: styleApplied,
      threads_rules: threadsRules,
      twitter_rules: twitterRules,
    }),
  };
}

function kcBuildVideoWorkbench(prompt, payload, promptMeta = null) {
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.video_workbench || _kcPromptOverrides.video) || {}) : {};
  const serverVideo = prompt || {};
  const bundle = kcBuildVideoPromptBundle(payload, setOverride.prompt_bundle || serverVideo.prompt_bundle || '');
  const businessBridge = setOverride.business_bridge || kcDefaultBusinessBridge(payload);
  const workbench = {
    system_prompt: setOverride.system_prompt || '당신은 숏폼 광고 영상 감독입니다. 짧은 시간 안에 브랜드 메시지가 정확히 보이도록 장면, 비주얼, 카메라, 분위기, 금지 요소를 설계합니다.',
    customer_context: setOverride.customer_context || kcProfilePromptContext(payload),
    business_bridge: businessBridge,
    ...bundle,
    final_prompt: setOverride.final_prompt || serverVideo.prompt_bundle || bundle.final_prompt || '',
  };
  workbench.scene_plan = setOverride.scene_plan || kcStringifyPromptBundle(kcBuildVideoSceneDrafts(workbench));
  return workbench;
}

function kcBuildComicWorkbench(prompt, payload, promptMeta = null, options = {}) {
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.comic_workbench || _kcPromptOverrides.comic) || {}) : {};
  const serverComic = prompt || {};
  const existing = serverComic;
  const opts = payload?.opts || {};
  const systemPrompt = setOverride.system_prompt || '당신은 스토리 만화 기획자입니다. 4컷으로 고정하지 않고 자료 흐름에 맞춰 컷 수와 장면 호흡을 자연스럽게 정합니다. 유머는 필요할 때만 사용하고, 정보형·공감형·상황형도 자연스럽게 설계합니다.';
  const businessBridge = setOverride.business_bridge || kcDefaultBusinessBridge(payload);
  const referenceContext = String(
    kcGetCurrentBlogBody(8000)
      || (options.referenceContext !== undefined
        ? options.referenceContext
        : (setOverride.reference_context || kcPromptSourceDigest(payload, promptMeta, 8000)))
  ).trim();
  const styleApplied = setOverride.style_applied || promptMeta?.style_meta?.comic || '';
  const characterRules = setOverride.character_rules || setOverride.script_prompt || [
    _kcComicStyleGuide(opts.comic_style || 'cute'),
    '컷 수는 보통 5~8컷으로 구성하되, 내용이 짧으면 5컷, 정보가 많으면 7~8컷처럼 흐름에 맞게 정하세요.',
    '흐름은 도입 → 상황 → 갈등/궁금증 → 핵심 전환 → 해결 → 마무리/CTA가 자연스럽게 이어지게 하세요.',
    '유머는 필수가 아니며, 주제에 따라 정보형이나 공감형 흐름도 허용합니다.',
    '과도한 설명을 늘어놓지 말고 한 컷마다 하나의 포인트만 분명하게 전달하세요.',
  ].join('\n');
  const workbench = {
    system_prompt: systemPrompt,
    business_bridge: businessBridge,
    reference_context: referenceContext,
    style_applied: styleApplied,
    character_rules: characterRules,
  };
  const recomposedFinalPrompt = kcComposeComicPromptText({
    system_prompt: systemPrompt,
    business_bridge: businessBridge,
    reference_context: referenceContext,
    style_applied: styleApplied,
    character_rules: characterRules,
  });
  workbench.final_prompt = options.forceRecompose ? recomposedFinalPrompt : (setOverride.final_prompt || existing.final_prompt || existing.script_prompt || recomposedFinalPrompt);
  const recomposedPanelBundle = kcStringifyPromptBundle(kcBuildComicPanelDrafts(workbench));
  workbench.panel_bundle = options.forceRebuildPanels ? recomposedPanelBundle : (existing.panel_bundle || recomposedPanelBundle);
  return workbench;
}

function kcBuildDetailPageWorkbench(payload, prompt = null) {
  const setOverride = _kcActivePromptSetId ? ((_kcPromptOverrides.detail_page_workbench || _kcPromptOverrides.detail_page) || {}) : {};
  const existing = prompt || {};
  const sourceContext = kcGetCurrentBlogBody(4000) || setOverride.source_context || kcPromptSourceDigest(payload, { source_summary: _kcLastPromptSourceSummary || '' }, 1800);
  const legacyRules = setOverride.design_rules || existing.design_rules || _kcPromptOverrides?.detail_page_design_rules || '';
  const rawTemplate = setOverride.section_template || existing.section_template || (_kcPromptOverrides?.detail_page_section_template) || '';
  const sectionTemplate = (rawTemplate || legacyRules)
    ? kcNormalizeDetailSectionTemplate(rawTemplate, legacyRules)
    : '';
  const workbench = {
    source_context: sourceContext,
    section_template: sectionTemplate,
  };
  workbench.prompt_bundle = setOverride.prompt_bundle || existing.prompt_bundle || kcStringifyPromptBundle(kcBuildDetailPromptDrafts(workbench));
  return workbench;
}

function kcBuildPromptWorkbench(prompts, payload, promptMeta = null) {
  // 핵심요약을 promptMeta에서 가져오거나 _kcLastPromptSourceSummary 사용
  const sourceSummary = kcGetCurrentBlogBody(8000) || promptMeta?.source_summary || _kcLastPromptSourceSummary || '';
  const sourceDigest = sourceSummary || kcPromptSourceDigest(payload, promptMeta, 8000);

  return {
    blog: prompts.blog ? kcBuildBlogWorkbench(prompts.blog, payload, promptMeta) : null,
    cardnews: prompts.cardnews ? kcBuildCardnewsWorkbench(prompts.cardnews, payload, promptMeta) : null,
    sns: prompts.sns ? kcBuildSnsWorkbench(prompts.sns, payload, promptMeta) : null,
    video: prompts.video ? kcBuildVideoWorkbench(prompts.video, payload, promptMeta) : null,
    comic: prompts.comic ? kcBuildComicWorkbench(prompts.comic, payload, promptMeta) : null,
    blog_image: prompts.blog_image ? (() => {
      const workbench = {
        source_context: kcGetCurrentBlogBody(4000) || (_kcPromptOverrides?.blog_image_workbench?.source_context) || sourceDigest,
        design_rules: (_kcPromptOverrides?.blog_image_workbench?.design_rules) || (_kcPromptOverrides?.blog_image_design_rules) || prompts.blog_image.design_rules || `- 표현 방식은 내용에 따라 자유롭게 결정하세요.\n- 일러스트, 에디토리얼 그래픽, 개념 장면, 오브제 중심 이미지, 다이어그램, 상징적 구성 중 가장 적합한 방식을 선택하세요.\n- 각 이미지마다 같은 구도·색감·아이콘 조합을 반복하지 마세요.\n- 16:9 비율을 유지하고 텍스트 없이 핵심 의미가 읽히게 구성하세요.\n- 브랜드 톤이 있더라도 한 가지 템플릿처럼 고정하지 말고 섹션 의미에 맞게 해석하세요.`,
        prompt_template: (_kcPromptOverrides?.blog_image_workbench?.prompt_template) || `블로그 삽입용 이미지를 생성하세요.\n\n블로그 주제: {keyword}\n블로그 전체 맥락: {source_context}\n현재 이미지: {index}/{total}\n이 섹션의 제목: {title}\n이 섹션의 내용: {body}\n\n디자인 참고:\n{design_rules}\n\n중요:\n- 이 섹션 내용에 가장 잘 맞는 시각 언어를 AI가 스스로 결정하세요.\n- 다른 이미지들과 똑같은 템플릿처럼 보이지 않게 장면, 구도, 거리감, 색상 흐름, 매체 느낌을 달리하세요.\n- 텍스트를 억지로 넣지 말고 핵심 내용이 시각적으로 바로 읽히게 구성하세요.`,
      };
      workbench.prompt_bundle = (_kcPromptOverrides?.blog_image_workbench?.prompt_bundle) || kcStringifyPromptBundle(kcBuildBlogImagePromptBundle(workbench));
      return workbench;
    })() : null,
    detail_page: prompts.detail_page ? kcBuildDetailPageWorkbench(payload, prompts.detail_page) : null,
  };
}

function kcSyncDerivedPromptsToBlogBody(blogBody = '') {
  const source = String(blogBody || kcGetCurrentBlogBody(12000)).trim();
  if (!source) return;
  const payload = kcBuildGeneratePayload();
  const promptMeta = { source_summary: source };
  const next = { ...(_kcPromptOverrides || {}) };

  if (next.cardnews_workbench || next.cardnews_text_prompt) {
    const cardnewsWorkbench = kcBuildCardnewsWorkbench(next.cardnews_workbench || { text_prompt: next.cardnews_text_prompt || '' }, payload, promptMeta);
    next.cardnews_workbench = cardnewsWorkbench;
    next.cardnews_text_prompt = cardnewsWorkbench.final_prompt || '';
    next.cardnews_slides = kcParsePromptBundle(cardnewsWorkbench.slides_bundle, kcBuildCardnewsSlideDrafts(cardnewsWorkbench));
  }

  if (next.comic_workbench || next.comic_script_prompt) {
    const comicWorkbench = kcBuildComicWorkbench(next.comic_workbench || { script_prompt: next.comic_script_prompt || '' }, payload, promptMeta, { forceRecompose: true, forceRebuildPanels: true });
    next.comic_workbench = comicWorkbench;
    next.comic_script_prompt = comicWorkbench.final_prompt || '';
    next.comic_panels = kcParsePromptBundle(comicWorkbench.panel_bundle, kcBuildComicPanelDrafts(comicWorkbench));
  }

  if (next.video_workbench || next.video_prompt || next.video_bundle) {
    const videoWorkbench = kcBuildVideoWorkbench(next.video_workbench || { prompt_bundle: next.video_prompt || '' }, payload, promptMeta);
    next.video_workbench = videoWorkbench;
    next.video_bundle = {
      subject: videoWorkbench.subject || '',
      scene: videoWorkbench.scene || '',
      visual_style: videoWorkbench.visual_style || '',
      camera: videoWorkbench.camera || '',
      mood: videoWorkbench.mood || '',
      duration: videoWorkbench.duration || '',
      negative: videoWorkbench.negative || '',
      scene_plan: videoWorkbench.scene_plan || '',
      final_prompt: videoWorkbench.final_prompt || '',
    };
    next.video_prompt = videoWorkbench.final_prompt || '';
  }

  if (next.blog_image_workbench || next.blog_image_prompts) {
    const blogImageWorkbench = {
      ...((next.blog_image_workbench || {})),
      source_context: source.slice(0, 4000),
    };
    blogImageWorkbench.prompt_bundle = kcStringifyPromptBundle(kcBuildBlogImagePromptBundle(blogImageWorkbench));
    next.blog_image_workbench = blogImageWorkbench;
    next.blog_image_prompts = kcParsePromptBundle(blogImageWorkbench.prompt_bundle, kcBuildBlogImagePromptBundle(blogImageWorkbench))
      .map(item => String(item?.visual_prompt || item?.prompt || '').trim())
      .filter(Boolean);
  }

  if (next.detail_page_workbench || next.detail_page_slides || next.detail_page_section_template) {
    const rawTemplate = (next.detail_page_workbench || {}).section_template || next.detail_page_section_template || '';
    const detailWorkbench = {
      ...((next.detail_page_workbench || {})),
      source_context: source.slice(0, 4000),
      section_template: rawTemplate
        ? kcNormalizeDetailSectionTemplate(
            rawTemplate,
            next.detail_page_design_rules || (next.detail_page_workbench || {}).design_rules || '',
          )
        : '',
    };
    detailWorkbench.prompt_bundle = kcStringifyPromptBundle(kcBuildDetailPromptDrafts(detailWorkbench));
    next.detail_page_workbench = detailWorkbench;
    next.detail_page_section_template = detailWorkbench.section_template || '';
    next.detail_page_slides = kcParsePromptBundle(detailWorkbench.prompt_bundle, kcBuildDetailPromptDrafts(detailWorkbench));
  }

  _kcPromptOverrides = next;
}

function kcBuildLocalPromptWorkbenchFallback(payload) {
  const scrapedFallback = (payload?.body?.scraped_texts || []).slice(0, 3).join('\n\n').slice(0, 5000);
  const promptMeta = {
    source_summary: String(_kcLastPromptSourceSummary || '').trim() || scrapedFallback || kcFallbackSourceSummaryText(),
  };
  const prompts = {};
  const opts = payload?.opts || {};
  if (payload?.body?.generate_blog) {
    prompts.blog = {
      system_prompt: (_kcPromptOverrides?.blog?.system_prompt) || '당신은 한국어 마케팅 블로그 전문 작성자입니다.',
      user_prompt: (_kcPromptOverrides?.blog?.user_prompt) || '핵심 자료와 브랜드 맥락을 반영해 블로그 글을 작성하세요.',
    };
  }
  if (payload?.body?.generate_cardnews) {
    prompts.cardnews = {
      text_prompt: _kcPromptOverrides?.cardnews_text_prompt || `${payload.keyword} 주제로 ${opts.cn_slides || 5}장의 카드뉴스를 작성하세요.`,
    };
  }
  if (payload?.body?.generate_sns) {
    prompts.sns = {
      prompt: _kcPromptOverrides?.sns_prompt || `${payload.keyword} 주제를 바탕으로 스레드와 트위터 글을 작성하세요.`,
    };
  }
  prompts.video = {
    prompt: _kcPromptOverrides?.video_prompt || kcBuildVideoPromptBundle(payload).final_prompt,
  };
  prompts.comic = {
    script_prompt: _kcPromptOverrides?.comic_script_prompt || comicDefaultPrompt(payload.keyword, promptMeta.source_summary),
  };
  return kcBuildPromptWorkbench(prompts, payload, promptMeta);
}

function kcBuildEmergencyPromptWorkbenchFallback(payload) {
  // 임시 폴백 텍스트 대신 실제 스크랩 텍스트 사용
  const scrapedFallback = (payload?.body?.scraped_texts || []).slice(0, 3).join('\n\n').slice(0, 5000);
  const promptMeta = {
    source_summary: String(_kcLastPromptSourceSummary || '').trim() || scrapedFallback || kcFallbackSourceSummaryText(),
  };
  const prompts = {};
  const opts = payload?.opts || {};
  if (payload?.body?.generate_blog) {
    prompts.blog = {
      system_prompt: (_kcPromptOverrides?.blog?.system_prompt) || '당신은 한국어 마케팅 블로그 전문 작성자입니다.',
      user_prompt: (_kcPromptOverrides?.blog?.user_prompt) || '핵심 자료와 브랜드 맥락을 반영해 블로그 글을 작성하세요.',
    };
  }
  if (payload?.body?.generate_cardnews) {
    prompts.cardnews = {
      text_prompt: _kcPromptOverrides?.cardnews_text_prompt || `${payload.keyword} 주제로 ${opts.cn_slides || 5}장의 카드뉴스를 작성하세요.`,
    };
  }
  if (payload?.body?.generate_sns) {
    prompts.sns = {
      prompt: _kcPromptOverrides?.sns_prompt || `${payload.keyword} 주제를 바탕으로 스레드와 트위터 글을 작성하세요.`,
    };
  }
  prompts.video = {
    prompt: _kcPromptOverrides?.video_prompt || kcBuildVideoPromptBundle(payload).final_prompt,
  };
  prompts.comic = {
    script_prompt: _kcPromptOverrides?.comic_script_prompt || comicDefaultPrompt(payload.keyword, promptMeta.source_summary),
  };
  return kcBuildPromptWorkbench(prompts, payload, promptMeta);
}

function comicDefaultPrompt(topic, reference = '') {
  return `스토리 만화를 만들려고 합니다.

주제: ${topic || '콘텐츠 주제'}

[참고 자료]
${String(reference || '').slice(0, 2000)}

4컷으로 고정하지 말고 자료 흐름에 맞춰 보통 5~8컷의 JSON 배열로 만들어주세요.`;
}

function kcPrepareComicGenerationFromBlog(payload, topic, blogBody = '') {
  const reference = String(blogBody || '').trim().slice(0, 3000);
  if (!reference) return null;
  const workbench = kcBuildComicWorkbench(
    { script_prompt: comicDefaultPrompt(topic, reference) },
    payload,
    { source_summary: reference },
    { referenceContext: reference, forceRecompose: true, forceRebuildPanels: true },
  );
  const panels = kcParsePromptBundle(workbench.panel_bundle, kcBuildComicPanelDrafts(workbench));
  return {
    reference,
    workbench,
    panels,
    scriptPrompt: workbench.final_prompt || comicDefaultPrompt(topic, reference),
  };
}

function kcGetDefaultRefineSettings() {
  return {
    system_prompt: '당신은 세계 최고 수준의 마케팅 콘텐츠 생성용 프롬프트 엔지니어입니다. 사용자의 의도는 유지하면서도 결과 품질이 훨씬 높아지도록 프롬프트를 재구성합니다.',
    user_template: [
      '다음 {block_name} 프롬프트를 현재 상황에 맞게 다시 고도화해서 새로 만들어주세요.',
      '',
      '키워드: {keyword}',
      '브랜드명: {brand_name}',
      '비즈니스 목적: {business_goal}',
      '',
      '규칙:',
      '- 사용자의 의도는 유지',
      '- 현재 상황과 입력 자료에 맞게 더 좋은 프롬프트로 다시 작성',
      '- 더 구체적이고 실행 가능한 지시로 재구성',
      '- 맥락, 톤, 제약사항을 알아서 보강',
      '- 입력이 JSON이면 반드시 같은 키 구조를 유지',
      '- 출력은 반드시 {response_schema}만',
      '',
      '입력:',
      '{prompt_input}',
    ].join('\n'),
  };
}

function kcGetRefinePresetMap() {
  return {
    balanced: {
      label: '기본형',
      system_prompt: '당신은 숙련된 마케팅 콘텐츠용 프롬프트 엔지니어입니다. 사용자의 의도는 유지하면서 결과 품질이 좋아지도록 프롬프트를 더 구체적이고 실행 가능하게 다듬습니다.',
    },
    strict: {
      label: '정교형',
      system_prompt: '당신은 매우 정교한 프롬프트 아키텍트입니다. 모호한 표현을 없애고, 결과 형식과 제약 조건, 맥락, 출력 품질 기준을 분명하게 강화합니다.',
    },
    concise: {
      label: '간결형',
      system_prompt: '당신은 간결하고 실전적인 프롬프트 편집자입니다. 군더더기를 줄이고 핵심 지시만 남기면서도 결과물이 흔들리지 않게 정리합니다.',
    },
    conversion: {
      label: '전환형',
      system_prompt: '당신은 성과 중심 마케팅 프롬프트 엔지니어입니다. 클릭, 문의, 전환을 높일 수 있도록 CTA와 고객 맥락, 설득 구조를 강화합니다.',
    },
  };
}

function kcApplyRefinePreset(presetKey = 'balanced') {
  const modal = kcGetPromptWorkbenchContainer();
  if (!modal) return;
  const preset = kcGetRefinePresetMap()[presetKey];
  if (!preset) return;
  const systemEl = modal.querySelector('[data-prompt-tab="refine"][data-prompt-stage="system_prompt"]');
  if (systemEl) systemEl.value = preset.system_prompt;
  toast(`고도화 설정 ${preset.label} 프리셋을 적용했습니다.`);
}

function kcInsertRefineToken(token) {
  const modal = kcGetPromptWorkbenchContainer();
  if (!modal) return;
  const active = document.activeElement;
  const target = active && active.matches?.('[data-prompt-tab="refine"][data-prompt-stage]') ? active : modal.querySelector('[data-prompt-tab="refine"][data-prompt-stage="user_template"]');
  if (!target) return;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const before = target.value.slice(0, start);
  const after = target.value.slice(end);
  target.value = `${before}${token}${after}`;
  target.focus();
  const nextPos = start + token.length;
  target.setSelectionRange?.(nextPos, nextPos);
}
