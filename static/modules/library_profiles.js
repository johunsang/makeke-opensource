// ============================================================
// 내 라이브러리
// ============================================================
let _libProfiles = [];
let _defaultProfileId = null;
let _defaultProfile = null; // 기본 프로필 전체 데이터
let _libCurrentStyleData = null;
let _libCurrentStyleBundle = null;
let _libStyleEditMode = false;
let _libStylePlatform = 'blog';
let _libDesignAutosaveTimer = null;

function libPrepareEditModalLayout() {
  const overlay = document.getElementById('libEditModal');
  if (!overlay) return null;
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '20px 18px';
  overlay.style.background = 'rgba(0,0,0,0.4)';
  overlay.style.zIndex = '100001';
  overlay.style.overflow = 'hidden';
  const modalSheet = overlay.querySelector('#libEditSheet');
  if (modalSheet) {
    modalSheet.style.width = 'min(1180px, calc(100vw - 36px))';
    modalSheet.style.maxWidth = '1180px';
    modalSheet.style.maxHeight = 'calc(100vh - 40px)';
    modalSheet.style.margin = '0 auto';
    modalSheet.style.padding = '28px 30px 30px';
    modalSheet.style.display = 'flex';
    modalSheet.style.flexDirection = 'column';
    modalSheet.style.position = 'relative';
    modalSheet.style.overflow = 'hidden';
    modalSheet.style.boxSizing = 'border-box';
    modalSheet.style.borderRadius = '24px';
    modalSheet.style.background = '#fff';
  }
  const title = overlay.querySelector('#lib-modal-title');
  if (title) {
    title.style.margin = '0 56px 18px 0';
    title.style.fontSize = '20px';
    title.style.fontWeight = '700';
    title.style.writingMode = 'horizontal-tb';
    title.style.whiteSpace = 'normal';
  }
  const closeBtn = overlay.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '18px';
    closeBtn.style.right = '18px';
    closeBtn.style.left = 'auto';
    closeBtn.style.float = 'none';
    closeBtn.style.zIndex = '2';
  }
  const modalBody = overlay.querySelector('.lib-modal-body');
  if (modalBody) {
    modalBody.style.flex = '1 1 auto';
    modalBody.style.minHeight = '0';
    modalBody.style.overflowY = 'auto';
    modalBody.style.overflowX = 'hidden';
    modalBody.style.paddingRight = '6px';
    modalBody.style.marginRight = '-6px';
    modalBody.style.width = '100%';
    modalBody.scrollTop = 0;
  }
  const tabs = overlay.querySelector('.lib-edit-tabs');
  if (tabs) {
    tabs.style.display = 'grid';
    tabs.style.gridTemplateColumns = 'repeat(auto-fit, minmax(110px, 1fr))';
    tabs.style.gap = '4px';
    tabs.style.marginBottom = '18px';
    tabs.style.background = 'rgba(0,0,0,0.04)';
    tabs.style.padding = '4px';
    tabs.style.borderRadius = '12px';
  }
  const footer = overlay.querySelector('.lib-modal-actions');
  if (footer) {
    footer.style.display = 'flex';
    footer.style.width = '100%';
    footer.style.boxSizing = 'border-box';
    footer.style.alignSelf = 'stretch';
    footer.style.flex = '0 0 auto';
    footer.style.marginTop = '16px';
    footer.style.padding = '16px 0 0';
    footer.style.background = '#fff';
    footer.style.borderTop = '1px solid rgba(0,0,0,0.06)';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
  }
  if (modalSheet) modalSheet.scrollTop = 0;
  return overlay;
}

function libNotifyResearchSync(profileId, platform = 'all', account = '') {
  window.dispatchEvent(new CustomEvent('makeke-profile-research-sync', {
    detail: {
      profileId: String(profileId || ''),
      platform: String(platform || 'all'),
      account: String(account || ''),
    },
  }));
}

function libSyncCrawlDefaultInputs(force = false) {
  const pairs = [
    ['lib-plat-naver', 'lib-crawl-naver-id'],
    ['lib-plat-threads', 'lib-crawl-threads-id'],
  ];
  pairs.forEach(([sourceId, targetId]) => {
    const sourceEl = document.getElementById(sourceId);
    const targetEl = document.getElementById(targetId);
    if (!sourceEl || !targetEl) return;
    const sourceValue = String(sourceEl.value || '').trim();
    const prevSource = String(targetEl.dataset.sourceValue || '').trim();
    const currentValue = String(targetEl.value || '').trim();
    if (force || !currentValue || currentValue === prevSource) {
      targetEl.value = sourceValue;
    }
    targetEl.dataset.sourceValue = sourceValue;
  });

}

function libBindCrawlDefaultInputs() {
  [
    ['lib-plat-naver', 'input'],
    ['lib-plat-threads', 'input'],
  ].forEach(([id, eventName]) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.crawlSyncBound === '1') return;
    el.addEventListener(eventName, () => libSyncCrawlDefaultInputs(false));
    el.dataset.crawlSyncBound = '1';
  });
}

function libDesignColorIds() {
  return ['lib-design-color-1', 'lib-design-color-2', 'lib-design-color-3', 'lib-design-color-4', 'lib-design-color-5'];
}

function libNormalizeHexColor(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/#?[0-9a-fA-F]{6}\b/);
  if (!match) return '';
  return match[0].charAt(0) === '#' ? match[0].toUpperCase() : ('#' + match[0].toUpperCase());
}

function libParseDesignColors(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  let candidates = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) candidates = parsed;
    else if (parsed && typeof parsed === 'object') candidates = Object.values(parsed);
  } catch {}
  if (!candidates.length) candidates = raw.split(/[,\s/|]+/);
  return Array.from(new Set(candidates.map(libNormalizeHexColor).filter(Boolean))).slice(0, 5);
}

function libSyncDesignColorPalette() {
  const colors = libDesignColorIds()
    .map(id => libNormalizeHexColor(document.getElementById(id)?.value || ''))
    .filter(Boolean);
  const paletteEl = document.getElementById('lib-edit-brand-colors');
  if (paletteEl) paletteEl.value = colors.join(', ');
  const primary = colors[0] || '';
  if (primary) {
    const brandColor = document.getElementById('lib-edit-brand-color');
    const brandText = document.getElementById('lib-edit-brand-color-text');
    if (brandColor) brandColor.value = primary;
    if (brandText) brandText.value = primary;
  }
}

function libApplyDesignPaletteText() {
  const colors = libParseDesignColors(document.getElementById('lib-edit-brand-colors')?.value || '');
  libDesignColorIds().forEach((id, index) => {
    const el = document.getElementById(id);
    if (el && colors[index]) el.value = colors[index];
  });
  if (colors[0]) {
    const brandColor = document.getElementById('lib-edit-brand-color');
    const brandText = document.getElementById('lib-edit-brand-color-text');
    if (brandColor) brandColor.value = colors[0];
    if (brandText) brandText.value = colors[0];
  }
}

function libDesignValue(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (value === undefined || value === null) return '';
  return String(value);
}

function libDesignPaletteMarkdown(colorsInput) {
  const colors = Array.isArray(colorsInput) ? colorsInput : libParseDesignColors(colorsInput);
  const roles = ['메인', '보조', '배경', '텍스트', '강조'];
  const fallback = ['#FF8C00', '#FF6B00', '#FFFFFF', '#1C1C1E', '#FBBF24'];
  return [
    '## 2. 대표 색상 팔레트',
    ...roles.map((role, index) => `- ${role}: ${colors[index] || fallback[index]} — ${role} 색상의 사용처와 금지 사용처를 적습니다.`),
  ].join('\n');
}

function libDefaultDesignMarkdown(colorsInput) {
  const palette = libDesignPaletteMarkdown(colorsInput);
  return [
    '# 브랜드 디자인 규칙.md',
    '',
    '## 1. CI/BI 컨셉',
    '- 브랜드가 보여야 하는 첫인상:',
    '- 핵심 고객이 느껴야 하는 감정:',
    '- 서비스 강점이 시각적으로 드러나는 방식:',
    '- 모든 콘텐츠에서 유지할 브랜드 태도:',
    '',
    palette,
    '',
    '## 3. 타이포그래피와 문구 톤',
    '- 제목/본문/숫자/자막/버튼 문구 규칙:',
    '- 과장 없이 신뢰를 주는 문장 길이와 어휘:',
    '',
    '## 4. 카드뉴스 규칙',
    '- 표지: 첫눈에 문제와 결과가 보이게 구성합니다.',
    '- 본문: 근거, 비교, 절차, 사례 장면을 서로 다른 정보 구조로 나눕니다.',
    '- 마지막 CTA: 부담 없는 행동 유도와 브랜드 색상 강조만 사용합니다.',
    '',
    '## 5. 마케케디자인 규칙',
    '- 배너, 상세페이지, 광고 소재의 버튼, 배지, 구분선, CTA 위치를 통일합니다.',
    '',
    '## 6. 블로그 이미지와 SNS 썸네일 규칙',
    '- 대표 이미지는 실제 서비스 결과나 핵심 상황을 보여줍니다.',
    '- 본문 이미지는 설명, 비교, 절차, 근거를 보조하는 역할로 나눕니다.',
    '',
    '## 7. HyperFrames 영상 규칙',
    '- 씬 이미지는 배경 역할만 맡고 문구, 가격, CTA는 HTML 레이어로 올립니다.',
    '- 자막, 강조선, 마커, CTA 모션은 브랜드 색상과 문서의 톤을 따릅니다.',
    '',
    '## 8. 금지 규칙',
    '- 이미지 안 글자 생성 금지',
    '- 가격표/CTA/후기 문구를 이미지에 직접 삽입 금지',
    '- 브랜드와 무관한 앱 기본색 남용 금지',
    '- 업종별 법적/윤리적 위험 표현 금지',
  ].join('\n');
}

function libUpsertDesignMarkdownPalette() {
  const rulesEl = document.getElementById('lib-edit-design-rules');
  if (!rulesEl) return;
  const colors = libParseDesignColors(document.getElementById('lib-edit-brand-colors')?.value || '');
  const palette = libDesignPaletteMarkdown(colors);
  const current = String(rulesEl.value || '').trim();
  if (!current) return;
  const sectionRe = /## 2\. 대표 색상 팔레트[\s\S]*?(?=\n## \d+\. |\n# |$)/;
  if (sectionRe.test(current)) {
    rulesEl.value = current.replace(sectionRe, palette);
    return;
  }
  rulesEl.value = current + '\n\n' + palette;
}

function libLegacyDesignMarkdown(profile) {
  const p = profile || {};
  const legacy = [
    ['브랜드 무드 / 톤', p.design_tone],
    ['타이포그래피 규칙', p.typography_rules],
    ['레이아웃 / 여백 / 구성 규칙', p.layout_rules],
    ['이미지 / 사진 / 일러스트 규칙', p.image_rules],
    ['CTA / 버튼 / 강조 요소 규칙', p.cta_rules],
    ['금지 디자인 / 피해야 할 표현', p.design_forbidden],
  ].filter(([, value]) => String(value || '').trim());
  if (!legacy.length) return '';
  const colors = libParseDesignColors(p.brand_colors || p.design_colors || p.brand_color || '');
  const parts = [
    '# 브랜드 디자인 규칙.md',
    '',
    libDesignPaletteMarkdown(colors),
    '',
    '## 9. 기존 세부 규칙 통합',
  ];
  legacy.forEach(([label, value]) => {
    parts.push(`### ${label}`, String(value || '').trim());
  });
  return parts.join('\n');
}

function libBuildDesignGuidePayload() {
  const colors = libParseDesignColors(document.getElementById('lib-edit-brand-colors')?.value || '');
  const brandColor = colors[0] || libNormalizeHexColor(document.getElementById('lib-edit-brand-color')?.value || '') || '#FF8C00';
  const palette = colors.length ? colors.join(', ') : (document.getElementById('lib-edit-brand-colors')?.value || '').trim();
  return {
    brand_color: brandColor,
    brand_colors: palette,
    design_tone: '',
    typography_rules: '',
    layout_rules: '',
    image_rules: '',
    cta_rules: '',
    design_forbidden: '',
    design_rules: (document.getElementById('lib-edit-design-rules')?.value || '').trim(),
  };
}

function libBindDesignGuideAutosave() {
  const ids = [
    ...libDesignColorIds(),
    'lib-edit-brand-colors',
    'lib-edit-design-tone',
    'lib-edit-typography-rules',
    'lib-edit-layout-rules',
    'lib-edit-image-rules',
    'lib-edit-cta-rules',
    'lib-edit-design-forbidden',
    'lib-edit-design-rules',
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.designAutosaveBound === '1') return;
    const eventName = el.type === 'color' ? 'input' : 'input';
    el.addEventListener(eventName, () => {
      if (id.startsWith('lib-design-color-')) {
        libSyncDesignColorPalette();
        libUpsertDesignMarkdownPalette();
      }
      if (id === 'lib-edit-brand-colors') {
        libApplyDesignPaletteText();
        libUpsertDesignMarkdownPalette();
      }
      libAutosaveDesignGuide();
    });
    el.dataset.designAutosaveBound = '1';
  });
}

function libAutosaveDesignGuide(options = {}) {
  if (!_libEditingId) return;
  const delay = options.immediate ? 0 : 700;
  clearTimeout(_libDesignAutosaveTimer);
  _libDesignAutosaveTimer = setTimeout(async () => {
    const status = document.getElementById('lib-design-ai-status');
    try {
      await api(`/api/library/profiles/${_libEditingId}`, {
        method: 'PUT',
        body: libBuildDesignGuidePayload(),
      });
      if (status && options.showStatus !== false) {
        status.textContent = options.message || '디자인 규칙과 대표 색상 팔레트가 자동 저장되었습니다.';
        status.style.color = '#34c759';
      }
      if (String(window._globalProfileId || '') === String(_libEditingId)) {
        window._globalProfileData = { ...(window._globalProfileData || {}), ...libBuildDesignGuidePayload() };
      }
      if (options.refreshList) libLoadProfiles().catch(() => {});
    } catch (e) {
      if (status) {
        status.textContent = '자동 저장 실패: ' + (e.message || e);
        status.style.color = '#ff3b30';
      }
    }
  }, delay);
}

function libResetDesignGuideFields() {
  const defaults = ['#FF8C00', '#FF6B00', '#FFFFFF', '#1C1C1E', '#FBBF24'];
  libDesignColorIds().forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.value = defaults[index];
  });
  const paletteEl = document.getElementById('lib-edit-brand-colors');
  if (paletteEl) paletteEl.value = defaults.join(', ');
  [
    'lib-edit-design-tone',
    'lib-edit-typography-rules',
    'lib-edit-layout-rules',
    'lib-edit-image-rules',
    'lib-edit-cta-rules',
    'lib-edit-design-forbidden',
    'lib-edit-design-rules',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const rulesEl = document.getElementById('lib-edit-design-rules');
  if (rulesEl) rulesEl.value = '';
}

function libLoadDesignGuideFields(profile) {
  const p = profile || {};
  const colors = libParseDesignColors(p.brand_colors || p.design_colors || p.brand_color || '');
  const mergedColors = colors.length ? colors : libParseDesignColors(p.brand_color || '');
  libDesignColorIds().forEach((id, index) => {
    const el = document.getElementById(id);
    if (el && mergedColors[index]) el.value = mergedColors[index];
  });
  const paletteEl = document.getElementById('lib-edit-brand-colors');
  if (paletteEl) paletteEl.value = (mergedColors.length ? mergedColors : libDesignColorIds().map(id => document.getElementById(id)?.value).filter(Boolean)).join(', ');
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  };
  set('lib-edit-design-tone', p.design_tone);
  set('lib-edit-typography-rules', p.typography_rules);
  set('lib-edit-layout-rules', p.layout_rules);
  set('lib-edit-image-rules', p.image_rules);
  set('lib-edit-cta-rules', p.cta_rules);
  set('lib-edit-design-forbidden', p.design_forbidden);
  set('lib-edit-design-rules', p.design_rules || libLegacyDesignMarkdown(p));
  libUpsertDesignMarkdownPalette();
}

// 기본 프로필 로딩 (앱 시작 시 자동 호출)
async function loadDefaultProfile() {
  try {
    const res = await api('/api/library/default');
    if (res.profile) {
      _defaultProfile = res.profile;
      _defaultProfileId = res.profile.id;
      console.log('[Library] 기본 프로필 로드:', _defaultProfile.name);
      // 전역 프로필이 아직 없으면 — localStorage 복원 우선, 없으면 기본 프로필
      if (!window._globalProfileId) {
        let restoreId = null;
        try { restoreId = localStorage.getItem('makeke_last_profile_id'); } catch {}
        if (restoreId) {
          try {
            const saved = await api(`/api/library/profiles/${restoreId}`);
            if (saved && saved.id) {
              window._globalProfileId = String(saved.id);
              window._globalProfileData = saved;
              loadProfileToGlobalOpts(saved);
              const globalSel = document.getElementById('global-profile-select');
              if (globalSel) globalSel.value = String(saved.id);
              if (typeof updateProfileButton === 'function') updateProfileButton(saved.id);
              if (typeof syncChromeConnectionForCurrentProfile === 'function') {
                setTimeout(() => syncChromeConnectionForCurrentProfile().catch(() => {}), 50);
              }
              if (typeof checkBrowserStatus === 'function') setTimeout(checkBrowserStatus, 500);
              console.log('[Library] 이전 프로필 복원:', saved.name);
            } else { restoreId = null; }
          } catch { restoreId = null; }
        }
        if (!restoreId) {
          window._globalProfileId = String(res.profile.id);
          window._globalProfileData = res.profile;
          loadProfileToGlobalOpts(res.profile);
          const globalSel = document.getElementById('global-profile-select');
          if (globalSel) globalSel.value = String(res.profile.id);
          if (typeof updateProfileButton === 'function') updateProfileButton(res.profile.id);
          if (typeof syncChromeConnectionForCurrentProfile === 'function') {
            setTimeout(() => syncChromeConnectionForCurrentProfile().catch(() => {}), 50);
          }
          if (typeof checkBrowserStatus === 'function') setTimeout(checkBrowserStatus, 500);
        }
      }
    } else {
      _defaultProfile = null;
      _defaultProfileId = null;
    }
  } catch (e) {
    _defaultProfile = null;
    _defaultProfileId = null;
  }
}

// 기본 프로필 설정
async function libSetDefault(profileId) {
  try {
    if (_defaultProfileId == profileId) {
      // 이미 기본이면 해제
      await api('/api/library/default', { method: 'DELETE' });
      _defaultProfileId = null;
      _defaultProfile = null;
      toast('기본 프로필이 해제되었습니다');
    } else {
      await api(`/api/library/default/${profileId}`, { method: 'PUT' });
      await loadDefaultProfile();
      toast(`"${_defaultProfile.name}" 이 기본 프로필로 설정되었습니다`);
    }
    libRenderGrid();
  } catch (e) {
    toast('기본 프로필 설정 실패: ' + e.message, 'error');
  }
}

// 기본 프로필 정보를 특정 폼에 자동 채우기
function applyDefaultProfile(opts = {}) {
  if (!_defaultProfile) return;
  const p = _defaultProfile;
  // 브랜드명
  if (opts.brandNameId) {
    const el = document.getElementById(opts.brandNameId);
    if (el && !el.value) el.value = p.name || '';
  }
  // 업종
  if (opts.businessTypeId) {
    const el = document.getElementById(opts.businessTypeId);
    if (el && !el.value) el.value = p.business_type || '';
  }
  // 설명
  if (opts.descriptionId) {
    const el = document.getElementById(opts.descriptionId);
    if (el && !el.value) el.value = p.description || '';
  }
  // 연락처
  if (opts.contactId) {
    const el = document.getElementById(opts.contactId);
    if (el && !el.value) el.value = p.contact_info || '';
  }
  // 키워드
  if (opts.keywordsId) {
    const el = document.getElementById(opts.keywordsId);
    if (el && !el.value) el.value = p.keywords || '';
  }
}

// 앱 시작 시 기본 프로필 로드
loadDefaultProfile();
let _libEditingId = null; // null=새로 만들기, number=수정

async function libLoadProfiles() {
  try {
    _libProfiles = await api('/api/library/profiles');
    libRenderGrid();
  } catch (e) {
    toast('프로필 목록 로딩 실패: ' + e.message, 'error');
  }
}

