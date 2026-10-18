/* ============================================================
 *  이커머스 모듈 — h_web 서비스 통합
 *  배너, 상세페이지, 진단, 360뷰어, 광고영상, 로고, 스마트스토어,
 *  모델, 의상합성, 인플루언서, 아트, 만화, 인테리어, 펫, 펫의상
 * ============================================================ */

// ── 공통 유틸 ──────────────────────────────────────────────

const EC_STATE = {};

function ecOptionGrid(containerId, options, stateKey, defaultIdx = 0) {
  const el = document.getElementById(containerId);
  if (!el) return;
  EC_STATE[stateKey] = options[defaultIdx]?.value ?? '';
  el.innerHTML = options.map((o, i) => `
    <button type="button" class="${i === defaultIdx ? 'selected' : ''}" data-val="${o.value}" onclick="ecSelectOption('${containerId}','${stateKey}',this)">
      ${o.icon ? `<span class="ec-opt-icon">${o.icon}</span>` : ''}
      <span>${o.label}</span>
    </button>
  `).join('');
}

function ecSelectOption(containerId, stateKey, btn) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  EC_STATE[stateKey] = btn.dataset.val;
}

function ecSelectPopulate(selectId, options, stateKey) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  EC_STATE[stateKey] = options[0]?.value ?? '';
  el.onchange = () => { EC_STATE[stateKey] = el.value; };
}

async function ecFileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function ecShowLoading(containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="ec-loading-overlay">
      <div class="ec-spinner"></div>
      <p>${msg || 'AI가 생성 중입니다...'}</p>
    </div>`;
}

function ecRenderImages(containerId, images) {
  const container = document.getElementById(containerId);
  const valid = (images || []).filter(i => i && (i.url || typeof i === 'string'));
  if (!valid.length) {
    if (container) container.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:rgba(0,0,0,0.4);">이미지 생성 결과가 없습니다. 다시 시도해주세요.</div>`;
    toast('이미지 생성에 실패했습니다. API 키와 설정을 확인하세요.', 'error');
    return;
  }
  if (!container) return;
  container.innerHTML = valid.map((img, i) => `
    <div class="ec-result-card">
      <img src="${img.url || img}" alt="생성 결과 ${i + 1}">
      <div class="ec-result-actions">
        <button onclick="ecDownloadImage('${img.url || img}', 'result_${i + 1}.png')">다운로드</button>
      </div>
    </div>
  `).join('');
}

function ecDownloadImage(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function ecUploadPreview(inputEl, areaId) {
  const file = inputEl.files[0];
  if (!file) return;
  const area = document.getElementById(areaId);
  const reader = new FileReader();
  reader.onload = e => {
    area.innerHTML = `<img src="${e.target.result}" alt="preview">`;
    area.dataset.base64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

function ecMultiUploadPreview(inputEl, containerId, maxCount = 10) {
  const container = document.getElementById(containerId);
  const files = Array.from(inputEl.files);
  const existing = container.querySelectorAll('.ec-upload-thumb').length;
  if (existing + files.length > maxCount) {
    toast(`최대 ${maxCount}장까지 업로드 가능합니다`, 'error');
    return;
  }
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const thumb = document.createElement('div');
      thumb.className = 'ec-upload-thumb';
      thumb.dataset.base64 = e.target.result;
      thumb.innerHTML = `<img src="${e.target.result}"><button class="ec-remove" onclick="this.parentElement.remove()">×</button>`;
      container.insertBefore(thumb, container.querySelector('.ec-upload-area'));
    };
    reader.readAsDataURL(file);
  });
  inputEl.value = '';
}

function ecGetMultiImages(containerId) {
  return Array.from(document.getElementById(containerId).querySelectorAll('.ec-upload-thumb'))
    .map(t => t.dataset.base64);
}

// ── 배너 생성 ──────────────────────────────────────────────

const EC_BANNER_SIZES = [
  { icon: '◻', label: '1:1', value: '1:1' },
  { icon: '▬', label: '16:9', value: '16:9' },
  { icon: '▮', label: '9:16', value: '9:16' },
  { icon: '▭', label: '4:3', value: '4:3' },
  { icon: '▯', label: '3:4', value: '3:4' },
];
const EC_BANNER_MOODS = [
  { icon: '💼', label: '전문적', value: '전문적이고 미니멀한' },
  { icon: '⚡', label: '역동적', value: '활기차고 역동적인' },
  { icon: '✨', label: '고급스러운', value: '고급스럽고 우아한' },
  { icon: '🎀', label: '귀여운', value: '귀엽고 친근한' },
  { icon: '🚀', label: '테크', value: '미래지향적 테크' },
  { icon: '🖤', label: '강렬한', value: '어둡고 강렬한' },
  { icon: '🌿', label: '자연주의', value: '감성적인 자연주의' },
  { icon: '📻', label: '빈티지', value: '레트로 빈티지' },
  { icon: '🌈', label: '팝아트', value: '네온 팝아트' },
  { icon: '🧘', label: '차분한', value: '고요하고 차분한' },
  { icon: '📚', label: '신뢰감', value: '학구적인 신뢰감' },
  { icon: '🍭', label: '화사한', value: '달콤하고 화사한' },
];
const EC_BANNER_COLORS = [
  'AI 추천 (자동)', '파스텔 블루 & 화이트', '블랙 & 샴페인 골드', '딥 포레스트 그린 & 우드',
  '미드나잇 퍼플 & 네온 핑크', '코랄 & 민트 그린', '모노톤 (그레이/차콜)', '웜톤 & 옐로우 선셋',
  '화이트 & 실버 메탈릭', '베이지 & 테라코타', '라벤더 & 크림 화이트', '네이비 & 화이트 & 웜톤',
  '피치 & 소프트 브라운', '틸 & 레몬 옐로우', '다크 그린 & 로즈 골드', '체리 레드 & 블랙',
  '스카이 블루 & 핑크', '올리브 & 크림', '버건디 & 골드', '아쿠아 & 화이트'
];
const EC_BANNER_BG = [
  { icon: '🎨', label: '단색', value: '깨끗한 단색' },
  { icon: '🌅', label: '그라데이션', value: '부드러운 그라데이션' },
  { icon: '🎭', label: '추상화', value: '감각적인 추상화' },
  { icon: '📸', label: '실사', value: '생생한 실사 사진' },
  { icon: '🧱', label: '질감', value: '미니멀한 질감' },
  { icon: '🔮', label: '3D', value: '입체적인 3D 렌더링' },
  { icon: '🔷', label: '기하학', value: '기하학적 패턴' },
  { icon: '✨', label: '보케', value: '빛나는 보케 효과' },
  { icon: '🌫', label: '감성', value: '흐릿한 감성 배경' },
  { icon: '📜', label: '종이', value: '종이 질감' },
  { icon: '🏙', label: '건축물', value: '모던한 건축물 배경' },
  { icon: '🌿', label: '자연', value: '차분한 자연 풍경' },
];

function ecBannerInit() {
  ecOptionGrid('ec-banner-sizes', EC_BANNER_SIZES, 'bannerSize', 1);
  ecOptionGrid('ec-banner-moods', EC_BANNER_MOODS, 'bannerMood', 0);
  ecOptionGrid('ec-banner-bg', EC_BANNER_BG, 'bannerBg', 0);
  const sel = document.getElementById('ec-banner-color');
  if (sel) sel.innerHTML = EC_BANNER_COLORS.map(c => `<option value="${c}">${c}</option>`).join('');
}

function ecBannerLogoChanged(input) { ecUploadPreview(input, 'ec-banner-logo-area'); }

