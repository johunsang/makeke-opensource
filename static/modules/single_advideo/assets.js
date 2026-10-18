/* single_advideo — 자막/BGM/이미지/AI 브리프 추천/유니크 스타일 */
function savApplyMediaOptionDefaults() {
  const voiceEl = document.getElementById('sav-voice');
  if (voiceEl && window._contentOpts?.voice) {
    voiceEl.value = window._contentOpts.voice;
  }
  const subtitleStyleEl = document.getElementById('sav-subtitle-style');
  if (subtitleStyleEl && window._contentOpts?.subtitle) {
    subtitleStyleEl.value = window._contentOpts.subtitle;
  }
  const subtitleFontEl = document.getElementById('sav-subtitle-font');
  if (subtitleFontEl && window._contentOpts?.subtitle_font) {
    subtitleFontEl.value = window._contentOpts.subtitle_font;
  }
  const subtitleYEl = document.getElementById('sav-subtitle-y');
  if (subtitleYEl && !subtitleYEl.value) subtitleYEl.value = '82';
  const subtitleWidthEl = document.getElementById('sav-subtitle-width');
  if (subtitleWidthEl && !subtitleWidthEl.value) subtitleWidthEl.value = '82';
  const subtitleScaleEl = document.getElementById('sav-subtitle-scale');
  if (subtitleScaleEl && !subtitleScaleEl.value) subtitleScaleEl.value = '100';
  savSyncSubtitleSliderLabel('sav-subtitle-y', 'sav-subtitle-y-value', '%');
  savSyncSubtitleSliderLabel('sav-subtitle-width', 'sav-subtitle-width-value', '%');
  savSyncSubtitleSliderLabel('sav-subtitle-scale', 'sav-subtitle-scale-value', '%');
}

function savSyncSubtitleSliderLabel(inputId, outputId, suffix = '') {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);
  if (!input || !output) return;
  output.textContent = `${input.value}${suffix}`;
  savRenderSubtitlePreview();
}

function savBindPreviewControls() {
  [
    'sav-voice',
    'sav-subtitle-style',
    'sav-subtitle-font',
    'sav-subtitle-y',
    'sav-subtitle-width',
    'sav-subtitle-scale',
    'sav-subtitle-align',
    'sav-ratio',
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.savPreviewBound === '1') return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => savRenderSubtitlePreview());
    el.dataset.savPreviewBound = '1';
  });
}

function savPickSubtitleStyle(style) {
  const select = document.getElementById('sav-subtitle-style');
  if (!select) return;
  select.value = style;
  savRenderSubtitlePreview();
}

function savPickSubtitleFont(font) {
  const select = document.getElementById('sav-subtitle-font');
  if (!select) return;
  select.value = font;
  savRenderSubtitlePreview();
}

function savGetPreviewSubtitleText() {
  const firstScene = _savState.script?.scenes?.[0];
  const sceneText = String(firstScene?.subtitle || firstScene?.narration || firstScene?.title || '').trim();
  return sceneText || '지금 바로 구매하세요';
}

function savRenderSubtitlePreviewLists(activeStyle, activeFont) {
  const fontWrap = document.getElementById('sav-subtitle-font-preview-list');
  if (fontWrap) {
    fontWrap.innerHTML = Object.entries(SAV_SUBTITLE_FONT_MAP)
      .map(([key, family]) => {
        const active = key === activeFont;
        const label = key === 'nanum-square' ? '나눔스퀘어' : key === 'nanum-gothic' ? '나눔고딕' : 'Pretendard';
        return `<button type="button" onclick="savPickSubtitleFont('${key}')" style="padding:8px 10px;border-radius:12px;border:${active ? '1px solid rgba(255,140,0,0.42)' : '1px solid rgba(0,0,0,0.08)'};background:${active ? 'rgba(255,140,0,0.08)' : '#fff'};cursor:pointer;text-align:left;min-width:102px;">
          <div style="font-size:10px;font-weight:700;color:${active ? '#ff8c00' : 'rgba(0,0,0,0.4)'};margin-bottom:4px;">${label}</div>
          <div style="font-family:${family};font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.2;">자막 샘플</div>
        </button>`;
      }).join('');
  }
}

