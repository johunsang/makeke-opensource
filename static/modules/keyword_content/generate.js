// keyword_content/generate.js — 생성 흐름/콘텐츠 탭/블로그 이미지/블로그 발행

// 생성 진행 상태 표시
// --- Content Tab Switching ---
function kcResetGeneratedContentOrder() {
  window._kcGeneratedContentOrder = [];
}

function kcMarkGeneratedContent(tab) {
  if (!tab) return;
  if (!Array.isArray(window._kcGeneratedContentOrder)) {
    window._kcGeneratedContentOrder = [];
  }
  if (!window._kcGeneratedContentOrder.includes(tab)) {
    window._kcGeneratedContentOrder.push(tab);
  }
}

function kcReorderContentTabs() {
  const tabWrap = document.querySelector('#kc-content-tabs > div');
  if (!tabWrap) return;
  const defaultOrder = ['blog', 'sns', 'cardnews', 'comic', 'video', 'detail'];
  const generatedOrder = Array.isArray(window._kcGeneratedContentOrder) ? window._kcGeneratedContentOrder : [];
  const merged = [...generatedOrder.filter(tab => defaultOrder.includes(tab)), ...defaultOrder.filter(tab => !generatedOrder.includes(tab))];
  merged.forEach(tab => {
    const btn = document.getElementById('kc-tab-' + tab);
    if (btn) tabWrap.appendChild(btn);
  });
}

async function kcAttachBlogImagesToProject(projectDir) {
  const dir = String(projectDir || window._kcBlogImagesDir || '').trim();
  if (!dir) return;
  window._kcBlogImagesDir = dir;
  if (typeof _kcProjectId === 'undefined' || !_kcProjectId) return;
  await api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { blog_images_dir: dir } });
}

function kcRevealGeneratedContent(tab) {
  if (!tab) return;
  kcMarkGeneratedContent(tab);
  kcUpdateContentTabs(tab);
}

function kcSwitchContentTab(tab) {
  const tabBtn = document.getElementById('kc-tab-' + tab);
  if (tabBtn && tabBtn.disabled) return;
  const panels = ['blog','sns','cardnews','comic','video','detail'];
  panels.forEach(p => {
    const panel = document.getElementById('kc-panel-' + p);
    const btn = document.getElementById('kc-tab-' + p);
    if (panel) panel.style.display = (p === tab) ? '' : 'none';
    if (btn) btn.classList.toggle('active', p === tab);
  });
}

function kcUpdateContentTabs(preferredTab = '') {
  const blogResult = document.getElementById('kc-blog-result');
  const snsResult = document.getElementById('kc-sns-result');
  const cnResult = document.getElementById('kc-cardnews-result');
  const comicResult = document.getElementById('kc-comic-result');
  const vidResult = document.getElementById('kc-video-result');
  const imgBlogResult = document.getElementById('kc-image-blog-result');

  const hasBlog = blogResult && blogResult.style.display !== 'none';
  const hasSns = snsResult && snsResult.style.display !== 'none';
  const hasCn = cnResult && cnResult.style.display !== 'none';
  const hasComic = comicResult && comicResult.style.display !== 'none';
  const hasVideo = vidResult && vidResult.style.display !== 'none';
  const hasDetail = imgBlogResult && imgBlogResult.style.display !== 'none';
  const hasCnImages = !!(document.getElementById('kc-cn-actions') && document.getElementById('kc-cn-actions').style.display !== 'none');

  // Show the tab bar
  const tabBar = document.getElementById('kc-content-tabs');
  if (tabBar) tabBar.style.display = '';

  // Enable/disable tabs based on content
  const tabComic = document.getElementById('kc-tab-comic');
  const tabVideo = document.getElementById('kc-tab-video');
  const tabDetail = document.getElementById('kc-tab-detail');
  if (tabComic) tabComic.disabled = false; // 항상 활성화
  if (tabVideo) tabVideo.disabled = !hasCnImages;
  if (tabDetail) tabDetail.disabled = !hasBlog;

  // Hide placeholder messages based on state
  const noCardnews = document.getElementById('kc-video-no-cardnews');
  if (noCardnews) noCardnews.style.display = hasCnImages ? 'none' : '';
  const noBlog = document.getElementById('kc-detail-no-blog');
  if (noBlog) noBlog.style.display = hasBlog ? 'none' : '';
  const detailGenArea = document.getElementById('kc-detail-gen-area');
  if (detailGenArea) detailGenArea.style.display = hasBlog ? '' : 'none';

  if (hasBlog) kcMarkGeneratedContent('blog');
  if (hasSns) kcMarkGeneratedContent('sns');
  if (hasCn) kcMarkGeneratedContent('cardnews');
  if (hasComic) kcMarkGeneratedContent('comic');
  if (hasVideo) kcMarkGeneratedContent('video');
  if (hasDetail) kcMarkGeneratedContent('detail');
  kcReorderContentTabs();

  const activeTab = document.querySelector('#kc-content-tabs .kc-content-tab.active')?.id?.replace('kc-tab-', '') || '';
  const availableOrder = (Array.isArray(window._kcGeneratedContentOrder) ? window._kcGeneratedContentOrder : [])
    .filter(tab => ({
      blog: hasBlog,
      sns: hasSns,
      cardnews: hasCn,
      comic: hasComic,
      video: hasVideo,
      detail: hasDetail,
    })[tab]);
  const fallbackOrder = ['blog', 'sns', 'cardnews', 'comic', 'video', 'detail'].filter(tab => ({
    blog: hasBlog,
    sns: hasSns,
    cardnews: hasCn,
    comic: hasComic,
    video: hasVideo,
    detail: hasDetail,
  })[tab]);
  const firstAvailable = availableOrder[0] || fallbackOrder[0] || 'blog';
  const visibleTabs = [...availableOrder, ...fallbackOrder];
  const nextTab = visibleTabs.includes(preferredTab)
    ? preferredTab
    : visibleTabs.includes(activeTab)
      ? activeTab
      : firstAvailable;
  kcSwitchContentTab(nextTab);
}

let _kcGenStagePlan = [];
let _kcGenStageMap = {};
let _kcGenStageCurrentKey = '';

function kcStageLabelFromKey(key) {
  const labels = {
    prepare: '생성 준비',
    reference: '참조 이미지 준비',
    blog: '블로그 글',
    blog_images: '블로그 이미지',
    cardnews_text: '카드뉴스 텍스트',
    cardnews_image: '카드뉴스 이미지',
    sns: 'SNS 글',
    detail: '상세페이지 이미지',
    comic: '스토리 만화',
    video_slide: '슬라이드 영상',
    video_ai: 'AI 영상',
    complete: '생성 마무리',
  };
  return labels[key] || key || '진행 상태';
}

function kcBuildStagePlan(opts = {}, collectedImageCount = 0) {
  const plan = [{ key: 'prepare', label: kcStageLabelFromKey('prepare') }];
  const needsBlogDraft = !!(
    opts.gen_blog ||
    opts.gen_cardnews ||
    opts.gen_detail_page ||
    opts.gen_video_slide ||
    opts.gen_video_veo ||
    ((parseInt(opts.blog_image_count || 0, 10) > 0) || opts.gen_blog_images)
  );
  if (collectedImageCount > 0) plan.push({ key: 'reference', label: kcStageLabelFromKey('reference') });
  if (needsBlogDraft) plan.push({ key: 'blog', label: kcStageLabelFromKey('blog') });
  if (needsBlogDraft && ((parseInt(opts.blog_image_count || 0, 10) > 0) || opts.gen_blog_images)) {
    plan.push({ key: 'blog_images', label: kcStageLabelFromKey('blog_images') });
  }
  if (opts.gen_cardnews || opts.gen_detail_page) plan.push({ key: 'cardnews_text', label: kcStageLabelFromKey('cardnews_text') });
  if (opts.gen_sns) plan.push({ key: 'sns', label: kcStageLabelFromKey('sns') });
  if (opts.gen_cardnews || opts.gen_detail_page) plan.push({ key: 'cardnews_image', label: kcStageLabelFromKey('cardnews_image') });
  if (opts.gen_detail_page) plan.push({ key: 'detail', label: kcStageLabelFromKey('detail') });
  if (opts.gen_comic) plan.push({ key: 'comic', label: kcStageLabelFromKey('comic') });
  if (opts.gen_video_slide) plan.push({ key: 'video_slide', label: kcStageLabelFromKey('video_slide') });
  if (opts.gen_video_veo) plan.push({ key: 'video_ai', label: kcStageLabelFromKey('video_ai') });
  plan.push({ key: 'complete', label: kcStageLabelFromKey('complete') });
  return plan;
}

