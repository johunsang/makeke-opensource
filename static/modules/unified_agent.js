/**
 * unified_agent.js
 * 통합 에이전트 — 모든 콘텐츠 생성을 하나의 채팅에서 시작
 */
(function () {
  'use strict';

  function uaInit() {
    const root = document.getElementById('unified-agent-root');
    if (!root) return;

    root.innerHTML = `
      <div style="display:flex;flex-direction:column;height:calc(100vh - 140px);overflow:hidden;">
        <div id="ua-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex:1;overflow:hidden;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">마케케 AI 에이전트</span>
          </div>
          <div id="ua-chat-body" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:16px;">
              <div style="font-size:40px;">&#x2728;</div>
              <div style="font-size:16px;font-weight:700;color:#1c1c1e;">무엇을 만들어 드릴까요?</div>
              <div style="font-size:13px;color:rgba(0,0,0,0.3);text-align:center;">만들 콘텐츠를 선택하세요</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:400px;">
                <button onclick="uaStartAgent('blog-agent')" style="padding:16px 12px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)';this.style.background='rgba(255,140,0,0.04)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)';this.style.background='#fff'">
                  <div style="font-size:24px;">&#x1F4DD;</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">블로그 글</div>
                  <div style="font-size:10px;color:rgba(0,0,0,0.3);">SEO 최적화 블로그</div>
                </button>
                <button onclick="uaStartAgent('cardnews-editor2')" style="padding:16px 12px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)';this.style.background='rgba(255,140,0,0.04)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)';this.style.background='#fff'">
                  <div style="font-size:24px;">&#x1F4F8;</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">카드뉴스</div>
                  <div style="font-size:10px;color:rgba(0,0,0,0.3);">인스타그램 카드뉴스</div>
                </button>
                <button onclick="uaStartAgent('sns-agent')" style="padding:16px 12px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)';this.style.background='rgba(255,140,0,0.04)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)';this.style.background='#fff'">
                  <div style="font-size:24px;">&#x1F4AC;</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">SNS 글</div>
                  <div style="font-size:10px;color:rgba(0,0,0,0.3);">Threads / X</div>
                </button>
                <button onclick="uaStartAgent('comic-agent')" style="padding:16px 12px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)';this.style.background='rgba(255,140,0,0.04)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)';this.style.background='#fff'">
                  <div style="font-size:24px;">&#x1F4DA;</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">만화</div>
                  <div style="font-size:10px;color:rgba(0,0,0,0.3);">웹툰/만화 생성</div>
                </button>
                <!-- 30일 플래너 주석 처리
                <button onclick="uaStartAgent('sns-planner')" style="padding:16px 12px;border-radius:14px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s;" onmouseenter="this.style.borderColor='rgba(255,140,0,0.3)';this.style.background='rgba(255,140,0,0.04)'" onmouseleave="this.style.borderColor='rgba(0,0,0,0.06)';this.style.background='#fff'">
                  <div style="font-size:24px;">&#x1F4C5;</div>
                  <div style="font-size:13px;font-weight:700;color:#1c1c1e;">30일 플랜</div>
                  <div style="font-size:10px;color:rgba(0,0,0,0.3);">SNS 콘텐츠 계획</div>
                </button>
                -->
                <!-- 워크스페이스는 별도 메뉴 -->
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function uaStartAgent(page) {
    // 주제/소재는 채팅에서 입력

    if (typeof navigateToPage === 'function') {
      navigateToPage(page, { skipConfirm: true });
      // 페이지 전환 후 주제 입력 + 자동 시작
      setTimeout(() => {
        // 자동 시작
        if (page === 'blog-agent' && typeof bagGenerate === 'function') bagGenerate();
        else if (page === 'cardnews-editor2' && typeof ce2OnIndustryEnter === 'function') ce2OnIndustryEnter();
        else if (page === 'sns-agent' && typeof sagGenerate === 'function') sagGenerate();
        else if (page === 'video-agent' && typeof vagGenerate === 'function') vagGenerate();
        else if (page === 'comic-agent' && typeof cagGenerate === 'function') cagGenerate();
      }, 300);
    }
  }

  /* ── 통합 히스토리 ── */
  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  function _uaSplitThreads(text) {
    const clean = String(text || '').replace(/\r/g, '').trim();
    if (!clean) return [];
    if (typeof splitThreadsPostText === 'function') {
      const result = splitThreadsPostText(clean, 400);
      if (result.length > 1) return result;
    }
    const paragraphs = clean.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length > 1) {
      const final = [];
      paragraphs.forEach(p => {
        if (p.length <= 400) final.push(p);
        else if (typeof splitThreadsPostText === 'function') final.push(...splitThreadsPostText(p, 400));
        else final.push(p);
      });
      return final.filter(Boolean);
    }
    if (clean.length <= 400) return [clean];
    const sentences = clean.split(/(?<=[.!?。！？다요])\s+/).filter(Boolean);
    if (sentences.length <= 1) return [clean.slice(0, 400), clean.slice(400)].filter(Boolean);
    const chunks = [];
    let cur = '';
    sentences.forEach(s => {
      if (!cur) cur = s;
      else if ((cur + ' ' + s).length <= 400) cur += ' ' + s;
      else { chunks.push(cur); cur = s; }
    });
    if (cur) chunks.push(cur);
    return chunks.filter(Boolean);
  }

  function _uaSnsSegmentsHtml(text, index) {
    const segments = _uaSplitThreads(text);
    if (segments.length <= 1) return '';
    return `
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        <div style="font-size:11px;font-weight:800;color:#ff8c00;">이어쓰기 글 · ${segments.length}개</div>
        ${segments.map((segment, segIndex) => `
          <div style="padding:10px 12px;border:1px solid rgba(255,140,0,0.16);border-radius:10px;background:rgba(255,140,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
              <b style="font-size:11px;color:#1c1c1e;">이어쓰기 ${segIndex + 1}</b>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:10px;color:rgba(0,0,0,0.38);">${segment.length}자</span>
                <button type="button" onclick="uaHistoryCopySnsSegment(${index}, ${segIndex})" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.22);background:#fff;color:#ff8c00;font-size:10px;font-weight:700;cursor:pointer;">복사</button>
              </div>
            </div>
            <div style="white-space:pre-wrap;font-size:12px;line-height:1.65;color:#1c1c1e;">${_esc(segment)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function _uaSnsSegmentsStatusHtml(text) {
    const raw = String(text || '').trim();
    const count = _uaSplitThreads(raw).length;
    return `${raw.length}자 · ${count > 1 ? `<b style="color:#ff8c00;">${count}개 이어쓰기</b>로 나뉩니다` : '한 번에 복사 가능'}`;
  }

  function uaHistoryRefreshSnsSegments(index) {
    const wrap = document.getElementById(`ua-sns-segments-${index}`);
    const status = document.getElementById(`ua-sns-segments-status-${index}`);
    if (!wrap) return;
    const text = document.getElementById(`ua-sns-threads-${index}`)?.value || '';
    if (status) status.innerHTML = _uaSnsSegmentsStatusHtml(text);
    wrap.innerHTML = _uaSnsSegmentsHtml(text, index);
  }

  async function uaHistoryCopySnsSegment(index, segIndex) {
    const text = document.getElementById(`ua-sns-threads-${index}`)?.value || '';
    const segment = _uaSplitThreads(text)[segIndex] || '';
    if (!segment) return;
    await navigator.clipboard.writeText(segment);
    const status = document.getElementById(`ua-sns-status-${index}`);
    if (status) { status.textContent = `이어쓰기 ${segIndex + 1}을 복사했습니다.`; status.style.color = '#34c759'; }
  }
  let _uaHistoryTabId = '';
  let _uaHistoryItems = [];
  let _uaHistoryAllItems = [];
  let _uaHistoryPage = 1;
  const _uaHistoryPageSize = 10;
  let _uaHistoryQuery = '';
  let _uaHistoryOrder = 'newest';
  let _uaHistoryCurrentTab = null;

  function _uaHistoryItemTitle(item) {
    return item?.title || item?.topic || item?.keyword || '';
  }

  function _uaProfileInitial(item) {
    return String(item?.profile_name || item?.brand_name || item?.topic || item?.title || 'P').trim().charAt(0) || 'P';
  }

  function _uaProfileLogoUrl(item) {
    const direct = String(item?.profile_logo_url || item?.logo_url || '').trim();
    if (direct) return direct;
    const profileId = parseInt(item?.profile_id || item?.bp_id || window._globalProfileId || 0, 10) || 0;
    const logoPath = String(item?.profile_logo || item?.logo_path || '').trim();
    if (profileId && logoPath) return '/api/library/image/' + profileId + '/' + encodeURIComponent(logoPath);
    if (profileId) return '/api/library/profiles/' + profileId + '/logo';
    return '';
  }

  function _uaProfileLogoHtml(item) {
    const url = _uaProfileLogoUrl(item);
    const name = item?.profile_name || item?.brand_name || '프로필';
    const initial = _uaProfileInitial(item);
    return `
      <div style="width:42px;height:42px;border-radius:12px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.16);overflow:hidden;flex:0 0 42px;display:flex;align-items:center;justify-content:center;color:#ff8c00;font-size:14px;font-weight:900;">
        ${url ? `<img src="${_esc(url)}" alt="${_esc(name)} 로고" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML='<span>${_esc(initial)}</span>';">` : `<span>${_esc(initial)}</span>`}
      </div>
    `;
  }

  function _uaHistoryItemSearchText(item) {
    const parts = [
      item?.title,
      item?.topic,
      item?.keyword,
      item?.industry,
      item?.body,
      item?.threads_text,
      item?.twitter_text,
      item?.profile_name,
      item?.created,
      item?.created_at,
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function _uaHistorySortedFilteredItems() {
    let items = Array.isArray(_uaHistoryAllItems) ? [..._uaHistoryAllItems] : [];
    const q = String(_uaHistoryQuery || '').trim().toLowerCase();
    if (q) items = items.filter(item => _uaHistoryItemSearchText(item).includes(q));
    items.sort((a, b) => {
      const ad = String(a?.created || a?.created_at || '');
      const bd = String(b?.created || b?.created_at || '');
      if (_uaHistoryOrder === 'oldest') return ad.localeCompare(bd);
      if (_uaHistoryOrder === 'title-asc') return _uaHistoryItemTitle(a).localeCompare(_uaHistoryItemTitle(b), 'ko');
      if (_uaHistoryOrder === 'title-desc') return _uaHistoryItemTitle(b).localeCompare(_uaHistoryItemTitle(a), 'ko');
      return bd.localeCompare(ad);
    });
    return items;
  }

  function _uaHistoryRenderList(items) {
    const content = document.getElementById('ua-history-content');
    if (!content) return;
    if (!items.length) {
      content.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.2);">조건에 맞는 히스토리가 없습니다</div>';
      _uaHistoryItems = [];
      const pager = document.getElementById('ua-history-pagination');
      if (pager) pager.innerHTML = '';
      return;
    }
    const totalPages = Math.max(1, Math.ceil(items.length / _uaHistoryPageSize));
    if (_uaHistoryPage > totalPages) _uaHistoryPage = totalPages;
    const start = (_uaHistoryPage - 1) * _uaHistoryPageSize;
    const pageItems = items.slice(start, start + _uaHistoryPageSize);
    _uaHistoryItems = pageItems;

    if (_uaHistoryTabId === 'blog') content.innerHTML = pageItems.map(_uaBlogHistoryCard).join('');
    else if (_uaHistoryTabId === 'cardnews') content.innerHTML = pageItems.map(_uaCardnewsHistoryCard).join('');
    else if (_uaHistoryTabId === 'sns') content.innerHTML = pageItems.map(_uaSnsHistoryCard).join('');
    else if (_uaHistoryTabId === 'comic') content.innerHTML = pageItems.map(_uaComicHistoryCard).join('');
    else if (_uaHistoryTabId === 'detailpage') content.innerHTML = pageItems.map(_uaDetailpageHistoryCard).join('');

    const summary = document.getElementById('ua-history-summary');
    if (summary) {
      summary.textContent = `${items.length}개 중 ${start + 1}-${Math.min(start + pageItems.length, items.length)} 표시`;
    }
    const pager = document.getElementById('ua-history-pagination');
    if (pager) {
      pager.innerHTML = `
        <button onclick="uaHistoryChangePage(-1)" ${_uaHistoryPage <= 1 ? 'disabled' : ''} style="padding:7px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;cursor:${_uaHistoryPage <= 1 ? 'not-allowed' : 'pointer'};opacity:${_uaHistoryPage <= 1 ? '0.4' : '1'};">이전</button>
        <div style="font-size:12px;color:rgba(0,0,0,0.5);padding:0 4px;">${_uaHistoryPage} / ${totalPages}</div>
        <button onclick="uaHistoryChangePage(1)" ${_uaHistoryPage >= totalPages ? 'disabled' : ''} style="padding:7px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;cursor:${_uaHistoryPage >= totalPages ? 'not-allowed' : 'pointer'};opacity:${_uaHistoryPage >= totalPages ? '0.4' : '1'};">다음</button>
      `;
    }
  }

  function _uaHistoryRefreshView(resetPage = false) {
    if (resetPage) _uaHistoryPage = 1;
    _uaHistoryRenderList(_uaHistorySortedFilteredItems());
  }

  function _uaHistoryRemoveFolder(folder) {
    const target = String(folder || '');
    _uaHistoryAllItems = (_uaHistoryAllItems || []).filter(item => String(item?.folder || '') !== target);
    _uaHistoryRefreshView(false);
  }

  function _uaHistoryUnique(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => {
      const key = String(item?.folder || item?.project_dir || item?.id || JSON.stringify(item || {}));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function uaHistoryChangePage(delta) {
    _uaHistoryPage = Math.max(1, _uaHistoryPage + Number(delta || 0));
    _uaHistoryRefreshView(false);
  }

  async function uaHistoryDeleteAll() {
    const items = _uaHistorySortedFilteredItems();
    if (!items.length || !_uaHistoryCurrentTab) return;
    const label = _uaHistoryCurrentTab.label || _uaHistoryCurrentTab.id || '히스토리';
    if (!confirm(`${label} 탭의 현재 결과 ${items.length}개를 삭제할까요?`)) return;
    const deleteApi = {
      blog: '/api/bag/history/delete',
      cardnews: '/api/ce2/history/delete',
      sns: '/api/sag/history/delete',
      comic: '/api/cag/history/delete',
      detailpage: '/api/ce2/history/delete',
    }[_uaHistoryTabId];
    if (!deleteApi) return;
    const content = document.getElementById('ua-history-content');
    if (content) content.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">삭제 중...</div>';
    for (const item of items) {
      if (!item?.folder) continue;
      try {
        await fetch(deleteApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: item.folder }),
        });
      } catch {}
    }
    _uaHistoryAllItems = (_uaHistoryAllItems || []).filter(item => !items.some(target => String(target?.folder || '') === String(item?.folder || '')));
    _uaHistoryRefreshView(true);
  }

  function _uaBlogHistoryCard(item, index) {
    const title = item.title || item.topic || item.keyword || '(제목 없음)';
    const created = item.created || item.created_at || '';
    const body = item.body || '';
    const preview = body.slice(0, 180);
    const images = Array.isArray(item.images) ? item.images.slice(0, 4) : [];
    const imageHtml = images.length ? `
      <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
        ${images.map(img => `<img src="${_esc(img)}?t=${Date.now()}" style="height:64px;border-radius:8px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="window.open(this.src)" onerror="this.style.display='none'">`).join('')}
      </div>
    ` : '';
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)}${item.char_count ? ' · ' + item.char_count + '자' : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleBlog(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryEditBlog(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">수정</button>
            ${item.folder ? `<button onclick="uaHistoryOpenFolder(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;">폴더</button>` : ''}
          </div>
        </div>
        <div id="ua-blog-preview-${index}" style="font-size:12px;color:rgba(0,0,0,0.5);margin-top:6px;line-height:1.5;cursor:pointer;" onclick="uaHistoryToggleBlog(${index})">${_esc(preview)}${body.length > 180 ? '... <span style=&quot;color:#ff8c00;font-weight:600;&quot;>전체보기</span>' : ''}</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.36);margin-top:8px;">본문과 이미지는 확인 후 복사해서 사용할 수 있습니다.</div>
        <div id="ua-blog-full-${index}" style="display:none;margin-top:10px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <button onclick="uaHistorySaveBlog(${index})" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;font-weight:700;cursor:pointer;">수정 저장</button>
            <button onclick="uaHistoryToggleBlog(${index})" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">닫기</button>
          </div>
          <input id="ua-blog-title-${index}" type="text" value="${_esc(title)}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);font-size:13px;font-weight:700;outline:none;margin-bottom:6px;">
          <textarea id="ua-blog-body-${index}" rows="10" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);font-size:12px;line-height:1.6;resize:vertical;outline:none;">${_esc(body)}</textarea>
        </div>
        ${imageHtml}
        </div>
      </div>
    `;
  }

  function uaHistoryToggleBlog(index) {
    const preview = document.getElementById(`ua-blog-preview-${index}`);
    const full = document.getElementById(`ua-blog-full-${index}`);
    if (!preview || !full) return;
    const isOpen = full.style.display !== 'none';
    full.style.display = isOpen ? 'none' : 'block';
    preview.style.display = isOpen ? 'block' : 'none';
  }

  function uaHistoryEditBlog(index) {
    const preview = document.getElementById(`ua-blog-preview-${index}`);
    const full = document.getElementById(`ua-blog-full-${index}`);
    if (!preview || !full) return;
    preview.style.display = 'none';
    full.style.display = 'block';
    document.getElementById(`ua-blog-title-${index}`)?.focus();
  }

  async function uaHistorySaveBlog(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    const title = document.getElementById(`ua-blog-title-${index}`)?.value || '';
    const body = document.getElementById(`ua-blog-body-${index}`)?.value || '';
    await fetch('/api/bag/save-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder, title, body }),
    });
    item.title = title;
    item.body = body;
    const target = (_uaHistoryAllItems || []).find(x => String(x?.folder || '') === String(item.folder || ''));
    if (target) {
      target.title = title;
      target.body = body;
    }
    _uaHistoryRefreshView(false);
  }

  async function uaHistoryPublishBlog(index) {
    const item = _uaHistoryItems[index];
    if (!item) return;
    const profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { alert('프로필을 먼저 선택해주세요.'); return; }
    const resp = await fetch('/api/blog/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: item.title || '', content: item.body || '', tags: [], images: item.images || [], profile_id: profileId }),
    });
    const data = await resp.json();
    const ir = data.result || {};
    const ok = (data.status === 'ok' || data.success || data.ok) && ir.status !== 'error';
    alert(ok ? '네이버 블로그 발행 완료' : '발행 실패: ' + (ir.message || data.error || data.detail || ''));
  }

  async function uaHistoryOpenFolder(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
  }

  function _uaCardnewsHistoryCard(item, index) {
    const title = `${item.industry || ''} ${item.topic || ''}`.trim() || item.topic || '(제목 없음)';
    const created = item.created || '';
    const slides = item.slides || (item.images || []).length || 0;
    const imgs = (item.images || []).slice(0, 6);
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)} · ${slides}장</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleCardnews(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryEditCardnews(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">수정</button>
            ${item.folder ? `<button onclick="uaHistoryOpenCe2Folder(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;">카드뉴스 폴더</button>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
          ${imgs.map((img, ii) => `<img src="/api/ce2/history/image?folder=${encodeURIComponent(item.folder || '')}&name=${encodeURIComponent(img)}" style="height:64px;border-radius:8px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="uaHistoryPreviewCardnews(${index}, ${ii})">`).join('')}
        </div>
        <div id="ua-cardnews-full-${index}" style="display:none;margin-top:10px;">
        <div style="font-size:11px;color:rgba(0,0,0,0.42);line-height:1.6;">캡션과 이미지는 확인 후 복사해서 사용할 수 있습니다.</div>
      </div>
      </div>
      </div>
    `;
  }

  function uaHistoryToggleCardnews(index) {
    const el = document.getElementById(`ua-cardnews-full-${index}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  function uaHistoryEditCardnews(index) {
    if (typeof navigateToPage === 'function') navigateToPage('ce2-history', { skipConfirm: true });
  }

  function uaHistoryUploadCardnews(index) {
    const item = _uaHistoryItems[index];
    if (!item) return;
    window._ce2HistoryItems = _uaHistoryItems;
    if (typeof ce2HistoryOpenUpload === 'function') {
      ce2HistoryOpenUpload(index);
      if (document.getElementById('ce2-upload-modal')) return;
    }
    uaHistoryOpenCardnewsUploadModal(index);
  }

  function uaHistoryOpenCardnewsUploadModal(index) {
    const item = _uaHistoryItems[index];
    if (!item) return;
    const existing = document.getElementById('ua-cardnews-upload-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'ua-cardnews-upload-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    const images = item.images || [];
    const videoPath = (item.videos && item.videos[0]) || item._videoPath || '';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:540px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:18px;font-weight:700;color:#1c1c1e;">카드뉴스 업로드</h2>
          <button onclick="document.getElementById('ua-cardnews-upload-modal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:rgba(0,0,0,0.3);">&times;</button>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;font-weight:600;color:rgba(0,0,0,0.42);margin-bottom:6px;">캡션</label>
          <textarea id="ua-cardnews-caption" rows="3" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);font-size:13px;line-height:1.5;resize:vertical;">${_esc(item.caption || item.topic || '')}</textarea>
        </div>
        ${images.length ? `
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;color:rgba(0,0,0,0.42);margin-bottom:6px;">이미지 ${images.length}장</label>
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">
              ${images.map(img => `<img src="/api/ce2/history/image?folder=${encodeURIComponent(item.folder || '')}&name=${encodeURIComponent(img)}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.06);">`).join('')}
            </div>
          </div>` : ''}
        <div style="font-size:11px;color:rgba(0,0,0,0.4);line-height:1.6;margin-bottom:10px;">자동 발행은 제거했습니다. 캡션을 복사하고 결과물을 확인해서 사용하세요.</div>
        <div id="ua-cardnews-upload-status" style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:12px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function uaHistoryCardnewsPost(index, platform) {
    const item = _uaHistoryItems[index];
    if (!item) return;
    const profileId = parseInt(window._globalProfileId || 0);
    const status = document.getElementById('ua-cardnews-upload-status');
    if (!profileId) { if (status) { status.textContent = '프로필을 먼저 선택해주세요.'; status.style.color = '#ff3b30'; } return; }
    const caption = (document.getElementById('ua-cardnews-caption')?.value || item.topic || '').trim();
    const imagePaths = item.images || [];
    if (status) { status.textContent = '업로드 중...'; status.style.color = '#ff8c00'; }
    let resp;
    if (platform === 'threads') {
      resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
    } else if (platform === 'instagram') {
      resp = await fetch('/api/instagram/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, image_paths: imagePaths, profile_id: profileId }) });
    } else if (platform === 'twitter') {
      resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
    } else {
      const title = `${item.industry || ''} ${item.topic || ''}`.trim();
      resp = await fetch('/api/blog/publish-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, image_paths: imagePaths, profile_id: profileId }) });
    }
    const data = await resp.json();
    if (data.ok || data.success || data.post_url) {
      if (status) { status.textContent = '업로드 완료'; status.style.color = '#34c759'; }
    } else if (status) {
      status.textContent = data.error || data.detail || '실패';
      status.style.color = '#ff3b30';
    }
  }

  async function uaHistoryCopyCardnewsCaption(index, platform) {
    const item = _uaHistoryItems[index];
    const status = document.getElementById('ua-cardnews-upload-status');
    const caption = (document.getElementById('ua-cardnews-caption')?.value || item?.topic || '').trim();
    if (!caption) {
      if (status) { status.textContent = '복사할 문구가 없습니다.'; status.style.color = '#ff3b30'; }
      return;
    }
    await navigator.clipboard.writeText(caption);
    if (status) {
      status.textContent = `${platform === 'threads' ? 'Threads' : 'X'} 문구를 복사했습니다.`;
      status.style.color = '#34c759';
    }
  }

  async function uaHistoryCardnewsVideoPost(index, platform) {
    const item = _uaHistoryItems[index];
    const status = document.getElementById('ua-cardnews-upload-status');
    const profileId = parseInt(window._globalProfileId || 0);
    const videoPath = (item?.videos && item.videos[0]) || item?._videoPath || '';
    if (!item || !videoPath) { if (status) { status.textContent = '저장된 영상이 없습니다.'; status.style.color = '#ff3b30'; } return; }
    if (!profileId) { if (status) { status.textContent = '프로필을 먼저 선택해주세요.'; status.style.color = '#ff3b30'; } return; }
    const caption = (document.getElementById('ua-cardnews-caption')?.value || item.topic || '').trim();
    if (status) { status.textContent = '업로드 중...'; status.style.color = '#ff8c00'; }
    let resp;
    if (platform === 'reels' || platform === 'story') {
      resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: videoPath, type: platform, profile_id: profileId }) });
    } else if (platform === 'shorts') {
      resp = await fetch('/api/youtube/upload-shorts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caption.slice(0, 100), description: caption, video_path: videoPath, profile_id: profileId }) });
    } else {
      resp = await fetch('/api/tiktok/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: videoPath, profile_id: profileId }) });
    }
    const data = await resp.json();
    if (data.ok || data.success || data.url || data.post_url) {
      if (status) { status.textContent = '업로드 완료'; status.style.color = '#34c759'; }
    } else if (status) {
      status.textContent = data.error || data.detail || '실패';
      status.style.color = '#ff3b30';
    }
  }

  async function uaHistoryOpenCe2Folder(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
  }

  function uaHistoryPreviewCardnews(index, imageIndex) {
    window._ce2HistoryItems = _uaHistoryItems;
    if (typeof ce2HistoryViewImage === 'function') ce2HistoryViewImage(index, imageIndex);
  }

  function _uaSnsHistoryCard(item, index) {
    const title = item.topic || 'SNS 글';
    const created = item.created || '';
    const threadsText = item.threads_text || '';
    const twitterText = item.twitter_text || '';
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleSns(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryEditSns(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;cursor:pointer;">수정</button>
            <button onclick="uaHistoryDeleteSns(${index})" style="padding:5px 10px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:10px;cursor:pointer;">삭제</button>
          </div>
        </div>
        <div id="ua-sns-preview-${index}" style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.5;margin-top:6px;cursor:pointer;" onclick="uaHistoryToggleSns(${index})">${_esc((threadsText || twitterText).slice(0, 180))}${(threadsText || twitterText).length > 180 ? '... <span style=&quot;color:#ff8c00;font-weight:600;&quot;>전체보기</span>' : ''}</div>
        <div id="ua-sns-full-${index}" style="display:none;margin-top:10px;">
          <div style="background:rgba(0,0,0,0.02);border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <b style="font-size:11px;">@ Threads</b>
              <div style="display:flex;gap:4px;">
                <button onclick="uaHistorySaveSns(${index})" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">저장</button>
              </div>
            </div>
            <textarea id="ua-sns-threads-${index}" rows="4" oninput="uaHistoryRefreshSnsSegments(${index})" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.5;">${_esc(threadsText)}</textarea>
            <div id="ua-sns-segments-status-${index}" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;">${_uaSnsSegmentsStatusHtml(threadsText)}</div>
            <div id="ua-sns-segments-${index}">${_uaSnsSegmentsHtml(threadsText, index)}</div>
          </div>
          <div style="background:rgba(29,161,242,0.04);border-radius:10px;padding:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <b style="font-size:11px;">X (Twitter)</b>
              <div style="display:flex;gap:4px;">
                <button onclick="uaHistorySaveSns(${index})" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">저장</button>
              </div>
            </div>
            <textarea id="ua-sns-twitter-${index}" rows="3" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.5;">${_esc(twitterText)}</textarea>
          </div>
          <span id="ua-sns-status-${index}" style="font-size:10px;color:rgba(0,0,0,0.3);display:block;margin-top:4px;"></span>
        </div>
        </div>
      </div>
    `;
  }

  function uaHistoryToggleSns(index) {
    const preview = document.getElementById(`ua-sns-preview-${index}`);
    const full = document.getElementById(`ua-sns-full-${index}`);
    if (!preview || !full) return;
    const isOpen = full.style.display !== 'none';
    full.style.display = isOpen ? 'none' : 'block';
    preview.style.display = isOpen ? 'block' : 'none';
  }

  function uaHistoryEditSns(index) {
    const preview = document.getElementById(`ua-sns-preview-${index}`);
    const full = document.getElementById(`ua-sns-full-${index}`);
    if (!preview || !full) return;
    preview.style.display = 'none';
    full.style.display = 'block';
    document.getElementById(`ua-sns-threads-${index}`)?.focus();
  }

  async function uaHistorySaveSns(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    const threadsText = document.getElementById(`ua-sns-threads-${index}`)?.value || '';
    const twitterText = document.getElementById(`ua-sns-twitter-${index}`)?.value || '';
    const status = document.getElementById(`ua-sns-status-${index}`);
    await fetch('/api/sag/save-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder, threads_text: threadsText, twitter_text: twitterText }),
    });
    item.threads_text = threadsText;
    item.twitter_text = twitterText;
    const target = (_uaHistoryAllItems || []).find(x => String(x?.folder || '') === String(item.folder || ''));
    if (target) {
      target.threads_text = threadsText;
      target.twitter_text = twitterText;
    }
    if (status) { status.textContent = '저장됨'; status.style.color = '#34c759'; }
  }

  async function uaHistoryPostSns(index, platform) {
    const item = _uaHistoryItems[index];
    if (!item) return;
    const profileId = parseInt(window._globalProfileId || 0);
    const status = document.getElementById(`ua-sns-status-${index}`);
    if (!profileId) { if (status) { status.textContent = '프로필을 먼저 선택해주세요.'; status.style.color = '#ff3b30'; } return; }
    const text = platform === 'threads'
      ? (document.getElementById(`ua-sns-threads-${index}`)?.value || item.threads_text || '')
      : (document.getElementById(`ua-sns-twitter-${index}`)?.value || item.twitter_text || '');
    if (status) { status.textContent = '게시 중...'; status.style.color = '#ff8c00'; }
    let resp;
    if (platform === 'threads') {
      const segments = _uaSplitThreads(text);
      if (status) status.textContent = segments.length > 1 ? `${segments.length}개 이어쓰기로 게시 중...` : '게시 중...';
      resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, segments, images: [], profile_id: profileId }) });
    } else {
      resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, images: [], profile_id: profileId }) });
    }
    const data = await resp.json();
    if (data.ok || data.success || data.post_url) {
      if (status) { status.textContent = '게시 완료'; status.style.color = '#34c759'; }
    } else if (status) {
      status.textContent = data.error || data.detail || '실패';
      status.style.color = '#ff3b30';
    }
  }

  async function uaHistoryCopySns(index, platform) {
    const item = _uaHistoryItems[index];
    const status = document.getElementById(`ua-sns-status-${index}`);
    const text = platform === 'threads'
      ? (document.getElementById(`ua-sns-threads-${index}`)?.value || item?.threads_text || '')
      : (document.getElementById(`ua-sns-twitter-${index}`)?.value || item?.twitter_text || '');
    if (!text.trim()) {
      if (status) { status.textContent = '복사할 문구가 없습니다.'; status.style.color = '#ff3b30'; }
      return;
    }
    await navigator.clipboard.writeText(text);
    if (status) {
      status.textContent = `${platform === 'threads' ? 'Threads' : 'X'} 문구를 복사했습니다.`;
      status.style.color = '#34c759';
    }
  }

  async function uaHistoryDeleteSns(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/sag/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
    _uaHistoryRemoveFolder(item.folder);
  }

  function _uaVideoHistoryCard(item, index) {
    const title = item.topic || '광고 영상';
    const created = item.created || '';
    const meta = [item.scene_count ? `${item.scene_count}장면` : '', item.aspect || ''].filter(Boolean).join(' · ');
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)}${meta ? ' · ' + _esc(meta) : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleVideo(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryOpenVideoFolder(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;">영상 폴더</button>
            <button onclick="uaHistoryDeleteVideo(${index})" style="padding:5px 10px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:10px;cursor:pointer;">삭제</button>
          </div>
        </div>
        ${item.video_path ? `<video controls style="width:100%;max-height:240px;border-radius:10px;background:#000;margin-top:10px;" src="/api/ce2/history/image?path=${encodeURIComponent(item.video_path)}"></video>` : '<div style="padding:20px;text-align:center;color:rgba(0,0,0,0.2);margin-top:10px;">영상 파일 없음</div>'}
        <div id="ua-video-full-${index}" style="display:none;margin-top:10px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span id="ua-video-status-${index}" style="font-size:10px;color:rgba(0,0,0,0.3);display:flex;align-items:center;"></span>
          </div>
        </div>
        </div>
      </div>
    `;
  }

  function uaHistoryToggleVideo(index) {
    const el = document.getElementById(`ua-video-full-${index}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  async function uaHistoryOpenVideoFolder(index) {
    const item = _uaHistoryItems[index];
    if (!item?.project_dir) return;
    await fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.project_dir }),
    });
  }

  async function uaHistoryDeleteVideo(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/vag/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
    _uaHistoryRemoveFolder(item.folder);
  }

  function _uaComicImg(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.includes('/comics/')) return '/api/comic/image/' + raw.split('/comics/').pop();
    if (raw.startsWith('/api/comic/image/')) return raw;
    return '/api/comic/image/' + raw;
  }

  function _uaComicHistoryCard(item, index) {
    const title = item.topic || '만화';
    const created = item.created || '';
    const style = item.style || '';
    const image = _uaComicImg(item.composed_image || item.image || '');
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)}${style ? ' · ' + _esc(style) : ''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleComic(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryOpenComicFolder(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;">만화 폴더</button>
            <button onclick="uaHistoryDeleteComic(${index})" style="padding:5px 10px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:10px;cursor:pointer;">삭제</button>
          </div>
        </div>
        ${image ? `<img src="${_esc(image)}?t=${Date.now()}" style="width:100%;max-height:520px;object-fit:contain;border-radius:10px;border:1px solid rgba(0,0,0,0.06);margin-top:10px;background:rgba(0,0,0,0.02);">` : '<div style="padding:20px;text-align:center;color:rgba(0,0,0,0.2);margin-top:10px;">만화 이미지 없음</div>'}
        <div id="ua-comic-full-${index}" style="display:none;margin-top:10px;font-size:11px;color:rgba(0,0,0,0.42);line-height:1.6;">${_esc(item.project_dir || item.folder || '')}</div>
        </div>
      </div>
    `;
  }

  function uaHistoryToggleComic(index) {
    const el = document.getElementById(`ua-comic-full-${index}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  async function uaHistoryOpenComicFolder(index) {
    const item = _uaHistoryItems[index];
    const folder = item?.project_dir || item?.folder || '';
    if (!folder) return;
    await fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder }),
    });
  }

  async function uaHistoryDeleteComic(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/cag/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
    _uaHistoryRemoveFolder(item.folder);
  }

  function _uaProjectComicItem(detail, fallbackProject) {
    const project = detail?.project || fallbackProject || {};
    const comic = detail?.comic || {};
    const folder = comic.project_dir || comic.folder || '';
    if (!folder && !comic.id) return null;
    return {
      id: comic.id || ('project-comic-' + project.id),
      project_id: project.id,
      folder,
      project_dir: folder,
      topic: project.name || comic.topic || project.keyword || '만화',
      style: comic.style || '',
      panel_count: comic.panel_count || 0,
      composed_image: comic.composed_image || '',
      panels: comic.panels || [],
      created: project.updated_at || comic.created_at || project.created_at || '',
      created_at: project.updated_at || comic.created_at || project.created_at || '',
      source: 'project',
      profile_id: project.profile_id || project.bp_id || 0,
      bp_id: project.bp_id || project.profile_id || 0,
      profile_name: project.profile_name || project.brand_name || '',
      profile_logo: project.profile_logo || project.logo_path || '',
      profile_logo_url: project.profile_logo_url || '',
    };
  }

  function _uaProjectDetailItem(detail, fallbackProject) {
    const project = detail?.project || fallbackProject || {};
    const detailImages = detail?.detail_images || {};
    const folder = detailImages.project_dir || project.detail_page_dir || '';
    if (!folder) return null;
    const images = (detailImages.images || []).map(img => img?.url || img?.filename || img).filter(Boolean);
    return {
      id: 'project-detail-' + project.id,
      project_id: project.id,
      folder,
      project_dir: folder,
      topic: project.name || project.keyword || '상세페이지',
      slides: detailImages.count || images.length,
      images,
      created: project.updated_at || project.created_at || '',
      created_at: project.updated_at || project.created_at || '',
      source: 'detailpage',
      industry: 'detailpage',
      profile_id: project.profile_id || project.bp_id || 0,
      bp_id: project.bp_id || project.profile_id || 0,
      profile_name: project.profile_name || project.brand_name || '',
      profile_logo: project.profile_logo || project.logo_path || '',
      profile_logo_url: project.profile_logo_url || '',
    };
  }

  async function _uaProjectBackedHistory(kind) {
    const listRes = await fetch('/api/projects?limit=500&offset=0&q=');
    const listData = await listRes.json().catch(() => ({}));
    const projects = Array.isArray(listData.items) ? listData.items : (Array.isArray(listData.projects) ? listData.projects : []);
    const filtered = projects.filter(project => kind === 'comic'
      ? (Number(project.comic_id || 0) > 0 || project.has_comic)
      : (String(project.detail_page_dir || '').trim() || project.has_detail_page));
    const details = await Promise.all(filtered.slice(0, 160).map(async project => {
      try {
        const resp = await fetch('/api/projects/' + encodeURIComponent(project.id));
        const detail = await resp.json();
        return kind === 'comic' ? _uaProjectComicItem(detail, project) : _uaProjectDetailItem(detail, project);
      } catch (_) {
        return kind === 'comic' ? _uaProjectComicItem({ project }, project) : _uaProjectDetailItem({ project }, project);
      }
    }));
    return details.filter(Boolean);
  }

  async function uaHistoryPublishVideo(index, platform) {
    const item = _uaHistoryItems[index];
    if (!item?.video_path) return;
    const status = document.getElementById(`ua-video-status-${index}`);
    const profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { if (status) { status.textContent = '프로필을 먼저 선택해주세요.'; status.style.color = '#ff3b30'; } return; }
    const caption = item.topic || '';
    if (status) { status.textContent = '업로드 중...'; status.style.color = '#ff8c00'; }
    let resp;
    if (platform === 'reels' || platform === 'story') {
      resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item.video_path, type: platform, profile_id: profileId }) });
    } else if (platform === 'shorts') {
      resp = await fetch('/api/youtube/upload-shorts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caption, description: caption, video_path: item.video_path, profile_id: profileId }) });
    } else {
      resp = await fetch('/api/tiktok/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item.video_path, profile_id: profileId }) });
    }
    const data = await resp.json();
    if (data.ok || data.success || data.url) {
      if (status) { status.textContent = '업로드 완료'; status.style.color = '#34c759'; }
    } else if (status) {
      status.textContent = data.error || data.detail || '실패';
      status.style.color = '#ff3b30';
    }
  }

  function _uaDetailpageHistoryCard(item, index) {
    const title = item.topic || '상세페이지';
    const created = item.created || '';
    const slides = item.slides || (item.images || []).length || 0;
    const imgs = (item.images || []).slice(0, 6);
    return `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;">
        ${_uaProfileLogoHtml(item)}
        <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)} · ${slides}장</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="uaHistoryToggleDetailpage(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;cursor:pointer;">전체보기</button>
            <button onclick="uaHistoryOpenDetailpageFolder(${index})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;">상세페이지 폴더</button>
            <button onclick="uaHistoryDeleteDetailpage(${index})" style="padding:5px 10px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:10px;cursor:pointer;">삭제</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
          ${imgs.map(img => {
            const src = _uaDetailImageSrc(item, img);
            return `<img src="${_esc(src)}" style="height:72px;border-radius:8px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="window.open(this.src)">`;
          }).join('')}
        </div>
        <div id="ua-detailpage-full-${index}" style="display:none;margin-top:10px;font-size:11px;color:rgba(0,0,0,0.42);line-height:1.6;">상세페이지 이미지는 폴더 열기 후 그대로 사용할 수 있습니다.</div>
        </div>
      </div>
    `;
  }

  function _uaDetailImageSrc(item, img) {
    const raw = typeof img === 'object' && img ? String(img.url || img.filename || '') : String(img || '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/api/')) return raw;
    return `/api/ce2/history/image?folder=${encodeURIComponent(item.folder || '')}&name=${encodeURIComponent(raw)}`;
  }

  function uaHistoryToggleDetailpage(index) {
    const el = document.getElementById(`ua-detailpage-full-${index}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  async function uaHistoryOpenDetailpageFolder(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
  }

  async function uaHistoryDeleteDetailpage(index) {
    const item = _uaHistoryItems[index];
    if (!item?.folder) return;
    await fetch('/api/ce2/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: item.folder }),
    });
    _uaHistoryRemoveFolder(item.folder);
  }

  async function uaHistoryInit() {
    const root = document.getElementById('unified-history-root');
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">히스토리를 불러오는 중...</div>';

    // 탭
    const tabs = [
      { id: 'blog', label: '블로그', api: '/api/bag/history' },
      { id: 'cardnews', label: '카드뉴스', api: '/api/ce2/history' },
      { id: 'sns', label: 'SNS', api: '/api/sag/history' },
      { id: 'comic', label: '만화', api: '/api/cag/history' },
      { id: 'detailpage', label: '상세페이지', api: '/api/ce2/history', filter: it => it.industry === 'detailpage' || it.source === 'detailpage' },
    ];

    root.innerHTML = `
      <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;" id="ua-history-tabs"></div>
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;padding:14px 16px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:1;min-width:280px;">
          <input id="ua-history-search" type="text" placeholder="제목, 본문, 주제 검색" style="flex:1;min-width:220px;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);font-size:12px;outline:none;">
          <select id="ua-history-order" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);font-size:12px;background:#fff;">
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="title-asc">제목 오름차순</option>
            <option value="title-desc">제목 내림차순</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div id="ua-history-summary" style="font-size:12px;color:rgba(0,0,0,0.45);"></div>
          <button onclick="uaHistoryDeleteAll()" style="padding:9px 12px;border:none;border-radius:10px;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:12px;font-weight:700;cursor:pointer;">전체삭제</button>
        </div>
      </div>
      <div id="ua-history-content"></div>
      <div id="ua-history-pagination" style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:14px;"></div>
    `;

    const tabsEl = document.getElementById('ua-history-tabs');
    tabs.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.dataset.tabId = tab.id;
      btn.style.cssText = 'padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:' + (i === 0 ? 'linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-color:transparent;' : 'rgba(0,0,0,0.02);color:rgba(0,0,0,0.5);') + 'font-size:12px;font-weight:600;cursor:pointer;';
      btn.onclick = () => {
        tabsEl.querySelectorAll('button').forEach(b => { b.style.background = 'rgba(0,0,0,0.02)'; b.style.color = 'rgba(0,0,0,0.5)'; b.style.borderColor = 'rgba(0,0,0,0.08)'; });
        btn.style.background = 'linear-gradient(135deg,#ff8c00,#ff6b00)'; btn.style.color = '#fff'; btn.style.borderColor = 'transparent';
        _loadHistoryTab(tab);
      };
      tabsEl.appendChild(btn);
    });

    // 첫 번째 탭 자동 로드
    const searchEl = document.getElementById('ua-history-search');
    const orderEl = document.getElementById('ua-history-order');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        _uaHistoryQuery = e.target.value || '';
        _uaHistoryRefreshView(true);
      });
    }
    if (orderEl) {
      orderEl.addEventListener('change', (e) => {
        _uaHistoryOrder = e.target.value || 'newest';
        _uaHistoryRefreshView(true);
      });
    }
    _loadHistoryTab(tabs[0]);
  }

  async function _loadHistoryTab(tab) {
    const content = document.getElementById('ua-history-content');
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';

    try {
      const resp = await fetch(tab.api);
      const data = await resp.json();
      let items = data.items || [];
      _uaHistoryTabId = tab.id;
      _uaHistoryCurrentTab = tab;
      if (tab.id === 'comic' || tab.id === 'detailpage') {
        const projectItems = await _uaProjectBackedHistory(tab.id).catch(() => []);
        items = _uaHistoryUnique([...(projectItems || []), ...(items || [])]);
      }
      if (tab.filter) items = items.filter(tab.filter);
      // ce2 히스토리에서 카드뉴스 탭은 detailpage 제외
      if (tab.id === 'cardnews') items = items.filter(it => it.industry !== 'detailpage' && it.source !== 'detailpage');
      _uaHistoryAllItems = items;
      _uaHistoryPage = 1;
      _uaHistoryRefreshView(false);
      return;

      if (!items.length) { content.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.2);">아직 히스토리가 없습니다</div>'; return; }

      if (tab.id === 'blog') {
        content.innerHTML = items.map(_uaBlogHistoryCard).join('');
        return;
      }
      if (tab.id === 'cardnews') {
        content.innerHTML = items.map(_uaCardnewsHistoryCard).join('');
        return;
      }
      if (tab.id === 'sns') {
        content.innerHTML = items.map(_uaSnsHistoryCard).join('');
        return;
      }
      if (tab.id === 'video') {
        content.innerHTML = items.map(_uaVideoHistoryCard).join('');
        return;
      }
      if (tab.id === 'detailpage') {
        content.innerHTML = items.map(_uaDetailpageHistoryCard).join('');
        return;
      }

      content.innerHTML = items.map(item => {
        const title = item.topic || item.title || item.keyword || '(제목 없음)';
        const created = item.created || item.created_at || '';
        const slides = item.slides || 0;
        const folder = item.folder || '';
        // 이미지 미리보기 (ce2 히스토리)
        const imgs = (item.images || []).slice(0, 4);
        const imgsHtml = imgs.length ? imgs.map(img => {
          const imgUrl = folder ? '/api/ce2/history/image?folder=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(img) : '';
          return imgUrl ? `<img src="${imgUrl}" style="height:50px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">` : '';
        }).join('') : '';
        // 블로그 본문 미리보기
        const body = (item.body || '').slice(0, 100);

        return `<div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px 18px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(title)}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(created)}${slides ? ' · ' + slides + '장' : ''}${item.char_count ? ' · ' + item.char_count + '자' : ''}</div>
              ${body ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);margin-top:4px;line-height:1.4;">${_esc(body)}...</div>` : ''}
            </div>
            ${folder ? `<button onclick="uaOpenFolderPath(${_esc(JSON.stringify(String(folder || '')))})" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:10px;cursor:pointer;flex-shrink:0;">폴더</button>` : ''}
          </div>
          ${imgsHtml ? `<div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">${imgsHtml}</div>` : ''}
        </div>`;
      }).join('');
    } catch (e) {
      content.innerHTML = `<div style="color:#ff3b30;padding:20px;">${_esc(e.message)}</div>`;
    }
  }

  window.uaInit = uaInit;
  window.uaStartAgent = uaStartAgent;
  window.uaHistoryInit = uaHistoryInit;
  window.uaHistoryChangePage = uaHistoryChangePage;
  window.uaHistoryDeleteAll = uaHistoryDeleteAll;
  window.uaHistoryToggleBlog = uaHistoryToggleBlog;
  window.uaHistoryEditBlog = uaHistoryEditBlog;
  window.uaHistorySaveBlog = uaHistorySaveBlog;
  window.uaHistoryPublishBlog = uaHistoryPublishBlog;
  window.uaHistoryOpenFolder = uaHistoryOpenFolder;
  window.uaOpenFolderPath = async function uaOpenFolderPath(folder) {
    await fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: String(folder || '') }),
    });
  };
  window.uaHistoryToggleCardnews = uaHistoryToggleCardnews;
  window.uaHistoryEditCardnews = uaHistoryEditCardnews;
  window.uaHistoryUploadCardnews = uaHistoryUploadCardnews;
  window.uaHistoryOpenCardnewsUploadModal = uaHistoryOpenCardnewsUploadModal;
  window.uaHistoryCardnewsPost = uaHistoryCardnewsPost;
  window.uaHistoryCardnewsVideoPost = uaHistoryCardnewsVideoPost;
  window.uaHistoryOpenCe2Folder = uaHistoryOpenCe2Folder;
  window.uaHistoryPreviewCardnews = uaHistoryPreviewCardnews;
  window.uaHistoryToggleSns = uaHistoryToggleSns;
  window.uaHistoryEditSns = uaHistoryEditSns;
  window.uaHistorySaveSns = uaHistorySaveSns;
  window.uaHistoryPostSns = uaHistoryPostSns;
  window.uaHistoryRefreshSnsSegments = uaHistoryRefreshSnsSegments;
  window.uaHistoryCopySnsSegment = uaHistoryCopySnsSegment;
  window.uaHistoryDeleteSns = uaHistoryDeleteSns;
  window.uaHistoryToggleComic = uaHistoryToggleComic;
  window.uaHistoryOpenComicFolder = uaHistoryOpenComicFolder;
  window.uaHistoryDeleteComic = uaHistoryDeleteComic;
  window.uaHistoryToggleVideo = uaHistoryToggleVideo;
  window.uaHistoryOpenVideoFolder = uaHistoryOpenVideoFolder;
  window.uaHistoryDeleteVideo = uaHistoryDeleteVideo;
  window.uaHistoryPublishVideo = uaHistoryPublishVideo;
  window.uaHistoryToggleDetailpage = uaHistoryToggleDetailpage;
  window.uaHistoryOpenDetailpageFolder = uaHistoryOpenDetailpageFolder;
  window.uaHistoryDeleteDetailpage = uaHistoryDeleteDetailpage;
})();
