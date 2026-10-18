// keyword_content/sources/video_shortcut.js — Veo AI 영상 옵션/생성 + 카드뉴스→영상 + 영상 업로드 숏컷

// AI 인스타 캡션 자동 생성
async function kcVeoGenerate() {
  kcShowVeoOptions();
}

function kcShowVeoOptions() {
  let modal = document.getElementById('veo-options-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'veo-options-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:22px;padding:28px;width:92%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">AI 영상 옵션</h2>
        <button onclick="document.getElementById('veo-options-modal').remove()" style="background:rgba(0,0,0,0.06);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(0,0,0,0.4);">×</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">영상 비율</div>
          <div style="display:flex;gap:6px;">
            <label class="qs-btn qs-active" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-ratio" value="9:16" checked style="display:none;"> 9:16 세로</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-ratio" value="1:1" style="display:none;"> 1:1 정사각</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-ratio" value="16:9" style="display:none;"> 16:9 가로</label>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">장면당 길이</div>
          <div style="display:flex;gap:6px;">
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-duration" value="5" style="display:none;"> 5초</label>
            <label class="qs-btn qs-active" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-duration" value="8" checked style="display:none;"> 8초</label>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">카메라 움직임</div>
          <div style="display:flex;gap:6px;">
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-camera" value="minimal" style="display:none;"> 최소</label>
            <label class="qs-btn qs-active" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-camera" value="subtle" checked style="display:none;"> 부드러운</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-camera" value="moderate" style="display:none;"> 보통</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-camera" value="dynamic" style="display:none;"> 역동적</label>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">나레이션</div>
          <div style="display:flex;gap:6px;">
            <label class="qs-btn qs-active" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-narration" value="on" checked style="display:none;"> TTS 나레이션</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-narration" value="veo" style="display:none;"> Veo 원본 음성</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 12px;font-size:12px;"><input type="radio" name="veo-narration" value="off" style="display:none;"> BGM만</label>
          </div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">배경음악 (BGM)</div>
          <select id="veo-bgm-select" style="padding:7px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.1);font-size:12px;background:#f9f9fb;width:100%;">
            <option value="random">라이브러리 랜덤</option>
          </select>
          <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:6px;">프로필 BGM 탭에서 저장한 음원을 AI 영상에도 바로 적용할 수 있습니다.</div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">TTS 음성</div>
          <select id="veo-voice" style="padding:7px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.1);font-size:12px;background:#f9f9fb;width:100%;">
            <option value="gemini-Kore">Kore (한국어)</option>
            <option value="gemini-Aoede">Aoede</option>
            <option value="gemini-Charon">Charon</option>
            <option value="gemini-Fenrir">Fenrir</option>
            <option value="gemini-Puck">Puck</option>
          </select>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">자막 스타일</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <label class="qs-btn qs-active" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="promo" checked style="display:none;"> 프로모션</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="minimal" style="display:none;"> 미니멀</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="neon" style="display:none;"> 네온</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="pop" style="display:none;"> 팝</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="news" style="display:none;"> 뉴스</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="cinematic" style="display:none;"> 시네마틱</label>
            <label class="qs-btn" style="cursor:pointer;padding:5px 10px;font-size:11px;"><input type="radio" name="veo-subtitle" value="none" style="display:none;"> 없음</label>
          </div>
        </div>
      </div>

      <button onclick="kcStartVeoGenerate()" style="margin-top:18px;width:100%;padding:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg>영상 생성 시작</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  kcPopulateVeoBgmSelect().catch(() => {});
}

function kcStartVeoGenerate() {
  const profileId = parseInt(window._globalProfileId || 0);
  const bgmVal = document.getElementById('veo-bgm-select')?.value || 'random';
  window._veoOptions = window._veoOptions || {};
  window._veoOptions.aspect_ratio = document.querySelector('input[name="veo-ratio"]:checked')?.value || '9:16';
  window._veoOptions.duration = document.querySelector('input[name="veo-duration"]:checked')?.value || '8';
  window._veoOptions.camera_freedom = document.querySelector('input[name="veo-camera"]:checked')?.value || 'subtle';
  window._veoOptions.narration_mode = document.querySelector('input[name="veo-narration"]:checked')?.value || 'on';
  window._veoOptions.voice = document.getElementById('veo-voice')?.value || 'gemini-Kore';
  window._veoOptions.subtitle_style = document.querySelector('input[name="veo-subtitle"]:checked')?.value || 'promo';
  window._veoOptions.bgm = bgmVal;
  window._veoOptions.bgm_mode = 'random';
  window._veoOptions.bgm_url = '';
  window._veoOptions.bgm_file = '';
  window._veoOptions.skip_bgm = bgmVal === 'none';

  if (bgmVal === 'none') {
    window._veoOptions.bgm_mode = 'none';
  } else if (bgmVal === 'random') {
    window._veoOptions.bgm_mode = 'random';
  } else if (bgmVal.startsWith('file:')) {
    const bgmFile = decodeURIComponent(bgmVal.slice(5));
    window._veoOptions.bgm_mode = 'selected';
    window._veoOptions.bgm_file = bgmFile;
    window._veoOptions.bgm_url = `/api/bgm/file/${bgmFile}?profile_id=${profileId}`;
  }
  document.getElementById('veo-options-modal')?.remove();
  kcCardnewsToVideo('veo');
}

async function kcPopulateVeoBgmSelect() {
  const select = document.getElementById('veo-bgm-select');
  if (!select) return;
  const profileId = parseInt(window._globalProfileId || 0);
  const currentUrl = window._contentOpts?.bgm_url || '';

  select.innerHTML = `
    <option value="random">라이브러리 랜덤</option>
    <option value="none">BGM 없음</option>
  `;

  if (profileId) {
    try {
      const res = await api(`/api/bgm/list?profile_id=${profileId}`);
      (res.files || []).forEach(file => {
        const opt = document.createElement('option');
        opt.value = `file:${encodeURIComponent(file.path)}`;
        opt.textContent = `직접 선택: ${file.name}`;
        if (currentUrl.includes(file.path)) opt.selected = true;
        select.appendChild(opt);
      });
    } catch {}
  }

  if (!currentUrl) {
    select.value = 'random';
  }
}

function kcLoadNarrationFromSlides() {
  // 카드뉴스 텍스트에서 대사 불러오기
  const slides = _kcCnTexts || [];
  const container = document.getElementById('kc-narration-list');
  if (!container) return;

  if (slides.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:rgba(0,0,0,0.3);text-align:center;padding:12px;">카드뉴스 텍스트가 없습니다</div>';
    return;
  }

  container.innerHTML = slides.map((s, i) => {
    const title = s.title || `슬라이드 ${i + 1}`;
    const body = s.body || '';
    // 대사: 제목 + 본문을 자연스럽게 합치기
    const narration = `${title}. ${body}`.replace(/[•·\-]/g, '').replace(/\n+/g, ' ').trim();
    return `
      <div style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:8px;">
        <div style="min-width:24px;height:24px;border-radius:6px;background:#5b9bf5;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
        <textarea class="kc-narration-text" rows="2" style="flex:1;padding:6px 8px;font-size:12px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;resize:vertical;line-height:1.5;">${escapeHtml(narration)}</textarea>
      </div>`;
  }).join('');
  toast(`${slides.length}개 슬라이드 대사 불러옴`);
}

async function kcConvertToNarration() {
  const textareas = document.querySelectorAll('.kc-narration-text');
  if (textareas.length === 0) { toast('먼저 "불러오기"를 눌러주세요', 'error'); return; }

  const btn = document.getElementById('kc-narration-ai-btn');
  btn.disabled = true; btn.textContent = '변환 중...';

  const originals = [...textareas].map(t => t.value.trim());

  try {
    const res = await api('/api/content/convert-narration', {
      method: 'POST',
      body: { texts: originals, profile_id: parseInt(window._globalProfileId || 0) },
    });
    const narrations = res.narrations || [];
    narrations.forEach((n, i) => {
      if (textareas[i] && n) textareas[i].value = n;
    });
    toast(`${narrations.length}개 슬라이드 나레이션 변환 완료`);
  } catch (e) {
    toast('나레이션 변환 실패: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = 'AI 나레이션 변환';
}

function kcGetNarrations() {
  // 편집된 대사 텍스트 배열 반환
  const textareas = document.querySelectorAll('.kc-narration-text');
  if (textareas.length === 0) return null;
  return [...textareas].map(t => t.value.trim());
}

async function kcCardnewsToVideo(mode) {
  const isVeo = mode === 'veo';
  const btn = document.getElementById(isVeo ? 'kc-cn-to-veo-btn' : 'kc-cn-to-video-btn');
  // 버튼에 저장된 폴더 → 변수 → 순서로 찾기
  const videoDir = btn?.getAttribute('data-dir') || _kcCardnewsDir || '';
  if (!videoDir && !_kcCnCardnewsId) { toast('카드뉴스 이미지를 먼저 생성해주세요', 'error'); return; }
  console.log(`[영상] 사용할 폴더: ${videoDir}`);
  const originalText = btn?.innerHTML || '';
  btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;"></span> ${isVeo ? 'AI 영상 생성 중...' : '슬라이드 영상 변환 중...'}`;
  try {
    let res;
    if (isVeo) {
      const keyword = document.getElementById('kc-keyword')?.value || '';
      const finalPrompt = (_kcPromptOverrides && _kcPromptOverrides.video_bundle?.final_prompt)
        ? _kcPromptOverrides.video_bundle.final_prompt
        : (_kcPromptOverrides && _kcPromptOverrides.video_prompt)
        ? _kcPromptOverrides.video_prompt
        : (_kcLastPromptSourceSummary || keyword || '한국 도시 풍경');
      const scenePlanText = (_kcPromptOverrides && (_kcPromptOverrides.video_scene_plan || _kcPromptOverrides.video_bundle?.scene_plan)) || '';
      const parsedScenePlan = kcParsePromptBundle(scenePlanText, []);
      res = await api('/api/video/create', {
        method: 'POST',
        body: {
          source: 'cardnews',
          method: 'veo3',
          topic: keyword,
          slides: _kcCnTexts || [],
          cardnews_id: _kcCnCardnewsId || undefined,
          project_dir: videoDir || '',
          source_text: finalPrompt,
          script_override: finalPrompt,
          scene_plan: parsedScenePlan,
          scene_count: parsedScenePlan.length || Math.min((_kcCnTexts || []).length || 3, 5),
          veo_model: window._contentOpts?.veo_model || 'veo-3.1-generate-preview',
          brand_name: document.getElementById('kc-brand-name')?.value || '',
          camera_freedom: window._veoOptions?.camera_freedom || 'subtle',
          narration_mode: window._veoOptions?.narration_mode || 'on',
          voice: window._veoOptions?.voice || 'gemini-Kore',
          aspect_ratio: window._veoOptions?.aspect_ratio || '9:16',
          duration: window._veoOptions?.duration || '8',
          subtitle_style: window._veoOptions?.subtitle_style || 'promo',
          subtitle_font: window._contentOpts?.subtitle_font || 'nanum-square',
          bgm_mode: window._veoOptions?.bgm_mode || window._contentOpts?.bgm_mode || 'random',
          bgm_url: window._veoOptions?.bgm_url || window._contentOpts?.bgm_url || '',
          bgm_file: window._veoOptions?.bgm_file || '',
          skip_bgm: window._veoOptions?.skip_bgm || false,
          bgm: window._veoOptions?.bgm || 'random',
        },
      });
    } else {
      // 슬라이드 영상 — videoDir(이미지 실제 위치) 직접 전달
      const subtitleStyle = window._contentOpts?.subtitle || 'promo';
      const subtitleOn = subtitleStyle !== 'none';
      const narrations = kcGetNarrations();
      const body = { project_dir: videoDir, subtitle: subtitleOn, subtitle_style: subtitleStyle };
      if (narrations) body.narrations = narrations;
      res = await api('/api/video/from-cardnews', { method: 'POST', body });
    }
    if (res.video_path) {
      _kcVideoPath = res.video_path;
      const vp = res.video_path.split('/videos/');
      const relPath = vp.length > 1 ? vp[1] : res.video_path;
      const vidResult = document.getElementById('kc-video-result');
      if (vidResult) {
        document.getElementById('kc-video-player').src = `/api/video/file/${relPath}`;
        vidResult.style.display = 'block';
        vidResult.scrollIntoView({ behavior: 'smooth' });
      }
      // 프로젝트에 video_path 저장
      if (_kcProjectId) {
        api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { video_path: res.video_path } }).catch(() => {});
      }
      toast(`${isVeo ? 'AI' : '슬라이드'} 영상 생성 완료!`);
    } else {
      toast('영상 생성 실패', 'error');
    }
  } catch (e) {
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function kcUploadVideoToYoutube() {
  if (!_kcVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  const btn = event?.target?.closest('button');
  if (!confirm('YouTube에 영상을 업로드할까요?')) return;
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    const keyword = document.getElementById('kc-keyword')?.value || '영상';
    const result = await api('/api/upload/youtube', {
      method: 'POST',
      body: { video_path: _kcVideoPath, title: keyword, description: '', privacy_status: 'public', is_shorts: true }
    });
    if (btn) { btn.innerHTML = '&#10003; 유튜브 완료'; btn.style.background = '#34c759'; }
    if (_kcProjectId) {
      api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { youtube_uploaded_at: new Date().toISOString(), youtube_url: result.url || '' } }).catch(() => {});
    }
    toast('YouTube 쇼츠 업로드 완료! ' + (result.url || ''));
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '유튜브 쇼츠 재시도'; }
    toast('YouTube 업로드 실패: ' + e.message, 'error');
  }
}

