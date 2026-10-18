// ═══ projects_history/projects_list.js ═══
// 전역 프로필 · 프로젝트 목록/CRUD · 댓글 모니터
// (원본 projects_history.js 라인 2958-3663 추출)

// ═══ 전역 프로필 ═══
window._globalProfileId = null;
window._globalProfileData = null;
let _globalProfileSelectInitialized = false;

async function loadGlobalProfileSelect() {
  if (_globalProfileSelectInitialized) return;
  _globalProfileSelectInitialized = true;
  try {
    const [res, defaultRes] = await Promise.all([
      api('/api/library/profiles'),
      api('/api/library/default').catch(() => ({ profile: null })),
    ]);
    const profiles = Array.isArray(res) ? res : (res.profiles || []);
    const sel = document.getElementById('global-profile-select');
    const chromeSel = document.getElementById('chrome-profile-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">프로필을 선택하세요</option>';
    if (chromeSel) chromeSel.innerHTML = '<option value="">연결할 프로필 선택</option>';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.logo_url ? '🟢 ' : '') + p.name + (p.business_type ? ` (${p.business_type})` : '');
      opt.dataset.logoUrl = p.logo_url || '';
      sel.appendChild(opt);

      if (chromeSel) {
        const chromeOpt = document.createElement('option');
        chromeOpt.value = p.id;
        chromeOpt.textContent = p.name + (p.business_type ? ` (${p.business_type})` : '');
        chromeSel.appendChild(chromeOpt);
      }
    });
    // An empty local profile list does not interrupt the workspace on startup.
    // Content generation still uses requireProfile() below.
    if (profiles.length === 0) return;

    // DB 기본 프로필 자동 선택
    const defaultProfileId = defaultRes?.profile?.id ? String(defaultRes.profile.id) : '';
    if (defaultProfileId && profiles.find(p => String(p.id) === defaultProfileId)) {
      sel.value = defaultProfileId;
      if (chromeSel) chromeSel.value = defaultProfileId;
      await setGlobalProfile(defaultProfileId, true, false);
      updateProfileButton(defaultProfileId);
    } else if (profiles.length === 1) {
      // 프로필이 1개면 DB 기본 프로필로 자동 저장
      sel.value = profiles[0].id;
      if (chromeSel) chromeSel.value = String(profiles[0].id);
      await setGlobalProfile(String(profiles[0].id), true, true);
      updateProfileButton(String(profiles[0].id));
    }
    // 트렌드 페이지 프로필 드롭다운도 동기화
    syncProfileDropdowns(profiles);
  } catch {
    _globalProfileSelectInitialized = false;
  }
}

async function setGlobalProfile(profileId, silent, persistToDb = true) {
  window._globalProfileId = profileId || null;
  const chromeSel = document.getElementById('chrome-profile-select');
  if (chromeSel) chromeSel.value = profileId || '';

  if (persistToDb) {
    try {
      if (profileId) await api(`/api/library/default/${profileId}`, { method: 'PUT' });
      else await api('/api/library/default', { method: 'DELETE' });
      await loadDefaultProfile();
    } catch (e) {
      console.error('[setGlobalProfile] DB 저장 실패:', e);
    }
  }

  // 트렌드 AI 프로필 동기화
  const tdSel = document.getElementById('td-ai-profile');
  if (tdSel) tdSel.value = profileId || '';
  // 프로필 데이터 로드 → 전역 옵션 세팅 → 모든 화면 동기화
  if (profileId) {
    try {
      const p = await api(`/api/library/profiles/${profileId}`);
      window._globalProfileData = p;
      loadProfileToGlobalOpts(p);
      syncOptsToUI('all');
      renderOptsPreview('kc-opts-preview');
      renderOptsPreview('biz-opts-preview');
      renderOptsPreview('lib-opts-preview');
      await syncChromeConnectionForCurrentProfile();
    } catch {}
  }
  // 3단계 프로필 동기화
  const libSel = document.getElementById('kc-library-select');
  if (libSel && profileId) {
    libSel.value = profileId;
    kcLoadFromLibrary(profileId);
  }
  if (!silent && profileId) toast('프로필 적용됨');
  if (!profileId) checkBrowserStatus();
  try { window.dispatchEvent(new CustomEvent('profile:changed', { detail: { profileId } })); } catch (_) {}
}

