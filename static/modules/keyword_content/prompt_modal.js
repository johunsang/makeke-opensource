// keyword_content/prompt_modal.js — 프롬프트 모달 UI/리뷰

function kcComposePromptWorkbenchTab(modal, tab, options = {}) {
  const force = !!options.force;
  const get = field => modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="${field}"]`)?.value?.trim() || '';
  if (tab === 'blog') {
    const customer = get('customer_context');
    const styleApplied = get('style_applied');
    const source = get('source_context');
    const rules = get('output_rules');
    const finalEl = modal.querySelector('[data-prompt-tab="blog"][data-prompt-stage="user_prompt"]');
    if (finalEl && (force || !finalEl.value.trim())) {
      finalEl.value = [
        customer ? `[브랜드/고객 맥락]\n${customer}` : '',
        styleApplied ? `[문체 반영]\n${styleApplied}` : '',
        source ? `[참고 자료]\n${source}` : '',
        rules ? `[출력 규칙]\n${rules}` : '',
        '위 내용을 바탕으로 네이버 블로그용 글을 작성하세요. 제목, 소제목, 본문 흐름, CTA를 자연스럽게 설계하세요.',
      ].filter(Boolean).join('\n\n');
    }
    return;
  }
  const customer = get('customer_context');
  const styleApplied = get('style_applied');
  const reference = get('reference_context') || get('content_context');
  const rules = get('output_rules') || get('character_rules');
  const system = get('system_prompt');
  if (tab === 'sns') {
    const threadsRules = get('threads_rules');
    const twitterRules = get('twitter_rules');
    const finalEl = modal.querySelector('[data-prompt-tab="sns"][data-prompt-stage="final_prompt"]');
    if (finalEl && (force || !finalEl.value.trim())) {
      finalEl.value = [
        system ? `[역할]\n${system}` : '',
        customer ? `[브랜드/고객 맥락]\n${customer}` : '',
        reference ? `[핵심 내용]\n${reference}` : '',
        styleApplied ? `[문체 반영]\n${styleApplied}` : '',
        threadsRules ? `[스레드 작성 규칙]\n${threadsRules}` : '',
        twitterRules ? `[트위터 작성 규칙]\n${twitterRules}` : '',
        '출력 형식은 반드시 JSON 객체로 하고 keys는 threads, twitter 입니다.',
      ].filter(Boolean).join('\n\n');
    }
    return;
  }
  const finalEl = modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="final_prompt"]`);
  if (finalEl && (force || !finalEl.value.trim())) {
    finalEl.value = [
      system ? `[역할]\n${system}` : '',
      customer ? `[브랜드/고객 맥락]\n${customer}` : '',
      reference ? `[입력 자료]\n${reference}` : '',
      styleApplied ? `[문체 반영]\n${styleApplied}` : '',
      rules ? `[출력 규칙]\n${rules}` : '',
    ].filter(Boolean).join('\n\n');
  }
}

function kcComposeVideoFinalPrompt(container, force = true) {
  const get = field => container.querySelector(`[data-prompt-tab="video"][data-prompt-stage="${field}"]`)?.value?.trim() || '';
  const finalEl = container.querySelector('[data-prompt-tab="video"][data-prompt-stage="final_prompt"]');
  if (finalEl && (force || !finalEl.value.trim())) {
    finalEl.value = [
      get('system_prompt') ? `[감독 역할]\n${get('system_prompt')}` : '',
      get('customer_context') ? `[브랜드/고객 맥락]\n${get('customer_context')}` : '',
      get('style_applied') ? `[문체 반영]\n${get('style_applied')}` : '',
      get('subject') ? `주제: ${get('subject')}` : '',
      get('scene') ? `장면 설명: ${get('scene')}` : '',
      get('visual_style') ? `비주얼 스타일: ${get('visual_style')}` : '',
      get('camera') ? `카메라: ${get('camera')}` : '',
      get('mood') ? `분위기: ${get('mood')}` : '',
      get('duration') ? `출력 조건: ${get('duration')}` : '',
      get('negative') ? `금지 요소: ${get('negative')}` : '',
      get('scene_plan') ? `[장면별 실행안]\n${get('scene_plan')}` : '',
    ].filter(Boolean).join('\n');
  }
}

function kcRecomposeAllPromptTabs(modal, force = false) {
  if (!modal) return;
  ['blog', 'cardnews', 'sns', 'comic'].forEach(tab => {
    if (modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage]`)) {
      kcComposePromptWorkbenchTab(modal, tab, { force });
    }
  });
  if (modal.querySelector('[data-prompt-tab="video"][data-prompt-stage]')) {
    kcComposeVideoFinalPrompt(modal, force);
  }
}

function kcPromptTabGuide(title, desc) {
  return `
    <div style="padding:14px 18px;border-radius:14px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);margin-bottom:14px;">
      <div style="font-size:15px;font-weight:700;color:#1c1c1e;">${title}</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;">${desc}</div>
    </div>
  `;
}

function kcRenderStyleAppliedCard(tab, value) {
  if (!String(value || '').trim()) return '';
  return `
    <div style="grid-column:1 / -1;">
      ${kcPromptStageWrap(
        kcPromptStageCard(
          tab,
          'style_applied',
          '문체 반영',
          '현재 프로필의 내 스타일이 실제로 어떤 기준으로 최종 프롬프트에 반영되는지 보여줍니다.',
          value,
          8,
          'readonly'
        ),
        'basic'
      )}
    </div>
  `;
}

function kcRenderPromptWorkbenchTab(tab, workbench) {
  if (tab === 'blog') {
    return `<div>${kcPromptStageCard('blog', 'user_prompt', '블로그 프롬프트', '', workbench.user_prompt || '', 14)}</div>`;
  }
  if (tab === 'cardnews') {
    return `<div>${kcPromptStageCard('cardnews', 'final_prompt', '카드뉴스 프롬프트', '', workbench.final_prompt || '', 14)}</div>`;
  }
  if (tab === 'sns') {
    return `<div>${kcPromptStageCard('sns', 'final_prompt', 'SNS 프롬프트', '', workbench.final_prompt || '', 14)}</div>`;
  }
  if (tab === 'video') {
    return `<div>${kcPromptStageCard('video', 'final_prompt', '영상 프롬프트', '', workbench.final_prompt || '', 14)}</div>`;
  }
  if (tab === 'comic') {
    return `<div>${kcPromptStageCard('comic', 'final_prompt', '만화 프롬프트', '', workbench.final_prompt || '', 14)}</div>`;
  }
  if (tab === 'blog_image') {
    return `<div>${kcPromptStageCard('blog_image', 'prompt_template', '블로그 이미지 프롬프트', '', workbench.prompt_template || '', 14)}</div>`;
  }
  if (tab === 'detail_page') {
    return `<div>${kcPromptStageCard('detail_page', 'section_template', '상세페이지 프롬프트', '', workbench.section_template || '', 14)}</div>
    `;
  }
  return '<div style="padding:20px;color:rgba(0,0,0,0.3);text-align:center;">프롬프트 데이터 없음</div>';
}

async function kcLoadPromptWorkbenchStore(profileId) {
  if (!profileId) return { presets: [], default_preset_id: '', last_used_preset_id: '', last_draft: {} };
  try {
    return await api(`/api/library/profiles/${profileId}/prompt-workbench`);
  } catch {
    return { presets: [], default_preset_id: '', last_used_preset_id: '', last_draft: {} };
  }
}

async function kcSavePromptWorkbenchStore(profileId, data) {
  if (!profileId) return null;
  return api(`/api/library/profiles/${profileId}/prompt-workbench`, { method: 'PUT', body: data });
}

function kcRenderPromptPresetOptions(store) {
  const presets = store?.presets || [];
  return `<option value="">프롬프트 프리셋 선택</option>` + presets.map(p => (
    `<option value="${escapeHtml(p.id || '')}">${escapeHtml(p.name || '이름 없는 프리셋')}${store?.default_preset_id === p.id ? ' · 기본' : ''}</option>`
  )).join('');
}

function kcCollectFixedPromptTemplate(modal) {
  const fixed_templates = {};
  Object.entries(KC_FIXED_PROMPT_FIELDS).forEach(([tab, fields]) => {
    const block = {};
    fields.forEach(field => {
      const el = modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="${field}"]`);
      if (el) block[field] = el.value || '';
    });
    if (Object.keys(block).length) fixed_templates[tab] = block;
  });
  return fixed_templates;
}

