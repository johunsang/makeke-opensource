// keyword_content/helpers.js — 프로필/파일/키워드/페이로드 헬퍼

/** 4단계 플랫폼별 생성 토글 */
function kcTogglePlatform(key, el) {
  const active = el.getAttribute('data-active') === 'true';
  const newVal = !active;
  el.setAttribute('data-active', String(newVal));
  setOpt(key, newVal);
  if (key === 'gen_blog_images') {
    setOpt('blog_image_count', newVal ? 5 : 0);
  }
  if (newVal) {
    el.style.border = '1.5px solid rgba(255,140,0,0.3)';
    el.style.background = 'rgba(255,140,0,0.08)';
    el.style.color = '#ff8c00';
  } else {
    el.style.border = '1.5px solid rgba(0,0,0,0.08)';
    el.style.background = 'transparent';
    el.style.color = 'rgba(0,0,0,0.3)';
  }
}

/** 4단계 적용 프로필 드롭다운 */
async function kcLoadProfileSelect() {
  const sel = document.getElementById('kc-apply-profile-select');
  if (!sel) return;
  try {
    const profiles = await api('/api/library/profiles');
    sel.innerHTML = '';
    (profiles || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.business_type ? ` (${p.business_type})` : '');
      sel.appendChild(opt);
    });
    if (window._globalProfileId) sel.value = window._globalProfileId;
  } catch(e) {}
}

function kcSwitchProfile(profileId) {
  if (!profileId) return;
  // 전역 프로필 변경
  window._globalProfileId = profileId;
  const sel = document.getElementById('sidebar-profile-select') || document.getElementById('global-profile-select');
  if (sel) sel.value = profileId;
  // 프로필 변경 이벤트 트리거
  if (typeof loadProfileAndApply === 'function') loadProfileAndApply(profileId);
  // 프롬프트 세트도 프로필에 맞게 새로 로드
  kcLoadPromptSets();
  toast('프로필 전환됨');
}