async function handleChromeProfileQuickSelect(profileId) {
  if (!profileId) return;
  const globalSel = document.getElementById('global-profile-select');
  if (globalSel) globalSel.value = profileId;
  await setGlobalProfile(String(profileId), false, true);
}

function syncProfileDropdowns(profiles) {
  // 트렌드 AI 분석 프로필 드롭다운
  const tdSel = document.getElementById('td-ai-profile');
  if (tdSel) {
    tdSel.innerHTML = '<option value="">프로필 없이 분석</option>';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      tdSel.appendChild(opt);
    });
    if (window._globalProfileId) tdSel.value = window._globalProfileId;
  }
}

function initGlobalProfileSelectLoader() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(loadGlobalProfileSelect, 500), { once: true });
    return;
  }
  setTimeout(loadGlobalProfileSelect, 0);
}

// 페이지 로드 시 프로필 목록 로드
initGlobalProfileSelectLoader();

// ═══ 프로젝트 관리 ═══
let _projPage = 0;
const PROJ_PAGE_SIZE = 5;

// 프로젝트 자동 생성 (이름/키워드는 나중에 콘텐츠에서 자동 설정)
/** 프로필 필수 체크 — 없으면 프로필 생성/선택 유도 */
function requireProfile() {
  if (window._globalProfileId) return true;
  // 프로필이 없으면 안내
  let modal = document.getElementById('need-profile-modal');
  if (modal) { modal.style.display = 'flex'; return false; }
  modal = document.createElement('div');
  modal.id = 'need-profile-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:32px;width:400px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">👤</div>
      <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin-bottom:8px;">프로필을 먼저 선택하세요</h2>
      <p style="font-size:13px;color:rgba(0,0,0,0.5);margin-bottom:20px;line-height:1.5;">콘텐츠를 생성하려면 프로필이 필요합니다.<br>프로필에 업종, 톤, 옵션이 저장되어 있어<br>모든 생성에 자동 적용됩니다.</p>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button onclick="document.getElementById('need-profile-modal').style.display='none'" style="padding:10px 20px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:12px;font-size:13px;cursor:pointer;">닫기</button>
        <button onclick="document.getElementById('need-profile-modal').style.display='none';document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-library').classList.add('active');libShowEditModal()" style="padding:10px 20px;background:#ff8c00;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;">프로필 만들기</button>
        <button onclick="document.getElementById('need-profile-modal').style.display='none';openProfilePickerModal()" style="padding:10px 20px;background:#007aff;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;">프로필 선택</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  document.body.appendChild(modal);
  return false;
}

async function autoCreateProject(name) {
  const projName = name || `프로젝트 ${new Date().toLocaleDateString('ko-KR')} ${new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'})}`;
  const body = { name: projName };
  if (window._globalProfileId) body.profile_id = parseInt(window._globalProfileId);
  const res = await api('/api/projects', { method: 'POST', body });
  window._currentProjectId = res.id;
  return res.id;
}

// 퀵스타트: 트렌드로 시작
async function quickStartTrend() {
  const projId = await autoCreateProject('트렌드 콘텐츠');
  // 트렌드 대시보드로 이동
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-trend-dashboard').classList.add('active');
  loadTrendDashboard();
  toast('트렌드에서 뉴스를 선택하세요!');
}

// 퀵스타트: 직접 키워드
async function quickStartDirect() {
  const projId = await autoCreateProject();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-keyword-content').classList.add('active');
  kcReset();
  kcInit();
  document.getElementById('kc-keyword').focus();
  toast('키워드를 입력하고 검색하세요!');
}

// 퀵스타트: URL로 시작
async function quickStartUrl() {
  // URL 입력 모달 표시
  let modal = document.getElementById('url-input-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'url-input-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:28px;width:90%;max-width:460px;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
        <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">URL로 콘텐츠 생성</h2>
        <p style="font-size:13px;color:rgba(0,0,0,0.4);margin-bottom:16px;">기사 또는 상품 URL을 입력하세요</p>
        <input type="text" id="url-input-field" placeholder="https://..." style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.1);font-size:15px;margin-bottom:16px;" autofocus>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('url-input-modal').remove()">취소</button>
          <button class="btn btn-primary btn-sm" onclick="submitUrlStart()">시작</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('url-input-field').focus();
    document.getElementById('url-input-field').addEventListener('keydown', e => { if (e.key === 'Enter') submitUrlStart(); });
  }
}