function savRenderSubtitlePreview() {
  const stage = document.getElementById('sav-subtitle-preview-stage');
  const wrap = document.getElementById('sav-preview-subtitle-wrap');
  const textEl = document.getElementById('sav-preview-subtitle');
  if (!stage || !wrap || !textEl) return;

  const style = document.getElementById('sav-subtitle-style')?.value || 'promo';
  const font = document.getElementById('sav-subtitle-font')?.value || 'nanum-square';
  const ratio = document.getElementById('sav-ratio')?.value || '9:16';
  const y = parseInt(document.getElementById('sav-subtitle-y')?.value || '82', 10) || 82;
  const widthPct = parseInt(document.getElementById('sav-subtitle-width')?.value || '82', 10) || 82;
  const scale = parseInt(document.getElementById('sav-subtitle-scale')?.value || '100', 10) || 100;
  const align = document.getElementById('sav-subtitle-align')?.value || 'center';
  const sampleText = savGetPreviewSubtitleText();
  const preset = SAV_SUBTITLE_STYLE_PRESETS[style] || SAV_SUBTITLE_STYLE_PRESETS.minimal;
  const fontFamily = SAV_SUBTITLE_FONT_MAP[font] || SAV_SUBTITLE_FONT_MAP['nanum-square'];

  const aspectRatio = ratio === '16:9' ? '16 / 9' : ratio === '1:1' ? '1 / 1' : '9 / 16';
  stage.style.aspectRatio = aspectRatio;

  wrap.style.width = `${Math.max(45, Math.min(96, widthPct))}%`;
  wrap.style.top = `${Math.max(8, Math.min(92, y))}%`;
  wrap.style.left = align === 'center' ? '50%' : align === 'left' ? '8%' : 'auto';
  wrap.style.right = align === 'right' ? '8%' : 'auto';
  wrap.style.transform = align === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)';
  wrap.style.justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  textEl.textContent = style === 'none' ? '(자막 없음)' : sampleText;
  textEl.style.fontFamily = fontFamily;
  textEl.style.fontSize = `${Math.round((style === 'bold' ? 28 : style === 'promo' ? 24 : 20) * (scale / 100))}px`;
  textEl.style.fontWeight = preset.weight || '800';
  textEl.style.color = preset.color || '#fff';
  textEl.style.background = preset.bg || 'transparent';
  textEl.style.border = preset.border || 'none';
  textEl.style.borderRadius = preset.radius || '0';
  textEl.style.textShadow = preset.textShadow || 'none';
  textEl.style.webkitTextStroke = preset.stroke || '0';
  textEl.style.letterSpacing = preset.letterSpacing || '0';
  textEl.style.textAlign = align;
  textEl.style.padding = preset.bg && preset.bg !== 'transparent' ? '8px 12px' : '4px 2px';
  textEl.style.opacity = style === 'none' ? '0.7' : '1';

  savRenderSubtitlePreviewLists(style, font);
}

function savSetBgmStatus(message, isError = false) {
  const statusEl = document.getElementById('sav-bgm-status');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#ff3b30' : 'rgba(0,0,0,0.38)';
}

function savGetCurrentBgmSelectValue() {
  const select = document.getElementById('sav-bgm-select');
  if (select?.value) return select.value;
  const currentUrl = window._contentOpts?.bgm_url || '';
  if (currentUrl) {
    try {
      const url = new URL(currentUrl, window.location.origin);
      const fileName = decodeURIComponent(url.pathname.split('/').pop() || '');
      if (fileName) return `file:${encodeURIComponent(fileName)}`;
    } catch (_) {}
  }
  const mode = String(window._contentOpts?.bgm_mode || window._contentOpts?.bgm || 'random').trim().toLowerCase();
  if (['lyria', 'auto', 'ai'].includes(mode)) return 'lyria';
  if (mode === 'random') return 'random';
  return mode === 'none' ? 'none' : 'lyria';
}

function savBuildBgmFileUrl(fileName) {
  return `/api/bgm/file/${encodeURIComponent(fileName)}?profile_id=${savGetProfileId()}`;
}

async function savLoadBgmOptions(preferredValue = '') {
  const select = document.getElementById('sav-bgm-select');
  if (!select) return;
  const profileId = savGetProfileId();
  const initialValue = preferredValue || savGetCurrentBgmSelectValue();

  select.innerHTML = `
    <option value="lyria">AI 자동 생성 (Lyria 3)</option>
    <option value="random">라이브러리 랜덤</option>
    <option value="none">BGM 없음</option>
  `;

  const res = await api(`/api/bgm/list?profile_id=${profileId}`);
  const files = Array.isArray(res.files) ? res.files : [];
  files.forEach(file => {
    const opt = document.createElement('option');
    opt.value = `file:${encodeURIComponent(file.path)}`;
    opt.textContent = `직접 선택: ${file.name}${file.is_external ? ' (외부)' : ''}`;
    select.appendChild(opt);
  });

  const hasPreferred = initialValue && Array.from(select.options).some(opt => opt.value === initialValue);
  select.value = hasPreferred ? initialValue : (initialValue === 'none' ? 'none' : initialValue === 'random' ? 'random' : 'lyria');
  savSetBgmStatus(files.length ? `사용 가능한 BGM ${files.length}개 · 기본값은 Lyria 3 자동 생성입니다.` : '저장된 BGM이 없어도 Lyria 3가 스크립트에 맞춰 자동 생성합니다.');
  savHandleBgmSelectChange();
}

function savHandleBgmSelectChange() {
  const select = document.getElementById('sav-bgm-select');
  const audio = document.getElementById('sav-bgm-preview');
  if (!select || !audio) return;

  if (select.value.startsWith('file:')) {
    const fileName = decodeURIComponent(select.value.slice(5));
    audio.src = savBuildBgmFileUrl(fileName);
    audio.style.display = 'block';
  } else {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.style.display = 'none';
  }
  if (select.value === 'lyria') {
    savSetBgmStatus('생성 시 Lyria 3가 현재 광고 스크립트에 맞춰 배경음악을 자동 생성합니다.');
  } else if (select.value === 'random') {
    savSetBgmStatus('프로필/외부 라이브러리에서 랜덤 BGM을 사용합니다.');
  } else if (select.value === 'none') {
    savSetBgmStatus('배경음악 없이 생성합니다.');
  }
}

