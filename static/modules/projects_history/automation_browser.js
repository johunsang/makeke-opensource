// ═══ projects_history/automation_browser.js ═══
// 브라우저 자동화 (CDP 시나리오) + 라이브 에이전트
// (원본 projects_history.js 라인 677-1991 추출)

let _autoSteps = [];
let _autoScenarios = [];
let _autoSelectedScenarioId = 0;
let _autoEditingSavedScenarioId = 0;
let _autoBrowserStatusPolling = null;
let _autoMode = 'ai';
let _autoScenarioRetryTimer = null;

function autoNormalizeScenarioSteps(steps = []) {
  return (Array.isArray(steps) ? steps : []).map((step, idx) => {
    const next = { ...(step || {}) };
    if (!next.id) next.id = Date.now() + idx;
    if (next.type === 'ai-command') {
      const instruction = (next.instruction || next.description || next.query || '').trim();
      next.instruction = instruction;
      if (!next.description) next.description = instruction;
      const maxSteps = parseInt(next.maxSteps ?? next.max_steps ?? '20', 10) || 20;
      next.maxSteps = maxSteps;
      next.max_steps = maxSteps;
    }
    if (next.type === 'deep-research') {
      next.query = (next.query || next.description || '').trim();
    }
    if (next.type === 'ai-click') {
      next.description = (next.description || next.instruction || '').trim();
    }
    return next;
  });
}

function autoGetScenarioSteps(scenario) {
  return autoNormalizeScenarioSteps(scenario?.steps_json || scenario?.steps || []);
}

function autoGetSavedScenarioPromptMeta(scenario) {
  const steps = autoGetScenarioSteps(scenario);
  const stepIndex = steps.findIndex(step => ['ai-command', 'deep-research', 'ai-click'].includes(step.type));
  if (stepIndex < 0) return null;
  const step = steps[stepIndex];
  if (step.type === 'ai-command') {
    return {
      stepIndex,
      type: step.type,
      fieldKey: 'instruction',
      prompt: (step.instruction || step.description || '').trim(),
      maxSteps: parseInt(step.maxSteps ?? step.max_steps ?? '20', 10) || 20,
    };
  }
  if (step.type === 'deep-research') {
    return {
      stepIndex,
      type: step.type,
      fieldKey: 'query',
      prompt: (step.query || step.description || '').trim(),
      maxSteps: 0,
    };
  }
  return {
    stepIndex,
    type: step.type,
    fieldKey: 'description',
    prompt: (step.description || step.instruction || '').trim(),
    maxSteps: 0,
  };
}

function autoSelectSavedPrompt(scenarioId) {
  const scenario = _autoScenarios.find(item => Number(item.id) === Number(scenarioId));
  const meta = autoGetSavedScenarioPromptMeta(scenario);
  if (!scenario || !meta) {
    toast('프롬프트를 바로 불러올 수 없는 시나리오입니다.', 'error');
    return;
  }
  const taskEl = document.getElementById('live-agent-task');
  if (taskEl) taskEl.value = meta.prompt;
  const maxStepsEl = document.getElementById('live-agent-max-steps');
  if (maxStepsEl && meta.maxSteps) maxStepsEl.value = String(meta.maxSteps);
  const guideEl = document.getElementById('live-agent-scenario');
  if (guideEl) guideEl.value = String(scenario.id);
  toast(`"${scenario.name}" 프롬프트를 불러왔습니다.`);
}

function autoStartEditSavedScenario(scenarioId) {
  _autoEditingSavedScenarioId = Number(scenarioId || 0);
  autoRenderSavedScenarios();
}

function autoCancelEditSavedScenario() {
  _autoEditingSavedScenarioId = 0;
  autoRenderSavedScenarios();
}

async function autoSaveSavedScenarioPrompt(scenarioId) {
  const scenario = _autoScenarios.find(item => Number(item.id) === Number(scenarioId));
  const meta = autoGetSavedScenarioPromptMeta(scenario);
  if (!scenario || !meta) {
    toast('수정할 프롬프트 시나리오를 찾지 못했습니다.', 'error');
    return;
  }
  const name = document.getElementById(`auto-saved-name-${scenarioId}`)?.value?.trim() || scenario.name || '';
  const prompt = document.getElementById(`auto-saved-prompt-${scenarioId}`)?.value?.trim() || '';
  const maxStepsInput = document.getElementById(`auto-saved-max-steps-${scenarioId}`);
  const nextMaxSteps = maxStepsInput ? Math.max(1, parseInt(maxStepsInput.value || String(meta.maxSteps || 20), 10) || 20) : meta.maxSteps;
  if (!name) { toast('시나리오 이름을 입력하세요.', 'error'); return; }
  if (!prompt) { toast('명령어 프롬프트를 입력하세요.', 'error'); return; }

  const steps = autoGetScenarioSteps(scenario);
  const targetStep = { ...(steps[meta.stepIndex] || {}) };
  targetStep[meta.fieldKey] = prompt;
  if (targetStep.type === 'ai-command') {
    targetStep.instruction = prompt;
    targetStep.description = prompt;
    targetStep.maxSteps = nextMaxSteps;
    targetStep.max_steps = nextMaxSteps;
  } else if (targetStep.type === 'deep-research') {
    targetStep.query = prompt;
    targetStep.description = prompt;
  } else if (targetStep.type === 'ai-click') {
    targetStep.description = prompt;
  }
  steps[meta.stepIndex] = targetStep;

  const body = {
    name,
    description: prompt,
    steps,
    profile_id: parseInt(scenario.profile_id || window._globalProfileId || 0, 10) || 0,
    chrome_profile: scenario.chrome_profile || (typeof getPreferredChromeProfileDir === 'function' ? getPreferredChromeProfileDir() : ''),
  };

  try {
    await api(`/api/automation/browser-scenarios/${scenarioId}`, { method: 'PUT', body });
    _autoEditingSavedScenarioId = 0;
    await autoLoadSavedScenarios();
    toast(`"${name}" 수정 저장 완료`);
  } catch (e) {
    toast('프롬프트 저장 실패: ' + e.message, 'error');
  }
}

async function autoDeleteSavedScenario(scenarioId) {
  const scenario = _autoScenarios.find(item => Number(item.id) === Number(scenarioId));
  if (!scenario) return;
  if (!confirm(`"${scenario.name}" 시나리오를 삭제할까요?`)) return;
  try {
    await api(`/api/automation/browser-scenarios/${scenarioId}`, { method: 'DELETE' });
    if (Number(_autoSelectedScenarioId) === Number(scenarioId)) {
      _autoSelectedScenarioId = 0;
      _autoSteps = [];
      autoRenderSteps();
      const sel = document.getElementById('auto-scenario-select');
      if (sel) sel.value = '';
      const nameEl = document.getElementById('auto-scenario-name');
      if (nameEl) nameEl.value = '';
    }
    _autoEditingSavedScenarioId = 0;
    await autoLoadSavedScenarios();
    await autoLoadBrowserSchedules();
    toast('시나리오 삭제됨');
  } catch (e) {
    toast('시나리오 삭제 실패: ' + e.message, 'error');
  }
}

function autoRenderBrowserStatus(status = {}) {
  const el = document.getElementById('auto-browser-status');
  if (!el) return;
  if (status.connected) {
    el.textContent = '연결됨';
    el.style.background = 'rgba(52,199,89,0.1)';
    el.style.color = '#34c759';
    return;
  }
  if (status.current_profile) {
    el.textContent = '연결 대기';
    el.style.background = 'rgba(255,149,0,0.1)';
    el.style.color = '#ff9500';
    return;
  }
  el.textContent = '미연결';
  el.style.background = 'rgba(255,59,48,0.1)';
  el.style.color = '#ff3b30';
}

function autoCheckBrowser() {
  api('/api/browser/status').then(autoRenderBrowserStatus).catch(() => {});
}

