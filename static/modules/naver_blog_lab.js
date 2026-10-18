window._nblArticles = [];

function nblActiveProfileId() {
  return parseInt(window._globalProfileId || 0, 10) || 0;
}

async function nblLoadActiveProfile() {
  const profileId = nblActiveProfileId();
  if (!profileId) return null;
  if (window._globalProfileData && String(window._globalProfileData.id || '') === String(profileId)) {
    return window._globalProfileData;
  }
  try {
    const profile = await api(`/api/library/profiles/${profileId}`);
    window._globalProfileData = profile;
    return profile;
  } catch {
    return null;
  }
}

function nblReadBlogId(profile) {
  const raw = profile?.platform_accounts;
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw.naver || '').trim();
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.naver || '').trim();
  } catch {
    return '';
  }
}

async function nblPersistBlogId(blogId) {
  const profileId = nblActiveProfileId();
  const normalized = nblNormalizeBlogId(blogId);
  if (!profileId || !normalized) return;
  const profile = await nblLoadActiveProfile();
  let platformAccounts = {};
  try {
    platformAccounts = profile?.platform_accounts
      ? (typeof profile.platform_accounts === 'string' ? JSON.parse(profile.platform_accounts) : profile.platform_accounts)
      : {};
  } catch {
    platformAccounts = {};
  }
  if (String(platformAccounts?.naver || '').trim() === normalized) return;
  platformAccounts = { ...platformAccounts, naver: normalized };
  await api(`/api/library/profiles/${profileId}`, {
    method: 'PUT',
    body: { platform_accounts: JSON.stringify(platformAccounts) },
  });
  const refreshed = await api(`/api/library/profiles/${profileId}`);
  window._globalProfileData = refreshed;
  window.dispatchEvent(new CustomEvent('makeke-profile-research-sync', {
    detail: { profileId: String(profileId), platform: 'naver', account: normalized },
  }));
}

