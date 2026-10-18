function geoSeoEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function geoSeoScoreBadge(score, label) {
  const numeric = Number(score || 0);
  const bg = numeric >= 85 ? 'rgba(52,199,89,0.12)' : numeric >= 70 ? 'rgba(255,149,0,0.14)' : 'rgba(255,59,48,0.12)';
  const color = numeric >= 85 ? '#248a3d' : numeric >= 70 ? '#b86a00' : '#c0392b';
  return `
    <div style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;background:${bg};color:${color};font-weight:700;">
      <span style="font-size:18px;">${numeric}</span>
      <span style="font-size:12px;">${geoSeoEscapeHtml(label || '')}</span>
    </div>
  `;
}

function geoSeoBulletList(items, emptyText) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) {
    return `<div style="font-size:13px;color:rgba(0,0,0,0.45);">${geoSeoEscapeHtml(emptyText || '내용이 없습니다.')}</div>`;
  }
  return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${rows.map((item) => `
        <div style="padding:12px 14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(255,255,255,0.78);font-size:13px;line-height:1.7;color:#2c2c2e;">
          ${geoSeoEscapeHtml(item)}
        </div>
      `).join('')}
    </div>
  `;
}

function geoSeoRoadmapCards(items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '';
  return rows.map((phase) => `
    <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:16px;background:rgba(255,255,255,0.8);">
      <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.35);text-transform:uppercase;letter-spacing:0.6px;">${geoSeoEscapeHtml(phase.phase || '')}</div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
        ${((phase.items || []).filter(Boolean)).map((item) => `
          <div style="font-size:13px;line-height:1.7;color:#2c2c2e;padding:10px 12px;border-radius:12px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.1);">
            ${geoSeoEscapeHtml(item)}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function geoSeoShowLoading(message) {
  const root = document.getElementById('geo-seo-consultant-results');
  if (!root) return;
  root.innerHTML = `
    <div class="card" style="display:flex;align-items:center;gap:12px;min-height:120px;">
      <span class="spinner"></span>
      <div style="font-size:14px;color:rgba(0,0,0,0.6);line-height:1.7;">
        ${geoSeoEscapeHtml(message || '분석 중입니다...')}
      </div>
    </div>
  `;
}

function geoSeoRenderConsultantResult(payload) {
  const root = document.getElementById('geo-seo-consultant-results');
  if (!root) return;
  const report = payload?.report || {};
  const summary = payload?.summary || {};
  const diagnostics = payload?.diagnostics || {};
  const target = payload?.target || {};
  const scoreCards = [
    { label: '전체', value: summary.overallScore || 0 },
    { label: '페이지', value: report.scores?.page || 0 },
    { label: '콘텐츠', value: report.scores?.content || 0 },
    { label: 'GEO', value: report.scores?.geo || 0 },
    { label: '로컬', value: report.scores?.local || 0 },
    { label: '스키마', value: report.scores?.schema || 0 },
  ];

  root.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
      <div class="card" style="grid-column:1 / -1;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.35);text-transform:uppercase;letter-spacing:0.8px;">GEO SEO 전문 컨설팅</div>
            <h3 style="margin:8px 0 6px;font-size:24px;">${geoSeoEscapeHtml(target.brandName || target.businessType || '사이트 컨설팅 결과')}</h3>
            <div style="font-size:13px;color:rgba(0,0,0,0.5);line-height:1.8;">
              URL: ${geoSeoEscapeHtml(target.url || '')}<br>
              핵심 키워드: ${geoSeoEscapeHtml(target.primaryKeyword || '-')}&nbsp;&nbsp;·&nbsp;&nbsp;
              지역: ${geoSeoEscapeHtml(target.targetRegion || '-')}&nbsp;&nbsp;·&nbsp;&nbsp;
              목표: ${geoSeoEscapeHtml(target.conversionGoal || '-')}
            </div>
          </div>
          ${geoSeoScoreBadge(summary.overallScore, summary.overallLabel)}
        </div>
        <div style="margin-top:16px;padding:14px 16px;border-radius:16px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.1);font-size:14px;line-height:1.8;color:#2c2c2e;">
          ${geoSeoEscapeHtml(report.executiveSummary || '')}
        </div>
      </div>

      <div class="card" style="grid-column:1 / -1;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
          ${scoreCards.map((item) => `
            <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(255,255,255,0.75);">
              <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.35);text-transform:uppercase;letter-spacing:0.6px;">${geoSeoEscapeHtml(item.label)}</div>
              <div style="margin-top:6px;font-size:24px;font-weight:800;color:#1c1c1e;">${Number(item.value || 0)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">포지셔닝 기회</h3>
        <div style="font-size:14px;line-height:1.8;color:#2c2c2e;">${geoSeoEscapeHtml(report.positioningOpportunity || '')}</div>
        <div style="margin-top:14px;font-size:12px;color:rgba(0,0,0,0.45);">
          강한 영역: ${geoSeoEscapeHtml(summary.strongestArea || '-')}<br>
          약한 영역: ${geoSeoEscapeHtml(summary.weakestArea || '-')}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">즉시 실행 Quick Win</h3>
        ${geoSeoBulletList(report.quickWins, '즉시 실행 항목이 없습니다.')}
      </div>

      <div class="card" style="grid-column:1 / -1;">
        <h3 style="margin-bottom:12px;">실행 로드맵</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">
          ${geoSeoRoadmapCards(report.roadmap || [])}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">추천 콘텐츠 각도</h3>
        ${geoSeoBulletList(report.contentAngles, '추천 콘텐츠 방향이 없습니다.')}
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">추천 FAQ 질문</h3>
        ${geoSeoBulletList(report.faqIdeas, 'FAQ 제안이 없습니다.')}
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">권장 스키마</h3>
        ${geoSeoBulletList(report.schemaRecommendations, '권장 스키마가 없습니다.')}
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px;">llms.txt 초안</h3>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.7;background:rgba(0,0,0,0.04);padding:14px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);">${geoSeoEscapeHtml(report.llmsTxtDraft || '')}</pre>
      </div>

      <div class="card" style="grid-column:1 / -1;">
        <h3 style="margin-bottom:12px;">진단 이슈 요약</h3>
        ${geoSeoBulletList(report.issues, '진단 이슈가 없습니다.')}
      </div>

      <div class="card" style="grid-column:1 / -1;">
        <h3 style="margin-bottom:12px;">원본 진단 지표</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
          ${Object.entries(diagnostics).map(([key, value]) => `
            <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(255,255,255,0.78);">
              <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.35);text-transform:uppercase;letter-spacing:0.6px;">${geoSeoEscapeHtml(key)}</div>
              <div style="margin-top:8px;font-size:13px;line-height:1.7;color:#2c2c2e;">
                점수: <strong>${Number(value?.score || 0)}</strong><br>
                주요 이슈 수: ${Array.isArray(value?.issues) ? value.issues.length : 0}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

async function geoSeoConsultantRun() {
  const url = document.getElementById('geo-seo-consultant-url')?.value?.trim();
  if (!url) return toast('진단할 URL을 입력하세요', 'error');
  const body = {
    url,
    brandName: document.getElementById('geo-seo-consultant-brand')?.value?.trim() || '',
    businessType: document.getElementById('geo-seo-consultant-business')?.value?.trim() || '',
    primaryKeyword: document.getElementById('geo-seo-consultant-keyword')?.value?.trim() || '',
    targetRegion: document.getElementById('geo-seo-consultant-region')?.value?.trim() || '',
    targetAudience: document.getElementById('geo-seo-consultant-audience')?.value?.trim() || '',
    conversionGoal: document.getElementById('geo-seo-consultant-goal')?.value?.trim() || '',
    notes: document.getElementById('geo-seo-consultant-notes')?.value?.trim() || '',
  };
  geoSeoShowLoading('GEO SEO 전문 컨설팅 보고서를 만드는 중입니다...');
  try {
    const res = await api('/api/ecommerce/seo/geo-consultant', { method: 'POST', body });
    geoSeoRenderConsultantResult(res || {});
    toast('GEO SEO 컨설팅 완료!');
  } catch (e) {
    const el = document.getElementById('geo-seo-consultant-results');
    if (el) el.innerHTML = '';
    toast('GEO SEO 컨설팅 실패: ' + e.message, 'error');
  }
}

window.geoSeoConsultantRun = geoSeoConsultantRun;
window.geoSeoRenderConsultantResult = geoSeoRenderConsultantResult;