async function kcUploadVideoToReels() {
  if (!_kcVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  const btn = event?.target?.closest('button');
  if (!confirm('인스타그램에 릴스를 업로드할까요?')) return;
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    const caption = document.getElementById('kc-cn-ig-caption')?.value || '';
    await api('/api/instagram/reels', {
      method: 'POST',
      body: { video_path: _kcVideoPath, caption: caption }
    });
    if (btn) { btn.innerHTML = '&#10003; 릴스 완료'; btn.style.background = '#34c759'; }
    toast('인스타 릴스 업로드 완료!');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '인스타 릴스 재시도'; }
    toast('릴스 업로드 실패: ' + e.message, 'error');
  }
}

function kcUploadVideoToTiktok() {
  if (!_kcVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  toast('TikTok 업로드 페이지를 열고 영상 폴더를 엽니다');
  window.open('https://www.tiktok.com/upload', '_blank');
  api('/api/open-folder', { method: 'POST', body: { folder: 'output/videos' } });
}

async function kcAutoCaption() {
  const keyword = document.getElementById('kc-keyword').value.trim();
  const blogBody = document.getElementById('kc-blog-body')?.value?.substring(0, 2000) || keyword;
  const blogTitle = document.getElementById('kc-blog-title')?.value?.trim() || keyword;
  const brand = document.getElementById('kc-business-name')?.value?.trim() || '';
  const captionEl = document.getElementById('kc-cn-ig-caption');
  if (!captionEl) return;
  captionEl.value = 'AI 캡션 생성 중...';
  try {
    const res = await api('/api/content/generate-ig-caption', {
      method: 'POST',
      body: {
        keyword,
        title: blogTitle,
        content: blogBody,
        brand_name: brand,
        profile_id: parseInt(window._globalProfileId || 0),
      },
    });
    captionEl.value = res.caption || `${blogTitle}\n\n${brand}`;
  } catch {
    captionEl.value = `${blogTitle}\n\n${brand ? brand + '\n' : ''}${keyword}`;
  }
}
