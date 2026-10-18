/**
 * video_agent/chat.js
 * 영상 에이전트 (chat 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  V.vagInit = function vagInit() {
    const root = document.getElementById('video-agent-root');
    if (!root) return;
    V._renderLayout(root);
    V._vagResetWorkspace();
    var resumeCheckpoint = (typeof V._vagLoadCheckpoint === 'function') ? V._vagLoadCheckpoint() : null;
    if (resumeCheckpoint && resumeCheckpoint.html) {
      window._vagAutoStarted = true;
      setTimeout(function () {
        if (typeof V._vagOfferCheckpointResume === 'function') V._vagOfferCheckpointResume(resumeCheckpoint);
      }, 120);
      return;
    }
    // HF 카탈로그 미리 로드 (스타일 드롭다운에 사용)
    if (!window._vagHfCatalog) {
      fetch('/api/hyperframes/hf-templates').then(r => r.json()).then(d => {
        if (d && d.ok) window._vagHfCatalog = { blocks: d.blocks||[], examples: d.examples||[], components: d.components||[] };
      }).catch(function(){});
    }
    // 🚀 진입 즉시 대화 시작 (버튼 클릭 불필요). 영상이 이미 있으면 스킵.
    setTimeout(() => {
      if (window._vagAutoStarted) return;
      if (V._vagResult || V._vagHyperHtml) return; // 이미 생성된 결과 있으면 스킵
      window._vagAutoStarted = true;
      try { V.vagGenerate(); } catch (e) { console.warn('[vag] auto start failed', e); }
    }, 300);
  }

  // 레이아웃 HTML 은 static/modules/video_agent_layout.js 의 window._VAGLayout.render 로 이관.
  // 기존 호출부(vagInit 안 `_renderLayout(root)`) 를 그대로 두기 위해 얇은 alias 로 연결.
  V._renderLayout = function _renderLayout(root) {
    if (window._VAGLayout && typeof window._VAGLayout.render === 'function') {
      window._VAGLayout.render(root);
    }
  }
  V._vagOfferCheckpointResume = function _vagOfferCheckpointResume(checkpoint) {
    var body = document.getElementById('vag-chat-body');
    if (!body) return;
    V._addMsg('ai',
      '<b>이전에 멈춘 영상이 있습니다.</b><br>' +
      '<span style="font-size:12px;color:rgba(0,0,0,0.55);">저장 위치: ' + V._esc(checkpoint.stage || '중간 단계') + ' · ' + V._esc((checkpoint.savedAt || '').slice(0, 19).replace('T', ' ')) + '</span>',
      { html: true }
    );
    var wrap = document.createElement('div');
    wrap.className = 'vag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    [
      ['이어서 하기', function () { if (V._vagResumeLastCheckpoint) V._vagResumeLastCheckpoint(); }],
      ['새로 만들기', function () { try { localStorage.removeItem('makeke:vag:lastCheckpoint'); } catch (_) {} V.vagGenerate(); }],
    ].forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item[0];
      btn.style.cssText = 'padding:8px 15px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:800;cursor:pointer;';
      btn.onclick = function () {
        body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
        V._addMsg('user', item[0]);
        item[1]();
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  V.vagStartCardnewsFlow = async function vagStartCardnewsFlow() {
    var chatBody = document.getElementById('vag-chat-body');
    if (chatBody) chatBody.innerHTML = '';
    var resultEl = document.getElementById('vag-result');
    if (resultEl) resultEl.style.display = 'none';
    V._vagResetWorkspace();
    V._addMsg('ai', '영상으로 바꿀 카드뉴스를 골라주세요.');
    var selectedCardnews = await _vagPickCardnewsHistory();
    if (selectedCardnews === '__open_cardnews__') {
      V._addMsg('ai', '카드뉴스 에이전트로 이동합니다.');
      _vagOpenCardnewsAgent();
      return;
    }
    if (!selectedCardnews) {
      V._addMsg('ai', '카드뉴스 선택이 취소되었습니다.');
      return;
    }
    await _vagGenerateFromCardnews(selectedCardnews);
  }

  /* ── 채팅 ── */
  V._showTyping = function _showTyping() {
    const body = document.getElementById('vag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    const ti = document.createElement('div');
    ti.className = 'typing-indicator';
    ti.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;';
    ti.innerHTML = '<div style="display:flex;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.4s infinite;"></span></div><span style="font-size:12px;color:rgba(0,0,0,0.3);">AI가 생각하고 있어요...</span>';
    body.appendChild(ti);
    body.scrollTop = body.scrollHeight;
  }

  V._addMsg = function _addMsg(role, html, options) {
    var body = document.getElementById('vag-chat-body');
    if (!body) return;
    var displayHtml = typeof V._vagHumanizeText === 'function' ? V._vagHumanizeText(html) : html;
    var empty = document.getElementById('vag-chat-empty');
    if (empty) empty.remove();
    var isAi = role === 'ai';
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:' + (isAi ? 'flex-start' : 'flex-end') + ';';
    div.innerHTML = '<div style="max-width:85%;padding:10px 14px;border-radius:' + (isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px') + ';background:' + (isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)') + ';color:' + (isAi ? '#1c1c1e' : '#fff') + ';font-size:13px;line-height:1.6;">' + displayHtml + '</div>';
    // 타이핑 인디케이터 제거
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    body.appendChild(div);
    var panel = document.getElementById('vag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    V._vagPersistMessage(role, displayHtml, options);
  }

  V._addOptions = function _addOptions(options, callback) {
    var body = document.getElementById('vag-chat-body');
    if (!body) return;
    // ⚡ 완전 자동 모드: 사용자의 질문 응답을 우회하고 가장 적절한 기본값을 자동 선택
    if (window._vagAutoChoices && window._vagAutoChoices.fullAuto && !window._vagAutoChoices.pauseForManualOption) {
      var picked = V._vagAutoPickOption(options);
      if (picked !== null) {
        setTimeout(function () {
          V._addMsg('user', picked + ' <span style="font-size:10px;opacity:0.7;">⚡ 자동</span>');
          callback(picked);
        }, 450);
        return;
      }
    }
    var wrap = document.createElement('div');
    wrap.className = 'vag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      var displayOpt = typeof V._vagHumanizeText === 'function' ? V._vagHumanizeText(opt) : opt;
      btn.textContent = displayOpt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;';
      btn.onclick = function () { body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); }); V._addMsg('user', displayOpt); callback(opt); };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
  }

  // 완전 자동 모드용 — 옵션 배열에서 가장 적절한 선택지 1개 반환
  // 목적: 사용자가 "모델만 선택하고 AI 알아서" 를 눌렀을 때 모든 질문을 끊김 없이 통과
  V._vagAutoPickOption = function _vagAutoPickOption(options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    // ① 사용자가 프리셋에서 고정한 비율이 있으면 최우선
    var forced = (window._vagAutoChoices || {}).forcedAspect;
    if (forced) {
      var aspectKeywords = /\b(9:16|1:1|16:9)\b|세로|정사각|가로/;
      var looksLikeAspectQuestion = options.some(function (o) { return aspectKeywords.test(String(o)); });
      if (looksLikeAspectQuestion) {
        var match = options.find(function (o) {
          if (forced.indexOf('9:16') >= 0) return /9:16|세로|릴스|숏츠/.test(String(o));
          if (forced.indexOf('1:1') >= 0) return /1:1|정사각/.test(String(o));
          if (forced.indexOf('16:9') >= 0) return /16:9|가로/.test(String(o));
          return false;
        });
        if (match) return match;
      }
    }
    // ② 사용자가 프리셋에서 고정한 엔진이 있으면 엔진 선택 질문에서 최우선
    var forcedModel = (window._vagAutoChoices || {}).forcedModel;
    var imageBgKeywords = /AI\s*이미지|이미지\s*배경|배경\s*컨셉|나노바나나|Qwen|Image\s*(?:2|Edit)|Codex\s*CLI\s*직접\s*이미지|사용\s*안\s*함/i;
    var looksLikeImageBackgroundQuestion = options.filter(function (o) { return imageBgKeywords.test(String(o)); }).length >= 2;
    if (looksLikeImageBackgroundQuestion) {
      var forcedImageMode = String((window._vagAutoChoices || {}).aiBgVideo || 'auto');
      var imageModeMatch = options.find(function (o) {
        var s = String(o);
        if (forcedImageMode === 'codex-cli') return /Codex\s*CLI\s*직접\s*이미지/i.test(s);
        if (forcedImageMode === 'gpt-image-2-edit') return /OpenAI\s*Image\s*2|GPT\s*Image\s*2/i.test(s);
        if (forcedImageMode === 'qwen-product-edit') return /Qwen\s*상품|상품\s*이미지/i.test(s);
        if (forcedImageMode === 'qwen-image-2-pro-edit') return /Qwen\s*Image\s*2\.0\s*Pro/i.test(s);
        if (forcedImageMode === 'nano-banana-2-edit') return /참고\s*이미지\s*생성|나노바나나2\s*참고/i.test(s);
        if (forcedImageMode === 'nano-banana-2-text' || forcedImageMode === 'scene-image') return /나노바나나2\s*이미지\s*생성|텍스트\s*이미지/i.test(s);
        if (forcedImageMode === 'none') return /사용\s*안\s*함/i.test(s);
        return /AI\s*자동\s*선택|AI\s*자동/i.test(s);
      });
      if (imageModeMatch) return imageModeMatch;
    }
    var forcedOutputMode = String((window._vagAutoChoices || {}).outputMode || (window._vagAutoPrefs || {}).outputMode || '');
    var outputKeywords = /짧은\s*영상|영상으로\s*바꾸|영상으로\s*움직|이미지는\s*그대로|문구\s*넣기|배경\s*이미지만|영상\s*파일/i;
    var looksLikeOutputModeQuestion = options.filter(function (o) { return outputKeywords.test(String(o)); }).length >= 2;
    if (looksLikeOutputModeQuestion) {
      var outputMatch = options.find(function (o) {
        var s = String(o);
        if (forcedOutputMode === 'image-only') return /이미지만|영상\s*파일은\s*만들지/i.test(s);
        if (forcedOutputMode === 'motion') return /그대로|문구\s*넣기|화면\s*효과/i.test(s) && !/짧은\s*영상|영상으로\s*바꾸|영상으로\s*움직/i.test(s);
        return /짧은\s*영상|영상으로\s*바꾸|영상으로\s*움직/i.test(s);
      });
      if (outputMatch) return outputMatch;
    }
    if (forcedModel) {
      var engineKeywords = /Gemini|Claude\s*Code|Codex|Kimi/i;
      var looksLikeEngineQuestion = options.filter(function (o) { return engineKeywords.test(String(o)); }).length >= 2;
      if (looksLikeEngineQuestion) {
        var engineMatch = options.find(function (o) {
          var s = String(o);
          if (forcedModel === 'gemini') return /Gemini/i.test(s);
          if (forcedModel === 'claude') return /Claude/i.test(s);
          if (forcedModel === 'codex')  return /Codex/i.test(s);
          if (forcedModel === 'kimi')   return /Kimi/i.test(s);
          if (String(forcedModel).indexOf('atlas:') === 0) return /Atlas\s*Cloud/i.test(s);
          return false;
        });
        if (engineMatch) return engineMatch;
      }
    }
    // ③ 사용자가 프리셋에서 고정한 길이가 있으면 영상 길이 질문에서 최우선
    var forcedLen = (window._vagAutoChoices || {}).forcedLenLabel;
    if (forcedLen) {
      var lenKeywords = /(\d+\s*초|\d+\s*분|짧게|표준|풀\s*1분|길게\s*90|장편)/;
      var lenMatches = options.filter(function (o) { return lenKeywords.test(String(o)); }).length;
      if (lenMatches >= 3) {
        var lenMatch = options.find(function (o) {
          var s = String(o);
          if (forcedLen === 'sec15') return /15\s*초|짧게\s*15/.test(s);
          if (forcedLen === 'sec30') return /30\s*초|표준\s*30/.test(s);
          if (forcedLen === 'sec45') return /45\s*초/.test(s);
          if (forcedLen === 'min1') return /풀\s*1분|60\s*초|1분\s*\(60/.test(s);
          if (forcedLen === 'min2') return /장편\s*2분|2분/.test(s);
          if (forcedLen === 'min3') return /장편\s*3분|3분/.test(s);
          if (forcedLen === 'min5') return /장편\s*5분|5분/.test(s);
          if (forcedLen === 'min10') return /장편\s*10분|10분/.test(s);
          if (forcedLen === 'short') return /짧게\s*15|15\s*초(?!.*\d)/.test(s);
          if (forcedLen === 'mid') return /표준\s*30|30\s*초/.test(s);
          if (forcedLen === 'long') return /풀\s*1분|60\s*초|1분\s*\(60/.test(s);
          return false;
        });
        if (lenMatch) return lenMatch;
      }
    }
    var forcedVoice = (window._vagAutoChoices || {}).forcedVoice;
    if (typeof forcedVoice !== 'undefined') {
      var voiceNames = (V._vagTTSVoices || []).map(function (voice) {
        return String(voice.value || '').replace(/^gemini-/, '');
      }).filter(Boolean);
      var voiceKeywords = new RegExp((voiceNames.length ? voiceNames.join('|') : 'Kore|Aoede|Charon|Fenrir|Puck') + '|나레이션\\s*없음', 'i');
      var looksLikeVoiceQuestion = options.filter(function (o) { return voiceKeywords.test(String(o)); }).length >= 2;
      if (looksLikeVoiceQuestion) {
        var forcedName = String(forcedVoice || '').replace(/^gemini-/, '');
        var voiceMatch = options.find(function (o) {
          var s = String(o);
          if (!forcedVoice) return /나레이션\s*없음|OFF|무음/i.test(s);
          return new RegExp(forcedName, 'i').test(s);
        });
        if (voiceMatch) return voiceMatch;
      }
      var narrationKeywords = /나레이션\s*ON|나레이션\s*OFF/i;
      var looksLikeNarrationQuestion = options.filter(function (o) { return narrationKeywords.test(String(o)); }).length >= 2;
      if (looksLikeNarrationQuestion) {
        var narrationMatch = options.find(function (o) {
          return forcedVoice ? /나레이션\s*ON/i.test(String(o)) : /나레이션\s*OFF/i.test(String(o));
        });
        if (narrationMatch) return narrationMatch;
      }
    }
    // 각 옵션을 우선순위 스코어로 매겨 가장 높은 걸 선택
    // 기준: (1) 마케팅 영상 기본 의도에 맞는 옵션, (2) 가장 "안전"한 기본값
    var keywordRules = [
      // 긍정 키워드 (우선)
      { pat: /광고\s*전환/,          score: 100, reason: '기본 마케팅 목적' },
      { pat: /9:16|세로|릴스|숏츠/,   score: 100, reason: '숏폼 기본 비율' },
      { pat: /나레이션\s*ON/,         score: 100, reason: '음성 포함 기본' },
      { pat: /BGM\s*작게\s*\(10/,     score: 100, reason: '나레이션 침해 없는 볼륨' },
      { pat: /빠른\s*단일\s*생성/,    score: 100, reason: '자동 모드 — 가장 빠른 단일 경로' },
      { pat: /감독모드/,              score: 80,  reason: '감독 브리프 — 빠른 단일이 없을 때 대안' },
      { pat: /^AI\s*자동$|AI\s*자동/i, score: 96, reason: 'AI가 맥락에 맞게 판단' },
      { pat: /직설/,                  score: 60,  reason: '수동 톤 후보' },
      { pat: /방문\s*유도|상담\s*문의/, score: 90,  reason: '일반 업종용 안전 CTA' },
      { pat: /지금\s*구매|지금\s*예약/, score: 85, reason: '전환 중심 CTA' },
      { pat: /프로필\s*로고/,         score: 95,  reason: '프로필 로고 자동 사용' },
      { pat: /프로필\s*색(?:상)?/,    score: 95,  reason: '프로필 브랜드 색 자동 사용' },
      { pat: /넣기.*로고|넣기.*CTA/,  score: 90,  reason: '엔드카드 기본' },
      { pat: /🤖\s*AI\s*자동\s*수집/,  score: 10,  reason: '자료 수집은 사용자가 원할 때만' },
      { pat: /AI\s*로\s*보강/,        score: 90,  reason: '자료 보강 자동' },
      { pat: /AI\s*자동(?!\s*수집)/,  score: 96,  reason: 'AI 자동 결정 위임' },
      // 자동 모드에서 인터랙션(모달·파일 선택) 을 유발하는 옵션은 약한 마이너스, 건너뛰기는 약한 플러스
      { pat: /소재\s*없이\s*진행|조사\s*없이|조사\s*안\s*함|건너뛰기|skip/i, score: 120, reason: '기본값 — 조사 없이 진행' },
      // 부정 키워드 (회피)
      { pat: /↩|취소|중단/,           score: -100, reason: '자동 모드에서 취소 안 함' },
      { pat: /생략|OFF|빼기|없음|없이/, score: -50,  reason: '기능 생략 — 자동 모드 기본 아님' },
      { pat: /직접\s*입력/,           score: -30,  reason: '추가 입력 요구 — 자동 모드 피함' },
      { pat: /📁\s*파일\s*업로드|파일\s*업로드|이미지\s*첨부/, score: -80, reason: '파일 다이얼로그 — 자동 모드 절대 피함' },
      { pat: /로고\s*없이\s*진행/, score: 20, reason: '로고 파일 없으면 진행 우선' },
      // 뉴스·URL·긴 텍스트 수동 입력 채널도 자동 모드에서 피함 (자료 먼저 경로 내부 선택지)
      { pat: /📰\s*뉴스\s*검색|🔗\s*URL\s*가져오기|✏️\s*직접\s*입력/, score: -40, reason: '수동 자료 입력 — 자동 모드 피함' },
    ];
    var best = { index: 0, score: -Infinity, reason: '첫 번째 기본값' };
    options.forEach(function (opt, idx) {
      var s = 0;
      var matched = [];
      var optStr = String(opt);
      keywordRules.forEach(function (rule) {
        if (rule.pat.test(optStr)) {
          s += rule.score;
          matched.push(rule.reason);
        }
      });
      // 아무것도 매칭 안 됐고 첫 번째 옵션이면 약한 가산점 (기본값 폴백)
      if (s === 0 && idx === 0) s = 1;
      if (s > best.score) {
        best = { index: idx, score: s, reason: matched.join(', ') || '기본값' };
      }
    });
    return options[best.index];
  }

  V._vagShowProgress = async function _vagShowProgress(message, delayMs) {
    V._showTyping();
    await new Promise(function (resolve) { setTimeout(resolve, delayMs || 500); });
    V._addMsg('ai', '<span style="color:#ff8c00;">' + V._esc(message || '생성 중...') + '</span>');
  }

  // 컴포지션 생성 같은 장시간(수십 초~수 분) 작업 중 "무슨 일이 벌어지는지" 를
  // 사용자에게 보여주는 라이브 진행 위젯. 경과 시간 + 현재 단계 라벨을 1초마다 갱신.
  // 사용:
  //   var prog = _vagLiveProgress('AI HTML 생성 중', { eta: '약 60~240초' });
  //   prog.update('무결성 검증 중', { stage: 'code', detail: '...' });
  //   prog.stop('생성 완료');    // 완료 메시지로 고정
  //   prog.fail('생성 실패 …');  // 에러 메시지로 고정
  V._vagLiveProgress = function _vagLiveProgress(initialLabel, options) {
    var body = document.getElementById('vag-chat-body');
    if (!body) {
      return { update: function () {}, stop: function () {}, fail: function () {} };
    }
    var empty = document.getElementById('vag-chat-empty');
    if (empty) empty.remove();
    body.querySelectorAll('.typing-indicator').forEach(function (el) { el.remove(); });
    var opt = options || {};
    var startMs = Date.now();
    var currentLabel = initialLabel || '처리 중';
    var currentDetail = opt.detail || '';
    var etaHint = opt.eta || '';
    var attempt = opt.attempt || '';
    var wrap = document.createElement('div');
    wrap.className = 'vag-live-progress';
    wrap.style.cssText = 'display:flex;justify-content:flex-start;';
    var card = document.createElement('div');
    card.style.cssText = 'max-width:85%;padding:12px 14px;border-radius:4px 14px 14px 14px;background:linear-gradient(180deg,rgba(255,255,255,1),rgba(255,140,0,0.08));border:1px solid rgba(255,140,0,0.22);color:#8a4b00;font-size:13px;line-height:1.6;min-width:240px;';
    card.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span class="spinner" style="width:14px;height:14px;border:2px solid rgba(255,140,0,0.25);border-top-color:#ff8c00;border-radius:50%;display:inline-block;animation:vag-spin 0.8s linear infinite;flex-shrink:0;"></span>' +
        '<span data-vag-live-label style="font-weight:700;color:#8a4b00;"></span>' +
        '<span data-vag-live-attempt style="font-size:11px;font-weight:600;color:rgba(138,75,0,0.65);"></span>' +
        '<span data-vag-live-timer style="margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px;font-weight:700;color:#ff8c00;background:rgba(255,140,0,0.1);padding:2px 8px;border-radius:10px;">00:00</span>' +
      '</div>' +
      '<div data-vag-live-detail style="margin-top:6px;font-size:11.5px;color:rgba(138,75,0,0.72);line-height:1.5;"></div>' +
      '<div data-vag-live-eta style="margin-top:4px;font-size:11px;color:rgba(138,75,0,0.55);"></div>';
    wrap.appendChild(card);
    body.appendChild(wrap);
    var panel = document.getElementById('vag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 스피너 keyframes 1회 주입
    if (!document.getElementById('vag-spin-style')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'vag-spin-style';
      styleEl.textContent = '@keyframes vag-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(styleEl);
    }

    var labelEl = card.querySelector('[data-vag-live-label]');
    var attemptEl = card.querySelector('[data-vag-live-attempt]');
    var timerEl = card.querySelector('[data-vag-live-timer]');
    var detailEl = card.querySelector('[data-vag-live-detail]');
    var etaEl = card.querySelector('[data-vag-live-eta]');

    function _render() {
      labelEl.textContent = currentLabel;
      attemptEl.textContent = attempt || '';
      detailEl.textContent = currentDetail || '';
      detailEl.style.display = currentDetail ? 'block' : 'none';
      etaEl.textContent = etaHint ? '⏳ 예상 소요: ' + etaHint : '';
      etaEl.style.display = etaHint ? 'block' : 'none';
    }
    function _tick() {
      var s = Math.floor((Date.now() - startMs) / 1000);
      var mm = String(Math.floor(s / 60)).padStart(2, '0');
      var ss = String(s % 60).padStart(2, '0');
      timerEl.textContent = mm + ':' + ss;
    }
    _render();
    _tick();
    var intervalId = setInterval(_tick, 1000);

    var _finished = false;
    function _finish(finalLabel, tone, detail) {
      if (_finished) return;
      _finished = true;
      clearInterval(intervalId);
      var colorMap = {
        ok: { bg: 'linear-gradient(180deg,rgba(255,255,255,1),rgba(52,199,89,0.08))', border: 'rgba(52,199,89,0.25)', text: '#1f8f44', badge: 'rgba(52,199,89,0.12)' },
        err: { bg: 'linear-gradient(180deg,rgba(255,255,255,1),rgba(255,59,48,0.08))', border: 'rgba(255,59,48,0.25)', text: '#b42318', badge: 'rgba(255,59,48,0.12)' },
      };
      var c = colorMap[tone] || colorMap.ok;
      card.style.background = c.bg;
      card.style.borderColor = c.border;
      card.style.color = c.text;
      labelEl.textContent = finalLabel || currentLabel;
      labelEl.style.color = c.text;
      attemptEl.textContent = '';
      detailEl.textContent = detail || '';
      detailEl.style.color = c.text;
      detailEl.style.display = detail ? 'block' : 'none';
      etaEl.style.display = 'none';
      timerEl.style.background = c.badge;
      timerEl.style.color = c.text;
      // 스피너 → 체크/X 아이콘 교체
      var spinner = card.querySelector('.spinner');
      if (spinner) {
        spinner.style.animation = 'none';
        spinner.style.border = 'none';
        spinner.style.background = 'transparent';
        spinner.textContent = tone === 'err' ? '✕' : '✓';
        spinner.style.color = c.text;
        spinner.style.fontSize = '14px';
        spinner.style.fontWeight = '900';
        spinner.style.lineHeight = '14px';
        spinner.style.textAlign = 'center';
      }
    }

    return {
      update: function (label, o) {
        if (label) currentLabel = label;
        if (o && typeof o.detail !== 'undefined') currentDetail = o.detail;
        if (o && typeof o.eta !== 'undefined') etaHint = o.eta;
        if (o && typeof o.attempt !== 'undefined') attempt = o.attempt;
        _render();
      },
      stop: function (finalLabel, detail) { _finish(finalLabel || '완료', 'ok', detail || ''); },
      fail: function (finalLabel, detail) { _finish(finalLabel || '실패', 'err', detail || ''); },
    };
  }

  V._vagWait = function _vagWait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms || 0); });
  }

  V._vagBuildVariationDirections = function _vagBuildVariationDirections(topic, session, aspect) {
    var tone = ((session && session.tone) || '직설').trim();
    var objective = ((session && session.objective) || '광고 전환').trim();
    var aspectLabel = aspect === '16:9' ? '가로 광고' : aspect === '1:1' ? '정사각 피드' : '세로 숏폼';
    var directorMeta = session && session.directorMeta;
    var brief = directorMeta && directorMeta.creative_brief ? directorMeta.creative_brief : {};
    var outline = directorMeta && Array.isArray(directorMeta.scenes_outline) ? directorMeta.scenes_outline : [];
    var designs = V._vagBuildVariationDesigns(session, aspect, 3);
    return designs.map(function (pack, idx) {
      var sceneSlice = outline.slice(idx * 2, idx * 2 + 2).map(function (row) { return (row.style || 'style') + ' ' + (row.intent || ''); }).join(' / ');
      var parts = [
        pack.name + ' — ' + pack.note,
        '우선 HF 템플릿: ' + pack.hfTemplates.map(function (name) { return 'hf:' + name; }).join(', '),
        '이미지 전략: ' + pack.imageStrategy,
        '근거 씬 전략: ' + pack.proofStrategy,
        '브랜드 색 사용: ' + (pack.colorMode || '브랜드 색 중심'),
        '브랜드 락업: ' + (pack.logoMode || '브랜드 서명처럼 사용'),
      ];
      if (directorMeta) {
        parts.push('핵심 훅: ' + (brief.hook_strategy || '강한 문제 제기'));
        parts.push('핵심 인사이트: ' + (brief.core_insight || objective));
        if (sceneSlice) parts.push('씬 구성 힌트: ' + sceneSlice);
        else if (brief.narrative_arc) parts.push('서사: ' + brief.narrative_arc);
      } else {
        parts.push('광고 목표: ' + objective + ', 톤: ' + tone + ', 포맷: ' + aspectLabel);
      }
      parts.push('반드시 다른 변형과 명확히 구분되게 설계하고, 같은 hf 템플릿과 같은 이미지 연출을 반복하지 말 것.');
      return {
        key: pack.key,
        name: pack.name,
        direction: parts.join(' | '),
        hfTemplates: pack.hfTemplates.slice(),
        imageStrategy: pack.imageStrategy,
      };
    });
  }

  V._VAG_STRUCTURE_TREE = {
    '🎯 전환·설득': {
      '후크형': ['후크-핵심-CTA', '반전형', '선언문', '카운트다운'],
      '비교·증명형': ['Before/After', 'A vs B', '실험·증명', '오해 vs 진실', '데이터 쇼'],
      '제품 어필형': ['언박싱', '사용법 데모', '룩북', '카탈로그 쇼케이스'],
    },
    '📖 스토리·감성': {
      '내러티브': ['스토리형', "여정(Hero's Journey)", '드라마 티저', '창업 스토리'],
      '라이프·체험': ['하루 밀착', 'POV 체험', '회고·추억', '감성 에세이'],
      '내레이션': ['속마음 고백', '다큐 내레이션', '1인 독백'],
    },
    '💬 대화·증언': {
      '고객·리뷰': ['고객 목소리', '리액션 리뷰', '인터뷰 톤'],
      '문답': ['Q&A', 'FAQ', '고민 상담', '퀴즈'],
      '대화극': ['더미극(2인)', '상황극(쇼츠 스킷)', '라이브 토크'],
    },
    '📋 리스트·정보': {
      '랭킹·순서': ['랭킹 TOP-N', '투표·선택지', '카운트다운 랭킹'],
      '가이드·팁': ['체크리스트', '인사이트 퀵팁', 'TL;DR', '팁 압축'],
      '단계 설명': ['튜토리얼 step', '레시피', '사용법 데모'],
    },
    '🔥 분위기·무드': {
      '비주얼 쇼': ['몽타주', '타임랩스', '분할 화면', '슬로우모션'],
      '타이포·사운드': ['키네틱 타이포', 'ASMR', '뮤직비디오 톤', '반복 선언'],
      '밈·트렌드': ['밈 오마주', '광고 패러디', '챌린지 포맷'],
    },
    '🏢 브랜드·기업': {
      '철학·정체성': ['브랜드 철학', '창업 스토리(브랜드)', '비전 영상'],
      '팀·현장': ['직원·인물 소개', '제조 투어', '원산지 투어'],
      '공지·이벤트': ['뉴스 브리핑', '이벤트 카운트다운', '신제품 런칭'],
    },
  };

  // 구조 3단계 드릴다운 — 대분류 → 중분류 → 구체. 어느 단계에서든 AI 자동 선택 가능.
  V._vagPickStructure = async function _vagPickStructure() {
    var tree = V._VAG_STRUCTURE_TREE;
    V._addMsg('ai', '🎬 <b>영상 구조</b>를 골라주세요 (3단계로 좁혀갑니다).<br><span style="font-size:11px;color:rgba(0,0,0,0.55);">1단계 — 어떤 결의 영상인가요?</span>');
    var majorKeys = Object.keys(tree);
    var majorLabels = majorKeys.concat(['🤖 AI 알아서']);
    var major = await new Promise(function (resolve) { V._addOptions(majorLabels, resolve); });
    if (major === '🤖 AI 알아서') return { label: 'AI 자동 선택', major: '', sub: '', specific: '' };

    V._addMsg('ai', '2단계 — <b>' + V._esc(major) + '</b> 세부 방향:');
    var subMap = tree[major] || {};
    var subKeys = Object.keys(subMap);
    var subLabels = subKeys.concat(['🤖 AI 알아서']);
    var sub = await new Promise(function (resolve) { V._addOptions(subLabels, resolve); });
    var cleanMajor = major.replace(/^\S+\s/, '');
    if (sub === '🤖 AI 알아서') return { label: cleanMajor + ' · AI 선택', major: cleanMajor, sub: '', specific: '' };

    V._addMsg('ai', '3단계 — <b>' + V._esc(sub) + '</b> 구체 구조:');
    var specificArr = subMap[sub] || [];
    var specificLabels = specificArr.concat(['🤖 AI 알아서']);
    var specific = await new Promise(function (resolve) { V._addOptions(specificLabels, resolve); });
    if (specific === '🤖 AI 알아서') return { label: cleanMajor + ' · ' + sub + ' · AI 선택', major: cleanMajor, sub: sub, specific: '' };

    return { label: cleanMajor + ' · ' + sub + ' · ' + specific, major: cleanMajor, sub: sub, specific: specific };
  }

  V._vagPickSampleTemplate = async function _vagPickSampleTemplate(aspect) {
    try {
      var resp = await V._vagFetch('/api/hyperframes/sample-templates?aspect=' + encodeURIComponent(aspect || '9:16'));
      var data = await resp.json();
      var items = (data && data.ok && Array.isArray(data.items)) ? data.items.slice(0, 6) : [];
      if (!items.length) return '';
      V._addMsg('ai', 'HyperFrames 샘플 템플릿도 다시 쓸 수 있어요. 시작 템플릿을 고를까요?');
      var labels = items.map(function (item) { return '📦 ' + item.name; }).concat(['직접 생성으로 진행']);
      var choice = await new Promise(function (resolve) { V._addOptions(labels, resolve); });
      if (choice === '직접 생성으로 진행') return '';
      for (var i = 0; i < items.length; i++) {
        var label = '📦 ' + items[i].name;
        if (label === choice) {
          V._addMsg('ai', items[i].description || '샘플 구조를 유지한 채 텍스트만 브랜드에 맞게 교체합니다.');
          return items[i].id || '';
        }
      }
    } catch (e) {
      V._addMsg('ai', '<span style="color:#ff9500;">샘플 템플릿 목록을 불러오지 못해 직접 생성으로 진행합니다: ' + V._esc(e.message || e) + '</span>');
    }
    return '';
  }

  V._vagRenderNativeAsync = async function _vagRenderNativeAsync(payload, options) {
    var opts = options || {};
    var stageLabelMap = {
      queued: '렌더 접수',
      prepare: '프로젝트 정리',
      rendering: '프레임 렌더',
      encoding: 'MP4 인코딩',
      complete: '완료',
      failed: '실패',
    };
    V._vagShowRenderOverlay(opts.label || '🍊 최종 렌더 진행 중');
    V._vagUpdateRenderOverlay(
      opts.label || '🍊 최종 렌더 진행 중',
      opts.sub || '렌더 큐에 등록하고 있습니다.',
      0,
      'queued',
      opts.log || '렌더 요청을 전송했습니다.'
    );
    var startResp = await V._vagFetch('/api/hyperframes/render-native-async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var startData = await startResp.json();
    if (!startResp.ok || !startData.ok || !startData.jobId) {
      throw new Error(startData.detail || startData.error || '렌더 잡을 만들지 못했습니다.');
    }
    var jobId = startData.jobId;
    var seenLogs = 0;
    var lastStage = 'queued';
    var idleCycles = 0;
    function isNoisyRenderLog(message) {
      var lower = String(message || '').toLowerCase();
      return lower.indexOf('mapped fonts:') >= 0
        || lower.indexOf('to fix, pick one') >= 0
        || lower.indexOf('use a mapped font name') >= 0
        || lower.indexOf('see list above') >= 0
        || lower.indexOf('font_aliases') >= 0
        || lower.indexOf('injected deterministic @font-face') >= 0;
    }
    while (true) {
      await V._vagWait(1000);
      var statusResp = await V._vagFetch('/api/hyperframes/render-jobs/' + encodeURIComponent(jobId));
      var statusData = await statusResp.json();
      if (!statusResp.ok || !statusData.ok || !statusData.job) {
        throw new Error(statusData.detail || statusData.error || '렌더 진행 상태를 읽지 못했습니다.');
      }
      var job = statusData.job || {};
      var stage = job.stage || job.status || lastStage || 'queued';
      var progress = Number(job.progress || 0);
      var logs = Array.isArray(job.logs) ? job.logs : [];
      if (logs.length === seenLogs) {
        idleCycles += 1;
      } else {
        idleCycles = 0;
      }
      for (var i = seenLogs; i < logs.length; i++) {
        var entry = logs[i] || {};
        if (isNoisyRenderLog(entry.message || '')) continue;
        V._vagPushRenderOverlayLog(entry.message || '', entry.level === 'error' ? 'error' : (entry.level === 'success' ? 'success' : 'info'));
      }
      seenLogs = logs.length;
      lastStage = stage;
      V._vagSetRenderOverlayProgress(progress);
      V._vagSetRenderOverlayStage(stage, stageLabelMap[stage] || stage);
      if (idleCycles >= 5 && stage !== 'complete' && stage !== 'failed') {
        V._vagPushRenderOverlayLog('여전히 렌더 중입니다. 큰 장면이나 폰트 로드 때문에 시간이 더 걸릴 수 있습니다.', 'info');
        idleCycles = 0;
      }
      if (job.status === 'failed' || stage === 'failed') {
        throw new Error(job.error || '렌더 실패');
      }
      if (job.status === 'complete' || stage === 'complete') {
        V._vagPushRenderOverlayLog('렌더 파일이 준비되었습니다.', 'success');
        V._vagSetRenderOverlayProgress(100);
        V._vagSetRenderOverlayStage('complete', '완료');
        return {
          ok: true,
          path: job.outputPath,
          name: job.filename,
          url: job.outputUrl || (job.filename ? '/api/hyperframes/output/' + encodeURIComponent(job.filename) : ''),
        };
      }
    }
  }

  V._vagRunFollowupAction = async function _vagRunFollowupAction(action) {
    if (!V._vagSession) return;
    var next = Object.assign({}, V._vagSession);
    next.followupInstruction = '';

    if (action === 'cta') {
      next.followupInstruction = '마지막 2초 CTA를 더 크게, 더 직접적으로 강조하고 전환 유도 문구를 강하게 넣어줘.';
      V._addMsg('user', 'CTA를 더 강하게 해줘');
    } else if (action === 'event') {
      next.objective = '이벤트 홍보';
      next.tone = '긴급';
      next.followupInstruction = '기간 한정, 마감 임박, 혜택 소진 전 메시지를 전면에 배치해줘.';
      V._addMsg('user', '이벤트 긴급형으로 다시 만들어줘');
    } else if (action === 'review') {
      next.objective = '후기/신뢰 강조';
      next.followupInstruction = '후기 한 줄과 수치형 증거를 앞쪽에 배치하고 신뢰 중심으로 구성해줘.';
      V._addMsg('user', '후기와 신뢰를 강조한 버전으로 바꿔줘');
    } else if (action === 'wide') {
      next.aspect = '16:9';
      document.getElementById('vag-aspect').value = '16:9';
      next.hyperHtml = '';
      V._addMsg('user', '16:9 광고 버전도 만들어줘');
    } else if (action === 'freeform') {
      var instruction = await V._vagPromptText('어떻게 바꿀까요?', '예: 첫 2초를 더 세게, 예약 CTA로 바꾸고 후기 한 줄을 넣어줘');
      if (!instruction) return;
      next.followupInstruction = instruction;
    } else if (action === 'edit') {
      try { V._vagRenderTextEditCard(); } catch (_) {}
      var card = document.getElementById('vag-text-edit-card');
      if (card) {
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      V._addMsg('user', '나레이션과 장면 문구를 직접 조정할게');
      return;
    } else {
      return;
    }

    V._vagSession = next;
    if (next.aspect) document.getElementById('vag-aspect').value = next.aspect;
    if (next.hyperDuration) {
      var sec = Number(next.hyperDuration || 0) || 0;
      var nextSceneCount = sec <= 30 ? 2 : sec <= 45 ? 3 : sec <= 75 ? 4 : sec <= 135 ? 6 : Math.max(6, Math.min(12, Math.round(sec / 22)));
      document.getElementById('vag-scene-count').value = String(nextSceneCount);
    }
    var nextTopic = V._vagBuildMarketingTopic(next.baseTopic, next.objective, next.tone, next.cta);
    var nextSource = V._vagBuildMarketingSource(next.baseSource, next);
    await V._doGenerate(nextTopic, nextSource);
  }

  V._vagOfferFollowupActions = function _vagOfferFollowupActions() {
    var body = document.getElementById('vag-chat-body');
    if (!body) return;
    body.querySelectorAll('.vag-followup-actions').forEach(function (el) { el.remove(); });
    var wrap = document.createElement('div');
    wrap.className = 'vag-chat-options vag-followup-actions';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    var actions = [
      { id: 'edit', label: '장면·나레이션 조정' },
      { id: 'cta', label: 'CTA 강화 버전' },
      { id: 'event', label: '이벤트 긴급형' },
      { id: 'review', label: '후기 강조형' },
      { id: 'wide', label: '16:9 광고 버전' },
      { id: 'freeform', label: '직접 수정 요청' },
    ];
    actions.forEach(function (action) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;';
      btn.onclick = function () {
        body.querySelectorAll('.vag-followup-actions').forEach(function (el) { el.remove(); });
        V._vagRunFollowupAction(action.id);
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
  }

})();
