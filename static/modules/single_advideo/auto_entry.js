/* single_advideo — 자동 진입점(AutoDirect / Click-to-Ad / 문서/텍스트/참고영상) + 브리프 자동 채움 */
async function savAutoDirect() {
  if (!_savState.script || !Array.isArray(_savState.script.scenes) || !_savState.script.scenes.length) {
    toast('먼저 스크립트를 생성하세요', 'error'); return;
  }
  // ★ 영상이 이미 생성됐으면 디렉팅 재실행 금지 (사용자: "7에서 다시 5로 가지")
  // 영상 완성 후 디렉팅을 다시 돌리면 씬 카드가 갈리고 currentStep 이 5로 보이는 효과
  if (_savState.finalVideoPath) {
    console.log('[savAutoDirect] 영상이 이미 생성됨 → 디렉팅 재실행 무시');
    if (typeof toast === 'function') toast('영상이 이미 생성된 상태입니다. 다시 실행하려면 새 시나리오를 시작하세요.', 'info');
    return;
  }
  // 모든 씬이 이미 디렉팅 완료면 재실행 무시 (반복 호출 방지)
  const _allDirected = _savState.script.scenes.every(s => s && s.camera_preset);
  if (_allDirected) {
    console.log('[savAutoDirect] 모든 씬 이미 디렉팅 완료 → 무시');
    return;
  }
  const _curStep = parseInt(_savState.currentStep || 1, 10) || 1;
  if (_curStep > 5 && !_savState._autoRunning) {
    console.log(`[savAutoDirect] step ${_curStep} 에서 호출 → 무시 (디렉팅은 step 4-5 에서만)`);
    return;
  }
  var profile = window._globalProfileData || {};
  toast('AI가 씬별 디렉팅을 분석 중...', 'info');
  _savState._autoDirectRunning = true;
  try { savShowAutoDirectBanner(true); } catch (e) {}
  try {
    var resp = await fetch('/api/advideo/auto-direct', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        scenes: _savState.script.scenes,
        brand: profile.name || '',
        topic: _savState.script.topic || '',
        tone: document.getElementById('sav-technique')?.value || '',
        objective: document.getElementById('sav-objective')?.value || '광고',
      })
    });
    var data = await resp.json();
    if (!resp.ok || !data.ok || !Array.isArray(data.scenes)) {
      throw new Error((data && (data.detail || data.error)) || 'auto-direct 실패');
    }
    _savState.script.scenes = data.scenes;
    // 요약 표시
    var summary = data.scenes.map(function (s, i) {
      return (i+1) + '. ' + (s.camera_preset || '—') + ' / ' + (s.lighting_preset || '—') + ' / ' + (s.style_preset || '—') + ' · 모션 ' + (s.motion_intensity || 50);
    }).join('\n');
    toast('씬별 디렉팅 완료:\n' + summary, 'success');
    console.log('[auto-direct] enriched scenes:', data.scenes);
    // ★ 씬 카드 재렌더 — 카메라/라이팅/스타일 드롭다운에 AI 결과 반영
    if (typeof savRenderScript === 'function') savRenderScript();
    if (typeof savRenderSceneResults === 'function') savRenderSceneResults();
    if (typeof savRenderDirectingSummary === 'function') savRenderDirectingSummary();
    // 완료 후 씬 카드 영역으로 부드러운 스크롤
    setTimeout(function () {
      const area = document.getElementById('sav-script-area');
      if (area && area.scrollIntoView) area.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 씬 카드에 짧은 하이라이트 애니메이션
      if (area) {
        area.style.transition = 'box-shadow 0.4s';
        area.style.boxShadow = '0 0 0 3px rgba(255,140,0,0.4)';
        setTimeout(function () { area.style.boxShadow = 'none'; }, 1200);
      }
    }, 150);
  } catch (e) {
    console.error('[auto-direct] 실패:', e);
    toast('AI 자동 디렉팅 실패: ' + e.message, 'error');
  } finally {
    _savState._autoDirectRunning = false;
    try { savShowAutoDirectBanner(false); } catch (e) {}
  }
}
window.savAutoDirect = savAutoDirect;

