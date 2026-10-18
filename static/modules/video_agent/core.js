/**
 * video_agent/core.js
 * 영상 에이전트 (core 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  V._resetBtn = function _resetBtn() {
    var btn = document.getElementById('vag-gen-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 대화로 시작하기'; }
  }

  V.vagOpenFolder = function vagOpenFolder() {
    if (V._vagResult && V._vagResult.project_dir) {
      fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: V._vagResult.project_dir }) });
    }
  }

  V.vagCopyFinalPrompt = async function vagCopyFinalPrompt() {
    var text = (V._vagResult && V._vagResult.final_prompt) || (document.getElementById('vag-final-prompt') || {}).value || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      V._vagToast('HyperFrames 최종 프롬프트를 복사했습니다.');
    } catch (e) {
      V._vagToast('프롬프트 복사에 실패했습니다.', 'error');
    }
  }

  V.vagResetTextEdits = function vagResetTextEdits() {
    if (!V._vagTextEntries.length) {
      V._vagToast('편집할 문구가 없습니다.', 'error');
      return;
    }
    V._vagRenderTextEditCard();
    V._vagToast('문구를 원본으로 되돌렸습니다.');
  }

  V._vagCollectSceneNarrationEdits = function _vagCollectSceneNarrationEdits(baseHtml) {
    if (typeof V._vagSyncScenarioChatEditorToSession === 'function') {
      V._vagSyncScenarioChatEditorToSession();
    }
    var inputs = document.querySelectorAll('#vag-text-edit-list [data-vag-ref]');
    var sceneNarrationInputs = document.querySelectorAll('#vag-text-edit-list [data-vag-scene-narration]');
    var sceneNarrations = [];
    sceneNarrationInputs.forEach(function (inp) {
      var value = String(inp.value || '').trim();
      if (typeof V._vagNormalizeNarrationForSpeech === 'function') value = V._vagNormalizeNarrationForSpeech(value, {});
      sceneNarrations[parseInt(inp.getAttribute('data-vag-scene-narration') || '0', 10) || 0] = value;
    });
    var changes = {};
    var anyChanged = false;
    inputs.forEach(function (inp) {
      var ref = inp.getAttribute('data-vag-ref');
      var val = String(inp.value == null ? '' : inp.value);
      var entry = (V._vagTextEntries || []).find(function (item) { return item.ref === ref; });
      if (!entry) return;
      changes[ref] = val;
      if (val !== entry.text) anyChanged = true;
    });
    var narrationBox = document.getElementById('vag-narration-edit');
    var voiceSelect = document.getElementById('vag-voice-select');
    var voiceHidden = document.getElementById('vag-voice');
    if (voiceSelect && voiceHidden) voiceHidden.value = voiceSelect.value || '';
    var sceneScript = sceneNarrations.filter(Boolean).join('\n').trim();
    var narrationScript = sceneScript || (narrationBox ? String(narrationBox.value || '').trim() : '');
    var html = anyChanged && typeof V._vagApplyTextEditsToHtml === 'function'
      ? V._vagApplyTextEditsToHtml(baseHtml || V._vagHyperHtml || '', changes)
      : (baseHtml || V._vagHyperHtml || '');
    if (sceneNarrations.length && typeof V._vagApplySceneNarrationToHtml === 'function') {
      html = V._vagApplySceneNarrationToHtml(html, sceneNarrations, { mirrorVisible: true });
    }
    if (V._vagSession && sceneNarrations.length) {
      V._vagSession.sceneNarrationPlan = (V._vagSession.sceneNarrationPlan || []).map(function (scene, idx) {
        return Object.assign({}, scene, { narration: sceneNarrations[idx] || scene.narration || '' });
      });
    }
    if (narrationBox && sceneScript) narrationBox.value = sceneScript;
    return { html: html, narrationScript: narrationScript, voice: voiceHidden ? String(voiceHidden.value || '') : '', changed: anyChanged || sceneNarrations.length > 0 };
  }

  V._vagAwaitSceneNarrationApproval = function _vagAwaitSceneNarrationApproval(options) {
    var opts = options || {};
    var card = document.getElementById('vag-text-edit-card');
    if (!card || typeof V._vagRenderTextEditCard !== 'function') {
      return Promise.resolve({ ok: true, html: opts.html || V._vagHyperHtml || '', narrationScript: opts.narrationScript || '' });
    }
    if (V._vagSession) {
      V._vagSession.hyperHtml = opts.html || V._vagHyperHtml || '';
      V._vagSession.hyperDuration = opts.duration || V._vagSession.hyperDuration || 0;
      V._vagSession.narrationScript = opts.narrationScript || V._vagSession.narrationScript || '';
    }
    V._vagHyperHtml = opts.html || V._vagHyperHtml || '';
    if (opts.chatEditorOnly) {
      var list = document.getElementById('vag-text-edit-list');
      if (list) {
        var count = (V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan)) ? V._vagSession.sceneNarrationPlan.length : 0;
        list.innerHTML =
          '<div style="padding:14px;border-radius:14px;border:1px solid rgba(255,140,0,0.14);background:rgba(255,248,241,0.62);font-size:12px;line-height:1.55;color:rgba(0,0,0,0.68);">' +
            '<b style="color:#1c1c1e;">왼쪽 장면 편집창에서 확인 중</b><br>' +
            '장면 ' + count + '개를 왼쪽에서 수정하고, 아래 버튼을 누르면 이 내용으로 영상을 만듭니다.' +
          '</div>';
      }
    } else {
      V._vagRenderTextEditCard();
    }
    card.style.display = 'block';
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    V._vagSetStage('code', 'ready', opts.stageTitle || '장면·나레이션 확인 대기', opts.stageDetail || '수정 후 확인하면 AI 음성과 MP4 만들기를 시작합니다.');
    V._vagSetStage('render', 'idle', opts.renderStageTitle || '렌더 전 확인 필요', opts.renderStageDetail || '아직 영상 파일을 만들지 않았습니다.');

    return new Promise(function (resolve) {
      var existing = document.getElementById('vag-render-approval-row');
      if (existing) existing.remove();
      var row = document.createElement('div');
      row.id = 'vag-render-approval-row';
      row.style.cssText = 'position:sticky;bottom:0;z-index:2;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:14px;padding:14px;border:1px solid rgba(255,140,0,0.18);border-radius:16px;background:rgba(255,255,255,0.96);box-shadow:0 -8px 24px rgba(0,0,0,0.06);';
      row.innerHTML =
        '<div style="min-width:180px;">' +
          '<div style="font-size:12px;font-weight:950;color:#1c1c1e;">' + V._esc(opts.approvalTitle || '수정이 끝났나요?') + '</div>' +
          '<div style="font-size:11px;color:rgba(0,0,0,0.50);line-height:1.45;margin-top:3px;">' + V._esc(opts.approvalDetail || '이 버튼을 누르면 현재 장면별 나레이션으로 AI 음성과 MP4 만들기를 시작합니다.') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;">' +
          '<button id="vag-render-cancel" type="button" style="padding:10px 13px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.62);font-size:11px;font-weight:900;cursor:pointer;">생성 취소</button>' +
          '<button id="vag-render-confirm" type="button" style="min-width:190px;padding:12px 16px;border-radius:13px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 10px 22px rgba(255,107,0,0.24);">' + V._esc(opts.confirmLabel || '음성 만들고 영상 생성 시작') + '</button>' +
        '</div>';
      card.appendChild(row);
      if (typeof V._vagRenderScenarioChatEditor === 'function') {
        V._vagRenderScenarioChatEditor(opts);
      }

      var cleanup = function () {
        var current = document.getElementById('vag-render-approval-row');
        if (current) current.remove();
      };
      var confirmBtn = document.getElementById('vag-render-confirm');
      var cancelBtn = document.getElementById('vag-render-cancel');
      var approveNow = function () {
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = opts.confirmWorkingLabel || '생성중...';
        }
        if (cancelBtn) cancelBtn.disabled = true;
        var result = V._vagCollectSceneNarrationEdits(opts.html || V._vagHyperHtml || '');
        V._vagHyperHtml = result.html;
        if (V._vagSession) {
          V._vagSession.hyperHtml = result.html;
          V._vagSession.narrationScript = result.narrationScript;
          V._vagSession.narrationVoice = result.voice || '';
        }
        cleanup();
        resolve({ ok: true, html: result.html, narrationScript: result.narrationScript, voice: result.voice || '' });
      };
      if (confirmBtn) confirmBtn.onclick = function () {
        approveNow();
      };
      var chatConfirmBtn = document.getElementById('vag-scenario-chat-confirm');
      if (chatConfirmBtn && opts.chatEditorOnly) {
        chatConfirmBtn.onclick = function () {
          chatConfirmBtn.disabled = true;
          chatConfirmBtn.textContent = opts.confirmWorkingLabel || '영상 만드는 중...';
          if (typeof V._vagSetStage === 'function') {
            V._vagSetStage('code', 'working', '영상 만들기 시작', '확정한 장면 흐름으로 영상을 만들기 시작합니다.');
          }
          if (confirmBtn && !confirmBtn.disabled) confirmBtn.click();
          else approveNow();
        };
      }
      if (cancelBtn) cancelBtn.onclick = function () {
        cleanup();
        resolve({ ok: false, html: opts.html || V._vagHyperHtml || '', narrationScript: opts.narrationScript || '' });
      };
    });
  }

  V.vagApplyTextEdits = async function vagApplyTextEdits() {
    if (!V._vagHyperHtml) {
      V._vagToast('먼저 영상을 생성해주세요.', 'error');
      return;
    }
    var inputs = document.querySelectorAll('#vag-text-edit-list [data-vag-ref]');
    var narrationBox = document.getElementById('vag-narration-edit');
    var sceneNarrationInputs = document.querySelectorAll('#vag-text-edit-list [data-vag-scene-narration]');
    var sceneNarrations = [];
    sceneNarrationInputs.forEach(function (inp) {
      var value = String(inp.value || '').trim();
      if (typeof V._vagNormalizeNarrationForSpeech === 'function') value = V._vagNormalizeNarrationForSpeech(value, {});
      sceneNarrations[parseInt(inp.getAttribute('data-vag-scene-narration') || '0', 10) || 0] = value;
    });
    var sceneScript = sceneNarrations.filter(Boolean).join('\n').trim();
    var narrationValue = sceneScript || (narrationBox ? String(narrationBox.value || '').trim() : '');
    var narrationOriginal = narrationBox ? String(narrationBox.dataset.originalValue || '').trim() : '';
    var sceneNarrationChanged = sceneNarrations.length > 0;
    var narrationChanged = narrationValue && (sceneNarrationChanged || narrationValue !== narrationOriginal);
    if (!inputs.length && !narrationChanged) {
      V._vagToast('편집 가능한 문구가 없습니다.', 'error');
      return;
    }
    var changes = {};
    var anyChanged = false;
    inputs.forEach(function (inp) {
      var ref = inp.getAttribute('data-vag-ref');
      var val = String(inp.value == null ? '' : inp.value);
      var entry = null;
      for (var i = 0; i < V._vagTextEntries.length; i++) {
        if (V._vagTextEntries[i].ref === ref) { entry = V._vagTextEntries[i]; break; }
      }
      if (!entry) return;
      changes[ref] = val;
      if (val !== entry.text) anyChanged = true;
    });
    if (!anyChanged && !narrationChanged) {
      V._vagToast('수정된 문구가 없습니다.');
      return;
    }

    var applyBtn = document.getElementById('vag-text-apply');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.style.opacity = '0.6'; applyBtn.textContent = '반영 중...'; }

    try {
      var updatedHtml = anyChanged ? V._vagApplyTextEditsToHtml(V._vagHyperHtml, changes) : V._vagHyperHtml;
      if (sceneNarrationChanged && typeof V._vagApplySceneNarrationToHtml === 'function') {
        updatedHtml = V._vagApplySceneNarrationToHtml(updatedHtml, sceneNarrations, { mirrorVisible: true });
      }
      V._vagHyperHtml = updatedHtml;
      if (V._vagSession) {
        V._vagSession.hyperHtml = updatedHtml;
        if (narrationChanged) V._vagSession.narrationScript = narrationValue;
        if (sceneNarrationChanged) {
          V._vagSession.sceneNarrationPlan = (V._vagSession.sceneNarrationPlan || []).map(function (scene, idx) {
            return Object.assign({}, scene, { narration: sceneNarrations[idx] || scene.narration || '' });
          });
        }
      }
      if (narrationBox && narrationChanged) narrationBox.dataset.originalValue = narrationValue;
      V._vagUpdateWorkspace();
      V._vagRenderTextEditCard();

      var aspect = (document.getElementById('vag-aspect') || {}).value || '9:16';
      var duration = (V._vagSession && V._vagSession.hyperDuration) || Number((document.getElementById('vag-scene-count') || {}).value || 4) * 2 || 8;
      var topic = (V._vagSession && V._vagSession.baseTopic) || (document.getElementById('vag-topic') || {}).value || '마케팅 영상';

      V._vagSetStage('code', 'working', '문구 반영 중', narrationChanged ? '장면 문구와 나레이션 대본을 같은 결과에 반영합니다.' : '현재 영상 화면에 문구만 교체합니다.');
      V._vagSetStage('code', 'ready', '영상 화면 갱신 완료', '조정값을 미리보기 화면에 반영했습니다.');

      V._vagSetStage('render', 'working', 'MP4 재렌더 중', narrationChanged ? '나레이션 조정값까지 반영해 다시 렌더링합니다.' : '문구만 교체된 영상을 다시 렌더링합니다.');
      var renderData = null;
      try {
        renderData = await V._vagRenderNativeAsync({
          html: updatedHtml,
          name: topic || 'hyperframes-marketing-video',
          fps: 30,
          quality: 'standard',
          format: 'mp4',
          duration: duration,
        }, {
          label: '🍊 문구 반영본 렌더 진행 중',
          sub: narrationChanged ? '레이아웃은 유지하고 나레이션·문구만 바뀐 새 영상을 만들고 있습니다.' : '레이아웃은 유지하고 문구만 바뀐 새 영상을 만들고 있습니다.',
          log: narrationChanged ? '나레이션·문구 교체본 렌더 요청을 보냈습니다.' : '문구 교체본 렌더 요청을 보냈습니다.',
        });
      } catch (renderErr) {
        if (V._vagIsGoNativeMissingEndpoint && V._vagIsGoNativeMissingEndpoint(renderErr)) {
          V._vagShowHtmlMotionPreview(updatedHtml, {
            topic: topic,
            aspect: aspect,
            duration: duration,
            finalPrompt: (V._vagResult && V._vagResult.final_prompt) || '',
          });
          V._vagSetStage('render', 'muted', '문구 반영 미리보기 준비 완료', 'MP4 만들기 기능이 없어 미리보기만 갱신했습니다.');
          V._addMsg('ai', '<span style="color:#ff9500;">' + (narrationChanged ? '나레이션과 문구는' : '문구는') + ' 미리보기에 반영했습니다. 현재 서버에서는 MP4 파일 재생성을 건너뜁니다.</span>');
          V._vagToast((narrationChanged ? '나레이션과 문구를' : '문구를') + ' 미리보기에 반영했습니다.');
          return;
        }
        throw renderErr;
      }
      if (!renderData || !renderData.path) {
        throw new Error('렌더 결과를 받지 못했습니다.');
      }

      var outputDir = V._vagParentDir(renderData.path);
      V._vagResult = Object.assign({}, V._vagResult || {}, {
        video_path: renderData.path,
        project_dir: outputDir,
      });
      V._vagRenderMeta = aspect + ' · ' + duration + '초 · ' + (narrationChanged ? '나레이션·문구 교체본' : '문구 교체본');

      var resultEl = document.getElementById('vag-result');
      if (resultEl) resultEl.style.display = 'block';
      var player = document.getElementById('vag-video-player');
      if (player && renderData.url) {
        player.src = renderData.url + (renderData.url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      }
      var meta = document.getElementById('vag-result-meta');
      if (meta) meta.textContent = V._vagRenderMeta;
      V._vagSetStage('render', 'ready', '문구 반영 영상 완료', V._vagRenderMeta);

      try {
        var profileData = window._globalProfileData || {};
        var editSummary = V._vagCollectOutputSummary(updatedHtml, V._vagSession);
        if (V._vagSession) V._vagSession.previousOutputSummary = editSummary;
        V._vagPersistState('completed', 'completed', {
          previous_output_summary: editSummary,
          last_render: {
            topic: topic,
            video_path: renderData.path,
            project_dir: outputDir,
            aspect: aspect,
            duration: duration,
            mode: narrationChanged ? 'narration-text-edit' : 'text-edit',
          },
        }, 'text_edit_render_ready', {
          topic: topic,
          video_path: renderData.path,
          aspect: aspect,
        });
        await V._vagFetch('/api/vag/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: (topic || '마케팅 영상') + (narrationChanged ? ' (나레이션·문구 교체)' : ' (문구 교체)'),
            video_path: renderData.path,
            project_dir: outputDir,
            scene_count: Math.max(3, Math.round(duration / 2)),
            aspect: aspect,
            voice: 'hyperframes-text-edit',
            profile_name: profileData.name || '',
            profile_id: window._globalProfileId || null,
            final_prompt: (V._vagResult && V._vagResult.final_prompt) || '',
            thread_id: V._vagThreadId || '',
            session_context: V._vagThreadContext || {},
            previous_output_summary: editSummary,
          }),
        });
      } catch (e) { /* ignore */ }

      V._vagToast(narrationChanged ? '나레이션과 문구를 반영했습니다.' : '문구만 반영한 새 영상을 만들었습니다.');
    } catch (e) {
      V._addMsg('ai', '<span style="color:#ff3b30;">문구 반영 오류: ' + V._esc(e.message || '') + '</span>');
      V._vagSetStage('render', 'error', '문구 반영 실패', e.message || '재렌더 중 오류가 발생했습니다.');
      V._vagToast('문구 반영에 실패했습니다.', 'error');
    } finally {
      V._vagHideRenderOverlay();
      if (applyBtn) { applyBtn.disabled = false; applyBtn.style.opacity = '1'; applyBtn.textContent = '문구만 반영'; }
    }
  }

  V.vagCopyCode = async function vagCopyCode() {
    if (!V._vagHyperHtml) return;
    try {
      await navigator.clipboard.writeText(V._vagHyperHtml);
      V._vagToast('영상 원본을 복사했습니다.');
    } catch (e) {
      V._vagToast('코드 복사에 실패했습니다.', 'error');
    }
  }

  V.vagSyncStudio = async function vagSyncStudio() {
    if (!V._vagHyperHtml) {
      V._vagToast('먼저 영상을 만들어주세요.', 'error');
      return;
    }
    V._vagSetStage('code', 'working', '영상 원본 저장 중', '현재 미리보기 화면을 로컬 프로젝트 파일로 저장합니다.');
    try {
      await V._vagSyncStudioProject((V._vagSession && V._vagSession.baseTopic) || (document.getElementById('vag-topic') || {}).value || '마케팅 영상');
      V._vagSetStage('code', 'ready', '영상 원본 저장 완료', (V._vagStudioProjectId || '현재 프로젝트') + '를 최신 상태로 갱신했습니다.');
      V._vagLoadStudioFrame(true);
      V._vagToast('현재 영상 원본을 저장했습니다.');
    } catch (e) {
      V._vagSetStage('code', 'error', '영상 원본 저장 실패', e.message || '프로젝트 저장에 실패했습니다.');
      V._vagToast('영상 원본 저장에 실패했습니다.', 'error');
    }
  }

  V._vagIsGoNativeRuntime = async function _vagIsGoNativeRuntime() {
    try {
      var resp = await fetch('/api/runtime/status');
      var data = await resp.json();
      return resp.ok && /go-native/i.test(String(data && (data.mode || data.runtime) || ''));
    } catch (_) {
      return false;
    }
  }

  V.vagRefreshStudio = function vagRefreshStudio() {
    if (!V._vagStudioProjectId) return;
    V._vagLoadStudioFrame(true);
  }

  V.vagOpenStudio = function vagOpenStudio() {
    // 현재 세션 프로젝트가 있으면 그걸로 열고, 없으면 Studio 홈(프로젝트 목록)으로 연다.
    if (V._vagStudioProjectId) {
      window.open(V._vagStudioUrl(V._vagStudioProjectId, true), '_blank', 'noopener');
    } else {
      window.open('/api/hyperframes/studio', '_blank', 'noopener');
    }
  }

  V._vagBuildMotionFromDesignHtml = function _vagBuildMotionFromDesignHtml(sourceHtml, options) {
    var html = String(sourceHtml || '').trim();
    var opts = options || {};
    var aspect = opts.aspect || '9:16';
    var size = aspect === '16:9' ? { w: 1920, h: 1080 } : aspect === '1:1' ? { w: 1080, h: 1080 } : { w: 1080, h: 1920 };
    var duration = Math.max(8, Math.round(Number(opts.duration || 12) || 12));
    var title = opts.topic || '마케팅 영상';
    var sourceText = _vagSanitizeMotionBrief(opts.source || opts.brief || '');
    var accent = /^#[0-9A-Fa-f]{6}$/.test(String(opts.brandColor || '').trim())
      ? String(opts.brandColor).trim()
      : _vagInferMotionAccent(html);
    var nativeFallbackLines = [];
    if (!html) {
      nativeFallbackLines = [title]
        .concat(sourceText ? sourceText.split(/[.!?\n。！？]+/).map(function (line) { return _vagCleanMotionFallbackLine(line); }) : [])
        .filter(Boolean)
        .slice(0, 5);
      if (nativeFallbackLines.length < 4) {
        nativeFallbackLines = nativeFallbackLines.concat([
          '고객이 바로 이해하는 핵심 메시지',
          '문제와 해결책을 짧은 장면으로 전달',
          '마지막 CTA까지 자연스럽게 연결',
        ]).slice(0, 5);
      }
      if (!nativeFallbackLines.length) nativeFallbackLines = ['마케팅 영상', '핵심 메시지를 모션으로 강조', 'CTA까지 빠르게 전달'];
      html = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>' +
        'html,body{margin:0;width:100%;height:100%;font-family:Arial,Helvetica,sans-serif;background:#fff7ed;color:#111;overflow:hidden;}' +
        '.fallback{box-sizing:border-box;width:100%;height:100%;padding:8%;display:flex;flex-direction:column;justify-content:center;gap:28px;background:linear-gradient(135deg,#fff7ed,#ffffff 48%,#f1f5f9);}' +
        '.kicker{display:inline-flex;align-self:flex-start;padding:10px 16px;border-radius:999px;background:#111;color:#fff;font-size:28px;font-weight:900;}' +
        'h1{margin:0;font-size:82px;line-height:1.05;letter-spacing:0;font-weight:950;max-width:82%;}' +
        '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;width:min(860px,88%);}' +
        '.card{padding:22px 24px;border:1px solid rgba(0,0,0,.08);border-radius:18px;background:rgba(255,255,255,.78);box-shadow:0 14px 34px rgba(15,23,42,.08);font-size:28px;font-weight:800;line-height:1.35;}' +
        '.cta{align-self:flex-start;margin-top:10px;padding:18px 28px;border-radius:999px;background:' + accent + ';color:#fff;font-size:30px;font-weight:950;box-shadow:0 18px 44px rgba(15,23,42,.18);}' +
        '</style></head><body><main class="fallback"><div class="kicker">Motion Preview</div><h1>' + V._esc(nativeFallbackLines[0]) + '</h1><section class="grid">' +
        nativeFallbackLines.slice(1, 5).map(function (line) { return '<div class="card">' + V._esc(line) + '</div>'; }).join('') +
        '</section><div class="cta">지금 확인하기</div></main></body></html>';
    }
    var texts = [];
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      Array.from(doc.querySelectorAll('h1,h2,h3,p,li,button,a,.title,.headline,.cta')).forEach(function (el) {
        var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length >= 2 && texts.indexOf(text) < 0) texts.push(text);
      });
    } catch (_) {}
    if (!texts.length) texts = [title, '디자인을 영상으로 전환', '핵심 메시지를 모션으로 강조'];
    texts = texts.slice(0, 6);
    var renderedSlides = Array.isArray(opts.renderedSlides) ? opts.renderedSlides : (Array.isArray(opts.rendered_slides) ? opts.rendered_slides : []);
    renderedSlides = renderedSlides.filter(function (slide) {
      return slide && typeof slide.image === 'string' && /^data:image\//i.test(slide.image);
    }).slice(0, 30);
    var slideTexts = Array.isArray(opts.slideTexts) ? opts.slideTexts : (Array.isArray(opts.slide_texts) ? opts.slide_texts : []);
    if (slideTexts.length) texts = _vagBuildCapturedNarrationLines(slideTexts, title);
    if (nativeFallbackLines.length) {
      var nativeScenes = _vagBuildNativeMotionSceneCopy(nativeFallbackLines, title, duration, opts.sceneCount);
      var nativeSceneDuration = duration / nativeScenes.length;
      var nativeFrames = nativeScenes.map(function (scene, i) {
        var start = i * nativeSceneDuration;
        return '<section id="design-frame-' + i + '" class="clip scene-frame scene-' + V._esc(scene.family || scene.key) + '" data-start="' + start.toFixed(2) + '" data-duration="' + nativeSceneDuration.toFixed(2) + '" data-track-index="' + (4 + i) + '">' +
          '<div class="motion-grid"></div><div class="motion-scan"></div><div class="motion-shape shape-a"></div><div class="motion-shape shape-b"></div><div class="motion-shape shape-c"></div><div class="motion-panel panel-a"></div><div class="motion-panel panel-b"></div><div class="motion-line line-a"></div><div class="motion-line line-b"></div>' +
          '<main class="fallback">' +
            '<div class="kicker">' + V._esc(scene.label) + '</div>' +
            '<h1>' + V._esc(scene.title) + '</h1>' +
            '<p>' + V._esc(scene.body) + '</p>' +
            '<div class="metric"><span></span>' + V._esc(scene.stat) + '</div>' +
            '<div class="scene-chips"><span>' + V._esc(scene.chipA || 'AI 구성') + '</span><span>' + V._esc(scene.chipB || '자동 렌더') + '</span></div>' +
          '</main>' +
        '</section>';
      }).join('\n');
      var nativeTweens = nativeScenes.map(function (_, i) {
        var id = '#design-frame-' + i;
        var start = i * nativeSceneDuration;
        var end = Math.min(duration, start + nativeSceneDuration);
        var panX = i % 2 === 0 ? -Math.round(size.w * 0.018) : Math.round(size.w * 0.014);
        var panY = i % 2 === 0 ? -Math.round(size.h * 0.01) : Math.round(size.h * 0.008);
        return 'tl.set("' + id + '",{opacity:0},0);' +
          'tl.set("' + id + '",{opacity:1,x:0,y:0,scale:1},' + start.toFixed(2) + ');' +
          'tl.fromTo("' + id + '",{scale:1.035,x:' + (-panX) + ',y:' + (-panY) + '},{scale:1,x:0,y:0,duration:.42,ease:"power3.out"},' + start.toFixed(2) + ');' +
          'tl.fromTo("' + id + ' .shape-a",{x:-60,y:80,rotate:-12,opacity:0},{x:0,y:0,rotate:0,opacity:1,duration:.55,ease:"power3.out"},' + (start + .05).toFixed(2) + ');' +
          'tl.fromTo("' + id + ' .shape-b",{x:70,y:-80,rotate:18,opacity:0},{x:0,y:0,rotate:0,opacity:1,duration:.55,ease:"power3.out"},' + (start + .1).toFixed(2) + ');' +
          'tl.fromTo("' + id + ' .shape-c",{scale:.72,rotate:25,opacity:0},{scale:1,rotate:0,opacity:.72,duration:.6,ease:"expo.out"},' + (start + .16).toFixed(2) + ');' +
          'tl.fromTo("' + id + ' .motion-panel",{y:80,opacity:0,clipPath:"inset(0 100% 0 0)"},{y:0,opacity:1,clipPath:"inset(0 0% 0 0)",duration:.55,stagger:.08,ease:"power4.out"},' + (start + .18).toFixed(2) + ');' +
          'tl.fromTo("' + id + ' .motion-scan",{xPercent:-120,opacity:.0},{xPercent:120,opacity:.7,duration:' + Math.max(1.2, nativeSceneDuration * .42).toFixed(2) + ',ease:"power1.inOut"},' + (start + .2).toFixed(2) + ');' +
          'tl.from("' + id + ' .kicker",{y:18,opacity:0,duration:.32,ease:"power3.out"},' + (start + .12).toFixed(2) + ');' +
          'tl.from("' + id + ' h1",{y:42,opacity:0,duration:.5,ease:"power3.out"},' + (start + .22).toFixed(2) + ');' +
          'tl.from("' + id + ' p",{y:26,opacity:0,duration:.38,ease:"power2.out"},' + (start + .42).toFixed(2) + ');' +
          'tl.from("' + id + ' .metric",{y:22,opacity:0,scale:.98,duration:.34,ease:"back.out(1.3)"},' + (start + .62).toFixed(2) + ');' +
          'tl.from("' + id + ' .scene-chips span",{y:20,opacity:0,scale:.92,duration:.3,stagger:.07,ease:"back.out(1.5)"},' + (start + .78).toFixed(2) + ');' +
          'tl.to("' + id + ' .line-a",{scaleX:1,duration:' + Math.max(.8, nativeSceneDuration - .9).toFixed(2) + ',ease:"none"},' + (start + .45).toFixed(2) + ');' +
          'tl.to("' + id + ' .line-b",{scaleX:1,duration:' + Math.max(.7, nativeSceneDuration - 1.1).toFixed(2) + ',ease:"none"},' + (start + .62).toFixed(2) + ');' +
          'tl.to("' + id + ' .shape-a",{x:"+=36",y:"-=24",rotate:"+=8",duration:' + Math.max(.6, nativeSceneDuration - .4).toFixed(2) + ',ease:"sine.inOut"},' + (start + .35).toFixed(2) + ');' +
          'tl.to("' + id + ' .shape-b",{x:"-=28",y:"+=38",rotate:"-=10",duration:' + Math.max(.6, nativeSceneDuration - .4).toFixed(2) + ',ease:"sine.inOut"},' + (start + .35).toFixed(2) + ');' +
          'tl.to("' + id + ' .shape-c",{rotate:"+=22",scale:1.08,duration:' + Math.max(.6, nativeSceneDuration - .5).toFixed(2) + ',ease:"none"},' + (start + .42).toFixed(2) + ');' +
          'tl.to("' + id + '",{scale:1.026,x:' + panX + ',y:' + panY + ',duration:' + Math.max(.6, nativeSceneDuration - .45).toFixed(2) + ',ease:"none"},' + (start + .42).toFixed(2) + ');' +
          (i < nativeScenes.length - 1 ? 'tl.to("' + id + '",{opacity:0,duration:.24,ease:"power2.in"},' + (end + .08).toFixed(2) + ');tl.set("' + id + '",{opacity:0},' + (end + .34).toFixed(2) + ');' : '');
      }).join('\n');
      return '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + V._esc(title) + '</title>\n<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></scr' + 'ipt>\n<style>\n' +
        'html,body{margin:0;width:100%;height:100%;background:#101828;font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden;}\n' +
        '[data-composition-id=\"makeke-html-motion\"]{position:relative;width:' + size.w + 'px;height:' + size.h + 'px;overflow:hidden;background:#101828;}\n' +
        '.scene-frame{position:absolute;inset:0;overflow:hidden;transform-origin:center;z-index:1;}\n' +
        '.scene-hook{background:linear-gradient(135deg,#fff7ed 0%,#ffffff 48%,#dbeafe 100%);}.scene-problem{background:linear-gradient(135deg,#111827 0%,#1f2937 58%,#0f766e 100%);color:#fff;}.scene-source{background:linear-gradient(135deg,#f8fafc 0%,#e0f2fe 50%,#bae6fd 100%);}.scene-script{background:linear-gradient(135deg,#18181b 0%,#3f3f46 54%,#a855f7 100%);color:#fff;}.scene-visual{background:linear-gradient(135deg,#fff1f2 0%,#ffffff 45%,#fde68a 100%);}.scene-audio{background:linear-gradient(135deg,#082f49 0%,#0f766e 54%,#ccfbf1 100%);color:#fff;}.scene-solution{background:linear-gradient(135deg,#ecfeff 0%,#ffffff 48%,#fef3c7 100%);}.scene-workflow{background:linear-gradient(135deg,#172554 0%,#2563eb 54%,#ecfeff 100%);color:#fff;}.scene-proof{background:linear-gradient(135deg,#f8fafc 0%,#fff7ed 50%,#fed7aa 100%);}.scene-impact{background:linear-gradient(135deg,#022c22 0%,#115e59 55%,#a7f3d0 100%);color:#fff;}.scene-render{background:linear-gradient(135deg,#0f172a 0%,#334155 55%,#f8fafc 100%);color:#fff;}.scene-cta{background:linear-gradient(135deg,#111827 0%,#7c2d12 55%,#ff8c00 100%);color:#fff;}\n' +
        '.fallback{box-sizing:border-box;width:100%;height:100%;padding:9% 8%;display:flex;flex-direction:column;justify-content:center;gap:30px;position:relative;z-index:2;}\n' +
        '.kicker{display:inline-flex;align-self:flex-start;padding:10px 16px;border-radius:999px;background:rgba(17,24,39,.94);color:#fff;font-size:26px;font-weight:900;letter-spacing:0;}.scene-problem .kicker,.scene-script .kicker,.scene-audio .kicker,.scene-workflow .kicker,.scene-impact .kicker,.scene-render .kicker,.scene-cta .kicker{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);}\n' +
        'h1{margin:0;font-size:76px;line-height:1.06;letter-spacing:0;font-weight:950;max-width:88%;word-break:keep-all;overflow-wrap:break-word;text-wrap:balance;}\n' +
        'p{margin:0;max-width:82%;font-size:34px;line-height:1.42;font-weight:760;letter-spacing:0;word-break:keep-all;overflow-wrap:break-word;color:rgba(17,24,39,.76);}.scene-problem p,.scene-script p,.scene-audio p,.scene-workflow p,.scene-impact p,.scene-render p,.scene-cta p{color:rgba(255,255,255,.82);}\n' +
        '.metric{display:flex;align-items:center;gap:14px;align-self:flex-start;max-width:82%;padding:18px 24px;border-radius:8px;background:rgba(255,255,255,.76);border:1px solid rgba(15,23,42,.08);box-shadow:0 18px 46px rgba(15,23,42,.14);font-size:28px;font-weight:920;line-height:1.28;word-break:keep-all;overflow-wrap:break-word;}.metric span{display:block;width:14px;height:48px;border-radius:7px;background:' + accent + ';}.scene-problem .metric,.scene-script .metric,.scene-audio .metric,.scene-workflow .metric,.scene-impact .metric,.scene-render .metric,.scene-cta .metric{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.2);box-shadow:0 22px 52px rgba(0,0,0,.24);}\n' +
        '.scene-chips{display:flex;gap:12px;flex-wrap:wrap;max-width:86%;}.scene-chips span{padding:12px 16px;border-radius:8px;background:rgba(255,255,255,.72);border:1px solid rgba(15,23,42,.08);font-size:22px;font-weight:900;box-shadow:0 14px 34px rgba(15,23,42,.1);}.scene-problem .scene-chips span,.scene-script .scene-chips span,.scene-audio .scene-chips span,.scene-workflow .scene-chips span,.scene-impact .scene-chips span,.scene-render .scene-chips span,.scene-cta .scene-chips span{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.18);color:#fff;}\n' +
        '.motion-grid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:88px 88px;mask-image:linear-gradient(180deg,rgba(0,0,0,.5),transparent 72%);}.motion-scan{position:absolute;top:-20%;bottom:-20%;width:32%;z-index:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);opacity:0;}.motion-shape{position:absolute;z-index:1;opacity:.36;}.shape-a{width:520px;height:300px;right:-90px;top:120px;background:' + accent + ';clip-path:polygon(14% 0,100% 20%,82% 100%,0 72%);}.shape-b{width:320px;height:320px;left:-90px;bottom:170px;background:#22c55e;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);}.shape-c{width:240px;height:240px;right:130px;bottom:210px;border:18px solid rgba(255,255,255,.55);clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%);}.scene-problem .shape-b,.scene-audio .shape-b{background:#38bdf8;}.scene-script .shape-a{background:#a855f7;}.scene-visual .shape-b{background:#fb7185;}.scene-render .shape-a{background:#94a3b8;}.scene-cta .shape-a{background:#fbbf24;}.motion-panel{position:absolute;z-index:1;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.14);box-shadow:0 24px 60px rgba(15,23,42,.18);}.panel-a{width:340px;height:120px;right:70px;bottom:110px;}.panel-b{width:220px;height:84px;right:180px;bottom:260px;opacity:.75;}.motion-line{position:absolute;height:4px;background:rgba(255,255,255,.45);transform-origin:left center;transform:scaleX(0);z-index:1;}.line-a{left:8%;right:12%;bottom:14%;}.line-b{left:18%;right:24%;top:18%;opacity:.5;}\n' +
        '.vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.08));z-index:2;pointer-events:none;}\n' +
        '.progress{position:absolute;left:0;bottom:0;height:10px;width:100%;z-index:5;background:rgba(255,255,255,.18);}.bar{height:100%;width:0;background:' + accent + ';}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div data-composition-id="makeke-html-motion" data-width="' + size.w + '" data-height="' + size.h + '" data-start="0" data-duration="' + duration + '" data-track-index="0">\n' +
        nativeFrames + '\n' +
        '<div class="clip vignette" data-start="0" data-duration="' + duration + '" data-track-index="1"></div>\n' +
        '<div class="clip progress" data-start="0" data-duration="' + duration + '" data-track-index="90"><div id="bar" class="bar"></div></div>\n' +
        '</div>\n<script>\nwindow.__timelines=window.__timelines||{};\nconst tl=gsap.timeline({paused:true});\n' +
        nativeTweens + '\n' +
        'tl.to("#bar",{width:"100%",duration:' + duration + ',ease:"none"},0);\n' +
        'window.__timelines["makeke-html-motion"]=tl;\n' +
        'window.__hf={duration:' + duration + ',seek:function(t){var v=Number(t)||0;tl.seek(Math.max(0,Math.min(' + duration + ',v)),false);}};\n' +
        'if(!new URLSearchParams(location.search).has("hfCapture")){requestAnimationFrame(function(){tl.play(0);});}\n' +
        '</scr' + 'ipt>\n</body>\n</html>';
    }
    if (renderedSlides.length) {
      var showCaptions = opts.showCaptions === true;
      var capturedSceneCount = renderedSlides.length;
      var capturedPlan = typeof V._vagCreateMotionPlan === 'function'
        ? V._vagCreateMotionPlan({ topic: title, duration: duration, sceneCount: capturedSceneCount, source: sourceText, designFamily: opts.designFamily || '' })
        : { duration: duration, sceneDuration: duration / capturedSceneCount, preset: { bgBlur: 34, bgOpacity: 0.24 } };
      var capturedSceneDuration = capturedPlan.sceneDuration || (duration / capturedSceneCount);
      var capturedCueStarts = [];
      var capturedCueDurations = [];
      var capturedFrames = renderedSlides.map(function (slide, i) {
        var src = V._esc(slide.image);
        return '<div id="design-frame-' + i + '" class="clip scene-frame" data-start="' + (i * capturedSceneDuration).toFixed(2) + '" data-duration="' + capturedSceneDuration.toFixed(2) + '" data-track-index="' + (4 + i) + '"><img class="scene-bg" src="' + src + '" alt=""><img class="design-frame" src="' + src + '" alt=""></div>';
      }).join('\n');
      var capturedCueDuration = Math.max(1.4, Math.min(2.4, duration / Math.max(4, texts.length + 1)));
      var capturedCues = showCaptions ? texts.map(function (text, i) {
        var sceneIndex = Math.min(i, capturedSceneCount - 1);
        var start = Math.min(duration - 0.9, sceneIndex * capturedSceneDuration + 0.35);
        var cueLen = Math.max(0.8, Math.min(1.8, capturedSceneDuration - 0.7));
        capturedCueStarts[i] = start;
        capturedCueDurations[i] = cueLen;
        var shortText = String(text || '').replace(/\s+/g, ' ').trim();
        if (shortText.length > 42) shortText = shortText.slice(0, 40) + '...';
        return '<div id="cue-' + i + '" class="clip cue" data-start="' + start.toFixed(2) + '" data-duration="' + cueLen.toFixed(2) + '" data-track-index="' + (i + 40) + '">' + V._esc(shortText) + '</div>';
      }).join('\n') : '';
      var capturedCueIds = showCaptions ? texts.map(function (_, i) { return '#cue-' + i; }) : [];
      return '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + V._esc(title) + '</title>\n<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></scr' + 'ipt>\n<style>\n' +
        'html,body{margin:0;width:100%;height:100%;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden;}\n' +
        '[data-composition-id=\"makeke-html-motion\"]{position:relative;width:' + size.w + 'px;height:' + size.h + 'px;overflow:hidden;background:#f5f5f7;}\n' +
        '.scene-frame{position:absolute;inset:0;overflow:hidden;background:#f5f5f7;transform-origin:center;z-index:1;}\n' +
        '.scene-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;transform:scale(1);}\n' +
        '.design-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border:0;transform-origin:center;z-index:1;}\n' +
        '.vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.06));z-index:2;pointer-events:none;}\n' +
        '.cue{position:absolute;left:50%;bottom:' + Math.round(size.h * 0.032) + 'px;transform:translateX(-50%);z-index:4;max-width:' + Math.round(size.w * 0.72) + 'px;padding:8px 12px;border-radius:999px;background:rgba(17,17,17,.56);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:' + Math.max(16, Math.round(size.w * 0.013)) + 'px;font-weight:750;line-height:1.24;text-align:center;letter-spacing:0;box-shadow:0 10px 28px rgba(0,0,0,.16);}\n' +
        '.progress{position:absolute;left:0;bottom:0;height:10px;width:100%;z-index:5;background:rgba(255,255,255,.18);}.bar{height:100%;width:0;background:' + accent + ';}\n' +
        '</style>\n</head>\n<body>\n' +
        '<div data-composition-id="makeke-html-motion" data-width="' + size.w + '" data-height="' + size.h + '" data-start="0" data-duration="' + duration + '" data-track-index="0">\n' +
        capturedFrames + '\n' +
        '<div class="clip vignette" data-start="0" data-duration="' + duration + '" data-track-index="1"></div>\n' +
        capturedCues + '\n<div class="clip progress" data-start="0" data-duration="' + duration + '" data-track-index="90"><div id="bar" class="bar"></div></div>\n' +
        '</div>\n<script>\nwindow.__timelines=window.__timelines||{};\nconst tl=gsap.timeline({paused:true});\n' +
        renderedSlides.map(function (_, i) {
          var id = '#design-frame-' + i;
          if (typeof V._vagBuildSceneTween === 'function') return V._vagBuildSceneTween(id, i, capturedPlan, renderedSlides.length);
          var start = i * capturedSceneDuration;
          var end = Math.min(duration, start + capturedSceneDuration);
          return 'tl.set("' + id + '",{opacity:0},0);tl.fromTo("' + id + '",{scale:1.005,opacity:0},{scale:1,opacity:1,duration:.22,ease:"power2.out"},' + start.toFixed(2) + ');tl.to("' + id + '",{scale:1.018,duration:' + Math.max(.6, capturedSceneDuration - .3).toFixed(2) + ',ease:"none"},' + (start + .22).toFixed(2) + ');' + (i < renderedSlides.length - 1 ? 'tl.to("' + id + '",{opacity:0,duration:.22,ease:"power2.in"},' + Math.max(start + .3, end - .22).toFixed(2) + ');tl.set("' + id + '",{opacity:0},' + (end + .01).toFixed(2) + ');' : '');
        }).join('\n') + '\n' +
        capturedCueIds.map(function (id, i) {
          var start = capturedCueStarts[i] || 0;
          var end = Math.min(duration - .3, start + (capturedCueDurations[i] || 1.2));
          return 'tl.from("' + id + '",{y:14,opacity:0,duration:.22,ease:"power3.out"},' + start.toFixed(2) + ');tl.to("' + id + '",{y:-6,opacity:0,duration:.18,ease:"power2.in"},' + end.toFixed(2) + ');tl.set("' + id + '",{opacity:0},' + (end + 0.01).toFixed(2) + ');';
        }).join('\n') +
        '\ntl.to("#bar",{width:"100%",duration:' + duration + ',ease:"none"},0);\n' +
        'window.__timelines["makeke-html-motion"]=tl;\n' +
        'window.__hf={duration:' + duration + ',seek:function(t){var v=Number(t)||0;tl.seek(Math.max(0,Math.min(' + duration + ',v)),false);}};\n' +
        'if(!new URLSearchParams(location.search).has("hfCapture")){requestAnimationFrame(function(){tl.play(0);});}\n' +
        '</scr' + 'ipt>\n</body>\n</html>';
    }
    var renderHtml = _vagStripExternalFontsForMotion(html);
    var slideHtmls = _vagExtractDesignSlideHtmls(renderHtml);
    var sceneCount = Math.max(1, slideHtmls.length);
    var sceneDuration = duration / sceneCount;
    var fallbackShowCaptions = opts.showCaptions === true;
    var frames = slideHtmls.map(function (slideHtml, i) {
      var safe = V._esc(slideHtml).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return '<iframe id="design-frame-' + i + '" class="clip design-frame" data-start="' + (i * sceneDuration).toFixed(2) + '" data-duration="' + sceneDuration.toFixed(2) + '" data-track-index="' + (4 + i) + '" srcdoc="' + safe + '"></iframe>';
    }).join('\n');
    var cueDuration = Math.max(1.4, Math.min(2.4, duration / Math.max(4, texts.length + 1)));
    var fallbackCueStarts = [];
    var fallbackCueDurations = [];
    var cues = fallbackShowCaptions ? texts.map(function (text, i) {
      var sceneIndex = Math.min(i, sceneCount - 1);
      var start = Math.min(duration - 0.9, sceneIndex * sceneDuration + 0.35);
      var cueLen = Math.max(0.8, Math.min(1.8, sceneDuration - 0.7));
      fallbackCueStarts[i] = start;
      fallbackCueDurations[i] = cueLen;
      var shortText = String(text || '').replace(/\s+/g, ' ').trim();
      if (shortText.length > 42) shortText = shortText.slice(0, 40) + '...';
      return '<div id="cue-' + i + '" class="clip cue" data-start="' + start.toFixed(2) + '" data-duration="' + cueLen.toFixed(2) + '" data-track-index="' + (i + 10) + '">' + V._esc(shortText) + '</div>';
    }).join('\n') : '';
    var cueIds = fallbackShowCaptions ? texts.map(function (_, i) { return '#cue-' + i; }) : [];
    return '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + V._esc(title) + '</title>\n<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></scr' + 'ipt>\n<style>\n' +
      'html,body{margin:0;width:100%;height:100%;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#111;overflow:hidden;}\n' +
      '[data-composition-id=\"makeke-html-motion\"]{position:relative;width:' + size.w + 'px;height:' + size.h + 'px;overflow:hidden;background:#f5f5f7;}\n' +
      '.design-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;transform-origin:center;z-index:1;}\n' +
      '.vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.10));z-index:2;pointer-events:none;}\n' +
      '.cue{position:absolute;left:50%;bottom:' + Math.round(size.h * 0.032) + 'px;transform:translateX(-50%);z-index:4;max-width:' + Math.round(size.w * 0.72) + 'px;padding:8px 12px;border-radius:999px;background:rgba(17,17,17,.56);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:' + Math.max(16, Math.round(size.w * 0.013)) + 'px;font-weight:750;line-height:1.24;text-align:center;letter-spacing:0;box-shadow:0 10px 28px rgba(0,0,0,.16);}\n' +
      '.progress{position:absolute;left:0;bottom:0;height:10px;width:100%;z-index:5;background:rgba(255,255,255,.12);}.bar{height:100%;width:0;background:' + accent + ';}\n' +
      '</style>\n</head>\n<body>\n' +
      '<div data-composition-id="makeke-html-motion" data-width="' + size.w + '" data-height="' + size.h + '" data-start="0" data-duration="' + duration + '" data-track-index="0">\n' +
      frames + '\n' +
      '<div class="clip vignette" data-start="0" data-duration="' + duration + '" data-track-index="1"></div>\n' +
      cues + '\n<div class="clip progress" data-start="0" data-duration="' + duration + '" data-track-index="90"><div id="bar" class="bar"></div></div>\n' +
      '</div>\n<script>\nwindow.__timelines=window.__timelines||{};\nconst tl=gsap.timeline({paused:true});\n' +
      slideHtmls.map(function (_, i) {
        var start = i * sceneDuration;
        var end = Math.min(duration, start + sceneDuration);
        var id = '#design-frame-' + i;
        return 'tl.set("' + id + '",{opacity:0},0);tl.fromTo("' + id + '",{scale:1.015,opacity:0},{scale:1,opacity:1,duration:.35,ease:"power2.out"},' + start.toFixed(2) + ');tl.to("' + id + '",{scale:1.035,x:-' + Math.round(size.w * 0.012) + ',y:-' + Math.round(size.h * 0.008) + ',duration:' + Math.max(.6, sceneDuration - .45).toFixed(2) + ',ease:"none"},' + (start + .35).toFixed(2) + ');' + (i < slideHtmls.length - 1 ? 'tl.to("' + id + '",{opacity:0,duration:.28,ease:"power2.in"},' + Math.max(start + .4, end - .28).toFixed(2) + ');tl.set("' + id + '",{opacity:0},' + (end + .01).toFixed(2) + ');' : '');
      }).join('\n') + '\n' +
      cueIds.map(function (id, i) {
        var start = fallbackCueStarts[i] || 0;
        var end = Math.min(duration - .3, start + (fallbackCueDurations[i] || 1.2));
        return 'tl.from("' + id + '",{y:14,opacity:0,duration:.22,ease:"power3.out"},' + start.toFixed(2) + ');tl.to("' + id + '",{y:-6,opacity:0,duration:.18,ease:"power2.in"},' + end.toFixed(2) + ');tl.set("' + id + '",{opacity:0},' + (end + 0.01).toFixed(2) + ');';
      }).join('\n') +
      '\ntl.to("#bar",{width:"100%",duration:' + duration + ',ease:"none"},0);\n' +
      'window.__timelines["makeke-html-motion"]=tl;\n' +
      'window.__hf={duration:' + duration + ',seek:function(t){var v=Number(t)||0;tl.seek(Math.max(0,Math.min(' + duration + ',v)),false);}};\n' +
      '</scr' + 'ipt>\n</body>\n</html>';
  }

  function _vagBuildCapturedNarrationLines(slideTexts, fallbackTitle) {
    var lines = [];
    (slideTexts || []).forEach(function (raw) {
      var text = String(raw || '')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) return;
      var parts = text.split(/(?<=[.!?。！？]|[요다까죠니다])\s+|[•·|]/).map(function (part) {
        return part.replace(/\s+/g, ' ').trim();
      }).filter(Boolean);
      if (!parts.length) parts = [text];
      var picked = parts.find(function (part) { return part.length >= 10 && part.length <= 58; }) || parts[0];
      if (picked.length > 58) picked = picked.slice(0, 56).trim() + '...';
      if (picked.length >= 3 && lines.indexOf(picked) < 0) lines.push(picked);
    });
    if (!lines.length && fallbackTitle) lines.push(String(fallbackTitle).replace(/\s+/g, ' ').trim());
    return lines.slice(0, 5);
  }
  V._vagBuildCapturedNarrationLines = _vagBuildCapturedNarrationLines;

  function _vagStripExternalFontsForMotion(html) {
    return String(html || '')
      .replace(/<link[^>]+href=["'][^"']*(?:fonts\.googleapis\.com|fonts\.gstatic\.com|pretendard|font)[^"']*["'][^>]*>/gi, '')
      .replace(/<link[^>]+rel=["']preconnect["'][^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/gi, '')
      .replace(/@import\s+url\(["'][^"']*(?:fonts\.googleapis\.com|pretendard|font)[^"']*["']\)\s*;?/gi, '')
      .replace(/@font-face\s*\{[^}]*\}/gi, '')
      .replace(/font-family\s*:[^;{}]+/gi, 'font-family:Arial,Helvetica,sans-serif')
      .replace(/["']?Noto Sans KR["']?/gi, 'Arial')
      .replace(/["']?Pretendard["']?/gi, 'Arial');
  }

  function _vagInferMotionAccent(html) {
    var profileColors = [];
    try {
      var p = window._globalProfileData || {};
      [p.brand_color, p.main_color, p.primary_color, p.accent_color].forEach(function (v) { if (v) profileColors.push(String(v)); });
      [p.brand_colors, p.design_colors, p.palette, p.colors].forEach(function (v) {
        if (Array.isArray(v)) profileColors = profileColors.concat(v.map(String));
        else if (v) profileColors = profileColors.concat(String(v).split(/[,\s/|]+/));
      });
    } catch (_) {}
    var candidates = profileColors.concat((String(html || '').match(/#[0-9a-fA-F]{6}\b/g) || []));
    var first = candidates.map(function (v) { return String(v || '').trim(); }).find(function (v) {
      return /^#[0-9a-fA-F]{6}$/.test(v) && !/^#(?:fff(?:fff)?|000000|f5f5f7|1c1c1e)$/i.test(v);
    });
    return first || '#2563eb';
  }

  function _vagExtractDesignSlideHtmls(html) {
    var source = String(html || '');
    var parser = new DOMParser();
    var doc = parser.parseFromString(source, 'text/html');
    var styles = Array.from(doc.querySelectorAll('style')).map(function (el) { return el.outerHTML; }).join('\n');
    var scripts = Array.from(doc.querySelectorAll('script')).map(function (el) { return el.outerHTML; }).join('\n');
    var slideEls = Array.from(doc.querySelectorAll('[data-slide], .makeke-page, [data-makeke-page], main.fallback, main[data-motion-slide-root]'));
    if (!slideEls.length) {
      slideEls = Array.from(doc.body?.children || []).filter(function (el) {
        return /^(main|article|section)$/i.test(el.tagName || '');
      });
    }
    slideEls = slideEls.filter(function (el) {
      var text = (el.textContent || '').trim();
      return text.length > 0 && !el.closest('[data-slide] [data-slide], .makeke-page .makeke-page');
    });
    if (!slideEls.length) return [source];
    return slideEls.slice(0, 20).map(function (el, i) {
      return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + styles + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;}body{margin:0;width:100%;height:100%;}[data-motion-slide-root]{width:100%;height:100%;overflow:hidden;}[data-motion-slide-root]>*{width:100%;height:100%;box-sizing:border-box;}</style></head><body><main data-motion-slide-root="1" data-motion-slide-index="' + i + '">' + el.outerHTML + '</main>' + scripts + '</body></html>';
    });
  }

  function _vagSanitizeMotionBrief(value) {
    return String(value || '')
      .split(/마케팅\s*지시\s*:|콘텐츠\s*시작\s*방식\s*:|━━━/)[0]
      .replace(/\[[^\]]*(?:Gemini|검색|수집|자료|출처)[^\]]*\]/gi, ' ')
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+\w+\s+\d{4}[^.\n]*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _vagCleanMotionTopic(value) {
    var text = String(value || '')
      .replace(/^자료\s*기반\s*·\s*/i, '')
      .replace(/\s*·\s*(광고\s*전환|인지도|후기\/신뢰|직설\s*톤|감성\s*톤|프리미엄\s*톤|트렌디\s*톤|CTA\s*.+)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return text || String(value || '').replace(/\s+/g, ' ').trim();
  }

  function _vagCleanMotionFallbackLine(line) {
    var text = String(line || '')
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/^\s*\d+\s*[\).:-]?\s*/, '')
      .replace(/(?:Google|News|RSS|GMT|Esri|Reuters|AP News)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || text.length < 4) return '';
    if (/^(google|news|rss|gmt)$/i.test(text)) return '';
    return text.length > 82 ? text.slice(0, 80).trim() + '...' : text;
  }

  function _vagBuildNativeMotionSceneCopy(lines, title, duration, sceneCount) {
    var clean = (lines || []).map(function (line) {
      return _vagCleanMotionFallbackLine(line);
    }).filter(Boolean);
    var topicClean = _vagCleanMotionTopic(title);
    var headline = clean[0] || topicClean || '핵심 메시지를 먼저 정하세요';
    var support = clean[1] || clean[0] || topicClean || '사용자가 입력한 자료를 기준으로 장면을 구성합니다.';
    var proof = clean[2] || clean[1] || support;
    var detail = clean[3] || clean[2] || proof;
    var cta = clean[4] || clean[3] || topicClean || '다음 행동을 시작하세요.';
    var baseScenes = [
      { key: 'hook', family: 'hook', label: '핵심 메시지', title: topicClean || headline, body: support, stat: '첫 장면에서 문제를 각인', chipA: '문제', chipB: '약속' },
      { key: 'problem', family: 'problem', label: '문제', title: headline, body: support || '지금 막히는 이유를 한 문장으로 짚습니다.', stat: '고객이 멈추는 지점', chipA: '시간 손실', chipB: '전환 저하' },
      { key: 'source', family: 'source', label: '근거', title: proof || support, body: detail || '자료와 브랜드 맥락을 근거로 메시지를 좁힙니다.', stat: '근거 기반 설계', chipA: '자료 반영', chipB: '핵심만 압축' },
      { key: 'solution', family: 'solution', label: '해결', title: '한 흐름으로 묶어 실행 시간을 줄입니다', body: detail || '수집, 생성, 발행을 이어지는 작업으로 정리합니다.', stat: '흩어진 과정을 하나로', chipA: '자동 구성', chipB: '반복 절감' },
      { key: 'proof', family: 'proof', label: '효과', title: detail || '작업은 줄이고 메시지는 선명하게', body: proof || '브랜드 톤과 CTA를 유지해 캠페인 자산으로 남깁니다.', stat: '브랜드 톤 유지', chipA: '프로필 반영', chipB: 'CTA 유지' },
      { key: 'cta', family: 'cta', label: '행동', title: cta, body: detail, stat: '다음 행동', chipA: '행동 유도', chipB: '마무리' },
    ];
    var requestedCount = Number(sceneCount || 0) || 0;
    var targetCount = requestedCount > 0 ? Math.max(2, Math.min(8, Math.round(requestedCount))) : Math.max(2, Math.min(6, Math.ceil((Number(duration) || 15) / 15)));
    var scenes = [];
    for (var i = 0; i < targetCount; i++) {
      var picked = baseScenes[Math.min(i, baseScenes.length - 1)];
      if (i >= baseScenes.length - 1 && i < targetCount - 1) picked = baseScenes[baseScenes.length - 2];
      scenes.push(Object.assign({}, picked, { key: picked.key + '-' + i }));
    }
    if (scenes.length) scenes[scenes.length - 1] = Object.assign({}, baseScenes[baseScenes.length - 1], { key: 'cta-' + (scenes.length - 1) });
    return scenes;
  }

  V._vagIsGoNativeMissingEndpoint = function _vagIsGoNativeMissingEndpoint(error) {
    var msg = String((error && (error.message || error.detail || error.error)) || error || '');
    return /404|not found|cannot\s+(get|post)|501|not implemented|go-native|endpoint not implemented/i.test(msg);
  }

  V._vagShowHtmlMotionPreview = function _vagShowHtmlMotionPreview(generatedHtml, options) {
    var opts = options || {};
    var html = String(generatedHtml || '');
    var topic = opts.topic || '마케팅 영상';
    var aspect = opts.aspect || '9:16';
    var duration = opts.duration || 12;
    var finalPrompt = opts.finalPrompt || '';
    if (!html) return;
    if (typeof V._vagAnnotateTexts === 'function') {
      try { html = V._vagAnnotateTexts(html); } catch (_) {}
    }
    html = _vagInjectGsapTargetGuard(html);
    if (!/<body[\s>]/i.test(html) && !/data-composition-id|id=["']stage["']/i.test(html)) {
      V._addMsg('ai', '<span style="color:#ff3b30;">미리보기에 표시할 내용이 비어 있습니다. 다시 생성해 주세요.</span>');
      return;
    }

    V._vagHyperHtml = html;
    if (V._vagSession) {
      V._vagSession.hyperHtml = html;
      V._vagSession.hyperDuration = duration;
    }
    var previousOutputSummary = '';
    try {
      previousOutputSummary = V._vagCollectOutputSummary(html, V._vagSession);
      if (V._vagSession) V._vagSession.previousOutputSummary = previousOutputSummary;
    } catch (_) {}
    V._vagResult = {
      video_path: '',
      project_dir: '',
      topic: topic,
      script: null,
      final_prompt: finalPrompt,
      html_ready: true,
      previous_output_summary: previousOutputSummary,
    };
    V._vagRenderMeta = aspect + ' · ' + duration + '초 · 미리보기 준비';

    var resultEl = document.getElementById('vag-result');
    if (resultEl) resultEl.style.display = 'block';
    var player = document.getElementById('vag-video-player');
    if (player) {
      player.removeAttribute('src');
      try { player.load(); } catch (_) {}
      player.style.display = 'none';
    }
    var preview = document.getElementById('vag-html-motion-preview');
    if (!preview && resultEl) {
      preview = document.createElement('iframe');
      preview.id = 'vag-html-motion-preview';
      preview.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      preview.style.cssText = 'width:100%;min-height:420px;border:1px solid rgba(255,140,0,0.18);border-radius:14px;background:#111;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);';
      resultEl.insertBefore(preview, resultEl.firstChild);
    }
    if (preview) {
      preview.style.display = 'block';
      preview.srcdoc = html;
    }
    var meta = document.getElementById('vag-result-meta');
    if (meta) {
      meta.textContent = V._vagRenderMeta + ' · MP4 렌더 API 연결 전까지 HTML 미리보기로 확인';
    }
    try { V._renderFinalPrompt(finalPrompt); } catch (_) {}
    try { V._vagRenderTextEditCard(); } catch (_) {}
    try { V._vagUpdateWorkspace(); } catch (_) {}
  }

  function _vagInjectGsapTargetGuard(html) {
    var source = String(html || '');
    if (!source || source.indexOf('data-makeke-gsap-target-guard') >= 0) return source;
    var guard = '<script data-makeke-gsap-target-guard>(function(){' +
      'function patch(){var g=window.gsap;if(!g||g.__makekeTargetGuard)return false;var names=["to","from","set"];names.forEach(function(n){var orig=g[n];if(typeof orig!=="function")return;g[n]=function(targets){if(typeof targets==="string"&&!document.querySelector(targets)){return g.timeline?g.timeline({paused:true}):{}};return orig.apply(this,arguments);};});var ft=g.fromTo;if(typeof ft==="function"){g.fromTo=function(targets){if(typeof targets==="string"&&!document.querySelector(targets)){return g.timeline?g.timeline({paused:true}):{}};return ft.apply(this,arguments);};}g.__makekeTargetGuard=true;return true;}' +
      'if(!patch()){var tries=0;var timer=setInterval(function(){tries+=1;if(patch()||tries>250)clearInterval(timer);},8);}' +
      'document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll("[id^=design-frame-],.clip.scene").forEach(function(frame){if(!frame.querySelector(".scene-chips span")){var box=document.createElement("div");box.className="scene-chips";box.style.cssText="position:absolute;left:-9999px;top:-9999px;opacity:0;pointer-events:none";box.innerHTML="<span></span>";frame.appendChild(box);}});});' +
      '})();</script>';
    if (/<head[\s>][\s\S]*?<\/head>/i.test(source)) {
      return source.replace(/<\/head>/i, guard + '</head>');
    }
    if (/<body[\s>]/i.test(source)) {
      return source.replace(/<body([^>]*)>/i, '<body$1>' + guard);
    }
    return guard + source;
  }

  function _vagInferDesignMotionModelLabel(item) {
    var raw = [
      item && item.provider,
      item && item.model,
      item && item.meta && item.meta.provider,
      item && item.meta && item.meta.model,
    ].filter(Boolean).join(' ').toLowerCase();
    if (/deepseek/.test(raw)) return '⚡ DeepSeek API';
    if (/qwen/.test(raw)) return '🐉 Qwen API';
    if (/\bglm\b|zai/.test(raw)) return '🟪 GLM API';
    if (/kimi/.test(raw)) return /atlas|anthropic/.test(raw) ? '🌙 Kimi API' : '🌙 Kimi CLI';
    if (/claude/.test(raw)) return '🟣 Claude API';
    if (/codex/.test(raw)) return '🟦 Codex CLI';
    return '🟦 Codex CLI';
  }

  function _vagChooseDesignMotionOption(options, fallback, delayMs) {
    return new Promise(function (resolve) {
      var done = false;
      var pick = function (value, auto) {
        if (done) return;
        done = true;
        var body = document.getElementById('vag-chat-body');
        if (body) body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
        if (auto) V._addMsg('user', V._esc(value) + ' <span style="font-size:10px;opacity:0.7;">자동</span>');
        resolve(value);
      };
      V._addOptions(options, function (value) { pick(value || fallback, false); });
      setTimeout(function () { pick(fallback, true); }, delayMs || 1400);
    });
  }


  /* ── 히스토리 ── static/modules/video_agent_history.js 로 분리됨.
     해당 파일이 window.vagHistoryInit / Open / Delete / Publish 를 등록한다. */

  /* ── 전역 ── */
  // 🔍 영상 코드 무결성 검증 — 잘린 출력/구문 오류 조기 발견
  V.vagValidateCode = function vagValidateCode() {
    const box = document.getElementById('vag-validate-result');
    const html = String(V._vagHyperHtml || '');
    if (!box) return;
    if (!html) {
      box.style.display = 'block';
      box.style.background = 'rgba(255,149,0,0.08)';
      box.style.color = '#ff9500';
      box.innerHTML = '⚠️ 아직 생성된 코드가 없습니다.';
      return;
    }
    const issues = [];
    // 1) <script> 열림/닫힘 균형
    const openMatches = html.match(/<script[^>]*>(?!\s*<\/script>)/gi) || [];
    const closeCount = (html.match(/<\/script>/gi) || []).length;
    if (openMatches.length > closeCount) {
      issues.push(`<code>&lt;script&gt;</code> 블록 미종결 (${openMatches.length}개 열림 · ${closeCount}개 닫힘) — 구문 오류로 전체 JS 실행 실패 가능`);
    }
    // 2) GSAP 타임라인 존재 여부 + play() 호출
    const hasTimelineVar = /(gsap\.timeline|new\s+TimelineMax|(?:var|const|let)\s+tl\s*=)/.test(html);
    const hasPlayCall = /(\.play\s*\(|__timelines\s*\[)/.test(html);
    if (hasTimelineVar && !hasPlayCall) {
      issues.push('GSAP 타임라인은 정의됐지만 <code>.play()</code> 또는 <code>window.__timelines[...]</code> 등록이 없음 — 타임라인이 시작되지 않음');
    }
    // 3) 출력 끝 미완성
    const tail = html.replace(/\s+$/, '').slice(-60);
    if (/[{(,:]\s*$/.test(tail)) {
      issues.push(`출력 끝이 미완성 구문으로 끊김 — 생성이 중간에 중단됨. 마지막 조각: <code>${tail.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</code>`);
    }
    // 4) 루트 컴포지션 존재
    if (!/id=["']?stage["']?/i.test(html) && !/data-composition-id\s*=/i.test(html)) {
      issues.push('<code>data-composition-id</code> 또는 <code>&lt;div id="stage"&gt;</code> 루트 엘리먼트가 없음 — HyperFrames 가 렌더할 컨테이너를 찾지 못함');
    }
    // 5) data-composition-id
    if (!/data-composition-id/.test(html)) {
      issues.push('<code>data-composition-id</code> 속성 누락 — Studio 가 프로젝트를 식별 못함');
    }
    // 6) 모든 .clip 이 opacity:0 로 시작하는데 애니메이션이 없음 감지 (heuristic)
    const opacityZeroRule = /\.(clip|scene)[^{]*\{[^}]*opacity\s*:\s*0[^;}]*[;}]/i.test(html);
    const hasAnyOpacityAnim = /\b(opacity\s*:|to\s*\([^)]*opacity)/i.test(html);
    if (opacityZeroRule && !hasAnyOpacityAnim) {
      issues.push('CSS 초기 <code>opacity:0</code> 이 있지만 이를 해제하는 애니메이션이 없음 — 영원히 투명');
    }

    box.style.display = 'block';
    if (issues.length === 0) {
      box.style.background = 'rgba(52,199,89,0.08)';
      box.style.color = '#28a745';
      box.innerHTML = `✅ 검증 통과 — 코드 무결성 문제 없음 (${html.length.toLocaleString()}자, <code>&lt;script&gt;</code> ${closeCount}개)`;
    } else {
      box.style.background = 'rgba(255,59,48,0.08)';
      box.style.color = '#ff3b30';
      box.innerHTML = `<b>🚫 ${issues.length}개 문제 발견</b><ul style="margin:6px 0 0 18px;padding:0;line-height:1.7;">${issues.map(i => '<li>' + i + '</li>').join('')}</ul>
        <div style="margin-top:8px;font-size:10px;color:rgba(0,0,0,0.55);">현재 선택한 엔진을 유지한 채 다시 생성하거나, 버튼에서 <b>🟦 Codex CLI</b> 또는 <b>🌙 Kimi CLI</b> 를 직접 선택해 재시도하세요.</div>`;
    }
  }

  // 📎 이미지 첨부 (file input · drag&drop · clipboard paste)
  V.vagAttachImages = async function vagAttachImages(files) {
    const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
    for (const f of list) {
      if (V._vagAttachedImages.length >= 8) break;
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      V._vagAttachedImages.push({ name: f.name, dataUrl });
    }
    V._vagRenderAttachments();
  }
  window.vagAttachImages = V.vagAttachImages;

  // 🏷 로고 업로드
  V.vagAttachLogo = async function vagAttachLogo(file) {
    if (!file || !file.type.startsWith('image/')) return;
    V._vagLogoDataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    if (!V._vagSession) V._vagSession = {};
    V._vagSession.logoDataUrl = V._vagLogoDataUrl;
    if (typeof V._vagRegisterLogoReferenceDataUrl === 'function') {
      V._vagRegisterLogoReferenceDataUrl(V._vagLogoDataUrl, file.name || '프로필 로고');
    }
    const badge = document.getElementById('vag-logo-badge');
    if (badge) badge.textContent = '로고 ✓';
  }
  window.vagAttachLogo = V.vagAttachLogo;

  V._vagRenderAttachments = function _vagRenderAttachments() {
    const wrap = document.getElementById('vag-attachments');
    if (!wrap) return;
    const hasImg = V._vagAttachedImages.length > 0;
    const hasSrc = V._vagAttachedSources.length > 0;
    if (!hasImg && !hasSrc) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'block';
    const imgHtml = hasImg ? `
      <div style="margin-bottom:${hasSrc?'8px':'0'};">
        <div style="font-size:10px;font-weight:700;color:#ff6b00;margin-bottom:4px;">📎 이미지 ${V._vagAttachedImages.length}장</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${V._vagAttachedImages.map((im,i)=>`
            <div style="position:relative;width:56px;height:56px;border-radius:8px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);">
              <img src="${im.dataUrl}" style="width:100%;height:100%;object-fit:cover;" alt="">
              <button onclick="vagRemoveAttachment('image',${i})" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border:none;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;cursor:pointer;padding:0;line-height:16px;">×</button>
            </div>`).join('')}
        </div>
      </div>` : '';
    const srcHtml = hasSrc ? `
      <div>
        <div style="font-size:10px;font-weight:700;color:#ff8c00;margin-bottom:4px;">🔍 외부 자료 ${V._vagAttachedSources.length}건</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${V._vagAttachedSources.map((s,i)=>`
            <div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#fff;border:1px solid rgba(255,140,0,0.15);border-radius:6px;font-size:11px;">
              <span style="flex:0 0 auto;padding:1px 6px;font-size:9px;font-weight:700;background:rgba(255,140,0,0.1);color:#ff8c00;border-radius:4px;">${V._esc(s.type||'web')}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${V._esc(s.title||'')}</span>
              <button onclick="vagRemoveAttachment('source',${i})" style="flex:0 0 auto;border:none;background:transparent;color:rgba(0,0,0,0.4);cursor:pointer;font-size:14px;padding:0 4px;">×</button>
            </div>`).join('')}
        </div>
      </div>` : '';
    wrap.innerHTML = imgHtml + srcHtml;
  }

  V.vagRemoveAttachment = function vagRemoveAttachment(kind, idx) {
    if (kind === 'image') V._vagAttachedImages.splice(idx, 1);
    else if (kind === 'source') V._vagAttachedSources.splice(idx, 1);
    V._vagRenderAttachments();
  }
  window.vagRemoveAttachment = V.vagRemoveAttachment;

  // 🔍 외부 자료 검색
  V.vagToggleSourcePanel = function vagToggleSourcePanel() {
    const panel = document.getElementById('vag-source-search-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  }
  window.vagToggleSourcePanel = V.vagToggleSourcePanel;

  V.vagSearchSources = async function vagSearchSources() {
    const q = (document.getElementById('vag-source-query') || {}).value || '';
    const box = document.getElementById('vag-source-results');
    if (!q.trim()) return;
    if (box) box.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:rgba(0,0,0,0.4);">검색 중...</div>';
    try {
      const r = await fetch('/api/sources/collect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: q, news_count: 5, blog_count: 5, youtube_count: 5 }),
      });
      const d = await r.json();
      const items = [];
      if (d.news) items.push(...d.news.map(x => ({ ...x, type: 'news' })));
      if (d.blog) items.push(...d.blog.map(x => ({ ...x, type: 'blog' })));
      if (d.youtube) items.push(...d.youtube.map(x => ({ ...x, type: 'youtube' })));
      if (!items.length) {
        if (box) box.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:rgba(0,0,0,0.4);">결과 없음</div>';
        return;
      }
      if (box) box.innerHTML = items.slice(0, 15).map((it, i) => `
        <label style="display:flex;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer;font-size:11px;">
          <input type="checkbox" data-vag-src-idx="${i}" style="margin:0;">
          <span style="flex:0 0 auto;padding:1px 6px;font-size:9px;font-weight:700;background:rgba(255,140,0,0.1);color:#ff8c00;border-radius:4px;">${V._esc(it.type)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${V._esc(it.title||'')}</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${V._esc(it.snippet||it.description||'')}</div>
          </div>
        </label>`).join('') + `
        <div style="padding:8px;text-align:right;">
          <button onclick="vagAttachSelectedSources()" style="padding:6px 14px;font-size:11px;font-weight:700;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:8px;cursor:pointer;">✓ 선택한 자료 첨부</button>
        </div>`;
      // 결과를 window 에 저장해 체크 시 참조
      window._vagLastSourceResults = items.slice(0, 15);
    } catch (e) {
      if (box) box.innerHTML = `<div style="padding:12px;color:#ff3b30;font-size:11px;">검색 실패: ${V._esc(e.message||e)}</div>`;
    }
  }
  window.vagSearchSources = V.vagSearchSources;

  V.vagAttachSelectedSources = function vagAttachSelectedSources() {
    const box = document.getElementById('vag-source-results');
    if (!box) return;
    const checks = box.querySelectorAll('input[type="checkbox"]:checked');
    checks.forEach(c => {
      const idx = parseInt(c.dataset.vagSrcIdx, 10);
      const it = (window._vagLastSourceResults || [])[idx];
      if (it) V._vagAttachedSources.push({ title: it.title, url: it.url || it.link, snippet: it.snippet || it.description, type: it.type });
    });
    V._vagRenderAttachments();
    V.vagToggleSourcePanel();
  }
  window.vagAttachSelectedSources = V.vagAttachSelectedSources;

  window.vagInit = V.vagInit;
  window.vagGenerate = V.vagGenerate;
  window.vagValidateCode = V.vagValidateCode;
  window.vagOpenFolder = V.vagOpenFolder;
  window.vagCopyFinalPrompt = V.vagCopyFinalPrompt;
  window.vagCopyCode = V.vagCopyCode;
  window.vagSyncStudio = V.vagSyncStudio;
  window.vagRefreshStudio = V.vagRefreshStudio;
  window.vagOpenStudio = V.vagOpenStudio;
  window.vagApplyTextEdits = V.vagApplyTextEdits;
  window.vagResetTextEdits = V.vagResetTextEdits;
  // vagHistoryInit / Open / Delete / Publish 는 video_agent_history.js 에서 등록됨.
})();
