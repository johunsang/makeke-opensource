// ============================================================
// 실시간 트렌드 대시보드
// ============================================================

let _trendDashboardData = null;
window._trendDashboardData = null;
let _currentNewsCategory = 'entertainment';

function tdPickNews(idx) {
  const n = (window._tdCustomNews || [])[idx];
  if (!n || typeof window.startBlogFromTrend !== 'function') return;
  window.startBlogFromTrend(String(n.title || '').substring(0, 60), [{title: n.title, url: n.url || n.link || '', source: n.source || ''}]);
}

function tdPickCategoryNews(category, idx) {
  const news = window._trendDashboardData?.category_news?.[category]?.news || [];
  const n = news[idx];
  if (!n || typeof window.startBlogFromTrend !== 'function') return;
  window.startBlogFromTrend(String(n.title || '').substring(0, 60), [{title: n.title, url: n.url || n.link || '', source: n.source || ''}]);
}

window.tdPickNews = tdPickNews;
window.tdPickCategoryNews = tdPickCategoryNews;

async function _trendQuickReport() {
  const btn = document.getElementById('td-quick-report-btn');
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }
  // _quickReportError가 있으면 그쪽으로 위임 (에러 패널 데이터 활용)
  if (typeof _quickReportError === 'function') {
    await _quickReportError();
    if (btn) { btn.disabled = false; btn.textContent = '바로 문의 보내기'; }
    return;
  }
  if (btn) { btn.disabled = false; btn.textContent = '바로 문의 보내기'; }
  toast('문의 전송 기능을 사용할 수 없습니다.', 'error');
}

function tdRunBackgroundAnalyses(profileId) {
  const tasks = [];

  if (profileId) {
    tasks.push(
      sortTrendsByProfile(profileId).catch(e => {
        console.error('[트렌드] 프로필 AI 분석 실패:', e);
      })
    );
  }

  if (window._trendKr?.length > 0) {
    const topKeywords = window._trendKr.slice(0, 10).map(t => t.keyword);
    tasks.push(
      tdAutoAnalyzeKeywords(topKeywords).catch(e => {
        console.error('[트렌드] 블로그 경쟁 분석 실패:', e);
      })
    );
  }

  return Promise.allSettled(tasks);
}

