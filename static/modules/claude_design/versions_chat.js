// Claude 디자인 — 버전 히스토리 + 채팅 UI (대화/인사/명확화/액션 카드)
(function () {
  'use strict';

  // ─── A. 버전 히스토리 ─────────────────────────────────────────
  function _pushVersion(html, meta, prompt) {
    if (_versionIndex >= 0 && _versionIndex < _versions.length - 1) {
      _versions = _versions.slice(0, _versionIndex + 1);
    }
    _versions.push({ html, meta: { ...meta }, ts: Date.now(), prompt: (prompt || '').slice(0, 80) });
    _versionIndex = _versions.length - 1;
    _clearInlineEditHistory();
    _renderVersionChip();
    _updateDesignUndoRedoButtons();
    if (typeof window.cdScheduleHistorySave === 'function') window.cdScheduleHistorySave();
  }

  function _renderVersionChip() {
    const chip = document.getElementById('cd-versions-chip');
    if (chip) {
      if (_versions.length === 0) { chip.style.display = 'none'; }
      else {
        chip.style.display = 'inline-flex';
        chip.innerHTML = `<span style="font-weight:700;">⏪ v${_versionIndex + 1} / ${_versions.length}</span>`;
      }
    }
    // 사이드바 버전 갤러리 + 미리보기 상단 썸네일 스트립 갱신
    _renderVersionSidebar();
    _renderVersionStrip();
    _updateDesignUndoRedoButtons();
  }

  function _hasInlineUndo() {
    return Array.isArray(window._cdEditUndoStack) && window._cdEditUndoStack.length > 0;
  }

  function _hasInlineRedo() {
    return Array.isArray(window._cdEditRedoStack) && window._cdEditRedoStack.length > 0;
  }

  function _hasVersionUndo() {
    return _versions.length > 1 && _versionIndex > 0;
  }

  function _hasVersionRedo() {
    return _versions.length > 1 && _versionIndex >= 0 && _versionIndex < _versions.length - 1;
  }

  function _clearInlineEditHistory() {
    if (Array.isArray(window._cdEditUndoStack)) window._cdEditUndoStack.length = 0;
    if (Array.isArray(window._cdEditRedoStack)) window._cdEditRedoStack.length = 0;
  }

  function _setHistoryButtonState(id, enabled) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '0.45';
    btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  function _updateDesignUndoRedoButtons() {
    const busy = !!window._cdDesignBusy;
    _setHistoryButtonState('cd-undo-btn', !busy && (_hasInlineUndo() || _hasVersionUndo()));
    _setHistoryButtonState('cd-redo-btn', !busy && (_hasInlineRedo() || _hasVersionRedo()));
    _setHistoryButtonState('cd-cancel-btn', busy || !!_lastHtml || !!_selectedElement);
  }
  window._updateDesignUndoRedoButtons = _updateDesignUndoRedoButtons;

  function cdUndoDesignChange() {
    if (window._cdDesignBusy) {
      if (typeof toast === 'function') toast('작업 중에는 먼저 취소를 눌러주세요', 'warning');
      return;
    }
    if (_hasInlineUndo() && typeof window.cdUndoInlineEdit === 'function') {
      window.cdUndoInlineEdit();
      _updateDesignUndoRedoButtons();
      return;
    }
    if (_hasVersionUndo()) {
      cdRestoreVersion(_versionIndex - 1, { quiet: true });
      _addChatMessage('status', `↶ 이전 버전 v${_versionIndex + 1}로 돌아갔습니다.`);
      _updateDesignUndoRedoButtons();
      return;
    }
    if (typeof toast === 'function') toast('되돌릴 변경이 없습니다');
  }
  window.cdUndoDesignChange = cdUndoDesignChange;

  function cdRedoDesignChange() {
    if (window._cdDesignBusy) {
      if (typeof toast === 'function') toast('작업 중에는 먼저 취소를 눌러주세요', 'warning');
      return;
    }
    if (_hasInlineRedo() && typeof window.cdRedoInlineEdit === 'function') {
      window.cdRedoInlineEdit();
      _updateDesignUndoRedoButtons();
      return;
    }
    if (_hasVersionRedo()) {
      cdRestoreVersion(_versionIndex + 1, { quiet: true });
      _addChatMessage('status', `↷ 다음 버전 v${_versionIndex + 1}를 다시 적용했습니다.`);
      _updateDesignUndoRedoButtons();
      return;
    }
    if (typeof toast === 'function') toast('다시 적용할 변경이 없습니다');
  }
  window.cdRedoDesignChange = cdRedoDesignChange;

  function cdCancelDesignChange() {
    if (window._cdDesignBusy) {
      if (typeof window.cdCancelActiveDesign === 'function') window.cdCancelActiveDesign();
      else if (typeof toast === 'function') toast('현재 작업을 취소하는 중입니다');
      return;
    }
    const globalPanel = document.getElementById('cd-global-edit-panel');
    if (globalPanel && globalPanel.style.display !== 'none') {
      if (typeof window.cdToggleGlobalAIEdit === 'function') window.cdToggleGlobalAIEdit(false);
      const input = document.getElementById('cd-global-edit-input');
      if (input) input.value = '';
      _updateDesignUndoRedoButtons();
      return;
    }
    if (_selectedElement) {
      _selectedElement = null;
      if (typeof window._updateInlineEditChip === 'function') window._updateInlineEditChip();
      _updateDesignUndoRedoButtons();
      return;
    }
    cdUndoDesignChange();
  }
  window.cdCancelDesignChange = cdCancelDesignChange;

  function _renderVersionSidebar() {
    const box = document.getElementById('cd-versions-sidebar');
    if (!box) return;
    if (_versions.length === 0) {
      box.innerHTML = '<div style="font-size:10px;color:rgba(0,0,0,0.4);padding:6px 8px;">아직 생성된 버전 없음</div>';
      return;
    }
    box.innerHTML = _versions.map((v, i) => {
      const t = new Date(v.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const active = i === _versionIndex;
      const label = (v.prompt || v.meta?.kind || '편집').slice(0, 20);
      const thumbId = 'cd-sb-thumb-' + i;
      return `<div onclick="cdRestoreVersion(${i})" style="padding:5px 8px;margin:2px 4px;border-radius:6px;cursor:pointer;background:${active ? 'rgba(255,140,0,0.10)' : 'transparent'};border:1px solid ${active ? '#ff8c00' : 'transparent'};">
        <div id="${thumbId}" style="width:100%;height:48px;border-radius:4px;background:rgba(0,0,0,0.03);overflow:hidden;position:relative;margin-bottom:4px;border:1px solid rgba(0,0,0,0.05);"></div>
        <div style="font-size:10px;color:rgba(0,0,0,0.5);">v${i + 1} · ${t}</div>
        <div style="font-size:10px;font-weight:700;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(label)}</div>
      </div>`;
    }).reverse().join('');
    requestAnimationFrame(() => {
      _versions.forEach((v, i) => {
        const container = document.getElementById('cd-sb-thumb-' + i);
        if (!container || !v.html) return;
        const thumb = document.createElement('iframe');
        thumb.style.cssText = 'width:400px;height:225px;border:0;transform:scale(0.2);transform-origin:top left;pointer-events:none;position:absolute;top:0;left:0;';
        thumb.sandbox = 'allow-same-origin';
        try {
          const blob = new Blob([v.html], { type: 'text/html;charset=utf-8' });
          thumb.src = URL.createObjectURL(blob);
        } catch (_) {
          thumb.srcdoc = v.html;
        }
        container.appendChild(thumb);
      });
    });
  }

  function _renderVersionStrip() {
    const strip = document.getElementById('cd-version-strip');
    if (!strip) return;
    if (_versions.length <= 1) { strip.style.display = 'none'; return; }
    strip.style.display = 'flex';
    strip.innerHTML = _versions.map((v, i) => {
      const active = i === _versionIndex;
      const label = (v.meta?.kind || '').slice(0, 4) || `v${i+1}`;
      return `<button type="button" onclick="cdRestoreVersion(${i})" title="v${i+1}: ${_esc(v.prompt || '편집')}" style="flex:0 0 auto;width:80px;height:60px;border:2px solid ${active ? '#ff8c00' : 'rgba(0,0,0,0.08)'};background:#fff;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10px;font-weight:700;color:${active ? '#ff6b00' : 'rgba(0,0,0,0.6)'};padding:0;overflow:hidden;">
        <span style="font-size:14px;">${active ? '👁' : '⏪'}</span>
        <span>v${i+1} · ${_esc(label)}</span>
      </button>`;
    }).join('');
  }

  var _versionPage = 0;
  var _VERSION_PAGE_SIZE = 6;

  function cdShowVersions() {
    const popover = document.getElementById('cd-versions-popover');
    if (!popover) return;
    if (_versions.length === 0) {
      if (typeof toast === 'function') toast('아직 버전이 없습니다');
      return;
    }
    _versionPage = 0;
    _renderVersionPopover();
    popover.style.display = popover.style.display === 'none' || !popover.style.display ? 'block' : 'none';
  }
  window.cdShowVersions = cdShowVersions;

  function cdVersionPagePrev() {
    if (_versionPage > 0) { _versionPage--; _renderVersionPopover(); }
  }
  window.cdVersionPagePrev = cdVersionPagePrev;

  function cdVersionPageNext() {
    const maxPage = Math.max(0, Math.ceil(_versions.length / _VERSION_PAGE_SIZE) - 1);
    if (_versionPage < maxPage) { _versionPage++; _renderVersionPopover(); }
  }
  window.cdVersionPageNext = cdVersionPageNext;

  function _renderVersionPopover() {
    const popover = document.getElementById('cd-versions-popover');
    if (!popover) return;
    const total = _versions.length;
    const totalPages = Math.max(1, Math.ceil(total / _VERSION_PAGE_SIZE));
    const reversed = [..._versions].reverse();
    const startIdx = _versionPage * _VERSION_PAGE_SIZE;
    const pageItems = reversed.slice(startIdx, startIdx + _VERSION_PAGE_SIZE);

    const header = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px 8px;border-bottom:1px solid rgba(0,0,0,0.06);">
      <span style="font-size:11px;font-weight:900;color:#1c1c1e;">디자인 히스토리 (${total}개)</span>
      <div style="display:flex;align-items:center;gap:4px;">
        <button type="button" onclick="cdVersionPagePrev()" ${_versionPage <= 0 ? 'disabled' : ''} style="width:24px;height:24px;border:1px solid rgba(0,0,0,0.08);background:#fff;border-radius:6px;cursor:pointer;font-size:11px;color:rgba(0,0,0,0.5);">◀</button>
        <span style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.4);min-width:40px;text-align:center;">${_versionPage + 1}/${totalPages}</span>
        <button type="button" onclick="cdVersionPageNext()" ${_versionPage >= totalPages - 1 ? 'disabled' : ''} style="width:24px;height:24px;border:1px solid rgba(0,0,0,0.08);background:#fff;border-radius:6px;cursor:pointer;font-size:11px;color:rgba(0,0,0,0.5);">▶</button>
      </div>
    </div>`;

    const items = pageItems.map((v) => {
      const origIdx = _versions.indexOf(v);
      const t = new Date(v.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const active = origIdx === _versionIndex;
      const kind = v.meta?.kind || '';
      const label = v.prompt || '(편집)';
      const thumbId = 'cd-ver-thumb-' + origIdx;
      return `<div onclick="cdRestoreVersion(${origIdx})" style="padding:8px 10px;cursor:pointer;border-radius:8px;background:${active ? 'rgba(255,140,0,0.10)' : 'transparent'};border:1px solid ${active ? '#ff8c00' : 'transparent'};display:flex;gap:8px;align-items:center;">
        <div id="${thumbId}" style="flex:0 0 80px;width:80px;height:45px;border-radius:6px;background:rgba(0,0,0,0.04);overflow:hidden;position:relative;border:1px solid rgba(0,0,0,0.06);"></div>
        <div style="flex:1;min-width:0;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(0,0,0,0.5);">
            <span style="font-weight:700;">v${origIdx + 1}${active ? ' • 현재' : ''}</span><span>${t}</span>
          </div>
          <div style="font-size:11px;font-weight:700;color:#1c1c1e;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${kind ? `[${kind}] ` : ''}${_esc(label)}</div>
        </div>
      </div>`;
    }).join('');

    popover.innerHTML = header + '<div style="max-height:380px;overflow-y:auto;padding:4px 0;">' + items + '</div>';

    requestAnimationFrame(() => {
      pageItems.forEach((v) => {
        const origIdx = _versions.indexOf(v);
        const container = document.getElementById('cd-ver-thumb-' + origIdx);
        if (!container || !v.html) return;
        const thumb = document.createElement('iframe');
        thumb.style.cssText = 'width:320px;height:180px;border:0;transform:scale(0.25);transform-origin:top left;pointer-events:none;position:absolute;top:0;left:0;';
        thumb.sandbox = 'allow-same-origin';
        try {
          const blob = new Blob([v.html], { type: 'text/html;charset=utf-8' });
          thumb.src = URL.createObjectURL(blob);
        } catch (_) {
          thumb.srcdoc = v.html;
        }
        container.appendChild(thumb);
      });
    });
  }

  function cdRestoreVersion(i, opts) {
    if (i < 0 || i >= _versions.length) return;
    opts = opts || {};
    const v = _versions[i];
    _versionIndex = i;
    _clearInlineEditHistory();
    _lastHtml = v.html;
    _lastMeta = { ...v.meta };
    _renderPreview(v.html);
    if (typeof _setActionsEnabled === 'function') _setActionsEnabled(true);
    if (typeof window._bindInlineEdit === 'function') setTimeout(window._bindInlineEdit, 120);
    _renderVersionChip();
    const popover = document.getElementById('cd-versions-popover');
    if (popover) popover.style.display = 'none';
    if (!opts.quiet) _addChatMessage('ai', `⏪ v${i + 1} 로 복원했습니다. 여기서 편집하면 새 버전으로 분기됩니다.`);
    _updateDesignUndoRedoButtons();
  }
  window.cdRestoreVersion = cdRestoreVersion;

  // ─── 채팅 UI ────────────────────────────────────────────────
  function _addChatMessage(role, text, opts) {
    opts = opts || {};
    const box = document.getElementById('cd-messages');
    if (!box) return null;
    const panel = document.getElementById('cd-history-panel');
    if (panel) panel.style.display = 'block';
    const ts = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;align-items:flex-end;width:100%;box-sizing:border-box;overflow:hidden;' + (role === 'user' ? 'flex-direction:row-reverse;' : '') + 'margin:2px 0;';
    // 아바타 (status / error 는 작은 아이콘만)
    if (role === 'user' || role === 'ai') {
      const avatar = document.createElement('div');
      avatar.style.cssText = 'flex-shrink:0;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;' + (role === 'user' ? 'background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;box-shadow:0 2px 6px rgba(255,140,0,0.25);' : 'background:linear-gradient(135deg,#5856d6,#3f3da3);color:#fff;box-shadow:0 2px 6px rgba(88,86,214,0.25);');
      avatar.textContent = role === 'user' ? '나' : '🎨';
      wrap.appendChild(avatar);
    }
    // 메시지 컨테이너 (이름 + 버블 + 시간)
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:1 1 0;min-width:0;max-width:calc(100% - 44px);overflow:hidden;' + (role === 'user' ? 'align-items:flex-end;' : 'align-items:flex-start;');
    if (role === 'ai' || role === 'user') {
      const name = document.createElement('div');
      name.style.cssText = 'font-size:10px;color:rgba(0,0,0,0.45);font-weight:700;padding:0 4px;';
      name.textContent = role === 'user' ? '나' : '마케케디자인';
      col.appendChild(name);
    }
    const bubble = document.createElement('div');
    const bubbleStyles = {
      user: 'background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:18px 18px 4px 18px;',
      ai: 'background:#fff;color:#1c1c1e;border:1px solid rgba(0,0,0,0.06);border-radius:18px 18px 18px 4px;box-shadow:0 1px 3px rgba(0,0,0,0.03);',
      status: 'background:rgba(88,86,214,0.06);color:#5856d6;border-radius:14px;font-style:italic;',
      error: 'background:rgba(255,59,48,0.08);color:#ff3b30;border-radius:14px;',
    };
    const longUserPrompt = role === 'user' && !opts.html && (String(text || '').length > 520 || String(text || '').includes('[형식 템플릿:'));
    bubble.style.cssText = `padding:10px 14px;font-size:13px;line-height:1.6;word-break:break-all;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box;${longUserPrompt ? 'width:min(360px,100%);' : ''}${bubbleStyles[role] || bubbleStyles.ai}`;
    if (longUserPrompt) {
      const firstLine = String(text || '').split('\n').find(line => line.trim() && !line.includes('[형식 템플릿:')) || '상세 템플릿 요청';
      bubble.innerHTML = `<details style="max-width:100%;">
        <summary style="cursor:pointer;font-weight:900;list-style:none;">요청 보냄 · ${_esc(firstLine).slice(0, 42)}${firstLine.length > 42 ? '...' : ''}</summary>
        <pre style="margin:8px 0 0;max-height:180px;overflow:auto;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.45;color:rgba(255,255,255,0.82);">${_esc(text)}</pre>
      </details>`;
    } else {
      bubble.innerHTML = opts.html ? text : _esc(text).replace(/\n/g, '<br>');
    }
    col.appendChild(bubble);
    if (role === 'ai' || role === 'user') {
      const time = document.createElement('div');
      time.style.cssText = 'font-size:9px;color:rgba(0,0,0,0.35);padding:0 4px;';
      time.textContent = ts;
      col.appendChild(time);
    }
    wrap.appendChild(col);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    // 카운터 + 마지막 AI 힌트 갱신
    _msgCount++;
    const cnt = document.getElementById('cd-history-count');
    if (cnt) cnt.textContent = _msgCount;
    if (role === 'ai' || role === 'status') {
      const hint = document.getElementById('cd-last-ai');
      if (hint) {
        const plain = (opts.html ? text.replace(/<[^>]+>/g, '') : text).replace(/\n+/g, ' ').trim();
        hint.textContent = (role === 'status' ? '⏳ ' : '🎨 ') + plain.slice(0, 120);
      }
    }
    return bubble;
  }

  // 대화 히스토리 — 컴팩트(220px) ↔ 확장(50vh) ↔ 축소(0) 3단계
  function cdToggleHistory() {
    const p = document.getElementById('cd-history-panel');
    if (!p) return;
    const page = document.getElementById('page-claude-design');
    if (page?.classList.contains('cd-has-preview')) {
      const collapsed = p.dataset.collapsed === '1';
      p.dataset.collapsed = collapsed ? '0' : '1';
      p.style.display = collapsed ? 'flex' : 'none';
      return;
    }
    const cur = p.style.height || '220px';
    let next;
    if (cur === '0px') next = '220px';
    else if (cur === '220px') next = '50vh';
    else next = '0px';
    p.style.height = next;
    if (next !== '0px') {
      const box = document.getElementById('cd-messages');
      if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 220);
    }
  }
  window.cdToggleHistory = cdToggleHistory;

  function _addActionsCard(actions) {
    const box = document.getElementById('cd-messages');
    if (!box) return;
    const panel = document.getElementById('cd-history-panel');
    if (panel) panel.style.display = 'block';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding:6px 36px;';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a.label;
      b.style.cssText = 'padding:5px 12px;font-size:11px;font-weight:700;border:1px solid rgba(88,86,214,0.25);background:#fff;color:#5856d6;border-radius:999px;cursor:pointer;';
      b.onclick = a.onClick;
      wrap.appendChild(b);
    });
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function cdResetChat() {
    _lastHtml = '';
    _lastMeta = {};
    _chatStarted = false;
    document.getElementById('page-claude-design')?.classList.remove('cd-chat-started');
    _msgCount = 0;
    _versions = [];
    _versionIndex = -1;
    _currentDesignId = '';
    _cdComments = [];
    _cdCommentMode = false;
    _cdCommentDraftTarget = null;
    _attachedSources = [];
    _selectedElement = null;
    const cnt = document.getElementById('cd-history-count');
    if (cnt) cnt.textContent = '0';
    const hint = document.getElementById('cd-last-ai');
    if (hint) hint.textContent = '';
    const box = document.getElementById('cd-messages');
    if (box) box.innerHTML = '';
    const panel = document.getElementById('cd-history-panel');
    if (panel) panel.style.display = 'none';
    const commentsPanel = document.getElementById('cd-comments-panel');
    if (commentsPanel) commentsPanel.style.display = 'none';
    if (typeof cdLoadCommentsForCurrentDesign === 'function') cdLoadCommentsForCurrentDesign([]);
    const dock = document.getElementById('cd-chat-dock');
    if (dock) {
      dock.style.display = 'flex';
      dock.style.left = '';
      dock.style.top = '';
      dock.style.right = '';
      dock.style.bottom = '';
    }
    const sourcePanel = document.getElementById('cd-source-panel');
    if (sourcePanel) sourcePanel.style.display = 'none';
    const iframe = document.getElementById('cd-preview');
    if (iframe) { iframe.src = 'about:blank'; }
    _setActionsEnabled(false);
    _showEmptyState();
    _clearAttachedImages();
    _renderSourceChips();
    _renderVersionChip();
    _updateInlineEditChip();
    _updateDesignUndoRedoButtons();
    if (typeof window.cdResetDesignRequiredOptions === 'function') window.cdResetDesignRequiredOptions();
    if (typeof window.cdUpdateSendAvailability === 'function') window.cdUpdateSendAvailability();
    _greet();
  }
  window.cdResetChat = cdResetChat;

  function cdToggleLibrary() {
    const p = document.getElementById('cd-library-panel');
    if (!p) return;
    const show = p.style.display === 'none';
    p.style.display = show ? 'block' : 'none';
    if (show) cdLoadList();
  }
  window.cdToggleLibrary = cdToggleLibrary;

  function cdQuickAction(text) {
    const input = document.getElementById('cd-input');
    if (input) { input.value = text; input.focus(); }
  }
  window.cdQuickAction = cdQuickAction;

  document.addEventListener('keydown', (event) => {
    const page = document.getElementById('page-claude-design');
    if (!page || page.style.display === 'none') return;
    const target = event.target;
    const tag = String(target?.tagName || '').toLowerCase();
    const editingText = target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
    if (editingText || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) cdRedoDesignChange();
    else cdUndoDesignChange();
  });

  function _greet() {
    // 사용자 요청: "무엇을 디자인할까요" 묻지 말기 — 빈 채팅에서 사용자가 먼저 입력
    _chatStarted = true;
  }

  // 요청이 모호한지 휴리스틱 — 너무 짧거나 종류명만 있으면 true
  function _isVagueRequest(text) {
    // 마케케디자인은 짧은 입력도 프로필/선택 옵션/기본 템플릿으로 보완해 즉시 생성한다.
    // 이전 질문형 흐름은 사용자가 전송 후 멈춘 것처럼 느끼게 해서 비활성화한다.
    return false;
  }

  function _askClarification(text) {
    const kindSel = document.getElementById('cd-kind');
    const kind = kindSel?.value || 'general';
    const aspect = document.getElementById('cd-aspect')?.value || '16:9';
    // 보편적인 후속 질문 + 빠른 답변 칩
    const html = `좋아요! 더 잘 만들어드리려면 몇 가지만 알려주세요 👇
      <div style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.7);">
        <div style="margin-bottom:6px;"><b>1. 무엇에 대한 것인가요?</b> (브랜드·제품·이벤트·주제)</div>
        <div style="margin-bottom:6px;"><b>2. 누구에게 보여줄 건가요?</b> (타깃 — 일반 고객, 투자자, 동료 등)</div>
        <div style="margin-bottom:6px;"><b>3. 어떤 분위기·톤?</b></div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
          <button type="button" onclick="cdAppendInput('미니멀하고 깔끔한')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">🤍 미니멀</button>
          <button type="button" onclick="cdAppendInput('따뜻하고 감성적인')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">🧡 따뜻한</button>
          <button type="button" onclick="cdAppendInput('힘 있고 강렬한')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">⚡ 강렬한</button>
          <button type="button" onclick="cdAppendInput('프리미엄 하이엔드')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">💎 프리미엄</button>
          <button type="button" onclick="cdAppendInput('재미있고 활기찬')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">🎉 재미있는</button>
          <button type="button" onclick="cdAppendInput('전문적이고 신뢰감 있는')" style="padding:3px 8px;font-size:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">🏛 전문적인</button>
        </div>
        <div style="margin-top:6px;color:rgba(0,0,0,0.45);font-size:10px;">또는 그냥 "${_esc(text)} — 한 줄 설명 추가" 식으로 답해주세요. (현재 종류: ${kind} · 비율 ${aspect})</div>
        <div style="margin-top:8px;display:flex;gap:4px;">
          <button type="button" onclick="cdSkipClarify('${_esc(text).replace(/'/g, '&#39;')}')" style="padding:5px 12px;font-size:11px;font-weight:700;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;cursor:pointer;">⏩ 그냥 진행</button>
        </div>
      </div>`;
    _addChatMessage('ai', html, { html: true });
  }

  // 칩 클릭 시 input 에 텍스트 누적
  function cdAppendInput(text) {
    const inp = document.getElementById('cd-input');
    if (!inp) return;
    const cur = inp.value.trim();
    inp.value = cur ? `${cur} · ${text}` : text;
    inp.focus();
    inp.dispatchEvent(new Event('input'));
  }
  window.cdAppendInput = cdAppendInput;

  // 명확화 건너뛰고 바로 진행
  function cdSkipClarify(originalText) {
    const inp = document.getElementById('cd-input');
    if (inp) inp.value = originalText;
    _bypassClarify = true;
    cdSendMessage();
  }
  window.cdSkipClarify = cdSkipClarify;

  // 다른 분할 파일이 참조하도록 내부 함수를 window 로 노출
  window._pushVersion = _pushVersion;
  window._renderVersionChip = _renderVersionChip;
  window._addChatMessage = _addChatMessage;
  window._addActionsCard = _addActionsCard;
  window._greet = _greet;
  window._isVagueRequest = _isVagueRequest;
  window._askClarification = _askClarification;
})();