function kcApplyFixedPromptTemplateToModal(modal, fixedTemplates = {}) {
  Object.entries(fixedTemplates || {}).forEach(([tab, block]) => {
    Object.entries(block || {}).forEach(([field, value]) => {
      const el = modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="${field}"]`);
      if (el && value !== undefined) el.value = value || '';
    });
  });
}

function kcCollectPromptModalData(modal) {
  kcRecomposeAllPromptTabs(modal);
  const initial = modal?._kcInitialWorkbench || {};
  const next = {};
  const blog = { ...(initial.blog || {}) };
  ['system_prompt', 'customer_context', 'source_context', 'output_rules', 'style_applied', 'user_prompt'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="blog"][data-prompt-stage="${field}"]`);
    if (el) blog[field] = el.value || '';
  });
  if (Object.keys(blog).length) {
    // style_applied를 system_prompt에 합쳐서 전달 (서버는 system_prompt + user_prompt만 사용)
    let blogSys = blog.system_prompt || '';
    if (blog.style_applied && blog.style_applied.trim()) {
      blogSys += `\n\n## 내 문체 스타일 (반드시 이 스타일로 작성하세요)\n${blog.style_applied}`;
    }
    next.blog = { system_prompt: blogSys, user_prompt: blog.user_prompt || '' };
    next.blog_workbench = blog;
  }

  const cardnews = { ...(initial.cardnews || {}) };
  ['system_prompt', 'customer_context', 'reference_context', 'output_rules', 'image_prompt_template', 'slides_bundle', 'final_prompt'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="cardnews"][data-prompt-stage="${field}"]`);
    if (el) cardnews[field] = el.value || '';
  });
  if (Object.keys(cardnews).length) {
    next.cardnews_text_prompt = cardnews.final_prompt || '';
    next.cardnews_slides = kcParsePromptBundle(cardnews.slides_bundle, kcBuildCardnewsSlideDrafts(cardnews));
    next.cardnews_workbench = cardnews;
  }

  const sns = { ...(initial.sns || {}) };
  ['system_prompt', 'customer_context', 'content_context', 'style_applied', 'threads_rules', 'twitter_rules', 'final_prompt'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="sns"][data-prompt-stage="${field}"]`);
    if (el) sns[field] = el.value || '';
  });
  if (Object.keys(sns).length) {
    // style_applied를 final_prompt에 합쳐서 전달
    let snsFinal = sns.final_prompt || '';
    if (sns.style_applied && sns.style_applied.trim() && !snsFinal.includes('문체 스타일')) {
      snsFinal = `[내 문체 스타일 — 반드시 이 스타일로 작성하세요]\n${sns.style_applied}\n\n${snsFinal}`;
    }
    next.sns_prompt = snsFinal;
    next.sns_workbench = sns;
  }

  const comic = { ...(initial.comic || {}) };
  ['system_prompt', 'reference_context', 'character_rules', 'style_applied', 'panel_bundle', 'final_prompt'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="comic"][data-prompt-stage="${field}"]`);
    if (el) comic[field] = el.value || '';
  });
  if (Object.keys(comic).length) {
    let comicFinal = comic.final_prompt || '';
    if (comic.style_applied && comic.style_applied.trim() && !comicFinal.includes('문체 스타일')) {
      comicFinal = `[내 문체 스타일]\n${comic.style_applied}\n\n${comicFinal}`;
    }
    next.comic_script_prompt = comicFinal;
    next.comic_panels = kcParsePromptBundle(comic.panel_bundle, kcBuildComicPanelDrafts(comic));
    next.comic_workbench = comic;
  }

  const video = { ...(initial.video || {}) };
  ['system_prompt', 'customer_context', 'subject', 'scene', 'visual_style', 'camera', 'mood', 'duration', 'negative', 'scene_plan', 'final_prompt'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="video"][data-prompt-stage="${field}"]`);
    if (el) video[field] = el.value || '';
  });
  if (Object.keys(video).length) {
    next.video_workbench = video;
    next.video_bundle = {
      subject: video.subject || '',
      scene: video.scene || '',
      visual_style: video.visual_style || '',
      camera: video.camera || '',
      mood: video.mood || '',
      duration: video.duration || '',
      negative: video.negative || '',
      scene_plan: video.scene_plan || '',
      final_prompt: video.final_prompt || '',
    };
    next.video_scene_plan = video.scene_plan || '';
    next.video_prompt = video.final_prompt || '';
  }

  // 블로그 이미지 디자인 규칙
  const blogImageWorkbench = { ...(initial.blog_image || {}) };
  ['source_context', 'design_rules', 'prompt_template', 'prompt_bundle'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="blog_image"][data-prompt-stage="${field}"]`);
    if (el) blogImageWorkbench[field] = el.value || '';
  });
  if (Object.keys(blogImageWorkbench).length) {
    next.blog_image_design_rules = blogImageWorkbench.design_rules || '';
    next.blog_image_prompts = kcParsePromptBundle(blogImageWorkbench.prompt_bundle, kcBuildBlogImagePromptBundle(blogImageWorkbench))
      .map(item => String(item?.visual_prompt || item?.prompt || '').trim())
      .filter(Boolean);
    next.blog_image_workbench = blogImageWorkbench;
  }

  // 상세페이지 디자인 규칙
  const detailWorkbench = { ...(initial.detail_page || {}) };
  ['source_context', 'section_template', 'prompt_bundle'].forEach(field => {
    const el = modal.querySelector(`[data-prompt-tab="detail_page"][data-prompt-stage="${field}"]`);
    if (el) detailWorkbench[field] = el.value || '';
  });
  if (Object.keys(detailWorkbench).length) {
    next.detail_page_section_template = detailWorkbench.section_template || '';
    next.detail_page_slides = kcParsePromptBundle(detailWorkbench.prompt_bundle, kcBuildDetailPromptDrafts(detailWorkbench));
    next.detail_page_workbench = detailWorkbench;
  }

  return next;
}

function kcPromptModalHasGeneratingSources(modal) {
  if (!modal) return false;
  const sourceFields = [
    ['blog', 'source_context'],
    ['cardnews', 'reference_context'],
    ['sns', 'content_context'],
    ['comic', 'reference_context'],
  ];
  return sourceFields.some(([tab, field]) => {
    const el = modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="${field}"]`);
    return el && kcIsGeneratingSourcePlaceholder(el.value || '');
  });
}

