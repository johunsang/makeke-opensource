let _spInitialized = false;
let _spState = {
  loading: false,
  saving: false,
  generatingPlan: false,
  generatingDraft: false,
  config: null,
  plan: null,
  selectedDay: null,
};

function spEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function spNormalizeListInput(raw) {
  return String(raw || '')
    .split(/[,/\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function spJoinList(items) {
  return Array.isArray(items) ? items.join(', ') : '';
}

function spStatusTone(status) {
  const map = {
    planned: { label: '계획만 있음', bg: 'rgba(0,122,255,0.08)', fg: '#007aff' },
    draft_ready: { label: '초안 준비됨', bg: 'rgba(52,199,89,0.12)', fg: '#34c759' },
    posted: { label: '게시 완료', bg: 'rgba(255,140,0,0.14)', fg: '#ff8c00' },
    skipped: { label: '건너뜀', bg: 'rgba(255,59,48,0.08)', fg: '#ff3b30' },
  };
  return map[status] || map.planned;
}

function spSetStatus(message, tone = 'info') {
  const el = document.getElementById('sns-planner-status');
  if (!el) return;
  const colors = {
    info: { bg: 'rgba(0,122,255,0.08)', fg: '#007aff' },
    success: { bg: 'rgba(52,199,89,0.10)', fg: '#34c759' },
    warning: { bg: 'rgba(255,149,0,0.10)', fg: '#ff9500' },
    error: { bg: 'rgba(255,59,48,0.08)', fg: '#ff3b30' },
  };
  const palette = colors[tone] || colors.info;
  el.innerHTML = `<div style="padding:12px 14px;border-radius:14px;background:${palette.bg};color:${palette.fg};font-size:13px;line-height:1.6;">${spEscapeHtml(message)}</div>`;
}

function spCollectConfig() {
  const profileId = Number(window._globalProfileData?.id || 0);
  return {
    brand_name: document.getElementById('sns-planner-brand-name')?.value?.trim() || '',
    brand_category: document.getElementById('sns-planner-brand-category')?.value?.trim() || '',
    brand_summary: document.getElementById('sns-planner-brand-summary')?.value?.trim() || '',
    product_or_service: document.getElementById('sns-planner-product')?.value?.trim() || '',
    target_audience: document.getElementById('sns-planner-audience')?.value?.trim() || '',
    core_offer: document.getElementById('sns-planner-offer')?.value?.trim() || '',
    goals: document.getElementById('sns-planner-goals')?.value?.trim() || '',
    primary_cta: document.getElementById('sns-planner-cta')?.value?.trim() || '',
    tone_and_manner: document.getElementById('sns-planner-tone')?.value?.trim() || '',
    taboo_words: document.getElementById('sns-planner-taboo')?.value?.trim() || '',
    content_pillars: spNormalizeListInput(document.getElementById('sns-planner-pillars')?.value || ''),
    campaign_keywords: spNormalizeListInput(document.getElementById('sns-planner-keywords')?.value || ''),
    start_date: document.getElementById('sns-planner-start-date')?.value || '',
    months: 3,
    profile_id: profileId,
    extra_notes: document.getElementById('sns-planner-notes')?.value?.trim() || '',
  };
}

function spApplyProfileDefaults(config) {
  const next = { ...(config || {}) };
  const profile = window._globalProfileData || null;
  if (!profile) return next;
  if (!next.brand_name && profile.name) next.brand_name = profile.name;
  if (!next.brand_category && profile.business_type) next.brand_category = profile.business_type;
  if (!next.brand_summary && profile.description) next.brand_summary = profile.description;
  if (!next.product_or_service && profile.business_name) next.product_or_service = profile.business_name;
  if (!next.tone_and_manner && profile.tone) next.tone_and_manner = profile.tone;
  if (!next.profile_id && profile.id) next.profile_id = profile.id;
  return next;
}

function spFillConfigForm(config) {
  const merged = spApplyProfileDefaults(config || {});
  const assign = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  };
  assign('sns-planner-brand-name', merged.brand_name);
  assign('sns-planner-brand-category', merged.brand_category);
  assign('sns-planner-brand-summary', merged.brand_summary);
  assign('sns-planner-product', merged.product_or_service);
  assign('sns-planner-audience', merged.target_audience);
  assign('sns-planner-offer', merged.core_offer);
  assign('sns-planner-goals', merged.goals);
  assign('sns-planner-cta', merged.primary_cta);
  assign('sns-planner-tone', merged.tone_and_manner);
  assign('sns-planner-taboo', merged.taboo_words);
  assign('sns-planner-pillars', spJoinList(merged.content_pillars));
  assign('sns-planner-keywords', spJoinList(merged.campaign_keywords));
  assign('sns-planner-start-date', merged.start_date);
  assign('sns-planner-notes', merged.extra_notes);
  _spState.config = merged;
  spRenderProfileSummary();
}

function spRenderProfileSummary() {
  const nameEl = document.getElementById('sns-planner-profile-name');
  const metaEl = document.getElementById('sns-planner-profile-meta');
  if (!nameEl || !metaEl) return;
  const profile = window._globalProfileData || null;
  if (!profile) {
    nameEl.textContent = '프로필 미선택';
    metaEl.textContent = '프로필을 선택하면 현재 프로필 정보가 플래너 설정 기본값으로 채워집니다.';
    return;
  }
  nameEl.textContent = profile.name || '이름 없는 프로필';
  metaEl.textContent = [
    profile.business_type || '',
    profile.goal || '',
  ].filter(Boolean).join(' · ') || '현재 프로필 기반으로 브랜드 기본값을 채웁니다.';
}

function spRenderSummary(plan) {
  const wrap = document.getElementById('sns-planner-summary');
  if (!wrap) return;
  if (!plan?.summary) {
    wrap.innerHTML = '<div style="padding:20px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;color:rgba(0,0,0,0.35);font-size:13px;line-height:1.7;">30일 계획을 생성하면 브랜드 코어, 주차별 전략, 운영 원칙이 여기 정리됩니다.</div>';
    return;
  }
  const summary = plan.summary;
  const monthly = Array.isArray(summary.monthly_focus) ? summary.monthly_focus : [];
  const principles = Array.isArray(summary.posting_principles) ? summary.posting_principles : [];
  const pillars = Array.isArray(summary.content_pillars) ? summary.content_pillars : [];
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:8px;">브랜드 코어</div>
        <div style="font-size:14px;color:#1c1c1e;line-height:1.7;">${spEscapeHtml(summary.brand_core || '-')}</div>
      </div>
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:8px;">포지셔닝</div>
        <div style="font-size:14px;color:#1c1c1e;line-height:1.7;">${spEscapeHtml(summary.positioning || '-')}</div>
      </div>
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:8px;">채널 역할</div>
        <div style="font-size:13px;color:#1c1c1e;line-height:1.7;"><strong>Threads</strong> ${spEscapeHtml(summary.channel_roles?.threads || '-')}</div>
        <div style="font-size:13px;color:#1c1c1e;line-height:1.7;margin-top:6px;"><strong>X</strong> ${spEscapeHtml(summary.channel_roles?.twitter || '-')}</div>
      </div>
    </div>
    <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
      ${monthly.map(item => `
        <div style="padding:16px;border-radius:16px;background:linear-gradient(135deg, rgba(255,140,0,0.10), rgba(251,191,36,0.12));border:1px solid rgba(255,140,0,0.16);">
          <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-bottom:6px;">${spEscapeHtml(item.label || '')}</div>
          <div style="font-size:15px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${spEscapeHtml(item.focus || '')}</div>
          <div style="font-size:13px;color:#1c1c1e;line-height:1.7;">${spEscapeHtml(item.goal || '')}</div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:14px;padding:16px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">
      <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:10px;">운영 원칙</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${principles.length ? principles.map(item => `<div style="font-size:13px;line-height:1.7;color:#1c1c1e;">• ${spEscapeHtml(item)}</div>`).join('') : '<div style="font-size:13px;color:rgba(0,0,0,0.35);">아직 원칙이 없습니다.</div>'}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
        ${pillars.map(item => `<span style="display:inline-flex;align-items:center;padding:7px 12px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff8c00;font-size:12px;font-weight:700;">${spEscapeHtml(item)}</span>`).join('')}
      </div>
    </div>
    ${(() => {
      const weeks = Array.isArray(summary.weekly_strategy) ? summary.weekly_strategy : [];
      if (!weeks.length) return '';
      const phaseColors = {
        '기': { bg: 'rgba(0,122,255,0.08)', border: 'rgba(0,122,255,0.15)', color: '#007aff', label: '기(起)' },
        '승': { bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.15)', color: '#ff9500', label: '승(承)' },
        '전결': { bg: 'rgba(255,45,85,0.08)', border: 'rgba(255,45,85,0.15)', color: '#ff2d55', label: '전결(轉結)' },
      };
      return '<div style="margin-top:14px;padding:16px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">' +
        '<div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:12px;">주차별 전략 아크 (기승전결)</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;">' +
        weeks.map(w => {
          const phaseKey = (w.phase || '').split('-')[0];
          const pc = phaseColors[phaseKey] || { bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.08)', color: '#1c1c1e', label: phaseKey };
          return '<div style="padding:12px 14px;border-radius:12px;background:' + pc.bg + ';border:1px solid ' + pc.border + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
              '<span style="font-size:12px;font-weight:800;color:' + pc.color + ';">' + w.week + '주차</span>' +
              '<span style="font-size:10px;padding:3px 8px;border-radius:999px;background:' + pc.bg + ';color:' + pc.color + ';font-weight:700;">' + spEscapeHtml(w.phase || '') + '</span>' +
            '</div>' +
            '<div style="font-size:13px;font-weight:700;color:#1c1c1e;margin-top:6px;line-height:1.5;">' + spEscapeHtml(w.theme || '') + '</div>' +
            '<div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;line-height:1.5;">' + spEscapeHtml(w.goal || '') + '</div>' +
          '</div>';
        }).join('') +
        '</div></div>';
    })()}
  `;
}

function spSelectDay(dayNumber, { silent = false } = {}) {
  const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
  const selected = days.find(item => Number(item.day) === Number(dayNumber)) || days[0] || null;
  _spState.selectedDay = selected ? Number(selected.day) : null;
  // 선택된 day에 맞는 주차 탭 자동 전환
  const d = Number(_spState.selectedDay) || 1;
  _spState._dayListMonth = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3;
  spRenderDayList();
  spRenderDayDetail();
  if (!silent && selected) {
    spSetStatus(`${selected.day}일차 계획을 불러왔습니다.`, 'info');
  }
}

function spRenderDayList() {
  const wrap = document.getElementById('sns-planner-day-list');
  const metaEl = document.getElementById('sns-planner-day-meta');
  if (!wrap || !metaEl) return;
  const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
  if (!days.length) {
    metaEl.textContent = '아직 계획이 없습니다.';
    wrap.innerHTML = '<div style="padding:20px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;color:rgba(0,0,0,0.35);font-size:13px;text-align:center;">30일 계획을 만들면 하루 3포스트 목록이 여기에 생깁니다.</div>';
    return;
  }
  const draftCount = days.filter(item => item.threads_text || item.twitter_text).length;
  const postedCount = days.filter(item => item.status === 'posted').length;
  metaEl.textContent = `총 ${days.length}일 · 초안 ${draftCount}일 · 게시 완료 ${postedCount}일`;

  // 주차별 탭으로 분할 (기승전결 4주)
  const phaseLabels = { 1: '기(起) 존재감', 2: '승(承) 인사이트', 3: '전(轉) 신뢰', 4: '결(結) 전환' };
  const months = [
    { label: '1주차', sub: phaseLabels[1], days: days.filter(d => d.day >= 1 && d.day <= 7) },
    { label: '2주차', sub: phaseLabels[2], days: days.filter(d => d.day >= 8 && d.day <= 14) },
    { label: '3주차', sub: phaseLabels[3], days: days.filter(d => d.day >= 15 && d.day <= 21) },
    { label: '4주차', sub: phaseLabels[4], days: days.filter(d => d.day >= 22 && d.day <= 30) },
  ];

  // 현재 선택된 day가 속한 주 활성화
  const sel = Number(_spState.selectedDay) || 1;
  const activeMonth = sel <= 7 ? 0 : sel <= 14 ? 1 : sel <= 21 ? 2 : 3;
  if (_spState._dayListMonth === undefined) _spState._dayListMonth = activeMonth;

  const tabsHtml = months.map((m, i) => {
    const isActive = i === _spState._dayListMonth;
    const mDraft = m.days.filter(d => d.threads_text || d.twitter_text).length;
    const mPosted = m.days.filter(d => d.status === 'posted').length;
    return `<button type="button" onclick="_spSwitchMonth(${i})" style="flex:1;padding:10px 6px;border-radius:12px;border:${isActive ? '1px solid rgba(255,140,0,0.3)' : '1px solid rgba(0,0,0,0.06)'};background:${isActive ? 'rgba(255,140,0,0.08)' : '#fff'};cursor:pointer;text-align:center;">
      <div style="font-size:13px;font-weight:800;color:${isActive ? '#ff8c00' : '#1c1c1e'};">${m.label}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px;">${m.sub}</div>
      <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;">초안 ${mDraft} · 게시 ${mPosted}</div>
    </button>`;
  }).join('');

  const currentDays = months[_spState._dayListMonth]?.days || [];
  const listHtml = currentDays.map(item => {
    const tone = spStatusTone(item.status);
    const active = Number(item.day) === Number(_spState.selectedDay);
    const hasDraft = Boolean(item.threads_text || item.twitter_text);
    return `
      <button type="button" onclick="spSelectDay(${item.day}, { silent: true })" style="width:100%;text-align:left;padding:14px 16px;border-radius:16px;border:${active ? '1px solid rgba(255,140,0,0.35)' : '1px solid rgba(0,0,0,0.08)'};background:${active ? 'rgba(255,140,0,0.08)' : '#fff'};cursor:pointer;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:13px;font-weight:800;color:#1c1c1e;">Day ${item.day}</span>
            ${item.slot ? `<span style="font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.5);font-weight:700;">#${item.slot}</span>` : ''}
            ${item.slot_role ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:${item.slot === 1 ? 'rgba(0,122,255,0.08)' : item.slot === 2 ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)'};color:${item.slot === 1 ? '#007aff' : item.slot === 2 ? '#34c759' : '#ff9500'};font-weight:700;">${spEscapeHtml(item.slot_role)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${hasDraft ? '<span style="font-size:11px;color:#34c759;font-weight:700;">초안 있음</span>' : ''}
            <span style="display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:800;">${spEscapeHtml(tone.label)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="font-size:12px;color:rgba(0,0,0,0.38);">${spEscapeHtml(item.date || '')}</span>
          ${item.phase ? `<span style="font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(var(--accent-rgb,255,140,0),0.08);color:var(--accent,#ff8c00);font-weight:700;">${spEscapeHtml(item.phase)}</span>` : ''}
          <span style="font-size:11px;color:rgba(0,0,0,0.3);">${spEscapeHtml(item.pillar || '')}</span>
        </div>
        <div style="font-size:13px;color:#1c1c1e;line-height:1.6;font-weight:700;">${spEscapeHtml(item.theme || '')}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.45);line-height:1.6;">${spEscapeHtml(item.objective || '')}</div>
      </button>
    `;
  }).join('');

  wrap.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:14px;">${tabsHtml}</div>
    <div style="display:flex;flex-direction:column;gap:10px;">${listHtml}</div>
  `;
}

function _spSwitchMonth(monthIndex) {
  _spState._dayListMonth = monthIndex;
  spRenderDayList();
}

function spRenderChecklist(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return '<div style="font-size:12px;color:rgba(0,0,0,0.35);">체크리스트가 아직 없습니다.</div>';
  }
  return list.map(item => `
    <div style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#1c1c1e;line-height:1.7;">
      <span style="width:18px;height:18px;border-radius:999px;background:rgba(255,140,0,0.10);color:#ff8c00;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">✓</span>
      <span>${spEscapeHtml(item)}</span>
    </div>
  `).join('');
}

function spRenderDayDetail() {
  const wrap = document.getElementById('sns-planner-day-detail');
  if (!wrap) return;
  const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
  const day = days.find(item => Number(item.day) === Number(_spState.selectedDay)) || days[0] || null;
  if (!day) {
    wrap.innerHTML = '<div style="padding:20px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;color:rgba(0,0,0,0.35);font-size:13px;text-align:center;">왼쪽에서 날짜를 선택하면 초안 작업창이 여기 열립니다.</div>';
    return;
  }
  const tone = spStatusTone(day.status);
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
      <div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2 style="margin:0;">Day ${day.day}</h2>
          <span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-size:11px;font-weight:800;">${spEscapeHtml(tone.label)}</span>
        </div>
        <div style="font-size:12px;color:rgba(0,0,0,0.38);margin-top:6px;">${spEscapeHtml(day.date || '')} · ${spEscapeHtml(day.pillar || '')}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" type="button" onclick="spGenerateDayDraft(${day.day})">Gemini 초안 생성</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="spSelectAdjacentDay(-1)">이전</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="spSelectAdjacentDay(1)">다음</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px;">
      <div style="padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:6px;">주제</div>
        <div style="font-size:14px;font-weight:700;color:#1c1c1e;line-height:1.6;">${spEscapeHtml(day.theme || '')}</div>
      </div>
      <div style="padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:6px;">목적</div>
        <div style="font-size:14px;color:#1c1c1e;line-height:1.6;">${spEscapeHtml(day.objective || '')}</div>
      </div>
      <div style="padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;">
        <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-bottom:6px;">각도 / CTA</div>
        <div style="font-size:13px;color:#1c1c1e;line-height:1.7;">${spEscapeHtml(day.angle || '')}</div>
        <div style="font-size:12px;color:#ff8c00;line-height:1.6;margin-top:8px;">${spEscapeHtml(day.cta || '')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;">
      <div class="card" style="margin:0;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;">Threads 초안</div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="spCopyField('threads')">복사</button>
        </div>
        <textarea id="sns-planner-threads-text" rows="12" style="width:100%;padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;resize:vertical;font-size:13px;line-height:1.7;box-sizing:border-box;" placeholder="선택한 날의 Threads 초안이 여기에 들어옵니다.">${spEscapeHtml(day.threads_text || '')}</textarea>
      </div>
      <div class="card" style="margin:0;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;">X 초안</div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="spCopyField('twitter')">복사</button>
        </div>
        <textarea id="sns-planner-twitter-text" rows="8" style="width:100%;padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;resize:vertical;font-size:13px;line-height:1.7;box-sizing:border-box;" placeholder="선택한 날의 X 초안이 여기에 들어옵니다.">${spEscapeHtml(day.twitter_text || '')}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;margin-bottom:10px;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;">답글 초안</div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="spCopyField('reply')">복사</button>
        </div>
        <textarea id="sns-planner-reply-text" rows="5" style="width:100%;padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;resize:vertical;font-size:13px;line-height:1.7;box-sizing:border-box;" placeholder="댓글이나 반응이 왔을 때 바로 붙여넣을 답글 초안입니다.">${spEscapeHtml(day.reply_text || '')}</textarea>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,320px);gap:14px;margin-top:14px;">
      <div class="card" style="margin:0;padding:16px;">
        <div style="font-size:14px;font-weight:800;color:#1c1c1e;margin-bottom:10px;">비주얼 / 메모</div>
        <div class="form-group" style="margin-bottom:12px;">
          <label for="sns-planner-visual-hint">비주얼 힌트</label>
          <textarea id="sns-planner-visual-hint" rows="3" placeholder="썸네일이나 카드 한 장으로 무엇을 보여줄지 메모합니다.">${spEscapeHtml(day.visual_hint || day.asset_hint || '')}</textarea>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label for="sns-planner-day-notes">운영 메모</label>
          <textarea id="sns-planner-day-notes" rows="4" placeholder="이 날의 포인트나 수정 메모를 적어두세요.">${spEscapeHtml(day.notes || '')}</textarea>
        </div>
      </div>
      <div class="card" style="margin:0;padding:16px;">
        <div style="font-size:14px;font-weight:800;color:#1c1c1e;margin-bottom:10px;">체크리스트</div>
        <div id="sns-planner-checklist" style="display:flex;flex-direction:column;gap:8px;">${spRenderChecklist(day.checklist)}</div>
        <div class="form-group" style="margin:14px 0 0 0;">
          <label for="sns-planner-day-status">진행 상태</label>
          <select id="sns-planner-day-status">
            <option value="planned" ${day.status === 'planned' ? 'selected' : ''}>계획만 있음</option>
            <option value="draft_ready" ${day.status === 'draft_ready' ? 'selected' : ''}>초안 준비됨</option>
            <option value="posted" ${day.status === 'posted' ? 'selected' : ''}>게시 완료</option>
            <option value="skipped" ${day.status === 'skipped' ? 'selected' : ''}>건너뜀</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">
          <button class="btn btn-primary btn-sm" type="button" onclick="spSaveDay()">이 날 초안 저장</button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="spSelectNextPending()">다음 미완료</button>
        </div>
      </div>
    </div>
  `;
}

async function spLoadConfigAndPlan() {
  _spState.loading = true;
  try {
    const [configRes, planRes] = await Promise.all([
      api('/api/social-planner/config'),
      api('/api/social-planner/plan'),
    ]);
    const config = configRes?.config || {};
    spFillConfigForm(config);
    _spState.plan = planRes?.plan || null;
    spRenderSummary(_spState.plan);
    const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
    _spState.selectedDay = days[0]?.day || null;
    spRenderDayList();
    spRenderDayDetail();
    spSetStatus(days.length ? '저장된 30일 계획을 불러왔습니다.' : '설정을 저장하거나 바로 30일 계획을 생성해보세요.', 'info');
  } catch (e) {
    spSetStatus('플래너 데이터를 불러오지 못했습니다: ' + e.message, 'error');
  } finally {
    _spState.loading = false;
  }
}

async function spSaveConfig() {
  const payload = spApplyProfileDefaults(spCollectConfig());
  _spState.saving = true;
  spSetStatus('플래너 설정을 저장하는 중입니다.', 'info');
  try {
    const res = await api('/api/social-planner/config', {
      method: 'POST',
      body: payload,
    });
    _spState.config = res.config || payload;
    spFillConfigForm(_spState.config);
    spSetStatus('플래너 설정을 저장했습니다.', 'success');
    toast('플래너 설정 저장 완료');
  } catch (e) {
    spSetStatus('설정 저장 실패: ' + e.message, 'error');
    toast('설정 저장 실패: ' + e.message, 'error');
  } finally {
    _spState.saving = false;
  }
}

function _spShowOverlay(msg, sub) {
  const overlay = document.getElementById('sns-planner-loading');
  if (!overlay) return;
  const msgEl = document.getElementById('sns-planner-loading-msg');
  const subEl = document.getElementById('sns-planner-loading-sub');
  if (msgEl) msgEl.textContent = msg || 'Gemini가 30일 계획을 만들고 있습니다';
  if (subEl) subEl.textContent = sub || '최대 1분 정도 걸릴 수 있습니다. 잠시만 기다려주세요.';
  overlay.style.display = 'flex';
}
function _spHideOverlay() {
  const overlay = document.getElementById('sns-planner-loading');
  if (overlay) overlay.style.display = 'none';
}

async function spGeneratePlan() {
  if (typeof _logActivity === 'function') _logActivity('sns-planner', 'generate');
  const payload = spApplyProfileDefaults(spCollectConfig());
  _spState.generatingPlan = true;
  const btn = document.querySelector('[onclick="spGeneratePlan()"]');
  const btnOrigText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px;"></span>생성 중...'; }
  _spShowOverlay('Gemini가 30일 계획을 만들고 있습니다', '최대 1분 정도 걸릴 수 있습니다. 잠시만 기다려주세요.');
  spSetStatus('Gemini가 30일(90포스트) 계획을 만드는 중입니다.', 'info');
  try {
    const res = await api('/api/social-planner/plan/generate', {
      method: 'POST',
      body: { config: payload },
    });
    _spState.config = res.config || payload;
    _spState.plan = res.plan || null;
    _spState.selectedDay = _spState.plan?.days?.[0]?.day || null;
    spRenderSummary(_spState.plan);
    spRenderDayList();
    spRenderDayDetail();
    spSetStatus(`30일 계획을 만들었습니다. ${res.source === 'fallback' ? '기본 템플릿으로 정리했습니다.' : 'Gemini 전략안을 반영했습니다.'}`, res.source === 'fallback' ? 'warning' : 'success');
    toast('30일 SNS 계획 생성 완료');
  } catch (e) {
    spSetStatus('계획 생성 실패: ' + e.message, 'error');
    toast('계획 생성 실패: ' + e.message, 'error');
  } finally {
    _spState.generatingPlan = false;
    _spHideOverlay();
    if (btn) { btn.disabled = false; btn.textContent = btnOrigText; }
  }
}

async function spGenerateDayDraft(dayNumber) {
  if (!dayNumber) return;
  _spState.generatingDraft = true;
  const draftBtn = document.querySelector(`[onclick="spGenerateDayDraft(${dayNumber})"]`);
  const draftBtnOrig = draftBtn ? draftBtn.textContent : '';
  if (draftBtn) { draftBtn.disabled = true; draftBtn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:4px;"></span>생성 중...'; }
  _spShowOverlay(`Day ${dayNumber} 초안을 Gemini로 만들고 있습니다`, '약 30초 정도 걸릴 수 있습니다.');
  spSetStatus(`${dayNumber}일차 초안을 Gemini로 만드는 중입니다.`, 'info');
  try {
    const res = await api('/api/social-planner/plan/day-draft', {
      method: 'POST',
      body: { day: Number(dayNumber) },
    });
    _spState.plan = res.plan || _spState.plan;
    _spState.selectedDay = Number(dayNumber);
    spRenderSummary(_spState.plan);
    spRenderDayList();
    spRenderDayDetail();
    spSetStatus(`${dayNumber}일차 초안을 준비했습니다. ${res.source === 'fallback' ? '기본 초안으로 정리했습니다.' : 'Gemini 초안을 저장했습니다.'}`, res.source === 'fallback' ? 'warning' : 'success');
    toast(`Day ${dayNumber} 초안 생성 완료`);
  } catch (e) {
    spSetStatus('초안 생성 실패: ' + e.message, 'error');
    toast('초안 생성 실패: ' + e.message, 'error');
  } finally {
    _spState.generatingDraft = false;
    _spHideOverlay();
    if (draftBtn) { draftBtn.disabled = false; draftBtn.textContent = draftBtnOrig; }
  }
}

async function spSaveDay() {
  const dayNumber = Number(_spState.selectedDay || 0);
  if (!dayNumber) {
    toast('저장할 날짜를 먼저 고르세요.', 'error');
    return;
  }
  const checklist = spNormalizeListInput((document.getElementById('sns-planner-checklist')?.innerText || '').replace(/✓/g, ''));
  try {
    const res = await api('/api/social-planner/plan/day-update', {
      method: 'POST',
      body: {
        day: dayNumber,
        status: document.getElementById('sns-planner-day-status')?.value || 'planned',
        threads_text: document.getElementById('sns-planner-threads-text')?.value || '',
        twitter_text: document.getElementById('sns-planner-twitter-text')?.value || '',
        reply_text: document.getElementById('sns-planner-reply-text')?.value || '',
        visual_hint: document.getElementById('sns-planner-visual-hint')?.value || '',
        notes: document.getElementById('sns-planner-day-notes')?.value || '',
        checklist,
      },
    });
    _spState.plan = res.plan || _spState.plan;
    spRenderDayList();
    spRenderDayDetail();
    spSetStatus(`${dayNumber}일차 초안을 저장했습니다.`, 'success');
    toast(`Day ${dayNumber} 저장 완료`);
  } catch (e) {
    spSetStatus('초안 저장 실패: ' + e.message, 'error');
    toast('초안 저장 실패: ' + e.message, 'error');
  }
}

async function spCopyField(field) {
  const map = {
    threads: 'sns-planner-threads-text',
    twitter: 'sns-planner-twitter-text',
    reply: 'sns-planner-reply-text',
  };
  const el = document.getElementById(map[field]);
  const text = (el?.value || '').trim();
  if (!text) {
    toast('복사할 내용이 없습니다.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('복사 완료');
  } catch (e) {
    toast('복사 실패: ' + e.message, 'error');
  }
}

function spSelectAdjacentDay(offset) {
  const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
  if (!days.length) return;
  const currentIndex = days.findIndex(item => Number(item.day) === Number(_spState.selectedDay));
  const nextIndex = Math.min(days.length - 1, Math.max(0, (currentIndex < 0 ? 0 : currentIndex) + Number(offset || 0)));
  const next = days[nextIndex];
  if (next) spSelectDay(next.day);
}

function spSelectNextPending() {
  const days = Array.isArray(_spState.plan?.days) ? _spState.plan.days : [];
  const next = days.find(item => item.status !== 'posted');
  if (!next) {
    toast('모든 날짜가 게시 완료 상태입니다.');
    return;
  }
  spSelectDay(next.day);
}

async function spInit() {
  if (!_spInitialized) _spInitialized = true;
  spRenderProfileSummary();
  await spLoadConfigAndPlan();
}

window.spInit = spInit;
window.spSaveConfig = spSaveConfig;
window.spGeneratePlan = spGeneratePlan;
window.spGenerateDayDraft = spGenerateDayDraft;
window.spSaveDay = spSaveDay;
window.spCopyField = spCopyField;
window.spSelectDay = spSelectDay;
window.spSelectAdjacentDay = spSelectAdjacentDay;
window._spSwitchMonth = _spSwitchMonth;
window.spSelectNextPending = spSelectNextPending;
