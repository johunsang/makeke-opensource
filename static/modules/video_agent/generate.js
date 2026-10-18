/**
 * video_agent/generate.js
 * 영상 에이전트 (generate 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  var VAG_ATLAS_GPT_IMAGE2_EDIT = 'openai/gpt-image-2-developer/edit';
  var VAG_WAN_TURBO_IMAGE_VIDEO_MODEL = 'atlascloud/wan-2.2-turbo-spicy/image-to-video';
  var VAG_CHEAP_IMAGE_VIDEO_MODEL = VAG_WAN_TURBO_IMAGE_VIDEO_MODEL;
  V._vagVisualConceptRecommendationLimit = V._vagVisualConceptRecommendationLimit || 60;
  V._vagVisualConceptPromptLimit = V._vagVisualConceptPromptLimit || 24;
  function _vagNormalizeHexColor(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/#?[0-9a-fA-F]{6}\b/);
    if (!match) return '';
    var color = match[0].charAt(0) === '#' ? match[0] : ('#' + match[0]);
    color = color.toUpperCase();
    if (/^#(?:000000|FFFFFF|F5F5F7|1C1C1E)$/.test(color)) return '';
    return color;
  }
  function _vagResolveProfileBrandColor(profile) {
    var p = profile || {};
    var candidates = [p.brand_color, p.main_color, p.primary_color, p.accent_color, p.theme_color, p.color];
    [p.brand_colors, p.design_colors, p.palette, p.colors].forEach(function (value) {
      if (Array.isArray(value)) candidates = candidates.concat(value);
      else if (value) candidates = candidates.concat(String(value).split(/[,\s/|]+/));
    });
    for (var i = 0; i < candidates.length; i++) {
      var color = _vagNormalizeHexColor(candidates[i]);
      if (color) return color;
    }
    return '';
  }
  V._vagResolveProfileBrandColor = _vagResolveProfileBrandColor;
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
      if (value && value !== 'codex-cli') return value;
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
  function _bgImageModelForMode(mode) {
    if (mode === 'auto') return _vagResolveConfiguredImageModel();
    if (mode === 'nano-banana-2-edit') return _vagResolveConfiguredImageModel();
    if (mode === 'nano-banana-2-text') return _vagResolveConfiguredImageModel();
    if (mode === 'gpt-image-2-edit') return VAG_ATLAS_GPT_IMAGE2_EDIT;
    if (mode === 'qwen-product-edit') return 'alibaba/qwen-image/edit-plus-20251215';
    if (mode === 'qwen-image-2-pro-edit') return 'qwen/qwen-image-2.0-pro/edit';
    return mode === 'none' ? '' : _vagResolveConfiguredImageModel();
  }
  function _vagImageProviderForMode(mode) {
    if (mode === 'auto') return _vagResolveConfiguredImageProvider() || 'gemini';
    if (/qwen|gpt-image-2/i.test(String(mode || ''))) return 'atlas';
    if (mode === 'codex-cli') return 'codex';
    return mode === 'none' ? '' : 'gemini';
  }
  function _vagDefaultBackgroundImageMode() {
    return 'scene-image';
  }
  function _vagNormalizeBackgroundImageMode(mode) {
    var value = String(mode || '').trim();
    return value && value !== 'none' ? value : _vagDefaultBackgroundImageMode();
  }
  function _vagFindI2VOption(list, value, fallback) {
    var items = Array.isArray(list) ? list : [];
    var key = String(value || fallback || '').trim();
    return items.find(function (item) { return item && item.value === key; }) ||
      items.find(function (item) { return item && item.value === fallback; }) ||
      items[0] ||
      { value: key || '', label: key || '자동', desc: '' };
  }
  function _vagI2VFamilyOptions() {
    return (Array.isArray(V._vagAdVisualConceptFamilies) ? V._vagAdVisualConceptFamilies : []).map(function (item) {
      return { value: item[0], label: item[1], desc: item[2] || '' };
    });
  }
  function _vagI2VVibeOptions() {
    return (Array.isArray(V._vagAdVisualConceptVibes) ? V._vagAdVisualConceptVibes : []).map(function (item) {
      return { value: item[0], label: item[1], desc: item[2] || '' };
    });
  }
  function _vagRecommendedI2VDirectionValues() {
    var session = V._vagSession || {};
    var aspect = (window._vagAutoPrefs && window._vagAutoPrefs.aspect) || (document.getElementById('vag-aspect') || {}).value || '9:16';
    var preferred = Array.isArray(session.visualConcepts) && session.visualConcepts.length
      ? session.visualConcepts[0]
      : session.visualConcept;
    if (!preferred && typeof V._vagSelectAdVisualConcept === 'function') {
      preferred = (V._vagSelectAdVisualConcept(session, aspect, 1) || [])[0];
    }
    return {
      cut: (preferred && preferred.family) || 'commercial-clean',
      vibe: (preferred && preferred.vibe) || 'minimal-clean',
    };
  }
  function _vagBuildI2VDirectionState(cutValue, vibeValue) {
    var recommended = _vagRecommendedI2VDirectionValues();
    var cut = _vagFindI2VOption(_vagI2VFamilyOptions(), cutValue, recommended.cut);
    var vibe = _vagFindI2VOption(_vagI2VVibeOptions(), vibeValue, recommended.vibe);
    return {
      cut: cut.value,
      cutLabel: cut.label,
      cutDesc: cut.desc || '',
      vibe: vibe.value,
      vibeLabel: vibe.label,
      vibeDesc: vibe.desc || '',
    };
  }
  function _vagCurrentI2VRecommendation() {
    var recommended = _vagRecommendedI2VDirectionValues();
    return _vagBuildI2VDirectionState(recommended.cut, recommended.vibe);
  }
  function _vagApplyI2VDirectionToSession(state) {
    var next = state || _vagBuildI2VDirectionState(
      window._vagAutoPrefs && window._vagAutoPrefs.i2vCutDirection,
      window._vagAutoPrefs && window._vagAutoPrefs.i2vVibe
    );
    if (!window._vagAutoPrefs) window._vagAutoPrefs = {};
    window._vagAutoPrefs.i2vCutDirection = next.cut;
    window._vagAutoPrefs.i2vCutLabel = next.cutLabel;
    window._vagAutoPrefs.i2vVibe = next.vibe;
    window._vagAutoPrefs.i2vVibeLabel = next.vibeLabel;
    if (!V._vagSession) V._vagSession = {};
    V._vagSession.imageVideoDirection = next;
    return next;
  }
  V._vagApplyI2VDirectionToSession = _vagApplyI2VDirectionToSession;
  function _vagBuildProfileLogoCandidates(profileId, profile) {
    var p = profile || {};
    var list = [];
    ['logo_data_url', 'logoDataUrl', 'logo_url', 'logoUrl', 'brand_logo_url', 'brandLogoUrl', 'logo', 'logo_path', 'logoPath'].forEach(function (key) {
      var value = String(p[key] || '').trim();
      if (value && list.indexOf(value) < 0) list.push(value);
    });
    if (profileId) {
      [
        '/api/library/profiles/' + profileId + '/logo',
        '/api/library/image/' + profileId + '/logo.png',
        '/api/library/image/' + profileId + '/logo.jpg',
        '/api/library/image/' + profileId + '/logo.webp',
      ].forEach(function (url) {
        if (list.indexOf(url) < 0) list.push(url);
      });
    }
    return list;
  }
  V._vagBuildProfileLogoCandidates = _vagBuildProfileLogoCandidates;
  async function _vagFetchLogoAsDataUrl(url) {
    var raw = String(url || '').trim();
    if (!raw) throw new Error('로고 URL 없음');
    if (/^data:image\//i.test(raw)) return { dataUrl: raw, url: 'profile-data-url', size: raw.length, type: 'data-url' };
    var resp = await fetch(raw);
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + raw);
    var blob = await resp.blob();
    if (!blob || blob.size <= 0 || (blob.type || '').indexOf('image') < 0) throw new Error('이미지 응답 아님: ' + raw);
    var dataUrl = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl: dataUrl, url: raw, size: blob.size, type: blob.type || 'image' };
  }
  V._vagFetchLogoAsDataUrl = _vagFetchLogoAsDataUrl;
  function _vagRegisterLogoReferenceDataUrl(dataUrl, name) {
    var value = String(dataUrl || '').trim();
    if (!/^data:image\//i.test(value)) return false;
    V._vagAttachedImages = Array.isArray(V._vagAttachedImages) ? V._vagAttachedImages : [];
    var existing = V._vagAttachedImages.find(function (item) { return item && item.source === 'profile-logo'; });
    if (existing) {
      existing.dataUrl = value;
      existing.name = existing.name || name || '프로필 로고';
      existing.role = 'brand-reference';
      return true;
    }
    V._vagAttachedImages.unshift({ name: name || '프로필 로고', dataUrl: value, source: 'profile-logo', role: 'brand-reference' });
    if (V._vagAttachedImages.length > 8) V._vagAttachedImages.pop();
    return true;
  }
  V._vagRegisterLogoReferenceDataUrl = _vagRegisterLogoReferenceDataUrl;
  V._vagEnsureProfileLogoReference = async function _vagEnsureProfileLogoReference(options) {
    var opts = options || {};
    if (V._vagLogoDataUrl) {
      _vagRegisterLogoReferenceDataUrl(V._vagLogoDataUrl, '프로필 로고');
      return { ok: true, dataUrl: V._vagLogoDataUrl, source: 'memory' };
    }
    var profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    if (!profileId) return { ok: false, reason: 'profile-missing' };
    var candidates = _vagBuildProfileLogoCandidates(profileId, window._globalProfileData || {});
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var result = await _vagFetchLogoAsDataUrl(candidates[i]);
        if (!result || !result.dataUrl) continue;
        V._vagLogoDataUrl = result.dataUrl;
        if (!V._vagSession) V._vagSession = {};
        V._vagSession.logoDataUrl = result.dataUrl;
        _vagRegisterLogoReferenceDataUrl(result.dataUrl, '프로필 로고');
        var badge = document.getElementById('vag-logo-badge');
        if (badge) badge.textContent = '로고 ✓';
        try { V._vagRenderAttachments(); } catch (_) {}
        if (!opts.silent) V._addMsg('ai', '🏷 프로필 로고도 참고해서 이미지를 만들게요.');
        return { ok: true, dataUrl: result.dataUrl, source: result.url };
      } catch (_) {}
    }
    return { ok: false, reason: 'logo-not-found' };
  };
  function _vagLooksLikeProductAd(topic, objective) {
    return /상품|제품|판매|전환|구매|커머스|쇼핑|런칭|상세|브랜드몰|스토어|가격|리뷰/i.test(String(topic || '') + ' ' + String(objective || ''));
  }
  async function _vagFetchImageUrlAsAttachment(url, name) {
    var raw = String(url || '').trim();
    if (!raw) throw new Error('이미지 URL 없음');
    if (/^data:image\//i.test(raw)) return { dataUrl: raw, name: name || '상품 이미지', sourceUrl: 'data-url', role: 'product-asset' };
    var fetchUrls = [
      '/api/claude-design/proxy-image?url=' + encodeURIComponent(raw),
      raw,
    ];
    var lastErr = null;
    for (var i = 0; i < fetchUrls.length; i++) {
      try {
        var resp = await fetch(fetchUrls[i]);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var blob = await resp.blob();
        if (!blob || blob.size <= 0 || (blob.type || '').indexOf('image') < 0) throw new Error('이미지 응답 아님');
        var dataUrl = await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return { dataUrl: dataUrl, name: name || '상품 URL 이미지', sourceUrl: raw, size: blob.size, type: blob.type || 'image', role: 'product-asset' };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('이미지 가져오기 실패');
  }
  async function _vagImportProductImageUrls(imageUrls, limit) {
    var urls = Array.from(new Set((Array.isArray(imageUrls) ? imageUrls : []).map(function (url) {
      return String(url || '').trim();
    }).filter(Boolean)));
    var existing = {};
    (V._vagAttachedImages || []).forEach(function (item) {
      if (item && item.sourceUrl) existing[item.sourceUrl] = true;
      if (item && item.dataUrl) existing[item.dataUrl] = true;
    });
    var count = 0;
    for (var i = 0; i < urls.length && count < (limit || 4); i++) {
      if (existing[urls[i]]) continue;
      try {
        V._vagAttachedImages.push(await _vagFetchImageUrlAsAttachment(urls[i], '상품 URL 이미지 ' + (count + 1)));
        existing[urls[i]] = true;
        count++;
      } catch (_) {}
    }
    if (count && typeof V._vagRenderAttachments === 'function') V._vagRenderAttachments();
    return count;
  }
  async function _vagEnsureProductAssets(topic, objective) {
    if (!_vagLooksLikeProductAd(topic, objective)) return;
    V._vagSession = V._vagSession || {};
    V._addMsg('ai', '🧩 <b>상품 광고 자산을 먼저 정리합니다.</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">상품 URL이나 이미지를 먼저 확보해야 히어로컷, 사용컷, 디테일컷, 모델컷을 제대로 만들 수 있습니다.</span>', { html: true });
    var knownUrl = String((window._vagAutoChoices && window._vagAutoChoices.ctaUrl) || '').trim();
    var importedImages = 0;
    if (knownUrl && window._VAGSource && typeof window._VAGSource.fetchUrl === 'function') {
      try {
        V._addMsg('ai', '🔗 상품 URL을 먼저 읽어 상품 설명과 이미지를 가져옵니다.');
        var autoData = await window._VAGSource.fetchUrl(knownUrl, { minLength: 30, timeoutMs: 90000 });
        if (autoData && autoData.ok) {
          V._vagAppendSourceContent([autoData.title || '', autoData.text || ''].filter(Boolean).join('\n\n'), '상품 URL 수집 자료');
          V._vagAttachedSources.push({ title: autoData.title || knownUrl, url: knownUrl, snippet: String(autoData.text || '').slice(0, 240), type: 'product-url' });
          importedImages += await _vagImportProductImageUrls(autoData.images || [], 4);
        }
      } catch (err) {
        V._addMsg('ai', '상품 URL 자동 수집은 실패했습니다. 그래도 이미지 업로드나 기존 자료로 계속 진행할 수 있습니다.');
      }
    }
    if (!(V._vagAttachedImages || []).length) {
      var assetChoice = await new Promise(function (resolve) {
        V._addOptions(['상품 URL 가져오기', '상품 이미지 업로드', '기존 자료로 진행', '건너뛰기'], resolve);
      });
      if (assetChoice === '상품 URL 가져오기') {
        var productUrl = await new Promise(function (resolve) {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
          wrap.innerHTML = '<input id="vag-product-url-input" placeholder="상품/상세페이지 URL" style="flex:1;' + V._inputStyle() + '">' +
            '<button id="vag-product-url-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:800;cursor:pointer;">가져오기</button>';
          document.getElementById('vag-chat-body').appendChild(wrap);
          var input = document.getElementById('vag-product-url-input');
          document.getElementById('vag-product-url-go').onclick = function () { var v = (input.value || '').trim(); if (v) { wrap.remove(); resolve(v); } };
        });
        try {
          var data = await window._VAGSource.fetchUrl(productUrl, { minLength: 30, timeoutMs: 90000 });
          if (data && data.ok) {
            V._vagAppendSourceContent([data.title || '', data.text || ''].filter(Boolean).join('\n\n'), '상품 URL 수집 자료');
            V._vagAttachedSources.push({ title: data.title || productUrl, url: productUrl, snippet: String(data.text || '').slice(0, 240), type: 'product-url' });
            importedImages += await _vagImportProductImageUrls(data.images || [], 6);
          }
        } catch (err) {
          V._addMsg('ai', '상품 URL에서 이미지를 가져오지 못했습니다. 직접 이미지 업로드로 보완해 주세요.');
        }
      } else if (assetChoice === '상품 이미지 업로드') {
        document.getElementById('vag-image-input').click();
        await new Promise(function (resolve) {
          var before = (V._vagAttachedImages || []).length;
          var chk = setInterval(function () { if ((V._vagAttachedImages || []).length > before) { clearInterval(chk); resolve(); } }, 400);
          setTimeout(function () { clearInterval(chk); resolve(); }, 30000);
        });
      }
    }
    V._vagSession.productAssets = {
      imageCount: (V._vagAttachedImages || []).length,
      importedImages: importedImages,
      sourceCount: (V._vagAttachedSources || []).length,
      sourceUrls: (V._vagAttachedSources || []).map(function (item) { return item && item.url ? item.url : ''; }).filter(Boolean).slice(0, 8),
    };
    V._addMsg('ai', '✅ 상품 자산 정리: 이미지 ' + V._vagSession.productAssets.imageCount + '장, 자료 ' + V._vagSession.productAssets.sourceCount + '건을 씬 설계에 반영합니다.');
  }
  async function _vagChooseVisualConcept(topic, objective, tone) {
    if (!V._vagSelectAdVisualConcept) return;
    V._vagSession = V._vagSession || {};
    V._vagSession.baseTopic = topic || V._vagSession.baseTopic || '';
    V._vagSession.objective = objective || V._vagSession.objective || '';
    V._vagSession.tone = tone || V._vagSession.tone || '';
    var profileDesignGuide = typeof V._vagBuildProfileDesignGuideBlock === 'function' ? V._vagBuildProfileDesignGuideBlock() : '';
    if (profileDesignGuide) V._vagSession.profileDesignGuide = profileDesignGuide;
    var aspect = ((document.getElementById('vag-aspect') || {}).value || '9:16').trim();
    var pools = _vagBuildVisualConceptChoicePools(V._vagSession, aspect);
    var choices = pools.recommended;
    if (!choices.length) return;
    V._vagSession.visualConceptCandidates = choices;
    V._vagSession.visualConceptLibraryCount = pools.all.length;
    var pickedList = choices.slice(0, 1);
    V._addMsg('ai', '배경 색감: <b>' + (pickedList[0] && pickedList[0].label || 'AI 추천') + '</b> 자동 적용', { html: true });
    var picked = pickedList[0];
    V._vagSession.visualConcept = picked;
    V._vagSession.visualConcepts = pickedList;
    V._vagSession.visualConceptUserSelected = false;
    if (/^image-video/.test(((document.getElementById('vag-output-mode') || {}).value || '').trim())) {
      _vagApplyI2VDirectionToSession(_vagCurrentI2VRecommendation());
    }
    var designGuideNotice = profileDesignGuide
      ? '<br><span style="font-size:11px;color:#1d4ed8;font-weight:850;">CI/BI 프로필 디자인 규칙을 최우선으로 적용합니다.</span>'
      : '<br><span style="font-size:11px;color:#c06a00;font-weight:850;">프로필 디자인 규칙이 비어 있어 자동 컨셉만 적용됩니다.</span>';
    V._addMsg('ai', '선택한 배경 이미지 색감/분위기: <b>' + V._esc(pickedList.map(function (item) { return item.label; }).join(' · ')) + '</b><br><span style="font-size:11px;color:rgba(0,0,0,0.5);">문구와 자막은 이미지 위에 따로 올립니다.</span>' + designGuideNotice, { html: true });
  }
  function _vagBuildVisualConceptChoicePools(session, aspect) {
    var limit = V._vagVisualConceptRecommendationLimit || 60;
    var recommended = V._vagSelectAdVisualConcept(session, aspect, limit);
    var all = recommended.slice();
    if (typeof V._vagBuildAdVisualConceptLibrary === 'function') {
      var seed = [session && session.baseTopic, session && session.objective, session && session.tone, session && session.designFamily, aspect].filter(Boolean).join(' ');
      var allowNeon = /네온|사이버|cyber|neon/i.test(seed);
      all = V._vagBuildAdVisualConceptLibrary().filter(function (item) {
        return allowNeon || item.vibe !== 'neon-cyberpunk';
      });
    }
    var used = {};
    var merged = [];
    recommended.concat(all).forEach(function (item) {
      if (!item || !item.code || used[item.code]) return;
      used[item.code] = true;
      merged.push(item);
    });
    return { recommended: recommended, all: merged };
  }
  function _vagAddVisualConceptDropdown(recommendedChoices, allChoices, callback) {
    var body = document.getElementById('vag-chat-body');
    if (!body) return;
    var recommended = Array.isArray(recommendedChoices) ? recommendedChoices.filter(Boolean) : [];
    var all = Array.isArray(allChoices) && allChoices.length ? allChoices.filter(Boolean) : recommended.slice();
    var byCode = {};
    all.forEach(function (item) { if (item && item.code) byCode[item.code] = item; });
    var selectedCodes = new Set(recommended[0] && recommended[0].code ? [recommended[0].code] : []);
    var mode = 'recommended';
    var filtered = [];
    var wrap = document.createElement('div');
    wrap.className = 'vag-chat-options';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px 0;max-width:min(680px,100%);';
    wrap.innerHTML = ''
      + '<div data-vag-concept-status style="font-size:11px;font-weight:900;color:rgba(0,0,0,0.58);"></div>'
      + '<input type="search" data-vag-concept-search placeholder="색감/분위기 검색: 시네마틱, 럭셔리, 플랫레이, 파스텔..." style="width:100%;padding:8px 10px;border:1px solid rgba(255,140,0,0.22);border-radius:10px;background:#fff;font-size:12px;font-weight:700;outline:none;">'
      + '<select multiple size="12" style="width:100%;padding:9px 10px;border:1px solid rgba(255,140,0,0.22);border-radius:12px;background:#fff;font-size:12px;font-weight:700;color:#1c1c1e;line-height:1.45;"></select>'
      + '<div style="font-size:10px;color:rgba(0,0,0,0.42);">여러 개를 함께 고를 수 있습니다. 검색 후 현재 목록 전체 선택도 가능합니다.</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      + '<button type="button" data-action="apply" style="padding:7px 12px;border:0;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">선택 적용</button>'
      + '<button type="button" data-action="all-visible" style="padding:7px 12px;border:1px solid rgba(255,140,0,0.22);border-radius:10px;background:rgba(255,140,0,0.07);color:#d85c00;font-size:12px;font-weight:800;cursor:pointer;">현재 목록 전체 선택</button>'
      + '<button type="button" data-action="library" style="padding:7px 12px;border:1px solid rgba(0,122,255,0.18);border-radius:10px;background:rgba(0,122,255,0.06);color:#007aff;font-size:12px;font-weight:800;cursor:pointer;">전체 보기</button>'
      + '<button type="button" data-action="recommended" style="padding:7px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;color:rgba(0,0,0,0.62);font-size:12px;font-weight:800;cursor:pointer;">추천만 보기</button>'
      + '<button type="button" data-action="auto" style="padding:7px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;color:rgba(0,0,0,0.62);font-size:12px;font-weight:800;cursor:pointer;">AI 추천 1개</button>'
      + '<button type="button" data-action="clear" style="padding:7px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;color:rgba(0,0,0,0.45);font-size:12px;font-weight:800;cursor:pointer;">선택 해제</button>'
      + '</div>';
    var select = wrap.querySelector('select');
    var search = wrap.querySelector('[data-vag-concept-search]');
    var status = wrap.querySelector('[data-vag-concept-status]');
    function sourceList() {
      return mode === 'all' ? all : recommended;
    }
    function render() {
      var q = String((search && search.value) || '').trim().toLowerCase();
      filtered = sourceList().filter(function (item) {
        if (!q) return true;
        return [item.label, item.desc, item.code, item.family, item.vibe].filter(Boolean).join(' ').toLowerCase().indexOf(q) >= 0;
      });
      select.innerHTML = filtered.map(function (item) {
        var selected = selectedCodes.has(item.code) ? ' selected' : '';
        return '<option value="' + V._esc(item.code) + '"' + selected + '>' + V._esc(item.label) + (item.desc ? ' — ' + V._esc(item.desc).slice(0, 72) : '') + '</option>';
      }).join('');
      if (status) {
        status.textContent = (mode === 'all' ? '전체 ' + all.length + '개' : '추천 ' + recommended.length + '개') + ' · 현재 표시 ' + filtered.length + '개 · 선택 ' + selectedCodes.size + '개';
      }
    }
    function syncSelectionFromVisible() {
      Array.from(select.options || []).forEach(function (opt) {
        if (opt.selected) selectedCodes.add(opt.value);
        else selectedCodes.delete(opt.value);
      });
      if (status) status.textContent = (mode === 'all' ? '전체 ' + all.length + '개' : '추천 ' + recommended.length + '개') + ' · 현재 표시 ' + filtered.length + '개 · 선택 ' + selectedCodes.size + '개';
    }
    function selectedItems() {
      return Array.from(selectedCodes).map(function (code) { return byCode[code]; }).filter(Boolean);
    }
    function done(items, labelForChat) {
      body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
      V._addMsg('user', V._esc(labelForChat || ('배경 색감/분위기 ' + items.length + '개 선택')));
      callback(items);
    }
    if (select) select.addEventListener('change', syncSelectionFromVisible);
    if (search) search.addEventListener('input', render);
    wrap.querySelector('[data-action="apply"]').onclick = function () {
      syncSelectionFromVisible();
      var selected = selectedItems();
      done(selected.length ? selected : [recommended[0]]);
    };
    wrap.querySelector('[data-action="all-visible"]').onclick = function () {
      filtered.forEach(function (item) { if (item && item.code) selectedCodes.add(item.code); });
      render();
    };
    wrap.querySelector('[data-action="auto"]').onclick = function () {
      done([recommended[0]], 'AI 추천 1개 적용');
    };
    wrap.querySelector('[data-action="library"]').onclick = function () {
      mode = 'all';
      render();
    };
    wrap.querySelector('[data-action="recommended"]').onclick = function () {
      mode = 'recommended';
      render();
    };
    wrap.querySelector('[data-action="clear"]').onclick = function () {
      selectedCodes.clear();
      render();
    };
    body.appendChild(wrap);
    render();
    body.scrollTop = body.scrollHeight;
  }
  async function _vagLoadCampaignCharacters() {
    var profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    try {
      var resp = await V._vagFetch('/api/vag/characters?profile_id=' + encodeURIComponent(profileId));
      var data = await resp.json().catch(function () { return {}; });
      if (!resp.ok || !Array.isArray(data.items)) return [];
      return data.items.filter(function (item) {
        return item && (item.image_url || item.prompt || item.label || item.name);
      });
    } catch (_) {
      return [];
    }
  }

  function _vagBuildCampaignModelFromSavedCharacter(item) {
    var settings = item && item.settings && typeof item.settings === 'object' ? item.settings : {};
    var label = String((item && (item.label || item.name)) || settings.label || '저장된 주인공 모델').trim();
    var prompt = String((item && item.prompt) || settings.prompt || '').trim();
    if (!prompt) {
      prompt = [
        settings.preset || label,
        settings.gender ? '성별/인상: ' + settings.gender : '',
        settings.age ? '연령대: ' + settings.age : '',
        settings.face ? '헤어/얼굴 특징: ' + settings.face : '',
        settings.outfit ? '의상: ' + settings.outfit : '',
        settings.setting ? '촬영 공간: ' + settings.setting : '',
        settings.custom ? '사용자 설명: ' + settings.custom : '',
        '모든 씬에서 같은 얼굴형, 헤어, 의상 계열, 분위기를 유지한다.',
      ].filter(Boolean).join(' ');
    }
    return {
      label: label,
      prompt: prompt,
      settings: Object.assign({}, settings, {
        label: label,
        prompt: prompt,
        generateReferenceImage: false,
        savedCharacterId: item && item.id,
      }),
      generateReferenceImage: false,
      savedCharacterId: item && item.id,
    };
  }

  function _vagAwaitSavedCampaignCharacter(items) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve({ action: 'create' }); return; }
      var list = Array.isArray(items) ? items : [];
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:grid;gap:10px;width:min(720px,100%);padding:10px 0;';
      var cards = list.slice(0, 12).map(function (item, idx) {
        var image = String(item.image_url || '').trim();
        var title = String(item.label || item.name || ('주인공 ' + (idx + 1))).trim();
        var desc = String(item.prompt || '').slice(0, 150);
        return '<button type="button" data-character-index="' + idx + '" style="display:grid;grid-template-columns:74px 1fr;gap:10px;text-align:left;border:1px solid rgba(255,140,0,0.18);background:#fff;border-radius:12px;padding:8px;cursor:pointer;align-items:center;">' +
          (image ? '<img src="' + V._esc(image) + '" alt="' + V._esc(title) + '" style="width:74px;height:74px;object-fit:cover;border-radius:10px;background:#111;">' : '<div style="width:74px;height:74px;border-radius:10px;background:rgba(255,140,0,0.08);display:grid;place-items:center;color:#d85c00;font-size:11px;font-weight:900;">MODEL</div>') +
          '<span style="display:grid;gap:4px;min-width:0;">' +
            '<b style="font-size:12px;color:#1c1c1e;">' + V._esc(title) + '</b>' +
            '<span style="font-size:10px;line-height:1.45;color:rgba(0,0,0,0.55);">' + V._esc(desc || '저장된 주인공 사진을 이번 영상에 그대로 사용합니다.') + '</span>' +
          '</span>' +
        '</button>';
      }).join('');
      wrap.innerHTML =
        '<div style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);border-radius:12px;padding:10px 12px;">' +
          '<div style="font-size:13px;font-weight:950;color:#1c1c1e;">저장된 광고 주인공</div>' +
          '<div style="margin-top:4px;font-size:11px;line-height:1.5;color:rgba(0,0,0,0.58);">이전에 만든 모델을 쓰면 같은 얼굴과 분위기를 다음 광고에서도 이어갈 수 있습니다.</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">' + cards + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">' +
          '<button type="button" data-action="create" style="padding:8px 14px;border:1px solid rgba(255,140,0,0.24);border-radius:10px;background:rgba(255,140,0,0.07);color:#d85c00;font-size:12px;font-weight:900;cursor:pointer;">새 주인공 만들기</button>' +
          '<button type="button" data-action="skip" style="padding:8px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;background:#fff;color:rgba(0,0,0,0.58);font-size:12px;font-weight:800;cursor:pointer;">사람 없이 진행</button>' +
        '</div>';
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      wrap.querySelectorAll('[data-character-index]').forEach(function (button) {
        button.onclick = function () {
          var idx = parseInt(button.getAttribute('data-character-index') || '0', 10) || 0;
          wrap.remove();
          resolve({ action: 'use', item: list[idx] });
        };
      });
      wrap.querySelector('[data-action="create"]').onclick = function () {
        wrap.remove();
        resolve({ action: 'create' });
      };
      wrap.querySelector('[data-action="skip"]').onclick = function () {
        wrap.remove();
        resolve({ action: 'skip' });
      };
    });
  }

  async function _vagChooseCampaignModel(topic, objective) {
    V._vagSession = V._vagSession || {};
    var savedCharacters = await _vagLoadCampaignCharacters();
    V._addMsg('ai', '🎬 <b>광고 주인공을 만들까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);">사람이 나오는 광고면 주인공을 정해 모든 장면에서 같은 사람처럼 보이게 합니다. 필요 없으면 제품, 공간, 그래픽만으로 만듭니다.</span>', { html: true });
    var personMode = await new Promise(function (resolve) {
      var prevPause = window._vagAutoChoices && window._vagAutoChoices.pauseForManualOption;
      if (window._vagAutoChoices) window._vagAutoChoices.pauseForManualOption = true;
      var options = savedCharacters.length
        ? ['저장된 주인공 쓰기', '새 광고 주인공 만들기', '사람 없이 제품·공간만', 'AI에게 맡기기']
        : ['새 광고 주인공 만들기', '사람 없이 제품·공간만', 'AI에게 맡기기'];
      V._addOptions(options, function (value) {
        if (window._vagAutoChoices) window._vagAutoChoices.pauseForManualOption = prevPause;
        resolve(value);
      });
    });
    if (personMode === '저장된 모델 선택' || personMode === '저장된 주인공 사용' || personMode === '저장된 주인공 쓰기') {
      var picked = await _vagAwaitSavedCampaignCharacter(savedCharacters);
      if (picked && picked.action === 'use' && picked.item) {
        V._vagSession.personMode = '사람 등장';
        V._vagSession.campaignModel = _vagBuildCampaignModelFromSavedCharacter(picked.item);
        V._vagSession.characterImageUrl = String(picked.item.image_url || '').trim();
        V._vagSession.savedCharacterId = picked.item.id || null;
        V._addMsg('ai', '✅ 저장된 광고 주인공을 사용합니다: <b>' + V._esc(V._vagSession.campaignModel.label) + '</b>', { html: true });
        return;
      }
      if (picked && picked.action === 'skip') {
        personMode = '사람 없이 제품·공간만';
      } else {
        personMode = '사람 등장';
      }
    }
    if (personMode === '모델 만들기' || personMode === '새 모델 만들기' || personMode === '새 광고 주인공 만들기') personMode = '사람 등장';
    V._vagSession.personMode = personMode || 'AI가 장면별 판단';
    if (personMode === '모델 없이 진행' || personMode === '사람 없이 제품·공간·그래픽 중심' || personMode === '사람 없이 제품·공간만') {
      V._vagSession.personMode = '사람 없이 제품·공간·그래픽 중심';
      V._vagSession.campaignModel = null;
      V._vagSession.characterImageUrl = '';
      V._addMsg('ai', '✅ 사람 없이 제품, 공간, 그래픽 중심으로 구성합니다.');
      return;
    }
    if (personMode === 'AI에게 장면별 판단 맡기기' || personMode === 'AI가 장면별 판단' || personMode === 'AI에게 맡기기') {
      V._vagSession.personMode = 'AI가 장면별 판단';
      V._vagSession.campaignModel = null;
      V._vagSession.characterImageUrl = '';
      V._addMsg('ai', '✅ 사람을 넣을지는 AI가 장면에 맞게 판단합니다. 따로 주인공 사진은 만들지 않습니다.');
      return;
    }
    var modelMap = {
      'AI 자동 모델': '주제와 상품에 맞는 현실적인 한국/글로벌 광고 모델 1명을 AI가 정한다. 모든 컷에서 같은 인물로 유지한다.',
      '프리미엄 라이프스타일 모델': '고급 브랜드 광고에 어울리는 차분하고 세련된 성인 모델 1명. 절제된 표정, 자연스러운 손 동작, 프리미엄 라이프스타일 무드.',
      '친근한 실제 사용자 모델': '실제 고객처럼 보이는 자연스러운 성인 모델 1명. 과장 없는 표정, 일상 공간에서 제품/서비스를 직접 경험하는 느낌.',
      '전문가/컨설턴트 모델': '신뢰감 있는 전문가형 성인 모델 1명. 깔끔한 복장, 설명/상담/시연 장면에 어울리는 차분한 태도.',
      '크리에이터/인플루언서형 모델': '숏폼 광고에 어울리는 자연스러운 성인 크리에이터 모델 1명. 카메라를 의식한 표정, 손동작, 사용 후기 같은 리얼한 에너지.',
      '창업자/대표 인터뷰형 모델': '브랜드 철학과 신뢰를 전달하는 창업자/대표형 성인 모델 1명. 절제된 인터뷰 컷, 실제 사무실/스튜디오 같은 배경, 진정성 있는 표정.',
    };
    var modelRecommendation = _vagBuildCampaignModelRecommendation(modelMap, topic, objective);
    V._addMsg('ai',
      '🧑‍🎬 <b>광고 주인공 설정</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);">광고에 어울리는 사람 느낌을 AI가 먼저 골랐습니다. 그대로 쓰거나 바꿔도 됩니다.</span><br>' +
      '<span style="font-size:11px;color:rgba(255,107,0,0.95);font-weight:900;">추천: ' + V._esc(modelRecommendation.label) + '</span>',
      { html: true });
    var settings = await _vagAddCampaignModelSettings(modelMap, topic, objective, modelRecommendation);
    if (!settings) {
      V._vagSession.campaignModel = null;
      V._vagSession.characterImageUrl = '';
      V._addMsg('ai', '✅ 사람 없이 제품과 장면 중심으로 진행합니다.');
      return;
    }
    V._vagSession.characterImageUrl = '';
    V._vagSession.campaignModel = {
      label: settings.label,
      prompt: settings.prompt,
      settings: settings,
      generateReferenceImage: settings.generateReferenceImage,
      savedCharacterId: settings.savedCharacterId || null,
    };
    V._addMsg('ai', V._vagSession.campaignModel
      ? '✅ 광고 주인공 설정 완료: <b>' + V._esc(settings.label) + '</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);">주인공 기준 사진 만들기: ' + (settings.generateReferenceImage ? '켬' : '끔') + '</span>'
      : '✅ 사람 없이 제품과 장면 중심으로 진행합니다.',
      { html: true });
  }
  function _vagInferCampaignPersonMode(topic, objective) {
    var session = V._vagSession || {};
    var seed = [
      topic,
      objective,
      session.tone,
      session.baseSource,
      session.followupInstruction,
      session.personMode,
    ].filter(Boolean).join(' ');
    if (/사람\s*(없이|빼|제외|금지|넣지)|인물\s*(없이|빼|제외|금지|넣지)|얼굴\s*(없이|빼|제외|금지|넣지)|모델\s*(없이|빼|제외|금지|넣지)|no\s*(people|person|face|model)|without\s*(people|person|face|model)/i.test(seed)) {
      return '사람 없이 제품·공간·그래픽 중심';
    }
    if (/얼굴|모델|진행자|강사|대표|인터뷰|말하는|프레젠터|사람\s*나오|인물\s*나오|talking|presenter|spokesperson|interview/i.test(seed)) {
      return '사람 등장';
    }
    if (/앱|UI|ux|대시보드|프로그램|소프트웨어|자동화|사용법|튜토리얼|워크플로우|화면|줌|zoom|웨비나/i.test(seed)) {
      return '사람 없이 제품·공간·그래픽 중심';
    }
    return 'AI가 장면별 판단';
  }
  function _vagBuildCampaignModelRecommendation(modelMap, topic, objective) {
    var session = V._vagSession || {};
    var concepts = Array.isArray(session.visualConcepts) && session.visualConcepts.length
      ? session.visualConcepts
      : (session.visualConcept ? [session.visualConcept] : []);
    var conceptText = concepts.map(function (item) {
      return [item.label, item.desc, item.code, item.family, item.vibe].filter(Boolean).join(' ');
    }).join(' ');
    var seed = [topic, objective, session.tone, conceptText].filter(Boolean).join(' ');
    var preset = 'AI 자동 모델';
    if (/프리미엄|럭셔리|하이엔드|브랜드|ci|필름|고급|premium|luxury|noir|golden|minimal/i.test(seed)) preset = '프리미엄 라이프스타일 모델';
    if (/상담|예약|리드|컨설팅|전문|병원|클리닉|부동산|교육|강의|설명|인포머셜|정보|가이드|튜토리얼/i.test(seed)) preset = '전문가/컨설턴트 모델';
    if (/후기|리뷰|사용자|체험|일상|라이프|카페|푸드|warm|documentary|flatlay/i.test(seed)) preset = '친근한 실제 사용자 모델';
    if (/숏폼|릴스|틱톡|mz|크리에이터|인플루언서|streetwear|kpop|y2k|hype|musicvideo/i.test(seed)) preset = '크리에이터/인플루언서형 모델';
    if (/창업자|대표|브랜드 철학|비전|투자|ir|팀|채용|헤리티지/i.test(seed)) preset = '창업자/대표 인터뷰형 모델';

    var rec = {
      preset: preset,
      gender: 'AI가 주제에 맞게 판단',
      age: 'AI가 주제에 맞게 판단',
      face: '주제와 톤에 자연스럽게 어울리는 인상',
      outfit: '주제와 브랜드에 맞는 의상',
      setting: '주제에 맞는 공간',
      custom: '모델은 광고 주제, 배경 이미지, 브랜드 톤과 하나의 세계관으로 어울려야 한다. AI가 종합적으로 판단한다.',
      reason: 'AI 종합 판단',
      generateReferenceImage: true,
    };
    var conceptLabels = concepts.map(function (item) { return item.label; }).filter(Boolean).slice(0, 3).join(' · ');
    if (conceptLabels) rec.custom += (rec.custom ? ' ' : '') + '선택 콘셉트(' + conceptLabels + ')와 같은 조명, 색감, 렌즈 질감을 유지한다.';
    rec.label = [rec.preset, rec.age].filter(Boolean).join(' · ');
    return rec;
  }
  function _vagAddCampaignModelSettings(modelMap, topic, objective, recommendation) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) return resolve(null);
      var rec = recommendation || {};
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:grid;gap:8px;width:min(620px,100%);padding:10px 0;';
      var presetOptions = Object.keys(modelMap).map(function (label) {
        return '<option value="' + V._esc(label) + '"' + (label === rec.preset ? ' selected' : '') + '>' + V._esc(label) + '</option>';
      }).join('');
      wrap.innerHTML = ''
        + '<div style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);border-radius:12px;padding:9px 10px;font-size:11px;line-height:1.5;color:rgba(0,0,0,0.62);">'
        + '<b style="color:#d85c00;">AI 추천 주인공</b> · ' + V._esc(rec.reason || '광고 목적과 콘셉트 기준으로 추천') + '<br>'
        + '<span>' + V._esc(rec.label || rec.preset || 'AI 자동 모델') + '</span>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">주인공 느낌<select data-model-field="preset" style="' + V._inputStyle() + '">' + presetOptions + '</select></label>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">성별/인상<input data-model-field="gender" value="' + V._esc(rec.gender || '') + '" placeholder="예: 30대 여성, 신뢰감 있는 남성, 중성적 인상" style="' + V._inputStyle() + '"></label>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">연령대<input data-model-field="age" value="' + V._esc(rec.age || '') + '" placeholder="예: 20대 후반, 30대 중반, 40대 전문가" style="' + V._inputStyle() + '"></label>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">헤어/얼굴 특징<input data-model-field="face" value="' + V._esc(rec.face || '') + '" placeholder="예: 단정한 헤어, 자연스러운 미소, 깨끗한 피부톤" style="' + V._inputStyle() + '"></label>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">의상<input data-model-field="outfit" value="' + V._esc(rec.outfit || '') + '" placeholder="예: 화이트 셔츠와 베이지 재킷, 프리미엄 캐주얼" style="' + V._inputStyle() + '"></label>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">촬영 공간<input data-model-field="setting" value="' + V._esc(rec.setting || '') + '" placeholder="예: 고급 스튜디오, 병원 상담실, 도심 라이프스타일 공간" style="' + V._inputStyle() + '"></label>'
        + '</div>'
        + '<label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.48);">직접 설명<textarea data-model-field="custom" rows="3" placeholder="원하는 주인공의 분위기, 자세, 피해야 할 느낌을 적어주세요." style="' + V._inputStyle() + 'resize:vertical;line-height:1.55;">' + V._esc(rec.custom || '') + '</textarea></label>'
        + '<label style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.58);"><input data-model-field="reference" type="checkbox" checked> 이 설정으로 주인공 기준 사진 먼저 만들기</label>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
        + '<button type="button" data-action="apply" style="padding:8px 14px;border:0;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:900;cursor:pointer;">주인공 설정 적용</button>'
        + '<button type="button" data-action="recommend" style="padding:8px 14px;border:1px solid rgba(255,140,0,0.24);border-radius:10px;background:rgba(255,140,0,0.07);color:#d85c00;font-size:12px;font-weight:900;cursor:pointer;">AI 추천 다시 적용</button>'
        + '<button type="button" data-action="skip" style="padding:8px 14px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;background:#fff;color:rgba(0,0,0,0.58);font-size:12px;font-weight:800;cursor:pointer;">사람 없이 진행</button>'
        + '</div>';
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      var get = function (key) {
        return String((wrap.querySelector('[data-model-field="' + key + '"]') || {}).value || '').trim();
      };
      function applyRecommendation(nextRec) {
        var fields = ['preset', 'gender', 'age', 'face', 'outfit', 'setting', 'custom'];
        fields.forEach(function (key) {
          var el = wrap.querySelector('[data-model-field="' + key + '"]');
          if (el && Object.prototype.hasOwnProperty.call(nextRec, key)) el.value = nextRec[key] || '';
        });
        var ref = wrap.querySelector('[data-model-field="reference"]');
        if (ref) ref.checked = nextRec.generateReferenceImage !== false;
      }
      wrap.querySelector('[data-action="skip"]').onclick = function () {
        wrap.remove();
        V._addMsg('user', '사람 없이 진행');
        resolve(null);
      };
      wrap.querySelector('[data-action="recommend"]').onclick = function () {
        applyRecommendation(_vagBuildCampaignModelRecommendation(modelMap, topic, objective));
      };
      wrap.querySelector('[data-action="apply"]').onclick = function () {
        var preset = get('preset') || 'AI 자동 모델';
        var parts = [
          '광고 주제: ' + (topic || ''),
          '광고 목적: ' + (objective || ''),
          modelMap[preset] || '',
          get('gender') ? '성별/인상: ' + get('gender') : '',
          get('age') ? '연령대: ' + get('age') : '',
          get('face') ? '헤어/얼굴 특징: ' + get('face') : '',
          get('outfit') ? '의상: ' + get('outfit') : '',
          get('setting') ? '촬영 공간: ' + get('setting') : '',
          get('custom') ? '사용자 직접 설명: ' + get('custom') : '',
          '모든 씬에서 같은 얼굴형, 헤어, 의상 계열, 분위기를 유지한다.',
        ].filter(Boolean);
        var labelParts = [preset, get('gender'), get('age')].filter(Boolean);
        var settings = {
          label: labelParts.join(' · ') || preset,
          preset: preset,
          gender: get('gender'),
          age: get('age'),
          face: get('face'),
          outfit: get('outfit'),
          setting: get('setting'),
          custom: get('custom'),
          generateReferenceImage: !!wrap.querySelector('[data-model-field="reference"]')?.checked,
          prompt: parts.join(' '),
        };
        wrap.remove();
        V._addMsg('user', '주인공 설정 적용: ' + V._esc(settings.label));
        resolve(settings);
      };
    });
  }
  V._vagAppendSourceContent = function _vagAppendSourceContent(text, label) {
    var incoming = String(text || '').trim();
    if (!incoming) return V._vagSourceContent || '';
    var title = String(label || '추가 자료').trim();
    var existing = String(V._vagSourceContent || '').trim();
    var block = '[' + title + ']\n' + incoming;
    V._vagSourceContent = existing ? (existing + '\n\n---\n\n' + block) : block;
    window._sharedSourceContent = V._vagSourceContent;
    return V._vagSourceContent;
  };

  V._vagSyncSourceInputFromDOM = function _vagSyncSourceInputFromDOM(mode) {
    var el = document.getElementById('vag-auto-source-input');
    var value = el ? String(el.value || '').trim() : '';
    if (!value) return String(V._vagSourceContent || '').trim();
    V._vagSourceContent = value.slice(0, 12000);
    V._vagSourceMode = mode || V._vagSourceMode || '직접 입력 소재';
    window._sharedSourceContent = V._vagSourceContent;
    try { V._vagSetStage('source', 'ready', '직접 입력 자료 준비', V._vagSourceContent.length + '자 소재가 세션에 반영됐습니다.'); } catch (_) {}
    try { V._vagUpdateWorkspace(); } catch (_) {}
    return V._vagSourceContent;
  };

  /* ── 채팅 기반 생성 흐름 ── */
  V.vagGenerate = async function vagGenerate() {
    window._vagBusy = true;  // 메뉴 이동 시 경고용 플래그
    // 🔄 전면 초기화 — 이전 플로우의 모든 상태·DOM·promise 핸들러 제거
    var chatBody = document.getElementById('vag-chat-body');
    if (chatBody) chatBody.innerHTML = '';
    var resultEl = document.getElementById('vag-result');
    if (resultEl) resultEl.style.display = 'none';
    // 이전 플랜 편집 패널·렌더 오버레이·로고 미리보기 등 잔존 DOM 제거
    var planPanel = document.getElementById('vag-plan-editor'); if (planPanel) planPanel.remove();
    try { V._vagHideRenderOverlay && V._vagHideRenderOverlay(); } catch (_) {}
    // 휘발 상태 일괄 리셋
    window._sharedSourceContent = '';
    V._vagSession = null;
    V._vagResult = null;
    V._vagPlan = null;
    V._vagSourceMode = '';
    V._vagSourceContent = '';
    V._vagAttachedImages = [];
    V._vagAttachedSources = [];
    V._vagLogoDataUrl = '';
    V._vagHyperHtml = '';
    V._vagOriginalHtml = '';
    V._vagStudioProjectId = '';
    V._vagThreadId = '';
    V._vagThreadContext = {};
    V._vagPersistQueue = Promise.resolve();
    if (window._vagCliSession) window._vagCliSession = null;
    if (window._vagAutoChoices) window._vagAutoChoices = null;
    if (window._vagSeenTopics) try { window._vagSeenTopics.clear(); } catch (_) {}
    // 진행 중 promise 체인 무력화 — runId 증가 후 가드용 카운터 노출
    window._vagRunId = (window._vagRunId || 0) + 1;
    V._vagResetWorkspace();

    var btn = document.getElementById('vag-gen-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

    try {
      var brandName = (window._globalProfileData || {}).name || '';
      await V._vagEnsureConversationThread({
        title: brandName ? (brandName + ' 영상 대화') : '영상 대화',
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
        profile_name: brandName,
        current_node: 'intro',
        context: { current_node: 'intro' },
      });

      // 1. 시작 방식 선택 — 자동 또는 수동을 먼저 고른 뒤 주제/자료 입력
      var topic = await new Promise(function (resolve) {
        var body = document.getElementById('vag-chat-body');
        // ⚡ 완전 자동용 프리셋 저장소 초기화 (기본: 9:16, 1분, Gemini)
        window._vagAutoPrefs = window._vagAutoPrefs || {};
        var _prefAspect = window._vagAutoPrefs.aspect || '9:16';
        var _prefLength = window._vagAutoPrefs.lengthLabel || 'min1';
        var _prefStepMode = window._vagAutoPrefs.stepMode || 'auto';
        var _prefModel = window._vagAutoPrefs.model
          || ((document.getElementById('vag-provider') || {}).value)
          || 'gemini';
        var _prefVoice = (typeof window._vagAutoPrefs.voice !== 'undefined')
          ? window._vagAutoPrefs.voice
          : (((document.getElementById('vag-voice') || {}).value) || 'gemini-Kore');
        var inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:4px 0;';
        // 프리셋 행: 모델 + 비율 + 길이
        var _atlasModels = [
          { id: 'openai/gpt-5.5', label: 'GPT 5.5' },
          { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7' },
          { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
          { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
          { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
          { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
          { id: 'qwen/qwen3-max-2026-01-23', label: 'Qwen3 Max' },
          { id: 'openai/gpt-5.4', label: 'GPT 5.4' },
          { id: 'openai/o3-pro', label: 'OpenAI o3 Pro (Reasoning)' },
          { id: 'openai/o3', label: 'OpenAI o3' },
          { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
          { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
          { id: 'moonshotai/Kimi-K2-Thinking', label: 'Kimi K2 Thinking (Moonshot)' },
          { id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5' },
          { id: 'moonshotai/Kimi-K2-Instruct', label: 'Kimi K2 Instruct' },
          { id: 'xai/grok-4-0709', label: 'Grok 4' },
          { id: 'xai/grok-4.1-fast-reasoning', label: 'Grok 4.1 Fast (Reasoning)' },
          { id: 'deepseek-ai/deepseek-v3.2-speciale', label: 'DeepSeek V3.2 Speciale' },
          { id: 'deepseek-ai/deepseek-v3.2', label: 'DeepSeek V3.2' },
          { id: 'qwen/qwen3.6-plus', label: 'Qwen3.6 Plus' },
          { id: 'zai-org/glm-5.1', label: 'GLM 5.1 (Zhipu)' },
          { id: 'minimaxai/minimax-m2.7', label: 'MiniMax M2.7' },
        ];
        var _modelGroups = [
          { title: 'Gemini', items: [{ key: 'gemini', label: 'Gemini', hint: '기본 추천 · 서버 Gemini API' }] },
          { title: 'CLI', items: [
            { key: 'codex',  label: 'Codex CLI',  hint: '로컬 CLI · 코드 최적' },
            { key: 'kimi',   label: 'Kimi CLI',   hint: '로컬 CLI · 창의적' },
          ] },
        ];
        function _atlasSelectedText(select) {
          if (!select || !select.value) return '선택';
          var opt = select.options && select.options[select.selectedIndex];
          return opt ? opt.textContent : String(select.value).replace(/^atlas:/, '');
        }
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 완전 자동 카드 — 주제/소재 기반으로 목적까지 자동 판단한다.
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        function _renderToggleGroup(groupId, items, activeKey, dataAttr) {
          return items.map(function (it) {
            var key = it.key || it.label || it;
            var label = it.label || key;
            var title = it.hint ? ' title="' + it.hint + '"' : '';
            var active = key === activeKey;
            var bg = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
            var color = active ? '#fff' : 'rgba(0,0,0,0.62)';
            var border = active ? 'transparent' : 'rgba(0,0,0,0.08)';
            var shadow = active ? '0 2px 6px rgba(255,140,0,0.24)' : 'none';
            return '<button data-' + dataAttr + '="' + key + '"' + title + ' style="padding:5px 11px;border-radius:8px;border:1px solid ' + border + ';background:' + bg + ';color:' + color + ';font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s ease;box-shadow:' + shadow + ';">' + label + '</button>';
          }).join('');
        }
        function _renderAtlasSelect(activeKey) {
          var current = activeKey && activeKey.indexOf('atlas:') === 0 ? activeKey.slice(6) : '';
          var options = '<option value=""' + (!current ? ' selected' : '') + '>선택</option>' + _atlasModels.map(function (model) {
            return '<option value="atlas:' + model.id + '"' + (model.id === current ? ' selected' : '') + '>' + model.label + '</option>';
          }).join('');
          return '<div style="display:flex;flex-direction:column;gap:4px;min-width:220px;max-width:380px;">' +
            '<select id="vag-atlas-model-select" title="Atlas Cloud 모델" style="width:100%;padding:6px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:700;outline:none;">' + options + '</select>' +
            '<div id="vag-atlas-selected-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">Atlas Cloud: 선택</div>' +
          '</div>';
        }
        function _renderVoiceSelect(activeKey) {
          var current = activeKey || 'gemini-Kore';
          var items = (V._vagTTSVoices || []).concat([{ value: '', label: '나레이션 없음' }]);
          var options = items.map(function (voice) {
            return '<option value="' + voice.value + '"' + (voice.value === current ? ' selected' : '') + '>' + voice.label + '</option>';
          }).join('');
          return '<select id="vag-auto-voice-select" title="자동 생성 나레이션 목소리" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _renderAiBgVideoSelect(activeKey) {
          var current = _vagNormalizeBackgroundImageMode(activeKey || _vagDefaultBackgroundImageMode());
          var options = [
            { value: 'auto', label: 'AI 자동 선택 · Gemini/CLI 우선' },
            { value: 'gpt-image-2-edit', label: 'Atlas OpenAI Image 2 Edit 참고 이미지 (추천)' },
            { value: 'codex-cli', label: 'Codex CLI 직접 이미지 생성' },
            { value: 'qwen-product-edit', label: 'Atlas Qwen 상품 이미지 에디터' },
            { value: 'scene-image', label: '나노바나나2 이미지 생성 (기본)' },
            { value: 'nano-banana-2-edit', label: '나노바나나2 참고 이미지 생성' },
            { value: 'qwen-image-2-pro-edit', label: 'Atlas Qwen Image 2.0 Pro Edit' },
            { value: 'nano-banana-2-text', label: '나노바나나2 텍스트 이미지 생성' },
          ].map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="vag-auto-bg-video-select" title="AI 이미지 생성" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _renderImageCandidateSelect(activeKey) {
          var current = String(activeKey || '1');
          var options = [
            { value: '1', label: '씬당 1장 (기본)' },
            { value: '2', label: '씬당 2장 후보' },
            { value: '4', label: '씬당 4장 후보' },
            { value: '8', label: '씬당 8장 후보' },
            { value: '12', label: '씬당 12장 후보' },
          ].map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="vag-auto-bg-candidate-select" title="씬별 배경 이미지 후보 수" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _vagDefaultVideoModel() {
          return VAG_CHEAP_IMAGE_VIDEO_MODEL;
        }
        function _renderVideoModelSelect(activeKey) {
          var current = activeKey || _vagDefaultVideoModel();
          var options = [
            { value: VAG_CHEAP_IMAGE_VIDEO_MODEL, label: 'Wan 2.2 Turbo Spicy · 기본 저가 모델' },
            { value: 'atlascloud/wan-2.2-turbo-spicy/image-to-video-lora', label: '저가 Wan 2.2 Turbo Spicy LoRA · $0.026/s' },
            { value: 'alibaba/wan-2.5/image-to-video', label: 'Wan 2.5 Image-to-video' },
            { value: 'vidu/q3/reference-to-video', label: 'Vidu Q3 Reference · $0.042/s' },
            { value: 'google/veo-3.1-lite/image-to-video', label: 'Veo 3.1 Lite · $0.05/s' },
            { value: 'bytedance/seedance-2.0/image-to-video', label: 'Seedance 2.0' },
            { value: 'kwaivgi/kling-v3.0-std/image-to-video', label: 'Atlas Kling 3.0 Std' },
            { value: 'kwaivgi/kling-v3.0-pro/image-to-video', label: 'Atlas Kling 3.0 Pro' },
            { value: 'google/veo3.1/image-to-video', label: 'Atlas Veo 3.1' },
            { value: 'google/veo3.1-fast/image-to-video', label: 'Atlas Veo 3.1 Fast' },
            { value: 'alibaba/wan-2.7/image-to-video', label: 'Atlas Wan 2.7' },
          ].map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="vag-auto-video-model-select" title="영상 모델" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _vagFindI2VOption(items, value, fallbackValue) {
          var target = String(value || fallbackValue || '').trim();
          var list = Array.isArray(items) ? items : [];
          for (var i = 0; i < list.length; i++) {
            if (String(list[i].value || '') === target) return list[i];
          }
          return list[0] || { value: '', label: '' };
        }
        function _vagI2VFamilyOptions() {
          return (Array.isArray(V._vagAdVisualConceptFamilies) ? V._vagAdVisualConceptFamilies : []).map(function (item) {
            return { value: item[0], label: item[1], desc: item[2] || '' };
          });
        }
        function _vagI2VVibeOptions() {
          return (Array.isArray(V._vagAdVisualConceptVibes) ? V._vagAdVisualConceptVibes : []).map(function (item) {
            return { value: item[0], label: item[1], desc: item[2] || '' };
          });
        }
        function _vagRecommendedI2VDirectionValues() {
          var session = V._vagSession || {};
          var aspect = (window._vagAutoPrefs && window._vagAutoPrefs.aspect) || (document.getElementById('vag-aspect') || {}).value || '9:16';
          var preferred = Array.isArray(session.visualConcepts) && session.visualConcepts.length
            ? session.visualConcepts[0]
            : session.visualConcept;
          if (!preferred && typeof V._vagSelectAdVisualConcept === 'function') {
            preferred = (V._vagSelectAdVisualConcept(session, aspect, 1) || [])[0];
          }
          return {
            cut: (preferred && preferred.family) || 'commercial-clean',
            vibe: (preferred && preferred.vibe) || 'minimal-clean',
          };
        }
        function _vagCurrentI2VRecommendation() {
          var recommended = _vagRecommendedI2VDirectionValues();
          return _vagBuildI2VDirectionState(
            recommended.cut,
            recommended.vibe
          );
        }
        function _renderI2VOptionSelect(id, items, activeKey) {
          var list = (Array.isArray(items) ? items : []).filter(function (item) { return item && item.value; });
          var current = _vagFindI2VOption(list, activeKey, list[0] && list[0].value).value;
          var options = list.map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="' + id + '" style="width:100%;min-width:0;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _vagBuildI2VDirectionState(cutValue, vibeValue) {
          var recommended = _vagRecommendedI2VDirectionValues();
          var cut = _vagFindI2VOption(_vagI2VFamilyOptions(), cutValue, recommended.cut);
          var vibe = _vagFindI2VOption(_vagI2VVibeOptions(), vibeValue, recommended.vibe);
          return {
            cut: cut.value,
            cutLabel: cut.label,
            cutDesc: cut.desc || '',
            vibe: vibe.value,
            vibeLabel: vibe.label,
            vibeDesc: vibe.desc || '',
          };
        }
        function _vagApplyI2VDirectionToSession(state) {
          var next = state || _vagBuildI2VDirectionState(
            window._vagAutoPrefs && window._vagAutoPrefs.i2vCutDirection,
            window._vagAutoPrefs && window._vagAutoPrefs.i2vVibe
          );
          if (!window._vagAutoPrefs) window._vagAutoPrefs = {};
          window._vagAutoPrefs.i2vCutDirection = next.cut;
          window._vagAutoPrefs.i2vCutLabel = next.cutLabel;
          window._vagAutoPrefs.i2vVibe = next.vibe;
          window._vagAutoPrefs.i2vVibeLabel = next.vibeLabel;
          if (!V._vagSession) V._vagSession = {};
          V._vagSession.imageVideoDirection = next;
          return next;
        }
        var initialI2VDirection = _vagCurrentI2VRecommendation();
        function _renderOutputModeSelect(activeKey) {
          var current = activeKey === 'image-video' ? 'image-video-hyperframes' : (['motion', 'image-only', 'image-video-hyperframes'].indexOf(activeKey) >= 0 ? activeKey : 'image-video-hyperframes');
          var options = [
            { value: 'image-video-hyperframes', label: '배경 이미지를 짧은 영상으로 바꾼 뒤 문구 넣기' },
            { value: 'motion', label: '배경 이미지는 그대로 쓰고 문구 넣기' },
            { value: 'image-only', label: '배경 이미지만 만들기' },
          ].map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="vag-auto-output-mode-select" title="배경 이미지 영상화 여부" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _renderMotionFrameSelect(activeKey) {
          var current = activeKey || 'dynamic';
          var options = [
            { value: 'dynamic', label: '움직임 다양하게' },
            { value: 'max', label: '움직임 크게' },
            { value: 'cinematic', label: '영화처럼 부드럽게' },
            { value: 'clean', label: '깔끔하게' },
          ].map(function (item) {
            return '<option value="' + item.value + '"' + (item.value === current ? ' selected' : '') + '>' + item.label + '</option>';
          }).join('');
          return '<select id="vag-auto-motion-frame-select" title="화면 움직임 정도" style="width:100%;max-width:360px;padding:7px 9px;border-radius:8px;border:1px solid rgba(255,140,0,0.24);background:#fff;color:#1c1c1e;font-size:11px;font-weight:800;outline:none;">' + options + '</select>';
        }
        function _syncImageVideoCompatibility(reason) {
          var imageMode = _vagNormalizeBackgroundImageMode((window._vagAutoPrefs && window._vagAutoPrefs.aiBgVideo) || _vagDefaultBackgroundImageMode());
          var outputMode = (window._vagAutoPrefs && window._vagAutoPrefs.outputMode) || 'image-video-hyperframes';
          var changed = false;
          if (!window._vagAutoPrefs) window._vagAutoPrefs = {};
          if (window._vagAutoPrefs.aiBgVideo !== imageMode) {
            window._vagAutoPrefs.aiBgVideo = imageMode;
            changed = true;
          }
          var outputSelect = document.getElementById('vag-auto-output-mode-select');
          if (outputSelect) {
            Array.from(outputSelect.options).forEach(function (option) {
              option.disabled = false;
            });
            if (changed) {
              outputSelect.value = window._vagAutoPrefs.outputMode;
            }
          }
          var imageSelect = document.getElementById('vag-auto-bg-video-select');
          if (imageSelect && changed) imageSelect.value = window._vagAutoPrefs.aiBgVideo;
          var bgModeHidden = document.getElementById('vag-ai-bg-video');
          if (bgModeHidden) bgModeHidden.value = window._vagAutoPrefs.aiBgVideo;
          var imgProviderHidden = document.getElementById('vag-bg-image-provider');
          if (imgProviderHidden) {
            imgProviderHidden.value = _vagImageProviderForMode(window._vagAutoPrefs.aiBgVideo);
          }
          var imgModelHidden = document.getElementById('vag-bg-image-model');
          if (imgModelHidden) imgModelHidden.value = _bgImageModelForMode(window._vagAutoPrefs.aiBgVideo);
          var hidden = document.getElementById('vag-output-mode');
          if (hidden) hidden.value = ['image-only', 'image-video-hyperframes'].indexOf(window._vagAutoPrefs.outputMode) >= 0 ? window._vagAutoPrefs.outputMode : 'motion';
          var videoModel = document.getElementById('vag-ai-bg-video-model');
          if (videoModel) videoModel.value = /^image-video/.test(window._vagAutoPrefs.outputMode || '') ? (window._vagAutoPrefs.videoModel || _vagDefaultVideoModel()) : '';
          if (changed && reason === 'image-off' && typeof V._addMsg === 'function') {
            V._addMsg('ai', '광고영상은 장면마다 배경 이미지를 먼저 만듭니다. 기본 이미지 AI로 켜두고, 만든 이미지 위에 문구와 움직임을 올립니다.', { html: true });
          }
          return changed;
        }
        function _vagCommitAutoOutputModeFromDOM() {
          if (!window._vagAutoPrefs) window._vagAutoPrefs = {};
          var outputSelect = document.getElementById('vag-auto-output-mode-select');
          var selectedOutput = outputSelect ? outputSelect.value : window._vagAutoPrefs.outputMode;
          window._vagAutoPrefs.outputMode = ['motion', 'image-only', 'image-video-hyperframes'].indexOf(selectedOutput || '') >= 0 ? selectedOutput : 'image-video-hyperframes';
          var videoSelect = document.getElementById('vag-auto-video-model-select');
          if (videoSelect && videoSelect.value) window._vagAutoPrefs.videoModel = videoSelect.value;
          var hidden = document.getElementById('vag-output-mode');
          if (hidden) hidden.value = window._vagAutoPrefs.outputMode;
          var videoModel = document.getElementById('vag-ai-bg-video-model');
          if (videoModel) videoModel.value = /^image-video/.test(window._vagAutoPrefs.outputMode || '') ? (window._vagAutoPrefs.videoModel || _vagDefaultVideoModel()) : '';
          return window._vagAutoPrefs.outputMode;
        }
        async function _loadAtlasModelsIntoSelect() {
          var select = document.getElementById('vag-atlas-model-select');
          if (!select || select.dataset.loaded === '1') return;
          try {
            var resp = await fetch('/api/atlas/models');
            var data = await resp.json();
            var items = data && Array.isArray(data.items) ? data.items : [];
            if (!resp.ok || !items.length) throw new Error((data && (data.detail || data.error)) || 'Atlas 모델 목록 없음');
            var selected = select.value || '';
            select.innerHTML = '<option value="">선택</option>' + items.map(function (model) {
              var id = String(model.id || '').trim();
              if (!id) return '';
              var label = String(model.label || id).trim();
              var tags = Array.isArray(model.tags) && model.tags.length ? ' · ' + model.tags.slice(0, 2).join(', ') : '';
              return '<option value="atlas:' + id + '">' + label + tags + '</option>';
            }).filter(Boolean).join('');
            if ([...select.options].some(function (opt) { return opt.value === selected; })) select.value = selected;
            else select.value = '';
            select.dataset.loaded = '1';
            if (selected && String(window._vagAutoPrefs.model || '').indexOf('atlas:') === 0) {
              window._vagAutoPrefs.model = select.value;
              var provEl = document.getElementById('vag-provider');
              if (provEl) provEl.value = select.value;
            }
            _refreshPresetStyles();
          } catch (e) {
            select.title = 'Atlas 모델 목록 로드 실패: ' + (e.message || e);
          }
        }
        function _renderModelGroups(activeKey) {
          return _modelGroups.map(function (group) {
            return '<div style="display:grid;grid-template-columns:86px 1fr;gap:6px;align-items:start;width:100%;">' +
              '<div style="font-size:10px;font-weight:900;color:rgba(154,74,0,0.72);padding-top:6px;white-space:nowrap;">' + group.title + '</div>' +
              '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
                _renderToggleGroup('model', group.items, activeKey, 'model') +
              '</div>' +
            '</div>';
          }).join('');
        }

        var modeChoiceHtml =
          '<div id="vag-start-mode-choice" style="margin:2px 0 8px;font-size:11px;font-weight:850;color:#b45309;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.18);border-radius:10px;padding:8px 10px;line-height:1.45;">기본은 자동입니다. 주제, 첨부 자료, 브랜드 정보를 보고 AI가 광고 방향을 정합니다.</div>';

        // 히어로 — 완전 자동 카드
        var autoCardHtml =
          '<div id="vag-auto-mode-card" style="display:flex;position:relative;padding:18px 18px 16px;background:linear-gradient(180deg,#fffaf4,#ffffff 42%);border:2px solid rgba(255,140,0,0.36);border-left:7px solid #ff8c00;border-radius:16px;flex-direction:column;gap:12px;overflow:hidden;box-shadow:0 18px 46px rgba(255,140,0,0.14);">' +
            '<div style="position:absolute;right:-38px;top:-42px;width:150px;height:150px;border-radius:50%;background:rgba(255,140,0,0.08);pointer-events:none;"></div>' +
            // 헤더
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:900;box-shadow:0 8px 18px rgba(255,140,0,0.3);">⚡</div>' +
                '<div>' +
                  '<div style="font-size:16px;font-weight:950;color:#7c2d12;letter-spacing:0;">완전 자동 모드</div>' +
                  '<div style="font-size:12px;font-weight:750;color:rgba(124,45,18,0.72);margin-top:3px;line-height:1.45;">만드는 AI, 화면 비율, 길이만 확인하면 나머지는 AI가 진행합니다. 키워드나 자료가 없어도 시작할 수 있어요.</div>' +
                '</div>' +
              '</div>' +
              '<button id="vag-chat-topic-auto" style="position:relative;z-index:1;padding:13px 22px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:14px;font-weight:950;cursor:pointer;box-shadow:0 10px 24px rgba(255,140,0,0.42);display:flex;align-items:center;gap:7px;white-space:nowrap;">자동으로 만들기</button>' +
            '</div>' +
            '<input type="text" id="vag-auto-topic-input" placeholder="키워드/주제 선택 입력 (비워두면 AI가 추천)" style="width:100%;padding:11px 12px;font-size:12.5px;line-height:1.45;border-radius:10px;border:1px solid rgba(255,140,0,0.28);background:#fff;color:#1c1c1e;outline:none;font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,140,0,0.04);" onkeydown="if(event.key===\'Enter\'){event.preventDefault();document.getElementById(\'vag-chat-topic-auto\').click();}">' +
            '<div style="display:flex;flex-direction:column;gap:9px;padding:12px 13px;border:1px solid rgba(255,140,0,0.16);border-radius:13px;background:rgba(255,248,241,0.68);">' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:start;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;padding-top:6px;">만드는 AI</div>' +
                '<div id="vag-preset-model" style="display:flex;flex-direction:column;gap:5px;">' +
                  _renderModelGroups(_prefModel) +
                  '<div style="display:grid;grid-template-columns:86px 1fr;gap:6px;align-items:center;width:100%;">' +
                    '<div style="font-size:10px;font-weight:900;color:rgba(154,74,0,0.72);white-space:nowrap;">Atlas Cloud</div>' +
                    _renderAtlasSelect(_prefModel) +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">진행</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<div id="vag-preset-step-mode" style="display:inline-flex;gap:4px;flex-wrap:wrap;">' +
                    _renderToggleGroup('stepMode', [
                      { key: 'auto', label: '자동 진행', hint: '질문을 AI가 기본값으로 통과하고 빠르게 생성' },
                      { key: 'manual', label: '단계별 수동 확인', hint: '각 단계에서 사용자가 선택/확정 후 다음 단계 진행' },
                    ], _prefStepMode, 'step-mode') +
                  '</div>' +
                  '<div id="vag-auto-step-mode-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">자동 진행: 필요한 값은 AI가 고르고 결과 확인 단계만 보여줍니다.</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">목적</div>' +
                '<div id="vag-auto-objective-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);line-height:1.45;">주제와 소재를 읽어 AI가 자동으로 정합니다. 사용자가 고르는 수동 목적 선택은 쓰지 않습니다.</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">비율</div>' +
                '<div id="vag-preset-aspect" style="display:inline-flex;gap:4px;flex-wrap:wrap;">' +
                  _renderToggleGroup('aspect', ['9:16','1:1','16:9'], _prefAspect, 'aspect') +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">길이</div>' +
                '<div id="vag-preset-length" style="display:inline-flex;gap:4px;flex-wrap:wrap;">' +
                  _renderToggleGroup('length', [
                    { key: 'sec15', label: '15초' },
                    { key: 'sec30', label: '30초' },
                    { key: 'sec45', label: '45초' },
                    { key: 'min1', label: '1분' },
                    { key: 'min2', label: '2분' },
                    { key: 'min3', label: '3분' },
                    { key: 'min5', label: '5분' },
                    { key: 'min10', label: '10분' },
                  ], _prefLength, 'length') +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">목소리</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  _renderVoiceSelect(_prefVoice) +
                  '<div id="vag-auto-voice-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">AI가 읽어줄 목소리입니다.</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">이미지 AI</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  _renderAiBgVideoSelect(window._vagAutoPrefs.aiBgVideo || _vagDefaultBackgroundImageMode()) +
                  '<div id="vag-auto-bg-video-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">장면 배경 이미지를 만들 AI입니다.</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">이미지 움직임</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  _renderOutputModeSelect(window._vagAutoPrefs.outputMode || 'image-video-hyperframes') +
                  '<div id="vag-auto-output-mode-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">배경 이미지는 항상 만들고, 여기서 그 이미지를 영상처럼 움직일지 고릅니다.</div>' +
                '</div>' +
              '</div>' +
                '<div id="vag-auto-video-model-row" style="display:none;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                  '<div style="font-size:11px;font-weight:900;color:#9a4a00;">영상 AI</div>' +
                  '<div style="display:flex;flex-direction:column;gap:4px;">' +
                    _renderVideoModelSelect(window._vagAutoPrefs.videoModel || _vagDefaultVideoModel()) +
                    '<div id="vag-auto-video-model-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">이미지를 움직이는 데 쓸 AI입니다. 기본은 저렴한 모델입니다.</div>' +
                  '</div>' +
                '</div>' +
                '<div id="vag-auto-video-director-row" style="display:none;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                  '<div style="font-size:11px;font-weight:900;color:#9a4a00;">연출 스타일</div>' +
                  '<div style="display:flex;flex-direction:column;gap:4px;">' +
                    '<div style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.78);line-height:1.45;">AI가 주제·프로필·배경 컨셉·씬 컷 플랜을 보고 카메라 움직임, 컷 전환, 화면 분위기를 자동으로 정합니다.</div>' +
                    '<div id="vag-auto-i2v-direction-label" style="font-size:10px;font-weight:900;color:#ff6b00;line-height:1.45;">영상 만들기 선택 시 AI 자동 연출을 적용합니다.</div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                  '<div style="font-size:11px;font-weight:900;color:#9a4a00;">움직임 느낌</div>' +
                  '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  _renderMotionFrameSelect(window._vagAutoPrefs.motionFrameMode || 'dynamic') +
                  '<div id="vag-auto-motion-frame-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">장면마다 다른 움직임을 넣어 지루하지 않게 만듭니다.</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:none;grid-template-columns:64px 1fr;gap:10px;align-items:center;">' +
                '<div style="font-size:11px;font-weight:900;color:#9a4a00;">후보</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  _renderImageCandidateSelect(window._vagAutoPrefs.bgImageCandidates || '1') +
                  '<div id="vag-auto-bg-candidate-label" style="font-size:10px;font-weight:800;color:rgba(154,74,0,0.72);">기본은 씬당 1장입니다. 필요할 때만 후보를 늘립니다.</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            // 소재 입력란 — 본문·URL·YouTube 링크·문서 텍스트를 바로 붙여넣기
            '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;padding-top:10px;border-top:1px dashed rgba(255,140,0,0.2);">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
                '<div style="font-size:11px;font-weight:800;color:rgba(154,74,0,0.82);">📎 소재 (선택)</div>' +
                '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
                  '<button id="vag-auto-src-news" type="button" title="뉴스·블로그 검색 모달을 열어 결과를 소재로 가져옴" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(52,199,89,0.25);background:rgba(52,199,89,0.08);color:#1f8f44;font-size:10px;font-weight:700;cursor:pointer;">📰 뉴스</button>' +
                  '<button id="vag-auto-src-google" type="button" title="Google News(영·한 글로벌) 검색 후 상위 결과 제목·요약을 소재로 사용" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(66,133,244,0.28);background:rgba(66,133,244,0.08);color:#1a73e8;font-size:10px;font-weight:700;cursor:pointer;">🔍 구글</button>' +
                  '<button id="vag-auto-src-yt" type="button" title="YouTube URL 을 입력하면 자막/요약을 자동 추출" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(255,59,48,0.2);background:rgba(255,59,48,0.06);color:#ff3b30;font-size:10px;font-weight:700;cursor:pointer;">📺 YouTube</button>' +
                  '<button id="vag-auto-src-url" type="button" title="URL 을 입력하면 페이지 본문을 가져와 소재로 사용" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(0,122,255,0.2);background:rgba(0,122,255,0.06);color:#007aff;font-size:10px;font-weight:700;cursor:pointer;">🔗 URL</button>' +
                  '<button id="vag-auto-src-doc" type="button" title="PDF·DOCX·TXT 문서를 업로드해 텍스트 추출" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.08);color:#ff6b00;font-size:10px;font-weight:700;cursor:pointer;">📄 문서</button>' +
                  '<button id="vag-auto-src-clear" type="button" title="입력한 소재 비우기" style="padding:4px 8px;border-radius:7px;border:1px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.5);font-size:10px;font-weight:700;cursor:pointer;">비우기</button>' +
                '</div>' +
              '</div>' +
              '<textarea id="vag-auto-source-input" placeholder="본문·기사·보도자료 텍스트를 붙여넣거나, 위 버튼으로 YouTube/URL/문서에서 자동 추출" style="width:100%;min-height:72px;max-height:180px;padding:8px 10px;font-size:11.5px;line-height:1.55;border-radius:8px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,255,255,0.72);color:#1c1c1e;outline:none;resize:vertical;font-family:inherit;"></textarea>' +
              '<div id="vag-auto-source-status" style="display:none;font-size:10px;color:rgba(154,74,0,0.72);"></div>' +
            '</div>' +
          '</div>';

        inputWrap.innerHTML = modeChoiceHtml + autoCardHtml;
        body.appendChild(inputWrap);
        function _selectStartMode(mode) {
          window._vagStartMode = 'auto';
          var autoCard = document.getElementById('vag-auto-mode-card');
          if (autoCard) autoCard.style.display = 'flex';
        }
        _selectStartMode('auto');
        // 프리셋 버튼 핸들러 — 선택 시 해당 버튼만 활성 스타일
        function _refreshPresetStyles() {
          inputWrap.querySelectorAll('#vag-preset-model button').forEach(function (b) {
            var active = b.dataset.model === window._vagAutoPrefs.model;
            b.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(255,255,255,0.7)';
            b.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
            b.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.1)';
          });
          var atlasSelect = document.getElementById('vag-atlas-model-select');
          if (atlasSelect) {
            var atlasActive = String(window._vagAutoPrefs.model || '').indexOf('atlas:') === 0;
            atlasSelect.style.borderColor = atlasActive ? 'rgba(255,140,0,0.55)' : 'rgba(255,140,0,0.24)';
            atlasSelect.style.boxShadow = atlasActive ? '0 0 0 3px rgba(255,140,0,0.12)' : 'none';
            var atlasLabel = document.getElementById('vag-atlas-selected-label');
            if (atlasLabel) {
              atlasLabel.textContent = (atlasActive ? '현재 생성 모델: ' : 'Atlas Cloud: ') + _atlasSelectedText(atlasSelect);
              atlasLabel.style.color = atlasActive ? '#ff6b00' : 'rgba(154,74,0,0.72)';
            }
          }
          inputWrap.querySelectorAll('#vag-preset-aspect button').forEach(function (b) {
            var active = b.dataset.aspect === window._vagAutoPrefs.aspect;
            b.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(255,255,255,0.7)';
            b.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
            b.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.1)';
          });
          inputWrap.querySelectorAll('#vag-preset-length button').forEach(function (b) {
            var active = b.dataset.length === window._vagAutoPrefs.lengthLabel;
            b.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(255,255,255,0.7)';
            b.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
            b.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.1)';
          });
          inputWrap.querySelectorAll('#vag-preset-step-mode button').forEach(function (b) {
            var active = b.dataset.stepMode === window._vagAutoPrefs.stepMode;
            b.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(255,255,255,0.7)';
            b.style.color = active ? '#fff' : 'rgba(0,0,0,0.55)';
            b.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.1)';
          });
          var stepModeLabel = document.getElementById('vag-auto-step-mode-label');
          if (stepModeLabel) {
            stepModeLabel.textContent = window._vagAutoPrefs.stepMode === 'manual'
              ? '단계별 수동 확인: 모델/비율/길이/소재/이미지/렌더 확인을 직접 선택하고 넘어갑니다.'
              : '자동 진행: 필요한 값은 AI가 고르고 결과 확인 단계만 보여줍니다.';
          }
          var autoStartBtn = document.getElementById('vag-chat-topic-auto');
          if (autoStartBtn) {
            autoStartBtn.textContent = window._vagAutoPrefs.stepMode === 'manual' ? '단계별로 만들기' : '자동으로 만들기';
          }
          var autoVoiceSelect = document.getElementById('vag-auto-voice-select');
          var autoVoiceLabel = document.getElementById('vag-auto-voice-label');
          if (autoVoiceSelect && autoVoiceLabel) {
            autoVoiceLabel.textContent = autoVoiceSelect.value
              ? 'AI 목소리: ' + autoVoiceSelect.options[autoVoiceSelect.selectedIndex].textContent
              : '음성 사용 안 함';
          }
          var autoObjectiveLabel = document.getElementById('vag-auto-objective-label');
          if (autoObjectiveLabel) {
            autoObjectiveLabel.textContent = '주제와 소재를 읽어 AI가 자동으로 정합니다. 사용자가 고르는 수동 목적 선택은 쓰지 않습니다.';
          }
          var autoBgVideoSelect = document.getElementById('vag-auto-bg-video-select');
          var autoBgVideoLabel = document.getElementById('vag-auto-bg-video-label');
          if (autoBgVideoSelect && autoBgVideoLabel) {
            var bgLabelMap = {
              auto: 'AI가 주제와 첨부 이미지를 보고 알맞게 고릅니다.',
              'gpt-image-2-edit': '첨부한 사진을 참고해서 새 장면 이미지로 바꿉니다.',
              'codex-cli': '로컬 도구로 장면 이미지를 만듭니다.',
              'qwen-product-edit': '상품 사진을 여러 각도와 사용 장면으로 바꿉니다.',
              'scene-image': '기본 이미지 AI로 장면 배경 이미지를 만듭니다.',
              'nano-banana-2-edit': '첨부 이미지를 참고해서 장면 배경 이미지를 만듭니다.',
              'qwen-image-2-pro-edit': '첨부 이미지를 더 고급스럽게 바꿉니다.',
              'nano-banana-2-text': '첨부 이미지 없이 글 설명만으로 장면 배경 이미지를 만듭니다.',
            };
            autoBgVideoLabel.textContent = bgLabelMap[autoBgVideoSelect.value] || bgLabelMap['scene-image'];
          }
          var autoOutputModeSelect = document.getElementById('vag-auto-output-mode-select');
          var autoOutputModeLabel = document.getElementById('vag-auto-output-mode-label');
          if (autoOutputModeSelect && autoOutputModeLabel) {
            _syncImageVideoCompatibility();
            var outputMap = {
              motion: '장면 이미지는 그대로 쓰고, 그 위에 문구와 화면 효과를 올립니다.',
              'image-video-hyperframes': '장면 이미지를 먼저 짧은 영상으로 바꾼 뒤 문구와 음악을 얹습니다.',
              'image-only': '장면 이미지만 만들고 영상 파일은 만들지 않습니다.',
            };
            autoOutputModeLabel.textContent = outputMap[autoOutputModeSelect.value] || outputMap.motion;
          }
            var autoVideoModelRow = document.getElementById('vag-auto-video-model-row');
            if (autoVideoModelRow) autoVideoModelRow.style.display = /^image-video/.test((autoOutputModeSelect && autoOutputModeSelect.value) || '') ? 'grid' : 'none';
            var autoVideoDirectorRow = document.getElementById('vag-auto-video-director-row');
            var imageVideoSelected = /^image-video/.test((autoOutputModeSelect && autoOutputModeSelect.value) || '');
            if (autoVideoDirectorRow) autoVideoDirectorRow.style.display = imageVideoSelected ? 'grid' : 'none';
            var autoMotionFrameSelect = document.getElementById('vag-auto-motion-frame-select');
          var autoMotionFrameLabel = document.getElementById('vag-auto-motion-frame-label');
          if (autoMotionFrameSelect && autoMotionFrameLabel) {
            var motionLabelMap = {
              dynamic: '다양하게: 장면마다 움직임을 다르게 넣습니다.',
              max: '크게: 전환과 확대 움직임을 더 강하게 넣습니다.',
              cinematic: '영화처럼: 부드럽고 깊이감 있게 움직입니다.',
              clean: '깔끔하게: 흔들림은 줄이고 문구가 잘 보이게 움직입니다.',
            };
            autoMotionFrameLabel.textContent = motionLabelMap[autoMotionFrameSelect.value] || motionLabelMap.dynamic;
          }
          var autoVideoModelSelect = document.getElementById('vag-auto-video-model-select');
          var autoVideoModelLabel = document.getElementById('vag-auto-video-model-label');
            if (autoVideoModelSelect && autoVideoModelLabel) {
              autoVideoModelLabel.textContent = '현재 영상 모델: ' + (autoVideoModelSelect.options[autoVideoModelSelect.selectedIndex] ? autoVideoModelSelect.options[autoVideoModelSelect.selectedIndex].text : autoVideoModelSelect.value);
            }
            var autoI2VLabel = document.getElementById('vag-auto-i2v-direction-label');
            if (autoI2VLabel) {
              var directionState = imageVideoSelected ? _vagApplyI2VDirectionToSession(_vagCurrentI2VRecommendation()) : null;
              autoI2VLabel.textContent = imageVideoSelected
                ? 'AI 자동 연출: ' + directionState.cutLabel + ' × ' + directionState.vibeLabel + ' · 씬별 이미지 움직임과 전체 분위기 자동 적용'
                : '영상 만들기 선택 시에만 카메라/컷 방식과 분위기 조합을 적용합니다.';
              if (!imageVideoSelected && V._vagSession) V._vagSession.imageVideoDirection = null;
            }
          var autoBgCandidateSelect = document.getElementById('vag-auto-bg-candidate-select');
          var autoBgCandidateLabel = document.getElementById('vag-auto-bg-candidate-label');
          if (autoBgCandidateSelect && autoBgCandidateLabel) {
            var n = parseInt(autoBgCandidateSelect.value || '1', 10) || 1;
            autoBgCandidateLabel.textContent = n <= 1
              ? '기본은 씬당 1장입니다. 빠르고 메시지가 흐트러지지 않습니다.'
              : '장면마다 이미지 후보 ' + n + '장을 만들고, 고른 이미지만 영상에 씁니다.';
          }
        }
        window._vagAutoPrefs.model = _prefModel;
        window._vagAutoPrefs.aspect = _prefAspect;
        window._vagAutoPrefs.lengthLabel = _prefLength;
        window._vagAutoPrefs.stepMode = _prefStepMode === 'manual' ? 'manual' : 'auto';
        window._vagAutoPrefs.voice = _prefVoice;
        window._vagAutoPrefs.aiBgVideo = _vagNormalizeBackgroundImageMode(window._vagAutoPrefs.aiBgVideo || _vagDefaultBackgroundImageMode());
          window._vagAutoPrefs.videoModel = _vagDefaultVideoModel();
          window._vagAutoPrefs.i2vCutDirection = initialI2VDirection.cut;
          window._vagAutoPrefs.i2vVibe = initialI2VDirection.vibe;
          _vagApplyI2VDirectionToSession();
          window._vagAutoPrefs.objective = 'auto';
        window._vagAutoPrefs.bgImageCandidates = window._vagAutoPrefs.bgImageCandidates || '1';
        window._vagAutoPrefs.outputMode = ['motion', 'image-only', 'image-video-hyperframes'].indexOf(window._vagAutoPrefs.outputMode || '') >= 0 ? window._vagAutoPrefs.outputMode : 'image-video-hyperframes';
        window._vagAutoPrefs.motionFrameMode = window._vagAutoPrefs.motionFrameMode || 'dynamic';
        _syncImageVideoCompatibility();
        var initialBgCandidateHidden = document.getElementById('vag-bg-image-candidates');
        if (initialBgCandidateHidden) initialBgCandidateHidden.value = window._vagAutoPrefs.bgImageCandidates;
        var initialOutputModeHidden = document.getElementById('vag-output-mode');
        if (initialOutputModeHidden) initialOutputModeHidden.value = ['motion', 'image-only', 'image-video-hyperframes'].indexOf(window._vagAutoPrefs.outputMode) >= 0 ? window._vagAutoPrefs.outputMode : 'image-video-hyperframes';
        var initialVideoModelHidden = document.getElementById('vag-ai-bg-video-model');
        if (initialVideoModelHidden) initialVideoModelHidden.value = /^image-video/.test(window._vagAutoPrefs.outputMode || '') ? (window._vagAutoPrefs.videoModel || _vagDefaultVideoModel()) : '';
        inputWrap.querySelectorAll('#vag-preset-model button').forEach(function (b) {
          b.onclick = function () {
            window._vagAutoPrefs.model = b.dataset.model;
            // 프리셋 모델 선택을 즉시 숨은 provider select 에도 반영해 수동 경로도 일관
            var provEl = document.getElementById('vag-provider');
            if (provEl) provEl.value = b.dataset.model;
            _refreshPresetStyles();
          };
        });
        var atlasSelectEl = document.getElementById('vag-atlas-model-select');
        if (atlasSelectEl) atlasSelectEl.onchange = function () {
          window._vagAutoPrefs.model = atlasSelectEl.value || 'gemini';
          var provEl = document.getElementById('vag-provider');
          if (provEl) provEl.value = atlasSelectEl.value || 'gemini';
          _refreshPresetStyles();
        };
        _loadAtlasModelsIntoSelect();
        inputWrap.querySelectorAll('#vag-preset-aspect button').forEach(function (b) {
          b.onclick = function () { window._vagAutoPrefs.aspect = b.dataset.aspect; _refreshPresetStyles(); };
        });
        inputWrap.querySelectorAll('#vag-preset-length button').forEach(function (b) {
          b.onclick = function () { window._vagAutoPrefs.lengthLabel = b.dataset.length; _refreshPresetStyles(); };
        });
        inputWrap.querySelectorAll('#vag-preset-step-mode button').forEach(function (b) {
          b.onclick = function () {
            window._vagAutoPrefs.stepMode = b.dataset.stepMode === 'manual' ? 'manual' : 'auto';
            _refreshPresetStyles();
          };
        });
        var autoVoiceSelectEl = document.getElementById('vag-auto-voice-select');
        if (autoVoiceSelectEl) autoVoiceSelectEl.onchange = function () {
          window._vagAutoPrefs.voice = autoVoiceSelectEl.value || '';
          var voiceEl = document.getElementById('vag-voice');
          var narrationEl = document.getElementById('vag-auto-narration');
          if (voiceEl) voiceEl.value = window._vagAutoPrefs.voice;
          if (narrationEl) narrationEl.checked = !!window._vagAutoPrefs.voice;
          _refreshPresetStyles();
        };
        if (autoVoiceSelectEl && document.getElementById('vag-voice')) {
          document.getElementById('vag-voice').value = autoVoiceSelectEl.value || '';
        }
        if (autoVoiceSelectEl && document.getElementById('vag-auto-narration')) {
          document.getElementById('vag-auto-narration').checked = !!autoVoiceSelectEl.value;
        }
        var autoBgVideoSelectEl = document.getElementById('vag-auto-bg-video-select');
        if (autoBgVideoSelectEl) autoBgVideoSelectEl.onchange = function () {
          window._vagAutoPrefs.aiBgVideo = _vagNormalizeBackgroundImageMode(autoBgVideoSelectEl.value || _vagDefaultBackgroundImageMode());
          var bgEl = document.getElementById('vag-ai-bg-video');
          var modelEl = document.getElementById('vag-ai-bg-video-model');
          var imgProviderEl = document.getElementById('vag-bg-image-provider');
          var imgModelEl = document.getElementById('vag-bg-image-model');
          if (bgEl) bgEl.value = window._vagAutoPrefs.aiBgVideo;
          if (modelEl) modelEl.value = '';
          if (imgProviderEl) imgProviderEl.value = _vagImageProviderForMode(window._vagAutoPrefs.aiBgVideo);
          if (imgModelEl) imgModelEl.value = _bgImageModelForMode(window._vagAutoPrefs.aiBgVideo);
          _syncImageVideoCompatibility();
          _refreshPresetStyles();
        };
          var autoVideoModelSelectEl = document.getElementById('vag-auto-video-model-select');
          if (autoVideoModelSelectEl) autoVideoModelSelectEl.onchange = function () {
            window._vagAutoPrefs.videoModel = autoVideoModelSelectEl.value || _vagDefaultVideoModel();
            var modelEl = document.getElementById('vag-ai-bg-video-model');
            if (modelEl) modelEl.value = window._vagAutoPrefs.videoModel;
            _refreshPresetStyles();
          };
        var autoOutputModeSelectEl = document.getElementById('vag-auto-output-mode-select');
        if (autoOutputModeSelectEl) autoOutputModeSelectEl.onchange = function () {
          _vagCommitAutoOutputModeFromDOM();
          _syncImageVideoCompatibility();
          _refreshPresetStyles();
        };
        var autoMotionFrameSelectEl = document.getElementById('vag-auto-motion-frame-select');
        if (autoMotionFrameSelectEl) autoMotionFrameSelectEl.onchange = function () {
          window._vagAutoPrefs.motionFrameMode = autoMotionFrameSelectEl.value || 'dynamic';
          if (V._vagSession) V._vagSession.motionFrameMode = window._vagAutoPrefs.motionFrameMode;
          _refreshPresetStyles();
        };
        var autoBgCandidateSelectEl = document.getElementById('vag-auto-bg-candidate-select');
        if (autoBgCandidateSelectEl) autoBgCandidateSelectEl.onchange = function () {
          window._vagAutoPrefs.bgImageCandidates = autoBgCandidateSelectEl.value || '1';
          var hidden = document.getElementById('vag-bg-image-candidates');
          if (hidden) hidden.value = window._vagAutoPrefs.bgImageCandidates;
          _refreshPresetStyles();
        };
        _syncImageVideoCompatibility();
        _refreshPresetStyles();
        setTimeout(function () {
          _syncImageVideoCompatibility();
          _refreshPresetStyles();
        }, 0);

        // 소재 입력란 보조 버튼들 — textarea 에 추출 결과를 바로 채움
        var _autoSrcEl = function () { return document.getElementById('vag-auto-source-input'); };
        var _autoSrcStat = function () { return document.getElementById('vag-auto-source-status'); };
        function _setAutoSrcStatus(text, tone) {
          var s = _autoSrcStat();
          if (!s) return;
          if (!text) { s.style.display = 'none'; s.textContent = ''; return; }
          s.style.display = 'block';
          s.textContent = text;
          s.style.color = tone === 'error' ? '#ff3b30' : tone === 'warn' ? '#c06a00' : tone === 'ok' ? '#1f8f44' : 'rgba(154,74,0,0.72)';
        }
        function _formatSourceStage(stage) {
          if (!stage) return '수집 단계 진행 중';
          var label = stage.label || stage.key || '수집 단계';
          var mark = stage.success === false ? '✕' : stage.success === true ? '✓' : '…';
          var msg = stage.message ? ' — ' + stage.message : '';
          return mark + ' ' + label + msg;
        }
        function _setAutoSrcStage(stage) {
          var line = _formatSourceStage(stage);
          _setAutoSrcStatus('공통 수집 파이프라인 진행\n' + line, stage && stage.success === false ? 'warn' : 'info');
          try { V._vagSetStage('source', 'working', '공통 수집 파이프라인', line); } catch (_) {}
        }
        function _summarizeStageTrace(trace) {
          var list = Array.isArray(trace) ? trace : [];
          if (!list.length) return '';
          return list.map(_formatSourceStage).join(' / ');
        }
        function _askAutoSourceText(label, placeholder) {
          return new Promise(function (resolve) {
            var old = document.getElementById('vag-auto-source-inline-ask');
            if (old) old.remove();
            var anchor = _autoSrcStat() || document.getElementById('vag-chat-body');
            var box = document.createElement('div');
            box.id = 'vag-auto-source-inline-ask';
            box.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;padding:8px;border:1px solid rgba(255,140,0,0.18);border-radius:10px;background:#fff;';
            box.innerHTML =
              '<input id="vag-auto-source-inline-input" type="text" aria-label="' + V._esc(label || '입력') + '" placeholder="' + V._esc(placeholder || label || '') + '" style="flex:1;min-width:0;padding:7px 10px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:11px;">' +
              '<button id="vag-auto-source-inline-go" type="button" style="padding:7px 12px;border:none;border-radius:8px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:800;cursor:pointer;">확인</button>' +
              '<button id="vag-auto-source-inline-cancel" type="button" style="padding:7px 10px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:700;cursor:pointer;">취소</button>';
            if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
            else document.getElementById('vag-chat-body')?.appendChild(box);
            var input = box.querySelector('#vag-auto-source-inline-input');
            var finish = function (value) {
              var v = String(value || '').trim();
              box.remove();
              resolve(v);
            };
            box.querySelector('#vag-auto-source-inline-go').onclick = function () { finish(input.value); };
            box.querySelector('#vag-auto-source-inline-cancel').onclick = function () { finish(''); };
            input.onkeydown = function (event) {
              if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) finish(input.value);
              if (event.key === 'Escape') finish('');
            };
            setTimeout(function () { input.focus(); }, 20);
          });
        }
        // 소재 textarea 에 값을 넣고 동시에 세션 상태(_vagSourceContent) · 우측 수집 자료 프리뷰 동기화
        // 추가로 textarea 높이를 내용에 맞춰 자동 확장(max 240px) 해서 사용자가 스크래핑 결과를 바로 확인 가능
        function _fillAutoSrc(text, mode, meta) {
          var el = _autoSrcEl();
          if (!el) return;
          var v = String(text || '').slice(0, 12000);
          el.value = v;
          // 내용에 맞춰 높이 확장 (scrollHeight 기준, 240px 상한)
          el.style.height = 'auto';
          el.style.height = Math.min(240, Math.max(72, el.scrollHeight + 4)) + 'px';
          el.scrollTop = 0;
          // 세션 상태에도 동기화 → 오른쪽 수집 자료 패널이 실시간 반영 + ⚡ 자동 시작 시 즉시 사용
          if (v && v.length >= 30) {
            V._vagSourceContent = v;
            V._vagSourceMode = mode || '완전자동 소재 입력';
            window._sharedSourceContent = v;
            try { V._vagSetStage('source', 'ready', '자료 수집 완료', (V._vagSourceMode || '수집 자료') + ' · ' + v.length + '자 (' + (meta || 'textarea') + ')'); } catch (_) {}
            try { V._vagUpdateWorkspace(); } catch (_) {}
          }
        }
        function _syncAutoSrcTyping() {
          var el = _autoSrcEl();
          if (!el) return;
          var v = String(el.value || '').trim();
          if (v.length >= 30) {
            V._vagSourceContent = v.slice(0, 12000);
            V._vagSourceMode = '직접 입력 소재';
            window._sharedSourceContent = V._vagSourceContent;
            try { V._vagSetStage('source', 'ready', '직접 입력 자료 준비', V._vagSourceContent.length + '자 소재가 세션에 반영됐습니다.'); } catch (_) {}
          } else if (!v) {
            V._vagSourceContent = '';
            V._vagSourceMode = '';
            window._sharedSourceContent = '';
            try { V._vagSetStage('source', 'idle', '자료 수집 대기', '기사, URL, YouTube, 직접 입력 중에서 시작합니다.'); } catch (_) {}
          }
          try { V._vagUpdateWorkspace(); } catch (_) {}
        }
        var _autoSrcInputEl = _autoSrcEl();
        if (_autoSrcInputEl) _autoSrcInputEl.addEventListener('input', _syncAutoSrcTyping);
        // 📺 YouTube — Electron WebView 에서 prompt() 미지원이므로 화면 안 입력으로 받음
        // 📺 / 🔗 / 📄 — 공용 소스 클라이언트 _VAGSource 로 통일
        // analyzeYouTube / fetchUrl / parseDocument 가 동일 shape { ok, text, error } 로 응답.
        var _ytBtn = document.getElementById('vag-auto-src-yt');
        if (_ytBtn) _ytBtn.onclick = async function () {
          var url = await _askAutoSourceText('YouTube URL', 'YouTube URL 을 입력하세요 (공개 영상만 지원)');
          if (!url) return;
          _setAutoSrcStatus('📺 YouTube 분석 중...', 'info');
          _ytBtn.disabled = true;
          try {
            var res = await window._VAGSource.analyzeYouTube(url);
            if (res.ok) {
              _fillAutoSrc(res.text, 'YouTube 분석', 'YouTube');
              _setAutoSrcStatus('✅ YouTube 분석 완료 — ' + res.text.length + '자 (우측 패널·소재 입력란·세션에 모두 반영)', 'ok');
            } else {
              _setAutoSrcStatus('⚠ 분석 실패: ' + res.error, 'error');
            }
          } finally { _ytBtn.disabled = false; }
        };
        var _urlBtn = document.getElementById('vag-auto-src-url');
        if (_urlBtn) _urlBtn.onclick = async function () {
          var url = await _askAutoSourceText('URL', '가져올 페이지 URL 을 입력하세요');
          if (!url) return;
          _setAutoSrcStatus('🔗 URL 본문 추출 중...', 'info');
          _urlBtn.disabled = true;
          try {
            var res = await window._VAGSource.fetchUrl(url, { minLength: 30, timeoutMs: 90000, onStage: _setAutoSrcStage });
            if (res.ok) {
              var stageSummary = _summarizeStageTrace(res.stageTrace);
              _fillAutoSrc(res.text.slice(0, 10000), 'URL 가져오기', stageSummary || (res.method || '공통 파이프라인'));
              _setAutoSrcStatus('✅ URL 본문 추출 완료 — ' + res.text.length + '자\n' + (stageSummary || '공통 수집 파이프라인 통과'), 'ok');
            } else {
              _setAutoSrcStatus('⚠ URL 가져오기 실패: ' + res.error + (_summarizeStageTrace(res.stageTrace) ? '\n' + _summarizeStageTrace(res.stageTrace) : ''), 'error');
            }
          } finally { _urlBtn.disabled = false; }
        };
        var _docBtn = document.getElementById('vag-auto-src-doc');
        if (_docBtn) _docBtn.onclick = async function () {
          var fileData = await new Promise(function (r) {
            var inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.pdf,.docx,.doc,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
            inp.onchange = function () { r(inp.files[0] || null); };
            inp.click();
          });
          if (!fileData) return;
          _setAutoSrcStatus('📄 ' + fileData.name + ' 파싱 중...', 'info');
          _docBtn.disabled = true;
          try {
            var res = await window._VAGSource.parseDocument(fileData);
            if (res.ok) {
              _fillAutoSrc(res.text, '문서 업로드', fileData.name);
              _setAutoSrcStatus('✅ 문서 파싱 완료 (' + fileData.name + ') — ' + res.text.length + '자 (우측 수집 자료 패널에 동기화됨)', 'ok');
            } else {
              _setAutoSrcStatus('⚠ 문서 파싱 실패: ' + res.error, 'error');
            }
          } finally { _docBtn.disabled = false; }
        };
        // 비우기 — textarea 뿐 아니라 세션 상태·수집 자료 프리뷰까지 초기화
        var _clearBtn = document.getElementById('vag-auto-src-clear');
        if (_clearBtn) _clearBtn.onclick = function () {
          var el = _autoSrcEl();
          if (el) { el.value = ''; el.style.height = '72px'; }
          _setAutoSrcStatus('', '');
          V._vagSourceContent = '';
          V._vagSourceMode = '';
          window._sharedSourceContent = '';
          try { V._vagSetStage('source', 'idle', '자료 수집 대기', '기사, URL, YouTube, 직접 입력 중에서 시작합니다.'); } catch (_) {}
          try { V._vagUpdateWorkspace(); } catch (_) {}
        };
        // 📰 / 🔍 — 공용 _VAGSource 로 통일. 모달 폴링·취소 복원·타임아웃은 모듈 내부.
        var _newsBtn = document.getElementById('vag-auto-src-news');
        if (_newsBtn) _newsBtn.onclick = async function () {
          _setAutoSrcStatus('📰 뉴스 검색 모달에서 기사를 선택하세요...', 'info');
          _newsBtn.disabled = true;
          try {
            var res = await window._VAGSource.openNewsModal({ timeoutMs: 180000 });
            if (res.ok) {
              _fillAutoSrc(res.text.slice(0, 12000), '뉴스 검색', '5단계 스크래핑');
              _setAutoSrcStatus('✅ 뉴스 자료 수집 완료 — ' + res.text.length + '자 (우측 수집 자료 패널에 동기화됨)', 'ok');
            } else {
              _setAutoSrcStatus('취소됨 또는 본문 수집 0건 — 다른 키워드로 재시도해주세요', 'warn');
            }
          } finally { _newsBtn.disabled = false; }
        };
        var _googleBtn = document.getElementById('vag-auto-src-google');
        if (_googleBtn) _googleBtn.onclick = async function () {
          var q = await _askAutoSourceText('Google 뉴스 검색어', '구글 뉴스에서 검색할 키워드를 입력하세요 (한/영 모두 가능)');
          if (!q || !q.trim()) return;
          if (!window._VAGSource || typeof window._VAGSource.searchGoogleNews !== 'function') {
            _setAutoSrcStatus('⚠ 공용 검색 모듈이 아직 로드되지 않았습니다. 잠시 후 다시 눌러주세요.', 'warn');
            return;
          }
          _setAutoSrcStatus('🔍 Google 뉴스 검색 중...', 'info');
          _googleBtn.disabled = true;
          try {
            var res = await window._VAGSource.searchGoogleNews(q.trim());
            if (!res.ok) {
              _setAutoSrcStatus('⚠ ' + res.error, 'warn');
              return;
            }
            var items = Array.isArray(res.items) ? res.items : [];
            if (!items.length) {
              _setAutoSrcStatus('⚠ Google 뉴스 검색 결과가 없습니다. 다른 키워드나 직접 URL을 사용해주세요.', 'warn');
              return;
            }
            var topUrl = String(items[0].url || items[0].link || '').trim();
            var scraped = null;
            if (topUrl && window._VAGSource && typeof window._VAGSource.fetchUrl === 'function') {
              _setAutoSrcStatus('🔍 Google 뉴스 결과 확인 완료. 1순위 기사 본문을 공통 파이프라인으로 수집합니다...', 'info');
              scraped = await window._VAGSource.fetchUrl(topUrl, {
                minLength: 30,
                timeoutMs: 90000,
                title: items[0].title || '',
                onStage: _setAutoSrcStage,
              });
            }
            var stageSummary = scraped && scraped.ok ? _summarizeStageTrace(scraped.stageTrace) : '';
            var dump = items.slice(0, 12).map(function (it) {
              var title = (it.title || '').trim();
              var snip = (it.snippet || it.description || it.summary || '').trim();
              var src = (it.press || it.channel || it.source || '').trim();
              return '• [' + (src || 'web') + '] ' + title + (snip ? '\n  ' + snip : '');
            }).filter(Boolean).join('\n\n');
            var merged = scraped && scraped.ok
              ? ('[1순위 기사 본문]\n' + (scraped.title || items[0].title || topUrl) + '\n' + scraped.text + '\n\n[Google 뉴스 검색 결과]\n' + dump)
              : dump;
            _fillAutoSrc(merged.slice(0, 12000), '구글 뉴스 검색', (stageSummary || 'Google News') + ' · ' + items.length + '건');
            _setAutoSrcStatus('✅ Google 뉴스 ' + items.length + '건 수집 완료' + (stageSummary ? '\n' + stageSummary : scraped && !scraped.ok ? '\n1순위 본문 수집 실패, 검색 결과 요약으로 진행: ' + scraped.error : ''), 'ok');
          } catch (e) {
            _setAutoSrcStatus('⚠ Google 뉴스 검색 오류: ' + ((e && e.message) || e || '알 수 없는 오류'), 'warn');
          } finally { _googleBtn.disabled = false; }
        };
        var manualTopicGo = document.getElementById('vag-chat-topic-go');
        if (manualTopicGo) manualTopicGo.onclick = async function () {
          var v = document.getElementById('vag-chat-topic-input').value.trim();
          if (!v) return;
          // URL 자동 감지 → fetch + 주제 추출 흐름으로 분기
          var urlMatch = v.match(/https?:\/\/\S+/);
          if (urlMatch && v.replace(urlMatch[0], '').trim().length < 6) {
            // 입력의 대부분이 URL (앞뒤 글자 6자 미만) → URL 가져오기 자동 진행
            inputWrap.remove();
            V._addMsg('user', v);
            V._addMsg('ai', '🔗 URL 감지 — 페이지 내용 가져온 뒤 주제 자동 추출합니다...');
            try {
              var fd = await window._VAGSource.fetchUrl(urlMatch[0], { minLength: 30, timeoutMs: 90000, onStage: _setAutoSrcStage });
              if (!fd.ok || !fd.text || fd.text.length < 30) throw new Error(fd.error || '가져온 텍스트가 너무 짧음');
              V._vagSourceContent = fd.text;
              V._vagSourceMode = 'URL';
              window._sharedSourceContent = fd.text;
              try { V._vagSetStage('source', 'ready', 'URL 자료 수집 완료', (_summarizeStageTrace(fd.stageTrace) || fd.method || '공통 스크래핑') + ' · ' + fd.text.length + '자'); V._vagUpdateWorkspace(); } catch (_) {}
              V._addMsg('ai', '✅ 자료 ' + fd.text.length + '자 수집 — 주제 후보 생성 중...');
              var ar = await fetch('/api/ce2/assist', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                  action:'topics', mode:'motion_video', count:5,
                  industry:(window._globalProfileData||{}).business_type||'',
                  brand_name: brandName,
                  brand_desc:(window._globalProfileData||{}).service_description||'',
                  brand_biz_detail: '자료:\n' + fd.text.slice(0, 3000)
                })
              });
              var ad = await ar.json();
              var topics = (ad.ok && ad.items) ? ad.items.slice(0, 5) : [];
              if (topics.length === 0) {
                V._addMsg('ai', '<span style="color:#ff9500;">주제 추출 실패 — URL 그대로 주제로 사용합니다.</span>');
                resolve(v);
                return;
              }
              // 🎯 상품 URL = 의도 자명 → 목적·톤만 후보화하고 CTA는 사용자가 고른다.
              window._vagAutoChoices = {
                objective: '광고 전환',
                tone: '직설',
                ctaUrl: urlMatch[0],
              };
              V._addMsg('ai', '🎯 <b>상품 URL 감지</b> — 광고 전환 후보로 진행합니다. CTA에 URL을 넣을지는 뒤에서 직접 선택합니다.');
              V._addMsg('ai', '✨ URL 기반 주제 후보 ' + topics.length + '개 — 골라주세요:');
              V._addOptions(topics, function (sel) { resolve(sel); });  // _addOptions 가 user 메시지 자동 추가
            } catch (e) {
              V._addMsg('ai', '<span style="color:#ff3b30;">URL 가져오기 실패: ' + V._esc(e.message||e) + ' — URL 을 그대로 주제로 사용합니다.</span>');
              resolve(v);
            }
            return;
          }
          inputWrap.remove();
          body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
          V._addMsg('user', v);
          resolve(v);
        };
        // 📥 자료 먼저 — 자료 받으면 주제 자동 추출 후 진행 (자료 조사 단계 자동 스킵)
        var sourceFirstBtn = document.getElementById('vag-chat-topic-source');
        if (sourceFirstBtn) sourceFirstBtn.onclick = async function () {
          inputWrap.remove();
          var t = await _vagPickSourceFirst();
          if (t) {
            // _vagPickSourceFirst 안에서 옵션 픽 시 user 메시지가 이미 추가됨 (중복 방지)
            resolve(t);
          } else {
            // 사용자가 취소 → 입력창 다시
            body.appendChild(inputWrap);
          }
        };
        // 📥 자료 먼저 헬퍼 — 4가지 채널 중 하나로 자료 받기 + 주제 자동 추출
        async function _vagPickSourceFirst() {
          var ch = await new Promise(function (res) {
            V._addMsg('ai', '어디서 자료를 가져올까요?');
            V._addOptions([
              '📰 뉴스 검색',
              '🔗 URL 가져오기',
              '📺 YouTube 분석',
              '📄 문서 업로드 (PDF · DOCX · TXT)',
              '✏️ 직접 입력 (긴 텍스트)',
              '📷 이미지 첨부',
              '↩ 취소',
            ], res);
          });
          if (ch === '↩ 취소') return null;
          var sourceText = '';
          var sourceTitle = '';
          if (ch === '📰 뉴스 검색') {
            var newsRes = await window._VAGSource.openNewsModal({ timeoutMs: 180000 });
            if (!newsRes.ok) {
              V._addMsg('ai', '<span style="color:#ff9500;">뉴스 자료 선택이 완료되지 않았습니다: ' + V._esc(newsRes.error || '결과 없음') + '</span>');
              return null;
            }
            sourceText = newsRes.text || '';
          } else if (ch === '🔗 URL 가져오기') {
            var url = await new Promise(function (r) {
              V._addMsg('ai', '가져올 URL 을 입력해주세요.');
              var w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
              w.innerHTML = '<input type="text" id="vag-src-url" placeholder="https://..." style="flex:1;' + V._inputStyle() + '"><button id="vag-src-url-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer;">가져오기</button>';
              document.getElementById('vag-chat-body').appendChild(w);
              document.getElementById('vag-src-url-go').onclick = function () { var v = document.getElementById('vag-src-url').value.trim(); w.remove(); if (v) V._addMsg('user', v); r(v); };
            });
            if (!url) return null;
            V._addMsg('ai', '🔍 URL 내용을 공통 스크래핑 파이프라인으로 가져오는 중...');
            try {
              var fd = await window._VAGSource.fetchUrl(url, { minLength: 30, timeoutMs: 90000, onStage: _setAutoSrcStage });
              if (!fd.ok || !fd.text) throw new Error(fd.error || '본문 수집 실패');
              sourceText = fd.text || '';
              sourceTitle = fd.title || url;
              V._addMsg('ai', '<span style="color:#34c759;">URL 수집 완료 — ' + V._esc((_summarizeStageTrace(fd.stageTrace) || fd.method || '공통 파이프라인')) + '</span>');
            } catch (e) { V._addMsg('ai', '<span style="color:#ff3b30;">URL 가져오기 실패: ' + V._esc(e.message||e) + '</span>'); return null; }
          } else if (ch === '📺 YouTube 분석') {
            var ytUrl = await new Promise(function (r) {
              V._addMsg('ai', '분석할 YouTube URL 을 입력해주세요. (영상은 공개 상태여야 합니다)');
              var w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
              w.innerHTML = '<input type="text" id="vag-src-yt" placeholder="https://www.youtube.com/watch?v=..." style="flex:1;' + V._inputStyle() + '"><button id="vag-src-yt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff3b30;color:#fff;font-weight:700;cursor:pointer;">분석</button>';
              document.getElementById('vag-chat-body').appendChild(w);
              document.getElementById('vag-src-yt-go').onclick = function () { var v = document.getElementById('vag-src-yt').value.trim(); w.remove(); if (v) V._addMsg('user', v); r(v); };
            });
            if (!ytUrl) return null;
            V._addMsg('ai', '📺 YouTube 영상을 분석 중입니다... <span style="font-size:11px;color:rgba(0,0,0,0.4);">자막 또는 Gemini 가 화면 내용 요약</span>');
            try {
              var ytD = await window._VAGSource.analyzeYouTube(ytUrl, { timeoutMs: 90000 });
              if (ytD.ok && ytD.text && ytD.text.length >= 30) {
                sourceText = ytD.text;
                sourceTitle = ytD.title || ytUrl;
                V._addMsg('ai', '✅ YouTube 분석 완료 (' + ytD.text.length + '자 요약).');
              } else {
                V._addMsg('ai', '<span style="color:#ff3b30;">YouTube 분석 실패: ' + V._esc(ytD.error || ytD.detail || '결과가 비었음') + '</span>');
                return null;
              }
            } catch (e) { V._addMsg('ai', '<span style="color:#ff3b30;">YouTube 분석 오류: ' + V._esc(e.message||e) + '</span>'); return null; }
          } else if (ch === '📄 문서 업로드 (PDF · DOCX · TXT)') {
            var fileData = await new Promise(function (r) {
              var inp = document.createElement('input');
              inp.type = 'file';
              inp.accept = '.pdf,.docx,.doc,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
              inp.onchange = function () { var f = inp.files[0]; r(f || null); };
              inp.click();
            });
            if (!fileData) return null;
            V._addMsg('user', '📄 ' + fileData.name + ' (' + Math.round(fileData.size/1024) + 'KB)');
            V._addMsg('ai', '📄 문서에서 텍스트 추출 중입니다...');
            try {
              var docD = await window._VAGSource.parseDocument(fileData, { timeoutMs: 90000 });
              if (docD.ok && docD.text && docD.text.length >= 30) {
                sourceText = docD.text;
                sourceTitle = fileData.name;
                V._addMsg('ai', '✅ 문서 파싱 완료 (' + docD.text.length + '자 추출).');
              } else {
                V._addMsg('ai', '<span style="color:#ff3b30;">문서 파싱 실패: ' + V._esc(docD.error || '텍스트 추출 불가') + '</span>');
                return null;
              }
            } catch (e) { V._addMsg('ai', '<span style="color:#ff3b30;">문서 파싱 오류: ' + V._esc(e.message||e) + '</span>'); return null; }
          } else if (ch === '✏️ 직접 입력 (긴 텍스트)') {
            sourceText = await new Promise(function (r) {
              V._addMsg('ai', '자료 텍스트를 붙여넣어주세요. (Ctrl+Enter 로 확인)');
              var w = document.createElement('div'); w.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:4px 0;';
              w.innerHTML = '<textarea id="vag-src-txt" placeholder="자료 본문 ..." style="' + V._textareaStyle() + 'min-height:140px"></textarea>' +
                '<button id="vag-src-txt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer;align-self:flex-end;">↵ 확인</button>';
              document.getElementById('vag-chat-body').appendChild(w);
              document.getElementById('vag-src-txt').addEventListener('keydown', function(e){ if(e.ctrlKey && e.key==='Enter'){ document.getElementById('vag-src-txt-go').click(); } });
              document.getElementById('vag-src-txt-go').onclick = function () { var v = document.getElementById('vag-src-txt').value.trim(); w.remove(); if (v) V._addMsg('user', '자료 ' + v.length + '자 입력'); r(v); };
            });
          } else if (ch === '📷 이미지 첨부') {
            // 파일 선택 → dataURL 로 _vagAttachedImages 에 저장 → 주제는 사용자에게 묻기
            var dataUrl = await new Promise(function (r) {
              var inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
              inp.onchange = function () {
                var f = inp.files[0]; if (!f) { r(''); return; }
                var fr = new FileReader(); fr.onload = function(e){ r(e.target.result); }; fr.readAsDataURL(f);
              };
              inp.click();
            });
            if (!dataUrl) return null;
            V._vagAttachedImages.push({ dataUrl: dataUrl, name: '참고이미지' });
            V._vagSourceMode = '이미지 첨부';
            V._vagSourceContent = '첨부 이미지 중심으로 새 콘텐츠를 기획합니다. 이미지의 구도, 분위기, 대상, 제품 디테일을 우선 반영합니다.';
            V._addMsg('user', '🖼 이미지 첨부');
            V._addMsg('ai', '🖼 이미지 첨부됨 — 영상 기획에 참조됩니다. 이 이미지의 핵심 메시지/주제는?');
            return await new Promise(function (r) {
              var w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
              w.innerHTML = '<input type="text" id="vag-img-topic" placeholder="이미지 한 줄 주제" style="flex:1;' + V._inputStyle() + '"><button id="vag-img-topic-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer;">↵</button>';
              document.getElementById('vag-chat-body').appendChild(w);
              document.getElementById('vag-img-topic-go').onclick = function () { var v = document.getElementById('vag-img-topic').value.trim(); if (v) { w.remove(); r(v); } };
            });
          }
          if (!sourceText || sourceText.length < 30) {
            V._addMsg('ai', '<span style="color:#ff9500;">자료가 비었거나 너무 짧음 — 키워드 입력으로 돌아갑니다.</span>');
            return null;
          }
          // 자료 저장 → 자료 조사 단계 자동 스킵용
          V._vagSourceContent = sourceText;
          V._vagSourceMode = ch.replace(/^\W+\s*/, '');
          window._sharedSourceContent = sourceText;
          // 자료에서 주제 1줄 자동 추출
          V._addMsg('ai', '🧠 자료에서 영상 주제 자동 추출 중...');
          try {
            var ar = await fetch('/api/ce2/assist', {
              method: 'POST', headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                action: 'topics', mode: 'motion_video', count: 5,
                industry: (window._globalProfileData||{}).business_type||'',
                brand_name: brandName,
                brand_desc: (window._globalProfileData||{}).service_description||'',
                brand_biz_detail: ('자료:\n' + sourceText.slice(0, 3000))
              })
            });
            var ad = await ar.json();
            var topics = (ad.ok && ad.items) ? ad.items.slice(0, 5) : [];
            if (topics.length === 0) {
              V._addMsg('ai', '<span style="color:#ff9500;">주제 추출 실패 — 직접 입력해주세요</span>');
              return await new Promise(function (r) {
                var w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
                w.innerHTML = '<input type="text" id="vag-fallback-topic" placeholder="주제 한 줄" style="flex:1;' + V._inputStyle() + '"><button id="vag-fallback-topic-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer;">↵</button>';
                document.getElementById('vag-chat-body').appendChild(w);
                document.getElementById('vag-fallback-topic-go').onclick = function () { var v = document.getElementById('vag-fallback-topic').value.trim(); if (v) { w.remove(); r(v); } };
              });
            }
            V._addMsg('ai', '✨ 자료 기반 주제 후보 ' + topics.length + '개 — 골라주세요:');
            return await new Promise(function (r) { V._addOptions(topics, r); });
          } catch (e) {
            V._addMsg('ai', '<span style="color:#ff3b30;">주제 추출 실패: ' + V._esc(e.message||e) + '</span>');
            return null;
          }
        }
        // 누적 추천 풀 (다시 추천 시 중복 회피용)
        var _vagSeenTopics = new Set();
        async function _runTopicSuggest(round, angle) {
          var btnId = angle === 'trend' ? 'vag-chat-topic-trend'
                    : angle === 'review' ? 'vag-chat-topic-review'
                    : 'vag-chat-topic-ai';
          var btnOrig = angle === 'trend' ? '🔥 트렌드 기반'
                      : angle === 'review' ? '💬 리뷰에서'
                      : '🤖 AI가 찾아줘';
          var btnAi = document.getElementById(btnId);
          if (btnAi) { btnAi.disabled = true; btnAi.textContent = round > 1 ? '🔄 다시...' : '🔄 추천 중...'; }
          try {
            var bizDetail = (window._globalProfileData || {}).business_detail || '';
            if (angle === 'trend') {
              bizDetail += '\n\n[각도 지시: 최근 3~6개월 이슈·계절 트렌드·시사 키워드와 이 브랜드를 엮어 후크를 뽑아라. 계절·시기·사회 화두를 한 축으로 써라.]';
            } else if (angle === 'review') {
              bizDetail += '\n\n[각도 지시: 고객 리뷰·댓글·경험담에서 나올 법한 말투와 관점으로 훅을 구성해라. "왜 단골이 됐나", "어떤 순간에 감탄했나" 1인칭 증언 톤.]';
            }
            var r = await fetch('/api/ce2/assist', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'topics',
                mode: 'motion_video',
                count: 12,
                industry: (window._globalProfileData || {}).business_type || '',
                subtype: (window._globalProfileData || {}).business_subtype || '',
                brand_name: brandName,
                brand_desc: (window._globalProfileData || {}).service_description || '',
                brand_biz_detail: bizDetail,
                angle: angle || ''
              })
            });
            var d = await r.json();
            var raw = (d.ok && d.items) ? d.items : ['3초 안에 시선을 멈추게 하는 한 컷','왜 다들 여기로 다시 올까?','이거 모르고 사면 후회합니다','비포 → 애프터, 5초면 충분합니다','오늘만 알려드리는 진짜 이유','매일 100명이 선택한 단 하나'];
            var fresh = raw.filter(function (t) { return !_vagSeenTopics.has(t); }).slice(0, 8);
            if (fresh.length === 0) fresh = raw.slice(0, 8); // 모두 중복이면 그대로
            fresh.forEach(function (t) { _vagSeenTopics.add(t); });
            var angleLabel = angle === 'trend' ? '🔥 트렌드 기반 ' : angle === 'review' ? '💬 리뷰 기반 ' : 'AI ';
            V._addMsg('ai', (round > 1 ? '🔄 새 ' : '') + angleLabel + '추천 주제 ' + fresh.length + '개 — 선택하거나 다시 받아보세요.');
            V._addOptions(fresh.concat(['🔄 다른 추천 보기']), async function (sel) {
              if (sel === '🔄 다른 추천 보기') {
                var allOpts = body.querySelectorAll('.vag-chat-options');
                if (allOpts.length > 0) allOpts[allOpts.length - 1].remove();
                await _runTopicSuggest(round + 1, angle);
                return;
              }
              inputWrap.remove();
              resolve(sel);
            });
          } catch (e) {
            V._addMsg('ai', '<span style="color:#ff3b30;">추천 실패 — 직접 입력해주세요</span>');
            if (btnAi) { btnAi.disabled = false; btnAi.textContent = btnOrig; }
          }
        }
        var topicAiBtn = document.getElementById('vag-chat-topic-ai');
        var topicTrendBtn = document.getElementById('vag-chat-topic-trend');
        var topicReviewBtn = document.getElementById('vag-chat-topic-review');
        if (topicAiBtn) topicAiBtn.onclick = function () { _runTopicSuggest(1); };
        if (topicTrendBtn) topicTrendBtn.onclick = function () { _runTopicSuggest(1, 'trend'); };
        if (topicReviewBtn) topicReviewBtn.onclick = function () { _runTopicSuggest(1, 'review'); };
        // ⚡ 완전 자동 — 주제부터 최종 렌더까지 모든 질문을 AI 자동으로 통과
        document.getElementById('vag-chat-topic-auto').onclick = async function () {
          var btnAuto = this;
          btnAuto.disabled = true;
          btnAuto.textContent = '⚡ 주제 탐색 중...';
          // 프리셋 값 → 실제 값 / 라벨 매핑. 완전 자동 분기에서 이 값으로 질문 응답을 고정
          var prefAspect = (window._vagAutoPrefs && window._vagAutoPrefs.aspect) || '9:16';
          var prefLenLabel = (window._vagAutoPrefs && window._vagAutoPrefs.lengthLabel) || 'min1';
          var prefModel = (window._vagAutoPrefs && window._vagAutoPrefs.model) || 'gemini';
          var prefVoice = (window._vagAutoPrefs && typeof window._vagAutoPrefs.voice !== 'undefined') ? window._vagAutoPrefs.voice : 'gemini-Kore';
          var prefStepMode = (window._vagAutoPrefs && window._vagAutoPrefs.stepMode) === 'manual' ? 'manual' : 'auto';
          _vagCommitAutoOutputModeFromDOM();
          var manualStepMode = prefStepMode === 'manual';
          var sceneCountByLen = { sec15: 2, sec30: 4, sec45: 5, min1: 6, min2: 8, min3: 10, min5: 16, min10: 24 };
          var durationByLen = { sec15: 15, sec30: 30, sec45: 45, min1: 60, min2: 120, min3: 180, min5: 300, min10: 600 };
          var lengthLabelMap = { sec15: '15초', sec30: '30초', sec45: '45초', min1: '1분', min2: '2분', min3: '3분', min5: '5분', min10: '10분' };
          var voiceLabelMap = { '': '나레이션 없음' };
          (V._vagTTSVoices || []).forEach(function (voice) { voiceLabelMap[voice.value] = voice.label; });
          var modelLabelMap = {
            gemini: 'Gemini',
            codex: 'Codex CLI',
            kimi: 'Kimi CLI',
          };
          _atlasModels.forEach(function (model) { modelLabelMap['atlas:' + model.id] = 'Atlas Cloud · ' + model.label; });
          // 프리셋에서 고른 모델을 숨은 provider select 에 고정 — _doGenerate 가 이 값을 읽어 사용
          document.getElementById('vag-provider').value = prefModel;
          document.getElementById('vag-aspect').value = prefAspect;
          document.getElementById('vag-scene-count').value = String(sceneCountByLen[prefLenLabel] || 4);
          if (!V._vagSession) V._vagSession = {};
          V._vagSession.requestedDurationSec = durationByLen[prefLenLabel] || 60;
          V._vagSession.hyperDuration = durationByLen[prefLenLabel] || 60;
          document.getElementById('vag-voice').value = prefVoice || '';
          document.getElementById('vag-auto-narration').checked = !!prefVoice;
          var prefAiBgVideo = _vagNormalizeBackgroundImageMode((window._vagAutoPrefs && window._vagAutoPrefs.aiBgVideo) || _vagDefaultBackgroundImageMode());
          var prefOutputMode = ['motion', 'image-only', 'image-video-hyperframes'].indexOf((window._vagAutoPrefs && window._vagAutoPrefs.outputMode) || '') >= 0 ? window._vagAutoPrefs.outputMode : 'image-video-hyperframes';
          var prefMotionFrameMode = (window._vagAutoPrefs && window._vagAutoPrefs.motionFrameMode) || 'dynamic';
            var prefAiBgImageModel = _bgImageModelForMode(prefAiBgVideo);
            var prefAiBgVideoModel = /^image-video/.test(prefOutputMode) ? ((window._vagAutoPrefs && window._vagAutoPrefs.videoModel) || _vagDefaultVideoModel()) : '';
            var prefI2VDirection = /^image-video/.test(prefOutputMode)
              ? _vagApplyI2VDirectionToSession(_vagCurrentI2VRecommendation())
              : null;
            if (!prefI2VDirection && V._vagSession) V._vagSession.imageVideoDirection = null;
          var prefOutputEl = document.getElementById('vag-output-mode');
          var bgEl = document.getElementById('vag-ai-bg-video');
          var bgModelEl = document.getElementById('vag-ai-bg-video-model');
          var imgProviderEl = document.getElementById('vag-bg-image-provider');
          var imgModelEl = document.getElementById('vag-bg-image-model');
          if (prefOutputEl) prefOutputEl.value = prefOutputMode;
          if (bgEl) bgEl.value = prefAiBgVideo;
          if (bgModelEl) bgModelEl.value = prefAiBgVideoModel;
          if (imgProviderEl) imgProviderEl.value = _vagImageProviderForMode(prefAiBgVideo);
          if (imgModelEl) imgModelEl.value = prefAiBgImageModel;
          var aspectAnswer = prefAspect === '1:1' ? '1:1 정사각' : prefAspect === '16:9' ? '16:9 가로' : '9:16 세로 (릴스/숏츠)';
          // fullAuto 플래그 + 프리셋 저장 — 이후 _addOptions / _vagAutoPickOption 에서 참조
          window._vagAutoChoices = Object.assign({}, window._vagAutoChoices || {}, {
            fullAuto: true,
            pauseForManualOption: manualStepMode,
            manualStepMode: manualStepMode,
            forcedAspect: aspectAnswer,
            forcedModel: prefModel,
            forcedLenLabel: prefLenLabel,
            forcedVoice: prefVoice,
            aiBgVideo: prefAiBgVideo,
              outputMode: prefOutputMode,
              videoModel: prefAiBgVideoModel,
              imageModel: prefAiBgImageModel,
              motionFrameMode: prefMotionFrameMode,
              i2vCutDirection: prefI2VDirection ? prefI2VDirection.cut : '',
              i2vCutLabel: prefI2VDirection ? prefI2VDirection.cutLabel : '',
              i2vVibe: prefI2VDirection ? prefI2VDirection.vibe : '',
              i2vVibeLabel: prefI2VDirection ? prefI2VDirection.vibeLabel : '',
            });
          V._addMsg('ai', (manualStepMode ? '🧭 <b>단계별 확인 모드</b>' : '⚡ <b>자동 진행 모드</b>') + ' — 비율 <b>' + prefAspect + '</b>, 길이 <b>' + (lengthLabelMap[prefLenLabel] || '1분') + '</b>, 목소리 <b>' + (voiceLabelMap[prefVoice] || voiceLabelMap['gemini-Kore']) + '</b> 기준으로 장면 준비를 시작합니다.');
          // 우선순위:
          //   (0) 완전 자동 카드 내부 소재 입력란(textarea) 에 본문이 있으면 최우선 — 그 소재로 주제 추출
          //   (1) 이미 수집된 소재(_vagSourceContent) 가 있으면 그 내용을 원천으로 사용하고, AI 가 주제 추출
          //   (2) 키워드 입력이 있으면 그 주제로
          //   (3) 아무 것도 없으면 AI 추천 첫 번째
          var userTyped = (document.getElementById('vag-auto-topic-input') || {}).value || (document.getElementById('vag-chat-topic-input') || {}).value || '';
          userTyped = String(userTyped).trim();
          var cardSrc = typeof V._vagSyncSourceInputFromDOM === 'function'
            ? V._vagSyncSourceInputFromDOM('완전자동 소재 입력')
            : String((document.getElementById('vag-auto-source-input') || {}).value || '').trim();
          // (0) 카드 내 소재 입력란 최우선
          if (cardSrc.length > 0) {
            V._vagSourceContent = cardSrc.slice(0, 12000);
            V._vagSourceMode = '완전자동 소재 입력';
            window._sharedSourceContent = V._vagSourceContent;
            V._addMsg('ai', '📎 <b>소재 입력 감지</b> (' + V._vagSourceContent.length + '자) — 이 소재를 기반으로 주제를 뽑아 영상을 만듭니다.');
          }
          if (cardSrc.length >= 12) {
            try {
              var csR = await fetch('/api/ce2/assist', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'topics', mode: 'motion_video', count: 5,
                  industry: (window._globalProfileData || {}).business_type || '',
                  subtype: (window._globalProfileData || {}).business_subtype || '',
                  brand_name: brandName,
                  brand_desc: (window._globalProfileData || {}).service_description || '',
                  brand_biz_detail: (userTyped ? '키워드 우선: ' + userTyped + '\n\n' : '') + '수집한 소재 기반:\n' + V._vagSourceContent.slice(0, 4000),
                }),
              });
              var csD = await csR.json();
              var csTopic = (csD.ok && Array.isArray(csD.items) && csD.items.length)
                ? csD.items[0]
                : (userTyped || (brandName ? (brandName + ' 소개 숏폼') : '소재 기반 숏폼'));
              V._addMsg('ai', '⚡ 소재 기반 주제: <b>' + V._esc(csTopic) + '</b>');
              inputWrap.remove();
              body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
              resolve(csTopic);
              return;
            } catch (csErr) {
              V._addMsg('ai', '<span style="color:#ff9500;">⚠ 소재 기반 주제 추출 실패 — ' + V._esc(csErr.message || csErr) + '. 키워드/추천으로 폴백합니다.</span>');
            }
          }
          // (1) 외부에서 이미 수집된 소재
          if (typeof V._vagSourceContent !== 'undefined' && V._vagSourceContent && String(V._vagSourceContent).trim().length > 0) {
            V._addMsg('ai', '⚡ 이미 수집된 소재(' + String(V._vagSourceContent).length + '자) 를 기준으로 주제를 추출합니다...');
            try {
              var srcR = await fetch('/api/ce2/assist', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'topics', mode: 'motion_video', count: 5,
                  industry: (window._globalProfileData || {}).business_type || '',
                  subtype: (window._globalProfileData || {}).business_subtype || '',
                  brand_name: brandName,
                  brand_desc: (window._globalProfileData || {}).service_description || '',
                  brand_biz_detail: '수집한 소재 기반으로 주제를 뽑을 것:\n' + String(V._vagSourceContent).slice(0, 4000),
                }),
              });
              var srcD = await srcR.json();
              var srcTopic = (srcD.ok && Array.isArray(srcD.items) && srcD.items.length)
                ? srcD.items[0]
                : (userTyped || (brandName ? (brandName + ' 소개 숏폼') : '브랜드 소개 숏폼'));
              V._addMsg('ai', '⚡ 소재 기반 주제: <b>' + V._esc(srcTopic) + '</b>');
              inputWrap.remove();
              body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
              resolve(srcTopic);
              return;
            } catch (srcErr) {
              V._addMsg('ai', '<span style="color:#ff9500;">⚠ 소재 기반 주제 추출 실패 — ' + V._esc(srcErr.message || srcErr) + '. 기본 주제로 진행합니다.</span>');
              // fallthrough 로 (2)·(3) 로 진행
            }
          }
          // (2) 키워드 입력이 있으면 그 주제로
          if (userTyped.length >= 2) {
            V._addMsg('ai', '⚡ 사용자 지정 주제로 진행: <b>' + V._esc(userTyped) + '</b>');
            inputWrap.remove();
            body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
            resolve(userTyped);
            return;
          }
          try {
            // 1) AI 추천 주제 자동 조회 (motion_video 모드) → 첫 번째 선택
            var bizDetail = (window._globalProfileData || {}).business_detail || '';
            var r = await fetch('/api/ce2/assist', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'topics', mode: 'motion_video', count: 8,
                industry: (window._globalProfileData || {}).business_type || '',
                subtype: (window._globalProfileData || {}).business_subtype || '',
                brand_name: brandName,
                brand_desc: (window._globalProfileData || {}).service_description || '',
                brand_biz_detail: bizDetail,
              }),
            });
            var d = await r.json();
            var chosen = '';
            if (d.ok && Array.isArray(d.items) && d.items.length > 0) {
              chosen = d.items[0];
              V._addMsg('ai', '⚡ 자동 선택 주제: <b>' + V._esc(chosen) + '</b>');
            } else {
              chosen = brandName ? (brandName + ' 소개 숏폼') : '브랜드 소개 숏폼';
              V._addMsg('ai', '⚡ 추천 API 응답 부족 — 기본 주제로 진행: <b>' + V._esc(chosen) + '</b>');
            }
            inputWrap.remove();
            body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
            resolve(chosen);
          } catch (e) {
            V._addMsg('ai', '<span style="color:#ff3b30;">⚠ 자동 주제 조회 실패: ' + V._esc(e.message || e) + ' — 기본 주제로 진행합니다.</span>');
            inputWrap.remove();
            resolve(brandName ? (brandName + ' 소개 숏폼') : '브랜드 소개 숏폼');
          }
        };
      });
      document.getElementById('vag-topic').value = topic;
      V._vagPersistState('topic', 'planning', { topic: topic }, 'topic_selected', { topic: topic });

      await V._vagShowProgress('주제를 바탕으로 생성 방향을 정리하는 중...', 450);

      var objective, tone;
      if (window._vagAutoChoices && window._vagAutoChoices.objective) {
        objective = window._vagAutoChoices.objective;
        V._addMsg('ai', '⚡ 목적 자동 결정: <b>' + objective + '</b> (URL 감지)');
      } else {
        var inferredObjective = typeof V._vagInferObjectiveFromContext === 'function'
          ? V._vagInferObjectiveFromContext({
              topic: topic,
              source: V._vagSourceContent || '',
              sourceMode: V._vagSourceMode || '',
              profile: window._globalProfileData || {},
            })
          : { objective: '서비스 소개', reason: '주제 기반 자동 판단' };
        objective = inferredObjective.objective || '서비스 소개';
        V._addMsg('ai', '🎯 목적 자동 결정: <b>' + V._esc(objective) + '</b><br><span style="font-size:11px;color:rgba(0,0,0,0.5);">주제·첨부소재·프로필 업종을 기준으로 판단했습니다' + (inferredObjective.reason ? ' · ' + V._esc(inferredObjective.reason) : '') + '. 목적 수동 선택은 사용하지 않습니다.</span>', { html: true });
      }

      if (window._vagAutoChoices && window._vagAutoChoices.tone) {
        tone = window._vagAutoChoices.tone;
        V._addMsg('ai', '⚡ 톤 자동 결정: <b>' + tone + '</b> (URL 감지)');
      } else {
        V._addMsg('ai', '💡 <b>영상 분위기는 어떻게 할까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">잘 모르겠으면 AI 자동을 고르세요. 주제와 브랜드를 보고 색감, 글자 느낌, 화면 속도를 정합니다.</span>');
        tone = await new Promise(function (resolve) {
          V._addOptions(['AI 자동', '직설', '긴급', '감성', '프리미엄', '트렌디'], resolve);
        });
        if (tone === 'AI 자동') tone = '';
      }

      // 💡 CTA 선택
      const _prof = window._globalProfileData || {};
      const _contact = (_prof.contact || '').trim();
      const _website = (_prof.website || '').trim();

      var cta = '';
      var ctaOptions = ['지금 구매', '지금 예약', '상담 문의', '방문 유도', '팔로우', '직접 입력', 'CTA 생략'];
      if (window._vagAutoChoices && window._vagAutoChoices.ctaUrl) ctaOptions.unshift('상품 URL CTA 사용');
      if (_contact || _website) ctaOptions.splice(ctaOptions.length - 1, 0, '프로필 연락처 CTA 사용');
      V._addMsg('ai',
        '💡 <b>마지막 CTA를 고르세요</b><br>' +
        '<span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">여기서 한 번만 선택합니다. 생략하면 마지막 씬도 행동 유도 없이 마무리합니다.</span>',
        { html: true }
      );
      var ctaBase = await new Promise(function (resolve) {
        V._addOptions(ctaOptions, resolve);
      });
      if (ctaBase === '직접 입력') {
        V._addMsg('ai', 'CTA 문구를 직접 입력해주세요 (예: "지금 바로 02-1234-5678 로 전화")');
        cta = await new Promise(function (resolve) {
          var body = document.getElementById('vag-chat-body');
          var wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
          wrap.innerHTML = '<input type="text" id="vag-cta-direct" placeholder="예: 지금 예약 · 02-1234-5678" style="flex:1;' + V._inputStyle() + '" onkeydown="if(event.key===\'Enter\'){event.preventDefault();document.getElementById(\'vag-cta-direct-go\').click();}"><button id="vag-cta-direct-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">확인</button>';
          body.appendChild(wrap);
          document.getElementById('vag-cta-direct-go').onclick = function () {
            var v = document.getElementById('vag-cta-direct').value.trim();
            wrap.remove(); V._addMsg('user', v || '(생략)'); resolve(v);
          };
        });
      } else if (ctaBase === '상품 URL CTA 사용') {
        cta = '지금 구매 · ' + (window._vagAutoChoices && window._vagAutoChoices.ctaUrl ? window._vagAutoChoices.ctaUrl : '');
      } else if (ctaBase === '프로필 연락처 CTA 사용') {
        cta = ['상담 문의', _contact, _website].filter(Boolean).join(' · ');
      } else if (ctaBase === 'CTA 생략') {
        V._addMsg('ai', '좋아요. 이번 영상은 CTA 없이 구성합니다.');
      } else {
        cta = ctaBase || '';
      }
      const ctaEl = document.getElementById('vag-cta-input');
      if (ctaEl) ctaEl.value = cta || '';
      V._vagPersistState('brief', 'planning', {
        topic: topic,
        objective: objective,
        tone: tone,
        cta: cta || '',
      }, 'brief_locked', {
        objective: objective,
        tone: tone,
        cta: cta || '',
      });

      // 🏷 로고 첨부 여부
      V._addMsg('ai', '💡 <b>브랜드 로고도 이미지 만들 때 참고할까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">프로필에 저장된 로고를 참고해 장면 이미지를 만듭니다.</span>');
      const currentProfileId = parseInt(window._globalProfileId || 0, 10) || 0;
      const profileName = (window._globalProfileData || {}).name || '';
      const logoOpts = [];
      if (currentProfileId) logoOpts.push(`🏷 현재 프로필 로고 사용 (${profileName || 'ID ' + currentProfileId})`);
      logoOpts.push('📁 파일 업로드');
      logoOpts.push('로고 없이 진행');
      var useLogo = await new Promise(function (resolve) {
        V._addOptions(logoOpts, resolve);
      });
      if (useLogo.startsWith('🏷 현재 프로필')) {
        // 프로필 로고 가져와서 dataURL 로 변환
        // 1차: /api/library/profiles/{id}/logo  (DB 의 logo_path 를 그대로 서빙 — 확장자 무관)
        // 2차: /api/library/image/{id}/logo.png (레거시 · 확장자가 png 인 경우만 성공)
        try {
          V._addMsg('ai', '프로필 로고를 불러옵니다...');
          var _logoCandidates = _vagBuildProfileLogoCandidates(currentProfileId, window._globalProfileData || {});
          var _logoResult = null;
          var _triedUrls = [];
          for (var _li = 0; _li < _logoCandidates.length; _li++) {
            _triedUrls.push(_logoCandidates[_li]);
            try {
              _logoResult = await _vagFetchLogoAsDataUrl(_logoCandidates[_li]);
              break;
            } catch (_lerr) { /* 다음 후보 시도 */ }
          }
          if (_logoResult && _logoResult.dataUrl) {
            V._vagLogoDataUrl = _logoResult.dataUrl;
            // 세션에도 저장 — 배경 이미지 생성 reference 로만 활용
            if (!V._vagSession) V._vagSession = {};
            V._vagSession.logoDataUrl = _logoResult.dataUrl;
            if (typeof V._vagRegisterLogoReferenceDataUrl === 'function') {
              V._vagRegisterLogoReferenceDataUrl(_logoResult.dataUrl, '프로필 로고');
            }
            const badge = document.getElementById('vag-logo-badge');
            if (badge) badge.textContent = '로고 ✓';
            console.info('[VAG] logo fetched OK url=' + _logoResult.url + ' size=' + _logoResult.size + ' type=' + _logoResult.type);
            V._addMsg('ai', `✅ 프로필 로고를 불러왔습니다.<br><span style="font-size:10px;color:rgba(0,0,0,0.42);">경로: ${V._esc(_logoResult.url)}</span>`);
          } else {
            console.warn('[VAG] logo fetch failed. Tried:', _triedUrls);
            V._addMsg('ai', '<span style="color:#ff9500;">⚠ 프로필에 로고 이미지가 없습니다 — 로고 없이 진행합니다.<br><span style="font-size:10px;">시도한 경로: ' + _triedUrls.map(function (u) { return V._esc(u); }).join(', ') + '<br>라이브러리 → 프로필 편집에서 로고를 업로드해주세요.</span></span>');
          }
        } catch (e) {
          V._addMsg('ai', `<span style="color:#ff3b30;">프로필 로고 불러오기 실패: ${V._esc(e.message||e)}</span>`);
        }
      } else if (useLogo === '📁 파일 업로드') {
        document.getElementById('vag-logo-input').click();
        V._addMsg('ai', '파일 선택 창에서 로고를 고르세요. (이미지 하나)');
        await new Promise(r => {
          const chk = setInterval(() => { if (V._vagLogoDataUrl) { clearInterval(chk); r(); } }, 400);
          setTimeout(() => { clearInterval(chk); r(); }, 30000);
        });
        V._addMsg('ai', V._vagLogoDataUrl ? '✅ 로고를 이미지 만들 때 참고하도록 연결했습니다. 영상 위에는 따로 붙이지 않습니다.' : '로고 없이 진행합니다.');
      }

      // 🎨 브랜드 색 — 프로필에 있으면 묻지 않고 고정. 브랜드 디자인은 항상 유지한다.
      var profileBrandColor = _vagResolveProfileBrandColor(window._globalProfileData || {});
      var rawProfileColor = String((window._globalProfileData || {}).brand_color || (window._globalProfileData || {}).main_color || '').trim().toUpperCase();
      var brandColor = '';
      if (profileBrandColor) {
        brandColor = profileBrandColor;
        V._addMsg('ai', '🎨 프로필 브랜드 색 <b>' + brandColor + '</b>을 고정 적용합니다. 브랜드 디자인은 모든 씬에서 유지됩니다.');
      } else if (rawProfileColor === '#000000') {
        // 안내만 — 프로필에 default 검정으로 등록되어 있어 의미 없음
        V._addMsg('ai', '<span style="font-size:11px;color:rgba(0,0,0,0.5);">ℹ️ 프로필에 브랜드색이 #000000(검정)으로 등록되어 있어 프리셋에서 선택해주세요. <a href="javascript:void(0)" onclick="(window.openProfileEditor||function(){alert(\'라이브러리 → 프로필 편집에서 브랜드색을 변경할 수 있습니다.\')})()" style="color:#ff8c00;">프로필 편집</a></span>');
      }
      if (!brandColor) {
        V._addMsg('ai', '💡 <b>브랜드 색상이 프로필에 없어요.</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">브랜드 디자인 유지를 위해 이번 영상에 쓸 메인 색상을 정합니다. 가능하면 프로필에도 저장해 주세요.</span>');
        var brandColorOpts = ['🟧 강조색 #FF8C00', '🟦 블루 #007AFF', '🟢 그린 #34C759', '🟣 퍼플 #5856D6',
          '🌸 핑크 #FF2D55', '🟡 골드 #FFD60A', '⚫ 모노 #1C1C1E', '🎨 직접 입력 (HEX)'];
        var brandColorChoice = await new Promise(function (resolve) { V._addOptions(brandColorOpts, resolve); });
        if (brandColorChoice.indexOf('🎨 직접') === 0) {
          brandColor = await new Promise(function (resolve) {
            V._addMsg('ai', 'HEX 색상 코드를 입력해주세요 (예: #FF8C00)');
            var w = document.createElement('div'); w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = '<input type="color" id="vag-brand-color-pick" value="#FF8C00" style="width:50px;height:36px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;cursor:pointer;">' +
              '<input type="text" id="vag-brand-color-hex" placeholder="#FF8C00" value="#FF8C00" style="flex:1;' + V._inputStyle() + '">' +
              '<button id="vag-brand-color-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff6b00;color:#fff;font-weight:700;cursor:pointer;">↵</button>';
            document.getElementById('vag-chat-body').appendChild(w);
            var pick = document.getElementById('vag-brand-color-pick'), hex = document.getElementById('vag-brand-color-hex');
            pick.oninput = function () { hex.value = pick.value.toUpperCase(); };
            hex.oninput = function () { if (/^#[0-9A-Fa-f]{6}$/.test(hex.value)) pick.value = hex.value; };
            document.getElementById('vag-brand-color-go').onclick = function () { var v = (hex.value || '').trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) { w.remove(); resolve(v); } };
          });
        } else {
          var m = brandColorChoice.match(/#([0-9A-Fa-f]{6})/);
          brandColor = m ? '#' + m[1].toUpperCase() : '';
        }
      }
      if (brandColor) {
        V._addMsg('ai', '🎨 브랜드 색 <b>' + brandColor + '</b> 적용 — 모든 씬의 액센트로 사용됩니다.');
        if (V._vagSession) V._vagSession.brandColor = brandColor;
        else V._vagSession = { brandColor: brandColor };
      }
      await _vagChooseVisualConcept(topic, objective, tone);
      await _vagChooseCampaignModel(topic, objective);

      // 📎 참고 이미지 첨부 여부
      V._addMsg('ai', '💡 <b>참고할 사진이 있나요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">사진이 있으면 AI가 색감과 구도를 보고 영상 분위기에 맞춥니다. 없으면 건너뛰어도 됩니다.</span>');
      var useRefImg = await new Promise(function (resolve) {
        V._addOptions(['이미지 첨부', '건너뛰기'], resolve);
      });
      if (useRefImg === '이미지 첨부') {
        document.getElementById('vag-image-input').click();
        V._addMsg('ai', '이미지 여러 장 선택 가능합니다.');
        await new Promise(r => {
          const chk = setInterval(() => { if (V._vagAttachedImages.length) { clearInterval(chk); r(); } }, 400);
          setTimeout(() => { clearInterval(chk); r(); }, 30000);
        });
        V._addMsg('ai', `✅ 이미지 ${V._vagAttachedImages.length}장 첨부됨.`);
      }
      await _vagEnsureProductAssets(topic, objective);

      // ⚙ 엔진 선택
      V._addMsg('ai', '💡 <b>어떤 AI로 만들까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">잘 모르겠으면 Gemini를 고르세요. 선택한 AI가 장면과 문구를 만듭니다.</span>');
      var engineChoice = await new Promise(function (resolve) {
        V._addOptions([
          'Gemini',
          'CLI · Codex',
          'CLI · Kimi',
          'Atlas Cloud',
        ], resolve);
      });
      var engineMap = {
        'Gemini': 'gemini',
        'CLI · Codex': 'codex',
        'CLI · Kimi': 'kimi',
      };
      if (engineChoice === 'Atlas Cloud') {
        var atlasChoice = await new Promise(function (resolve) {
          var body = document.getElementById('vag-chat-body');
          var w = document.createElement('div');
          w.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 0;flex-wrap:wrap;';
          var fallbackAtlas = [
            { id: 'openai/gpt-5.5', label: 'GPT 5.5' },
            { id: 'anthropic/claude-opus-4.7', label: 'Claude Opus 4.7' },
            { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6' },
            { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
            { id: 'qwen/qwen3-max-2026-01-23', label: 'Qwen3 Max' },
          ];
          var opts = fallbackAtlas.map(function (row) { return '<option value="atlas:' + row.id + '">' + row.label + '</option>'; }).join('');
          w.innerHTML = '<select id="vag-manual-atlas-model" style="flex:1;min-width:260px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,140,0,0.25);background:#fff;font-size:12px;font-weight:700;">' + opts + '</select>' +
            '<button id="vag-manual-atlas-go" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">선택</button>';
          body.appendChild(w);
          (async function () {
            var select = document.getElementById('vag-manual-atlas-model');
            if (!select) return;
            try {
              var resp = await fetch('/api/atlas/models');
              var data = await resp.json();
              var items = data && Array.isArray(data.items) ? data.items : [];
              if (!resp.ok || !items.length) return;
              select.innerHTML = items.map(function (model) {
                var id = String(model.id || '').trim();
                if (!id) return '';
                var label = String(model.label || id).trim();
                var tags = Array.isArray(model.tags) && model.tags.length ? ' · ' + model.tags.slice(0, 2).join(', ') : '';
                return '<option value="atlas:' + id + '">' + label + tags + '</option>';
              }).filter(Boolean).join('');
            } catch (_) {}
          })();
          document.getElementById('vag-manual-atlas-go').onclick = function () {
            var select = document.getElementById('vag-manual-atlas-model');
            var selected = select ? select.value : 'atlas:openai/gpt-5.5';
            var selectedText = select && select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : selected;
            w.remove();
            V._addMsg('user', 'Atlas Cloud · ' + selectedText);
            resolve(selected);
          };
        });
        document.getElementById('vag-provider').value = atlasChoice || 'atlas:openai/gpt-5.5';
      } else {
        document.getElementById('vag-provider').value = engineMap[engineChoice] || 'gemini';
      }

      V._addMsg('ai', '배경 이미지는 어떤 AI로 만들까요? <span style="font-size:11px;color:rgba(0,0,0,0.45);">배경 이미지는 항상 먼저 만듭니다. 잘 모르겠으면 기본 선택을 쓰면 됩니다.</span>', { html: true });
      var bgVideoChoice = await new Promise(function (resolve) {
        V._addOptions([
          'AI 자동 선택 · Gemini/CLI 우선',
          'Atlas OpenAI Image 2 Edit 참고 이미지 (추천)',
          'Codex CLI 직접 이미지 생성',
          'Atlas Qwen 상품 이미지 에디터',
          '나노바나나2 이미지 생성 (기본)',
          '나노바나나2 참고 이미지 생성',
          'Atlas Qwen Image 2.0 Pro Edit',
          '나노바나나2 텍스트 이미지 생성',
        ], resolve);
      });
      var bgVideoMap = {
        'AI 자동 선택 · Gemini/CLI 우선': { mode: 'auto', model: '' },
        'Atlas OpenAI Image 2 Edit 참고 이미지 (추천)': { mode: 'gpt-image-2-edit', model: VAG_ATLAS_GPT_IMAGE2_EDIT },
        'Codex CLI 직접 이미지 생성': { mode: 'codex-cli', model: 'codex-cli' },
        'Atlas Qwen 상품 이미지 에디터': { mode: 'qwen-product-edit', model: 'alibaba/qwen-image/edit-plus-20251215' },
        '나노바나나2 이미지 생성 (기본)': { mode: 'scene-image', model: '' },
        '나노바나나2 참고 이미지 생성': { mode: 'nano-banana-2-edit', model: '' },
        'Atlas Qwen Image 2.0 Pro Edit': { mode: 'qwen-image-2-pro-edit', model: 'qwen/qwen-image-2.0-pro/edit' },
        '나노바나나2 텍스트 이미지 생성': { mode: 'nano-banana-2-text', model: '' },
      };
      var bgVideoPicked = bgVideoMap[bgVideoChoice] || bgVideoMap['AI 자동 선택 · Gemini/CLI 우선'];
      var bgVideoEl = document.getElementById('vag-ai-bg-video');
      var bgVideoModelEl = document.getElementById('vag-ai-bg-video-model');
      var bgImageProviderEl = document.getElementById('vag-bg-image-provider');
      var bgImageModelEl = document.getElementById('vag-bg-image-model');
      if (bgVideoEl) bgVideoEl.value = bgVideoPicked.mode;
      if (bgVideoModelEl) bgVideoModelEl.value = bgVideoPicked.model;
      if (bgImageProviderEl) bgImageProviderEl.value = _vagImageProviderForMode(bgVideoPicked.mode);
      if (bgImageModelEl) bgImageModelEl.value = _bgImageModelForMode(bgVideoPicked.mode);
      if (bgVideoPicked.mode !== 'none') {
        var bgCandidateEl = document.getElementById('vag-bg-image-candidates');
        if (bgCandidateEl) bgCandidateEl.value = '1';
      }
      V._addMsg('ai', '배경 이미지를 움직이는 영상으로 바꿀까요? <span style="font-size:11px;color:rgba(0,0,0,0.45);">먼저 만든 배경 이미지를 그대로 쓸지, 짧게 움직이게 만들지 고릅니다.</span>',
        { html: true });
      var videoModeChoice = await new Promise(function (resolve) {
        var videoOptions = ['배경 이미지를 짧은 영상으로 바꾼 뒤 문구 넣기', '배경 이미지는 그대로 쓰고 문구 넣기', '배경 이미지만 만들기'];
        V._addOptions(videoOptions, resolve);
      });
      var outputModeEl = document.getElementById('vag-output-mode');
      if (videoModeChoice === '배경 이미지만 만들기' || videoModeChoice === '배경 컨셉 이미지만 만들기') {
        if (outputModeEl) outputModeEl.value = 'image-only';
        if (bgVideoModelEl) bgVideoModelEl.value = '';
      } else if (videoModeChoice === '배경 이미지 + HyperFrames 모션' || videoModeChoice === '배경 컨셉 이미지 + HyperFrames 모션' || videoModeChoice === '배경 이미지 위에 문구/움직임 넣기' || videoModeChoice === '배경 이미지는 그대로 쓰고 문구 넣기') {
        if (outputModeEl) outputModeEl.value = 'motion';
        if (bgVideoModelEl) bgVideoModelEl.value = '';
      } else if (videoModeChoice === '배경 이미지를 영상화 + HyperFrames 합성' || videoModeChoice === '배경 이미지를 영상으로 + HyperFrames 합성' || videoModeChoice === '배경 이미지를 짧은 영상으로 움직이기' || videoModeChoice === '배경 이미지를 짧은 영상으로 바꾼 뒤 문구 넣기') {
        if (outputModeEl) outputModeEl.value = 'image-video-hyperframes';
        if (bgVideoModelEl) bgVideoModelEl.value = VAG_CHEAP_IMAGE_VIDEO_MODEL;
      } else {
        if (outputModeEl) outputModeEl.value = 'image-video-hyperframes';
        if (bgVideoModelEl) bgVideoModelEl.value = VAG_CHEAP_IMAGE_VIDEO_MODEL;
      }
      var selectedOutputMode = (outputModeEl && outputModeEl.value) || 'image-video-hyperframes';
      if (!window._vagAutoPrefs) window._vagAutoPrefs = {};
      window._vagAutoPrefs.outputMode = selectedOutputMode;
      if (!V._vagSession) V._vagSession = {};
      V._vagSession.outputMode = selectedOutputMode;
      if (selectedOutputMode !== 'motion' && bgVideoPicked.mode === 'none') {
        bgVideoPicked = bgVideoMap['나노바나나2 이미지 생성 (기본)'];
        if (bgVideoEl) bgVideoEl.value = bgVideoPicked.mode;
        if (bgImageProviderEl) bgImageProviderEl.value = _vagImageProviderForMode(bgVideoPicked.mode);
        if (bgImageModelEl) bgImageModelEl.value = _bgImageModelForMode(bgVideoPicked.mode);
        V._addMsg('ai', '이 방식은 장면 이미지가 꼭 필요해서 기본 이미지 AI를 켰습니다. 먼저 이미지를 만든 뒤 고른 이미지로 영상을 만듭니다.', { html: true });
        }
        if (bgVideoModelEl && !/^image-video/.test(selectedOutputMode)) bgVideoModelEl.value = '';
        if (!/^image-video/.test(selectedOutputMode) && V._vagSession) {
          V._vagSession.imageVideoDirection = null;
        }

        // 📏 길이 선택 — 1분 이하 숏폼부터 10분 장편까지 명시 선택
      V._addMsg('ai', '💡 <b>영상 길이</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">왜 물어봐요: 15초 짧은 광고부터 최대 10분 장편까지 제작할 수 있습니다.<br>15~45초 = 숏폼 광고 / 1~2분 = 핵심 메시지 확장형 / 3분 이상 = 챕터형 설명 영상</span>');
      var lenChoice = await new Promise(function (resolve) {
        V._addOptions([
          '⚡ 15초 숏폼',
          '⚡ 30초 숏폼',
          '⚡ 45초 숏폼',
          '📱 풀 1분 (60초)',
          '📱 풀 2분 (120초)', '📜 장편 3분', '📜 장편 5분',
          '📜 장편 10분',
        ], resolve);
      });
      // 일반 모션: 핵심 메시지 중심으로 장면 수를 줄이고, 3분 이상만 chapter 모드
      var shortMap = {
        '⚡ 15초 숏폼': { sc: 2, duration: 15, mode: 'short' },
        '⚡ 30초 숏폼': { sc: 2, duration: 30, mode: 'short' },
        '⚡ 45초 숏폼': { sc: 3, duration: 45, mode: 'short' },
        '📱 풀 1분 (60초)': { sc: 4, duration: 60, mode: 'short' },
        '📱 풀 2분 (120초)': { sc: 6, duration: 120, mode: 'short' },
      };
      var longMap = {
        '📜 장편 3분': '180', '📜 장편 5분': '300',
        '📜 장편 10분': '600',
      };
      if (shortMap[lenChoice]) {
        document.getElementById('vag-mode').value = shortMap[lenChoice].mode;
        document.getElementById('vag-scene-count').value = String(shortMap[lenChoice].sc);
        if (V._vagSession) {
          V._vagSession.requestedDurationSec = shortMap[lenChoice].duration;
          V._vagSession.hyperDuration = shortMap[lenChoice].duration;
          V._vagSession.lengthChoice = lenChoice;
        }
      } else {
        document.getElementById('vag-mode').value = longMap[lenChoice] || 'short';
        if (V._vagSession) {
          V._vagSession.requestedDurationSec = parseInt(longMap[lenChoice] || '0', 10) || 0;
          V._vagSession.hyperDuration = V._vagSession.requestedDurationSec || V._vagSession.hyperDuration;
          V._vagSession.lengthChoice = lenChoice;
        }
      }

      // 🎙 나레이션 여부
      V._addMsg('ai', '💡 <b>AI 목소리를 넣을까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">켜면 장면 문구를 목소리로 읽어줍니다. 끄면 화면 글자만 들어갑니다.</span>');
      var narrChoice = await new Promise(function (resolve) {
        V._addOptions(['나레이션 ON', '나레이션 OFF'], resolve);
      });
      document.getElementById('vag-auto-narration').checked = (narrChoice === '나레이션 ON');
      if (narrChoice === '나레이션 ON') {
        V._addMsg('ai', '🎙 <b>어떤 목소리로 읽을까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">영상 분위기에 맞는 목소리를 고르세요.</span>');
        var voiceChoice = await new Promise(function (resolve) {
          V._addOptions((V._vagTTSVoices || []).map(function (voice) { return voice.label; }), resolve);
        });
        var voiceMap = {};
        (V._vagTTSVoices || []).forEach(function (voice) { voiceMap[voice.label] = voice.value; });
        document.getElementById('vag-voice').value = voiceMap[voiceChoice] || 'gemini-Kore';
      } else {
        document.getElementById('vag-voice').value = '';
      }

      // 🎵 BGM 여부 + 볼륨
      V._addMsg('ai', '💡 <b>배경음악을 넣을까요?</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;">켜면 광고 분위기에 맞는 음악을 만듭니다. 실패하면 음악만 다시 시도하고, 계속 실패해도 영상은 이어서 만들 수 있습니다.</span>');
      var bgmChoice = await new Promise(function (resolve) {
        V._addOptions(['BGM 균형 (18%)', 'BGM 중간 (24%)', 'BGM 작게 (12%)', 'BGM 크게 (35%)', 'BGM 없음'], resolve);
      });
      var bgmVolMap = {'BGM 균형 (18%)':18,'BGM 중간 (24%)':24,'BGM 작게 (12%)':12,'BGM 크게 (35%)':35,'BGM 없음':0};
      var bvm = bgmVolMap[bgmChoice] ?? 18;
      document.getElementById('vag-auto-bgm').checked = (bvm > 0);
      document.getElementById('vag-bgm-volume').value = String(bvm);

      // 사용자가 고른 샘플 템플릿 / 3안 비교 / 빠른 단일 생성이 실제 결과에
      // 반영되도록 기본 플로우를 그대로 탄다. 감독 모드는 별도 액션에서만 사용.
      V._addMsg('ai', '🎬 방금 고른 방식으로 바로 만들게요.');
      window._vagPendingMode = null;

      // 2. 소재 수집 방법
      if (!V._vagSourceContent) {
        V._vagSourceMode = '자료 없이 진행';
        V._vagSetStage('source', 'muted', '주제 중심으로 바로 진행', '따로 자료를 찾지 않고, 입력한 내용과 프로필만 보고 만듭니다.');
        V._vagUpdateWorkspace();
      }

      if (V._vagSourceContent) {
        // 주제 입력 단계에서 '📥 자료 먼저' 로 이미 첨부됨 → 자료 수집 단계 자동 스킵
        V._vagSetStage('source', 'ready', '자료 이미 첨부됨', (V._vagSourceMode || '첨부') + ' · ' + V._vagSourceContent.length + '자');
        V._vagUpdateWorkspace();
        V._addMsg('ai', '첨부한 자료를 그대로 사용할게요.');
      }

      if (!V._vagSourceContent && V._vagSourceMode !== '자료 없이 진행') {
        V._vagSourceMode = '주제 중심 진행';
        V._vagSetStage('source', 'muted', '주제와 프로필만으로 진행', '추가 자료 없이도 광고 영상을 만들 수 있습니다.');
        V._vagUpdateWorkspace();
      }

      // 4. 영상 비율
      V._addMsg('ai', '영상 크기를 선택하세요.');
      var aspectSel = await new Promise(function (resolve) {
        V._addOptions(['9:16 세로 (릴스/숏츠)', '1:1 정사각', '16:9 가로', 'AI 자동'], resolve);
      });
      if (aspectSel === 'AI 자동') aspectSel = '9:16 세로 (릴스/숏츠)';
      document.getElementById('vag-aspect').value = V._vagAspectLabelToValue(aspectSel);

      // 4.5 구조는 묻지 않는다. 시나리오 생성 단계에서 AI가 주제·소재를 보고 결정한다.
      var structureTemplate = null;
      V._addMsg('ai', '장면 구성은 입력한 내용을 보고 자동으로 정합니다.');

      // CTA는 위 한 번의 선택만 사용한다. 별도 엔드카드 질문은 반복하지 않는다.
      var addEndcard = !!String(cta || '').trim();

      var startMode = '⚡ 빠른 단일 생성';

      // (옛날 중복 질문 제거됨 — 장면 수/나레이션 음성/배경/변형/BGM 은 새 플로우에서 이미 물음)
      // 기본값: 나레이션 ON 이면 Kore, 배경은 엔진이 만든 HTML/CSS를 그대로 사용한다.
      const _narrOn = document.getElementById('vag-auto-narration')?.checked !== false;
      const _bgmOn = document.getElementById('vag-auto-bgm')?.checked !== false;
      document.getElementById('vag-voice').value = _narrOn ? (document.getElementById('vag-voice').value || 'gemini-Kore') : '';
      var bgMode = 'html';
      var wantVariations = startMode !== '⚡ 빠른 단일 생성' && startMode !== '🎭 감독모드 자동 기획';
      var bgmEnabled = _bgmOn;
      var selectedAspect = document.getElementById('vag-aspect').value || '9:16';
      var templateId = '';
      if (startMode === '📦 샘플 템플릿으로 시작') {
        templateId = await V._vagPickSampleTemplate(selectedAspect);
        if (!templateId) {
          V._addMsg('ai', '샘플을 고르지 않아 3가지 비교 생성으로 이어갑니다.');
          wantVariations = true;
        } else {
          wantVariations = false;
        }
      }

      // brandColor 는 이미 이전 단계(브랜드 색 선택)에서 _vagSession.brandColor 에 저장됨 — 보존
      var preservedBrandColor = (V._vagSession && V._vagSession.brandColor) || _vagResolveProfileBrandColor(window._globalProfileData || {}) || '';
      var preservedLogoDataUrl = (V._vagSession && V._vagSession.logoDataUrl) || V._vagLogoDataUrl || '';
      var preservedRequestedDuration = (V._vagSession && V._vagSession.requestedDurationSec) || 0;
      var preservedHyperDuration = (V._vagSession && V._vagSession.hyperDuration) || 0;
      var preservedVisualConcept = (V._vagSession && V._vagSession.visualConcept) || null;
      var preservedVisualConcepts = (V._vagSession && V._vagSession.visualConcepts) || [];
      var preservedVisualConceptCandidates = (V._vagSession && V._vagSession.visualConceptCandidates) || [];
      var preservedPersonMode = (V._vagSession && V._vagSession.personMode) || '';
      var preservedCampaignModel = (V._vagSession && V._vagSession.campaignModel) || null;
      var preservedCharacterImageUrl = (V._vagSession && V._vagSession.characterImageUrl) || '';
      var preservedProductAssets = (V._vagSession && V._vagSession.productAssets) || null;
      var preservedManualStepMode = !!((V._vagSession && V._vagSession.manualStepMode) || (window._vagAutoChoices && window._vagAutoChoices.manualStepMode));
      var latestSourceContent = typeof V._vagSyncSourceInputFromDOM === 'function'
        ? V._vagSyncSourceInputFromDOM('직접 입력 소재')
        : String(V._vagSourceContent || '').trim();
      var latestSourceMode = V._vagSourceMode || (latestSourceContent ? '직접 입력 소재' : '');
      var latestSourcePriority = !!(latestSourceContent && latestSourceMode !== '자료 없이 진행' && latestSourceMode !== '주제 중심 진행');
      V._vagSession = {
        mode: 'marketing-video',
        baseTopic: topic,
        baseSource: latestSourceContent || topic,
        sourceMode: latestSourceMode,
        sourcePriority: latestSourcePriority,
        objective: objective,
        tone: tone,
        cta: cta,
        structureTemplate: structureTemplate || null,
        addEndcard: addEndcard,
        aspect: selectedAspect,
        bgMode: bgMode,
        bgImageUrl: '',
        wantVariations: wantVariations,
        bgmEnabled: bgmEnabled,
        bgmUrl: '',
        brandColor: preservedBrandColor,
        logoDataUrl: preservedLogoDataUrl,
        templateId: templateId,
        hyperHtml: '',
        requestedDurationSec: preservedRequestedDuration,
        hyperDuration: preservedHyperDuration || V._vagDurationFromSceneCount(document.getElementById('vag-scene-count').value || 4),
        startMode: startMode,
        directorMode: startMode === '🎭 감독모드 자동 기획',
        directorAutoEnabled: startMode === '🎭 감독모드 자동 기획',
        directorCrewMode: startMode === '🎭 감독모드 자동 기획',
        visualConcept: preservedVisualConcept,
        visualConcepts: preservedVisualConcepts,
        visualConceptCandidates: preservedVisualConceptCandidates,
        personMode: preservedPersonMode,
        campaignModel: preservedCampaignModel,
        characterImageUrl: preservedCharacterImageUrl,
        productAssets: preservedProductAssets,
        manualStepMode: preservedManualStepMode,
        motionFrameMode: (window._vagAutoPrefs && window._vagAutoPrefs.motionFrameMode) || 'dynamic',
      };
      V._vagPersistState('planning', 'planning', {
        start_mode: startMode,
        aspect: selectedAspect,
        provider: (document.getElementById('vag-provider') || {}).value || 'gemini',
        director_mode: startMode === '🎭 감독모드 자동 기획',
        director_auto_enabled: startMode === '🎭 감독모드 자동 기획',
        director_crew_mode: startMode === '🎭 감독모드 자동 기획',
        template_id: templateId || '',
        want_variations: wantVariations,
        scene_count: parseInt(document.getElementById('vag-scene-count').value || '0', 10) || 0,
        source_mode: latestSourceMode,
        source_priority: latestSourcePriority,
        manual_step_mode: preservedManualStepMode,
        motion_frame_mode: (window._vagAutoPrefs && window._vagAutoPrefs.motionFrameMode) || 'dynamic',
      }, 'planning_locked', {
        start_mode: startMode,
        aspect: selectedAspect,
        provider: (document.getElementById('vag-provider') || {}).value || 'gemini',
      });

      var marketingTopic = V._vagBuildMarketingTopic(topic, objective, tone, cta);
      var marketingSource = V._vagBuildMarketingSource(latestSourceContent || topic, V._vagSession);

      if (V._vagSession.directorAutoEnabled) {
        await V._vagPrepareDirectorBrief(marketingTopic, marketingSource, {
          message: '🎭 AI 광고 감독이 전략가·카피·아트·모션·사운드 팀에게 일을 나눠 맡기고 있어요...',
          autoMode: true,
          forceDirectorMode: true,
          teamMode: true,
        });
      }

      // Remotion 엔진은 샘플 템플릿/3안 비교 선택을 그대로 살리기 어렵다.
      // 사용자가 화면에서 고른 시작 방식이 실제 결과에 반영되도록 HyperFrames 생성기로 맞춘다.
      if ((document.getElementById('vag-provider') || {}).value === 'remotion' && (V._vagSession.templateId || V._vagSession.wantVariations)) {
        document.getElementById('vag-provider').value = 'gemini';
        V._addMsg('ai', '🧭 선택한 샘플/변형 방향을 살리기 위해 영상 만들기 방식을 자동으로 맞췄습니다.');
      }

      // 생성 실행 — 감독/팀/장편/단편 분기
      var modeSel = document.getElementById('vag-mode');
      var modeVal = (modeSel && modeSel.value) || 'short';
      latestSourceContent = String(V._vagSourceContent || latestSourceContent || '').trim();
      marketingSource = V._vagBuildMarketingSource(latestSourceContent || topic, V._vagSession);
      // 2분까지는 단일 핵심 메시지 모션으로 처리한다. 3분 이상만 챕터형 장편 플랜으로 분기한다.
      if (modeVal !== 'short' && /^\d+$/.test(modeVal)) {
        var numericDuration = parseInt(modeVal, 10) || 0;
        if (numericDuration >= 180) {
          V._doGenerateLongform(marketingTopic, marketingSource, numericDuration);
        } else {
          if (V._vagSession) {
            V._vagSession.requestedDurationSec = numericDuration;
            V._vagSession.hyperDuration = numericDuration;
          }
          document.getElementById('vag-scene-count').value = String(Math.max(5, Math.round(numericDuration / 18)));
          V._addMsg('ai', '🧭 ' + numericDuration + '초는 장편 챕터가 아니라 <b>핵심 메시지 단일 모션</b>으로 생성합니다.', { html: true });
          V._doGenerate(marketingTopic, marketingSource);
        }
      } else {
        V._doGenerate(marketingTopic, marketingSource);
      }
      window._vagPendingMode = null;

    } catch (flowErr) {
      console.error('[VAG] flow error:', flowErr);
      V._addMsg('ai', '<span style="color:#ff3b30;">오류: ' + V._esc(flowErr.message) + '<br>다시 시도해주세요.</span>');
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      window._vagBusy = false;  // 진행 종료 — 메뉴 이동 자유
    }
  }

})();