function kcWorkbenchHasGeneratingSources(workbench) {
  const sourceValues = [
    workbench?.blog?.source_context,
    workbench?.cardnews?.reference_context,
    workbench?.sns?.content_context,
    workbench?.comic?.reference_context,
  ];
  return sourceValues.some(value => kcIsGeneratingSourcePlaceholder(value || ''));
}

function kcEnsurePromptModalReady(modal) {
  if (kcPromptModalHasGeneratingSources(modal)) {
    toast('핵심 자료 생성중에는 저장하거나 생성할 수 없습니다. 잠시 후 다시 시도하세요.', 'error');
    return false;
  }
  const missing = kcGetPromptModalMissingFields(modal);
  if (!missing.length) return true;
  const first = missing[0];
  if (first?.tab) kcSwitchPromptTab(first.tab);
  toast(`${first?.tabLabel || '프롬프트'}에서 ${first?.fieldLabel || '필수 항목'}을 먼저 완성하세요.`, 'error');
  return false;
}

function kcUpdatePromptModalActionState(modal) {
  if (!modal) return;
  const generatingBlocked = kcPromptModalHasGeneratingSources(modal);
  const missing = kcGetPromptModalMissingFields(modal);
  const incompleteBlocked = missing.length > 0;
  const blocked = generatingBlocked || incompleteBlocked;
  ['#kc-prompt-save-draft', '#kc-prompt-save-preset', '#kc-prompt-set-default', '#kc-prompt-preview-save'].forEach(selector => {
    const btn = modal.querySelector(selector);
    if (!btn) return;
    btn.disabled = blocked;
    btn.style.opacity = blocked ? '0.45' : '1';
    btn.style.cursor = blocked ? 'not-allowed' : 'pointer';
  });

  let notice = modal.querySelector('#kc-prompt-generating-notice');
  if (blocked) {
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'kc-prompt-generating-notice';
      notice.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(255,149,0,0.08);border:1px solid rgba(255,149,0,0.16);font-size:12px;font-weight:700;color:#ff8c00;';
      const header = modal.querySelector('#kc-prompt-toolbar');
      if (header && header.parentNode) header.parentNode.appendChild(notice);
    }
    if (generatingBlocked) {
      notice.textContent = '핵심 자료 생성중에는 저장, 프리셋 저장, 생성 버튼을 사용할 수 없습니다.';
    } else {
      const first = missing[0];
      notice.textContent = `${first?.tabLabel || '프롬프트'}에서 ${first?.fieldLabel || '필수 항목'}을 먼저 완성해야 생성할 수 있습니다.`;
    }
  } else if (notice) {
    notice.remove();
  }
}

function kcGetPromptModalMissingFields(modal) {
  if (!modal) return [];
  const rules = [
    { tab: 'blog', tabLabel: '블로그', field: 'source_context', fieldLabel: '핵심 자료' },
    { tab: 'blog', tabLabel: '블로그', field: 'user_prompt', fieldLabel: '최종 생성 프롬프트' },
    { tab: 'cardnews', tabLabel: '카드뉴스', field: 'reference_context', fieldLabel: '핵심 자료' },
    { tab: 'cardnews', tabLabel: '카드뉴스', field: 'slides_bundle', fieldLabel: '장별 스크립트 묶음' },
    { tab: 'cardnews', tabLabel: '카드뉴스', field: 'image_prompt_template', fieldLabel: '이미지 프롬프트 템플릿' },
    { tab: 'sns', tabLabel: 'SNS', field: 'content_context', fieldLabel: '핵심 자료' },
    { tab: 'sns', tabLabel: 'SNS', field: 'threads_rules', fieldLabel: '스레드 규칙' },
    { tab: 'sns', tabLabel: 'SNS', field: 'twitter_rules', fieldLabel: '트위터 규칙' },
    { tab: 'video', tabLabel: 'AI영상', field: 'visual_style', fieldLabel: '비주얼 스타일' },
    { tab: 'comic', tabLabel: '만화', field: 'character_rules', fieldLabel: '캐릭터/연출 규칙' },
    { tab: 'blog_image', tabLabel: '블로그 이미지', field: 'design_rules', fieldLabel: '디자인 규칙' },
  ];
  return rules.filter(rule => {
    const el = modal.querySelector(`[data-prompt-tab="${rule.tab}"][data-prompt-stage="${rule.field}"]`);
    if (!el) return false;
    const value = String(el.value || '').trim();
    return !value || kcIsGeneratingSourcePlaceholder(value);
  });
}