function libRenderGrid() {
  const grid = document.getElementById('lib-profiles-grid');
  if (!_libProfiles || _libProfiles.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center;padding:60px;color:#6b7f8e;grid-column:1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 12px;display:block;opacity:0.3;"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        등록된 프로필이 없습니다. "프로필 추가" 버튼을 눌러 시작하세요.
      </div>`;
    return;
  }
  grid.innerHTML = _libProfiles.map(p => {
    const images = JSON.parse(p.images_json || '[]');
    const logoUrl = p.logo_path ? `${encImg('/api/library/image/'+p.id+'/'+p.logo_path)}` : '';
    const isDefault = _defaultProfileId == p.id;
    const keywords = p.keywords ? p.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
    const designColors = libParseDesignColors(p.brand_colors || p.brand_color || '');
    const hasDesignRules = !!String(p.design_rules || p.design_tone || p.typography_rules || p.layout_rules || p.image_rules || p.cta_rules || p.design_forbidden || '').trim();
    return `
      <div style="background:#fff;border:1px solid ${isDefault ? 'rgba(0,122,255,0.3)' : 'rgba(0,0,0,0.08)'};border-radius:16px;padding:20px;transition:box-shadow 0.2s;${isDefault ? 'box-shadow:0 0 0 2px rgba(0,122,255,0.1);' : ''}"
           onmouseenter="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='${isDefault ? '0 0 0 2px rgba(0,122,255,0.1)' : 'none'}'">
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">
          <div style="width:56px;height:56px;border-radius:14px;background:rgba(0,0,0,0.04);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${logoUrl
              ? `<img src="${logoUrl}" style="width:100%;height:100%;object-fit:cover;">`
              : `<span style="font-size:24px;font-weight:700;color:rgba(0,0,0,0.2);">${p.name.charAt(0)}</span>`}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:16px;font-weight:700;color:#1c1c1e;">${escapeHtml(p.name)}</span>
              ${isDefault ? '<span style="font-size:9px;padding:2px 6px;background:#007aff;color:#fff;border-radius:4px;font-weight:600;">기본</span>' : ''}
            </div>
            ${p.business_type ? `<span style="font-size:11px;padding:2px 8px;background:rgba(175,82,222,0.08);color:#af52de;border-radius:6px;display:inline-block;margin-top:4px;">${escapeHtml(p.business_type)}</span>` : ''}
          </div>
        </div>
        ${p.description ? `<div style="font-size:13px;color:rgba(0,0,0,0.5);line-height:1.5;margin-bottom:10px;">${escapeHtml(p.description)}</div>` : ''}
        ${designColors.length || hasDesignRules ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          ${designColors.length ? `<div style="display:flex;gap:3px;">${designColors.slice(0,5).map(c => `<span style="width:16px;height:16px;border-radius:50%;background:${escapeHtml(c)};border:1px solid rgba(0,0,0,0.12);display:inline-block;"></span>`).join('')}</div>` : ''}
          ${hasDesignRules ? '<span style="font-size:10px;padding:3px 7px;background:rgba(255,140,0,0.1);color:#ff6b00;border-radius:7px;font-weight:800;">디자인 규칙</span>' : ''}
        </div>` : ''}
        ${keywords.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">${keywords.map(k => `<span style="font-size:10px;padding:2px 8px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.5);border-radius:6px;">${escapeHtml(k)}</span>`).join('')}</div>` : ''}
        <div style="display:flex;gap:6px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.04);align-items:center;">
          <button onclick="libShowEditModal(${p.id})" style="flex:1;padding:8px 12px;font-size:12px;font-weight:600;background:rgba(0,0,0,0.04);color:#1c1c1e;border:none;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;" title="편집">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          <button onclick="libSetDefault(${p.id})" style="padding:8px;font-size:12px;background:${isDefault ? 'rgba(0,122,255,0.1)' : 'rgba(0,0,0,0.04)'};color:${isDefault ? '#007aff' : 'rgba(0,0,0,0.3)'};border:none;border-radius:8px;cursor:pointer;" title="${isDefault ? '기본 프로필' : '기본으로 설정'}">
            <svg viewBox="0 0 24 24" fill="${isDefault ? '#007aff' : 'none'}" stroke="${isDefault ? '#007aff' : 'currentColor'}" stroke-width="2" style="width:14px;height:14px;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <button onclick="libDeleteProfile(${p.id})" style="padding:8px;font-size:12px;background:none;color:rgba(0,0,0,0.2);border:none;border-radius:8px;cursor:pointer;" title="삭제" onmouseenter="this.style.color='#ff3b30'" onmouseleave="this.style.color='rgba(0,0,0,0.2)'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

async function libShowEditModal(profileId) {
  const overlay = libPrepareEditModalLayout();
  _libEditingId = profileId || null;
  document.getElementById('lib-edit-id').value = _libEditingId || '';
  document.getElementById('lib-modal-title').textContent = _libEditingId ? '프로필 편집' : '프로필 추가';

  const setBtnCheck = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!val;
    el.closest('label.qs-btn')?.classList.toggle('qs-active', !!val);
  };
  const setRadioGroup = (name, value) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.checked = r.value === value;
      r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
    });
  };

  // 폼 초기화
  document.getElementById('lib-edit-name').value = '';
  document.getElementById('lib-edit-btype').value = '';
  document.getElementById('lib-btype-text').textContent = '업종을 선택하세요';
  document.getElementById('lib-btype-text').style.color = 'rgba(0,0,0,0.4)';
  document.getElementById('lib-edit-tone').value = 'mystyle';
  document.getElementById('lib-edit-desc').value = '';
  document.getElementById('lib-edit-goal').value = '';
  document.getElementById('lib-edit-contact').value = '';
  if (document.getElementById('lib-edit-website')) document.getElementById('lib-edit-website').value = '';
  if (document.getElementById('lib-edit-biz-detail')) document.getElementById('lib-edit-biz-detail').value = '';
  if (document.getElementById('lib-edit-brand-color')) document.getElementById('lib-edit-brand-color').value = '#ff8c00';
  if (document.getElementById('lib-edit-brand-color-text')) document.getElementById('lib-edit-brand-color-text').value = '#ff8c00';
  libResetDesignGuideFields();
  document.getElementById('lib-edit-keywords').value = '';
  document.getElementById('lib-edit-logo-preview').innerHTML = '<span style="font-size:24px;color:#1e3a52;">?</span>';
  document.getElementById('lib-edit-images-preview').innerHTML = '';
  document.getElementById('lib-edit-logo-file').value = '';
  document.getElementById('lib-edit-images-file').value = '';
  const chromeProfileEl = document.getElementById('lib-plat-chrome-profile');
  if (chromeProfileEl) chromeProfileEl.value = 'Default';
  document.getElementById('lib-plat-naver').value = '';
  document.getElementById('lib-plat-naver-id').value = '';
  document.getElementById('lib-plat-naver-pw').value = '';
  const crawlNaverInput = document.getElementById('lib-crawl-naver-id');
  if (crawlNaverInput) { crawlNaverInput.value = ''; crawlNaverInput.dataset.sourceValue = ''; }
  const crawlNaverLimit = document.getElementById('lib-crawl-naver-limit');
  if (crawlNaverLimit) crawlNaverLimit.value = '500';
  setBtnCheck('lib-plat-naver-on', true);
  document.getElementById('lib-plat-ig-id').value = '';
  document.getElementById('lib-plat-ig-pw').value = '';
  setBtnCheck('lib-plat-ig-on', true);
  document.getElementById('lib-plat-threads').value = '';
  document.getElementById('lib-plat-threads-user-id').value = '';
  document.getElementById('lib-plat-threads-token').value = '';
  const crawlThreadsInput = document.getElementById('lib-crawl-threads-id');
  if (crawlThreadsInput) { crawlThreadsInput.value = ''; crawlThreadsInput.dataset.sourceValue = ''; }
  const crawlThreadsLimit = document.getElementById('lib-crawl-threads-limit');
  if (crawlThreadsLimit) crawlThreadsLimit.value = '500';
  setBtnCheck('lib-plat-threads-on', true);
  document.getElementById('lib-plat-youtube').value = '';
  setBtnCheck('lib-plat-youtube-on', false);
  libUpdateYoutubeStatus('저장된 YouTube OAuth 파일로 업로드와 연결 테스트를 진행합니다.');
  document.getElementById('lib-plat-tiktok').value = '';
  setBtnCheck('lib-plat-tiktok-on', false);
  setBtnCheck('lib-plat-twitter-on', false);
  document.getElementById('lib-opt-tone').value = 'mystyle';
  document.getElementById('lib-opt-length').value = 'medium';
  document.getElementById('lib-opt-blog-images').value = '0';
  document.getElementById('lib-opt-comma').value = '50';
  document.getElementById('lib-opt-period').value = '70';
  document.getElementById('lib-opt-human').value = 'light';
  document.getElementById('lib-opt-cn-style').value = 'ai-auto';
  document.getElementById('lib-opt-cn-slides').value = '5';
  document.getElementById('lib-opt-cn-photo-count').value = '1';
  document.getElementById('lib-opt-cn-ratio').value = '1:1';
  document.getElementById('lib-opt-tts-type').value = 'gemini';
  libTtsTypeChanged('gemini');
  document.getElementById('lib-opt-voice-gemini').value = 'Kore';
  document.getElementById('lib-opt-voice-openai').value = '';
  document.getElementById('lib-opt-voice-el').value = '';
  document.getElementById('lib-opt-video-ratio').value = '9:16';
  document.getElementById('lib-opt-camera').value = 'subtle';
  document.getElementById('lib-opt-bgm').value = 'random';
  document.getElementById('lib-opt-subtitle').value = 'minimal';
  if (document.getElementById('lib-opt-subtitle-font')) document.getElementById('lib-opt-subtitle-font').value = 'nanum-square';
  document.getElementById('lib-opt-comic-panels').value = '4';
  document.getElementById('lib-opt-comic-style').value = 'cute';
  const logoInsertEl = document.getElementById('lib-opt-logo-insert');
  if (logoInsertEl) logoInsertEl.checked = false;
  const logoDetailEl = document.getElementById('lib-logo-insert-detail');
  if (logoDetailEl) logoDetailEl.style.display = 'none';
  if (document.getElementById('lib-bgm-mood')) document.getElementById('lib-bgm-mood').value = 'calm piano';
  if (document.getElementById('lib-bgm-bpm')) document.getElementById('lib-bgm-bpm').value = '90';
  if (document.getElementById('lib-bgm-duration')) document.getElementById('lib-bgm-duration').value = 'auto';
  setRadioGroup('lib-bgm-mode', 'random');
  setBtnCheck('lib-gen-blog', true);
  setBtnCheck('lib-gen-cardnews', true);
  setBtnCheck('lib-gen-comic', false);
  setBtnCheck('lib-gen-sns', true);
  setBtnCheck('lib-gen-video-slide', true);
  setBtnCheck('lib-gen-video-veo', false);
  setBtnCheck('lib-gen-detail-page', false);
  setRadioGroup('lib-image-type', 'cardnews');
  setRadioGroup('lib-video-type', 'slide');
  setRadioGroup('lib-upload-naver', 'blog');
  setRadioGroup('lib-upload-ig-feed', 'cardnews');
  setRadioGroup('lib-upload-ig-reels', 'none');
  setRadioGroup('lib-upload-ig-story', 'none');
  setRadioGroup('lib-upload-threads', 'text');
  setRadioGroup('lib-upload-twitter', 'text');
  setRadioGroup('lib-upload-yt', 'none');
  setRadioGroup('lib-upload-tiktok', 'none');
  libBindCrawlDefaultInputs();
  libBindDesignGuideAutosave();

  // 모달 먼저 표시 (빠른 반응)
  const targetOverlay = overlay || document.getElementById('libEditModal');
  targetOverlay.classList.add('show');
  targetOverlay.style.display = 'flex';
  libSwitchTab('info', document.getElementById('lib-tab-info'));
  // 자막 미리보기 초기화
  setTimeout(() => libPreviewSubtitle(), 100);

  if (_libEditingId) {
    try {
      const p = await api(`/api/library/profiles/${_libEditingId}`);
      document.getElementById('lib-edit-name').value = p.name || '';
      document.getElementById('lib-edit-btype').value = p.business_type || '';
      if (p.business_type) {
        document.getElementById('lib-btype-text').textContent = p.business_type;
        document.getElementById('lib-btype-text').style.color = '#1c1c1e';
      }
      document.getElementById('lib-edit-tone').value = 'mystyle';
      document.getElementById('lib-edit-desc').value = p.description || '';
      document.getElementById('lib-edit-goal').value = p.business_goal || '';
      document.getElementById('lib-edit-contact').value = p.contact_info || '';
      if (document.getElementById('lib-edit-website')) document.getElementById('lib-edit-website').value = p.website || '';
      if (document.getElementById('lib-edit-biz-detail')) document.getElementById('lib-edit-biz-detail').value = p.biz_detail || '';
      const bc = p.brand_color || '';
      if (document.getElementById('lib-edit-brand-color')) document.getElementById('lib-edit-brand-color').value = bc;
      if (document.getElementById('lib-edit-brand-color-text')) document.getElementById('lib-edit-brand-color-text').value = bc;
      libLoadDesignGuideFields(p);
      document.getElementById('lib-edit-keywords').value = p.keywords || '';

      // 플랫폼 계정 로드
      try {
        const pa = p.platform_accounts ? (typeof p.platform_accounts === 'string' ? JSON.parse(p.platform_accounts) : p.platform_accounts) : {};
        const chromeSel = document.getElementById('lib-plat-chrome-profile');
        if (chromeSel) {
          chromeSel.dataset.preferredProfile = 'Default';
          chromeSel.value = 'Default';
        }
        document.getElementById('lib-plat-naver').value = pa.naver || '';
        document.getElementById('lib-plat-naver-id').value = pa.naver_id || '';
        document.getElementById('lib-plat-naver-pw').value = pa.naver_pw || '';
        setBtnCheck('lib-plat-naver-on', pa.naver_on !== false);
        document.getElementById('lib-plat-ig-id').value = pa.instagram_id || '';
        document.getElementById('lib-plat-ig-pw').value = pa.instagram_pw || '';
        setBtnCheck('lib-plat-ig-on', pa.instagram_on !== false);
        document.getElementById('lib-plat-threads').value = pa.threads || '';
        document.getElementById('lib-plat-threads-user-id').value = pa.threads_user_id || '';
        document.getElementById('lib-plat-threads-token').value = pa.threads_access_token || '';
        setBtnCheck('lib-plat-threads-on', pa.threads_on !== false);
        document.getElementById('lib-plat-youtube').value = pa.youtube || '';
        setBtnCheck('lib-plat-youtube-on', pa.youtube_on || false);
        if (pa.youtube) {
          libUpdateYoutubeStatus('프로필에 저장된 YouTube OAuth 파일 경로가 연결되어 있습니다.', pa.youtube_on ? '#34c759' : 'rgba(0,0,0,0.45)');
        }
        document.getElementById('lib-plat-tiktok').value = pa.tiktok || '';
        setBtnCheck('lib-plat-tiktok-on', pa.tiktok_on || false);
        setBtnCheck('lib-plat-twitter-on', pa.twitter_on || false);
        libSyncCrawlDefaultInputs(true);
        // 콘텐츠 생성 옵션
        try {
          const co = normalizeTtsOptions(p.content_options ? (typeof p.content_options === 'string' ? JSON.parse(p.content_options) : p.content_options) : {});
          document.getElementById('lib-opt-tone').value = 'mystyle';
          if (co.blog_length) document.getElementById('lib-opt-length').value = co.blog_length;
          if (co.blog_image_count !== undefined) document.getElementById('lib-opt-blog-images').value = String(co.blog_image_count);
          if (co.comma_rate !== undefined) document.getElementById('lib-opt-comma').value = String(co.comma_rate);
          if (co.period_rate !== undefined) document.getElementById('lib-opt-period').value = String(co.period_rate);
          if (co.human_level) document.getElementById('lib-opt-human').value = co.human_level;
          if (co.cn_style) document.getElementById('lib-opt-cn-style').value = co.cn_style;
          if (co.cn_slides) document.getElementById('lib-opt-cn-slides').value = co.cn_slides;
          if (co.cn_photo_count) document.getElementById('lib-opt-cn-photo-count').value = co.cn_photo_count;
          if (co.cn_ratio) document.getElementById('lib-opt-cn-ratio').value = co.cn_ratio;
          document.getElementById('lib-opt-tts-type').value = 'gemini';
          libTtsTypeChanged('gemini');
          if (co.gemini_voice) document.getElementById('lib-opt-voice-gemini').value = co.gemini_voice;
          if (co.video_ratio) document.getElementById('lib-opt-video-ratio').value = co.video_ratio;
          if (co.camera) document.getElementById('lib-opt-camera').value = co.camera;
          {
            const bgmMode = co.bgm_mode === 'selected' && co.bgm_url ? 'selected' : 'random';
            document.getElementById('lib-opt-bgm').value = bgmMode;
          }
          if (co.subtitle) document.getElementById('lib-opt-subtitle').value = co.subtitle;
          if (co.subtitle_font) { const sf = document.getElementById('lib-opt-subtitle-font'); if (sf) sf.value = co.subtitle_font; }
          if (co.comic_panels) document.getElementById('lib-opt-comic-panels').value = co.comic_panels;
          if (co.comic_style) document.getElementById('lib-opt-comic-style').value = co.comic_style;
          if (logoInsertEl) logoInsertEl.checked = !!co.logo_insert;
          if (logoDetailEl) logoDetailEl.style.display = co.logo_insert ? 'block' : 'none';
          if (co.bgm_mood) { const el = document.getElementById('lib-bgm-mood'); if (el) el.value = co.bgm_mood; }
          if (co.bgm_bpm) { const el = document.getElementById('lib-bgm-bpm'); if (el) el.value = co.bgm_bpm; }
          if (co.bgm_duration) { const el = document.getElementById('lib-bgm-duration'); if (el) el.value = co.bgm_duration; }
          setRadioGroup('lib-bgm-mode', co.bgm_mode === 'selected' && co.bgm_url ? 'selected' : 'random');
        } catch {}
        // 생성 콘텐츠 설정
        setBtnCheck('lib-gen-blog', pa.gen_blog !== false);
        setBtnCheck('lib-gen-cardnews', pa.gen_cardnews !== false);
        if (pa.image_type) document.querySelectorAll('input[name="lib-image-type"]').forEach(r => { r.checked = r.value===pa.image_type; r.closest('label.qs-btn')?.classList.toggle('qs-active',r.checked); });
        const vType = pa.gen_video_slide === false ? 'none' : 'slide';
        document.querySelectorAll('input[name="lib-video-type"]').forEach(r => { r.checked = r.value===vType; r.closest('label.qs-btn')?.classList.toggle('qs-active',r.checked); });
        setBtnCheck('lib-gen-video-slide', pa.gen_video_slide !== false);
        setBtnCheck('lib-gen-video-veo', false);
        setBtnCheck('lib-gen-detail-page', pa.gen_detail_page || false);
        setBtnCheck('lib-gen-comic', pa.gen_comic || false);
        setBtnCheck('lib-gen-sns', pa.gen_sns !== false);
        const setRadio = (name, val) => {
          if (!val) return;
          document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
            r.checked = r.value === val;
            r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
          });
        };
        setRadio('lib-upload-naver', pa.upload_naver);
        setRadio('lib-upload-ig-feed', pa.upload_ig_feed);
        setRadio('lib-upload-ig-reels', pa.upload_ig_reels);
        setRadio('lib-upload-ig-story', pa.upload_ig_story);
        setRadio('lib-upload-threads', pa.upload_threads);
        setRadio('lib-upload-twitter', pa.upload_twitter);
        setRadio('lib-upload-yt', pa.upload_youtube);
        setRadio('lib-upload-tiktok', pa.upload_tiktok);
      } catch {}

      // 기본 정보 로드 완료 — 나머지는 병렬로 로드 (모달 이미 표시됨)
      libShowStyleInfo(p);
      console.log('[Profile] writing_style:', p.writing_style ? 'exists' : 'empty');

      if (p.logo_path) {
        document.getElementById('lib-edit-logo-preview').innerHTML =
          `<img src="/api/library/image/${p.id}/${p.logo_path}" style="width:100%;height:100%;object-fit:cover;">`;
      }

      const images = JSON.parse(p.images_json || '[]');
      libRenderEditImages(p.id, images);

      // 무거운 API 호출들은 병렬로 (모달 표시를 차단하지 않음)
      Promise.all([
        Promise.resolve(),
        libLoadVectorDBStatus(),
        libLoadVectorDBArticles(),
        libLoadCategories(),
        api(`/api/library/profiles/${p.id}/design-refs`).then(drRes => {
          _libDesignRefs = (drRes.refs || []).map(f => ({ filename: f, url: `/api/library/image/${p.id}/design_refs/${f}` }));
          libRenderDesignRefGrid();
        }).catch(() => { _libDesignRefs = []; libRenderDesignRefGrid(); }),
      ]).catch(e => console.error('[libShowEditModal] 부가 데이터 로드 실패:', e));
      libAutoDetectYoutubePath();
    } catch (e) {
      toast('프로필 로딩 실패: ' + e.message, 'error');
    }
  } else {
    libAutoDetectYoutubePath();
  }
  libSyncCrawlDefaultInputs(true);
}

async function openGlobalChromeProfileSettings() {
  if (!window._globalProfileId) {
    openProfilePickerModal();
    return;
  }
  await libShowEditModal(window._globalProfileId);
  const googleTabBtn = document.getElementById('lib-tab-google');
  if (googleTabBtn) {
    libSwitchTab('google', googleTabBtn);
  }
}
window.openGlobalChromeProfileSettings = openGlobalChromeProfileSettings;

