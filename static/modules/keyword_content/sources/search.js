// keyword_content/sources/search.js — 한글/영문 키워드 검색, 번역, AI 딥 리서치

// 영문 글로벌 검색
async function kcSearchGlobal() {
  const keyword = document.getElementById('kc-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }

  const btn = document.getElementById('kc-search-en-btn');
  const container = document.getElementById('kc-global-results');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span>';
  container.style.display = 'block';
  container.innerHTML = '<div style="text-align:center;padding:16px;"><span class="spinner"></span> 영문 소스 검색 중...</div>';

  try {
    console.log(`[영문검색] 시작: "${keyword}"`);
    const res = await api('/api/content/search-global', { method: 'POST', body: { keyword } });
    const sources = res.data.sources || [];
    const enKeyword = res.data.en_keyword || keyword;
    console.log(`[영문검색] 완료: ${sources.length}건, 영문키워드: ${enKeyword}`);

    if (sources.length === 0) {
      container.innerHTML = '<div style="color:rgba(255,255,255,0.3);padding:12px;font-size:13px;">영문 검색 결과가 없습니다.</div>';
      return;
    }

    container.innerHTML = `
      <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:8px;">영문 키워드: <span style="color:#4285f4;font-weight:600;">${escapeHtml(enKeyword)}</span> · ${sources.length}건</div>
      ${sources.map((s, i) => `
        <div style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px;">
          <input type="checkbox" data-global-idx="${i}" style="accent-color:#4285f4;" onchange="kcToggleGlobalSource(${i})">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:#e0e6ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.title)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);">${escapeHtml(s.source)} · ${s.type}</div>
          </div>
          <button class="btn btn-sm" onclick="kcTranslateSource(${i}, this)" style="font-size:10px;padding:2px 8px;background:rgba(79,192,141,0.12);color:#4fc08d;border:1px solid rgba(79,192,141,0.3);flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>번역</button>
        </div>
        <div id="kc-global-translated-${i}" style="display:none;padding:6px 10px 6px 30px;font-size:12px;color:#4fc08d;background:rgba(79,192,141,0.04);"></div>
      `).join('')}
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-sm" onclick="kcTranslateAll()" style="background:rgba(79,192,141,0.12);color:#4fc08d;border:1px solid rgba(79,192,141,0.3);font-weight:600;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>선택한 소스 전체 번역</button>
        <button class="btn btn-sm" onclick="kcAddGlobalToSources()" style="background:rgba(91,155,245,0.12);color:#5b9bf5;border:1px solid rgba(91,155,245,0.3);font-weight:600;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>선택한 소스 추가</button>
      </div>`;

    window._kcGlobalSources = sources;
  } catch (e) {
    container.innerHTML = `<div style="color:#ff453a;padding:12px;font-size:13px;">검색 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🌐 영문 검색';
  }
}

async function kcTranslateSource(idx, btnEl) {
  const s = window._kcGlobalSources[idx];
  if (!s) return;
  const target = document.getElementById('kc-global-translated-' + idx);
  btnEl.disabled = true;
  btnEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span>';
  try {
    const res = await api('/api/content/translate', { method: 'POST', body: { text: s.title } });
    target.style.display = 'block';
    target.textContent = '→ ' + res.translated;
    s.translated_title = res.translated;
    btnEl.textContent = '완료';
    btnEl.style.color = '#4fc08d';
  } catch {
    btnEl.textContent = '실패';
    btnEl.style.color = '#ff453a';
  }
}

async function kcTranslateAll() {
  const checkboxes = document.querySelectorAll('[data-global-idx]:checked');
  if (checkboxes.length === 0) { toast('소스를 선택하세요', 'error'); return; }
  toast(`${checkboxes.length}건 번역 시작...`);
  for (const cb of checkboxes) {
    const idx = parseInt(cb.dataset.globalIdx);
    const btn = cb.closest('div').querySelector('.btn');
    if (btn) await kcTranslateSource(idx, btn);
  }
  toast('번역 완료!');
}

function kcToggleGlobalSource(idx) {}

function kcAddGlobalToSources() {
  const checkboxes = document.querySelectorAll('[data-global-idx]:checked');
  if (checkboxes.length === 0) { toast('소스를 선택하세요', 'error'); return; }
  let added = 0;
  for (const cb of checkboxes) {
    const idx = parseInt(cb.dataset.globalIdx);
    const s = window._kcGlobalSources[idx];
    if (!s) continue;
    _kcSelectedSources.push({
      title: s.translated_title || s.title,
      url: s.url,
      source: s.source,
      type: s.type,
      checked: true,
      language: 'en',
      originalTitle: s.title,
    });
    added++;
  }
  toast(`${added}건 소스 추가됨`);
  kcRenderSourcesList();
}

async function kcDeepResearch() {
  const keyword = document.getElementById('kc-keyword')?.value?.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }

  const btn = document.getElementById('kc-deep-research-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;"></span> 조사 중...';

  try {
    // 1. AI 조사 시작
    console.log(`[AI 조사] 시작: "${keyword}"`);
    toast('AI 조사 시작 — Google 검색으로 조사 중...');
    const res = await api('/api/deep-research', {
      method: 'POST',
      body: { query: keyword },
      timeout: 600000,
    });
    console.log(`[AI 조사] 응답:`, res.status, res.result ? `${res.result.length}자` : 'empty');

    if (res.result) {
      // 소스로 추가
      _kcSelectedSources.push({
        title: `🔍 AI 조사: ${keyword}`,
        url: '',
        source: 'Google Search',
        type: 'deep-research',
        checked: true,
        scrapedText: res.result,
      });
      kcRenderSourcesList();
      toast(`AI 조사 완료! ${res.result.length.toLocaleString()}자 수집`);

      // 검색 데이터도 갱신
      if (!_kcSearchData) _kcSearchData = { keyword, sources: [] };

      // 1단계에서 결과 미리보기 표시
      let preview = document.getElementById('kc-research-preview');
      if (!preview) {
        preview = document.createElement('div');
        preview.id = 'kc-research-preview';
        document.getElementById('kc-input-keyword')?.appendChild(preview);
      }
      preview.style.cssText = 'margin-top:12px;padding:14px;background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.1);border-radius:10px;max-height:200px;overflow-y:auto;';
      preview.innerHTML = `<div style="font-size:12px;font-weight:600;color:#ff8c00;margin-bottom:6px;">🔍 AI 조사 결과 (${res.result.length.toLocaleString()}자)</div><div style="font-size:12px;color:#1c1c1e;white-space:pre-wrap;line-height:1.6;">${escapeHtml(res.result.substring(0, 500))}${res.result.length > 500 ? '...' : ''}</div>`;

      // 2단계로 자동 이동
      setTimeout(() => kcGoToStep(2), 500);
    } else {
      toast(res.error || 'AI 조사 실패', 'error');
    }
  } catch (e) {
    console.error('[AI 조사] 에러:', e);
    toast('AI 조사 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 AI 조사';
  }
}

async function kcSearch() {
  if (!window._globalProfileId) { toast('프로필을 먼저 선택하세요', 'error'); return; }
  const keyword = document.getElementById('kc-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }
  kcSavePrevSettings();

  const btn = document.getElementById('kc-search-btn');
  const loading = document.getElementById('kc-search-loading');
  btn.disabled = true;
  loading.style.display = 'block';
  document.getElementById('kc-related-keywords').style.display = 'none';

  try {
    console.log(`[한글검색] 시작: "${keyword}"`);
    const res = await api('/api/content/search', {
      method: 'POST',
      body: { keyword },
    });
    console.log(`[한글검색] 완료:`, res.data ? `뉴스 ${(res.data.news||[]).length}건, 블로그 ${(res.data.blogs||[]).length}건` : 'empty');

    _kcSearchData = res.data;
    _kcSelectedSources = [];

    // 연관 키워드 표시
    const related = res.data.related_keywords || [];
    if (related.length > 0) {
      document.getElementById('kc-related-list').innerHTML = related.map(k =>
        `<button class="btn btn-secondary btn-sm" style="padding:3px 10px;font-size:11px;margin:2px;" onclick="document.getElementById('kc-keyword').value='${escapeHtml(k)}';kcSearch();">${escapeHtml(k)}</button>`
      ).join('');
      document.getElementById('kc-related-keywords').style.display = 'block';
    }

    // 수동 URL 소스를 검색 결과 앞에 합치기
    const allSources = [..._kcManualUrls, ...(res.data.sources || [])];
    kcRenderSources(allSources);

    toast(`${res.data.source_count}건의 자료를 찾았습니다! 본문 가져오는 중...`);
    kcGoToStep(2);

    // 선택된 소스 본문 자동 스크래핑
    _kcSelectedSources.forEach((s, idx) => {
      if (s.checked && s.url && !s.scrapedText) {
        kcScrapeArticle(idx);
      }
    });

    // 백그라운드로 소스 이미지 자동 수집
    kcFetchSourceImages();
  } catch (e) {
    toast('검색 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}
