/* single_advideo/director_polish — 씬 폴리싱: 스토리보드, 일관성 Lock, 씬 크리틱, 자산 요청, 씬별 보이스·BGM·컬러 그레이드 */

// ─── Phase1 #1 스토리보드 미리보기 ─────────────────────────────
async function savGenerateStoryboard() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('스크립트 먼저 생성하세요', 'error'); return; }
  const btn = document.getElementById('sav-sb-btn');
  const area = document.getElementById('sav-storyboard-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🎞 생성 중...'; }
  if (area) { area.style.display = 'block'; area.innerHTML = '<div style="padding:20px;text-align:center;font-size:11px;color:rgba(0,0,0,0.5);">씬별 스토리보드 썸네일 생성 중... (약 1~2분)</div>'; }
  try {
    const continuityHint = _savState.continuityLock
      ? JSON.stringify(_savState.continuityLock).slice(0, 400)
      : '';
    // 업로드 소재 이미지 경로 추출 (인물/상품/로고/배경 모두)
    const uploadedPaths = (_savState.uploadedImages || [])
      .map(u => (typeof u === 'object' ? (u.path || u.image_path || '') : ''))
      .filter(Boolean)
      .slice(0, 4); // 과다 방지
    const res = await api('/api/advideo/storyboard', {
      method: 'POST',
      body: {
        scenes: scenes.map(s => ({ title: s.title || '', narration: s.narration || '', visual_prompt: s.visual_prompt || '' })),
        aspect_ratio: document.getElementById('sav-ratio')?.value || '9:16',
        continuity_hint: continuityHint,
        character_profile: _savState.character || {},
        character_reference_paths: (_savState.characterRefs || []).map(r => r.image_path).filter(Boolean),
        uploaded_reference_paths: uploadedPaths,
      },
    });
    _savState.storyboard = res?.storyboard || [];
    // 콘티 이미지 path 를 씬 객체에 저장 → 영상 생성 시 씨앗 프레임으로 자동 사용
    (_savState.storyboard || []).forEach(sb => {
      const i = (sb.scene_index || 0) - 1;
      if (i >= 0 && i < scenes.length && sb.image_path) {
        scenes[i].storyboard_image_path = sb.image_path;
      }
    });
    savRenderStoryboard();
    toast(`스토리보드 ${_savState.storyboard.filter(s=>s.status==='ok').length}/${scenes.length} 씬 생성 완료`);
  } catch (e) {
    toast('스토리보드 실패: ' + (e?.message || e), 'error');
    if (area) area.innerHTML = `<div style="padding:12px;text-align:center;font-size:11px;color:#ff3b30;">실패: ${escapeHtml(String(e?.message||e))}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎞 스토리보드 생성'; }
  }
}
window.savGenerateStoryboard = savGenerateStoryboard;

function savRenderStoryboard() {
  const area = document.getElementById('sav-storyboard-area');
  if (!area) return;
  const sb = _savState.storyboard || [];
  if (!sb.length) { area.style.display = 'none'; area.innerHTML = ''; return; }
  area.style.display = 'block';
  area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;">
    <div style="font-size:11px;font-weight:800;color:#5856d6;margin-bottom:8px;">🎞 스토리보드 (${sb.length}씬) — 각 썸네일을 승인 또는 재생성하세요</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
      ${sb.map(s => {
        if (s.status !== 'ok') return `<div style="padding:10px;border:1px dashed rgba(255,59,48,0.4);border-radius:8px;font-size:10px;color:#ff3b30;text-align:center;">씬 ${s.scene_index} 실패<br>${escapeHtml(s.error || '')}</div>`;
        const approved = _savState.sbApproved && _savState.sbApproved[s.scene_index];
        return `<div style="border:2px solid ${approved?'#34c759':'rgba(88,86,214,0.25)'};border-radius:8px;overflow:hidden;background:#fff;">
          <div style="position:relative;">
            <img src="${escapeHtml(s.image_url)}" style="width:100%;aspect-ratio:9/16;object-fit:cover;display:block;">
            <div style="position:absolute;top:4px;left:4px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#fff;border-radius:999px;font-size:9px;font-weight:700;">씬 ${s.scene_index}</div>
            ${approved ? '<div style="position:absolute;top:4px;right:4px;padding:2px 6px;background:#34c759;color:#fff;border-radius:999px;font-size:9px;font-weight:700;">OK</div>' : ''}
          </div>
          <div style="display:flex;gap:4px;padding:4px;">
            <button type="button" onclick="savApproveStoryboard(${s.scene_index})" style="flex:1;padding:3px;font-size:9px;font-weight:700;border:none;background:${approved?'#34c759':'rgba(0,0,0,0.06)'};color:${approved?'#fff':'rgba(0,0,0,0.7)'};border-radius:6px;cursor:pointer;">${approved?'✓ 승인됨':'승인'}</button>
            <button type="button" onclick="savRegenerateStoryboard(${s.scene_index})" style="flex:1;padding:3px;font-size:9px;font-weight:700;border:none;background:rgba(255,140,0,0.15);color:#ff8c00;border-radius:6px;cursor:pointer;">재생성</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function savApproveStoryboard(idx) {
  _savState.sbApproved = _savState.sbApproved || {};
  _savState.sbApproved[idx] = !_savState.sbApproved[idx];
  savRenderStoryboard();
}
window.savApproveStoryboard = savApproveStoryboard;

async function savRegenerateStoryboard(idx) {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const sc = scenes[idx - 1];
  if (!sc) return;
  try {
    const res = await api('/api/advideo/storyboard', {
      method: 'POST',
      body: {
        scenes: [{ title: sc.title || '', narration: sc.narration || '', visual_prompt: sc.visual_prompt || '' }],
        aspect_ratio: document.getElementById('sav-ratio')?.value || '9:16',
        continuity_hint: _savState.continuityLock ? JSON.stringify(_savState.continuityLock).slice(0, 400) : '',
      },
    });
    const one = (res?.storyboard || [])[0];
    if (one && one.status === 'ok') {
      const sb = _savState.storyboard || [];
      const pos = sb.findIndex(x => x.scene_index === idx);
      if (pos >= 0) sb[pos] = { ...one, scene_index: idx };
      savRenderStoryboard();
      toast(`씬 ${idx} 재생성 완료`);
    } else {
      toast('재생성 실패', 'error');
    }
  } catch (e) { toast('재생성 실패: ' + (e?.message || e), 'error'); }
}
window.savRegenerateStoryboard = savRegenerateStoryboard;

// ─── Phase1 #3 일관성 Lock ─────────────────────────────────────
async function savGenerateContinuityLock() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const btn = document.getElementById('sav-cont-btn');
  const area = document.getElementById('sav-continuity-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🔒 설계 중...'; }
  try {
    const palette = _savState.directorTreatment?.color_palette || [];
    const res = await api('/api/advideo/continuity-lock', {
      method: 'POST',
      body: {
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        message: (document.getElementById('sav-message')?.value || '').trim(),
        story_detail: (document.getElementById('sav-story-detail')?.value || '').trim(),
        color_palette: palette,
        scenes: scenes.map(s => ({ title: s.title || '', narration: s.narration || '' })),
      },
    });
    const lock = res?.lock || {};
    _savState.continuityLock = lock;
    // 모든 씬의 visual_prompt 에 [Continuity] 블록 주입 (중복 방지 마커)
    const marker = '\n[Continuity Lock]';
    const pal = lock.palette_lock || {};
    const palLine = Object.keys(pal).length
      ? `컬러: ${Object.entries(pal).map(([k,v])=>`${k} ${v}`).join(' / ')}`
      : '';
    const charLine = (Array.isArray(lock.characters) && lock.characters.length)
      ? `주인공: ${lock.characters.map(c => c.description || c.name || '').join(' · ')}`
      : '';
    scenes.forEach(s => {
      if (!s.visual_prompt) s.visual_prompt = '';
      const idx = s.visual_prompt.indexOf(marker);
      const base = idx >= 0 ? s.visual_prompt.slice(0, idx) : s.visual_prompt;
      const parts = [
        charLine,
        `의상: ${lock.wardrobe || '-'}`,
        `소품: ${lock.props || '-'}`,
        `조명: ${lock.lighting_rule || '-'}`,
        `카메라: ${lock.camera_rule || '-'}`,
        palLine,
      ].filter(Boolean);
      s.visual_prompt = base.trimEnd() + `${marker}\n` + parts.join('\n');
    });
    if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    savRenderContinuityLock();
    toast('일관성 Lock 적용 완료 — 모든 씬 visual_prompt 에 주입');
  } catch (e) {
    toast('Continuity 생성 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🔒 일관성 Lock 생성'; }
  }
}
window.savGenerateContinuityLock = savGenerateContinuityLock;