function kcApplyCollectedPromptsToModal(modal, data = {}) {
  const mappings = [
    ['blog_workbench', 'blog', ['system_prompt', 'customer_context', 'source_context', 'output_rules', 'user_prompt']],
    ['cardnews_workbench', 'cardnews', ['system_prompt', 'customer_context', 'reference_context', 'output_rules', 'image_prompt_template', 'slides_bundle', 'final_prompt']],
    ['sns_workbench', 'sns', ['system_prompt', 'customer_context', 'content_context', 'threads_rules', 'twitter_rules', 'final_prompt']],
    ['comic_workbench', 'comic', ['system_prompt', 'reference_context', 'character_rules', 'panel_bundle', 'final_prompt']],
    ['video_workbench', 'video', ['system_prompt', 'customer_context', 'subject', 'scene', 'visual_style', 'camera', 'mood', 'duration', 'negative', 'scene_plan', 'final_prompt']],
    ['blog_image_workbench', 'blog_image', ['source_context', 'design_rules', 'prompt_template', 'prompt_bundle']],
    ['detail_page_workbench', 'detail_page', ['source_context', 'section_template', 'prompt_bundle']],
  ];
  mappings.forEach(([key, tab, fields]) => {
    const block = data[key];
    if (!block) return;
    fields.forEach(field => {
      const el = modal.querySelector(`[data-prompt-tab="${tab}"][data-prompt-stage="${field}"]`);
      if (el && block[field] !== undefined) el.value = block[field] || '';
    });
  });
  if (data.blog?.system_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="blog"][data-prompt-stage="system_prompt"]');
    if (el) el.value = data.blog.system_prompt || el.value;
  }
  if (data.blog?.user_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="blog"][data-prompt-stage="user_prompt"]');
    if (el) el.value = data.blog.user_prompt || el.value;
  }
  if (data.cardnews_text_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="cardnews"][data-prompt-stage="final_prompt"]');
    if (el) el.value = data.cardnews_text_prompt || el.value;
  }
  if (data.sns_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="sns"][data-prompt-stage="final_prompt"]');
    if (el) el.value = data.sns_prompt || el.value;
  }
  if (data.comic_script_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="comic"][data-prompt-stage="final_prompt"]');
    if (el) el.value = data.comic_script_prompt || el.value;
  }
  if (data.video_bundle) {
    Object.entries(data.video_bundle).forEach(([field, value]) => {
      const el = modal.querySelector(`[data-prompt-tab="video"][data-prompt-stage="${field}"]`);
      if (el && value !== undefined) el.value = value || '';
    });
  }
  if (data.video_prompt !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="video"][data-prompt-stage="final_prompt"]');
    if (el) el.value = data.video_prompt || el.value;
  }
  if (data.detail_page_workbench?.source_context !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="detail_page"][data-prompt-stage="source_context"]');
    if (el) el.value = data.detail_page_workbench.source_context || el.value;
  }
  if (data.detail_page_section_template !== undefined) {
    const el = modal.querySelector('[data-prompt-tab="detail_page"][data-prompt-stage="section_template"]');
    if (el) {
      const legacyRules = data.detail_page_design_rules || data.detail_page_workbench?.design_rules || data.detail_page?.design_rules || '';
      el.value = kcNormalizeDetailSectionTemplate(data.detail_page_section_template || el.value, legacyRules);
    }
  }
  kcRefreshDerivedPromptPreviews();
  kcUpdatePromptModalActionState(modal);
}

async function kcRefinePromptModal(target = 'all') {
  const modal = kcGetPromptWorkbenchContainer();
  if (!modal) return;
  const btn = target === 'all' ? modal.querySelector('#kc-prompt-refine-all') : modal.querySelector(`#kc-prompt-refine-${target}`);
  if (btn) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'AI 고도화 중...';
  }
  try {
    const current = kcCollectPromptModalData(modal);
    const prompts = {};
    if (current.blog_workbench) prompts.blog = current.blog_workbench;
    if (current.cardnews_workbench) prompts.cardnews = current.cardnews_workbench;
    if (current.sns_workbench) prompts.sns = current.sns_workbench;
    if (current.video_workbench) prompts.video = current.video_workbench;
    if (current.comic_workbench) prompts.comic = current.comic_workbench;
    const res = await api('/api/content/refine-prompts', {
      method: 'POST',
      body: {
        target,
        keyword: document.getElementById('kc-keyword')?.value?.trim() || '',
        brand_name: document.getElementById('kc-brand-name')?.value?.trim() || '',
        business_goal: document.getElementById('kc-business-goal')?.value?.trim() || '',
        prompts,
        refine_settings: current.refine_settings || kcGetDefaultRefineSettings(),
      },
    });
    const refined = res.prompts || {};
    const mapped = {};
    if (refined.blog) mapped.blog_workbench = refined.blog;
    if (refined.cardnews) mapped.cardnews_workbench = refined.cardnews;
    if (refined.sns) mapped.sns_workbench = refined.sns;
    if (refined.video) mapped.video_workbench = refined.video;
    if (refined.comic) mapped.comic_workbench = refined.comic;
    kcApplyCollectedPromptsToModal(modal, mapped);
    if (modal.querySelector('#kc-prompt-lock-after-refine')?.checked) {
      kcSetPromptFieldsLocked(modal, target, true);
    }
    toast(target === 'all' ? '프롬프트 전체를 AI로 고도화했습니다.' : '현재 탭 프롬프트를 AI로 고도화했습니다.');
  } catch (e) {
    toast('프롬프트 고도화 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'AI로 고도화';
    }
  }
}

async function kcSavePromptDraft(modal, silent = false) {
  if (!kcEnsurePromptModalReady(modal)) return;
  const profileId = parseInt(window._globalProfileId || 0, 10);
  if (!profileId) return;
  const store = modal._kcPromptStore || await kcLoadPromptWorkbenchStore(profileId);
  const next = {
    ...store,
    fixed_templates: kcCollectFixedPromptTemplate(modal),
    last_draft: kcCollectPromptModalData(modal),
    last_used_preset_id: store.last_used_preset_id || '',
  };
  const saved = await kcSavePromptWorkbenchStore(profileId, next);
  modal._kcPromptStore = saved || next;
  if (!silent) toast('현재 프롬프트 초안을 프로필 DB에 저장했습니다.');
}

async function kcSavePromptPreset(modal) {
  if (!kcEnsurePromptModalReady(modal)) return;
  const profileId = parseInt(window._globalProfileId || 0, 10);
  if (!profileId) { toast('프로필을 먼저 선택하세요.', 'error'); return; }
  const store = modal._kcPromptStore || await kcLoadPromptWorkbenchStore(profileId);
  const name = prompt('저장할 프롬프트 프리셋 이름을 입력하세요.');
  if (!name) return;
  const presets = [...(store.presets || [])];
  const now = new Date().toISOString();
  const preset = {
    id: `preset_${Date.now()}`,
    name,
    description: '생성 전 프롬프트 편집',
    updated_at: now,
    prompts: kcCollectPromptModalData(modal),
  };
  presets.unshift(preset);
  const saved = await kcSavePromptWorkbenchStore(profileId, {
    ...store,
    presets,
    last_used_preset_id: preset.id,
    last_draft: preset.prompts,
  });
  modal._kcPromptStore = saved;
  const select = modal.querySelector('#kc-prompt-preset-select');
  if (select) {
    select.innerHTML = kcRenderPromptPresetOptions(saved);
    select.value = preset.id;
  }
  toast('프롬프트 프리셋을 프로필 DB에 저장했습니다.');
}

async function kcLoadPromptPresetIntoModal(modal, presetId) {
  const store = modal._kcPromptStore || {};
  const preset = (store.presets || []).find(p => p.id === presetId);
  if (!preset) return;
  kcApplyCollectedPromptsToModal(modal, preset.prompts || {});
  const profileId = parseInt(window._globalProfileId || 0, 10);
  if (profileId) {
    modal._kcPromptStore = await kcSavePromptWorkbenchStore(profileId, { ...store, last_used_preset_id: presetId, last_draft: preset.prompts || {} });
  }
  toast(`"${preset.name}" 프리셋을 불러왔습니다.`);
}