async function autoPromptScenarioName(title, message, defaultValue = '') {
  if (typeof showInputModal === 'function') {
    const value = await showInputModal(title, message, defaultValue);
    return (value || '').trim();
  }
  return await new Promise(resolve => {
    const existing = document.getElementById('auto-inline-input-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'auto-inline-input-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.38);display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="width:min(420px, 92vw);background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <div style="font-size:17px;font-weight:800;color:#1c1c1e;">${escapeHtml(title || '이름 입력')}</div>
        <div style="margin-top:8px;font-size:12px;line-height:1.6;color:rgba(0,0,0,0.48);white-space:pre-wrap;">${escapeHtml(message || '')}</div>
        <input id="auto-inline-input-field" type="text" value="${escapeHtml(defaultValue || '')}" style="width:100%;margin-top:14px;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;font-size:13px;background:rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
          <button id="auto-inline-input-cancel" style="padding:9px 14px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.55);border:1px solid rgba(0,0,0,0.08);border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;">취소</button>
          <button id="auto-inline-input-ok" style="padding:9px 16px;background:#ff8c00;color:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;">확인</button>
        </div>
      </div>`;
    const cleanup = value => {
      modal.remove();
      resolve((value || '').trim());
    };
    modal.addEventListener('click', e => { if (e.target === modal) cleanup(''); });
    document.body.appendChild(modal);
    const input = document.getElementById('auto-inline-input-field');
    const okBtn = document.getElementById('auto-inline-input-ok');
    const cancelBtn = document.getElementById('auto-inline-input-cancel');
    if (input) {
      input.focus();
      input.select?.();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') cleanup(input.value || '');
        if (e.key === 'Escape') cleanup('');
      });
    }
    okBtn?.addEventListener('click', () => cleanup(input?.value || ''));
    cancelBtn?.addEventListener('click', () => cleanup(''));
  });
}

function autoBuildAITaskSteps(task, maxSteps) {
  return [{
    type: 'ai-command',
    instruction: task,
    description: task,
    maxSteps: Math.max(1, parseInt(maxSteps || '20', 10) || 20),
  }];
}

function autoOpenScenarioDraft(task, maxSteps = 20, name = '') {
  const nextTask = (task || '').trim();
  if (!nextTask) {
    toast('작업 내용을 입력하세요', 'error');
    return false;
  }
  _autoSelectedScenarioId = 0;
  _autoSteps = autoNormalizeScenarioSteps(autoBuildAITaskSteps(nextTask, maxSteps));
  autoRenderSteps();
  const sel = document.getElementById('auto-scenario-select');
  if (sel) sel.value = '';
  const nameEl = document.getElementById('auto-scenario-name');
  if (nameEl) {
    nameEl.value = (name || nextTask.substring(0, 30) || '브라우저 자동화').trim();
    setTimeout(() => {
      nameEl.focus();
      nameEl.select?.();
    }, 0);
  }
  autoSwitchMode('scenario');
  document.getElementById('auto-panel-scenario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function autoStartBrowserStatusPolling() {
  autoCheckBrowser();
  if (_autoBrowserStatusPolling) return;
  _autoBrowserStatusPolling = setInterval(() => {
    if (!document.getElementById('page-browser-auto')?.classList.contains('active')) {
      clearInterval(_autoBrowserStatusPolling);
      _autoBrowserStatusPolling = null;
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    autoCheckBrowser();
  }, typeof BROWSER_STATUS_ACTIVE_POLL_MS === 'number' ? BROWSER_STATUS_ACTIVE_POLL_MS : 15000);
}

async function autoSaveAITask() {
  const task = document.getElementById('live-agent-task')?.value?.trim();
  if (!task) { toast('작업 내용을 입력하세요', 'error'); return; }
  const maxSteps = parseInt(document.getElementById('live-agent-max-steps')?.value || '20', 10) || 20;
  if (autoOpenScenarioDraft(task, maxSteps)) {
    toast('실행값을 시나리오 저장 화면으로 옮겼습니다.');
  }
}

async function autoScheduleAITask() {
  const task = document.getElementById('live-agent-task')?.value?.trim();
  if (!task) { toast('작업 내용을 입력하세요', 'error'); return; }
  // 먼저 저장
  const name = await autoPromptScenarioName('브라우저 자동화 예약', '예약 이름을 입력하세요', task.substring(0, 30));
  if (!name) return;
  const steps = autoBuildAITaskSteps(task, document.getElementById('live-agent-max-steps')?.value || '20');
  const body = {
    name,
    description: task,
    steps,
    profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
    chrome_profile: typeof getPreferredChromeProfileDir === 'function' ? getPreferredChromeProfileDir() : '',
  };
  try {
    const res = await api('/api/automation/browser-scenarios', { method: 'POST', body });
    const scenarioId = res.scenario?.id;
    if (!scenarioId) throw new Error('시나리오 저장 실패');
    _autoSelectedScenarioId = scenarioId;
    await autoLoadSavedScenarios();
    autoOpenScenarioScheduleModal();
  } catch (e) { toast('예약 준비 실패: ' + e.message, 'error'); }
}

async function autoLoadSavedScenarios() {
  if (_autoScenarioRetryTimer) {
    clearTimeout(_autoScenarioRetryTimer);
    _autoScenarioRetryTimer = null;
  }
  try {
    const res = await api('/api/automation/browser-scenarios');
    _autoScenarios = (res.scenarios || []).map(item => ({
      ...item,
      steps_json: autoGetScenarioSteps(item),
    }));
    autoRefreshScenarioList();
    autoRenderSavedScenarios();
  } catch (e) {
    const container = document.getElementById('auto-saved-scenarios');
    const isFetchError = /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '');
    if (_autoScenarios.length) {
      autoRenderSavedScenarios();
      if (container) {
        container.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:10px;padding:12px 14px;border-radius:10px;background:rgba(255,149,0,0.08);color:#ff9500;font-size:12px;">시나리오 목록을 다시 불러오는 중입니다. 잠시 후 자동 재시도합니다.</div>`);
      }
    } else if (container) {
      container.innerHTML = `<div style="padding:14px;border-radius:10px;background:${isFetchError ? 'rgba(255,149,0,0.08)' : 'rgba(255,59,48,0.04)'};color:${isFetchError ? '#ff9500' : '#ff3b30'};font-size:12px;">시나리오 로딩 실패: ${escapeHtml(e.message || '알 수 없는 오류')}</div>`;
    }
    if (isFetchError && document.getElementById('page-browser-auto')?.classList.contains('active')) {
      _autoScenarioRetryTimer = setTimeout(() => {
        _autoScenarioRetryTimer = null;
        autoLoadSavedScenarios();
      }, 2000);
    }
  }
}