// ═══ 업종 선택 모달 ═══
const BTYPE_CATEGORIES = {
  // ── IT/SaaS/디지털 ──
  "💻 IT/SaaS": ["SaaS","PaaS","IaaS","B2B SaaS","B2C SaaS","구독형 소프트웨어","프로젝트관리 SaaS","CRM SaaS","마케팅자동화 SaaS","HR/채용 SaaS","회계/ERP SaaS","이커머스 SaaS","교육/LMS SaaS","커뮤니케이션 SaaS","AI/ML 서비스","데이터분석 SaaS","디자인 SaaS","노코드/로우코드","API 서비스","클라우드 인프라"],
  "🖥️ IT서비스": ["웹개발","앱개발","시스템통합(SI)","ERP","CRM","그룹웨어","클라우드","호스팅","도메인","서버관리","네트워크","데이터베이스","API개발","DevOps","QA/테스팅","IT아웃소싱","IT컨설팅"],
  "🤖 AI/테크": ["AI솔루션","챗봇","자연어처리(NLP)","컴퓨터비전","음성인식","추천시스템","생성형AI","AI SaaS","빅데이터","IoT","블록체인","핀테크","에듀테크","헬스테크","프롭테크","푸드테크","모빌리티"],
  "🔒 보안/인프라": ["보안솔루션","CCTV","출입통제","정보보안","개인정보보호","방화벽","백업솔루션","재해복구","모의해킹","보안컨설팅","보안관제","인증서","제로트러스트","클라우드보안"],
  "📱 디지털마케팅": ["SEO","SEM","SNS마케팅","블로그마케팅","유튜브마케팅","인플루언서마케팅","퍼포먼스마케팅","콘텐츠마케팅","이메일마케팅","바이럴마케팅","체험단","리뷰마케팅","키워드광고","디스플레이광고","리타겟팅","그로스해킹"],
  "🎨 디자인/크리에이티브": ["그래픽디자인","웹디자인","UI/UX디자인","브랜드디자인","패키지디자인","제품디자인","인테리어디자인","건축디자인","산업디자인","3D디자인","모션그래픽","일러스트","캐릭터디자인","폰트/타이포","사인/간판"],

  // ── 의료 ──
  "🏥 병·의원": ["내과","외과","가정의학과","치과","피부과","한의원","안과","정형외과","이비인후과","소아청소년과","산부인과","성형외과","정신건강의학과","비뇨의학과","신경과","신경외과","재활의학과","흉부외과","마취통증의학과","영상의학과","진단검사의학과","병리과","핵의학과","응급의학과","직업환경의학과","예방의학과","통합의학"],
  "🦷 치과세분": ["교정치과","임플란트치과","심미치과","소아치과","치주과","보철과","구강외과","치과위생"],
  "🌿 한방·대체의학": ["한방내과","한방부인과","한방소아과","한방재활의학과","침구과","사상체질과","한약방","추나요법","한방다이어트","아로마테라피","자연치유"],
  "💊 약국/건강": ["약국","한약방","건강기능식품","영양제전문","다이어트클리닉","건강검진센터","체외진단","의료기기","재활치료","물리치료","작업치료","언어치료","심리상담","놀이치료","감각통합치료"],
  "🐶 반려동물": ["동물병원","반려동물미용","반려용품점","반려동물호텔","반려동물훈련","반려동물장례","반려동물카페","수족관/어류","파충류/특수동물","반려동물사진","펫시터","펫택시","펫푸드"],

  // ── 뷰티/미용 ──
  "💇 헤어": ["미용실","남성전문헤어","붙임머리","두피관리","탈모클리닉","헤어컬러전문","파마전문","드라이전문","가발/위그"],
  "💅 네일/속눈썹": ["네일샵","젤네일","페디큐어","속눈썹연장","속눈썹펌","눈썹문신","반영구화장","아이브로우바"],
  "🧖 피부/바디": ["피부관리실","왁싱샵","태닝샵","제모전문","보톡스/필러","리프팅","피코레이저","여드름관리","안티에이징","바디관리","산후관리","림프관리"],
  "💄 메이크업/웨딩": ["메이크업샵","웨딩메이크업","셀프스튜디오","웨딩샵","웨딩드레스","웨딩홀","스드메패키지","혼주의상","웨딩플래너","허니문여행사"],

  // ── 음식 ──
  "🍚 한식": ["한식당","한정식","국밥집","칼국수/수제비","떡볶이","김밥/도시락","분식점","죽집","감자탕/뼈해장국","냉면/밀면","족발/보쌈","비빔밥","설렁탕","추어탕","순대","백반","전/파전","떡갈비","찜닭","닭볶음탕","해장국","곰탕","갈비탕","삼계탕","된장찌개전문","김치찌개전문","두부요리","장어구이","민물매운탕","산채비빔밥"],
  "🍖 고기/구이": ["삼겹살","갈비","한우전문","소고기구이","돼지고기구이","곱창/막창","양꼬치","닭갈비","오리구이","흑돼지","이베리코","숙성고기","직화구이","연탄구이","숯불구이"],
  "🐟 해산물": ["횟집","초밥","해물탕","조개구이","장어구이","전복요리","대게/킹크랩","회전초밥","생선구이","해산물뷔페","포장회","어시장"],
  "🍕 양식": ["양식당","파스타","스테이크","리조또","브런치","오믈렛","프렌치레스토랑","이탈리안","스페인음식","그리스음식","독일음식","미국음식","멕시칸","샐러드바","수프전문"],
  "🍔 패스트푸드/분식": ["햄버거","치킨","피자","핫도그","타코","샌드위치","서브웨이형","덮밥","카레","돈까스","우동","라멘","컵밥","토스트"],
  "🥟 중식/아시안": ["중식당","짜장면","짬뽕","마라탕","마라샹궈","딤섬","훠궈","양꼬치","일식당","이자카야","라멘","돈부리","우동","소바","오코노미야키","타코야키","태국음식","베트남음식","쌀국수","인도음식","커리전문","터키음식","케밥"],
  "☕ 카페": ["카페","로스터리카페","스페셜티커피","디저트카페","브런치카페","북카페","보드게임카페","고양이카페","강아지카페","작업카페","24시카페","루프탑카페","한옥카페","전통찻집","차(tea)전문","주스바","스무디"],
  "🍰 디저트/베이커리": ["베이커리","베이커리카페","케이크전문","마카롱","초콜릿","크로플","타르트","쿠키","버블티/밀크티","아이스크림","젤라토","빙수","도넛","와플","크레페","약과/한과","떡카페","팥빙수"],
  "🍺 술집/바": ["와인바","맥주집","수제맥주","포장마차","칵테일바","위스키바","막걸리집","이자카야","사케바","루프탑바","재즈바","라운지바","소주바","와인숍","양조장"],
  "🥡 배달/급식/케이터링": ["도시락전문점","밀키트","반찬가게","케이터링","단체급식","푸드트럭","배달전문","새벽배송","간편식","건강도시락","다이어트도시락","유아식단","노인식단","비건도시락"],

  // ── 운동/레저 ──
  "💪 피트니스": ["헬스장","PT스튜디오","요가원","필라테스","크로스핏","복싱","주짓수","킥복싱","무에타이","MMA","태권도","합기도","검도","유도","레슬링","체조","발레핏","바레","스트레칭전문","EMS트레이닝","재활운동"],
  "⛳ 스포츠": ["골프레슨","골프연습장","스크린골프","수영장","수영레슨","테니스","배드민턴","탁구","축구교실","풋살","농구","야구","볼링","스쿼시","사격","펜싱","승마","조정","스케이트","인라인","스키/보드"],
  "🏔️ 아웃도어/레저": ["클라이밍","사이클","러닝크루","등산동호회","캠핑","글램핑","서핑","스쿠버다이빙","프리다이빙","래프팅","번지점프","패러글라이딩","짚라인","카약","요트","낚시","ATV","사냥","트레킹","MTB"],
  "🎯 실내레저": ["방탈출","VR체험","사격장","다트","볼링","당구","바둑/체스","보드게임카페","PC방","멀티방","노래방","코인노래방","만화카페"],

  // ── 교육 ──
  "📚 입시/보습": ["영어학원","수학학원","국어학원","과학학원","사회학원","논술학원","입시컨설팅","재수종합학원","독학재수","과외","그룹과외","인터넷강의","검정고시","공무원학원","편입학원","자격증학원","토익/토플","IELTS","SAT/AP","유학원"],
  "🎨 예체능": ["음악학원","피아노","바이올린","기타","드럼","보컬","작곡","미술학원","회화","디자인","만화/애니메이션","도예","서예","사진","연기","뮤지컬","무용/댄스","발레","힙합댄스","K-POP댄스"],
  "👶 유아/아동": ["유아교육","놀이학교","어린이집","유치원","영어유치원","몬테소리","슈타이너","창의력교육","감각놀이","숲체험","체육교실","수영교실","발레교실","미술교실","음악교실","코딩교실","로봇교실","과학실험"],
  "💻 IT/직업교육": ["코딩교육","웹개발","앱개발","데이터분석","AI/머신러닝","디자인교육","영상편집","3D모델링","게임개발","블록체인","요리학원","바리스타","플라워","제과제빵","네일아트","메이크업","헤어","타투","운전학원","중장비","드론","반려동물훈련사"],
  "🌐 외국어/문화": ["중국어","일본어","스페인어","프랑스어","독일어","베트남어","태국어","러시아어","아랍어","한국어(외국인)","통번역","동시통역","문화센터","평생교육원"],

  // ── 생활서비스 ──
  "🏠 인테리어/시공": ["인테리어","리모델링","도배","장판","타일","욕실시공","주방시공","싱크대","붙박이장","조명","커튼/블라인드","벽지","페인트","몰딩","마루","목공","철거","방수공사","단열공사","확장공사"],
  "🔧 수리/설치": ["설비(수도)","설비(전기)","가스","보일러","에어컨설치","에어컨청소","열쇠/잠금장치","방충망","방범창","CCTV설치","인터폰","정수기","비데","가전수리","컴퓨터수리","핸드폰수리","시계수리"],
  "🧹 청소/세탁": ["청소업체","입주청소","이사청소","에어컨청소","매트리스청소","카페트청소","소파청소","세탁소","구두수선","가죽관리","의류수선","방충방역","소독","곰팡이제거"],
  "📦 이사/운송": ["이사업체","포장이사","원룸이사","사무실이사","장거리이사","해외이사","보관이사","택배","퀵서비스","화물운송","용달","창고보관","물류대행"],

  // ── 소매/유통 ──
  "👗 패션/잡화": ["의류매장","여성의류","남성의류","아동의류","유아의류","빅사이즈","시니어의류","정장","캐주얼","스포츠웨어","아웃도어의류","한복","교복","유니폼","작업복","속옷/란제리","양말","모자","가방","지갑","벨트","스카프","넥타이"],
  "👟 신발/액세서리": ["신발매장","운동화","구두","부츠","슬리퍼","안경원","선글라스","콘택트렌즈","시계","주얼리","귀금속","은세공","비즈공예","핸드메이드액세서리"],
  "🏪 생활소매": ["편의점","슈퍼마켓","마트","식자재마트","수산시장","축산물","과일","야채","유기농식품","건강식품점","건어물","전통시장","대형마트","창고형매장","무인매장","자판기"],
  "💐 꽃/선물": ["꽃집","화원","조화","드라이플라워","플랜테리어","식물","다육이","선물가게","기프트숍","캔들/디퓨저","향수","기념품","수공예품"],
  "📚 도서/문구": ["서점","독립서점","중고서점","전자책","문구점","화방","아트용품","사무용품","오피스용품"],
  "👶 유아/키즈": ["유아용품점","유모차","카시트","장난감","키즈카페","실내놀이터","아이돌봄","베이비시터","산후조리원","산후도우미","수유용품","이유식"],
  "💊 약국/의료용품": ["약국","한약방","의료기기","보청기","안마의자","건강측정기","혈압계","혈당계","재활보조기구","휠체어","의료소모품"],

  // ── 온라인/쇼핑몰 ──
  "🛒 온라인쇼핑몰": ["종합쇼핑몰","패션쇼핑몰","뷰티쇼핑몰","식품쇼핑몰","유아쇼핑몰","반려동물쇼핑몰","가구/인테리어몰","전자제품몰","스포츠몰","도서몰","공예/핸드메이드몰","중고거래","구독서비스","라이브커머스","소셜커머스","해외직구대행"],
  "📱 디지털커머스": ["스마트스토어","쿠팡판매자","위메프판매자","11번가","G마켓/옥션","카카오커머스","인스타마켓","블로그마켓","해외판매(아마존)","해외판매(쇼피)","해외판매(이베이)","크라우드펀딩"],

  // ── 자동차 ──
  "🚗 자동차판매": ["신차딜러","수입차딜러","중고차","중고차딜러","리스/렌트","법인차","전기차","오토바이","자전거","킥보드","특장차"],
  "🔩 자동차서비스": ["정비소","수입차정비","전기차정비","세차장","손세차","자동세차","코팅","PPF","랩핑","타이어샵","휠얼라인먼트","썬팅","블랙박스설치","네비게이션","오디오튜닝","배터리","폐차","사고수리","판금도색","유리복원","에어컨정비","검사대행"],

  // ── 부동산/건설 ──
  "🏢 부동산": ["부동산(중개)","상가중개","오피스중개","토지중개","아파트분양","오피스텔분양","상가분양","재건축/재개발","경매대행","공인중개사","부동산컨설팅","임대관리","에어비앤비관리","공유오피스","코워킹스페이스"],
  "🏗️ 건설/건축": ["건설회사","건축사무소","설계사무소","토목","조경","철골","콘크리트","방수","전기공사","소방공사","승강기","철거","리모델링","증축","신축","상업시설","공장건축","창고건축","전원주택","목조주택","컨테이너하우스","모듈러주택","조립식주택"],

  // ── 법률/금융/전문서비스 ──
  "⚖️ 법률": ["법률(변호사)","법무사","변리사","공증사무소","법률사무소","이혼전문","형사전문","민사전문","노동법전문","의료소송","교통사고","부동산분쟁","지식재산권","국제법","행정법","세법","회생/파산"],
  "💰 금융/보험": ["은행","증권","보험","생명보험","손해보험","자동차보험","보험대리점","대출","P2P금융","핀테크","가상자산","투자자문","자산관리","연금","펀드","주식","부동산투자"],
  "📊 세무/회계/컨설팅": ["세무사","회계사","감정평가사","관세사","노무사","경영컨설팅","세무컨설팅","인사컨설팅","IT컨설팅","마케팅컨설팅","브랜딩컨설팅","창업컨설팅","프랜차이즈컨설팅","수출입컨설팅","특허컨설팅","ISO인증","환경컨설팅"],

  // ── IT/디지털 (위로 이동됨) ──

  // ── 미디어/엔터테인먼트 ──
  "📸 사진/영상": ["사진관","스튜디오","셀프스튜디오","프로필사진","웨딩사진","돌사진","증명사진","상업사진","제품사진","음식사진","건축사진","항공사진","드론촬영","영상제작","유튜브제작","광고영상","기업홍보영상","교육영상","라이브방송","VR/AR콘텐츠"],
  "🎬 엔터테인먼트": ["엔터테인먼트","기획사","매니지먼트","캐스팅","모델에이전시","행사기획","공연기획","전시기획","축제기획","MC/사회","마술","페이스페인팅","벌룬아트","파티플래너"],
  "🎵 음악/공연": ["음악교습소","녹음실","리허설실","악기점","피아노조율","음향장비","조명장비","공연장","라이브클럽","버스킹","DJ","밴드","합창단","오케스트라"],

  // ── 여행/숙박 ──
  "✈️ 여행": ["여행사","패키지여행","자유여행","허니문","효도관광","수학여행","기업연수","해외여행","국내여행","크루즈","의료관광","골프투어","성지순례","배낭여행","캠핑투어","글램핑","템플스테이","농촌체험"],
  "🏨 숙박": ["호텔","모텔","리조트","펜션","민박","게스트하우스","한옥스테이","캡슐호텔","에어비앤비","공유숙박","장기숙박","레지던스","서비스드아파트","풀빌라","글램핑장","캠핑장","오토캠핑","카라반"],

  // ── 제조/도매 ──
  "🏭 제조업": ["식품제조","음료제조","화장품제조","의약품제조","건강기능식품제조","의류제조","봉제","니트","가죽","섬유","가구제조","목재","금속","플라스틱","고무","전자부품","반도체","배터리","자동차부품","기계","화학","도료","접착제","포장재","인쇄","출판"],
  "📦 도매/유통": ["식품도매","의류도매","잡화도매","전자제품도매","건축자재","인테리어자재","산업용품","공구","포장재","사무용품","농수산물도매","축산물도매","수입식품","주류도매","의료소모품","미용재료"],

  // ── 농축수산 ──
  "🌾 농업/축산": ["과수원","채소농장","화훼농장","버섯농장","인삼농장","약초농장","유기농농장","스마트팜","체험농장","축산업","한우","젖소","양돈","양계","오리","양봉","유가공","정육점"],
  "🐟 수산/양식": ["수산업","양식장","어촌체험","수산가공","건어물","젓갈","김","미역","전복","굴","새우","장어","송어","민물고기"],

  // ── 물류/운송 ──
  "🚚 물류/운송": ["택배","퀵서비스","화물운송","용달","이삿짐","항공화물","해상운송","냉장/냉동운송","위험물운송","특수운송","3PL","풀필먼트","물류센터","창고","보세창고","통관","포워딩","배송대행"],

  // ── 관공서/비영리 ──
  "🏛️ 공공/비영리": ["관공서","공공기관","공기업","지방자치단체","국공립시설","도서관","박물관","미술관","체육관","복지관","주민센터","보건소","소방서","경찰서","우체국","병무청","비영리단체","사회복지법인","재단법인","사단법인","협회","조합","NGO","종교단체"],

  // ── 기타 서비스 ──
  "🖨️ 인쇄/출판": ["인쇄소","디지털인쇄","대형출력","현수막","배너","스티커","명함","전단지","카탈로그","포장인쇄","출판사","독립출판","전자출판","자비출판"],
  "🎪 이벤트/렌탈": ["이벤트/행사","전시업체","무대설치","음향/조명","텐트/천막","렌탈업체","정수기렌탈","복합기렌탈","가전렌탈","가구렌탈","의류렌탈","한복렌탈","캠핑용품렌탈","파티용품렌탈"],
  "⚱️ 장례/상조": ["장례식장","상조회사","장묘","수목장","봉안당","장례용품","장례지도사","유품정리"],
  "🔮 점술/운세": ["역술원","사주","타로","풍수","작명소","궁합","관상","손금"],
  "🧒 돌봄/시니어": ["요양원","요양병원","주간보호","방문요양","방문간호","방문목욕","돌봄서비스","가사도우미","산후도우미","베이비시터","아이돌봄","노인대학","실버타운","시니어레저"],
};

function openBtypePicker() {
  let modal = document.getElementById('btype-picker-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'btype-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';

  let html = `
    <div style="background:#fff;border-radius:22px;padding:24px;width:92%;max-width:600px;max-height:80vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">업종 선택</h2>
        <button onclick="document.getElementById('btype-picker-modal').remove()" style="background:rgba(0,0,0,0.06);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(0,0,0,0.4);">×</button>
      </div>
      <input type="text" id="btype-search" placeholder="업종 검색 또는 직접 입력..." oninput="filterBtypePicker(this.value)" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);font-size:14px;margin-bottom:8px;background:rgba(0,0,0,0.03);">
      <div id="btype-custom-row" style="display:none;margin-bottom:10px;">
        <button id="btype-custom-btn" onclick="selectBtype(document.getElementById('btype-search').value.trim())" style="padding:8px 14px;border-radius:10px;border:1px dashed rgba(255,140,0,0.4);background:rgba(255,140,0,0.04);color:#ff8c00;font-size:13px;font-weight:600;cursor:pointer;width:100%;text-align:left;"></button>
      </div>
      <div style="overflow-y:auto;flex:1;" id="btype-picker-list">`;

  for (const [category, items] of Object.entries(BTYPE_CATEGORIES)) {
    html += `<div class="btype-cat" style="margin-bottom:14px;">
      <div style="font-size:13px;font-weight:700;color:#1c1c1e;margin-bottom:8px;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.06);">${category}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">`;
    for (const item of items) {
      const isSelected = item === document.getElementById('lib-edit-btype')?.value;
      html += `<button class="btype-item" data-name="${item}" onclick="selectBtype('${item}')"
        style="padding:6px 12px;border-radius:8px;border:1px solid ${isSelected ? 'rgba(255,140,0,0.4)' : 'rgba(0,0,0,0.08)'};background:${isSelected ? 'rgba(255,140,0,0.06)' : '#fff'};color:#1c1c1e;font-size:12px;cursor:pointer;transition:all 0.15s;"
        onmouseenter="this.style.background='rgba(255,140,0,0.04)';this.style.borderColor='rgba(255,140,0,0.3)'"
        onmouseleave="this.style.background='${isSelected ? 'rgba(255,140,0,0.06)' : '#fff'}';this.style.borderColor='${isSelected ? 'rgba(255,140,0,0.4)' : 'rgba(0,0,0,0.08)'}'">${item}</button>`;
    }
    html += `</div></div>`;
  }

  html += `</div></div>`;
  modal.innerHTML = html;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('btype-search')?.focus();
}

function filterBtypePicker(q) {
  const query = q.trim().toLowerCase();
  let exactMatch = false;
  let anyVisible = false;
  document.querySelectorAll('.btype-cat').forEach(cat => {
    let hasVisible = false;
    cat.querySelectorAll('.btype-item').forEach(item => {
      const name = (item.dataset.name || '').toLowerCase();
      const match = !query || name.includes(query);
      item.style.display = match ? '' : 'none';
      if (match) hasVisible = true;
      if (name === query) exactMatch = true;
    });
    cat.style.display = hasVisible ? '' : 'none';
    if (hasVisible) anyVisible = true;
  });
  const customRow = document.getElementById('btype-custom-row');
  const customBtn = document.getElementById('btype-custom-btn');
  if (query && !exactMatch) {
    customRow.style.display = 'block';
    customBtn.textContent = `"${q.trim()}" 직접 입력으로 사용`;
  } else {
    customRow.style.display = 'none';
  }
}

function selectBtype(value) {
  document.getElementById('lib-edit-btype').value = value;
  document.getElementById('lib-btype-text').textContent = value;
  document.getElementById('lib-btype-text').style.color = '#1c1c1e';
  document.getElementById('btype-picker-modal')?.remove();
}

// TTS 타입 변경 시 음성 선택 UI 토글
function libTtsTypeChanged(type) {
  const geminiSel = document.getElementById('lib-opt-voice-gemini');
  if (geminiSel) geminiSel.style.display = '';
  const openAiInput = document.getElementById('lib-opt-voice-openai');
  if (openAiInput) openAiInput.value = '';
  const elInput = document.getElementById('lib-opt-voice-el');
  if (elInput) elInput.value = '';
  const elWrap = document.getElementById('lib-opt-voice-el-wrap');
  if (elWrap) elWrap.style.display = 'none';
  const typeInput = document.getElementById('lib-opt-tts-type');
  if (typeInput) typeInput.value = 'gemini';
}

function libPickYoutubeFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = () => {
    if (input.files[0]) {
      document.getElementById('lib-plat-youtube').value = input.files[0].path || input.files[0].name;
      libUpdateYoutubeStatus('선택한 YouTube OAuth 파일 경로를 저장할 수 있습니다.', '#ff0000');
    }
  };
  input.click();
}

