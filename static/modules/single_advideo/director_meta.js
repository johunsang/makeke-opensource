/* single_advideo/director_meta — 메타 기능: 페르소나, A/B 변주, 멀티 포맷, 성과 예측, 트리트먼트 저장/로드, 스트리밍, 리서치, 5인 팀 트리트먼트 */

// ─── Phase3 #9 감독 페르소나 ─────────────────────────────────
async function savLoadDirectorPersonas() {
  try {
    const res = await api('/api/advideo/director-personas');
    const sel = document.getElementById('sav-director-persona');
    if (!sel || !res?.personas) return;
    sel.innerHTML = res.personas.map(p => `<option value="${escapeHtml(p.id)}">페르소나: ${escapeHtml(p.label)} · ${escapeHtml(p.style)}</option>`).join('');
  } catch (e) { /* ignore */ }
}

function savOnPersonaChange() {
  const sel = document.getElementById('sav-director-persona');
  const nameEl = document.getElementById('sav-director-name');
  if (sel && nameEl) {
    const label = sel.options[sel.selectedIndex]?.text || '';
    const m = label.match(/페르소나:\s*([^·]+)/);
    if (m) nameEl.textContent = m[1].trim();
  }
}
window.savOnPersonaChange = savOnPersonaChange;

// director-note 호출 시 persona_id 도 포함하도록 기존 함수 몽키 패치 (호출 바디 확장)
const _origDirectorNoteBody = window.savLoadDirectorNote;

// savLoadDirectorNote 는 이미 body.director_model 만 보내고 있어서, 페르소나는 별도로 확장 (간편하게 래핑)
async function savLoadDirectorNoteWithPersona(step) {
  const origFetch = window.fetch;
  // fetch 후킹 대신 api 에 persona_id 를 넣으려면 원본 savLoadDirectorNote 수정 필요.
  // 여기서는 간단히 wrapper 없이 원본 함수 바디에 persona_id 를 추가하는 경로로 이미 들어가도록 savLoadDirectorNote 내부를 확장.
  return savLoadDirectorNote(step);
}

