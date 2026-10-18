// ============================================================
// 브라우저 연결 상태
// ============================================================

// ── 비동기 작업 관리 ──
let _activeTasks = {};

async function startAsyncTask(apiUrl, body, onDone) {
  body.async = true;
  const res = await api(apiUrl, { method: 'POST', body });
  if (!res.task_id) {
    // 동기 응답 (async 미지원 API)
    if (onDone) onDone(res);
    return res;
  }
  const taskId = res.task_id;
  _activeTasks[taskId] = { url: apiUrl, onDone, startTime: Date.now() };
  toast('백그라운드 작업 시작됨 (다른 작업을 계속할 수 있습니다)');
  pollTask(taskId);
  renderRunningTasks();
  return { task_id: taskId, status: 'queued' };
}

async function pollTask(taskId) {
  const task = _activeTasks[taskId];
  if (!task) return;

  try {
    const status = await api('/api/tasks/' + taskId);
    if (status.status === 'done') {
      delete _activeTasks[taskId];
      toast('작업 완료!');
      if (task.onDone) task.onDone(status.result);
      renderRunningTasks();
      return;
    }
    if (status.status === 'error') {
      delete _activeTasks[taskId];
      toast('작업 실패: ' + (status.error || ''), 'error');
      renderRunningTasks();
      return;
    }
  } catch {}

  // 5초마다 폴링
  setTimeout(() => pollTask(taskId), 5000);
}