function savOpenBgmUpload() {
  document.getElementById('sav-bgm-upload')?.click();
}

async function savUploadBgmFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);

  try {
    savSetBgmStatus(`"${file.name}" 업로드 중...`);
    const res = await fetch(`/api/bgm/upload?profile_id=${savGetProfileId()}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const selectedValue = data.filename ? `file:${encodeURIComponent(data.filename)}` : '';
    await savLoadBgmOptions(selectedValue);
    toast(`BGM 추가 완료: ${data.filename || file.name}`);
  } catch (e) {
    savSetBgmStatus('BGM 업로드에 실패했습니다.', true);
    toast('BGM 업로드 실패: ' + e.message, 'error');
  } finally {
    if (input) input.value = '';
  }
}

async function savDownloadBgmFromYoutube() {
  const input = document.getElementById('sav-bgm-youtube-url');
  const btn = document.getElementById('sav-bgm-youtube-btn');
  const url = (input?.value || '').trim();
  if (!url) {
    toast('YouTube 음원 URL을 입력하세요', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 다운로드 중...';
  }

  try {
    savSetBgmStatus('YouTube 음원을 다운로드하는 중입니다...');
    const data = await api('/api/bgm/youtube-download', {
      method: 'POST',
      body: {
        url,
        name: 'advideo_bgm',
        profile_id: savGetProfileId(),
      },
    });
    if (input) input.value = '';
    const selectedValue = data.filename ? `file:${encodeURIComponent(data.filename)}` : '';
    await savLoadBgmOptions(selectedValue);
    toast(`BGM 다운로드 완료: ${data.filename || '새 음원'}`);
  } catch (e) {
    savSetBgmStatus('YouTube 다운로드에 실패했습니다.', true);
    toast('BGM 다운로드 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> YouTube 다운로드';
    }
  }
}

function savGetBgmRequestOptions() {
  // BGM 체크박스가 꺼져있으면 확정적으로 none
  const bgmCheckbox = document.getElementById('sav-add-bgm');
  if (bgmCheckbox && !bgmCheckbox.checked) {
    return { bgm: 'none', bgm_mode: 'none', bgm_url: '', bgm_file: '' };
  }
  // BGM 체크박스가 켜져있으면 **항상 제미나이 Lyria로 통일** (파일 업로드 선택도 lyria 로 덮어씀)
  return { bgm: 'lyria', bgm_mode: 'lyria', bgm_url: '', bgm_file: '' };
}

function savGetSubtitleOptions() {
  return {
    subtitle_position_y: parseInt(document.getElementById('sav-subtitle-y')?.value || '82', 10) || 82,
    subtitle_width_pct: parseInt(document.getElementById('sav-subtitle-width')?.value || '82', 10) || 82,
    subtitle_font_scale: parseInt(document.getElementById('sav-subtitle-scale')?.value || '100', 10) || 100,
    subtitle_align: document.getElementById('sav-subtitle-align')?.value || 'center',
  };
}

function savAutoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 56)}px`;
}

function savDeleteScene(sceneIdx) {
  const scenes = _savState.script?.scenes || [];
  if (!scenes[sceneIdx]) return;
  if (scenes.length <= 1) {
    toast('최소 1개 씬은 남아 있어야 합니다.', 'error');
    return;
  }
  scenes.splice(sceneIdx, 1);
  _savState.script.scenes = scenes.map((scene, idx) => ({
    ...scene,
    scene_number: idx + 1,
  }));

  const nextSceneImages = {};
  Object.keys(_savState.sceneImages || {}).forEach(key => {
    const idx = parseInt(key, 10);
    if (Number.isNaN(idx) || idx === sceneIdx) return;
    const nextIdx = idx > sceneIdx ? idx - 1 : idx;
    nextSceneImages[nextIdx] = _savState.sceneImages[key];
  });
  _savState.sceneImages = nextSceneImages;

  if (Array.isArray(_savState.sceneResults) && _savState.sceneResults.length) {
    _savState.sceneResults = _savState.sceneResults
      .filter((_, idx) => idx !== sceneIdx)
      .map((item, idx) => ({ ...item, index: idx }));
  }

  savRenderScript();
  savRenderSceneResults();
  toast(`씬 ${sceneIdx + 1}을 삭제했습니다.`);
}

function savNormalizeImageItem(img, source = 'upload') {
  if (!img) return null;
  if (typeof img === 'string') {
    return { url: img, source };
  }
  const url = img.url || img.path || '';
  if (!url) return null;
  return {
    ...img,
    url,
    source: img.source || source,
  };
}

function savGetUploadedImageMeta() {
  return _savState.uploadedImages
    .map(img => savNormalizeImageItem(img, typeof img === 'string' ? 'upload' : (img?.source || 'upload')))
    .filter(Boolean);
}

// 현재 프로필의 로고 + 라이브러리 이미지를 자동으로 가져옴
function savGetProfileImageMeta() {
  const p = window._globalProfileData || {};
  const pid = window._globalProfileId || p.id;
  if (!pid) return [];
  const items = [];
  if (p.logo_path) {
    items.push({
      url: `/api/library/image/${pid}/${encodeURIComponent(p.logo_path)}`,
      source: 'profile-logo',
      label: '로고',
    });
  }
  // images_json 은 문자열 JSON 또는 배열
  let imgs = p.images_json || p.images || [];
  if (typeof imgs === 'string') {
    try { imgs = JSON.parse(imgs); } catch (e) { imgs = []; }
  }
  if (!Array.isArray(imgs)) imgs = [];
  imgs.forEach(function (name, i) {
    if (!name) return;
    items.push({
      url: `/api/library/image/${pid}/${encodeURIComponent(name)}`,
      source: 'profile',
      label: '프로필 #' + (i + 1),
    });
  });
  return items;
}

function savGetAllReferenceImageMeta() {
  const a = savGetUploadedImageMeta();
  const b = savGetProfileImageMeta();
  // 중복 URL 제거
  const seen = new Set(a.map(function (x) { return x.url; }));
  return a.concat(b.filter(function (x) {
    if (seen.has(x.url)) return false;
    seen.add(x.url); return true;
  }));
}

// 1단계(소재)에서 프로필 이미지 선택 UI — 로고 + 라이브러리 이미지를 칩으로 나열
function savRenderProfileImagePicker() {
  const wrap = document.getElementById('sav-profile-image-picker');
  if (!wrap) return;
  const profileImgs = savGetProfileImageMeta();
  if (!profileImgs.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:rgba(0,0,0,0.35);padding:14px;">활성 프로필에 등록된 로고·이미지가 없습니다. 라이브러리에서 먼저 등록하세요.</div>';
    return;
  }
  const uploaded = new Set(savGetUploadedImageMeta().map(x => x.url));
  wrap.innerHTML = profileImgs.map(function (img) {
    const encoded = encodeURIComponent(img.url);
    const picked = uploaded.has(img.url);
    const label = img.source === 'profile-logo' ? '🏷️ 로고' : '👤 ' + (img.label || '프로필');
    return `<button type="button" onclick="savToggleProfileImage(decodeURIComponent('${encoded}'),${picked ? 'false' : 'true'})"
      style="position:relative;width:84px;height:84px;padding:0;border:2px solid ${picked ? '#ff8c00' : 'rgba(255,140,0,0.22)'};border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;flex-shrink:0;opacity:${picked ? 1 : 0.95};"
      title="${escapeHtml(img.label || '')}">
      <img src="${escapeHtml(img.url)}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <span style="position:absolute;left:4px;bottom:4px;padding:2px 5px;border-radius:999px;background:rgba(0,0,0,0.7);color:#fff;font-size:9px;font-weight:700;">${label}</span>
      ${picked
        ? '<span style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:999px;background:#34c759;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;">✓</span>'
        : '<span style="position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:999px;background:rgba(255,140,0,0.9);color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">+</span>'}
    </button>`;
  }).join('');
}

function savToggleProfileImage(url, add) {
  if (!url) return;
  if (add === true || add === 'true') {
    const added = savAddGlobalImage({ url: url, source: 'profile' }, 'profile');
    if (!added) return;
  } else {
    _savState.uploadedImages = _savState.uploadedImages.filter(function (img) {
      const u = (typeof img === 'string') ? img : (img && img.url);
      return u !== url;
    });
  }
  savRenderImages();
  savRenderProfileImagePicker();
  try { if (typeof savUpdateStepProgress === 'function') savUpdateStepProgress(); } catch (_) {}
}
window.savRenderProfileImagePicker = savRenderProfileImagePicker;
window.savToggleProfileImage = savToggleProfileImage;

function savAddGlobalImage(img, source = 'upload') {
  const item = savNormalizeImageItem(img, source);
  if (!item?.url) return false;
  const exists = savGetUploadedImageMeta().some(existing => existing.url === item.url);
  if (exists) return false;
  _savState.uploadedImages.push(item);
  // 스크립트가 이미 있으면 모든 씬에 자동 추가 (1단계 입력 = 전체)
  try {
    const scenes = (_savState.script && _savState.script.scenes) || [];
    scenes.forEach(function (_s, idx) {
      _savState.sceneImages[idx] = _savState.sceneImages[idx] || [];
      if (_savState.sceneImages[idx].indexOf(item.url) < 0) {
        _savState.sceneImages[idx].push(item.url);
      }
    });
  } catch (e) { /* ignore */ }
  return true;
}

// ── 이미지 업로드 ──
async function savUploadImages() {
  const input = document.getElementById('sav-images');
  if (!input?.files?.length) return;
  await savUploadFiles(Array.from(input.files));
  if (input) input.value = '';
}

async function savUploadFiles(files) {
  const statusEl = document.getElementById('sav-upload-status');
  const imageFiles = (files || []).filter(function (f) { return f && f.type && f.type.startsWith('image/'); });
  if (!imageFiles.length) { toast('이미지 파일이 아닙니다', 'error'); return; }
  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = imageFiles.length + '장 업로드 중...'; }
  try {
    const formData = new FormData();
    imageFiles.forEach(function (file) { formData.append('files', file); });
    const res = await fetch('/api/content/upload-image', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let added = 0;
    (data.images || []).forEach(img => {
      if (savAddGlobalImage(img, 'upload')) added++;
    });
    savRenderImages();
    if (_savState.script?.scenes?.length) savRenderScript();
    toast(`${added || (data.images || []).length}장 업로드 완료 · 분류 중...`);
    // 🆕 업로드 이미지 자동 분류 (인물/상품/로고/배경/그래픽/텍스트)
    try {
      for (const img of (data.images || [])) {
        const imgPath = img.path || '';
        const imgUrl = img.url || '';
        if (!imgPath && !imgUrl) continue;
        try {
          const cls = await api('/api/advideo/classify-image', {
            method: 'POST',
            body: { image_path: imgPath, image_url: imgUrl },
          });
          // _savState.uploadedImages 에서 해당 이미지 찾아 role 저장
          const meta = savGetUploadedImageMeta();
          const match = meta.find(m => m.url === imgUrl || m.path === imgPath);
          if (match) {
            const idx = _savState.uploadedImages.findIndex(u => (u?.url || u?.path) === (match.url || match.path));
            if (idx >= 0) {
              const orig = _savState.uploadedImages[idx];
              if (typeof orig === 'object') {
                orig.role = cls.role;
                orig.role_description = cls.description;
                orig.usage_hint = cls.usage_hint;
              }
            }
          }
        } catch (_) { /* 분류 실패 무시 */ }
      }
      savRenderImages();
      savRenderBriefImages();
    } catch (_) {}
  } catch (e) {
    toast('업로드 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

// 드래그앤드롭 + 붙여넣기 바인딩 (savInit 에서 호출)
function savBindDropZone() {
  const zone = document.getElementById('sav-drop-zone');
  if (!zone || zone.dataset.bound === '1') return;
  zone.dataset.bound = '1';
  const defaultBg = 'rgba(255,140,0,0.03)';
  const activeBg = 'rgba(255,140,0,0.12)';
  const defaultBorder = 'rgba(255,140,0,0.35)';
  const activeBorder = '#ff8c00';

  function setActive(on) {
    zone.style.background = on ? activeBg : defaultBg;
    zone.style.borderColor = on ? activeBorder : defaultBorder;
    zone.style.transform = on ? 'scale(1.01)' : 'none';
  }

  ['dragenter', 'dragover'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); setActive(true); });
  });
  ['dragleave', 'dragend'].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); setActive(false); });
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); e.stopPropagation(); setActive(false);
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (files.length) savUploadFiles(files);
  });

  // 전역 paste 핸들러 (페이지가 single-advideo 일 때만)
  if (!window._savPasteBound) {
    window._savPasteBound = true;
    document.addEventListener('paste', function (e) {
      if (document.getElementById('page-single-advideo')?.classList.contains('active') !== true) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      const files = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file' && it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        savUploadFiles(files);
      }
    });
  }
}