function kcEnsureGenerationStageBoard() {
  const container = document.getElementById('kc-gen-steps');
  if (!container) return;
  let board = document.getElementById('kc-gen-stage-board');
  if (!board) {
    board = document.createElement('div');
    board.id = 'kc-gen-stage-board';
    board.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;';
    container.appendChild(board);
  }
  return board;
}

function kcRenderGenerationStageBoard() {
  const board = kcEnsureGenerationStageBoard();
  if (!board) return;
  const items = _kcGenStagePlan.map(stage => {
    const state = _kcGenStageMap[stage.key] || 'pending';
    const isActive = state === 'start';
    const palette = state === 'done'
      ? { bg: 'rgba(52,199,89,0.10)', border: 'rgba(52,199,89,0.28)', fg: '#1f8f45', badge: '완료' }
      : state === 'fail'
        ? { bg: 'rgba(255,59,48,0.08)', border: 'rgba(255,59,48,0.24)', fg: '#d9342b', badge: '실패' }
        : isActive
          ? { bg: 'rgba(255,140,0,0.10)', border: 'rgba(255,140,0,0.28)', fg: '#ff8c00', badge: '진행 중' }
          : { bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.08)', fg: 'rgba(0,0,0,0.62)', badge: '대기' };
    return `
      <div data-stage-key="${stage.key}" style="padding:12px 13px;border-radius:14px;border:1px solid ${palette.border};background:${palette.bg};min-height:66px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="font-size:12px;font-weight:800;color:${palette.fg};line-height:1.4;">${stage.label}</div>
        <div style="font-size:11px;color:${palette.fg};opacity:${isActive ? '1' : '0.85'};display:flex;align-items:center;gap:6px;">
          ${isActive ? '<span class="spinner" style="width:12px;height:12px;border-width:2px;flex-shrink:0;"></span>' : ''}
          <span>${palette.badge}</span>
        </div>
      </div>`;
  });
  board.innerHTML = items.join('');
}

function kcSetGenerationStageStatus(stageKey, status) {
  if (!stageKey) return;
  if (!_kcGenStagePlan.some(stage => stage.key === stageKey)) return;
  _kcGenStageMap[stageKey] = status;
  if (status === 'start') {
    _kcGenStageCurrentKey = stageKey;
    _kcGenStagePlan.forEach(stage => {
      if (stage.key === stageKey) return;
      if ((_kcGenStageMap[stage.key] || 'pending') === 'start') _kcGenStageMap[stage.key] = 'pending';
    });
  }
  if ((status === 'done' || status === 'fail') && _kcGenStageCurrentKey === stageKey) {
    _kcGenStageCurrentKey = '';
  }
  kcRenderGenerationStageBoard();
}

function kcInitGenerationStageBoard(opts = {}, collectedImageCount = 0) {
  _kcGenStagePlan = kcBuildStagePlan(opts, collectedImageCount);
  _kcGenStageMap = {};
  _kcGenStageCurrentKey = '';
  _kcGenStagePlan.forEach(stage => {
    _kcGenStageMap[stage.key] = 'pending';
  });
  kcRenderGenerationStageBoard();
}

function kcGenStep(text, status, stageKey = '') {
  const container = document.getElementById('kc-gen-steps');
  if (!container) return;
  const title = document.getElementById('kc-gen-title');
  const sub = document.getElementById('kc-gen-sub');
  if (title) title.textContent = text;
  if (sub) {
    const stageLabel = stageKey ? kcStageLabelFromKey(stageKey) : '';
    sub.textContent = stageLabel ? `현재 단계: ${stageLabel}` : text;
  }
  if (stageKey) kcSetGenerationStageStatus(stageKey, status);

  if (status === 'start') {
    const step = document.createElement('div');
    step.className = 'kc-gen-step-item';
    step.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;font-size:12px;color:rgba(0,0,0,0.5);background:rgba(0,0,0,0.02);';
    step.innerHTML = `<span class="spinner" style="width:14px;height:14px;flex-shrink:0;"></span><span>${text}</span>`;
    container.appendChild(step);
    return step;
  }
  if (status === 'done') {
    const items = container.querySelectorAll('.kc-gen-step-item');
    const last = items[items.length - 1];
    if (last) {
      last.querySelector('.spinner')?.remove();
      last.innerHTML = `<span style="color:#34c759;font-size:14px;flex-shrink:0;">✓</span><span style="color:#34c759;">${text}</span>`;
    }
  }
  if (status === 'fail') {
    const items = container.querySelectorAll('.kc-gen-step-item');
    const last = items[items.length - 1];
    if (last) {
      last.querySelector('.spinner')?.remove();
      last.innerHTML = `<span style="color:#ff3b30;font-size:14px;flex-shrink:0;">✗</span><span style="color:#ff3b30;">${text}</span>`;
    }
  }
}

let _kcCodexLogPoller = null;

function kcResetCodexLogPanel() {
  const panel = document.getElementById('kc-codex-log-panel');
  const lines = document.getElementById('kc-codex-log-lines');
  const count = document.getElementById('kc-codex-log-count');
  const state = document.getElementById('kc-codex-terminal-state');
  const toggle = document.getElementById('kc-codex-terminal-toggle');
  if (panel) {
    panel.style.display = 'none';
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.add('is-collapsed');
  }
  if (lines) lines.textContent = 'Codex 로그 대기 중...';
  if (count) count.textContent = '0줄';
  if (state) state.textContent = '실행 중';
  if (toggle) toggle.textContent = '펼침';
}

function kcToggleCodexLogPanel() {
  const panel = document.getElementById('kc-codex-log-panel');
  const toggle = document.getElementById('kc-codex-terminal-toggle');
  if (!panel) return;
  panel.style.display = 'none';
  panel.setAttribute('aria-hidden', 'true');
  const collapsed = panel.classList.toggle('is-collapsed');
  if (toggle) toggle.textContent = collapsed ? '펼침' : '접힘';
}

function kcStopCodexLogPolling() {
  if (_kcCodexLogPoller) {
    clearInterval(_kcCodexLogPoller);
    _kcCodexLogPoller = null;
  }
}

async function kcRefreshCodexLogPanel() {
  const panel = document.getElementById('kc-codex-log-panel');
  const lines = document.getElementById('kc-codex-log-lines');
  const count = document.getElementById('kc-codex-log-count');
  const state = document.getElementById('kc-codex-terminal-state');
  if (!panel || !lines) return;
  panel.style.display = 'none';
  panel.setAttribute('aria-hidden', 'true');
  try {
    const res = await api('/api/content/codex-logs');
    const logs = Array.isArray(res.logs) ? res.logs : [];
    if (logs.length > 0) {
      lines.textContent = logs.join('\n');
      lines.scrollTop = lines.scrollHeight;
      if (count) count.textContent = `${logs.length}줄`;
      if (state) state.textContent = logs.some(line => /completed|완료/i.test(line)) ? '완료' : '실행 중';
    }
  } catch {
    if (count) count.textContent = '조회 실패';
    if (state) state.textContent = '연결 실패';
  }
}

function kcStartCodexLogPolling() {
  kcStopCodexLogPolling();
  kcResetCodexLogPanel();
}