function renderRunningTasks() {
  const container = document.getElementById('running-tasks');
  const tasks = Object.entries(_activeTasks);
  if (tasks.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = tasks.map(([id, t]) => {
    const elapsed = Math.round((Date.now() - t.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span class="spinner" style="width:10px;height:10px;"></span>
      <span style="color:rgba(255,255,255,0.5);">${t.url.split('/').pop()}</span>
      <span style="color:rgba(255,255,255,0.3);margin-left:auto;">${mins}:${secs.toString().padStart(2,'0')}</span>
    </div>`;
  }).join('');
}

// 3초마다 진행 시간 업데이트 (실행 중 작업이 있을 때만)
setInterval(() => {
  if (!Object.keys(_activeTasks).length) return;
  renderRunningTasks();
}, 3000);

let _chromeConnecting = false;
window._connectedChromeProfileDir = '';

let _chromeProfilesCache = [{ dir: 'Default', name: '기본 프로필' }];
let _chromeDiagnosticsCache = null;
let _chromeDiagnosticsFetchedAt = 0;
let _browserStatusCache = null;
let _browserStatusFetchedAt = 0;
let _browserStatusRequest = null;
const CHROME_DIAG_CACHE_MS = 30000;
const BROWSER_STATUS_CACHE_MS = 5000;
const BROWSER_STATUS_ACTIVE_POLL_MS = 15000;

function ensureSidebarChromeStatusVisible() {
  const panel = document.getElementById('chrome-status');
  if (!panel) return;
  panel.style.display = 'none';
  panel.dataset.disabled = 'true';
}

function _formatChromeProfileOptionLabel(profile) {
  return '기본 프로필 (Default)';
}

function _populateChromeProfileSelect(selectId, profiles, preferredProfileDir = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="Default">기본 프로필 (Default)</option>';
  sel.value = 'Default';
  sel.dataset.preferredProfile = 'Default';
}

function renderChromeProfileSelectionMeta(profileDir = '', targetId = 'chrome-profile-label') {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.textContent = '';
  target.style.display = 'none';
}

async function libLoadChromeProfiles(preferredProfileDir = '', showToast = true) {
  _chromeProfilesCache = [{ dir: 'Default', name: '기본 프로필' }];
  _populateChromeProfileSelect('lib-plat-chrome-profile');
  _populateChromeProfileSelect('sidebar-chrome-profile-select');
  renderChromeProfileSelectionMeta('Default', 'lib-plat-chrome-profile-meta');
  renderChromeProfileSelectionMeta('Default', 'chrome-profile-label');
  if (showToast) toast('내부 브라우저 수집 설정을 사용합니다.');
}
function _getChromeProfileLabel(dir) {
  return '';
}

function getChromeProfileIdentity(profileDir = '') {
  return '';
}

window.getChromeProfileIdentity = getChromeProfileIdentity;

async function refreshSidebarChromeProfileQuickSelect(force = false) {
  ensureSidebarChromeStatusVisible();
  const sel = document.getElementById('sidebar-chrome-profile-select');
  if (!sel) return;
  sel.disabled = false;
  _populateChromeProfileSelect('sidebar-chrome-profile-select');
  renderChromeProfileSelectionMeta('Default', 'chrome-profile-label');
}

async function handleSidebarChromeProfileChange(nextProfileDir) {
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  if (!profileId) {
    renderChromeProfileSelectionMeta('Default', 'chrome-profile-label');
    return;
  }
  const chromeProfile = 'Default';
  try {
    const res = await api(`/api/library/profiles/${profileId}/chrome-profile`, {
      method: 'PUT',
      body: { chrome_profile: chromeProfile },
    });
    if (res?.profile) {
      window._globalProfileData = res.profile;
    } else {
      try {
        const refreshed = await api(`/api/library/profiles/${profileId}`);
        window._globalProfileData = refreshed;
      } catch {}
    }
    const modalSel = document.getElementById('lib-plat-chrome-profile');
    if (modalSel) {
      modalSel.value = chromeProfile;
      modalSel.dataset.preferredProfile = chromeProfile;
    }
    const sidebarSel = document.getElementById('sidebar-chrome-profile-select');
    if (sidebarSel) {
      sidebarSel.value = chromeProfile;
      sidebarSel.dataset.preferredProfile = chromeProfile;
    }
    renderChromeProfileSelectionMeta(chromeProfile, 'chrome-profile-label');
    renderChromeProfileSelectionMeta(chromeProfile, 'lib-plat-chrome-profile-meta');
    await checkBrowserStatus();
  } catch (e) {
    toast('Chrome 프로필 변경 실패: ' + e.message, 'error');
    await refreshSidebarChromeProfileQuickSelect(true);
  }
}
window.handleSidebarChromeProfileChange = handleSidebarChromeProfileChange;
window.refreshSidebarChromeProfileQuickSelect = refreshSidebarChromeProfileQuickSelect;
window.renderChromeProfileSelectionMeta = renderChromeProfileSelectionMeta;

function getPreferredChromeProfileDir(useModalSelection = false) {
  return 'Default';
}

function getPreferredChromeConnectionInfo(useModalSelection = false, forcedProfileDir = '') {
  const profileDir = 'Default';
  const chromeLabel = '';
  const selectedProfileName =
    window._globalProfileData?.name ||
    document.getElementById('global-profile-select')?.selectedOptions?.[0]?.textContent?.replace(/^🟢\s*/, '') ||
    '프로필 미선택';
  return { profileDir, profileName: selectedProfileName, chromeLabel };
}

async function loadChromeDiagnostics(force = false) {
  const now = Date.now();
  if (_chromeDiagnosticsCache && !force && (now - _chromeDiagnosticsFetchedAt) < CHROME_DIAG_CACHE_MS) {
    return _chromeDiagnosticsCache;
  }
  try {
    _chromeDiagnosticsCache = await api('/api/browser/chrome-diagnostics');
    _chromeDiagnosticsFetchedAt = now;
    return _chromeDiagnosticsCache;
  } catch {
    return null;
  }
}

async function loadBrowserStatus(force = false) {
  const now = Date.now();
  if (_browserStatusCache && !force && (now - _browserStatusFetchedAt) < BROWSER_STATUS_CACHE_MS) {
    return _browserStatusCache;
  }
  if (_browserStatusRequest && !force) {
    return _browserStatusRequest;
  }
  _browserStatusRequest = api('/api/browser/status');
  try {
    const status = await _browserStatusRequest;
    _browserStatusCache = status;
    _browserStatusFetchedAt = now;
    return status;
  } finally {
    _browserStatusRequest = null;
  }
}

function renderChromeDiagnosticsHint(diag) {
  const hint = document.getElementById('chrome-install-hint');
  if (!hint) return;
  if (!diag) {
    hint.style.display = 'none';
    hint.textContent = '';
    return;
  }
  if (!diag.installed) {
    hint.textContent = 'Chrome가 설치되어 있지 않습니다. 로그인과 Chrome 자동화 기능을 쓰려면 먼저 Chrome 설치가 필요합니다.';
    hint.style.display = 'block';
    return;
  }
  if (!diag.is_default_browser && diag.default_browser?.name) {
    hint.textContent = `기본 브라우저가 ${diag.default_browser.name}입니다. 로그인 창 문제를 줄이려면 Chrome 기본 브라우저 설정을 권장합니다.`;
    hint.style.display = 'block';
    return;
  }
  hint.style.display = 'none';
  hint.textContent = '';
}

function renderSidebarProfileGoogleMeta(googleMeta = '') {
  const typeEl = document.getElementById('global-profile-type');
  if (!typeEl) return;
  const profileMeta =
    window._globalProfileData?.business_type ||
    window._globalProfileData?.business_goal ||
    '프로필 선택됨';
  const safeProfileMeta = typeof escapeHtml === 'function' ? escapeHtml(profileMeta) : String(profileMeta || '');
  typeEl.innerHTML = `<div>${safeProfileMeta}</div>`;
}

window.renderSidebarProfileGoogleMeta = renderSidebarProfileGoogleMeta;

async function waitForChromeConnection(maxAttempts = 15, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const data = await loadBrowserStatus(true);
      if (data.connected) return data;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
}

async function copyChromeExtensionPath(knownExtPath = '') {
  let extPath = knownExtPath || '';
  if (!extPath) {
    try {
      const extStatus = await api('/api/browser/extension-status');
      extPath = extStatus.extension_path || '';
    } catch {}
  }
  if (!extPath) {
    toast('복사할 확장 프로그램 경로를 찾지 못했습니다.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(extPath);
    toast('경로 복사됨!', 'info', 1500);
  } catch {
    toast('경로 복사에 실패했습니다.', 'error');
  }
}

async function autoLaunchChromeForExtension() {
  const { profileDir } = getPreferredChromeConnectionInfo(false);
  return api('/api/browser/launch', {
    method: 'POST',
    body: {
      profile_dir: profileDir,
      profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
      relaunch_if_running: false,
    }
  });
}

async function installChromeExtension() {
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  const { profileDir } = getPreferredChromeConnectionInfo(true);
  if (!profileId) {
    toast('먼저 브랜드 프로필을 선택하세요', 'error');
    return;
  }
  await api('/api/browser/launch', {
    method: 'POST',
    body: {
      profile_dir: profileDir,
      profile_id: profileId,
      open_url: 'chrome://extensions',
      relaunch_if_running: false,
    }
  });
  toast('내부 브라우저 설정 화면을 열었습니다.', 'info', 12000);
}

async function connectChrome(forceReconnect = false, silent = false, forcedProfileDir = '') {
  // 🔌 자동 연결 끄기 토글 존중 — 수동이든 자동이든 모두 스킵
  try {
    if (window._chromeAutoConnectDisabled) {
      const s = document.getElementById('chrome-status-text');
      if (s) s.textContent = '자동 연결 OFF';
      if (!silent && typeof toast === 'function') {
        toast('자동 연결이 OFF 되어 있습니다. 사이드바의 체크박스를 해제 후 재시도하세요.', 'warning', 4000);
      }
      return;
    }
  } catch (_) {}
  const status = document.getElementById('chrome-status-text');
  const dot = document.getElementById('chrome-status-dot');
  const btn = document.getElementById('chrome-connect-btn');
  const { profileDir, profileName, chromeLabel } = getPreferredChromeConnectionInfo(!!forcedProfileDir, forcedProfileDir);
  const chromeDiag = await loadChromeDiagnostics();

  if (chromeDiag && !chromeDiag.installed) {
    if (dot) dot.style.background = '#ff3b30';
    if (status) status.textContent = 'Chrome 미설치';
    if (!silent) toast('Chrome이 설치되어 있지 않습니다. Chrome 설치 후 다시 연결해주세요.', 'error', 5000);
    btn.disabled = false;
    return;
  }

  if (!profileDir) {
    if (!silent) toast('프로필을 먼저 선택하고 Chrome 프로필을 연결하세요', 'error');
    btn.disabled = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = '연결 중...';

  try {
    const data = await loadBrowserStatus(forceReconnect);
    const needsReconnect = forceReconnect || (data.connected && window._connectedChromeProfileDir && window._connectedChromeProfileDir !== profileDir);
    if (data.connected && !needsReconnect) {
      if (dot) dot.style.background = '#30d158';
      if (status) status.textContent = '연결됨';
      btn.textContent = '프로필 연결';
      window._connectedChromeProfileDir = profileDir;
      if (!silent) _showChromeConnectedModal(chromeLabel, true);
    } else {
      if (status) status.textContent = '연결 중...';
      const launchRes = await api('/api/browser/launch', {
        method: 'POST',
        body: {
          profile_dir: profileDir,
          profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
          open_url: '',
          relaunch_if_running: true,
        }
      });
      // Windows에서 Chrome이 이미 실행 중 → 수동 설치 안내
      if (launchRes.needs_manual_extension) {
        if (dot) dot.style.background = '#ff9500';
        if (status) status.textContent = '수동 설치 필요';
        btn.textContent = '다시 연결';
        window._connectedChromeProfileDir = '';
        if (!silent) _showManualInstallGuide(launchRes.extension_path);
        _startExtensionConnectionPolling();
        btn.disabled = false;
        return;
      }
      const connected = await waitForChromeConnection(18, 1000);
      if (connected?.connected) {
        if (dot) dot.style.background = '#30d158';
        if (status) status.textContent = '연결됨';
        btn.textContent = '프로필 연결';
        window._connectedChromeProfileDir = profileDir;
        if (!silent) _showChromeConnectedModal(chromeLabel, true);
      } else {
        // 연결 실패 → 확장 프로그램 수동 설치 안내 (Chrome 146+ 대응)
        if (dot) dot.style.background = '#ff453a';
        if (status) status.textContent = '확장 설치 필요';
        btn.textContent = '다시 연결';
        window._connectedChromeProfileDir = '';
        if (!silent) _showManualInstallGuide(launchRes.extension_path);
        _startExtensionConnectionPolling();
      }
    }
  } catch {
    if (dot) dot.style.background = '#ff453a';
    if (status) status.textContent = '확인 실패';
    btn.textContent = '다시 연결';
    window._connectedChromeProfileDir = '';
    if (!silent) _showManualInstallGuide();
  }
  btn.disabled = false;
}

async function _showChromeConnectedModal(label, success) {
  let m = document.getElementById('chrome-conn-modal');
  if (m) m.remove();
  m = document.createElement('div');
  m.id = 'chrome-conn-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';

  // 실패 시 Windows 수동 설치 안내 확인
  let needsManual = false;
  let extPath = '';
  if (!success) {
    try {
      const extStatus = await api('/api/browser/extension-status');
      needsManual = extStatus.needs_manual_install;
      extPath = extStatus.extension_path || '';
    } catch {}
  }

  const color = success ? '#34c759' : '#ff3b30';
  const icon = success ? '✓' : '✕';
  const title = success ? '연결 성공' : (needsManual ? '확장 프로그램 설치 필요' : '연결 실패');
  let desc;
  if (success) {
    desc = `<b>${escapeHtml(label)}</b> 프로필이 연결되었습니다.`;
  } else if (needsManual) {
    desc = `<div style="text-align:left;background:#f8f8fa;border-radius:12px;padding:16px;font-size:12px;line-height:2;">
        <b>1.</b> 아래 <b style="color:#ff8c00;">모두 열기</b> 버튼 클릭<br>
        <b>2.</b> Chrome 우측 상단 <b>개발자 모드</b> 켜기<br>
        <b>3.</b> <b>압축해제된 확장 프로그램을 로드합니다</b> 클릭<br>
        <b>4.</b> 열린 폴더 선택<br>
        <code style="display:block;background:#e8e8ed;padding:8px;border-radius:6px;margin:4px 0;font-size:11px;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent);toast('경로 복사됨!','info',1500)">${escapeHtml(extPath)}</code>
      </div>
      <div style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.35);">한 번만 설치하면 이후 자동으로 연결됩니다.</div>`;
  } else {
    desc = `<b>${escapeHtml(label)}</b> 프로필 연결에 실패했습니다.<br>Chrome이 올바른 프로필로 열려있는지 확인하세요.`;
  }

  m.innerHTML = `<div style="background:#fff;border-radius:22px;padding:32px;width:92%;max-width:${needsManual ? '440' : '380'}px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
    <img src="/static/logo-icon.png" alt="makeke" style="width:56px;height:56px;border-radius:14px;margin:0 auto 16px;display:block;" onerror="this.style.display='none'">
    <div style="font-size:18px;font-weight:700;color:#1c1c1e;margin-bottom:8px;">${title}</div>
    <div style="font-size:13px;color:rgba(0,0,0,0.5);line-height:1.6;margin-bottom:20px;">${desc}</div>
    <div style="display:flex;gap:8px;justify-content:center;">
      ${needsManual ? `<button onclick="api('/api/browser/install-extension');toast('Chrome 확장 프로그램 페이지와 폴더를 열고 있습니다...','info',3000)" style="padding:10px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">모두 열기</button>` : ''}
      ${needsManual ? `<button id="chrome-conn-copy-btn" style="padding:10px 24px;background:rgba(255,140,0,0.12);color:#ff8c00;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">복사</button>` : ''}
      <button onclick="document.getElementById('chrome-conn-modal').remove()" style="padding:10px 24px;background:${needsManual ? 'rgba(0,0,0,0.08)' : color};color:${needsManual ? '#1c1c1e' : '#fff'};border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">${needsManual ? '닫기' : '확인'}</button>
    </div>
  </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  if (needsManual) {
    document.getElementById('chrome-conn-copy-btn')?.addEventListener('click', () => copyChromeExtensionPath(extPath));
  }
  if (success) setTimeout(() => m?.remove(), 4000);
}

async function syncChromeConnectionForCurrentProfile() {
  const desiredProfileDir = getPreferredChromeProfileDir(false);
  await refreshSidebarChromeProfileQuickSelect(false);
  if (!window._globalProfileId) {
    checkBrowserStatus();
    return;
  }
  // 프로필 전환 시 Chrome 프로필 라벨 즉시 업데이트
  const profileLabel = document.getElementById('chrome-profile-label');
  if (profileLabel && desiredProfileDir) {
    const label = typeof _getChromeProfileLabel === 'function' ? _getChromeProfileLabel(desiredProfileDir) : desiredProfileDir;
    profileLabel.textContent = label;
    profileLabel.style.display = 'block';
  }
  try {
    const data = await loadBrowserStatus(true);
    const currentProfileDir = data.current_profile || window._connectedChromeProfileDir || '';
    const sameProfileConnected = data.connected && desiredProfileDir && currentProfileDir === desiredProfileDir;
    if (sameProfileConnected) {
      window._connectedChromeProfileDir = desiredProfileDir;
      checkBrowserStatus();
      return;
    }
    // 앱 로드/프로필 전환 시에는 무거운 Chrome 재실행을 자동으로 하지 않는다.
    // 실제 재연결은 사용자가 "자동 연결" 버튼을 눌렀을 때만 수행한다.
    window._connectedChromeProfileDir = data.connected ? currentProfileDir : '';
    checkBrowserStatus();
  } catch {
    checkBrowserStatus();
  }
}

async function checkBrowserStatus() {
  try {
    ensureSidebarChromeStatusVisible();
    const chromeDiag = await loadChromeDiagnostics();
    const data = await loadBrowserStatus();
    const dot = document.getElementById('browser-dot');
    const status = document.getElementById('browser-status');
    const chromeDot = document.getElementById('chrome-status-dot');
    const chromeText = document.getElementById('chrome-status-text');
    const { profileDir, profileName, chromeLabel } = getPreferredChromeConnectionInfo();
    const profileLabel = document.getElementById('chrome-profile-label');
    const currentProfileDir = data.current_profile || window._connectedChromeProfileDir || '';
    // Chrome 프로필 선택을 제거했으므로 연결된 Chrome은 모두 기본 프로필 연결로 표시한다.
    const sameProfileConnected = !!data.connected;
    const otherProfileConnected = false;
    renderChromeDiagnosticsHint(chromeDiag);
    // Extension 연결되어 있으면 설치 배너 숨기기
    if (data.connected) _hideExtensionSetupBanner();
    if (chromeDiag && !chromeDiag.installed) {
      if (chromeDot) chromeDot.style.background = '#ff3b30';
      if (chromeText) chromeText.textContent = 'Chrome 미설치';
      const connectBtn = document.getElementById('chrome-connect-btn');
      if (connectBtn) {
        connectBtn.textContent = 'Chrome 필요';
        connectBtn.onclick = () => window.open('https://www.google.com/chrome/', '_blank');
      }
      return;
    }
    if (!profileDir) {
      renderSidebarProfileGoogleMeta('');
      if (profileLabel) { profileLabel.textContent = '프로필을 먼저 선택하세요'; profileLabel.style.display = 'block'; }
      if (chromeDot) chromeDot.style.background = 'rgba(0,0,0,0.15)';
      if (chromeText) chromeText.textContent = 'Chrome 프로필 미설정';
      const connectBtn = document.getElementById('chrome-connect-btn');
      if (connectBtn) { connectBtn.textContent = '프로필 선택'; connectBtn.onclick = () => openProfilePickerModal(); }
      await refreshSidebarChromeProfileQuickSelect(false);
      return;
    }
    if (profileLabel) {
      profileLabel.textContent = chromeLabel;
      profileLabel.style.display = 'block';
    }
    renderSidebarProfileGoogleMeta('');
    // 버튼 onclick 복구 (프로필 미설정 시 변경되었을 수 있음)
    const connectBtn = document.getElementById('chrome-connect-btn');
    if (connectBtn) connectBtn.onclick = () => connectChrome(false);
    if (sameProfileConnected) {
      if (dot) dot.style.background = '#30d158';
      if (status) status.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#30d158;" id="browser-dot"></span> 크롬 연결됨`;
      if (chromeDot) chromeDot.style.background = '#30d158';
      if (chromeText) chromeText.textContent = '연결됨';
      if (connectBtn) connectBtn.textContent = '연결됨';
      _hideExtensionSetupBanner();
      window._connectedChromeProfileDir = profileDir;
    } else if (otherProfileConnected) {
      if (dot) dot.style.background = '#ff9500';
      if (status) status.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#ff9500;" id="browser-dot"></span> 다른 Chrome 프로필 연결됨`;
      if (chromeDot) chromeDot.style.background = '#ff9500';
      if (chromeText) chromeText.textContent = '다른 프로필 연결됨';
      if (connectBtn) connectBtn.textContent = '이 프로필로 연결';
      window._connectedChromeProfileDir = currentProfileDir;
    } else {
      if (dot) dot.style.background = '#ff453a';
      if (status) status.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#ff453a;" id="browser-dot"></span> 크롬 연결 대기`;
      if (chromeDot) chromeDot.style.background = '#ff453a';
      if (chromeText) chromeText.textContent = '연결 대기';
      const connectBtn = document.getElementById('chrome-connect-btn');
      if (connectBtn) connectBtn.textContent = '다시 연결';
      window._connectedChromeProfileDir = '';
    }
    if (typeof autoRenderBrowserStatus === 'function') autoRenderBrowserStatus(data);
  } catch (e) {}
}
// ── 확장프로그램 설정 가이드 배너 ──
let _extensionSetupPollTimer = null;

let _extensionBannerDismissed = false;
function _showExtensionSetupBanner() {
  if (_extensionBannerDismissed) return; // 세션 내 닫으면 다시 표시 안 함
  if (document.getElementById('ext-setup-banner')) return;
  // 이미 연결되어 있으면 배너 표시 안 함
  const dot = document.getElementById('chrome-status-dot');
  if (dot && dot.style.background === 'rgb(48, 209, 88)') return; // #30d158
  const banner = document.createElement('div');
  banner.id = 'ext-setup-banner';
  banner.style.cssText = 'padding:12px 16px;background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-bottom:1px solid rgba(255,140,0,0.2);display:flex;align-items:center;gap:10px;font-size:12px;color:#1c1c1e;animation:modalIn 0.35s ease both;';
  banner.innerHTML = `
    <img src="/static/logo-icon.png" alt="" style="width:32px;height:32px;border-radius:10px;flex-shrink:0;" onerror="this.style.display='none'">
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;">Chrome 확장 프로그램 설치 필요</div>
      <div style="color:rgba(0,0,0,0.5);font-size:11px;line-height:1.4;">설치 버튼을 눌러 Chrome에 연결하세요.</div>
    </div>
    <button id="ext-setup-auto-btn" style="flex-shrink:0;padding:8px 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">설치</button>
    <button onclick="_extensionBannerDismissed=true;document.getElementById('ext-setup-banner').remove()" style="flex-shrink:0;padding:4px;background:none;border:none;font-size:16px;cursor:pointer;color:rgba(0,0,0,0.3);">✕</button>
  `;
  // 사이드바 아래 또는 메인 콘텐츠 위에 삽입
  const sidebar = document.querySelector('.sidebar');
  const chromeStatus = document.getElementById('chrome-status');
  if (chromeStatus && chromeStatus.parentElement) {
    chromeStatus.parentElement.insertBefore(banner, chromeStatus.nextSibling);
  } else if (sidebar) {
    sidebar.prepend(banner);
  } else {
    document.body.prepend(banner);
  }
  document.getElementById('ext-setup-auto-btn').addEventListener('click', _onExtensionAutoSetup);
}

function _hideExtensionSetupBanner() {
  const banner = document.getElementById('ext-setup-banner');
  if (banner) {
    banner.style.transition = 'opacity 0.3s, max-height 0.3s';
    banner.style.opacity = '0';
    banner.style.maxHeight = '0';
    banner.style.overflow = 'hidden';
    setTimeout(() => banner.remove(), 350);
  }
  if (_extensionSetupPollTimer) {
    clearInterval(_extensionSetupPollTimer);
    _extensionSetupPollTimer = null;
  }
}

async function _onExtensionAutoSetup() {
  const btn = document.getElementById('ext-setup-auto-btn');
  if (btn) { btn.disabled = true; btn.textContent = '설정 중...'; }

  try {
    // 프로필이 없으면 Default 프로필로 시도
    let profileDir = getPreferredChromeProfileDir(false) || 'Default';
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;

    const launchRes = await api('/api/browser/launch', {
      method: 'POST',
      body: {
        profile_dir: profileDir,
        profile_id: profileId,
        open_url: '',
        relaunch_if_running: true,
      }
    });

    // Windows에서 Chrome이 이미 실행 중이라 --load-extension이 무시된 경우
    if (launchRes.needs_manual_extension) {
      if (btn) { btn.textContent = '자동 설정'; btn.disabled = false; }
      _showManualInstallGuide(launchRes.extension_path);
      _startExtensionConnectionPolling(); // 수동 설치 후 자동 감지
      return;
    }

    // 연결 대기 + 폴링 시작
    _startExtensionConnectionPolling();

    if (btn) { btn.textContent = '연결 대기 중...'; }

    const connected = await waitForChromeConnection(20, 1500);
    if (connected?.connected) {
      _hideExtensionSetupBanner();
      toast('Chrome 확장프로그램이 자동으로 연결되었습니다!', 'info', 4000);
      checkBrowserStatus();
    } else {
      // 자동 연결 실패 → 수동 설치 안내
      if (btn) { btn.textContent = '자동 설정'; btn.disabled = false; }
      _showManualInstallGuide();
    }
  } catch (e) {
    if (btn) { btn.textContent = '자동 설정'; btn.disabled = false; }
    toast('Chrome 실행에 실패했습니다. Chrome이 설치되어 있는지 확인하세요.', 'error');
  }
}

function _startExtensionConnectionPolling() {
  if (_extensionSetupPollTimer) clearInterval(_extensionSetupPollTimer);
  // 10초 간격, 최대 1분 → 부하 최소화
  _extensionSetupPollTimer = setInterval(async () => {
    try {
      const data = await api('/api/browser/status');
      if (data.connected) {
        _hideExtensionSetupBanner();
        checkBrowserStatus();
        toast('Chrome 확장프로그램 연결 완료!', 'info', 3000);
      }
    } catch {}
  }, 10000);
  setTimeout(() => {
    if (_extensionSetupPollTimer) {
      clearInterval(_extensionSetupPollTimer);
      _extensionSetupPollTimer = null;
    }
  }, 60000);
}

let _manualGuideShownThisSession = false;
async function _showManualInstallGuide(knownExtPath) {
  if (_manualGuideShownThisSession) return;
  _manualGuideShownThisSession = true;
  let extPath = knownExtPath || '';
  if (!extPath) {
    try {
      const extStatus = await api('/api/browser/extension-status');
      extPath = extStatus.extension_path || '';
    } catch {}
  }

  let m = document.getElementById('ext-manual-guide-modal');
  if (m) m.remove();
  m = document.createElement('div');
  m.id = 'ext-manual-guide-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';
  m.innerHTML = `<div style="background:#fff;border-radius:22px;padding:32px;width:92%;max-width:460px;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
    <img src="/static/logo-icon.png" alt="makeke" style="width:56px;height:56px;border-radius:14px;margin:0 auto 16px;display:block;" onerror="this.style.display='none'">
    <div style="font-size:18px;font-weight:700;color:#1c1c1e;margin-bottom:8px;">Chrome 확장 프로그램 설치</div>
    <div style="font-size:13px;color:rgba(0,0,0,0.5);line-height:1.6;margin-bottom:16px;">
      한 번만 설치하면 이후 자동으로 연결됩니다.
    </div>
    <div style="text-align:left;background:#f8f8fa;border-radius:12px;padding:16px;font-size:12px;line-height:2;">
      <b>1.</b> 아래 <b style="color:#ff8c00;">모두 열기</b> 버튼 클릭<br>
      <b>2.</b> Chrome 우측 상단 <b>개발자 모드</b> 켜기<br>
      <b>3.</b> <b>압축해제된 확장 프로그램을 로드합니다</b> 클릭<br>
      <b>4.</b> 탐색기/Finder에서 <b>chrome-extension</b> 폴더가 선택되어 보이면 그 폴더를 그대로 선택<br>
      <code style="display:block;background:#e8e8ed;padding:8px;border-radius:6px;margin:4px 0;font-size:11px;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent);toast('경로 복사됨!','info',1500)">${escapeHtml(extPath)}</code>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:20px;">
      <button onclick="api('/api/browser/install-extension');toast('Chrome 확장 페이지와 폴더 위치를 열고 있습니다...','info',3000)" style="padding:10px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">모두 열기</button>
      <button id="ext-manual-copy-btn" style="padding:10px 24px;background:rgba(255,140,0,0.12);color:#ff8c00;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">복사</button>
      <button onclick="document.getElementById('ext-manual-guide-modal').remove()" style="padding:10px 20px;background:rgba(0,0,0,0.08);color:#1c1c1e;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">닫기</button>
    </div>
  </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  document.getElementById('ext-manual-copy-btn')?.addEventListener('click', () => copyChromeExtensionPath(extPath));
  // 수동 설치 후에도 폴링 계속
  _startExtensionConnectionPolling();
}

// 전역 노출 — 에이전트에서 확장 설치 안내 호출용
window.showChromeExtensionGuide = function() {
  _manualGuideShownThisSession = false; // 다시 보여주기 허용
  _showManualInstallGuide();
};

// Chrome 연결은 제품 흐름에서 제거됐다. URL 수집은 Go/Colly 파이프라인만 사용한다.

// ============================================================
// 카드뉴스 프리셋
// ============================================================

const DEFAULT_PRESETS = {
  // ── 음식/외식 ──
  cafe: { name: '카페', topic: '카페 메뉴 추천', style: 'colorful', caption: '' },
  restaurant: { name: '맛집', topic: '맛집 추천 BEST', style: 'colorful', caption: '' },
  bakery: { name: '베이커리', topic: '신메뉴 빵 추천', style: 'cute', caption: '' },
  bar: { name: '바/주점', topic: '분위기 좋은 바 추천', style: 'dark', caption: '' },
  delivery: { name: '배달음식', topic: '배달 맛집 리뷰', style: 'colorful', caption: '' },
  korean: { name: '한식', topic: '한식 맛집 추천', style: 'colorful', caption: '' },
  japanese: { name: '일식', topic: '일식 맛집 추천', style: 'minimal', caption: '' },
  chinese: { name: '중식', topic: '중식 맛집 추천', style: 'colorful', caption: '' },
  western: { name: '양식', topic: '양식 레스토랑 추천', style: 'modern', caption: '' },
  chicken: { name: '치킨/피자', topic: '치킨 맛집 비교', style: 'colorful', caption: '' },
  dessert: { name: '디저트', topic: '디저트 맛집 추천', style: 'cute', caption: '' },
  brunch: { name: '브런치', topic: '브런치 카페 추천', style: 'minimal', caption: '' },
  vegan: { name: '비건/채식', topic: '비건 맛집 추천', style: 'natural', caption: '' },
  streetfood: { name: '분식/길거리', topic: '분식 맛집 추천', style: 'colorful', caption: '' },

  // ── 뷰티/패션 ──
  beauty: { name: '뷰티', topic: '뷰티 트렌드', style: 'minimal', caption: '' },
  skincare: { name: '스킨케어', topic: '피부 관리 루틴', style: 'minimal', caption: '' },
  nail: { name: '네일아트', topic: '이달의 네일 디자인', style: 'cute', caption: '' },
  hair: { name: '헤어샵', topic: '트렌드 헤어스타일', style: 'modern', caption: '' },
  fashion: { name: '패션', topic: '패션 트렌드 코디', style: 'minimal', caption: '' },
  luxury: { name: '명품', topic: '명품 트렌드', style: 'luxury', caption: '' },
  makeup: { name: '메이크업', topic: '메이크업 꿀팁', style: 'colorful', caption: '' },
  perfume: { name: '향수', topic: '향수 추천', style: 'luxury', caption: '' },
  mens: { name: '남성패션', topic: '남성 코디 추천', style: 'modern', caption: '' },
  shoes: { name: '신발/스니커즈', topic: '신발 트렌드', style: 'modern', caption: '' },
  accessory: { name: '액세서리', topic: '악세사리 추천', style: 'minimal', caption: '' },
  secondhand: { name: '중고/리셀', topic: '중고 거래 꿀팁', style: 'modern', caption: '' },

  // ── 건강/의료 ──
  fitness: { name: '피트니스', topic: '홈트레이닝 루틴', style: 'dark', caption: '' },
  yoga: { name: '요가/필라테스', topic: '요가 초보 가이드', style: 'minimal', caption: '' },
  hospital: { name: '병원/의원', topic: '건강검진 체크리스트', style: 'medical', caption: '' },
  dental: { name: '치과', topic: '치아 관리 꿀팁', style: 'medical', caption: '' },
  pharmacy: { name: '약국/건강식품', topic: '영양제 추천 가이드', style: 'modern', caption: '' },
  mental: { name: '심리/상담', topic: '마음 건강 체크리스트', style: 'minimal', caption: '' },
  diet: { name: '다이어트', topic: '다이어트 식단', style: 'modern', caption: '' },
  derma: { name: '피부과', topic: '피부과 시술 가이드', style: 'medical', caption: '' },
  ophth: { name: '안과', topic: '눈 건강 관리', style: 'medical', caption: '' },
  ortho: { name: '정형외과', topic: '관절 건강 관리', style: 'medical', caption: '' },
  korean_med: { name: '한의원', topic: '한방 건강 관리', style: 'natural', caption: '' },
  plastic: { name: '성형외과', topic: '성형 트렌드', style: 'modern', caption: '' },
  supplement: { name: '영양제', topic: '영양제 비교 분석', style: 'modern', caption: '' },

  // ── 교육 ──
  education: { name: '학원', topic: '학습 꿀팁', style: 'modern', caption: '' },
  english: { name: '영어/어학', topic: '영어 회화 표현', style: 'colorful', caption: '' },
  coding: { name: '코딩교육', topic: '코딩 입문 가이드', style: 'dark', caption: '' },
  kids: { name: '유아/키즈', topic: '아이 교육', style: 'cute', caption: '' },
  math: { name: '수학', topic: '수학 공부법', style: 'modern', caption: '' },
  exam: { name: '수능/입시', topic: '수능 준비 전략', style: 'modern', caption: '' },
  certificate: { name: '자격증', topic: '자격증 취득 가이드', style: 'corporate', caption: '' },
  piano: { name: '피아노/음악', topic: '피아노 학원 추천', style: 'minimal', caption: '' },
  art: { name: '미술/그림', topic: '미술 학원 추천', style: 'watercolor', caption: '' },
  dance: { name: '댄스', topic: '댄스 학원 추천', style: 'colorful', caption: '' },
  swimming: { name: '수영', topic: '수영 초보 가이드', style: 'modern', caption: '' },
  taekwondo: { name: '태권도/무도', topic: '태권도 학원 추천', style: 'modern', caption: '' },

  // ── 부동산/금융 ──
  realestate: { name: '부동산', topic: '부동산 시장 동향', style: 'modern', caption: '' },
  interior: { name: '인테리어', topic: '인테리어 트렌드', style: 'minimal', caption: '' },
  finance: { name: '재테크', topic: '재테크 가이드', style: 'corporate', caption: '' },
  insurance: { name: '보험', topic: '보험 가입 체크리스트', style: 'modern', caption: '' },
  stock: { name: '주식', topic: '주식 투자 입문', style: 'corporate', caption: '' },
  crypto: { name: '코인/암호화폐', topic: '암호화폐 트렌드', style: 'dark', caption: '' },
  loan: { name: '대출/금융', topic: '대출 비교 가이드', style: 'corporate', caption: '' },
  apartment: { name: '아파트', topic: '아파트 분양 정보', style: 'modern', caption: '' },
  officetel: { name: '오피스텔', topic: '오피스텔 투자', style: 'modern', caption: '' },
  jeonse: { name: '전세/월세', topic: '전세 계약 꿀팁', style: 'modern', caption: '' },

  // ── IT/테크 ──
  tech: { name: 'IT/테크', topic: 'IT 트렌드', style: 'dark', caption: '' },
  ai: { name: 'AI/인공지능', topic: 'AI 활용 꿀팁', style: 'dark', caption: '' },
  ecommerce: { name: '이커머스', topic: '온라인 쇼핑 트렌드', style: 'colorful', caption: '' },
  marketing: { name: '마케팅', topic: 'SNS 마케팅 전략', style: 'modern', caption: '' },
  smartphone: { name: '스마트폰', topic: '스마트폰 추천', style: 'modern', caption: '' },
  laptop: { name: '노트북/PC', topic: '노트북 추천', style: 'dark', caption: '' },
  gadget: { name: '가전/가젯', topic: '가전제품 추천', style: 'modern', caption: '' },
  app: { name: '앱/서비스', topic: '유용한 앱 추천', style: 'colorful', caption: '' },
  saas: { name: 'SaaS/솔루션', topic: 'SaaS 비교 분석', style: 'corporate', caption: '' },
  seo: { name: 'SEO/블로그', topic: '블로그 SEO 전략', style: 'modern', caption: '' },
  youtube: { name: '유튜브', topic: '유튜브 성장 전략', style: 'colorful', caption: '' },
  instagram: { name: '인스타그램', topic: '인스타 성장 전략', style: 'colorful', caption: '' },

  // ── 생활/서비스 ──
  travel: { name: '여행', topic: '여행지 추천', style: 'colorful', caption: '' },
  pet: { name: '반려동물', topic: '반려동물 케어', style: 'cute', caption: '' },
  car: { name: '자동차', topic: '자동차 관리 꿀팁', style: 'dark', caption: '' },
  wedding: { name: '웨딩', topic: '웨딩 준비', style: 'minimal', caption: '' },
  moving: { name: '이사/청소', topic: '이사 체크리스트', style: 'modern', caption: '' },
  photo: { name: '사진/영상', topic: '사진 잘 찍는 법', style: 'minimal', caption: '' },
  jeju: { name: '제주도', topic: '제주도 여행 코스', style: 'colorful', caption: '' },
  camping: { name: '캠핑', topic: '캠핑 장비 추천', style: 'natural', caption: '' },
  golf: { name: '골프', topic: '골프 초보 가이드', style: 'modern', caption: '' },
  fishing: { name: '낚시', topic: '낚시 포인트 추천', style: 'natural', caption: '' },
  garden: { name: '홈가드닝', topic: '식물 키우기', style: 'natural', caption: '' },
  cooking: { name: '요리/레시피', topic: '간단 레시피', style: 'colorful', caption: '' },
  cleaning: { name: '청소/수납', topic: '청소 꿀팁', style: 'minimal', caption: '' },
  laundry: { name: '세탁/관리', topic: '세탁 꿀팁', style: 'minimal', caption: '' },
  parenting: { name: '육아', topic: '육아 꿀팁', style: 'cute', caption: '' },
  pregnancy: { name: '임신/출산', topic: '출산 준비', style: 'cute', caption: '' },

  // ── 전문직/비즈니스 ──
  lawyer: { name: '법률/변호사', topic: '생활 법률 상식', style: 'corporate', caption: '' },
  tax: { name: '세무/회계', topic: '절세 꿀팁', style: 'corporate', caption: '' },
  startup: { name: '창업', topic: '창업 성공 전략', style: 'modern', caption: '' },
  hr: { name: '취업/이직', topic: '면접 합격 비법', style: 'corporate', caption: '' },
  freelance: { name: '프리랜서', topic: '프리랜서 가이드', style: 'minimal', caption: '' },
  patent: { name: '특허/지식재산', topic: '특허 출원 가이드', style: 'corporate', caption: '' },
  consulting: { name: '컨설팅', topic: '경영 컨설팅', style: 'corporate', caption: '' },
  franchise: { name: '프랜차이즈', topic: '프랜차이즈 창업', style: 'modern', caption: '' },
  export: { name: '무역/수출', topic: '수출 입문 가이드', style: 'corporate', caption: '' },
  sidejob: { name: '부업/N잡', topic: '부업 추천', style: 'modern', caption: '' },

  // ── 문화/엔터 ──
  music: { name: 'K-POP', topic: 'K-POP 트렌드', style: 'colorful', caption: '' },
  drama: { name: '드라마/영화', topic: '넷플릭스 추천', style: 'dark', caption: '' },
  book: { name: '독서/책', topic: '이달의 추천 도서', style: 'minimal', caption: '' },
  game: { name: '게임', topic: '인기 게임 추천', style: 'dark', caption: '' },
  webtoon: { name: '웹툰', topic: '웹툰 추천', style: 'colorful', caption: '' },
  concert: { name: '공연/전시', topic: '전시회 추천', style: 'modern', caption: '' },
  idol: { name: '아이돌', topic: '아이돌 소식', style: 'colorful', caption: '' },
  animation: { name: '애니메이션', topic: '애니 추천', style: 'cute', caption: '' },
  podcast: { name: '팟캐스트', topic: '팟캐스트 추천', style: 'modern', caption: '' },

  // ── 지역 ──
  gangnam: { name: '강남', topic: '강남 핫플 추천', style: 'modern', caption: '' },
  hongdae: { name: '홍대', topic: '홍대 맛집 추천', style: 'colorful', caption: '' },
  itaewon: { name: '이태원', topic: '이태원 핫플', style: 'modern', caption: '' },
  busan: { name: '부산', topic: '부산 여행 코스', style: 'colorful', caption: '' },
  daegu: { name: '대구', topic: '대구 맛집 추천', style: 'colorful', caption: '' },
  incheon: { name: '인천', topic: '인천 가볼만한 곳', style: 'colorful', caption: '' },
  gwangju: { name: '광주', topic: '광주 맛집 추천', style: 'colorful', caption: '' },
  daejeon: { name: '대전', topic: '대전 맛집 추천', style: 'colorful', caption: '' },
  suwon: { name: '수원', topic: '수원 가볼만한 곳', style: 'colorful', caption: '' },
  pangyo: { name: '판교/분당', topic: '판교 맛집 추천', style: 'modern', caption: '' },
};

function getPresets() {
  if (!window._cardnewsPresets) window._cardnewsPresets = { ...DEFAULT_PRESETS };
  return window._cardnewsPresets;
}

function savePresets(presets) {
  window._cardnewsPresets = presets;
}

function renderPresetButtons() {
  const presets = getPresets();
  const container = document.getElementById('cn-presets');

  // 카테고리별 그룹핑
  const categories = {
    '음식/외식': ['cafe','restaurant','bakery','bar','delivery','korean','japanese','chinese','western','chicken','dessert','brunch','vegan','streetfood'],
    '뷰티/패션': ['beauty','skincare','nail','hair','fashion','luxury','makeup','perfume','mens','shoes','accessory','secondhand'],
    '건강/의료': ['fitness','yoga','hospital','dental','pharmacy','mental','diet','derma','ophth','ortho','korean_med','plastic','supplement'],
    '교육': ['education','english','coding','kids','math','exam','certificate','piano','art','dance','swimming','taekwondo'],
    '부동산/금융': ['realestate','interior','finance','insurance','stock','crypto','loan','apartment','officetel','jeonse'],
    'IT/테크': ['tech','ai','ecommerce','marketing','smartphone','laptop','gadget','app','saas','seo','youtube','instagram'],
    '생활/서비스': ['travel','pet','car','wedding','moving','photo','jeju','camping','golf','fishing','garden','cooking','cleaning','laundry','parenting','pregnancy'],
    '전문직': ['lawyer','tax','startup','hr','freelance','patent','consulting','franchise','export','sidejob'],
    '문화/엔터': ['music','drama','book','game','webtoon','concert','idol','animation','podcast'],
    '지역': ['gangnam','hongdae','itaewon','busan','daegu','incheon','gwangju','daejeon','suwon','pangyo'],
  };

  let html = '';
  for (const [catName, keys] of Object.entries(categories)) {
    const btns = keys.filter(k => presets[k]).map(k =>
      `<button class="btn btn-secondary btn-sm" style="font-size:12px;padding:4px 10px;" onclick="applyPreset('${k}')">${presets[k].name}</button>`
    ).join('');
    if (!btns) continue;
    html += `<div style="margin-bottom:6px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.3);margin-right:6px;">${catName}</span>
      ${btns}
    </div>`;
  }

  // 카테고리에 안 속한 커스텀 프리셋
  const allCatKeys = Object.values(categories).flat();
  const custom = Object.entries(presets).filter(([k]) => !allCatKeys.includes(k));
  if (custom.length) {
    html += `<div style="margin-bottom:6px;">
      <span style="font-size:11px;color:rgba(255,255,255,0.3);margin-right:6px;">커스텀</span>
      ${custom.map(([k, p]) => `<button class="btn btn-secondary btn-sm" style="font-size:12px;padding:4px 10px;" onclick="applyPreset('${k}')">${p.name}</button>`).join('')}
    </div>`;
  }

  container.innerHTML = html;
}

function renderPresetEditor() {
  const presets = getPresets();
  const list = document.getElementById('preset-edit-list');
  list.innerHTML = Object.entries(presets).map(([key, p]) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:8px;background:#162231;border-radius:6px;">
      <input type="text" value="${p.name}" style="width:80px;font-size:12px;padding:4px 8px;" onchange="updatePreset('${key}','name',this.value)">
      <input type="text" value="${p.topic}" style="flex:1;font-size:12px;padding:4px 8px;" onchange="updatePreset('${key}','topic',this.value)">
      <select style="width:80px;font-size:12px;padding:4px 6px;" onchange="updatePreset('${key}','style',this.value)">
        <option value="modern" ${p.style==='modern'?'selected':''}>모던</option>
        <option value="colorful" ${p.style==='colorful'?'selected':''}>컬러풀</option>
        <option value="minimal" ${p.style==='minimal'?'selected':''}>미니멀</option>
        <option value="dark" ${p.style==='dark'?'selected':''}>다크</option>
        <option value="cute" ${p.style==='cute'?'selected':''}>귀여운</option>
      </select>
      <input type="text" value="${p.caption}" style="flex:1;font-size:12px;padding:4px 8px;" onchange="updatePreset('${key}','caption',this.value)">
      <button class="btn btn-danger btn-sm" style="padding:2px 8px;font-size:11px;" onclick="deletePreset('${key}')">X</button>
    </div>
  `).join('');
}

