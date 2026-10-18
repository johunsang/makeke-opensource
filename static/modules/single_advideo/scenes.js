/* single_advideo — 씬/스크립트/영상 생성/결과 (씬별 이미지 업로드·생성, 스크립트 생성, 영상 생성, 씬 결과 승인/재생성) */
function savRemoveImage(idx) {
  const removed = savGetUploadedImageMeta()[idx];
  if (!removed) return;
  const removeAt = _savState.uploadedImages.findIndex(img => {
    const item = savNormalizeImageItem(img, typeof img === 'string' ? 'upload' : (img?.source || 'upload'));
    return item?.url === removed.url;
  });
  if (removeAt === -1) return;
  _savState.uploadedImages.splice(removeAt, 1);
  const removedUrl = typeof removed === 'string' ? removed : (removed?.url || removed?.path || '');
  if (removedUrl) {
    Object.keys(_savState.sceneImages).forEach(sceneIdx => {
      _savState.sceneImages[sceneIdx] = (_savState.sceneImages[sceneIdx] || []).filter(url => url !== removedUrl);
    });
  }
  savRenderImages();
  if (_savState.script?.scenes?.length) savRenderScript();
}

function savGetImageUrls() {
  return savGetUploadedImageMeta().map(img => img.url).filter(Boolean);
}

// ── URL 종합 수집 (YouTube / 웹페이지 / 상품 페이지 자동 판별) ──
function _savIsYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

async function _savScrapeYouTube(url) {
  const res = await api('/api/content/youtube-transcript', {
    method: 'POST',
    body: { url },
  });
  const data = res.data || {};
  return {
    type: 'youtube',
    title: data.title || '',
    channel: data.channel || '',
    text: data.text || data.summary || '',
    images: data.images || (data.thumbnail ? [data.thumbnail] : []),
    thumbnail: data.thumbnail || '',
    duration: data.duration || '',
  };
}

async function _savScrapeWeb(url) {
  let data = {};
  try {
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const res = await scrape(url, { minLength: 50, timeoutMs: 45000 });
    if (!res.ok) throw new Error(res.error || '본문 수집 실패');
    data = {
      title: res.title || '',
      text: res.text || '',
      images: res.images || [],
      method: res.method || 'pipeline',
    };
  } catch (e) {
    console.warn('[SAV] scrape 실패:', e.message);
    throw e;
  }

  let images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  if (images.length < 8) {
    try {
      const imgRes = await api('/api/content/fetch-images', { method: 'POST', body: [url] });
      const extraImages = _savExtractFetchedImages(imgRes, url);
      images = Array.from(new Set([
        ...images,
        ...extraImages,
      ]));
    } catch (e) {}
  }

  return {
    type: 'web',
    title: data.title || '',
    text: data.text || '',
    images,
    method: data.method || '',
  };
}

function _savExtractFetchedImages(data, targetUrl) {
  const images = [];
  if (Array.isArray(data?.images)) images.push(...data.images);
  if (Array.isArray(data?.image_lists)) {
    const normalizedTarget = String(targetUrl || '').trim();
    data.image_lists.forEach(item => {
      const itemUrl = String(item?.url || '').trim();
      if (!normalizedTarget || !itemUrl || itemUrl === normalizedTarget) {
        if (Array.isArray(item?.images)) images.push(...item.images);
      }
    });
  } else if (Array.isArray(data?.image_lists?.[targetUrl])) {
    images.push(...data.image_lists[targetUrl]);
  }
  return Array.from(new Set(images.filter(Boolean)));
}