function autoRefreshScenarioList() {
  const sel = document.getElementById('auto-scenario-select');
  if (sel) {
    const cur = String(_autoSelectedScenarioId || sel.value || '');
    sel.innerHTML = '<option value="">새 시나리오</option>' + _autoScenarios.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    sel.value = cur;
  }
  // 라이브 에이전트 시나리오 가이드 드롭다운도 업데이트
  const liveSel = document.getElementById('live-agent-scenario');
  if (liveSel) {
    liveSel.innerHTML = '<option value="">없음 (AI 자율)</option>' + _autoScenarios.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
}

function autoLoadScenario() {
  const selectedId = parseInt(document.getElementById('auto-scenario-select')?.value || '0', 10) || 0;
  _autoSelectedScenarioId = selectedId;
  if (!selectedId) { _autoSteps = []; autoRenderSteps(); document.getElementById('auto-scenario-name').value = ''; return; }
  const s = _autoScenarios.find(item => Number(item.id) === selectedId);
  if (!s) return;
  document.getElementById('auto-scenario-name').value = s.name;
  _autoSteps = JSON.parse(JSON.stringify(autoGetScenarioSteps(s)));
  autoRenderSteps();
}

async function autoSaveScenario() {
  const name = document.getElementById('auto-scenario-name')?.value?.trim();
  if (!name) { toast('시나리오 이름을 입력하세요', 'error'); return; }
  if (!_autoSteps.length) { toast('단계를 추가하세요', 'error'); return; }
  const body = {
    name,
    description: '',
    steps: autoNormalizeScenarioSteps(_autoSteps),
    profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
    chrome_profile: typeof getPreferredChromeProfileDir === 'function' ? getPreferredChromeProfileDir() : '',
  };
  try {
    let scenario = null;
    if (_autoSelectedScenarioId) {
      const res = await api(`/api/automation/browser-scenarios/${_autoSelectedScenarioId}`, { method: 'PUT', body });
      scenario = res.scenario;
    } else {
      const res = await api('/api/automation/browser-scenarios', { method: 'POST', body });
      scenario = res.scenario;
    }
    _autoSelectedScenarioId = Number(scenario?.id || 0);
    await autoLoadSavedScenarios();
    const sel = document.getElementById('auto-scenario-select');
    if (sel && _autoSelectedScenarioId) sel.value = String(_autoSelectedScenarioId);
    toast(`"${name}" 시나리오 저장 완료!`);
  } catch (e) {
    toast('시나리오 저장 실패: ' + e.message, 'error');
  }
}

async function autoDeleteScenario() {
  const selectedId = parseInt(document.getElementById('auto-scenario-select')?.value || '0', 10) || 0;
  if (!selectedId) return;
  const s = _autoScenarios.find(item => Number(item.id) === selectedId);
  if (!confirm(`"${s?.name}" 시나리오를 삭제할까요?`)) return;
  try {
    await api(`/api/automation/browser-scenarios/${selectedId}`, { method: 'DELETE' });
    _autoSelectedScenarioId = 0;
    document.getElementById('auto-scenario-select').value = '';
    _autoSteps = [];
    autoRenderSteps();
    await autoLoadSavedScenarios();
    await autoLoadBrowserSchedules();
    toast('시나리오 삭제됨');
  } catch (e) {
    toast('시나리오 삭제 실패: ' + e.message, 'error');
  }
}

function autoRenderSavedScenarios() {
  const container = document.getElementById('auto-saved-scenarios');
  if (!container) return;
  if (!_autoScenarios.length) {
    container.innerHTML = '<div style="padding:14px;border-radius:10px;background:rgba(0,0,0,0.02);font-size:12px;color:rgba(0,0,0,0.35);">저장된 브라우저 자동화 시나리오가 없습니다.</div>';
    return;
  }
  container.innerHTML = _autoScenarios.map(s => `
    <div style="padding:12px 14px;border-radius:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.05);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="min-width:0;flex:1;">
          <div style="font-size:13px;font-weight:700;color:#1c1c1e;">${escapeHtml(s.name || '이름 없음')}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:4px;">단계 ${autoGetScenarioSteps(s).length}개 · 최근 실행 ${escapeHtml(s.last_run_at || '-')}</div>
          ${(() => {
            const meta = autoGetSavedScenarioPromptMeta(s);
            if (!meta) return '<div style="font-size:11px;color:rgba(0,0,0,0.28);margin-top:6px;">프롬프트 직접 수정은 AI 명령/조사형 시나리오에서 지원됩니다.</div>';
            return `<div style="margin-top:6px;padding:9px 10px;border-radius:8px;background:#fff;border:1px solid rgba(0,0,0,0.05);font-size:11px;line-height:1.55;color:rgba(0,0,0,0.55);white-space:pre-wrap;">${escapeHtml(meta.prompt || '프롬프트 없음')}</div>`;
          })()}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
          <button onclick="autoSelectSavedPrompt(${s.id})" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:8px;cursor:pointer;">불러오기</button>
          <button onclick="autoStartEditSavedScenario(${s.id})" style="padding:6px 10px;font-size:11px;background:rgba(0,122,255,0.08);color:#007aff;border:1px solid rgba(0,122,255,0.14);border-radius:8px;cursor:pointer;">수정</button>
          <button onclick="autoRunSavedScenario(${s.id})" style="padding:6px 10px;font-size:11px;background:rgba(255,140,0,0.1);color:#ff8c00;border:1px solid rgba(255,140,0,0.14);border-radius:8px;cursor:pointer;">재실행</button>
          <button onclick="autoDeleteSavedScenario(${s.id})" style="padding:6px 10px;font-size:11px;background:rgba(255,59,48,0.06);color:#ff3b30;border:1px solid rgba(255,59,48,0.15);border-radius:8px;cursor:pointer;">삭제</button>
        </div>
      </div>
      ${Number(_autoEditingSavedScenarioId) === Number(s.id) ? (() => {
        const meta = autoGetSavedScenarioPromptMeta(s);
        if (!meta) {
          return `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,149,0,0.08);color:#ff9500;font-size:12px;">이 시나리오는 직접 프롬프트 수정 대상이 아닙니다. 필요하면 시나리오 편집기로 불러와 수정해주세요.</div>`;
        }
        return `<div style="margin-top:10px;padding:12px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);">
          <div style="display:grid;grid-template-columns:1fr ${meta.maxSteps ? '120px' : '0px'};gap:8px;align-items:end;">
            <div>
              <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">시나리오 이름</div>
              <input id="auto-saved-name-${s.id}" type="text" value="${escapeHtml(s.name || '')}" style="width:100%;padding:9px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
            </div>
            ${meta.maxSteps ? `<div>
              <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">최대 반복</div>
              <input id="auto-saved-max-steps-${s.id}" type="number" min="1" max="100" value="${meta.maxSteps}" style="width:100%;padding:9px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
            </div>` : ''}
          </div>
          <div style="margin-top:8px;">
            <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">명령어 프롬프트</div>
            <textarea id="auto-saved-prompt-${s.id}" rows="4" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;resize:vertical;background:#fff;">${escapeHtml(meta.prompt || '')}</textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button onclick="autoCancelEditSavedScenario()" style="padding:7px 12px;font-size:11px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:8px;cursor:pointer;">취소</button>
            <button onclick="autoSaveSavedScenarioPrompt(${s.id})" style="padding:7px 12px;font-size:11px;background:#ff8c00;color:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:8px;cursor:pointer;font-weight:700;">저장</button>
          </div>
        </div>`;
      })() : ''}
    </div>
  `).join('');
}

function autoSelectSavedScenario(scenarioId) {
  _autoSelectedScenarioId = Number(scenarioId || 0);
  const sel = document.getElementById('auto-scenario-select');
  if (sel) sel.value = String(_autoSelectedScenarioId);
  autoLoadScenario();
}

const _stepConfig = {
  navigate:    { label: '이동', color: '#007aff', icon: '🌐', fields: [{key:'url',placeholder:'https://example.com',label:'URL'}] },
  click:       { label: '클릭', color: '#34c759', icon: '👆', fields: [{key:'selector',placeholder:'button.submit, #login-btn',label:'CSS 셀렉터'}] },
  type:        { label: '입력', color: '#ff9500', icon: '⌨️', fields: [{key:'selector',placeholder:'input#email',label:'셀렉터'},{key:'text',placeholder:'입력할 텍스트',label:'텍스트'}] },
  wait:        { label: '대기', color: '#ff8c00', icon: '⏱', fields: [{key:'seconds',placeholder:'3',label:'초'}] },
  js:          { label: 'JS', color: '#1c1c1e', icon: '💻', fields: [{key:'code',placeholder:'document.title',label:'JavaScript 코드',textarea:true}] },
  screenshot:  { label: '캡처', color: '#5ac8fa', icon: '📸', fields: [] },
  'ai-click':  { label: 'AI클릭', color: '#ff8c00', icon: '🤖', fields: [{key:'description',placeholder:'로그인 버튼, 게시 버튼 등',label:'찾을 요소 설명 (AI가 스크린샷에서 찾음)'}] },
  key:         { label: '단축키', color: '#636366', icon: '⌘', fields: [{key:'key',placeholder:'Enter, Tab, a',label:'키'},{key:'modifiers',placeholder:'Meta, Ctrl, Shift (쉼표 구분)',label:'조합키'}] },
  'ai-command':{ label: 'AI 명령', color: '#e84393', icon: '🧠', fields: [{key:'instruction',placeholder:'이 페이지에서 최근 이메일 10개를 읽고 정리해줘\n또는: 검색 결과에서 가격이 가장 싼 상품을 찾아서 클릭해줘',label:'AI에게 시킬 작업',textarea:true}] },
  'deep-research':{ label: 'AI 조사', color: '#ff6b00', icon: '🔬', fields: [{key:'query',placeholder:'무선 마우스 2025년 최신 모델 가격 비교\n또는: 네이버 블로그 SEO 최적화 전략 조사',label:'조사할 주제 (웹 검색 + AI 분석, 수 분 소요)',textarea:true}] },
};

function autoAddStep(type) {
  const cfg = _stepConfig[type];
  const step = { type, id: Date.now() };
  cfg.fields.forEach(f => { step[f.key] = ''; });
  _autoSteps.push(step);
  autoRenderSteps();
}

function autoRemoveStep(id) {
  _autoSteps = _autoSteps.filter(s => s.id !== id);
  autoRenderSteps();
}

function autoMoveStep(id, dir) {
  const idx = _autoSteps.findIndex(s => s.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _autoSteps.length) return;
  [_autoSteps[idx], _autoSteps[newIdx]] = [_autoSteps[newIdx], _autoSteps[idx]];
  autoRenderSteps();
}

function autoRenderSteps() {
  const el = document.getElementById('auto-scenario-steps');
  if (!_autoSteps.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.2);font-size:12px;">위의 버튼으로 단계를 추가하세요</div>';
    return;
  }
  el.innerHTML = _autoSteps.map((step, i) => {
    const cfg = _stepConfig[step.type] || _stepConfig.wait;
    const fieldsHtml = (cfg.fields || []).map(f => {
      const val = step[f.key] || '';
      if (f.textarea) return `<textarea placeholder="${f.placeholder}" oninput="_autoSteps[${i}]['${f.key}']=this.value" style="width:100%;padding:6px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;font-size:11px;resize:vertical;min-height:40px;font-family:monospace;">${val}</textarea>`;
      return `<input type="text" value="${val.replace(/"/g,'&quot;')}" placeholder="${f.placeholder}" oninput="_autoSteps[${i}]['${f.key}']=this.value" style="flex:1;min-width:100px;padding:6px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:6px;font-size:11px;">`;
    }).join('');
    return `<div style="display:flex;align-items:flex-start;gap:6px;padding:8px;background:rgba(0,0,0,0.02);border-radius:8px;margin-bottom:4px;border-left:3px solid ${cfg.color};" data-step-id="${step.id}">
      <span style="font-size:10px;color:rgba(0,0,0,0.25);min-width:16px;text-align:center;margin-top:6px;">${i+1}</span>
      <span style="font-size:13px;margin-top:3px;">${cfg.icon}</span>
      <div style="flex:1;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">${fieldsHtml || '<span style="font-size:11px;color:rgba(0,0,0,0.3);">'+cfg.label+'</span>'}</div>
      <div style="display:flex;gap:2px;flex-shrink:0;">
        <button onclick="autoMoveStep(${step.id},-1)" style="width:20px;height:20px;border:none;background:rgba(0,0,0,0.04);border-radius:4px;cursor:pointer;font-size:9px;color:rgba(0,0,0,0.3);">▲</button>
        <button onclick="autoMoveStep(${step.id},1)" style="width:20px;height:20px;border:none;background:rgba(0,0,0,0.04);border-radius:4px;cursor:pointer;font-size:9px;color:rgba(0,0,0,0.3);">▼</button>
        <button onclick="autoRemoveStep(${step.id})" style="width:20px;height:20px;border:none;background:rgba(255,59,48,0.08);border-radius:4px;cursor:pointer;font-size:9px;color:#ff3b30;">×</button>
      </div>
    </div>`;
  }).join('');
}