// 자동 생성 중 배너 — 4단계 패널 상단에 고정 표시
function savShowAutoDirectBanner(show) {
  const panel = document.querySelector('[data-step-panel="5"] .card');
  if (!panel) return;
  let banner = document.getElementById('sav-auto-direct-banner');
  if (show) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sav-auto-direct-banner';
      banner.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;margin:-8px 0 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:12px;font-weight:800;font-size:14px;box-shadow:0 8px 24px rgba(255,140,0,0.28);';
      banner.innerHTML =
        '<span class="spinner" style="width:18px;height:18px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span>'
        + '<span>🤖 AI 자동 씬 디렉팅 생성 중... <span style="opacity:0.85;font-weight:500;">(약 15~20초 소요)</span></span>';
      // CSS 애니메이션 삽입 (한 번만)
      if (!document.getElementById('sav-auto-direct-style')) {
        const sty = document.createElement('style');
        sty.id = 'sav-auto-direct-style';
        sty.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
        document.head.appendChild(sty);
      }
      panel.insertBefore(banner, panel.firstChild.nextSibling); // heading 뒤
    }
    banner.style.display = 'flex';
  } else if (banner) {
    banner.style.display = 'none';
  }
}
window.savShowAutoDirectBanner = savShowAutoDirectBanner;

async function savClickToAd() {
  var url = (document.getElementById('sav-product-url')?.value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) { toast('제품 URL을 입력하세요', 'error'); return; }
  toast('상품 정보 분석 중...', 'info');
  try {
    // 1단계: 상품 메타 정보 (이름·가격·설명·이미지) 추출
    var prodImgs = [];
    try {
      var prodResp = await fetch('/api/advideo/scrape-product', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url: url})
      });
      if (prodResp.ok) {
        var prodData = await prodResp.json();
        // 주제·메시지 자동 입력 (사용자가 미리 입력했으면 보존)
        var topicEl = document.getElementById('sav-topic');
        var msgEl = document.getElementById('sav-message');
        if (topicEl && prodData.topic && !topicEl.value.trim()) topicEl.value = prodData.topic;
        if (msgEl && prodData.message && !msgEl.value.trim()) msgEl.value = prodData.message;
        prodImgs = (prodData.images || []).filter(Boolean);
        var meta = prodData.raw || {};
        var summary = '✓ ' + (prodData.topic || '상품').slice(0, 30);
        if (meta.price) summary += ' · ' + meta.price;
        if (meta.platform) summary += ' (' + meta.platform + ')';
        toast(summary + ' — 이미지 ' + prodImgs.length + '장', 'info');
      }
    } catch (_) { /* product_scraper 실패해도 fallback 으로 capture-url 시도 */ }

    // 2단계: 페이지 렌더링 캡처 (스크래퍼가 못 잡은 이미지 보강)
    var imgs = prodImgs.slice();
    try {
      var capResp = await fetch('/api/ec/rebuild/capture-url', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url: url})
      });
      var capData = await capResp.json();
      var capImgs = (capData && capData.images) || [];
      capImgs.forEach(function(u){ if (u && imgs.indexOf(u) < 0) imgs.push(u); });
    } catch (_) {}

    if (imgs.length) {
      _savState.uploadedImages = imgs.slice(0, 6);
      if (typeof savRenderUploadedImages === 'function') savRenderUploadedImages();
      toast('이미지 ' + Math.min(imgs.length, 6) + '장 수집 완료. 스크립트 생성 시작...', 'info');
    } else {
      toast('URL에서 이미지를 찾지 못했습니다. 수동 업로드 후 시도해주세요.', 'error');
      return;
    }
    // 3단계: 스크립트 자동 생성
    await savGenerateScript();
    toast('자동 스토리보드 완성. 아래에서 확인·편집 후 생성 버튼을 누르세요.', 'success');
  } catch (e) {
    console.error('[Click-to-Ad] 실패:', e);
    toast('Click-to-Ad 실패: ' + e.message, 'error');
  }
}
window.savClickToAd = savClickToAd;

