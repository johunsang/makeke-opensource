// ============================================================
// 키워드 콘텐츠 — 상태 및 상수
// keyword_content/state.js (split from keyword_content.js)
// ============================================================

let _kcSearchData = null;  // 검색 결과
let _kcSelectedSources = [];  // 선택된 소스 [{title, snippet, url, checked, scrapedText}]
let _kcUploadedImages = [];  // [{filename, path, url}]
let _kcCurrentStep = 1;
let _kcBlogPostId = null;
let _kcProjectId = null;  // 콘텐츠 생성 시 발급된 프로젝트 ID
let _kcCardnewsDir = null;
let _kcComicPanels = [];   // [{panel_number, situation, dialogue, image_path, status}]
let _kcComicDir = '';      // 만화 프로젝트 디렉토리
let _kcComicId = null;     // DB comic_id
let _kcComicTopic = '';
let _kcComicStyle = 'cute';
let _kcVideoPath = '';  // 생성된 AI 영상 경로
let _kcVideoPathSlide = '';  // 생성된 슬라이드 영상 경로
let _kcHistoryRestoreMode = false;
let _kcPromptOverrides = {};
let _kcDetailPromptOverrides = [];
let _kcLastPromptSourceSummary = '';
let _kcLastPromptReviewSignature = '';
let _kcPromptReviewed = false;
let _kcPromptReviewOpening = false;

/** 블로그 이미지 슬롯 시스템 */
// 각 슬롯: { position: 'top'|'middle'|'bottom', role: '대표 이미지', url: '', filename: '' }
let _kcImageSlots = [];

const KC_IMAGE_POSITIONS = {
  top: '상단 (글 시작 전)',
  'after-1': '1번째 문단 뒤',
  'after-2': '2번째 문단 뒤',
  'after-3': '3번째 문단 뒤',
  'after-4': '4번째 문단 뒤',
  'after-5': '5번째 문단 뒤',
  middle: '본문 중간',
  'after-7': '7번째 문단 뒤',
  'after-9': '9번째 문단 뒤',
  bottom: '하단 (글 끝)',
};

// 업종별 이미지 슬롯 프리셋
const KC_BIZ_IMAGE_PRESETS = {
  _default: [
    { position: 'top', role: '대표 이미지' },
    { position: 'after-3', role: '본문 보충 이미지' },
    { position: 'after-7', role: '상세 설명 이미지' },
    { position: 'bottom', role: '마무리/CTA 이미지' },
  ],
  '성형외과': [
    { position: 'top', role: '대표 시술 이미지' },
    { position: 'after-2', role: '시술 전 (Before)' },
    { position: 'after-3', role: '시술 후 (After)' },
    { position: 'after-5', role: '시술 과정/장비' },
    { position: 'after-7', role: '원장 프로필/의료진' },
    { position: 'bottom', role: '병원 내부/상담 안내' },
  ],
  '치과': [
    { position: 'top', role: '대표 진료 이미지' },
    { position: 'after-2', role: '치료 전 상태' },
    { position: 'after-3', role: '치료 후 결과' },
    { position: 'after-5', role: '치료 과정 설명' },
    { position: 'bottom', role: '병원 안내/예약' },
  ],
  '피부과': [
    { position: 'top', role: '대표 시술 이미지' },
    { position: 'after-2', role: '시술 전 피부 상태' },
    { position: 'after-3', role: '시술 후 변화' },
    { position: 'after-5', role: '시술 장비/과정' },
    { position: 'bottom', role: '상담 안내' },
  ],
  '카페': [
    { position: 'top', role: '대표 메뉴/매장 이미지' },
    { position: 'after-2', role: '음료/디저트 클로즈업' },
    { position: 'after-4', role: '매장 분위기/인테리어' },
    { position: 'bottom', role: '위치/영업시간 안내' },
  ],
  '음식점': [
    { position: 'top', role: '대표 메뉴 이미지' },
    { position: 'after-2', role: '요리 과정/재료' },
    { position: 'after-4', role: '다른 메뉴/사이드' },
    { position: 'after-7', role: '매장 분위기' },
    { position: 'bottom', role: '위치/예약 안내' },
  ],
  '부동산': [
    { position: 'top', role: '매물 외관/전경' },
    { position: 'after-2', role: '내부 거실/주요 공간' },
    { position: 'after-3', role: '주방/욕실' },
    { position: 'after-5', role: '주변 환경/교통' },
    { position: 'after-7', role: '평면도/도면' },
    { position: 'bottom', role: '문의/상담 안내' },
  ],
  'IT/솔루션': [
    { position: 'top', role: '제품/서비스 대표 이미지' },
    { position: 'after-3', role: '기능 스크린샷/UI' },
    { position: 'after-5', role: '사용 사례/결과 그래프' },
    { position: 'bottom', role: '도입 문의/CTA' },
  ],
};

// ── 플랫폼/프롬프트 활성 세트 ──
let _kcActivePromptSetId = '';