function savRenderImages() {
  const wrap = document.getElementById('sav-image-preview');
  if (!wrap) return;
  if (!_savState.uploadedImages.length) {
    wrap.innerHTML = '';
    return;
  }
  const roleMap = {
    person: { icon: '🧍', label: '인물', color: '#ff8c00' },
    product: { icon: '📦', label: '상품', color: '#5856d6' },
    logo: { icon: '🏷', label: '로고', color: '#34c759' },
    scene: { icon: '🏞', label: '배경', color: '#007aff' },
    graphic: { icon: '🎨', label: '그래픽', color: '#af52de' },
    text: { icon: '📝', label: '텍스트', color: '#ff3b30' },
  };
  wrap.innerHTML = savGetUploadedImageMeta().map((img, idx) => {
    const url = img.url;
    const sourceLabel = img.source === 'url' ? 'URL' : (img.source === 'ai' ? 'AI' : '업로드');
    const orig = _savState.uploadedImages.find(u => (u?.url || u?.path) === (img.url || img.path));
    const role = (orig && typeof orig === 'object') ? orig.role : null;
    const roleInfo = role ? roleMap[role] : null;
    return `<div style="position:relative;border:2px solid ${roleInfo ? roleInfo.color : 'rgba(255,140,0,0.3)'};border-radius:10px;overflow:hidden;">
      <img src="${escapeHtml(url)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;">
      <div style="position:absolute;left:4px;bottom:4px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,0.65);color:#fff;font-size:10px;font-weight:700;">${sourceLabel}</div>
      ${roleInfo ? `<div style="position:absolute;right:4px;bottom:4px;padding:2px 6px;border-radius:999px;background:${roleInfo.color};color:#fff;font-size:10px;font-weight:700;">${roleInfo.icon} ${roleInfo.label}</div>` : ''}
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <span style="background:rgba(255,140,0,0.85);color:#fff;font-size:16px;font-weight:900;width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;">${idx}</span>
      </div>
      <button type="button" onclick="savRemoveImage(${idx})" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border:none;border-radius:999px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;cursor:pointer;">×</button>
    </div>`;
  }).join('');
}

