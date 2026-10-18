const API = '';
let lastPostId = null;
let modalPostId = null;

// ═══════════════════════════════════════════════════════
// 전역 콘텐츠 옵션 (Single Source of Truth)
// 프로필 선택 시 세팅 → 모든 화면에서 getContentOpts()로 읽기
// ═══════════════════════════════════════════════════════
window._contentOpts = {
  // AI 모델
  text_provider: 'cli',
  text_model: '',
  image_provider: 'gemini',
  image_model: '',
  // 블로그
  tone: 'professional',
  blog_length: 'medium',
  threads_length: 'medium',
  threads_mode: 'auto',
  twitter_length: 'medium',
  comma_rate: 50,
  period_rate: 70,
  human_level: 'light',
  // 카드뉴스
  cn_style: 'ai-auto',
  cn_slides: '5',
  cn_photo_count: '1',
  cn_ratio: '1:1',
  cn_resolution: '1K',
  cn_color: '',
  // 영상
  tts_type: 'gemini',
  voice: 'gemini-Kore',
  gemini_voice: 'Kore',
  elevenlabs_voice_id: '',
  video_ratio: '9:16',
  camera: 'subtle',
  bgm: 'random',
  bgm_url: '',
  narration: 'on',
  veo_duration: '8',
  subtitle: 'minimal',  // promo, minimal, news, pop, neon, cinematic, none
  subtitle_font: 'nanum-square',  // nanum-square, nanum-gothic, pretendard
  // 만화
  comic_panels: '6',
  comic_style: 'cute',
  // 블로그 이미지
  blog_image_count: 0,  // 0=없음, 'auto'=AI 자동
  gen_blog_images: false,  // 블로그 이미지 생성 여부
  // 로고
  logo_insert: false,
  logo_cardnews: true,
  logo_blogimg: true,
  logo_comic: false,
  // 웹 검색 보강
  web_search_enhance: false,
  web_search_keyword: '',
  // 콘텐츠 종류 (개별 boolean)
  gen_blog: true,
  gen_sns: true,
  gen_cardnews: true,
  gen_comic: false,
  gen_video_slide: true,
  gen_video_veo: false,
  veo_mode: 'veo-api',
  gen_detail_page: false,
  // 호환용
  image_type: 'cardnews',
  video_type: 'slide',
};

/** 전역 옵션 가져오기 */
function getContentOpts() { return window._contentOpts; }
function getOpt(key, fallback) { return window._contentOpts[key] ?? fallback; }
function setOpt(key, val) { window._contentOpts[key] = val; }

function normalizeTtsOptions(raw = {}) {
  const voice = typeof raw.voice === 'string' ? raw.voice : '';
  const geminiVoice =
    (typeof raw.gemini_voice === 'string' && raw.gemini_voice) ||
    (voice.startsWith('gemini-') ? voice.replace('gemini-', '') : '') ||
    'Kore';
  return {
    ...raw,
    tts_type: 'gemini',
    gemini_voice: geminiVoice,
    voice: `gemini-${geminiVoice}`,
    elevenlabs_voice_id: '',
  };
}

function normalizeBgmOptions(raw = {}) {
  const bgmUrl = typeof raw.bgm_url === 'string' ? raw.bgm_url : '';
  const requestedMode = String(raw.bgm_mode || '').trim().toLowerCase();
  const requestedChoice = String(raw.bgm || '').trim().toLowerCase();
  const wantsSelected = (requestedMode === 'selected' || requestedMode === 'profile' || requestedMode === 'library' || requestedChoice === 'selected') && !!bgmUrl;
  return {
    ...raw,
    bgm: wantsSelected ? 'selected' : 'random',
    bgm_mode: wantsSelected ? 'selected' : 'random',
  };
}

/** 프로필의 content_options + platform_accounts로 전역 옵션 세팅 */
function loadProfileToGlobalOpts(profile) {
  const o = window._contentOpts;
  // content_options — 기본값 정의 후 프로필 값으로 덮어쓰기
  const defaults = {
    tone: 'mystyle', blog_length: 'medium', threads_length: 'medium', threads_mode: 'auto', twitter_length: 'medium', blog_image_count: 0, gen_blog_images: false,
    comma_rate: 50, period_rate: 70, human_level: 'light',
    logo_insert: false,
    logo_cardnews: false, logo_blogimg: false, logo_comic: false,
    cn_style: 'ai-auto', cn_slides: '5', cn_photo_count: '1', cn_ratio: '1:1', cn_resolution: '1K', cn_color: '',
    tts_type: 'gemini', voice: 'gemini-Kore', gemini_voice: 'Kore', elevenlabs_voice_id: '',
    video_ratio: '9:16', camera: 'subtle',
    bgm: 'random', bgm_url: '', bgm_mood: 'calm piano', bgm_bpm: '90', bgm_duration: 'auto', bgm_mode: 'random',
    narration: 'full', subtitle: 'promo', veo_duration: '8', veo_mode: 'veo-api',
    comic_panels: '6', comic_style: 'cute',
    gen_blog: true, gen_sns: true, gen_cardnews: true, gen_comic: false,
    gen_video_slide: true, gen_video_veo: false, gen_detail_page: false,
    image_type: 'cardnews', video_type: 'slide',
  };
  try {
    const co = normalizeBgmOptions(normalizeTtsOptions(profile.content_options ? (typeof profile.content_options === 'string' ? JSON.parse(profile.content_options) : profile.content_options) : {}));
    console.log('[loadProfileToGlobalOpts] content_options:', JSON.stringify(co).substring(0, 200));
    // 기본값으로 리셋 후 프로필 값 적용 (이전 프로필 값이 남지 않도록)
    for (const [k, v] of Object.entries(defaults)) {
      o[k] = (co[k] !== undefined && co[k] !== null) ? co[k] : v;
    }
    // 숫자형 보정
    o.comma_rate = parseInt(o.comma_rate);
    o.period_rate = parseInt(o.period_rate);
    o.blog_image_count = parseInt(o.blog_image_count);
    o.gen_blog_images = !!(co.gen_blog_images || o.blog_image_count > 0);
    o.cn_slides = String(o.cn_slides);
    o.cn_photo_count = String(Math.max(1, Math.min(3, parseInt(o.cn_photo_count || '1', 10) || 1)));
    o.comic_panels = String(o.comic_panels);
    o.tone = 'mystyle';
    console.log('[loadProfileToGlobalOpts] blog_image_count:', co.blog_image_count, '→', o.blog_image_count);
  } catch {}
  // platform_accounts (gen 설정)
  try {
    const pa = profile.platform_accounts ? (typeof profile.platform_accounts === 'string' ? JSON.parse(profile.platform_accounts) : profile.platform_accounts) : {};
    console.log('[loadProfileToGlobalOpts] platform_accounts:', JSON.stringify(pa).substring(0, 200));
    o.gen_blog = pa.gen_blog ?? defaults.gen_blog;
    o.gen_sns = pa.gen_sns ?? defaults.gen_sns;
    o.gen_cardnews = pa.gen_cardnews ?? defaults.gen_cardnews;
    o.gen_comic = pa.gen_comic ?? defaults.gen_comic;
    o.gen_video_slide = pa.gen_video_slide ?? defaults.gen_video_slide;
    o.gen_video_veo = pa.gen_video_veo ?? defaults.gen_video_veo;
    o.gen_detail_page = pa.gen_detail_page ?? defaults.gen_detail_page;
    // 옛 방식 호환 (image_type/video_type → boolean 변환)
    if (pa.gen_cardnews === undefined && pa.image_type) {
      o.gen_cardnews = pa.image_type === 'cardnews';
      o.gen_comic = pa.image_type === 'comic';
    }
    if (pa.gen_video_slide === undefined && pa.video_type) {
      o.gen_video_slide = pa.video_type === 'slide';
      o.gen_video_veo = pa.video_type === 'veo';
    }
    // 호환용 단일값도 유지
    o.image_type = o.gen_cardnews ? 'cardnews' : o.gen_comic ? 'comic' : 'none';
    o.video_type = o.gen_video_veo ? 'veo' : o.gen_video_slide ? 'slide' : 'none';
  } catch {}
  // 자막 라벨 업데이트
  const subMap = {promo:'홍보 (화려)',minimal:'미니멀',news:'뉴스 (박스)',pop:'팝 (노란색)',neon:'네온',cinematic:'시네마틱',none:'없음'};
  const subLabel = document.getElementById('kc-video-subtitle-label');
  if (subLabel) subLabel.textContent = subMap[o.subtitle] || o.subtitle;
  // 만화 라벨 업데이트
  const comicStyleMap = {cute:'귀여운',webtoon:'웹툰',comic:'만화',realistic:'리얼리스틱',chibi:'치비',manga:'일본만화',gag:'개그만화','slice-of-life':'일상툰',minimalist:'미니멀'};
  const comicStyleLabel = document.getElementById('kc-comic-style-label');
  if (comicStyleLabel) comicStyleLabel.textContent = comicStyleMap[o.comic_style] || o.comic_style;
  const comicPanelsLabel = document.getElementById('kc-comic-panels-label');
  if (comicPanelsLabel) comicPanelsLabel.textContent = `${o.comic_panels || 6}컷 자연 구성`;
}

/** 전역 옵션 → 특정 화면 UI에 반영 */
function syncOptsToUI(screen) {
  const o = window._contentOpts;
  const setRadio = (name, val) => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.checked = r.value === String(val);
      r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
    });
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) { el.checked = val; el.closest('label.qs-btn')?.classList.toggle('qs-active', val); }
  };
  const setSelect = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  if (screen === 'kc' || screen === 'all') {
    // 4단계 UI
    // 톤: 체크박스 (단일 선택 처럼 사용)
    document.querySelectorAll('input[name="kc-tone"]').forEach(c => {
      c.checked = c.value === o.tone;
      c.closest('label.qs-btn')?.classList.toggle('qs-active', c.checked);
    });
    if (o.tone === 'mystyle') {
      const ms = document.getElementById('kc-tone-mystyle');
      if (ms) { ms.checked = true; try { kcToggleMyStyle(true); } catch {} }
    }
    setRadio('kc-blog-length', o.blog_length);
    setRadio('kc-comma', o.comma_rate);
    setRadio('kc-period', o.period_rate);
    setRadio('kc-human', o.human_level);
    // 카드뉴스 스타일 (체크박스)
    document.querySelectorAll('input[name="kc-cn-style"]').forEach(c => {
      c.checked = c.value === o.cn_style;
      c.closest('label.qs-btn')?.classList.toggle('qs-active', c.checked);
    });
    setSelect('kc-cn-slides', o.cn_slides);
    setRadio('kc-cn-ratio', o.cn_ratio);
    // 영상
    setSelect('kc-voice', o.voice);
    setRadio('kc-video-ratio', o.video_ratio);
    setRadio('kc-camera', o.camera);
    // 만화
    setRadio('kc-comic-panels', o.comic_panels);
    setRadio('kc-comic-style', o.comic_style);
    // 이미지/영상 타입
    setRadio('kc-image-type', o.image_type);
    try { kcToggleImageType(o.image_type); } catch {}
    setRadio('kc-video-type', o.video_type);
    // 생성 체크
    setCheck('kc-gen-blog', o.gen_blog);
    setCheck('kc-gen-sns', o.gen_sns);
  }

  if (screen === 'biz' || screen === 'all') {
    // 업종별 카드뉴스 UI
    setRadio('biz-cn-tone', o.tone);
    setRadio('biz-cn-style', o.cn_style);
    setSelect('biz-cn-slides', o.cn_slides);
    setRadio('biz-cn-ratio', o.cn_ratio);
    setRadio('biz-video-ratio', o.video_ratio);
    setSelect('biz-cn-voice', o.voice);
    // 색상
    const colorMap = {warm:'warm',cool:'cool',pastel:'pastel',vivid:'vivid',monochrome:'monochrome','earth-tone':'earth'};
    if (colorMap[o.cn_style]) setRadio('biz-cn-color', colorMap[o.cn_style]);
  }

  if (screen === 'lib' || screen === 'all') {
    // 프로필 편집 모달 UI
    setSelect('lib-opt-tone', o.tone);
    setSelect('lib-opt-length', o.blog_length);
    setSelect('lib-opt-threads-length', o.threads_length || 'medium');
    setSelect('lib-opt-threads-mode', o.threads_mode || 'auto');
    setSelect('lib-opt-twitter-length', o.twitter_length || 'medium');
    const _blogImgOn = document.getElementById('lib-opt-blog-images-on');
    if (_blogImgOn) { _blogImgOn.checked = o.gen_blog_images || o.blog_image_count > 0; _blogImgOn.closest('.qs-btn')?.classList.toggle('qs-active', _blogImgOn.checked); }
    setSelect('lib-opt-comma', String(o.comma_rate));
    setSelect('lib-opt-period', String(o.period_rate));
    setSelect('lib-opt-human', o.human_level);
    setSelect('lib-opt-cn-style', o.cn_style);
    setSelect('lib-opt-cn-slides', o.cn_slides);
    setSelect('lib-opt-cn-photo-count', o.cn_photo_count || '1');
    setSelect('lib-opt-cn-ratio', o.cn_ratio);
    const cnCustomEl = document.getElementById('lib-opt-cn-custom');
    if (cnCustomEl) cnCustomEl.value = o.cn_custom_instructions || '';
    setSelect('lib-opt-tts-type', 'gemini');
    if (typeof libTtsTypeChanged === 'function') libTtsTypeChanged('gemini');
    setSelect('lib-opt-voice-gemini', o.gemini_voice || 'Kore');
    setSelect('lib-opt-video-ratio', o.video_ratio);
    setSelect('lib-opt-camera', o.camera);
    setSelect('lib-opt-bgm', o.bgm);
    setRadio('lib-bgm-mode', o.bgm_mode || 'random');
    setSelect('lib-opt-subtitle', o.subtitle);
    setSelect('lib-opt-subtitle-font', o.subtitle_font);
    setSelect('lib-opt-comic-panels', o.comic_panels);
    setSelect('lib-opt-comic-style', o.comic_style);
    // 로고 옵션 복원
    const _logoIns = document.getElementById('lib-opt-logo-insert');
    if (_logoIns) { _logoIns.checked = !!o.logo_insert; document.getElementById('lib-logo-insert-detail').style.display = o.logo_insert ? 'block' : 'none'; }
    setCheck('lib-gen-blog', o.gen_blog);
    setCheck('lib-gen-sns', o.gen_sns);
    setCheck('lib-gen-cardnews', o.gen_cardnews);
    setCheck('lib-gen-comic', o.gen_comic);
    setCheck('lib-gen-video-slide', o.gen_video_slide);
    setCheck('lib-gen-video-veo', o.gen_video_veo);
    setCheck('lib-gen-detail-page', o.gen_detail_page);
  }
}

/** 현재 활성 화면의 UI에서 전역 옵션으로 읽기 */
function syncUIToOpts(screen) {
  const o = window._contentOpts;
  const getRadio = (name, fb) => document.querySelector(`input[name="${name}"]:checked`)?.value || fb;
  const getCheck = (id) => document.getElementById(id)?.checked || false;
  const getSel = (id, fb) => document.getElementById(id)?.value || fb;

  if (screen === 'kc') {
    const tones = [...document.querySelectorAll('input[name="kc-tone"]:checked')].map(c => c.value);
    o.tone = tones[0] || o.tone;
    o.blog_length = getRadio('kc-blog-length', o.blog_length);
    o.comma_rate = parseInt(getRadio('kc-comma', o.comma_rate));
    o.period_rate = parseInt(getRadio('kc-period', o.period_rate));
    o.human_level = getRadio('kc-human', o.human_level);
    // gen_*, logo_* 는 생성 옵션 모달(saveGlobalOpts)에서만 관리 — 여기서 덮어쓰지 않음
    const cnStyles = [...document.querySelectorAll('input[name="kc-cn-style"]:checked')].map(c => c.value);
    o.cn_style = cnStyles[0] || o.cn_style;
    o.cn_slides = getSel('kc-cn-slides', o.cn_slides);
    o.cn_ratio = getRadio('kc-cn-ratio', o.cn_ratio);
    o.voice = getSel('kc-voice', o.voice);
    o.video_ratio = getRadio('kc-video-ratio', o.video_ratio);
    o.camera = getRadio('kc-camera', o.camera);
    o.comic_panels = '6';
    o.comic_style = getSel('lib-opt-comic-style', o.comic_style) || getRadio('kc-comic-style', o.comic_style);
    // gen_cardnews, gen_comic은 프로필 설정에서 관리 — 라디오 버튼으로 덮어쓰지 않음
    o.video_type = getRadio('kc-video-type', o.video_type);
  }

  if (screen === 'biz') {
    o.tone = getRadio('biz-cn-tone', o.tone);
    o.cn_style = getRadio('biz-cn-style', o.cn_style);
    o.cn_slides = getSel('biz-cn-slides', o.cn_slides);
    o.cn_ratio = getRadio('biz-cn-ratio', o.cn_ratio);
    o.video_ratio = getRadio('biz-video-ratio', o.video_ratio);
    o.voice = getSel('biz-cn-voice', o.voice);
  }

  if (screen === 'lib') {
    o.tone = getSel('lib-opt-tone', o.tone);
    o.blog_length = getSel('lib-opt-length', o.blog_length);
    o.threads_length = getSel('lib-opt-threads-length', o.threads_length || 'medium');
    o.threads_mode = getSel('lib-opt-threads-mode', o.threads_mode || 'auto');
    o.twitter_length = getSel('lib-opt-twitter-length', o.twitter_length || 'medium');
    o.gen_blog_images = !!document.getElementById('lib-opt-blog-images-on')?.checked;
    o.blog_image_count = o.gen_blog_images ? 5 : 0;
    o.comma_rate = parseInt(getSel('lib-opt-comma', o.comma_rate));
    o.period_rate = parseInt(getSel('lib-opt-period', o.period_rate));
    o.human_level = getSel('lib-opt-human', o.human_level);
    o.cn_style = getSel('lib-opt-cn-style', o.cn_style);
    o.cn_slides = getSel('lib-opt-cn-slides', o.cn_slides);
    o.cn_photo_count = getSel('lib-opt-cn-photo-count', o.cn_photo_count || '1');
    o.cn_ratio = getSel('lib-opt-cn-ratio', o.cn_ratio);
    o.cn_custom_instructions = (document.getElementById('lib-opt-cn-custom')?.value || '').trim();
    o.tts_type = 'gemini';
    o.gemini_voice = getSel('lib-opt-voice-gemini', o.gemini_voice || 'Kore');
    o.voice = `gemini-${o.gemini_voice}`;
    o.elevenlabs_voice_id = '';
    o.video_ratio = getSel('lib-opt-video-ratio', o.video_ratio);
    o.camera = getSel('lib-opt-camera', o.camera);
    o.bgm = getSel('lib-opt-bgm', o.bgm);
    o.bgm_mode = getRadio('lib-bgm-mode', o.bgm_mode || 'random');
    o.subtitle = getSel('lib-opt-subtitle', o.subtitle);
    o.subtitle_font = getSel('lib-opt-subtitle-font', o.subtitle_font);
    o.comic_panels = '6';
    o.comic_style = getSel('lib-opt-comic-style', o.comic_style);
    o.logo_insert = document.getElementById('lib-opt-logo-insert')?.checked || false;
    o.logo_cardnews = o.logo_insert;
    o.logo_blogimg = o.logo_insert;
    o.logo_comic = o.logo_insert;
    o.gen_blog = getCheck('lib-gen-blog');
    o.gen_sns = getCheck('lib-gen-sns');
    o.gen_cardnews = getCheck('lib-gen-cardnews');
    o.gen_comic = getCheck('lib-gen-comic');
    o.gen_video_slide = getCheck('lib-gen-video-slide');
    o.gen_video_veo = getCheck('lib-gen-video-veo');
    o.gen_detail_page = getCheck('lib-gen-detail-page');
    o.image_type = o.gen_cardnews ? 'cardnews' : o.gen_comic ? 'comic' : 'none';
    o.video_type = o.gen_video_veo ? 'veo' : o.gen_video_slide ? 'slide' : 'none';
  }
}

/** 옵션 요약 한줄 텍스트 */
function getOptsSummary() {
  const o = window._contentOpts;
  const toneMap = {professional:'전문적',friendly:'친근한',informative:'정보전달',casual:'캐주얼',humorous:'유머',storytelling:'스토리텔링',review:'리뷰형',howto:'가이드',comparison:'비교분석',news:'뉴스형',listicle:'리스트형',interview:'인터뷰',emotional:'감성형',persuasive:'마케팅',mystyle:'내 스타일'};
  const parts = [];
  if (o.gen_blog) parts.push('블로그');
  if (o.gen_cardnews) parts.push('카드뉴스');
  if (o.gen_comic) parts.push('만화');
  if (o.gen_sns) parts.push('스레드/트위터');
  if (o.gen_video_slide) parts.push('슬라이드영상');
  if (o.gen_video_veo) parts.push('AI영상');
  if (o.gen_detail_page) parts.push('상세페이지');
  const imgLabel = o.gen_blog_images ? ' · 이미지 AI자동' : '';
  const cnPhotoLabel = o.cn_photo_count ? ` · 사진 ${o.cn_photo_count}장` : '';
  return `${parts.join('+')} · ${toneMap[o.tone]||o.tone} · ${o.blog_length==='short'?'짧게':o.blog_length==='long'?'길게':'보통'}${imgLabel} · ${o.cn_style} ${o.cn_slides}장${cnPhotoLabel}`;
}

/** 옵션 요약 카드 HTML (각 화면에 삽입용) */
function renderOptsPreview() {
  try {
    const summary = getOptsSummary();
    ['kc-opts-text','biz-opts-text','lib-opts-text'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = summary;
    });
    // 생성 버튼 텍스트도 옵션에 맞게 업데이트
    _updateGenerateBtnLabel();
  } catch(e) { console.log('[renderOptsPreview] error:', e); }
}

function _updateGenerateBtnLabel() {
  const btn = document.getElementById('kc-generate-btn');
  if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>멀티콘텐츠 생성`;
}

async function openProfileContentOptions() {
  if (!window._globalProfileId) {
    toast('먼저 프로필을 선택하세요', 'error');
    return;
  }
  await libShowEditModal(window._globalProfileId);
  const tabBtn = document.getElementById('lib-tab-opts');
  if (tabBtn) libSwitchTab('opts', tabBtn);
}

/** 공용 옵션 편집 모달 열기 */
function openGlobalOptsModal() {
  return openProfileContentOptions();

  let modal = document.getElementById('global-opts-modal');
  if (modal) { modal.style.display = 'flex'; _syncGlobalModalFromOpts(); goToggleSections(); return; }
  console.log('[openGlobalOptsModal] creating modal');

  modal = document.createElement('div');
  modal.id = 'global-opts-modal';
  modal.style.cssText = 'display:flex;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div class="modal" style="max-width:560px;max-height:85vh;overflow-y:auto;">
      <button class="modal-close" onclick="closeGlobalOptsModal()">&times;</button>
      <h2 style="margin-bottom:14px;">멀티콘텐츠 생성 옵션</h2>

      <!-- AI 모델 (설정 페이지에서 관리, 여기서는 숨김) -->
      <select id="go-text-model" style="display:none;"></select>
      <select id="go-image-model" style="display:none;"></select>

      <!-- 생성할 콘텐츠 체크박스 -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;padding:12px 14px;background:rgba(0,0,0,0.02);border-radius:12px;">
        <label class="qs-btn go-check-btn qs-active" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-blog" checked style="display:none;" onchange="goUpdateCheckButton(this)"> 블로그</label>
        <label class="qs-btn go-check-btn qs-active" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-sns" checked style="display:none;" onchange="goUpdateCheckButton(this)"> 스레드/트위터</label>
        <label class="qs-btn go-check-btn qs-active" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-cardnews" checked style="display:none;" onchange="goUpdateCheckButton(this);goToggleSections();goSwitchTab()"> 카드뉴스</label>
        <label class="qs-btn go-check-btn" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-comic" style="display:none;" onchange="goUpdateCheckButton(this);goToggleSections();goSwitchTab()"> 스토리 만화</label>
        <label class="qs-btn go-check-btn qs-active" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-video-slide" checked style="display:none;" onchange="goUpdateCheckButton(this);goToggleSections();goSwitchTab()"> 슬라이드 영상</label>
        <label class="qs-btn go-check-btn" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-video-veo" style="display:none;" onchange="goUpdateCheckButton(this);goToggleSections();goSwitchTab()"> AI 영상</label>
        <input type="hidden" id="go-veo-mode" value="veo-api">
        <label class="qs-btn go-check-btn" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;"><input type="checkbox" id="go-gen-detail-page" style="display:none;" onchange="goUpdateCheckButton(this)"> 상세페이지</label>
      </div>
      <select id="go-image-type" style="display:none;"><option value="cardnews"></option><option value="comic"></option><option value="none"></option></select>
      <select id="go-video-type" style="display:none;"><option value="slide"></option><option value="veo"></option><option value="none"></option></select>

      <!-- 탭 -->
      <div style="display:flex;gap:3px;margin-bottom:14px;background:rgba(0,0,0,0.04);padding:3px;border-radius:10px;" id="go-tabs">
        <button onclick="goSwitchTab('write')" class="go-tab go-tab-active" style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:#1c1c1e;box-shadow:0 1px 3px rgba(0,0,0,0.06);">글쓰기</button>
        <button onclick="goSwitchTab('cardnews')" id="go-tab-cardnews" class="go-tab" style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:rgba(0,0,0,0.35);">카드뉴스</button>
        <button onclick="goSwitchTab('video')" id="go-tab-video" class="go-tab" style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:rgba(0,0,0,0.35);">숏폼</button>
        <button onclick="goSwitchTab('comic')" id="go-tab-comic" class="go-tab" style="flex:1;padding:8px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:rgba(0,0,0,0.35);">만화</button>
      </div>

      <!-- 글쓰기 탭 -->
      <div id="go-panel-write">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">글 톤</div>
            <select id="go-tone" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="mystyle">내 스타일</option><option value="professional">전문적인</option><option value="friendly">친근한</option>
              <option value="informative">정보 전달형</option><option value="casual">캐주얼</option><option value="humorous">유머러스</option>
              <option value="storytelling">스토리텔링</option><option value="review">리뷰/후기형</option><option value="howto">하우투/가이드</option>
              <option value="comparison">비교/분석</option><option value="news">뉴스/속보형</option><option value="listicle">리스트형</option>
              <option value="interview">인터뷰/Q&A</option><option value="emotional">감성/공감형</option><option value="persuasive">설득/마케팅</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">블로그 글 길이</div>
            <select id="go-length" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="short">짧게 (1000자)</option><option value="medium">보통 (2000자+)</option><option value="long">길게 (3000자+)</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">쉼표</div>
            <select id="go-comma" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="0">안 씀</option><option value="30">30%</option><option value="50">50%</option><option value="100">전부</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">마침표</div>
            <select id="go-period" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="50">50%</option><option value="70">70%</option><option value="100">전부</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">자연스러움</div>
            <select id="go-human" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="off">꺼짐</option><option value="light">약간</option><option value="heavy">많이</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">블로그 이미지</div>
            <select id="go-blog-img-count" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="0">생성 안 함</option><option value="5">AI 자동 (장수 자동)</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">로고 삽입</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <label class="qs-btn go-check-btn" style="font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;width:fit-content;"><input type="checkbox" id="go-logo-insert" style="display:none;" onchange="goUpdateCheckButton(this);document.getElementById('go-logo-pos-wrap').style.display=this.checked?'block':'none'"> AI 이미지 생성에 로고 참조 사용</label>
              <div id="go-logo-pos-wrap" style="display:none;">
                <div style="font-size:11px;color:rgba(0,0,0,0.45);line-height:1.5;">로고 파일을 AI 이미지 생성 참조로만 전달합니다.</div>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:2px;font-size:10px;color:rgba(0,0,0,0.3);line-height:1.5;">
          <span><strong>자연스러움</strong>: 오타, 구어체, 줄임말 등을 섞어 사람이 쓴 것처럼</span>
        </div>
        <!-- 연결된 스타일 표시 -->
        <div id="go-style-info" style="margin-top:12px;padding:10px 14px;background:rgba(52,199,89,0.04);border:1px solid rgba(52,199,89,0.12);border-radius:10px;display:none;">
          <div style="font-size:10px;font-weight:600;color:#34c759;margin-bottom:4px;">연결된 글쓰기 스타일</div>
          <div id="go-style-detail" style="font-size:12px;color:#1c1c1e;line-height:1.6;"></div>
        </div>
      </div>

      <!-- 카드뉴스 탭 -->
      <div id="go-panel-cardnews" style="display:none;">
        <div id="go-sec-cardnews"></div>
        <div id="go-sec-cardnews-opts" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">디자인</div>
            <select id="go-cn-style" onchange="goRenderStylePreview()" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <optgroup label="기본"><option value="ai-auto">AI 자동</option><option value="modern">모던</option><option value="colorful">컬러풀</option><option value="minimal">미니멀</option><option value="dark">다크</option><option value="cute">귀여운</option><option value="pastel">파스텔</option><option value="retro">레트로</option><option value="gradient">그라데이션</option></optgroup>
              <optgroup label="아트"><option value="handwritten">손글씨</option><option value="watercolor">수채화</option><option value="sketch">스케치</option><option value="magazine">매거진</option><option value="collage">콜라주</option></optgroup>
              <optgroup label="색감"><option value="warm">따뜻한</option><option value="cool">차가운</option><option value="vivid">비비드</option><option value="monochrome">모노크롬</option><option value="earth-tone">어스톤</option></optgroup>
              <optgroup label="업종별"><option value="luxury">럭셔리</option><option value="natural">내추럴</option><option value="medical">메디컬</option><option value="tech">테크</option><option value="food">푸드</option><option value="beauty">뷰티</option><option value="fitness">피트니스</option><option value="education">교육</option></optgroup>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">장수</div>
            <select id="go-cn-slides" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="1">1장</option><option value="2">2장</option><option value="3">3장</option><option value="5">5장</option><option value="7">7장</option><option value="10">10장</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">사진 개수</div>
            <select id="go-cn-photo-count" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="1">1장</option><option value="2">2장</option><option value="3">3장</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">비율</div>
            <select id="go-cn-ratio" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="1:1">1:1</option><option value="9:16">9:16</option><option value="4:5">4:5</option><option value="16:9">16:9</option><option value="3:4">3:4</option><option value="4:3">4:3</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">해상도</div>
            <select id="go-cn-resolution" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="512">512px (₩61/장)</option>
              <option value="1K" selected>1K (₩91/장)</option>
              <option value="2K">2K (₩136/장)</option>
              <option value="4K">4K (₩204/장)</option>
            </select></div>
        </div>
        <!-- 스타일 시각적 미리보기 -->
        <div id="go-cn-style-preview" style="margin-top:12px;">
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:6px;">스타일 미리보기 (클릭하여 선택)</div>
          <div id="go-cn-style-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px;"></div>
        </div>
        <div style="text-align:center;padding:20px;color:rgba(0,0,0,0.25);font-size:12px;" id="go-cardnews-off">카드뉴스가 선택되지 않았습니다</div>
      </div>

      <!-- 영상 탭 -->
      <div id="go-panel-video" style="display:none;">
        <div id="go-sec-video"></div>
        <div id="go-sec-video-opts" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">TTS 모델</div>
            <div style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);background:#fff;color:#1c1c1e;">Gemini TTS</div>
            <input type="hidden" id="go-tts-engine" value="gemini">
            <select id="go-tts-voice-openai" style="display:none;"></select>
            <input id="go-tts-voice-el" style="display:none;">
          </div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">음성</div>
            <select id="go-tts-voice-gemini" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <optgroup label="추천">
                <option value="Kore" selected>Kore — 단호한 (Firm)</option>
                <option value="Zephyr">Zephyr — 밝은 (Bright)</option>
                <option value="Puck">Puck — 활기찬 (Upbeat)</option>
                <option value="Charon">Charon — 정보전달 (Informative)</option>
                <option value="Fenrir">Fenrir — 흥미진진 (Excitable)</option>
                <option value="Leda">Leda — 젊은 (Youthful)</option>
                <option value="Orus">Orus — 확고한 (Firm)</option>
                <option value="Aoede">Aoede — 쾌활한 (Breezy)</option>
              </optgroup>
              <optgroup label="여성">
                <option value="Sulafat">Sulafat — 따뜻한</option>
                <option value="Callirrhoe">Callirrhoe — 차분한</option>
                <option value="Autonoe">Autonoe — 밝은</option>
                <option value="Despina">Despina — 부드러운</option>
                <option value="Erinome">Erinome — 맑은</option>
                <option value="Laomedeia">Laomedeia — 활기찬</option>
                <option value="Pulcherrima">Pulcherrima — 우아한</option>
              </optgroup>
              <optgroup label="남성">
                <option value="Enceladus">Enceladus — 쾌활한</option>
                <option value="Iapetus">Iapetus — 명쾌한</option>
                <option value="Umbriel">Umbriel — 차분한</option>
                <option value="Gacrux">Gacrux — 성숙한</option>
                <option value="Achird">Achird — 친근한</option>
                <option value="Algieba">Algieba — 부드러운</option>
                <option value="Algenib">Algenib — 씩씩한</option>
                <option value="Rasalgethi">Rasalgethi — 정보전달</option>
                <option value="Zubenelgenubi">Zubenelgenubi — 캐주얼</option>
                <option value="Vindemiatrix">Vindemiatrix — 부드러운</option>
              </optgroup>
              <optgroup label="중성/기타">
                <option value="Achernar">Achernar — 부드러운</option>
                <option value="Alnilam">Alnilam — 확고한</option>
                <option value="Schedar">Schedar — 균일한</option>
                <option value="Sadachbia">Sadachbia — 활기찬</option>
                <option value="Sadaltager">Sadaltager — 전문적</option>
              </optgroup>
            </select>
            <select id="go-tts" style="display:none;"><option value="gemini-Kore"></option></select>
          </div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">영상 비율</div>
            <select id="go-video-ratio" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="9:16">9:16 세로</option><option value="1:1">1:1 정사각</option><option value="16:9">16:9 가로</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">카메라</div>
            <select id="go-camera" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="subtle">부드러운</option><option value="minimal">최소</option><option value="moderate">보통</option><option value="dynamic">역동적</option>
            </select></div>
          <div style="grid-column:1/-1;"><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">BGM</div>
            <div style="padding:8px 12px;background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.1);border-radius:8px;font-size:11px;color:rgba(0,0,0,0.4);">
              프로필 편집 > <strong>BGM 탭</strong>에서 Lyria AI 생성, 파일 업로드로 관리합니다
            </div>
            <select id="go-bgm" style="display:none;"><option value="random" selected></option><option value="selected"></option></select>
            <input id="go-bgm-url" style="display:none;">
          </div>
        </div>
        <div style="text-align:center;padding:20px;color:rgba(0,0,0,0.25);font-size:12px;" id="go-video-off">영상이 선택되지 않았습니다</div>
      </div>

      <!-- 만화 탭 -->
      <div id="go-panel-comic" style="display:none;">
        <div id="go-sec-comic"></div>
        <div id="go-sec-comic-opts" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">컷 수</div>
            <select id="go-comic-panels" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <option value="5">5컷</option><option value="6">6컷</option><option value="7">7컷</option><option value="8">8컷</option>
            </select></div>
          <div><div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);margin-bottom:4px;">만화 스타일</div>
            <select id="go-comic-style" style="width:100%;padding:7px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
              <optgroup label="기본">
                <option value="cute">귀여운</option><option value="webtoon">웹툰</option><option value="comic">만화</option>
                <option value="realistic">리얼리스틱</option><option value="chibi">치비</option><option value="anime">애니메</option>
                <option value="manga">일본만화</option><option value="gag">개그만화</option><option value="disney">디즈니</option>
              </optgroup>
              <optgroup label="아트">
                <option value="pixel">픽셀아트</option><option value="watercolor">수채화</option><option value="sketch">연필스케치</option>
                <option value="pop-art">팝아트</option><option value="line-art">라인아트</option><option value="sticker">스티커</option>
                <option value="ink-wash">수묵화</option><option value="claymation">클레이</option><option value="collage">콜라주</option>
              </optgroup>
              <optgroup label="스타일">
                <option value="retro">레트로</option><option value="flat">플랫</option><option value="3d">3D 렌더</option>
                <option value="noir">느와르</option><option value="pastel">파스텔</option><option value="graffiti">그래피티</option>
                <option value="minimalist">미니멀</option>
              </optgroup>
            </select></div>
        </div>
        <div style="text-align:center;padding:20px;color:rgba(0,0,0,0.25);font-size:12px;" id="go-comic-off">만화가 선택되지 않았습니다</div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button onclick="closeGlobalOptsModal()" style="padding:8px 18px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
        <button onclick="saveGlobalOpts()" style="padding:8px 18px;background:#ff8c00;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">적용</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) closeGlobalOptsModal(); });
  document.body.appendChild(modal);
  _syncGlobalModalFromOpts();
  goToggleSections();
}

function goTtsEngineChanged() {
  // Gemini 전용 — 음성 select는 항상 표시
}

function goGetTtsValue() {
  const voice = document.getElementById('go-tts-voice-gemini')?.value || 'Kore';
  return 'gemini-' + voice;
}

function goSetTtsFromValue(voice) {
  const v = document.getElementById('go-tts-voice-gemini');
  if (!v) return;
  v.value = voice?.startsWith('gemini-') ? voice.replace('gemini-', '') : 'Kore';
  const eng = document.getElementById('go-tts-engine');
  if (eng) eng.value = 'gemini';
}

function goToggleBgmUrl() {
  const bgm = document.getElementById('go-bgm')?.value;
  ['go-bgm-url','go-bgm-suno','go-bgm-library'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  if (bgm === 'youtube') document.getElementById('go-bgm-url').style.display = '';
  if (bgm === 'suno') document.getElementById('go-bgm-suno').style.display = '';
  if (bgm === 'library' || bgm === 'selected') { document.getElementById('go-bgm-library').style.display = ''; goLoadBgmLibrary(); }
}

async function goLoadBgmLibrary() {
  const sel = document.getElementById('go-bgm-select');
  if (!sel) return;
  try {
    const res = await api('/api/bgm/list');
    const files = res.files || [];
    sel.innerHTML = '<option value="random">랜덤 선택</option>';
    files.forEach(f => {
      sel.innerHTML += `<option value="${f.path}">${f.name}</option>`;
    });
    document.getElementById('go-bgm-status').textContent = `${files.length}곡 보유`;
  } catch { sel.innerHTML = '<option value="random">랜덤 선택</option>'; }
}

function goPlayBgmPreview() {
  const sel = document.getElementById('go-bgm-select');
  const audio = document.getElementById('go-bgm-audio-preview');
  if (!sel || !audio || sel.value === 'random') { toast('곡을 선택하세요'); return; }
  audio.src = '/api/bgm/file/' + sel.value;
  audio.style.display = '';
  audio.play();
}

async function goSunoAddToLibrary() {
  const prompt = await showInputModal('Suno BGM 생성', '음악 스타일을 설명하세요', '밝은 피아노 BGM, 카페 분위기, 잔잔한');
  if (!prompt) return;
  const btn = document.getElementById('go-suno-add-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span> 생성 중...';
  document.getElementById('go-bgm-status').textContent = 'Suno AI가 음악을 생성 중... (1~3분)';
  try {
    const res = await api('/api/bgm/suno-generate', { method: 'POST', body: { prompt, save_to_library: true } });
    toast('BGM이 라이브러리에 추가되었습니다!');
    goLoadBgmLibrary();
  } catch (e) { toast('생성 실패: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '+ Suno로 추가'; }
}

function goYoutubeAddModal() {
  let modal = document.getElementById('yt-bgm-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'yt-bgm-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:540px;max-width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 4px;">YouTube 무료 음원 검색</h3>
      <p style="font-size:11px;color:rgba(0,0,0,0.4);margin-bottom:12px;">YouTube Audio Library 무료 음원만 검색합니다 (저작권 걱정 없음)</p>

      <!-- 검색 -->
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <input type="text" id="yt-bgm-search" placeholder="검색: calm, piano, upbeat, jazz..." style="flex:1;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.12);" autofocus>
        <button onclick="goYoutubeSearch()" id="yt-bgm-search-btn" style="padding:8px 16px;background:#ff0000;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">검색</button>
      </div>

      <!-- 검색 결과 -->
      <div id="yt-bgm-results" style="margin-bottom:12px;"></div>

      <!-- 또는 URL 직접 입력 -->
      <details style="margin-bottom:12px;">
        <summary style="font-size:11px;color:rgba(0,0,0,0.35);cursor:pointer;">URL 직접 입력</summary>
        <input type="text" id="yt-bgm-url" placeholder="https://youtube.com/watch?v=..." style="width:100%;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);margin-top:6px;">
      </details>

      <input type="text" id="yt-bgm-name" placeholder="저장할 이름 (선택)" style="width:100%;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);margin-bottom:12px;">

      <div id="yt-bgm-progress" style="display:none;padding:10px;text-align:center;margin-bottom:10px;">
        <span class="spinner"></span>
        <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,0.4);" id="yt-bgm-progress-text">다운로드 중...</div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('yt-bgm-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
        <button onclick="goYoutubeDownload()" id="yt-bgm-dl-btn" style="padding:8px 16px;background:#ff0000;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">다운로드</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('yt-bgm-url').focus();
  document.getElementById('yt-bgm-url').addEventListener('keydown', e => { if (e.key === 'Enter') goYoutubeDownload(); });
}

async function goYoutubeSearch() {
  const query = document.getElementById('yt-bgm-search')?.value?.trim();
  if (!query) { toast('검색어를 입력하세요', 'error'); return; }
  const btn = document.getElementById('yt-bgm-search-btn');
  const results = document.getElementById('yt-bgm-results');
  btn.disabled = true; btn.textContent = '검색 중...';
  results.innerHTML = '<div style="text-align:center;padding:16px;"><span class="spinner"></span></div>';
  try {
    const res = await api('/api/bgm/youtube-search', { method: 'POST', body: { query: query + ' bgm no copyright' } });
    const items = res.results || [];
    if (!items.length) {
      results.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.3);font-size:12px;">결과 없음</div>';
      return;
    }
    results.innerHTML = items.map((item, i) => `
      <div onclick="goSelectYtResult('${item.url}','${escapeHtml(item.title).replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background 0.15s;border:1px solid rgba(0,0,0,0.04);margin-bottom:4px;" onmouseenter="this.style.background='rgba(255,0,0,0.03)';this.style.borderColor='rgba(255,0,0,0.15)'" onmouseleave="this.style.background='';this.style.borderColor='rgba(0,0,0,0.04)'">
        <img src="${item.thumbnail}" style="width:64px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;background:rgba(0,0,0,0.06);" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:500;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.title)}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.3);">${item.duration || ''} · ${escapeHtml(item.channel || '')}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    results.innerHTML = `<div style="color:#ff3b30;font-size:12px;padding:10px;">검색 실패: ${e.message}</div>`;
  } finally { btn.disabled = false; btn.textContent = '검색'; }
}