function savRenderContinuityLock() {
  const area = document.getElementById('sav-continuity-area');
  if (!area) return;
  const lock = _savState.continuityLock;
  if (!lock || !Object.keys(lock).length) { area.style.display = 'none'; return; }
  area.style.display = 'block';
  const chars = Array.isArray(lock.characters) ? lock.characters : [];
  const pal = lock.palette_lock || {};
  area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;font-size:11px;">
    <div style="font-weight:800;color:#5856d6;margin-bottom:6px;">🔒 Continuity Lock (모든 씬에 주입됨)</div>
    ${chars.length ? `<div style="margin-bottom:4px;"><b>인물:</b> ${chars.map(c => escapeHtml(c.description||c.name||'')).join(' · ')}</div>` : ''}
    ${lock.wardrobe ? `<div><b>의상:</b> ${escapeHtml(lock.wardrobe)}</div>` : ''}
    ${lock.props ? `<div><b>소품:</b> ${escapeHtml(lock.props)}</div>` : ''}
    ${lock.lighting_rule ? `<div><b>조명:</b> ${escapeHtml(lock.lighting_rule)}</div>` : ''}
    ${lock.camera_rule ? `<div><b>카메라:</b> ${escapeHtml(lock.camera_rule)}</div>` : ''}
    ${Object.keys(pal).length ? `<div style="margin-top:4px;"><b>컬러 Lock:</b> ${Object.entries(pal).map(([k,v])=>`<span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${escapeHtml(v)};border:1px solid rgba(0,0,0,0.1);vertical-align:middle;margin:0 3px;" title="${escapeHtml(k)}:${escapeHtml(v)}"></span>`).join('')}</div>` : ''}
  </div>`;
}

// ─── Phase1 #2 씬 재검토 ──────────────────────────────────────
async function savCritiqueAllScenes() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const sb = _savState.storyboard || [];
  if (!scenes.length) { toast('스크립트 먼저 생성하세요', 'error'); return; }
  const btn = document.getElementById('sav-critique-btn');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '👁 검토 중...'; }
  _savState.sceneCritiques = {};
  try {
    const treatment = _savState.directorTreatment || {};
    const shotMap = {};
    (treatment.shot_list || []).forEach(sh => { shotMap[sh.scene_index] = sh; });
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const sbItem = sb.find(x => x.scene_index === i + 1);
      const intent = (shotMap[i+1]?.visual_prompt_augment || '') + (shotMap[i+1]?.mood ? ` 무드:${shotMap[i+1].mood}` : '');
      try {
        const r = await api('/api/advideo/critique-scene', {
          method: 'POST',
          body: {
            scene_index: i + 1,
            title: sc.title || '',
            narration: sc.narration || '',
            visual_prompt: sc.visual_prompt || '',
            image_url: sbItem?.image_url || '',
            director_intent: intent,
          },
        });
        _savState.sceneCritiques[i + 1] = r;
        // 점수 낮으면 프롬프트 자동 개선
        if (r.retake && r.improved_prompt) {
          sc.visual_prompt = r.improved_prompt;
        }
      } catch (e) { _savState.sceneCritiques[i + 1] = { score: 0, feedback: String(e?.message||e), retake: false }; }
    }
    if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    const count = Object.values(_savState.sceneCritiques).filter(c => c.retake).length;
    // 2차 재검토 — 개선된 프롬프트를 한 번 더 Claude 가 체크
    if (count > 0) {
      for (let i = 0; i < scenes.length; i++) {
        const first = _savState.sceneCritiques[i + 1];
        if (!first?.retake) continue;
        const sc = scenes[i];
        try {
          const r2 = await api('/api/advideo/critique-scene', {
            method: 'POST',
            body: {
              scene_index: i + 1,
              title: sc.title || '',
              narration: sc.narration || '',
              visual_prompt: sc.visual_prompt || '',
              director_intent: first.feedback || '',
            },
          });
          _savState.sceneCritiques[i + 1] = { ...r2, _pass: 2 };
        } catch (_) { /* keep pass1 */ }
      }
      const stillRetake = Object.values(_savState.sceneCritiques).filter(c => c.retake).length;
      toast(`1차 재촬영 ${count}건 → 2차 개선 후 ${stillRetake}건 남음`, stillRetake ? 'info' : 'success');
    } else {
      toast('모든 씬 감독 승인 통과', 'success');
    }
    // 🔔 감독이 요청한 자산(로고·상품·실장소 등)을 UI 에 표시
    savRenderAssetRequests();
  } catch (e) {
    toast('재검토 실패: ' + (e?.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '👁 씬 재검토'; }
  }
}
window.savCritiqueAllScenes = savCritiqueAllScenes;

// 감독이 요청한 씬별 자산(로고·상품·실장소)을 카드로 렌더 + 업로드 버튼
function savRenderAssetRequests() {
  const crits = _savState.sceneCritiques || {};
  const scenes = (_savState.script && _savState.script.scenes) || [];
  const requests = [];
  Object.entries(crits).forEach(([sceneIdx, c]) => {
    const na = c.needed_assets || [];
    na.forEach(r => requests.push({ scene_index: parseInt(sceneIdx, 10), ...r }));
  });
  let box = document.getElementById('sav-asset-requests');
  if (!box) {
    // storyboard area 바로 아래에 박스 신규 삽입
    const host = document.getElementById('sav-storyboard-area');
    if (!host) return;
    box = document.createElement('div');
    box.id = 'sav-asset-requests';
    box.style.margin = '8px 0';
    host.parentNode.insertBefore(box, host.nextSibling);
  }
  if (!requests.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const iconMap = { logo: '🏷', product: '📦', person: '🧍', location: '🏞', document: '📝', graphic: '🎨' };
  const labelMap = { logo: '로고', product: '상품', person: '인물', location: '장소', document: '문서', graphic: '그래픽' };
  box.style.display = 'block';
  box.innerHTML = `<div style="padding:12px;background:linear-gradient(135deg,rgba(255,59,48,0.08),rgba(255,140,0,0.04));border:1px solid rgba(255,59,48,0.2);border-radius:10px;">
    <div style="font-weight:800;color:#ff3b30;margin-bottom:8px;font-size:12px;">🔔 감독이 요청한 실제 자산 (${requests.length}건)</div>
    ${requests.map((r, i) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:8px;margin-top:4px;font-size:11px;">
      <div style="flex:1;min-width:0;">
        <b>씬 ${r.scene_index} · ${iconMap[r.type]||'📎'} ${labelMap[r.type]||r.type} 필요</b>
        <div style="color:rgba(0,0,0,0.6);margin-top:2px;">${escapeHtml(r.reason || '')}</div>
      </div>
      <button type="button" onclick="document.getElementById('sav-asset-upload-${i}').click()" style="flex:0 0 auto;padding:4px 10px;font-size:10px;font-weight:700;border:none;background:#ff3b30;color:#fff;border-radius:999px;cursor:pointer;">📤 씬 ${r.scene_index} 에 업로드</button>
      <input type="file" id="sav-asset-upload-${i}" accept="image/*" style="display:none;" onchange="savUploadAssetForScene(${r.scene_index}, '${r.type}', this.files)">
    </div>`).join('')}
  </div>`;
}
window.savRenderAssetRequests = savRenderAssetRequests;

async function savUploadAssetForScene(sceneIndex, assetType, files) {
  if (!files || !files.length) return;
  const file = files[0];
  try {
    const fd = new FormData();
    fd.append('files', file);
    const resp = await fetch('/api/content/upload-image', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const img = (data.images || [])[0];
    if (!img) throw new Error('업로드 결과 없음');
    // 전역 uploadedImages 에도 추가
    savAddGlobalImage({ ...img, role: assetType }, 'upload');
    // 해당 씬의 sceneImages 에만 추가
    _savState.sceneImages = _savState.sceneImages || {};
    const k = sceneIndex - 1;
    _savState.sceneImages[k] = _savState.sceneImages[k] || [];
    if (img.url && !_savState.sceneImages[k].includes(img.url)) {
      _savState.sceneImages[k].unshift(img.url); // 앞에 추가해 우선 순위
    }
    savRenderImages();
    if (typeof savRenderScript === 'function') savRenderScript();
    toast(`씬 ${sceneIndex} 에 ${assetType} 업로드 완료`);
    // 재검토에서 해당 요청 제거
    const crit = _savState.sceneCritiques?.[sceneIndex];
    if (crit && Array.isArray(crit.needed_assets)) {
      crit.needed_assets = crit.needed_assets.filter(r => r.type !== assetType);
    }
    savRenderAssetRequests();
  } catch (e) { toast('업로드 실패: ' + (e?.message||e), 'error'); }
}
window.savUploadAssetForScene = savUploadAssetForScene;

// ─── Phase2 #5 Music-First 비트 싱크 ─────────────────────────
async function savMusicFirstSync() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('스크립트 먼저 생성', 'error'); return; }
  const btn = document.getElementById('sav-bgm-first-btn');
  const area = document.getElementById('sav-bgm-first-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🎵 BGM 생성 + 스냅 중...'; }
  if (area) { area.style.display = 'block'; area.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:rgba(0,0,0,0.5);">Lyria Pro BGM 생성 중 (1~2분) + 씬 duration 을 BPM 에 맞춰 스냅...</div>'; }
  try {
    const totalDuration = scenes.reduce((a,s)=>a+(parseFloat(s.duration)||5), 0);
    const treatment = _savState.directorTreatment || {};
    const res = await api('/api/advideo/bgm-first', {
      method: 'POST',
      body: {
        duration: totalDuration,
        topic: (document.getElementById('sav-topic')?.value || '').trim(),
        music_cue: treatment.music_cue || {},
        scene_count: scenes.length,
      },
    });
    _savState.bgmFirst = res;
    // 씬 duration 스냅 적용
    (res.scene_snap || []).forEach(snap => {
      const idx = (snap.scene_index || 0) - 1;
      if (idx >= 0 && idx < scenes.length) scenes[idx].duration = snap.duration_sec;
    });
    if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    if (area) area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;">
      <div style="font-weight:800;color:#5856d6;font-size:11px;margin-bottom:6px;">🎵 BGM Ready · ${res.bpm} BPM · ${res.duration}s · 드랍 ${res.key_moment_sec || 0}s</div>
      <audio controls src="${escapeHtml(res.bgm_url)}" style="width:100%;margin-bottom:6px;"></audio>
      <div style="font-size:10px;color:rgba(0,0,0,0.55);">씬 duration 이 4-beat 배수로 스냅되었습니다. 드랍 씬은 20% 연장.</div>
    </div>`;
    toast('BGM 생성 + 비트 스냅 완료');
  } catch (e) {
    toast('BGM 생성 실패: ' + (e?.message || e), 'error');
    if (area) area.innerHTML = `<div style="padding:12px;font-size:11px;color:#ff3b30;text-align:center;">실패: ${escapeHtml(String(e?.message||e))}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎵 BGM 먼저 + 비트 싱크'; }
  }
}
window.savMusicFirstSync = savMusicFirstSync;

// ─── Phase2 #6 씬별 보이스 디렉팅 ─────────────────────────────
async function savDirectPerSceneVoice() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('스크립트 먼저 생성', 'error'); return; }
  const btn = document.getElementById('sav-voice-dir-btn');
  const area = document.getElementById('sav-voice-dir-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🎙 디렉팅 중...'; }
  try {
    const res = await api('/api/advideo/per-scene-voice', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default',
        scenes: scenes.map(s => ({ title: s.title || '', narration: s.narration || '' })),
        story_angle: (document.getElementById('sav-story-angle')?.value || '').trim(),
      },
    });
    const arr = res?.per_scene_voice || [];
    _savState.perSceneVoice = {};
    arr.forEach(v => {
      const idx = v.scene_index;
      if (idx) {
        _savState.perSceneVoice[idx] = v;
        const sc = scenes[idx - 1];
        if (sc) {
          sc.tts_voice = v.voice;
          sc.tts_rate = v.rate;
          sc.tts_style = v.style;
        }
      }
    });
    if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    if (area) {
      area.style.display = 'block';
      area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;font-size:11px;">
        <div style="font-weight:800;color:#5856d6;margin-bottom:6px;">🎙 씬별 보이스 디렉팅</div>
        ${arr.map(v => `<div style="padding:4px 0;border-bottom:1px dashed rgba(0,0,0,0.06);"><b>씬 ${v.scene_index}:</b> <span style="color:#5856d6;font-weight:700;">${escapeHtml(v.voice||'-')}</span> · ${escapeHtml(v.rate||'normal')} · ${escapeHtml(v.style||'')}</div>`).join('')}
      </div>`;
    }
    toast(`씬별 보이스 ${arr.length}개 적용`);
  } catch (e) { toast('보이스 디렉팅 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎙 씬별 보이스'; } }
}
window.savDirectPerSceneVoice = savDirectPerSceneVoice;

// ─── Phase2 #7 씬별 컬러 그레이딩 ─────────────────────────────
async function savGenerateColorGrade() {
  const scenes = (_savState.script && _savState.script.scenes) || [];
  if (!scenes.length) { toast('스크립트 먼저 생성', 'error'); return; }
  const btn = document.getElementById('sav-color-btn');
  const area = document.getElementById('sav-color-grade-area');
  const orig = btn?.innerHTML || '';
  if (btn) { btn.disabled = true; btn.innerHTML = '🎨 색보정 설계 중...'; }
  try {
    const palette = _savState.directorTreatment?.color_palette || [];
    const treatment = _savState.directorTreatment || {};
    const shots = treatment.shot_list || [];
    const sceneMoods = scenes.map((s, i) => ({ mood: shots[i]?.mood || '' }));
    const res = await api('/api/advideo/color-lut', {
      method: 'POST',
      body: {
        persona_id: document.getElementById('sav-director-persona')?.value || 'default', color_palette: palette, scenes: sceneMoods },
    });
    const grade = res?.color_grade || [];
    _savState.colorGrade = {};
    grade.forEach(g => {
      const idx = g.scene_index;
      if (idx) {
        _savState.colorGrade[idx] = g;
        const sc = scenes[idx - 1];
        if (sc) {
          // Veo 네이티브 그레이딩 힌트 (프롬프트)
          const note = `[Color Grade] ${g.grade_note || ''} (hue${g.hue_shift||0}, sat${g.saturation||0}, contrast${g.contrast||0}, warmth${g.warmth||0})`;
          if (!sc.visual_prompt?.includes('[Color Grade]')) {
            sc.visual_prompt = (sc.visual_prompt || '') + '\n' + note;
          } else {
            sc.visual_prompt = sc.visual_prompt.replace(/\[Color Grade\][^\n]*/g, note);
          }
          // ffmpeg 후처리용 정규화 파라미터 (백엔드가 읽음)
          sc.color_grade = {
            hue_shift: g.hue_shift || 0,
            saturation: g.saturation || 0,
            contrast: g.contrast || 0,
            warmth: g.warmth || 0,
            vignette: g.vignette || 0,
          };
        }
      }
    });
    if (typeof savRenderScript === 'function') { try { savRenderScript(); } catch(_){} }
    if (area) {
      area.style.display = 'block';
      area.innerHTML = `<div style="padding:10px 12px;background:#fff;border:1px solid rgba(88,86,214,0.2);border-radius:10px;font-size:11px;">
        <div style="font-weight:800;color:#5856d6;margin-bottom:6px;">🎨 씬별 컬러 그레이딩</div>
        ${grade.map(g => {
          // CSS 미리보기 필터
          const filter = `hue-rotate(${g.hue_shift||0}deg) saturate(${1+(g.saturation||0)/100}) contrast(${1+(g.contrast||0)/100}) brightness(${1-(g.vignette||0)/200})`;
          return `<div style="padding:4px 0;border-bottom:1px dashed rgba(0,0,0,0.06);display:flex;gap:6px;align-items:center;">
            <div style="width:20px;height:20px;border-radius:4px;background:#888;filter:${filter};border:1px solid rgba(0,0,0,0.1);flex:0 0 auto;"></div>
            <div style="flex:1;"><b>씬 ${g.scene_index}:</b> ${escapeHtml(g.grade_note||'')} <span style="color:rgba(0,0,0,0.5);">(hue${g.hue_shift||0}, sat${g.saturation||0}, warm${g.warmth||0})</span></div>
          </div>`;
        }).join('')}
      </div>`;
    }
    toast(`컬러 그레이드 ${grade.length}개 씬 적용`);
  } catch (e) { toast('색보정 실패: ' + (e?.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig || '🎨 씬별 색보정'; } }
}
window.savGenerateColorGrade = savGenerateColorGrade;

