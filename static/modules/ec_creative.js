/* ============================================================
 *  이커머스 — 크리에이티브 서비스
 *  아트, 만화, 인테리어, 펫, 펫의상
 * ============================================================ */

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
  // 인상주의
  { value: 'van_gogh', label: '반 고흐' }, { value: 'monet', label: '모네' },
  { value: 'renoir', label: '르누아르' }, { value: 'cezanne', label: '세잔' },
  { value: 'degas', label: '드가' }, { value: 'seurat', label: '쇠라' },
  { value: 'pissarro', label: '피사로' },
  // 후기 인상주의/표현주의
  { value: 'munch', label: '뭉크' }, { value: 'klimt', label: '클림트' },
  { value: 'schiele', label: '실레' }, { value: 'kirchner', label: '키르히너' },
  // 초현실주의/입체주의
  { value: 'picasso', label: '피카소' }, { value: 'dali', label: '달리' },
  { value: 'magritte', label: '마그리트' }, { value: 'miro', label: '미로' },
  { value: 'braque', label: '브라크' },
  // 추상
  { value: 'kandinsky', label: '칸딘스키' }, { value: 'mondrian', label: '몬드리안' },
  { value: 'malevich', label: '말레비치' }, { value: 'rothko', label: '로스코' },
  { value: 'pollock', label: '폴록' }, { value: 'de_kooning', label: '드 쿠닝' },
  // 팝아트/현대
  { value: 'warhol', label: '워홀' }, { value: 'lichtenstein', label: '리히텐슈타인' },
  { value: 'basquiat', label: '바스키아' }, { value: 'haring', label: '키스 해링' },
  { value: 'banksy', label: '뱅크시' }, { value: 'koons', label: '제프 쿤스' },
  { value: 'kusama', label: '쿠사마 야요이' },
  // 르네상스/고전
  { value: 'da_vinci', label: '다빈치' }, { value: 'michelangelo', label: '미켈란젤로' },
  { value: 'raphael', label: '라파엘' }, { value: 'botticelli', label: '보티첼리' },
  { value: 'vermeer', label: '페르메이르' }, { value: 'rembrandt', label: '렘브란트' },
  { value: 'caravaggio', label: '카라바조' },
  // 일본 미술
  { value: 'hokusai', label: '호쿠사이' }, { value: 'hiroshige', label: '히로시게' },
  { value: 'utamaro', label: '우타마로' },
  // 동양화
  { value: 'ink_wash', label: '수묵화' }, { value: 'chinese_classical', label: '중국 산수화' },
  { value: 'korean_minhwa', label: '민화' },
  // 현대 디지털/애니
  { value: 'ghibli', label: '지브리' }, { value: 'makoto_shinkai', label: '신카이 마코토' },
  { value: 'disney', label: '디즈니' }, { value: 'pixar', label: '픽사' },
  // 기법
  { value: 'watercolor', label: '수채화' }, { value: 'oil_painting', label: '유화' },
  { value: 'acrylic', label: '아크릴' }, { value: 'pastel', label: '파스텔' },
  { value: 'charcoal', label: '목탄' }, { value: 'pencil_sketch', label: '연필 스케치' },
  { value: 'ink_drawing', label: '펜화' }, { value: 'woodblock', label: '판화' },
  // 디지털 스타일
  { value: 'pixel', label: '픽셀아트' }, { value: 'voxel', label: '복셀아트' },
  { value: 'low_poly', label: '로우폴리' }, { value: 'isometric', label: '아이소메트릭' },
  { value: 'cyberpunk', label: '사이버펑크' }, { value: 'steampunk', label: '스팀펑크' },
  { value: 'synthwave', label: '신스웨이브' }, { value: 'vaporwave', label: '베이퍼웨이브' },
  // 사진 스타일
  { value: 'photorealistic', label: '포토리얼리즘' }, { value: 'hyperrealism', label: '하이퍼리얼리즘' },
  { value: 'tilt_shift', label: '틸트시프트' }, { value: 'lomography', label: '로모그래피' },
  // 일러스트
  { value: 'flat_illustration', label: '플랫 일러스트' }, { value: 'line_art', label: '라인아트' },
  { value: 'collage', label: '콜라주' }, { value: 'stained_glass', label: '스테인드글라스' },
  { value: 'mosaic', label: '모자이크' }, { value: 'art_nouveau', label: '아르누보' },
  { value: 'art_deco', label: '아르데코' }, { value: 'bauhaus', label: '바우하우스' },
  { value: 'ukiyo_e', label: '우키요에' }, { value: 'pointillism', label: '점묘법' },
  { value: 'fauvism', label: '야수파' }, { value: 'constructivism', label: '구성주의' },
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
  // 기본
  { icon: '📱', label: '웹툰', value: 'webtoon' }, { icon: '📖', label: '만화', value: 'manga' },
  { icon: '✨', label: '소녀', value: 'shoujo' }, { icon: '💥', label: '코믹', value: 'comic' },
  { icon: '🌸', label: '애니', value: 'anime' },
  // 귀여운
  { icon: '🧸', label: '치비', value: 'chibi' }, { icon: '🎀', label: '큐트', value: 'cute' },
  { icon: '🖍', label: '카툰', value: 'cartoon' },
  // 아트
  { icon: '🎨', label: '수채화', value: 'watercolor' }, { icon: '🖊', label: '잉크', value: 'ink' },
  { icon: '✏', label: '스케치', value: 'sketch' }, { icon: '🖌', label: '유화', value: 'oil' },
  // 분위기
  { icon: '🌑', label: '느와르', value: 'noir' }, { icon: '🤖', label: '사이버', value: 'cyberpunk' },
  { icon: '🔮', label: '판타지', value: 'fantasy' }, { icon: '👻', label: '호러', value: 'horror' },
  { icon: '🦇', label: '고딕', value: 'gothic' },
  // 레트로
  { icon: '📺', label: '빈티지', value: 'vintage' }, { icon: '🕹', label: '80년대', value: 'retro80' },
  { icon: '🎵', label: '팝', value: 'pop' },
  // 모던
  { icon: '◻', label: '미니멀', value: 'minimalist' }, { icon: '▭', label: '플랫', value: 'flat' },
  { icon: '🔲', label: '픽셀', value: 'pixel' }, { icon: '📷', label: '리얼', value: 'realistic' },
  // 특수
  { icon: '🏯', label: '지브리', value: 'ghibli' }, { icon: '🏰', label: '디즈니', value: 'disney' },
  { icon: '🦸', label: '마블', value: 'marvel' },
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
  ecOptionGrid('ec-int-ratio', EC_RATIO_STANDARD, 'intRatio', 0);
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
      aspectRatio: EC_STATE.intRatio,
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
  { label: '성체', value: 'adult' }, { label: '시니어', value: 'senior' },
];
const EC_PET_SIZE = [
  { icon: '🫶', label: '티컵/미니', value: 'tiny' }, { icon: '🐾', label: '소형', value: 'small' },
  { icon: '🏠', label: '중형', value: 'medium' }, { icon: '🦮', label: '대형', value: 'large' },
];
const EC_PET_FUR_COLOR = [
  { label: '크림', value: 'cream' }, { label: '흰색', value: 'white' },
  { label: '검정', value: 'black' }, { label: '갈색', value: 'brown' },
  { label: '강조색', value: 'orange' }, { label: '회색', value: 'grey' },
  { label: '삼색', value: 'tricolor' }, { label: '얼룩', value: 'spotted' },
];
const EC_PET_FUR_PATTERN = [
  { icon: '⬛', label: '단색', value: 'solid' }, { icon: '🔲', label: '바이컬러', value: 'bicolor' },
  { icon: '🎨', label: '삼색', value: 'tricolor' }, { icon: '🐯', label: '태비', value: 'tabby' },
  { icon: '🎭', label: '칼리코', value: 'calico' }, { icon: '🐆', label: '스팟', value: 'spotted' },
  { icon: '🤵', label: '턱시도', value: 'tuxedo' }, { icon: '🪨', label: '멀', value: 'merle' },
];
const EC_PET_FUR_LENGTH = [
  { icon: '✨', label: '무모', value: 'hairless' }, { icon: '📏', label: '단모', value: 'short' },
  { icon: '〰', label: '중모', value: 'medium' }, { icon: '🌊', label: '장모', value: 'long' },
  { icon: '☁', label: '복슬복슬', value: 'fluffy' },
];
const EC_PET_EYE_COLOR = [
  { icon: '🤎', label: '브라운', value: 'brown' }, { icon: '🌟', label: '앰버', value: 'amber' },
  { icon: '💚', label: '그린', value: 'green' }, { icon: '💙', label: '블루', value: 'blue' },
  { icon: '✨', label: '골드', value: 'gold' }, { icon: '🔮', label: '오드아이', value: 'heterochromia' },
];
const EC_PET_MOOD = [
  { icon: '😊', label: '행복', value: 'happy' }, { icon: '🥰', label: '귀여움', value: 'cute' },
  { icon: '👑', label: '우아함', value: 'elegant' }, { icon: '😜', label: '장난', value: 'playful' },
  { icon: '🧐', label: '호기심', value: 'curious' }, { icon: '😴', label: '졸린', value: 'sleepy' },
  { icon: '🦁', label: '위엄', value: 'majestic' }, { icon: '🌸', label: '순수', value: 'innocent' },
  { icon: '😏', label: '도도', value: 'sassy' }, { icon: '💕', label: '다정', value: 'loving' },
];
const EC_PET_POSE = [
  { icon: '🧘', label: '앉아있는', value: 'sitting' }, { icon: '🧍', label: '서있는', value: 'standing' },
  { icon: '🛋', label: '누워있는', value: 'lying' }, { icon: '🏃', label: '뛰어가는', value: 'running' },
  { icon: '🎾', label: '놀고있는', value: 'playing' }, { icon: '👆', label: '올려보는', value: 'looking_up' },
  { icon: '🤔', label: '갸웃', value: 'tilted_head' }, { icon: '🙆', label: '기지개', value: 'stretching' },
  { icon: '🍩', label: '웅크린', value: 'curled' }, { icon: '🚶', label: '걷는', value: 'walking' },
];
const EC_PET_BG = [
  { icon: '⬜', label: '스튜디오 화이트', value: 'studio_white' }, { icon: '🩶', label: '스튜디오 그레이', value: 'studio_gray' },
  { icon: '🟢', label: '크로마키', value: 'green_screen' }, { icon: '🛋', label: '거실', value: 'living_room' },
  { icon: '🌸', label: '정원', value: 'garden' }, { icon: '🌳', label: '공원', value: 'park' },
  { icon: '🏖', label: '해변', value: 'beach' }, { icon: '🌿', label: '잔디밭', value: 'grass' },
  { icon: '☕', label: '카페', value: 'cafe' }, { icon: '🪟', label: '창가', value: 'window' },
];
const EC_DOG_BREEDS = [
  { value: 'pomeranian', label: '포메라니안' }, { value: 'maltese', label: '말티즈' },
  { value: 'poodle', label: '푸들' }, { value: 'maltipoo', label: '말티푸' },
  { value: 'shiba', label: '시바견' }, { value: 'golden', label: '골든 리트리버' },
  { value: 'corgi', label: '웰시코기' }, { value: 'bichon', label: '비숑 프리제' },
  { value: 'dachshund', label: '닥스훈트' }, { value: 'samoyed', label: '사모예드' },
  { value: 'husky', label: '시베리안 허스키' }, { value: 'shih_tzu', label: '시츄' },
  { value: 'yorkshire', label: '요크셔 테리어' }, { value: 'chihuahua', label: '치와와' },
  { value: 'french_bulldog', label: '프렌치 불독' }, { value: 'bulldog', label: '불독' },
  { value: 'german_shepherd', label: '저먼 셰퍼드' }, { value: 'border_collie', label: '보더콜리' },
  { value: 'jindo', label: '진돗개' }, { value: 'labrador', label: '래브라도 리트리버' },
  { value: 'beagle', label: '비글' },
];
const EC_CAT_BREEDS = [
  { value: 'persian', label: '페르시안' }, { value: 'british_short', label: '브리티시 숏헤어' },
  { value: 'scottish_fold', label: '스코티시 폴드' }, { value: 'ragdoll', label: '랙돌' },
  { value: 'russian_blue', label: '러시안 블루' }, { value: 'siamese', label: '샴' },
  { value: 'maine_coon', label: '메인쿤' }, { value: 'bengal', label: '벵갈' },
  { value: 'munchkin', label: '먼치킨' }, { value: 'abyssinian', label: '아비시니안' },
  { value: 'norwegian_forest', label: '노르웨이 숲' }, { value: 'sphynx', label: '스핑크스' },
  { value: 'exotic_shorthair', label: '엑조틱 숏헤어' }, { value: 'turkish_angora', label: '터키시 앙고라' },
  { value: 'korean_shorthair', label: '코리안 숏헤어' },
];