function togglePresetEditor() {
  const editor = document.getElementById('preset-editor');
  if (editor.style.display === 'none') {
    editor.style.display = 'block';
    renderPresetEditor();
  } else {
    editor.style.display = 'none';
  }
}

function updatePreset(key, field, value) {
  const presets = getPresets();
  if (presets[key]) { presets[key][field] = value; savePresets(presets); renderPresetButtons(); }
}

function deletePreset(key) {
  const presets = getPresets();
  delete presets[key];
  savePresets(presets);
  renderPresetButtons();
  renderPresetEditor();
  toast('프리셋 삭제됨');
}

function addPreset() {
  const name = document.getElementById('new-preset-name').value.trim();
  const topic = document.getElementById('new-preset-topic').value.trim();
  const style = document.getElementById('new-preset-style').value;
  const caption = document.getElementById('new-preset-caption').value.trim();
  if (!name) { toast('이름을 입력하세요', 'error'); return; }
  const key = name.replace(/[^a-zA-Z가-힣0-9]/g, '').toLowerCase() || 'custom_' + Date.now();
  const presets = getPresets();
  presets[key] = { name, topic: topic || name + ' 정보', style, caption: caption || '#' + name };
  savePresets(presets);
  renderPresetButtons();
  renderPresetEditor();
  document.getElementById('new-preset-name').value = '';
  document.getElementById('new-preset-topic').value = '';
  document.getElementById('new-preset-caption').value = '';
  toast(`"${name}" 프리셋 추가됨!`);
}