/** 프롬프트 세트 빠른 전환 (3단계 + 4단계 동기화) */
async function kcLoadPromptSets() {
  const selectors = ['kc-prompt-set-select', 'kc-step3-prompt-set', 'kc-step2-prompt-set'];
  try {
    const pid = parseInt(window._globalProfileId || 0);
    const sets = await api(`/api/prompt-sets?profile_id=${pid}`);
    const html = '<option value="">기본</option>' + (sets || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    selectors.forEach(id => { const el = document.getElementById(id); if (el) { el.innerHTML = html; if (_kcActivePromptSetId) el.value = _kcActivePromptSetId; } });
  } catch(e) {}
}

/** 3단계 프로필 select 동기화 */
function kcSyncStep3Profile() {
  const src = document.getElementById('kc-apply-profile-select');
  const dst = document.getElementById('kc-step3-profile-select');
  if (src && dst) { dst.innerHTML = src.innerHTML; dst.value = src.value; }
}

async function kcSaveCurrentAsSet() {
  // 톤 프리셋
  const tones = [
    { label: '정보전달형', desc: '정확한 사실, 객관적 톤, 교육적', icon: '📚' },
    { label: '마케팅형', desc: '전환 유도, 설득력, CTA 중심', icon: '🚀' },
    { label: '리뷰/후기형', desc: '체험 기반, 솔직한 평가', icon: '⭐' },
    { label: '뉴스/보도형', desc: '객관 보도, 팩트 중심', icon: '📰' },
    { label: '대화/친근형', desc: '일상적 톤, 공감', icon: '💬' },
    { label: '전문가 칼럼형', desc: '깊은 분석, 권위', icon: '🎓' },
    { label: '스토리텔링형', desc: '이야기 구조, 몰입', icon: '📖' },
    { label: '가이드/방법형', desc: '단계별 안내, 실용적', icon: '🔧' },
  ];

  // 업종별 콘텐츠 목적 프리셋 (프로필 업종에 따라 변경)
  const bizType = window._globalProfileData?.business_type || '';
  const bizPresets = {
    '성형외과': [
      { label: '시술 안내형', desc: '시술 종류/과정/효과 전달', icon: '💉' },
      { label: '전후 비교형', desc: 'Before & After 중심', icon: '✨' },
      { label: '회복 가이드형', desc: '수술 후 관리/주의사항', icon: '🏥' },
      { label: '상담 FAQ형', desc: '자주 묻는 질문 답변', icon: '❓' },
    ],
    '치과': [
      { label: '진료 안내형', desc: '치료 종류/과정 설명', icon: '🦷' },
      { label: '예방 정보형', desc: '구강 관리법/예방법', icon: '🪥' },
      { label: '전문 칼럼형', desc: '치과 전문 지식 전달', icon: '🩺' },
    ],
    '카페': [
      { label: '메뉴 소개형', desc: '음료/디저트 매력 어필', icon: '☕' },
      { label: '일상/감성형', desc: '카페 분위기, 일상 공유', icon: '📷' },
      { label: '레시피 공유형', desc: '음료/베이킹 레시피', icon: '🧁' },
    ],
    'IT/솔루션': [
      { label: '기술 분석형', desc: 'AI/테크 트렌드 분석', icon: '💻' },
      { label: '제품 가이드형', desc: '사용법/튜토리얼', icon: '📱' },
      { label: '사례 연구형', desc: '도입 사례/성과 공유', icon: '📊' },
    ],
    '부동산': [
      { label: '매물 분석형', desc: '입지/시세/투자 분석', icon: '🏢' },
      { label: '시장 전망형', desc: '부동산 시장 동향', icon: '📈' },
      { label: '실거주 후기형', desc: '실제 거주 경험 공유', icon: '🏠' },
    ],
    '법률': [
      { label: '법률 해설형', desc: '법 조항 쉽게 설명', icon: '⚖️' },
      { label: '판례 분석형', desc: '실제 사례/판례 분석', icon: '📋' },
      { label: '상담 안내형', desc: '법률 상담 Q&A', icon: '🔍' },
    ],
    '피부과': [
      { label: '시술 정보형', desc: '피부 시술 종류/효과', icon: '✨' },
      { label: '피부 관리형', desc: '홈케어/계절별 관리', icon: '🧴' },
    ],
    '음식점': [
      { label: '메뉴 스토리형', desc: '음식 재료/조리법 소개', icon: '🍳' },
      { label: '맛집 후기형', desc: '방문 체험/맛 평가', icon: '🍽️' },
    ],
  };

  // 현재 프로필 업종에 맞는 프리셋 찾기
  let matchedBiz = bizPresets[bizType] || null;
  if (!matchedBiz) {
    for (const [key, presets] of Object.entries(bizPresets)) {
      if (bizType && bizType.includes(key)) { matchedBiz = presets; break; }
    }
  }

  const _sel = (el) => {
    document.querySelectorAll('.kcSetItem').forEach(e => {
      e.style.border = '1.5px solid rgba(0,0,0,0.06)';
      e.style.background = '';
    });
    el.style.border = '1.5px solid #ff8c00';
    el.style.background = 'rgba(255,140,0,0.04)';
    document.getElementById('kcSetCustomName').value = el.getAttribute('data-label');
  };

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:500px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <div style="font-size:16px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">AI 프롬프트 세트 생성</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:16px;">톤 또는 콘텐츠 목적을 선택하면 현재 설정된 AI 엔진이 블로그·카드뉴스·SNS·영상·만화·상세페이지의 프롬프트를 전부 자동 설계합니다</div>

      ${matchedBiz ? `
      <div style="font-size:12px;font-weight:700;color:#ff8c00;margin-bottom:8px;">${bizType} 콘텐츠 목적</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
        ${matchedBiz.map(b => `<div class="kcSetItem" data-label="${bizType} ${b.label}" onclick="(${_sel.toString()})(this)" style="padding:9px 11px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.06);cursor:pointer;transition:all 0.15s;">
          <div style="font-size:13px;margin-bottom:1px;">${b.icon} <span style="font-weight:600;font-size:12px;">${b.label}</span></div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">${b.desc}</div>
        </div>`).join('')}
      </div>` : ''}

      <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);margin-bottom:8px;">글쓰기 톤</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
        ${tones.map(t => `<div class="kcSetItem" data-label="${t.label}" onclick="(${_sel.toString()})(this)" style="padding:9px 11px;border-radius:10px;border:1.5px solid rgba(0,0,0,0.06);cursor:pointer;transition:all 0.15s;">
          <div style="font-size:13px;margin-bottom:1px;">${t.icon} <span style="font-weight:600;font-size:12px;">${t.label}</span></div>
          <div style="font-size:10px;color:rgba(0,0,0,0.4);">${t.desc}</div>
        </div>`).join('')}
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;">또는 직접 입력:</div>
        <input type="text" id="kcSetCustomName" placeholder="예: 성형외과 시술 안내형, 카페 감성 마케팅형" style="width:100%;padding:8px 12px;border:1.5px solid rgba(0,0,0,0.1);border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="kcSetCancel" style="padding:10px 20px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:rgba(0,0,0,0.5);">취소</button>
        <button id="kcSetGenerate" style="padding:10px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>AI로 세트 생성
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#kcSetCancel').onclick = () => modal.remove();
  modal.querySelector('#kcSetGenerate').onclick = async () => {
    const name = document.getElementById('kcSetCustomName').value.trim();
    if (!name) { toast('톤/목적을 선택하거나 입력하세요', 'error'); return; }
    modal.remove();
    const selectedProvider = String(window._contentOpts?.text_provider || '').trim();
    const engineLabel = selectedProvider === 'codex' ? 'Codex CLI' : '현재 설정';

    // 전체 화면 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'kc-set-gen-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;width:420px;max-width:90vw;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="width:48px;height:48px;margin:0 auto 16px;border:3px solid rgba(255,140,0,0.2);border-top-color:#ff8c00;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <div style="font-size:18px;font-weight:800;color:#1c1c1e;margin-bottom:4px;">프롬프트 세트 설계 중</div>
        <div style="font-size:13px;color:rgba(0,0,0,0.4);margin-bottom:20px;">'${name}' — ${engineLabel}</div>
        <div id="kc-set-gen-log" style="text-align:left;background:rgba(0,0,0,0.03);border-radius:12px;padding:14px 16px;font-size:12px;line-height:1.8;color:rgba(0,0,0,0.6);min-height:120px;max-height:200px;overflow-y:auto;font-family:monospace;"></div>
        <div id="kc-set-gen-timer" style="margin-top:12px;font-size:11px;color:rgba(0,0,0,0.3);">경과 시간: 0초</div>
        <button onclick="document.getElementById('kc-set-gen-overlay')?.remove();window._setGenAbort?.abort()" style="margin-top:14px;padding:8px 20px;background:rgba(255,59,48,0.08);color:#ff3b30;border:1px solid rgba(255,59,48,0.2);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;">중단</button>
      </div>`;
    document.body.appendChild(overlay);

    const _logEl = document.getElementById('kc-set-gen-log');
    const _timerEl = document.getElementById('kc-set-gen-timer');
    const _addLog = (msg) => {
      if (_logEl) {
        _logEl.innerHTML += `<div>${msg}</div>`;
        _logEl.scrollTop = _logEl.scrollHeight;
      }
    };
    _addLog('🎯 세트 생성 시작');
    _addLog('📋 기본 프롬프트 템플릿 수집 중...');

    const _startTs = Date.now();
    const _timer = setInterval(() => {
      const sec = Math.round((Date.now() - _startTs) / 1000);
      if (_timerEl) _timerEl.textContent = `경과 시간: ${sec}초`;
      if (sec === 5) _addLog('🤖 현재 설정된 AI 엔진에 전략 설계 요청 전송...');
      if (sec === 15) _addLog('📝 블로그 시스템 프롬프트 설계 중...');
      if (sec === 25) _addLog('🖼️ 카드뉴스/상세페이지 프롬프트 설계 중...');
      if (sec === 35) _addLog('💬 SNS/영상/만화 프롬프트 설계 중...');
      if (sec === 45) _addLog('⚡ 최종 검증 및 변수 정합성 체크...');
      if (sec === 60) _addLog('⏳ 아직 설계 중... 곧 완료됩니다');
      if (sec === 90) _addLog('⏳ 복잡한 프롬프트를 정교하게 다듬는 중...');
    }, 1000);

    try {
      const pid = parseInt(window._globalProfileId || 0);
      const _abort = new AbortController();
      window._setGenAbort = _abort;
      const _timeoutId = setTimeout(() => _abort.abort(), 180000);
      const res = await api('/api/prompt-sets/generate', {
        method: 'POST',
        body: { tone: name, profile_id: pid },
        signal: _abort.signal,
      });
      clearTimeout(_timeoutId);
      clearInterval(_timer);
      _addLog(`✅ 완료! ${Object.keys(res.data || {}).length}개 카테고리 생성됨`);
      if (_timerEl) _timerEl.textContent = `완료! (${Math.round((Date.now() - _startTs) / 1000)}초)`;
      setTimeout(() => {
        overlay.remove();
        toast(res.message || `'${name}' 세트 생성 완료!`);
      }, 2000);
      await kcLoadPromptSets();
      if (typeof paLoadSetList === 'function') paLoadSetList();
      const sel = document.getElementById('kc-prompt-set-select');
      if (sel && res.id) { sel.value = res.id; kcQuickApplySet(res.id); }
    } catch(e) {
      clearInterval(_timer);
      overlay.remove();
      toast('세트 생성 실패: ' + e.message, 'error');
    }
  };
}

async function kcDeleteCurrentSet() {
  const sel = document.getElementById('kc-prompt-set-select');
  if (!sel || !sel.value) return;
  const name = sel.options[sel.selectedIndex]?.textContent || '';
  const ok = await showConfirm(`'${name}' 세트를 삭제할까요?`);
  if (!ok) return;
  try {
    await api(`/api/prompt-sets/${sel.value}`, { method: 'DELETE' });
    toast(`'${name}' 삭제됨`);
    sel.value = '';
    document.getElementById('kc-delete-set-btn').style.display = 'none';
    _kcPromptOverrides = {};
    await kcLoadPromptSets();
  } catch(e) { toast('삭제 실패: ' + e.message, 'error'); }
}

async function kcQuickApplySet(setId) {
  const delBtn = document.getElementById('kc-delete-set-btn');
  if (!setId) {
    _kcPromptOverrides = {};
    if (delBtn) delBtn.style.display = 'none';
    toast('기본 프롬프트로 전환');
    return;
  }
  if (delBtn) delBtn.style.display = '';
  try {
    const set = await api(`/api/prompt-sets/${setId}`);
    // 세트 데이터를 원본 중첩 구조 그대로 저장 (서버가 중첩 객체를 기대)
    _kcPromptOverrides = set.data || {};
    console.log('[KC] 프롬프트 세트 적용:', Object.keys(_kcPromptOverrides));
    toast(`'${set.name}' 세트 적용됨`);
  } catch(e) { toast('세트 적용 실패: ' + e.message, 'error'); }
}

/** 현재 선택된 프롬프트 세트 ID */

/** 3단계에서 프롬프트 세트 변경 → 세트 적용 + 프롬프트 재빌드 */
async function kcApplySetAndReload(setId) {
  _kcActivePromptSetId = setId;
  await kcQuickApplySet(setId);
  // 2단계 select도 동기화
  const step2 = document.getElementById('kc-step2-prompt-set');
  if (step2) step2.value = setId;
  // 프롬프트 워크벤치 재빌드 — 서버에서 다시 가져오기
  const root = document.getElementById('kc-prompt-inline-root');
  if (root) {
    root.style.display = 'none';
    root.innerHTML = '';
  }
  _kcPromptReviewed = false;
  toast(setId ? '프롬프트 세트 적용됨 — 프롬프트를 다시 불러옵니다' : '기본 프롬프트로 전환');
  kcGoToStep(3);
}

/** 플랫폼 토글 UI 상태를 contentOpts와 동기화 */
function kcSyncPlatformToggles() {
  const container = document.getElementById('kc-platform-toggles');
  if (!container) return;
  container.querySelectorAll('label[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    const active = key === 'gen_blog_images'
      ? !!(getOpt('gen_blog_images', false) || (parseInt(getOpt('blog_image_count', 0), 10) || 0) > 0)
      : !!getOpt(key, false);
    el.setAttribute('data-active', String(active));
    if (active) {
      el.style.border = '1.5px solid rgba(255,140,0,0.3)';
      el.style.background = 'rgba(255,140,0,0.08)';
      el.style.color = '#ff8c00';
    } else {
      el.style.border = '1.5px solid rgba(0,0,0,0.08)';
      el.style.background = 'transparent';
      el.style.color = 'rgba(0,0,0,0.3)';
    }
  });
}

/** 파일 업로드 → 텍스트 추출 → 직접 입력에 채우기 */
async function kcHandleFileUpload(files) {
  if (!files || !files.length) return;
  const status = document.getElementById('kc-file-upload-status');
  const textarea = document.getElementById('kc-direct-text');
  const keywordInput = document.getElementById('kc-direct-keyword');
  if (status) { status.style.display = 'block'; status.textContent = `${files.length}개 파일 처리 중...`; }

  let allText = textarea.value || '';
  let fileNames = [];

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(API + '/api/content/extract-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) {
        allText += (allText ? '\n\n' : '') + `[${file.name}]\n${data.text}`;
        fileNames.push(`${file.name} (${data.char_count.toLocaleString()}자)`);
      } else {
        fileNames.push(`${file.name} (추출 실패)`);
      }
    } catch (e) {
      fileNames.push(`${file.name} (에러: ${e.message})`);
    }
  }

  textarea.value = allText;
  if (!keywordInput.value && fileNames.length) {
    // AI로 키워드 자동 추출 (비동기, 즉시 폴백 표시 후 AI 결과로 갱신)
    const fallback = kcExtractKeywordFromText(allText) || files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').substring(0, 30);
    keywordInput.value = fallback;
    kcExtractKeywordWithAI(allText, keywordInput);
  }
  if (status) {
    status.innerHTML = fileNames.map(f => `<div>${f}</div>`).join('');
    status.style.display = 'block';
  }
  // 파일 업로드 완료 → 바로 생성 버튼 표시
  const genBtn = document.getElementById('kc-file-generate-btn');
  if (genBtn && allText.trim()) genBtn.style.display = 'inline-flex';
  toast(`${fileNames.length}개 파일 텍스트 추출 완료`);
}

/** 파일 경로 직접 입력 → 텍스트 추출 */
async function kcLoadFilePath() {
  const input = document.getElementById('kc-file-path-input');
  const path = input?.value?.trim();
  if (!path) { toast('파일 경로를 입력하세요', 'error'); return; }
  const status = document.getElementById('kc-file-upload-status');
  const textarea = document.getElementById('kc-direct-text');
  const keywordInput = document.getElementById('kc-direct-keyword');
  if (status) { status.style.display = 'block'; status.textContent = '파일 읽는 중...'; }
  try {
    const res = await api('/api/content/extract-file-path', { method: 'POST', body: { path } });
    if (res.text) {
      textarea.value = (textarea.value ? textarea.value + '\n\n' : '') + `[${res.filename}]\n${res.text}`;
      if (!keywordInput.value) {
        const fallback = kcExtractKeywordFromText(res.text) || res.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').substring(0, 30);
        keywordInput.value = fallback;
        kcExtractKeywordWithAI(res.text, keywordInput);
      }
      if (status) { status.innerHTML = `<div>${res.filename} (${res.char_count.toLocaleString()}자)</div>`; status.style.display = 'block'; }
      const genBtn = document.getElementById('kc-file-generate-btn');
      if (genBtn) genBtn.style.display = 'inline-flex';
      toast(`${res.filename} 텍스트 추출 완료`);
      input.value = '';
    }
  } catch (e) {
    if (status) { status.innerHTML = `<span style="color:#ff3b30;">${e.message}</span>`; status.style.display = 'block'; }
    toast('파일 읽기 실패: ' + e.message, 'error');
  }
}

/** AI로 키워드 추출 (비동기 — 결과 도착 시 input 갱신) */
async function kcExtractKeywordWithAI(text, inputEl) {
  if (!text || !inputEl) return;
  try {
    const res = await api('/api/content/extract-keyword', { method: 'POST', body: { text: text.substring(0, 3000) } });
    if (res.keyword && res.keyword.trim()) {
      inputEl.value = res.keyword.trim();
      console.log(`[KC] AI 키워드 추출: "${res.keyword.trim()}"`);
    }
  } catch (e) {
    console.warn('[KC] AI 키워드 추출 실패 (폴백 유지):', e.message);
  }
}

/** 파일 텍스트에서 키워드 자동 추출 (마크다운 제목, 첫 문장 등) — AI 폴백용 */
function kcExtractKeywordFromText(text = '') {
  if (!text || typeof text !== 'string') return '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 20)) {
    // [파일명] 형식 스킵
    if (/^\[.*\]$/.test(line)) continue;
    // 마크다운 제목 (# 제목)
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const title = headingMatch[1]
        .replace(/[*_`~\[\]()]/g, '')  // 마크다운 서식 제거
        .replace(/\s*[—–-]\s*.+$/, '') // "제목 — 부제" 에서 부제 제거 (선택)
        .trim();
      if (title.length >= 2 && title.length <= 50) return title.substring(0, 30);
    }
    // > 인용문 스킵
    if (line.startsWith('>')) continue;
    // 일반 텍스트 첫 의미 있는 줄
    const cleaned = line.replace(/[#*_`~\[\]()>]/g, '').trim();
    if (cleaned.length >= 4 && cleaned.length <= 50) return cleaned.substring(0, 30);
  }
  return '';
}

