// ═══ projects_history/automation_desktop.js ═══
// 데스크톱 AI 에이전트 · 매크로 · 자동 전략 스케줄
// (원본 projects_history.js 라인 1992-2957 추출)

let _macroRecording = false;
let _autoDesktopAiLastPlan = null;
let _autoDesktopAiQueue = [];
let _autoDesktopAiPresets = [];
let _autoDesktopAiHistory = [];
let _autoDesktopAiPresetId = 0;
let _autoDesktopAiIntroFlashed = false;
let _autoDesktopAiHistoryLimit = 8;
let _autoDesktopAiHistoryOffset = 0;
let _autoDesktopAiHistoryTotal = 0;
let _autoBrowserRunsLimit = 8;
let _autoBrowserRunsOffset = 0;
let _autoBrowserRunsTotal = 0;
const _AUTO_DESKTOP_STEP_TOKENS = ['->', '=>', '→', '⟶', '▶'];

function _autoDesktopAiStatus(message, tone = 'info') {
  const el = document.getElementById('auto-desktop-ai-status');
  if (!el) return;
  const tones = {
    info: { bg: 'rgba(0,122,255,0.08)', fg: '#007aff' },
    success: { bg: 'rgba(52,199,89,0.10)', fg: '#34c759' },
    warning: { bg: 'rgba(255,149,0,0.10)', fg: '#ff9500' },
    error: { bg: 'rgba(255,59,48,0.08)', fg: '#ff3b30' },
  };
  const palette = tones[tone] || tones.info;
  el.innerHTML = `<div style="padding:12px 14px;border-radius:12px;background:${palette.bg};color:${palette.fg};line-height:1.6;">${message}</div>`;
}

function _autoDesktopAiRenderPlan(plan) {
  const pre = document.getElementById('auto-desktop-ai-plan');
  if (!pre) return;
  if (!plan) {
    pre.style.display = 'none';
    pre.textContent = '';
    return;
  }
  const action = plan.primary_action || plan.action || {};
  const steps = Array.isArray(plan.instruction_steps) ? plan.instruction_steps : [];
  pre.style.display = 'block';
  pre.textContent =
`요약: ${plan.summary || '-'}
신뢰도: ${plan.confidence || '-'}
경고: ${plan.warning || '-'}
단계 수: ${steps.length || 1}
액션: ${action.type || 'noop'}
라벨: ${action.label || '-'}
좌표: (${action.x || 0}, ${action.y || 0})
텍스트: ${action.text || '-'}
키: ${action.key || (action.keys || []).join(' + ') || '-'}
스크롤: ${action.amount || 0}
대기: ${action.seconds || 0}
이동 시간: ${action.duration || 0}
이유: ${action.reason || '-'}`;
}

function _autoDesktopAiRenderPreview(dataUrl) {
  const img = document.getElementById('auto-desktop-ai-preview');
  const empty = document.getElementById('auto-desktop-ai-preview-empty');
  if (!img || !empty) return;
  if (!dataUrl) {
    img.style.display = 'none';
    img.removeAttribute('src');
    empty.style.display = 'block';
    return;
  }
  img.src = dataUrl;
  img.style.display = 'block';
  empty.style.display = 'none';
}

function autoDesktopAiHandleInstructionKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    autoDesktopAiQuickRun();
  }
}

function _autoDesktopAiParseInstructionSteps(text) {
  let normalized = String(text || '').trim();
  if (!normalized) return [];
  _AUTO_DESKTOP_STEP_TOKENS.forEach((token) => {
    normalized = normalized.split(token).join('\n');
  });
  normalized = normalized
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n');
  const steps = [];
  const seen = new Set();
  normalized.split('\n').forEach((raw) => {
    const item = String(raw || '')
      .replace(/^\s*(?:step\s*\d+|단계\s*\d+|[0-9]+[\).\-\:]?)\s*/i, '')
      .replace(/^-+\s*/, '')
      .trim();
    if (!item) return;
    const lowered = item.toLowerCase();
    if (seen.has(lowered)) return;
    seen.add(lowered);
    steps.push(item);
  });
  return steps.slice(0, 8);
}

function _autoDesktopAiGetInstructionContext() {
  const instruction = document.getElementById('auto-desktop-ai-instruction')?.value?.trim() || '';
  const selectedMode = document.getElementById('auto-desktop-ai-mode')?.value || 'single';
  const steps = _autoDesktopAiParseInstructionSteps(instruction);
  return {
    instruction,
    steps,
    selectedMode,
    effectiveMode: steps.length > 1 ? 'workflow' : selectedMode,
  };
}

function _autoDesktopAiBuildSequenceFromPlan(plan) {
  if (!plan) return [];
  const primary = plan.primary_action || plan.action;
  const sequence = [];
  if (primary?.type && primary.type !== 'noop') {
    sequence.push({ ...primary });
  }
  (plan.suggested_sequence || []).forEach((action) => {
    if (!action?.type || action.type === 'noop') return;
    const duplicate = sequence.some((item) =>
      item.type === action.type
      && Number(item.x || 0) === Number(action.x || 0)
      && Number(item.y || 0) === Number(action.y || 0)
      && String(item.text || '') === String(action.text || '')
      && String(item.key || '') === String(action.key || '')
      && JSON.stringify(item.keys || []) === JSON.stringify(action.keys || [])
    );
    if (!duplicate) sequence.push({ ...action });
  });
  return sequence;
}