// 2단계 브리프 패널의 소재 이미지 프리뷰 — 1단계 업로드 상태와 동기화
function savRenderBriefImages() {
  const wrap = document.getElementById('sav-brief-img-preview');
  const count = document.getElementById('sav-brief-img-count');
  if (!wrap && !count) return;
  const meta = savGetUploadedImageMeta();
  if (count) count.textContent = `(${meta.length}장)`;
  if (!wrap) return;
  if (!meta.length) {
    wrap.innerHTML = '<span style="font-size:11px;color:rgba(0,0,0,0.4);">아직 업로드된 소재가 없습니다. 우측 버튼으로 추가하거나 🤖 AI 추천을 사용하세요.</span>';
    return;
  }
  wrap.innerHTML = meta.map((img, idx) => {
    const url = img.url;
    const label = img.source === 'ai' ? 'AI' : (img.source === 'url' ? 'URL' : '업로드');
    const badgeColor = img.source === 'ai' ? 'rgba(255,107,0,0.85)' : 'rgba(0,0,0,0.65)';
    return `<div style="position:relative;width:52px;height:52px;border:1.5px solid rgba(255,140,0,0.3);border-radius:8px;overflow:hidden;flex:0 0 auto;">
      <img src="${escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="position:absolute;left:2px;bottom:2px;padding:1px 4px;border-radius:999px;background:${badgeColor};color:#fff;font-size:8px;font-weight:700;">${label}</div>
      <button type="button" onclick="savRemoveImage(${idx})" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border:none;border-radius:999px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;line-height:1;cursor:pointer;">×</button>
    </div>`;
  }).join('');
}
window.savRenderBriefImages = savRenderBriefImages;