// 📄 문서 업로드 → brief 자동 추출
async function savAutoFromDocument(file) {
  if (!file) return;
  toast(`📄 ${file.name} 분석 중...`, 'info');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/advideo/auto-from-document', { method: 'POST', body: fd });
    if (!r.ok) { toast(`문서 분석 실패: ${r.status}`, 'error'); return; }
    const d = await r.json();
    _savFillFromBrief(d);
    toast(`✓ 문서 분석 완료 — 주제·메시지 자동 입력. 스크립트 생성 중...`, 'info');
    if (typeof savGenerateScript === 'function') await savGenerateScript();
    toast(`✓ 스토리보드 생성 완료. 확인 후 영상 생성 진행하세요.`, 'success');
  } catch (e) {
    toast(`문서 분석 실패: ${e?.message || e}`, 'error');
  }
}
window.savAutoFromDocument = savAutoFromDocument;

// 📋 텍스트 붙여넣기 → brief 자동 추출
function savOpenTextPaste() {
  const text = prompt('붙여넣을 텍스트를 입력하세요 (기획서·광고 카피·자료 등 — 1만자 이내):');
  if (!text || !text.trim()) return;
  savAutoFromText(text);
}
window.savOpenTextPaste = savOpenTextPaste;

async function savAutoFromText(text) {
  toast('📋 텍스트 분석 중...', 'info');
  try {
    const r = await fetch('/api/advideo/auto-from-text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) { toast(`텍스트 분석 실패: ${r.status}`, 'error'); return; }
    const d = await r.json();
    _savFillFromBrief(d);
    toast(`✓ 텍스트 분석 완료 — 주제·메시지 자동 입력. 스크립트 생성 중...`, 'info');
    if (typeof savGenerateScript === 'function') await savGenerateScript();
    toast(`✓ 스토리보드 생성 완료.`, 'success');
  } catch (e) {
    toast(`텍스트 분석 실패: ${e?.message || e}`, 'error');
  }
}
window.savAutoFromText = savAutoFromText;

// 🎬 참고 광고 영상 (YouTube 등) → brief 자동 추출
async function savAutoFromRefVideo() {
  const url = (document.getElementById('sav-ref-video-url')?.value || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) { toast('YouTube URL 입력', 'error'); return; }
  toast('🎬 참고 영상 분석 중... (1~2분 소요)', 'info');
  try {
    const r = await fetch('/api/advideo/auto-from-ref-video', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!r.ok) { toast(`영상 분석 실패: ${r.status}`, 'error'); return; }
    const d = await r.json();
    _savFillFromBrief(d);
    if (d.structure_hint) toast(`💡 구조 힌트: ${d.structure_hint}`, 'info');
    toast(`✓ 영상 분석 완료. 스크립트 생성 중...`, 'info');
    if (typeof savGenerateScript === 'function') await savGenerateScript();
    toast(`✓ 참고 영상 톤 반영한 스토리보드 완성.`, 'success');
  } catch (e) {
    toast(`영상 분석 실패: ${e?.message || e}`, 'error');
  }
}
window.savAutoFromRefVideo = savAutoFromRefVideo;

// 공통: brief → topic/message/target 자동 입력 (사용자 입력 보존)
function _savFillFromBrief(d) {
  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id);
    if (el && val && !el.value.trim()) el.value = val;
  };
  setIfEmpty('sav-topic', d.topic);
  setIfEmpty('sav-message', d.message);
  setIfEmpty('sav-target', d.target);
  // tone 은 select 일 수 있으므로 처리
  const toneEl = document.getElementById('sav-tone');
  if (toneEl && d.tone && !toneEl.value) toneEl.value = d.tone;
}