async function tdAutoAnalyzeKeywords(keywords) {
  const tbody = document.getElementById('td-search-vol-tbody');
  const resultDiv = document.getElementById('td-search-vol-result');
  const compDiv = document.getElementById('td-blog-competition');
  const statusEl = document.getElementById('td-analysis-status');

  // 프로필 관련도 점수 가져오기 (AI 분석 결과에서)
  const profileRelevance = {};
  try {
    const profileId = window._globalProfileId;
    if (profileId && keywords.length > 0) {
      const relRes = await api('/api/trends/keyword-relevance', {
        method: 'POST',
        body: { profile_id: parseInt(profileId), keywords },
      }).catch(() => null);
      if (relRes?.scores) {
        Object.assign(profileRelevance, relRes.scores);
      }
    }
  } catch {}
  resultDiv.style.display = 'block';
  compDiv.style.display = 'block';
  compDiv.innerHTML = `
    <div style="text-align:center;padding:20px;">
      <div style="display:inline-flex;align-items:center;gap:12px;padding:12px 24px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(3,199,90,0.08));border-radius:12px;">
        <div style="width:32px;height:32px;border:3px solid rgba(255,140,0,0.15);border-top-color:#ff8c00;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
        <div style="text-align:left;">
          <div style="font-size:13px;font-weight:600;color:#1c1c1e;" id="td-analyze-main-status">AI 키워드 분석 중</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.35);" id="td-analyze-sub-status">0/${keywords.length} · 트렌드 키워드 추출 중...</div>
        </div>
      </div>
      <div style="margin-top:12px;height:4px;background:rgba(0,0,0,0.04);border-radius:2px;max-width:300px;margin-left:auto;margin-right:auto;">
        <div id="td-analyze-progress" style="height:100%;background:linear-gradient(90deg,#ff8c00,#34c759);border-radius:2px;width:0%;transition:width 0.3s;"></div>
      </div>
    </div>`;
  tbody.innerHTML = '';

  const results = [];
  for (let i = 0; i < keywords.length; i++) {
    try {
      if (statusEl) statusEl.textContent = `분석 중 ${i+1}/${keywords.length}`;
      const td = tbody.querySelector('td');

      const pct = Math.round(((i + 0.3) / keywords.length) * 100);
      const progressBar = document.getElementById('td-analyze-progress');
      const mainStatus = document.getElementById('td-analyze-main-status');
      const subStatus = document.getElementById('td-analyze-sub-status');
      if (progressBar) progressBar.style.width = pct + '%';
      if (subStatus) subStatus.textContent = `${i+1}/${keywords.length} · "${keywords[i]}" 키워드 추출 중`;

      // AI로 핵심 검색 키워드 추출
      let searchKw = keywords[i];
      try {
        const kwRes = await api(`/api/naver/extract-search-keyword?text=${encodeURIComponent(keywords[i])}`);
        if (kwRes.keyword) searchKw = kwRes.keyword;
      } catch {}

      if (subStatus) subStatus.textContent = `${i+1}/${keywords.length} · "${searchKw}" 블로그 경쟁 분석 중`;
      if (progressBar) progressBar.style.width = Math.round(((i + 0.7) / keywords.length) * 100) + '%';
      const res = await api(`/api/naver/blog-competition?keyword=${encodeURIComponent(searchKw)}`);
      if (res.status === 'ok') {
        res.original_keyword = keywords[i];
        results.push(res);
      }
    } catch {}
  }

  if (statusEl) statusEl.textContent = `${results.length}개 완료`;

  if (results.length === 0) {
    const progressBar = document.getElementById('td-analyze-progress');
    const mainStatus = document.getElementById('td-analyze-main-status');
    const subStatus = document.getElementById('td-analyze-sub-status');
    if (progressBar) progressBar.style.width = '100%';
    if (mainStatus) mainStatus.textContent = '키워드 분석 완료';
    if (subStatus) subStatus.textContent = '분석 가능한 결과가 없습니다.';
    compDiv.innerHTML = `
      <div style="padding:16px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);border-radius:12px;font-size:12px;color:rgba(0,0,0,0.5);line-height:1.6;">
        <div style="font-weight:700;color:#1c1c1e;margin-bottom:4px;">키워드 분석 완료</div>
        <div>이번 목록에서는 경쟁도 결과를 만들 수 없습니다. 잠시 후 새로고침하거나 키워드를 직접 입력해 조회하세요.</div>
      </div>`;
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:rgba(0,0,0,0.35);font-size:12px;">분석 결과가 없습니다. 키워드를 직접 입력해 조회하세요.</td></tr>';
    return;
  }

  // 종합 점수 계산: 기회 점수 × 프로필 관련도
  results.forEach(r => {
    const opportunity = r.monthly_search > 0 ? r.monthly_search / Math.max(r.blog_total, 1) : (r.blog_total < 1000 ? 0.5 : 0.1);
    const relevance = profileRelevance[r.original_keyword || r.keyword] || profileRelevance[r.keyword] || 5;
    r._relevance = relevance;
    r._opportunity = opportunity;
    r._score = opportunity * (relevance / 5); // 관련도가 높으면 점수 올라감
  });
  results.sort((a, b) => b._score - a._score);
  const maxSearch = Math.max(...results.map(r => r.monthly_search || 0), 1);
  const maxBlog = Math.max(...results.map(r => r.blog_total || 0), 1);

  const goodCount = results.filter(r => r.grade === 'A' || r.grade === 'B').length;
  const best = results[0];
  const totalSearch = results.reduce((s, r) => s + (r.monthly_search || 0), 0);

  // 통합 대시보드 요약
  compDiv.style.display = 'block';
  compDiv.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <!-- 최고 추천 키워드 -->
      <div style="flex:2;min-width:200px;padding:16px;background:linear-gradient(135deg,${best.color || '#ff8c00'}15,${best.color || '#ff8c00'}08);border:1px solid ${best.color || '#ff8c00'}30;border-radius:12px;">
        <div style="font-size:10px;color:rgba(0,0,0,0.4);margin-bottom:4px;">최고 기회 키워드</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="width:36px;height:36px;border-radius:10px;background:${best.color || '#ff8c00'};color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;">${best.grade || '-'}</span>
          <div>
            <div style="font-size:16px;font-weight:700;color:#1c1c1e;">${escapeHtml(best.keyword)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.4);">검색량 ${(best.monthly_search||0).toLocaleString()} · 블로그 ${(best.blog_total||0).toLocaleString()}건 · ${best.difficulty||''}</div>
          </div>
          <button onclick="document.getElementById('kc-keyword').value='${escapeHtml(best.keyword)}';document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active'));document.querySelector('[data-page=\\'keyword-content\\']')?.classList.add('active');document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-keyword-content').classList.add('active');toast('키워드 적용!')" style="margin-left:auto;padding:8px 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">바로 글쓰기</button>
        </div>
      </div>
      <!-- 통계 -->
      <div style="flex:1;min-width:120px;display:flex;flex-direction:column;gap:6px;">
        <div style="flex:1;padding:10px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.04);display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;font-weight:800;color:#34c759;">${goodCount}</span>
          <span style="font-size:11px;color:rgba(0,0,0,0.4);">추천 키워드<br>(A/B 등급)</span>
        </div>
        <div style="flex:1;padding:10px 14px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.04);display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;font-weight:800;color:#007aff;">${totalSearch.toLocaleString()}</span>
          <span style="font-size:11px;color:rgba(0,0,0,0.4);">총 월간<br>검색량</span>
        </div>
      </div>
    </div>
    <!-- 등급 분포 바 -->
    <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:1px;">
      ${['A','B','C','D','F'].map(g => {
        const cnt = results.filter(r => r.grade === g).length;
        const colors = {A:'#34c759',B:'#30d158',C:'#ff9500',D:'#ff3b30',F:'#ff453a'};
        return cnt > 0 ? `<div style="flex:${cnt};background:${colors[g]};"></div>` : '';
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      ${['A','B','C','D','F'].map(g => {
        const cnt = results.filter(r => r.grade === g).length;
        const colors = {A:'#34c759',B:'#30d158',C:'#ff9500',D:'#ff3b30',F:'#ff453a'};
        return `<span style="font-size:9px;color:${colors[g]};">${g}: ${cnt}</span>`;
      }).join('')}
    </div>`;

  // 테이블
  tbody.innerHTML = results.map((r, i) => {
    const isGood = r.grade === 'A' || r.grade === 'B';
    const searchBar = Math.round((r.monthly_search || 0) / maxSearch * 100);
    const blogBar = Math.round((r.blog_total || 0) / maxBlog * 100);
    return `
    <tr style="border-bottom:1px solid rgba(0,0,0,0.03);${isGood ? 'background:rgba(52,199,89,0.03);' : ''}">
      <td style="padding:10px 16px;">
        <div style="display:flex;align-items:center;gap:8px;">
          ${isGood ? '<span style="width:6px;height:6px;border-radius:50%;background:#34c759;flex-shrink:0;"></span>' : '<span style="width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,0.1);flex-shrink:0;"></span>'}
          <div>
            <span style="font-weight:600;color:#1c1c1e;">${escapeHtml(r.keyword)}</span>
            ${r.original_keyword && r.original_keyword !== r.keyword ? `<div style="font-size:10px;color:rgba(0,0,0,0.3);">${escapeHtml(r.original_keyword)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:10px 8px;text-align:right;">
        <div style="font-weight:600;color:#ff8c00;font-size:12px;">${(r.monthly_search || 0).toLocaleString()}</div>
        <div style="height:3px;background:rgba(0,0,0,0.04);border-radius:2px;margin-top:3px;width:80px;margin-left:auto;"><div style="height:100%;background:#ff8c00;border-radius:2px;width:${searchBar}%;"></div></div>
      </td>
      <td style="padding:10px 8px;text-align:right;">
        <div style="color:rgba(0,0,0,0.5);font-size:12px;">${(r.blog_total || 0).toLocaleString()}</div>
        <div style="height:3px;background:rgba(0,0,0,0.04);border-radius:2px;margin-top:3px;width:80px;margin-left:auto;"><div style="height:100%;background:${r.color || '#999'};border-radius:2px;width:${blogBar}%;"></div></div>
      </td>
      <td style="padding:10px 8px;text-align:center;">
        <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:${r.color || '#999'};color:#fff;font-size:12px;font-weight:800;line-height:28px;text-align:center;">${r.grade || '-'}</span>
      </td>
      <td style="padding:10px 8px;font-size:11px;color:${r.color || '#999'};font-weight:500;">${r.difficulty || ''}</td>
      <td style="padding:10px 8px;text-align:center;">
        ${r._relevance >= 8 ? `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:rgba(255,140,0,0.1);color:#ff8c00;">${r._relevance}/10</span>` : r._relevance >= 5 ? `<span style="padding:2px 8px;border-radius:10px;font-size:10px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.4);">${r._relevance}/10</span>` : `<span style="font-size:10px;color:rgba(0,0,0,0.2);">${r._relevance}/10</span>`}
      </td>
      <td style="padding:10px 16px;">
        <button onclick="document.getElementById('kc-keyword').value='${escapeHtml(r.keyword)}';document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active'));document.querySelector('[data-page=\\'keyword-content\\']')?.classList.add('active');document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-keyword-content').classList.add('active');toast('키워드 적용: ${escapeHtml(r.keyword)}')" style="padding:5px 12px;font-size:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">사용</button>
      </td>
    </tr>`;
  }).join('');
}

async function tdSearchVolume() {
  const keyword = document.getElementById('td-search-vol-keyword').value.trim();
  if (!keyword) { toast('키워드를 입력하세요', 'error'); return; }
  const btn = document.getElementById('td-search-vol-btn');
  btn.disabled = true; btn.textContent = '조회 중...';
  try {
    // 검색량 + 블로그 경쟁 강도 동시 조회
    const [volRes, compRes] = await Promise.all([
      api(`/api/naver/search-volume?keyword=${encodeURIComponent(keyword)}`).catch(() => null),
      api(`/api/naver/blog-competition?keyword=${encodeURIComponent(keyword)}`).catch(() => null),
    ]);

    const tbody = document.getElementById('td-search-vol-tbody');
    const resultDiv = document.getElementById('td-search-vol-result');
    const emptyDiv = document.getElementById('td-search-vol-empty');
    const compDiv = document.getElementById('td-blog-competition');

    // 블로그 경쟁 강도 표시
    if (compRes && compRes.status === 'ok') {
      compDiv.style.display = 'block';
      compDiv.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <div style="text-align:center;">
            <div style="width:56px;height:56px;border-radius:50%;background:${compRes.color || '#999'};display:flex;align-items:center;justify-content:center;margin:0 auto 4px;">
              <span style="color:#fff;font-size:22px;font-weight:800;">${compRes.grade || '-'}</span>
            </div>
            <div style="font-size:11px;font-weight:600;color:${compRes.color || '#999'};">${compRes.difficulty || ''}</div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:13px;font-weight:600;color:#1c1c1e;margin-bottom:6px;">"${escapeHtml(keyword)}" 블로그 경쟁 분석</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.8;">
              월간 검색량: <b style="color:#ff8c00;">${(compRes.monthly_search || 0).toLocaleString()}</b>${compRes.matched_keyword && compRes.matched_keyword !== keyword ? ` <span style="font-size:10px;color:rgba(0,0,0,0.3);">(${compRes.matched_keyword})</span>` : ''} ·
              블로그 글 수: <b>${(compRes.blog_total || 0).toLocaleString()}</b>건 ·
              웹문서: <b>${(compRes.web_total || 0).toLocaleString()}</b>건
              ${compRes.saturation ? `<br>포화도: ${compRes.saturation} (블로그÷검색량) · 기회점수: ${compRes.opportunity}` : ''}
            </div>
            <div style="font-size:12px;color:${compRes.color || '#999'};margin-top:4px;font-weight:500;">${compRes.description || ''}</div>
          </div>
        </div>`;
    } else {
      compDiv.style.display = 'none';
    }

    // 검색량 테이블
    if (volRes?.results?.length > 0) {
      resultDiv.style.display = 'block';
      emptyDiv.style.display = 'none';
      // 검색량 높고 경쟁도 낮은 순으로 정렬 (기회 점수)
      const sorted = volRes.results.map(r => ({
        ...r,
        score: r.competition === '낮음' ? 3 : r.competition === '중간' ? 2 : 1,
      })).sort((a, b) => (b.total_monthly * b.score) - (a.total_monthly * a.score));

      tbody.innerHTML = sorted.map(r => {
        const isGood = r.total_monthly >= 100 && r.competition !== '높음';
        return `
        <tr style="border-bottom:1px solid rgba(0,0,0,0.04);${isGood ? 'background:rgba(52,199,89,0.04);' : ''}">
          <td style="padding:8px;font-weight:500;">${isGood ? '<span style="color:#34c759;font-size:10px;">★</span> ' : ''}${escapeHtml(r.keyword)}</td>
          <td style="padding:8px;text-align:right;color:rgba(0,0,0,0.5);">${(r.pc_monthly || 0).toLocaleString()}</td>
          <td style="padding:8px;text-align:right;color:rgba(0,0,0,0.5);">${(r.mobile_monthly || 0).toLocaleString()}</td>
          <td style="padding:8px;text-align:right;font-weight:700;color:#ff8c00;">${(r.total_monthly || 0).toLocaleString()}</td>
          <td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${r.competition==='높음'?'rgba(255,59,48,0.1);color:#ff3b30':r.competition==='중간'?'rgba(255,149,0,0.1);color:#ff9500':'rgba(52,199,89,0.1);color:#34c759'};">${r.competition || '-'}</span></td>
          <td style="padding:8px;"><button onclick="document.getElementById('kc-keyword').value='${escapeHtml(r.keyword)}';document.querySelectorAll('.sidebar nav a').forEach(a=>a.classList.remove('active'));document.querySelector('[data-page=\\'keyword-content\\']')?.classList.add('active');document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-keyword-content').classList.add('active');toast('키워드 적용: ${escapeHtml(r.keyword)}')" style="padding:3px 8px;font-size:10px;background:#ff8c00;color:#fff;border:none;border-radius:4px;cursor:pointer;">사용</button></td>
        </tr>`;
      }).join('');
    } else {
      resultDiv.style.display = 'none';
      emptyDiv.style.display = 'block';
      emptyDiv.textContent = volRes ? '검색 결과가 없습니다' : '검색량 조회에 실패했습니다. 잠시 후 다시 시도하세요';
    }
  } catch (e) {
    document.getElementById('td-search-vol-result').style.display = 'none';
    document.getElementById('td-search-vol-empty').style.display = 'block';
    document.getElementById('td-search-vol-empty').textContent = e.message;
  }
  btn.disabled = false; btn.textContent = '검색량 조회';
}

// 트렌드 캐시 (12시간)
const _TREND_CACHE_KEY = 'makeke_trend_cache';
const _TREND_CACHE_TTL = 12 * 60 * 60 * 1000; // 12시간

function _getTrendCache() {
  try {
    const raw = localStorage.getItem(_TREND_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp < _TREND_CACHE_TTL) return cached.data;
    localStorage.removeItem(_TREND_CACHE_KEY);
  } catch {}
  return null;
}

function _setTrendCache(data) {
  try {
    localStorage.setItem(_TREND_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function tdSetDashboardCacheGuide(data, options = {}) {
  const fetchedEl = document.getElementById('td-fetched-at');
  const guideEl = document.getElementById('td-cache-guide');
  const fetchedAt = String(data?.fetched_at || '').trim() || new Date().toLocaleString('ko-KR');
  const cacheAge = _getTrendCacheAge();
  const usedCache = !!options.usedCache;
  const refreshed = !!options.refreshed;

  if (fetchedEl) {
    fetchedEl.textContent = usedCache
      ? `자료 시각: ${fetchedAt} · 캐시`
      : `자료 시각: ${fetchedAt} · 최신 수집`;
  }
  if (guideEl) {
    guideEl.textContent = usedCache
      ? `${fetchedAt} 기준 자료입니다.`
      : `${fetchedAt} 기준 최신 자료를 수집했습니다.`;
  }
}

async function loadTrendDashboard(forceRefresh = false) {
  // 새로고침이면 분석 플래그 리셋
  if (forceRefresh) window._trendAnalysisDone = false;

  // 캐시 비활성화 — 항상 최신 자료를 새로 수집
  localStorage.removeItem(_TREND_CACHE_KEY);

  // 이전 요청 중단
  if (window._trendAbort) window._trendAbort.abort();
  window._trendAbort = new AbortController();
  const _trendSignal = window._trendAbort.signal;

  // 프로필 드롭다운 동기화
  const tdSel = document.getElementById('td-ai-profile');
  if (tdSel && window._globalProfileId) {
    // 옵션이 아직 안 로드됐으면 로드
    if (tdSel.options.length <= 1) await loadAiProfiles();
    tdSel.value = window._globalProfileId;
  }

  const refreshBtn = document.getElementById('td-refresh-btn');
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = '0.7';
  refreshBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span> 수집 중...';

  // 상단 알림 (lockScreen 활용)
  const _tdCollectTaskId = lockScreen('트렌드 수집 중', '실시간 검색어 + 뉴스 · 잠시만 기다려주세요', 'trend-collect');

  // 수집 로그 단계 정의
  const logSteps = [
    { icon: '🔍', text: '국내 급상승 검색어 수집 중...' },
    { icon: '🌐', text: '글로벌 트렌드 수집 중...' },
    { icon: '📱', text: '실시간 검색어 수집 중...' },
    { icon: '🟢', text: '추가 급상승 검색어 수집 중...' },
    { icon: '📰', text: '메인 키워드 수집 중...' },
    { icon: '📊', text: '인기 뉴스에서 추가 키워드 추출 중...' },
    { icon: '🏷️', text: '카테고리별 뉴스 수집 중...' },
    { icon: '🌍', text: '글로벌 뉴스 수집 중...' },
    { icon: '✨', text: '데이터 정리 및 중복 제거...' },
  ];

  // 로그 컨테이너 설정
  const logCard = document.getElementById('td-collect-log-card');
  const logContainer = document.getElementById('td-trends-list');
  logCard.style.display = 'block';
  
  // 통합 로그 HTML 생성
  const createLogHTML = (idSuffix) => `
    <div id="td-collect-log${idSuffix}" style="padding:24px;background:#ffffff;border-radius:16px;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px;line-height:1.8;position:relative;overflow:hidden;border:1px solid rgba(0,0,0,0.08);box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#007aff,#af52de,#ff3b30,#ff9500,#34c759,#007aff);background-size:200% 100%;animation:gradientSlide 2s linear infinite;"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:16px;">🛰️</span>
        <span style="color:rgba(0,0,0,0.87);font-weight:700;font-size:14px;">실시간 트렌드 수집</span>
        <span id="td-collect-counter${idSuffix}" style="margin-left:auto;color:rgba(0,0,0,0.38);font-size:11px;">0/${logSteps.length}</span>
      </div>
      <div id="td-log-steps${idSuffix}"></div>
    </div>
    <style>@keyframes gradientSlide{0%{background-position:0% 50%}100%{background-position:200% 50%}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;

  logCard.innerHTML = createLogHTML('');
  logContainer.innerHTML = createLogHTML('-mobile');

  const logEl = document.getElementById('td-log-steps');
  const logElMobile = document.getElementById('td-log-steps-mobile');

  // 모든 로그 단계를 먼저 표시 (수집중 상태)
  logSteps.forEach((step, i) => {
    const createStepHTML = (isMobile) => `
      <div id="td-step-line${isMobile ? '-mobile' : ''}-${i}" style="opacity:0;transform:translateX(-10px);transition:all 0.3s ease;display:flex;align-items:center;gap:${isMobile ? '8px' : '10px'};padding:${isMobile ? '3px 0' : '6px 10px'};${isMobile ? '' : 'border-radius:8px;margin-bottom:2px;'}">
        <span id="td-step-dot${isMobile ? '-mobile' : ''}-${i}" style="width:${isMobile ? '6px' : '8px'};height:${isMobile ? '6px' : '8px'};border-radius:50%;background:#ff9500;animation:pulse 1s infinite;flex-shrink:0;"></span>
        <span style="font-size:${isMobile ? '13px' : '15px'};">${step.icon}</span>
        <span style="color:rgba(255,255,255,${isMobile ? '0.6' : '0.7'});flex:1;font-size:${isMobile ? '11px' : 'inherit'};">${step.text}</span>
        <span id="td-step-status${isMobile ? '-mobile' : ''}-${i}" style="color:#ff9500;font-size:10px;font-weight:600;">대기</span>
      </div>`;

    if (logEl) logEl.insertAdjacentHTML('beforeend', createStepHTML(false));
    if (logElMobile) logElMobile.insertAdjacentHTML('beforeend', createStepHTML(true));

    // 순차적으로 표시 애니메이션
    setTimeout(() => {
      const line = document.getElementById(`td-step-line-${i}`);
      const lineMobile = document.getElementById(`td-step-line-mobile-${i}`);
      if (line) { line.style.opacity = '1'; line.style.transform = 'none'; line.style.background = 'rgba(255,255,255,0.03)'; }
      if (lineMobile) { lineMobile.style.opacity = '1'; lineMobile.style.transform = 'none'; }
    }, i * 100);
  });

  // 뉴스 영역에 로그 동적 생성 (라이트)
  const newsContainer = document.getElementById('td-category-content');
  if (newsContainer) {
    newsContainer.innerHTML = `
      <div style="padding:16px 20px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);border-radius:12px;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:11px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span>📰</span><span style="color:#1c1c1e;font-weight:600;font-size:12px;">카테고리별 뉴스 수집 중</span>
        </div>
        <div id="td-news-init-log"></div>
      </div>`;
  }
  const newsLogEl = document.getElementById('td-news-init-log');
  const newsCategories = [
    { icon: '🎬', text: '연예 뉴스' },
    { icon: '⚽', text: '스포츠 뉴스' },
    { icon: '🏛️', text: '정치 뉴스' },
    { icon: '📈', text: '경제 뉴스' },
    { icon: '💻', text: 'IT/테크 뉴스' },
    { icon: '🏠', text: '생활/문화 뉴스' },
    { icon: '🌐', text: '글로벌 Tech' },
    { icon: '🌍', text: '글로벌 Business' },
    { icon: '🤖', text: '글로벌 AI' },
  ];
  
  if (newsLogEl) {
    newsLogEl.innerHTML = '';
    newsCategories.forEach((cat, i) => {
      const line = document.createElement('div');
      line.style.cssText = 'opacity:0;transform:translateX(-10px);transition:all 0.3s ease;display:flex;align-items:center;gap:8px;padding:3px 6px;';
      line.innerHTML = `<span id="td-news-dot-${i}" style="width:6px;height:6px;border-radius:50%;background:#ff9500;animation:pulse 0.8s infinite;flex-shrink:0;"></span><span>${cat.icon}</span><span style="color:rgba(0,0,0,0.6);">${cat.text}</span><span id="td-news-status-${i}" style="margin-left:auto;color:#ff9500;font-size:10px;">수집중</span>`;
      newsLogEl.appendChild(line);
      setTimeout(() => { line.style.opacity = '1'; line.style.transform = 'none'; }, i * 80);
    });
  }

  let completedSteps = 0;
  const totalSteps = logSteps.length + newsCategories.length;

  // 단계 완료 표시 함수
  const markStepComplete = (index, isNews = false) => {
    const prefix = isNews ? 'td-news' : 'td-step';
    const dot = document.getElementById(`${prefix}-dot-${index}`);
    const status = document.getElementById(`${prefix}-status-${index}`);
    const dotMobile = document.getElementById(`${prefix}-dot-mobile-${index}`);
    const statusMobile = document.getElementById(`${prefix}-status-mobile-${index}`);
    
    if (dot) { dot.style.background = '#34c759'; dot.style.animation = 'none'; }
    if (status) { status.textContent = '✓'; status.style.color = '#34c759'; }
    if (dotMobile) { dotMobile.style.background = '#34c759'; dotMobile.style.animation = 'none'; }
    if (statusMobile) { statusMobile.textContent = '✓'; statusMobile.style.color = '#34c759'; }
    
    completedSteps++;
    const counter = document.getElementById('td-collect-counter');
    const counterMobile = document.getElementById('td-collect-counter-mobile');
    if (counter) counter.textContent = `${completedSteps}/${totalSteps}`;
    if (counterMobile) counterMobile.textContent = `${completedSteps}/${totalSteps}`;
  };

  // 단계 진행 중 표시 함수
  const markStepInProgress = (index, isNews = false) => {
    const prefix = isNews ? 'td-news' : 'td-step';
    const status = document.getElementById(`${prefix}-status-${index}`);
    const statusMobile = document.getElementById(`${prefix}-status-mobile-${index}`);
    if (status) { status.textContent = '수집중...'; status.style.color = '#ff9500'; }
    if (statusMobile) { statusMobile.textContent = '수집중...'; statusMobile.style.color = '#ff9500'; }
  };

  try {
    // 수집 중 단계별 진행 애니메이션 시작
    let stepInterval = setInterval(() => {
      for (let si = 0; si < logSteps.length; si++) {
        const dot = document.getElementById(`td-step-dot-${si}`);
        if (dot && dot.style.background !== 'rgb(52, 199, 89)') {
          markStepInProgress(si);
          setTimeout(() => markStepComplete(si), 800 + Math.random() * 1200);
          break;
        }
      }
    }, 1500);

    // 뉴스 카테고리는 실제 응답 개수로 완료 처리한다.
    newsCategories.forEach((_, ni) => {
      setTimeout(() => {
        markStepInProgress(ni, true);
      }, 1200 + ni * 250);
    });

    const res = await api(`/api/trends/dashboard?refresh=${forceRefresh}`, { signal: _trendSignal });
    clearInterval(stepInterval);
    _trendDashboardData = res.data;
    window._trendDashboardData = res.data;
    _setTrendCache(res.data);

    // 핵심 단계 완료 표시
    logSteps.forEach((_, i) => markStepComplete(i));
    // 카테고리 뉴스는 실제 수집 결과 수로 완료 표시
    const catKeyMap = ['entertainment','sports','politics','economy','tech','lifestyle','global_tech','global_business','global_ai'];
    catKeyMap.forEach((catKey, i) => {
      const catNews = res.data?.category_news?.[catKey]?.news || [];
      const status = document.getElementById(`td-news-status-${i}`);
      const statusMobile = document.getElementById(`td-news-status-mobile-${i}`);
      markStepComplete(i, true);
      if (status) status.textContent = `${catNews.length}건`;
      if (statusMobile) statusMobile.textContent = `${catNews.length}건`;
    });

    // 시간 표시
    tdSetDashboardCacheGuide(res.data, { usedCache: false, refreshed: forceRefresh });

    // 급상승 검색어 저장
    const _naverT = (res.data.naver_trends || []).map(t => ({...t, source: 'naver'}));
    const _googleT = (res.data.google_trends || []).map(t => ({...t, source: 'google'}));
    // 중복 제거 (줌 키워드가 구글에도 있으면 구글 쪽 제거)
    const _naverKeywords = new Set(_naverT.map(t => t.keyword));
    const _googleFiltered = _googleT.filter(t => !_naverKeywords.has(t.keyword));
    window._trendKr = [..._naverT, ..._googleFiltered].map((t, i) => ({...t, rank: i + 1}));
    window._trendGlobal = (res.data.global_trends || []).map(t => ({...t, source: 'google_us'}));

    // 수집 완료 → 로그 카드 바로 숨기기
    setTimeout(() => {
      const lc = document.getElementById('td-collect-log-card');
      if (lc) { lc.style.transition = 'all 0.5s ease'; lc.style.opacity = '0'; lc.style.maxHeight = '0'; lc.style.overflow = 'hidden'; lc.style.marginBottom = '0'; lc.style.padding = '0'; }
    }, 1500);

    renderGoogleTrends(window._trendKr);

    // 실시간 검색어 태그
    if (window._trendKr?.length > 0) {
      const quickDiv = document.getElementById('td-quick-keywords');
      if (quickDiv) {
        quickDiv.innerHTML = window._trendKr.slice(0, 20).map((t, i) =>
          `<button onclick="document.getElementById('td-search-vol-keyword').value='${escapeHtml(t.keyword)}';tdSearchVolume();" style="padding:4px 10px;font-size:11px;background:${i<3?'rgba(255,59,48,0.08)':i<7?'rgba(255,140,0,0.06)':'rgba(0,0,0,0.03)'};color:${i<3?'#ff3b30':i<7?'#ff8c00':'rgba(0,0,0,0.5)'};border:1px solid ${i<3?'rgba(255,59,48,0.15)':i<7?'rgba(255,140,0,0.12)':'rgba(0,0,0,0.06)'};border-radius:14px;cursor:pointer;white-space:nowrap;font-weight:${i<3?'600':'400'};">
            <span style="font-size:9px;opacity:0.6;">${i+1}</span> ${escapeHtml(t.keyword)}
          </button>`
        ).join('');
      }
    }

    // 카테고리 뉴스 렌더링
    renderCategoryNews(_currentNewsCategory);

    // === 통합 분석 시작: AI 프로필 분석 + 블로그 경쟁 분석 동시 실행 (세션당 1회) ===
    const activeProfileId = window._globalProfileId || document.getElementById('td-ai-profile')?.value;
    window._trendAnalysisDone = true;
    tdRunBackgroundAnalyses(activeProfileId);

  } catch (e) {
    if (e.name === 'AbortError') { console.log('[트렌드 수집] 사용자에 의해 중단됨'); return; }
    console.error('트렌드 로딩 실패:', e);
    const errDetail = e.traceback || e.stack || e.message || '알 수 없는 오류';
    document.getElementById('td-trends-list').innerHTML =
      `<div style="text-align:center;padding:30px;">
        <div style="color:#ff3b30;font-weight:600;margin-bottom:8px;">트렌드 로딩 실패</div>
        <div style="color:rgba(0,0,0,0.4);font-size:13px;margin-bottom:12px;">${escapeHtml(e.message)}</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="loadTrendDashboard()" style="display:inline-flex;align-items:center;gap:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 시도
          </button>
          <button class="btn btn-sm" onclick="_trendQuickReport()" id="td-quick-report-btn" style="padding:6px 14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">바로 문의 보내기</button>
        </div>
        <details style="margin-top:12px;text-align:left;">
          <summary style="cursor:pointer;font-size:11px;color:rgba(0,0,0,0.3);">에러 상세</summary>
          <pre style="font-size:10px;color:rgba(0,0,0,0.4);background:rgba(0,0,0,0.03);padding:8px;border-radius:6px;margin-top:6px;white-space:pre-wrap;word-break:break-all;max-height:150px;overflow:auto;">${escapeHtml(errDetail)}</pre>
        </details>
      </div>`;
    // 에러 패널에도 기록 (바로 문의 보내기 연동)
    if (typeof _showErrorPanel === 'function') {
      _showErrorPanel('[트렌드] ' + e.message, 'server', '', errDetail);
    }
    const logCard = document.getElementById('td-collect-log-card');
    if (logCard) logCard.style.display = 'none';
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = '1';
    refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> 새로고침`;
    // 상단 알림 해제
    unlockScreen('trend-collect');
    toast('트렌드 수집 완료!');
  }
}

// 캐시에서 트렌드 렌더링
function _renderTrendFromCache(data) {
  tdSetDashboardCacheGuide(data, { usedCache: true });

  // 급상승 검색어
  const _naverT = (data.naver_trends || []).map(t => ({...t, source: 'naver'}));
  const _googleT = (data.google_trends || []).map(t => ({...t, source: 'google'}));
  const _naverKeywords = new Set(_naverT.map(t => t.keyword));
  const _googleFiltered = _googleT.filter(t => !_naverKeywords.has(t.keyword));
  window._trendKr = [..._naverT, ..._googleFiltered].map((t, i) => ({...t, rank: i + 1}));
  window._trendGlobal = (data.global_trends || []).map(t => ({...t, source: 'google_us'}));

  // 로그 카드 숨기기
  const logCard = document.getElementById('td-collect-log-card');
  if (logCard) logCard.style.display = 'none';

  renderGoogleTrends(window._trendKr);

  // 실시간 검색어 태그
  if (window._trendKr?.length > 0) {
    const quickDiv = document.getElementById('td-quick-keywords');
    if (quickDiv) {
      quickDiv.innerHTML = window._trendKr.slice(0, 20).map((t, i) =>
        `<button onclick="document.getElementById('td-search-vol-keyword').value='${escapeHtml(t.keyword)}';tdSearchVolume();" style="padding:4px 10px;font-size:11px;background:${i<3?'rgba(255,59,48,0.08)':i<7?'rgba(255,140,0,0.06)':'rgba(0,0,0,0.03)'};color:${i<3?'#ff3b30':i<7?'#ff8c00':'rgba(0,0,0,0.5)'};border:1px solid ${i<3?'rgba(255,59,48,0.15)':i<7?'rgba(255,140,0,0.12)':'rgba(0,0,0,0.06)'};border-radius:14px;cursor:pointer;white-space:nowrap;font-weight:${i<3?'600':'400'};">
            <span style="font-size:9px;opacity:0.6;">${i+1}</span> ${escapeHtml(t.keyword)}
          </button>`
      ).join('');
    }
  }

  // 카테고리 뉴스
  renderCategoryNews(_currentNewsCategory);

  // AI 분석은 세션당 1번만 실행
  if (!window._trendAnalysisDone) {
    const activeProfileId = window._globalProfileId || document.getElementById('td-ai-profile')?.value;
    if (activeProfileId) {
      window._trendAnalysisDone = true;
      tdRunBackgroundAnalyses(activeProfileId);
    }
  }

  const refreshBtn = document.getElementById('td-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = '1';
    refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> 새로고침`;
  }
}

function _getTrendCacheAge() {
  try {
    const raw = localStorage.getItem(_TREND_CACHE_KEY);
    if (!raw) return '';
    const cached = JSON.parse(raw);
    const diff = Date.now() - cached.timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 ${mins % 60}분`;
  } catch { return ''; }
}

// ═══ 프로필 기반 AI 관련도 정렬 ═══
async function sortTrendsByProfile(profileId) {
  if (!window._trendKr?.length) return;

  // 이전 분석 요청 중단
  if (window._trendAnalyzeAbort) window._trendAnalyzeAbort.abort();
  window._trendAnalyzeAbort = new AbortController();
  const signal = window._trendAnalyzeAbort.signal;

  // AI 분석 카드에 정렬 중 표시
  const aiContent = document.getElementById('td-ai-content');
  aiContent.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:16px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.1);border-radius:12px;">
      <span class="spinner" style="width:18px;height:18px;border-top-color:#ff8c00;"></span>
      <div><div style="font-size:13px;font-weight:600;color:#ff8c00;">트렌드 분석 중</div><div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px;">프로필에 맞는 키워드를 찾고 있습니다 · 잠시만 기다려주세요</div></div>
    </div>`;

  // 상단 알림
  lockScreen('AI 트렌드 분석 중', '프로필 맞춤 키워드 분석 중...', 'trend-analyze');
  if (typeof kcStartCodexLogPolling === 'function') {
    kcStartCodexLogPolling();
  }

  try {
    const res = await api('/api/trends/sort-by-profile', {
      method: 'POST',
      body: {
        profile_id: parseInt(profileId || 0),
        trends: window._trendKr.slice(0, 12),
        news: _trendDashboardData?.category_news || {},
      },
      signal,
    });

    const profileName = res.profile_name || '내 브랜드';
    if (res.fallback_used) {
      toast('AI 응답이 지연되어 기본 추천 순서로 먼저 보여줍니다.');
    }

    // 관련 트렌드가 있으면 상단에 "내 브랜드 맞춤" 섹션 표시
    if (res.sorted_trends?.length) {
      window._profileSortedTrends = res.sorted_trends;
      renderProfileTrends(res.sorted_trends, profileName);
    }

    // 관련 뉴스가 있으면 AI 카드에 표시
    const allNews = [];
    for (const [cat, data] of Object.entries(res.sorted_news || {})) {
      for (const n of data.news || []) {
        allNews.push({...n, category: cat});
      }
    }
    allNews.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

    if (allNews.length) {
      let newsHtml = `
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:#1c1c1e;">${escapeHtml(profileName)} 맞춤 뉴스</span>
          <span style="font-size:11px;color:rgba(0,0,0,0.35);">${allNews.length}건</span>
        </div>`;
      // 뉴스 데이터를 전역에 저장 (onclick에서 참조)
      window._tdCustomNews = allNews.slice(0, 10);
      window._tdCustomNews.forEach((n, idx) => {
        const scoreColor = n.relevance_score >= 10 ? '#ff3b30' : n.relevance_score >= 8 ? '#ff8c00' : n.relevance_score >= 6 ? '#fbbf24' : 'rgba(0,0,0,0.15)';
        const scoreTxt = n.relevance_score >= 8 ? '#fff' : n.relevance_score >= 6 ? '#1c1c1e' : '#666';
        const catNames = {entertainment:'연예',sports:'스포츠',politics:'정치',economy:'경제',tech:'IT',lifestyle:'생활'};
        newsHtml += `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(0,0,0,0.02);border-radius:10px;margin-bottom:6px;transition:all 0.25s;cursor:pointer;"
               onmouseenter="this.style.background='rgba(255,140,0,0.07)';this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 16px rgba(255,140,0,0.1)';this.querySelector('.td-hover-hint').style.opacity='1';this.querySelector('.td-hover-hint').style.transform='translateX(0)'"
               onmouseleave="this.style.background='rgba(0,0,0,0.02)';this.style.transform='scale(1)';this.style.boxShadow='none';this.querySelector('.td-hover-hint').style.opacity='0';this.querySelector('.td-hover-hint').style.transform='translateX(8px)'"
               onclick="event.stopPropagation();tdPickNews(${idx})">
            <span style="min-width:36px;width:36px;height:36px;border-radius:50%;background:${scoreColor};color:${scoreTxt};font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${n.relevance_score}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;color:#1c1c1e;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n.title)}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px;">${catNames[n.category]||n.category}${n.relevance_reason ? ' · ' + escapeHtml(n.relevance_reason) : ''}</div>
            </div>
            <span class="td-hover-hint" style="opacity:0;transform:translateX(8px);transition:all 0.25s;flex-shrink:0;font-size:13px;color:#fff;font-weight:700;white-space:nowrap;background:#ff8c00;padding:6px 14px;border-radius:8px;">글 쓰기 →</span>
          </div>`;
      });
      if (res.fallback_used) {
        newsHtml = `
          <div style="margin-bottom:10px;padding:10px 12px;border-radius:10px;background:rgba(255,149,0,0.08);border:1px solid rgba(255,149,0,0.14);font-size:12px;font-weight:700;color:#ff8c00;">
            AI 응답이 지연되어 기본 추천 순서로 먼저 표시 중입니다.
          </div>
        ` + newsHtml;
      }
      aiContent.innerHTML = newsHtml;
    } else {
      aiContent.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.35);font-size:13px;">${res.fallback_used ? 'AI 응답이 지연되어 기본 추천으로도 표시할 뉴스가 없습니다.' : '프로필과 직접 관련된 뉴스가 없습니다.'}</div>`;
    }

  } catch (e) {
    if (e.name === 'AbortError') {
      console.log('[트렌드 분석] 사용자에 의해 중단됨');
      return;
    }
    console.error('프로필 정렬 실패:', e);
    aiContent.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.35);font-size:13px;">AI 정렬 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    unlockScreen('trend-analyze');
  }
}