// ─── Phase3 #10 A/B 변주 ─────────────────────────────────────
async function savGenerateABVariants(pairMode) {
  const btn = document.getElementById('sav-ab-btn');
  const area = document.getElementById('sav-ab-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🔀 생성 중...'; }
  try {
    const res = await api('/api/advideo/ab-variants', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        direction_a: pairMode === 'short-long' ? '' : '시네마틱 내러티브',
        direction_b: pairMode === 'short-long' ? '' : '뮤직비디오 퍼포먼스',
        pair_mode: pairMode || '',
      },
    });
    const v = res?.variants || {};
    _savState.abVariants = v;
    if (area) {
      area.style.display = 'block';
      const renderOne = (key, data, color) => {
        if (!data) return '';
        return `<div style="flex:1;padding:10px;border:1px solid ${color};border-radius:10px;background:#fff;">
          <div style="font-weight:800;color:${color};margin-bottom:4px;">${key.toUpperCase()}. ${escapeHtml(data.direction||'')}</div>
          <div style="font-style:italic;margin-bottom:4px;">"${escapeHtml(data.logline||'')}"</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.6);margin-bottom:2px;"><b>훅:</b> ${escapeHtml(data.hook||'')}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.6);margin-bottom:2px;"><b>페이싱:</b> ${escapeHtml(data.pacing||'')}</div>
          <div style="font-size:10px;color:rgba(0,0,0,0.6);"><b>음악:</b> ${escapeHtml(data.music_vibe||'')}</div>
          ${(data.key_visuals||[]).length ? `<div style="font-size:10px;margin-top:4px;"><b>비주얼:</b> ${data.key_visuals.map(v=>escapeHtml(v)).join(' / ')}</div>` : ''}
          <button type="button" onclick="savPickABVariant('${key}')" style="margin-top:6px;padding:4px 10px;font-size:10px;font-weight:700;border:none;background:${color};color:#fff;border-radius:999px;cursor:pointer;">이 방향 선택</button>
        </div>`;
      };
      area.innerHTML = `<div style="display:flex;gap:8px;font-size:11px;">
        ${renderOne('a', v.a, '#34c759')}
        ${renderOne('b', v.b, '#5856d6')}
      </div>
      <div style="margin-top:8px;text-align:center;">
        <button type="button" onclick="savRenderBothAB()" style="padding:6px 16px;font-size:11px;font-weight:800;border:none;background:linear-gradient(135deg,#34c759,#5856d6);color:#fff;border-radius:999px;cursor:pointer;">⚡ A/B 둘 다 렌더 (비용 2배)</button>
      </div>`;
    }
    toast('A/B 트리트먼트 2안 생성');
  } catch (e) { toast('A/B 생성 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '🔀 A/B 트리트먼트'; } }
}
window.savGenerateABVariants = savGenerateABVariants;

function savPickABVariant(key) {
  const v = (_savState.abVariants || {})[key];
  if (!v) return;
  _savState.selectedABDirection = v;
  // 선택된 방향을 story_detail 에 반영
  const detailEl = document.getElementById('sav-story-detail');
  if (detailEl && v.logline) {
    detailEl.value = `${v.logline}\n\n[${v.direction}] ${v.hook}\n음악: ${v.music_vibe}\n비주얼: ${(v.key_visuals||[]).join(' / ')}`;
  }
  toast(`${key.toUpperCase()} 방향 선택 — 스토리 소재에 반영`);
}
window.savPickABVariant = savPickABVariant;

// ④ A/B 둘 다 렌더 — 두 방향으로 각각 스크립트·영상 생성 후 히스토리에 A/B 쌍으로 저장
async function savRenderBothAB() {
  const v = _savState.abVariants || {};
  if (!v.a || !v.b) { toast('A/B 변주 먼저 생성', 'error'); return; }
  const ok = confirm('A/B 두 방향을 각각 순차로 렌더합니다. 영상 2개가 생성되며 시간·비용이 2배입니다. 진행할까요?');
  if (!ok) return;
  const detailEl = document.getElementById('sav-story-detail');
  const originalDetail = detailEl ? detailEl.value : '';
  const results = [];
  for (const key of ['a', 'b']) {
    const variant = v[key];
    try {
      // 1. story_detail 에 해당 variant 주입
      if (detailEl && variant.logline) {
        detailEl.value = `${variant.logline}\n\n[${variant.direction}] ${variant.hook}\n음악: ${variant.music_vibe}\n비주얼: ${(variant.key_visuals||[]).join(' / ')}`;
      }
      toast(`${key.toUpperCase()} 방향 스크립트 생성 중...`);
      await savGenerateScript();
      await new Promise(r => setTimeout(r, 2000));
      toast(`${key.toUpperCase()} 방향 영상 렌더 시작...`);
      await savGenerateVideo();
      results.push({ key, video: _savState.finalVideoPath, direction: variant.direction });
    } catch (e) {
      results.push({ key, error: e?.message || String(e) });
    }
  }
  // 원상복구
  if (detailEl) detailEl.value = originalDetail;
  _savState.abRenderResults = results;
  toast(`A/B 병렬 렌더 완료 — ${results.filter(r=>r.video).length}/2 성공`);
}
window.savRenderBothAB = savRenderBothAB;

// ─── Phase3 #8 멀티 포맷 ──────────────────────────────────────
async function savGenerateMultiFormat() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('4단계에서 스크립트 먼저 생성', 'error'); return; }
  const btn = document.getElementById('sav-mf-btn');
  const area = document.getElementById('sav-mf-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '📐 재설계 중...'; }
  try {
    const res = await api('/api/advideo/multi-format', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default', scenes: scenes.map(s => ({ title:s.title||'', narration:s.narration||'', duration:s.duration||5 })) },
    });
    const arr = res?.formats || [];
    _savState.multiFormat = arr;
    if (area) {
      area.style.display = 'block';
      area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(52,199,89,0.25);border-radius:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="font-weight:800;color:#248a40;">📐 멀티 포맷 컷 지시</div>
          <button type="button" onclick="savRenderMultiFormats()" style="padding:4px 10px;font-size:10px;font-weight:700;border:none;background:linear-gradient(135deg,#34c759,#248a40);color:#fff;border-radius:999px;cursor:pointer;">⚡ 전 포맷 실제 렌더</button>
        </div>
        ${arr.map(f => `<div style="padding:6px 0;border-bottom:1px dashed rgba(0,0,0,0.06);">
          <div style="font-weight:700;">${escapeHtml(f.format||'')}</div>
          <div style="color:rgba(0,0,0,0.7);">씬 순서: ${(f.scene_order||[]).join(' → ')}</div>
          <div style="color:#248a40;">훅: ${escapeHtml(f.hook_strategy||'')}</div>
          <div style="color:rgba(0,0,0,0.6);">편집: ${escapeHtml(f.cut_note||'')}</div>
        </div>`).join('')}
        <div id="sav-mf-render-results" style="margin-top:8px;"></div>
      </div>`;
    }
    toast(`멀티 포맷 ${arr.length}개 플랜 완료`);
  } catch (e) { toast('멀티 포맷 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '📐 멀티 포맷 컷'; } }
}
window.savGenerateMultiFormat = savGenerateMultiFormat;

// ⑤ 멀티 포맷 실제 렌더 — 기존 씬 MP4 들을 재조합해서 포맷별 출력
async function savRenderMultiFormats() {
  const plans = _savState.multiFormat;
  if (!plans || !plans.length) { toast('멀티 포맷 플랜 먼저 생성', 'error'); return; }
  // 씬 비디오 경로 수집 (sceneResults 의 videoPath)
  const results = _savState.sceneResults || [];
  const sceneVideos = results.map(r => r?.videoPath || r?.video_path || '').filter(Boolean);
  if (!sceneVideos.length) { toast('영상이 아직 없습니다. 먼저 영상 생성을 완료하세요.', 'error'); return; }
  const box = document.getElementById('sav-mf-render-results');
  if (box) box.innerHTML = '<div style="padding:10px;font-size:11px;color:rgba(0,0,0,0.5);text-align:center;">전 포맷 렌더 중... (포맷 개수 × ~30초)</div>';
  try {
    const res = await api('/api/advideo/multi-format-render', {
      method: 'POST',
      body: {
        formats: plans,
        scene_videos: sceneVideos,
        master_video_path: _savState.finalVideoPath || '',
      },
    });
    const outs = res?.outputs || [];
    if (box) {
      box.innerHTML = outs.map(o => {
        if (o.status === 'ok') {
          return `<div style="padding:8px;border:1px solid rgba(52,199,89,0.3);border-radius:8px;margin-top:6px;">
            <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(o.format)} · ${o.duration_sec}s</div>
            <video src="${escapeHtml(o.url)}" controls style="width:100%;max-width:400px;border-radius:6px;"></video>
            <div><a href="${escapeHtml(o.url)}" download style="font-size:10px;color:#248a40;">⬇ 다운로드</a></div>
          </div>`;
        }
        return `<div style="padding:8px;border:1px dashed rgba(255,59,48,0.3);border-radius:8px;margin-top:6px;font-size:11px;color:#ff3b30;">${escapeHtml(o.format||'?')} 실패: ${escapeHtml(o.error||'?')}</div>`;
      }).join('');
    }
    toast(`멀티 포맷 렌더 완료 · ${outs.filter(o=>o.status==='ok').length}/${outs.length}`);
  } catch (e) {
    toast('멀티 포맷 렌더 실패: ' + (e?.message||e), 'error');
    if (box) box.innerHTML = `<div style="padding:10px;color:#ff3b30;font-size:11px;">실패: ${escapeHtml(String(e?.message||e))}</div>`;
  }
}
window.savRenderMultiFormats = savRenderMultiFormats;

// ─── Phase4 #11 성과 예측 ─────────────────────────────────────
async function savForecastPerformance() {
  const btn = document.getElementById('sav-forecast-btn');
  const area = document.getElementById('sav-forecast-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '📊 예측 중...'; }
  try {
    const scenes = (_savState.script && _savState.script.scenes) || [];
    const res = await api('/api/advideo/forecast', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        treatment: _savState.directorTreatment || {},
        scenes,
      },
    });
    const f = res?.forecast || {};
    _savState.forecast = f;
    if (area) {
      area.style.display = 'block';
      const bar = (label, v, color) => `<div style="margin:4px 0;">
        <div style="display:flex;justify-content:space-between;font-size:10px;"><span>${label}</span><span style="font-weight:800;color:${color};">${v||0}/10</span></div>
        <div style="height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;"><div style="width:${(v||0)*10}%;height:100%;background:${color};"></div></div>
      </div>`;
      area.innerHTML = `<div style="padding:12px;background:#fff;border:1px solid rgba(255,140,0,0.22);border-radius:10px;font-size:11px;">
        <div style="font-weight:800;color:#ff8c00;margin-bottom:8px;">📊 Claude 감독 예측 · 종합 ${f.overall||0}/10</div>
        ${bar('훅 강도 (첫 3초)', f.hook_strength, '#ff8c00')}
        ${bar('스크롤 스탑', f.scroll_stop, '#ff6b00')}
        ${bar('완주율', f.completion_rate, '#34c759')}
        ${bar('브랜드 리콜', f.brand_recall, '#5856d6')}
        ${bar('CTA 반응', f.cta_engagement, '#ff3b30')}
        ${(f.strengths||[]).length ? `<div style="margin-top:6px;"><b style="color:#34c759;">강점:</b> ${f.strengths.map(s=>escapeHtml(s)).join(' / ')}</div>` : ''}
        ${(f.weaknesses||[]).length ? `<div><b style="color:#ff3b30;">약점:</b> ${f.weaknesses.map(s=>escapeHtml(s)).join(' / ')}</div>` : ''}
        ${(f.improvements||[]).length ? `<div><b style="color:#5856d6;">개선안:</b> ${f.improvements.map(s=>escapeHtml(s)).join(' / ')}</div>` : ''}
      </div>`;
    }
    toast(`예측 완료 · 종합 ${f.overall||0}/10`);
  } catch (e) { toast('예측 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '📊 성과 예측'; } }
}
window.savForecastPerformance = savForecastPerformance;

// ─── Phase4 #12 트리트먼트 저장·로드 ───────────────────────────
async function savSaveTreatment() {
  const t = _savState.directorTreatment;
  if (!t || !Object.keys(t).length) { toast('감독 디렉팅 먼저 실행', 'error'); return; }
  try {
    const profile = window._globalProfileData || {};
    const res = await api('/api/advideo/treatment/save', {
      method: 'POST',
      body: {
        brand_profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
        brand_name: profile.name || '',
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_angle: (document.getElementById('sav-story-angle')?.value || '').trim(),
        style: document.getElementById('sav-style')?.value || '',
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        treatment: t,
        forecast: _savState.forecast || {},
      },
    });
    toast(`트리트먼트 저장 #${res.id}`, 'success');
  } catch (e) { toast('저장 실패: ' + (e?.message||e), 'error'); }
}
window.savSaveTreatment = savSaveTreatment;