function kcBuildBlogImagePromptSlides(content, keyword, count = 3, workbenchOverride = null) {
  const workbench = workbenchOverride || _kcPromptOverrides?.blog_image_workbench || {};
  const sourceContext = String(kcGetCurrentBlogBody(4000) || content || workbench.source_context || _kcLastPromptSourceSummary || '').trim();
  const designRules = String(workbench.design_rules || _kcPromptOverrides?.blog_image_design_rules || '- 표현 방식은 내용에 따라 자유롭게 결정하세요.\n- 일러스트, 에디토리얼 그래픽, 개념 장면, 오브제 중심 이미지, 다이어그램, 상징적 구성을 상황에 맞게 선택하세요.\n- 같은 구도·같은 색조·같은 아이콘 배치를 반복하지 마세요.\n- 16:9 비율을 유지하고 텍스트 없이 핵심 의미가 읽히게 구성하세요.\n- 브랜드 톤은 참고만 하고, 모든 이미지를 같은 템플릿으로 만들지 마세요.').trim();
  const promptTemplate = String(workbench.prompt_template || `블로그 삽입용 이미지를 생성하세요.\n\n블로그 주제: {keyword}\n블로그 전체 맥락: {source_context}\n현재 이미지: {index}/{total}\n이 섹션의 제목: {title}\n이 섹션의 내용: {body}\n\n디자인 참고:\n{design_rules}\n\n중요:\n- 이 섹션 내용에 가장 잘 맞는 시각 언어를 AI가 스스로 결정하세요.\n- 다른 이미지들과 똑같은 템플릿처럼 보이지 않게 장면, 구도, 거리감, 색상 흐름, 매체 느낌을 달리하세요.\n- 텍스트를 이미지에 억지로 넣지 말고 핵심 내용이 시각적으로 바로 읽히게 구성하세요.`).trim();
  const target = Math.max(1, parseInt(count || 3, 10));
  const keywordText = keyword || '블로그';
  let selectedSections = kcBuildSourceDrivenSections(keywordText, sourceContext, target);

  if (!selectedSections.length) {
    const blocks = String(content || '')
      .split(/\n\s*\n/)
      .map(x => x.trim())
      .filter(x => x.length > 40);
    selectedSections = (blocks.length <= target
      ? blocks
      : Array.from({ length: target }, (_, i) => blocks[Math.min(blocks.length - 1, Math.floor((blocks.length / target) * i))])
    ).map((body, idx) => ({
      title: `${keywordText} 이미지 ${idx + 1}`,
      body,
      iscover: idx === 0,
    }));
  }

  return selectedSections.slice(0, target).map((section, idx) => ({
    index: idx,
    title: section.title || `${keywordText} 이미지 ${idx + 1}`,
    body: String(section.body || '').slice(0, 260),
    visual_prompt: promptTemplate
      .replaceAll('{keyword}', keywordText)
      .replaceAll('{source_context}', sourceContext)
      .replaceAll('{index}', String(idx + 1))
      .replaceAll('{total}', String(target))
      .replaceAll('{title}', String(section.title || `${keywordText} 이미지 ${idx + 1}`))
      .replaceAll('{body}', String(section.body || '').slice(0, 260))
      .replaceAll('{design_rules}', designRules),
  }));
}

function kcOpenBlogImagePromptModal(slides) {
  return new Promise(resolve => {
    kcCloseOverlappingPromptModals('kc-blog-image-prompt-modal');
    const existing = document.getElementById('kc-blog-image-prompt-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'kc-blog-image-prompt-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;';
    modal.innerHTML = `
      <div style="width:min(1240px, calc(100vw - 32px));max-height:calc(100vh - 32px);background:#fff;border-radius:24px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,0.22);">
        <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:20px;font-weight:800;color:#1c1c1e;">블로그 이미지 프롬프트 확인</div>
              <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-top:4px;">이미지별 프롬프트를 수정한 뒤 바로 생성할 수 있습니다.</div>
            </div>
            <button type="button" id="kc-blog-image-prompt-close" style="width:34px;height:34px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);font-size:18px;cursor:pointer;color:rgba(0,0,0,0.45);">×</button>
          </div>
        </div>
        <div style="padding:20px 24px;overflow:auto;display:flex;flex-direction:column;gap:14px;">
          ${slides.map((s, idx) => `
            <div style="border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:14px;background:#fff;">
              <div style="font-size:14px;font-weight:700;color:#4fc08d;margin-bottom:6px;">이미지 ${idx + 1} · ${escapeHtml(s.title || '')}</div>
              <textarea data-blog-image-prompt-index="${idx}" rows="7" style="width:100%;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;font-size:12px;line-height:1.7;resize:vertical;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif;">${escapeHtml(s.visual_prompt || '')}</textarea>
            </div>
          `).join('')}
        </div>
        <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="kc-blog-image-prompt-cancel" style="padding:11px 18px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.55);">취소</button>
          <button type="button" id="kc-blog-image-prompt-save" style="padding:11px 18px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">이 프롬프트로 생성</button>
        </div>
      </div>
    `;
    const close = value => { modal.remove(); resolve(value); };
    modal.querySelector('#kc-blog-image-prompt-close')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-blog-image-prompt-cancel')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-blog-image-prompt-save')?.addEventListener('click', () => {
      const next = slides.map(s => ({ ...s }));
      modal.querySelectorAll('[data-blog-image-prompt-index]').forEach(el => {
        const idx = parseInt(el.getAttribute('data-blog-image-prompt-index') || '-1', 10);
        if (next[idx]) next[idx].visual_prompt = el.value || next[idx].visual_prompt;
      });
      close(next);
    });
    modal.addEventListener('click', e => { if (e.target === modal) close(null); });
    document.body.appendChild(modal);
    kcBringModalToFront(modal);
  });
}

async function kcGenerateBlogImages(options = {}) {
  const content = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || document.getElementById('kc-blog-title')?.value?.trim() || '블로그');
  if (!content) { toast('블로그 본문이 없습니다.', 'error'); return; }
  const count = parseInt(window._contentOpts?.blog_image_count || 0, 10) || 3;
  const selectedImages = [
    ...(_kcFinalImages || []).filter(x => x.selected).map(x => x.url),
    ...kcCollectExplicitSourceSelectedImages(),
  ].filter(Boolean);
  const usePrebuiltPrompts = options.usePrebuiltPrompts === true;
  const promptSlides = usePrebuiltPrompts && Array.isArray(_kcPromptOverrides?.blog_image_prompt_slides) && _kcPromptOverrides.blog_image_prompt_slides.length
    ? _kcPromptOverrides.blog_image_prompt_slides
    : kcBuildBlogImagePromptSlides(content, keyword, count);
  _kcPromptOverrides = {
    ...(_kcPromptOverrides || {}),
    blog_image_prompts: promptSlides.map(x => x.visual_prompt || ''),
    blog_image_prompt_slides: promptSlides,
  };
  try {
    toast('블로그 이미지 생성 중...');
    window._kcBlogImages = [];
    window._kcBlogImagesDir = '';
    const progressState = kcRenderBlogImagesProgressShell(promptSlides);
    let projectDir = '';
    for (let i = 0; i < promptSlides.length; i++) {
      const slide = promptSlides[i] || {};
      kcSetBlogImageProgress(progressState, i, 'loading');
      try {
        const res = await api('/api/blog/generate-image', {
          method: 'POST',
          body: {
            keyword,
            brand_name: document.getElementById('kc-brand-name')?.value?.trim() || '',
            profile_id: parseInt(window._globalProfileId || 0, 10),
            image_index: i,
            image_count: promptSlides.length,
            title: slide.title || `${keyword} 이미지 ${i + 1}`,
            body: slide.body || '',
            visual_prompt: slide.visual_prompt || '',
            project_dir: projectDir || '',
            user_image_urls: selectedImages,
          },
        });
        if (!projectDir && res.project_dir) {
          projectDir = res.project_dir;
          window._kcBlogImagesDir = projectDir;
        }
        const image = {
          index: i,
          filename: res.filename || `blog_img_${String(i + 1).padStart(2, '0')}.png`,
          url: res.url,
          project_dir: projectDir || '',
        };
        window._kcBlogImages.push(image);
        kcSetBlogImageProgress(progressState, i, 'done', image.url, slide.title || `${keyword} 이미지 ${i + 1}`);
      } catch (e) {
        kcSetBlogImageProgress(progressState, i, 'error', '', slide.title || `${keyword} 이미지 ${i + 1}`, e?.message || '생성 실패');
      }
    }
    await kcAttachBlogImagesToProject(projectDir);
    kcRenderBlogImagesPreview();
    toast(`블로그 이미지 ${window._kcBlogImages.length}장 생성 완료`);
    return window._kcBlogImages.length > 0;
  } catch (e) {
    toast('블로그 이미지 생성 실패: ' + e.message, 'error');
    return false;
  }
}

function kcBuildGenerateStageBody(payload, overrides = {}) {
  return {
    ...payload.body,
    prompt_overrides: _kcPromptOverrides || {},
    ...overrides,
  };
}

async function kcRequestGenerateStage(payload, overrides = {}) {
  return api('/api/content/generate', {
    method: 'POST',
    body: kcBuildGenerateStageBody(payload, overrides),
  });
}

async function kcRequestCardnewsTextStage(payload, overrides = {}) {
  return api('/api/cardnews/generate-texts', {
    method: 'POST',
    body: kcBuildGenerateStageBody(payload, overrides),
  });
}

function kcCurrentBlogBody() {
  return document.getElementById('kc-blog-body')?.value?.trim() || '';
}

