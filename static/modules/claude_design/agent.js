// Claude 디자인 — 에이전트 라우터(생성/편집/향상/비평/CLI) + 슬라이더/내보내기/저장/초기화
(function () {
  'use strict';

  const CD_CREATE_PLACEHOLDER = '무엇을 만들지 자세히 입력하세요. 옵션 버튼을 누르면 상세 템플릿이 들어갑니다. (Enter 전송 · Shift+Enter 줄바꿈)\n💡 참고 이미지는 이 입력창 또는 오른쪽 캔버스에 드래그드랍 · 붙여넣기 가능';
  const CD_EDIT_PLACEHOLDER = '수정할 내용을 채팅처럼 입력하세요. 예: 제목을 더 짧게, CTA를 크게, 2번째 장 색을 더 밝게. (Enter 전송 · Shift+Enter 줄바꿈)';
  const CD_SEND_IDLE_HTML = '<span>전송</span><span style="font-size:18px;line-height:1;">↗</span>';
  const CD_SEND_BUSY_HTML = '<span class="spinner" style="display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></span><span>생성 중...</span>';
  const CD_DEFAULT_ASPECT = '16:9';
  let _cdActiveAbortController = null;

  function _setSendButtonState(button, busy) {
    if (!button) return;
    button.disabled = !!busy;
    button.innerHTML = busy ? CD_SEND_BUSY_HTML : CD_SEND_IDLE_HTML;
    if (!busy) cdUpdateSendAvailability();
  }

  function _setDesignInputMode(input, isEditingResult) {
    if (!input) return;
    input.placeholder = isEditingResult ? CD_EDIT_PLACEHOLDER : CD_CREATE_PLACEHOLDER;
    input.rows = isEditingResult ? 3 : 12;
    if (isEditingResult) {
      input.style.setProperty('min-height', '68px', 'important');
      input.style.setProperty('height', '88px', 'important');
      input.style.setProperty('max-height', '140px', 'important');
    } else {
      input.style.removeProperty('min-height');
      input.style.removeProperty('height');
      input.style.removeProperty('max-height');
    }
  }

  const CD_OPTIONAL_CREATE_FIELDS = [
    { id: 'cd-kind', label: '유형' },
    { id: 'cd-style', label: '스타일' },
    { id: 'cd-purpose', label: '목적' },
    { id: 'cd-density', label: '밀도' },
    { id: 'cd-aspect', label: '크기' },
  ];

  function _isCodingProviderMode() {
    return document.getElementById('cd-mode-badge')?.style.display === 'inline-flex';
  }

  function _getSendMissingFields() {
    const input = document.getElementById('cd-input');
    const missing = [];
    if (!((input?.value || '').trim())) missing.push({ id: 'cd-input', label: '설명' });
    return missing;
  }

  function _focusMissingField(field) {
    if (!field) return;
    if (field.id === 'cd-input') {
      document.getElementById('cd-input')?.focus();
      return;
    }
    if (field.id === 'cd-kind') {
      document.querySelector('#page-claude-design select#cd-kind-picker')?.focus?.();
      return;
    }
    if (field.id === 'cd-aspect') {
      document.querySelector('#cd-chat-aspect-buttons [data-chat-aspect], #cd-aspect-group [data-aspect]')?.focus?.();
      return;
    }
    const option = document.querySelector(`.cd-option-btn[data-target="${field.id}"]`);
    option?.focus?.();
  }

  function cdUpdateSendAvailability() {
    const button = document.getElementById('cd-send-btn');
    const help = document.getElementById('cd-send-help');
    if (!button) return false;
    if (window._cdDesignBusy) {
      button.disabled = true;
      if (help) help.textContent = '생성 또는 수정이 끝나면 다시 전송할 수 있습니다.';
      return false;
    }
    const missing = _getSendMissingFields();
    const ready = missing.length === 0;
    button.disabled = !ready;
    button.style.cursor = ready ? 'pointer' : 'not-allowed';
    button.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (help) {
      help.textContent = ready
        ? (_lastHtml ? '수정 내용을 전송할 수 있습니다.' : '설명이 준비되었습니다. 아래 옵션은 선택하면 방향만 더 정확해집니다.')
        : '무엇을 만들지 설명을 입력하면 바로 전송할 수 있습니다. 아래 옵션은 선택 사항입니다.';
    }
    return ready;
  }
  window.cdUpdateSendAvailability = cdUpdateSendAvailability;
  window.cdMarkDesignOptionSelected = cdUpdateSendAvailability;

  function cdValidateSendReadiness(showFeedback) {
    const missing = _getSendMissingFields();
    cdUpdateSendAvailability();
    if (!missing.length) return true;
    if (showFeedback) {
      const labels = missing.map(item => item.label).join(', ');
      if (typeof toast === 'function') toast(`전송 전에 다음 항목을 완료해주세요: ${labels}`, 'warning');
      _focusMissingField(missing[0]);
    }
    return false;
  }

  function cdResetDesignRequiredOptions() {
    CD_OPTIONAL_CREATE_FIELDS.forEach((field) => {
      const el = document.getElementById(field.id);
      if (el) el.value = field.id === 'cd-aspect' ? CD_DEFAULT_ASPECT : '';
    });
    document.querySelectorAll('#page-claude-design select#cd-kind-picker, #page-claude-design select[onchange*="cdSetDesignOptionValue"], #page-claude-design select[onchange*="cdSetAspect"]').forEach((select) => {
      select.value = '';
    });
    document.querySelectorAll('.cd-kind-btn:not(.cd-format-group-btn):not([data-cd-insert-mode]), .cd-option-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#cd-chat-aspect-buttons [data-chat-aspect], #cd-aspect-group [data-aspect]').forEach((btn) => {
      btn.style.background = 'transparent';
      btn.style.color = 'rgba(0,0,0,0.5)';
      btn.style.boxShadow = 'none';
    });
    if (typeof window.cdSetAspect === 'function') window.cdSetAspect(CD_DEFAULT_ASPECT);
    cdUpdateSendAvailability();
  }
  window.cdResetDesignRequiredOptions = cdResetDesignRequiredOptions;

  // ─── E. AI 디자인 비평 ──────────────────────────────────────
  async function cdCritique() {
    if (!_lastHtml) {
      if (typeof toast === 'function') toast('먼저 디자인을 생성하세요');
      return;
    }
    const statusMsg = _addChatMessage('status', '🔍 디자인 비평 분석 중...');
    try {
      const { provider, model } = _parseProvider(document.getElementById('cd-provider')?.value);
      const res = await fetch('/api/claude-design/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: _lastHtml, provider, model }),
      });
      const data = await res.json();
      if (data.error_code) {
        if (statusMsg) statusMsg.textContent = data.message || '비평 실패';
        return;
      }
      if (data.status === 'ok' && Array.isArray(data.suggestions)) {
        if (statusMsg) statusMsg.textContent = `🔍 ${data.suggestions.length}개 개선안`;
        const html = data.suggestions.map((s, i) => `
          <div style="margin-top:6px;padding:8px;background:rgba(255,140,0,0.04);border-left:3px solid #ff8c00;border-radius:6px;">
            <div style="font-size:11px;font-weight:800;color:#ff6b00;">#${i + 1} ${_esc(s.title || '개선안')}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.7);margin-top:3px;">${_esc(s.detail || '')}</div>
            <button type="button" onclick="cdQuickAction('${_esc((s.title || '') + ': ' + (s.action || s.detail || '')).replace(/'/g, '&#39;')}');setTimeout(cdSendMessage,200)" style="margin-top:5px;padding:3px 9px;font-size:10px;font-weight:700;border:none;background:#ff8c00;color:#fff;border-radius:999px;cursor:pointer;">⚡ 적용</button>
          </div>`).join('');
        _addChatMessage('ai', html, { html: true });
      } else {
        if (statusMsg) statusMsg.textContent = '비평 응답이 비었습니다';
      }
    } catch (e) {
      if (statusMsg) statusMsg.textContent = '비평 실패: ' + (e?.message || e);
    }
  }
  window.cdCritique = cdCritique;

  async function cdAutoImprove() {
    if (!_lastHtml) {
      if (typeof toast === 'function') toast('먼저 디자인을 생성하세요', 'warning');
      return;
    }
    const instruction = '현재 디자인을 자동으로 한 단계 개선해줘. 레이아웃 정렬, 여백, 타이포 위계, 색 대비, CTA 가독성, 이미지 배치, 여러 장이면 장별 흐름을 더 자연스럽게 정리해줘. 사용자가 요청한 장수와 형식은 유지해줘.';
    const statusMsg = _addChatMessage('status', '🤖 자동 변경 생성 중...');
    try {
      await _runWithDesignBusy('자동 변경안을 생성하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', (signal) => _agentEdit(instruction, signal));
      if (statusMsg) statusMsg.textContent = '✓ 자동 변경 반영 완료';
    } catch (e) {
      if (statusMsg) statusMsg.textContent = '자동 변경 실패: ' + (e?.message || e);
    }
  }
  window.cdAutoImprove = cdAutoImprove;

  // ─── 에이전트 라우터 ─────────────────────────────────────────
  async function cdSendMessage() {
    const input = document.getElementById('cd-input');
    const btn = document.getElementById('cd-send-btn');
    const text = (input?.value || '').trim();
    if (!cdValidateSendReadiness(true)) return;

    _enterChatStarted(!_lastHtml);
    _addChatMessage('user', text);
    if (input) input.value = '';
    _setSendButtonState(btn, true);

    // 디자인 코딩 에이전트 모드면 CLI 라우팅
    const codingMode = _isCodingProviderMode();
    if (codingMode) {
      try {
        await _runWithDesignBusy('CLI 실행 중입니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', (signal) => _agentCodingCli(text, signal));
      } catch (e) {
        _addChatMessage('error', 'CLI 실행 실패: ' + (e?.message || e));
      } finally {
        _setSendButtonState(btn, false);
      }
      return;
    }

    try {
      const lower = text.toLowerCase();
      const wantsImages = /이미지|사진|illustration|photo|placeholder|nano.?banana|바나나/i.test(text);
      const hasHtml = !!_lastHtml;

      if (hasHtml && wantsImages) {
        await _runWithDesignBusy('이미지를 생성하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', (signal) => _agentEnhanceImages(signal));
      } else if (hasHtml) {
        if (_tryFastSelectedEdit(text)) return;
        // 기존 디자인 편집
        await _runWithDesignBusy('수정안을 생성하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', (signal) => _agentEdit(text, signal));
      } else {
        // 새 디자인 생성 — 짧은 입력도 프로필/기본 옵션으로 보완해 바로 생성합니다.
        await _runWithDesignBusy('디자인을 생성하고 있습니다. 여러 장이면 순서대로 조립 중입니다.', (signal) => _agentGenerate(text, signal));
      }
    } catch (e) {
      _addChatMessage('error', '처리 실패: ' + (e?.message || e));
    } finally {
      _setSendButtonState(btn, false);
    }
  }
  window.cdSendMessage = cdSendMessage;

  async function cdRunSelectedAIEdit(request) {
    const instruction = String(request || '').trim();
    if (!instruction) {
      if (typeof toast === 'function') toast('AI에게 맡길 수정 내용을 입력해주세요.', 'warning');
      return;
    }
    if (!_lastHtml) {
      if (typeof toast === 'function') toast('먼저 디자인을 생성하세요.', 'warning');
      return;
    }
    if (!_selectedElement?.selector) {
      if (typeof toast === 'function') toast('수정할 요소를 먼저 선택하세요.', 'warning');
      return;
    }
    const panel = document.getElementById('cd-selected-text-editor');
    const aiInput = panel?.querySelector('#cd-selected-ai-request');
    const button = panel?.querySelector('[data-cd-selected-ai-send]');
    if (aiInput) aiInput.disabled = true;
    if (button) {
      button.disabled = true;
      button.textContent = '수정 중...';
    }
    _addChatMessage('user', `선택 요소 AI 수정: ${instruction}`);
    try {
      await _runWithDesignBusy('선택한 요소를 AI로 수정하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', async (signal) => {
        if (!_tryFastSelectedEdit(instruction)) {
          await _agentEdit(instruction, signal);
        }
      });
      document.getElementById('cd-selected-text-editor')?.remove();
    } catch (e) {
      _addChatMessage('error', '선택 요소 AI 수정 실패: ' + (e?.message || e));
      if (aiInput) aiInput.disabled = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'AI로 수정';
      }
    }
  }
  window.cdRunSelectedAIEdit = cdRunSelectedAIEdit;

  function cdToggleGlobalAIEdit(force) {
    const panel = document.getElementById('cd-global-edit-panel');
    const input = document.getElementById('cd-global-edit-input');
    if (!panel) return;
    const nextOpen = typeof force === 'boolean' ? force : panel.style.display === 'none';
    panel.style.display = nextOpen ? 'flex' : 'none';
    if (nextOpen) {
      if (typeof cdClearSelection === 'function') cdClearSelection();
      requestAnimationFrame(() => input?.focus());
    }
  }
  window.cdToggleGlobalAIEdit = cdToggleGlobalAIEdit;

  async function cdRunGlobalAIEdit() {
    const input = document.getElementById('cd-global-edit-input');
    const button = document.getElementById('cd-global-edit-send');
    const instruction = (input?.value || '').trim();
    if (!instruction) {
      if (typeof toast === 'function') toast('전체 수정 내용을 입력해주세요.', 'warning');
      return;
    }
    if (!_lastHtml) {
      if (typeof toast === 'function') toast('먼저 디자인을 생성하세요.', 'warning');
      return;
    }
    const previousSelection = _selectedElement;
    _selectedElement = null;
    if (typeof window._updateInlineEditChip === 'function') window._updateInlineEditChip();
    if (input) input.disabled = true;
    if (button) {
      button.disabled = true;
      button.textContent = '수정 중...';
    }
    _addChatMessage('user', `전체 AI 수정: ${instruction}`);
    try {
      await _runWithDesignBusy('전체 디자인을 AI로 수정하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.', (signal) => _agentEdit(instruction, signal));
      if (input) input.value = '';
      cdToggleGlobalAIEdit(false);
    } catch (e) {
      _selectedElement = previousSelection;
      _addChatMessage('error', '전체 AI 수정 실패: ' + (e?.message || e));
    } finally {
      if (input) input.disabled = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'AI로 전체 수정';
      }
    }
  }
  window.cdRunGlobalAIEdit = cdRunGlobalAIEdit;

  function _enterChatStarted(showPreviewShell) {
    const page = document.getElementById('page-claude-design');
    if (page) page.classList.add('cd-chat-started');
    const dock = document.getElementById('cd-chat-dock');
    if (dock) {
      dock.style.display = 'flex';
      dock.style.left = '';
      dock.style.top = '';
      dock.style.right = '';
      dock.style.bottom = '';
    }
    if (showPreviewShell) _showPreviewShell();
  }

  function _tryFastSelectedEdit(instruction) {
    if (!_selectedElement?.selector) return false;
    const doc = document.getElementById('cd-preview')?.contentDocument;
    if (!doc) return false;
    let target = null;
    try { target = doc.querySelector(_selectedElement.selector); } catch (_) {}
    if (!target) return false;
    const text = String(instruction || '').trim();
    const lower = text.toLowerCase();
    const tag = (target.tagName || '').toLowerCase();
    const isImage = tag === 'img';

    if (/삭제|지워|없애|remove|delete/i.test(text)) {
      if (typeof cdDeleteSelectedElement === 'function') {
        cdDeleteSelectedElement();
        _addChatMessage('ai', '선택한 요소를 삭제했습니다.');
        return true;
      }
    }

    if (isImage) {
      if (/교체|바꿔|replace|이미지|사진/i.test(text)) {
        if (/ai|인공지능|생성/i.test(lower) && typeof cdAIReplaceSelectedImage === 'function') {
          cdAIReplaceSelectedImage(text).catch(e => _addChatMessage('error', 'AI 이미지 교체 실패: ' + (e?.message || e)));
        } else if (typeof cdReplaceSelectedImage === 'function') {
          cdReplaceSelectedImage();
        }
        return true;
      }
      return false;
    }

    const nextText = _extractFastReplacementText(text);
    let changed = false;
    if (nextText) {
      target.textContent = nextText;
      changed = true;
    }
    const win = doc.defaultView;
    const style = win?.getComputedStyle(target);
    const fontSize = parseFloat(style?.fontSize || target.style.fontSize || '16') || 16;
    if (/크게|키워|larger|bigger/i.test(text)) {
      target.style.fontSize = `${Math.min(96, Math.round(fontSize + 3))}px`;
      changed = true;
    }
    if (/작게|줄여|smaller/i.test(text)) {
      target.style.fontSize = `${Math.max(8, Math.round(fontSize - 3))}px`;
      changed = true;
    }
    if (/굵게|볼드|bold/i.test(text)) {
      target.style.fontWeight = '800';
      changed = true;
    }
    if (/얇게|보통|regular/i.test(text)) {
      target.style.fontWeight = '400';
      changed = true;
    }
    if (/가운데|중앙|center/i.test(text)) {
      target.style.textAlign = 'center';
      changed = true;
    } else if (/왼쪽|좌측|left/i.test(text)) {
      target.style.textAlign = 'left';
      changed = true;
    } else if (/오른쪽|우측|right/i.test(text)) {
      target.style.textAlign = 'right';
      changed = true;
    }
    const color = _extractFastColor(text);
    if (color) {
      target.style.color = color;
      changed = true;
    }
    if (!changed) return false;
    if (typeof window._syncPreviewHtmlFromDoc === 'function') window._syncPreviewHtmlFromDoc();
    if (typeof _pushVersion === 'function') _pushVersion(_lastHtml, _lastMeta, instruction);
    if (typeof window._updateInlineEditChip === 'function') window._updateInlineEditChip();
    if (typeof toast === 'function') toast('선택 요소를 바로 수정했습니다.');
    _addChatMessage('ai', '선택한 요소를 바로 수정했습니다.');
    return true;
  }

  function _extractFastReplacementText(text) {
    const quoted = text.match(/[“"']([^“"']{1,160})[”"']/);
    if (quoted?.[1]) return quoted[1].trim();
    const labeled = text.match(/(?:문구|텍스트|내용)\s*[:：]\s*(.{1,160})$/i);
    if (labeled?.[1]) return labeled[1].trim();
    const toChange = text.match(/^(.{1,120}?)(?:으로|로)\s*(?:바꿔|변경|수정|해줘|해주세요)/);
    if (toChange?.[1]) return toChange[1].trim();
    return '';
  }

  function _extractFastColor(text) {
    const hex = text.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (hex) return hex[0];
    const table = [
      [/빨강|빨간|red/i, '#ff3b30'],
      [/강조색|웜톤|orange/i, '#ff8c00'],
      [/노랑|노란|yellow/i, '#fbbf24'],
      [/초록|녹색|green/i, '#34c759'],
      [/파랑|파란|blue/i, '#007aff'],
      [/보라|purple/i, '#8b5cf6'],
      [/검정|검은|black/i, '#1c1c1e'],
      [/흰색|하얀|white/i, '#ffffff'],
      [/회색|gray|grey/i, '#6b7280'],
    ];
    const found = table.find(([re]) => re.test(text));
    return found ? found[1] : '';
  }

  async function _runWithDesignBusy(label, task) {
    const controller = new AbortController();
    _cdActiveAbortController = controller;
    _setDesignBusy(true, label);
    try {
      return await task(controller.signal);
    } catch (e) {
      if (e?.name === 'AbortError') {
        _addChatMessage('status', '작업을 취소했습니다. 기존 디자인은 그대로 유지됩니다.');
        return null;
      }
      throw e;
    } finally {
      if (_cdActiveAbortController === controller) _cdActiveAbortController = null;
      _setDesignBusy(false);
    }
  }

  function cdCancelActiveDesign() {
    if (_cdActiveAbortController) {
      _cdActiveAbortController.abort();
      _addChatMessage('status', '취소 요청을 보냈습니다. 반영 중인 결과는 저장하지 않습니다.');
      return;
    }
    _setDesignBusy(false);
  }
  window.cdCancelActiveDesign = cdCancelActiveDesign;

  function _setDesignBusy(on, label) {
    window._cdDesignBusy = !!on;
    const page = document.getElementById('page-claude-design');
    if (page) {
      page.classList.toggle('cd-design-busy', !!on);
      page.classList.toggle('cd-generating', !!on);
      if (on) page.classList.add('cd-chat-started');
    }
    const input = document.getElementById('cd-input');
    const send = document.getElementById('cd-send-btn');
    const history = document.getElementById('cd-history-panel');
    const bottomSetup = document.getElementById('cd-bottom-setup');
    if (input) {
      input.disabled = !!on;
      if (on) _setDesignInputMode(input, true);
      else _setDesignInputMode(input, !!_lastHtml);
    }
    if (send) {
      if (on) send.disabled = true;
      else cdUpdateSendAvailability();
    }
    if (history && on) {
      history.style.display = 'flex';
      history.style.maxHeight = 'none';
      history.style.minHeight = '220px';
    }
    if (bottomSetup) {
      if (on || _lastHtml) {
        bottomSetup.style.setProperty('display', 'none', 'important');
        bottomSetup.style.setProperty('max-height', '0', 'important');
      } else {
        bottomSetup.style.removeProperty('display');
        bottomSetup.style.removeProperty('max-height');
      }
    }
    const previewWrap = document.getElementById('cd-preview-wrap');
    const previewFrame = document.getElementById('cd-preview');
    if (previewFrame) previewFrame.style.pointerEvents = on ? 'none' : '';
    let overlay = document.getElementById('cd-design-busy-overlay');
    if (!overlay && previewWrap) {
      overlay = document.createElement('div');
      overlay.id = 'cd-design-busy-overlay';
      overlay.style.cssText = 'display:none;position:absolute;inset:0;z-index:40;background:rgba(255,255,255,0.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;text-align:center;pointer-events:auto;';
      overlay.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 22px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:rgba(255,255,255,0.92);box-shadow:0 18px 46px rgba(0,0,0,0.12);">
          <div style="width:34px;height:34px;border:3px solid rgba(255,140,0,0.2);border-top-color:#ff8c00;border-radius:50%;animation:spin .8s linear infinite;"></div>
          <div id="cd-design-busy-title" style="font-size:13px;font-weight:900;color:#1c1c1e;">생성 중입니다</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.5);">완료되면 자동으로 미리보기에 반영됩니다</div>
          <button type="button" onclick="cdCancelActiveDesign()" style="padding:7px 12px;border:1px solid rgba(255,59,48,0.20);background:rgba(255,59,48,0.06);color:#d70015;border-radius:999px;font-size:11px;font-weight:900;cursor:pointer;">취소</button>
        </div>`;
      previewWrap.appendChild(overlay);
    }
    if (overlay) {
      overlay.style.display = on ? 'flex' : 'none';
      const title = overlay.querySelector('#cd-design-busy-title');
      if (title) title.textContent = label || '생성 중입니다';
    }
    if (!on) {
      requestAnimationFrame(() => {
        if (typeof window._bindInlineEdit === 'function') window._bindInlineEdit();
        if (typeof window._updateInlineEditButton === 'function') window._updateInlineEditButton();
      });
    }
    if (typeof window._updateDesignUndoRedoButtons === 'function') window._updateDesignUndoRedoButtons();
  }
  window._setDesignBusy = _setDesignBusy;

  // 💻 디자인 코딩 에이전트 — CLI 실행 (kimi/codex)
  async function _agentCodingCli(prompt, signal) {
    // 슬래시 커맨드 우선 처리
    if (prompt.startsWith('/')) {
      return _agentCodingSlash(prompt);
    }
    // tool 결정 — 헤더 dropdown 으로 선택했으면 그것, 아니면 kimi 기본
    let tool = 'kimi';
    const provVal = document.getElementById('cd-provider')?.value || '';
    if (provVal.includes('codex') || provVal.includes('openai')) tool = 'codex';
    const status = _addChatMessage('status', `💻 ${tool} CLI 실행 중...`);
    const res = await fetch('/api/coding-agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, prompt, reference_images: _attachedImages.map(im => im.dataUrl), timeout: 180 }),
      signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      if (status) status.textContent = `CLI 실패 (${res.status}): ${txt.slice(0, 200)}`;
      return;
    }
    const data = await res.json();
    if (status) status.textContent = `✓ ${tool} 완료 (${data.cwd})`;
    const out = (data.stdout || '').trim() || '(출력 없음)';
    const err = (data.stderr || '').trim();
    const html = `<pre style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:11px;white-space:pre-wrap;background:#1c1c1e;color:#e0e0e0;padding:10px;border-radius:8px;max-height:400px;overflow:auto;">${_esc(out)}</pre>` +
      (err ? `<details style="margin-top:6px;"><summary style="font-size:10px;color:rgba(0,0,0,0.5);cursor:pointer;">stderr (${err.length}자)</summary><pre style="margin:4px 0;font-size:10px;color:#ff6b00;white-space:pre-wrap;">${_esc(err.slice(0, 4000))}</pre></details>` : '');
    _addChatMessage('ai', html, { html: true });
  }

  async function _agentCodingSlash(cmd) {
    const trimmed = cmd.trim();
    if (trimmed === '/help') {
      _addChatMessage('ai', `💻 디자인 코딩 에이전트 슬래시 커맨드:
• <code>/help</code> — 명령 목록
• <code>/clear</code> — 대화 초기화
• <code>/which</code> — 설치된 CLI 도구 검색
• <code>/login [tool]</code> — 도구 로그인 (kimi|codex)
• <code>/files</code> — 작업 디렉토리 파일 목록
• 그 외 텍스트 → 현재 선택된 CLI 로 실행`, { html: true });
      return;
    }
    if (trimmed === '/clear') { cdResetChat(); return; }
    if (trimmed === '/which') {
      const r = await fetch('/api/coding-agent/which');
      const d = await r.json();
      const lines = Object.entries(d.tools || {}).map(([k, v]) => `${v.installed ? '✅' : '❌'} <b>${k}</b> — ${v.path || '없음'}`);
      _addChatMessage('ai', lines.join('<br>') + `<br><span style="font-size:10px;color:rgba(0,0,0,0.5);">workspace: ${d.workspace}</span>`, { html: true });
      return;
    }
    if (trimmed === '/files') {
      const r = await fetch('/api/coding-agent/files');
      const d = await r.json();
      const items = (d.files || []).map(f => `${f.is_dir ? '📁' : '📄'} ${f.name}`).join('\n') || '(빈 디렉토리)';
      _addChatMessage('ai', `<pre style="font-size:11px;font-family:ui-monospace,monospace;">${_esc(d.cwd)}\n${_esc(items)}</pre>`, { html: true });
      return;
    }
    if (trimmed.startsWith('/login')) {
      const tool = trimmed.split(/\s+/)[1] || 'kimi';
      _addChatMessage('status', `🔑 ${tool} login 실행 중... (인터랙티브일 수 있음 — 터미널 권장)`);
      const r = await fetch('/api/coding-agent/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool }),
      });
      const d = await r.json();
      const html = `<pre style="font-size:11px;font-family:ui-monospace,monospace;background:#1c1c1e;color:#e0e0e0;padding:8px;border-radius:6px;max-height:300px;overflow:auto;">${_esc((d.stdout || d.message || '').slice(0, 3000))}</pre>`;
      _addChatMessage('ai', html, { html: true });
      return;
    }
    _addChatMessage('error', `알 수 없는 커맨드: ${cmd}. /help 참고`);
  }

  // atlas:<model> / cli:<tool> 형식 → {provider, model} 파싱
  function _parseProvider(raw) {
    const v = (raw || '').trim();
    if (!v) return { provider: '', model: '' };
    if (v.startsWith('atlas:')) return { provider: 'atlas', model: v.slice(6) };
    if (v.startsWith('cli:')) return { provider: v, model: '' };
    return { provider: v, model: '' };
  }

  function _templateInputValue(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function _pushReferenceSource(list, source) {
    const snippet = String(source?.snippet || source?.text || '').trim();
    if (!snippet) return;
    const title = String(source?.title || source?.url || '참고 자료').trim();
    const type = String(source?.type || '자료').trim();
    const url = String(source?.url || '').trim();
    const key = `${type}|${title}|${url}|${snippet.slice(0, 80)}`;
    if (list.some(item => item._dedupeKey === key)) return;
    list.push({
      title,
      url,
      snippet: snippet.slice(0, 12000),
      type,
      _dedupeKey: key,
    });
  }

  function _collectCheckedSearchSources() {
    const list = document.getElementById('cd-source-results');
    if (!list || !Array.isArray(list._sources)) return [];
    return Array.from(list.querySelectorAll('input[data-source-idx]:checked'))
      .map(el => list._sources[parseInt(el.dataset.sourceIdx, 10)])
      .filter(Boolean);
  }

  function _collectDesignReferenceSources() {
    const refs = [];
    (Array.isArray(_attachedSources) ? _attachedSources : []).forEach(source => _pushReferenceSource(refs, source));
    _collectCheckedSearchSources().forEach(source => _pushReferenceSource(refs, source));

    const materials = _templateInputValue('cd-template-materials');
    if (materials) {
      _pushReferenceSource(refs, {
        title: '빠른 템플릿 소재',
        snippet: materials,
        type: 'MATERIALS',
      });
    }

    const directText = _templateInputValue('cd-source-direct-text');
    if (directText) {
      _pushReferenceSource(refs, {
        title: _templateInputValue('cd-source-direct-title') || '직접 입력 소재',
        snippet: directText,
        type: 'TEXT',
      });
    }

    return refs.map(({ _dedupeKey, ...source }) => source);
  }

  function _getDesignOptions() {
    return {
      style: document.getElementById('cd-style')?.value || 'editorial',
      purpose: document.getElementById('cd-purpose')?.value || 'conversion',
      density: document.getElementById('cd-density')?.value || 'balanced',
    };
  }

  function _buildReferenceUsageInstruction(refImages, refSources) {
    const imageCount = Array.isArray(refImages) ? refImages.length : 0;
    const sourceCount = Array.isArray(refSources) ? refSources.length : 0;
    const brand = _templateInputValue('cd-brand') || '프로필 브랜드';
    const businessType = _templateInputValue('cd-business-type') || '프로필 업종';
    const businessDescription = _templateInputValue('cd-business-detail') || '';
    const cta = _templateInputValue('cd-cta') || '';
    const imageNotes = (Array.isArray(_attachedImages) ? _attachedImages : []).slice(0, 12).map((image, index) => {
      const name = String(image?.name || `첨부 이미지 ${index + 1}`).trim();
      const source = String(image?.source || '').trim();
      const sourceUrl = String(image?.sourceUrl || '').trim();
      return `${index + 1}. ${name}${source ? ` (${source})` : ''}${sourceUrl ? `\n   원본 이미지 URL: ${sourceUrl}` : ''}`;
    }).join('\n');
    const parts = [];
    if (imageCount > 0) {
      parts.push(`[첨부 이미지/로고 사용 규칙]
- 첨부된 이미지 ${imageCount}장은 단순 참고가 아니라 결과물에 실제로 들어가야 하는 시각 자산입니다.
- 최소 1장은 hero, 제품/서비스 증거, 스크린샷, 인물/장소 컷, 로고/브랜드 영역 중 하나로 화면에서 분명히 보이게 배치합니다.
- 로고처럼 보이는 이미지는 새로 그리거나 텍스트로 대체하지 말고, 실제 브랜드 로고/워터마크/헤더/푸터 중 자연스러운 위치에 배치합니다.
- 제품/인물/스크린샷/장소 이미지는 색감·구도·무드뿐 아니라 실제 이미지 placeholder(#reference-image-N) 사용까지 반영합니다.
- 검색 자료에서 같이 수집된 이미지는 해당 자료의 내용/출처 맥락과 어울리는 장면에 배치하고, 무관한 장식 이미지처럼 쓰지 않습니다.
- 첨부 이미지가 있는데 순수 도형, 일반 아이콘, 임의 stock 이미지, 그라데이션만으로 결과물을 끝내면 실패입니다.

[첨부 이미지 목록]
${imageNotes || `${imageCount}장`}`);
    }
    if (sourceCount > 0) {
      parts.push(`[첨부 자료 사용 규칙]
- 첨부 자료 ${sourceCount}건은 배경지식이 아니라 결과물 카피와 구조의 1차 재료입니다.
- 자료의 고유명사, 숫자, 키워드, 문제/혜택, 출처 맥락을 제목·본문·캡션·차트·근거 박스 중 적절한 위치에 구체적으로 반영합니다.
- 자료가 있는데 일반론만 쓰거나 사용자가 준 소재와 무관한 문구로 채우면 실패입니다.
- 슬라이드/섹션이 여러 개면 각 장마다 최소 1개 이상의 자료 기반 문장 또는 수치를 배치합니다.
- 출처 URL 또는 출처명은 작은 캡션, footnote, source line 중 하나로 자연스럽게 남깁니다.
- 자료 내용은 그대로 나열하지 말고, 아래 프로필 비즈니스와 연결해 "${brand}"가 왜 이 주제를 말해야 하는지 분명하게 재구성합니다.
- 프로필의 고객/업종/서비스 설명과 맞지 않는 자료 문장은 버리고, 맞는 문장은 고객 문제, 서비스 강점, 증거, CTA로 번역합니다.
- CTA가 있으면 자료 기반 근거가 CTA(${cta || '프로필 CTA'})로 자연스럽게 이어져야 합니다.

[프로필과 자료 결합 기준]
- 브랜드/프로필: ${brand}
- 업종: ${businessType}
- 비즈니스 설명: ${businessDescription || '프로필 기본 비즈니스 설명 없음'}
- CTA: ${cta || '프로필 CTA 없음'}

[첨부 자료 상세]
${refSources.slice(0, 12).map((source, index) => {
        const title = String(source?.title || `자료 ${index + 1}`).trim();
        const type = String(source?.type || '자료').trim();
        const url = String(source?.url || source?.link || '').trim();
        const snippet = String(source?.snippet || source?.text || source?.content || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
        return `${index + 1}. [${type}] ${title}\n출처: ${url || '없음'}\n내용: ${snippet}`;
      }).join('\n')}`);
    }
    return parts.length ? `\n\n${parts.join('\n\n')}\n` : '';
  }

  function _isThreeDesignKind(kind) {
    return kind === 'threejs' || String(kind || '').startsWith('threejs-');
  }

  function _isVideoDesignKind(kind) {
    return kind === 'video' || String(kind || '').startsWith('video-');
  }

  function _isRemotionDesignKind(kind) {
    return kind === 'remotion' || String(kind || '').startsWith('remotion-');
  }

  function _isOpenDesignKind(kind) {
    return String(kind || '').startsWith('od-');
  }

  function _threeDesignModeInstruction(kind) {
    const mode = String(kind || '').trim();
    const instructions = {
      'threejs-motion': [
        '- 결과물 목표: 마케케디자인 안에서 재생되는 3D 모션 씬. 8~15초 정도의 루프 가능한 카메라/오브젝트 움직임을 설계합니다.',
        '- window.__makekeThreeScene.play(), pause(), captureFrame(), setProgress(0~1)를 제공해 나중에 영상 캡처나 HyperFrames 합성으로 넘길 수 있게 합니다.',
        '- 텍스트/CTA는 3D 캔버스 위 HTML 레이어로 얹고, 3D 오브젝트가 문구를 가리지 않도록 카메라 경로와 safe area를 둡니다.'
      ],
      'threejs-product': [
        '- 결과물 목표: 제품/패키지/앱 아이콘/공간을 입체적으로 보여주는 3D 제품 쇼케이스.',
        '- GLB 파일이 없으면 박스, 실린더, 라운드 패널, 라벨 평면, 유리/메탈 재질로 제품 대체 모델을 절차적으로 만듭니다.',
        '- 자동 회전, 마우스 드래그, 핵심 특징 핫스팟 3개, CTA가 있는 제품 히어로 구성을 포함합니다.'
      ],
      'threejs-toon': [
        '- 결과물 목표: GLB 또는 절차적 캐릭터/제품을 카툰 렌더링처럼 보이게 하는 3D 씬.',
        '- MeshToonMaterial, gradientMap, OutlineEffect 또는 backface outline 방식을 사용해 검은 외곽선과 단순 명암을 만듭니다.',
        '- 모델이 없으면 캐릭터/마스코트/제품을 단순 도형 조합으로 만들고 카툰 외곽선을 적용합니다.'
      ],
      'threejs-particles': [
        '- 결과물 목표: 브랜드 메시지나 키워드를 표현하는 파티클/오브/텍스트 포인트 모션.',
        '- 수백~수천 개 점/스프라이트/인스턴스를 사용하되 Electron 미리보기에서 60fps를 노리고, 개수는 성능에 맞게 제한합니다.',
        '- 마우스 위치 또는 시간에 반응하는 흐름, 브랜드 색상 팔레트, 중앙 CTA safe area를 포함합니다.'
      ],
      'threejs-landing': [
        '- 결과물 목표: Webflow식 3D 랜딩 히어로. 첫 화면 대부분을 풀블리드 3D 장면으로 쓰고, 히어로 카피와 CTA를 그 위에 배치합니다.',
        '- 3D 씬은 장식 카드 안에 넣지 말고 배경/주무대가 되게 하며, 다음 섹션이 살짝 보이도록 스크롤 흐름도 구성합니다.',
        '- hover, scroll, pointer move 중 하나 이상이 3D 카메라나 오브젝트에 자연스럽게 반응해야 합니다.'
      ]
    };
    return (instructions[mode] || [
      '- 결과물 목표: 마우스로 회전 가능하고 자동 애니메이션이 있는 범용 Three.js 3D 인터랙티브 씬.'
    ]).join('\n');
  }

  function _videoDesignModeInstruction(kind) {
    const mode = String(kind || '').trim();
    const instructions = {
      video: [
        '- 결과물 목표: 마케케디자인에서 바로 이해되는 일반 영상 설계안. 장면, 자막, 전환, CTA 흐름이 자연스럽게 읽혀야 합니다.',
        '- 이미지 한 장만 나열하지 말고, 오프닝 훅, 전개, 증거, 엔드카드 같은 컷 흐름을 분명히 나눕니다.',
        '- HTML 결과는 나중에 HyperFrames나 다른 영상 엔진으로 옮기기 쉬운 scene / caption / cue 구조를 유지합니다.'
      ]
    };
    return (instructions[mode] || [
      '- 결과물 목표: 장면 흐름이 읽히는 범용 영상 설계안.'
    ]).join('\n');
  }

  function _remotionDesignModeInstruction(kind) {
    const mode = String(kind || '').trim();
    const instructions = {
      remotion: [
        '- 결과물 목표: 광고 영상으로 바로 제작할 수 있는 씬별 설계안.',
        '- 각 씬은 실제 영상 프레임처럼 16:9 전체 화면을 채우고, 텍스트와 비주얼이 영상에 나올 그대로 배치됩니다.',
        '- 씬마다 duration, 자막, 전환 방식을 명시하고, 전체 영상 길이는 15~30초를 기준으로 합니다.'
      ],
      'remotion-storyboard': [
        '- 결과물 목표: 촬영/편집팀에게 전달할 수 있는 씬별 스토리보드.',
        '- 장면마다 배경, 인물, 자막, 전환, CTA 등장 시점을 분명히 적습니다.',
        '- 씬 간 리듬이 보이도록 시작/전개/클로징의 에너지 곡선을 구분합니다.'
      ],
      'remotion-campaign': [
        '- 결과물 목표: 광고 캠페인용 여러 컷 영상 설계.',
        '- 후킹 오프닝, 증거 제시, CTA 엔드컷을 분리하고 각 씬의 목표와 길이를 구체적으로 씁니다.',
        '- 메타/네이버/숏폼처럼 채널별 재활용 가능한 구조를 우선합니다.'
      ]
    };
    return (instructions[mode] || [
      '- 결과물 목표: 광고 영상으로 바로 제작할 수 있는 씬별 설계안.'
    ]).join('\n');
  }

  function _buildKindSpecificInstruction(kind) {
    if (_isOpenDesignKind(kind)) {
      return `

[Open Design 흡수 규칙]
- Open Design의 SKILL.md 런타임을 그대로 복제하지 않고, 마케케디자인 안에서 바로 편집 가능한 HTML 아티팩트로 재작성합니다.
- 생성 전 brief, 대상, 목적, 범위, 브랜드 기준을 먼저 확정한 것처럼 정보 구조를 명확히 잡으세요.
- 결과물은 예쁜 샘플 카드가 아니라 실제 사용 가능한 산출물이어야 합니다. 웹 프로토타입, 랜딩, 대시보드, 모바일 온보딩, 소셜 캐러셀, 포스터, 이메일, 가이드, 문서 페이지 등 선택한 kind의 실사용 화면을 만듭니다.
- 첫 화면에서 산출물 유형이 즉시 보여야 하며, 주요 CTA/다음 행동과 검토 가능한 상태가 있어야 합니다.
- 빈 상태, 활성 상태, 선택 상태, 진행 상태, 주석/출처, 다운로드/문의 CTA 중 최소 2개 이상을 포함하세요.
- 타이포그래피, 색상, 여백, 계층, 디테일, 기능성, 독창성 관점으로 자체 검토한 것처럼 완성도를 높이세요.
- 브랜드 색상과 프로필 디자인 규칙을 우선하고, 기본 마케케 주황색은 브랜드 색상으로 명시된 경우에만 사용하세요.
- generic placeholder, 의미 없는 아이콘 나열, stock-like 추상 배경, 한 가지 색만 반복하는 단조로운 팔레트는 실패입니다.
- 여러 화면/장면이 필요한 산출물은 section.makeke-page 단위로 나누고, 각 section은 독립적으로 클릭 편집 가능한 DOM 텍스트/카드/이미지를 가져야 합니다.
${_buildDeviceFrameInstruction(kind)}`;
    }
    const frameInstruction = _buildDeviceFrameInstruction(kind);
    if (frameInstruction) {
      return `\n\n${frameInstruction}`;
    }
    if (_isThreeDesignKind(kind) || kind === 'shader') {
      return `

[3D/Three.js 생성 규칙]
- Three.js를 사용해 실제로 움직이고 상호작용되는 3D 씬을 만듭니다.
- 중요: 3D 씬의 주제와 오브젝트는 반드시 프로필의 업종/브랜드/제품에 맞아야 합니다. 의미 없는 우주 공간, 무작위 파티클, 관계없는 추상 도형을 기본값으로 쓰지 마세요.
  - 예: 치과면 치아/임플란트 모델, 카페면 커피컵/원두, SaaS면 대시보드/데이터 시각화, 부동산이면 건물/공간을 3D로 표현하세요.
  - 업종 정보가 없으면 사용자 요청 텍스트에서 주제를 추론하고 그에 맞는 오브젝트를 만드세요.
- CDN은 importmap으로 https://unpkg.com/three@0.160.0/build/three.module.js 를 사용하고, 필요 시 OrbitControls, GLTFLoader, OutlineEffect를 three/addons 경로에서 불러옵니다.
- 첫 화면 대부분을 3D canvas가 차지하게 하고, 장식용 작은 미리보기 카드 안에 넣지 않습니다.
- 카메라, 조명, 그림자, 재질, 애니메이션 루프, 리사이즈 대응, 마우스 드래그 회전 또는 OrbitControls를 반드시 포함합니다.
- HTML/CSS/JS가 한 파일 안에서 바로 실행되어야 하며, 외부 빌드 도구나 로컬 파일 경로에 의존하지 않습니다.
- 로딩 중/실패 시에도 빈 화면이 되지 않도록 상태 텍스트와 절차적 fallback 오브젝트를 둡니다.
- WebGPU를 직접 요구하지 말고 기본은 WebGLRenderer로 안정 구현합니다.
- 캔버스는 고정 aspect-ratio 또는 viewport 기반 크기를 가져야 하며, 텍스트/버튼/핫스팟과 겹치지 않게 safe area를 확보합니다.
- 애니메이션은 requestAnimationFrame 기반으로 만들고, document.visibilityState가 hidden이면 렌더 루프를 일시 정지합니다.
- 생성 HTML 안에 window.__makekeThreeScene 객체를 만들고 최소 play, pause, captureFrame 메서드를 제공합니다.
- captureFrame은 renderer.domElement.toDataURL('image/png')를 반환해야 합니다.
- 렌더러 생성 시 alpha, antialias를 설정하고, pixelRatio는 Math.min(window.devicePixelRatio || 1, 2)로 제한합니다.
- 브랜드 색상이 있으면 3D 씬의 조명, 재질, 배경에 해당 색상 팔레트를 반영하세요.
${_threeDesignModeInstruction(kind)}`;
    }
    if (_isVideoDesignKind(kind)) {
      return `

[영상 생성 규칙]
- 영상은 정적인 이미지 한 장이 아니라, 오프닝 훅, 전개, 증거, 엔드카드가 읽히는 컷 설계안이어야 합니다.
- scene, caption, cue, transition, CTA를 분리해 적고, 다음 단계의 HyperFrames 또는 영상 렌더로 옮기기 쉽게 만듭니다.
- 첫 화면에는 하나의 카드만 두지 말고, 장면 미리보기나 흐름 블록을 함께 보여줍니다.
- 나레이션이나 자막은 짧고 명확하게, 영상의 목적과 맞는 템포로 배치합니다.
${_videoDesignModeInstruction(kind)}`;
    }
    if (_isRemotionDesignKind(kind)) {
      return `

[광고 영상 설계 규칙]
- 출력물은 광고 영상의 씬별 설계안입니다. 각 씬은 영상의 실제 한 장면(프레임)입니다.
- 중요: 영상의 주제와 문구는 반드시 프로필의 업종/브랜드/제품에 맞아야 합니다.
  - 프로필 업종이 있으면 해당 업종의 고객이 반응할 훅, 혜택, 증거, CTA를 사용하세요.
  - 예: 치과면 "임플란트 상담 예약", 카페면 "시그니처 라떼 출시", SaaS면 "업무 시간 50% 단축"처럼 구체적으로 쓰세요.
  - 업종 정보가 없으면 사용자 요청에서 주제를 추론하세요.
- 각 씬을 독립된 <section class="makeke-page" data-slide="N"> 으로 만들고, 16:9 화면 전체를 채우세요.
- 각 씬에는 data-scene="N", data-duration="3s", data-transition="fade" 속성을 넣으세요.
- 씬 안에는 영상에 실제로 보일 텍스트, 배경색/이미지, CTA를 실물 크기로 배치합니다.
- 브랜드 색상이 있으면 씬의 배경, 텍스트 강조, CTA 버튼에 해당 색상을 사용하세요.
- 씬 흐름: 훅(1~2초) → 핵심 메시지(3~5초) → 증거/혜택(3~5초) → 엔드카드/CTA(2~3초)
- 각 씬의 좌측 상단에 작은 배지로 [씬 1 · 3초 · 페이드인] 형태의 메타 정보를 표시합니다.
- 하단에 자막으로 들어갈 텍스트를 별도 영역에 적습니다.
- CSS animation으로 각 씬의 등장 효과(fade, slide, scale)를 넣어 영상 느낌을 줍니다.
- 총 4~6개 씬이 적당합니다. 랜딩페이지나 제품 카드가 아니라 영상 컷 설계입니다.
${_remotionDesignModeInstruction(kind)}`;
    }
    if (kind === 'mckinsey-pptx') {
      return `

[컨설팅 PPTX 덱 생성 규칙]
- 특정 회사의 공식 로고/상표/템플릿을 사칭하지 말고, 글로벌 컨설팅 문서에서 기대되는 절제된 비즈니스 덱 스타일로 만듭니다.
- 사용자가 장수를 말하지 않으면 6~8장의 <section class="makeke-page" data-slide="0"> 슬라이드로 구성합니다.
- 권장 구성: 표지, Executive Summary, 문제 구조화/이슈 트리, 핵심 분석 차트, 전략 옵션/2x2, 권고안, 실행 로드맵, 부록 또는 가정.
- 모든 슬라이드는 16:9 PPTX 내보내기에 맞는 단일 화면이어야 하며 세로 스크롤 없이 한 장 안에서 완결됩니다.
- 각 슬라이드 상단에는 결론형 headline을 쓰고, 하단에는 페이지 번호와 짧은 출처/가정 영역을 둡니다.
- 시각 요소는 표, 막대/워터폴/라인 차트, 2x2 매트릭스, 타임라인, 프로세스 다이어그램을 HTML/CSS/SVG로 직접 그립니다.
- 색상은 흰 배경, 검정/짙은 회색 텍스트, 옅은 회색 그리드, 한 가지 포인트 컬러 중심으로 절제합니다.
- 텍스트는 작고 촘촘하되 잘리지 않아야 하며, 숫자/근거/시사점/다음 액션이 함께 보여야 합니다.`;
    }
    if (kind && String(kind).startsWith('consulting-')) {
      return `

[컨설팅 산출물 생성 규칙]
- 전략 컨설팅 문서처럼 결론이 먼저 보이는 headline, 근거 영역, 시사점 영역을 분명히 나눕니다.
- 표/차트/매트릭스/타임라인은 실제 편집 가능한 HTML/CSS/SVG 요소로 만들고 이미지로 뭉개지 않습니다.
- 흰 배경, 얇은 회색 선, 작은 캡션, 페이지 번호, 짧은 출처/가정 표기를 포함합니다.
- 장식보다 구조와 가독성을 우선하고, PPTX 내보내기 시 깨지지 않게 한 화면 안에 안정적으로 배치합니다.`;
    }
    return '';
  }

  function _buildDeviceFrameInstruction(kind) {
    const value = String(kind || '').trim();
    const needsFrames = [
      'od-mobile-onboarding',
      'mobile-app',
      'mockup',
      'onboarding-flow',
      'landing-app',
      'social-profile',
      'web-prototype',
      'od-web-prototype',
      'od-saas-landing',
      'od-dashboard'
    ].includes(value);
    if (!needsFrames) return '';
    return `[Open Design 공유 기기 프레임]
- 앱/모바일/웹 프로토타입 산출물에는 필요한 경우 마케케에 설치된 공유 프레임 자산을 사용하세요.
- 사용 가능 경로: /static/open-design/frames/iphone-15-pro.html, /static/open-design/frames/android-pixel.html, /static/open-design/frames/ipad-pro.html, /static/open-design/frames/macbook.html, /static/open-design/frames/browser-chrome.html
- 프레임은 <iframe src="/static/open-design/frames/iphone-15-pro.html?screen=...">처럼 ?screen= 경로로 내부 화면을 끼우는 장식 chrome입니다.
- 한 파일 안에서 바로 미리보기가 필요하면 내부 화면을 별도 data URL이나 같은 문서의 srcdoc으로 구성하고, 프레임은 장식 chrome으로만 사용하세요.
- 프레임 안의 실제 앱/웹 화면은 편집 가능한 HTML DOM이어야 하며, 핵심 텍스트/CTA/이미지는 data-makeke-id를 유지하세요.
- 모바일 온보딩은 iPhone 15 Pro 또는 Android Pixel 프레임 3개를 나란히 배치하고, 웹/SaaS 프로토타입은 Browser Chrome 또는 MacBook 프레임으로 첫 화면을 보여주세요.`;
  }

  let _cdDesignRunCounter = 0;
  const _cdRecentDesignFingerprints = [];
  function _hashTextForRecipe(text) {
    let hash = 2166136261;
    const raw = String(text || '');
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function _summarizeDesignFingerprint(html) {
    const text = String(html || '');
    if (!text.trim()) return '';
    try {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const bodyText = (doc.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 360);
      const classNames = Array.from(doc.querySelectorAll('[class]'))
        .flatMap(el => String(el.getAttribute('class') || '').split(/\s+/))
        .filter(Boolean);
      const counts = classNames.reduce((acc, cls) => {
        acc[cls] = (acc[cls] || 0) + 1;
        return acc;
      }, {});
      const topClasses = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cls, count]) => `${cls}(${count})`)
        .join(', ');
      const hasGrid = /grid-template|display\s*:\s*grid|class=["'][^"']*(grid|dashboard|cards)/i.test(text);
      const hasDashboard = /(dashboard|kpi|metric|panel|analytics|workflow|kanban)/i.test(text);
      const hasBottomCta = /(bottom|footer|cta|call-to-action|action-bar)/i.test(text);
      const hasBeige = /#fff7ed|#fef3c7|#f5efe6|beige|cream|paper|grid/i.test(text);
      const hasDark = /#0b|#111|#1c1c1e|dark|black/i.test(text);
      const headline = (doc.querySelector('h1,h2,.headline,.hero-title')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      return [
        headline ? `headline=${headline}` : '',
        bodyText ? `text=${bodyText}` : '',
        topClasses ? `classes=${topClasses}` : '',
        `signals=${[
          hasGrid ? 'grid/cards' : '',
          hasDashboard ? 'dashboard-like' : '',
          hasBottomCta ? 'bottom-cta' : '',
          hasBeige ? 'beige/paper' : '',
          hasDark ? 'dark' : '',
        ].filter(Boolean).join(',') || 'none'}`,
      ].filter(Boolean).join(' | ');
    } catch (_) {
      return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 520);
    }
  }

  function _recordDesignFingerprint(html) {
    const summary = _summarizeDesignFingerprint(html);
    if (!summary) return;
    _cdRecentDesignFingerprints.unshift(summary);
    if (_cdRecentDesignFingerprints.length > 4) _cdRecentDesignFingerprints.length = 4;
  }

  function _recentDesignFingerprintBlock() {
    if (!_cdRecentDesignFingerprints.length) return '';
    return _cdRecentDesignFingerprints
      .slice(0, 3)
      .map((item, i) => `${i + 1}. ${item}`)
      .join('\n');
  }

  function _buildVisualDiversityInstruction(ctx, prompt) {
    const recentBlock = ctx?.previousDesigns ? `\n\n[최근 결과 회피 메모리]\n아래 최근 결과와 같은 골격/색감/카드 구성을 반복하면 실패입니다.\n${ctx.previousDesigns}` : '';
    if (_isThreeDesignKind(ctx?.kind)) {
      const recipes = [
        {
          name: '제품/서비스 3D 쇼케이스',
          rule: '프로필 업종에 맞는 제품이나 서비스를 3D 오브젝트로 만들고, 회전/하이라이트로 특징을 보여준다. 업종에 맞지 않는 추상 도형이나 우주 배경은 쓰지 않는다.',
        },
        {
          name: '브랜드 히어로 3D',
          rule: '브랜드 색상과 로고 느낌을 살린 3D 히어로 씬. 배경, 조명, 재질 모두 브랜드 팔레트에서 파생하고, 업종의 핵심 가치를 시각적으로 전달한다.',
        },
        {
          name: '인터랙티브 데모',
          rule: '고객이 직접 만져보는 느낌의 3D 인터랙티브. 업종의 핵심 기능이나 제품을 클릭/회전/확대할 수 있게 하고, 설명 텍스트는 맥락에 맞게 짧게 넣는다.',
        },
        {
          name: '공간/환경 3D',
          rule: '매장, 사무실, 진료실 같은 업종 관련 공간을 3D로 재현하거나 모티프를 활용한다. 추상적인 우주/파티클보다 고객이 인식할 수 있는 환경을 우선한다.',
        },
      ];
      const contracts = [
        '3D 오브젝트는 프로필 업종/제품과 관련 있어야 하며, 의미 없는 추상 도형만으로 채우면 실패입니다.',
        '브랜드 색상이 있으면 조명과 재질에 반드시 반영하고, 앱 기본 강조색을 기본으로 쓰지 마세요.',
        '텍스트와 CTA는 3D 오브젝트를 가리지 않는 safe area에 배치해야 합니다.',
        '빈 배경 대신 업종에 맞는 절차적 오브젝트나 환경을 반드시 둬야 합니다.',
      ];
      const seed = _hashTextForRecipe([
        ctx?.kind || '',
        ctx?.aspect || '',
        prompt || '',
        Date.now(),
        Math.random(),
        ++_cdDesignRunCounter,
      ].join('|'));
      const primary = recipes[seed % recipes.length];
      const secondary = recipes[(seed + 2) % recipes.length];
      const contractA = contracts[seed % contracts.length];
      const contractB = contracts[(seed + 1) % contracts.length];
      return `

[시각 다양성 강제 규칙]
- 이번 3D 씬의 접근 방식은 "${primary.name}"로, 프로필 업종과 브랜드에 맞는 오브젝트와 환경으로 채우세요.
- ${primary.rule}
- 보조 참고: ${secondary.rule}
- ${contractA}
- ${contractB}
- body에 data-visual-system="${primary.name}" 속성을 넣으세요.
- 3D 캔버스는 화면의 주연으로 배치하고, 브랜드 색상을 조명과 재질에 반영하세요.
- ${recentBlock}`;
    }
    if (_isVideoDesignKind(ctx?.kind)) {
      const recipes = [
        {
          name: '오프닝 훅',
          rule: '첫 2초 안에 목적과 주제를 보여주고, 오프닝이 곧 메시지가 되게 한다.',
        },
        {
          name: '장면 흐름',
          rule: '장면 카드가 순서대로 읽히고, 전개/증거/엔드컷이 끊기지 않게 이어진다.',
        },
        {
          name: '자막 중심',
          rule: '짧은 카피와 자막이 화면을 주도하고, 영상이 설명을 대신한다.',
        },
        {
          name: '캠페인 컷',
          rule: '브랜드/제품/CTA가 분리된 컷으로 보이되, 한 줄 메시지로 묶인다.',
        },
      ];
      const contracts = [
        '정적인 한 장보다 장면 흐름과 전환이 먼저 보여야 합니다.',
        '카피가 너무 길면 실패이므로 짧은 문장과 확실한 CTA를 우선합니다.',
        '타임라인과 영상 목적이 화면 안에서 바로 읽혀야 합니다.',
      ];
      const seed = _hashTextForRecipe([
        ctx?.kind || '',
        ctx?.aspect || '',
        prompt || '',
        Date.now(),
        Math.random(),
        ++_cdDesignRunCounter,
      ].join('|'));
      const primary = recipes[seed % recipes.length];
      const secondary = recipes[(seed + 1) % recipes.length];
      const contractA = contracts[seed % contracts.length];
      const contractB = contracts[(seed + 2) % contracts.length];
      return `

[시각 다양성 강제 규칙]
- 이번 생성 ID: ${Date.now()}-${_cdDesignRunCounter}. 이 ID마다 다른 영상 구조를 선택하세요.
- 이번 생성의 시각 시스템은 반드시 "${primary.name}"로 시작하고, 필요하면 "${secondary.name}"의 요소를 보조로 섞으세요.
- 카드형 랜딩/브루탈 카드/종이 질감 템플릿을 기본값으로 쓰지 마세요.
- ${primary.rule}
- 보조 변주: ${secondary.rule}
- 이번 결과의 필수 구조 차이: ${contractA}
- 이번 결과의 추가 구조 차이: ${contractB}
- body 또는 main에 data-visual-system="${primary.name}" 속성을 넣고, 주요 wrapper class 이름도 이 시스템에 맞게 새로 붙이세요.
- 영상 결과물은 scene, caption, cue 구조가 먼저 읽혀야 하고, 정적 카드만 있는 HTML은 실패입니다.
- ${recentBlock}`;
    }
    if (_isRemotionDesignKind(ctx?.kind)) {
      const recipes = [
        {
          name: '문제→해결 광고',
          rule: '고객의 고민을 보여주고 → 우리 제품/서비스가 해결하는 흐름. 업종에 맞는 구체적인 문제와 해결 장면을 쓴다.',
        },
        {
          name: '후기/증거 광고',
          rule: '고객 후기, 수치 변화, 전후 비교를 중심으로 신뢰를 쌓는 흐름. 업종의 실제 성과 지표를 사용한다.',
        },
        {
          name: '혜택 강조 광고',
          rule: '핵심 혜택 3가지를 빠르게 보여주고 CTA로 연결. 업종 고객이 실제로 원하는 가치를 구체적으로 보여준다.',
        },
        {
          name: '브랜드 스토리 광고',
          rule: '브랜드의 시작, 가치, 차별점을 감성적으로 전달. 업종의 본질적 가치를 영상으로 표현한다.',
        },
      ];
      const contracts = [
        '모든 씬의 텍스트와 비주얼은 프로필 업종/제품에 맞아야 하며, 일반적인 예시문이면 실패입니다.',
        '브랜드 색상이 있으면 씬 배경과 CTA에 반드시 반영하세요.',
        '각 씬의 자막과 CTA는 해당 업종의 고객이 실제로 반응할 문구여야 합니다.',
      ];
      const seed = _hashTextForRecipe([
        ctx?.kind || '',
        ctx?.aspect || '',
        prompt || '',
        Date.now(),
        Math.random(),
        ++_cdDesignRunCounter,
      ].join('|'));
      const primary = recipes[seed % recipes.length];
      const secondary = recipes[(seed + 1) % recipes.length];
      const contractA = contracts[seed % contracts.length];
      const contractB = contracts[(seed + 2) % contracts.length];
      return `

[시각 다양성 강제 규칙]
- 이번 생성 ID: ${Date.now()}-${_cdDesignRunCounter}. 이 ID마다 다른 리모션 타임라인 구성을 선택하세요.
- 이번 광고 영상의 구조는 "${primary.name}" 접근으로 시작하되, 프로필 업종과 브랜드에 맞는 콘텐츠로 채우세요.
- ${primary.rule}
- 보조 참고: ${secondary.rule}
- ${contractA}
- ${contractB}
- body에 data-visual-system="${primary.name}" 속성을 넣으세요.
- 각 씬은 section.makeke-page로 분리하고 data-scene, data-duration, data-transition 속성을 넣으세요.
- ${recentBlock}`;
    }
    const recipes = [
      {
        name: '스위스 에디토리얼 포스터',
        rule: '비대칭 그리드, 큰 여백, 굵은 산세리프 제목, 얇은 라인과 번호 체계, 사진/로고는 한 덩어리의 editorial crop으로 사용.',
      },
      {
        name: '앱 런칭 대시보드 히어로',
        rule: '왼쪽에는 짧은 가치 제안, 오른쪽에는 실제 제품 UI처럼 보이는 layered screen/mock panel, KPI 칩과 CTA를 작게 정렬.',
      },
      {
        name: '매거진 커버형',
        rule: '한 장의 강한 키비주얼 또는 이미지 영역을 중심으로 masthead, 기사형 서브라인, 세로/가로 캡션을 배치.',
      },
      {
        name: '프리미엄 브랜드 룩북',
        rule: '큰 이미지/제품 영역, 절제된 카피, 넓은 여백, 작은 세리프/산세리프 조합, CTA는 조용하지만 명확하게.',
      },
      {
        name: '브루탈리스트 세일즈 카드',
        rule: '굵은 테두리, 강한 대비, 큰 숫자, 스티커/태그 느낌의 CTA, 일부 요소는 의도적으로 각지게 배치.',
      },
      {
        name: '데이터 리포트 인포그래픽',
        rule: '차트/표/프로세스/수치 카드가 주연이며 제목은 짧게, 근거와 비교가 한눈에 보이게 구성.',
      },
      {
        name: '모바일 스토리 시퀀스',
        rule: '세로형 화면 카드, 손가락으로 넘기는 듯한 scene stack, 큰 훅 문장과 1~2개 핵심 카드만 사용.',
      },
      {
        name: '커머스 상세페이지 섹션',
        rule: '제품/혜택/증거/FAQ/CTA 블록이 아래로 흐르는 구조, 같은 높이 카드 반복보다 섹션별 구도가 달라야 함.',
      },
      {
        name: '이벤트 티켓/초대장',
        rule: '일정/장소/참여 대상/혜택이 티켓처럼 분리되고, 절취선·배지·좌석표 같은 메타포를 사용.',
      },
      {
        name: '콘텐츠 운영 보드',
        rule: '칸반/타임라인/체크리스트/상태 배지 중심의 작업 보드 UI처럼 구성하고, 카피는 짧은 액션 단위로 나눔.',
      },
      {
        name: '시네마틱 다크 캠페인',
        rule: '어두운 배경, 한 줄 메시지, 빛/그림자 대비, 큰 CTA 하나. 단, 첨부/브랜드 색상이 밝으면 그 색을 포인트로 사용.',
      },
      {
        name: '소셜 증거 모자이크',
        rule: '후기, 숫자, 로고/프로필, 짧은 인용 카드가 collage처럼 배치되고 중앙에는 명확한 결론 문장 하나를 둠.',
      },
      {
        name: '풀블리드 키비주얼 캠페인',
        rule: '한 장의 큰 이미지/제품/브랜드 씬이 화면 대부분을 차지하고, 텍스트는 가장자리 안전 영역에 얇게 쌓는다.',
      },
      {
        name: '타이포그래픽 런칭 카드',
        rule: '이미지보다 글자 자체가 주인공이며, 굵기/크기/방향/리듬 차이로 메시지를 구성한다. 정보 카드는 최소화한다.',
      },
      {
        name: '운영 플로우 맵',
        rule: '중앙 경로, 노드, 화살표, 상태 칩으로 프로세스를 보여주며 카드뉴스식 반복 박스 대신 흐름을 만든다.',
      },
    ];
    const layoutContracts = [
      'hero-title을 상단 중앙에 두지 말고, 좌측 25% 또는 우측 25%의 좁은 컬럼에 배치하세요.',
      '정보 카드는 2개 이하로 제한하고 나머지는 timeline, chart, split-panel, quote, checklist 중 다른 요소로 바꾸세요.',
      'CTA는 하단 전체 띠가 아니라 floating pill, corner badge, ticket stub, sidebar button 중 하나로 만드세요.',
      '배경은 베이지 종이/격자가 아니라 solid, photo wash, dark, duotone, editorial white 중 하나를 선택하세요.',
      '제목이 큰 경우 본문 블록은 반대편이 아니라 아래/대각선/오버레이 캡션으로 배치하세요.',
      '이미지/로고/첨부가 있으면 작은 장식이 아니라 35% 이상 면적의 주 시각 요소로 쓰세요.',
    ];
    const seed = _hashTextForRecipe([
      ctx?.kind || '',
      ctx?.aspect || '',
      ctx?.brand || '',
      prompt || '',
      Date.now(),
      Math.random(),
      ++_cdDesignRunCounter,
    ].join('|'));
    const primary = recipes[seed % recipes.length];
    const secondary = recipes[(seed + 5) % recipes.length];
    const contractA = layoutContracts[seed % layoutContracts.length];
    const contractB = layoutContracts[(seed + 2) % layoutContracts.length];
    return `

[시각 다양성 강제 규칙]
- 이번 생성 ID: ${Date.now()}-${_cdDesignRunCounter}. 이 ID마다 다른 화면 골격을 선택하세요.
- 이번 생성의 시각 시스템은 반드시 "${primary.name}"로 시작하고, 필요하면 "${secondary.name}"의 요소를 보조로 섞으세요.
- 이전 결과처럼 베이지 종이 질감/격자 배경, 왼쪽 큰 제목 + 오른쪽 정보 카드/대시보드, 하단 CTA 띠가 반복되는 템플릿을 기본값으로 쓰지 마세요.
- 사용자가 같은 주제를 다시 생성해도 레이아웃 골격, 카드 모양, 제목 위치, 이미지 사용 방식, 배경 질감 중 최소 3가지는 달라야 합니다.
- ${primary.rule}
- 보조 변주: ${secondary.rule}
- 이번 결과의 필수 구조 차이: ${contractA}
- 이번 결과의 추가 구조 차이: ${contractB}
- body 또는 main에 data-visual-system="${primary.name}" 속성을 넣고, 주요 wrapper class 이름도 이 시스템에 맞게 새로 붙이세요.
- 색상은 브랜드/첨부 이미지 색을 우선하되, 배경·타이포·카드 구조가 한 가지 고정 테마로 수렴하지 않게 하세요.
- 마케케 앱의 기본 앱 기본 강조색(#ff8c00/#ff6b00)은 앱 UI 색상일 뿐입니다. 프로필 브랜드 색상에 앱 기본 강조색이 없고 사용자가 요구하지 않았다면 결과물의 메인 포인트/CTA/배지 색으로 쓰지 마세요.
- 브랜드 색상이 없으면 요청 주제와 첨부 이미지에서 팔레트를 추론하고, 앱 기본 강조색 대신 해당 주제에 맞는 독립 팔레트를 만드세요.${recentBlock}`;
  }

  function _extractDesignHtml(raw) {
    const text = String(raw || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
    const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      const inner = _extractDesignHtml(fenced[1]);
      if (inner) return inner;
    }
    const matches = Array.from(text.matchAll(/(?:<!DOCTYPE[\s\S]*?)?<html[\s\S]*?<\/html>/gi)).map(m => m[0]);
    if (matches.length > 1) return _mergeHtmlDocuments(matches);
    const htmlMatch = text.match(/<!DOCTYPE[\s\S]*<\/html>/i) || text.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) return htmlMatch[0];
    const bodyMatch = text.match(/<body[\s\S]*?<\/body>/i);
    if (bodyMatch) {
      const styleMatches = Array.from(text.matchAll(/<style[\s\S]*?<\/style>/gi)).map(m => m[0]).join('\n');
      return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Makeke Design</title>
${styleMatches}
</head>
${bodyMatch[0]}
</html>`;
    }
    const pageMatch = text.match(/<section[^>]+class=["'][^"']*makeke-page[^"']*["'][\s\S]*?<\/section>/i);
    if (pageMatch) {
      const styleMatches = Array.from(text.matchAll(/<style[\s\S]*?<\/style>/gi)).map(m => m[0]).join('\n');
      return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Makeke Design</title>
${styleMatches}
</head>
<body>${pageMatch[0]}</body>
</html>`;
    }
    return '';
  }

  function _extractDesignHtmlFromCliData(data) {
    return _extractDesignHtml(data?.design_html || '') || _extractDesignHtml(data?.stdout || '') || _extractDesignHtml(data?.stderr || '');
  }

  function _syncDesignPreflightInputs() {
    const editor = document.getElementById('cd-design-rules-editor');
    const hidden = document.getElementById('cd-design-rules');
    if (editor && hidden) hidden.value = editor.value || '';
    return {
      aspect: document.getElementById('cd-aspect')?.value || document.getElementById('cd-aspect-preflight')?.value || '16:9',
      designRules: hidden?.value?.trim() || '',
    };
  }

  function _buildDesignPreflightPromptBlock() {
    const preflight = _syncDesignPreflightInputs();
    return `\n\n[마케케디자인 생성 전 기준]\n- 화면비율: ${preflight.aspect}\n- 이 기준은 사용자의 직접 요청보다 낮은 우선순위가 아니라, 결과물 전체의 기본 제작 조건입니다.\n\n[브랜드 디자인 규칙.md]\n${preflight.designRules || '프로필 디자인 규칙 없음'}\n`;
  }

  function _buildHtmlOnlyEditPrompt(tool, instruction) {
    const preflight = _syncDesignPreflightInputs();
    return `[역할] 당신은 마케케디자인 HTML 수정 엔진입니다.
[절대 출력 규칙]
- 설명, 요약, diff, markdown, 코드펜스, 파일 경로를 출력하지 마세요.
- 반드시 수정 완료된 전체 HTML만 출력하세요.
- 출력은 <!DOCTYPE html> 또는 <html 로 시작하고 </html> 로 끝나야 합니다.
- 기존 HTML 일부 조각만 반환하면 실패입니다.

[수정 지시]
${instruction}

[현재 생성 전 기준]
- 화면비율: ${preflight.aspect}
- 브랜드 디자인 규칙.md:
${preflight.designRules || '프로필 디자인 규칙 없음'}

[현재 HTML]
${_lastHtml}

[${tool} 최종 확인]
지금 응답에는 수정된 전체 HTML 문서만 들어가야 합니다.`;
  }

  function _mergeHtmlDocuments(htmlDocs) {
    const parser = new DOMParser();
    const styles = [];
    const scripts = [];
    const pages = [];
    htmlDocs.forEach((html, index) => {
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('style').forEach(style => styles.push(_scopeMergedPageCss(style.textContent || '', index + 1)));
      doc.querySelectorAll('script').forEach(script => scripts.push(script.textContent || ''));
      const body = doc.body?.innerHTML || '';
      pages.push(`<section class="makeke-page" data-slide="${index}" data-makeke-page="${index + 1}">${body}</section>`);
    });
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Makeke Multi Page Design</title>
<style>
html,body{margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;color:#1c1c1e;}
.makeke-deck{display:flex;flex-direction:column;gap:40px;padding:40px;box-sizing:border-box;}
.makeke-page{position:relative;overflow:hidden;background:#fff;border-radius:24px;box-shadow:0 18px 55px rgba(0,0,0,.10);min-height:720px;}
${styles.join('\n')}
html,body{background:#f5f5f7!important;color:#1c1c1e;}
.makeke-deck{background:#f5f5f7!important;}
.makeke-page{background:#fff;color:#1c1c1e;}
</style>
</head>
<body>
<main class="makeke-deck" data-makeke-multi-html="true" data-slide-count="${pages.length}">
${pages.join('\n')}
</main>
<script>${scripts.join('\n')}</script>
</body>
</html>`;
  }

  function _scopeMergedPageCss(css, pageNumber) {
    const scope = `.makeke-page[data-makeke-page="${pageNumber}"]`;
    return String(css || '')
      .replace(/(^|})\s*html\s*,\s*body\s*\{/gi, `$1 ${scope}{`)
      .replace(/(^|})\s*body\s*\{/gi, `$1 ${scope}{`)
      .replace(/(^|})\s*html\s*\{/gi, `$1 ${scope}{`);
  }

  function _openDesignStyleInstruction(style) {
    const key = String(style || '').trim();
    const rules = {
      'od-editorial-monocle': [
        '- 시각 방향: 에디토리얼 모노클. 큰 제목, 강한 흑백 대비, 얇은 구분선, 작은 캡션, 잡지형 정보 위계를 사용합니다.',
        '- 장식보다 타이포그래피와 기사식 리듬을 우선하고, 한 화면에서 표지/본문/캡션 관계가 분명해야 합니다.'
      ],
      'od-modern-minimal': [
        '- 시각 방향: 모던 미니멀. 여백, 부드러운 표면, 절제된 색, 명확한 CTA, 단순한 카드 위계를 사용합니다.',
        '- 흐릿한 장식 배경보다 실제 제품/문구/상태가 또렷하게 읽히는 구조를 우선합니다.'
      ],
      'od-tech-utility': [
        '- 시각 방향: 테크 유틸리티. 대시보드형 그리드, 상태 배지, 데이터 카드, 명확한 표와 필터를 사용합니다.',
        '- SaaS/운영 도구처럼 반복 사용자가 빠르게 스캔할 수 있게 밀도와 가독성을 함께 맞춥니다.'
      ],
      'od-brutalist': [
        '- 시각 방향: 브루탈리스트 실험. 두꺼운 테두리, 강한 블록, 큰 숫자, 의도적인 대비를 사용합니다.',
        '- 거칠게 보이더라도 정보 구조와 버튼 가독성은 무너지면 안 됩니다.'
      ],
      'od-soft-warm': [
        '- 시각 방향: 소프트 웜. 따뜻한 여백, 부드러운 그림자, 사람 중심의 카피, 편안한 이미지 영역을 사용합니다.',
        '- 베이지 일색으로 흐르지 않게 브랜드 색상과 보조색을 함께 사용합니다.'
      ],
      'od-system-openai': [
        '- 디자인 시스템 참고: OpenAI식 절제와 지성. 넓은 여백, 차분한 흑백/중성 팔레트, 또렷한 문장 위계, 최소한의 선을 사용합니다.',
        '- 특정 회사 로고나 UI를 사칭하지 말고, 조용하고 정확한 정보 설계 원칙만 반영합니다.'
      ],
      'od-system-stripe': [
        '- 디자인 시스템 참고: Stripe식 제품 마케팅. 선명한 그라데이션은 제한적으로, 제품 카드/코드/대시보드 조각을 레이어로 배치하고 CTA를 분명히 합니다.',
        '- 과도한 보라/파랑 반복을 피하고 현재 브랜드 색상을 주 색상으로 재해석합니다.'
      ],
      'od-system-apple': [
        '- 디자인 시스템 참고: Apple식 프리미엄 제품 표현. 큰 제품/이미지, 짧은 문장, 깊은 여백, 정밀한 타이포그래피를 사용합니다.',
        '- 특정 제품 UI나 상표를 복제하지 말고 프리미엄 제품 서사의 구성만 반영합니다.'
      ],
      'od-system-material': [
        '- 디자인 시스템 참고: Material식 체계. 명확한 elevation, 상태, 입력, 토글, 카드, 접근성 있는 컬러 대비를 사용합니다.',
        '- 컴포넌트 상태가 실제 앱처럼 보이게 hover/active/empty 상태를 포함합니다.'
      ],
      'od-system-shadcn': [
        '- 디자인 시스템 참고: Shadcn식 현대 SaaS. 얇은 경계선, 작은 radius, 중성 배경, 깔끔한 form/table/card 구조를 사용합니다.',
        '- 마케팅 과장보다 도구다운 정돈과 재사용 가능한 컴포넌트 계층을 우선합니다.'
      ],
      'od-system-xiaohongshu': [
        '- 디자인 시스템 참고: Xiaohongshu식 콘텐츠 커머스. 세로/정사각 카드, 강한 훅, 이미지 우선 구성, 저장/공유 맥락을 사용합니다.',
        '- 원본 서비스를 복제하지 말고 콘텐츠 발견, 신뢰 후기, 짧은 CTA 구조만 현재 브랜드에 맞게 재작성합니다.'
      ]
    };
    const lines = rules[key];
    return lines ? `\n[Open Design 스타일/시스템 팩]\n${lines.join('\n')}\n` : '';
  }

  function _buildCliGeneratePrompt(ctx, prompt, referenceRule) {
    const size = ctx.aspect === '16:9' ? '1920x1080'
      : ctx.aspect === '9:16' ? '1080x1920'
        : ctx.aspect === 'A4' ? '2480x3508'
          : ctx.aspect === '4:3' ? '1440x1080'
            : '1080x1080';
    return `[절대 규칙] 파일을 생성하거나 저장하지 마세요. 이 대화에 HTML 코드 전체를 직접 출력하세요. <!DOCTYPE html> 부터 </html> 까지 완전한 HTML만 출력. 설명/마크다운/코드펜스 없이 순수 HTML만.

[산출물 유형] ${ctx.kind}
[캔버스 크기] ${size}
[디자인 스타일] ${ctx.designOptions.style}
${_openDesignStyleInstruction(ctx.designOptions.style)}
[제작 목적] ${ctx.designOptions.purpose}
[정보 밀도] ${ctx.designOptions.density}
[브랜드] ${ctx.brand || '없음'}
[브랜드 색상] ${ctx.colors.join(', ') || '없음'}
[프로필 업종] ${ctx.businessType || '없음'}
[프로필 기본 비즈니스 설명] ${ctx.businessDescription || '없음'}
[프로필 CTA] ${ctx.cta || '없음'}
[프로필 디자인 규칙] ${ctx.designRules || '없음'}
[참고 이미지 수] ${ctx.refImages.length}장
[요청] ${prompt}${referenceRule}${_buildKindSpecificInstruction(ctx.kind)}${_buildVisualDiversityInstruction(ctx, prompt)}

[프로필 색상 우선 규칙]
- 위 [브랜드 색상] 값이 있으면 그 색을 결과물의 주요 포인트, CTA, 배지, 라인, 그래프 색으로 우선 사용하세요.
- 위 [브랜드 색상] 값이 없으면 첨부 이미지/업종/주제에서 새 팔레트를 추론하세요.
- 마케케 앱 UI의 앱 기본 강조색(#ff8c00, #ff6b00)을 기본 브랜드 색처럼 사용하지 마세요. 프로필 색상에 앱 기본 강조색이 명시된 경우에만 사용하세요.

[여러 장 처리 규칙]
- 사용자가 4장, 5장, 8장처럼 장수를 말하면 반드시 정확히 그 개수의 <section class="makeke-page" data-slide="0">...</section>을 하나의 HTML 안에 만드세요.
- 여러 개의 독립 HTML 파일로 나누지 마세요.

[레이아웃 안전 규칙]
- 모든 주요 콘텐츠는 캔버스 안쪽 64px 이상 안전 여백 안에 완전히 보여야 합니다.
- 제목/본문/CTA 텍스트는 절대 잘리거나 캔버스 밖으로 나가면 안 됩니다.
- 큰 장식 타이포를 만들더라도 단어가 분리되거나 프레임 밖으로 밀리면 실패입니다.
- hero 제목은 clamp()로 반응형 크기를 제한하고, 최대 96px를 넘기지 마세요. 본문은 34px 이하, 보조 텍스트는 24px 이하를 기본으로 하세요.
- 텍스트가 들어가는 카드/박스/버튼에는 고정 height를 쓰지 말고 min-height와 padding, gap을 사용하세요. 내용이 늘어나면 카드도 같이 커져야 합니다.
- 여러 블록은 CSS grid/flex와 gap으로 배치하고, 텍스트 블록끼리 position:absolute로 겹치게 배치하지 마세요.
- position:absolute는 로고/장식/배경 이미지에만 제한적으로 쓰고, 텍스트·카드·CTA에는 쓰지 않는 것을 원칙으로 하세요. 꼭 쓰면 반드시 left/right/top/bottom과 max-width를 함께 지정하세요.
- overflow:hidden에 의존해 텍스트를 자르지 마세요. 텍스트 컨테이너는 overflow:visible 또는 auto-height여야 합니다.
- 한글은 word-break:keep-all; overflow-wrap:break-word; line-height:1.08 이상을 적용하세요.
- 카드 내부에는 min-width:0을 넣고, 긴 문장은 줄바꿈되게 하세요.
- 첫 화면 스크린샷에서 모든 텍스트, 버튼, 이미지가 온전히 보여야 합니다.

품질 기준: 선택한 스타일과 브랜드 색상, 프로필 기본 비즈니스 설명을 우선하고, 특정 기본 색을 강제하지 마세요. 참고 이미지가 제공되면 로고·제품·무드·색감의 시각 기준으로 활용하세요. 타이포 위계·여백·CTA·반응형 안전 영역을 명확히 설계하세요. 사용자가 이후 캔버스에서 각 요소를 클릭/이동/리사이즈하기 쉽도록 주요 블록은 의미 있는 class 이름을 붙이고, 텍스트는 실제 DOM 텍스트로 유지하세요. 주요 section, card, headline, paragraph, CTA, image에는 data-makeke-id를 고유하게 붙여 나중에 클릭한 요소만 안정적으로 수정할 수 있게 하세요.

중요: 반드시 <!DOCTYPE html>로 시작하는 완전한 HTML 문서를 이 응답에 직접 출력하세요.`;
  }

  function _showGeneratedDesign(html, meta, prompt, statusMsg, label) {
    _currentDesignId = '';
    _cdComments = [];
    _cdCommentDraftTarget = null;
    _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(html));
    _lastMeta = meta;
    _recordDesignFingerprint(_lastHtml);
    _pushVersion(_lastHtml, _lastMeta, prompt);
    _renderPreview(_lastHtml);
    if (typeof cdLoadCommentsForCurrentDesign === 'function') cdLoadCommentsForCurrentDesign([]);
    _setActionsEnabled(true);
    if (statusMsg) statusMsg.textContent = label;
    const kind = meta?.kind || '';
    const showVideo = _isRemotionDesignKind(kind) || _isThreeDesignKind(kind) || _isVideoDesignKind(kind);
    const actions = [
      { label: '🍌 이미지 채우기', onClick: () => cdQuickAction('이미지 채워주세요') },
      { label: '🔍 자동 검수', onClick: () => window.cdRunDesignReview?.() },
      { label: '💾 저장 + 공유 URL', onClick: cdSaveAndShare },
      { label: '⬇ HTML', onClick: cdDownload },
      { label: '🖼 PNG', onClick: cdExportPNG },
      { label: '📄 PDF', onClick: cdExportPDF },
      { label: '📊 PPTX', onClick: cdExportPPTX },
    ];
    if (showVideo) {
      actions.push({ label: '🎬 MP4 영상', onClick: cdExportVideo });
    }
    _addActionsCard(actions);
  }

  function _applyDesignSafetyToHtml(html) {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const style = doc.createElement('style');
      style.id = 'makeke-design-safety';
      style.textContent = `
        *,*::before,*::after{box-sizing:border-box}
        html,body{max-width:100%;overflow-x:hidden}
        body{word-break:keep-all;overflow-wrap:break-word}
        .makeke-page,[data-slide],[data-makeke-page]{overflow:hidden}
        .makeke-page *,[data-slide] *{max-width:100%;min-width:0;overflow-wrap:break-word}
        .makeke-page :is(h1,h2,h3,h4,p,li,span,strong,em,button),[data-slide] :is(h1,h2,h3,h4,p,li,span,strong,em,button){word-break:keep-all;overflow-wrap:break-word;text-wrap:pretty}
        .makeke-page :is(.card,.box,.panel,.tile,.item,[class*="card"],[class*="box"],[class*="panel"],[class*="tile"]),[data-slide] :is(.card,.box,.panel,.tile,.item,[class*="card"],[class*="box"],[class*="panel"],[class*="tile"]){height:auto;min-height:fit-content;overflow:visible}
        .makeke-page :is(.grid,.cards,.row,.columns,[class*="grid"],[class*="cards"],[class*="row"],[class*="columns"]),[data-slide] :is(.grid,.cards,.row,.columns,[class*="grid"],[class*="cards"],[class*="row"],[class*="columns"]){gap:max(12px,1.2vw)}
        img,svg,canvas,video{max-width:100%;height:auto}
        h1,.hero-title,.headline{font-size:clamp(44px,7vw,96px);line-height:1.05;letter-spacing:-0.02em}
        h2,.section-title{font-size:clamp(30px,4.5vw,64px);line-height:1.08}
        p,li,.body-copy{line-height:1.45}
      `;
      doc.head?.appendChild(style);
      Array.from(doc.querySelectorAll('[style]')).forEach(el => {
        const styleText = el.getAttribute('style') || '';
        const fixed = styleText.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (match, raw) => {
          const n = parseFloat(raw);
          if (!Number.isFinite(n) || n <= 112) return match;
          return 'font-size: clamp(44px, 7vw, 96px)';
        });
        if (fixed !== styleText) el.setAttribute('style', fixed);
      });
      _ensureMakekeEditableIds(doc);
      const isRemotionBoard = /remotion|timeline board|composition plan/i.test(`${doc.title || ''} ${doc.body?.textContent || ''}`);
      if (isRemotionBoard) {
        const motion = doc.createElement('style');
        motion.id = 'makeke-remotion-motion';
        motion.textContent = `
          @keyframes makekeFadeUp {
            from { opacity: 0; transform: translate3d(0, 18px, 0) scale(.985); }
            to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes makekePulseSoft {
            0%, 100% { transform: translate3d(0, 0, 0); }
            50% { transform: translate3d(0, -4px, 0); }
          }
          @keyframes makekeSweep {
            0% { transform: translateX(-8px); opacity: .65; }
            50% { transform: translateX(8px); opacity: 1; }
            100% { transform: translateX(-8px); opacity: .65; }
          }
          body > * {
            animation: makekeFadeUp .65s ease-out both;
          }
          body > *:nth-child(2) { animation-delay: .05s; }
          body > *:nth-child(3) { animation-delay: .10s; }
          body > *:nth-child(4) { animation-delay: .15s; }
          body > *:nth-child(5) { animation-delay: .20s; }
          [class*="scene"], [class*="card"], [class*="panel"], [class*="preview"], [class*="track"], [class*="layer"] {
            animation: makekePulseSoft 4.6s ease-in-out infinite;
            transform-origin: center;
          }
          [class*="timeline"], [class*="duration"], [class*="cue"], [class*="play"] {
            animation: makekeSweep 3.8s ease-in-out infinite;
            transform-origin: center;
          }
        `;
        doc.head?.appendChild(motion);
        const motionScript = doc.createElement('script');
        motionScript.id = 'makeke-remotion-motion-script';
        motionScript.textContent = `
          (function(){
            const applyMotion = function(){
              const selectors = [
                'header','main','section','article','aside',
                '.scene','.card','.panel','.preview','.track','.layer',
                '.timeline','.duration','.cue','.play',
                '[class*="scene"]','[class*="card"]','[class*="panel"]','[class*="preview"]',
                '[class*="track"]','[class*="layer"]','[class*="timeline"]','[class*="duration"]',
                '[class*="cue"]','[class*="play"]'
              ].join(',');
              const nodes = Array.from(document.querySelectorAll(selectors))
                .filter(function(el){
                  if (!el || el === document.body || el === document.documentElement) return false;
                  const rect = el.getBoundingClientRect();
                  return rect.width > 16 && rect.height > 16 && getComputedStyle(el).display !== 'none';
                })
                .slice(0, 12);
              nodes.forEach(function(el, index){
                const delay = (index * 90) + 'ms';
                el.style.animationDelay = delay;
                el.style.animationDuration = el.style.animationDuration || (2.8 + (index % 3) * 0.4) + 's';
                el.style.willChange = 'transform, opacity';
              });
              if (nodes[0]) {
                nodes[0].style.transformOrigin = 'center';
                nodes[0].style.animationName = 'makekePulseSoft';
              }
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', applyMotion, { once: true });
            } else {
              applyMotion();
            }
            setTimeout(applyMotion, 300);
          })();
        `;
        doc.body?.appendChild(motionScript);
      }
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch (_) {
      return html;
    }
  }

  function _ensureMakekeEditableIds(doc) {
    if (!doc?.body) return;
    const used = new Set();
    Array.from(doc.querySelectorAll('[data-makeke-id]')).forEach(el => {
      const raw = _normalizeMakekeId(el.getAttribute('data-makeke-id'));
      if (!raw || used.has(raw)) {
        el.removeAttribute('data-makeke-id');
        return;
      }
      el.setAttribute('data-makeke-id', raw);
      used.add(raw);
    });
    const selector = [
      'section.makeke-page',
      '[data-makeke-page]',
      'header',
      'main',
      'section',
      'article',
      'aside',
      'nav',
      'footer',
      'figure',
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'li',
      'a',
      'button',
      '.card',
      '.panel',
      '.tile',
      '.box',
      '.cta',
      '[class*="card"]',
      '[class*="panel"]',
      '[class*="tile"]',
      '[class*="box"]',
      '[class*="cta"]',
      '[class*="headline"]',
      '[class*="title"]'
    ].join(',');
    let index = 1;
    Array.from(doc.body.querySelectorAll(selector)).slice(0, 260).forEach(el => {
      const tag = (el.tagName || 'el').toLowerCase();
      if (['script', 'style', 'link', 'meta', 'template'].includes(tag)) return;
      if (el.hasAttribute('data-makeke-id')) return;
      let id = '';
      do {
        id = `mk-${tag}-${String(index).padStart(3, '0')}`;
        index += 1;
      } while (used.has(id));
      el.setAttribute('data-makeke-id', id);
      used.add(id);
    });
  }

  function _normalizeMakekeId(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
    return normalized || '';
  }

  function _applyAttachedImagesToHtml(html) {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const refs = _attachedImages.slice(0, 12);
      let used = 0;
      const fallbackSvg = (label) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff7ed"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient></defs><rect width="1200" height="800" rx="48" fill="url(#g)"/><circle cx="920" cy="190" r="120" fill="#ff8c00" opacity=".18"/><circle cx="260" cy="610" r="160" fill="#007aff" opacity=".12"/><text x="600" y="392" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#1c1c1e">${label || 'Makeke Design'}</text><text x="600" y="452" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#6b7280">이미지를 선택해 직접 교체하거나 AI 교체를 사용할 수 있습니다</text></svg>`)}`;
      const images = Array.from(doc.querySelectorAll('img'));
      const brokenOrLogo = images.filter(img => {
        const src = (img.getAttribute('src') || '').trim();
        const hint = `${img.getAttribute('alt') || ''} ${img.className || ''} ${img.id || ''}`.toLowerCase();
        return !src || src === '#' || src.startsWith('#reference-image') || src.includes('placeholder') || src.includes('source.unsplash.com') || src.includes('via.placeholder') || src.startsWith('/') || src.startsWith('./') || src.startsWith('../') || hint.includes('logo') || hint.includes('로고');
      });
      brokenOrLogo.forEach((img, index) => {
        img.setAttribute('src', refs[index % Math.max(1, refs.length)]?.dataUrl || fallbackSvg(img.getAttribute('alt') || '참고 이미지'));
        img.removeAttribute('srcset');
        img.setAttribute('data-makeke-reference-image', 'true');
        used += 1;
      });
      if (used === 0 && refs[0]) {
        const badge = doc.createElement('img');
        badge.setAttribute('src', refs[0].dataUrl);
        badge.setAttribute('alt', '첨부 로고/참조 이미지');
        badge.setAttribute('data-makeke-reference-image', 'true');
        badge.style.cssText = 'position:fixed;right:28px;top:28px;z-index:20;width:86px;height:86px;object-fit:contain;border-radius:16px;background:rgba(255,255,255,0.78);box-shadow:0 12px 32px rgba(0,0,0,0.16);padding:8px;';
        doc.body?.appendChild(badge);
      }
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch (_) {
      return html;
    }
  }

  async function _runCliDesign(tool, cliPrompt, refImages, signal, options = {}) {
    const body = {
      tool,
      prompt: cliPrompt,
      reference_images: refImages,
      timeout: options.timeout || 300,
    };
    if (options.designHtml) {
      body.design_html = options.designHtml;
      body.design_mode = options.designMode || 'edit';
    }
    const res = await fetch('/api/coding-agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${tool} CLI 실패 (${res.status}): ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    const html = _extractDesignHtmlFromCliData(data);
    if (!html) throw new Error(`${tool} 응답에 HTML이 없습니다.`);
    return html;
  }

  async function _runCliDesignWithHtmlRetry(tool, cliPrompt, refImages, signal, options = {}) {
    try {
      return await _runCliDesign(tool, cliPrompt, refImages, signal, options);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const retryPrompt = `${cliPrompt}

[재시도 - 매우 중요]
방금 응답에는 완성 HTML이 없었습니다.
설명하지 말고, 마크다운 코드펜스도 쓰지 말고, 지금 즉시 수정 완료된 전체 HTML만 출력하세요.
첫 글자는 반드시 <!DOCTYPE html> 이어야 하고 마지막은 </html> 이어야 합니다.`;
      return await _runCliDesign(tool, retryPrompt, refImages, signal, options);
    }
  }

  async function _agentGenerate(prompt, signal) {
    const preflight = _syncDesignPreflightInputs();
    const preflightPrompt = _buildDesignPreflightPromptBlock();
    const finalPrompt = `${prompt}${preflightPrompt}`;
    const kind = document.getElementById('cd-kind')?.value || 'general';
    const aspect = preflight.aspect || '16:9';
    const designOptions = _getDesignOptions();
    const { provider, model } = _parseProvider(document.getElementById('cd-provider')?.value);
    const brand = document.getElementById('cd-brand')?.value.trim();
    const businessType = document.getElementById('cd-business-type')?.value.trim() || '';
    const businessDescription = document.getElementById('cd-business-detail')?.value.trim() || '';
    const cta = document.getElementById('cd-cta')?.value.trim() || '';
    const designRules = preflight.designRules || '';
    const colors = (document.getElementById('cd-colors')?.value || '').split(/[,\s]+/).map(c => c.trim()).filter(Boolean);
    const refImages = _attachedImages.map(im => im.dataUrl);
    const refSources = _collectDesignReferenceSources();
    const referenceRule = _buildReferenceUsageInstruction(refImages, refSources);
    const refLabel = refImages.length ? ` · 참고이미지 ${refImages.length}장` : '';
    const srcLabel = refSources.length ? ` · 자료 ${refSources.length}건` : '';

    // CLI 선택 시 → coding-agent/run 으로 라우팅
    if (provider.startsWith('cli:')) {
      const tool = provider.slice(4); // claude | codex | kimi
      const statusMsg = _addChatMessage('status', `💻 ${tool} CLI 로 ${kind} 디자인 생성 중... (30~180초)`);
      const previousDesigns = _recentDesignFingerprintBlock();
      const cliPrompt = _buildCliGeneratePrompt({ kind, aspect, designOptions, brand, colors, businessType, businessDescription, cta, designRules, refImages, previousDesigns }, finalPrompt, referenceRule);
      try {
        const html = await _runCliDesignWithHtmlRetry(tool, cliPrompt, refImages, signal);
        _showGeneratedDesign(html, { kind, aspect_ratio: aspect, provider: tool + '-cli', model: tool }, finalPrompt, statusMsg, `✓ 완성! ${kind}·${aspect}·${tool} CLI`);
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        if (statusMsg) statusMsg.textContent = `❌ ${tool} CLI 에러: ${e.message}`;
      }
      return;
    }

    const modelLabel = model ? ` [${model.split('/').pop()}]` : '';
    const statusMsg = _addChatMessage('status', `🎨 ${kind} (${aspect}) 생성 중...${refLabel}${srcLabel}${modelLabel} (10~60초)`);
    const previousDesigns = _recentDesignFingerprintBlock();
    const res = await fetch('/api/claude-design/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: finalPrompt + referenceRule + _buildKindSpecificInstruction(kind) + _buildVisualDiversityInstruction({ kind }, finalPrompt) + '\n\n[여러 장 처리 규칙] 사용자가 4장, 5장, 8장처럼 장수를 말하면 반드시 정확히 그 개수의 <section class="makeke-page" data-slide="0">...</section>을 하나의 HTML 안에 만드세요. 여러 개의 독립 HTML 파일로 나누지 마세요.',
        kind,
        aspect_ratio: aspect,
        provider,
        model,
        brand_name: brand,
        brand_colors: colors,
        business_type: businessType,
        business_description: businessDescription,
        cta_text: cta,
        design_rules: designRules,
        design_style: designOptions.style,
        design_purpose: designOptions.purpose,
        design_density: designOptions.density,
        template_materials: _templateInputValue('cd-template-materials'),
        previous_design_summary: previousDesigns,
        reference_images: refImages,
        reference_sources: refSources,
      }),
      signal,
    });
    const data = await res.json();
    if (!res.ok || data.error === 'endpoint not implemented in go-native mode') {
      if (statusMsg) statusMsg.textContent = 'Go 모드 디자인 API가 없어 Codex CLI로 생성 중...';
      const cliPrompt = _buildCliGeneratePrompt({ kind, aspect, designOptions, brand, colors, businessType, businessDescription, cta, designRules, refImages, previousDesigns }, finalPrompt, referenceRule);
      const html = await _runCliDesignWithHtmlRetry('codex', cliPrompt, refImages, signal);
      _showGeneratedDesign(html, { kind, aspect_ratio: aspect, provider: 'codex-cli', model: 'codex' }, finalPrompt, statusMsg, `✓ 완성! ${kind}·${aspect}·Codex CLI`);
      return;
    }
    if (data.error_code) {
      if (statusMsg) statusMsg.textContent = data.message || '생성 실패';
      return;
    }
    if (data.status !== 'ok' || !data.html) throw new Error('빈 응답');
    _currentDesignId = '';
    _cdComments = [];
    _cdCommentDraftTarget = null;
    _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
    _lastMeta = { kind, aspect_ratio: aspect, provider: data.provider, model: data.model };
    _recordDesignFingerprint(_lastHtml);
    _pushVersion(_lastHtml, _lastMeta, prompt);
    _renderPreview(_lastHtml);
    if (typeof cdLoadCommentsForCurrentDesign === 'function') cdLoadCommentsForCurrentDesign([]);
    _setActionsEnabled(true);
    if (statusMsg) statusMsg.textContent = `✓ 완성! ${kind}·${aspect}·${data.model}`;
    const apiActions = [
      { label: '🍌 이미지 채우기', onClick: () => cdQuickAction('이미지 채워주세요') },
      { label: '🔍 자동 검수', onClick: () => window.cdRunDesignReview?.() },
      { label: '💾 저장 + 공유 URL', onClick: cdSaveAndShare },
      { label: '⬇ HTML', onClick: cdDownload },
      { label: '🖼 PNG', onClick: cdExportPNG },
      { label: '📄 PDF', onClick: cdExportPDF },
      { label: '📊 PPTX', onClick: cdExportPPTX },
      { label: '🎬 MP4 영상', onClick: cdExportVideo },
    ];
    _addActionsCard(apiActions);
    _addChatMessage('ai', '결과를 우측에 표시했습니다. 수정 사항이 있으면 자연어로 말씀해주세요. (예: "배경을 네이비로", "제목 더 크게")');
  }

  async function _agentEdit(instruction, signal) {
    const refImages = _attachedImages.map(im => im.dataUrl);
    const refSources = _collectDesignReferenceSources();
    const refLabel = refImages.length ? ` · 참고 이미지 ${refImages.length}장` : '';
    const srcLabel = refSources.length ? ` · 자료 ${refSources.length}건` : '';
    const { provider, model } = _parseProvider(document.getElementById('cd-provider')?.value);
    let finalInstruction = instruction;
    // 인라인 편집 대상이 선택되어 있으면 컨텍스트 추가
    if (_selectedElement) {
      finalInstruction = `[선택된 요소 ${_selectedElement.selector}]\n${_selectedElement.html.slice(0, 400)}\n\n[지시] ${instruction}`;
    }
    finalInstruction += _buildReferenceUsageInstruction(refImages, refSources);
    const statusMsg = _addChatMessage('status', `✏️ 편집 중... (${instruction.slice(0, 40)})${refLabel}${srcLabel}`);
    if (provider.startsWith('cli:')) {
      const tool = provider.slice(4);
      const cliPrompt = _buildHtmlOnlyEditPrompt(tool, finalInstruction);
      const html = await _runCliDesignWithHtmlRetry(tool, cliPrompt, refImages, signal, { designHtml: _lastHtml, designMode: 'edit' });
      _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(html));
      _pushVersion(_lastHtml, _lastMeta, instruction);
      _renderPreview(_lastHtml);
      if (statusMsg) statusMsg.textContent = `✓ ${tool} 수정 반영 완료`;
      _addChatMessage('ai', '수정했습니다. 더 바꿀 부분을 이어서 말씀해주세요.');
      _selectedElement = null;
      _updateInlineEditChip();
      return;
    }
    const res = await fetch('/api/claude-design/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: _lastHtml, instruction: finalInstruction, provider, model, reference_images: refImages, reference_sources: refSources }),
      signal,
    });
    const data = await res.json();
    if (!res.ok || data.error === 'endpoint not implemented in go-native mode') {
      if (statusMsg) statusMsg.textContent = 'Go 모드 편집 API가 없어 Codex CLI로 수정 중...';
      const cliPrompt = _buildHtmlOnlyEditPrompt('codex', finalInstruction);
      const html = await _runCliDesignWithHtmlRetry('codex', cliPrompt, refImages, signal, { designHtml: _lastHtml, designMode: 'edit' });
      _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(html));
      _pushVersion(_lastHtml, _lastMeta, instruction);
      _renderPreview(_lastHtml);
      if (statusMsg) statusMsg.textContent = '✓ Codex CLI 수정 반영 완료';
      _addChatMessage('ai', '수정했습니다. 더 바꿀 부분을 이어서 말씀해주세요.');
      _selectedElement = null;
      _updateInlineEditChip();
      return;
    }
    if (data.error_code) {
      if (statusMsg) statusMsg.textContent = data.message || '편집 실패';
      return;
    }
    if (data.status === 'ok' && data.html) {
      _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
      _pushVersion(_lastHtml, _lastMeta, instruction);
      _renderPreview(_lastHtml);
      if (statusMsg) statusMsg.textContent = `✓ 반영 완료`;
      _addChatMessage('ai', '수정했습니다. 더 바꾸실 부분이 있으면 말씀해주세요.');
      // 선택 해제
      _selectedElement = null;
      _updateInlineEditChip();
    }
  }

  async function _agentEnhanceImages(signal) {
    const aspect = document.getElementById('cd-aspect')?.value || '1:1';
    const statusMsg = _addChatMessage('status', `🍌 Nano Banana 2 로 이미지 생성 중...`);
    const res = await fetch('/api/claude-design/enhance-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: _lastHtml, aspect_ratio: aspect, max_images: 8 }),
      signal,
    });
    const data = await res.json();
    if (data.status === 'ok' && data.html) {
      _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
      _pushVersion(_lastHtml, _lastMeta, '이미지 채우기');
      _renderPreview(_lastHtml);
      if (statusMsg) statusMsg.textContent = `✓ 이미지 ${data.replaced || 0}개 교체`;
    } else {
      if (statusMsg) statusMsg.textContent = '이미지 생성 실패';
    }
  }

  // 기존 폼 방식 cdGenerate 는 하위 호환용 유지 (agent 로 위임)
  async function cdGenerate() {
    const p = document.getElementById('cd-prompt')?.value.trim() || document.getElementById('cd-input')?.value.trim();
    if (p) {
      const inp = document.getElementById('cd-input');
      if (inp) inp.value = p;
      await cdSendMessage();
    }
  }
  window.cdGenerate = cdGenerate;

  async function cdGenerate() {
    const prompt = document.getElementById('cd-prompt')?.value.trim();
    if (!prompt) { if (typeof toast === 'function') toast('요청 내용을 입력하세요', 'error'); return; }
    const preflight = _syncDesignPreflightInputs();
    const finalPrompt = `${prompt}${_buildDesignPreflightPromptBlock()}`;
    const kind = document.getElementById('cd-kind')?.value || 'general';
    const aspect = preflight.aspect || '16:9';
    const designOptions = _getDesignOptions();
    const provider = document.getElementById('cd-provider')?.value || '';
    const brand = document.getElementById('cd-brand')?.value.trim();
    const businessType = document.getElementById('cd-business-type')?.value.trim() || '';
    const businessDescription = document.getElementById('cd-business-detail')?.value.trim() || '';
    const cta = document.getElementById('cd-cta')?.value.trim() || '';
    const designRules = preflight.designRules || '';
    const colors = (document.getElementById('cd-colors')?.value || '')
      .split(/[,\s]+/).map(c => c.trim()).filter(Boolean);
    const btn = document.getElementById('cd-generate-btn');
    const status = document.getElementById('cd-status');
    const iframe = document.getElementById('cd-preview');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></span> 생성 중…'; }
    if (status) status.textContent = 'AI 디자이너가 HTML 작성 중 (10~60초)...';
    try {
      const res = await fetch('/api/claude-design/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt, kind, aspect_ratio: aspect, provider,
          brand_name: brand,
          brand_colors: colors,
          business_type: businessType,
          business_description: businessDescription,
          cta_text: cta,
          design_rules: designRules,
          design_style: designOptions.style,
          design_purpose: designOptions.purpose,
          design_density: designOptions.density,
          previous_design_summary: _recentDesignFingerprintBlock(),
          reference_images: _attachedImages.map(im => im.dataUrl),
        }),
      });
      const data = await res.json();
      if (data.error_code) {
        if (status) { status.style.color = '#ff3b30'; status.textContent = data.message || '생성 실패'; }
        return;
      }
      if (data.status !== 'ok' || !data.html) {
        throw new Error('빈 응답');
      }
      _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
      _lastMeta = { kind, aspect_ratio: aspect, provider: data.provider, model: data.model };
      _recordDesignFingerprint(_lastHtml);
      _pushVersion(_lastHtml, _lastMeta, prompt);
      _renderPreview(_lastHtml);
      _setActionsEnabled(true);
      if (status) { status.style.color = '#34c759'; status.textContent = `✓ 완료 (${data.model || data.provider})`; }
      if (typeof toast === 'function') toast('디자인 생성 완료');
    } catch (e) {
      if (status) { status.style.color = '#ff3b30'; status.textContent = '생성 실패: ' + (e?.message || e); }
      if (typeof toast === 'function') toast('디자인 생성 실패: ' + (e?.message || e), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '🎨 디자인 생성'; }
    }
  }
  window.cdGenerate = cdGenerate;

  function _setActionsEnabled(on) {
    ['cd-save-btn', 'cd-download-btn', 'cd-open-btn', 'cd-export-png-btn', 'cd-export-pdf-btn', 'cd-export-pptx-btn', 'cd-export-video-btn', 'cd-export-svg-btn', 'cd-export-md-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = !on; el.style.opacity = on ? '1' : '0.5'; }
    });
    const toolbar = document.getElementById('cd-edit-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const sliders = document.getElementById('cd-sliders-card');
    if (sliders) sliders.style.display = 'none';
    const dock = document.getElementById('cd-chat-dock');
    if (dock) {
      dock.style.display = 'flex';
      dock.style.left = '';
      dock.style.top = '';
      dock.style.right = '';
      dock.style.bottom = '';
    }
    const designPage = document.getElementById('page-claude-design');
    designPage?.classList.toggle('cd-chat-started', !!on);
    designPage?.classList.toggle('cd-has-preview', !!_lastHtml);
    const chatCol = document.getElementById('cd-chat-col');
    if (chatCol) chatCol.style.gridColumn = '1';
    const input = document.getElementById('cd-input');
    const bottomSetup = document.getElementById('cd-bottom-setup');
    const previewCol = document.getElementById('cd-preview-col');
    if (previewCol) {
      previewCol.style.gridColumn = '3';
      if (on || _lastHtml) {
        const history = document.getElementById('cd-history-panel');
        previewCol.style.display = 'flex';
        previewCol.style.flex = '';
        previewCol.style.margin = '0';
        previewCol.style.minHeight = '0';
        previewCol.style.maxHeight = 'none';
        previewCol.style.border = '1px solid rgba(0,0,0,0.06)';
        previewCol.style.borderRadius = '20px';
        previewCol.style.boxShadow = '0 12px 34px rgba(0,0,0,0.05)';
        if (history && _lastHtml) {
          history.style.display = 'flex';
          history.style.maxHeight = 'none';
          history.style.minHeight = '220px';
          _setDesignInputMode(input, true);
          if (bottomSetup) {
            bottomSetup.style.setProperty('display', 'none', 'important');
            bottomSetup.style.setProperty('max-height', '0', 'important');
          }
        } else if (history) {
          history.style.maxHeight = '220px';
          _setDesignInputMode(input, false);
          if (bottomSetup) {
            bottomSetup.style.removeProperty('display');
            bottomSetup.style.removeProperty('max-height');
          }
        }
      } else {
        previewCol.style.display = 'none';
      }
    }
    const resizer = document.getElementById('cd-layout-resizer');
    if (resizer) resizer.style.display = 'none';
    const layout = document.getElementById('cd-layout');
    if (layout) {
      layout.style.gridTemplateColumns = (on || _lastHtml)
        ? (_lastHtml ? 'minmax(320px,0.55fr) 0 minmax(720px,1.45fr)' : 'minmax(420px,0.86fr) 0 minmax(620px,1.14fr)')
        : '1fr 0 minmax(0,0fr)';
      layout.style.gap = (on || _lastHtml) ? '14px' : '0';
    }
  }
  // versions_chat.cdResetChat 에서 호출하도록 전역 노출
  window._setActionsEnabled = _setActionsEnabled;

  function _showPreviewShell() {
    const previewCol = document.getElementById('cd-preview-col');
    if (!previewCol) return;
    const chatCol = document.getElementById('cd-chat-col');
    if (chatCol) chatCol.style.gridColumn = '1';
    previewCol.style.gridColumn = '3';
    previewCol.style.display = 'flex';
    previewCol.style.flex = '';
    previewCol.style.margin = '0';
    previewCol.style.minHeight = '0';
    previewCol.style.maxHeight = 'none';
    previewCol.style.border = '1px solid rgba(0,0,0,0.06)';
    previewCol.style.borderRadius = '20px';
    previewCol.style.boxShadow = '0 12px 34px rgba(0,0,0,0.05)';
    if (_lastHtml) {
      const history = document.getElementById('cd-history-panel');
      const input = document.getElementById('cd-input');
      const bottomSetup = document.getElementById('cd-bottom-setup');
      if (history) {
        history.style.display = 'flex';
        history.style.maxHeight = 'none';
        history.style.minHeight = '220px';
      }
      _setDesignInputMode(input, true);
      if (bottomSetup) {
        bottomSetup.style.setProperty('display', 'none', 'important');
        bottomSetup.style.setProperty('max-height', '0', 'important');
      }
    }
    const layout = document.getElementById('cd-layout');
    if (layout) {
      layout.style.gridTemplateColumns = _lastHtml ? 'minmax(320px,0.55fr) 0 minmax(720px,1.45fr)' : 'minmax(420px,0.86fr) 0 minmax(620px,1.14fr)';
      layout.style.gap = '14px';
    }
  }

  // 🎚 Claude 가 디자인에 맞는 슬라이더 3~5개 제안 → CSS 변수로 실시간 적용
  async function cdSuggestSliders() {
    if (!_lastHtml) return;
    const btn = document.getElementById('cd-sliders-btn');
    const box = document.getElementById('cd-sliders-list');
    if (btn) { btn.disabled = true; btn.innerHTML = '🤖 추천 중...'; }
    if (box) box.innerHTML = '<div style="padding:8px;font-size:10px;color:rgba(0,0,0,0.4);grid-column:1/-1;">Claude 가 슬라이더를 구상 중입니다...</div>';
    try {
      const res = await fetch('/api/claude-design/suggest-sliders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: _lastHtml }),
      });
      const data = await res.json();
      const sliders = data?.sliders || [];
      if (!sliders.length) {
        box.innerHTML = '<div style="padding:8px;font-size:10px;color:rgba(255,59,48,0.6);grid-column:1/-1;">슬라이더 추천 실패</div>';
        return;
      }
      box.innerHTML = sliders.map((s, i) => {
        const isColor = s.type === 'color';
        if (isColor) {
          return `<div style="font-size:10px;">
            <label style="display:block;color:rgba(0,0,0,0.7);margin-bottom:2px;">${_esc(s.label || s.var)}</label>
            <input type="color" value="${_esc(s.default || '#ff8c00')}" oninput="cdApplySliderCss('${_esc(s.var)}', this.value)" style="width:100%;height:28px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);">
          </div>`;
        }
        const unit = s.unit || '';
        return `<div style="font-size:10px;">
          <label style="display:flex;justify-content:space-between;color:rgba(0,0,0,0.7);margin-bottom:2px;">
            <span>${_esc(s.label || s.var)}</span>
            <span id="cd-slider-val-${i}" style="color:#5856d6;font-weight:700;">${s.default || s.min || 0}${unit}</span>
          </label>
          <input type="range" min="${s.min || 0}" max="${s.max || 100}" step="${s.step || 1}" value="${s.default || s.min || 0}"
            oninput="document.getElementById('cd-slider-val-${i}').textContent=this.value+'${unit}';cdApplySliderCss('${_esc(s.var)}', this.value+'${unit}')"
            style="width:100%;">
        </div>`;
      }).join('');
    } catch (e) {
      box.innerHTML = `<div style="color:#ff3b30;">${_esc(e?.message || e)}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '🤖 슬라이더 추천'; }
    }
  }
  window.cdSuggestSliders = cdSuggestSliders;

  // 슬라이더 값 변경 시 iframe 내부 CSS 변수 실시간 갱신
  function cdApplySliderCss(varName, value) {
    const iframe = document.getElementById('cd-preview');
    try {
      const doc = iframe?.contentDocument;
      if (!doc || !doc.documentElement) return;
      doc.documentElement.style.setProperty(varName, value);
      // body 에도 적용 (CSS 변수 상속)
      if (doc.body) doc.body.style.setProperty(varName, value);
    } catch (_) { /* same-origin 권한 필요 */ }
  }
  window.cdApplySliderCss = cdApplySliderCss;

  // 🍌 Nano Banana 2 — HTML 의 placeholder 이미지를 실제 AI 이미지로 교체
  async function cdEnhanceImages() {
    if (!_lastHtml) return;
    const btn = document.getElementById('cd-banana-btn');
    const aspect = document.getElementById('cd-aspect')?.value || '1:1';
    const orig = btn?.innerHTML || '';
    if (btn) { btn.disabled = true; btn.innerHTML = '🍌 이미지 생성 중...'; }
    _setDesignBusy(true, '이미지를 생성하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.');
    try {
      _ensureImageSlotsBeforeEnhance();
      const res = await fetch('/api/claude-design/enhance-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: _lastHtml, aspect_ratio: aspect, max_images: 8 }),
      });
      const data = await res.json();
      if (data.status === 'ok' && data.html) {
        _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
        _pushVersion(_lastHtml, _lastMeta, '이미지 채우기');
        _renderPreview(_lastHtml);
        if (typeof toast === 'function') toast(`🍌 이미지 ${data.replaced || 0}개 교체 완료`);
      } else {
        await _enhanceImagesViaBlogGenerator(aspect);
      }
    } catch (e) {
      try {
        await _enhanceImagesViaBlogGenerator(aspect);
      } catch (fallbackError) {
        if (typeof toast === 'function') toast('이미지 생성 실패: ' + (fallbackError?.message || fallbackError || e), 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig || '🍌 이미지 채우기 (Nano Banana 2)'; }
      _setDesignBusy(false);
    }
  }
  window.cdEnhanceImages = cdEnhanceImages;

  function _ensureImageSlotsBeforeEnhance() {
    const doc = document.getElementById('cd-preview')?.contentDocument;
    if (!doc?.body) return;
    const hasSlot = doc.querySelector('img[data-gen-prompt], img[src=""], img[src="#"], img[src*="placeholder"], img[src*="source.unsplash.com"]');
    if (hasSlot) {
      _syncPreviewHtml(doc);
      return;
    }
    const host = doc.querySelector('main, section, .hero') || doc.body;
    const img = doc.createElement('img');
    img.setAttribute('src', '#');
    img.setAttribute('alt', '현재 디자인 분위기에 어울리는 고품질 메인 비주얼 이미지');
    img.setAttribute('data-gen-prompt', '현재 HTML 디자인의 브랜드, 색상, 카피, 레이아웃에 자연스럽게 어울리는 고품질 메인 비주얼. 텍스트, 워터마크, 로고 없이.');
    img.style.cssText = 'width:100%;max-height:42%;object-fit:cover;border-radius:24px;display:block;margin:24px auto;';
    host.appendChild(img);
    _syncPreviewHtml(doc);
  }

  async function _enhanceImagesViaBlogGenerator(aspect) {
    const doc = document.getElementById('cd-preview')?.contentDocument;
    if (!doc?.body) throw new Error('프리뷰 접근 실패');
    const slots = Array.from(doc.querySelectorAll('img[data-gen-prompt], img[src=""], img[src="#"], img[src*="placeholder"], img[src*="source.unsplash.com"]')).slice(0, 4);
    if (!slots.length) throw new Error('이미지 슬롯을 찾지 못했습니다.');
    const prompts = slots.map((img, i) => img.getAttribute('data-gen-prompt') || img.getAttribute('alt') || `디자인에 어울리는 이미지 ${i + 1}`);
    const res = await fetch('/api/blog/generate-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: document.getElementById('cd-brand')?.value || _lastMeta.kind || 'makeke-design',
        content: doc.body.innerText || _lastHtml.slice(0, 2000),
        count: prompts.length,
        image_prompts: prompts,
        source_context: _collectDesignReferenceSources().map(s => `${s.title}\n${s.snippet || ''}`).join('\n\n'),
        user_image_urls: _attachedImages.map(im => im.sourceUrl || im.dataUrl).filter(Boolean),
        design_rules: `마케케디자인 ${aspect} 결과물에 삽입할 이미지. HTML의 색감, 레이아웃, 브랜드 이미지와 어울리게 생성. 텍스트/워터마크/가짜 로고 금지.`,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Go 이미지 생성 실패');
    const images = Array.isArray(data.images) ? data.images : [];
    images.forEach((item, i) => {
      if (!slots[i]) return;
      slots[i].setAttribute('src', item.url || item.path || '');
      slots[i].removeAttribute('srcset');
    });
    _syncPreviewHtml(doc);
    _lastHtml = _buildPreviewHtml(doc);
    _pushVersion(_lastHtml, _lastMeta, '이미지 채우기');
    _renderPreview(_lastHtml);
    if (typeof toast === 'function') toast(`이미지 ${images.length}개 생성해서 넣었습니다`);
  }

  // ✏️ 편집 — 자연어 지시로 기존 HTML 수정
  async function cdApplyEdit() {
    if (!_lastHtml) return;
    const input = document.getElementById('cd-edit-input');
    const instruction = (input?.value || '').trim();
    if (!instruction) { if (typeof toast === 'function') toast('편집 지시를 입력하세요', 'error'); return; }
    const btn = document.getElementById('cd-edit-btn');
    const orig = btn?.innerHTML || '';
    if (btn) { btn.disabled = true; btn.innerHTML = '✏️ 편집 중...'; }
    _setDesignBusy(true, '수정안을 생성하고 있습니다. 완료될 때까지 화면 편집을 잠시 막았습니다.');
    try {
      const res = await fetch('/api/claude-design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: _lastHtml, instruction }),
      });
      const data = await res.json();
      if (data.error_code) {
        if (typeof toast === 'function') toast(data.message || '편집 실패', 'error');
        return;
      }
      if (data.status === 'ok' && data.html) {
        _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
        _renderPreview(_lastHtml);
        if (input) input.value = '';
        if (typeof toast === 'function') toast('편집 완료');
      }
    } catch (e) {
      if (typeof toast === 'function') toast('편집 실패: ' + (e?.message || e), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = orig || '✏️ 편집'; }
      _setDesignBusy(false);
    }
  }
  window.cdApplyEdit = cdApplyEdit;

  // ─── 내보내기 ───────────────────────────────────────────────
  // iframe 에서 html2canvas 로 렌더링할 body 요소 획득
  function _getPreviewBody() {
    const iframe = document.getElementById('cd-preview');
    try { return iframe?.contentDocument?.body || null; }
    catch (e) { return null; }
  }

  function _getPreviewDocForExport() {
    const iframe = document.getElementById('cd-preview');
    try { return iframe?.contentDocument || null; }
    catch (e) { return null; }
  }

  function _getDesignExportSlides(doc) {
    if (!doc) return [];
    const selector = [
      'section.makeke-page',
      '[data-makeke-page]',
      '[data-cd-slide]',
      '[data-slide]',
      'main.makeke-page',
      '.makeke-page'
    ].join(',');
    const candidates = Array.from(doc.querySelectorAll(selector))
      .filter(el => el && el.offsetWidth > 80 && el.offsetHeight > 80);
    return candidates.filter((el, _, list) => !list.some(other => other !== el && other.contains(el)));
  }

  function _pickVisibleExportTarget(doc) {
    const slides = _getDesignExportSlides(doc);
    if (!slides.length) return doc?.body || null;
    const active = slides.find(el => el.classList.contains('cd-active') || el.getAttribute('aria-current') === 'true');
    if (active) return active;
    const viewH = doc.defaultView?.innerHeight || doc.documentElement?.clientHeight || 900;
    const viewW = doc.defaultView?.innerWidth || doc.documentElement?.clientWidth || 1200;
    let best = slides[0];
    let bestScore = -Infinity;
    slides.forEach(el => {
      const rect = el.getBoundingClientRect();
      const visibleW = Math.max(0, Math.min(rect.right, viewW) - Math.max(rect.left, 0));
      const visibleH = Math.max(0, Math.min(rect.bottom, viewH) - Math.max(rect.top, 0));
      const visibleArea = visibleW * visibleH;
      const centerPenalty = Math.abs((rect.top + rect.bottom) / 2 - viewH / 2) * 0.15;
      const score = visibleArea - centerPenalty;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });
    return best;
  }

  async function _renderDesignElementCanvas(el, backgroundColor) {
    if (!el || !window.html2canvas) throw new Error('렌더링 대상이 없습니다');
    return html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      backgroundColor,
      logging: false,
      windowWidth: Math.max(el.scrollWidth, el.ownerDocument.documentElement?.scrollWidth || 0, el.offsetWidth),
      windowHeight: Math.max(el.scrollHeight, el.ownerDocument.documentElement?.scrollHeight || 0, el.offsetHeight),
    });
  }

  async function cdExportPNG() {
    const doc = _getPreviewDocForExport();
    const body = doc?.body;
    const target = _pickVisibleExportTarget(doc);
    if ((!target && !body) || !window.html2canvas) { if (typeof toast === 'function') toast('프리뷰 접근 실패', 'error'); return; }
    try {
      const slideEls = _getDesignExportSlides(doc);
      if (slideEls.length > 1) {
        if (typeof toast === 'function') toast(`PNG ${Math.min(slideEls.length, 40)}장을 각각 저장하는 중...`);
        const slides = [];
        for (const el of slideEls.slice(0, 40)) {
          const canvas = await _renderDesignElementCanvas(el, null);
          slides.push(canvas.toDataURL('image/png'));
        }
        const res = await fetch('/api/claude-design/export/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides, title: _lastMeta.kind || 'design', name: _lastMeta.kind || 'design' }),
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'PNG 이미지 저장 실패');
        const a = document.createElement('a');
        a.href = data.url;
        a.download = data.name || 'makeke-design-images.zip';
        a.click();
        if (typeof toast === 'function') toast(`PNG ${data.images_count || slides.length}장을 ZIP으로 저장했어요`);
        return;
      }
      if (typeof toast === 'function') toast('PNG 렌더링 중...');
      const canvas = await _renderDesignElementCanvas(slideEls[0] || target || body, null);
      canvas.toBlob(blob => {
        if (!blob) throw new Error('PNG 변환 실패');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url; a.download = `claude-design-${ts}.png`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (e) {
      if (typeof toast === 'function') toast('PNG 렌더 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdExportPNG = cdExportPNG;

  async function cdExportPDF() {
    const doc = _getPreviewDocForExport();
    const target = _pickVisibleExportTarget(doc);
    if (!target || !window.html2canvas || !window.jspdf) { if (typeof toast === 'function') toast('PDF 라이브러리 로드 실패', 'error'); return; }
    if (typeof toast === 'function') toast('PDF 생성 중...');
    try {
      const canvas = await _renderDesignElementCanvas(target, '#ffffff');
      const aspect = document.getElementById('cd-aspect')?.value || '16:9';
      const { jsPDF } = window.jspdf;
      // aspect → PDF 페이지 사이즈 매핑
      const sizeMap = {
        '16:9': { w: 297, h: 167, orient: 'l' },    // 가로 A4 비슷
        '9:16': { w: 167, h: 297, orient: 'p' },
        '1:1': { w: 210, h: 210, orient: 'p' },
        '4:3': { w: 297, h: 222, orient: 'l' },
        'A4':  { w: 210, h: 297, orient: 'p' },
        'Letter': { w: 216, h: 279, orient: 'p' },
      };
      const s = sizeMap[aspect] || sizeMap['16:9'];
      const pdf = new jsPDF({ orientation: s.orient, unit: 'mm', format: [s.w, s.h] });
      const img = canvas.toDataURL('image/png');
      pdf.addImage(img, 'PNG', 0, 0, s.w, s.h);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      pdf.save(`claude-design-${ts}.pdf`);
    } catch (e) {
      if (typeof toast === 'function') toast('PDF 생성 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdExportPDF = cdExportPDF;

  async function cdExportPPTX() {
    const doc = _getPreviewDocForExport();
    const body = doc?.body;
    if (!body || !window.html2canvas) { if (typeof toast === 'function') toast('PPTX 렌더링 준비 실패', 'error'); return; }
    if (typeof toast === 'function') toast('PPTX 생성 중...');
    try {
      const slides = [];
      const slideEls = _getDesignExportSlides(doc);
      const editableSlides = [];
      if (slideEls.length > 1) {
        for (const el of slideEls.slice(0, 40)) {
          const canvas = await _renderDesignElementCanvas(el, '#ffffff');
          slides.push(canvas.toDataURL('image/png'));
          editableSlides.push(_extractEditablePPTXSlide(el));
        }
      } else {
        const target = slideEls[0] || body;
        const canvas = await _renderDesignElementCanvas(target, '#ffffff');
        slides.push(canvas.toDataURL('image/png'));
        editableSlides.push(_extractEditablePPTXSlide(target));
      }
      const aspect = document.getElementById('cd-aspect')?.value || '16:9';
      const res = await fetch('/api/claude-design/export/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides, editable_slides: editableSlides, aspect_ratio: aspect, title: _lastMeta.kind || 'design', name: _lastMeta.kind || 'design' }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok') throw new Error(data.error || 'PPTX 생성 실패');
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.name || 'makeke-design.pptx';
      a.click();
    } catch (e) {
      if (typeof toast === 'function') toast('PPTX 생성 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdExportPPTX = cdExportPPTX;

  function _injectVideoAnimations(html) {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      if (doc.getElementById('makeke-video-anim')) return html;
      const style = doc.createElement('style');
      style.id = 'makeke-video-anim';
      const animations = [
        ['makekeSlideUp', 'from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}'],
        ['makekeFadeIn', 'from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}'],
        ['makekeSlideLeft', 'from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}'],
        ['makekeZoomIn', 'from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}'],
        ['makekeDrop', 'from{opacity:0;transform:translateY(-30px)}to{opacity:1;transform:translateY(0)}'],
      ];
      style.textContent = animations.map(([n, k]) => `@keyframes ${n}{${k}}`).join('\n');
      doc.head.appendChild(style);
      const targets = Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,li,img,svg,button,a,.card,[class*="card"],[class*="hero"],[class*="cta"],[class*="feature"],[class*="benefit"],[class*="stat"]'))
        .filter(el => {
          if (!el || el === doc.body || el === doc.documentElement) return false;
          const tag = (el.tagName || '').toLowerCase();
          return !['script','style','noscript','meta','link','head'].includes(tag);
        })
        .slice(0, 20);
      targets.forEach((el, i) => {
        const anim = animations[i % animations.length][0];
        const delay = (i * 0.15).toFixed(2);
        const dur = (0.5 + Math.random() * 0.3).toFixed(2);
        el.style.animation = `${anim} ${dur}s ease-out ${delay}s both`;
      });
      return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch (_) {
      return html;
    }
  }

  async function cdExportVideo() {
    if (!_lastHtml) return;
    const doc = _getPreviewDocForExport();
    const slideEls = _getDesignExportSlides(doc);
    const duration = Math.max(4, Math.min(60, slideEls.length ? slideEls.length * 3 : 8));
    const kind = String(_lastMeta.kind || '').trim();
    const remotionMode = kind === 'remotion' || kind.startsWith('remotion-');
    const threeMode = _isThreeDesignKind(kind);
    const nameBase = (kind || 'design').replace(/[^a-z0-9가-힣_-]+/gi, '-');
    const videoHtml = threeMode ? _lastHtml : _injectVideoAnimations(_lastHtml);
    const payload = {
      html: videoHtml,
      name: nameBase || 'makeke-design',
      fps: 30,
      quality: 'high',
      format: 'mp4',
      duration,
      kind: kind || 'design',
    };
    if (typeof toast === 'function') toast('MP4 영상 렌더링을 시작했어요');
    try {
      const startResp = await fetch('/api/hyperframes/render-native-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const startData = await startResp.json();
      if (!startResp.ok || !startData.ok || !startData.jobId) {
        throw new Error(startData.detail || startData.error || '영상 렌더 잡을 만들지 못했습니다.');
      }
      const jobId = startData.jobId;
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResp = await fetch('/api/hyperframes/render-jobs/' + encodeURIComponent(jobId));
        const statusData = await statusResp.json();
        if (!statusResp.ok || !statusData.ok || !statusData.job) {
          throw new Error(statusData.detail || statusData.error || '영상 렌더 상태를 읽지 못했습니다.');
        }
        const job = statusData.job || {};
        if (job.status === 'failed' || job.stage === 'failed') {
          throw new Error(job.error || '영상 렌더 실패');
        }
        if (job.status === 'complete' || job.stage === 'complete') {
          const a = document.createElement('a');
          a.href = job.outputUrl || job.output_url || (job.filename ? '/api/hyperframes/output/' + encodeURIComponent(job.filename) : '');
          a.download = job.filename || `${nameBase || 'makeke-design'}.mp4`;
          a.click();
          if (typeof toast === 'function') toast('MP4 영상 저장이 완료됐어요');
          return;
        }
      }
    } catch (e) {
      if (typeof toast === 'function') toast('MP4 영상 저장 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdExportVideo = cdExportVideo;

  function _extractEditablePPTXSlide(root) {
    const rect = root?.getBoundingClientRect?.() || { width: 1200, height: 675, left: 0, top: 0 };
    const doc = root?.ownerDocument || document;
    const win = doc.defaultView || window;
    const elements = [];
    const candidates = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,button,a,span,strong,em,div'));
    for (const el of candidates) {
      if (elements.length >= 80) break;
      if (el.closest('script,style,noscript')) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 2 || text.length > 260) continue;
      const hasDirectText = Array.from(el.childNodes || []).some(node => node.nodeType === 3 && (node.textContent || '').trim());
      const tag = (el.tagName || '').toLowerCase();
      if (!hasDirectText && !['button', 'a', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) continue;
      const r = el.getBoundingClientRect();
      if (!r || r.width < 8 || r.height < 8) continue;
      const cs = win.getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0.05) continue;
      const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '';
      elements.push({
        text,
        x: Math.max(0, r.left - rect.left),
        y: Math.max(0, r.top - rect.top),
        w: Math.min(rect.width, r.width),
        h: Math.min(rect.height, Math.max(r.height, parseFloat(cs.fontSize || '16') * 1.35)),
        font_size: parseFloat(cs.fontSize || '16') || 16,
        color: _rgbToHex(cs.color || '#1c1c1e'),
        bg_color: _rgbToHex(bg || ''),
        bold: parseInt(cs.fontWeight || '400', 10) >= 650 || /bold/i.test(cs.fontWeight || ''),
        align: cs.textAlign || 'left',
      });
    }
    const bgColor = _rgbToHex(win.getComputedStyle(root).backgroundColor || '#ffffff') || '#ffffff';
    return { width: rect.width || 1200, height: rect.height || 675, bg_color: bgColor, elements };
  }

  function _rgbToHex(value) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    const m = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return '';
    return `#${[m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)).toString(16).padStart(2, '0')).join('')}`;
  }

  function cdExportSVG() {
    // iframe 안의 최상위 svg 요소를 모두 수집, 없으면 렌더를 SVG foreignObject 로 감쌈
    const doc = document.getElementById('cd-preview')?.contentDocument;
    if (!doc) return;
    const svgs = doc.querySelectorAll('svg');
    let svgText = '';
    if (svgs.length === 1) {
      svgText = new XMLSerializer().serializeToString(svgs[0]);
    } else if (svgs.length > 1) {
      // 여러 개면 래퍼 svg 로 병합
      svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">`
        + Array.from(svgs).map(s => new XMLSerializer().serializeToString(s)).join('\n')
        + `</svg>`;
    } else {
      // svg 가 없으면 body 를 foreignObject 로 감싼 SVG 생성 (뷰어 호환성 제한)
      const body = doc.body;
      if (!body) return;
      const w = body.scrollWidth || 1080;
      const h = body.scrollHeight || 1920;
      const html = new XMLSerializer().serializeToString(body);
      svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`
        + `<foreignObject width="100%" height="100%">`
        + `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`
        + `</foreignObject></svg>`;
    }
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url; a.download = `claude-design-${ts}.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.cdExportSVG = cdExportSVG;

  function cdExportMarkdown() {
    // iframe 의 body 텍스트·구조를 간단히 Markdown 으로 변환
    const doc = document.getElementById('cd-preview')?.contentDocument;
    if (!doc || !doc.body) return;
    const md = _htmlToMarkdown(doc.body);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url; a.download = `claude-design-${ts}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.cdExportMarkdown = cdExportMarkdown;

  function cdToggleExportMenu(event) {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    const menu = document.getElementById('cd-export-menu');
    if (!menu) return;
    const open = menu.style.display !== 'block';
    menu.style.display = open ? 'block' : 'none';
    if (open) {
      requestAnimationFrame(() => {
        const closeOnOutside = (e) => {
          if (menu.contains(e.target) || e.target?.closest?.('[onclick*="cdToggleExportMenu"]')) return;
          cdCloseExportMenu();
        };
        const closeOnEscape = (e) => {
          if (e.key === 'Escape') cdCloseExportMenu();
        };
        document.addEventListener('click', closeOnOutside, { once: true });
        document.addEventListener('keydown', closeOnEscape, { once: true });
      });
    }
  }
  window.cdToggleExportMenu = cdToggleExportMenu;

  function cdCloseExportMenu() {
    const menu = document.getElementById('cd-export-menu');
    if (menu) menu.style.display = 'none';
  }
  window.cdCloseExportMenu = cdCloseExportMenu;

  function _htmlToMarkdown(el) {
    // 간단한 HTML→MD 변환 (h1~h6, p, ul/ol/li, strong/em, a, img, code, pre)
    const walk = (node) => {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      const kids = Array.from(node.childNodes).map(walk).join('');
      switch (tag) {
        case 'h1': return `\n# ${kids.trim()}\n`;
        case 'h2': return `\n## ${kids.trim()}\n`;
        case 'h3': return `\n### ${kids.trim()}\n`;
        case 'h4': return `\n#### ${kids.trim()}\n`;
        case 'h5': return `\n##### ${kids.trim()}\n`;
        case 'h6': return `\n###### ${kids.trim()}\n`;
        case 'p': return `\n${kids.trim()}\n`;
        case 'strong': case 'b': return `**${kids}**`;
        case 'em': case 'i': return `*${kids}*`;
        case 'a': return `[${kids}](${node.getAttribute('href') || ''})`;
        case 'img': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
        case 'code': return `\`${kids}\``;
        case 'pre': return `\n\`\`\`\n${kids}\n\`\`\`\n`;
        case 'li': return `- ${kids.trim()}\n`;
        case 'ul': case 'ol': return `\n${kids}\n`;
        case 'br': return '\n';
        case 'script': case 'style': case 'noscript': return '';
        default: return kids;
      }
    };
    return walk(el).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ─── 저장 / 라이브러리 ─────────────────────────────────────
  let _cdHistoryAutosaveTimer = null;
  let _cdHistoryAutosaving = false;

  function _cdHistoryName() {
    const brand = document.getElementById('cd-brand')?.value.trim();
    const kind = _lastMeta.kind || 'general';
    return `${brand || kind}_${_lastMeta.aspect_ratio || ''}`.replace(/\s+/g, ' ').trim();
  }

  async function _cdPersistHistory(silent) {
    if (!_lastHtml) return false;
    if (_cdHistoryAutosaving) return false;
    _cdHistoryAutosaving = true;
    const name = _cdHistoryName();
    const kind = _lastMeta.kind || 'general';
    try {
      const res = await fetch('/api/claude-design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _currentDesignId || '', html: _lastHtml, name, kind, aspect_ratio: _lastMeta.aspect_ratio }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        _currentDesignId = data.id || _currentDesignId;
        if (!silent && typeof toast === 'function') toast(`저장됨: ${data.name}`);
        cdLoadList();
        return true;
      } else if (!silent && typeof toast === 'function') {
        toast(data.error || '저장 실패', 'error');
      }
    } catch (e) {
      if (!silent && typeof toast === 'function') toast('저장 실패', 'error');
    } finally {
      _cdHistoryAutosaving = false;
    }
    return false;
  }
  window._cdPersistHistory = _cdPersistHistory;

  function cdScheduleHistorySave() {
    if (!_lastHtml) return;
    clearTimeout(_cdHistoryAutosaveTimer);
    _cdHistoryAutosaveTimer = setTimeout(() => {
      _cdPersistHistory(true);
    }, 700);
  }
  window.cdScheduleHistorySave = cdScheduleHistorySave;

  async function cdSave() {
    await _cdPersistHistory(false);
  }
  window.cdSave = cdSave;

  // 저장 후 공유 가능한 URL 을 클립보드에 복사
  async function cdSaveAndShare() {
    if (!_lastHtml) return;
    const brand = document.getElementById('cd-brand')?.value.trim();
    const kind = _lastMeta.kind || 'general';
    const name = `${brand || kind}_${_lastMeta.aspect_ratio || ''}`;
    try {
      const res = await fetch('/api/claude-design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: _currentDesignId || '', html: _lastHtml, name, kind, aspect_ratio: _lastMeta.aspect_ratio }),
      });
      const data = await res.json();
      if (data.status !== 'ok') throw new Error('저장 실패');
      _currentDesignId = data.id || _currentDesignId;
      const shareUrl = window.location.origin + data.url;
      try { await navigator.clipboard.writeText(shareUrl); } catch (_) {}
      _addChatMessage('ai', `💾 저장 완료 · 공유 URL 이 클립보드에 복사되었습니다.<br><code style="font-size:10px;background:rgba(0,0,0,0.04);padding:2px 6px;border-radius:4px;">${_esc(shareUrl)}</code><br><a href="${_esc(shareUrl)}" target="_blank" rel="noopener" style="color:#5856d6;font-weight:700;">🔗 새 창에서 열기</a>`, { html: true });
      cdLoadList();
    } catch (e) {
      _addChatMessage('error', '저장 실패: ' + (e?.message || e));
    }
  }
  window.cdSaveAndShare = cdSaveAndShare;

  function cdDownload() {
    if (!_lastHtml) return;
    const blob = new Blob([_lastHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `claude-design-${ts}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.cdDownload = cdDownload;

  function cdOpenInNewTab() {
    if (!_lastHtml) return;
    const blob = new Blob([_lastHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
  }
  window.cdOpenInNewTab = cdOpenInNewTab;

  function cdPickImportDesign() {
    let input = document.getElementById('cd-import-file');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'cd-import-file';
      input.accept = '.html,.htm,.zip,text/html,application/zip';
      input.style.display = 'none';
      input.onchange = () => cdImportDesignFile(input);
      document.body.appendChild(input);
    }
    input.value = '';
    input.click();
  }
  window.cdPickImportDesign = cdPickImportDesign;

  async function cdImportDesignFile(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    data.append('name', file.name.replace(/\.(html?|zip)$/i, ''));
    data.append('aspect_ratio', _lastMeta.aspect_ratio || document.getElementById('cd-aspect')?.value || '16:9');
    try {
      if (typeof toast === 'function') toast('디자인을 가져오는 중입니다.');
      const res = await fetch('/api/claude-design/import', { method: 'POST', body: data });
      const result = await res.json();
      if (!res.ok || result.status !== 'ok') throw new Error(result.error || '가져오기 실패');
      await cdLoadList();
      await cdLoadHistoryItem(result.id);
      const fileCount = result.files_count ? ` · 파일 ${result.files_count}개` : '';
      if (typeof toast === 'function') toast(`가져오기 완료: ${result.name || result.id}${fileCount}`);
    } catch (e) {
      if (typeof toast === 'function') toast('가져오기 실패: ' + (e?.message || e), 'error');
    } finally {
      if (input) input.value = '';
    }
  }
  window.cdImportDesignFile = cdImportDesignFile;

  async function cdLoadList() {
    const boxes = Array.from(document.querySelectorAll('#cd-list, #cd-history-page-list'));
    if (!boxes.length) return;
    const render = (html) => boxes.forEach(box => { box.innerHTML = html; });
    try {
      const res = await fetch('/api/claude-design/list');
      const data = await res.json();
      const items = (data && data.items) || [];
      if (!items.length) {
        render('<div style="padding:28px 10px;color:rgba(0,0,0,0.42);text-align:center;line-height:1.6;">저장된 디자인이 없습니다.<br>이제부터 생성/수정한 HTML은 자동으로 여기에 저장됩니다.</div>');
        return;
      }
      render(items.map(it => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 8px;border-bottom:1px dashed rgba(0,0,0,0.06);gap:8px;">
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div style="font-weight:800;color:#1c1c1e;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_esc(it.name)}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);margin-top:2px;">${_esc(it.mtime)} · ${Math.round(it.size/1024)}KB</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button type="button" onclick="cdLoadHistoryItem('${_esc(it.id)}')" style="padding:3px 7px;font-size:10px;font-weight:700;border:none;background:#ff8c00;color:#fff;border-radius:999px;cursor:pointer;">편집</button>
          <button type="button" onclick="cdViewHistorySource('${_esc(it.id)}')" style="padding:3px 7px;font-size:10px;font-weight:700;border:none;background:rgba(88,86,214,0.10);color:#5856d6;border-radius:999px;cursor:pointer;">소스</button>
          <button type="button" onclick="cdPreviewHistoryItem('${_esc(it.id)}')" style="padding:3px 7px;font-size:10px;font-weight:700;border:none;background:rgba(0,122,255,0.08);color:#007aff;border-radius:999px;cursor:pointer;">미리보기</button>
          <button type="button" onclick="cdDeleteItem('${_esc(it.id)}')" style="padding:3px 7px;font-size:10px;font-weight:700;border:none;background:rgba(255,59,48,0.1);color:#ff3b30;border-radius:999px;cursor:pointer;">삭제</button>
        </div>
      </div>`).join(''));
    } catch (e) {
      render(`<div style="padding:10px;color:#ff3b30;">불러오기 실패: ${_esc(e?.message || e)}</div>`);
    }
  }
  window.cdLoadList = cdLoadList;

  async function cdLoadHistoryItem(id) {
    const res = await fetch(`/api/claude-design/item/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.html) throw new Error(data.error || '불러오기 실패');
    const designPage = document.getElementById('page-claude-design');
    if (!designPage?.classList.contains('active') && typeof navigateToPage === 'function') {
      await navigateToPage('claude-design', { skipConfirm: true, fromHistory: true });
    }
    _currentDesignId = data.id || id;
    _lastHtml = _applyDesignSafetyToHtml(_applyAttachedImagesToHtml(data.html));
    _lastMeta = {
      ..._lastMeta,
      ...(data.meta || {}),
      kind: (data.meta && data.meta.kind) || _lastMeta.kind || 'general',
      aspect_ratio: (data.meta && data.meta.aspect_ratio) || _lastMeta.aspect_ratio || document.getElementById('cd-aspect')?.value || '16:9',
    };
    _pushVersion(_lastHtml, _lastMeta, `히스토리 불러오기: ${data.meta?.name || id}`);
    _setActionsEnabled(true);
    _renderPreview(_lastHtml);
    if (typeof cdLoadCommentsForCurrentDesign === 'function') cdLoadCommentsForCurrentDesign(data.meta?.comments || []);
    document.getElementById('cd-history-modal')?.remove();
    _addChatMessage('ai', `🗂 히스토리에서 불러왔습니다. 이제 미리보기에서 바로 선택/수정하고 저장하면 같은 HTML 파일이 갱신됩니다.`);
  }
  window.cdLoadHistoryItem = cdLoadHistoryItem;

  async function cdViewHistorySource(id) {
    const res = await fetch(`/api/claude-design/item/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.html) throw new Error(data.error || '소스 불러오기 실패');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,0.44);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
    modal.innerHTML = `<div style="width:min(980px,96vw);height:min(760px,92vh);background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.24);display:flex;flex-direction:column;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:13px;font-weight:900;color:#1c1c1e;">HTML 소스 · ${_esc(id)}</div>
        <div style="display:flex;gap:6px;">
          <button type="button" data-load style="padding:7px 12px;border:none;background:#ff8c00;color:#fff;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;">편집으로 열기</button>
          <button type="button" data-close style="padding:7px 12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;">닫기</button>
        </div>
      </div>
      <textarea readonly style="flex:1;margin:0;border:0;padding:16px;font-family:Menlo,Consolas,monospace;font-size:11px;line-height:1.55;resize:none;background:#111827;color:#dbeafe;">${_esc(data.html)}</textarea>
    </div>`;
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('[data-load]').onclick = () => { modal.remove(); cdLoadHistoryItem(id).catch(e => toast && toast(e.message || e, 'error')); };
    document.body.appendChild(modal);
  }
  window.cdViewHistorySource = cdViewHistorySource;

  async function cdPreviewHistoryItem(id) {
    try {
      const res = await fetch(`/api/claude-design/item/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.status !== 'ok' || !data.html) throw new Error(data.error || '미리보기 실패');
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      modal.innerHTML = `<div style="width:min(1100px,96vw);height:min(720px,90vh);background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.24);display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0;">
          <div style="font-size:13px;font-weight:900;color:#1c1c1e;">미리보기 · ${_esc(data.meta?.name || id)}</div>
          <div style="display:flex;gap:6px;">
            <button type="button" data-load style="padding:7px 14px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;">편집으로 열기</button>
            <button type="button" data-close style="padding:7px 14px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;">닫기</button>
          </div>
        </div>
        <iframe src="${blobUrl}" style="flex:1;border:0;background:#f5f5f7;" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>`;
      modal.querySelector('[data-close]').onclick = () => { URL.revokeObjectURL(blobUrl); modal.remove(); };
      modal.querySelector('[data-load]').onclick = () => { URL.revokeObjectURL(blobUrl); modal.remove(); cdLoadHistoryItem(id).catch(e => toast && toast(e.message || e, 'error')); };
      document.body.appendChild(modal);
    } catch (e) {
      if (typeof toast === 'function') toast('미리보기 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdPreviewHistoryItem = cdPreviewHistoryItem;

  function cdShowDesignHistory() {
    let modal = document.getElementById('cd-history-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'cd-history-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.42);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
    modal.innerHTML = `<div style="width:min(760px,94vw);max-height:86vh;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.22);overflow:hidden;display:flex;flex-direction:column;">
      <div style="padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div><div style="font-size:15px;font-weight:950;color:#1c1c1e;">마케케디자인 히스토리</div><div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:3px;">저장한 HTML을 다시 열어 수정하고 같은 파일로 재저장합니다.</div></div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <button type="button" onclick="cdPickImportDesign()" style="padding:7px 12px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.08);color:#d85c00;border-radius:10px;font-size:11px;font-weight:900;cursor:pointer;">가져오기</button>
          <button type="button" onclick="document.getElementById('cd-history-modal')?.remove()" style="padding:7px 12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;">닫기</button>
        </div>
      </div>
      <div id="cd-list" style="overflow:auto;padding:8px 12px;min-height:180px;"></div>
    </div>`;
    document.body.appendChild(modal);
    cdLoadList();
  }
  window.cdShowDesignHistory = cdShowDesignHistory;

  async function cdDeleteItem(name) {
    if (!confirm(`"${name}" 삭제할까요?`)) return;
    try {
      await fetch(`/api/claude-design/item/${encodeURIComponent(name)}`, { method: 'DELETE' });
      cdLoadList();
    } catch (_) {}
  }
  window.cdDeleteItem = cdDeleteItem;

  function cdInitHistoryPage() {
    cdLoadList();
  }
  window.cdInitHistoryPage = cdInitHistoryPage;

  function cdSetDefaultProvider() {
    const input = document.getElementById('cd-provider');
    if (input) input.value = 'cli:codex';
    document.querySelectorAll('.cd-prov-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === 'cli:codex');
    });
    if (typeof window.cdSyncAtlasSelectState === 'function') window.cdSyncAtlasSelectState();
    if (typeof window.cdLoadAtlasModels === 'function') window.cdLoadAtlasModels();
    const hint = document.getElementById('cd-provider-hint');
    if (hint) hint.textContent = 'Codex';
  }
  window.cdSetDefaultProvider = cdSetDefaultProvider;

  // ─── 초기화 ────────────────────────────────────────────────
  // 페이지 진입 시 자동 인사 + 목록 로드 + Enter 키 전송 바인딩
  function _bindChatInput() {
    const input = document.getElementById('cd-input');
    const wrap = document.getElementById('cd-input-wrap');
    if (!input || input._cdBound) return;
    input._cdBound = true;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        cdSendMessage();
      }
    });
    // 자동 높이 조절
    const autoGrow = () => {
      input.style.height = 'auto';
      const next = Math.min(240, Math.max(72, input.scrollHeight));
      input.style.height = next + 'px';
    };
    input.addEventListener('input', autoGrow);
    input.addEventListener('input', cdUpdateSendAvailability);
    cdUpdateSendAvailability();
    if (wrap) {
      input.addEventListener('focus', () => {
        wrap.style.borderColor = '#ff8c00';
        wrap.style.boxShadow = '0 0 0 4px rgba(255,140,0,0.10)';
      });
      input.addEventListener('blur', () => {
        wrap.style.borderColor = 'rgba(0,0,0,0.08)';
        wrap.style.boxShadow = 'none';
      });
      // 입력창 어디 클릭해도 textarea 포커스
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) input.focus();
      });
    }
  }

  function _bindFloatingChatDockDrag() {
    return;
    const dock = document.getElementById('cd-chat-dock');
    const page = document.getElementById('page-claude-design');
    if (!dock || dock._cdDragBound) return;
    dock._cdDragBound = true;
    let drag = null;
    dock.addEventListener('pointerdown', (event) => {
      if (!page?.classList.contains('cd-chat-started')) return;
      if (event.target?.closest?.('textarea, input, button, select, option, a, [contenteditable="true"]')) return;
      const dockRect = dock.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startRight: window.innerWidth - dockRect.right,
        startBottom: window.innerHeight - dockRect.bottom,
      };
      dock.classList.add('cd-dragging');
      dock.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    dock.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dockRect = dock.getBoundingClientRect();
      const nextRight = Math.max(12, Math.min(window.innerWidth - dockRect.width - 12, drag.startRight - (event.clientX - drag.startX)));
      const nextBottom = Math.max(12, Math.min(window.innerHeight - dockRect.height - 12, drag.startBottom - (event.clientY - drag.startY)));
      page.style.setProperty('--cd-chat-right', `${Math.round(nextRight)}px`);
      page.style.setProperty('--cd-chat-bottom', `${Math.round(nextBottom)}px`);
    });
    const endDrag = (event) => {
      if (!drag) return;
      dock.releasePointerCapture?.(drag.pointerId || event.pointerId);
      dock.classList.remove('cd-dragging');
      drag = null;
    };
    dock.addEventListener('pointerup', endDrag);
    dock.addEventListener('pointercancel', endDrag);
  }

  function _profileImageUrls(profile) {
    const p = profile || {};
    const profileId = p.id || window._globalProfileId || '';
    const urls = [];
    if (p.logo_url) urls.push(p.logo_url);
    if (p.logo_path && profileId) urls.push(`/api/library/image/${profileId}/${encodeURIComponent(p.logo_path)}`);
    if (p.design_ref_path && profileId) urls.push(`/api/library/image/${profileId}/${encodeURIComponent(p.design_ref_path)}`);
    if (Array.isArray(p.image_urls)) urls.push(...p.image_urls);
    return Array.from(new Set(urls.filter(Boolean))).slice(0, 8);
  }

  function _profileColors(profile) {
    const p = profile || {};
    const rawValues = [
      p.brand_color,
      p.brand_colors,
      p.main_color,
      p.primary_color,
      p.accent_color,
      p.theme_color,
      p.design_color,
      p.design_colors,
      p.palette,
      p.colors,
    ];
    const out = [];
    rawValues.forEach(value => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(v => out.push(String(v || '').trim()));
        return;
      }
      const raw = String(value || '').trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(v => out.push(String(v || '').trim()));
          return;
        }
        if (parsed && typeof parsed === 'object') {
          Object.values(parsed).forEach(v => out.push(String(v || '').trim()));
          return;
        }
      } catch (_) {}
      raw.split(/[,\s/|]+/).forEach(v => out.push(v.trim()));
    });
    return Array.from(new Set(out.filter(c => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)))).slice(0, 8);
  }

  function _profileText(profile, keys) {
    for (const key of keys) {
      const value = profile?.[key];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function _profileBusinessDescription(profile) {
    const summary = _profileText(profile, ['description', 'service_description', 'business_detail', 'biz_detail', 'intro', 'about']);
    const detail = _profileText(profile, ['biz_detail', 'business_detail', 'service_description', 'description', 'intro', 'about']);
    if (summary && detail && summary !== detail) return `${summary}\n${detail}`;
    return detail || summary;
  }

  function _profileDesignRules(profile) {
    const p = profile || {};
    return [
      ['브랜드 무드', p.design_tone],
      ['타이포그래피', p.typography_rules],
      ['레이아웃/여백', p.layout_rules],
      ['이미지/사진', p.image_rules],
      ['CTA/강조', p.cta_rules],
      ['금지 디자인', p.design_forbidden],
      ['종합 규칙', p.design_rules],
    ].map(([label, value]) => {
      const text = String(value || '').trim();
      return text ? `${label}: ${text}` : '';
    }).filter(Boolean).join('\n');
  }

  function cdSyncProfile() {
    const profile = window._globalProfileData || null;
    const brandEl = document.getElementById('cd-brand');
    const colorEl = document.getElementById('cd-colors');
    const businessTypeEl = document.getElementById('cd-business-type');
    const businessDetailEl = document.getElementById('cd-business-detail');
    const websiteEl = document.getElementById('cd-website');
    const ctaEl = document.getElementById('cd-cta');
    const designRulesEl = document.getElementById('cd-design-rules');
    const chip = document.getElementById('cd-profile-chip');
    if (!profile) {
      if (brandEl) brandEl.value = '';
      if (colorEl) colorEl.value = '';
      if (businessTypeEl) businessTypeEl.value = '';
      if (businessDetailEl) businessDetailEl.value = '';
      if (websiteEl) websiteEl.value = '';
      if (ctaEl) ctaEl.value = '';
      if (designRulesEl) designRulesEl.value = '';
      const designRulesEditor = document.getElementById('cd-design-rules-editor');
      if (designRulesEditor) designRulesEditor.value = '';
      if (chip) chip.style.display = 'none';
      return;
    }

    const colors = _profileColors(profile);
    if (brandEl) brandEl.value = profile.name || '';
    if (colorEl) colorEl.value = colors.join(', ');
    if (businessTypeEl) businessTypeEl.value = _profileText(profile, ['business_type', 'biz_type', 'industry', 'category', 'type', 'blog_category']);
    if (businessDetailEl) businessDetailEl.value = _profileBusinessDescription(profile);
    if (websiteEl) websiteEl.value = _profileText(profile, ['website', 'site_url', 'url', 'homepage', 'channel_url']);
    if (ctaEl) ctaEl.value = _profileText(profile, ['cta_text', 'cta', 'default_cta']);
    if (designRulesEl) designRulesEl.value = _profileDesignRules(profile);
    const designRulesEditor = document.getElementById('cd-design-rules-editor');
    if (designRulesEditor && designRulesEl) designRulesEditor.value = designRulesEl.value || '';
    if (chip) chip.style.display = 'flex';
    const nameEl = document.getElementById('cd-profile-name');
    if (nameEl) nameEl.textContent = profile.name || '프로필 자동';
    const dot = document.getElementById('cd-profile-color-dot');
    if (dot) dot.style.background = colors[0] || '#d1d5db';

    const urls = _profileImageUrls(profile);
    window._cdProfileImageUrls = urls;
    const assetCount = document.getElementById('cd-profile-asset-count');
    if (assetCount) assetCount.textContent = `이미지 ${urls.length}장`;
    const colorRow = document.getElementById('cd-profile-color-row');
    if (colorRow) {
      colorRow.innerHTML = colors.length
        ? colors.map(color => `<span title="${_esc(color)}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border:1px solid rgba(0,0,0,0.08);border-radius:999px;background:#fff;font-size:10px;font-weight:800;color:rgba(0,0,0,0.62);"><span style="width:10px;height:10px;border-radius:50%;background:${_esc(color)};border:1px solid rgba(0,0,0,0.12);"></span>${_esc(color)}</span>`).join('')
        : '<span style="font-size:10px;color:rgba(0,0,0,0.35);">등록된 브랜드 색상이 없습니다</span>';
    }
    const imageRow = document.getElementById('cd-profile-image-row');
    if (imageRow) {
      imageRow.innerHTML = urls.length
        ? urls.slice(0, 6).map((url, i) => `<img src="${_esc(url)}" title="프로필 이미지 ${i + 1}" style="width:34px;height:34px;border-radius:9px;object-fit:cover;border:1px solid rgba(0,0,0,0.08);background:#f5f5f7;">`).join('')
        : '<span style="font-size:10px;color:rgba(0,0,0,0.35);">등록된 프로필 이미지가 없습니다</span>';
    }
  }
  window.cdSyncProfile = cdSyncProfile;

  function cdOpenProfileImagePicker() {
    const urls = (window._cdProfileImageUrls || []).filter(Boolean);
    if (!urls.length) {
      if (typeof toast === 'function') toast('선택할 프로필 이미지가 없습니다', 'warning');
      return;
    }
    const old = document.getElementById('cd-profile-image-picker');
    if (old) old.remove();
    const modal = document.createElement('div');
    modal.id = 'cd-profile-image-picker';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;padding:24px;';
    modal.innerHTML = `
      <div style="width:min(560px,100%);max-height:min(680px,90vh);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,0.24);padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <div>
            <div style="font-size:15px;font-weight:950;color:#1c1c1e;">프로필 이미지 선택</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:3px;">쓸 이미지/로고만 선택해서 참고 이미지로 넣습니다.</div>
          </div>
          <button type="button" onclick="document.getElementById('cd-profile-image-picker')?.remove()" style="width:30px;height:30px;border:0;border-radius:50%;background:rgba(0,0,0,0.06);cursor:pointer;font-size:16px;">×</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-bottom:14px;">
          ${urls.map((url, i) => `
            <label style="position:relative;display:block;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;background:#f7f8fa;cursor:pointer;">
              <input type="checkbox" data-profile-image-url="${_esc(url)}" style="position:absolute;left:7px;top:7px;z-index:2;width:16px;height:16px;" ${i === 0 ? 'checked' : ''}>
              <img src="${_esc(url)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;">
            </label>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" onclick="document.getElementById('cd-profile-image-picker')?.remove()" style="padding:8px 12px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;">취소</button>
          <button type="button" onclick="cdAttachSelectedProfileImages()" style="padding:8px 14px;border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer;">선택 이미지 넣기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  window.cdOpenProfileImagePicker = cdOpenProfileImagePicker;

  async function cdAttachSelectedProfileImages() {
    const modal = document.getElementById('cd-profile-image-picker');
    const urls = Array.from(modal?.querySelectorAll('input[data-profile-image-url]:checked') || []).map(el => el.dataset.profileImageUrl).filter(Boolean);
    if (!urls.length) {
      if (typeof toast === 'function') toast('선택한 이미지가 없습니다', 'warning');
      return;
    }
    const added = await window.cdAttachReferenceImageUrls?.(urls, '프로필 이미지');
    modal?.remove();
    if (typeof toast === 'function') toast(`프로필 이미지 ${added || 0}장 첨부됨`);
  }
  window.cdAttachSelectedProfileImages = cdAttachSelectedProfileImages;

  function cdInit(options) {
    options = options || {};
    _bindChatInput();
    _bindAttachmentDnD();
    let didReset = false;
    if (options.fresh && (_lastHtml || _chatStarted || _versions.length)) {
      if (typeof cdResetChat === 'function') {
        cdResetChat();
        didReset = true;
      }
    }
    if (options.fresh) cdSetDefaultProvider();
    if (!window._cdRequiredOptionsInitialized || options.fresh) {
      cdResetDesignRequiredOptions();
      window._cdRequiredOptionsInitialized = true;
    }
    cdSyncProfile();
    const selectedAspect = document.getElementById('cd-aspect')?.value || '';
    if (selectedAspect) cdSetAspect(selectedAspect);
    else cdUpdateSendAvailability();
    _updateInlineEditButton();
    cdLoadList();
    if (!_chatStarted && !didReset) _greet();
  }
  window.cdInit = cdInit;

  document.addEventListener('DOMContentLoaded', () => {
    // 시작 화면이 마케케디자인인 경우 즉시 초기화
    setTimeout(() => {
      const pg = document.getElementById('page-claude-design');
      if (pg && pg.classList.contains('active')) cdInit();
    }, 300);
    document.querySelectorAll('a[data-page="claude-design"]').forEach(a => {
      a.addEventListener('click', () => {
        setTimeout(() => { cdInit(); }, 250);
      });
    });
    // 프로필 변경 이벤트 수신
    window.addEventListener('profile:changed', cdSyncProfile);
    // 슬라이드 ←/→ 키 네비게이션 (마케케디자인 페이지가 활성화일 때만, textarea 포커스 외)
    document.addEventListener('keydown', (e) => {
      const pg = document.getElementById('page-claude-design');
      if (!pg || !pg.classList.contains('active')) return;
      if (_slideTotal <= 1) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); _gotoSlide(_slideIndex - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); _gotoSlide(_slideIndex + 1); }
    });
  });
})();