function applyPreset(key) {
  const presets = getPresets();
  const p = presets[key];
  if (!p) return;
  document.getElementById('cn-topic').value = p.topic;
  document.getElementById('cn-style').value = p.style;
  document.getElementById('cn-caption').value = p.caption;
  document.querySelectorAll('#cn-presets button').forEach(b => b.style.borderColor = '#1e3a52');
  event.target.style.borderColor = '#4fc08d';
  toast(`${p.name} 프리셋 적용!`);
}

renderPresetButtons();

// 원본 이미지 미리보기
document.getElementById('cn-ref-images')?.addEventListener('change', function() {
  const preview = document.getElementById('cn-ref-preview');
  preview.innerHTML = '';
  for (const file of this.files) {
    const url = URL.createObjectURL(file);
    preview.innerHTML += `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #1e3a52;">`;
  }
});

// ============================================================
// 카드뉴스 생성 & 인스타 업로드
// ============================================================

let lastCardNewsDir = '';
let cnSlidesData = [];  // 현재 편집 중인 슬라이드 데이터
let cnGeneratedImages = {};  // {slideNum: imageUrl}
let currentCardNewsId = null;  // DB 레코드 ID

function cnCurrentRatio() {
  if (window.MKK_CARDNEWS_RATIOS?.currentBrowser) return window.MKK_CARDNEWS_RATIOS.currentBrowser();
  return document.querySelector('input[name="cn-ratio"]:checked')?.value || '1:1';
}