function kcApplyBlogStageResult(blogData, keyword) {
  const blogResult = document.getElementById('kc-blog-result');
  if (blogData && !blogData.error) {
    kcRevealGeneratedContent('blog');
    kcGenStep(`블로그 글 완료 — ${blogData.char_count}자`, 'done', 'blog');
    _kcBlogPostId = blogData.post_id;
    if (_kcProjectId) {
      api(`/api/projects/${_kcProjectId}`, {
        method: 'PUT',
        body: { blog_id: blogData.post_id, name: (blogData.title || keyword).substring(0, 50) },
      }).catch(() => {});
    }
    document.getElementById('kc-blog-title').value = blogData.title;
    document.getElementById('kc-blog-body').value = blogData.body;
    document.getElementById('kc-blog-chars').textContent = blogData.char_count;
    document.getElementById('kc-blog-tags').value = '태그 생성 중...';
    const brandName = document.getElementById('kc-brand-name')?.value || '';
    api('/api/content/extract-tags', {
      method: 'POST',
      body: { text: (blogData.body || blogData.content || '').substring(0, 2000), count: 10 },
    }).then(r => {
      const badWords = ['제목','브랜드','본문','에','의','를','은','는','이','가','로','으로','에서','까지','부터','사회','경제','문화','스마트','진짜','아직','이제','근데','Number'];
      let tags = (r.tags || '').split(',').map(t => t.trim().replace(/[:.\[\]"']/g, ''))
        .filter(t => {
          if (t.length < 2 || t.length > 15) return false;
          if (badWords.includes(t)) return false;
          const low = t.toLowerCase();
          if (/https?|www\.|\.com|\.net|\.org|\.kr|youtube|naver|google|tistory|daum|brunch/i.test(low)) return false;
          return true;
        });
      if (brandName) tags = tags.filter(t => t !== brandName && !t.includes(brandName));
      if (keyword && !tags.some(t => t.includes(keyword.split(' ')[0]))) tags.unshift(keyword.split(' ')[0]);
      const tagStr = [...new Set(tags)].slice(0, 10).join(', ');
      document.getElementById('kc-blog-tags').value = tagStr;
      if (_kcBlogPostId) api(`/api/blog/posts/${_kcBlogPostId}`, { method: 'PUT', body: { tags: tagStr } }).catch(() => {});
    }).catch(() => {
      document.getElementById('kc-blog-tags').value = keyword;
    });
    blogResult.style.display = 'block';
    kcSyncDerivedPromptsToBlogBody(blogData.body || blogData.content || '');
    kcRenderBlogImagesPreview();
    toast('블로그 글 생성 완료!');
    return;
  }
  if (blogData && blogData.error) {
    kcGenStep(`블로그 생성 실패: ${blogData.error}`, 'fail', 'blog');
    blogResult.style.display = 'block';
    blogResult.querySelector('div').innerHTML = `<p style="color:#e05c5c;font-size:13px;">블로그 생성 실패: ${escapeHtml(blogData.error)}</p>`;
    return;
  }
  blogResult.style.display = 'none';
}

function kcApplyCardnewsTextStageResult(cardnewsData) {
  const cnResult = document.getElementById('kc-cardnews-result');
  console.log('[KC] cardnews 텍스트 응답:', cardnewsData ? JSON.stringify({ keys: Object.keys(cardnewsData), slides_count: (cardnewsData.slides || []).length }) : 'null');
  if (cardnewsData && !cardnewsData.error) {
    kcRevealGeneratedContent('cardnews');
    kcGenStep(`카드뉴스 텍스트 완료 — ${(cardnewsData.texts || cardnewsData.slides || []).length}장`, 'done', 'cardnews_text');
    cnResult.style.display = 'block';
    if (typeof kcRenderCardnewsMeta === 'function') kcRenderCardnewsMeta(cardnewsData.meta || {});
    if (cardnewsData.project_dir) _kcCardnewsDir = cardnewsData.project_dir;
    if (typeof kcRefreshCardnewsFolderHint === 'function') kcRefreshCardnewsFolderHint();
    _kcCnTexts = cardnewsData.texts || cardnewsData.slides || [];
    _kcCnCardnewsId = cardnewsData.cardnews_id || null;
    if (_kcProjectId && cardnewsData.cardnews_id) {
      api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { cardnews_id: cardnewsData.cardnews_id } }).catch(() => {});
    }
    kcRenderCnEditor(_kcCnTexts);
    document.getElementById('kc-cn-editor').style.display = 'block';
    document.getElementById('kc-cardnews-slides').innerHTML = '';
    document.getElementById('kc-cn-actions').style.display = 'none';
    kcLoadDesignRefs();
    toast('카드뉴스 텍스트 생성 완료! 이미지를 이어서 생성합니다.');
    return;
  }
  if (cardnewsData && cardnewsData.error) {
    kcGenStep(`카드뉴스 실패: ${cardnewsData.error}`, 'fail', 'cardnews_text');
    cnResult.style.display = 'block';
    document.getElementById('kc-cn-editor').style.display = 'none';
    document.getElementById('kc-cardnews-slides').innerHTML = `<p style="color:#ff453a;font-size:13px;">카드뉴스 생성 실패: ${escapeHtml(cardnewsData.error)}</p>`;
    return;
  }
  cnResult.style.display = 'none';
}

function kcApplySNSStageResult(snsData) {
  const snsResult = document.getElementById('kc-sns-result');
  if (snsData && !snsData.error) {
    kcRevealGeneratedContent('sns');
    kcGenStep('SNS 글 완료 (스레드 + 트위터 + 인스타)', 'done', 'sns');
    const safeThreads = normalizeThreadsText(snsData.threads || '');
    const safeTwitter = normalizeTwitterPostText(snsData.twitter || '');
    const igCaption = (snsData.instagram || '').trim();
    document.getElementById('kc-sns-threads-text').value = safeThreads;
    document.getElementById('kc-sns-twitter-text').value = safeTwitter;
    const igCaptionEl = document.getElementById('kc-cn-ig-caption');
    if (igCaptionEl && igCaption) igCaptionEl.value = igCaption;
    const igCaptionEl2 = document.getElementById('kc-sns-ig-caption');
    if (igCaptionEl2 && igCaption) igCaptionEl2.value = igCaption;
    snsResult.style.display = 'block';
    if (_kcProjectId) {
      const snsUpdate = { threads_text: safeThreads, twitter_text: safeTwitter };
      if (igCaption) snsUpdate.ig_caption = igCaption;
      api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: snsUpdate }).catch(() => {});
    }
    toast(`SNS 글 생성 완료! 스레드 ${safeThreads.length}자 · 트위터 ${safeTwitter.length}자 · 인스타 ${igCaption.length}자`);
    return;
  }
  if (snsData && snsData.error) {
    kcGenStep(`SNS 생성 실패: ${snsData.error}`, 'fail', 'sns');
  }
  snsResult.style.display = 'none';
}

function kcRenderBlogImagesProgressShell(slides) {
  const container = document.getElementById('kc-blog-images-grid');
  const wrapper = document.getElementById('kc-blog-images-preview');
  if (!container || !wrapper) return null;
  wrapper.style.display = 'block';
  const items = Array.isArray(slides) ? slides : [];
  container.innerHTML = items.map((slide, i) => `
    <div id="kc-blog-image-progress-${i}" style="border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);background:#fff;box-shadow:0 8px 18px rgba(15,23,42,0.05);">
      <div style="aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,107,0,0.04));color:rgba(0,0,0,0.36);font-size:12px;font-weight:700;">
        <span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span>생성 대기
      </div>
      <div style="padding:8px 10px;">
        <div style="font-size:11px;font-weight:800;color:#1c1c1e;">이미지 ${i + 1}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);margin-top:4px;line-height:1.5;">${escapeHtml(slide?.title || '')}</div>
        <div class="kc-blog-image-progress-meta" style="font-size:10px;color:#ff8c00;margin-top:6px;">대기 중</div>
      </div>
    </div>
  `).join('');
  return { container, wrapper, total: items.length };
}

function kcSetBlogImageProgress(state, index, status, imageUrl = '', title = '', message = '') {
  const card = document.getElementById(`kc-blog-image-progress-${index}`);
  if (!card) return;
  const meta = card.querySelector('.kc-blog-image-progress-meta');
  if (status === 'loading') {
    card.querySelector('div').innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span>생성 중';
    if (meta) meta.textContent = '생성 중...';
    return;
  }
  if (status === 'done') {
    card.innerHTML = `
      <div style="position:relative;cursor:pointer;" onclick="kcShowImagePreview('${encImg(imageUrl)}?t=${Date.now()}')">
        <img src="${encImg(imageUrl)}?t=${Date.now()}" alt="${escapeHtml(title || `이미지 ${index + 1}`)}" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;">
        <div style="position:absolute;top:8px;left:8px;padding:4px 8px;border-radius:999px;background:rgba(52,199,89,0.92);color:#fff;font-size:10px;font-weight:800;">완료</div>
      </div>
      <div style="padding:8px 10px;">
        <div style="font-size:11px;font-weight:800;color:#1c1c1e;">이미지 ${index + 1}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);margin-top:4px;line-height:1.5;">${escapeHtml(title || '')}</div>
      </div>
    `;
    return;
  }
  card.querySelector('div').innerHTML = '<span style="color:#ff3b30;font-size:16px;margin-right:8px;">!</span>생성 실패';
  if (meta) meta.textContent = message || '생성 실패';
  if (meta) meta.style.color = '#ff3b30';
}

