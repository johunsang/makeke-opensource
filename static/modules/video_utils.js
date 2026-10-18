(function () {
  'use strict';

  let ready = false;
  let lastFolder = '';
  let searchItems = [];
  let searchSort = 'relevance';
  let searchPage = 1;
  const pageSize = 8;
  let thumbSource = null;
  let thumbResult = null;
  let elementResult = null;
  let attachedImages = [];
  let youtubeAnalysis = null;
  let shortformAnalysis = null;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };
  const assetUrl = (path) => path ? '/api/ce2/history/image?path=' + encodeURIComponent(path) : '';
  const ytThumb = (id, name) => `https://i.ytimg.com/vi/${id}/${name || 'hqdefault.jpg'}`;
  const resolveThumb = (item) => {
    const direct = String(item?.thumbnail || '').trim();
    const id = String(item?.video_id || '').trim();
    return direct && direct.toUpperCase() !== 'NA' ? direct : (id ? ytThumb(id, 'hqdefault.jpg') : '');
  };
  const thumbErr = (item) => {
    const id = String(item?.video_id || '').trim();
    if (!id) return "this.style.display='none'";
    const list = [ytThumb(id, 'hqdefault.jpg'), ytThumb(id, 'mqdefault.jpg'), ytThumb(id, 'default.jpg')].map(esc);
    return `if(!this.dataset.i){this.dataset.i='0';}var l=['${list.join("','")}'];var i=parseInt(this.dataset.i,10)||0;if(i<l.length){this.src=l[i];this.dataset.i=String(i+1);}else{this.style.display='none';}`;
  };
  const formatCount = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return '-';
    return num.toLocaleString('ko-KR');
  };
  const searchSortLabel = (value) => ({ relevance: '관련도순', views: '조회수순', likes: '좋아요순', subscribers: '구독자순', latest: '최신순' }[value] || '관련도순');
  const parseSearchDate = (item) => {
    const raw = String(item?.date || item?.upload_date || '').trim();
    if (!raw) return 0;
    if (/^\d{8}$/.test(raw)) return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`).getTime() || 0;
    return new Date(raw).getTime() || 0;
  };
  function getSortedSearchItems() {
    const items = Array.isArray(searchItems) ? searchItems.slice() : [];
    if (searchSort === 'views') return items.sort((a, b) => Number(b?.view_count || 0) - Number(a?.view_count || 0));
    if (searchSort === 'likes') return items.sort((a, b) => Number(b?.like_count || 0) - Number(a?.like_count || 0));
    if (searchSort === 'subscribers') return items.sort((a, b) => Number(b?.subscriber_count || 0) - Number(a?.subscriber_count || 0));
    if (searchSort === 'latest') return items.sort((a, b) => parseSearchDate(b) - parseSearchDate(a));
    return items;
  }
  function vuSetSearchSort(value) {
    searchSort = String(value || 'relevance').trim() || 'relevance';
    searchPage = 1;
    renderSearchSummarySorted();
    renderSearchModalSorted();
  }
  const statsLine = (item) => `조회수 ${formatCount(item?.view_count)} · 좋아요 ${formatCount(item?.like_count)} · 구독자 ${formatCount(item?.subscriber_count)}`;

  function setStatus(id, message, tone) {
    const el = $(id);
    if (!el) return;
    const style = tone === 'error'
      ? 'color:#ff3b30;background:rgba(255,59,48,.08);border-color:rgba(255,59,48,.16);'
      : tone === 'success'
        ? 'color:#34c759;background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.16);'
        : 'color:#ff8c00;background:rgba(255,140,0,.08);border-color:rgba(255,140,0,.16);';
    el.style.cssText = `display:block;padding:11px 13px;border:1px solid transparent;border-radius:12px;font-size:12px;font-weight:700;${style}`;
    el.textContent = message;
  }

  function copyText(text, ok, fail) {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => { if (typeof toast === 'function') toast(ok || '복사했습니다.'); })
      .catch(() => { if (typeof toast === 'function') toast(fail || '복사에 실패했습니다.', 'error'); });
  }

  function openFolder(folder) {
    if (!folder) return Promise.resolve();
    return fetch('/api/ce2/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder })
    });
  }

  function renderSearchSummary() {
    const el = $('vu-search-summary');
    if (!el) return;
    if (!searchItems.length) {
      el.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">검색 결과가 아직 없습니다.</div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="font-size:12px;color:rgba(0,0,0,.55);">${searchItems.length}개를 찾았습니다. 모달에서 페이지별로 확인할 수 있습니다.</div>
      <button type="button" onclick="vuOpenSearchModal()" style="padding:10px 13px;border:none;border-radius:12px;background:rgba(0,122,255,.92);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">결과 보기</button>
    </div>`;
  }

  function renderSearchModal() {
    const body = $('vu-search-modal-body');
    const pager = $('vu-search-modal-pager');
    const title = $('vu-search-modal-title');
    if (!body || !pager || !title) return;
    if (!searchItems.length) {
      title.textContent = 'YouTube 검색 결과';
      body.innerHTML = '<div style="padding:30px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">검색 결과가 없습니다.</div>';
      pager.innerHTML = '';
      return;
    }
    const totalPages = Math.max(1, Math.ceil(searchItems.length / pageSize));
    searchPage = Math.min(Math.max(1, searchPage), totalPages);
    const start = (searchPage - 1) * pageSize;
    title.textContent = `YouTube 검색 결과 · ${searchItems.length}개`;
    body.innerHTML = searchItems.slice(start, start + pageSize).map((item, idx) => {
      const i = start + idx;
      return `<div style="display:grid;grid-template-columns:160px 1fr;gap:14px;padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:#fff;">
        <div style="width:160px;height:90px;border-radius:12px;overflow:hidden;background:rgba(0,0,0,.04);">
          <img src="${esc(resolveThumb(item))}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="${thumbErr(item)}">
        </div>
        <div style="min-width:0;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(item.title || '제목 없음')}</div>
          <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">${esc([item.channel, item.duration].filter(Boolean).join(' · '))}</div>
          <div style="margin-top:4px;font-size:12px;color:rgba(0,0,0,.42);">${esc(statsLine(item))}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${esc(item.url || '#')}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,140,0,.16);background:rgba(255,140,0,.08);color:#ff8c00;font-size:12px;font-weight:700;text-decoration:none;">열기</a>
            <button type="button" onclick="vuUseVideoUrl(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">다운로더로 보내기</button>
            <button type="button" onclick="vuUseSearchThumbnail(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">썸네일 가져오기</button>
            <button type="button" onclick="vuAnalyzeYoutubeFromSearch(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">자막·요약 보기</button>
            <button type="button" onclick="vuCopyVideoUrl(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">URL 복사</button>
          </div>
        </div>
      </div>`;
    }).join('');
    pager.innerHTML = [
      `<button type="button" onclick="vuPrevSearchPage()" ${searchPage <= 1 ? 'disabled' : ''} style="padding:9px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;opacity:${searchPage <= 1 ? '.45' : '1'};">이전</button>`,
      ...Array.from({ length: totalPages }, (_, idx) => idx + 1).filter((page) => totalPages <= 7 || Math.abs(page - searchPage) <= 1 || page === 1 || page === totalPages).map((page) =>
        `<button type="button" onclick="vuJumpSearchPage(${page})" style="padding:9px 12px;border-radius:10px;border:${page === searchPage ? 'none' : '1px solid rgba(0,0,0,.08)'};background:${page === searchPage ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff'};color:${page === searchPage ? '#fff' : '#1c1c1e'};font-size:12px;font-weight:800;cursor:pointer;">${page}</button>`
      ),
      `<button type="button" onclick="vuNextSearchPage()" ${searchPage >= totalPages ? 'disabled' : ''} style="padding:9px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;opacity:${searchPage >= totalPages ? '.45' : '1'};">다음</button>`
    ].join('');
  }

  function renderSearchSummarySorted() {
    const el = $('vu-search-summary');
    if (!el) return;
    if (!searchItems.length) {
      el.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">검색 결과가 아직 없습니다.</div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="font-size:12px;color:rgba(0,0,0,.55);">${searchItems.length}개 결과</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <select id="vu-search-sort" onchange="vuSetSearchSort(this.value)" style="padding:10px 12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff;font-size:12px;font-weight:700;">
          <option value="relevance"${searchSort === 'relevance' ? ' selected' : ''}>관련도순</option>
          <option value="views"${searchSort === 'views' ? ' selected' : ''}>조회수순</option>
          <option value="likes"${searchSort === 'likes' ? ' selected' : ''}>좋아요순</option>
          <option value="subscribers"${searchSort === 'subscribers' ? ' selected' : ''}>구독자순</option>
          <option value="latest"${searchSort === 'latest' ? ' selected' : ''}>최신순</option>
        </select>
        <button type="button" onclick="vuOpenSearchModal()" style="padding:10px 13px;border:none;border-radius:12px;background:rgba(0,122,255,.92);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">결과 보기</button>
      </div>
    </div>`;
  }

  function renderSearchModalSorted() {
    const body = $('vu-search-modal-body');
    const pager = $('vu-search-modal-pager');
    const title = $('vu-search-modal-title');
    if (!body || !pager || !title) return;
    if (!searchItems.length) {
      title.textContent = 'YouTube 검색 결과';
      body.innerHTML = '<div style="padding:30px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">검색 결과가 없습니다.</div>';
      pager.innerHTML = '';
      return;
    }
    const items = getSortedSearchItems();
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    searchPage = Math.min(Math.max(1, searchPage), totalPages);
    const start = (searchPage - 1) * pageSize;
    title.textContent = `YouTube 검색 결과 · ${items.length}개`;
    body.innerHTML = items.slice(start, start + pageSize).map((item, idx) => {
      const i = searchItems.indexOf(item);
      return `<div style="display:grid;grid-template-columns:160px 1fr;gap:14px;padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:#fff;">
        <div style="width:160px;height:90px;border-radius:12px;overflow:hidden;background:rgba(0,0,0,.04);">
          <img src="${esc(resolveThumb(item))}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="${thumbErr(item)}">
        </div>
        <div style="min-width:0;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(item.title || '제목 없음')}</div>
          <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">${esc([item.channel, item.duration].filter(Boolean).join(' · '))}</div>
          <div style="margin-top:4px;font-size:12px;color:rgba(0,0,0,.42);">${esc(statsLine(item))}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${esc(item.url || '#')}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,140,0,.16);background:rgba(255,140,0,.08);color:#ff8c00;font-size:12px;font-weight:700;text-decoration:none;">열기</a>
            <button type="button" onclick="vuUseVideoUrl(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">다운로더로 보내기</button>
            <button type="button" onclick="vuUseSearchThumbnail(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">썸네일 가져오기</button>
            <button type="button" onclick="vuAnalyzeYoutubeFromSearch(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">자막·요약 보기</button>
            <button type="button" onclick="vuCopyVideoUrl(${i})" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">URL 복사</button>
          </div>
        </div>
      </div>`;
    }).join('');
    pager.innerHTML = [
      `<button type="button" onclick="vuPrevSearchPage()" ${searchPage <= 1 ? 'disabled' : ''} style="padding:9px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;opacity:${searchPage <= 1 ? '.45' : '1'};">이전</button>`,
      ...Array.from({ length: totalPages }, (_, idx) => idx + 1).filter((page) => totalPages <= 7 || Math.abs(page - searchPage) <= 1 || page === 1 || page === totalPages).map((page) =>
        `<button type="button" onclick="vuJumpSearchPage(${page})" style="padding:9px 12px;border-radius:10px;border:${page === searchPage ? 'none' : '1px solid rgba(0,0,0,.08)'};background:${page === searchPage ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff'};color:${page === searchPage ? '#fff' : '#1c1c1e'};font-size:12px;font-weight:800;cursor:pointer;">${page}</button>`
      ),
      `<button type="button" onclick="vuNextSearchPage()" ${searchPage >= totalPages ? 'disabled' : ''} style="padding:9px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;opacity:${searchPage >= totalPages ? '.45' : '1'};">다음</button>`
    ].join('');
  }

  function renderThumbSource() {
    const el = $('vu-thumb-source');
    if (!el) return;
    if (!thumbSource) {
      el.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">유튜브 링크나 검색 결과에서 썸네일을 먼저 불러와주세요.</div>';
      return;
    }
    el.innerHTML = `<div style="display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:start;">
      <div style="border-radius:14px;overflow:hidden;background:rgba(0,0,0,.05);"><img src="${esc(resolveThumb(thumbSource))}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;" onerror="${thumbErr(thumbSource)}"></div>
      <div><div style="font-size:13px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(thumbSource.title || '원본 썸네일')}</div><div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">${esc(thumbSource.channel || '')}</div><div style="margin-top:10px;font-size:12px;color:rgba(0,0,0,.55);line-height:1.7;">원본의 클릭감은 참고하고 문구, 인물, 분위기는 새 방향으로 다시 만듭니다.</div></div>
    </div>`;
  }

  function renderThumbResult() {
    const el = $('vu-thumb-result');
    if (!el) return;
    if (!thumbResult?.image_path) {
      el.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">새 썸네일을 만들면 여기에 표시됩니다.</div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      <div style="border-radius:16px;overflow:hidden;background:rgba(0,0,0,.05);"><img src="${assetUrl(thumbResult.image_path)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" onclick="vuCopyThumbnailPrompt()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">프롬프트 복사</button>
        <button type="button" onclick="vuCopyThumbnailPath()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">경로 복사</button>
        <button type="button" onclick="vuOpenThumbFolder()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">폴더 열기</button>
      </div>
      <textarea readonly style="width:100%;min-height:190px;padding:12px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:rgba(120,120,128,.05);font-size:12px;line-height:1.65;resize:vertical;">${esc(thumbResult.prompt || '')}</textarea>
    </div>`;
  }

  function renderElementResult() {
    const el = $('vu-element-result');
    if (!el) return;
    if (!elementResult?.image_path) {
      el.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">삽입 요소를 만들면 여기에 표시됩니다.</div>';
      return;
    }
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
      <div style="border-radius:16px;overflow:hidden;background:rgba(0,0,0,.05);max-width:280px;"><img src="${assetUrl(elementResult.image_path)}" alt="" style="width:100%;aspect-ratio:1/1;object-fit:cover;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" onclick="vuUseElementInThumbnail()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">썸네일에 반영</button>
        <button type="button" onclick="vuCopyElementPrompt()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">프롬프트 복사</button>
        <button type="button" onclick="vuOpenElementFolder()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">폴더 열기</button>
      </div>
      <div style="font-size:12px;color:rgba(0,0,0,.55);line-height:1.7;">${esc(elementResult.description || '')}</div>
    </div>`;
  }

  function renderAttachedImages() {
    const el = $('vu-thumb-attached');
    if (!el) return;
    el.innerHTML = attachedImages.length ? attachedImages.map((item, idx) => `<div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;">
      <img src="${esc(item.url || '')}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;background:rgba(0,0,0,.05);">
      <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:700;color:#1c1c1e;line-height:1.5;">${esc(item.filename || '첨부 이미지')}</div></div>
      <button type="button" onclick="vuRemoveAttachedImage(${idx})" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:11px;font-weight:700;cursor:pointer;">제거</button>
    </div>`).join('') : '<div style="padding:14px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">첨부한 이미지가 아직 없습니다.</div>';
  }

  function renderYoutubeAnalysis() {
    const meta = $('vu-yt-meta');
    const summary = $('vu-yt-summary');
    const content = $('vu-yt-content');
    if (!meta || !summary || !content) return;
    if (!youtubeAnalysis) {
      meta.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">유튜브 링크를 분석하면 자막과 요약이 여기에 표시됩니다.</div>';
      summary.value = '';
      content.value = '';
      return;
    }
    meta.innerHTML = `<div style="display:grid;grid-template-columns:140px 1fr;gap:12px;align-items:start;">
      <img src="${esc(youtubeAnalysis.thumbnail || '')}" alt="" style="width:140px;aspect-ratio:16/9;border-radius:12px;object-fit:cover;background:rgba(0,0,0,.05);">
      <div><div style="font-size:13px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(youtubeAnalysis.title || '제목 없음')}</div><div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">${esc([youtubeAnalysis.channel, youtubeAnalysis.duration, youtubeAnalysis.language].filter(Boolean).join(' · '))}</div></div>
    </div>`;
    summary.value = youtubeAnalysis.summary || '';
    content.value = youtubeAnalysis.text || '';
  }

  function renderShortformAnalysis() {
    const meta = $('vu-shortform-meta');
    const summary = $('vu-shortform-summary');
    if (!meta || !summary) return;
    if (!shortformAnalysis) {
      meta.innerHTML = '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,.28);font-size:12px;">릴스나 틱톡 링크를 분석하면 결과가 여기에 표시됩니다.</div>';
      summary.value = '';
      return;
    }
    meta.innerHTML = `<div style="font-size:13px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(shortformAnalysis.title || '영상 분석 결과')}</div><div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">${esc([shortformAnalysis.platform, shortformAnalysis.filename].filter(Boolean).join(' · '))}</div>`;
    summary.value = shortformAnalysis.text || '';
  }

  function vuInit() {
    const root = $('video-utils-root');
    if (!root || ready) return;
    ready = true;
    root.innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(360px,.98fr) minmax(420px,1.02fr);gap:16px;align-items:start;">
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card" style="padding:20px;">
            <div style="font-size:17px;font-weight:800;color:#1c1c1e;">영상 다운로더</div>
            <div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">YouTube, Instagram, TikTok 공개 링크를 바로 저장합니다.</div>
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
              <input id="vu-download-url" type="text" placeholder="https://www.youtube.com/watch?v=... 또는 인스타/틱톡 링크" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="vu-download-btn" type="button" onclick="vuDownload()" style="padding:12px 16px;border:none;border-radius:14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">다운로드</button>
                <button type="button" onclick="vuOpenLastFolder()" style="padding:12px 16px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:#fff;font-size:13px;font-weight:700;cursor:pointer;">폴더 열기</button>
              </div>
              <div id="vu-download-status" style="display:none;"></div>
            </div>
          </div>
          <div class="card" style="padding:20px;">
            <div style="font-size:17px;font-weight:800;color:#1c1c1e;">YouTube 검색</div>
            <div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">결과를 많이 가져오고 모달에서 페이지별로 확인합니다.</div>
            <div style="margin-top:14px;display:grid;grid-template-columns:1fr 110px 110px;gap:8px;">
              <input id="vu-search-keyword" type="text" placeholder="예: 아이폰 18 리뷰" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <select id="vu-search-count" style="padding:13px 12px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;"><option value="12">12개</option><option value="24" selected>24개</option><option value="36">36개</option><option value="60">60개</option></select>
              <button id="vu-search-btn" type="button" onclick="vuSearchYoutube()" style="padding:12px 16px;border:none;border-radius:14px;background:rgba(0,122,255,.92);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">검색</button>
            </div>
            <div id="vu-search-status" style="display:none;margin-top:10px;"></div>
            <div id="vu-search-summary" style="margin-top:12px;"></div>
          </div>
          <div class="card" style="padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div><div style="font-size:17px;font-weight:800;color:#1c1c1e;">YouTube 자막 · 내용 요약</div><div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">자막 원문, 전체 내용, 요약을 한 번에 가져옵니다.</div></div>
              <button id="vu-yt-btn" type="button" onclick="vuAnalyzeYoutube()" style="padding:10px 13px;border:none;border-radius:12px;background:rgba(0,122,255,.92);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">분석</button>
            </div>
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
              <input id="vu-yt-url" type="text" placeholder="https://www.youtube.com/watch?v=..." style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <div id="vu-yt-status" style="display:none;"></div>
              <div id="vu-yt-meta" style="padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:#fff;"></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" onclick="vuCopyYoutubeSummary()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">요약 복사</button>
                <button type="button" onclick="vuCopyYoutubeContent()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">내용 복사</button>
              </div>
              <textarea id="vu-yt-summary" readonly rows="8" placeholder="요약이 여기에 표시됩니다." style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:12px;background:#fff;line-height:1.7;resize:vertical;"></textarea>
              <textarea id="vu-yt-content" readonly rows="12" placeholder="자막과 전체 내용이 여기에 표시됩니다." style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:12px;background:#fff;line-height:1.7;resize:vertical;"></textarea>
            </div>
          </div>
          <div class="card" style="padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div><div style="font-size:17px;font-weight:800;color:#1c1c1e;">릴스 · 틱톡 분석</div><div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">공개 릴스나 틱톡 링크를 내려받아 핵심 내용과 후킹 포인트를 요약합니다.</div></div>
              <button id="vu-shortform-btn" type="button" onclick="vuAnalyzeShortform()" style="padding:10px 13px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">분석</button>
            </div>
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
              <input id="vu-shortform-url" type="text" placeholder="https://www.instagram.com/reel/... 또는 https://www.tiktok.com/..." style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <div id="vu-shortform-status" style="display:none;"></div>
              <div id="vu-shortform-meta" style="padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:#fff;"></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" onclick="vuCopyShortformSummary()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">분석 복사</button><button type="button" onclick="vuOpenLastFolder()" style="padding:10px 13px;border-radius:11px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">폴더 열기</button></div>
              <textarea id="vu-shortform-summary" readonly rows="12" placeholder="분석 결과가 여기에 표시됩니다." style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:12px;background:#fff;line-height:1.7;resize:vertical;"></textarea>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card" style="padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;"><div><div style="font-size:17px;font-weight:800;color:#1c1c1e;">썸네일 리메이크</div><div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">유튜브 썸네일을 불러와 문구, 인물, 분위기를 바꾼 새 시안을 만듭니다.</div></div><button type="button" onclick="vuLoadThumbnail()" style="padding:10px 13px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">링크로 불러오기</button></div>
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
              <input id="vu-thumb-url" type="text" placeholder="https://www.youtube.com/watch?v=... 또는 검색 결과에서 자동 선택" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <div id="vu-thumb-source" style="padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:#fff;"></div>
              <input id="vu-thumb-headline" type="text" placeholder="새로 넣을 문구" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;">
              <textarea id="vu-thumb-person" rows="3" placeholder="인물 수정 방향 예: 30대 여성 CEO, 강한 자신감, 카메라는 정면 응시" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;resize:vertical;"></textarea>
              <textarea id="vu-thumb-design" rows="3" placeholder="추가 디자인 지시 예: 번개 사인, 큰 대비, 검정 배경, 모바일에서 잘 읽히게" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;resize:vertical;"></textarea>
              <div style="padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.82);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;"><div><div style="font-size:13px;font-weight:800;color:#1c1c1e;">참고 이미지 첨부</div><div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">사람 사진, 제품 컷, 원하는 오브제를 첨부하면 새 썸네일에서 참고합니다.</div></div><label style="padding:10px 13px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">이미지 첨부<input id="vu-thumb-attach-input" type="file" accept="image/*" multiple style="display:none;" onchange="vuAttachImages(event)"></label></div>
                <div id="vu-thumb-attached" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;"></div>
              </div>
              <div style="padding:14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.82);">
                <div style="font-size:13px;font-weight:800;color:#1c1c1e;">삽입 요소 만들기</div>
                <div style="margin-top:6px;font-size:12px;line-height:1.7;color:rgba(0,0,0,.45);">사람, 제품, 오브제를 먼저 만들고 새 썸네일 지시에 반영할 수 있습니다.</div>
                <div style="margin-top:12px;display:grid;grid-template-columns:120px 1fr;gap:8px;"><select id="vu-element-type" style="padding:13px 12px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;"><option value="person">인물</option><option value="product">제품</option><option value="object">오브제</option></select><input id="vu-element-desc" type="text" placeholder="예: 자신감 있는 30대 여성 CEO, 정면 상반신" style="width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;"></div>
                <textarea id="vu-element-style" rows="2" placeholder="예: 유튜브 썸네일용 과장된 표정, 강한 조명, 배경은 단순하게" style="margin-top:8px;width:100%;padding:13px 14px;border:1px solid rgba(0,0,0,.08);border-radius:14px;font-size:13px;background:#fff;resize:vertical;"></textarea>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"><button id="vu-element-generate-btn" type="button" onclick="vuGenerateElement()" style="padding:10px 13px;border:none;border-radius:12px;background:rgba(0,122,255,.92);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">삽입 요소 생성</button></div>
                <div id="vu-element-status" style="display:none;margin-top:8px;"></div>
                <div id="vu-element-result" style="margin-top:10px;"></div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;"><button id="vu-thumb-generate-btn" type="button" onclick="vuRemakeThumbnail()" style="padding:12px 16px;border:none;border-radius:14px;background:rgba(52,199,89,.92);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">새 썸네일 만들기</button></div>
              <div id="vu-thumb-status" style="display:none;"></div>
            </div>
          </div>
          <div class="card" style="padding:20px;"><div style="font-size:17px;font-weight:800;color:#1c1c1e;">새 썸네일 결과</div><div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,.45);">원본 느낌을 참고해 새로 생성한 썸네일과 사용된 프롬프트를 확인합니다.</div><div id="vu-thumb-result" style="margin-top:14px;"></div></div>
        </div>
      </div>
      <div id="vu-search-modal" onclick="vuCloseSearchModal(event)" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.36);z-index:12000;padding:28px;">
        <div onclick="event.stopPropagation()" style="max-width:1080px;max-height:calc(100vh - 56px);margin:0 auto;background:#f7f7f9;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 26px 80px rgba(0,0,0,.22);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.06);background:#fff;"><div id="vu-search-modal-title" style="font-size:18px;font-weight:800;color:#1c1c1e;">YouTube 검색 결과</div><button type="button" onclick="vuCloseSearchModal()" style="padding:10px 13px;border:none;border-radius:12px;background:rgba(0,0,0,.05);font-size:12px;font-weight:800;cursor:pointer;">닫기</button></div>
          <div id="vu-search-modal-body" style="padding:18px 20px;overflow:auto;display:flex;flex-direction:column;gap:12px;"></div>
          <div id="vu-search-modal-pager" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:16px 20px;border-top:1px solid rgba(0,0,0,.06);background:#fff;"></div>
        </div>
      </div>`;
    renderSearchSummarySorted(); renderThumbSource(); renderThumbResult(); renderElementResult(); renderAttachedImages(); renderYoutubeAnalysis(); renderShortformAnalysis();
  }

  async function vuDownload() {
    const url = String($('vu-download-url')?.value || '').trim();
    const btn = $('vu-download-btn');
    if (!url) return setStatus('vu-download-status', '다운로드할 영상 링크를 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...'; }
    setStatus('vu-download-status', '영상을 저장하고 있습니다.', 'pending');
    try {
      const resp = await fetch('/api/utils/video-downloader', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || '영상 다운로드에 실패했습니다.');
      lastFolder = data.folder || '';
      setStatus('vu-download-status', `${data.platform || 'video'} 저장 완료: ${data.filename || ''}`, 'success');
    } catch (error) {
      setStatus('vu-download-status', error.message || '영상 다운로드에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '다운로드'; }
    }
  }

  async function vuSearchYoutube() {
    const keyword = String($('vu-search-keyword')?.value || '').trim();
    const maxResults = parseInt($('vu-search-count')?.value || '24', 10) || 24;
    const btn = $('vu-search-btn');
    if (!keyword) return setStatus('vu-search-status', '검색할 키워드를 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '검색 중...'; }
    setStatus('vu-search-status', 'YouTube 검색 결과를 모으는 중입니다...', 'pending');
    try {
      const resp = await fetch('/api/utils/youtube-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword, max_results: maxResults }) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || 'YouTube 검색에 실패했습니다.');
      searchItems = Array.isArray(data.items) ? data.items : [];
      searchPage = 1;
      renderSearchSummarySorted();
      renderSearchModalSorted();
      setStatus('vu-search-status', `${searchItems.length}개를 찾았습니다.`, 'success');
      vuOpenSearchModal();
    } catch (error) {
      searchItems = [];
      renderSearchSummarySorted();
      setStatus('vu-search-status', error.message || 'YouTube 검색에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '검색'; }
    }
  }

  function vuOpenSearchModal() { const el = $('vu-search-modal'); if (el) { renderSearchModalSorted(); el.style.display = 'block'; } }
  function vuCloseSearchModal(event) { if (event && event.target && event.target.id !== 'vu-search-modal') return; const el = $('vu-search-modal'); if (el) el.style.display = 'none'; }
  function vuPrevSearchPage() { searchPage = Math.max(1, searchPage - 1); renderSearchModalSorted(); }
  function vuNextSearchPage() { searchPage += 1; renderSearchModalSorted(); }
  function vuJumpSearchPage(page) { searchPage = Math.max(1, parseInt(page, 10) || 1); renderSearchModalSorted(); }
  async function vuOpenLastFolder() { if (!lastFolder) return setStatus('vu-download-status', '먼저 저장된 결과가 있어야 폴더를 열 수 있습니다.', 'error'); await openFolder(lastFolder); }
  function vuUseVideoUrl(index) { const item = searchItems[index]; if (!item) return; $('vu-download-url').value = item.url || ''; setStatus('vu-download-status', '선택한 링크를 다운로더 입력창에 넣었습니다.', 'pending'); }
  function vuCopyVideoUrl(index) { const item = searchItems[index]; copyText(item?.url || '', 'URL을 복사했습니다.', 'URL 복사에 실패했습니다.'); }
  async function vuUseSearchThumbnail(index) { const item = searchItems[index]; if (!item) return; $('vu-thumb-url').value = item.url || ''; await vuLoadThumbnail(); }
  async function vuAnalyzeYoutubeFromSearch(index) { const item = searchItems[index]; if (!item) return; $('vu-yt-url').value = item.url || ''; await vuAnalyzeYoutube(); }

  async function vuLoadThumbnail() {
    const url = String($('vu-thumb-url')?.value || '').trim();
    if (!url) return setStatus('vu-thumb-status', '썸네일을 가져올 YouTube 링크를 입력해주세요.', 'error');
    setStatus('vu-thumb-status', '유튜브 썸네일 정보를 불러오는 중입니다...', 'pending');
    try {
      const resp = await fetch('/api/utils/youtube-thumbnail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || '썸네일 정보를 불러오지 못했습니다.');
      thumbSource = data;
      if (data.downloaded_folder) lastFolder = data.downloaded_folder;
      if ($('vu-thumb-headline') && !$('vu-thumb-headline').value.trim()) $('vu-thumb-headline').value = data.title || '';
      renderThumbSource();
      setStatus('vu-thumb-status', data.downloaded_path ? '원본 썸네일을 다운로드하고 불러왔습니다.' : '원본 썸네일을 불러왔습니다.', 'success');
    } catch (error) {
      setStatus('vu-thumb-status', error.message || '썸네일 정보를 불러오지 못했습니다.', 'error');
    }
  }

  async function vuAttachImages(event) {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;
    setStatus('vu-thumb-status', '첨부 이미지를 업로드하는 중입니다...', 'pending');
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      const resp = await fetch('/api/content/upload-image', { method: 'POST', body: form });
      const data = await resp.json();
      const images = Array.isArray(data.images) ? data.images : [];
      if (!resp.ok || data.status !== 'ok' || !images.length) throw new Error(data.detail || data.error || '이미지 업로드에 실패했습니다.');
      images.forEach((item) => { if (item?.url && !attachedImages.some((existing) => existing.url === item.url)) attachedImages.push(item); });
      renderAttachedImages();
      setStatus('vu-thumb-status', `${images.length}개의 참고 이미지를 추가했습니다.`, 'success');
    } catch (error) {
      setStatus('vu-thumb-status', error.message || '이미지 업로드에 실패했습니다.', 'error');
    } finally {
      if ($('vu-thumb-attach-input')) $('vu-thumb-attach-input').value = '';
    }
  }

  function vuRemoveAttachedImage(index) { attachedImages.splice(index, 1); renderAttachedImages(); }

  async function vuRemakeThumbnail() {
    if (!thumbSource?.thumbnail) return setStatus('vu-thumb-status', '원본 썸네일을 먼저 불러와주세요.', 'error');
    const headline = String($('vu-thumb-headline')?.value || '').trim();
    const personPrompt = String($('vu-thumb-person')?.value || '').trim();
    const designPrompt = String($('vu-thumb-design')?.value || '').trim();
    const btn = $('vu-thumb-generate-btn');
    if (!headline) return setStatus('vu-thumb-status', '새 문구를 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '새 썸네일 생성 중...'; }
    setStatus('vu-thumb-status', '원본 썸네일 느낌을 분석하고 새 이미지를 만들고 있습니다...', 'pending');
    try {
      const resp = await fetch('/api/utils/thumbnail-remake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: thumbSource.downloaded_path || thumbSource.thumbnail,
          headline,
          person_prompt: personPrompt,
          design_prompt: designPrompt,
          element_prompt: elementResult ? `${elementResult.element_type || 'element'}: ${elementResult.description || ''}` : '',
          attached_images: attachedImages.map((item) => item.url || item.path || '').filter(Boolean),
          aspect_ratio: '16:9'
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || '썸네일 재생성에 실패했습니다.');
      thumbResult = data;
      lastFolder = data.folder || lastFolder;
      renderThumbResult();
      setStatus('vu-thumb-status', '새 썸네일을 만들었습니다.', 'success');
    } catch (error) {
      setStatus('vu-thumb-status', error.message || '썸네일 재생성에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '새 썸네일 만들기'; }
    }
  }

  const vuCopyThumbnailPrompt = () => copyText(thumbResult?.prompt || '', '썸네일 프롬프트를 복사했습니다.', '프롬프트 복사에 실패했습니다.');
  const vuCopyThumbnailPath = () => copyText(thumbResult?.image_path || '', '생성 이미지 경로를 복사했습니다.', '경로 복사에 실패했습니다.');
  const vuOpenThumbFolder = async () => openFolder(thumbResult?.folder || lastFolder);

  async function vuGenerateElement() {
    const elementType = String($('vu-element-type')?.value || 'person').trim();
    const description = String($('vu-element-desc')?.value || '').trim();
    const styleHint = String($('vu-element-style')?.value || '').trim();
    const btn = $('vu-element-generate-btn');
    if (!description) return setStatus('vu-element-status', '삽입할 요소 설명을 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '삽입 요소 생성 중...'; }
    setStatus('vu-element-status', '삽입 요소 이미지를 만들고 있습니다...', 'pending');
    try {
      const resp = await fetch('/api/utils/thumbnail-element', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ element_type: elementType, description, style_hint: styleHint }) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || '삽입 요소 생성에 실패했습니다.');
      elementResult = data;
      renderElementResult();
      setStatus('vu-element-status', '삽입 요소를 만들었습니다.', 'success');
    } catch (error) {
      setStatus('vu-element-status', error.message || '삽입 요소 생성에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '삽입 요소 생성'; }
    }
  }

  function vuUseElementInThumbnail() {
    if (!elementResult) return;
    if ($('vu-thumb-person') && !$('vu-thumb-person').value.trim()) $('vu-thumb-person').value = elementResult.description || '';
    if ($('vu-thumb-design')) $('vu-thumb-design').value = `${$('vu-thumb-design').value.trim() ? `${$('vu-thumb-design').value.trim()}\n` : ''}삽입 요소 참고: ${elementResult.element_type || 'element'} / ${elementResult.description || ''}`;
    setStatus('vu-thumb-status', '삽입 요소 지시를 새 썸네일 만들기에 반영했습니다.', 'success');
  }

  const vuCopyElementPrompt = () => copyText(elementResult?.prompt || '', '삽입 요소 프롬프트를 복사했습니다.', '프롬프트 복사에 실패했습니다.');
  const vuOpenElementFolder = async () => openFolder(elementResult?.folder || '');

  async function vuAnalyzeYoutube() {
    const url = String($('vu-yt-url')?.value || '').trim();
    const btn = $('vu-yt-btn');
    if (!url) return setStatus('vu-yt-status', '분석할 YouTube 링크를 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '분석 중...'; }
    setStatus('vu-yt-status', '자막과 내용을 수집하고 요약하는 중입니다...', 'pending');
    try {
      const resp = await fetch('/api/content/youtube-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await resp.json();
      if (!resp.ok || data.status !== 'ok') throw new Error(data.detail || data.error || '유튜브 자막 분석에 실패했습니다.');
      youtubeAnalysis = data.data || null;
      if (youtubeAnalysis?.url && $('vu-thumb-url') && !$('vu-thumb-url').value.trim()) $('vu-thumb-url').value = youtubeAnalysis.url;
      renderYoutubeAnalysis();
      setStatus('vu-yt-status', '자막과 요약을 불러왔습니다.', 'success');
    } catch (error) {
      setStatus('vu-yt-status', error.message || '유튜브 자막 분석에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '분석'; }
    }
  }

  const vuCopyYoutubeSummary = () => copyText(youtubeAnalysis?.summary || '', '유튜브 요약을 복사했습니다.', '요약 복사에 실패했습니다.');
  const vuCopyYoutubeContent = () => copyText(youtubeAnalysis?.text || '', '유튜브 내용을 복사했습니다.', '내용 복사에 실패했습니다.');

  async function vuAnalyzeShortform() {
    const url = String($('vu-shortform-url')?.value || '').trim();
    const btn = $('vu-shortform-btn');
    if (!url) return setStatus('vu-shortform-status', '릴스나 틱톡 링크를 입력해주세요.', 'error');
    if (btn) { btn.disabled = true; btn.textContent = '분석 중...'; }
    setStatus('vu-shortform-status', '영상을 받아서 장면과 메시지를 분석하는 중입니다...', 'pending');
    try {
      const resp = await fetch('/api/utils/shortform-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.detail || data.error || '숏폼 분석에 실패했습니다.');
      shortformAnalysis = data;
      lastFolder = data.folder || lastFolder;
      renderShortformAnalysis();
      setStatus('vu-shortform-status', '숏폼 분석을 완료했습니다.', 'success');
    } catch (error) {
      setStatus('vu-shortform-status', error.message || '숏폼 분석에 실패했습니다.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '분석'; }
    }
  }

  const vuCopyShortformSummary = () => copyText(shortformAnalysis?.text || '', '숏폼 분석 결과를 복사했습니다.', '분석 복사에 실패했습니다.');

  window.vuInit = vuInit;
  window.vuDownload = vuDownload;
  window.vuSearchYoutube = vuSearchYoutube;
  window.vuOpenSearchModal = vuOpenSearchModal;
  window.vuCloseSearchModal = vuCloseSearchModal;
  window.vuSetSearchSort = vuSetSearchSort;
  window.vuPrevSearchPage = vuPrevSearchPage;
  window.vuNextSearchPage = vuNextSearchPage;
  window.vuJumpSearchPage = vuJumpSearchPage;
  window.vuOpenLastFolder = vuOpenLastFolder;
  window.vuUseVideoUrl = vuUseVideoUrl;
  window.vuCopyVideoUrl = vuCopyVideoUrl;
  window.vuUseSearchThumbnail = vuUseSearchThumbnail;
  window.vuAnalyzeYoutubeFromSearch = vuAnalyzeYoutubeFromSearch;
  window.vuLoadThumbnail = vuLoadThumbnail;
  window.vuAttachImages = vuAttachImages;
  window.vuRemoveAttachedImage = vuRemoveAttachedImage;
  window.vuRemakeThumbnail = vuRemakeThumbnail;
  window.vuCopyThumbnailPrompt = vuCopyThumbnailPrompt;
  window.vuCopyThumbnailPath = vuCopyThumbnailPath;
  window.vuOpenThumbFolder = vuOpenThumbFolder;
  window.vuGenerateElement = vuGenerateElement;
  window.vuUseElementInThumbnail = vuUseElementInThumbnail;
  window.vuCopyElementPrompt = vuCopyElementPrompt;
  window.vuOpenElementFolder = vuOpenElementFolder;
  window.vuAnalyzeYoutube = vuAnalyzeYoutube;
  window.vuCopyYoutubeSummary = vuCopyYoutubeSummary;
  window.vuCopyYoutubeContent = vuCopyYoutubeContent;
  window.vuAnalyzeShortform = vuAnalyzeShortform;
  window.vuCopyShortformSummary = vuCopyShortformSummary;
})();
