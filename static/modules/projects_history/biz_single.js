// ═══ projects_history/biz_single.js ═══
// 블로그/카드뉴스 단일 편집 · 비즈니스 카드뉴스 퀵스타트
// (원본 projects_history.js 라인 1-676 추출)

// ═══ 프로젝트 히스토리 — 블로그 편집/삭제, 카드뉴스 크게보기 ═══
async function projToggleBlogPreview(blogId) {
  const el = document.getElementById(`proj-blog-preview-${blogId}`);
  if (el.style.display === 'none') {
    if (!el.dataset.loaded) {
      try {
        const res = await api(`/api/blog/posts/${blogId}`);
        const post = res.post || res;
        el.textContent = post.content || post.body || '본문 없음';
        el.dataset.loaded = '1';
      } catch (e) { el.textContent = '로딩 실패: ' + e.message; }
    }
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

async function projPublishBlog(blogId) {
  try {
    const res = await api(`/api/blog/posts/${blogId}`);
    const post = res.post || res;
    const cnImages = [];
    document.querySelectorAll('#proj-content-sections img[src*="cardnews"]').forEach(img => cnImages.push(img.src));
    const comicImg = document.querySelector('#proj-content-sections img[src*="comic"]')?.src || '';
    const tags = post.tags ? (typeof post.tags === 'string' ? post.tags.split(',').map(t=>t.trim()).filter(t=>t) : post.tags) : [];

    // 모달 먼저 열기
    openUploadModal({ title: post.title || '', content: post.content || post.body || '', tags, images: [], cardnewsImages: cnImages, comicImage: comicImg, postId: blogId });

    // 태그 없으면 백그라운드에서 AI 추출 후 채우기
    if (!tags.length && post.content) {
      _fillTagsAsync(blogId, post.content);
    }
  } catch(e) { toast('블로그 데이터 로드 실패: ' + e.message, 'error'); }
}

async function _fillTagsAsync(blogId, content) {
  try {
    const el = document.getElementById('um-tags');
    if (el) el.placeholder = '태그 생성 중...';
    const tagRes = await api('/api/content/extract-tags', { method: 'POST', body: { text: content.substring(0, 2000), count: 10 } });
    const tags = (tagRes.tags || '').split(',').map(t => t.trim().replace(/[:.\[\]"']/g, '')).filter(t => t.length >= 2 && t.length <= 15).slice(0, 10);
    if (el && !el.value && tags.length) el.value = tags.join(', ');
    if (tags.length && blogId) api(`/api/blog/posts/${blogId}`, { method: 'PUT', body: { tags: tags.join(', ') } }).catch(() => {});
  } catch {}
}

async function projEditBlog(blogId) {
  let modal = document.getElementById('blog-edit-modal');
  if (modal) modal.remove();
  try {
    const res = await api(`/api/blog/posts/${blogId}`);
    const post = res.post || res;
    modal = document.createElement('div');
    modal.id = 'blog-edit-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:22px;padding:28px;width:92%;max-width:700px;max-height:85vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">블로그 편집</h2>
          <button onclick="document.getElementById('blog-edit-modal').remove()" style="background:rgba(0,0,0,0.06);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(0,0,0,0.4);">×</button>
        </div>
        <div class="form-group">
          <label>제목</label>
          <input type="text" id="blog-edit-title" value="${escapeHtml(post.title||'')}" style="font-size:15px;font-weight:600;">
        </div>
        <div class="form-group">
          <label>본문</label>
          <textarea id="blog-edit-body" rows="15" style="font-size:13px;line-height:1.7;font-family:inherit;">${escapeHtml(post.content||post.body||'')}</textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('blog-edit-modal').remove()">취소</button>
          <button class="btn btn-primary btn-sm" onclick="projSaveBlog(${blogId})">저장</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch (e) { toast('로딩 실패: ' + e.message, 'error'); }
}

async function projSaveBlog(blogId) {
  const title = document.getElementById('blog-edit-title').value.trim();
  const content = document.getElementById('blog-edit-body').value.trim();
  try {
    await api(`/api/blog/posts/${blogId}`, { method: 'PUT', body: { title, content } });
    toast('블로그 저장 완료');
    document.getElementById('blog-edit-modal')?.remove();
    // 프로젝트 상세 새로고침
    const projId = document.getElementById('proj-delete-btn')?.onclick?.toString()?.match(/\d+/)?.[0];
    if (projId) openProjectDetail(parseInt(projId));
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function projDeleteBlog(blogId, projId) {
  if (!confirm('이 블로그 글을 삭제할까요?')) return;
  try {
    await api(`/api/blog/posts/${blogId}`, { method: 'DELETE' });
    await api(`/api/projects/${projId}`, { method: 'PUT', body: { blog_id: null } });
    toast('블로그 삭제됨');
    openProjectDetail(projId);
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

async function projDownloadCardnews(urls) {
  if (!urls || urls.length === 0) { toast('다운로드할 이미지가 없습니다', 'error'); return; }

  // JSZip이 있으면 ZIP으로, 없으면 개별 다운로드
  toast(`${urls.length}장 다운로드 준비 중...`);

  // 모든 이미지를 Blob으로 수집
  const blobs = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const resp = await fetch(urls[i]);
      const blob = await resp.blob();
      blobs.push({ blob, name: `cardnews_${String(i+1).padStart(2,'0')}.png` });
    } catch (e) {
      console.error(`이미지 ${i+1} 다운로드 실패:`, e);
    }
  }

  if (blobs.length === 0) { toast('다운로드할 이미지가 없습니다', 'error'); return; }

  if (blobs.length === 1) {
    // 1장이면 바로 다운로드
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blobs[0].blob);
    a.download = blobs[0].name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('이미지 다운로드 완료!');
    return;
  }

  // 여러 장: 순차 다운로드 (각 파일 개별)
  for (let i = 0; i < blobs.length; i++) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blobs[i].blob);
    a.download = blobs[i].name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    // 브라우저가 다운로드를 처리할 시간
    await new Promise(r => setTimeout(r, 500));
  }
  toast(`${blobs.length}장 다운로드 완료!`);
}

function projShowSlideModal(urls, startIdx) {
  let modal = document.getElementById('slide-view-modal');
  if (modal) modal.remove();
  let current = startIdx || 0;
  const filtered = urls.filter(u => u);

  modal = document.createElement('div');
  modal.id = 'slide-view-modal';
  modal.style.cssText = 'position:fixed !important;inset:0;z-index:2147483646 !important;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.2s ease both;isolation:isolate;';

  function render() {
    modal.innerHTML = `
      <button onclick="document.getElementById('slide-view-modal').remove()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;color:#fff;">×</button>
      <div style="position:absolute;top:16px;right:64px;display:flex;gap:6px;">
        <button onclick="projCopySlide()" style="background:rgba(255,255,255,0.15);border:none;height:36px;border-radius:18px;cursor:pointer;font-size:12px;color:#fff;font-weight:600;padding:0 16px;display:flex;align-items:center;gap:6px;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.25)'" onmouseleave="this.style.background='rgba(255,255,255,0.15)'"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>복사</button>
        <button onclick="projSaveSlide()" style="background:rgba(255,140,0,0.9);border:none;height:36px;border-radius:18px;cursor:pointer;font-size:12px;color:#fff;font-weight:600;padding:0 16px;display:flex;align-items:center;gap:6px;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,140,0,1)'" onmouseleave="this.style.background='rgba(255,140,0,0.9)'"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>저장</button>
        <button onclick="projSaveAllSlides()" style="background:rgba(255,255,255,0.15);border:none;height:36px;border-radius:18px;cursor:pointer;font-size:12px;color:#fff;font-weight:600;padding:0 16px;display:flex;align-items:center;gap:6px;transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.25)'" onmouseleave="this.style.background='rgba(255,255,255,0.15)'"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>전체 저장</button>
      </div>
      <button onclick="projSlideNav(-1)" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;color:#fff;${current <= 0 ? 'opacity:0.3;pointer-events:none;' : ''}">‹</button>
      <div style="text-align:center;">
        <img src="${filtered[current]}" style="max-width:80vw;max-height:80vh;border-radius:12px;animation:fadeScale 0.3s ease both;">
        <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:12px;">${current+1} / ${filtered.length}</div>
      </div>
      <button onclick="projSlideNav(1)" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:20px;color:#fff;${current >= filtered.length-1 ? 'opacity:0.3;pointer-events:none;' : ''}">›</button>
    `;
  }

  window.projSlideNav = function(dir) {
    current = Math.max(0, Math.min(filtered.length-1, current + dir));
    render();
  };

  window.projSaveSlide = async function() {
    try {
      const imgUrl = filtered[current];
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `slide_${current+1}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('이미지 저장됨');
    } catch(e) { toast('저장 실패: ' + e.message, 'error'); }
  };

  window.projSaveAllSlides = async function() {
    try {
      for (let i = 0; i < filtered.length; i++) {
        const res = await fetch(filtered[i]);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `slide_${i+1}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        await new Promise(r => setTimeout(r, 300));
      }
      toast(`${filtered.length}장 전체 저장 완료!`);
    } catch(e) { toast('저장 실패: ' + e.message, 'error'); }
  };

  window.projCopySlide = async function() {
    try {
      const imgUrl = filtered[current];
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast('클립보드에 복사됨!');
    } catch(e) { toast('복사 실패: ' + e.message, 'error'); }
  };

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  render();

  // 키보드 네비게이션
  const keyHandler = e => {
    if (e.key === 'ArrowLeft') projSlideNav(-1);
    if (e.key === 'ArrowRight') projSlideNav(1);
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', keyHandler); }
  };
  document.addEventListener('keydown', keyHandler);
}

// ═══ 업종별 카드뉴스/영상 생산 ═══
function quickStartBizCardnews() {
  if (!window._globalProfileId) { toast('먼저 프로필을 선택하세요', 'error'); return; }
  // 새 프로젝트 → 업종 시나리오 탭으로 이동
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelector('[data-page="keyword-content"]')?.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-keyword-content')?.classList.add('active');
  kcReset();
  kcSwitchInputMode('biz');
}

async function bizCnInit() {
  if (!window._globalProfileId) return;
  try {
    const p = await api(`/api/library/profiles/${window._globalProfileId}`);
    const avatar = document.getElementById('biz-cn-profile-avatar');
    if (p.logo_url || p.logo_path) {
      avatar.innerHTML = `<img src="${p.logo_url || '/api/library/image/'+p.id+'/'+p.logo_path}" style="width:100%;height:100%;object-fit:cover;">`;
    }
    document.getElementById('biz-cn-profile-name').textContent = p.name;
    document.getElementById('biz-cn-profile-type').textContent = p.business_type || '';
    // 전역 옵션에서 UI 동기화
    syncOptsToUI('biz');
    // 자동 추천 대신 사용자가 직접 선택하도록 초기 상태만 안내
    const topicsEl = document.getElementById('biz-cn-topics-list');
    if (topicsEl) {
      topicsEl.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.32);font-size:13px;">소재를 입력한 뒤 `추천받기` 또는 상단 `주제 추천` 버튼으로 시작하세요</div>';
    }
    const scenariosEl = document.getElementById('biz-cn-scenario-list');
    if (scenariosEl) {
      scenariosEl.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:12px;grid-column:1/-1;">필요하면 시나리오를 불러오거나 직접 추가하세요</div>';
    }
    const scenarioTypeEl = document.getElementById('biz-cn-scenario-type');
    if (scenarioTypeEl) scenarioTypeEl.textContent = '자동 추천 대기';
  } catch {}
}

// bizCnApplyProfileOptions는 syncOptsToUI('biz')로 대체됨

const BIZ_CN_CLI_PROVIDER_ALIASES = {
  'cli:codex': 'codex',
  'cli:kimi': 'codex',
};

function bizCnSetProvider(btn) {
  if (!btn) return;
  const raw = btn.dataset.bizProvider || btn.dataset.value || 'gemini';
  const label = btn.dataset.bizProviderLabel || btn.textContent.trim() || raw;
  const input = document.getElementById('biz-cn-provider');
  if (input) input.value = raw;
  document.querySelectorAll('[data-biz-provider]').forEach(b => {
    b.classList.remove('qs-active');
    b.style.background = '';
    b.style.color = '';
    b.style.borderColor = '';
  });
  btn.classList.add('qs-active');
  btn.style.background = 'linear-gradient(135deg,#ff8c00,#ff6b00)';
  btn.style.color = '#fff';
  btn.style.borderColor = '#ff8c00';
  const current = document.getElementById('biz-cn-provider-current');
  if (current) current.textContent = `선택: ${label}`;
}

function bizCnProviderState() {
  const raw = (document.getElementById('biz-cn-provider')?.value || 'gemini').trim() || 'gemini';
  const active = document.querySelector(`[data-biz-provider="${CSS.escape(raw)}"]`);
  const label = active?.dataset?.bizProviderLabel || active?.textContent?.trim() || raw;
  const state = {
    raw,
    label,
    provider: 'gemini',
    model: '',
    text_provider: 'gemini',
    image_provider: 'gemini',
    provider_label: label,
  };
  if (raw.startsWith('atlas:')) {
    state.provider = 'atlas';
    state.model = raw.slice(6);
    state.text_provider = raw;
    state.image_provider = 'codex';
  } else if (raw.startsWith('cli:')) {
    state.provider = raw.slice(4) || 'codex';
    state.text_provider = BIZ_CN_CLI_PROVIDER_ALIASES[raw] || 'codex';
    state.image_provider = 'codex';
  } else if (raw === 'codex') {
    state.provider = 'codex';
    state.text_provider = 'codex';
    state.image_provider = 'codex';
  }
  return state;
}

function bizCnProviderPayload(extra = {}) {
  const state = bizCnProviderState();
  return {
    ...extra,
    provider: state.provider,
    model: state.model,
    text_provider: state.text_provider,
    image_provider: state.image_provider,
    provider_label: state.provider_label,
  };
}

window._bizCnCategory = '';
async function bizCnLoadScenarios() {
  const container = document.getElementById('biz-cn-scenario-list');
  try {
    const res = await api('/api/biz-cardnews/scenarios', { method: 'POST', body: { profile_id: parseInt(window._globalProfileId) } });
    const scenarios = res.scenarios || [];
    window._bizCnCategory = res.category || '';
    document.getElementById('biz-cn-scenario-type').textContent = `${scenarios.length}개 시나리오`;
    container.innerHTML = scenarios.map(s => {
      const isCustom = s.is_custom ? 1 : 0;
      const sid = s.id || 0;
      return `
      <div style="padding:14px 12px;background:${isCustom ? 'rgba(255,140,0,0.03)' : 'rgba(0,0,0,0.02)'};border:1px solid ${isCustom ? 'rgba(255,140,0,0.12)' : 'rgba(0,0,0,0.06)'};border-radius:12px;cursor:pointer;transition:all 0.15s;text-align:center;position:relative;"
           onclick="bizCnSelectScenario(this, '${escapeHtml(s.name).replace(/'/g,"\\'")}', '${escapeHtml(s.prompt || '').replace(/'/g,"\\'")}', '${s.type || 'general'}')"
           onmouseenter="this.style.background='rgba(255,140,0,0.04)';this.style.borderColor='rgba(255,140,0,0.2)';this.querySelector('.sc-actions')&&(this.querySelector('.sc-actions').style.opacity='1')"
           onmouseleave="this.style.background='${isCustom ? 'rgba(255,140,0,0.03)' : 'rgba(0,0,0,0.02)'}';this.style.borderColor='${isCustom ? 'rgba(255,140,0,0.12)' : 'rgba(0,0,0,0.06)'}';this.querySelector('.sc-actions')&&(this.querySelector('.sc-actions').style.opacity='0')">
        ${sid ? `<div class="sc-actions" style="position:absolute;top:4px;right:4px;display:flex;gap:2px;opacity:0;transition:opacity 0.15s;">
          <button onclick="event.stopPropagation();editScenario(${sid},'${escapeHtml(s.icon||'')}','${escapeHtml(s.name).replace(/'/g,"\\'")}','${escapeHtml(s.desc||'').replace(/'/g,"\\'")}','${escapeHtml(s.prompt||'').replace(/'/g,"\\'")}','${s.type||'general'}')" style="width:20px;height:20px;border:none;background:rgba(0,0,0,0.06);border-radius:6px;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;" title="수정">&#9998;</button>
          <button onclick="event.stopPropagation();deleteScenario(${sid},'${escapeHtml(s.name).replace(/'/g,"\\'")}')" style="width:20px;height:20px;border:none;background:rgba(255,59,48,0.08);border-radius:6px;cursor:pointer;font-size:10px;color:#ff3b30;display:flex;align-items:center;justify-content:center;" title="삭제">&times;</button>
        </div>` : ''}
        <div style="font-size:24px;margin-bottom:6px;">${s.icon || '📋'}</div>
        <div style="font-size:12px;font-weight:600;color:#1c1c1e;margin-bottom:2px;">${escapeHtml(s.name)}${isCustom ? '<span style="font-size:9px;color:#ff8c00;margin-left:3px;">AI</span>' : ''}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.35);line-height:1.3;">${escapeHtml(s.desc || '')}</div>
      </div>`;
    }).join('');
  } catch {}
}

// 시나리오 AI 생성
async function bizCnAiGenScenarios() {
  if (!window._globalProfileId) { toast('프로필을 먼저 선택하세요.', 'error'); return; }
  try {
    const p = await api(`/api/library/profiles/${window._globalProfileId}`);
    const countStr = await showInputModal('AI 시나리오 생성', `"${p.business_type || '업종'}"에 맞는 시나리오를 몇 개 생성할까요?`, '5');
    if (!countStr) return;
    const count = parseInt(countStr) || 5;
    toast('AI가 시나리오를 생성하고 있습니다...');
    const res = await api('/api/biz-scenarios/ai-generate', {
      method: 'POST',
      body: bizCnProviderPayload({ business_type: p.business_type || '', keywords: p.keywords || '', count, category: window._bizCnCategory || p.business_type || '' })
    });
    toast(`${res.saved}개 시나리오가 생성되었습니다!`);
    bizCnLoadScenarios();
  } catch (e) { toast('AI 생성 실패: ' + e.message, 'error'); }
}

// 시나리오 모달
function bizCnAddScenarioModal() {
  if (!window._bizCnCategory && !window._globalProfileId) { toast('프로필을 먼저 선택하세요.', 'error'); return; }
  document.getElementById('scenario-modal-title').textContent = '시나리오 추가';
  document.getElementById('scenario-edit-id').value = '';
  document.getElementById('scenario-edit-icon').value = '✨';
  document.getElementById('scenario-edit-name').value = '';
  document.getElementById('scenario-edit-desc').value = '';
  document.getElementById('scenario-edit-prompt').value = '';
  document.getElementById('scenario-edit-type').value = 'general';
  const modal = document.getElementById('scenario-edit-modal');
  modal.style.display = 'flex';
}

function editScenario(id, icon, name, desc, prompt, type) {
  document.getElementById('scenario-modal-title').textContent = '시나리오 수정';
  document.getElementById('scenario-edit-id').value = id;
  document.getElementById('scenario-edit-icon').value = icon;
  document.getElementById('scenario-edit-name').value = name;
  document.getElementById('scenario-edit-desc').value = desc;
  document.getElementById('scenario-edit-prompt').value = prompt;
  document.getElementById('scenario-edit-type').value = type;
  const modal = document.getElementById('scenario-edit-modal');
  modal.style.display = 'flex';
}

function closeScenarioModal() {
  document.getElementById('scenario-edit-modal').style.display = 'none';
}

async function saveScenario() {
  const id = document.getElementById('scenario-edit-id').value;
  const data = {
    icon: document.getElementById('scenario-edit-icon').value,
    name: document.getElementById('scenario-edit-name').value,
    desc: document.getElementById('scenario-edit-desc').value,
    prompt: document.getElementById('scenario-edit-prompt').value,
    type: document.getElementById('scenario-edit-type').value,
    category: window._bizCnCategory || '_공통',
  };
  if (!data.name) { toast('이름을 입력하세요.', 'error'); return; }
  try {
    if (id) {
      await api(`/api/biz-scenarios/${id}`, { method: 'PUT', body: data });
      toast('시나리오가 수정되었습니다.');
    } else {
      await api('/api/biz-scenarios/add', { method: 'POST', body: data });
      toast('시나리오가 추가되었습니다.');
    }
    closeScenarioModal();
    bizCnLoadScenarios();
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function deleteScenario(id, name) {
  if (!confirm(`"${name}" 시나리오를 삭제할까요?`)) return;
  try {
    await api(`/api/biz-scenarios/${id}`, { method: 'DELETE' });
    toast('시나리오가 삭제되었습니다.');
    bizCnLoadScenarios();
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

window._bizCnLogoPos = 'bottom-right';
function setBizLogoPos(pos, btn) {
  window._bizCnLogoPos = pos;
  btn.parentElement.querySelectorAll('.qs-btn').forEach(b => b.classList.remove('qs-active'));
  btn.classList.add('qs-active');
}

function bizCnSelectScenario(el, name, prompt, type) {
  // 선택 표시
  document.querySelectorAll('#biz-cn-scenario-list > div').forEach(d => {
    d.style.borderColor = 'rgba(0,0,0,0.06)'; d.style.background = 'rgba(0,0,0,0.02)';
  });
  el.style.borderColor = 'rgba(255,140,0,0.4)';
  el.style.background = 'rgba(255,140,0,0.06)';
  // 주제에 시나리오명 입력
  document.getElementById('biz-cn-custom-topic').value = name;
  window._bizCnScenarioType = type || 'general';

  // 이미지 업로드 UI 전환
  document.getElementById('biz-cn-upload-general').style.display = 'none';
  document.getElementById('biz-cn-upload-beforeafter').style.display = 'none';
  document.getElementById('biz-cn-upload-process').style.display = 'none';

  if (type === 'before_after') {
    document.getElementById('biz-cn-upload-beforeafter').style.display = 'block';
  } else if (type === 'process') {
    document.getElementById('biz-cn-upload-process').style.display = 'block';
  } else {
    document.getElementById('biz-cn-upload-general').style.display = 'block';
  }

  // 전문 내용 플레이스홀더
  const expert = document.getElementById('biz-cn-expert-content');
  const placeholders = {
    'before_after': `"${name}" — 전후 비교 내용을 입력하세요\n\n예:\n• 전: 기존 상태 설명\n• 후: 시술/작업 후 변화\n• 소요 시간, 비용, 사용 제품 등`,
    'process': `"${name}" — 각 단계별 설명을 입력하세요\n\n예:\n• 1단계: 상담 및 진단\n• 2단계: 시술/작업 시작\n• 3단계: 마무리\n• 소요 시간, 주의사항 등`,
    'portfolio': `"${name}" — 작업물 설명을 입력하세요\n\n예:\n• 작업 컨셉과 스타일\n• 사용 재료/도구\n• 고객 요청 사항\n• 소요 시간, 가격 등`,
    'general': `"${name}" 시나리오에 필요한 내용을 입력하세요\n\n예: 실제 사진 설명, 가격, 과정, 고객 후기 등\n\n입력 없이 바로 생성하려면 "생성" 버튼을 누르세요`,
  };
  expert.placeholder = placeholders[type] || placeholders['general'];
  expert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  expert.focus();
}

// 전후 비교 이미지 미리보기
function bizCnPreviewBA(which, input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(`biz-cn-${which}-preview`);
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(input.files[0]);
}

// 단계별 과정 이미지
let _bizCnProcessImages = [];
function bizCnAddProcessSlot() {
  document.getElementById('biz-cn-process-input').click();
}
function bizCnProcessFileSelected(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  _bizCnProcessImages.push(file);
  const reader = new FileReader();
  reader.onload = e => {
    const slots = document.getElementById('biz-cn-process-slots');
    const addBtn = slots.lastElementChild;
    const slot = document.createElement('div');
    slot.style.cssText = 'min-width:80px;height:80px;border-radius:10px;overflow:hidden;flex-shrink:0;position:relative;';
    const idx = _bizCnProcessImages.length;
    slot.innerHTML = `
      <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">
      <span style="position:absolute;top:2px;left:4px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;">${idx}</span>
    `;
    slots.insertBefore(slot, addBtn);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function bizCnRefreshTopics(profileData) {
  const container = document.getElementById('biz-cn-topics-list');
  container.innerHTML = '<div style="text-align:center;padding:16px;"><span class="spinner"></span> 주제 추천 중...</div>';

  try {
    const res = await api('/api/biz-cardnews/topics', {
      method: 'POST',
      body: bizCnProviderPayload({ profile_id: parseInt(window._globalProfileId) }),
    });
    const topics = res.topics || [];
    if (!topics.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);">추천 주제가 없습니다</div>';
      return;
    }
    container.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
      topics.map(t => {
        const name = typeof t === 'string' ? t : (t.name || t.title || '');
        const icon = typeof t === 'object' && t.icon ? t.icon + ' ' : '';
        const desc = typeof t === 'object' && t.description ? `<div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:2px;">${escapeHtml(t.description)}</div>` : '';
        return `<div onclick="bizCnStartTopic('${escapeHtml(name).replace(/'/g, "\\'")}')" style="padding:14px 16px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:12px;cursor:pointer;transition:all 0.15s;font-size:13px;color:#1c1c1e;line-height:1.4;"
             onmouseenter="this.style.background='rgba(255,140,0,0.04)';this.style.borderColor='rgba(255,140,0,0.2)'"
             onmouseleave="this.style.background='rgba(0,0,0,0.02)';this.style.borderColor='rgba(0,0,0,0.06)'">
          ${icon}${escapeHtml(name)}${desc}
        </div>`;
      }).join('') + '</div>';
  } catch (e) {
    container.innerHTML = `<div style="color:#ff3b30;text-align:center;padding:16px;">${escapeHtml(e.message)}</div>`;
  }
}

function bizCnStartTopic(topic) {
  document.getElementById('biz-cn-custom-topic').value = topic;
  // 전문 내용 입력으로 스크롤 + 포커스
  const expertEl = document.getElementById('biz-cn-expert-content');
  expertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  expertEl.focus();
  expertEl.placeholder = `"${topic}" 주제에 대해 알고 있는 내용을 입력하세요\n\n예: 실제 사례, 전문 지식, 가격 정보, 과정 설명 등\n\n입력 없이 바로 생성하려면 "생성" 버튼을 누르세요`;
}

async function bizCnSuggestFromMaterial() {
  const topicEl = document.getElementById('biz-cn-custom-topic');
  const expertEl = document.getElementById('biz-cn-expert-content');
  const panel = document.getElementById('biz-cn-material-suggestions');
  const btn = document.getElementById('biz-cn-suggest-btn');
  const rawTopic = topicEl?.value?.trim() || '';
  const expertContent = expertEl?.value?.trim() || '';
  if (!rawTopic && !expertContent) { toast('주제나 소재를 먼저 입력하세요', 'error'); return; }
  if (!window._globalProfileId) { toast('프로필을 선택하세요', 'error'); return; }

  const profileName = document.getElementById('biz-cn-profile-name')?.textContent?.trim() || '';
  const businessType = document.getElementById('biz-cn-profile-type')?.textContent?.trim() || '';
  const seedText = [rawTopic, expertContent].filter(Boolean).join('\n\n');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span> 추천 중...';
  panel.style.display = 'block';
  panel.innerHTML = '<div style="text-align:center;padding:8px 0;color:rgba(0,0,0,0.4);font-size:12px;"><span class="spinner" style="width:14px;height:14px;border-width:2px;"></span><div style="margin-top:8px;">입력한 소재를 바탕으로 카드뉴스 주제를 정리하고 있습니다...</div></div>';

  try {
    const res = await api('/api/ce2/assist', {
      method: 'POST',
      body: bizCnProviderPayload({
        action: 'topics',
        industry: businessType || '일반',
        brand_name: profileName,
        brand_desc: rawTopic,
        brand_biz_detail: seedText,
        count: 8,
      }),
    });
    const items = Array.isArray(res?.items) ? res.items.filter(Boolean) : [];
    if (!items.length) throw new Error('추천 결과가 없습니다');

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;font-weight:700;color:#ff8c00;">소재 기반 추천 주제</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-top:2px;">원하는 후보를 눌러 바로 주제로 채우고, 이후 생성으로 진행하세요.</div>
        </div>
        <button type="button" onclick="this.closest('#biz-cn-material-suggestions').style.display='none'" style="padding:5px 10px;border:none;border-radius:999px;background:rgba(0,0,0,0.06);font-size:11px;color:rgba(0,0,0,0.5);cursor:pointer;">닫기</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${items.map(item => `<button type="button" onclick="bizCnApplySuggestedTopic('${escapeHtml(String(item)).replace(/'/g, "\\'")}')" style="padding:9px 12px;border:1px solid rgba(255,140,0,0.16);background:#fff;border-radius:10px;font-size:12px;color:#1c1c1e;cursor:pointer;line-height:1.45;text-align:left;">${escapeHtml(String(item))}</button>`).join('')}
      </div>
    `;
  } catch (e) {
    panel.innerHTML = `<div style="color:#ff3b30;font-size:12px;padding:4px 0;">추천 실패: ${escapeHtml(e.message || '알 수 없는 오류')}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>추천받기';
  }
}

function bizCnApplySuggestedTopic(topic) {
  const topicEl = document.getElementById('biz-cn-custom-topic');
  if (topicEl) topicEl.value = topic;
  const panel = document.getElementById('biz-cn-material-suggestions');
  if (panel) panel.style.display = 'none';
  const expertEl = document.getElementById('biz-cn-expert-content');
  if (expertEl) {
    expertEl.focus();
    expertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  toast('추천 주제를 입력창에 반영했습니다.');
}

let _bizCnGenerating = false;
async function bizDeepResearch() {
  const topic = document.getElementById('biz-cn-custom-topic')?.value?.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }

  const btn = document.getElementById('biz-deep-research-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span> 조사 중...';
  toast('AI 조사 시작 — Google 검색으로 조사 중...');

  try {
    const body = bizCnProviderPayload({ query: topic });
    if (window._globalProfileId) body.profile_id = parseInt(window._globalProfileId);
    const res = await api('/api/deep-research', { method: 'POST', body, timeout: 600000 });

    if (res.result) {
      // 전문 내용 입력란에 결과 추가
      const expert = document.getElementById('biz-cn-expert-content');
      expert.value = (expert.value ? expert.value + '\n\n--- AI 조사 결과 ---\n' : '') + res.result;
      toast(`AI 조사 완료! ${res.result.length.toLocaleString()}자 수집 — 전문 내용에 추가됨`);
    } else {
      toast(res.error || 'AI 조사 실패', 'error');
    }
  } catch (e) {
    toast('AI 조사 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 AI 조사';
  }
}

async function bizCnStartCustom() {
  if (_bizCnGenerating) { toast('이미 생성 중입니다', 'error'); return; }
  _bizCnGenerating = true;
  const topic = document.getElementById('biz-cn-custom-topic').value.trim();
  if (!topic) { _bizCnGenerating = false; toast('주제를 입력하세요', 'error'); return; }
  if (!window._globalProfileId) { _bizCnGenerating = false; toast('프로필을 선택하세요', 'error'); return; }

  // 현재 UI → 전역 옵션 동기화
  syncUIToOpts('biz');
  const _bo = getContentOpts();
  const style = document.querySelector('input[name="biz-cn-style"]:checked')?.value || _bo.cn_style;
  const slides = document.getElementById('biz-cn-slides')?.value || _bo.cn_slides;
  const videoMode = document.querySelector('input[name="biz-cn-video"]:checked')?.value || 'slide';
  const voice = _bo.voice;
  const camera = _bo.camera;
  const expertContent = document.getElementById('biz-cn-expert-content')?.value?.trim() || '';
  const providerState = bizCnProviderState();

  const resultCard = document.getElementById('biz-cn-result');
  const resultContent = document.getElementById('biz-cn-result-content');
  resultCard.style.display = 'block';
  resultContent.innerHTML = `<div style="text-align:center;padding:24px;"><span class="spinner"></span><div style="margin-top:8px;color:rgba(0,0,0,0.4);font-size:13px;">${escapeHtml(providerState.label)}로 카드뉴스 텍스트 생성 중...</div></div>`;
  resultCard.scrollIntoView({ behavior: 'smooth' });

  try {
    const profileData = await api(`/api/library/profiles/${window._globalProfileId}`).catch(() => ({}));
    const brandName = profileData?.name || document.getElementById('biz-cn-profile-name')?.textContent || '';
    const brandType = profileData?.business_type || document.getElementById('biz-cn-profile-type')?.textContent || '';
    const sourceTexts = [expertContent, profileData?.description, profileData?.biz_detail, profileData?.business_goal].filter(Boolean);
    // 1. 카드뉴스 텍스트 생성
    const textRes = await api('/api/cardnews/generate-texts', {
      method: 'POST',
      body: bizCnProviderPayload({
        profile_id: parseInt(window._globalProfileId),
        keyword: topic,
        topic,
        cardnews_slides: parseInt(slides),
        count: parseInt(slides),
        cardnews_style: style,
        style,
        scraped_texts: sourceTexts,
        expert_content: expertContent,
        brand_name: brandName,
        brand_description: [profileData?.description, profileData?.biz_detail].filter(Boolean).join('\n\n'),
        brand_color: profileData?.brand_color || '',
        brand_logo_url: profileData?.logo_url || profileData?.logo_path || '',
        contact_info: profileData?.contact_info || '',
        business_goal: profileData?.business_goal || '',
        cta_text: profileData?.cta_text || '',
        tone: _bo.tone,
        title_length: document.querySelector('input[name="biz-cn-title-len"]:checked')?.value || 'short',
        body_length: document.querySelector('input[name="biz-cn-body-len"]:checked')?.value || 'short',
        include_cta: _bo.cta,
        color_tone: document.querySelector('input[name="biz-cn-color"]:checked')?.value || 'auto',
      }),
    });

    if (!textRes.slides?.length) throw new Error('슬라이드 생성 실패');

    resultContent.innerHTML = `<div style="margin-bottom:12px;font-size:13px;color:rgba(0,0,0,0.4);">텍스트 ${textRes.slides.length}장 생성 완료. 이미지 생성 중...</div>`;

    // 2. AI 스타일 자동 결정 (무조건 AI가 선택)
    let finalStyle = style;
    try {
      const slideTexts = textRes.slides.map(s => `${s.title}: ${s.body}`).join('\n');
      const styleRes = await api('/api/cardnews/ai-style', {
        method: 'POST',
        body: bizCnProviderPayload({ keyword: `${topic} (${brandType})`, slide_texts: slideTexts }),
      });
      finalStyle = styleRes.style || 'modern';
      resultContent.innerHTML = `<div style="margin-bottom:8px;font-size:12px;color:#ff8c00;">AI가 "${finalStyle}" 스타일을 선택했습니다 — ${styleRes.reason || ''}</div>` + resultContent.innerHTML;
    } catch { finalStyle = style === 'ai-auto' ? 'modern' : style; }

    // 3. 이미지 생성
    let slidesHtml = '';
    for (let i = 0; i < textRes.slides.length; i++) {
      resultContent.innerHTML = `<div style="text-align:center;padding:16px;"><span class="spinner"></span><div style="margin-top:8px;color:rgba(0,0,0,0.4);font-size:13px;">${escapeHtml(providerState.label)} 설정으로 이미지 ${i+1}/${textRes.slides.length} 생성 중... (${finalStyle})</div></div>` + slidesHtml;

      try {
        const imgRes = await api('/api/cardnews/generate-single', {
          method: 'POST',
          body: bizCnProviderPayload({
            slide: textRes.slides[i],
            topic, style: finalStyle, aspect_ratio: _bo.cn_ratio,
            project_dir: textRes.project_dir || '',
            cardnews_id: textRes.cardnews_id || null,
            profile_id: parseInt(window._globalProfileId),
            brand_name: brandName,
            brand_color: profileData?.brand_color || '',
            brand_logo_url: profileData?.logo_url || profileData?.logo_path || '',
            logo_text: getOpt('logo_insert') ? brandName : '',
            logo_enabled: !!getOpt('logo_insert'),
            logo_position: getOpt('logo_insert') ? getOpt('logo_position', 'bottom-right') : '',
          }),
        });
        if (imgRes.image_url) {
          if (!textRes.project_dir && imgRes.project_dir) textRes.project_dir = imgRes.project_dir;
          if (!textRes.cardnews_id && imgRes.cardnews_id) textRes.cardnews_id = imgRes.cardnews_id;
          slidesHtml += `<img src="${encImg('/api/cardnews/image/' + imgRes.image_url)}?t=${Date.now()}" style="width:100%;border-radius:8px;cursor:pointer;" onclick="kcShowImagePreview(this.src)">`;
        }
      } catch (e) {
        slidesHtml += `<div style="padding:16px;text-align:center;background:rgba(255,59,48,0.05);border-radius:10px;margin-bottom:8px;color:#ff3b30;font-size:12px;">슬라이드 ${i+1} 실패: ${escapeHtml(e.message)}</div>`;
      }
    }

    // 4. 영상 생성
    let videoHtml = '';
    if (videoMode !== 'none' && textRes.cardnews_id) {
      resultContent.innerHTML = `<div style="text-align:center;padding:16px;"><span class="spinner"></span><div style="margin-top:8px;color:rgba(0,0,0,0.4);font-size:13px;">${videoMode === 'ai' ? 'AI 영상(Veo) 생성 중...' : '슬라이드 영상 변환 중...'}</div></div>` + slidesHtml;
      try {
        let vidRes;
        if (videoMode === 'ai') {
          // Veo AI 영상 생성
          vidRes = await api('/api/video/veo3', {
            method: 'POST',
            body: {
              topic, slides: textRes.slides,
              cardnews_id: textRes.cardnews_id,
              project_dir: textRes.project_dir || '',
              brand_name: brandName,
              provider: providerState.provider,
              model: providerState.model,
              camera_freedom: camera,
              narration_mode: 'on',
              voice,
            },
          });
        } else {
          // 슬라이드 영상 (카드뉴스 → TTS + Ken Burns)
          vidRes = await api('/api/video/from-cardnews', {
            method: 'POST',
            body: bizCnProviderPayload({ cardnews_id: textRes.cardnews_id, voice, speed: 1.0 }),
          });
        }
        if (vidRes.video_path) {
          const vp = vidRes.video_path.split('/videos/');
          const relPath = vp.length > 1 ? vp[1] : vidRes.video_path;
          videoHtml = `<div style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <h3 style="font-size:14px;margin:0;">${videoMode === 'ai' ? 'AI 영상' : '슬라이드 영상'}</h3>
              <span style="font-size:11px;color:rgba(0,0,0,0.3);">${voice} · ${camera}</span>
            </div>
            <video controls src="/api/video/file/${relPath}" style="width:100%;max-width:360px;border-radius:10px;"></video>
          </div>`;
        }
      } catch (e) {
        videoHtml = `<div style="margin-top:12px;padding:12px;background:rgba(255,59,48,0.05);border-radius:10px;color:#ff3b30;font-size:12px;">영상 생성 실패: ${escapeHtml(e.message)}</div>`;
      }
    }

    // 5. 결과 표시
    resultContent.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:14px;font-weight:600;color:#1c1c1e;">${escapeHtml(topic)}</span>
        <span style="font-size:11px;color:rgba(0,0,0,0.3);">${escapeHtml(providerState.label)} · ${finalStyle} · ${textRes.slides.length}장</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;max-width:500px;">${slidesHtml}</div>
      <div style="max-width:360px;">${videoHtml}</div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-sm" onclick="bizCnRefreshTopics()" style="background:rgba(0,0,0,0.06);color:#1c1c1e;border:none;border-radius:10px;">다른 주제</button>
        <button class="btn btn-sm" onclick="kcOpenCardnewsFolder()" style="background:rgba(0,0,0,0.06);color:#1c1c1e;border:none;border-radius:10px;">폴더 열기</button>
      </div>
    `;
    toast('카드뉴스 생성 완료!');

  } catch (e) {
    resultContent.innerHTML = `<div style="color:#ff3b30;text-align:center;padding:20px;">생성 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    _bizCnGenerating = false;
  }
}

// ═══ 브라우저 자동화 (CDP 시나리오) ═══