async function savLoadTreatmentList() {
  const box = document.getElementById('sav-treatment-list');
  if (!box) return;
  try {
    const pid = parseInt(window._globalProfileId || 0, 10) || 0;
    const res = await api(`/api/advideo/treatment/list${pid?`?brand_profile_id=${pid}`:''}`);
    const items = res?.items || [];
    if (!items.length) { box.innerHTML = '<div style="padding:10px;font-size:11px;color:rgba(0,0,0,0.4);text-align:center;">저장된 트리트먼트 없음</div>'; return; }
    box.innerHTML = items.map(it => `<div style="padding:6px 8px;border-bottom:1px dashed rgba(0,0,0,0.08);font-size:11px;display:flex;justify-content:space-between;gap:6px;align-items:center;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;">#${it.id} ${escapeHtml(it.topic||it.brand_name||'-')}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.5);">${escapeHtml(it.story_angle||'')} · ${escapeHtml(it.persona_id||'default')} · ${escapeHtml((it.created_at||'').slice(0,16))}</div>
      </div>
      <button type="button" onclick="savLoadTreatment(${it.id})" style="flex:0 0 auto;padding:3px 8px;font-size:10px;font-weight:700;border:1px solid rgba(88,86,214,0.3);background:#fff;color:#5856d6;border-radius:999px;cursor:pointer;">로드</button>
    </div>`).join('');
  } catch (e) { box.innerHTML = `<div style="padding:10px;font-size:11px;color:#ff3b30;">${escapeHtml(String(e?.message||e))}</div>`; }
}
window.savLoadTreatmentList = savLoadTreatmentList;