// ── 프롬프트 필드 정의 ──
const KC_FIXED_PROMPT_FIELDS = {
  blog: ['system_prompt', 'customer_context', 'business_bridge', 'output_rules'],
  cardnews: ['system_prompt', 'customer_context', 'business_bridge', 'output_rules', 'image_prompt_template'],
  sns: ['system_prompt', 'customer_context', 'business_bridge', 'threads_rules', 'twitter_rules'],
  video: ['system_prompt', 'customer_context', 'business_bridge', 'visual_style', 'camera', 'mood', 'duration', 'negative'],
  comic: ['system_prompt', 'business_bridge', 'character_rules'],
  blog_image: ['design_rules', 'prompt_template'],
};

// ── 기타 런타임 상태 ──
let _sortTimers = {};
window._kcPrevSettings = null;
let _kcScrapedProduct = null;
let _kcManualUrls = [];
let _hoverPreview = null;
let _kcFinalImages = []; // [{url, source, selected}]
let _imgHoverEl = null;
window._kcBlogImages = [];
let _kcGenerating = false;
let _kcCnTexts = [];
let _kcCnCardnewsId = null;
let _kcCnGenerating = false;
let _kcSelectedDesignRef = ''; // 선택된 디자인 참조 이미지 URL
window._cnCarouselIdx = 0;
window._cnCarouselUrls = [];
let _kcImageBlogSlides = [];
let _kcImageBlogGenerating = false;
let _kcUploadAbort = null;
let _cdpUploadLock = false;


function kcApplyBizImagePreset() {
  const bizType = window._globalProfileData?.business_type || '';
  let preset = KC_BIZ_IMAGE_PRESETS[bizType];
  if (!preset) {
    for (const [key, val] of Object.entries(KC_BIZ_IMAGE_PRESETS)) {
      if (key !== '_default' && bizType && bizType.includes(key)) { preset = val; break; }
    }
  }
  if (!preset) preset = KC_BIZ_IMAGE_PRESETS._default;
  _kcImageSlots = preset.map(s => ({ ...s, url: '', filename: '' }));
  kcRenderImageSlots();
  toast(`${bizType || '기본'} 이미지 프리셋 적용 (${_kcImageSlots.length}개 슬롯)`);
}

function kcAddImageSlot() {
  _kcImageSlots.push({ position: 'middle', role: '', url: '', filename: '' });
  kcRenderImageSlots();
}

function kcRemoveImageSlot(idx) {
  _kcImageSlots.splice(idx, 1);
  kcRenderImageSlots();
}

function kcRenderImageSlots() {
  const container = document.getElementById('kc-image-slots');
  if (!container) return;
  if (_kcImageSlots.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.25);font-size:12px;">이미지 슬롯이 없습니다. "슬롯 추가" 또는 "업종 프리셋"을 눌러주세요</div>';
    return;
  }
  const posOptions = Object.entries(KC_IMAGE_POSITIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  container.innerHTML = _kcImageSlots.map((slot, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:10px;">
      <span style="font-size:11px;font-weight:700;color:#34c759;min-width:22px;">${i + 1}</span>
      <select onchange="_kcImageSlots[${i}].position=this.value" style="padding:4px 6px;font-size:10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;background:#fff;min-width:100px;">
        ${posOptions.replace(`value="${slot.position}"`, `value="${slot.position}" selected`)}
      </select>
      <input type="text" value="${escapeHtml(slot.role)}" onchange="_kcImageSlots[${i}].role=this.value" placeholder="용도 (예: 시술 전)" style="flex:1;padding:4px 8px;font-size:11px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;min-width:80px;">
      ${slot.url
        ? `<img src="${slot.url}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.08);cursor:pointer;" onclick="kcShowImagePreview(this.src)">`
        : `<button onclick="kcUploadSlotImage(${i})" style="width:36px;height:36px;border-radius:6px;background:rgba(52,199,89,0.08);border:1px dashed rgba(52,199,89,0.3);color:#34c759;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>`
      }
      <button onclick="kcRemoveImageSlot(${i})" style="width:24px;height:24px;border-radius:50%;background:rgba(255,59,48,0.08);color:#ff3b30;border:none;font-size:11px;cursor:pointer;flex-shrink:0;">✕</button>
    </div>
  `).join('');
}

function kcUploadSlotImage(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    try {
      const res = await fetch('/api/content/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        _kcImageSlots[idx].url = data.url;
        _kcImageSlots[idx].filename = input.files[0].name;
        kcRenderImageSlots();
      }
    } catch (e) { toast('업로드 실패: ' + e.message, 'error'); }
  };
  input.click();
}

// 슬롯에서 상단/본문/하단 이미지 분리 (발행 시 사용)
function kcGetSlotImages() {
  const header = [], body = [], footer = [];
  for (const slot of _kcImageSlots) {
    if (!slot.url) continue;
    if (slot.position === 'top') header.push(slot);
    else if (slot.position === 'bottom') footer.push(slot);
    else body.push(slot);
  }
  return { header, body, footer, all: _kcImageSlots.filter(s => s.url) };
}