// 엔터키로 검색
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('yt-bgm-search') === document.activeElement) goYoutubeSearch();
});

function goSelectYtResult(url, title) {
  document.getElementById('yt-bgm-url').value = url;
  document.getElementById('yt-bgm-name').value = title.substring(0, 50);
  // 선택 표시
  document.querySelectorAll('#yt-bgm-results > div').forEach(d => {
    d.style.background = ''; d.style.borderColor = 'rgba(0,0,0,0.04)';
  });
  event.currentTarget.style.background = 'rgba(255,0,0,0.06)';
  event.currentTarget.style.borderColor = 'rgba(255,0,0,0.3)';
  toast(`"${title.substring(0,30)}..." 선택됨 — 다운로드를 눌러주세요`);
}

async function goYoutubeDownload() {
  const url = document.getElementById('yt-bgm-url')?.value?.trim();
  if (!url || (!url.includes('youtube') && !url.includes('youtu.be'))) {
    toast('올바른 YouTube URL을 입력하세요', 'error'); return;
  }
  const name = document.getElementById('yt-bgm-name')?.value?.trim() || '';
  const btn = document.getElementById('yt-bgm-dl-btn');
  const progress = document.getElementById('yt-bgm-progress');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span>';
  progress.style.display = '';
  document.getElementById('yt-bgm-progress-text').textContent = '오디오 추출 중... (30초~1분)';
  try {
    const res = await api('/api/bgm/youtube-download', { method: 'POST', body: { url, name } });
    if (res.status === 'ok') {
      toast(`"${res.filename}" BGM 라이브러리에 추가 완료!`);
      document.getElementById('yt-bgm-modal')?.remove();
      goLoadBgmLibrary();
    } else {
      toast(res.message || '다운로드 실패', 'error');
    }
  } catch (e) {
    toast('다운로드 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '다운로드';
    progress.style.display = 'none';
  }
}

async function goUploadBgm(input) {
  if (!input.files[0]) return;
  const pid = _libEditingId || window._globalProfileId || 0;
  const fd = new FormData();
  fd.append('file', input.files[0]);
  try {
    await fetch(`/api/bgm/upload?profile_id=${pid}`, { method: 'POST', body: fd });
    toast('BGM 업로드 완료');
    libLoadBgmList();
  } catch (e) { toast('업로드 실패', 'error'); }
  input.value = '';
}

async function goSunoGenerate() {
  const prompt = document.getElementById('go-suno-prompt')?.value?.trim();
  if (!prompt) { toast('음악 스타일을 입력하세요', 'error'); return; }
  const btn = document.getElementById('go-suno-btn');
  const status = document.getElementById('go-suno-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span>';
  status.textContent = '생성 중... (1~3분 소요)';
  try {
    const res = await api('/api/bgm/suno-generate', { method: 'POST', body: { prompt } });
    if (res.audio_url) {
      document.getElementById('go-suno-result').style.display = '';
      document.getElementById('go-suno-audio').src = res.audio_url;
      window._contentOpts.bgm_url = res.audio_url;
      status.textContent = '생성 완료!';
      status.style.color = '#34c759';
      toast('Suno BGM 생성 완료!');
    } else {
      status.textContent = res.message || '생성 실패';
      status.style.color = '#ff3b30';
    }
  } catch (e) {
    status.textContent = '실패: ' + e.message;
    status.style.color = '#ff3b30';
    toast('Suno 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '미리 생성';
  }
}

function goToggleSections() {
  const showCn = document.getElementById('go-gen-cardnews')?.checked || false;
  const showComic = document.getElementById('go-gen-comic')?.checked || false;
  const showVid = (document.getElementById('go-gen-video-slide')?.checked || false) || (document.getElementById('go-gen-video-veo')?.checked || false);
  // 옵션 vs "선택되지 않음" 메시지 토글
  const s = (optsId, offId, show) => {
    const o = document.getElementById(optsId); if (o) o.style.display = show ? '' : 'none';
    const f = document.getElementById(offId); if (f) f.style.display = show ? 'none' : '';
  };
  s('go-sec-cardnews-opts', 'go-cardnews-off', showCn);
  s('go-sec-comic-opts', 'go-comic-off', showComic);
  s('go-sec-video-opts', 'go-video-off', showVid);
  // 탭 표시/숨김
  const tabCn = document.getElementById('go-tab-cardnews'); if (tabCn) tabCn.style.display = (showCn) ? '' : 'none';
  const tabCo = document.getElementById('go-tab-comic'); if (tabCo) tabCo.style.display = (showComic) ? '' : 'none';
  const tabVi = document.getElementById('go-tab-video'); if (tabVi) tabVi.style.display = (showVid) ? '' : 'none';
  // 숨김 select 동기화
  const imgSel = document.getElementById('go-image-type');
  if (imgSel) imgSel.value = showCn ? 'cardnews' : showComic ? 'comic' : 'none';
  const vidSel = document.getElementById('go-video-type');
  if (vidSel) vidSel.value = document.getElementById('go-gen-video-veo')?.checked ? 'veo' : document.getElementById('go-gen-video-slide')?.checked ? 'slide' : 'none';
  // 스타일 미리보기도 토글
  const stylePreview = document.getElementById('go-cn-style-preview');
  if (stylePreview) stylePreview.style.display = showCn ? '' : 'none';
}

const _cnStyleMeta = {
  'ai-auto':    { emoji: '🤖', color: 'linear-gradient(135deg,#667eea,#764ba2)', label: 'AI 자동' },
  'modern':     { emoji: '🏢', color: 'linear-gradient(135deg,#2c3e50,#3498db)', label: '모던' },
  'colorful':   { emoji: '🌈', color: 'linear-gradient(135deg,#f093fb,#f5576c)', label: '컬러풀' },
  'minimal':    { emoji: '◻️', color: 'linear-gradient(135deg,#e0e0e0,#bdbdbd)', label: '미니멀' },
  'dark':       { emoji: '🌙', color: 'linear-gradient(135deg,#232526,#414345)', label: '다크' },
  'cute':       { emoji: '🧸', color: 'linear-gradient(135deg,#ffecd2,#fcb69f)', label: '귀여운' },
  'pastel':     { emoji: '🎨', color: 'linear-gradient(135deg,#a8edea,#fed6e3)', label: '파스텔' },
  'retro':      { emoji: '📻', color: 'linear-gradient(135deg,#c79081,#dfa579)', label: '레트로' },
  'gradient':   { emoji: '🔮', color: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', label: '그라데이션' },
  'handwritten':{ emoji: '✍️', color: 'linear-gradient(135deg,#fdfcfb,#e2d1c3)', label: '손글씨' },
  'watercolor': { emoji: '💧', color: 'linear-gradient(135deg,#89f7fe,#66a6ff)', label: '수채화' },
  'sketch':     { emoji: '✏️', color: 'linear-gradient(135deg,#d5d5d5,#f0f0f0)', label: '스케치' },
  'magazine':   { emoji: '📰', color: 'linear-gradient(135deg,#1a1a2e,#e94560)', label: '매거진' },
  'collage':    { emoji: '🧩', color: 'linear-gradient(135deg,#ff9a9e,#fecfef)', label: '콜라주' },
  'warm':       { emoji: '🔥', color: 'linear-gradient(135deg,#f83600,#f9d423)', label: '따뜻한' },
  'cool':       { emoji: '❄️', color: 'linear-gradient(135deg,#4facfe,#00f2fe)', label: '차가운' },
  'vivid':      { emoji: '💥', color: 'linear-gradient(135deg,#fc5c7d,#6a82fb)', label: '비비드' },
  'monochrome': { emoji: '⬛', color: 'linear-gradient(135deg,#434343,#000000)', label: '모노크롬' },
  'earth-tone': { emoji: '🌿', color: 'linear-gradient(135deg,#8baa7e,#c9b18c)', label: '어스톤' },
  'luxury':     { emoji: '👑', color: 'linear-gradient(135deg,#bf953f,#b38728)', label: '럭셔리' },
  'natural':    { emoji: '🍃', color: 'linear-gradient(135deg,#11998e,#38ef7d)', label: '내추럴' },
  'medical':    { emoji: '🏥', color: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)', label: '메디컬' },
  'tech':       { emoji: '💻', color: 'linear-gradient(135deg,#0f2027,#2c5364)', label: '테크' },
  'food':       { emoji: '🍽️', color: 'linear-gradient(135deg,#f5af19,#f12711)', label: '푸드' },
  'beauty':     { emoji: '💄', color: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)', label: '뷰티' },
  'fitness':    { emoji: '💪', color: 'linear-gradient(135deg,#00b09b,#96c93d)', label: '피트니스' },
  'education':  { emoji: '📚', color: 'linear-gradient(135deg,#2196f3,#f44336)', label: '교육' },
  'neon':       { emoji: '💡', color: 'linear-gradient(135deg,#b721ff,#21d4fd)', label: '네온' },
};

function goRenderStylePreview() {
  const grid = document.getElementById('go-cn-style-grid');
  if (!grid) return;
  const sel = document.getElementById('go-cn-style');
  const current = sel ? sel.value : 'ai-auto';
  grid.innerHTML = Object.entries(_cnStyleMeta).map(([val, m]) => {
    const active = val === current;
    return `<div onclick="goSelectCnStyle('${val}')" style="cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid ${active ? '#ff8c00' : 'rgba(0,0,0,0.06)'};transition:all 0.2s;text-align:center;${active ? 'box-shadow:0 2px 8px rgba(255,140,0,0.25);transform:scale(1.04);' : ''}" onmouseenter="this.style.transform='scale(1.04)'" onmouseleave="this.style.transform='${active ? 'scale(1.04)' : ''}'">
      <div style="height:44px;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:18px;">${m.emoji}</div>
      <div style="padding:4px 2px;font-size:10px;font-weight:${active ? '700' : '500'};color:${active ? '#ff8c00' : 'rgba(0,0,0,0.5)'};">${m.label}</div>
    </div>`;
  }).join('');
}

function goSelectCnStyle(val) {
  const sel = document.getElementById('go-cn-style');
  if (sel) sel.value = val;
  goRenderStylePreview();
}

function goSwitchTab(tab) {
  if (!tab) tab = 'write';
  ['write','cardnews','video','comic'].forEach(t => {
    const panel = document.getElementById('go-panel-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('#go-tabs .go-tab').forEach(b => {
    const isActive = b.textContent.trim() === ({write:'글쓰기',cardnews:'카드뉴스',video:'영상',comic:'만화'}[tab] || '');
    b.style.background = isActive ? '#fff' : 'transparent';
    b.style.color = isActive ? '#1c1c1e' : 'rgba(0,0,0,0.35)';
    b.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none';
  });
}

function goUpdateCheckButton(input) {
  const label = input?.closest('label.qs-btn');
  if (label) label.classList.toggle('qs-active', !!input.checked);
}

function _syncGlobalModalFromOpts() {
  const o = window._contentOpts;
  console.log('[SyncModal] 옵션값:', JSON.stringify({logo_insert:o.logo_insert,logo_cardnews:o.logo_cardnews,logo_blogimg:o.logo_blogimg,logo_comic:o.logo_comic,gen_comic:o.gen_comic,gen_video_slide:o.gen_video_slide,gen_detail_page:o.gen_detail_page}));
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
  const setBtnCheck = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !!val;
    goUpdateCheckButton(el);
  };
  // 모델은 설정 페이지 값 사용 (프로필에서 변경 안 함)
  s('go-tone', o.tone); s('go-length', o.blog_length);
  s('go-comma', o.comma_rate); s('go-period', o.period_rate); s('go-human', o.human_level);
  s('go-blog-img-count', o.blog_image_count || 0);
  setBtnCheck('go-logo-insert', o.logo_insert);
  document.getElementById('go-logo-pos-wrap').style.display = o.logo_insert ? 'block' : 'none';
  setBtnCheck('go-gen-blog', o.gen_blog);
  setBtnCheck('go-gen-sns', o.gen_sns);
  // 체크박스 동기화 (개별 boolean)
  setBtnCheck('go-gen-cardnews', o.gen_cardnews);
  setBtnCheck('go-gen-comic', o.gen_comic);
  setBtnCheck('go-gen-video-slide', o.gen_video_slide);
  setBtnCheck('go-gen-video-veo', o.gen_video_veo);
  const vmEl = document.getElementById('go-veo-mode'); if (vmEl) vmEl.value = o.veo_mode || 'veo-api';
  setBtnCheck('go-gen-detail-page', o.gen_detail_page);
  s('go-image-type', o.image_type); s('go-video-type', o.video_type);
  // 연결된 스타일 표시
  const styleInfo = document.getElementById('go-style-info');
  const styleDetail = document.getElementById('go-style-detail');
  if (styleInfo && styleDetail && window._globalProfileData?.writing_style) {
    try {
      const sd = typeof window._globalProfileData.writing_style === 'string' ? JSON.parse(window._globalProfileData.writing_style) : window._globalProfileData.writing_style;
      if (sd && sd.tone) {
        styleInfo.style.display = '';
        const lines = [`<strong>${sd.tone}</strong>`];
        if (sd.sentence_style) lines.push(`문장: ${sd.sentence_style}`);
        if (sd.ending_style) lines.push(`끝맺음: ${sd.ending_style}`);
        if (sd.expressions?.length) lines.push(`표현: ${sd.expressions.slice(0,6).join(', ')}`);
        if (sd.connector_words?.length) lines.push(`연결어: ${sd.connector_words.slice(0,5).join(', ')}`);
        if (sd.opening_pattern) lines.push(`시작: ${sd.opening_pattern}`);
        if (sd.closing_pattern) lines.push(`마무리: ${sd.closing_pattern}`);
        if (sd.unique_features?.length) lines.push(`특징: ${sd.unique_features.slice(0,3).join(' / ')}`);
        styleDetail.innerHTML = lines.map((l,i) => i===0 ? l : `<span style="color:rgba(0,0,0,0.45);">${l}</span>`).join('<br>');
      } else { styleInfo.style.display = 'none'; }
    } catch { styleInfo.style.display = 'none'; }
  } else if (styleInfo) { styleInfo.style.display = 'none'; }
  s('go-cn-style', o.cn_style); s('go-cn-slides', o.cn_slides); s('go-cn-photo-count', o.cn_photo_count || '1'); s('go-cn-ratio', o.cn_ratio); s('go-cn-resolution', o.cn_resolution || '1K');
  goRenderStylePreview();
  // voice → go-tts (합쳐진 select)
  goSetTtsFromValue(o.voice);
  s('go-video-ratio', o.video_ratio); s('go-camera', o.camera); s('go-bgm', o.bgm);
  s('go-comic-panels', o.comic_panels); s('go-comic-style', o.comic_style);
}

function closeGlobalOptsModal() {
  const m = document.getElementById('global-opts-modal');
  if (m) m.style.display = 'none';
}

async function saveGlobalOpts() {
  const o = window._contentOpts;
  const g = id => document.getElementById(id)?.value;
  // 모델은 설정 페이지에서 관리 (여기서 변경 안 함)
  o.tone = g('go-tone') || o.tone;
  o.blog_length = g('go-length') || o.blog_length;
  o.comma_rate = parseInt(g('go-comma') || o.comma_rate);
  o.period_rate = parseInt(g('go-period') || o.period_rate);
  o.human_level = g('go-human') || o.human_level;
  o.blog_image_count = parseInt(g('go-blog-img-count') || '0');
  o.logo_insert = document.getElementById('go-logo-insert')?.checked || false;
  o.logo_cardnews = o.logo_insert;
  o.logo_blogimg = o.logo_insert;
  o.logo_comic = o.logo_insert;
  console.log('[saveGlobalOpts] 로고:', {insert:o.logo_insert, cn:o.logo_cardnews, blog:o.logo_blogimg, comic:o.logo_comic});
  o.cn_style = g('go-cn-style') || o.cn_style;
  o.cn_slides = g('go-cn-slides') || o.cn_slides;
  o.cn_photo_count = g('go-cn-photo-count') || o.cn_photo_count || '1';
  o.cn_ratio = g('go-cn-ratio') || o.cn_ratio;
  o.cn_resolution = g('go-cn-resolution') || o.cn_resolution;
  o.tts_type = 'gemini';
  o.gemini_voice = document.getElementById('go-tts-voice-gemini')?.value || 'Kore';
  o.voice = goGetTtsValue();
  o.elevenlabs_voice_id = '';
  o.video_ratio = g('go-video-ratio') || o.video_ratio;
  o.camera = g('go-camera') || o.camera;
  o.bgm = g('go-bgm') || o.bgm;
  o.bgm_url = document.getElementById('go-bgm-url')?.value || '';
  {
    const normalizedBgm = normalizeBgmOptions(o);
    o.bgm = normalizedBgm.bgm;
    o.bgm_mode = normalizedBgm.bgm_mode;
  }
  o.comic_panels = '6';
  o.comic_style = g('go-comic-style') || o.comic_style;
  o.gen_blog = document.getElementById('go-gen-blog')?.checked ?? true;
  o.gen_sns = document.getElementById('go-gen-sns')?.checked ?? true;
  o.gen_cardnews = document.getElementById('go-gen-cardnews')?.checked ?? false;
  o.gen_comic = document.getElementById('go-gen-comic')?.checked ?? false;
  o.gen_video_slide = document.getElementById('go-gen-video-slide')?.checked ?? false;
  o.gen_video_veo = document.getElementById('go-gen-video-veo')?.checked ?? false;
  o.veo_mode = document.getElementById('go-veo-mode')?.value || 'veo-api';
  o.gen_detail_page = document.getElementById('go-gen-detail-page')?.checked ?? false;
  // 호환용 단일값
  o.image_type = o.gen_cardnews ? 'cardnews' : o.gen_comic ? 'comic' : 'none';
  o.video_type = o.gen_video_veo ? 'veo' : o.gen_video_slide ? 'slide' : 'none';
  // AI 모델은 설정 페이지(saveModelSettings)에서만 저장 — 여기서 덮어쓰지 않음
  closeGlobalOptsModal();
  // DB에 저장 → 다시 조회 → _contentOpts 갱신
  await saveContentOptsToDB();
  // UI 동기화
  syncOptsToUI('all');
  renderOptsPreview();
  toast('옵션이 적용되었습니다');
}

/** _contentOpts를 프로필 DB에 저장하고 다시 조회하여 동기화 (Single Source of Truth) */
async function saveContentOptsToDB() {
  if (!window._globalProfileId) return;
  const o = window._contentOpts;
  {
    const normalizedBgm = normalizeBgmOptions(o);
    o.bgm = normalizedBgm.bgm;
    o.bgm_mode = normalizedBgm.bgm_mode;
  }
  const co = {
    tone: o.tone, blog_length: o.blog_length, blog_image_count: o.blog_image_count,
    comma_rate: o.comma_rate, period_rate: o.period_rate, human_level: o.human_level,
    logo_insert: o.logo_insert,
    logo_cardnews: o.logo_cardnews, logo_blogimg: o.logo_blogimg, logo_comic: o.logo_comic,
    cn_style: o.cn_style, cn_slides: o.cn_slides, cn_photo_count: o.cn_photo_count || '1', cn_ratio: o.cn_ratio,
    cn_resolution: o.cn_resolution, cn_color: o.cn_color,
    tts_type: 'gemini', voice: `gemini-${o.gemini_voice || 'Kore'}`, gemini_voice: o.gemini_voice || 'Kore',
    elevenlabs_voice_id: '',
    video_ratio: o.video_ratio, camera: o.camera,
    bgm: o.bgm, bgm_url: o.bgm_url,
    narration: o.narration, subtitle: o.subtitle, veo_duration: o.veo_duration,
    comic_panels: o.comic_panels, comic_style: o.comic_style,
    bgm_mood: o.bgm_mood, bgm_bpm: o.bgm_bpm, bgm_duration: o.bgm_duration, bgm_mode: o.bgm_mode,
  };
  try {
    o.tts_type = 'gemini';
    o.gemini_voice = o.gemini_voice || (o.voice?.startsWith('gemini-') ? o.voice.replace('gemini-', '') : 'Kore');
    o.voice = `gemini-${o.gemini_voice}`;
    o.elevenlabs_voice_id = '';
    // 최신 platform_accounts를 서버에서 가져와 gen 옵션만 업데이트
    const p = await api(`/api/library/profiles/${window._globalProfileId}`);
    let pa = {};
    try { pa = p.platform_accounts ? (typeof p.platform_accounts === 'string' ? JSON.parse(p.platform_accounts) : p.platform_accounts) : {}; } catch { pa = {}; }
    pa.gen_blog = o.gen_blog; pa.gen_sns = o.gen_sns; pa.gen_cardnews = o.gen_cardnews;
    pa.gen_comic = o.gen_comic; pa.gen_video_slide = o.gen_video_slide; pa.gen_video_veo = o.gen_video_veo;
    pa.gen_detail_page = o.gen_detail_page; pa.image_type = o.image_type; pa.video_type = o.video_type;
    // DB에 저장
    console.log('[saveContentOptsToDB] 저장할 co:', JSON.stringify(co).substring(0, 300));
    await api(`/api/library/profiles/${window._globalProfileId}`, {
      method: 'PUT', body: { content_options: JSON.stringify(co), platform_accounts: JSON.stringify(pa) }
    });
    // DB에서 다시 조회 → _contentOpts에 반영 (DB가 Single Source of Truth)
    window._globalProfileData = await api(`/api/library/profiles/${window._globalProfileId}`);
    const savedCo = normalizeTtsOptions(window._globalProfileData.content_options ? JSON.parse(window._globalProfileData.content_options) : {});
    console.log('[saveContentOptsToDB] DB 재조회 cn_style:', savedCo.cn_style, '| tone:', savedCo.tone, '| keys:', Object.keys(savedCo).length);
    loadProfileToGlobalOpts(window._globalProfileData);
    console.log('[saveContentOptsToDB] 최종 _contentOpts.cn_style:', window._contentOpts.cn_style);
  } catch (e) { console.error('[saveContentOptsToDB] 실패:', e); }
}

// Blog URL 관리
function getBlogId() {
  // hidden input에서 먼저 확인
  const url = document.getElementById('global-blog-url').value.trim();
  if (url) {
    const match = url.match(/blog\.naver\.com\/([^/?#]+)/);
    if (match) return match[1];
    if (!url.includes('/') && !url.includes('.')) return url;
  }
  // 설정에서 가져오기 (캐시)
  return window._blogId || '';
}
// 앱 시작 시 config에서 blog_id 로드
(async function() {
  try {
    const config = await api('/api/config');
    if (config.NAVER && config.NAVER.blog_id) {
      window._blogId = config.NAVER.blog_id;
      document.getElementById('global-blog-url').value = config.NAVER.blog_id;
    }
  } catch(e) {}
})();

function saveBlogUrl() {
  const urlEl = document.getElementById('global-blog-url');
  const url = urlEl ? urlEl.value.trim() : '';
  const blogId = getBlogId();
  const status = document.getElementById('blog-url-status');
  if (!status) return;
  if (blogId) {
    status.textContent = 'blog ID: ' + blogId;
    status.style.color = '#4fc08d';
    // 서버에도 저장
    api('/api/config/update', { method: 'POST', body: { section: 'NAVER', key: 'blog_id', value: blogId } }).catch(() => {});
  } else if (url) {
    status.textContent = '올바른 블로그 주소를 입력하세요';
    status.style.color = '#e05c5c';
  } else {
    status.textContent = '';
  }
}

function loadBlogUrl() {
  saveBlogUrl();
}

function hardRefreshApp() {
  try {
    if (window._trendAbort) window._trendAbort.abort();
  } catch {}
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_reload', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

// 가이드 박스
const _guideTexts = {
  'page-projects': { text: '프로필이 없다면 프로필 관리에서 먼저 등록하세요. 프로필을 선택한 뒤 콘텐츠 옵션을 확인·수정하고, 직접 만들기나 트렌드 화면에서 멀티콘텐츠 생성을 시작해보세요' },
  'page-single-cardnews': { text: '단일 카드뉴스에서는 직접 입력한 글과 참조 이미지, 프롬프트를 바탕으로 여러 장의 카드뉴스를 바로 만들 수 있습니다. 개별 재생성, 다운로드, 폴더 열기까지 한 번에 처리해보세요' },
  'page-manual-cardnews': { text: '카드뉴스를 편집합니다.' },
  'page-cardnews-editor2': { text: 'AI가 카드뉴스를 자동으로 설계하고 생성합니다.' },
  'page-ce2-history': { text: '생성했던 카드뉴스 히스토리입니다.' },
  'page-single-comic-story': { text: '스토리 만화에서는 한 번의 메시지로 이어지는 회차형 만화를 최대 10회차까지 바로 만들 수 있습니다. 회차별 요약과 이미지 결과를 한 화면에서 확인해보세요' },
  'page-single-advideo': { text: '광고 영상에서는 상품/인물 이미지를 넣고 AI가 광고 스크립트를 자동으로 만들어줍니다. Veo 3.1로 씬별 영상을 생성하고 나레이션, BGM, 자막까지 합성된 완성 광고 영상을 받으세요' },
  'page-single-sns': { text: '단일 스레드/X에서는 URL만 넣어도 본문과 이미지를 가져와 프로필의 스레드 문체를 반영한 SNS 문구를 바로 만들 수 있습니다.' },
  'page-sns-planner': { text: '30일 SNS 플래너에서는 브랜드 정보를 정리한 뒤 30일(하루 3포스트) 운영 계획을 만들고, 날짜별로 Threads와 X 초안을 받아 직접 복붙하며 진행 상태를 관리할 수 있습니다.' },
  // 'page-hweb-hub': { text: '화수분 웹툴 허브에서는 `h_web`의 배너, 스마트스토어, 만화, 상세페이지, 영상, 반려동물 이미지 등 외부 AI 서비스를 카테고리별로 찾아 바로 열 수 있습니다' },
  'page-trend-dashboard': { text: 'AI가 분석한 맞춤 트렌드, 실시간 검색어, 카테고리별 뉴스에서 원하는 항목을 클릭하면 바로 콘텐츠를 생성할 수 있습니다' },
  'page-keyword-content': { text: '1.키워드 검색 → 2.소스 선택 및 본문 가져오기 → 3.프롬프트 편집 → 4.멀티콘텐츠 생성 → 5.업로드' },
  'page-biz-cardnews': { text: '프로필을 선택하면 업종에 맞는 시나리오와 주제가 추천됩니다. 주제를 입력하고 생성 버튼을 누르세요' },
  'page-library': { text: '브랜드 프로필을 등록하고 관리합니다. 프로필의 업종, 톤, CTA 등이 콘텐츠 생성에 반영됩니다' },
  'page-file-admin': { text: '생성된 결과물 파일만 따로 보고 정리합니다. 카테고리별 확인과 복수 선택 삭제를 여기서 처리할 수 있습니다' },
  'page-db-admin': { text: '데이터베이스 테이블과 행을 따로 관리합니다. 여러 행을 선택해서 한 번에 삭제할 수 있습니다' },
  'page-kakao-auto': { text: '카카오톡 메시지 자동 발송. 데스크톱 카카오톡 실행 상태와 macOS 손쉬운 사용 권한을 먼저 확인하세요' },
  'page-browser-auto': { text: 'Chrome 브라우저를 자동 제어합니다. AI 자동 모드 또는 시나리오 수동 모드로 실행할 수 있습니다' },
  'page-desktop-agent': { text: '좌표 자동화에서는 모니터를 고르고, 후보 액션을 큐로 모아 저장 시나리오와 실제 실행까지 이어갈 수 있습니다' },
  'page-video-studio': { text: '숏폼·롱폼 스튜디오에서는 유튜브나 뉴스 소스를 먼저 고르고, 가장 가벼운 Veo 모델 기준 초안을 만든 뒤 기존 광고영상 편집기로 넘겨 자막과 음성, 장면을 직접 편집할 수 있습니다' },
  'page-video-utils': { text: '영상분석에서는 링크 저장, 유튜브 검색, 자막 요약, 릴스·틱톡 분석, 썸네일 리메이크까지 한 번에 처리할 수 있습니다' },
  // 'page-meta-ads-auto': { text: 'Meta Marketing API로 Facebook/Instagram 광고 캠페인을 생성하고 예약 실행합니다' },
  // 'page-youtube-ads-auto': { text: 'Google Ads API로 YouTube 광고 캠페인을 생성하고, AI 초안으로 문구와 타게팅을 빠르게 채워 예약 실행합니다' },
  'page-settings': { text: 'AI 모델, API 키, CLI 상태, Chrome 확장 연결을 한 곳에서 관리합니다' },
  'page-prompt-admin': { text: '블로그, 카드뉴스, SNS, 영상 등 AI 콘텐츠 생성에 쓰이는 콘텐츠 프롬프트를 커스터마이즈합니다. 변수를 삽입하고 블록 단위로 조합할 수 있습니다' }
};
window._closedGuides = {};

const _guideInfoIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#ff8c00" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

function _guideOpenHTML(pageId, g) {
  return `<div style="position:relative;background:rgba(255,140,0,0.05);border:1px solid rgba(255,140,0,0.15);border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:14px;">
    <div style="position:absolute;left:24px;top:-8px;width:14px;height:14px;background:rgba(255,140,0,0.05);border-left:1px solid rgba(255,140,0,0.15);border-top:1px solid rgba(255,140,0,0.15);transform:rotate(45deg);"></div>
    ${_guideInfoIcon}
    <p style="flex:1;font-size:14px;color:#1c1c1e;line-height:1.7;margin:0;">${g.text}</p>
    <span onclick="_toggleGuide('${pageId}',false)" style="flex-shrink:0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;color:rgba(0,0,0,0.25);font-size:18px;transition:all 0.15s;" onmouseenter="this.style.background='rgba(0,0,0,0.06)';this.style.color='rgba(0,0,0,0.5)'" onmouseleave="this.style.background='none';this.style.color='rgba(0,0,0,0.25)'">&times;</span>
  </div>`;
}

function _guideClosedHTML(pageId) {
  return `<div onclick="_toggleGuide('${pageId}',true)" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);border-radius:20px;cursor:pointer;font-size:12px;color:#ff8c00;transition:all 0.2s;" onmouseenter="this.style.background='rgba(255,140,0,0.1)'" onmouseleave="this.style.background='rgba(255,140,0,0.06)'">${_guideInfoIcon} 가이드 보기</div>`;
}

function _insertGuideEl(page, guideEl) {
  const header = page.querySelector('.page-header') || page.querySelector('[style*="text-align:center"]');
  if (header && header.parentNode === page) {
    header.after(guideEl);
  } else if (page.firstElementChild) {
    const wrapper = page.firstElementChild;
    const innerHeader = wrapper.querySelector('[style*="text-align:center"]');
    if (innerHeader) innerHeader.after(guideEl);
    else wrapper.prepend(guideEl);
  }
}

function _renderGuideBoxes() {
  const closedGuides = window._closedGuides || {};
  Object.entries(_guideTexts).forEach(([pageId, g]) => {
    const page = document.getElementById(pageId);
    if (!page) return;
    const guideEl = document.createElement('div');
    guideEl.id = 'guide-' + pageId;
    guideEl.style.cssText = 'margin:0 0 20px 0;';
    guideEl.innerHTML = closedGuides[pageId] ? _guideClosedHTML(pageId) : _guideOpenHTML(pageId, g);
    _insertGuideEl(page, guideEl);
  });
}

function _toggleGuide(pageId, show) {
  const closedGuides = window._closedGuides || {};
  if (show) delete closedGuides[pageId];
  else closedGuides[pageId] = true;
  window._closedGuides = closedGuides;
  const el = document.getElementById('guide-' + pageId);
  if (el) el.remove();
  const g = _guideTexts[pageId];
  const page = document.getElementById(pageId);
  if (!page || !g) return;
  const guideEl = document.createElement('div');
  guideEl.id = 'guide-' + pageId;
  guideEl.style.cssText = 'margin:0 0 20px 0;';
  guideEl.innerHTML = show ? _guideOpenHTML(pageId, g) : _guideClosedHTML(pageId);
  _insertGuideEl(page, guideEl);
}

async function setAppVersionBadge() {
  const badge = document.getElementById('app-version-badge');
  if (!badge) return;
  let version = '';
  try {
    if (window.electronAPI?.getAppVersion) {
      version = await window.electronAPI.getAppVersion();
    }
  } catch {}
  if (!version) {
    try {
      const health = await api('/api/health');
      version = health?.version || '';
    } catch {}
  }
  const normalizedVersion = version ? String(version).replace(/^v/i, '') : '';
  window._appVersionBadgeState = {
    currentVersion: normalizedVersion,
    latestVersion: '',
  };
  badge.dataset.currentVersion = normalizedVersion;
  badge.textContent = normalizedVersion ? `버전 v${normalizedVersion}` : '버전 확인 안 됨';
}

async function handleAppVersionBadgeClick() {
  const url = 'https://github.com/johunsang/bbarit-marketing/releases';
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

const _csCategoryOptions = [
  { value: 'question', label: '일반 문의' },
  { value: 'bug', label: '버그 신고' },
  { value: 'feature', label: '기능 개선 요청' },
  { value: 'billing', label: '결제/환불 문의' },
  { value: 'business_ad', label: '마케케 광고 문의' },
  { value: 'business_custom', label: '커스터마이즈 요청 (유료 견적 요청)' },
  { value: 'business_agency', label: '마케팅 대행 요청' },
  { value: 'other', label: '기타 문의' },
];

const _csCategoryPresetMap = {
  business_ad: {
    title: '마케케 광고 문의',
    content: '안녕하세요. 마케케 내 광고/제휴 노출 관련 문의드립니다.\n\n1. 회사명/브랜드명:\n2. 소개할 서비스 또는 상품:\n3. 희망 광고 방식:\n4. 희망 일정:\n5. 예산 범위:\n6. 연락처:',
  },
  business_custom: {
    title: '커스터마이즈 요청 (유료 견적 요청)',
    content: '안녕하세요. 마케케 커스터마이즈 개발 견적을 요청드립니다.\n\n1. 회사명:\n2. 필요한 기능:\n3. 사용 목적:\n4. 희망 일정:\n5. 예상 예산:\n6. 연락처:',
  },
  business_agency: {
    title: '마케팅 대행 요청',
    content: '안녕하세요. 마케팅대행 가능 여부와 제안이 궁금합니다.\n\n1. 회사명/브랜드명:\n2. 업종:\n3. 현재 고민:\n4. 희망 대행 범위:\n5. 월 예산 범위:\n6. 연락처:',
  },
};

function _csCategoryOptionsHtml(selectedValue = 'question') {
  return _csCategoryOptions.map((item) => (
    `<option value="${item.value}" ${item.value === selectedValue ? 'selected' : ''}>${item.label}</option>`
  )).join('');
}

function _csRememberAutofill(category) {
  const meta = _csCategoryPresetMap[category];
  window._csLastAutofill = meta ? { category, title: meta.title, content: meta.content } : null;
}

function _csApplyCategoryPreset(force = false) {
  const categoryEl = document.getElementById('cs-category');
  const titleEl = document.getElementById('cs-title');
  const contentEl = document.getElementById('cs-content');
  if (!categoryEl || !titleEl || !contentEl) return;

  const category = categoryEl.value;
  const meta = _csCategoryPresetMap[category];
  const last = window._csLastAutofill || null;
  if (!meta) {
    window._csLastAutofill = null;
    return;
  }

  const titleMatchesLast = !titleEl.value.trim() || (last && titleEl.value.trim() === last.title);
  const contentMatchesLast = !contentEl.value.trim() || (last && contentEl.value.trim() === last.content);
  if (force || (titleMatchesLast && contentMatchesLast)) {
    titleEl.value = meta.title;
    contentEl.value = meta.content;
  }
  _csRememberAutofill(category);
}

// 페이지 로드 시 초기화
// 🔌 브라우저 자동 연결 끄기 토글 — 사이드바 체크박스와 localStorage 동기화
function chromeToggleDisable(disabled) {
  try {
    window._chromeAutoConnectDisabled = !!disabled;
    localStorage.setItem('makeke_chrome_disable_auto', disabled ? '1' : '0');
    const st = document.getElementById('chrome-status-text');
    if (st && disabled) st.textContent = '자동 연결 OFF';
    if (typeof toast === 'function') {
      toast(disabled ? '브라우저 자동 연결 OFF — 프로필 전환 시 Chrome 안 열림' : '브라우저 자동 연결 ON', 'info');
    }
  } catch (_) {}
}
window.chromeToggleDisable = chromeToggleDisable;

function _loadChromeDisablePref() {
  try {
    const v = localStorage.getItem('makeke_chrome_disable_auto') === '1';
    window._chromeAutoConnectDisabled = v;
    const cb = document.getElementById('chrome-disable-toggle');
    if (cb) cb.checked = v;
    if (v) {
      const st = document.getElementById('chrome-status-text');
      if (st) st.textContent = '자동 연결 OFF';
    }
  } catch (_) {}
}

async function initPage() {
  pruneDisabledUi();
  loadBlogUrl();
  setAppVersionBadge();
  _renderGuideBoxes();
  _loadChromeDisablePref();
  // 실시간 트렌드 페이지가 기본 활성화되어 있으면 데이터 로드
  const trendPage = document.getElementById('page-trend-dashboard');
  if (trendPage && trendPage.classList.contains('active')) {
    loadTrendDashboard();
  }
}

// 브라우저 탭 닫기/새로고침 시 작업 중이면 경고
window.addEventListener('beforeunload', e => {
  // 에이전트 페이지에서는 beforeunload 경고 비활성화
  const activePage = document.querySelector('.page.active')?.id || '';
  if (activePage.includes('agent')) return;
  const isWorking = window._kcGenerating || window._kcCnGenerating || window._bizCnGenerating;
  if (isWorking) { e.preventDefault(); e.returnValue = ''; }
});

// 페이지 로드 완료 시 초기화 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

// ── 고객지원 (로컬 API) ──

function openSupportModal(preset = null) {
  const existing = document.getElementById('support-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'support-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="width:min(520px,100%);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:18px;font-weight:800;color:#1c1c1e;">문의하기</div>
        <button onclick="document.getElementById('support-modal').remove()" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(0,0,0,0.05);font-size:16px;cursor:pointer;color:rgba(0,0,0,0.4);">×</button>
      </div>
      <div style="padding:20px 24px;">
        <select id="cs-category" onchange="_csApplyCategoryPreset()" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;margin-bottom:12px;">
          ${_csCategoryOptionsHtml(String(preset?.category || preset?.key || 'question'))}
        </select>
        <input id="cs-title" type="text" placeholder="제목" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;margin-bottom:12px;box-sizing:border-box;">
        <textarea id="cs-content" rows="5" placeholder="문의 내용을 자세히 적어주세요" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:12px;"></textarea>
        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <label style="padding:8px 14px;background:rgba(0,0,0,0.04);border:1px dashed rgba(0,0,0,0.15);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">
              이미지 첨부 <input type="file" id="cs-images" accept="image/*" multiple style="display:none;" onchange="_csPreviewImages(this.files)">
            </label>
            <button type="button" onclick="_csScreenCapture()" style="padding:8px 14px;background:rgba(0,0,0,0.04);border:1px dashed rgba(0,0,0,0.15);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">화면 캡처</button>
            <span id="cs-image-count" style="font-size:11px;color:rgba(0,0,0,0.3);"></span>
          </div>
          <div id="cs-image-preview" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button onclick="document.getElementById('support-modal').remove()" style="padding:10px 20px;background:rgba(0,0,0,0.05);border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
          <button onclick="submitCSTicket()" id="cs-submit-btn" style="padding:10px 20px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">등록</button>
        </div>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  if (preset) {
    const cat = document.getElementById('cs-category');
    const title = document.getElementById('cs-title');
    const content = document.getElementById('cs-content');
    const presetCategory = String(preset.category || preset.key || 'question');
    if (cat) cat.value = presetCategory;
    if (title && preset.title) title.value = preset.title;
    if (content && preset.content) content.value = preset.content;
    _csRememberAutofill(presetCategory);
  } else {
    window._csLastAutofill = null;
  }
}

function openBusinessInquiryModal() {
  const existing = document.getElementById('business-inquiry-modal');
  if (existing) existing.remove();

  const presets = [
    {
      key: 'business_ad',
      category: 'business_ad',
      label: '마케케 광고 문의',
      desc: '앱 안 광고 노출, 제휴 배너, 프로모션 협업을 문의합니다.',
      title: '마케케 광고 문의',
      content: _csCategoryPresetMap.business_ad.content,
    },
    {
      key: 'business_custom',
      category: 'business_custom',
      label: '커스터마이즈 요청 (유료 견적 요청)',
      desc: '유료 개발, 맞춤 기능, 견적 요청을 접수합니다.',
      title: _csCategoryPresetMap.business_custom.title,
      content: _csCategoryPresetMap.business_custom.content,
    },
    {
      key: 'business_agency',
      category: 'business_agency',
      label: '마케팅 대행 요청',
      desc: '콘텐츠 운영, 광고 운영, 통합 마케팅대행을 문의합니다.',
      title: _csCategoryPresetMap.business_agency.title,
      content: _csCategoryPresetMap.business_agency.content,
    },
  ];

  const modal = document.createElement('div');
  modal.id = 'business-inquiry-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999998;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="width:min(520px,100%);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:18px;font-weight:900;color:#8f3f00;">비즈니스 문의</div>
          <div style="font-size:12px;color:rgba(28,28,30,0.58);margin-top:4px;">문의 유형을 선택하면 작성 폼이 정확한 제목과 내용으로 자동 채워집니다.</div>
        </div>
        <button onclick="document.getElementById('business-inquiry-modal').remove()" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(0,0,0,0.05);font-size:16px;cursor:pointer;color:rgba(0,0,0,0.4);">×</button>
      </div>
      <div style="padding:18px 20px;display:grid;gap:10px;">
        ${presets.map((preset) => `
          <button
            type="button"
            onclick='openSupportModal(${JSON.stringify(preset).replace(/'/g, '&apos;')});document.getElementById("business-inquiry-modal").remove();'
            style="text-align:left;padding:14px 16px;background:linear-gradient(135deg,#fff7ed,#fff1dc);border:1px solid rgba(255,140,0,0.16);border-radius:14px;cursor:pointer;display:block;">
            <div style="font-size:14px;font-weight:800;color:#7a3600;margin-bottom:4px;">${preset.label}</div>
            <div style="font-size:12px;color:rgba(28,28,30,0.62);line-height:1.5;">${preset.desc}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

let _csAttachedImages = []; // base64 배열

async function _csGetCurrentUser() {
  return { userEmail: '', userName: '', userId: '' };
}

async function _csCreateTicket({ title, content, category, screenshot, images, imageCount }) {
  const currentUser = await _csGetCurrentUser();
  return api('/api/support/tickets', {
    method: 'POST',
    body: {
      user_email: currentUser.userEmail,
      user_name: currentUser.userName,
      user_id: currentUser.userId,
      category: category || 'other',
      title: title || '',
      content: content || '',
      screenshot: screenshot || '',
      images: Array.isArray(images) ? images : [],
      image_count: imageCount || 0,
    },
  });
}

function _csPreviewImages(files) {
  const preview = document.getElementById('cs-image-preview');
  for (const file of files) {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue;
    const reader = new FileReader();
    reader.onload = e => {
      _csAttachedImages.push(e.target.result);
      const idx = _csAttachedImages.length - 1;
      preview.innerHTML += `<div style="position:relative;width:60px;height:60px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);cursor:pointer;" onclick="_csPreviewLarge(${idx})">
        <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">
        <button onclick="event.stopPropagation();this.parentElement.remove();_csAttachedImages.splice(${idx},1);_csUpdateCount()" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border:none;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;cursor:pointer;line-height:16px;padding:0;">×</button>
      </div>`;
      _csUpdateCount();
    };
    reader.readAsDataURL(file);
  }
}

function _csUpdateCount() {
  const el = document.getElementById('cs-image-count');
  if (el) el.textContent = _csAttachedImages.length > 0 ? `${_csAttachedImages.length}장 첨부` : '';
}

async function _csScreenCapture(silent = false) {
  try {
    // Electron 환경: webContents 캡처
    if (window.electronAPI?.captureScreen) {
      const dataUrl = await window.electronAPI.captureScreen();
      _csAttachedImages.push(dataUrl);
    } else {
      // 웹 환경: canvas로 캡처 시도
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 간단한 텍스트 스냅샷
      ctx.font = '14px monospace';
      ctx.fillStyle = '#333';
      const lines = (document.body.innerText || '').substring(0, 3000).split('\n').slice(0, 40);
      lines.forEach((line, i) => ctx.fillText(line.substring(0, 100), 10, 20 + i * 18));
      _csAttachedImages.push(canvas.toDataURL('image/png', 0.7));
    }
    const preview = document.getElementById('cs-image-preview');
    const idx = _csAttachedImages.length - 1;
    if (preview) {
      preview.innerHTML += `<div style="position:relative;width:60px;height:60px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);cursor:pointer;" onclick="_csPreviewLarge(${idx})">
        <img src="${_csAttachedImages[idx]}" style="width:100%;height:100%;object-fit:cover;">
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:8px;text-align:center;padding:1px;">캡처</div>
      </div>`;
      _csUpdateCount();
    }
    if (!silent) toast('화면 캡처 완료');
  } catch (e) {
    if (!silent) toast('캡처 실패: ' + e.message, 'error');
  }
}

async function submitCSTicket() {
  const title = document.getElementById('cs-title').value.trim();
  const content = document.getElementById('cs-content').value.trim();
  const category = document.getElementById('cs-category').value;
  if (!title || !content) { toast('제목과 내용을 입력하세요', 'error'); return; }

  const btn = document.getElementById('cs-submit-btn');
  btn.disabled = true; btn.textContent = '등록 중...';

  try {
    await _csCreateTicket({
      title,
      content,
      category,
      screenshot: (_csAttachedImages[0] || '').substring(0, 900000),
      images: _csAttachedImages.slice(),
      imageCount: _csAttachedImages.length,
    });
    toast('문의가 등록되었습니다! 빠르게 답변드리겠습니다.');
    _csAttachedImages = [];
    document.getElementById('support-modal').remove();
  } catch(e) {
    toast('등록 실패: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '등록';
}

// ── 에러 패널 (화면 하단 고정) ──
const _errorLogs = [];
let _lastErrorKey = '', _lastErrorTime = 0;
function _showErrorPanel(msg, source = '', line = '', stack = '') {
  // 같은 에러 1초 내 반복 무시 (폭주 방지)
  const errKey = `${msg}|${source}|${line}`;
  const now = Date.now();
  if (errKey === _lastErrorKey && now - _lastErrorTime < 1000) return;
  _lastErrorKey = errKey;
  _lastErrorTime = now;
  const entry = { time: new Date().toLocaleTimeString(), msg, source, line, stack, type: source ? 'frontend' : 'backend' };
  _errorLogs.push(entry);
  if (_errorLogs.length > 50) _errorLogs.shift();
  let panel = document.getElementById('makeke-error-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'makeke-error-panel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999999;background:#1c1c1e;color:#ff6b6b;font-family:monospace;font-size:12px;max-height:220px;overflow:auto;border-top:3px solid #ff3b30;';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#2c2c2e;border-bottom:1px solid #3a3a3c;">
        <span style="font-weight:700;color:#ff3b30;">오류 발생</span>
        <div style="display:flex;gap:6px;">
          <button onclick="_quickReportError()" style="padding:5px 14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;" id="quick-report-btn">바로 문의 보내기</button>
          <button onclick="_reportErrorToSupport()" style="padding:5px 12px;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">상세 문의</button>
          <button onclick="_copyErrorLog()" style="padding:5px 12px;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">복사</button>
          <button onclick="document.getElementById('makeke-error-panel').remove();_errorLogs.length=0;" style="padding:5px 8px;background:rgba(255,255,255,0.06);color:#888;border:none;border-radius:6px;font-size:13px;cursor:pointer;">✕</button>
        </div>
      </div>
      <div id="makeke-error-list" style="padding:8px 14px;"></div>
    `;
    document.body.appendChild(panel);
  }
  const list = document.getElementById('makeke-error-list');
  const typeLabel = entry.type === 'backend' ? '<span style="color:#ff9500;">[서버]</span>' : '<span style="color:#ff6b6b;">[화면]</span>';
  const div = document.createElement('div');
  div.style.cssText = 'padding:4px 0;border-bottom:1px solid #3a3a3c;';
  div.innerHTML = `${typeLabel} <span style="color:#888;">[${entry.time}]</span> ${escapeHtml(msg)}${source ? ` <span style="color:#666;">(${source}:${line})</span>` : ''}`;
  list.appendChild(div);
  // DOM도 50개 제한
  while (list.children.length > 50) list.removeChild(list.firstChild);
  panel.scrollTop = panel.scrollHeight;
}

// Chrome 확장프로그램 미연결 관련 에러 패턴 감지
function _isChromeExtensionError(msg) {
  if (!msg) return false;
  const patterns = [
    /chrome.*연결/i, /확장.*프로그램/i, /extension/i,
    /프로필.*연결/i, /browser.*connect/i, /websocket/i,
    /connected.*false/i, /연결.*실패/i, /연결.*않/i,
  ];
  return patterns.some(p => p.test(msg));
}

window.onerror = function(msg, source, line, col, err) {
  // Chrome 확장프로그램 미연결 에러 → 설정 배너 표시 (문의 대신)
  if (_isChromeExtensionError(String(msg))) {
    if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner();
    return;
  }
  _showErrorPanel(msg, source?.split('/').pop(), line, err?.stack);
};
window.addEventListener('unhandledrejection', function(e) {
  const errMsg = e.reason?.message || e.reason || '알 수 없음';
  // Chrome 확장프로그램 미연결 에러 → 설정 배너 표시 (문의 대신)
  if (_isChromeExtensionError(String(errMsg))) {
    if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner();
    return;
  }
  _showErrorPanel('Promise 에러: ' + errMsg, '', '', e.reason?.stack);
});

function _csPreviewLarge(idx) {
  const src = _csAttachedImages[idx];
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:20px;';
  overlay.innerHTML = `<img src="${src}" style="max-width:95%;max-height:95%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function _copyErrorLog() {
  const text = _errorLogs.map(e => `[${e.time}] ${e.msg} (${e.source}:${e.line})\n${e.stack || ''}`).join('\n---\n');
  navigator.clipboard.writeText(text).then(() => toast('에러 로그 복사 완료')).catch(() => toast('복사 실패', 'error'));
}

function _buildErrorReportBody() {
  const errorText = _errorLogs.map(e => `[${e.type === 'backend' ? '서버' : '화면'}][${e.time}] ${e.msg} (${e.source}:${e.line})\n${e.stack || ''}`).join('\n---\n');
  const profileId = window._globalProfileId || '없음';
  const profileName = window._globalProfileData?.name || '없음';
  const keyword = document.getElementById('kc-keyword')?.value || '없음';
  const step = window._kcCurrentStep || '?';
  const url = location.href;
  const activeMenu = document.querySelector('.sidebar nav a.active')?.textContent?.trim() || '없음';
  const chromeStatus = document.getElementById('chrome-status-text')?.textContent || '없음';
  const lastError = _errorLogs[_errorLogs.length - 1];
  const title = `[자동] ${lastError?.type === 'backend' ? '서버' : 'JS'} 에러 — ${lastError?.msg?.slice(0, 50) || '에러'}`;
  const content = `== 상황 ==
프로필: ${profileName} (ID: ${profileId})
키워드: ${keyword}
단계: ${step}단계
화면: ${activeMenu}
Chrome: ${chromeStatus}
URL: ${url}
시각: ${new Date().toLocaleString()}
앱 버전: ${document.querySelector('meta[name="version"]')?.content || '알 수 없음'}

== 에러 로그 (${_errorLogs.length}건) ==
${errorText}`;
  return { title, content, category: 'bug' };
}

function _reportErrorToSupport() {
  // 자동 화면 캡처 (버그 신고용, silent)
  _csScreenCapture(true).catch(() => {});
  openSupportModal();
  setTimeout(() => {
    const { title, content, category } = _buildErrorReportBody();
    const cat = document.getElementById('cs-category');
    if (cat) cat.value = category;
    const titleEl = document.getElementById('cs-title');
    if (titleEl) titleEl.value = title;
    const contentEl = document.getElementById('cs-content');
    if (contentEl) contentEl.value = content + '\n\n== 추가 설명 ==\n(여기에 직접 입력해주세요)';
  }, 200);
}

async function _quickReportError() {
  const btn = document.getElementById('quick-report-btn');
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }

  // 자동 화면 캡처 (silent)
  try { await _csScreenCapture(true); } catch {}

  const { title, content } = _buildErrorReportBody();

  try {
    await _csCreateTicket({
      title,
      content,
      category: 'bug',
      screenshot: (_csAttachedImages[0] || '').substring(0, 900000),
      images: _csAttachedImages.slice(),
      imageCount: _csAttachedImages.length,
    });
    toast('에러 리포트가 자동으로 전송되었습니다. 빠르게 확인하겠습니다!', 'info', 4000);
    _csAttachedImages = [];
    const panel = document.getElementById('makeke-error-panel');
    if (panel) panel.remove();
    _errorLogs.length = 0;
  } catch (e) {
    toast('자동 전송 실패. "상세 문의"를 눌러 직접 보내주세요. ' + e.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '바로 문의 보내기'; }
}

async function openMyTickets() {
  const existing = document.getElementById('my-tickets-modal');
  if (existing) existing.remove();

  let userEmail = 'app-user@makeke.kr';
  try {
    const currentUser = await _csGetCurrentUser();
    userEmail = currentUser.userEmail;
  } catch {}

  const modal = document.createElement('div');
  modal.id = 'my-tickets-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="width:min(600px,100%);max-height:80vh;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);display:flex;flex-direction:column;">
      <div style="padding:20px 24px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:18px;font-weight:800;color:#1c1c1e;">내 문의 내역</div>
        <button onclick="document.getElementById('my-tickets-modal').remove()" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(0,0,0,0.05);font-size:16px;cursor:pointer;color:rgba(0,0,0,0.4);">×</button>
      </div>
      <div id="my-tickets-list" style="padding:16px 24px;overflow:auto;flex:1;">
        <div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);">로딩 중...</div>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  try {
    const data = await api(`/api/support/tickets?user_email=${encodeURIComponent(userEmail)}`);
    const docs = Array.isArray(data.tickets) ? data.tickets : [];

    const list = document.getElementById('my-tickets-list');
    if (docs.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);font-size:13px;">문의 내역이 없습니다</div>';
      return;
    }

    const statusMap = { open: ['접수', '#007aff'], in_progress: ['처리중', '#ff8c00'], resolved: ['완료', '#34c759'], on_hold: ['보류', '#999'] };
    list.innerHTML = docs.map((ticket) => {
      const status = ticket.status || 'open';
      const [label, color] = statusMap[status] || ['접수', '#007aff'];
      const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
      const adminReply = replies.filter((reply) => reply?.is_admin || reply?.isAdmin || reply?.author_role === 'admin').pop();
      return `
        <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="padding:3px 8px;background:${color}18;color:${color};border-radius:6px;font-size:10px;font-weight:700;">${label}</span>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ticket.title || '')}</span>
          </div>
          <div style="font-size:12px;color:rgba(0,0,0,0.5);margin-bottom:6px;">${escapeHtml((ticket.content || '').substring(0, 100))}</div>
          ${adminReply ? `<div style="padding:8px 10px;background:rgba(255,140,0,0.04);border-radius:8px;margin-top:6px;">
            <div style="font-size:10px;color:#ff8c00;font-weight:700;margin-bottom:2px;">답변</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.6);">${escapeHtml((adminReply.content || '').substring(0, 150))}</div>
          </div>` : ''}
        </div>
      `;
    }).join('');
  } catch(e) {
    document.getElementById('my-tickets-list').innerHTML = `<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.4);font-size:13px;">문의 내역을 불러올 수 없습니다.<br><span style="font-size:11px;color:rgba(0,0,0,0.25);margin-top:4px;display:block;">${e.message}</span></div>`;
  }
}

// Navigation
const DISABLED_UI_PAGES = new Set([
  'browser-auto',
  'desktop-agent',
  'ec-history',
  'geo-seo-consultant',
  'video-studio',
  'video-utils',
]);
const DISABLED_UI_PREFIXES = ['ec-'];
const UPLOAD_FEATURES_DISABLED = true;
const SETTINGS_FEATURES_DISABLED = false;

function normalizeUploadPlatform(platform) {
  return String(platform || '').trim().toLowerCase();
}

function isInstagramUploadPlatform(platform) {
  const normalized = normalizeUploadPlatform(platform);
  return [
    'ig',
    'instagram',
    'ig-feed',
    'feed',
    'reels',
    'story',
    'stories',
    'instagram-feed',
    'instagram-reels',
    'instagram-story',
  ].includes(normalized);
}

function guardInstagramOnlyUpload(platform, label) {
  if (!UPLOAD_FEATURES_DISABLED || isInstagramUploadPlatform(platform)) return true;
  toast(label || '업로드는 인스타그램만 가능합니다.', 'error');
  return false;
}

window.isInstagramUploadPlatform = isInstagramUploadPlatform;
window.guardInstagramOnlyUpload = guardInstagramOnlyUpload;

function isUiFeatureDisabled(page) {
  const normalizedPage = String(page || '').trim();
  if (!normalizedPage) return false;
  if (DISABLED_UI_PAGES.has(normalizedPage)) return true;
  return DISABLED_UI_PREFIXES.some(prefix => normalizedPage.startsWith(prefix));
}

function isAlwaysVisibleUiElement(element) {
  if (!element) return false;
  const page = String(element.dataset?.page || '').trim();
  const pageId = String(element.id || '').trim();
  if (page === 'settings' || page === 'prompt-admin') return true;
  if (pageId === 'page-settings' || pageId === 'page-prompt-admin') return true;
  return false;
}

function hideDisabledUiElement(element) {
  if (!element) return;
  if (isAlwaysVisibleUiElement(element)) return;
  element.style.display = 'none';
  element.dataset.disabled = 'true';
}

function disableHiddenGeneratorOption(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.checked = false;
  hideDisabledUiElement(input.closest('label') || input.parentElement || input);
}

function hideRemovedControl(element) {
  if (!element) return;
  const target = element.closest('button,a,label,summary,details,[role="button"],.btn') || element;
  if (isAlwaysVisibleUiElement(target)) return;
  hideDisabledUiElement(target);
}

function pruneRemovedUploadUi() {
  if (!UPLOAD_FEATURES_DISABLED) return;
  const platformUploadPattern = /(업로드|upload|publish|발행|게시)/i;
  const instagramPattern = /(instagram|인스타|ig-|ig_|ig\b|reels|릴스)/i;
  const nonInstagramPlatformPattern = /(naver|네이버|blog|블로그|youtube|유튜브|shorts|쇼츠|tiktok|틱톡|threads|스레드|twitter|트위터|x\s*\(|x\s*업로드|x\s*게시)/i;
  document.querySelectorAll('button,a,label,summary,details,[role="button"],[onclick]').forEach(element => {
    const haystack = [
      element.textContent || '',
      element.id || '',
      element.className || '',
      element.getAttribute?.('onclick') || '',
      element.getAttribute?.('for') || '',
      element.getAttribute?.('name') || '',
    ].join(' ');
    if (!platformUploadPattern.test(haystack)) return;
    if (instagramPattern.test(haystack) && !nonInstagramPlatformPattern.test(haystack)) return;
    if (nonInstagramPlatformPattern.test(haystack)) hideRemovedControl(element);
  });

  [
    'kc-upload-blog-row',
    'kc-upload-threads-row',
    'kc-upload-twitter-row',
    'kc-upload-youtube-row',
    'kc-upload-tiktok-row',
    'kc-upload-reels-row',
    'wa-btn-naver',
    'pipe-publish-blog',
    'cnp-publish-blog',
  ].forEach(id => hideDisabledUiElement(document.getElementById(id)));

  document.querySelectorAll('[onclick*="publishProductBlog"],[onclick*="publishEdited"],[onclick*="publishPost"],[onclick*="bagPublish"],[onclick*="bagHistoryPublish"],[onclick*="uaHistoryPublishBlog"],[onclick*="uaHistoryPublishVideo"],[onclick*="publishGalleryToBlog"],[onclick*="uploadVideoToYoutube"],[onclick*="uploadVideoToTiktok"],[onclick*="vagHistoryPublish"][onclick*="shorts"],[onclick*="vagHistoryPublish"][onclick*="tiktok"]').forEach(hideRemovedControl);
}

function pruneRemovedSettingsUi() {
  if (!SETTINGS_FEATURES_DISABLED) return;
  document.querySelectorAll('[onclick*="navigateToPage"][onclick*="settings"],[onclick*="Settings"],[onclick*="settings"],[data-page="settings"]').forEach(hideRemovedControl);
  document.querySelectorAll('button,a,label,summary,details,[role="button"]').forEach(element => {
    const haystack = [
      element.textContent || '',
      element.id || '',
      element.className || '',
      element.getAttribute?.('onclick') || '',
    ].join(' ');
    if (/(설정\s*저장|현재\s*설정\s*저장|모델\s*설정|감독\s*모델\s*설정|설정에서)/i.test(haystack)) {
      hideRemovedControl(element);
    }
  });
}

function refreshSidebarSectionVisibility() {
  const nav = document.querySelector('.sidebar nav');
  if (!nav) return;
  let currentSection = null;
  let currentSectionHasVisibleItems = false;
  Array.from(nav.children).forEach(node => {
    if (node.classList.contains('nav-section')) {
      if (currentSection && !currentSectionHasVisibleItems) hideDisabledUiElement(currentSection);
      currentSection = node;
      currentSectionHasVisibleItems = false;
      return;
    }
    if (!currentSection) return;
    if (node.style.display !== 'none') currentSectionHasVisibleItems = true;
  });
  if (currentSection && !currentSectionHasVisibleItems) hideDisabledUiElement(currentSection);
}

function pruneDisabledUi() {
  document.querySelectorAll('.sidebar nav a[data-page]').forEach(link => {
    if (isUiFeatureDisabled(link.dataset.page)) hideDisabledUiElement(link);
  });

  document.querySelectorAll('.page[id^="page-"]').forEach(pageNode => {
    const page = pageNode.id.replace(/^page-/, '');
    if (isUiFeatureDisabled(page)) hideDisabledUiElement(pageNode);
  });

  document.querySelectorAll('.sidebar nav .nav-group').forEach(group => {
    const visibleLinks = Array.from(group.querySelectorAll('.nav-submenu a[data-page]'))
      .filter(link => link.style.display !== 'none');
    if (!visibleLinks.length) hideDisabledUiElement(group);
  });

  disableHiddenGeneratorOption('go-gen-detail-page');
  disableHiddenGeneratorOption('lib-gen-detail-page');
  hideDisabledUiElement(document.querySelector('[data-key="gen_detail_page"]'));
  hideDisabledUiElement(document.getElementById('kc-tab-detail'));
  pruneRemovedUploadUi();
  pruneRemovedSettingsUi();

  if (window._contentOpts && typeof window._contentOpts === 'object') {
    window._contentOpts.gen_detail_page = false;
  }

  const activePageNode = document.querySelector('.page.active');
  const activePage = activePageNode?.id?.replace(/^page-/, '') || '';
  if (isUiFeatureDisabled(activePage)) {
    document.querySelectorAll('.page').forEach(node => node.classList.remove('active'));
    document.getElementById('page-projects')?.classList.add('active');
    setActiveSidebarPage('projects');
  }

  refreshSidebarSectionVisibility();
}

window.isUiFeatureDisabled = isUiFeatureDisabled;

window.addEventListener('load', () => {
  pruneDisabledUi();
  setTimeout(pruneDisabledUi, 300);
});

function toggleSidebarGroup(groupKey, forceOpen = null) {
  const group = document.querySelector(`.sidebar nav .nav-group[data-nav-group="${groupKey}"]`);
  if (!group) return;
  const shouldOpen = forceOpen == null ? !group.classList.contains('open') : !!forceOpen;
  group.classList.toggle('open', shouldOpen);
}

function setActiveSidebarPage(page) {
  document.querySelectorAll('.sidebar nav a[data-page]').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.sidebar nav .nav-group').forEach(group => group.classList.remove('open'));
  document.querySelectorAll('.sidebar nav .nav-group-toggle').forEach(toggle => toggle.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar nav a[data-page="${page}"]`);
  if (!activeLink) return;
  activeLink.classList.add('active');
  const parentGroup = activeLink.closest('.nav-group');
  if (parentGroup) {
    parentGroup.classList.add('open');
    parentGroup.querySelector('.nav-group-toggle')?.classList.add('active');
  }
}

async function navigateToPage(page, options = {}) {
  const activePage = document.querySelector('.page.active')?.id?.replace(/^page-/, '') || '';
  if (activePage === 'claude-design' && page !== 'claude-design' && page !== 'design-code') {
    try { window.cdClearDesignSelectionForNavigation?.(); } catch (_) {}
  }
  if (page === 'meta-ads-auto' || page === 'youtube-ads-auto') {
    toast('광고 기능은 현재 임시로 비활성화되어 있습니다.', 'info');
    return;
  }
  if (isUiFeatureDisabled(page)) {
    toast('이 기능은 현재 화면에서 숨김 처리되어 있습니다.', 'info');
    return;
  }
  // 디자인 코딩 에이전트 — 같은 page-claude-design 사용 + 코딩 모드 ON
  if (page === 'design-code') {
    _logActivity('design-code', 'view');
    setActiveSidebarPage('design-code');
    document.querySelectorAll('.page').forEach(node => node.classList.remove('active'));
    document.getElementById('page-claude-design')?.classList.add('active');
    if (typeof cdInit === 'function') cdInit();
    const badge = document.getElementById('cd-mode-badge');
    if (badge) { badge.style.display = 'inline-flex'; badge.innerHTML = '💻 코딩 전문 모드'; }
    const loginBtn = document.getElementById('cd-login-btn');
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    const prov = document.getElementById('cd-provider');
    if (prov && !prov.value) {
      const codexOpt = Array.from(prov.options).find(o => o.value === 'atlas:openai/gpt-5.3-codex');
      if (codexOpt) prov.value = codexOpt.value;
    }
    // 키 미설정 자동 감지 후 로그인 다이얼로그 자동 오픈
    cdCheckLoginStatus();
    return;
  }
  // 메뉴 사용 로그 기록
  _logActivity(page, 'view');
  const targetLink = document.querySelector(`.sidebar nav a[data-page="${page}"]`);
  const targetPage = document.getElementById('page-' + page);
  if (!targetPage) return;
  const isWorking = window._kcGenerating || window._kcCnGenerating || window._bizCnGenerating || Object.keys(window._activeTasks || {}).length > 0;
  if (!options.skipConfirm && isWorking) {
    const ok = await showConfirm('진행 중인 작업이 있습니다. 중단하고 이동하시겠습니까?');
    if (!ok) return;
  }

  window._stopRequested = true;
  window._kcGenerating = false;
  window._kcCnGenerating = false;
  window._bizCnGenerating = false;
  unlockScreen();

  if (window._trendAbort) window._trendAbort.abort();

  setActiveSidebarPage(page);
  document.querySelectorAll('.page').forEach(node => node.classList.remove('active'));
  targetPage.classList.add('active');
  if (targetLink && !targetLink.closest('.nav-group')) {
    targetLink.classList.add('active');
  }

  setTimeout(() => { window._stopRequested = false; }, 500);
  if (page === 'trend-dashboard') loadTrendDashboard();
  if (page === 'super-agent') superAgentInit();
  if (page === 'wa-style') { waLoadArticles(); loadStyleList(); }
  if (page === 'biz-cardnews') bizCnInit();
  if (page === 'project-history') loadProjects(0);
  if (page === 'dashboard') loadDashboard();
  if (page === 'posts') loadPosts();
  if (page === 'video') loadVideoPostSelect();
  if (page === 'schedule') loadAutoSchedules();
  if (page === 'settings') {
    if (typeof bindModelCategoryOptions === 'function') bindModelCategoryOptions();
    loadSettings();
    loadUsageDashboard();
    if (typeof mountUnifiedSettingsSections === 'function') mountUnifiedSettingsSections();
    if (typeof switchUnifiedSettingsTab === 'function') switchUnifiedSettingsTab(window._saState?.settingsTab || 'general');
  }
  if (page === 'file-admin') loadFileAdmin();
  if (page === 'db-admin') loadDbAdmin();
  if (page === 'cardnews-gallery') loadGallery();
  if (page === 'keyword-content') kcInit();
  if (page === 'comic-agent' && typeof cagInit === 'function') cagInit();
  if (page === 'comic-agent-history' && typeof cagHistoryInit === 'function') cagHistoryInit();
  if (page === 'video-agent' && typeof vagInit === 'function') vagInit();
  if (page === 'video-agent-history' && typeof vagHistoryInit === 'function') vagHistoryInit();
  if (page === 'animation-ad' && typeof aadInit === 'function') aadInit();
  if (page === 'video-use' && typeof vuseInit === 'function') vuseInit();
  if (page === 'sns-agent' && typeof sagInit === 'function') sagInit();
  if (page === 'sns-agent-history' && typeof sagHistoryInit === 'function') sagHistoryInit();
  if (page === 'blog-agent' && typeof bagInit === 'function') bagInit();
  if (page === 'blog-agent-history' && typeof bagHistoryInit === 'function') bagHistoryInit();
  if (page === 'single-blog' && typeof sblogInit === 'function') sblogInit();
  if (page === 'single-cardnews' && typeof scnInit === 'function') scnInit();
  if (page === 'manual-cardnews' && typeof mcnInit === 'function') mcnInit();
  if (page === 'sns-planner' && typeof pagInit === 'function') pagInit();
  if (page === 'unified-agent' && typeof uaInit === 'function') uaInit();
  if (page === 'unified-history' && typeof uaHistoryInit === 'function') uaHistoryInit();
  if (page === 'detailpage-agent' && typeof dpagInit === 'function') dpagInit();
  if (page === 'detailpage-agent-history' && typeof dpagHistoryInit === 'function') dpagHistoryInit();
  if (page === 'cardnews-editor2' && typeof ce2Init === 'function') ce2Init();
  if (page === 'ce2-history') {
    if (typeof ce2HistoryInit === 'function') {
      ce2HistoryInit();
    } else {
      console.error('[ce2] ce2HistoryInit is not defined — cardnews_editor2.js may have failed to load');
      const hroot = document.getElementById('ce2-history-root');
      if (hroot) hroot.innerHTML = '<div style="text-align:center;padding:40px;color:#ff3b30;">모듈 로드 실패. 페이지를 새로고침하세요.</div>';
    }
  }
  if (page === 'single-comic-story' && typeof scsInit === 'function') scsInit();
  if (page === 'single-advideo' && typeof savInit === 'function') savInit();
  if (page === 'single-sns' && typeof sssInit === 'function') sssInit();
  if (page === 'sns-planner' && typeof spInit === 'function') await spInit();
  // if (page === 'hweb-hub' && typeof hwebInit === 'function') hwebInit();
  // 광고 자동화 임시 비활성화
  // if (page === 'meta-ads-auto' && typeof maaInit === 'function') maaInit();
  // if (page === 'youtube-ads-auto' && typeof yaaInit === 'function') yaaInit();
  if (page === 'library') libLoadProfiles();
  if (page === 'threads-lab' && typeof tlInit === 'function') tlInit();
  if (page === 'naver-blog-lab' && typeof nblInit === 'function') nblInit();
  if (page === 'prompt-admin') paInit();
  if (page.startsWith('ec-') && typeof ecPageInit === 'function') ecPageInit(page);
  if (page === 'desktop-agent' && typeof autoInitDesktopAgentPage === 'function') autoInitDesktopAgentPage();
  if (page === 'video-studio' && typeof vsInit === 'function') vsInit();
  if (page === 'video-utils' && typeof vuInit === 'function') vuInit();
  if (page === 'claude-design' && typeof cdInit === 'function') {
    cdInit({ fresh: !options.fromHistory });
    const badge = document.getElementById('cd-mode-badge');
    if (badge) { badge.style.display = 'none'; }
    const loginBtn = document.getElementById('cd-login-btn');
    if (loginBtn) loginBtn.style.display = 'none';
  }
  if (page === 'claude-design-history' && typeof cdInitHistoryPage === 'function') cdInitHistoryPage();
  if (page === 'generate') {
    applyDefaultProfile({ brandNameId: 'gen-business-name', businessTypeId: 'gen-business-type' });
  }
}

document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.addEventListener('click', async e => {
    const page = a.dataset.page;
    if (!page) return;
    e.preventDefault();
    await navigateToPage(page);
  });
});

// Toast
// ── 메뉴 사용 로그 ──────────────────────────────────────────
function _logActivity(page, action, detail) {
  try {
    const body = JSON.stringify({ page, action: action || 'view', detail: detail || '', profile_id: parseInt(window._globalProfileId || 0) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/activity-log', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/activity-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {}
}
window._logActivity = _logActivity;

// ── 커스텀 confirm/alert 모달 (강조색 테마) ──────────────────
function _mkkConfirm(msg) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);"><div style="font-size:14px;color:#1c1c1e;line-height:1.7;white-space:pre-wrap;margin-bottom:20px;">' + (msg||'').replace(/</g,'&lt;') + '</div><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="_mkk_c_ok" style="padding:10px 28px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">확인</button><button id="_mkk_c_no" style="padding:10px 28px;border-radius:12px;border:1px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.55);font-size:14px;font-weight:700;cursor:pointer;">취소</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#_mkk_c_ok').onclick = () => { ov.remove(); resolve(true); };
    ov.querySelector('#_mkk_c_no').onclick = () => { ov.remove(); resolve(false); };
  });
}
function _mkkAlert(msg) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:20px;padding:28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);"><div style="font-size:14px;color:#1c1c1e;line-height:1.7;white-space:pre-wrap;margin-bottom:20px;">' + (msg||'').replace(/</g,'&lt;') + '</div><div style="display:flex;gap:10px;justify-content:flex-end;"><button id="_mkk_a_ok" style="padding:10px 28px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">확인</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#_mkk_a_ok').onclick = () => { ov.remove(); resolve(); };
  });
}
window._mkkConfirm = _mkkConfirm;
window._mkkAlert = _mkkAlert;

async function loadActivityDashboard() {
  const days = parseInt(document.getElementById('activity-log-days')?.value || '7');
  // 통계 요약
  try {
    const summary = await api(`/api/activity-log/summary?days=${days}`);
    const items = summary.items || [];
    const summaryEl = document.getElementById('activity-log-summary');
    if (summaryEl) {
      if (!items.length) {
        summaryEl.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">해당 기간에 기록된 활동이 없습니다.</div>';
      } else {
        const totalCount = items.reduce((s, i) => s + i.count, 0);
        const viewItems = items.filter(i => i.action === 'view').sort((a, b) => b.count - a.count);
        const actionItems = items.filter(i => i.action !== 'view').sort((a, b) => b.count - a.count);
        summaryEl.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px;">
            <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;background:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#ff8c00;">${totalCount}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.4);">총 활동</div>
            </div>
            <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;background:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#007aff;">${viewItems.length}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.4);">사용 메뉴</div>
            </div>
            <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;background:#fff;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:#34c759;">${actionItems.reduce((s, i) => s + i.count, 0)}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.4);">생성 횟수</div>
            </div>
          </div>
          ${viewItems.length ? `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:6px;">메뉴별 방문 횟수</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${viewItems.map(i => `<span style="padding:5px 10px;border-radius:8px;background:rgba(0,122,255,0.06);font-size:12px;font-weight:600;color:#007aff;">${i.page} <strong>${i.count}</strong></span>`).join('')}</div></div>` : ''}
          ${actionItems.length ? `<div><div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:6px;">생성 액션</div><div style="display:flex;flex-wrap:wrap;gap:6px;">${actionItems.map(i => `<span style="padding:5px 10px;border-radius:8px;background:rgba(52,199,89,0.06);font-size:12px;font-weight:600;color:#34c759;">${i.page}/${i.action} <strong>${i.count}</strong></span>`).join('')}</div></div>` : ''}
        `;
        // 필터 드롭다운 채우기
        const filterEl = document.getElementById('activity-log-page-filter');
        if (filterEl) {
          const pages = [...new Set(items.map(i => i.page))].sort();
          const current = filterEl.value;
          filterEl.innerHTML = '<option value="">전체 메뉴</option>' + pages.map(p => `<option value="${p}" ${p === current ? 'selected' : ''}>${p}</option>`).join('');
        }
      }
    }
  } catch {}
  loadActivityLog();
}

async function loadActivityLog() {
  const page = document.getElementById('activity-log-page-filter')?.value || '';
  const listEl = document.getElementById('activity-log-list');
  if (!listEl) return;
  try {
    const res = await api(`/api/activity-log?limit=50${page ? '&page=' + page : ''}`);
    const items = res.items || [];
    if (!items.length) {
      listEl.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">로그가 없습니다.</div>';
      return;
    }
    listEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="border-bottom:1px solid rgba(0,0,0,0.08);"><th style="text-align:left;padding:8px;color:rgba(0,0,0,0.4);">시간</th><th style="text-align:left;padding:8px;color:rgba(0,0,0,0.4);">메뉴</th><th style="text-align:left;padding:8px;color:rgba(0,0,0,0.4);">액션</th><th style="text-align:left;padding:8px;color:rgba(0,0,0,0.4);">상세</th></tr>
      ${items.map(i => `<tr style="border-bottom:1px solid rgba(0,0,0,0.04);">
        <td style="padding:6px 8px;color:rgba(0,0,0,0.4);white-space:nowrap;">${i.created_at?.slice(5, 16) || ''}</td>
        <td style="padding:6px 8px;font-weight:600;">${i.page}</td>
        <td style="padding:6px 8px;"><span style="padding:2px 8px;border-radius:6px;background:${i.action === 'view' ? 'rgba(0,122,255,0.08)' : 'rgba(52,199,89,0.08)'};color:${i.action === 'view' ? '#007aff' : '#34c759'};font-weight:700;font-size:11px;">${i.action}</span></td>
        <td style="padding:6px 8px;color:rgba(0,0,0,0.5);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.detail || '-'}</td>
      </tr>`).join('')}
    </table>`;
  } catch (e) {
    listEl.innerHTML = `<div style="color:#ff3b30;font-size:12px;">로그 로드 실패: ${e.message}</div>`;
  }
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  const container = document.getElementById('toastContainer');
  // working-overlay 아래에 위치하도록 동적 조정
  const overlay = document.getElementById('working-overlay');
  if (overlay && overlay.classList.contains('active')) {
    container.style.top = (overlay.offsetHeight + 12) + 'px';
  } else {
    container.style.top = '12px';
  }
  container.appendChild(el);
  const duration = type === 'error' ? 8000 : 3000;
  setTimeout(() => {
    el.classList.add('toast-removing');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// 범용 입력 모달 (prompt 대체)
window.__makekeModalCleanup = null;

function openMakekeModal(opts = {}) {
  const existing = document.getElementById('makeke-generic-modal');
  if (existing) existing.remove();
  if (typeof window.__makekeModalCleanup === 'function') {
    try { window.__makekeModalCleanup(); } catch (e) {}
    window.__makekeModalCleanup = null;
  }

  const overlay = document.createElement('div');
  overlay.id = 'makeke-generic-modal';
  overlay.className = 'modal-overlay show';
  overlay.style.zIndex = String(opts.zIndex || 100050);

  const width = opts.width || '720px';
  const maxWidth = opts.maxWidth || 'calc(100vw - 32px)';
  const title = opts.title || '모달';
  const description = opts.description || '';
  const bodyHtml = opts.html || '';

  overlay.innerHTML = `
    <div class="modal" style="width:${width};max-width:${maxWidth};max-height:calc(100vh - 40px);padding:24px 24px 22px;" data-makeke-modal-card="true">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:800;color:#1c1c1e;">${title}</h2>
          ${description ? `<div style="margin-top:6px;font-size:13px;line-height:1.55;color:rgba(0,0,0,0.48);">${description}</div>` : ''}
        </div>
        <button class="modal-close" type="button" onclick="closeMakekeModal()">&times;</button>
      </div>
      <div id="makeke-generic-modal-body">${bodyHtml}</div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && opts.closeOnOverlay !== false) {
      closeMakekeModal();
    }
  });

  document.body.appendChild(overlay);
  if (typeof opts.onOpen === 'function') {
    opts.onOpen(overlay);
  }
  if (typeof opts.onClose === 'function') {
    window.__makekeModalCleanup = () => opts.onClose();
  }
  return overlay;
}

function closeMakekeModal() {
  const modal = document.getElementById('makeke-generic-modal');
  if (modal) modal.remove();
  if (typeof window.__makekeModalCleanup === 'function') {
    try { window.__makekeModalCleanup(); } catch (e) {}
    window.__makekeModalCleanup = null;
  }
}

function showInputModal(title, message, defaultValue = '') {
  return new Promise(resolve => {
    let modal = document.getElementById('generic-input-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'generic-input-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;width:380px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;">
        <h3 style="font-size:16px;font-weight:700;margin:0 0 8px;">${title}</h3>
        <p style="font-size:13px;color:rgba(0,0,0,0.5);margin:0 0 14px;line-height:1.4;">${message}</p>
        <input type="text" id="gim-input" value="${defaultValue}" style="width:100%;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.12);margin-bottom:14px;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="gim-cancel" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
          <button id="gim-ok" style="padding:8px 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">확인</button>
        </div>
      </div>`;
    const close = val => { modal.remove(); resolve(val); };
    modal.querySelector('#gim-cancel').onclick = () => close(null);
    modal.querySelector('#gim-ok').onclick = () => close(modal.querySelector('#gim-input').value);
    modal.querySelector('#gim-input').onkeydown = e => { if (e.key === 'Enter') close(modal.querySelector('#gim-input').value); if (e.key === 'Escape') close(null); };
    modal.addEventListener('click', e => { if (e.target === modal) close(null); });
    document.body.appendChild(modal);
    modal.querySelector('#gim-input').focus();
    modal.querySelector('#gim-input').select();
  });
}

// ═══ 통합 네이버 업로드 모달 ═══
// 어디서든 openUploadModal(opts) 호출하면 동일한 업로드 UI 표시
// opts: { title, content, tags, images, detailPageImages, cardnewsImages, postId, blogUrl }
function openUploadModal(opts = {}) {
  if (!guardInstagramOnlyUpload('blog')) return;
  let modal = document.getElementById('upload-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'upload-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1000002;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

  const title = opts.title || '';
  const content = opts.content || '';
  const tags = opts.tags || [];
  const blogImages = opts.images || [];
  const detailImages = opts.detailPageImages || opts.cardnewsImages || [];
  const comicImage = opts.comicImage || '';
  const hasText = !!(title && content);
  const hasBlogImages = blogImages.length > 0;
  const hasDetailImages = detailImages.length > 0;
  const hasComic = !!comicImage;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;width:480px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;font-size:18px;color:#03c75a;">N 네이버 블로그 발행</h2>
        <button onclick="document.getElementById('upload-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:rgba(0,0,0,0.3);">&times;</button>
      </div>

      <!-- 제목 -->
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">제목</label>
        <input type="text" id="um-title" value="${escapeHtml(title)}" style="width:100%;padding:10px 14px;font-size:14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;">
      </div>

      <!-- 태그 -->
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">태그</label>
        <input type="text" id="um-tags" value="${escapeHtml(tags.join(', '))}" placeholder="태그1, 태그2, ..." style="width:100%;padding:10px 14px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;">
      </div>

      <!-- 발행 형태 -->
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:8px;display:block;">발행 형태</label>
        <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-bottom:10px;">본문은 항상 함께 발행됩니다.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <label class="um-mode" style="flex:1;min-width:130px;padding:12px;border:2px solid ${hasText ? '#03c75a' : 'rgba(0,0,0,0.06)'};border-radius:10px;${hasText ? 'cursor:pointer;' : 'opacity:0.35;pointer-events:none;'}text-align:center;" onclick="_umSelect('text','#03c75a')">
            <div style="font-size:12px;font-weight:600;color:#1c1c1e;">텍스트글</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">${hasText ? content.length + '자' : '없음'}</div>
          </label>
          <label class="um-mode" style="flex:1;min-width:130px;padding:12px;border:2px solid rgba(0,0,0,0.06);border-radius:10px;${hasText && hasBlogImages ? 'cursor:pointer;' : 'opacity:0.35;pointer-events:none;'}text-align:center;" onclick="_umSelect('text-blog-images','#ff8c00')">
            <div style="font-size:12px;font-weight:600;color:#1c1c1e;">텍스트글 + 블로그 이미지</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">${hasText && hasBlogImages ? blogImages.length + '장' : '없음'}</div>
          </label>
          <label class="um-mode" style="flex:1;min-width:130px;padding:12px;border:2px solid rgba(0,0,0,0.06);border-radius:10px;${hasText && hasDetailImages ? 'cursor:pointer;' : 'opacity:0.35;pointer-events:none;'}text-align:center;" onclick="_umSelect('text-detail-page','#007aff')">
            <div style="font-size:12px;font-weight:600;color:#1c1c1e;">텍스트글 + 상세페이지</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">${hasText && hasDetailImages ? detailImages.length + '장' : '없음'}</div>
          </label>
          <label class="um-mode" style="flex:1;min-width:130px;padding:12px;border:2px solid rgba(0,0,0,0.06);border-radius:10px;${hasText && hasComic ? 'cursor:pointer;' : 'opacity:0.35;pointer-events:none;'}text-align:center;" onclick="_umSelect('text-comic','#34c759')">
            <div style="font-size:12px;font-weight:600;color:#1c1c1e;">텍스트글 + 만화</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">${hasText && hasComic ? '만화 포함' : '없음'}</div>
          </label>
        </div>
      </div>

      <!-- 발행 버튼 -->
      <button id="um-publish-btn" onclick="_doUnifiedPublish()" style="width:100%;padding:14px;background:#03c75a;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        네이버 블로그에 발행
      </button>
    </div>`;

  window._umMode = 'text';
  window._umData = opts;
  window._umSelect = function(mode, color) {
    document.querySelectorAll('.um-mode').forEach(e => e.style.borderColor = 'rgba(0,0,0,0.06)');
    event.currentTarget.style.borderColor = color;
    window._umMode = mode;
  };
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  // 프로필 업로드 설정 반영
  try {
    const pa = window._globalProfileData?.platform_accounts ?
      (typeof window._globalProfileData.platform_accounts === 'string' ? JSON.parse(window._globalProfileData.platform_accounts) : window._globalProfileData.platform_accounts) : {};
    if (pa.upload_threads === 'none') document.getElementById('um-threads').checked = false;
    else if (pa.upload_threads) { document.getElementById('um-threads').checked = true; document.getElementById('um-threads-type').value = pa.upload_threads; }
    if (pa.upload_twitter === 'none') document.getElementById('um-twitter').checked = false;
    else if (pa.upload_twitter) document.getElementById('um-twitter').checked = true;
    if (pa.upload_ig_feed === 'none') document.getElementById('um-ig-feed').checked = false;
    else if (pa.upload_ig_feed && pa.upload_ig_feed !== 'none') { document.getElementById('um-ig-feed').checked = true; document.getElementById('um-ig-feed-type').value = pa.upload_ig_feed; }
  } catch {}
}

window._isPublishing = false;

async function _doUnifiedPublish() {
  if (window._isPublishing) { toast('이미 발행 중입니다', 'error'); return; }
  if (!await kcCheckPublishReady()) return;

  window._isPublishing = true;
  const btn = document.getElementById('um-publish-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span> 블로그 발행 중...';
  // 모달 밖 발행 버튼들도 비활성화
  document.querySelectorAll('[onclick*="projPublish"],[onclick*="kcOpenUnifiedUpload"]').forEach(b => {
    b.disabled = true; b.dataset.origText = b.innerHTML;
    b.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span> 발행 중...'; b.style.opacity = '0.5';
  });
  lockScreen('네이버 블로그 발행 중', '캡차가 뜨면 Chrome에서 직접 입력해주세요', 'naver-publish');

  const title = document.getElementById('um-title').value.trim();
  const tagStr = document.getElementById('um-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];
  const d = window._umData || {};
  const mode = window._umMode || 'text';

  try {
    let pubImages = [];
    let content = d.content || title;

    if (mode === 'text') {
      pubImages = [];
    } else if (mode === 'text-blog-images') {
      pubImages = d.images || [];
      content = d.content || title;
    } else if (mode === 'text-detail-page') {
      pubImages = d.detailPageImages?.length ? d.detailPageImages : (d.cardnewsImages || []);
      content = d.content || title;
    } else if (mode === 'text-comic') {
      pubImages = d.comicImage ? [d.comicImage] : [];
      content = d.content || title;
    }

    const res = await api('/api/blog/publish', {
      method: 'POST',
      body: { post_id: d.postId || null, title, content, tags, images: pubImages, profile_id: parseInt(window._globalProfileId || 0) },
    });

    if (res.result?.status === 'error') {
      throw new Error(res.result.message || '발행 실패');
    }
    const blogUrl = res.result?.url || res.url || '';

    // 프로젝트에 발행 URL 저장
    if (blogUrl && d.postId) {
      api(`/api/blog/posts/${d.postId}`, { method: 'PUT', body: { title, content, tags: tags.join(', ') } }).catch(() => {});
      // projects 테이블에서 blog_id로 프로젝트 찾아서 URL 저장
      try {
        const projRes = await api(`/api/projects/by-blog/${d.postId}`);
        if (projRes?.project_id) {
          api(`/api/projects/${projRes.project_id}`, { method: 'PUT', body: { blog_url: blogUrl, blog_uploaded_at: new Date().toISOString() } }).catch(() => {});
        }
      } catch {}
    }

    unlockScreen('naver-publish');
    window._isPublishing = false;
    _restorePublishButtons();
    toast('네이버 블로그 발행 완료!' + (blogUrl ? '\n' + blogUrl : ''));
    const _um = document.getElementById('upload-modal');
    if (_um) _um.remove();
  } catch (e) {
    unlockScreen('naver-publish');
    window._isPublishing = false;
    _restorePublishButtons();
    toast('발행 실패: ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> 다시 시도';
  }
}

function _restorePublishButtons() {
  document.querySelectorAll('[onclick*="projPublish"],[onclick*="kcOpenUnifiedUpload"]').forEach(b => {
    b.disabled = false; b.style.opacity = '1';
    if (b.dataset.origText) { b.innerHTML = b.dataset.origText; delete b.dataset.origText; }
  });
}

// 커스텀 confirm 모달 (Electron 기본 대화상자 대체)
function showConfirm(message) {
  return new Promise(resolve => {
    let modal = document.getElementById('custom-confirm-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;width:360px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,140,0,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ff8c00" stroke-width="2" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p style="font-size:14px;color:#1c1c1e;line-height:1.6;margin:0;font-weight:500;">${message}</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="ccm-cancel" style="padding:10px 20px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
          <button id="ccm-ok" style="padding:10px 20px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">확인</button>
        </div>
      </div>`;
    const close = val => { modal.remove(); resolve(val); };
    modal.querySelector('#ccm-cancel').onclick = () => close(false);
    modal.querySelector('#ccm-ok').onclick = () => close(true);
    modal.addEventListener('click', e => { if (e.target === modal) close(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', handler); }
      if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', handler); }
    });
    document.body.appendChild(modal);
    modal.querySelector('#ccm-ok').focus();
  });
}

function showInputDialog(title, placeholder, defaultValue) {
  return new Promise(resolve => {
    let modal = document.getElementById('custom-input-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'custom-input-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;width:380px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both;">
        <div style="font-size:15px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">${title}</div>
        <input id="cim-input" type="text" value="${defaultValue || ''}" placeholder="${placeholder || ''}" style="width:100%;padding:10px 14px;border:1.5px solid rgba(255,140,0,0.3);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button id="cim-cancel" style="padding:10px 20px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
          <button id="cim-ok" style="padding:10px 20px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">저장</button>
        </div>
      </div>`;
    const close = val => { modal.remove(); resolve(val); };
    modal.querySelector('#cim-cancel').onclick = () => close(null);
    modal.querySelector('#cim-ok').onclick = () => close(modal.querySelector('#cim-input').value);
    modal.addEventListener('click', e => { if (e.target === modal) close(null); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(null); document.removeEventListener('keydown', handler); }
      if (e.key === 'Enter') { close(modal.querySelector('#cim-input').value); document.removeEventListener('keydown', handler); }
    });
    document.body.appendChild(modal);
    modal.querySelector('#cim-input').focus();
  });
}

// API helper
let _apiRecoveringPromise = null;

async function _recoverBackendForFetchError(forceRestart = false) {
  if (!window.electronAPI?.backendStatus || !window.electronAPI?.backendRestart) return false;
  if (_apiRecoveringPromise) return _apiRecoveringPromise;
  _apiRecoveringPromise = (async () => {
    try {
      const status = await window.electronAPI.backendStatus();
      if (status?.reachable && !forceRestart) return true;
      const restarted = await window.electronAPI.backendRestart();
      return !!restarted?.ok;
    } catch (e) {
      console.error('[API] 백엔드 자동 복구 실패:', e?.message || e);
      return false;
    } finally {
      setTimeout(() => { _apiRecoveringPromise = null; }, 1000);
    }
  })();
  return _apiRecoveringPromise;
}

async function api(path, opts = {}) {
  const fetchOpts = {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (opts.body) fetchOpts.body = JSON.stringify(opts.body);
  if (opts.signal) fetchOpts.signal = opts.signal;
  console.log(`[API] ${fetchOpts.method} ${path}`, opts.body ? JSON.stringify(opts.body).substring(0, 200) : '');
  let res;
  try {
    res = await fetch(API + path, fetchOpts);
  } catch (e) {
    console.error(`[API] ${path} 실패:`, e.message);
    const isFetchError = /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '');
    if (isFetchError && !opts._retriedAfterRecovery) {
      const recovered = await _recoverBackendForFetchError();
      if (recovered) {
        return api(path, { ...opts, _retriedAfterRecovery: true });
      }
    }
    if (isFetchError) {
      const friendly = new Error('서버 연결 실패: 마케케 API 서버가 재시작 중이거나 연결이 끊겼습니다. 잠시 후 다시 시도하세요. 계속 반복되면 설정의 Chrome 확장 연결과 서버 상태를 확인하세요.');
      friendly.cause = e;
      throw friendly;
    }
    throw e;
  }
  console.log(`[API] ${path} → ${res.status}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail ?? err.error ?? err.message;
    const shouldRetryOn404 =
      res.status === 404 &&
      !opts._retriedAfterRecovery &&
      (
        path.startsWith('/api/ecommerce/skill/') ||
        path.startsWith('/api/super-agent/deerflow/')
      );
    if (shouldRetryOn404) {
      const recovered = await _recoverBackendForFetchError(true);
      if (recovered) {
        return api(path, { ...opts, _retriedAfterRecovery: true });
      }
    }
    const msg = typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : (detail || `HTTP ${res.status}`);
    const e = new Error(msg);
    e.status = res.status;
    if (typeof detail === 'object' && detail.traceback) e.traceback = detail.traceback;
    // 서버 에러(500만) 에러 패널에 자동 표시 (503 서비스 미지원 등은 제외)
    if (res.status === 500) {
      const tb = e.traceback || '';
      _showErrorPanel(`[API ${res.status}] ${path}: ${msg}`, 'server', '', tb);
    }
    throw e;
  }
  return res.json();
}

let _superAgentPlan = null;
let _superAgentExecution = null;
let _superAgentThreadId = null;
let _superAgentRuntimeStatus = null;
let _superAgentMessages = [];

function superAgentStatus(message, tone = 'info') {
  const el = document.getElementById('super-agent-status');
  if (!el) return;
  const tones = {
    info: { bg: 'rgba(0,122,255,0.08)', fg: '#007aff' },
    success: { bg: 'rgba(52,199,89,0.10)', fg: '#34c759' },
    warning: { bg: 'rgba(255,149,0,0.10)', fg: '#ff9500' },
    error: { bg: 'rgba(255,59,48,0.08)', fg: '#ff3b30' },
  };
  const palette = tones[tone] || tones.info;
  el.innerHTML = `<div style="padding:12px 14px;border-radius:14px;background:${palette.bg};color:${palette.fg};line-height:1.6;">${message}</div>`;
}

function superAgentFillCommand(text) {
  const el = document.getElementById('super-agent-command');
  if (!el) return;
  el.value = text;
  el.focus();
}

function superAgentEscapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function superAgentRender(plan) {
  const applyBtn = document.getElementById('super-agent-apply-btn');
  if (!applyBtn) return;

  if (!plan) {
    applyBtn.disabled = true;
    return;
  }
  applyBtn.disabled = !plan.target_page;
}

function superAgentPushMessage(role, title, body, meta = '') {
  _superAgentMessages.push({ role, title, body, meta });
  superAgentRenderMessages();
}

function superAgentRenderMessages() {
  const log = document.getElementById('super-agent-chat-log');
  if (!log) return;
  if (!_superAgentMessages.length) {
    log.innerHTML = '';
    return;
  }
  log.innerHTML = _superAgentMessages.map((msg) => {
    const isUser = msg.role === 'user';
    const align = isUser ? 'flex-end' : 'flex-start';
    const bg = isUser ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' : '#fff';
    const color = isUser ? '#fff' : '#1c1c1e';
    const border = isUser ? 'none' : '1px solid rgba(0,0,0,0.08)';
    const metaColor = isUser ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.42)';
    return `
      <div style="display:flex;justify-content:${align};">
        <div style="max-width:min(78%, 680px);padding:14px 16px;border-radius:18px;background:${bg};color:${color};border:${border};box-shadow:${isUser ? '0 14px 28px rgba(255,140,0,0.16)' : '0 10px 22px rgba(0,0,0,0.04)'};">
          <div style="font-size:12px;font-weight:800;color:${metaColor};text-transform:uppercase;letter-spacing:0.6px;">${superAgentEscapeHtml(msg.title)}</div>
          ${msg.meta ? `<div style="font-size:11px;color:${metaColor};line-height:1.7;margin-top:4px;">${superAgentEscapeHtml(msg.meta)}</div>` : ''}
          <div style="font-size:13px;line-height:1.8;margin-top:8px;white-space:pre-wrap;">${superAgentEscapeHtml(msg.body)}</div>
        </div>
      </div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
}

function superAgentRenderRuntime(status) {
  const summary = document.getElementById('super-agent-runtime-summary');
  const detail = document.getElementById('super-agent-runtime-detail');
  if (!summary || !detail) return;
  if (!status) {
    summary.textContent = '실행 상태를 아직 불러오지 못했습니다.';
    detail.textContent = '';
    return;
  }
  summary.textContent = status.ready
    ? `실행 환경 준비됨 · ${status.venv_ready ? '바로 사용 가능' : '첫 실행 시 자동 준비'}`
    : '실행 소스를 찾지 못했습니다.';
  detail.textContent = `모델 ${status.model || '-'} · venv ${status.venv_ready ? 'ready' : 'bootstrap needed'}`;
}

async function superAgentLoadRuntime() {
  try {
    const res = await api('/api/super-agent/deerflow/status');
    _superAgentRuntimeStatus = res.result || null;
    superAgentRenderRuntime(_superAgentRuntimeStatus);
  } catch (e) {
    superAgentRenderRuntime(null);
  }
}

function superAgentInit() {
  superAgentRender(_superAgentPlan);
  superAgentRenderRuntime(_superAgentRuntimeStatus);
  superAgentRenderMessages();
  const input = document.getElementById('super-agent-command');
  if (input && !input.dataset.boundEnter) {
    input.dataset.boundEnter = 'true';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        superAgentExecute();
      }
    });
  }
  if (!_superAgentRuntimeStatus) superAgentLoadRuntime();
}

async function superAgentRun() {
  const command = document.getElementById('super-agent-command')?.value?.trim();
  const runBtn = document.getElementById('super-agent-run-btn');
  if (!command) {
    superAgentStatus('먼저 종합 에이전트에게 시킬 명령을 입력하세요.', 'error');
    return;
  }
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = '해석 중...';
  }
  superAgentStatus('Gemini가 이 명령을 어느 기능으로 보내야 하는지 해석하고 있습니다.', 'info');
  try {
    const res = await api('/api/super-agent/plan', {
      method: 'POST',
      body: { command }
    });
    _superAgentPlan = res.plan || null;
    superAgentRender(_superAgentPlan);
    if (_superAgentPlan) {
      const detail = [
        `대상 페이지: ${_superAgentPlan.target_page || '-'}`,
        `연결 모드: ${_superAgentPlan.target_mode || '-'}`,
      ].join(' · ');
      superAgentPushMessage(
        'assistant',
        '라우팅',
        `${_superAgentPlan.summary || '해석 완료'}\n\n${_superAgentPlan.answer || ''}${_superAgentPlan.warning ? `\n\n주의: ${_superAgentPlan.warning}` : ''}`,
        detail,
      );
    }
    const tone = _superAgentPlan?.target_page ? 'success' : 'warning';
    superAgentStatus(
      `${_superAgentPlan?.summary || '해석 완료'}${_superAgentPlan?.target_page ? `<br>추천 대상: ${_superAgentPlan.target_page}` : ''}`,
      tone,
    );
  } catch (e) {
    superAgentStatus(`종합 에이전트 해석 실패: ${e.message}`, 'error');
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = '해석하기';
    }
  }
}

async function superAgentExecute() {
  const input = document.getElementById('super-agent-command');
  const command = input?.value?.trim();
  const execBtn = document.getElementById('super-agent-exec-btn');
  if (!command) {
    superAgentStatus('먼저 실행할 명령을 입력하세요.', 'error');
    return;
  }
  superAgentPushMessage('user', '나', command);
  if (input) input.value = '';
  if (execBtn) { execBtn.disabled = true; execBtn.textContent = '실행 중...'; }
  superAgentStatus('DeerFlow 에이전트가 실행 중입니다...', 'info');

  // SSE 스트리밍으로 DeerFlow 실행
  let currentAiBubbleId = null;
  let currentAiText = '';

  try {
    const res = await fetch('/api/super-agent/deerflow/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, thread_id: _superAgentThreadId || null }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            _saHandleSSE(eventType || 'message', data);
          } catch (_) {}
          eventType = null;
        }
      }
    }

    superAgentStatus('실행 완료', 'success');
  } catch (e) {
    superAgentPushMessage('assistant', '에이전트', `실행에 실패했습니다: ${e.message}`, '');
    superAgentStatus(`DeerFlow 실행 실패: ${e.message}`, 'error');
  } finally {
    if (execBtn) { execBtn.disabled = false; execBtn.textContent = '보내기'; }
    // 스트리밍 완료 후 최종 AI 텍스트를 마크다운으로 재렌더링
    const lastBubble = document.getElementById(_saCurrentAiBubbleId);
    if (lastBubble && _saCurrentAiText) {
      lastBubble.innerHTML = _saRenderMarkdown(_saCurrentAiText);
    }
  }

  // SSE 이벤트 핸들러 — 클로저 대신 모듈 상태 사용
  function _saHandleSSE(eventType, data) {
    switch (eventType) {
      case 'meta':
        if (data.thread_id) _superAgentThreadId = data.thread_id;
        break;

      case 'messages-tuple':
        if (data.type === 'ai') {
          if (data.tool_calls && data.tool_calls.length) {
            data.tool_calls.forEach(tc => _saAddToolCard(tc));
          }
          if (data.content) {
            _saAppendAiText(data.content, data.id);
          }
        } else if (data.type === 'tool') {
          _saUpdateToolCard(data.tool_call_id, data.content, data.name);
        }
        break;

      case 'values':
        if (data.todos && data.todos.length) _saRenderTodos(data.todos);
        if (data.artifacts && data.artifacts.length) _saRenderArtifacts(data.artifacts);
        break;

      case 'end':
        if (data.usage) {
          const u = data.usage;
          superAgentStatus(`완료 · 입력 ${u.input_tokens || 0} + 출력 ${u.output_tokens || 0} 토큰`, 'success');
        }
        break;

      case 'error':
        superAgentPushMessage('assistant', '에이전트', `오류: ${data.message || '알 수 없는 오류'}`, '');
        superAgentStatus(`오류: ${data.message}`, 'error');
        break;
    }
  }
}

// ── SSE 렌더링 헬퍼 함수 ─────────────────────────────────────

let _saCurrentAiBubbleId = null;
let _saCurrentAiText = '';

function _saRenderMarkdown(text) {
  if (typeof marked !== 'undefined' && marked.parse) {
    try { return marked.parse(text); } catch (_) {}
  }
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function _saAppendAiText(text, msgId) {
  const log = document.getElementById('super-agent-chat-log');
  if (!log) return;

  // 새 AI 메시지이면 버블 생성
  if (!_saCurrentAiBubbleId || _saCurrentAiBubbleId !== 'sa-ai-' + msgId) {
    _saCurrentAiBubbleId = 'sa-ai-' + msgId;
    _saCurrentAiText = '';
    const bubble = document.createElement('div');
    bubble.style.cssText = 'align-self:flex-start;max-width:85%;';
    bubble.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">에이전트</div>
      <div id="${_saCurrentAiBubbleId}" style="padding:14px 18px;border-radius:20px;background:rgba(0,0,0,0.05);font-size:14px;line-height:1.8;color:#1c1c1e;"></div>`;
    log.appendChild(bubble);
  }

  _saCurrentAiText += text;
  const el = document.getElementById(_saCurrentAiBubbleId);
  if (el) el.innerHTML = _saRenderMarkdown(_saCurrentAiText);
  log.scrollTop = log.scrollHeight;
}

function _saAddToolCard(toolCall) {
  const log = document.getElementById('super-agent-chat-log');
  if (!log) return;

  const cardId = 'sa-tool-' + (toolCall.id || Math.random().toString(36).slice(2));
  const argsText = toolCall.args ? JSON.stringify(toolCall.args, null, 2) : '';
  const card = document.createElement('div');
  card.id = cardId;
  card.style.cssText = 'align-self:flex-start;max-width:85%;margin:4px 0;';
  card.innerHTML = `
    <div style="padding:12px 16px;border-radius:16px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.15);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
        <span class="sa-tool-spinner" style="width:14px;height:14px;border:2px solid rgba(255,140,0,0.3);border-top-color:#ff8c00;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></span>
        <span style="font-size:13px;font-weight:700;color:#ff8c00;">${toolCall.name || '도구'}</span>
        <span style="font-size:11px;color:rgba(0,0,0,0.35);">실행 중...</span>
      </div>
      <div style="display:none;font-size:12px;color:rgba(0,0,0,0.5);font-family:ui-monospace,monospace;white-space:pre-wrap;max-height:200px;overflow:auto;padding:8px;background:rgba(0,0,0,0.03);border-radius:8px;">${argsText.replace(/</g,'&lt;')}</div>
      <div class="sa-tool-result" style="display:none;margin-top:8px;"></div>
    </div>`;
  log.appendChild(card);
  log.scrollTop = log.scrollHeight;

  // 새 AI 텍스트가 이 도구 이후 올 수 있으므로 bubbleId 초기화
  _saCurrentAiBubbleId = null;
  _saCurrentAiText = '';
}

function _saUpdateToolCard(toolCallId, content, name) {
  // toolCallId로 카드 찾기
  let card = document.getElementById('sa-tool-' + toolCallId);
  if (!card) {
    // fallback: 마지막 도구 카드
    const cards = document.querySelectorAll('[id^="sa-tool-"]');
    if (cards.length) card = cards[cards.length - 1];
  }
  if (!card) return;

  // 스피너 → 체크마크
  const spinner = card.querySelector('.sa-tool-spinner');
  if (spinner) {
    spinner.style.animation = 'none';
    spinner.style.border = 'none';
    spinner.innerHTML = '✓';
    spinner.style.color = '#34c759';
    spinner.style.fontWeight = '700';
    spinner.style.fontSize = '14px';
  }
  const statusText = card.querySelector('span:last-of-type');

  // 결과 파싱 및 표시
  const resultEl = card.querySelector('.sa-tool-result');
  if (!resultEl) return;
  resultEl.style.display = '';

  let parsed = null;
  try { parsed = JSON.parse(content); } catch (_) {}

  // 이미지 결과 특별 처리
  if (parsed && parsed.images && Array.isArray(parsed.images)) {
    if (statusText) statusText.textContent = `${parsed.images.length}개 이미지 생성됨`;
    resultEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
        ${parsed.images.map((img, i) => {
          const src = img.url || img;
          return `<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">
            <img src="${src}" alt="생성 결과 ${i+1}" style="width:100%;display:block;">
            <div style="padding:6px;text-align:center;">
              <a href="${src}" download="result_${i+1}.png" style="font-size:11px;color:#ff8c00;text-decoration:none;font-weight:600;">다운로드</a>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    return;
  }

  // 텍스트 결과
  if (statusText) statusText.textContent = '완료';
  const displayText = parsed?.result || parsed?.analysis || parsed?.content || parsed?.sources || parsed?.audit || content || '';
  const truncated = typeof displayText === 'string' && displayText.length > 500 ? displayText.slice(0, 500) + '...' : displayText;
  resultEl.innerHTML = `<div style="font-size:13px;color:rgba(0,0,0,0.6);line-height:1.7;max-height:300px;overflow:auto;padding:8px;background:rgba(0,0,0,0.02);border-radius:8px;">${_saRenderMarkdown(typeof truncated === 'string' ? truncated : JSON.stringify(truncated, null, 2))}</div>`;
}

function _saRenderTodos(todos) {
  const log = document.getElementById('super-agent-chat-log');
  if (!log) return;
  let existing = document.getElementById('sa-todos');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'sa-todos';
    existing.style.cssText = 'align-self:flex-start;max-width:85%;margin:4px 0;';
    log.appendChild(existing);
  }
  existing.innerHTML = `
    <div style="padding:12px 16px;border-radius:16px;background:rgba(0,122,255,0.05);border:1px solid rgba(0,122,255,0.12);">
      <div style="font-size:13px;font-weight:700;color:#007aff;margin-bottom:8px;">작업 계획</div>
      ${todos.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:${t.status === 'completed' || t.status === 'done' ? 'rgba(0,0,0,0.35)' : '#1c1c1e'};">
          <span>${t.status === 'completed' || t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◎' : '○'}</span>
          <span style="${t.status === 'completed' || t.status === 'done' ? 'text-decoration:line-through;' : ''}">${t.content || t.title || ''}</span>
        </div>
      `).join('')}
    </div>`;
  log.scrollTop = log.scrollHeight;
}

function _saRenderArtifacts(artifacts) {
  const log = document.getElementById('super-agent-chat-log');
  if (!log || !artifacts.length) return;
  const card = document.createElement('div');
  card.style.cssText = 'align-self:flex-start;max-width:85%;margin:4px 0;';
  card.innerHTML = `
    <div style="padding:12px 16px;border-radius:16px;background:rgba(52,199,89,0.05);border:1px solid rgba(52,199,89,0.12);">
      <div style="font-size:13px;font-weight:700;color:#34c759;margin-bottom:8px;">생성된 파일</div>
      ${artifacts.map(a => `<div style="font-size:12px;color:rgba(0,0,0,0.6);padding:2px 0;">📄 ${a}</div>`).join('')}
    </div>`;
  log.appendChild(card);
}

async function superAgentApplyPlan() {
  const plan = _superAgentPlan;
  if (!plan?.target_page) {
    superAgentStatus('먼저 해석을 실행해 추천 작업을 받아오세요.', 'error');
    return;
  }
  const targetPage = plan.target_page === 'browser-auto' && plan.target_mode === 'desktop'
    ? 'desktop-agent'
    : plan.target_page;
  await navigateToPage(targetPage);
  setTimeout(() => {
    if (targetPage === 'browser-auto') {
      if (plan.target_mode === 'browser') {
        const el = document.getElementById('live-agent-task');
        if (el) el.value = plan.prefill?.browser_task || plan.command || '';
      }
    } else if (targetPage === 'desktop-agent') {
      const el = document.getElementById('auto-desktop-ai-instruction');
      if (el) el.value = plan.prefill?.desktop_instruction || plan.command || '';
    } else if (plan.target_page === 'settings') {
      if (typeof switchUnifiedSettingsTab === 'function') switchUnifiedSettingsTab('general');
    } else if (plan.target_page === 'prompt-admin' && typeof paInit === 'function') {
      paInit();
    }
    toast(`${plan.action_label || '추천 작업'} 준비 완료`, 'success');
  }, 120);
}

async function autoSendKakaoMessage() {
  const roomsInput = document.getElementById('auto-kakao-rooms');
  const messageInput = document.getElementById('auto-kakao-message');
  const intervalInput = document.getElementById('auto-kakao-interval');
  const statusEl = document.getElementById('auto-kakao-status');
  const sendBtn = document.getElementById('auto-kakao-send-btn');

  const rooms = (roomsInput?.value || '')
    .split(',')
    .map(room => room.trim())
    .filter(Boolean);
  const message = (messageInput?.value || '').trim();
  const interval = Math.max(1, parseInt(intervalInput?.value || '3', 10) || 3);

  if (!rooms.length) {
    statusEl.innerHTML = '<div style="padding:12px 14px;border-radius:12px;background:rgba(255,59,48,0.08);color:#ff3b30;">발송할 카카오톡 방 이름을 한 개 이상 입력하세요.</div>';
    return;
  }
  if (!message) {
    statusEl.innerHTML = '<div style="padding:12px 14px;border-radius:12px;background:rgba(255,59,48,0.08);color:#ff3b30;">발송할 메시지를 입력하세요.</div>';
    return;
  }

  sendBtn.disabled = true;
  sendBtn.style.opacity = '0.6';
  sendBtn.textContent = '발송 중...';
  statusEl.innerHTML = '<div style="padding:12px 14px;border-radius:12px;background:rgba(0,122,255,0.08);color:#007aff;">카카오톡 자동 발송을 시작했습니다. 앱 전환과 권한 허용 창이 뜨면 먼저 확인해주세요.</div>';

  try {
    const result = await api('/api/automation/kakao/send', {
      method: 'POST',
      body: { rooms, message, interval }
    });
    const details = (result.results || [])
      .map(item => `<li><strong>${item.room}</strong>: ${item.success ? '성공' : (item.error || '실패')}</li>`)
      .join('');
    statusEl.innerHTML = `
      <div style="padding:12px 14px;border-radius:12px;background:${result.failed ? 'rgba(255,149,0,0.10)' : 'rgba(52,199,89,0.10)'};color:${result.failed ? '#ff9500' : '#34c759'};">
        <div style="font-weight:700;margin-bottom:6px;">발송 완료: ${result.success}/${result.total} 성공</div>
        ${details ? `<ul style="margin:0;padding-left:18px;color:rgba(0,0,0,0.6);">${details}</ul>` : ''}
      </div>`;
  } catch (error) {
    statusEl.innerHTML = `<div style="padding:12px 14px;border-radius:12px;background:rgba(255,59,48,0.08);color:#ff3b30;">발송 실패: ${error.message}</div>`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    sendBtn.textContent = '카카오톡 발송';
  }
}

// Dashboard
async function loadDashboard() {
  try {
    const [stats, posts] = await Promise.all([
      api('/api/stats'),
      api('/api/blog/posts?limit=5'),
    ]);
    document.getElementById('stat-total').textContent = stats.total_posts;
    document.getElementById('stat-published').textContent = stats.published;
    document.getElementById('stat-drafts').textContent = stats.drafts;
    document.getElementById('stat-today').textContent = stats.today_posts;

    const tbody = document.getElementById('dashboard-posts');
    tbody.innerHTML = posts.posts.map(p => `
      <tr onclick="viewPost(${p.id})" style="cursor:pointer">
        <td>${p.id}</td>
        <td>${p.keyword}</td>
        <td>${p.title ? p.title.substring(0, 40) : '-'}</td>
        <td>${p.char_count}</td>
        <td><span class="badge badge-${p.status}">${statusLabel(p.status)}</span></td>
        <td>${p.created_at || '-'}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

function statusLabel(s) {
  return { draft: '초안', published: '발행됨', failed: '실패' }[s] || s;
}

// Posts list
async function loadPosts() {
  try {
    const data = await api('/api/blog/posts?limit=50');
    const tbody = document.getElementById('posts-table');
    tbody.innerHTML = data.posts.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.keyword}</td>
        <td style="cursor:pointer;color:#5b9bf5" onclick="viewPost(${p.id})">${p.title ? p.title.substring(0, 45) : '-'}</td>
        <td>${p.char_count}</td>
        <td>${p.model_used || '-'}</td>
        <td><span class="badge badge-${p.status}">${statusLabel(p.status)}</span></td>
        <td>${p.created_at || '-'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-primary btn-sm" onclick="publishPost(${p.id})">${p.status==='published'?'재발행':'발행'}</button>
          <button class="btn btn-secondary btn-sm" onclick="goToVideoFromPost(${p.id}, '${(p.title||'').replace(/'/g,"\\'")}')">숏폼</button>
          <button class="btn btn-danger btn-sm" onclick="deletePost(${p.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    toast('글 목록 로딩 실패: ' + e.message, 'error');
  }
}

// Generate
async function generatePost() {
  const keyword = document.getElementById('gen-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }

  const btnGen = document.getElementById('btn-generate');
  btnGen.disabled = true;

  const progress = document.getElementById('gen-progress');
  const result = document.getElementById('gen-result');
  progress.classList.add('show');
  result.classList.remove('show');

  const steps = ['step-trend', 'step-source', 'step-write'];
  const fill = document.getElementById('gen-progress-fill');
  steps.forEach(s => { document.getElementById(s).className = 'progress-step'; document.getElementById(s).querySelector('.icon').textContent = '-'; });

  function setStep(idx) {
    if (idx > 0) {
      document.getElementById(steps[idx-1]).className = 'progress-step done';
      document.getElementById(steps[idx-1]).querySelector('.icon').textContent = '\u2713';
    }
    if (idx < steps.length) {
      document.getElementById(steps[idx]).className = 'progress-step active';
      document.getElementById(steps[idx]).querySelector('.icon').innerHTML = '<span class="spinner"></span>';
    }
    fill.style.width = ((idx + 1) / steps.length * 100) + '%';
  }

  setStep(0);
  const stepTimer1 = setTimeout(() => setStep(1), 3000);
  const stepTimer2 = setTimeout(() => setStep(2), 8000);

  try {
    const data = await api('/api/blog/generate', {
      method: 'POST',
      body: {
        keyword,
        tone: document.getElementById('gen-tone').value,
        length: document.getElementById('gen-length').value,
        business_name: document.getElementById('gen-business-name').value,
        business_type: document.getElementById('gen-business-type').value,
        auto_publish: false,
      },
    });

    clearTimeout(stepTimer1); clearTimeout(stepTimer2);
    steps.forEach((s, i) => setStep(i));
    setStep(3);

    lastPostId = data.post_id;
    const d = data.data;

    // 통계 표시
    document.getElementById('res-chars').textContent = d.char_count + '자';
    document.getElementById('res-density').textContent = d.keyword_density_pct + '%';
    document.getElementById('res-trend').textContent = d.trend_score + '/100';
    document.getElementById('res-sources').textContent = d.source_count + '건';

    // 전체 글 가져와서 편집 영역에 채우기
    const postData = await api(`/api/blog/posts/${data.post_id}`);
    const post = postData.post;
    document.getElementById('edit-title').value = post.title;
    // 본문: 마크다운 첫 줄(제목) 제거
    const lines = post.content.split('\n');
    const body = lines[0].startsWith('#') ? lines.slice(1).join('\n').trim() : post.content;
    document.getElementById('edit-content').value = body;
    // 태그: 입력한 태그 or 키워드 기반 자동
    const genTags = document.getElementById('gen-tags').value;
    document.getElementById('edit-tags').value = genTags || keyword;

    result.classList.add('show');
    toast('글이 생성되었습니다! 수정 후 발행하세요.');

    // 편집 영역으로 스크롤
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    clearTimeout(stepTimer1); clearTimeout(stepTimer2);
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    btnGen.disabled = false;
  }
}

// 수정 저장 (발행 안함)
async function saveEdited() {
  if (!lastPostId) return;
  const title = document.getElementById('edit-title').value;
  const content = document.getElementById('edit-content').value;
  // TODO: API에 수정 엔드포인트 추가 시 연동
  toast('수정 내용이 저장되었습니다.');
}

// 수정 후 발행
async function publishEdited() {
  if (!guardInstagramOnlyUpload('blog')) return;
  const blogId = getBlogId();
  if (!blogId) {
    toast('상단에 네이버 블로그 주소를 먼저 입력하세요!', 'error');
    /* blog url은 설정에서 관리 */
    return;
  }
  const title = document.getElementById('edit-title').value.trim();
  const content = document.getElementById('edit-content').value.trim();
  const tagStr = document.getElementById('edit-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!title || !content) { toast('제목과 본문을 입력하세요', 'error'); return; }
  if (!confirm(`네이버 블로그(${blogId})에 발행할까요?\n\n제목: ${title}\n태그: ${tags.join(', ')}`)) return;

  try {
    await api('/api/blog/publish', {
      method: 'POST',
      body: { post_id: lastPostId, title, content, tags },
    });
    toast('네이버 블로그에 발행 완료!');
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

// Publish
async function publishPost(postId, customTags) {
  if (!guardInstagramOnlyUpload('blog')) return;
  // 설정에서 blog_id 가져오기 (여러 소스)
  let blogId = getBlogId();
  if (!blogId) {
    try {
      const config = await api('/api/config');
      blogId = config?.NAVER?.blog_id || '';
      if (blogId) window._blogId = blogId;
    } catch {}
  }
  if (!blogId) {
    toast('설정에서 네이버 블로그 ID를 먼저 입력하세요!', 'error');
    return;
  }

  let tags = customTags || [];
  if (!confirm(`게시물 #${postId}를 네이버 블로그(${blogId})에 발행할까요?`)) return;

  toast('네이버 블로그 발행 중...');
  try {
    await api('/api/blog/publish', { method: 'POST', body: { post_id: postId, tags } });
    toast('발행 완료!');
    loadPosts();
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

function publishResult() {
  publishEdited();
}

// Delete
async function deletePost(postId) {
  if (!confirm(`게시물 #${postId}를 삭제할까요?`)) return;
  try {
    await api(`/api/blog/posts/${postId}`, { method: 'DELETE' });
    toast('삭제 완료!');
    loadPosts();
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

// View post modal
let _modalIsEditing = false;

async function viewPost(postId) {
  try {
    const data = await api(`/api/blog/posts/${postId}`);
    const p = data.post;
    modalPostId = postId;
    document.getElementById('modal-title').textContent = p.title;
    document.getElementById('modal-status').className = 'badge badge-' + p.status;
    document.getElementById('modal-status').textContent = statusLabel(p.status);
    document.getElementById('modal-meta').textContent = `${p.char_count}자 | ${p.model_used} | ${p.created_at}`;
    document.getElementById('modal-content').textContent = p.content;
    document.getElementById('modal-publish-btn').disabled = false;
    document.getElementById('modal-publish-btn').textContent = p.status === 'published' ? '다시 발행' : '네이버에 발행';

    // 편집 필드 초기화
    document.getElementById('modal-edit-title').value = p.title;
    document.getElementById('modal-edit-content').value = p.content;
    document.getElementById('modal-edit-chars').textContent = p.content.length;

    // 읽기 모드로 초기화
    _modalIsEditing = false;
    document.getElementById('modal-view-mode').style.display = 'block';
    document.getElementById('modal-edit-mode').style.display = 'none';
    document.getElementById('modal-save-btn').style.display = 'none';
    document.getElementById('modal-edit-toggle').textContent = '편집';

    document.getElementById('postModal').classList.add('show');
  } catch (e) {
    toast('글 조회 실패: ' + e.message, 'error');
  }
}

function togglePostEdit() {
  _modalIsEditing = !_modalIsEditing;
  document.getElementById('modal-view-mode').style.display = _modalIsEditing ? 'none' : 'block';
  document.getElementById('modal-edit-mode').style.display = _modalIsEditing ? 'block' : 'none';
  document.getElementById('modal-save-btn').style.display = _modalIsEditing ? 'inline-flex' : 'none';
  document.getElementById('modal-edit-toggle').textContent = _modalIsEditing ? '취소' : '편집';
}

async function savePostEdit() {
  if (!modalPostId) return;
  const title = document.getElementById('modal-edit-title').value.trim();
  const content = document.getElementById('modal-edit-content').value.trim();
  if (!title || !content) { toast('제목과 본문을 입력하세요', 'error'); return; }

  const btn = document.getElementById('modal-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 저장 중...';

  try {
    await api(`/api/blog/posts/${modalPostId}`, {
      method: 'PUT',
      body: { title, content },
    });
    toast('글이 저장되었습니다.');
    // 읽기 모드로 전환 + 화면 갱신
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').textContent = content;
    document.getElementById('modal-meta').textContent = document.getElementById('modal-meta').textContent.replace(/\d+자/, content.length + '자');
    togglePostEdit();
    loadPosts();
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '저장';
  }
}

// 편집 시 글자수 업데이트
document.addEventListener('input', function(e) {
  if (e.target.id === 'modal-edit-content') {
    document.getElementById('modal-edit-chars').textContent = e.target.value.length;
  }
});

function closeModal() {
  document.getElementById('postModal').classList.remove('show');
  _modalIsEditing = false;
}
function publishFromModal() {
  if (!modalPostId) return;
  const tagStr = document.getElementById('modal-publish-tags').value.trim();
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];
  closeModal();
  publishPost(modalPostId, tags);
}
function deleteFromModal() { if (modalPostId) { closeModal(); deletePost(modalPostId); loadPosts(); } }
document.getElementById('postModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

function isVisibleEscModal(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.position === 'fixed';
}

function closeModalElementByEsc(el) {
  if (!el) return false;
  const closeHandlers = {
    postModal: () => closeModal(),
    libEditModal: () => libCloseEditModal(),
    'gallery-detail-modal': () => closeGalleryDetail(),
    'style-create-modal': () => closeStyleCreateModal(),
    'global-opts-modal': () => closeGlobalOptsModal(),
    'proj-detail-card': () => closeProjectDetailModal(),
    'profile-picker-modal': () => document.getElementById('profile-picker-modal')?.remove(),
    'platform-upload-modal': () => document.getElementById('platform-upload-modal')?.remove(),
    'yt-bgm-modal': () => document.getElementById('yt-bgm-modal')?.remove(),
    imagePreviewModal: () => {
      const modal = document.getElementById('imagePreviewModal');
      if (modal) modal.style.display = 'none';
    },
  };

  if (closeHandlers[el.id]) {
    closeHandlers[el.id]();
    return true;
  }

  const closeBtn = el.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.click();
    return true;
  }

  if (el.classList.contains('modal-overlay')) {
    el.classList.remove('show');
    el.style.display = 'none';
    return true;
  }

  if (el.id && el.id.includes('modal')) {
    if (el.parentNode && !['scenario-edit-modal', 'proj-new-modal', 'cv-image-picker-modal', 'cv-blog-picker-modal', 'cv-cn-picker-modal'].includes(el.id)) {
      el.remove();
      return true;
    }
    el.style.display = 'none';
    return true;
  }
  return false;
}

function closeTopEscModal() {
  const modalCandidates = Array.from(document.querySelectorAll([
    '.modal-overlay',
    '[id$="-modal"]',
    '[id*="modal"]',
    '.modal-backdrop',
    '#proj-detail-card',
    '#imagePreviewModal'
  ].join(','))).filter(isVisibleEscModal);

  if (!modalCandidates.length) return false;

  modalCandidates.sort((a, b) => {
    const az = parseInt(window.getComputedStyle(a).zIndex || '0', 10);
    const bz = parseInt(window.getComputedStyle(b).zIndex || '0', 10);
    return bz - az;
  });

  return closeModalElementByEsc(modalCandidates[0]);
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (closeTopEscModal()) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// Trend
async function analyzeTrend() {
  const keyword = document.getElementById('trend-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }

  document.getElementById('btn-trend').disabled = true;
  document.getElementById('btn-trend').innerHTML = '<span class="spinner"></span> 분석 중...';

  try {
    const res = await api('/api/trend/analyze', { method: 'POST', body: { keyword } });
    const d = res.data;
    const box = document.getElementById('trend-result');
    box.innerHTML = `
      <h3>${keyword} 트렌드 분석</h3>
      <div class="result-item"><span class="rl">트렌드 점수</span><span>${d.trend_score}/100</span></div>
      <div class="result-item"><span class="rl">뉴스 건수</span><span>${d.news_count}건</span></div>
      <div class="result-item"><span class="rl">경쟁도</span><span>${d.competition}</span></div>
      <div style="margin-top:12px">
        <div class="rl" style="margin-bottom:8px">연관 키워드</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(d.related_keywords || []).slice(0, 15).map(k => `<span style="background:#1e3a52;padding:4px 10px;border-radius:12px;font-size:12px">${k}</span>`).join('')}
        </div>
      </div>
      ${d.top_news && d.top_news.length ? `
        <div style="margin-top:16px">
          <div class="rl" style="margin-bottom:8px">최신 뉴스</div>
          ${d.top_news.slice(0, 5).map(n => `<div style="padding:6px 0;border-bottom:1px solid #1e3a52;font-size:13px">[${n.source}] ${n.title}</div>`).join('')}
        </div>
      ` : ''}
    `;
    box.classList.add('show');
  } catch (e) {
    toast('분석 실패: ' + e.message, 'error');
  } finally {
    document.getElementById('btn-trend').disabled = false;
    document.getElementById('btn-trend').textContent = '분석하기';
  }
}

// Settings
// 🔑 디자인 코딩 에이전트 — 로그인 다이얼로그
async function cdCheckLoginStatus() {
  try {
    const cfg = await api('/api/config');
    const atlasOk = !!(cfg?.API?.atlas_key);
    const geminiOk = !!(cfg?.API?.gemini_api_key);
    const status = document.getElementById('cd-login-status');
    if (status) {
      const lines = [];
      lines.push(atlasOk ? '✅ Atlas Cloud 키 등록됨' : '❌ Atlas Cloud 키 없음 — GPT/Claude/Kimi/DeepSeek/Qwen 사용 불가');
      lines.push(geminiOk ? '✅ Google Gemini 키 등록됨' : '❌ Gemini 키 없음 — 이미지 생성·번역 불가');
      status.innerHTML = lines.join('<br>');
    }
    // 둘 다 없으면 자동 오픈 (디자인 코딩 에이전트 진입 시)
    if (!atlasOk && !geminiOk) {
      cdOpenLoginDialog();
    }
  } catch (e) {}
}
window.cdCheckLoginStatus = cdCheckLoginStatus;

async function cdOpenLoginDialog() {
  const m = document.getElementById('cd-login-modal');
  if (!m) return;
  m.style.display = 'flex';
  // 현재 키 로드 (마스킹 표시)
  try {
    const cfg = await api('/api/config');
    const a = document.getElementById('cd-login-atlas');
    const g = document.getElementById('cd-login-gemini');
    if (a && cfg?.API?.atlas_key) a.placeholder = '••••••• (저장됨, 변경 시 새 키 입력)';
    if (g && cfg?.API?.gemini_api_key) g.placeholder = '••••••• (저장됨, 변경 시 새 키 입력)';
  } catch (e) {}
  cdCheckLoginStatus();
}
window.cdOpenLoginDialog = cdOpenLoginDialog;

function cdCloseLoginDialog() {
  const m = document.getElementById('cd-login-modal');
  if (m) m.style.display = 'none';
}
window.cdCloseLoginDialog = cdCloseLoginDialog;

async function cdSaveLogin() {
  const atlasVal = (document.getElementById('cd-login-atlas')?.value || '').trim();
  const geminiVal = (document.getElementById('cd-login-gemini')?.value || '').trim();
  if (!atlasVal && !geminiVal) {
    if (typeof toast === 'function') toast('하나 이상의 키를 입력하세요', 'warning');
    return;
  }
  try {
    const updates = {};
    if (atlasVal) updates['API.atlas_key'] = atlasVal;
    if (geminiVal) updates['API.gemini_api_key'] = geminiVal;
    // 기존 settings 저장 API 사용
    for (const [k, v] of Object.entries(updates)) {
      await api('/api/settings', { method: 'POST', body: { key: k, value: v } });
    }
    if (typeof toast === 'function') toast('✓ 로그인 정보 저장됨');
    // 입력 비우기
    document.getElementById('cd-login-atlas').value = '';
    document.getElementById('cd-login-gemini').value = '';
    cdCheckLoginStatus();
    setTimeout(() => cdCloseLoginDialog(), 800);
  } catch (e) {
    if (typeof toast === 'function') toast(`저장 실패: ${e?.message || e}`, 'error');
  }
}
window.cdSaveLogin = cdSaveLogin;

async function saveApiSettingValue(inputId, settingKey, emptyMessage, successMessage) {
  const value = (document.getElementById(inputId)?.value || '').trim();
  if (!value) {
    if (typeof toast === 'function') toast(emptyMessage, 'warning');
    return false;
  }
  await api('/api/settings', { method: 'POST', body: { key: settingKey, value } });
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    input.placeholder = '새 키를 붙여넣으면 기존 키를 변경 저장합니다';
    input.dataset.original = 'saved';
  }
  updateApiKeyStatus(inputId, true);
  if (typeof toast === 'function') toast(successMessage);
  return true;
}

function setApiSaveButtonText(inputId, hasKey) {
  const buttonId = inputId === 'set-atlas-key' ? 'set-atlas-save-btn' : 'set-gemini-save-btn';
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const label = inputId === 'set-atlas-key' ? (hasKey ? 'Atlas 키 변경 저장' : 'Atlas 키 저장') : (hasKey ? '키 변경 저장' : '키 저장');
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>';
  btn.innerHTML = icon + label;
}

function updateApiKeyStatus(inputId, hasKey) {
  const statusId = inputId === 'set-atlas-key' ? 'set-atlas-key-status' : 'set-gemini-key-status';
  const status = document.getElementById(statusId);
  if (status) {
    status.textContent = hasKey ? '저장된 키 사용 중 · 변경하려면 새 키를 붙여넣고 변경 저장을 누르세요' : '저장된 키 없음 · 새 키를 붙여넣고 저장하세요';
    status.style.color = hasKey ? '#34c759' : 'rgba(0,0,0,0.42)';
  }
  setApiSaveButtonText(inputId, hasKey);
}

async function saveGeminiSettings() {
  try {
    await saveApiSettingValue('set-gemini-key', 'API.gemini_api_key', 'Gemini API 키를 입력하세요', 'Gemini API 키를 저장했습니다');
  } catch (e) {
    if (typeof toast === 'function') toast('Gemini 키 저장 실패: ' + (e?.message || e), 'error');
  }
}
window.saveGeminiSettings = saveGeminiSettings;

async function saveAtlasKey() {
  try {
    await saveApiSettingValue('set-atlas-key', 'API.atlas_key', 'Atlas Cloud API 키를 입력하세요', 'Atlas Cloud API 키를 저장했습니다');
  } catch (e) {
    if (typeof toast === 'function') toast('Atlas 키 저장 실패: ' + (e?.message || e), 'error');
  }
}
window.saveAtlasKey = saveAtlasKey;

async function verifyGeminiKey() {
  const btn = document.getElementById('verify-gemini-btn');
  const original = btn ? btn.textContent : '';
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '검증 중...';
    }
    const res = await api('/api/library/verify-gemini', { method: 'POST', body: { api_key: (document.getElementById('set-gemini-key')?.value || '').trim() } });
    if (typeof toast === 'function') toast(res?.ok === false ? 'Gemini 키 확인이 필요합니다' : 'Gemini 키가 확인되었습니다', res?.ok === false ? 'warning' : 'success');
  } catch (e) {
    if (typeof toast === 'function') toast('Gemini 키 검증 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original || '키 검증';
    }
  }
}
window.verifyGeminiKey = verifyGeminiKey;

async function loadSettings() {
  try {
    const config = await api('/api/config');
    const setFieldValue = (id, value, original = null) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value ?? '';
      if (original !== null) el.dataset.original = original ?? '';
    };
    const setSecretFieldState = (id, maskedValue, emptyPlaceholder) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (maskedValue) {
        el.value = '';
        el.dataset.original = maskedValue;
        el.placeholder = '새 키를 붙여넣으면 기존 키를 변경 저장합니다';
        updateApiKeyStatus(id, true);
      } else {
        el.value = '';
        el.dataset.original = '';
        el.placeholder = emptyPlaceholder;
        updateApiKeyStatus(id, false);
      }
    };
    if (config.API) {
      const oKey = config.API.openai_api_key || '';
      setFieldValue('set-api-key', oKey, oKey);
      setFieldValue('set-model', config.API.openai_model || 'gpt-4o-mini');
      setSecretFieldState('set-gemini-key', config.API.gemini_api_key || '', 'AIza...');
      setSecretFieldState('set-atlas-key', config.API.atlas_key || '', 'ak-...');
      setFieldValue('set-gemini-model', config.API.gemini_image_model || '');
    }
    // AI 모델 설정 로드
    if (config.MODELS) {
      const m = config.MODELS;
      const setModel = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      const normalizeProvider = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return 'cli';
        if (raw === 'cli' || raw === 'codex' || raw === 'kimi' || raw.startsWith('cli:') || raw.endsWith('-cli') || raw.includes('codex cli') || raw.includes('kimi cli')) return 'cli';
        if (raw === 'gemini' || raw === 'google' || raw === 'google-gemini' || raw.includes('gemini') || raw.includes('imagen')) return 'gemini';
        if (raw === 'atlas' || raw === 'atlascloud' || raw === 'atlas-cloud' || raw.includes('atlas') || raw.startsWith('openai/') || raw.startsWith('anthropic/') || raw.startsWith('deepseek') || raw.startsWith('moonshot') || raw.startsWith('qwen/') || raw.startsWith('alibaba/') || raw.startsWith('baidu/')) return 'atlas';
        return 'cli';
      };
      const setProvider = (id, val, fallback = 'cli') => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const normalized = normalizeProvider(val || fallback);
        const hasOption = Array.from(el.options || []).some(option => option.value === normalized);
        el.value = hasOption ? normalized : fallback;
        return el.value || fallback;
      };
      setProvider('set-text-provider', m.text_provider, 'cli');
      setModel('set-text-model', m.text_model);
      setProvider('set-image-provider', m.image_provider, 'cli');
      setModel('set-image-model', m.image_model);
      setModel('set-tts-model', m.tts_model);
      window._contentOpts.text_provider = normalizeProvider(m.text_provider || window._contentOpts.text_provider);
      window._contentOpts.text_model = m.text_model || window._contentOpts.text_model;
      window._contentOpts.image_provider = normalizeProvider(m.image_provider || window._contentOpts.image_provider);
      window._contentOpts.image_model = m.image_model || window._contentOpts.image_model;
      if (typeof syncModelCategoryOptions === 'function') syncModelCategoryOptions(m);
    }
    try {
      if (typeof refreshCodexCliStatus === 'function') refreshCodexCliStatus();
    } catch (_) {}
    // 네이버 API 키 로드
    if (config.NAVER_API) {
      setFieldValue('set-naver-client-id', config.NAVER_API.client_id || '');
      setFieldValue('set-naver-client-secret', config.NAVER_API.client_secret || '');
      setFieldValue('set-naver-ad-license', config.NAVER_API.ad_api_license || '');
      setFieldValue('set-naver-ad-secret', config.NAVER_API.ad_api_secret || '');
      setFieldValue('set-naver-ad-customer', config.NAVER_API.ad_customer_id || '');
    }
    if (config.NAVER) {
      setFieldValue('set-blog-id', config.NAVER.blog_id || '');
      // 자동 업로드 설정 로드
      const sn = id => document.getElementById(id);
      if (sn('set-naver-blog-id')) sn('set-naver-blog-id').value = config.NAVER.blog_id || '';
      if (sn('set-naver-id')) sn('set-naver-id').value = config.NAVER.naver_id || '';
      if (sn('set-naver-pw')) sn('set-naver-pw').value = config.NAVER.naver_pw || '';
    }
    if (config.INSTAGRAM) {
      const sn = id => document.getElementById(id);
      if (sn('set-ig-id')) sn('set-ig-id').value = config.INSTAGRAM?.id || '';
      if (sn('set-ig-pw')) sn('set-ig-pw').value = config.INSTAGRAM?.pw || '';
    }
    if (config.TWITTER) {
      const sn = id => document.getElementById(id);
      if (sn('set-twitter-id')) sn('set-twitter-id').value = config.TWITTER?.id || '';
      if (sn('set-twitter-pw')) sn('set-twitter-pw').value = config.TWITTER?.pw || '';
    }
    if (config.BLOG_SETTINGS) {
      setFieldValue('set-blog-category', config.BLOG_SETTINGS.category || '');
    }
    if (config.SUNO) {
      setFieldValue('set-suno-cookie', config.SUNO.cookie ? '••••••••' : '');
    }
  } catch (e) { console.error('[loadSettings] 에러:', e); }
}

async function saveAutoUploadSettings() {
  try {
    const updates = [
      { section: 'NAVER', key: 'blog_id', value: document.getElementById('set-naver-blog-id')?.value?.trim() || '' },
      { section: 'NAVER', key: 'naver_id', value: document.getElementById('set-naver-id')?.value?.trim() || '' },
      { section: 'NAVER', key: 'naver_pw', value: document.getElementById('set-naver-pw')?.value?.trim() || '' },
      { section: 'INSTAGRAM', key: 'id', value: document.getElementById('set-ig-id')?.value?.trim() || '' },
      { section: 'INSTAGRAM', key: 'pw', value: document.getElementById('set-ig-pw')?.value?.trim() || '' },
      { section: 'TWITTER', key: 'id', value: document.getElementById('set-twitter-id')?.value?.trim() || '' },
      { section: 'TWITTER', key: 'pw', value: document.getElementById('set-twitter-pw')?.value?.trim() || '' },
    ];
    for (const u of updates) {
      await api('/api/config/update', { method: 'POST', body: u });
    }
    // 상단 바 blog_id도 동기화
    const blogId = document.getElementById('set-naver-blog-id')?.value?.trim();
    if (blogId) {
      document.getElementById('global-blog-url').value = blogId;
      document.getElementById('set-blog-id').value = blogId;
    }
    toast('자동 업로드 설정 저장 완료!');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

async function saveNaverBlogId() {
  const blogId = document.getElementById('set-blog-id').value.trim();
  if (blogId) {
    // 상단 바와 동기화
    document.getElementById('global-blog-url').value = blogId;
    saveBlogUrl();
  }
}

async function saveNaverSettings() {
  try {
    const blogId = document.getElementById('set-blog-id').value.trim();
    const category = document.getElementById('set-blog-category').value.trim();
    if (blogId) {
      await api('/api/config/update', { method: 'POST', body: { section: 'NAVER', key: 'blog_id', value: blogId } });
      document.getElementById('global-blog-url').value = blogId;
      window._blogId = blogId;
    }
    if (category !== undefined) {
      await api('/api/config/update', { method: 'POST', body: { section: 'BLOG_SETTINGS', key: 'category', value: category } });
    }
    toast(`네이버 설정 저장 완료! (ID: ${blogId || '미설정'}, 카테고리: ${category || '미설정'})`);
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

async function saveApiSettings() {
  try {
    const el = document.getElementById('set-api-key');
    const key = el.value.trim();
    const original = el.dataset.original || '';
    const model = document.getElementById('set-model').value;
    // 키가 변경됐고 비어있지 않을 때만 저장
    if (key && key !== original && key.length > 10) {
      await api('/api/config/update', { method: 'POST', body: { section: 'API', key: 'openai_api_key', value: key } });
      el.dataset.original = key;
      toast('OpenAI API 키 저장 완료!');
    }
    await api('/api/config/update', { method: 'POST', body: { section: 'API', key: 'openai_model', value: model } });
    toast('모델 설정 저장 완료!');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

async function saveNaverSettings() {
  try {
    const blogId = document.getElementById('set-blog-id').value;
    await api('/api/config/update', { method: 'POST', body: { section: 'NAVER', key: 'blog_id', value: blogId } });
    toast('네이버 설정 저장 완료!');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────
// 콘텐츠 프롬프트 관리 (Prompt Admin) — prefix: pa
// ─────────────────────────────────────────────────────────
const PA_CATEGORIES = {
  blog: {
    label: '블로그', icon: '📝',
    items: [
      { key: 'system_prompt', label: '시스템 프롬프트', desc: 'AI 역할, 규칙, 톤, 금지사항', where: '블로그 생성 시 AI 역할 지시', tip: '여기를 바꾸면 블로그 글의 전체 톤과 규칙이 바뀝니다' },
      { key: 'title_rules', label: '제목 규칙', desc: '블로그 제목 작성 규칙', where: '블로그 제목 구조 보정', tip: '제목 톤, 길이, 키워드 반영 기준' },
      { key: 'forbidden_rules', label: '금지 규칙', desc: '블로그에서 피할 표현과 형식', where: '블로그 생성 공통 금지사항', tip: '마크다운, URL, 과장 표현 같은 금지 기준' },
      { key: 'human_style', label: '자연스러움 규칙', desc: '사람처럼 쓰기 위한 보정 규칙', where: '블로그 문장 리듬 보정', tip: '쉼표, 마침표, 문장 길이 변화 기준' },
      { key: 'seo_rules', label: 'SEO 규칙', desc: '검색 최적화 규칙', where: '블로그 SEO 강화', tip: '키워드 배치와 소제목 구조 기준' },
      { key: 'start_rules', label: '시작 규칙', desc: '첫 문단 시작 방식', where: '블로그 첫 문장/도입부', tip: '질문형이 아닌 팩트형 시작 규칙' },
      { key: 'user_prompt', label: '유저 프롬프트', desc: '키워드, 참고자료, 생성 지시', where: '참고자료와 함께 AI에게 전달', tip: '{keyword}, {source_text} 등 변수가 실제 값으로 바뀝니다' },
      { key: 'business_bridge', label: '브랜드 연결 규칙', desc: '브랜드 정보 연결 기준', where: '브랜드/업종 문맥 반영 시', tip: '정보 전달을 해치지 않는 최소 연결 규칙' },
    ]
  },
  cardnews: {
    label: '카드뉴스', icon: '🖼️',
    items: [
      { key: 'text_prompt', label: '카드뉴스 프롬프트', desc: '카드뉴스 텍스트+이미지 생성 규칙', where: '카드뉴스 생성 시', tip: '{topic}=주제, {slide_count}=장수' },
      { key: 'image_prompt', label: '카드뉴스 이미지 프롬프트', desc: '슬라이드 이미지 디자인 기본값', where: '카드뉴스 각 슬라이드 이미지 생성 시', tip: '한 장의 정보 밀도, 안전 여백, 텍스트 길이 기준' },
    ]
  },
  sns: {
    label: 'SNS', icon: '💬',
    items: [
      { key: 'common_rules', label: 'SNS 공통 프롬프트', desc: '공통 금지사항과 출력 형식', where: 'SNS 글 생성 시', tip: '플랫폼 공통 규칙과 전체 출력 구조' },
      { key: 'threads_rules', label: '스레드 프롬프트', desc: 'Threads 전용 생성 규칙', where: '스레드 생성 시', tip: '길이, 이어쓰기, 말투' },
      { key: 'twitter_rules', label: '트위터 프롬프트', desc: 'Twitter(X) 전용 생성 규칙', where: '트위터 생성 시', tip: '글자 수, 압축 강도, 문장 밀도' },
      { key: 'instagram_rules', label: '인스타 캡션 규칙', desc: '인스타그램 캡션 구조 기본값', where: '인스타 캡션 구성 시', tip: '제목/본문/해시태그 구조 기준' },
    ]
  },
  summary: {
    label: '핵심자료 요약', icon: '📚',
    items: [
      { key: 'system_prompt', label: '요약 시스템 프롬프트', desc: '원문 요약 기본 역할', where: '핵심자료 요약 시', tip: '원문 보존, 요약 강도, 한국어 출력 기준' },
      { key: 'user_prompt', label: '요약 유저 프롬프트', desc: '원문 요약 입력 템플릿', where: '기사/자료 요약 시', tip: '{keyword}, {source_blob} 변수를 사용합니다' },
      { key: 'google_search', label: '웹검색 보강 프롬프트', desc: '웹 검색 보강 요약 규칙', where: '웹 검색 보강 사용 시', tip: '기존 내용 반복 없이 추가 팩트만 보강' },
      { key: 'force_korean', label: '한국어 강제 규칙', desc: '외국어 자료 한국어 변환 규칙', where: '한국어 재정리 시', tip: '고유명사만 병기하고 한국어 중심으로 정리' },
    ]
  },
  youtube_summary: {
    label: '유튜브 요약', icon: '▶️',
    items: [
      { key: 'system_prompt', label: '유튜브 요약 시스템', desc: '유튜브 자막 요약 역할', where: '영상 요약 시', tip: '원문 빠짐없이 정리하는 기본 역할' },
      { key: 'user_prompt', label: '유튜브 요약 유저', desc: '유튜브 자막 요약 템플릿', where: '유튜브 요약 입력 시', tip: '{title}, {channel}, {transcript} 변수를 사용합니다' },
    ]
  },
  video: {
    label: '영상', icon: '🎬',
    items: [
      { key: 'prompt_bundle', label: '영상 프롬프트', desc: '영상 장면 스크립트 생성 규칙', where: '영상 생성 시', tip: '{장면수}, {원문} 기준으로 장면 구성과 자막 흐름을 정합니다' },
    ]
  },
  comic: {
    label: '만화', icon: '🎨',
    items: [
      { key: 'script_prompt', label: '만화 프롬프트', desc: '스토리 만화 스크립트 규칙', where: '만화 생성 시', tip: '컷 구성, 대사, 스타일' },
    ]
  },
  blog_image: {
    label: '블로그 이미지', icon: '🖼️',
    items: [
      { key: 'design_rules', label: '디자인 규칙', desc: '블로그 이미지 디자인 방향', where: '블로그 이미지 생성 시', tip: '색감, 레이아웃, 표현 방식' },
      { key: 'prompt_template', label: '이미지 프롬프트', desc: '블로그 이미지 생성 템플릿', where: '섹션별 이미지 프롬프트 생성 시', tip: '{keyword}, {source_context}, {body} 변수 사용' },
    ]
  },
  detail_page: {
    label: '상세페이지', icon: '📄',
    items: [
      { key: 'section_template', label: '상세페이지 프롬프트', desc: '블로그 내용을 상세페이지 이미지로 바꾸는 단일 프롬프트', where: '상세페이지 각 섹션 이미지 생성 시', tip: '{cover_instruction}, {title}, {body}, {source_summary}가 실제 값으로 바뀝니다' },
    ]
  },
};

const PA_VARIABLES = [
  { key: '키워드', label: '키워드', desc: '검색/생성 키워드', example: '인공지능 트렌드' },
  { key: '브랜드명', label: '브랜드명', desc: '프로필에 설정한 업체/브랜드명', example: '옥토ai' },
  { key: '업종', label: '업종', desc: '프로필에 설정한 업종', example: 'IT/솔루션' },
  { key: '콘텐츠목적', label: '콘텐츠 목적', desc: '프로필에 설정한 콘텐츠 목적', example: '블로그로 상담 문의 늘리기' },
  { key: '블로그스타일', label: '블로그 스타일', desc: '블로그 문체 분석 결과 (블로그 생성에 사용)', example: '친근하고 솔직하며...' },
  { key: '스레드스타일', label: '스레드 스타일', desc: '스레드 문체 분석 결과', example: '수다스럽고 격의 없이...' },
  { key: '글길이', label: '글 길이', desc: '프로필에서 설정한 글 길이', example: '길게 (3000자+)' },
  { key: '쉼표비율', label: '쉼표 비율', desc: '프로필에서 설정한 쉼표 빈도', example: '30' },
  { key: '마침표비율', label: '마침표 비율', desc: '프로필에서 설정한 마침표 빈도', example: '70' },
  { key: '자연스러움', label: '자연스러움', desc: '사람처럼 쓰기 수준', example: '많이' },
  { key: '참고자료', label: '참고자료', desc: '2단계에서 수집한 뉴스/블로그 본문', example: '[뉴스 기사 전문...]' },
  { key: '문체지시', label: '문체 지시', desc: '프로필의 writing_style 분석 결과', example: '[문체: 전문적, 문장 길이: 중간...]' },
  { key: '브랜드정보', label: '브랜드 정보', desc: '브랜드 설명+연락처+업종 통합', example: '옥토ai / IT솔루션' },
  { key: '주제', label: '주제', desc: '카드뉴스/영상/만화 생성 주제', example: 'AI 코딩 도구의 미래' },
  { key: '장수', label: '장수', desc: '카드뉴스 슬라이드 수', example: '5' },
  { key: '카드뉴스스타일', label: '카드뉴스 스타일', desc: '카드뉴스 톤/디자인 방향', example: '전문적이고 정보 전달 중심의 카드뉴스' },
  { key: '브랜드맥락', label: '브랜드 맥락', desc: '업종, 브랜드 설명, 목적 같은 배경 정보', example: '업종: IT/솔루션\\n브랜드명: 옥토ai' },
  { key: '제목', label: '제목', desc: '각 슬라이드/섹션의 제목', example: 'AI가 바꾸는 업무 환경' },
  { key: '본문', label: '본문', desc: '각 슬라이드/섹션의 본문', example: '최근 조사에 따르면...' },
  { key: '컷수', label: '만화 컷수', desc: '만화 컷 수', example: '4' },
  { key: '만화스타일', label: '만화 스타일', desc: '선택한 만화 스타일 설명', example: '귀여운 SD 캐릭터, 밝은 색감, 동글동글한 그림체' },
  { key: '참고자료', label: '참고자료', desc: '참고자료 블록', example: '[참고자료] 기사 본문...' },
  { key: '업체명', label: '업체명', desc: '브랜드/업체명', example: '옥토ai' },
  { key: 'cover_instruction', label: '표지 안내', desc: '표지/본문 섹션 여부 안내', example: '이것은 표지입니다. 임팩트 있게 만들어주세요.' },
  { key: 'source_summary', label: '소스 요약', desc: '상세페이지 전체 구성에 참고할 원문 요약', example: '핵심 서비스 설명과 장점 요약...' },
  { key: '장면수', label: '장면 수', desc: '영상에서 만들 장면 개수', example: '5' },
  { key: '원문', label: '원문', desc: '영상 스크립트로 바꿀 블로그 본문/요약 원문', example: 'AI 도입으로 반복 업무가 줄고...' },
];

const PA_PRESETS = [
  { key: 'informative', label: '정보전달형', icon: '📚', color: '#007aff', desc: '정확한 사실 전달', group: 'tone' },
  { key: 'marketing', label: '마케팅형', icon: '🚀', color: '#ff8c00', desc: '전환 유도', group: 'tone' },
  { key: 'review', label: '리뷰형', icon: '⭐', color: '#ff9500', desc: '체험 후기', group: 'tone' },
  { key: 'news', label: '뉴스형', icon: '📰', color: '#5856d6', desc: '객관 보도', group: 'tone' },
  { key: 'conversational', label: '대화형', icon: '💬', color: '#34c759', desc: '친근한 톤', group: 'tone' },
];

// 업종별 비즈니스 목적 프리셋 (프로필 업종에 따라 자동 변경)
const PA_BIZ_PRESETS = {
  _default: [
    { key: 'expert', label: '전문 칼럼', icon: '🎓', color: '#5856d6', desc: '전문 지식 전달' },
    { key: 'case', label: '사례 소개', icon: '📋', color: '#007aff', desc: '성공 사례/후기' },
    { key: 'howto', label: '가이드형', icon: '📖', color: '#34c759', desc: '방법/절차 안내' },
    { key: 'event', label: '이벤트', icon: '🎉', color: '#ff3b30', desc: '할인/프로모션' },
    { key: 'faq', label: 'FAQ', icon: '❓', color: '#ff9500', desc: '자주 묻는 질문' },
    { key: 'trend', label: '트렌드', icon: '📈', color: '#007aff', desc: '업계 동향 분석' },
  ],
  '성형외과': [
    { key: 'procedure', label: '시술 안내', icon: '💉', color: '#e1306c', desc: '시술 종류/과정' },
    { key: 'beforeafter', label: '전후 비교', icon: '✨', color: '#ff6b00', desc: 'Before & After' },
    { key: 'expert', label: '전문 칼럼', icon: '🩺', color: '#5856d6', desc: '의학 지식 전달' },
    { key: 'faq', label: '상담 FAQ', icon: '❓', color: '#ff9500', desc: '자주 묻는 질문' },
    { key: 'recovery', label: '회복 가이드', icon: '🏥', color: '#34c759', desc: '수술 후 관리' },
  ],
  '치과': [
    { key: 'treatment', label: '진료 안내', icon: '🦷', color: '#007aff', desc: '치료 종류/과정' },
    { key: 'prevention', label: '예방 정보', icon: '🪥', color: '#34c759', desc: '구강 관리법' },
    { key: 'expert', label: '전문 칼럼', icon: '🩺', color: '#5856d6', desc: '치과 전문 지식' },
    { key: 'faq', label: '상담 FAQ', icon: '❓', color: '#ff9500', desc: '자주 묻는 질문' },
  ],
  '카페': [
    { key: 'menu', label: '메뉴 소개', icon: '☕', color: '#8B4513', desc: '음료/디저트 소개' },
    { key: 'daily', label: '일상 공유', icon: '📷', color: '#e1306c', desc: '카페 일상/분위기' },
    { key: 'event', label: '이벤트', icon: '🎉', color: '#ff3b30', desc: '신메뉴/할인' },
    { key: 'recipe', label: '레시피', icon: '🧁', color: '#ff9500', desc: '음료/베이킹 레시피' },
  ],
  '한식당': [
    { key: 'menu', label: '메뉴 소개', icon: '🍚', color: '#8B4513', desc: '대표 메뉴 스토리' },
    { key: 'ingredient', label: '식재료', icon: '🥬', color: '#34c759', desc: '신선한 재료 이야기' },
    { key: 'daily', label: '매장 일상', icon: '👨‍🍳', color: '#ff8c00', desc: '주방/매장 비하인드' },
    { key: 'event', label: '이벤트', icon: '🎉', color: '#ff3b30', desc: '시즌 메뉴/할인' },
  ],
  'IT/솔루션': [
    { key: 'tech', label: '기술 분석', icon: '💻', color: '#007aff', desc: '기술 심층 분석' },
    { key: 'trend', label: '트렌드', icon: '📈', color: '#5856d6', desc: 'IT 트렌드 리포트' },
    { key: 'tutorial', label: '튜토리얼', icon: '📖', color: '#34c759', desc: '사용법/가이드' },
    { key: 'comparison', label: '비교 분석', icon: '⚖️', color: '#ff9500', desc: '제품/서비스 비교' },
    { key: 'case', label: '도입 사례', icon: '🏢', color: '#007aff', desc: '기업 도입 사례' },
  ],
  '법률(변호사)': [
    { key: 'legal', label: '법률 해설', icon: '⚖️', color: '#1c1c1e', desc: '법률 쉽게 풀기' },
    { key: 'case', label: '판례 분석', icon: '📋', color: '#5856d6', desc: '실제 판례 해설' },
    { key: 'faq', label: '법률 FAQ', icon: '❓', color: '#ff9500', desc: '자주 묻는 법률 질문' },
    { key: 'news', label: '법률 뉴스', icon: '📰', color: '#007aff', desc: '법률 개정/판결 뉴스' },
  ],
  '부동산(중개)': [
    { key: 'market', label: '시세 분석', icon: '📊', color: '#007aff', desc: '지역 시세/전망' },
    { key: 'listing', label: '매물 소개', icon: '🏠', color: '#34c759', desc: '추천 매물 상세' },
    { key: 'guide', label: '거래 가이드', icon: '📖', color: '#ff9500', desc: '매매/전세 절차' },
    { key: 'area', label: '동네 정보', icon: '📍', color: '#5856d6', desc: '학군/교통/편의' },
  ],
  '피부과': [
    { key: 'treatment', label: '시술 안내', icon: '✨', color: '#e1306c', desc: '피부 시술 종류' },
    { key: 'skincare', label: '피부 관리', icon: '🧴', color: '#34c759', desc: '홈케어 팁' },
    { key: 'season', label: '계절 케어', icon: '🌸', color: '#ff9500', desc: '계절별 피부 관리' },
    { key: 'faq', label: '상담 FAQ', icon: '❓', color: '#007aff', desc: '자주 묻는 질문' },
  ],
};

// 상태
const _paState = {
  selectedCat: null,
  selectedSub: null,
  scope: 'global',     // global | profile | industry
  dirty: false,
  original: '',
  cache: {},            // localStorage 캐시
};

let _paMode = 'default'; // 'default' | 'profile'

function paInit() {
  _paMode = localStorage.getItem('pa_mode') || 'default';
  paSwitchMode(_paMode, true);
  paRenderCategoryTree();
  paLoadSetList();
  // 이전 선택 복원
  const last = localStorage.getItem('pa_last_selection');
  if (last) {
    try {
      const { cat, sub } = JSON.parse(last);
      if (PA_CATEGORIES[cat]) {
        _paState.selectedCat = cat;
        _paState.selectedSub = sub;
        paRenderCategoryTree();
        paLoadAndRenderEditor(cat, sub);
      }
    } catch(e) {}
  }
}

function paSwitchMode(mode, skipReload) {
  _paMode = mode;
  localStorage.setItem('pa_mode', mode);
  // 탭 스타일
  const btnDef = document.getElementById('pa-mode-default');
  const btnProf = document.getElementById('pa-mode-profile');
  const descEl = document.getElementById('pa-mode-desc');
  const profileBar = document.getElementById('pa-profile-bar');
  const defaultBar = document.getElementById('pa-default-bar');
  if (btnDef && btnProf) {
    if (mode === 'default') {
      btnDef.style.color = '#ff8c00'; btnDef.style.borderBottomColor = '#ff8c00';
      btnProf.style.color = 'rgba(0,0,0,0.35)'; btnProf.style.borderBottomColor = 'transparent';
    } else {
      btnProf.style.color = '#ff8c00'; btnProf.style.borderBottomColor = '#ff8c00';
      btnDef.style.color = 'rgba(0,0,0,0.35)'; btnDef.style.borderBottomColor = 'transparent';
    }
  }
  if (descEl) {
    descEl.innerHTML = mode === 'default'
      ? '<span style="font-size:16px;">📌</span><span><b>기본 프롬프트</b> — 모든 프로필에 공통으로 적용됩니다. 프로필 전용 프롬프트가 없으면 이 기본값이 사용됩니다.</span>'
      : '<span style="font-size:16px;">👤</span><span><b>프로필 전용</b> — 선택한 프로필에만 적용됩니다. 비어있으면 기본 프롬프트가 사용됩니다.</span>';
  }
  if (profileBar) profileBar.style.display = mode === 'profile' ? '' : 'none';
  if (defaultBar) defaultBar.style.display = mode === 'default' ? '' : 'none';
  // 프로필명 업데이트
  const nameEl = document.getElementById('pa-profile-name');
  if (nameEl) nameEl.textContent = window._globalProfileData?.name || '미선택';
  if (!skipReload && _paState.selectedCat && _paState.selectedSub) {
    paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
  }
}

// ── 프롬프트 세트 ──
let _paLoadedSetId = null;
let _paLoadedSetData = null;

async function paLoadSetList() {
  const sel = document.getElementById('pa-set-select');
  if (!sel) return;
  try {
    const pid = _paEffectiveProfileId();
    const sets = await api(`/api/prompt-sets?profile_id=${pid}`);
    sel.innerHTML = '<option value="">-- 기본 --</option>';
    (sets || []).forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    if (_paLoadedSetId) sel.value = _paLoadedSetId;
  } catch(e) { console.log('[PA] 세트 로드 실패:', e); }
}

async function paLoadSet(setId) {
  const applyBtn = document.getElementById('pa-apply-set-btn');
  const delBtn = document.getElementById('pa-delete-set-btn');
  const statusEl = document.getElementById('pa-set-status');
  if (!setId) {
    _paLoadedSetId = null;
    _paLoadedSetData = null;
    if (applyBtn) applyBtn.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = '기본 프롬프트 편집 중';
    // 기본으로 돌아가면 에디터 새로고침
    if (_paState.selectedCat && _paState.selectedSub) {
      paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
    }
    return;
  }
  try {
    const set = await api(`/api/prompt-sets/${setId}`);
    _paLoadedSetId = set.id;
    _paLoadedSetData = set.data;
    if (applyBtn) applyBtn.style.display = '';
    if (delBtn) delBtn.style.display = '';
    if (statusEl) statusEl.textContent = `${Object.keys(set.data).length}개 카테고리 · ${set.updated_at || ''}`;
    toast(`'${set.name}' 세트 불러옴 — 편집/저장하면 이 세트에 반영됩니다`);
    // 에디터에 표시 중인 프롬프트를 세트 데이터로 갱신
    if (_paState.selectedCat && _paState.selectedSub) {
      paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
    }
  } catch(e) { toast('세트 로드 실패: ' + e.message, 'error'); }
}

async function paSaveSetDialog() {
  // Electron에서는 prompt() 사용 불가 — 커스텀 입력 사용
  const name = await showInputDialog('프롬프트 세트 저장', '세트 이름을 입력하세요', '');
  if (!name || !name.trim()) return;
  // 현재 모든 프롬프트를 수집
  try {
    const pid = _paEffectiveProfileId();
    const all = await api(`/api/prompts?profile_id=${pid}`);
    const rows = Array.isArray(all) ? all : (Array.isArray(all?.data) ? all.data : []);
    const data = {};
    rows.forEach(p => {
      if (!data[p.category]) data[p.category] = {};
      data[p.category][p.subcategory] = p.content;
    });
    await api('/api/prompt-sets', {
      method: 'POST',
      body: { name: name.trim(), profile_id: pid, data },
    });
    toast(`'${name.trim()}' 세트 저장 완료!`);
    paLoadSetList();
  } catch(e) { toast('세트 저장 실패: ' + e.message, 'error'); }
}

async function paApplySet() {
  if (!_paLoadedSetId) { toast('세트를 먼저 선택하세요', 'error'); return; }
  const pid = _paEffectiveProfileId();
  if (!confirm('이 세트의 프롬프트를 현재 프로필에 적용합니다.\n기존 프로필 프롬프트가 덮어쓰기됩니다.\n\n계속할까요?')) return;
  try {
    const res = await api(`/api/prompt-sets/${_paLoadedSetId}/apply`, {
      method: 'POST',
      body: { profile_id: pid },
    });
    toast(res.message || '적용 완료!');
    // 에디터 새로고침
    if (_paState.selectedCat && _paState.selectedSub) {
      paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
    }
  } catch(e) { toast('적용 실패: ' + e.message, 'error'); }
}

async function paDeleteSet() {
  if (!_paLoadedSetId) return;
  if (!confirm('이 프롬프트 세트를 삭제할까요?')) return;
  try {
    await api(`/api/prompt-sets/${_paLoadedSetId}`, { method: 'DELETE' });
    toast('세트 삭제됨');
    _paLoadedSetId = null;
    _paLoadedSetData = null;
    document.getElementById('pa-set-select').value = '';
    document.getElementById('pa-apply-set-btn').style.display = 'none';
    document.getElementById('pa-delete-set-btn').style.display = 'none';
    document.getElementById('pa-set-status').textContent = '';
    paLoadSetList();
  } catch(e) { toast('삭제 실패: ' + e.message, 'error'); }
}

// ── 기본값 전체 복원 ──
async function paRestoreAllDefaults() {
  const ok = await showConfirm('모든 프롬프트를 초기 기본값으로 복원합니다.\n\n현재 프로필에 저장된 커스텀 프롬프트가 모두 삭제됩니다.\n(프롬프트 세트는 유지됩니다)\n\n계속할까요?');
  if (!ok) return;
  try {
    const pid = _paEffectiveProfileId();
    await api('/api/prompts/restore-defaults', { method: 'POST', body: { profile_id: pid } });
    // localStorage 커스텀 마커 제거
    Object.keys(localStorage).filter(k => k.startsWith('pa_custom_') || k.startsWith('pa_prompt_')).forEach(k => localStorage.removeItem(k));
    toast('기본값으로 복원 완료!');
    // 편집기 새로고침
    if (_paState.selectedCat && _paState.selectedSub) {
      paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
    }
    paRenderCategoryTree();
  } catch(e) { toast('복원 실패: ' + e.message, 'error'); }
}

// 프롬프트 복사
function paCopyPrompt() {
  const ta = document.getElementById('pa-editor-textarea');
  if (!ta) { toast('복사할 프롬프트가 없습니다', 'error'); return; }
  navigator.clipboard.writeText(ta.value).then(() => toast('프롬프트 복사됨!')).catch(() => toast('복사 실패', 'error'));
}

// 개별 프롬프트 기본값 복원
async function paRestoreSingleDefault(category, subcategory) {
  const ok = await showConfirm('이 프롬프트를 초기 기본값으로 복원할까요?');
  if (!ok) return;
  try {
    const pid = _paEffectiveProfileId();
    await api('/api/prompts/restore-defaults', { method: 'POST', body: { profile_id: pid, category, subcategory } });
    localStorage.removeItem(`pa_custom_${category}_${subcategory}_${pid}`);
    localStorage.removeItem(`pa_prompt_${category}_${subcategory}_${pid}`);
    toast('기본값 복원 완료');
    paLoadAndRenderEditor(category, subcategory);
    paRenderCategoryTree();
  } catch(e) { toast('복원 실패: ' + e.message, 'error'); }
}

// ── 카테고리 트리 ──
function paRenderCategoryTree() {
  const tree = document.getElementById('prompt-category-tree');
  if (!tree) return;
  let html = '<div style="font-size:13px;font-weight:800;color:#1c1c1e;margin-bottom:12px;">카테고리</div>';
  for (const [catKey, cat] of Object.entries(PA_CATEGORIES)) {
    const isOpen = _paState.selectedCat === catKey;
    html += `<div class="pa-cat-group" data-cat="${catKey}">
      <div class="pa-cat-header ${isOpen ? 'pa-cat-open' : ''}" onclick="paToggleCategory('${catKey}')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:all 0.2s;font-size:13px;font-weight:600;color:${isOpen ? '#ff8c00' : '#1c1c1e'};" onmouseenter="this.style.background='rgba(255,140,0,0.06)'" onmouseleave="this.style.background=''">
        <span style="font-size:15px;">${cat.icon}</span>
        <span style="flex:1;">${cat.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;transition:transform 0.2s;transform:rotate(${isOpen ? 90 : 0}deg);opacity:0.3;"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="pa-cat-items" style="overflow:hidden;max-height:${isOpen ? cat.items.length * 42 + 'px' : '0'};transition:max-height 0.3s cubic-bezier(0.16,1,0.3,1);padding-left:12px;">`;
    for (const item of cat.items) {
      const isActive = _paState.selectedCat === catKey && _paState.selectedSub === item.key;
      const customKey = `pa_custom_${catKey}_${item.key}_${_paEffectiveProfileId()}`;
      const isCustom = !!localStorage.getItem(customKey);
      html += `<div onclick="paSelectItem('${catKey}','${item.key}')" style="padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px;transition:all 0.15s;display:flex;align-items:center;gap:6px;${isActive ? 'background:rgba(255,140,0,0.1);color:#ff8c00;font-weight:700;' : 'color:rgba(0,0,0,0.55);'}" onmouseenter="if(!${isActive})this.style.background='rgba(0,0,0,0.03)'" onmouseleave="if(!${isActive})this.style.background=''">
        <span style="flex:1;">${item.label}</span>
        ${isCustom ? '<span style="width:6px;height:6px;border-radius:50%;background:#ff8c00;flex-shrink:0;" title="커스텀"></span>' : ''}
      </div>`;
    }
    html += '</div></div>';
  }
  tree.innerHTML = html;
}

function paToggleCategory(catKey) {
  _paState.selectedCat = _paState.selectedCat === catKey ? null : catKey;
  _paState.selectedSub = null;
  paRenderCategoryTree();
}

async function paSelectItem(catKey, subKey) {
  if (_paState.dirty) {
    const ok = await showConfirm('변경사항이 저장되지 않았습니다. 이동하시겠습니까?');
    if (!ok) return;
  }
  _paState.selectedCat = catKey;
  _paState.selectedSub = subKey;
  _paState.dirty = false;
  localStorage.setItem('pa_last_selection', JSON.stringify({ cat: catKey, sub: subKey }));
  paRenderCategoryTree();
  paLoadAndRenderEditor(catKey, subKey);
}

// ── 프롬프트 로드 ──
function _paEffectiveProfileId() {
  return _paMode === 'default' ? 0 : (parseInt(window._globalProfileId || 0));
}
async function paLoadPrompt(category, subcategory) {
  // 세트가 선택되어 있으면 세트 데이터 우선 (프로필 모드만)
  if (_paMode === 'profile' && _paLoadedSetId && _paLoadedSetData && _paLoadedSetData[category]?.[subcategory]) {
    return { content: _paLoadedSetData[category][subcategory], isCustom: true, source: 'set' };
  }
  const profileId = _paEffectiveProfileId();
  // 1) API 시도
  try {
    const data = await api(`/api/prompts/resolve?category=${category}&subcategory=${subcategory}&profile_id=${profileId}&scope=${_paState.scope}`);
    return { content: data.content || '', isCustom: data.is_custom || false, source: 'api' };
  } catch (e) {
    // 2) localStorage 폴백
    const key = `pa_prompt_${category}_${subcategory}_${profileId}`;
    const saved = localStorage.getItem(key);
    if (saved) return { content: saved, isCustom: true, source: 'local' };
    return { content: '', isCustom: false, source: 'default' };
  }
}

// ── 프롬프트 저장 ──
async function paSavePrompt(category, subcategory, content, scope) {
  // 세트가 선택되어 있으면 세트에 저장
  if (_paLoadedSetId && _paLoadedSetData) {
    if (!_paLoadedSetData[category]) _paLoadedSetData[category] = {};
    _paLoadedSetData[category][subcategory] = content;
    try {
      await api(`/api/prompt-sets/${_paLoadedSetId}`, {
        method: 'PUT',
        body: { data: _paLoadedSetData },
      });
    } catch (e) {
      console.warn('[PA] 세트 저장 실패:', e.message);
    }
    _paState.dirty = false;
    _paState.original = content;
    paShowSaveAnimation();
    toast('세트 프롬프트 저장 완료');
    return;
  }

  const profileId = _paEffectiveProfileId();
  const profileName = _paMode === 'default' ? '전체 기본' : (window._globalProfileData?.name || '전체 기본');
  // localStorage에 항상 저장 (폴백)
  const localKey = `pa_prompt_${category}_${subcategory}_${profileId}`;
  const customKey = `pa_custom_${category}_${subcategory}_${profileId}`;
  localStorage.setItem(localKey, content);
  localStorage.setItem(customKey, '1');

  // API 시도
  try {
    await api('/api/prompts', {
      method: 'POST',
      body: { category, subcategory, content, name: `${profileName} 전용`, profile_id: profileId }
    });
  } catch (e) {
    console.warn('[PA] API 저장 실패, localStorage에만 저장:', e.message);
  }

  _paState.dirty = false;
  _paState.original = content;
  paRenderCategoryTree(); // 커스텀 뱃지 업데이트
  paShowSaveAnimation();
  toast('프롬프트 저장 완료');
}

// ── 프롬프트 초기화 ──
async function paResetPrompt(category, subcategory) {
  const ok = await showConfirm('기본값으로 초기화하시겠습니까? 커스텀 내용이 삭제됩니다.');
  if (!ok) return;
  const profileId = _paEffectiveProfileId();
  const localKey = `pa_prompt_${category}_${subcategory}_${profileId}`;
  const customKey = `pa_custom_${category}_${subcategory}_${profileId}`;
  localStorage.removeItem(localKey);
  localStorage.removeItem(customKey);
  try {
    await api(`/api/prompts/reset/${category}?subcategory=${encodeURIComponent(subcategory)}&profile_id=${profileId}`, { method: 'POST' });
  } catch (e) { /* ignore */ }
  _paState.dirty = false;
  paLoadAndRenderEditor(category, subcategory);
  paRenderCategoryTree();
  toast('기본값으로 초기화되었습니다');
}

// ── 저장 체크마크 애니메이션 ──
function paShowSaveAnimation() {
  const btn = document.getElementById('pa-save-btn');
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12" style="stroke-dasharray:20;stroke-dashoffset:20;animation:paCheckDraw 0.4s 0.1s forwards;"/></svg> 저장됨';
  btn.style.background = '#34c759';
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1500);
}

// ── 편집기 렌더링 ──
async function paLoadAndRenderEditor(category, subcategory) {
  const area = document.getElementById('prompt-editor-area');
  if (!area) return;
  const cat = PA_CATEGORIES[category];
  const item = cat?.items.find(i => i.key === subcategory);
  if (!cat || !item) return;

  area.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:400px;"><span class="spinner"></span></div>';

  const { content, isCustom, source } = await paLoadPrompt(category, subcategory);
  _paState.original = content;
  _paState.dirty = false;

  area.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="font-size:20px;">${cat.icon}</span>
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:800;color:#1c1c1e;">${item.label}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-top:1px;">${item.desc}</div>
      </div>
      ${isCustom ? '<span style="padding:3px 10px;background:rgba(255,140,0,0.1);color:#ff8c00;border-radius:6px;font-size:11px;font-weight:700;">커스텀</span>' : ''}
      <span id="pa-dirty-badge" style="display:none;padding:3px 10px;background:rgba(255,59,48,0.1);color:#ff3b30;border-radius:6px;font-size:11px;font-weight:700;">변경됨</span>
    </div>

    <!-- 모드 안내 배지 -->
    <div style="padding:8px 14px;background:${_paMode === 'default' ? 'rgba(0,122,255,0.04)' : 'rgba(255,140,0,0.04)'};border:1px solid ${_paMode === 'default' ? 'rgba(0,122,255,0.1)' : 'rgba(255,140,0,0.1)'};border-radius:12px;margin-bottom:12px;font-size:12px;color:rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;">
      ${_paMode === 'default'
        ? '<span style="font-size:14px;">📌</span><span>이 프롬프트는 <b>모든 프로필</b>에 공통 적용됩니다</span>'
        : '<span style="font-size:14px;">👤</span><span><b style="color:#ff8c00;">' + (window._globalProfileData?.name || '미선택') + '</b> 프로필에만 적용됩니다. 비어있으면 기본 프롬프트 사용</span>'}
    </div>

    <!-- 사용 위치 + 팁 안내 -->
    <div style="padding:12px 14px;background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.1);border-radius:12px;margin-bottom:14px;">
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:14px;flex-shrink:0;">📍</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:#007aff;margin-bottom:4px;">어디서 사용되나요?</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.55);line-height:1.6;">${item.where || item.desc}</div>
          ${item.tip ? '<div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:4px;">💡 ' + item.tip + '</div>' : ''}
        </div>
      </div>
    </div>


    <!-- 에디터 영역 -->
    <div id="pa-editor-wrap" style="position:relative;">
      ${paRenderTextEditor(content)}
    </div>

    <!-- 변수 자동완성 드롭다운 (숨김) -->
    <div id="pa-var-dropdown" style="display:none;position:absolute;z-index:100;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-height:240px;overflow-y:auto;width:260px;"></div>

    <!-- 변수 칩 영역 -->
    <div style="margin-top:14px;">
      <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:10px;">사용 가능한 변수 (클릭하면 커서 위치에 삽입)</div>
      <div id="pa-var-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;">
        ${paRenderVariableChips()}
      </div>
    </div>

    <!-- 하단 버튼 -->
    <div style="display:flex;gap:10px;margin-top:18px;align-items:center;">
      <button id="pa-save-btn" onclick="paSaveCurrentPrompt()" style="padding:10px 28px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 16px rgba(255,140,0,0.25);" onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(255,140,0,0.35)'" onmouseleave="this.style.transform='';this.style.boxShadow='0 4px 16px rgba(255,140,0,0.25)'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:middle;margin-right:6px;display:inline;"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>저장
      </button>
      <button onclick="paCopyPrompt()" style="padding:10px 20px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.5);border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:5px;" onmouseenter="this.style.borderColor='#007aff';this.style.color='#007aff'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.08)';this.style.color='rgba(0,0,0,0.5)'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>복사
      </button>
      <button onclick="paRestoreSingleDefault('${category}','${subcategory}')" style="padding:10px 20px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.5);border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;" onmouseenter="this.style.borderColor='#ff3b30';this.style.color='#ff3b30'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.08)';this.style.color='rgba(0,0,0,0.5)'">기본값 복원</button>
      <div style="flex:1;"></div>
    </div>
  `;

  // 변수 자동완성 바인딩
  const ta = document.getElementById('pa-textarea');
  if (ta) {
    ta.addEventListener('input', paHandleTextareaInput);
    ta.addEventListener('keydown', paHandleTextareaKeydown);
    ta.addEventListener('scroll', () => paHighlightSync());
    paHighlightSync();
  }
  paUpdatePreview();
}

// ── 텍스트 에디터 (다크 코드 에디터 스타일) ──
function paRenderTextEditor(content) {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);min-height:600px;">
      <!-- 왼쪽: 입력 -->
      <div style="border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;padding:8px 14px;background:#282a36;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;gap:6px;">
            <span style="width:10px;height:10px;border-radius:50%;background:#ff5f56;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;"></span>
            <span style="width:10px;height:10px;border-radius:50%;background:#27c93f;"></span>
          </div>
          <span style="flex:1;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);">편집</span>
          <span id="pa-char-count" style="font-size:10px;color:rgba(255,255,255,0.25);">${content.length}자</span>
        </div>
        <textarea id="pa-textarea" style="display:block;width:100%;height:100%;min-height:600px;padding:16px;background:#1e1e2e;color:#cdd6f4;border:none;resize:none;font-family:-apple-system,sans-serif;font-size:14px;line-height:2;outline:none;caret-color:#ff8c00;box-sizing:border-box;word-wrap:break-word;white-space:pre-wrap;" spellcheck="false">${paEscapeHtml(content)}</textarea>
      </div>
      <!-- 오른쪽: 미리보기 -->
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;padding:8px 14px;background:#f8f8fa;border-bottom:1px solid rgba(0,0,0,0.06);">
          <span style="flex:1;text-align:center;font-size:11px;color:rgba(0,0,0,0.35);">미리보기 (변수 치환 결과)</span>
        </div>
        <div id="pa-live-preview" style="flex:1;padding:16px;background:#fff;font-size:14px;line-height:2;color:#1c1c1e;overflow-y:auto;white-space:pre-wrap;word-wrap:break-word;">${paRenderPreviewContent(content)}</div>
      </div>
    </div>`;
}

function paRenderPreviewContent(content) {
  const p = window._globalProfileData || {};
  const co = typeof p.content_options === 'string' ? JSON.parse(p.content_options || '{}') : (p.content_options || {});
  const s = (v, bg = 'rgba(52,199,89,0.15)') => `<span style="background:${bg};padding:1px 4px;border-radius:3px;">${v}</span>`;
  const blogStylePreview = (() => {
    try {
      const ws = JSON.parse(p.writing_style || '{}');
      const style = ws.blog || ws;
      const parts = [];
      if (style.tone) parts.push(`어조: ${style.tone}`);
      if (style.sentence_style) parts.push(`문장 구조: ${style.sentence_style}`);
      if (style.ending_style) parts.push(`끝맺음 패턴: ${style.ending_style}`);
      if (style.paragraph_style) parts.push(`문단 구성: ${style.paragraph_style}`);
      if (style.vocabulary_level) parts.push(`어휘 수준: ${style.vocabulary_level}`);
      if (style.opening_pattern) parts.push(`글 시작 방식: ${style.opening_pattern}`);
      if (style.closing_pattern) parts.push(`글 마무리 방식: ${style.closing_pattern}`);
      if (Array.isArray(style.connector_words) && style.connector_words.length) parts.push(`자주 쓰는 연결어: ${style.connector_words.slice(0, 10).join(', ')}`);
      if (Array.isArray(style.rhetoric) && style.rhetoric.length) parts.push(`수사법: ${style.rhetoric.slice(0, 5).join(', ')}`);
      if (Array.isArray(style.unique_features) && style.unique_features.length) parts.push(`고유 특징: ${style.unique_features.slice(0, 6).join(' / ')}`);
      return parts.join('\n') || '블로그 스타일 미분석';
    } catch {
      return '블로그 스타일 미분석';
    }
  })();
  const kw = document.getElementById('kc-keyword')?.value?.trim() || p.keywords?.split(',')[0]?.trim() || '키워드';
  const vars = {
    '키워드': s(kw, 'rgba(255,140,0,0.15)'),
    '브랜드명': s(p.name || '브랜드명'),
    '업종': s(p.business_type || '업종'),
    '콘텐츠목적': s(p.business_goal || '콘텐츠 목적'),
    '블로그스타일': s(blogStylePreview, 'rgba(52,199,89,0.15)'),
    '스레드스타일': s((() => { try { const ws = JSON.parse(p.writing_style || '{}'); return (ws.threads?.tone || ws.tone || '').substring(0,80) || '스레드 스타일 미분석'; } catch { return '스레드 스타일 미분석'; } })()),
    '글길이': s({'short':'800자','medium':'2000자','long':'3000자','extra_long':'5000자'}[co.blog_length] || co.blog_length || '2000자'),
    '쉼표비율': s(String(co.comma_rate ?? 50)),
    '마침표비율': s(String(co.period_rate ?? 70)),
    '자연스러움': s({'light':'가볍게','heavy':'많이','none':'안 함'}[co.human_level] || co.human_level || '가볍게'),
    '참고자료': s('[수집된 참고자료 본문...]', 'rgba(0,122,255,0.1)'),
    '문체지시': s('[문체 분석 결과...]', 'rgba(0,122,255,0.1)'),
    '브랜드정보': s((p.name || '') + ' / ' + (p.business_type || '')),
    '주제': s(kw, 'rgba(255,140,0,0.15)'),
    '장수': s(co.cn_slides || 5),
    '제목': s('[슬라이드 제목]', 'rgba(0,122,255,0.1)'),
    '본문': s('[슬라이드 본문]', 'rgba(0,122,255,0.1)'),
    '컷수': s(co.comic_panels || 4),
    '스타일설명': s(co.comic_style || 'cute'),
    '참고자료섹션': s('[참고자료 블록]', 'rgba(0,122,255,0.1)'),
    '업체명': s(p.name || '업체명'),
    '업종정보': s(p.business_type || '업종 정보'),
    '스타일힌트': s('[스타일 힌트...]', 'rgba(0,122,255,0.1)'),
    '소스텍스트': s('[소스 텍스트...]', 'rgba(0,122,255,0.1)'),
    '스레드규칙': s('[스레드 규칙]', 'rgba(0,122,255,0.1)'),
    '이어쓰기규칙': s('[이어쓰기 규칙]', 'rgba(0,122,255,0.1)'),
    '스레드글자수': s('500'),
    '트위터글자수': s('250'),
    '트위터규칙': s('[트위터 규칙]', 'rgba(0,122,255,0.1)'),
    '슬라이드번호': s('1'),
    '시각컨셉': s('[시각 컨셉]', 'rgba(0,122,255,0.1)'),
    '글분량': s(co.blog_length || 'medium'),
    '원본글': s('[원본 글...]', 'rgba(0,122,255,0.1)'),
    '문체참고글': s('[문체 참고글...]', 'rgba(0,122,255,0.1)'),
    '구조참고글': s('[구조 참고글...]', 'rgba(0,122,255,0.1)'),
    '커스텀지시': s('[커스텀 지시]', 'rgba(0,122,255,0.1)'),
  };
  let result = paEscapeHtml(content);
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
  }
  // 남은 변수는 회색 처리
  result = result.replace(/\{([^}]+)\}/g, '<span style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;color:rgba(0,0,0,0.35);">{$1}</span>');
  return result;
}

// ── 적용 범위 전환 ──
async function paSwitchScope(scope) {
  if (_paState.scope === scope) return;
  if (_paState.dirty) {
    const ok = await showConfirm('변경사항이 저장되지 않았습니다. 범위를 전환하시겠습니까?');
    if (!ok) return;
  }
  _paState.scope = scope;
  _paState.dirty = false;
  if (_paState.selectedCat && _paState.selectedSub) {
    paLoadAndRenderEditor(_paState.selectedCat, _paState.selectedSub);
  }
}

// ── 변수 삽입 ──
function paRenderVariableChips() {
  const p = window._globalProfileData || {};
  const co = typeof p.content_options === 'string' ? JSON.parse(p.content_options || '{}') : (p.content_options || {});
  const liveValues = {
    keyword: '(1단계에서 입력한 키워드)',
    brand_name: p.name || '(프로필 미선택)',
    business_type: p.business_type || '(프로필 미선택)',
    brand_description: p.description || '(프로필 미선택)',
    business_goal: p.business_goal || '(프로필 미선택)',
    source_text: '(2단계에서 수집한 본문)',
    source_count: '(수집된 소스 수)',
    tone: co.tone || 'mystyle',
    blog_length: co.blog_length || 'medium',
    comma_rate: String(co.comma_rate ?? 50),
    period_rate: String(co.period_rate ?? 70),
    topic: '(키워드와 동일)',
    slide_count: String(co.cn_slides || 5),
    style: co.cn_style || 'ai-auto',
    title: '(각 슬라이드 제목)',
    body: '(각 슬라이드 본문)',
  };
  return PA_VARIABLES.map(v => {
    const live = liveValues[v.key] || v.example || v.desc;
    const isProfile = live && !live.startsWith('(');
    return `
      <div onclick="paInsertVariable('${v.key}')" style="padding:8px 12px;background:${isProfile ? 'rgba(52,199,89,0.04)' : 'rgba(255,140,0,0.04)'};border:1px solid ${isProfile ? 'rgba(52,199,89,0.15)' : 'rgba(255,140,0,0.1)'};border-radius:10px;cursor:pointer;transition:all 0.15s;" onmouseenter="this.style.background='${isProfile ? 'rgba(52,199,89,0.12)' : 'rgba(255,140,0,0.12)'}'" onmouseleave="this.style.background='${isProfile ? 'rgba(52,199,89,0.04)' : 'rgba(255,140,0,0.04)'}'" title="클릭하면 커서 위치에 삽입">
        <div style="display:flex;align-items:center;gap:6px;">
          <code style="font-size:12px;font-weight:700;color:${isProfile ? '#34c759' : '#ff8c00'};font-family:'SF Mono',Menlo,monospace;">{${v.key}}</code>
          <span style="font-size:10px;color:rgba(0,0,0,0.35);">${v.label}</span>
        </div>
        <div style="font-size:10px;color:rgba(0,0,0,0.45);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${isProfile ? '→ ' : ''}${live}</div>
      </div>`;
  }).join('');
}

function paUpdateLivePreview() {
  const ta = document.getElementById('pa-textarea');
  const preview = document.getElementById('pa-live-preview');
  if (ta && preview) preview.innerHTML = paRenderPreviewContent(ta.value);
}

function paInsertVariable(varKey) {
  const ta = document.getElementById('pa-textarea');
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = `{${varKey}}`;
  ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  ta.focus();
  paMarkDirty();
  paHighlightSync();
  paUpdatePreview();
}

// ── textarea 입력 핸들러 (변수 자동완성) ──
function paHandleTextareaInput(e) {
  paMarkDirty();
  paHighlightSync();
  paUpdateLivePreview();
  paUpdateCharCount();

  const ta = e.target;
  const pos = ta.selectionStart;
  const textBefore = ta.value.substring(0, pos);
  const braceIdx = textBefore.lastIndexOf('{');

  if (braceIdx >= 0 && !textBefore.substring(braceIdx).includes('}')) {
    const partial = textBefore.substring(braceIdx + 1).toLowerCase();
    const matches = PA_VARIABLES.filter(v => v.key.includes(partial) || v.label.includes(partial));
    if (matches.length > 0) {
      paShowVarDropdown(matches, braceIdx, ta);
      return;
    }
  }
  paHideVarDropdown();
}

function paHandleTextareaKeydown(e) {
  const dd = document.getElementById('pa-var-dropdown');
  if (dd && dd.style.display !== 'none') {
    const items = dd.querySelectorAll('.pa-dd-item');
    const activeIdx = [...items].findIndex(it => it.classList.contains('pa-dd-active'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items.forEach(it => it.classList.remove('pa-dd-active'));
      const next = (activeIdx + 1) % items.length;
      items[next].classList.add('pa-dd-active');
      items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items.forEach(it => it.classList.remove('pa-dd-active'));
      const prev = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
      items[prev].classList.add('pa-dd-active');
      items[prev].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const active = dd.querySelector('.pa-dd-active');
      if (active) {
        e.preventDefault();
        active.click();
      }
    } else if (e.key === 'Escape') {
      paHideVarDropdown();
    }
  }
}

function paShowVarDropdown(vars, braceIdx, ta) {
  const dd = document.getElementById('pa-var-dropdown');
  if (!dd) return;
  // 위치: textarea 아래 고정
  const wrap = document.getElementById('pa-editor-wrap');
  if (wrap) {
    dd.style.top = (ta.offsetTop + ta.offsetHeight + 4) + 'px';
    dd.style.left = '16px';
  }
  let html = '';
  vars.forEach((v, i) => {
    html += `<div class="pa-dd-item ${i === 0 ? 'pa-dd-active' : ''}" onmouseenter="this.parentNode.querySelectorAll('.pa-dd-item').forEach(x=>x.classList.remove('pa-dd-active'));this.classList.add('pa-dd-active')" onclick="paCompleteVariable('${v.key}',${braceIdx})" style="padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.1s;${i === 0 ? 'background:rgba(255,140,0,0.06);' : ''}">
      <span style="font-family:'SF Mono',Menlo,monospace;font-size:12px;color:#ff8c00;font-weight:600;">{${v.key}}</span>
      <span style="font-size:11px;color:rgba(0,0,0,0.35);">${v.desc}</span>
    </div>`;
  });
  dd.innerHTML = html;
  dd.style.display = 'block';
}

function paCompleteVariable(varKey, braceIdx) {
  const ta = document.getElementById('pa-textarea');
  if (!ta) return;
  const after = ta.value.substring(ta.selectionStart);
  ta.value = ta.value.substring(0, braceIdx) + `{${varKey}}` + after;
  const newPos = braceIdx + varKey.length + 2;
  ta.selectionStart = ta.selectionEnd = newPos;
  ta.focus();
  paHideVarDropdown();
  paMarkDirty();
  paHighlightSync();
  paUpdatePreview();
}

function paHideVarDropdown() {
  const dd = document.getElementById('pa-var-dropdown');
  if (dd) dd.style.display = 'none';
}

// ── 하이라이트 동기화 (변수 앱 기본 강조색 표시) ──
function paHighlightSync() {
  const ta = document.getElementById('pa-textarea');
  const ln = document.getElementById('pa-line-numbers');
  if (!ta) return;

  // 줄번호
  if (ln) {
    const lines = ta.value.split('\n').length;
    ln.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    ln.scrollTop = ta.scrollTop;
  }
}

function paUpdateCharCount() {
  const ta = document.getElementById('pa-textarea');
  const cc = document.getElementById('pa-char-count');
  if (ta && cc) cc.textContent = ta.value.length + '자';
}

// ── 실시간 미리보기 ──
function paUpdatePreview() {
  const preview = document.getElementById('pa-preview-content');
  if (!preview) return;
  const ta = document.getElementById('pa-textarea');
  const content = ta ? ta.value : '';
  const keyword = document.getElementById('pa-preview-keyword')?.value || '인공지능';
  const brand = document.getElementById('pa-preview-brand')?.value || '마케케';
  const replaced = content
    .replace(/\{keyword\}/g, keyword)
    .replace(/\{brand_name\}/g, brand)
    .replace(/\{business_type\}/g, '마케팅 자동화')
    .replace(/\{brand_description\}/g, '블로그/카드뉴스/영상 자동 생성 서비스')
    .replace(/\{business_goal\}/g, '서비스 인지도 향상')
    .replace(/\{source_text\}/g, '[수집된 참고자료 텍스트]')
    .replace(/\{source_count\}/g, '5')
    .replace(/\{tone\}/g, '전문적이면서 친근한')
    .replace(/\{blog_length\}/g, 'medium')
    .replace(/\{comma_rate\}/g, '15')
    .replace(/\{period_rate\}/g, '25')
    .replace(/\{topic\}/g, keyword)
    .replace(/\{slide_count\}/g, '7')
    .replace(/\{style\}/g, '모던')
    .replace(/\{title\}/g, keyword + ' 완벽 가이드')
    .replace(/\{body\}/g, '[본문 내용]');
  preview.textContent = replaced || '(프롬프트를 입력하면 미리보기가 표시됩니다)';
}

// ── 프리셋 적용 ──
async function paApplyBizPreset(key, label) {
  const ok = await showConfirm(`"${label}" 목적으로 프롬프트를 변경하시겠습니까?`);
  if (!ok) return;
  const btype = window._globalProfileData?.business_type || '';
  const bname = window._globalProfileData?.name || '';
  const template = `당신은 ${btype || '전문'} 분야의 블로그 작가입니다.
"${bname}" 브랜드의 "${label}" 콘텐츠를 작성합니다.

---

## 콘텐츠 목적: ${label}
- 이 글의 목적은 "${label}"입니다
- ${btype} 업종의 독자가 필요로 하는 정보를 제공합니다
- 전문성과 신뢰감을 느낄 수 있는 톤으로 작성합니다

---

## 규칙
- 참고자료의 실제 내용을 바탕으로 작성합니다
- 제목은 30자 이내, 핵심 이슈 반영
- 마크다운, 이모지, URL 사용 금지
- 브랜드명은 CTA에서만 1회 언급

---

## 톤
- {tone} 스타일
- 자연스러운 한국어`;

  const ta = document.getElementById('pa-textarea');
  if (ta) { ta.value = template; paHighlightSync(); paUpdateLivePreview(); }
  paMarkDirty();
  toast(`"${label}" 목적 적용됨`);
}

async function paApplyPreset(presetKey) {
  const ok = await showConfirm('프리셋을 적용하면 현재 내용이 교체됩니다. 계속하시겠습니까?');
  if (!ok) return;
  const presetTemplates = {
    informative: '당신은 정확한 사실을 전달하는 전문 블로거입니다.\n\n---\n\n## 규칙\n- 객관적이고 신뢰할 수 있는 정보를 제공합니다\n- 출처와 근거를 명확히 합니다\n- 전문 용어는 쉽게 풀어서 설명합니다\n\n---\n\n## 톤\n- 차분하고 논리적인 어조\n- {tone} 스타일을 유지합니다\n- 핵심 정보를 앞에 배치합니다\n\n---\n\n## 금지 사항\n- 근거 없는 주장 금지\n- 과장된 표현 금지\n- 광고성 문구 사용 금지',
    marketing: '당신은 {brand_name}의 전문 마케팅 카피라이터입니다.\n\n---\n\n## 규칙\n- {brand_description}의 핵심 가치를 자연스럽게 전달합니다\n- 독자의 문제를 먼저 공감한 뒤 해결책을 제시합니다\n- CTA(Call to Action)를 자연스럽게 포함합니다\n\n---\n\n## 톤\n- 설득력 있으면서 친근한 어조\n- {business_goal}에 맞는 메시지 전달\n- 혜택 중심의 서술\n\n---\n\n## 금지 사항\n- 노골적 광고 표현 금지\n- 경쟁사 비방 금지\n- 허위 과장 금지',
    review: '당신은 {keyword} 분야의 솔직한 리뷰어입니다.\n\n---\n\n## 규칙\n- 실제 사용 경험을 바탕으로 작성합니다\n- 장점과 단점을 균형 있게 다룹니다\n- 구체적인 사례와 수치를 포함합니다\n\n---\n\n## 톤\n- 솔직하고 친근한 대화체\n- 독자와 같은 눈높이에서 이야기합니다\n- 실용적인 팁을 곁들입니다',
    news: '당신은 {keyword} 분야의 전문 기자입니다.\n\n---\n\n## 규칙\n- 육하원칙(누가, 언제, 어디서, 무엇을, 왜, 어떻게)을 준수합니다\n- 역피라미드 구조로 작성합니다\n- 다양한 관점을 균형 있게 다룹니다\n\n---\n\n## 톤\n- 객관적이고 중립적인 보도 어조\n- 간결하고 명확한 문장\n- 사실과 의견을 명확히 구분합니다',
    conversational: '당신은 {keyword}에 대해 이야기하는 친근한 이웃입니다.\n\n---\n\n## 규칙\n- 편안한 대화체로 작성합니다\n- 독자의 공감을 이끌어냅니다\n- 개인적인 경험과 생각을 자연스럽게 녹입니다\n\n---\n\n## 톤\n- 따뜻하고 친근한 말투\n- 이모티콘이나 감탄사를 적절히 사용\n- 질문을 던지며 독자 참여를 유도합니다\n\n---\n\n## 금지 사항\n- 딱딱한 문어체 금지\n- 너무 긴 문장 금지',
  };
  const template = presetTemplates[presetKey] || '';
  const ta = document.getElementById('pa-textarea');
  if (ta) { ta.value = template; paHighlightSync(); }
  paMarkDirty();
  paUpdatePreview();
  toast(`"${PA_PRESETS.find(p => p.key === presetKey)?.label}" 프리셋 적용됨`);
}

// ── AI 프롬프트 개선 ──
// ── 프롬프트 테스트 실행 ──
async function paTestPrompt() {
  const ta = document.getElementById('pa-textarea');
  const userPrompt = ta ? ta.value : '';
  if (!userPrompt.trim()) { toast('테스트할 프롬프트를 먼저 작성하세요', 'error'); return; }

  // 테스트 입력 모달
  const modal = await paShowTestInputModal();
  if (!modal) return;

  const btn = document.getElementById('pa-test-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 실행 중...'; }

  try {
    const resp = await api('/api/prompts/test', {
      method: 'POST',
      body: {
        user_prompt: userPrompt,
        system_prompt: '',
        variables: modal.variables || {},
        sample_text: modal.sampleText || '',
        category: _paState.selectedCat,
      },
    });
    paShowTestResult(resp, userPrompt);
  } catch (e) {
    toast('테스트 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>테스트 실행'; }
  }
}

function paShowTestInputModal() {
  return new Promise(resolve => {
    const existing = document.getElementById('pa-test-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pa-test-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;';
    modal.innerHTML = `
      <div style="width:min(640px,calc(100vw - 48px));background:#fff;border-radius:22px;box-shadow:0 25px 60px rgba(0,0,0,0.22);overflow:hidden;">
        <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg,rgba(52,199,89,0.06),transparent);">
          <div style="font-size:18px;font-weight:800;color:#1c1c1e;">프롬프트 테스트</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;">변수값과 참고자료를 입력하면 AI가 실제로 실행합니다</div>
        </div>
        <div style="padding:20px 24px;display:grid;gap:16px;max-height:60vh;overflow:auto;">
          <div>
            <label style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);display:block;margin-bottom:6px;">키워드 {keyword}</label>
            <input id="pa-test-keyword" type="text" value="디카페인 라떼" style="width:100%;padding:10px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);display:block;margin-bottom:6px;">브랜드명 {brand_name}</label>
            <input id="pa-test-brand" type="text" value="마이카페" style="width:100%;padding:10px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);display:block;margin-bottom:6px;">비즈니스 목적 {business_goal}</label>
            <input id="pa-test-goal" type="text" value="카페 방문 유도" style="width:100%;padding:10px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);display:block;margin-bottom:6px;">참고자료 (선택)</label>
            <textarea id="pa-test-sample" rows="4" placeholder="테스트에 사용할 참고 텍스트를 입력하세요..." style="width:100%;padding:10px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
          </div>
        </div>
        <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,0.06);display:flex;gap:10px;justify-content:flex-end;">
          <button id="pa-test-cancel" style="padding:10px 20px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
          <button id="pa-test-run" style="padding:10px 28px;background:linear-gradient(135deg,#34c759,#28a745);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(52,199,89,0.3);">실행</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); resolve(null); } });
    modal.querySelector('#pa-test-cancel').addEventListener('click', () => { modal.remove(); resolve(null); });
    modal.querySelector('#pa-test-run').addEventListener('click', () => {
      const variables = {
        keyword: document.getElementById('pa-test-keyword')?.value || '',
        brand_name: document.getElementById('pa-test-brand')?.value || '',
        business_goal: document.getElementById('pa-test-goal')?.value || '',
      };
      const sampleText = document.getElementById('pa-test-sample')?.value || '';
      modal.remove();
      resolve({ variables, sampleText });
    });
    // 포커스
    setTimeout(() => document.getElementById('pa-test-keyword')?.focus(), 100);
  });
}

function paShowTestResult(resp, originalPrompt) {
  const existing = document.getElementById('pa-test-result-modal');
  if (existing) existing.remove();

  const output = resp.output || '(결과 없음)';
  const modal = document.createElement('div');
  modal.id = 'pa-test-result-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="width:min(960px,calc(100vw - 48px));max-height:calc(100vh - 48px);background:#fff;border-radius:22px;box-shadow:0 25px 60px rgba(0,0,0,0.22);display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg,rgba(52,199,89,0.06),transparent);flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:18px;font-weight:800;color:#1c1c1e;">테스트 결과</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;">
              ${resp.model || ''} · ${resp.elapsed || 0}초 · ${resp.char_count || 0}자
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="paTestPrompt()" style="padding:8px 16px;background:rgba(52,199,89,0.08);color:#34c759;border:1px solid rgba(52,199,89,0.15);border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">다시 테스트</button>
            <button onclick="this.closest('#pa-test-result-modal').remove()" style="padding:8px 14px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;cursor:pointer;color:rgba(0,0,0,0.45);">닫기</button>
          </div>
        </div>
      </div>
      <div style="flex:1;overflow:auto;padding:20px 24px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:320px;">
          <div style="display:flex;flex-direction:column;">
            <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:8px;">실행된 프롬프트 (변수 치환 후)</div>
            <div style="flex:1;padding:14px;background:#1e1e2e;color:#cdd6f4;border-radius:12px;font-size:12px;line-height:1.8;white-space:pre-wrap;overflow:auto;word-break:break-all;">${paEscapeHtml(resp.user_prompt_used || '').replace(/\\n/g, '\n')}</div>
          </div>
          <div style="display:flex;flex-direction:column;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.4);">AI 출력 결과</div>
              <button onclick="navigator.clipboard.writeText(document.getElementById('pa-test-output').textContent);toast('복사됨')" style="padding:4px 10px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:6px;font-size:11px;cursor:pointer;color:rgba(0,0,0,0.4);">복사</button>
            </div>
            <div id="pa-test-output" style="flex:1;padding:14px;background:rgba(52,199,89,0.04);border:1px solid rgba(52,199,89,0.12);border-radius:12px;font-size:13px;line-height:1.9;white-space:pre-wrap;overflow:auto;color:#1c1c1e;">${paEscapeHtml(output)}</div>
          </div>
        </div>
        <!-- 피드백 → AI 수정 영역 -->
        <div style="margin-top:18px;padding:18px;background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.12);border-radius:14px;">
          <div style="font-size:13px;font-weight:700;color:#ff8c00;margin-bottom:10px;">결과가 마음에 안 드나요? 피드백을 주면 AI가 프롬프트를 수정합니다</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <button onclick="document.getElementById('pa-test-feedback').value='결과가 너무 일반적이다. 더 구체적인 내용을 생성하도록 수정해줘'" class="pa-fb-chip" style="padding:6px 12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;font-size:11px;cursor:pointer;color:#ff8c00;">너무 일반적</button>
            <button onclick="document.getElementById('pa-test-feedback').value='글이 너무 짧다. 더 길고 상세하게 생성하도록 수정해줘'" class="pa-fb-chip" style="padding:6px 12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;font-size:11px;cursor:pointer;color:#ff8c00;">너무 짧음</button>
            <button onclick="document.getElementById('pa-test-feedback').value='톤이 맞지 않는다. 더 자연스럽고 사람이 쓴 것 같은 문체로 수정해줘'" class="pa-fb-chip" style="padding:6px 12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;font-size:11px;cursor:pointer;color:#ff8c00;">톤 안 맞음</button>
            <button onclick="document.getElementById('pa-test-feedback').value='참고자료의 내용이 제대로 반영되지 않았다. 소스 내용을 더 충실히 반영하도록 수정해줘'" class="pa-fb-chip" style="padding:6px 12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;font-size:11px;cursor:pointer;color:#ff8c00;">소스 미반영</button>
            <button onclick="document.getElementById('pa-test-feedback').value='브랜드/제품 홍보가 너무 강하다. 정보 전달 중심으로 수정해줘'" class="pa-fb-chip" style="padding:6px 12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;font-size:11px;cursor:pointer;color:#ff8c00;">홍보 과다</button>
          </div>
          <textarea id="pa-test-feedback" rows="2" placeholder="구체적인 피드백을 입력하세요 (예: 글 도입부가 너무 딱딱해요, 첫 문장을 질문으로 시작하게 해주세요)" style="width:100%;padding:10px 14px;border:1px solid rgba(255,140,0,0.18);border-radius:10px;font-size:13px;box-sizing:border-box;resize:vertical;background:#fff;"></textarea>
          <div style="display:flex;gap:10px;margin-top:10px;align-items:center;">
            <button id="pa-test-fix-btn" onclick="paFixPromptWithFeedback()" style="padding:10px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(255,140,0,0.25);display:flex;align-items:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              AI로 프롬프트 수정
            </button>
            <span id="pa-test-fix-status" style="font-size:12px;color:rgba(0,0,0,0.4);"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // 원본 프롬프트를 모달에 저장
  modal._originalPrompt = originalPrompt;
  modal._testOutput = output;
}

async function paFixPromptWithFeedback() {
  const modal = document.getElementById('pa-test-result-modal');
  if (!modal) return;
  const feedback = document.getElementById('pa-test-feedback')?.value?.trim();
  if (!feedback) { toast('피드백을 입력하세요', 'error'); return; }

  const originalPrompt = modal._originalPrompt || '';
  const testOutput = modal._testOutput || '';
  const btn = document.getElementById('pa-test-fix-btn');
  const status = document.getElementById('pa-test-fix-status');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 수정 중...'; }
  if (status) status.textContent = 'AI가 피드백을 분석하여 프롬프트를 수정하고 있습니다...';

  try {
    const resp = await api('/api/prompts/fix-with-feedback', {
      method: 'POST',
      body: {
        original_prompt: originalPrompt,
        test_output: testOutput,
        feedback,
        category: _paState.selectedCat,
      },
    });

    if (resp.fixed_prompt) {
      if (status) status.textContent = '';
      // 수정 전후 비교 표시
      paShowFixedPromptDiff(originalPrompt, resp.fixed_prompt, resp.changes_summary || '');
    } else {
      toast('수정 결과가 없습니다', 'error');
    }
  } catch (e) {
    toast('프롬프트 수정 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>AI로 프롬프트 수정'; }
    if (status) status.textContent = '';
  }
}

function paShowFixedPromptDiff(original, fixed, summary) {
  const existing = document.getElementById('pa-fix-diff-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'pa-fix-diff-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.52);display:flex;align-items:center;justify-content:center;padding:24px;';
  modal.innerHTML = `
    <div style="width:min(960px,calc(100vw - 48px));max-height:calc(100vh - 48px);background:#fff;border-radius:22px;box-shadow:0 25px 60px rgba(0,0,0,0.25);display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:22px 24px 16px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg,rgba(255,140,0,0.06),transparent);flex-shrink:0;">
        <div style="font-size:18px;font-weight:800;color:#1c1c1e;">프롬프트 수정 결과</div>
        ${summary ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);margin-top:6px;line-height:1.6;">${paEscapeHtml(summary)}</div>` : ''}
      </div>
      <div style="flex:1;overflow:auto;padding:20px 24px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;min-height:350px;">
          <div style="display:flex;flex-direction:column;">
            <div style="font-size:12px;font-weight:700;color:rgba(255,59,48,0.7);margin-bottom:8px;">수정 전</div>
            <div style="flex:1;padding:14px;background:rgba(255,59,48,0.03);border:1px solid rgba(255,59,48,0.1);border-radius:12px;font-size:12px;line-height:1.9;white-space:pre-wrap;overflow:auto;color:#1c1c1e;">${paEscapeHtml(original)}</div>
          </div>
          <div style="display:flex;flex-direction:column;">
            <div style="font-size:12px;font-weight:700;color:rgba(52,199,89,0.8);margin-bottom:8px;">수정 후</div>
            <div style="flex:1;padding:14px;background:rgba(52,199,89,0.03);border:1px solid rgba(52,199,89,0.1);border-radius:12px;font-size:12px;line-height:1.9;white-space:pre-wrap;overflow:auto;color:#1c1c1e;">${paEscapeHtml(fixed)}</div>
          </div>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid rgba(0,0,0,0.06);display:flex;gap:10px;justify-content:flex-end;flex-shrink:0;">
        <button onclick="this.closest('#pa-fix-diff-modal').remove()" style="padding:10px 20px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
        <button onclick="paApplyFixedPrompt(this)" style="padding:10px 28px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(255,140,0,0.3);">적용하고 다시 테스트</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  // 수정된 프롬프트 저장
  modal._fixedPrompt = fixed;
}

function paApplyFixedPrompt(btnEl) {
  const diffModal = document.getElementById('pa-fix-diff-modal');
  if (!diffModal) return;
  const fixed = diffModal._fixedPrompt || '';
  if (!fixed) return;

  // 에디터에 반영
  const ta = document.getElementById('pa-textarea');
  if (ta) { ta.value = fixed; paHighlightSync(); }
  paMarkDirty();
  paUpdatePreview();
  toast('수정된 프롬프트가 에디터에 적용되었습니다');

  // 모달들 닫기
  diffModal.remove();
  const resultModal = document.getElementById('pa-test-result-modal');
  if (resultModal) resultModal.remove();

  // 바로 다시 테스트
  setTimeout(() => paTestPrompt(), 300);
}

async function paImprovePrompt() {
  const ta = document.getElementById('pa-textarea');
  const content = ta ? ta.value : '';
  if (!content.trim()) { toast('개선할 프롬프트를 먼저 작성하세요', 'error'); return; }

  toast('AI가 프롬프트를 분석 중입니다...');
  try {
    const resp = await api('/api/prompts/improve', {
      method: 'POST',
      body: { content, category: _paState.selectedCat, subcategory: _paState.selectedSub }
    });
    if (resp.improved) {
      const ok = await showConfirm('AI 개선 결과를 적용하시겠습니까?');
      if (ok) {
        if (ta) { ta.value = resp.improved; paHighlightSync(); }
        paMarkDirty();
        paUpdatePreview();
        toast('AI 개선이 적용되었습니다');
      }
    }
  } catch (e) {
    toast('AI 개선 실패: ' + e.message, 'error');
  }
}

// ── 프롬프트 품질 점수 (별) ──
function paRenderQualityStars(content) {
  if (!content) return '<span style="color:rgba(0,0,0,0.2);">품질 -</span>';
  let score = 1;
  if (content.length > 50) score++;
  if (content.length > 200) score++;
  if (/\{[a-z_]+\}/.test(content)) score++;   // 변수 사용
  if (/금지|하지\s*마|않는다|절대/.test(content)) score++; // 금지 사항 포함
  score = Math.min(score, 5);
  const stars = Array.from({ length: 5 }, (_, i) =>
    `<svg viewBox="0 0 24 24" fill="${i < score ? '#ff8c00' : 'none'}" stroke="${i < score ? '#ff8c00' : 'rgba(0,0,0,0.15)'}" stroke-width="2" style="width:14px;height:14px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  ).join('');
  return `<span style="margin-right:4px;">${stars}</span><span>${score}/5</span>`;
}

// ── 저장 ──
function paSaveCurrentPrompt() {
  const ta = document.getElementById('pa-textarea');
  const content = ta ? ta.value : '';
  paSavePrompt(_paState.selectedCat, _paState.selectedSub, content, _paState.scope);
}

// ── 변경 표시 ──
function paMarkDirty() {
  _paState.dirty = true;
  const badge = document.getElementById('pa-dirty-badge');
  if (badge) badge.style.display = 'inline';
  // 품질 점수 업데이트
  const stars = document.getElementById('pa-quality-stars');
  const ta = document.getElementById('pa-textarea');
  if (stars && ta) stars.innerHTML = paRenderQualityStars(ta.value);
}

// ── 유틸 ──
function paEscapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
