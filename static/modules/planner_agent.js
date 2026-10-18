/**
 * planner_agent.js
 * 30일 SNS 플래너 에이전트 — AI 어시스턴트 대화형
 */
(function () {
  'use strict';

  let _pagInitialized = false;
  let _pagPlan = null;

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _inputStyle() { return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;'; }

  function pagInit() {
    const root = document.getElementById('planner-agent-root');
    if (!root) return;
    if (_pagInitialized) return;

    const pd = window._globalProfileData || {};
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow-y:auto;overflow-x:hidden;">
        <!-- 설정 바 -->
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:14px 20px;">
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <label style="display:block;font-size:10px;color:rgba(0,0,0,0.3);margin-bottom:4px;">주요 목표 <span style="font-size:9px;">(선택)</span></label>
              <input type="text" id="pag-goal" placeholder="예: 팔로워 1000명 달성, 브랜드 인지도 향상" style="${_inputStyle()}" value="${_esc(pd.business_goal || '')}">
            </div>
            <div>
              <label style="display:block;font-size:10px;color:rgba(0,0,0,0.3);margin-bottom:4px;">타겟 고객 <span style="font-size:9px;">(선택)</span></label>
              <input type="text" id="pag-audience" placeholder="예: 20~30대 여성, 직장인" style="${_inputStyle()}">
            </div>
            <div>
              <label style="display:block;font-size:10px;color:rgba(0,0,0,0.3);margin-bottom:4px;">콘텐츠 키워드 <span style="font-size:9px;">(쉼표로 구분)</span></label>
              <input type="text" id="pag-keywords" placeholder="예: 카페, 디저트, 인테리어" style="${_inputStyle()}" value="${_esc(pd.keywords || '')}">
            </div>
            <div>
              <button onclick="pagGenerate()" id="pag-gen-btn" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 8px rgba(255,140,0,0.3);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                30일 플랜 생성
              </button>
            </div>
          </div>
        </div>
        <!-- AI 어시스턴트 -->
        <div id="pag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex-shrink:0;overflow:visible;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">AI 어시스턴트</span>
          </div>
          <div id="pag-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100px;color:rgba(0,0,0,0.15);font-size:13px;text-align:center;">
              <div style="font-size:28px;margin-bottom:6px;">&#x1F4C5;</div>
              <div>30일 플랜 생성을 누르면 AI가 안내합니다</div>
            </div>
          </div>
          <!-- 플랜 결과 -->
          <div id="pag-result" style="display:none;padding:16px;border-top:1px solid rgba(0,0,0,0.06);max-height:500px;overflow-y:auto;">
          </div>
        </div>
      </div>`;
    _pagInitialized = true;
  }

  function _addMsg(role, html) {
    const body = document.getElementById('pag-chat-body');
    if (!body) return;
    if (body.children.length === 1 && body.firstChild.textContent.includes('30일 플랜 생성을 누르면')) body.innerHTML = '';
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${isAi ? 'flex-start' : 'flex-end'};`;
    div.innerHTML = `<div style="max-width:85%;padding:10px 14px;border-radius:${isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};background:${isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)'};color:${isAi ? '#1c1c1e' : '#fff'};font-size:13px;line-height:1.6;">${html}</div>`;
    body.appendChild(div);
    const panel = document.getElementById('pag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function pagGenerate() {
    const pd = window._globalProfileData || {};
    const profileId = parseInt(window._globalProfileId || 0);
    const brandName = pd.name || '';
    const goal = (document.getElementById('pag-goal')?.value || '').trim();
    const audience = (document.getElementById('pag-audience')?.value || '').trim();
    const keywords = (document.getElementById('pag-keywords')?.value || '').trim();

    const chatBody = document.getElementById('pag-chat-body');
    if (chatBody) chatBody.innerHTML = '';
    const resultEl = document.getElementById('pag-result');
    if (resultEl) { resultEl.style.display = 'none'; resultEl.innerHTML = ''; }

    _addMsg('ai', `<b>${_esc(brandName || '브랜드')}</b>의 30일 SNS 플랜을 만들고 있습니다...<br><span style="font-size:11px;color:rgba(0,0,0,0.3);">최대 1분 정도 소요됩니다</span>`);

    const btn = document.getElementById('pag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }

    // 시작일: 오늘
    const today = new Date();
    const startDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    try {
      const resp = await fetch('/api/social-planner/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            brand_name: brandName,
            brand_category: pd.business_type || '',
            brand_summary: pd.description || pd.service_description || '',
            product_or_service: pd.biz_detail || '',
            target_audience: audience,
            goals: goal,
            tone_and_manner: pd.tone || 'friendly',
            content_pillars: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
            campaign_keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
            start_date: startDate,
            months: 1,
            profile_id: profileId,
          },
        }),
      });
      const data = await resp.json();

      if (data.plan) {
        _pagPlan = data.plan;
        const days = data.plan.days || [];

        _addMsg('ai', `<b>30일 플랜 완료!</b> ${days.length}일 분량이 생성되었습니다.`);

        // 결과 렌더링
        if (resultEl) {
          resultEl.style.display = 'block';
          resultEl.innerHTML = `
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">30일 SNS 콘텐츠 플랜</div>
            ${days.map((day, idx) => {
              const dateStr = day.date || `Day ${idx + 1}`;
              const topic = day.topic || day.title || '';
              const platform = day.platform || 'instagram';
              const contentType = day.content_type || day.type || 'post';
              const hook = day.hook || day.caption_hook || '';
              const platformBadge = {
                instagram: { bg: 'rgba(131,58,180,0.1)', color: '#833ab4', label: 'IG' },
                threads: { bg: 'rgba(255,140,0,0.1)', color: '#ff8c00', label: '@' },
                twitter: { bg: 'rgba(29,161,242,0.1)', color: '#1da1f2', label: 'X' },
                blog: { bg: 'rgba(3,199,90,0.1)', color: '#03c75a', label: 'B' },
              }[platform] || { bg: 'rgba(0,0,0,0.06)', color: '#666', label: platform };

              return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);" data-day="${idx}">
                <div style="width:36px;text-align:center;flex-shrink:0;">
                  <div style="font-size:18px;font-weight:800;color:#ff8c00;">${idx + 1}</div>
                  <div style="font-size:9px;color:rgba(0,0,0,0.25);">${_esc(dateStr)}</div>
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;gap:4px;align-items:center;margin-bottom:3px;">
                    <span style="padding:2px 6px;border-radius:4px;background:${platformBadge.bg};color:${platformBadge.color};font-size:9px;font-weight:600;">${platformBadge.label}</span>
                    <span style="padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.4);font-size:9px;">${_esc(contentType)}</span>
                  </div>
                  <div style="font-size:13px;font-weight:600;color:#1c1c1e;">${_esc(topic)}</div>
                  ${hook ? `<div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:2px;">${_esc(hook)}</div>` : ''}
                </div>
                <button onclick="pagDraftDay(${idx})" id="pag-draft-btn-${idx}" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;font-weight:600;cursor:pointer;flex-shrink:0;height:fit-content;">초안 생성</button>
              </div>`;
            }).join('')}
          `;
        }

        // 전체 복사 버튼
        const copyWrap = document.createElement('div');
        copyWrap.style.cssText = 'display:flex;gap:6px;padding:8px 0;';
        copyWrap.innerHTML = `
          <button onclick="pagCopyPlan()" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:12px;cursor:pointer;">플랜 전체 복사</button>
          <button onclick="pagExportCsv()" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:12px;cursor:pointer;">CSV 다운로드</button>
        `;
        const cb = document.getElementById('pag-chat-body');
        if (cb) cb.appendChild(copyWrap);
      } else {
        _addMsg('ai', `<span style="color:#ff3b30;">플랜 생성 실패: ${_esc(data.detail || data.error || '알 수 없는 오류')}</span>`);
      }
    } catch (e) {
      _addMsg('ai', `<span style="color:#ff3b30;">오류: ${_esc(e.message)}</span>`);
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg> 30일 플랜 생성'; }
  }

  async function pagDraftDay(dayIdx) {
    if (!_pagPlan || !_pagPlan.days?.[dayIdx]) return;
    const day = _pagPlan.days[dayIdx];
    const btn = document.getElementById(`pag-draft-btn-${dayIdx}`);
    if (btn) { btn.textContent = '생성 중...'; btn.disabled = true; }

    try {
      const resp = await fetch('/api/social-planner/plan/day-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: _pagPlan, day_item: day }),
      });
      const data = await resp.json();
      if (data.draft) {
        const draft = data.draft;
        _addMsg('ai', `<b>Day ${dayIdx + 1} 초안:</b><br>${_esc(draft.caption || draft.text || draft.body || JSON.stringify(draft)).replace(/\n/g, '<br>')}`);
        if (btn) { btn.textContent = '완료'; btn.style.background = 'rgba(52,199,89,0.1)'; btn.style.color = '#34c759'; btn.style.borderColor = 'rgba(52,199,89,0.2)'; }
      } else {
        _addMsg('ai', `<span style="color:#ff3b30;">Day ${dayIdx + 1} 초안 실패</span>`);
        if (btn) { btn.textContent = '재시도'; btn.disabled = false; }
      }
    } catch (e) {
      _addMsg('ai', `<span style="color:#ff3b30;">오류: ${_esc(e.message)}</span>`);
      if (btn) { btn.textContent = '재시도'; btn.disabled = false; }
    }
  }

  function pagCopyPlan() {
    if (!_pagPlan?.days) return;
    const text = _pagPlan.days.map((d, i) => `Day ${i+1} [${d.date || ''}] ${d.platform || ''} | ${d.content_type || d.type || ''} | ${d.topic || d.title || ''} | ${d.hook || d.caption_hook || ''}`).join('\n');
    navigator.clipboard.writeText(text);
    _addMsg('ai', '플랜이 클립보드에 복사되었습니다.');
  }

  function pagExportCsv() {
    if (!_pagPlan?.days) return;
    const header = '일자,날짜,플랫폼,유형,주제,훅\n';
    const rows = _pagPlan.days.map((d, i) => `${i+1},"${d.date || ''}","${d.platform || ''}","${d.content_type || d.type || ''}","${(d.topic || d.title || '').replace(/"/g,'""')}","${(d.hook || d.caption_hook || '').replace(/"/g,'""')}"`).join('\n');
    const csv = '\uFEFF' + header + rows;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sns_plan_30days_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  window.pagInit = pagInit;
  window.pagGenerate = pagGenerate;
  window.pagDraftDay = pagDraftDay;
  window.pagCopyPlan = pagCopyPlan;
  window.pagExportCsv = pagExportCsv;
})();
