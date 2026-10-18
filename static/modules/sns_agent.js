/**
 * sns_agent.js
 * SNS 에이전트 — 완전 채팅 기반 Threads / X(Twitter) 글 생성 + 복사 + 히스토리
 */
(function () {
  'use strict';

  let _sagSourceContent = '';
  let _sagResult = null; // { threads_text, twitter_text }

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _inputStyle() { return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;transition:border-color 0.2s;'; }

  /* ── 초기화 ── */
  function sagInit() {
    const root = document.getElementById('sns-agent-root');
    if (!root) return;
    _renderLayout(root);
  }

  /* ── 레이아웃 (완전 채팅형) ── */
  function _renderLayout(root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow-y:auto;overflow-x:hidden;">

        <!-- 시작 버튼 -->
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:14px 20px;">
          <button onclick="sagGenerate()" id="sag-gen-btn" style="width:100%;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(255,140,0,0.3);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
            AI로 시작하기
          </button>
          <!-- 숨겨진 값 저장용 -->
          <input type="hidden" id="sag-topic" value="">
          <input type="hidden" id="sag-platform" value="both">
          <input type="hidden" id="sag-tone" value="mystyle">
          <input type="hidden" id="sag-length" value="medium">
        </div>

        <!-- AI 어시스턴트 + 결과 -->
        <div id="sag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex:1;min-height:400px;overflow:visible;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">AI 어시스턴트</span>
            <button type="button" onclick="sagRestart()" title="처음부터 다시 시작" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
          </div>
          <div id="sag-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100px;color:rgba(0,0,0,0.15);font-size:13px;text-align:center;">
              <div style="font-size:28px;margin-bottom:6px;">&#x2728;</div>
              <div>AI로 시작하기를 누르면 어시스턴트가 안내합니다</div>
            </div>
          </div>
          <!-- 결과 -->
          <div id="sag-result" style="display:none;padding:16px;border-top:1px solid rgba(0,0,0,0.06);">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <!-- Threads -->
              <div style="background:rgba(0,0,0,0.02);border-radius:12px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <b style="font-size:13px;">@ Threads</b>
                  <div style="display:flex;gap:6px;">
                    <button onclick="navigator.clipboard.writeText(document.getElementById('sag-threads-text').value);this.textContent='\uBCF5\uC0AC\uB428!';setTimeout(()=>this.textContent='\uBCF5\uC0AC',1000)" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">복사</button>
                  </div>
                </div>
                <textarea id="sag-threads-text" rows="4" oninput="sagRefreshThreadSegments()" style="width:100%;padding:10px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.6;"></textarea>
                <div id="sag-threads-status" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;"></div>
                <div id="sag-threads-segments" style="display:none;flex-direction:column;gap:8px;margin-top:10px;"></div>
              </div>
              <!-- X -->
              <div style="background:rgba(29,161,242,0.04);border-radius:12px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <b style="font-size:13px;">X (Twitter)</b>
                  <div style="display:flex;gap:6px;">
                    <button onclick="navigator.clipboard.writeText(document.getElementById('sag-twitter-text').value);this.textContent='\uBCF5\uC0AC\uB428!';setTimeout(()=>this.textContent='\uBCF5\uC0AC',1000)" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">복사</button>
                  </div>
                </div>
                <textarea id="sag-twitter-text" rows="3" style="width:100%;padding:10px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.6;"></textarea>
                <div id="sag-twitter-status" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── 채팅 ── */
  function _showTyping() {
    const body = document.getElementById('sag-chat-body');
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
    const body = document.getElementById('sag-chat-body');
    if (!body) return;
    if (body.children.length === 1 && body.firstChild.textContent.includes('AI로 시작하기를 누르면')) body.innerHTML = '';
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:' + (isAi ? 'flex-start' : 'flex-end') + ';';
    div.innerHTML = '<div style="max-width:85%;padding:10px 14px;border-radius:' + (isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px') + ';background:' + (isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)') + ';color:' + (isAi ? '#1c1c1e' : '#fff') + ';font-size:13px;line-height:1.6;">' + html + '</div>';
    // 타이핑 인디케이터 제거
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    body.appendChild(div);
    var panel = document.getElementById('sag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _sourcePreview(title, text) {
    if (!text) return '';
    if (window._VAGSource && typeof window._VAGSource.sourceTextPreviewHTML === 'function') {
      return window._VAGSource.sourceTextPreviewHTML(title || '소재 반영 내용', text);
    }
    return '<br><span style="font-size:11px;color:rgba(0,0,0,0.42);">' + _esc(String(text).slice(0, 500)) + '</span>';
  }

  function _sagRenderThreadSegments(rawText) {
    var wrap = document.getElementById('sag-threads-segments');
    var status = document.getElementById('sag-threads-status');
    if (!wrap) return;
    var text = String(rawText || '').trim();
    var segments = _sagSplitThreads(text);
    if (status) {
      status.innerHTML = text.length + '자 \xB7 ' + (segments.length > 1 ? '<b style="color:#ff8c00;">' + segments.length + '개 이어쓰기</b>로 나뉩니다' : '한 번에 복사 가능');
    }
    if (segments.length <= 1) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = 'flex';
    wrap.innerHTML = '<div style="font-size:11px;font-weight:800;color:#ff8c00;">이어쓰기 글</div>' + segments.map(function (segment, idx) {
      return '\
        <div style="padding:10px 12px;border:1px solid rgba(255,140,0,0.16);border-radius:10px;background:rgba(255,140,0,0.04);">\
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">\
            <b style="font-size:11px;color:#1c1c1e;">이어쓰기 ' + (idx + 1) + '</b>\
            <div style="display:flex;align-items:center;gap:6px;">\
              <span style="font-size:10px;color:rgba(0,0,0,0.38);">' + segment.length + '자</span>\
              <button type="button" onclick="sagCopyThreadSegment(' + idx + ')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.22);background:#fff;color:#ff8c00;font-size:10px;font-weight:700;cursor:pointer;">복사</button>\
            </div>\
          </div>\
          <div style="white-space:pre-wrap;font-size:12px;line-height:1.65;color:#1c1c1e;">' + _esc(segment) + '</div>\
        </div>';
    }).join('');
  }

  function sagRefreshThreadSegments() {
    _sagRenderThreadSegments(document.getElementById('sag-threads-text')?.value || '');
  }

  async function sagCopyThreadSegment(index) {
    var segments = _sagSplitThreads(document.getElementById('sag-threads-text')?.value || '');
    var segment = segments[index] || '';
    if (!segment) return;
    await navigator.clipboard.writeText(segment);
  }

  function _sagRenderHistoryThreadSegments(hi, rawText) {
    var wrap = document.getElementById('sag-ht-segments-' + hi);
    var status = document.getElementById('sag-ht-split-status-' + hi);
    if (!wrap) return;
    var text = String(rawText || '').trim();
    var segments = _sagSplitThreads(text);
    if (status) {
      status.innerHTML = text.length + '자 \xB7 ' + (segments.length > 1 ? '<b style="color:#ff8c00;">' + segments.length + '개 이어쓰기</b>로 나뉩니다' : '한 번에 복사 가능');
    }
    if (segments.length <= 1) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = 'flex';
    wrap.innerHTML = '<div style="font-size:11px;font-weight:800;color:#ff8c00;">이어쓰기 글</div>' + segments.map(function (segment, idx) {
      return '\
        <div style="padding:10px 12px;border:1px solid rgba(255,140,0,0.16);border-radius:10px;background:rgba(255,140,0,0.04);">\
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">\
            <b style="font-size:11px;color:#1c1c1e;">이어쓰기 ' + (idx + 1) + '</b>\
            <div style="display:flex;align-items:center;gap:6px;">\
              <span style="font-size:10px;color:rgba(0,0,0,0.38);">' + segment.length + '자</span>\
              <button type="button" onclick="sagCopyHistoryThreadSegment(' + hi + ',' + idx + ')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.22);background:#fff;color:#ff8c00;font-size:10px;font-weight:700;cursor:pointer;">복사</button>\
            </div>\
          </div>\
          <div style="white-space:pre-wrap;font-size:12px;line-height:1.65;color:#1c1c1e;">' + _esc(segment) + '</div>\
        </div>';
    }).join('');
  }

  function sagRefreshHistoryThreadSegments(hi) {
    _sagRenderHistoryThreadSegments(hi, document.getElementById('sag-ht-' + hi)?.value || '');
  }

  async function sagCopyHistoryThreadSegment(hi, index) {
    var segments = _sagSplitThreads(document.getElementById('sag-ht-' + hi)?.value || '');
    var segment = segments[index] || '';
    if (!segment) return;
    await navigator.clipboard.writeText(segment);
  }

  function _addOptions(options, callback) {
    var body = document.getElementById('sag-chat-body');
    if (!body) return;
    var wrap = document.createElement('div');
    wrap.className = 'sag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;';
      btn.onclick = function () { body.querySelectorAll('.sag-chat-options').forEach(function (el) { el.remove(); }); _addMsg('user', opt); callback(opt); };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
  }

  /* ── 생성 흐름 (완전 채팅형) ── */
  async function sagGenerate() {
    var chatBody = document.getElementById('sag-chat-body');
    if (chatBody) chatBody.innerHTML = '<div class="typing-indicator" style="display:flex;align-items:center;gap:6px;padding:10px 14px;"><span class="spinner" style="width:16px;height:16px;border-width:2px;"></span><span style="font-size:13px;color:rgba(0,0,0,0.4);">AI가 준비 중...</span></div>';
    var resultEl = document.getElementById('sag-result');
    if (resultEl) resultEl.style.display = 'none';
    _sagSourceContent = '';
    window._sharedSourceContent = '';

    var btn = document.getElementById('sag-gen-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

    var brandName = window._globalProfileData?.name || '';
    var brandDesc = window._globalProfileData?.service_description || '';

    try {
      // 인사
      _addMsg('ai', brandName ? '<b>' + _esc(brandName) + '</b> SNS 글을 만들어 드릴게요!' : 'SNS 글을 만들어 드릴게요!');

      // 1. 주제 입력
      _addMsg('ai', '어떤 주제로 SNS 글을 쓸까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.3);">키워드를 입력하거나 추천 주제를 선택하세요</span>');
      var suggestions = [];
      try {
        var resp = await fetch('/api/ce2/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topics', industry: window._globalProfileData?.business_type || '', brand_name: brandName, brand_desc: brandDesc, count: 30 }) });
        var data = await resp.json();
        if (data.ok && data.items?.length) suggestions = data.items.slice(0, 10);
      } catch (e) { /* ignore */ }
      if (!suggestions.length) suggestions = ['일상 공유','제품 소개','이벤트 안내','꿀팁 공유','후기 공유','브랜드 스토리'];

      var topic = await new Promise(function (resolve) {
        var body = document.getElementById('sag-chat-body');
        // 직접 입력 필드
        var inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
        inputWrap.innerHTML = '<input type="text" id="sag-chat-topic-input" placeholder="키워드 직접 입력..." style="flex:1;' + _inputStyle() + '" onkeydown="if(event.key===\'Enter\'){event.preventDefault();document.getElementById(\'sag-chat-topic-go\').click();}"><button id="sag-chat-topic-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>';
        body.appendChild(inputWrap);
        document.getElementById('sag-chat-topic-go').onclick = function () {
          var v = document.getElementById('sag-chat-topic-input').value.trim();
          if (v) { inputWrap.remove(); body.querySelectorAll('.sag-chat-options').forEach(function (el) { el.remove(); }); _addMsg('user', v); resolve(v); }
        };
        // 추천 옵션
        _addOptions(suggestions, function (sel) { inputWrap.remove(); resolve(sel); });
      });
      document.getElementById('sag-topic').value = topic;

      // 2. 소재 수집 방법
      if (!_sagSourceContent) {
        _addMsg('ai', '소재를 어떻게 준비할까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.4);">추천: 주제 키워드로 뉴스 검색하면 최신 자료를 바로 활용할 수 있어요.</span>');
        var sourceMethod = await new Promise(function (resolve) {
          _addOptions(['소재 없이 진행', '뉴스 검색', '네이버 검색', 'YouTube 분석', 'URL 가져오기', '직접 입력'], resolve);
        });

        if (sourceMethod === '뉴스 검색') {
          _addMsg('ai', '뉴스 자료조사 모달을 열겠습니다.');
          var newsPicked = window._VAGSource && typeof window._VAGSource.openNewsModal === 'function'
            ? await window._VAGSource.openNewsModal({ query: topic, showProgressModal: true })
            : { ok: false, error: '자료조사 모듈을 찾지 못했습니다.' };
          if (newsPicked.ok) _sagSourceContent = newsPicked.text;
          else _addMsg('ai', '<span style="color:#ff9500;">' + _esc(newsPicked.error || '뉴스 자료를 가져오지 못했습니다.') + '</span>');
        } else if (sourceMethod === '네이버 검색') {
          _addMsg('ai', '네이버 자료조사 모달을 열겠습니다.');
          var naverPicked = window._VAGSource && typeof window._VAGSource.openNaverModal === 'function'
            ? await window._VAGSource.openNaverModal({ query: topic, showProgressModal: true })
            : { ok: false, error: '네이버 자료조사 모듈을 찾지 못했습니다.' };
          if (naverPicked.ok) _sagSourceContent = naverPicked.text;
          else _addMsg('ai', '<span style="color:#ff9500;">' + _esc(naverPicked.error || '네이버 자료를 가져오지 못했습니다.') + '</span>');
        } else if (sourceMethod === 'YouTube 분석') {
          _addMsg('ai', 'YouTube URL을 입력하세요.');
          var ytUrl = await new Promise(function (resolve) {
            var body = document.getElementById('sag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = '<input type="text" id="sag-chat-yt" placeholder="https://youtube.com/..." style="flex:1;' + _inputStyle() + '"><button id="sag-chat-yt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff0000;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">분석</button>';
            body.appendChild(w);
            document.getElementById('sag-chat-yt-go').onclick = function () { var v = document.getElementById('sag-chat-yt').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', 'YouTube 영상을 분석 중...');
          {
            var ytRes = await window._VAGSource.analyzeYouTube(ytUrl);
            if (ytRes.ok) { _sagSourceContent = ytRes.text; _addMsg('ai', '<span style="color:#34c759;">분석 완료 (' + ytRes.text.length + '자)</span>' + window._VAGSource.youtubeAnalysisPreviewHTML(ytRes)); }
            else { _addMsg('ai', '<span style="color:#ff3b30;">' + _esc(ytRes.error) + '</span>'); }
          }
        } else if (sourceMethod === 'URL 가져오기') {
          _addMsg('ai', 'URL을 입력하세요.');
          var srcUrl = await new Promise(function (resolve) {
            var body = document.getElementById('sag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = '<input type="text" id="sag-chat-url" placeholder="https://..." style="flex:1;' + _inputStyle() + '"><button id="sag-chat-url-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">가져오기</button>';
            body.appendChild(w);
            document.getElementById('sag-chat-url-go').onclick = function () { var v = document.getElementById('sag-chat-url').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', '페이지 내용을 가져오는 중...');
          {
            var urlRes = await window._VAGSource.fetchUrl(srcUrl);
            if (urlRes.ok) { _sagSourceContent = urlRes.text; _addMsg('ai', '<span style="color:#34c759;">가져오기 완료 (' + urlRes.text.length + '자)</span>'); }
            else { _addMsg('ai', '<span style="color:#ff3b30;">' + _esc(urlRes.error) + '</span>'); }
          }
        } else if (sourceMethod === '직접 입력') {
          _addMsg('ai', '소재를 직접 입력하세요.');
          await new Promise(function (resolve) {
            var body = document.getElementById('sag-chat-body');
            var w = document.createElement('div');
            w.style.cssText = 'padding:4px 0;';
            w.innerHTML = '<textarea id="sag-chat-direct" rows="4" placeholder="SNS에 넣을 내용..." style="width:100%;' + _inputStyle() + 'resize:vertical;line-height:1.5;"></textarea><button id="sag-chat-direct-go" style="margin-top:4px;padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>';
            body.appendChild(w);
            document.getElementById('sag-chat-direct-go').onclick = function () { var v = document.getElementById('sag-chat-direct').value.trim(); if (v) { w.remove(); _addMsg('user', v.length > 100 ? v.slice(0, 100) + '...' : v); _sagSourceContent = v; resolve(v); } };
          });
        }
        if (_sagSourceContent) _addMsg('ai', '소재 준비 완료 (' + _sagSourceContent.length + '자)' + _sourcePreview('소재 반영 내용', _sagSourceContent));
      }

      // 4. 플랫폼 선택
      _addMsg('ai', '어떤 플랫폼용 글을 만들까요?');
      var platformSel = await new Promise(function (resolve) {
        _addOptions(['Threads + X 동시', 'Threads만', 'X(Twitter)만'], resolve);
      });
      var platformMap = {'Threads + X 동시':'both','Threads만':'threads','X(Twitter)만':'twitter'};
      var platform = platformMap[platformSel] || 'both';
      document.getElementById('sag-platform').value = platform;

      // 5. 톤 선택
      _addMsg('ai', '어떤 톤으로 작성할까요?');
      var toneSel = await new Promise(function (resolve) {
        _addOptions(['내 문체', '친근한', '전문적', '캐주얼', '유머러스'], resolve);
      });
      var toneMap = {'친근한':'friendly','전문적':'professional','캐주얼':'casual','유머러스':'humorous','내 문체':'mystyle'};
      var tone = toneMap[toneSel] || 'mystyle';
      document.getElementById('sag-tone').value = tone;

      // 6. 길이 선택
      _addMsg('ai', '글 길이는?');
      var lenSel = await new Promise(function (resolve) {
        _addOptions(['짧게', '보통', '길게'], resolve);
      });
      var lenMap = {'짧게':'short','보통':'medium','길게':'long'};
      var length = lenMap[lenSel] || 'medium';
      document.getElementById('sag-length').value = length;

      // 생성!
      await _doGenerate(topic, _sagSourceContent, platform, tone, length);

    } catch (flowErr) {
      console.error('[SAG] flow error:', flowErr);
      _addMsg('ai', '<span style="color:#ff3b30;">오류: ' + _esc(flowErr.message) + '<br>다시 시도해주세요.</span>');
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }

  /* ── 실제 생성 ── */
  async function _doGenerate(topic, source, platform, tone, length) {
    _addMsg('ai', 'SNS 글을 생성 중입니다...');
    var btn = document.getElementById('sag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }

    var profileId = parseInt(window._globalProfileId || 0);

    try {
      // Threads 생성
      var threadsText = '';
      if (platform === 'both' || platform === 'threads') {
        var tRes = await fetch('/api/content/generate-sns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topic || '', source_text: source || '', platform: 'threads', profile_id: profileId, tone: tone, threads_length: length, threads_mode: 'auto' }),
        });
        var tData = await tRes.json();
        threadsText = tData.threads?.text || tData.text || '';
      }
      // X 생성
      var twitterText = '';
      if (platform === 'both' || platform === 'twitter') {
        var xRes = await fetch('/api/content/generate-sns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topic || '', source_text: source || '', platform: 'twitter', profile_id: profileId, tone: tone, twitter_length: length }),
        });
        var xData = await xRes.json();
        twitterText = xData.twitter?.text || xData.text || '';
      }
      if (!twitterText && threadsText) twitterText = threadsText.slice(0, 250);

      if (threadsText || twitterText) {
        _sagResult = { threads_text: threadsText, twitter_text: twitterText || threadsText };
        var cb = document.getElementById('sag-chat-body');
        if (cb && cb.lastChild) cb.removeChild(cb.lastChild);
	        _addMsg('ai', '<b>SNS 글 생성 완료!</b> 수정 후 복사해서 사용하세요.');

        var resultEl = document.getElementById('sag-result');
        if (resultEl) resultEl.style.display = 'block';
        // ===SPLIT=== 를 표시용 줄바꿈으로 변환
        var displayThreads = threadsText.replace(/\s*===SPLIT===\s*/g, '\n\n');
        document.getElementById('sag-threads-text').value = displayThreads;
        document.getElementById('sag-twitter-text').value = twitterText || displayThreads.slice(0, 250);
        _sagRenderThreadSegments(displayThreads);
        var twStatus = document.getElementById('sag-twitter-status');
        var twText = twitterText || displayThreads.slice(0, 250);
        if (twStatus) twStatus.textContent = twText.length + '자';

        // 히스토리 저장
        try {
          await fetch('/api/sag/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: topic || '', threads_text: threadsText, twitter_text: twitterText || threadsText, industry: window._globalProfileData?.business_type || '', profile_name: window._globalProfileData?.name || '', profile_id: parseInt(window._globalProfileId || 0) }) });
        } catch (e) { /* ignore */ }
      } else {
        var cb2 = document.getElementById('sag-chat-body');
        if (cb2 && cb2.lastChild) cb2.removeChild(cb2.lastChild);
        _addMsg('ai', '<span style="color:#ff3b30;">생성 실패: 결과 없음</span>');
      }
    } catch (e) {
      var cb3 = document.getElementById('sag-chat-body');
      if (cb3 && cb3.lastChild) cb3.removeChild(cb3.lastChild);
      _addMsg('ai', '<span style="color:#ff3b30;">오류: ' + _esc(e.message) + '</span>');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg> AI로 시작하기'; }
  }

  /* ── 스레드 분할 (워크스페이스와 동일) ── */
  function _sagSplitThreads(text) {
    var clean = String(text || '').replace(/\r/g, '').trim();
    if (!clean) return [];
    // 워크스페이스 함수 직접 사용 (400자 기준)
    if (typeof splitThreadsPostText === 'function') {
      var result = splitThreadsPostText(clean, 400);
      if (result.length > 1) return result;
    }
    // 빈 줄 2개로 분할
    var paragraphs = clean.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (paragraphs.length > 1) {
      var final = [];
      paragraphs.forEach(function (p) {
        if (p.length <= 400) { final.push(p); }
        else if (typeof splitThreadsPostText === 'function') { final.push.apply(final, splitThreadsPostText(p, 400)); }
        else { final.push(p); }
      });
      return final.filter(Boolean);
    }
    if (clean.length <= 400) return [clean];
    // 400자 초과: 문장 단위로 분할
    var sentences = clean.split(/(?<=[.!?。！？다요])\s+/).filter(Boolean);
    if (sentences.length <= 1) return [clean.slice(0, 400), clean.slice(400)].filter(Boolean);
    var chunks = [];
    var cur = '';
    sentences.forEach(function (s) {
      if (!cur) { cur = s; }
      else if ((cur + ' ' + s).length <= 400) { cur += ' ' + s; }
      else { chunks.push(cur); cur = s; }
    });
    if (cur) chunks.push(cur);
    return chunks.filter(Boolean);
  }

  /* ── 브라우저 연결 체크 ── */
  async function _sagCheckBrowser(statusEl) {
    try {
      console.log('[SAG] 브라우저 연결 체크...');
      var resp = await fetch('/api/browser/status');
      var data = await resp.json();
      console.log('[SAG] browser/status:', JSON.stringify(data));
      if (!data.connected) {
        console.log('[SAG] 미연결 → 설치 안내');
        if (statusEl) statusEl.innerHTML = '<span style="color:#ff3b30;">Chrome 확장 프로그램이 연결되지 않았습니다.</span>';
        if (typeof window.showChromeExtensionGuide === 'function') window.showChromeExtensionGuide();
        return false;
      }
      console.log('[SAG] 연결 OK → 게시 진행');
      return true;
    } catch (e) { console.error('[SAG] 체크 실패:', e); return true; }
  }

  /* ── 게시 ── */
  async function sagPost(platform) {
    var text = document.getElementById(platform === 'threads' ? 'sag-threads-text' : 'sag-twitter-text')?.value || '';
    if (!text) return;
    var status = document.getElementById('sag-' + platform + '-status');
    var profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { if (status) status.innerHTML = '<span style="color:#ff3b30;">프로필을 먼저 선택하세요</span>'; return; }
    if (!(await _sagCheckBrowser(status))) return;
    if (status) { status.textContent = '게시 중...'; status.style.color = '#ff8c00'; }
    try {
      var resp;
      if (platform === 'threads') {
        var segments = _sagSplitThreads(text);
        if (status) status.textContent = segments.length > 1 ? segments.length + '개 이어쓰기로 게시 중...' : '게시 중...';
        resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, segments: segments, images: [], profile_id: profileId }) });
      } else {
        resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, images: [], profile_id: profileId }) });
      }
      var data = await resp.json();
      if (data.ok || data.success || data.post_url) {
        var segs = platform === 'threads' ? _sagSplitThreads(text) : [];
        if (status) { status.textContent = '게시 완료!' + (segs.length > 1 ? ' (' + segs.length + '개 이어쓰기)' : ''); status.style.color = '#34c759'; }
      } else { if (status) { status.textContent = data.error || data.detail || '실패'; status.style.color = '#ff3b30'; } }
    } catch (e) { if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; } }
  }

  /* ── 히스토리 ── */
  async function sagHistoryInit() {
    var root = document.getElementById('sns-agent-history-root');
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      var resp = await fetch('/api/sag/history');
      var data = await resp.json();
      if (!data.ok || !data.items?.length) { root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 SNS 글이 없습니다</div>'; return; }
      window._sagHistoryItems = data.items;
      root.innerHTML = data.items.map(function (item, hi) { return '\
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;">\
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">\
            <div>\
              <div style="display:flex;align-items:center;gap:6px;">\
                ' + (item.profile_id ? '<img src="/api/library/profiles/' + item.profile_id + '/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display=\'none\'">' : '') + '\
                <div style="font-size:14px;font-weight:700;color:#1c1c1e;">' + _esc(item.topic || 'SNS 글') + '</div>\
              </div>\
              <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">' + (item.profile_name ? _esc(item.profile_name) + ' \xB7 ' : '') + _esc(item.created || '') + '</div>\
            </div>\
            <button onclick="sagHistoryDelete(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>\
          </div>\
          <div style="background:rgba(0,0,0,0.02);border-radius:10px;padding:10px;margin-bottom:8px;">\
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">\
              <b style="font-size:11px;">@ Threads</b>\
              <div style="display:flex;gap:4px;">\
                <button onclick="navigator.clipboard.writeText(document.getElementById(\'sag-ht-' + hi + '\').value);this.textContent=\'\uBCF5\uC0AC\uB428!\';setTimeout(()=>this.textContent=\'\uBCF5\uC0AC\',1000)" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:#fff;font-size:9px;cursor:pointer;">복사</button>\
                <button onclick="sagHistorySave(' + hi + ')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">저장</button>\
              </div>\
            </div>\
            <textarea id="sag-ht-' + hi + '" rows="4" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.5;" oninput="sagRefreshHistoryThreadSegments(' + hi + ')" onfocus="this.style.borderColor=\'#ff8c00\'" onblur="this.style.borderColor=\'rgba(0,0,0,0.06)\'">' + _esc(item.threads_text || '') + '</textarea>\
            <div id="sag-ht-split-status-' + hi + '" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;"></div>\
            <div id="sag-ht-segments-' + hi + '" style="display:none;flex-direction:column;gap:8px;margin-top:10px;"></div>\
          </div>\
          <div style="background:rgba(29,161,242,0.04);border-radius:10px;padding:10px;">\
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">\
              <b style="font-size:11px;">X (Twitter)</b>\
              <div style="display:flex;gap:4px;">\
                <button onclick="navigator.clipboard.writeText(document.getElementById(\'sag-hx-' + hi + '\').value);this.textContent=\'\uBCF5\uC0AC\uB428!\';setTimeout(()=>this.textContent=\'\uBCF5\uC0AC\',1000)" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:#fff;font-size:9px;cursor:pointer;">복사</button>\
                <button onclick="sagHistorySave(' + hi + ')" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">저장</button>\
              </div>\
            </div>\
            <textarea id="sag-hx-' + hi + '" rows="3" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.5;" onfocus="this.style.borderColor=\'#1da1f2\'" onblur="this.style.borderColor=\'rgba(0,0,0,0.06)\'">' + _esc(item.twitter_text || '') + '</textarea>\
          </div>\
          <span id="sag-h-status-' + hi + '" style="font-size:10px;color:rgba(0,0,0,0.3);display:block;margin-top:4px;"></span>\
        </div>';
      }).join('');
      data.items.forEach(function (item, hi) {
        _sagRenderHistoryThreadSegments(hi, item.threads_text || '');
      });
    } catch (e) { root.innerHTML = '<div style="text-align:center;padding:40px;color:#ff3b30;">오류: ' + e.message + '</div>'; }
  }

  async function sagHistorySave(hi) {
    var item = (window._sagHistoryItems || [])[hi];
    if (!item?.folder) return;
    var newThreads = document.getElementById('sag-ht-' + hi)?.value || '';
    var newTwitter = document.getElementById('sag-hx-' + hi)?.value || '';
    var status = document.getElementById('sag-h-status-' + hi);
    try {
      await fetch('/api/sag/save-edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder, threads_text: newThreads, twitter_text: newTwitter }) });
      item.threads_text = newThreads;
      item.twitter_text = newTwitter;
      if (status) { status.textContent = '저장됨!'; status.style.color = '#34c759'; setTimeout(function () { if (status) status.textContent = ''; }, 2000); }
    } catch (e) { if (status) { status.textContent = '저장 실패'; status.style.color = '#ff3b30'; } }
  }

  async function sagHistoryPost(hi, platform) {
    var item = (window._sagHistoryItems || [])[hi];
    if (!item) return;
    var text = platform === 'threads' ? (document.getElementById('sag-ht-' + hi)?.value || item.threads_text) : (document.getElementById('sag-hx-' + hi)?.value || item.twitter_text);
    var status = document.getElementById('sag-h-status-' + hi);
    var profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { if (status) status.innerHTML = '<span style="color:#ff3b30;">프로필을 선택하세요</span>'; return; }
    if (!(await _sagCheckBrowser(status))) return;
    try {
      var resp;
      if (platform === 'threads') {
        var segments = _sagSplitThreads(text);
        if (status) { status.textContent = segments.length > 1 ? segments.length + '개 이어쓰기로 게시 중...' : 'Threads 게시 중...'; status.style.color = '#ff8c00'; }
        resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, segments: segments, images: [], profile_id: profileId }) });
      } else {
        if (status) { status.textContent = 'X 게시 중...'; status.style.color = '#ff8c00'; }
        resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text, images: [], profile_id: profileId }) });
      }
      var data = await resp.json();
      if (data.ok || data.success || data.post_url) {
        var segs = platform === 'threads' ? _sagSplitThreads(text) : [];
        if (status) { status.textContent = platform + ' 게시 완료!' + (segs.length > 1 ? ' (' + segs.length + '개 이어쓰기)' : ''); status.style.color = '#34c759'; }
      } else { if (status) { status.textContent = data.error || '실패'; status.style.color = '#ff3b30'; } }
    } catch (e) { if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; } }
  }

  async function sagHistoryDelete(hi) {
    var item = (window._sagHistoryItems || [])[hi];
    if (!item?.folder) return;
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch('/api/sag/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder }) });
    sagHistoryInit();
  }

  function sagRestart() {
    _sagSourceContent = '';
    _sagResult = null;
    window._sharedSourceContent = '';
    const root = document.getElementById('sns-agent-root');
    if (root) _renderLayout(root);
  }

  /* ── 전역 ── */
  window.sagInit = sagInit;
  window.sagHistoryInit = sagHistoryInit;
  window.sagGenerate = sagGenerate;
  window.sagRestart = sagRestart;
  window.sagRefreshThreadSegments = sagRefreshThreadSegments;
  window.sagCopyThreadSegment = sagCopyThreadSegment;
  window.sagRefreshHistoryThreadSegments = sagRefreshHistoryThreadSegments;
  window.sagCopyHistoryThreadSegment = sagCopyHistoryThreadSegment;
  window.sagPost = sagPost;
  window.sagHistorySave = sagHistorySave;
  window.sagHistoryPost = sagHistoryPost;
  window.sagHistoryDelete = sagHistoryDelete;
})();