function libGetYoutubePath() {
  return document.getElementById('lib-plat-youtube')?.value?.trim() || '';
}

function libClearYoutubeConnection() {
  const input = document.getElementById('lib-plat-youtube');
  if (input) input.value = '';
  setBtnCheck('lib-plat-youtube-on', false);
  libUpdateYoutubeStatus('유튜브 연결 정보를 비웠습니다. 저장하면 프로필에서도 제거됩니다.', '#ff3b30');
}

function libUpdateYoutubeStatus(message, color = 'rgba(0,0,0,0.45)') {
  const el = document.getElementById('lib-plat-youtube-status');
  if (!el) return;
  el.textContent = message || '';
  el.style.color = color;
}

async function libAutoDetectYoutubePath(force = false) {
  const input = document.getElementById('lib-plat-youtube');
  if (!input) return '';
  if (input.value.trim() && !force) return input.value.trim();
  try {
    const res = await api('/api/upload/youtube/test', {
      method: 'POST',
      body: { detect_only: true, profile_id: parseInt(_libEditingId || 0, 10) || 0 },
    });
    if (res?.client_secrets_path) {
      input.value = res.client_secrets_path;
      if (res.token_exists) {
        libUpdateYoutubeStatus('YouTube OAuth 파일과 토큰을 찾았습니다. 바로 테스트하거나 업로드할 수 있습니다.', '#34c759');
      } else {
        libUpdateYoutubeStatus('YouTube OAuth 파일을 찾았습니다. 연결 테스트를 눌러 인증 상태를 확인하세요.', '#ff9500');
      }
      return res.client_secrets_path;
    }
  } catch {}
  libUpdateYoutubeStatus('YouTube OAuth 파일을 아직 찾지 못했습니다. 파일 선택으로 직접 지정할 수 있습니다.');
  return '';
}

async function libTestYoutubeConnection() {
  const btn = event?.target?.closest('button');
  const path = libGetYoutubePath() || await libAutoDetectYoutubePath();
  if (!path) {
    toast('YouTube OAuth 파일 경로를 먼저 지정하세요', 'error');
    return;
  }
  const original = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '확인 중...';
  }
  libUpdateYoutubeStatus('YouTube 연결 상태를 확인하는 중입니다...', '#ff9500');
  try {
    const res = await api('/api/upload/youtube/test', {
      method: 'POST',
      body: {
        profile_id: parseInt(_libEditingId || 0, 10) || 0,
        client_secrets_path: path,
      },
    });
    if (res.connected) {
      const msg = res.channel_title ? `연결 완료. 채널: ${res.channel_title}` : '연결 완료. 업로드 테스트를 진행할 수 있습니다.';
      libUpdateYoutubeStatus(msg, '#34c759');
      const toggle = document.getElementById('lib-plat-youtube-on');
      if (toggle) toggle.checked = true;
      toast('유튜브 연결 확인 완료');
    } else if (res.requires_auth) {
      libUpdateYoutubeStatus('브라우저 인증이 필요합니다. 인증을 마친 뒤 다시 테스트하세요.', '#ff9500');
      toast('유튜브 인증이 필요합니다', 'error');
    } else {
      libUpdateYoutubeStatus(res.message || '유튜브 연결 확인에 실패했습니다.', '#ff3b30');
      toast(res.message || '유튜브 연결 실패', 'error');
    }
  } catch (e) {
    libUpdateYoutubeStatus(`연결 실패: ${e.message}`, '#ff3b30');
    toast('유튜브 연결 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || '연결 테스트';
    }
  }
}

async function libLinkMyStyle() {
  try {
    const styleData = await api('/api/style');
    if (!styleData || !styleData.tone) {
      toast('먼저 "스타일 글쓰기 > 스타일 분석"에서 글쓰기 스타일을 분석하세요', 'error');
      return;
    }
    // 프로필에 바로 저장
    if (_libEditingId) {
      const nextBundle = { ...(_libCurrentStyleBundle || {}) };
      nextBundle.blog = styleData;
      await api(`/api/library/profiles/${_libEditingId}`, {
        method: 'PUT',
        body: { writing_style: JSON.stringify(libBuildWritingStylePayload(nextBundle)) },
      });
      _libCurrentStyleBundle = nextBundle;
    }
    const styleStatus = document.getElementById('lib-edit-style-status');
    styleStatus.style.background = 'rgba(48,209,88,0.08)';
    styleStatus.style.color = '#30d158';
    styleStatus.textContent = `${styleData.tone} · ${styleData.sentence_style || ''} · ${(styleData.expressions||[]).slice(0,2).join(', ')}`;
    toast('내 스타일이 프로필에 연결되었습니다!');
  } catch (e) {
    toast('스타일 연결 실패: ' + e.message, 'error');
  }
}

// ═══ YouTube Audio Library 검색+다운로드 ═══
async function libExtractBgmFromYt() {
  const url = document.getElementById('lib-bgm-yt-url')?.value?.trim();
  if (!url) { toast('YouTube URL을 입력하세요', 'error'); return; }
  const btn = document.getElementById('lib-bgm-extract-btn');
  const status = document.getElementById('lib-bgm-extract-status');
  btn.disabled = true;
  btn.textContent = '추출 중...';
  if (status) status.textContent = '오디오를 다운로드하고 있습니다... (최대 2분)';
  try {
    const res = await api('/api/video/extract-bgm', { method: 'POST', body: { url } });
    if (status) status.innerHTML = `<span style="color:#34c759;">✅ ${res.title || ''} — ${res.duration || ''} (${Math.round(res.size/1024)}KB)</span>`;
    toast(`BGM 추출 완료: ${res.filename}`);
    document.getElementById('lib-bgm-yt-url').value = '';
    libLoadBgmList();
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:#ff3b30;">❌ ${e.message}</span>`;
    toast('BGM 추출 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '추출';
  }
}

function libYtAudioSearch() {
  const section = document.getElementById('lib-yt-audio-section');
  section.style.display = section.style.display === 'none' ? '' : 'none';
  if (section.style.display !== 'none') document.getElementById('lib-yt-audio-query').focus();
}

function libYtAudioQuick(query) {
  document.getElementById('lib-yt-audio-query').value = query;
  libYtAudioDoSearch();
}

async function libYtAudioDoSearch() {
  const query = document.getElementById('lib-yt-audio-query')?.value?.trim();
  if (!query) { toast('검색어를 입력하세요', 'error'); return; }
  const btn = document.getElementById('lib-yt-audio-btn');
  const results = document.getElementById('lib-yt-audio-results');
  btn.disabled = true; btn.textContent = '검색 중...';
  results.innerHTML = '<div style="text-align:center;padding:12px;"><span class="spinner"></span></div>';
  try {
    const res = await api('/api/bgm/youtube-search', { method: 'POST', body: { query: 'youtube audio library ' + query + ' no copyright free' } });
    const items = res.results || [];
    if (!items.length) { results.innerHTML = '<div style="text-align:center;padding:12px;color:rgba(0,0,0,0.3);font-size:12px;">결과 없음</div>'; return; }
    results.innerHTML = items.map((item, idx) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border-bottom:1px solid rgba(0,0,0,0.04);">
        <img src="${item.thumbnail}" style="width:48px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:500;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.title)}</div>
          <div style="font-size:9px;color:rgba(0,0,0,0.3);">${item.duration || ''} · ${escapeHtml(item.channel || '')}</div>
        </div>
        <button onclick="libBgmPreviewYt('${item.url}',this)" style="padding:4px 8px;font-size:10px;background:rgba(0,122,255,0.08);color:#007aff;border:1px solid rgba(0,122,255,0.15);border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;flex-shrink:0;">▶ 미리듣기</button>
        <button onclick="libYtAudioDownload('${item.url}','${escapeHtml(item.title).replace(/'/g,"\\'").substring(0,40)}')" style="padding:4px 10px;font-size:10px;background:#ff0000;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;flex-shrink:0;">다운로드</button>
      </div>
    `).join('');
  } catch (e) { results.innerHTML = `<div style="color:#ff3b30;font-size:12px;padding:8px;">${e.message}</div>`; }
  finally { btn.disabled = false; btn.textContent = '검색'; }
}

async function libYtAudioDownload(url, title) {
  const pid = _libEditingId || window._globalProfileId || 0;
  // 버튼을 "다운로드 중..."으로 변경
  const btn = event?.target;
  if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...'; btn.style.background = '#ff9500'; }
  const status = document.getElementById('lib-yt-audio-status');
  status.textContent = `"${title.substring(0,25)}..." 다운로드 중...`;
  status.style.color = '#ff9500';
  try {
    const res = await api('/api/bgm/youtube-download', { method: 'POST', body: { url, name: title, profile_id: pid } });
    if (res.status === 'ok') {
      toast(`"${title.substring(0,25)}" 추가 완료!`);
      if (btn) { btn.textContent = '완료 ✓'; btn.style.background = '#34c759'; }
      status.textContent = '추가 완료!';
      status.style.color = '#34c759';
      libLoadBgmList();
    }
  } catch (e) {
    if (btn) { btn.textContent = '실패'; btn.style.background = '#ff3b30'; }
    status.textContent = '실패: ' + e.message;
    status.style.color = '#ff3b30';
  }
  // 3초 후 버튼 복구
  setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '다운로드'; btn.style.background = '#ff0000'; } }, 3000);
}

// ═══ Lyria AI 음악 생성 ═══
async function libLyriaGenerate() {
  let modal = document.getElementById('lyria-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'lyria-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:480px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 6px;">Lyria AI 음악 생성</h3>
      <p style="font-size:11px;color:rgba(0,0,0,0.4);margin-bottom:14px;">Google Lyria로 BGM을 생성합니다</p>

      <!-- 장르 프리셋 -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:6px;">장르 프리셋</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;" id="lyria-presets">
          <button onclick="lyriaPreset('calm piano, soft ambient')" class="qs-btn qs-active" style="font-size:10px;padding:4px 10px;cursor:pointer;">잔잔한 피아노</button>
          <button onclick="lyriaPreset('acoustic guitar, warm folk')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">어쿠스틱</button>
          <button onclick="lyriaPreset('lo-fi hip hop, chill beats')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">로파이</button>
          <button onclick="lyriaPreset('cafe jazz, smooth bossa nova')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">카페 재즈</button>
          <button onclick="lyriaPreset('upbeat pop, cheerful bright')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">경쾌한 팝</button>
          <button onclick="lyriaPreset('corporate uplifting, inspiring')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">기업 홍보</button>
          <button onclick="lyriaPreset('electronic dance, energetic')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">일렉트로닉</button>
          <button onclick="lyriaPreset('cinematic emotional, orchestral')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">시네마틱</button>
          <button onclick="lyriaPreset('classical piano concerto')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">클래식</button>
          <button onclick="lyriaPreset('kids playful, xylophone cute')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">키즈</button>
          <button onclick="lyriaPreset('cooking show, light ukulele')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">쿠킹</button>
          <button onclick="lyriaPreset('nature ambient, birds water')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">자연/힐링</button>
          <button onclick="lyriaPreset('minimal techno, deep house')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">테크노</button>
          <button onclick="lyriaPreset('r&b smooth, soulful groove')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">R&B</button>
          <button onclick="lyriaPreset('reggae relaxing, tropical')" class="qs-btn" style="font-size:10px;padding:4px 10px;cursor:pointer;">레게</button>
        </div>
      </div>

      <!-- 직접 입력 -->
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">스타일 직접 입력</div>
        <input type="text" id="lyria-prompt" value="calm piano, soft ambient" style="width:100%;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.12);">
      </div>

      <!-- 상세 옵션 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">BPM (빠르기)</div>
          <select id="lyria-bpm" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="60">매우 느림 (60)</option>
            <option value="70">느림 (70)</option>
            <option value="80">약간 느림 (80)</option>
            <option value="90" selected>보통 (90)</option>
            <option value="100">약간 빠름 (100)</option>
            <option value="110">빠름 (110)</option>
            <option value="120">매우 빠름 (120)</option>
            <option value="140">격렬 (140)</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">길이</div>
          <select id="lyria-duration" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="auto" selected>영상에 맞게</option>
            <option value="30">30초</option>
            <option value="60">1분</option>
            <option value="120">2분</option>
            <option value="180">3분</option>
            <option value="300">5분</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">창의성</div>
          <select id="lyria-temp" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="0.5">낮음 (안정적)</option>
            <option value="0.8">보통</option>
            <option value="1.0" selected>높음 (다양한)</option>
            <option value="1.5">매우 높음</option>
          </select>
        </div>
      </div>

      <!-- 악기/분위기 태그 -->
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:6px;">악기 추가 (클릭하면 프롬프트에 추가)</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;">
          <button onclick="lyriaAddTag('piano')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">피아노</button>
          <button onclick="lyriaAddTag('guitar')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">기타</button>
          <button onclick="lyriaAddTag('strings')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">현악기</button>
          <button onclick="lyriaAddTag('drums')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">드럼</button>
          <button onclick="lyriaAddTag('bass')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">베이스</button>
          <button onclick="lyriaAddTag('synth')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">신스</button>
          <button onclick="lyriaAddTag('flute')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">플루트</button>
          <button onclick="lyriaAddTag('saxophone')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">색소폰</button>
          <button onclick="lyriaAddTag('ukulele')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">우쿨렐레</button>
          <button onclick="lyriaAddTag('violin')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">바이올린</button>
          <button onclick="lyriaAddTag('trumpet')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">트럼펫</button>
          <button onclick="lyriaAddTag('xylophone')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">실로폰</button>
          <button onclick="lyriaAddTag('harp')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">하프</button>
          <button onclick="lyriaAddTag('orchestra')" class="qs-btn" style="font-size:9px;padding:3px 8px;cursor:pointer;">오케스트라</button>
        </div>
      </div>
      <div id="lyria-progress" style="display:none;padding:12px;text-align:center;">
        <span class="spinner"></span>
        <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,0.4);">음악 생성 중...</div>
      </div>
      <div id="lyria-result" style="display:none;margin-bottom:12px;">
        <audio id="lyria-audio" controls style="width:100%;height:36px;"></audio>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('lyria-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">닫기</button>
        <button onclick="libLyriaDoGenerate()" id="lyria-gen-btn" style="padding:8px 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">생성 후 라이브러리에 저장</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('lyria-prompt').focus();
}

function lyriaPreset(text) {
  document.getElementById('lyria-prompt').value = text;
  document.querySelectorAll('#lyria-presets .qs-btn').forEach(b => b.classList.remove('qs-active'));
  event.target.classList.add('qs-active');
}

function lyriaAddTag(tag) {
  const input = document.getElementById('lyria-prompt');
  const val = input.value.trim();
  if (!val.includes(tag)) {
    input.value = val ? val + ', ' + tag : tag;
  }
  event.target.classList.toggle('qs-active');
}

async function libLyriaDoGenerate() {
  const prompt = document.getElementById('lyria-prompt')?.value?.trim();
  if (!prompt) { toast('음악 스타일을 입력하세요', 'error'); return; }
  const bpm = parseInt(document.getElementById('lyria-bpm')?.value || '90');
  const temperature = parseFloat(document.getElementById('lyria-temp')?.value || '1.0');
  let duration = document.getElementById('lyria-duration')?.value || '60';
  if (duration === 'auto') {
    // 카드뉴스 장수 x 슬라이드당 ~8초 + 여유 5초
    const slides = parseInt(getOpt('cn_slides', '5'));
    duration = slides * 8 + 5;
  } else {
    duration = parseInt(duration);
  }
  const btn = document.getElementById('lyria-gen-btn');
  btn.disabled = true; btn.textContent = '생성 중...';
  document.getElementById('lyria-progress').style.display = '';
  try {
    const res = await api('/api/bgm/lyria-generate', {
      method: 'POST',
      body: { prompt, bpm, duration, temperature, profile_id: parseInt(_libEditingId || window._globalProfileId || 0) }
    });
    if (res.audio_url) {
      document.getElementById('lyria-result').style.display = '';
      document.getElementById('lyria-audio').src = res.audio_url;
      toast('Lyria BGM 생성 완료! 라이브러리에 저장됨');
      libLoadBgmList();
    } else {
      toast(res.message || '생성 실패', 'error');
    }
  } catch (e) { toast('생성 실패: ' + e.message, 'error'); }
  finally {
    btn.disabled = false; btn.textContent = '생성 후 라이브러리에 저장';
    document.getElementById('lyria-progress').style.display = 'none';
  }
}

// ═══ 프로필 BGM 라이브러리 ═══
async function libLoadBgmList() {
  const container = document.getElementById('lib-bgm-list');
  if (!container) return;
  const pid = _libEditingId || window._globalProfileId || 0;
  try {
    const res = await api(`/api/bgm/list?profile_id=${pid}`);
    const files = res.files || [];
    if (!files.length) {
      container.innerHTML = '<div style="text-align:center;color:rgba(0,0,0,0.25);font-size:12px;padding:12px;">BGM이 없습니다. 아래 버튼으로 추가하세요</div>';
      return;
    }
    // 현재 선택된 BGM URL
    const _co = _libEditingId ? (JSON.parse((await api(`/api/library/profiles/${_libEditingId}`)).content_options || '{}')) : (window._contentOpts || {});
    const selectedUrl = _co.bgm_url || '';

    container.innerHTML = files.map(f => {
      const fileUrl = `/api/bgm/file/${f.path}?profile_id=${pid}`;
      const isSelected = selectedUrl && (selectedUrl.includes(f.path) || selectedUrl.includes(f.name));
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);${isSelected ? 'background:rgba(255,140,0,0.06);border-radius:6px;padding:6px 8px;' : ''}">
        <button onclick="libPlayBgm('${f.path}')" style="width:28px;height:28px;border-radius:50%;background:${isSelected ? 'rgba(255,140,0,0.15)' : 'rgba(0,0,0,0.04)'};border:none;cursor:pointer;font-size:12px;flex-shrink:0;">▶</button>
        <span style="flex:1;font-size:11px;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>
        <span style="font-size:9px;color:rgba(0,0,0,0.2);flex-shrink:0;">${Math.round(f.size/1024)}KB</span>
        <button onclick="libSelectBgm('${f.path}','${escapeHtml(f.name)}')" style="padding:3px 8px;font-size:9px;font-weight:600;background:${isSelected ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.04)'};color:${isSelected ? '#fff' : 'rgba(0,0,0,0.4)'};border:${isSelected ? 'none' : '1px solid rgba(0,0,0,0.08)'};border-radius:5px;cursor:pointer;flex-shrink:0;">${isSelected ? '선택됨 ✓' : '선택'}</button>
        <button onclick="libDeleteBgm('${f.path}')" style="border:none;background:none;color:rgba(255,59,48,0.4);cursor:pointer;font-size:14px;flex-shrink:0;">&times;</button>
      </div>`;
    }).join('');
  } catch { container.innerHTML = '<div style="color:rgba(0,0,0,0.3);font-size:12px;padding:8px;">목록 로드 실패</div>'; }
}

function libSelectBgm(path, name) {
  const pid = _libEditingId || window._globalProfileId || 0;
  const url = `/api/bgm/file/${path}?profile_id=${pid}`;
  // content_options에 bgm_url 저장
  if (window._contentOpts) {
    window._contentOpts.bgm_url = url;
    window._contentOpts.bgm = 'selected';
    window._contentOpts.bgm_mode = 'selected';
  }
  const bgmSelect = document.getElementById('lib-opt-bgm');
  if (bgmSelect) bgmSelect.value = 'selected';
  document.querySelectorAll('input[name="lib-bgm-mode"]').forEach(r => {
    r.checked = r.value === 'selected';
    r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
  });
  toast(`BGM 선택: ${name}`);
  libLoadBgmList(); // 리렌더
}

function libBgmPreviewYt(ytUrl, btn) {
  // YouTube 영상을 iframe으로 미리듣기
  let preview = document.getElementById('lib-bgm-yt-preview');
  if (preview) preview.remove();
  const videoId = ytUrl.match(/[?&]v=([^&]+)/)?.[1] || ytUrl.match(/youtu\.be\/([^?]+)/)?.[1] || '';
  if (!videoId) { toast('유효한 YouTube URL이 아닙니다', 'error'); return; }
  preview = document.createElement('div');
  preview.id = 'lib-bgm-yt-preview';
  preview.style.cssText = 'margin-top:8px;border-radius:8px;overflow:hidden;position:relative;';
  preview.innerHTML = `
    <iframe width="100%" height="80" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="autoplay" style="border-radius:8px;"></iframe>
    <button onclick="this.parentElement.remove()" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:12px;cursor:pointer;line-height:20px;">✕</button>
  `;
  btn.closest('div').after(preview);
}