function renderProfileTrends(sortedTrends, profileName) {
  const container = document.getElementById('td-trends-list');

  // 기존 일반 트렌드
  const existingHtml = container.innerHTML;

  // 프로필 맞춤 트렌드를 상단에 추가
  let html = `
    <div style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </span>
        <span style="font-size:14px;font-weight:700;color:#1c1c1e;">${escapeHtml(profileName)} 관심 트렌드</span>
        <span style="font-size:11px;color:rgba(0,0,0,0.3);margin-left:4px;">${sortedTrends.length}건</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px;">`;

  sortedTrends.forEach((t, idx) => {
    const scoreColor = t.relevance_score >= 10 ? '#ff3b30' : t.relevance_score >= 8 ? '#ff8c00' : t.relevance_score >= 6 ? '#fbbf24' : 'rgba(0,0,0,0.15)';
    const scoreTxt = t.relevance_score >= 8 ? '#fff' : t.relevance_score >= 6 ? '#1c1c1e' : '#666';
    const newsHtml = (t.related_news || []).slice(0, 2).map(n =>
      `<a href="${escapeHtml(n.url)}" target="_blank" style="display:block;font-size:11px;color:rgba(0,0,0,0.35);text-decoration:none;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          onmouseenter="this.style.color='#ff8c00'" onmouseleave="this.style.color='rgba(0,0,0,0.35)'">${escapeHtml(n.title)}</a>`
    ).join('');

    html += `
      <div style="background:#fff;border:1.5px solid rgba(255,140,0,0.15);border-radius:14px;padding:14px 16px;transition:all 0.25s;cursor:pointer;"
           onmouseenter="this.style.boxShadow='0 8px 24px rgba(255,140,0,0.15)';this.style.transform='scale(1.02)';this.querySelector('.td-hover-hint').style.opacity='1';this.querySelector('.td-hover-hint').style.transform='translateX(0)'"
           onmouseleave="this.style.boxShadow='none';this.style.transform='scale(1)';this.querySelector('.td-hover-hint').style.opacity='0';this.querySelector('.td-hover-hint').style.transform='translateX(8px)'"
           onclick="event.stopPropagation();startBlogFromTrendKeyword('${escapeHtml(t.keyword).replace(/'/g,"\\'")}')">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="min-width:36px;width:36px;height:36px;border-radius:50%;background:${scoreColor};color:${scoreTxt};font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${t.relevance_score}</span>
          <div style="flex:1;min-width:0;">
            <span style="font-size:14px;font-weight:600;color:#1c1c1e;">${escapeHtml(t.keyword)}</span>
            ${t.relevance_reason ? `<div style="font-size:11px;color:rgba(255,140,0,0.7);margin-top:2px;">${escapeHtml(t.relevance_reason)}</div>` : ''}
          </div>
          ${t.traffic ? `<span style="font-size:10px;color:rgba(0,0,0,0.2);">${escapeHtml(t.traffic)}</span>` : ''}
          <span class="td-hover-hint" style="opacity:0;transform:translateX(8px);transition:all 0.25s;flex-shrink:0;font-size:13px;color:#fff;font-weight:700;white-space:nowrap;background:#ff8c00;padding:6px 14px;border-radius:8px;">글 쓰기 →</span>
        </div>
        ${newsHtml}
      </div>`;
  });

  html += '</div></div>';

  // 구분선 + 전체 트렌드
  html += `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
      <div style="flex:1;height:1px;background:rgba(0,0,0,0.06);"></div>
      <span style="font-size:12px;color:rgba(0,0,0,0.25);font-weight:500;">전체 트렌드</span>
      <div style="flex:1;height:1px;background:rgba(0,0,0,0.06);"></div>
    </div>`;

  container.innerHTML = html + existingHtml;
}