async function autoRunScenario() {
  if (!_autoSteps.length) { toast('실행할 단계가 없습니다', 'error'); return; }
  const status = await api('/api/browser/status').catch(() => ({}));
  if (!status.connected) { toast('Chrome이 연결되어 있지 않습니다', 'error'); return; }

  const btn = document.getElementById('auto-run-btn');
  const logEl = document.getElementById('auto-run-log');
  const repeatCount = Math.max(1, parseInt(document.getElementById('auto-run-repeat-count')?.value || '1', 10) || 1);
  const repeatIntervalSec = Math.max(1, parseInt(document.getElementById('auto-run-repeat-interval')?.value || '3', 10) || 3);
  const scenarioName = document.getElementById('auto-scenario-name')?.value?.trim() || '브라우저 자동화';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 실행 중...';
  logEl.style.display = 'block';
  logEl.innerHTML = '';

  try {
    const res = await api('/api/automation/browser/run', {
      method: 'POST',
      body: {
        name: scenarioName,
        steps: autoNormalizeScenarioSteps(_autoSteps),
        scenario_id: _autoSelectedScenarioId || 0,
        repeat_count: repeatCount,
        repeat_interval_sec: repeatIntervalSec,
      },
    });
    const logs = res.logs || [];
    logEl.innerHTML = logs.map(item => `
      <div style="color:${item.level === 'error' ? '#ff3b30' : item.level === 'success' ? '#34c759' : '#007aff'};margin-bottom:2px;">
        [${escapeHtml(item.time || '')}] ${escapeHtml(item.message || '')}
      </div>
    `).join('');
    toast('시나리오 실행 완료!');
    await autoLoadBrowserRuns();
    await autoLoadSavedScenarios();
  } catch (e) {
    logEl.innerHTML += `<div style="color:#ff3b30;margin-bottom:2px;">실패: ${escapeHtml(e.message || '알 수 없는 오류')}</div>`;
    toast('시나리오 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>시나리오 실행';
  }
}

async function autoRunSavedScenario(scenarioId) {
  autoSelectSavedScenario(scenarioId);
  await autoRunScenario();
}

function autoToggleScheduleForm() {
  const form = document.getElementById('auto-schedule-form');
  if (!form) return;
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    // 시나리오 목록 채우기
    const sel = document.getElementById('auto-sched-scenario');
    if (sel) {
      api('/api/automation/scenarios').then(res => {
        const scenarios = res.scenarios || [];
        sel.innerHTML = scenarios.map(s => `<option value="${s.id}">${escapeHtml(s.name || '시나리오 ' + s.id)}</option>`).join('');
        if (!scenarios.length) sel.innerHTML = '<option value="">저장된 시나리오 없음</option>';
      }).catch(() => { sel.innerHTML = '<option value="">로딩 실패</option>'; });
    }
  }
}

function autoSchedTriggerChange() {
  const trigger = document.getElementById('auto-sched-trigger')?.value || 'daily';
  document.getElementById('auto-sched-daily-opts').style.display = trigger === 'daily' ? 'flex' : 'none';
  document.getElementById('auto-sched-interval-opts').style.display = trigger === 'interval' ? 'block' : 'none';
  document.getElementById('auto-sched-once-opts').style.display = trigger === 'once' ? 'block' : 'none';
}

async function autoCreateSchedule() {
  const scenarioId = document.getElementById('auto-sched-scenario')?.value;
  if (!scenarioId) { toast('시나리오를 선택하세요', 'error'); return; }
  const trigger = document.getElementById('auto-sched-trigger')?.value || 'daily';
  const body = { scenario_id: parseInt(scenarioId), trigger_type: trigger, enabled: true };

  if (trigger === 'daily') {
    body.hour = parseInt(document.getElementById('auto-sched-hour')?.value || '9');
    body.minute = parseInt(document.getElementById('auto-sched-minute')?.value || '0');
  } else if (trigger === 'interval') {
    body.interval_minutes = parseInt(document.getElementById('auto-sched-interval-min')?.value || '30');
  } else if (trigger === 'once') {
    body.run_at = document.getElementById('auto-sched-datetime')?.value;
    if (!body.run_at) { toast('실행 시각을 입력하세요', 'error'); return; }
  }

  try {
    await api('/api/automation/browser-schedules', { method: 'POST', body });
    toast('예약 등록 완료');
    document.getElementById('auto-schedule-form').style.display = 'none';
    await autoLoadBrowserSchedules();
  } catch (e) {
    toast('예약 등록 실패: ' + e.message, 'error');
  }
}

