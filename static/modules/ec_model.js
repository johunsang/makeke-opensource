/* ============================================================
 *  이커머스 — 모델/인물 관련 서비스
 *  모델, 의상합성, 인플루언서
 * ============================================================ */

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
  ecOptionGrid('ec-model-ratio', EC_RATIO_STANDARD, 'modelRatio', 0);
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
      hairColor: EC_STATE.modelHairColor, skinTone: EC_STATE.modelSkin, height: EC_STATE.modelHeight,
      aspectRatio: EC_STATE.modelRatio,
      count: parseInt(document.getElementById('ec-model-count')?.value) || 2,
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
  ecOptionGrid('ec-inf-ratio', EC_RATIO_STANDARD, 'infRatio', 0);
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
      aspectRatio: EC_STATE.infRatio,
      count: parseInt(document.getElementById('ec-inf-count')?.value) || 2,
      additionalPrompt: document.getElementById('ec-inf-extra').value,
    }});
    ecRenderImages('ec-inf-results', res.images || []);
    if ((res.images || []).length) toast('인플루언서 이미지 생성 완료!');
  } catch (e) { document.getElementById('ec-inf-results').innerHTML = ''; toast('생성 실패: ' + e.message, 'error'); }
}