function kcRenderBlogImagesPreview() {
  const container = document.getElementById('kc-blog-images-grid');
  const wrapper = document.getElementById('kc-blog-images-preview');
  if (!container || !wrapper) return;
  const images = window._kcBlogImages || [];
  if (images.length === 0) {
    wrapper.style.display = 'none';
    return;
  }
  wrapper.style.display = 'block';
  container.innerHTML = images.map((img, i) => `
    <div style="border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);background:#f9f9f9;position:relative;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,0.05);" onclick="kcShowImagePreview('${encImg(img.url)}?t=${Date.now()}')">
      <img src="${encImg(img.url)}?t=${Date.now()}" alt="블로그 이미지 ${i+1}" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;" loading="lazy">
      <div style="padding:6px 8px;font-size:10px;color:rgba(0,0,0,0.4);display:flex;justify-content:space-between;align-items:center;">
        <span>AI Generated · 이미지 ${i+1}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:#ff8c00;font-size:10px;font-weight:700;">크게 보기</span>
          <a href="${encImg(img.url)}" download="blog_image_${i+1}.png" onclick="event.stopPropagation();" style="color:#007aff;font-size:10px;text-decoration:none;">다운로드</a>
        </div>
      </div>
    </div>
  `).join('');
}

function kcApplyManualPaste(idx) {
  const text = document.getElementById('kc-manual-paste-' + idx)?.value?.trim();
  if (!text) { toast('본문을 붙여넣기 해주세요', 'error'); return; }
  const source = _kcSelectedSources[idx];
  if (source) {
    source.scrapedText = text;
    source.scrapeVerifiedBody = true;
    source.scrapeStatus = source.scrapeVerifiedImages ? 'success' : 'partial';
    source.checked = true;
    kcRenderSourcesList();
    toast(`${text.length.toLocaleString()}자 본문 적용 완료!`);
  }
}

function kcSwitchInputMode(mode) {
  const modes = ['keyword', 'url', 'direct', 'biz'];
  modes.forEach(m => {
    const el = document.getElementById('kc-input-' + m);
    const btn = document.getElementById('kc-mode-' + m);
    if (el) el.style.display = m === mode ? 'block' : 'none';
    if (btn) {
      btn.style.background = m === mode ? '#007aff' : 'rgba(0,0,0,0.06)';
      btn.style.color = m === mode ? '#fff' : '#1c1c1e';
    }
  });
  // 업종 시나리오 탭 진입 시 데이터 로드 (병렬)
  if (mode === 'biz' && window._globalProfileId) {
    Promise.all([kcLoadBizTopics(), kcLoadBizScenarios()]);
  }
}

// ═══ 업종 시나리오 모드 (1단계 통합) ═══
async function kcLoadBizTopics() {
  const el = document.getElementById('kc-biz-topics');
  if (!window._globalProfileId) { el.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(0,0,0,0.3);font-size:12px;">프로필을 선택하세요</div>'; return; }
  el.innerHTML = '<div style="text-align:center;padding:12px;"><span class="spinner"></span></div>';
  try {
    const res = await api('/api/biz-cardnews/topics', { method: 'POST', body: { profile_id: parseInt(window._globalProfileId) } });
    const topics = res.topics || [];
    if (!topics.length) { el.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(0,0,0,0.3);">추천 주제 없음</div>'; return; }
    el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' + topics.map(t => {
      const name = typeof t === 'string' ? t : (t.name || '');
      const icon = typeof t === 'object' && t.icon ? t.icon + ' ' : '';
      const desc = typeof t === 'object' && t.description ? `<div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:2px;">${escapeHtml(t.description)}</div>` : '';
      return `<div onclick="document.getElementById('kc-biz-topic').value='${escapeHtml(name).replace(/'/g,"\\'")}'" style="padding:10px 12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:10px;cursor:pointer;font-size:12px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)'">${icon}${escapeHtml(name)}${desc}</div>`;
    }).join('') + '</div>';
  } catch (e) { el.innerHTML = `<div style="color:#ff3b30;font-size:12px;">${e.message}</div>`; }
}

async function kcLoadBizScenarios() {
  const el = document.getElementById('kc-biz-scenarios');
  const countEl = document.getElementById('kc-biz-scenario-count');
  if (!window._globalProfileId) return;
  try {
    const profile = window._globalProfileData || await api(`/api/library/profiles/${window._globalProfileId}`);
    const btype = profile.business_type || '';
    const res = await api('/api/biz-cardnews/scenarios', { method: 'POST', body: { business_type: btype } });
    const scenarios = res.scenarios || [];
    if (countEl) countEl.textContent = `${scenarios.length}개`;
    el.innerHTML = scenarios.map(s => `
      <div onclick="document.getElementById('kc-biz-topic').value='${escapeHtml(s.name).replace(/'/g,"\\'")}'" style="padding:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:10px;cursor:pointer;text-align:center;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)'">
        <div style="font-size:20px;margin-bottom:4px;">${s.icon || '📝'}</div>
        <div style="font-size:12px;font-weight:600;color:#1c1c1e;">${escapeHtml(s.name)}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:2px;">${escapeHtml(s.description || '')}</div>
      </div>
    `).join('');
  } catch { el.innerHTML = ''; }
}

