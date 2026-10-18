/* single_advideo — 감독 busy 래퍼 + 페이지 init + 스텝 진행 + 프로필·스튜디오·미디어 기본값 */

// ─── 감독 busy 상태 표시 / api() 래퍼 ────────────────────────
function savForceDirectorIdle() {
  _savBusyCounter = 0;
  savMarkDirectorIdle();
  if (typeof toast === 'function') toast('감독 진행 상태 강제 종료', 'info');
}
window.savForceDirectorIdle = savForceDirectorIdle;

function savMarkDirectorBusy(label) {
  _savBusyCounter++;
  _savBusyCurrentLabel = label || '감독 진행';
  // 작업별 watchdog (강제 종료 임계값) — 너무 짧으면 정상 작업이 죽고 다시 살아남
  // - 영상 생성·멀티포맷 실렌더·이미지 생성: 5분
  // - 스토리보드·캐릭터 캐스팅·AI 소재 생성·자동 보정·스크립트·연속성 락: 4분
  // - 자동 진행 모드: 10분 (긴 시퀀스 보호)
  // - 그 외 일반 감독 호출: 3분
  let watchdogMs = 180000; // 기본 3분
  if (/영상 생성|멀티포맷 실렌더|이미지 생성/.test(_savBusyCurrentLabel)) watchdogMs = 300000;
  else if (/스토리보드|캐릭터 캐스팅|AI 소재|자동 보정|스크립트|연속성/.test(_savBusyCurrentLabel)) watchdogMs = 240000;
  if (_savState && _savState._autoRunning) watchdogMs = Math.max(watchdogMs, 600000); // 자동 진행 시 10분
  if (_savBusyWatchdog) clearTimeout(_savBusyWatchdog);
  _savBusyWatchdog = setTimeout(() => {
    console.warn(`[sav] busy watchdog triggered (${watchdogMs/1000}s) — label=${_savBusyCurrentLabel}`);
    savForceDirectorIdle();
  }, watchdogMs);
  const badge = document.getElementById('sav-director-busy');
  if (badge) {
    badge.style.display = 'inline-block';
    badge.textContent = `🎬 ${_savBusyCurrentLabel} 중…`;
    badge.style.cursor = 'pointer';
    badge.title = '클릭해서 강제 종료';
    badge.onclick = savForceDirectorIdle;
  }
  // 메시지 영역 자체를 "작업 중" 상태로 교체 (눈에 띄게)
  const msgEl = document.getElementById('sav-director-message');
  if (msgEl && _savBusyCounter === 1) {
    if (!msgEl.dataset.savOriginal) msgEl.dataset.savOriginal = msgEl.innerHTML;
    msgEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:linear-gradient(135deg,rgba(88,86,214,0.10),rgba(88,86,214,0.03));border-left:3px solid #5856d6;border-radius:8px;">
      <span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(88,86,214,0.3);border-top-color:#5856d6;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></span>
      <span style="color:#5856d6;font-weight:700;">감독이 ${escapeHtml(_savBusyCurrentLabel)} 중입니다…</span>
    </div>`;
  } else if (msgEl && _savBusyCounter > 1) {
    // 동시 작업이면 라벨만 업데이트
    const label2 = document.querySelector('#sav-director-message span[style*="color:#5856d6"]:last-of-type');
    if (label2) label2.textContent = `감독이 ${_savBusyCurrentLabel} 중입니다…`;
  }
}
function savMarkDirectorIdle() {
  _savBusyCounter = Math.max(0, _savBusyCounter - 1);
  if (_savBusyCounter === 0) {
    if (_savBusyWatchdog) { clearTimeout(_savBusyWatchdog); _savBusyWatchdog = null; }
    const badge = document.getElementById('sav-director-busy');
    if (badge) badge.style.display = 'none';
    _savBusyCurrentLabel = '';
    // 메시지 영역이 아직 busy 상태(응답이 안 왔음)면 원본 복구
    const msgEl = document.getElementById('sav-director-message');
    if (msgEl && msgEl.innerHTML.includes('감독이') && msgEl.innerHTML.includes('중입니다')) {
      const orig = msgEl.dataset.savOriginal;
      if (orig !== undefined) { msgEl.innerHTML = orig; delete msgEl.dataset.savOriginal; }
    } else if (msgEl) {
      delete msgEl.dataset.savOriginal;
    }
  }
}
window.savMarkDirectorBusy = savMarkDirectorBusy;
window.savMarkDirectorIdle = savMarkDirectorIdle;

function savUnsupportedAdvideoFallback(key) {
  switch (key) {
    case 'director-personas':
      return { status: 'ok', personas: [{ id: 'default', label: '기본 감독', style: '유니크·광고 최적' }] };
    case 'director-note':
      return { status: 'ok', message: '', ask: '', actions: [], auto_greet: false };
    case 'suggest-brief':
      return { status: 'ok', topic: '', message: '', angle: '', detail: '', text_provider: 'codex', text_model: 'go-fallback' };
    case 'suggest-story-angle':
      return { status: 'ok', angle: 'auto', text_provider: 'codex', text_model: 'go-fallback' };
    case 'suggest-images':
      return { status: 'ok', images: [], text_provider: 'codex', text_model: 'go-fallback' };
    case 'suggest-unique-style':
      return { status: 'ok', suggestions: [], text_provider: 'codex', text_model: 'go-fallback' };
    case 'classify-image':
      return { status: 'ok', role: 'scene', description: '', usage_hint: '' };
    default:
      return null;
  }
}

// api() 전역 함수 래핑 — advideo 엔드포인트 호출 시 배너에 자동 busy 표시
(function _wrapApiForDirectorBusy() {
  if (window._savApiWrapped) return;
  const origApi = window.api;
  if (typeof origApi !== 'function') return;
  window._savApiWrapped = true;
  window.api = async function (url, opts) {
    const u = String(url || '');
    const m = /\/api\/advideo\/([a-z0-9-]+)/.exec(u);
    const key = m ? m[1] : null;
    const label = key ? _SAV_DIRECTOR_BUSY_LABELS[key] : null;
    if (label) savMarkDirectorBusy(label);
    try {
      return await origApi.apply(this, arguments);
    } catch (err) {
      if (err?.status === 501 && key) {
        const fallback = savUnsupportedAdvideoFallback(key);
        if (fallback) {
          console.warn(`[SAV] Go-only fallback applied for ${u}`);
          return fallback;
        }
        console.warn(`[SAV] Go-only 501 from ${u}`);
      }
      throw err;
    }
    finally { if (label) savMarkDirectorIdle(); }
  };
})();

// ─── 페이지 초기화 + 스텝 진행 업데이트 ───────────────────
function savInit() {
  savRenderImages();
  savApplyMediaOptionDefaults();
  savApplyStudioDraft();
  savBindPreviewControls();
  savRenderSubtitlePreview();
  savBindDropZone();
  try { savRenderProfileImagePicker(); } catch (e) { /* ignore */ }
  // 초기엔 자동 채우기 하지 않음 — 2단계에서 사용자가 명시적으로 "프로필에서 채우기" 버튼을 누르거나 직접 입력
  try { savUpdateStepProgress(); } catch (e) { /* ignore */ }
  savLoadBgmOptions().catch(err => {
    console.warn('[SAV] BGM 목록 로드 실패:', err?.message || err);
    savSetBgmStatus('BGM 목록을 불러오지 못했습니다.', true);
  });
  try { savLoadDirectorModels(); } catch (e) { /* ignore */ }
  Promise.resolve()
    .then(() => savLoadDirectorPersonas())
    .catch(() => {});
  // 페이지 진입 시 감독이 먼저 인사
  // 감독 첫 인사는 자동으로 띄우지 않는다.
  // 사용자가 직접 새로고침하거나 단계 액션을 실행할 때만 호출한다.

  // 주요 상태 변경 시 자동 갱신 hook
  const origRenderImages = window.savRenderImages;
  if (typeof origRenderImages === 'function' && !origRenderImages._stepHooked) {
    const hooked = function () {
      const r = origRenderImages.apply(this, arguments);
      try { savUpdateStepProgress(); } catch (e) { /* ignore */ }
      try { savRenderBriefImages(); } catch (e) { /* ignore */ }
      return r;
    };
    hooked._stepHooked = true;
    window.savRenderImages = hooked;
  }
}

// 스텝 표시 업데이트 — 사용자가 명시적으로 클릭한 단계만 표시.
// 업로드/스크립트 생성 등의 상태는 "완료(✓)" 마크에만 반영, 현재 단계는 절대 자동 변경 안 함.
function savUpdateStepProgress() {
  const progressWrap = document.getElementById('sav-step-progress');
  if (!progressWrap) return;
  const currentStep = parseInt(_savState.currentStep || 1, 10) || 1;

  // 완료 판정 (7단계)
  const completed = new Set();
  if (_savState.uploadedImages && _savState.uploadedImages.length) completed.add(1);
  const topicEl = document.getElementById('sav-topic');
  if (topicEl && topicEl.value.trim()) completed.add(2);
  if (_savState.script && _savState.script.scenes && _savState.script.scenes.length) completed.add(4);
  const hasDirected = _savState.script && (_savState.script.scenes || []).some(s => s && s.camera_preset);
  if (hasDirected) completed.add(5);
  if (_savState.finalVideoPath) completed.add(7);
  // 방문 한 단계(3/6 등 기본값이 있는 선택 단계)도 완료로 마킹
  const visited = _savState._visited || {};
  Object.keys(visited).forEach(function (k) {
    if (visited[k]) completed.add(parseInt(k, 10));
  });

  const steps = progressWrap.querySelectorAll('.sav-step');
  steps.forEach((el) => {
    const n = parseInt(el.getAttribute('data-sav-step') || '0', 10);
    const circle = el.querySelector('span:first-child');
    const label = el.querySelector('span:last-child');
    const active = n === currentStep;
    const done = completed.has(n) && !active;
    if (active) {
      el.style.borderColor = '#ff8c00';
      el.style.background = '#fff';
      el.style.boxShadow = '0 4px 14px rgba(255,140,0,0.2)';
      if (circle) { circle.style.background = '#ff8c00'; circle.style.color = '#fff'; circle.textContent = String(n); }
      if (label) { label.style.color = '#1c1c1e'; label.style.fontWeight = '800'; }
    } else if (done) {
      el.style.borderColor = 'rgba(52,199,89,0.5)';
      el.style.background = 'rgba(52,199,89,0.06)';
      el.style.boxShadow = 'none';
      if (circle) { circle.style.background = '#34c759'; circle.style.color = '#fff'; circle.textContent = '✓'; }
      if (label) { label.style.color = '#34c759'; label.style.fontWeight = '700'; }
    } else {
      el.style.borderColor = 'rgba(0,0,0,0.08)';
      el.style.background = '#fff';
      el.style.boxShadow = 'none';
      if (circle) { circle.style.background = 'rgba(0,0,0,0.08)'; circle.style.color = 'rgba(0,0,0,0.6)'; circle.textContent = String(n); }
      if (label) { label.style.color = 'rgba(0,0,0,0.6)'; label.style.fontWeight = '700'; }
    }
  });
}

// 7단계 — 4번 = 스크립트+자동 씬 디렉팅 (병합)

// ─── 스텝 이동 + 프로필/스튜디오 자동 채움 + 미디어 기본값 ─
function savGoStep(n, fromUser) {
  const maxStep = 7;
  let target = parseInt(n || 1, 10) || 1;
  if (target < 1) target = 1;
  if (target > maxStep) target = maxStep;
  const current = parseInt(_savState.currentStep || 1, 10) || 1;
  // 디버그 — 누가 어떤 단계로 보냈는지 콘솔에 stacktrace
  if (target !== current) {
    console.log(`[savGoStep] ${current}→${target} (fromUser=${!!fromUser})`);
    if (target < current) {
      console.trace('[savGoStep] backward 호출 스택');
    }
  }
  // ★ 영상 생성 완료 후 자동 backward 차단
  if (_savState.finalVideoPath && target < current && fromUser !== true) {
    console.warn(`[savGoStep] 영상 생성 후 자동 backward (${current}→${target}) 차단`);
    return;
  }
  // ★ 추가: 어느 시점이든 자동 backward 자체를 더 엄격히 차단 (현재 단계가 7 이고 target 이 5 면 무조건 차단)
  if (current >= 6 && target < current && fromUser !== true) {
    console.warn(`[savGoStep] step ${current} 에서 자동 backward (${current}→${target}) 차단`);
    return;
  }
  // 전진 시 단계별 유효성 검사 — 현재 단계에서 필수 작업 안 했으면 진행 차단
  if (target > current) {
    const hasScenes = _savState.script && _savState.script.scenes && _savState.script.scenes.length > 0;
    // 4단계(스크립트+씬 디렉팅) 에서 5단계 이상으로 진행 시 스크립트 필수
    if (current === 4 && target > 4 && !hasScenes) {
      if (typeof toast === 'function') toast('먼저 "AI 스크립트 생성" 버튼을 눌러 스크립트를 만들어주세요.', 'error');
      return;
    }
    // 현재 단계를 건너뛰고 4단계+ 를 바로 클릭했을 때도 막음
    if (target > 4 && !hasScenes) {
      if (typeof toast === 'function') toast('스크립트 생성이 먼저 필요합니다 (4단계).', 'error');
      target = 4;
    }
  }
  const mapping = SAV_STEP_MAP[target] || SAV_STEP_MAP[1];
  // 현재 단계를 떠날 때 방문 기록 남김
  if (_savState.currentStep && _savState.currentStep !== target) {
    _savState._visited = _savState._visited || {};
    _savState._visited[_savState.currentStep] = true;
  }
  _savState.currentStep = target;
  // 상단 네비 제목/비활성 업데이트
  try {
    const titleEl = document.getElementById('sav-nav-title');
    if (titleEl) titleEl.textContent = SAV_STEP_TITLES[target] || '';
    const prevBtn = document.getElementById('sav-nav-prev');
    const nextBtn = document.getElementById('sav-nav-next');
    if (prevBtn) { prevBtn.disabled = target <= 1; prevBtn.style.opacity = target <= 1 ? '0.4' : '1'; }
    if (nextBtn) { nextBtn.disabled = target >= maxStep; nextBtn.style.opacity = target >= maxStep ? '0.4' : '1'; }
  } catch (e) { /* ignore */ }

  document.querySelectorAll('.sav-panel').forEach(function (el) {
    const step = parseInt(el.getAttribute('data-step-panel') || '0', 10);
    el.style.display = (step === mapping.panel) ? 'block' : 'none';
  });

  if (target === 2) {
    try { savRenderBriefImages(); } catch (e) { /* ignore */ }
    // 2단계 진입 시 AI 추천 우선 자동 실행 — 프로필/자유주제/업로드 소재 중 하나라도 있으면 자동 채움
    try {
      const topic = (document.getElementById('sav-topic')?.value || '').trim();
      const message = (document.getElementById('sav-message')?.value || '').trim();
      const storyDetail = (document.getElementById('sav-story-detail')?.value || '').trim();
      const profile = window._globalProfileData || {};
      const freeSeed = (document.getElementById('sav-free-seed')?.value || '').trim();
      const uploadedCount = savGetUploadedImageMeta().length;
      const hasSeed = !!(profile?.name || profile?.description || freeSeed || uploadedCount > 0);
      if (!topic && !message && !storyDetail && hasSeed && !_savState._briefAutoSuggested) {
        _savState._briefAutoSuggested = true;
        setTimeout(function () { try { savSuggestBriefAll(); } catch (e) { /* ignore */ } }, 200);
      }
    } catch (e) { /* ignore */ }
  }
  if (target === 5) savRenderDirectingSummary();

  // ★ 4단계(스크립트+자동 씬 디렉팅) — 스크립트 생성 직후 자동으로 AI 씬 디렉팅 실행
  if (target === 4) {
    const scenes = (_savState.script && _savState.script.scenes) || [];
    const alreadyDirected = scenes.length && scenes.some(s => s && s.camera_preset);
    if (scenes.length && !alreadyDirected && !_savState._autoDirectTriggered) {
      _savState._autoDirectTriggered = true;
      if (typeof toast === 'function') toast('AI가 씬별 카메라·라이팅·스타일을 자동으로 입력합니다...', 'info');
      if (typeof savAutoDirect === 'function') {
        setTimeout(function () { savAutoDirect(); }, 300);
      }
    }
  }

  try { savUpdateStepProgress(); } catch (e) { /* ignore */ }

  // 사용자가 "감독 인사 불필요"를 요청한 흐름이라 단계 전환 자동 인사는 생략한다.

  // 해당 섹션으로 스크롤
  setTimeout(function () {
    if (mapping.anchor) {
      const el = document.getElementById(mapping.anchor);
      if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 50);
}

function savRenderDirectingSummary() {
  const box = document.getElementById('sav-directing-summary');
  if (!box) return;
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) {
    box.innerHTML = '스크립트 생성 후 <b>AI 자동 씬 디렉팅 실행</b>을 누르면 각 씬의 디렉팅 요약이 여기 표시됩니다.';
    return;
  }
  const hasDirect = scenes.some(s => s && s.camera_preset);
  if (!hasDirect) {
    box.innerHTML = '<b>' + scenes.length + '개 씬</b> 준비 완료. AI 자동 씬 디렉팅 실행 버튼을 눌러 각 씬에 카메라·라이팅·스타일을 자동 할당하세요.';
    return;
  }
  box.innerHTML = '<div style="font-weight:700;color:#1c1c1e;margin-bottom:6px;">각 씬 디렉팅:</div>'
    + scenes.map(function (s, i) {
      return '<div style="padding:6px 0;border-bottom:1px dashed rgba(0,0,0,0.06);font-size:11px;">'
        + '<b>씬 ' + (i + 1) + '</b> — '
        + [s.camera_preset, s.lighting_preset, s.style_preset, s.expression_preset].filter(Boolean).join(' · ')
        + ' · 모션 ' + (s.motion_intensity || 50)
        + (s.transition_preset ? ' → ' + s.transition_preset : '')
        + '</div>';
    }).join('');
}
window.savRenderDirectingSummary = savRenderDirectingSummary;
window.savGoStep = savGoStep;
window.savUpdateStepProgress = savUpdateStepProgress;

function savFillFromProfile(opts) {
  opts = opts || {};
  const p = window._globalProfileData || {};
  if (!p || !p.name) {
    if (!opts.silent) toast('활성 프로필이 없습니다', 'error');
    return;
  }
  const topicEl = document.getElementById('sav-topic');
  const msgEl = document.getElementById('sav-message');
  if (!topicEl && !msgEl) return;

  // 주제 = 브랜드명 + 업종/서비스 요약
  const brand = (p.name || '').trim();
  const bizType = (p.business_type || '').trim();
  const serviceDesc = (p.service_description || p.description || '').trim();
  const topicParts = [];
  if (brand) topicParts.push(brand);
  if (bizType) topicParts.push(bizType);
  const topicVal = topicParts.join(' · ') || brand;

  // 메시지 = 서비스 설명 + 핵심 특징 + CTA
  const msgLines = [];
  if (serviceDesc) msgLines.push(serviceDesc);
  if (p.key_features) msgLines.push('핵심 특징: ' + p.key_features);
  if (p.target_audience) msgLines.push('타겟: ' + p.target_audience);
  if (p.cta_text) msgLines.push('CTA: ' + p.cta_text);
  const msgVal = msgLines.join('\n');

  let filled = 0;
  if (topicEl && (!opts.onlyIfEmpty || !topicEl.value.trim())) {
    if (topicVal) { topicEl.value = topicVal; filled++; }
  }
  if (msgEl && (!opts.onlyIfEmpty || !msgEl.value.trim())) {
    if (msgVal) { msgEl.value = msgVal; filled++; }
  }
  if (filled && !opts.silent) {
    toast('프로필에서 광고 주제·메시지를 채웠습니다', 'success');
  }
}
window.savFillFromProfile = savFillFromProfile;

function savApplyStudioDraft() {
  const draft = window._videoStudioDraft;
  if (!draft || typeof draft !== 'object') return;

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null) return;
    el.value = String(value);
  };
  const appendValue = (id, value) => {
    const el = document.getElementById(id);
    const next = String(value || '').trim();
    if (!el || !next) return;
    const current = String(el.value || '').trim();
    el.value = current ? `${current}\n\n${next}` : next;
  };

  setValue('sav-source-url', draft.sourceUrl || '');
  setValue('sav-topic', draft.topic || '');
  setValue('sav-style', draft.style || 'reels');
  setValue('sav-ratio', draft.ratio || '9:16');
  setValue('sav-scenes', draft.scenes || '4');
  setValue('sav-model', draft.model || 'veo-3.1-lite-generate-preview');
  setValue('sav-voice', draft.voice || 'gemini-Kore');
  setValue('sav-subtitle-style', draft.subtitleStyle || 'promo');
  appendValue('sav-message', draft.message || '');

  const audioEl = document.getElementById('sav-generate-audio');
  if (audioEl && typeof draft.generateAudio === 'boolean') audioEl.checked = draft.generateAudio;
  const ttsEl = document.getElementById('sav-add-tts');
  if (ttsEl && typeof draft.addTts === 'boolean') ttsEl.checked = draft.addTts;
  const bgmEl = document.getElementById('sav-add-bgm');
  if (bgmEl && typeof draft.addBgm === 'boolean') bgmEl.checked = draft.addBgm;
  const enhanceEl = document.getElementById('sav-enhance-prompt');
  if (enhanceEl && typeof draft.enhancePrompt === 'boolean') enhanceEl.checked = draft.enhancePrompt;

  window._videoStudioDraft = null;
}

function savGetProfileId() {
  return parseInt(window._globalProfileId || 0, 10) || 0;
}