// 트렌드 페이지 프로필 변경 → 전역 동기화 + 자동 정렬
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const sel = document.getElementById('td-ai-profile');
    if (sel) {
      sel.addEventListener('change', () => {
        // 전역 프로필 동기화
        setGlobalProfile(sel.value, true);
        const gSel = document.getElementById('global-profile-select');
        if (gSel) gSel.value = sel.value || '';
        if (sel.value && window._trendKr?.length) {
          sortTrendsByProfile(sel.value);
        }
      });
    }
  }, 1000);
});

function switchTrendTab(tab) {
  document.getElementById('trend-tab-kr').style.background = tab === 'kr' ? '#ff6b9d' : 'transparent';
  document.getElementById('trend-tab-kr').style.color = tab === 'kr' ? '#fff' : '#6b7f8e';
  document.getElementById('trend-tab-global').style.background = tab === 'global' ? '#4285f4' : 'transparent';
  document.getElementById('trend-tab-global').style.color = tab === 'global' ? '#fff' : '#6b7f8e';
  renderGoogleTrends(tab === 'kr' ? (window._trendKr || []) : (window._trendGlobal || []));
}

function tdSourceInitial(source = '') {
  const text = String(source || '').trim();
  if (!text) return '';
  const cleaned = text.replace(/[^\p{L}\p{N}가-힣]/gu, '');
  return (cleaned || text).charAt(0).toUpperCase();
}

function tdSourceBadge(source = '', bg = 'rgba(0,0,0,0.06)', color = 'rgba(0,0,0,0.58)') {
  const initial = tdSourceInitial(source);
  if (!initial) return '';
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:${bg};color:${color};font-size:10px;font-weight:800;flex-shrink:0;">${escapeHtml(initial)}</span>`;
}

