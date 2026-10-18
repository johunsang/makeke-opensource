/* single_advideo/director_core — AI 감독 핵심 흐름: 프로바이더 UI, 영화감독 트리트먼트, 감독 노트(채팅·히스토리·오버레이), 단계 오케스트레이션, 캐릭터 캐스팅 */
async function savLoadDirectorModels() { /* no-op (설정 페이지로 이관됨) */ }

function savDirectorProviderLabel(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (value === 'codex' || value === 'cli' || value === 'openai-codex') return 'Codex CLI';
  if (value === 'gemini' || value === 'google' || value === 'google-gemini') return 'Gemini';
  if (value === 'atlas' || value === 'claude' || value === 'anthropic') return 'Claude';
  return provider || '기본';
}

// 설정 페이지: 감독 프로바이더 선택 시 UI 토글 (구버전 호환)
function savToggleDirectorProviderUI() {
  const sel = document.getElementById('set-director-provider');
  const provider = sel?.value || 'codex';
  const gemWrap = document.getElementById('set-director-gemini-wrap');
  const atlasWrap = document.getElementById('set-director-atlas-wrap');
  if (gemWrap) gemWrap.style.display = provider === 'gemini' ? 'block' : 'none';
  if (atlasWrap) atlasWrap.style.display = (provider === 'atlas' || provider === 'claude') ? 'block' : 'none';
}
window.savToggleDirectorProviderUI = savToggleDirectorProviderUI;

// 프로바이더 변경 즉시 DB 저장 (저장 버튼 안 눌러도 반영)
async function savQuickSaveDirectorProvider() {
  const sel = document.getElementById('set-director-provider');
  const status = document.getElementById('set-director-provider-status');
  if (!sel) return;
  const provider = sel.value;
  try {
    await api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'director_provider', value: provider } });
    const label = savDirectorProviderLabel(provider);
    if (status) {
      status.style.display = 'block';
      status.style.color = '#34c759';
      status.textContent = `✓ 저장됨 (${label}) — 이제 감독 호출이 이 프로바이더로 동작합니다`;
    }
    if (typeof toast === 'function') toast(`감독 프로바이더: ${label} 저장 완료`);
    setTimeout(() => { if (status) status.style.display = 'none'; }, 4000);
  } catch (e) {
    if (status) { status.style.display = 'block'; status.style.color = '#ff3b30'; status.textContent = '저장 실패: ' + (e?.message || e); }
  }
}
window.savQuickSaveDirectorProvider = savQuickSaveDirectorProvider;

