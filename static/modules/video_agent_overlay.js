/**
 * video_agent_overlay.js
 * 영상 에이전트 렌더 오버레이 UI — video_agent.js 에서 분리된 독립 모듈.
 *
 * 공용 API: window._VAGOverlay = { ensure, reset, show, setProgress, setStage, pushLog, update, hide }.
 * video_agent.js 내부에서는 얇은 alias 로 기존 `_vagEnsureRenderOverlay` 등의 이름을 그대로 사용.
 *
 * 내부 상태(`_logCursor` 등) 는 이 모듈에 캡슐화되어 있으며 외부에서 직접 접근하지 않는다.
 */
(function () {
  'use strict';

  const STAGES = ['queued', 'prepare', 'rendering', 'encoding', 'complete'];
  const STAGE_LABELS = {
    queued: '준비',
    prepare: '파일 정리',
    rendering: '화면 만들기',
    encoding: '영상 저장',
    complete: '완료',
    failed: '실패',
  };
  let _logCursor = 0;

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function ensure() {
    let ov = document.getElementById('vag-render-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'vag-render-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:28px;';
      ov.innerHTML = `
        <style>
          @keyframes vag-logo-spin { from { transform:rotate(0) scale(1); } 50% { transform:rotate(180deg) scale(1.08); } to { transform:rotate(360deg) scale(1); } }
          @keyframes vag-logo-pulse { 0%,100% { opacity:0.25; } 50% { opacity:0.55; } }
          #vag-render-logo { animation: vag-logo-spin 2.4s cubic-bezier(0.4,0,0.2,1) infinite; width:180px; height:180px; border-radius:36px; filter: drop-shadow(0 20px 50px rgba(255,140,0,0.5)); object-fit:contain; }
          #vag-render-glow { position:absolute; width:440px; height:440px; border-radius:50%; background:radial-gradient(circle, rgba(255,140,0,0.55) 0%, transparent 65%); filter:blur(40px); animation: vag-logo-pulse 2.4s ease-in-out infinite; pointer-events:none; }
        </style>
        <div style="width:min(920px,100%);max-height:100%;display:grid;grid-template-columns:minmax(240px,280px) minmax(0,1fr);gap:20px;align-items:stretch;">
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(14,10,8,0.92);border:1px solid rgba(255,140,0,0.18);border-radius:28px;padding:28px 24px;box-shadow:0 24px 80px rgba(0,0,0,0.35);overflow:hidden;">
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div id="vag-render-glow"></div>
              <img id="vag-render-logo" src="/static/logo-icon.png" alt="Makeke">
            </div>
            <div id="vag-render-overlay-label" style="margin-top:28px;font-size:22px;font-weight:900;letter-spacing:-0.02em;text-align:center;">최종 영상 만드는 중...</div>
            <div id="vag-render-overlay-sub" style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.72);max-width:240px;text-align:center;line-height:1.55;">완성될 때까지 1~5분 걸립니다. 화면을 건드리지 마세요.</div>
            <div id="vag-render-overlay-elapsed" style="margin-top:14px;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:rgba(255,140,0,0.85);font-weight:700;">0.0초</div>
            <div style="width:100%;margin-top:18px;">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:rgba(255,255,255,0.66);margin-bottom:7px;">
                <span>진행률</span>
                <span id="vag-render-overlay-progress-text">0%</span>
              </div>
              <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;">
                <div id="vag-render-overlay-progress-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#ff8c00,#fbbf24);box-shadow:0 8px 20px rgba(255,140,0,0.35);transition:width .25s ease;"></div>
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;min-height:0;background:rgba(14,10,8,0.92);border:1px solid rgba(255,140,0,0.18);border-radius:28px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,0.35);overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <div style="font-size:15px;font-weight:900;color:#fff4ea;">영상 생성 진행</div>
              <div id="vag-render-overlay-stage-chip" style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.12);color:#ffb25d;font-size:11px;font-weight:800;">준비</div>
            </div>
            <div id="vag-render-overlay-stage-list" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:16px;"></div>
            <div style="margin-top:16px;font-size:11px;color:rgba(255,255,255,0.56);">최근 진행 내용</div>
            <div id="vag-render-overlay-logs" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto;padding-right:4px;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(ov);
    }
    return ov;
  }

  function reset() {
    const stageWrap = document.getElementById('vag-render-overlay-stage-list');
    if (stageWrap) {
      stageWrap.innerHTML = STAGES.map(function (stage) {
        return '<div id="vag-render-stage-' + stage + '" style="padding:10px 8px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);text-align:center;transition:all .2s ease;">'
          + '<div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.52);">' + STAGE_LABELS[stage] + '</div>'
          + '</div>';
      }).join('');
    }
    const logsEl = document.getElementById('vag-render-overlay-logs');
    if (logsEl) logsEl.innerHTML = '<div style="padding:12px 14px;border-radius:16px;background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.56);font-size:12px;line-height:1.55;">영상을 만들 준비를 하고 있습니다.</div>';
    _logCursor = 0;
    setProgress(0);
    setStage('queued');
  }

  function show(label) {
    const ov = ensure();
    reset();
    const labelEl = document.getElementById('vag-render-overlay-label');
    if (labelEl && label) labelEl.textContent = label;
    ov.style.display = 'flex';
    ov._startAt = Date.now();
    if (ov._timer) clearInterval(ov._timer);
    ov._timer = setInterval(() => {
      const el = document.getElementById('vag-render-overlay-elapsed');
      if (el && ov._startAt) el.textContent = ((Date.now() - ov._startAt) / 1000).toFixed(1) + '초';
    }, 200);
  }

  function setProgress(percent) {
    const pct = Math.max(0, Math.min(100, Number(percent || 0)));
    const bar = document.getElementById('vag-render-overlay-progress-bar');
    const text = document.getElementById('vag-render-overlay-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = Math.round(pct) + '%';
  }

  function setStage(stage, note) {
    const active = stage === 'failed' ? 'queued' : (stage || 'queued');
    const chip = document.getElementById('vag-render-overlay-stage-chip');
    if (chip) chip.textContent = note || STAGE_LABELS[stage] || STAGE_LABELS[active] || '진행 중';
    const idx = STAGES.indexOf(active);
    STAGES.forEach(function (key, i) {
      const el = document.getElementById('vag-render-stage-' + key);
      if (!el) return;
      const done = idx >= 0 && i < idx;
      const current = idx === i;
      if (stage === 'failed') {
        el.style.background = 'rgba(255,59,48,0.08)';
        el.style.borderColor = i === idx ? 'rgba(255,59,48,0.35)' : 'rgba(255,255,255,0.08)';
        el.querySelector('div').style.color = i === idx ? '#ff9a95' : 'rgba(255,255,255,0.42)';
        return;
      }
      el.style.background = current ? 'rgba(255,140,0,0.12)' : done ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.04)';
      el.style.borderColor = current ? 'rgba(255,140,0,0.35)' : done ? 'rgba(52,199,89,0.28)' : 'rgba(255,255,255,0.08)';
      const label = el.querySelector('div');
      if (label) label.style.color = current ? '#ffb25d' : done ? '#7fe3a1' : 'rgba(255,255,255,0.52)';
    });
  }

  function pushLog(message, level) {
    const logsEl = document.getElementById('vag-render-overlay-logs');
    const text = String(message || '').trim();
    if (!logsEl || !text) return;
    const tone = level === 'error' ? { bg: 'rgba(255,59,48,0.12)', border: 'rgba(255,59,48,0.24)', color: '#ffb3ad' } :
      level === 'success' ? { bg: 'rgba(52,199,89,0.12)', border: 'rgba(52,199,89,0.22)', color: '#9bf0b3' } :
      { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)' };
    if (_logCursor === 0) logsEl.innerHTML = '';
    _logCursor += 1;
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 12px;border-radius:14px;background:' + tone.bg + ';border:1px solid ' + tone.border + ';color:' + tone.color + ';font-size:12px;line-height:1.55;';
    row.innerHTML = '<div style="font-size:10px;color:rgba(255,255,255,0.42);margin-bottom:4px;">' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</div>' + _esc(text);
    logsEl.appendChild(row);
    while (logsEl.children.length > 10) logsEl.removeChild(logsEl.firstChild);
    logsEl.scrollTop = logsEl.scrollHeight;
  }

  function update(label, sub, progress, stage, log, level) {
    const labelEl = document.getElementById('vag-render-overlay-label');
    const subEl = document.getElementById('vag-render-overlay-sub');
    if (labelEl && label) labelEl.textContent = label;
    if (subEl && sub) subEl.textContent = sub;
    if (typeof progress === 'number') setProgress(progress);
    if (stage) setStage(stage);
    if (log) pushLog(log, level);
  }

  function hide() {
    const ov = document.getElementById('vag-render-overlay');
    if (ov) {
      if (ov._timer) clearInterval(ov._timer);
      ov.style.display = 'none';
    }
  }

  window._VAGOverlay = Object.freeze({
    ensure: ensure,
    reset: reset,
    show: show,
    setProgress: setProgress,
    setStage: setStage,
    pushLog: pushLog,
    update: update,
    hide: hide,
  });
})();