function kcIsYoutubeUrl(url = '') {
  return /(?:youtube\.com|youtu\.be)/i.test(String(url || '').trim());
}

function kcCleanTopicTitle(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  return raw
    .replace(/\s*[-|·]\s*(시사저널e|시사저널|연합뉴스|뉴시스|머니투데이|조선비즈|중앙일보|매일경제|한국경제|전자신문|ZDNET Korea|지디넷코리아|동아일보|한겨레|경향신문|아시아경제|이데일리|서울경제|국민일보|세계일보|파이낸셜뉴스|헤럴드경제|디지털타임스|데일리안|뉴스1)\s*$/i, '')
    .trim();
}

function kcBuildSectionsFromSourceSummary(title, summaryText, targetCount = 4) {
  const summary = String(summaryText || '').trim();
  if (!summary) return [];
  const sectionMap = {
    '핵심 사실': '핵심 사실',
    '주요 인사이트': '주요 인사이트',
    '활용 포인트': '활용 포인트',
    '주의할 점': '주의할 점',
  };
  const lines = summary.split('\n');
  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = (current.body || []).join('\n').trim();
    if (!body) return;
    sections.push({
      title: current.title || title || '상세페이지',
      body,
      iscover: sections.length === 0,
    });
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const heading = trimmed.match(/^\[(.+?)\]$/);
    if (heading && sectionMap[heading[1]]) {
      pushCurrent();
      current = { title: sectionMap[heading[1]], body: [] };
      return;
    }
    if (!current) current = { title: title || '상세페이지', body: [] };
    current.body.push(trimmed.replace(/^[-•]\s*/, ''));
  });
  pushCurrent();

  if (sections.length > targetCount) return sections.slice(0, targetCount);
  return sections;
}