async function submitUrlStart() {
  const url = document.getElementById('url-input-field')?.value?.trim();
  document.getElementById('url-input-modal')?.remove();
  if (!url || !url.startsWith('http')) { toast('올바른 URL을 입력하세요', 'error'); return; }

  const projId = await autoCreateProject(new URL(url).hostname);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-keyword-content').classList.add('active');
  kcReset();
  kcInit();

  setTimeout(() => {
    _kcSearchData = { keyword: url, sources: [] };
    _kcSelectedSources.push({ title: url, url, source: '', type: 'url', checked: true });
    try { document.getElementById('kc-keyword').value = new URL(url).hostname; } catch {}
    kcRenderSourcesList();
    kcGoToStep(2);
    kcScrapeArticle(0);
  }, 300);
}

async function quickStartAuto() {
  toast('원클릭 자동 기능은 제거되었습니다.');
  return false;
}

let _projMigrated = false;
let _projProfilesLoaded = false;
async function loadProjProfileFilter() {
  if (_projProfilesLoaded) return;
  _projProfilesLoaded = true;
  try {
    const res = await api('/api/library/profiles');
    const profiles = Array.isArray(res) ? res : (res.profiles || []);
    const sel = document.getElementById('proj-profile-filter');
    if (!sel) return;
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  } catch {}
}