async function kcSetPromptPresetAsDefault(modal) {
  if (!kcEnsurePromptModalReady(modal)) return;
  const select = modal.querySelector('#kc-prompt-preset-select');
  const presetId = select?.value || '';
  if (!presetId) { toast('기본으로 지정할 프리셋을 먼저 선택하세요.', 'error'); return; }
  const profileId = parseInt(window._globalProfileId || 0, 10);
  if (!profileId) return;
  const store = modal._kcPromptStore || await kcLoadPromptWorkbenchStore(profileId);
  modal._kcPromptStore = await kcSavePromptWorkbenchStore(profileId, { ...store, default_preset_id: presetId });
  if (select) select.innerHTML = kcRenderPromptPresetOptions(modal._kcPromptStore);
  toast('선택한 프롬프트 프리셋을 기본값으로 저장했습니다.');
}

function kcRenderPromptWorkbenchFrame(workbench, options = {}) {
  const inline = !!options.inline;
  return new Promise(resolve => {
    kcCloseOverlappingPromptModals('kc-prompt-preview-modal');
    const existing = kcGetPromptWorkbenchContainer();
    if (existing) existing.remove();

    const tabs = [];
    const panels = [];
    if (workbench.blog) {
      tabs.push({ id: 'blog', label: '블로그' });
      panels.push(kcRenderPromptTabPanel('blog', kcRenderPromptWorkbenchTab('blog', workbench.blog), tabs.length === 1));
    }
    if (workbench.cardnews) {
      tabs.push({ id: 'cardnews', label: '카드뉴스' });
      panels.push(kcRenderPromptTabPanel('cardnews', kcRenderPromptWorkbenchTab('cardnews', workbench.cardnews), tabs.length === 1));
    }
    if (workbench.sns) {
      tabs.push({ id: 'sns', label: 'SNS' });
      panels.push(kcRenderPromptTabPanel('sns', kcRenderPromptWorkbenchTab('sns', workbench.sns), tabs.length === 1));
    }
    if (workbench.video) {
      tabs.push({ id: 'video', label: 'AI영상' });
      panels.push(kcRenderPromptTabPanel('video', kcRenderPromptWorkbenchTab('video', workbench.video), tabs.length === 1));
    }
    if (workbench.comic) {
      tabs.push({ id: 'comic', label: '만화' });
      panels.push(kcRenderPromptTabPanel('comic', kcRenderPromptWorkbenchTab('comic', workbench.comic), tabs.length === 1));
    }
    if (workbench.blog_image) {
      tabs.push({ id: 'blog_image', label: '블로그 이미지' });
      panels.push(kcRenderPromptTabPanel('blog_image', kcRenderPromptWorkbenchTab('blog_image', workbench.blog_image), tabs.length === 1));
    }
    if (workbench.detail_page) {
      tabs.push({ id: 'detail_page', label: '상세페이지' });
      panels.push(kcRenderPromptTabPanel('detail_page', kcRenderPromptWorkbenchTab('detail_page', workbench.detail_page), tabs.length === 1));
    }
    if (tabs.length === 0) {
      toast('수정할 프롬프트가 없습니다.', 'error');
      resolve(null);
      return;
    }
    const waitingForSourceSummary = kcWorkbenchHasGeneratingSources(workbench);
    const loadingOnlyBody = `
      <div style="padding:26px 24px 10px;">
        <div style="border:1px solid rgba(255,140,0,0.16);border-radius:20px;background:linear-gradient(180deg,rgba(255,248,242,0.98),rgba(255,255,255,0.98));padding:34px 28px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;min-height:320px;">
          <span class="spinner" style="width:32px;height:32px;border-width:3px;"></span>
          <div style="font-size:18px;font-weight:800;color:#1c1c1e;">핵심 자료 정리 중입니다</div>
          <div style="font-size:13px;line-height:1.7;color:rgba(0,0,0,0.52);max-width:540px;">
            잠시만 기다려주세요.
          </div>
          <div style="margin-top:4px;padding:10px 14px;border-radius:999px;background:rgba(255,140,0,0.10);border:1px solid rgba(255,140,0,0.16);font-size:12px;font-weight:700;color:#ff8c00;">
            핵심 자료 준비 중
          </div>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.id = inline ? 'kc-prompt-preview-panel' : 'kc-prompt-preview-modal';
    modal._kcInitialWorkbench = workbench;
    modal.style.cssText = inline
      ? 'border:1px solid rgba(255,140,0,0.16);background:linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,248,242,0.96));border-radius:22px;box-shadow:0 18px 42px rgba(255,140,0,0.10);overflow:hidden;'
      : 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;isolation:isolate;';
    modal.innerHTML = `
      <div style="${inline ? 'width:100%;' : 'width:min(1440px, calc(100vw - 24px));max-height:calc(100vh - 24px);'}background:#fff;border-radius:${inline ? '22px' : '26px'};${inline ? '' : 'box-shadow:0 25px 80px rgba(0,0,0,0.22);'}display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg, rgba(255,140,0,0.08), rgba(255,255,255,0));">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:20px;font-weight:800;color:#1c1c1e;">${inline ? '3단계 프롬프트 편집' : '생성 전 프롬프트 편집'}</div>
              <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-top:4px;">${inline ? '이 화면 안에서 프롬프트를 바로 확인하고 수정한 뒤 검토 완료까지 진행합니다.' : '프롬프트를 확인하고 바로 수정할 수 있습니다.'}</div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-shrink:0;">
              ${waitingForSourceSummary ? '' : `<button type="button" id="kc-prompt-preview-save" style="padding:12px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(255,140,0,0.3);animation:pulseBtn 2s ease-in-out infinite;">${inline ? '검토 완료 → 생성하기' : '이 프롬프트로 생성'}</button>`}
              <button type="button" id="kc-prompt-preview-close" style="padding:${inline ? '10px 14px' : '0'};width:${inline ? 'auto' : '34px'};height:${inline ? 'auto' : '34px'};border:none;border-radius:${inline ? '999px' : '50%'};background:rgba(0,0,0,0.06);font-size:${inline ? '12px' : '18px'};font-weight:${inline ? '700' : '400'};cursor:pointer;color:rgba(0,0,0,0.45);">${inline ? '취소' : '×'}</button>
            </div>
          </div>
          <div id="kc-prompt-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.44);">${waitingForSourceSummary ? '핵심 자료 정리가 끝나면 전체 프롬프트 편집 화면이 자동으로 이어집니다.' : '프롬프트는 이 화면에서 바로 확인하고 수정한 뒤 생성에만 사용됩니다.'}</div>
          </div>
          <div style="display:${waitingForSourceSummary ? 'none' : 'flex'};flex-wrap:wrap;gap:8px;margin-top:14px;">
            ${tabs.map((tab, idx) => `<button type="button" data-prompt-tab-button="${tab.id}" data-active="${idx===0 ? 'true' : 'false'}" onclick="kcSwitchPromptTab('${tab.id}')" style="padding:9px 14px;border:none;border-radius:999px;background:${idx===0 ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.05)'};color:${idx===0 ? '#fff' : 'rgba(0,0,0,0.55)'};font-size:12px;font-weight:700;cursor:pointer;">${tab.label}</button>`).join('')}
          </div>
        </div>
        <div style="padding:20px 24px;overflow:auto;background:linear-gradient(180deg,#fff,#fff8f2);">
          ${waitingForSourceSummary ? loadingOnlyBody : panels.join('')}
        </div>
        ${waitingForSourceSummary ? '' : ''}
      </div>
    `;

    const close = value => {
      if (inline) kcClearPromptInlineRoot();
      else modal.remove();
      resolve(value);
    };

    modal.querySelector('#kc-prompt-preview-close')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-prompt-preview-cancel')?.addEventListener('click', () => close(null));
    modal.querySelectorAll('[data-prompt-complexity-button]').forEach(btn => {
      btn.addEventListener('click', () => kcApplyPromptComplexity(modal, btn.getAttribute('data-prompt-complexity-button') || 'simple'));
    });
    modal.querySelector('#kc-prompt-compose-blog')?.addEventListener('click', () => kcComposePromptWorkbenchTab(modal, 'blog'));
    modal.querySelector('#kc-prompt-compose-cardnews')?.addEventListener('click', () => kcComposePromptWorkbenchTab(modal, 'cardnews'));
    modal.querySelector('#kc-prompt-compose-sns')?.addEventListener('click', () => kcComposePromptWorkbenchTab(modal, 'sns'));
    modal.querySelector('#kc-prompt-compose-comic')?.addEventListener('click', () => kcComposePromptWorkbenchTab(modal, 'comic'));
    modal.querySelector('#kc-video-prompt-regenerate')?.addEventListener('click', () => kcComposeVideoFinalPrompt(modal));
    modal.querySelector('#kc-prompt-preview-save')?.addEventListener('click', async () => {
      if (!kcEnsurePromptModalReady(modal)) return;
      kcRecomposeAllPromptTabs(modal);
      const data = kcCollectPromptModalData(modal);
      if (inline) {
        resolve(data);
        // 검토 완료 후 바로 4단계(생성)로 이동
        setTimeout(() => {
          if (typeof kcGoToStep === 'function') kcGoToStep(4);
          // 생성 버튼이 보이는 위치로 스크롤
          const genBtn = document.getElementById('kc-generate-btn');
          if (genBtn) genBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      } else {
        close(data);
      }
    });
    if (inline) {
      const root = kcGetPromptInlineRoot();
      if (!root) {
        toast('프롬프트 편집 영역을 찾을 수 없습니다.', 'error');
        resolve(null);
        return;
      }
      root.innerHTML = '';
      root.appendChild(modal);
      root.style.display = 'block';
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      modal.addEventListener('click', e => { if (e.target === modal) close(null); });
      document.body.appendChild(modal);
      kcBringModalToFront(modal);
    }
    kcApplyPromptComplexity(modal, 'simple');
    kcRefreshDerivedPromptPreviews();
    kcUpdatePromptModalActionState(modal);
  });
}

function kcOpenPromptPreviewModal(workbench) {
  return kcRenderPromptWorkbenchFrame(workbench, { inline: false });
}

function kcOpenPromptPreviewInline(workbench) {
  return kcRenderPromptWorkbenchFrame(workbench, { inline: true });
}

function kcOpenPromptWorkbenchLoadingInline() {
  const root = kcGetPromptInlineRoot();
  if (!root) {
    return {
      close() {},
      setStatus() {},
      addLog() {},
    };
  }
  kcClearPromptInlineRoot();
  const startedAt = Date.now();
  const modal = document.createElement('div');
  modal.id = 'kc-prompt-loading-panel';
  modal.style.cssText = 'border:1px solid rgba(255,140,0,0.16);background:#fff;border-radius:22px;box-shadow:0 18px 42px rgba(255,140,0,0.10);overflow:hidden;';
  modal.innerHTML = `
    <div style="width:100%;background:#fff;border-radius:22px;overflow:hidden;">
      <div style="padding:24px 26px 18px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg, rgba(255,140,0,0.08), rgba(255,255,255,0));">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;box-shadow:0 12px 24px rgba(255,140,0,0.2);">
            ✎
          </div>
          <div>
            <div style="font-size:20px;font-weight:800;color:#1c1c1e;">프롬프트 편집 준비 중</div>
            <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-top:4px;">잠시만 기다려주세요.</div>
          </div>
        </div>
      </div>
      <div style="padding:22px 26px 26px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:12px;">
          <span class="spinner" style="width:22px;height:22px;border-width:3px;"></span>
          <div id="kc-prompt-loading-status" style="font-size:13px;color:#1c1c1e;font-weight:700;">프롬프트를 불러오는 중...</div>
          </div>
          <div id="kc-prompt-loading-elapsed" style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.14);font-size:11px;font-weight:700;color:#ff8c00;">0초 경과</div>
        </div>
        <div style="display:grid;gap:10px;">
          <div style="height:14px;border-radius:999px;background:linear-gradient(90deg,rgba(255,140,0,0.12),rgba(255,140,0,0.03));"></div>
          <div style="height:14px;width:92%;border-radius:999px;background:rgba(0,0,0,0.05);"></div>
          <div style="height:14px;width:74%;border-radius:999px;background:rgba(0,0,0,0.04);"></div>
        </div>
        <div style="margin-top:16px;font-size:12px;color:rgba(0,0,0,0.42);line-height:1.7;">정리 중인 단계를 아래 로그로 계속 표시합니다.</div>
        <div style="margin-top:14px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#101318;overflow:hidden;">
          <div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <div style="font-size:12px;font-weight:800;color:#f8fafc;">진행 로그</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);">prompt-preview</div>
          </div>
          <div id="kc-prompt-loading-console" style="max-height:220px;overflow:auto;padding:12px;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:11px;line-height:1.7;color:#dbe4ee;background:linear-gradient(180deg,#101318,#171b22);">
            <div style="color:#7dd3fc;">[00:00] 프롬프트 편집 준비를 시작했습니다.</div>
            <div style="color:#cbd5e1;">[00:00] 선택한 소스와 프로필 정보를 정리하고 있습니다.</div>
          </div>
        </div>
      </div>
    </div>
  `;
  root.innerHTML = '';
  root.appendChild(modal);
  root.style.display = 'block';
  // 3단계 카드가 보이도록 보장 후 스크롤
  const card3 = document.getElementById('kc-card-3');
  if (card3) card3.style.display = 'block';
  setTimeout(() => root.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  const elapsedEl = modal.querySelector('#kc-prompt-loading-elapsed');
  const consoleEl = modal.querySelector('#kc-prompt-loading-console');
  const formatElapsed = () => {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return { label: `${totalSeconds}초 경과`, stamp: `${mm}:${ss}` };
  };
  const timer = setInterval(() => {
    const formatted = formatElapsed();
    if (elapsedEl) elapsedEl.textContent = formatted.label;
  }, 1000);
  const addLog = (message, color = '#cbd5e1') => {
    if (!consoleEl || !message) return;
    const formatted = formatElapsed();
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = `[${formatted.stamp}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };
  const stagedMessages = [
    { delay: 400, text: '선택한 본문 원문을 모으고 있습니다.', color: '#cbd5e1' },
    { delay: 1200, text: '핵심 자료 요약 요청을 전송했습니다.', color: '#fbbf24' },
    { delay: 3200, text: 'AI 응답을 기다리는 중입니다. 원문 길이에 따라 시간이 걸릴 수 있습니다.', color: '#fca5a5' },
    { delay: 6500, text: '한국어 정리 여부를 확인하고 있습니다.', color: '#86efac' },
  ];
  const stagedTimers = stagedMessages.map(({ delay, text, color }) => setTimeout(() => addLog(text, color), delay));
  return {
    close() {
      clearInterval(timer);
      stagedTimers.forEach(clearTimeout);
      kcClearPromptInlineRoot();
    },
    setStatus(text) {
      const status = modal.querySelector('#kc-prompt-loading-status');
      if (status && text) status.textContent = text;
    },
    addLog,
  };
}

