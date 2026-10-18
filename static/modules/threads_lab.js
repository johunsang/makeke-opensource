window._tlArticles = [];

function tlActiveProfileId() {
  return parseInt(window._globalProfileId || 0, 10) || 0;
}

async function tlLoadActiveProfile() {
  const profileId = tlActiveProfileId();
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

function tlReadThreadsAccount(profile) {
  const raw = profile?.platform_accounts;
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw.threads || '').trim();
  try {
    const parsed = JSON.parse(raw);
    return String(parsed?.threads || '').trim();
  } catch {
    return '';
  }
}

function tlDisplayAccount(item) {
  return String(item?.account || '').trim() || '기본분류';
}

function tlPublishedDate(item) {
  const raw = String(item?.published_at || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw : '';
}

async function tlPersistThreadsAccount(username) {
  const profileId = tlActiveProfileId();
  const normalized = tlExtractUsername(username);
  if (!profileId || !normalized) return;
  const profile = await tlLoadActiveProfile();
  let platformAccounts = {};
  try {
    platformAccounts = profile?.platform_accounts
      ? (typeof profile.platform_accounts === 'string' ? JSON.parse(profile.platform_accounts) : profile.platform_accounts)
      : {};
  } catch {
    platformAccounts = {};
  }
  if (String(platformAccounts?.threads || '').trim() === normalized) return;
  platformAccounts = { ...platformAccounts, threads: normalized };
  await api(`/api/library/profiles/${profileId}`, {
    method: 'PUT',
    body: { platform_accounts: JSON.stringify(platformAccounts) },
  });
  const refreshed = await api(`/api/library/profiles/${profileId}`);
  window._globalProfileData = refreshed;
  window.dispatchEvent(new CustomEvent('makeke-profile-research-sync', {
    detail: { profileId: String(profileId), platform: 'threads', account: normalized },
  }));
}

function tlLog(message, tone = 'info') {
  const el = document.getElementById('tl-log');
  if (!el) return;
  const color = tone === 'error' ? '#fca5a5' : tone === 'success' ? '#86efac' : '#d1d5db';
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  el.innerHTML += `<div style="color:${color};">[${time}] ${escapeHtml(String(message || ''))}</div>`;
  el.scrollTop = el.scrollHeight;
}

function tlExtractUsername(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('@')) return raw.slice(1);
  const match = raw.match(/threads\.(?:net|com)\/@([^/?#]+)/i);
  if (match) return match[1];
  return raw.replace(/^@/, '').trim();
}

function tlBuildStats(items) {
  if (!items.length) return {
    count: 0, avgCount: '0', accountCount: 0, latestLabel: '-',
    likeTotal: 0, commentTotal: 0, repostTotal: 0, viewTotal: 0,
    likeAverage: '0', commentAverage: '0', repostAverage: '0', viewAverage: '0',
    dailyAverage: '0', monthlyAverage: '0',
  };
  const accounts = Array.from(new Set(items.map(item => tlDisplayAccount(item))));
  const dayKeys = new Set();
  const monthKeys = new Set();
  items.forEach(item => {
    const raw = tlPublishedDate(item);
    if (!raw) return;
    if (!raw) return;
    const dayKey = raw.slice(0, 10);
    const monthKey = raw.slice(0, 7);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) dayKeys.add(dayKey);
    if (/^\d{4}-\d{2}$/.test(monthKey)) monthKeys.add(monthKey);
  });
  const latest = [...items]
    .map(item => tlPublishedDate(item))
    .filter(Boolean)
    .sort()
    .pop() || '';
  return {
    count: items.length,
    avgCount: (items.length / Math.max(accounts.length, 1)).toFixed(1),
    accountCount: accounts.length,
    latestLabel: latest ? String(latest).replace('T', ' ').slice(0, 16) : '-',
    likeTotal: items.reduce((sum, item) => sum + Number(item.like_count || 0), 0),
    commentTotal: items.reduce((sum, item) => sum + Number(item.comment_count || 0), 0),
    repostTotal: items.reduce((sum, item) => sum + Number(item.repost_count || 0), 0),
    viewTotal: items.reduce((sum, item) => sum + Number(item.view_count || 0), 0),
    likeAverage: (items.reduce((sum, item) => sum + Number(item.like_count || 0), 0) / Math.max(items.length, 1)).toFixed(1),
    commentAverage: (items.reduce((sum, item) => sum + Number(item.comment_count || 0), 0) / Math.max(items.length, 1)).toFixed(1),
    repostAverage: (items.reduce((sum, item) => sum + Number(item.repost_count || 0), 0) / Math.max(items.length, 1)).toFixed(1),
    viewAverage: (items.reduce((sum, item) => sum + Number(item.view_count || 0), 0) / Math.max(items.length, 1)).toFixed(1),
    dailyAverage: (items.length / Math.max(dayKeys.size, 1)).toFixed(1),
    monthlyAverage: (items.length / Math.max(monthKeys.size, 1)).toFixed(1),
  };
}

function tlPopulateAccountFilter(items) {
  const select = document.getElementById('tl-account-filter');
  if (!select) return;
  const current = select.value || '';
  const accounts = Array.from(new Set((items || []).map(item => tlDisplayAccount(item)))).sort();
  select.innerHTML = `<option value="">전체 계정</option>` + accounts.map(account => `<option value="${escapeHtml(account)}">${escapeHtml(account === '기본분류' ? account : '@' + account)}</option>`).join('');
  if (accounts.includes(current)) select.value = current;
}

function tlGetAccountFilteredItems(items) {
  const account = (document.getElementById('tl-account-filter')?.value || '').trim().toLowerCase();
  return (items || []).filter(item => {
    if (!account) return true;
    return tlDisplayAccount(item).toLowerCase() === account;
  });
}

function tlRenderStats(items) {
  const stats = tlBuildStats(items);
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = String(value); };
  setText('tl-stat-count', stats.count);
  setText('tl-stat-average', stats.avgCount);
  setText('tl-stat-accounts', stats.accountCount);
  setText('tl-stat-latest', stats.latestLabel);
  setText('tl-stat-like-total', stats.likeTotal);
  setText('tl-stat-comment-total', stats.commentTotal);
  setText('tl-stat-repost-total', stats.repostTotal);
  setText('tl-stat-view-total', stats.viewTotal);
  setText('tl-stat-like-average', stats.likeAverage);
  setText('tl-stat-comment-average', stats.commentAverage);
  setText('tl-stat-repost-average', stats.repostAverage);
  setText('tl-stat-view-average', stats.viewAverage);
  setText('tl-stat-daily-average', stats.dailyAverage);
  setText('tl-stat-monthly-average', stats.monthlyAverage);
  tlRenderMetricChart(items);
  tlRenderYearChart(items);
  tlRenderMonthChart(items);
  tlRenderDayChart(items);
}

function tlRenderMetricChart(items) {
  const container = document.getElementById('tl-metric-chart');
  if (!container) return;
  const countsByAccount = new Map();
  (items || []).forEach(item => {
    const account = tlDisplayAccount(item);
    countsByAccount.set(account, (countsByAccount.get(account) || 0) + 1);
  });
  const metrics = Array.from(countsByAccount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([account, value], index) => ({
      label: account === '기본분류' ? account : `@${account}`,
      value,
      color: [
        'linear-gradient(90deg,#ff8c00,#fbbf24)',
        'linear-gradient(90deg,#007aff,#5ac8fa)',
        'linear-gradient(90deg,#5856d6,#7d7aff)',
        'linear-gradient(90deg,#34c759,#86efac)',
      ][index % 4],
    }));
  if (!metrics.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:13px;">표시할 수집 그래프가 없습니다.</div>';
    return;
  }
  const maxValue = Math.max(1, ...metrics.map(metric => metric.value));
  container.innerHTML = metrics.map((metric, index) => `
    <div style="margin-bottom:${index === metrics.length - 1 ? 0 : 14}px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${metric.label}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${metric.value}개</div>
      </div>
      <div style="height:12px;border-radius:999px;background:rgba(0,0,0,0.05);overflow:hidden;">
        <div class="tl-metric-bar" data-width="${Math.max(6, Math.round((metric.value / maxValue) * 100))}" style="width:0%;height:100%;border-radius:999px;background:${metric.color};transition:width 0.9s cubic-bezier(0.2,0.9,0.2,1);transition-delay:${index * 0.08}s;"></div>
      </div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.tl-metric-bar').forEach(bar => {
      const width = Number(bar.dataset.width || 0);
      bar.style.width = `${width}%`;
    });
  });
}

function tlRenderYearChart(items) {
  const container = document.getElementById('tl-year-chart');
  if (!container) return;
  const yearly = new Map();
  (items || []).forEach(item => {
    const raw = tlPublishedDate(item);
    if (!raw) return;
    const year = raw.slice(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    yearly.set(year, (yearly.get(year) || 0) + 1);
  });
  const metrics = Array.from(yearly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, value], index) => ({
      label: `${year}년`,
      value,
      color: [
        'linear-gradient(90deg,#ff8c00,#fbbf24)',
        'linear-gradient(90deg,#007aff,#5ac8fa)',
        'linear-gradient(90deg,#5856d6,#7d7aff)',
        'linear-gradient(90deg,#34c759,#86efac)',
      ][index % 4],
    }));
  if (!metrics.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:13px;">연도별 통계 데이터가 없습니다.</div>';
    return;
  }
  if (metrics.length === 1) {
    container.innerHTML = `
      <div style="padding:18px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(251,191,36,0.06));border:1px solid rgba(255,140,0,0.12);display:flex;justify-content:space-between;align-items:end;gap:12px;">
        <div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:6px;">집계 구간이 1개라 비교 막대 대신 요약으로 표시합니다.</div>
          <div style="font-size:20px;font-weight:800;color:#1c1c1e;">${escapeHtml(metrics[0].label)}</div>
        </div>
        <div style="font-size:28px;font-weight:800;color:#ff8c00;">${metrics[0].value}개</div>
      </div>
    `;
    return;
  }
  const maxValue = Math.max(1, ...metrics.map(metric => metric.value));
  container.innerHTML = metrics.map((metric, index) => `
    <div style="margin-bottom:${index === metrics.length - 1 ? 0 : 14}px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${metric.label}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${metric.value}개</div>
      </div>
      <div style="height:12px;border-radius:999px;background:rgba(0,0,0,0.05);overflow:hidden;">
        <div class="tl-year-bar" data-width="${Math.max(6, Math.round((metric.value / maxValue) * 100))}" style="width:0%;height:100%;border-radius:999px;background:${metric.color};transition:width 0.9s cubic-bezier(0.2,0.9,0.2,1);transition-delay:${index * 0.08}s;"></div>
      </div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.tl-year-bar').forEach(bar => {
      const width = Number(bar.dataset.width || 0);
      bar.style.width = `${width}%`;
    });
  });
}

