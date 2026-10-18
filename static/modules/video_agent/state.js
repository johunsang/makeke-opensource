/**
 * video_agent/state.js
 * 영상 에이전트 (state 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  V._vagVisualConceptRecommendationLimit = V._vagVisualConceptRecommendationLimit || 60;
  V._vagVisualConceptPromptLimit = V._vagVisualConceptPromptLimit || 24;

  V._vagSourceContent = '';
  V._vagResult = null;
  V._vagYoutubeSearchItems = [];
  V._vagYoutubeSearchSort = 'relevance';
  V._vagSession = null;
  V._vagSourceMode = '';
  V._vagHyperHtml = '';
  V._vagLongformState = null;  // 장편 모드: {overall_arc, total_duration, chapters:[...], aspect, targetSec}
  V._vagThreadId = '';
  V._vagThreadContext = {};
  V._vagPersistQueue = Promise.resolve();
  // 렌더 오버레이 UI 는 `static/modules/video_agent_overlay.js` 로 분리.
  // 기존 호출부(`_doGenerate` 내 수십 곳) 를 그대로 두기 위해 얇은 alias 로 연결.
  V._OV = (typeof window !== 'undefined' && window._VAGOverlay) || null;

  function _vagHumanizePlainText(text) {
    var out = String(text || '');
    [
      [/HyperFrames\s*HTML\s*\/\s*GSAP/gi, '영상 효과'],
      [/HTML\s*\/\s*GSAP/gi, '영상 효과'],
      [/HyperFrames/gi, '영상 효과'],
      [/image-to-video/gi, '이미지를 움직이는 영상'],
      [/\bI2V\b/gi, '이미지 영상'],
      [/\bGSAP\b/g, '움직임 효과'],
      [/\bHTML\b/g, '화면 구성'],
      [/\bMP4\b/g, '영상 파일'],
      [/\bTTS\b/g, '음성'],
      [/\bBGM\b/g, '배경음악'],
      [/\bCTA\b/g, '행동 문구'],
      [/\bAPI\b/g, '연결 설정'],
      [/\bCLI\b/g, '로컬 생성 도구'],
      [/\bCDN\b/g, '외부 파일'],
      [/data-start|data-duration|data-track-index|data-vag-narration/g, '장면 시간 정보'],
      [/렌더링/g, '영상 만들기'],
      [/렌더/g, '영상 만들기'],
      [/인코딩/g, '영상 저장'],
      [/프레임/g, '화면'],
      [/컴포지션/g, '영상 구성'],
      [/타임라인/g, '진행 시간'],
      [/코딩/g, '영상 구성'],
      [/코드/g, '영상 구성'],
      [/템플릿/g, '기본 틀'],
      [/프로젝트/g, '작업'],
      [/asset/gi, '파일'],
      [/debug/gi, '확인용'],
      [/provider/gi, '생성 도구'],
      [/model/gi, '생성 도구'],
      [/모델/g, '생성 도구'],
      [/프롬프트/g, '요청 문장'],
    ].forEach(function (pair) {
      out = out.replace(pair[0], pair[1]);
    });
    out = out
      .replace(/영상\s+영상\s+구성/g, '영상 구성')
      .replace(/영상\s+영상\s+만들기/g, '영상 만들기')
      .replace(/영상\s+파일\s+영상\s+만들기/g, '영상 파일 만들기')
      .replace(/요청 문장로/g, '요청 문장으로')
      .replace(/생성 도구 세팅/g, '생성 도구 설정')
      .replace(/Gemini\s+배경음악/g, 'Gemini 배경음악');
    return out;
  }

  V._vagHumanizeText = function _vagHumanizeText(value) {
    if (value === null || value === undefined) return value;
    return String(value).split(/(<[^>]+>)/g).map(function (part) {
      return part && part.charAt(0) === '<' ? part : _vagHumanizePlainText(part);
    }).join('');
  }

  V._vagEnsureRenderOverlay = function _vagEnsureRenderOverlay() { return V._OV ? V._OV.ensure() : null; }
  V._vagResetRenderOverlay = function _vagResetRenderOverlay()  { if (V._OV) V._OV.reset(); }
  V._vagShowRenderOverlay = function _vagShowRenderOverlay(label) { if (V._OV) V._OV.show(V._vagHumanizeText(label)); }
  V._vagSetRenderOverlayProgress = function _vagSetRenderOverlayProgress(percent) { if (V._OV) V._OV.setProgress(percent); }
  V._vagSetRenderOverlayStage = function _vagSetRenderOverlayStage(stage, note) { if (V._OV) V._OV.setStage(stage, V._vagHumanizeText(note)); }
  V._vagPushRenderOverlayLog = function _vagPushRenderOverlayLog(message, level) { if (V._OV) V._OV.pushLog(V._vagHumanizeText(message), level); }
  V._vagUpdateRenderOverlay = function _vagUpdateRenderOverlay(label, sub, progress, stage, log, level) { if (V._OV) V._OV.update(V._vagHumanizeText(label), V._vagHumanizeText(sub), progress, stage, V._vagHumanizeText(log), level); }
  V._vagHideRenderOverlay = function _vagHideRenderOverlay() { if (V._OV) V._OV.hide(); }

  V._vagAttachedImages = [];   // 📎 [{name, dataUrl}]
  V._vagAttachedSources = [];  // 🔍 [{title, url, snippet, type}]
  V._vagLogoDataUrl = '';      // 🏷 브랜드 로고
  V._vagPlan = null;           // { scenes, theme } — 화면 편집용 플랜
  V._vagOriginalHtml = '';  // AI 원본 HTML 백업 — DOMParser 손실 복구용
  V._vagStudioProjectId = '';
  V._vagStudioProjectName = '';
  V._vagRenderMeta = '';
  V._vagLocalHtmlPath = '';
  V._vagLocalCssPath = '';
  V._vagTextEntries = [];

  V._esc = function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // DOMParser 가 <head> 의 <style>/<script>/<link> 를 유실시키는 버그 회피용.
  // 조작 전 원본을 보관했다가 최종 결과에 <head> 가 비어 있으면 원본의 head 내용을 복원한다.
  V._vagPreserveHead = function _vagPreserveHead(originalHtml, modifiedHtml) {
    if (!originalHtml || !modifiedHtml) return modifiedHtml || originalHtml || '';
    // 원본에서 <style>/<script>/<link> 블록들을 추출
    function extractHead(html) {
      var styles = [];
      html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, function (m) { styles.push(m); return ''; });
      var scripts = [];
      // <head> 내부의 <script> 만 (body 끝 GSAP script 는 별도 처리)
      var headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        headMatch[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, function (m) { scripts.push(m); return ''; });
        headMatch[1].replace(/<link[^>]*>/gi, function (m) { scripts.push(m); return ''; });
        headMatch[1].replace(/<meta[^>]*>/gi, function (m) { scripts.push(m); return ''; });
        headMatch[1].replace(/<title>[\s\S]*?<\/title>/gi, function (m) { scripts.push(m); return ''; });
      }
      return { styles: styles, headRest: scripts };
    }
    // 수정본이 head 에 style 을 잃었는지 체크
    var modHeadMatch = modifiedHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    var modHead = modHeadMatch ? modHeadMatch[1] : '';
    var origInfo = extractHead(originalHtml);
    var origHasStyle = origInfo.styles.length > 0;
    var modHasStyle = /<style/i.test(modHead);
    if (!origHasStyle || modHasStyle) {
      return modifiedHtml; // 문제 없음
    }
    // 문제: 원본엔 style 있었는데 수정본은 없음 → head 에 다시 주입
    var injection = origInfo.styles.join('\n') + '\n' + (origInfo.headRest || []).join('\n');
    if (/<head[^>]*>/i.test(modifiedHtml)) {
      return modifiedHtml.replace(/<head([^>]*)>/i, function (_, attrs) {
        return '<head' + attrs + '>\n' + injection + '\n';
      });
    }
    if (/<html[^>]*>/i.test(modifiedHtml)) {
      return modifiedHtml.replace(/<html([^>]*)>/i, function (_, attrs) {
        return '<html' + attrs + '><head>' + injection + '</head>';
      });
    }
    return '<head>' + injection + '</head>' + modifiedHtml;
  }

  // 3가지 변형 그리드 UI — 사용자가 하나 클릭하면 resolve(item)
  V._vagPickVariation = function _vagPickVariation(items) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve(items[0] || null); return; }
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:10px 0;';
      items.forEach(function (item, i) {
        var card = document.createElement('button');
        card.type = 'button';
        card.style.cssText = 'border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;padding:12px;cursor:pointer;text-align:left;transition:all .15s;overflow:hidden;';
        card.onmouseenter = function () { card.style.borderColor = 'rgba(255,140,0,0.4)'; card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; };
        card.onmouseleave = function () { card.style.borderColor = 'rgba(0,0,0,0.08)'; card.style.transform = 'none'; card.style.boxShadow = 'none'; };
        var preview = '<iframe srcdoc="' + String(item.html || '').replace(/"/g, '&quot;') + '" sandbox="allow-scripts" style="width:100%;height:200px;border:0;border-radius:10px;background:#000;pointer-events:none;"></iframe>';
        card.innerHTML =
          '<div style="font-weight:800;font-size:13px;color:#1c1c1e;margin-bottom:6px;">변형 ' + (i + 1) + '</div>'
          + '<div style="font-size:11px;color:rgba(0,0,0,0.55);line-height:1.5;margin-bottom:8px;min-height:32px;">' + V._esc(item.direction || '') + '</div>'
          + preview
          + '<div style="margin-top:8px;text-align:center;font-size:11px;font-weight:700;color:#ff8c00;">이 디자인으로 계속 →</div>';
        card.onclick = function () {
          wrap.remove();
          V._addMsg('user', '변형 ' + (i + 1) + ' 선택');
          resolve(item);
        };
        wrap.appendChild(card);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    });
  }

  // fetch 래퍼 — "Failed to fetch" (Electron 소켓 재사용 실패 / 서버 재시작 중) 시 자동 재시도.
  // 서버 재시작은 5~8초 걸리므로 backoff 1.2s × 4회 = 약 5초까지 대기.
  V._vagFetch = async function _vagFetch(url, opts, retries) {
    if (retries === undefined) retries = 4;
    try {
      return await fetch(url, opts);
    } catch (e) {
      var msg = (e && e.message) || String(e);
      if (retries > 0 && /Failed to fetch|NetworkError|Load failed|ERR_CONNECTION/i.test(msg)) {
        await new Promise(function (r) { setTimeout(r, 1200); });
        return V._vagFetch(url, opts, retries - 1);
      }
      throw e;
    }
  }
  V._vagTextFromHtml = function _vagTextFromHtml(html) {
    var raw = String(html || '');
    if (!raw) return '';
    try {
      var doc = new DOMParser().parseFromString('<div>' + raw + '</div>', 'text/html');
      return ((doc.body && doc.body.textContent) || raw).replace(/\s+/g, ' ').trim();
    } catch (e) {
      return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  V._vagMergeState = function _vagMergeState(base, patch) {
    var next = Object.assign({}, base || {});
    Object.keys(patch || {}).forEach(function (key) {
      var value = patch[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && next[key] && typeof next[key] === 'object' && !Array.isArray(next[key])) {
        next[key] = Object.assign({}, next[key], value);
      } else {
        next[key] = value;
      }
    });
    return next;
  }
  V._vagProfileDesignRulesText = function _vagProfileDesignRulesText(profile) {
    var p = profile || {};
    return [
      p.brand_colors ? '대표 색상 팔레트: ' + p.brand_colors : '',
      !p.brand_colors && p.brand_color ? '대표 색상: ' + p.brand_color : '',
      p.design_tone ? '브랜드 무드/컨셉: ' + p.design_tone : '',
      p.typography_rules ? '타이포그래피: ' + p.typography_rules : '',
      p.layout_rules ? '레이아웃/여백: ' + p.layout_rules : '',
      p.image_rules ? '이미지/사진/3D 스타일: ' + p.image_rules : '',
      p.cta_rules ? 'CTA/강조 요소: ' + p.cta_rules : '',
      p.design_forbidden ? '금지 규칙: ' + p.design_forbidden : '',
      p.design_rules ? String(p.design_rules) : '',
    ].filter(Boolean).join('\n');
  }
  V._vagBuildProfileDesignGuideBlock = function _vagBuildProfileDesignGuideBlock() {
    var profile = window._globalProfileData || {};
    var rules = V._vagProfileDesignRulesText(profile);
    if (!rules) return '';
    return [
      '[브랜드 디자인 규칙.md]',
      '아래 규칙은 프로필 CI/BI 기준의 최상위 브랜드 디자인 가이드다.',
      '마케케디자인, 카드뉴스, 블로그 이미지, SNS 썸네일, 씬 배경 이미지, HyperFrames HTML/GSAP 레이어, 자막, CTA, 색상, 타이포그래피, 모션에 모두 공통 적용한다.',
      '자동 배경 컨셉이나 씬별 스타일은 이 CI/BI 규칙을 보조할 수만 있고, 대표 색상·타이포·레이아웃·이미지 톤·금지 규칙을 덮어쓸 수 없다.',
      rules,
    ].join('\n');
  }
  V._vagQueuePersist = function _vagQueuePersist(task) {
    V._vagPersistQueue = V._vagPersistQueue
      .catch(function () { return null; })
      .then(function () { return task(); })
      .catch(function (e) {
        console.warn('[VAG] persist failed', e);
        return null;
      });
    return V._vagPersistQueue;
  }
  V._vagEnsureConversationThread = async function _vagEnsureConversationThread(seed) {
    if (V._vagThreadId) return V._vagThreadId;
    var profile = window._globalProfileData || {};
    var payload = Object.assign({
      title: '새 영상 대화',
      topic: '',
      profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
      profile_name: profile.name || '',
      mode: 'marketing-video',
      status: 'active',
      current_node: 'intro',
      context: {},
    }, seed || {});
    var resp = await V._vagFetch('/api/vag/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (!resp.ok || !data.ok || !data.item || !data.item.id) {
      var detail = data.detail || data.error || data.message || '';
      if (/501|not implemented|go-native|endpoint not implemented/i.test(String(detail) + ' ' + String(resp.status || ''))) {
        V._vagThreadId = 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        V._vagThreadContext = payload.context || {};
        if (!V._vagSession) V._vagSession = {};
        V._vagSession.threadId = V._vagThreadId;
        V._vagSession.localThreadOnly = true;
        console.warn('[VAG] conversation API unavailable in go-native mode; using local thread only.');
        return V._vagThreadId;
      }
      throw new Error(data.detail || data.error || '영상 대화 스레드 생성 실패');
    }
    V._vagThreadId = data.item.id;
    V._vagThreadContext = data.item.context || {};
    if (!V._vagSession) V._vagSession = {};
    V._vagSession.threadId = V._vagThreadId;
    return V._vagThreadId;
  }
  V._vagPersistMessage = function _vagPersistMessage(role, html, options) {
    if (!V._vagThreadId) return Promise.resolve(null);
    if (String(V._vagThreadId || '').indexOf('local-') === 0) return Promise.resolve(null);
    var content = V._vagTextFromHtml(html);
    if (!content) return Promise.resolve(null);
    var meta = Object.assign({}, (options && options.meta) || {});
    return V._vagQueuePersist(function () {
      return V._vagFetch('/api/vag/conversations/' + encodeURIComponent(V._vagThreadId) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role === 'ai' ? 'assistant' : role,
          kind: (options && options.kind) || 'chat',
          node: (options && options.node) || ((V._vagThreadContext && V._vagThreadContext.current_node) || ''),
          content: content,
          meta: meta,
        }),
      });
    });
  }
  V._vagPersistState = function _vagPersistState(node, status, contextPatch, eventType, eventPayload) {
    if (!V._vagThreadId) return Promise.resolve(null);
    V._vagThreadContext = V._vagMergeState(V._vagThreadContext, contextPatch || {});
    if (node) V._vagThreadContext.current_node = node;
    if (String(V._vagThreadId || '').indexOf('local-') === 0) return Promise.resolve(null);
    return V._vagQueuePersist(async function () {
      var resp = await V._vagFetch('/api/vag/conversations/' + encodeURIComponent(V._vagThreadId) + '/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: (V._vagSession && V._vagSession.baseTopic) || (V._vagThreadContext && V._vagThreadContext.topic) || '',
          title: (V._vagSession && V._vagSession.baseTopic) || (V._vagThreadContext && V._vagThreadContext.topic) || '영상 대화',
          status: status || undefined,
          current_node: node || undefined,
          context_patch: contextPatch || {},
          event_type: eventType || undefined,
          event_payload: eventPayload || contextPatch || {},
        }),
      });
      var data = await resp.json();
      if (resp.ok && data.ok && data.item) {
        V._vagThreadContext = data.item.context || V._vagThreadContext;
      }
      return data;
    });
  }
  function _vagCompactScenePlanForCheckpoint(plan) {
    return (Array.isArray(plan) ? plan : []).slice(0, 24).map(function (scene, idx) {
      scene = scene || {};
      return {
        index: scene.index || scene.scene || (idx + 1),
        title: scene.title || '',
        body: scene.body || '',
        narration: scene.narration || '',
        cta: scene.cta || '',
        imagePrompt: scene.imagePrompt || scene.image_prompt || '',
        cutPlan: scene.cutPlan || scene.cut_plan || '',
        visualMode: scene.visualMode || scene.visual_mode || '',
      };
    });
  }
  function _vagCompactSceneImagesForCheckpoint(images) {
    return (Array.isArray(images) ? images : []).slice(0, 24).map(function (image, idx) {
      image = image || {};
      return {
        index: image.index || image.scene || image.sceneIndex || (idx + 1),
        url: image.url || image.src || image.path || '',
        path: image.path || '',
        prompt: image.prompt || image.imagePrompt || '',
        title: image.title || image.label || '',
      };
    }).filter(function (image) { return image.url || image.path || image.prompt || image.title; });
  }
  V._vagSaveCheckpoint = function _vagSaveCheckpoint(stage, payload) {
    var data = payload || {};
    var session = V._vagSession || {};
    var checkpoint = {
      savedAt: new Date().toISOString(),
      stage: stage || 'unknown',
      topic: data.topic || session.baseTopic || '',
      aspect: data.aspect || session.aspect || '',
      duration: data.duration || session.hyperDuration || 0,
      html: data.html || session.hyperHtml || V._vagHyperHtml || '',
      narrationUrl: data.narrationUrl || session.narrationUrl || '',
      narrationDuration: data.narrationDuration || session.narrationDuration || 0,
      narrationScript: data.narrationScript || session.narrationScript || '',
      bgmEnabled: session.bgmEnabled !== false,
      bgmAttempt: data.bgmAttempt || session.bgmAttempt || 0,
      bgmError: data.bgmError || session.bgmError || '',
      sceneNarrationPlan: _vagCompactScenePlanForCheckpoint(data.sceneNarrationPlan || session.sceneNarrationPlan || []),
      sceneImages: _vagCompactSceneImagesForCheckpoint(data.sceneImages || session.generatedSceneImages || session.sceneImages || []),
    };
    if (!checkpoint.html && !checkpoint.sceneNarrationPlan.length && !checkpoint.sceneImages.length) return null;
    V._vagSession = Object.assign({}, session, {
      lastCheckpoint: checkpoint,
      resumePoint: checkpoint.stage,
      hyperHtml: checkpoint.html || session.hyperHtml || '',
    });
    V._vagThreadContext = V._vagMergeState(V._vagThreadContext, {
      resume_point: checkpoint.stage,
      resume_saved_at: checkpoint.savedAt,
      resume_checkpoint: checkpoint,
    });
    try {
      localStorage.setItem('makeke:vag:lastCheckpoint', JSON.stringify(checkpoint));
    } catch (e) {
      console.warn('[VAG] checkpoint local save failed:', e);
    }
    if (typeof V._vagPersistState === 'function') {
      V._vagPersistState('checkpoint', 'saved', {
        resume_point: checkpoint.stage,
        resume_saved_at: checkpoint.savedAt,
        resume_checkpoint: checkpoint,
      }, 'checkpoint_saved', {
        stage: checkpoint.stage,
        topic: checkpoint.topic,
        duration: checkpoint.duration,
        bgmAttempt: checkpoint.bgmAttempt,
      });
    }
    return checkpoint;
  }
  V._vagLoadCheckpoint = function _vagLoadCheckpoint() {
    if (V._vagSession && V._vagSession.lastCheckpoint) return V._vagSession.lastCheckpoint;
    try {
      var raw = localStorage.getItem('makeke:vag:lastCheckpoint');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[VAG] checkpoint load failed:', e);
      return null;
    }
  }
  V._vagResumeLastCheckpoint = function _vagResumeLastCheckpoint() {
    var checkpoint = V._vagLoadCheckpoint && V._vagLoadCheckpoint();
    if (!checkpoint) {
      if (V._vagToast) V._vagToast('저장된 이어하기 지점이 없습니다.', 'error');
      return null;
    }
    V._vagSession = Object.assign({}, V._vagSession || {}, {
      baseTopic: checkpoint.topic || ((V._vagSession && V._vagSession.baseTopic) || ''),
      aspect: checkpoint.aspect || ((V._vagSession && V._vagSession.aspect) || ''),
      hyperHtml: checkpoint.html || '',
      hyperDuration: checkpoint.duration || 0,
      narrationUrl: checkpoint.narrationUrl || '',
      narrationDuration: checkpoint.narrationDuration || 0,
      narrationScript: checkpoint.narrationScript || '',
      bgmEnabled: checkpoint.bgmEnabled !== false,
      bgmError: checkpoint.bgmError || '',
      bgmAttempt: checkpoint.bgmAttempt || 0,
      sceneNarrationPlan: checkpoint.sceneNarrationPlan || [],
      generatedSceneImages: checkpoint.sceneImages || [],
      lastCheckpoint: checkpoint,
      resumePoint: checkpoint.stage || '',
    });
    V._vagHyperHtml = checkpoint.html || '';
    if (V._vagSetStage) V._vagSetStage('code', 'paused', '저장 지점 불러옴', '이전 실패 지점까지 만든 장면을 다시 열었습니다.');
    if (V._addMsg) V._addMsg('ai', '저장 지점을 불러왔습니다. 여기서 음악만 다시 만들거나, 음악 없이 영상 만들기를 이어갈 수 있습니다.');
    try {
      var body = document.getElementById('vag-chat-body');
      if (body && typeof V._vagRenderCheckpointVideo === 'function') {
        var wrap = document.createElement('div');
        wrap.className = 'vag-chat-options';
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
        [
          ['배경음악 다시 만들고 영상 생성', true],
          ['배경음악 없이 영상 생성', false],
        ].forEach(function (item) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = item[0];
          btn.style.cssText = 'padding:8px 15px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:800;cursor:pointer;';
          btn.onclick = function () {
            body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
            V._addMsg('user', item[0]);
            V._vagRenderCheckpointVideo(checkpoint, { withBgm: item[1] });
          };
          wrap.appendChild(btn);
        });
        body.appendChild(wrap);
        body.scrollTop = body.scrollHeight;
      }
    } catch (_) {}
    if (V._vagShowHtmlMotionPreview && checkpoint.html) {
      V._vagShowHtmlMotionPreview(checkpoint.html, {
        topic: checkpoint.topic || '저장된 영상',
        aspect: checkpoint.aspect || '9:16',
        duration: checkpoint.duration || 12,
      });
    } else {
      try { if (V._vagRenderTextEditCard) V._vagRenderTextEditCard(); } catch (_) {}
      try { if (V._vagUpdateWorkspace) V._vagUpdateWorkspace(); } catch (_) {}
    }
    return checkpoint;
  }
  V._vagCollectOutputSummary = function _vagCollectOutputSummary(html, session) {
    var summary = {
      topic: (session && session.baseTopic) || '',
      objective: (session && session.objective) || '',
      tone: (session && session.tone) || '',
      cta: (session && session.cta) || '',
      design_family: (session && session.designFamily) || '',
      brand_color: (session && session.brandColor) || '',
      logo_used: !!V._vagLogoDataUrl,
      hf_templates: (session && session.designSystem && Array.isArray(session.designSystem.hfTemplates)) ? session.designSystem.hfTemplates.slice(0, 6) : [],
      image_strategy: (session && session.designSystem && session.designSystem.imageStrategy) || '',
      hook: '',
      scene_styles: [],
      key_copies: [],
      narrative_arc: '',
    };
    if (session && session.directorMeta) {
      var brief = session.directorMeta.creative_brief || {};
      var outline = Array.isArray(session.directorMeta.scenes_outline) ? session.directorMeta.scenes_outline : [];
      summary.hook = brief.hook_strategy || '';
      summary.narrative_arc = brief.narrative_arc || '';
      summary.scene_styles = outline.map(function (row) { return row && row.style ? row.style : ''; }).filter(Boolean).slice(0, 8);
      summary.key_copies = outline.map(function (row) { return row && row.intent ? row.intent : ''; }).filter(Boolean).slice(0, 6);
    }
    if (!summary.key_copies.length && html) {
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var texts = [];
        doc.querySelectorAll('#stage [data-start]').forEach(function (el) {
          var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (text && texts.indexOf(text) < 0) texts.push(text);
        });
        summary.key_copies = texts.slice(0, 6);
        if (!summary.hook && texts.length) summary.hook = texts[0].slice(0, 120);
      } catch (e) { /* ignore */ }
    }
    return summary;
  }
  V._vagBuildAntiRepeatBlock = function _vagBuildAntiRepeatBlock(session) {
    var memory = (session && session.previousOutputSummary) || (V._vagThreadContext && V._vagThreadContext.previous_output_summary) || null;
    if (!memory) return '';
    var lines = ['[반복 금지 메모리]'];
    if (memory.design_family) lines.push('직전 디자인 패밀리 재사용 금지: ' + memory.design_family);
    if (memory.hook) lines.push('직전 훅 재사용 금지: ' + memory.hook);
    if (memory.narrative_arc) lines.push('직전 서사 재사용 금지: ' + memory.narrative_arc);
    if (Array.isArray(memory.scene_styles) && memory.scene_styles.length) lines.push('직전 씬 스타일 재사용 금지: ' + memory.scene_styles.join(', '));
    if (Array.isArray(memory.key_copies) && memory.key_copies.length) lines.push('직전 카피/메시지 재사용 금지: ' + memory.key_copies.join(' / '));
    if (Array.isArray(memory.hf_templates) && memory.hf_templates.length) lines.push('직전 HF 템플릿 재사용 금지: ' + memory.hf_templates.join(', '));
    if (memory.image_strategy) lines.push('직전 이미지 연출 방식 재사용 금지: ' + memory.image_strategy);
    if (memory.brand_color) lines.push('브랜드 색은 유지하되 직전 배치 방식/강조 패턴은 반복 금지: ' + memory.brand_color);
    lines.push('이번 결과는 위 요소를 반복하지 말고, 새로운 훅·새 카피·새 디자인 리듬으로 다시 설계.');
    return lines.join('\n');
  }
  V._vagHashText = function _vagHashText(text) {
    var s = String(text || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  V._vagUniqueList = function _vagUniqueList(items) {
    var out = [];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var value = String(item || '').trim();
      if (!value || out.indexOf(value) >= 0) return;
      out.push(value);
    });
    return out;
  }
  V._vagAdVisualConceptFamilies = [
    ['cinematic-narrative', '시네마틱 내러티브', '영화 같은 구도와 조명, 느린 줌, 서사적 몽타주'],
    ['documentary-realism', '다큐 리얼리즘', '현장 자연광, 실제 인물 인터뷰, 진정성 있는 프레이밍'],
    ['handheld-vlog', '핸드헬드 브이로그', '핸드헬드 흔들림, 1인칭 시점, 친근한 톤'],
    ['commercial-clean', '상업 클린', '밝고 깔끔한 배경, 제품 강조, 명확한 CTA'],
    ['luxury-brand', '럭셔리 브랜드', '슬로우 줌, 고급 질감, 블랙/골드 톤, 프리미엄 무드'],
    ['tech-futurism', '테크 퓨처리즘', '홀로그램, UI 그래픽, 블루/네온, 미래적 인터페이스'],
    ['anime-illustration', '애니 일러스트', '2D/3D 애니메이션 스타일, 라인아트, 감정 과장'],
    ['stop-motion-craft', '스톱모션 크래프트', '프레임 바이 프레임, 수제 오브제, 재치 있는 움직임'],
    ['surreal-conceptual', '초현실 컨셉', '비현실 오브제 병치, 불가능한 중력, 꿈속 논리'],
    ['split-screen-dual', '스플릿 스크린', '화면 분할로 두 세계 병치, 대비와 동시성 강조'],
    ['oner-longtake', '원컷 롱테이크', '편집 없이 공간을 통째로 누비는 몰입 카메라'],
    ['hyper-zoom-macro', '하이퍼 줌 매크로', '극단적 줌인/아웃, 눈과 입자 수준 매크로'],
    ['bullet-time-360', '불릿타임 360', '시간 정지 360도 회전, 아이코닉한 순간 포착'],
    ['glitch-digital', '글리치 디지털', '스캔라인, 픽셀 깨짐, 디지털 에러 미학'],
    ['vhs-retro', 'VHS 레트로', '90년대 VHS 트래킹, 타임스탬프, 색 번짐'],
    ['collage-mixedmedia', '콜라주 믹스미디어', '잡지 컷오려붙임, 손맛 애니, 아날로그 질감'],
    ['musicvideo-beat', '뮤직비디오 비트', '비트 싱크 컷편집, 슬로우-패스트 교차'],
    ['silent-typography', '사일런트 타이포', '무성, 텍스트 카드와 사운드 디자인만으로 서사'],
    ['overhead-flatlay', '오버헤드 플랫레이', '탑다운 고정 샷, 플랫레이, 손만 등장'],
    ['pov-firstperson', 'POV 1인칭', '주인공 시선, 몰입형 프레이밍'],
    ['ar-overlay', 'AR 오버레이', '현실 위에 AR 그래픽, 좌표, 라벨, UI 요소'],
    ['holographic', '홀로그램 프로젝션', '시안/마젠타 글로우, 공중에 뜬 3D 렌더'],
    ['webtoon-panel', '웹툰 패널', '세로 스크롤 컷, 말풍선, 효과선'],
    ['korean-heritage', 'K-헤리티지', '단청, 전통 문양, 한국적 미학과 현대 결합'],
    ['streetwear-mz', '스트릿 MZ', 'SNS 숏폼, 글리치와 네온이 섞인 트렌디 감성'],
  ];
  V._vagAdVisualConceptVibes = [
    ['warm-ember', '따뜻한 잔불', '앰버/세피아 톤, 저녁 노을, 포근한 감성'],
    ['cool-serene', '차분 세레니티', '쿨 블루/그레이, 여백과 정적, 명상적 템포'],
    ['energetic-hype', '에너지 하이프', '빠른 편집, 강렬한 색상, 높은 채도'],
    ['dreamy-pastel', '몽환 파스텔', '파스텔 색감, 소프트 포커스, 렌즈 플레어'],
    ['noir-moody', '누아르 무드', '극저채도, 강한 명암, 그림자 연출'],
    ['neon-cyberpunk', '네온 사이버펑크', '핑크/시안/퍼플 발광, 어둠 속 네온'],
    ['golden-hour', '골든 아워', '황금빛 역광, 얕은 피사계 심도, 반짝임'],
    ['monochrome-noir', '모노크롬', '단색조 그레이딩, 절제된 톤'],
    ['high-contrast', '하이 콘트라스트', '강렬한 밝고 어두움 대비, 색 포화'],
    ['minimal-clean', '미니멀 클린', '여백 활용, 절제된 움직임, 화이트 스페이스'],
    ['vintage-70s', '빈티지 70년대', '16mm 필름 그레인, 따뜻한 세피아, 복고 타이포'],
    ['y2k-bubble', 'Y2K 버블', '메탈릭 질감, 홀로그래픽 스티커'],
    ['kpop-idol', 'K-팝 아이돌', '무대 조명, 슬로우 모션 팬, 퍼포먼스 리듬'],
    ['analog-filmic', '아날로그 필름', '35mm 필름, 라이트 리크, 미세 노이즈'],
    ['urban-rainy', '어반 레이니', '비 오는 도시, 네온 반사, 축축한 아스팔트'],
    ['desert-earthy', '사막 어씨', '모래색과 테라코타, 긴 그림자, 먼지 필터'],
    ['oceanic-blue', '오셔닉 블루', '바다 블루 톤, 물결 반사, 깊이감'],
    ['forest-lush', '포레스트 러시', '녹색 숲, 스며드는 햇살, 자연 향기'],
    ['studio-product', '스튜디오 프로덕트', '360도 턴테이블, 소프트박스, 무한배경'],
    ['cosmic-celestial', '코스믹 셀레스트', '별빛과 은하, 딥퍼플, 공간감과 신비'],
  ];
  V._vagBuildAdVisualConceptLibrary = function _vagBuildAdVisualConceptLibrary() {
    if (V._vagAdVisualConceptCache) return V._vagAdVisualConceptCache.slice();
    var out = [];
    V._vagAdVisualConceptFamilies.forEach(function (family) {
      V._vagAdVisualConceptVibes.forEach(function (vibe) {
        out.push({ code: family[0] + '--' + vibe[0], label: family[1] + ' · ' + vibe[1], family: family[0], vibe: vibe[0], desc: family[2] + ' / ' + vibe[2] });
      });
    });
    V._vagAdVisualConceptCache = out;
    return out.slice();
  }
  V._vagSelectAdVisualConcept = function _vagSelectAdVisualConcept(session, aspect, count) {
    var library = V._vagBuildAdVisualConceptLibrary();
    var seed = [session && session.baseTopic, session && session.objective, session && session.tone, session && session.designFamily, aspect].filter(Boolean).join(' ');
    var allowNeon = /네온|사이버|cyber|neon/i.test(seed);
    if (!allowNeon) {
      library = library.filter(function (item) { return item.vibe !== 'neon-cyberpunk'; });
    }
    function score(item) {
      var value = V._vagHashText(seed + '|' + item.code) % 17;
      if (/cinematic|시네마틱|실사|실제|모델|사람|라이프스타일|제품|상품|광고|브랜드|마케팅/i.test(seed) && /cinematic|documentary|commercial|luxury|studio-product|golden|filmic|minimal/.test(item.code)) value += 34;
      if (/앱|ai|자동화|데이터|솔루션|saas|테크|프로그램|대시보드|마케팅/i.test(seed) && /commercial|cinematic|documentary|clean|minimal|studio-product/.test(item.code)) value += 28;
      if (/프리미엄|하이엔드|럭셔리|브랜드|ci/i.test(seed) && /luxury|cinematic|minimal|noir|golden|filmic/.test(item.code)) value += 30;
      if (/쇼핑|상품|제품|커머스|구매|전환/i.test(seed) && /commercial|studio-product|cinematic|documentary|golden|filmic|high-contrast/.test(item.code)) value += 30;
      if (/교육|스터디|강의|커리큘럼|설명/i.test(seed) && /documentary|typography|clean|overhead|minimal/.test(item.code)) value += 24;
      if (/맛집|카페|푸드|라이프|감성/i.test(seed) && /warm|golden|craft|filmic|flatlay/.test(item.code)) value += 24;
      if (/강렬|충격|후킹|빠른|숏폼|mz/i.test(seed) && /glitch|streetwear|hype|musicvideo/.test(item.code)) value += 24;
      if (allowNeon && /neon/.test(item.code)) value += 24;
      return value;
    }
    return library.sort(function (a, b) { return score(b) - score(a); }).slice(0, Math.max(1, count || V._vagVisualConceptRecommendationLimit || 60));
  }
  V._vagBuildAdVisualConceptBlock = function _vagBuildAdVisualConceptBlock(session, aspect) {
    var choices = session && Array.isArray(session.visualConceptCandidates) && session.visualConceptCandidates.length
      ? session.visualConceptCandidates
      : V._vagSelectAdVisualConcept(session, aspect, V._vagVisualConceptRecommendationLimit || 60);
    var selectedConcepts = session && Array.isArray(session.visualConcepts) ? session.visualConcepts.filter(Boolean) : [];
    var primary = selectedConcepts[0] || (session && session.visualConcept ? session.visualConcept : choices[0]);
    if (primary && primary.vibe === 'neon-cyberpunk' && !/네온|사이버|cyber|neon/i.test([session && session.baseTopic, session && session.objective, session && session.tone, session && session.designFamily].filter(Boolean).join(' '))) {
      primary = choices.find(function (item) { return item.vibe !== 'neon-cyberpunk'; }) || primary;
    }
    if (!selectedConcepts.length && primary) selectedConcepts = [primary];
    if (session) {
      session.visualConcept = primary;
      session.visualConcepts = selectedConcepts;
      session.visualConceptCandidates = choices;
    }
    if (!primary) return '';
    return [
      '[배경 이미지 참고]',
      '배경 분위기: ' + primary.label + ' — ' + primary.desc,
      '이미지에 글자/로고/워터마크를 넣지 마라. 텍스트는 별도 레이어에서 합성한다.',
      session && session.personMode ? '사람 등장: ' + session.personMode : '',
    ].filter(Boolean).join('\n');
  }
  V._vagObjectiveCasePlaybooks = {
    product: {
      match: /상품|제품|판매|전환|구매|커머스|쇼핑|런칭|상세/i,
      label: '상품 광고',
      cases: [
        ['hero-launch', '신제품 런칭', '상품을 첫 1초에 크게 보여주고, 존재감/첫인상/출시 이유를 각인'],
        ['problem-solution', '문제 해결형', '사용 전 불편함과 상품이 해결하는 순간을 대비'],
        ['demo-use', '사용 장면 데모', '손/모델/상황을 통해 실제 사용 흐름을 보여줌'],
        ['detail-macro', '디테일·질감', '소재, 마감, 제형, 버튼, 패키지 등 매크로 컷 중심'],
        ['benefit-stack', '혜택 누적', '기능/장점/구성품/보너스를 리듬 있게 쌓음'],
        ['before-after', '전후 비교', '사용 전/후, 기존 방식/새 방식의 시각 차이를 선명하게 보여줌'],
        ['review-proof', '리뷰·신뢰', '후기, 별점, 사용자의 표정/반응, 사회적 증거 중심'],
        ['price-offer', '가격·프로모션', '가격, 할인, 한정 혜택, 지금 사야 하는 이유 중심'],
        ['comparison', '경쟁/대안 비교', '기존 선택지와 차별점을 표/분할화면/실험 컷으로 비교'],
        ['bundle-package', '패키지·구성', '박스 오픈, 구성품 나열, 세트 가치 강조'],
      ],
    },
    brand: {
      match: /브랜드|ci|인지|이미지|철학|비전|프리미엄|신뢰|세계관|브랜드\s*필름/i,
      label: '브랜드·CI 광고',
      cases: [
        ['origin-story', '브랜드 기원', '왜 이 브랜드가 존재하는지 한 문장으로 각인'],
        ['worldview', '세계관 구축', '색, 공간, 상징 오브젝트로 브랜드 무드를 먼저 설계'],
        ['premium-signal', '프리미엄 시그널', '질감, 여백, 조명, 느린 카메라로 고급감 강화'],
        ['trust-heritage', '신뢰·헤리티지', '시간, 전문성, 고객 기반, 일관된 품질을 증명'],
        ['category-owning', '카테고리 선점', '이 브랜드가 어떤 카테고리를 대표하는지 명확히 선언'],
      ],
    },
    informercial: {
      match: /인포머셜|정보|설명|사용법|비교|가이드|튜토리얼|교육형|데모/i,
      label: '인포머셜·정보 전달 광고',
      cases: [
        ['problem-educate', '문제 교육형', '고객이 몰랐던 문제를 먼저 이해시키고 해결 기준을 제시'],
        ['how-it-works', '작동 원리 설명', '복잡한 기능/원리를 2~3개의 쉬운 장면으로 시각화'],
        ['myth-busting', '오해 반박', '흔한 오해를 짧게 깨고 올바른 선택 기준을 제시'],
        ['checklist', '체크리스트', '구매/상담/사용 전 확인할 기준을 순서대로 각인'],
        ['comparison-guide', '비교 가이드', '대안과 차이를 실험/분할/데이터 컷으로 설명'],
      ],
    },
    service: {
      match: /서비스|상담|예약|리드|문의|병원|업체|매장|교육|스터디|강의/i,
      label: '서비스·리드 광고',
      cases: [
        ['pain-point', '고객 문제 포착', '고객이 겪는 불편을 구체적 상황으로 시작'],
        ['process-simple', '절차 단순화', '복잡한 과정을 3단계 이하로 단순하게 보여줌'],
        ['expert-proof', '전문성 증명', '경험, 데이터, 사례, 시스템으로 신뢰 형성'],
        ['local-visit', '방문/예약 유도', '위치, 접근성, 상담/예약 행동을 자연스럽게 연결'],
        ['lead-magnet', '리드 수집', '무료 진단, 상담, 체크리스트 같은 첫 행동 제안'],
      ],
    },
    app: {
      match: /앱|가입|다운로드|saas|플랫폼|자동화|ai|툴|소프트웨어/i,
      label: '앱·SaaS 광고',
      cases: [
        ['workflow-before-after', '업무 전후', '흩어진 작업과 자동화 후 흐름을 대비'],
        ['ui-demo', 'UI 데모', '핵심 화면, 버튼, 결과물을 실제 제품처럼 보여줌'],
        ['time-saving', '시간 절감', '반복 작업 감소와 빠른 결과를 숫자/타임라인으로 표현'],
        ['integration', '통합 플랫폼', '여러 도구/자료/채널이 한 흐름으로 모이는 장면'],
        ['signup-loop', '가입 유도', '설치/가입/첫 결과까지의 심리적 장벽을 낮춤'],
      ],
    },
    event: {
      match: /이벤트|프로모션|할인|행사|오픈|모집|캠페인/i,
      label: '이벤트 광고',
      cases: [
        ['countdown', '카운트다운', '마감/기간/한정 수량으로 긴박감 형성'],
        ['benefit-first', '혜택 선공개', '혜택을 첫 화면에 즉시 보여주고 참여 이유 제시'],
        ['participation', '참여 방법', '참여 절차를 짧고 명확하게 안내'],
        ['social-spread', '공유 확산', '친구 태그, 공유, 댓글 참여를 유도'],
      ],
    },
    recruit: {
      match: /채용|팀|조직|문화|리크루팅|인재|커리어/i,
      label: '채용·팀 브랜딩 광고',
      cases: [
        ['team-day', '팀의 하루', '실제 일하는 장면과 표정을 통해 조직 문화를 보여줌'],
        ['mission-people', '미션과 사람', '회사의 문제의식과 함께 일할 사람의 모습을 연결'],
        ['growth-path', '성장 경로', '합류 후 배우고 성장하는 과정을 구체적 장면으로 제시'],
        ['workspace-culture', '공간·문화', '사무실/원격/협업 방식 등 일하는 환경을 시네마틱하게 전달'],
      ],
    },
    investor: {
      match: /투자|IR|피치|성장|시장|매출|지표|신뢰/i,
      label: '투자·IR 신뢰 광고',
      cases: [
        ['market-shift', '시장 변화 포착', '시장이 바뀌는 장면과 기회 규모를 먼저 보여줌'],
        ['traction-proof', '성과 증거', '지표, 고객, 반복 사용, 성장 흐름을 차분하게 증명'],
        ['team-trust', '팀 신뢰', '팀의 실행력과 전문성을 인물/공간/자료 컷으로 설계'],
        ['future-vision', '미래 비전', '제품이 만드는 미래 상태를 영화적 장면으로 각인'],
      ],
    },
    local: {
      match: /매장|방문|오프라인|카페|식당|병원|공간|위치|예약/i,
      label: '오프라인 방문 광고',
      cases: [
        ['arrival-experience', '방문 경험', '입구, 공간, 응대, 핵심 경험을 실제 방문처럼 연결'],
        ['signature-space', '공간 시그니처', '매장만의 색, 조명, 동선, 대표 장면을 각인'],
        ['reason-to-visit', '방문 이유', '지금 가야 하는 메뉴/혜택/서비스를 명확히 제시'],
        ['local-trust', '지역 신뢰', '동네 고객, 후기, 접근성을 자연스럽게 보여줌'],
      ],
    },
    content: {
      match: /콘텐츠|구독|티저|예고|유튜브|쇼츠|릴스|채널|시리즈/i,
      label: '콘텐츠 티저·구독 광고',
      cases: [
        ['curiosity-gap', '궁금증 후킹', '질문과 미완성 장면으로 다음 콘텐츠를 보게 만듦'],
        ['series-world', '시리즈 세계관', '반복 출연자/톤/장면 언어로 채널 정체성을 구축'],
        ['highlight-reel', '하이라이트 릴', '가장 강한 장면을 리듬 있게 모아 기대감을 만듦'],
        ['creator-promise', '크리에이터 약속', '구독하면 얻는 변화나 재미를 인물 중심으로 전달'],
      ],
    },
  };
  V._vagBuildObjectiveCaseBlock = function _vagBuildObjectiveCaseBlock(session) {
    var seed = [session && session.objective, session && session.baseTopic, session && session.tone].filter(Boolean).join(' ');
    var selectedKey = 'service';
    Object.keys(V._vagObjectiveCasePlaybooks).some(function (key) {
      if (V._vagObjectiveCasePlaybooks[key].match.test(seed)) {
        selectedKey = key;
        return true;
      }
      return false;
    });
    var playbook = V._vagObjectiveCasePlaybooks[selectedKey];
    var picked = playbook.cases.slice().sort(function (a, b) {
      return (V._vagHashText(seed + b[0]) % 100) - (V._vagHashText(seed + a[0]) % 100);
    }).slice(0, 5);
    if (session) {
      session.objectiveCaseFamily = playbook.label;
      session.objectiveCaseCandidates = picked.map(function (item) { return { code: item[0], label: item[1], desc: item[2] }; });
    }
    return [
      '[광고 목적별 세부 케이스 플레이북]',
      '- 큰 목적: ' + playbook.label,
      '- 같은 목적 안에서도 광고 구조가 달라야 한다. 아래 후보 중 주제/상품/자료에 가장 맞는 1개를 AI가 선택하고, 선택한 케이스 기준으로 씬·컷·이미지·CTA를 설계한다.',
      picked.map(function (item) { return '  - ' + item[1] + ' (' + item[0] + '): ' + item[2]; }).join('\n'),
      '- 상품 광고라면 상품 이미지/제품명/패키지/모델컷/사용컷/디테일컷/비교컷 중 무엇이 필요한지 먼저 판단한다.',
      '- 상품 이미지가 첨부되어 있으면 그 상품의 형태와 색을 유지하고, 없는 경우 먼저 상품 히어로컷을 생성한 뒤 사용컷/모델컷/디테일컷으로 확장한다.',
      '- 모델이 필요한 케이스는 모델의 연령대, 손/얼굴 노출 여부, 라이프스타일 상황을 image_prompt와 cut_plan에 명확히 쓴다.',
    ].join('\n');
  }
  V._vagInferObjectiveFromContext = function _vagInferObjectiveFromContext(context) {
    var c = context || {};
    var profile = c.profile || window._globalProfileData || {};
    var seed = [
      c.topic,
      c.source,
      c.sourceMode,
      profile.name,
      profile.category,
      profile.blog_category,
      profile.business_type,
      profile.industry,
      profile.service_description,
      profile.business_description,
      profile.target,
      profile.purpose,
    ].filter(Boolean).join(' ').toLowerCase();
    var rules = [
      { objective: '상품 판매/전환', reason: '상품·구매·상세페이지 맥락', match: /상품|제품|판매|구매|커머스|쇼핑|상세페이지|런칭|패키지|할인|가격|주문|결제|장바구니/ },
      { objective: '앱 설치/가입 유도', reason: '앱·SaaS·자동화 서비스 맥락', match: /앱|가입|다운로드|설치|saas|플랫폼|자동화|ai|툴|소프트웨어|대시보드|솔루션|워크플로|프로그램/ },
      { objective: '예약·상담 리드 수집', reason: '상담·예약·문의가 필요한 서비스 맥락', match: /상담|예약|문의|견적|진단|컨설팅|병원|치과|의원|클리닉|부동산|학원|에이전시|마케팅\s*대행/ },
      { objective: '오프라인 매장 방문', reason: '매장·방문·공간 경험 맥락', match: /매장|방문|오프라인|카페|식당|맛집|레스토랑|샵|공방|공간|위치|오시는|팝업/ },
      { objective: '교육·클래스 모집', reason: '교육·강의·수강 모집 맥락', match: /교육|강의|클래스|수업|강좌|수강|모집|스터디|코칭|멘토링|세미나|웨비나/ },
      { objective: '이벤트 홍보', reason: '이벤트·프로모션·행사 맥락', match: /이벤트|프로모션|행사|오픈|캠페인|체험단|사전예약|얼리버드|한정|마감/ },
      { objective: '후기·신뢰 형성', reason: '후기·성과·증거 중심 맥락', match: /후기|리뷰|사례|성과|전후|비교|검증|인증|수상|고객\s*사례|성공\s*사례|신뢰/ },
      { objective: '인포머셜·정보 전달', reason: '정보·가이드·사용법 설명 맥락', match: /정보|설명|사용법|가이드|체크리스트|튜토리얼|비교|방법|원리|FAQ|자주\s*묻/ },
      { objective: '채용·팀 브랜딩', reason: '채용·팀 문화 맥락', match: /채용|리크루팅|팀|조직문화|커리어|입사|동료|일하는\s*방식|인재/ },
      { objective: '투자·IR 신뢰 형성', reason: '투자·IR·지표 설득 맥락', match: /투자|ir|피치|시장성|성장성|매출|지표|traction|데모데이|밸류에이션/ },
      { objective: '콘텐츠 티저·구독 유도', reason: '콘텐츠·채널·구독 맥락', match: /콘텐츠|구독|티저|예고|유튜브|쇼츠|릴스|채널|시리즈|스레드|sns|블로그/ },
      { objective: '브랜드·CI 인지도', reason: '브랜드 정체성·CI/BI 각인 맥락', match: /브랜드|ci|bi|인지|철학|비전|미션|정체성|세계관|브랜딩|리브랜딩/ },
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].match.test(seed)) return { objective: rules[i].objective, reason: rules[i].reason };
    }
    return { objective: '서비스 소개', reason: '주제와 프로필을 서비스 소개형 구조로 해석' };
  }
  V._vagCatalogPool = function _vagCatalogPool() {
    var cat = window._vagHfCatalog || {};
    return V._vagUniqueList([].concat(cat.blocks || [], cat.examples || [], cat.components || []));
  }
  V._vagPickCatalogItems = function _vagPickCatalogItems(preferred, count, banned) {
    var pool = V._vagCatalogPool();
    var deny = V._vagUniqueList(banned || []);
    var picked = [];
    V._vagUniqueList(preferred || []).forEach(function (name) {
      if (picked.length >= count) return;
      if (pool.indexOf(name) < 0) return;
      if (deny.indexOf(name) >= 0 || picked.indexOf(name) >= 0) return;
      picked.push(name);
    });
    for (var i = 0; i < pool.length && picked.length < count; i++) {
      var item = pool[i];
      if (deny.indexOf(item) >= 0 || picked.indexOf(item) >= 0) continue;
      picked.push(item);
    }
    return picked;
  }
  V._vagSelectDesignFamily = function _vagSelectDesignFamily(session, aspect, options) {
    var opts = options || {};
    var packs = [
      {
        key: 'swiss-editorial',
        name: '스위스 에디토리얼',
        note: '넓은 여백, 정교한 그리드, serif + sans 대비, 흰/크림 배경, 조용하지만 날카로운 편집 매거진 무드',
        preferredTemplates: ['swiss-grid', 'vignelli', 'grid-pixelate-wipe', 'grain-overlay', 'kinetic-type'],
        imageStyles: ['magazine', 'photo-split', 'photo-card'],
        proofStyles: ['comparison-table', 'stat', 'timeline'],
        colorMode: '크림/화이트/먹색 바탕에 브랜드 색을 얇은 규칙선과 배지, CTA에 절제되게 사용',
        logoMode: '작은 에디토리얼 마스트헤드처럼 상단 또는 하단에 정교하게 배치',
      },
      {
        key: 'brutalist-retail',
        name: '브루탈리스트 리테일',
        note: '거친 타이포 블록, 큰 가격/숫자, 검정 또는 원색 배경, 포스터처럼 강한 대비, 직설적 상업 에너지',
        preferredTemplates: ['glitch', 'flash-through-white', 'transitions-push', 'transitions-grid', 'logo-outro'],
        imageStyles: ['photo-card', 'product-hero', 'deal-flash'],
        proofStyles: ['price-tag', 'discount-stamp', 'stat'],
        colorMode: '검정 또는 강한 원색 바탕에서 브랜드 색을 가격, 스탬프, CTA에 대담하게 사용',
        logoMode: '엔딩에서 로고를 크게 찍고, 초반엔 스탬프나 라벨처럼 과감하게 재등장',
      },
      {
        key: 'cinematic-luxe',
        name: '시네마틱 럭셔리',
        note: '딥 네이비/버건디/골드 계열, 극적인 조명, 느린 카메라 워크, 영화 타이틀 같은 헤드라인, 프리미엄 광고 필름',
        preferredTemplates: ['cinematic-zoom', 'light-leak', 'cross-warp-morph', 'ridged-burn', 'product-promo'],
        imageStyles: ['photo-card', 'product-hero', 'polaroid'],
        proofStyles: ['quote', 'testimonial', 'hero-mark'],
        colorMode: '어두운 배경과 깊은 톤 위에 브랜드 색을 유광 하이라이트와 라인 조명처럼 사용',
        logoMode: '영화 타이틀 락업처럼 중앙 또는 하단에 프리미엄 서명으로 배치',
      },
      {
        key: 'kinetic-sport',
        name: '키네틱 스포츠',
        note: '속도감 있는 대각선 레이아웃, 큰 sans 타이포, 짧은 카피, 충돌감 있는 모션, 나이키 런치 필름 같은 박력',
        preferredTemplates: ['whip-pan', 'kinetic-type', 'flash-through-white', 'swirl-vortex', 'transitions-mechanical'],
        imageStyles: ['photo-split', 'product-feature', 'mockup'],
        proofStyles: ['ranking', 'timeline', 'stat'],
        colorMode: '콘트라스트 강한 바탕에 브랜드 색을 스트라이프, 속도선, 숫자 강조에 공격적으로 사용',
        logoMode: '초반엔 작은 팀 마크처럼, 마지막엔 경기 종료 사인처럼 강하게 마무리',
      },
      {
        key: 'ui-data-motion',
        name: 'UI 데이터 모션',
        note: '앱 화면/대시보드/지표 카드, 명확한 정보 계층, 선명한 인포그래픽, 제품 효율과 전환 지표를 설득력 있게 시각화',
        preferredTemplates: ['app-showcase', 'ui-3d-reveal', 'data-chart', 'flowchart', 'decision-tree'],
        imageStyles: ['mockup', 'photo-split', 'magazine'],
        proofStyles: ['chart', 'comparison-table', 'bento'],
        colorMode: '차분한 UI 중성색 위에 브랜드 색을 버튼, 차트, 포커스 링, 진행 막대에 일관되게 사용',
        logoMode: '앱 상단 바나 대시보드 헤더의 제품 서명처럼 자연스럽게 삽입',
      },
      {
        key: 'warm-craft',
        name: '웜 크래프트',
        note: '따뜻한 종이 질감, 부드러운 그림자, 손맛 있는 배치, 감성 브랜드/푸드/라이프스타일 광고에 어울리는 아날로그 무드',
        preferredTemplates: ['warm-grain', 'grain-overlay', 'light-leak', 'ripple-waves', 'shimmer-sweep'],
        imageStyles: ['polaroid', 'magazine', 'photo-card'],
        proofStyles: ['quote', 'list', 'testimonial'],
        colorMode: '베이지/브라운/아이보리 바탕 속에 브랜드 색을 스티치, 라벨, 도장처럼 섞어 사용',
        logoMode: '패키지 라벨이나 종이 태그 같은 따뜻한 서명으로 배치',
      },
      {
        key: 'neo-collage',
        name: '네오 콜라주',
        note: '사진/텍스트/스티커/라벨을 과감히 충돌시키는 패션 캠페인 무드, 레이어가 많지만 의도적인 편집감',
        preferredTemplates: ['chromatic-radial-split', 'instagram-follow', 'tiktok-follow', 'x-post', 'reddit-post'],
        imageStyles: ['photo-card', 'polaroid', 'magazine'],
        proofStyles: ['ranking', 'review-card', 'comparison-table'],
        colorMode: '중성 바탕 위에 브랜드 색을 스티커, 테이프, 코멘트 버블처럼 튀게 사용',
        logoMode: '스티커 또는 워터마크처럼 여러 컷에 리듬감 있게 재등장',
      },
      {
        key: 'premium-minimal-tech',
        name: '프리미엄 미니멀 테크',
        note: '어두운 배경 위 정제된 하이라이트, 극도로 절제된 UI, 유광 하드웨어 같은 질감, 테크 런치 광고 무드',
        preferredTemplates: ['ui-3d-reveal', 'sdf-iris', 'gravitational-lens', 'chromatic-radial-split', 'app-showcase'],
        imageStyles: ['mockup', 'photo-card', 'product-hero'],
        proofStyles: ['stat', 'icon-grid', 'comparison-table'],
        colorMode: '짙은 배경 위에 브랜드 색을 가는 네온 엣지와 인터랙션 포인트로 정제되게 사용',
        logoMode: '하드웨어 런치 키노트처럼 중앙 히어로 마크 또는 미세한 하단 서명으로 사용',
      }
    ];
    var memory = (session && session.previousOutputSummary) || (V._vagThreadContext && V._vagThreadContext.previous_output_summary) || {};
    var banned = String((memory && memory.design_family) || '').trim();
    var bannedTemplates = V._vagUniqueList((memory && memory.hf_templates) || []);
    var seed = ((session && session.baseTopic) || '') + '|' + ((session && session.objective) || '') + '|' + ((session && session.tone) || '') + '|' + (aspect || '');
    var index = V._vagHashText(seed) % packs.length;
    for (var hop = 0; hop < packs.length; hop++) {
      var candidate = packs[(index + hop) % packs.length];
      if (!banned || (candidate.name !== banned && candidate.key !== banned)) {
        candidate = Object.assign({}, candidate);
        candidate.hfTemplates = V._vagPickCatalogItems(candidate.preferredTemplates, opts.templateCount || 4, bannedTemplates);
        candidate.imageStrategy = candidate.imageStyles.slice(0, 2).join(' + ');
        candidate.proofStrategy = candidate.proofStyles.slice(0, 2).join(' + ');
        return candidate;
      }
    }
    var fallback = Object.assign({}, packs[index]);
    fallback.hfTemplates = V._vagPickCatalogItems(fallback.preferredTemplates, opts.templateCount || 4, bannedTemplates);
    fallback.imageStrategy = fallback.imageStyles.slice(0, 2).join(' + ');
    fallback.proofStrategy = fallback.proofStyles.slice(0, 2).join(' + ');
    return fallback;
  }
  V._vagBuildVariationDesigns = function _vagBuildVariationDesigns(session, aspect, count) {
    var packs = [];
    var usedFamilyNames = [];
    var usedTemplates = [];
    var target = Math.max(2, count || 3);
    for (var i = 0; i < target; i++) {
      var ghostSession = Object.assign({}, session || {});
      var prevSummary = Object.assign({}, ((session && session.previousOutputSummary) || (V._vagThreadContext && V._vagThreadContext.previous_output_summary) || {}));
      if (usedFamilyNames.length) prevSummary.design_family = usedFamilyNames[usedFamilyNames.length - 1];
      prevSummary.hf_templates = ((prevSummary.hf_templates || []).concat(usedTemplates || []));
      ghostSession.previousOutputSummary = prevSummary;
      var pack = V._vagSelectDesignFamily(ghostSession, aspect, { templateCount: 4 });
      if (!pack) continue;
      if (packs.some(function (row) { return row.key === pack.key; })) continue;
      packs.push(pack);
      usedFamilyNames.push(pack.name);
      usedTemplates = usedTemplates.concat(pack.hfTemplates || []);
    }
    return packs;
  }
  V._vagBuildDesignFamilyBlock = function _vagBuildDesignFamilyBlock(session, aspect) {
    var pack = V._vagSelectDesignFamily(session, aspect, { templateCount: 4 });
    if (!pack) return '';
    if (session) {
      session.designFamily = pack.name;
      session.designSystem = {
        key: pack.key,
        name: pack.name,
        hfTemplates: pack.hfTemplates.slice(),
        imageStrategy: pack.imageStrategy,
        proofStrategy: pack.proofStrategy,
        imageStyles: pack.imageStyles.slice(),
        proofStyles: pack.proofStyles.slice(),
        colorMode: pack.colorMode,
        logoMode: pack.logoMode,
      };
    }
    var hasImages = Array.isArray(V._vagAttachedImages) && V._vagAttachedImages.length > 0;
    var hasSources = Array.isArray(V._vagAttachedSources) && V._vagAttachedSources.length > 0;
    return '[디자인 참고]\n분위기: ' + pack.name + ' — ' + pack.note + '\nAI가 이 분위기에 맞게 폰트, 색상, 레이아웃을 자율 판단.';
  }
  V._vagBuildBrandLockBlock = function _vagBuildBrandLockBlock(session) {
    var lines = ['[브랜드 락업 규칙]'];
    var brandColor = ((session && session.brandColor) || '').trim();
    var profile = window._globalProfileData || {};
    var profileName = String(profile.name || '').trim();
    var profileTone = String(profile.tone || profile.brand_tone || profile.style || profile.design_style || '').trim();
    var profileDesignRules = [
      profile.brand_colors ? '대표 색상 팔레트: ' + profile.brand_colors : '',
      !profile.brand_colors && profile.brand_color ? '대표 색상: ' + profile.brand_color : '',
      profile.design_tone ? '브랜드 무드: ' + profile.design_tone : '',
      profile.typography_rules ? '타이포그래피: ' + profile.typography_rules : '',
      profile.layout_rules ? '레이아웃/여백: ' + profile.layout_rules : '',
      profile.image_rules ? '이미지/사진: ' + profile.image_rules : '',
      profile.cta_rules ? 'CTA/강조: ' + profile.cta_rules : '',
      profile.design_forbidden ? '금지 디자인: ' + profile.design_forbidden : '',
      profile.design_rules ? '종합 규칙: ' + profile.design_rules : '',
    ].filter(Boolean).join('\n');
    var hasLogo = !!V._vagLogoDataUrl;
    var designSystem = session && session.designSystem ? session.designSystem : null;
    lines.push('최상위 규칙: 브랜드 디자인은 무조건 유지한다. 씬 스타일이 달라져도 브랜드 색, 카피 톤, CTA 스타일, 강조 요소의 시각 언어는 흔들리지 않아야 한다.');
    if (profileName) lines.push('브랜드명: ' + profileName + ' — 내부 기준으로만 사용한다. 화면 오른쪽 위/왼쪽 위에 워터마크나 상단 고정 브랜드명으로 반복하지 않는다.');
    if (profileTone) lines.push('프로필 브랜드 톤/스타일: ' + profileTone + ' — 카피와 시각 무드에 반영.');
    if (profileDesignRules) {
      lines.push('[프로필 상세 디자인 규칙]');
      lines.push(profileDesignRules);
      lines.push('규칙: 위 프로필 상세 디자인 규칙은 영상 씬 이미지, HyperFrames HTML, CTA, 오버레이, 타이포그래피에 모두 우선 적용한다.');
    }
    if (brandColor) {
      lines.push('브랜드 메인 색: ' + brandColor);
      lines.push('규칙: CSS 변수 --brand, --brand-rgb, --accent를 선언하고 CTA, divider, highlight, badge, progress, chart 또는 shape 중 최소 4곳에 이 색을 직접 사용.');
      lines.push('규칙: 앱 기본 CSS 변수 색을 브랜드색 대신 반복하지 말 것. 브랜드색이 있으면 브랜드색이 메인 액센트다.');
      lines.push('규칙: 배경은 달라져도 브랜드 색은 항상 살아 있어야 하며, 첫 씬/중간 증거 씬/마지막 CTA 씬에서 각각 눈에 띄게 사용.');
      lines.push('규칙: 이미지 배경 위 텍스트 박스, 오버레이, 하이라이트, 버튼류도 브랜드색 계열로 정리하고 무작위 보색 팔레트로 바꾸지 말 것.');
    }
    if (designSystem && designSystem.colorMode) lines.push('색 사용 방식: ' + designSystem.colorMode);
    if (hasLogo) {
      lines.push('로고 사용: 이미지 생성 참고 전용');
      lines.push('규칙: 제공된 로고는 씬 배경 이미지/키비주얼 안에 자연스럽게 녹여 넣기 위한 reference다.');
      lines.push('규칙: HyperFrames HTML에서 로고 이미지를 별도 <img> 레이어로 얹지 않는다. 로고가 필요하면 배경 이미지 생성/편집 단계에서 공간, 소품, 제품 표식처럼 자연스럽게 포함한다.');
    } else {
      lines.push('로고 사용: 없음');
      lines.push('규칙: 로고가 없다고 해서 브랜드명을 화면 구석 워터마크나 상단 고정 표기로 만들지 않는다.');
    }
    if (designSystem && designSystem.logoMode) lines.push('로고/브랜드명 배치 참고는 최종 CTA 문맥에서만 사용한다. 화면 구석 고정 배치는 만들지 않는다.');
    lines.push('규칙: HTML 레이어에 로고 이미지, 브랜드명 워터마크, 상단 구석 브랜드 표식을 만들지 않는다. 브랜드 표현은 선택된 CTA나 마지막 문구가 필요할 때만 자연스럽게 사용한다.');
    lines.push('[모션 리듬 규칙]');
    lines.push('규칙: 모든 씬을 같은 fade/slide 카드로 만들지 말 것. 씬마다 entry, camera, background, text reveal, transition 중 최소 2가지를 다르게 설계.');
    lines.push('규칙: 최소 1개 씬은 kinetic type, 1개 씬은 data/progress motion, 1개 씬은 parallax/camera move, 마지막 씬은 CTA lock-up motion으로 구분.');
    lines.push('규칙: 1씬 masked reveal/parallax, 2씬 split wipe, 3씬 counter/chart, 4씬 line draw/focus pull, 5씬 depth zoom, 마지막 CTA pulse처럼 장면별 주효과를 분리.');
    lines.push('규칙: GSAP timeline에 stagger, clipPath/mask reveal, scale/rotate parallax, line draw/progress, hold/punch transition을 섞고 같은 ease를 연속 3씬 이상 반복하지 말 것.');
    return lines.join('\n');
  }
})();