function ecPetInit() {
  ecOptionGrid('ec-pet-type', EC_PET_TYPE, 'petType', 0);
  ecSelectPopulate('ec-pet-breed', EC_DOG_BREEDS, 'petBreed');
  ecOptionGrid('ec-pet-age', EC_PET_AGE, 'petAge', 2);
  ecOptionGrid('ec-pet-size', EC_PET_SIZE, 'petSize', 1);
  ecOptionGrid('ec-pet-fur-color', EC_PET_FUR_COLOR, 'petFurColor', 0);
  ecOptionGrid('ec-pet-fur-pattern', EC_PET_FUR_PATTERN, 'petFurPattern', 0);
  ecOptionGrid('ec-pet-fur-length', EC_PET_FUR_LENGTH, 'petFurLength', 1);
  ecOptionGrid('ec-pet-eye-color', EC_PET_EYE_COLOR, 'petEyeColor', 0);
  ecOptionGrid('ec-pet-mood', EC_PET_MOOD, 'petMood', 0);
  ecOptionGrid('ec-pet-pose', EC_PET_POSE, 'petPose', 0);
  ecOptionGrid('ec-pet-bg', EC_PET_BG, 'petBg', 0);
  ecOptionGrid('ec-pet-ratio', EC_RATIO_STANDARD, 'petRatio', 0);
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
      size: EC_STATE.petSize, furColor: EC_STATE.petFurColor,
      furPattern: EC_STATE.petFurPattern, furLength: EC_STATE.petFurLength,
      eyeColor: EC_STATE.petEyeColor,
      mood: EC_STATE.petMood, pose: EC_STATE.petPose,
      background: EC_STATE.petBg, aspectRatio: EC_STATE.petRatio,
      count: parseInt(document.getElementById('ec-pet-count')?.value) || 2,
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
