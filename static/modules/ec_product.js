/* ============================================================
 *  이커머스 — 상품 관련 서비스
 *  배너, 상세페이지, 상세페이지 진단, 광고영상, 유튜브 썸네일
 * ============================================================ */

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
  } catch (e) { const _el = document.getElementById('ec-banner-results'); if (_el) _el.innerHTML = ''; toast('배너 생성 실패: ' + e.message, 'error'); }
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

async function ecDpFromUrl() {
  const url = document.getElementById('ec-dp-url').value.trim();
  if (!url) return toast('URL을 입력하세요', 'error');
  toast('상품 정보 가져오는 중...', 'info');
  try {
    const res = await api('/api/ecommerce/detailpage/fetch-url', { method: 'POST', body: { url } });
    if (res.productName) document.getElementById('ec-dp-name').value = res.productName;
    if (res.productDescription) document.getElementById('ec-dp-desc').value = res.productDescription;
    const container = document.getElementById('ec-dp-images');
    const uploadArea = container.querySelector('.ec-upload-area');
    const existing = new Set(Array.from(container.querySelectorAll('.ec-upload-thumb')).map((node) => node.dataset.base64 || ''));
    const fetchedImages = [...(res.images || []), ...(res.imageUrls || [])];
    fetchedImages.slice(0, 5).forEach((img) => {
      if (!img || existing.has(img)) return;
      const thumb = document.createElement('div');
      thumb.className = 'ec-upload-thumb';
      thumb.dataset.base64 = img;
      thumb.innerHTML = `<img src="${img}"><button class="ec-remove" onclick="this.parentElement.remove()">×</button>`;
      container.insertBefore(thumb, uploadArea);
      existing.add(img);
    });
    const count = fetchedImages.length;
    toast(`상품 정보 가져오기 완료! (이미지 ${count}장)`);
  } catch (e) { toast('URL 가져오기 실패: ' + e.message, 'error'); }
}

function ecDpInit() {
  ecOptionGrid('ec-dp-ratio', EC_RATIO_SQUARE, 'dpRatio', 0);
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
    style: 'auto', colorScheme: 'auto',
    mood: 'auto', targetAudience: 'auto',
    aspectRatio: EC_STATE.dpRatio,
    additionalPrompt: document.getElementById('ec-dp-extra').value,
  };
  ecShowLoading('ec-dp-results', 'AI가 상품 이미지와 글자를 함께 분석해 상세페이지를 만들고 있습니다...');
  try {
    const res = await api('/api/ecommerce/detailpage/generate', { method: 'POST', body });
    ecRenderImages('ec-dp-results', res.images || []);
    if ((res.images || []).length) toast('상세페이지 생성 완료!');
  } catch (e) { const _el = document.getElementById('ec-dp-results'); if (_el) _el.innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
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
  } catch (e) { const _el = document.getElementById('ec-rebuild-results'); if (_el) _el.innerHTML = ''; toast('진단 실패: ' + e.message, 'error'); }
}

// ── 상세페이지 진단 — URL 캡처 ──────────────────────────────

async function ecRebuildFromUrl() {
  const url = document.getElementById('ec-rebuild-url').value.trim();
  if (!url) return toast('URL을 입력하세요', 'error');
  toast('페이지 캡처 중...', 'info');
  try {
    const res = await api('/api/ecommerce/rebuild/capture-url', { method: 'POST', body: { url } });
    if (res.images && res.images.length) {
      const container = document.getElementById('ec-rebuild-images');
      res.images.forEach(img => {
        const thumb = document.createElement('div');
        thumb.className = 'ec-upload-thumb';
        thumb.dataset.base64 = img;
        thumb.innerHTML = '<img src="' + img + '"><button class="ec-remove" onclick="this.parentElement.remove()">×</button>';
        container.insertBefore(thumb, container.querySelector('.ec-upload-area'));
      });
      toast(res.images.length + '장의 이미지가 캡처되었습니다');
    } else {
      toast('캡처된 이미지가 없습니다', 'error');
    }
  } catch (e) { toast('URL 캡처 실패: ' + e.message, 'error'); }
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
  ecOptionGrid('ec-adv-video-style', EC_ADV_VIDEO_STYLE, 'advVideoStyle', 0);
  ecOptionGrid('ec-adv-goal', EC_ADV_GOAL, 'advGoal', 0);
  ecOptionGrid('ec-adv-quality', EC_ADV_QUALITY, 'advQuality', 1);
  ecOptionGrid('ec-adv-ad-concept', EC_ADV_AD_CONCEPT, 'advAdConcept', 0);
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
      videoStyle: EC_STATE.advVideoStyle, goal: EC_STATE.advGoal,
      quality: EC_STATE.advQuality, adConcept: EC_STATE.advAdConcept,
      additionalPrompt: document.getElementById('ec-adv-extra').value,
    }});
    document.getElementById('ec-adv-results').innerHTML = res.videoUrl
      ? `<div class="card" style="text-align:center;"><video src="${res.videoUrl}" controls autoplay style="max-width:100%;border-radius:12px;"></video></div>`
      : (res.images?.length ? '' : '<p style="text-align:center;color:rgba(0,0,0,0.4);">결과가 없습니다</p>');
    if (res.images?.length) ecRenderImages('ec-adv-results', res.images);
    toast('광고 영상 생성 완료!');
  } catch (e) { const _el = document.getElementById('ec-adv-results'); if (_el) _el.innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}