async function ecBannerGenerate() {
  const name = document.getElementById('ec-banner-name').value.trim();
  const text = document.getElementById('ec-banner-text').value.trim();
  if (!name || !text) return toast('브랜드명과 배너 텍스트를 입력하세요', 'error');
  const body = {
    name, bannerText: text,
    size: EC_STATE.bannerSize, mood: EC_STATE.bannerMood,
    colorScheme: document.getElementById('ec-banner-color').value,
    backgroundType: EC_STATE.bannerBg,
    additionalInstructions: document.getElementById('ec-banner-extra').value,
    draftCount: parseInt(document.getElementById('ec-banner-count').value) || 2,
    logoBase64: document.getElementById('ec-banner-logo-area').dataset?.base64 || null,
  };
  ecShowLoading('ec-banner-results', 'AI가 배너를 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/banner/generate', { method: 'POST', body });
    ecRenderImages('ec-banner-results', res.images || []);
    if ((res.images || []).length) toast('배너 생성 완료!');
  } catch (e) { document.getElementById('ec-banner-results').innerHTML = ''; toast('배너 생성 실패: ' + e.message, 'error'); }
}

// ── 상세페이지 생성 ──────────────────────────────────────────

const EC_DP_STYLES = [
  { icon: '◻', label: '미니멀', value: 'minimal' }, { icon: '💎', label: '럭셔리', value: 'luxury' },
  { icon: '📐', label: '모던', value: 'modern' }, { icon: '🌿', label: '내추럴', value: 'natural' },
  { icon: '🎯', label: '플레이풀', value: 'playful' }, { icon: '💼', label: '프로', value: 'professional' },
  { icon: '🔥', label: '트렌디', value: 'trendy' }, { icon: '📻', label: '빈티지', value: 'vintage' },
];
const EC_DP_COLORS = [
  { icon: '⬜', label: '화이트', value: 'white' }, { icon: '⬛', label: '블랙', value: 'black' },
  { icon: '🩷', label: '파스텔', value: 'pastel' }, { icon: '🔴', label: '비비드', value: 'vivid' },
  { icon: '🟤', label: '어스톤', value: 'earth' }, { icon: '🔘', label: '모노톤', value: 'mono' },
  { icon: '🟠', label: '웜톤', value: 'warm' }, { icon: '🔵', label: '쿨톤', value: 'cool' },
];
const EC_DP_MOODS = [
  { icon: '🤝', label: '신뢰감', value: 'trust' }, { icon: '💕', label: '설레는', value: 'exciting' },
  { icon: '🧘', label: '차분한', value: 'calm' }, { icon: '⚡', label: '활기찬', value: 'energetic' },
  { icon: '👑', label: '우아한', value: 'elegant' }, { icon: '😊', label: '친근한', value: 'friendly' },
  { icon: '🚀', label: '혁신적', value: 'innovative' }, { icon: '💚', label: '진정성', value: 'authentic' },
];
const EC_DP_TARGETS = [
  { icon: '👩', label: '20대 여성', value: '20f' }, { icon: '👩‍💼', label: '30대 여성', value: '30f' },
  { icon: '🧑‍💼', label: '40대+ 여성', value: '40f' }, { icon: '👨', label: '20대 남성', value: '20m' },
  { icon: '👨‍💼', label: '30대 남성', value: '30m' }, { icon: '👨‍👩‍👧', label: '부모님', value: 'parent' },
  { icon: '🧓', label: '시니어', value: 'senior' }, { icon: '🌐', label: '전연령', value: 'all' },
];

function ecDpInit() {
  ecOptionGrid('ec-dp-styles', EC_DP_STYLES, 'dpStyle', 0);
  ecOptionGrid('ec-dp-colors', EC_DP_COLORS, 'dpColor', 0);
  ecOptionGrid('ec-dp-moods', EC_DP_MOODS, 'dpMood', 0);
  ecOptionGrid('ec-dp-targets', EC_DP_TARGETS, 'dpTarget', 7);
}

function ecDpImagesChanged(input) { ecMultiUploadPreview(input, 'ec-dp-images', 5); }

