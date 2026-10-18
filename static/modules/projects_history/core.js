// ═══ projects_history/core.js ═══
// 프로젝트 상세 모달 · 변환/업로드 · 트렌드 퀵스타트 (엔트리 파일)
// (원본 projects_history.js 라인 3664-4967 추출)

let _projDetailOpenId = null;

function projCardnewsAspectCss(value) {
  if (window.MKK_CARDNEWS_RATIOS?.css) return window.MKK_CARDNEWS_RATIOS.css(value || '1:1');
  if (value === '9:16') return '9 / 16';
  if (value === '16:9') return '16 / 9';
  if (value === '4:5') return '4 / 5';
  return '1 / 1';
}

async function projSaveSns(id) {
  const threads = document.getElementById('proj-sns-threads-' + id)?.value || '';
  const twitter = document.getElementById('proj-sns-twitter-' + id)?.value || '';
  try {
    await api(`/api/projects/${id}`, { method: 'PUT', body: { threads_text: threads, twitter_text: twitter } });
    toast('SNS 글 저장 완료');
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

function projSplitThreadsForDisplay(text) {
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
  return splitThreadsPostText(clean, 400);
}

function projSnsSegmentsStatusHtml(text) {
  const raw = String(text || '').trim();
  const count = projSplitThreadsForDisplay(raw).length;
  return `${raw.length}자 · ${count > 1 ? `<b style="color:#ff8c00;">${count}개 이어쓰기</b>로 나뉩니다` : '한 번에 복사 가능'}`;
}

function projSnsSegmentsHtml(id, text) {
  const segments = projSplitThreadsForDisplay(text);
  if (segments.length <= 1) return '';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
    <div style="font-size:11px;font-weight:800;color:#ff8c00;">이어쓰기 글 · ${segments.length}개</div>
    ${segments.map((segment, index) => `<div style="padding:10px 12px;border:1px solid rgba(255,140,0,0.16);border-radius:10px;background:rgba(255,140,0,0.04);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <b style="font-size:11px;color:#1c1c1e;">이어쓰기 ${index + 1}</b>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:10px;color:rgba(0,0,0,0.38);">${segment.length}자</span>
          <button type="button" onclick="projCopySnsSegment(${id}, ${index})" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.22);background:#fff;color:#ff8c00;font-size:10px;font-weight:700;cursor:pointer;">복사</button>
        </div>
      </div>
      <div style="white-space:pre-wrap;font-size:12px;line-height:1.65;color:#1c1c1e;">${escapeHtml(segment)}</div>
    </div>`).join('')}
  </div>`;
}

function projRefreshSnsSegments(id) {
  const text = document.getElementById('proj-sns-threads-' + id)?.value || '';
  const status = document.getElementById('proj-sns-segments-status-' + id);
  const wrap = document.getElementById('proj-sns-segments-' + id);
  if (status) status.innerHTML = projSnsSegmentsStatusHtml(text);
  if (wrap) wrap.innerHTML = projSnsSegmentsHtml(id, text);
}

async function projCopySnsSegment(id, index) {
  const text = document.getElementById('proj-sns-threads-' + id)?.value || '';
  const segment = projSplitThreadsForDisplay(text)[index] || '';
  if (!segment) return;
  await navigator.clipboard.writeText(segment);
  toast(`이어쓰기 ${index + 1} 복사됨`);
}

async function projSaveSnsBeforeUpload(id) {
  // 모달에서 수정한 SNS 글을 자동 저장 후 업로드 화면으로 이동
  const threadsEl = document.getElementById('proj-sns-threads-' + id);
  const twitterEl = document.getElementById('proj-sns-twitter-' + id);
  if (threadsEl || twitterEl) {
    const body = {};
    if (threadsEl) body.threads_text = threadsEl.value || '';
    if (twitterEl) body.twitter_text = twitterEl.value || '';
    try { await api(`/api/projects/${id}`, { method: 'PUT', body }); } catch {}
  }
  closeProjectDetailModal();
  const keyword = document.getElementById('proj-detail-name')?.textContent || '';
  kcGoToUploadFromHistory(keyword, id);
}

function closeProjectDetailModal() {
  const card = document.getElementById('proj-detail-card');
  if (card) card.style.display = 'none';
  document.body.style.overflow = '';
  _projDetailOpenId = null;
}

function projGetVideoUrl(videoPath) {
  if (!videoPath) return '';
  const parts = String(videoPath).split('/videos/');
  if (parts.length > 1) return `/api/videos/play/${parts[1]}`;
  return '';
}

function projJsString(value) {
  return escapeHtml(JSON.stringify(String(value || '')));
}

function projOpenFolder(folder) {
  api('/api/open-folder', { method: 'POST', body: { folder: String(folder || '') } })
    .then(() => toast('폴더 열림'))
    .catch(() => toast('폴더 열기 실패', 'error'));
}

function projFolderButton(label, folder) {
  if (!String(folder || '').trim()) return '';
  return `<button onclick="projOpenFolder(${projJsString(folder)})" style="padding:3px 10px;font-size:11px;background:rgba(0,0,0,0.06);color:rgba(0,0,0,0.5);border:none;border-radius:6px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:3px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${escapeHtml(label)}</button>`;
}

function projUploadTile(label, color, platform, projId, enabled, subLabel = '') {
  const bg = enabled ? color : 'rgba(0,0,0,0.12)';
  const opacity = enabled ? '1' : '0.45';
  const cursor = enabled ? 'pointer' : 'default';
  const onclick = enabled ? `onclick="projOpenUploadModal(${projId},'${platform}')"` : '';
  const border = enabled ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(0,0,0,0.08)';
  const shadow = enabled ? '0 12px 28px rgba(0,0,0,0.12)' : 'none';
  return `<button type="button" class="btn btn-sm" ${onclick} style="appearance:none;-webkit-appearance:none;background:${bg} !important;background-image:${bg} !important;opacity:${opacity};color:#fff !important;border:${border} !important;border-radius:16px;padding:12px 14px;font-size:13px;font-weight:700;display:flex;flex-direction:column;align-items:flex-start;gap:4px;cursor:${cursor};text-align:left;box-shadow:${shadow};min-height:56px;justify-content:center;">
    <span>${label}</span>
    <span style="font-size:10px;font-weight:500;opacity:0.85;">${subLabel || (enabled ? '준비됨' : '없음')}</span>
  </button>`;
}

async function openProjectDetail(id, clickedEl) {
  const card = document.getElementById('proj-detail-card');
  if (card && card.parentElement !== document.body) document.body.appendChild(card);
  if (card) {
    card.style.display = 'block';
    card.style.position = 'fixed';
    card.style.left = '0';
    card.style.top = '0';
    card.style.width = '100vw';
    card.style.height = '100vh';
    card.style.zIndex = '999999';
    card.style.background = 'rgba(0,0,0,0.62)';
    card.style.padding = '12px';
    card.style.overflowY = 'auto';
    card.style.boxSizing = 'border-box';
    const modalInner = card.firstElementChild;
    if (modalInner) {
      modalInner.style.width = 'min(1680px, calc(100vw - 24px))';
      modalInner.style.minHeight = 'calc(100vh - 24px)';
      modalInner.style.margin = '0 auto';
      modalInner.style.borderRadius = '28px';
      modalInner.style.padding = '28px';
      modalInner.style.boxSizing = 'border-box';
    }
  }

  // 같은 프로젝트 다시 클릭 → 토글 (닫기)
  if (_projDetailOpenId === id && card.style.display !== 'none') {
    closeProjectDetailModal();
    return;
  }
  _projDetailOpenId = id;
  document.body.style.overflow = 'hidden';
  document.getElementById('proj-content-sections').innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span></div>';

  try {
    const res = await api(`/api/projects/${id}`);
    const p = res.project;
    const sourceUrls = Array.isArray(p.source_urls) ? p.source_urls.filter(Boolean) : [];
    const blogImages = Array.isArray(res.blog_images?.images) ? res.blog_images.images : [];
    const detailImages = Array.isArray(res.detail_images?.images) ? res.detail_images.images : [];
    document.getElementById('proj-detail-name').textContent = p.name;
    const profileName = p.profile_name || '';
    // 업로드 링크 수집
    const uploadLinks = [];
    if (p.blog_url) uploadLinks.push({ name: '블로그', url: p.blog_url, color: '#03c75a', bg: 'rgba(3,199,90,0.1)' });
    if (p.threads_url) uploadLinks.push({ name: '스레드', url: p.threads_url, color: '#000', bg: 'rgba(0,0,0,0.06)' });
    if (p.twitter_url) uploadLinks.push({ name: '트위터', url: p.twitter_url, color: '#000', bg: 'rgba(0,0,0,0.06)' });
    if (p.youtube_url) uploadLinks.push({ name: '유튜브', url: p.youtube_url, color: '#ff0000', bg: 'rgba(255,0,0,0.08)' });
    if (p.ig_url) uploadLinks.push({ name: '인스타', url: p.ig_url, color: '#e1306c', bg: 'rgba(225,48,108,0.08)' });
    const uploadLinksHtml = uploadLinks.length ? ' · ' + uploadLinks.map(l =>
      `<a href="${escapeHtml(l.url)}" target="_blank" onclick="event.stopPropagation();" style="padding:2px 8px;background:${l.bg};color:${l.color};border-radius:6px;font-size:10px;text-decoration:none;font-weight:600;">${l.name} →</a>`
    ).join(' ') : '';
    document.getElementById('proj-detail-meta').innerHTML = `${profileName ? escapeHtml(profileName) + ' · ' : ''}${escapeHtml(p.keyword || '')} · ${p.created_at?.slice(0,16).replace('T',' ') || ''}${uploadLinksHtml}${p.blog_uploaded_at && !p.blog_url ? ` · 발행: ${p.blog_uploaded_at.slice(0,16).replace('T',' ')}` : ''}`;
    document.getElementById('proj-delete-btn').onclick = async () => {
      if (!await showConfirm('이 프로젝트를 삭제할까요?')) return;
      await api(`/api/projects/${id}`, { method: 'DELETE' });
      closeProjectDetailModal();
      loadProjects();
      toast('프로젝트 삭제됨');
    };
    const goUploadBtn = document.getElementById('proj-go-upload-btn');
    if (goUploadBtn) goUploadBtn.style.display = 'none';

    // 뱃지
    const badges = document.getElementById('proj-badges');
    badges.innerHTML = [
      res.blog ? `<span style="padding:4px 12px;background:rgba(52,199,89,0.1);color:#34c759;border-radius:8px;font-size:12px;font-weight:600;">블로그 ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">블로그</span>`,
      res.cardnews ? `<span style="padding:4px 12px;background:rgba(255,149,0,0.1);color:#ff9500;border-radius:8px;font-size:12px;font-weight:600;">카드뉴스 ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">카드뉴스</span>`,
      blogImages.length ? `<span style="padding:4px 12px;background:rgba(175,82,222,0.1);color:#af52de;border-radius:8px;font-size:12px;font-weight:600;">블로그 이미지 ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">블로그 이미지</span>`,
      detailImages.length ? `<span style="padding:4px 12px;background:rgba(0,199,190,0.1);color:#00c7be;border-radius:8px;font-size:12px;font-weight:600;">상세페이지 ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">상세페이지</span>`,
      res.comic ? `<span style="padding:4px 12px;background:rgba(255,214,0,0.15);color:#c89600;border-radius:8px;font-size:12px;font-weight:600;">만화 ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">만화</span>`,
      (p.threads_text || p.twitter_text) ? `<span style="padding:4px 12px;background:rgba(175,82,222,0.1);color:#af52de;border-radius:8px;font-size:12px;font-weight:600;">SNS ✓</span>` : `<span style="padding:4px 12px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.3);border-radius:8px;font-size:12px;">SNS</span>`,
    ].join('');

    // 블로그 태그 표시
    if (res.blog?.tags) {
      try {
        const rawTags = res.blog.tags;
        const tags = typeof rawTags === 'string' ? (rawTags.startsWith('[') ? JSON.parse(rawTags) : rawTags.split(',')) : (rawTags || []);
        const tagArr = tags.map(t => String(t).trim()).filter(t => t);
        if (tagArr.length > 0) {
          badges.innerHTML += `<div style="width:100%;margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${tagArr.map(t => `<span style="padding:2px 8px;background:rgba(255,140,0,0.06);color:rgba(255,140,0,0.7);border-radius:6px;font-size:10px;">#${escapeHtml(t)}</span>`).join('')}</div>`;
        }
      } catch {}
    }

    // 콘텐츠 섹션
    let sections = '';

    if (sourceUrls.length) {
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,122,255,0.04);border:1px solid rgba(0,122,255,0.1);border-radius:12px;">
        <div style="font-size:13px;font-weight:700;color:#007aff;margin-bottom:8px;">원본 링크</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${sourceUrls.map((url, idx) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;color:#007aff;text-decoration:none;font-size:12px;font-weight:600;line-height:1.5;">
            <span style="flex-shrink:0;color:rgba(0,0,0,0.35);font-weight:700;">${idx + 1}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(url)}</span>
          </a>`).join('')}
        </div>
      </div>`;
    }

    // 블로그
    if (res.blog) {
      const blogId = res.blog.id || p.blog_id;
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(52,199,89,0.04);border:1px solid rgba(52,199,89,0.1);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#34c759;">블로그</span>
          <div style="display:flex;gap:6px;">
            <button onclick="projPublishBlog(${blogId})" style="padding:3px 10px;font-size:11px;background:#03c75a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">발행</button>
            <button onclick="projEditBlog(${blogId})" style="padding:3px 10px;font-size:11px;background:rgba(0,0,0,0.06);border:none;border-radius:6px;cursor:pointer;color:#1c1c1e;">편집</button>
            <button onclick="projDeleteBlog(${blogId},${id})" style="padding:3px 10px;font-size:11px;background:rgba(255,59,48,0.08);border:none;border-radius:6px;cursor:pointer;color:#ff3b30;">삭제</button>
          </div>
        </div>
        <div style="font-size:15px;font-weight:600;color:#1c1c1e;margin-bottom:4px;">${escapeHtml(res.blog.title)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:4px;">${res.blog.status} · ${(res.blog.content||'').length}자</div>
        ${res.blog.tags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${(typeof res.blog.tags === 'string' ? res.blog.tags.split(',') : (res.blog.tags || [])).map(t => t.trim()).filter(t=>t).map(t => `<span style="font-size:10px;padding:2px 8px;background:rgba(255,140,0,0.08);color:#ff8c00;border-radius:6px;">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div id="proj-blog-preview-${blogId}" style="display:none;margin-top:8px;padding:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;font-size:13px;line-height:1.7;max-height:300px;overflow-y:auto;white-space:pre-wrap;color:#1c1c1e;"></div>
        <button onclick="projToggleBlogPreview(${blogId})" style="padding:4px 12px;font-size:11px;background:rgba(0,0,0,0.04);border:none;border-radius:6px;cursor:pointer;color:rgba(0,0,0,0.5);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>본문 보기/숨기기</button>
      </div>`;
    }

    // 카드뉴스
    if (res.cardnews) {
      const slides = res.cardnews.slides || [];
      const imgSlides = slides.filter(s => s.image_url);
      const hasImages = imgSlides.length > 0;
      const imgUrls = imgSlides.map(s => '/api/cardnews/image/' + s.image_url);
      const cardnewsAspect = projCardnewsAspectCss(res.cardnews.aspect_ratio);

      // 카드뉴스 썸네일 (크게)
      let cnContent = '';
      if (hasImages) {
        cnContent = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
          ${imgSlides.map((s, si) => {
            const url = '/api/cardnews/image/' + s.image_url;
            return `<img src="${url}" style="width:100%;aspect-ratio:${cardnewsAspect};object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.transform='scale(1.03)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none'" onclick="projShowSlideModal(${JSON.stringify(imgUrls).replace(/"/g,'&quot;')}, ${si})">`;
          }).join('')}
        </div>`;
      } else {
        cnContent = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
          ${slides.map((s, si) => `<div style="padding:12px;border-radius:10px;background:rgba(0,0,0,0.03);border:1px dashed rgba(0,0,0,0.1);font-size:11px;color:rgba(0,0,0,0.4);"><span style="font-weight:600;color:rgba(0,0,0,0.5);">${si+1}.</span> ${escapeHtml((s.title||s.text||'').substring(0,40))}</div>`).join('')}
        </div>`;
      }

      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(255,149,0,0.04);border:1px solid rgba(255,149,0,0.1);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#ff9500;">카드뉴스 ${hasImages ? '<span style="font-weight:400;color:rgba(0,0,0,0.3);font-size:11px;">' + imgSlides.length + '장 · 클릭하면 크게 보기</span>' : '<span style="font-weight:400;color:rgba(0,0,0,0.3);font-size:11px;">(텍스트만)</span>'}</span>
          <div style="display:flex;gap:6px;">
            ${!hasImages ? `<button onclick="projGenerateCnImages(${res.cardnews.id})" style="padding:3px 10px;font-size:11px;background:#ff9500;color:#fff;border:none;border-radius:6px;cursor:pointer;">이미지 생성</button>` : ''}
            <button onclick="projRegenContent(${id},'cardnews')" style="padding:3px 10px;font-size:11px;background:rgba(255,149,0,0.1);color:#ff9500;border:none;border-radius:6px;cursor:pointer;font-weight:600;">재작업</button>
            ${projFolderButton('카드뉴스 폴더', res.cardnews.project_dir || '')}
          </div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:8px;">${escapeHtml(res.cardnews.topic)}</div>
        ${cnContent}
      </div>`;

    }

    // 블로그 이미지 (블로그 글에 삽입되는 이미지)
    if (blogImages.length > 0) {
      const blogImgUrls = blogImages.map(img => img.url);
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(175,82,222,0.04);border:1px solid rgba(175,82,222,0.1);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#af52de;">블로그 이미지 <span style="font-weight:400;color:rgba(0,0,0,0.3);font-size:11px;">${blogImages.length}장 · 클릭하면 크게 보기</span></span>
          <div style="display:flex;gap:4px;">
            <button onclick="projRegenContent(${id},'blog-images')" style="padding:3px 10px;font-size:11px;background:rgba(175,82,222,0.1);color:#af52de;border:none;border-radius:6px;cursor:pointer;font-weight:600;">재작업</button>
            ${projFolderButton('블로그 이미지 폴더', res.blog_images?.project_dir || p.blog_images_dir || '')}
            <button onclick="this.parentElement.parentElement.nextElementSibling.style.display=this.parentElement.parentElement.nextElementSibling.style.display==='none'?'grid':'none';this.textContent=this.parentElement.parentElement.nextElementSibling.style.display==='none'?'펼치기':'접기'" style="padding:3px 10px;font-size:11px;background:rgba(175,82,222,0.08);color:#af52de;border:none;border-radius:6px;cursor:pointer;font-weight:600;">접기</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
          ${blogImages.map((img, idx) => `<img src="${img.url}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.transform='scale(1.03)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none'" onclick="projShowSlideModal(${JSON.stringify(blogImgUrls).replace(/"/g,'&quot;')}, ${idx})">`).join('')}
        </div>
      </div>`;
    }

    // 상세페이지 이미지 (독립 인포그래픽 이미지)
    if (detailImages.length > 0) {
      const detailUrls = detailImages.map(img => img.url);
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(0,199,190,0.04);border:1px solid rgba(0,199,190,0.1);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#00c7be;">상세페이지 <span style="font-weight:400;color:rgba(0,0,0,0.3);font-size:11px;">${detailImages.length}장 · 클릭하면 크게 보기</span></span>
          <div style="display:flex;gap:4px;">
            <button onclick="projRegenContent(${id},'detail')" style="padding:3px 10px;font-size:11px;background:rgba(0,199,190,0.1);color:#00c7be;border:none;border-radius:6px;cursor:pointer;font-weight:600;">재작업</button>
            ${projFolderButton('상세페이지 폴더', res.detail_images?.project_dir || p.detail_page_dir || '')}
            <button onclick="this.parentElement.parentElement.nextElementSibling.style.display=this.parentElement.parentElement.nextElementSibling.style.display==='none'?'grid':'none';this.textContent=this.parentElement.parentElement.nextElementSibling.style.display==='none'?'펼치기':'접기'" style="padding:3px 10px;font-size:11px;background:rgba(0,199,190,0.08);color:#00c7be;border:none;border-radius:6px;cursor:pointer;font-weight:600;">접기</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;">
          ${detailImages.map((img, idx) => `<img src="${img.url}" style="width:100%;aspect-ratio:0.72;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.transform='scale(1.03)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none'" onclick="projShowSlideModal(${JSON.stringify(detailUrls).replace(/"/g,'&quot;')}, ${idx})">`).join('')}
        </div>
      </div>`;
    }

    // 만화
    if (res.comic && res.comic.composed_image) {
      const cUrl = res.comic.composed_image.includes('/comics/') ? `/api/comic/image/${res.comic.composed_image.split('/comics/')[1]}` : '';
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(255,214,0,0.04);border:1px solid rgba(255,214,0,0.15);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:600;color:#c89600;">만화</span>
          <div style="display:flex;gap:6px;">
            <button onclick="projRegenContent(${id},'comic')" style="padding:3px 10px;font-size:11px;background:rgba(255,214,0,0.15);color:#c89600;border:none;border-radius:6px;cursor:pointer;font-weight:600;">재작업</button>
            ${projFolderButton('만화 폴더', res.comic.project_dir || '')}
          </div>
        </div>
        ${cUrl ? `<img src="${cUrl}" style="width:100%;max-width:400px;border-radius:10px;cursor:pointer;" onclick="kcShowImagePreview(this.src)">` : ''}
      </div>`;
    }

    // SNS
    if (p.threads_text || p.twitter_text) {
      sections += `<div style="margin-bottom:16px;padding:14px;background:rgba(175,82,222,0.04);border:1px solid rgba(175,82,222,0.1);border-radius:12px;">
        <div style="font-size:13px;font-weight:600;color:#af52de;margin-bottom:8px;">SNS</div>
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">스레드</span>
            <div style="display:flex;gap:4px;">
              <button onclick="navigator.clipboard.writeText(document.getElementById('proj-sns-threads-${id}').value);toast('복사됨')" style="padding:2px 8px;font-size:10px;background:rgba(0,0,0,0.06);border:none;border-radius:4px;cursor:pointer;color:rgba(0,0,0,0.5);">복사</button>
              <button onclick="projSaveSns(${id})" style="padding:2px 8px;font-size:10px;background:rgba(175,82,222,0.1);border:none;border-radius:4px;cursor:pointer;color:#af52de;font-weight:600;">저장</button>
              <button onclick="document.getElementById('proj-sns-threads-${id}').value='';projSaveSns(${id})" style="padding:2px 8px;font-size:10px;background:rgba(255,59,48,0.1);border:none;border-radius:4px;cursor:pointer;color:#ff3b30;">삭제</button>
            </div>
          </div>
          <textarea id="proj-sns-threads-${id}" rows="8" oninput="projRefreshSnsSegments(${id})" style="width:100%;padding:8px;font-size:12px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;resize:vertical;line-height:1.6;box-sizing:border-box;">${escapeHtml(p.threads_text || '')}</textarea>
          <div id="proj-sns-segments-status-${id}" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;">${projSnsSegmentsStatusHtml(p.threads_text || '')}</div>
          <div id="proj-sns-segments-${id}">${projSnsSegmentsHtml(id, p.threads_text || '')}</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">트위터</span>
            <div style="display:flex;gap:4px;">
              <button onclick="navigator.clipboard.writeText(document.getElementById('proj-sns-twitter-${id}').value);toast('복사됨')" style="padding:2px 8px;font-size:10px;background:rgba(0,0,0,0.06);border:none;border-radius:4px;cursor:pointer;color:rgba(0,0,0,0.5);">복사</button>
              <button onclick="projSaveSns(${id})" style="padding:2px 8px;font-size:10px;background:rgba(29,161,242,0.1);border:none;border-radius:4px;cursor:pointer;color:#1da1f2;font-weight:600;">저장</button>
              <button onclick="document.getElementById('proj-sns-twitter-${id}').value='';projSaveSns(${id})" style="padding:2px 8px;font-size:10px;background:rgba(255,59,48,0.1);border:none;border-radius:4px;cursor:pointer;color:#ff3b30;">삭제</button>
            </div>
          </div>
          <textarea id="proj-sns-twitter-${id}" rows="5" style="width:100%;padding:8px;font-size:12px;border:1px solid rgba(0,0,0,0.08);border-radius:8px;resize:vertical;line-height:1.6;box-sizing:border-box;">${escapeHtml(p.twitter_text || '')}</textarea>
        </div>
      </div>`;
    }

    sections += `<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.06);">
      <div id="proj-cost-${id}" style="margin-bottom:12px;padding:10px 14px;background:rgba(0,122,255,0.04);border-radius:10px;font-size:12px;color:rgba(0,0,0,0.5);display:none;"></div>
    </div>

    </div>`;

    if (!res.blog && !res.cardnews && !blogImages.length && !detailImages.length && !res.comic && !p.threads_text) {
      sections = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">아직 콘텐츠가 없습니다.</div>';
    }

    document.getElementById('proj-content-sections').innerHTML = sections;
    // 프로젝트 비용 로드
    try {
      const costRes = await api(`/api/usage/project/${id}`);
      if (costRes.calls > 0) {
        const costEl = document.getElementById(`proj-cost-${id}`);
        if (costEl) {
          costEl.style.display = 'block';
          costEl.innerHTML = `💰 이 프로젝트 비용: <strong>₩${Math.round(costRes.cost_krw).toLocaleString()}</strong> ($${costRes.cost_usd.toFixed(4)}) · ${costRes.calls}회 API 호출 · ${costRes.tokens.toLocaleString()} 토큰`;
        }
      }
    } catch {}

  } catch (e) {
    document.getElementById('proj-content-sections').innerHTML = `<div style="color:#ff3b30;padding:16px;">불러오기 실패: ${escapeHtml(e.message)}</div>`;
  }
}