function kcBuildSourceDrivenSections(title, summaryText, targetCount = 4) {
  const normalizedTitle = title || '핵심 포인트';
  const summary = String(summaryText || '').trim();
  if (!summary) return [];

  const directSections = kcBuildSectionsFromSourceSummary(normalizedTitle, summary, targetCount);
  if (directSections.length >= Math.min(2, targetCount)) {
    return directSections.slice(0, targetCount);
  }

  const cleanedLines = summary
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\[(.+?)\]$/.test(line))
    .map(line => line.replace(/^[-•]\s*/, ''));

  if (!cleanedLines.length) return directSections.slice(0, targetCount);

  const sections = [];
  const chunkSize = Math.max(1, Math.ceil(cleanedLines.length / Math.max(1, targetCount)));
  for (let i = 0; i < cleanedLines.length; i += chunkSize) {
    const body = cleanedLines.slice(i, i + chunkSize).join('\n').trim();
    if (!body) continue;
    sections.push({
      title: sections.length === 0 ? normalizedTitle : `${normalizedTitle} ${sections.length + 1}`,
      body,
      iscover: sections.length === 0,
    });
    if (sections.length >= targetCount) break;
  }

  return sections.length ? sections : directSections.slice(0, targetCount);
}

function kcBuildBlogDrivenSections(title, bodyText, targetCount = 5) {
  let text = String(bodyText || '').trim();
  if (!text) return [];
  // 핵심요약 헤딩 제거 ([핵심 사실], [주요 인사이트], [활용 포인트], [주의할 점] 등)
  text = text.replace(/^\[.+?\]\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  // 소제목 또는 빈줄 기준으로 분할
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 20);
  if (blocks.length <= 1) {
    // 줄바꿈 기반 분할
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);
    const chunkSize = Math.max(1, Math.ceil(lines.length / targetCount));
    const sections = [];
    for (let i = 0; i < lines.length; i += chunkSize) {
      const body = lines.slice(i, i + chunkSize).join('\n').trim();
      if (!body) continue;
      const sectionTitle = body.split('\n')[0].substring(0, 30).replace(/[^\w가-힣\s]/g, '').trim() || `${title} ${sections.length + 1}`;
      sections.push({ title: sectionTitle, body, iscover: sections.length === 0 });
      if (sections.length >= targetCount) break;
    }
    return sections;
  }
  // 블록이 충분하면 그대로 사용
  const selected = blocks.length <= targetCount
    ? blocks
    : Array.from({ length: targetCount }, (_, i) => blocks[Math.min(blocks.length - 1, Math.floor((blocks.length / targetCount) * i))]);
  return selected.map((body, idx) => {
    const firstLine = body.split('\n')[0].substring(0, 30).replace(/[^\w가-힣\s]/g, '').trim();
    return {
      title: firstLine || `${title} ${idx + 1}`,
      body: body.substring(0, 500),
      iscover: idx === 0,
    };
  });
}