// AI 추천 — 주제/메시지/참고 이미지 기반으로 현재 설정 엔진이 소재 이미지 N장 생성
async function savSuggestImagesAI() {
  const topic = (document.getElementById('sav-topic')?.value || '').trim();
  const message = (document.getElementById('sav-message')?.value || '').trim();
  if (!topic && !message) { toast('먼저 주제 또는 메시지를 입력하세요', 'error'); return; }
  const btn = document.getElementById('sav-brief-ai-btn');
  const originalLabel = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 생성 중...'; }
  try {
    const profile = window._globalProfileData || {};
    const count = parseInt(document.getElementById('sav-brief-ai-count')?.value || '3') || 3;
    const res = await api('/api/advideo/suggest-images', {
      method: 'POST',
      body: {
        topic,
        message,
        brand_name: profile.name || '',
        industry: profile.business_type || profile.industry || '',
        count,
        image_urls: savGetImageUrls().slice(0, 6),
      },
    });
    const imgs = (res && res.images) || [];
    if (!imgs.length) { toast('AI 추천 이미지를 받지 못했습니다', 'error'); return; }
    let added = 0;
    imgs.forEach(img => { if (savAddGlobalImage(img, 'ai')) added++; });
    savRenderImages();
    savRenderBriefImages();
    if (_savState.script?.scenes?.length) savRenderScript();
    savRememberAiUsageFromResponse('suggest-images-plan', '소재 이미지 프롬프트', res, 'plan_provider', 'plan_model');
    savRememberAiUsageFromResponse('suggest-images-render', '소재 이미지 생성', res, 'image_provider', 'image_model');
    toast(`AI 추천 이미지 ${added}장 추가`);
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalLabel || '🤖 AI 추천'; }
  }
}
window.savSuggestImagesAI = savSuggestImagesAI;

// 스토리텔링 각도 AI 추천 — 주제/메시지/브랜드를 바탕으로 각도 + 구체 소재를 제안
async function savSuggestStoryAngleAI() {
  const topic = (document.getElementById('sav-topic')?.value || '').trim();
  const message = (document.getElementById('sav-message')?.value || '').trim();
  if (!topic && !message) { toast('먼저 주제 또는 메시지를 입력하세요', 'error'); return; }
  const btn = document.getElementById('sav-story-ai-btn');
  const original = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 생성 중...'; }
  try {
    const profile = window._globalProfileData || {};
    const imageUrls = savGetImageUrls();
    const res = await api('/api/advideo/suggest-story-angle', {
      method: 'POST',
      body: {
        topic,
        message,
        brand_name: profile.name || '',
        industry: profile.business_type || profile.industry || '',
        image_urls: imageUrls.slice(0, 6),
      },
    });
    const angle = (res && res.angle) || 'auto';
    const detail = (res && res.detail) || '';
    const reason = (res && res.reason) || '';
    savRememberAiUsageFromResponse('suggest-story-angle', '스토리 각도 추천', res);
    const sel = document.getElementById('sav-story-angle');
    if (sel) {
      const opt = Array.from(sel.options).find(o => o.value === angle);
      if (opt) sel.value = angle; else sel.value = 'auto';
    }
    const det = document.getElementById('sav-story-detail');
    if (det) det.value = detail;
    toast(reason ? `추천: ${reason}` : 'AI가 스토리 각도를 추천했습니다', 'success');
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = original || '🤖 AI 추천'; }
  }
}
window.savSuggestStoryAngleAI = savSuggestStoryAngleAI;