function libPlayBgm(path) {
  let audio = document.getElementById('lib-bgm-player');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'lib-bgm-player';
    audio.controls = true;
    audio.style.cssText = 'width:100%;height:32px;margin-top:8px;';
    document.getElementById('lib-bgm-list').after(audio);
  }
  const pid = _libEditingId || window._globalProfileId || 0;
  audio.src = `/api/bgm/file/${path}?profile_id=${pid}`;
  audio.play();
}

async function libDeleteBgm(path) {
  if (!confirm('이 BGM을 삭제할까요?')) return;
  try {
    const pid = _libEditingId || window._globalProfileId || 0;
    await api(`/api/bgm/delete/${path}?profile_id=${pid}`, { method: 'DELETE' });
    toast('BGM 삭제됨');
    libLoadBgmList();
  } catch {}
}

// ═══ 프로필 편집 탭 전환 ═══
function libSwitchTab(tab, btn) {
  ['info','design','opts','style','google','platform','upload','bgm','media'].forEach(t => {
    const p = document.getElementById('lib-panel-' + t);
    if (p) p.style.display = t === tab ? '' : 'none';
  });
  const optsEditor = document.getElementById('lib-panel-opts-editor');
  if (optsEditor) optsEditor.style.display = tab === 'opts' ? '' : 'none';
  if (tab === 'bgm') libLoadBgmList();
  if (tab === 'style') libRefreshTestModelBanner();
  if (btn) {
    btn.closest('div').querySelectorAll('.lib-tab').forEach(b => {
      b.style.background = 'transparent'; b.style.color = 'rgba(0,0,0,0.35)'; b.style.boxShadow = 'none';
    });
    btn.style.background = '#fff'; btn.style.color = '#1c1c1e'; btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
  }
}

// ═══ 프로필 내 글쓰기 스타일 관리 ═══
function libShowStyleInfo(profile) {
  const info = document.getElementById('lib-style-info');
  const editBtn = document.getElementById('lib-style-edit-btn');
  const saveBtn = document.getElementById('lib-style-save-btn');
  const cancelBtn = document.getElementById('lib-style-cancel-btn');
  const removeBtn = document.getElementById('lib-style-remove-btn');
  if (!info) return;
  if (profile && profile.writing_style) {
    try {
      const raw = typeof profile.writing_style === 'string' ? JSON.parse(profile.writing_style) : profile.writing_style;
      const bundle = libNormalizeStyleBundle(raw);
      const sd = libGetStyleForPlatform(bundle, _libStylePlatform);
      if (sd && sd.tone) {
        _libCurrentStyleBundle = bundle;
        _libCurrentStyleData = {
          tone: sd.tone || '',
          sentence_style: sd.sentence_style || '',
          ending_style: sd.ending_style || '',
          expressions: Array.isArray(sd.expressions) ? sd.expressions : [],
          connector_words: Array.isArray(sd.connector_words) ? sd.connector_words : [],
          opening_pattern: sd.opening_pattern || '',
          closing_pattern: sd.closing_pattern || '',
          unique_features: Array.isArray(sd.unique_features) ? sd.unique_features : [],
          sample_sentences: Array.isArray(sd.sample_sentences) ? sd.sample_sentences : [],
        };
        if (_libStyleEditMode) {
          libRenderStyleEditor();
          if (removeBtn) removeBtn.style.display = 'none';
          if (editBtn) editBtn.style.display = 'none';
          if (saveBtn) saveBtn.style.display = '';
          if (cancelBtn) cancelBtn.style.display = '';
          return;
        }
        info.style.color = '#1c1c1e';
        const lines = [
          `<strong style="font-size:14px;">${escapeHtml(sd.tone)}</strong>`,
          `<span style="display:inline-flex;width:max-content;font-size:10px;padding:3px 8px;border-radius:999px;background:${_libStylePlatform === 'blog' ? 'rgba(255,140,0,0.12);color:#ff8c00' : 'rgba(88,86,214,0.12);color:#5856d6'};">${libStylePlatformLabel(_libStylePlatform)}용 스타일</span>`
        ];
        if (sd.sentence_style) lines.push(`<span style="color:rgba(0,0,0,0.5);">문장: ${escapeHtml(sd.sentence_style)}</span>`);
        if (sd.ending_style) lines.push(`<span style="color:rgba(0,0,0,0.5);">끝맺음: ${escapeHtml(sd.ending_style)}</span>`);
        if (sd.expressions?.length) lines.push(`<span style="color:rgba(0,0,0,0.5);">표현: ${sd.expressions.slice(0,6).map(e=>escapeHtml(e)).join(', ')}</span>`);
        if (sd.connector_words?.length) lines.push(`<span style="color:rgba(0,0,0,0.5);">연결어: ${sd.connector_words.slice(0,5).join(', ')}</span>`);
        if (sd.opening_pattern) lines.push(`<span style="color:rgba(0,0,0,0.5);">시작: ${escapeHtml(sd.opening_pattern)}</span>`);
        if (sd.closing_pattern) lines.push(`<span style="color:rgba(0,0,0,0.5);">마무리: ${escapeHtml(sd.closing_pattern)}</span>`);
        if (sd.unique_features?.length) lines.push(`<span style="color:rgba(0,0,0,0.5);">특징: ${sd.unique_features.slice(0,3).map(e=>escapeHtml(e)).join(' / ')}</span>`);
        if (sd.sample_sentences?.length) lines.push(`<span style="color:rgba(0,0,0,0.35);font-size:11px;font-style:italic;">예시: "${escapeHtml(sd.sample_sentences[0].substring(0,60))}"</span>`);
        info.innerHTML = lines.join('<br>');
        if (editBtn) editBtn.style.display = '';
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = '';
        return;
      }
    } catch {}
  }
  _libCurrentStyleData = null;
  _libCurrentStyleBundle = profile && profile.writing_style
    ? libNormalizeStyleBundle(typeof profile.writing_style === 'string' ? JSON.parse(profile.writing_style) : profile.writing_style)
    : null;
  _libStyleEditMode = false;
  info.style.color = 'rgba(0,0,0,0.35)';
  info.innerHTML = `${libStylePlatformLabel(_libStylePlatform)}용 스타일이 아직 없습니다`;
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = 'none';
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (removeBtn) removeBtn.style.display = _libCurrentStyleBundle ? '' : 'none';
  libRefreshStylePlatformTabs();
}

function libStyleListToText(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function libStyleTextToList(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function libStylePlatformLabel(platform) {
  return platform === 'threads' ? '스레드' : '블로그';
}

function libNormalizeStyleBundle(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const bundle = {};
  if (src.blog && typeof src.blog === 'object') bundle.blog = src.blog;
  if (src.threads && typeof src.threads === 'object') bundle.threads = src.threads;
  if (src.twitter && typeof src.twitter === 'object') bundle.twitter = src.twitter;
  const hasPlatformBuckets = !!(bundle.blog || bundle.threads || bundle.twitter);
  if (!hasPlatformBuckets && src.tone) bundle.blog = src;
  return bundle;
}

function libGetStyleForPlatform(bundle, platform) {
  if (!bundle || typeof bundle !== 'object') return null;
  if (platform === 'threads') return bundle.threads || bundle.twitter || null;
  return bundle.blog || null;
}

function libBuildWritingStylePayload(bundle) {
  const next = bundle && typeof bundle === 'object' ? { ...bundle } : {};
  const blogStyle = next.blog && typeof next.blog === 'object' ? next.blog : null;
  const payload = {
    blog: blogStyle || null,
    threads: next.threads || null,
    twitter: next.twitter || next.threads || null,
  };
  if (blogStyle && blogStyle.tone) {
    Object.assign(payload, blogStyle);
  }
  return payload;
}

function libRefreshStylePlatformTabs() {
  const blogBtn = document.getElementById('lib-style-tab-blog');
  const threadsBtn = document.getElementById('lib-style-tab-threads');
  const setState = (btn, active, accent) => {
    if (!btn) return;
    btn.style.background = active ? (accent === 'orange' ? 'rgba(255,140,0,0.12)' : 'rgba(88,86,214,0.12)') : 'rgba(0,0,0,0.06)';
    btn.style.color = active ? (accent === 'orange' ? '#ff8c00' : '#5856d6') : 'rgba(0,0,0,0.55)';
    btn.style.fontWeight = active ? '700' : '600';
  };
  setState(blogBtn, _libStylePlatform === 'blog', 'orange');
  setState(threadsBtn, _libStylePlatform === 'threads', 'purple');
  const note = document.getElementById('lib-style-platform-note');
  if (note) {
    note.textContent = _libStylePlatform === 'threads'
      ? '현재: 스레드 스타일 분석 · 스레드/X 글 생성에 적용됩니다.'
      : '현재: 블로그 스타일 분석 · 블로그/카드뉴스/만화/내레이션에 적용됩니다.';
  }
}

function libSetStylePlatform(platform) {
  _libStylePlatform = platform === 'threads' ? 'threads' : 'blog';
  _libStyleEditMode = false;
  libRefreshStylePlatformTabs();
  if (_libCurrentStyleBundle) {
    libShowStyleInfo({ writing_style: libBuildWritingStylePayload(_libCurrentStyleBundle) });
  } else {
    libShowStyleInfo(null);
  }
}

function libRenderStyleEditor() {
  const info = document.getElementById('lib-style-info');
  if (!info || !_libCurrentStyleData) return;
  const sd = _libCurrentStyleData;
  info.style.color = '#1c1c1e';
  info.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      <div style="grid-column:1/-1;">
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">톤</div>
        <textarea id="lib-style-edit-tone" rows="2" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(sd.tone || '')}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">문장</div>
        <textarea id="lib-style-edit-sentence" rows="4" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(sd.sentence_style || '')}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">끝맺음</div>
        <textarea id="lib-style-edit-ending" rows="4" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(sd.ending_style || '')}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">자주 쓰는 표현</div>
        <textarea id="lib-style-edit-expressions" rows="4" placeholder="쉼표로 구분" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(libStyleListToText(sd.expressions))}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">연결어</div>
        <textarea id="lib-style-edit-connectors" rows="4" placeholder="쉼표로 구분" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(libStyleListToText(sd.connector_words))}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">시작 방식</div>
        <textarea id="lib-style-edit-opening" rows="4" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(sd.opening_pattern || '')}</textarea>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">마무리 방식</div>
        <textarea id="lib-style-edit-closing" rows="4" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(sd.closing_pattern || '')}</textarea>
      </div>
      <div style="grid-column:1/-1;">
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">특징</div>
        <textarea id="lib-style-edit-features" rows="4" placeholder="쉼표로 구분" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml(libStyleListToText(sd.unique_features))}</textarea>
      </div>
      <div style="grid-column:1/-1;">
        <div style="font-size:11px;font-weight:700;color:#5856d6;margin-bottom:4px;">예시 문장</div>
        <textarea id="lib-style-edit-samples" rows="5" placeholder="한 줄에 한 문장" style="width:100%;padding:10px 12px;border:1px solid rgba(88,86,214,0.18);border-radius:10px;background:#fff;resize:vertical;box-sizing:border-box;font-size:12px;line-height:1.55;">${escapeHtml((sd.sample_sentences || []).join('\n'))}</textarea>
      </div>
    </div>`;
}

function libEditStyle() {
  if (!_libCurrentStyleData) {
    toast('먼저 스타일을 분석하거나 생성하세요', 'error');
    return;
  }
  _libStyleEditMode = true;
  libRenderStyleEditor();
  const editBtn = document.getElementById('lib-style-edit-btn');
  const saveBtn = document.getElementById('lib-style-save-btn');
  const cancelBtn = document.getElementById('lib-style-cancel-btn');
  const removeBtn = document.getElementById('lib-style-remove-btn');
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
  if (cancelBtn) cancelBtn.style.display = '';
  if (removeBtn) removeBtn.style.display = 'none';
}

function libCancelStyleEdit() {
  _libStyleEditMode = false;
  if (_libCurrentStyleData) {
    libShowStyleInfo({ writing_style: _libCurrentStyleData });
  } else {
    libShowStyleInfo(null);
  }
}

async function libSaveStyleEdit() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }
  const styleData = {
    tone: document.getElementById('lib-style-edit-tone')?.value?.trim() || '',
    sentence_style: document.getElementById('lib-style-edit-sentence')?.value?.trim() || '',
    ending_style: document.getElementById('lib-style-edit-ending')?.value?.trim() || '',
    expressions: libStyleTextToList(document.getElementById('lib-style-edit-expressions')?.value),
    connector_words: libStyleTextToList(document.getElementById('lib-style-edit-connectors')?.value),
    opening_pattern: document.getElementById('lib-style-edit-opening')?.value?.trim() || '',
    closing_pattern: document.getElementById('lib-style-edit-closing')?.value?.trim() || '',
    unique_features: libStyleTextToList(document.getElementById('lib-style-edit-features')?.value),
    sample_sentences: String(document.getElementById('lib-style-edit-samples')?.value || '').split('\n').map(v => v.trim()).filter(Boolean),
  };
  if (!styleData.tone) {
    toast('톤은 비워둘 수 없습니다', 'error');
    return;
  }
  const saveBtn = document.getElementById('lib-style-save-btn');
  const prev = saveBtn ? saveBtn.textContent : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
  }
  try {
    const nextBundle = { ...(_libCurrentStyleBundle || {}) };
    nextBundle[_libStylePlatform] = styleData;
    if (_libStylePlatform === 'threads' && !nextBundle.twitter) nextBundle.twitter = styleData;
    const payload = libBuildWritingStylePayload(nextBundle);
    await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body: { writing_style: JSON.stringify(payload) } });
    _libCurrentStyleBundle = nextBundle;
    _libCurrentStyleData = styleData;
    _libStyleEditMode = false;
    libShowStyleInfo({ writing_style: payload });
    toast('글쓰기 스타일이 저장되었습니다');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = prev || '저장';
    }
  }
}

// ═══ 벡터DB 문체 학습 ═══
async function libLoadVectorDBStatus() {
  if (!_libEditingId) return;
  try {
    const res = await api(`/api/articles/profile/${_libEditingId}`);
    const counts = res.counts || {};
    const total = counts.total || 0;
    document.getElementById('lib-vdb-count').textContent = total;
    const pct = Math.min(100, Math.round(total / 100 * 100));
    document.getElementById('lib-vdb-bar-fill').style.width = pct + '%';
    document.getElementById('lib-vdb-bar-fill').style.background = pct >= 100 ? '#34c759' : '#ff8c00';
    const parts = [];
    if (counts.blog) parts.push(`블로그 ${counts.blog}`);
    if (counts.threads) parts.push(`스레드 ${counts.threads}`);
    if (counts.twitter) parts.push(`트위터 ${counts.twitter}`);
    const detail = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
    document.getElementById('lib-vdb-status-text').textContent =
      total >= 100 ? `문체 학습 활성${detail} · 1,000개 이상 권장` : `${total}/100 청크${detail} (${Math.max(0, 100 - total)}개 더 필요)`;
  } catch (e) {
    console.error('[VDB] 조회 실패:', e);
    document.getElementById('lib-vdb-count').textContent = '0';
    document.getElementById('lib-vdb-status-text').textContent = '아직 수집된 글이 없습니다';
  }
}

function libShowVectorDBCrawlProgress(platform, savedCount = 0, foundCount = 0) {
  const totalEl = document.getElementById('lib-vdb-count');
  const barEl = document.getElementById('lib-vdb-bar-fill');
  const statusEl = document.getElementById('lib-vdb-status-text');
  if (totalEl) totalEl.textContent = String(savedCount || 0);
  if (barEl) {
    const pct = Math.min(100, Math.round((savedCount || 0) / 100 * 100));
    barEl.style.width = pct + '%';
    barEl.style.background = '#ff8c00';
  }
  if (statusEl) {
    const label = platform === 'threads' ? '스레드' : '블로그';
    if (foundCount > 0) {
      statusEl.textContent = `${label} 수집 중 · 저장 ${savedCount || 0}개 / 발견 ${foundCount}개`;
    } else {
      statusEl.textContent = `${label} 수집 중 · 저장 ${savedCount || 0}개`;
    }
  }
}

function libReadCrawlLimit(inputId, fallback = 500) {
  const raw = document.getElementById(inputId)?.value;
  const parsed = parseInt(String(raw || fallback), 10);
  return Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : fallback, 5000));
}

async function libCrawlNaverBlog() {
  const blogId = document.getElementById('lib-crawl-naver-id')?.value?.trim()
    || document.getElementById('lib-plat-naver')?.value?.trim();
  const maxPosts = libReadCrawlLimit('lib-crawl-naver-limit', 500);
  if (!blogId) { toast('네이버 블로그 ID를 먼저 입력하세요', 'error'); return; }
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }

  const btn = document.getElementById('lib-crawl-naver-btn');
  btn.disabled = true; btn.textContent = '수집 중...';
  const log = document.getElementById('lib-crawl-log');
  log.style.display = 'block'; log.innerHTML = `<div>네이버 블로그 "${blogId}" 수집 시작...</div>`;

  try {
    const res = await fetch(`/api/articles/profile/${_libEditingId}/naver-blog`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({blog_id: blogId, max_posts: maxPosts}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || '수집 실패');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let count = 0;
    let buffer = '';
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const data = JSON.parse(trimmed.substring(5).trim());
          if (data.status === 'ok') {
            count = Math.max(count + 1, data.saved || data.current || count + 1);
            libShowVectorDBCrawlProgress('blog', data.saved || data.current || count, data.total || 0);
            log.innerHTML += `<div style="color:#34c759;">+${data.current || count} ${data.title?.substring(0,40) || ''}</div>`;
            log.scrollTop = log.scrollHeight;
          } else if (data.status === 'progress') {
            if (data.saved || data.skipped) count = Math.max(count, data.saved || data.skipped || 0);
            libShowVectorDBCrawlProgress('blog', data.saved || count, data.total || 0);
            log.innerHTML += `<div style="color:#ff8c00;">${data.message || ''}</div>`;
            log.scrollTop = log.scrollHeight;
          } else if (data.status === 'done') {
            count = Math.max(count, data.total || data.crawled || count);
            libShowVectorDBCrawlProgress('blog', count, data.found || data.total || 0);
            log.innerHTML += `<div style="color:#007aff;font-weight:600;">수집 완료! 저장 ${count}개${data.skipped ? ` · 기존 ${data.skipped}개 건너뜀` : ''}${data.failed ? ` · 실패 ${data.failed}개` : ''}</div>`;
          } else if (data.status === 'error') {
            log.innerHTML += `<div style="color:#ff3b30;">실패: ${data.message || ''}</div>`;
          }
        } catch {}
      }
    }
      toast(`네이버 블로그 저장 글 ${count}개 확인 완료!`);
    libLoadVectorDBStatus();
    libLoadVectorDBArticles();
    libNotifyResearchSync(_libEditingId, 'naver', blogId);
  } catch (e) {
    toast('수집 실패: ' + e.message, 'error');
    log.innerHTML += `<div style="color:#ff3b30;">오류: ${e.message}</div>`;
    log.innerHTML += `<div style="color:#ff8c00;">이미 저장된 글은 보존됩니다. 다시 누르면 저장된 글은 건너뛰고 남은 글부터 이어서 수집합니다.</div>`;
  }
  btn.disabled = false; btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><text x="1" y="10" font-size="10" font-weight="900" fill="#fff">N</text></svg>블로그 수집';
}

async function libCrawlThreads() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }

  // 스레드 계정 확인
  let threadsId = document.getElementById('lib-crawl-threads-id')?.value?.trim()
    || document.getElementById('lib-plat-threads')?.value?.trim()
    || '';
  const maxPosts = libReadCrawlLimit('lib-crawl-threads-limit', 500);
  if (!threadsId) {
    toast('플랫폼 탭에서 스레드 계정을 먼저 입력하세요', 'error');
    return;
  }

  const btn = document.getElementById('lib-crawl-threads-btn');
  btn.disabled = true; btn.textContent = '확장으로 수집 중...';
  const log = document.getElementById('lib-crawl-log');
  log.style.display = 'block';
  log.innerHTML = `<div style="color:#ff8c00;font-weight:700;">스레드 글 수집은 Chrome 확장 프로그램 연결이 필수입니다.</div><div>Chrome 확장 브릿지로 @${threadsId} 스레드 화면을 수집합니다...</div>`;

  try {
    const res = await fetch(`/api/articles/profile/${_libEditingId}/threads-chrome`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: threadsId, max_posts: maxPosts }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || '수집 실패');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let count = 0;
    let buffer = '';
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        try {
          const data = JSON.parse(trimmed.substring(5).trim());
          if (data.status === 'ok') {
            count++;
            libShowVectorDBCrawlProgress('threads', data.current || count, data.total || 0);
            log.innerHTML += `<div style="color:#34c759;">+${count} ${(data.title || '').substring(0,40)}</div>`;
            log.scrollTop = log.scrollHeight;
          } else if (data.status === 'progress') {
            libShowVectorDBCrawlProgress('threads', count, data.current || data.total || 0);
            log.innerHTML += `<div style="color:#ff8c00;">${data.message || ''}</div>`;
            log.scrollTop = log.scrollHeight;
          } else if (data.status === 'done') {
            libShowVectorDBCrawlProgress('threads', data.crawled || data.total || count, data.collected || data.total || 0);
            const total = data.total || data.crawled || count || 0;
            if (total > 0) {
              log.innerHTML += `<div style="color:#007aff;font-weight:600;">수집 완료! 총 ${total}개</div>`;
            } else {
              log.innerHTML += `<div style="color:#ff9500;font-weight:600;">수집된 글이 없습니다.</div>`;
            }
            if (data.message) log.innerHTML += `<div style="color:rgba(0,0,0,0.45);">${escapeHtml(data.message)}</div>`;
            if (total > 0) {
              toast(`스레드 ${total}개 글 수집 완료!`);
              libNotifyResearchSync(_libEditingId, 'threads', threadsId);
            }
          } else if (data.status === 'blocked') {
            log.innerHTML += `<div style="color:#ff9500;font-weight:700;">수집 시작 안 됨</div>`;
            log.innerHTML += `<div style="color:rgba(0,0,0,0.55);">${escapeHtml(data.message || '')}</div>`;
            if (data.extension_path) {
              log.innerHTML += `<div style="color:rgba(0,0,0,0.35);word-break:break-all;">확장 폴더: ${escapeHtml(data.extension_path)}</div>`;
            }
            log.innerHTML += `<div style="margin-top:8px;"><button type="button" onclick="navigateToPage('settings');setTimeout(()=>switchUnifiedSettingsTab && switchUnifiedSettingsTab('general'),100)" style="padding:7px 12px;border:none;border-radius:8px;background:#ff8c00;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">설정에서 Chrome 확장 연결</button></div>`;
            toast('Chrome 확장 연결이 필요합니다.', 'error');
          } else if (data.status === 'error') {
            log.innerHTML += `<div style="color:#ff3b30;">실패: ${data.message || ''}</div>`;
            log.scrollTop = log.scrollHeight;
          }
        } catch {}
      }
    }
    libLoadVectorDBStatus();
    libLoadVectorDBArticles();
  } catch (e) {
    log.innerHTML += `<div style="color:#ff3b30;">실패: ${e.message}</div>`;
    toast('스레드 수집 실패: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '@ 스레드 수집';
}

async function libResetVectorDB() {
  if (!_libEditingId) return;
  if (!confirm('이 프로필의 학습 데이터를 모두 삭제할까요?')) return;
  try {
    await api(`/api/articles/profile/${_libEditingId}/reset`, { method: 'DELETE' });
    toast('학습 데이터 초기화 완료');
    libLoadVectorDBStatus();
  } catch (e) {
    toast('초기화 실패: ' + e.message, 'error');
  }
}

function libProfileTextValue(id) {
  return String(document.getElementById(id)?.value || '').trim();
}

async function libRefreshTestModelBanner(force = false) {
  const labelEl = document.getElementById('lib-test-model-label');
  const fallback = { label: '글: 설정값 확인 중  /  이미지: 설정값 확인 중' };
  try {
    const setting = typeof window.mkkLoadImageModelSetting === 'function'
      ? await window.mkkLoadImageModelSetting(force)
      : fallback;
    if (labelEl) labelEl.textContent = setting.label || fallback.label;
    return setting;
  } catch (e) {
    if (labelEl) labelEl.textContent = '모델 설정 확인 실패';
    return fallback;
  }
}

function libModelMetaLabel(meta, fallbackSetting) {
  const fallback = fallbackSetting?.label || '글: 설정값  /  이미지: 설정값';
  if (!meta || typeof meta !== 'object') return fallback;
  const textProvider = String(meta.text_provider || '').trim();
  const textModel = String(meta.text_model || '').trim();
  const imageProvider = String(meta.image_provider || '').trim();
  const imageModel = String(meta.image_model || '').trim();
  if (!textProvider && !textModel && !imageProvider && !imageModel) return fallback;
  return `글: ${textProvider || '설정'} · ${textModel || '설정값'}  /  이미지: ${imageProvider || '설정'} · ${imageModel || '설정값'}`;
}

function libBuildStyleTestContentRequest(topic) {
  const brandName = libProfileTextValue('lib-edit-name') || window._globalProfileData?.name || '';
  const businessType = libProfileTextValue('lib-edit-btype');
  const description = libProfileTextValue('lib-edit-desc');
  const bizDetail = libProfileTextValue('lib-edit-biz-detail');
  const keywords = libProfileTextValue('lib-edit-keywords');
  const brandDescription = [businessType, description, bizDetail, keywords ? `키워드: ${keywords}` : '']
    .filter(Boolean)
    .join('\n');
  return {
    keyword: topic,
    selected_sources: [],
    scraped_texts: [topic],
    brand_name: brandName,
    brand_description: brandDescription,
    brand_color: libProfileTextValue('lib-edit-brand-color') || '#ff8c00',
    brand_logo_url: '',
    logo_insert: false,
    contact_info: libProfileTextValue('lib-edit-contact'),
    user_image_urls: [],
    generate_blog: true,
    generate_cardnews: false,
    generate_video: false,
    generate_sns: false,
    tone: 'mystyle',
    blog_length: 'short',
    threads_length: 'medium',
    threads_mode: 'auto',
    twitter_length: 'short',
    comma_rate: parseInt(libProfileTextValue('lib-opt-comma') || '50', 10) || 50,
    period_rate: parseInt(libProfileTextValue('lib-opt-period') || '70', 10) || 70,
    human_level: libProfileTextValue('lib-opt-human') || 'light',
    include_cta: false,
    business_goal: libProfileTextValue('lib-edit-goal'),
    cta_text: '',
    profile_id: parseInt(_libEditingId || 0, 10) || 0,
    blog_image_count: 0,
    text_provider: '',
    image_provider: '',
    image_model: '',
    seo: false,
    source: 'profile_style_test',
  };
}

async function libTestGenerate(type) {
  const topic = document.getElementById('lib-test-topic')?.value?.trim();
  if (!topic) { toast('테스트 주제를 입력하세요', 'error'); return; }
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }

  const resultDiv = document.getElementById('lib-test-result');
  const labelEl = document.getElementById('lib-test-label');
  const contentEl = document.getElementById('lib-test-content');
  resultDiv.style.display = 'block';
  contentEl.textContent = '생성 중...';
  const modelSetting = await libRefreshTestModelBanner(true);

  try {
    if (type === 'blog') {
      labelEl.textContent = '블로그 테스트';
      const res = await api('/api/content/generate', {
        method: 'POST',
        body: libBuildStyleTestContentRequest(topic),
      });
      const blog = res.blog || {};
      const title = String(blog.title || '').trim();
      const body = String(blog.body || blog.content || '').trim();
      const modelLabel = libModelMetaLabel(res.meta, modelSetting);
      contentEl.innerHTML = `
        <div style="font-size:11px;font-weight:800;color:#ff8c00;margin-bottom:8px;">${escapeHtml(modelLabel)}</div>
        ${title ? `<div style="font-size:14px;font-weight:900;margin-bottom:8px;">${escapeHtml(title)}</div>` : ''}
        <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.7;">${escapeHtml(body || blog.error || '생성 실패')}</div>`;
    } else {
      labelEl.textContent = '스레드 + 트위터 + 캡션 테스트';
      const snsBody = { topic, source_text: topic, profile_id: _libEditingId, text_provider: '', tone: 'mystyle' };
      const [threadsRes, twitterRes, captionRes] = await Promise.all([
        api('/api/content/generate-sns', { method: 'POST', body: { ...snsBody, platform: 'threads' } }),
        api('/api/content/generate-sns', { method: 'POST', body: { ...snsBody, platform: 'twitter' } }),
        api('/api/content/generate-ig-caption', { method: 'POST', body: { keyword: topic, title: topic, content: topic, profile_id: _libEditingId, text_provider: '', tone: 'mystyle' } }),
      ]);
      const modelLabel = libModelMetaLabel(threadsRes.meta || twitterRes.meta || captionRes.meta, modelSetting);
      contentEl.innerHTML = `
        <div style="font-size:11px;font-weight:800;color:#ff8c00;margin-bottom:8px;">${escapeHtml(modelLabel)}</div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:#833ab4;margin-bottom:4px;">@ 스레드</div>
          <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.6;">${escapeHtml(threadsRes.text || '실패')}</div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:#1da1f2;margin-bottom:4px;">𝕏 트위터 <span style="font-weight:400;color:rgba(0,0,0,0.3);">(${(twitterRes.text||'').length}자)</span></div>
          <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.6;">${escapeHtml(twitterRes.text || '실패')}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:#e1306c;margin-bottom:4px;">📷 인스타 캡션</div>
          <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.6;">${escapeHtml(captionRes.caption || '실패')}</div>
        </div>`;
    }
  } catch (e) {
    contentEl.textContent = '생성 실패: ' + e.message;
  }
}