async function kcReviewPromptsBeforeGenerate(payload) {
  const loadingModal = kcOpenPromptWorkbenchLoadingInline();
  const previewPromise = api('/api/content/prompt-preview', { method: 'POST', body: payload.body });
  try {
    loadingModal.addLog('서버에 프롬프트 미리보기 생성 요청을 보냈습니다.', '#7dd3fc');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('preview_timeout')), 30000));
    const res = await Promise.race([previewPromise, timeoutPromise]);
    loadingModal.addLog('핵심 자료 정리가 완료되어 편집 화면을 준비합니다.', '#86efac');
    const sourceSummary = (res?.source_summary || '').trim();
    _kcLastPromptSourceSummary = sourceSummary || kcFallbackSourceSummaryText();
    const prompts = res.prompts || {};
    const workbench = kcBuildPromptWorkbench(prompts, payload, sourceSummary ? (res || {}) : { ...(res || {}), source_summary: kcFallbackSourceSummaryText() });
    loadingModal.close();
    return await kcOpenPromptPreviewInline(workbench);
  } catch (e) {
    console.error('[KC] prompt review failed', e);
    const timeoutFallback = e?.message === 'preview_timeout';
    if (timeoutFallback) {
      loadingModal.setStatus('핵심 자료를 계속 정리하는 중...');
      loadingModal.addLog('응답이 8초를 넘겼지만 작업은 계속 진행 중입니다.', '#fca5a5');
      loadingModal.addLog('잠시 더 기다린 뒤에도 응답이 없으면 임시 편집 화면으로 자동 전환합니다.', '#fbbf24');
      toast('핵심 자료 준비가 길어지고 있습니다. 같은 화면에서 계속 진행 상황을 표시합니다.');
      try {
        const longWaitPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('preview_fallback_open')), 60000));
        const res = await Promise.race([previewPromise, longWaitPromise]);
        loadingModal.addLog('핵심 자료 정리가 완료되어 편집 화면을 엽니다.', '#86efac');
        const sourceSummary = (res?.source_summary || '').trim();
        _kcLastPromptSourceSummary = sourceSummary || kcFallbackSourceSummaryText();
        const prompts = res.prompts || {};
        const workbench = kcBuildPromptWorkbench(prompts, payload, sourceSummary ? (res || {}) : { ...(res || {}), source_summary: kcFallbackSourceSummaryText() });
        loadingModal.close();
        return await kcOpenPromptPreviewInline(workbench);
      } catch (err) {
        console.error('[KC] delayed prompt preview failed', err);
        if (err?.message === 'preview_fallback_open') {
          loadingModal.addLog('응답이 더 지연되어 임시 편집 화면으로 전환합니다.', '#fbbf24');
          loadingModal.close();
          toast('핵심 자료 응답이 지연되어 임시 편집 화면으로 전환합니다.');
          const fallbackWorkbench = kcBuildEmergencyPromptWorkbenchFallback(payload);
          return await kcOpenPromptPreviewInline(fallbackWorkbench);
        }
        loadingModal.addLog(`장시간 대기 후 예외가 발생했습니다: ${err?.message || err}`, '#fca5a5');
        loadingModal.close();
        toast('프롬프트를 기본 화면으로 열었습니다.');
      }
    } else {
      loadingModal.setStatus('프롬프트를 여는 중...');
      loadingModal.addLog(`프롬프트 준비 중 예외가 발생했습니다: ${e?.message || e}`, '#fca5a5');
      loadingModal.close();
      toast('프롬프트를 기본 화면으로 열었습니다.');
    }
    const fallbackWorkbench = timeoutFallback ? kcBuildEmergencyPromptWorkbenchFallback(payload) : kcBuildLocalPromptWorkbenchFallback(payload);
    return await kcOpenPromptPreviewInline(fallbackWorkbench);
  }
}