async function kcBizResearch() {
  const topic = document.getElementById('kc-biz-topic')?.value?.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }
  const btn = document.getElementById('kc-biz-research-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>';
  try {
    const body = { query: topic };
    if (window._globalProfileId) body.profile_id = parseInt(window._globalProfileId);
    const res = await api('/api/deep-research', { method: 'POST', body, timeout: 60000 });
    if (res.result) {
      const expert = document.getElementById('kc-biz-expert');
      expert.value = (expert.value ? expert.value + '\n\n' : '') + res.result;
      toast(`AI 조사 완료! ${res.result.length.toLocaleString()}자`);
    }
  } catch (e) { toast('AI 조사 실패: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '🔍 AI 조사'; }
}

async function kcBizGenerate() {
  const topic = document.getElementById('kc-biz-topic')?.value?.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }
  if (!window._globalProfileId) { toast('프로필을 선택하세요', 'error'); return; }

  const expert = document.getElementById('kc-biz-expert')?.value?.trim() || '';
  document.getElementById('kc-keyword').value = topic;

  // 소스로 설정
  _kcSearchData = { keyword: topic, sources: [] };
  _kcSelectedSources = [{
    title: topic,
    url: '',
    source: '업종 시나리오',
    type: 'direct',
    checked: true,
    scrapedText: expert || `${topic}에 대한 콘텐츠를 전문적으로 작성해주세요.`,
  }];
  kcRenderSourcesList();

  // 3단계로 이동 후 생성
  kcGoToStep(4);
  await new Promise(r => setTimeout(r, 300));
  await kcGenerate();
}

async function kcDirectGenerate() {
  if (!window._globalProfileId) { toast('프로필을 먼저 선택���세요', 'error'); return; }
  const text = document.getElementById('kc-direct-text').value.trim();
  if (!text) { toast('파일을 업로드하거나 내용을 입력하세요', 'error'); return; }
  const directKeyword = document.getElementById('kc-direct-keyword')?.value?.trim() || '';
  const keyword = directKeyword || document.getElementById('kc-keyword').value.trim() || text.substring(0, 30);
  document.getElementById('kc-keyword').value = keyword;

  // 직접 입력한 텍스트를 소스로 설정
  _kcSearchData = { keyword, sources: [] };
  _kcSelectedSources = [{
    title: keyword,
    snippet: text.substring(0, 200),
    url: '',
    scrapedText: text,
    checked: true,
    type: 'manual',
  }];
  document.getElementById('kc-keyword').value = keyword;

  // 3단계 프롬프트 편집으로 이동
  kcGoToStep(3);
}

async function kcGenerateWithPromptEdit() {
  try {
    const reviewed = await kcRunPromptReviewStep();
    if (!reviewed) return;
    return await kcGenerate(false);
  } catch (e) {
    console.error('[KC] generate with prompt edit failed', e);
    toast('프롬프트 수정 후 생성 실패: ' + (e?.message || e), 'error');
    _kcGenerating = false;
    kcSetGenerateButtonsLoading(false);
    unlockScreen();
  }
}

function kcUpdatePromptReviewStatus() {
  const badge = document.getElementById('kc-prompt-review-status');
  const nextBtn = document.getElementById('kc-next-to-generate');
  if (badge) {
    badge.textContent = _kcPromptReviewed ? '확인 완료' : '확인 필요';
    badge.style.color = _kcPromptReviewed ? '#34c759' : '#ff8c00';
    badge.style.background = _kcPromptReviewed ? 'rgba(52,199,89,0.10)' : 'rgba(255,140,0,0.10)';
    badge.style.borderColor = _kcPromptReviewed ? 'rgba(52,199,89,0.18)' : 'rgba(255,140,0,0.18)';
  }
  if (nextBtn) {
    nextBtn.disabled = !_kcPromptReviewed;
    nextBtn.style.opacity = _kcPromptReviewed ? '1' : '0.35';
    nextBtn.style.cursor = _kcPromptReviewed ? 'pointer' : 'not-allowed';
  }
}

async function kcRunPromptReviewStep() {
  if (_kcPromptReviewOpening) return false;
  _kcPromptReviewOpening = true;
  const payload = kcBuildGeneratePayload();
  const promptSignature = kcEnsureFreshPromptReviewState(payload);
  try {
    const reviewedOverrides = await kcReviewPromptsBeforeGenerate(payload).catch(e => {
      toast('프롬프트 확인 실패: ' + e.message, 'error');
      return null;
    });
    if (!reviewedOverrides) {
      _kcPromptReviewed = false;
      kcUpdatePromptReviewStatus();
      return false;
    }
    _kcPromptOverrides = reviewedOverrides;
    _kcLastPromptReviewSignature = promptSignature;
    _kcPromptReviewed = true;
    kcUpdatePromptReviewStatus();
    toast('프롬프트 확인 완료');
    return true;
  } finally {
    _kcPromptReviewOpening = false;
  }
}

async function kcGenerate(withPromptEdit = false) {
  if (typeof _logActivity === 'function') _logActivity('projects', 'generate', document.getElementById('kc-keyword')?.value || '');
  if (_kcGenerating) { toast('이미 생성 중입니다', 'error'); return; }
  if (_kcHistoryRestoreMode) { toast('히스토리에서 불러온 프로젝트는 여기서 전체 생성할 수 없습니다.', 'error'); return; }
  if (!window._globalProfileId) { toast('프로필을 먼저 선택하세요', 'error'); return; }
  const payload = kcBuildGeneratePayload();
  const promptSignature = kcEnsureFreshPromptReviewState(payload);
  const keyword = payload.keyword;
  if (!keyword) { _kcGenerating = false; toast('키워드가 없습니다', 'error'); return; }
  const selectedSources = payload.selectedSources;
  const allTexts = payload.allTexts;
  const collectedImages = payload.collectedImages;
  console.log(`[KC] 선택된 이미지: ${collectedImages.length}장`);

  if (allTexts.length === 0) {
    toast('참고할 소스가 없습니다. 소스를 선택하고 본문을 가져오세요.', 'error');
    return;
  }

  if (withPromptEdit) {
    const reviewedOverrides = await kcReviewPromptsBeforeGenerate(payload).catch(e => {
      toast('프롬프트 미리보기 실패: ' + e.message, 'error');
      return null;
    });
    if (!reviewedOverrides) return;
    _kcPromptOverrides = reviewedOverrides;
    _kcLastPromptReviewSignature = promptSignature;
    _kcPromptReviewed = true;
    kcUpdatePromptReviewStatus();
  } else if (!_kcPromptReviewed) {
    // 프롬프트 미검토 시 자동으로 기본값으로 진행
    console.log('[KC] 프롬프트 미검토 — 기본 프롬프트로 자동 진행');
    _kcPromptReviewed = true;
  }

  _kcGenerating = true;
  kcResetGeneratedContentOrder();
  lockScreen('콘텐츠 생성 중', _getContentLabel());

  const loading = document.getElementById('kc-gen-loading');
  const stepsContainer = document.getElementById('kc-gen-steps');
  kcSetGenerateButtonsLoading(true);
  loading.style.display = 'block';
  if (stepsContainer) stepsContainer.innerHTML = '';
  kcStartCodexLogPolling();
  window._kcBlogImages = [];
  window._kcBlogImagesDir = '';
  document.getElementById('kc-result-card').style.display = 'none';
  let _elapsedTimer = null;

  try {
    // 0. 프로젝트 먼저 생성 (고유 ID 발급)
    try {
      const projRes = await api('/api/projects', {
        method: 'POST',
        body: { name: keyword.substring(0, 50), keyword, profile_id: parseInt(window._globalProfileId || 0) },
      });
      _kcProjectId = projRes.id;
      console.log(`[KC] 프로젝트 생성: #${_kcProjectId}`);
    } catch { _kcProjectId = null; }

    // 1. 옵션 준비
    const _o = payload.opts;
    kcInitGenerationStageBoard(_o, collectedImages.length);
    kcGenStep('옵션 확인 중...', 'start', 'prepare');
    const genParts = [];
    if (_o.gen_blog) genParts.push('블로그');
    if (_o.gen_cardnews || _o.gen_detail_page) genParts.push('카드뉴스');
    if (_o.gen_comic) genParts.push('만화');
    if (_o.gen_sns) genParts.push('SNS');
    if (_o.gen_video_slide) genParts.push('영상');
    if (_o.gen_video_veo) genParts.push('AI영상');
    if (_o.gen_detail_page) genParts.push('상세페이지');
    console.log('[KC] 생성 옵션:', JSON.stringify({blog:_o.gen_blog,cardnews:_o.gen_cardnews,comic:_o.gen_comic,sns:_o.gen_sns,video_slide:_o.gen_video_slide,detail:_o.gen_detail_page}));
    kcGenStep(`옵션 확인 완료 — ${genParts.join(' + ')} 생성 예정`, 'done', 'prepare');

    // 2. 이미지 준비
    if (collectedImages.length > 0) {
      kcGenStep(`이미지 ${collectedImages.length}장 참조 준비`, 'start', 'reference');
      kcGenStep(`이미지 ${collectedImages.length}장 준비 완료`, 'done', 'reference');
    }

    // 3. 단계별 AI 생성 요청
    console.log('[KC] blog_image_count:', _o.blog_image_count);
    const _startTime = Date.now();
    _elapsedTimer = setInterval(() => {
      const sec = Math.round((Date.now() - _startTime) / 1000);
      const min = Math.floor(sec / 60);
      const s = sec % 60;
      const timeStr = min > 0 ? `${min}분 ${s}초` : `${s}초`;
      const titleEl = document.getElementById('kc-gen-title');
      if (titleEl) titleEl.textContent = `콘텐츠 생성 중... (${timeStr} 경과)`;
    }, 1000);
    const res = { blog: null, cardnews: null, video: null, sns: null };
    const shouldGenerateBlogDraft = !!(
      _o.gen_blog ||
      _o.gen_cardnews ||
      _o.gen_detail_page ||
      _o.gen_video_slide ||
      _o.gen_video_veo ||
      ((parseInt(_o.blog_image_count || 0, 10) > 0) || _o.gen_blog_images)
    );

    if (shouldGenerateBlogDraft) {
      kcGenStep('블로그 글 생성 중...', 'start', 'blog');
      const blogStage = await kcRequestGenerateStage(payload, {
        generate_blog: true,
        generate_cardnews: false,
        generate_sns: false,
        generate_video: false,
        blog_image_count: 0,
      });
      await kcRefreshCodexLogPanel();
      res.blog = blogStage.blog || null;
      kcApplyBlogStageResult(res.blog, keyword);
    }

    const shouldGenerateBlogImages = shouldGenerateBlogDraft && ((parseInt(_o.blog_image_count || 0, 10) > 0) || _o.gen_blog_images);
    if (shouldGenerateBlogImages) {
      const blogBodyForImages = kcCurrentBlogBody();
      if (blogBodyForImages) {
        kcGenStep('블로그 이미지를 생성하고 있습니다...', 'start', 'blog_images');
        try {
          const ok = await kcGenerateBlogImages();
          if (ok) kcGenStep(`블로그 이미지 ${window._kcBlogImages.length}장 생성 완료`, 'done', 'blog_images');
          else kcGenStep('블로그 이미지 생성 실패', 'fail', 'blog_images');
        } catch (e) {
          kcGenStep('블로그 이미지 실패: ' + (e?.message || '알 수 없는 오류'), 'fail', 'blog_images');
        }
      } else {
        kcGenStep('블로그 본문이 없어 블로그 이미지를 생성할 수 없습니다.', 'fail', 'blog_images');
      }
    }

    if (_o.gen_cardnews || _o.gen_detail_page) {
      const cardnewsSourceText = kcCurrentBlogBody();
      kcGenStep('카드뉴스 텍스트 생성 중...', 'start', 'cardnews_text');
      res.cardnews = await kcRequestCardnewsTextStage(payload, {
        generate_blog: false,
        generate_cardnews: true,
        generate_sns: false,
        generate_video: false,
        blog_image_count: 0,
        selected_sources: cardnewsSourceText ? [] : payload.body.selected_sources,
        scraped_texts: cardnewsSourceText ? [cardnewsSourceText] : payload.body.scraped_texts,
      });
      await kcRefreshCodexLogPanel();
      kcApplyCardnewsTextStageResult(res.cardnews);
    }

    if (_o.gen_sns) {
      const snsSourceText = kcCurrentBlogBody();
      kcGenStep('SNS 글 생성 중...', 'start', 'sns');
      const snsStage = await kcRequestGenerateStage(payload, {
        generate_blog: false,
        generate_cardnews: false,
        generate_sns: true,
        generate_video: false,
        blog_image_count: 0,
        selected_sources: snsSourceText ? [] : payload.body.selected_sources,
        scraped_texts: snsSourceText ? [snsSourceText] : payload.body.scraped_texts,
      });
      await kcRefreshCodexLogPanel();
      res.sns = snsStage.sns || null;
      kcApplySNSStageResult(res.sns);
    }

    if (_elapsedTimer) {
      clearInterval(_elapsedTimer);
      _elapsedTimer = null;
    }
    kcGenStep('초기 콘텐츠 생성 완료! 이미지와 후속 작업을 이어갑니다.', 'done');
    document.getElementById('kc-result-card').style.display = 'block';
    const gotoUpload = document.getElementById('kc-goto-upload');
    if (gotoUpload) gotoUpload.style.display = 'none';

    // 프로젝트 자동 저장됨 (UI 표시 없음)

    // Update content tabs state and show tab bar
    kcUpdateContentTabs();

    document.getElementById('kc-result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 추가 콘텐츠 자동 생성 (영상, 만화)
    if ((_o.gen_cardnews || _o.gen_detail_page) && res.cardnews && !res.cardnews.error) {
      const hasReadyCardnewsImages = Array.isArray(res.cardnews.slides) && res.cardnews.slides.some(s => !!s.image_path);
      if (hasReadyCardnewsImages) {
        kcGenStep('카드뉴스 이미지 완료', 'done', 'cardnews_image');
        if (!document.querySelector('#kc-cardnews-slides img')) {
          kcRenderCardnewsImages(res.cardnews);
        }
        kcLoadNarrationFromSlides();
      } else {
        kcGenStep('카드뉴스 이미지 생성 중...', 'start', 'cardnews_image');
        try {
          const ok = await kcGenerateCardnewsImages({ reviewPrompts: false });
          if (ok === false) kcGenStep('카드뉴스 이미지 취소', 'fail', 'cardnews_image');
          else {
            kcGenStep('카드뉴스 이미지 완료', 'done', 'cardnews_image');
            kcLoadNarrationFromSlides();
          }
        } catch(e) {
          kcGenStep('카드뉴스 이미지 실패: ' + (e?.message || '알 수 없는 오류'), 'fail', 'cardnews_image');
          toast('카드뉴스 이미지 생성 실패: ' + (e?.message || '알 수 없는 오류'), 'error');
        }
      }
    }

    // 블로그 생성 완료 후: 상세페이지+만화는 병렬, 영상은 카드뉴스 이미지 이후
    const _parallelTasks = [];

    if (_o.gen_detail_page && res.blog && !res.blog.error) {
      kcGenStep('상세페이지 이미지 생성 중...', 'start', 'detail');
      _parallelTasks.push(
        kcGenerateImageBlog().then(() => kcGenStep('상세페이지 이미지 완료', 'done', 'detail'))
          .catch(e => kcGenStep('상세페이지 이미지 실패: ' + e.message, 'fail', 'detail'))
      );
    }

    if (_o.gen_comic) {
      kcGenStep('스토리 만화 생성 중...', 'start', 'comic');
      _parallelTasks.push(
        kcGenerateComic().then(ok => { if (ok === false) kcGenStep('스토리 만화 취소', 'fail', 'comic'); else kcGenStep('스토리 만화 완료', 'done', 'comic'); })
          .catch(e => kcGenStep('스토리 만화 실패: ' + (e?.message || '알 수 없는 오류'), 'fail', 'comic'))
      );
    }

    // 상세페이지+만화 병렬 완료 대기
    if (_parallelTasks.length > 0) {
      console.log(`[KC] 병렬 작업 ${_parallelTasks.length}개 (상세페이지+만화) 실행 중...`);
      await Promise.allSettled(_parallelTasks);
    }

    // 영상은 카드뉴스 이미지가 준비된 후 실행 (슬라이드+AI 병렬 가능)
    const _videoTasks = [];

    if (_o.gen_video_slide) {
      kcGenStep('슬라이드 영상 생성 중...', 'start', 'video_slide');
      _videoTasks.push((async () => { try {
        const hasCardnewsImages = Array.isArray(window._cnCarouselUrls) && window._cnCarouselUrls.length > 0;
        if (!hasCardnewsImages) {
          throw new Error('카드뉴스 이미지가 아직 없어 슬라이드 영상을 만들 수 없습니다.');
        }
        const _narrations = kcGetNarrations();
        const _profileId = parseInt(window._globalProfileId || 0);
        const vidBody = {
          source: 'cardnews',
          method: 'slide',
          cardnews_id: _kcCnCardnewsId,
          project_dir: _kcCardnewsDir,
          voice: _o.voice,
          narrations: _narrations || undefined,
          bgm: _o.bgm || 'random',
          bgm_mode: _o.bgm_mode || 'random',
          profile_id: _profileId,
        };
        const vidRes = await api('/api/video/create', { method: 'POST', body: vidBody });
        if (vidRes.video_path) {
          kcRevealGeneratedContent('video');
          kcGenStep('슬라이드 영상 완료', 'done', 'video_slide');
          _kcVideoPathSlide = vidRes.video_path;
          const vidResult = document.getElementById('kc-video-result');
          vidResult.style.display = 'block';
          // 슬라이드 영상 플레이어
          const vidPath = vidRes.video_path.split('/videos/');
          const relPath = vidPath.length > 1 ? vidPath[1] : '';
          let slidePlayer = document.getElementById('kc-video-player-slide');
          if (!slidePlayer) {
            const label = document.createElement('div');
            label.style.cssText = 'font-weight:600;margin:8px 0 4px;';
            label.textContent = '슬라이드 영상';
            vidResult.appendChild(label);
            slidePlayer = document.createElement('video');
            slidePlayer.id = 'kc-video-player-slide';
            slidePlayer.controls = true;
            slidePlayer.style.cssText = 'width:100%;max-width:400px;border-radius:8px;margin-bottom:12px;';
            vidResult.appendChild(slidePlayer);
          }
          slidePlayer.src = `/api/video/file/${relPath}`;
          if (_kcProjectId) api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { video_path_slide: vidRes.video_path } }).catch(() => {});
        }
      } catch(e) { kcGenStep('슬라이드 영상 실패: ' + e.message, 'fail', 'video_slide'); } })());
    }

    if (_o.gen_video_veo) {
      kcGenStep('AI 영상 생성 중... 1~5분 소요', 'start', 'video_ai');
      _videoTasks.push((async () => { try {
        const hasCardnewsImages = Array.isArray(window._cnCarouselUrls) && window._cnCarouselUrls.length > 0;
        if (!hasCardnewsImages) {
          throw new Error('카드뉴스 이미지가 아직 없어 AI 영상을 만들 수 없습니다.');
        }
        const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value || '');
        const blogBody = (document.getElementById('kc-blog-body')?.value || '').trim();
        const prompt = blogBody || keyword || '한국 도시 풍경';
        const scenePlanText = (_kcPromptOverrides && (_kcPromptOverrides.video_scene_plan || _kcPromptOverrides.video_bundle?.scene_plan)) || '';
        const parsedScenePlan = kcParsePromptBundle(scenePlanText, []);
        const veoRes = await api('/api/video/create', { method: 'POST', body: {
          source: 'cardnews',
          method: 'veo3',
          topic: keyword,
          slides: _kcCnTexts || [],
          cardnews_id: _kcCnCardnewsId || undefined,
          project_dir: _kcCardnewsDir || '',
          source_text: prompt,
          script_override: prompt,
          scene_plan: parsedScenePlan,
          scene_count: parsedScenePlan.length || Math.min((_kcCnTexts || []).length || 3, 5),
          veo_model: _o.veo_model || 'veo-3.1-generate-preview',
          veo_duration: parseInt(_o.veo_duration || '8'),
          voice: _o.voice || 'gemini-Kore',
          subtitle_style: _o.subtitle || 'minimal',
          subtitle_font: _o.subtitle_font || 'nanum-square',
          narration_mode: _o.narration || 'on',
          camera_freedom: _o.camera || 'subtle',
          aspect_ratio: _o.video_ratio || '9:16',
          duration: _o.veo_duration || '8',
          bgm_mode: _o.bgm_mode || 'random',
          bgm_url: _o.bgm_url || '',
          skip_bgm: _o.skip_bgm || false,
          profile_id: parseInt(window._globalProfileId || 0),
        }});

        if (veoRes?.video_path) {
          kcRevealGeneratedContent('video');
          kcGenStep('AI 영상 완료', 'done', 'video_ai');
          _kcVideoPath = veoRes.video_path;
          const vp = veoRes.video_path.split('/videos/');
          const relPath = vp.length > 1 ? vp[1] : veoRes.video_path;
          const vidResult = document.getElementById('kc-video-result');
          vidResult.style.display = 'block';
          // AI 영상 플레이어
          let veoPlayer = document.getElementById('kc-video-player-veo');
          if (!veoPlayer) {
            const label = document.createElement('div');
            label.style.cssText = 'font-weight:600;margin:8px 0 4px;';
            label.textContent = 'AI 영상';
            vidResult.appendChild(label);
            veoPlayer = document.createElement('video');
            veoPlayer.id = 'kc-video-player-veo';
            veoPlayer.controls = true;
            veoPlayer.style.cssText = 'width:100%;max-width:400px;border-radius:8px;margin-bottom:12px;';
            vidResult.appendChild(veoPlayer);
          }
          veoPlayer.src = `/api/video/file/${relPath}`;
          // 기존 플레이어도 업데이트 (호환성)
          const legacyPlayer = document.getElementById('kc-video-player');
          if (legacyPlayer) legacyPlayer.src = `/api/video/file/${relPath}`;
          if (_kcProjectId) api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { video_path: veoRes.video_path } }).catch(() => {});
        } else {
          kcGenStep('AI 영상: ' + (veoRes?.message || '결과 없음'), 'fail', 'video_ai');
        }
      } catch(e) { kcGenStep('AI 영상 실패: ' + e.message, 'fail', 'video_ai'); } })());
    }

    // 영상 병렬 완료 대기
    if (_videoTasks.length > 0) {
      console.log(`[KC] 영상 ${_videoTasks.length}개 (카드뉴스 이미지 이후) 실행 중...`);
      await Promise.allSettled(_videoTasks);
    }

    // 탭 상태 다시 업데이트
    kcUpdateContentTabs();

    kcGenStep('모든 콘텐츠 생성이 완료되었습니다.', 'done', 'complete');
  } catch (e) {
    await kcRefreshCodexLogPanel();
    const state = document.getElementById('kc-codex-terminal-state');
    if (state) state.textContent = '실패';
    kcGenStep('콘텐츠 생성 실패', 'fail', 'complete');
    toast('콘텐츠 생성 실패: ' + e.message, 'error');
  } finally {
    if (_elapsedTimer) clearInterval(_elapsedTimer);
    await kcRefreshCodexLogPanel();
    kcStopCodexLogPolling();
    _kcGenerating = false;
    kcSetGenerateButtonsLoading(false);
    loading.style.display = 'none';
    _updateGenerateBtnLabel();
    unlockScreen();
  }
}