async function libAddManualArticle() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }
  const title = document.getElementById('lib-vdb-manual-title')?.value?.trim();
  const content = document.getElementById('lib-vdb-manual-content')?.value?.trim();
  if (!content || content.length < 30) { toast('본문을 30자 이상 입력하세요', 'error'); return; }
  try {
    await api(`/api/articles/profile/${_libEditingId}/manual`, { method: 'POST', body: { title: title || '직접 입력', content } });
    document.getElementById('lib-vdb-manual-title').value = '';
    document.getElementById('lib-vdb-manual-content').value = '';
    toast('글 추가 완료!');
    libLoadVectorDBStatus();
    libLoadVectorDBArticles();
  } catch (e) {
    toast('추가 실패: ' + e.message, 'error');
  }
}

let _libVdbArticles = [];
let _libVdbPage = 0;
const _libVdbPageSize = 10;

async function libLoadVectorDBArticles() {
  if (!_libEditingId) return;
  const container = document.getElementById('lib-vdb-articles');
  if (!container) return;
  container.innerHTML = '<div style="padding:12px;text-align:center;color:rgba(0,0,0,0.3);font-size:11px;">로딩 중...</div>';
  try {
    const res = await api(`/api/articles/profile/${_libEditingId}`);
    _libVdbArticles = res.articles || [];
    _libVdbPage = 0;
    libRenderVdbPage();
  } catch (e) {
    container.innerHTML = `<div style="padding:12px;color:#ff3b30;font-size:11px;">로드 실패: ${e.message}</div>`;
  }
}

function libRenderVdbPage() {
  const container = document.getElementById('lib-vdb-articles');
  if (!container) return;
  const articles = _libVdbArticles;
  if (articles.length === 0) {
    container.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(0,0,0,0.25);font-size:11px;">저장된 글이 없습니다</div>';
    return;
  }
  const totalPages = Math.ceil(articles.length / _libVdbPageSize);
  const start = _libVdbPage * _libVdbPageSize;
  const pageItems = articles.slice(start, start + _libVdbPageSize);

  let html = pageItems.map(a => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:11px;">
      <span style="padding:2px 6px;border-radius:4px;background:${a.source==='naver-chrome'?'rgba(3,199,90,0.1);color:#03c75a':String(a.source||'').includes('threads') || a.platform==='threads'?'rgba(0,0,0,0.06);color:#1c1c1e':'rgba(0,122,255,0.1);color:#007aff'};font-size:9px;white-space:nowrap;">${a.source || 'manual'}</span>
      <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1c1c1e;font-weight:500;">${escapeHtml(a.title || a.preview?.substring(0,40) || '')}</div>
      <span style="color:rgba(0,0,0,0.3);white-space:nowrap;">${a.chunk_count}청크</span>
      <button onclick="libReadVDBArticle('${a.id}')" style="padding:2px 6px;font-size:9px;background:rgba(0,122,255,0.08);color:#007aff;border:none;border-radius:4px;cursor:pointer;">읽기</button>
      <button onclick="libDeleteVDBArticle('${a.id}')" style="padding:2px 6px;font-size:9px;background:rgba(255,59,48,0.08);color:#ff3b30;border:none;border-radius:4px;cursor:pointer;">삭제</button>
    </div>
  `).join('');

  // 페이징
  if (totalPages > 1) {
    html += `<div style="display:flex;justify-content:center;align-items:center;gap:8px;padding:10px;font-size:11px;">
      <button onclick="_libVdbPage=0;libRenderVdbPage()" ${_libVdbPage===0?'disabled':''} style="padding:3px 8px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:4px;cursor:pointer;${_libVdbPage===0?'opacity:0.3;':''}">처음</button>
      <button onclick="_libVdbPage--;libRenderVdbPage()" ${_libVdbPage===0?'disabled':''} style="padding:3px 8px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:4px;cursor:pointer;${_libVdbPage===0?'opacity:0.3;':''}">이전</button>
      <span style="color:rgba(0,0,0,0.5);font-weight:600;">${_libVdbPage+1} / ${totalPages}</span>
      <span style="color:rgba(0,0,0,0.3);">(${articles.length}개)</span>
      <button onclick="_libVdbPage++;libRenderVdbPage()" ${_libVdbPage>=totalPages-1?'disabled':''} style="padding:3px 8px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:4px;cursor:pointer;${_libVdbPage>=totalPages-1?'opacity:0.3;':''}">다음</button>
      <button onclick="_libVdbPage=${totalPages-1};libRenderVdbPage()" ${_libVdbPage>=totalPages-1?'disabled':''} style="padding:3px 8px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:4px;cursor:pointer;${_libVdbPage>=totalPages-1?'opacity:0.3;':''}">마지막</button>
    </div>`;
  }

  container.innerHTML = html;
}

async function libReadVDBArticle(articleId) {
  try {
    const article = await api(`/api/articles/${articleId}`);
    libShowVDBArticleModal(article);
  } catch (e) {
    toast('글 불러오기 실패: ' + e.message, 'error');
  }
}

function libShowVDBArticleModal(article) {
  const old = document.getElementById('lib-vdb-read-modal');
  if (old) old.remove();
  const title = article.title || '저장된 글';
  const meta = [
    article.platform ? `플랫폼: ${article.platform}` : '',
    article.source ? `출처: ${article.source}` : '',
    article.account ? `계정: ${article.account}` : '',
    article.text_length ? `${article.text_length}자` : '',
  ].filter(Boolean).join(' · ');
  const postUrl = article.post_url ? `<a href="${escapeHtml(article.post_url)}" target="_blank" style="color:#007aff;text-decoration:none;font-weight:600;">원문 열기</a>` : '';
  const modal = document.createElement('div');
  modal.id = 'lib-vdb-read-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100030;background:rgba(0,0,0,0.34);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
  modal.innerHTML = `
    <div style="width:min(820px,100%);max-height:86vh;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;">
      <div style="display:flex;align-items:flex-start;gap:14px;padding:18px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:800;color:#1c1c1e;line-height:1.35;word-break:break-word;">${escapeHtml(title)}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-top:6px;line-height:1.5;">${escapeHtml(meta)} ${postUrl ? ` · ${postUrl}` : ''}</div>
        </div>
        <button type="button" onclick="document.getElementById('lib-vdb-read-modal')?.remove()" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(0,0,0,0.06);color:rgba(0,0,0,0.45);font-size:18px;cursor:pointer;flex-shrink:0;">×</button>
      </div>
      <div style="padding:20px;overflow:auto;white-space:pre-wrap;font-size:13px;line-height:1.8;color:#1c1c1e;word-break:break-word;">${escapeHtml(article.content || '')}</div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function libDeleteVDBArticle(articleId) {
  if (!_libEditingId) return;
  try {
    await api(`/api/articles/${articleId}`, { method: 'DELETE' });
    toast('삭제 완료');
    libLoadVectorDBStatus();
    libLoadVectorDBArticles();
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

async function libCreateStyleAI() {
  const name = document.getElementById('lib-edit-name')?.value?.trim() || '프로필';
  const label = libStylePlatformLabel(_libStylePlatform);
  const desc = await showInputModal('AI 스타일 생성', `"${name}" 프로필의 ${label} 스타일을 설명하세요`, '친근하고 전문적인 톤, 짧은 문장 위주');
  if (!desc) return;
  toast('AI가 스타일을 생성 중...');
  try {
    const res = await api('/api/writing-styles/ai-create', { method: 'POST', body: { name: `${name} ${label} 스타일`, description: desc } });
    if (res.warning) toast(res.warning);
    if (_libEditingId && res.style_data) {
      const nextBundle = { ...(_libCurrentStyleBundle || {}) };
      nextBundle[_libStylePlatform] = res.style_data;
      if (_libStylePlatform === 'threads' && !nextBundle.twitter) nextBundle.twitter = res.style_data;
      const payload = libBuildWritingStylePayload(nextBundle);
      await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body: { writing_style: JSON.stringify(payload) } });
      toast('스타일이 프로필에 저장되었습니다!');
      _libStyleEditMode = false;
      _libCurrentStyleBundle = nextBundle;
      libShowStyleInfo({ writing_style: payload });
    }
  } catch (e) { toast('생성 실패: ' + e.message, 'error'); }
}

async function libCreateStylePaste() {
  const name = document.getElementById('lib-edit-name')?.value?.trim() || '프로필';
  let modal = document.getElementById('lib-style-paste-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'lib-style-paste-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:500px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 8px;">글 붙여넣어 스타일 분석</h3>
      <p style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:12px;">평소 쓰는 글이나 복사해온 참고 글을 붙여넣으세요</p>
      <textarea id="lib-style-paste-text" rows="8" placeholder="여기에 글을 붙여넣으세요... (최소 50자)" style="width:100%;font-size:13px;margin-bottom:12px;"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('lib-style-paste-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
        <button onclick="libAnalyzeStyleFromPaste()" id="lib-style-paste-btn" style="padding:8px 16px;background:#ff8c00;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">분석하여 저장</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('lib-style-paste-text').focus();
}

async function libAnalyzeStyleFromPaste() {
  const text = document.getElementById('lib-style-paste-text')?.value?.trim();
  if (!text || text.length < 50) { toast('최소 50자 이상 입력하세요', 'error'); return; }
  const name = document.getElementById('lib-edit-name')?.value?.trim() || '프로필';
  const btn = document.getElementById('lib-style-paste-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 분석 중...';
  try {
    const label = libStylePlatformLabel(_libStylePlatform);
    const res = await api('/api/writing-styles/analyze-create', { method: 'POST', body: { name: `${name} ${label} 스타일`, sample_text: text } });
    if (res.warning) toast(res.warning);
    if (_libEditingId && res.style_data) {
      const nextBundle = { ...(_libCurrentStyleBundle || {}) };
      nextBundle[_libStylePlatform] = res.style_data;
      if (_libStylePlatform === 'threads' && !nextBundle.twitter) nextBundle.twitter = res.style_data;
      const payload = libBuildWritingStylePayload(nextBundle);
      await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body: { writing_style: JSON.stringify(payload) } });
      toast('스타일이 프로필에 저장되었습니다!');
      _libStyleEditMode = false;
      _libCurrentStyleBundle = nextBundle;
      libShowStyleInfo({ writing_style: payload });
    }
    document.getElementById('lib-style-paste-modal')?.remove();
  } catch (e) { toast('분석 실패: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '분석하여 저장'; }
}

async function libCreateStyleFromCollected() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }
  const name = document.getElementById('lib-edit-name')?.value?.trim() || '프로필';
  const label = libStylePlatformLabel(_libStylePlatform);
  const info = document.getElementById('lib-style-info');
  const buttons = Array.from(document.querySelectorAll('#lib-panel-style button'));
  const triggerBtn = document.getElementById('lib-style-collected-btn') || buttons.find(btn => (btn.textContent || '').includes('수집된 글로 분석'));
  toast(`수집된 ${label} 글로 스타일을 분석하는 중...`);
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.dataset.prevText = triggerBtn.textContent;
    triggerBtn.textContent = `${label} 분석 중...`;
    triggerBtn.style.opacity = '0.6';
  }
  if (info) {
    info.style.color = '#007aff';
    info.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px;"><span class="spinner" style="width:14px;height:14px;"></span>${label} 수집 글을 읽고 스타일을 분석하고 있습니다...</span>`;
  }
  try {
    const sample = await api(`/api/articles/profile/${_libEditingId}/style-text?platform=${encodeURIComponent(_libStylePlatform)}`);
    const text = sample.sample_text || '';
    if (!text || text.length < 50) {
      throw new Error(`${label} 스타일을 분석할 수집 글이 부족합니다.`);
    }
    const res = await api('/api/writing-styles/analyze-create', { method: 'POST', body: { name: `${name} ${label} 스타일`, sample_text: text } });
    if (res.warning) toast(res.warning);
    if (_libEditingId && res.style_data) {
      const nextBundle = { ...(_libCurrentStyleBundle || {}) };
      nextBundle[_libStylePlatform] = res.style_data;
      if (_libStylePlatform === 'threads' && !nextBundle.twitter) nextBundle.twitter = res.style_data;
      const payload = libBuildWritingStylePayload(nextBundle);
      await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body: { writing_style: JSON.stringify(payload) } });
      toast('스타일이 프로필에 저장되었습니다!');
      _libStyleEditMode = false;
      _libCurrentStyleBundle = nextBundle;
      libShowStyleInfo({ writing_style: payload });
    }
  } catch (e) { toast('분석 실패: ' + e.message, 'error'); }
  finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = triggerBtn.dataset.prevText || '현재 탭 수집글 분석';
      triggerBtn.style.opacity = '1';
      delete triggerBtn.dataset.prevText;
    }
  }
}

