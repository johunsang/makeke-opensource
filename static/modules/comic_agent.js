/**
 * comic_agent.js
 * 만화 에이전트 — 완전 채팅형 만화 생성 + 히스토리
 */
(function () {
  'use strict';

  let _cagSourceContent = '';
  let _cagLatestResult = null;
  let _cagPromptDraft = null;
  let _cagLastRunContext = null;
  let _cagSelectedConcepts = [];
  const CAG_STYLE_OPTIONS = [
    { label: '귀여운', value: 'cute' },
    { label: '웹툰', value: 'webtoon' },
    { label: '만화', value: 'comic' },
    { label: '리얼리스틱', value: 'realistic' },
    { label: '치비', value: 'chibi' },
    { label: '일본만화', value: 'manga' },
    { label: '개그만화', value: 'gag' },
    { label: '일상툰', value: 'slice-of-life' },
    { label: '수채화만화', value: 'watercolor-comic' },
    { label: '픽셀아트', value: 'pixel' },
    { label: '스케치', value: 'sketch-comic' },
    { label: '팝아트', value: 'pop-art' },
    { label: '스티커', value: 'sticker' },
    { label: '클레이', value: 'claymation' },
    { label: '느와르', value: 'noir' },
    { label: '레트로만화', value: 'retro-comic' },
    { label: '판타지', value: 'fantasy' },
    { label: '미니멀', value: 'minimalist-comic' },
    { label: '에디토리얼', value: 'editorial' },
    { label: '인포그래픽', value: 'infographic-comic' },
    { label: '두들', value: 'doodle' },
    { label: '라인아트', value: 'line-art' },
    { label: '플랫만화', value: 'flat-comic' },
  ];

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _inputStyle() { return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;'; }
  function _cagCountFromLabel(label, fallback) {
    const n = parseInt(String(label || '').replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : fallback;
  }
  function _cagLayoutForPanelCount(count) {
    const n = _cagCountFromLabel(count, 4);
    if (n <= 1) return '1x1';
    if (n <= 2) return '2x1';
    if (n <= 4) return '2x2';
    if (n <= 6) return '3x2';
    if (n <= 8) return '4x2';
    return '5x2';
  }

  function cagInit() {
    const root = document.getElementById('comic-agent-root');
    if (!root) return;
    if (typeof mkkRenderSingleImageModelBanner === 'function') {
      mkkRenderSingleImageModelBanner('comic-agent', { note: '만화 스토리와 이미지 생성 전 현재 설정 모델을 사용합니다.' });
    }
    _renderLayout(root);
  }

  function _renderLayout(root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow-y:auto;overflow-x:hidden;">

        <!-- 시작 버튼 -->
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:14px 20px;">
          <button onclick="cagGenerate()" id="cag-gen-btn" style="width:100%;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(255,140,0,0.3);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
            AI로 시작하기
          </button>
          <input type="hidden" id="cag-style" value="cute">
          <input type="hidden" id="cag-episodes" value="1">
          <input type="hidden" id="cag-panels" value="4">
        </div>

        <!-- AI 어시스턴트 + 결과 -->
        <div id="cag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex:1;min-height:400px;overflow:visible;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">AI 어시스턴트</span>
            <button type="button" onclick="cagRestart()" title="처음부터 다시 시작" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
          </div>
          <div id="cag-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100px;color:rgba(0,0,0,0.15);font-size:13px;text-align:center;">
              <div style="font-size:28px;margin-bottom:6px;">&#x1F4DA;</div>
              <div>AI로 시작하기를 누르면 AI가 안내합니다</div>
            </div>
          </div>
          <div id="cag-result" style="display:none;padding:16px;border-top:1px solid rgba(0,0,0,0.06);">
            <div id="cag-result-images" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;"></div>
            <div id="cag-result-composed" style="margin-top:10px;"></div>
            <div id="cag-result-actions" style="display:none;gap:8px;flex-wrap:wrap;margin-top:10px;"></div>
          </div>
        </div>
      </div>`;
  }

  /* ── 소재 탭 (유틸리티, 외부에서 호출 가능) ── */
  function cagToggleSource(mode) {
    ['text','news','naver','youtube','url','knowledge'].forEach(function (m) {
      var p = document.getElementById('cag-src-' + m);
      var b = document.getElementById('cag-src-btn-' + m);
      if (p) p.style.display = m === mode ? '' : 'none';
      if (b) { b.style.background = m === mode ? 'rgba(255,140,0,0.08)' : 'rgba(0,0,0,0.02)'; b.style.borderColor = m === mode ? 'rgba(255,140,0,0.2)' : 'rgba(0,0,0,0.08)'; b.style.color = m === mode ? '#ff8c00' : 'rgba(0,0,0,0.4)'; }
    });
    if (mode === 'news' && typeof ce2OpenNewsSearchModal === 'function') ce2OpenNewsSearchModal();
    if (mode === 'naver' && typeof ce2OpenNaverSearchModal === 'function') ce2OpenNaverSearchModal();
    if (mode === 'knowledge' && typeof ce2OpenKnowledgeModal === 'function') ce2OpenKnowledgeModal();
  }

  async function cagFetchYoutube() {
    var url = (document.getElementById('cag-youtube-url')?.value || '').trim();
    var status = document.getElementById('cag-yt-status');
    var btn = document.getElementById('cag-yt-btn');
    if (!url) return;
    if (btn) { btn.textContent = '분석 중...'; btn.disabled = true; }
    var res = await window._VAGSource.analyzeYouTube(url);
    if (res.ok) {
      _cagSourceContent = res.text;
      if (status) status.innerHTML = '<span style="color:#34c759;">분석 완료 (' + res.text.length + '자)</span>' + window._VAGSource.youtubeAnalysisPreviewHTML(res);
    } else if (status) {
      status.innerHTML = '<span style="color:#ff3b30;">' + _esc(res.error) + '</span>';
    }
    if (btn) { btn.textContent = '분석'; btn.disabled = false; }
  }

  async function cagFetchUrl() {
    var url = (document.getElementById('cag-source-url')?.value || '').trim();
    var status = document.getElementById('cag-url-status');
    var btn = document.getElementById('cag-url-btn');
    if (!url) return;
    if (btn) { btn.textContent = '가져오는 중...'; btn.disabled = true; }
    var res = await window._VAGSource.fetchUrl(url);
    if (res.ok) { _cagSourceContent = res.text; if (status) status.innerHTML = '<span style="color:#34c759;">가져옴 (' + res.text.length + '자)</span>'; }
    else if (status) { status.innerHTML = '<span style="color:#ff3b30;">' + _esc(res.error) + '</span>'; }
    if (btn) { btn.textContent = '가져오기'; btn.disabled = false; }
  }

  /* ── 채팅 헬퍼 ── */
  function _showTyping() {
    const body = document.getElementById('cag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    const ti = document.createElement('div');
    ti.className = 'typing-indicator';
    ti.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;';
    ti.innerHTML = '<div style="display:flex;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.4s infinite;"></span></div><span style="font-size:12px;color:rgba(0,0,0,0.3);">AI가 생각하고 있어요...</span>';
    body.appendChild(ti);
    body.scrollTop = body.scrollHeight;
  }

  function _addMsg(role, html) {
    var body = document.getElementById('cag-chat-body');
    if (!body) return;
    if (body.children.length === 1 && body.firstChild.textContent.includes('AI로 시작하기를 누르면')) body.innerHTML = '';
    var isAi = role === 'ai';
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:' + (isAi ? 'flex-start' : 'flex-end') + ';';
    div.innerHTML = '<div style="max-width:85%;padding:10px 14px;border-radius:' + (isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px') + ';background:' + (isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)') + ';color:' + (isAi ? '#1c1c1e' : '#fff') + ';font-size:13px;line-height:1.6;">' + html + '</div>';
    // 타이핑 인디케이터 제거
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    body.appendChild(div);
    var panel = document.getElementById('cag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _sourcePreview(title, text) {
    if (!text) return '';
    if (window._VAGSource && typeof window._VAGSource.sourceTextPreviewHTML === 'function') {
      return window._VAGSource.sourceTextPreviewHTML(title || '소재 반영 내용', text);
    }
    return '<br><span style="font-size:11px;color:rgba(0,0,0,0.42);">' + _esc(String(text).slice(0, 500)) + '</span>';
  }

  function _cagModelLabel(extra) {
    var parts = ['이미지 모델: 설정값 사용'];
    if (extra) parts.push(extra);
    return parts.join(' / ');
  }

  function _cagSetResultStatus(text, tone) {
    var resultEl = document.getElementById('cag-result');
    if (resultEl) resultEl.style.display = 'block';
    var status = document.getElementById('cag-result-status');
    if (!status && resultEl) {
      status = document.createElement('div');
      status.id = 'cag-result-status';
      resultEl.insertBefore(status, resultEl.firstChild);
    }
    if (!status) return;
    var color = tone === 'error' ? '#ff3b30' : tone === 'success' ? '#34c759' : '#ff8c00';
    status.style.cssText = 'margin-bottom:12px;padding:10px 12px;border-radius:12px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);font-size:12px;font-weight:800;color:' + color + ';line-height:1.55;';
    status.textContent = text || '';
  }

  function _addOptions(options, callback) {
    return new Promise(function (resolve) {
      var body = document.getElementById('cag-chat-body');
      if (!body) { resolve(options[0]); return; }
      var wrap = document.createElement('div');
      wrap.className = 'cag-chat-options';
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
      options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.textContent = opt;
        btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;';
        btn.onmouseenter = function () { btn.style.background = 'rgba(255,140,0,0.15)'; };
        btn.onmouseleave = function () { btn.style.background = 'rgba(255,140,0,0.06)'; };
        btn.onclick = function () {
          body.querySelectorAll('.cag-chat-options').forEach(function (el) { el.remove(); });
          _addMsg('user', opt);
          if (callback) callback(opt);
          resolve(opt);
        };
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
      var panel = document.getElementById('cag-assist-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function _cagStyleLabel(value) {
    const item = CAG_STYLE_OPTIONS.find(function (option) { return option.value === value || option.label === value; });
    return item?.label || value || '귀여운';
  }

  function _cagProfileComicStyle() {
    const raw = String(window._contentOpts?.comic_style || (typeof getOpt === 'function' ? getOpt('comic_style', 'cute') : 'cute') || 'cute');
    return raw.split(',').map(function (value) { return value.trim(); }).filter(Boolean);
  }

  function _addMultiStyleOptions(defaultValues) {
    return new Promise(function (resolve) {
      var body = document.getElementById('cag-chat-body');
      if (!body) { resolve(defaultValues?.length ? defaultValues : ['cute']); return; }
      var selected = new Set((defaultValues || ['cute']).filter(Boolean));
      var wrap = document.createElement('div');
      wrap.className = 'cag-chat-options cag-multi-style-options';
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 0;';
      var chips = CAG_STYLE_OPTIONS.map(function (item) {
        var active = selected.has(item.value);
        return '<button type="button" data-style="' + item.value + '" style="padding:7px 12px;border-radius:20px;border:1px solid ' + (active ? 'rgba(255,140,0,0.45)' : 'rgba(255,140,0,0.18)') + ';background:' + (active ? 'rgba(255,140,0,0.16)' : 'rgba(255,140,0,0.04)') + ';color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;">' + _esc(item.label) + '</button>';
      }).join('');
      wrap.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + chips + '</div><button type="button" data-role="confirm" style="align-self:flex-start;padding:8px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">선택 완료</button>';
      wrap.querySelectorAll('[data-style]').forEach(function (btn) {
        btn.onclick = function () {
          var value = btn.dataset.style;
          if (selected.has(value) && selected.size > 1) selected.delete(value);
          else selected.add(value);
          var active = selected.has(value);
          btn.style.borderColor = active ? 'rgba(255,140,0,0.45)' : 'rgba(255,140,0,0.18)';
          btn.style.background = active ? 'rgba(255,140,0,0.16)' : 'rgba(255,140,0,0.04)';
        };
      });
      wrap.querySelector('[data-role="confirm"]').onclick = function () {
        var values = Array.from(selected);
        body.querySelectorAll('.cag-chat-options').forEach(function (el) { el.remove(); });
        _addMsg('user', values.map(_cagStyleLabel).join(', '));
        resolve(values.length ? values : ['cute']);
      };
      body.appendChild(wrap);
      var panel = document.getElementById('cag-assist-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function _cagStyleForPanel(index, concepts) {
    const list = Array.isArray(concepts) && concepts.length ? concepts : _cagSelectedConcepts;
    return (list && list.length) ? list[index % list.length] : (document.getElementById('cag-style')?.value || 'cute');
  }

  function _comicImg(src) {
    var raw = String(src || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes('/comics/')) return '/api/comic/image/' + raw.split('/comics/').pop();
    if (raw.startsWith('/api/comic/image/')) return raw;
    if (raw.startsWith('/')) return raw;
    return '/api/comic/image/' + raw;
  }

  function _safePanel(panel, index) {
    return {
      panel_number: index + 1,
      situation: String(panel?.situation || '').trim(),
      dialogue: String(panel?.dialogue || '').trim(),
      narration: String(panel?.narration || '').trim(),
      visual_prompt: String(panel?.visual_prompt || '').trim(),
      emotion: String(panel?.emotion || 'neutral').trim() || 'neutral',
    };
  }

  function _collectComicPanelDrafts(card, fallbackPanels) {
    return fallbackPanels.map(function (panel, idx) {
      var read = function (field) {
        return String(card.querySelector('[data-index="' + idx + '"][data-field="' + field + '"]')?.value || '').trim();
      };
      return {
        panel_number: idx + 1,
        situation: read('situation') || panel.situation,
        dialogue: read('dialogue'),
        narration: read('narration'),
        visual_prompt: read('visual_prompt') || panel.visual_prompt,
        emotion: read('emotion') || panel.emotion || 'neutral',
      };
    });
  }

  function _reviewComicPanels(panels, label) {
    return new Promise(function (resolve) {
      var body = document.getElementById('cag-chat-body');
      var safePanels = (Array.isArray(panels) ? panels : []).map(_safePanel);
      if (!body || !safePanels.length) {
        resolve(safePanels);
        return;
      }
      body.querySelectorAll('.cag-chat-options, .cag-inline-card').forEach(function (el) { el.remove(); });
      var card = document.createElement('div');
      card.className = 'cag-inline-card';
      card.style.cssText = 'padding:14px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.045);border-radius:16px;display:flex;flex-direction:column;gap:12px;';
      card.innerHTML = `
        <div>
          <div style="font-size:13px;font-weight:900;color:#1c1c1e;">${_esc(label || '만화 컷 구성 확인')}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.48);line-height:1.65;margin-top:4px;">아래 컷 구성과 그림 지시문이 이미지 만들기에 전달됩니다. 원하는 내용으로 고친 뒤 시작하세요.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:520px;overflow:auto;padding-right:2px;">
          ${safePanels.map(function (panel, idx) {
            return `
              <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:12px;font-weight:900;color:#ff8c00;">${idx + 1}컷</div>
                <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">장면
                  <textarea data-index="${idx}" data-field="situation" rows="2" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(panel.situation || '')}</textarea>
                </label>
                <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">대사
                  <textarea data-index="${idx}" data-field="dialogue" rows="2" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(panel.dialogue || '')}</textarea>
                </label>
                <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">설명
                  <textarea data-index="${idx}" data-field="narration" rows="2" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(panel.narration || '')}</textarea>
                </label>
                <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">그림 지시문
                  <textarea data-index="${idx}" data-field="visual_prompt" rows="4" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(panel.visual_prompt || '')}</textarea>
                </label>
                <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">감정
                  <input data-index="${idx}" data-field="emotion" value="${_esc(panel.emotion || 'neutral')}" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;color:#1c1c1e;background:#fff;outline:none;">
                </label>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" data-role="submit" style="padding:10px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">이 구성으로 만화 만들기</button>
        </div>`;
      card.querySelector('[data-role="submit"]')?.addEventListener('click', function () {
        var edited = _collectComicPanelDrafts(card, safePanels);
        card.remove();
        _addMsg('user', '컷 구성 확인 완료');
        resolve(edited);
      });
      body.appendChild(card);
      var panel = document.getElementById('cag-assist-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async function _fetchTopicSuggestions(brandName) {
    _showTyping();
    var fallback = ['일상 에피소드', '제품 소개', '이벤트 홍보', '고객 후기', '꿀팁 공유', '업종 유머'];
    var body = document.getElementById('cag-chat-body');
    try {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;
      var resp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'topics',
          industry: window._globalProfileData?.business_type || '',
          brand_name: brandName,
          brand_desc: window._globalProfileData?.service_description || '',
          count: 30
        }),
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      var data = await resp.json();
      if (data.ok && data.items?.length) return data.items.slice(0, 8);
    } catch (e) {
      console.warn('[CAG] topic suggestions fallback:', e?.message || e);
    } finally {
      if (body) body.querySelectorAll('.typing-indicator').forEach(function (el) { el.remove(); });
    }
    return fallback;
  }

  /* ── 메인 채팅 플로우 ── */
  async function cagGenerate() {
    var chatBody = document.getElementById('cag-chat-body');
    if (chatBody) chatBody.innerHTML = '<div class="typing-indicator" style="display:flex;align-items:center;gap:6px;padding:10px 14px;"><span class="spinner" style="width:16px;height:16px;border-width:2px;"></span><span style="font-size:13px;color:rgba(0,0,0,0.4);">AI가 준비 중...</span></div>';
    var resultEl = document.getElementById('cag-result');
    if (resultEl) resultEl.style.display = 'none';
    _cagSourceContent = '';
    window._sharedSourceContent = '';

    var btn = document.getElementById('cag-gen-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; btn.dataset.origText = btn.textContent || ''; btn.textContent = '생성중...'; }

    try {
      var brandName = window._globalProfileData?.name || '';

      // 인사
      _addMsg('ai', brandName ? '<b>' + _esc(brandName) + '</b> 만화를 만들어 드릴게요!' : '만화를 만들어 드릴게요!');

      // 1. 주제 입력
      _addMsg('ai', '어떤 주제의 만화를 만들까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.3);">키워드를 입력하거나 추천 주제를 선택하세요</span>');

      var suggestions = await _fetchTopicSuggestions(brandName);

      var topic = await new Promise(function (resolve) {
        var body = document.getElementById('cag-chat-body');
        var inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
        inputWrap.innerHTML = '<input type="text" id="cag-chat-topic-input" placeholder="키워드 직접 입력..." style="flex:1;' + _inputStyle() + '" onkeydown="if(event.key===\'Enter\'){event.preventDefault();document.getElementById(\'cag-chat-topic-go\').click();}"><button id="cag-chat-topic-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>';
        body.appendChild(inputWrap);
        document.getElementById('cag-chat-topic-go').onclick = function () {
          var v = document.getElementById('cag-chat-topic-input').value.trim();
          if (v) { inputWrap.remove(); body.querySelectorAll('.cag-chat-options').forEach(function (el) { el.remove(); }); _addMsg('user', v); resolve(v); }
        };
        _addOptions(suggestions, function (sel) { inputWrap.remove(); resolve(sel); });
      });

      // 2. 소재 수집 방법
      if (!_cagSourceContent) {
        _addMsg('ai', '소재를 어떻게 준비할까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.4);">추천: 주제 키워드로 뉴스 검색하면 최신 자료를 바로 활용할 수 있어요.</span>');
        var sourceMethod = await _addOptions(['소재 없이 진행', '뉴스 검색', '네이버 검색', 'YouTube 분석', 'URL 가져오기', '직접 입력']);

        if (sourceMethod === '뉴스 검색') {
          _addMsg('ai', '뉴스 자료조사 모달을 열겠습니다.');
          var newsPicked = window._VAGSource && typeof window._VAGSource.openNewsModal === 'function'
            ? await window._VAGSource.openNewsModal({ query: topic, showProgressModal: true })
            : { ok: false, error: '자료조사 모듈을 찾지 못했습니다.' };
          if (newsPicked.ok) _cagSourceContent = newsPicked.text;
          else _addMsg('ai', '<span style="color:#ff9500;">' + _esc(newsPicked.error || '뉴스 자료를 가져오지 못했습니다.') + '</span>');
        } else if (sourceMethod === '네이버 검색') {
          _addMsg('ai', '네이버 자료조사 모달을 열겠습니다.');
          var naverPicked = window._VAGSource && typeof window._VAGSource.openNaverModal === 'function'
            ? await window._VAGSource.openNaverModal({ query: topic, showProgressModal: true })
            : { ok: false, error: '네이버 자료조사 모듈을 찾지 못했습니다.' };
          if (naverPicked.ok) _cagSourceContent = naverPicked.text;
          else _addMsg('ai', '<span style="color:#ff9500;">' + _esc(naverPicked.error || '네이버 자료를 가져오지 못했습니다.') + '</span>');
        } else if (sourceMethod === 'YouTube 분석') {
          _addMsg('ai', 'YouTube URL을 입력하세요.');
          var ytUrl = await new Promise(function (resolve) {
            var body = document.getElementById('cag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = '<input type="text" id="cag-chat-yt" placeholder="https://youtube.com/..." style="flex:1;' + _inputStyle() + '"><button id="cag-chat-yt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff0000;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">분석</button>';
            body.appendChild(w);
            document.getElementById('cag-chat-yt-go').onclick = function () { var v = document.getElementById('cag-chat-yt').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', 'YouTube 영상을 분석 중...');
          {
            var ytRes = await window._VAGSource.analyzeYouTube(ytUrl);
            if (ytRes.ok) { _cagSourceContent = ytRes.text; _addMsg('ai', '<span style="color:#34c759;">분석 완료 (' + ytRes.text.length + '자)</span>' + window._VAGSource.youtubeAnalysisPreviewHTML(ytRes)); }
            else { _addMsg('ai', '<span style="color:#ff3b30;">' + _esc(ytRes.error) + '</span>'); }
          }
        } else if (sourceMethod === 'URL 가져오기') {
          _addMsg('ai', 'URL을 입력하세요.');
          var srcUrl = await new Promise(function (resolve) {
            var body = document.getElementById('cag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = '<input type="text" id="cag-chat-url" placeholder="https://..." style="flex:1;' + _inputStyle() + '"><button id="cag-chat-url-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">가져오기</button>';
            body.appendChild(w);
            document.getElementById('cag-chat-url-go').onclick = function () { var v = document.getElementById('cag-chat-url').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', '페이지 내용을 가져오는 중...');
          {
            var urlRes = await window._VAGSource.fetchUrl(srcUrl);
            if (urlRes.ok) { _cagSourceContent = urlRes.text; _addMsg('ai', '<span style="color:#34c759;">가져오기 완료 (' + urlRes.text.length + '자)</span>'); }
            else { _addMsg('ai', '<span style="color:#ff3b30;">' + _esc(urlRes.error) + '</span>'); }
          }
        } else if (sourceMethod === '직접 입력') {
          _addMsg('ai', '만화에 넣을 내용을 입력하세요.');
          await new Promise(function (resolve) {
            var body = document.getElementById('cag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'padding:4px 0;';
            w.innerHTML = '<textarea id="cag-chat-direct" rows="4" placeholder="만화에 넣을 내용..." style="width:100%;' + _inputStyle() + 'resize:vertical;line-height:1.5;"></textarea><button id="cag-chat-direct-go" style="margin-top:4px;padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>';
            body.appendChild(w);
            document.getElementById('cag-chat-direct-go').onclick = function () { var v = document.getElementById('cag-chat-direct').value.trim(); if (v) { w.remove(); _addMsg('user', v.length > 100 ? v.slice(0, 100) + '...' : v); _cagSourceContent = v; resolve(v); } };
          });
        }
        if (_cagSourceContent) _addMsg('ai', '소재 준비 완료 (' + _cagSourceContent.length + '자)' + _sourcePreview('소재 반영 내용', _cagSourceContent));
      }

      // 4. 만화 이미지 컨셉
      _addMsg('ai', '만화 이미지 컨셉을 선택하세요. 여러 개를 고르면 컷마다 순서대로 적용합니다.');
      _cagSelectedConcepts = await _addMultiStyleOptions(_cagProfileComicStyle());
      document.getElementById('cag-style').value = _cagSelectedConcepts.join(',');

      // 5. 회차와 컷 수
      _addMsg('ai', '몇 회차로 만들까요?');
      var epSel = await _addOptions(['1회', '3회', '5회', '10회']);
      var episodes = _cagCountFromLabel(epSel, 1);
      document.getElementById('cag-episodes').value = episodes;

      _addMsg('ai', '각 회차를 몇 컷으로 만들까요?');
      var panelSel = await _addOptions(['1컷', '2컷', '3컷', '4컷', '6컷', '8컷', '10컷']);
      var panelCount = _cagCountFromLabel(panelSel, 4);
      document.getElementById('cag-panels').value = panelCount;
      _addMsg('ai', episodes + '회차 · 각 ' + panelCount + '컷으로 고정해서 만들겠습니다.');

      // 생성
      await _prepareAndGenerate(topic, _cagSourceContent, episodes, panelCount);

    } catch (flowErr) {
      console.error('[CAG] flow error:', flowErr);
      _addMsg('ai', '<span style="color:#ff3b30;">오류: ' + _esc(flowErr.message) + '<br>다시 시도해주세요.</span>');
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = btn.dataset.origText || 'AI로 시작하기'; delete btn.dataset.origText; }
  }

  /* ── 실제 생성 ── */
  async function _prepareAndGenerate(topic, source, episodes, panelCount) {
    panelCount = _cagCountFromLabel(panelCount, 4);
    if (episodes > 1) {
      await _doGenerate(topic, source, episodes, panelCount);
      return;
    }
    var concepts = _cagSelectedConcepts.length ? _cagSelectedConcepts : _cagProfileComicStyle();
    var style = concepts.join(',') || document.getElementById('cag-style')?.value || 'cute';
    var profileId = parseInt(window._globalProfileId || 0);
    _addMsg('ai', '먼저 컷 구성을 만들고 확인하겠습니다.');
    var scriptResp = await fetch('/api/comic/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic || '만화',
        reference: source || '',
        style: style,
        panel_count: panelCount,
        layout: _cagLayoutForPanelCount(panelCount),
        profile_id: profileId,
      }),
    });
    var scriptData = await scriptResp.json();
    if (!scriptResp.ok || !Array.isArray(scriptData.panels) || !scriptData.panels.length) {
      throw new Error(scriptData.error || '만화 컷 구성을 만들지 못했습니다.');
    }
    _cagPromptDraft = await _reviewComicPanels(scriptData.panels, panelCount + '컷 구성 확인');
    _cagLastRunContext = { topic: topic || '만화', source: source || '', episodes: 1, panelCount: panelCount, style: style, styles: concepts, profileId: profileId };
    await _doGenerateFromPanels(_cagPromptDraft, { ..._cagLastRunContext, projectDir: scriptData.project_dir || '' });
  }

  async function _doGenerate(topic, source, episodes, panelCount) {
    panelCount = _cagCountFromLabel(panelCount, _cagCountFromLabel(document.getElementById('cag-panels')?.value, 4));
    _addMsg('ai', episodes + '회차 · 각 ' + panelCount + '컷 만화를 생성 중... (시간이 걸릴 수 있습니다)');
    _cagSetResultStatus(episodes + '회차 · 각 ' + panelCount + '컷 생성 중... · ' + _cagModelLabel());
    var btn = document.getElementById('cag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }

    var concepts = _cagSelectedConcepts.length ? _cagSelectedConcepts : _cagProfileComicStyle();
    var style = concepts.join(',') || document.getElementById('cag-style')?.value || 'cute';
    var profileId = parseInt(window._globalProfileId || 0);
    var message = source || topic || '';

    try {
      var resp;
      if (episodes > 1) {
        resp = await fetch('/api/comic/story-series', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic || '만화', message: message, style: style, episode_count: episodes, panel_count: panelCount, layout: _cagLayoutForPanelCount(panelCount), profile_id: profileId, brand_name: window._globalProfileData?.name || '', brand_color: window._globalProfileData?.brand_color || '', brand_logo: window._globalProfileData?.logo_path ? '/api/library/profiles/' + profileId + '/logo' : '' }) });
      } else {
        resp = await fetch('/api/comic/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic || '만화', reference: source || '', style: style, panel_count: panelCount, layout: _cagLayoutForPanelCount(panelCount), profile_id: profileId, brand_name: window._globalProfileData?.name || '', brand_color: window._globalProfileData?.brand_color || '', brand_logo: window._globalProfileData?.logo_path ? '/api/library/profiles/' + profileId + '/logo' : '' }) });
      }
      var data = await resp.json();

      var cb = document.getElementById('cag-chat-body');
      if (cb && cb.lastChild) cb.removeChild(cb.lastChild);

      if (data.composed_image || data.episodes) {
        _cagLatestResult = {
          topic: topic || '만화',
          composed_image: data.composed_image || '',
          project_dir: data.project_dir || '',
        };
        _addMsg('ai', '<b>만화 생성 완료!</b>');
        var resultEl = document.getElementById('cag-result');
        if (resultEl) resultEl.style.display = 'block';

        var composedEl = document.getElementById('cag-result-composed');
        var imagesEl = document.getElementById('cag-result-images');

        if (data.composed_image) {
          if (imagesEl) { imagesEl.innerHTML = ''; imagesEl.style.display = 'none'; }
          composedEl.innerHTML = '<div style="font-size:12px;font-weight:800;color:#ff8c00;margin-bottom:6px;">1회차 · ' + panelCount + '컷 완성 이미지</div><img src="' + _comicImg(data.composed_image) + '?t=' + Date.now() + '" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,0.06);" onclick="window.open(this.src)">';
        }
        if (data.panels && !data.composed_image) {
          var panelImages = data.panels.filter(function (p) {
            var src = p.image_url || p.url || p.image_path || '';
            return !!src && !p.is_composed;
          });
          imagesEl.innerHTML = panelImages.map(function (p) { return '<img src="' + _comicImg(p.image_url || p.url || p.image_path || '') + '?t=' + Date.now() + '" style="width:100%;border-radius:8px;border:1px solid rgba(0,0,0,0.06);" onclick="window.open(this.src)">'; }).join('');
          imagesEl.style.display = panelImages.length ? 'grid' : 'none';
        }
        if (data.episodes) {
          if (imagesEl) { imagesEl.innerHTML = ''; imagesEl.style.display = 'none'; }
          composedEl.innerHTML = data.episodes.map(function (ep, i) {
            var epPanels = Array.isArray(ep.panels) ? ep.panels.length : panelCount;
            return '<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;color:#ff8c00;margin-bottom:4px;">' + (i + 1) + '회차 · ' + epPanels + '컷: ' + _esc(ep.title || '') + '</div>' + (ep.composed_image ? '<img src="' + _comicImg(ep.composed_image) + '?t=' + Date.now() + '" style="width:100%;border-radius:10px;border:1px solid rgba(0,0,0,0.06);">' : '') + '</div>';
          }).join('');
        }
        _cagSetResultStatus('만화 생성 완료 · ' + _cagModelLabel(), 'success');
        if (data.composed_image && episodes <= 1) {
          composedEl.innerHTML += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button onclick="cagUploadLatestInstagram()" style="padding:9px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">인스타 업로드</button><button onclick="cagOpenLatestFolder()" style="padding:9px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button><div id="cag-upload-status" style="display:flex;align-items:center;font-size:11px;color:rgba(0,0,0,0.35);"></div></div>';
        }

        // 히스토리 저장
        try {
          await fetch('/api/cag/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic || '', style: style, episodes: episodes, panel_count: panelCount, composed_image: data.composed_image || '', project_dir: data.project_dir || '', profile_name: window._globalProfileData?.name || '', profile_id: profileId }) });
        } catch (e) { /* silent */ }
      } else {
        _addMsg('ai', '<span style="color:#ff3b30;">생성 실패: ' + _esc(data.error || data.detail || '') + '</span>');
      }
    } catch (e) {
      var chatBody = document.getElementById('cag-chat-body');
      if (chatBody && chatBody.lastChild) chatBody.removeChild(chatBody.lastChild);
      _addMsg('ai', '<span style="color:#ff3b30;">오류: ' + _esc(e.message) + '</span>');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg> AI로 시작하기'; }
  }

  async function _doGenerateFromPanels(panels, context) {
    _addMsg('ai', '확인한 컷 구성으로 만화를 생성 중입니다.');
    var btn = document.getElementById('cag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }

    var topic = context.topic || '만화';
    var concepts = Array.isArray(context.styles) && context.styles.length ? context.styles : String(context.style || 'cute').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
    var style = concepts.join(',') || context.style || 'cute';
    var profileId = context.profileId || parseInt(window._globalProfileId || 0);
    var projectDir = context.projectDir || '';
    var panelCount = _cagCountFromLabel(context.panelCount || panels.length, panels.length || 4);
    var layout = _cagLayoutForPanelCount(panelCount);
    _cagSetResultStatus('1회차 · ' + panelCount + '컷 이미지 생성 중... · ' + _cagModelLabel());

    try {
      if (!projectDir) {
        var scriptResp = await fetch('/api/comic/script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic,
            reference: context.source || '',
            style: style,
            panel_count: panelCount,
            layout: layout,
            panels_override: panels,
            profile_id: profileId,
          }),
        });
        var scriptData = await scriptResp.json();
        if (!scriptResp.ok || !scriptData.project_dir) throw new Error(scriptData.error || '만화 작업 폴더를 만들지 못했습니다.');
        projectDir = scriptData.project_dir;
        if (Array.isArray(scriptData.panels) && scriptData.panels.length) panels = scriptData.panels;
      }

      var resultEl = document.getElementById('cag-result');
      var imagesEl = document.getElementById('cag-result-images');
      var composedEl = document.getElementById('cag-result-composed');
      var actionsEl = document.getElementById('cag-result-actions');
      if (resultEl) resultEl.style.display = 'block';
      if (imagesEl) { imagesEl.style.display = 'none'; imagesEl.innerHTML = ''; }
      if (composedEl) composedEl.innerHTML = '';
      if (actionsEl) { actionsEl.style.display = 'none'; actionsEl.innerHTML = ''; }

      var generatedPanels = [];
      for (var i = 0; i < panels.length; i += 1) {
        var panel = _safePanel(panels[i], i);
        _addMsg('ai', '<b>' + (i + 1) + '/' + panels.length + '</b> ' + _esc(panel.situation || '컷') + ' 이미지를 생성 중입니다...');
        _cagSetResultStatus('1회차 · ' + panelCount + '컷 중 ' + (i + 1) + '/' + panels.length + '컷 생성 중... · ' + _cagModelLabel());
        try {
          var panelStyle = _cagStyleForPanel(i, concepts);
          var panelResp = await fetch('/api/comic/generate-panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panel: panel, topic: topic, style: panelStyle, project_dir: projectDir, profile_id: profileId }),
          });
          var panelData = await panelResp.json();
          if (!panelResp.ok || !(panelData.image_url || panelData.image_path)) throw new Error(panelData.error || '이미지 없음');
          var panelUrl = _comicImg(panelData.image_url || panelData.image_path) + '?t=' + Date.now();
          generatedPanels.push({ ...panel, image_url: panelData.image_url || '', image_path: panelData.image_path || '' });
        } catch (panelErr) {
          generatedPanels.push({ ...panel, status: 'error: ' + (panelErr?.message || '생성 실패') });
          _addMsg('ai', '<span style="color:#ff3b30;">' + (i + 1) + '컷 생성 실패: ' + _esc(panelErr?.message || '') + '</span>');
        }
      }

      _cagSetResultStatus('컷 ' + generatedPanels.length + '개를 한 장으로 합성 중... · ' + _cagModelLabel());
      var composeResp = await fetch('/api/comic/recompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_dir: projectDir, layout: layout, topic: topic, style: style, panels: generatedPanels }),
      });
      var composeData = await composeResp.json();
      if (!composeResp.ok || !composeData.composed_image) throw new Error(composeData.error || '합성 이미지가 없습니다.');

      var composedUrl = _comicImg(composeData.composed_image);
      if (imagesEl) { imagesEl.innerHTML = ''; imagesEl.style.display = 'none'; }
      if (composedEl) {
        composedEl.innerHTML = '<div style="font-size:12px;font-weight:800;color:#ff8c00;margin-bottom:6px;">1회차 · ' + generatedPanels.length + '컷 완성 이미지</div><img src="' + composedUrl + '?t=' + Date.now() + '" style="width:100%;border-radius:12px;border:1px solid rgba(0,0,0,0.06);" onclick="window.open(this.src)">';
      }
      if (actionsEl) {
        actionsEl.style.display = 'flex';
        actionsEl.innerHTML = '<button onclick="cagEditPromptsAndRegenerate()" style="padding:9px 12px;border-radius:8px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:11px;font-weight:800;cursor:pointer;">컷 구성 수정 후 다시 만들기</button><button onclick="cagOpenLatestFolder()" style="padding:9px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button>';
      }
      _cagLatestResult = { topic: topic, composed_image: composeData.composed_image || '', project_dir: projectDir };
      _cagPromptDraft = panels.map(_safePanel);
      _cagLastRunContext = { topic: topic, source: context.source || '', episodes: 1, panelCount: panelCount, style: style, styles: concepts, profileId: profileId };
      _addMsg('ai', '<b>만화 생성 완료!</b>');
      _cagSetResultStatus('1회차 · ' + generatedPanels.length + '컷 합성 완료 · ' + _cagModelLabel(), 'success');

      try {
        await fetch('/api/cag/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic || '', style: style, episodes: 1, panel_count: panelCount, composed_image: composeData.composed_image || '', project_dir: projectDir || '', profile_name: window._globalProfileData?.name || '', profile_id: profileId, panels: generatedPanels }) });
      } catch (e) { /* silent */ }
    } catch (e) {
      _cagSetResultStatus('만화 생성 실패: ' + (e.message || ''), 'error');
      _addMsg('ai', '<span style="color:#ff3b30;">오류: ' + _esc(e.message) + '</span>');
      throw e;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg> AI로 시작하기'; }
    }
  }

  async function cagEditPromptsAndRegenerate() {
    if (!_cagPromptDraft || !_cagLastRunContext) {
      _addMsg('ai', '먼저 만화를 한 번 만들어주세요. 그러면 방금 사용한 컷 구성을 다시 고칠 수 있습니다.');
      return;
    }
    var edited = await _reviewComicPanels(_cagPromptDraft, '다시 만들 컷 구성 수정');
    _cagPromptDraft = edited;
    await _doGenerateFromPanels(edited, { ..._cagLastRunContext, projectDir: '' });
  }

  /* ── 히스토리 ── */
  async function cagHistoryInit() {
    var root = document.getElementById('comic-agent-history-root');
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      var resp = await fetch('/api/cag/history');
      var data = await resp.json();
      if (!data.ok || !data.items?.length) { root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 만화가 없습니다</div>'; return; }
      window._cagHistoryItems = data.items;
      var _comicImg = function (src) { return src ? (src.startsWith('/') || src.startsWith('http') ? src : '/api/comic/image/' + src) : ''; };
      root.innerHTML = data.items.map(function (item, hi) {
        return '<div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div><div style="display:flex;align-items:center;gap:6px;">' + (item.profile_id ? '<img src="/api/library/profiles/' + item.profile_id + '/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display=\'none\'">' : '') + '<div style="font-size:14px;font-weight:700;color:#1c1c1e;">' + _esc(item.topic || '만화') + '</div></div><div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">' + (item.profile_name ? _esc(item.profile_name) + ' · ' : '') + _esc(item.created || '') + ' · ' + _esc(item.style || '') + '</div></div><div style="display:flex;gap:6px;"><button onclick="cagHistoryUploadInstagram(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;cursor:pointer;">인스타 업로드</button><button onclick="cagHistoryOpen(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button><button onclick="cagHistoryDelete(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button></div></div>' + (item.composed_image ? '<img src="' + _comicImg(item.composed_image) + '?t=' + Date.now() + '" style="width:100%;border-radius:10px;border:1px solid rgba(0,0,0,0.06);">' : '') + '<div id="cag-h-status-' + hi + '" style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.35);"></div></div>';
      }).join('');
    } catch (e) { root.innerHTML = '<div style="text-align:center;padding:40px;color:#ff3b30;">오류: ' + e.message + '</div>'; }
  }

  async function cagUploadInstagram(imagePath, caption, statusEl) {
    var profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    if (!profileId) {
      if (statusEl) { statusEl.textContent = '프로필 선택 필요'; statusEl.style.color = '#ff3b30'; }
      return;
    }
    if (!imagePath) {
      if (statusEl) { statusEl.textContent = '업로드 이미지 없음'; statusEl.style.color = '#ff3b30'; }
      return;
    }
    if (statusEl) { statusEl.textContent = '인스타 업로드 중...'; statusEl.style.color = '#ff8c00'; }
    try {
      await fetch('/api/instagram/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_paths: [imagePath], caption: caption || '', profile_id: profileId })
      });
      if (statusEl) { statusEl.textContent = '업로드 완료'; statusEl.style.color = '#34c759'; }
    } catch (e) {
      if (statusEl) { statusEl.textContent = e.message; statusEl.style.color = '#ff3b30'; }
    }
  }

  function cagOpenLatestFolder() {
    if (!_cagLatestResult?.project_dir) return;
    fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: _cagLatestResult.project_dir }) });
  }

  function cagUploadLatestInstagram() {
    var statusEl = document.getElementById('cag-upload-status');
    cagUploadInstagram(_cagLatestResult?.composed_image || '', _cagLatestResult?.topic || '만화', statusEl);
  }

  async function cagHistoryOpen(hi) {
    var item = (window._cagHistoryItems || [])[hi];
    if (item?.project_dir) fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.project_dir }) });
  }

  function cagHistoryUploadInstagram(hi) {
    var item = (window._cagHistoryItems || [])[hi];
    var statusEl = document.getElementById('cag-h-status-' + hi);
    cagUploadInstagram(item?.composed_image || '', item?.topic || '만화', statusEl);
  }

  async function cagHistoryDelete(hi) {
    var item = (window._cagHistoryItems || [])[hi];
    if (!item?.folder) return;
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch('/api/cag/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder }) });
    cagHistoryInit();
  }

  function cagRestart() {
    _cagSourceContent = '';
    _cagLatestResult = null;
    _cagPromptDraft = null;
    _cagLastRunContext = null;
    _cagSelectedConcepts = [];
    window._sharedSourceContent = '';
    const root = document.getElementById('comic-agent-root');
    if (root) _renderLayout(root);
  }

  window.cagInit = cagInit;
  window.cagHistoryInit = cagHistoryInit;
  window.cagToggleSource = cagToggleSource;
  window.cagFetchYoutube = cagFetchYoutube;
  window.cagFetchUrl = cagFetchUrl;
  window.cagGenerate = cagGenerate;
  window.cagRestart = cagRestart;
  window.cagEditPromptsAndRegenerate = cagEditPromptsAndRegenerate;
  window.cagUploadLatestInstagram = cagUploadLatestInstagram;
  window.cagOpenLatestFolder = cagOpenLatestFolder;
  window.cagHistoryOpen = cagHistoryOpen;
  window.cagHistoryUploadInstagram = cagHistoryUploadInstagram;
  window.cagHistoryDelete = cagHistoryDelete;
})();