function cnAspectCss(ratio) {
  if (window.MKK_CARDNEWS_RATIOS?.css) return window.MKK_CARDNEWS_RATIOS.css(ratio || cnCurrentRatio());
  if (ratio === '9:16') return '9 / 16';
  if (ratio === '16:9') return '16 / 9';
  if (ratio === '4:5') return '4 / 5';
  return '1 / 1';
}

// 슬라이드 텍스트 생성 (Step 1)
// 트렌드에서 주제 자동 선택
async function cnLoadTrendTopics() {
  const container = document.getElementById('cn-trend-topics');
  container.style.display = 'flex';
  container.innerHTML = '<span class="spinner"></span> 트렌드 로딩...';

  try {
    const data = await api('/api/trends/dashboard');
    const topics = [];

    // 실시간 트렌드 키워드
    if (data.realtime_trends) {
      data.realtime_trends.slice(0, 15).forEach(t => {
        topics.push(t.keyword || t);
      });
    }

    // 카테고리 뉴스 제목
    if (data.category_news) {
      Object.values(data.category_news).forEach(cat => {
        if (cat.news) {
          cat.news.slice(0, 3).forEach(n => {
            if (n.title) topics.push(n.title.substring(0, 40));
          });
        }
      });
    }

    if (topics.length === 0) {
      container.innerHTML = '<span style="font-size:12px;color:rgba(255,255,255,0.3);">트렌드 데이터가 없습니다.</span>';
      return;
    }

    container.innerHTML = topics.map(t =>
      `<button class="btn btn-sm" style="padding:4px 10px;font-size:11px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;"
        onclick="document.getElementById('cn-topic').value='${escapeHtml(t).replace(/'/g, "\\'")}';document.getElementById('cn-trend-topics').style.display='none';">${escapeHtml(t)}</button>`
    ).join('');
  } catch (e) {
    container.innerHTML = '<span style="font-size:12px;color:#ff453a;">트렌드 로딩 실패</span>';
  }
}