// ── 유튜브 썸네일 ──────────────────────────────────────────

const EC_THUMB_CATEGORY = [
  { icon: '💻', label: '테크/IT', value: 'tech' }, { icon: '🎮', label: '게임', value: 'gaming' },
  { icon: '📚', label: '교육', value: 'education' }, { icon: '🎵', label: '음악', value: 'music' },
  { icon: '🍳', label: '요리', value: 'cooking' }, { icon: '💪', label: '운동', value: 'fitness' },
  { icon: '💄', label: '뷰티', value: 'beauty' }, { icon: '✈', label: '여행', value: 'travel' },
  { icon: '💰', label: '재테크', value: 'finance' }, { icon: '📰', label: '뉴스', value: 'news' },
  { icon: '😂', label: '예능/코미디', value: 'entertainment' }, { icon: '📦', label: '리뷰/언박싱', value: 'review' },
  { icon: '🎬', label: 'Vlog', value: 'vlog' }, { icon: '🐶', label: '반려동물', value: 'pet' },
  { icon: '👶', label: '키즈/육아', value: 'kids' }, { icon: '📖', label: '자기계발', value: 'selfhelp' },
];
const EC_THUMB_MOOD = [
  { icon: '😱', label: '충격/놀람', value: 'shocking' }, { icon: '🔥', label: '강렬한', value: 'intense' },
  { icon: '😊', label: '밝고 친근', value: 'friendly' }, { icon: '🤔', label: '궁금증 유발', value: 'curiosity' },
  { icon: '💎', label: '고급스러운', value: 'premium' }, { icon: '😂', label: '재미있는', value: 'funny' },
  { icon: '📢', label: '긴급/속보', value: 'urgent' }, { icon: '✨', label: '감성적', value: 'emotional' },
];
const EC_THUMB_TEXT_STYLE = [
  { icon: '🔤', label: '굵은 고딕', value: 'bold_gothic' }, { icon: '✍', label: '손글씨', value: 'handwritten' },
  { icon: '🅰', label: '3D 입체', value: '3d_text' }, { icon: '💫', label: '네온 글로우', value: 'neon_glow' },
  { icon: '🏷', label: '깔끔 산세리프', value: 'clean_sans' }, { icon: '📌', label: '스티커 타입', value: 'sticker' },
];
const EC_THUMB_BG_TYPE = [
  { icon: '🎨', label: '단색/그라데이션', value: 'solid_gradient' },
  { icon: '📸', label: '실사 사진', value: 'photo' },
  { icon: '💥', label: '만화/폭발', value: 'comic_burst' },
  { icon: '🖥', label: '스크린/UI', value: 'screen' },
  { icon: '🌌', label: '우주/추상', value: 'abstract' },
  { icon: '🏠', label: '실내 배경', value: 'indoor' },
];
const EC_THUMB_COLOR = [
  { icon: '🔴', label: '빨강+노랑', value: 'red_yellow' }, { icon: '🔵', label: '파랑+흰색', value: 'blue_white' },
  { icon: '⬛', label: '검정+노랑', value: 'black_yellow' }, { icon: '🟢', label: '초록+흰색', value: 'green_white' },
  { icon: '🟣', label: '보라+핑크', value: 'purple_pink' }, { icon: '🟡', label: '노랑+검정', value: 'yellow_black' },
  { icon: '🟠', label: '강조색+다크', value: 'orange_dark' }, { icon: '🤍', label: 'AI 추천', value: 'auto' },
];

function ecThumbInit() {
  ecOptionGrid('ec-thumb-category', EC_THUMB_CATEGORY, 'thumbCategory', 0);
  ecOptionGrid('ec-thumb-mood', EC_THUMB_MOOD, 'thumbMood', 0);
  ecOptionGrid('ec-thumb-text-style', EC_THUMB_TEXT_STYLE, 'thumbTextStyle', 0);
  ecOptionGrid('ec-thumb-bg-type', EC_THUMB_BG_TYPE, 'thumbBgType', 0);
  ecOptionGrid('ec-thumb-color', EC_THUMB_COLOR, 'thumbColor', 7);
}

async function ecThumbGenerate() {
  const title = document.getElementById('ec-thumb-title').value.trim();
  const text = document.getElementById('ec-thumb-text').value.trim();
  if (!title || !text) return toast('영상 제목과 썸네일 텍스트를 입력하세요', 'error');
  const body = {
    videoTitle: title, thumbnailText: text,
    category: EC_STATE.thumbCategory, mood: EC_STATE.thumbMood,
    textStyle: EC_STATE.thumbTextStyle, backgroundType: EC_STATE.thumbBgType,
    colorTheme: EC_STATE.thumbColor,
    faceImage: document.getElementById('ec-thumb-face-area').dataset?.base64 || null,
    additionalInstructions: document.getElementById('ec-thumb-extra').value,
    count: parseInt(document.getElementById('ec-thumb-count').value) || 3,
  };
  ecShowLoading('ec-thumb-results', 'AI가 유튜브 썸네일을 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/thumbnail/generate', { method: 'POST', body });
    ecRenderImages('ec-thumb-results', res.images || []);
    if ((res.images || []).length) toast('썸네일 생성 완료!');
  } catch (e) { const _el = document.getElementById('ec-thumb-results'); if (_el) _el.innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}