function renderGoogleTrends(trends) {
  const container = document.getElementById('td-trends-list');
  const isGlobal = trends === (window._trendGlobal || []);
  const regionLabel = isGlobal ? '글로벌 급등 검색어' : '국내 급등 검색어';
  const regionColor = isGlobal ? '#4285f4' : '#ff6b9d';
  if (!trends.length) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">${regionLabel} 데이터를 불러올 수 없습니다.</div>`;
    return;
  }

  window._renderedTrends = trends;
  const rankBgs = ['linear-gradient(135deg,#ff3b30,#ff6259)','linear-gradient(135deg,#ff9500,#ffb340)','linear-gradient(135deg,#af52de,#c77dff)'];

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:14px 16px;background:${isGlobal ? 'rgba(66,133,244,0.08)' : 'rgba(255,107,157,0.08)'};border:1px solid ${isGlobal ? 'rgba(66,133,244,0.18)' : 'rgba(255,107,157,0.18)'};border-radius:14px;">
      <div>
        <div style="font-size:14px;font-weight:800;color:#1c1c1e;">${regionLabel}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;">현재 급등 키워드 ${trends.length}개</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="padding:5px 10px;border-radius:999px;background:#fff;color:${regionColor};font-size:11px;font-weight:700;border:1px solid ${isGlobal ? 'rgba(66,133,244,0.18)' : 'rgba(255,107,157,0.18)'};">${isGlobal ? 'Global' : 'Korea'}</span>
        <span style="padding:5px 10px;border-radius:999px;background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:600;border:1px solid rgba(0,0,0,0.08);">실시간 반영</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;">
  `;
  trends.forEach((t, idx) => {
    const isTop3 = idx < 3;
    const rankBg = isTop3 ? rankBgs[idx] : 'rgba(0,0,0,0.06)';
    const rankTxt = isTop3 ? '#fff' : 'rgba(0,0,0,0.4)';
    const srcBadge = tdSourceBadge(t.source, isGlobal ? 'rgba(66,133,244,0.12)' : 'rgba(255,107,157,0.12)', isGlobal ? '#4285f4' : '#ff6b9d');

    const newsHtml = (t.related_news || []).slice(0, 2).map(n =>
      `<a href="${escapeHtml(n.url)}" target="_blank" style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(0,0,0,0.4);text-decoration:none;margin-top:5px;line-height:1.4;overflow:hidden;"
          onmouseenter="this.style.color='#007aff'" onmouseleave="this.style.color='rgba(0,0,0,0.4)'">${tdSourceBadge(n.source, 'rgba(0,122,255,0.08)', '#007aff')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n.title)}</span></a>`
    ).join('');

    html += `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:16px 18px;transition:all 0.25s;cursor:pointer;"
           onmouseenter="this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)';this.style.transform='scale(1.02)';this.querySelector('.td-hover-hint').style.opacity='1';this.querySelector('.td-hover-hint').style.transform='translateX(0)'"
           onmouseleave="this.style.boxShadow='none';this.style.transform='scale(1)';this.querySelector('.td-hover-hint').style.opacity='0';this.querySelector('.td-hover-hint').style.transform='translateX(8px)'"
           onclick="event.stopPropagation();startBlogFromTrendIdx(${idx})">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${newsHtml ? '8' : '0'}px;">
          <span style="width:30px;height:30px;border-radius:8px;background:${rankBg};color:${rankTxt};font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${t.rank}</span>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:${isTop3 ? '16' : '14'}px;font-weight:${isTop3 ? '700' : '600'};color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.keyword)}</span>
              ${srcBadge}
            </div>
          </div>
          ${t.traffic ? `<span style="font-size:11px;color:rgba(0,0,0,0.25);flex-shrink:0;font-weight:500;">${escapeHtml(t.traffic)}</span>` : ''}
          <span class="td-hover-hint" style="opacity:0;transform:translateX(8px);transition:all 0.25s;flex-shrink:0;font-size:13px;color:#fff;font-weight:700;white-space:nowrap;background:#ff8c00;padding:6px 14px;border-radius:8px;">글 쓰기 →</span>
        </div>
        ${newsHtml}
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderCategoryNews(category) {
  const container = document.getElementById('td-category-content');
  if (!_trendDashboardData) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#6b7f8e;">먼저 트렌드 데이터를 로드해주세요.</div>';
    return;
  }

  const catData = _trendDashboardData.category_news?.[category];
  if (!catData || !catData.news?.length) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:#6b7f8e;">뉴스가 없습니다.</div>';
    return;
  }

  const catColors = {
    entertainment: '#ff6b9d',
    sports: '#4fc08d',
    politics: '#5b9bf5',
    economy: '#f5a623',
    tech: '#fbbf24',
  };
  const color = catColors[category] || '#5b9bf5';

  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  catData.news.forEach((n, idx) => {
    const rawLink = n.url || n.link || '';
    html += `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;border-left:3px solid ${color};transition:all 0.25s;cursor:pointer;"
           onmouseenter="this.style.transform='scale(1.02)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)';this.querySelector('.td-hover-hint').style.opacity='1';this.querySelector('.td-hover-hint').style.transform='translateX(0)'"
           onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none';this.querySelector('.td-hover-hint').style.opacity='0';this.querySelector('.td-hover-hint').style.transform='translateX(8px)'"
           onclick="tdPickCategoryNews('${escapeHtml(category).replace(/'/g, "\\'")}', ${idx})">
        <span style="color:${color};font-weight:700;font-size:13px;width:24px;text-align:center;flex-shrink:0;">${n.rank}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:#1c1c1e;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n.title)}</div>
          <div style="font-size:11px;color:#6b7f8e;margin-top:3px;">
            ${tdSourceBadge(n.source, `${color}14`, color)}${n.relative_time ? `<span style="margin-left:6px;">${escapeHtml(n.relative_time)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <a href="${escapeHtml(rawLink)}" target="_blank" onclick="event.stopPropagation();" style="padding:5px 12px;font-size:11px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.5);border:1px solid rgba(0,0,0,0.08);border-radius:8px;font-weight:600;text-decoration:none;white-space:nowrap;" onmouseenter="this.style.background='rgba(0,0,0,0.08)'" onmouseleave="this.style.background='rgba(0,0,0,0.04)'">뉴스 보기</a>
          <span class="td-hover-hint" style="opacity:0;transform:translateX(8px);transition:all 0.25s;font-size:13px;color:#fff;font-weight:700;white-space:nowrap;background:#ff8c00;padding:6px 14px;border-radius:8px;">글 쓰기 →</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function switchNewsCategory(category, btn) {
  _currentNewsCategory = category;
  // 탭 활성화
  document.querySelectorAll('.td-cat-tab').forEach(b => {
    b.classList.remove('active');
    b.style.background = '';
    b.style.color = '';
    b.className = b.className.replace('btn-primary', 'btn-secondary');
    if (!b.classList.contains('btn-secondary')) b.classList.add('btn-secondary');
  });
  const catColors = {
    entertainment: '#ff6b9d',
    sports: '#4fc08d',
    politics: '#5b9bf5',
    economy: '#f5a623',
    tech: '#fbbf24',
  };
  btn.classList.add('active');
  btn.classList.remove('btn-secondary');
  btn.style.background = catColors[category] || '#5b9bf5';
  btn.style.color = '#fff';
  renderCategoryNews(category);
}

// AI 자동 전략: 프로필 기반으로 뉴스 선택 → 본문 수집 → 콘텐츠 생성 준비
async function aiAutoStrategy() {
  const profileId = window._globalProfileId || document.getElementById('td-ai-profile')?.value;
  if (!profileId) { toast('먼저 프로필을 선택하세요 (첫 화면 상단)', 'error'); return; }

  const btn = document.getElementById('td-auto-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 전략 수립 중...';

  try {
    // 1. 트렌드 데이터 확인
    if (!_trendDashboardData) {
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 트렌드 수집 중...';
      await loadTrendDashboard();
    }

    // 2. AI에게 프로필 + 트렌드 → 최적 뉴스 3개 선택 요청
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> AI가 뉴스 선택 중...';

    const allNews = [];
    // 국내 급상승 + 카테고리 뉴스에서 모든 뉴스 수집
    (window._trendKr || []).forEach(t => {
      (t.related_news || []).forEach(n => {
        if (n.url && n.title) allNews.push({ title: n.title, url: n.url, source: n.source || '' });
      });
    });
    Object.values(_trendDashboardData?.category_news || {}).forEach(cat => {
      (cat.news || []).forEach(n => {
        if (n.link && n.title && !allNews.some(a => a.url === n.link)) {
          allNews.push({ title: n.title, url: n.link, source: n.source || '' });
        }
      });
    });

    // AI에게 프로필 기반으로 관련 뉴스 선택 요청
    const newsListText = allNews.slice(0, 40).map((n, i) => `${i+1}. ${n.title} (${n.source})`).join('\n');

    // 프로필 정보 가져오기
    let profileText = '';
    try {
      const profiles = await api('/api/library/profiles');
      const pArr = Array.isArray(profiles) ? profiles : (profiles.profiles || []);
      const myProfile = pArr.find(p => String(p.id) === String(profileId));
      if (myProfile) {
        profileText = `이름: ${myProfile.name}\n업종: ${myProfile.business_type}\n설명: ${myProfile.description}\n키워드: ${myProfile.keywords}`;
      }
    } catch {}

    // 전용 AI 뉴스 선택 API 사용
    if (typeof kcStartCodexLogPolling === 'function') {
      kcStartCodexLogPolling();
    }
    const aiRes = await api('/api/trends/select-news-for-profile', {
      method: 'POST',
      body: {
        profile_id: parseInt(profileId),
        news_list: allNews.slice(0, 40),
      },
    });

    // AI가 선택한 뉴스
    let selectedNews = aiRes.selected || [];
    // AI가 못 찾으면 상위 3개 자동 선택
    if (selectedNews.length === 0) {
      selectedNews = allNews.slice(0, 3);
    }

    toast(`AI가 ${selectedNews.length}개 뉴스 선택! 자동 처리 시작...`);

    // 3. 콘텐츠 생성 페이지로 이동
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 본문 수집 중...';

    kcReset();
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('[data-page="keyword-content"]')?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-keyword-content').classList.add('active');

    const mainTitle = selectedNews[0].title.split(' - ')[0].split('…')[0].trim();
    document.getElementById('kc-keyword').value = mainTitle.substring(0, 30);

    // 소스 추가 + 본문 동시 수집
    _kcSearchData = { keyword: mainTitle, sources: [] };
    for (const n of selectedNews) {
      _kcSelectedSources.push({ title: n.title, url: n.url, source: n.source, type: 'news', checked: true });
    }
    kcRenderSourcesList();

    // 본문 수집 (자동)
    for (let i = 0; i < _kcSelectedSources.length; i++) {
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;"></span> 본문 ${i+1}/${_kcSelectedSources.length} 수집...`;
      if (_kcSelectedSources[i].url && !_kcSelectedSources[i].scrapedText) {
        await kcScrapeArticle(i);
      }
    }

    // 프로필 자동 입력 (3단계 건너뜀)
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 프로필 적용...';
    if (profileId) {
      try {
        await kcLoadLibraryDropdown();
        await kcLoadFromLibrary(profileId);
        const libSelect = document.getElementById('kc-library-select');
        if (libSelect) libSelect.value = profileId;
      } catch {}
    }

    // 바로 4단계로 이동!
    kcGoToStep(4);
    toast(`자동 완료! 옵션 확인 후 "콘텐츠 생성하기"를 누르세요`);
  } catch (e) {
    toast('자동 전략 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '자동 전략 생성';
  }
}

// 브랜드 맞춤 아이디어 → 바로 콘텐츠 생성
function startFromBrandIdea(title) {
  // 프로젝트 자동 생성
  autoCreateProject(title).then(() => {
    // 콘텐츠 생성 페이지로 이동
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-keyword-content').classList.add('active');
    kcReset();
    kcInit();
    document.getElementById('kc-keyword').value = title;
    toast(`"${title.substring(0,25)}" → 검색 시작...`);
    setTimeout(() => kcSearch(), 500);
  });
}

// 프로필 목록 로드 (AI 분석용)
async function loadAiProfiles() {
  try {
    const res = await api('/api/library/profiles');
    const sel = document.getElementById('td-ai-profile');
    if (!sel) return;
    const profiles = Array.isArray(res) ? res : (res.profiles || []);
    sel.innerHTML = '<option value="">프로필 없이 분석</option>';
    profiles.forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
    // 전역 프로필 동기화
    if (window._globalProfileId) sel.value = window._globalProfileId;
  } catch {}
}
loadAiProfiles();

async function loadAiAnalysis() {
  const btn = document.getElementById('td-ai-btn');
  const content = document.getElementById('td-ai-content');
  const profileId = window._globalProfileId || document.getElementById('td-ai-profile')?.value;
  if (!btn || !content) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 분석 중...';

  // 실시간 로딩 UI
  const steps = ['뉴스 데이터 수집 중', '트렌드 패턴 분석 중', '업종 연관성 파악 중', '콘텐츠 주제 추천 생성 중', '최종 보고서 작성 중'];
  let stepIdx = 0;
  content.innerHTML = `
    <div style="padding:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;animation:pulse 1.5s ease-in-out infinite;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:20px;height:20px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:700;color:#1c1c1e;">AI 트렌드 분석${profileId ? ' (프로필 맞춤)' : ''}</div>
          <div id="td-ai-step-text" style="font-size:12px;color:#ff8c00;margin-top:2px;">${steps[0]}...</div>
        </div>
      </div>
      <div style="background:rgba(0,0,0,0.03);border-radius:10px;overflow:hidden;height:4px;margin-bottom:16px;">
        <div id="td-ai-progress" style="height:100%;background:linear-gradient(90deg,#ff8c00,#ff6b00);border-radius:10px;width:10%;transition:width 0.5s ease;"></div>
      </div>
      <div id="td-ai-log" style="font-size:11px;font-family:monospace;color:rgba(0,0,0,0.35);max-height:120px;overflow-y:auto;"></div>
    </div>
  `;

  const aiStepTimer = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, steps.length - 1);
    const pct = Math.min(10 + stepIdx * 20, 90);
    const stepText = document.getElementById('td-ai-step-text');
    const progress = document.getElementById('td-ai-progress');
    const log = document.getElementById('td-ai-log');
    if (stepText) stepText.textContent = steps[stepIdx] + '...';
    if (progress) progress.style.width = pct + '%';
    if (log) {
      log.innerHTML += `<div style="animation:wsSlideUp 0.3s both;">[${new Date().toLocaleTimeString()}] ${steps[stepIdx]}</div>`;
      log.scrollTop = log.scrollHeight;
    }
  }, 8000);

  try {
    if (typeof kcStartCodexLogPolling === 'function') {
      kcStartCodexLogPolling();
    }
    const res = await api('/api/trends/ai-analyze', {
      method: 'POST',
      body: {
        profile_id: profileId ? parseInt(profileId) : null,
        trends: (window._trendKr || []).slice(0, 20),
        global_trends: (window._trendGlobal || []).slice(0, 12),
        news: _trendDashboardData?.category_news || {},
      },
    });
    clearInterval(aiStepTimer);
    const progress = document.getElementById('td-ai-progress');
    if (progress) progress.style.width = '100%';
    const d = res.data;

    let html = '';

    // 에러 체크
    if (d.error) {
      html += `<div style="padding:12px;background:rgba(255,59,48,0.06);border:1px solid rgba(255,59,48,0.2);border-radius:12px;color:#ff3b30;font-size:13px;margin-bottom:16px;">분석 오류: ${escapeHtml(d.error)}</div>`;
    }

    // 핵심 이슈
    if (d.core_issues?.length) {
      html += '<div style="margin-bottom:24px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">핵심 이슈</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">';
      d.core_issues.forEach(issue => {
        const title = typeof issue === 'string' ? issue : (issue.title || issue.issue || '핵심 이슈');
        const summary = typeof issue === 'string' ? '' : (issue.summary || issue.reason || issue.description || '');
        const category = typeof issue === 'string' ? '' : (issue.category || '');
        html += `
          <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px;transition:box-shadow 0.2s;"
               onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:6px;">${escapeHtml(title)}</div>
            ${summary ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.5;">${escapeHtml(summary)}</div>` : ''}
            ${category ? `<span style="display:inline-block;margin-top:8px;padding:3px 10px;background:rgba(0,0,0,0.04);border-radius:10px;font-size:11px;color:rgba(0,0,0,0.4);font-weight:500;">${escapeHtml(category)}</span>` : ''}
          </div>
        `;
      });
      html += '</div></div>';
    }

    // 추천 키워드
    if (d.recommended_keywords?.length) {
      html += '<div style="margin-bottom:24px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">블로그 추천 키워드</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">';
      d.recommended_keywords.forEach(kw => {
        const keyword = typeof kw === 'string' ? kw : (kw.keyword || kw.title || '');
        const reason = typeof kw === 'string' ? '' : (kw.reason || kw.summary || '');
        const difficulty = typeof kw === 'string' ? '?' : (kw.difficulty || '?');
        const potential = typeof kw === 'string' ? '?' : (kw.potential || kw.opportunity || '?');
        const diffColor = difficulty === '하' ? '#34c759' : difficulty === '중' ? '#ff9500' : '#ff3b30';
        if (!keyword) return;
        html += `
          <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:14px;cursor:pointer;transition:box-shadow 0.2s;"
               onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'"
               onclick="startBlogFromTrend('${escapeHtml(keyword).replace(/'/g, "\\'")}')">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:4px;">${escapeHtml(keyword)}</div>
            ${reason ? `<div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:6px;line-height:1.4;">${escapeHtml(reason)}</div>` : ''}
            <div style="display:flex;gap:10px;font-size:11px;">
              <span style="color:${diffColor};font-weight:600;">난이도: ${escapeHtml(difficulty)}</span>
              <span style="color:#007aff;font-weight:600;">잠재력: ${escapeHtml(potential)}</span>
            </div>
          </div>
        `;
      });
      html += '</div></div>';
    }

    // 글로벌 인사이트
    if (d.global_insights?.length) {
      html += '<div style="margin-bottom:24px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">🌐 글로벌 인사이트</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">';
      d.global_insights.forEach(g => {
        const kwHtml = (g.keywords || []).map(k => `<span style="display:inline-block;padding:2px 8px;background:rgba(0,122,255,0.08);border-radius:6px;font-size:11px;color:#007aff;margin-right:4px;margin-top:4px;">${escapeHtml(k)}</span>`).join('');
        html += `
          <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:16px;transition:box-shadow 0.2s;"
               onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:6px;">${escapeHtml(g.topic)}</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.5;margin-bottom:6px;">${escapeHtml(g.korean_angle)}</div>
            <div>${kwHtml}</div>
          </div>`;
      });
      html += '</div></div>';
    }

    // 카테고리 요약
    if (d.category_summary && Object.keys(d.category_summary).length) {
      const catNames = { entertainment: '연예', sports: '스포츠', politics: '정치', economy: '경제', tech: 'IT/테크', global_tech: '글로벌 테크', global_business: '글로벌 비즈니스', global_ai: 'AI 트렌드' };
      const catEmojis = { entertainment: '🎬', sports: '⚽', politics: '🏛️', economy: '📈', tech: '💻', global_tech: '🌐', global_business: '🌍', global_ai: '🤖' };
      html += '<div style="margin-bottom:20px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">카테고리별 요약</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
      for (const [key, summary] of Object.entries(d.category_summary)) {
        html += `
          <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:14px;">
            <div style="font-size:13px;font-weight:600;color:#1c1c1e;margin-bottom:4px;">${catEmojis[key] || ''} ${catNames[key] || key}</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.45);line-height:1.5;">${escapeHtml(summary)}</div>
          </div>
        `;
      }
      html += '</div></div>';
    }

    // 콘텐츠 팁
    if (d.content_tips) {
      html += `
        <div style="background:linear-gradient(135deg,rgba(52,199,89,0.06),rgba(0,122,255,0.06));border:1px solid rgba(52,199,89,0.15);border-radius:12px;padding:16px;">
          <div style="font-size:13px;font-weight:700;color:#34c759;margin-bottom:8px;">오늘의 콘텐츠 전략</div>
          <div style="font-size:13px;color:#1c1c1e;line-height:1.7;">${escapeHtml(d.content_tips)}</div>
        </div>
      `;
    }

    // 브랜드 맞춤 콘텐츠 아이디어
    if (d.brand_content_ideas?.length) {
      html += '<div style="margin-top:20px;margin-bottom:20px;">';
      html += '<div style="font-size:14px;font-weight:700;color:#af52de;margin-bottom:12px;">내 브랜드 맞춤 콘텐츠</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">';
      d.brand_content_ideas.forEach(idea => {
        const kwHtml = (idea.keywords || []).map(k => `<span style="display:inline-block;padding:2px 8px;background:rgba(175,82,222,0.08);border-radius:6px;font-size:10px;color:#af52de;margin-right:4px;">${escapeHtml(k)}</span>`).join('');
        const typeBadge = idea.type === '블로그' ? 'background:rgba(52,199,89,0.1);color:#34c759' : idea.type === '카드뉴스' ? 'background:rgba(255,149,0,0.1);color:#ff9500' : 'background:rgba(0,122,255,0.1);color:#007aff';
        html += `
          <div style="background:#fff;border:1px solid rgba(175,82,222,0.15);border-radius:12px;padding:16px;transition:box-shadow 0.2s;cursor:pointer;"
               onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'" onmouseleave="this.style.boxShadow='none'"
               onclick="startFromBrandIdea('${escapeHtml(idea.title || '').replace(/'/g,"\\'")}')">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
              <div style="font-size:14px;font-weight:600;color:#1c1c1e;flex:1;">${escapeHtml(idea.title)}</div>
              <span style="font-size:10px;padding:2px 8px;border-radius:6px;${typeBadge};font-weight:600;flex-shrink:0;margin-left:8px;">${escapeHtml(idea.type || '블로그')}</span>
            </div>
            <div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.5;margin-bottom:8px;">${escapeHtml(idea.angle || '')}</div>
            <div>${kwHtml}</div>
            <div style="margin-top:8px;font-size:11px;color:#af52de;font-weight:600;">클릭하면 바로 콘텐츠 생성 →</div>
          </div>`;
      });
      html += '</div></div>';
    }

    // 분석 시간
    if (d.analyzed_at) {
      html += `<div style="text-align:right;font-size:11px;color:#6b7f8e;margin-top:12px;">분석: ${d.analyzed_at} | 모델: ${d.model_used || '?'}</div>`;
    }

    content.innerHTML = html;
    toast('AI 트렌드 분석 완료!');
  } catch (e) {
    clearInterval(aiStepTimer);
    content.innerHTML = `<div style="text-align:center;padding:24px;color:#e05c5c;">AI 분석 실패: ${e.message}<br><span style="font-size:12px;color:#6b7f8e;">설정에서 API 키를 확인해주세요.</span></div>`;
    toast('AI 분석 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>AI 분석';
  }
}

// 팝업에서 수집한 뉴스 자동 감지 (5초마다, 관련 페이지 활성 시만)
setInterval(async () => {
  const activePage = document.querySelector('.page.active');
  if (!activePage || !['page-trends','page-keyword-content'].includes(activePage.id)) return;
  try {
    const res = await fetch('/api/content/last-collected');
    const data = await res.json();
    if (data.status === 'ok' && data.data) {
      const d = data.data;
      // 콘텐츠 생성 페이지로 이동 + 소스 추가
      document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
      const kcLink = document.querySelector('[data-page="keyword-content"]');
      if (kcLink) kcLink.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-keyword-content').classList.add('active');

      // 소스에 추가
      _kcSearchData = _kcSearchData || { keyword: d.title, sources: [] };
      document.getElementById('kc-keyword').value = d.title.substring(0, 30);
      _kcSelectedSources.push({
        title: d.title,
        url: d.url,
        source: '',
        type: 'news',
        checked: true,
        scrapedText: d.text,
        scrapedImages: d.images,
      });
      kcRenderSourcesList();
      kcGoToStep(2);
      toast(`"${d.title.substring(0, 25)}" 수집 완료! (${d.char_count}자)`);
    }
  } catch {}
}, 5000);

// 뉴스 기사 바로 수집 (트렌드 페이지에서)
async function collectNewsArticle(btnEl, url, title, source) {
  btnEl.disabled = true;
  btnEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span>';

  try {
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const result = await scrape(url, { title, minLength: 50, timeoutMs: 45000 });
    const text = String(result.text || '').trim();
    const images = Array.isArray(result.images) ? result.images : [];

    if (text.length >= 50) {
      // 콘텐츠 생성 페이지로 이동 + 소스 추가
      _kcSearchData = _kcSearchData || { keyword: title, sources: [] };
      _kcSelectedSources.push({
        title, url, source, type: 'news', checked: true,
        scrapedText: text, scrapedImages: images,
      });
      btnEl.textContent = '✓ 완료';
      btnEl.style.background = 'rgba(52,199,89,0.15)';
      btnEl.style.color = '#34c759';
      toast(`"${title.substring(0, 25)}" 수집 완료 (${text.length}자)`);
    } else {
      btnEl.textContent = '실패';
      btnEl.style.color = '#ff3b30';
      toast('본문 수집 실패', 'error');
    }
  } catch (e) {
    btnEl.textContent = '실패';
    btnEl.style.color = '#ff3b30';
    toast('수집 실패: ' + e.message, 'error');
  }
}

// ═══ 프로필 선택 모달 ═══
window._profilePickerAction = null;
window._profilePickerTitle = '프로필 선택';

async function openProfilePickerModal() {
  let modal = document.getElementById('profile-picker-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'profile-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:modalBgIn 0.3s ease both;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:22px;padding:28px;width:92%;max-width:520px;max-height:80vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">${escapeHtml(window._profilePickerTitle || '프로필 선택')}</h2>
        <button onclick="document.getElementById('profile-picker-modal').remove()" style="background:rgba(0,0,0,0.06);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(0,0,0,0.4);">×</button>
      </div>
      <input type="text" id="profile-picker-search" placeholder="프로필 검색..." oninput="filterProfilePicker(this.value)" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);font-size:14px;margin-bottom:14px;background:rgba(0,0,0,0.03);">
      <div id="profile-picker-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;">
        <div style="text-align:center;padding:20px;"><span class="spinner"></span></div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  let html = '';

  try {
    const res = await api('/api/library/profiles');
    const profiles = Array.isArray(res) ? res : (res.profiles || []);
    profiles.forEach(p => {
      const logoHtml = p.logo_url
        ? `<img src="${p.logo_url}" style="width:100%;height:100%;object-fit:cover;">`
        : `<span style="font-size:18px;font-weight:700;color:#fff;">${(p.name||'?')[0]}</span>`;
      const isSelected = String(p.id) === String(window._globalProfileId);
      html += `
        <div class="profile-pick-item" data-name="${escapeHtml(p.name)} ${escapeHtml(p.business_type||'')}" onclick="selectProfileFromPicker(${p.id})" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;cursor:pointer;transition:all 0.15s;border:1px solid ${isSelected ? 'rgba(255,140,0,0.4)' : 'rgba(0,0,0,0.06)'};background:${isSelected ? 'rgba(255,140,0,0.04)' : '#fff'};" onmouseenter="this.style.background='rgba(0,0,0,0.03)'" onmouseleave="this.style.background='${isSelected ? 'rgba(255,140,0,0.04)' : '#fff'}'">
          <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
            ${logoHtml}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px;">${escapeHtml(p.business_type||'')} ${p.business_goal ? '· ' + escapeHtml(p.business_goal).substring(0,25) : ''}</div>
          </div>
          ${isSelected ? '<span style="color:#ff8c00;font-size:16px;">✓</span>' : ''}
        </div>`;
    });
    // 새 프로필 만들기 버튼
    html += `
      <div onclick="document.getElementById('profile-picker-modal')?.remove();document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-library')?.classList.add('active');libShowEditModal()" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;cursor:pointer;transition:background 0.15s;border:2px dashed rgba(0,0,0,0.1);margin-top:8px;" onmouseenter="this.style.background='rgba(0,0,0,0.03)'" onmouseleave="this.style.background='#fff'">
        <div style="width:44px;height:44px;border-radius:12px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:22px;color:rgba(0,0,0,0.25);">+</span>
        </div>
        <div><div style="font-size:14px;font-weight:600;color:rgba(0,0,0,0.4);">새 프로필 만들기</div></div>
      </div>`;
    document.getElementById('profile-picker-list').innerHTML = html;
    if (profiles.length === 0) {
      document.getElementById('profile-picker-list').innerHTML = `
        <div style="text-align:center;padding:30px;">
          <div style="font-size:36px;margin-bottom:10px;">👤</div>
          <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:6px;">프로필이 없습니다</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:16px;">프로필을 먼저 만들어주세요</div>
          <button onclick="document.getElementById('profile-picker-modal')?.remove();document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-library')?.classList.add('active');libShowEditModal()" style="padding:10px 24px;background:#ff8c00;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">프로필 만들기</button>
        </div>`;
    }
  } catch { document.getElementById('profile-picker-list').innerHTML = '<div style="color:rgba(0,0,0,0.3);text-align:center;padding:20px;">로딩 실패</div>'; }
}

function filterProfilePicker(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.profile-pick-item').forEach(el => {
    el.style.display = (el.dataset.name || '').toLowerCase().includes(q) ? '' : 'none';
  });
}

async function selectProfileFromPicker(profileId) {
  document.getElementById('profile-picker-modal')?.remove();
  const action = window._profilePickerAction;
  window._profilePickerAction = null;
  window._profilePickerTitle = '프로필 선택';
  await setGlobalProfile(profileId ? String(profileId) : '', false);

  // 셀렉트 동기화
  const sel = document.getElementById('global-profile-select');
  if (sel) sel.value = profileId || '';

  // 버튼 UI 업데이트
  await updateProfileButton(profileId);
  if (typeof window.refreshSidebarChromeProfileQuickSelect === 'function') {
    await window.refreshSidebarChromeProfileQuickSelect(true);
  }

  if (typeof action === 'function') {
    setTimeout(() => action(profileId), 50);
  }
}

function openChromeConnectProfilePicker() {
  window._profilePickerTitle = '자동 연결할 프로필 선택';
  window._profilePickerAction = async (profileId) => {
    if (!profileId) return;
    await connectChrome();
  };
  openProfilePickerModal();
}

async function updateProfileButton(profileId) {
  const avatar = document.getElementById('global-profile-avatar');
  const nameEl = document.getElementById('global-profile-name');
  const typeEl = document.getElementById('global-profile-type');
  let googleEl = document.getElementById('global-profile-google');
  if (googleEl) googleEl.remove();

  if (!profileId) {
    avatar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" style="width:20px;height:20px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    nameEl.textContent = '프로필을 선택하세요';
    typeEl.innerHTML = '<div>탭하여 브랜드 프로필 선택</div>';
    return;
  }

  try {
    const p = await api(`/api/library/profiles/${profileId}`);
    if (p.logo_url || p.logo_path) {
      const url = p.logo_url || `/api/library/image/${p.id}/${p.logo_path}`;
      avatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
      avatar.style.background = 'linear-gradient(135deg,#ff8c00,#ff6b00)';
      avatar.innerHTML = `<span style="font-size:18px;font-weight:700;color:#fff;">${(p.name||'?')[0]}</span>`;
    }
    nameEl.textContent = p.name;
    const profileMeta = p.business_type || p.business_goal || '프로필 선택됨';
    if (typeof window.renderSidebarProfileGoogleMeta === 'function') {
      window._globalProfileData = p;
      window.renderSidebarProfileGoogleMeta('');
    } else {
      typeEl.innerHTML = `<div>${escapeHtml(profileMeta)}</div>`;
    }
  } catch {}
}

function kcToggleImageType(type) {
  const cnOpt = document.getElementById('kc-cn-options');
  const comicOpt = document.getElementById('kc-comic-options');
  if (cnOpt) cnOpt.style.display = type === 'cardnews' ? 'block' : 'none';
  if (comicOpt) comicOpt.style.display = type === 'comic' ? 'block' : 'none';
}

// ═══ 템플릿 버전 관리 ═══
async function checkTemplateVersion() {
  try {
    const res = await api('/api/template-versions/status');
    const el = document.getElementById('tpl-version-status');
    const badge = document.getElementById('tpl-version-badge');
    if (res.needs_sync) {
      el.innerHTML = `<span style="color:#ff9500;">DB에 템플릿이 없습니다. "동기화" 버튼을 눌러주세요.</span>`;
      badge.textContent = '동기화 필요';
    } else {
      el.innerHTML = `템플릿 <strong>${res.templates_in_db.toLocaleString()}</strong>개 · 시나리오 <strong>${res.scenarios_in_db.toLocaleString()}</strong>개`;
      badge.textContent = res.active_version ? `v${res.active_version} 활성` : '';
    }
  } catch {}
}

async function syncTemplateVersion(version) {
  if (!confirm(`v${version} 기본 템플릿을 DB에 동기화할까요?\n기존 데이터는 교체됩니다.`)) return;
  toast('템플릿 동기화 중...');
  try {
    const res = await api('/api/template-versions/sync', { method: 'POST', body: { version } });
    toast(`v${version} 동기화 완료! 템플릿 ${res.templates}개 + 시나리오 ${res.scenarios}개`);
    checkTemplateVersion();
  } catch (e) { toast('동기화 실패: ' + e.message, 'error'); }
}

document.addEventListener('DOMContentLoaded', () => setTimeout(checkTemplateVersion, 3000));

// ═══ API 사용량 대시보드 ═══
async function loadUsageDashboard() {
  const container = document.getElementById('usage-dashboard');
  if (!container) return;
  if (window._usageDashboardLoading) return;
  window._usageDashboardLoading = true;
  try {
    const res = await api('/api/usage?days=30');
    const t = res.total || {};

    // GPT/Gemini 분류
    const models = res.by_model || [];
    let gptCost = 0, geminiCost = 0, otherCost = 0;
    let gptCalls = 0, geminiCalls = 0;
    models.forEach(m => {
      if ((m.model||'').includes('gpt') || (m.model||'').includes('openai')) { gptCost += m.usd||0; gptCalls += m.calls||0; }
      else if ((m.model||'').includes('gemini') || (m.model||'').includes('veo')) { geminiCost += m.usd||0; geminiCalls += m.calls||0; }
      else { otherCost += m.usd||0; }
    });

    const daily = res.daily || [];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="padding:14px;background:rgba(0,122,255,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#007aff;">₩${Math.round(t.cost_krw||0).toLocaleString()}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:4px;">30일 총 비용</div>
        </div>
        <div style="padding:14px;background:rgba(52,199,89,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#34c759;">${(t.calls||0).toLocaleString()}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:4px;">API 호출 수</div>
        </div>
        <div style="padding:14px;background:rgba(255,149,0,0.04);border-radius:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#ff9500;">${((t.input_tokens||0)+(t.output_tokens||0)).toLocaleString()}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:4px;">총 토큰</div>
        </div>
      </div>

      <div style="padding:14px;background:rgba(66,133,244,0.04);border-radius:12px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:16px;">🤖</span>
          <div style="font-size:14px;font-weight:700;color:#1c1c1e;">Gemini AI</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#4285f4;">$${(gptCost+geminiCost).toFixed(4)}</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">총 비용</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#34a853;">₩${Math.round((gptCost+geminiCost)*1350).toLocaleString()}</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">원화</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#ea4335;">${gptCalls+geminiCalls}회</div>
            <div style="font-size:10px;color:rgba(0,0,0,0.35);">API 호출</div>
          </div>
        </div>
      </div>

      ${models.length ? `
      <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">모델별 상세</div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${models.map(m => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(0,0,0,0.02);border-radius:8px;font-size:11px;">
            <span style="color:#1c1c1e;font-weight:500;">${escapeHtml(m.model)}</span>
            <span style="color:rgba(0,0,0,0.4);">${m.calls}회 · $${(m.usd||0).toFixed(4)} · ₩${Math.round((m.krw||0)).toLocaleString()}</span>
          </div>
        `).join('')}
      </div>` : '<div style="color:rgba(0,0,0,0.3);font-size:12px;">아직 사용 기록이 없습니다</div>'}
    `;
  } catch {
    container.innerHTML = '<div style="color:rgba(0,0,0,0.3);">사용량을 불러올 수 없습니다</div>';
  } finally {
    window._usageDashboardLoading = false;
  }
}

// 설정 페이지 진입 시 로드
document.addEventListener('DOMContentLoaded', () => setTimeout(loadUsageDashboard, 3000));

// 실시간 토큰 위젯 업데이트
async function updateTokenWidget() {
  if (window._tokenWidgetUpdating) return;
  window._tokenWidgetUpdating = true;
  try {
    const res = await api('/api/usage?days=1');
    const t = res.total || {};
    const costText = `₩${Math.round(t.cost_krw||0).toLocaleString()}`;
    document.getElementById('token-widget-cost').textContent = costText;
    const sbCost = document.getElementById('token-widget-cost-sb');
    if (sbCost) sbCost.textContent = costText;

    let gptKrw = 0, geminiKrw = 0;
    (res.by_model||[]).forEach(m => {
      if ((m.model||'').includes('gpt')) gptKrw += (m.krw||0);
      else geminiKrw += (m.krw||0);
    });
    document.getElementById('tw-gpt').textContent = `₩${Math.round(gptKrw).toLocaleString()}`;
    document.getElementById('tw-gemini').textContent = `₩${Math.round(geminiKrw).toLocaleString()}`;
    document.getElementById('tw-calls').textContent = (t.calls||0).toLocaleString();
    document.getElementById('tw-tokens').textContent = ((t.input_tokens||0)+(t.output_tokens||0)).toLocaleString();
    // 사이드바 상세
    const s = id => document.getElementById(id);
    if (s('tw-sb-gemini')) s('tw-sb-gemini').textContent = `₩${Math.round(gptKrw + geminiKrw).toLocaleString()}`;
    if (s('tw-sb-calls')) s('tw-sb-calls').textContent = (t.calls||0).toLocaleString();
    if (s('tw-sb-tokens')) s('tw-sb-tokens').textContent = ((t.input_tokens||0)+(t.output_tokens||0)).toLocaleString();

    // 클라이언트 영구 저장 제거: 월 한도는 DB/서버 설정이 없으면 비활성
    const limit = 0;
    if (limit > 0) {
      const monthly = await api('/api/usage?days=30');
      const used = Math.round(monthly.total?.cost_krw || 0);
      document.getElementById('tw-limit').style.display = 'block';
      document.getElementById('tw-limit-val').textContent = `₩${used.toLocaleString()} / ₩${limit.toLocaleString()}`;
      document.getElementById('tw-limit-bar').style.width = `${Math.min(100, (used/limit)*100)}%`;
    }
  } catch {} finally {
    window._tokenWidgetUpdating = false;
  }
}
// 2분마다 업데이트
if (!window._tokenWidgetInterval) {
  window._tokenWidgetInterval = setInterval(updateTokenWidget, 120000);
}
if (!window._tokenWidgetBootstrapped) {
  window._tokenWidgetBootstrapped = true;
  document.addEventListener('DOMContentLoaded', () => setTimeout(updateTokenWidget, 5000));
}

// ═══ 작업 중 화면 잠금 ═══
function _getContentLabel() {
  const o = window._contentOpts;
  const p = [];
  if (o.gen_blog) p.push('블로그');
  if (o.gen_cardnews) p.push('카드뉴스');
  if (o.gen_comic) p.push('만화');
  if (o.gen_sns) p.push('SNS');
  if (o.gen_video_slide) p.push('영상');
  if (o.gen_video_veo) p.push('AI영상');
  if (o.gen_detail_page) p.push('상세페이지');
  return p.length ? p.join(' + ') : '콘텐츠';
}
window._activeTasks = {};
let _taskIdCounter = 0;
function lockScreen(text, sub, taskId) {
  taskId = taskId || ('task_' + (++_taskIdCounter));
  window._activeTasks[taskId] = { text: text || '작업 중...', sub: sub || '잠시만 기다려주세요' };
  _renderWorkingOverlay();
  return taskId;
}
function updateLockScreen(taskId, text, sub) {
  if (window._activeTasks[taskId]) {
    if (text) window._activeTasks[taskId].text = text;
    if (sub) window._activeTasks[taskId].sub = sub;
    _renderWorkingOverlay();
  }
}
function unlockScreen(taskId) {
  if (taskId) {
    delete window._activeTasks[taskId];
  } else {
    window._activeTasks = {};
  }
  _renderWorkingOverlay();
}
function _renderWorkingOverlay() {
  const o = document.getElementById('working-overlay');
  if (!o) return;
  const tasks = Object.entries(window._activeTasks);
  if (!tasks.length) {
    o.classList.remove('active');
    o.innerHTML = '';
    return;
  }
  o.classList.add('active');
  o.innerHTML = tasks.map(([id, t]) =>
    `<div style="display:inline-flex;align-items:center;gap:12px;background:rgba(255,140,0,0.95);backdrop-filter:blur(20px);border-radius:14px;padding:12px 24px;box-shadow:0 8px 30px rgba(0,0,0,0.15);pointer-events:auto;animation:toastSlideDown 0.3s ease-out both;">
      <span class="spinner" style="width:18px;height:18px;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span>
      <div>
        <div style="font-size:14px;font-weight:700;color:#fff;">${t.text}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:2px;">${t.sub}</div>
      </div>
      <button onclick="stopWorking('${id}')" style="padding:5px 14px;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;margin-left:4px;">중단</button>
    </div>`
  ).join('');
}
window._stopRequested = false;
function stopWorking(taskId) {
  window._stopRequested = true;
  unlockScreen(taskId);
  _kcGenerating = false;
  _kcCnGenerating = false;
  _bizCnGenerating = false;
  toast('작업이 중단되었습니다');
}

// ═══ 스타일 관리 탭 전환 ═══
function switchStyleTab(tab, btn) {
  ['collect','analyze','styles','write'].forEach(t => {
    const el = document.getElementById(`style-tab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'collect') waLoadArticles();
  if (tab === 'styles') loadStyleList();
  if (!btn) btn = document.querySelector('.style-tab');
  btn.parentElement.querySelectorAll('.style-tab').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'rgba(0,0,0,0.4)';
    b.style.boxShadow = 'none';
  });
  btn.style.background = '#fff';
  btn.style.color = '#1c1c1e';
  btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
}

