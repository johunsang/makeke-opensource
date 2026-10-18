/**
 * video_agent/plan.js
 * 영상 에이전트 (plan 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  var VAG_ATLAS_GPT_IMAGE2_EDIT = 'openai/gpt-image-2-developer/edit';
  var VAG_PERSON_SAFE_IMAGE_VIDEO_MODEL = 'atlascloud/wan-2.2-turbo-spicy/image-to-video';
  var VAG_CHEAP_IMAGE_VIDEO_MODEL = VAG_PERSON_SAFE_IMAGE_VIDEO_MODEL;
  V._vagIsTransientAIGenerateFailure = function _vagIsTransientAIGenerateFailure(status, detail) {
    var code = Number(status || 0) || 0;
    var text = String(detail || '').toLowerCase();
    if ([429, 500, 502, 503, 504].indexOf(code) >= 0) return true;
    return /bad gateway|server error|temporar|timeout|deadline|overload|rate limit|unavailable|try again|html lang=en/i.test(text);
  };

  function _vagSleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function _vagBuildFallbackLongformPlan(payload, targetSec, detail) {
    var total = Math.max(180, Number(targetSec || 0) || 180);
    var chapterCount = Math.max(2, Math.min(6, Math.ceil(total / 90)));
    var chapterDuration = Math.round(total / chapterCount);
    var keyPoints = Array.isArray(payload && payload.key_points) ? payload.key_points : [];
    var topic = String((payload && payload.product) || '마케팅 영상').replace(/\s+/g, ' ').trim();
    var chapters = [];
    for (var i = 0; i < chapterCount; i++) {
      var point = keyPoints[i % Math.max(1, keyPoints.length)] || '';
      var title = i === 0
        ? '핵심 문제 각인'
        : i === chapterCount - 1
          ? '해결과 CTA'
          : '근거와 전환 설계 ' + (i + 1);
      chapters.push({
        index: i + 1,
        title: title,
        summary: point || topic,
        angle: i === 0 ? '문제 제기' : i === chapterCount - 1 ? '행동 유도' : '근거 확장',
        mood: i === 0 ? '긴장감' : i === chapterCount - 1 ? '확신' : '분석적',
        tone_shift: i === 0 ? '직설적인 질문' : i === chapterCount - 1 ? '명확한 제안' : '증거 중심',
        image_direction: '브랜드 색상과 실제 자료를 활용한 모션 그래픽',
        visual_style: 'high-end marketing motion',
        hero_element: topic,
        color_palette: [],
        key_points: point ? [point] : keyPoints.slice(0, 3),
        duration_sec: chapterDuration,
        scene_count: Math.max(3, Math.min(6, Math.round(chapterDuration / 18))),
      });
    }
    return {
      ok: true,
      fallback: true,
      overall_arc: '장편 플랜 API 실패 후 기본 챕터 플랜으로 계속 진행합니다.',
      total_duration_sec: chapterDuration * chapterCount,
      chapters: chapters,
      detail: detail || '',
    };
  }

  function _vagExpectedSceneCountForDuration(duration) {
    var sec = Number(duration || 0) || 0;
    if (sec <= 20) return 2;
    if (sec <= 35) return 4;
    if (sec <= 45) return 5;
    if (sec <= 75) return 6;
    if (sec <= 135) return 8;
    return Math.max(10, Math.min(18, Math.round(sec / 18)));
  }

  function _vagReadBackgroundCandidateCount() {
    var raw = ((document.getElementById('vag-bg-image-candidates') || {}).value || '1').trim();
    var n = parseInt(raw, 10);
    if (!isFinite(n) || n < 1) n = 1;
    return Math.max(1, Math.min(12, n));
  }

  function _vagImageVideoHasPeopleRisk(scene, session) {
    var s = scene || {};
    var ctx = [
      session && session.personMode,
      session && session.campaignModel && session.campaignModel.prompt,
      session && session.characterImageUrl,
      s.title,
      s.body,
      s.narration,
      s.imagePrompt || s.image_prompt,
      s.cutPlan || s.cut_plan,
      s.subjectAction || s.subject_action,
      s.lipSyncHint || s.lip_sync_hint,
    ].filter(Boolean).join(' ');
    if (/사람\s*없이|인물\s*없이|얼굴\s*없이|손\s*없이|no\s*(people|person|face|hand)|without\s*(people|person|face|hand)/i.test(ctx)) {
      return false;
    }
    return !!(session && (session.campaignModel || session.characterImageUrl || session.personMode === '사람 등장'))
      || /사람|인물|얼굴|손|모델|진행자|강사|대표|인터뷰|말하는|입모양|립싱크|미소|표정|시선|헤어|의상|presenter|person|people|face|hand|model|lip.?sync|talk/i.test(ctx);
  }

  function _vagResolveImageVideoModelForScene(requestedModel, scene) {
    var model = String(requestedModel || VAG_CHEAP_IMAGE_VIDEO_MODEL).trim();
    if (model === VAG_CHEAP_IMAGE_VIDEO_MODEL && _vagImageVideoHasPeopleRisk(scene, V._vagSession || {})) {
      return VAG_PERSON_SAFE_IMAGE_VIDEO_MODEL;
    }
    return model;
  }

  function _vagResolveConfiguredImageModel() {
    var candidates = [];
    try {
      if (window._contentOpts && window._contentOpts.image_model) candidates.push(window._contentOpts.image_model);
      var settingsModel = (document.getElementById('set-image-model') || {}).value;
      if (settingsModel) candidates.push(settingsModel);
      var legacyGeminiModel = (document.getElementById('set-gemini-model') || {}).value;
      if (legacyGeminiModel) candidates.push(legacyGeminiModel);
    } catch (_) {}
    try {
      var profile = window._globalProfileData || {};
      ['image_model', 'ai_image_model', 'gemini_image_model', 'profile_image_model'].forEach(function (key) {
        if (profile[key]) candidates.push(profile[key]);
      });
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var value = String(candidates[i] || '').trim();
      if (value) return value;
    }
    return 'gemini-3.1-flash-image-preview';
  }

  function _vagResolveConfiguredImageProvider() {
    var candidates = [];
    try {
      if (window._contentOpts && window._contentOpts.image_provider) candidates.push(window._contentOpts.image_provider);
      var settingsProvider = (document.getElementById('set-image-provider') || {}).value;
      if (settingsProvider) candidates.push(settingsProvider);
    } catch (_) {}
    try {
      var profile = window._globalProfileData || {};
      ['image_provider', 'ai_image_provider', 'profile_image_provider'].forEach(function (key) {
        if (profile[key]) candidates.push(profile[key]);
      });
    } catch (_) {}
    for (var i = 0; i < candidates.length; i++) {
      var value = String(candidates[i] || '').trim().toLowerCase();
      if (value) return value;
    }
    return '';
  }

  function _vagConfiguredImageModeForAuto(hasRefs) {
    var provider = _vagResolveConfiguredImageProvider();
    var model = _vagResolveConfiguredImageModel();
    var lower = String(model || '').toLowerCase();
    if (provider === 'codex' || lower === 'codex-cli') return 'codex-cli';
    if (/qwen\/qwen-image-2\.0-pro\/edit/.test(lower)) return hasRefs ? 'qwen-image-2-pro-edit' : '';
    if (/alibaba\/qwen-image\/edit/.test(lower)) return hasRefs ? 'qwen-product-edit' : '';
    if (/gpt-image-2.*\/edit/.test(lower)) return hasRefs ? 'gpt-image-2-edit' : '';
    if (/nano-banana.*edit/.test(lower)) return hasRefs ? 'nano-banana-2-edit' : '';
    if (/nano-banana|gemini|imagen/.test(lower)) return hasRefs ? 'nano-banana-2-edit' : 'nano-banana-2-text';
    return hasRefs ? 'gpt-image-2-edit' : 'nano-banana-2-text';
  }

  function _vagVideoImageModeUsesAtlas(mode) {
    return /qwen|gpt-image-2/i.test(String(mode || ''));
  }

  function _vagAtlasImageModelForMode(mode, hasRefs) {
    if (mode === 'gpt-image-2-edit') return VAG_ATLAS_GPT_IMAGE2_EDIT;
    if (mode === 'qwen-product-edit') return 'alibaba/qwen-image/edit-plus-20251215';
    if (mode === 'qwen-image-2-pro-edit') return 'qwen/qwen-image-2.0-pro/edit';
    return VAG_ATLAS_GPT_IMAGE2_EDIT;
  }

  async function _vagSyncProfileBrandAssetsForGeneration() {
    if (!V._vagSession) V._vagSession = {};
    var profileColor = typeof V._vagResolveProfileBrandColor === 'function'
      ? V._vagResolveProfileBrandColor(window._globalProfileData || {})
      : '';
    if (profileColor) {
      V._vagSession.brandColor = profileColor;
    }
    if (!V._vagLogoDataUrl && V._vagSession.logoDataUrl) {
      V._vagLogoDataUrl = V._vagSession.logoDataUrl;
    }
    if (typeof V._vagEnsureProfileLogoReference === 'function') {
      try {
        await V._vagEnsureProfileLogoReference({ silent: true });
      } catch (_) {}
    }
    if (V._vagLogoDataUrl) {
      V._vagSession.logoDataUrl = V._vagLogoDataUrl;
      if (typeof V._vagRegisterLogoReferenceDataUrl === 'function') {
        V._vagRegisterLogoReferenceDataUrl(V._vagLogoDataUrl, '프로필 로고');
      }
    }
    if (typeof V._vagBuildProfileDesignGuideBlock === 'function') {
      V._vagSession.profileDesignGuide = V._vagBuildProfileDesignGuideBlock();
    }
    return {
      brandColor: V._vagSession.brandColor || '',
      logoDataUrl: V._vagLogoDataUrl || V._vagSession.logoDataUrl || '',
      designGuide: V._vagSession.profileDesignGuide || '',
    };
  }

  function _vagBackgroundCandidateURL(candidate) {
    return candidate && (candidate.url || candidate.path) ? String(candidate.url || candidate.path) : '';
  }

  function _vagApplyDefaultSceneBackgroundSelection(sceneImages) {
    var state = { hasMultiple: false, selectedCount: 0 };
    if (!Array.isArray(sceneImages)) return state;
    sceneImages.forEach(function (item) {
      if (!item) return;
      var candidates = Array.isArray(item.candidates) && item.candidates.length ? item.candidates : [item];
      candidates = candidates.filter(function (candidate) { return !!_vagBackgroundCandidateURL(candidate); });
      if (candidates.length > 1) state.hasMultiple = true;
      var currentURL = _vagBackgroundCandidateURL(item);
      if (!currentURL && candidates.length) {
        currentURL = _vagBackgroundCandidateURL(candidates[0]);
        item.url = currentURL;
        item.defaultSelected = true;
      }
      if (currentURL) {
        item.userSelected = true;
        state.selectedCount += 1;
      }
    });
    return state;
  }

  function _vagHtmlReferenceImages() {
    return (V._vagAttachedImages || []).filter(function (item) {
      return item && item.source !== 'profile-logo' && item.dataUrl;
    }).map(function (item) {
      return item.dataUrl;
    });
  }

  function _vagLogoReferenceImages() {
    var refs = (V._vagAttachedImages || []).filter(function (item) {
      return item && item.source === 'profile-logo' && /^data:image\//i.test(String(item.dataUrl || ''));
    });
    var sessionLogo = String((V._vagSession && V._vagSession.logoDataUrl) || V._vagLogoDataUrl || '').trim();
    if (/^data:image\//i.test(sessionLogo) && !refs.some(function (item) { return item.dataUrl === sessionLogo; })) {
      refs.unshift({ name: '프로필 로고', dataUrl: sessionLogo, source: 'profile-logo', role: 'brand-reference' });
    }
    return refs;
  }

  function _vagCurrentVideoAspectRatioCSS() {
    var aspect = String((V._vagSession && V._vagSession.aspect) || (document.getElementById('vag-aspect') || {}).value || '9:16').trim();
    if (aspect === '16:9') return '16/9';
    if (aspect === '1:1') return '1/1';
    if (aspect === '4:3') return '4/3';
    if (aspect === '3:4') return '3/4';
    return '9/16';
  }

  function _vagImageVariationLabel(index, objective) {
    var goal = String(objective || '').toLowerCase();
    var productFirst = /상품|판매|전환|구매|앱|가입/.test(goal);
    var brandFirst = /브랜드|ci|인지/.test(goal);
    var pool = productFirst
      ? ['상품 히어로 컷', '사용 장면 컷', '문제 상황 컷', '결과/혜택 컷', '상세 질감 컷', 'CTA 엔드 컷']
      : brandFirst
        ? ['브랜드 무드 컷', 'CI 컬러 컷', '철학/가치 컷', '프리미엄 공간 컷', '상징 오브젝트 컷', '엔드 락업 컷']
        : ['핵심 메시지 컷', '고객 문제 컷', '해결 장면 컷', '근거/데이터 컷', '감정 무드 컷', 'CTA 컷'];
    return pool[Math.max(0, index) % pool.length];
  }

  function _vagImageVariationInstruction(label, sceneIndex) {
    return [
      '이미지 베리에이션: ' + label + '.',
      '씬 ' + sceneIndex + '의 같은 메시지를 유지하되 이 베리에이션 목적에 맞게 피사체, 구도, 거리감, 조명, 배경 질감을 분명히 다르게 만든다.',
      '화면 문구가 올라갈 여백을 남기고, 광고 이미지처럼 제품/브랜드/상황이 즉시 읽히게 만든다.',
    ].join('\n');
  }

  function _vagSceneValue(scene, camelKey, snakeKey) {
    return String(scene && (scene[camelKey] || scene[snakeKey]) || '').trim();
  }

  function _vagSceneProductionFields(scene) {
    return {
      shotType: _vagSceneValue(scene, 'shotType', 'shot_type'),
      subjectAction: _vagSceneValue(scene, 'subjectAction', 'subject_action'),
      camera: _vagSceneValue(scene, 'camera', 'camera'),
      lens: _vagSceneValue(scene, 'lens', 'lens'),
      lighting: _vagSceneValue(scene, 'lighting', 'lighting'),
      artDirection: _vagSceneValue(scene, 'artDirection', 'art_direction'),
      propsWardrobe: _vagSceneValue(scene, 'propsWardrobe', 'props_wardrobe'),
      composition: _vagSceneValue(scene, 'composition', 'composition'),
      transition: _vagSceneValue(scene, 'transition', 'transition'),
      soundCue: _vagSceneValue(scene, 'soundCue', 'sound_cue'),
      editBeat: _vagSceneValue(scene, 'editBeat', 'edit_beat'),
      lipSyncHint: _vagSceneValue(scene, 'lipSyncHint', 'lip_sync_hint'),
      negativeConstraints: _vagSceneValue(scene, 'negativeConstraints', 'negative_constraints'),
    };
  }

  function _vagAutoProductionStoryboard(scene, index, total) {
    var s = scene || {};
    var idx = Number(index || 0);
    var count = Math.max(1, Number(total || 1));
    var text = [s.role, s.visualMode || s.visual_mode, s.title, s.body, s.narration, s.imagePrompt || s.image_prompt].join(' ').toLowerCase();
    var personless = V._vagSession && V._vagSession.personMode === '사람 없이 제품·공간·그래픽 중심';
    var isFirst = idx === 0;
    var isLast = idx >= count - 1;
    var isProduct = /product|상품|제품|사용|데모|손|구매|전환/.test(text);
    var isProof = /proof|data|근거|숫자|비교|전후|증거/.test(text);
    var isCTA = isLast || /cta|lockup|문의|상담|예약|신청|바로/.test(text);
    var isImageOnly = /image_only|cinematic_image|풀블리드|시네마틱/.test(text);
    var shotType = isCTA
      ? 'hero CTA lockup with generous negative space'
      : isProduct
        ? 'macro product detail and medium lifestyle hand-use shot'
        : isProof
          ? 'over-shoulder proof detail shot'
          : isFirst
            ? 'extreme close-up pattern-interrupt hook shot'
            : isImageOnly
              ? 'full-bleed cinematic hero image shot'
              : 'medium cinematic lifestyle advertising shot';
    var subjectAction = personless
      ? (isProduct ? '제품과 핵심 사용 상황이 손 모델 없이 표면, 그림자, 주변 소품의 움직임으로 드러난다.' : '공간, 오브젝트, 데이터 단서가 씬 메시지를 순서대로 드러내며 사람은 등장하지 않는다.')
      : isProduct
        ? '같은 주인공이 제품/서비스를 실제로 사용하는 손동작과 시선 이동으로 효용을 보여준다.'
        : isProof
          ? '같은 주인공이 화면 밖 근거를 확인한 뒤 시청자 쪽으로 확신 있게 시선을 돌린다.'
          : isCTA
            ? '같은 주인공 또는 제품 히어로가 안정적으로 멈춰 CTA 문구가 올라갈 여백을 남긴다.'
            : '같은 주인공이 씬 메시지에 맞는 한 가지 자연스러운 행동을 수행한다.';
    var camera = isCTA
      ? 'locked-off frame with a very slow pull-back, CTA safe area held for the final beat'
      : isFirst
        ? '0.8초 정지 후 slow push-in, 시선이 핵심 피사체에 고정되게 프레이밍'
        : 'subtle push-in with slight parallax pan, subject remains centered inside text-safe margins';
    var lens = isProduct
      ? '70mm macro/detail feel, shallow depth of field, crisp surface texture'
      : '35mm cinematic commercial lens, soft background separation, natural focus falloff';
    var lighting = isFirst
      ? 'high-contrast key light with warm citrus accent rim, immediate hook energy'
      : isCTA
        ? 'clean soft key light with confident warm highlight and calm shadow'
        : 'directional soft light, warm accent reflection, premium but natural contrast';
    var artDirection = isProduct
      ? '브랜드 컬러가 작은 소품/반사광으로만 보이고 제품 질감과 실제 사용 맥락이 먼저 읽힌다.'
      : '브랜드 톤, 자료 맥락, 선택한 배경 컨셉이 같은 촬영 세트처럼 이어지는 공간/표면 질감.';
    var propsWardrobe = personless
      ? '의상 없음. 제품, 서류, 모바일 화면, 표면 질감, 빛 반사 같은 오브젝트만 사용.'
      : '주인공 의상·헤어·손 스타일은 레퍼런스와 동일하게 유지하고 소품은 씬 목적에 필요한 것만 둔다.';
    var composition = isCTA
      ? 'subject on lower third or center hero, large clean safe area for CTA and brand lockup'
      : '핵심 피사체와 텍스트 안전 영역을 분리하고 세로 화면에서는 얼굴/제품이 위아래로 잘리지 않게 둔다.';
    var transition = isFirst
      ? 'hard visual hook into soft match-cut for scene 2'
      : isCTA
        ? 'previous motion resolves into a stable CTA lockup hold'
        : 'match color, gaze direction, or object movement from previous scene into the next scene';
    var soundCue = isFirst
      ? '첫 1초 짧은 sound design hit 후 나레이션이 들어갈 빈 공간'
      : isCTA
        ? 'CTA 직전 작은 lift 후 안정적인 resolve tail'
        : '나레이션 핵심어에 맞춰 작은 percussion tick 또는 synth swell';
    var editBeat = isFirst
      ? 'hold 0.6s, reveal 0.4s, title punch on the next beat'
      : isCTA
        ? 'motion slows, CTA holds at least 1.2s, final frame breathes'
        : 'narration clause마다 hold, focus, reveal이 한 번씩 반응';
    var lipSyncHint = (!personless && s.narration && !isProduct && !isProof && !isCTA)
      ? '주인공 얼굴이 보이면 나레이션 첫 문장을 작게 말하듯 입모양, 표정, 시선, 손 제스처를 문장 호흡에 맞춘다.'
      : 'lip sync 없음';
    return {
      shotType: shotType,
      subjectAction: subjectAction,
      camera: camera,
      lens: lens,
      lighting: lighting,
      artDirection: artDirection,
      propsWardrobe: propsWardrobe,
      composition: composition,
      transition: transition,
      soundCue: soundCue,
      editBeat: editBeat,
      lipSyncHint: lipSyncHint,
      negativeConstraints: '텍스트/로고/워터마크 생성 금지, 다른 인물/다른 손/다른 얼굴/다른 브랜드 무드 금지, 세로 비율에서 얼굴·제품 크롭 금지',
    };
  }

  function _vagEnsureProductionStoryboard(scene, index, total) {
    var s = Object.assign({}, scene || {});
    var auto = _vagAutoProductionStoryboard(s, index, total);
    [
      ['shotType', 'shot_type'],
      ['subjectAction', 'subject_action'],
      ['camera', 'camera'],
      ['lens', 'lens'],
      ['lighting', 'lighting'],
      ['artDirection', 'art_direction'],
      ['propsWardrobe', 'props_wardrobe'],
      ['composition', 'composition'],
      ['transition', 'transition'],
      ['soundCue', 'sound_cue'],
      ['editBeat', 'edit_beat'],
      ['lipSyncHint', 'lip_sync_hint'],
      ['negativeConstraints', 'negative_constraints'],
    ].forEach(function (pair) {
      var camel = pair[0];
      var snake = pair[1];
      if (!String(s[camel] || s[snake] || '').trim()) {
        s[camel] = auto[camel];
        s[snake] = auto[camel];
      }
    });
    return s;
  }

  function _vagBuildProductionBriefLines(scene) {
    var p = _vagSceneProductionFields(scene);
    return [
      p.shotType ? '쇼트 타입: ' + p.shotType : '',
      p.subjectAction ? '피사체 행동: ' + p.subjectAction : '',
      p.camera ? '카메라: ' + p.camera : '',
      p.lens ? '렌즈/초점: ' + p.lens : '',
      p.lighting ? '조명: ' + p.lighting : '',
      p.artDirection ? '미술/공간: ' + p.artDirection : '',
      p.propsWardrobe ? '소품/의상: ' + p.propsWardrobe : '',
      p.composition ? '구도/안전 여백: ' + p.composition : '',
      p.transition ? '전환: ' + p.transition : '',
      p.soundCue ? '사운드 큐: ' + p.soundCue : '',
      p.editBeat ? '편집 비트: ' + p.editBeat : '',
      p.lipSyncHint ? 'Lip-sync 지시: ' + p.lipSyncHint : '',
      p.negativeConstraints ? '금지/제약: ' + p.negativeConstraints : '',
    ].filter(Boolean);
  }

  function _vagBuildAttachedMaterialDesignContract(rawSource, designGuide) {
    var sourceText = String(rawSource || '').trim();
    var sourcePriority = !!(V._vagSession && V._vagSession.sourcePriority);
    var sourceMode = (V._vagSession && V._vagSession.sourceMode) || V._vagSourceMode || '';
    var sourceLimit = sourcePriority ? 5200 : 2800;
    var attachedSources = Array.isArray(V._vagAttachedSources) ? V._vagAttachedSources.slice(0, 10) : [];
    var attachedImages = Array.isArray(V._vagAttachedImages) ? V._vagAttachedImages.length : 0;
    var lines = [
      '[첨부소재·브랜드 디자인 반영 필수 계약]',
      '- 아래 첨부소재와 브랜드 디자인 규칙은 선택 참고가 아니라 이번 생성의 최상위 입력이다.',
      '- 씬 title/body/narration/emphasis/image_prompt/cut_plan은 첨부소재의 핵심 문제, 수치, 고유명사, 제품/서비스 특징, 고객 상황을 최소 1개 이상 직접 반영해야 한다.',
      '- 첨부소재가 있는데 일반적인 브랜드 소개, 추상 광고 문구, 앱 기본 템플릿 문구만 만들면 실패다.',
      '- 브랜드 디자인 규칙은 색상, 타이포, 레이아웃, 이미지 톤, CTA, 금지 규칙까지 HyperFrames HTML과 배경 컨셉 이미지 프롬프트에 모두 적용한다.',
      '- 디자인 규칙과 소재 내용이 충돌하면 소재의 사실관계는 유지하고, 표현 방식과 시각 언어는 디자인 규칙을 따른다.',
      '- 모델 일관성: 프로필 로고, 상품, 공간, 주인공, 첨부 이미지는 매 씬 같은 reference 묶음으로 유지한다. 씬마다 다른 로고·다른 인물·다른 상품·다른 브랜드처럼 보이면 실패다.',
      sourceMode ? '- 소재 입력 방식: ' + sourceMode : '',
      attachedImages ? '- 첨부 이미지 수: ' + attachedImages + '장. 배경 컨셉 이미지 생성 시 색감, 구도, 제품/공간/로고 단서를 실제 reference로 반영한다.' : '',
    ];
    if (attachedSources.length) {
      lines.push('[첨부 자료 목록]');
      attachedSources.forEach(function (row, idx) {
        var title = String(row && row.title || '').trim();
        var url = String(row && row.url || '').trim();
        var snippet = String(row && row.snippet || row && row.description || '').replace(/\s+/g, ' ').trim();
        lines.push((idx + 1) + '. ' + [
          row && row.type ? '[' + row.type + ']' : '',
          title || '제목 없음',
          url ? 'URL=' + url : '',
          snippet ? '요약=' + snippet.slice(0, 520) : '',
        ].filter(Boolean).join(' / '));
      });
    }
    if (sourceText) {
      lines.push('[첨부소재 원문]');
      lines.push(sourceText.slice(0, sourceLimit));
    }
    if (designGuide) {
      lines.push('[브랜드 디자인 규칙 원문]');
      lines.push(String(designGuide || '').slice(0, 4200));
    }
    lines.push('[반영 검증]');
    lines.push('- 최종 HyperFrames HTML 생성 시 화면 카피와 data-vag-narration이 첨부소재와 무관하면 실패로 간주한다.');
    lines.push('- 배경 컨셉 이미지 프롬프트가 디자인 규칙의 색상·이미지 톤·금지 요소를 반영하지 않으면 실패로 간주한다.');
    return lines.filter(Boolean).join('\n');
  }

  function _vagBuildCharacterReferenceLines(session) {
    var current = session || V._vagSession || {};
    var model = current.campaignModel || null;
    if (!model && !current.characterImageUrl) return [];
    return [
      '[주인공 모델 고정]',
      '사용자가 선택/생성한 주인공 모델을 이번 광고의 캐스팅 기준으로 사용한다.',
      model ? '모델 라벨: ' + model.label : '',
      model && model.prompt ? '모델 세팅: ' + model.prompt : '',
      current.characterImageUrl ? '모델 기준 이미지 URL: ' + current.characterImageUrl : '',
      '절대 규칙: 화면에 보이는 유일한 성인 모델/얼굴/손 모델은 이 주인공이어야 한다.',
      '사람이 등장하는 모든 씬은 이 모델의 성별, 얼굴형, 헤어, 연령대, 의상 계열, 표정 에너지를 유지한다.',
      '다른 얼굴, 다른 성별, 남성/여성 대체 모델, 랜덤 손 모델, 배경 인물, 새 인플루언서를 만들지 않는다.',
      '씬 메시지상 고객/상담자/직원/성공한 사람/문제 상황 인물이 필요해도 같은 주인공 1명으로 연기하거나, 인물을 빼고 제품/공간/오브젝트만 보여준다.',
      '기준 이미지의 인물과 다르게 보이는 후보는 실패 이미지다.',
    ].filter(Boolean);
  }

  function _vagExtendNarrationScriptForAudio(script, options) {
    var opts = options || {};
    var target = Number(opts.duration || 0) || 0;
    var plan = Array.isArray(opts.plan) ? opts.plan : [];
    var cta = String(opts.cta || '').replace(/\s+/g, ' ').trim();
    var lines = String(script || '').split(/\n+/).map(function (line) {
      return String(line || '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    var targetChars = target >= 25 ? Math.round(target * 6.1) : 0;
    var maxChars = target >= 25 ? Math.round(target * 7.4) : 0;
    var candidates = [];
    plan.forEach(function (scene) {
      if (!scene) return;
      [
        scene.narration,
        scene.title && scene.body ? scene.title + '. ' + scene.body : '',
        scene.imagePrompt || scene.image_prompt,
      ].forEach(function (text) {
        var clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (clean) candidates.push(clean);
      });
    });
    candidates = candidates.concat([
      '마케케는 첨부된 소재와 로고, 브랜드 색상, 디자인 규칙을 같은 기준으로 유지해 장면마다 다른 브랜드처럼 보이지 않게 만듭니다.',
      '블로그와 카드뉴스, 소셜 미디어와 영상까지 하나의 흐름으로 이어져 반복되는 제작 시간을 줄입니다.',
      '이미지는 분위기를 만들고, 문구와 상담 유도는 화면 위에서 또렷하게 보여줍니다.',
      cta ? cta.replace(/[.!?。！？]*$/, '') + '로 다음 행동까지 자연스럽게 연결합니다.' : '',
    ]);
    function exists(line) {
      var compact = String(line || '').replace(/\s+/g, '');
      return lines.some(function (item) { return item.replace(/\s+/g, '') === compact; });
    }
    for (var i = 0; i < candidates.length; i++) {
      var line = String(candidates[i] || '').replace(/\s+/g, ' ').trim();
      if (!line || exists(line)) continue;
      if (!/[.!?。！？요다까죠니다]$/.test(line)) line += '.';
      if (maxChars && lines.join('').length + line.length > maxChars) continue;
      lines.push(line);
      if (targetChars && lines.join('').length >= targetChars) break;
    }
    return lines.join('\n').trim();
  }

  function _vagRenderCharacterReferenceCard(imageUrl, model) {
    if (!imageUrl || typeof V._addMsg !== 'function') return;
    V._addMsg('ai',
      '<div style="border:1px solid rgba(255,140,0,0.18);background:#fff;border-radius:14px;padding:10px;max-width:420px;display:grid;gap:8px;">' +
        '<div style="font-size:12px;font-weight:950;color:#9a4a00;">광고 주인공 기준 사진</div>' +
        '<img src="' + V._esc(imageUrl) + '" alt="광고 주인공 기준 사진" style="width:100%;max-height:260px;object-fit:contain;border-radius:10px;background:#111;">' +
        '<div style="font-size:11px;line-height:1.55;color:rgba(0,0,0,0.62);">장면마다 주인공이 달라 보이지 않도록 이 사진을 기준으로 맞춰 만듭니다.</div>' +
        (model && model.label ? '<div style="font-size:10px;font-weight:850;color:rgba(0,0,0,0.46);">' + V._esc(model.label) + '</div>' : '') +
      '</div>',
      { html: true }
    );
  }

  function _vagShouldUseLipSync(scene) {
    var p = _vagSceneProductionFields(scene);
    var text = [
      scene && scene.narration,
      scene && scene.role,
      scene && scene.title,
      scene && scene.body,
      p.subjectAction,
      p.lipSyncHint,
    ].filter(Boolean).join(' ');
    if (!String(scene && scene.narration || '').trim()) return false;
    if (/lip sync 없음|입모양 없음|말하지 않/i.test(p.lipSyncHint)) return false;
    return /말|대사|설명|인터뷰|카메라를 보|입모양|lip|speak|talk|dialogue/i.test(text);
  }

  async function _vagPersistCampaignCharacterReference(url, meta) {
    var session = V._vagSession || {};
    var model = session.campaignModel || null;
    if (!model || !url || model.savedCharacterId || session.savedCharacterId) return;
    try {
      var profileId = parseInt(window._globalProfileId || 0, 10) || 0;
      var resp = await V._vagFetch('/api/vag/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profileId,
          name: model.label || '주인공 모델',
          label: model.label || '',
          prompt: model.prompt || '',
          settings: model.settings || {},
          image_url: url,
          provider: (meta && meta.provider) || '',
          model: (meta && meta.model) || '',
          source_topic: (meta && meta.topic) || '',
          source_objective: (meta && meta.objective) || '',
        }),
      });
      var data = await resp.json().catch(function () { return {}; });
      if (resp.ok && data && data.id) {
        model.savedCharacterId = data.id;
        session.savedCharacterId = data.id;
        if (model.settings) model.settings.savedCharacterId = data.id;
        V._addMsg('ai', '💾 주인공 모델을 저장했습니다. 다음 영상에서도 같은 모델을 불러올 수 있습니다.');
      }
    } catch (err) {
      V._addMsg('ai', '<span style="color:#ff9500;">주인공 모델 저장은 실패했지만 현재 생성은 계속합니다: ' + V._esc(err.message || err) + '</span>', { html: true });
    }
  }

  function _vagBuildScenarioLockedImagePrompt(scene, sceneIndex, totalScenes, variationLabel) {
    var s = scene || {};
    var title = String(s.title || '').trim();
    var body = String(s.body || '').trim();
    var narration = String(s.narration || '').trim();
    var role = String(s.role || '').trim();
    var visualMode = String(s.visualMode || s.visual_mode || '').trim();
    var cutPlan = String(s.cutPlan || s.cut_plan || '').trim();
    var imagePrompt = String(s.imagePrompt || s.image_prompt || '').trim();
    var emphasis = Array.isArray(s.emphasis) ? s.emphasis.filter(Boolean).join(', ') : '';
    var fallbackScene = [title, body, narration].filter(Boolean).join(' / ');
    var productionLines = _vagBuildProductionBriefLines(s);
    var designGuide = (V._vagSession && V._vagSession.profileDesignGuide)
      || (typeof V._vagBuildProfileDesignGuideBlock === 'function' ? V._vagBuildProfileDesignGuideBlock() : '');
    return [
      '[확정된 씬 콘티 기준]',
      '이 이미지는 전체 콘셉트용 추상 이미지가 아니라, 확정된 씬 콘티의 씬 ' + sceneIndex + '/' + totalScenes + '을 시각화하는 기준 이미지다.',
      designGuide ? '[프로필 디자인 규칙 최우선]\n' + designGuide : '',
      designGuide ? '규칙: 위 프로필 디자인 규칙의 대표 색상, 레이아웃, 이미지 톤, 금지 규칙을 이 씬 배경 이미지에 반드시 반영한다. 앱 기본색이나 임의 스타일로 바꾸지 않는다.' : '',
      role ? '씬 역할: ' + role : '',
      title ? '씬 목적/시각적 의미: ' + title : '',
      body ? 'HyperFrames로 나중에 얹을 문구의 의미: ' + body : '',
      narration ? '나레이션 의미: ' + narration : '',
      emphasis ? '강조 포인트: ' + emphasis : '',
      visualMode ? '시각 모드: ' + visualMode : '',
      cutPlan ? '컷/카메라 플랜: ' + cutPlan : '',
      variationLabel ? '후보 목적: ' + variationLabel : '',
      productionLines.length ? '[프로덕션 콘티]\n' + productionLines.join('\n') : '',
      '[씬별 이미지 생성 지시]',
      '글자 없는 순수 촬영 이미지/키비주얼로 만든다. 한글, 영어, 숫자, 간판 글자, 노트북/스마트폰/줌 화면 속 이름표, 채팅 문구, 차트 글자, 버튼 글자, UI 문구, 자막, 가짜 로고 텍스트, CTA 텍스트는 이미지 안에 절대 생성하지 않는다.',
      '화상회의/줌/앱 화면이 필요하면 사람 얼굴 썸네일, 빈 패널, 추상 선, 추상 카드만 사용한다. 실제 읽히는 글자나 숫자처럼 보이는 글리프도 실패다.',
      (V._vagLogoDataUrl || (V._vagSession && V._vagSession.logoDataUrl)) ? '프로필 로고 reference가 제공되었다. 새 로고를 만들지 말고 제공된 실제 로고를 안전영역 밖의 간판, 제품 표식, 앱 아이콘, 패키지 라벨, 공간 소품 중 하나로 배경 이미지 안에 반드시 자연스럽게 합성한다. 최종 HyperFrames HTML에서 로고를 따로 얹지 않는다.' : '',
      '광고 문구, 자막, CTA, 가격, 데이터, 브랜드 표기는 모두 이후 HyperFrames HTML/GSAP 레이어에서 얹는다. 이미지는 인물/제품/공간/행동/조명/구도만 담당한다.',
      '영상 배경으로 적합하게 만든다. 이미지는 전체적으로 선명해야 하며, 이미지 파일 자체에 초점이 무너진 처리, 검은 빈 영역, 반쪽 분할, 텍스트 패널을 만들지 않는다. 읽기 대비는 이후 HyperFrames HTML 오버레이가 담당한다.',
      '배경 이미지로서의 밝기, 대비, 여백은 AI가 장면에 맞게 판단하되 피사체와 공간 정체성이 분명히 보이게 한다.',
      '가장 중요한 우선순위는 위 시나리오 메시지를 배경 컨셉 이미지 한 장으로 이해시키는 것이다. 배경 컨셉은 이 씬 메시지를 표현하기 위한 스타일 가이드로만 사용한다.',
      '선택 비율과 방향을 지킨다. 세로/가로가 뒤집히거나 카메라가 90도 회전된 이미지, 누운 사람, 기울어진 배경, EXIF 회전 오류처럼 보이는 결과는 실패다.',
      '피사체, 행동/상황, 장소, 카메라 거리, 렌즈/심도, 조명, 색감, 소품, 배경 여백을 이 씬 내용에 맞게 구체화한다.',
      '이전/다음 씬과 캠페인 세계관은 이어지되, 이 씬의 역할과 나레이션 의미가 다른 씬 이미지와 구분되어야 한다.',
      imagePrompt ? 'AI 시나리오가 제안한 image_prompt: ' + imagePrompt : 'image_prompt가 비어 있으면 다음 씬 메시지를 촬영 가능한 장면으로 바꾼다: ' + fallbackScene,
      '인물이 필요하면 선택/생성된 주인공 레퍼런스의 동일 인물만 사용한다. 다른 모델, 다른 손, 다른 얼굴, 배경 인물은 만들지 않는다.',
    ].filter(Boolean).join('\n');
  }

    function _vagBuildImageVideoMotionPrompt(scene, image, sceneIndex, totalScenes, mode) {
      var s = scene || {};
    var title = String(s.title || '').trim();
    var body = String(s.body || '').trim();
    var narration = String(s.narration || '').trim();
    var cutPlan = String(s.cutPlan || s.cut_plan || '').trim();
    var visualMode = String(s.visualMode || s.visual_mode || '').trim();
    var productionLines = _vagBuildProductionBriefLines(s);
    var lipSync = _vagShouldUseLipSync(s);
      var modeLabel = mode === 'product'
      ? '제품/모델 행동 강조'
      : mode === 'cta'
        ? 'CTA 엔드컷 강조'
        : mode === 'camera'
          ? '카메라 무빙 강조'
        : '시나리오 컷 플랜';
      var directionBlock = _vagBuildImageVideoDirectionBlock(V._vagSession && V._vagSession.imageVideoDirection, '이번 클립 영상 디렉션');
      return '이미지를 거의 그대로 유지하고 아주 미세한 카메라 움직임만. 새로운 물체/사람/장면/글자 추가 금지.';
    }

    function _vagBuildImageVideoDirectionBlock(direction, title) {
      var d = direction || {};
      var cutLabel = String(d.cutLabel || d.cut || '').trim();
      var vibeLabel = String(d.vibeLabel || d.vibe || '').trim();
      var cutDesc = String(d.cutDesc || '').trim();
      var vibeDesc = String(d.vibeDesc || '').trim();
      var session = V._vagSession || {};
      var concept = session.visualConcept || (Array.isArray(session.visualConcepts) ? session.visualConcepts[0] : null) || {};
      var designSystem = session.designSystem || {};
      if (!cutLabel && concept.label) cutLabel = concept.label;
      if (!cutDesc && concept.desc) cutDesc = concept.desc;
      if (!vibeLabel && concept.vibe) vibeLabel = concept.vibe;
      if (!cutLabel && !vibeLabel && !cutDesc && !vibeDesc && !designSystem.imageStrategy) return '';
      return [
        '[' + (title || '이미지→영상 컷 디렉션') + ']',
        '- 기존 사전 디렉션 우선: 배경 컨셉 이미지 라이브러리와 디자인 패밀리에서 고른 방향을 image-to-video에도 그대로 이어간다.',
        cutLabel ? '- 컷/포맷: ' + cutLabel : '',
        cutDesc ? '- 컷 설명: ' + cutDesc : '',
        vibeLabel ? '- 느낌/바이브: ' + vibeLabel : '',
        vibeDesc ? '- 바이브 설명: ' + vibeDesc : '',
        designSystem.imageStrategy ? '- 기존 이미지 전략: ' + designSystem.imageStrategy : '',
        designSystem.proofStrategy ? '- 기존 근거/설득 컷 전략: ' + designSystem.proofStrategy : '',
        designSystem.hfTemplates && designSystem.hfTemplates.length ? '- HyperFrames 템플릿 리듬 참고: ' + designSystem.hfTemplates.slice(0, 4).join(', ') : '',
        '- 이 지시는 Atlas image-to-video 프롬프트에만 적용한다. HyperFrames 텍스트/자막/CTA 구조를 바꾸지 말고, 시작 이미지의 피사체 정체성과 기존 cut_plan을 유지한 채 카메라 움직임과 장면 호흡으로만 반영한다.',
      ].filter(Boolean).join('\n');
    }

  function _vagBuildMultimodalHarmonyBlock(scenes, opts) {
    var sceneList = Array.isArray(scenes) ? scenes : [];
    var options = opts || {};
    if (!sceneList.length) return '';
    var rows = sceneList.map(function (scene, idx) {
      var isFirst = idx === 0;
      var isLast = idx === sceneList.length - 1;
      var energy = isFirst ? 'hook / attention' : isLast ? 'resolve / CTA' : idx < sceneList.length / 2 ? 'build / tension' : 'proof / lift';
      var musicCue = isFirst
        ? '첫 1~2초는 짧고 선명한 사운드 훅, 나레이션을 가리지 않는 빈 공간'
        : isLast
          ? '마지막 CTA 직전 작은 리프트 후 안정적인 resolve tail'
          : idx < sceneList.length / 2
            ? '낮은 펄스와 작은 퍼커션으로 긴장과 속도감 상승'
            : '공기감 있는 패드와 미세한 상승감으로 근거/혜택을 받쳐줌';
      var hfCue = isFirst
        ? '이미지를 0.6초 이상 홀드한 뒤 타이포를 늦게 등장시켜 훅을 만든다'
        : isLast
          ? '카메라 움직임을 줄이고 CTA/브랜드 락업을 안정적으로 고정한다'
          : '나레이션 핵심어와 이미지 포커스 지점에 맞춰 마스크/라인/포커스 모션을 넣는다';
      var p = _vagSceneProductionFields(scene);
      return [
        '씬 ' + (idx + 1) + ' [' + energy + ']',
        scene && scene.title ? '  - 메시지: ' + scene.title : '',
        scene && scene.body ? '  - 화면 문구: ' + scene.body : '',
        scene && scene.narration ? '  - 나레이션: ' + scene.narration : '',
        scene && (scene.visualMode || scene.visual_mode) ? '  - 이미지/시각 역할: ' + (scene.visualMode || scene.visual_mode) : '',
        scene && (scene.cutPlan || scene.cut_plan) ? '  - 컷/카메라: ' + (scene.cutPlan || scene.cut_plan) : '',
        p.shotType ? '  - 쇼트: ' + p.shotType : '',
        p.subjectAction ? '  - 피사체 행동: ' + p.subjectAction : '',
        p.lighting ? '  - 조명/무드: ' + p.lighting : '',
        p.lipSyncHint ? '  - Lip-sync: ' + p.lipSyncHint : '',
        '  - HyperFrames 모션 큐: ' + hfCue,
        '  - BGM 큐: ' + (p.soundCue || musicCue),
        p.editBeat ? '  - 편집 비트: ' + p.editBeat : '',
      ].filter(Boolean).join('\n');
    }).join('\n');
    return [
      '[멀티모달 싱크 지휘표]',
      '목표: 사진/이미지, 나레이션, BGM, HyperFrames HTML/GSAP 모션이 각자 따로 놀지 않고 같은 씬 감정선과 타이밍을 공유한다.',
      '영상 주제: ' + (options.topic || ''),
      '광고 목적: ' + (options.objective || ''),
      '톤: ' + (options.tone || ''),
      '전체 리듬: 첫 씬은 훅, 중간은 문제/근거/해결의 상승, 마지막은 CTA와 브랜드 기억으로 정리한다.',
      '이미지 규칙: 각 이미지는 글자를 넣지 않고 해당 씬의 나레이션 의미와 화면 문구의 의미를 인물/제품/공간/행동으로 시각화한다. 예쁜 콘셉트 이미지가 아니라 씬 메시지 이미지여야 한다.',
      '나레이션 규칙: TTS는 화면 문구를 그대로 반복하기보다 같은 의미를 말하고, 씬 전환 타이밍과 문장 호흡이 맞아야 한다.',
      'BGM 규칙: 보컬/가사 없이 나레이션 밑에 깔리는 광고 스코어다. 씬별 에너지 큐에 맞춰 훅, 빌드, 리프트, CTA resolve가 들려야 한다.',
      'HyperFrames 규칙: HTML은 선택 이미지 위에 정보와 감정을 얹는 모션 레이어다. 이미지와 상관없는 카드/그래프/배경을 새로 만들어 씬을 바꾸면 실패다.',
      rows,
    ].filter(Boolean).join('\n');
  }

  function _vagDefaultImageVideoPromptMode(scene, idx, total) {
    var text = [scene && scene.role, scene && scene.visualMode, scene && scene.title, scene && scene.body].filter(Boolean).join(' ');
    if (idx === total - 1 || /cta|행동|엔드|마지막|전환/i.test(text)) return 'cta';
    if (/제품|상품|사용|데모|손|모델|detail|macro|product/i.test(text)) return 'product';
    if (/카메라|무빙|cinematic|image|visual|hero/i.test(text)) return 'camera';
    return 'scenario';
  }

  function _vagAwaitImageVideoPromptApproval(scenes, images) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve({ ok: true, prompts: [] }); return; }
        var sceneList = Array.isArray(scenes) ? scenes : [];
        var imageList = Array.isArray(images) ? images : [];
        var previewAspect = _vagCurrentVideoAspectRatioCSS();
        var direction = (V._vagSession && V._vagSession.imageVideoDirection) || {};
        var directionLabel = [direction.cutLabel, direction.vibeLabel].filter(Boolean).join(' × ');
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:grid;gap:10px;padding:10px 0;max-width:min(760px,100%);';
      var rows = sceneList.map(function (scene, idx) {
        var image = imageList[idx] || {};
        var mode = _vagDefaultImageVideoPromptMode(scene, idx, sceneList.length);
        var prompt = _vagBuildImageVideoMotionPrompt(scene, image, idx + 1, sceneList.length, mode);
        var title = scene && (scene.title || scene.body) ? (scene.title || scene.body) : ('씬 ' + (idx + 1));
        return '<div data-i2v-prompt-row="' + idx + '" style="border:1px solid rgba(0,0,0,0.08);border-radius:12px;background:#fff;padding:10px;display:grid;gap:8px;">' +
          '<div style="display:flex;gap:10px;align-items:flex-start;">' +
            (image.url ? '<img src="' + V._esc(image.url) + '" alt="씬 ' + (idx + 1) + ' 선택 이미지" style="width:88px;aspect-ratio:' + previewAspect + ';object-fit:contain;border-radius:8px;background:#111;flex:0 0 auto;">' : '') +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-size:12px;font-weight:950;color:#1c1c1e;">씬 ' + (idx + 1) + ' · ' + V._esc(title) + '</div>' +
              '<div style="font-size:10px;color:rgba(0,0,0,0.5);line-height:1.4;margin-top:3px;">이미지 1장은 영상의 시작 화면입니다. 아래 설명으로 카메라 움직임, 행동, 컷 길이를 정합니다.</div>' +
            '</div>' +
          '</div>' +
          '<select data-i2v-mode style="' + V._inputStyle() + '">' +
            '<option value="scenario"' + (mode === 'scenario' ? ' selected' : '') + '>장면 흐름대로</option>' +
            '<option value="camera"' + (mode === 'camera' ? ' selected' : '') + '>카메라 무빙 강조</option>' +
            '<option value="product"' + (mode === 'product' ? ' selected' : '') + '>제품/모델 행동 강조</option>' +
            '<option value="cta"' + (mode === 'cta' ? ' selected' : '') + '>마지막 행동 문구 강조</option>' +
          '</select>' +
          '<textarea data-i2v-prompt rows="7" style="' + V._inputStyle() + 'resize:vertical;line-height:1.5;">' + V._esc(prompt) + '</textarea>' +
        '</div>';
      }).join('');
        wrap.innerHTML =
          '<div style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);border-radius:14px;padding:12px 14px;">' +
            '<div style="font-size:13px;font-weight:950;color:#1c1c1e;">장면별 움직임 확인</div>' +
            '<div style="margin-top:5px;font-size:12px;line-height:1.55;color:rgba(0,0,0,0.62);">선택한 이미지를 어떻게 움직일지 장면별로 확인한 뒤 영상을 만듭니다.' + (directionLabel ? '<br><b>선택한 느낌:</b> ' + V._esc(directionLabel) : '') + '</div>' +
          '</div>' +
        rows +
        '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">' +
          '<button type="button" data-i2v-cancel style="padding:9px 13px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;font-size:12px;font-weight:850;cursor:pointer;">중단</button>' +
          '<button type="button" data-i2v-confirm style="padding:10px 15px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 10px 22px rgba(255,107,0,0.24);">이 설명으로 영상 만들기</button>' +
        '</div>';
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      wrap.querySelectorAll('[data-i2v-prompt-row]').forEach(function (row) {
        var idx = parseInt(row.getAttribute('data-i2v-prompt-row') || '0', 10) || 0;
        var select = row.querySelector('[data-i2v-mode]');
        var textarea = row.querySelector('[data-i2v-prompt]');
        if (select && textarea) {
          select.onchange = function () {
            textarea.value = _vagBuildImageVideoMotionPrompt(sceneList[idx] || {}, imageList[idx] || {}, idx + 1, sceneList.length, select.value || 'scenario');
          };
        }
      });
      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        wrap.querySelectorAll('button,select,textarea').forEach(function (el) { el.disabled = true; });
        resolve(result);
      }
      var cancel = wrap.querySelector('[data-i2v-cancel]');
      var confirm = wrap.querySelector('[data-i2v-confirm]');
      if (cancel) cancel.onclick = function () { finish({ ok: false }); };
      if (confirm) confirm.onclick = function () {
        var prompts = Array.prototype.slice.call(wrap.querySelectorAll('[data-i2v-prompt]')).map(function (el) {
          return String(el.value || '').trim();
        });
        if (prompts.some(function (prompt) { return !prompt; })) {
          if (typeof V._addMsg === 'function') V._addMsg('ai', '<span style="color:#ff9500;">각 장면의 움직임 설명을 비워둘 수 없습니다.</span>', { html: true });
          return;
        }
        confirm.textContent = '움직임 설명 확정됨';
        finish({ ok: true, prompts: prompts });
      };
    });
  }

  function _vagBuildSelectedImageStoryboardBlock(scenes, images) {
    var sceneList = Array.isArray(scenes) ? scenes : [];
    var imageList = Array.isArray(images) ? images : [];
    if (!sceneList.length || !imageList.length) return '';
    var rows = sceneList.map(function (scene, idx) {
      var image = imageList[idx] || {};
      var title = String(scene && scene.title || '').trim();
      var body = String(scene && scene.body || '').trim();
      var narration = String(scene && scene.narration || '').trim();
      var visualMode = String(scene && (scene.visualMode || scene.visual_mode) || '').trim();
      var cutPlan = String(scene && (scene.cutPlan || scene.cut_plan) || '').trim();
      var productionLines = _vagBuildProductionBriefLines(scene);
      return [
        '씬 ' + (idx + 1) + ':',
        title ? '  - 제목: ' + title : '',
        body ? '  - 본문: ' + body : '',
        narration ? '  - 나레이션: ' + narration : '',
        visualMode ? '  - visual mode: ' + visualMode : '',
        cutPlan ? '  - cut plan: ' + cutPlan : '',
        productionLines.length ? '  - 프로덕션 콘티: ' + productionLines.join(' / ') : '',
        image && image.url ? '  - 선택 이미지 URL: ' + image.url : '',
        image && image.prompt ? '  - 이미지 생성 기준: ' + String(image.prompt || '').slice(0, 700) : '',
      ].filter(Boolean).join('\n');
    }).join('\n');
    return [
      '[선택 이미지 기반 HyperFrames 코드 지시]',
      '아래 씬별 선택 이미지는 영상의 시각 기준이다. HyperFrames HTML은 이 이미지와 따로 노는 새 배경/카드 디자인을 만들지 말고, 선택 이미지 위에 타이포그래피, 브랜드 락업, 포커스 라인, 마스크, 파티클, 진행 모션을 얹는 방식으로 설계한다.',
      '각 씬의 HTML 구조와 움직임은 해당 씬의 제목, 본문, 나레이션, cut plan과 일치해야 한다. 이미지가 말하는 장면과 화면 문구가 다른 주제를 말하면 실패다.',
      '텍스트 디자인: 제목은 2줄 이내, 보조 문장은 2줄 이내로 짧게 보이게 만든다. 한국어는 word-break: keep-all, overflow-wrap: break-word, line-height 1.05~1.35, letter-spacing 0을 사용한다.',
      '텍스트 위치: 화면 가장자리에서 최소 7% 이상 떨어진 안전 여백 안에 둔다. top/left 절대좌표로 가운데 긴 문장을 박지 말고, padding과 flex/grid로 완성 위치를 먼저 잡은 뒤 그 위치로 움직인다.',
      '텍스트 가독성: 이미지 피사체를 가리지 않도록 얇은 그림자, 1px 이하 외곽선, 작은 반투명 받침만 사용한다. 화면 절반을 덮는 카드 UI, 검은 박스, 이미지 반쪽 분할은 금지다.',
      '씬 전환은 선택 이미지들의 색감과 카메라 방향이 이어지도록 match cut, soft wipe, parallax push, hold-to-type reveal 중 적절히 고른다.',
      rows,
    ].filter(Boolean).join('\n');
  }

  // 📜 장편 모드 — 챕터 플랜 → 챕터별 순차 생성 → ffmpeg concat 합본
  V._doGenerateLongform = async function _doGenerateLongform(topic, source, targetSec) {
    V._addMsg('ai', `📜 장편 <b>${Math.round(targetSec/60)}분</b> 영상 기획을 시작합니다. 먼저 챕터로 나눠 각각 다른 소재·느낌·이미지로 설계합니다.`);
    V._vagSetStage('code', 'working', '장편 플랜 생성 중', 'AI 가 영상을 60~90초 챕터 N개로 분해하고 있습니다.');
    var btn = document.getElementById('vag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 장편 플랜 중...'; }

    var profileId = parseInt(window._globalProfileId || 0);
    var aspect = (V._vagSession && V._vagSession.aspect) || document.getElementById('vag-aspect').value || '9:16';
    var profileName = (window._globalProfileData || {}).name || '';
    var payload = {
      brand: profileName,
      product: topic || '마케팅 영상',
      goal: (V._vagSession && V._vagSession.objective) || '광고 전환',
      tone: (V._vagSession && V._vagSession.tone) || '직설',
      aspect: aspect,
      target_duration_sec: targetSec,
      key_points: V._vagBuildKeyPoints(source, V._vagSession),
      extras: String(source || '').slice(0, 2000),
      profile_id: profileId || null,
      reference_images: _vagHtmlReferenceImages(),
      reference_sources: V._vagAttachedSources.slice(),
    };

    try {
      // 1) 플랜
      var planResp = await V._vagFetch('/api/hyperframes/longform-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var planData = {};
      var planDetail = '';
      try {
        planData = await planResp.json();
      } catch (parseErr) {
        planDetail = '장편 플랜 응답 JSON 파싱 실패: ' + (parseErr && parseErr.message || parseErr);
      }
      if (!planResp.ok || !planData.ok || !planData.chapters || !planData.chapters.length) {
        planDetail = planDetail || [!planResp.ok ? ('HTTP ' + planResp.status + ' ' + (planResp.statusText || '')) : '', planData.detail || planData.error || planData.message || '장편 플랜 실패'].filter(Boolean).join('\n');
        console.warn('[VAG] longform-plan failed, using fallback chapters:', planDetail);
        V._addMsg('ai',
          '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
            '<b>장편 플랜 API 실패 — 기본 챕터 플랜으로 계속 진행</b><br>' +
            '<span style="color:rgba(0,0,0,0.58);">실패 상세는 콘솔 로그와 작업 일지에 남깁니다. 기존 자료는 버리지 않고 챕터에 다시 배분합니다.</span>' +
            '<div style="margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:10px;color:rgba(0,0,0,0.6);white-space:pre-wrap;max-height:96px;overflow:auto;">' + V._esc(planDetail.slice(0, 700)) + '</div>' +
          '</div>',
          { html: true }
        );
        planData = _vagBuildFallbackLongformPlan(payload, targetSec, planDetail);
      }
      V._vagLongformState = {
        overall_arc: planData.overall_arc || '',
        total_duration: planData.total_duration_sec,
        chapters: planData.chapters.map(c => ({ ...c, status: 'pending', html: null, videoPath: null, studioId: null })),
        aspect: aspect,
        targetSec: targetSec,
        payloadBase: payload,
      };
      V._addMsg('ai', `✅ 플랜 완성 — <b>${planData.chapters.length}개 챕터</b>, 총 ${Math.round(planData.total_duration_sec)}초<br><span style="font-size:11px;color:rgba(0,0,0,0.5);">${V._esc(planData.overall_arc)}</span>`);
      V._vagRenderChapterStrip();

      // 2) 챕터별 순차 생성
      for (let i = 0; i < V._vagLongformState.chapters.length; i++) {
        const ch = V._vagLongformState.chapters[i];
        ch.status = 'generating';
        V._vagRenderChapterStrip();
        V._addMsg('ai', `🎬 챕터 ${ch.index}/${V._vagLongformState.chapters.length}: <b>${V._esc(ch.title)}</b> — ${V._esc(ch.angle||'')} · ${V._esc(ch.mood||'')} · ${V._esc(ch.image_direction||'')}`);
        const chPayload = Object.assign({}, payload, {
          product: `${payload.product} — 챕터 ${ch.index}: ${ch.title}`,
          goal: `${payload.goal} / ${ch.angle || ''}`.slice(0, 200),
          tone: `${payload.tone} · ${ch.tone_shift || ch.mood || ''}`.slice(0, 200),
          duration: ch.duration_sec,
          scene_count: ch.scene_count,
          key_points: ch.key_points && ch.key_points.length ? ch.key_points : payload.key_points,
          extras: `[챕터 ${ch.index}/${V._vagLongformState.chapters.length}] ${ch.summary || ''}\n비주얼: ${ch.visual_style || ''}\n이미지 방향: ${ch.image_direction || ''}\n히어로 요소: ${ch.hero_element || ''}\n팔레트: ${(ch.color_palette||[]).join(', ')}\n이전 챕터들과 시각적으로 완전히 달라야 함.`,
          provider: (document.getElementById('vag-provider') || {}).value || 'gemini',
        });
        try {
          // ✦ 새 분리 호출 흐름 — chapter 도 meta + scene 병렬로 (다양한 스타일 강제)
          const metaR = await V._vagFetch('/api/hyperframes/remotion-meta', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chPayload),
          });
          const metaD = await metaR.json();
          if (!metaR.ok || !metaD.ok) throw new Error(metaD.detail || '챕터 메타 실패');
          const outline = metaD.scenes_outline || [];
          const refImg = V._vagAttachedImages[0] ? V._vagAttachedImages[0].dataUrl : '';
          const sceneResults = await Promise.all(outline.map((row, idx) => fetch('/api/hyperframes/remotion-scene', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              style: row.style || 'typography', intent: row.intent || '',
              duration_sec: row.duration_sec || 4, index: row.index || (idx + 1),
              total: outline.length,
              brand: chPayload.brand, product: chPayload.product, tone: chPayload.tone, cta: chPayload.cta,
              theme: metaD.theme, creative_brief: metaD.creative_brief,
              key_points: chPayload.key_points, extras: chPayload.extras,
              image_url: (row.style && (row.style.startsWith('photo') || row.style === 'mockup' || row.style === 'polaroid' || row.style === 'magazine' || row.style.startsWith('product')) && refImg) ? refImg : '',
            }),
          }).then(r => r.json()).catch(e => ({ ok: false }))));
          const scenes = sceneResults.map(r => (r && r.ok && r.scene) ? r.scene : null).filter(Boolean);
          // 챕터 결과를 _vagPlan 호환 형태로 저장 (이후 렌더 파이프라인이 사용)
          ch.scenes = scenes;
          ch.theme = metaD.theme;
          ch.creative_brief = metaD.creative_brief;
          ch.bgm_direction = metaD.bgm_direction;
          ch.narration_direction = metaD.narration_direction;
          ch.duration = scenes.reduce((a, s) => a + (s.duration_sec || 0), 0);
          ch.status = 'ready';
          V._vagRenderChapterStrip();
        } catch (e) {
          ch.status = 'error';
          ch.error = e.message || String(e);
          V._vagRenderChapterStrip();
          V._addMsg('ai', `<span style="color:#ff3b30;">챕터 ${ch.index} 실패: ${V._esc(e.message)}</span>`);
        }
      }

      // 3) 챕터 자동 렌더 + 합본 — 사용자 수동 트리거 안 기다리고 자동 진행
      const okCount = V._vagLongformState.chapters.filter(c => c.status === 'ready').length;
      V._vagSetStage('code', 'ready', `챕터 ${okCount}개 완성 — 자동 렌더 시작`, '각 챕터 MP4 렌더 후 자동 합본');
      V._addMsg('ai', `✅ 챕터 ${okCount}개 생성 완료. 자동으로 각 챕터 MP4 렌더 → 합본까지 진행합니다 (5~15분 소요).`);
      const chapterMp4s = [];
      for (let i = 0; i < V._vagLongformState.chapters.length; i++) {
        const ch = V._vagLongformState.chapters[i];
        if (ch.status !== 'ready' || !ch.scenes || !ch.scenes.length) continue;
        ch.status = 'rendering';
        V._vagRenderChapterStrip();
        V._addMsg('ai', `🎬 챕터 ${ch.index} 렌더 중... (1~3분)`);
        try {
          const renderPayload = {
            brand: payload.brand || '',
            scenes: ch.scenes,
            theme: ch.theme || {},
            cta: i === V._vagLongformState.chapters.length - 1 ? (payload.cta || '') : '',
            aspect: aspect,
            auto_narration: true,
            auto_bgm: i === 0,  // BGM 은 첫 챕터에만 (이후 합본 시 동일 BGM 이어붙임)
            bgm_volume: 0.18,
            logo_url: null,
          };
          const renderR = await fetch('/api/hyperframes/remotion-render', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renderPayload),
          });
          const renderD = await renderR.json();
          if (!renderR.ok || !renderD.ok) throw new Error(renderD.detail || '챕터 렌더 실패');
          ch.videoPath = renderD.output_path;
          ch.videoUrl = renderD.output_url;
          ch.status = 'rendered';
          chapterMp4s.push(renderD.output_path);
          V._vagRenderChapterStrip();
          V._addMsg('ai', `✓ 챕터 ${ch.index} 렌더 완료 (${Math.round((renderD.size_bytes||0)/1024/1024)}MB)`);
        } catch (e) {
          ch.status = 'render_error';
          ch.error = e.message || String(e);
          V._vagRenderChapterStrip();
          V._addMsg('ai', `<span style="color:#ff3b30;">챕터 ${ch.index} 렌더 실패: ${V._esc(e.message)}</span>`);
        }
      }
      if (chapterMp4s.length >= 2) {
        V._addMsg('ai', `🧩 ${chapterMp4s.length}개 챕터 자동 합본 중...`);
        try {
          const concatR = await fetch('/api/hyperframes/longform-concat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_paths: chapterMp4s }),
          });
          const concatD = await concatR.json();
          if (concatR.ok && concatD.ok) {
            V._addMsg('ai', `✨ <b>장편 합본 완료!</b> ${Math.round(concatD.duration_sec)}초 · ${Math.round(concatD.size_bytes/1024/1024)}MB<br><a href="${concatD.output_url}" target="_blank" style="color:#ff8c00;font-weight:900;">📥 다운로드 (${V._esc(concatD.output_url)})</a>`, { html: true });
            V._vagSetStage('code', 'done', '장편 합본 완료', `${chapterMp4s.length} 챕터 → 1 MP4`);
          } else {
            var errMsg = (typeof concatD.detail === 'string') ? concatD.detail : JSON.stringify(concatD.detail || concatD);
            V._addMsg('ai', `<span style="color:#ff3b30;">합본 실패: ${V._esc(errMsg)}</span>`);
          }
        } catch (e) {
          V._addMsg('ai', `<span style="color:#ff3b30;">합본 호출 실패: ${V._esc(e.message||e)}</span>`);
        }
      } else if (chapterMp4s.length === 1) {
        V._addMsg('ai', `✨ 챕터 1개만 렌더 성공 — <a href="${V._vagLongformState.chapters.find(c=>c.videoUrl)?.videoUrl}" target="_blank" style="color:#ff8c00;font-weight:900;">📥 다운로드</a>`, { html: true });
      }
    } catch (e) {
      V._vagSetStage('code', 'error', '장편 생성 실패', e.message || String(e));
      V._addMsg('ai', `<span style="color:#ff3b30;">장편 생성 실패: ${V._esc(e.message || e)}</span>`);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 새 영상 시작'; }
    }
  }

  // 챕터 스트립 렌더 — 장편 모드 진행 상황 시각화
  V._vagRenderChapterStrip = function _vagRenderChapterStrip() {
    if (!V._vagLongformState) return;
    let strip = document.getElementById('vag-chapter-strip');
    if (!strip) {
      const resultEl = document.getElementById('vag-result') || document.querySelector('[data-vag-stage]')?.parentElement?.parentElement;
      strip = document.createElement('div');
      strip.id = 'vag-chapter-strip';
      strip.style.cssText = 'margin-top:12px;padding:12px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:14px;';
      (resultEl || document.getElementById('vag-chat-body')).appendChild(strip);
    }
    const chs = V._vagLongformState.chapters;
    const statusColor = { pending: '#ccc', generating: '#ff9500', ready: '#34c759', rendering: '#ff8c00', done: '#0058c2', error: '#ff3b30' };
    const statusLabel = { pending: '대기', generating: '생성 중', ready: '코드 완성', rendering: '렌더 중', done: '렌더 완료', error: '실패' };
    strip.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:13px;font-weight:900;color:#ff8c00;">📜 장편 챕터 스트립 (${chs.filter(c=>c.status==='ready'||c.status==='done').length}/${chs.length})</div>
        <div style="display:flex;gap:6px;">
          <button onclick="vagRenderAllChapters()" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff8c00;border-radius:8px;cursor:pointer;">🎞 전체 렌더</button>
          <button onclick="vagConcatLongform()" style="padding:6px 12px;font-size:11px;font-weight:800;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:8px;cursor:pointer;">🧩 전체 합본 (MP4)</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
        ${chs.map((c,i)=>`
          <div onclick="vagLoadChapter(${i})" style="flex:0 0 auto;width:160px;padding:10px;border:2px solid ${statusColor[c.status]||'#ccc'};border-radius:10px;background:${c.status==='ready'?'rgba(52,199,89,0.06)':c.status==='error'?'rgba(255,59,48,0.06)':'#fafafa'};cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:10px;font-weight:800;color:${statusColor[c.status]};">Ch${c.index}</span>
              <span style="font-size:9px;padding:2px 6px;border-radius:999px;background:${statusColor[c.status]};color:#fff;font-weight:700;">${statusLabel[c.status]||c.status}</span>
            </div>
            <div style="font-size:11px;font-weight:800;color:#1c1c1e;line-height:1.3;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${V._esc(c.title||'')}</div>
            <div style="font-size:9px;color:rgba(0,0,0,0.5);line-height:1.4;">
              ${V._esc(c.angle||'')}<br>
              🎨 ${V._esc(c.visual_style||'')}<br>
              💫 ${V._esc(c.mood||'')}<br>
              📷 ${V._esc(c.image_direction||'')}<br>
              ⏱ ${c.duration_sec}초 · ${c.scene_count}씬
            </div>
          </div>
        `).join('')}
      </div>
      ${V._vagLongformState.overall_arc ? `<div style="margin-top:8px;padding:8px 10px;background:rgba(255,140,0,0.06);border-radius:6px;font-size:11px;color:rgba(0,0,0,0.65);">🎭 ${V._esc(V._vagLongformState.overall_arc)}</div>` : ''}
    `;
  }

  // 특정 챕터를 Studio 에 로드
  V.vagLoadChapter = async function vagLoadChapter(idx) {
    if (!V._vagLongformState || !V._vagLongformState.chapters[idx]) return;
    const ch = V._vagLongformState.chapters[idx];
    if (!ch.html) { V._vagToast('이 챕터는 아직 생성 안 됨', 'warning'); return; }
    V._vagHyperHtml = ch.html;
    V._vagOriginalHtml = ch.html;
    try {
      await V._vagSyncStudioProject(ch.title || `chapter-${ch.index}`, V._vagLongformState.aspect, ch.duration);
      V._vagToast(`챕터 ${ch.index} 로드 완료`);
    } catch (e) {
      V._vagToast('로드 실패: ' + e.message, 'error');
    }
  }
  window.vagLoadChapter = V.vagLoadChapter;

  // 모든 챕터 순차 Studio 렌더
  V.vagRenderAllChapters = async function vagRenderAllChapters() {
    if (!V._vagLongformState) return;
    const chs = V._vagLongformState.chapters.filter(c => c.status === 'ready');
    if (!chs.length) { V._vagToast('렌더할 챕터가 없음', 'warning'); return; }
    for (const ch of chs) {
      ch.status = 'rendering';
      V._vagRenderChapterStrip();
      try {
        V._vagHyperHtml = ch.html;
        const syncId = await V._vagSyncStudioProject(`ch${ch.index}-${ch.title}`, V._vagLongformState.aspect, ch.duration);
        const projectId = V._vagStudioProjectId;
        // Studio render-native 호출
        const r = await V._vagFetch('/api/hyperframes/studio-api/projects/' + encodeURIComponent(projectId) + '/render-native', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: 'mp4', fps: 30 }),
        });
        const d = await r.json();
        if (!r.ok || !d.ok || !d.job_id) throw new Error(d.detail || '렌더 실패');
        // 완료 대기 (폴링)
        const videoPath = await V._vagWaitForRender(d.job_id, 600);
        ch.videoPath = videoPath;
        ch.status = 'done';
      } catch (e) {
        ch.status = 'error';
        ch.error = e.message || String(e);
      }
      V._vagRenderChapterStrip();
    }
    V._addMsg('ai', `🎞 전체 렌더 완료 (${V._vagLongformState.chapters.filter(c=>c.status==='done').length}/${chs.length})`);
  }
  window.vagRenderAllChapters = V.vagRenderAllChapters;

  // 렌더 job 완료 대기
  V._vagWaitForRender = async function _vagWaitForRender(jobId, maxSec) {
    const start = Date.now();
    while ((Date.now() - start) / 1000 < maxSec) {
      try {
        const r = await fetch('/api/hyperframes/studio-api/render-jobs/' + encodeURIComponent(jobId));
        const d = await r.json();
        if (d.status === 'done' || d.status === 'completed') {
          return d.output_path || d.path || '';
        }
        if (d.status === 'error' || d.status === 'failed') {
          throw new Error(d.error || '렌더 실패');
        }
      } catch (e) { /* 폴링 에러는 무시하고 계속 */ }
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('렌더 타임아웃');
  }

  // 장편 합본 — ffmpeg concat
  V.vagConcatLongform = async function vagConcatLongform() {
    if (!V._vagLongformState) return;
    const paths = V._vagLongformState.chapters.filter(c => c.videoPath).map(c => c.videoPath);
    if (paths.length < 2) { V._vagToast('먼저 2개 이상 챕터를 렌더하세요', 'warning'); return; }
    V._addMsg('ai', `🧩 ${paths.length}개 챕터를 하나의 장편 MP4 로 합치는 중...`);
    try {
      const r = await V._vagFetch('/api/hyperframes/longform-concat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_paths: paths }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.detail || '합본 실패');
      V._addMsg('ai', `✅ 장편 합본 완료! <b>${Math.round(d.duration_sec)}초</b> · ${Math.round(d.size_bytes/1024/1024)}MB<br><a href="${d.output_url}" target="_blank" style="color:#ff8c00;font-weight:700;">📥 다운로드 (${V._esc(d.output_url)})</a>`);
      V._vagSetStage('render', 'done', '장편 합본 완료', `${d.chapters_merged}개 챕터 → 1개 MP4`);
    } catch (e) {
      V._addMsg('ai', `<span style="color:#ff3b30;">합본 실패: ${V._esc(e.message||e)}</span>`);
    }
  }
  window.vagConcatLongform = V.vagConcatLongform;

  // ⚛ Remotion 엔진 — 2단계: 1) 플랜 받아서 편집 UI 노출 2) 사용자 확인 후 렌더
  V._doGenerateRemotion = async function _doGenerateRemotion(topic, source) {
    V._addMsg('ai', '장면 초안을 만드는 중입니다. 화면에서 장면별 문구를 확인하고 수정할 수 있습니다.');
    V._vagSetStage('code', 'working', '장면 초안 생성 중', '완료되면 편집 가능한 미리보기가 나타납니다.');
    V._vagShowRenderOverlay('🍊 장면 초안 만드는 중');
    const btn = document.getElementById('vag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> Remotion 렌더 중...'; }
    try {
      // 1) 설치 상태 확인
      const statusR = await fetch('/api/hyperframes/remotion-status');
      const statusD = await statusR.json();
      if (!statusD.packages_installed) {
        V._addMsg('ai', `<span style="color:#ff3b30;">이 영상 방식에 필요한 도구가 설치되지 않았습니다.</span><br>터미널에서 아래 명령 실행 후 재시도하세요:<br><pre style="background:#1c1c1e;color:#fbbf24;padding:8px;border-radius:6px;font-size:11px;">${V._esc(statusD.install_command)}</pre>`);
        V._vagSetStage('code', 'error', 'Remotion 미설치', statusD.install_command);
        return;
      }
      // 2) 플랜 요청만 먼저 (렌더는 사용자 편집·확인 후)
      const profileId = parseInt(window._globalProfileId || 0);
      const aspect = document.getElementById('vag-aspect').value || '9:16';
      const duration = V._vagDurationFromSceneCount(document.getElementById('vag-scene-count').value || '6');
      const planPayload = {
        brand: (window._globalProfileData || {}).name || '',
        product: topic || '',
        goal: (V._vagSession && V._vagSession.objective) || '',
        tone: (V._vagSession && V._vagSession.tone) || '',
        aspect, duration,
        scene_count: parseInt(document.getElementById('vag-scene-count').value || '6', 10),
        key_points: V._vagBuildKeyPoints(source, V._vagSession),
        cta: (document.getElementById('vag-cta-input')?.value || '').trim() || (V._vagSession && V._vagSession.cta) || '',
        extras: String(source || '').slice(0, 2000),
        profile_id: profileId || null,
        reference_images: _vagHtmlReferenceImages(),
        brand_color: (V._vagSession && V._vagSession.brandColor) || '',
      };
      const r = await V._vagFetch('/api/hyperframes/remotion-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.detail || 'Remotion 플랜 실패');
      V._vagPlan = { scenes: d.scenes, theme: d.theme, topic, source, duration, aspect };
      V._vagSetStage('code', 'ready', '장면 초안 완성 — 화면에서 편집', `${d.scenes.length}개 장면 · 총 ${d.total_duration_sec}s`);
      V._addMsg('ai', `✅ <b>${d.scenes.length}개 장면 초안 완성</b>. 아래 편집 영역에서 제목·본문·마지막 행동 문구를 자유롭게 수정한 뒤 <b>🎬 최종 영상 만들기</b> 버튼을 누르세요.`);
      V._vagRenderPlanEditor();
    } catch (e) {
      V._addMsg('ai', `<span style="color:#ff3b30;">장면 초안 만들기 실패: ${V._esc(e.message||e)}</span>`);
      V._vagSetStage('code', 'error', 'Remotion 실패', String(e.message||e).slice(0,160));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '🔄 대화 재시작'; }
      V._vagHideRenderOverlay();
    }
  }

  // 🎬 플랜 편집 UI — AI 가 만든 씬을 사용자가 화면에서 바로 수정
  V._vagRenderPlanEditor = function _vagRenderPlanEditor() {
    if (!V._vagPlan || !V._vagPlan.scenes) return;
    const host = document.getElementById('vag-board-plan-host');
    const resultEl = document.getElementById('vag-result') || document.getElementById('vag-chat-body')?.parentElement;
    let panel = document.getElementById('vag-plan-editor');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vag-plan-editor';
      panel.style.cssText = 'margin-top:14px;padding:14px;background:#fff;border:1px solid rgba(255,140,0,0.25);border-radius:16px;';
      (host || document.getElementById('vag-chat-body') || resultEl).appendChild(panel);
    }
    const scenes = V._vagPlan.scenes;
    const theme = V._vagPlan.theme || {};
    const roleOutputs = (V._vagPlan && V._vagPlan.role_outputs) || {};
    const roleCards = [
      { key: 'strategy', label: '전략가', body: roleOutputs.strategy && (roleOutputs.strategy.hook_strategy || roleOutputs.strategy.core_insight || roleOutputs.strategy.positioning || '') },
      { key: 'copy', label: '카피', body: roleOutputs.copy && Array.isArray(roleOutputs.copy.scenes) ? roleOutputs.copy.scenes.slice(0, 2).map(function (row) { return row.title || row.body || row.meta || ''; }).filter(Boolean).join(' / ') : '' },
      { key: 'art', label: '아트', body: roleOutputs.art && ([roleOutputs.art.mood_tag, roleOutputs.art.accent, roleOutputs.art.font_display].filter(Boolean).join(' / ')) },
      { key: 'motion', label: '모션', body: roleOutputs.motion && Array.isArray(roleOutputs.motion.scene_motion) ? roleOutputs.motion.scene_motion.slice(0, 2).map(function (row) { return [row.easing_enter, row.ambient_motion, row.camera_work].filter(Boolean).join(' · '); }).filter(Boolean).join(' / ') : '' },
      { key: 'sound', label: '사운드', body: roleOutputs.sound && ([roleOutputs.sound.bgm && roleOutputs.sound.bgm.genre, roleOutputs.sound.narration && roleOutputs.sound.narration.emotion].filter(Boolean).join(' / ')) },
    ].filter(function (row) { return row.body; });
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="font-size:14px;font-weight:900;color:#ff6b00;">🎬 플랜 편집 · ${scenes.length}씬 · 총 ${scenes.reduce((a,s)=>a+(s.duration_sec||0),0).toFixed(1)}초</div>
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="vagRenderFromPlan()" style="padding:10px 18px;font-size:12px;font-weight:900;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:10px;cursor:pointer;box-shadow:0 4px 12px rgba(255,140,0,0.25);">✅ 확정 · 최종 렌더</button>
        </div>
      </div>
      <div style="margin-bottom:12px;padding:10px 12px;border:1px solid rgba(255,140,0,0.18);border-radius:12px;background:linear-gradient(135deg,rgba(255,140,0,0.05),rgba(255,140,0,0.03));">
        <div style="font-size:11px;font-weight:800;color:#ff8c00;margin-bottom:8px;">🛠 강화·재구성 — 렌더 전에 한 번 더 다듬기</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" onclick="vagEnhanceCopyOnly()" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff8c00;border-radius:8px;cursor:pointer;">✏️ 카피만 날카롭게</button>
          <button type="button" onclick="vagPickNewStructureAndRegen()" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff8c00;border-radius:8px;cursor:pointer;">🧱 구조 다시</button>
          <button type="button" onclick="vagSwapStylePack()" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff8c00;border-radius:8px;cursor:pointer;">🎨 스타일 교체</button>
          <button type="button" onclick="vagRegeneratePlan()" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(0,0,0,0.15);background:#fff;color:rgba(0,0,0,0.65);border-radius:8px;cursor:pointer;">🔀 전면 재생성</button>
        </div>
      </div>
      ${roleCards.length ? `
        <div style="margin-bottom:12px;padding:12px;border:1px solid rgba(255,140,0,0.14);border-radius:12px;background:linear-gradient(135deg,rgba(255,140,0,0.05),rgba(255,140,0,0.03));">
          <div style="font-size:12px;font-weight:900;color:#1c1c1e;margin-bottom:8px;">감독 팀 작업 요약</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            ${roleCards.map((card) => `
              <div style="padding:10px;border-radius:10px;background:#fff;border:1px solid rgba(0,0,0,0.06);">
                <div style="font-size:10px;font-weight:800;color:#ff8c00;">${card.label}</div>
                <div style="margin-top:6px;font-size:11px;line-height:1.55;color:#1c1c1e;">${V._esc(card.body)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <!-- 🎨 테마 설정 (펼침) -->
      <details style="margin-bottom:12px;padding:10px 12px;background:linear-gradient(135deg,rgba(255,140,0,0.04),rgba(255,140,0,0.03));border-radius:10px;">
        <summary style="cursor:pointer;font-size:12px;font-weight:800;color:rgba(0,0,0,0.75);">🎨 테마 설정 (AI 결정값 · 수정 가능)</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px;font-size:11px;">
          <label>배경 <input type="color" data-theme-field="bg" value="${theme.bg||'#0A0A0A'}" oninput="vagUpdateTheme(this)" style="width:100%;height:32px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;"></label>
          <label>글자 <input type="color" data-theme-field="fg" value="${theme.fg||'#F4F1EA'}" oninput="vagUpdateTheme(this)" style="width:100%;height:32px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;"></label>
          <label>액센트 <input type="color" data-theme-field="accent" value="${theme.accent||'#FF8C00'}" oninput="vagUpdateTheme(this)" style="width:100%;height:32px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;"></label>
          <label>BGM 페이드인(초) <input type="number" step="0.1" min="0.2" max="3" data-theme-field="bgm_fade_in_sec" value="${theme.bgm_fade_in_sec??0.6}" onchange="vagUpdateTheme(this)" style="width:100%;padding:5px 8px;font-size:11px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;"></label>
          <label>BGM 페이드아웃(초) <input type="number" step="0.1" min="0.2" max="4" data-theme-field="bgm_fade_out_sec" value="${theme.bgm_fade_out_sec??1.2}" onchange="vagUpdateTheme(this)" style="width:100%;padding:5px 8px;font-size:11px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;"></label>
        </div>
      </details>
      <div style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto;">
        ${scenes.map((sc, i) => `
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fafafa;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:6px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="padding:3px 8px;background:#ff6b00;color:#fff;font-size:10px;font-weight:800;border-radius:6px;">씬 ${i+1}</span>
                <select data-sc-idx="${i}" data-sc-field="style" onchange="vagUpdateScene(this)" style="padding:3px 6px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;max-width:160px;">
                  <optgroup label="기본 (35)">
                    ${['typography','card','photo','quote','chart','split','list','icon-grid','hero-mark','bento','stat','gradient','kinetic','neon','timeline','countdown','price-tag','testimonial','before-after','review-card','discount-stamp','ranking','comparison-table','product-grid','photo-split','photo-card','polaroid','mockup','magazine','product-hero','product-feature','shopping-cta','deal-flash','package-bundle','custom'].map(s => `<option value="${s}" ${sc.style===s?'selected':''}>${s}</option>`).join('')}
                  </optgroup>
                  ${(window._vagHfCatalog && window._vagHfCatalog.blocks) ? `<optgroup label="HF blocks (${window._vagHfCatalog.blocks.length})">${window._vagHfCatalog.blocks.map(n => `<option value="hf:${n}" ${sc.style==='hf:'+n?'selected':''}>hf:${n}</option>`).join('')}</optgroup>` : ''}
                  ${(window._vagHfCatalog && window._vagHfCatalog.examples) ? `<optgroup label="HF examples (${window._vagHfCatalog.examples.length})">${window._vagHfCatalog.examples.map(n => `<option value="hf:${n}" ${sc.style==='hf:'+n?'selected':''}>hf:${n}</option>`).join('')}</optgroup>` : ''}
                </select>
                <span style="font-size:10px;color:rgba(0,0,0,0.45);">
                  <input type="number" data-sc-idx="${i}" data-sc-field="duration_sec" value="${sc.duration_sec}" step="0.5" min="2" max="15" onchange="vagUpdateScene(this)" style="width:50px;padding:2px 4px;font-size:10px;"> 초
                </span>
              </div>
            </div>
            <input type="text" data-sc-idx="${i}" data-sc-field="meta" value="${_esc(sc.meta || '')}" placeholder="메타 라벨 (NEW ARRIVAL 등)" oninput="vagUpdateScene(this)" style="width:100%;padding:6px 10px;font-size:11px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;margin-bottom:6px;">
            <input type="text" data-sc-idx="${i}" data-sc-field="title" value="${_esc(sc.title || '')}" placeholder="제목" oninput="vagUpdateScene(this)" style="width:100%;padding:8px 10px;font-size:13px;font-weight:700;border:1px solid rgba(0,0,0,0.1);border-radius:6px;margin-bottom:6px;">
            <textarea data-sc-idx="${i}" data-sc-field="body" placeholder="본문" oninput="vagUpdateScene(this)" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;min-height:44px;resize:vertical;">${V._esc(sc.body || '')}</textarea>
            ${sc.style === 'chart' ? `
              <div style="display:flex;gap:6px;margin-top:6px;">
                <input type="number" data-sc-idx="${i}" data-sc-field="counter_from" value="${sc.counter_from ?? 0}" onchange="vagUpdateScene(this)" placeholder="시작값" style="flex:1;padding:4px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;">
                <input type="number" data-sc-idx="${i}" data-sc-field="counter_to" value="${sc.counter_to ?? 100}" onchange="vagUpdateScene(this)" placeholder="목표값" style="flex:1;padding:4px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;">
                <input type="text" data-sc-idx="${i}" data-sc-field="counter_suffix" value="${_esc(sc.counter_suffix || '')}" oninput="vagUpdateScene(this)" placeholder="%" style="width:50px;padding:4px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;">
              </div>
            ` : ''}
            ${sc.style === 'quote' ? `
              <textarea data-sc-idx="${i}" data-sc-field="quote" placeholder="인용구" oninput="vagUpdateScene(this)" style="width:100%;padding:8px 10px;font-size:12px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;margin-top:6px;min-height:40px;">${V._esc(sc.quote || '')}</textarea>
              <input type="text" data-sc-idx="${i}" data-sc-field="author" value="${_esc(sc.author || '')}" placeholder="인용자" oninput="vagUpdateScene(this)" style="width:100%;padding:6px 10px;font-size:11px;border:1px solid rgba(0,0,0,0.1);border-radius:6px;margin-top:4px;">
            ` : ''}
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" onclick="vagRegenerateScene(${i})" title="이 씬만 AI 가 새로 생성" style="padding:5px 10px;font-size:10px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:rgba(255,140,0,0.06);color:#ff8c00;border-radius:6px;cursor:pointer;">🔄 이 씬 다시 생성</button>
              <button type="button" onclick="vagRegenerateScene(${i}, 'longer')" title="이 씬 카피를 더 길고 풍부하게" style="padding:5px 10px;font-size:10px;font-weight:700;border:1px solid rgba(52,199,89,0.3);background:rgba(52,199,89,0.06);color:#28a745;border-radius:6px;cursor:pointer;">📝 더 길게</button>
              <button type="button" onclick="vagRegenerateScene(${i}, 'shorter')" title="이 씬 카피를 더 간결하게" style="padding:5px 10px;font-size:10px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:rgba(255,140,0,0.06);color:#ff6b00;border-radius:6px;cursor:pointer;">✂ 더 짧게</button>
              <button type="button" onclick="vagDeleteScene(${i})" title="이 씬을 영상에서 제거" style="padding:5px 10px;font-size:10px;font-weight:700;border:1px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.06);color:#ff3b30;border-radius:6px;cursor:pointer;margin-left:auto;">🗑 삭제</button>
            </div>
            <!-- ⚙ 고급 AI 값 (펼침) -->
            <details style="margin-top:8px;">
              <summary style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.5);cursor:pointer;">⚙ 고급 · 모션·크기·색 (AI 결정값 · 수정 가능)</summary>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:8px;font-size:10px;color:rgba(0,0,0,0.55);">
                <label>정렬 <select data-sc-idx="${i}" data-sc-anim="layout_align" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;">
                  ${['left','center','right'].map(v => `<option value="${v}" ${((sc.animation&&sc.animation.layout_align)||'left')===v?'selected':''}>${v}</option>`).join('')}
                </select></label>
                <label>제목 크기 <input type="number" min="80" max="240" data-sc-idx="${i}" data-sc-anim="hero_size_px" value="${(sc.animation&&sc.animation.hero_size_px)||140}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                <label>본문 크기 <input type="number" min="28" max="72" data-sc-idx="${i}" data-sc-anim="body_size_px" value="${(sc.animation&&sc.animation.body_size_px)||46}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                <label>여백(px) <input type="number" min="40" max="200" data-sc-idx="${i}" data-sc-anim="padding_px" value="${(sc.animation&&sc.animation.padding_px)||80}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                <label>Spring damping <input type="number" step="0.5" min="4" max="20" data-sc-idx="${i}" data-sc-anim="spring_damping" value="${(sc.animation&&sc.animation.spring_damping)??9}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                <label>Spring stiffness <input type="number" min="50" max="250" data-sc-idx="${i}" data-sc-anim="spring_stiffness" value="${(sc.animation&&sc.animation.spring_stiffness)??150}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                <label>Entry Y(px) <input type="number" min="0" max="300" data-sc-idx="${i}" data-sc-anim="entry_y_px" value="${(sc.animation&&sc.animation.entry_y_px)??100}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                ${sc.style==='photo' ? `
                  <label>이미지 어둡기 <input type="number" step="0.05" min="0" max="0.85" data-sc-idx="${i}" data-sc-anim="image_dim_opacity" value="${(sc.animation&&sc.animation.image_dim_opacity)??0.25}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                  <label>흰테두리 <input type="number" step="0.5" min="0" max="5" data-sc-idx="${i}" data-sc-anim="text_stroke_px" value="${(sc.animation&&sc.animation.text_stroke_px)??3}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                `:''}
                ${sc.style==='photo' ? `
                  <label>Ken Burns 줌 <input type="number" step="0.01" min="1.02" max="1.6" data-sc-idx="${i}" data-sc-anim="ken_burns_zoom" value="${(sc.animation&&sc.animation.ken_burns_zoom)??1.25}" onchange="vagUpdateSceneAnim(this)" style="width:100%;padding:3px 5px;font-size:10px;border:1px solid rgba(0,0,0,0.1);border-radius:5px;"></label>
                `:''}
                <label>씬 색 배경 <input type="color" data-sc-idx="${i}" data-sc-field="bg" value="${sc.bg||theme.bg||'#0A0A0A'}" oninput="vagUpdateScene(this)" style="width:100%;height:22px;border:1px solid rgba(0,0,0,0.1);border-radius:4px;"></label>
                <label>씬 액센트 <input type="color" data-sc-idx="${i}" data-sc-field="accent" value="${sc.accent||theme.accent||'#FF8C00'}" oninput="vagUpdateScene(this)" style="width:100%;height:22px;border:1px solid rgba(0,0,0,0.1);border-radius:4px;"></label>
              </div>
            </details>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 🔄 씬별 AI 재생성 — 이 씬만 카피·스타일 다시 생성 (원하는 만큼 반복)
  V.vagRegenerateScene = async function vagRegenerateScene(idx, lengthHint) {
    if (!V._vagPlan || !V._vagPlan.scenes) return;
    const sc = V._vagPlan.scenes[idx];
    if (!sc) return;
    const btns = document.querySelectorAll(`[onclick*="vagRegenerateScene(${idx}"]`);
    btns.forEach(b => { b.disabled = true; b.textContent = '⏳ 재생성 중 (최대 30초)...'; });
    // 중복 클릭 방지 플래그
    if (window._vagRegenInFlight && window._vagRegenInFlight[idx]) return;
    window._vagRegenInFlight = window._vagRegenInFlight || {};
    window._vagRegenInFlight[idx] = true;
    try {
      const payload = {
        scene: sc,
        index: idx,
        total: V._vagPlan.scenes.length,
        brand: (window._globalProfileData || {}).name || '',
        product: V._vagPlan.topic || '',
        tone: (V._vagSession && V._vagSession.tone) || '',
        goal: (V._vagSession && V._vagSession.objective) || '',
        theme: V._vagPlan.theme,
        creative_brief: V._vagPlan.creative_brief,
        length_hint: lengthHint || 'same', // 'longer' | 'shorter' | 'same'
      };
      const r = await V._vagFetch('/api/hyperframes/remotion-regenerate-scene', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || !d.ok || !d.scene) throw new Error(d.detail || '재생성 실패');
      // 업데이트
      Object.assign(V._vagPlan.scenes[idx], d.scene);
      V._vagRenderPlanEditor();
      V._addMsg('ai', `🔄 씬 ${idx+1} 재생성 완료 — ${lengthHint === 'longer' ? '더 길게' : lengthHint === 'shorter' ? '더 짧게' : '새 버전'}`);
    } catch (e) {
      V._addMsg('ai', `<span style="color:#ff3b30;">씬 재생성 실패: ${V._esc(e.message||e)}</span>`);
    } finally {
      if (window._vagRegenInFlight) delete window._vagRegenInFlight[idx];
      try { V._vagRenderPlanEditor(); } catch (_) {}
    }
  }
  window.vagRegenerateScene = V.vagRegenerateScene;

  V.vagDeleteScene = function vagDeleteScene(idx) {
    if (!V._vagPlan || !Array.isArray(V._vagPlan.scenes)) return;
    if (V._vagPlan.scenes.length <= 1) {
      V._vagToast && V._vagToast('마지막 씬은 삭제할 수 없습니다 (최소 1씬 필요)', 'error');
      return;
    }
    var sc = V._vagPlan.scenes[idx];
    var label = (sc && (sc.title || sc.meta)) || ('씬 ' + (idx + 1));
    if (!confirm('이 씬을 영상에서 제거할까요?\n\n[' + (idx + 1) + '] ' + label)) return;
    V._vagPlan.scenes.splice(idx, 1);
    try { V._vagRenderPlanEditor(); } catch (_) {}
  }
  window.vagDeleteScene = V.vagDeleteScene;

  V.vagUpdateScene = function vagUpdateScene(el) {
    if (!V._vagPlan || !V._vagPlan.scenes) return;
    const idx = parseInt(el.dataset.scIdx, 10);
    const field = el.dataset.scField;
    const sc = V._vagPlan.scenes[idx];
    if (!sc || !field) return;
    const v = el.type === 'number' ? parseFloat(el.value) : el.value;
    sc[field] = v;
  }
  window.vagUpdateScene = V.vagUpdateScene;

  V.vagUpdateSceneAnim = function vagUpdateSceneAnim(el) {
    if (!V._vagPlan || !V._vagPlan.scenes) return;
    const idx = parseInt(el.dataset.scIdx, 10);
    const field = el.dataset.scAnim;
    const sc = V._vagPlan.scenes[idx];
    if (!sc || !field) return;
    if (!sc.animation) sc.animation = {};
    const v = el.type === 'number' ? parseFloat(el.value) : el.value;
    sc.animation[field] = v;
  }
  window.vagUpdateSceneAnim = V.vagUpdateSceneAnim;

  V.vagUpdateTheme = function vagUpdateTheme(el) {
    if (!V._vagPlan) return;
    if (!V._vagPlan.theme) V._vagPlan.theme = {};
    const field = el.dataset.themeField;
    if (!field) return;
    const v = el.type === 'number' ? parseFloat(el.value) : el.value;
    V._vagPlan.theme[field] = v;
  }
  window.vagUpdateTheme = V.vagUpdateTheme;

  V.vagRegeneratePlan = async function vagRegeneratePlan() {
    V._vagPlan = null;
    const panel = document.getElementById('vag-plan-editor');
    if (panel) panel.remove();
    const topic = (V._vagSession && V._vagSession.baseTopic) || '';
    const source = (V._vagSession && V._vagSession.baseSource) || '';
    await V._doGenerateRemotion(topic, source);
  }
  window.vagRegeneratePlan = V.vagRegeneratePlan;

  // 강화·재구성 — 카피만 날카롭게 (구조·스타일 유지)
  V.vagEnhanceCopyOnly = async function vagEnhanceCopyOnly() {
    if (!V._vagSession) { V._vagToast('세션이 없습니다', 'error'); return; }
    V._vagSession.copyRefreshMode = 'sharper';
    V._addMsg('ai', '✏️ 카피만 더 날카롭게 — 구조·스타일 유지, 카피 재작성.');
    await V.vagRegeneratePlan();
    V._vagSession.copyRefreshMode = '';
  }
  window.vagEnhanceCopyOnly = V.vagEnhanceCopyOnly;

  // 강화·재구성 — 구조 3단계 드릴다운 다시
  V.vagPickNewStructureAndRegen = async function vagPickNewStructureAndRegen() {
    if (!V._vagSession) { V._vagToast('세션이 없습니다', 'error'); return; }
    V._addMsg('ai', '🧱 구조 다시 선택하세요.');
    var newStructure = await V._vagPickStructure();
    V._vagSession.structureTemplate = newStructure || null;
    if (newStructure && newStructure.label && newStructure.label !== 'AI 자동 선택') {
      V._addMsg('ai', '✅ 새 구조: <b>' + V._esc(newStructure.label) + '</b> — 플랜 재생성합니다.');
    } else {
      V._addMsg('ai', '✅ 구조: AI 자동 — 플랜 재생성합니다.');
    }
    await V.vagRegeneratePlan();
  }
  window.vagPickNewStructureAndRegen = V.vagPickNewStructureAndRegen;

  // 강화·재구성 — 스타일 팩 교체 (샘플 템플릿 재선택)
  V.vagSwapStylePack = async function vagSwapStylePack() {
    if (!V._vagSession) { V._vagToast('세션이 없습니다', 'error'); return; }
    var aspect = (V._vagSession.aspect) || (document.getElementById('vag-aspect') || {}).value || '9:16';
    V._addMsg('ai', '🎨 새 스타일 팩을 고르세요.');
    var newTemplate = await V._vagPickSampleTemplate(aspect);
    V._vagSession.templateId = newTemplate || '';
    V._addMsg('ai', newTemplate ? '✅ 새 템플릿 적용 — 플랜 재생성합니다.' : '✅ 템플릿 없이 자유 생성으로 재작성합니다.');
    await V.vagRegeneratePlan();
  }
  window.vagSwapStylePack = V.vagSwapStylePack;

  // 🎭 모션 영상 감독 모드 — 광고 기획·BGM·나레이션·씬별 디자인 전부 AI 결정
  V.vagDirectorMode = async function vagDirectorMode() {
    V._addMsg('ai', '🎭 <b>감독 에이전트</b>가 전략가·카피·아트·모션·사운드 팀을 꾸려서 맡깁니다...');
    V._vagSetStage('code', 'working', '감독 팀 기획 중', '타겟·훅·서사·팔레트·씬별 디자인·BGM·나레이션을 역할별로 나눠 설계');
    const btn = document.getElementById('vag-director-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ 기획 중...'; }
    try {
      if (!V._vagSession) {
        V._addMsg('ai', '먼저 "새 영상 시작"으로 주제·톤·목적을 정해주세요. 그 후 감독 모드 실행.');
        return;
      }
      V._vagSession.directorMode = true;
      V._vagSession.directorAutoEnabled = false;
      V._vagSession.directorCrewMode = true;
      const topic = V._vagBuildMarketingTopic(V._vagSession.baseTopic || '', V._vagSession.objective || '', V._vagSession.tone || '', V._vagSession.cta || '');
      const source = V._vagBuildMarketingSource(V._vagSession.baseSource || '', V._vagSession);
      V._addMsg('ai', '⚡ 감독이 팀에 브리프를 배분하고 있습니다...');
      const metaD = await V._vagPrepareDirectorBrief(topic, source, {
        message: '🎭 감독 에이전트가 전략가·카피·아트·모션·사운드 팀에게 각각 업무를 맡기고 있어요...',
        forceDirectorMode: true,
        teamMode: true,
      });
      const scenes = Array.isArray(metaD.scenes) ? metaD.scenes.slice() : [];
      const failedCount = scenes.length ? 0 : 1;
      V._vagPlan = {
        scenes: scenes,
        theme: metaD.theme,
        creative_brief: metaD.creative_brief,
        bgm_direction: metaD.bgm_direction,
        narration_direction: metaD.narration_direction,
        role_outputs: metaD.role_outputs || {},
        topic: V._vagSession.baseTopic,
        duration: V._vagSession.hyperDuration || V._vagDurationFromSceneCount(document.getElementById('vag-scene-count').value || '6'),
        aspect: document.getElementById('vag-aspect').value || '9:16',
      };
      const totalDur = scenes.reduce((a, s) => a + (s.duration_sec || 0), 0);
      V._addMsg('ai', `🎬 감독 팀 기획 완료 — <b>${scenes.length}씬 · ${totalDur.toFixed(1)}s</b>${failedCount ? ` (실패 ${failedCount}개)` : ''}. 우측 작업보드에서 역할별 요약과 씬을 바로 편집할 수 있습니다.`);
      V._vagSetStage('code', 'ready', '감독 팀 플랜 완성', metaD.creative_brief?.narrative_arc || '');
      V._vagRenderPlanEditor();
    } catch (e) {
      V._addMsg('ai', `<span style="color:#ff3b30;">감독 기획 실패: ${V._esc(e.message||e)}</span>`);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '🎭 감독에게 맡기기'; }
    }
  }
  window.vagDirectorMode = V.vagDirectorMode;

  V.vagRenderFromPlan = async function vagRenderFromPlan() {
    if (!V._vagPlan) { V._vagToast('플랜이 없습니다', 'error'); return; }
    V._addMsg('ai', `🎬 사용자가 편집한 ${V._vagPlan.scenes.length}개 씬으로 최종 렌더 시작...`);
    V._vagSetStage('code', 'working', '최종 렌더 중', '사용자 확인된 씬으로 MP4 생성');
    V._vagShowRenderOverlay('🍊 최종 렌더 진행 중');
    V._vagUpdateRenderOverlay('🍊 최종 렌더 진행 중', 'Remotion 베이스 영상을 먼저 만들고, 필요하면 HyperFrames 풍부 모션까지 이어집니다.', 8, 'prepare', '편집된 씬 데이터와 오디오 옵션을 정리했습니다.');
    const autoNarration = document.getElementById('vag-auto-narration')?.checked !== false;
    const autoBgm = document.getElementById('vag-auto-bgm')?.checked !== false;
    const bgmVol = parseInt(document.getElementById('vag-bgm-volume')?.value || '18', 10) / 100;
    const payload = {
      scenes: V._vagPlan.scenes,
      theme: V._vagPlan.theme,
      brand: (window._globalProfileData || {}).name || '',
      product: V._vagPlan.topic || '',
      tone: (V._vagSession && V._vagSession.tone) || '',
      aspect: V._vagPlan.aspect,
      duration: V._vagPlan.duration,
      cta: (document.getElementById('vag-cta-input')?.value || '').trim() || (V._vagSession && V._vagSession.cta) || '',
      auto_narration: autoNarration,
      auto_bgm: autoBgm,
      bgm_volume: bgmVol,
      logo_url: null,
    };
    try {
      const r = await V._vagFetch('/api/hyperframes/remotion-render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.detail || '렌더 실패');
      V._vagUpdateRenderOverlay('🍊 기본 영상 생성 완료', '이제 결과를 확인하고 추가 움직임 적용 여부를 판단합니다.', 72, 'rendering', '기본 MP4를 만들었습니다.', 'success');
      V._addMsg('ai', `✅ 기본 영상 생성 완료 (${Math.round(d.duration_sec)}초 · ${d.scenes}개 장면 · ${Math.round(d.size_bytes/1024/1024)}MB).<br><a href="${d.output_url}" target="_blank" style="color:#ff8c00;font-weight:600;font-size:11px;">📥 MP4 열기 (${V._esc(d.output_url)})</a>`, { html: true });
      V._vagSetStage('code', 'done', '기본 영상 완료', `${d.scenes}개 장면 · ${d.width}×${d.height}`);
      const resultEl = document.getElementById('vag-result');
      const player = document.getElementById('vag-video-player');
      if (player && d.output_url) player.src = d.output_url;
      if (resultEl) resultEl.style.display = 'block';

      // 🌀 HyperFrames CLI 로 자동 추가 렌더 — 풍부한 GSAP 모션 적용된 최종본
      if (d.html_url) {
        V._addMsg('ai', '🌀 문구 움직임과 강조 효과를 더해 최종 영상을 만드는 중입니다. 1~2분 정도 더 걸릴 수 있습니다.');
        V._vagUpdateRenderOverlay('🍊 최종 영상 만드는 중', '기본 영상 위에 문구 움직임과 강조 효과를 더합니다.', 82, 'encoding', '추가 영상 만들기를 시작했습니다.');
        try {
          var hfR = await fetch('/api/hyperframes/hf-render', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html_url: d.html_url })
          });
          var hfD = await hfR.json();
          if (hfR.ok && hfD.ok) {
            V._vagUpdateRenderOverlay('🍊 최종 영상 완성', '문구 움직임과 강조 효과까지 끝났습니다.', 100, 'complete', '최종 영상 파일이 준비되었습니다.', 'success');
            V._addMsg('ai', `✨ <b>최종 영상 완성!</b> (${Math.round(hfD.size_bytes/1024/1024)}MB)<br><a href="${hfD.output_url}" target="_blank" style="color:#ff6b00;font-weight:900;font-size:13px;">📥 최종 MP4 열기 (${V._esc(hfD.output_url)})</a><br><a href="${d.html_url}" target="_blank" style="color:rgba(0,0,0,0.5);font-size:10px;">🌐 미리보기 열기</a>`, { html: true });
            if (player) player.src = hfD.output_url;
          } else {
          V._vagUpdateRenderOverlay('🍊 기본 영상 사용', '추가 움직임 만들기는 실패했지만 기본 MP4는 정상입니다.', 100, 'complete', '기본 MP4를 유지합니다.', 'info');
            V._addMsg('ai', `<span style="color:#ff9500;">추가 움직임 만들기 실패 (${V._esc(hfD.detail||'')}) — 위 기본 MP4를 사용합니다.</span><br><a href="${d.html_url}" target="_blank" style="color:#ff6b00;">🌐 미리보기 열기</a>`, { html: true });
          }
        } catch (e) {
          V._vagUpdateRenderOverlay('🍊 기본 영상 사용', '추가 움직임 만들기 호출이 실패했습니다.', 100, 'complete', '기본 MP4만 남깁니다.', 'info');
          V._addMsg('ai', `<span style="color:#ff9500;">추가 움직임 만들기 실패: ${V._esc(e.message||e)} — 기본 MP4를 사용합니다.</span>`);
        }
      } else {
        V._vagUpdateRenderOverlay('🍊 기본 영상 완성', '추가 효과 없이 기본 MP4만 제공합니다.', 100, 'complete', '기본 MP4가 완료되었습니다.', 'success');
      }
    } catch (e) {
      V._vagUpdateRenderOverlay('🍊 렌더 실패', e.message || '오류가 발생했습니다.', 100, 'failed', e.message || '렌더 실패', 'error');
      V._addMsg('ai', `<span style="color:#ff3b30;">렌더 실패: ${V._esc(e.message||e)}</span>`);
    } finally {
      V._vagHideRenderOverlay();
    }
  }
  window.vagRenderFromPlan = V.vagRenderFromPlan;

  // 🌀 HyperFrames OSS CLI 추가 렌더 — npx hyperframes render 호출
  window.vagHfCliRender = async function (htmlUrl, btn) {
    if (!htmlUrl) return;
    var orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;border-width:1px;display:inline-block;margin-right:4px;"></span> 첫 호출 ~2분'; }
    V._addMsg('ai', '🌀 최종 영상 만들기 시작 — 첫 실행은 준비 때문에 1~2분 걸릴 수 있습니다.');
    try {
      var r = await fetch('/api/hyperframes/hf-render', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_url: htmlUrl })
      });
      var d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.detail || 'HF CLI 렌더 실패');
      V._addMsg('ai', '✅ 최종 영상 만들기 완료 (' + Math.round(d.size_bytes/1024/1024) + 'MB)<br><a href="' + d.output_url + '" target="_blank" style="color:#ff6b00;font-weight:700;">📥 MP4 열기 (' + V._esc(d.output_url) + ')</a>', { html: true });
    } catch (e) {
      V._addMsg('ai', '<span style="color:#ff3b30;">최종 영상 만들기 실패: ' + V._esc(e.message||e) + '</span>');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    }
  };

  V._doGenerate = async function _doGenerate(topic, source) {
    // ⚛ Remotion 엔진은 별도 파이프라인
    const prov = (document.getElementById('vag-provider') || {}).value || 'gemini';
    if (prov === 'remotion') {
      return V._doGenerateRemotion(topic, source);
    }
    V._vagSetStage('code', 'ready', '내레이션 확인 대기', '영상을 만들기 전에 내레이션과 장면 흐름을 먼저 확정합니다.');
    V._vagSetStage('render', 'idle', '영상 만들기 전', '아직 최종 영상을 만들지 않았습니다.');
    var btn = document.getElementById('vag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 시나리오 확인 중...'; }

    var profileId = parseInt(window._globalProfileId || 0);
    var aspect = document.getElementById('vag-aspect').value || '9:16';
    if (V._vagSession) V._vagSession.aspect = aspect;
    var duration = Number((V._vagSession && (V._vagSession.requestedDurationSec || V._vagSession.hyperDuration)) || 0)
      || V._vagDurationFromSceneCount(document.getElementById('vag-scene-count').value || '4');
    var profileName = (window._globalProfileData || {}).name || '';
    var sceneCount = parseInt((document.getElementById('vag-scene-count') || {}).value || '4', 10) || 4;
    var expectedSceneCount = _vagExpectedSceneCountForDuration(duration);
    if (sceneCount !== expectedSceneCount && duration <= 135) {
      console.warn('[VAG] scene count corrected from UI value', { from: sceneCount, to: expectedSceneCount, duration: duration });
      sceneCount = expectedSceneCount;
      var sceneInput = document.getElementById('vag-scene-count');
      if (sceneInput) sceneInput.value = String(sceneCount);
    }
    var provider = (document.getElementById('vag-provider') || {}).value || 'gemini';
    var autoNarration = document.getElementById('vag-auto-narration')?.checked !== false;
    var autoBgm = document.getElementById('vag-auto-bgm')?.checked !== false;
    var bgmVol = parseInt(document.getElementById('vag-bgm-volume')?.value || '18', 10) / 100;
    var brandAssetState = await _vagSyncProfileBrandAssetsForGeneration();
    var designFamilyExtras = V._vagBuildDesignFamilyBlock(V._vagSession, aspect);
    var visualConceptExtras = V._vagBuildAdVisualConceptBlock(V._vagSession, aspect);
    var objectiveCaseExtras = V._vagBuildObjectiveCaseBlock(V._vagSession);
    var brandLockExtras = V._vagBuildBrandLockBlock(V._vagSession);
    var directorExtras = V._vagBuildDirectorExtras(V._vagSession);
    var antiRepeatExtras = V._vagBuildAntiRepeatBlock(V._vagSession);
    var motionFrameMode = ((window._vagAutoPrefs && window._vagAutoPrefs.motionFrameMode) || (V._vagSession && V._vagSession.motionFrameMode) || 'dynamic').trim();
    var aiBgVideoMode = ((document.getElementById('vag-ai-bg-video') || {}).value || 'auto').trim();
    var aiBgVideoModel = ((document.getElementById('vag-ai-bg-video-model') || {}).value || '').trim();
    var bgImageProvider = ((document.getElementById('vag-bg-image-provider') || {}).value || 'gemini').trim();
    var profileImageModel = _vagResolveConfiguredImageModel();
      var bgImageModel = ((document.getElementById('vag-bg-image-model') || {}).value || profileImageModel).trim();
      var bgImageCandidateCount = _vagReadBackgroundCandidateCount();
      var outputMode = ((document.getElementById('vag-output-mode') || {}).value || 'motion').trim();
      var manualStepMode = !!(V._vagSession && V._vagSession.manualStepMode);
      if (outputMode === 'image-video') outputMode = 'image-video-hyperframes';
      var imageVideoDirection = (V._vagSession && V._vagSession.imageVideoDirection) || {};
      if ((!imageVideoDirection || (!imageVideoDirection.cutLabel && !imageVideoDirection.vibeLabel)) && /^image-video/.test(outputMode) && window._vagAutoChoices) {
        imageVideoDirection = {
          cut: window._vagAutoChoices.i2vCutDirection || '',
          cutLabel: window._vagAutoChoices.i2vCutLabel || '',
          vibe: window._vagAutoChoices.i2vVibe || '',
          vibeLabel: window._vagAutoChoices.i2vVibeLabel || '',
        };
        if (!V._vagSession) V._vagSession = {};
        V._vagSession.imageVideoDirection = imageVideoDirection;
      }
      var imageVideoDirectionExtras = /^image-video/.test(outputMode)
        ? _vagBuildImageVideoDirectionBlock(imageVideoDirection, '이미지→영상 컷 디렉션')
        : '';
    var hasAttachedImagesForBg = Array.isArray(V._vagAttachedImages) && V._vagAttachedImages.some(function (item) {
      return item && /^data:image\//i.test(String(item.dataUrl || ''));
    });
    var atlasMainEngine = provider === 'atlas' || String(provider || '').indexOf('atlas:') === 0;
    if (aiBgVideoMode === 'auto') {
      aiBgVideoMode = _vagConfiguredImageModeForAuto(hasAttachedImagesForBg);
      if (!aiBgVideoMode) {
        V._vagSetStage('code', 'error', '참고 이미지 필요', '현재 설정된 이미지 Edit 모델은 참고 이미지가 있어야 씬 합성을 시작할 수 있습니다.');
        V._addMsg('ai', '<span style="color:#ff9500;">현재 이미지 AI 설정은 참고 이미지 기반 Edit 모델입니다. 브랜드 로고, 제품/공간 사진, 참고 이미지를 먼저 첨부한 뒤 다시 생성해 주세요.</span>', { html: true });
        V._resetBtn();
        return;
      }
      aiBgVideoModel = '';
    }
    var logoReferenceImagesForBg = _vagLogoReferenceImages();
    if (aiBgVideoMode === 'scene-image') aiBgVideoMode = 'nano-banana-2-text';
    if (logoReferenceImagesForBg.length && (aiBgVideoMode === 'auto' || aiBgVideoMode === 'nano-banana-2-text')) {
      aiBgVideoMode = 'nano-banana-2-edit';
      bgImageProvider = 'gemini';
      bgImageModel = profileImageModel;
      V._addMsg('ai', '브랜드 로고도 참고해서 장면 이미지를 만들게요.');
    }
    if (atlasMainEngine && (aiBgVideoMode === 'scene-image' || aiBgVideoMode === 'nano-banana-2-text' || aiBgVideoMode === 'nano-banana-2-edit')) {
      aiBgVideoMode = hasAttachedImagesForBg ? 'gpt-image-2-edit' : 'nano-banana-2-text';
      V._addMsg('ai', hasAttachedImagesForBg ? 'Atlas Cloud 엔진을 선택해서 참고 이미지는 <b>Atlas OpenAI Image 2 Edit</b>로 맞췄습니다.' : 'Atlas 이미지 모델은 Edit 전용이라 참고 이미지가 없는 씬은 <b>Gemini Nano Banana 2</b>로 생성합니다.', { html: true });
    }
    if (aiBgVideoMode === 'gpt-image-2-edit') bgImageModel = _vagAtlasImageModelForMode(aiBgVideoMode, hasAttachedImagesForBg);
    if (aiBgVideoMode === 'qwen-product-edit') bgImageModel = 'alibaba/qwen-image/edit-plus-20251215';
    if (aiBgVideoMode === 'qwen-image-2-pro-edit') bgImageModel = 'qwen/qwen-image-2.0-pro/edit';
    if (aiBgVideoMode === 'codex-cli') bgImageModel = 'codex-cli';
    if (aiBgVideoMode === 'nano-banana-2-edit') bgImageModel = profileImageModel;
    if (aiBgVideoMode === 'nano-banana-2-text') bgImageModel = profileImageModel;
    if (aiBgVideoMode === 'codex-cli') bgImageProvider = 'codex';
    if (aiBgVideoMode === 'nano-banana-2-edit' || aiBgVideoMode === 'nano-banana-2-text') bgImageProvider = 'gemini';
    if (_vagVideoImageModeUsesAtlas(aiBgVideoMode)) bgImageProvider = 'atlas';
    if (aiBgVideoMode === 'qwen-product-edit' || aiBgVideoMode === 'qwen-image-2-pro-edit') bgImageProvider = 'atlas';
    if (aiBgVideoMode === 'none') {
      aiBgVideoMode = 'nano-banana-2-text';
      bgImageProvider = 'gemini';
      bgImageModel = profileImageModel;
      aiBgVideoModel = '';
      V._addMsg('ai', '광고영상은 장면별 배경 이미지를 먼저 만듭니다. 이미지를 만든 뒤 선택한 컷을 기준으로 영상을 이어갑니다.');
    }
    var sceneContractExtras = [
      '[장면 수/핵심 메시지 계약]',
      '- 정확히 ' + sceneCount + '개 주요 장면만 만든다. 장면을 더 쪼개고 싶어도 .clip/data-start 장면을 추가하지 말고 같은 장면 안의 보조 문장/칩으로 넣어라.',
      '- 영상 전체 핵심 메시지 1문장을 정하고, 모든 화면 문구와 data-vag-narration은 그 메시지를 증명하거나 CTA로 연결해야 한다.',
      '- 각 장면의 정보 밀도는 AI가 정한다. 텍스트가 필요한 장면은 제목/본문/칩을 넣고, 이미지가 메시지를 전달하는 장면은 텍스트를 0~1개로 줄인 image_only/cinematic_image 씬으로 둔다.',
      '- 모든 씬을 같은 텍스트 카드로 만들지 말고 image_only, cinematic_image, kinetic_type, data_proof, product_focus, cta_lockup 중 서로 다른 visual_mode를 섞는다.',
      '- 장면별 리듬은 high / low / high / lockup처럼 설계한다. 이미지 호흡 씬도 빈 화면이 아니라 기억에 남는 비주얼 펀치여야 한다.',
      '- 각 씬의 cut_plan을 따른다. 로컬 코드는 컷 구성을 고정하지 말고 AI가 정한 카메라 움직임, 전환, 홀드, 텍스트 타이밍을 우선한다.',
      '- 강조 칩/배지/숫자는 반드시 같은 씬의 제목·본문·data-vag-narration에서 나온 표현만 사용한다. 장식용 단어(BEAT/RHYTHM/IMPACT 등)나 다른 씬의 문제/해결 문구를 넣지 않는다.',
      '- URL/RSS/출처명/영문 기사 제목/내부 옵션명은 화면 문구와 나레이션에 넣지 않는다.',
    ].join('\n');
    var motionFrameExtras = [
      '[MotionFrames 모션 프레임 옵션]',
      '- 선택 옵션: ' + motionFrameMode,
      '- MotionFrames는 HyperFrames HTML/GSAP에서 씬마다 큰 주효과를 배정하는 모션 감독 규칙이다.',
      '- 모든 씬은 화면 시나리오의 cut_plan을 따르되, 렌더 후 눈에 보이는 큰 모션으로 실행한다.',
      '- 주효과 배정: 1씬 masked image reveal/hero parallax, 2씬 lateral push/image parallax, 3씬 data counter/chart trace, 4씬 line drawing/focus pull, 5씬 depth zoom/product lockup, 마지막 CTA는 CTA pulse/brand lockup으로 구분한다.',
      '- 6씬 이상이면 color sweep, radial wipe, staggered chip burst, diagonal shutter 중 남은 효과를 추가 배정한다.',
      motionFrameMode === 'max'
        ? '- 모션 강도: 최대. 씬마다 대형 mask wipe, split reveal, 3D depth push, 큰 scale/pan, 카운터 트윈, CTA pulse를 적극 사용한다.'
        : motionFrameMode === 'cinematic'
          ? '- 모션 강도: 시네마틱. 이미지 parallax, depth zoom, focus pull, color sweep, 부드러운 wipe를 크게 사용한다.'
          : motionFrameMode === 'clean'
            ? '- 모션 강도: 선명. 과한 흔들림은 줄이되, line draw, counter, mask reveal, CTA pulse는 확실히 보이게 사용한다.'
            : '- 모션 강도: 다이내믹. 패럴랙스, 마스크 리빌, 키네틱 헤드라인, 데이터 카운터, 라인 드로잉, CTA 펄스를 씬별로 나눠 사용한다.',
      '- 단순 fade/slide만으로 끝나는 씬은 실패다.',
      '- GSAP에는 clipPath, stagger, scale/rotate parallax, counter tween, line draw, focus reveal, color sweep이 각각 최소 1회 이상 들어가야 한다.',
    ].join('\n');
    var productAssetExtras = [];
    var isProductObjective = /상품|제품|판매|전환|구매|커머스|쇼핑|런칭|상세/i.test(String((V._vagSession && V._vagSession.objective) || '') + ' ' + String(topic || ''));
    if (isProductObjective) {
      var productAssets = (V._vagSession && V._vagSession.productAssets) || {};
      var attachedProductImages = Array.isArray(V._vagAttachedImages) ? V._vagAttachedImages.length : 0;
      var productSourceUrls = (Array.isArray(productAssets.sourceUrls) && productAssets.sourceUrls.length ? productAssets.sourceUrls : (Array.isArray(V._vagAttachedSources) ? V._vagAttachedSources : []).map(function (item) { return item && item.url ? item.url : ''; })).filter(Boolean).slice(0, 8);
      productAssetExtras = [
        '[상품 자산 수집/컷 설계 규칙]',
        '- 상품 광고는 먼저 상품을 보여주는 자산 단계가 필요하다. 상품 이미지, 상품 URL 크롤링 자료, 첨부 이미지, 자료 이미지가 있으면 모두 상품 자산 후보로 취급한다.',
        '- 현재 첨부된 상품/참고 이미지 수: ' + attachedProductImages + '장',
        Number(productAssets.importedImages || 0) > 0 ? '- 상품 URL에서 가져온 이미지 수: ' + Number(productAssets.importedImages || 0) + '장' : '',
        Number(productAssets.sourceCount || 0) > 0 ? '- 상품/참고 자료 수: ' + Number(productAssets.sourceCount || 0) + '건' : '',
        productSourceUrls.length ? '- 상품/참고 URL 후보: ' + productSourceUrls.join(' / ') : '- 상품 URL 후보: 없음',
        '- 상품 이미지가 있으면 첫 이미지 후보는 상품 히어로컷으로 쓰고, 나머지는 사용컷/디테일컷/패키지컷/비교컷/모델컷 후보로 확장한다.',
        '- 상품 이미지가 부족하면 AI가 먼저 상품 히어로컷을 생성하고, 같은 상품처럼 보이는 사용컷·모델컷·디테일컷을 만들어야 한다.',
        '- 컷 후보는 최소 4종을 고려한다: 상품 히어로, 사용 장면, 디테일 매크로, 모델/라이프스타일, 전후 비교, 패키지 구성, 가격/혜택 CTA.',
        '- 사용자가 이미지 후보를 선택하기 전에는 HyperFrames 모션 합성으로 넘어가지 않는다.',
      ].filter(Boolean).join('\n');
    }
    var aiCreativeExtras = [
      '[AI 크리에이티브 위임 규칙]',
      '- 목표는 평범한 템플릿 영상이 아니라 상업 광고로 바로 쓸 수 있는 최고 수준의 크리에이티브다.',
      '- 광고 기법, 씬 역할, 카피 흐름은 AI가 주제와 자료에 맞게 결정한다.',
      '- AI는 전체 영상 구성을 광고 감독처럼 설계한다. 반복 카드 템플릿이 아니라 주제/자료/이미지에 맞는 장면 언어를 새로 고른다.',
      '- 씬은 각각 따로 노는 카드가 아니라 하나의 광고 시퀀스로 이어져야 한다. 같은 주인공/상품/공간/색감/조명/렌즈 질감을 유지하고, 이전 씬의 감정·동작·시선이 다음 씬으로 이어지게 cut_plan을 쓴다.',
      '- 각 씬의 첫 프레임은 이전 씬 마지막 인상과 연결되어야 한다. 갑자기 다른 장소, 다른 사람, 다른 메시지로 점프하지 않는다.',
      '- 먼저 씬별 배경 컨셉 이미지/키비주얼을 확정하고, 그 이미지를 HyperFrames 배경 자산으로 삼아 모션을 설계한다.',
      '- 필요하면 visual prompt, camera direction, SFX cue 같은 제작 개념을 씬 플랜에 반영하되, 최종 움직임은 HyperFrames HTML/GSAP 레이어가 담당한다.',
      '- 영상 컷도 AI가 주도한다. 로컬 코드는 씬별 cut_plan을 전달하고 검증하는 역할만 하며, 기본 템플릿 컷을 임의로 강제하지 않는다.',
      '- 로컬 코드는 기본 광고 문구를 임의로 만들지 않는다.',
      '- CTA는 마지막 씬 행동 유도에만 사용하고 첫 씬/중간 씬에 반복하지 않는다.',
    ].join('\n');
    var aiBackgroundExtras = aiBgVideoMode && aiBgVideoMode !== 'none'
      ? [
          '[씬별 배경 컨셉 이미지 + HyperFrames 모션 규칙]',
      '- 텍스트 투 비디오로 바로 만들지 않는다.',
      '- 코딩 전에 확정한 각 씬의 image_prompt로 씬별 배경 컨셉 이미지를 먼저 생성하고, 생성된 이미지를 확인한 뒤 그 이미지를 해당 씬의 배경으로 사용한다.',
          '- 이미지에는 글자, 자막, 가격표, CTA, 로고 텍스트, UI 문구를 넣지 않는다. 모든 문구와 그래픽 강조는 HyperFrames 합성 레이어에서 만든다.',
          '- 이미지 비율은 반드시 ' + aspect + '다. ' + (aspect === '16:9' ? '가로형 광고 프레임' : aspect === '1:1' ? '정사각 프레임' : '세로형 숏폼 프레임') + '으로 생성하고, 회전/기울어진 사진/누운 인물/가로세로 뒤집힘은 실패다.',
	          '- 이미지 후보가 여러 장이면 사용자가 선택한 이미지 URL만 HyperFrames 배경 자산으로 사용한다.',
	          '- 씬 이미지 생성 단계에서 HyperFrames 텍스트가 올라갈 안전영역을 미리 비워 둔다. HTML에서 텍스트 위치를 억지로 찾는 것이 아니라, 이미지의 피사체/여백/명도 설계와 HyperFrames 레이아웃이 한 세트여야 한다.',
          '- 씬별 이미지 생성 엔진: ' + (bgImageProvider || 'gemini') + (bgImageModel ? ' / ' + bgImageModel : ''),
          aiBgVideoMode === 'gpt-image-2-edit' ? '- Atlas OpenAI GPT Image 2 Edit를 사용한다. 참고 이미지나 주인공 레퍼런스를 실제 reference_images로 전달한다.' : '',
          aiBgVideoMode === 'nano-banana-2-edit' ? '- 첨부 참고 이미지는 Nano Banana 2 Edit의 images 입력으로 전달해 새 배경 생성에 반영한다.' : '',
          (aiBgVideoMode === 'qwen-product-edit' || aiBgVideoMode === 'qwen-image-2-pro-edit') ? '- 상품/참고 이미지는 Qwen Image Edit로 각도, 거리, 손 사용 장면, 라이프스타일 컷, 매크로 디테일 컷을 다양하게 변형한다. 이미지 안에 한글/영문 문구, 가격표, CTA, 로고 텍스트를 생성하지 않는다.' : '',
          '- 선택된 배경 이미지 URL은 HyperFrames 생성기가 직접 설계에 반영한다. 로컬 코드는 레이아웃, 오버레이, 자막 박스 스타일을 강제하지 않는다.',
          '- HyperFrames는 보조 자막 레이어가 아니라 최종 광고 화면의 디자인/프레임/모션 본체다. 배경 이미지를 full-bleed로 보여주고, 그 위에 씬별로 다른 프레임 구조, 마스크 리빌, 패럴랙스 줌, 포커스 라인, 키네틱 타이포, 칩/마커, 전환 그래픽을 설계한다.',
          '- 배경 이미지를 좌우/상하로 나누거나 큰 흰 패널, 큰 색 패널, 정보판으로 가리지 않는다. 문구와 CTA는 배경 이미지 위에 작은 대비 레이어로만 얹는다.',
          '- 모든 씬을 같은 회색/흰색 카드, 중앙 텍스트 박스, 단순 캡션 반복으로 만들면 실패다. 씬마다 image_only, cinematic_image, kinetic_type, data_proof, product_focus, cta_lockup 같은 화면 문법을 다르게 섞는다.',
          '- 이미지가 배경에 깔려도 화면이 비어 보이면 실패다. GSAP timeline에는 clipPath 또는 mask reveal, scale/translate parallax, stagger, line draw 또는 marker sweep, CTA/엔드 프레임 hold 중 최소 4종 이상이 실제로 보여야 한다.',
          '- 텍스트 레이아웃은 HyperFrames layout-before-animation 원칙을 따른다. content container는 프레임을 채우고 safe area 안에서 flex/grid로 배치하며, 텍스트를 절대좌표로 임의 고정해 겹치게 만들지 않는다.',
          '- 프로필 로고 reference가 있으면 HTML에 로고 이미지를 별도 오버레이로 붙이지 않는다. 배경 이미지 생성 단계에서 간판, 제품 표식, 앱 아이콘, 패키지 라벨, 공간 소품처럼 자연스럽게 녹인 결과만 사용한다.',
          '- 사전 cut_plan, MotionFrames 규칙, 프로필 CI/BI 디자인 규칙을 우선한다.',
          '- 현재 모드는 씬별 배경 컨셉 이미지를 HyperFrames 배경 자산으로 사용한다.',
        ].join('\n')
      : '';
    // 소재 우선 모드면 소재 원문과 디자인 규칙을 강한 계약 블록으로 묶어 AI가 실제 문구를 씬에 반영하게 한다.
    var _srcPriority = !!(V._vagSession && V._vagSession.sourcePriority);
    var profileDesignGuideExtras = brandAssetState.designGuide || (typeof V._vagBuildProfileDesignGuideBlock === 'function' ? V._vagBuildProfileDesignGuideBlock() : '');
    var materialDesignContract = _vagBuildAttachedMaterialDesignContract(source || '', profileDesignGuideExtras);
    var sourceExtras = String(source || '').slice(0, _srcPriority ? 4200 : 1800);
    var payload = {
      topic: topic || '마케팅 영상',
      brand: profileName || '',
      product: topic || '마케팅 영상',
      source: materialDesignContract || source || '',
      objective: (V._vagSession && V._vagSession.objective) || '광고 전환',
      goal: (V._vagSession && V._vagSession.objective) || '광고 전환',
      tone: (V._vagSession && V._vagSession.tone) || '직설',
      platform: aspect === '16:9' ? '광고/유튜브' : aspect === '1:1' ? '피드' : '릴스/숏츠',
      aspect: aspect,
      duration: duration,
      scene_count: sceneCount,
      key_points: V._vagBuildKeyPoints(source, V._vagSession),
      cta: (document.getElementById('vag-cta-input')?.value || '').trim() || (V._vagSession && V._vagSession.cta) || '',
        extras: [materialDesignContract, sourceExtras, objectiveCaseExtras, productAssetExtras, sceneContractExtras, motionFrameExtras, aiCreativeExtras, aiBackgroundExtras, imageVideoDirectionExtras, visualConceptExtras, designFamilyExtras, brandLockExtras, directorExtras, antiRepeatExtras].filter(Boolean).join('\n\n').trim(),
      profile_id: profileId || null,
      provider: provider,
      reference_images: _vagHtmlReferenceImages(),
      reference_sources: V._vagAttachedSources.slice(),
      auto_narration: autoNarration,
      auto_bgm: autoBgm,
      bgm_volume: bgmVol,
      brand_color: (V._vagSession && V._vagSession.brandColor) || '',
      design_rules: profileDesignGuideExtras || '',
      logo_url: null,
      ai_background_video_mode: aiBgVideoMode || 'nano-banana-2-text',
      ai_background_video_model: aiBgVideoModel || '',
      bg_image_provider: bgImageProvider || 'gemini',
      bg_image_model: bgImageModel || profileImageModel,
      bg_image_candidate_count: bgImageCandidateCount,
      output_mode: outputMode,
      design_family: (V._vagSession && V._vagSession.designFamily) || '',
      planned_hf_templates: (V._vagSession && V._vagSession.designSystem && Array.isArray(V._vagSession.designSystem.hfTemplates)) ? V._vagSession.designSystem.hfTemplates.slice(0, 6) : [],
      image_strategy: (V._vagSession && V._vagSession.designSystem && V._vagSession.designSystem.imageStrategy) || '',
    };
    var approvedScenarioBeforeCode = false;
    var generatedSceneImages = [];
    if (!(V._vagSession && V._vagSession.followupInstruction)) {
      V._vagSetStage('code', 'working', '장면 구성 작성 중', '아직 최종 영상 만들기 전입니다. 내레이션, 장면 흐름, 이미지 방향을 먼저 만듭니다.');
      var scenarioResp;
      var scenarioData = {};
      try {
        scenarioResp = await V._vagFetch('/api/hyperframes/generate-scenario-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic || '',
            source: [materialDesignContract, source || '', objectiveCaseExtras, productAssetExtras, visualConceptExtras].filter(Boolean).join('\n\n'),
            objective: payload.goal || '',
            tone: payload.tone || '',
            cta: payload.cta || '',
            aspect: aspect || '9:16',
            duration: duration,
            scene_count: sceneCount,
            key_points: payload.key_points || [],
          }),
        });
        scenarioData = await scenarioResp.json().catch(function () { return {}; });
      } catch (scenarioErr) {
        scenarioData = { error: scenarioErr && scenarioErr.message ? scenarioErr.message : 'AI 시나리오 호출 실패' };
      }
      if (!scenarioResp || !scenarioResp.ok || !scenarioData.ok || !Array.isArray(scenarioData.scenes) || !scenarioData.scenes.length) {
        var scenarioDetail = scenarioData.detail || scenarioData.error || '응답이 비어 있습니다.';
        var restartHint = /501|not implemented|go-native|endpoint not implemented/i.test(String(scenarioDetail) + ' ' + String(scenarioResp && scenarioResp.status || ''))
          ? '<br><b>현재 실행 중인 앱 서버가 구버전입니다.</b> 앱을 재시작한 뒤 다시 시도해 주세요.'
          : '';
        V._vagSetStage('code', 'error', 'AI 시나리오 생성 실패', scenarioDetail);
        V._addMsg('ai',
          '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
            '<b>HyperFrames 모션 합성을 시작하지 않았습니다.</b><br>' +
            '순서는 씬 콘티 생성 → 확인/수정 → 씬 이미지 생성 → HyperFrames 모션 합성입니다. 지금은 첫 단계에서 멈춘 상태입니다.' + restartHint + '<br>' +
            '<span style="color:rgba(0,0,0,0.55);">' + V._esc(scenarioDetail) + '</span>' +
          '</div>',
          { html: true }
        );
        V._resetBtn();
        return;
      }
      if (scenarioData.warning) {
        V._addMsg('ai', '<span style="color:#ff9500;">시나리오 응답을 보정했습니다: ' + V._esc(scenarioData.warning) + '</span>', { html: true });
      }
      var sceneDur = Math.max(1, duration / Math.max(1, scenarioData.scenes.length));
      var preCodePlan = scenarioData.scenes.map(function (rawScene, idx) {
        var scene = _vagEnsureProductionStoryboard(rawScene, idx, scenarioData.scenes.length);
        var narration = String(scene.narration || '').trim();
        var visualMode = String(scene.visual_mode || scene.visualMode || '').trim();
        var cutPlan = String(scene.cut_plan || scene.cutPlan || '').trim();
        var production = _vagSceneProductionFields(scene);
        if (!cutPlan) {
          cutPlan = idx === 0
            ? '첫 1초는 선택한 이미지의 핵심 피사체를 홀드하고, 천천히 push-in 하며 핵심 문구를 늦게 등장시킨다.'
            : idx === scenarioData.scenes.length - 1
              ? '이미지를 안정적으로 홀드한 뒤 CTA 문구를 또렷하게 고정하고, 마지막 0.5초는 여백을 둔다.'
              : visualMode.indexOf('image') >= 0
                ? '선택한 이미지를 2초 이상 호흡 있게 보여주고, subtle pan/zoom으로 시선을 한 지점에 모은다.'
                : '이미지 배경 위에 카피를 2단계로 등장시키고, 장면 전환은 빠른 wipe 또는 soft crossfade로 연결한다.';
        }
        return {
          index: idx + 1,
          start: Math.round(idx * sceneDur * 100) / 100,
          duration: Math.round(sceneDur * 100) / 100,
          role: String(scene.role || '').trim(),
          visualMode: visualMode,
          cutPlan: cutPlan,
          title: String(scene.title || '').trim(),
          body: String(scene.body || '').trim(),
          emphasis: Array.isArray(scene.emphasis) ? scene.emphasis.filter(Boolean).slice(0, 3) : [],
          imagePrompt: String(scene.image_prompt || scene.imagePrompt || '').trim(),
          narration: narration,
          shotType: production.shotType,
          subjectAction: production.subjectAction,
          camera: production.camera,
          lens: production.lens,
          lighting: production.lighting,
          artDirection: production.artDirection,
          propsWardrobe: production.propsWardrobe,
          composition: production.composition,
          transition: production.transition,
          soundCue: production.soundCue,
          editBeat: production.editBeat,
          lipSyncHint: production.lipSyncHint,
          negativeConstraints: production.negativeConstraints,
          lines: [scene.title || '', scene.body || ''].filter(Boolean),
        };
      });
      if (V._vagSession) {
        V._vagSession.baseTopic = topic || '';
        V._vagSession.baseSource = source || '';
        V._vagSession.hyperDuration = duration;
        V._vagSession.sceneNarrationPlan = preCodePlan;
        V._vagSession.narrationScript = preCodePlan.map(function (scene) { return scene.narration; }).filter(Boolean).join('\n');
        V._vagSession.aiBackgroundVideoMode = aiBgVideoMode || 'nano-banana-2-text';
        V._vagSession.aiBackgroundVideoModel = aiBgVideoModel || '';
        V._vagSession.bgImageProvider = bgImageProvider || 'gemini';
        V._vagSession.bgImageModel = bgImageModel || profileImageModel;
        V._vagSession.bgImageCandidateCount = bgImageCandidateCount;
        V._vagSession.outputMode = outputMode;
      }
      V._vagHyperHtml = '';
      V._vagTextEntries = [];
      V._vagRenderTextEditCard();
      V._addMsg('ai', '📝 먼저 <b>나레이션, 장면 흐름, 이미지 방향</b>을 만들었습니다. 왼쪽에서 바로 고치고 확정하면 영상을 만들게요.', { html: true });
      if (typeof V._vagAwaitSceneNarrationApproval === 'function') {
        var scenarioApproval = await V._vagAwaitSceneNarrationApproval({
          html: '',
          narrationScript: (V._vagSession && V._vagSession.narrationScript) || '',
          duration: duration,
          chatEditorOnly: true,
          stageTitle: '나레이션·장면 확인 대기',
          stageDetail: '영상을 만들기 전에 나레이션과 장면 흐름을 확인합니다.',
          renderStageTitle: '영상 만들기 전',
          renderStageDetail: '아직 최종 영상을 만들지 않았습니다.',
          approvalTitle: '나레이션과 장면 흐름이 맞나요?',
          approvalDetail: '확정하면 이 내용으로 영상을 만듭니다.',
          confirmLabel: '이 내용으로 영상 만들기',
        });
        if (!scenarioApproval || !scenarioApproval.ok) {
          V._addMsg('ai', '영상 만들기를 시작하지 않았습니다. 나레이션과 장면 흐름을 조정한 뒤 다시 진행해 주세요.');
          V._resetBtn();
          return;
        }
        approvedScenarioBeforeCode = true;
        if (V._vagSession) {
          V._vagSession.narrationScript = scenarioApproval.narrationScript || V._vagSession.narrationScript || '';
          V._vagSession.scenarioApprovedBeforeCode = true;
        }
      }
      var approvedPlan = (V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan)) ? V._vagSession.sceneNarrationPlan : preCodePlan;
      var approvedScenarioBlock = [
        '[확정된 내레이션/씬 플랜]',
        '- 아래 씬 플랜은 사용자가 코딩 전에 확인한 기준이다. HTML 생성 시 이 순서와 문구, 이미지 방향을 우선 사용하고 새 시나리오를 임의로 만들지 마라.',
      ].concat(approvedPlan.map(function (scene, idx) {
        var p = _vagSceneProductionFields(scene);
        return '씬 ' + (idx + 1) + ': ' + [
          scene.title || '',
          scene.body || '',
          scene.visualMode ? '구성=' + scene.visualMode : '',
          scene.cutPlan ? '컷=' + scene.cutPlan : '',
          p.shotType ? '쇼트=' + p.shotType : '',
          p.subjectAction ? '행동=' + p.subjectAction : '',
          p.camera ? '카메라=' + p.camera : '',
          p.lighting ? '조명=' + p.lighting : '',
          p.soundCue ? '사운드=' + p.soundCue : '',
          p.lipSyncHint ? '립싱크=' + p.lipSyncHint : '',
          scene.imagePrompt ? '이미지=' + scene.imagePrompt : '',
          scene.narration ? '나레이션=' + scene.narration : '',
        ].filter(Boolean).join(' / ');
      })).join('\n');
      var multimodalHarmonyBlock = _vagBuildMultimodalHarmonyBlock(approvedPlan, {
        topic: topic || '',
        objective: payload.goal || '',
        tone: payload.tone || '',
      });
      if (V._vagSession) V._vagSession.multimodalHarmonyBlock = multimodalHarmonyBlock;
      var characterStoryboardBlock = _vagBuildCharacterReferenceLines(V._vagSession).join('\n');
      payload.extras = [approvedScenarioBlock, multimodalHarmonyBlock, characterStoryboardBlock, materialDesignContract, payload.extras].filter(Boolean).join('\n\n');

      if (aiBgVideoMode && aiBgVideoMode !== 'none') {
        V._vagSetStage('code', 'working', '배경 이미지 생성 중', '확정된 장면마다 배경 이미지를 먼저 만듭니다.');
        var attachedBgImages = Array.isArray(V._vagAttachedImages) ? V._vagAttachedImages.filter(function (item) {
          return item && /^data:image\//i.test(String(item.dataUrl || ''));
        }) : [];
        var logoReferenceImages = _vagLogoReferenceImages();
        var nonLogoReferenceImages = attachedBgImages.filter(function (item) {
          return !item || item.source !== 'profile-logo';
        });
        if (attachedBgImages.length && aiBgVideoMode === 'nano-banana-2-edit') {
          V._addMsg('ai', '🖼️ 첨부한 이미지 ' + attachedBgImages.length + '장을 참고해서 장면별 배경을 새로 만듭니다.');
        }
        if (!generatedSceneImages.length) {
          var modelLabel = aiBgVideoMode === 'nano-banana-2-edit'
            ? 'Gemini Nano Banana 2 Edit'
            : aiBgVideoMode === 'nano-banana-2-text'
              ? 'Gemini Nano Banana 2 text-to-image'
              : aiBgVideoMode === 'gpt-image-2-edit'
                ? 'Atlas OpenAI GPT Image 2 Edit'
                : aiBgVideoMode === 'codex-cli'
                  ? 'Codex CLI 직접 이미지 생성'
              : aiBgVideoMode === 'qwen-product-edit'
                ? 'Atlas Qwen Image Edit Plus'
                : aiBgVideoMode === 'qwen-image-2-pro-edit'
                  ? 'Atlas Qwen Image 2.0 Pro Edit'
                  : 'Gemini Nano Banana 2 text-to-image';
          V._addMsg('ai', '🖼️ 장면별 배경 이미지를 먼저 만듭니다. 장면마다 후보 ' + bgImageCandidateCount + '장 중 고른 이미지만 영상에 사용합니다.');
          if (V._vagSession && V._vagSession.visualConcept) {
            var conceptLabels = Array.isArray(V._vagSession.visualConcepts) && V._vagSession.visualConcepts.length
              ? V._vagSession.visualConcepts.map(function (item) { return item.label; }).join(' · ')
              : V._vagSession.visualConcept.label;
            V._addMsg('ai', '선택한 배경 이미지 느낌: <b>' + V._esc(conceptLabels) + '</b><br><span style="font-size:11px;color:rgba(0,0,0,0.5);">장면별 배경 이미지에 반영합니다.</span>', { html: true });
          }
          if (V._vagSession && V._vagSession.objectiveCaseCandidates && V._vagSession.objectiveCaseCandidates.length) {
            V._addMsg('ai', '🎯 목적별 컷 플레이북 적용: <b>' + V._esc(V._vagSession.objectiveCaseFamily || '광고 목적') + '</b><br><span style="font-size:11px;color:rgba(0,0,0,0.5);">' + V._esc(V._vagSession.objectiveCaseCandidates.map(function (item) { return item.label; }).join(' · ')) + '</span>', { html: true });
          }
        }
        var characterRefs = [];
        if (V._vagSession && V._vagSession.campaignModel && V._vagSession.campaignModel.generateReferenceImage !== false && !V._vagSession.characterImageUrl) {
          try {
            V._vagSetStage('code', 'working', '광고 주인공 사진 생성 중', '장면마다 같은 사람으로 보이게 할 기준 사진을 먼저 만듭니다.');
            V._addMsg('ai', '🧑‍🎬 광고 주인공이 장면마다 달라 보이지 않도록 <b>기준 사진</b>을 먼저 만듭니다.', { html: true });
            var characterProvider = bgImageProvider || 'gemini';
            var characterModel = bgImageModel || profileImageModel;
            if (characterProvider === 'atlas' && /\/edit/i.test(characterModel) && !attachedBgImages.length) {
              characterProvider = 'gemini';
              characterModel = profileImageModel;
            }
            var characterResp = await V._vagFetch('/api/hyperframes/generate-bg-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: topic || '',
                tone: payload.tone || '',
                objective: payload.goal || '',
                aspect: '1:1',
                provider: characterProvider,
                model: characterModel,
                scene_index: 0,
                scene_title: 'campaign-character-reference',
                scene_body: '',
                narration: '',
                prompt: [
                  '[캐릭터 유지용 기준 이미지]',
                  '광고 전체에 반복 등장할 가상 주인공 1명의 시네마틱 실사 레퍼런스 이미지를 만든다.',
                  '실제 광고 촬영 전 캐스팅 보드처럼 얼굴, 헤어, 의상 계열, 분위기가 명확해야 한다.',
                  '텍스트, 로고, 워터마크, 이름표, UI 요소는 넣지 않는다.',
                  '가상 3D, 일러스트, 애니메이션 캐릭터 느낌은 금지하고 실제 카메라로 촬영한 인물 사진처럼 만든다.',
                  V._vagSession.campaignModel.label + ': ' + V._vagSession.campaignModel.prompt,
                  visualConceptExtras || '',
                ].filter(Boolean).join('\n'),
                duration: 1,
                reference_images: attachedBgImages.slice(0, 6).map(function (item) { return item.dataUrl; }),
              }),
            });
            var characterData = await characterResp.json().catch(function () { return {}; });
            if (characterResp.ok && characterData.ok && characterData.url) {
              V._vagSession.characterImageUrl = characterData.url;
              characterRefs.push(characterData.url);
              await _vagPersistCampaignCharacterReference(characterData.url, {
                provider: characterProvider,
                model: characterModel,
                topic: topic || '',
                objective: payload.goal || '',
              });
              _vagRenderCharacterReferenceCard(characterData.url, V._vagSession.campaignModel);
              V._addMsg('ai', '✅ 광고 주인공 기준 사진을 만들었습니다. 이후 장면에서도 같은 사람처럼 맞춥니다.');
            } else {
              throw new Error(characterData.detail || characterData.error || '캐릭터 이미지 응답 없음');
            }
          } catch (characterErr) {
            V._addMsg('ai', '<span style="color:#ff9500;">⚠ 광고 주인공 기준 사진 만들기 실패 — 설명만으로 최대한 같은 사람처럼 맞춰 진행합니다: ' + V._esc(characterErr.message || characterErr) + '</span>');
          }
        } else if (V._vagSession && V._vagSession.characterImageUrl) {
          characterRefs.push(V._vagSession.characterImageUrl);
        }
        var hasCharacterLock = characterRefs.length > 0 && V._vagSession && V._vagSession.campaignModel;
        if (hasCharacterLock) {
          aiBgVideoMode = 'gpt-image-2-edit';
          bgImageProvider = 'atlas';
          bgImageModel = VAG_ATLAS_GPT_IMAGE2_EDIT;
          V._addMsg('ai', '광고 주인공이 장면마다 달라 보이지 않도록, 같은 기준 이미지로 맞춰 만들게요.');
        } else if (logoReferenceImages.length && aiBgVideoMode === 'nano-banana-2-text') {
          aiBgVideoMode = 'nano-banana-2-edit';
          bgImageProvider = 'gemini';
          bgImageModel = profileImageModel;
          V._addMsg('ai', '모든 배경 이미지에 같은 브랜드 로고를 참고해서 자연스럽게 반영합니다.');
        }
        for (var si = 0; si < approvedPlan.length; si++) {
          if (generatedSceneImages[si] && generatedSceneImages[si].url) continue;
          var bgScene = approvedPlan[si] || {};
          var candidateList = [];
          var scenePromptForPreview = '';
          try {
            for (var ci = 0; ci < bgImageCandidateCount; ci++) {
              var variationLabel = _vagImageVariationLabel(ci, payload.goal);
              var scenarioLockedImagePrompt = _vagBuildScenarioLockedImagePrompt(bgScene, si + 1, approvedPlan.length, variationLabel);
              var characterReferenceLines = _vagBuildCharacterReferenceLines(V._vagSession);
              var includeAllBgReferences = hasCharacterLock || aiBgVideoMode === 'nano-banana-2-edit' || aiBgVideoMode === 'qwen-product-edit' || aiBgVideoMode === 'qwen-image-2-pro-edit' || aiBgVideoMode === 'gpt-image-2-edit';
              var sceneReferenceImages = characterRefs
                .concat(logoReferenceImages.map(function (item) { return item.dataUrl; }))
                .concat(includeAllBgReferences ? nonLogoReferenceImages.slice(0, 14).map(function (item) { return item.dataUrl; }) : [])
                .slice(0, 14);
              scenePromptForPreview = scenePromptForPreview || scenarioLockedImagePrompt;
              var bgResp = await V._vagFetch('/api/hyperframes/generate-bg-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topic: topic || '',
                  tone: payload.tone || '',
                  objective: payload.goal || '',
                  aspect: aspect || '9:16',
                  provider: bgImageProvider || 'gemini',
                  model: bgImageModel || profileImageModel,
                  design_rules: profileDesignGuideExtras || '',
                  scene_index: si + 1,
                  scene_title: bgScene.title || '',
                  scene_body: bgScene.body || '',
                  narration: bgScene.narration || '',
                  prompt: [
                    '[공통 비주얼 시스템]',
                    '이 광고 한 편의 모든 씬은 같은 캠페인처럼 보여야 한다. 색감, 렌즈 질감, 조명 방향, 배경 톤, 그래픽 무드를 일관되게 유지한다.',
                    '프레임 비율은 반드시 ' + (aspect || '9:16') + '이다. 이미지가 90도 회전되거나, 세로/가로가 뒤집히거나, 인물/제품이 누운 방향으로 나오면 실패다. 피사체는 upright orientation을 유지한다.',
                    '씬들은 하나의 시네마틱 광고 시퀀스로 이어진다. 이전 씬과 다음 씬 사이에 같은 인물/상품/공간 단서, 시선 방향, 카메라 거리 변화, 색감 continuity를 유지한다.',
                    '모델 일관성: 제공된 프로필 로고/상품/공간/주인공 reference는 모든 씬에서 같은 정체성으로 유지한다. reference 이미지를 텍스트로만 설명하지 말고 실제 이미지 입력 기준으로 반영한다.',
                    logoReferenceImages.length ? '로고 reference 계약: 제공된 실제 로고 이미지는 안전영역을 피해 간판, 제품 표식, 앱 아이콘, 패키지 라벨, 공간 소품 중 하나로 자연스럽게 이미지 자체에 합성한다. HyperFrames HTML에서 로고 이미지를 따로 올리지 않는다.' : '',
                    '후보마다 구도와 상황은 다르게 만들되, 서로 다른 브랜드/다른 영상처럼 보이면 안 된다.',
                    characterReferenceLines.join('\n'),
                    V._vagSession && V._vagSession.personMode === '사람 없이 제품·공간·그래픽 중심' ? '사람, 얼굴, 손 모델을 등장시키지 않는다.' : '',
                    multimodalHarmonyBlock || '',
                    objectiveCaseExtras || '',
                    productAssetExtras || '',
                    brandLockExtras || '',
                    materialDesignContract || '',
                    visualConceptExtras || '',
                    '',
                    scenarioLockedImagePrompt,
                    _vagImageVariationInstruction(variationLabel, si + 1),
                  ].filter(Boolean).join('\n'),
                  duration: bgScene.duration || sceneDur,
                  character_reference: (V._vagSession && V._vagSession.characterImageUrl) || '',
                  character_prompt: (V._vagSession && V._vagSession.campaignModel && V._vagSession.campaignModel.prompt) || '',
                  character_label: (V._vagSession && V._vagSession.campaignModel && V._vagSession.campaignModel.label) || '',
                  person_mode: (V._vagSession && V._vagSession.personMode) || '',
                  reference_images: sceneReferenceImages,
                  candidate_index: ci + 1,
                  candidate_count: bgImageCandidateCount,
                }),
              });
              var bgData = await bgResp.json().catch(function () { return {}; });
              if (bgResp.ok && bgData.ok && bgData.url) {
                candidateList.push({
                  index: si + 1,
                  candidateIndex: ci + 1,
                  url: bgData.url,
                  summary: bgScene.title || bgScene.body || bgScene.narration || ('씬 ' + (si + 1) + ' 배경 이미지'),
                  debugPrompt: scenarioLockedImagePrompt,
                });
                V._addMsg('ai', '✅ 씬 ' + (si + 1) + ' 이미지 후보 ' + (ci + 1) + '/' + bgImageCandidateCount + ' 생성 완료');
              } else {
                throw new Error(bgData.detail || bgData.error || '이미지 응답 없음');
              }
            }
            generatedSceneImages.push({
              index: si + 1,
              url: candidateList[0] ? candidateList[0].url : '',
              summary: bgScene.title || bgScene.body || bgScene.narration || ('씬 ' + (si + 1) + ' 배경 이미지'),
              debugPrompt: scenePromptForPreview || bgScene.imagePrompt || '',
              candidates: candidateList,
            });
            bgScene.imageUrl = candidateList[0] ? candidateList[0].url : '';
          } catch (bgErr) {
            V._vagSetStage('code', 'error', '씬별 이미지 생성 실패', bgErr && bgErr.message ? bgErr.message : '이미지 생성 실패');
            V._addMsg('ai',
              '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                '<b>HyperFrames 모션 합성을 시작하지 않았습니다.</b><br>씬별 이미지 생성이 실패했습니다. 이미지 기반 합성 조건이므로 여기서 멈춥니다.<br>' +
                '<span style="color:rgba(0,0,0,0.55);">' + V._esc(bgErr && bgErr.message ? bgErr.message : '') + '</span>' +
              '</div>',
              { html: true }
            );
            V._resetBtn();
            return;
          }
        }
        var backgroundSelectionState = _vagApplyDefaultSceneBackgroundSelection(generatedSceneImages);
        var requiresVideoImageSelection = outputMode !== 'image-only' && backgroundSelectionState.hasMultiple;
        var requireBackgroundSelection = outputMode !== 'image-only' && (manualStepMode || requiresVideoImageSelection);
        if (V._vagSession) V._vagSession.sceneBackgroundImages = generatedSceneImages.slice();
        if (typeof V._vagShowSceneBackgroundImages === 'function') {
          V._vagShowSceneBackgroundImages(generatedSceneImages, {
            requireSelection: requireBackgroundSelection,
            autoSelected: !requireBackgroundSelection,
          });
        }
        var shouldAwaitBackgroundApproval = true;
        if (shouldAwaitBackgroundApproval && typeof V._vagAwaitSceneBackgroundApproval === 'function') {
          V._vagSetStage('code', 'ready', '이미지 확인 대기', outputMode === 'image-only' ? '이미지를 크게 확인하고 여기서 마칩니다.' : '이미지를 크게 확인한 뒤 승인하면 영상 만들기로 넘어갑니다.');
          var bgApproval = await V._vagAwaitSceneBackgroundApproval(generatedSceneImages, {
            requireSelection: requireBackgroundSelection,
          });
          if (!bgApproval || !bgApproval.ok) {
            V._addMsg('ai', '영상 만들기를 시작하지 않았습니다. 배경 이미지를 확인한 뒤 다시 진행해 주세요.');
            V._resetBtn();
            return;
          }
        } else if (outputMode !== 'image-only') {
          V._addMsg('ai', '✅ 장면마다 배경 이미지가 1장씩이라 자동으로 선택하고 바로 진행합니다.');
        }
        var selectedImageStoryboardBlock = _vagBuildSelectedImageStoryboardBlock(approvedPlan, generatedSceneImages);
        if (selectedImageStoryboardBlock) {
          payload.extras = [payload.extras, selectedImageStoryboardBlock].filter(Boolean).join('\n\n');
        }
        if (outputMode === 'image-only') {
          V._vagSetStage('code', 'ready', '배경 이미지 생성 완료', '선택한 이미지까지 확정했습니다. 영상 만들기는 시작하지 않았습니다.');
          V._addMsg('ai', '✅ 배경 이미지만 만들었습니다. 영상 만들기는 시작하지 않았습니다.');
          V._resetBtn();
          return;
        }
        if (outputMode === 'image-video' || outputMode === 'image-video-hyperframes') {
          if (typeof _vagAwaitImageVideoPromptApproval === 'function') {
            V._vagSetStage('code', 'ready', '이미지 움직임 확인 대기', '선택한 이미지를 어떻게 움직일지 장면별 설명을 확인합니다.');
            var i2vPromptApproval = await _vagAwaitImageVideoPromptApproval(approvedPlan, generatedSceneImages);
            if (!i2vPromptApproval || !i2vPromptApproval.ok) {
              V._addMsg('ai', '이미지로 영상 만들기를 시작하지 않았습니다. 장면별 움직임 설명을 확인한 뒤 다시 진행해 주세요.');
              V._resetBtn();
              return;
            }
            if (Array.isArray(i2vPromptApproval.prompts)) {
              i2vPromptApproval.prompts.forEach(function (prompt, idx) {
                if (approvedPlan[idx]) approvedPlan[idx].imageVideoPrompt = prompt;
              });
            }
          }
          V._vagSetStage('code', 'working', '이미지를 영상으로 바꾸는 중', outputMode === 'image-video-hyperframes' ? '선택한 이미지를 짧은 영상으로 바꾼 뒤 자막과 음성을 더합니다.' : '선택한 이미지를 시작 화면으로 사용해 짧은 영상 클립을 만듭니다.');
          V._addMsg('ai', outputMode === 'image-video-hyperframes'
            ? '🎬 선택한 이미지를 먼저 짧은 영상으로 바꾸고, 그 위에 문구·나레이션·배경음악을 더합니다.'
            : '🎬 선택한 이미지를 시작 화면으로 사용해 바로 짧은 영상 클립을 만듭니다.',
            { html: outputMode === 'image-video-hyperframes' });
          var i2vModel = aiBgVideoModel || VAG_CHEAP_IMAGE_VIDEO_MODEL;
          var imageVideoResults = [];
          for (var vi = 0; vi < generatedSceneImages.length; vi++) {
            var vidScene = approvedPlan[vi] || {};
            var vidImage = generatedSceneImages[vi] || {};
            var sceneI2VModel = _vagResolveImageVideoModelForScene(i2vModel, vidScene);
            if (sceneI2VModel !== i2vModel) {
              V._addMsg('ai', '⚠ 씬 ' + (vi + 1) + '은 사람/얼굴/모델 요소가 있어 Seedance 대신 Wan 2.2 Turbo Spicy로 전환합니다.');
            }
            try {
              V._vagSetStage('code', 'working', '이미지 기반 영상 생성중', '씬 ' + (vi + 1) + '/' + generatedSceneImages.length + ' 클립을 생성합니다.');
              var vidCharacterLines = _vagBuildCharacterReferenceLines(V._vagSession);
                var vidLipSyncEnabled = _vagShouldUseLipSync(vidScene);
                var vidPrompt = [
                  vidCharacterLines.join('\n'),
                  imageVideoDirectionExtras ? imageVideoDirectionExtras.replace('[이미지→영상 컷 디렉션]', '[이번 클립 영상 디렉션]') : '',
                  vidScene.imageVideoPrompt || [
                    V._vagSession && V._vagSession.characterImageUrl ? 'Character consistency: keep the same protagonist identity from the character reference image across this clip and all other clips.' : '',
                  V._vagSession && V._vagSession.campaignModel ? 'Same protagonist: ' + V._vagSession.campaignModel.prompt : '',
                  vidScene.cutPlan || '',
                  vidScene.narration || '',
                  vidScene.body || '',
                ].filter(Boolean).join('\n'),
              ].filter(Boolean).join('\n\n');
              var vidResp = await V._vagFetch('/api/hyperframes/generate-image-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topic: topic || '',
                  objective: payload.goal || '',
                  tone: payload.tone || '',
                  aspect: aspect || '9:16',
                  model: sceneI2VModel,
                  image_url: vidImage.url || '',
                  scene_name: vidScene.title || ('scene-' + (vi + 1)),
                  prompt: vidPrompt,
                  character_reference: (V._vagSession && V._vagSession.characterImageUrl) || '',
                  character_prompt: (V._vagSession && V._vagSession.campaignModel && V._vagSession.campaignModel.prompt) || '',
                  character_label: (V._vagSession && V._vagSession.campaignModel && V._vagSession.campaignModel.label) || '',
                  lip_sync_enabled: vidLipSyncEnabled,
                  lip_sync_text: vidLipSyncEnabled ? (vidScene.narration || '') : '',
                  reference_images: characterRefs.slice(0, 4),
                  duration: Math.max(3, Math.min(8, Number(vidScene.duration || sceneDur || 5))),
                }),
              });
              var vidData = await vidResp.json().catch(function () { return {}; });
              if (!vidResp.ok || !vidData.ok || !vidData.url) {
                throw new Error(vidData.detail || vidData.error || '영상 응답 없음');
              }
              imageVideoResults.push({ index: vi + 1, url: vidData.url, posterUrl: vidImage.url || '', detail: vidData.detail || '' });
              if (generatedSceneImages[vi]) {
                generatedSceneImages[vi].videoUrl = vidData.url;
                generatedSceneImages[vi].posterUrl = vidImage.url || generatedSceneImages[vi].url || '';
                generatedSceneImages[vi].mediaType = 'video';
              }
              V._addMsg('ai', '✅ 장면 ' + (vi + 1) + ' 이미지를 영상으로 바꿨습니다.');
            } catch (vidErr) {
              V._vagSetStage('code', outputMode === 'image-video-hyperframes' ? 'working' : 'error', outputMode === 'image-video-hyperframes' ? '선택 이미지로 계속' : '이미지로 영상 만들기 실패', vidErr && vidErr.message ? vidErr.message : '영상 생성 실패');
              V._addMsg('ai',
                '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                  '<b>이미지로 영상 만들기 실패</b><br>' +
                  '<span style="color:rgba(0,0,0,0.55);">' + V._esc(vidErr && vidErr.message ? vidErr.message : '') + '</span>' +
                  (outputMode === 'image-video-hyperframes' ? '<br><b style="color:#ff6b00;">선택한 이미지를 배경으로 계속 진행합니다.</b>' : '') +
                '</div>',
                { html: true }
              );
              if (outputMode !== 'image-video-hyperframes') {
                V._resetBtn();
                return;
              }
              break;
            }
          }
          if (V._vagSession) V._vagSession.imageVideoResults = imageVideoResults.slice();
          var finalImageVideoUrl = '';
          if (imageVideoResults.length > 0) {
            V._vagSetStage('render', 'working', '이미지 영상 합치는 중', imageVideoResults.length + '개 클립을 최종 MP4로 합칩니다.');
            try {
              var concatResp = await V._vagFetch('/api/hyperframes/concat-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: (topic || 'image-video-ad'),
                  urls: imageVideoResults.map(function (item) { return item.url; }).filter(Boolean),
                }),
              });
              var concatData = await concatResp.json().catch(function () { return {}; });
              if (!concatResp.ok || !concatData.ok || !concatData.url) {
                throw new Error(concatData.detail || concatData.error || '합본 응답 없음');
              }
              finalImageVideoUrl = concatData.url;
              if (V._vagSession) V._vagSession.finalImageVideoUrl = finalImageVideoUrl;
              V._vagSetStage('render', 'done', '이미지 최종 영상 완료', '장면 클립을 하나의 MP4로 합쳤습니다.');
            } catch (concatErr) {
              V._vagSetStage('render', outputMode === 'image-video-hyperframes' ? 'idle' : 'error', outputMode === 'image-video-hyperframes' ? '선택 이미지로 계속' : '이미지 영상 합치기 실패', concatErr && concatErr.message ? concatErr.message : '합본 실패');
              V._addMsg('ai',
                '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                  '<b>이미지 영상 합치기 실패</b><br>' +
                  '<span style="color:rgba(0,0,0,0.55);">' + V._esc(concatErr && concatErr.message ? concatErr.message : '') + '</span>' +
                  (outputMode === 'image-video-hyperframes' ? '<br><b style="color:#ff6b00;">선택한 이미지 위에 문구와 움직임은 계속 얹습니다.</b>' : '') +
                '</div>',
                { html: true }
              );
              if (outputMode !== 'image-video-hyperframes') {
                V._resetBtn();
                return;
              }
            }
          } else if (outputMode === 'image-video') {
            V._resetBtn();
            return;
          }
          if (imageVideoResults.length > 0) {
            V._addMsg('ai',
              '<div style="border-left:3px solid #34c759;padding:10px 12px;background:rgba(52,199,89,0.08);border-radius:10px;">' +
                '<div style="font-weight:900;margin-bottom:6px;">이미지 기반 최종 영상 완료</div>' +
                (finalImageVideoUrl ? '<div style="margin:6px 0 8px;"><a href="' + V._esc(finalImageVideoUrl) + '" target="_blank" style="color:#ff8c00;font-weight:950;">최종 MP4 열기</a></div>' : '') +
                imageVideoResults.map(function (item) {
                  return '<div style="margin-top:5px;"><a href="' + V._esc(item.url) + '" target="_blank" style="color:#007aff;font-weight:850;">씬 ' + item.index + ' 원본 클립</a></div>';
                }).join('') +
              '</div>',
              { html: true }
            );
          }
          if (outputMode === 'image-video') {
            V._resetBtn();
            return;
          }
          payload.extras = [
            payload.extras,
            '[베이스 클립 + HyperFrames 합성 지시]',
            imageVideoResults.length > 0 ? '- 아래 베이스 클립들은 선택 이미지에서 생성된 배경 미디어다. HyperFrames HTML은 이 클립들과 같은 씬 순서, 타이밍, 문구, 나레이션을 유지하고 그 위에 타이포그래피/라인/포커스/브랜드 락업/자막 모션을 얹는 합성 레이어로 설계한다.' : '- 베이스 클립 생성이 실패했으므로 선택된 씬 이미지를 HyperFrames 배경으로 사용한다. 그래도 HyperFrames HTML/GSAP 모션, 자막, CTA, 라인, 포커스 그래픽 합성은 계속 만든다.',
            imageVideoResults.length > 0 ? '- HyperFrames HTML에는 생성된 베이스 클립 URL을 실제 `<video muted playsinline>` 미디어로 넣고, 해당 씬의 풀블리드 배경으로 사용한다. 정지 이미지는 poster/fallback으로만 둔다.' : '',
            '- 새 배경이나 새 인물을 만들지 말고, 베이스 클립의 주인공/상품/공간과 같은 정체성을 유지한다.',
            finalImageVideoUrl ? '합본 MP4: ' + finalImageVideoUrl : '',
            imageVideoResults.length ? imageVideoResults.map(function (item) { return '씬 ' + item.index + ' 베이스 클립: ' + item.url; }).join('\n') : '베이스 클립 없음: 확정 이미지 URL을 배경으로 사용',
          ].filter(Boolean).join('\n\n');
          V._addMsg('ai', imageVideoResults.length > 0 ? '🌀 이미지 영상 클립을 만들었습니다. 이어서 문구와 음성을 얹습니다.' : '🌀 이미지 영상 클립은 실패했지만 멈추지 않고, 선택한 이미지 위에 문구와 음성을 얹습니다.', { html: true });
        }
        V._vagSetStage('code', 'working', '승인된 이미지로 영상 만들기 시작', '확인한 장면별 배경 이미지 위에 문구와 움직임을 얹습니다.');
        var imageBlock = [
          '[확정된 씬별 배경 미디어]',
          '- 각 씬은 아래 미디어 URL을 배경으로 사용한다. 새 이미지/새 영상을 임의로 요구하거나 텍스트 투 비디오로 우회하지 마라.',
          '- 베이스 클립 URL이 있는 씬은 HyperFrames HTML 안에 실제 video 태그/미디어 레이어로 넣는다. 그 위에 문구, 자막, CTA, 라인, 포커스 그래픽을 HTML/GSAP로 합성한다.',
          '- 베이스 클립이 없는 씬만 정지 이미지 URL을 배경으로 사용한다.',
        ].concat(generatedSceneImages.map(function (item) {
          var imageRef = /^data:image\//i.test(String(item.url || '')) ? '[첨부 이미지 배경 data-url]' : item.url;
          var sourceLabel = item.source ? ' / 소스=' + item.source : '';
          var clip = (Array.isArray(imageVideoResults) ? imageVideoResults.find(function (videoItem) { return Number(videoItem.index) === Number(item.index); }) : null) || null;
          var clipPart = clip && clip.url ? ' / 베이스 클립=' + clip.url + ' / 이 클립을 video 배경으로 우선 사용' : ' / 정지 이미지 배경';
          return '씬 ' + item.index + ': 이미지=' + imageRef + clipPart + sourceLabel + (item.summary ? ' / 요약=' + item.summary : '');
        })).join('\n');
        payload.extras = [imageBlock, payload.extras].filter(Boolean).join('\n\n');
      }
    }
    if (outputMode !== 'image-only' && (!generatedSceneImages.length || generatedSceneImages.some(function (item) { return !item || !String(item.url || '').trim(); }))) {
      V._vagSetStage('code', 'error', '씬별 이미지 없음', '이미지 또는 영상 기준 미디어가 없어 렌더를 시작하지 않았습니다.');
      V._addMsg('ai',
        '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
          '<b>영상 만들기를 시작하지 않았습니다.</b><br>' +
          '장면별 배경 이미지가 먼저 만들어져야 합니다. 배경 이미지 없이 임시 영상으로 넘어가지 않습니다.<br>' +
          '<span style="color:rgba(0,0,0,0.55);">이미지 AI 설정과 첨부 이미지를 확인한 뒤 다시 실행해 주세요.</span>' +
        '</div>',
        { html: true }
      );
      V._resetBtn();
      return;
    }
    V._vagSetStage('code', 'working', '영상 화면 만드는 중', '확정된 나레이션과 장면 흐름을 영상 화면으로 만들고 있습니다.');
    V._vagSetStage('render', 'idle', '영상 렌더 대기', '코드 생성과 사전 검증이 끝나면 MP4 렌더가 이어집니다.');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }
    var _providerLabel = (document.getElementById('vag-provider') || {}).value || 'gemini';
    var _etaGuess = _providerLabel === 'gemini' ? '약 30~90초' : '약 60~240초 (CLI)';
    var genProg = V._vagLiveProgress('영상 화면 만드는 중', {
      eta: _etaGuess,
      detail: '확정된 나레이션과 장면 흐름을 기준으로 영상 화면을 만들고 있습니다.',
    });
    if (provider !== 'gemini') {
      genProg.update(`${provider} CLI 로 영상 컴포지션 생성 중`, {
        detail: `로컬 ${provider} CLI를 호출해 HTML 컴포지션을 작성하고 있습니다 — 최대 4분 소요 가능.`,
      });
    }
    V._vagPersistState('generate', 'running', {
      provider: provider,
      duration: duration,
      scene_count: sceneCount,
      anti_repeat_memory: (V._vagSession && V._vagSession.previousOutputSummary) || (V._vagThreadContext && V._vagThreadContext.previous_output_summary) || {},
      design_family: (V._vagSession && V._vagSession.designFamily) || '',
      brand_color: (V._vagSession && V._vagSession.brandColor) || '',
      logo_reference_for_background: !!V._vagLogoDataUrl,
      planned_hf_templates: (V._vagSession && V._vagSession.designSystem && Array.isArray(V._vagSession.designSystem.hfTemplates)) ? V._vagSession.designSystem.hfTemplates.slice(0, 6) : [],
      image_strategy: (V._vagSession && V._vagSession.designSystem && V._vagSession.designSystem.imageStrategy) || '',
    }, 'generate_started', {
      provider: provider,
      duration: duration,
      scene_count: sceneCount,
      design_family: (V._vagSession && V._vagSession.designFamily) || '',
    });

    try {
      var generatedHtml = '';
      if (V._vagSession && V._vagSession.hyperHtml && V._vagSession.followupInstruction) {
        genProg.update('기존 영상 수정 중', {
          detail: provider && provider.startsWith('atlas:')
            ? 'LangGraph API 에이전트가 이전 모션 HTML을 검증하며 수정하고 있습니다.'
            : '이전 HTML을 편집 지시에 맞춰 AI가 수정하고 있습니다.',
        });
        var editEndpoint = provider && provider.startsWith('atlas:') ? '/api/claude-design/edit' : '/api/hyperframes/ai-edit';
        var editBody = provider && provider.startsWith('atlas:')
          ? {
              html: V._vagSession.hyperHtml,
              instruction: [
                '[HyperFrames 모션영상 수정]',
                V._vagBuildEditInstruction(V._vagSession),
                '',
                '[영상 유지 규칙]',
                '- GSAP/HyperFrames 타임라인, data-start, data-duration, data-track-index 속성을 유지하거나 더 명확하게 정리하세요.',
                '- 영상 길이와 화면 비율을 유지하세요.',
                '- 설명 없이 완전한 HTML만 반환하세요.',
              ].join('\n'),
              provider: 'atlas',
              model: provider.slice(6),
              reference_images: _vagHtmlReferenceImages(),
              reference_sources: V._vagAttachedSources.slice(),
            }
          : {
              html: V._vagSession.hyperHtml,
              instruction: V._vagBuildEditInstruction(V._vagSession),
              duration: V._vagSession.hyperDuration || duration,
              profile_id: profileId || null,
            };
        var editResp = await V._vagFetch(editEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editBody),
        });
        var editData = await editResp.json();
        var editedHtml = editData.html || '';
        var editOk = provider && provider.startsWith('atlas:') ? (editData.status === 'ok' && editedHtml) : (editData.ok && editedHtml);
        if (!editResp.ok || !editOk) {
          genProg.fail('영상 수정 실패', editData.detail || editData.message || editData.error || '결과 없음');
          V._vagSetStage('code', 'error', '영상 수정 실패', '기존 코드 편집 중 오류가 발생했습니다.');
          V._resetBtn();
          return;
        }
        generatedHtml = editedHtml;
        duration = V._vagSession.hyperDuration || duration;
      } else if (V._vagSession && V._vagSession.templateId) {
        // 템플릿 모드: 공식 샘플의 구조를 유지하고 텍스트만 교체
        genProg.update('스타일 템플릿 적용 중', {
          detail: '선택한 공식 템플릿에 브랜드·주제·CTA를 주입하고 있습니다.',
        });
        var tplResp = await V._vagFetch('/api/hyperframes/apply-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: V._vagSession.templateId,
            topic: topic || '',
            brand: (window._globalProfileData || {}).name || '',
            objective: (V._vagSession && V._vagSession.objective) || '',
            tone: (V._vagSession && V._vagSession.tone) || '',
            cta: (V._vagSession && V._vagSession.cta) || '',
            key_points: payload.key_points || [],
            duration: duration,
            extras: directorExtras,
          }),
        });
        var tplData = await tplResp.json();
        if (!tplResp.ok || !tplData.ok || !tplData.item || !tplData.item.files) {
          V._addMsg('ai', '<span style="color:#ff3b30;">템플릿 적용 실패 — 자유 생성으로 전환합니다: ' + V._esc(tplData.detail || tplData.error || '') + '</span>');
          V._vagSession.templateId = '';
          genProg.update('자유 생성으로 전환 중', {
            detail: '템플릿 적용이 실패해 AI가 처음부터 HTML을 새로 쓰고 있습니다.',
          });
          var hfResp0 = await V._vagFetch('/api/hyperframes/ai-generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
          var hfData0 = await hfResp0.json();
          if (!hfResp0.ok || !hfData0.ok || !hfData0.item || !hfData0.item.html) {
            var tplFallbackDetail = [
              !hfResp0.ok ? ('HTTP ' + hfResp0.status + ' ' + (hfResp0.statusText || '')) : '',
              hfData0 && (hfData0.detail || hfData0.error || hfData0.message) || '',
            ].filter(Boolean).join('\n') || '결과 없음';
            genProg.fail('영상 화면 만들기 실패', tplFallbackDetail);
            V._addMsg('ai',
              '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                '<div style="font-weight:800;color:#b42318;margin-bottom:4px;">❌ 영상 화면 만들기 실패</div>' +
                '<div>임시 화면으로 우회하지 않았습니다. 장면별 배경 이미지와 실제 영상 화면이 모두 만들어져야 다음 단계로 갑니다.</div>' +
                '<div style="margin-top:6px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;color:rgba(0,0,0,0.8);background:rgba(0,0,0,0.03);padding:6px 8px;border-radius:4px;white-space:pre-wrap;max-height:160px;overflow:auto;">' + V._esc(tplFallbackDetail.slice(0, 1200)) + '</div>' +
              '</div>',
              { html: true }
            );
            V._vagSetStage('code', 'error', '영상 화면 만들기 실패', '임시 화면 우회를 막고 중단했습니다.');
            V._resetBtn();
            return;
          } else {
            generatedHtml = hfData0.item.html;
            duration = hfData0.item.duration || duration;
          }
        } else {
          generatedHtml = tplData.item.files['index.html'] || '';
          V._vagSession.templateFiles = tplData.item.files;
          genProg.update('템플릿 적용 완료', {
            detail: '적용된 템플릿: ' + (tplData.item.name || ''),
          });
        }
      } else {
        // 세션에 variations 모드가 켜져 있으면 3개 변형을 그리드로 보여주고 사용자가 고르게 함
        var wantVariations = !!(V._vagSession && V._vagSession.wantVariations);
        if (wantVariations) {
          genProg.update('3가지 디자인 변형 동시 생성 중', {
            eta: '약 60~90초',
            detail: 'AI가 3가지 서로 다른 방향으로 동시에 HTML을 작성하고 있습니다. 완성되면 선택 화면이 뜹니다.',
          });
          var variationDesigns = V._vagBuildVariationDirections(topic, V._vagSession, aspect);
          var variationDirections = variationDesigns.map(function (item) { return item.direction; });
          var varResp = await V._vagFetch('/api/hyperframes/ai-generate-variations', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, payload, { variations: 3, style_directions: variationDirections })),
          });
          var varData = await varResp.json();
          if (!varResp.ok || !varData.ok || !varData.items || !varData.items.length) {
            genProg.update('변형 생성 실패 — 단일 생성으로 전환', {
              detail: '3가지 변형 생성이 실패했습니다. 단일 HTML 생성으로 계속 진행합니다.',
            });
            V._addMsg('ai', '<span style="color:#ff3b30;">변형 생성 실패 — 단일 생성으로 전환합니다.</span>');
          } else {
            genProg.stop('✨ ' + varData.items.length + '가지 디자인 생성 완료 — 선택 대기',
                         '카드에서 마음에 드는 버전을 골라주세요.');
            V._addMsg('ai', '✨ ' + varData.items.length + '가지 디자인을 만들었어요. 마음에 드는 버전을 골라주세요:');
            var picked = await V._vagPickVariation(varData.items);
            if (picked) {
              var pickedMeta = variationDesigns[(picked.index || 0)] || null;
              if (pickedMeta && V._vagSession) {
                V._vagSession.designFamily = pickedMeta.name || V._vagSession.designFamily || '';
                V._vagSession.designSystem = Object.assign({}, V._vagSession.designSystem || {}, {
                  key: pickedMeta.key || '',
                  name: pickedMeta.name || '',
                  hfTemplates: pickedMeta.hfTemplates || [],
                  imageStrategy: pickedMeta.imageStrategy || '',
                });
              }
              generatedHtml = picked.html;
              duration = picked.duration || duration;
              V._addMsg('ai', '선택한 디자인: <b>' + V._esc(picked.name) + '</b> — ' + V._esc(picked.direction));
            }
          }
        }
        if (!generatedHtml) {
          // 프런트엔드 자동 재시도 — 선택한 엔진을 유지한다.
          var hfResp = null, hfData = null;
          var isHtmlToMotion = !!(V._vagSession && V._vagSession.htmlToMotion);
          var attempts = [payload];
          var _prevFailDetail = '';
          for (var ai = 0; ai < attempts.length; ai++) {
            var p = attempts[ai];
            if (p.__fallback) {
              // 첫 엔진 실패 원인을 채팅·위젯·콘솔에 전부 남김 — 재현 디버깅 용이
              console.warn('[VAG] ' + payload.provider + ' CLI failed, falling back to Gemini. detail=', _prevFailDetail);
              var _failShown = (_prevFailDetail || '(상세 메시지 없음)').slice(0, 700);
              if (!isHtmlToMotion) {
                V._addMsg('ai',
                  '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                    '<div style="font-weight:800;color:#c06a00;margin-bottom:4px;">🔁 ' + V._esc(payload.provider) + ' CLI 실패 — Gemini API 로 전환</div>' +
                    '<div style="color:rgba(0,0,0,0.7);margin-bottom:4px;">실패 상세(서버 응답):</div>' +
                    '<div style="font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;color:rgba(0,0,0,0.75);background:rgba(0,0,0,0.03);padding:6px 8px;border-radius:4px;white-space:pre-wrap;max-height:140px;overflow:auto;">' + V._esc(_failShown) + '</div>' +
                    '<div style="color:rgba(0,0,0,0.55);margin-top:6px;font-size:11px;">서버 콘솔에도 `[cli/' + V._esc(payload.provider) + '] rc=... stderr_tail=... stdout_tail=...` 로 더 긴 로그가 남습니다.</div>' +
                  '</div>',
                  { html: true }
                );
              }
              genProg.update('엔진 자동 전환 재시도 중', {
                attempt: '(' + payload.provider + ' 실패 → Gemini)',
                detail: payload.provider + ' 엔진 실패 원인: ' + _failShown.slice(0, 180) + (_failShown.length > 180 ? '…' : ''),
              });
            } else {
              genProg.update('AI HTML 생성 중', {
                attempt: '(' + p.provider + ' · 백엔드 3회 자동 재시도 포함)',
                detail: 'AI가 씬 타임라인·GSAP·레이아웃을 작성하고 있습니다. 완료 후 자동으로 무결성·자기검증이 이어집니다.',
              });
            }
            var httpTries = 3;
            for (var httpTry = 0; httpTry < httpTries; httpTry++) {
              hfResp = await V._vagFetch('/api/hyperframes/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p),
              });
              try { hfData = await hfResp.json(); }
              catch (parseErr) { hfData = { ok: false, detail: 'JSON 파싱 실패: ' + (parseErr.message || parseErr) }; }
              if (hfResp.ok && hfData.ok && hfData.item && hfData.item.html) break;
              // 실패 상세 수집 — status + detail + error + message 중 가장 정보가 많은 조합
              var parts = [];
              if (!hfResp.ok) parts.push('HTTP ' + hfResp.status + ' ' + (hfResp.statusText || ''));
              if (hfData) {
                if (hfData.detail) parts.push(String(hfData.detail));
                if (hfData.error) parts.push(String(hfData.error));
                if (hfData.message && hfData.message !== hfData.detail) parts.push(String(hfData.message));
              }
              _prevFailDetail = parts.join('\n').trim() || ('알 수 없는 실패 (HTTP ' + hfResp.status + ')');
              if (httpTry < httpTries - 1 && V._vagIsTransientAIGenerateFailure(hfResp.status, _prevFailDetail)) {
                genProg.update('AI 서버 일시 오류 — 재시도 중', {
                  attempt: '(' + (httpTry + 2) + '/' + httpTries + ')',
                  detail: '502/503/타임아웃 같은 일시 장애로 판단해 같은 확정 시나리오로 다시 보냅니다.',
                });
                await _vagSleep(2600 + (httpTry * 1800));
                continue;
              }
              break;
            }
            if (hfResp && hfResp.ok && hfData && hfData.ok && hfData.item && hfData.item.html) break;
            console.warn('[VAG] ai-generate attempt ' + (ai + 1) + '/' + attempts.length + ' failed:', {
              provider: p.provider,
              status: hfResp.status,
              detail: _prevFailDetail,
            });
          }
          if (!hfResp.ok || !hfData.ok || !hfData.item || !hfData.item.html) {
            var _finalDetail = _prevFailDetail || (hfData && hfData.detail) || '백엔드 3회 + 엔진 전환 모두 실패';
            var _canLocalMotionFallback = typeof V._vagBuildMotionFromDesignHtml === 'function' && isHtmlToMotion;
            if (_canLocalMotionFallback) {
              generatedHtml = V._vagBuildMotionFromDesignHtml((V._vagSession && V._vagSession.sourceHtml) || '', {
                topic: topic,
                aspect: aspect,
                duration: duration,
                source: source || '',
                sourceDetail: _finalDetail,
                rendered_slides: (V._vagSession && V._vagSession.sourceRenderedSlides) || [],
                slide_texts: (V._vagSession && V._vagSession.sourceSlideTexts) || [],
              });
              duration = Math.max(8, Math.round(duration || 12));
              genProg.update('로컬 모션 변환으로 전환', {
                detail: isHtmlToMotion
                  ? 'CLI가 HTML을 반환하지 않아 기존 디자인/캡처를 그대로 HyperFrames 모션으로 변환합니다.'
                  : 'HyperFrames HTML 생성 API가 응답하지 않아 로컬 변환을 시도합니다.',
              });
              V._addMsg('ai',
                '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                  '<div style="font-weight:800;color:#c06a00;margin-bottom:4px;">⚡ 로컬 모션 변환으로 진행</div>' +
                  '<div>Codex/CLI 응답에 HTML이 없어도 기존 디자인/캡처를 기준으로 모션 컴포지션을 구성합니다.</div>' +
                '</div>',
                { html: true }
              );
            } else {
            genProg.fail('영상 생성 실패', _finalDetail.slice(0, 400));
            V._addMsg('ai',
              '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                '<div style="font-weight:800;color:#b42318;margin-bottom:4px;">❌ 모든 엔진 실패</div>' +
                '<div style="font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;color:rgba(0,0,0,0.8);background:rgba(0,0,0,0.03);padding:6px 8px;border-radius:4px;white-space:pre-wrap;max-height:200px;overflow:auto;">' + V._esc(_finalDetail.slice(0, 1500)) + '</div>' +
              '</div>',
              { html: true }
            );
            V._vagSetStage('code', 'error', '영상 생성 실패', _finalDetail.slice(0, 140));
            V._resetBtn();
            return;
            }
          }
          if (!generatedHtml) {
            generatedHtml = hfData.item.html;
            duration = hfData.item.duration || duration;
          }
        }
      }
      // 컴포지션 HTML 단계 성공 — 위젯을 완료 표시로 고정
      genProg.stop('영상 컴포지션 HTML 생성 완료', '이어서 배경·오디오·사전 검증·MP4 렌더가 진행됩니다.');
      // 원본 AI HTML 백업 (이후 주입 과정에서 <style>/<script> 유실 시 복구용)
      V._vagOriginalHtml = generatedHtml;
      if (typeof V._vagRepairMotionCopy === 'function') {
        generatedHtml = V._vagRepairMotionCopy(generatedHtml, topic, source, {
          cta: (V._vagSession && V._vagSession.cta) || payload.cta || '',
          duration: duration,
        });
      }
      if (typeof V._vagExtractSceneNarrationPlan === 'function') {
        var generatedPlanCheck = V._vagExtractSceneNarrationPlan(generatedHtml, topic, {
          duration: duration || 0,
          source: source || '',
          cta: (V._vagSession && V._vagSession.cta) || payload.cta || '',
        });
        var generatedSceneCount = generatedPlanCheck.length || 0;
        console.info('[VAG] scene count check requested=' + sceneCount + ' actual=' + generatedSceneCount + ' duration=' + duration);
        if (generatedSceneCount && generatedSceneCount !== sceneCount) {
          var invalidDetail = '요청 ' + sceneCount + '씬 / 생성 ' + generatedSceneCount + '씬';
          V._addMsg('ai',
            '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
              '<b>AI 장면 수 실패 — 로컬 안전 모션으로 전환</b><br>' + invalidDetail + '입니다. 이 HTML은 사용하지 않고, 같은 자료로 ' + sceneCount + '씬 구조를 다시 만듭니다.' +
            '</div>',
            { html: true }
          );
          if (V._vagPersistState) {
            V._vagPersistState('generate', 'scene_count_mismatch', {
              requested_scene_count: sceneCount,
              actual_scene_count: generatedSceneCount,
              duration: duration,
              provider: provider,
            }, 'scene_count_check', {
              requested_scene_count: sceneCount,
              actual_scene_count: generatedSceneCount,
            });
          }
          if (typeof V._vagBuildMotionFromDesignHtml === 'function') {
            generatedHtml = V._vagBuildMotionFromDesignHtml('', {
              topic: topic,
              aspect: aspect,
              duration: duration,
              source: source || '',
              sceneCount: sceneCount,
              brandColor: (V._vagSession && V._vagSession.brandColor) || '',
              logoDataUrl: '',
            });
            generatedPlanCheck = V._vagExtractSceneNarrationPlan(generatedHtml, topic, {
              duration: duration || 0,
              source: source || '',
              cta: (V._vagSession && V._vagSession.cta) || payload.cta || '',
            });
            generatedSceneCount = generatedPlanCheck.length || 0;
            console.info('[VAG] local fallback scene count actual=' + generatedSceneCount + ' duration=' + duration);
          }
        }
      }
      if (typeof V._vagApplyBrandColorLock === 'function') {
        generatedHtml = V._vagApplyBrandColorLock(generatedHtml, (V._vagSession && V._vagSession.brandColor) || '');
      }
      if (typeof V._vagValidateBrandApplication === 'function') {
        var brandCheck = V._vagValidateBrandApplication(generatedHtml, {
          brandColor: (V._vagSession && V._vagSession.brandColor) || '',
          logoDataUrl: '',
        });
        console.info('[VAG] brand application check', brandCheck);
        if (!brandCheck.ok) {
          V._addMsg('ai',
            '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
              '<b>브랜드 반영 로그</b><br>색상: ' + (brandCheck.hasColor ? '확인' : '누락') + '. 로고는 강제 검증하지 않습니다.' +
            '</div>',
            { html: true }
          );
        }
      }
      if (typeof V._vagEnsureMotionFonts === 'function') {
        generatedHtml = V._vagEnsureMotionFonts(generatedHtml);
      }
      if (typeof V._vagValidateMotionHtml === 'function') {
        var motionCheck = V._vagValidateMotionHtml(generatedHtml);
        if (!motionCheck.ok) {
          V._addMsg('ai',
            '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.06);border-radius:6px;font-size:12px;line-height:1.55;">' +
              '<b>자동 모션 검수:</b> ' + V._esc(motionCheck.issues.join(' · ')) +
            '</div>',
            { html: true }
          );
        }
      }

      if (generatedSceneImages.length && typeof V._vagInjectSceneBackgrounds === 'function') {
        generatedHtml = V._vagInjectSceneBackgrounds(generatedHtml, generatedSceneImages);
        if (typeof V._vagBuildSceneImageTextMotionHtml === 'function' && V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan) && V._vagSession.sceneNarrationPlan.length) {
          var stableSceneHtml = V._vagBuildSceneImageTextMotionHtml(generatedSceneImages, {
            plan: V._vagSession.sceneNarrationPlan,
            duration: duration,
            aspect: aspect,
            brandColor: (V._vagSession && V._vagSession.brandColor) || '',
            cta: (V._vagSession && V._vagSession.cta) || payload.cta || '',
          });
          if (stableSceneHtml) {
            generatedHtml = stableSceneHtml;
            V._addMsg('ai', '확정한 이미지와 문구만 사용해 안정적인 영상 화면으로 구성했습니다.');
          }
        }
        if (V._vagSession) {
          V._vagSession.bgMode = 'scene-image';
          V._vagSession.bgImageUrl = generatedSceneImages[0] ? generatedSceneImages[0].url : '';
          V._vagSession.sceneBackgroundImages = generatedSceneImages.slice();
        }
        V._addMsg('ai', '✅ 씬별 AI 이미지를 각 장면 배경으로 반영했습니다.');
      }

      var bgMode = (V._vagSession && V._vagSession.bgMode) || 'gradient';
      if (bgMode === 'ai') {
        V._addMsg('ai', 'AI 배경 이미지를 생성 중... <span style="font-size:11px;color:rgba(0,0,0,0.4);">Gemini 이미지 모델 호출</span>');
        try {
          var bgResp = await V._vagFetch('/api/hyperframes/generate-bg-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: topic || '',
              tone: (V._vagSession && V._vagSession.tone) || '',
              objective: (V._vagSession && V._vagSession.objective) || '',
              aspect: aspect || '9:16',
            }),
          });
          var bgData = await bgResp.json();
          if (bgResp.ok && bgData.ok && bgData.url) {
            generatedHtml = V._vagInjectBackground(generatedHtml, bgData.url);
            if (V._vagSession) V._vagSession.bgImageUrl = bgData.url;
            V._addMsg('ai', 'AI 배경 이미지를 영상에 반영했습니다.');
          } else {
            V._addMsg('ai', '<span style="color:#ff9500;">AI 배경 생성 실패 — 그라데이션으로 진행합니다: ' + V._esc(bgData.detail || bgData.error || '') + '</span>');
            if (V._vagSession) V._vagSession.bgMode = 'gradient';
          }
        } catch (bgErr) {
          V._addMsg('ai', '<span style="color:#ff9500;">AI 배경 생성 오류 — 그라데이션으로 진행합니다: ' + V._esc(bgErr.message || '') + '</span>');
          if (V._vagSession) V._vagSession.bgMode = 'gradient';
        }
      } else {
        // html 모드: 엔진이 만든 CSS 배경을 그대로 사용. 주입 없음.
      }

      // TTS 나레이션
      var narrationVoice = (document.getElementById('vag-voice') || {}).value || '';
      var currentHtmlToMotion = !!(V._vagSession && V._vagSession.htmlToMotion);
      var narrationMode = (V._vagSession && V._vagSession.narrationMode) || '';
      var sceneNarrationApproved = false;
      var preCodeNarrationScript = approvedScenarioBeforeCode && V._vagSession ? (V._vagSession.narrationScript || '') : '';
      async function approveSceneNarrationBeforeRender(currentScript) {
        if (sceneNarrationApproved) return { ok: true, narrationScript: currentScript || '' };
        if (approvedScenarioBeforeCode) {
          if (typeof V._vagAnnotateTexts === 'function') {
            generatedHtml = V._vagAnnotateTexts(generatedHtml);
          }
          if (preCodeNarrationScript && typeof V._vagSplitNarrationIntoSceneLines === 'function' && typeof V._vagApplySceneNarrationToHtml === 'function') {
            var preCodeLines = V._vagSplitNarrationIntoSceneLines(preCodeNarrationScript, Math.max(1, ((V._vagSession && V._vagSession.sceneNarrationPlan) || []).length || 0));
            generatedHtml = V._vagApplySceneNarrationToHtml(generatedHtml, preCodeLines, { mirrorVisible: false });
          }
          V._vagHyperHtml = generatedHtml;
          if (V._vagSession) {
            V._vagSession.hyperHtml = generatedHtml;
            V._vagSession.hyperDuration = duration;
            V._vagSession.narrationScript = preCodeNarrationScript || currentScript || V._vagSession.narrationScript || '';
          }
          sceneNarrationApproved = true;
          return { ok: true, narrationScript: (V._vagSession && V._vagSession.narrationScript) || preCodeNarrationScript || currentScript || '' };
        }
        if (typeof V._vagAnnotateTexts === 'function') {
          generatedHtml = V._vagAnnotateTexts(generatedHtml);
        }
        if (V._vagSession) {
          V._vagSession.hyperHtml = generatedHtml;
          V._vagSession.hyperDuration = duration;
          var syncedNarration = typeof V._vagBuildSceneSyncedNarration === 'function'
            ? V._vagBuildSceneSyncedNarration(generatedHtml, topic, currentScript || '', {
                cta: (V._vagSession && V._vagSession.cta) || '',
                duration: duration || 0,
                source: source || '',
                forceSceneCopy: true,
              })
            : null;
          V._vagSession.narrationScript = syncedNarration ? syncedNarration.script : (currentScript || '');
          V._vagSession.sceneNarrationPlan = syncedNarration ? syncedNarration.plan : (
            typeof V._vagExtractSceneNarrationPlan === 'function'
              ? V._vagExtractSceneNarrationPlan(generatedHtml, topic, {
                  duration: duration || 0,
                  source: source || '',
                  cta: (V._vagSession && V._vagSession.cta) || '',
                })
              : []
          );
          currentScript = V._vagSession.narrationScript;
        }
        V._vagHyperHtml = generatedHtml;
        V._vagRenderTextEditCard();
        V._vagUpdateWorkspace();
        V._addMsg('ai', '🧩 씬 문구와 씬별 나레이션을 확인해 주세요. 수정 후 <b>이대로 영상 만들기</b>를 누르면 음성·BGM·MP4 렌더를 시작합니다.', { html: true });
        if (typeof V._vagAwaitSceneNarrationApproval !== 'function') {
          sceneNarrationApproved = true;
          return { ok: true, narrationScript: currentScript || '' };
        }
        var approved = await V._vagAwaitSceneNarrationApproval({
          html: generatedHtml,
          narrationScript: currentScript || '',
          topic: topic,
          objective: (V._vagSession && V._vagSession.objective) || '',
          tone: (V._vagSession && V._vagSession.tone) || '',
          cta: (V._vagSession && V._vagSession.cta) || '',
          aspect: aspect || '9:16',
          duration: duration || 8,
          keyPoints: (V._vagSession && Array.isArray(V._vagSession.keyPoints)) ? V._vagSession.keyPoints : [],
          source: String(source || '').slice(0, 1200),
        });
        if (!approved || !approved.ok) {
          return { ok: false, narrationScript: currentScript || '' };
        }
        generatedHtml = approved.html || generatedHtml;
        sceneNarrationApproved = true;
        return { ok: true, narrationScript: approved.narrationScript || currentScript || '' };
      }
      if (currentHtmlToMotion && narrationMode === 'caption') {
        var captionNarrationScript = preCodeNarrationScript || (typeof V._vagBuildSceneAlignedNarrationScript === 'function'
          ? V._vagBuildSceneAlignedNarrationScript(generatedHtml, topic, {
              cta: (V._vagSession && V._vagSession.cta) || '',
              duration: duration || 0,
              source: source || '',
            })
          : V._vagExtractNarrationScript(generatedHtml, topic));
        var captionApproval = await approveSceneNarrationBeforeRender(captionNarrationScript);
        if (!captionApproval.ok) {
          V._addMsg('ai', '영상 만들기를 중단했습니다. 장면과 나레이션을 조정한 뒤 다시 진행해 주세요.');
          V._resetBtn();
          return;
        }
        captionNarrationScript = captionApproval.narrationScript || captionNarrationScript;
        if (V._vagSession) V._vagSession.narrationScript = captionNarrationScript;
        V._addMsg('ai',
          '<div style="border-left:3px solid #ff8c00;padding:9px 12px;background:rgba(255,140,0,0.06);border-radius:8px;font-size:12px;line-height:1.6;color:rgba(0,0,0,0.74);">' +
            '<div style="font-weight:900;color:#c45f00;margin-bottom:5px;">📝 홍보 나레이션</div>' +
            '<div style="white-space:pre-wrap;">' + V._esc(captionNarrationScript || '필요한 결정을 더 쉽게. 지금 상담을 예약해보세요.') + '</div>' +
            '<div style="margin-top:6px;font-size:11px;color:rgba(0,0,0,0.48);">현재 환경에서는 AI 음성 없이 장면 문구만 유지합니다. 별도 자막은 추가하지 않습니다.</div>' +
          '</div>',
          { html: true }
        );
      } else if (!narrationVoice) {
        // 나레이션 OFF — 명시적으로 안내 (이전엔 조용히 건너뛰어 "TTS 왜 안 됐지?" 혼란 유발)
        var noVoiceApproval = await approveSceneNarrationBeforeRender('');
        if (!noVoiceApproval.ok) {
          V._addMsg('ai', '영상 만들기를 중단했습니다. 장면을 조정한 뒤 다시 진행해 주세요.');
          V._resetBtn();
          return;
        }
        V._addMsg('ai', '<span style="font-size:11px;color:rgba(0,0,0,0.55);">🔇 나레이션을 꺼서 AI 음성 만들기는 건너뜁니다.</span>');
      } else {
        try {
          // 1) 별도 나레이션 생성 금지 — 실제 씬 문구와 씬별 나레이션만 사용
          var sceneAlignedScript = preCodeNarrationScript || (typeof V._vagBuildSceneAlignedNarrationScript === 'function'
            ? V._vagBuildSceneAlignedNarrationScript(generatedHtml, topic, {
                cta: (V._vagSession && V._vagSession.cta) || '',
                duration: duration || 0,
                source: source || '',
                forceSceneCopy: true,
              })
            : V._vagExtractNarrationScript(generatedHtml, topic));
          if (!approvedScenarioBeforeCode && V._vagSession) V._vagSession.sceneNarrationPlan = typeof V._vagExtractSceneNarrationPlan === 'function'
            ? V._vagExtractSceneNarrationPlan(generatedHtml, topic, {
                duration: duration || 0,
                source: source || '',
                cta: (V._vagSession && V._vagSession.cta) || '',
              })
            : [];

          var narrationScript = sceneAlignedScript || V._vagExtractNarrationScript(generatedHtml, topic);
          V._addMsg('ai', '🎙 새 대본을 만들지 않고, <b>확인한 장면별 나레이션</b>만 AI 음성으로 읽습니다.', { html: true });
          if (typeof V._vagNormalizeNarrationForSpeech === 'function') {
            narrationScript = V._vagNormalizeNarrationForSpeech(narrationScript, {
              cta: (V._vagSession && V._vagSession.cta) || '',
            });
          }
          if (typeof V._vagEnsureNarrationMinimumDensity === 'function') {
            narrationScript = V._vagEnsureNarrationMinimumDensity(narrationScript, {
              duration: duration || 0,
              source: source || '',
              cta: (V._vagSession && V._vagSession.cta) || '',
              plan: (V._vagSession && V._vagSession.sceneNarrationPlan) || [],
            });
          }
          if (!approvedScenarioBeforeCode && typeof V._vagBuildSceneSyncedNarration === 'function') {
            var strictSyncedNarration = V._vagBuildSceneSyncedNarration(generatedHtml, topic, narrationScript, {
              cta: (V._vagSession && V._vagSession.cta) || '',
              duration: duration || 0,
              source: source || '',
              forceSceneCopy: true,
            });
            narrationScript = strictSyncedNarration.script || narrationScript;
            if (V._vagSession) V._vagSession.sceneNarrationPlan = strictSyncedNarration.plan || V._vagSession.sceneNarrationPlan || [];
          }
          var voiceApproval = await approveSceneNarrationBeforeRender(narrationScript);
          if (!voiceApproval.ok) {
            V._addMsg('ai', '영상 만들기를 중단했습니다. 장면과 나레이션을 조정한 뒤 다시 진행해 주세요.');
            V._resetBtn();
            return;
          }
          narrationScript = voiceApproval.narrationScript || narrationScript;
          narrationVoice = voiceApproval.voice || (document.getElementById('vag-voice') || {}).value || narrationVoice;
          if (typeof V._vagEnsureNarrationMinimumDensity === 'function') {
            narrationScript = V._vagEnsureNarrationMinimumDensity(narrationScript, {
              duration: duration || 0,
              source: source || '',
              cta: (V._vagSession && V._vagSession.cta) || '',
              plan: (V._vagSession && V._vagSession.sceneNarrationPlan) || [],
            });
          }
          V._addMsg('ai', '<div style="font-size:12px;line-height:1.6;color:rgba(0,0,0,0.72);white-space:pre-wrap;border-left:3px solid var(--accent);padding:8px 12px;background:rgba(255,140,0,0.06);border-radius:6px;">' + V._esc(narrationScript) + '</div>');

          if (narrationScript && narrationScript.length >= 6) {
            if (typeof V._vagValidateNarrationScript === 'function') {
              var scriptCheck = V._vagValidateNarrationScript(narrationScript, {
                topic: topic,
                cta: (V._vagSession && V._vagSession.cta) || '',
                duration: duration || 0,
              });
              if (scriptCheck.script) narrationScript = scriptCheck.script;
              if (!scriptCheck.ok) {
                V._vagSetStage('code', 'error', '나레이션 내용 검증 실패', scriptCheck.issues.join(' · '));
                genProg.fail('나레이션 내용 검증 실패', scriptCheck.issues.join(' · '));
                V._addMsg('ai',
                  '<div style="border-left:3px solid #ff3b30;padding:8px 12px;background:rgba(255,59,48,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                    '<b>나레이션 내용 사전 검증 실패</b><br>' + V._esc(scriptCheck.issues.join(' · ')) +
                    '<div style="margin-top:6px;white-space:pre-wrap;color:rgba(0,0,0,0.72);">' + V._esc(narrationScript) + '</div>' +
                  '</div>',
                  { html: true }
                );
                V._resetBtn();
                return;
              }
              if (scriptCheck.warnings && scriptCheck.warnings.length) {
                V._addMsg('ai', '<span style="color:#ff9500;">나레이션 사전 검증 보정: ' + V._esc(scriptCheck.warnings.join(' · ')) + '</span>');
              }
            }
            var _targetNarration = Math.max(duration || 0, 0);
            V._addMsg('ai', '🎧 나레이션 음성을 만드는 중입니다...');
            var ttsResp = null;
            var ttsData = {};
            var _durationMode = (V._vagSession && (V._vagSession.durationMode || V._vagSession.timelineMode)) || 'narration';
            var _useNarrationPriority = _durationMode !== 'fixed';
            var minNarrationRatio = _targetNarration >= 25 ? 0.88 : 0.62;
            var maxNarrationAttempts = _useNarrationPriority ? 1 : 3;
            for (var narrationAttempt = 0; narrationAttempt < maxNarrationAttempts; narrationAttempt++) {
              ttsResp = await V._vagFetch('/api/hyperframes/generate-narration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: narrationScript, voice: narrationVoice, duration: _targetNarration || duration || 0 }),
              });
              ttsData = await ttsResp.json();
              var ttsDurationNow = Number(ttsData && ttsData.duration || 0) || 0;
              if (!ttsResp.ok || !ttsData.ok || !ttsData.url || !_targetNarration || _useNarrationPriority || ttsDurationNow >= _targetNarration * minNarrationRatio) {
                break;
              }
              narrationScript = _vagExtendNarrationScriptForAudio(narrationScript, {
                duration: _targetNarration,
                cta: (V._vagSession && V._vagSession.cta) || '',
                plan: (V._vagSession && V._vagSession.sceneNarrationPlan) || [],
              });
              V._addMsg('ai', '<span style="color:#ff9500;">나레이션이 ' + ttsDurationNow.toFixed(1) + '초로 짧아 대본을 보강해 다시 생성합니다. (' + (narrationAttempt + 2) + '/3)</span>');
            }
            if (ttsResp.ok && ttsData.ok && ttsData.url) {
              var _effectiveNarrationDuration = Number(ttsData.duration || 0) || duration || 0;
              if (_useNarrationPriority && _targetNarration && _effectiveNarrationDuration > 0) {
                duration = Math.max(_targetNarration, Math.round(_effectiveNarrationDuration * 100) / 100);
                if (V._vagSession) {
                  V._vagSession.hyperDuration = duration;
                  V._vagSession.requestedDurationSec = duration;
                  V._vagSession.finalDurationSec = duration;
                  V._vagSession.timelineMode = 'narration';
                }
                if (_effectiveNarrationDuration > _targetNarration + 0.05) {
                  V._addMsg('ai',
                    '<div style="border-left:3px solid #34c759;padding:8px 12px;background:rgba(52,199,89,0.08);border-radius:6px;font-size:12px;line-height:1.55;">' +
                      '<b>나레이션 길이 보호</b><br>음성이 선택한 길이보다 길어 자르지 않고 ' + duration.toFixed(1) + '초로 늘립니다.' +
                    '</div>',
                    { html: true }
                  );
                }
              } else if (_targetNarration && _effectiveNarrationDuration > _targetNarration + 0.05) {
                duration = Math.max(duration || 0, Math.ceil(_effectiveNarrationDuration || 0));
                if (V._vagSession) {
                  V._vagSession.hyperDuration = duration;
                  V._vagSession.requestedDurationSec = duration;
                }
                V._addMsg('ai', '<span style="color:#ff9500;">원본 음성이 ' + _effectiveNarrationDuration.toFixed(1) + '초라서 자르지 않고, 영상 길이를 ' + duration + '초로 늘립니다.</span>');
              }
              var _scenePlanForNarration = (V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan)) ? V._vagSession.sceneNarrationPlan : [];
              var sceneNarrationLines = typeof V._vagSplitNarrationIntoSceneLines === 'function'
                ? V._vagSplitNarrationIntoSceneLines(narrationScript, Math.max(1, _scenePlanForNarration.length || 0))
                : String(narrationScript || '').split(/\n+/);
              var rebuiltImageSceneHtml = false;
              if (generatedSceneImages.length && typeof V._vagBuildSceneImageTextMotionHtml === 'function' && _scenePlanForNarration.length) {
                var syncedScenePlan = _scenePlanForNarration.map(function (scene, syncIdx) {
                  return Object.assign({}, scene, {
                    narration: sceneNarrationLines[syncIdx] || scene.narration || '',
                  });
                });
                var imageSyncedHtml = V._vagBuildSceneImageTextMotionHtml(generatedSceneImages, {
                  plan: syncedScenePlan,
                  duration: duration,
                  aspect: aspect,
                  brandColor: (V._vagSession && V._vagSession.brandColor) || '',
                  cta: (V._vagSession && V._vagSession.cta) || payload.cta || '',
                });
                if (imageSyncedHtml) {
                  generatedHtml = imageSyncedHtml;
                  rebuiltImageSceneHtml = true;
                  if (V._vagSession) V._vagSession.sceneNarrationPlan = syncedScenePlan;
                  V._addMsg('ai', '나레이션 길이에 맞춰 배경 이미지와 장면 시간을 다시 맞췄습니다.');
                }
              }
              if (!rebuiltImageSceneHtml && typeof V._vagApplySceneNarrationToHtml === 'function') {
                generatedHtml = V._vagApplySceneNarrationToHtml(generatedHtml, sceneNarrationLines, { mirrorVisible: false });
              }
              if (!rebuiltImageSceneHtml && typeof V._vagFitSceneDurationsToNarration === 'function') {
                generatedHtml = V._vagFitSceneDurationsToNarration(generatedHtml, narrationScript, _effectiveNarrationDuration || 0, duration || 0);
              }
              generatedHtml = V._vagInjectNarrationAudio(generatedHtml, ttsData.url, _effectiveNarrationDuration || 0);
              if (V._vagSession) {
                V._vagSession.narrationUrl = ttsData.url;
                V._vagSession.narrationDuration = _effectiveNarrationDuration || 0;
                V._vagSession.narrationScript = narrationScript;
              }
              if (!_useNarrationPriority && _targetNarration > 0 && ttsData.duration && ttsData.duration < _targetNarration - 1) {
                console.warn('[VAG] narration shorter than target:', { narration: ttsData.duration, target: _targetNarration, sceneCount: ((V._vagSession && V._vagSession.sceneNarrationPlan) || []).length });
                V._addMsg('ai',
                  '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                    '<b>나레이션 길이 로그</b><br>음성은 ' + ttsData.duration.toFixed(1) + '초이고 처음 선택한 길이는 ' + _targetNarration.toFixed(1) + '초였습니다. 무음 반복을 막기 위해 실제 렌더 길이를 조정했습니다.' +
                  '</div>',
                  { html: true }
                );
              }
              V._addMsg('ai', '✅ 나레이션 삽입 완료 (' + (_effectiveNarrationDuration || 0).toFixed(1) + '초, 음량 100%)');
            } else {
              var ttsDetail = [!ttsResp.ok ? ('HTTP ' + ttsResp.status) : '', ttsData.detail || ttsData.error || '응답 비어있음'].filter(Boolean).join(' ');
              var ttsMissing = !V._vagIsGoNativeMissingEndpoint || V._vagIsGoNativeMissingEndpoint(ttsDetail);
              if (!ttsMissing || !(V._vagSession && V._vagSession._ttsMissingNotified)) {
                V._addMsg('ai', '<span style="color:#ff9500;">' + (ttsMissing ? '🎙 현재 서버에서 AI 음성을 만들 수 없어 이번 결과는 음성 없이 준비합니다.' : '나레이션 음성 만들기 실패 — 오디오를 자르지 않기 위해 이번 영상은 음성 없이 진행합니다: ' + V._esc(ttsDetail)) + '</span>');
                if (ttsMissing && V._vagSession) V._vagSession._ttsMissingNotified = true;
              }
            }
          } else {
            V._addMsg('ai', '<span style="color:#ff9500;">⚠ 나레이션 대본이 너무 짧아 AI 음성 만들기를 건너뜁니다.</span>');
          }
        } catch (ttsErr) {
          var ttsErrMsg = ttsErr && (ttsErr.message || ttsErr.detail || ttsErr.error) || ttsErr || '';
          var ttsErrMissing = !V._vagIsGoNativeMissingEndpoint || V._vagIsGoNativeMissingEndpoint(ttsErrMsg);
          if (!ttsErrMissing || !(V._vagSession && V._vagSession._ttsMissingNotified)) {
            V._addMsg('ai', '<span style="color:#ff9500;">' + (ttsErrMissing ? '🎙 현재 서버에서 AI 음성을 만들 수 없어 이번 결과는 음성 없이 준비합니다.' : '나레이션 오류 — 영상은 음성 없이 진행합니다: ' + V._esc(ttsErrMsg)) + '</span>');
            if (ttsErrMissing && V._vagSession) V._vagSession._ttsMissingNotified = true;
          }
        }
      }

      // BGM 생성: 실패하면 현재 장면 상태를 저장하고 BGM만 재시도한다.
      if (V._vagSession && V._vagSession.bgmEnabled) {
        var maxBgmAttempts = 5;
        var saveBgmFailureCheckpoint = function saveBgmFailureCheckpoint(detail, attempt) {
          if (V._vagSession) {
            V._vagSession.bgmUrl = '';
            V._vagSession.bgmError = detail || '';
            V._vagSession.bgmAttempt = attempt || 0;
            V._vagSession.hyperHtml = generatedHtml || V._vagSession.hyperHtml || '';
            V._vagSession.hyperDuration = duration || V._vagSession.hyperDuration || 0;
          }
          if (typeof V._vagSaveCheckpoint === 'function') {
            var checkpoint = V._vagSaveCheckpoint('bgm_failed', {
              topic: topic || '',
              aspect: aspect || '',
              duration: duration || 0,
              html: generatedHtml || '',
              bgmError: detail || '',
              bgmAttempt: attempt || 0,
              narrationUrl: (V._vagSession && V._vagSession.narrationUrl) || '',
              narrationDuration: (V._vagSession && V._vagSession.narrationDuration) || 0,
              narrationScript: (V._vagSession && V._vagSession.narrationScript) || narrationScript || '',
              sceneNarrationPlan: (V._vagSession && V._vagSession.sceneNarrationPlan) || [],
              sceneImages: (V._vagSession && V._vagSession.generatedSceneImages) || [],
            });
            if (checkpoint && (!V._vagSession || !V._vagSession._bgmCheckpointNotified)) {
              V._addMsg('ai', '여기까지 만든 장면, 이미지, 문구, 나레이션을 저장했습니다. 다시 열어도 이 지점에서 이어갈 수 있습니다.');
              if (V._vagSession) V._vagSession._bgmCheckpointNotified = true;
            }
            return checkpoint;
          }
          return null;
        };
        var chooseBgmFailureAction = function chooseBgmFailureAction(detail) {
          return new Promise(function (resolve) {
            var currentAttempt = Number(bgmAttempt || 0) || 0;
            V._addMsg('ai', '<span style="color:#ff9500;">배경음악 생성 실패 — Gemini가 이번 음악을 반환하지 않았습니다.</span><br><span style="font-size:11px;color:rgba(0,0,0,0.48);">' + V._esc(String(detail || '').slice(0, 260)) + '</span><br><b>배경음악만 다시 시도합니다.</b> 더 안전하고 밝은 광고 배경음 요청으로 바꿔 다시 보냅니다. (' + currentAttempt + '/' + maxBgmAttempts + ')');
            if (window._vagAutoChoices && window._vagAutoChoices.fullAuto) {
              setTimeout(function () {
                if (currentAttempt < maxBgmAttempts) {
                  V._addMsg('user', '배경음악 다시 시도 <span style="font-size:10px;opacity:0.7;">⚡ 자동</span>');
                  resolve('BGM 다시 시도');
                } else {
                  V._addMsg('user', '배경음악 없이 영상 만들기 <span style="font-size:10px;opacity:0.7;">⚡ 자동</span>');
                  resolve('BGM 없이 계속');
                }
              }, 450);
              return;
            }
            var body = document.getElementById('vag-chat-body');
            if (!body) { resolve('렌더 중단'); return; }
            var wrap = document.createElement('div');
            wrap.className = 'vag-chat-options';
            wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
            ['BGM 다시 시도', 'BGM 없이 계속', '렌더 중단'].forEach(function (label) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.textContent = label;
              btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;';
              btn.onclick = function () {
                body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
                V._addMsg('user', label);
                resolve(label);
              };
              wrap.appendChild(btn);
            });
            body.appendChild(wrap);
          });
        };
        var bgmAttempt = 0;
        while (V._vagSession && V._vagSession.bgmEnabled) {
          bgmAttempt += 1;
          V._vagSession.bgmAttempt = bgmAttempt;
          try {
            var bgmDuration = Math.max(8, Math.ceil(duration || 30));
            var bgmVolumeRaw = parseInt((document.getElementById('vag-bgm-volume') || {}).value || '18', 10);
            var bgmVolume = (isFinite(bgmVolumeRaw) ? bgmVolumeRaw : 18) / 100;
            bgmVolume = Math.max(0.08, Math.min(0.45, bgmVolume || 0.18));
            V._addMsg('ai', '배경음악을 만드는 중입니다... <span style="font-size:11px;color:rgba(0,0,0,0.4);">' + bgmDuration + '초 · 볼륨 ' + Math.round(bgmVolume * 100) + '%' + (bgmAttempt > 1 ? ' · 안전 문장으로 다시 시도 ' + bgmAttempt + '회' : '') + '</span>');
            var bgmResp = await V._vagFetch('/api/hyperframes/generate-bgm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: topic || '',
                tone: (V._vagSession && V._vagSession.tone) || '',
                objective: (V._vagSession && V._vagSession.objective) || '',
                source: [V._vagSession && V._vagSession.multimodalHarmonyBlock, source || ''].filter(Boolean).join('\n\n'),
                duration: bgmDuration,
                attempt: bgmAttempt,
                scene_texts: ((V._vagSession && V._vagSession.sceneNarrationPlan) || []).map(function (scene) {
                  var p = _vagSceneProductionFields(scene);
                  return [
                    scene.title,
                    scene.body,
                    scene.narration,
                    scene.visualMode || scene.visual_mode,
                    scene.cutPlan || scene.cut_plan,
                    p.soundCue ? 'sound=' + p.soundCue : '',
                    p.editBeat ? 'edit=' + p.editBeat : '',
                    p.lipSyncHint ? 'lip=' + p.lipSyncHint : '',
                  ].filter(Boolean).join(' / ');
                }).filter(Boolean).slice(0, 8),
              }),
            });
            var bgmData = await bgmResp.json();
            if (bgmResp.ok && bgmData.ok && bgmData.url) {
              if (bgmData.provider && !/^gemini-lyria-3$/i.test(String(bgmData.provider))) {
                throw new Error('Gemini Lyria 3 Pro가 아닌 BGM provider 응답 차단: ' + bgmData.provider);
              }
              var bgmActualDuration = Number(bgmData.duration || 0) || bgmDuration;
              generatedHtml = V._vagInjectBgmAudio(generatedHtml, bgmData.url, bgmDuration, bgmVolume, bgmActualDuration);
              if (V._vagSession) {
                V._vagSession.bgmUrl = bgmData.url;
                V._vagSession.bgmDuration = bgmDuration;
                V._vagSession.bgmActualDuration = bgmActualDuration;
              }
              var bgmProvider = bgmData.provider ? (' · ' + V._esc(bgmData.provider)) : '';
              var bgmLoopNote = bgmActualDuration + 0.5 < bgmDuration ? ' · 실제 ' + bgmActualDuration.toFixed(1) + '초를 반복해 끝까지 채움' : '';
              V._addMsg('ai', 'BGM 완료 (' + bgmDuration.toFixed(1) + '초 구간 사용' + bgmLoopNote + ', 볼륨 ' + Math.round(bgmVolume * 100) + '%' + bgmProvider + ', 자동 페이드 인/아웃 적용). 영상에 삽입했습니다.');
              break;
            }
            var bgmFailDetail = bgmData.detail || bgmData.error || 'Gemini Lyria 3 Pro BGM 생성 실패';
            saveBgmFailureCheckpoint(bgmFailDetail, bgmAttempt);
            var bgmAction = await chooseBgmFailureAction(bgmFailDetail);
            if (bgmAction === 'BGM 다시 시도') continue;
            if (bgmAction === 'BGM 없이 계속') {
              if (V._vagSession) {
                V._vagSession.bgmUrl = '';
                V._vagSession.bgmError = bgmFailDetail;
              }
              V._addMsg('ai', '<span style="color:#ff9500;">배경음악은 실패했지만, 음성과 영상은 계속 만듭니다.</span>');
              break;
            }
            if (V._vagSession) {
              V._vagSession.bgmUrl = '';
              V._vagSession.bgmError = bgmFailDetail;
            }
            V._vagSetStage('code', 'error', 'Gemini BGM 생성 실패', 'BGM은 Gemini만 사용하므로 렌더를 중단했습니다.');
            try { genProg.fail('Gemini BGM 생성 실패', String(bgmFailDetail || '').slice(0, 220)); } catch (_) {}
            V._resetBtn();
            return;
          } catch (bgmErr) {
            var bgmErrDetail = bgmErr && (bgmErr.message || bgmErr.detail || bgmErr.error) || bgmErr || '';
            saveBgmFailureCheckpoint(bgmErrDetail, bgmAttempt);
            var bgmErrAction = await chooseBgmFailureAction(bgmErrDetail);
            if (bgmErrAction === 'BGM 다시 시도') continue;
            if (bgmErrAction === 'BGM 없이 계속') {
              if (V._vagSession) {
                V._vagSession.bgmUrl = '';
                V._vagSession.bgmError = bgmErrDetail;
              }
              V._addMsg('ai', '<span style="color:#ff9500;">배경음악은 실패했지만, 음성과 영상은 계속 만듭니다.</span>');
              break;
            }
            if (V._vagSession) {
              V._vagSession.bgmUrl = '';
              V._vagSession.bgmError = bgmErrDetail;
            }
            V._vagSetStage('code', 'error', 'Gemini BGM 생성 실패', 'BGM은 Gemini만 사용하므로 렌더를 중단했습니다.');
            try { genProg.fail('Gemini BGM 생성 실패', String(bgmErrDetail || '').slice(0, 220)); } catch (_) {}
            V._resetBtn();
            return;
          }
        }
      }

      if (typeof V._vagPreflightMotionHtml === 'function') {
        var preflight = V._vagPreflightMotionHtml(generatedHtml, {
          duration: duration,
          requireNarration: false
        });
        if (preflight && preflight.html) generatedHtml = preflight.html;
        var afterTiming = preflight && preflight.after || {};
        if (afterTiming.visualEnd && afterTiming.visualEnd > duration) duration = Math.ceil(afterTiming.visualEnd);
        if (afterTiming.audioEnd && afterTiming.audioEnd > duration) duration = Math.ceil(afterTiming.audioEnd);
        if (preflight && (!preflight.ok || preflight.fixed)) {
          V._addMsg('ai',
            '<div style="border-left:3px solid ' + (preflight.ok ? 'var(--accent)' : '#ff9500') + ';padding:8px 12px;background:rgba(255,140,0,0.06);border-radius:6px;font-size:12px;line-height:1.55;">' +
              '<b>렌더 전 장면 확인</b><br>' +
              '장면 ' + (afterTiming.sceneCount || 0) + '개 · 화면 ' + ((afterTiming.visualEnd || 0).toFixed ? (afterTiming.visualEnd || 0).toFixed(1) : '0.0') + '초 · 오디오 ' + ((afterTiming.audioEnd || 0).toFixed ? (afterTiming.audioEnd || 0).toFixed(1) : '0.0') + '초' +
              (preflight.fixed ? '<br>화면 타임라인과 progress 시간을 자동 보정했습니다.' : '') +
              (preflight.issues && preflight.issues.length ? '<br><span style="color:#c06a00;">' + V._esc(preflight.issues.join(' · ')) + '</span>' : '') +
            '</div>',
            { html: true }
          );
        }
        if (!preflight || !preflight.ok) {
          V._vagSetStage('code', 'error', '장면 검증 실패', (preflight && preflight.issues || []).join(' · ') || '검증 실패');
          genProg.fail('장면 검증 실패', (preflight && preflight.issues || []).join(' · ') || '렌더 전 장면 검증을 통과하지 못했습니다.');
          V._resetBtn();
          return;
        }
      }

      var annotatedHtml = V._vagAnnotateTexts(generatedHtml);
      V._vagHyperHtml = annotatedHtml;
      generatedHtml = annotatedHtml;
      V._vagRenderTextEditCard();
      V._vagUpdateWorkspace();

      V._vagSetStage('code', 'ready', '영상 화면 준비 완료', '장면·나레이션·오디오 사전 검증을 통과했습니다.');
      V._addMsg('ai', '장면·나레이션·오디오 사전 검증 완료. 이제 실제 MP4 렌더를 시작합니다.');

      V._vagSetStage('render', 'working', 'MP4 렌더 중', aspect + ' · ' + duration + '초 영상을 렌더링하고 있습니다.');

      var _ctaLine = ((V._vagSession && V._vagSession.cta) || '').trim();
      var finalPrompt = [
        '마케팅 영상 생성 지시',
        '주제: ' + (topic || ''),
        '목적: ' + (((V._vagSession && V._vagSession.objective) || '광고 전환')),
        '톤: ' + (((V._vagSession && V._vagSession.tone) || '직설')),
        'CTA: ' + (_ctaLine || '(생략)'),
        '비율: ' + aspect,
        '길이: ' + duration + '초',
        '',
        '참고 소재:',
        String(source || '').trim() || '-'
      ].join('\n');
      V._vagPushRenderOverlayLog('브랜드/주제 브리프를 정리했습니다.', 'info');
      V._vagPushRenderOverlayLog('배경, 나레이션, 배경음악까지 합친 최종 영상을 만듭니다.', 'info');
      var renderData = null;
      try {
        renderData = await V._vagRenderNativeAsync({
          html: generatedHtml,
          name: topic || 'hyperframes-marketing-video',
          fps: 30,
          quality: 'standard',
          format: 'mp4',
          duration: duration,
        }, {
          label: '🍊 최종 MP4 렌더 진행 중',
          sub: '코드 생성은 끝났고, 이제 실제 영상 파일을 만들고 있습니다.',
          log: 'HyperFrames 렌더 큐에 작업을 등록했습니다.',
        });
      } catch (renderErr) {
        if (typeof V._vagShowHtmlMotionPreview === 'function' && (!V._vagIsGoNativeMissingEndpoint || V._vagIsGoNativeMissingEndpoint(renderErr))) {
          try {
            V._vagShowHtmlMotionPreview(generatedHtml, {
              topic: topic,
              aspect: aspect,
              duration: duration,
              finalPrompt: finalPrompt,
            });
            V._vagSetStage('render', 'muted', '영상 미리보기 준비 완료', 'MP4 만들기 기능이 없어 미리보기 화면을 먼저 제공합니다.');
            V._addMsg('ai',
              '<div style="border-left:3px solid #ff9500;padding:8px 12px;background:rgba(255,149,0,0.07);border-radius:6px;font-size:12px;line-height:1.55;">' +
                '<div style="font-weight:800;color:#c06a00;margin-bottom:4px;">영상 미리보기 준비 완료</div>' +
                '<div>현재 서버에서는 MP4 파일을 바로 만들 수 없어, 오른쪽 미리보기로 먼저 확인할 수 있게 했습니다.</div>' +
              '</div>',
              { html: true }
            );
            V._vagPersistState('completed', 'html_ready', {
              previous_output_summary: (V._vagSession && V._vagSession.previousOutputSummary) || '',
              last_render: {
                topic: topic,
                video_path: '',
                project_dir: '',
                aspect: aspect,
                duration: duration,
                mode: 'html-motion-preview',
                render_error: renderErr.message || String(renderErr),
              },
            }, 'html_motion_ready', {
              topic: topic,
              aspect: aspect,
              duration: duration,
            });
            V._vagOfferFollowupActions();
          } finally {
            V._vagHideRenderOverlay();
            V._resetBtn();
          }
          return;
        }
        throw renderErr;
      }

      if (renderData && renderData.path) {
        var outputDir = V._vagParentDir(renderData.path);
        var previousOutputSummary = V._vagCollectOutputSummary(generatedHtml, V._vagSession);
        if (V._vagSession) V._vagSession.previousOutputSummary = previousOutputSummary;
        V._vagResult = { video_path: renderData.path, project_dir: outputDir, topic: topic, script: null, final_prompt: finalPrompt };
        V._vagRenderMeta = aspect + ' · ' + duration + '초';
        if (V._vagSession) {
          V._vagSession.hyperHtml = generatedHtml;
          V._vagSession.hyperDuration = duration;
        }
        V._vagPersistState('completed', 'completed', {
          previous_output_summary: previousOutputSummary,
          last_render: {
            topic: topic,
            video_path: renderData.path,
            project_dir: outputDir,
            aspect: aspect,
            duration: duration,
          },
        }, 'render_ready', {
          topic: topic,
          aspect: aspect,
          duration: duration,
          video_path: renderData.path,
        });

        var cb = document.getElementById('vag-chat-body');
        if (cb && cb.lastChild) cb.removeChild(cb.lastChild);
        V._addMsg('ai', '<b>영상 생성 완료!</b>');

        var resultEl = document.getElementById('vag-result');
        if (resultEl) resultEl.style.display = 'block';
        var htmlPreview = document.getElementById('vag-html-motion-preview');
        if (htmlPreview) htmlPreview.style.display = 'none';
        var player = document.getElementById('vag-video-player');
        if (player) {
          player.style.display = 'block';
          player.src = renderData.url;
        }
        var meta = document.getElementById('vag-result-meta');
        if (meta) meta.textContent = V._vagRenderMeta;
        V._vagSetStage('render', 'ready', '영상 렌더 완료', V._vagRenderMeta + ' 결과를 바로 확인할 수 있습니다.');
        V._vagUpdateWorkspace();

        // 히스토리 저장
        try {
          V._renderFinalPrompt(finalPrompt);
          await V._vagFetch('/api/vag/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic, video_path: renderData.path, project_dir: outputDir, scene_count: Math.max(3, Math.round(duration / 2)), aspect: aspect, voice: 'hyperframes', profile_name: profileName, profile_id: profileId, final_prompt: finalPrompt, thread_id: V._vagThreadId || '', session_context: V._vagThreadContext || {}, previous_output_summary: previousOutputSummary }) });
        } catch (e) { /* ignore */ }
        V._addMsg('ai', '원하면 지금 바로 다른 버전도 이어서 만들 수 있어요.');
        V._vagOfferFollowupActions();
      } else {
        var cb2 = document.getElementById('vag-chat-body');
        if (cb2 && cb2.lastChild) cb2.removeChild(cb2.lastChild);
        V._addMsg('ai', '<span style="color:#ff3b30;">영상 렌더 실패: ' + V._esc(renderData.detail || renderData.error || '') + '</span>');
        V._vagSetStage('render', 'error', '영상 렌더 실패', renderData.detail || renderData.error || '렌더 결과를 받지 못했습니다.');
      }
    } catch (e) {
      try { genProg.fail('작업 중 오류 발생', e.message || '알 수 없는 오류'); } catch (_) {}
      V._addMsg('ai', '<span style="color:#ff3b30;">오류: ' + V._esc(e.message) + '</span>');
      V._vagSetStage('render', 'error', '작업 실패', e.message || '알 수 없는 오류');
    } finally {
      V._vagHideRenderOverlay();
    }
    V._resetBtn();
  }

  V._vagRenderCheckpointVideo = async function _vagRenderCheckpointVideo(checkpoint, options) {
    var cp = checkpoint || (V._vagLoadCheckpoint && V._vagLoadCheckpoint()) || {};
    var opts = options || {};
    var html = String(cp.html || (V._vagSession && V._vagSession.hyperHtml) || V._vagHyperHtml || '');
    if (!html) {
      V._addMsg('ai', '<span style="color:#ff3b30;">이어갈 영상 화면을 찾지 못했습니다.</span>', { html: true });
      return;
    }
    var topic = cp.topic || (V._vagSession && V._vagSession.baseTopic) || '마케팅 영상';
    var duration = Math.max(1, Number(cp.duration || (V._vagSession && V._vagSession.hyperDuration) || 12) || 12);
    var aspect = cp.aspect || (V._vagSession && V._vagSession.aspect) || '9:16';
    try {
      V._vagSetStage('render', 'working', '저장 지점에서 영상 생성 중', opts.withBgm ? '배경음악만 다시 만들고 이어서 영상 파일을 만듭니다.' : '저장된 장면 그대로 영상 파일을 만듭니다.');
      if (V._vagShowRenderOverlay) V._vagShowRenderOverlay('저장 지점에서 영상 생성 중');
      if (opts.withBgm) {
        try {
          var attempt = Math.max(2, Number(cp.bgmAttempt || 0) + 1);
          V._addMsg('ai', '저장 지점에서 배경음악만 다시 시도합니다. <span style="font-size:11px;color:rgba(0,0,0,0.45);">안전한 광고 배경음 요청으로 보냅니다.</span>', { html: true });
          var bgmResp = await V._vagFetch('/api/hyperframes/generate-bgm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: topic,
              tone: (V._vagSession && V._vagSession.tone) || '',
              objective: (V._vagSession && V._vagSession.objective) || '',
              source: '',
              duration: Math.ceil(duration),
              attempt: attempt,
              scene_texts: (cp.sceneNarrationPlan || []).map(function (scene) {
                return [scene.title, scene.body, scene.narration].filter(Boolean).join(' / ');
              }).filter(Boolean).slice(0, 8),
            }),
          });
          var bgmData = await bgmResp.json();
          if (bgmResp.ok && bgmData.ok && bgmData.url) {
            var bgmVolumeRaw = parseInt((document.getElementById('vag-bgm-volume') || {}).value || '18', 10);
            var bgmVolume = Math.max(0.08, Math.min(0.45, (isFinite(bgmVolumeRaw) ? bgmVolumeRaw : 18) / 100));
            html = V._vagInjectBgmAudio(html, bgmData.url, Math.ceil(duration), bgmVolume, Number(bgmData.duration || 0) || Math.ceil(duration));
            V._addMsg('ai', '배경음악을 다시 만들고 영상에 넣었습니다.');
          } else {
            var bgmDetail = bgmData.detail || bgmData.error || '배경음악 생성 실패';
            if (V._vagSaveCheckpoint) V._vagSaveCheckpoint('bgm_failed', Object.assign({}, cp, { html: html, bgmError: bgmDetail, bgmAttempt: attempt }));
            V._addMsg('ai', '<span style="color:#ff9500;">배경음악은 다시 실패했습니다. 저장 지점은 유지하고, 이번에는 음악 없이 영상 파일을 만듭니다.</span>', { html: true });
          }
        } catch (bgmErr) {
          var retryDetail = bgmErr && (bgmErr.message || bgmErr.detail || bgmErr.error) || bgmErr || '';
          if (V._vagSaveCheckpoint) V._vagSaveCheckpoint('bgm_failed', Object.assign({}, cp, { html: html, bgmError: retryDetail, bgmAttempt: Math.max(2, Number(cp.bgmAttempt || 0) + 1) }));
          V._addMsg('ai', '<span style="color:#ff9500;">배경음악 재시도 중 오류가 났습니다. 저장 지점은 유지하고, 음악 없이 영상 파일을 만듭니다.</span>', { html: true });
        }
      }
      if (typeof V._vagPreflightMotionHtml === 'function') {
        var preflight = V._vagPreflightMotionHtml(html, { duration: duration, requireNarration: false });
        if (preflight && preflight.html) html = preflight.html;
      }
      var renderData = await V._vagRenderNativeAsync({
        html: html,
        name: topic || 'makeke-video',
        fps: 30,
        quality: 'standard',
        format: 'mp4',
        duration: duration,
      }, {
        label: '저장 지점에서 영상 생성 중',
        sub: '이미 만든 장면을 다시 쓰고 있습니다.',
        log: '저장된 화면 구성으로 영상 파일 생성을 시작했습니다.',
      });
      if (renderData && renderData.path) {
        var outputDir = V._vagParentDir(renderData.path);
        V._vagHyperHtml = html;
        if (V._vagSession) {
          V._vagSession.hyperHtml = html;
          V._vagSession.hyperDuration = duration;
        }
        V._vagResult = { video_path: renderData.path, project_dir: outputDir, topic: topic, script: null, final_prompt: '' };
        V._vagRenderMeta = aspect + ' · ' + duration + '초';
        try { localStorage.removeItem('makeke:vag:lastCheckpoint'); } catch (_) {}
        V._vagPersistState('completed', 'completed', {
          resume_point: '',
          last_render: {
            topic: topic,
            video_path: renderData.path,
            project_dir: outputDir,
            aspect: aspect,
            duration: duration,
            mode: 'checkpoint-resume',
          },
        }, 'checkpoint_render_ready', {
          topic: topic,
          video_path: renderData.path,
          aspect: aspect,
          duration: duration,
        });
        var resultEl = document.getElementById('vag-result');
        if (resultEl) resultEl.style.display = 'block';
        var htmlPreview = document.getElementById('vag-html-motion-preview');
        if (htmlPreview) htmlPreview.style.display = 'none';
        var player = document.getElementById('vag-video-player');
        if (player) {
          player.style.display = 'block';
          player.src = renderData.url;
        }
        var meta = document.getElementById('vag-result-meta');
        if (meta) meta.textContent = V._vagRenderMeta;
        V._vagSetStage('render', 'ready', '영상 생성 완료', V._vagRenderMeta + ' 결과를 바로 확인할 수 있습니다.');
        V._vagUpdateWorkspace();
        V._addMsg('ai', '<b>저장 지점에서 이어서 영상 생성 완료!</b>', { html: true });
      }
    } catch (e) {
      if (V._vagSaveCheckpoint) V._vagSaveCheckpoint('render_failed', Object.assign({}, cp, { html: html, bgmError: e.message || String(e) }));
      V._vagSetStage('render', 'error', '영상 생성 실패', e.message || '저장 지점에서 이어가기 중 오류가 발생했습니다.');
      V._addMsg('ai', '<span style="color:#ff3b30;">이어가기 실패: ' + V._esc(e.message || String(e)) + '</span>', { html: true });
    } finally {
      V._vagHideRenderOverlay();
      V._resetBtn();
    }
  }

})();
