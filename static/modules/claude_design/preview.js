// Claude 디자인 — 미리보기/슬라이드/디바이스/인라인 편집/자료·첨부·팔레트
(function () {
  'use strict';

  const CD_MIN_ELEMENT_SIZE = 24;
  const CD_DRAG_THRESHOLD = 5;
  const CD_INLINE_DRAG_ENABLED = true;
  const CD_UNDO_LIMIT = 40;
  const CD_COMMENT_EMPTY_TITLE = '__makeke_no_title__';

  let _inlineResizeState = null;
  let _inlineDragState = null;
  let _inlinePointerState = null;
  let _cdSuppressClickUntil = 0;
  let _inlineEditPanelVisible = false;
  let _inlineSurfaceRefreshRaf = 0;

  function _getPreviewDoc() {
    try {
      return document.getElementById('cd-preview')?.contentDocument || null;
    } catch (_) {
      return null;
    }
  }

  function _buildPreviewHtml(doc) {
    if (!doc?.documentElement) return _lastHtml || '';
    _ensureMakekeEditableIds(doc);
    const doctype = doc.doctype
      ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${!doc.doctype.publicId && doc.doctype.systemId ? ' SYSTEM' : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>`
      : '<!DOCTYPE html>';
    const root = doc.documentElement.cloneNode(true);
    root.querySelectorAll('#cd-preview-slide-stage, #cd-slide-nav-css, #cd-force-all-slides-css, [data-cd-preview-ui]').forEach(el => el.remove());
    root.querySelectorAll('[data-cd-commented],[data-cd-comment-prev-title]').forEach(el => {
      const previousTitle = el.getAttribute('data-cd-comment-prev-title');
      if (previousTitle) {
        if (previousTitle === CD_COMMENT_EMPTY_TITLE) el.removeAttribute('title');
        else el.setAttribute('title', previousTitle);
      }
      el.removeAttribute('data-cd-commented');
      el.removeAttribute('data-cd-comment-prev-title');
    });
    root.querySelectorAll('[data-cd-slide]').forEach(el => {
      el.classList.remove('cd-active');
      el.removeAttribute('data-cd-slide');
    });
    return `${doctype}\n${root.outerHTML}`;
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

  function _syncPreviewHtml(doc) {
    const nextHtml = _buildPreviewHtml(doc);
    if (nextHtml) _lastHtml = nextHtml;
  }

  function _pushCdEditHistory(label) {
    const doc = _getPreviewDoc();
    const html = _buildPreviewHtml(doc);
    if (!html) return;
    const lastEntry = _cdEditUndoStack[_cdEditUndoStack.length - 1];
    if (lastEntry?.html === html) return;
    _cdEditUndoStack.push({ html, label: label || '편집', ts: Date.now() });
    if (_cdEditUndoStack.length > CD_UNDO_LIMIT) _cdEditUndoStack.shift();
    _cdEditRedoStack = [];
    if (typeof window._updateDesignUndoRedoButtons === 'function') window._updateDesignUndoRedoButtons();
  }

  function _restoreCdEditHtml(html) {
    if (!html) return;
    _selectedElement = null;
    _lastHtml = html;
    _renderPreview(html);
    _updateInlineEditChip();
    if (typeof window._updateDesignUndoRedoButtons === 'function') window._updateDesignUndoRedoButtons();
  }

  function cdUndoInlineEdit() {
    if (!_cdEditUndoStack.length) {
      if (typeof toast === 'function') toast('되돌릴 편집이 없습니다');
      return;
    }
    _hideSelectedTextEditor();
    const current = _buildPreviewHtml(_getPreviewDoc());
    if (current) _cdEditRedoStack.push({ html: current, label: 'redo', ts: Date.now() });
    const previous = _cdEditUndoStack.pop();
    _restoreCdEditHtml(previous.html);
    if (typeof window._updateDesignUndoRedoButtons === 'function') window._updateDesignUndoRedoButtons();
    if (typeof toast === 'function') toast('되돌렸습니다');
  }
  window.cdUndoInlineEdit = cdUndoInlineEdit;

  function cdRedoInlineEdit() {
    if (!_cdEditRedoStack.length) {
      if (typeof toast === 'function') toast('다시 적용할 편집이 없습니다');
      return;
    }
    _hideSelectedTextEditor();
    const current = _buildPreviewHtml(_getPreviewDoc());
    if (current) _cdEditUndoStack.push({ html: current, label: 'undo', ts: Date.now() });
    const next = _cdEditRedoStack.pop();
    _restoreCdEditHtml(next.html);
    if (typeof window._updateDesignUndoRedoButtons === 'function') window._updateDesignUndoRedoButtons();
    if (typeof toast === 'function') toast('다시 적용했습니다');
  }
  window.cdRedoInlineEdit = cdRedoInlineEdit;

  function _getSelectionChipElement() {
    const oldFloating = document.getElementById('cd-selected-floating-chip');
    if (oldFloating) oldFloating.remove();
    let chip = document.getElementById('cd-selection-chip') || document.getElementById('cd-selected-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'cd-selection-chip';
      const wrap = document.getElementById('cd-input-wrap') || document.getElementById('cd-chat-dock') || document.body;
      wrap.insertBefore(chip, wrap.firstChild);
    }
    chip.style.cssText = 'display:none;width:100%;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 9px;border:1px solid rgba(255,140,0,0.16);border-radius:12px;background:rgba(255,140,0,0.055);font-size:11px;color:#1c1c1e;box-sizing:border-box;';
    return chip;
  }

  function _positionSelectionChipByChat() {
    const chip = document.getElementById('cd-selection-chip') || document.getElementById('cd-selected-chip');
    const wrap = document.getElementById('cd-input-wrap');
    if (!chip || !wrap || chip.parentElement === wrap) return;
    wrap.insertBefore(chip, wrap.firstChild);
  }

  function _hideSelectedTextEditor() {
    document.getElementById('cd-selected-text-editor')?.remove();
  }

  function _setSelectedChatPlaceholder() {
    const input = document.getElementById('cd-input');
    if (!input) return;
    if (_selectedElement?.selector) {
      input.placeholder = '선택한 요소를 채팅으로 수정하세요. 예) 이 제목을 더 크게, 색을 파란색으로, 문구를 바꿔줘';
    } else {
      input.placeholder = '무엇을 만들지 자세히 입력하세요. 옵션 버튼을 누르면 상세 템플릿이 들어갑니다. (Enter 전송 · Shift+Enter 줄바꿈)\n💡 참고 이미지는 이 입력창 또는 오른쪽 캔버스에 드래그드랍 · 붙여넣기 가능';
    }
  }

  function _getSelectedPreviewElement() {
    const doc = _getPreviewDoc();
    if (!doc || !_selectedElement?.selector) return null;
    try {
      return doc.querySelector(_selectedElement.selector);
    } catch (_) {
      return null;
    }
  }

  function _refreshInlineSelectionSurfaces() {
    _refreshInlineSelectionOverlay();
    const panel = document.getElementById('cd-selected-text-editor');
    const target = _getSelectedPreviewElement();
    if (panel && target && !_inlineResizeState && !_inlineDragState && panel.dataset.cdManualPosition !== '1') {
      _placeSelectedTextEditorPanel(panel, target);
    }
  }

  function _scheduleInlineSelectionSurfaceRefresh() {
    if (_inlineSurfaceRefreshRaf) return;
    _inlineSurfaceRefreshRaf = requestAnimationFrame(() => {
      _inlineSurfaceRefreshRaf = 0;
      _refreshInlineSelectionSurfaces();
    });
  }

  function _isTextEditableElement(el) {
    if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    const tag = (el.tagName || '').toLowerCase();
    if (['html', 'body', 'main', 'section', 'article', 'nav', 'input', 'textarea', 'select', 'option', 'svg', 'canvas', 'img', 'video', 'iframe'].includes(tag)) return false;
    if (el.querySelector('img, video, iframe, canvas, svg, input, textarea')) return false;
    const hasDirectText = Array.from(el.childNodes || []).some(node => node.nodeType === 3 && (node.textContent || '').trim().length > 0);
    if (el.children?.length && !hasDirectText && !['button', 'a'].includes(tag)) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0;
  }

  function _isSelectableEditableElement(el) {
    if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    const tag = (el.tagName || '').toLowerCase();
    if (['a', 'button', 'img', 'svg', 'canvas', 'video'].includes(tag)) return true;
    if (_isTextEditableElement(el)) return true;
    return _isVisualEditableElement(el);
  }

  function _isVisualEditableElement(el) {
    if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return false;
    const tag = (el.tagName || '').toLowerCase();
    if (['script', 'style', 'link', 'meta', 'input', 'textarea', 'button', 'select', 'option'].includes(tag)) return false;
    const rect = el.getBoundingClientRect?.();
    if (!rect || rect.width < 32 || rect.height < 32) return false;
    const cs = el.ownerDocument.defaultView?.getComputedStyle?.(el);
    if (!cs) return false;
    const bgImage = cs.backgroundImage && cs.backgroundImage !== 'none';
    const bgColor = cs.backgroundColor && !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(cs.backgroundColor);
    const hasMedia = !!el.querySelector?.('img,svg,canvas,video');
    const hasBorder = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].some(k => parseFloat(cs[k] || '0') > 0);
    const area = rect.width * rect.height;
    const text = (el.textContent || '').trim();
    return area >= 1600 && (bgImage || bgColor || hasMedia || hasBorder || (!text && area >= 6400));
  }

  function _resolveInlineEditableTarget(rawTarget, doc) {
    let el = rawTarget?.nodeType === 1 ? rawTarget : rawTarget?.parentElement;
    while (el && el !== doc?.body && el !== doc?.documentElement) {
      if (_isSelectableEditableElement(el)) return el;
      el = el.parentElement;
    }
    el = rawTarget?.nodeType === 1 ? rawTarget : rawTarget?.parentElement;
    while (el && el !== doc?.body && el !== doc?.documentElement) {
      const tag = (el.tagName || '').toLowerCase();
      const rect = el.getBoundingClientRect?.();
      if (!['script', 'style', 'link', 'meta', 'input', 'textarea', 'select', 'option'].includes(tag)
        && rect && rect.width >= 8 && rect.height >= 8) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function _getIframeScale() {
    const iframe = document.getElementById('cd-preview');
    if (!iframe) return 1;
    const rect = iframe.getBoundingClientRect();
    return Math.max(0.05, rect.width / Math.max(1, iframe.offsetWidth));
  }

  function _getElementPageRect(el) {
    const iframe = document.getElementById('cd-preview');
    if (!iframe || !el) return null;
    const scale = _getIframeScale();
    const iframeRect = iframe.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      left: iframeRect.left + rect.left * scale,
      top: iframeRect.top + rect.top * scale,
      width: rect.width * scale,
      height: rect.height * scale,
      scale,
    };
  }

  function _parsePx(value, fallback) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function _roundPx(value) {
    return `${Math.round(value * 10) / 10}px`;
  }

  function _ensureTransformableElement(el) {
    if (!el) return null;
    const win = el.ownerDocument.defaultView;
    const computed = win?.getComputedStyle(el);
    if (!computed) return null;
    if (computed.display === 'inline') el.style.display = 'inline-block';
    if (computed.position === 'static') {
      el.style.position = 'relative';
      if (!el.style.left) el.style.left = '0px';
      if (!el.style.top) el.style.top = '0px';
    }
    return win?.getComputedStyle(el) || computed;
  }

  function _setSelectedElementZIndex(delta) {
    const target = _getSelectedPreviewElement();
    if (!target) return;
    _pushCdEditHistory('레이어 순서');
    const computed = _ensureTransformableElement(target);
    const current = _parsePx(computed?.zIndex, 0);
    target.style.zIndex = String(Math.max(0, current + delta));
    _syncPreviewHtml(target.ownerDocument);
    _refreshInlineSelectionOverlay();
  }

  function cdBringSelectedForward() {
    _setSelectedElementZIndex(1);
  }
  window.cdBringSelectedForward = cdBringSelectedForward;

  function cdSendSelectedBackward() {
    _setSelectedElementZIndex(-1);
  }
  window.cdSendSelectedBackward = cdSendSelectedBackward;

  function _mutateSelectedElement(label, mutator, options) {
    const target = _getSelectedPreviewElement();
    if (!target || typeof mutator !== 'function') return;
    const opts = options || {};
    if (!opts.live) _pushCdEditHistory(label || '요소 편집');
    const computed = _ensureTransformableElement(target);
    mutator(target, computed);
    _syncPreviewHtml(target.ownerDocument);
    _selectedElement = {
      selector: _buildSelector(target),
      html: target.outerHTML,
      text: ((target.tagName || '').toLowerCase() === 'img' ? (target.getAttribute('alt') || '이미지') : (target.textContent || '')).trim().slice(0, 80),
    };
    _updateInlineEditChip();
    _refreshInlineSelectionOverlay();
  }

  function cdAdjustSelectedFont(delta) {
    _mutateSelectedElement('글자 크기', (target, computed) => {
      const current = _parsePx(computed?.fontSize, 16);
      target.style.fontSize = `${Math.max(8, Math.min(120, Math.round(current + delta)))}px`;
      target.style.lineHeight = target.style.lineHeight || '1.12';
    });
  }
  window.cdAdjustSelectedFont = cdAdjustSelectedFont;

  function cdToggleSelectedBold() {
    _mutateSelectedElement('굵기 변경', (target, computed) => {
      const weight = parseInt(computed?.fontWeight || '400', 10);
      target.style.fontWeight = weight >= 700 ? '500' : '900';
    });
  }
  window.cdToggleSelectedBold = cdToggleSelectedBold;

  function cdSetSelectedAlign(align, options) {
    _mutateSelectedElement('정렬 변경', (target) => {
      target.style.textAlign = align || 'left';
    }, options);
    _syncSelectedTextEditorControls();
  }
  window.cdSetSelectedAlign = cdSetSelectedAlign;

  function cdSetSelectedColor(color, options) {
    if (!color) return;
    _mutateSelectedElement('글자색 변경', (target) => {
      target.style.color = color;
    }, options);
    _syncSelectedTextEditorControls();
  }
  window.cdSetSelectedColor = cdSetSelectedColor;

  function cdSetSelectedBackground(color, options) {
    _mutateSelectedElement('배경색 변경', (target) => {
      target.style.background = color || 'transparent';
    }, options);
    _syncSelectedTextEditorControls();
  }
  window.cdSetSelectedBackground = cdSetSelectedBackground;

  function cdSetSelectedFontSize(size, options) {
    const numeric = Math.max(8, Math.min(160, parseInt(size, 10) || 16));
    _mutateSelectedElement('글자 크기 지정', (target) => {
      target.style.fontSize = `${numeric}px`;
      target.style.lineHeight = target.style.lineHeight || '1.12';
    }, options);
  }
  window.cdSetSelectedFontSize = cdSetSelectedFontSize;

  function _colorToPickerValue(value, fallback) {
    const raw = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw.slice(1).split('').map(ch => ch + ch).join('')}`;
    }
    const rgb = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgb) {
      return `#${[rgb[1], rgb[2], rgb[3]].map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)).toString(16).padStart(2, '0')).join('')}`;
    }
    return fallback || '#1c1c1e';
  }

  function _syncSelectedTextEditorControls() {
    const target = _getSelectedPreviewElement();
    const panel = document.getElementById('cd-selected-text-editor');
    if (!target || !panel) return;
    const computed = target.ownerDocument?.defaultView?.getComputedStyle(target);
    const fontInput = panel.querySelector('#cd-selected-font-size');
    const colorPicker = panel.querySelector('#cd-selected-color-picker');
    const colorText = panel.querySelector('#cd-selected-color-text');
    const bgPicker = panel.querySelector('#cd-selected-bg-picker');
    const bgText = panel.querySelector('#cd-selected-bg-text');
    const align = computed?.textAlign || 'left';
    const bg = computed?.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.backgroundColor : '';
    if (fontInput) fontInput.value = String(Math.round(_parsePx(computed?.fontSize, 16)));
    if (colorPicker) colorPicker.value = _colorToPickerValue(computed?.color, '#1c1c1e');
    if (colorText) colorText.value = target.style.color || _colorToPickerValue(computed?.color, '#1c1c1e');
    if (bgPicker) bgPicker.value = _colorToPickerValue(bg, '#ffffff');
    if (bgText) bgText.value = target.style.background || (bg ? _colorToPickerValue(bg, '#ffffff') : '');
    panel.querySelectorAll('[data-cd-align]').forEach((button) => {
      const active = button.dataset.cdAlign === align;
      button.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
      button.style.color = active ? '#fff' : '#1c1c1e';
      button.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.10)';
    });
  }

  function cdDuplicateSelectedElement() {
    const target = _getSelectedPreviewElement();
    if (!target || !target.parentElement) return;
    _pushCdEditHistory('복제');
    const clone = target.cloneNode(true);
    clone.removeAttribute('data-cd-selected');
    clone.removeAttribute('data-cd-hover');
    target.after(clone);
    const computed = _ensureTransformableElement(clone);
    const left = _parsePx(computed?.left, 0);
    const top = _parsePx(computed?.top, 0);
    clone.style.left = _roundPx(left + 18);
    clone.style.top = _roundPx(top + 18);
    _syncPreviewHtml(clone.ownerDocument);
    _selectInlineElement(clone, { announce: false });
    if (typeof toast === 'function') toast('선택 요소를 복제했습니다');
  }
  window.cdDuplicateSelectedElement = cdDuplicateSelectedElement;

  function cdCopySelectedElement() {
    const target = _getSelectedPreviewElement();
    if (!target) return;
    _cdClipboardHtml = target.outerHTML;
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(_cdClipboardHtml).catch(() => {});
    }
    if (typeof toast === 'function') toast('선택 요소를 복사했습니다');
  }
  window.cdCopySelectedElement = cdCopySelectedElement;

  function cdPasteSelectedElement() {
    const doc = _getPreviewDoc();
    if (!doc || !_cdClipboardHtml) return;
    const target = _getSelectedPreviewElement();
    const template = doc.createElement('template');
    template.innerHTML = _cdClipboardHtml.trim();
    const clone = template.content.firstElementChild;
    if (!clone) return;
    _pushCdEditHistory('붙여넣기');
    clone.removeAttribute('data-cd-selected');
    clone.removeAttribute('data-cd-hover');
    const parent = target?.parentElement || doc.body;
    if (target?.parentElement) target.after(clone);
    else parent.appendChild(clone);
    const computed = _ensureTransformableElement(clone);
    clone.style.left = _roundPx(_parsePx(computed?.left, 0) + 24);
    clone.style.top = _roundPx(_parsePx(computed?.top, 0) + 24);
    _syncPreviewHtml(doc);
    _selectInlineElement(clone, { announce: false });
    if (typeof toast === 'function') toast('붙여넣었습니다');
  }
  window.cdPasteSelectedElement = cdPasteSelectedElement;

  async function _replaceImageFromFile(img, file) {
    if (!img || !file) return;
    _pushCdEditHistory('이미지 교체');
    const dataUrl = await _readFileAsDataUrl(file);
    img.setAttribute('src', dataUrl);
    img.removeAttribute('srcset');
    _syncPreviewHtml(img.ownerDocument);
    _selectInlineElement(img, { announce: false });
    if (typeof toast === 'function') toast('이미지를 교체했습니다');
  }

  function cdReplaceSelectedImage() {
    const target = _getSelectedPreviewElement();
    if (!target || (target.tagName || '').toLowerCase() !== 'img') {
      if (typeof toast === 'function') toast('이미지를 선택한 뒤 교체하세요', 'warning');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => _replaceImageFromFile(target, input.files?.[0]);
    input.click();
  }
  window.cdReplaceSelectedImage = cdReplaceSelectedImage;

  async function cdAIReplaceSelectedImage(instruction) {
    const target = _getSelectedPreviewElement();
    if (!target || (target.tagName || '').toLowerCase() !== 'img') {
      if (typeof toast === 'function') toast('AI로 바꿀 이미지를 먼저 선택하세요', 'warning');
      return;
    }
    const doc = target.ownerDocument;
    const prompt = (instruction || '').trim()
      || target.getAttribute('data-gen-prompt')
      || target.getAttribute('alt')
      || '현재 디자인 분위기에 자연스럽게 어울리는 고품질 이미지';
    _pushCdEditHistory('AI 이미지 교체');
    if (typeof toast === 'function') toast('선택 이미지 AI 교체 중...');
    const res = await fetch('/api/blog/generate-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: document.getElementById('cd-brand')?.value || _lastMeta.kind || 'makeke-design',
        content: doc?.body?.innerText || _lastHtml.slice(0, 1800),
        count: 1,
        image_prompts: [prompt],
        source_context: _attachedSources.map(s => `${s.title}\n${s.snippet || ''}`).join('\n\n'),
        user_image_urls: _attachedImages.map(im => im.sourceUrl || im.dataUrl).filter(Boolean),
        design_rules: '선택된 HTML 이미지 한 장을 대체합니다. 기존 레이아웃, 브랜드 색상, 주변 카피와 어울리게 만들고 텍스트/워터마크/가짜 로고는 넣지 않습니다.',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI 이미지 생성 실패');
    const item = Array.isArray(data.images) ? data.images[0] : null;
    const url = item?.url || item?.path || '';
    if (!url) throw new Error('생성된 이미지 URL이 없습니다');
    target.setAttribute('src', url);
    target.removeAttribute('srcset');
    target.setAttribute('data-ai-replaced', 'true');
    _syncPreviewHtml(doc);
    _selectInlineElement(target, { announce: false });
    if (typeof toast === 'function') toast('선택 이미지를 AI 이미지로 교체했습니다');
  }
  window.cdAIReplaceSelectedImage = cdAIReplaceSelectedImage;

  function _beginInlineDrag(target, event, origin) {
    const computed = target?.ownerDocument?.defaultView?.getComputedStyle(target);
    if (!target || !computed) return;
    _pushCdEditHistory('이동');
    const rect = target.getBoundingClientRect();
    const parentRect = target.offsetParent?.getBoundingClientRect?.() || { left: 0, top: 0 };
    if (computed.position === 'static') {
      target.style.position = 'relative';
    }
    _inlineDragState = {
      target,
      startX: origin?.x ?? event.clientX,
      startY: origin?.y ?? event.clientY,
      startLeft: _parsePx(computed.left, Number.isFinite(rect.left - parentRect.left) ? rect.left - parentRect.left : 0),
      startTop: _parsePx(computed.top, Number.isFinite(rect.top - parentRect.top) ? rect.top - parentRect.top : 0),
    };
    target.ownerDocument.body.style.cursor = 'move';
    target.style.cursor = 'move';
  }

  function _moveInlineDrag(event) {
    if (!_inlineDragState?.target?.isConnected) return;
    const state = _inlineDragState;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    state.target.style.left = _roundPx(state.startLeft + dx);
    state.target.style.top = _roundPx(state.startTop + dy);
    _syncPreviewHtml(state.target.ownerDocument);
    _updateInlineEditChip();
    _refreshInlineSelectionOverlay();
  }

  function _finishInlineDrag() {
    if (!_inlineDragState?.target) return;
    const { target } = _inlineDragState;
    target.style.cursor = '';
    target.ownerDocument.body.style.cursor = '';
    _syncPreviewHtml(target.ownerDocument);
    _selectInlineElement(target, { announce: false });
    _inlineDragState = null;
    _cdSuppressClickUntil = Date.now() + 250;
  }

  function _isInlineEditingTarget(target) {
    return target?.dataset?.cdEditing === '1' || target?.isContentEditable;
  }

  function _ensureInlineOverlay() {
    const wrap = document.getElementById('cd-preview-wrap');
    if (!wrap) return null;
    _bindFloatingEditDismissal();
    let overlay = wrap.querySelector('#cd-inline-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cd-inline-overlay';
      overlay.style.cssText = 'display:none;position:absolute;z-index:5;border:2px solid rgba(255,140,0,0.9);border-radius:8px;box-shadow:0 0 0 1px rgba(255,255,255,0.95) inset;pointer-events:none;';
      overlay.innerHTML = `
        <div data-cd-canvas-toolbar style="position:fixed;top:0;left:0;display:none;align-items:center;gap:4px;padding:5px 6px;border:1px solid rgba(255,140,0,0.24);background:rgba(255,255,255,0.96);border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,0.14);pointer-events:auto;backdrop-filter:blur(10px);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <button type="button" data-cd-tool="edit" title="텍스트 직접 수정" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">수정</button>
          <button type="button" data-cd-tool="font-minus" title="글자 작게" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">A-</button>
          <button type="button" data-cd-tool="font-plus" title="글자 크게" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">A+</button>
          <button type="button" data-cd-tool="bold" title="굵게" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">B</button>
          <button type="button" data-cd-tool="align-left" title="왼쪽 정렬" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">좌</button>
          <button type="button" data-cd-tool="align-center" title="가운데 정렬" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">중</button>
          <button type="button" data-cd-tool="align-right" title="오른쪽 정렬" style="border:0;background:#fff;color:#1c1c1e;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">우</button>
          <button type="button" data-cd-tool="color-orange" title="글자 앱 기본 강조색" style="width:20px;height:20px;border:1px solid rgba(0,0,0,0.08);background:#ff8c00;border-radius:999px;cursor:pointer;"></button>
          <button type="button" data-cd-tool="color-black" title="글자 검정" style="width:20px;height:20px;border:1px solid rgba(0,0,0,0.08);background:#1c1c1e;border-radius:999px;cursor:pointer;"></button>
          <button type="button" data-cd-tool="bg-soft" title="부드러운 배경" style="width:20px;height:20px;border:1px solid rgba(255,140,0,0.2);background:#fff3e3;border-radius:999px;cursor:pointer;"></button>
          <button type="button" data-cd-tool="front" title="앞으로" style="border:0;background:#fff;color:#007aff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">앞</button>
          <button type="button" data-cd-tool="back" title="뒤로" style="border:0;background:#fff;color:#007aff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">뒤</button>
          <button type="button" data-cd-tool="copy" title="복사" style="border:0;background:#fff;color:#5856d6;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">복사</button>
          <button type="button" data-cd-tool="duplicate" title="복제" style="border:0;background:#fff;color:#5856d6;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">복제</button>
          <button type="button" data-cd-tool="replace" title="이미지 교체" style="border:0;background:rgba(0,122,255,0.10);color:#007aff;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">이미지</button>
          <button type="button" data-cd-tool="ai-image" title="AI로 이미지 교체" style="border:0;background:rgba(255,140,0,0.12);color:#ff8c00;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">AI</button>
          <button type="button" data-cd-tool="delete" title="삭제" style="border:0;background:rgba(255,59,48,0.10);color:#ff3b30;border-radius:7px;padding:4px 7px;font-size:10px;font-weight:900;cursor:pointer;">삭제</button>
        </div>
        ${['nw','ne','sw','se'].map(pos => `<span data-cd-resize-handle="${pos}" style="position:absolute;${pos.includes('n') ? 'top:-6px;' : 'bottom:-6px;'}${pos.includes('w') ? 'left:-6px;' : 'right:-6px;'}width:10px;height:10px;border:2px solid #fff;background:#ff8c00;border-radius:999px;box-shadow:0 1px 5px rgba(0,0,0,0.22);pointer-events:auto;cursor:${pos}-resize;"></span>`).join('')}
      `;
      wrap.appendChild(overlay);
    }
    overlay.querySelectorAll('[data-cd-resize-handle]').forEach((handle) => {
      if (handle.dataset.bound) return;
      handle.dataset.bound = '1';
      handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = _getSelectedPreviewElement();
        if (!target) return;
        _pushCdEditHistory('크기 조절');
        const computed = _ensureTransformableElement(target);
        _inlineResizeState = {
          target,
          handle: handle.dataset.cdResizeHandle,
          startX: event.clientX,
          startY: event.clientY,
          startWidth: parseFloat(computed?.width || target.getBoundingClientRect().width || 0),
          startHeight: parseFloat(computed?.height || target.getBoundingClientRect().height || 0),
          startLeft: _parsePx(computed?.left, 0),
          startTop: _parsePx(computed?.top, 0),
          scale: _getIframeScale(),
        };
      });
    });
    const toolbar = overlay.querySelector('[data-cd-canvas-toolbar]');
    if (toolbar && !toolbar.dataset.bound) {
      toolbar.dataset.bound = '1';
      toolbar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cd-tool]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const tool = button.dataset.cdTool;
        if (tool === 'edit') cdEditSelectedText();
        if (tool === 'font-minus') cdAdjustSelectedFont(-3);
        if (tool === 'font-plus') cdAdjustSelectedFont(3);
        if (tool === 'bold') cdToggleSelectedBold();
        if (tool === 'align-left') cdSetSelectedAlign('left');
        if (tool === 'align-center') cdSetSelectedAlign('center');
        if (tool === 'align-right') cdSetSelectedAlign('right');
        if (tool === 'color-orange') cdSetSelectedColor('#ff8c00');
        if (tool === 'color-black') cdSetSelectedColor('#1c1c1e');
        if (tool === 'bg-soft') cdSetSelectedBackground('rgba(255,140,0,0.12)');
        if (tool === 'copy') cdCopySelectedElement();
        if (tool === 'duplicate') cdDuplicateSelectedElement();
        if (tool === 'front') cdBringSelectedForward();
        if (tool === 'back') cdSendSelectedBackward();
        if (tool === 'replace') cdReplaceSelectedImage();
        if (tool === 'ai-image') cdAIReplaceSelectedImage().catch(e => {
          if (typeof toast === 'function') toast('AI 이미지 교체 실패: ' + (e?.message || e), 'error');
        });
        if (tool === 'delete') cdDeleteSelectedElement();
      });
    }
    if (!window._cdInlineOverlayBound) {
      window._cdInlineOverlayBound = true;
      document.addEventListener('mousemove', (event) => {
        if (!_inlineResizeState?.target?.isConnected) return;
        event.preventDefault();
        const state = _inlineResizeState;
        const dx = (event.clientX - state.startX) / state.scale;
        const dy = (event.clientY - state.startY) / state.scale;
        const handle = state.handle || 'se';
        let nextWidth = state.startWidth;
        let nextHeight = state.startHeight;
        let nextLeft = state.startLeft;
        let nextTop = state.startTop;
        if (handle.includes('e')) nextWidth = state.startWidth + dx;
        if (handle.includes('s')) nextHeight = state.startHeight + dy;
        if (handle.includes('w')) {
          nextWidth = state.startWidth - dx;
          nextLeft = state.startLeft + dx;
        }
        if (handle.includes('n')) {
          nextHeight = state.startHeight - dy;
          nextTop = state.startTop + dy;
        }
        nextWidth = Math.max(CD_MIN_ELEMENT_SIZE, nextWidth);
        nextHeight = Math.max(CD_MIN_ELEMENT_SIZE, nextHeight);
        state.target.style.width = _roundPx(nextWidth);
        state.target.style.height = _roundPx(nextHeight);
        state.target.style.maxWidth = 'none';
        if (handle.includes('w')) state.target.style.left = _roundPx(nextLeft);
        if (handle.includes('n')) state.target.style.top = _roundPx(nextTop);
        _syncPreviewHtml(state.target.ownerDocument);
        _updateInlineEditChip();
        _refreshInlineSelectionOverlay();
      });
      document.addEventListener('mouseup', () => {
        if (!_inlineResizeState?.target) return;
        _syncPreviewHtml(_inlineResizeState.target.ownerDocument);
        _inlineResizeState = null;
      });
    }
    if (!wrap.dataset.cdInlineScrollBound) {
      wrap.dataset.cdInlineScrollBound = '1';
      wrap.addEventListener('scroll', () => _scheduleInlineSelectionSurfaceRefresh(), { passive: true });
    }
    return overlay;
  }

  function _hideInlineSelectionOverlay() {
    const overlay = document.getElementById('cd-inline-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      const toolbar = overlay.querySelector('[data-cd-canvas-toolbar]');
      if (toolbar) toolbar.style.display = 'none';
    }
  }

  function _hideFloatingEditSurfaces() {
    if (_inlineResizeState || _inlineDragState) return;
    _hideInlineSelectionOverlay();
    _hideSelectedTextEditor();
  }

  function _bindFloatingEditDismissal() {
    if (window._cdFloatingEditDismissBound) return;
    window._cdFloatingEditDismissBound = true;
    let raf = 0;
    const dismiss = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        _hideFloatingEditSurfaces();
      });
    };
    window.addEventListener('scroll', dismiss, { passive: true });
    document.addEventListener('scroll', dismiss, { passive: true, capture: true });
    window.addEventListener('resize', dismiss, { passive: true });
    document.addEventListener('pointerdown', (event) => {
      const page = document.getElementById('page-claude-design');
      if (!page?.classList.contains('active')) return;
      if (!_selectedElement && !document.getElementById('cd-selected-text-editor')) return;
      const target = event.target;
      if (target?.closest?.('#cd-preview, #cd-selected-text-editor, #cd-selection-chip, #cd-selected-chip, #cd-inline-overlay, [data-cd-canvas-toolbar]')) return;
      cdClearSelection();
    }, true);
  }

  function _rectsOverlap(a, b, pad) {
    const p = Number.isFinite(pad) ? pad : 0;
    return !(a.right + p <= b.left || a.left - p >= b.right || a.bottom + p <= b.top || a.top - p >= b.bottom);
  }

  function _placeInlineToolbar(toolbar, targetRect, wrapRect) {
    if (!toolbar || !targetRect || !wrapRect) return;
    toolbar.style.setProperty('position', 'fixed', 'important');
    toolbar.style.setProperty('top', '0px', 'important');
    toolbar.style.setProperty('left', '0px', 'important');
    toolbar.style.setProperty('right', 'auto', 'important');
    toolbar.style.setProperty('bottom', 'auto', 'important');
    toolbar.style.setProperty('display', 'flex', 'important');
    toolbar.style.setProperty('z-index', '10030', 'important');
    toolbar.style.setProperty('max-width', `${Math.max(260, Math.min(640, wrapRect.width - 24))}px`, 'important');
    toolbar.style.setProperty('flex-wrap', 'wrap', 'important');
    toolbar.style.setProperty('visibility', 'hidden', 'important');

    const width = Math.min(toolbar.offsetWidth || 420, Math.max(260, wrapRect.width - 24));
    const height = toolbar.offsetHeight || 38;
    const margin = 12;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const targetBox = {
      left: targetRect.left,
      right: targetRect.left + targetRect.width,
      top: targetRect.top,
      bottom: targetRect.top + targetRect.height,
    };
    const candidates = [
      { x: wrapRect.right - width - margin, y: wrapRect.top + margin },
      { x: wrapRect.right - width - margin, y: wrapRect.bottom - height - margin },
      { x: wrapRect.left + margin, y: wrapRect.top + margin },
      { x: wrapRect.left + margin, y: wrapRect.bottom - height - margin },
      { x: wrapRect.left + (wrapRect.width - width) / 2, y: wrapRect.top + margin },
      { x: wrapRect.left + (wrapRect.width - width) / 2, y: wrapRect.bottom - height - margin },
    ].map(pos => ({
      x: clamp(pos.x, wrapRect.left + margin, wrapRect.right - width - margin),
      y: clamp(pos.y, wrapRect.top + margin, wrapRect.bottom - height - margin),
    }));
    const chosen = candidates.find(pos => !_rectsOverlap({
      left: pos.x,
      right: pos.x + width,
      top: pos.y,
      bottom: pos.y + height,
    }, targetBox, 8)) || candidates[0];

    toolbar.style.setProperty('left', `${Math.round(chosen.x)}px`, 'important');
    toolbar.style.setProperty('top', `${Math.round(chosen.y)}px`, 'important');
    toolbar.style.setProperty('visibility', 'visible', 'important');
  }

  function _placeSelectedTextEditorPanel(panel, target) {
    if (!panel || !target) return;
    const visualViewport = window.visualViewport || null;
    const viewportLeft = Math.round(visualViewport?.offsetLeft || 0);
    const viewportTopOffset = Math.round(visualViewport?.offsetTop || 0);
    const viewportWidth = Math.round(visualViewport?.width || window.innerWidth);
    const viewportHeight = Math.round(visualViewport?.height || window.innerHeight);
    const targetRect = _getElementPageRect(target);
    const previewWrap = document.getElementById('cd-preview-wrap');
    const previewCol = document.getElementById('cd-preview-col') || previewWrap;
    const previewRect = previewWrap?.getBoundingClientRect?.() || null;
    const previewColRect = previewCol?.getBoundingClientRect?.() || previewRect;
    const chatCol = document.getElementById('cd-chat-col') || document.getElementById('cd-left-panel') || document.getElementById('cd-chat-dock');
    const chatRect = chatCol?.getBoundingClientRect?.() || null;
    panel.style.position = 'fixed';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.visibility = 'hidden';

    const margin = 14;
    const bottomReserve = 76;
    const viewportTop = viewportTopOffset + margin;
    const viewportBottom = Math.max(viewportTop + 260, viewportTopOffset + viewportHeight - bottomReserve);
    const viewportRight = viewportLeft + viewportWidth - margin;
    const viewportLeftSafe = viewportLeft + margin;
    const usableHeight = Math.max(280, viewportBottom - viewportTop);
    const safeWidth = Math.max(260, Math.min(380, viewportWidth - margin * 2));
    panel.style.width = `${safeWidth}px`;
    panel.style.maxWidth = `${safeWidth}px`;
    panel.style.maxHeight = `${Math.round(usableHeight)}px`;
    panel.style.overflowX = 'hidden';
    panel.style.overflowY = 'auto';
    panel.style.overscrollBehavior = 'contain';
    panel.style.paddingBottom = '14px';

    const width = Math.min(panel.offsetWidth || safeWidth, viewportWidth - margin * 2);
    const height = Math.min(panel.scrollHeight || panel.offsetHeight || 520, usableHeight);
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const panelBox = (pos) => ({ left: pos.x, right: pos.x + width, top: pos.y, bottom: pos.y + height });
    const viewportBox = { left: viewportLeftSafe, top: viewportTop, right: viewportRight, bottom: viewportBottom };
    const rectIsVisible = (rect) => rect && rect.right > viewportLeft && rect.left < viewportLeft + viewportWidth && rect.bottom > viewportTopOffset && rect.top < viewportTopOffset + viewportHeight;
    const fitX = (x) => clamp(x, viewportLeftSafe, viewportRight - width);
    const fitY = (y) => clamp(y, viewportTop, viewportBottom - height);
    const settle = (x, y) => {
      panel.style.left = `${Math.round(fitX(x))}px`;
      panel.style.top = `${Math.round(fitY(y))}px`;
      panel.style.visibility = 'visible';
      requestAnimationFrame(() => _fitSelectedTextEditorPanelToViewport(panel));
    };
    const validTarget = targetRect
      && Number.isFinite(targetRect.left)
      && Number.isFinite(targetRect.top)
      && Number.isFinite(targetRect.width)
      && Number.isFinite(targetRect.height);
    if (!validTarget) {
      const wrap = document.getElementById('cd-preview-wrap') || document.getElementById('cd-preview-col') || document.body;
      const wrapRect = wrap.getBoundingClientRect();
      const fallbackX = previewColRect && previewColRect.right + margin + width <= viewportRight
        ? previewColRect.right + margin
        : wrapRect.right - width - margin;
      settle(fallbackX, wrapRect.top + margin);
      return;
    }
    const box = {
      left: targetRect.left,
      top: targetRect.top,
      right: targetRect.left + targetRect.width,
      bottom: targetRect.top + targetRect.height,
    };
    const canvasAvoidBox = previewRect && rectIsVisible(previewRect)
      ? {
          left: Math.max(0, previewRect.left),
          top: Math.max(viewportTop, previewRect.top),
          right: Math.min(viewportLeft + viewportWidth, previewRect.right),
          bottom: Math.min(viewportBottom, previewRect.bottom),
        }
      : null;
    const candidates = [];
    if (previewColRect && previewColRect.right + margin + width <= viewportRight) {
      candidates.push({ x: previewColRect.right + margin, y: fitY(box.top), zone: 'right-of-preview' });
    }
    if (previewColRect && previewColRect.left - margin - width >= viewportLeftSafe) {
      candidates.push({ x: previewColRect.left - width - margin, y: fitY(box.top), zone: 'left-of-preview' });
    }
    if (chatRect && rectIsVisible(chatRect)) {
      const chatTop = Math.max(viewportTop, chatRect.top + margin);
      const chatBottom = Math.min(viewportBottom, chatRect.bottom - margin);
      if (chatBottom - chatTop >= Math.min(height, 260)) {
        candidates.push({ x: chatRect.right - width - margin, y: clamp(box.top, chatTop, Math.max(chatTop, chatBottom - height)), zone: 'chat-col' });
      }
    }
    candidates.push(
      { x: viewportRight - width, y: viewportTop, zone: 'top-right' },
      { x: viewportLeftSafe, y: viewportTop, zone: 'top-left' },
      { x: viewportRight - width, y: viewportBottom - height, zone: 'bottom-right' },
      { x: viewportLeftSafe, y: viewportBottom - height, zone: 'bottom-left' },
      { x: box.right + margin, y: box.top, zone: 'near-right' },
      { x: box.left - width - margin, y: box.top, zone: 'near-left' },
      { x: box.left, y: box.bottom + margin, zone: 'near-bottom' },
      { x: box.left, y: box.top - height - margin, zone: 'near-top' }
    );
    const normalized = candidates.map(pos => ({
      x: fitX(pos.x),
      y: fitY(pos.y),
      zone: pos.zone,
    }));
    const chosen = normalized.find(pos => {
      const candidateBox = panelBox(pos);
      if (!_rectsOverlap(candidateBox, viewportBox, -1)) return false;
      if (_rectsOverlap(candidateBox, box, 18)) return false;
      if (canvasAvoidBox && _rectsOverlap(candidateBox, canvasAvoidBox, 0) && !/^near-/.test(pos.zone || '')) return false;
      return true;
    }) || normalized.find(pos => !_rectsOverlap(panelBox(pos), box, 18)) || normalized[0];
    settle(chosen.x, chosen.y);
  }

  function _positionSelectedTextEditor(panel) {
    const target = _getSelectedPreviewElement();
    if (panel && target) {
      _placeSelectedTextEditorPanel(panel, target);
      return;
    }
    if (panel) _fitSelectedTextEditorPanelToViewport(panel);
  }

  function _fitSelectedTextEditorPanelToViewport(panel) {
    if (!panel) return;
    const visualViewport = window.visualViewport || null;
    const margin = 14;
    const leftBound = Math.round(visualViewport?.offsetLeft || 0) + margin;
    const topBound = Math.round(visualViewport?.offsetTop || 0) + margin;
    const rightBound = leftBound + Math.round(visualViewport?.width || window.innerWidth) - margin * 2;
    const bottomBound = topBound + Math.round(visualViewport?.height || window.innerHeight) - 90;
    const rect = panel.getBoundingClientRect();
    const width = Math.min(rect.width || 360, Math.max(260, rightBound - leftBound));
    const height = Math.min(rect.height || 480, Math.max(240, bottomBound - topBound));
    const currentLeft = parseFloat(panel.style.left || rect.left || leftBound);
    const currentTop = parseFloat(panel.style.top || rect.top || topBound);
    const nextLeft = Math.max(leftBound, Math.min(currentLeft, rightBound - width));
    const nextTop = Math.max(topBound, Math.min(currentTop, bottomBound - height));
    panel.style.left = `${Math.round(nextLeft)}px`;
    panel.style.top = `${Math.round(nextTop)}px`;
    panel.style.width = `${Math.round(width)}px`;
    panel.style.maxWidth = `${Math.round(width)}px`;
    panel.style.maxHeight = `${Math.round(Math.max(240, bottomBound - topBound))}px`;
  }

  function _refreshInlineSelectionOverlay() {
    const overlay = _ensureInlineOverlay();
    const wrap = document.getElementById('cd-preview-wrap');
    const target = _getSelectedPreviewElement();
    if (!overlay || !wrap || !target || !target.isConnected) {
      _hideInlineSelectionOverlay();
      return;
    }
    const rect = _getElementPageRect(target);
    const wrapRect = wrap.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      _hideInlineSelectionOverlay();
      return;
    }
    overlay.style.display = 'block';
    overlay.style.left = `${rect.left - wrapRect.left + wrap.scrollLeft}px`;
    overlay.style.top = `${rect.top - wrapRect.top + wrap.scrollTop}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    const toolbar = overlay.querySelector('[data-cd-canvas-toolbar]');
    if (toolbar) {
      _placeInlineToolbar(toolbar, rect, wrapRect);
    }
    const replaceButton = overlay.querySelector('[data-cd-tool="replace"]');
    const aiButton = overlay.querySelector('[data-cd-tool="ai-image"]');
    const isImage = (target.tagName || '').toLowerCase() === 'img';
    if (replaceButton) replaceButton.style.display = isImage ? '' : 'none';
    if (aiButton) aiButton.style.display = isImage ? '' : 'none';
  }

  function _selectInlineElement(el, options) {
    const opts = options || {};
    const doc = el?.ownerDocument;
    if (!el || !doc || el === doc.body) return;
    if (!_isSelectableEditableElement(el)) {
      el = _resolveInlineEditableTarget(el, doc);
      if (!el || el === doc.body || !_isSelectableEditableElement(el)) return;
    }
    const selector = _buildSelector(el);
    const previousSelector = _selectedElement?.selector || '';
    if (previousSelector && previousSelector !== selector) {
      _hideSelectedTextEditor();
    }
    doc.querySelectorAll('[data-cd-selected]').forEach((node) => node.removeAttribute('data-cd-selected'));
    el.setAttribute('data-cd-selected', '1');
    const isImage = (el.tagName || '').toLowerCase() === 'img';
    const text = isImage ? (el.getAttribute('alt') || '이미지').trim().slice(0, 80) : (el.textContent || '').trim().slice(0, 80);
    _selectedElement = { selector, html: el.outerHTML, text };
    _inlineEditPanelVisible = true;
    _updateInlineEditChip();
    _refreshInlineSelectionOverlay();
    if (_cdCommentMode) {
      cdOpenCommentComposerForSelection();
    } else if (opts.openPanel !== false) {
      requestAnimationFrame(() => cdOpenSelectedElementEditor({ keepSelection: true }));
    }
    if (opts.syncInput !== false) {
      const selectorInput = document.getElementById('cd-selector-input');
      if (selectorInput) selectorInput.value = selector;
    }
    if (opts.announce) {
      _addChatMessage('status', `🎯 선택됨 \`${selector.slice(-50)}\`${text ? ` — "${text}"` : ''}\n다음 채팅이 이 요소만 편집합니다`);
    }
  }

  function _cdCommentTargetFromElement(el) {
    if (!el) return null;
    const selector = _buildSelector(el);
    const elementId = String(el.getAttribute('data-makeke-id') || el.id || '').trim();
    const tag = (el.tagName || '요소').toLowerCase();
    const labelBits = [tag];
    if (elementId) labelBits.push(`#${elementId}`);
    const text = tag === 'img'
      ? String(el.getAttribute('alt') || el.getAttribute('src') || '이미지').trim()
      : String(el.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      selector,
      element_id: elementId,
      label: labelBits.join(' '),
      text: text.slice(0, 140),
    };
  }

  function _cdFindCommentElement(comment) {
    const doc = _getPreviewDoc();
    if (!doc || !comment) return null;
    if (comment.element_id) {
      try {
        const escapedId = window.CSS?.escape ? CSS.escape(comment.element_id) : String(comment.element_id).replace(/"/g, '\\"');
        const byId = doc.querySelector(`[data-makeke-id="${escapedId}"]`) || doc.getElementById(comment.element_id);
        if (byId) return byId;
      } catch (_) {}
    }
    if (comment.selector) {
      try { return doc.querySelector(comment.selector); } catch (_) {}
    }
    return null;
  }

  function _cdOpenCommentsPanel() {
    const panel = document.getElementById('cd-comments-panel');
    if (panel) panel.style.display = 'block';
  }

  function _cdSetCommentModeButton() {
    const btn = document.getElementById('cd-comment-mode-btn');
    if (!btn) return;
    const openCount = (_cdComments || []).filter(c => (c.status || 'open') !== 'resolved').length;
    btn.textContent = _cdCommentMode ? `주석 ON · ${openCount}` : `주석 ${openCount}`;
    btn.style.background = _cdCommentMode ? 'rgba(0,122,255,0.10)' : '#fff';
    btn.style.color = _cdCommentMode ? '#005ecb' : '#007aff';
    btn.style.borderColor = _cdCommentMode ? 'rgba(0,122,255,0.34)' : 'rgba(0,122,255,0.20)';
  }

  function _cdRenderCommentsPanel() {
    _cdSetCommentModeButton();
    const panel = document.getElementById('cd-comments-panel');
    const targetBox = document.getElementById('cd-comment-target');
    const list = document.getElementById('cd-comments-list');
    if (!panel || !targetBox || !list) return;
    panel.style.display = _cdCommentMode ? 'block' : 'none';
    if (_cdCommentDraftTarget) {
      targetBox.style.display = 'block';
      targetBox.innerHTML = `
        <div style="font-size:10px;font-weight:950;color:#007aff;">선택 대상</div>
        <div title="${_esc(_cdCommentDraftTarget.selector || '')}" style="margin-top:3px;font-size:11px;font-weight:900;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(_cdCommentDraftTarget.label || _cdCommentDraftTarget.selector || '선택 요소')}</div>
        ${_cdCommentDraftTarget.text ? `<div style="margin-top:3px;font-size:10px;line-height:1.45;color:rgba(0,0,0,0.52);">${_esc(_cdCommentDraftTarget.text)}</div>` : ''}
        <textarea id="cd-comment-note-input" rows="3" placeholder="이 요소에 남길 피드백" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();cdSaveCommentDraft();}" style="margin-top:7px;width:100%;min-height:60px;resize:vertical;border:1px solid rgba(0,122,255,0.18);border-radius:10px;padding:8px 9px;font-size:12px;line-height:1.45;box-sizing:border-box;outline:none;background:#fff;color:#1c1c1e;"></textarea>
        <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:7px;">
          <button type="button" onclick="cdCancelCommentDraft()" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:rgba(0,0,0,0.62);border-radius:9px;padding:6px 9px;font-size:11px;font-weight:800;cursor:pointer;">취소</button>
          <button type="button" onclick="cdSaveCommentDraft()" style="border:0;background:linear-gradient(135deg,#007aff,#005ecb);color:#fff;border-radius:9px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">저장</button>
        </div>
      `;
      requestAnimationFrame(() => targetBox.querySelector('#cd-comment-note-input')?.focus());
    } else {
      targetBox.style.display = 'none';
      targetBox.innerHTML = '';
    }
    const comments = Array.isArray(_cdComments) ? _cdComments : [];
    if (!comments.length) {
      list.innerHTML = `<div style="padding:10px 6px;font-size:11px;line-height:1.55;color:rgba(0,0,0,0.48);">주석 모드를 켠 뒤 미리보기 요소를 클릭하면 피드백을 남길 수 있습니다.</div>`;
      return;
    }
    list.innerHTML = comments.map(comment => {
      const resolved = comment.status === 'resolved';
      return `
        <div style="display:grid;gap:6px;padding:9px;border:1px solid ${resolved ? 'rgba(0,0,0,0.08)' : 'rgba(0,122,255,0.16)'};border-radius:10px;background:${resolved ? 'rgba(0,0,0,0.025)' : 'rgba(0,122,255,0.035)'};opacity:${resolved ? '0.68' : '1'};">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <button type="button" onclick="cdFocusCommentTarget('${_esc(comment.id)}')" title="${_esc(comment.selector || '')}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;padding:0;text-align:left;font-size:11px;font-weight:950;color:#1c1c1e;cursor:pointer;">${_esc(comment.label || comment.selector || '요소')}</button>
            <span style="font-size:9px;font-weight:900;color:${resolved ? 'rgba(0,0,0,0.42)' : '#007aff'};">${resolved ? '해결' : '열림'}</span>
          </div>
          ${comment.text ? `<div style="font-size:10px;color:rgba(0,0,0,0.46);line-height:1.4;">${_esc(comment.text)}</div>` : ''}
          <div style="font-size:12px;color:#1c1c1e;line-height:1.45;white-space:pre-wrap;">${_esc(comment.note || '')}</div>
          <div style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap;">
            <button type="button" onclick="cdRunCommentAIEdit('${_esc(comment.id)}')" style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#d85c00;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;cursor:pointer;">AI 반영</button>
            <button type="button" onclick="cdToggleCommentResolved('${_esc(comment.id)}')" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:rgba(0,0,0,0.62);border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer;">${resolved ? '다시 열기' : '해결'}</button>
            <button type="button" onclick="cdDeleteComment('${_esc(comment.id)}')" style="border:0;background:rgba(255,59,48,0.08);color:#ff3b30;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;cursor:pointer;">삭제</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function _cdApplyCommentMarkers() {
    const doc = _getPreviewDoc();
    if (!doc?.head || !doc.body) return;
    let style = doc.getElementById('cd-comment-css');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'cd-comment-css';
      style.textContent = `
        [data-cd-commented="1"] { outline: 2px solid #007aff !important; outline-offset: 3px; }
        [data-cd-commented="1"]::after { content: ""; }
      `;
      doc.head.appendChild(style);
    }
    doc.querySelectorAll('[data-cd-commented],[data-cd-comment-prev-title]').forEach(el => {
      const previousTitle = el.getAttribute('data-cd-comment-prev-title');
      if (previousTitle === CD_COMMENT_EMPTY_TITLE) el.removeAttribute('title');
      else if (previousTitle) el.setAttribute('title', previousTitle);
      el.removeAttribute('data-cd-commented');
      el.removeAttribute('data-cd-comment-prev-title');
    });
    (_cdComments || []).filter(c => (c.status || 'open') !== 'resolved').forEach(comment => {
      const el = _cdFindCommentElement(comment);
      if (el) {
        el.setAttribute('data-cd-comment-prev-title', el.getAttribute('title') || CD_COMMENT_EMPTY_TITLE);
        el.setAttribute('data-cd-commented', '1');
        el.setAttribute('title', comment.note || comment.label || '디자인 주석');
      }
    });
  }

  async function _cdEnsureSavedForComments() {
    if (_currentDesignId) return true;
    if (typeof window._cdPersistHistory === 'function') {
      const saved = await window._cdPersistHistory(true);
      if (!saved && !_currentDesignId) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (!_currentDesignId) await window._cdPersistHistory(true);
      }
    } else if (typeof cdSave === 'function') {
      await cdSave();
    }
    return !!_currentDesignId;
  }

  async function _cdPersistComments() {
    if (!_currentDesignId) return false;
    const res = await fetch(`/api/claude-design/comments/${encodeURIComponent(_currentDesignId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: _cdComments || [] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status !== 'ok') {
      throw new Error(data.error || '주석 저장 실패');
    }
    _cdComments = Array.isArray(data.comments) ? data.comments : _cdComments;
    return true;
  }

  async function cdLoadCommentsForCurrentDesign(commentsFromMeta) {
    if (Array.isArray(commentsFromMeta)) {
      _cdComments = commentsFromMeta;
      _cdRenderCommentsPanel();
      _cdApplyCommentMarkers();
      return;
    }
    if (!_currentDesignId) {
      _cdComments = [];
      _cdRenderCommentsPanel();
      _cdApplyCommentMarkers();
      return;
    }
    try {
      const res = await fetch(`/api/claude-design/comments/${encodeURIComponent(_currentDesignId)}`);
      const data = await res.json();
      _cdComments = Array.isArray(data.comments) ? data.comments : [];
    } catch (_) {
      _cdComments = [];
    }
    _cdRenderCommentsPanel();
    _cdApplyCommentMarkers();
  }
  window.cdLoadCommentsForCurrentDesign = cdLoadCommentsForCurrentDesign;

  function cdToggleCommentMode(force) {
    _cdCommentMode = typeof force === 'boolean' ? force : !_cdCommentMode;
    if (_cdCommentMode) {
      _inlineEditEnabled = true;
      _cdOpenCommentsPanel();
      if (typeof toast === 'function') toast('주석 모드: 미리보기에서 피드백을 남길 요소를 클릭하세요.');
    } else {
      _cdCommentDraftTarget = null;
    }
    _updateInlineEditButton();
    _cdRenderCommentsPanel();
  }
  window.cdToggleCommentMode = cdToggleCommentMode;

  function cdOpenCommentComposerForSelection() {
    const target = _getSelectedPreviewElement();
    const snapshot = _cdCommentTargetFromElement(target);
    if (!snapshot) return;
    _cdCommentDraftTarget = snapshot;
    _cdOpenCommentsPanel();
    _cdRenderCommentsPanel();
  }
  window.cdOpenCommentComposerForSelection = cdOpenCommentComposerForSelection;

  function cdCancelCommentDraft() {
    _cdCommentDraftTarget = null;
    _cdRenderCommentsPanel();
  }
  window.cdCancelCommentDraft = cdCancelCommentDraft;

  async function cdSaveCommentDraft() {
    const note = String(document.getElementById('cd-comment-note-input')?.value || '').trim();
    if (!note) {
      if (typeof toast === 'function') toast('주석 내용을 입력해주세요.', 'warning');
      return;
    }
    try {
      const saved = await _cdEnsureSavedForComments();
      if (!saved) throw new Error('디자인 저장이 필요합니다');
      const now = new Date().toISOString();
      _cdComments = Array.isArray(_cdComments) ? _cdComments : [];
      _cdComments.unshift({
        id: `cd-comment-${Date.now()}`,
        ..._cdCommentDraftTarget,
        note,
        status: 'open',
        created_at: now,
        updated_at: now,
      });
      _cdCommentDraftTarget = null;
      await _cdPersistComments();
      _cdRenderCommentsPanel();
      _cdApplyCommentMarkers();
      if (typeof toast === 'function') toast('주석을 저장했습니다.');
    } catch (e) {
      if (typeof toast === 'function') toast('주석 저장 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdSaveCommentDraft = cdSaveCommentDraft;

  function cdFocusCommentTarget(id) {
    const comment = (_cdComments || []).find(item => item.id === id);
    const el = _cdFindCommentElement(comment);
    if (!el) {
      if (typeof toast === 'function') toast('주석 대상 요소를 찾지 못했습니다.', 'warning');
      return;
    }
    _selectInlineElement(el, { announce: false, openPanel: false });
    el.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
  }
  window.cdFocusCommentTarget = cdFocusCommentTarget;

  async function cdToggleCommentResolved(id) {
    const comment = (_cdComments || []).find(item => item.id === id);
    if (!comment) return;
    comment.status = comment.status === 'resolved' ? 'open' : 'resolved';
    comment.updated_at = new Date().toISOString();
    try {
      await _cdPersistComments();
      _cdRenderCommentsPanel();
      _cdApplyCommentMarkers();
    } catch (e) {
      if (typeof toast === 'function') toast('주석 상태 저장 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdToggleCommentResolved = cdToggleCommentResolved;

  async function cdDeleteComment(id) {
    _cdComments = (_cdComments || []).filter(item => item.id !== id);
    try {
      await _cdPersistComments();
      _cdRenderCommentsPanel();
      _cdApplyCommentMarkers();
    } catch (e) {
      if (typeof toast === 'function') toast('주석 삭제 실패: ' + (e?.message || e), 'error');
    }
  }
  window.cdDeleteComment = cdDeleteComment;

  function cdRunCommentAIEdit(id) {
    const comment = (_cdComments || []).find(item => item.id === id);
    if (!comment?.note) return;
    const el = _cdFindCommentElement(comment);
    if (el) _selectInlineElement(el, { announce: false, openPanel: false });
    if (typeof cdRunSelectedAIEdit === 'function' && el) {
      cdRunSelectedAIEdit(comment.note);
    } else {
      const input = document.getElementById('cd-input');
      if (input) {
        input.value = comment.note;
        input.focus();
      }
      if (typeof toast === 'function') toast('주석 내용을 채팅 입력창에 넣었습니다.');
    }
  }
  window.cdRunCommentAIEdit = cdRunCommentAIEdit;

  function _startInlineTextEdit(el) {
    if (!_isTextEditableElement(el)) return;
    const doc = el.ownerDocument;
    if (!doc) return;
    _pushCdEditHistory('텍스트 편집');
    _inlineEditPanelVisible = true;
    _selectInlineElement(el, { announce: false, openPanel: false });
    const previousEditable = el.getAttribute('contenteditable');
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'false');
    el.dataset.cdEditing = '1';
    el.focus();
    const selection = doc.defaultView?.getSelection?.();
    const range = doc.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const finish = () => {
      if (!el.isConnected) return;
      delete el.dataset.cdEditing;
      if (previousEditable === null) el.removeAttribute('contenteditable');
      else el.setAttribute('contenteditable', previousEditable);
      if (el._cdInlineInputHandler) {
        el.removeEventListener('input', el._cdInlineInputHandler);
        el._cdInlineInputHandler = null;
      }
      if (el._cdInlineKeyHandler) {
        el.removeEventListener('keydown', el._cdInlineKeyHandler);
        el._cdInlineKeyHandler = null;
      }
      if (el._cdInlineBlurHandler) {
        el.removeEventListener('blur', el._cdInlineBlurHandler);
        el._cdInlineBlurHandler = null;
      }
      _syncPreviewHtml(doc);
      _inlineEditPanelVisible = false;
      _selectInlineElement(el, { announce: false });
    };

    const keyHandler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) cdRedoInlineEdit();
        else cdUndoInlineEdit();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        el.blur();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        finish();
        el.blur();
      }
    };

    if (el._cdInlineInputHandler) el.removeEventListener('input', el._cdInlineInputHandler);
    if (el._cdInlineKeyHandler) el.removeEventListener('keydown', el._cdInlineKeyHandler);
    if (el._cdInlineBlurHandler) el.removeEventListener('blur', el._cdInlineBlurHandler);

    el._cdInlineKeyHandler = keyHandler;
    el._cdInlineBlurHandler = finish;
    el._cdInlineInputHandler = () => {
      _selectedElement = {
        selector: _buildSelector(el),
        html: el.outerHTML,
        text: (el.textContent || '').trim().slice(0, 80),
      };
      _updateInlineEditChip();
      _syncPreviewHtml(doc);
      _refreshInlineSelectionOverlay();
    };
    el.addEventListener('keydown', el._cdInlineKeyHandler);
    el.addEventListener('blur', el._cdInlineBlurHandler);
    el.addEventListener('input', el._cdInlineInputHandler);
  }

  function _deleteSelectedElement() {
    const target = _getSelectedPreviewElement();
    const doc = _getPreviewDoc();
    if (!target || !doc || target === doc.body) return false;
    const nextTarget = target.previousElementSibling || target.nextElementSibling || target.parentElement;
    _pushCdEditHistory('삭제');
    target.remove();
    _syncPreviewHtml(doc);
    if (nextTarget && nextTarget !== doc.body) {
      _selectInlineElement(nextTarget, { announce: false });
    } else {
      cdClearSelection();
    }
    _refreshInlineSelectionOverlay();
    return true;
  }

  // ─── 미리보기 확대(전체화면) 토글 ───────────────────────────
  function cdTogglePreviewFullscreen() {
    const card = document.getElementById('cd-preview-wrap')?.closest('.card');
    if (!card) return;
    _previewFullscreen = !_previewFullscreen;
    if (_previewFullscreen) {
      card.style.cssText = 'position:fixed;inset:20px;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,0.4);background:#fff;border-radius:16px;display:flex;flex-direction:column;';
      // 다시 cdSetPreviewSize 트리거해서 재계산
      requestAnimationFrame(() => requestAnimationFrame(() => cdSetPreviewSize()));
    } else {
      // 원복
      card.style.cssText = 'padding:0;display:flex;flex-direction:column;overflow:hidden;min-width:0;order:2;';
      requestAnimationFrame(() => requestAnimationFrame(() => cdSetPreviewSize()));
    }
  }
  window.cdTogglePreviewFullscreen = cdTogglePreviewFullscreen;

  // ─── B. 반응형 프리뷰 ────────────────────────────────────────
  function cdSetDevice(width) {
    const iframe = document.getElementById('cd-preview');
    if (!iframe) return;
    // width 가 'auto' 면 비율 모드로 복귀
    if (width === 'auto') { cdSetPreviewSize('m'); return; }
    iframe.style.width = width + 'px';
    iframe.style.height = '85vh';
    document.querySelectorAll('#cd-device-group [data-device]').forEach(b => {
      const active = b.getAttribute('data-device') === String(width);
      b.style.background = active ? '#fff' : 'transparent';
      b.style.color = active ? '#1c1c1e' : 'rgba(0,0,0,0.5)';
      b.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
    });
  }
  window.cdSetDevice = cdSetDevice;

  // ─── D. 이미지 → 컬러 팔레트 추출 ────────────────────────────
  async function _extractPaletteFromDataUrl(dataUrl, k = 5) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const W = 80, H = Math.max(1, Math.round(80 * img.height / img.width));
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        // 양자화: 6단계 분할 (216 색)
        const counts = {};
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 128) continue;
          const r = Math.round(px[i] / 51) * 51;
          const g = Math.round(px[i + 1] / 51) * 51;
          const b = Math.round(px[i + 2] / 51) * 51;
          // 거의 흰/검은 제외
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 240 || lum < 20) continue;
          const key = `${r},${g},${b}`;
          counts[key] = (counts[key] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, k);
        const hex = sorted.map(([key]) => {
          const [r, g, b] = key.split(',').map(Number);
          return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        });
        resolve(hex);
      };
      img.onerror = () => resolve([]);
      img.src = dataUrl;
    });
  }

  async function cdExtractPaletteFromAttachments() {
    if (_attachedImages.length === 0) {
      if (typeof toast === 'function') toast('첨부 이미지가 없습니다');
      return;
    }
    const all = await Promise.all(_attachedImages.map(im => _extractPaletteFromDataUrl(im.dataUrl, 5)));
    const merged = [...new Set(all.flat())].slice(0, 6);
    if (!merged.length) {
      if (typeof toast === 'function') toast('팔레트를 추출하지 못했습니다');
      return;
    }
    const colorEl = document.getElementById('cd-colors');
    if (colorEl) colorEl.value = merged.join(', ');
    // 칩 표시
    _showPaletteChips(merged);
    if (typeof toast === 'function') toast(`팔레트 ${merged.length}색 추출됨`);
    // 채팅 기록
    const dots = merged.map(c => `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,0.1);margin-right:3px;vertical-align:middle;"></span>`).join('');
    _addChatMessage('status', `🎨 첨부 이미지에서 팔레트 ${merged.length}색 자동 적용 ${dots}`, { html: true });
  }
  window.cdExtractPaletteFromAttachments = cdExtractPaletteFromAttachments;

  function _showPaletteChips(colors) {
    const wrap = document.getElementById('cd-palette-chips');
    if (!wrap) return;
    if (!colors || !colors.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = colors.map(c => `
      <div title="${c} (클릭하면 복사)" onclick="navigator.clipboard.writeText('${c}');toast&&toast('${c} 복사됨')" style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:999px;cursor:pointer;font-size:9px;font-weight:700;">
        <span style="width:10px;height:10px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,0.1);"></span><span style="color:rgba(0,0,0,0.6);">${c}</span>
      </div>`).join('');
  }

  // ─── 파일 첨부 (md/txt/csv/xlsx/pptx/pdf/docx/json/html) ──────
  function cdAttachFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.csv,.json,.html,.htm,.xlsx,.xls,.pptx,.pdf,.docx,.doc,.hwp';
    input.multiple = true;
    input.onchange = async () => {
      for (const file of input.files) {
        const name = file.name;
        const ext = name.split('.').pop().toLowerCase();
        let text = '';
        try {
          if (['txt', 'md', 'csv', 'json', 'html', 'htm'].includes(ext)) {
            text = await file.text();
          } else {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/ce2/parse-file', { method: 'POST', body: fd });
            const data = await res.json();
            text = data?.text || data?.content || '';
          }
          if (!text || text.length < 10) {
            _addChatMessage('error', `📄 ${name} — 텍스트를 추출할 수 없습니다.`);
            continue;
          }
          _attachedSources.push({
            title: name,
            url: '',
            snippet: text.slice(0, 10000),
            type: ext.toUpperCase(),
          });
          _addChatMessage('status', `📄 ${name} 첨부됨 (${(text.length/1000).toFixed(1)}K자)`);
        } catch (e) {
          _addChatMessage('error', `📄 ${name} 실패: ${e?.message || e}`);
        }
      }
      _renderSourceChips();
    };
    input.click();
  }
  window.cdAttachFile = cdAttachFile;

  // ─── 자료 첨부 (뉴스/블로그) ─────────────────────────────────
  async function cdSearchSources() {
    const kw = (document.getElementById('cd-source-kw')?.value || '').trim();
    if (!kw) { if (typeof toast === 'function') toast('키워드를 입력하세요', 'warning'); return; }
    const list = document.getElementById('cd-source-results');
    _cdRenderSourceSelectionTools();
    if (list) list.innerHTML = '<div style="padding:18px;font-size:13px;color:rgba(0,0,0,0.52);">자료를 검색하고 있습니다... 보통 10~30초 정도 걸립니다.</div>';
    try {
      const res = await fetch('/api/sources/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw }),
      });
      const data = await res.json();
      const blocks = data?.data || {};
      const flat = [];
      const directSources = Array.isArray(blocks.sources) ? blocks.sources : [];
      directSources.slice(0, 12).forEach(it => flat.push({
        title: it.title || it.snippet || it.url || it.link || '',
        url: it.url || it.link || '',
        snippet: (it.summary || it.content || it.description || it.snippet || '').slice(0, 420),
        images: _sourceImageUrls(it),
        type: it.type || '자료',
      }));
      ['news', 'blog', 'youtube'].forEach(t => {
        const arr = blocks[t] || blocks[t + '_articles'] || [];
        arr.slice(0, 5).forEach(it => flat.push({
          title: it.title || it.snippet || it.url || '',
          url: it.url || it.link || '',
          snippet: (it.summary || it.content || it.description || '').slice(0, 420),
          images: _sourceImageUrls(it),
          type: t,
        }));
      });
      if (!flat.length) {
        const message = blocks.message || data?.message || '검색 결과 없음';
        list.innerHTML = `<div style="padding:18px;font-size:13px;line-height:1.6;color:rgba(255,59,48,0.72);">${_esc(message)}</div>`;
        _cdRenderSourceSelectionTools();
        return;
      }
      list.innerHTML = flat.map((s, i) => `
        <label style="display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;padding:12px 14px;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer;background:#fff;">
          <input type="checkbox" value="${i}" data-source-idx="${i}" onchange="cdUpdateSourceSelectionState()" style="margin-top:3px;width:17px;height:17px;accent-color:#34c759;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;">
              <span style="padding:2px 7px;border-radius:999px;background:rgba(0,122,255,0.08);color:#0066cc;font-size:10px;font-weight:900;">${_esc(s.type || '자료')}</span>
              ${s.url ? `<span style="font-size:11px;color:rgba(0,0,0,0.38);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px;">${_esc(s.url)}</span>` : ''}
            </div>
            <div style="font-size:14px;font-weight:850;color:#1c1c1e;line-height:1.45;white-space:normal;overflow-wrap:anywhere;">${_esc(s.title || '제목 없는 자료')}</div>
            <div style="margin-top:5px;font-size:12px;color:rgba(0,0,0,0.58);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${_esc((s.snippet || '').slice(0, 180))}</div>
          </div>
        </label>`).join('');
      list._sources = flat;
      _cdRenderSourceSelectionTools();
    } catch (e) {
      list.innerHTML = `<div style="padding:18px;color:#ff3b30;font-size:13px;">실패: ${_esc(e?.message || e)}</div>`;
      _cdRenderSourceSelectionTools();
    }
  }
  window.cdSearchSources = cdSearchSources;

  function _cdSourceSelectionElements() {
    const list = document.getElementById('cd-source-results');
    const inputs = list ? Array.from(list.querySelectorAll('input[data-source-idx]')) : [];
    return { list, inputs };
  }

  function _cdRenderSourceSelectionTools() {
    const tools = document.getElementById('cd-source-selection-tools');
    const count = document.getElementById('cd-source-selection-count');
    const attachButton = document.getElementById('cd-source-attach-btn');
    const { inputs } = _cdSourceSelectionElements();
    const selectedCount = inputs.filter(input => input.checked).length;
    if (tools) tools.style.display = inputs.length ? 'flex' : 'none';
    if (count) count.textContent = inputs.length ? `${selectedCount}개 선택 · 결과 ${inputs.length}건` : '0개 선택';
    if (attachButton) {
      attachButton.textContent = selectedCount ? `선택 ${selectedCount}개 첨부` : '선택 첨부';
      attachButton.disabled = !selectedCount;
      attachButton.style.opacity = selectedCount ? '1' : '0.55';
    }
  }

  function cdUpdateSourceSelectionState() {
    _cdRenderSourceSelectionTools();
  }
  window.cdUpdateSourceSelectionState = cdUpdateSourceSelectionState;

  function cdSetAllSourceResults(checked) {
    const { inputs } = _cdSourceSelectionElements();
    inputs.forEach(input => { input.checked = !!checked; });
    _cdRenderSourceSelectionTools();
  }
  window.cdSetAllSourceResults = cdSetAllSourceResults;

  async function cdAttachSelectedSources() {
    const list = document.getElementById('cd-source-results');
    if (!list || !list._sources) return;
    const checked = Array.from(list.querySelectorAll('input[data-source-idx]:checked'))
      .map(el => list._sources[parseInt(el.dataset.sourceIdx)])
      .filter(Boolean);
    if (!checked.length) { if (typeof toast === 'function') toast('선택된 자료가 없습니다'); return; }
    const attachButton = document.getElementById('cd-source-attach-btn');
    const originalButtonText = attachButton?.textContent || '';
    if (attachButton) {
      attachButton.disabled = true;
      attachButton.textContent = '이미지 수집...';
    }
    _addChatMessage('status', `📰 자료 ${checked.length}건을 첨부하면서 이미지도 같이 수집합니다...`);
    const enriched = [];
    let imageTotal = 0;
    try {
      for (const source of checked) {
        const hydrated = await _hydrateSourceWithScrapedImages(source);
        enriched.push(hydrated);
        imageTotal += await _attachImagesFromSource(hydrated, '검색 자료 이미지');
      }
    } finally {
      if (attachButton) {
        attachButton.disabled = false;
        attachButton.textContent = originalButtonText || '＋ 첨부';
      }
    }
    _attachedSources = _attachedSources.concat(enriched);
    _renderSourceChips();
    cdToggleSourcePanel();
    _returnToChatAfterSourceAttach();
    if (typeof toast === 'function') toast(`자료 ${enriched.length}건 · 이미지 ${imageTotal}장 첨부됨`);
    const titles = enriched.map(s => `• [${s.type}] ${(s.title || '').slice(0, 50)}`).join('\n');
    _addChatMessage('status', `📰 자료 ${enriched.length}건 첨부 · 이미지 ${imageTotal}장 자동 첨부\n${titles}`);
  }
  window.cdAttachSelectedSources = cdAttachSelectedSources;

  async function _hydrateSourceWithScrapedImages(source) {
    const base = { ...(source || {}) };
    if (_sourceImageUrls(base).length > 0 || !base.url || !window._VAGSource?.scrapeArticle) {
      return base;
    }
    try {
      const res = await window._VAGSource.scrapeArticle(base.url, {
        title: base.title || '',
        minLength: 20,
      });
      if (!res?.ok) return base;
      const scrapedImages = res.images || res.image_urls || res.imageUrls || res.scrapedImages || res.media || res.metadata?.images || [];
      return {
        ...base,
        title: res.title || base.title,
        snippet: res.text || base.snippet || base.summary || '',
        images: scrapedImages,
        image: res.image || res.image_url || res.imageUrl || res.thumbnail || res.og_image || res.ogImage || res.metadata?.image || res.metadata?.og_image || base.image,
        resolved_url: res.url || res.final_url || base.url,
      };
    } catch (e) {
      console.warn('[claude-design] source image scrape failed', e);
      return base;
    }
  }

  function _cdSourceModalState() {
    window.__cdSourcePanelHome = window.__cdSourcePanelHome || {};
    return window.__cdSourcePanelHome;
  }

  function _cdRestoreSourcePanel(panel) {
    const state = _cdSourceModalState();
    if (!panel || !state.parent) return;
    if (state.next && state.next.parentNode === state.parent) {
      state.parent.insertBefore(panel, state.next);
    } else {
      state.parent.appendChild(panel);
    }
  }

  function cdCloseSourcePanel() {
    const p = document.getElementById('cd-source-panel');
    const overlay = document.getElementById('cd-source-modal-overlay');
    if (p) {
      _cdRestoreSourcePanel(p);
      p.style.display = 'none';
      p.style.width = '100%';
      p.style.maxHeight = '220px';
      p.style.overflowY = 'auto';
      p.style.boxShadow = 'none';
    }
    overlay?.remove();
  }
  window.cdCloseSourcePanel = cdCloseSourcePanel;

  function cdToggleSourcePanel() {
    const p = document.getElementById('cd-source-panel');
    if (!p) return;
    const overlay = document.getElementById('cd-source-modal-overlay');
    if (overlay || p.style.display === 'block') {
      cdCloseSourcePanel();
      return;
    }
    const state = _cdSourceModalState();
    state.parent = p.parentNode;
    state.next = p.nextSibling;
    const modal = document.createElement('div');
    modal.id = 'cd-source-modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.38);backdrop-filter:blur(10px);';
    modal.innerHTML = '<div id="cd-source-modal-card" role="dialog" aria-modal="true" aria-label="자료 첨부" style="width:min(860px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 40px));display:flex;flex-direction:column;border-radius:22px;background:#fff;box-shadow:0 30px 100px rgba(0,0,0,0.28);overflow:hidden;"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg,#fff7ee 0%,#fff 100%);"><div><div style="font-size:16px;font-weight:950;color:#1c1c1e;">자료 첨부</div><div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:3px;">키워드, URL, 파일, 직접 입력 자료를 디자인 생성에 연결합니다.</div></div><button type="button" onclick="cdCloseSourcePanel()" aria-label="닫기" style="width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,0.05);font-size:18px;font-weight:800;cursor:pointer;color:#1c1c1e;">×</button></div><div id="cd-source-modal-body" style="padding:16px;overflow:auto;min-height:0;"></div></div>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal) cdCloseSourcePanel();
    });
    document.body.appendChild(modal);
    const body = document.getElementById('cd-source-modal-body');
    body?.appendChild(p);
    p.style.display = 'block';
    p.style.width = '100%';
    p.style.maxHeight = 'none';
    p.style.overflowY = 'visible';
    p.style.boxShadow = 'none';
    cdSetSourceMode('direct');
    _cdRenderSourceSelectionTools();
    setTimeout(() => document.getElementById('cd-source-direct-text')?.focus(), 0);
  }
  window.cdToggleSourcePanel = cdToggleSourcePanel;

  function cdSetSourceMode(mode) {
    const nextMode = ['search', 'url', 'direct'].includes(mode) ? mode : 'search';
    ['search', 'url', 'direct'].forEach((name) => {
      const pane = document.getElementById(`cd-source-pane-${name}`);
      const button = document.getElementById(`cd-source-mode-${name}`);
      const active = name === nextMode;
      if (pane) pane.style.display = active ? '' : 'none';
      if (button) {
        button.style.background = active ? '#007aff' : 'rgba(0,0,0,0.06)';
        button.style.color = active ? '#fff' : '#1c1c1e';
      }
    });
    const focusTarget = nextMode === 'url'
      ? document.getElementById('cd-source-url')
      : nextMode === 'direct'
        ? document.getElementById('cd-source-direct-text')
        : document.getElementById('cd-source-kw');
    focusTarget?.focus?.();
  }
  window.cdSetSourceMode = cdSetSourceMode;

  function _setSourceStatus(id, message, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.style.color = tone === 'error' ? '#ff3b30' : tone === 'success' ? '#34c759' : 'rgba(0,0,0,0.6)';
    el.textContent = message || '';
  }

  function _normalizeSourceUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(value)) return 'https://' + value;
    return value;
  }

  function _isSourceHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function _returnToChatAfterSourceAttach() {
    cdCloseSourcePanel();
    const input = document.getElementById('cd-input');
    if (!input) return;
    input.focus();
    input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function _attachSourceItem(source) {
    const title = String(source?.title || source?.url || '자료').trim();
    const snippet = String(source?.snippet || source?.text || '').trim();
    if (!snippet) return false;
    _attachedSources.push({
      title,
      url: String(source?.url || ''),
      snippet: snippet.slice(0, 12000),
      type: String(source?.type || 'URL'),
    });
    _renderSourceChips();
    return true;
  }

  function _sourceImageUrls(source) {
    const urls = [];
    const push = (value) => {
      const url = String(value || '').trim();
      if (/^https?:\/\//i.test(url) || url.startsWith('/api/')) urls.push(url);
    };
    const pushMany = (values) => {
      if (!Array.isArray(values)) return;
      values.forEach((value) => {
        if (typeof value === 'string') {
          push(value);
        } else if (value && typeof value === 'object') {
          [
            value.url,
            value.src,
            value.href,
            value.image,
            value.image_url,
            value.thumbnail,
            value.thumbnail_url,
          ].forEach(push);
        }
      });
    };
    [
      source?.image,
      source?.image_url,
      source?.imageUrl,
      source?.thumbnail,
      source?.thumbnail_url,
      source?.thumbnailUrl,
      source?.og_image,
      source?.ogImage,
      source?.cover,
      source?.poster,
      source?.lead_image,
      source?.leadImage,
      source?.metadata?.image,
      source?.metadata?.og_image,
      source?.metadata?.ogImage,
    ].forEach(push);
    pushMany(source?.images);
    pushMany(source?.image_urls);
    pushMany(source?.imageUrls);
    pushMany(source?.scrapedImages);
    pushMany(source?.media);
    pushMany(source?.metadata?.images);
    return Array.from(new Set(urls)).slice(0, 8);
  }

  async function _attachImagesFromSource(source, sourceLabel) {
    const urls = _sourceImageUrls(source);
    if (!urls.length || typeof cdAttachReferenceImageUrls !== 'function') return 0;
    const added = await cdAttachReferenceImageUrls(urls, sourceLabel || '수집 이미지');
    if (added) _addChatMessage('status', `🖼 ${sourceLabel || '수집'} ${added}장 참고 이미지로 첨부됨`);
    return added;
  }

  async function cdImportSourceUrl() {
    const input = document.getElementById('cd-source-url');
    const preview = document.getElementById('cd-source-url-preview');
    const url = _normalizeSourceUrl(input?.value || '');
    if (!url) {
      if (typeof toast === 'function') toast('URL을 입력하세요', 'warning');
      return;
    }
    if (!_isSourceHttpUrl(url)) {
      _setSourceStatus('cd-source-url-status', 'https:// 로 시작하는 URL을 입력하세요.', 'error');
      return;
    }
    if (input) input.value = url;
    if (!window._VAGSource?.scrapeArticle) {
      _setSourceStatus('cd-source-url-status', '공용 URL 수집 모듈을 찾지 못했습니다.', 'error');
      return;
    }
    const button = document.querySelector('#cd-source-pane-url button[onclick="cdImportSourceUrl()"]');
    const originalButtonText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = '가져오는 중...';
    }
    _setSourceStatus('cd-source-url-status', 'URL 본문을 수집하는 중입니다...', '');
    if (preview) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
    try {
      const res = await window._VAGSource.scrapeArticle(url, {
        minLength: 50,
        maxAttempts: 1,
        timeoutMs: 45000,
        electronTimeoutMs: 18000,
        onStage: (stage) => {
          const label = stage?.label || stage?.key || '수집';
          _setSourceStatus('cd-source-url-status', `${label} 진행 중...`, '');
        },
      });
      if (!res?.ok) {
        _setSourceStatus('cd-source-url-status', res?.error || 'URL 수집에 실패했습니다.', 'error');
        return;
      }
      const title = res.title || url;
      const text = res.text || '';
      const source = {
        title,
        url,
        snippet: text,
        images: res.images || res.image_urls || res.imageUrls || res.scrapedImages || res.media || res.metadata?.images || [],
        image: res.image || res.image_url || res.imageUrl || res.thumbnail || res.og_image || res.ogImage || res.metadata?.image || res.metadata?.og_image,
        type: res.method || 'URL',
      };
      _attachSourceItem(source);
      const imageCount = await _attachImagesFromSource(source, 'URL 수집 이미지');
      _setSourceStatus('cd-source-url-status', `자료로 첨부했습니다: ${title}`, 'success');
      if (preview) {
        preview.style.display = 'block';
        preview.innerHTML = `
          <div style="font-size:11px;font-weight:800;color:#1c1c1e;margin-bottom:4px;">${_esc(title)}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.55);line-height:1.55;max-height:96px;overflow:auto;">${_esc(text.slice(0, 500))}</div>
          ${imageCount ? `<div style="margin-top:6px;font-size:10px;font-weight:800;color:#007aff;">이미지 ${imageCount}장도 참고 이미지로 추가됨</div>` : ''}
        `;
      }
      _addChatMessage('status', `🔗 URL 자료 첨부됨\n${title}${imageCount ? `\n🖼 이미지 ${imageCount}장 함께 첨부` : ''}`);
      _returnToChatAfterSourceAttach();
      if (typeof toast === 'function') toast('URL 자료를 첨부했습니다');
    } catch (e) {
      _setSourceStatus('cd-source-url-status', 'URL 수집 실패: ' + (e?.message || e), 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalButtonText || '가져오기';
      }
    }
  }
  window.cdImportSourceUrl = cdImportSourceUrl;

  async function cdHandleSourceFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    _setSourceStatus('cd-source-direct-status', `파일 ${files.length}개를 읽는 중입니다...`, '');
    let added = 0;
    for (const file of files) {
      try {
        let text = '';
        if (window._VAGSource?.parseDocument) {
          const parsed = await window._VAGSource.parseDocument(file, { timeoutMs: 90000 });
          if (!parsed?.ok) throw new Error(parsed?.error || '문서 파싱 실패');
          text = parsed.text || '';
        } else {
          text = await file.text();
        }
        if (_attachSourceItem({ title: file.name, snippet: text, type: 'FILE' })) added += 1;
      } catch (e) {
        _addChatMessage('error', `📄 ${file.name} 실패: ${e?.message || e}`);
      }
    }
    _setSourceStatus('cd-source-direct-status', added ? `파일 자료 ${added}건을 첨부했습니다.` : '첨부할 수 있는 텍스트를 찾지 못했습니다.', added ? 'success' : 'error');
    if (added) {
      _addChatMessage('status', `📄 파일 자료 ${added}건 첨부됨`);
      _returnToChatAfterSourceAttach();
    }
  }
  window.cdHandleSourceFiles = cdHandleSourceFiles;

  async function cdLoadSourceFilePath() {
    const path = (document.getElementById('cd-source-file-path')?.value || '').trim();
    if (!path) {
      if (typeof toast === 'function') toast('파일 경로를 입력하세요', 'warning');
      return;
    }
    const maybeUrl = _normalizeSourceUrl(path);
    if (_isSourceHttpUrl(maybeUrl)) {
      const urlInput = document.getElementById('cd-source-url');
      if (urlInput) urlInput.value = maybeUrl;
      cdSetSourceMode('url');
      await cdImportSourceUrl();
      return;
    }
    _setSourceStatus('cd-source-direct-status', '브라우저 보안상 파일 경로 직접 읽기는 지원하지 않습니다. 위 업로드 영역으로 파일을 끌어오세요.', 'error');
  }
  window.cdLoadSourceFilePath = cdLoadSourceFilePath;

  function cdAttachDirectSource() {
    const title = (document.getElementById('cd-source-direct-title')?.value || '직접 입력 자료').trim();
    const text = (document.getElementById('cd-source-direct-text')?.value || '').trim();
    if (!text) {
      if (typeof toast === 'function') toast('첨부할 텍스트를 입력하세요', 'warning');
      return;
    }
    _attachSourceItem({ title, snippet: text, type: 'TEXT' });
    _setSourceStatus('cd-source-direct-status', '직접 입력 자료를 첨부했습니다.', 'success');
    _addChatMessage('status', `📝 직접 입력 자료 첨부됨\n${title}`);
    _returnToChatAfterSourceAttach();
  }
  window.cdAttachDirectSource = cdAttachDirectSource;

  function _renderSourceChips() {
    const wrap = document.getElementById('cd-source-chips');
    if (!wrap) return;
    if (_attachedSources.length === 0) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = _attachedSources.map((s, i) => `
      <div title="${_esc(s.title)}" style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.25);color:#0066cc;border-radius:999px;font-size:10px;font-weight:700;">
        <span>📄</span><span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(s.title.slice(0, 30))}</span>
        <button type="button" onclick="cdRemoveSource(${i})" style="border:0;background:transparent;color:#0066cc;cursor:pointer;font-size:10px;padding:0 2px;">×</button>
      </div>`).join('');
  }
  function cdRemoveSource(i) {
    _attachedSources.splice(i, 1);
    _renderSourceChips();
  }
  window.cdRemoveSource = cdRemoveSource;

  // ─── C. 인라인 요소 편집 ────────────────────────────────────
  // iframe 내부 모든 요소에 hover/click 핸들러 부착 → 클릭하면 선택자 추출
  function _bindInlineEdit() {
    const iframe = document.getElementById('cd-preview');
    try {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      if (window._cdDesignBusy) return;
      // 활성화 토글이 OFF 면 skip
      if (!_inlineEditEnabled) return;
      // 기존 스타일 제거 후 재주입
      const old = doc.getElementById('cd-inline-edit-css');
      if (old) old.remove();
      const style = doc.createElement('style');
      style.id = 'cd-inline-edit-css';
      style.textContent = `
        [data-cd-hover] { outline: 2px dashed #ff8c00 !important; outline-offset: 2px; cursor: pointer; }
        [data-cd-selected] { outline: 3px solid #ff8c00 !important; outline-offset: 2px; cursor: move; }
        [data-cd-editing="1"] { cursor: text !important; user-select: text !important; }
      `;
      doc.head.appendChild(style);
      if (doc.body.__cdInlineBoundRuntime === true) {
        _bindPreviewScrollTracking(doc);
        _refreshInlineSelectionOverlay();
        return;
      }
      doc.body.__cdInlineBoundRuntime = true;
      doc.body.dataset.cdInlineBound = '1';
      _bindPreviewScrollTracking(doc);
      // 호버 표시
      doc.body.addEventListener('mouseover', (e) => {
        if (!_inlineEditEnabled) return;
        const t = e.target;
        if (t === doc.body || t === doc.documentElement) {
          doc.querySelectorAll('[data-cd-hover]').forEach(el => el.removeAttribute('data-cd-hover'));
          return;
        }
        doc.querySelectorAll('[data-cd-hover]').forEach(el => el.removeAttribute('data-cd-hover'));
        t.setAttribute('data-cd-hover', '1');
      });
      doc.body.addEventListener('mousedown', (e) => {
        if (!_inlineEditEnabled || e.button !== 0) return;
        if (!CD_INLINE_DRAG_ENABLED) return;
        if (_isInlineEditingTarget(e.target)) return;
        if (e.target?.closest?.('input, textarea, select, option, label, [contenteditable="true"]')) return;
        const t = _resolveInlineEditableTarget(e.target, doc);
        if (!t) return;
        _inlinePointerState = {
          target: t,
          startX: e.clientX,
          startY: e.clientY,
          started: false,
        };
      }, true);
      doc.body.addEventListener('mousemove', (e) => {
        if (!CD_INLINE_DRAG_ENABLED) return;
        if (!_inlinePointerState?.target?.isConnected) return;
        const dx = e.clientX - _inlinePointerState.startX;
        const dy = e.clientY - _inlinePointerState.startY;
        const movedEnough = Math.hypot(dx, dy) >= CD_DRAG_THRESHOLD;
        if (!_inlinePointerState.started && movedEnough) {
          e.preventDefault();
          e.stopPropagation();
          _inlinePointerState.started = true;
          _selectInlineElement(_inlinePointerState.target, { announce: false });
          _beginInlineDrag(_inlinePointerState.target, e, {
            x: _inlinePointerState.startX,
            y: _inlinePointerState.startY,
          });
        }
        if (_inlinePointerState.started) {
          e.preventDefault();
          e.stopPropagation();
          _moveInlineDrag(e);
        }
      }, true);
      doc.body.addEventListener('mouseup', (e) => {
        if (_inlinePointerState?.started) {
          e.preventDefault();
          e.stopPropagation();
          _finishInlineDrag();
        }
        _inlinePointerState = null;
      }, true);
      doc.body.addEventListener('click', (e) => {
        if (!_inlineEditEnabled) return;
        if (_isInlineEditingTarget(e.target)) return;
        if (e.target?.closest?.('input, textarea, select, option, label')) return;
        if (Date.now() < _cdSuppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const rawTarget = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
        const rawTag = (rawTarget?.tagName || '').toLowerCase();
        if (!rawTarget || rawTarget === doc.body || rawTarget === doc.documentElement || rawTag === 'html' || rawTag === 'body' || rawTarget.id === 'cd-preview-slide-stage') {
          cdClearSelection();
          return;
        }
        const t = _resolveInlineEditableTarget(e.target, doc);
        if (!t) {
          cdClearSelection();
          return;
        }
        if (_selectedElement?.selector === _buildSelector(t) && _isTextEditableElement(t)) {
          _selectInlineElement(t, { announce: false });
          return;
        }
        _selectInlineElement(t, { announce: true });
      }, true);
      doc.body.addEventListener('dblclick', (e) => {
        if (!_inlineEditEnabled) return;
        const t = _resolveInlineEditableTarget(e.target, doc);
        if (!t) {
          cdClearSelection();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if ((t.tagName || '').toLowerCase() === 'img') {
          _selectInlineElement(t, { announce: false });
          cdReplaceSelectedImage();
          return;
        }
        _selectInlineElement(t, { announce: false });
        if (_isTextEditableElement(t)) {
          cdEditSelectedText();
          return;
        }
        if (typeof toast === 'function') toast('선택했습니다. 채팅창의 수정 버튼으로 편집할 수 있습니다.');
      }, true);
    } catch (_) {}
  }

  function _bindPreviewScrollTracking(doc) {
    if (!doc?.body || doc.body.dataset.cdSelectionScrollBound === '1') return;
    doc.body.dataset.cdSelectionScrollBound = '1';
    const refresh = () => _scheduleInlineSelectionSurfaceRefresh();
    doc.addEventListener('scroll', refresh, { passive: true, capture: true });
    doc.defaultView?.addEventListener?.('scroll', refresh, { passive: true });
    doc.defaultView?.addEventListener?.('resize', refresh, { passive: true });
    doc.body.addEventListener('wheel', refresh, { passive: true });
    doc.body.addEventListener('touchmove', refresh, { passive: true });
  }

  function _buildSelector(el) {
    if (!el) return '';
    const makekeId = el.getAttribute?.('data-makeke-id');
    if (makekeId) return `[data-makeke-id="${_cssAttrValue(makekeId)}"]`;
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 5) {
      let s = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) s += '.' + cls.join('.');
      }
      const par = cur.parentElement;
      if (par) {
        const sib = Array.from(par.children).filter(c => c.tagName === cur.tagName);
        if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(cur) + 1})`;
      }
      parts.unshift(s);
      if (cur.id) break;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function _cssAttrValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function _updateInlineEditButton() {
    const btn = document.getElementById('cd-inline-edit-btn');
    if (!btn) return;
    btn.style.background = _inlineEditEnabled ? '#ff8c00' : '#fff';
    btn.style.color = _inlineEditEnabled ? '#fff' : 'rgba(0,0,0,0.7)';
    btn.textContent = _inlineEditEnabled ? '🖱 인터랙티브 ON' : '🖱 인터랙티브';
  }
  function cdToggleInlineEdit() {
    _inlineEditEnabled = !_inlineEditEnabled;
    _updateInlineEditButton();
    _bindInlineEdit();
    if (_inlineEditEnabled) {
      _addChatMessage('status', '🖱 인터랙티브 모드 ON — 미리보기에서 요소를 클릭해 부분 편집');
    } else {
      try {
        const doc = document.getElementById('cd-preview')?.contentDocument;
        if (doc) {
          doc.querySelectorAll('[data-cd-hover]').forEach(el => el.removeAttribute('data-cd-hover'));
          doc.querySelectorAll('[data-cd-selected]').forEach(el => el.removeAttribute('data-cd-selected'));
        }
      } catch (_) {}
      _inlineEditPanelVisible = false;
      _selectedElement = null;
      _hideSelectedTextEditor();
      _updateInlineEditChip();
      _addChatMessage('status', '🖱 인터랙티브 모드 OFF');
    }
  }
  window.cdToggleInlineEdit = cdToggleInlineEdit;

  function _updateInlineEditChip() {
    const chip = _getSelectionChipElement();
    if (!chip) return;
    const selectorRow = document.getElementById('cd-selector-row');
    if (!_inlineEditEnabled || !_inlineEditPanelVisible || !_selectedElement) {
      chip.style.display = 'none';
      chip.innerHTML = '';
      if (selectorRow) selectorRow.style.display = 'none';
      _hideSelectedTextEditor();
      _hideInlineSelectionOverlay();
      _setSelectedChatPlaceholder();
      return;
    }
    chip.style.display = 'none';
    if (selectorRow) selectorRow.style.display = 'none';
    chip.innerHTML = `
      <span style="font-weight:900;color:#ff8c00;">선택</span>
      <input type="text" value="${_esc(_selectedElement.selector)}" readonly onclick="this.select()" title="${_esc(_selectedElement.selector)}" style="flex:1 1 130px;min-width:0;height:24px;padding:0 8px;border:1px solid rgba(88,86,214,0.18);border-radius:8px;background:rgba(88,86,214,0.05);color:#5856d6;font-size:10px;font-weight:800;outline:none;">
      ${_selectedElement.text ? `<span title="${_esc(_selectedElement.text)}" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.6;">"${_esc(_selectedElement.text)}"</span>` : ''}
      <button type="button" onclick="cdEditSelectedText()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;cursor:pointer;padding:3px 12px;font-size:11px;font-weight:900;">수정</button>
      <button type="button" onclick="cdReplaceSelectedImage()" data-cd-chip-image-action style="display:none;border:0;background:rgba(0,122,255,0.10);color:#007aff;border-radius:999px;cursor:pointer;padding:2px 8px;font-size:11px;font-weight:700;">이미지 교체</button>
      <button type="button" onclick="cdAIReplaceSelectedImage().catch(e=>toast&&toast('AI 이미지 교체 실패: '+(e.message||e),'error'))" data-cd-chip-image-action style="display:none;border:0;background:rgba(255,140,0,0.12);color:#ff8c00;border-radius:999px;cursor:pointer;padding:2px 8px;font-size:11px;font-weight:700;">AI 교체</button>
      <button type="button" onclick="cdDeleteSelectedElement()" style="border:0;background:rgba(255,59,48,0.10);color:#ff3b30;border-radius:999px;cursor:pointer;padding:2px 8px;font-size:11px;font-weight:700;">삭제</button>
      <button type="button" onclick="cdClearSelection()" style="border:0;background:transparent;color:inherit;cursor:pointer;padding:0 2px;font-size:11px;">×</button>
    `;
    const target = _getSelectedPreviewElement();
    chip.querySelectorAll('[data-cd-chip-image-action]').forEach(btn => {
      btn.style.display = (target && (target.tagName || '').toLowerCase() === 'img') ? '' : 'none';
    });
    _positionSelectionChipByChat();
    _refreshInlineSelectionOverlay();
    _setSelectedChatPlaceholder();
  }

  function cdFocusSelectedChatEdit() {
    const input = document.getElementById('cd-input');
    if (!input) return;
    _setSelectedChatPlaceholder();
    input.focus();
    input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (typeof toast === 'function') toast('채팅에 수정 지시를 쓰면 선택한 요소만 우선 수정합니다.');
  }
  window.cdFocusSelectedChatEdit = cdFocusSelectedChatEdit;

  function cdSendSelectedAIEdit() {
    const panel = document.getElementById('cd-selected-text-editor');
    const request = (panel?.querySelector('#cd-selected-ai-request')?.value || '').trim();
    if (!request) {
      if (typeof toast === 'function') toast('AI에게 맡길 수정 내용을 입력해주세요.', 'warning');
      return;
    }
    if (typeof cdRunSelectedAIEdit === 'function') {
      cdRunSelectedAIEdit(request);
    } else if (typeof toast === 'function') {
      toast('AI 수정 함수를 찾지 못했습니다.', 'error');
    }
  }
  window.cdSendSelectedAIEdit = cdSendSelectedAIEdit;

  function _bindSelectedTextEditorDrag(panel) {
    const handle = panel?.querySelector('[data-cd-edit-drag-handle]');
    if (!panel || !handle || handle.dataset.bound) return;
    handle.dataset.bound = '1';
    handle.style.cursor = 'grab';
    handle.title = '잡고 끌어서 수정창을 이동합니다.';
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.('button,input,textarea,select,label')) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;
      panel.dataset.cdManualPosition = '1';
      panel.style.visibility = 'visible';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      handle.style.cursor = 'grabbing';
      try { handle.setPointerCapture(event.pointerId); } catch (_) {}

      const movePanel = (moveEvent) => {
        const nextLeft = startLeft + (moveEvent.clientX - startX);
        const nextTop = startTop + (moveEvent.clientY - startY);
        panel.style.left = `${Math.round(nextLeft)}px`;
        panel.style.top = `${Math.round(nextTop)}px`;
        _fitSelectedTextEditorPanelToViewport(panel);
      };
      const stopDrag = () => {
        handle.style.cursor = 'grab';
        try { handle.releasePointerCapture(event.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', movePanel, true);
        window.removeEventListener('pointerup', stopDrag, true);
        window.removeEventListener('pointercancel', stopDrag, true);
      };
      window.addEventListener('pointermove', movePanel, true);
      window.addEventListener('pointerup', stopDrag, true);
      window.addEventListener('pointercancel', stopDrag, true);
    });
  }

  function cdClearSelection() {
    _inlineEditPanelVisible = false;
    _selectedElement = null;
    _hideSelectedTextEditor();
    _updateInlineEditChip();
    try {
      const doc = document.getElementById('cd-preview')?.contentDocument;
      doc?.querySelectorAll('[data-cd-selected]').forEach(el => el.removeAttribute('data-cd-selected'));
    } catch (_) {}
    const selectorInput = document.getElementById('cd-selector-input');
    if (selectorInput) selectorInput.value = '';
    _hideInlineSelectionOverlay();
  }
  window.cdClearSelection = cdClearSelection;

  function _clearSelectionForScreenChange() {
    if (!_selectedElement && !document.getElementById('cd-selected-text-editor')) return;
    cdClearSelection();
  }

  function cdClearDesignSelectionForNavigation() {
    cdClearSelection();
  }
  window.cdClearDesignSelectionForNavigation = cdClearDesignSelectionForNavigation;

  function cdApplySelectorInput() {
    const selector = (document.getElementById('cd-selector-input')?.value || '').trim();
    const doc = _getPreviewDoc();
    if (!selector || !doc) return;
    try {
      const target = doc.querySelector(selector);
      if (!target) {
        if (typeof toast === 'function') toast('해당 selector 요소를 찾지 못했습니다.', 'error');
        return;
      }
      _selectInlineElement(target, { announce: true, syncInput: false });
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (error) {
      if (typeof toast === 'function') toast('selector 문법이 올바르지 않습니다.', 'error');
    }
  }
  window.cdApplySelectorInput = cdApplySelectorInput;

  function cdEditSelectedText(options) {
    const target = _getSelectedPreviewElement();
    if (!target) return;
    if (!_isTextEditableElement(target)) {
      cdOpenSelectedElementEditor(options);
      return;
    }
    _inlineEditPanelVisible = true;
    if (!options?.keepSelection) _selectInlineElement(target, { announce: false, openPanel: false });
    _hideSelectedTextEditor();
    const computed = target.ownerDocument?.defaultView?.getComputedStyle(target);
    const fontSize = Math.round(_parsePx(computed?.fontSize, 16));
    const color = computed?.color || '#1c1c1e';
    const bg = computed?.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.backgroundColor : '';
    const align = computed?.textAlign || 'left';
    const colorHex = _colorToPickerValue(color, '#1c1c1e');
    const bgHex = _colorToPickerValue(bg, '#ffffff');
    const editableText = String(target.textContent || '').trim();
    _pushCdEditHistory('텍스트 실시간 편집');
    const panel = document.createElement('div');
    panel.id = 'cd-selected-text-editor';
    panel.style.cssText = 'position:fixed;left:24px;top:24px;z-index:10020;width:min(400px,calc(100vw - 32px));display:grid;gap:8px;padding:10px;border:1px solid rgba(255,140,0,0.22);border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(0,0,0,0.18);box-sizing:border-box;visibility:hidden;';
    panel.innerHTML = `
      <div data-cd-edit-drag-handle style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:grab;user-select:none;">
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:950;color:#1c1c1e;">선택 요소 수정</div>
          <div title="${_esc(_selectedElement?.selector || '')}" style="margin-top:3px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;color:#5856d6;">${_esc(_selectedElement?.selector || '')}</div>
        </div>
        <button type="button" onclick="cdCancelSelectedTextEdit()" title="닫기" style="border:0;background:rgba(0,0,0,0.06);color:rgba(0,0,0,0.62);border-radius:999px;width:24px;height:24px;font-size:13px;font-weight:900;cursor:pointer;">×</button>
      </div>
      <div style="display:grid;gap:5px;padding:8px;border:1px solid rgba(255,140,0,0.16);border-radius:11px;background:rgba(255,140,0,0.045);">
        <div style="font-size:10px;font-weight:950;color:#ff6b00;">AI 수정</div>
        <textarea id="cd-selected-ai-request" rows="2" placeholder="예: 제목을 더 짧게, CTA를 더 크게" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();cdSendSelectedAIEdit();}" style="width:100%;min-height:40px;resize:vertical;border:1px solid rgba(255,140,0,0.16);border-radius:9px;padding:7px 8px;font-size:12px;line-height:1.4;outline:none;box-sizing:border-box;background:#fff;color:#1c1c1e;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:6px;">
          <button type="button" data-cd-selected-ai-send onclick="cdSendSelectedAIEdit()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;">AI로 수정</button>
        </div>
      </div>
      <label style="display:flex;flex-direction:column;gap:5px;min-width:0;font-size:10px;font-weight:900;color:rgba(0,0,0,0.58);">
        직접 수정 <span style="font-weight:700;color:rgba(0,0,0,0.36);">입력하면 바로 미리보기에 반영됩니다</span>
        <textarea id="cd-selected-textarea" rows="4" oninput="cdLiveSelectedTextEdit()" onblur="this.value=this.value.trim();cdLiveSelectedTextEdit()" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();event.shiftKey?cdRedoInlineEdit():cdUndoInlineEdit();}else if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();cdApplySelectedTextEdit();}" style="width:100%;min-height:86px;resize:vertical;border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:9px 10px;font-size:13px;line-height:1.45;outline:none;box-sizing:border-box;background:#f8f8fa;color:#1c1c1e;">${_esc(editableText)}</textarea>
      </label>
      <div style="display:grid;grid-template-columns:82px 1fr 1fr;gap:8px;align-items:start;">
        <label style="display:grid;gap:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);">크기
          <input id="cd-selected-font-size" type="number" min="8" max="160" value="${fontSize}" oninput="cdSetSelectedFontSize(this.value,{live:true})" style="min-width:0;padding:7px 8px;border:1px solid rgba(0,0,0,0.10);border-radius:9px;font-size:12px;outline:none;">
        </label>
        <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);">글자색
          <span style="display:grid;grid-template-columns:34px 1fr;gap:5px;">
            <input id="cd-selected-color-picker" type="color" value="${_esc(colorHex)}" oninput="cdSetSelectedColor(this.value,{live:true});document.getElementById('cd-selected-color-text').value=this.value" title="글자색 선택" style="width:34px;height:30px;padding:0;border:1px solid rgba(0,0,0,0.10);border-radius:9px;background:#fff;cursor:pointer;">
            <input id="cd-selected-color-text" type="text" value="${_esc(colorHex)}" oninput="cdSetSelectedColor(this.value,{live:true})" style="min-width:0;padding:7px 8px;border:1px solid rgba(0,0,0,0.10);border-radius:9px;font-size:12px;outline:none;">
          </span>
        </label>
        <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);">배경
          <span style="display:grid;grid-template-columns:34px 1fr auto;gap:5px;">
            <input id="cd-selected-bg-picker" type="color" value="${_esc(bgHex)}" oninput="cdSetSelectedBackground(this.value,{live:true});document.getElementById('cd-selected-bg-text').value=this.value" title="배경색 선택" style="width:34px;height:30px;padding:0;border:1px solid rgba(0,0,0,0.10);border-radius:9px;background:#fff;cursor:pointer;">
            <input id="cd-selected-bg-text" type="text" value="${_esc(bg ? bgHex : '')}" oninput="cdSetSelectedBackground(this.value,{live:true})" placeholder="transparent" style="min-width:0;padding:7px 8px;border:1px solid rgba(0,0,0,0.10);border-radius:9px;font-size:12px;outline:none;">
            <button type="button" onclick="document.getElementById('cd-selected-bg-text').value='';cdSetSelectedBackground('',{live:true})" title="배경 제거" style="border:1px solid rgba(0,0,0,0.10);background:#fff;border-radius:9px;padding:0 8px;font-size:11px;font-weight:900;cursor:pointer;">없음</button>
          </span>
        </label>
      </div>
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);margin-right:2px;">빠른색</span>
          ${['#1c1c1e', '#6b7280', '#ffffff', '#ff8c00', '#007aff', '#34c759', '#ff3b30'].map(c => `<button type="button" onclick="cdSetSelectedColor('${c}',{live:true});document.getElementById('cd-selected-color-picker').value='${c}';document.getElementById('cd-selected-color-text').value='${c}'" title="글자색 ${c}" style="width:24px;height:24px;border:1px solid rgba(0,0,0,0.14);background:${c};border-radius:999px;cursor:pointer;"></button>`).join('')}
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);margin-right:2px;">배경색</span>
          ${['#ffffff', '#f3f4f6', '#fff7ed', '#ffedd5', '#dbeafe', '#dcfce7', '#fee2e2'].map(c => `<button type="button" onclick="cdSetSelectedBackground('${c}',{live:true});document.getElementById('cd-selected-bg-picker').value='${c}';document.getElementById('cd-selected-bg-text').value='${c}'" title="배경색 ${c}" style="width:24px;height:24px;border:1px solid rgba(0,0,0,0.14);background:${c};border-radius:999px;cursor:pointer;"></button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);margin-right:2px;">정렬</span>
        <button type="button" data-cd-align="left" onclick="cdSetSelectedAlign('left',{live:true})" title="왼쪽 정렬" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">왼쪽</button>
        <button type="button" data-cd-align="center" onclick="cdSetSelectedAlign('center',{live:true})" title="가운데 정렬" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">가운데</button>
        <button type="button" data-cd-align="right" onclick="cdSetSelectedAlign('right',{live:true})" title="오른쪽 정렬" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">오른쪽</button>
      </div>
      <div style="position:sticky;bottom:-14px;z-index:1;display:flex;gap:6px;align-items:center;justify-content:space-between;margin:0 -10px -10px;padding:8px 10px 10px;background:linear-gradient(180deg,rgba(255,255,255,0.88),#fff 38%);border-top:1px solid rgba(0,0,0,0.06);border-radius:0 0 14px 14px;">
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
          <button type="button" onclick="cdAdjustSelectedFont(-2)" style="border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">A-</button>
          <button type="button" onclick="cdAdjustSelectedFont(2)" style="border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">A+</button>
          <button type="button" onclick="cdToggleSelectedBold()" style="border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">굵게</button>
          <button type="button" onclick="cdDeleteSelectedElement();cdCancelSelectedTextEdit();" style="border:0;background:rgba(255,59,48,0.10);color:#ff3b30;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;">삭제</button>
        </div>
        <div style="display:flex;gap:5px;align-items:center;">
          <button type="button" onclick="cdApplySelectedTextEdit()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:10px;padding:8px 13px;font-size:11px;font-weight:900;cursor:pointer;">완료</button>
          <button type="button" onclick="cdCancelSelectedTextEdit()" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:rgba(0,0,0,0.62);border-radius:10px;padding:7px 11px;font-size:11px;font-weight:800;cursor:pointer;">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    _placeSelectedTextEditorPanel(panel, target);
    _bindSelectedTextEditorDrag(panel);
    _syncSelectedTextEditorControls();
    const textarea = panel.querySelector('#cd-selected-textarea');
    textarea?.focus();
    textarea?.select();
  }
  window.cdEditSelectedText = cdEditSelectedText;

  function cdOpenSelectedElementEditor(options) {
    const target = _getSelectedPreviewElement();
    if (!target) return;
    if (_isTextEditableElement(target)) {
      cdEditSelectedText(options);
      return;
    }
    _inlineEditPanelVisible = true;
    if (!options?.keepSelection) _selectInlineElement(target, { announce: false, openPanel: false });
    _hideSelectedTextEditor();
    const computed = target.ownerDocument?.defaultView?.getComputedStyle(target);
    const bg = computed?.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.backgroundColor : '';
    const bgHex = _colorToPickerValue(bg, '#ffffff');
    const isImage = (target.tagName || '').toLowerCase() === 'img';
    const selector = _selectedElement?.selector || _buildSelector(target);
    const panel = document.createElement('div');
    panel.id = 'cd-selected-text-editor';
    panel.style.cssText = 'position:fixed;left:24px;top:24px;z-index:10020;width:min(380px,calc(100vw - 32px));display:grid;gap:8px;padding:10px;border:1px solid rgba(255,140,0,0.22);border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(0,0,0,0.18);box-sizing:border-box;visibility:hidden;';
    panel.innerHTML = `
      <div data-cd-edit-drag-handle style="display:flex;align-items:center;justify-content:space-between;gap:10px;user-select:none;">
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:950;color:#1c1c1e;">선택 요소 수정</div>
          <div title="${_esc(selector)}" style="margin-top:3px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:800;color:#5856d6;">${_esc(selector)}</div>
        </div>
        <button type="button" onclick="cdCancelSelectedTextEdit()" title="닫기" style="border:0;background:rgba(0,0,0,0.06);color:rgba(0,0,0,0.62);border-radius:999px;width:24px;height:24px;font-size:13px;font-weight:900;cursor:pointer;">×</button>
      </div>
      <div style="display:grid;gap:5px;padding:8px;border:1px solid rgba(255,140,0,0.16);border-radius:11px;background:rgba(255,140,0,0.045);">
        <div style="font-size:10px;font-weight:950;color:#ff6b00;">AI 수정</div>
        <textarea id="cd-selected-ai-request" rows="2" placeholder="예: 이 카드 배경을 더 밝게, 여백을 넓게, CTA 느낌으로" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();cdSendSelectedAIEdit();}" style="width:100%;min-height:42px;resize:vertical;border:1px solid rgba(255,140,0,0.16);border-radius:9px;padding:7px 8px;font-size:12px;line-height:1.4;outline:none;box-sizing:border-box;background:#fff;color:#1c1c1e;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:6px;">
          <button type="button" data-cd-selected-ai-send onclick="cdSendSelectedAIEdit()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;cursor:pointer;">AI로 수정</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end;">
        <label style="display:grid;gap:5px;font-size:10px;font-weight:900;color:rgba(0,0,0,0.50);">배경
          <span style="display:grid;grid-template-columns:34px 1fr;gap:5px;">
            <input id="cd-selected-bg-picker" type="color" value="${_esc(bgHex)}" oninput="cdSetSelectedBackground(this.value,{live:true});document.getElementById('cd-selected-bg-text').value=this.value" style="width:34px;height:30px;padding:0;border:1px solid rgba(0,0,0,0.10);border-radius:9px;background:#fff;cursor:pointer;">
            <input id="cd-selected-bg-text" type="text" value="${_esc(bg ? bgHex : '')}" oninput="cdSetSelectedBackground(this.value,{live:true})" placeholder="transparent" style="min-width:0;padding:7px 8px;border:1px solid rgba(0,0,0,0.10);border-radius:9px;font-size:12px;outline:none;">
          </span>
        </label>
        <button type="button" onclick="document.getElementById('cd-selected-bg-text').value='';cdSetSelectedBackground('',{live:true})" style="height:30px;border:1px solid rgba(0,0,0,0.10);background:#fff;border-radius:9px;padding:0 9px;font-size:11px;font-weight:900;cursor:pointer;">배경 없음</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <button type="button" onclick="cdDuplicateSelectedElement()" style="border:1px solid rgba(88,86,214,0.18);background:rgba(88,86,214,0.08);color:#5856d6;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">복제</button>
        <button type="button" onclick="cdBringSelectedForward()" style="border:1px solid rgba(0,122,255,0.18);background:rgba(0,122,255,0.08);color:#007aff;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">앞으로</button>
        <button type="button" onclick="cdSendSelectedBackward()" style="border:1px solid rgba(0,122,255,0.18);background:#fff;color:#007aff;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">뒤로</button>
        ${isImage ? `<button type="button" onclick="cdReplaceSelectedImage()" style="border:1px solid rgba(0,122,255,0.18);background:#fff;color:#007aff;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">이미지 교체</button>` : ''}
        ${isImage ? `<button type="button" onclick="cdAIReplaceSelectedImage().catch(e=>toast&&toast('AI 이미지 교체 실패: '+(e.message||e),'error'))" style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.08);color:#ff8c00;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">AI 교체</button>` : ''}
        <button type="button" onclick="cdDeleteSelectedElement()" style="margin-left:auto;border:1px solid rgba(255,59,48,0.18);background:rgba(255,59,48,0.08);color:#ff3b30;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;cursor:pointer;">삭제</button>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:6px;">
        <button type="button" onclick="cdApplySelectedTextEdit()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;padding:7px 13px;font-size:11px;font-weight:900;cursor:pointer;">완료</button>
      </div>
    `;
    document.body.appendChild(panel);
    _bindSelectedTextEditorDrag(panel);
    requestAnimationFrame(() => {
      _positionSelectedTextEditor(panel);
      panel.style.visibility = 'visible';
      _syncSelectedTextEditorControls();
    });
  }
  window.cdOpenSelectedElementEditor = cdOpenSelectedElementEditor;

  function cdLiveSelectedTextEdit() {
    const target = _getSelectedPreviewElement();
    const panel = document.getElementById('cd-selected-text-editor');
    const textarea = panel?.querySelector('#cd-selected-textarea');
    if (!target || !panel || !textarea) return;
    const liveText = String(textarea.value || '').replace(/^\s+/, '');
    if (textarea.value !== liveText) textarea.value = liveText;
    target.textContent = liveText;
    const fontSize = panel.querySelector('#cd-selected-font-size')?.value;
    const color = (panel.querySelector('#cd-selected-color-text')?.value || panel.querySelector('#cd-selected-color-picker')?.value || '').trim();
    const bg = (panel.querySelector('#cd-selected-bg-text')?.value || '').trim();
    if (fontSize) target.style.fontSize = `${Math.max(8, Math.min(160, parseInt(fontSize, 10) || 16))}px`;
    if (color) target.style.color = color;
    target.style.background = bg || 'transparent';
    target.style.lineHeight = target.style.lineHeight || '1.12';
    _syncPreviewHtml(target.ownerDocument);
    _selectedElement = {
      selector: _buildSelector(target),
      html: target.outerHTML,
      text: (target.textContent || '').trim().slice(0, 80),
    };
    _updateInlineEditChip();
    _refreshInlineSelectionOverlay();
  }
  window.cdLiveSelectedTextEdit = cdLiveSelectedTextEdit;

  function cdCancelSelectedTextEdit() {
    _hideSelectedTextEditor();
  }
  window.cdCancelSelectedTextEdit = cdCancelSelectedTextEdit;

  function cdApplySelectedTextEdit() {
    const target = _getSelectedPreviewElement();
    const panel = document.getElementById('cd-selected-text-editor');
    const textarea = panel?.querySelector('#cd-selected-textarea');
    if (!target || !textarea) return;
    const appliedText = String(textarea.value || '').trim();
    textarea.value = appliedText;
    target.textContent = appliedText;
    const fontSize = panel.querySelector('#cd-selected-font-size')?.value;
    const color = (panel.querySelector('#cd-selected-color-text')?.value || panel.querySelector('#cd-selected-color-picker')?.value || '').trim();
    const bg = (panel.querySelector('#cd-selected-bg-text')?.value || '').trim();
    if (fontSize) target.style.fontSize = `${Math.max(8, Math.min(160, parseInt(fontSize, 10) || 16))}px`;
    if (color) target.style.color = color;
    target.style.background = bg || 'transparent';
    target.style.lineHeight = target.style.lineHeight || '1.12';
    target.removeAttribute('contenteditable');
    target.removeAttribute('spellcheck');
    delete target.dataset.cdEditing;
    _syncPreviewHtml(target.ownerDocument);
    _selectedElement = {
      selector: _buildSelector(target),
      html: target.outerHTML,
      text: (target.textContent || '').trim().slice(0, 80),
    };
    _hideSelectedTextEditor();
    _selectInlineElement(target, { announce: false });
    _refreshInlineSelectionOverlay();
    if (typeof toast === 'function') toast('텍스트를 수정했습니다.');
  }
  window.cdApplySelectedTextEdit = cdApplySelectedTextEdit;

  function cdDeleteSelectedElement() {
    if (_deleteSelectedElement() && typeof toast === 'function') {
      toast('선택 요소를 삭제했습니다.');
    }
  }
  window.cdDeleteSelectedElement = cdDeleteSelectedElement;

  // ─── 미리보기 렌더 / 슬라이드 검출 ──────────────────────────
  function _renderPreview(html) {
    const iframe = document.getElementById('cd-preview');
    if (!iframe) return;
    _clearSelectionForScreenChange();
    document.getElementById('page-claude-design')?.classList.add('cd-has-preview');
    // 빈 상태 카드 숨기고 iframe 노출
    const empty = document.getElementById('cd-empty-state');
    if (empty) empty.style.display = 'none';
    iframe.style.display = '';
    // 메타 핀 표시
    const metaPill = document.getElementById('cd-meta-pill');
    if (metaPill && _lastMeta) {
      const parts = [];
      if (_lastMeta.kind) parts.push(_lastMeta.kind);
      if (_lastMeta.aspect_ratio) parts.push(_lastMeta.aspect_ratio);
      if (_lastMeta.model) parts.push(_lastMeta.model);
      if (parts.length) {
        metaPill.textContent = parts.join(' · ');
        metaPill.style.display = 'inline-block';
      }
    }
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      iframe.src = url;
      if (iframe._lastBlobUrl) { try { URL.revokeObjectURL(iframe._lastBlobUrl); } catch (_) {} }
      iframe._lastBlobUrl = url;
      // 레이아웃 안정화 후 크기 계산 (rAF 2회)
      requestAnimationFrame(() => requestAnimationFrame(() => cdSetPreviewSize('fit')));
      // iframe 로드 완료 후 슬라이드 검출 + 인라인 편집 + 재스케일
      iframe.onload = () => {
        _healBrokenPreviewImages(iframe.contentDocument);
        _repairPreviewLayoutOverflow(iframe.contentDocument);
        _runAutoDesignReview(iframe.contentDocument, { source: 'load' });
        _detectSlides();
        _inlineEditEnabled = true;
        _updateInlineEditButton();
        _bindInlineEdit();
        _cdApplyCommentMarkers();
        _cdRenderCommentsPanel();
        // 슬라이드 감지로 body overflow 가 바뀌었을 수 있으니 재계산
        requestAnimationFrame(() => cdSetPreviewSize());
        setTimeout(() => {
          _healBrokenPreviewImages(iframe.contentDocument);
          _repairPreviewLayoutOverflow(iframe.contentDocument);
          _runAutoDesignReview(iframe.contentDocument, { source: 'settled' });
          requestAnimationFrame(() => cdSetPreviewSize());
        }, 700);
      };
    } catch (e) {
      iframe.srcdoc = html;
    }
  }

  function _repairPreviewLayoutOverflow(doc) {
    if (!doc?.body) return;
    let changed = false;
    const viewportWidth = Math.max(320, doc.documentElement?.clientWidth || doc.body.clientWidth || 1200);
    const safeRight = viewportWidth - 24;
    const fixedHeightRe = /(?:^|;)\s*height\s*:\s*(\d+(?:\.\d+)?)(px|vh|vw|%)\s*/i;
    const cardLikeRe = /(card|box|panel|tile|item|stat|metric|feature|cta|button|badge|copy|text|title|headline|hero|content|section)/i;
    Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
      if (!el || el === doc.body || el === doc.documentElement) return;
      const tag = (el.tagName || '').toLowerCase();
      if (['script', 'style', 'meta', 'link', 'svg', 'path'].includes(tag)) return;
      const text = (el.textContent || '').trim();
      const hasVisual = !!el.querySelector?.('img,svg,canvas,video');
      const rect = el.getBoundingClientRect?.();
      const computed = doc.defaultView?.getComputedStyle(el);
      const hint = `${tag} ${el.id || ''} ${el.className || ''}`.toLowerCase();
      const inlineStyle = el.getAttribute('style') || '';
      const hasDirectText = Array.from(el.childNodes || []).some(node => node.nodeType === 3 && (node.textContent || '').trim());
      const isTextBox = text.length > 0 && (hasDirectText || cardLikeRe.test(hint));
      const fixedHeight = inlineStyle.match(fixedHeightRe);
      if (isTextBox && fixedHeight && !/(vh|vw|%)/i.test(fixedHeight[2] || '')) {
        el.style.minHeight = el.style.minHeight || `${Math.ceil(parseFloat(fixedHeight[1]) || 0)}px`;
        el.style.height = 'auto';
        el.style.overflow = 'visible';
        changed = true;
      }
      if (isTextBox && computed?.overflow === 'hidden') {
        el.style.overflow = 'visible';
        changed = true;
      }
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const hasClippedText = text.length > 0 && el.scrollHeight > el.clientHeight + 3;
      const hasClippedWidth = text.length > 0 && el.scrollWidth > el.clientWidth + 3;
      if (hasClippedText) {
        el.style.height = 'auto';
        el.style.minHeight = `${Math.ceil(Math.min(el.scrollHeight + 8, Math.max(rect.height, 1200)))}px`;
        el.style.overflow = 'visible';
        changed = true;
      }
      if (hasClippedWidth) {
        el.style.maxWidth = '100%';
        el.style.whiteSpace = 'normal';
        el.style.overflowWrap = 'break-word';
        el.style.wordBreak = 'keep-all';
        changed = true;
      }
      if (text.length > 0 || hasVisual) {
        el.style.boxSizing = el.style.boxSizing || 'border-box';
      }
      if (isTextBox) {
        el.style.minWidth = el.style.minWidth || '0';
        el.style.whiteSpace = el.style.whiteSpace === 'nowrap' ? 'normal' : el.style.whiteSpace;
        el.style.overflowWrap = el.style.overflowWrap || 'break-word';
        el.style.wordBreak = el.style.wordBreak || 'keep-all';
      }
      if (text.length > 16 && computed?.position === 'absolute') {
        el.style.maxWidth = el.style.maxWidth || 'calc(100% - 96px)';
        changed = true;
      }
      if (rect.right > safeRight && computed?.position === 'absolute') {
        const overflow = Math.ceil(rect.right - safeRight);
        const left = parseFloat(computed.left || '0');
        if (Number.isFinite(left)) {
          el.style.left = `${Math.max(24, left - overflow)}px`;
          el.style.maxWidth = `calc(100% - ${Math.max(48, left)}px)`;
          changed = true;
        }
      }
    });
    if (changed) _syncPreviewHtml(doc);
  }

  function _runAutoDesignReview(doc, options) {
    if (!doc?.body || typeof _addChatMessage !== 'function') return [];
    const opts = options || {};
    if (opts.source !== 'manual' && doc.body.dataset.makekeDesignReviewSeen === '1') return [];
    if (opts.source !== 'manual') doc.body.dataset.makekeDesignReviewSeen = '1';
    const issues = _collectAutoDesignIssues(doc)
      .concat(_collectDesignSourceIssues(_lastHtml))
      .concat(_collectOpenDesignCraftIssues(doc, _lastHtml));
    if (!issues.length) {
      if (opts.source === 'manual') {
        _addChatMessage('status', '✅ 디자인 검수 통과: 눈에 띄는 잘림, 엑박, 캔버스 이탈을 찾지 못했습니다.');
      }
      return issues;
    }
    const top = issues.slice(0, 6);
    const rows = top.map((issue, index) => `
      <div style="display:flex;gap:7px;align-items:flex-start;padding:7px 8px;border:1px solid rgba(255,140,0,0.14);border-radius:10px;background:rgba(255,140,0,0.04);">
        <span style="font-size:11px;font-weight:950;color:#ff6b00;">${index + 1}</span>
        <div style="min-width:0;">
          <div style="font-size:11px;font-weight:900;color:#1c1c1e;">${_esc(issue.title)}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.55);line-height:1.45;margin-top:2px;">${_esc(issue.detail)}</div>
        </div>
      </div>
    `).join('');
    _addChatMessage('ai', `
      <div style="display:grid;gap:8px;">
        <div style="font-size:12px;font-weight:950;color:#1c1c1e;">자동 디자인 검수: ${issues.length}개 점검 항목</div>
        ${rows}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">
          <button type="button" onclick="cdAutoImprove()" style="border:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:900;cursor:pointer;">자동으로 고치기</button>
          <button type="button" onclick="cdRunDesignReview()" style="border:1px solid rgba(0,0,0,0.10);background:#fff;color:#1c1c1e;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;">다시 검수</button>
        </div>
      </div>
    `, { html: true });
    return issues;
  }

  function _collectAutoDesignIssues(doc) {
    const issues = [];
    const viewportWidth = Math.max(320, doc.documentElement?.clientWidth || doc.body.clientWidth || 1200);
    const viewportHeight = Math.max(320, doc.documentElement?.clientHeight || doc.body.clientHeight || 800);
    const safeRight = viewportWidth - 8;
    const safeBottom = viewportHeight - 8;
    const seen = new Set();
    const add = (type, el, title, detail) => {
      const key = `${type}:${_buildSelector(el).slice(0, 80)}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ type, title, detail, selector: _buildSelector(el) });
    };
    Array.from(doc.body.querySelectorAll('img')).forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src || src === '#' || src.startsWith('#reference-image') || (img.complete && img.naturalWidth === 0)) {
        add('image', img, '이미지 표시 문제', `${_shortElementLabel(img)} 이미지가 비어 있거나 깨질 가능성이 있습니다.`);
      }
    });
    Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
      if (!el || el === doc.body || el === doc.documentElement) return;
      const tag = (el.tagName || '').toLowerCase();
      if (['script', 'style', 'meta', 'link', 'path'].includes(tag)) return;
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const text = (el.textContent || '').trim();
      const computed = doc.defaultView?.getComputedStyle(el);
      if (text && el.scrollHeight > el.clientHeight + 6) {
        add('clip-y', el, '텍스트 세로 잘림', `${_shortElementLabel(el)} 높이가 내용보다 작습니다.`);
      }
      if (text && el.scrollWidth > el.clientWidth + 6) {
        add('clip-x', el, '텍스트 가로 잘림', `${_shortElementLabel(el)} 긴 문장이 줄바꿈되지 않습니다.`);
      }
      if ((rect.left < -8 || rect.right > safeRight || rect.top < -8 || rect.bottom > safeBottom) && (text || tag === 'img')) {
        add('bounds', el, '캔버스 밖으로 나감', `${_shortElementLabel(el)} 요소가 안전 영역을 벗어납니다.`);
      }
      const fontSize = parseFloat(computed?.fontSize || '0');
      if (text.length > 18 && Number.isFinite(fontSize) && fontSize > 108) {
        add('type-scale', el, '글자 크기 과대', `${_shortElementLabel(el)} 텍스트가 너무 커서 겹침 위험이 큽니다.`);
      }
      if (text.length > 30 && computed?.position === 'absolute') {
        add('absolute-text', el, '절대 배치 텍스트', `${_shortElementLabel(el)} 텍스트가 absolute라 화면 크기에 취약합니다.`);
      }
    });
    return issues;
  }

  function _collectDesignSourceIssues(html) {
    const source = String(html || '');
    if (!source) return [];
    const issues = [];
    const openCount = (source.match(/<script\b[^>]*>/gi) || []).length;
    const closeCount = (source.match(/<\/script>/gi) || []).length;
    const escapedCloseCount = (source.match(/<\\\/script>/gi) || []).length;
    if (escapedCloseCount > 0) {
      issues.push({
        type: 'source-script-escape',
        title: '스크립트 닫힘 태그 이스케이프',
        detail: '<\\/script>가 실제 HTML에 남아 있으면 렌더러가 스크립트를 닫지 못합니다.',
        selector: 'html',
      });
    }
    if (openCount > closeCount) {
      issues.push({
        type: 'source-script-balance',
        title: '스크립트 블록 미종결',
        detail: `<script> ${openCount}개 열림 / ${closeCount}개 닫힘 상태라 JS 실행이 실패할 수 있습니다.`,
        selector: 'html',
      });
    }
    if (/srcdoc="[^"]*&lt;[^"]*=\s*"/i.test(source)) {
      issues.push({
        type: 'source-srcdoc-quote',
        title: 'iframe srcdoc 따옴표 깨짐',
        detail: 'srcdoc 안 원본 HTML의 따옴표가 속성을 끊어 미리보기와 렌더가 깨질 수 있습니다.',
        selector: 'iframe[srcdoc]',
      });
    }
    return issues;
  }

  function _collectOpenDesignCraftIssues(doc, html) {
    const source = String(html || doc?.documentElement?.outerHTML || '');
    if (!source) return [];
    const issues = [];
    const add = (type, title, detail, selector) => {
      if (issues.some(issue => issue.type === type)) return;
      issues.push({ type, title, detail, selector: selector || 'html' });
    };
    const defaultIndigo = ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#8b5cf6', '#7c3aed', '#a855f7'];
    const blueStops = ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#0ea5e9', '#0284c7', '#38bdf8'];
    const cyanStops = ['#06b6d4', '#0891b2', '#0e7490', '#22d3ee', '#67e8f9'];
    if (/linear-gradient\([^)]*\b(purple|violet|indigo)\b[^)]*\)/i.test(source)
      || defaultIndigo.some(hex => new RegExp(`linear-gradient\\([^)]*${_escapeRegExp(hex)}[^)]*\\)`, 'i').test(source))) {
      add('od-purple-gradient', 'Open Design P0: 보라/인디고 그라데이션', '기본 AI 느낌이 강한 purple/indigo gradient가 감지됐습니다. 단색 표면이나 브랜드 토큰으로 바꾸세요.');
    }
    const gradients = source.match(/linear-gradient\([^)]*\)/gi) || [];
    if (gradients.some(g => (/\bblue\b|\bcyan\b/i.test(g) && /\bblue\b/i.test(g) && /\bcyan\b/i.test(g))
      || (blueStops.some(hex => g.toLowerCase().includes(hex)) && cyanStops.some(hex => g.toLowerCase().includes(hex))))) {
      add('od-trust-gradient', 'Open Design P0: 파랑-시안 신뢰 그라데이션', 'blue-cyan 2색 trust gradient는 흔한 AI SaaS 패턴입니다. 더 구체적인 브랜드 표면으로 바꾸세요.');
    }
    const tokenBlocks = source.replace(/:root\s*\{[^}]*\}/gi, '');
    if (defaultIndigo.some(hex => tokenBlocks.toLowerCase().includes(hex))) {
      add('od-default-indigo', 'Open Design P0: 기본 인디고 포인트', 'Tailwind 기본 indigo/violet 계열 포인트 색이 감지됐습니다. 프로필 브랜드 색상이나 새 팔레트 토큰을 쓰세요.');
    }
    const emojiRe = /[✨🚀🎯⚡🔥💡📈🎨🛡️🌟💪🎉👋🙌✅⭐🏆]/u;
    const emojiNode = doc ? Array.from(doc.querySelectorAll('h1,h2,h3,h4,button,li,[class*="icon"]')).find(el => emojiRe.test(el.textContent || '')) : null;
    if (emojiNode) {
      add('od-emoji-icon', 'Open Design P0: 이모지 아이콘', `${_shortElementLabel(emojiNode)} 안에 이모지 아이콘이 있습니다. currentColor SVG나 텍스트 라벨로 바꾸세요.`, _buildSelector(emojiNode));
    }
    if (/\b(10×\s+(faster|better|easier)|100×\s+(faster|better)|99\.\d+%\s+uptime|zero[- ]downtime|3×\s+more\s+(productive|efficient))\b/i.test(source)) {
      add('od-invented-metric', 'Open Design P0: 근거 없는 수치', '10x faster, 99.9% uptime 같은 출처 없는 성과 수치가 감지됐습니다. 실제 자료가 없으면 정성 표현으로 바꾸세요.');
    }
    if (/\b(feature\s+(one|two|three|1|2|3)|lorem\s+ipsum|dolor\s+sit\s+amet|placeholder\s+text|sample\s+content)\b/i.test(source)) {
      add('od-filler-copy', 'Open Design P0: 필러 문구', 'feature one, lorem ipsum, placeholder text 같은 임시 문구가 감지됐습니다. 실제 메시지나 빈 상태 설계로 바꾸세요.');
    }
    if (/(source\.unsplash\.com|placehold\.co|placekitten\.com|picsum\.photos|via\.placeholder\.com)/i.test(source)) {
      add('od-placeholder-cdn', 'Open Design P1: 외부 placeholder 이미지', '외부 placeholder CDN은 깨지기 쉽고 템플릿처럼 보입니다. 첨부 이미지, 앱 생성 이미지, 안전 placeholder로 대체하세요.');
    }
    if (doc) {
      const editable = Array.from(doc.querySelectorAll('section.makeke-page,h1,h2,h3,p,button,a,img,.card,.panel,[class*="card"],[class*="panel"]'))
        .filter(el => el.getBoundingClientRect?.().width > 24 && el.getBoundingClientRect?.().height > 16);
      const missingId = editable.find(el => !el.hasAttribute('data-makeke-id'));
      if (missingId) {
        add('od-missing-makeke-id', 'Open Design P2: 편집 ID 누락', `${_shortElementLabel(missingId)} 요소에 data-makeke-id가 없습니다.`, _buildSelector(missingId));
      }
    }
    return issues;
  }

  function _escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _shortElementLabel(el) {
    if (!el) return '선택 요소';
    const tag = (el.tagName || 'element').toLowerCase();
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const text = (el.textContent || el.getAttribute?.('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 36);
    return `${tag}${cls}${text ? ` "${text}"` : ''}`;
  }

  function cdRunDesignReview() {
    const doc = _getPreviewDoc();
    if (!doc) return;
    _repairPreviewLayoutOverflow(doc);
    _runAutoDesignReview(doc, { source: 'manual' });
  }
  window.cdRunDesignReview = cdRunDesignReview;

  function _safePreviewImageDataUrl(label) {
    const safe = String(label || 'Makeke Design').slice(0, 36);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff7ed"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient></defs><rect width="1200" height="800" rx="48" fill="url(#g)"/><circle cx="928" cy="188" r="126" fill="#ff8c00" opacity=".20"/><circle cx="256" cy="604" r="168" fill="#007aff" opacity=".12"/><text x="600" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#1c1c1e">${_esc(safe)}</text><text x="600" y="452" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#6b7280">이미지를 선택해 직접 또는 AI로 교체하세요</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function _isLikelyBrokenImage(img) {
    const src = (img.getAttribute('src') || '').trim();
    if (!src || src === '#') return true;
    if (src.startsWith('#reference-image')) return true;
    if (/source\.unsplash\.com|via\.placeholder|placeholder/i.test(src)) return true;
    if (src.startsWith('/') || src.startsWith('./') || src.startsWith('../')) return true;
    if (img.complete && img.naturalWidth === 0) return true;
    return false;
  }

  function _healBrokenPreviewImages(doc) {
    if (!doc?.body) return;
    const refs = _attachedImages.filter(im => im?.dataUrl);
    let changed = false;
    Array.from(doc.querySelectorAll('img')).forEach((img, index) => {
      if (!_isLikelyBrokenImage(img)) return;
      const next = refs[index % Math.max(1, refs.length)]?.dataUrl || _safePreviewImageDataUrl(img.getAttribute('alt') || '이미지');
      img.setAttribute('src', next);
      img.removeAttribute('srcset');
      img.setAttribute('data-makeke-image-healed', 'true');
      img.style.objectFit = img.style.objectFit || 'cover';
      changed = true;
    });
    if (changed) _syncPreviewHtml(doc);
  }

  // 덱/멀티 슬라이드 검출 후 네비게이터 노출
  // 다양한 슬라이드 컨벤션을 모두 잡아내고 중복 제거
  function _findSlideElements(doc) {
    if (!doc) return [];
    // 후보: 명시적 .slide, [data-slide], section.slide-N, div[class*=slide], [id^=slide], [id^=page], .page
    const sel = [
      'section.slide', 'div.slide', '.slide', '[data-slide]',
      'section[class*="slide-"]', 'div[class*="slide-"]',
      '[id^="slide-"]', '[id^="slide_"]', '[id^="page-"]',
      'section.page', 'div.page', '.page',
    ].join(',');
    let candidates = Array.from(doc.querySelectorAll(sel));
    // 네비게이션·버튼만 명확히 제외 (컨테이너/래퍼 키워드 제거 — 슬라이드명 자체에 자주 들어감)
    const badRe = /(slide-?nav|slides?-?wrap|slide-?wrap|deck-?wrap|page-nav|nav-bar|navbar|toolbar)/i;
    candidates = candidates.filter(el => {
      if (el.closest?.('[data-cd-preview-ui]')) return false;
      const cls = (el.className && typeof el.className === 'string') ? el.className : '';
      const id = el.id || '';
      if (badRe.test(cls) || badRe.test(id)) return false;
      // 자기 자신이 button 이면 제외
      if (el.tagName === 'BUTTON') return false;
      return true;
    });
    // 중복: 후보 중 다른 후보를 자식으로 포함하면 (=상위 래퍼) 제외
    const set = new Set(candidates);
    candidates = candidates.filter(el => {
      for (const other of set) {
        if (other !== el && el.contains(other)) return false;
      }
      return true;
    });
    // 텍스트가 거의 없는 빈 슬라이드 제외 (예: 더미 placeholder)
    candidates = candidates.filter(el => (el.textContent || '').trim().length > 4 || el.querySelectorAll('img,svg,canvas,iframe').length > 0);
    // DOM 순서 정렬 (querySelectorAll 이 이미 그렇지만 안전)
    return candidates;
  }

  function _detectSlides() {
    const iframe = document.getElementById('cd-preview');
    const nav = document.getElementById('cd-slide-nav');
    try {
      const doc = iframe?.contentDocument;
      if (!doc) { if (nav) nav.style.display = 'none'; return; }
      const slides = _findSlideElements(doc);
      _slideTotal = slides.length;
      if (_slideTotal <= 1) {
        if (nav) nav.style.display = 'none';
        return;
      }
      // 식별 마커는 부여하되 — 기본은 "전체 보기" (쭉 아래로 스크롤)
      slides.forEach((el, i) => el.setAttribute('data-cd-slide', String(i)));
      _slideIndex = 0;
      // 기존 제한 CSS 제거 (있다면)
      const old = doc.getElementById('cd-slide-nav-css');
      if (old) old.remove();
      _applyAllSlidesCss(doc);
      // 네비게이터는 표시하되 기본 라벨은 "전체 (N장)"
      if (nav) {
        nav.style.display = 'flex';
        const lbl = document.getElementById('cd-slide-label');
        if (lbl) lbl.textContent = `전체 ${_slideTotal}장`;
      }
      _renderSlideDots();
      _addChatMessage('status', `📚 슬라이드 ${_slideTotal}장 감지 — 모두 아래로 표시 (▶ 1장씩 보기 누르면 페이지 모드)`);
      // 미리보기 wrap 이 스크롤 가능하도록 높이 자동 계산용 재스케일
      requestAnimationFrame(() => cdSetPreviewSize());
    } catch (_) {
      if (nav) nav.style.display = 'none';
    }
  }

  // 1장씩 보기 모드로 전환
  function _getMarkedSlideElements(doc) {
    if (!doc) return [];
    let slides = Array.from(doc.querySelectorAll('[data-cd-slide]'))
      .filter(el => !el.closest?.('[data-cd-preview-ui]'));
    if (!slides.length) {
      slides = _findSlideElements(doc);
      slides.forEach((el, i) => el.setAttribute('data-cd-slide', String(i)));
    }
    _slideTotal = slides.length;
    return slides;
  }

  function _setSlideElementSingleMode(slides) {
    slides.forEach((el, idx) => {
      const active = idx === _slideIndex;
      el.classList.toggle('cd-active', active);
    });
  }

  function _clearSlideElementSingleMode(slides) {
    slides.forEach((el) => {
      el.classList.remove('cd-active');
    });
  }

  function _removeSlideStage(doc) {
    doc?.getElementById('cd-preview-slide-stage')?.remove();
    if (doc?.body) doc.body.style.removeProperty('overflow');
  }

  function _renderSlideStage(doc, slides) {
    if (!doc?.body || !slides.length) return;
    let stage = doc.getElementById('cd-preview-slide-stage');
    if (!stage) {
      stage = doc.createElement('div');
      stage.id = 'cd-preview-slide-stage';
      stage.setAttribute('data-cd-preview-ui', '1');
      stage.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;display:block;box-sizing:border-box;';
      doc.body.appendChild(stage);
    }
    stage.innerHTML = '';
    const source = slides[_slideIndex];
    if (!source) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute('data-cd-slide');
    clone.removeAttribute('data-cd-selected');
    clone.querySelectorAll?.('[data-cd-selected], [data-cd-hover]').forEach(el => {
      el.removeAttribute('data-cd-selected');
      el.removeAttribute('data-cd-hover');
    });
    clone.querySelectorAll?.('[data-cd-slide]').forEach(el => el.removeAttribute('data-cd-slide'));
    clone.classList.add('cd-active');
    clone.style.setProperty('display', 'block', 'important');
    clone.style.setProperty('visibility', 'visible', 'important');
    clone.style.setProperty('opacity', '1', 'important');
    clone.style.setProperty('position', 'relative', 'important');
    clone.style.setProperty('inset', 'auto', 'important');
    clone.style.setProperty('transform', 'none', 'important');
    clone.style.setProperty('margin', '0 auto', 'important');
    clone.style.setProperty('box-sizing', 'border-box', 'important');
    stage.appendChild(clone);
    doc.body.style.setProperty('overflow', 'hidden', 'important');
    try { stage.scrollTo(0, 0); } catch (_) {}
  }

  function cdEnableSlideMode(index) {
    const iframe = document.getElementById('cd-preview');
    try {
      const doc = iframe?.contentDocument;
      const slides = _getMarkedSlideElements(doc);
      if (!doc || slides.length <= 1) return;
      _clearSelectionForScreenChange();
      const old = doc.getElementById('cd-slide-nav-css');
      if (old) old.remove();
      _applyAllSlidesCss(doc);
      const style = doc.createElement('style');
      style.id = 'cd-slide-nav-css';
      style.textContent = `
        html, body { overflow: hidden !important; }
        body { min-height: 100vh !important; }
        [data-cd-slide] { box-sizing: border-box !important; }
      `;
      doc.head.appendChild(style);
      _gotoSlide(Number.isFinite(Number(index)) ? Number(index) : _slideIndex);
    } catch (_) {}
  }
  window.cdEnableSlideMode = cdEnableSlideMode;

  function _gotoSlide(i) {
    const iframe = document.getElementById('cd-preview');
    try {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      const slides = _getMarkedSlideElements(doc);
      if (!slides.length) return;
      const nextIndex = ((i % slides.length) + slides.length) % slides.length;
      if (nextIndex !== _slideIndex) _clearSelectionForScreenChange();
      _slideIndex = nextIndex;
      _setSlideElementSingleMode(slides);
      if (_isSlideModeActive()) _renderSlideStage(doc, slides);
      try { doc.defaultView?.scrollTo(0, 0); } catch (_) {}
    } catch (_) {}
    const wrap = document.getElementById('cd-preview-wrap');
    if (wrap) {
      wrap.scrollTop = 0;
      wrap.scrollLeft = 0;
    }
    _updateNavLabel();
    _renderSlideDots();
    requestAnimationFrame(() => cdSetPreviewSize('fit'));
  }

  function _updateNavLabel() {
    const lbl = document.getElementById('cd-slide-label');
    if (!lbl) return;
    if (_isSlideModeActive()) {
      lbl.textContent = `${_slideIndex + 1} / ${_slideTotal}`;
    } else {
      lbl.textContent = `전체 ${_slideTotal}장`;
    }
  }

  function _renderSlideDots() {
    const box = document.getElementById('cd-slide-dots');
    if (!box) return;
    if (_slideTotal <= 1) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'flex';
    const active = _isSlideModeActive() ? _slideIndex : -1;
    const max = Math.min(_slideTotal, 12);
    box.innerHTML = Array.from({ length: max }, (_, i) => `
      <button type="button" onclick="cdGoSlide(${i})" title="${i + 1}번째 장 보기" style="width:20px;height:20px;border-radius:999px;border:1px solid ${i === active ? '#ff8c00' : 'rgba(0,0,0,0.10)'};background:${i === active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff'};color:${i === active ? '#fff' : 'rgba(0,0,0,0.62)'};font-size:9px;font-weight:900;cursor:pointer;padding:0;">${i + 1}</button>
    `).join('') + (_slideTotal > max ? `<span style="font-size:9px;color:rgba(0,0,0,0.38);padding:0 3px;">+${_slideTotal - max}</span>` : '');
  }

  function _isSlideModeActive() {
    try {
      const doc = document.getElementById('cd-preview')?.contentDocument;
      return !!doc?.getElementById('cd-slide-nav-css');
    } catch (_) { return false; }
  }
  window.cdPrevSlide = function () {
    if (!_isSlideModeActive()) cdEnableSlideMode(_slideIndex);
    _gotoSlide(_slideIndex - 1);
  };
  window.cdNextSlide = function () {
    if (!_isSlideModeActive()) cdEnableSlideMode(_slideIndex);
    _gotoSlide(_slideIndex + 1);
  };
  window.cdGoSlide = function (index) {
    if (!_isSlideModeActive()) cdEnableSlideMode(Number(index) || 0);
    _gotoSlide(Number(index) || 0);
  };
  window.cdShowAllSlides = function () {
    const iframe = document.getElementById('cd-preview');
    try {
      const doc = iframe?.contentDocument;
      if (!doc) return;
      _clearSelectionForScreenChange();
      const css = doc.getElementById('cd-slide-nav-css');
      if (css) css.remove();
      _removeSlideStage(doc);
      _clearSlideElementSingleMode(Array.from(doc.querySelectorAll('[data-cd-slide]')));
      _applyAllSlidesCss(doc);
      const nav = document.getElementById('cd-slide-nav');
      if (nav) nav.style.display = 'flex';
      _updateNavLabel();
      _renderSlideDots();
    } catch (_) {}
  };

  function _applyAllSlidesCss(doc) {
    if (!doc?.head) return;
    const old = doc.getElementById('cd-force-all-slides-css');
    if (old) old.remove();
    const style = doc.createElement('style');
    style.id = 'cd-force-all-slides-css';
    style.textContent = `
      [data-cd-slide] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        transform: none !important;
      }
    `;
    doc.head.appendChild(style);
  }

  // 빈 상태로 되돌리기 (새 대화 등)
  function _showEmptyState() {
    const iframe = document.getElementById('cd-preview');
    const empty = document.getElementById('cd-empty-state');
    const metaPill = document.getElementById('cd-meta-pill');
    if (iframe) iframe.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    if (metaPill) metaPill.style.display = 'none';
  }

  // 시각형 비율 버튼
  function cdSetAspect(value) {
    const sel = document.getElementById('cd-aspect');
    const nextValue = value || '';
    if (sel) sel.value = nextValue;
    const preflight = document.getElementById('cd-aspect-preflight');
    if (preflight && preflight.value !== nextValue) preflight.value = nextValue || '16:9';
    document.querySelectorAll('#page-claude-design select[onchange*="cdSetAspect"]').forEach(select => {
      const hasOption = Array.from(select.options || []).some(option => option.value === nextValue);
      if (select !== preflight && hasOption) select.value = nextValue;
    });
    const note = document.getElementById('cd-aspect-preflight-note');
    if (note) note.textContent = `선택값: ${nextValue || '16:9'}`;
    document.querySelectorAll('#cd-chat-aspect-buttons [data-chat-aspect]').forEach(btn => {
      const active = !!nextValue && btn.getAttribute('data-chat-aspect') === nextValue;
      btn.style.background = active ? '#fff' : 'transparent';
      btn.style.color = active ? '#1c1c1e' : 'rgba(0,0,0,0.5)';
      btn.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
    });
    document.querySelectorAll('#cd-aspect-group [data-aspect]').forEach(btn => {
      const active = !!nextValue && btn.getAttribute('data-aspect') === nextValue;
      btn.style.background = active ? '#fff' : 'transparent';
      btn.style.color = active ? '#1c1c1e' : 'rgba(0,0,0,0.5)';
      btn.style.boxShadow = active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none';
    });
    if (typeof window.cdUpdateSendAvailability === 'function') window.cdUpdateSendAvailability();
    if (_lastHtml && nextValue) cdSetPreviewSize('m');
  }
  window.cdSetAspect = cdSetAspect;

  // 시작 템플릿 선택 → 입력창에 프롬프트 채우고 비율 세팅, 즉시 전송하지 않음
  function cdStartFromTemplate(kind, prompt, aspect) {
    const kindSel = document.getElementById('cd-kind');
    if (kindSel) kindSel.value = kind || 'general';
    if (aspect) cdSetAspect(aspect);
    const input = document.getElementById('cd-input');
    if (input) {
      input.value = prompt || '';
      input.focus();
      // 자동 높이 조절 트리거
      input.dispatchEvent(new Event('input'));
    }
    if (typeof window.cdUpdateSendAvailability === 'function') window.cdUpdateSendAvailability();
  }
  window.cdStartFromTemplate = cdStartFromTemplate;

  // ─── 첨부 이미지 ────────────────────────────────────────────
  function _readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  async function cdAttachImages(fileList) {
    const files = Array.from(fileList || []).filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    const MAX = 12;
    const before = _attachedImages.length;
    for (const f of files) {
      if (_attachedImages.length >= MAX) {
        if (typeof toast === 'function') toast(`이미지는 최대 ${MAX}장`, 'warning');
        break;
      }
      const dataUrl = await _readFileAsDataUrl(f);
      const duplicate = _attachedImages.some(im => im.dataUrl === dataUrl || (im.name === f.name && im.size === f.size));
      if (!duplicate) _attachedImages.push({ name: f.name, dataUrl, size: f.size, source: 'upload' });
    }
    _renderAttachments();
    const added = _attachedImages.length - before;
    if (added > 0) _addChatMessage('status', `📎 이미지 ${added}장 첨부 (참고로 사용)`);
    // 첨부 시 자동으로 팔레트 추출 (없을 때만)
    if (!document.getElementById('cd-colors')?.value.trim()) {
      try { await cdExtractPaletteFromAttachments(); } catch (_) {}
    }
  }
  window.cdAttachImages = cdAttachImages;

  async function _fetchImageAsDataUrl(url) {
    const remoteUrl = String(url || '').trim();
    async function fetchBlob(fetchUrl, options) {
      const res = await fetch(fetchUrl, options || {});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!/^image\//.test(blob.type || '')) throw new Error('이미지가 아닙니다');
      return blob;
    }
    let blob;
    try {
      blob = await fetchBlob(remoteUrl, { credentials: 'same-origin' });
    } catch (directError) {
      if (!/^https?:\/\//i.test(remoteUrl)) throw directError;
      blob = await fetchBlob(`/api/claude-design/proxy-image?url=${encodeURIComponent(remoteUrl)}`);
    }
    return await _readFileAsDataUrl(blob);
  }

  async function cdAttachReferenceImageUrls(urls, sourceLabel) {
    const list = Array.from(urls || []).map(u => String(u || '').trim()).filter(Boolean);
    if (!list.length) return 0;
    const MAX = 12;
    let added = 0;
    for (const url of list) {
      if (_attachedImages.length >= MAX) break;
      if (_attachedImages.some(im => im.sourceUrl === url)) continue;
      try {
        const dataUrl = await _fetchImageAsDataUrl(url);
        _attachedImages.push({
          name: `${sourceLabel || '참고'} ${added + 1}`,
          dataUrl,
          sourceUrl: url,
          source: sourceLabel || 'url',
        });
        added += 1;
      } catch (e) {
        console.warn('[Makeke Design] reference image failed:', url, e);
      }
    }
    if (added) {
      _renderAttachments();
      if (!document.getElementById('cd-colors')?.value.trim()) {
        try { await cdExtractPaletteFromAttachments(); } catch (_) {}
      }
    }
    return added;
  }
  window.cdAttachReferenceImageUrls = cdAttachReferenceImageUrls;

  function cdRemoveAttachment(idx) {
    _attachedImages.splice(idx, 1);
    _renderAttachments();
  }
  window.cdRemoveAttachment = cdRemoveAttachment;

  function _clearAttachedImages() {
    _attachedImages = [];
    _renderAttachments();
    const fi = document.getElementById('cd-file-input');
    if (fi) fi.value = '';
  }

  function _renderAttachments() {
    const box = document.getElementById('cd-attachments');
    if (!box) return;
    if (!_attachedImages.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'flex';
    box.innerHTML = _attachedImages.map((im, i) => `
      <div title="${_esc(im.source || im.name || '참고 이미지')}" style="position:relative;width:48px;height:48px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.1);background:#fff;">
        <img src="${im.dataUrl}" style="width:100%;height:100%;object-fit:cover;">
        <button type="button" onclick="cdRemoveAttachment(${i})" title="제거" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;border:0;background:#1c1c1e;color:#fff;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
      </div>
    `).join('');
  }

  // 드래그앤드롭 / 붙여넣기 지원
  function _bindAttachmentDnD() {
    const bindDropTarget = (target, idleCss) => {
      if (!target || target._dndBound) return;
      target._dndBound = true;
      const baseBorder = idleCss?.borderColor || target.style.borderColor;
      const baseShadow = idleCss?.boxShadow || target.style.boxShadow;
      ['dragenter', 'dragover'].forEach(ev => target.addEventListener(ev, e => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          target.style.borderColor = '#007aff';
          target.style.boxShadow = '0 0 0 5px rgba(0,122,255,0.16)';
        }
      }));
      ['dragleave', 'drop'].forEach(ev => target.addEventListener(ev, e => {
        target.style.borderColor = baseBorder;
        target.style.boxShadow = baseShadow;
      }));
      target.addEventListener('drop', async e => {
        if (e.dataTransfer?.files?.length) {
          e.preventDefault();
          await cdAttachImages(e.dataTransfer.files);
        }
      });
    };

    bindDropTarget(document.getElementById('cd-input-wrap'), { borderColor: 'rgba(0,0,0,0.08)', boxShadow: 'none' });
    bindDropTarget(document.getElementById('cd-preview-wrap'), { borderColor: 'transparent', boxShadow: 'none' });

    const input = document.getElementById('cd-input');
    if (input) {
      input.addEventListener('paste', async e => {
        const items = e.clipboardData?.items || [];
        const files = [];
        for (const it of items) {
          if (it.kind === 'file' && /^image\//.test(it.type)) {
            const f = it.getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length) {
          e.preventDefault();
          await cdAttachImages(files);
        }
      });
    }
  }

  // 미리보기 = 항상 실제 픽셀 (1920×1080 등) 으로 iframe 렌더링하고
  // 컨테이너에 맞춰 CSS transform: scale() 로 축소 표시 (위·아래 잘리지 않음)
  function cdSetPreviewSize(mode) {
    if (mode) _previewMode = mode;
    const iframe = document.getElementById('cd-preview');
    const wrap = document.getElementById('cd-preview-wrap');
    if (!iframe || !wrap) return;
    const aspect = document.getElementById('cd-aspect')?.value || '16:9';
    const [pw, ph] = _PIXEL_TABLE[aspect] || [1920, 1080];

    // iframe 은 항상 native 해상도로
    iframe.style.width = `${pw}px`;
    iframe.style.height = `${ph}px`;
    iframe.style.transformOrigin = 'top left';
    iframe.style.position = 'absolute';

    // 컨테이너 크기 측정 (padding 14px 양쪽 고려)
    const cw = wrap.clientWidth - 28;
    const ch = wrap.clientHeight - 28;
    let scale;
    if (_previewMode === 'fit') {
      scale = Math.min(cw / pw, ch / ph);
    } else {
      const factor = _SIZE_FACTOR[_previewMode] ?? 0.7;
      scale = Math.min(cw / pw, ch / ph) * factor;
    }
    scale = Math.max(0.05, Math.min(scale * (_previewZoom || 1), 2.5));
    iframe.style.transform = `scale(${scale})`;
    const visualW = pw * scale;
    const visualH = ph * scale;
    const offsetX = Math.max(14, Math.round((wrap.clientWidth - visualW) / 2));
    const offsetY = Math.max(14, Math.round((wrap.clientHeight - visualH) / 2));
    iframe.style.left = `${offsetX}px`;
    iframe.style.top = `${offsetY}px`;

    // 스크롤 영역 확보를 위한 스페이서 — absolute iframe 의 시각 크기만큼 공간 차지
    // max-width: 100% 로 부모 컬럼을 밀지 않게 함 (스크롤바로 처리)
    let spacer = wrap.querySelector('.cd-preview-spacer');
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.className = 'cd-preview-spacer';
      spacer.style.cssText = 'flex-shrink:0;pointer-events:none;';
      wrap.appendChild(spacer);
    }
    spacer.style.width = `${Math.round(offsetX + visualW + 14)}px`;
    spacer.style.height = `${Math.round(offsetY + visualH + 14)}px`;
    spacer.style.maxWidth = 'none';

    wrap.style.position = 'relative';
    _refreshInlineSelectionOverlay();
  }
  window.cdSetPreviewSize = cdSetPreviewSize;

  function cdSetPreviewZoom(value) {
    const n = parseFloat(value);
    _previewZoom = Number.isFinite(n) ? Math.max(0.25, Math.min(3, n / 100)) : 1;
    const label = document.getElementById('cd-preview-zoom-label');
    if (label) label.textContent = `${Math.round(_previewZoom * 100)}%`;
    cdSetPreviewSize();
  }
  window.cdSetPreviewZoom = cdSetPreviewZoom;

  function cdResetPreviewZoom() {
    _previewZoom = 1;
    _previewMode = 'fit';
    const input = document.getElementById('cd-preview-zoom');
    if (input) input.value = '100';
    const label = document.getElementById('cd-preview-zoom-label');
    if (label) label.textContent = '100%';
    cdSetPreviewSize('fit');
  }
  window.cdResetPreviewZoom = cdResetPreviewZoom;

  // 컨테이너 리사이즈 시 자동 재계산
  if (typeof window !== 'undefined' && !window._cdResizeBound) {
    window._cdResizeBound = true;
    let _resizeTm;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTm);
      _resizeTm = setTimeout(() => cdSetPreviewSize(), 150);
    });
  }

  if (typeof window !== 'undefined' && !window._cdInlineKeyBound) {
    window._cdInlineKeyBound = true;
    document.addEventListener('keydown', (event) => {
      const pg = document.getElementById('page-claude-design');
      if (!pg || !pg.classList.contains('active')) return;
      if (!_selectedElement) return;
      const tag = (event.target?.tagName || '').toLowerCase();
      const isTypingTarget = tag === 'textarea' || tag === 'input' || event.target?.isContentEditable;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        cdUndoInlineEdit();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        event.stopPropagation();
        cdRedoInlineEdit();
        return;
      }
      if (isTypingTarget) return;
      if ((event.metaKey || event.ctrlKey) && key === 'c') {
        event.preventDefault();
        cdCopySelectedElement();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'v') {
        event.preventDefault();
        cdPasteSelectedElement();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'd') {
        event.preventDefault();
        cdDuplicateSelectedElement();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        cdDeleteSelectedElement();
        return;
      }
      const target = _getSelectedPreviewElement();
      if (!target) return;
      const step = event.shiftKey ? 10 : 1;
      const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = arrows[event.key];
      if (delta) {
        event.preventDefault();
        _pushCdEditHistory('키보드 이동');
        const computed = _ensureTransformableElement(target);
        target.style.left = _roundPx(_parsePx(computed?.left, 0) + delta[0]);
        target.style.top = _roundPx(_parsePx(computed?.top, 0) + delta[1]);
        _syncPreviewHtml(target.ownerDocument);
        _updateInlineEditChip();
        _refreshInlineSelectionOverlay();
      }
    });
  }

  _bindFloatingEditDismissal();

  // 다른 분할 파일이 참조하도록 내부 함수를 window 로 노출
  window._renderPreview = _renderPreview;
  window._renderSourceChips = _renderSourceChips;
  window._updateInlineEditButton = _updateInlineEditButton;
  window._updateInlineEditChip = _updateInlineEditChip;
  window._syncPreviewHtmlFromDoc = () => _syncPreviewHtml(_getPreviewDoc());
  window._clearAttachedImages = _clearAttachedImages;
  window._showEmptyState = _showEmptyState;
  window._bindAttachmentDnD = _bindAttachmentDnD;
  window._bindInlineEdit = _bindInlineEdit;
  window._gotoSlide = _gotoSlide;
})();