async function savLoadTreatment(id) {
  try {
    const res = await api(`/api/advideo/treatment/${id}`);
    const item = res?.item;
    if (!item) return;
    const t = item.treatment || {};
    _savState.directorTreatment = t;
    _savState.forecast = item.forecast || {};
    if (item.topic) { const el = document.getElementById('sav-topic'); if (el) el.value = item.topic; }
    if (item.story_angle) { const el = document.getElementById('sav-story-angle'); if (el) el.value = item.story_angle; }
    if (item.persona_id) { const el = document.getElementById('sav-director-persona'); if (el) el.value = item.persona_id; }
    if (typeof savRenderDirectorTreatment === 'function') savRenderDirectorTreatment(t, item.persona_id || '');
    toast(`트리트먼트 #${id} 로드 완료`);
  } catch (e) { toast('로드 실패: ' + (e?.message||e), 'error'); }
}
window.savLoadTreatment = savLoadTreatment;

function savToggleTreatmentLibrary() {
  const box = document.getElementById('sav-treatment-library');
  if (!box) return;
  const hidden = box.style.display === 'none';
  box.style.display = hidden ? 'block' : 'none';
  if (hidden) savLoadTreatmentList();
}
window.savToggleTreatmentLibrary = savToggleTreatmentLibrary;