function _autoDesktopAiItemCard(title, body, actionsHtml = '') {
  return `
    <div style="padding:10px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:rgba(0,0,0,0.02);">
      <div style="font-size:12px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">${title}</div>
      <div style="font-size:12px;line-height:1.6;color:rgba(0,0,0,0.58);white-space:pre-wrap;">${body}</div>
      ${actionsHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${actionsHtml}</div>` : ''}
    </div>
  `;
}

function _autoDesktopAiActionSummary(action) {
  if (!action) return '액션 없음';
  const text = action.text ? ` · ${String(action.text).slice(0, 24)}` : '';
  const key = action.key ? ` · ${action.key}` : '';
  const keys = action.keys?.length ? ` · ${action.keys.join(' + ')}` : '';
  return `${action.type || 'noop'} (${action.x || 0}, ${action.y || 0})${text}${key}${keys}`;
}

function _autoDesktopAiRenderObservations(plan) {
  const wrap = document.getElementById('auto-desktop-ai-observations');
  if (!wrap) return;
  const observations = plan?.observations || [];
  if (!observations.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('대기 중', '아직 분석 결과가 없습니다.');
    return;
  }
  wrap.innerHTML = observations.map((item, index) => _autoDesktopAiItemCard(`포인트 ${index + 1}`, String(item || ''))).join('');
}

function _autoDesktopAiRenderTargets(plan) {
  const wrap = document.getElementById('auto-desktop-ai-targets');
  if (!wrap) return;
  const targets = plan?.targets || [];
  if (!targets.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('대기 중', '아직 인식된 타깃이 없습니다.');
    return;
  }
  wrap.innerHTML = targets.map((target) => _autoDesktopAiItemCard(
    target.label || '타깃',
    `(${target.x}, ${target.y}) · ${target.width}×${target.height}\n${target.confidence || 'medium'}\n${target.reason || ''}`,
  )).join('');
}

function _autoDesktopAiRenderCandidates() {
  const wrap = document.getElementById('auto-desktop-ai-candidates');
  if (!wrap) return;
  const candidates = _autoDesktopAiLastPlan?.candidate_actions || [];
  if (!candidates.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('대기 중', '후보 액션이 여기에 표시됩니다.');
    return;
  }
  wrap.innerHTML = candidates.map((action, index) => _autoDesktopAiItemCard(
    index === 0 ? '주 추천 액션' : `후보 ${index + 1}`,
    `${_autoDesktopAiActionSummary(action)}\n${action.reason || ''}`,
    `<button onclick="autoDesktopAiQueueCandidate(${index})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(255,140,0,0.08);color:#ff8c00;font-size:11px;font-weight:700;cursor:pointer;">큐 추가</button>
     <button onclick="autoDesktopAiExecuteCandidate(${index})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(52,199,89,0.12);color:#34c759;font-size:11px;font-weight:700;cursor:pointer;">실행</button>`
  )).join('');
}

function _autoDesktopAiRenderQueue() {
  const wrap = document.getElementById('auto-desktop-ai-queue');
  if (!wrap) return;
  if (!_autoDesktopAiQueue.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('큐 비어 있음', '실행 큐가 비어 있습니다.');
    return;
  }
  wrap.innerHTML = _autoDesktopAiQueue.map((action, index) => _autoDesktopAiItemCard(
    `${index + 1}. ${action.label || action.type || '액션'}`,
    `${_autoDesktopAiActionSummary(action)}\n${action.reason || ''}`,
    `<button onclick="autoDesktopAiRemoveQueueItem(${index})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;font-weight:700;cursor:pointer;">삭제</button>`
  )).join('');
}

function _autoDesktopAiRenderPresets() {
  const wrap = document.getElementById('auto-desktop-ai-presets');
  if (!wrap) return;
  if (!_autoDesktopAiPresets.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('프리셋 없음', '저장된 프리셋이 없습니다.');
    return;
  }
  wrap.innerHTML = _autoDesktopAiPresets.map((preset) => _autoDesktopAiItemCard(
    preset.name || '프리셋',
    `${(preset.instruction || '').slice(0, 100)}\n사용 ${preset.use_count || 0}회`,
    `<button onclick="autoDesktopAiApplyPreset(${preset.id})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(0,122,255,0.08);color:#007aff;font-size:11px;font-weight:700;cursor:pointer;">불러오기</button>
     <button onclick="autoDesktopAiDeletePreset(${preset.id})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;font-weight:700;cursor:pointer;">삭제</button>`
  )).join('');
}

function _autoDesktopAiRenderHistory() {
  const wrap = document.getElementById('auto-desktop-ai-history');
  if (!wrap) return;
  if (!_autoDesktopAiHistory.length) {
    wrap.innerHTML = _autoDesktopAiItemCard('기록 없음', '최근 기록이 없습니다.');
    const pager = document.getElementById('auto-desktop-ai-history-pager');
    if (pager) pager.innerHTML = '';
    return;
  }
  wrap.innerHTML = _autoDesktopAiHistory.map((item) => _autoDesktopAiItemCard(
    `${item.kind || 'history'} · ${item.status || 'success'}`,
    `${item.instruction || '-'}\n${item.created_at || ''}`,
    `<button onclick="autoDesktopAiReuseHistory(${item.id})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.58);font-size:11px;font-weight:700;cursor:pointer;">다시 쓰기</button>
     <button onclick="autoDesktopAiRerunHistory(${item.id})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(52,199,89,0.12);color:#34c759;font-size:11px;font-weight:700;cursor:pointer;">재실행</button>
     <button onclick="autoDesktopAiDeleteHistory(${item.id})" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;font-weight:700;cursor:pointer;">삭제</button>`
  )).join('');
  _autoDesktopAiRenderHistoryPager();
}