function kcSetGenerateButtonsLoading(loading) {
  const mainBtn = document.getElementById('kc-generate-btn');
  const promptBtn = document.getElementById('kc-generate-prompt-btn');
  if (mainBtn) {
    mainBtn.disabled = !!loading;
    mainBtn.style.opacity = loading ? '0.5' : '1';
    if (loading) {
      mainBtn.classList.remove('kc-next-btn');
      mainBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span> 생성 중...';
    } else {
      mainBtn.classList.add('kc-next-btn');
      mainBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>콘텐츠 생성';
    }
  }
  if (promptBtn) {
    promptBtn.disabled = !!loading;
    promptBtn.style.opacity = loading ? '0.5' : '1';
    promptBtn.innerHTML = loading
      ? '<span class="spinner" style="width:16px;height:16px;"></span> 준비 중...'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>프롬프트 수정 후 생성';
  }
}

function kcBuildDetailPromptSlides(title, sections) {
  const workbench = (_kcPromptOverrides && _kcPromptOverrides.detail_page_workbench) || {};
  // 블로그 본문이 있으면 무조건 블로그 본문 우선 사용
  const blogBody = (document.getElementById('kc-blog-body')?.value || '').trim();
  const sourceContext = blogBody || workbench.source_context || _kcLastPromptSourceSummary || '';
  const legacyRules = workbench.design_rules || _kcPromptOverrides?.detail_page_design_rules || '';
  const sectionTemplate = kcNormalizeDetailSectionTemplate(
    workbench.section_template || _kcPromptOverrides?.detail_page_section_template || '',
    legacyRules,
  ) || kcComposeDetailSectionTemplate();
  return sections.map((sec, i) => {
    const bodyPreview = (sec.body || '').split('\n').filter(l => l.trim()).slice(0, 3).join('\n');
    const coverInstruction = sec.iscover ? '이것은 표지입니다. 임팩트 있게 만들어주세요.' : `${i + 1}번째 섹션입니다.`;
    return {
      slide_number: i + 1,
      title: sec.title,
      body: bodyPreview,
      iscover: !!sec.iscover,
      visual_prompt: sectionTemplate
        .replaceAll('{cover_instruction}', coverInstruction)
        .replaceAll('{title}', sec.title || '')
        .replaceAll('{body}', bodyPreview || '')
        .replaceAll('{source_summary}', sourceContext || ''),
    };
  });
}