function tlRenderMonthChart(items) {
  const container = document.getElementById('tl-month-chart');
  if (!container) return;
  const monthly = new Map();
  (items || []).forEach(item => {
    const raw = tlPublishedDate(item);
    const month = raw.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    monthly.set(month, (monthly.get(month) || 0) + 1);
  });
  const metrics = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, value], index) => ({
      label: month,
      value,
      color: [
        'linear-gradient(90deg,#ff8c00,#fbbf24)',
        'linear-gradient(90deg,#007aff,#5ac8fa)',
        'linear-gradient(90deg,#5856d6,#7d7aff)',
        'linear-gradient(90deg,#34c759,#86efac)',
      ][index % 4],
    }));
  if (!metrics.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:13px;">월별 통계 데이터가 없습니다.</div>';
    return;
  }
  if (metrics.length === 1) {
    container.innerHTML = `
      <div style="padding:18px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(251,191,36,0.06));border:1px solid rgba(255,140,0,0.12);display:flex;justify-content:space-between;align-items:end;gap:12px;">
        <div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:6px;">집계 구간이 1개라 비교 막대 대신 요약으로 표시합니다.</div>
          <div style="font-size:20px;font-weight:800;color:#1c1c1e;">${escapeHtml(metrics[0].label)}</div>
        </div>
        <div style="font-size:28px;font-weight:800;color:#ff8c00;">${metrics[0].value}개</div>
      </div>
    `;
    return;
  }
  const maxValue = Math.max(1, ...metrics.map(metric => metric.value));
  container.innerHTML = metrics.map((metric, index) => `
    <div style="margin-bottom:${index === metrics.length - 1 ? 0 : 14}px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${metric.label}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${metric.value}개</div>
      </div>
      <div style="height:12px;border-radius:999px;background:rgba(0,0,0,0.05);overflow:hidden;">
        <div class="tl-month-bar" data-width="${Math.max(6, Math.round((metric.value / maxValue) * 100))}" style="width:0%;height:100%;border-radius:999px;background:${metric.color};transition:width 0.9s cubic-bezier(0.2,0.9,0.2,1);transition-delay:${index * 0.08}s;"></div>
      </div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.tl-month-bar').forEach(bar => {
      const width = Number(bar.dataset.width || 0);
      bar.style.width = `${width}%`;
    });
  });
}

function tlRenderDayChart(items) {
  const container = document.getElementById('tl-day-chart');
  if (!container) return;
  const daily = new Map();
  (items || []).forEach(item => {
    const raw = tlPublishedDate(item);
    const day = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    daily.set(day, (daily.get(day) || 0) + 1);
  });
  const metrics = Array.from(daily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([day, value], index) => ({
      label: day,
      value,
      color: [
        'linear-gradient(90deg,#ff8c00,#fbbf24)',
        'linear-gradient(90deg,#007aff,#5ac8fa)',
        'linear-gradient(90deg,#5856d6,#7d7aff)',
        'linear-gradient(90deg,#34c759,#86efac)',
      ][index % 4],
    }));
  if (!metrics.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.3);font-size:13px;">일별 통계 데이터가 없습니다.</div>';
    return;
  }
  if (metrics.length === 1) {
    container.innerHTML = `
      <div style="padding:18px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(251,191,36,0.06));border:1px solid rgba(255,140,0,0.12);display:flex;justify-content:space-between;align-items:end;gap:12px;">
        <div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:6px;">집계 구간이 1개라 비교 막대 대신 요약으로 표시합니다.</div>
          <div style="font-size:20px;font-weight:800;color:#1c1c1e;">${escapeHtml(metrics[0].label)}</div>
        </div>
        <div style="font-size:28px;font-weight:800;color:#ff8c00;">${metrics[0].value}개</div>
      </div>
    `;
    return;
  }
  const maxValue = Math.max(1, ...metrics.map(metric => metric.value));
  container.innerHTML = metrics.map((metric, index) => `
    <div style="margin-bottom:${index === metrics.length - 1 ? 0 : 14}px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${metric.label}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);">${metric.value}개</div>
      </div>
      <div style="height:12px;border-radius:999px;background:rgba(0,0,0,0.05);overflow:hidden;">
        <div class="tl-day-bar" data-width="${Math.max(6, Math.round((metric.value / maxValue) * 100))}" style="width:0%;height:100%;border-radius:999px;background:${metric.color};transition:width 0.9s cubic-bezier(0.2,0.9,0.2,1);transition-delay:${index * 0.08}s;"></div>
      </div>
    </div>
  `).join('');
  requestAnimationFrame(() => {
    container.querySelectorAll('.tl-day-bar').forEach(bar => {
      const width = Number(bar.dataset.width || 0);
      bar.style.width = `${width}%`;
    });
  });
}

function tlRenderArticles(items) {
  const query = (document.getElementById('tl-query-input')?.value || '').trim().toLowerCase();
  const list = document.getElementById('tl-article-list');
  if (!list) return;
  const filtered = tlGetAccountFilteredItems(items).filter(item => {
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
          <span style="padding:4px 10px;border-radius:999px;background:rgba(0,122,255,0.08);font-size:11px;font-weight:700;color:#007aff;">${escapeHtml(tlDisplayAccount(item) === '기본분류' ? '기본분류' : '@' + tlDisplayAccount(item))}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(255,140,0,0.08);font-size:11px;font-weight:700;color:#ff8c00;">${escapeHtml(item.source || 'threads')}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(52,199,89,0.08);font-size:11px;color:#34c759;">좋아요 ${Number(item.like_count || 0)}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(0,122,255,0.08);font-size:11px;color:#007aff;">댓글 ${Number(item.comment_count || 0)}</span>
          <span style="padding:4px 10px;border-radius:999px;background:rgba(88,86,214,0.08);font-size:11px;color:#5856d6;">재게시 ${Number(item.repost_count || 0)}</span>
          ${Number(item.view_count || 0) ? `<span style="padding:4px 10px;border-radius:999px;background:rgba(255,149,0,0.08);font-size:11px;color:#ff9500;">조회 ${Number(item.view_count || 0)}</span>` : ''}
        </div>
      </div>
      <div style="font-size:11px;color:rgba(0,0,0,0.35);white-space:nowrap;">${escapeHtml(tlPublishedDate(item) || '-')}</div>
    </div>
  `).join('');
}