function _autoDesktopAiRenderHistoryPager() {
  const pager = document.getElementById('auto-desktop-ai-history-pager');
  if (!pager) return;
  const totalPages = Math.max(1, Math.ceil((_autoDesktopAiHistoryTotal || 0) / _autoDesktopAiHistoryLimit));
  const currentPage = Math.floor(_autoDesktopAiHistoryOffset / _autoDesktopAiHistoryLimit) + 1;
  pager.innerHTML = `
    <button onclick="autoDesktopAiChangeHistoryPage(-1)" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.58);font-size:11px;font-weight:700;cursor:pointer;" ${_autoDesktopAiHistoryOffset <= 0 ? 'disabled' : ''}>이전</button>
    <div style="font-size:11px;color:rgba(0,0,0,0.45);min-width:82px;text-align:center;">${currentPage} / ${totalPages}</div>
    <button onclick="autoDesktopAiChangeHistoryPage(1)" style="padding:6px 10px;border:none;border-radius:8px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.58);font-size:11px;font-weight:700;cursor:pointer;" ${_autoDesktopAiHistoryOffset + _autoDesktopAiHistoryLimit >= _autoDesktopAiHistoryTotal ? 'disabled' : ''}>다음</button>
  `;
}

function autoDesktopAiChangeHistoryPage(direction) {
  const nextOffset = _autoDesktopAiHistoryOffset + (direction * _autoDesktopAiHistoryLimit);
  _autoDesktopAiHistoryOffset = Math.max(0, nextOffset);
  autoDesktopAiLoadHistory();
}

async function autoDesktopAiLoadStatus() {
  try {
    const res = await api('/api/automation/desktop-agent/status');
    const badge = document.getElementById('auto-desktop-ai-runtime-badge');
    const displaySelect = document.getElementById('auto-desktop-ai-display');
    if (displaySelect) {
      const current = displaySelect.value || 'all';
      displaySelect.innerHTML = (res.displays || []).map((display) => `
        <option value="${String(display.id)}">${String(display.name || display.id)}</option>
      `).join('') || '<option value="all">전체 데스크톱</option>';
      displaySelect.value = (res.displays || []).some((item) => String(item.id) === current) ? current : 'all';
    }
    const flashBtn = document.getElementById('auto-desktop-ai-display-flash-btn');
    const canFlash = Boolean(res.overlay_available) && (res.displays?.length || 0) > 1;
    if (flashBtn) flashBtn.style.display = canFlash ? '' : 'none';
    if (canFlash && !_autoDesktopAiIntroFlashed) {
      _autoDesktopAiIntroFlashed = true;
      setTimeout(() => {
        autoDesktopAiFlashDisplays({ silent: true });
      }, 250);
    }
    if (badge) {
      if (res.permissions?.post_event_access === false) {
        badge.textContent = '입력 권한 필요 · 손쉬운 사용 허용 필요';
        badge.style.background = 'rgba(255,59,48,0.08)';
        badge.style.color = '#ff3b30';
        _autoDesktopAiStatus(
          'macOS가 현재 마우스/키보드 이벤트 전송을 차단하고 있습니다.<br>시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용에서 Makeke 또는 실행 중인 Electron을 허용한 뒤 앱을 다시 열어주세요.',
          'error'
        );
      } else if (res.available) {
        badge.textContent = `준비됨 · 프리셋 ${res.preset_count} · 기록 ${res.history_count}`;
        badge.style.background = 'rgba(52,199,89,0.12)';
        badge.style.color = '#34c759';
      } else {
        const firstError = Object.values(res.import_errors || {})[0] || 'AutoController unavailable';
        badge.textContent = `준비 안 됨 · ${String(firstError).slice(0, 60)}`;
        badge.style.background = 'rgba(255,59,48,0.08)';
        badge.style.color = '#ff3b30';
      }
    }
  } catch (e) {
    const badge = document.getElementById('auto-desktop-ai-runtime-badge');
    if (badge) {
      badge.textContent = `상태 확인 실패 · ${e.message}`;
      badge.style.background = 'rgba(255,59,48,0.08)';
      badge.style.color = '#ff3b30';
    }
  }
}

async function autoDesktopAiFlashDisplays(options = {}) {
  try {
    await api('/api/automation/desktop-agent/displays/flash', {
      method: 'POST',
      body: { duration_sec: 1.8 },
    });
    if (!options?.silent) {
      toast('모니터 번호를 잠깐 표시했습니다.');
    }
  } catch (e) {
    if (!options?.silent) {
      toast('모니터 번호 표시 실패: ' + e.message, 'error');
    }
  }
}

async function autoDesktopAiLoadPresets() {
  try {
    const res = await api('/api/automation/desktop-agent/presets');
    _autoDesktopAiPresets = res.presets || [];
    _autoDesktopAiRenderPresets();
  } catch (e) {
    toast('데스크톱 프리셋 로딩 실패: ' + e.message, 'error');
  }
}