async function ecDpGenerate() {
  const name = document.getElementById('ec-dp-name').value.trim();
  const desc = document.getElementById('ec-dp-desc').value.trim();
  if (!name || !desc) return toast('상품명과 설명을 입력하세요', 'error');
  const body = {
    productName: name, productDescription: desc,
    productImages: ecGetMultiImages('ec-dp-images'),
    pageCount: parseInt(document.getElementById('ec-dp-pages').value),
    style: EC_STATE.dpStyle, colorScheme: EC_STATE.dpColor,
    mood: EC_STATE.dpMood, targetAudience: EC_STATE.dpTarget,
    additionalPrompt: document.getElementById('ec-dp-extra').value,
  };
  ecShowLoading('ec-dp-results', 'AI가 상세페이지를 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/detailpage/generate', { method: 'POST', body });
    ecRenderImages('ec-dp-results', res.images || []);
    if ((res.images || []).length) toast('상세페이지 생성 완료!');
  } catch (e) { document.getElementById('ec-dp-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 상세페이지 진단 ──────────────────────────────────────────

function ecRebuildImagesChanged(input) { ecMultiUploadPreview(input, 'ec-rebuild-images', 20); }

async function ecRebuildDiagnose() {
  const images = ecGetMultiImages('ec-rebuild-images');
  if (!images.length) return toast('이미지를 업로드하세요', 'error');
  ecShowLoading('ec-rebuild-results', 'AI가 상세페이지를 분석하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/rebuild/diagnose', { method: 'POST', body: { images } });
    const r = res.report;
    const gradeClass = r.overallGrade === 'A' ? 'ec-score-a' : r.overallGrade === 'B' ? 'ec-score-b' : r.overallGrade === 'C' ? 'ec-score-c' : 'ec-score-d';
    let html = `<div class="ec-diagnosis-card">
      <h3>전체 진단 결과</h3>
      <div class="ec-diagnosis-score ${gradeClass}">${r.overallGrade}등급 (${r.overallScore}점/100)</div>
      <p style="margin-top:12px;font-size:13px;color:rgba(0,0,0,0.6);">${r.summary}</p>
    </div>`;
    if (r.categoryScores) {
      r.categoryScores.forEach(c => {
        const cg = c.grade === 'A' ? 'ec-score-a' : c.grade === 'B' ? 'ec-score-b' : c.grade === 'C' ? 'ec-score-c' : 'ec-score-d';
        html += `<div class="ec-diagnosis-card">
          <h3>${c.categoryName} <span class="ec-diagnosis-score ${cg}">${c.grade} (${c.score}/${c.maxScore})</span></h3>
          ${c.improvements ? `<ul style="margin-top:8px;font-size:12px;color:rgba(0,0,0,0.55);padding-left:16px;">${c.improvements.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
        </div>`;
      });
    }
    if (r.quickWins?.length) {
      html += `<div class="ec-diagnosis-card"><h3>빠른 개선 포인트</h3><ul style="font-size:13px;padding-left:16px;">${r.quickWins.map(q => `<li>${q}</li>`).join('')}</ul></div>`;
    }
    document.getElementById('ec-rebuild-results').innerHTML = html;
    toast('진단 완료!');
  } catch (e) { document.getElementById('ec-rebuild-results').innerHTML = ''; toast('진단 실패: ' + e.message, 'error'); }
}

// ── 360도 뷰어 ──────────────────────────────────────────────

const EC_ROTATE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const EC_ROTATE_BG = [
  { icon: '⬜', label: '화이트', value: 'white' },
  { icon: '⬛', label: '블랙', value: 'black' },
  { icon: '🔘', label: '그레이', value: 'gray' },
];
const EC_ROTATE_SPEED = [
  { label: '느리게', value: 'slow' }, { label: '보통', value: 'normal' }, { label: '빠르게', value: 'fast' },
];
const EC_ROTATE_DURATION = [
  { label: '4초', value: '4' }, { label: '6초', value: '6' }, { label: '8초', value: '8' },
];

function ecRotateInit() {
  const container = document.getElementById('ec-rotate-angles');
  if (container && !container.children.length) {
    container.innerHTML = EC_ROTATE_ANGLES.map(a => `
      <div style="text-align:center;">
        <div class="ec-upload-area" id="ec-rotate-angle-${a}" onclick="document.getElementById('ec-rotate-file-${a}').click()" style="min-height:70px;padding:10px;">
          <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">${a}°</span>
        </div>
        <input type="file" id="ec-rotate-file-${a}" accept="image/*" style="display:none;" onchange="ecUploadPreview(this,'ec-rotate-angle-${a}')">
      </div>
    `).join('');
  }
  ecOptionGrid('ec-rotate-bg', EC_ROTATE_BG, 'rotateBg', 0);
  ecOptionGrid('ec-rotate-speed', EC_ROTATE_SPEED, 'rotateSpeed', 1);
  ecOptionGrid('ec-rotate-duration', EC_ROTATE_DURATION, 'rotateDuration', 1);
}

async function ecRotateGenerate() {
  const images = {};
  EC_ROTATE_ANGLES.forEach(a => {
    const area = document.getElementById(`ec-rotate-angle-${a}`);
    if (area?.dataset?.base64) images[a] = area.dataset.base64;
  });
  if (Object.keys(images).length < 2) return toast('최소 2방향의 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-rotate-results', 'AI가 360도 영상을 생성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/rotate360/generate', { method: 'POST', body: {
      angleImages: images, backgroundColor: EC_STATE.rotateBg,
      rotationSpeed: EC_STATE.rotateSpeed, videoDuration: EC_STATE.rotateDuration
    }});
    document.getElementById('ec-rotate-results').innerHTML = res.videoUrl
      ? `<div class="card" style="text-align:center;"><video src="${res.videoUrl}" controls autoplay loop style="max-width:100%;border-radius:12px;"></video></div>`
      : '<p style="text-align:center;color:rgba(0,0,0,0.4);">결과가 없습니다</p>';
    toast('360도 영상 생성 완료!');
  } catch (e) { document.getElementById('ec-rotate-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 광고 영상 ──────────────────────────────────────────────

const EC_ADV_DURATION = [
  { label: '4초', value: '4' }, { label: '5초', value: '5' }, { label: '6초', value: '6' }, { label: '8초', value: '8' },
];
const EC_ADV_RATIO = [
  { icon: '▮', label: '9:16', value: '9:16' }, { icon: '▬', label: '16:9', value: '16:9' }, { icon: '◻', label: '1:1', value: '1:1' },
];
const EC_ADV_MOOD = [
  { icon: '💎', label: '프리미엄', value: 'premium' }, { icon: '🎀', label: '귀여운', value: 'cute' },
  { icon: '◻', label: '깔끔한', value: 'clean' }, { icon: '⚡', label: '역동적', value: 'dynamic' },
  { icon: '📹', label: '다큐', value: 'documentary' },
];
const EC_ADV_PRODUCT_TYPE = [
  { icon: '👗', label: '패션', value: 'fashion' }, { icon: '💄', label: '뷰티', value: 'beauty' },
  { icon: '🍎', label: '식품', value: 'food' }, { icon: '📱', label: '전자', value: 'electronics' },
  { icon: '🏠', label: '홈/리빙', value: 'home' }, { icon: '📦', label: '기타', value: 'etc' },
];
const EC_ADV_TEXT_STYLE = [
  { label: '없음', value: 'none' }, { label: '미니멀', value: 'minimal' },
  { label: '볼드', value: 'bold' }, { label: '우아한', value: 'elegant' }, { label: '다이나믹', value: 'dynamic' },
];
const EC_ADV_VIDEO_STYLE = [
  { icon: '🎬', label: '시네마틱', value: 'cinematic' }, { icon: '💨', label: '액션', value: 'action' },
  { icon: '😂', label: '코미디', value: 'comedy' }, { icon: '💕', label: '감성적', value: 'emotional' },
  { icon: '◻', label: '미니멀', value: 'minimal' }, { icon: '💎', label: '럭셔리', value: 'luxury' },
  { icon: '🔥', label: '트렌디', value: 'trendy' }, { icon: '📖', label: '스토리텔링', value: 'storytelling' },
  { icon: '📋', label: '튜토리얼', value: 'tutorial' }, { icon: '🔄', label: '비포애프터', value: 'before_after' },
];
const EC_ADV_GOAL = [
  { icon: '🎯', label: '관심끌기', value: 'hook' }, { icon: '📢', label: '설명', value: 'explain' },
  { icon: '✅', label: '증거', value: 'proof' }, { icon: '🛒', label: '행동유도', value: 'cta' },
];
const EC_ADV_QUALITY = [
  { label: '720p HD', value: '720p' }, { label: '1080p FHD', value: '1080p' },
];
const EC_ADV_AD_CONCEPT = [
  { icon: '🍎', label: 'Apple 미니멀', value: 'apple' }, { icon: '✓', label: 'Nike Just Do It', value: 'nike' },
  { icon: '🧴', label: 'Old Spice 유쾌', value: 'oldspice' }, { icon: '🥤', label: 'Coca-Cola 행복', value: 'cocacola' },
  { icon: '📱', label: 'Samsung 테크', value: 'samsung' }, { icon: '📹', label: 'GoPro 액션', value: 'gopro' },
  { icon: '🏷', label: 'MUJI 무인양품', value: 'muji' }, { icon: '🐂', label: 'Red Bull 에너지', value: 'redbull' },
];

function ecAdvInit() {
  ecOptionGrid('ec-adv-duration', EC_ADV_DURATION, 'advDuration', 0);
  ecOptionGrid('ec-adv-ratio', EC_ADV_RATIO, 'advRatio', 0);
  ecOptionGrid('ec-adv-mood', EC_ADV_MOOD, 'advMood', 0);
  ecOptionGrid('ec-adv-product-type', EC_ADV_PRODUCT_TYPE, 'advProductType', 0);
  ecOptionGrid('ec-adv-text-style', EC_ADV_TEXT_STYLE, 'advTextStyle', 0);
}

function ecAdvImageChanged(input) { ecUploadPreview(input, 'ec-adv-img-area'); }

async function ecAdvGenerate() {
  const name = document.getElementById('ec-adv-name').value.trim();
  if (!name) return toast('상품명을 입력하세요', 'error');
  ecShowLoading('ec-adv-results', 'AI가 광고 영상을 제작하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/advideo/generate', { method: 'POST', body: {
      productName: name,
      productDescription: document.getElementById('ec-adv-desc').value,
      productImage: document.getElementById('ec-adv-img-area').dataset?.base64 || null,
      duration: EC_STATE.advDuration, aspectRatio: EC_STATE.advRatio,
      mood: EC_STATE.advMood, productType: EC_STATE.advProductType,
      textStyle: EC_STATE.advTextStyle,
      additionalPrompt: document.getElementById('ec-adv-extra').value,
    }});
    document.getElementById('ec-adv-results').innerHTML = res.videoUrl
      ? `<div class="card" style="text-align:center;"><video src="${res.videoUrl}" controls autoplay style="max-width:100%;border-radius:12px;"></video></div>`
      : (res.images?.length ? '' : '<p style="text-align:center;color:rgba(0,0,0,0.4);">결과가 없습니다</p>');
    if (res.images?.length) ecRenderImages('ec-adv-results', res.images);
    toast('광고 영상 생성 완료!');
  } catch (e) { document.getElementById('ec-adv-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 로고 생성 ──────────────────────────────────────────────

const EC_LOGO_TYPES = [
  { icon: '◉', label: '심볼만', value: 'symbol' }, { icon: 'Aa', label: '워드마크', value: 'wordmark' },
  { icon: '◉A', label: '콤비', value: 'combination' }, { icon: '⊞', label: '스택', value: 'stacked' },
  { icon: '🛡', label: '엠블럼', value: 'emblem' }, { icon: 'A', label: '레터마크', value: 'lettermark' },
  { icon: '🐻', label: '마스코트', value: 'mascot' }, { icon: '◎', label: '추상', value: 'abstract' },
  { icon: '▣', label: '네거티브', value: 'negative_space' }, { icon: '🎬', label: '애니', value: 'animation' },
];
const EC_LOGO_STYLES = [
  { icon: '—', label: '미니멀', value: 'minimalist' }, { icon: '◇', label: '모던', value: 'modern' },
  { icon: '⚜', label: '클래식', value: 'classic' }, { icon: '★', label: '플레이풀', value: 'playful' },
  { icon: '♦', label: '럭셔리', value: 'luxury' }, { icon: '⬢', label: '테크', value: 'tech' },
  { icon: '❀', label: '오가닉', value: 'organic' }, { icon: '△', label: '지오메트릭', value: 'geometric' },
  { icon: '❧', label: '빈티지', value: 'vintage' }, { icon: '▌', label: '볼드', value: 'bold' },
  { icon: '✎', label: '핸드라이팅', value: 'handwritten' }, { icon: '◐', label: '그라디언트', value: 'gradient' },
  { icon: '✧', label: '네온', value: 'neon' }, { icon: '🌿', label: '내추럴', value: 'natural' },
  { icon: '💼', label: '프로', value: 'professional' }, { icon: '🔥', label: '트렌디', value: 'trendy' },
  { icon: '🎨', label: '아트', value: 'artistic' }, { icon: '🏢', label: '코퍼레이트', value: 'corporate' },
];

function ecLogoInit() {
  ecOptionGrid('ec-logo-types', EC_LOGO_TYPES, 'logoType', 0);
  ecOptionGrid('ec-logo-styles', EC_LOGO_STYLES, 'logoStyle', 0);
}

async function ecLogoGenerate() {
  const brand = document.getElementById('ec-logo-brand').value.trim();
  if (!brand) return toast('브랜드명을 입력하세요', 'error');
  ecShowLoading('ec-logo-results', 'AI가 로고를 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/logo/generate', { method: 'POST', body: {
      brandName: brand, text: document.getElementById('ec-logo-text').value,
      logoType: EC_STATE.logoType, designStyle: EC_STATE.logoStyle,
      additionalInstructions: document.getElementById('ec-logo-extra').value,
      count: parseInt(document.getElementById('ec-logo-count').value) || 4,
    }});
    ecRenderImages('ec-logo-results', res.images || []);
    if ((res.images || []).length) toast('로고 생성 완료!');
  } catch (e) { document.getElementById('ec-logo-results').innerHTML = ''; toast('로고 생성 실패: ' + e.message, 'error'); }
}

// ── 스마트스토어 브랜딩 ──────────────────────────────────────

let _ecSsState = { step: 1, prefs: {}, names: [], slogans: [], logos: [], selection: {} };

function ecSsInit() {
  const indicator = document.getElementById('ec-ss-step-indicator');
  if (indicator) {
    indicator.innerHTML = [1,2,3,4,5].map(s =>
      `<div class="ec-ss-step-dot ${s === 1 ? 'active' : ''}" id="ec-ss-dot-${s}">${s}</div>`
    ).join('');
  }
}

function ecSsSetStep(n) {
  _ecSsState.step = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`ec-ss-step${i}`);
    if (el) el.style.display = i === n ? '' : 'none';
    const dot = document.getElementById(`ec-ss-dot-${i}`);
    if (dot) { dot.className = 'ec-ss-step-dot' + (i < n ? ' done' : i === n ? ' active' : ''); }
  }
}

function ecSsBack(step) { ecSsSetStep(step); }

async function ecSsStart() {
  const category = document.getElementById('ec-ss-category').value.trim();
  if (!category) return toast('카테고리를 입력하세요', 'error');
  _ecSsState.prefs = {
    category,
    targetAudience: document.getElementById('ec-ss-target').value,
    vibe: document.getElementById('ec-ss-vibe').value,
    extraDetails: document.getElementById('ec-ss-extra').value,
  };
  toast('스토어명 생성 중...', 'info');
  try {
    const res = await api('/api/ecommerce/smartstore/names', { method: 'POST', body: _ecSsState.prefs });
    _ecSsState.names = res.names || [];
    const container = document.getElementById('ec-ss-names');
    container.innerHTML = _ecSsState.names.map(n =>
      `<button onclick="ecSsSelectName('${n.replace(/'/g, "\\'")}')">${n}</button>`
    ).join('');
    ecSsSetStep(2);
  } catch (e) { toast('생성 실패: ' + e.message, 'error'); }
}

async function ecSsSelectName(name) {
  _ecSsState.selection.name = name;
  toast('슬로건 생성 중...', 'info');
  try {
    const res = await api('/api/ecommerce/smartstore/slogans', { method: 'POST', body: { name, prefs: _ecSsState.prefs }});
    _ecSsState.slogans = res.slogans || [];
    document.getElementById('ec-ss-slogans').innerHTML = _ecSsState.slogans.map(s =>
      `<button class="btn btn-secondary" style="text-align:left;white-space:normal;" onclick="ecSsSelectSlogan('${s.replace(/'/g, "\\'")}')">${s}</button>`
    ).join('');
    ecSsSetStep(3);
  } catch (e) { toast('슬로건 생성 실패: ' + e.message, 'error'); }
}

async function ecSsSelectSlogan(slogan) {
  _ecSsState.selection.slogan = slogan;
  toast('로고 디자인 중...', 'info');
  try {
    const res = await api('/api/ecommerce/smartstore/logos', { method: 'POST', body: { name: _ecSsState.selection.name, slogan, prefs: _ecSsState.prefs }});
    _ecSsState.logos = res.images || [];
    document.getElementById('ec-ss-logos').innerHTML = _ecSsState.logos.map((img, i) => `
      <div class="ec-result-card" style="cursor:pointer;" onclick="ecSsSelectLogo('${typeof img === 'string' ? img : img.url}')">
        <img src="${typeof img === 'string' ? img : img.url}" alt="로고 ${i+1}">
      </div>
    `).join('');
    ecSsSetStep(4);
  } catch (e) { toast('로고 생성 실패: ' + e.message, 'error'); }
}

async function ecSsSelectLogo(logoUrl) {
  _ecSsState.selection.logoUrl = logoUrl;
  toast('최종 브랜딩 에셋 생성 중...', 'info');
  try {
    const res = await api('/api/ecommerce/smartstore/finalize', { method: 'POST', body: { selection: _ecSsState.selection, prefs: _ecSsState.prefs }});
    let html = '';
    if (res.assets) {
      const a = res.assets;
      html += `<div class="card" style="margin-bottom:16px;">
        <h3>${_ecSsState.selection.name}</h3>
        <p style="color:rgba(0,0,0,0.5);font-size:13px;">${_ecSsState.selection.slogan}</p>
        ${a.description ? `<p style="margin-top:8px;font-size:13px;">${a.description}</p>` : ''}
        ${a.keywords?.length ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${a.keywords.map(k => `<span style="padding:2px 8px;background:rgba(var(--accent-rgb),0.08);border-radius:12px;font-size:11px;">${k}</span>`).join('')}</div>` : ''}
      </div>`;
      const imgs = [a.mobileLogoUrl, a.pcLogoUrl, a.mainBannerUrl, a.promoBannerUrl].filter(Boolean);
      html += imgs.map((url, i) => `<div class="ec-result-card"><img src="${url}" alt="에셋 ${i+1}"><div class="ec-result-actions"><button onclick="ecDownloadImage('${url}','asset_${i+1}.png')">다운로드</button></div></div>`).join('');
    }
    document.getElementById('ec-ss-final').innerHTML = html || '<p>결과가 없습니다</p>';
    ecSsSetStep(5);
    toast('브랜딩 에셋 완성!');
  } catch (e) { toast('생성 실패: ' + e.message, 'error'); }
}

// ── 모델 생성 ──────────────────────────────────────────────

const EC_MODEL_GENDER = [ { icon: '👩', label: '여성', value: 'female' }, { icon: '👨', label: '남성', value: 'male' } ];
const EC_MODEL_AGE = [
  { icon: '🌱', label: '10대 후반', value: 'late_10s' }, { icon: '🌿', label: '20대 초반', value: 'early_20s' },
  { icon: '🍀', label: '20대 중반', value: 'mid_20s' }, { icon: '🌲', label: '20대 후반', value: 'late_20s' },
  { icon: '🌳', label: '30대 초반', value: 'early_30s' }, { icon: '🪴', label: '30대 중반', value: 'mid_30s' },
  { icon: '🍂', label: '40대', value: 'early_40s' }, { icon: '🍁', label: '50대', value: 'early_50s' },
  { icon: '🌾', label: '60대', value: 'early_60s' },
];
const EC_MODEL_STYLE_FEMALE = [
  { icon: '🌸', label: '청순', value: 'innocent' }, { icon: '🎀', label: '큐트', value: 'cute' },
  { icon: '👑', label: '엘레강스', value: 'elegant' }, { icon: '🔥', label: '섹시', value: 'sexy' },
  { icon: '🖤', label: '시크', value: 'chic' }, { icon: '🌿', label: '내추럴', value: 'natural' },
  { icon: '⚡', label: '스포티', value: 'sporty' }, { icon: '💎', label: '럭셔리', value: 'luxury' },
  { icon: '💕', label: '러블리', value: 'lovely' }, { icon: '🍋', label: '프레시', value: 'fresh' },
  { icon: '✨', label: '여신', value: 'goddess' }, { icon: '💪', label: '걸크러시', value: 'girl_crush' },
];
const EC_MODEL_STYLE_MALE = [
  { icon: '🎩', label: '댄디', value: 'dandy' }, { icon: '🖤', label: '시크', value: 'chic' },
  { icon: '🌿', label: '내추럴', value: 'natural' }, { icon: '⚡', label: '스포티', value: 'sporty' },
  { icon: '💎', label: '럭셔리', value: 'luxury' }, { icon: '💪', label: '남성미', value: 'masculine' },
  { icon: '🤵', label: '젠틀', value: 'gentle' }, { icon: '😎', label: '배드보이', value: 'bad_boy' },
  { icon: '☀', label: '따뜻한', value: 'warm' }, { icon: '🔥', label: '카리스마', value: 'charisma' },
  { icon: '💼', label: '프로페셔널', value: 'professional' }, { icon: '🎨', label: '아티스틱', value: 'artistic' },
];
const EC_MODEL_ETHNICITY = [
  { icon: '🇰🇷', label: '한국인', value: 'korean' }, { icon: '🌏', label: '동양인', value: 'asian' },
  { icon: '🌎', label: '서양인', value: 'western' }, { icon: '🌍', label: '흑인', value: 'black' },
];
const EC_MODEL_HAIR_FEMALE = [
  { label: '긴 생머리', value: 'long_straight' }, { label: '긴 웨이브', value: 'long_wave' },
  { label: '긴 컬', value: 'long_curl' }, { label: '미디엄 스트레이트', value: 'medium_straight' },
  { label: '미디엄 웨이브', value: 'medium_wave' }, { label: '단발 보브', value: 'bob' },
  { label: '숏 보브', value: 'short_bob' }, { label: '레이어드 컷', value: 'layered' },
  { label: '뱅 헤어', value: 'bangs' }, { label: '시스루 뱅', value: 'see_through_bangs' },
  { label: '포니테일', value: 'ponytail' }, { label: '하이 포니테일', value: 'high_ponytail' },
  { label: '로우 포니테일', value: 'low_ponytail' }, { label: '트윈테일', value: 'twin_tail' },
  { label: '반묶음', value: 'half_up' }, { label: '업스타일', value: 'updo' },
  { label: '번 헤어', value: 'bun' }, { label: '브레이드', value: 'braid' },
  { label: '피쉬테일', value: 'fishtail' }, { label: '히피펌', value: 'hippie_perm' },
  { label: '물결펌', value: 'wave_perm' }, { label: '볼륨펌', value: 'volume_perm' },
  { label: '숏컷', value: 'short' }, { label: '픽시컷', value: 'pixie' },
  { label: '허쉬컷', value: 'hush_cut' }, { label: '울프컷', value: 'wolf_cut' },
];
const EC_MODEL_HAIR_MALE = [
  { label: '투블럭', value: 'two_block' }, { label: '포마드', value: 'pomade' },
  { label: '댄디컷', value: 'dandy' }, { label: '리젠트컷', value: 'regent' },
  { label: '가르마펌', value: 'side_part_perm' }, { label: '다운펌', value: 'down_perm' },
  { label: '애즈펌', value: 'as_perm' }, { label: '쉐도우펌', value: 'shadow_perm' },
  { label: '스왈로펌', value: 'swallow_perm' }, { label: '리프컷', value: 'leaf_cut' },
  { label: '크롭컷', value: 'crop' }, { label: '버즈컷', value: 'buzz' },
  { label: '숏컷', value: 'short' }, { label: '미디엄', value: 'medium' },
  { label: '슬릭백', value: 'slick_back' }, { label: '센터파트', value: 'center_part' },
  { label: '머쉬룸컷', value: 'mushroom' }, { label: '울프컷', value: 'wolf' },
];
const EC_MODEL_HAIR_COLOR = [
  { label: '자연 블랙', value: 'natural_black' }, { label: '다크 브라운', value: 'dark_brown' },
  { label: '미디엄 브라운', value: 'medium_brown' }, { label: '라이트 브라운', value: 'light_brown' },
  { label: '체스트넛', value: 'chestnut' }, { label: '카라멜', value: 'caramel' },
  { label: '블론드', value: 'blonde' }, { label: '플래티넘', value: 'platinum' },
  { label: '허니블론드', value: 'honey_blonde' }, { label: '애쉬블론드', value: 'ash_blonde' },
  { label: '레드', value: 'red' }, { label: '오번', value: 'auburn' },
  { label: '핑크', value: 'pink' }, { label: '퍼플', value: 'purple' },
  { label: '블루', value: 'blue' }, { label: '실버', value: 'silver' },
  { label: '옴브레', value: 'ombre' }, { label: '발레야주', value: 'balayage' },
];
const EC_MODEL_SKIN = [
  { label: '포슬린', value: 'porcelain' }, { label: '아이보리', value: 'ivory' },
  { label: '페어', value: 'fair' }, { label: '라이트 핑크', value: 'light_pink' },
  { label: '미디엄', value: 'medium' }, { label: '내추럴 베이지', value: 'natural_beige' },
  { label: '웜 베이지', value: 'warm_beige' }, { label: '올리브', value: 'olive' },
  { label: '허니', value: 'honey' }, { label: '탠', value: 'tan' },
  { label: '골든', value: 'golden' }, { label: '카라멜', value: 'caramel' },
  { label: '브론즈', value: 'bronze' }, { label: '모카', value: 'mocha' },
  { label: '에스프레소', value: 'espresso' }, { label: '초콜릿', value: 'chocolate' },
];
const EC_MODEL_HEIGHT = [
  { icon: '📍', label: '150cm대', value: '150' }, { icon: '📏', label: '160cm대', value: '160' },
  { icon: '📐', label: '170cm대', value: '170' }, { icon: '📊', label: '180cm대', value: '180' },
];
const EC_MODEL_BODY = [
  { icon: '🧍', label: '슬림', value: 'slim' }, { icon: '💃', label: '모델 체형', value: 'model' },
  { icon: '💪', label: '탄탄한', value: 'athletic' }, { icon: '⏳', label: '글래머', value: 'curvy' },
  { icon: '🏋', label: '근육질', value: 'muscular' },
];

function ecModelInit() {
  ecOptionGrid('ec-model-gender', EC_MODEL_GENDER, 'modelGender', 0);
  ecOptionGrid('ec-model-age', EC_MODEL_AGE, 'modelAge', 2);
  ecOptionGrid('ec-model-style', EC_STATE.modelGender === 'male' ? EC_MODEL_STYLE_MALE : EC_MODEL_STYLE_FEMALE, 'modelStyle', 5);
  ecOptionGrid('ec-model-ethnicity', EC_MODEL_ETHNICITY, 'modelEthnicity', 0);
  ecSelectPopulate('ec-model-hair-select', EC_STATE.modelGender === 'male' ? EC_MODEL_HAIR_MALE : EC_MODEL_HAIR_FEMALE, 'modelHair');
  ecSelectPopulate('ec-model-hair-color-select', EC_MODEL_HAIR_COLOR, 'modelHairColor');
  ecSelectPopulate('ec-model-skin-select', EC_MODEL_SKIN, 'modelSkin');
  ecOptionGrid('ec-model-height', EC_MODEL_HEIGHT, 'modelHeight', 2);
  ecOptionGrid('ec-model-body', EC_MODEL_BODY, 'modelBody', 1);
  // 성별 변경 시 스타일/헤어 교체
  const genderEl = document.getElementById('ec-model-gender');
  if (genderEl) genderEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.val;
      ecOptionGrid('ec-model-style', g === 'male' ? EC_MODEL_STYLE_MALE : EC_MODEL_STYLE_FEMALE, 'modelStyle', 0);
      ecSelectPopulate('ec-model-hair-select', g === 'male' ? EC_MODEL_HAIR_MALE : EC_MODEL_HAIR_FEMALE, 'modelHair');
    });
  });
}

function ecModelRefChanged(input) { ecUploadPreview(input, 'ec-model-ref-area'); }

async function ecModelGenerate() {
  ecShowLoading('ec-model-results', 'AI가 모델을 생성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/model/generate', { method: 'POST', body: {
      gender: EC_STATE.modelGender, ageRange: EC_STATE.modelAge, style: EC_STATE.modelStyle,
      ethnicity: EC_STATE.modelEthnicity, hairStyle: EC_STATE.modelHair, bodyType: EC_STATE.modelBody,
      referenceImage: document.getElementById('ec-model-ref-area').dataset?.base64 || null,
    }});
    ecRenderImages('ec-model-results', res.images || []);
    if ((res.images || []).length) toast('모델 생성 완료!');
  } catch (e) { document.getElementById('ec-model-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 의상 합성 ──────────────────────────────────────────────

const EC_OUTFIT_RATIO = [
  { label: '1:1', value: '1:1' }, { label: '3:4', value: '3:4' }, { label: '4:3', value: '4:3' },
];

function ecOutfitInit() {
  ecOptionGrid('ec-outfit-ratio', EC_OUTFIT_RATIO, 'outfitRatio', 0);
}

function ecOutfitModelChanged(input) { ecUploadPreview(input, 'ec-outfit-model-area'); }
function ecOutfitProductChanged(input) { ecMultiUploadPreview(input, 'ec-outfit-products', 5); }

async function ecOutfitGenerate() {
  const modelImg = document.getElementById('ec-outfit-model-area').dataset?.base64;
  const productImgs = ecGetMultiImages('ec-outfit-products');
  if (!modelImg) return toast('모델 이미지를 업로드하세요', 'error');
  if (!productImgs.length) return toast('의상 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-outfit-results', 'AI가 의상을 합성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/outfit/generate', { method: 'POST', body: {
      modelImage: modelImg, productImages: productImgs, aspectRatio: EC_STATE.outfitRatio,
      count: parseInt(document.getElementById('ec-outfit-count').value) || 3,
      additionalPrompt: document.getElementById('ec-outfit-extra').value,
    }});
    ecRenderImages('ec-outfit-results', res.images || []);
    if ((res.images || []).length) toast('의상 합성 완료!');
  } catch (e) { document.getElementById('ec-outfit-results').innerHTML = ''; toast('합성 실패: ' + e.message, 'error'); }
}

// ── 인플루언서 ──────────────────────────────────────────────

const EC_INF_MOOD = [
  { icon: '💎', label: '프리미엄', value: 'premium' }, { icon: '😊', label: '친근한', value: 'friendly' },
  { icon: '⚡', label: '역동적', value: 'dynamic' }, { icon: '✨', label: '고급스러운', value: 'elegant' },
  { icon: '🌿', label: '자연스러운', value: 'natural' }, { icon: '🔥', label: '열정적', value: 'passionate' },
];
const EC_INF_POSE = [
  { label: '자연스러운', value: 'natural' }, { label: '포즈', value: 'posed' }, { label: '액션', value: 'action' },
  { label: '클로즈업', value: 'closeup' }, { label: '전신', value: 'fullbody' }, { label: '반신', value: 'halfbody' },
];
const EC_INF_LIGHTING = [
  { label: '자연광', value: 'natural' }, { label: '스튜디오', value: 'studio' },
  { label: '골든아워', value: 'golden' }, { label: '드라마틱', value: 'dramatic' },
  { label: '소프트', value: 'soft' }, { label: '네온', value: 'neon' },
];

function ecInfInit() {
  ecOptionGrid('ec-inf-mood', EC_INF_MOOD, 'infMood', 0);
  ecOptionGrid('ec-inf-pose', EC_INF_POSE, 'infPose', 0);
  ecOptionGrid('ec-inf-lighting', EC_INF_LIGHTING, 'infLighting', 0);
}

function ecInfModelChanged(input) { ecUploadPreview(input, 'ec-inf-model-area'); }
function ecInfProductChanged(input) { ecMultiUploadPreview(input, 'ec-inf-products', 5); }

async function ecInfGenerate() {
  const infImg = document.getElementById('ec-inf-model-area').dataset?.base64;
  if (!infImg) return toast('인플루언서 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-inf-results', 'AI가 인플루언서 이미지를 합성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/influencer/generate', { method: 'POST', body: {
      influencerImage: infImg, productImages: ecGetMultiImages('ec-inf-products'),
      mood: EC_STATE.infMood, pose: EC_STATE.infPose, lighting: EC_STATE.infLighting,
      additionalPrompt: document.getElementById('ec-inf-extra').value,
    }});
    ecRenderImages('ec-inf-results', res.images || []);
    if ((res.images || []).length) toast('인플루언서 이미지 생성 완료!');
  } catch (e) { document.getElementById('ec-inf-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 아트 변환 ──────────────────────────────────────────────

const EC_ART_MODE = [
  { icon: '🎨', label: '스타일 변환', value: 'transform' },
  { icon: '✨', label: '새로 생성', value: 'create' },
  { icon: '🖼', label: '참조 생성', value: 'reference' },
];
const EC_ART_RATIO = [
  { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' },
];
const EC_ART_STYLES = [
  { value: 'van_gogh', label: '반 고흐' }, { value: 'monet', label: '모네' }, { value: 'picasso', label: '피카소' },
  { value: 'dali', label: '달리' }, { value: 'warhol', label: '워홀' }, { value: 'klimt', label: '클림트' },
  { value: 'hokusai', label: '호쿠사이' }, { value: 'munch', label: '뭉크' }, { value: 'kandinsky', label: '칸딘스키' },
  { value: 'renoir', label: '르누아르' }, { value: 'cezanne', label: '세잔' }, { value: 'matisse', label: '마티스' },
  { value: 'mondrian', label: '몬드리안' }, { value: 'lichtenstein', label: '리히텐슈타인' },
  { value: 'basquiat', label: '바스키아' }, { value: 'ghibli', label: '지브리' },
  { value: 'watercolor', label: '수채화' }, { value: 'oil_painting', label: '유화' },
  { value: 'ink', label: '수묵화' }, { value: 'sketch', label: '스케치' },
  { value: 'pixel', label: '픽셀아트' }, { value: 'cyberpunk', label: '사이버펑크' },
];

function ecArtInit() {
  ecOptionGrid('ec-art-mode', EC_ART_MODE, 'artMode', 0);
  ecOptionGrid('ec-art-ratio', EC_ART_RATIO, 'artRatio', 0);
  ecSelectPopulate('ec-art-style', EC_ART_STYLES, 'artStyle');
}

function ecArtImageChanged(input) { ecUploadPreview(input, 'ec-art-img-area'); }

async function ecArtGenerate() {
  const mode = EC_STATE.artMode;
  const img = document.getElementById('ec-art-img-area').dataset?.base64;
  if (mode === 'transform' && !img) return toast('변환할 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-art-results', 'AI가 아트를 생성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/art/generate', { method: 'POST', body: {
      mode, targetImage: img || null,
      style: EC_STATE.artStyle, aspectRatio: EC_STATE.artRatio,
      styleIntensity: parseInt(document.getElementById('ec-art-intensity').value),
      prompt: document.getElementById('ec-art-prompt').value,
      imageCount: parseInt(document.getElementById('ec-art-count').value) || 2,
    }});
    ecRenderImages('ec-art-results', res.images || []);
    if ((res.images || []).length) toast('아트 생성 완료!');
  } catch (e) { document.getElementById('ec-art-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 만화 생성 ──────────────────────────────────────────────

const EC_CARTOON_STYLE = [
  { icon: '📱', label: '웹툰', value: 'webtoon' }, { icon: '📖', label: '만화', value: 'manga' },
  { icon: '✨', label: '소녀', value: 'shoujo' }, { icon: '💥', label: '코믹', value: 'comic' },
  { icon: '🌸', label: '애니', value: 'anime' }, { icon: '🧸', label: '치비', value: 'chibi' },
  { icon: '🎨', label: '수채화', value: 'watercolor' }, { icon: '🖊', label: '잉크', value: 'ink' },
  { icon: '🌑', label: '느와르', value: 'noir' }, { icon: '🔮', label: '판타지', value: 'fantasy' },
  { icon: '🤖', label: '사이버', value: 'cyberpunk' }, { icon: '📺', label: '레트로', value: 'retro80' },
];
const EC_CARTOON_LAYOUT = [
  { label: '1컷', value: '1' }, { label: '2컷', value: '2' }, { label: '4컷', value: '4' },
];
const EC_CARTOON_RATIO = [
  { label: '1:1', value: '1:1' }, { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' }, { label: '4:5', value: '4:5' },
];

let _ecCartoonChars = [];

function ecCartoonInit() {
  ecOptionGrid('ec-cartoon-style', EC_CARTOON_STYLE, 'cartoonStyle', 0);
  ecOptionGrid('ec-cartoon-layout', EC_CARTOON_LAYOUT, 'cartoonLayout', 2);
  ecOptionGrid('ec-cartoon-ratio', EC_CARTOON_RATIO, 'cartoonRatio', 0);
  _ecCartoonChars = [];
  document.getElementById('ec-cartoon-chars').innerHTML = '';
}

function ecCartoonAddChar() {
  const idx = _ecCartoonChars.length;
  _ecCartoonChars.push({ name: '', description: '' });
  const container = document.getElementById('ec-cartoon-chars');
  const div = document.createElement('div');
  div.style.cssText = 'border:1px solid rgba(0,0,0,0.06);border-radius:10px;padding:10px;margin-bottom:8px;';
  div.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" placeholder="캐릭터명" class="form-input" style="flex:1;" onchange="_ecCartoonChars[${idx}].name=this.value">
      <button class="btn btn-secondary btn-sm" onclick="this.closest('div[style]').remove()">삭제</button>
    </div>
    <input type="text" placeholder="외형 설명" class="form-input" style="margin-top:6px;" onchange="_ecCartoonChars[${idx}].description=this.value">
  `;
  container.appendChild(div);
}

async function ecCartoonGenerate() {
  const title = document.getElementById('ec-cartoon-title').value.trim();
  const plot = document.getElementById('ec-cartoon-plot').value.trim();
  if (!title || !plot) return toast('제목과 줄거리를 입력하세요', 'error');
  ecShowLoading('ec-cartoon-results', 'AI가 만화를 그리고 있습니다...');
  try {
    const res = await api('/api/ecommerce/cartoon/generate', { method: 'POST', body: {
      title, plot, characters: _ecCartoonChars.filter(c => c.name),
      artStyle: EC_STATE.cartoonStyle, panelLayout: EC_STATE.cartoonLayout,
      aspectRatio: EC_STATE.cartoonRatio,
      pageCount: parseInt(document.getElementById('ec-cartoon-pages').value) || 4,
    }});
    ecRenderImages('ec-cartoon-results', res.images || []);
    if ((res.images || []).length) toast('만화 생성 완료!');
  } catch (e) { document.getElementById('ec-cartoon-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 인테리어 ──────────────────────────────────────────────

const EC_INT_ROOM = [
  { icon: '🛋', label: '거실', value: 'living' }, { icon: '🛏', label: '침실', value: 'bedroom' },
  { icon: '🍽', label: '다이닝', value: 'dining' }, { icon: '📚', label: '서재', value: 'study' },
  { icon: '🧸', label: '아이방', value: 'kids' }, { icon: '🏠', label: '원룸', value: 'studio' },
];
const EC_INT_STYLE = [
  { icon: '📐', label: '모던', value: 'modern' }, { icon: '🌲', label: '북유럽', value: 'nordic' },
  { icon: '◻', label: '미니멀', value: 'minimal' }, { icon: '🏭', label: '인더스트리얼', value: 'industrial' },
  { icon: '🌿', label: '내추럴', value: 'natural' }, { icon: '💎', label: '럭셔리', value: 'luxury' },
  { icon: '🏯', label: '재패니즈', value: 'japanese' }, { icon: '📻', label: '빈티지', value: 'vintage' },
];
const EC_INT_LIGHTING = [
  { icon: '☀', label: '자연광', value: 'natural' }, { icon: '💡', label: '따뜻한', value: 'warm' },
  { icon: '🌅', label: '저녁', value: 'evening' }, { icon: '🎭', label: '드라마틱', value: 'dramatic' },
];
const EC_INT_ANGLE = [
  { label: '정면', value: 'front' }, { label: '코너', value: 'corner' },
  { label: '와이드', value: 'wide' }, { label: '클로즈업', value: 'closeup' },
];

function ecIntInit() {
  ecOptionGrid('ec-int-room', EC_INT_ROOM, 'intRoom', 0);
  ecOptionGrid('ec-int-style', EC_INT_STYLE, 'intStyle', 0);
  ecOptionGrid('ec-int-lighting', EC_INT_LIGHTING, 'intLighting', 0);
  ecOptionGrid('ec-int-angle', EC_INT_ANGLE, 'intAngle', 0);
}

function ecIntImageChanged(input) { ecUploadPreview(input, 'ec-int-img-area'); }

async function ecIntGenerate() {
  const img = document.getElementById('ec-int-img-area').dataset?.base64;
  if (!img) return toast('가구/소품 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-int-results', 'AI가 인테리어를 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/interior/generate', { method: 'POST', body: {
      furnitureImage: img, roomType: EC_STATE.intRoom, interiorStyle: EC_STATE.intStyle,
      lightingMood: EC_STATE.intLighting, cameraAngle: EC_STATE.intAngle,
      imageCount: parseInt(document.getElementById('ec-int-count').value) || 2,
      additionalPrompt: document.getElementById('ec-int-extra').value,
    }});
    ecRenderImages('ec-int-results', res.images || []);
    if ((res.images || []).length) toast('인테리어 생성 완료!');
  } catch (e) { document.getElementById('ec-int-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 펫 모델 ──────────────────────────────────────────────

const EC_PET_TYPE = [ { icon: '🐶', label: '강아지', value: 'dog' }, { icon: '🐱', label: '고양이', value: 'cat' } ];
const EC_PET_AGE = [
  { label: '아기', value: 'puppy' }, { label: '어린', value: 'young' },
  { label: '성체', value: 'adult' }, { label: '노령', value: 'senior' },
];
const EC_PET_FUR = [
  { label: '크림', value: 'cream' }, { label: '흰색', value: 'white' },
  { label: '검정', value: 'black' }, { label: '갈색', value: 'brown' },
  { label: '강조색', value: 'orange' }, { label: '회색', value: 'grey' },
  { label: '삼색', value: 'tricolor' }, { label: '얼룩', value: 'spotted' },
];
const EC_PET_MOOD = [
  { icon: '😍', label: '귀여운', value: 'cute' }, { icon: '🎾', label: '활발한', value: 'playful' },
  { icon: '😌', label: '차분한', value: 'calm' }, { icon: '😴', label: '졸린', value: 'sleepy' },
  { icon: '👀', label: '호기심', value: 'alert' }, { icon: '😎', label: '당당한', value: 'confident' },
];
const EC_PET_POSE = [
  { label: '앉아', value: 'sitting' }, { label: '서있는', value: 'standing' }, { label: '누운', value: 'lying' },
  { label: '놀고있는', value: 'playing' }, { label: '달리는', value: 'running' }, { label: '점프', value: 'jumping' },
];
const EC_PET_BG = [
  { label: '화이트 스튜디오', value: 'studio_white' }, { label: '그레이 스튜디오', value: 'studio_gray' },
  { label: '정원', value: 'garden' }, { label: '해변', value: 'beach' },
  { label: '공원', value: 'park' }, { label: '실내', value: 'indoor' },
];
const EC_DOG_BREEDS = [
  { value: 'pomeranian', label: '포메라니안' }, { value: 'maltese', label: '말티즈' },
  { value: 'poodle', label: '푸들' }, { value: 'shiba', label: '시바견' },
  { value: 'golden', label: '골든 리트리버' }, { value: 'corgi', label: '웰시코기' },
  { value: 'bichon', label: '비숑 프리제' }, { value: 'dachshund', label: '닥스훈트' },
  { value: 'samoyed', label: '사모예드' }, { value: 'husky', label: '시베리안 허스키' },
];
const EC_CAT_BREEDS = [
  { value: 'persian', label: '페르시안' }, { value: 'british_short', label: '브리티시 숏헤어' },
  { value: 'scottish_fold', label: '스코티시 폴드' }, { value: 'ragdoll', label: '랙돌' },
  { value: 'russian_blue', label: '러시안 블루' }, { value: 'siamese', label: '샴' },
  { value: 'maine_coon', label: '메인쿤' }, { value: 'bengal', label: '벵갈' },
  { value: 'munchkin', label: '먼치킨' }, { value: 'abyssinian', label: '아비시니안' },
];

function ecPetInit() {
  ecOptionGrid('ec-pet-type', EC_PET_TYPE, 'petType', 0);
  ecSelectPopulate('ec-pet-breed', EC_DOG_BREEDS, 'petBreed');
  ecOptionGrid('ec-pet-age', EC_PET_AGE, 'petAge', 2);
  ecOptionGrid('ec-pet-fur-color', EC_PET_FUR, 'petFur', 0);
  ecOptionGrid('ec-pet-mood', EC_PET_MOOD, 'petMood', 0);
  ecOptionGrid('ec-pet-pose', EC_PET_POSE, 'petPose', 0);
  ecOptionGrid('ec-pet-bg', EC_PET_BG, 'petBg', 0);
  // 펫 타입 변경 시 품종 목록 교체
  const typeContainer = document.getElementById('ec-pet-type');
  if (typeContainer) {
    typeContainer.querySelectorAll('button').forEach(btn => {
      const origClick = btn.onclick;
      btn.onclick = function(e) {
        ecSelectOption('ec-pet-type', 'petType', this);
        const breeds = this.dataset.val === 'cat' ? EC_CAT_BREEDS : EC_DOG_BREEDS;
        ecSelectPopulate('ec-pet-breed', breeds, 'petBreed');
      };
    });
  }
}

function ecPetRefChanged(input) { ecUploadPreview(input, 'ec-pet-ref-area'); }

async function ecPetGenerate() {
  ecShowLoading('ec-pet-results', 'AI가 펫 모델을 생성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/pet/generate', { method: 'POST', body: {
      petType: EC_STATE.petType, breed: EC_STATE.petBreed, age: EC_STATE.petAge,
      furColor: EC_STATE.petFur, mood: EC_STATE.petMood, pose: EC_STATE.petPose,
      background: EC_STATE.petBg,
      referenceImage: document.getElementById('ec-pet-ref-area').dataset?.base64 || null,
    }});
    ecRenderImages('ec-pet-results', res.images || []);
    if ((res.images || []).length) toast('펫 모델 생성 완료!');
  } catch (e) { document.getElementById('ec-pet-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 펫 의상 ──────────────────────────────────────────────

const EC_PETOUT_RATIO = [
  { label: '1:1', value: '1:1' }, { label: '3:4', value: '3:4' }, { label: '4:3', value: '4:3' },
];

function ecPetOutInit() {
  ecOptionGrid('ec-petout-ratio', EC_PETOUT_RATIO, 'petoutRatio', 0);
}

function ecPetOutModelChanged(input) { ecMultiUploadPreview(input, 'ec-petout-models', 5); }
function ecPetOutProductChanged(input) { ecMultiUploadPreview(input, 'ec-petout-products', 5); }

async function ecPetOutGenerate() {
  const models = ecGetMultiImages('ec-petout-models');
  const products = ecGetMultiImages('ec-petout-products');
  if (!models.length) return toast('펫 이미지를 업로드하세요', 'error');
  if (!products.length) return toast('의상 이미지를 업로드하세요', 'error');
  ecShowLoading('ec-petout-results', 'AI가 펫 의상을 합성하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/pet-outfit/generate', { method: 'POST', body: {
      modelImages: models, productImages: products, aspectRatio: EC_STATE.petoutRatio,
      count: parseInt(document.getElementById('ec-petout-count').value) || 3,
      additionalPrompt: document.getElementById('ec-petout-extra').value,
    }});
    ecRenderImages('ec-petout-results', res.images || []);
    if ((res.images || []).length) toast('펫 의상 합성 완료!');
  } catch (e) { document.getElementById('ec-petout-results').innerHTML = ''; toast('합성 실패: ' + e.message, 'error'); }
}

// ── 페이지 초기화 매핑 ──────────────────────────────────────

const EC_PAGE_INITS = {
  'ec-banner': ecBannerInit,
  'ec-detailpage': ecDpInit,
  'ec-rebuild': () => {},
  'ec-rotate360': ecRotateInit,
  'ec-advideo': ecAdvInit,
  'ec-logo': ecLogoInit,
  'ec-smartstore': ecSsInit,
  'ec-model': ecModelInit,
  'ec-outfit': ecOutfitInit,
  'ec-influencer': ecInfInit,
  'ec-art': ecArtInit,
  'ec-cartoon': ecCartoonInit,
  'ec-interior': ecIntInit,
  'ec-pet': ecPetInit,
  'ec-pet-outfit': ecPetOutInit,
};

function ecPageInit(page) {
  const initFn = EC_PAGE_INITS[page];
  if (initFn) initFn();
}