function tlBuildConsulting(style, items) {
  if (!style) {
    return {
      html: '<div style="text-align:center;padding:24px;color:rgba(0,0,0,0.32);font-size:13px;">아직 분석 결과가 없습니다.</div>',
      report: '# 스레드 연구소 보고서\n\n아직 분석 결과가 없습니다.\n',
    };
  }
  const stats = tlBuildStats(items);
  const recommendations = [
    `현재 어조는 "${style.tone || '미확인'}"로 읽히며, 짧은 글에서도 이 톤이 유지되는지 점검하면 좋습니다.`,
    `문장 스타일은 "${style.sentence_style || '미확인'}" 성향입니다. 후킹 문장과 마무리 문장을 템플릿화하면 반복 운영이 쉬워집니다.`,
    `자주 쓰는 표현 ${Array.isArray(style.expressions) ? style.expressions.slice(0, 3).join(', ') : ''}은 시그니처가 될 수 있지만 과반복되면 피로도가 올라갈 수 있습니다.`,
  ];
  const html = recommendations.map(text => `
    <div style="padding:12px 14px;border-radius:14px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);font-size:13px;line-height:1.7;color:#1c1c1e;margin-bottom:10px;">
      ${escapeHtml(text)}
    </div>
  `).join('');
  const report = [
    '# 스레드 연구소 보고서',
    '',
    '## 수집 통계',
    `- 총 갯수: ${stats.count}`,
    `- 평균 갯수: ${stats.avgCount}`,
    `- 계정 수: ${stats.accountCount}`,
    `- 좋아요 총합: ${stats.likeTotal}`,
    `- 댓글 총합: ${stats.commentTotal}`,
    `- 재게시 총합: ${stats.repostTotal}`,
    `- 조회 총합: ${stats.viewTotal}`,
    `- 게시물당 평균 좋아요: ${stats.likeAverage}`,
    `- 게시물당 평균 댓글: ${stats.commentAverage}`,
    `- 게시물당 평균 재게시: ${stats.repostAverage}`,
    `- 게시물당 평균 조회: ${stats.viewAverage}`,
    `- 일별 평균 작성 수: ${stats.dailyAverage}`,
    `- 월별 평균 작성 수: ${stats.monthlyAverage}`,
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

function tlApplyView() {
  const filteredItems = tlGetAccountFilteredItems(window._tlArticles || []);
  tlRenderStats(filteredItems);
  tlRenderArticles(filteredItems);
}

function tlRenderAnalysis(style, items) {
  const container = document.getElementById('tl-analysis');
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
  const consulting = tlBuildConsulting(style, items);
  const consultingEl = document.getElementById('tl-consulting');
  if (consultingEl) consultingEl.innerHTML = consulting.html;
  const reportEl = document.getElementById('tl-report');
  if (reportEl) reportEl.value = consulting.report;
}

async function tlRefreshDashboard() {
  const profileId = tlActiveProfileId();
  if (!profileId) {
    window._tlArticles = [];
    tlRenderStats(window._tlArticles);
    tlRenderArticles(window._tlArticles);
    tlRenderAnalysis(null, window._tlArticles);
    return;
  }
  const payload = await api(`/api/articles/profile/${profileId}`);
  window._tlArticles = (payload?.articles || []).filter(item => String(item.source || '').includes('threads'));
  tlPopulateAccountFilter(window._tlArticles);
  tlApplyView();
  let style = null;
  try { style = await api(`/api/style/analyze?source=threads&profile_id=${profileId}&platform=threads`, { method: 'POST' }); } catch {}
  tlRenderAnalysis(style, tlGetAccountFilteredItems(window._tlArticles));
}

async function tlCollectThreads() {
  const username = tlExtractUsername(document.getElementById('tl-profile-input')?.value || '');
  const profileId = tlActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  const profile = await tlLoadActiveProfile();
  const fallbackThreadsId = tlReadThreadsAccount(profile);
  const effectiveUsername = username || fallbackThreadsId;
  if (!effectiveUsername) {
    toast('프로필에 스레드 계정을 입력하거나, 여기에서 URL/@username을 입력하세요.', 'error');
    return;
  }
  const btn = document.getElementById('tl-collect-btn');
  const status = document.getElementById('tl-status');
  const progress = document.getElementById('tl-progress');
  const bar = document.getElementById('tl-progress-bar');
  const log = document.getElementById('tl-log');
  if (log) log.innerHTML = '';
  if (btn) btn.disabled = true;
  if (status) status.textContent = '@' + tlExtractUsername(effectiveUsername) + ' 수집 중';
  if (progress) progress.style.display = 'block';
  if (bar) bar.style.width = '0%';

  try {
    await tlPersistThreadsAccount(effectiveUsername);
    tlLog(`프로필 #${profileId} 기준 Chrome CDP 스레드 수집을 시작합니다.`);
    const res = await fetch(`/api/articles/profile/${profileId}/threads-chrome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: effectiveUsername }),
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      decoder.decode(value, { stream: true }).split('\n').forEach(line => {
        if (!line.startsWith('data:')) return;
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.status === 'ok') {
            tlLog(data.title || '글 저장 완료', 'success');
            if (bar && data.total) bar.style.width = `${Math.min(100, Math.round((data.current / data.total) * 100))}%`;
          } else if (data.status === 'error') {
            tlLog(data.error || data.message || '수집 실패', 'error');
          } else if (data.status === 'done') {
            tlLog(`총 ${data.total || data.crawled || 0}건 수집 완료`, 'success');
          } else {
            tlLog(data.message || '진행 중');
          }
        } catch {}
      });
    }
    toast('스레드 수집 완료');
    await tlRefreshDashboard();
  } catch (e) {
    tlLog('수집 실패: ' + e.message, 'error');
    toast('스레드 수집 실패: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '대기 중';
  }
}

async function tlAnalyzeThreads() {
  const profileId = tlActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!window._tlArticles || !window._tlArticles.length) {
    await tlRefreshDashboard();
  }
  if (!window._tlArticles.length) {
    toast('먼저 스레드 글을 수집하세요.', 'error');
    return;
  }
  try {
    const style = await api(`/api/style/analyze?source=threads&profile_id=${profileId}&platform=threads`, { method: 'POST' });
    tlRenderAnalysis(style, window._tlArticles);
    toast('스레드 문체 분석 완료');
  } catch (e) {
    toast('분석 실패: ' + e.message, 'error');
  }
}

async function tlCopyReport() {
  const text = document.getElementById('tl-report')?.value || '';
  if (!text.trim()) {
    toast('복사할 보고서가 없습니다.', 'error');
    return;
  }
  await navigator.clipboard.writeText(text);
  toast('보고서를 복사했습니다.');
}

async function tlDeleteSelectedAccount() {
  const profileId = tlActiveProfileId();
  const account = (document.getElementById('tl-account-filter')?.value || '').trim();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!account) {
    toast('삭제할 계정을 먼저 선택하세요.', 'error');
    return;
  }
  if (!confirm(`@${account} 계정 수집 데이터를 삭제할까요?`)) return;
  try {
    await api(`/api/articles/profile/${profileId}/threads-reset?account=${encodeURIComponent(account)}`, { method: 'DELETE' });
    toast(`@${account} 계정 데이터 삭제 완료`);
    await tlRefreshDashboard();
  } catch (e) {
    toast('계정 삭제 실패: ' + e.message, 'error');
  }
}

async function tlResetThreadsCollection() {
  const profileId = tlActiveProfileId();
  if (!profileId) {
    toast('먼저 프로필을 선택하세요.', 'error');
    return;
  }
  if (!confirm('현재 프로필의 스레드 수집 데이터를 모두 초기화할까요?')) return;
  try {
    await api(`/api/articles/profile/${profileId}/threads-reset`, { method: 'DELETE' });
    toast('스레드 수집 데이터 초기화 완료');
    await tlRefreshDashboard();
  } catch (e) {
    toast('초기화 실패: ' + e.message, 'error');
  }
}

async function tlInit() {
  await tlRefreshDashboard();
}

if (!window._tlResearchSyncBound) {
  window._tlResearchSyncBound = true;
  window.addEventListener('makeke-profile-research-sync', async event => {
    const detail = event?.detail || {};
    const currentProfileId = String(tlActiveProfileId() || '');
    if (!currentProfileId || String(detail.profileId || '') !== currentProfileId) return;
    if (detail.platform && detail.platform !== 'threads' && detail.platform !== 'all') return;
    const input = document.getElementById('tl-profile-input');
    if (input && detail.account) input.value = String(detail.account || '').trim();
    try {
      await tlRefreshDashboard();
    } catch {}
  });
}