async function autoDesktopAiLoadHistory() {
  try {
    const res = await api(`/api/automation/desktop-agent/history?limit=${_autoDesktopAiHistoryLimit}&offset=${_autoDesktopAiHistoryOffset}`);
    _autoDesktopAiHistory = res.history || [];
    _autoDesktopAiHistoryTotal = Number(res.total || _autoDesktopAiHistory.length || 0);
    if (!_autoDesktopAiHistory.length && _autoDesktopAiHistoryOffset > 0 && _autoDesktopAiHistoryTotal > 0) {
      _autoDesktopAiHistoryOffset = Math.max(0, _autoDesktopAiHistoryOffset - _autoDesktopAiHistoryLimit);
      await autoDesktopAiLoadHistory();
      return;
    }
    _autoDesktopAiRenderHistory();
  } catch (e) {
    toast('데스크톱 기록 로딩 실패: ' + e.message, 'error');
  }
}

async function autoDesktopAiRerunHistory(historyId) {
  _autoDesktopAiSetExecutionState(true, '최근 기록을 다시 실행하고 있습니다.');
  try {
    await api(`/api/automation/desktop-agent/history/${historyId}/rerun`, { method: 'POST' });
    toast('좌표 자동화를 다시 실행했습니다.');
    await autoDesktopAiLoadHistory();
  } catch (e) {
    toast('재실행 실패: ' + e.message, 'error');
  } finally {
    _autoDesktopAiSetExecutionState(false);
  }
}

async function autoDesktopAiDeleteHistory(historyId) {
  const ok = await showConfirm('이 좌표 자동화 기록을 삭제할까요?');
  if (!ok) return;
  try {
    await api(`/api/automation/desktop-agent/history/${historyId}`, { method: 'DELETE' });
    toast('좌표 자동화 기록을 삭제했습니다.');
    if (_autoDesktopAiHistoryOffset > 0 && _autoDesktopAiHistoryOffset >= Math.max(0, _autoDesktopAiHistoryTotal - 1)) {
      _autoDesktopAiHistoryOffset = Math.max(0, _autoDesktopAiHistoryOffset - _autoDesktopAiHistoryLimit);
    }
    await autoDesktopAiLoadHistory();
  } catch (e) {
    toast('기록 삭제 실패: ' + e.message, 'error');
  }
}

function autoDesktopAiQueuePush(action) {
  if (!action || !action.type) return;
  _autoDesktopAiQueue.push({ ...action });
  _autoDesktopAiRenderQueue();
  _autoDesktopAiStatus(`큐에 추가됨: ${_autoDesktopAiActionSummary(action)}`, 'info');
}

function _autoDesktopAiSetExecutionState(isRunning, detail = '') {
  const ids = [
    'auto-desktop-ai-quick-run-btn',
    'auto-desktop-ai-analyze-btn',
    'auto-desktop-ai-execute-btn',
    'auto-desktop-ai-queue-btn',
    'auto-desktop-ai-sequence-btn',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isRunning) {
      el.dataset.prevDisabled = el.disabled ? '1' : '0';
      el.disabled = true;
    } else {
      el.disabled = el.dataset.prevDisabled === '1';
    }
  });
  if (isRunning) {
    _autoDesktopAiStatus(
      `지금 자동화중입니다.${detail ? `<br>${detail}` : '<br>마우스를 움직이고 클릭 또는 입력을 실행하고 있습니다.'}`,
      'warning'
    );
  }
}

function autoDesktopAiQueueCandidate(index) {
  const action = (_autoDesktopAiLastPlan?.candidate_actions || [])[index];
  if (action) autoDesktopAiQueuePush(action);
}

function autoDesktopAiQueuePrimary() {
  const action = _autoDesktopAiLastPlan?.primary_action || _autoDesktopAiLastPlan?.action;
  if (!action || action.type === 'noop') {
    _autoDesktopAiStatus('큐에 담을 추천 액션이 없습니다.', 'error');
    return;
  }
  autoDesktopAiQueuePush(action);
}

function autoDesktopAiQueueSequence() {
  const sequence = _autoDesktopAiLastPlan?.suggested_sequence || [];
  if (!sequence.length) {
    _autoDesktopAiStatus('담을 시퀀스가 없습니다. 워크플로우 모드로 다시 분석해보세요.', 'error');
    return;
  }
  sequence.forEach((action) => _autoDesktopAiQueue.push({ ...action }));
  _autoDesktopAiRenderQueue();
  _autoDesktopAiStatus(`시퀀스 ${sequence.length}개를 큐에 담았습니다.`, 'success');
}

function autoDesktopAiRemoveQueueItem(index) {
  _autoDesktopAiQueue.splice(index, 1);
  _autoDesktopAiRenderQueue();
}

function autoDesktopAiClearQueue() {
  _autoDesktopAiQueue = [];
  _autoDesktopAiRenderQueue();
}

