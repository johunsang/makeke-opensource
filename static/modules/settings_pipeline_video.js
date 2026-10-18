// ============================================================
// Settings - Gemini
// ============================================================

async function saveAtlasKey() {
  try {
    const el = document.getElementById('set-atlas-key');
    const key = (el?.value || '').trim();
    if (!key) { toast('Atlas Cloud 키를 입력하세요', 'error'); return; }
    if (key.length < 8) { toast('Atlas 키 형식이 올바르지 않습니다', 'error'); return; }
    await api('/api/config/update', { method: 'POST', body: { section: 'API', key: 'atlas_key', value: key } });
    if (el) {
      el.value = '';
      el.dataset.original = 'saved';
      el.placeholder = '••••••• (저장됨, 변경 시 새 키 입력)';
    }
    toast('Atlas Cloud 키 저장 완료 (Seedance · Veo · Kling · Wan 등 100+ 모델 활성화)');
  } catch (e) {
    toast('Atlas 키 저장 실패: ' + e.message, 'error');
  }
}

function openAtlasKeyPage() {
  window.open('https://www.atlascloud.ai/ko', '_blank', 'noopener');
}
window.openAtlasKeyPage = openAtlasKeyPage;

// 하위 호환
async function saveFalKey() { return saveAtlasKey(); }