// 콘텐츠 생성 결과를 프로젝트로 저장
async function kcSaveAsProject() {
  const keyword = document.getElementById('kc-keyword').value.trim() || '새 프로젝트';
  const blogTitle = document.getElementById('kc-blog-title')?.value || '';
  const threadsText = document.getElementById('kc-sns-threads-text')?.value || '';
  const twitterText = document.getElementById('kc-sns-twitter-text')?.value || '';
  const sourceUrls = (_kcSelectedSources || [])
    .map(s => String(s?.url || '').trim())
    .filter((url, idx, arr) => url && /^https?:\/\//i.test(url) && arr.indexOf(url) === idx);

  try {
    // 프로젝트 생성
    const res = await api('/api/projects', { method: 'POST', body: { name: blogTitle || keyword, keyword, source_urls: sourceUrls } });
    const projId = res.id;

    // 콘텐츠 연결
    const updateBody = {};
    if (_kcBlogPostId) updateBody.blog_id = _kcBlogPostId;
    if (_kcCnCardnewsId) updateBody.cardnews_id = _kcCnCardnewsId;
    if (window._kcBlogImagesDir) updateBody.blog_images_dir = window._kcBlogImagesDir;
    if (window._kcImgBlogDir) updateBody.detail_page_dir = window._kcImgBlogDir;
    if (typeof _kcComicId !== 'undefined' && _kcComicId) updateBody.comic_id = _kcComicId;
    if (threadsText) updateBody.threads_text = threadsText;
    if (twitterText) updateBody.twitter_text = twitterText;
    if (sourceUrls.length) updateBody.source_urls = sourceUrls;

    if (Object.keys(updateBody).length) {
      await api(`/api/projects/${projId}`, { method: 'PUT', body: updateBody });
    }

    toast('프로젝트 저장 완료!');

    // 프로젝트 페이지로 이동
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('[data-page="projects"]')?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-projects').classList.add('active');
    loadProjects(0);
    setTimeout(() => openProjectDetail(projId), 500);
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

// 페이지 전환 시 프로젝트 로드
const _projObserver = new MutationObserver(() => {
  const page = document.getElementById('page-projects');
  if (page && page.classList.contains('active')) loadProjects(0);
});
if (document.getElementById('page-projects')) {
  _projObserver.observe(document.getElementById('page-projects'), { attributes: true, attributeFilter: ['class'] });
}

// 프로젝트에서 변환으로 이동
async function projGoConvert(projId) {
  try {
    const res = await api(`/api/projects/${projId}`);
    const p = res.project;

    // 히스토리 상세 모달이 열린 채로 뒤에서만 페이지가 바뀌지 않도록 먼저 닫기
    closeProjectDetailModal();

    // 키워드 콘텐츠 페이지로 이동
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('[data-page="keyword-content"]')?.classList.add('active');
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById('page-keyword-content').classList.add('active');

    // 프로젝트 데이터 복원
    _kcProjectId = projId;
    const keyword = p.keyword || p.name || '';
    document.getElementById('kc-keyword').value = keyword;
    // kcGoToStep 가드 통과를 위해 검색 데이터 설정
    _kcSearchData = _kcSearchData || { keyword, sources: [] };
    if (_kcSelectedSources.length === 0) _kcSelectedSources = [{ title: keyword, checked: true }];

    // 블로그 데이터 복원
    if (res.blog) {
      _kcBlogPostId = res.blog.id;
      document.getElementById('kc-blog-title').value = res.blog.title || '';
      document.getElementById('kc-blog-body').value = res.blog.content || '';
      document.getElementById('kc-blog-chars').textContent = (res.blog.content || '').length;
      document.getElementById('kc-blog-result').style.display = 'block';
    }

    // 카드뉴스 데이터 복원 (이미지 포함)
    if (res.cardnews) {
      _kcCnCardnewsId = res.cardnews.id;
      _kcCardnewsDir = res.cardnews.project_dir || '';
      _kcCnTexts = res.cardnews.slides || [];
      document.getElementById('kc-cardnews-result').style.display = 'block';

      // 카드뉴스 이미지 렌더링 (캐러셀)
      const slides = res.cardnews.slides || [];
      const imgSlides = slides.filter(s => s.image_url);
      if (imgSlides.length > 0) {
        const urls = imgSlides.map(s => encImg('/api/cardnews/image/' + s.image_url));
        // 히든 컨테이너 유지
        const container = document.getElementById('kc-cardnews-slides');
        if (container) {
          container.innerHTML = urls.map(u => `<img src="${u}" style="display:none;">`).join('');
        }
        kcShowCnCarousel(urls);
        document.getElementById('kc-cn-actions').style.display = 'block';
      }

    }

    // 블로그 이미지 복원 (블로그 글에 삽입되는 이미지)
    {
      let blogImgs = [];
      if (Array.isArray(res.blog_images?.images) && res.blog_images.images.length > 0) {
        blogImgs = res.blog_images.images;
      } else if (p.blog_images_dir) {
        try {
          let blogImgRes = await api(`/api/blog/images-list?dir=${encodeURIComponent(p.blog_images_dir)}`);
          if (!blogImgRes?.images?.length) {
            blogImgRes = await api(`/api/blog/images-by-keyword?keyword=${encodeURIComponent(keyword)}`);
          }
          if (blogImgRes?.images?.length > 0) blogImgs = blogImgRes.images;
        } catch {}
      }
      if (blogImgs.length > 0) {
        window._kcBlogImages = blogImgs;
        kcRenderBlogImagesPreview();
      }
    }

    // 상세페이지 이미지 복원 (독립 인포그래픽 이미지)
    {
      let dpImages = [];
      if (Array.isArray(res.detail_images?.images) && res.detail_images.images.length > 0) {
        dpImages = res.detail_images.images;
      }
      if (dpImages.length > 0) {
        _kcImageBlogSlides = dpImages.map(img => img.url);
        window._kcImgBlogDir = res.detail_images?.project_dir || p.detail_page_dir || '';
        const resultDiv = document.getElementById('kc-image-blog-result');
        const slidesDiv = document.getElementById('kc-image-blog-slides');
        if (resultDiv && slidesDiv) {
          resultDiv.style.display = 'block';
          slidesDiv.style.display = 'grid';
          slidesDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
          slidesDiv.style.gap = '14px';
          slidesDiv.style.alignItems = 'start';
          slidesDiv.innerHTML = dpImages.map((img, i) => {
            const imgUrl = `${encImg(img.url)}?t=${Date.now()}`;
            return `<div id="kc-detail-slide-${i}" style="position:relative;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:12px;box-shadow:0 10px 24px rgba(15,23,42,0.05);">
              <div style="font-size:12px;font-weight:800;color:#1c1c1e;margin-bottom:8px;">${i + 1}장 · 상세페이지 ${i + 1}</div>
              <img src="${imgUrl}" style="display:block;width:100%;border-radius:12px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;background:#f5f5f7;min-height:220px;object-fit:cover;" onclick="kcShowImagePreview(this.src)">
              <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px;">
                <button onclick="kcRegenDetailSlide(${i})" style="padding:6px 10px;font-size:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 생성</button>
                <a href="${encImg(img.url)}" download="detail_${i+1}.png" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.06);color:#1c1c1e;border-radius:8px;text-decoration:none;">다운로드</a>
              </div>
            </div>`;
          }).join('');
        }
      }
    }

    // 만화 데이터 복원
    if (res.comic && res.comic.composed_image) {
      const comicResult = document.getElementById('kc-comic-result');
      if (comicResult) {
        comicResult.style.display = 'block';
        comicResult.innerHTML = '';

        // 개별 패널 복원
        const panels = res.comic.panels || [];
        if (panels.length > 0 && typeof _kcComicPanels !== 'undefined') {
          _kcComicPanels = panels.map(p => ({ ...p }));
          _kcComicDir = res.comic.project_dir || '';
          _kcComicId = res.comic.id || null;
          _kcComicTopic = res.comic.topic || '';
          _kcComicStyle = res.comic.style || 'cute';

          const grid = document.createElement('div');
          grid.id = 'kc-comic-panels-grid';
          grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;';
          panels.forEach((p, idx) => {
            const panelUrl = p.image_path
              ? `/api/comic/image/${p.image_path.split('/comics/').pop()}?t=${Date.now()}`
              : '';
            grid.innerHTML += kcRenderComicPanelCard(idx, panelUrl, p);
          });
          comicResult.appendChild(grid);
        }

        // 합성 이미지
        const comicUrl = res.comic.composed_image.startsWith('/') ? res.comic.composed_image : `/api/comic/image/${res.comic.composed_image}`;
        const composedDiv = document.createElement('div');
        composedDiv.style.cssText = 'text-align:center;';
        composedDiv.innerHTML = `
          <img id="kc-comic-image" src="${comicUrl}?t=${Date.now()}" style="max-width:100%;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="kcShowImagePreview(this.src)">
          <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;">
            <a id="kc-comic-download" href="${comicUrl}" download="comic.png" style="padding:6px 14px;background:rgba(0,0,0,0.06);color:#1c1c1e;border-radius:8px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>다운로드</a>
          </div>`;
        comicResult.appendChild(composedDiv);
      }
    }

    // SNS 데이터 복원
    if (p.threads_text || p.twitter_text) {
      document.getElementById('kc-sns-threads-text').value = p.threads_text || '';
      document.getElementById('kc-sns-twitter-text').value = p.twitter_text || '';
      document.getElementById('kc-sns-result').style.display = 'block';
    }

    // 영상 데이터 복원
    if (p.video_path) {
      _kcVideoPath = p.video_path;
      const vidResult = document.getElementById('kc-video-result');
      const vidPlayer = document.getElementById('kc-video-player');
      if (vidResult) vidResult.style.display = 'block';
      if (vidPlayer) vidPlayer.src = `/api/video/stream?path=${encodeURIComponent(p.video_path)}`;
    }

    // 생성 결과 + 업로드 단계로 직접 이동 (가드 스킵)
    document.getElementById('kc-result-card').style.display = 'block';
    kcUpdateContentTabs();

    // step 4(콘텐츠 생성)로 직접 이동 — 가드 완전 우회
    _kcCurrentStep = 4;
    document.querySelectorAll('.kc-step-card').forEach(c => c.style.display = 'none');
    document.getElementById('kc-card-4').style.display = 'block';
    document.getElementById('kc-result-card').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setKcHistoryRestoreMode(true);
    const uploadBtn = document.getElementById('kc-next-upload-btn');
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.style.opacity = '1';
      uploadBtn.classList.add('kc-next-btn');
    }

    // 스텝 인디케이터: 3번(콘텐츠 생성) 활성화
    [1, 2, 4, 5].forEach((s, idx) => {
      const numEl = document.getElementById('kc-step-num-' + s);
      const labelEl = document.getElementById('kc-step-label-' + s);
      if (numEl) {
        const active = s <= 4;
        numEl.style.background = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : 'rgba(0,0,0,0.06)';
        numEl.style.color = active ? '#fff' : 'rgba(0,0,0,0.25)';
      }
      if (labelEl) labelEl.style.color = s <= 4 ? '#1c1c1e' : 'rgba(0,0,0,0.25)';
      const lineId = [1, 2, 4];
      if (idx > 0) {
        const lineFill = document.getElementById('kc-step-line-fill-' + lineId[idx - 1]);
        if (lineFill) lineFill.style.width = s <= 4 ? '100%' : '0%';
      }
    });
    toast('프로젝트 데이터를 불러왔습니다.');
  } catch (e) {
    toast('불러오기 실패: ' + e.message, 'error');
  }
}

function setKcHistoryRestoreMode(enabled) {
  _kcHistoryRestoreMode = !!enabled;

  const notice = document.getElementById('kc-history-restore-notice');
  if (notice) notice.style.display = enabled ? 'block' : 'none';

  document.querySelectorAll('[data-history-lock="true"]').forEach(el => {
    el.disabled = !!enabled;
    el.style.opacity = enabled ? '0.45' : '';
    el.style.pointerEvents = enabled ? 'none' : '';
    el.style.cursor = enabled ? 'not-allowed' : '';
  });

  document.querySelectorAll('[data-history-lock-card="true"]').forEach(el => {
    el.style.opacity = enabled ? '0.55' : '';
    el.style.pointerEvents = enabled ? 'none' : '';
  });
}

// 히스토리에서 콘텐츠 재작업 → 키워드 콘텐츠 페이지의 해당 탭으로 이동
async function projRegenContent(projId, contentType) {
  try {
    const res = await api(`/api/projects/${projId}`);
    const p = res.project;

    // 프로젝트 데이터 복원
    if (typeof _kcProjectId !== 'undefined') _kcProjectId = projId;
    const keyword = p.keyword || p.name || '';
    document.getElementById('kc-keyword').value = keyword;
    _kcSearchData = _kcSearchData || { keyword, sources: [] };
    if (_kcSelectedSources.length === 0) _kcSelectedSources = [{ title: keyword, checked: true }];

    // 블로그 데이터 복원 (재작업에 필요)
    if (res.blog) {
      _kcBlogPostId = res.blog.id;
      const titleEl = document.getElementById('kc-blog-title');
      const bodyEl = document.getElementById('kc-blog-body');
      if (titleEl) titleEl.value = res.blog.title || '';
      if (bodyEl) bodyEl.value = res.blog.content || '';
      document.getElementById('kc-blog-result').style.display = 'block';
    }

    // 카드뉴스 복원
    if (res.cardnews) {
      _kcCnCardnewsId = res.cardnews.id;
      _kcCardnewsDir = res.cardnews.project_dir || '';
    }

    closeProjectDetailModal();

    // 키워드 콘텐츠 페이지로 이동
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('[data-page="keyword-content"]')?.classList.add('active');
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById('page-keyword-content').classList.add('active');

    // 해당 콘텐츠 탭으로 전환
    const tabMap = {
      'cardnews': 'cardnews',
      'detail': 'detail',
      'blog-images': 'detail',
      'comic': 'comic',
    };
    const tab = tabMap[contentType] || 'blog';

    // 4단계(콘텐츠 생성)로 이동 후 해당 탭 활성화
    setTimeout(() => {
      if (typeof kcGoToStep === 'function') kcGoToStep(4);
      setTimeout(() => {
        if (typeof kcSwitchContentTab === 'function') kcSwitchContentTab(tab);
        toast(`${contentType} 재작업 — 여기서 다시 생성하세요`);
      }, 300);
    }, 300);

  } catch (e) {
    toast('재작업 이동 실패: ' + e.message, 'error');
  }
}

// 프로젝트에서 블로그 발행
async function projGenerateCnImages(cnId) {
  const btn = event?.target?.closest('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 생성 중...'; }
  try {
    const cnPayload = await api(`/api/cardnews/history/${cnId}`);
    const cn = cnPayload.item || cnPayload;
    const slides = cn.slides || JSON.parse(cn.slides_json || '[]');
    const topic = cn.topic || '';
    const style = cn.style || 'modern';
    const ratio = window.MKK_CARDNEWS_RATIOS?.normalize?.(cn.aspect_ratio || '1:1') || cn.aspect_ratio || '1:1';
    let projDir = cn.project_dir || '';

    for (let i = 0; i < slides.length; i++) {
      if (btn) btn.innerHTML = `<span class="spinner"></span> ${i+1}/${slides.length}`;
      const s = slides[i];
      try {
        const res = await api('/api/cardnews/generate-single', {
          method: 'POST',
          body: { slide: s, topic, style, aspect_ratio: ratio, project_dir: projDir, cardnews_id: cnId },
        });
        if (!projDir && res.project_dir) projDir = res.project_dir;
      } catch {}
    }
    toast(`카드뉴스 이미지 ${slides.length}장 생성 완료!`);
    // 상세 새로고침
    const projItem = document.querySelector(`[onclick*="openProjectDetail"]`);
    if (projItem) projItem.click();
  } catch (e) {
    toast('이미지 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '이미지 생성'; }
  }
}

async function projPublish(projId) {
  try {
    const res = await api(`/api/projects/${projId}`);
    if (!res.blog) { toast('발행할 블로그 글이 없습니다', 'error'); return; }

    // API에서 카드뉴스/만화 이미지 가져오기 (DOM 의존 안 함)
    const cnImages = [];
    if (res.cardnews?.slides) {
      res.cardnews.slides.forEach(s => {
        if (s.image_url) cnImages.push('/api/cardnews/image/' + s.image_url);
      });
    }
    const comicImg = res.comic?.composed_image ? (res.comic.composed_image.includes('/comics/') ? '/api/comic/image/' + res.comic.composed_image.split('/comics/')[1] : '') : '';

    const tags = res.blog.tags ? (typeof res.blog.tags === 'string' ? res.blog.tags.split(',').map(t=>t.trim()).filter(t=>t) : res.blog.tags) : [];

    // 모달 먼저 열기
    openUploadModal({ title: res.blog.title || '', content: res.blog.content || '', tags, images: [], cardnewsImages: cnImages, comicImage: comicImg, postId: res.blog.id });

    // 태그 없으면 백그라운드 추출
    if (!tags.length && res.blog.content) {
      _fillTagsAsync(res.blog.id, res.blog.content);
    }
  } catch (e) {
    toast('데이터 로드 실패: ' + e.message, 'error');
  }
}

// 히스토리에서 5단계 업로드 화면으로 바로 이동
async function projGoToUpload(projId) {
  try {
    const res = await api(`/api/projects/${projId}`);
    const p = res.project;
    // 프로젝트 데이터를 4단계 변수에 주입
    if (typeof _kcProjectId !== 'undefined') _kcProjectId = projId;
    if (typeof _kcVideoPath !== 'undefined') _kcVideoPath = p.video_path || '';
    if (typeof _kcVideoPathSlide !== 'undefined') _kcVideoPathSlide = p.video_path_slide || '';
    const threadsEl = document.getElementById('kc-sns-threads-text');
    if (threadsEl) threadsEl.value = p.threads_text || '';
    const twitterEl = document.getElementById('kc-sns-twitter-text');
    if (twitterEl) twitterEl.value = p.twitter_text || '';
    const blogTitleEl = document.getElementById('kc-blog-title');
    if (blogTitleEl && res.blog) blogTitleEl.value = res.blog.title || '';
    const blogBodyEl = document.getElementById('kc-blog-body');
    if (blogBodyEl && res.blog) blogBodyEl.value = res.blog.content || '';
    // 카드뉴스
    if (typeof _kcCardnewsDir !== 'undefined') {
      _kcCardnewsDir = '';
      try { const cnRes = await api(`/api/projects/${projId}/cardnews`); if (cnRes.project_dir) _kcCardnewsDir = cnRes.project_dir; } catch {}
    }
    // 상세페이지
    if (typeof _kcImageBlogSlides !== 'undefined' && (p.detail_page_dir || p.blog_images_dir)) {
      _kcImageBlogSlides = [];
      window._kcImgBlogDir = p.detail_page_dir || p.blog_images_dir;
    }
    // 만화 복원
    if (res.comic && res.comic.composed_image) {
      const comicResult = document.getElementById('kc-comic-result');
      if (comicResult) {
        comicResult.style.display = 'block';
        comicResult.innerHTML = '';
        const comicUrl = res.comic.composed_image.startsWith('/') ? res.comic.composed_image : `/api/comic/image/${res.comic.composed_image}`;
        comicResult.innerHTML = `<img id="kc-comic-image" src="${comicUrl}?t=${Date.now()}" style="max-width:100%;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="kcShowImagePreview(this.src)">`;
        if (typeof _kcComicId !== 'undefined') _kcComicId = res.comic.id || null;
        if (typeof _kcComicDir !== 'undefined') _kcComicDir = res.comic.project_dir || '';
      }
    }
    // 블로그 이미지 복원
    if (Array.isArray(res.blog_images?.images) && res.blog_images.images.length > 0) {
      window._kcBlogImages = res.blog_images.images;
    }
    // 모달 닫기
    closeProjectDetailModal();
    // 워크스페이스 → 5단계로 이동
    navigateToPage('keyword-content', { skipConfirm: true });
    setTimeout(() => { if (typeof _kcForceShowStep === 'function') _kcForceShowStep(5); }, 300);
  } catch (e) {
    toast('업로드 이동 실패: ' + e.message, 'error');
  }
}

// 프로젝트 업로드 함수들
// 히스토리 프로젝트에서 플랫폼 모달 열기
async function projOpenUploadModal(projId, platform) {
  try {
    const res = await api(`/api/projects/${projId}`);
    const p = res.project;

    // 프로젝트 데이터를 전역에 세팅
    window._projUploadData = { projId, project: p };

    // 4단계 변수에 값 주입
    const threadsEl = document.getElementById('kc-sns-threads-text');
    if (threadsEl) threadsEl.value = p.threads_text || p.name || '';
    const twitterEl = document.getElementById('kc-sns-twitter-text');
    if (twitterEl) twitterEl.value = p.twitter_text || p.name || '';
    const igCaptionEl = document.getElementById('kc-cn-ig-caption');
    if (igCaptionEl) igCaptionEl.value = p.name || '';
    if (typeof _kcVideoPath !== 'undefined') _kcVideoPath = p.video_path || '';
    if (typeof _kcProjectId !== 'undefined') _kcProjectId = projId;

    // 카드뉴스 경로 설정 (인스타 업로드에 필수)
    if (typeof _kcCardnewsDir !== 'undefined') {
      _kcCardnewsDir = p.cardnews_dir || '';
      // cardnews_dir가 없으면 프로젝트의 카드뉴스에서 찾기
      if (!_kcCardnewsDir) {
        try {
          const cnRes = await api(`/api/projects/${projId}/cardnews`);
          if (cnRes.project_dir) _kcCardnewsDir = cnRes.project_dir;
        } catch {
          // 프로젝트 상세에서 이미지 경로 추출
          const firstCnImg = document.querySelector('#proj-content-sections img[src*="cardnews"]');
          if (firstCnImg) {
            const src = firstCnImg.src;
            const match = src.match(/cardnews\/image\/([^/]+)\//);
            if (match) _kcCardnewsDir = match[1];
          }
        }
      }
    }

    // 히스토리 카드뉴스 이미지를 4단계 슬라이드 영역에 임시 주입
    const cnContainer = document.getElementById('kc-cardnews-slides');
    if (cnContainer) {
      const projCnImages = [];
      document.querySelectorAll('#proj-content-sections img[src*="cardnews"]').forEach(img => projCnImages.push(img.src));
      if (projCnImages.length > 0) {
        cnContainer.innerHTML = projCnImages.map(src => `<div><img src="${src}" style="width:100%;"></div>`).join('');
      }
    }

    openPlatformUploadModal(platform);
  } catch (e) {
    toast('프로젝트 로딩 실패: ' + e.message, 'error');
  }
}

async function projUploadThreads(projId) {
  const btn = event?.target?.closest('button');
  try {
    const res = await api(`/api/projects/${projId}`);
    const text = res.project.threads_text;
    if (!text) { toast('스레드 글이 없습니다', 'error'); return; }

    // Chrome 연결 확인
    const status = await api('/api/browser/status');
    if (status.connected) {
      if (!confirm(`스레드에 자동 게시할까요?\n\n${text.substring(0, 100)}...`)) return;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 게시 중...'; }
      const result = await api('/api/threads/post', { method: 'POST', body: { text } });
      if (btn) { btn.innerHTML = '✓ 게시 완료'; btn.style.background = '#34c759'; }
      // 프로젝트에 업로드 상태 저장
      await api(`/api/projects/${projId}`, { method: 'PUT', body: { threads_uploaded_at: new Date().toISOString() } }).catch(() => {});
      toast('스레드 게시 완료!');
    } else {
      // Chrome 미연결 → 클립보드 복사 + 웹사이트
      await navigator.clipboard.writeText(text);
      toast('스레드 글이 클립보드에 복사되었습니다! threads.net에서 붙여넣기하세요.');
      window.open('https://www.threads.net', '_blank');
    }
  } catch (e) {
    // 자동 게시 실패 → 클립보드 폴백
    try {
      const res2 = await api(`/api/projects/${projId}`);
      await navigator.clipboard.writeText(res2.project.threads_text || '');
      toast('자동 게시 실패 — 글이 클립보드에 복사되었습니다. threads.net에서 붙여넣기하세요.');
      window.open('https://www.threads.net', '_blank');
    } catch { toast('실패: ' + e.message, 'error'); }
    if (btn) { btn.disabled = false; btn.innerHTML = '스레드'; }
  }
}

const TWITTER_SAFE_LIMIT = 250;
const TWITTER_HARD_LIMIT = 280;
const THREADS_SAFE_LIMIT = 450;

function normalizeThreadsText(text) {
  return String(text || '')
    .replace(/\r/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitThreadsPostText(text, limit = THREADS_SAFE_LIMIT) {
  const clean = normalizeThreadsText(text);
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  const sentences = clean
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!sentences.length) {
    const parts = [];
    for (let i = 0; i < clean.length; i += limit) {
      parts.push(clean.slice(i, i + limit).trim());
    }
    return parts.filter(Boolean);
  }

  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if ((current + ' ' + sentence).length <= limit) {
      current += ' ' + sentence;
    } else {
      chunks.push(current.trim());
      current = sentence;
    }
  }
  if (current) chunks.push(current.trim());

  const flattened = [];
  chunks.forEach(chunk => {
    if (chunk.length <= limit) {
      flattened.push(chunk);
      return;
    }
    for (let i = 0; i < chunk.length; i += limit) {
      flattened.push(chunk.slice(i, i + limit).trim());
    }
  });
  return flattened.filter(Boolean);
}

function normalizeTwitterPostText(text, limit = TWITTER_SAFE_LIMIT) {
  const clean = String(text || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 1)).trimEnd() + '…';
}

function updateTwitterCounter(counterEl, text) {
  if (!counterEl) return;
  const len = String(text || '').length;
  const remain = TWITTER_HARD_LIMIT - len;
  counterEl.textContent = `${len}/${TWITTER_HARD_LIMIT} · 남은 ${remain}`;
  counterEl.style.color = len > TWITTER_HARD_LIMIT ? '#ff3b30' : len > TWITTER_SAFE_LIMIT ? '#ff9500' : 'rgba(0,0,0,0.3)';
}

function bindTwitterComposerCounter(textareaId, counterId) {
  const textarea = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);
  if (!textarea || !counter) return;
  const sync = () => updateTwitterCounter(counter, textarea.value || '');
  textarea.addEventListener('input', sync);
  sync();
}

function bindUploadTypeChips(name) {
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  if (!radios.length) return;
  const sync = () => {
    radios.forEach(radio => {
      const chip = radio.closest('.upload-type-chip');
      if (!chip) return;
      const active = radio.checked;
      chip.style.background = active ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' : '#fff';
      chip.style.color = active ? '#fff' : '#1c1c1e';
      chip.style.borderColor = active ? 'transparent' : 'rgba(0,0,0,0.08)';
      chip.style.boxShadow = active ? '0 10px 24px rgba(var(--accent-rgb), 0.22)' : 'none';
    });
  };
  radios.forEach(radio => radio.addEventListener('change', sync));
  sync();
}

async function projUploadTwitter(projId) {
  const btn = event?.target?.closest('button');
  try {
    const res = await api(`/api/projects/${projId}`);
    const text = normalizeTwitterPostText(res.project.twitter_text);
    if (!text) { toast('트위터 글이 없습니다', 'error'); return; }

    const status = await api('/api/browser/status');
    if (status.connected) {
      if (!confirm(`트위터(X)에 게시할까요?\n\n${text.substring(0, 100)}...`)) return;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 게시 중...'; }
      await api('/api/twitter/post', { method: 'POST', body: { text } });
      if (btn) { btn.innerHTML = '✓ 게시 완료'; btn.style.background = '#34c759'; }
      // 프로젝트에 업로드 상태 저장
      await api(`/api/projects/${projId}`, { method: 'PUT', body: { twitter_uploaded_at: new Date().toISOString() } }).catch(() => {});
      toast('트위터 게시 완료!');
    } else {
      await navigator.clipboard.writeText(text);
      toast('Chrome 미연결 — 글이 복사되었습니다.');
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
  } catch (e) {
    if (btn) { btn.disabled = false; }
    await navigator.clipboard.writeText(res?.project?.twitter_text || '').catch(() => {});
    toast('자동 게시 실패 — 글이 복사되었습니다.');
    window.open('https://x.com', '_blank');
  }
}

async function projUploadInsta(projId) {
  const btn = event?.target?.closest('button');
  try {
    const res = await api(`/api/projects/${projId}`);
    if (!res.cardnews) { toast('카드뉴스가 없습니다', 'error'); return; }
    const caption = res.project.ig_caption || res.project.threads_text || res.cardnews.topic || '';
    if (!confirm(`인스타그램에 카드뉴스를 업로드할까요?\n\n캡션: ${caption.substring(0,100)}`)) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    await api('/api/instagram/upload', { method: 'POST', body: { project_dir: res.cardnews.project_dir, caption } });
    if (btn) { btn.innerHTML = '✓ 업로드 완료'; btn.style.background = '#34c759'; }
    toast('인스타그램 업로드 완료!');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '인스타 재시도'; }
    toast('인스타 업로드 실패: ' + e.message, 'error');
  }
}

async function projUploadYoutube(projId) {
  const btn = event?.target?.closest('button');
  try {
    const res = await api(`/api/projects/${projId}`);
    if (!res.project.video_path) { toast('영상이 없습니다', 'error'); return; }
    if (!confirm('YouTube에 영상을 업로드할까요?')) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    const result = await api('/api/upload/youtube', {
      method: 'POST',
      body: {
        video_path: res.project.video_path,
        title: res.project.name,
        description: '',
        privacy_status: 'public',
        is_shorts: true,
        profile_id: parseInt(res.project.profile_id || 0),
      }
    });
    if (btn) { btn.innerHTML = '&#10003; 업로드 완료'; btn.style.background = '#34c759'; }
    // Save to project
    await api(`/api/projects/${projId}`, { method: 'PUT', body: { youtube_uploaded_at: new Date().toISOString(), youtube_url: result.url || '' } });
    toast('YouTube 업로드 완료! ' + (result.url || ''));
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>유튜브 재시도'; }
    toast('YouTube 업로드 실패: ' + e.message, 'error');
  }
}

async function projUploadTiktok(projId) {
  try {
    const res = await api(`/api/projects/${projId}`);
    if (!res.project.video_path) { toast('영상이 없습니다', 'error'); return; }
    toast('TikTok 업로드 페이지를 열고 영상 폴더를 엽니다');
    window.open('https://www.tiktok.com/upload', '_blank');
    api('/api/open-folder', { method: 'POST', body: { folder: 'output/videos' } });
  } catch (e) { toast('실패: ' + e.message, 'error'); }
}

async function projUploadReels(projId) {
  const btn = event?.target?.closest('button');
  try {
    const res = await api(`/api/projects/${projId}`);
    if (!res.project.video_path) { toast('영상이 없습니다', 'error'); return; }
    if (!confirm('인스타그램에 릴스를 업로드할까요?')) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 업로드 중...'; }
    await api('/api/instagram/reels', {
      method: 'POST',
      body: { video_path: res.project.video_path, caption: res.project.ig_caption || '' }
    });
    if (btn) { btn.innerHTML = '&#10003; 업로드 완료'; btn.style.background = '#34c759'; }
    toast('인스타 릴스 업로드 완료!');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>릴스 재시도'; }
    toast('릴스 업로드 실패: ' + e.message, 'error');
  }
}

// 변환 처음부터 다시
function cvReset() {
  _cvSelectedBlog = null;
  _cvSelectedCn = null;
  document.getElementById('cv-blog-picker-btn').innerHTML = '블로그 글을 선택하세요';
  document.getElementById('cv-cn-picker-btn').innerHTML = '카드뉴스를 선택하세요';
  document.getElementById('cv-preview').style.display = 'none';
  document.getElementById('cv-actions-card').style.display = 'none';
  document.getElementById('cv-result-card').style.display = 'none';
  document.getElementById('cv-result-content').innerHTML = '';
  toast('초기화되었습니다');
}

// 만화 옵션 관리
window._cvComicOpts = { panels: 4, layout: '2x2', style: 'cute' };
function setCvComicOption(key, val, btn) {
  window._cvComicOpts[key] = val;
  // 같은 그룹의 버튼 토글
  const attr = 'data-comic-' + key;
  btn.parentElement.querySelectorAll('.qs-btn').forEach(b => b.classList.remove('qs-active'));
  btn.classList.add('qs-active');
}

// 변환 화면으로 이동 (인스타 업로드 등)
function goToConvert(action) {
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector('[data-page="convert"]');
  if (link) link.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-convert').classList.add('active');
  if (action) {
    toast('변환 페이지에서 콘텐츠를 선택 후 인스타 업로드하세요');
  }
}

function kcReset() {
  // 모든 상태 초기화
  _kcSearchData = null;
  _kcSelectedSources = [];
  _kcCurrentStep = 1;
  _kcCardnewsDir = '';
  _kcVideoPath = '';
  _kcCnTexts = null;
  _kcCnCardnewsId = null;
  _kcScrapedProduct = null;
  window._kcBlogImages = [];
  if (typeof _kcImageBlogSlides !== 'undefined') _kcImageBlogSlides = [];

  // UI 초기화 — 입력 필드
  document.getElementById('kc-keyword').value = '';
  const prodUrl = document.getElementById('kc-product-url');
  if (prodUrl) prodUrl.value = '';

  // URL 결과/글로벌 검색 결과
  const urlResult = document.getElementById('kc-url-result');
  if (urlResult) urlResult.style.display = 'none';
  const globalResults = document.getElementById('kc-global-results');
  if (globalResults) globalResults.style.display = 'none';
  const urlList = document.getElementById('kc-url-list');
  if (urlList) urlList.innerHTML = '';

  // 생성 결과 카드 전체 숨김
  ['kc-result-card', 'kc-blog-result', 'kc-cardnews-result', 'kc-video-result', 'kc-sns-result', 'kc-comic-result'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // 카드뉴스 슬라이드, 블로그 이미지, 상세페이지, 만화, 나레이션 초기화
  const cnSlides = document.getElementById('kc-cardnews-slides');
  if (cnSlides) cnSlides.innerHTML = '';
  const cnCarousel = document.getElementById('kc-cn-carousel');
  if (cnCarousel) cnCarousel.style.display = 'none';
  window._cnCarouselUrls = [];
  window._cnCarouselIdx = 0;
  const blogImgGrid = document.getElementById('kc-blog-images-grid');
  if (blogImgGrid) blogImgGrid.innerHTML = '';
  const blogImgWrap = document.getElementById('kc-blog-images-preview');
  if (blogImgWrap) blogImgWrap.style.display = 'none';
  const comicImg = document.getElementById('kc-comic-image');
  if (comicImg) comicImg.src = '';
  const narrationList = document.getElementById('kc-narration-list');
  if (narrationList) narrationList.innerHTML = '<div style="font-size:11px;color:rgba(0,0,0,0.3);text-align:center;padding:12px;">카드뉴스 이미지를 먼저 생성하세요</div>';
  const videoPlayer = document.getElementById('kc-video-player');
  if (videoPlayer) videoPlayer.src = '';
  // 콘텐츠 생성 버튼 다시 보이기
  const genBtn = document.getElementById('kc-generate-btn');
  if (genBtn) genBtn.style.display = '';
  setKcHistoryRestoreMode(false);
  // 탭 바 숨기고 초기화
  const tabBar = document.getElementById('kc-content-tabs');
  if (tabBar) tabBar.style.display = 'none';
  // 모든 패널 숨기고 블로그 패널만 기본 표시
  ['blog','sns','cardnews','comic','video','detail'].forEach(p => {
    const panel = document.getElementById('kc-panel-' + p);
    if (panel) panel.style.display = (p === 'blog') ? '' : 'none';
    const btn = document.getElementById('kc-tab-' + p);
    if (btn) { btn.classList.toggle('active', p === 'blog'); btn.disabled = (p === 'video' || p === 'detail'); }
  });

  // 업로드 단계 초기화
  const gotoUpload = document.getElementById('kc-goto-upload');
  if (gotoUpload) gotoUpload.style.display = 'none';
  const uploadHistory = document.getElementById('kc-upload-history');
  if (uploadHistory) uploadHistory.style.display = 'none';
  const uploadHistoryList = document.getElementById('kc-upload-history-list');
  if (uploadHistoryList) uploadHistoryList.innerHTML = '';
  ['blog', 'ig', 'threads', 'twitter', 'youtube', 'reels', 'tiktok'].forEach(p => {
    const btn = document.getElementById(`kc-upload-${p}-btn`);
    const status = document.getElementById(`kc-upload-${p}-status`);
    if (status) status.innerHTML = '';
  });

  // 카드뉴스 에디터/슬라이드 초기화
  const cnEditor = document.getElementById('kc-cn-editor');
  if (cnEditor) cnEditor.style.display = 'none';
  // cnSlides는 위에서 이미 초기화됨
  const cnActions = document.getElementById('kc-cn-actions');
  if (cnActions) cnActions.style.display = 'none';

  // 블로그 에디터 초기화
  const blogTitle = document.getElementById('kc-blog-title');
  if (blogTitle) blogTitle.value = '';
  const blogBody = document.getElementById('kc-blog-body');
  if (blogBody) blogBody.value = '';

  // 소스 목록 초기화
  const sourcesList = document.getElementById('kc-sources-list');
  if (sourcesList) sourcesList.innerHTML = '';

  // 연관 키워드 숨김
  const related = document.getElementById('kc-related-keywords');
  if (related) related.style.display = 'none';

  // 3단계 폼 초기화
  ['kc-business-name', 'kc-business-type', 'kc-business-desc', 'kc-contact-info', 'kc-blog-tags'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // 스텝 1로 이동 (직접 호출 시에만)
  _kcCurrentStep = 1;
  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById('kc-card-' + i);
    if (card) card.style.display = i === 1 ? 'block' : 'none';
  }
}

function startBlogFromTrendIdx(idx) {
  const t = (window._renderedTrends || [])[idx];
  if (!t) return;
  startBlogFromTrend(t.keyword, t.related_news || []);
}

function startBlogFromTrendKeyword(keyword) {
  startBlogFromTrend(keyword, []);
}

function tdPickNews(idx) {
  const n = (window._tdCustomNews || [])[idx];
  if (!n) return;
  startBlogFromTrend(n.title.substring(0, 60), [{title: n.title, url: n.url || n.link || '', source: n.source || ''}]);
}

function tdPickCategoryNews(category, idx) {
  const news = window._trendDashboardData?.category_news?.[category]?.news || [];
  const n = news[idx];
  if (!n) return;
  startBlogFromTrend(String(n.title || '').substring(0, 60), [{title: n.title, url: n.url || n.link || '', source: n.source || ''}]);
}

window.tdPickNews = tdPickNews;
window.tdPickCategoryNews = tdPickCategoryNews;

function normalizeTrendNewsSources(newsUrls, fallbackTitle) {
  if (!Array.isArray(newsUrls)) return [];
  return newsUrls
    .map(n => {
      const rawUrl = String((n && (n.url || n.link)) || '').trim();
      if (!rawUrl) return null;
      return {
        title: String((n && n.title) || fallbackTitle || '').trim(),
        url: rawUrl,
        source: String((n && n.source) || '').trim(),
        type: 'news',
        checked: true,
      };
    })
    .filter(Boolean);
}

async function startBlogFromTrend(keyword, newsUrls) {
  // 이전 결과 전부 초기화
  kcReset();

  // 키워드 콘텐츠 페이지로 이동
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const kcLink = document.querySelector('[data-page="keyword-content"]');
  if (kcLink) kcLink.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-keyword-content').classList.add('active');
  document.getElementById('kc-keyword').value = keyword;

  const normalizedNews = normalizeTrendNewsSources(newsUrls, keyword);
  if (normalizedNews.length > 0) {
    // 뉴스 URL이 있으면 검색 없이 바로 소스에 추가
    _kcSearchData = { keyword, sources: normalizedNews };
    _kcSelectedSources = normalizedNews.map(n => Object.assign({}, n));
    kcRenderSourcesList();
    await kcGoToStep(2);
    toast(`"${keyword.substring(0, 20)}" 뉴스 ${normalizedNews.length}건 → 본문 가져오는 중...`);

    // 본문 자동 스크래핑
    for (let idx = 0; idx < _kcSelectedSources.length; idx++) {
      const s = _kcSelectedSources[idx];
      if (s.url && !s.scrapedText) {
        await kcScrapeArticle(idx);
      }
    }
    const collected = _kcSelectedSources.filter(s => String(s.scrapedText || '').trim().length >= 50).length;
    kcRenderSourcesList();
    if (collected > 0) toast(`뉴스 본문 ${collected}건 수집 완료`);
  } else {
    toast(`"${keyword.substring(0, 30)}" 검색 중...`);
    setTimeout(() => kcSearch(), 500);
  }
}

function startCardNewsFromTrend(topic) {
  // 키워드 콘텐츠 페이지로 이동 → 자동 검색 (카드뉴스 옵션 체크)
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  const kcLink = document.querySelector('[data-page="keyword-content"]');
  if (kcLink) kcLink.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-keyword-content').classList.add('active');
  document.getElementById('kc-keyword').value = topic;
  kcInit();
  toast(`"${topic.substring(0, 30)}" → 뉴스 검색 후 카드뉴스를 생성하세요!`);
  // 자동 검색 시작
  setTimeout(() => kcSearch(), 500);
}