async function libRemoveStyle() {
  if (!_libEditingId) return;
  const label = libStylePlatformLabel(_libStylePlatform);
  if (!confirm(`이 프로필의 ${label} 스타일을 삭제할까요?`)) return;
  const nextBundle = { ...(_libCurrentStyleBundle || {}) };
  delete nextBundle[_libStylePlatform];
  if (_libStylePlatform === 'threads') delete nextBundle.twitter;
  const hasAny = Object.keys(nextBundle).length > 0;
  await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body: { writing_style: hasAny ? JSON.stringify(libBuildWritingStylePayload(nextBundle)) : '{}' } });
  toast('스타일이 삭제되었습니다');
  _libCurrentStyleBundle = hasAny ? nextBundle : null;
  _libCurrentStyleData = null;
  _libStyleEditMode = false;
  libShowStyleInfo(hasAny ? { writing_style: libBuildWritingStylePayload(nextBundle) } : null);
}

function libPreviewSubtitle() {
  const style = document.getElementById('lib-opt-subtitle')?.value || 'minimal';
  const font = document.getElementById('lib-opt-subtitle-font')?.value || 'nanum-square';
  const preview = document.getElementById('lib-subtitle-preview-text');
  if (!preview) return;

  const fontMap = {
    'apple-gothic': "'Apple SD Gothic Neo', sans-serif",
    'nanum-square': "'NanumSquare', 'Apple SD Gothic Neo', sans-serif",
    'nanum-gothic': "'NanumGothic', 'Apple SD Gothic Neo', sans-serif",
    'pretendard': "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  };
  const fontFamily = fontMap[font] || fontMap['nanum-square'];

  const styles = {
    promo: { text: '핵심 키워드 강조', size: '22px', color: '#00e676', shadow: '2px 2px 8px rgba(0,0,0,0.8)', bg: '', border: '' },
    minimal: { text: '깔끔한 자막 스타일', size: '16px', color: '#ffffff', shadow: '', bg: '', border: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' },
    news: { text: '뉴스 자막 스타일', size: '16px', color: '#ffffff', shadow: '', bg: 'rgba(0,0,0,0.75)', border: '' },
    pop: { text: '팝 스타일 자막!', size: '24px', color: '#ffff00', shadow: '3px 3px 6px rgba(0,0,0,0.9)', bg: '', border: '' },
    neon: { text: '네온 발광 자막', size: '20px', color: '#00ffc8', shadow: '0 0 10px #00ffc8, 0 0 20px #00ffc8, 0 0 40px #00ffc866', bg: '', border: '' },
    cinematic: { text: '시네마틱 자막', size: '14px', color: '#dcdcdc', shadow: '1px 1px 4px rgba(0,0,0,0.6)', bg: 'rgba(0,0,0,0.6)', border: '' },
    none: { text: '(자막 없음)', size: '13px', color: 'rgba(255,255,255,0.3)', shadow: '', bg: '', border: '' },
  };
  const s = styles[style] || styles.minimal;

  preview.textContent = s.text;
  preview.style.fontSize = s.size;
  preview.style.color = s.color;
  preview.style.fontFamily = fontFamily;
  preview.style.textShadow = s.shadow || (s.border ? '' : 'none');
  preview.style.webkitTextStroke = s.border ? '' : '';
  preview.style.padding = s.bg ? '6px 16px' : '4px';
  preview.style.background = s.bg || 'transparent';
  preview.style.borderRadius = s.bg ? '6px' : '0';
  if (s.border) {
    preview.style.textShadow = s.border;
  }
}

function libCloseEditModal() {
  const el = document.getElementById('libEditModal');
  el.classList.remove('show');
  el.style.display = 'none';
  _libEditingId = null;
  _libCurrentStyleData = null;
  _libCurrentStyleBundle = null;
  _libStyleEditMode = false;
}

// AI 이미지 생성 (설정된 이미지 모델)
async function libAiGenerateImage() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }
  let modal = document.getElementById('ai-img-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'ai-img-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:520px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 6px;">AI 이미지 생성</h3>
      <p style="font-size:11px;color:rgba(0,0,0,0.4);margin-bottom:12px;">설정된 이미지 모델로 이미지를 생성하여 라이브러리에 추가합니다</p>
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">프롬프트</div>
        <textarea id="ai-img-prompt" rows="4" placeholder="예시:&#10;• 카페 인테리어, 따뜻한 조명, 원목 테이블, 라떼아트&#10;• 깔끔한 치과 진료실, 최신 장비, 밝은 조명&#10;• 한식 상차림, 정갈한 반찬, 나무 쟁반" style="width:100%;font-size:14px;line-height:1.6;border-radius:10px;border:1px solid rgba(0,0,0,0.12);padding:12px 14px;"></textarea>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">참고 이미지 (선택)</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="file" id="ai-img-ref" accept="image/*" style="font-size:11px;">
          <div id="ai-img-ref-preview" style="width:48px;height:48px;border-radius:8px;background:rgba(0,0,0,0.04);display:none;overflow:hidden;flex-shrink:0;">
          </div>
        </div>
        <div style="font-size:10px;color:rgba(0,0,0,0.25);margin-top:4px;">비슷한 분위기의 이미지를 참고로 넣으면 더 정확한 결과</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">비율</div>
          <select id="ai-img-ratio" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="1:1" selected>1:1 정사각</option>
            <option value="16:9">16:9 가로</option>
            <option value="9:16">9:16 세로</option>
            <option value="4:3">4:3 가로</option>
            <option value="3:4">3:4 세로</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">생성 수</div>
          <select id="ai-img-count" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="1">1장</option><option value="2">2장</option><option value="3">3장</option><option value="4">4장</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">스타일</div>
          <select id="ai-img-style" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="photo">사진 (리얼)</option><option value="illustration">일러스트</option><option value="watercolor">수채화</option><option value="minimal">미니멀</option><option value="3d">3D 렌더</option><option value="anime">애니메이션</option>
          </select>
        </div>
      </div>
      <div id="ai-img-progress" style="display:none;text-align:center;padding:14px;"><span class="spinner"></span><div style="font-size:12px;color:rgba(0,0,0,0.4);margin-top:6px;">이미지 생성 중...</div></div>
      <div id="ai-img-results" style="display:none;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('ai-img-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">닫기</button>
        <button onclick="libAiDoGenerate()" id="ai-img-gen-btn" style="padding:8px 18px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">생성</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  // 참고 이미지 미리보기
  document.getElementById('ai-img-ref').onchange = function() {
    if (!this.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = document.getElementById('ai-img-ref-preview');
      prev.style.display = '';
      prev.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;">';
    };
    reader.readAsDataURL(this.files[0]);
  };
  document.getElementById('ai-img-prompt').focus();
}

async function libAiDoGenerate() {
  const prompt = document.getElementById('ai-img-prompt')?.value?.trim();
  if (!prompt) { toast('프롬프트를 입력하세요', 'error'); return; }
  const count = parseInt(document.getElementById('ai-img-count')?.value || '1');
  const style = document.getElementById('ai-img-style')?.value || 'photo';
  const styleMap = {photo:'professional realistic photo',illustration:'clean illustration',watercolor:'watercolor painting',minimal:'minimal flat design'};
  const ratio = document.getElementById('ai-img-ratio')?.value || '1:1';
  const fullPrompt = `${prompt}. Style: ${styleMap[style] || style}. Aspect ratio: ${ratio}`;
  const refFile = document.getElementById('ai-img-ref')?.files?.[0] || null;
  const referenceImages = [];
  if (refFile) {
    try {
      referenceImages.push(await libReadImageFileAsDataURL(refFile));
    } catch (e) {
      toast('참고 이미지를 읽지 못했습니다: ' + (e.message || e), 'error');
      return;
    }
  }

  const btn = document.getElementById('ai-img-gen-btn');
  btn.disabled = true; btn.textContent = '생성 중...';
  document.getElementById('ai-img-progress').style.display = '';

  let success = 0;
  let lastError = '';
  for (let i = 0; i < count; i++) {
    try {
      const res = await api('/api/library/profiles/' + _libEditingId + '/ai-image', {
        method: 'POST',
        body: {
          prompt: fullPrompt,
          aspect: ratio,
          provider: '',
          model: '',
          reference_images: referenceImages,
        }
      });
      if (res.filename) success++;
    } catch (e) {
      lastError = e.message || String(e || '');
      console.warn('[Profile AI image] generation failed:', e);
    }
  }

  document.getElementById('ai-img-progress').style.display = 'none';
  btn.disabled = false; btn.textContent = '생성';

  if (success > 0) {
    toast(`${success}장 이미지 생성 완료!`);
    const p = await api(`/api/library/profiles/${_libEditingId}`);
    libRenderEditImages(_libEditingId, JSON.parse(p.images_json || '[]'));
    document.getElementById('ai-img-modal')?.remove();
  } else {
    toast('이미지 생성 실패' + (lastError ? ': ' + lastError : ''), 'error');
  }
}

function libReadImageFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target?.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

// 로고 미리보기
function libLogoPreview(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('lib-edit-logo-preview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(input.files[0]);
}

// 카드뉴스 디자인 참조 이미지 (여러 개)
let _libDesignRefs = []; // [{filename, url}]
let _libDesignRefFiles = []; // 새로 추가할 File[]

async function libUploadDesignRefs(input) {
  if (!input.files.length || !_libEditingId) return;
  for (const file of input.files) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await (await fetch(`/api/library/profiles/${_libEditingId}/design-ref`, { method: 'POST', body: fd })).json();
      if (res.url) _libDesignRefs.push({ filename: res.filename || file.name, url: res.url });
    } catch {}
  }
  input.value = '';
  libRenderDesignRefGrid();
  toast(`디자인 참조 ${input.files.length}개 추가`);
}

function libRenderDesignRefGrid() {
  const grid = document.getElementById('lib-design-ref-grid');
  if (!_libDesignRefs.length) {
    grid.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(0,0,0,0.15);font-size:11px;border:2px dashed rgba(0,0,0,0.08);border-radius:10px;">디자인 참조 이미지를 추가하세요</div>';
    return;
  }
  grid.innerHTML = _libDesignRefs.map((ref, i) => `
    <div style="position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">
      <img src="${ref.url}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;cursor:pointer;" onclick="kcShowImagePreview(this.src)">
      <button onclick="libDeleteDesignRef(${i})" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(255,59,48,0.9);color:#fff;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">x</button>
    </div>
  `).join('');
}

async function libDeleteDesignRef(idx) {
  const ref = _libDesignRefs[idx];
  if (ref && _libEditingId) {
    try { await api(`/api/library/profiles/${_libEditingId}/design-ref/${encodeURIComponent(ref.filename)}`, { method: 'DELETE' }); } catch {}
  }
  _libDesignRefs.splice(idx, 1);
  libRenderDesignRefGrid();
}

// 이미지 드래그 앤 드롭
async function libDropImages(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
  event.currentTarget.style.background = '';
  const files = event.dataTransfer.files;
  if (!files.length || !_libEditingId) return;
  const fd = new FormData();
  for (const f of files) { if (f.type.startsWith('image/')) fd.append('files', f); }
  const uploading = document.getElementById('lib-edit-images-uploading');
  uploading.style.display = '';
  try {
    await fetch(`/api/library/profiles/${_libEditingId}/images`, { method: 'POST', body: fd });
    const p = await api(`/api/library/profiles/${_libEditingId}`);
    libRenderEditImages(_libEditingId, JSON.parse(p.images_json || '[]'));
    toast(`${files.length}개 이미지 추가`);
  } catch (e) { toast('업로드 실패', 'error'); }
  finally { uploading.style.display = 'none'; }
}

// 전체 선택/삭제
let _libSelectedImages = new Set();
function libSelectAllImages() {
  const imgs = document.querySelectorAll('#lib-edit-images-preview .lib-img-item');
  const allSelected = _libSelectedImages.size === imgs.length;
  _libSelectedImages.clear();
  imgs.forEach(el => {
    if (!allSelected) _libSelectedImages.add(el.dataset.filename);
    el.style.outline = allSelected ? '' : '3px solid #007aff';
    el.style.outlineOffset = '-3px';
  });
  document.getElementById('lib-img-delete-btn').style.display = _libSelectedImages.size > 0 ? '' : 'none';
  document.getElementById('lib-img-select-btn').textContent = allSelected ? '전체 선택' : '선택 해제';
}

async function libDeleteSelectedImages() {
  if (!_libSelectedImages.size) return;
  if (!confirm(`${_libSelectedImages.size}개 이미지를 삭제할까요?`)) return;
  for (const fn of _libSelectedImages) {
    try { await api(`/api/library/profiles/${_libEditingId}/images/${fn}`, { method: 'DELETE' }); } catch {}
  }
  _libSelectedImages.clear();
  const p = await api(`/api/library/profiles/${_libEditingId}`);
  libRenderEditImages(_libEditingId, JSON.parse(p.images_json || '[]'));
  document.getElementById('lib-img-delete-btn').style.display = 'none';
  document.getElementById('lib-img-select-btn').textContent = '전체 선택';
  toast('삭제 완료');
}

function libToggleImageSelect(el, filename) {
  if (_libSelectedImages.has(filename)) {
    _libSelectedImages.delete(filename);
    el.style.outline = '';
  } else {
    _libSelectedImages.add(filename);
    el.style.outline = '3px solid #007aff';
    el.style.outlineOffset = '-3px';
  }
  document.getElementById('lib-img-delete-btn').style.display = _libSelectedImages.size > 0 ? '' : 'none';
}

// 카테고리 관리
let _libImgCategories = ['로고', '제품/메뉴', '매장', '시술/작업결과', '기타'];

function libLoadCategories() {
  // 프로필에서 커스텀 카테고리 로드
  if (window._globalProfileData?.content_options) {
    try {
      const co = typeof window._globalProfileData.content_options === 'string' ? JSON.parse(window._globalProfileData.content_options) : window._globalProfileData.content_options;
      if (co.img_categories?.length) _libImgCategories = co.img_categories;
    } catch {}
  }
  libRenderCategoryButtons();
}

function libRenderCategoryButtons() {
  const container = document.getElementById('lib-img-categories');
  if (!container) return;
  // "전체" 버튼 + 동적 카테고리 + "+" 버튼 + "설정" 버튼
  const allBtn = container.querySelector('.qs-btn');
  const addBtn = container.querySelector('[title="카테고리 추가"]');
  const mgrBtn = container.querySelector('[title="카테고리 관리"]');
  // 기존 동적 버튼 제거
  container.querySelectorAll('.lib-cat-btn').forEach(b => b.remove());
  // 동적 버튼 추가 (addBtn 앞에)
  _libImgCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'qs-btn lib-cat-btn';
    btn.style.cssText = 'font-size:10px;padding:4px 10px;cursor:pointer;';
    btn.textContent = cat;
    btn.onclick = () => libFilterImages(cat, btn);
    container.insertBefore(btn, addBtn);
  });
}

async function libAddCategory() {
  const name = await showInputModal('카테고리 추가', '새 카테고리 이름', '');
  if (!name || !name.trim()) return;
  if (_libImgCategories.includes(name.trim())) { toast('이미 존재하는 카테고리', 'error'); return; }
  _libImgCategories.push(name.trim());
  libRenderCategoryButtons();
  libSaveCategories();
  toast(`"${name.trim()}" 카테고리 추가됨`);
}

function libManageCategories() {
  let modal = document.getElementById('cat-manage-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'cat-manage-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:380px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 14px;">카테고리 관리</h3>
      <div id="cat-manage-list" style="margin-bottom:14px;"></div>
      <div style="display:flex;gap:6px;">
        <input type="text" id="cat-new-name" placeholder="새 카테고리 이름" style="flex:1;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
        <button onclick="libAddCategoryFromModal()" style="padding:8px 14px;background:#ff8c00;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;">추가</button>
      </div>
      <div style="margin-top:14px;text-align:right;">
        <button onclick="document.getElementById('cat-manage-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:8px;font-size:13px;cursor:pointer;">닫기</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  libRenderCategoryList();
}

function libRenderCategoryList() {
  const list = document.getElementById('cat-manage-list');
  if (!list) return;
  list.innerHTML = _libImgCategories.map((cat, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.04);">
      <span style="flex:1;font-size:13px;">${cat}</span>
      <button onclick="libRenameCat(${i})" style="padding:2px 8px;font-size:10px;background:rgba(0,0,0,0.04);border:none;border-radius:4px;cursor:pointer;">이름변경</button>
      <button onclick="libDeleteCat(${i})" style="padding:2px 8px;font-size:10px;background:rgba(255,59,48,0.08);color:#ff3b30;border:none;border-radius:4px;cursor:pointer;">삭제</button>
    </div>
  `).join('');
}

async function libRenameCat(idx) {
  const newName = await showInputModal('카테고리 이름 변경', '새 이름', _libImgCategories[idx]);
  if (!newName || !newName.trim()) return;
  _libImgCategories[idx] = newName.trim();
  libRenderCategoryButtons();
  libRenderCategoryList();
  libSaveCategories();
}

function libDeleteCat(idx) {
  _libImgCategories.splice(idx, 1);
  libRenderCategoryButtons();
  libRenderCategoryList();
  libSaveCategories();
  toast('카테고리 삭제됨');
}

function libAddCategoryFromModal() {
  const input = document.getElementById('cat-new-name');
  const name = input?.value?.trim();
  if (!name) return;
  if (_libImgCategories.includes(name)) { toast('이미 존재', 'error'); return; }
  _libImgCategories.push(name);
  input.value = '';
  libRenderCategoryButtons();
  libRenderCategoryList();
  libSaveCategories();
}

async function libSaveCategories() {
  if (!window._globalProfileId) return;
  const o = window._contentOpts;
  o.img_categories = _libImgCategories;
  try {
    const co = { ...o, img_categories: _libImgCategories };
    await api(`/api/library/profiles/${window._globalProfileId}`, {
      method: 'PUT', body: { content_options: JSON.stringify(co) }
    });
  } catch {}
}

// 카테고리 필터
function libFilterImages(cat, btn) {
  document.querySelectorAll('#lib-img-categories .qs-btn').forEach(b => b.classList.remove('qs-active'));
  btn.classList.add('qs-active');
  document.querySelectorAll('#lib-edit-images-preview .lib-img-item').forEach(el => {
    el.style.display = (cat === 'all' || el.dataset.category === cat) ? '' : 'none';
  });
}

async function libUploadImagesNow() {
  if (!_libEditingId) { toast('프로필을 먼저 저장하세요', 'error'); return; }
  const input = document.getElementById('lib-edit-images-file');
  if (!input.files || input.files.length === 0) return;
  const uploading = document.getElementById('lib-edit-images-uploading');
  uploading.style.display = '';
  uploading.innerHTML = '<span class="spinner"></span> 이미지 업로드 중...';
  try {
    const fd = new FormData();
    for (const f of input.files) fd.append('files', f);
    await fetch(`/api/library/profiles/${_libEditingId}/images`, { method: 'POST', body: fd });
    // 업로드 후 프리뷰 새로고침
    const p = await api(`/api/library/profiles/${_libEditingId}`);
    const images = JSON.parse(p.images_json || '[]');
    libRenderEditImages(_libEditingId, images);
    toast(`${input.files.length}개 이미지 업로드 완료`);
    input.value = '';
  } catch (e) { toast('업로드 실패: ' + e.message, 'error'); }
  finally { uploading.style.display = 'none'; }
}

function libRenderEditImages(profileId, images) {
  const preview = document.getElementById('lib-edit-images-preview');
  const emptyEl = document.getElementById('lib-img-empty');
  const countEl = document.getElementById('lib-img-count');
  if (countEl) countEl.textContent = `${images.length}개`;
  if (emptyEl) emptyEl.style.display = images.length ? 'none' : '';
  _libSelectedImages.clear();
  preview.innerHTML = images.map(filename => `
    <div class="lib-img-item" data-filename="${filename}" data-category="etc"
         style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;border:1px solid rgba(0,0,0,0.06);transition:all 0.15s;">
      <img src="${encImg('/api/library/image/'+profileId+'/'+filename)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
           onclick="kcShowImagePreview(this.src)">
      <div style="position:absolute;top:4px;left:4px;">
        <input type="checkbox" class="lib-img-cb" data-fn="${filename}" onchange="libToggleImageSelect(this.closest('.lib-img-item'),'${filename}')" onclick="event.stopPropagation()" style="width:16px;height:16px;cursor:pointer;accent-color:#007aff;">
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.5));padding:4px 6px;display:flex;gap:3px;justify-content:flex-end;">
        <button onclick="event.stopPropagation();libDeleteImage(${profileId},'${filename}')" style="width:20px;height:20px;border-radius:50%;background:rgba(255,59,48,0.8);color:#fff;border:none;cursor:pointer;font-size:10px;" title="삭제">&times;</button>
      </div>
    </div>
  `).join('');
}

async function libSaveProfile() {
  const name = document.getElementById('lib-edit-name').value.trim();
  if (!name) { toast('업체명을 입력하세요', 'error'); return; }
  syncUIToOpts('lib');

  let mergedContentOptions = null;
  let existingProfile = null;
  let existingCo = {};
  try {
    if (_libEditingId) {
      existingProfile = await api(`/api/library/profiles/${_libEditingId}`);
      existingCo = existingProfile?.content_options
        ? (typeof existingProfile.content_options === 'string'
            ? JSON.parse(existingProfile.content_options)
            : existingProfile.content_options)
        : {};
    }
    const liveOpts = normalizeTtsOptions({ ...existingCo, ...(window._contentOpts || {}) });
    const geminiVoice = liveOpts.gemini_voice || document.getElementById('lib-opt-voice-gemini')?.value || existingCo.gemini_voice || 'Kore';
    const mergedBgmUrl = liveOpts.bgm_url || existingCo.bgm_url || '';
    const mergedBgmMode = (liveOpts.bgm_mode === 'selected' || liveOpts.bgm === 'selected' || existingCo.bgm_mode === 'selected' || existingCo.bgm === 'selected') && mergedBgmUrl ? 'selected' : 'random';
    const logoInsert = !!liveOpts.logo_insert;
    const contentOptions = {
      ...normalizeTtsOptions(existingCo),
      tone: 'mystyle',
      blog_length: liveOpts.blog_length || existingCo.blog_length || 'medium',
      threads_length: liveOpts.threads_length || existingCo.threads_length || 'medium',
      threads_mode: liveOpts.threads_mode || existingCo.threads_mode || 'auto',
      twitter_length: liveOpts.twitter_length || existingCo.twitter_length || 'medium',
      gen_blog_images: !!liveOpts.gen_blog_images,
      blog_image_count: liveOpts.gen_blog_images ? 5 : 0,
      comma_rate: parseInt(String(liveOpts.comma_rate ?? existingCo.comma_rate ?? '50'), 10),
      period_rate: parseInt(String(liveOpts.period_rate ?? existingCo.period_rate ?? '70'), 10),
      human_level: liveOpts.human_level || existingCo.human_level || 'light',
      logo_insert: logoInsert,
      logo_cardnews: logoInsert,
      logo_blogimg: logoInsert,
      logo_comic: logoInsert,
      cn_style: liveOpts.cn_style || existingCo.cn_style || 'ai-auto',
      cn_slides: liveOpts.cn_slides || existingCo.cn_slides || '5',
      cn_photo_count: liveOpts.cn_photo_count || existingCo.cn_photo_count || '1',
      cn_ratio: liveOpts.cn_ratio || existingCo.cn_ratio || '1:1',
      tts_type: 'gemini',
      voice: `gemini-${geminiVoice}`,
      gemini_voice: geminiVoice,
      elevenlabs_voice_id: '',
      video_ratio: liveOpts.video_ratio || existingCo.video_ratio || '9:16',
      camera: liveOpts.camera || existingCo.camera || 'subtle',
      bgm: mergedBgmMode,
      bgm_url: mergedBgmUrl,
      subtitle: liveOpts.subtitle || existingCo.subtitle || 'minimal',
      subtitle_font: liveOpts.subtitle_font || existingCo.subtitle_font || 'nanum-square',
      comic_panels: '4',
      comic_style: liveOpts.comic_style || existingCo.comic_style || 'cute',
      bgm_mood: liveOpts.bgm_mood || existingCo.bgm_mood || 'calm piano',
      bgm_bpm: liveOpts.bgm_bpm || existingCo.bgm_bpm || '90',
      bgm_duration: liveOpts.bgm_duration || existingCo.bgm_duration || 'auto',
      bgm_mode: mergedBgmMode,
    };
    mergedContentOptions = JSON.stringify(contentOptions);
  } catch (e) {
    console.error('[libSaveProfile] content_options 구성 실패:', e);
    toast('프로필 옵션을 저장하는 중 오류가 발생했습니다.', 'error');
    return;
  }

    const genVideoSlide = document.getElementById('lib-gen-video-slide')?.checked || false;
    const genVideoVeo = false;
    const genDetailPage = document.getElementById('lib-gen-detail-page')?.checked || false;
    const imageType =
      document.getElementById('lib-gen-cardnews')?.checked ? 'cardnews'
      : document.getElementById('lib-gen-comic')?.checked ? 'comic'
      : 'none';
    const videoType = genVideoSlide ? 'slide' : 'none';
    const body = {
    name,
    business_type: document.getElementById('lib-edit-btype').value,
    description: document.getElementById('lib-edit-desc').value.trim(),
    business_goal: document.getElementById('lib-edit-goal').value.trim(),
    contact_info: document.getElementById('lib-edit-contact').value.trim(),
    website: (document.getElementById('lib-edit-website')?.value || '').trim(),
    biz_detail: (document.getElementById('lib-edit-biz-detail')?.value || '').trim(),
    brand_color: (document.getElementById('lib-edit-brand-color')?.value || ''),
    brand_colors: (document.getElementById('lib-edit-brand-colors')?.value || '').trim(),
    design_tone: (document.getElementById('lib-edit-design-tone')?.value || '').trim(),
    typography_rules: (document.getElementById('lib-edit-typography-rules')?.value || '').trim(),
    layout_rules: (document.getElementById('lib-edit-layout-rules')?.value || '').trim(),
    image_rules: (document.getElementById('lib-edit-image-rules')?.value || '').trim(),
    cta_rules: (document.getElementById('lib-edit-cta-rules')?.value || '').trim(),
    design_forbidden: (document.getElementById('lib-edit-design-forbidden')?.value || '').trim(),
    design_rules: (document.getElementById('lib-edit-design-rules')?.value || '').trim(),
    keywords: document.getElementById('lib-edit-keywords').value.trim(),
    tone: 'mystyle',
    content_options: mergedContentOptions,
    platform_accounts: JSON.stringify({
      gen_blog: document.getElementById('lib-gen-blog')?.checked || false,
      gen_cardnews: document.getElementById('lib-gen-cardnews')?.checked || false,
      image_type: imageType,
      video_type: videoType,
      gen_comic: document.getElementById('lib-gen-comic')?.checked || false,
      gen_sns: document.getElementById('lib-gen-sns')?.checked || false,
      gen_video_slide: genVideoSlide,
      gen_video_veo: genVideoVeo,
      gen_detail_page: genDetailPage,
    }),
  };

  const btn = document.getElementById('lib-save-btn');
  btn.disabled = true;

  try {
    let profileId = _libEditingId;
    if (_libEditingId) {
      await api(`/api/library/profiles/${_libEditingId}`, { method: 'PUT', body });
    } else {
      const res = await api('/api/library/profiles', { method: 'POST', body });
      profileId = res.id;
    }

    // 로고 업로드
    const logoFile = document.getElementById('lib-edit-logo-file').files[0];
    if (logoFile) {
      const fd = new FormData();
      fd.append('file', logoFile);
      await fetch(`/api/library/profiles/${profileId}/logo`, { method: 'POST', body: fd });
    }

    // 디자인 참조는 개별 업로드로 처리됨 (libUploadDesignRefs)

    // 이미지 업로드
    const imgFiles = document.getElementById('lib-edit-images-file').files;
    if (imgFiles && imgFiles.length > 0) {
      const fd = new FormData();
      for (const f of imgFiles) fd.append('files', f);
      await fetch(`/api/library/profiles/${profileId}/images`, { method: 'POST', body: fd });
    }

    toast(_libEditingId ? '프로필이 수정되었습니다.' : '프로필이 추가되었습니다.');
    if (profileId && String(window._globalProfileId || '') === String(profileId)) {
      const refreshed = await api(`/api/library/profiles/${profileId}`);
      window._globalProfileData = refreshed;
      loadProfileToGlobalOpts(refreshed);
      syncOptsToUI('all');
      renderOptsPreview('kc-opts-preview');
      renderOptsPreview('biz-opts-preview');
      renderOptsPreview('lib-opts-preview');
      if (typeof syncChromeConnectionForCurrentProfile === 'function') {
        syncChromeConnectionForCurrentProfile().catch(() => {});
      }
    }
    try {
      const syncProfile = await api(`/api/library/profiles/${profileId}`);
      const platformAccounts = syncProfile?.platform_accounts
        ? (typeof syncProfile.platform_accounts === 'string' ? JSON.parse(syncProfile.platform_accounts) : syncProfile.platform_accounts)
        : {};
      libNotifyResearchSync(profileId, 'instagram', platformAccounts?.instagram_id || '');
    } catch {}
    // 모달 닫지 않음 — 계속 편집 가능
    await libLoadProfiles();
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function libDeleteProfile(profileId) {
  if (!confirm('이 프로필을 삭제하시겠습니까? 업로드된 이미지도 모두 삭제됩니다.')) return;
  try {
    await api(`/api/library/profiles/${profileId}`, { method: 'DELETE' });
    toast('프로필이 삭제되었습니다.');
    await libLoadProfiles();
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

async function libDeleteImage(profileId, filename) {
  try {
    await api(`/api/library/profiles/${profileId}/images/${filename}`, { method: 'DELETE' });
    // 모달에서 이미지 목록 새로고침
    const p = await api(`/api/library/profiles/${profileId}`);
    const images = JSON.parse(p.images_json || '[]');
    libRenderEditImages(profileId, images);
    toast('이미지가 삭제되었습니다.');
  } catch (e) {
    toast('이미지 삭제 실패: ' + e.message, 'error');
  }
}

function libUseProfile(profileId) {
  const p = _libProfiles.find(x => x.id === profileId);
  if (!p) return;
  // 키워드 콘텐츠 페이지로 이동
  document.querySelectorAll('.sidebar nav a').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const kcLink = document.querySelector('[data-page="keyword-content"]');
  if (kcLink) kcLink.classList.add('active');
  document.getElementById('page-keyword-content').classList.add('active');
  kcInit();

  // 프로필 정보 채우기 (Step 3)
  document.getElementById('kc-brand-name').value = p.name || '';
  document.getElementById('kc-brand-desc').value = p.description || '';
  document.getElementById('kc-contact').value = p.contact_info || '';
  document.querySelectorAll('input[name="kc-tone"]').forEach(c => {
    c.checked = c.value === 'mystyle';
    c.closest('label.qs-btn')?.classList.toggle('qs-active', c.checked);
  });
  try { kcToggleMyStyle(true); } catch {}

  // 라이브러리 이미지를 업로드 이미지 목록에 추가
  const images = JSON.parse(p.images_json || '[]');
  _kcUploadedImages = images.map(filename => ({
    filename,
    path: `output/library/${p.id}/${filename}`,
    url: `${encImg('/api/library/image/'+p.id+'/'+filename)}`,
  }));
  // 로고도 추가
  if (p.logo_path) {
    _kcUploadedImages.unshift({
      filename: p.logo_path,
      path: `output/library/${p.id}/${p.logo_path}`,
      url: `${encImg('/api/library/image/'+p.id+'/'+p.logo_path)}`,
    });
  }
  if (typeof kcRefreshImagePreview === 'function') kcRefreshImagePreview();

  toast(`"${p.name}" 프로필 정보가 로드되었습니다.`);
}

// 키워드 콘텐츠 Step 3 - 라이브러리에서 불러오기
async function kcLoadLibraryDropdown() {
  try {
    const profiles = await api('/api/library/profiles');
    const sel = document.getElementById('kc-library-select');
    sel.innerHTML = '<option value="">-- 프로필 선택 --</option>';
    profiles.forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.name}${p.business_type ? ' (' + p.business_type + ')' : ''}</option>`;
    });
  } catch (e) { /* ignore */ }
}