async function kcCheckPublishReady() {
  // 1. Chrome 연결 확인
  const connected = await ensureChromeConnected();
  if (!connected) {
    return false;
  }
  // 1-1. 네이버 로그인 확인 (글쓰기 페이지 가기 전에)
  try {
    const loginCheck = await api('/api/browser/eval', { method: 'POST', body: { code: '(() => document.cookie.includes("NID_AUT") || document.cookie.includes("NID_SES"))()' } });
  } catch {}
  // 2. 네이버 로그인 확인
  try {
    const loginCheck = await api('/api/naver/check-login');
    if (!loginCheck.logged_in) {
      toast('네이버에 로그인되어 있지 않습니다.\n\nChrome에서 naver.com에 로그인한 후 다시 시도해주세요.', 'error');
      return false;
    }
  } catch {
    // check-login API가 없으면 스킵
  }
  return true;
}

function kcOpenUnifiedUpload() {
  const title = document.getElementById('kc-blog-title')?.value?.trim() || '';
  const content = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const tagStr = document.getElementById('kc-blog-tags')?.value || '';
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];
  const pubImages = (_kcFinalImages || []).filter(x => x.selected).map(x => x.url);
  const blogGenImages = (window._kcBlogImages || []).map(x => x.url);
  const cnSlides = [];
  document.querySelectorAll('#kc-cardnews-slides img[src*="cardnews"]').forEach(img => cnSlides.push(img.src));
  const imgBlogSlides = (_kcImageBlogSlides || []);
  // 만화 이미지
  const comicImg = document.querySelector('#kc-panel-comic img[src*="comic"]')?.src || document.getElementById('kc-comic-image')?.src || document.querySelector('#kc-comic-result img')?.src || '';

  openUploadModal({
    title,
    content,
    tags,
    images: [...pubImages, ...blogGenImages],
    detailPageImages: imgBlogSlides,
    cardnewsImages: cnSlides,
    comicImage: comicImg,
    postId: _kcBlogPostId,
  });
}