// 주제 AI 추천
async function savSuggestTopicAI() {
  const btn = document.getElementById('sav-topic-ai-btn');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 생성 중...'; }
  try {
    const profile = window._globalProfileData || {};
    const imageUrls = savGetImageUrls();
    const res = await api('/api/advideo/suggest-brief', {
      method: 'POST',
      body: {
        field: 'topic',
        brand_name: profile.name || '',
        industry: profile.business_type || '',
        description: profile.description || '',
        keywords: profile.keywords || '',
        current_topic: (document.getElementById('sav-topic')?.value || '').trim(),
        current_message: (document.getElementById('sav-message')?.value || '').trim(),
        image_urls: imageUrls.slice(0, 6),
        free_seed: (document.getElementById('sav-free-seed')?.value || '').trim(),
      },
    });
    const topic = (res && res.topic) || '';
    savRememberAiUsageFromResponse('suggest-topic', '주제 추천', res);
    const el = document.getElementById('sav-topic');
    if (el && topic) { el.value = topic; toast('주제 추천 완료', 'success'); }
    else toast('추천 결과가 비어있습니다', 'error');
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🤖 AI 추천'; }
  }
}
window.savSuggestTopicAI = savSuggestTopicAI;

// 메시지 AI 추천
async function savSuggestMessageAI() {
  const btn = document.getElementById('sav-message-ai-btn');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 생성 중...'; }
  try {
    const profile = window._globalProfileData || {};
    const imageUrls = savGetImageUrls();
    const res = await api('/api/advideo/suggest-brief', {
      method: 'POST',
      body: {
        field: 'message',
        brand_name: profile.name || '',
        industry: profile.business_type || '',
        description: profile.description || '',
        keywords: profile.keywords || '',
        current_topic: (document.getElementById('sav-topic')?.value || '').trim(),
        current_message: (document.getElementById('sav-message')?.value || '').trim(),
        image_urls: imageUrls.slice(0, 6),
      },
    });
    const message = (res && res.message) || '';
    savRememberAiUsageFromResponse('suggest-message', '메시지 추천', res);
    const el = document.getElementById('sav-message');
    if (el && message) { el.value = message; toast('메시지 추천 완료', 'success'); }
    else toast('추천 결과가 비어있습니다', 'error');
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🤖 AI 추천'; }
  }
}
window.savSuggestMessageAI = savSuggestMessageAI;

// 브리프 전체(주제+메시지+스토리 각도+소재) 한 번에 추천
async function savSuggestBriefAll() {
  const btn = document.getElementById('sav-brief-ai-all-btn');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🤖 추천 중...'; }
  try {
    const profile = window._globalProfileData || {};
    const imageUrls = savGetImageUrls();
    const freeSeed = (document.getElementById('sav-free-seed')?.value || '').trim();
    // 리서치 인사이트가 있으면 description 에 자동 주입
    const ri = _savState.research?.insights || {};
    const researchHint = Object.keys(ri).length ? `\n\n[데스크 리서치]\n${JSON.stringify(ri).slice(0, 1000)}` : '';
    // 🎲 다양성 — 이전 추천 주제 누적 추적해 백엔드에 회피 요청
    if (!_savState._suggestedTopics) _savState._suggestedTopics = [];
    const res = await api('/api/advideo/suggest-brief', {
      method: 'POST',
      body: {
        field: 'all',
        brand_name: profile.name || '',
        industry: profile.business_type || '',
        description: (profile.description || '') + researchHint,
        keywords: profile.keywords || '',
        current_topic: (document.getElementById('sav-topic')?.value || '').trim(),
        current_message: (document.getElementById('sav-message')?.value || '').trim(),
        image_urls: imageUrls.slice(0, 6),
        free_seed: freeSeed,
        avoid_topics: _savState._suggestedTopics.slice(-15),
        product_type: document.getElementById('sav-product-type')?.value || 'physical',
        ad_objective: document.getElementById('sav-ad-objective')?.value || 'awareness',
      },
    });
    const topic = (res && res.topic) || '';
    const message = (res && res.message) || '';
    const angle = (res && res.angle) || '';
    const detail = (res && res.detail) || '';
    savRememberAiUsageFromResponse('suggest-brief-all', '브리프 한 번에 추천', res);
    if (topic) {
      _savState._suggestedTopics.push(topic);  // 다음 호출에 회피 리스트로
      const el = document.getElementById('sav-topic'); if (el) el.value = topic;
    }
    if (message) { const el = document.getElementById('sav-message'); if (el) el.value = message; }
    if (angle) {
      const sel = document.getElementById('sav-story-angle');
      if (sel) {
        const opt = Array.from(sel.options).find(o => o.value === angle);
        sel.value = opt ? angle : 'auto';
      }
    }
    if (detail) { const el = document.getElementById('sav-story-detail'); if (el) el.value = detail; }
    toast('AI가 주제·메시지·스토리를 모두 채웠습니다. 편집해서 사용하세요.', 'success');
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🤖 주제·메시지·스토리 한 번에 추천'; }
  }
}
window.savSuggestBriefAll = savSuggestBriefAll;