// ─── Phase4 #13 감독 발화 스트리밍 (옵션) ─────────────────────
async function savStreamDirectorReply(userText) {
  // SSE 를 통해 감독 발화를 토큰 단위로 표시. 실패하면 기존 savSendDirectorMessage 사용.
  const msgEl = document.getElementById('sav-director-message');
  if (!msgEl) return false;
  const hist = savGetDirectorHistory();
  try {
    const body = {
      step: _savState.currentStep || 1,
      topic: (document.getElementById('sav-topic')?.value || '').trim(),
      message: (document.getElementById('sav-message')?.value || '').trim(),
      user_message: userText,
      history: hist.slice(0, -1),
      director_model: document.getElementById('sav-director-model')?.value || '',
      persona_id: document.getElementById('sav-director-persona')?.value || '',
    };
    const resp = await fetch('/api/advideo/director-note-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok || !resp.body) return false;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    msgEl.textContent = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      chunk.split('\n').forEach(line => {
        if (line.startsWith('data: ')) {
          const token = line.slice(6);
          if (token && token !== '[DONE]') { accumulated += token; msgEl.textContent = accumulated; }
        }
      });
    }
    hist.push({ role: 'assistant', content: accumulated });
    savRenderDirectorLog();
    return true;
  } catch (e) { return false; }
}
window.savStreamDirectorReply = savStreamDirectorReply;