async function saveStyleToList() {
  try {
    const styleData = await api('/api/style');
    if (!styleData || !styleData.tone) { toast('분석된 스타일이 없습니다. 먼저 스타일 분석을 실행하세요.', 'error'); return; }

    // Electron에서 prompt 대신 모달 사용
    let modal = document.getElementById('style-name-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'style-name-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:18px;padding:24px;width:90%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;">
        <h2 style="font-size:16px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">스타일 이름</h2>
        <input type="text" id="style-name-input" value="${escapeHtml(styleData.tone)} 스타일" style="width:100%;margin-bottom:14px;" autofocus>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('style-name-modal').remove()">취소</button>
          <button class="btn btn-primary btn-sm" onclick="doSaveStyle()">저장</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('style-name-input').focus();
    document.getElementById('style-name-input').select();

    window._pendingStyleData = styleData;
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function doSaveStyle() {
  const name = document.getElementById('style-name-input')?.value?.trim();
  document.getElementById('style-name-modal')?.remove();
  if (!name || !window._pendingStyleData) return;
  try {
    await api('/api/writing-styles', { method: 'POST', body: { name, style_data: window._pendingStyleData } });
    toast(`"${name}" 스타일 저장됨!`);
    loadStyleList();
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
  window._pendingStyleData = null;
}

async function loadStyleList() {
  const container = document.getElementById('style-list-container');
  if (!container) return;
  try {
    const res = await api('/api/writing-styles');
    const styles = res.styles || [];
    const countEl = document.getElementById('style-list-count');
    if (countEl) countEl.textContent = styles.length ? `${styles.length}개` : '';
    if (!styles.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.25);font-size:13px;line-height:1.8;">아직 스타일이 없습니다<br><span style="font-size:12px;">아래에서 새 스타일을 만들어보세요</span></div>';
      return;
    }
    container.innerHTML = styles.map(s => {
      const data = typeof s.style_data === 'string' ? JSON.parse(s.style_data) : (s.style_data || {});
      return `
      <div style="padding:14px;background:${s.is_default ? 'rgba(52,199,89,0.04)' : 'rgba(0,0,0,0.02)'};border:1px solid ${s.is_default ? 'rgba(52,199,89,0.15)' : 'rgba(0,0,0,0.06)'};border-radius:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#1c1c1e;">${escapeHtml(s.name)} ${s.is_default ? '<span style="font-size:10px;color:#34c759;">⭐ 기본</span>' : ''}</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-top:4px;">
              ${escapeHtml(data.tone || '')} · ${escapeHtml(data.sentence_style || '')} · ${(data.expressions||[]).slice(0,3).map(e=>escapeHtml(e)).join(', ')}
            </div>
            <div style="font-size:10px;color:rgba(0,0,0,0.25);margin-top:2px;">${s.created_at?.slice(0,10) || ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button onclick="applyStyleToApi(${s.id})" style="padding:4px 10px;font-size:11px;background:#007aff;color:#fff;border:none;border-radius:6px;cursor:pointer;" title="이 스타일을 지금 바로 글쓰기에 사용합니다">지금 사용</button>
            ${!s.is_default ? `<button onclick="setDefaultStyle(${s.id})" style="padding:4px 10px;font-size:11px;background:rgba(52,199,89,0.1);color:#34c759;border:none;border-radius:6px;cursor:pointer;font-weight:600;" title="이 스타일을 기본값으로 설정하면 매번 자동 적용됩니다">⭐ 기본 설정</button>` : ''}
            <button onclick="deleteStyle(${s.id})" style="padding:4px 10px;font-size:11px;background:rgba(255,59,48,0.08);color:#ff3b30;border:none;border-radius:6px;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch {}
}

async function applyStyleToApi(styleId) {
  try {
    const res = await api('/api/writing-styles');
    const s = (res.styles || []).find(x => x.id === styleId);
    if (!s) return;
    const data = typeof s.style_data === 'string' ? JSON.parse(s.style_data) : s.style_data;
    await api('/api/style/save', { method: 'POST', body: data });
    toast(`"${s.name}" 스타일이 적용되었습니다!`);
  } catch (e) { toast('적용 실패: ' + e.message, 'error'); }
}

async function setDefaultStyle(styleId) {
  try {
    await api(`/api/writing-styles/${styleId}`, { method: 'PUT', body: { is_default: true } });
    toast('기본 스타일 설정됨');
    loadStyleList();
  } catch {}
}

async function deleteStyle(styleId) {
  if (!confirm('이 스타일을 삭제할까요?')) return;
  try {
    await api(`/api/writing-styles/${styleId}`, { method: 'DELETE' });
    toast('스타일 삭제됨');
    loadStyleList();
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadStyleList, 2000);
  setTimeout(() => {
    renderOptsPreview();
  }, 1000);
});

// ═══ 새 스타일 만들기 ═══
let _styleCreateMode = 'ai';

function openStyleCreateModal(mode) {
  _styleCreateMode = mode;
  const modal = document.getElementById('style-create-modal');
  document.getElementById('style-create-ai').style.display = mode === 'ai' ? 'block' : 'none';
  document.getElementById('style-create-paste').style.display = mode === 'paste' ? 'block' : 'none';
  document.getElementById('style-create-title').textContent = mode === 'ai' ? 'AI로 스타일 생성' : '글 붙여넣기로 분석';
  document.getElementById('style-create-btn').textContent = mode === 'ai' ? 'AI 생성' : '분석하여 저장';
  // 초기화
  if (mode === 'ai') {
    document.getElementById('style-ai-name').value = '';
    document.getElementById('style-ai-desc').value = '';
  } else {
    document.getElementById('style-paste-name').value = '';
    document.getElementById('style-paste-text').value = '';
  }
  modal.style.display = 'flex';
}

function closeStyleCreateModal() {
  const m = document.getElementById('style-create-modal');
  if (m) m.style.display = 'none';
}

// ═══ 인라인 스타일 생성 (스텝 방식) ═══
let _scSamples = [];

function scSelectMethod(method) {
  document.getElementById('sc-method-paste').classList.toggle('qs-active', method === 'paste');
  document.getElementById('sc-method-ai').classList.toggle('qs-active', method === 'ai');
  document.getElementById('sc-mode-paste').style.display = method === 'paste' ? 'block' : 'none';
  document.getElementById('sc-mode-ai').style.display = method === 'ai' ? 'block' : 'none';
}

function scAddSample() {
  const ta = document.getElementById('sc-paste-text');
  const text = ta.value.trim();
  if (text.length < 20) { toast('최소 20자 이상 입력하세요', 'error'); return; }
  _scSamples.push(text);
  ta.value = '';
  ta.focus();
  scRenderSamples();
  toast(`샘플 ${_scSamples.length}개 추가됨`);
}

function scRemoveSample(idx) {
  _scSamples.splice(idx, 1);
  scRenderSamples();
}

function scClearSamples() {
  _scSamples = [];
  scRenderSamples();
}

function scRenderSamples() {
  const list = document.getElementById('sc-sample-list');
  const count = document.getElementById('sc-sample-count');
  const clearBtn = document.getElementById('sc-clear-btn');
  count.textContent = `추가된 샘플: ${_scSamples.length}개`;
  clearBtn.style.display = _scSamples.length > 0 ? '' : 'none';
  list.innerHTML = _scSamples.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,0,0,0.02);border-radius:8px;font-size:11px;">
      <span style="color:rgba(0,0,0,0.3);font-weight:600;flex-shrink:0;">${i+1}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(0,0,0,0.6);">${escapeHtml(s.substring(0, 80))}...</span>
      <span style="flex-shrink:0;color:rgba(0,0,0,0.25);font-size:10px;">${s.length}자</span>
      <button onclick="scRemoveSample(${i})" style="flex-shrink:0;border:none;background:none;color:#ff3b30;cursor:pointer;font-size:12px;padding:2px 4px;">&times;</button>
    </div>
  `).join('');
}

async function scAnalyzeAndSave() {
  const name = document.getElementById('sc-name').value.trim();
  if (!name) { toast('스타일 이름을 입력하세요', 'error'); document.getElementById('sc-name').focus(); return; }

  // textarea에 남아있는 텍스트도 포함
  const remaining = document.getElementById('sc-paste-text').value.trim();
  if (remaining.length >= 20) _scSamples.push(remaining);

  const allText = _scSamples.join('\n\n');
  if (allText.length < 50) { toast('최소 50자 이상의 샘플 글이 필요합니다', 'error'); return; }

  const btn = document.getElementById('sc-btn-analyze');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 분석 중...';

  try {
    await api('/api/writing-styles/analyze-create', { method: 'POST', body: { name, sample_text: allText } });
    toast(`"${name}" 스타일이 저장되었습니다!`);
    // 초기화
    _scSamples = [];
    document.getElementById('sc-name').value = '';
    document.getElementById('sc-paste-text').value = '';
    scRenderSamples();
    loadStyleList();
  } catch (e) {
    toast('분석 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '3. 분석하여 저장';
  }
}

async function scAiGenerate() {
  const name = document.getElementById('sc-name').value.trim();
  const desc = document.getElementById('sc-ai-desc').value.trim();
  if (!name) { toast('스타일 이름을 입력하세요', 'error'); document.getElementById('sc-name').focus(); return; }
  if (!desc) { toast('스타일 설명을 입력하세요', 'error'); return; }

  const btn = document.getElementById('sc-btn-ai');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 생성 중...';

  try {
    await api('/api/writing-styles/ai-create', { method: 'POST', body: { name, description: desc } });
    toast(`"${name}" 스타일이 생성되었습니다!`);
    document.getElementById('sc-name').value = '';
    document.getElementById('sc-ai-desc').value = '';
    loadStyleList();
  } catch (e) {
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '3. AI로 생성하여 저장';
  }
}

async function createNewStyle() {
  const btn = document.getElementById('style-create-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';

  try {
    if (_styleCreateMode === 'ai') {
      const name = document.getElementById('style-ai-name').value.trim();
      const desc = document.getElementById('style-ai-desc').value.trim();
      if (!name) { toast('스타일 이름을 입력하세요', 'error'); return; }
      if (!desc) { toast('스타일 설명을 입력하세요', 'error'); return; }

      const res = await api('/api/writing-styles/ai-create', {
        method: 'POST',
        body: { name, description: desc },
      });
      toast(`"${name}" 스타일이 생성되었습니다!`);

    } else {
      const name = document.getElementById('style-paste-name').value.trim();
      const text = document.getElementById('style-paste-text').value.trim();
      if (!name) { toast('스타일 이름을 입력하세요', 'error'); return; }
      if (text.length < 50) { toast('최소 50자 이상의 글을 입력하세요', 'error'); return; }

      const res = await api('/api/writing-styles/analyze-create', {
        method: 'POST',
        body: { name, sample_text: text },
      });
      toast(`"${name}" 스타일이 분석 저장되었습니다!`);
    }

    closeStyleCreateModal();
    loadStyleList();
  } catch (e) {
    toast('스타일 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = _styleCreateMode === 'ai' ? 'AI 생성' : '분석하여 저장';
  }
}