// 500종 라이브러리에서 유니크 스타일 3종 추천
async function savSuggestUniqueStyles() {
  const btn = document.getElementById('sav-style-unique-btn');
  const orig = btn?.innerHTML || '';
  const resultBox = document.getElementById('sav-style-unique-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '🎨 생성 중...'; }
  if (resultBox) { resultBox.style.display = 'block'; resultBox.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:rgba(0,0,0,0.5);">AI가 500개 중 고르는 중...</div>'; }
  try {
    const profile = window._globalProfileData || {};
    const imageUrls = savGetImageUrls();
    const res = await api('/api/advideo/suggest-unique-style', {
      method: 'POST',
      body: {
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_angle: (document.getElementById('sav-story-angle')?.value || 'auto').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        brand_name: profile.name || '',
        industry: profile.business_type || '',
        image_urls: imageUrls.slice(0, 6),
        avoid_codes: _savState._avoidStyleCodes || [],
        count: 3,
      },
    });
    const list = (res && res.suggestions) || [];
    if (!list.length) { toast('추천 결과가 비어있습니다', 'error'); return; }
    savRememberAiUsageFromResponse('suggest-unique-style', '유니크 스타일 추천', res);
    _savState._uniqueStyleSuggestions = list;
    if (resultBox) {
      resultBox.innerHTML = list.map((s, i) => `
        <div style="padding:10px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:10px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">
            <div style="font-size:12px;font-weight:800;color:#1c1c1e;flex:1;">${i+1}. ${escapeHtml(s.label)}</div>
            <button type="button" onclick="savPickUniqueStyle(${i})" style="flex:0 0 auto;padding:4px 10px;font-size:10px;font-weight:700;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;cursor:pointer;">이 스타일 선택</button>
          </div>
          <div style="font-size:10px;color:rgba(0,0,0,0.55);margin-bottom:4px;">${escapeHtml(s.desc)}</div>
          ${s.pitch ? `<div style="font-size:11px;color:#ff6b00;font-weight:600;margin-top:4px;">💡 ${escapeHtml(s.pitch)}</div>` : ''}
          ${s.hook ? `<div style="font-size:11px;color:rgba(0,0,0,0.7);margin-top:2px;">🎬 오프닝 훅: ${escapeHtml(s.hook)}</div>` : ''}
        </div>
      `).join('') + `<button type="button" onclick="savSuggestUniqueStyles()" style="width:100%;padding:6px;font-size:10px;font-weight:700;border:1px dashed rgba(255,140,0,0.4);background:rgba(255,140,0,0.06);color:#ff6b00;border-radius:8px;cursor:pointer;margin-top:4px;">🔄 다른 유니크 3종 보기</button>`;
    }
    // 피해야 할 코드에 추가해 다음 호출 시 중복 회피
    _savState._avoidStyleCodes = (_savState._avoidStyleCodes || []).concat(list.map(s => s.code));
  } catch (e) {
    toast('AI 추천 실패: ' + (e?.message || e), 'error');
    if (resultBox) resultBox.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:#ff3b30;">추천에 실패했습니다. 다시 시도해주세요.</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎨 유니크 3종 추천'; }
  }
}
window.savSuggestUniqueStyles = savSuggestUniqueStyles;

// 추천 결과 중 하나를 선택해 sav-style 셀렉트에 반영
function savPickUniqueStyle(idx) {
  const list = _savState._uniqueStyleSuggestions || [];
  const picked = list[idx];
  if (!picked) return;
  const sel = document.getElementById('sav-style');
  if (!sel) return;
  // 기존 __unique__ 옵션 제거
  Array.from(sel.options).forEach(opt => { if (opt.dataset.unique === '1') opt.remove(); });
  // 새 optgroup + option 생성
  let og = sel.querySelector('optgroup[data-unique-group="1"]');
  if (!og) {
    og = document.createElement('optgroup');
    og.label = '🤖 AI 유니크 추천';
    og.setAttribute('data-unique-group', '1');
    sel.insertBefore(og, sel.firstChild);
  }
  const opt = document.createElement('option');
  opt.value = picked.code;
  opt.textContent = picked.label;
  opt.dataset.unique = '1';
  og.appendChild(opt);
  sel.value = picked.code;
  _savState._uniqueStylePicked = picked;
  toast(`선택: ${picked.label}`, 'success');
}
window.savPickUniqueStyle = savPickUniqueStyle;

// 감독 AI 모델 선택은 설정 페이지에서 처리 — 여기서는 서버가 자동으로 MODELS.director_model 을 사용함