async function kcPublishBlog() {
  const blogId = getBlogId();
  if (!blogId) {
    toast('상단에 네이버 블로그 주소를 먼저 입력하세요!', 'error');
    return;
  }
  // 발행 전 Chrome 연결 + 로그인 확인
  if (!await kcCheckPublishReady()) return;

  const title = document.getElementById('kc-blog-title').value.trim();
  const content = document.getElementById('kc-blog-body').value.trim();
  const tagStr = document.getElementById('kc-blog-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!title || !content) { toast('제목과 본문을 입력하세요', 'error'); return; }
  if (!confirm(`네이버 블로그(${blogId})에 발행할까요?\n\n제목: ${title}\n태그: ${tags.join(', ')}`)) return;

  // 3단계 이미지 선택 그리드에서 선택된 이미지 + 블로그 생성 이미지
  const pubImages = (_kcFinalImages || []).filter(x => x.selected).map(x => x.url);
  const blogGenImages = (window._kcBlogImages || []).map(x => x.url);
  const allPubImages = [...pubImages, ...blogGenImages];
  console.log(`[발행] 선택된 이미지 ${pubImages.length}장 + 블로그 이미지 ${blogGenImages.length}장`);

  try {
    const pubRes = await api('/api/blog/publish', {
      method: 'POST',
      body: {
        post_id: _kcBlogPostId, title, content, tags, images: allPubImages,
        header_images: kcGetSlotImages().header.map(x => x.url),
        footer_images: kcGetSlotImages().footer.map(x => x.url),
        profile_id: parseInt(window._globalProfileId || 0),
      },
    });
    const blogUrl = pubRes.url || `https://blog.naver.com/${blogId}`;
    toast(`네이버 블로그에 발행 완료!`);

    // 스레드/트위터 글에 블로그 링크 자동 삽입
    const threadsEl = document.getElementById('kc-sns-threads-text');
    const twitterEl = document.getElementById('kc-sns-twitter-text');
    if (threadsEl && threadsEl.value) {
      threadsEl.value = threadsEl.value.trim() + '\n\n' + blogUrl;
    }
    if (twitterEl && twitterEl.value) {
      twitterEl.value = twitterEl.value.trim() + '\n' + blogUrl;
    }
    // 인스타 캡션에도
    const igCaption = document.getElementById('kc-cn-ig-caption');
    if (igCaption && igCaption.value) {
      igCaption.value = igCaption.value.trim() + '\n\n' + blogUrl;
    }
    toast(`블로그 링크가 스레드/트위터/인스타에 추가되었습니다`);
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}
