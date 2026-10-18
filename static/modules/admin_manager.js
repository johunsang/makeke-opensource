window._saState = {
  category: 'videos',
  table: '',
  selectedFiles: new Set(),
  selectedDbRows: new Set(),
  dbTables: [],
  dbRows: [],
  dbColumns: [],
  dbPrimaryKey: '',
  filePage: 0,
  filePageSize: 24,
  dbPage: 0,
  dbPageSize: 50,
  settingsTab: 'general',
  unifiedMounted: false,
  backendStatusTimer: null,
};

function mountUnifiedSettingsSections() {
  if (window._saState.unifiedMounted) return;
  const settingsPage = document.getElementById('page-settings');
  const filePage = document.getElementById('page-file-admin');
  const dbPage = document.getElementById('page-db-admin');
  const generalSection = document.getElementById('settings-general-section');
  const filesSection = document.getElementById('settings-files-section');
  const dbSection = document.getElementById('settings-db-section');
  if (!settingsPage || !filePage || !dbPage || !generalSection || !filesSection || !dbSection) return;

  const keepIds = new Set(['settings-unified-shell', 'settings-general-section', 'settings-files-section', 'settings-db-section']);
  Array.from(settingsPage.children)
    .filter(node => !node.classList.contains('page-header') && !keepIds.has(node.id))
    .forEach(node => generalSection.appendChild(node));

  Array.from(filePage.children)
    .filter(node => !node.classList.contains('page-header'))
    .forEach(node => filesSection.appendChild(node));

  Array.from(dbPage.children)
    .filter(node => !node.classList.contains('page-header'))
    .forEach(node => dbSection.appendChild(node));

  filePage.style.display = 'none';
  dbPage.style.display = 'none';
  window._saState.unifiedMounted = true;
}

async function switchUnifiedSettingsTab(tab = 'general') {
  mountUnifiedSettingsSections();
  window._saState.settingsTab = tab;
  const tabs = {
    general: document.getElementById('settings-general-section'),
    files: document.getElementById('settings-files-section'),
    db: document.getElementById('settings-db-section'),
  };
  Object.entries(tabs).forEach(([key, section]) => {
    if (!section) return;
    section.style.display = key === tab ? 'flex' : 'none';
  });
  document.querySelectorAll('[data-settings-tab]').forEach(btn => {
    const active = btn.dataset.settingsTab === tab;
    btn.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.04)';
    btn.style.color = active ? '#fff' : '#1c1c1e';
    btn.style.boxShadow = active ? '0 10px 24px rgba(255,140,0,0.16)' : 'none';
  });
  if (tab === 'general') startBackendStatusPolling();
  else stopBackendStatusPolling();
  if (tab === 'files') await saLoadFileSummary();
  if (tab === 'db') await saLoadDbTables();
}

function stopBackendStatusPolling() {
  if (window._saState.backendStatusTimer) {
    clearInterval(window._saState.backendStatusTimer);
    window._saState.backendStatusTimer = null;
  }
}

function updateBackendStatusUi(status = {}) {
  const badge = document.getElementById('backend-server-status-badge');
  const text = document.getElementById('backend-server-status-text');
  const meta = document.getElementById('backend-server-status-meta');
  if (!badge || !text || !meta) return;

  let label = '확인 불가';
  let badgeBg = 'rgba(255,59,48,0.12)';
  let badgeColor = '#ff3b30';
  let desc = 'Electron 서버 관리 기능을 사용할 수 없습니다.';

  if (status.restarting) {
    label = '재시작 중';
    badgeBg = 'rgba(255,149,0,0.12)';
    badgeColor = '#ff9500';
    desc = '백엔드 서버를 다시 시작하는 중입니다.';
  } else if (status.reachable) {
    label = '정상 실행 중';
    badgeBg = 'rgba(52,199,89,0.12)';
    badgeColor = '#34c759';
    desc = '백엔드 서버가 정상 응답 중입니다.';
  } else if (status.ok) {
    label = '응답 없음';
    badgeBg = 'rgba(255,59,48,0.12)';
    badgeColor = '#ff3b30';
    desc = '서버 응답이 없습니다. 아래 버튼으로 다시 시작할 수 있습니다.';
  }

  badge.textContent = label;
  badge.style.background = badgeBg;
  badge.style.color = badgeColor;
  text.textContent = desc;
  const parts = [`포트 ${status.port || 8818}`];
  if (status.pid) parts.push(`PID ${status.pid}`);
  if (status.managed) parts.push('앱이 관리 중');
  meta.textContent = parts.join(' · ');
}

function updateExtensionInstallUi(status = {}) {
  const badge = document.getElementById('settings-extension-install-badge');
  const meta = document.getElementById('settings-extension-install-meta');
  const pathEl = document.getElementById('settings-extension-install-path');
  const hintEl = document.getElementById('settings-extension-install-hint');
  if (!badge || !meta || !pathEl) return;

  const connected = !!status.connected;
  const needsManual = !!status.needs_manual_install;
  badge.textContent = connected ? '연결됨' : (needsManual ? '수동 설치 가능' : '확인 필요');
  badge.style.background = connected ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.08)';
  badge.style.color = connected ? '#34c759' : '#007aff';
  const versionMeta = status.version ? `번들 v${status.version}` : '버전 확인 불가';
  meta.textContent = connected
    ? '현재 확장 프로그램이 연결되어 있습니다. 재설치가 필요하면 아래 경로를 그대로 열면 됩니다.'
    : '재설치가 필요할 때 아래 경로를 열고 Chrome 확장 페이지에서 압축해제된 확장 프로그램으로 다시 불러오면 됩니다.';
  meta.textContent += ` · ${versionMeta}`;
  pathEl.textContent = status.extension_path || '-';
  const platform = status.platform || '';
  if (hintEl) {
    if (platform === 'win32') {
      hintEl.textContent = 'Windows에서는 폴더 위치 보기를 누르면 탐색기에서 chrome-extension 폴더가 선택된 상태로 열립니다.';
    } else if (platform === 'darwin') {
      hintEl.textContent = 'macOS에서는 폴더 위치 보기를 누르면 Finder에서 chrome-extension 폴더가 바로 선택됩니다.';
    } else {
      hintEl.textContent = '경로를 클릭하면 복사됩니다.';
    }
  }
}