// URL에서 참고 내용 가져오기
async function cnFetchUrlReference() {
  const url = document.getElementById('cn-ref-url').value.trim();
  if (!url || !url.startsWith('http')) { toast('URL을 입력하세요', 'error'); return; }

  try {
    toast('URL에서 내용을 가져오는 중...');
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const res = await scrape(url, { minLength: 50, timeoutMs: 45000 });
    if (res.ok && res.text) {
      const textarea = document.getElementById('cn-reference');
      const existing = textarea.value.trim();
      textarea.value = (existing ? existing + '\n\n---\n\n' : '') + `[${res.title || url}]\n${res.text}`;
      document.getElementById('cn-ref-url').value = '';
      toast(`참고 내용 추가 (${res.text.length.toLocaleString()}자)`);

      // 주제가 비어있으면 제목으로 자동 채우기
      const topicInput = document.getElementById('cn-topic');
      if (!topicInput.value.trim() && res.title) {
        topicInput.value = res.title;
      }
    }
  } catch (e) {
    toast('가져오기 실패: ' + e.message, 'error');
  }
}

async function generateSlideTexts() {
  const topic = document.getElementById('cn-topic').value.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }

  const btn = document.getElementById('btn-generate-texts');
  const loading = document.getElementById('cn-texts-loading');
  btn.disabled = true;
  loading.style.display = 'block';

  try {
    const reference = document.getElementById('cn-reference').value.trim();
    const data = await api('/api/cardnews/texts', {
      method: 'POST',
      body: {
        topic,
        slide_count: parseInt(document.getElementById('cn-slides').value),
        style: document.getElementById('cn-style').value,
        reference: reference || undefined,
      },
    });

    cnSlidesData = data.slides;
    cnGeneratedImages = {};
    lastCardNewsDir = '';
    currentCardNewsId = data.cardnews_id || null;
    renderSlidesEditor();
    document.getElementById('cn-slides-editor-card').style.display = 'block';
    document.getElementById('cn-actions-card').style.display = 'none';
    toast(`${cnSlidesData.length}개 슬라이드 텍스트 생성 완료!`);
  } catch (e) {
    toast('텍스트 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

// 슬라이드 편집 UI 렌더링
function renderSlidesEditor() {
  const container = document.getElementById('cn-slides-editor');
  const aspectRatio = cnAspectCss(cnCurrentRatio());
  container.innerHTML = cnSlidesData.map((s, idx) => {
    const num = s.slide_number;
    const hasImage = !!cnGeneratedImages[num];
    const imageUrl = cnGeneratedImages[num] || '';
    return `
      <div id="slide-card-${num}" style="background:#0f1923;border:1px solid #1e3a52;border-radius:10px;padding:16px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:14px;font-weight:600;color:#4fc08d;">슬라이드 ${num}</span>
          <span id="slide-status-${num}" style="font-size:12px;color:${hasImage ? '#4fc08d' : '#6b7f8e'};">${hasImage ? '이미지 생성됨' : '이미지 미생성'}</span>
        </div>
        <div style="display:grid;grid-template-columns:${hasImage ? '1fr 200px' : '1fr'};gap:16px;">
          <div>
            <div class="form-group" style="margin-bottom:10px;">
              <label style="font-size:12px;">제목</label>
              <input type="text" id="slide-title-${num}" value="${escapeHtml(s.title)}" style="font-size:13px;padding:8px 12px;">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
              <label style="font-size:12px;">본문</label>
              <textarea id="slide-body-${num}" rows="2" style="font-size:13px;padding:8px 12px;">${escapeHtml(s.body)}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
              <label style="font-size:12px;">이미지 프롬프트</label>
              <textarea id="slide-prompt-${num}" rows="2" style="font-size:12px;padding:8px 12px;color:#8899aa;">${escapeHtml(s.visual_prompt || '')}</textarea>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" id="btn-gen-img-${num}" onclick="generateSingleImage(${num})" style="padding:6px 14px;font-size:12px;">
                ${hasImage ? '재생성' : '이미지 생성'}
              </button>
              <span id="slide-spinner-${num}" style="display:none;color:#6b7f8e;font-size:12px;align-items:center;gap:6px;">
                <span class="spinner"></span> 생성 중...
              </span>
            </div>
          </div>
          ${hasImage ? `
          <div style="display:flex;align-items:center;position:relative;">
            <img src="${encImg('/api/cardnews/image/'+imageUrl)}?t=${Date.now()}" style="width:100%;aspect-ratio:${aspectRatio};object-fit:cover;border-radius:8px;border:1px solid #1e3a52;">
            <button onclick="openImageEditor('${encImg('/api/cardnews/image/'+imageUrl)}',{context:'cardnews/${imageUrl.split('/')[0]}/${imageUrl.split('/').pop().replace('.png','')}',onSave:function(){cnRenderSlidesEditor();}})" style="position:absolute;bottom:8px;right:8px;padding:4px 10px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">편집</button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// HTML 이스케이프 헬퍼
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
// 이미지 경로 URL 인코딩 (한글/공백 처리)
function toggleProductImage(idx, imgKey) {
  const excluded = window._productExcludedImages || new Set();
  const wrap = document.getElementById('product-img-wrap-' + idx);
  const img = document.getElementById('product-img-' + idx);
  const btn = document.getElementById('product-img-btn-' + idx);
  if (!wrap || !img || !btn) return;

  if (excluded.has(imgKey)) {
    excluded.delete(imgKey);
    img.style.opacity = '1';
    img.style.border = '2px solid rgba(91,155,245,0.4)';
    btn.textContent = '제외';
    btn.style.background = 'rgba(255,69,58,0.85)';
  } else {
    excluded.add(imgKey);
    img.style.opacity = '0.3';
    img.style.border = '2px solid rgba(255,69,58,0.6)';
    btn.textContent = '복원';
    btn.style.background = 'rgba(91,155,245,0.85)';
  }
  window._productExcludedImages = excluded;
}

function encImg(path) {
  if (!path) return '';
  // 이미 인코딩된 경우 그대로
  if (path.includes('%')) return path;
  // /api/ 경로는 segments별로 인코딩
  if (path.startsWith('/api/')) {
    const parts = path.split('/');
    return parts.map((p, i) => i <= 2 ? p : encodeURIComponent(p)).join('/');
  }
  return encodeURI(path);
}

// 에디터에서 현재 슬라이드 데이터 읽기
function getSlideFromEditor(slideNum) {
  return {
    slide_number: slideNum,
    title: document.getElementById(`slide-title-${slideNum}`).value,
    body: document.getElementById(`slide-body-${slideNum}`).value,
    visual_prompt: document.getElementById(`slide-prompt-${slideNum}`).value,
  };
}

// 단일 슬라이드 이미지 생성 (Step 2)
async function generateSingleImage(slideNum) {
  const topic = document.getElementById('cn-topic').value.trim();
  const style = document.getElementById('cn-style').value;
  const ratio = document.querySelector('input[name="cn-ratio"]:checked').value;
  const slide = getSlideFromEditor(slideNum);

  const btn = document.getElementById(`btn-gen-img-${slideNum}`);
  const spinner = document.getElementById(`slide-spinner-${slideNum}`);
  const status = document.getElementById(`slide-status-${slideNum}`);

  btn.disabled = true;
  spinner.style.display = 'inline-flex';
  status.textContent = '생성 중...';
  status.style.color = '#f5a623';

  try {
    const cnBrandName = document.getElementById('cn-caption')?.value?.match(/#(\S+)/)?.[1] || '';
    const data = await api('/api/cardnews/generate-single', {
      method: 'POST',
      body: {
        slide,
        topic,
        style,
        aspect_ratio: ratio,
        project_dir: lastCardNewsDir,
        cardnews_id: currentCardNewsId,
        brand_name: cnBrandName,
      },
    });

    // 프로젝트 디렉토리 저장 (첫 번째 이미지 생성 시)
    if (!lastCardNewsDir) {
      lastCardNewsDir = data.project_dir;
    }

    cnGeneratedImages[slideNum] = data.image_url;

    // cnSlidesData도 업데이트
    const idx = cnSlidesData.findIndex(s => s.slide_number === slideNum);
    if (idx >= 0) {
      cnSlidesData[idx] = slide;
    }

    // UI 업데이트
    renderSlidesEditor();
    toast(`슬라이드 ${slideNum} 이미지 생성 완료!`);

    // 이미지가 하나라도 있으면 액션 카드 표시
    checkShowActionsCard();
  } catch (e) {
    status.textContent = '생성 실패';
    status.style.color = '#e05c5c';
    toast(`슬라이드 ${slideNum} 실패: ` + e.message, 'error');
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
  }
}

// 전체 이미지 생성 (순차 실행)
async function generateAllImages() {
  const btn = document.getElementById('btn-generate-all-images');
  btn.disabled = true;
  btn.textContent = '전체 생성 중...';

  let successCount = 0;
  for (const slide of cnSlidesData) {
    try {
      await generateSingleImage(slide.slide_number);
      successCount++;
    } catch (e) {
      // 개별 에러는 generateSingleImage에서 처리됨
    }
  }

  btn.disabled = false;
  btn.textContent = '전체 이미지 생성';
  toast(`전체 이미지 생성 완료! (${successCount}/${cnSlidesData.length}장)`);
}

// 이미지가 있으면 액션 카드 표시
function checkShowActionsCard() {
  const hasAnyImage = Object.keys(cnGeneratedImages).length > 0;
  document.getElementById('cn-actions-card').style.display = hasAnyImage ? 'block' : 'none';
}

function downloadAllCardNews() {
  if (lastCardNewsDir) {
    toast('output/cardnews 폴더에서 이미지를 확인하세요.');
  }
}

async function uploadToInstagram() {
  if (!lastCardNewsDir) { toast('먼저 카드뉴스를 생성하세요', 'error'); return; }

  // 인스타그램 ID 확인
  try {
    const config = await api('/api/config');
    const igId = config?.INSTAGRAM?.instagram_id || '';
    if (!igId) {
      toast('설정에서 인스타그램 ID를 먼저 입력해주세요!', 'error');
      return;
    }
  } catch {}

  const caption = document.getElementById('cn-caption').value || '';
  if (!confirm(`인스타그램에 업로드할까요?\n\n캡션: ${caption.substring(0, 100)}...`)) return;

  try {
    toast('인스타그램 업로드 시작...');
    const data = await api('/api/instagram/upload', {
      method: 'POST',
      body: { project_dir: lastCardNewsDir, caption },
    });
    if (data.result?.status === 'ok') {
      toast('인스타그램 업로드 완료!');
    } else {
      toast('업로드 결과: ' + (data.result?.message || '확인 필요'), 'error');
    }
  } catch (e) {
    toast('인스타 업로드 실패: ' + e.message, 'error');
  }
}

// ============================================================
// 카드뉴스 갤러리
// ============================================================

let galleryFilter = '';

function filterGallery(btn, status) {
  document.querySelectorAll('.gallery-filter').forEach(b => {
    b.classList.remove('active');
    b.style.background = '';
    b.style.color = '';
    b.className = b.className.replace('btn-primary', 'btn-secondary');
  });
  btn.classList.add('active');
  btn.style.background = '#4fc08d';
  btn.style.color = '#0f1923';
  galleryFilter = status;
  loadGallery();
}

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#6b7f8e;"><span class="spinner"></span> 불러오는 중...</div>';

  try {
    const url = galleryFilter ? `/api/cardnews/history?status=${galleryFilter}` : '/api/cardnews/history';
    const data = await api(url);
    const items = data.items || [];

    if (items.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = items.map(item => {
      const thumbUrl = item.thumbnail ? `${encImg('/api/cardnews/image/'+item.thumbnail)}?t=${Date.now()}` : '';
      const statusLabel = getCardNewsStatusLabel(item.status);
      const statusColor = getCardNewsStatusColor(item.status);
      const dateStr = item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '';
      const aspectRatio = cnAspectCss(item.aspect_ratio);
      const badges = [];
      if (item.instagram_uploaded) badges.push('<span style="color:#e05c5c;font-size:11px;">IG</span>');
      if (item.blog_published) badges.push('<span style="color:#5b9bf5;font-size:11px;">Blog</span>');

      return `
        <div class="card" style="padding:0;overflow:hidden;cursor:pointer;transition:transform 0.2s,border-color 0.2s;"
             onmouseenter="this.style.borderColor='#4fc08d';this.style.transform='translateY(-2px)'"
             onmouseleave="this.style.borderColor='#1e3a52';this.style.transform='none'"
             onclick="openGalleryDetail(${item.id})">
          <div style="aspect-ratio:${aspectRatio};background:#0f1923;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            ${thumbUrl
              ? `<img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox='0 0 24 24' fill='none' stroke='#1e3a52' stroke-width='1.5' style='width:40px;height:40px;'><rect x='2' y='2' width='20' height='20' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='22 15 16 10 5 21'/></svg></div>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="#1e3a52" stroke-width="1.5" style="width:40px;height:40px;"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="22 15 16 10 5 21"/></svg>`
            }
          </div>
          <div style="padding:14px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.topic)}</div>
            <div style="font-size:12px;color:#6b7f8e;margin-bottom:8px;">
              ${item.success_count}/${item.slide_count}장 | ${item.style} | ${item.aspect_ratio}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="badge" style="background:${statusColor}22;color:${statusColor};">${statusLabel}</span>
              <span style="font-size:11px;color:#6b7f8e;">${dateStr}</span>
            </div>
            ${badges.length ? `<div style="display:flex;gap:8px;margin-top:8px;">${badges.join('')}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:10px;" onclick="event.stopPropagation()">
              <button class="btn btn-sm btn-secondary" onclick="editCardNewsFromGallery(${item.id})" style="flex:1;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>편집</button>
              <button class="btn btn-sm btn-danger" onclick="deleteCardNews(${item.id})" style="padding:6px 10px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#e05c5c;">불러오기 실패: ${e.message}</div>`;
  }
}

function getCardNewsStatusLabel(status) {
  const map = {
    'draft': '초안',
    'texts_only': '텍스트 생성',
    'generating': '이미지 생성중',
    'completed': '완료',
    'instagram_uploaded': '인스타 업로드됨',
    'blog_published': '블로그 발행됨',
  };
  return map[status] || status;
}

function getCardNewsStatusColor(status) {
  const map = {
    'draft': '#6b7f8e',
    'texts_only': '#f5a623',
    'generating': '#5b9bf5',
    'completed': '#4fc08d',
    'instagram_uploaded': '#e05c5c',
    'blog_published': '#5b9bf5',
  };
  return map[status] || '#6b7f8e';
}

async function openGalleryDetail(id) {
  const modal = document.getElementById('gallery-detail-modal');
  const content = document.getElementById('gallery-detail-content');
  content.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner"></span> 불러오는 중...</div>';
  modal.classList.add('show');

  try {
    const data = await api(`/api/cardnews/history/${id}`);
    const item = data.item;
    const slides = item.slides || [];
    const statusLabel = getCardNewsStatusLabel(item.status);
    const statusColor = getCardNewsStatusColor(item.status);
    const dateStr = item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '';
    const aspectRatio = cnAspectCss(item.aspect_ratio);

    content.innerHTML = `
      <h2 style="margin-bottom:4px;">${escapeHtml(item.topic)}</h2>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
        <span class="badge" style="background:${statusColor}22;color:${statusColor};">${statusLabel}</span>
        <span style="font-size:12px;color:#6b7f8e;">${item.success_count}/${item.slide_count}장 | ${item.style} | ${item.aspect_ratio}</span>
        <span style="font-size:12px;color:#6b7f8e;">${dateStr}</span>
        ${item.instagram_uploaded ? '<span style="font-size:11px;color:#e05c5c;">Instagram 업로드됨</span>' : ''}
        ${item.blog_published ? '<span style="font-size:11px;color:#5b9bf5;">블로그 발행됨</span>' : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
        ${slides.map(s => {
          const rawImgUrl = s.image_url || '';
          const imgUrl = rawImgUrl ? ('/api/cardnews/image/' + rawImgUrl.split('/').map(p => encodeURIComponent(p)).join('/') + '?t=' + Date.now()) : '';
          return `
            <div style="background:#0f1923;border:1px solid #1e3a52;border-radius:8px;overflow:hidden;">
              <div style="aspect-ratio:${aspectRatio};display:flex;align-items:center;justify-content:center;background:#0a1018;position:relative;">
                ${imgUrl
                  ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;" onclick="kcShowImagePreview(this.src)" onerror="this.outerHTML='<div style=\\'padding:20px;text-align:center;color:rgba(255,255,255,0.2);font-size:12px;\\'>이미지 없음</div>'">`
                  : '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.2);font-size:12px;">이미지 미생성</div>'
                }
                ${imgUrl ? `<button onclick="openImageEditor(this.previousElementSibling.src,{context:'cardnews',onSave:function(){openGalleryDetail(${item.id});}})" style="position:absolute;bottom:6px;right:6px;padding:3px 8px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">편집</button>` : ''}
              </div>
              <div style="padding:10px;">
                <div style="font-size:12px;font-weight:600;color:#4fc08d;margin-bottom:4px;">슬라이드 ${s.slide_number}</div>
                <div style="font-size:12px;font-weight:600;margin-bottom:2px;">${escapeHtml(s.title || '')}</div>
                <div style="font-size:11px;color:#6b7f8e;line-height:1.4;">${escapeHtml((s.body || '').substring(0, 80))}${(s.body || '').length > 80 ? '...' : ''}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;" data-project-dir="${escapeHtml(item.project_dir || '')}">
        <button class="btn btn-primary btn-sm" onclick="editCardNewsFromGallery(${item.id});closeGalleryDetail();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>편집하기</button>
        ${item.project_dir ? `<button class="btn btn-sm" style="background:rgba(10,132,255,0.15);color:#0a84ff;border:1px solid rgba(10,132,255,0.3);" onclick="toggleGalleryActions(${item.id},this.parentElement.dataset.projectDir)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>변환/발행</button>` : ''}
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.06);color:#f5f5f7;" onclick="markCardNewsCompleted(${item.id})">완료</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCardNews(${item.id});closeGalleryDetail();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
      </div>
      <div id="gallery-actions-panel" style="display:none;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;margin-bottom:12px;"></div>
    `;
  } catch (e) {
    content.innerHTML = `<div style="color:#e05c5c;padding:20px;">상세 정보 불러오기 실패: ${e.message}</div>`;
  }
}

function closeGalleryDetail() {
  document.getElementById('gallery-detail-modal').classList.remove('show');
}

async function deleteCardNews(id) {
  if (!confirm('이 카드뉴스를 삭제하시겠습니까? 관련 파일도 함께 삭제됩니다.')) return;
  try {
    await api(`/api/cardnews/history/${id}`, { method: 'DELETE' });
    toast('카드뉴스가 삭제되었습니다.');
    loadGallery();
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

async function markCardNewsCompleted(id) {
  try {
    await api(`/api/cardnews/history/${id}/status`, {
      method: 'PUT',
      body: { status: 'completed' },
    });
    toast('완료 처리되었습니다.');
    openGalleryDetail(id);
    loadGallery();
  } catch (e) {
    toast('상태 업데이트 실패: ' + e.message, 'error');
  }
}

function toggleGalleryActions(id, projectDir) {
  // 변환/발행 페이지로 이동하여 해당 카드뉴스 자동 선택
  closeGalleryDetail();
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const cvLink = document.querySelector('[data-page="convert"]');
  if (cvLink) cvLink.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-convert').classList.add('active');

  // 카드뉴스 탭으로 전환 + 해당 항목 선택
  setTimeout(async () => {
    await cvLoadSources();
    cvSwitchTab('cardnews');
    const sel = document.getElementById('cv-cn-id');
    for (const opt of sel.options) {
      if (opt.dataset.id == id || opt.value === projectDir) {
        sel.value = opt.value;
        break;
      }
    }
    await cvOnSelect();
  }, 500);
}

// 블로그에 이미지만으로 발행 (상세페이지 스타일)
async function publishGalleryToBlogAsImages(id, projectDir) {
  const blogId = getBlogId();
  if (!blogId) { toast('설정에서 네이버 블로그 ID를 먼저 입력하세요', 'error'); return; }

  try {
    const data = await api('/api/cardnews/history/' + id);
    const item = data.item;
    const images = (item.slides || [])
      .filter(s => s.image_url)
      .map(s => '/api/cardnews/image/' + s.image_url.split('/').map(p => encodeURIComponent(p)).join('/'));

    if (images.length === 0) { toast('발행할 이미지가 없습니다', 'error'); return; }

    if (!confirm(`네이버 블로그에 이미지 ${images.length}장으로 발행할까요?\n\n제목: ${item.topic}`)) return;

    await api('/api/blog/publish', {
      method: 'POST',
      body: { title: item.topic, content: ' ', tags: [], images },
    });
    toast(`블로그에 이미지 ${images.length}장으로 발행 완료!`);
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

function generateVideoFromGallery(id, projectDir) {
  // 변환/발행 페이지로 이동
  toggleGalleryActions(id, projectDir);
}

async function uploadGalleryToInsta(id, projectDir) {
  try {
    const config = await api('/api/config');
    if (!config?.INSTAGRAM?.instagram_id) {
      toast('설정에서 인스타그램 ID를 먼저 입력해주세요!', 'error');
      return;
    }
  } catch {}

  const caption = prompt('인스타그램 캡션을 입력하세요:', '#카드뉴스');
  if (caption === null) return;

  try {
    toast('인스타그램 업로드 시작...');
    await api('/api/instagram/upload', {
      method: 'POST',
      body: { project_dir: projectDir, caption },
    });
    toast('인스타그램 업로드 완료!');
  } catch (e) {
    toast('업로드 실패: ' + e.message, 'error');
  }
}

async function editCardNewsFromGallery(id) {
  try {
    const data = await api(`/api/cardnews/history/${id}`);
    const item = data.item;
    const slides = item.slides || [];

    // 카드뉴스 에디터로 데이터 로드
    currentCardNewsId = item.id;
    cnSlidesData = slides.map(s => ({
      slide_number: s.slide_number,
      title: s.title || '',
      body: s.body || '',
      visual_prompt: s.visual_prompt || '',
    }));
    cnGeneratedImages = {};
    slides.forEach(s => {
      if (s.image_url) {
        cnGeneratedImages[s.slide_number] = s.image_url;
      }
    });
    lastCardNewsDir = item.project_dir || '';

    // 입력 필드 설정
    document.getElementById('cn-topic').value = item.topic;
    if (document.getElementById('cn-style')) {
      document.getElementById('cn-style').value = item.style || 'modern';
    }
    if (document.getElementById('cn-slides')) {
      document.getElementById('cn-slides').value = item.slide_count || 5;
    }
    // 비율 라디오 설정
    const ratioRadio = document.querySelector(`input[name="cn-ratio"][value="${item.aspect_ratio || '1:1'}"]`);
    if (ratioRadio) ratioRadio.checked = true;

    // 에디터 표시
    renderSlidesEditor();
    document.getElementById('cn-slides-editor-card').style.display = 'block';
    checkShowActionsCard();

    // 카드뉴스 페이지로 전환
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('[data-page="cardnews"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-cardnews').classList.add('active');

    toast('카드뉴스를 에디터에 로드했습니다.');
  } catch (e) {
    toast('로드 실패: ' + e.message, 'error');
  }
}

async function uploadGalleryToInstagram(id) {
  try {
    const data = await api(`/api/cardnews/history/${id}`);
    const item = data.item;
    if (!item.project_dir) { toast('프로젝트 디렉토리가 없습니다.', 'error'); return; }

    const caption = prompt('인스타그램 캡션을 입력하세요:', `${item.topic}\n\n#카드뉴스 #${item.topic.replace(/\s+/g, '')}`);
    if (caption === null) return;

    toast('인스타그램 업로드 시작...');
    await api('/api/instagram/upload', {
      method: 'POST',
      body: { project_dir: item.project_dir, caption },
    });
    // 상태 업데이트
    await api(`/api/cardnews/history/${id}/status`, {
      method: 'PUT',
      body: { instagram_uploaded: 1 },
    });
    toast('인스타그램 업로드 완료!');
    loadGallery();
  } catch (e) {
    toast('인스타 업로드 실패: ' + e.message, 'error');
  }
}

async function publishGalleryToBlog(id) {
  try {
    const data = await api(`/api/cardnews/history/${id}`);
    const item = data.item;
    if (!item.project_dir) { toast('프로젝트 디렉토리가 없습니다.', 'error'); return; }

    if (!confirm(`"${item.topic}" 카드뉴스를 블로그에 발행하시겠습니까?`)) return;

    toast('블로그 발행 시작...');
    // 카드뉴스 파이프라인의 블로그 발행 로직 활용
    await api('/api/pipeline/cardnews', {
      method: 'POST',
      body: {
        topic: item.topic,
        slide_count: item.slide_count,
        style: item.style,
        aspect_ratio: item.aspect_ratio,
        auto_publish_blog: true,
        auto_generate_video: false,
        auto_upload_instagram: false,
        auto_upload_reels: false,
      },
    });
    // 상태 업데이트
    await api(`/api/cardnews/history/${id}/status`, {
      method: 'PUT',
      body: { blog_published: 1 },
    });
    toast('블로그 발행 완료!');
    loadGallery();
  } catch (e) {
    toast('블로그 발행 실패: ' + e.message, 'error');
  }
}