function kcOpenDetailPromptModal(slides) {
  return new Promise(resolve => {
    kcCloseOverlappingPromptModals('kc-detail-prompt-modal');
    const existing = document.getElementById('kc-detail-prompt-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'kc-detail-prompt-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;isolation:isolate;';
    modal.innerHTML = `
      <div style="width:min(1240px, calc(100vw - 32px));max-height:calc(100vh - 32px);background:#fff;border-radius:24px;box-shadow:0 25px 80px rgba(0,0,0,0.22);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:20px;font-weight:800;color:#1c1c1e;">상세페이지 이미지 프롬프트 확인</div>
              <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-top:4px;">섹션별 이미지 프롬프트를 생성 전에 직접 수정할 수 있습니다.</div>
            </div>
            <button type="button" id="kc-detail-prompt-close" style="width:34px;height:34px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);font-size:18px;cursor:pointer;color:rgba(0,0,0,0.45);">×</button>
          </div>
        </div>
        <div style="padding:20px 24px;overflow:auto;display:flex;flex-direction:column;gap:14px;">
          ${slides.map((s, idx) => `
            <div style="border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:14px;background:rgba(255,255,255,0.94);">
              <div style="font-size:14px;font-weight:700;color:#ff8c00;margin-bottom:6px;">섹션 ${idx + 1} · ${escapeHtml(s.title || '')}</div>
              <textarea data-detail-prompt-index="${idx}" rows="7" style="width:100%;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;font-size:12px;line-height:1.65;resize:vertical;font-family:'SF Mono',Monaco,Consolas,monospace;">${escapeHtml(s.visual_prompt || '')}</textarea>
            </div>
          `).join('')}
        </div>
        <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="kc-detail-prompt-cancel" style="padding:11px 18px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.55);">취소</button>
          <button type="button" id="kc-detail-prompt-save" style="padding:11px 18px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">이 프롬프트로 생성</button>
        </div>
      </div>
    `;

    const close = value => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector('#kc-detail-prompt-close')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-detail-prompt-cancel')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-detail-prompt-save')?.addEventListener('click', () => {
      const next = slides.map(s => ({ ...s }));
      modal.querySelectorAll('[data-detail-prompt-index]').forEach(el => {
        const idx = parseInt(el.getAttribute('data-detail-prompt-index') || '-1', 10);
        if (next[idx]) next[idx].visual_prompt = el.value || next[idx].visual_prompt;
      });
      close(next);
    });
    modal.addEventListener('click', e => { if (e.target === modal) close(null); });
    document.body.appendChild(modal);
    kcBringModalToFront(modal);
  });
}

function kcOpenCardnewsImagePromptModal(slides) {
  return new Promise(resolve => {
    kcCloseOverlappingPromptModals('kc-cardnews-prompt-modal');
    const existing = document.getElementById('kc-cardnews-prompt-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'kc-cardnews-prompt-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;isolation:isolate;';
    modal.innerHTML = `
      <div style="width:min(1240px, calc(100vw - 32px));max-height:calc(100vh - 32px);background:#fff;border-radius:24px;box-shadow:0 25px 80px rgba(0,0,0,0.22);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:20px;font-weight:800;color:#1c1c1e;">카드뉴스 이미지 프롬프트 확인</div>
              <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-top:4px;">슬라이드별 이미지 프롬프트를 생성 전에 수정할 수 있습니다.</div>
            </div>
            <button type="button" id="kc-cardnews-prompt-close" style="width:34px;height:34px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);font-size:18px;cursor:pointer;color:rgba(0,0,0,0.45);">×</button>
          </div>
        </div>
        <div style="padding:20px 24px;overflow:auto;display:flex;flex-direction:column;gap:14px;">
          ${slides.map((s, idx) => `
            <div style="border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:14px;background:rgba(255,255,255,0.94);">
              <div style="font-size:14px;font-weight:700;color:#ff8c00;margin-bottom:6px;">슬라이드 ${idx + 1} · ${escapeHtml(s.title || '')}</div>
              <textarea data-cardnews-prompt-index="${idx}" rows="6" style="width:100%;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;font-size:12px;line-height:1.65;resize:vertical;font-family:'SF Mono',Monaco,Consolas,monospace;">${escapeHtml(s.visual_prompt || '')}</textarea>
            </div>
          `).join('')}
        </div>
        <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" id="kc-cardnews-prompt-cancel" style="padding:11px 18px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.55);">취소</button>
          <button type="button" id="kc-cardnews-prompt-save" style="padding:11px 18px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">이 프롬프트로 생성</button>
        </div>
      </div>
    `;

    const close = value => {
      modal.remove();
      resolve(value);
    };
    modal.querySelector('#kc-cardnews-prompt-close')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-cardnews-prompt-cancel')?.addEventListener('click', () => close(null));
    modal.querySelector('#kc-cardnews-prompt-save')?.addEventListener('click', () => {
      const next = slides.map(s => ({ ...s }));
      modal.querySelectorAll('[data-cardnews-prompt-index]').forEach(el => {
        const idx = parseInt(el.getAttribute('data-cardnews-prompt-index') || '-1', 10);
        if (next[idx]) next[idx].visual_prompt = el.value || next[idx].visual_prompt;
      });
      close(next);
    });
    modal.addEventListener('click', e => { if (e.target === modal) close(null); });
    document.body.appendChild(modal);
    kcBringModalToFront(modal);
  });
}

async function kcReviewComicPrompt(topic, style, reference, panelCount) {
  const initial = (_kcPromptOverrides && _kcPromptOverrides.comic_script_prompt)
    ? _kcPromptOverrides.comic_script_prompt
    : `스토리 만화를 만들려고 합니다. 권장 컷 수는 ${panelCount}컷입니다.

주제: ${topic}
스타일: ${style}

[참고 자료 — 이 내용을 기반으로 만화 내용을 구성하세요]
${(reference || '').substring(0, 3000)}

4컷으로 고정하지 말고 자료 흐름에 맞춰 각 컷에 들어갈 내용을 JSON 배열로 만들어주세요.`;
  const payload = kcBuildGeneratePayload();
  const summary = reference || kcPromptSourceDigest(payload, { source_summary: reference }, 1800);
  const workbench = {
    comic: kcBuildComicWorkbench(
      { script_prompt: initial },
      payload,
      { source_summary: summary },
    ),
  };
  const res = await kcOpenPromptPreviewModal(workbench);
  return res?.comic_script_prompt || null;
}