async function loadProjects(page) {
  loadProjProfileFilter();
  // 첫 로드 시 기존 콘텐츠 마이그레이션
  if (!_projMigrated) {
    _projMigrated = true;
    try { await api('/api/projects/migrate-existing', { method: 'POST' }); } catch {}
  }
  if (page !== undefined) _projPage = page;
  const list = document.getElementById('proj-list');
  const paging = document.getElementById('proj-paging');
  closeProjectDetailModal();
  const q = (document.getElementById('proj-search')?.value || '').trim();
  const profileFilter = document.getElementById('proj-profile-filter')?.value || '';
  try {
    const res = await api(`/api/projects?limit=${PROJ_PAGE_SIZE}&offset=${_projPage * PROJ_PAGE_SIZE}&q=${encodeURIComponent(q)}${profileFilter ? '&profile_id=' + profileFilter : ''}`);
    const items = res.items || [];
    if (!items.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">프로젝트가 없습니다. "새 프로젝트"를 만들어보세요!</div>';
      paging.innerHTML = '';
      return;
    }
    list.innerHTML = items.map(p => {
      // 블로그 태그 파싱
      let blogTagsHtml = '';
      if (p.blog_tags) {
        try {
          const tags = typeof p.blog_tags === 'string' ? (p.blog_tags.startsWith('[') ? JSON.parse(p.blog_tags) : p.blog_tags.split(',')) : (p.blog_tags || []);
          const tagArr = tags.map(t => String(t).trim()).filter(t => t);
          if (tagArr.length > 0) {
            blogTagsHtml = tagArr.slice(0, 5).map(t => `<span style="padding:1px 6px;background:rgba(255,140,0,0.06);color:rgba(255,140,0,0.7);border-radius:4px;font-size:9px;">#${escapeHtml(t)}</span>`).join(' ');
          }
        } catch {}
      }
      const badges = [
        p.has_blog ? (p.blog_url ? `<a href="${escapeHtml(p.blog_url)}" target="_blank" onclick="event.stopPropagation();" style="padding:2px 8px;background:rgba(3,199,90,0.15);color:#03c75a;border-radius:6px;font-size:10px;text-decoration:none;font-weight:600;">블로그 →</a>` : '<span style="padding:2px 8px;background:rgba(52,199,89,0.1);color:#34c759;border-radius:6px;font-size:10px;">블로그</span>') : '',
        p.has_cardnews ? '<span style="padding:2px 8px;background:rgba(255,149,0,0.1);color:#ff9500;border-radius:6px;font-size:10px;">카드뉴스</span>' : '',
        p.has_blog_images ? '<span style="padding:2px 8px;background:rgba(175,82,222,0.1);color:#af52de;border-radius:6px;font-size:10px;">블로그 이미지</span>' : '',
        p.has_detail_page ? '<span style="padding:2px 8px;background:rgba(0,199,190,0.1);color:#00c7be;border-radius:6px;font-size:10px;">상세페이지</span>' : '',
        p.has_comic ? '<span style="padding:2px 8px;background:rgba(255,214,0,0.15);color:#c89600;border-radius:6px;font-size:10px;">만화</span>' : '',
        p.has_sns ? '<span style="padding:2px 8px;background:rgba(175,82,222,0.1);color:#af52de;border-radius:6px;font-size:10px;">SNS</span>' : '',
        p.threads_url ? `<a href="${escapeHtml(p.threads_url)}" target="_blank" onclick="event.stopPropagation();" style="padding:2px 8px;background:rgba(0,0,0,0.06);color:#000;border-radius:6px;font-size:10px;text-decoration:none;font-weight:600;">스레드 →</a>` : '',
        p.twitter_url ? `<a href="${escapeHtml(p.twitter_url)}" target="_blank" onclick="event.stopPropagation();" style="padding:2px 8px;background:rgba(0,0,0,0.06);color:#000;border-radius:6px;font-size:10px;text-decoration:none;font-weight:600;">트위터 →</a>` : '',
        p.youtube_url ? `<a href="${escapeHtml(p.youtube_url)}" target="_blank" onclick="event.stopPropagation();" style="padding:2px 8px;background:rgba(255,0,0,0.08);color:#ff0000;border-radius:6px;font-size:10px;text-decoration:none;font-weight:600;">유튜브 →</a>` : '',
      ].filter(Boolean).join(' ');
      const logoHtml = p.profile_logo_url
        ? `<img src="${p.profile_logo_url}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:36px;height:36px;border-radius:10px;background:rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;color:rgba(0,0,0,0.2);">${(p.profile_name||p.name||'?')[0]}</div>`;
      return `<div id="proj-item-${p.id}" style="padding:14px;border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;border-radius:12px;transition:all 0.25s;"
        onmouseenter="this.style.background='rgba(255,140,0,0.04)';this.style.transform='scale(1.01)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.06)';this.querySelector('.proj-actions').style.opacity='1'"
        onmouseleave="this.style.background='transparent';this.style.transform='scale(1)';this.style.boxShadow='none';this.querySelector('.proj-actions').style.opacity='0'"
        onclick="openProjectDetail(${p.id}, this)">
        <div style="display:flex;align-items:center;gap:12px;">
          <input type="checkbox" class="proj-select-cb" data-proj-id="${p.id}" onclick="event.stopPropagation();projUpdateSelectCount()" style="display:none;width:16px;height:16px;accent-color:#ff3b30;flex-shrink:0;">
          ${logoHtml}
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.35);">${p.profile_name ? escapeHtml(p.profile_name) + ' · ' : ''}${escapeHtml(p.keyword || '')} · ${p.created_at?.slice(0,10) || ''}</div>
            <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">${badges || '<span style="font-size:10px;color:rgba(0,0,0,0.2);">콘텐츠 없음</span>'}</div>
            ${blogTagsHtml ? `<div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap;">${blogTagsHtml}</div>` : ''}
          </div>
          <div class="proj-actions" style="opacity:0;transition:opacity 0.2s;display:flex;gap:6px;align-items:center;flex-shrink:0;">
            <button onclick="event.stopPropagation();showConfirm('이 프로젝트를 삭제하시겠습니까?').then(ok=>{if(ok)deleteProject(${p.id})})" style="padding:5px 10px;font-size:11px;background:rgba(255,59,48,0.08);color:#ff3b30;border:1px solid rgba(255,59,48,0.15);border-radius:8px;cursor:pointer;font-weight:600;">삭제</button>
            <span style="font-size:13px;color:#ff8c00;font-weight:700;">보기 →</span>
          </div>
        </div>
      </div>`;
    }).join('');

    const totalPages = Math.ceil((res.total || 0) / PROJ_PAGE_SIZE);
    if (totalPages > 1) {
      let btns = '';
      if (_projPage > 0) btns += `<button class="btn btn-sm" onclick="loadProjects(0)" style="padding:6px 10px;background:rgba(0,0,0,0.06);border:none;border-radius:8px;font-size:12px;color:#1c1c1e;">처음</button>`;
      if (_projPage > 0) btns += `<button class="btn btn-sm" onclick="loadProjects(${_projPage-1})" style="padding:6px 12px;background:rgba(0,0,0,0.06);border:none;border-radius:8px;font-size:12px;color:#1c1c1e;">← 이전</button>`;
      btns += `<span style="color:rgba(0,0,0,0.5);font-size:13px;padding:6px 12px;font-weight:600;">${_projPage+1} / ${totalPages}</span>`;
      if (_projPage < totalPages-1) btns += `<button class="btn btn-sm" onclick="loadProjects(${_projPage+1})" style="padding:6px 12px;background:rgba(0,0,0,0.06);border:none;border-radius:8px;font-size:12px;color:#1c1c1e;">다음 →</button>`;
      if (_projPage < totalPages-1) btns += `<button class="btn btn-sm" onclick="loadProjects(${totalPages-1})" style="padding:6px 10px;background:rgba(0,0,0,0.06);border:none;border-radius:8px;font-size:12px;color:#1c1c1e;">마지막</button>`;
      paging.innerHTML = btns;
    } else { paging.innerHTML = ''; }
  } catch { list.innerHTML = '<div style="color:rgba(0,0,0,0.3);text-align:center;padding:20px;">불러오기 실패</div>'; }
}

let _projSelectMode = false;

function projToggleSelectMode() {
  _projSelectMode = !_projSelectMode;
  const toolbar = document.getElementById('proj-select-toolbar');
  const btn = document.getElementById('proj-select-mode-btn');
  if (toolbar) toolbar.style.display = _projSelectMode ? 'flex' : 'none';
  if (btn) { btn.textContent = _projSelectMode ? '취소' : '선택'; btn.style.background = _projSelectMode ? 'rgba(255,59,48,0.08)' : 'rgba(0,0,0,0.04)'; btn.style.color = _projSelectMode ? '#ff3b30' : 'rgba(0,0,0,0.5)'; }
  // 체크박스 토글
  document.querySelectorAll('.proj-select-cb').forEach(cb => { cb.style.display = _projSelectMode ? 'inline-block' : 'none'; cb.checked = false; });
  const allCb = document.getElementById('proj-select-all');
  if (allCb) allCb.checked = false;
  projUpdateSelectCount();
}

function projSelectAll(checked) {
  document.querySelectorAll('.proj-select-cb').forEach(cb => { cb.checked = checked; });
  projUpdateSelectCount();
}

function projUpdateSelectCount() {
  const count = document.querySelectorAll('.proj-select-cb:checked').length;
  const el = document.getElementById('proj-select-count');
  if (el) el.textContent = `${count}개 선택`;
}

async function projDeleteSelected() {
  const checked = document.querySelectorAll('.proj-select-cb:checked');
  if (!checked.length) { toast('삭제할 프로젝트를 선택하세요', 'error'); return; }
  if (!await showConfirm(`${checked.length}개 프로젝트를 삭제할까요?`)) return;
  let deleted = 0;
  for (const cb of checked) {
    const id = cb.dataset.projId;
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      const el = document.getElementById('proj-item-' + id);
      if (el) el.remove();
      deleted++;
    } catch {}
  }
  toast(`${deleted}개 프로젝트 삭제됨`);
  projToggleSelectMode();
  loadProjects();
}

async function deleteProject(id) {
  try {
    await api(`/api/projects/${id}`, { method: 'DELETE' });
    const el = document.getElementById('proj-item-' + id);
    if (el) { el.style.transition = 'all 0.3s'; el.style.opacity = '0'; el.style.maxHeight = '0'; setTimeout(() => el.remove(), 300); }
    toast('프로젝트 삭제됨');
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

// ═══ 댓글 모니터링 ═══

// 페이지 로드
async function cmLoadPage() {
  cmCheckStatus();
  cmLoadSummary();
  cmLoadComments('');
  cmLoadMalicious();
}

async function cmCheckStatus() {
  const panel = document.getElementById('cm-status-panel');
  if (!panel) return;

  let items = [];

  // 1. 크롬 연결
  try {
    const bs = await api('/api/browser/status');
    items.push(bs.connected
      ? '<div style="padding:6px 12px;background:rgba(52,199,89,0.08);border:1px solid rgba(52,199,89,0.15);border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#34c759;"></span>Chrome 연결됨</div>'
      : '<div style="padding:6px 12px;background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.15);border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#ff3b30;"></span>Chrome 미연결 <span style="font-size:10px;color:rgba(0,0,0,0.3);">댓글 수집에 필요</span></div>'
    );
  } catch {
    items.push('<div style="padding:6px 12px;background:rgba(255,59,48,0.08);border-radius:8px;font-size:12px;color:#ff3b30;">Chrome 확인 실패</div>');
  }

  // 2. 프로필 계정
  if (window._globalProfileData) {
    try {
      const pa = typeof window._globalProfileData.platform_accounts === 'string'
        ? JSON.parse(window._globalProfileData.platform_accounts) : window._globalProfileData.platform_accounts || {};

      const accounts = [
        { name: '네이버', key: 'naver', color: '#03c75a', on: pa.naver_on !== false && pa.naver },
        { name: '인스타', key: 'instagram', color: '#e1306c', on: pa.instagram_on !== false && pa.instagram_id },
        { name: '스레드', key: 'threads', color: '#1c1c1e', on: pa.threads_on !== false && pa.threads },
        { name: '트위터', key: 'twitter', color: '#1da1f2', on: pa.twitter_on !== false && pa.twitter_id },
        { name: '유튜브', key: 'youtube', color: '#ff0000', on: pa.youtube_on && pa.youtube },
      ];

      for (const a of accounts) {
        if (a.on) {
          items.push(`<div style="padding:6px 12px;background:${a.color}08;border:1px solid ${a.color}20;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${a.color};"></span>${a.name}</div>`);
        } else {
          items.push(`<div style="padding:6px 12px;background:rgba(0,0,0,0.03);border-radius:8px;font-size:12px;color:rgba(0,0,0,0.25);">${a.name} 미설정</div>`);
        }
      }
    } catch {}
  } else {
    items.push('<div style="padding:6px 12px;background:rgba(255,149,0,0.08);border-radius:8px;font-size:12px;color:#ff9500;">프로필을 선택하세요</div>');
  }

  // 3. 발행된 프로젝트 수
  try {
    const projs = await api('/api/projects?limit=100&offset=0&q=');
    const published = (projs.projects || []).filter(p => p.blog_uploaded_at || p.threads_uploaded_at || p.twitter_uploaded_at || p.youtube_uploaded_at);
    items.push(`<div style="padding:6px 12px;background:rgba(0,122,255,0.06);border-radius:8px;font-size:12px;color:#007aff;">발행된 콘텐츠: ${published.length}개</div>`);
  } catch {}

  panel.innerHTML = items.join('');
}

async function cmLoadSummary() {
  const el = document.getElementById('cm-summary');
  if (!el) return;
  try {
    const s = await api('/api/comments/summary');
    if (s.total === 0) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.25);font-size:13px;">수집된 댓글이 없습니다. 히스토리에서 프로젝트를 열고 "댓글 수집"을 누르세요.</div>';
      return;
    }
    const fColor = s.favorability >= 70 ? '#34c759' : s.favorability >= 40 ? '#ff9500' : '#ff3b30';
    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:80px;padding:14px;background:linear-gradient(135deg,${fColor}15,${fColor}08);border:1px solid ${fColor}30;border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:${fColor};">${s.favorability}%</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">호감도</div>
        </div>
        <div style="flex:1;min-width:80px;padding:14px;background:rgba(0,122,255,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#007aff;">${s.total}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">전체 댓글</div>
        </div>
        <div style="flex:1;min-width:80px;padding:14px;background:rgba(52,199,89,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#34c759;">${s.positive}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">긍정</div>
        </div>
        <div style="flex:1;min-width:80px;padding:14px;background:rgba(255,149,0,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:rgba(0,0,0,0.4);">${s.neutral}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">중립</div>
        </div>
        <div style="flex:1;min-width:80px;padding:14px;background:rgba(255,59,48,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#ff3b30;">${s.negative}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">부정</div>
        </div>
        ${s.malicious > 0 ? `<div style="flex:1;min-width:80px;padding:14px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.2);border-radius:12px;text-align:center;">
          <div style="font-size:28px;font-weight:800;color:#ff3b30;">${s.malicious}</div>
          <div style="font-size:10px;color:#ff3b30;font-weight:600;">악성</div>
        </div>` : ''}
      </div>
      ${Object.keys(s.platforms || {}).length > 0 ? `
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        ${Object.entries(s.platforms).map(([p,c]) => `<span style="padding:3px 10px;font-size:10px;background:rgba(0,0,0,0.04);border-radius:10px;color:rgba(0,0,0,0.5);">${p}: ${c}</span>`).join('')}
      </div>` : ''}`;

    // 사이드바 뱃지
    const badge = document.getElementById('comment-badge');
    if (badge && s.malicious > 0) {
      badge.style.display = 'block';
      badge.textContent = s.malicious;
    }
  } catch {}
}

async function cmLoadComments(platform) {
  // 필터 버튼 활성화
  document.querySelectorAll('.cm-filter').forEach(b => {
    b.style.background = 'rgba(0,0,0,0.06)';
    b.style.color = 'rgba(0,0,0,0.5)';
  });
  event?.target && (event.target.style.background = '#ff8c00', event.target.style.color = '#fff');

  const el = document.getElementById('cm-comments-list');
  if (!el) return;
  try {
    const res = await api(`/api/comments/recent?limit=50&platform=${platform}`);
    const comments = res.comments || [];
    if (comments.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.25);font-size:12px;">댓글이 없습니다</div>';
      return;
    }
    el.innerHTML = comments.map(c => {
      const sColor = c.sentiment === 'positive' ? '#34c759' : c.sentiment === 'negative' ? '#ff3b30' : 'rgba(0,0,0,0.15)';
      const pColor = {naver:'#03c75a',threads:'#1c1c1e',twitter:'#1da1f2',youtube:'#ff0000',instagram:'#e1306c'}[c.platform] || '#999';
      return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);align-items:flex-start;">
        <div style="width:8px;height:8px;border-radius:50%;background:${sColor};flex-shrink:0;margin-top:5px;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;">
            <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${pColor}15;color:${pColor};font-weight:600;">${c.platform}</span>
            <span style="font-size:11px;font-weight:600;color:#1c1c1e;">${escapeHtml(c.author || '익명').substring(0,15)}</span>
            ${c.is_malicious ? '<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#ff3b30;color:#fff;font-weight:600;">악성</span>' : ''}
            ${c.sentiment_score > 0 ? `<span style="font-size:9px;color:${sColor};">${Math.round(c.sentiment_score*100)}%</span>` : ''}
          </div>
          <div style="font-size:12px;color:#1c1c1e;line-height:1.5;">${escapeHtml(c.content).substring(0,200)}</div>
          <div style="font-size:9px;color:rgba(0,0,0,0.25);margin-top:2px;">${c.collected_at || ''}</div>
        </div>
      </div>`;
    }).join('');
  } catch {}
}

async function cmLoadMalicious() {
  const el = document.getElementById('cm-malicious-list');
  if (!el) return;
  try {
    const res = await api('/api/comments/malicious?limit=20');
    const comments = res.comments || [];
    if (comments.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.25);font-size:12px;">감지된 악성 댓글이 없습니다</div>';
      return;
    }
    el.innerHTML = comments.map(c => `
      <div style="padding:10px;margin-bottom:6px;background:rgba(255,59,48,0.04);border:1px solid rgba(255,59,48,0.1);border-radius:8px;">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
          <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(255,59,48,0.1);color:#ff3b30;font-weight:600;">${c.platform}</span>
          <span style="font-size:11px;font-weight:600;color:#1c1c1e;">${escapeHtml(c.author || '').substring(0,15)}</span>
          <span style="font-size:9px;color:rgba(0,0,0,0.25);margin-left:auto;">${c.collected_at || ''}</span>
        </div>
        <div style="font-size:12px;color:#ff3b30;line-height:1.5;">${escapeHtml(c.content).substring(0,200)}</div>
      </div>
    `).join('');
  } catch {}
}

async function cmCollectAll() {
  toast('전체 프로젝트 댓글 수집 중...');
  try {
    const projs = await api('/api/projects?limit=20&offset=0&q=');
    let total = 0;
    for (const p of (projs.projects || [])) {
      try {
        await projCollectComments(p.id);
        total++;
      } catch {}
    }
    toast(`${total}개 프로젝트 댓글 수집 완료`);
    cmLoadSummary();
    cmLoadComments('');
  } catch (e) { toast('수집 실패: ' + e.message, 'error'); }
}

async function cmAnalyzeAll() {
  toast('전체 댓글 감성 분석 중...');
  try {
    const res = await api('/api/comments/analyze', { method: 'POST', body: {} });
    toast(res.message || '분석 완료');
    cmLoadSummary();
    cmLoadComments('');
    cmLoadMalicious();
  } catch (e) { toast('분석 실패: ' + e.message, 'error'); }
}

// 댓글 페이지 진입 시 로드
const _cmObserver = new MutationObserver(() => {
  const page = document.getElementById('page-comments');
  if (page && page.classList.contains('active')) cmLoadPage();
});
if (document.getElementById('page-comments')) {
  _cmObserver.observe(document.getElementById('page-comments'), { attributes: true, attributeFilter: ['class'] });
}

async function projCollectComments(projId) {
  try {
    const res = await api(`/api/projects/${projId}`);
    const p = res.project;
    const urls = [];
    if (p.blog_url) urls.push({platform: 'naver', url: p.blog_url});
    if (p.threads_url) urls.push({platform: 'threads', url: p.threads_url});
    if (p.twitter_url) urls.push({platform: 'twitter', url: p.twitter_url});
    if (p.youtube_url) urls.push({platform: 'youtube', url: p.youtube_url});
    if (p.ig_url) urls.push({platform: 'instagram', url: p.ig_url});

    if (urls.length === 0) {
      toast('업로드된 URL이 없습니다. 먼저 콘텐츠를 발행하세요.', 'error');
      return;
    }

    toast(`${urls.length}개 플랫폼 댓글 수집 시작...`);
    let totalCollected = 0;
    for (const {platform, url} of urls) {
      try {
        const r = await api('/api/comments/collect', { method: 'POST', body: { platform, post_url: url, project_id: projId } });
        totalCollected += r.collected || 0;
      } catch (e) {
        console.log(`[Comments] ${platform} 수집 실패:`, e.message);
      }
    }
    toast(`댓글 ${totalCollected}개 수집 완료!`);
    projLoadCommentsSummary(projId);
  } catch (e) {
    toast('댓글 수집 실패: ' + e.message, 'error');
  }
}

async function projAnalyzeComments(projId) {
  try {
    toast('댓글 감성 분석 중...');
    const res = await api('/api/comments/analyze', { method: 'POST', body: { project_id: projId } });
    toast(res.message || '분석 완료');
    if (res.malicious > 0) {
      toast(`악성 댓글 ${res.malicious}개 감지!`, 'error');
    }
    projLoadCommentsSummary(projId);
  } catch (e) {
    toast('분석 실패: ' + e.message, 'error');
  }
}

async function projLoadCommentsSummary(projId) {
  const summaryEl = document.getElementById(`proj-comments-summary-${projId}`);
  const listEl = document.getElementById(`proj-comments-list-${projId}`);
  if (!summaryEl) return;
  try {
    const s = await api(`/api/comments/summary?project_id=${projId}`);
    if (s.total === 0) {
      summaryEl.innerHTML = '<div style="font-size:12px;color:rgba(0,0,0,0.3);">수집된 댓글이 없습니다</div>';
      return;
    }
    summaryEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="padding:8px 14px;background:rgba(0,122,255,0.06);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#007aff;">${s.total}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">전체</div>
        </div>
        <div style="padding:8px 14px;background:rgba(52,199,89,0.06);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#34c759;">${s.positive}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">긍정</div>
        </div>
        <div style="padding:8px 14px;background:rgba(255,59,48,0.06);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#ff3b30;">${s.negative}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">부정</div>
        </div>
        <div style="padding:8px 14px;background:rgba(0,0,0,0.03);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:rgba(0,0,0,0.5);">${s.neutral}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">중립</div>
        </div>
        ${s.malicious > 0 ? `<div style="padding:8px 14px;background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.2);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#ff3b30;">${s.malicious}</div>
          <div style="font-size:10px;color:#ff3b30;font-weight:600;">악성</div>
        </div>` : ''}
        <div style="padding:8px 14px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(52,199,89,0.08));border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:#ff8c00;">${s.favorability}%</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">호감도</div>
        </div>
      </div>`;

    // 최근 댓글 표시
    const comments = await api(`/api/comments/recent?limit=10&project_id=${projId}`).catch(() => ({comments:[]}));
    if (listEl && comments.comments?.length > 0) {
      listEl.innerHTML = comments.comments.map(c => {
        const color = c.sentiment === 'positive' ? '#34c759' : c.sentiment === 'negative' ? '#ff3b30' : 'rgba(0,0,0,0.3)';
        return `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:11px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;margin-top:5px;"></span>
          <span style="padding:1px 6px;border-radius:4px;background:${c.platform==='naver'?'rgba(3,199,90,0.1)':c.platform==='threads'?'rgba(0,0,0,0.04)':'rgba(0,122,255,0.06)'};font-size:9px;white-space:nowrap;">${c.platform}</span>
          <span style="color:rgba(0,0,0,0.5);white-space:nowrap;">${escapeHtml(c.author || '').substring(0,10)}</span>
          <span style="flex:1;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.content).substring(0,60)}</span>
          ${c.is_malicious ? '<span style="color:#ff3b30;font-size:9px;font-weight:600;">악성</span>' : ''}
        </div>`;
      }).join('');
    }
  } catch {}
}