async function kcLoadFromLibrary(profileId) {
  if (!profileId) return;
  try {
    const p = await api(`/api/library/profiles/${profileId}`);
    window._globalProfileId = String(profileId);
    window._globalProfileData = p;
    try { localStorage.setItem('makeke_last_profile_id', String(profileId)); } catch {}
    loadProfileToGlobalOpts(p);
    syncOptsToUI('all');
    renderOptsPreview('kc-opts-preview');
    renderOptsPreview('biz-opts-preview');
    renderOptsPreview('lib-opts-preview');
    const globalSel = document.getElementById('global-profile-select');
    if (globalSel) globalSel.value = String(profileId);
    if (typeof updateProfileButton === 'function') await updateProfileButton(profileId);
    if (typeof window.refreshSidebarChromeProfileQuickSelect === 'function') {
      await window.refreshSidebarChromeProfileQuickSelect(true);
    }
    document.getElementById('kc-brand-name').value = p.name || '';
    document.getElementById('kc-brand-desc').value = p.description || '';
    document.getElementById('kc-business-goal').value = p.business_goal || '';
    document.getElementById('kc-contact').value = p.contact_info || '';

    // 프로필에 내 스타일이 연결되어 있으면 자동 적용
    if (p.writing_style) {
      try {
        const rawStyle = typeof p.writing_style === 'string' ? JSON.parse(p.writing_style) : p.writing_style;
        const bundle = libNormalizeStyleBundle(rawStyle);
        const styleData = libGetStyleForPlatform(bundle, 'blog');
        if (styleData.tone) {
          const myStyleText = document.getElementById('kc-tone-mystyle-text');
          const myStyleCb = document.getElementById('kc-tone-mystyle');
          if (myStyleText) myStyleText.textContent = `내 스타일 (${styleData.tone})`;
          if (myStyleCb) { myStyleCb.checked = true; kcToggleMyStyle(true); }

          // 스타일 표시는 프로필에서 관리 (여기서 표시하지 않음)
        }
      } catch {}
    }

    // 이미지 로드
    const images = JSON.parse(p.images_json || '[]');
    _kcUploadedImages = images.map(filename => ({
      filename,
      path: `output/library/${p.id}/${filename}`,
      url: `${encImg('/api/library/image/'+p.id+'/'+filename)}`,
    }));
    if (p.logo_path) {
      _kcUploadedImages.unshift({
        filename: p.logo_path,
        path: `output/library/${p.id}/${p.logo_path}`,
        url: `${encImg('/api/library/image/'+p.id+'/'+p.logo_path)}`,
      });
    }
    if (typeof kcRefreshImagePreview === 'function') kcRefreshImagePreview();
    toast(`"${p.name}" 프로필 정보가 로드되었습니다.`);
  } catch (e) {
    toast('프로필 로딩 실패: ' + e.message, 'error');
  }
  // 선택 초기화
  document.getElementById('kc-library-select').value = '';
}


// ═══ 세부 비즈니스 AI 정리 / URL 가져오기 ═══

async function libAiOrganizeBizDetail() {
  const el = document.getElementById('lib-edit-biz-detail');
  const status = document.getElementById('lib-biz-status');
  if (!el || !el.value.trim()) { if (status) status.textContent = '내용을 먼저 입력해주세요.'; return; }
  if (status) { status.textContent = 'AI가 정리 중...'; status.style.color = '#ff8c00'; }
  try {
    const resp = await fetch('/api/ce2/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'organize_biz', text: el.value.trim() }),
    });
    const data = await resp.json();
    if (data.ok && data.result) {
      el.value = data.result;
      const saved = await libSaveBizDetailMarkdown(data.result);
      if (status) {
        status.textContent = saved?.filename
          ? `AI 정리 완료 · ${saved.filename} 저장 완료`
          : 'AI 정리 완료!';
        status.style.color = '#34c759';
      }
    } else {
      if (status) { status.textContent = data.error || '정리 실패'; status.style.color = '#ff3b30'; }
    }
  } catch (e) {
    if (status) { status.textContent = '오류: ' + e.message; status.style.color = '#ff3b30'; }
  }
}

async function libSaveBizDetailMarkdown(content) {
  if (!_libEditingId || !String(content || '').trim()) return null;
  try {
    return await api(`/api/library/profiles/${_libEditingId}/biz-detail-file`, {
      method: 'POST',
      body: { content },
    });
  } catch (e) {
    const status = document.getElementById('lib-biz-status');
    if (status) {
      status.textContent = 'Markdown 파일 저장 실패: ' + e.message;
      status.style.color = '#ff3b30';
    }
    return null;
  }
}

async function libAiConsultDesignRules() {
  const status = document.getElementById('lib-design-ai-status');
  const name = document.getElementById('lib-edit-name')?.value.trim() || '';
  if (!name) {
    if (status) { status.textContent = '브랜드명을 먼저 입력해주세요.'; status.style.color = '#ff3b30'; }
    return;
  }
  const btn = document.querySelector('button[onclick="libAiConsultDesignRules()"]');
  if (btn) btn.disabled = true;
  if (status) { status.textContent = 'Gemini 3.1 Pro가 CI/BI 기준으로 브랜드 디자인 규칙.md를 작성 중...'; status.style.color = '#ff8c00'; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 210000);
  try {
    const btypeText = document.getElementById('lib-btype-text')?.textContent?.trim() || '';
    const businessType = document.getElementById('lib-edit-btype')?.value || (btypeText === '업종을 선택하세요' ? '' : btypeText);
    const body = {
      name,
      business_type: businessType,
      description: document.getElementById('lib-edit-desc')?.value || '',
      biz_detail: document.getElementById('lib-edit-biz-detail')?.value || '',
      contact_info: document.getElementById('lib-edit-contact')?.value || '',
      website: document.getElementById('lib-edit-website')?.value || '',
      keywords: document.getElementById('lib-edit-keywords')?.value || '',
      business_goal: document.getElementById('lib-edit-goal')?.value || '',
      brand_color: document.getElementById('lib-edit-brand-color')?.value || '',
      brand_colors: document.getElementById('lib-edit-brand-colors')?.value || '',
      design_tone: document.getElementById('lib-edit-design-tone')?.value || '',
      typography_rules: document.getElementById('lib-edit-typography-rules')?.value || '',
      layout_rules: document.getElementById('lib-edit-layout-rules')?.value || '',
      image_rules: document.getElementById('lib-edit-image-rules')?.value || '',
      cta_rules: document.getElementById('lib-edit-cta-rules')?.value || '',
      design_forbidden: document.getElementById('lib-edit-design-forbidden')?.value || '',
      current_design_rules: document.getElementById('lib-edit-design-rules')?.value || '',
    };
    const resp = await fetch('/api/library/design-consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.ok || !data.result) throw new Error(data.error || data.detail || '컨설팅 실패');
    const r = data.result || {};
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.value = id === 'lib-edit-brand-colors'
        ? (Array.isArray(value) ? value.join(', ') : String(value))
        : libDesignValue(value);
    };
    set('lib-edit-brand-colors', r.brand_colors);
    libApplyDesignPaletteText();
    const colors = libParseDesignColors(document.getElementById('lib-edit-brand-colors')?.value || '');
    if (colors[0]) {
      set('lib-edit-brand-color', colors[0]);
      set('lib-edit-brand-color-text', colors[0]);
    }
    set('lib-edit-design-tone', r.design_tone);
    set('lib-edit-typography-rules', r.typography_rules);
    set('lib-edit-layout-rules', r.layout_rules);
    set('lib-edit-image-rules', r.image_rules);
    set('lib-edit-cta-rules', r.cta_rules);
    set('lib-edit-design-forbidden', r.design_forbidden);
    set('lib-edit-design-rules', r.design_rules_md || r.design_rules);
    libUpsertDesignMarkdownPalette();
    libAutosaveDesignGuide({
      immediate: true,
      refreshList: true,
      message: r.warning || 'AI CI/BI 디자인 컨설팅 완료. 대표 색상 팔레트와 디자인 규칙을 자동 저장했습니다.',
    });
  } catch (e) {
    const message = e?.name === 'AbortError'
      ? 'AI 컨설팅 응답이 210초를 넘었습니다. Gemini 3.1 Pro 접근 권한과 네트워크 상태를 확인한 뒤 다시 시도해주세요.'
      : (e.message || e);
    if (status) { status.textContent = '오류: ' + message; status.style.color = '#ff3b30'; }
  } finally {
    clearTimeout(timeout);
    if (btn) btn.disabled = false;
  }
}

async function libFetchBizFromUrl() {
  const urlEl = document.getElementById('lib-edit-biz-url');
  const el = document.getElementById('lib-edit-biz-detail');
  const descEl = document.getElementById('lib-edit-desc');
  const contactEl = document.getElementById('lib-edit-contact');
  const websiteEl = document.getElementById('lib-edit-website');
  const status = document.getElementById('lib-biz-status');
  if (!urlEl || !urlEl.value.trim()) { if (status) status.textContent = 'URL을 입력해주세요.'; return; }
  const targetUrl = urlEl.value.trim();
  if (status) { status.textContent = '공통 크롤링 모달로 URL 본문을 가져오는 중...'; status.style.color = '#ff8c00'; }
  try {
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 크롤링 모달을 찾지 못했습니다.');
    const result = await scrape(targetUrl, {
      title: '브랜드 프로필 URL 가져오기',
      minLength: 80,
      maxAttempts: 3,
    });
    const text = String(result?.text || '').trim();
    if (!result?.ok && !text) throw new Error(result?.error || 'URL 본문을 가져오지 못했습니다.');
    const title = String(result?.title || targetUrl).trim();
    const sourceBlock = [
      `출처 URL: ${targetUrl}`,
      `제목: ${title}`,
      '',
      text,
    ].join('\n').trim();
    let organized = '';
    try {
      const resp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'organize_biz', text: sourceBlock }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.ok && data.result) organized = String(data.result || '').trim();
    } catch {}
    let savedFile = null;
    if (el) {
      const detail = organized || sourceBlock;
      el.value = (el.value ? el.value + '\n\n' : '') + detail;
      savedFile = await libSaveBizDetailMarkdown(el.value);
    }
    if (descEl && !descEl.value) descEl.value = title;
    if (websiteEl && !websiteEl.value) websiteEl.value = targetUrl;
    if (contactEl && !contactEl.value) {
      const contactMatch = text.match(/(?:\+?\d[\d\s().-]{7,}\d|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (contactMatch) contactEl.value = contactMatch[0];
    }
    if (status) {
      status.textContent = savedFile?.filename
        ? `URL 본문 ${text.length.toLocaleString()}자 가져오기 완료 · ${savedFile.filename} 저장 완료`
        : `URL 본문 ${text.length.toLocaleString()}자 가져오기 완료`;
      status.style.color = '#34c759';
    }
  } catch (e) {
    if (status) { status.textContent = '오류: ' + e.message; status.style.color = '#ff3b30'; }
  }
}

// Init
loadBlogUrl();
loadProjects(0); // 첫 화면 프로젝트 목록 로드