async function copyExtensionInstallPathFromSettings() {
  const pathEl = document.getElementById('settings-extension-install-path');
  const path = (pathEl?.textContent || '').trim();
  if (!path || path === '-' || path === '불러오는 중...') {
    toast('복사할 경로가 아직 없습니다.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(path);
    toast('확장 폴더 경로를 복사했습니다');
  } catch (e) {
    toast('경로 복사 실패: ' + e.message, 'error');
  }
}

async function refreshExtensionInstallStatus() {
  try {
    const status = await api('/api/browser/extension-status');
    updateExtensionInstallUi(status || {});
  } catch (e) {
    updateExtensionInstallUi({});
    const meta = document.getElementById('settings-extension-install-meta');
    const pathEl = document.getElementById('settings-extension-install-path');
    if (meta) meta.textContent = e.message || '확장 프로그램 경로를 불러오지 못했습니다.';
    if (pathEl) pathEl.textContent = '-';
  }
}

async function openExtensionFolderFromSettings() {
  try {
    const res = await api('/api/browser/open-extension-folder');
    toast('확장 폴더 위치를 열었습니다');
    const pathEl = document.getElementById('settings-extension-install-path');
    if (pathEl && res?.path) pathEl.textContent = res.path;
  } catch (e) {
    toast('확장 폴더 열기 실패: ' + e.message, 'error');
  }
}

async function openChromeExtensionsFromSettings() {
  try {
    await api('/api/browser/open-chrome-extensions');
    toast('Chrome 확장 프로그램 페이지를 열었습니다');
  } catch (e) {
    toast('확장 페이지 열기 실패: ' + e.message, 'error');
  }
}

async function openExtensionInstallBundleFromSettings() {
  try {
    const res = await api('/api/browser/install-extension');
    toast('Chrome 확장 프로그램 페이지와 폴더를 열었습니다');
    const pathEl = document.getElementById('settings-extension-install-path');
    if (pathEl && res?.extension_path) pathEl.textContent = res.extension_path;
  } catch (e) {
    toast('설치 안내 열기 실패: ' + e.message, 'error');
  }
}

async function resetExtensionBundleFromSettings() {
  try {
    const res = await api('/api/browser/reset-extension', { method: 'POST' });
    toast('기존 관리 확장을 지우고 새 버전으로 다시 만들었습니다');
    updateExtensionInstallUi(res || {});
  } catch (e) {
    toast('확장 초기화 실패: ' + e.message, 'error');
  }
}

async function refreshBackendServerStatus() {
  if (!window.electronAPI?.backendStatus) {
    updateBackendStatusUi({ ok: false });
    return;
  }
  try {
    const status = await window.electronAPI.backendStatus();
    updateBackendStatusUi(status || {});
  } catch (e) {
    updateBackendStatusUi({ ok: false, reachable: false });
  }
}

function supportStatusMeta(status) {
  const map = {
    open: ['접수', '#007aff'],
    in_progress: ['처리중', '#ff9500'],
    on_hold: ['보류', '#8e8e93'],
    resolved: ['완료', '#34c759'],
  };
  return map[status] || ['접수', '#007aff'];
}

function renderSupportFixJobs(jobs = []) {
  const root = document.getElementById('support-fix-jobs');
  if (!root) return;
  if (!jobs.length) {
    root.innerHTML = '<div style="padding:12px 14px;border:1px dashed rgba(0,0,0,0.08);border-radius:12px;font-size:12px;color:rgba(0,0,0,0.36);">자동 생성된 개발 요청이 아직 없습니다.</div>';
    return;
  }
  root.innerHTML = jobs.map(job => `
    <div style="padding:12px 14px;border-radius:14px;background:rgba(255,149,0,0.06);border:1px solid rgba(255,149,0,0.12);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
        <span style="padding:3px 8px;border-radius:999px;background:rgba(255,149,0,0.14);color:#ff9500;font-size:10px;font-weight:700;">${job.job_type === 'feature' ? '기능 개발 큐' : '버그 수정 큐'}</span>
        <span style="font-size:12px;font-weight:700;color:#1c1c1e;">티켓 #${Number(job.ticket_id || 0)}</span>
        <span style="font-size:11px;color:rgba(0,0,0,0.36);">${saFormatDate(job.updated_at)}</span>
      </div>
      <div style="font-size:12px;color:#1c1c1e;font-weight:700;margin-bottom:4px;">${escapeHtml(job.issue_summary || '문제 요약 없음')}</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.58);white-space:pre-wrap;line-height:1.6;">${escapeHtml(job.fix_task || '')}</div>
    </div>
  `).join('');
}

function renderAdminSupportTickets(tickets = []) {
  const root = document.getElementById('admin-support-tickets-list');
  if (!root) return;
  if (!tickets.length) {
    root.innerHTML = '<div style="padding:16px;border:1px dashed rgba(0,0,0,0.08);border-radius:14px;font-size:12px;color:rgba(0,0,0,0.36);">조건에 맞는 문의가 없습니다.</div>';
    return;
  }
  root.innerHTML = tickets.map(ticket => {
    const ticketKey = String(ticket.id || '');
    const ticketArg = saQuoteJs(ticketKey);
    const [statusLabel, statusColor] = supportStatusMeta(ticket.status || 'open');
    const latestReply = (ticket.replies || []).slice(-1)[0];
    const latestReplyText = latestReply?.content || '';
    const attachments = Array.isArray(ticket.attachments) && ticket.attachments.length
      ? ticket.attachments
      : (ticket.screenshot ? [{ url: ticket.screenshot, filename: 'legacy_screenshot' }] : []);
    return `
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:16px;background:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <span style="padding:3px 8px;border-radius:999px;background:${statusColor}18;color:${statusColor};font-size:10px;font-weight:700;">${statusLabel}</span>
              <span style="font-size:11px;color:rgba(0,0,0,0.38);">#${escapeHtml(ticketKey)}</span>
              <span style="font-size:11px;color:rgba(0,0,0,0.38);">${escapeHtml(ticket.category || 'other')}</span>
              <span style="font-size:11px;color:rgba(0,0,0,0.38);">${saFormatDate(ticket.updated_at || ticket.created_at)}</span>
            </div>
            <div id="support-title-${ticketKey}" style="font-size:14px;font-weight:800;color:#1c1c1e;margin-bottom:4px;">${escapeHtml(ticket.title || '(제목 없음)')}</div>
            <div id="support-user-${ticketKey}" style="font-size:12px;color:rgba(0,0,0,0.52);margin-bottom:8px;">${escapeHtml(ticket.user_name || ticket.user_email || '-')} · ${escapeHtml(ticket.user_email || '-')}</div>
            <div id="support-content-${ticketKey}" style="font-size:12px;color:rgba(0,0,0,0.62);line-height:1.65;white-space:pre-wrap;">${escapeHtml(ticket.content || '')}</div>
            ${attachments.length ? `
              <div style="margin-top:10px;">
                <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.46);margin-bottom:6px;">첨부 이미지 ${attachments.length}장</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  ${attachments.map((attachment) => `
                    <a href="${escapeHtml(attachment.url || '')}" target="_blank" rel="noreferrer" style="display:block;width:68px;height:68px;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);background:#f5f5f7;">
                      <img src="${escapeHtml(attachment.url || '')}" alt="${escapeHtml(attachment.filename || 'attachment')}" style="width:100%;height:100%;object-fit:cover;">
                    </a>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            ${ticket.attachment_analysis ? `
              <div style="margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.08);font-size:12px;color:rgba(0,0,0,0.62);line-height:1.6;white-space:pre-wrap;">
                <div style="font-size:10px;font-weight:700;color:#007aff;margin-bottom:4px;">첨부 이미지 요약</div>
                ${escapeHtml(ticket.attachment_analysis)}
              </div>
            ` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-sm" type="button" onclick="adminSupportCopyTicketContent(${ticketArg})" style="background:rgba(0,0,0,0.04);color:#1c1c1e;border:1px solid rgba(0,0,0,0.08);">문의 복사</button>
            <button class="btn btn-sm" type="button" onclick="adminSupportGenerateDraft(${ticketArg})" style="background:rgba(0,122,255,0.08);color:#007aff;border:1px solid rgba(0,122,255,0.16);">AI 초안</button>
            <button class="btn btn-sm" type="button" onclick="adminSupportAutoReply(${ticketArg})" style="background:rgba(52,199,89,0.10);color:#34c759;border:1px solid rgba(52,199,89,0.16);">자동 답변</button>
          </div>
        </div>

        ${latestReplyText ? `
          <div style="padding:10px 12px;border-radius:12px;background:rgba(255,140,0,0.05);border:1px solid rgba(255,140,0,0.10);margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#ff8c00;margin-bottom:4px;">최근 답변</div>
            <div id="support-latest-reply-${ticketKey}" style="font-size:12px;color:rgba(0,0,0,0.62);white-space:pre-wrap;line-height:1.6;">${escapeHtml(latestReplyText)}</div>
          </div>
        ` : ''}

        <div id="support-draft-${ticketKey}" style="display:none;padding:10px 12px;border-radius:12px;background:rgba(0,122,255,0.05);border:1px solid rgba(0,122,255,0.10);margin-bottom:10px;"></div>

        <div style="display:grid;grid-template-columns:140px 1fr auto;gap:10px;align-items:start;">
          <select id="support-status-${ticketKey}" style="padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;background:#fff;">
            <option value="open" ${(ticket.status || 'open') === 'open' ? 'selected' : ''}>접수</option>
            <option value="in_progress" ${(ticket.status || '') === 'in_progress' ? 'selected' : ''}>처리중</option>
            <option value="on_hold" ${(ticket.status || '') === 'on_hold' ? 'selected' : ''}>보류</option>
            <option value="resolved" ${(ticket.status || '') === 'resolved' ? 'selected' : ''}>완료</option>
          </select>
          <textarea id="support-reply-${ticketKey}" rows="3" placeholder="수동 답변을 입력하거나 AI 초안을 불러오세요" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;resize:vertical;background:#fff;line-height:1.6;"></textarea>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-sm btn-primary" type="button" onclick="adminSupportSaveReply(${ticketArg})">답변 등록</button>
            <button class="btn btn-sm" type="button" onclick="adminSupportCopyReply(${ticketArg})" style="background:rgba(0,122,255,0.06);color:#007aff;border:1px solid rgba(0,122,255,0.14);">답변 복사</button>
            <button class="btn btn-sm" type="button" onclick="adminSupportUpdateStatus(${ticketArg})" style="background:rgba(0,0,0,0.04);color:#1c1c1e;border:1px solid rgba(0,0,0,0.08);">상태만 저장</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function adminCopyText(text, successMessage) {
  const value = String(text || '').trim();
  if (!value) {
    toast('복사할 내용이 없습니다.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast(successMessage || '복사 완료');
  } catch (e) {
    toast('복사 실패: ' + (e.message || '클립보드 접근 오류'), 'error');
  }
}

async function adminSupportCopyTicketContent(ticketId) {
  const content = document.getElementById(`support-content-${ticketId}`)?.textContent || '';
  const codexPrompt = [
    '[문의 내용]',
    content,
    '',
    '[Codex 요청]',
    '위 문의 내용을 기준으로 원인 파악, 재현 경로, 수정 방향, 필요한 테스트를 정리하고 바로 작업해줘.',
  ].join('\n');
  await adminCopyText(codexPrompt, `티켓 #${ticketId} 문의 내용을 Codex 요청 문구와 함께 복사했습니다`);
}

async function adminSupportCopyReply(ticketId) {
  const draftReply = document.getElementById(`support-reply-${ticketId}`)?.value?.trim() || '';
  const latestReply = document.getElementById(`support-latest-reply-${ticketId}`)?.textContent?.trim() || '';
  await adminCopyText(draftReply || latestReply, `티켓 #${ticketId} 답변을 복사했습니다`);
}

async function loadAdminSupportTickets() {
  const root = document.getElementById('admin-support-tickets-list');
  if (root) root.innerHTML = '<div style="padding:16px;border:1px dashed rgba(0,0,0,0.08);border-radius:14px;font-size:12px;color:rgba(0,0,0,0.36);">문의 목록을 불러오는 중입니다.</div>';
  try {
    const status = document.getElementById('support-ticket-filter-status')?.value || '';
    const category = document.getElementById('support-ticket-filter-category')?.value || '';
    const q = document.getElementById('support-ticket-filter-q')?.value || '';
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    params.set('limit', '100');
    const res = await api(`/api/admin/support/tickets?${params.toString()}`);
    renderAdminSupportTickets(res.tickets || []);
  } catch (e) {
    if (root) root.innerHTML = `<div style="padding:16px;border:1px dashed rgba(255,59,48,0.16);border-radius:14px;font-size:12px;color:#ff3b30;">${escapeHtml(e.message || '문의 목록 로드 실패')}</div>`;
  }
}

async function loadAdminSupportAutomationStatus() {
  const badge = document.getElementById('support-auto-status');
  const meta = document.getElementById('support-auto-meta');
  try {
    const res = await api('/api/admin/support/automation/status');
    const automation = res.automation || {};
    if (badge) {
      badge.textContent = automation.running ? '문의 처리 중' : '문의 관리 대기 중';
      badge.style.background = automation.running ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)';
      badge.style.color = automation.running ? '#ff9500' : '#34c759';
    }
    if (meta) {
      const lastRun = automation.last_run_at ? saFormatDate(automation.last_run_at) : '아직 없음';
      meta.textContent = `최근 처리 ${lastRun} · ${automation.last_summary || '대기 중'}`;
    }
    renderSupportFixJobs(res.fix_jobs || []);
  } catch (e) {
    if (badge) {
      badge.textContent = '상태 확인 실패';
      badge.style.background = 'rgba(255,59,48,0.12)';
      badge.style.color = '#ff3b30';
    }
    if (meta) meta.textContent = e.message || '자동화 상태를 불러오지 못했습니다.';
  }
}

async function adminRefreshSupportOps() {
  await Promise.allSettled([loadAdminSupportAutomationStatus()]);
  if (typeof loadActivityDashboard === 'function') loadActivityDashboard();
}

async function adminRunSupportAutomation() {
  try {
    const res = await api('/api/admin/support/automation/run', { method: 'POST' });
    toast(`CS 자동화 실행 완료: ${(res.processed || []).length}건 처리`);
  } catch (e) {
    toast('CS 자동화 실행 실패: ' + e.message, 'error');
  }
  await adminRefreshSupportOps();
}

async function adminSupportGenerateDraft(ticketId) {
  const draftEl = document.getElementById(`support-draft-${ticketId}`);
  if (draftEl) {
    draftEl.style.display = 'block';
    draftEl.innerHTML = '<div style="font-size:12px;color:#007aff;">AI 초안을 만드는 중입니다...</div>';
  }
  try {
    const res = await api('/api/admin/support/tickets/ai-draft', { method: 'POST', body: { ticket_id: ticketId } });
    const draft = res.draft || {};
    const replyEl = document.getElementById(`support-reply-${ticketId}`);
    const statusEl = document.getElementById(`support-status-${ticketId}`);
    if (replyEl && draft.public_reply) replyEl.value = draft.public_reply;
    if (statusEl && draft.suggested_status) statusEl.value = draft.suggested_status;
    if (draftEl) {
      draftEl.style.display = 'block';
      draftEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:#007aff;margin-bottom:4px;">AI 처리안</div>
        <div style="font-size:12px;color:#1c1c1e;font-weight:700;margin-bottom:6px;">${escapeHtml(draft.internal_summary || '요약 없음')}</div>
        ${(draft.action_items || []).length ? `<div style="font-size:12px;color:rgba(0,0,0,0.6);line-height:1.6;">${(draft.action_items || []).map(item => `• ${escapeHtml(item)}`).join('<br>')}</div>` : ''}
      `;
    }
    toast(`티켓 #${ticketId} AI 초안 생성 완료`);
  } catch (e) {
    if (draftEl) {
      draftEl.style.display = 'block';
      draftEl.innerHTML = `<div style="font-size:12px;color:#ff3b30;">${escapeHtml(e.message || 'AI 초안 생성 실패')}</div>`;
    }
    toast('AI 초안 생성 실패: ' + e.message, 'error');
  }
}

async function adminSupportAutoReply(ticketId) {
  try {
    await api(`/api/admin/support/tickets/${ticketId}/auto-reply`, { method: 'POST' });
    toast(`티켓 #${ticketId} 자동 답변 등록 완료`);
  } catch (e) {
    toast('자동 답변 실패: ' + e.message, 'error');
  }
  await adminRefreshSupportOps();
}

async function adminSupportSaveReply(ticketId) {
  const replyEl = document.getElementById(`support-reply-${ticketId}`);
  const statusEl = document.getElementById(`support-status-${ticketId}`);
  const content = replyEl?.value?.trim() || '';
  if (!content) {
    toast('답변 내용을 입력하세요.', 'error');
    return;
  }
  try {
    await api(`/api/admin/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: {
        content,
        status: statusEl?.value || 'in_progress',
        auto: false,
      },
    });
    toast(`티켓 #${ticketId} 답변 등록 완료`);
  } catch (e) {
    toast('답변 등록 실패: ' + e.message, 'error');
  }
  await adminRefreshSupportOps();
}

async function adminSupportUpdateStatus(ticketId) {
  const statusEl = document.getElementById(`support-status-${ticketId}`);
  try {
    await api(`/api/admin/support/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: { status: statusEl?.value || 'open' },
    });
    toast(`티켓 #${ticketId} 상태 저장 완료`);
  } catch (e) {
    toast('상태 저장 실패: ' + e.message, 'error');
  }
  await adminRefreshSupportOps();
}

function startBackendStatusPolling() {
  stopBackendStatusPolling();
  refreshBackendServerStatus();
  refreshExtensionInstallStatus();
  adminRefreshSupportOps();
  window._saState.backendStatusTimer = setInterval(() => {
    if (window._saState.settingsTab !== 'general') return;
    refreshBackendServerStatus();
  }, 10000);
}

async function restartBackendServerFromUI() {
  const btn = document.getElementById('backend-server-restart-btn');
  const original = btn?.innerHTML || '서버 다시 시작';
  if (!window.electronAPI?.backendRestart) {
    toast('이 기능은 Electron 앱에서만 사용할 수 있습니다', 'error');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 재시작 중...';
  }
  updateBackendStatusUi({ ok: true, restarting: true, port: 8818 });
  try {
    const res = await window.electronAPI.backendRestart();
    if (!res?.ok) throw new Error(res?.message || '서버 재시작 실패');
    toast('백엔드 서버를 다시 시작했습니다');
    await refreshBackendServerStatus();
  } catch (e) {
    toast('백엔드 서버 재시작 실패: ' + e.message, 'error');
    updateBackendStatusUi({ ok: true, reachable: false, port: 8818 });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }
}

function saFormatDate(value) {
  if (!value) return '-';
  try { return String(value).replace('T', ' ').slice(0, 19); } catch { return String(value); }
}

function saEscapeAttr(value) {
  return escapeHtml(String(value == null ? '' : value));
}

function saQuoteJs(value) {
  return JSON.stringify(value == null ? '' : value).replace(/"/g, '&quot;');
}

function saPreviewUrl(path) {
  return `/api/admin/files/content?path=${encodeURIComponent(path || '')}`;
}

function saCanPreview(file) {
  const ext = (file?.ext || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.webm', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
}

function saIsVideoFile(file) {
  const ext = (file?.ext || '').toLowerCase();
  return ['.mp4', '.mov', '.webm', '.m4v'].includes(ext);
}

function saIsAudioFile(file) {
  const ext = (file?.ext || '').toLowerCase();
  return ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext);
}

function saIsImageFile(file) {
  const ext = (file?.ext || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
}

function saUpdateFileSelectionInfo() {
  const el = document.getElementById('sa-file-selection-info');
  if (el) el.textContent = `선택 ${window._saState.selectedFiles.size}개`;
}

function saUpdateDbSelectionInfo() {
  const el = document.getElementById('sa-db-selection-info');
  if (el) el.textContent = `선택 ${window._saState.selectedDbRows.size}개`;
}

function saToggleFileSelection(path, checked) {
  if (!path) return;
  if (checked) window._saState.selectedFiles.add(path);
  else window._saState.selectedFiles.delete(path);
  saUpdateFileSelectionInfo();
}

function saToggleDbSelection(key, checked) {
  if (!key) return;
  if (checked) window._saState.selectedDbRows.add(key);
  else window._saState.selectedDbRows.delete(key);
  saUpdateDbSelectionInfo();
}

function saToggleAllFiles(selectAll) {
  document.querySelectorAll('.sa-file-check').forEach(input => {
    input.checked = !!selectAll;
    saToggleFileSelection(input.dataset.path, !!selectAll);
  });
}

function saToggleAllDbRows(selectAll) {
  document.querySelectorAll('.sa-db-check').forEach(input => {
    input.checked = !!selectAll;
    saToggleDbSelection(input.dataset.key, !!selectAll);
  });
}

async function saDeleteSelectedFiles() {
  const paths = [...window._saState.selectedFiles];
  if (!paths.length) return toast('선택된 파일이 없습니다', 'error');
  const ok = await showConfirm(`선택한 파일 ${paths.length}개를 삭제할까요?`);
  if (!ok) return;
  try {
    await Promise.all(paths.map(path => api('/api/admin/files', { method: 'DELETE', body: { path } })));
    window._saState.selectedFiles.clear();
    saUpdateFileSelectionInfo();
    toast(`${paths.length}개 파일을 삭제했습니다`);
    await saLoadFileSummary();
  } catch (e) {
    toast(e.message || '선택 파일 삭제 실패', 'error');
  }
}

async function saDeleteSelectedDbRows() {
  const items = [...window._saState.selectedDbRows];
  if (!items.length || !window._saState.table) return toast('선택된 행이 없습니다', 'error');
  const ok = await showConfirm(`선택한 행 ${items.length}개를 삭제할까요?`);
  if (!ok) return;
  try {
    await Promise.all(items.map(key => {
      const [mode, value] = String(key).split(':', 2);
      const body = mode === 'pk' ? { value } : { rowid: Number(value) };
      return api(`/api/admin/db/table/${encodeURIComponent(window._saState.table)}`, { method: 'DELETE', body });
    }));
    window._saState.selectedDbRows.clear();
    saUpdateDbSelectionInfo();
    toast(`${items.length}개 행을 삭제했습니다`);
    await saLoadDbTables();
  } catch (e) {
    toast(e.message || '선택 행 삭제 실패', 'error');
  }
}

function saPreviewFile(path, ext) {
  const url = saPreviewUrl(path);
  const isVideo = saIsVideoFile({ ext });
  const isAudio = saIsAudioFile({ ext });
  let modal = document.getElementById('sa-preview-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'sa-preview-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:32px;';
  modal.innerHTML = `
    <div style="position:relative;max-width:92vw;max-height:92vh;background:#111;border-radius:18px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
      <button onclick="document.getElementById('sa-preview-modal')?.remove()" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;border-radius:17px;background:rgba(255,255,255,0.12);color:#fff;cursor:pointer;font-size:18px;">×</button>
      <div style="padding-right:44px;margin-bottom:12px;font-size:13px;color:rgba(255,255,255,0.8);word-break:break-all;">${escapeHtml(path || '')}</div>
      ${isVideo
        ? `<video src="${escapeHtml(url)}" controls autoplay style="max-width:86vw;max-height:78vh;border-radius:12px;background:#000;"></video>`
        : isAudio
        ? `<div style="min-width:min(520px,82vw);max-width:82vw;padding:18px 18px 6px;border-radius:14px;background:linear-gradient(135deg,rgba(255,140,0,0.18),rgba(255,107,0,0.1));border:1px solid rgba(255,255,255,0.08);">
             <div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:6px;">오디오 미리듣기</div>
             <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:16px;">음악 파일을 바로 재생합니다</div>
             <audio src="${escapeHtml(url)}" controls autoplay style="width:min(520px,78vw);"></audio>
           </div>`
        : `<img src="${escapeHtml(url)}" style="max-width:86vw;max-height:78vh;border-radius:12px;display:block;background:#000;">`}
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saCopyImage(path) {
  try {
    const res = await fetch(saPreviewUrl(path));
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    toast('이미지를 복사했습니다');
  } catch (e) {
    toast('이미지 복사 실패', 'error');
  }
}

function saSaveImage(path, filename) {
  try {
    const a = document.createElement('a');
    a.href = saPreviewUrl(path);
    a.download = filename || 'image';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('이미지 저장을 시작했습니다');
  } catch (e) {
    toast('이미지 저장 실패', 'error');
  }
}

function saRenderFileCategoryButtons(categories) {
  const wrap = document.getElementById('sa-file-categories');
  if (!wrap) return;
  wrap.innerHTML = (categories || []).map(cat => `
    <button class="btn btn-sm" data-category="${saEscapeAttr(cat.key)}" onclick="saLoadFiles(this.dataset.category)" style="background:${window._saState.category === cat.key ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.04)'};color:${window._saState.category === cat.key ? '#fff' : '#1c1c1e'};border:none;border-radius:999px;padding:8px 14px;">
      ${escapeHtml(cat.label)} <span style="opacity:0.8;">${cat.count || 0}</span>
    </button>
  `).join('');
}

function saRenderDbTableButtons(tables) {
  const wrap = document.getElementById('sa-db-tables');
  if (!wrap) return;
  wrap.innerHTML = (tables || []).map(table => `
    <button class="btn btn-sm" data-table="${saEscapeAttr(table.name)}" onclick="saLoadDbTable(this.dataset.table)" style="text-align:left;min-width:180px;background:${window._saState.table === table.name ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff'};color:${window._saState.table === table.name ? '#fff' : '#1c1c1e'};border:${window._saState.table === table.name ? 'none' : '1px solid rgba(0,0,0,0.08)'};border-radius:16px;padding:12px 14px;box-shadow:${window._saState.table === table.name ? '0 10px 24px rgba(255,140,0,0.18)' : 'none'};">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${escapeHtml(table.name)}</div>
      <div style="font-size:11px;opacity:0.82;display:flex;gap:8px;flex-wrap:wrap;">
        <span>${table.count || 0}행</span>
        <span>${(table.columns || []).length || 0}컬럼</span>
        <span>${escapeHtml(table.primary_key || 'rowid')}</span>
      </div>
    </button>
  `).join('');
}

function saFormatDbCellValue(value) {
  if (value == null || value === '') return '<span style="color:rgba(0,0,0,0.25);">-</span>';
  let text = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const isJsonish = text.startsWith('{') || text.startsWith('[');
  const short = text.length > 180 ? text.slice(0, 180) + '…' : text;
  return `<div title="${saEscapeAttr(text)}" style="white-space:pre-wrap;word-break:break-all;font-family:${isJsonish ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit'};font-size:${isJsonish ? '11px' : '12px'};line-height:1.5;color:#1c1c1e;">${escapeHtml(short)}</div>`;
}

function saRenderDbStats() {
  const wrap = document.getElementById('sa-db-stats');
  if (!wrap) return;
  const tables = window._saState.dbTables || [];
  const totalRows = tables.reduce((sum, t) => sum + (t.count || 0), 0);
  const totalCols = tables.reduce((sum, t) => sum + ((t.columns || []).length || 0), 0);
  const selected = tables.find(t => t.name === window._saState.table);
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
      <div style="padding:14px 16px;border-radius:16px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.12);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">전체 테이블</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${tables.length}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.08);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">전체 행 수</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${totalRows}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.08);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">전체 컬럼 합</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${totalCols}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:${selected ? 'linear-gradient(135deg,rgba(255,140,0,0.12),rgba(255,107,0,0.08))' : '#fff'};border:1px solid rgba(255,140,0,0.12);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">선택 테이블</div>
        <div style="font-size:18px;font-weight:700;color:#1c1c1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(selected?.name || '-')}</div>
      </div>
    </div>`;
}

function saRenderFileStats(summary, categories) {
  const wrap = document.getElementById('sa-file-stats');
  if (!wrap) return;
  const current = (categories || []).find(cat => cat.key === window._saState.category);
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
      <div style="padding:14px 16px;border-radius:16px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.12);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">전체 파일</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${summary.total_files || 0}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.08);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">전체 용량</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${escapeHtml(summary.total_size_text || '0B')}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.08);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">카테고리 수</div>
        <div style="font-size:22px;font-weight:700;color:#1c1c1e;">${(categories || []).length}</div>
      </div>
      <div style="padding:14px 16px;border-radius:16px;background:${current ? 'linear-gradient(135deg,rgba(255,140,0,0.12),rgba(255,107,0,0.08))' : '#fff'};border:1px solid rgba(255,140,0,0.12);">
        <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:4px;">현재 카테고리</div>
        <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${escapeHtml(current?.label || '-')}</div>
      </div>
    </div>`;
}

function saRenderPaging(targetId, page, pageSize, total, callbackName) {
  const wrap = document.getElementById(targetId);
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (totalPages <= 1) {
    wrap.innerHTML = '';
    return;
  }
  const current = page + 1;
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  let pageBtns = '';
  for (let i = start; i <= end; i++) {
    pageBtns += `<button class="btn btn-sm" onclick="${callbackName}(${i - 1})" style="background:${i === current ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.04)'};color:${i === current ? '#fff' : '#1c1c1e'};border:none;border-radius:10px;padding:8px 12px;min-width:38px;">${i}</button>`;
  }
  wrap.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-sm btn-secondary" onclick="${callbackName}(0)" ${page <= 0 ? 'disabled' : ''}>처음</button>
      <button class="btn btn-sm btn-secondary" onclick="${callbackName}(${Math.max(0, page - 1)})" ${page <= 0 ? 'disabled' : ''}>이전</button>
      ${pageBtns}
      <button class="btn btn-sm btn-secondary" onclick="${callbackName}(${Math.min(totalPages - 1, page + 1)})" ${page >= totalPages - 1 ? 'disabled' : ''}>다음</button>
      <button class="btn btn-sm btn-secondary" onclick="${callbackName}(${totalPages - 1})" ${page >= totalPages - 1 ? 'disabled' : ''}>마지막</button>
      <span style="font-size:12px;color:rgba(0,0,0,0.42);margin-left:4px;">${current}/${totalPages}</span>
    </div>`;
}

function saGoFilePage(page) {
  window._saState.filePage = Math.max(0, page);
  saLoadFiles(window._saState.category, false);
}

function saGoDbPage(page) {
  window._saState.dbPage = Math.max(0, page);
  saLoadDbTable(window._saState.table, false);
}

function saShowDbRowDetail(index) {
  const row = window._saState.dbRows[index];
  const cols = window._saState.dbColumns || [];
  const wrap = document.getElementById('sa-db-row-detail');
  if (!wrap || !row) return;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#1c1c1e;">행 상세</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${escapeHtml(window._saState.table || '')} · rowid ${escapeHtml(row._rowid)}</div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText(this.dataset.json).then(()=>toast('행 JSON 복사됨'))" data-json="${saEscapeAttr(JSON.stringify(row, null, 2))}">JSON 복사</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      ${cols.map(col => `
        <div style="padding:12px 14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
          <div style="font-size:11px;font-weight:700;color:#ff8c00;margin-bottom:6px;">${escapeHtml(col)}</div>
          ${saFormatDbCellValue(row[col])}
        </div>
      `).join('')}
    </div>`;
}

async function loadFileAdmin() {
  mountUnifiedSettingsSections();
  switchUnifiedSettingsTab('files');
  await saLoadFileSummary();
}

async function loadDbAdmin() {
  mountUnifiedSettingsSections();
  switchUnifiedSettingsTab('db');
  await saLoadDbTables();
}

async function saLoadFileSummary() {
  const wrap = document.getElementById('sa-file-categories');
  const summary = document.getElementById('sa-files-summary');
  if (!wrap || !summary) return;
  window._saState.selectedFiles.clear();
  window._saState.filePage = 0;
  saUpdateFileSelectionInfo();
  wrap.innerHTML = '<div style="font-size:12px;color:rgba(0,0,0,0.35);">불러오는 중...</div>';
  try {
    const res = await api('/api/admin/files/summary');
    const categories = res.categories || [];
    const keys = categories.map(cat => cat.key);
    if (!keys.includes(window._saState.category)) window._saState.category = keys[0] || 'videos';
    summary.textContent = `전체 ${res.total_files || 0}개 · ${res.total_size_text || '0B'} · ${res.output_dir || ''}`;
    saRenderFileStats(res, categories);
    saRenderFileCategoryButtons(categories);
    if (window._saState.category) await saLoadFiles(window._saState.category, false);
  } catch (e) {
    wrap.innerHTML = '<div style="font-size:12px;color:#ff3b30;">파일 요약을 불러오지 못했습니다.</div>';
    summary.textContent = e.message || '오류';
  }
}

async function saLoadFiles(category, refreshSummary = true) {
  if (window._saState.category !== category) window._saState.filePage = 0;
  window._saState.category = category;
  window._saState.selectedFiles.clear();
  saUpdateFileSelectionInfo();
  const list = document.getElementById('sa-file-list');
  const paging = document.getElementById('sa-file-paging');
  if (!list) return;
  const q = (document.getElementById('sa-file-search')?.value || '').trim().toLowerCase();
  if (refreshSummary) {
    const buttons = [...document.querySelectorAll('#sa-file-categories button')].map(btn => ({
      key: btn.dataset.category,
      label: btn.textContent.trim().replace(/\s+\d+$/, ''),
      count: Number(btn.textContent.match(/(\d+)\s*$/)?.[1] || 0),
    }));
    saRenderFileCategoryButtons(buttons);
  }
  list.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(0,0,0,0.35);">파일 목록을 불러오는 중...</div>';
  if (paging) paging.innerHTML = '';
  try {
    const offset = q ? 0 : window._saState.filePage * window._saState.filePageSize;
    const limit = q ? 400 : window._saState.filePageSize;
    const res = await api(`/api/admin/files?category=${encodeURIComponent(category)}&limit=${limit}&offset=${offset}`);
    let files = res.files || [];
    if (q) {
      files = files.filter(file => ((file.name || '') + ' ' + (file.relative_path || '')).toLowerCase().includes(q));
    }
    if (!files.length) {
      list.innerHTML = `
        <div style="padding:20px;border:1px dashed rgba(0,0,0,0.12);border-radius:14px;text-align:center;color:rgba(0,0,0,0.35);">
          ${q ? '검색 결과가 없습니다.' : `아직 ${escapeHtml(res.label || category)} 파일이 없습니다.`}
          <div style="margin-top:10px;">
            <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:${saQuoteJs(res.dir || '')}}}).then(()=>toast('폴더 열림')).catch(()=>toast('폴더 열기 실패','error'))">폴더 열기</button>
          </div>
        </div>`;
      return;
    }
    list.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:2px;">
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${escapeHtml(res.label || category)} · ${files.length}개${q ? ' · 검색 적용' : ''}</div>
        <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:${saQuoteJs(res.dir || '')}}}).then(()=>toast('폴더 열림')).catch(()=>toast('폴더 열기 실패','error'))">현재 폴더 열기</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${files.map(file => `
        <div style="border:1px solid rgba(0,0,0,0.06);border-radius:18px;padding:12px;background:#fff;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 14px rgba(0,0,0,0.04);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;min-width:0;flex:1;">
              <input type="checkbox" class="sa-file-check" data-path="${saEscapeAttr(file.path || '')}" onchange="saToggleFileSelection(this.dataset.path,this.checked)" style="width:16px;height:16px;accent-color:#ff8c00;cursor:pointer;">
              <div style="min-width:0;">
                <div style="font-size:13px;font-weight:700;color:#1c1c1e;word-break:break-all;">${escapeHtml(file.name || '')}</div>
                <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-top:2px;">${escapeHtml(file.ext || '-')} · ${escapeHtml(file.size_text || '')}</div>
              </div>
            </label>
            <button class="btn btn-sm btn-secondary" onclick="api('/api/open-folder',{method:'POST',body:{folder:${saQuoteJs(file.folder || '')}}}).then(()=>toast('폴더 열림')).catch(()=>toast('폴더 열기 실패','error'))">폴더</button>
          </div>
          ${saCanPreview(file) ? `
            <div onclick="saPreviewFile(${saQuoteJs(file.path || '')}, ${saQuoteJs(file.ext || '')})" style="cursor:pointer;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,107,0,0.04));border:1px solid rgba(255,140,0,0.08);min-height:150px;display:flex;align-items:center;justify-content:center;">
              ${saIsVideoFile(file) ? `
                <div style="width:100%;height:180px;background:linear-gradient(135deg,#1f2937,#111827);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:10px;">
                  <div style="width:56px;height:56px;border-radius:28px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-size:24px;">▶</div>
                  <div style="font-size:13px;font-weight:700;">영상 미리보기</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.72);">클릭하면 재생합니다</div>
                </div>
              ` : saIsAudioFile(file) ? `
                <div style="padding:20px;text-align:center;">
                  <div style="width:56px;height:56px;border-radius:28px;background:linear-gradient(135deg,#ff8c00,#ff6b00);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">♪</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">오디오 미리듣기</div>
                  <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-top:4px;">클릭하면 바로 재생합니다</div>
                </div>
              ` : `
                <img src="${escapeHtml(saPreviewUrl(file.path || ''))}" style="width:100%;height:180px;object-fit:cover;display:block;">
              `}
            </div>` : `
            <div style="border-radius:14px;background:rgba(0,0,0,0.03);min-height:110px;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.28);font-size:12px;">미리보기 없음</div>
          `}
          <div style="font-size:11px;color:rgba(0,0,0,0.42);word-break:break-all;">${escapeHtml(file.relative_path || '')}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="font-size:11px;color:rgba(0,0,0,0.45);">${escapeHtml(saFormatDate(file.modified_at))}</div>
            <div style="display:flex;gap:6px;">
              ${saIsImageFile(file) ? `<button class="btn btn-sm btn-secondary" onclick="saCopyImage(${saQuoteJs(file.path || '')})">복사</button>` : ''}
              ${saIsImageFile(file) ? `<button class="btn btn-sm btn-secondary" onclick="saSaveImage(${saQuoteJs(file.path || '')}, ${saQuoteJs(file.name || 'image')})">저장</button>` : ''}
              ${saCanPreview(file) ? `<button class="btn btn-sm btn-secondary" onclick="saPreviewFile(${saQuoteJs(file.path || '')}, ${saQuoteJs(file.ext || '')})">미리보기</button>` : ''}
              <button class="btn btn-sm" onclick="saDeleteFile(this.dataset.path)" data-path="${saEscapeAttr(file.path || '')}" style="background:rgba(255,59,48,0.08);color:#ff3b30;border:none;">삭제</button>
            </div>
          </div>
        </div>
      `).join('')}
      </div>
    `;
    if (q) {
      if (paging) paging.innerHTML = `<div style="text-align:center;font-size:12px;color:rgba(0,0,0,0.42);">검색 중에는 전체 결과를 한 번에 보여줍니다</div>`;
    } else {
      saRenderPaging('sa-file-paging', window._saState.filePage, window._saState.filePageSize, res.total || files.length, 'saGoFilePage');
    }
  } catch (e) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:#ff3b30;">${escapeHtml(e.message || '파일 목록을 불러오지 못했습니다.')}</div>`;
  }
}

async function saDeleteFile(path) {
  if (!path) return;
  const ok = await showConfirm('이 파일을 삭제할까요?');
  if (!ok) return;
  try {
    await api('/api/admin/files', { method: 'DELETE', body: { path } });
    toast('파일을 삭제했습니다');
    await saLoadFileSummary();
  } catch (e) {
    toast(e.message || '파일 삭제 실패', 'error');
  }
}

async function saLoadDbTables() {
  const wrap = document.getElementById('sa-db-tables');
  const summary = document.getElementById('sa-db-summary');
  if (!wrap || !summary) return;
  window._saState.selectedDbRows.clear();
  window._saState.dbPage = 0;
  saUpdateDbSelectionInfo();
  wrap.innerHTML = '<div style="font-size:12px;color:rgba(0,0,0,0.35);">불러오는 중...</div>';
  try {
    const res = await api('/api/admin/db/tables');
    const tables = res.tables || [];
    window._saState.dbTables = tables;
    const names = tables.map(table => table.name);
    if (!names.includes(window._saState.table)) window._saState.table = names[0] || '';
    summary.textContent = `${tables.length}개 테이블 · ${res.db_path || ''}`;
    saRenderDbStats();
    saRenderDbTableButtons(tables);
    if (window._saState.table) await saLoadDbTable(window._saState.table, false);
  } catch (e) {
    wrap.innerHTML = '<div style="font-size:12px;color:#ff3b30;">테이블 목록을 불러오지 못했습니다.</div>';
    summary.textContent = e.message || '오류';
  }
}

async function saLoadDbTable(table, refreshButtons = true) {
  if (window._saState.table !== table) window._saState.dbPage = 0;
  window._saState.table = table;
  window._saState.selectedDbRows.clear();
  saUpdateDbSelectionInfo();
  if (refreshButtons) {
    saRenderDbTableButtons(window._saState.dbTables || []);
  }
  const head = document.getElementById('sa-db-head');
  const body = document.getElementById('sa-db-body');
  const meta = document.getElementById('sa-db-table-meta');
  const paging = document.getElementById('sa-db-paging');
  if (!head || !body || !meta) return;
  body.innerHTML = '<tr><td style="padding:18px;color:rgba(0,0,0,0.35);">불러오는 중...</td></tr>';
  if (paging) paging.innerHTML = '';
  try {
    const res = await api(`/api/admin/db/table/${encodeURIComponent(table)}?limit=${window._saState.dbPageSize}&offset=${window._saState.dbPage * window._saState.dbPageSize}`);
    window._saState.dbRows = res.rows || [];
    window._saState.dbColumns = res.columns || [];
    window._saState.dbPrimaryKey = res.primary_key || '';
    saRenderDbStats();
    meta.textContent = `${res.table} · ${res.total || 0}행 · PK ${res.primary_key || 'rowid'}`;
    const columns = (res.columns || []).slice(0, 8);
    head.innerHTML = `
      <tr style="background:rgba(255,140,0,0.06);">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#1c1c1e;border-bottom:1px solid rgba(0,0,0,0.06);white-space:nowrap;">선택</th>
        ${columns.map(col => `<th style="padding:10px 12px;text-align:left;font-size:11px;color:#1c1c1e;border-bottom:1px solid rgba(0,0,0,0.06);white-space:nowrap;">${escapeHtml(col)}</th>`).join('')}
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#1c1c1e;border-bottom:1px solid rgba(0,0,0,0.06);white-space:nowrap;">관리</th>
      </tr>`;
    if (!(res.rows || []).length) {
      body.innerHTML = `<tr><td colspan="${columns.length + 2}" style="padding:20px;text-align:center;color:rgba(0,0,0,0.35);">행이 없습니다.</td></tr>`;
      return;
    }
    body.innerHTML = (res.rows || []).map(row => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.04);vertical-align:top;">
          <input type="checkbox" class="sa-db-check" data-key="${saEscapeAttr(res.primary_key ? `pk:${row[res.primary_key]}` : `rowid:${row._rowid}`)}" onchange="saToggleDbSelection(this.dataset.key,this.checked)" style="width:16px;height:16px;accent-color:#ff8c00;cursor:pointer;">
        </td>
        ${columns.map(col => {
          let value = row[col];
          if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
          const text = value == null ? '' : String(value);
          return `<td style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.04);vertical-align:top;max-width:240px;word-break:break-all;">${escapeHtml(text.length > 180 ? text.slice(0, 180) + '…' : text || '-')}</td>`;
        }).join('')}
        <td style="padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.04);vertical-align:top;white-space:nowrap;">
          <button class="btn btn-sm" onclick="saDeleteDbRow('${res.table}', '${res.primary_key || ''}', this.dataset.value, this.dataset.rowid)" data-value="${saEscapeAttr(res.primary_key ? row[res.primary_key] : '')}" data-rowid="${saEscapeAttr(row._rowid)}" style="background:rgba(255,59,48,0.08);color:#ff3b30;border:none;">삭제</button>
        </td>
      </tr>
    `).join('');
    saRenderPaging('sa-db-paging', window._saState.dbPage, window._saState.dbPageSize, res.total || 0, 'saGoDbPage');
  } catch (e) {
    meta.textContent = '';
    head.innerHTML = '';
    body.innerHTML = `<tr><td style="padding:18px;color:#ff3b30;">${escapeHtml(e.message || '테이블 조회 실패')}</td></tr>`;
  }
}

async function saDeleteDbRow(table, primaryKey, value, rowid) {
  const ok = await showConfirm(`${table} 테이블의 이 행을 삭제할까요?`);
  if (!ok) return;
  const body = primaryKey && value !== '' ? { value } : { rowid: Number(rowid) };
  try {
    await api(`/api/admin/db/table/${encodeURIComponent(table)}`, { method: 'DELETE', body });
    toast('DB 행을 삭제했습니다');
    await saLoadDbTables();
  } catch (e) {
    toast(e.message || 'DB 행 삭제 실패', 'error');
  }
}