async function autoLoadBrowserSchedules() {
  const container = document.getElementById('auto-browser-schedules');
  if (!container) return;
  try {
    const res = await api('/api/automation/browser-schedules');
    const schedules = res.schedules || [];
    if (!schedules.length) {
      container.innerHTML = '<div style="padding:14px;border-radius:10px;background:rgba(0,0,0,0.02);font-size:12px;color:rgba(0,0,0,0.35);">저장된 브라우저 자동화 예약이 없습니다.</div>';
      return;
    }
    container.innerHTML = schedules.map(s => `
      <div style="padding:12px 14px;border-radius:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:700;color:#1c1c1e;">${escapeHtml(s.name || '예약')}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:4px;">${escapeHtml(s.trigger_type)} · 다음 실행 ${escapeHtml(s.next_run_at || '-')} · 최근 실행 ${escapeHtml(s.last_run_at || '-')}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <label style="position:relative;width:40px;height:22px;cursor:pointer;">
              <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="autoToggleBrowserSchedule(${s.id}, this.checked)" style="opacity:0;position:absolute;">
              <span style="position:absolute;inset:0;border-radius:11px;background:${s.enabled ? '#34c759' : 'rgba(0,0,0,0.15)'};transition:0.2s;"></span>
              <span style="position:absolute;top:2px;left:${s.enabled ? '20px' : '2px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:0.2s;"></span>
            </label>
            <button onclick="autoDeleteBrowserSchedule(${s.id})" style="padding:6px 10px;font-size:11px;background:rgba(255,59,48,0.06);color:#ff3b30;border:1px solid rgba(255,59,48,0.15);border-radius:8px;cursor:pointer;">삭제</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div style="padding:14px;border-radius:10px;background:rgba(255,59,48,0.04);font-size:12px;color:#ff3b30;">예약 목록 로딩 실패: ${escapeHtml(e.message || '오류')}</div>`;
  }
}

async function autoToggleBrowserSchedule(scheduleId, enabled) {
  try {
    await api(`/api/automation/browser-schedules/${scheduleId}`, { method: 'PUT', body: { enabled } });
    await autoLoadBrowserSchedules();
  } catch (e) {
    toast('예약 상태 변경 실패: ' + e.message, 'error');
  }
}

async function autoDeleteBrowserSchedule(scheduleId) {
  if (!confirm('이 브라우저 자동화 예약을 삭제할까요?')) return;
  try {
    await api(`/api/automation/browser-schedules/${scheduleId}`, { method: 'DELETE' });
    toast('예약 삭제 완료');
    await autoLoadBrowserSchedules();
  } catch (e) {
    toast('예약 삭제 실패: ' + e.message, 'error');
  }
}

function _autoRenderBrowserRunsPager() {
  const pager = document.getElementById('auto-browser-runs-pager');
  if (!pager) return;
  const totalPages = Math.max(1, Math.ceil((_autoBrowserRunsTotal || 0) / _autoBrowserRunsLimit));
  const currentPage = Math.floor(_autoBrowserRunsOffset / _autoBrowserRunsLimit) + 1;
  pager.innerHTML = `
    <button onclick="autoChangeBrowserRunsPage(-1)" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:8px;cursor:pointer;" ${_autoBrowserRunsOffset <= 0 ? 'disabled' : ''}>이전</button>
    <div style="font-size:11px;color:rgba(0,0,0,0.45);min-width:82px;text-align:center;">${currentPage} / ${totalPages}</div>
    <button onclick="autoChangeBrowserRunsPage(1)" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.08);border-radius:8px;cursor:pointer;" ${_autoBrowserRunsOffset + _autoBrowserRunsLimit >= _autoBrowserRunsTotal ? 'disabled' : ''}>다음</button>
  `;
}

function autoChangeBrowserRunsPage(direction) {
  const nextOffset = _autoBrowserRunsOffset + (direction * _autoBrowserRunsLimit);
  _autoBrowserRunsOffset = Math.max(0, nextOffset);
  autoLoadBrowserRuns();
}

async function autoRerunBrowserRun(runId) {
  const ok = await showConfirm('이 실행 이력을 다시 실행할까요?');
  if (!ok) return;
  try {
    await api(`/api/automation/browser-runs/${runId}/rerun`, { method: 'POST' });
    toast('재실행을 시작했습니다.');
    await autoLoadBrowserRuns();
  } catch (e) {
    toast('재실행 실패: ' + e.message, 'error');
  }
}

async function autoDeleteBrowserRun(runId) {
  const ok = await showConfirm('이 실행 이력을 삭제할까요?');
  if (!ok) return;
  try {
    await api(`/api/automation/browser-runs/${runId}`, { method: 'DELETE' });
    toast('실행 이력을 삭제했습니다.');
    if (_autoBrowserRunsOffset > 0 && _autoBrowserRunsOffset >= Math.max(0, _autoBrowserRunsTotal - 1)) {
      _autoBrowserRunsOffset = Math.max(0, _autoBrowserRunsOffset - _autoBrowserRunsLimit);
    }
    await autoLoadBrowserRuns();
  } catch (e) {
    toast('실행 이력 삭제 실패: ' + e.message, 'error');
  }
}

async function autoLoadBrowserRuns() {
  const container = document.getElementById('auto-browser-runs');
  const pager = document.getElementById('auto-browser-runs-pager');
  if (!container) return;
  try {
    const res = await api(`/api/automation/browser-runs?limit=${_autoBrowserRunsLimit}&offset=${_autoBrowserRunsOffset}`);
    const runs = res.runs || [];
    _autoBrowserRunsTotal = Number(res.total || runs.length || 0);
    if (!runs.length && _autoBrowserRunsOffset > 0 && _autoBrowserRunsTotal > 0) {
      _autoBrowserRunsOffset = Math.max(0, _autoBrowserRunsOffset - _autoBrowserRunsLimit);
      await autoLoadBrowserRuns();
      return;
    }
    if (!runs.length) {
      container.innerHTML = '<div style="padding:14px;border-radius:10px;background:rgba(0,0,0,0.02);font-size:12px;color:rgba(0,0,0,0.35);">최근 실행 이력이 없습니다.</div>';
      if (pager) pager.innerHTML = '';
      return;
    }
    container.innerHTML = runs.map(run => `
      <div style="padding:12px 14px;border-radius:12px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.05);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:700;color:#1c1c1e;">${escapeHtml(run.scenario_name || '브라우저 자동화')}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:4px;">${escapeHtml(run.trigger_source || 'manual')} · 시작 ${escapeHtml(run.started_at || '-')} · 종료 ${escapeHtml(run.finished_at || '-')}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
            <span style="font-size:11px;padding:4px 10px;border-radius:999px;background:${run.status === 'success' ? 'rgba(52,199,89,0.1)' : run.status === 'failed' ? 'rgba(255,59,48,0.1)' : 'rgba(0,122,255,0.1)'};color:${run.status === 'success' ? '#34c759' : run.status === 'failed' ? '#ff3b30' : '#007aff'};font-weight:700;">${escapeHtml(run.status || '')}</span>
            <button onclick="autoRerunBrowserRun(${run.id})" style="padding:6px 10px;font-size:11px;background:rgba(52,199,89,0.08);color:#34c759;border:1px solid rgba(52,199,89,0.14);border-radius:8px;cursor:pointer;">재실행</button>
            <button onclick="autoDeleteBrowserRun(${run.id})" style="padding:6px 10px;font-size:11px;background:rgba(255,59,48,0.06);color:#ff3b30;border:1px solid rgba(255,59,48,0.15);border-radius:8px;cursor:pointer;">삭제</button>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.55);line-height:1.6;max-height:120px;overflow:auto;background:#fff;border-radius:10px;padding:10px;border:1px solid rgba(0,0,0,0.05);">
          ${(run.logs_json || []).slice(-6).map(item => `<div>[${escapeHtml(item.time || '')}] ${escapeHtml(item.message || '')}</div>`).join('') || escapeHtml(run.error_message || '로그 없음')}
        </div>
      </div>
    `).join('');
    _autoRenderBrowserRunsPager();
  } catch (e) {
    container.innerHTML = `<div style="padding:14px;border-radius:10px;background:rgba(255,59,48,0.04);font-size:12px;color:#ff3b30;">실행 이력 로딩 실패: ${escapeHtml(e.message || '오류')}</div>`;
    if (pager) pager.innerHTML = '';
  }
}

async function autoOpenScenarioScheduleModal() {
  if (!_autoSelectedScenarioId) {
    toast('먼저 시나리오를 저장한 뒤 선택하세요.', 'error');
    return;
  }
  let modal = document.getElementById('auto-browser-schedule-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'auto-browser-schedule-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  const scenario = _autoScenarios.find(item => Number(item.id) === Number(_autoSelectedScenarioId));
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:24px;width:440px;max-width:92vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 14px;font-size:16px;">브라우저 자동화 예약</h3>
      <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:16px;">${escapeHtml(scenario?.name || '')}</div>
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">예약 이름</div>
        <input id="auto-sched-name" type="text" value="${escapeHtml((scenario?.name || '') + ' 예약')}" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">예약 방식</div>
          <select id="auto-sched-trigger-type" onchange="autoToggleScheduleFields()" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;background:#fff;">
            <option value="daily">매일</option>
            <option value="interval">간격</option>
            <option value="once">1회</option>
          </select>
        </div>
        <div id="auto-sched-daily-wrap">
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">실행 시간</div>
          <input id="auto-sched-time" type="time" value="09:00" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
        </div>
        <div id="auto-sched-interval-wrap" style="display:none;">
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">간격(분)</div>
          <input id="auto-sched-interval-minutes" type="number" value="60" min="1" max="1440" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
        </div>
        <div id="auto-sched-once-wrap" style="display:none;">
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">실행 일시</div>
          <input id="auto-sched-run-at" type="datetime-local" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">반복 횟수</div>
          <input id="auto-sched-repeat-count" type="number" value="${parseInt(document.getElementById('auto-run-repeat-count')?.value || '1', 10) || 1}" min="1" max="50" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:4px;">반복 간격(초)</div>
          <input id="auto-sched-repeat-interval" type="number" value="${parseInt(document.getElementById('auto-run-repeat-interval')?.value || '3', 10) || 3}" min="1" max="600" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;">
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button onclick="document.getElementById('auto-browser-schedule-modal').remove()" style="padding:10px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
        <button onclick="autoCreateBrowserSchedule()" style="padding:10px 18px;background:#ff8c00;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">예약 저장</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function autoToggleScheduleFields() {
  const type = document.getElementById('auto-sched-trigger-type')?.value || 'daily';
  const daily = document.getElementById('auto-sched-daily-wrap');
  const interval = document.getElementById('auto-sched-interval-wrap');
  const once = document.getElementById('auto-sched-once-wrap');
  if (daily) daily.style.display = type === 'daily' ? '' : 'none';
  if (interval) interval.style.display = type === 'interval' ? '' : 'none';
  if (once) once.style.display = type === 'once' ? '' : 'none';
}

async function autoCreateBrowserSchedule() {
  const type = document.getElementById('auto-sched-trigger-type')?.value || 'daily';
  const body = {
    scenario_id: _autoSelectedScenarioId,
    name: document.getElementById('auto-sched-name')?.value?.trim() || '브라우저 자동화 예약',
    trigger_type: type,
    trigger_config: {},
    repeat_count: Math.max(1, parseInt(document.getElementById('auto-sched-repeat-count')?.value || '1', 10) || 1),
    repeat_interval_sec: Math.max(1, parseInt(document.getElementById('auto-sched-repeat-interval')?.value || '3', 10) || 3),
    enabled: true,
  };
  if (type === 'daily') {
    const timeValue = document.getElementById('auto-sched-time')?.value || '09:00';
    const [hour, minute] = timeValue.split(':').map(v => parseInt(v, 10) || 0);
    body.trigger_config = { hour, minute };
  } else if (type === 'interval') {
    body.trigger_config = { minutes: Math.max(1, parseInt(document.getElementById('auto-sched-interval-minutes')?.value || '60', 10) || 60) };
  } else {
    body.trigger_config = { run_at: document.getElementById('auto-sched-run-at')?.value || '' };
  }
  try {
    await api('/api/automation/browser-schedules', { method: 'POST', body });
    document.getElementById('auto-browser-schedule-modal')?.remove();
    toast('브라우저 자동화 예약 저장 완료');
    await autoLoadBrowserSchedules();
  } catch (e) {
    toast('브라우저 자동화 예약 실패: ' + e.message, 'error');
  }
}


function autoSwitchMode(mode) {
  _autoMode = mode === 'scenario' ? 'scenario' : 'ai';
  const aiPanel = document.getElementById('auto-panel-ai');
  const scenarioPanel = document.getElementById('auto-panel-scenario');
  if (aiPanel) aiPanel.style.display = _autoMode === 'ai' ? '' : 'none';
  if (scenarioPanel) scenarioPanel.style.display = _autoMode === 'scenario' ? '' : 'none';
  const aiBtn = document.getElementById('auto-mode-ai');
  const scBtn = document.getElementById('auto-mode-scenario');
  if (aiBtn && scBtn) {
    if (_autoMode === 'ai') {
      aiBtn.style.background = '#ff8c00'; aiBtn.style.color = '#fff';
      scBtn.style.background = 'transparent'; scBtn.style.color = 'rgba(0,0,0,0.35)';
    } else {
      scBtn.style.background = '#ff8c00'; scBtn.style.color = '#fff';
      aiBtn.style.background = 'transparent'; aiBtn.style.color = 'rgba(0,0,0,0.35)';
    }
  }
}

// ═══ AI 라이브 에이전트 (멀티) ═══
let _liveAgentPolling = null;  // 전체 에이전트 폴링 인터벌
let _liveAgentLogIndices = {}; // agent_id -> 마지막으로 표시한 로그 인덱스
let _liveAgentExpanded = {};   // agent_id -> 로그 펼침 여부
let _liveAgentEditMode = {};   // agent_id -> 편집 여부
let _liveAgentDrafts = {};     // agent_id -> { task, maxSteps, scenarioId }
let _liveAgentsCache = [];

function liveAgentScenarioOptions(selectedId = 0) {
  const selected = Number(selectedId || 0);
  return ['<option value="">없음 (AI 자율)</option>']
    .concat(_autoScenarios.map(s => `<option value="${s.id}" ${Number(s.id) === selected ? 'selected' : ''}>${escapeHtml(s.name || '시나리오')}</option>`))
    .join('');
}

function liveAgentGetDraft(agent) {
  const current = _liveAgentDrafts[agent.agent_id] || {};
  return {
    task: current.task ?? agent.task_full ?? agent.task ?? '',
    maxSteps: current.maxSteps ?? agent.max_steps ?? 20,
    scenarioId: current.scenarioId ?? agent.scenario_id ?? 0,
  };
}

function liveAgentSetDraft(agentId, key, value) {
  const current = _liveAgentDrafts[agentId] || {};
  if (key === 'maxSteps' || key === 'scenarioId') {
    current[key] = parseInt(value || '0', 10) || 0;
  } else {
    current[key] = value;
  }
  _liveAgentDrafts[agentId] = current;
}

function liveAgentStartEdit(agentId) {
  _liveAgentEditMode[agentId] = true;
  liveAgentPollAll();
}

function liveAgentCancelEdit(agentId) {
  delete _liveAgentEditMode[agentId];
  delete _liveAgentDrafts[agentId];
  liveAgentPollAll();
}

function liveAgentUseTask(agentId) {
  const agent = (_liveAgentsCache || []).find(item => item.agent_id === agentId);
  if (!agent) return;
  const draft = liveAgentGetDraft(agent);
  const taskEl = document.getElementById('live-agent-task');
  if (taskEl) taskEl.value = draft.task || '';
  const maxStepsEl = document.getElementById('live-agent-max-steps');
  if (maxStepsEl) maxStepsEl.value = String(draft.maxSteps || 20);
  const scenarioEl = document.getElementById('live-agent-scenario');
  if (scenarioEl) scenarioEl.value = draft.scenarioId ? String(draft.scenarioId) : '';
  toast('에이전트 작업을 입력창으로 불러왔습니다.');
}

function liveAgentBuildStartBody(task, maxSteps, scenarioId = 0) {
  const body = { task, max_steps: maxSteps };
  if (scenarioId) {
    const scenarioGuide = _autoScenarios.find(item => Number(item.id) === Number(scenarioId));
    if (scenarioGuide) body.scenario = scenarioGuide;
  }
  return body;
}

async function liveAgentRerun(agentId) {
  const agent = (_liveAgentsCache || []).find(item => item.agent_id === agentId);
  if (!agent) return;
  const draft = liveAgentGetDraft(agent);
  if (!draft.task?.trim()) { toast('재실행할 작업을 입력하세요.', 'error'); return; }
  const status = await api('/api/browser/status').catch(() => ({}));
  if (!status.connected) { toast('Chrome 확장프로그램이 연결되지 않았습니다. 상단의 "자동 설정" 버튼을 눌러주세요.', 'error', 5000); if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner(); return; }
  try {
    const res = await api('/api/browser/live-agent/start', {
      method: 'POST',
      body: liveAgentBuildStartBody(draft.task.trim(), Math.max(1, draft.maxSteps || 20), draft.scenarioId),
    });
    const newAgentId = res.agent_id;
    _liveAgentExpanded[newAgentId] = true;
    _liveAgentLogIndices[newAgentId] = 0;
    _startAgentPolling();
    await liveAgentPollAll();
    toast(`에이전트 재실행됨 (${newAgentId})`);
  } catch (e) {
    toast('에이전트 재실행 실패: ' + e.message, 'error');
  }
}

async function liveAgentSaveScenario(agentId, openSchedule = false) {
  const agent = (_liveAgentsCache || []).find(item => item.agent_id === agentId);
  if (!agent) return;
  const draft = liveAgentGetDraft(agent);
  const task = (draft.task || '').trim();
  if (!task) { toast('저장할 작업을 입력하세요.', 'error'); return; }
  const defaultName = task.substring(0, 30) || `에이전트 ${agentId}`;
  const name = await autoPromptScenarioName('브라우저 자동화 저장', '저장할 이름을 입력하세요', defaultName);
  if (!name) return;
  const body = {
    name,
    description: task,
    steps: autoBuildAITaskSteps(task, draft.maxSteps || 20),
    profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
    chrome_profile: typeof getPreferredChromeProfileDir === 'function' ? getPreferredChromeProfileDir() : '',
  };
  try {
    const res = await api('/api/automation/browser-scenarios', { method: 'POST', body });
    const scenarioId = Number(res?.scenario?.id || 0);
    await autoLoadSavedScenarios();
    if (scenarioId) {
      _autoSelectedScenarioId = scenarioId;
      const sel = document.getElementById('auto-scenario-select');
      if (sel) sel.value = String(scenarioId);
    }
    delete _liveAgentEditMode[agentId];
    delete _liveAgentDrafts[agentId];
    toast(`"${name}" 저장 완료`);
    if (openSchedule && scenarioId) autoOpenScenarioScheduleModal();
    else liveAgentPollAll();
  } catch (e) {
    toast('시나리오 저장 실패: ' + e.message, 'error');
  }
}

function _startAgentPolling() {
  if (_liveAgentPolling) return;
  _liveAgentPolling = setInterval(liveAgentPollAll, 2000);
}
function _stopAgentPollingIfDone() {
  // 실행 중인 에이전트가 없으면 폴링 중지
  const cards = document.querySelectorAll('[data-agent-running="true"]');
  if (cards.length === 0 && _liveAgentPolling) {
    clearInterval(_liveAgentPolling);
    _liveAgentPolling = null;
  }
}

async function liveAgentPollAll() {
  try {
    const res = await api('/api/browser/live-agent/list');
    const agents = res.agents || [];
    _liveAgentsCache = agents;
    const container = document.getElementById('live-agent-cards');
    if (!container) return;

    // 기존 카드 중 서버에 없는 에이전트 제거
    const serverIds = new Set(agents.map(a => a.agent_id));
    container.querySelectorAll('[data-agent-id]').forEach(el => {
      if (!serverIds.has(el.dataset.agentId)) el.remove();
    });

    for (const ag of agents) {
      let card = container.querySelector(`[data-agent-id="${ag.agent_id}"]`);
      if (!card) {
        card = document.createElement('div');
        card.dataset.agentId = ag.agent_id;
        card.style.cssText = 'border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;overflow:hidden;';
        container.appendChild(card);
        _liveAgentLogIndices[ag.agent_id] = 0;
      }
      card.dataset.agentRunning = ag.running ? 'true' : 'false';

      const statusColor = ag.running ? '#ff8c00' : (ag.error ? '#ff3b30' : '#34c759');
      const statusLabel = ag.running ? ag.status_text : (ag.error ? '오류' : (ag.done ? '완료' : '중지'));
      const isExpanded = _liveAgentExpanded[ag.agent_id];
      const isEditing = !!_liveAgentEditMode[ag.agent_id];
      const draft = liveAgentGetDraft(ag);
      const taskText = draft.task || ag.task_full || ag.task || '';
      const guideLabel = ag.scenario_name ? ` · 가이드 ${escapeHtml(ag.scenario_name)}` : '';

      let html = `<div style="padding:10px 12px;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.02);border-bottom:1px solid rgba(0,0,0,0.04);">
        <div style="width:8px;height:8px;border-radius:50%;background:${statusColor};flex-shrink:0;${ag.running?'animation:pulse 1.5s infinite':''}"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ag.task_full || ag.task || '')}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.35);margin-top:2px;">${ag.agent_id} · ${statusLabel} · 최대 ${ag.max_steps || 20}회${guideLabel} · 로그 ${ag.log_count}건</div>
        </div>
        <button onclick="liveAgentUseTask('${ag.agent_id}')" style="padding:4px 10px;background:rgba(0,0,0,0.04);border:none;border-radius:6px;font-size:10px;cursor:pointer;color:rgba(0,0,0,0.5);">불러오기</button>
        <button onclick="${isEditing ? `liveAgentCancelEdit('${ag.agent_id}')` : `liveAgentStartEdit('${ag.agent_id}')`}" style="padding:4px 10px;background:rgba(0,122,255,0.08);border:none;border-radius:6px;font-size:10px;cursor:pointer;color:#007aff;">${isEditing ? '취소' : '수정'}</button>
        <button onclick="liveAgentToggleLog('${ag.agent_id}')" style="padding:4px 10px;background:rgba(0,0,0,0.04);border:none;border-radius:6px;font-size:10px;cursor:pointer;color:rgba(0,0,0,0.5);">${isExpanded ? '접기' : '로그'}</button>`;
      if (ag.running) {
        html += `<button onclick="liveAgentStopOne('${ag.agent_id}')" style="padding:4px 10px;background:#ff3b30;color:#fff;border:none;border-radius:6px;font-size:10px;cursor:pointer;">중지</button>`;
      } else {
        html += `<button onclick="liveAgentRerun('${ag.agent_id}')" style="padding:4px 10px;background:rgba(255,140,0,0.1);color:#ff8c00;border:none;border-radius:6px;font-size:10px;cursor:pointer;">재실행</button>`;
        html += `<button onclick="liveAgentSaveScenario('${ag.agent_id}', false)" style="padding:4px 10px;background:rgba(52,199,89,0.12);color:#34c759;border:none;border-radius:6px;font-size:10px;cursor:pointer;">저장</button>`;
        html += `<button onclick="liveAgentSaveScenario('${ag.agent_id}', true)" style="padding:4px 10px;background:rgba(139,92,246,0.12);color:#8b5cf6;border:none;border-radius:6px;font-size:10px;cursor:pointer;">자동화</button>`;
        html += `<button onclick="liveAgentDeleteOne('${ag.agent_id}')" style="padding:4px 10px;background:rgba(0,0,0,0.06);border:none;border-radius:6px;font-size:10px;cursor:pointer;color:rgba(0,0,0,0.4);">삭제</button>`;
      }
      html += '</div>';

      if (isEditing) {
        html += `<div style="padding:10px 12px;background:#fff;border-bottom:1px solid rgba(0,0,0,0.04);">
          <div style="display:grid;grid-template-columns:1fr 120px 180px;gap:8px;align-items:end;">
            <div>
              <div style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">작업 프롬프트</div>
              <textarea rows="3" oninput="liveAgentSetDraft('${ag.agent_id}','task',this.value)" style="width:100%;padding:9px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;line-height:1.55;resize:vertical;background:#fff;">${escapeHtml(taskText)}</textarea>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">최대 반복</div>
              <input type="number" min="1" max="100" value="${draft.maxSteps || 20}" oninput="liveAgentSetDraft('${ag.agent_id}','maxSteps',this.value)" style="width:100%;padding:9px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.42);margin-bottom:4px;">가이드 시나리오</div>
              <select onchange="liveAgentSetDraft('${ag.agent_id}','scenarioId',this.value)" style="width:100%;padding:9px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-size:12px;background:#fff;">
                ${liveAgentScenarioOptions(draft.scenarioId || 0)}
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap;">
            ${!ag.running ? `<button onclick="liveAgentRerun('${ag.agent_id}')" style="padding:7px 12px;font-size:11px;background:rgba(255,140,0,0.1);color:#ff8c00;border:none;border-radius:8px;cursor:pointer;">재실행</button>` : ''}
            <button onclick="liveAgentSaveScenario('${ag.agent_id}', false)" style="padding:7px 12px;font-size:11px;background:rgba(52,199,89,0.12);color:#34c759;border:none;border-radius:8px;cursor:pointer;">저장</button>
            <button onclick="liveAgentSaveScenario('${ag.agent_id}', true)" style="padding:7px 12px;font-size:11px;background:rgba(139,92,246,0.12);color:#8b5cf6;border:none;border-radius:8px;cursor:pointer;">자동화</button>
            <button onclick="liveAgentUseTask('${ag.agent_id}')" style="padding:7px 12px;font-size:11px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.55);border:none;border-radius:8px;cursor:pointer;">입력창으로 불러오기</button>
          </div>
        </div>`;
      }

      // 최종 결과 (완료 시)
      if (!ag.running && ag.done && ag.final_answer) {
        html += `<div style="padding:8px 12px;background:rgba(255,140,0,0.04);border-bottom:1px solid rgba(0,0,0,0.04);">
          <div style="font-size:10px;font-weight:600;color:#ff8c00;margin-bottom:4px;">결과</div>
          <div style="font-size:11px;color:#1c1c1e;white-space:pre-wrap;line-height:1.5;max-height:120px;overflow-y:auto;">${escapeHtml(ag.final_answer)}</div>
        </div>`;
      }
      if (ag.error) {
        html += `<div style="padding:8px 12px;background:rgba(255,59,48,0.04);font-size:11px;color:#ff3b30;">${escapeHtml(ag.error)}</div>`;
      }

      // 로그 영역 (펼침 상태일 때)
      html += `<div id="live-agent-log-${ag.agent_id}" style="display:${isExpanded?'block':'none'};max-height:300px;overflow-y:auto;padding:6px 8px;font-size:10px;font-family:monospace;background:#fafafa;"></div>`;

      card.innerHTML = html;

      // 로그 내용 업데이트 (펼침 상태일 때 상세 로그 가져오기)
      if (isExpanded) {
        await _liveAgentFetchLogs(ag.agent_id);
      }
    }

    _stopAgentPollingIfDone();
  } catch (e) {
    // 폴링 실패 무시
  }
}

async function _liveAgentFetchLogs(agentId) {
  try {
    const poll = await api(`/api/browser/live-agent/status?agent_id=${agentId}`);
    const logEl = document.getElementById(`live-agent-log-${agentId}`);
    if (!logEl) return;
    const logs = poll.logs || [];
    const lastIdx = _liveAgentLogIndices[agentId] || 0;
    for (let i = lastIdx; i < logs.length; i++) {
      const l = logs[i];
      const time = new Date().toLocaleTimeString();
      logEl.innerHTML += `<div style="color:${l.color||'rgba(0,0,0,0.5)'};margin-bottom:2px;padding:1px 3px;border-radius:2px;${l.color==='#34c759'?'background:rgba(52,199,89,0.05);':''}">[${time}] ${l.message}</div>`;
    }
    _liveAgentLogIndices[agentId] = logs.length;
    logEl.scrollTop = logEl.scrollHeight;
  } catch {}
}

function liveAgentToggleLog(agentId) {
  _liveAgentExpanded[agentId] = !_liveAgentExpanded[agentId];
  if (_liveAgentExpanded[agentId]) {
    _liveAgentLogIndices[agentId] = 0; // 다시 처음부터 로드
  }
  liveAgentPollAll();
}

async function liveAgentStart() {
  const task = document.getElementById('live-agent-task')?.value?.trim();
  if (!task) { toast('AI에게 시킬 작업을 입력하세요', 'error'); return; }

  const status = await api('/api/browser/status').catch(() => ({}));
  if (!status.connected) { toast('Chrome 확장프로그램이 연결되지 않았습니다. 상단의 "자동 설정" 버튼을 눌러주세요.', 'error', 5000); if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner(); return; }

  // 시나리오 가이드 가져오기
  let scenarioGuide = null;
  const scenarioIdx = parseInt(document.getElementById('live-agent-scenario')?.value || '0', 10) || 0;
  if (scenarioIdx) {
    scenarioGuide = _autoScenarios.find(item => Number(item.id) === scenarioIdx) || null;
  }

  const maxSteps = parseInt(document.getElementById('live-agent-max-steps')?.value || '20');

  const body = { task, max_steps: maxSteps };
  if (scenarioGuide) body.scenario = scenarioGuide;

  try {
    const res = await api('/api/browser/live-agent/start', { method: 'POST', body });
    const agentId = res.agent_id;
    toast(`에이전트 시작됨 (${agentId})`);
    _liveAgentExpanded[agentId] = true; // 새 에이전트는 로그 펼침
    _liveAgentLogIndices[agentId] = 0;

    // 입력 초기화
    document.getElementById('live-agent-task').value = '';

    // 폴링 시작
    _startAgentPolling();
    liveAgentPollAll();
  } catch (e) {
    toast('에이전트 시작 실패: ' + e.message, 'error');
  }
}

async function liveAgentStopOne(agentId) {
  try {
    await api('/api/browser/live-agent/stop', { method: 'POST', body: { agent_id: agentId } });
    toast(`에이전트 ${agentId} 중지 요청됨`);
    liveAgentPollAll();
  } catch (e) {
    toast('중지 실패: ' + e.message, 'error');
  }
}

async function liveAgentDeleteOne(agentId) {
  try {
    await api(`/api/browser/live-agent/${agentId}`, { method: 'DELETE' });
    const card = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (card) card.remove();
    delete _liveAgentLogIndices[agentId];
    delete _liveAgentExpanded[agentId];
    toast('에이전트 삭제됨');
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

async function liveAgentStop() {
  // 하위 호환: 모든 에이전트 중지
  try { await api('/api/browser/live-agent/stop', { method: 'POST', body: {} }); } catch {}
  toast('모든 에이전트 중지 요청됨');
  liveAgentPollAll();
}

async function autoAIGenerate() {
  const prompt = document.getElementById('auto-ai-prompt')?.value?.trim();
  if (!prompt) { toast('원하는 작업을 설명해주세요', 'error'); return; }

  const btn = document.getElementById('auto-ai-gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span>';

  try {
    const res = await api('/api/browser/ai-scenario', { method: 'POST', body: { prompt } });
    if (res.steps?.length) {
      _autoSteps = res.steps.map((s, i) => ({ ...s, id: Date.now() + i }));
      autoRenderSteps();
      if (!document.getElementById('auto-scenario-name').value) {
        document.getElementById('auto-scenario-name').value = res.name || prompt.substring(0, 30);
      }
      toast(`AI가 ${res.steps.length}개 단계를 생성했습니다!`);
    } else {
      toast('AI가 시나리오를 생성하지 못했습니다', 'error');
    }
  } catch (e) {
    toast('AI 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'AI 생성';
  }
}

// 자동화 페이지 진입 시 초기화
function autoInitBrowserPage() {
  autoSwitchMode(_autoMode);
  autoStartBrowserStatusPolling();
  autoLoadSavedScenarios();
  autoLoadBrowserSchedules();
  autoLoadBrowserRuns();
  // 에이전트 목록 초기 로드 + 실행 중인 에이전트가 있으면 폴링 시작
  liveAgentPollAll().then(() => {
    const running = document.querySelectorAll('[data-agent-running="true"]');
    if (running.length > 0) _startAgentPolling();
  });
}

function autoInitDesktopAgentPage() {
  autoDesktopAiLoadStatus();
  autoDesktopAiLoadPresets();
  autoDesktopAiLoadHistory();
  _autoDesktopAiRenderCandidates();
  _autoDesktopAiRenderQueue();
  _autoDesktopAiRenderObservations(null);
  _autoDesktopAiRenderTargets(null);
}

// ═══ 자동화 도구 ═══
async function autoKakaoSend() {
  const rooms = document.getElementById('auto-kakao-rooms')?.value?.split(',').map(r => r.trim()).filter(Boolean);
  const message = document.getElementById('auto-kakao-message')?.value?.trim();
  if (!rooms?.length || !message) { toast('대화방과 메시지를 입력하세요', 'error'); return; }
  try {
    const res = await api('/api/automation/kakao/send', { method: 'POST', body: { rooms, message } });
    toast(`카카오톡 발송 완료! 성공: ${res.success}/${res.total}`);
  } catch (e) { toast('발송 실패: ' + e.message, 'error'); }
}

async function autoKakaoBroadcast() {
  const rooms = document.getElementById('auto-kakao-rooms')?.value?.split(',').map(r => r.trim()).filter(Boolean);
  const message = document.getElementById('auto-kakao-message')?.value?.trim();
  if (!rooms?.length || !message) { toast('대화방과 메시지를 입력하세요', 'error'); return; }
  try {
    await api('/api/automation/kakao/broadcast', { method: 'POST', body: { rooms, message } });
    toast('백그라운드 대량 발송 시작!');
  } catch (e) { toast('발송 실패: ' + e.message, 'error'); }
}

