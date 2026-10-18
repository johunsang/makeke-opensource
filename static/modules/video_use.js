(function () {
  'use strict';

  const state = {
    tool: 'codex',
    status: null,
    cli: null,
    running: false
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function apiFetch(url, options) {
    const init = options || {};
    init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
    if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
    return fetch(url, init).then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      return data;
    });
  }

  function badge(label, ok, detail) {
    const color = ok ? '#34c759' : '#ff9500';
    const bg = ok ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)';
    return `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:${bg};border:1px solid ${ok ? 'rgba(52,199,89,0.18)' : 'rgba(255,149,0,0.18)'};">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 0 3px ${bg};"></span>
      <div style="min-width:0;">
        <div style="font-size:12px;font-weight:800;color:#1c1c1e;">${esc(label)}</div>
        <div style="font-size:10.5px;color:rgba(0,0,0,0.48);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(detail || (ok ? '준비됨' : '확인 필요'))}</div>
      </div>
    </div>`;
  }

  function render(root) {
    root.innerHTML = `
      <div class="page-header">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;">
          <div>
            <h1>영상 편집 CLI</h1>
            <p>video-use 스킬을 Codex, Kimi CLI와 연결해 원본 영상 폴더를 대화형으로 편집합니다</p>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="vuseRefresh()">상태 새로고침</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:minmax(360px,0.85fr) minmax(520px,1.15fr);gap:16px;align-items:start;">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div class="card" style="padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;">
              <div style="font-size:14px;font-weight:900;color:#1c1c1e;">연결 상태</div>
              <div id="vuse-ready-pill" style="padding:6px 10px;border-radius:999px;background:rgba(120,120,128,0.08);font-size:10px;font-weight:900;color:rgba(0,0,0,0.45);">확인 중</div>
            </div>
            <div id="vuse-status-grid" style="display:grid;grid-template-columns:1fr;gap:8px;"></div>
          </div>

          <div class="card" style="padding:18px;">
            <div style="font-size:14px;font-weight:900;color:#1c1c1e;margin-bottom:12px;">CLI 선택</div>
            <div id="vuse-tool-buttons" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
              ${toolButton('codex', 'Codex')}
              ${toolButton('kimi', 'Kimi')}
            </div>
            <div id="vuse-cli-note" style="margin-top:10px;font-size:11px;line-height:1.6;color:rgba(0,0,0,0.48);">CLI 상태 확인 중...</div>
          </div>
        </div>

        <div class="card" style="padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
            <div>
              <div style="font-size:15px;font-weight:900;color:#1c1c1e;">video-use 작업 요청</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:4px;">원본 영상이 있는 폴더에서 CLI가 video-use 스킬과 helpers를 읽고 편집합니다.</div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="vuseOpenFolder()">폴더 열기</button>
          </div>

          <label style="display:block;font-size:11px;font-weight:800;color:rgba(0,0,0,0.5);margin-bottom:6px;">원본 영상 폴더</label>
          <input id="vuse-cwd" type="text" placeholder="/Users/.../raw-videos" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);font-size:12px;color:#1c1c1e;background:#fff;margin-bottom:12px;">

          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px;">
            <button type="button" class="vuse-mode-btn active" data-vuse-mode="strategy" onclick="vuseSelectMode('strategy')">전략만</button>
            <button type="button" class="vuse-mode-btn" data-vuse-mode="edit" onclick="vuseSelectMode('edit')">편집 실행</button>
            <button type="button" class="vuse-mode-btn" data-vuse-mode="continue" onclick="vuseSelectMode('continue')">이어서 수정</button>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
            <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.16);font-size:11px;font-weight:800;color:#ff6b00;cursor:pointer;">
              <input id="vuse-gemini-tts" type="checkbox" checked style="accent-color:#ff8c00;"> Gemini TTS 사용
            </label>
            <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.16);font-size:11px;font-weight:800;color:#007aff;cursor:pointer;">
              <input id="vuse-subtitles" type="checkbox" checked style="accent-color:#007aff;"> 자막 포함
            </label>
            <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;background:rgba(52,199,89,0.08);border:1px solid rgba(52,199,89,0.16);font-size:11px;font-weight:800;color:#22a348;cursor:pointer;">
              <input id="vuse-self-eval" type="checkbox" checked style="accent-color:#34c759;"> 자체 검수
            </label>
          </div>

          <label style="display:block;font-size:11px;font-weight:800;color:rgba(0,0,0,0.5);margin-bottom:6px;">요청 내용</label>
          <textarea id="vuse-prompt" rows="8" style="width:100%;padding:13px 14px;border-radius:14px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.04);font-size:12px;line-height:1.65;resize:vertical;color:#1c1c1e;">원본 영상들을 보고 짧은 런칭/홍보 영상으로 편집해줘. 핵심 메시지가 빠르게 보이게 컷을 정리하고, 필요한 경우 오버레이와 자막을 넣어줘.</textarea>

          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button id="vuse-run-btn" class="btn btn-primary" type="button" onclick="vuseRun()">CLI로 보내기</button>
            <button class="btn btn-secondary" type="button" onclick="vuseCopyPrompt()">프롬프트 복사</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <div style="font-size:14px;font-weight:900;color:#1c1c1e;">CLI 실행 결과</div>
          <div id="vuse-run-state" style="font-size:11px;color:rgba(0,0,0,0.42);font-weight:800;">대기</div>
        </div>
        <pre id="vuse-output" style="margin:0;min-height:220px;max-height:460px;overflow:auto;padding:14px;border-radius:14px;background:#111827;color:#dbeafe;font-size:11px;line-height:1.65;white-space:pre-wrap;">실행 결과가 여기에 표시됩니다.</pre>
      </div>
      <style>
        .vuse-mode-btn { padding:10px 12px;border-radius:11px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.58);font-size:11px;font-weight:800;cursor:pointer; }
        .vuse-mode-btn.active { border-color:rgba(255,140,0,0.38);background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;box-shadow:0 8px 18px rgba(255,140,0,0.18); }
      </style>
    `;
  }

  function toolButton(tool, label) {
    return `<button type="button" data-vuse-tool="${tool}" onclick="vuseSelectTool('${tool}')" style="padding:10px;border-radius:12px;border:1px solid ${tool === state.tool ? 'rgba(255,140,0,0.38)' : 'rgba(0,0,0,0.08)'};background:${tool === state.tool ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff'};color:${tool === state.tool ? '#fff' : 'rgba(0,0,0,0.62)'};font-size:11px;font-weight:900;cursor:pointer;">${esc(label)}</button>`;
  }

  function updateToolButtons() {
    document.querySelectorAll('[data-vuse-tool]').forEach(btn => {
      const active = btn.getAttribute('data-vuse-tool') === state.tool;
      btn.style.borderColor = active ? 'rgba(255,140,0,0.38)' : 'rgba(0,0,0,0.08)';
      btn.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
      btn.style.color = active ? '#fff' : 'rgba(0,0,0,0.62)';
    });
  }

  function setOutput(text, stateText) {
    const out = document.getElementById('vuse-output');
    const stateEl = document.getElementById('vuse-run-state');
    if (out) out.textContent = text || '';
    if (stateEl) stateEl.textContent = stateText || '대기';
  }

  async function refresh() {
    const [status, cli] = await Promise.all([
      apiFetch('/api/video-use/status'),
      apiFetch('/api/coding-agent/which')
    ]);
    state.status = status;
    state.cli = cli;
    renderStatus();
  }

  function renderStatus() {
    const s = state.status || {};
    const cli = state.cli?.tools || {};
    const grid = document.getElementById('vuse-status-grid');
    if (grid) {
      grid.innerHTML = [
        badge('video-use 저장소', !!s.repo_installed, s.repo_path || '미설치'),
        badge('Codex 스킬 연결', !!s.skill_linked, s.skill_path || '미연결'),
        badge('ffmpeg / ffprobe', !!s.ffmpeg_path && !!s.ffprobe_path, s.ffprobe_path || '필수 도구 없음'),
        badge('Gemini TTS', true, '나레이션/음성 생성은 Gemini 사용 지시'),
        badge('ElevenLabs Scribe', !!s.elevenlabs_key, s.elevenlabs_key ? `${s.elevenlabs_from} 설정됨` : '원본 영상 전사가 필요하면 키 설정')
      ].join('');
    }
    const ready = document.getElementById('vuse-ready-pill');
    if (ready) {
      ready.textContent = s.ready ? 'video-use 준비됨' : '확인 필요';
      ready.style.background = s.ready ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)';
      ready.style.color = s.ready ? '#22a348' : '#ff9500';
    }
    const note = document.getElementById('vuse-cli-note');
    if (note) {
      note.innerHTML = ['codex', 'kimi'].map(key => {
        const item = cli[key] || {};
        const mark = item.installed ? (item.logged_in ? '사용 가능' : '로그인 필요') : '미설치';
        return `<span style="display:inline-block;margin-right:8px;"><b>${esc(key)}</b>: ${esc(mark)}</span>`;
      }).join('');
    }
  }

  function selectMode(mode) {
    document.querySelectorAll('[data-vuse-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-vuse-mode') === mode);
    });
  }

  function currentMode() {
    return document.querySelector('[data-vuse-mode].active')?.getAttribute('data-vuse-mode') || 'strategy';
  }

  function buildPrompt() {
    const mode = currentMode();
    const userPrompt = document.getElementById('vuse-prompt')?.value.trim() || '';
    const useTts = document.getElementById('vuse-gemini-tts')?.checked;
    const subtitles = document.getElementById('vuse-subtitles')?.checked;
    const selfEval = document.getElementById('vuse-self-eval')?.checked;
    const modeText = {
      strategy: '아직 편집을 실행하지 말고, 먼저 원본 영상 inventory와 편집 전략만 제안해라.',
      edit: '이 버튼 클릭은 사용자의 실행 승인으로 간주한다. 전략을 짧게 정리한 뒤 편집을 실행하고 edit/preview.mp4 또는 edit/final.mp4를 만들어라.',
      continue: '기존 edit/project.md와 edit/ 산출물을 읽고 이전 작업을 이어서 수정해라. 불필요한 재전사는 하지 마라.'
    }[mode] || '';
    return [
      'video-use 스킬로 현재 작업 폴더의 원본 영상을 편집해줘.',
      '먼저 ~/Developer/video-use/SKILL.md와 helpers/를 읽고, helpers 경로는 ~/Developer/video-use/helpers 기준으로 사용해라.',
      '모든 산출물은 현재 원본 영상 폴더의 edit/ 안에 저장해라.',
      modeText,
      useTts ? '음성/나레이션/TTS가 필요하면 ElevenLabs가 아니라 마케케의 Gemini TTS 또는 Gemini 음성 모델을 우선 사용하도록 설계해라. 필요한 스크립트와 음성 생성 지시를 분리해서 남겨라.' : '새 음성/TTS 생성은 생략해라.',
      subtitles ? '자막은 필요하면 마지막 단계에서 적용하고, 오버레이가 자막을 가리지 않게 해라.' : '자막은 만들지 마라.',
      selfEval ? '렌더 후 cut boundary, 자막 위치, 오디오 pop, 오버레이 타이밍을 자체 검수해라.' : '자체 검수는 간단한 ffprobe 확인만 해라.',
      '',
      '[사용자 요청]',
      userPrompt
    ].filter(Boolean).join('\n');
  }

  async function run() {
    if (state.running) return;
    const cwd = document.getElementById('vuse-cwd')?.value.trim();
    if (!cwd) {
      if (typeof toast === 'function') toast('원본 영상 폴더를 입력해주세요.', 'error');
      return;
    }
    state.running = true;
    const btn = document.getElementById('vuse-run-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'CLI 실행 중...';
    }
    setOutput('CLI에 video-use 작업을 전달하는 중입니다...', '실행 중');
    try {
      const data = await apiFetch('/api/coding-agent/run', {
        method: 'POST',
        body: {
          tool: state.tool,
          cwd,
          timeout: 1800,
          prompt: buildPrompt(),
          system_prompt: '너는 video-use 기반 영상 편집 작업자다. 원본 영상은 사용자가 지정한 cwd에 있고, 결과는 cwd/edit/에만 저장한다.'
        }
      });
      setOutput([data.stdout || '', data.stderr ? `\n[stderr]\n${data.stderr}` : ''].join('').trim() || '완료', '완료');
      if (typeof toast === 'function') toast('video-use CLI 작업이 완료되었습니다.');
    } catch (err) {
      setOutput(err.message || String(err), '오류');
      if (typeof toast === 'function') toast(err.message || 'CLI 실행 실패', 'error');
    } finally {
      state.running = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'CLI로 보내기';
      }
    }
  }

  async function openFolder() {
    const folder = document.getElementById('vuse-cwd')?.value.trim() || state.status?.repo_path || '';
    if (!folder) return;
    try {
      await apiFetch('/api/open-folder', { method: 'POST', body: { folder } });
    } catch (err) {
      if (typeof toast === 'function') toast(err.message || '폴더를 열 수 없습니다.', 'error');
    }
  }

  async function copyPrompt() {
    const prompt = buildPrompt();
    await navigator.clipboard?.writeText(prompt);
    if (typeof toast === 'function') toast('video-use 프롬프트를 복사했습니다.');
  }

  async function init() {
    const root = document.getElementById('video-use-root');
    if (!root) return;
    render(root);
    const savedCwd = localStorage.getItem('makeke.videoUse.cwd') || '';
    if (savedCwd) document.getElementById('vuse-cwd').value = savedCwd;
    document.getElementById('vuse-cwd')?.addEventListener('change', e => {
      localStorage.setItem('makeke.videoUse.cwd', e.target.value.trim());
    });
    try {
      await refresh();
    } catch (err) {
      setOutput(err.message || String(err), '상태 확인 실패');
    }
  }

  window.vuseInit = init;
  window.vuseRefresh = refresh;
  window.vuseRun = run;
  window.vuseOpenFolder = openFolder;
  window.vuseCopyPrompt = copyPrompt;
  window.vuseSelectMode = selectMode;
  window.vuseSelectTool = function vuseSelectTool(tool) {
    state.tool = tool || 'codex';
    updateToolButtons();
  };
})();