function kcGetVideoCameraText(camera) {
  return {
    minimal: '카메라 움직임 거의 없음, 안정적인 구도',
    subtle: '부드럽고 자연스러운 카메라 이동',
    moderate: '적당한 패닝과 줌, 리듬감 있는 화면 전환',
    dynamic: '역동적인 카메라 워크와 강한 몰입감',
  }[camera] || '부드럽고 자연스러운 카메라 이동';
}

function kcGetVideoRatioText(ratio) {
  return {
    '9:16': '세로형 숏폼 비율 9:16',
    '1:1': '정사각형 비율 1:1',
    '16:9': '가로형 비율 16:9',
  }[ratio] || `비율 ${ratio}`;
}

function kcBuildVideoSourceFromCardnews() {
  if (Array.isArray(_kcCnTexts) && _kcCnTexts.length) {
    return _kcCnTexts
      .map((slide, idx) => {
        const title = (slide?.title || '').trim();
        const body = (slide?.body || '').trim();
        return `${idx + 1}장. ${title}${body ? ` - ${body}` : ''}`.trim();
      })
      .filter(Boolean)
      .join('\n')
      .slice(0, 1200);
  }
  const finalPrompt = _kcPromptOverrides?.cardnews_workbench?.final_prompt || _kcPromptOverrides?.cardnews_text_prompt || '';
  return String(finalPrompt || '').trim().slice(0, 1200);
}