async function autoDesktopAiAnalyze() {
  const context = _autoDesktopAiGetInstructionContext();
  const instruction = context.instruction;
  const analyzeBtn = document.getElementById('auto-desktop-ai-analyze-btn');
  const executeBtn = document.getElementById('auto-desktop-ai-execute-btn');
  const quickRunBtn = document.getElementById('auto-desktop-ai-quick-run-btn');
  const queueBtn = document.getElementById('auto-desktop-ai-queue-btn');
  const sequenceBtn = document.getElementById('auto-desktop-ai-sequence-btn');
  const mode = context.effectiveMode;
  const maxCandidates = parseInt(document.getElementById('auto-desktop-ai-max-candidates')?.value || '3', 10) || 3;
  const displayId = document.getElementById('auto-desktop-ai-display')?.value || 'all';
  if (!instruction) {
    _autoDesktopAiStatus('먼저 Gemini에게 시킬 명령을 입력하세요.', 'error');
    return;
  }

  _autoDesktopAiLastPlan = null;
  _autoDesktopAiRenderPlan(null);
  _autoDesktopAiRenderObservations(null);
  _autoDesktopAiRenderTargets(null);
  _autoDesktopAiRenderCandidates();
  executeBtn.disabled = true;
  if (quickRunBtn) quickRunBtn.disabled = true;
  if (queueBtn) queueBtn.disabled = true;
  if (sequenceBtn) sequenceBtn.disabled = true;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '분석 중...';
  _autoDesktopAiStatus(
    context.steps.length > 1
      ? `현재 화면을 캡처하고 ${context.steps.length}단계 명령을 순서대로 해석하고 있습니다.`
      : '현재 데스크톱 화면을 캡처하고 다음 한 단계를 분석하고 있습니다.',
    'info'
  );

  try {
    const res = await api('/api/automation/desktop-agent/analyze', {
      method: 'POST',
      body: {
        instruction,
        mode,
        max_candidates: Math.max(1, Math.min(maxCandidates, 5)),
        display_id: displayId,
        preset_id: _autoDesktopAiPresetId,
      }
    });
    _autoDesktopAiLastPlan = res.plan || null;
    _autoDesktopAiRenderPlan(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderObservations(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderTargets(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderCandidates();
    _autoDesktopAiRenderPreview(res.preview_data_url || '');
    const primaryAction = _autoDesktopAiLastPlan?.primary_action || _autoDesktopAiLastPlan?.action;
    if (primaryAction?.type && primaryAction.type !== 'noop') {
      executeBtn.disabled = false;
      if (quickRunBtn) quickRunBtn.disabled = false;
      if (queueBtn) queueBtn.disabled = false;
    }
    if (sequenceBtn) sequenceBtn.disabled = !((_autoDesktopAiLastPlan?.suggested_sequence || []).length);
    const tone = _autoDesktopAiLastPlan?.confidence === 'high'
      ? 'success'
      : (_autoDesktopAiLastPlan?.confidence === 'medium' ? 'warning' : 'info');
    const sequence = _autoDesktopAiBuildSequenceFromPlan(_autoDesktopAiLastPlan);
    _autoDesktopAiStatus(
      `제안 액션: <strong>${primaryAction?.type || 'noop'}</strong>${sequence.length > 1 ? ` · 총 ${sequence.length}단계` : ''}<br>` +
      `${_autoDesktopAiLastPlan?.summary || '요약 없음'}${_autoDesktopAiLastPlan?.warning ? `<br>주의: ${_autoDesktopAiLastPlan.warning}` : ''}`,
      tone,
    );
    autoDesktopAiLoadStatus();
    autoDesktopAiLoadHistory();
  } catch (e) {
    _autoDesktopAiRenderPreview('');
    _autoDesktopAiStatus(`화면 분석 실패: ${e.message}`, 'error');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = '분석만';
    if (quickRunBtn) quickRunBtn.disabled = false;
  }
}

async function autoDesktopAiExecuteCandidate(index) {
  const action = (_autoDesktopAiLastPlan?.candidate_actions || [])[index];
  if (!action) return;
  await autoDesktopAiExecuteAction(action);
}

async function autoDesktopAiExecuteAction(action) {
  if (!action || action.type === 'noop') {
    _autoDesktopAiStatus('실행할 액션이 없습니다.', 'error');
    return;
  }
  _autoDesktopAiSetExecutionState(true, `제안 액션 ${action.type}을 실행하고 있습니다.`);
  try {
    const res = await api('/api/automation/desktop-agent/execute', {
      method: 'POST',
      body: {
        instruction: document.getElementById('auto-desktop-ai-instruction')?.value?.trim() || '',
        action,
        preset_id: _autoDesktopAiPresetId,
      }
    });
    _autoDesktopAiStatus(`실행 완료: ${res.message || action.type}`, res.executed_count ? 'success' : 'warning');
    autoDesktopAiLoadStatus();
    autoDesktopAiLoadHistory();
  } catch (e) {
    _autoDesktopAiStatus(`실행 실패: ${e.message}`, 'error');
  } finally {
    _autoDesktopAiSetExecutionState(false);
  }
}

async function autoDesktopAiExecuteSuggested() {
  const executeBtn = document.getElementById('auto-desktop-ai-execute-btn');
  const action = _autoDesktopAiLastPlan?.primary_action || _autoDesktopAiLastPlan?.action;
  if (!action || action.type === 'noop') {
    _autoDesktopAiStatus('실행할 제안 액션이 없습니다. 먼저 화면 분석을 실행하세요.', 'error');
    executeBtn.disabled = true;
    return;
  }
  executeBtn.disabled = true;
  executeBtn.textContent = '실행 중...';
  try {
    await autoDesktopAiExecuteAction(action);
  } catch (e) {
    _autoDesktopAiStatus(`실행 실패: ${e.message}`, 'error');
  } finally {
    executeBtn.disabled = false;
    executeBtn.textContent = '한 단계 실행';
  }
}

async function autoDesktopAiQuickRun() {
  const btn = document.getElementById('auto-desktop-ai-quick-run-btn');
  const context = _autoDesktopAiGetInstructionContext();
  if (!context.instruction) {
    _autoDesktopAiStatus('먼저 실행할 명령을 입력하세요.', 'error');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '준비 중...';
  }
  try {
    await autoDesktopAiAnalyze();
    const sequence = _autoDesktopAiBuildSequenceFromPlan(_autoDesktopAiLastPlan);
    if (!sequence.length) {
      _autoDesktopAiStatus('자동으로 이어서 실행할 단계가 없습니다. 화면을 다시 확인해주세요.', 'error');
      return;
    }
    _autoDesktopAiQueue = sequence.map((action) => ({ ...action }));
    _autoDesktopAiRenderQueue();
    _autoDesktopAiStatus(`지금 자동화중입니다.<br>준비된 ${sequence.length}단계를 순서대로 실행합니다.`, 'warning');
    await autoDesktopAiRunQueue(false);
  } catch (e) {
    _autoDesktopAiStatus(`한 번에 실행 실패: ${e.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '한 번에 실행';
    }
  }
}

async function autoDesktopAiRunQueue(dryRun = false) {
  if (!_autoDesktopAiQueue.length) {
    _autoDesktopAiStatus('실행 큐가 비어 있습니다.', 'error');
    return;
  }
  const label = dryRun ? '드라이런' : '시나리오 실행';
  if (dryRun) {
    _autoDesktopAiStatus(`${label} 준비 중...`, 'info');
  } else {
    _autoDesktopAiSetExecutionState(true, `준비된 ${_autoDesktopAiQueue.length}단계를 순서대로 실행하고 있습니다.`);
  }
  try {
    const res = await api('/api/automation/desktop-agent/execute', {
      method: 'POST',
      body: {
        instruction: document.getElementById('auto-desktop-ai-instruction')?.value?.trim() || '',
        actions: _autoDesktopAiQueue,
        dry_run: !!dryRun,
        stop_on_error: true,
        preset_id: _autoDesktopAiPresetId,
      }
    });
    _autoDesktopAiStatus(
      `${label} 완료: ${res.executed_count}/${res.total_steps} 실행${res.error_count ? ` · 오류 ${res.error_count}` : ''}`,
      res.error_count ? 'warning' : 'success',
    );
    if (!dryRun && !res.error_count) autoDesktopAiClearQueue();
    autoDesktopAiLoadStatus();
    autoDesktopAiLoadHistory();
  } catch (e) {
    _autoDesktopAiStatus(`${label} 실패: ${e.message}`, 'error');
  } finally {
    if (!dryRun) _autoDesktopAiSetExecutionState(false);
  }
}

async function autoDesktopAiSavePreset() {
  const instruction = document.getElementById('auto-desktop-ai-instruction')?.value?.trim();
  const queuedActions = Array.isArray(_autoDesktopAiQueue) ? _autoDesktopAiQueue.map((action) => ({ ...action })) : [];
  if (!instruction && !queuedActions.length) {
    _autoDesktopAiStatus('시나리오로 저장할 명령 또는 큐를 준비하세요.', 'error');
    return;
  }
  const suggestedName = (instruction || '좌표 자동화 시나리오').slice(0, 24);
  const name = await showInputDialog('시나리오 이름', '이름을 입력하세요', suggestedName);
  if (!name || !name.trim()) return;
  try {
    await api('/api/automation/desktop-agent/presets', {
      method: 'POST',
      body: {
        name: name.trim(),
        instruction,
        notes: '',
        actions: queuedActions,
      }
    });
    toast(queuedActions.length ? `시나리오 저장 완료 (${queuedActions.length}단계)` : '명령 저장 완료');
    autoDesktopAiLoadPresets();
    autoDesktopAiLoadStatus();
  } catch (e) {
    _autoDesktopAiStatus(`시나리오 저장 실패: ${e.message}`, 'error');
  }
}

function autoDesktopAiApplyPreset(presetId) {
  const preset = _autoDesktopAiPresets.find((item) => item.id === presetId);
  if (!preset) return;
  _autoDesktopAiPresetId = presetId;
  const input = document.getElementById('auto-desktop-ai-instruction');
  if (input) input.value = preset.instruction || '';
  _autoDesktopAiQueue = Array.isArray(preset.actions_json) ? preset.actions_json.map((action) => ({ ...action })) : [];
  _autoDesktopAiRenderQueue();
  const stepCount = _autoDesktopAiQueue.length;
  _autoDesktopAiStatus(
    stepCount
      ? `시나리오 적용: ${preset.name} · ${stepCount}단계 복원`
      : `명령 적용: ${preset.name}`,
    'success'
  );
}

async function autoDesktopAiDeletePreset(presetId) {
  const ok = await showConfirm('이 프리셋을 삭제할까요?');
  if (!ok) return;
  try {
    await api(`/api/automation/desktop-agent/presets/${presetId}`, { method: 'DELETE' });
    if (_autoDesktopAiPresetId === presetId) _autoDesktopAiPresetId = 0;
    autoDesktopAiLoadPresets();
    autoDesktopAiLoadStatus();
  } catch (e) {
    _autoDesktopAiStatus(`프리셋 삭제 실패: ${e.message}`, 'error');
  }
}

function autoDesktopAiReuseHistory(historyId) {
  const history = _autoDesktopAiHistory.find((item) => item.id === historyId);
  if (!history) return;
  const result = history.result_json || {};
  const payload = history.payload_json || {};
  const plan = result.plan || {};
  const action = plan.primary_action || plan.action || result.results?.[0]?.action;
  const input = document.getElementById('auto-desktop-ai-instruction');
  if (input) input.value = history.instruction || payload.instruction || '';
  if (action) {
    _autoDesktopAiLastPlan = {
      summary: plan.summary || history.instruction || '히스토리에서 불러온 액션',
      confidence: plan.confidence || 'medium',
      warning: plan.warning || '',
      observations: plan.observations || [],
      targets: plan.targets || [],
      primary_action: action,
      candidate_actions: plan.candidate_actions || [action],
      suggested_sequence: plan.suggested_sequence || [],
      action,
    };
    _autoDesktopAiRenderPlan(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderObservations(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderTargets(_autoDesktopAiLastPlan);
    _autoDesktopAiRenderCandidates();
    const executeBtn = document.getElementById('auto-desktop-ai-execute-btn');
    const queueBtn = document.getElementById('auto-desktop-ai-queue-btn');
    const sequenceBtn = document.getElementById('auto-desktop-ai-sequence-btn');
    if (executeBtn) executeBtn.disabled = action.type === 'noop';
    if (queueBtn) queueBtn.disabled = action.type === 'noop';
    if (sequenceBtn) sequenceBtn.disabled = !((_autoDesktopAiLastPlan?.suggested_sequence || []).length);
  }
  _autoDesktopAiStatus('최근 기록을 다시 불러왔습니다.', 'info');
}

async function autoMacroRecord() {
  if (_macroRecording) return;
  try {
    await api('/api/automation/macro/record/start', { method: 'POST' });
    _macroRecording = true;
    document.getElementById('auto-macro-record-btn').style.display = 'none';
    document.getElementById('auto-macro-stop-btn').style.display = '';
    toast('매크로 녹화 시작! 작업을 수행하세요.');
  } catch (e) { toast('녹화 시작 실패: ' + e.message, 'error'); }
}

async function autoMacroStop() {
  const name = prompt('매크로 이름을 입력하세요:');
  if (!name) return;
  try {
    await api('/api/automation/macro/record/stop', { method: 'POST', body: { name } });
    _macroRecording = false;
    document.getElementById('auto-macro-record-btn').style.display = '';
    document.getElementById('auto-macro-stop-btn').style.display = 'none';
    toast('매크로 저장 완료!');
    autoLoadMacros();
  } catch (e) { toast('녹화 중지 실패: ' + e.message, 'error'); }
}

async function autoLoadMacros() {
  const el = document.getElementById('auto-macro-list');
  try {
    const res = await api('/api/automation/macro/list');
    const macros = res.macros || [];
    if (!macros.length) { el.textContent = '저장된 매크로가 없습니다.'; return; }
    el.innerHTML = macros.map(m => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,0,0,0.02);border-radius:8px;margin-bottom:6px;">
        <span style="flex:1;font-weight:600;">${m.name || m.filename || m}</span>
        <button onclick="autoPlayMacro('${m.filename || m}')" style="padding:4px 12px;background:#007aff;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">재생</button>
        <button onclick="autoDeleteMacro('${m.filename || m}')" style="padding:4px 12px;background:#ff3b30;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;">삭제</button>
      </div>
    `).join('');
  } catch { if (el) el.innerHTML = '<div style="padding:12px;background:rgba(0,0,0,0.02);border-radius:8px;color:rgba(0,0,0,0.35);">매크로 모듈을 사용하려면 <code>pip install pyautogui</code>를 실행하세요.</div>'; }
}

async function autoPlayMacro(filename) {
  try {
    toast('매크로 재생 중...');
    await api('/api/automation/macro/play', { method: 'POST', body: { filename } });
    toast('매크로 재생 완료!');
  } catch (e) { toast('재생 실패: ' + e.message, 'error'); }
}

async function autoDeleteMacro(filename) {
  if (!confirm('이 매크로를 삭제할까요?')) return;
  try {
    await api(`/api/automation/macro/${filename}`, { method: 'DELETE' });
    toast('매크로 삭제됨');
    autoLoadMacros();
  } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
}

async function autoScreenshot() {
  const el = document.getElementById('auto-util-result');
  try {
    const res = await api('/api/automation/screenshot', { method: 'POST', body: {} });
    el.style.display = 'block';
    el.textContent = `스크린샷 저장: ${res.filename}`;
    toast('스크린샷 완료!');
  } catch (e) { toast('스크린샷 실패: ' + e.message, 'error'); }
}

async function autoMousePosition() {
  const el = document.getElementById('auto-util-result');
  try {
    const res = await api('/api/automation/mouse-position');
    el.style.display = 'block';
    el.textContent = `마우스 위치: x=${res.x}, y=${res.y}`;
  } catch (e) { toast('위치 확인 실패: ' + e.message, 'error'); }
}

async function autoExcelProcess() {
  const filePath = document.getElementById('auto-excel-path')?.value?.trim();
  if (!filePath) { toast('엑셀 파일 경로를 입력하세요', 'error'); return; }
  try {
    await api('/api/automation/office/excel/process', { method: 'POST', body: { file_path: filePath, operations: [] } });
    toast('엑셀 처리 완료!');
  } catch (e) { toast('처리 실패: ' + e.message, 'error'); }
}

// 자동화 페이지 진입 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    if (document.getElementById('page-browser-auto')?.classList.contains('active')) {
      autoLoadMacros();
      autoInitBrowserPage();
    } else if (document.getElementById('page-desktop-agent')?.classList.contains('active')) {
      autoInitDesktopAgentPage();
    } else if (_autoBrowserStatusPolling) {
      clearInterval(_autoBrowserStatusPolling);
      _autoBrowserStatusPolling = null;
    }
  });
  const main = document.querySelector('.main');
  if (main) observer.observe(main, { subtree: true, attributeFilter: ['class'] });
});