async function savImportFromUrl() {
  const urlEl = document.getElementById('sav-source-url');
  const statusEl = document.getElementById('sav-upload-status');
  const rawInput = (urlEl?.value || '').trim();
  const urls = rawInput.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
  if (!urls.length) {
    toast('참고 URL이 없어 수집을 건너뜁니다.', 'info');
    return;
  }

  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `${urls.length}개 URL 수집 중...`; }

  try {
    const allTexts = [];
    const allImages = [];
    let ytCount = 0, webCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (statusEl) statusEl.textContent = `URL ${i + 1}/${urls.length} 수집 중... ${_savIsYouTubeUrl(url) ? '(YouTube)' : '(웹)'}`;

      try {
        let result;
        if (_savIsYouTubeUrl(url)) {
          result = await _savScrapeYouTube(url);
          ytCount++;
        } else {
          result = await _savScrapeWeb(url);
          webCount++;
        }

        // 텍스트 수집
        const title = String(result.title || '').trim();
        const text = String(result.text || '').trim();
        if (text) {
          let header = title ? `[${title}]` : '';
          if (result.type === 'youtube' && result.channel) header += ` (${result.channel})`;
          allTexts.push(header ? `${header}\n${text}` : text);
        }

        // 이미지/썸네일 수집 → 참조 이미지로 추가
        const images = result.images || [];
        images.forEach(img => {
          if (img && !allImages.includes(img)) allImages.push(img);
        });

        if (!text && images.length) {
          console.warn(`[SAV] ${url}은 이미지 ${images.length}장만 수집됨 (method=${result.method || 'unknown'})`);
        }
      } catch (e) {
        console.warn(`[SAV] ${url} 수집 실패:`, e.message);
      }
    }

    // 주제 자동 설정 (첫 번째 제목)
    const topicEl = document.getElementById('sav-topic');
    if (topicEl && !topicEl.value.trim() && allTexts.length) {
      const firstTitle = allTexts[0].split('\n')[0].replace(/^\[|\]$/g, '').trim();
      if (firstTitle) topicEl.value = firstTitle.slice(0, 60);
    }

    // 메시지에 수집 내용 추가
    const msgEl = document.getElementById('sav-message');
    if (msgEl && allTexts.length) {
      const existing = msgEl.value.trim();
      const newText = allTexts.join('\n\n---\n\n');
      msgEl.value = existing ? existing + '\n\n---\n\n' + newText : newText;
    }

    // 이미지를 참조 이미지로 추가
    if (allImages.length) {
      let added = 0;
      allImages.forEach(imgUrl => {
        if (savAddGlobalImage(imgUrl, 'url')) added++;
      });
      savRenderImages();
      if (_savState.script?.scenes?.length) savRenderScript();
      if (added) {
        toast(`URL 이미지 ${added}장을 참조 이미지 후보에 추가했습니다.`, 'info');
      }
    }

    const parts = [];
    if (ytCount) parts.push(`YouTube ${ytCount}개`);
    if (webCount) parts.push(`웹페이지 ${webCount}개`);
    toast(`${parts.join(' + ')}에서 내용${allImages.length ? `과 이미지 ${allImages.length}장` : ''}을 수집했습니다.`);

    if (!allTexts.length) {
      const fallbackMessage = allImages.length
        ? 'URL에서 본문은 못 가져왔지만 이미지 후보는 가져왔습니다.'
        : 'URL에서 내용을 가져오지 못했습니다.';
      toast(fallbackMessage, allImages.length ? 'info' : 'error');
    }
  } catch (e) {
    toast('URL 수집 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

// ── 스크립트 생성 ──
async function savGenerateScript() {
  const topic = (document.getElementById('sav-topic')?.value || '').trim();
  const message = (document.getElementById('sav-message')?.value || '').trim();
  const style = document.getElementById('sav-style')?.value || 'cinematic';
  const sceneCount = parseInt(document.getElementById('sav-scenes')?.value || '5', 10);
  const ratio = document.getElementById('sav-ratio')?.value || '9:16';
  const imageUrls = savGetImageUrls();
  const storyAngle = (document.getElementById('sav-story-angle')?.value || 'auto').trim();
  const storyDetail = (document.getElementById('sav-story-detail')?.value || '').trim();

  if (!topic && !message) {
    toast('광고 주제나 메시지를 입력하세요', 'error');
    return;
  }

  const btn = document.getElementById('sav-script-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 스크립트 생성 중...'; }

  try {
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    const res = await api('/api/advideo/script', {
      method: 'POST',
      body: {
        topic, message, style, scene_count: sceneCount,
        aspect_ratio: ratio, image_count: imageUrls.length,
        image_urls: imageUrls,
        profile_id: profileId,
        story_angle: storyAngle,
        story_detail: storyDetail,
      },
    });
    savRememberAiUsageFromResponse('script', '광고 스크립트 생성', res);
    _savState.sceneImages = {};
    _savState.sceneResults = [];
    _savState.script = res.script || null;
    _savState._autoDirectTriggered = false;  // 재설정
    // 1단계에서 입력한 전체 소재 이미지를 모든 씬의 참조 이미지로 자동 할당
    try {
      const globalUrls = savGetUploadedImageMeta().map(function (img) { return img.url; }).filter(Boolean);
      const scenes = (_savState.script && _savState.script.scenes) || [];
      scenes.forEach(function (_s, idx) {
        _savState.sceneImages[idx] = globalUrls.slice();
      });
    } catch (e) { /* ignore */ }
    document.getElementById('sav-generate-btn').disabled = false;
    const sceneCnt2 = (res.script?.scenes || []).length;
    toast(`${sceneCnt2}씬 스크립트 생성 완료 · AI 씬 디렉팅 자동 실행 중...`);
    if (sceneCnt2) savRenderScript();
    // ★ 스크립트 생성 직후 자동으로 AI 씬 디렉팅 실행 — 씬 카드는 즉시 보여주고 상태 배너만 추가
    if (sceneCnt2 && typeof savAutoDirect === 'function') {
      _savState._autoDirectTriggered = true;
      const area = document.getElementById('sav-script-area');
      if (area) {
        const banner = document.createElement('div');
        banner.id = 'sav-auto-direct-banner';
        banner.style.cssText = 'margin-bottom:12px;padding:12px 14px;border-radius:12px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.22);display:flex;align-items:center;gap:10px;color:#1c1c1e;font-size:12px;';
        banner.innerHTML = '<span class="spinner" style="width:16px;height:16px;border:2px solid rgba(255,140,0,0.22);border-top-color:#ff8c00;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;flex-shrink:0;"></span>'
          + '<div><div style="font-weight:800;">AI가 씬별 카메라·라이팅·스타일을 분석 중입니다</div>'
          + '<div style="font-size:11px;color:rgba(0,0,0,0.48);margin-top:2px;">장면 카드는 바로 편집할 수 있고, 디렉팅이 끝나면 값이 자동으로 채워집니다.</div></div>';
        area.prepend(banner);
        if (!document.getElementById('sav-auto-direct-style')) {
          const sty = document.createElement('style');
          sty.id = 'sav-auto-direct-style';
          sty.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
          document.head.appendChild(sty);
        }
      }
      setTimeout(function () {
        savAutoDirect().catch(function (e) {
          console.warn('auto-direct 실패:', e);
          // 실패 시 일반 씬 카드 표시로 폴백
          if (typeof savRenderScript === 'function') savRenderScript();
        }).finally(function () {
          document.getElementById('sav-auto-direct-banner')?.remove();
        });
      }, 400);
    } else {
      // 스크립트만 있고 자동 디렉팅 미실행이면 일반 렌더
      savRenderScript();
    }
  } catch (e) {
    toast('스크립트 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 5v14"/><path d="M5 12h14"/></svg> AI 스크립트 생성'; }
  }
}

function savRenderScript() {
  try { if (typeof savUpdateStepProgress === 'function') savUpdateStepProgress(); } catch (e) { /* ignore */ }
  const wrap = document.getElementById('sav-script-area');
  if (!wrap || !_savState.script) return;
  const scenes = _savState.script.scenes || [];
  const globalImgs = savGetAllReferenceImageMeta();  // 업로드 + 프로필 로고/이미지

  wrap.innerHTML = scenes.map((s, idx) => {
    const sceneImgs = _savState.sceneImages[idx] || [];
    const imgPreview = sceneImgs.map((url, imgIdx) =>
      `<div style="position:relative;width:48px;height:48px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);flex-shrink:0;">
        <img src="${escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;">
        <button type="button" onclick="savRemoveSceneImage(${idx},${imgIdx})" style="position:absolute;top:1px;right:1px;width:16px;height:16px;border:none;border-radius:999px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;cursor:pointer;line-height:16px;padding:0;">×</button>
      </div>`
    ).join('');

    // 전역 이미지에서 선택 가능한 목록
    const availableImgs = globalImgs.filter(img => !sceneImgs.includes(img.url));
    const candidatePreview = availableImgs.length
      ? availableImgs.map((img, imgIdx) => {
          const encoded = encodeURIComponent(img.url);
          const sourceLabel = img.source === 'profile-logo' ? '🏷️ 로고'
            : img.source === 'profile' ? '👤 프로필'
            : img.source === 'url' ? 'URL' : '업로드';
          const labelBg = (img.source === 'profile-logo' || img.source === 'profile')
            ? 'rgba(255,140,0,0.85)' : 'rgba(0,0,0,0.65)';
          return `<button type="button" onclick="savAddSceneImageFromGlobal(${idx},decodeURIComponent('${encoded}'))" style="position:relative;width:58px;height:58px;padding:0;border:1px solid rgba(255,140,0,0.22);border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;flex-shrink:0;" title="${escapeHtml(img.label || '참조 이미지')}">
            <img src="${escapeHtml(img.url)}" style="width:100%;height:100%;object-fit:cover;display:block;">
            <span style="position:absolute;left:4px;bottom:4px;padding:2px 5px;border-radius:999px;background:${labelBg};color:#fff;font-size:9px;font-weight:700;">${sourceLabel}</span>
            <span style="position:absolute;top:4px;right:4px;width:18px;height:18px;border-radius:999px;background:rgba(255,140,0,0.9);color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;">+</span>
          </button>`;
        }).join('')
      : '<div style="font-size:11px;color:rgba(0,0,0,0.35);">전역 후보가 없습니다. 위에서 이미지를 업로드하거나 URL을 수집하세요.</div>';

    const sceneResult = _savState.sceneResults && _savState.sceneResults[idx];
    const hasPreview = sceneResult && sceneResult.status === 'done' && sceneResult.videoUrl;
    const previewBlock = hasPreview
      ? `<div style="margin-top:8px;padding:8px;background:rgba(52,199,89,0.06);border:1px solid rgba(52,199,89,0.3);border-radius:10px;">
          <div style="font-size:11px;font-weight:700;color:#34c759;margin-bottom:6px;">✓ 이 씬 미리보기</div>
          <video src="${escapeHtml(sceneResult.videoUrl)}" controls playsinline style="width:100%;max-width:400px;border-radius:8px;background:#000;"></video>
        </div>`
      : '';
    return `<div style="padding:12px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;background:rgba(255,140,0,0.03);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:#1c1c1e;">씬 ${s.scene_number || idx + 1}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button type="button" onclick="savRegenerateScene(${idx})" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:rgba(255,140,0,0.08);color:#ff8c00;border-radius:8px;cursor:pointer;">🎬 이 씬만 영상 미리보기</button>
          <button type="button" onclick="savDeleteScene(${idx})" style="height:28px;padding:0 10px;font-size:11px;font-weight:700;border:1px solid rgba(255,59,48,0.18);border-radius:8px;background:rgba(255,59,48,0.08);color:#ff3b30;cursor:pointer;">씬 삭제</button>
        </div>
      </div>
      ${previewBlock}
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);margin-bottom:4px;">씬 제목</div>
        <input type="text" value="${escapeHtml(s.title || '')}" oninput="savUpdateSceneField(${idx},'title',this.value)" style="width:100%;padding:8px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);margin-bottom:4px;">나레이션</div>
        <textarea rows="3" data-sav-autoresize="true" oninput="savAutoResizeTextarea(this);savUpdateSceneField(${idx},'narration',this.value)" style="width:100%;padding:9px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;line-height:1.6;resize:vertical;background:#fff;">${escapeHtml(s.narration || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;padding:8px;background:rgba(255,140,0,0.05);border:1px dashed rgba(255,140,0,0.25);border-radius:8px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:#ff6b00;margin-bottom:2px;">🎥 카메라</div>
          <select onchange="savUpdateSceneField(${idx},'camera_preset',this.value)" style="width:100%;padding:5px 6px;font-size:10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;background:#fff;">
            <option value="">— 기본 —</option>
            <option value="dolly_in" ${s.camera_preset==='dolly_in'?'selected':''}>달리인</option>
            <option value="dolly_out" ${s.camera_preset==='dolly_out'?'selected':''}>달리아웃</option>
            <option value="crash_zoom_in" ${s.camera_preset==='crash_zoom_in'?'selected':''}>크래시 줌인</option>
            <option value="orbit_right" ${s.camera_preset==='orbit_right'?'selected':''}>오빗 →</option>
            <option value="full_360" ${s.camera_preset==='full_360'?'selected':''}>360° 회전</option>
            <option value="whip_pan_right" ${s.camera_preset==='whip_pan_right'?'selected':''}>위핍 팬 →</option>
            <option value="aerial_dive" ${s.camera_preset==='aerial_dive'?'selected':''}>에어리얼 다이브</option>
            <option value="follow_tracking" ${s.camera_preset==='follow_tracking'?'selected':''}>팔로우 트래킹</option>
            <option value="bullet_time" ${s.camera_preset==='bullet_time'?'selected':''}>불릿 타임</option>
            <option value="macro_zoom" ${s.camera_preset==='macro_zoom'?'selected':''}>매크로 줌</option>
            <option value="low_angle_hero" ${s.camera_preset==='low_angle_hero'?'selected':''}>로우앵글 히어로</option>
            <option value="product_spin_360" ${s.camera_preset==='product_spin_360'?'selected':''}>제품 360 스핀</option>
            <option value="product_reveal" ${s.camera_preset==='product_reveal'?'selected':''}>제품 리빌</option>
            <option value="luxurious_glide" ${s.camera_preset==='luxurious_glide'?'selected':''}>럭셔리 글라이드</option>
            <option value="static" ${s.camera_preset==='static'?'selected':''}>정적</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#ff6b00;margin-bottom:2px;">💡 라이팅</div>
          <select onchange="savUpdateSceneField(${idx},'lighting_preset',this.value)" style="width:100%;padding:5px 6px;font-size:10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;background:#fff;">
            <option value="">— 자동 —</option>
            <option value="softbox_studio" ${s.lighting_preset==='softbox_studio'?'selected':''}>스튜디오</option>
            <option value="golden_hour" ${s.lighting_preset==='golden_hour'?'selected':''}>골든아워</option>
            <option value="neon_cyberpunk" ${s.lighting_preset==='neon_cyberpunk'?'selected':''}>네온</option>
            <option value="candle_intimate" ${s.lighting_preset==='candle_intimate'?'selected':''}>캔들</option>
            <option value="hard_noir" ${s.lighting_preset==='hard_noir'?'selected':''}>누아르</option>
            <option value="window_light" ${s.lighting_preset==='window_light'?'selected':''}>윈도우</option>
            <option value="rim_backlight" ${s.lighting_preset==='rim_backlight'?'selected':''}>림</option>
            <option value="color_gel_split" ${s.lighting_preset==='color_gel_split'?'selected':''}>컬러젤</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#ff6b00;margin-bottom:2px;">🎨 스타일</div>
          <select onchange="savUpdateSceneField(${idx},'style_preset',this.value)" style="width:100%;padding:5px 6px;font-size:10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;background:#fff;">
            <option value="">— 없음 —</option>
            <option value="kodak_portra_400" ${s.style_preset==='kodak_portra_400'?'selected':''}>Kodak Portra</option>
            <option value="teal_orange" ${s.style_preset==='teal_orange'?'selected':''}>티얼/웜톤</option>
            <option value="neon_noir" ${s.style_preset==='neon_noir'?'selected':''}>네온 누아르</option>
            <option value="pastel_dream" ${s.style_preset==='pastel_dream'?'selected':''}>파스텔</option>
            <option value="ghibli" ${s.style_preset==='ghibli'?'selected':''}>지브리</option>
            <option value="apple_minimal" ${s.style_preset==='apple_minimal'?'selected':''}>애플 미니멀</option>
            <option value="nike_kinetic" ${s.style_preset==='nike_kinetic'?'selected':''}>나이키 키네틱</option>
            <option value="saint_laurent" ${s.style_preset==='saint_laurent'?'selected':''}>생로랑</option>
            <option value="blade_runner" ${s.style_preset==='blade_runner'?'selected':''}>블레이드러너</option>
          </select>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#ff6b00;margin-bottom:2px;">⚡ 모션 ${s.motion_intensity || 50}</div>
          <input type="range" min="0" max="100" value="${s.motion_intensity || 50}" oninput="savUpdateSceneField(${idx},'motion_intensity',parseInt(this.value,10));this.previousElementSibling.innerText='⚡ 모션 '+this.value;" style="width:100%;">
        </div>
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);margin-bottom:4px;">자막 문구</div>
        <input type="text" value="${escapeHtml(s.subtitle || '')}" oninput="savUpdateSceneField(${idx},'subtitle',this.value)" placeholder="비워두면 나레이션을 자막으로 사용합니다." style="width:100%;padding:8px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);margin-bottom:4px;">비주얼 프롬프트</div>
        <textarea rows="3" data-sav-autoresize="true" oninput="savAutoResizeTextarea(this);savUpdateSceneField(${idx},'visual_prompt',this.value)" style="width:100%;padding:9px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:11px;line-height:1.6;resize:vertical;background:#fff;color:rgba(0,0,0,0.65);">${escapeHtml(s.visual_prompt || '')}</textarea>
      </div>
      <div style="border-top:1px solid rgba(0,0,0,0.06);padding-top:8px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);">참조 이미지:</span>
          ${imgPreview}
          <label style="width:48px;height:48px;border-radius:8px;border:1px dashed rgba(255,140,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(255,140,0,0.04);flex-shrink:0;">
            <input type="file" accept="image/*" multiple style="display:none;" onchange="savUploadSceneImage(${idx},this)">
            <span style="font-size:18px;color:#ff8c00;">+</span>
          </label>
          <button type="button" onclick="savGenerateSceneImage(${idx})" id="sav-gen-img-${idx}" style="height:28px;padding:0 10px;font-size:11px;font-weight:600;border:1px solid rgba(255,140,0,0.3);border-radius:6px;background:rgba(255,140,0,0.06);color:#ff8c00;cursor:pointer;white-space:nowrap;">AI 생성</button>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.45);margin-bottom:6px;">참조 이미지 선택</div>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">${candidatePreview}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
          <input id="sav-scene-url-${idx}" type="text" placeholder="이미지 URL 직접 입력" style="flex:1;min-width:180px;padding:7px 10px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;font-size:12px;" onkeydown="if(event.key==='Enter'){event.preventDefault();savAddSceneImageFromInput(${idx});}">
          <button type="button" onclick="savAddSceneImageFromInput(${idx})" style="height:32px;padding:0 12px;font-size:11px;font-weight:600;border:1px solid rgba(255,140,0,0.3);border-radius:8px;background:#fff;color:#ff8c00;cursor:pointer;white-space:nowrap;">URL 입력</button>
        </div>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('textarea[data-sav-autoresize="true"]').forEach(savAutoResizeTextarea);
  savRenderSubtitlePreview();
}

function savUploadSceneImage(sceneIdx, input) {
  if (!input?.files?.length) return;
  const formData = new FormData();
  Array.from(input.files).forEach(f => formData.append('files', f));
  fetch('/api/content/upload-image', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      if (!_savState.sceneImages[sceneIdx]) _savState.sceneImages[sceneIdx] = [];
      (data.images || []).forEach(img => {
        savAddGlobalImage(img, 'upload');
        const url = typeof img === 'string' ? img : (img.url || img.path || '');
        if (url) _savState.sceneImages[sceneIdx].push(url);
      });
      _savState.sceneImages[sceneIdx] = Array.from(new Set(_savState.sceneImages[sceneIdx].filter(Boolean)));
      savRenderImages();
      savRenderScript();
      toast(`씬 ${sceneIdx + 1}에 이미지 ${(data.images || []).length}장 추가`);
    })
    .catch(e => toast('업로드 실패: ' + e.message, 'error'));
  input.value = '';
}

function savAddSceneImageFromGlobal(sceneIdx, url) {
  if (!url) return;
  if (!_savState.sceneImages[sceneIdx]) _savState.sceneImages[sceneIdx] = [];
  if (!_savState.sceneImages[sceneIdx].includes(url)) {
    _savState.sceneImages[sceneIdx].push(url);
    savRenderScript();
  }
}

function savAddSceneImageFromInput(sceneIdx) {
  const input = document.getElementById(`sav-scene-url-${sceneIdx}`);
  const url = (input?.value || '').trim();
  if (!url) {
    toast('이미지 URL을 입력하세요', 'error');
    return;
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    toast('올바른 이미지 URL을 입력하세요', 'error');
    return;
  }
  savAddGlobalImage(url, 'url');
  if (!_savState.sceneImages[sceneIdx]) _savState.sceneImages[sceneIdx] = [];
  if (!_savState.sceneImages[sceneIdx].includes(url)) {
    _savState.sceneImages[sceneIdx].push(url);
  }
  if (input) input.value = '';
  savRenderImages();
  savRenderScript();
  toast(`씬 ${sceneIdx + 1}에 참조 이미지를 추가했습니다.`);
}

function savRemoveSceneImage(sceneIdx, imgIdx) {
  if (_savState.sceneImages[sceneIdx]) {
    _savState.sceneImages[sceneIdx].splice(imgIdx, 1);
    savRenderScript();
  }
}

// ── 씬별 배경 컨셉 이미지 생성 ──
function savBuildNoTextSceneImagePrompt(scene, sceneIdx, topic) {
  const sourcePrompt = [
    scene?.visual_prompt || '',
    scene?.title ? `Scene title meaning only: ${scene.title}` : '',
    scene?.narration ? `Narration meaning only: ${scene.narration}` : '',
    topic ? `Campaign topic meaning only: ${topic}` : '',
  ].filter(Boolean).join('\n');
  return [
    '[HyperFrames scene background concept image]',
    'Create a clean cinematic background/key visual asset for this scene only. This is not the final video and not a text card.',
    'ABSOLUTE NO TEXT IN THE IMAGE PIXELS.',
    'Do not render Korean, English, numbers, subtitles, captions, price tags, CTA buttons, UI labels, sign text, logo text, watermark, fake app screens, or readable typography.',
    'All copy, CTA, price, captions, labels, brand wording, and motion graphics will be composed later as HyperFrames HTML/GSAP overlay layers.',
    'Use objects, people, environment, lighting, composition, color, and mood to express the scene. Leave safe empty space for overlay text.',
    `Scene index: ${sceneIdx + 1}`,
    sourcePrompt || 'Abstract branded marketing background without any text.',
  ].join('\n');
}

async function savGenerateSceneImage(sceneIdx) {
  const scene = _savState.script?.scenes?.[sceneIdx];
  if (!scene) return;

  const btn = document.getElementById(`sav-gen-img-${sceneIdx}`);
  if (btn) { btn.disabled = true; btn.textContent = '생성 중...'; }

  try {
    const topic = (document.getElementById('sav-topic')?.value || '').trim();
    const prompt = savBuildNoTextSceneImagePrompt(scene, sceneIdx, topic);

    const res = await api('/api/advideo/generate-image', {
      method: 'POST',
      body: {
        prompt,
        topic,
        scene_title: scene.title || '',
        aspect_ratio: document.getElementById('sav-ratio')?.value || '9:16',
      },
    });

    if (res.image_url) {
      if (!_savState.sceneImages[sceneIdx]) _savState.sceneImages[sceneIdx] = [];
      _savState.sceneImages[sceneIdx].push(res.image_url);
      savRenderScript();
      toast(`씬 ${sceneIdx + 1} 이미지 생성 완료`);
    }
  } catch (e) {
    toast(`씬 ${sceneIdx + 1} 이미지 생성 실패: ` + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'AI 생성'; }
  }
}

// ── 전체 씬 이미지 없는 곳 자동 생성 ──
async function savAutoGenerateMissingImages() {
  const scenes = _savState.script?.scenes || [];
  const globalImgs = savGetImageUrls();
  let generated = 0;

  for (let idx = 0; idx < scenes.length; idx++) {
    const sceneImgs = _savState.sceneImages[idx] || [];
    const imgIdx = scenes[idx].image_index;
    const hasGlobal = imgIdx >= 0 && imgIdx < globalImgs.length;
    if (sceneImgs.length || hasGlobal) continue; // 이미 있으면 건너뜀

    try {
      await savGenerateSceneImage(idx);
      generated++;
    } catch (e) {
      console.warn(`[SAV] 씬 ${idx + 1} 자동 생성 실패:`, e.message);
    }
  }

  if (generated) toast(`이미지 없는 ${generated}개 씬에 배경 컨셉 이미지 생성 완료`);
  else toast('모든 씬에 이미지가 있습니다');
}

// ── 소싱 이미지를 씬에 자동 배분 ──
function savAutoAssignImages() {
  const scenes = _savState.script?.scenes || [];
  const globalImgs = savGetImageUrls();
  if (!scenes.length || !globalImgs.length) return;

  for (let idx = 0; idx < scenes.length; idx++) {
    if (_savState.sceneImages[idx]?.length) continue; // 이미 있으면 건너뜀

    const scene = scenes[idx];
    // 1) 스크립트가 지정한 image_index 사용
    const imgIdx = scene.image_index;
    if (typeof imgIdx === 'number' && imgIdx >= 0 && imgIdx < globalImgs.length) {
      _savState.sceneImages[idx] = [globalImgs[imgIdx]];
      continue;
    }
    // 2) 이미지가 씬 수 이상이면 순서대로 배분
    if (globalImgs.length >= scenes.length) {
      _savState.sceneImages[idx] = [globalImgs[idx % globalImgs.length]];
      continue;
    }
    // 3) 이미지가 씬보다 적으면 라운드로빈
    if (globalImgs.length > 0) {
      _savState.sceneImages[idx] = [globalImgs[idx % globalImgs.length]];
    }
  }
}

function savUpdateSceneField(idx, field, value) {
  if (_savState.script?.scenes?.[idx]) {
    _savState.script.scenes[idx][field] = String(value || '').trim();
    if (idx === 0 && ['title', 'subtitle', 'narration', 'visual_prompt'].includes(field)) {
      savRenderSubtitlePreview();
    }
  }
}

// ── 영상 생성 ──
async function savGenerateVideo() {
  if (_savState.generating) { toast('이미 생성 중입니다', 'error'); return; }
  if (!_savState.script?.scenes?.length) { toast('스크립트를 먼저 생성하세요', 'error'); return; }

  // ② 스토리보드 승인 게이트 — 자동 진행 모드면 자동 승인, 수동이면 confirm 만 (취소해도 step 점프 X)
  const sb = _savState.storyboard || [];
  if (sb.length) {
    const unapproved = sb.filter(s => s.status === 'ok' && !(_savState.sbApproved && _savState.sbApproved[s.scene_index]));
    if (unapproved.length) {
      // 감독 자동 진행 중이면 묻지 않고 그대로 진행 (자동 승인)
      if (_savState._autoRunning) {
        if (!_savState.sbApproved) _savState.sbApproved = {};
        unapproved.forEach(s => { _savState.sbApproved[s.scene_index] = true; });
      } else {
        const ok = confirm(`스토리보드 미승인 씬 ${unapproved.length}개 (씬 ${unapproved.map(s=>s.scene_index).join(', ')}).\n\n그대로 영상 생성할까요?`);
        if (!ok) {
          // 취소만 하고 step 점프 X — 사용자가 직접 4단계 가서 승인
          toast('영상 생성을 취소했습니다. 4단계에서 스토리보드를 검토·승인해주세요.', 'info');
          return;
        }
      }
    }
  }

  _savState.generating = true;
  const btn = document.getElementById('sav-generate-btn');
  const statusEl = document.getElementById('sav-generate-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 영상 생성 중...'; }

  const scenes = _savState.script.scenes;
  _savState.sceneResults = scenes.map((_, idx) => ({ index: idx, status: 'pending' }));
  savRenderSceneResults();

  try {
    const imageUrls = savGetImageUrls();
    const ratio = document.getElementById('sav-ratio')?.value || '9:16';
    // Veo 네이티브 오디오는 항상 OFF (TTS + BGM 과 충돌 방지)
    const generateAudio = false;
    const addTts = !!document.getElementById('sav-add-tts')?.checked;
    const addBgm = !!document.getElementById('sav-add-bgm')?.checked;
    // 자막 사용 체크박스가 꺼져있으면 스타일을 'none' 으로 강제 (자막 없이 렌더)
    const subtitleEnabled = (function () {
      const el = document.getElementById('sav-add-subtitle');
      return el ? !!el.checked : true;
    })();
    const subtitleStyle = subtitleEnabled
      ? (document.getElementById('sav-subtitle-style')?.value || 'promo')
      : 'none';
    const subtitleFont = document.getElementById('sav-subtitle-font')?.value || window._contentOpts?.subtitle_font || 'nanum-square';
    const subtitleOptions = savGetSubtitleOptions();
    const bgmOptions = savGetBgmRequestOptions();
    const voice = document.getElementById('sav-voice')?.value || window._contentOpts?.voice || getOpt('voice', 'gemini-Kore');

    if (statusEl) statusEl.textContent = '씬별 Veo 영상 생성을 시작합니다...';

    // 진행 상황 폴링 시작 (실시간 로그 패널)
    const jobId = 'sav-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    _savState.jobId = jobId;
    savShowLiveLog();
    const pollStop = savStartProgressPoll(jobId);

    const resolution = document.getElementById('sav-resolution')?.value || '720p';
    const veoModel = document.getElementById('sav-model')?.value || 'veo-3.1-generate-preview';
    const enhancePrompt = !!document.getElementById('sav-enhance-prompt')?.checked;

    // Best-of-N 토글 확인
    const bestOfN = !!document.getElementById('sav-best-of-n')?.checked;
    const variantsPerScene = bestOfN ? 3 : 1;

    const res = await api('/api/advideo/generate', {
      method: 'POST',
      body: {
        job_id: jobId,
        script: _savState.script,
        image_urls: imageUrls,
        scene_images: _savState.sceneImages,
        aspect_ratio: ratio,
        variants_per_scene: variantsPerScene,
        character_reference_paths: (_savState.characterRefs || []).map(r => r.image_path).filter(Boolean),
        generate_audio: generateAudio,
        add_tts: addTts,
        add_bgm: addBgm && bgmOptions.bgm_mode !== 'none',
        subtitle_style: subtitleStyle,
        subtitle_font: subtitleFont,
        subtitle_position_y: subtitleOptions.subtitle_position_y,
        subtitle_width_pct: subtitleOptions.subtitle_width_pct,
        subtitle_font_scale: subtitleOptions.subtitle_font_scale,
        subtitle_align: subtitleOptions.subtitle_align,
        voice,
        resolution,
        veo_model: veoModel,
        technique: (document.getElementById('sav-technique')?.value || 'default'),
        camera_preset: (document.getElementById('sav-camera-preset')?.value || ''),
        lighting_preset: (document.getElementById('sav-lighting-preset')?.value || ''),
        style_preset: (document.getElementById('sav-style-preset')?.value || ''),
        camera_body: (document.getElementById('sav-camera-body')?.value || ''),
        lens_preset: (document.getElementById('sav-lens-preset')?.value || ''),
        focus_preset: (document.getElementById('sav-focus-preset')?.value || ''),
        soul_cast_archetype: (document.getElementById('sav-cast-archetype')?.value || ''),
        soul_cast_era: (document.getElementById('sav-cast-era')?.value || ''),
        soul_cast_vibe: (document.getElementById('sav-cast-vibe')?.value || ''),
        soul_cast_custom: (document.getElementById('sav-cast-custom')?.value || '').trim(),
        pacing: (document.getElementById('sav-pacing')?.value || ''),
        motion_intensity: parseInt(document.getElementById('sav-motion-intensity')?.value || '50', 10),
        negative_prompt: (document.getElementById('sav-negative-prompt')?.value || '').trim(),
        style_ref: (document.getElementById('sav-style-ref')?.value || '').trim(),
        soul_consistency: !!document.getElementById('sav-soul-consistency')?.checked,
        lipsync: !!document.getElementById('sav-lipsync')?.checked,
        enhance_prompt: enhancePrompt,
        bgm: bgmOptions.bgm,
        bgm_mode: bgmOptions.bgm_mode,
        bgm_url: bgmOptions.bgm_url,
        bgm_file: bgmOptions.bgm_file,
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
      },
    });

    _savState.projectDir = res.project_dir || '';
    _savState.finalVideoPath = res.video_path || '';

    // 씬 결과 업데이트
    (res.scene_results || []).forEach((sr, idx) => {
      _savState.sceneResults[idx] = {
        index: idx,
        status: sr.success ? 'done' : 'error',
        videoUrl: sr.video_url || '',
        error: sr.error || '',
      };
    });
    savRenderSceneResults();

    // 최종 영상 표시
    if (res.video_path) {
      const finalCard = document.getElementById('sav-final-card');
      const videoEl = document.getElementById('sav-final-video');
      const dlLink = document.getElementById('sav-download-link');
      if (finalCard) finalCard.style.display = 'block';
      if (videoEl) videoEl.src = '/api/video/file/' + encodeURIComponent(res.video_path);
      if (dlLink) { dlLink.href = '/api/video/file/' + encodeURIComponent(res.video_path); dlLink.download = 'ad_video.mp4'; }
      await savSaveHistoryEntry(res, scenes.length, ratio, voice);
      if (statusEl) statusEl.textContent = '광고 영상 생성 완료!';
      toast('광고 영상 생성 완료!');
    } else {
      if (statusEl) statusEl.textContent = '씬 영상은 생성됐으나 합성에 실패했습니다.';
      toast('씬 영상 생성 완료 (합성 실패)', 'error');
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = '영상 생성 실패: ' + e.message;
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    _savState.generating = false;
    try { if (typeof pollStop === 'function') pollStop(); } catch (_) {}
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 광고 영상 만들기'; }
  }
}

async function savSaveHistoryEntry(res, sceneCount, ratio, voice) {
  if (!res || !res.video_path) return;
  const profile = window._globalProfileData || {};
  const topic = (document.getElementById('sav-topic')?.value || '').trim() || 'AI영상';
  try {
    await api('/api/vag/save', {
      method: 'POST',
      body: {
        topic,
        video_path: res.video_path,
        project_dir: res.project_dir || '',
        scene_count: sceneCount || 0,
        aspect: ratio || '',
        voice: voice || '',
        profile_name: profile.name || '',
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
        final_prompt: '',
        source: 'advideo',
      },
    });
  } catch (e) {
    console.warn('[SAV] 히스토리 저장 실패:', e?.message || e);
  }
}

// 실시간 진행 로그 패널
function savShowLiveLog() {
  let panel = document.getElementById('sav-live-log');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'sav-live-log';
    panel.style.cssText = 'margin-top:14px;padding:14px 16px;background:#0f0b09;color:#fff6ef;border-radius:14px;font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.7;max-height:320px;overflow-y:auto;border:1px solid rgba(255,140,0,0.3);';
    const anchor = document.getElementById('sav-generate-status');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else {
      const btn = document.getElementById('sav-generate-btn');
      if (btn && btn.parentNode) btn.parentNode.appendChild(panel);
    }
  }
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div style="color:#ff8c00;font-weight:800;">🔴 실시간 진행 상황</div><div id="sav-log-pct" style="color:rgba(255,255,255,0.6);font-weight:700;">0%</div></div>'
    + '<div id="sav-log-bar" style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-bottom:10px;overflow:hidden;"><div id="sav-log-bar-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#ff8c00,#fbbf24);transition:width .4s;"></div></div>'
    + '<div id="sav-log-list"></div>';
}

function savStartProgressPoll(jobId) {
  let stopped = false;
  let lastCount = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await fetch('/api/advideo/status/' + encodeURIComponent(jobId));
      if (r.ok) {
        const d = await r.json();
        if (d && d.ok) {
          const pct = d.progress || 0;
          const list = document.getElementById('sav-log-list');
          const pctEl = document.getElementById('sav-log-pct');
          const barFill = document.getElementById('sav-log-bar-fill');
          if (pctEl) pctEl.textContent = pct + '%';
          if (barFill) barFill.style.width = pct + '%';
          if (list && Array.isArray(d.steps)) {
            if (d.steps.length > lastCount) {
              const newSteps = d.steps.slice(lastCount);
              newSteps.forEach(function (s) {
                const row = document.createElement('div');
                row.style.cssText = 'padding:3px 0;color:rgba(255,246,239,0.88);';
                row.innerHTML = '<span style="color:rgba(255,140,0,0.7);margin-right:8px;">' + s.time + '</span>' + _savEsc(s.message);
                list.appendChild(row);
              });
              lastCount = d.steps.length;
              list.scrollTop = list.scrollHeight;
              const panel = document.getElementById('sav-live-log');
              if (panel) panel.scrollTop = panel.scrollHeight;
            }
          }
          // 씬별 결과 실시간 반영
          if (Array.isArray(d.scene_results) && d.scene_results.length) {
            d.scene_results.forEach(function (sr) {
              const i = parseInt(sr.index, 10);
              if (isNaN(i)) return;
              _savState.sceneResults[i] = {
                index: i,
                status: sr.success ? 'done' : 'error',
                videoUrl: sr.video_url || '',
                error: sr.error || '',
              };
            });
            try { savRenderSceneResults(); } catch (e) {}
          }
          if (d.status === 'done' || d.status === 'error') { stopped = true; return; }
        }
      }
    } catch (_) { /* ignore */ }
    setTimeout(tick, 1500);
  };
  tick();
  return function () { stopped = true; };
}

function _savEsc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function savRenderSceneResults() {
  const wrap = document.getElementById('sav-scene-results');
  if (!wrap) return;
  if (!_savState.sceneResults.length) return;

  wrap.innerHTML = _savState.sceneResults.map((sr, idx) => {
    const scene = _savState.script?.scenes?.[idx] || {};
    const statusColor = sr.status === 'done' ? '#34c759' : sr.status === 'error' ? '#ff3b30' : sr.status === 'generating' ? '#ff8c00' : 'rgba(0,0,0,0.35)';
    const statusText = sr.status === 'done' ? '완료' : sr.status === 'error' ? (sr.error || '실패') : sr.status === 'generating' ? '생성 중...' : '대기';
    const isDone = sr.status === 'done' && sr.videoUrl;
    const isError = sr.status === 'error';
    // 씬별 확인·재생성 UI
    const videoBlock = isDone
      ? `<video src="${escapeHtml(sr.videoUrl)}" controls playsinline style="width:100%;max-width:480px;border-radius:10px;background:#000;margin-top:8px;"></video>`
      : '';
    const actionBlock = isDone
      ? `<div style="display:flex;gap:6px;margin-top:8px;">
          <button type="button" onclick="savRegenerateScene(${idx})" style="padding:6px 12px;font-size:11px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:rgba(255,140,0,0.08);color:#ff8c00;border-radius:8px;cursor:pointer;">🔄 이 씬 재생성</button>
          <button type="button" onclick="savApproveScene(${idx})" style="padding:6px 12px;font-size:11px;font-weight:700;border:none;background:linear-gradient(135deg,#34c759,#2eb34f);color:#fff;border-radius:8px;cursor:pointer;">✓ 이 씬 확인</button>
        </div>`
      : (isError
        ? `<div style="margin-top:8px;"><button type="button" onclick="savRegenerateScene(${idx})" style="padding:6px 12px;font-size:11px;font-weight:700;border:none;background:#ff3b30;color:#fff;border-radius:8px;cursor:pointer;">🔄 이 씬 재생성</button></div>`
        : '');
    const approvedBadge = sr.approved
      ? '<span style="padding:2px 8px;border-radius:999px;background:#34c759;color:#fff;font-size:10px;font-weight:800;margin-left:6px;">✓ 확인됨</span>'
      : '';
    // Best-of-N 대안 변종 표시
    const alts = (sr.alt_videos || sr.altVideos || []);
    const altBlock = (isDone && alts.length) ? `
      <details style="margin-top:6px;"><summary style="cursor:pointer;font-size:11px;color:#5856d6;font-weight:700;">🎞 Best-of-N 대안 ${alts.length}안 보기 · 메인으로 교체 가능</summary>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;margin-top:6px;">
          ${alts.map(a => `<div style="border:1px solid rgba(88,86,214,0.25);border-radius:8px;overflow:hidden;background:#fff;">
            <video src="${escapeHtml(a.url)}" controls playsinline style="width:100%;aspect-ratio:9/16;object-fit:cover;background:#000;"></video>
            <button type="button" onclick="savPickAltVideo(${idx}, '${escapeHtml(a.url)}')" style="width:100%;padding:4px;font-size:10px;font-weight:700;border:none;background:#5856d6;color:#fff;border-radius:0;cursor:pointer;">변종 ${a.variant} → 메인으로</button>
          </div>`).join('')}
        </div>
      </details>` : '';
    return `<div style="padding:12px;border:1px solid ${sr.approved ? 'rgba(52,199,89,0.4)' : 'rgba(0,0,0,0.08)'};border-radius:12px;background:${sr.approved ? 'rgba(52,199,89,0.04)' : '#fff'};">
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="width:36px;height:36px;border-radius:10px;background:${sr.status === 'done' ? 'rgba(52,199,89,0.1)' : 'rgba(0,0,0,0.04)'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:${statusColor};flex-shrink:0;">${idx + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#1c1c1e;">씬 ${idx + 1} · ${escapeHtml(scene.title || '')}${approvedBadge}</div>
          <div style="font-size:11px;color:${statusColor};margin-top:2px;">${escapeHtml(statusText)}</div>
        </div>
      </div>
      ${videoBlock}
      ${actionBlock}
      ${altBlock}
    </div>`;
  }).join('');
}

// Best-of-N 대안 변종을 메인 씬으로 교체
function savPickAltVideo(idx, url) {
  if (!_savState.sceneResults[idx]) return;
  _savState.sceneResults[idx].videoUrl = url;
  savRenderSceneResults();
  toast(`씬 ${idx + 1} 변종을 메인으로 교체`, 'success');
}
window.savPickAltVideo = savPickAltVideo;

// 씬별 확인 마크
function savApproveScene(idx) {
  if (!_savState.sceneResults[idx]) return;
  _savState.sceneResults[idx].approved = !_savState.sceneResults[idx].approved;
  savRenderSceneResults();
  const pending = _savState.sceneResults.filter(function (s) { return s && s.status === 'done' && !s.approved; });
  if (pending.length === 0 && _savState.sceneResults.length) {
    toast('모든 씬 확인 완료! 최종 영상 합성이 준비됐습니다.', 'success');
  } else {
    toast('씬 ' + (idx + 1) + ' 확인됨 (남은 미확인 씬: ' + pending.length + '개)', 'info');
  }
}
window.savApproveScene = savApproveScene;

// 씬별 재생성 (단일 씬만 다시 생성)
async function savRegenerateScene(idx) {
  if (!_savState.script?.scenes?.[idx]) return;
  const scene = _savState.script.scenes[idx];
  if (!confirm(`씬 ${idx + 1} "${scene.title || ''}" 를 다시 생성하시겠습니까?`)) return;
  _savState.sceneResults[idx] = { index: idx, status: 'generating', videoUrl: '', error: '' };
  savRenderSceneResults();
  try {
    const veoModel = document.getElementById('sav-model')?.value || 'veo-3.1-generate-preview';
    const ratio = document.getElementById('sav-ratio')?.value || '9:16';
    const resolution = document.getElementById('sav-resolution')?.value || '720p';
    const res = await api('/api/advideo/generate', {
      method: 'POST',
      body: {
        script: { scenes: [scene] },
        image_urls: savGetImageUrls(),
        scene_images: { 0: _savState.sceneImages[idx] || [] },
        aspect_ratio: ratio,
        add_tts: false, add_bgm: false, subtitle_style: 'none',
        veo_model: veoModel, resolution: resolution,
      },
    });
    const sr = (res.scene_results || [])[0];
    if (sr && sr.success) {
      _savState.sceneResults[idx] = {
        index: idx,
        status: 'done',
        videoUrl: sr.video_url || '',
        error: '',
        approved: false,
      };
      toast(`씬 ${idx + 1} 재생성 완료`, 'success');
    } else {
      _savState.sceneResults[idx] = { index: idx, status: 'error', videoUrl: '', error: (sr && sr.error) || '재생성 실패' };
      toast(`씬 ${idx + 1} 재생성 실패`, 'error');
    }
  } catch (e) {
    _savState.sceneResults[idx] = { index: idx, status: 'error', videoUrl: '', error: e.message };
    toast('재생성 오류: ' + e.message, 'error');
  }
  savRenderSceneResults();
}
window.savRegenerateScene = savRegenerateScene;

// ── URL만 넣고 자동 생성 (스크립트 → 영상 한 번에) ──
async function savAutoFromUrl() {
  const urlEl = document.getElementById('sav-source-url');
  const rawInput = (urlEl?.value || '').trim();
  if (!rawInput) {
    toast('URL을 입력하세요', 'error');
    return;
  }

  const btn = document.getElementById('sav-auto-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> URL 수집 → 스크립트 → 영상 자동 생성 중...'; }

  try {
    // 1. URL 수집 (있으면 수집, 없으면 건너뜀)
    const hasUrl = (document.getElementById('sav-source-url')?.value || '').trim();
    if (hasUrl) await savImportFromUrl();
    if (!(document.getElementById('sav-topic')?.value || '').trim() && !(document.getElementById('sav-message')?.value || '').trim()) {
      throw new Error('주제나 메시지를 입력하세요. URL을 넣으면 자동 수집됩니다.');
    }

    // 2. 스크립트 생성
    await savGenerateScript();
    if (!_savState.script?.scenes?.length) throw new Error('스크립트 생성 실패');

    // 3. 영상 생성
    await savGenerateVideo();
    toast('자동 생성 완료!');
  } catch (e) {
    toast('자동 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg> URL만 넣고 자동 생성 (스크립트 → 영상 한 번에)'; }
  }
}

function savOpenFolder() {
  if (_savState.projectDir) {
    api('/api/open-folder', { method: 'POST', body: { folder: _savState.projectDir } })
      .then(() => toast('폴더 열림'))
      .catch(e => toast('폴더 열기 실패: ' + e.message, 'error'));
  }
}
