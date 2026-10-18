// keyword_content/sources/scrape.js — URL 수동 추가, 소스 렌더링, 본문/이미지 스크래핑

// URL 직접 추가

async function kcAddUrl() {
  const input = document.getElementById('kc-url-input');
  const url = input.value.trim();
  if (!url || !url.startsWith('http')) { toast('올바른 URL을 입력해주세요.', 'error'); return; }

  const btn = document.getElementById('kc-url-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 가져오는 중...';

  try {
    let data;
    if (kcIsYoutubeUrl(url)) {
      const res = await api('/api/content/youtube-transcript', {
        method: 'POST',
        body: { url },
      });
      data = res.data;
    } else {
      const scraper = window._VAGSource && typeof window._VAGSource.scrapeArticle === 'function'
        ? window._VAGSource.scrapeArticle
        : null;
      if (!scraper) throw new Error('공용 URL 수집기를 사용할 수 없습니다.');
      const res = await scraper(url, { title: url, minLength: 100 });
      if (!res || !res.ok) throw new Error((res && res.error) || '본문 수집에 실패했습니다.');
      data = res;
    }
    _kcManualUrls.push({
      title: data.title || url,
      snippet: (data.text || '').substring(0, 200),
      url: data.url || url,
      scrapedText: data.text || '',
      scrapedImages: data.images || (data.thumbnail ? [data.thumbnail] : []),
      checked: true,
      type: kcIsYoutubeUrl(url) ? 'youtube' : 'url',
      channel: data.channel || '',
      duration: data.duration || '',
      videoId: data.video_id || '',
      thumbImage: data.thumbnail || '',
      scraping: false,
    });

    input.value = '';
    kcRenderUrlList();
    toast(`"${(data.title || url).substring(0, 40)}" 추가 (${data.char_count || 0}자)`);

    // URL만으로도 소스 선택 단계로 진행 가능
    if (_kcManualUrls.length > 0) {
      kcRenderSources(_kcManualUrls);
      document.getElementById('kc-card-2').style.display = 'block';
    }
  } catch (e) {
    toast('URL 가져오기 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'URL 추가';
  }
}

function kcRenderUrlList() {
  const container = document.getElementById('kc-url-list');
  if (_kcManualUrls.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = _kcManualUrls.map((u, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:4px;">
      <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.title)}</span>
      <span style="font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;">${(u.scrapedText||'').length}자</span>
      <button class="btn btn-sm" style="padding:2px 8px;font-size:11px;color:#ff453a;background:none;" onclick="_kcManualUrls.splice(${i},1);kcRenderUrlList();">삭제</button>
    </div>
  `).join('');
}

function kcRenderSources(sources) {
  const container = document.getElementById('kc-sources-list');

  // 뉴스와 블로그 분리
  const news = sources.filter(s => s.type === 'news' || s.press);
  const youtube = sources.filter(s => s.type === 'youtube');
  const blogs = sources.filter(s => s.type === 'blog' || s.type === 'url' || (!s.press && !s.type));
  const others = sources.filter(s => !news.includes(s) && !youtube.includes(s) && !blogs.includes(s));
  const allSources = [...news, ...youtube, ...blogs, ...others];

  // 소스 데이터 초기화
  _kcSelectedSources = allSources.map((s, idx) => ({
    title: s.title || '',
    snippet: s.snippet || s.description || '',
    url: s.url || s.link || '',
    press: s.press || '',
    date: s.date || '',
    type: s.type || (s.press ? 'news' : 'blog'),
    channel: s.channel || '',
    duration: s.duration || '',
    videoId: s.video_id || s.videoId || '',
    thumbImage: s.thumbnail || s.thumbImage || '',
    checked: typeof s.checked === 'boolean'
      ? s.checked
      : (idx < 1 && !!(s.url || s.link || s.scrapedText || s.text || s.content || s.snippet || s.description || s.title)),
    scrapedText: s.scrapedText || s.text || s.content || '',
    scrapedImages: s.scrapedImages || s.images || (s.thumbnail ? [s.thumbnail] : []),
    scrapeVerifiedBody: typeof s.scrapeVerifiedBody === 'boolean'
      ? s.scrapeVerifiedBody
      : (!s.url && !!(s.scrapedText || s.text || s.content)),
    scrapeVerifiedImages: typeof s.scrapeVerifiedImages === 'boolean'
      ? s.scrapeVerifiedImages
      : (!s.url && Array.isArray(s.scrapedImages || s.images || (s.thumbnail ? [s.thumbnail] : [])) && (s.scrapedImages || s.images || (s.thumbnail ? [s.thumbnail] : [])).length > 0),
    scrapeStatus: s.scrapeStatus || '',
    scrapeAttempts: Number(s.scrapeAttempts || 0),
    scraping: false,
  }));

  kcRenderSourcesList();
}

function kcSourceBodyReady(source) {
  return !!(source && source.scrapeVerifiedBody && String(source.scrapedText || '').trim().length >= 50);
}

function kcSourceSnippetReady(source) {
  if (!source) return false;
  return String([source.title, source.snippet].filter(Boolean).join('\n')).trim().length >= 12;
}

function kcSourceTextReady(source) {
  return kcSourceBodyReady(source) || kcSourceSnippetReady(source);
}

function kcSourceImagesReady(source) {
  return !!(source && source.scrapeVerifiedImages && Array.isArray(source.scrapedImages) && source.scrapedImages.length > 0);
}

function kcSourceComplete(source) {
  return kcSourceBodyReady(source) && kcSourceImagesReady(source);
}

function kcSourceUsable(source) {
  return !!(source && (source.url || kcSourceTextReady(source) || kcSourceImagesReady(source)));
}

function kcToggleSourceChecked(idx, checked) {
  const source = _kcSelectedSources[idx];
  if (!source || !kcSourceUsable(source)) return;
  source.checked = !!checked;
  if (source.checked && source.url && !kcSourceBodyReady(source) && !source.scraping) {
    kcScrapeArticle(idx);
  }
  kcRenderSourcesList();
}

function kcRenderSourcesList() {
  const container = document.getElementById('kc-sources-list');

  // 뉴스
  const news = _kcSelectedSources.filter(s => s.type === 'news');
  const youtube = _kcSelectedSources.filter(s => s.type === 'youtube');
  const manual = _kcSelectedSources.filter(s => s.type === 'manual' || s.type === 'direct' || s.type === 'deep-research');
  const blogs = _kcSelectedSources.filter(s => s.type !== 'news' && s.type !== 'youtube' && !manual.includes(s));

  let html = '';

  if (news.length > 0) {
    html += `<div style="font-size:14px;font-weight:600;color:#ff6b9d;margin-bottom:8px;">뉴스 (${news.length}건)</div>`;
    news.forEach((s, idx) => {
      const globalIdx = _kcSelectedSources.indexOf(s);
      html += kcSourceItemHtml(s, globalIdx);
    });
  }

  if (youtube.length > 0) {
    html += `<div style="font-size:14px;font-weight:600;color:#ff0000;margin:16px 0 8px;">YouTube (${youtube.length}건)</div>`;
    youtube.forEach((s, idx) => {
      const globalIdx = _kcSelectedSources.indexOf(s);
      html += kcSourceItemHtml(s, globalIdx);
    });
  }

  if (blogs.length > 0) {
    html += `<div style="font-size:14px;font-weight:600;color:#5b9bf5;margin:16px 0 8px;">블로그 (${blogs.length}건)</div>`;
    blogs.forEach((s, idx) => {
      const globalIdx = _kcSelectedSources.indexOf(s);
      html += kcSourceItemHtml(s, globalIdx);
    });
  }

  if (manual.length > 0) {
    html += `<div style="font-size:14px;font-weight:600;color:#ff8c00;margin:16px 0 8px;">직접 자료 (${manual.length}건)</div>`;
    manual.forEach((s, idx) => {
      const globalIdx = _kcSelectedSources.indexOf(s);
      html += kcSourceItemHtml(s, globalIdx);
    });
  }

  if (!html) {
    html = `<div style="padding:24px;text-align:center;color:rgba(0,0,0,0.45);background:rgba(255,140,0,0.04);border:1px dashed rgba(255,140,0,0.18);border-radius:14px;">
      <div style="font-size:14px;font-weight:700;color:#ff8c00;margin-bottom:6px;">실제 URL이 있는 검색 결과가 없습니다</div>
      <div style="font-size:12px;line-height:1.6;">키워드를 조금 바꿔 다시 검색하거나, 1단계의 URL 입력/직접 입력으로 자료를 넣어주세요.</div>
    </div>`;
  }

  container.innerHTML = html;
}

function kcSourceItemHtml(source, idx) {
  const checked = source.checked ? 'checked' : '';
  const bodyReady = kcSourceBodyReady(source);
  const imagesReady = kcSourceImagesReady(source);
  const hasScraped = bodyReady || imagesReady;
  const isYoutube = source.type === 'youtube';
  const usable = kcSourceUsable(source);
  let scrapeBadge = '';
  if (source.scraping) {
    scrapeBadge = `<span style="font-size:11px;color:#6b7f8e;"><span class="spinner" style="width:12px;height:12px;"></span> ${isYoutube ? '자막/이미지 가져오는 중...' : '본문/이미지 가져오는 중...'}</span>`;
  } else if (bodyReady && imagesReady) {
    scrapeBadge = `<span style="font-size:11px;color:#4fc08d;">${isYoutube ? '자막/이미지 확보됨' : '본문/이미지 확보됨'}</span>`;
  } else if (bodyReady) {
    scrapeBadge = `<span style="font-size:11px;color:#ff9500;">본문만 확보됨 · 이미지 재시도 필요</span>`;
  } else if (imagesReady) {
    scrapeBadge = `<span style="font-size:11px;color:#ff9500;">이미지만 확보됨 · 본문 재시도 필요</span>`;
  }
  const scrapeBtn = source.url
    ? (scrapeBadge || `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" onclick="kcScrapeArticle(${idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>${isYoutube ? '자막/이미지 가져오기' : '본문/이미지 가져오기'}</button>`)
    : (bodyReady
      ? `<span style="font-size:11px;color:#4fc08d;">본문 확보됨</span>`
      : `<span style="font-size:11px;color:#ff9500;">URL 없음 · 1단계에서 URL/직접 입력 필요</span>`);

  let scrapedSection = '';
  if (hasScraped) {
    // 이미지 썸네일
    let imgHtml = '';
    if (source.scrapedImages && source.scrapedImages.length > 0) {
      imgHtml = `<span style="font-size:11px;color:#5b9bf5;margin-left:8px;">이미지 ${source.scrapedImages.length}장 수집됨 (3단계에서 선택)</span>`;
    }
    scrapedSection = `
      <div style="margin-top:6px;">
        <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;" onclick="this.parentElement.querySelector('.kc-scraped-detail').style.display=this.parentElement.querySelector('.kc-scraped-detail').style.display==='none'?'block':'none'">
          본문 보기/숨기기 (${source.scrapedText.length}자)
        </button>
        <span style="font-size:11px;color:#5b9bf5;margin-left:8px;">이미지 ${(source.scrapedImages||[]).length}장</span>
        ${source.url ? `<button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;margin-left:6px;" onclick="kcScrapeArticle(${idx},{force:true})">다시 시도</button>` : ''}
        <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;margin-left:6px;" onclick="kcDownloadAllImages(${idx})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>전체 다운로드</button>
        ${imgHtml}
        <div class="kc-scraped-detail" style="display:none;margin-top:6px;padding:10px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.06);border-radius:8px;font-size:12px;line-height:1.7;max-height:360px;overflow-y:auto;color:#1c1c1e;white-space:pre-wrap;">${escapeHtml(source.scrapedText)}</div>
      </div>`;
  }

  // 썸네일 이미지 (og:image 또는 스크래핑 이미지)
  const thumbUrl = source.thumbImage || (source.scrapedImages && source.scrapedImages[0]) || '';

  return `
    <div onclick="if(!event.target.closest('button,a,input,textarea,select'))kcToggleSourceChecked(${idx},!_kcSelectedSources[${idx}].checked)" style="padding:10px 12px;border:1px solid #1e3a52;border-radius:8px;margin-bottom:6px;cursor:${usable ? 'pointer' : 'not-allowed'};${source.checked ? 'background:rgba(79,192,141,0.05);border-color:#4fc08d44;' : ''}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <input type="checkbox" ${checked} ${usable ? '' : 'disabled'} style="margin-top:3px;width:16px;height:16px;accent-color:#4fc08d;flex-shrink:0;${usable ? '' : 'opacity:0.35;'}" onchange="kcToggleSourceChecked(${idx},this.checked)">
        ${thumbUrl ? `<img src="${thumbUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #1e3a52;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(source.title)}</div>
          <div style="font-size:11px;color:#6b7f8e;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${source.press ? `<span style="color:#ff6b9d;">${escapeHtml(source.press)}</span>` : ''}
            ${source.channel ? `<span style="color:#ff0000;">${escapeHtml(source.channel)}</span>` : ''}
            ${source.duration ? `<span>${escapeHtml(source.duration)}</span>` : ''}
            ${source.date ? `<span>${escapeHtml(source.date)}</span>` : ''}
            ${scrapeBtn}
          </div>
          ${source.snippet ? `<div style="font-size:12px;color:#8899aa;margin-top:4px;line-height:1.4;">${escapeHtml(source.snippet.substring(0, 150))}${source.snippet.length > 150 ? '...' : ''}</div>` : ''}
          ${scrapedSection}
        </div>
      </div>
    </div>`;
}

// 소스 이미지 선택/해제
// 이미지 호버 프리뷰
function kcShowImageHover(el, url) {
  if (!_hoverPreview) {
    _hoverPreview = document.createElement('div');
    _hoverPreview.id = 'kc-image-hover';
    _hoverPreview.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid rgba(0,0,0,0.1);overflow:hidden;transition:opacity 0.15s;';
    document.body.appendChild(_hoverPreview);
  }
  const rect = el.getBoundingClientRect();
  _hoverPreview.innerHTML = `<img src="${url}" style="display:block;max-width:400px;max-height:400px;object-fit:contain;background:#fff;">`;
  _hoverPreview.style.opacity = '1';
  _hoverPreview.style.display = 'block';
  // 위치: 요소 오른쪽에, 화면 밖이면 왼쪽에
  let left = rect.right + 12;
  let top = rect.top - 60;
  if (left + 380 > window.innerWidth) left = rect.left - 380;
  if (top < 10) top = 10;
  if (top + 380 > window.innerHeight) top = window.innerHeight - 390;
  _hoverPreview.style.left = left + 'px';
  _hoverPreview.style.top = top + 'px';
}

function kcHideImageHover() {
  if (_hoverPreview) {
    _hoverPreview.style.opacity = '0';
    setTimeout(() => { if (_hoverPreview) _hoverPreview.style.display = 'none'; }, 150);
  }
}

// 전체 이미지 다운로드
async function kcDownloadAllImages(sourceIdx) {
  const source = _kcSelectedSources[sourceIdx];
  if (!source || !source.scrapedImages || source.scrapedImages.length === 0) {
    toast('다운로드할 이미지가 없습니다', 'error');
    return;
  }
  toast(`${source.scrapedImages.length}장 다운로드 시작...`);
  for (let i = 0; i < source.scrapedImages.length; i++) {
    try {
      const url = source.scrapedImages[i];
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const ext = url.split('.').pop().split('?')[0] || 'jpg';
      a.download = `image_${sourceIdx + 1}_${i + 1}.${ext.substring(0, 4)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('다운로드 실패:', e);
    }
    // 브라우저 부하 방지
    if (i < source.scrapedImages.length - 1) await new Promise(r => setTimeout(r, 300));
  }
  toast(`${source.scrapedImages.length}장 다운로드 완료!`);
}

function kcToggleSourceImage(sourceIdx, imgIdx, el) {
  const source = _kcSelectedSources[sourceIdx];
  if (!source._selectedImages) source._selectedImages = new Set();

  if (source._selectedImages.has(imgIdx)) {
    source._selectedImages.delete(imgIdx);
  } else {
    source._selectedImages.add(imgIdx);
  }

  // 클릭한 이미지만 즉시 업데이트 (전체 리렌더 없이)
  const isSel = source._selectedImages.has(imgIdx);
  el.style.border = `2px solid ${isSel ? '#007aff' : 'rgba(0,0,0,0.08)'}`;
  el.style.opacity = isSel ? '1' : '0.5';
  // 체크마크 토글
  let check = el.querySelector('.img-check');
  if (isSel && !check) {
    check = document.createElement('div');
    check.className = 'img-check';
    check.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;background:#007aff;border-radius:50%;display:flex;align-items:center;justify-content:center;';
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"/></svg>';
    el.appendChild(check);
  } else if (!isSel && check) {
    check.remove();
  }
  // 선택 수 업데이트
  const countEl = el.closest('[id^="kc-img-grid-"]')?.previousElementSibling;
  if (countEl && countEl.textContent.includes('선택됨')) {
    countEl.textContent = `클릭하여 사용할 이미지 선택 (${source._selectedImages.size}/${source.scrapedImages.length}장 선택됨)`;
  }
}

// 이미지 편집 완료 콜백 — 원본 이미지를 직접 교체
function kcOnImageEdited(sourceIdx, imgIdx, data) {
  const source = _kcSelectedSources[sourceIdx];
  if (data && (data.url || data.path)) {
    const newUrl = data.url || `/api/content/user-image/${data.filename}`;
    // 원본 이미지를 편집된 이미지로 교체
    source.scrapedImages[imgIdx] = newUrl;
    if (!source._selectedImages) source._selectedImages = new Set();
    source._selectedImages.add(imgIdx);
    toast('이미지가 편집되었습니다.');
    kcRenderSourcesList();
  }
}

async function kcFetchSourceImages() {
  // URL 있는 소스들의 og:image를 백그라운드로 수집
  const urls = _kcSelectedSources
    .filter(s => s.url && !s.thumbImage)
    .map(s => s.url);
  if (urls.length === 0) return;

  try {
    const res = await api('/api/content/fetch-images', {
      method: 'POST',
      body: urls,
    });
    const imgMap = res.images || {};
    let updated = 0;
    _kcSelectedSources.forEach(s => {
      if (s.url && imgMap[s.url]) {
        s.thumbImage = imgMap[s.url];
        updated++;
      }
    });
    if (updated > 0) {
      console.log(`[KC] ${updated}개 소스 이미지 수집 완료`);
      kcRenderSourcesList();
    }
  } catch (e) {
    console.log('[KC] 소스 이미지 수집 실패:', e);
  }
}

// 크롬 미연결 시 자동 연결 시도
async function ensureChromeConnected() {
  try {
    const data = await api('/api/browser/status');
    if (data.connected) return true;
  } catch {}
  try {
    toast('Chrome 자동 연결을 시도합니다...');
    await autoLaunchChromeForExtension();
    const connected = await waitForChromeConnection(18, 1000);
    if (connected?.connected) {
      checkBrowserStatus();
      return true;
    }
  } catch {}
  // 미연결 → 설정 배너 표시 + 안내
  toast('Chrome 확장프로그램이 연결되지 않았습니다.\n상단의 "자동 설정" 버튼을 눌러 설정해주세요.', 'error', 6000);
  if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner();
  const btn = document.getElementById('chrome-connect-btn');
  if (btn) { btn.style.background = '#ff3b30'; btn.style.color = '#fff'; btn.style.borderColor = '#ff3b30'; btn.style.animation = 'kcBounce 1s ease-in-out infinite'; btn.textContent = '자동 연결'; }
  return false;
}

function kcEnsureScrapeLogModal(source, idx) {
  let modal = document.getElementById('scrape-log-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scrape-log-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100020;background:rgba(15,23,42,0.38);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
    document.body.appendChild(modal);
  }
  const domain = new URL(source.url).hostname.replace('www.','');
  modal.innerHTML = `
    <div style="width:min(900px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:hidden;border-radius:24px;background:linear-gradient(180deg,#fff7ef 0%,#ffffff 38%);box-shadow:0 28px 80px rgba(15,23,42,0.22);border:1px solid rgba(255,140,0,0.18);display:flex;flex-direction:column;">
      <div style="padding:22px 24px 18px;border-bottom:1px solid rgba(0,0,0,0.06);background:linear-gradient(135deg,rgba(255,140,0,0.10),rgba(255,107,0,0.04));">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">📡</div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:18px;font-weight:800;color:#1c1c1e;">${source.type === 'youtube' ? 'YouTube 자막/이미지 확보' : '본문/이미지 확보 진행'}</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(source.title || domain)} · ${escapeHtml(domain)}</div>
          </div>
          <button type="button" onclick="document.getElementById('scrape-log-modal')?.remove()" style="width:34px;height:34px;border:none;border-radius:50%;background:rgba(0,0,0,0.05);font-size:16px;color:rgba(0,0,0,0.42);cursor:pointer;">×</button>
        </div>
        <div id="kc-scrape-attempt-badge" style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid rgba(255,140,0,0.14);font-size:12px;font-weight:700;color:#ff8c00;">시작 준비 중</div>
      </div>
      <div style="padding:18px 24px 0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;" id="kc-scrape-stage-grid"></div>
      <div style="padding:18px 24px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div id="kc-scrape-summary" style="font-size:13px;font-weight:700;color:#1c1c1e;">본문과 이미지를 모두 확보할 때까지 단계별로 재시도합니다.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" onclick="kcScrapeArticle(${idx},{force:true})" style="padding:9px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">재시도</button>
          <button type="button" onclick="kcScrapeArticle(${idx},{force:true,imagesOnly:true})" style="padding:9px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;background:#fff;color:#1c1c1e;font-size:12px;font-weight:700;cursor:pointer;">이미지 다시</button>
        </div>
      </div>
      <div id="kc-scrape-collected-preview" style="display:none;margin:16px 24px 0;padding:16px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,0.06);box-shadow:0 8px 24px rgba(15,23,42,0.06);"></div>
      <div id="kc-scrape-log-lines" style="padding:18px 24px 24px;overflow:auto;display:flex;flex-direction:column;gap:8px;"></div>
      <div id="kc-scrape-manual-area" style="display:none;padding:0 24px 24px;"></div>
    </div>`;
  const stageGrid = modal.querySelector('#kc-scrape-stage-grid');
  const stageDefs = [
    ['electron', 'Electron', '내부 브라우저'],
    ['lightpanda', 'Stealth/판다', '서버 파이프라인'],
    ['requests', '요청 본문', '서버 요청'],
    ['cdp', 'CDP', 'Chrome 브릿지'],
    ['images', '이미지 확보', '이미지만'],
  ];
  stageGrid.innerHTML = stageDefs.map(([key, label, hint]) => `
    <div data-stage-key="${key}" title="${idx >= 0 ? `${label} 단계만 실행/재실행` : '공통 수집 진행 중'}" style="text-align:left;padding:12px;border-radius:16px;border:1px solid rgba(0,0,0,0.08);background:#fff;min-height:118px;">
      <div style="font-size:11px;font-weight:800;color:rgba(0,0,0,0.38);">${label}</div>
      <div class="kc-stage-state" style="margin-top:10px;font-size:13px;font-weight:800;color:rgba(0,0,0,0.55);">대기</div>
      <div class="kc-stage-message" style="margin-top:6px;font-size:11px;line-height:1.5;color:rgba(0,0,0,0.38);">아직 실행 전</div>
      <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <div style="font-size:10px;font-weight:800;color:#ff8c00;">${hint}</div>
        ${idx >= 0 ? `<button type="button" class="kc-stage-run-btn" onclick="event.stopPropagation();kcRunScrapeStage(${idx},'${key}')" style="padding:5px 8px;border:none;border-radius:8px;background:rgba(255,140,0,0.10);color:#ff8c00;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap;">실행</button>` : ''}
      </div>
    </div>
  `).join('');
  return modal;
}

function kcScrapeModalSetAttempt(modal, attempt, maxAttempts, label) {
  const badge = modal?.querySelector('#kc-scrape-attempt-badge');
  if (!badge) return;
  badge.textContent = `${attempt}/${maxAttempts}차 시도 · ${label || '진행 중'}`;
}

function kcScrapeModalSetSummary(modal, text, color) {
  const summary = modal?.querySelector('#kc-scrape-summary');
  if (!summary) return;
  summary.textContent = text || '';
  summary.style.color = color || '#1c1c1e';
}

function kcScrapeModalUpdateStage(modal, key, state, message) {
  const card = modal?.querySelector(`[data-stage-key="${key}"]`);
  if (!card) return;
  const stateEl = card.querySelector('.kc-stage-state');
  const msgEl = card.querySelector('.kc-stage-message');
  const styles = {
    pending: ['대기', 'rgba(0,0,0,0.55)', '#fff', 'rgba(0,0,0,0.08)'],
    running: ['실행 중', '#ff8c00', 'rgba(255,140,0,0.08)', 'rgba(255,140,0,0.16)'],
    success: ['완료', '#34c759', 'rgba(52,199,89,0.08)', 'rgba(52,199,89,0.16)'],
    failed: ['실패', '#ff3b30', 'rgba(255,59,48,0.07)', 'rgba(255,59,48,0.16)'],
    partial: ['부분 확보', '#ff9500', 'rgba(255,149,0,0.08)', 'rgba(255,149,0,0.16)'],
  }[state || 'pending'];
  if (stateEl) {
    stateEl.textContent = styles[0];
    stateEl.style.color = styles[1];
  }
  if (msgEl) msgEl.textContent = message || '';
  const runBtn = card.querySelector('.kc-stage-run-btn');
  if (runBtn) {
    runBtn.textContent = state === 'pending' ? '실행' : '재실행';
    runBtn.disabled = state === 'running';
    runBtn.style.opacity = state === 'running' ? '0.55' : '1';
    runBtn.style.cursor = state === 'running' ? 'not-allowed' : 'pointer';
  }
  card.style.background = styles[2];
  card.style.borderColor = styles[3];
}

async function kcRunScrapeStage(idx, stageKey) {
  const source = _kcSelectedSources[idx];
  if (!source?.url) { toast('URL이 없습니다', 'error'); return; }
  if (source.scraping) { toast('이미 수집 중입니다', 'error'); return; }
  const key = String(stageKey || '').trim();
  const logModal = kcEnsureScrapeLogModal(source, idx);
  const stageLabel = {
    electron: 'Electron 내부 브라우저',
    lightpanda: 'Stealth/판다',
    requests: '요청 본문',
    cdp: 'CDP',
    images: '이미지 확보',
  }[key] || '선택 단계';

  try {
    source.scraping = true;
    source.checked = true;
    source.scrapeStatus = 'running';
    kcScrapeModalSetAttempt(logModal, 1, 1, stageLabel + ' 재시도');
    kcScrapeModalSetSummary(logModal, stageLabel + ' 단계만 다시 실행합니다.', '#ff8c00');
    kcScrapeModalUpdateStage(logModal, key, 'running', '선택 단계 실행 중');
    kcScrapeModalAddLog(logModal, '↻', stageLabel + ' 단계 재시도', '#ff8c00');

    if (key === 'images') {
      source.scrapedImages = await kcFetchArticleImagesForSource(source.url, []);
      source.scrapeVerifiedImages = Array.isArray(source.scrapedImages) && source.scrapedImages.length > 0;
      kcScrapeModalUpdateStage(logModal, 'images', source.scrapeVerifiedImages ? 'success' : 'failed', source.scrapeVerifiedImages ? `이미지 ${source.scrapedImages.length}장 확보` : '이미지를 확보하지 못했습니다.');
    } else {
      const scrape = window._VAGSource?.scrapeArticle;
      if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
      const onlyStage = key === 'cdp' ? 'chrome_bridge' : key;
      const result = await scrape(source.url, {
        title: source.title || '',
        minLength: 50,
        timeoutMs: 45000,
        maxAttempts: 1,
        onlyStage,
        electronOptions: { mode: 'full', show: true, visible: true },
        showProgressModal: false,
      });
      if (Array.isArray(result?.stageTrace)) {
        result.stageTrace.forEach((stage) => {
          const stageKey = stage?.key;
          if (!stageKey || stageKey === 'server') return;
          kcScrapeModalUpdateStage(logModal, stageKey, stage.success ? 'success' : 'failed', stage.message || (stage.success ? '완료' : '실패'));
        });
      }
      if (result?.ok && String(result.text || '').trim().length >= 50) {
        source.scrapedText = result.text || '';
        source.scrapeVerifiedBody = true;
        source.scrapedImages = Array.isArray(result.images) ? result.images.slice() : source.scrapedImages || [];
        source.scrapeVerifiedImages = Array.isArray(source.scrapedImages) && source.scrapedImages.length > 0;
        kcScrapeModalAddLog(logModal, '✓', `${source.scrapedText.length.toLocaleString()}자 본문 확보`, '#34c759');
      } else {
        source.scrapeVerifiedBody = kcSourceBodyReady(source);
        kcScrapeModalUpdateStage(logModal, key, 'failed', result?.error || '본문을 확보하지 못했습니다.');
        kcScrapeModalAddLog(logModal, '!', result?.error || '본문을 확보하지 못했습니다.', '#ff3b30');
      }
    }

    source.scrapeStatus = kcSourceComplete(source) ? 'success' : (kcSourceBodyReady(source) || kcSourceImagesReady(source) ? 'partial' : 'failed');
    kcScrapeModalRenderCollected(logModal, source);
    kcScrapeModalSetSummary(
      logModal,
      kcSourceComplete(source) ? '본문과 이미지를 모두 확보했습니다.' : '선택 단계 실행이 끝났습니다. 부족한 단계는 다시 눌러 재시도할 수 있습니다.',
      kcSourceComplete(source) ? '#34c759' : '#ff9500'
    );
    source.scraping = false;
    kcRenderSourcesList();
  } catch (e) {
    source.scrapeStatus = 'failed';
    kcScrapeModalUpdateStage(logModal, key, 'failed', e.message || '단계 실행 실패');
    kcScrapeModalAddLog(logModal, '!', '단계 실행 실패: ' + (e.message || e), '#ff3b30');
    toast('단계 실행 실패: ' + (e.message || e), 'error');
  } finally {
    source.scraping = false;
    kcRenderSourcesList();
  }
}
window.kcRunScrapeStage = kcRunScrapeStage;

function kcScrapeModalAddLog(modal, icon, text, color) {
  const logLines = modal?.querySelector('#kc-scrape-log-lines');
  if (!logLines) return;
  const line = document.createElement('div');
  line.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.82);border:1px solid rgba(0,0,0,0.05);font-size:12px;line-height:1.55;';
  line.innerHTML = `<span style="font-size:14px;line-height:1;">${icon}</span><span style="color:${color || 'rgba(0,0,0,0.68)'};">${escapeHtml(text)}</span>`;
  logLines.appendChild(line);
  logLines.scrollTop = logLines.scrollHeight;
}

function kcScrapeModalRenderCollected(modal, source) {
  const preview = modal?.querySelector('#kc-scrape-collected-preview');
  if (!preview || !source) return;
  const text = String(source.scrapedText || '').trim();
  const images = Array.isArray(source.scrapedImages) ? source.scrapedImages.filter(Boolean) : [];
  if (!text && images.length === 0) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }
  preview.style.display = 'block';
  const textPreview = text ? truncateKcScrapePreviewText(text, 1800) : '';
  const imageGrid = images.length ? `
    <div style="margin-top:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
        <div style="font-size:12px;font-weight:800;color:#1c1c1e;">수집된 이미지</div>
        <div style="font-size:11px;font-weight:700;color:#007aff;">${images.length}장</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;max-height:192px;overflow:auto;padding-right:2px;">
        ${images.slice(0, 24).map((img, i) => `
          <a href="${escapeHtml(img)}" target="_blank" title="이미지 ${i + 1} 원본 열기" style="display:block;border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.08);background:rgba(0,0,0,0.03);aspect-ratio:1/1;">
            <img src="${escapeHtml(img)}" alt="수집 이미지 ${i + 1}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.closest('a').style.display='none';">
          </a>
        `).join('')}
      </div>
      ${images.length > 24 ? `<div style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.42);">나머지 ${images.length - 24}장은 다음 이미지 선택 단계에서 함께 볼 수 있습니다.</div>` : ''}
    </div>` : '';
  preview.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="font-size:14px;font-weight:900;color:#1c1c1e;">수집 결과 미리보기</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <span style="padding:5px 9px;border-radius:999px;background:rgba(52,199,89,0.09);color:#34c759;font-size:11px;font-weight:800;">본문 ${text.length.toLocaleString()}자</span>
        <span style="padding:5px 9px;border-radius:999px;background:rgba(0,122,255,0.08);color:#007aff;font-size:11px;font-weight:800;">이미지 ${images.length}장</span>
      </div>
    </div>
    ${text ? `
      <div style="margin-top:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:800;color:#1c1c1e;">수집된 본문</div>
          ${text.length > textPreview.length ? `<div style="font-size:11px;color:rgba(0,0,0,0.42);">앞부분 ${textPreview.length.toLocaleString()}자 표시</div>` : ''}
        </div>
        <div style="max-height:190px;overflow:auto;white-space:pre-wrap;font-size:12px;line-height:1.72;color:rgba(0,0,0,0.72);padding:12px;border-radius:14px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.05);">${escapeHtml(textPreview)}</div>
      </div>` : ''}
    ${imageGrid}
  `;
}

function truncateKcScrapePreviewText(text, limit) {
  const raw = String(text || '');
  if (raw.length <= limit) return raw;
  return raw.slice(0, limit).trimEnd() + '\n\n...';
}

function kcScrapeModalShowManual(modal, source, idx) {
  const wrap = modal?.querySelector('#kc-scrape-manual-area');
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <div style="padding:16px;border:1px solid rgba(255,149,0,0.18);background:rgba(255,149,0,0.06);border-radius:16px;">
      <div style="font-size:14px;font-weight:800;color:#ff9500;margin-bottom:8px;">자동 확보 실패 · 직접 본문 붙여넣기</div>
      <div style="font-size:12px;line-height:1.6;color:rgba(0,0,0,0.48);margin-bottom:12px;">보안 설정, 로그인, 동적 렌더링 때문에 자동 수집이 막히면 아래에서 직접 본문을 붙여넣을 수 있습니다. 이미지는 ` + '전체 다시 / 이미지 다시' + ` 버튼으로 추가 재시도할 수 있습니다.</div>
      <a href="${escapeHtml(source.url)}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;background:rgba(0,122,255,0.08);color:#007aff;text-decoration:none;font-size:12px;font-weight:700;margin-bottom:12px;">원본 페이지 열기</a>
      <textarea id="kc-manual-paste-${idx}" rows="6" placeholder="원본 페이지에서 본문을 복사해 여기에 붙여넣어 주세요" style="width:100%;font-size:12px;border:1px solid rgba(0,122,255,0.2);border-radius:12px;padding:10px;"></textarea>
      <button onclick="kcApplyManualPaste(${idx})" style="margin-top:8px;padding:10px 16px;background:#007aff;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">붙여넣기 적용</button>
    </div>`;
}

function kcCreateSourceScrapeModal(source, options) {
  const opts = options || {};
  const src = Object.assign({ title: '', url: '' }, source || {});
  const idx = typeof opts.idx === 'number' ? opts.idx : -1;
  const modal = kcEnsureScrapeLogModal(src, idx);
  const actionWrap = modal?.querySelector('#kc-scrape-summary')?.parentElement?.querySelector('div[style*="justify-content:flex-end"]');
  if (idx < 0 && actionWrap) actionWrap.style.display = 'none';
  kcScrapeModalSetSummary(modal, opts.summary || '본문과 이미지를 함께 확보하는 중입니다.', '#1c1c1e');
  ['electron', 'lightpanda', 'requests', 'cdp', 'images'].forEach((key) => kcScrapeModalUpdateStage(modal, key, 'pending', '아직 실행 전'));
  kcScrapeModalAddLog(modal, '🔗', `${src.title?.substring(0, 60) || src.url}`, 'rgba(0,0,0,0.72)');
  return {
    modal,
    setAttempt(attempt, maxAttempts, label) { kcScrapeModalSetAttempt(modal, attempt, maxAttempts, label); },
    setSummary(text, color) { kcScrapeModalSetSummary(modal, text, color); },
    updateStage(key, state, message) { kcScrapeModalUpdateStage(modal, key, state, message); },
    addLog(icon, text, color) { kcScrapeModalAddLog(modal, icon, text, color); },
    renderCollected(source) { kcScrapeModalRenderCollected(modal, source); },
    showManual() { if (idx >= 0) kcScrapeModalShowManual(modal, src, idx); },
  };
}
window.kcCreateSourceScrapeModal = kcCreateSourceScrapeModal;

async function kcFetchArticleImagesForSource(url, existingImages) {
  const merged = Array.isArray(existingImages) ? existingImages.filter(Boolean) : [];
  const res = await api('/api/content/fetch-images', {
    method: 'POST',
    body: [url],
  });
  const extraImages = kcExtractFetchedImages(res, url);
  return [...new Set([
    ...merged,
    ...extraImages,
  ])].filter(Boolean);
}

function kcExtractFetchedImages(data, targetUrl) {
  const images = [];
  if (Array.isArray(data?.images)) images.push(...data.images);
  if (Array.isArray(data?.image_lists)) {
    const normalizedTarget = String(targetUrl || '').trim();
    data.image_lists.forEach(item => {
      const itemUrl = String(item?.url || '').trim();
      if (!normalizedTarget || !itemUrl || itemUrl === normalizedTarget) {
        if (Array.isArray(item?.images)) images.push(...item.images);
      }
    });
  } else if (Array.isArray(data?.image_lists?.[targetUrl])) {
    images.push(...data.image_lists[targetUrl]);
  }
  return [...new Set(images.filter(Boolean))];
}

async function kcScrapeArticle(idx, options) {
  const source = _kcSelectedSources[idx];
  if (!source.url) { toast('URL이 없습니다', 'error'); return; }
  const opts = options || {};
  if (source.scraping) return;
  if (!opts.force && kcSourceComplete(source)) return;

  source.scraping = true;
  source.checked = true;
  source.scrapeStatus = 'running';
  source.scrapeAttempts = Number(source.scrapeAttempts || 0);
  if (!opts.imagesOnly) {
    source.scrapedText = '';
    source.scrapeVerifiedBody = false;
  }
  source.scrapedImages = [];
  source.scrapeVerifiedImages = false;

  const scrollPos = document.querySelector('.main')?.scrollTop || window.scrollY;
  kcRenderSourcesList();
  requestAnimationFrame(() => {
    if (document.querySelector('.main')) document.querySelector('.main').scrollTop = scrollPos;
    else window.scrollTo(0, scrollPos);
  });

  const logModal = kcEnsureScrapeLogModal(source, idx);
  kcScrapeModalSetSummary(logModal, '본문과 이미지를 함께 확보하는 중입니다.', '#1c1c1e');
  ['electron', 'lightpanda', 'requests', 'cdp', 'images'].forEach((key) => kcScrapeModalUpdateStage(logModal, key, 'pending', '아직 실행 전'));
  kcScrapeModalAddLog(logModal, '🔗', `${source.title?.substring(0, 60) || source.url}`, 'rgba(0,0,0,0.72)');

  let success = false;
  const maxAttempts = 3;
  // YouTube URL이면 무조건 자막 API로 처리 (CDP 스크래핑 방지)
  const _isYT = source.type === 'youtube' || kcIsYoutubeUrl(source.url);
  try {
    for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
      source.scrapeAttempts = attempt;
      kcScrapeModalSetAttempt(logModal, attempt, maxAttempts, opts.imagesOnly ? '이미지 재확보 중' : '본문/이미지 확보 중');
      kcScrapeModalAddLog(logModal, '🔄', `${attempt}차 시도를 시작합니다.`, '#ff8c00');

      if (_isYT) {
        kcScrapeModalUpdateStage(logModal, 'electron', 'running', 'YouTube 메타데이터와 자막을 가져오는 중');
        const ytRes = await api('/api/content/youtube-transcript', {
          method: 'POST',
          body: { url: source.url, video_id: source.videoId || '' },
        });
        source.scrapedText = ytRes.data.text || '';
        source.scrapeVerifiedBody = source.scrapedText.length >= 50;
        source.scrapedImages = ytRes.data.thumbnail ? [ytRes.data.thumbnail] : [];
        source.scrapeVerifiedImages = source.scrapedImages.length > 0;
        source.thumbImage = ytRes.data.thumbnail || source.thumbImage || '';
        source.channel = ytRes.data.channel || source.channel || '';
        source.duration = ytRes.data.duration || source.duration || '';
        if (ytRes.data.summary) source.snippet = ytRes.data.summary.substring(0, 420);
        kcScrapeModalRenderCollected(logModal, source);
        kcScrapeModalUpdateStage(logModal, 'electron', source.scrapeVerifiedBody ? 'success' : 'failed', source.scrapeVerifiedBody ? `${source.scrapedText.length.toLocaleString()}자 자막 확보` : '자막을 충분히 확보하지 못했습니다.');
        kcScrapeModalUpdateStage(logModal, 'images', source.scrapeVerifiedImages ? 'success' : 'failed', source.scrapeVerifiedImages ? `썸네일 ${source.scrapedImages.length}장 확보` : '썸네일을 확보하지 못했습니다.');
        success = source.scrapeVerifiedBody && source.scrapeVerifiedImages;
        if (!success) kcScrapeModalAddLog(logModal, '⚠️', '자막이나 썸네일이 부족해서 다시 시도합니다.', '#ff9500');
        continue;
      }

      let bodyReady = kcSourceBodyReady(source);
      if (!opts.imagesOnly || !bodyReady) {
        const scrape = window._VAGSource?.scrapeArticle;
        if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
        const stageLabels = {
          electron: 'Electron 브라우저',
          resolve: '원문 주소 복원',
          colly: '요청 본문 수집',
          lightpanda: 'Stealth/판다 브라우저',
          requests: '요청 본문 수집',
          cdp: 'CDP 최종 재시도',
        };
        const result = await scrape(source.url, {
          title: source.title || '',
          minLength: 50,
          timeoutMs: 45000,
          maxAttempts: 1,
          electronOptions: { mode: 'full', show: true, visible: true },
          showProgressModal: false,
          onStage(stage) {
            const key = stage && stage.key;
            if (!key || !stageLabels[key]) return;
            kcScrapeModalUpdateStage(logModal, key, 'running', `${stageLabels[key]} 실행 중`);
          },
        });
        if (Array.isArray(result.stageTrace)) {
          result.stageTrace.forEach((stage) => {
            const stageKey = stage?.key;
            if (!stageKey || stageKey === 'server') return;
            kcScrapeModalUpdateStage(logModal, stageKey, stage.success ? 'success' : 'failed', stage.message || (stage.success ? '완료' : '실패'));
          });
        }
        if (result.ok && String(result.text || '').trim().length >= 50) {
          source.scrapedText = result.text || '';
          source.scrapeVerifiedBody = true;
          source.scrapedImages = Array.isArray(result.images) ? result.images.slice() : [];
          source.scrapeVerifiedImages = Array.isArray(source.scrapedImages) && source.scrapedImages.length > 0;
          kcScrapeModalRenderCollected(logModal, source);
          kcScrapeModalAddLog(logModal, '✅', `${source.scrapedText.length.toLocaleString()}자 본문 확보 완료`, '#34c759');
        } else {
          source.scrapeVerifiedBody = false;
          kcScrapeModalAddLog(logModal, '❌', result.error || '본문을 가져오지 못했습니다.', '#ff3b30');
          if (attempt === maxAttempts) {
            kcScrapeModalSetSummary(logModal, '본문을 확보하지 못했습니다. 직접 붙여넣기 또는 다른 소스를 사용해주세요.', '#ff3b30');
          }
          continue;
        }
      }

      bodyReady = kcSourceBodyReady(source);
      kcScrapeModalUpdateStage(logModal, 'images', 'running', '본문에 맞는 이미지를 다시 모으는 중');
      try {
        source.scrapedImages = await kcFetchArticleImagesForSource(source.url, source.scrapedImages || []);
      } catch (imageErr) {
        kcScrapeModalAddLog(logModal, '⚠️', '이미지 수집 재시도 실패: ' + imageErr.message, '#ff9500');
      }
      source.scrapeVerifiedImages = Array.isArray(source.scrapedImages) && source.scrapedImages.length > 0;
      kcScrapeModalRenderCollected(logModal, source);
      if (source.scrapeVerifiedImages) {
        kcScrapeModalUpdateStage(logModal, 'images', 'success', `이미지 ${source.scrapedImages.length}장 확보`);
        kcScrapeModalAddLog(logModal, '🖼️', `이미지 ${source.scrapedImages.length}장을 확보했습니다.`, '#007aff');
      } else {
        kcScrapeModalUpdateStage(logModal, 'images', 'failed', '이미지를 아직 확보하지 못했습니다.');
        kcScrapeModalAddLog(logModal, '⚠️', '본문은 확보했지만 이미지가 부족해서 다시 시도합니다.', '#ff9500');
      }
      success = bodyReady && kcSourceImagesReady(source);
    }
  } catch (finalErr) {
    kcScrapeModalAddLog(logModal, '❌', '에러: ' + finalErr.message, '#ff3b30');
  } finally {
    source.scraping = false;
    source.scrapeStatus = success ? 'success' : (kcSourceBodyReady(source) || kcSourceImagesReady(source) ? 'partial' : 'failed');
    const scrollPos2 = document.querySelector('.main')?.scrollTop || window.scrollY;
    kcRenderSourcesList();
    requestAnimationFrame(() => {
      if (document.querySelector('.main')) document.querySelector('.main').scrollTop = scrollPos2;
      else window.scrollTo(0, scrollPos2);
    });
    if (success) {
      kcScrapeModalSetSummary(logModal, `본문 ${source.scrapedText.length.toLocaleString()}자와 이미지 ${source.scrapedImages.length}장을 모두 확보했습니다.`, '#34c759');
      kcScrapeModalRenderCollected(logModal, source);
      kcScrapeModalAddLog(logModal, '🎉', '본문과 이미지 확보가 모두 끝났습니다.', '#34c759');
    } else if (source.url) {
      kcScrapeModalSetSummary(logModal, '아직 본문과 이미지를 모두 확보하지 못했습니다. 다시 시도하거나 직접 붙여넣기를 사용해 주세요.', '#ff9500');
      kcScrapeModalRenderCollected(logModal, source);
      kcScrapeModalShowManual(logModal, source, idx);
    }
  }
}