// ─── Phase5 #15 리서치 ───────────────────────────────────────
async function savRunResearch() {
  const btn = document.getElementById('sav-research-btn');
  const area = document.getElementById('sav-research-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🔍 검색 중...'; }
  if (area) { area.style.display = 'block'; area.innerHTML = '<div style="padding:10px;font-size:11px;color:rgba(0,0,0,0.5);text-align:center;">웹 검색 + 감독 요약 생성 중...</div>'; }
  try {
    const profile = window._globalProfileData || {};
    const res = await api('/api/advideo/research', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        brand_name: profile.name || '',
        industry: profile.business_type || '',
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        free_seed: (document.getElementById('sav-free-seed')?.value || '').trim(),
      },
    });
    const ins = res?.insights || {};
    _savState.research = res;
    if (area) {
      area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(0,122,255,0.2);border-radius:10px;font-size:11px;">
        ${ins.brand_position ? `<div style="margin-bottom:6px;"><b>브랜드 포지션:</b> ${escapeHtml(ins.brand_position)}</div>` : ''}
        ${(ins.competitors||[]).length ? `<div style="margin-bottom:6px;"><b>경쟁사:</b> ${ins.competitors.map(c=>`${escapeHtml(c.name||'')} (${escapeHtml(c.angle||'')})`).join(' · ')}</div>` : ''}
        ${(ins.trends||[]).length ? `<div style="margin-bottom:6px;"><b>트렌드:</b> ${ins.trends.map(t=>escapeHtml(t)).join(' / ')}</div>` : ''}
        ${(ins.target_insights||[]).length ? `<div style="margin-bottom:6px;"><b>타겟 인사이트:</b> ${ins.target_insights.map(t=>escapeHtml(t)).join(' / ')}</div>` : ''}
        ${(ins.content_hooks||[]).length ? `<div style="padding:6px 8px;background:rgba(0,122,255,0.06);border-left:3px solid #007aff;border-radius:4px;"><b>💡 콘텐츠 훅:</b><br>${ins.content_hooks.map((h,i)=>`${i+1}. ${escapeHtml(h)}`).join('<br>')}</div>` : ''}
        <div style="margin-top:6px;font-size:10px;color:rgba(0,0,0,0.4);">원본 검색 ${(res.findings||[]).length}건 참조</div>
      </div>`;
    }
    toast('리서치 요약 완료');
  } catch (e) {
    toast('리서치 실패: ' + (e?.message||e), 'error');
    if (area) area.innerHTML = `<div style="padding:12px;font-size:11px;color:#ff3b30;text-align:center;">실패: ${escapeHtml(String(e?.message||e))}</div>`;
  } finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '🔍 리서치 실행'; } }
}
window.savRunResearch = savRunResearch;

// ─── Phase5 #14 5인 팀 트리트먼트 ─────────────────────────────
async function savRunTeamTreatment() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('스크립트 먼저 생성', 'error'); return; }
  const btn = document.getElementById('sav-team-btn');
  const area = document.getElementById('sav-team-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🎭 5인 협업 중...'; }
  try {
    const res = await api('/api/advideo/team-treatment', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        style: document.getElementById('sav-style')?.value || '',
        scenes: scenes.map(s => ({ title: s.title || '', narration: s.narration || '' })),
      },
    });
    const team = res?.team || {};
    const coord = res?.coordination || {};
    _savState.teamTreatment = res;
    if (area) {
      area.style.display = 'block';
      const roleInfo = {
        director: { label: '🎬 총감독', color: '#5856d6' },
        dp: { label: '📹 촬영감독', color: '#007aff' },
        art: { label: '🎨 미술감독', color: '#34c759' },
        sound: { label: '🔊 사운드', color: '#ff9500' },
        editor: { label: '✂️ 편집자', color: '#ff3b30' },
      };
      area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="font-weight:800;color:#5856d6;">🎭 5인 팀 트리트먼트</div>
          <button type="button" onclick="savApplyTeamToScenes()" style="padding:3px 10px;font-size:10px;font-weight:700;border:none;background:linear-gradient(135deg,#5856d6,#3f3da3);color:#fff;border-radius:999px;cursor:pointer;">씬에 적용</button>
        </div>
        ${coord.final_concept ? `<div style="padding:6px 8px;background:rgba(255,140,0,0.08);border-left:3px solid #ff8c00;border-radius:4px;margin-bottom:8px;"><b>최종 컨셉:</b> ${escapeHtml(coord.final_concept)}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;">
        ${Object.entries(team).map(([k, v]) => {
          const info = roleInfo[k] || { label: k, color: '#888' };
          const dump = typeof v === 'object' ? Object.entries(v).slice(0,5).map(([kk,vv])=>`<div style="margin-top:2px;"><b>${escapeHtml(kk)}:</b> ${escapeHtml(typeof vv==='string'?vv:JSON.stringify(vv).slice(0,100))}</div>`).join('') : escapeHtml(String(v));
          return `<div style="padding:6px;border:1px solid ${info.color};border-radius:6px;">
            <div style="font-weight:800;color:${info.color};margin-bottom:2px;">${info.label}</div>
            ${dump}
          </div>`;
        }).join('')}
        </div>
        ${coord.conflicts_resolved ? `<div style="margin-top:6px;font-size:10px;color:rgba(0,0,0,0.6);"><b>조율:</b> ${escapeHtml(coord.conflicts_resolved)}</div>` : ''}
        ${coord.recommendation ? `<div style="margin-top:4px;font-size:10px;color:#5856d6;"><b>총감독 지시:</b> ${escapeHtml(coord.recommendation)}</div>` : ''}
      </div>`;
    }
    toast('5인 팀 트리트먼트 완료');
  } catch (e) { toast('팀 트리트먼트 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎭 5인 팀 디렉팅'; } }
}
window.savRunTeamTreatment = savRunTeamTreatment;

// 팀 트리트먼트를 씬의 visual_prompt 에 주입 (촬영감독 + 미술감독 + 사운드 노트 병합)
function savApplyTeamToScenes() {
  const team = _savState.teamTreatment?.team;
  const coord = _savState.teamTreatment?.coordination || {};
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!team || !scenes.length) { toast('팀 트리트먼트 또는 씬이 없습니다', 'error'); return; }
  const dpNote = team.dp ? JSON.stringify(team.dp).slice(0, 400) : '';
  const artNote = team.art ? JSON.stringify(team.art).slice(0, 400) : '';
  const soundNote = team.sound ? JSON.stringify(team.sound).slice(0, 300) : '';
  const editorNote = team.editor ? JSON.stringify(team.editor).slice(0, 300) : '';
  const marker = '\n[Team Studio]';
  scenes.forEach(s => {
    if (!s.visual_prompt) s.visual_prompt = '';
    const idx = s.visual_prompt.indexOf(marker);
    const base = idx >= 0 ? s.visual_prompt.slice(0, idx) : s.visual_prompt;
    const block = [
      dpNote ? `촬영감독: ${dpNote}` : '',
      artNote ? `미술감독: ${artNote}` : '',
      soundNote ? `사운드: ${soundNote}` : '',
      editorNote ? `편집: ${editorNote}` : '',
      coord.final_concept ? `총감독: ${coord.final_concept}` : '',
    ].filter(Boolean).join('\n');
    s.visual_prompt = base.trimEnd() + marker + '\n' + block;
  });
  if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
  toast(`팀 트리트먼트를 ${scenes.length}개 씬에 주입`, 'success');
}
window.savApplyTeamToScenes = savApplyTeamToScenes;