// 🎬 영화감독 AI 실행
async function savRunFilmDirector() {
  const btn = document.getElementById('sav-director-btn');
  const orig = btn?.innerHTML || '';
  const resultBox = document.getElementById('sav-director-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '🎬 디렉팅 중...'; }
  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:rgba(0,0,0,0.5);">감독이 씬별 샷·페이싱·음악·컬러를 설계 중입니다...</div>';
  }
  try {
    const scenes = (_savState.script && _savState.script.scenes) || [];
    const res = await api('/api/advideo/direct-film', {
      method: 'POST',
      body: {
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        style: document.getElementById('sav-style')?.value || '',
        story_angle: (document.getElementById('sav-story-angle')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        scenes: scenes.map(s => ({ title: s.title || '', narration: s.narration || '' })),
        music_video_mode: !!document.getElementById('sav-music-video-mode')?.checked,
        long_form_mode: !!document.getElementById('sav-long-form-mode')?.checked,
        director_model: document.getElementById('sav-director-model')?.value || '',
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
      },
    });
    // warning 응답(잔액 부족/인증 실패 등) 처리
    if (res && res.status === 'warning') {
      const em = res.message || '감독 모델 오류';
      if (resultBox) resultBox.innerHTML = `<div style="padding:12px;background:rgba(255,59,48,0.06);border:1px solid rgba(255,59,48,0.3);border-radius:10px;font-size:12px;color:#ff3b30;font-weight:700;">
        ${escapeHtml(em)}
        <div style="margin-top:4px;font-size:11px;font-weight:500;color:rgba(0,0,0,0.7);">
          <a href="#" onclick="navigateToPage('settings');return false;" style="color:#5856d6;font-weight:700;">⚙ 설정에서 감독 프로바이더 변경</a>
        </div>
      </div>`;
      toast(em.replace(/^⚠️\s*/, ''), 'error');
      return;
    }
    const t = (res && res.treatment) || {};
    _savState.directorTreatment = t;
    _savState.directorModel = res?.director_model || '';
    savRenderDirectorTreatment(t, res?.director_model || '');
    toast(`감독 디렉팅 완료`, 'success');
  } catch (e) {
    toast('감독 AI 실패: ' + (e?.message || e), 'error');
    if (resultBox) resultBox.innerHTML = `<div style="padding:12px;text-align:center;font-size:11px;color:#ff3b30;">감독 AI 실패: ${escapeHtml(String(e?.message||e))}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎬 감독 디렉팅 실행'; }
  }
}
window.savRunFilmDirector = savRunFilmDirector;

function savRenderDirectorTreatment(t, modelName) {
  const box = document.getElementById('sav-director-results');
  if (!box) return;
  const refs = Array.isArray(t?.director_references) ? t.director_references : [];
  const shots = Array.isArray(t?.shot_list) ? t.shot_list : [];
  const music = t?.music_cue || {};
  const palette = Array.isArray(t?.color_palette) ? t.color_palette : [];

  const paletteHtml = palette.length
    ? '<div style="display:flex;gap:4px;margin-top:4px;">' + palette.slice(0, 8).map(h => `<span title="${escapeHtml(h)}" style="width:22px;height:22px;border-radius:5px;background:${escapeHtml(h)};border:1px solid rgba(0,0,0,0.1);"></span>`).join('') + '</div>'
    : '';

  box.innerHTML = `
    <div style="padding:12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;font-size:11px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="font-weight:800;color:#5856d6;font-size:12px;">🎬 ${escapeHtml(modelName || '현재 감독 모델')}${t.is_music_video ? ' · 🎵 뮤직비디오 모드' : ''}</div>
        <button type="button" onclick="savApplyDirectorToScenes()" style="padding:4px 10px;font-size:10px;font-weight:700;border:none;background:linear-gradient(135deg,#5856d6,#3f3da3);color:#fff;border-radius:999px;cursor:pointer;">씬에 적용</button>
      </div>

      ${t.logline ? `<div style="font-style:italic;color:#1c1c1e;font-weight:700;margin-bottom:8px;">"${escapeHtml(t.logline)}"</div>` : ''}
      ${t.slogan_reframe ? `<div style="padding:6px 8px;background:rgba(255,140,0,0.08);border-left:3px solid #ff8c00;border-radius:4px;margin-bottom:6px;"><b>🔄 슬로건 재해석:</b> ${escapeHtml(t.slogan_reframe)}</div>` : ''}
      ${Array.isArray(t.hook_copy) && t.hook_copy.length ? `<div style="margin-bottom:6px;"><b>🎯 3초 훅 카피:</b> ${t.hook_copy.map(h=>`"${escapeHtml(h)}"`).join(' · ')}</div>` : ''}
      ${t.brand_chant ? `<div style="margin-bottom:6px;"><b>🔊 브랜드 리듬:</b> <span style="font-family:monospace;color:#ff6b00;">${escapeHtml(t.brand_chant)}</span></div>` : ''}
      ${t.ending_line ? `<div style="padding:6px 8px;background:rgba(52,199,89,0.08);border-left:3px solid #34c759;border-radius:4px;margin-bottom:6px;"><b>🎬 엔딩 카피:</b> "${escapeHtml(t.ending_line)}"</div>` : ''}

      ${refs.length ? `<div style="margin-bottom:8px;">
        <div style="font-weight:700;color:rgba(0,0,0,0.7);margin-bottom:2px;">🎥 참고 감독</div>
        ${refs.map(r => `<div style="margin-left:8px;color:rgba(0,0,0,0.7);">• <b>${escapeHtml(r.name||'')}</b> — ${escapeHtml(r.why||'')}</div>`).join('')}
      </div>` : ''}

      ${t.pacing_curve ? `<div style="margin-bottom:8px;"><b>⏱ 페이싱:</b> ${escapeHtml(t.pacing_curve)}</div>` : ''}

      ${(music.genre || music.bpm) ? `<div style="margin-bottom:8px;">
        <b>🎵 음악:</b> ${escapeHtml(music.genre||'-')} · ${music.bpm||'?'} BPM · 드랍 ${music.key_moment_sec||'?'}s · ${escapeHtml(music.instruments||'')}
        ${music.reference_track_vibe ? `<div style="margin-left:8px;color:rgba(0,0,0,0.6);">↳ ${escapeHtml(music.reference_track_vibe)}</div>` : ''}
      </div>` : ''}

      ${paletteHtml ? `<div style="margin-bottom:8px;"><b>🎨 컬러:</b>${paletteHtml}</div>` : ''}

      ${t.hero_moment ? `<div style="margin-bottom:8px;padding:6px 8px;background:rgba(255,140,0,0.08);border-left:3px solid #ff8c00;border-radius:4px;"><b>⭐ 히어로 모먼트:</b> ${escapeHtml(t.hero_moment)}</div>` : ''}

      ${shots.length ? `<div style="margin-top:10px;">
        <div style="font-weight:700;color:rgba(0,0,0,0.7);margin-bottom:4px;">📋 씬별 샷리스트</div>
        ${shots.map(s => `<div style="padding:6px 8px;border:1px solid rgba(0,0,0,0.06);border-radius:6px;margin-bottom:4px;background:rgba(88,86,214,0.03);">
          <div style="display:flex;justify-content:space-between;gap:8px;"><b>씬 ${s.scene_index}</b><span style="color:rgba(0,0,0,0.5);">${s.duration_sec||'?'}초</span></div>
          <div style="color:rgba(0,0,0,0.7);margin-top:2px;">📐 ${escapeHtml(s.angle||'-')} · ${escapeHtml(s.lens||'-')} · ${escapeHtml(s.camera_motion||'-')}</div>
          <div style="color:rgba(0,0,0,0.7);">💡 ${escapeHtml(s.lighting||'-')} · 🎭 ${escapeHtml(s.mood||'-')}</div>
          ${s.sound_design ? `<div style="color:rgba(0,0,0,0.6);">🔊 ${escapeHtml(s.sound_design)}</div>` : ''}
          ${s.silence_beats ? `<div style="color:rgba(0,0,0,0.55);">🤫 여백: ${escapeHtml(s.silence_beats)}</div>` : ''}
          ${s.actor_reaction ? `<div style="color:rgba(0,0,0,0.55);">🎭 리액션: ${escapeHtml(s.actor_reaction)}</div>` : ''}
          ${s.visual_prompt_augment ? `<div style="color:#5856d6;margin-top:2px;">🎬 ${escapeHtml(s.visual_prompt_augment)}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}
    </div>`;
}

// 감독 트리트먼트를 씬에 적용 (camera_motion / visual_prompt 덧씌움)
function savApplyDirectorToScenes() {
  const t = _savState.directorTreatment;
  if (!t) { toast('감독 디렉팅 먼저 실행하세요', 'error'); return; }
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const shots = Array.isArray(t.shot_list) ? t.shot_list : [];
  if (!scenes.length) { toast('씬이 아직 없습니다. 4단계에서 스크립트를 먼저 생성하세요', 'error'); return; }
  let applied = 0;
  shots.forEach(shot => {
    const idx = (parseInt(shot.scene_index, 10) || 0) - 1;
    if (idx < 0 || idx >= scenes.length) return;
    const sc = scenes[idx];
    if (shot.camera_motion) sc.camera_motion = shot.camera_motion;
    if (shot.duration_sec) sc.duration = parseInt(shot.duration_sec, 10) || sc.duration;
    const augment = shot.visual_prompt_augment || '';
    if (augment) {
      const base = (sc.visual_prompt || '').trim();
      sc.visual_prompt = base ? `${base}\n[감독 노트] ${augment}` : augment;
    }
    applied++;
  });
  if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch (e) {} }
  toast(`씬 ${applied}개에 감독 노트 적용`, 'success');
}
window.savApplyDirectorToScenes = savApplyDirectorToScenes;

// 감독 상주 배너 — 단계 전환마다 현재 설정된 감독 엔진이 연출 의도·지시를 말함
async function savLoadDirectorNote(step, opts) {
  opts = opts || {};
  const msgEl = document.getElementById('sav-director-message');
  const statusEl = document.getElementById('sav-director-status');
  if (!msgEl) return;
  const profile = window._globalProfileData || {};
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const isFirst = !_savState._directorGreeted;
  if (statusEl) statusEl.textContent = '지시 정리 중...';
  // 중복 요청 방지
  const ticket = ++_savState._directorNoteTicket;
  try {
    const res = await api('/api/advideo/director-note', {
      method: 'POST',
      body: {
        step: step || _savState.currentStep || 1,
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        style: document.getElementById('sav-style')?.value || '',
        story_angle: (document.getElementById('sav-story-angle')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        scenes_len: scenes.length,
        brand_name: profile.name || '',
        free_seed: (document.getElementById('sav-free-seed')?.value || '').trim(),
        is_first: isFirst,
        director_model: document.getElementById('sav-director-model')?.value || '',
        persona_id: document.getElementById('sav-director-persona')?.value || '',
      },
    });
    if (ticket !== _savState._directorNoteTicket) return; // 뒤에 다른 호출이 들어왔으면 무시
    const msg = (res && res.message) || '';
    const ask = (res && res.ask) || '';
    const errCode = res && res.error_code;
    if (errCode) {
      // 잔액 부족·인증 오류 등 — 붉은 배너로 표시 + 설정 링크
      msgEl.innerHTML = `<div style="padding:8px 10px;background:rgba(255,59,48,0.08);border-left:3px solid #ff3b30;border-radius:4px;font-size:12px;color:#ff3b30;font-weight:600;">
        ${escapeHtml(msg || '감독 모델 오류')}
        <div style="margin-top:4px;font-size:11px;font-weight:500;color:rgba(0,0,0,0.7);">
          <a href="#" onclick="navigateToPage('settings');return false;" style="color:#5856d6;font-weight:700;">⚙ 설정 페이지에서 감독 프로바이더 변경</a>
        </div>
      </div>`;
      if (statusEl) statusEl.textContent = `감독: ${errCode}`;
      return;
    }
    if (msg) {
      msgEl.innerHTML = escapeHtml(msg) + (ask ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(88,86,214,0.06);border-left:3px solid #5856d6;border-radius:4px;font-size:11px;">❓ ${escapeHtml(ask)}</div>` : '');
      _savState._directorGreeted = true;
      // 히스토리에 감독 발화 누적 (단계 전환 컨텍스트 표기)
      const hist = savGetDirectorHistory();
      hist.push({ role: 'assistant', content: `[단계 ${step} 진입] ${msg}${ask ? `\n❓ ${ask}` : ''}` });
      try { savRenderDirectorLog(); } catch (_) {}
    }
    // 감독 모델명은 이 배너에 직접 노출하지 않음 (상세는 결과 카드에서 확인)
    if (statusEl) statusEl.textContent = `단계 ${step}`;
  } catch (e) {
    if (statusEl) statusEl.textContent = '감독 연결 실패';
    msgEl.textContent = '감독 연결에 실패했습니다. 현재 선택한 프로바이더 설정과 로그인 상태를 확인해주세요. 작업은 계속 진행 가능합니다.';
  }
}
window.savLoadDirectorNote = savLoadDirectorNote;

function savRefreshDirectorNote() {
  savLoadDirectorNote(_savState.currentStep || 1);
}
window.savRefreshDirectorNote = savRefreshDirectorNote;

function savGetDirectorHistory() {
  if (!Array.isArray(_savState._directorHistory)) _savState._directorHistory = [];
  return _savState._directorHistory;
}

function savRenderDirectorLog() {
  const box = document.getElementById('sav-director-log');
  if (!box) return;
  const hist = savGetDirectorHistory();
  if (!hist.length) { box.innerHTML = '<div style="color:rgba(0,0,0,0.35);text-align:center;">대화 기록이 없습니다.</div>'; return; }
  box.innerHTML = hist.map(h => {
    const isUser = h.role === 'user';
    return `<div style="margin-bottom:6px;display:flex;${isUser?'justify-content:flex-end':'justify-content:flex-start'};">
      <div style="max-width:80%;padding:6px 10px;border-radius:10px;${isUser?'background:#ff8c00;color:#fff;':'background:rgba(88,86,214,0.08);color:#1c1c1e;'};line-height:1.45;">
        <div style="font-size:9px;font-weight:700;opacity:0.7;margin-bottom:2px;">${isUser?'나':'🎬 감독'}</div>
        ${escapeHtml(h.content)}
      </div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function savToggleDirectorLog() {
  const box = document.getElementById('sav-director-log');
  if (!box) return;
  const isHidden = box.style.display === 'none';
  box.style.display = isHidden ? 'block' : 'none';
  if (isHidden) savRenderDirectorLog();
}
window.savToggleDirectorLog = savToggleDirectorLog;

// 사용자가 감독에게 지시·질문 전송
async function savSendDirectorMessage() {
  const input = document.getElementById('sav-director-input');
  const sendBtn = document.getElementById('sav-director-send');
  const msgEl = document.getElementById('sav-director-message');
  const statusEl = document.getElementById('sav-director-status');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) { toast('감독에게 전달할 지시사항을 입력하세요', 'error'); return; }
  const hist = savGetDirectorHistory();
  hist.push({ role: 'user', content: text });
  input.value = '';
  savRenderDirectorLog();
  if (sendBtn) sendBtn.disabled = true;
  if (statusEl) statusEl.textContent = '감독이 응답 중...';

  const profile = window._globalProfileData || {};
  const scenes = (_savState.script && _savState.script.scenes) || [];
  try {
    const res = await api('/api/advideo/director-note', {
      method: 'POST',
      body: {
        step: _savState.currentStep || 1,
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        style: document.getElementById('sav-style')?.value || '',
        story_angle: (document.getElementById('sav-story-angle')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        scenes_len: scenes.length,
        brand_name: profile.name || '',
        free_seed: (document.getElementById('sav-free-seed')?.value || '').trim(),
        is_first: false,
        user_message: text,
        history: hist.slice(0, -1), // 방금 추가한 user msg 제외한 이전 히스토리
        director_model: document.getElementById('sav-director-model')?.value || '',
        persona_id: document.getElementById('sav-director-persona')?.value || '',
      },
    });
    const reply = (res && res.message) || '';
    const ask = (res && res.ask) || '';
    const actions = (res && Array.isArray(res.actions)) ? res.actions : [];
    let actionSummary = '';
    if (actions.length) {
      actionSummary = savApplyDirectorActions(actions);
    }
    if (reply) {
      hist.push({ role: 'assistant', content: reply + (ask ? `\n\n❓ ${ask}` : '') + (actionSummary ? `\n\n⚡ ${actionSummary}` : '') });
      if (msgEl) msgEl.innerHTML = escapeHtml(reply)
        + (ask ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(88,86,214,0.06);border-left:3px solid #5856d6;border-radius:4px;font-size:11px;">❓ ${escapeHtml(ask)}</div>` : '')
        + (actionSummary ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(52,199,89,0.08);border-left:3px solid #34c759;border-radius:4px;font-size:11px;color:#248a40;">⚡ ${escapeHtml(actionSummary)}</div>` : '');
    }
    savRenderDirectorLog();
    const logBox = document.getElementById('sav-director-log');
    if (logBox && logBox.style.display === 'none') logBox.style.display = 'block';
    if (statusEl) statusEl.textContent = `단계 ${_savState.currentStep || 1}`;
  } catch (e) {
    hist.push({ role: 'assistant', content: '응답 실패: ' + (e?.message || e) });
    savRenderDirectorLog();
    if (statusEl) statusEl.textContent = '응답 실패';
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}
window.savSendDirectorMessage = savSendDirectorMessage;

// 감독이 반환한 actions 를 실제 씬·스크립트·상태에 적용
function savApplyDirectorActions(actions) {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const applied = [];
  for (const a of actions) {
    try {
      const t = String(a.type || '').trim();
      if (t === 'apply_to_all' && a.hint) {
        scenes.forEach(s => {
          if (!s.visual_prompt) s.visual_prompt = '';
          s.visual_prompt += `\n[감독 지시] ${a.hint}`;
        });
        applied.push(`전체 ${scenes.length}씬에 "${a.hint}" 추가`);
      } else if (t === 'update_scene' && a.scene_index) {
        const idx = parseInt(a.scene_index, 10) - 1;
        if (idx >= 0 && idx < scenes.length) {
          scenes[idx].visual_prompt = (scenes[idx].visual_prompt || '') + `\n[감독 지시] ${a.hint || ''}`;
          applied.push(`씬 ${a.scene_index}: "${a.hint || ''}" 추가`);
        }
      } else if (t === 'recast_character') {
        applied.push(`캐릭터 재캐스팅 권장 (사유: ${a.reason || '-'})`);
        // UI 알림으로 사용자가 직접 버튼 다시 누르도록
      } else if (t === 'change_angle' && a.angle) {
        const sel = document.getElementById('sav-story-angle');
        if (sel) { sel.value = a.angle; applied.push(`스토리 각도 → ${a.angle}`); }
      }
    } catch (_) { /* ignore */ }
  }
  if (applied.length && typeof savRenderScript === 'function') {
    try { savRenderScript(); } catch (_) {}
  }
  return applied.join(' · ');
}
window.savApplyDirectorActions = savApplyDirectorActions;

// ─── 감독이 단계별 AI 자동 진행 ─────────────────────────────────
async function savDirectorTakeStep(stepOverride) {
  const step = parseInt(stepOverride || _savState.currentStep || 1, 10);
  const STEP_LABELS = {1:'소재 정리', 2:'브리프 정의', 3:'스타일·모델 선택', 4:'스크립트 + 씬 디렉팅', 5:'씬별 AI 보정', 6:'TTS 보이스·BGM 설정', 7:'영상 생성'};
  const statusEl = document.getElementById('sav-director-take-status');
  // 큰 진행 오버레이
  savShowDirectorOverlay(step, STEP_LABELS[step] || `${step}단계`);
  const setStatus = (t) => {
    if (statusEl) statusEl.textContent = t;
    savUpdateDirectorOverlay(t);
  };
  const btn = document.getElementById('sav-director-take-step');
  if (btn) btn.disabled = true;
  try {
    setStatus(`감독이 ${step}단계를 진행합니다...`);
    if (step === 1) {
      // 1단계는 수동 업로드 위주 — 감독은 권장만, 비어있으면 다음 단계로 안내
      const uploaded = savGetUploadedImageMeta().length;
      if (uploaded === 0) {
        setStatus('소재가 비어있습니다. 2단계에서 AI가 소재도 생성합니다.');
      } else {
        setStatus(`소재 ${uploaded}장 확인. 2단계로 이동합니다.`);
      }
      setTimeout(() => savGoStep(2), 400);
    } else if (step === 2) {
      // 주제·메시지·스토리 일괄 생성
      setStatus('브리프·스토리 생성 중...');
      await savSuggestBriefAll();
      // AI 소재 이미지도 없으면 자동 생성 (선택)
      if (!savGetUploadedImageMeta().length) {
        try { await savSuggestImagesAI(); } catch (_) {}
      }
      setStatus('2단계 완료. 3단계로 이동합니다.');
      setTimeout(() => savGoStep(3), 500);
    } else if (step === 3) {
      // 500종에서 유니크 스타일 추천 → 1번 자동 선택
      setStatus('500종 중 유니크 스타일 추천 중...');
      await savSuggestUniqueStyles();
      const list = _savState._uniqueStyleSuggestions || [];
      if (list.length) {
        savPickUniqueStyle(0);
        setStatus(`스타일 선택: ${list[0].label}`);
      } else {
        setStatus('스타일 추천 실패. 기본 스타일 사용.');
      }
      setTimeout(() => savGoStep(4), 500);
    } else if (step === 4) {
      // 스크립트 생성 → 감독 디렉팅 트리트먼트 → 씬에 적용
      setStatus('씬 스크립트 생성 중...');
      await savGenerateScript();
      // auto-direct 이미 내부에서 트리거되므로 completion 대기 후 감독 트리트먼트 실행
      setTimeout(async () => {
        try {
          setStatus('감독 디렉팅 트리트먼트 생성 중...');
          await savRunFilmDirector();
          savApplyDirectorToScenes();
          // ★ direct-film 이 늦게 끝나서 이미 step 5+ 로 넘어갔으면 backward 점프 방지
          const _curStep4 = parseInt(_savState.currentStep || 1, 10) || 1;
          if (_curStep4 < 5) {
            setStatus('4단계 완료. 5단계로 이동합니다.');
            setTimeout(() => savGoStep(5), 400);
          } else {
            console.log(`[step4] direct-film 늦게 완료 — 이미 step ${_curStep4} 진행 중, 점프 안 함`);
          }
        } catch (e) { setStatus('감독 디렉팅 실패: ' + (e?.message || e)); }
      }, 1500);
    } else if (step === 5) {
      // 씬 보정 (AI 자동 디렉팅)
      setStatus('씬별 카메라·라이팅 자동 보정 중...');
      if (typeof savAutoDirect === 'function') { try { await savAutoDirect(); } catch (_) {} }
      const _curStep5 = parseInt(_savState.currentStep || 1, 10) || 1;
      if (_curStep5 < 6) {
        setStatus('5단계 완료. 6단계로 이동합니다.');
        setTimeout(() => savGoStep(6), 400);
      }
    } else if (step === 6) {
      // TTS 목소리·BGM 감독 결정 (목소리 톤은 스토리 각도 기반으로 선택)
      const angle = (document.getElementById('sav-story-angle')?.value || 'auto').trim();
      const prefs = {
        'customer-day': 'Kore', 'testimonial-story': 'Aoede', 'persona-journey': 'Zephyr',
        'emotional-hook': 'Zephyr', 'reveal-twist': 'Fenrir', 'pain-relief': 'Kore',
        'numbers': 'Charon', 'authority': 'Charon', 'aspiration': 'Leda',
        'craftsmanship': 'Puck', 'origin-story': 'Puck', 'ingredient-focus': 'Charon',
        'seasonal': 'Kore', 'gift': 'Aoede', 'limited': 'Fenrir',
        'trend-ride': 'Fenrir', 'demo': 'Orus', 'before-after': 'Zephyr',
        'versus': 'Charon', 'social-proof': 'Aoede', 'transformation': 'Zephyr',
        'auto': 'Kore',
      };
      const voice = prefs[angle] || 'Kore';
      const voiceSel = document.getElementById('sav-voice');
      if (voiceSel) {
        const candidates = [voice, `gemini-${voice}`, `Gemini-${voice}`];
        const opt = Array.from(voiceSel.options).find(o => candidates.includes(o.value));
        if (opt) voiceSel.value = opt.value;
      }
      // ★ 자동 진행 시 TTS / BGM / 자막 체크박스 모두 ON 강제 (사용자: "음악·나레이션이 하나도 안 나와")
      const ttsCb = document.getElementById('sav-add-tts');
      const bgmCb = document.getElementById('sav-add-bgm');
      const subCb = document.getElementById('sav-add-subtitle');
      if (ttsCb && !ttsCb.checked) { ttsCb.checked = true; ttsCb.dispatchEvent(new Event('change')); }
      if (bgmCb && !bgmCb.checked) { bgmCb.checked = true; bgmCb.dispatchEvent(new Event('change')); }
      if (subCb && !subCb.checked) { subCb.checked = true; subCb.dispatchEvent(new Event('change')); }
      setStatus(`TTS=${voice} · BGM ON · 자막 ON · 7단계로 이동`);
      setTimeout(() => savGoStep(7), 500);
    } else if (step === 7) {
      // 최종 영상 생성 트리거
      setStatus('영상 생성을 시작합니다...');
      const genBtn = document.getElementById('sav-generate-btn');
      if (genBtn && !genBtn.disabled) {
        setTimeout(() => { try { savGenerateVideo(); } catch (_) {} }, 300);
      } else if (typeof savGenerateVideo === 'function') {
        setTimeout(() => { try { savGenerateVideo(); } catch (_) {} }, 300);
      }
    }
  } finally {
    if (btn) btn.disabled = false;
    // 1초 후 오버레이 자동 숨김 (사용자가 결과 확인 가능)
    setTimeout(() => savHideDirectorOverlay(), 1500);
  }
}
window.savDirectorTakeStep = savDirectorTakeStep;

// 🎬 감독 진행 큰 오버레이 (사용자 요청: 진행중 표시 크게)
function savShowDirectorOverlay(step, label) {
  let ov = document.getElementById('sav-director-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sav-director-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;animation:sav-fade-in 0.25s ease-out;';
    ov.innerHTML = `
      <style>
        @keyframes sav-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes sav-tangerine-spin{
          0%{transform:rotate(0deg) scale(1)}
          50%{transform:rotate(180deg) scale(1.1)}
          100%{transform:rotate(360deg) scale(1)}
        }
        @keyframes sav-glow{
          0%,100%{filter:drop-shadow(0 0 12px rgba(255,140,0,0.6))}
          50%{filter:drop-shadow(0 0 24px rgba(255,213,128,0.95))}
        }
      </style>
      <div style="background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:28px;padding:44px 60px;min-width:480px;max-width:680px;text-align:center;box-shadow:0 24px 70px rgba(255,140,0,0.55);">
        <div style="font-size:96px;line-height:1;margin-bottom:24px;display:inline-block;animation:sav-tangerine-spin 1.6s ease-in-out infinite, sav-glow 1.6s ease-in-out infinite;">🍊</div>
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">감독 진행 중 · STEP ${step}</div>
        <div id="sav-director-overlay-step" style="font-size:26px;font-weight:900;margin-bottom:18px;text-shadow:0 2px 8px rgba(0,0,0,0.2);">${label}</div>
        <div id="sav-director-overlay-msg" style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.95);line-height:1.6;min-height:42px;">시작합니다…</div>
        <div style="margin-top:24px;font-size:11px;color:rgba(255,255,255,0.7);">완료될 때까지 기다려주세요 🍊</div>
      </div>
    `;
    document.body.appendChild(ov);
  } else {
    ov.style.display = 'flex';
    const stepEl = document.getElementById('sav-director-overlay-step');
    if (stepEl) stepEl.textContent = label || `${step}단계`;
  }
}
function savUpdateDirectorOverlay(msg) {
  const el = document.getElementById('sav-director-overlay-msg');
  if (el) el.textContent = msg || '';
}
function savHideDirectorOverlay() {
  const ov = document.getElementById('sav-director-overlay');
  if (ov) ov.style.display = 'none';
}
window.savHideDirectorOverlay = savHideDirectorOverlay;

// 전 단계를 감독이 순서대로 자동 진행
async function savDirectorRunAll() {
  const statusEl = document.getElementById('sav-director-take-status');
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
  if (!confirm('감독이 1→7단계를 자동으로 진행합니다. 중간에 개입하려면 각 단계에서 채팅으로 지시하세요. 진행할까요?')) return;
  _savState._autoRunning = true;
  try {
    const steps = [2, 3, 4, 5, 6, 7]; // 1은 수동 업로드가 있으면 건너뛰지만 없어도 2에서 AI가 생성
    for (const s of steps) {
      try {
        _savState.currentStep = s;
        await savDirectorTakeStep(s);
        // 각 단계 간 여유 텀 — UI 렌더 반영 대기
        await new Promise(r => setTimeout(r, 2200));
      } catch (e) {
        setStatus(`단계 ${s} 실패: ${e?.message || e}`);
        break;
      }
    }
  } finally {
    _savState._autoRunning = false;
  }
}
window.savDirectorRunAll = savDirectorRunAll;

// ─── 가상 캐릭터 캐스팅 (씬 간 인물 연속성 해결) ───────────────
async function savCreateCharacter() {
  // 업로드 이미지에 이미 인물이 있으면 경고
  const personUploads = (_savState.uploadedImages || []).filter(u => typeof u === 'object' && u.role === 'person');
  if (personUploads.length) {
    const ok = confirm(`업로드 이미지에 이미 인물(${personUploads.length}장)이 있습니다.\n\n가상 인물을 새로 캐스팅하면 업로드한 인물 대신 AI 가상 인물이 주인공이 됩니다.\n\n업로드한 인물을 주인공으로 쓰려면 "취소" 를 누르세요.\n\n그래도 새 가상 인물을 캐스팅할까요?`);
    if (!ok) return;
  }
  const btn = document.getElementById('sav-char-btn');
  const area = document.getElementById('sav-character-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '👤 캐스팅 중...'; }
  if (area) { area.style.display = 'block'; area.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:rgba(0,0,0,0.5);">감독이 가상 인물 프로필을 짜고 3개 앵글 레퍼런스 이미지를 생성 중... (1~2분)</div>'; }
  try {
    const res = await api('/api/advideo/create-character', {
      method: 'POST',
      body: {
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        target_persona: '',
        aspect_ratio: document.getElementById('sav-ratio')?.value || '9:16',
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
      },
    });
    const char = res?.character || {};
    const refs = res?.references || [];
    _savState.character = char;
    _savState.characterRefs = refs.filter(r => r.image_path);
    // 🔒 모든 씬 visual_prompt 맨 앞에 캐릭터 스펙 강제 prefix — 씬마다 인물이 바뀌지 않도록
    try {
      const scenes = (_savState.script && _savState.script.scenes) || [];
      const marker = '[SAME CHARACTER]';
      const spec = `${marker} ${char.name || ''} · ${char.age_range || ''} · ${char.gender || ''} · 헤어: ${char.hair || ''} · 의상: ${char.outfit || ''} · 얼굴: ${char.face_features || ''}. 모든 씬에 동일 인물. 다른 사람으로 절대 바뀌지 말 것. ${char.visual_prompt_base || ''}`;
      scenes.forEach(s => {
        if (!s.visual_prompt) s.visual_prompt = '';
        const idx = s.visual_prompt.indexOf(marker);
        const body = idx >= 0 ? s.visual_prompt.slice(s.visual_prompt.indexOf('\n', idx) + 1) : s.visual_prompt;
        s.visual_prompt = spec + '\n\n' + body.trimStart();
      });
      if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    } catch (_) {}
    if (area) {
      area.innerHTML = `<div style="padding:12px;background:#fff;border:1px solid rgba(255,140,0,0.3);border-radius:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-weight:800;color:#ff6b00;font-size:12px;">👤 캐스팅 완료 — <span style="color:#1c1c1e;">${escapeHtml(char.name||'?')} · ${escapeHtml(char.age_range||'')} · ${escapeHtml(char.gender||'')}</span></div>
          <button type="button" onclick="savCreateCharacter()" style="padding:3px 10px;font-size:10px;font-weight:700;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff6b00;border-radius:999px;cursor:pointer;">🔄 재캐스팅</button>
        </div>
        <div style="font-size:11px;color:rgba(0,0,0,0.7);line-height:1.55;margin-bottom:8px;">
          <b>헤어:</b> ${escapeHtml(char.hair||'-')} · <b>의상:</b> ${escapeHtml(char.outfit||'-')}<br>
          <b>분위기:</b> ${escapeHtml(char.vibe||'-')} · <b>직업:</b> ${escapeHtml(char.occupation_hint||'-')}<br>
          <b>시그니처 동작:</b> ${escapeHtml(char.signature_gesture||'-')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          ${refs.map(r => r.image_url ? `<div style="border:1px solid rgba(0,0,0,0.08);border-radius:8px;overflow:hidden;">
            <img src="${escapeHtml(r.image_url)}" style="width:100%;aspect-ratio:9/16;object-fit:cover;display:block;">
            <div style="padding:4px 6px;font-size:9px;color:rgba(0,0,0,0.55);text-align:center;">${escapeHtml(r.angle||'')}</div>
          </div>` : `<div style="padding:10px;border:1px dashed rgba(255,59,48,0.3);border-radius:8px;font-size:10px;color:#ff3b30;text-align:center;">${escapeHtml(r.angle||'')}<br>생성 실패</div>`).join('')}
        </div>
        <div style="margin-top:8px;padding:6px 8px;background:rgba(255,140,0,0.08);border-left:3px solid #ff8c00;border-radius:4px;font-size:10px;">✅ 이 인물이 모든 씬의 reference 로 자동 전달됩니다 — 스토리보드 + 영상 생성 시 동일 인물 유지</div>
      </div>`;
    }
    toast('가상 캐릭터 캐스팅 완료 — 모든 씬에 자동 주입됩니다');
  } catch (e) {
    toast('캐스팅 실패: ' + (e?.message||e), 'error');
    if (area) area.innerHTML = `<div style="padding:12px;color:#ff3b30;font-size:11px;text-align:center;">캐스팅 실패: ${escapeHtml(String(e?.message||e))}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '👤 가상 캐릭터 캐스팅'; }
  }
}
window.savCreateCharacter = savCreateCharacter;