async function saveGeminiSettings() {
  try {
    const el = document.getElementById('set-gemini-key');
    const key = el.value.trim();
    const original = el.dataset.original || '';
    if (key && key !== original && key.length > 10) {
      await api('/api/config/update', { method: 'POST', body: { section: 'API', key: 'gemini_api_key', value: key } });
      el.dataset.original = key;
      toast('Gemini API 키 저장 완료!');
    } else if (!key) {
      toast('API 키를 입력하세요', 'error');
    } else {
      toast('이미 저장된 키입니다');
    }
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

// === API 키 검증 ===
async function verifyGeminiKey() {
  const btn = document.getElementById('verify-gemini-btn');
  btn.disabled = true; btn.textContent = '검증 중...';
  try {
    const res = await api('/api/verify/gemini');
    if (res.valid) {
      btn.textContent = '유효함';
      btn.style.background = 'rgba(52,199,89,0.15)'; btn.style.color = '#34c759'; btn.style.borderColor = 'rgba(52,199,89,0.3)';
      toast('Gemini API 키가 유효합니다!');
    } else {
      btn.textContent = '무효';
      btn.style.background = 'rgba(255,59,48,0.1)'; btn.style.color = '#ff3b30'; btn.style.borderColor = 'rgba(255,59,48,0.2)';
      toast('Gemini API 키가 유효하지 않습니다: ' + (res.error || ''), 'error');
    }
  } catch (e) {
    btn.textContent = '실패';
    toast('검증 실패: ' + e.message, 'error');
  }
  btn.disabled = false;
}

async function verifyNaverDatalab() {
  const btn = document.getElementById('verify-naver-datalab-btn');
  btn.disabled = true; btn.textContent = '검증 중...';
  try {
    const res = await api('/api/verify/naver-datalab');
    if (res.valid) {
      btn.textContent = '유효함';
      btn.style.background = 'rgba(52,199,89,0.15)'; btn.style.color = '#34c759'; btn.style.borderColor = 'rgba(52,199,89,0.3)';
      toast('네이버 데이터랩 API 키가 유효합니다!');
    } else {
      btn.textContent = '무효';
      btn.style.background = 'rgba(255,59,48,0.1)'; btn.style.color = '#ff3b30'; btn.style.borderColor = 'rgba(255,59,48,0.2)';
      toast('데이터랩 API 키 오류: ' + (res.error || ''), 'error');
    }
  } catch (e) { btn.textContent = '실패'; toast('검증 실패: ' + e.message, 'error'); }
  btn.disabled = false;
}

async function verifyNaverSearchAd() {
  const btn = document.getElementById('verify-naver-ad-btn');
  btn.disabled = true; btn.textContent = '검증 중...';
  try {
    const res = await api('/api/verify/naver-searchad');
    if (res.valid) {
      btn.textContent = '유효함';
      btn.style.background = 'rgba(52,199,89,0.15)'; btn.style.color = '#34c759'; btn.style.borderColor = 'rgba(52,199,89,0.3)';
      toast('네이버 검색광고 API 키가 유효합니다!');
    } else {
      btn.textContent = '무효';
      btn.style.background = 'rgba(255,59,48,0.1)'; btn.style.color = '#ff3b30'; btn.style.borderColor = 'rgba(255,59,48,0.2)';
      toast('검색광고 API 키 오류: ' + (res.error || ''), 'error');
    }
  } catch (e) { btn.textContent = '실패'; toast('검증 실패: ' + e.message, 'error'); }
  btn.disabled = false;
}

// === 네이버 API 설정 저장 ===
async function saveNaverApiSettings() {
  try {
    const fields = [
      { id: 'set-naver-client-id', section: 'NAVER_API', key: 'client_id' },
      { id: 'set-naver-client-secret', section: 'NAVER_API', key: 'client_secret' },
      { id: 'set-naver-ad-license', section: 'NAVER_API', key: 'ad_api_license' },
      { id: 'set-naver-ad-secret', section: 'NAVER_API', key: 'ad_api_secret' },
      { id: 'set-naver-ad-customer', section: 'NAVER_API', key: 'ad_customer_id' },
    ];
    for (const f of fields) {
      const val = document.getElementById(f.id)?.value?.trim();
      if (val) await api('/api/config/update', { method: 'POST', body: { section: f.section, key: f.key, value: val } });
    }
    toast('네이버 API 설정 저장 완료!');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

// === 인스타그램 설정 저장 ===
async function saveInstagramSettings() {
  try {
    const id = document.getElementById('set-ig-id').value;
    const pw = document.getElementById('set-ig-pw').value;
    if (id) await api('/api/config/update', { method: 'POST', body: { section: 'INSTAGRAM', key: 'instagram_id', value: id } });
    if (pw && !pw.includes('***')) await api('/api/config/update', { method: 'POST', body: { section: 'INSTAGRAM', key: 'instagram_pw', value: pw } });
    toast('인스타그램 설정 저장 완료!');
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

// === 전체 파이프라인 ===
let lastVideoPath = '';

function pipeStep(id, label, status) {
  const container = document.getElementById('pipe-steps');
  let el = document.getElementById('pipe-step-' + id);
  const icons = { pending: '⏳', running: '🔄', done: '✅', error: '❌' };
  const colors = { pending: '#6b7f8e', running: '#5b9bf5', done: '#4fc08d', error: '#e05c5c' };
  if (!el) {
    el = document.createElement('div');
    el.id = 'pipe-step-' + id;
    el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:8px;background:#0f1923;font-size:14px;';
    container.appendChild(el);
  }
  el.innerHTML = `<span style="font-size:18px;">${icons[status]}</span><span style="color:${colors[status]};font-weight:600;">${label}</span>`;
}

async function runPipeline() {
  const keyword = document.getElementById('pipe-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }

  const btn = document.getElementById('pipe-run-btn');
  btn.disabled = true;
  btn.textContent = '실행 중...';

  const card = document.getElementById('pipe-progress-card');
  card.style.display = 'block';
  document.getElementById('pipe-steps').innerHTML = '';
  document.getElementById('pipe-result').style.display = 'none';

  pipeStep('blog', '1. 블로그 글 생성', 'running');
  pipeStep('video', '2. 영상 변환', 'pending');
  pipeStep('reels', '3. 인스타 릴스 업로드', 'pending');

  try {
    const res = await api('/api/pipeline/full', {
      method: 'POST',
      body: {
        keyword,
        business_name: document.getElementById('pipe-business-name').value,
        business_type: document.getElementById('pipe-business-type').value,
        tone: document.getElementById('pipe-tone').value,
        voice: document.getElementById('pipe-voice').value,
        scene_count: parseInt(document.getElementById('pipe-scenes').value),
        auto_publish_blog: document.getElementById('pipe-publish-blog').checked,
        auto_upload_reels: document.getElementById('pipe-upload-reels').checked,
        reels_caption: document.getElementById('pipe-caption').value,
      }
    });

    // 결과 업데이트
    const steps = res.steps || [];
    pipeStep('blog', `1. 블로그 글 생성 - "${(res.title||'').substring(0,30)}..." (${res.char_count||0}자)`, steps.includes('blog_generated') ? 'done' : 'error');
    pipeStep('video', `2. 영상 변환${res.video ? ' - ' + res.video.duration + '초' : ''}`, steps.includes('video_generated') ? 'done' : (res.errors && res.errors.some(e => e.includes('영상')) ? 'error' : 'pending'));
    pipeStep('reels', '3. 인스타 릴스 업로드', steps.includes('reels_uploaded') ? 'done' : (res.errors && res.errors.some(e => e.includes('릴스') || e.includes('인스타')) ? 'error' : 'pending'));

    if (res.video && res.video.video_path) lastVideoPath = res.video.video_path;

    // 결과 카드
    const resultDiv = document.getElementById('pipe-result');
    resultDiv.style.display = 'block';
    let html = `<div style="padding:16px;background:#0f1923;border-radius:8px;">`;
    html += `<div style="font-size:16px;font-weight:600;color:#4fc08d;margin-bottom:12px;">${res.status === 'ok' ? '전체 완료!' : '부분 완료'}</div>`;
    html += `<div style="font-size:13px;color:#8899aa;">완료 단계: ${steps.join(' → ')}</div>`;
    if (res.errors && res.errors.length) {
      html += `<div style="color:#e05c5c;font-size:13px;margin-top:8px;">${res.errors.join('<br>')}</div>`;
    }
    if (res.video && res.video.video_path) {
      const relPath = res.video.video_path.split('/videos/').pop();
      html += `<div style="margin-top:16px;"><video controls src="/api/video/file/${relPath}" style="width:100%;max-width:320px;border-radius:12px;background:#000;"></video></div>`;
    }
    html += `</div>`;
    resultDiv.innerHTML = html;

    toast(res.status === 'ok' ? '파이프라인 완료!' : '파이프라인 부분 완료', res.status === 'ok' ? 'success' : 'error');
  } catch (e) {
    pipeStep('blog', '1. 블로그 글 생성', 'error');
    pipeStep('video', '2. 영상 변환', 'error');
    pipeStep('reels', '3. 인스타 릴스 업로드', 'error');
    toast('파이프라인 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '전체 자동화 실행';
  }
}

// === 카드뉴스 파이프라인 ===

function cnpStep(id, label, status) {
  const container = document.getElementById('cnp-steps');
  let el = document.getElementById('cnp-step-' + id);
  const icons = { pending: '⏳', running: '🔄', done: '✅', error: '❌' };
  const colors = { pending: '#6b7f8e', running: '#5b9bf5', done: '#4fc08d', error: '#e05c5c' };
  if (!el) {
    el = document.createElement('div');
    el.id = 'cnp-step-' + id;
    el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:8px;background:#0f1923;font-size:14px;';
    container.appendChild(el);
  }
  el.innerHTML = `<span style="font-size:18px;">${icons[status]}</span><span style="color:${colors[status]};font-weight:600;">${label}</span>`;
}

// ── 발행 페이지 ──
let _pubMode = 'blog';
let _pubSelected = null;

function pubSwitchTab(mode) {
  _pubMode = mode;
  document.getElementById('pub-blog-select').style.display = mode === 'blog' ? 'block' : 'none';
  document.getElementById('pub-cardnews-select').style.display = mode === 'cardnews' ? 'block' : 'none';
  document.getElementById('pub-video-select').style.display = mode === 'video' ? 'block' : 'none';
  document.getElementById('pub-tab-blog').style.background = mode === 'blog' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('pub-tab-cardnews').style.background = mode === 'cardnews' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('pub-tab-video').style.background = mode === 'video' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('pub-actions-card').style.display = 'none';
}

async function pubLoadSources() {
  try {
    const posts = await api('/api/blog/posts');
    const sel = document.getElementById('pub-blog-id');
    sel.innerHTML = '<option value="">-- 블로그 글 선택 --</option>';
    (posts.posts || []).forEach(p => {
      sel.innerHTML += `<option value="${p.id}" data-title="${escapeHtml(p.title)}">${escapeHtml(p.title)} (${p.char_count}자)</option>`;
    });
  } catch {}
  try {
    const data = await api('/api/cardnews/history?limit=30');
    const sel = document.getElementById('pub-cn-id');
    sel.innerHTML = '<option value="">-- 카드뉴스 선택 --</option>';
    (data.items || []).forEach(item => {
      if (item.project_dir) {
        sel.innerHTML += `<option value="${item.id}" data-dir="${escapeHtml(item.project_dir)}" data-topic="${escapeHtml(item.topic)}">${escapeHtml(item.topic)} (${item.slide_count}장)</option>`;
      }
    });
  } catch {}
  try {
    const videos = await api('/api/videos');
    const sel = document.getElementById('pub-vid-id');
    sel.innerHTML = '<option value="">-- 영상 선택 --</option>';
    (videos || []).forEach(v => {
      sel.innerHTML += `<option value="${escapeHtml(v.path)}" data-url="${escapeHtml(v.url)}" data-title="${escapeHtml(v.title||v.filename)}">${escapeHtml(v.title||v.filename)}</option>`;
    });
  } catch {}
}

function pubOnSelect() {
  _pubSelected = null;
  if (_pubMode === 'blog') {
    const opt = document.getElementById('pub-blog-id').selectedOptions[0];
    if (opt && opt.value) _pubSelected = { type: 'blog', id: parseInt(opt.value), title: opt.dataset.title };
  } else if (_pubMode === 'cardnews') {
    const opt = document.getElementById('pub-cn-id').selectedOptions[0];
    if (opt && opt.value) _pubSelected = { type: 'cardnews', id: parseInt(opt.value), dir: opt.dataset.dir, topic: opt.dataset.topic };
  } else if (_pubMode === 'video') {
    const opt = document.getElementById('pub-vid-id').selectedOptions[0];
    if (opt && opt.value) _pubSelected = { type: 'video', path: opt.value, url: opt.dataset.url, title: opt.dataset.title };
  }
  document.getElementById('pub-actions-card').style.display = _pubSelected ? 'block' : 'none';
}

async function pubAction(action) {
  if (!_pubSelected) { toast('콘텐츠를 먼저 선택하세요', 'error'); return; }

  switch (action) {
    case 'blog-text':
      if (_pubSelected.type === 'blog') publishPost(_pubSelected.id);
      else if (_pubSelected.type === 'cardnews') publishGalleryToBlog(_pubSelected.id);
      else toast('블로그 글 또는 카드뉴스를 선택하세요', 'error');
      break;
    case 'blog-image':
      if (_pubSelected.type === 'cardnews') publishGalleryToBlogAsImages(_pubSelected.id, _pubSelected.dir);
      else toast('카드뉴스를 선택하세요 (이미지 발행)', 'error');
      break;
    case 'insta':
      if (_pubSelected.type === 'cardnews') uploadGalleryToInsta(_pubSelected.id, _pubSelected.dir);
      else toast('카드뉴스를 선택하세요', 'error');
      break;
    case 'reels':
      toast('인스타 릴스는 영상을 선택하세요'); break;
    case 'youtube':
      toast('유튜브 쇼츠 업로드 준비 중'); break;
    case 'tiktok':
      toast('틱톡 업로드 준비 중'); break;
    case 'threads':
    case 'twitter': {
      const snsType = action === 'threads' ? '스레드' : '트위터(X)';
      const resultCard = document.getElementById('pub-result-card');
      const resultContent = document.getElementById('pub-result-content');
      resultCard.style.display = 'block';
      resultContent.innerHTML = `<div style="text-align:center;padding:20px;"><span class="spinner"></span> ${snsType} 글 생성 중...</div>`;
      try {
        let topic = _pubSelected.title || _pubSelected.topic || '';
        let sourceText = '';
        if (_pubSelected.type === 'blog') {
          const d = await api('/api/blog/posts/' + _pubSelected.id);
          sourceText = d.post.content.substring(0, 2000);
        } else if (_pubSelected.type === 'cardnews') {
          const d = await api('/api/cardnews/history/' + _pubSelected.id);
          sourceText = (d.item.slides||[]).map(s => s.title+': '+s.body).join('\n');
        }
        const res = await api('/api/content/generate-sns', { method: 'POST', body: { topic, source_text: sourceText, platform: action, profile_id: parseInt(window._globalProfileId || 0) } });
        resultContent.innerHTML = `
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">${snsType} 글</div>
          <textarea id="pub-sns-text" rows="6" style="font-size:14px;line-height:1.6;">${escapeHtml(res.text||'')}</textarea>
          <div class="btn-group" style="margin-top:10px;">
            <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('pub-sns-text').value);toast('복사 완료!')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>복사</button>
          </div>`;
      } catch (e) { resultContent.innerHTML = `<div style="color:#ff453a;">실패: ${escapeHtml(e.message)}</div>`; }
      break;
    }
  }
}

// 발행 페이지 진입 시 소스 로드
const _pubObserver = new MutationObserver(function() {
  const page = document.getElementById('page-publish');
  if (page && page.classList.contains('active')) pubLoadSources();
});
if (document.getElementById('page-publish')) {
  _pubObserver.observe(document.getElementById('page-publish'), { attributes: true, attributeFilter: ['class'] });
}

// ── 영상 목록 페이지 ──
async function vlLoadVideos() {
  const container = document.getElementById('vl-list');
  try {
    const videos = await api('/api/videos');
    if (!videos || videos.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">생성된 영상이 없습니다.<br><span style="font-size:12px;">변환/발행에서 영상을 생성해보세요.</span></div>';
      return;
    }
    container.innerHTML = videos.map((v, i) => `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="vlPlay('${escapeHtml(v.url)}','${escapeHtml(v.title || v.filename)}')">
        <video src="${escapeHtml(v.url)}" muted loop playsinline
          style="width:90px;height:160px;object-fit:cover;border-radius:10px;background:#000;flex-shrink:0;"
          onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.title || v.filename)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:3px;">${v.created || ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;flex-direction:column;">
          <button class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 10px;" onclick="event.stopPropagation();vlPlay('${escapeHtml(v.url)}','${escapeHtml(v.title || v.filename)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg>재생</button>
          <button class="btn btn-sm" style="font-size:11px;padding:4px 10px;background:rgba(255,69,58,0.1);color:#ff453a;" onclick="event.stopPropagation();vlDelete('${escapeHtml(v.path)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#ff453a;">불러오기 실패: ${e.message}</div>`;
  }
}

function vlPlay(url, title) {
  document.getElementById('vl-player').src = url;
  document.getElementById('vl-player-title').textContent = title;
  document.getElementById('vl-player-card').style.display = 'block';
  document.getElementById('vl-player-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function vlDelete(path) {
  if (!confirm('이 영상을 삭제할까요?')) return;
  try {
    await api('/api/videos/delete', { method: 'POST', body: { path } });
    toast('영상이 삭제되었습니다.');
    vlLoadVideos();
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

// 영상 목록 페이지 진입 시 로드
const _vlObserver = new MutationObserver(function() {
  const page = document.getElementById('page-video-list');
  if (page && page.classList.contains('active')) vlLoadVideos();
});
if (document.getElementById('page-video-list')) {
  _vlObserver.observe(document.getElementById('page-video-list'), { attributes: true, attributeFilter: ['class'] });
}

// ── 통합 변환/발행 페이지 ──
let _cvMode = 'blog';
let _cvSelectedBlog = null;
let _cvSelectedCn = null;
let _cvDetailImages = [];

function cvSwitchTab(mode) {
  _cvMode = mode;
  document.getElementById('cv-blog-select').style.display = mode === 'blog' ? 'block' : 'none';
  document.getElementById('cv-cardnews-select').style.display = mode === 'cardnews' ? 'block' : 'none';
  document.getElementById('cv-tab-blog').style.background = mode === 'blog' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('cv-tab-cardnews').style.background = mode === 'cardnews' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('cv-preview').style.display = 'none';
  document.getElementById('cv-actions-card').style.display = 'none';
}

async function cvLoadSources() {
  // 블로그 글 로드
  try {
    const posts = await api('/api/blog/posts');
    const sel = document.getElementById('cv-blog-id');
    sel.innerHTML = '<option value="">-- 블로그 글을 선택하세요 --</option>';
    (posts.posts || []).forEach(p => {
      sel.innerHTML += `<option value="${p.id}" data-title="${escapeHtml(p.title)}" data-chars="${p.char_count}">${escapeHtml(p.title)} (${p.char_count}자, ${p.status})</option>`;
    });
  } catch {}
  // 카드뉴스 로드
  try {
    const data = await api('/api/cardnews/history?limit=30');
    const sel = document.getElementById('cv-cn-id');
    sel.innerHTML = '<option value="">-- 카드뉴스를 선택하세요 --</option>';
    (data.items || []).forEach(item => {
      if (item.project_dir) {
        sel.innerHTML += `<option value="${item.id}" data-dir="${escapeHtml(item.project_dir)}" data-topic="${escapeHtml(item.topic)}" data-slides="${item.slide_count}">${escapeHtml(item.topic)} (${item.success_count || item.slide_count}장)</option>`;
      }
    });
  } catch {}
}

async function cvOnSelect() {
  const preview = document.getElementById('cv-preview');
  const titleEl = document.getElementById('cv-preview-title');
  const metaEl = document.getElementById('cv-preview-meta');
  const imagesEl = document.getElementById('cv-preview-images');

  if (_cvMode === 'blog') {
    const sel = document.getElementById('cv-blog-id');
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) { preview.style.display = 'none'; document.getElementById('cv-actions-card').style.display = 'none'; return; }
    _cvSelectedBlog = { id: parseInt(opt.value), title: opt.dataset.title };
    titleEl.textContent = opt.dataset.title;
    metaEl.textContent = `블로그 글 · ${opt.dataset.chars}자`;
    imagesEl.innerHTML = '';
  } else {
    const sel = document.getElementById('cv-cn-id');
    const opt = sel.selectedOptions[0];
    if (!opt || !opt.value) { preview.style.display = 'none'; document.getElementById('cv-actions-card').style.display = 'none'; return; }
    _cvSelectedCn = { id: parseInt(opt.value), dir: opt.dataset.dir, topic: opt.dataset.topic };
    titleEl.textContent = opt.dataset.topic;
    metaEl.textContent = `카드뉴스 · ${opt.dataset.slides}장`;
    // 이미지 미리보기
    try {
      const data = await api('/api/cardnews/history/' + opt.value);
      const slides = data.item.slides || [];
      imagesEl.innerHTML = slides.map(s => {
        const url = s.image_url ? ('/api/cardnews/image/' + s.image_url.split('/').map(p => encodeURIComponent(p)).join('/')) : '';
        return url ? `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="kcShowImagePreview(this.src)">` : '';
      }).join('');
    } catch { imagesEl.innerHTML = ''; }
  }
  preview.style.display = 'block';
  document.getElementById('cv-actions-card').style.display = 'block';
  document.getElementById('cv-publish-card').style.display = 'block';
}

async function cvAction(action) {
  const resultCard = document.getElementById('cv-result-card');
  const resultContent = document.getElementById('cv-result-content');

  if (_cvMode === 'blog' && !_cvSelectedBlog) { toast('블로그 글을 선택하세요', 'error'); return; }
  if (_cvMode === 'cardnews' && !_cvSelectedCn) { toast('카드뉴스를 선택하세요', 'error'); return; }

  switch (action) {
    case 'blog-text': {
      if (_cvMode === 'blog') {
        publishPost(_cvSelectedBlog.id);
      } else {
        publishGalleryToBlog(_cvSelectedCn.id);
      }
      break;
    }
    case 'blog-image': {
      if (_cvMode === 'cardnews') {
        publishGalleryToBlogAsImages(_cvSelectedCn.id, _cvSelectedCn.dir);
      } else if (_cvMode === 'blog') {
        // 상세페이지 이미지가 생성되어 있으면 바로 발행, 없으면 먼저 생성
        if (_cvDetailImages && _cvDetailImages.length > 0) {
          const blogId = getBlogId();
          if (!blogId) { toast('설정에서 네이버 블로그 ID를 입력하세요', 'error'); break; }
          if (!confirm(`네이버 블로그에 이미지 ${_cvDetailImages.length}장으로 발행할까요?`)) break;
          try {
            await api('/api/blog/publish', { method: 'POST', body: { title: _cvSelectedBlog.title, content: ' ', tags: [], images: _cvDetailImages } });
            toast(`블로그에 이미지 ${_cvDetailImages.length}장으로 발행 완료!`);
          } catch (e) { toast('발행 실패: ' + e.message, 'error'); }
        } else {
          toast('먼저 "상세페이지 이미지 생성"을 실행하세요', 'error');
        }
      }
      break;
    }
    case 'detail-image': {
      // 상세페이지 이미지 생성
      if (_cvMode === 'blog' && _cvSelectedBlog) {
        const detailBtn = document.getElementById('cv-detail-btn');
        const detailBtnText = document.getElementById('cv-detail-btn-text');
        detailBtn.disabled = true;
        detailBtnText.innerHTML = '<span class="spinner" style="display:none;"></span> 이미지 생성 중...';
        const preview = document.getElementById('cv-detail-preview');
        preview.innerHTML = '';
        preview.style.display = 'flex';
        _cvDetailImages = [];
        try {
          const postData = await api('/api/blog/posts/' + _cvSelectedBlog.id);
          const content = postData.post.content;
          const title = postData.post.title;
          // 본문을 섹션으로 분할
          const lines = content.split('\n').filter(l => l.trim());
          const sections = [];
          let cur = { title: title, body: '' };
          for (const line of lines) {
            const t = line.trim();
            if (t.length < 30 && t.length > 2 && !t.endsWith('.') && !t.endsWith('다') && cur.body.length > 50) {
              sections.push({...cur});
              cur = { title: t, body: '' };
            } else {
              cur.body += (cur.body ? '\n' : '') + t;
            }
          }
          if (cur.body) sections.push(cur);

          for (let i = 0; i < sections.length; i++) {
            detailBtnText.textContent = `이미지 생성 중... (${i+1}/${sections.length})`;
            const sec = sections[i];
            const slideData = { slide_number: i+1, title: sec.title, body: sec.body.substring(0,150), visual_prompt: 'clean infographic, Korean blog detail page' };
            try {
              if (!window._cvDetailDir) window._cvDetailDir = '';
              const res = await api('/api/cardnews/generate-single', { method: 'POST', body: { slide: slideData, topic: title, style: 'modern', aspect_ratio: '9:16', project_dir: window._cvDetailDir || '' } });
              if (!window._cvDetailDir && res.project_dir) window._cvDetailDir = res.project_dir;
              if (res.image_url) {
                const imgUrl = '/api/cardnews/image/' + res.image_url + '?t=' + Date.now();
                _cvDetailImages.push(imgUrl);
                preview.innerHTML += '<img src="'+imgUrl+'" style="width:100%;max-width:400px;border-radius:8px;cursor:pointer;" onclick="kcShowImagePreview(this.src)">';
              }
            } catch(e) { preview.innerHTML += '<div style="color:#ff453a;font-size:12px;">섹션 '+(i+1)+' 실패</div>'; }
          }
          toast(`상세페이지 이미지 ${_cvDetailImages.length}장 생성 완료!`);
        } catch (e) { toast('이미지 생성 실패: ' + e.message, 'error'); }
        finally { detailBtn.disabled = false; detailBtnText.textContent = '상세페이지 이미지 생성'; }
      } else if (_cvMode === 'cardnews') {
        toast('카드뉴스는 이미 이미지입니다. "네이버 블로그 이미지 발행"으로 바로 발행하세요.');
      }
      break;
    }
    case 'video': {
      const voice = document.getElementById('cv-voice').value;
      const progress = document.getElementById('cv-progress');
      const progressText = document.getElementById('cv-progress-text');
      const videoBtn = document.getElementById('cv-video-btn');
      const videoBtnText = document.getElementById('cv-video-btn-text');
      const videoBtnSub = document.getElementById('cv-video-btn-sub');
      resultCard.style.display = 'block';
      progress.style.display = 'block';
      resultContent.innerHTML = '';
      videoBtn.disabled = true;
      videoBtnText.innerHTML = '<span class="spinner" style="display:none;"></span> 생성 중...';
      videoBtnSub.textContent = '잠시 기다려주세요';
      progressText.textContent = '영상 생성 중... TTS 음성 생성 → 이미지 합성 → 영상 인코딩 (1~3분 소요)';
      toast('영상 생성 시작...');
      try {
        let res;
        const speed = parseFloat(document.getElementById('cv-speed')?.value || '1.0');
        if (_cvMode === 'blog') {
          const scenes = parseInt(document.getElementById('cv-scenes').value);
          progressText.textContent = '블로그 글에서 스크립트 추출 → TTS → 영상 생성 중...';
          res = await api('/api/video/create', { method: 'POST', body: { source: 'blog', method: 'slide', post_id: _cvSelectedBlog.id, voice, scene_count: scenes, speed } });
        } else {
          progressText.textContent = '카드뉴스 슬라이드 → TTS 음성 생성 → 영상 합성 중...';
          res = await api('/api/video/create', { method: 'POST', body: { source: 'cardnews', method: 'slide', cardnews_id: _cvSelectedCn.id, project_dir: _cvSelectedCn.dir, voice, speed } });
        }
        progress.style.display = 'none';
        videoBtn.disabled = false;
        videoBtnText.textContent = '영상 생성';
        videoBtnSub.textContent = '쇼츠/릴스';
        if (res.video_path) {
          const vp = res.video_path.split('/videos/');
          resultContent.innerHTML = `
            <video src="/api/videos/play/${vp[1] || ''}" controls style="width:100%;max-width:360px;border-radius:12px;background:#000;"></video>
            <div class="btn-group" style="margin-top:12px;">
                            <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:'output/videos'}}).then(()=>toast('폴더 열림'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>폴더 열기</button>
            </div>`;
          toast('영상 생성 완료!');
        } else {
          resultContent.innerHTML = '<div style="color:#ff453a;">영상 생성 결과를 확인할 수 없습니다.</div>';
        }
      } catch (e) {
        progress.style.display = 'none';
        videoBtn.disabled = false;
        videoBtnText.textContent = '영상 생성';
        videoBtnSub.textContent = '쇼츠/릴스';
        let consoleHtml2 = '';
        if (e.traceback) {
          consoleHtml2 = `
            <details open style="margin-top:12px;">
              <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#ff9f0a;margin-bottom:8px;">서버 콘솔 로그</summary>
              <pre style="background:#1a1a2e;color:#e0e0e0;padding:14px;border-radius:10px;font-size:11.5px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;border:1px solid rgba(255,159,10,0.2);">${escapeHtml(e.traceback)}</pre>
            </details>`;
        }
        resultContent.innerHTML = `<div style="padding:16px;">
          <div style="color:#ff453a;font-weight:600;font-size:15px;margin-bottom:8px;">영상 생성 실패</div>
          <div style="color:#ff6b6b;font-size:13px;">${escapeHtml(e.message)}</div>
          ${consoleHtml2}
        </div>`;
        toast('영상 생성 실패: ' + e.message, 'error');
      }
      break;
    }
    case 'insta': {
      if (_cvMode === 'cardnews') {
        uploadGalleryToInsta(_cvSelectedCn.id, _cvSelectedCn.dir);
      } else {
        toast('인스타 게시물은 카드뉴스 소스에서 가능합니다', 'error');
      }
      break;
    }
    case 'veo3': {
      // 이미지 선택 팝업 먼저 띄우기
      const selectedImages = await pickImages('veo3');

      const voice = document.getElementById('cv-voice').value;
      const veo3Btn = document.getElementById('cv-veo3-btn');
      const veo3BtnText = document.getElementById('cv-veo3-btn-text');
      const veo3BtnSub = document.getElementById('cv-veo3-btn-sub');
      const progress = document.getElementById('cv-progress');
      const progressText = document.getElementById('cv-progress-text');
      resultCard.style.display = 'block';
      progress.style.display = 'block';
      veo3Btn.disabled = true;
      veo3BtnText.innerHTML = '<span class="spinner" style="display:none;"></span> 생성 중...';
      veo3BtnSub.textContent = '장면당 1~5분 소요';
      resultContent.innerHTML = `
        <div style="padding:16px;">
          <div style="font-size:13px;font-weight:600;color:#a855f7;margin-bottom:10px;">서버 콘솔 <span style="font-weight:400;color:rgba(255,255,255,0.3);">(선택된 이미지: ${selectedImages.length}장)</span></div>
          <pre id="veo3-console" style="background:#0d1117;color:#c9d1d9;padding:14px;border-radius:10px;font-size:11.5px;line-height:1.7;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;border:1px solid rgba(168,85,247,0.2);font-family:'SF Mono',Monaco,Consolas,monospace;"></pre>
        </div>`;
      progressText.textContent = 'Veo 3 AI 영상 생성 중... 장면당 1~5분 소요됩니다';
      toast('Veo 3 AI 영상 생성 시작...');

      try {
        let topic = '';
        let sourceText = '';
        if (_cvMode === 'blog' && _cvSelectedBlog) {
          const postData = await api('/api/blog/posts/' + _cvSelectedBlog.id);
          topic = _cvSelectedBlog.title;
          sourceText = postData.post.content.substring(0, 3000);
        } else if (_cvMode === 'cardnews' && _cvSelectedCn) {
          const cnData = await api('/api/cardnews/history/' + _cvSelectedCn.id);
          topic = _cvSelectedCn.topic;
          sourceText = (cnData.item.slides || []).map(s => s.title + ': ' + s.body).join('\n');
        }
        const veoModel = document.getElementById('cv-veo-model').value;
        const subtitleStyle = document.getElementById('cv-subtitle')?.value || 'promo';
        const narrationMode = document.getElementById('cv-narration')?.value || 'on';
        const cameraFreedom = document.getElementById('cv-camera-freedom')?.value || 'subtle';
        const veoBody = { topic, source_text: sourceText, voice, scene_count: parseInt(document.getElementById('cv-scenes').value), veo_model: veoModel, subtitle_style: subtitleStyle, narration_mode: narrationMode, camera_freedom: cameraFreedom };
        if (_cvMode === 'cardnews' && _cvSelectedCn) {
          veoBody.cardnews_id = _cvSelectedCn.id;
        }
        // 선택된 이미지 전달
        if (selectedImages.length > 0) {
          veoBody.images = selectedImages;
        }

        const consoleEl = document.getElementById('veo3-console');
        const appendLog = (msg, color) => {
          const span = document.createElement('span');
          span.style.color = color || '#c9d1d9';
          span.textContent = msg + '\n';
          consoleEl.appendChild(span);
          consoleEl.scrollTop = consoleEl.scrollHeight;
        };
        appendLog(`> Veo 3.1 영상 생성 요청 전송... (이미지 ${selectedImages.length}장 포함)`, '#8b949e');

        const res = await fetch((typeof API !== 'undefined' ? API : '') + '/api/video/veo3-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(veoBody),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let finalResult = null;
        let finalError = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'log') {
                const c = d.message.includes('[ERROR]') || d.message.includes('실패') || d.message.includes('에러') ? '#ff6b6b'
                        : d.message.includes('완료') || d.message.includes('성공') ? '#7ee787'
                        : d.message.includes('[Veo]') || d.message.includes('[Veo3]') ? '#d2a8ff'
                        : '#c9d1d9';
                appendLog(d.message, c);
                progressText.textContent = d.message;
              } else if (d.type === 'done') {
                finalResult = d.result;
              } else if (d.type === 'error') {
                finalError = d;
                appendLog('ERROR: ' + d.message, '#ff6b6b');
                if (d.traceback) appendLog(d.traceback, '#f97583');
              }
            } catch {}
          }
        }

        progress.style.display = 'none';
        veo3Btn.disabled = false;
        veo3BtnText.textContent = 'Veo 3.1 AI 영상';
        veo3BtnSub.textContent = 'AI가 새로 만드는 영상 (유료)';
        if (finalResult && finalResult.video_path) {
          const vp = finalResult.video_path.split('/videos/');
          const videoHtml = `
            <div style="margin-top:16px;">
              <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:#a855f7;">Veo 3 AI 영상</div>
              <video src="/api/videos/play/${vp[1] || ''}" controls style="width:100%;max-width:360px;border-radius:12px;background:#000;"></video>
              <div class="btn-group" style="margin-top:12px;">
                                <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:'output/videos'}}).then(()=>toast('폴더 열림'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>폴더 열기</button>
              </div>
            </div>`;
          resultContent.insertAdjacentHTML('beforeend', videoHtml);
          toast('Veo 3 AI 영상 생성 완료!');
        } else if (finalError) {
          appendLog('', '');
          appendLog('=== 영상 생성 실패 ===', '#ff6b6b');
          toast('Veo 3 실패: ' + finalError.message, 'error');
        }
      } catch (e) {
        progress.style.display = 'none';
        veo3Btn.disabled = false;
        veo3BtnText.textContent = 'Veo 3.1 AI 영상';
        veo3BtnSub.textContent = 'AI가 새로 만드는 영상 (유료)';
        const consoleEl = document.getElementById('veo3-console');
        if (consoleEl) {
          const span = document.createElement('span');
          span.style.color = '#ff6b6b';
          span.textContent = 'NETWORK ERROR: ' + e.message + '\n';
          consoleEl.appendChild(span);
        }
        toast('Veo 3 실패: ' + e.message, 'error');
      }
      break;
    }
    case 'reels':
      toast('인스타 릴스는 영상 생성 후 업로드 가능합니다'); break;
    case 'comic': {
      resultCard.style.display = 'block';
      resultContent.innerHTML = `<div style="text-align:center;padding:20px;"><span class="spinner"></span> 만화 생성 중...</div>`;
      toast('만화 생성 시작...');
      try {
        let topic = '';
        let reference = '';
        if (_cvMode === 'blog' && _cvSelectedBlog) {
          const postData = await api('/api/blog/posts/' + _cvSelectedBlog.id);
          topic = _cvSelectedBlog.title;
          reference = postData.post.content.substring(0, 3000);
        } else if (_cvMode === 'cardnews' && _cvSelectedCn) {
          const cnData = await api('/api/cardnews/history/' + _cvSelectedCn.id);
          topic = _cvSelectedCn.topic;
          reference = (cnData.item.slides || []).map(s => s.title + ': ' + s.body).join('\n');
        }
        const opts = window._cvComicOpts || { panels: 4, layout: '2x2', style: 'cute' };
        resultContent.innerHTML = `<div style="text-align:center;padding:20px;"><span class="spinner"></span> ${opts.panels}컷 만화 생성 중... (${opts.style})</div>`;
        const res = await api('/api/comic/generate', {
          method: 'POST',
          body: { topic, style: opts.style, layout: opts.layout, panel_count: opts.panels, reference },
        });
        let html = '';
        if (res.composed_image && res.composed_image.includes('/comics/')) {
          const relPath = res.composed_image.split('/comics/')[1];
          html += `<div style="margin-bottom:16px;"><img src="/api/comic/image/${relPath}" style="width:100%;max-width:500px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);"></div>`;
        }
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`;
        for (const p of (res.panels || [])) {
          if (p.image_url || (p.image_path && p.image_path.includes('/comics/'))) {
            const url = p.image_url || p.image_path.split('/comics/')[1];
            html += `<img src="/api/comic/image/${url}" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">`;
          }
        }
        html += `</div>`;
        html += `<div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:'output/comics'}}).then(()=>toast('폴더 열림'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>폴더 열기</button>
        </div>`;
        resultContent.innerHTML = html;
        toast('만화 생성 완료!');
      } catch (e) {
        let errHtml = `<div style="color:#ff453a;padding:16px;">만화 생성 실패: ${escapeHtml(e.message)}</div>`;
        resultContent.innerHTML = errHtml;
        toast('만화 실패: ' + e.message, 'error');
      }
      break;
    }
    case 'threads':
    case 'twitter': {
      // 블로그 글 또는 카드뉴스 내용으로 SNS 글 생성
      const snsType = action === 'threads' ? '스레드' : '트위터(X)';
      resultCard.style.display = 'block';
      resultContent.innerHTML = `<div style="text-align:center;padding:20px;"><span class="spinner"></span> ${snsType} 글 생성 중...</div>`;
      try {
        let topic = '';
        let sourceText = '';
        if (_cvMode === 'blog' && _cvSelectedBlog) {
          topic = _cvSelectedBlog.title;
          const postData = await api('/api/blog/posts/' + _cvSelectedBlog.id);
          sourceText = postData.post.content.substring(0, 2000);
        } else if (_cvMode === 'cardnews' && _cvSelectedCn) {
          topic = _cvSelectedCn.topic;
          const cnData = await api('/api/cardnews/history/' + _cvSelectedCn.id);
          sourceText = (cnData.item.slides || []).map(s => s.title + ': ' + s.body).join('\n');
        }

        const config = await api('/api/config');
        const apiKey = config?.API?.openai_api_key || '';
        const model = config?.API?.openai_model || 'gpt-4o-mini';
        if (!apiKey) { toast('API 키를 설정하세요', 'error'); break; }

        const res = await api('/api/content/generate-sns', {
          method: 'POST',
          body: { topic, source_text: sourceText, platform: action },
        });

        const text = res.text || '';
        resultContent.innerHTML = `
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">${snsType} 글</div>
          <textarea id="cv-sns-text" rows="6" style="font-size:14px;line-height:1.6;">${escapeHtml(text)}</textarea>
          <div class="btn-group" style="margin-top:10px;">
            <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('cv-sns-text').value);toast('복사 완료!')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>복사</button>
            <button class="btn btn-secondary btn-sm" onclick="toast('${snsType} 자동 업로드 준비 중')">${snsType} 업로드</button>
          </div>
        `;
      } catch (e) {
        resultContent.innerHTML = `<div style="color:#ff453a;">SNS 글 생성 실패: ${escapeHtml(e.message)}</div>`;
      }
      break;
    }
  }
}

// 변환 페이지 진입 시 소스 로드
const _cvObserver = new MutationObserver(function() {
  const page = document.getElementById('page-convert');
  if (page && page.classList.contains('active')) {
    cvLoadSources();
  }
});
if (document.getElementById('page-convert')) {
  _cvObserver.observe(document.getElementById('page-convert'), { attributes: true, attributeFilter: ['class'] });
}

// ── 카드뉴스 영상 생성 페이지 ──
async function cnvLoadList() {
  const select = document.getElementById('cnv-select');
  try {
    const data = await api('/api/cardnews/history?limit=30');
    const items = data.items || [];
    select.innerHTML = '<option value="">-- 카드뉴스를 선택하세요 --</option>';
    items.forEach(item => {
      if (item.project_dir) {
        const opt = document.createElement('option');
        opt.value = item.project_dir;
        opt.dataset.id = item.id;
        opt.textContent = `${item.topic} (${item.success_count || item.slide_count}장, ${(item.created_at || '').substring(0, 10)})`;
        select.appendChild(opt);
      }
    });
  } catch {}
}

function cnvPreview() {
  const dir = document.getElementById('cnv-select').value;
  const preview = document.getElementById('cnv-preview');
  const slides = document.getElementById('cnv-slides');
  if (!dir) { preview.style.display = 'none'; return; }

  // 선택한 카드뉴스의 이미지 미리보기
  const opt = document.getElementById('cnv-select').selectedOptions[0];
  const id = opt?.dataset?.id;
  if (id) {
    api('/api/cardnews/history/' + id).then(data => {
      const item = data.item;
      const sl = item.slides || [];
      slides.innerHTML = sl.map(s => {
        const imgUrl = s.image_url ? ('/api/cardnews/image/' + s.image_url.split('/').map(p => encodeURIComponent(p)).join('/')) : '';
        return imgUrl ? `<img src="${imgUrl}" style="width:100%;border-radius:6px;cursor:pointer;" onclick="kcShowImagePreview(this.src)">` : '';
      }).join('');
      preview.style.display = 'block';
    }).catch(() => { preview.style.display = 'none'; });
  }
}

async function cnvGenerate() {
  const dir = document.getElementById('cnv-select').value;
  if (!dir) { toast('카드뉴스를 선택하세요', 'error'); return; }
  const voice = document.getElementById('cnv-voice').value;
  const opt = document.getElementById('cnv-select').selectedOptions[0];
  const id = opt?.dataset?.id || '';

  const btn = document.getElementById('cnv-gen-btn');
  const progress = document.getElementById('cnv-progress');
  btn.disabled = true;
  progress.style.display = 'block';
  document.getElementById('cnv-result').style.display = 'none';

  toast('카드뉴스 영상 생성 시작...');
  try {
    const res = await api('/api/video/create', {
      method: 'POST',
      body: { source: 'cardnews', method: 'slide', cardnews_id: parseInt(id) || 0, project_dir: dir, voice },
    });
    if (res.video_path) {
      const vidParts = res.video_path.split('/videos/');
      const relPath = vidParts.length > 1 ? vidParts[1] : '';
      document.getElementById('cnv-player').src = '/api/videos/play/' + relPath;
      document.getElementById('cnv-result').style.display = 'block';
      toast('카드뉴스 영상 생성 완료!');
    } else {
      toast('영상 생성 실패', 'error');
    }
  } catch (e) {
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    progress.style.display = 'none';
  }
}

// 페이지 진입 시 카드뉴스 목록 로드
const _cnvObserver = new MutationObserver(function() {
  const page = document.getElementById('page-cardnews-video');
  if (page && page.classList.contains('active')) cnvLoadList();
});
document.getElementById('page-cardnews-video') && _cnvObserver.observe(document.getElementById('page-cardnews-video'), { attributes: true, attributeFilter: ['class'] });

// 파이프라인 URL 참고 내용 가져오기
async function cnpFetchUrlRef() {
  const url = document.getElementById('cnp-ref-url').value.trim();
  if (!url || !url.startsWith('http')) { toast('URL을 입력하세요', 'error'); return; }
  try {
    toast('URL에서 내용을 가져오는 중...');
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const res = await scrape(url, { minLength: 50, timeoutMs: 45000 });
    if (res.ok && res.text) {
      const ta = document.getElementById('cnp-reference');
      ta.value = (ta.value.trim() ? ta.value + '\n\n---\n\n' : '') + `[${res.title || url}]\n${res.text}`;
      document.getElementById('cnp-ref-url').value = '';
      toast(`참고 내용 추가 (${res.text.length.toLocaleString()}자)`);
      if (!document.getElementById('cnp-topic').value.trim() && res.title) {
        document.getElementById('cnp-topic').value = res.title;
      }
    }
  } catch (e) { toast('가져오기 실패: ' + e.message, 'error'); }
}

async function runCardNewsPipeline() {
  const topic = document.getElementById('cnp-topic').value.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }

  const btn = document.getElementById('cnp-run-btn');
  btn.disabled = true;
  btn.textContent = '실행 중...';

  const card = document.getElementById('cnp-progress-card');
  card.style.display = 'block';
  document.getElementById('cnp-steps').innerHTML = '';
  document.getElementById('cnp-result').style.display = 'none';

  const autoPublishBlog = document.getElementById('cnp-publish-blog').checked;
  const autoGenVideo = document.getElementById('cnp-gen-video').checked;
  const autoUploadIg = document.getElementById('cnp-upload-ig').checked;
  const autoUploadReels = document.getElementById('cnp-upload-reels').checked;

  cnpStep('cardnews', '1. 카드뉴스 생성', 'running');
  if (autoPublishBlog) cnpStep('blog', '2. 블로그 발행', 'pending');
  if (autoGenVideo) cnpStep('video', '3. 영상 생성', 'pending');
  if (autoUploadIg) cnpStep('instagram', '4. 인스타 게시물 업로드', 'pending');
  if (autoUploadReels) cnpStep('reels', '5. 인스타 릴스 업로드', 'pending');

  try {
    const ratio = document.querySelector('input[name="cnp-ratio"]:checked').value;
    const res = await api('/api/pipeline/cardnews', {
      method: 'POST',
      body: {
        topic,
        slide_count: parseInt(document.getElementById('cnp-slides').value),
        style: document.getElementById('cnp-style').value,
        aspect_ratio: ratio,
        auto_publish_blog: autoPublishBlog,
        auto_generate_video: autoGenVideo,
        auto_upload_instagram: autoUploadIg,
        auto_upload_reels: autoUploadReels,
        voice: document.getElementById('cnp-voice').value,
        instagram_caption: document.getElementById('cnp-caption').value,
      }
    });

    // 결과 업데이트
    const steps = res.steps || [];
    const cn = res.cardnews;
    cnpStep('cardnews', `1. 카드뉴스 생성 - ${cn ? cn.success_count + '/' + cn.slide_count + '장' : ''}`, steps.includes('cardnews_generated') ? 'done' : 'error');
    if (autoPublishBlog) cnpStep('blog', '2. 블로그 발행', steps.includes('blog_published') ? 'done' : (res.errors && res.errors.some(e => e.includes('블로그')) ? 'error' : 'pending'));
    if (autoGenVideo) cnpStep('video', `3. 영상 생성${res.video ? ' - ' + res.video.duration + '초' : ''}`, steps.includes('video_generated') ? 'done' : (res.errors && res.errors.some(e => e.includes('영상')) ? 'error' : 'pending'));
    if (autoUploadIg) cnpStep('instagram', '4. 인스타 게시물 업로드', steps.includes('instagram_uploaded') ? 'done' : (res.errors && res.errors.some(e => e.includes('인스타') && e.includes('게시물')) ? 'error' : 'pending'));
    if (autoUploadReels) cnpStep('reels', '5. 인스타 릴스 업로드', steps.includes('reels_uploaded') ? 'done' : (res.errors && res.errors.some(e => e.includes('릴스')) ? 'error' : 'pending'));

    // 결과 카드
    const resultDiv = document.getElementById('cnp-result');
    resultDiv.style.display = 'block';
    let html = `<div style="padding:16px;background:#0f1923;border-radius:8px;">`;
    html += `<div style="font-size:16px;font-weight:600;color:${res.status === 'ok' ? '#4fc08d' : '#f5a623'};margin-bottom:12px;">${res.status === 'ok' ? '전체 완료!' : '부분 완료'}</div>`;
    html += `<div style="font-size:13px;color:#8899aa;">완료 단계: ${steps.join(' → ')}</div>`;
    if (res.errors && res.errors.length) {
      html += `<div style="color:#e05c5c;font-size:13px;margin-top:8px;">${res.errors.join('<br>')}</div>`;
    }
    // 카드뉴스 이미지 미리보기
    if (cn && cn.slides) {
      const dirParts = cn.project_dir.split('/cardnews/');
      const relDir = dirParts.length > 1 ? dirParts[1] : '';
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:16px;">`;
      cn.slides.forEach(s => {
        if (s.status === 'ok') {
          const imgFile = s.image_path.split('/').pop();
          html += `<img src="${encImg('/api/cardnews/image/'+relDir+'/'+imgFile)}" style="width:100%;border-radius:6px;border:1px solid #1e3a52;">`;
        }
      });
      html += `</div>`;
    }
    // 영상 미리보기
    if (res.video && res.video.video_path) {
      const relPath = res.video.video_path.split('/videos/').pop();
      html += `<div style="margin-top:16px;"><video controls src="/api/video/file/${relPath}" style="width:100%;max-width:320px;border-radius:12px;background:#000;"></video></div>`;
    }
    html += `</div>`;
    resultDiv.innerHTML = html;

    toast(res.status === 'ok' ? '카드뉴스 파이프라인 완료!' : '카드뉴스 파이프라인 부분 완료', res.status === 'ok' ? 'success' : 'error');
  } catch (e) {
    cnpStep('cardnews', '1. 카드뉴스 생성', 'error');
    toast('카드뉴스 파이프라인 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '카드뉴스 파이프라인 실행';
  }
}

// === 영상 페이지 글 목록 로드 ===
async function loadVideoPostSelect() {
  try {
    const data = await api('/api/blog/posts?limit=50');
    const sel = document.getElementById('vid-post-select');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- 글을 선택하세요 --</option>' +
      data.posts.map(p => `<option value="${p.id}" ${p.id == currentVal ? 'selected' : ''}>[${p.id}] ${(p.title||'제목없음').substring(0,50)} (${p.char_count}자, ${statusLabel(p.status)})</option>`).join('');
  } catch(e) {}
}

// 글 목록에서 "영상" 버튼 클릭 시
function goToVideoFromPost(postId, title) {
  // 영상 생성 페이지로 이동
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelector('[data-page="video"]').classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-video').classList.add('active');
  // 글 선택 및 ID 설정
  document.getElementById('vid-post-id').value = postId;
  loadVideoPostSelect().then(() => {
    document.getElementById('vid-post-select').value = postId;
  });
  toast(`"${title.substring(0,30)}..." 선택됨. 영상 옵션 설정 후 생성하세요.`);
}

// === 영상 생성 (단독) ===
// 영상 목록 로드
async function loadVideoList() {
  const container = document.getElementById('vid-list');
  try {
    const videos = await api('/api/videos');
    if (!videos || videos.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3);">생성된 영상이 없습니다.</div>';
      return;
    }
    container.innerHTML = videos.map(v => `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
        <video src="${v.url}" style="width:80px;height:140px;object-fit:cover;border-radius:8px;background:#000;" muted></video>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.title || v.filename)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:4px;">${v.duration ? Math.round(v.duration) + '초' : ''} · ${v.created || ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 8px;" onclick="document.getElementById('vid-player').src='${v.url}';document.getElementById('vid-result').style.display='block';"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg>재생</button>
          <button class="btn btn-sm btn-secondary" style="font-size:11px;padding:4px 8px;" onclick="uploadVideoToReels('${v.path}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>릴스</button>
        </div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3);">영상 목록을 불러올 수 없습니다.</div>';
  }
}

async function generateVideo() {
  const postId = document.getElementById('vid-post-id').value || document.getElementById('vid-post-select').value;
  if (!postId) { toast('블로그 글을 선택하세요', 'error'); return; }

  const btn = document.getElementById('vid-gen-btn');
  btn.disabled = true;
  btn.textContent = '생성 중...';
  document.getElementById('vid-progress').classList.add('show');
  document.getElementById('vid-progress-bar').style.width = '30%';
  document.getElementById('vid-status').textContent = '스크립트 생성 → TTS → 영상 합성 중... (1-3분 소요)';
  document.getElementById('vid-result').style.display = 'none';

  try {
    const res = await api('/api/video/create', {
      method: 'POST',
      body: {
        source: 'blog',
        method: 'slide',
        post_id: parseInt(postId),
        voice: document.getElementById('vid-voice').value,
        scene_count: parseInt(document.getElementById('vid-scenes').value),
      }
    });

    document.getElementById('vid-progress-bar').style.width = '100%';
    document.getElementById('vid-status').textContent = `완료! ${res.data.duration}초 영상 (${res.data.scene_count}장면)`;

    lastVideoPath = res.data.video_path;
    const relPath = res.data.video_path.split('/videos/').pop();
    const player = document.getElementById('vid-player');
    player.src = `/api/video/file/${relPath}`;
    document.getElementById('vid-result').style.display = 'block';

    toast(`영상 생성 완료! ${res.data.duration}초`);
  } catch (e) {
    document.getElementById('vid-status').textContent = '실패: ' + e.message;
    document.getElementById('vid-progress-bar').style.width = '0%';
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '영상 생성';
  }
}

async function uploadVideoToReels() {
  if (!lastVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  const btn = event?.target?.closest('button');
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    const res = await api('/api/instagram/reels', {
      method: 'POST',
      body: { video_path: lastVideoPath, caption: '' }
    });
    if (btn) { btn.innerHTML = '&#10003; 릴스 완료'; btn.style.background = '#34c759'; }
    toast('릴스 업로드 완료!');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '인스타 릴스 재시도'; }
    toast('릴스 업로드 실패: ' + e.message, 'error');
  }
}

async function uploadVideoToYoutube() {
  if (!lastVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  const btn = event?.target?.closest('button');
  if (!confirm('YouTube에 영상을 업로드할까요?')) return;
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    const result = await api('/api/upload/youtube', {
      method: 'POST',
      body: { video_path: lastVideoPath, title: '영상', description: '', privacy_status: 'public', is_shorts: true }
    });
    if (btn) { btn.innerHTML = '&#10003; 유튜브 완료'; btn.style.background = '#34c759'; }
    toast('YouTube 쇼츠 업로드 완료! ' + (result.url || ''));
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '유튜브 쇼츠 재시도'; }
    toast('YouTube 업로드 실패: ' + e.message, 'error');
  }
}

async function uploadVideoToTiktok() {
  if (!lastVideoPath) { toast('먼저 영상을 생성하세요', 'error'); return; }
  toast('TikTok 업로드 페이지를 열고 영상 폴더를 엽니다');
  window.open('https://www.tiktok.com/upload', '_blank');
  api('/api/open-folder', { method: 'POST', body: { folder: 'output/videos' } });
}