// ═══ 자동 전략 스케줄 ═══
async function loadAutoSchedules() {
  const container = document.getElementById('auto-schedule-list');
  if (!container) return;
  try {
    const res = await api('/api/auto-schedule');
    const list = res.schedules || [];
    if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.3);font-size:12px;">스케줄이 없습니다. "추가"를 눌러 자동 전략을 예약하세요.</div>'; return; }
    container.innerHTML = list.map(s => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(0,0,0,0.02);border-radius:10px;margin-bottom:6px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${s.enabled ? '#34c759' : 'rgba(0,0,0,0.15)'};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#1c1c1e;">${escapeHtml(s.profile_name || '프로필')} <span style="font-weight:400;color:rgba(0,0,0,0.35);">(${escapeHtml(s.business_type || '')})</span></div>
          <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:2px;">하루 ${s.times_per_day}회 · ${escapeHtml(s.schedule_times)} ${s.last_run ? '· 마지막: ' + s.last_run.slice(5,16) : ''}</div>
        </div>
        <label style="position:relative;width:40px;height:22px;cursor:pointer;">
          <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSchedule(${s.id}, this.checked)" style="opacity:0;position:absolute;">
          <span style="position:absolute;inset:0;border-radius:11px;background:${s.enabled ? '#34c759' : 'rgba(0,0,0,0.15)'};transition:0.2s;"></span>
          <span style="position:absolute;top:2px;left:${s.enabled ? '20px' : '2px'};width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:0.2s;"></span>
        </label>
        <button onclick="deleteSchedule(${s.id})" style="background:none;border:none;color:rgba(0,0,0,0.2);cursor:pointer;font-size:16px;padding:0 4px;">×</button>
      </div>
    `).join('');
  } catch {}
}

async function showAddScheduleModal() {
  if (!window._globalProfileId) { toast('먼저 프로필을 선택하세요', 'error'); return; }

  let modal = document.getElementById('add-schedule-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'add-schedule-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';

  // 프로필 목록 가져오기
  let profileOptions = '';
  try {
    const res = await api('/api/library/profiles');
    const profiles = Array.isArray(res) ? res : (res.profiles || []);
    profileOptions = profiles.map(p =>
      `<option value="${p.id}" ${String(p.id) === String(window._globalProfileId) ? 'selected' : ''}>${p.name} (${p.business_type || ''})</option>`
    ).join('');
  } catch {}

  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;padding:28px;width:440px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="font-size:16px;margin:0 0 16px;">새 자동 스케줄 추가</h3>

      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;">프로필</div>
        <select id="sched-profile" style="width:100%;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
          ${profileOptions}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;">하루 실행 횟수</div>
          <select id="sched-times" style="width:100%;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
            <option value="1" selected>1회</option>
            <option value="2">2회</option>
            <option value="3">3회</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;">첫 번째 실행 시간</div>
          <input type="time" id="sched-time" value="09:00" style="width:100%;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
        </div>
      </div>

      <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-bottom:16px;line-height:1.6;">
        설정한 시간에 AI가 자동으로:<br>
        트렌드 분석 → 뉴스 선택 → 블로그/카드뉴스/영상 생성 → 발행
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('add-schedule-modal').remove()" style="padding:8px 16px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
        <button onclick="doAddSchedule()" style="padding:8px 18px;background:#ff8c00;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">추가</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function doAddSchedule() {
  const profileId = document.getElementById('sched-profile')?.value;
  const times = parseInt(document.getElementById('sched-times')?.value || '1');
  const time = document.getElementById('sched-time')?.value || '09:00';
  if (!profileId) { toast('프로필을 선택하세요', 'error'); return; }
  try {
    const res = await api('/api/auto-schedule', {
      method: 'POST',
      body: { profile_id: parseInt(profileId), times_per_day: times, schedule_times: time },
    });
    toast(`스케줄 추가 완료! 실행 시간: ${res.schedule_times || time}`);
    document.getElementById('add-schedule-modal')?.remove();
    loadAutoSchedules();
  } catch (e) { toast('실패: ' + e.message, 'error'); }
}

async function toggleSchedule(id, enabled) {
  await api(`/api/auto-schedule/${id}`, { method: 'PUT', body: { enabled } });
  loadAutoSchedules();
}

async function deleteSchedule(id) {
  if (!confirm('이 스케줄을 삭제할까요?')) return;
  await api(`/api/auto-schedule/${id}`, { method: 'DELETE' });
  loadAutoSchedules();
}

// 원클릭 자동 기능 제거 이후에는 백그라운드 스케줄 폴링을 돌리지 않는다.
// 이전 interval이 중복 등록되면 /api/auto-schedule 요청이 과하게 쌓여 서버가 재시작되는 것처럼 보일 수 있었다.
if (window._autoSchedulePollInterval) {
  clearInterval(window._autoSchedulePollInterval);
  window._autoSchedulePollInterval = null;
}

// 페이지 로드 시 스케줄 목록 표시
document.addEventListener('DOMContentLoaded', () => setTimeout(loadAutoSchedules, 2000));