function kcBuildVideoPromptBundle(payload, basePrompt = '') {
  const opts = payload?.opts || getContentOpts();
  const keyword = kcCleanTopicTitle(payload?.keyword || document.getElementById('kc-keyword')?.value?.trim() || '');
  const blogBody = document.getElementById('kc-blog-body')?.value?.trim() || '';
  const cardnewsFlow = kcBuildVideoSourceFromCardnews();
  // 블로그 본문 우선, 카드뉴스 흐름 차선, 폴백 텍스트는 최후
  const sourceSummary = (blogBody || cardnewsFlow || (payload?.allTexts || []).join('\n\n') || _kcLastPromptSourceSummary || '').substring(0, 1200).trim();

  const existing = (_kcPromptOverrides && _kcPromptOverrides.video_bundle) || {};
  const bundle = {
    subject: existing.subject || keyword || '한국 도시 풍경',
    scene: existing.scene || (sourceSummary || basePrompt || '카드 흐름을 바탕으로 장면 전환이 분명한 숏폼 영상'),
    visual_style: existing.visual_style || '카드뉴스 내용을 영상 장면으로 자연스럽게 재해석한 시네마틱 숏폼, 고급스럽고 선명한 디테일',
    camera: existing.camera || kcGetVideoCameraText(opts.camera || 'subtle'),
    mood: existing.mood || '신뢰감 있고 세련된 분위기, 짧은 시간 안에 시선을 잡는 리듬',
    duration: existing.duration || `${opts.veo_duration || '8'}초 분량, ${kcGetVideoRatioText(opts.video_ratio || '9:16')}`,
    negative: existing.negative || '화면 속 깨진 글자, 과한 자막, 어색한 손, 일그러진 얼굴, 저화질, 과도한 왜곡 금지',
  };
  bundle.final_prompt = existing.final_prompt || [
    `주제: ${bundle.subject}`,
    `장면 설명: ${bundle.scene}`,
    `비주얼 스타일: ${bundle.visual_style}`,
    `카메라: ${bundle.camera}`,
    `분위기: ${bundle.mood}`,
    `출력 조건: ${bundle.duration}`,
    `금지 요소: ${bundle.negative}`,
  ].join('\n');
  return bundle;
}