function nblNormalizeBlogId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/(?:m\.)?blog\.naver\.com\/([^/?#]+)/i);
  if (match) return match[1].trim();
  return raw.replace(/^@/, '').trim();
}

function nblLog(message, tone = 'info') {
  const el = document.getElementById('nbl-log');
  if (!el) return;
  const color = tone === 'error' ? '#fca5a5' : tone === 'success' ? '#86efac' : '#d1d5db';
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  el.innerHTML += `<div style="color:${color};">[${time}] ${escapeHtml(String(message || ''))}</div>`;
  el.scrollTop = el.scrollHeight;
}

function nblDisplayAccount(item) {
  return String(item?.account || '').trim() || '기본분류';
}

function nblPublishedDate(item) {
  const raw = String(item?.published_at || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw : '';
}

function nblBuildStats(items) {
  if (!items.length) {
    return {
      count: 0,
      avgCount: '0',
      accountCount: 0,
      latestLabel: '-',
      lengthAverage: '0',
      dailyAverage: '0',
      monthlyAverage: '0',
      urlCount: 0,
    };
  }
  const accounts = Array.from(new Set(items.map(item => nblDisplayAccount(item))));
  const dayKeys = new Set();
  const monthKeys = new Set();
  items.forEach(item => {
    const raw = nblPublishedDate(item);
    if (!raw) return;
    const dayKey = raw.slice(0, 10);
    const monthKey = raw.slice(0, 7);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) dayKeys.add(dayKey);
    if (/^\d{4}-\d{2}$/.test(monthKey)) monthKeys.add(monthKey);
  });
  const latest = [...items]
    .map(item => nblPublishedDate(item))
    .filter(Boolean)
    .sort()
    .pop() || '';
  const totalLength = items.reduce((sum, item) => sum + Number(item.text_length || 0), 0);
  const urlCount = items.filter(item => String(item.post_url || '').trim()).length;
  return {
    count: items.length,
    avgCount: (items.length / Math.max(accounts.length, 1)).toFixed(1),
    accountCount: Math.max(accounts.length, 1),
    latestLabel: latest ? String(latest).replace('T', ' ').slice(0, 16) : '-',
    lengthAverage: Math.round(totalLength / Math.max(items.length, 1)).toLocaleString('ko-KR'),
    dailyAverage: (items.length / Math.max(dayKeys.size, 1)).toFixed(1),
    monthlyAverage: (items.length / Math.max(monthKeys.size, 1)).toFixed(1),
    urlCount,
  };
}

function nblPopulateAccountFilter(items) {
  const select = document.getElementById('nbl-account-filter');
  if (!select) return;
  const current = select.value || '';
  const accounts = Array.from(new Set((items || []).map(item => nblDisplayAccount(item)))).sort();
  select.innerHTML = '<option value="">전체 블로그</option>' + accounts.map(account => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join('');
  if (accounts.includes(current)) select.value = current;
}

function nblGetAccountFilteredItems(items) {
  const account = (document.getElementById('nbl-account-filter')?.value || '').trim().toLowerCase();
  return (items || []).filter(item => {
    if (!account) return true;
    return nblDisplayAccount(item).toLowerCase() === account;
  });
}

function nblRenderStats(items) {
  const stats = nblBuildStats(items);
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  setText('nbl-stat-count', stats.count);
  setText('nbl-stat-average', stats.avgCount);
  setText('nbl-stat-accounts', stats.accountCount);
  setText('nbl-stat-latest', stats.latestLabel);
  setText('nbl-stat-length-average', stats.lengthAverage);
  setText('nbl-stat-daily-average', stats.dailyAverage);
  setText('nbl-stat-monthly-average', stats.monthlyAverage);
  setText('nbl-stat-url-count', stats.urlCount);
  nblRenderMetricChart(items);
  nblRenderTimeChart(items, 'nbl-year-chart', 'year');
  nblRenderTimeChart(items, 'nbl-month-chart', 'month');
  nblRenderTimeChart(items, 'nbl-day-chart', 'day');
}

function nblRenderMetricChart(items) {
  const container = document.getElementById('nbl-metric-chart');
  if (!container) return;
  const counts = new Map();
  (items || []).forEach(item => {
    const key = nblDisplayAccount(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const metrics = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], index) => ({ label, value, index }));
  nblRenderBars(container, metrics, 'nbl-metric-bar', '표시할 블로그 수집 그래프가 없습니다.');
}

function nblRenderTimeChart(items, containerId, mode) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const grouped = new Map();
  (items || []).forEach(item => {
    const raw = nblPublishedDate(item);
    if (!raw) return;
    let key = '';
    if (mode === 'year') key = raw.slice(0, 4);
    if (mode === 'month') key = raw.slice(0, 7);
    if (mode === 'day') key = raw.slice(0, 10);
    const pattern = mode === 'year' ? /^\d{4}$/ : mode === 'month' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(key)) return;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  const metrics = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(mode === 'year' ? 0 : mode === 'month' ? -12 : -14)
    .map(([label, value], index) => ({
      label: mode === 'year' ? `${label}년` : label,
      value,
      index,
    }));
  const emptyMessage =
    mode === 'year' ? '연도별 통계 데이터가 없습니다.' :
    mode === 'month' ? '월별 통계 데이터가 없습니다.' :
    '일별 통계 데이터가 없습니다.';
  if (metrics.length === 1) {
    const metric = metrics[0];
    container.innerHTML = `
      <div style="padding:18px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(251,191,36,0.06));border:1px solid rgba(255,140,0,0.12);display:flex;justify-content:space-between;align-items:end;gap:12px;">
        <div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:6px;">집계 구간이 1개라 비교 막대 대신 요약으로 표시합니다.</div>
          <div style="font-size:20px;font-weight:800;color:#1c1c1e;">${escapeHtml(metric.label)}</div>
        </div>
        <div style="font-size:28px;font-weight:800;color:#ff8c00;">${metric.value}개</div>
      </div>
    `;
    return;
  }
  nblRenderBars(container, metrics, `nbl-${mode}-bar`, emptyMessage);
}

function nblRenderBars(container, metrics, barClass, emptyMessage) {
  const colors = [
    'linear-gradient(90deg,#ff8c00,#fbbf24)',
    'linear-gradient(90deg,#007aff,#5ac8fa)',
    'linear-gradient(90deg,#5856d6,#7d7aff)',
    'linear-gradient(90deg,#34c759,#86efac)',
  ];
  if (!metrics.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:13px;">${emptyMessage}</div>`;
    return;
  }
  const maxValue = Math.max(1, ...metrics.map(metric => metric.value));
  container.innerHTML = metrics.map(metric => `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${escapeHtml(metric.label)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${metric.value}개</div>
      </div>
      <div style="height:12px;border-radius:999px;background:rgba(0,0,0,0.05);overflow:hidden;">
        <div class="${barClass}" data-width="${Math.max(6, Math.round((metric.value / maxValue) * 100))}" style="width:0%;height:100%;border-radius:999px;background:${colors[metric.index % colors.length]};transition:width 0.9s cubic-bezier(0.2,0.9,0.2,1);transition-delay:${metric.index * 0.08}s;"></div>
      </div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll(`.${barClass}`).forEach(bar => {
      bar.style.width = `${Number(bar.dataset.width || 0)}%`;
    });
  });
}

function nblRenderArticles(items) {
  const query = (document.getElementById('nbl-query-input')?.value || '').trim().toLowerCase();
  const list = document.getElementById('nbl-article-list');
  if (!list) return;
  const filtered = nblGetAccountFilteredItems(items).filter(item => {
    const haystack = `${item.title || ''} ${item.preview || ''} ${item.source || ''} ${item.account || ''}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:28px;color:rgba(0,0,0,0.3);font-size:13px;">조회 결과가 없습니다.</div>';
    return;
  }
  list.innerHTML = filtered.map(item => `
    <div style="display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="min-width:0;flex:1;">
        <div style="font-size:14px;font-weight:700;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.title || '제목 없음')}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:6px;line-height:1.6;">${escapeHtml(item.preview || '')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          <span style="padding:4px 10px;border-radius:999px;background:rgba(0,122,255,0.08);font-size:11px;font-weight:700;color:#007aff;">${escapeHtml(nblDisplayAccount(item))}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(255,140,0,0.08);font-size:11px;font-weight:700;color:#ff8c00;">${escapeHtml(item.source || 'naver-blog')}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(52,199,89,0.08);font-size:11px;color:#34c759;">길이 ${Number(item.text_length || 0).toLocaleString('ko-KR')}자</span>
          ${item.post_url ? `<a href="${escapeHtml(item.post_url)}" target="_blank" rel="noopener" style="padding:4px 10px;border-radius:999px;background:rgba(88,86,214,0.08);font-size:11px;color:#5856d6;text-decoration:none;">원문 열기</a>` : ''}
        </div>
      </div>
      <div style="font-size:11px;color:rgba(0,0,0,0.35);white-space:nowrap;">${escapeHtml(nblPublishedDate(item) || '-')}</div>
    </div>
  `).join('');
}

function nblBuildConsulting(style, items) {
  if (!style) {
    return {
      html: '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.32);font-size:13px;">아직 분석 결과가 없습니다.</div>',
      report: '# 네이버블로그 연구소 보고서\n\n아직 분석 결과가 없습니다.\n',
    };
  }
  const stats = nblBuildStats(items);
  const recommendations = [
    `현재 글 어조는 "${style.tone || '미확인'}"에 가깝습니다. 제목과 도입부에서 이 톤이 얼마나 일관되게 유지되는지 점검하면 좋습니다.`,
    `문장 스타일은 "${style.sentence_style || '미확인'}" 성향입니다. 자주 쓰는 시작 패턴과 마무리 패턴을 템플릿화하면 운영 속도가 더 빨라질 수 있습니다.`,
    `블로그당 평균 ${stats.avgCount}개 수준으로 쌓여 있습니다. 많이 쓰는 주제와 발행 간격을 같이 보면 재현 가능한 운영 규칙을 만들기 좋습니다.`,
  ];
  const html = recommendations.map(text => `
    <div style="padding:12px 14px;border-radius:14px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);font-size:13px;line-height:1.7;color:#1c1c1e;margin-bottom:10px;">
      ${escapeHtml(text)}
    </div>
  `).join('');
  const report = [
    '# 네이버블로그 연구소 보고서',
    '',
    '## 수집 통계',
    `- 총 글 수: ${stats.count}`,
    `- 블로그당 평균 글 수: ${stats.avgCount}`,
    `- 블로그 수: ${stats.accountCount}`,
    `- 평균 본문 길이: ${stats.lengthAverage}자`,
    `- 일별 평균 발행 수: ${stats.dailyAverage}`,
    `- 월별 평균 발행 수: ${stats.monthlyAverage}`,
    `- 게시 URL 보유 수: ${stats.urlCount}`,
    `- 최근 게시일: ${stats.latestLabel}`,
    '',
    '## 문체 분석',
    `- 어조: ${style.tone || ''}`,
    `- 문장 스타일: ${style.sentence_style || ''}`,
    `- 자주 쓰는 표현: ${(style.expressions || []).join(', ')}`,
    `- 수사법: ${(style.rhetoric || []).join(', ')}`,
    `- 시작 패턴: ${style.opening_pattern || ''}`,
    `- 마무리 패턴: ${style.closing_pattern || ''}`,
    '',
    '## 컨설팅',
    ...recommendations.map(text => `- ${text}`),
    '',
  ].join('\n');
  return { html, report };
}

function nblApplyView() {
  const filtered = nblGetAccountFilteredItems(window._nblArticles || []);
  nblRenderStats(filtered);
  nblRenderArticles(filtered);
}

function nblRenderAnalysis(style, items) {
  const container = document.getElementById('nbl-analysis');
  if (!container) return;
  if (!style) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.32);font-size:13px;">아직 스타일 분석 결과가 없습니다.</div>';
  } else {
    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        <div style="padding:14px;border-radius:16px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);">
          <div style="font-size:11px;color:rgba(0,0,0,0.4);">어조</div>
          <div style="margin-top:8px;font-size:15px;font-weight:800;color:#1c1c1e;">${escapeHtml(style.tone || '-')}</div>
        </div>
        <div style="padding:14px;border-radius:16px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:11px;color:rgba(0,0,0,0.4);">문장 스타일</div>
          <div style="margin-top:8px;font-size:15px;font-weight:800;color:#1c1c1e;">${escapeHtml(style.sentence_style || '-')}</div>
        </div>
      </div>
      <div style="margin-top:14px;padding:14px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.45);margin-bottom:8px;">자주 쓰는 표현</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${(style.expressions || []).map(text => `<span style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.08);font-size:12px;font-weight:700;color:#ff8c00;">${escapeHtml(text)}</span>`).join('')}</div>
      </div>
    `;
  }
  const consulting = nblBuildConsulting(style, items);
  const consultingEl = document.getElementById('nbl-consulting');
  if (consultingEl) consultingEl.innerHTML = consulting.html;
  const reportEl = document.getElementById('nbl-report');
  if (reportEl) reportEl.value = consulting.report;
}

async function nblRefreshDashboard() {
  const profileId = nblActiveProfileId();
  const input = document.getElementById('nbl-profile-input');
  const profile = await nblLoadActiveProfile();
  const defaultBlogId = nblNormalizeBlogId(nblReadBlogId(profile));
  if (input && defaultBlogId && !String(input.value || '').trim()) input.value = defaultBlogId;

  if (!profileId) {
    window._nblArticles = [];
    nblRenderStats(window._nblArticles);
    nblRenderArticles(window._nblArticles);
    nblRenderAnalysis(null, window._nblArticles);
    return;
  }
  const payload = await api(`/api/articles/profile/${profileId}`);
  window._nblArticles = (payload?.articles || []).filter(item => String(item.source || '').includes('naver'));
  nblPopulateAccountFilter(window._nblArticles);
  nblApplyView();
  let style = null;
  try {
    style = await api(`/api/style/analyze?source=naver&profile_id=${profileId}&platform=blog`, { method: 'POST' });
  } catch {}
  nblRenderAnalysis(style, nblGetAccountFilteredItems(window._nblArticles));
}

async function nblCollectBlogs() {
  const profileId = nblActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  const profile = await nblLoadActiveProfile();
  const fallbackBlogId = nblNormalizeBlogId(nblReadBlogId(profile));
  const blogId = nblNormalizeBlogId(document.getElementById('nbl-profile-input')?.value || '') || fallbackBlogId;
  if (!blogId) {
    toast('프로필에 네이버 블로그 ID를 입력하거나, 여기에서 블로그 URL/ID를 입력하세요.', 'error');
    return;
  }
  const btn = document.getElementById('nbl-collect-btn');
  const status = document.getElementById('nbl-status');
  const progress = document.getElementById('nbl-progress');
  const bar = document.getElementById('nbl-progress-bar');
  const log = document.getElementById('nbl-log');
  if (log) log.innerHTML = '';
  if (btn) btn.disabled = true;
  if (status) status.textContent = `${blogId} 수집 중`;
  if (progress) progress.style.display = 'block';
  if (bar) bar.style.width = '0%';

  try {
    await nblPersistBlogId(blogId);
    nblLog(`프로필 #${profileId} 기준 네이버 블로그 ${blogId} 수집을 시작합니다.`);
    const res = await fetch(`/api/articles/profile/${profileId}/naver-blog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blog_id: blogId }),
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(line => {
        if (!line.startsWith('data:')) return;
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.status === 'ok') {
            nblLog(data.title || '글 저장 완료', 'success');
            if (bar && data.total) bar.style.width = `${Math.min(100, Math.round((data.current / data.total) * 100))}%`;
          } else if (data.status === 'error') {
            nblLog(data.message || '수집 실패', 'error');
          } else if (data.status === 'done') {
            nblLog(`총 ${data.crawled || data.total || 0}건 수집 완료`, 'success');
            if (bar) bar.style.width = '100%';
          } else {
            nblLog(data.message || '진행 중');
          }
        } catch {}
      });
    }
    toast('네이버 블로그 수집 완료');
    await nblRefreshDashboard();
  } catch (e) {
    nblLog('수집 실패: ' + e.message, 'error');
    toast('네이버 블로그 수집 실패: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '대기 중';
  }
}

async function nblAnalyzeBlogs() {
  const profileId = nblActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!window._nblArticles || !window._nblArticles.length) {
    await nblRefreshDashboard();
  }
  if (!window._nblArticles.length) {
    toast('먼저 네이버 블로그 글을 수집하세요.', 'error');
    return;
  }
  try {
    const style = await api(`/api/style/analyze?source=naver&profile_id=${profileId}&platform=blog`, { method: 'POST' });
    nblRenderAnalysis(style, nblGetAccountFilteredItems(window._nblArticles));
    toast('네이버 블로그 문체 분석 완료');
  } catch (e) {
    toast('분석 실패: ' + e.message, 'error');
  }
}

async function nblCopyReport() {
  const text = document.getElementById('nbl-report')?.value || '';
  if (!text.trim()) {
    toast('복사할 보고서가 없습니다.', 'error');
    return;
  }
  await navigator.clipboard.writeText(text);
  toast('보고서를 복사했습니다.');
}

async function nblDownloadDocs() {
  const items = nblGetAccountFilteredItems(window._nblArticles || []);
  if (!items.length) {
    toast('다운로드할 문서가 없습니다.', 'error');
    return;
  }
  const lines = ['# 네이버블로그 연구소 문서 묶음', ''];
  items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.title || '제목 없음'}`);
    lines.push(`- 블로그: ${nblDisplayAccount(item)}`);
    lines.push(`- 게시일: ${nblPublishedDate(item) || '-'}`);
    lines.push(`- 원문 URL: ${item.post_url || '-'}`);
    lines.push(`- 길이: ${Number(item.text_length || 0).toLocaleString('ko-KR')}자`);
    lines.push('');
    lines.push(item.preview || '');
    lines.push('');
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  const account = (document.getElementById('nbl-account-filter')?.value || 'all').trim() || 'all';
  link.href = URL.createObjectURL(blob);
  link.download = `naver-blog-lab-${account}-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('문서 다운로드를 시작했습니다.');
}

async function nblDeleteSelectedAccount() {
  const profileId = nblActiveProfileId();
  const account = (document.getElementById('nbl-account-filter')?.value || '').trim();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!account) {
    toast('삭제할 블로그를 먼저 선택하세요.', 'error');
    return;
  }
  if (!confirm(`${account} 블로그 수집 데이터를 삭제할까요?`)) return;
  try {
    await api(`/api/articles/profile/${profileId}/naver-reset?account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    toast(`${account} 블로그 데이터 삭제 완료`);
    await nblRefreshDashboard();
  } catch (e) {
    toast('블로그 삭제 실패: ' + e.message, 'error');
  }
}

async function nblResetCollection() {
  const profileId = nblActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!confirm('현재 프로필의 네이버 블로그 수집 데이터를 모두 초기화할까요?')) return;
  try {
    await api(`/api/articles/profile/${profileId}/naver-reset`, { method: 'DELETE' });
    toast('네이버 블로그 수집 데이터 초기화 완료');
    await nblRefreshDashboard();
  } catch (e) {
    toast('초기화 실패: ' + e.message, 'error');
  }
}

async function nblInit() {
  await nblRefreshDashboard();
}

if (!window._nblResearchSyncBound) {
  window._nblResearchSyncBound = true;
  window.addEventListener('makeke-profile-research-sync', async event => {
    const detail = event?.detail || {};
    const currentProfileId = String(nblActiveProfileId() || '');
    if (!currentProfileId || String(detail.profileId || '') !== currentProfileId) return;
    if (detail.platform && detail.platform !== 'naver' && detail.platform !== 'all') return;
    const input = document.getElementById('nbl-profile-input');
    if (input && detail.account) input.value = String(detail.account || '').trim();
    try {
      await nblRefreshDashboard();
    } catch {}
  });
}