function kcGetBlogLengthInstruction(length) {
  if (length === 'short') return '최종 본문은 공백 제외 기준 대략 1000자에서 1400자 사이로 작성하세요.';
  if (length === 'long') return '최종 본문은 공백 제외 기준 대략 3000자에서 4200자 사이로 작성하세요.';
  return '최종 본문은 공백 제외 기준 대략 1800자에서 2500자 사이로 작성하세요.';
}

function kcGetHumanInstruction(level) {
  if (level === 'heavy') return '사람이 직접 쓴 것처럼 자연스러운 구어체를 충분히 섞고, 문장 호흡도 너무 반듯하지 않게 조절하세요.';
  if (level === 'light') return '너무 기계적이지 않도록 약간의 구어체와 자연스러운 말맛을 섞으세요.';
  return '문장은 최대한 깔끔하고 단정하게 유지하세요.';
}

function kcGetCommaInstruction(rate) {
  const value = Number(rate ?? 50);
  if (value <= 0) return '쉼표는 쓰지 마세요. 쉼표가 필요해 보이면 문장을 둘로 나누세요.';
  if (value <= 30) return '쉼표는 꼭 필요한 곳에만 아주 드물게 쓰세요. 가능하면 짧은 문장으로 끊으세요.';
  if (value <= 60) return '쉼표는 과하게 쓰지 말고, 문장 흐름이 정말 필요할 때만 제한적으로 사용하세요.';
  return '쉼표는 읽기 흐름을 해치지 않는 선에서만 자연스럽게 사용하세요.';
}

function kcGetPeriodInstruction(rate) {
  const value = Number(rate ?? 70);
  if (value <= 50) return '마침표를 모든 문장 끝에 다 붙이지 말고, 필요할 때만 사용하세요.';
  if (value < 100) return '마침표는 대부분의 문장 끝에 사용하되, 몇몇 문장은 자연스럽게 흘려 끝내세요.';
  return '문장 끝은 마침표로 또렷하게 마무리하세요.';
}

function kcGetThreadsLimit(length = 'medium') {
  if (length === 'short') return 220;
  if (length === 'long') return 1200;
  return 450;
}

function kcGetTwitterLimit(length = 'medium') {
  if (length === 'short') return 180;
  return 250;
}

function kcBuildThreadsSegments(text, opts = getContentOpts()) {
  const clean = normalizeThreadsText(text);
  if (!clean) return [];
  const lengthMode = opts?.threads_length || 'medium';
  const postMode = opts?.threads_mode || 'auto';
  const limit = kcGetThreadsLimit(lengthMode);
  if (postMode === 'single') {
    return [clean.length <= limit ? clean : `${clean.slice(0, Math.max(0, limit - 1)).trim()}…`];
  }
  return splitThreadsPostText(clean, limit);
}
