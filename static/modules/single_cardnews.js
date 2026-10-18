let _scnInitialized = false;
let _scnState = {
  uploadedImages: [],
  results: [],
  historyItems: [],
  projectDir: '',
  cardnewsId: 0,
  generating: false,
  historyPage: 0,
  historyTotal: 0,
};
const SCN_HISTORY_PAGE_SIZE = 6;

function scnCurrentRatio() {
  if (window.MKK_CARDNEWS_RATIOS?.currentSingle) return window.MKK_CARDNEWS_RATIOS.currentSingle();
  return document.getElementById('single-cn-ratio')?.value || window._contentOpts?.cn_ratio || '1:1';
}

function scnAspectCss(ratio) {
  if (window.MKK_CARDNEWS_RATIOS?.css) return window.MKK_CARDNEWS_RATIOS.css(ratio || scnCurrentRatio());
  if (ratio === '9:16') return '9 / 16';
  if (ratio === '16:9') return '16 / 9';
  if (ratio === '4:5') return '4 / 5';
  return '1 / 1';
}

function scnInit() {
  if (typeof mkkRenderSingleImageModelBanner === 'function') {
    mkkRenderSingleImageModelBanner('single-cardnews', { note: '카드뉴스 이미지 생성 시작 전 이 모델을 사용합니다.' });
  }
  if (!_scnInitialized) {
    scnSyncDefaultsFromOpts();
    _scnInitialized = true;
  }
  scnRefreshProfileSummary();
  scnRenderUploadedImages();
  scnRenderResults();
  scnLoadHistory();
  scnRestoreDefaults();
}

// ── 기본값 저장/복원 ──
function scnSaveDefaults(silent) {
  const data = {
    sourceUrl: (document.getElementById('single-cn-source-url')?.value || '').trim(),
    topic: (document.getElementById('single-cn-topic')?.value || '').trim(),
    body: (document.getElementById('single-cn-body')?.value || '').trim(),
    prompt: (document.getElementById('single-cn-prompt')?.value || '').trim(),
    ratio: document.getElementById('single-cn-ratio')?.value || '1:1',
    resolution: document.getElementById('single-cn-resolution')?.value || '1K',
    count: document.getElementById('single-cn-count')?.value || '1',
    logoEnabled: !!document.getElementById('single-cn-logo-enabled')?.checked,
    designRef: (document.getElementById('single-cn-design-ref')?.value || '').trim(),
    useProfileDesign: !!document.getElementById('single-cn-use-profile-design')?.checked,
  };
  localStorage.setItem('scn_defaults', JSON.stringify(data));
  if (!silent) toast('단일 카드뉴스 기본값이 저장되었습니다');
}

function scnRestoreDefaults() {
  const saved = localStorage.getItem('scn_defaults');
  if (!saved) return;
  try {
    const d = JSON.parse(saved);
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.checked = !!v; };
    set('single-cn-source-url', d.sourceUrl);
    set('single-cn-topic', d.topic);
    set('single-cn-body', d.body);
    set('single-cn-prompt', d.prompt);
    set('single-cn-ratio', d.ratio);
    set('single-cn-resolution', d.resolution);
    set('single-cn-count', d.count);
    chk('single-cn-logo-enabled', d.logoEnabled);
    set('single-cn-design-ref', d.designRef);
    chk('single-cn-use-profile-design', d.useProfileDesign);
  } catch (e) {}
}

function scnClearDefaults() {
  localStorage.removeItem('scn_defaults');
  toast('저장된 기본값이 초기화되었습니다');
}

async function scnFullReset() {
  if (!await _mkkConfirm('모든 입력, 생성 결과, 업로드 이미지를 초기화할까요?')) return;
  // 입력 필드 초기화
  ['single-cn-source-url', 'single-cn-topic', 'single-cn-body', 'single-cn-prompt', 'single-cn-design-ref'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  // 옵션 기본값
  const el = (id) => document.getElementById(id);
  if (el('single-cn-ratio')) el('single-cn-ratio').value = '1:1';
  if (el('single-cn-resolution')) el('single-cn-resolution').value = '1K';
  if (el('single-cn-count')) el('single-cn-count').value = '5';
  if (el('single-cn-logo-enabled')) el('single-cn-logo-enabled').checked = false;
  if (el('single-cn-use-profile-design')) el('single-cn-use-profile-design').checked = false;
  // 상태 초기화
  _scnState.uploadedImages = [];
  _scnState.results = [];
  _scnState.projectDir = '';
  _scnState.cardnewsId = 0;
  _scnState.generating = false;
  // UI 초기화
  scnRenderUploadedImages();
  scnRenderResults();
  // localStorage 초기화
  localStorage.removeItem('scn_defaults');
  toast('전체 리셋 완료');
}
window.scnFullReset = scnFullReset;

function scnSyncDefaultsFromOpts() {
  const ratioEl = document.getElementById('single-cn-ratio');
  const resolutionEl = document.getElementById('single-cn-resolution');
  const logoEl = document.getElementById('single-cn-logo-enabled');
  if (ratioEl) ratioEl.value = window.MKK_CARDNEWS_RATIOS?.normalize?.(window._contentOpts?.cn_ratio || getOpt('cn_ratio', '1:1')) || window._contentOpts?.cn_ratio || getOpt('cn_ratio', '1:1');
  if (resolutionEl) resolutionEl.value = window._contentOpts?.cn_resolution || getOpt('cn_resolution', '1K');
  if (logoEl) logoEl.checked = !!getOpt('logo_insert', false);
}

function scnRefreshProfileSummary() {
  const profile = window._globalProfileData || null;
  const nameEl = document.getElementById('single-cn-profile-name');
  const metaEl = document.getElementById('single-cn-profile-meta');
  if (!nameEl || !metaEl) return;

  if (!profile) {
    nameEl.textContent = '프로필 미선택';
    metaEl.textContent = '프로필을 선택하면 로고와 디자인 참조 설정이 함께 적용됩니다.';
    return;
  }

  const businessType = profile.business_type ? ` · ${profile.business_type}` : '';
  nameEl.textContent = `${profile.name || '이름 없는 프로필'}${businessType}`;
  metaEl.textContent = '현재 선택된 프로필의 카드뉴스 옵션과 로고 설정을 사용합니다.';
}

async function scnUploadImages() {
  const input = document.getElementById('single-cn-images');
  const statusEl = document.getElementById('single-cn-upload-status');
  if (!input?.files?.length) return;
  if (statusEl) statusEl.style.display = 'block';

  try {
    const formData = new FormData();
    Array.from(input.files).forEach(file => formData.append('files', file));
    const res = await fetch('/api/content/upload-image', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    _scnState.uploadedImages.push(...(data.images || []));
    scnRenderUploadedImages();
    toast(`${(data.images || []).length}장의 참조 이미지를 업로드했습니다.`);
  } catch (e) {
    toast('이미지 업로드 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
    if (input) input.value = '';
  }
}

async function _scnScrapeOneUrl(url) {
  const scrape = window._VAGSource?.scrapeArticle;
  let data = null;
  try {
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const result = await scrape(url, { minLength: 50, timeoutMs: 45000 });
    if (result && result.ok) {
      data = { title: result.title || '', text: result.text, images: result.images || [], method: result.method || 'pipeline' };
    }
  } catch (e) {
    console.warn('[SCN] 공통 scrape 실패:', e.message);
  }
  if (!data || !String(data.text || '').trim()) return null;

  let images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  if (images.length < 8) {
    try {
      const imgRes = await api('/api/content/fetch-images', { method: 'POST', body: [url] });
      const extraImages = _scnExtractFetchedImages(imgRes, url);
      images = Array.from(new Set([
        ...images,
        ...extraImages,
      ]));
    } catch (e) {}
  }
  return { title: String(data.title || '').trim(), text: String(data.text || '').trim(), images };
}

function _scnExtractFetchedImages(data, targetUrl) {
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
  return Array.from(new Set(images.filter(Boolean)));
}

async function scnImportFromUrl() {
  const urlEl = document.getElementById('single-cn-source-url');
  const statusEl = document.getElementById('single-cn-source-status');
  const deepCrawl = !!document.getElementById('single-cn-deep-crawl')?.checked;
  const rawInput = (urlEl?.value || '').trim();

  const urls = rawInput.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
  if (!urls.length) {
    toast('올바른 URL을 입력하세요', 'error');
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = deepCrawl
      ? `딥 크롤링 중... (사이트 내 링크 탐색)`
      : `${urls.length}개 URL에서 내용 가져오는 중...`;
  }

  try {
    const allTitles = [];
    const allTexts = [];
    const allImages = [];
    let successCount = 0;

    if (deepCrawl) {
      // 딥 크롤링: 첫 번째 URL 기준으로 사이트 내 링크 탐색
      for (const url of urls) {
        if (statusEl) statusEl.textContent = `딥 크롤링 중: ${new URL(url).hostname}...`;
        try {
          const res = await api('/api/content/deep-scrape', {
            method: 'POST',
            body: { url, max_pages: 10, max_depth: 2 },
          });
          for (const page of (res.pages || [])) {
            successCount++;
            if (page.title) allTitles.push(page.title);
            if (page.text) allTexts.push(page.text);
          }
          if (statusEl) statusEl.textContent = `딥 크롤링 완료: ${res.page_count || 0}페이지 (${res.total_chars || 0}자)`;
        } catch (e) {
          console.warn('[SCN] 딥 크롤링 실패:', e.message);
        }
      }
    } else {
      // 일반 수집
      for (let i = 0; i < urls.length; i++) {
        if (statusEl) statusEl.textContent = `URL ${i + 1}/${urls.length} 수집 중...`;
        const result = await _scnScrapeOneUrl(urls[i]);
        if (result) {
          successCount++;
          if (result.title) allTitles.push(result.title);
          if (result.text) allTexts.push(result.text);
          allImages.push(...result.images);
        }
      }
    }

    if (!successCount) throw new Error('본문을 가져오지 못했습니다.');

    const topicEl = document.getElementById('single-cn-topic');
    const bodyEl = document.getElementById('single-cn-body');

    if (topicEl) {
      topicEl.value = allTitles[0] || topicEl.value.trim() || urls[0];
    }

    if (bodyEl) {
      const existing = bodyEl.value.trim();
      const newText = allTexts.join('\n\n---\n\n');
      bodyEl.value = existing ? existing + '\n\n---\n\n' + newText : newText;
    }

    const mergedImages = [..._scnState.uploadedImages];
    const seen = new Set(mergedImages.map(img => typeof img === 'string' ? img : (img.url || img.path || '')));
    allImages.slice(0, 12).forEach(imgUrl => {
      if (!seen.has(imgUrl)) {
        mergedImages.push(imgUrl);
        seen.add(imgUrl);
      }
    });
    _scnState.uploadedImages = mergedImages;
    scnRenderUploadedImages();
    toast(`${successCount}개 페이지에서 본문${allImages.length ? '과 이미지 ' + Math.min(allImages.length, 12) + '개를' : '을'} 수집했습니다.`);
  } catch (e) {
    toast('URL 가져오기 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

function scnClearImages() {
  _scnState.uploadedImages = [];
  scnRenderUploadedImages();
}

function scnRenderUploadedImages() {
  const wrap = document.getElementById('single-cn-image-preview');
  if (!wrap) return;
  if (!_scnState.uploadedImages.length) {
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:18px;border:1px dashed rgba(0,0,0,0.08);border-radius:14px;color:rgba(0,0,0,0.35);font-size:12px;text-align:center;">업로드한 이미지가 없습니다. 여러 장을 넣으면 생성 개수만큼 라운드로빈으로 배분합니다.</div>';
    return;
  }
  wrap.innerHTML = _scnState.uploadedImages.map((img, idx) => {
    const url = typeof img === 'string' ? img : (img.url || img.path || '');
    return `<div style="position:relative;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;background:#fff;">
      <img src="${escapeHtml(url)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;">
      <button type="button" onclick="scnRemoveUploadedImage(${idx})" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border:none;border-radius:999px;background:rgba(0,0,0,0.72);color:#fff;font-size:12px;cursor:pointer;">×</button>
    </div>`;
  }).join('');
}

function scnRemoveUploadedImage(idx) {
  _scnState.uploadedImages.splice(idx, 1);
  scnRenderUploadedImages();
}

function scnGetSelectedImageUrls() {
  return _scnState.uploadedImages
    .map(img => typeof img === 'string' ? img : (img.url || img.path || ''))
    .filter(Boolean);
}

function scnBuildHistoryCaption(item) {
  const slides = item?.slides || [];
  const topic = String(item?.topic || slides[0]?.title || '카드뉴스').trim();
  const summary = slides
    .slice(0, 4)
    .map(slide => [slide.title || '', slide.body || ''].join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 220)
    .trim();
  const tags = topic
    .replace(/[^\w가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(tag => '#' + tag);
  return [topic, summary, ['#카드뉴스', ...tags].join(' ')].filter(Boolean).join('\n\n');
}

function scnSplitBodySegments(count) {
  const raw = (document.getElementById('single-cn-body')?.value || '').trim();
  if (!raw) return Array.from({ length: count }, () => '');

  const baseParts = raw
    .split(/\n{2,}|(?<=[.!?。！？])\s+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const parts = baseParts.length ? baseParts : [raw.replace(/\s+/g, ' ').trim()];

  const grouped = Array.from({ length: count }, () => []);
  parts.forEach((part, idx) => {
    grouped[idx % count].push(part);
  });

  return grouped.map((items, idx) => {
    const fallback = parts[idx] || parts[parts.length - 1] || '';
    const text = (items.length ? items.join(' ') : fallback).replace(/\s+/g, ' ').trim();
    return text.length > 500 ? `${text.slice(0, 497).trim()}...` : text;
  });
}

function scnBuildSlideTitle(topic, segment, index) {
  const cleanTopic = String(topic || '').replace(/\s+/g, ' ').trim();
  if (index === 0 && cleanTopic) return cleanTopic.slice(0, 50);

  const candidate = String(segment || '')
    .split(/[.!?。！？\n]/)
    .map(line => line.trim())
    .find(Boolean) || cleanTopic || `카드 ${index + 1}`;
  return candidate.slice(0, 50);
}

function scnBuildSlide(index, count) {
  // 편집된 슬라이드가 있으면 사용
  if (_scnState._useEditedSlides && _scnEditedSlides[index]) {
    const edited = _scnEditedSlides[index];
    const prompt = (document.getElementById('single-cn-prompt')?.value || '').trim();
    const variationLine = count > 1 ? `\n\n이 결과는 전체 ${count}장 중 ${index + 1}번째 시안입니다.` : '';
    return {
      slide_number: index + 1,
      title: edited.title,
      body: edited.body,
      visual_prompt: `${edited.visual_prompt || prompt}${variationLine}`.trim(),
    };
  }
  const topic = (document.getElementById('single-cn-topic')?.value || '').trim();
  const prompt = (document.getElementById('single-cn-prompt')?.value || '').trim();
  const segments = scnSplitBodySegments(count);
  const body = String(segments[index] || segments[0] || '').trim();
  const title = scnBuildSlideTitle(topic, body, index);
  const variationLine = count > 1 ? `\n\n이 결과는 전체 ${count}장 중 ${index + 1}번째 시안입니다. 같은 핵심 메시지 안에서 구도와 연출을 새롭게 구성하세요.` : '';
  return {
    slide_number: index + 1,
    title,
    body,
    visual_prompt: `${prompt}${variationLine}`.trim(),
  };
}

function scnGetPrevImageUrl(index) {
  for (let i = index - 1; i >= 0; i--) {
    const item = _scnState.results[i];
    if (item?.imagePath) return '/api/cardnews/image/' + item.imagePath;
  }
  return '';
}

function scnImageModelLabel(data = {}) {
  const provider = String(data.image_provider || data.provider || '').trim();
  const model = String(data.image_model || data.model || '').trim();
  if (!provider && !model) return '이미지 모델: 설정값 사용';
  return `이미지 모델: ${provider || '설정'} · ${model || '설정'}`;
}

function scnMarkResult(index, patch) {
  const current = _scnState.results[index] || { index, status: 'idle' };
  _scnState.results[index] = { ...current, ...patch };
  scnRenderResults();
}

function scnRenderResults() {
  const wrap = document.getElementById('single-cn-results');
  const metaEl = document.getElementById('single-cn-result-meta');
  if (!wrap || !metaEl) return;

  if (!_scnState.results.length) {
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:28px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">생성 결과가 여기 표시됩니다.</div>';
    metaEl.textContent = '아직 생성된 카드가 없습니다.';
    return;
  }

  const successCount = _scnState.results.filter(item => item?.status === 'done' && item?.imageUrl).length;
  const modelText = _scnState.results.find(item => item?.modelLabel)?.modelLabel || scnImageModelLabel();
  metaEl.textContent = `${successCount}/${_scnState.results.length}장 생성 완료 · ${modelText}${_scnState.projectDir ? ' · 저장 폴더 준비됨' : ''}`;

  const actionBar = `
    <div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.055);border-radius:16px;">
      <div style="font-size:12px;font-weight:800;color:#1c1c1e;">생성 결과 작업</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm" type="button" onclick="scnGenerateBatch()">전체 재생성</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="scnRetryFailed()">실패 재시도</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="scnOpenFolder()">폴더 열기</button>
        <button class="btn btn-secondary btn-sm" type="button" onclick="scnDownloadAll()">전체 다운로드</button>
      </div>
    </div>`;

  wrap.innerHTML = actionBar + _scnState.results.map((item, idx) => {
    const statusText = item.status === 'running'
      ? '생성 중...'
      : item.status === 'done'
        ? '생성 완료'
        : item.status === 'error'
          ? (item.error || '생성 실패')
          : '대기 중';
    const statusColor = item.status === 'error'
      ? '#ff3b30'
      : item.status === 'done'
        ? '#34c759'
        : item.status === 'running'
          ? '#ff8c00'
          : 'rgba(0,0,0,0.35)';
    const aspectRatio = item.aspectRatio || scnAspectCss();
    const imageHtml = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" style="width:100%;aspect-ratio:${escapeHtml(aspectRatio)};object-fit:cover;display:block;background:#f5f5f7;">`
      : `<div style="width:100%;aspect-ratio:${escapeHtml(aspectRatio)};background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,255,255,0.95));display:flex;align-items:center;justify-content:center;color:${statusColor};font-size:13px;font-weight:700;">${item.status === 'running' ? '<span class="spinner"></span>' : idx + 1 + '장'}</div>`;
    return `<div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.05);">
      <div style="padding:10px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="font-size:13px;font-weight:700;color:#1c1c1e;">카드 ${idx + 1}</div>
        <div style="font-size:11px;color:${statusColor};">${escapeHtml(statusText)}</div>
      </div>
      <div>${imageHtml}</div>
      ${item.modelLabel ? `<div style="padding:7px 12px;border-top:1px solid rgba(0,0,0,0.05);font-size:10px;color:rgba(0,0,0,0.42);">${escapeHtml(item.modelLabel)}</div>` : ''}
      <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" type="button" onclick="scnRetryResult(${idx})">다시 생성</button>
        ${item.imageUrl ? `<button class="btn btn-secondary btn-sm" type="button" onclick="kcShowImagePreview('${escapeHtml(item.imageUrl)}')">크게 보기</button>` : ''}
        ${item.imageUrl ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(item.imageUrl.split('?')[0])}" download="single_cardnews_${idx + 1}.png" style="text-decoration:none;">다운로드</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function scnRenderHistory() {
  const wrap = document.getElementById('single-cn-history-list');
  if (!wrap) return;

  if (!_scnState.historyItems.length) {
    wrap.innerHTML = '<div style="padding:24px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">아직 단일 카드뉴스 히스토리가 없습니다.</div>';
    return;
  }

  wrap.innerHTML = _scnState.historyItems.map(item => {
    const thumbUrl = item.thumbnail ? encImg('/api/cardnews/image/' + item.thumbnail) + '?t=' + item.id : '';
    const firstSlide = (item.slides || [])[0] || {};
    const bodyPreview = ((firstSlide.body || '').replace(/\n+/g, ' ').trim() || '').substring(0, 120);
    const promptPreview = ((firstSlide.visual_prompt || '').replace(/\n+/g, ' ').trim() || '').substring(0, 120);
    const createdAt = item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '';
    return `<div style="display:grid;grid-template-columns:110px 1fr;gap:14px;padding:14px;border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;">
      <div style="border-radius:12px;overflow:hidden;background:rgba(255,140,0,0.06);border:1px solid rgba(0,0,0,0.06);min-height:110px;display:flex;align-items:center;justify-content:center;">
        ${thumbUrl
          ? `<img src="${thumbUrl}" style="width:100%;height:110px;object-fit:cover;cursor:pointer;" onclick="kcShowImagePreview('${thumbUrl}')" onerror="if(!this.dataset.retry){this.dataset.retry='1';this.src=this.src.split('?')[0]+'?t='+Date.now();}else{this.style.display='none';this.parentElement.innerHTML='<div style=\\'font-size:11px;color:rgba(0,0,0,0.25);font-weight:600;\\'>로드 실패</div>';}">`
          : `<div style="font-size:12px;color:rgba(0,0,0,0.32);font-weight:700;">이미지 없음</div>`
        }
      </div>
      <div style="min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#1c1c1e;line-height:1.35;">${escapeHtml(item.topic || '제목 없음')}</div>
            <div style="font-size:11px;color:rgba(0,0,0,0.38);margin-top:4px;">${item.success_count || 0}/${item.slide_count || 0}장 · ${escapeHtml(item.aspect_ratio || '1:1')} · ${createdAt}</div>
          </div>
          <div style="font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff8c00;font-weight:700;">AI 자동</div>
        </div>
        <div style="font-size:12px;color:rgba(0,0,0,0.7);line-height:1.6;margin-bottom:6px;"><strong style="color:#1c1c1e;">입력 요약</strong> ${escapeHtml(firstSlide.title || '')}${bodyPreview ? ' · ' + escapeHtml(bodyPreview) : ''}</div>
        <div style="font-size:11px;color:rgba(0,0,0,0.4);line-height:1.55;margin-bottom:10px;">프롬프트: ${escapeHtml(promptPreview || '-')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" type="button" onclick="scnLoadHistoryItem(${item.id})">불러오기</button>
          ${(item.success_count || 0) >= 2 ? `<button class="btn btn-secondary btn-sm" type="button" onclick="scnMakeVideo(${item.id})" id="scn-video-btn-${item.id}">슬라이드 영상</button>` : ''}
          ${thumbUrl ? `<button class="btn btn-secondary btn-sm" type="button" onclick="kcShowImagePreview('${thumbUrl}')">크게 보기</button>` : ''}
          <button class="btn btn-secondary btn-sm" type="button" onclick="scnOpenHistoryFolder(${item.id})">폴더 열기</button>
          <button class="btn btn-danger btn-sm" type="button" onclick="scnDeleteHistoryItem(${item.id})">삭제</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function scnLoadHistory(page) {
  if (page !== undefined) _scnState.historyPage = page;
  const offset = _scnState.historyPage * SCN_HISTORY_PAGE_SIZE;
  const wrap = document.getElementById('single-cn-history-list');
  if (wrap) {
    wrap.innerHTML = '<div style="padding:22px;text-align:center;color:rgba(0,0,0,0.38);font-size:13px;"><span class="spinner"></span> 히스토리 불러오는 중...</div>';
  }
  try {
    const res = await api(`/api/cardnews/history?limit=${SCN_HISTORY_PAGE_SIZE}&offset=${offset}&sort=newest&source=single`);
    _scnState.historyItems = res.items || [];
    _scnState.historyTotal = res.total || _scnState.historyItems.length;
    scnRenderHistory();
    scnRenderHistoryPaging();
  } catch (e) {
    if (wrap) {
      wrap.innerHTML = `<div style="padding:22px;border:1px dashed rgba(255,59,48,0.2);border-radius:16px;color:#ff3b30;font-size:13px;">히스토리 로드 실패: ${escapeHtml(e.message)}</div>`;
    }
  }
}

function scnRenderHistoryPaging() {
  const wrap = document.getElementById('single-cn-history-paging');
  if (!wrap) return;
  const totalPages = Math.ceil(_scnState.historyTotal / SCN_HISTORY_PAGE_SIZE);
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }
  const current = _scnState.historyPage;
  let html = '';
  if (current > 0) {
    html += `<button class="btn btn-secondary btn-sm" onclick="scnLoadHistory(${current - 1})">← 이전</button>`;
  }
  html += `<span style="font-size:12px;color:rgba(0,0,0,0.5);padding:6px 10px;">${current + 1} / ${totalPages}</span>`;
  if (current < totalPages - 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="scnLoadHistory(${current + 1})">다음 →</button>`;
  }
  wrap.innerHTML = html;
}

async function scnLoadHistoryItem(id) {
  try {
    const res = await api(`/api/cardnews/history/${id}`);
    const item = res.item || {};
    const slides = item.slides || [];
    document.getElementById('single-cn-topic').value = item.topic || '';
    document.getElementById('single-cn-body').value = slides
      .map(slide => [slide.title || '', slide.body || ''].filter(Boolean).join('\n'))
      .filter(Boolean)
      .join('\n\n');
    document.getElementById('single-cn-prompt').value = slides.map(slide => slide.visual_prompt || '').filter(Boolean)[0] || '';
    const ratioEl = document.getElementById('single-cn-ratio');
    if (ratioEl && item.aspect_ratio) ratioEl.value = item.aspect_ratio;
    _scnState.projectDir = item.project_dir || '';
    _scnState.cardnewsId = item.id || 0;
    _scnState.results = slides.map((slide, idx) => ({
      index: idx,
      status: slide.image_url ? 'done' : 'idle',
      imageUrl: slide.image_url ? encImg('/api/cardnews/image/' + slide.image_url) + '?t=' + Date.now() : '',
      imagePath: slide.image_url || '',
      aspectRatio: scnAspectCss(item.aspect_ratio),
    }));
    scnRenderResults();
    toast('히스토리 카드뉴스를 불러왔습니다.');
  } catch (e) {
    toast('히스토리 불러오기 실패: ' + e.message, 'error');
  }
}

async function scnOpenHistoryFolder(id) {
  try {
    const res = await api(`/api/cardnews/history/${id}`);
    const item = res.item || {};
    await api('/api/open-folder', { method: 'POST', body: { folder: item.project_dir || 'output/cardnews' } });
    toast('폴더 열림');
  } catch (e) {
    toast('폴더 열기 실패: ' + e.message, 'error');
  }
}

async function scnDeleteHistoryItem(id) {
  if (!await _mkkConfirm('이 카드뉴스를 삭제하시겠습니까? 관련 이미지 파일도 함께 삭제됩니다.')) return;
  try {
    await api(`/api/cardnews/history/${id}`, { method: 'DELETE' });
    _scnState.historyItems = _scnState.historyItems.filter(item => item.id !== id);
    scnRenderHistory();
    toast('히스토리 카드뉴스를 삭제했습니다.');
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

async function scnUploadHistoryInstagram(id) {
  try {
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    const res = await api(`/api/cardnews/history/${id}`);
    const item = res.item || {};
    if (!item.project_dir) throw new Error('프로젝트 폴더를 찾을 수 없습니다.');
    const caption = scnBuildHistoryCaption(item);
    if (!caption) throw new Error('업로드용 캡션을 만들 수 없습니다.');
    await api('/api/instagram/upload', {
      method: 'POST',
      body: {
        project_dir: item.project_dir,
        caption,
        profile_id: profileId,
      },
    });
    toast('인스타그램 피드 등록 완료!');
  } catch (e) {
    toast('인스타그램 피드 등록 실패: ' + e.message, 'error');
  }
}

async function scnGenerateAt(index, count) {
  const topic = (document.getElementById('single-cn-topic')?.value || '').trim();
  const style = 'ai-auto';
  const ratio = scnCurrentRatio();
  const resolution = document.getElementById('single-cn-resolution')?.value || window._contentOpts?.cn_resolution || '1K';
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  const profile = window._globalProfileData || {};
  const brandName = profile.name || '';
  const brandColor = profile.brand_color || '';
  const logoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
  const selectedImages = scnGetSelectedImageUrls();
  const designRef = (document.getElementById('single-cn-design-ref')?.value || '').trim();
  const useProfileDesignRef = !!document.getElementById('single-cn-use-profile-design')?.checked;
  const logoEnabled = !!document.getElementById('single-cn-logo-enabled')?.checked;
  const slide = scnBuildSlide(index, count);
  const userImg = selectedImages.length ? selectedImages[index % selectedImages.length] : '';

  scnMarkResult(index, { status: 'running', error: '', aspectRatio: scnAspectCss(ratio) });

  const res = await api('/api/cardnews/generate-single', {
    method: 'POST',
    body: {
      slide,
      topic,
      style,
      aspect_ratio: ratio,
      project_dir: _scnState.projectDir || '',
      cardnews_id: _scnState.cardnewsId || null,
      brand_name: brandName,
      brand_color: brandColor,
      brand_logo_url: logoUrl,
      logo_enabled: logoEnabled,
      logo_text: logoEnabled ? brandName : '',
      logo_position: logoEnabled ? getOpt('logo_position', 'bottom-right') : '',
      logo_size: logoEnabled ? getOpt('logo_size', 'medium') : '',
      logo_opacity: logoEnabled ? getOpt('logo_opacity', '70') : '',
      image_provider: '',
      image_model: '',
      user_image_url: userImg || designRef || '',
      user_image_urls: selectedImages,
      design_ref_url: designRef,
      use_profile_design_ref: !userImg && !designRef && useProfileDesignRef,
      prev_image_url: scnGetPrevImageUrl(index),
      image_size: resolution,
      profile_id: profileId,
      custom_instructions: (document.getElementById('single-cn-prompt')?.value || '').trim(),
    },
  });

  if (!_scnState.projectDir && res.project_dir) _scnState.projectDir = res.project_dir;
  if (!_scnState.cardnewsId && res.cardnews_id) _scnState.cardnewsId = res.cardnews_id;
  const fullUrl = encImg('/api/cardnews/image/' + res.image_url) + '?t=' + Date.now();
  scnMarkResult(index, {
    status: 'done',
    imageUrl: fullUrl,
    imagePath: res.image_url,
    aspectRatio: scnAspectCss(ratio),
    modelLabel: scnImageModelLabel(res),
  });
}

function scnResetRunState(count) {
  _scnState.projectDir = '';
  _scnState.cardnewsId = 0;
  const aspectRatio = scnAspectCss(scnCurrentRatio());
  _scnState.results = Array.from({ length: count }, (_, idx) => ({ index: idx, status: 'idle', aspectRatio }));
  scnRenderResults();
}

// ── 텍스트 생성 + 편집 (반자동) ──────────────────────────────

let _scnEditedSlides = [];

async function scnGenerateTexts() {
  const topic = (document.getElementById('single-cn-topic')?.value || '').trim();
  const body = (document.getElementById('single-cn-body')?.value || '').trim();
  const count = Math.max(1, Math.min(20, parseInt(document.getElementById('single-cn-count')?.value || '5', 10)));

  if (!topic) { toast('주제를 입력하세요', 'error'); return; }
  if (!body) { toast('본문 내용을 입력하세요', 'error'); return; }

  const btn = document.getElementById('single-cn-textgen-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 텍스트 생성 중...'; }

  try {
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    const profile = window._globalProfileData || {};
    const brandName = profile.name || profile.brand_name || '';
    const brandDesc = [
      profile.service_description || profile.description || '',
      profile.biz_detail || '',
      profile.business_type ? '업종: ' + profile.business_type : '',
      profile.keywords ? '키워드: ' + profile.keywords : '',
    ].filter(Boolean).join('\n\n');
    const brandLogoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
    // AI 텍스트 생성 API 호출
    const res = await api('/api/cardnews/generate-texts', {
      method: 'POST',
      body: {
        keyword: topic,
        topic,
        body,
        scraped_texts: [body],
        count,
        cardnews_slides: count,
        cardnews_style: 'ai-auto',
        brand_name: brandName,
        brand_description: brandDesc,
        brand_color: profile.brand_color || '',
        brand_logo_url: brandLogoUrl,
        contact_info: profile.contact_info || '',
        business_goal: profile.business_goal || '',
        profile_id: profileId,
        text_provider: '',
        image_provider: '',
        image_model: '',
      },
    });

    const segments = scnSplitBodySegments(count);
    const responseSlides = Array.isArray(res.slides) ? res.slides : (Array.isArray(res.texts) ? res.texts : []);
    _scnEditedSlides = responseSlides.map((s, idx) => scnNormalizeSlideText(s, idx, topic, body, segments));

    // 만약 API가 없으면 로컬에서 분할
    if (!_scnEditedSlides.length) {
      _scnEditedSlides = scnBuildLocalTextSlides(topic, body, count);
    }

    scnRenderSlideEditors();
    document.getElementById('single-cn-text-editor').style.display = 'block';
    document.getElementById('single-cn-text-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`${_scnEditedSlides.length}장 슬라이드 텍스트가 생성되었습니다. 편집 후 이미지를 생성하세요.`);
  } catch (e) {
    // API가 없으면 로컬 분할로 폴백
    _scnEditedSlides = scnBuildLocalTextSlides(topic, body, count);
    scnRenderSlideEditors();
    document.getElementById('single-cn-text-editor').style.display = 'block';
    toast('텍스트를 분할했습니다. 편집 후 이미지를 생성하세요.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> 1. 텍스트 생성'; }
  }
}

function scnNormalizeSlideText(slide, idx, topic, fullBody, segments) {
  const item = slide && typeof slide === 'object' ? slide : {};
  const fallbackBody = String(segments[idx] || fullBody || topic || '').trim();
  const title = String(item.title || item.headline || item.heading || item.hook || item.message || '').trim()
    || scnBuildSlideTitle(topic, fallbackBody, idx)
    || `슬라이드 ${idx + 1}`;
  const body = String(item.body || item.content || item.copy || item.description || item.text || '').trim()
    || fallbackBody
    || title;
  return {
    slide_number: idx + 1,
    title,
    body,
    visual_prompt: String(item.visual_prompt || item.image_prompt || item.visual || '').trim(),
  };
}

function scnBuildLocalTextSlides(topic, body, count) {
  const segments = scnSplitBodySegments(count);
  return segments.map((seg, idx) => scnNormalizeSlideText({}, idx, topic, body, segments));
}

function scnRenderSlideEditors() {
  const wrap = document.getElementById('single-cn-slide-editors');
  if (!wrap) return;
  wrap.innerHTML = _scnEditedSlides.map((slide, idx) => `
    <div style="border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px;background:#fff;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;">${idx + 1}</span>
        <input type="text" id="scn-slide-title-${idx}" value="${escapeHtml(slide.title)}" placeholder="슬라이드 제목" style="flex:1;padding:8px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:14px;font-weight:700;">
        <button type="button" onclick="scnRemoveSlide(${idx})" style="background:none;border:none;color:rgba(0,0,0,0.25);cursor:pointer;font-size:16px;" title="삭제">×</button>
      </div>
      <textarea id="scn-slide-body-${idx}" rows="3" placeholder="슬라이드 본문" style="width:100%;padding:8px 12px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;line-height:1.6;resize:vertical;">${escapeHtml(slide.body)}</textarea>
      <input type="text" id="scn-slide-visual-${idx}" value="${escapeHtml(slide.visual_prompt || '')}" placeholder="비주얼 프롬프트 (선택사항)" style="margin-top:6px;width:100%;padding:6px 12px;border:1px solid rgba(0,0,0,0.06);border-radius:8px;font-size:12px;color:rgba(0,0,0,0.5);">
    </div>
  `).join('');
  _scnEditedSlides.forEach((slide, idx) => {
    const titleEl = document.getElementById(`scn-slide-title-${idx}`);
    const bodyEl = document.getElementById(`scn-slide-body-${idx}`);
    const visualEl = document.getElementById(`scn-slide-visual-${idx}`);
    if (titleEl) titleEl.value = slide.title || `슬라이드 ${idx + 1}`;
    if (bodyEl) bodyEl.value = slide.body || slide.title || '';
    if (visualEl) visualEl.value = slide.visual_prompt || '';
  });
}

function scnRemoveSlide(idx) {
  _scnEditedSlides.splice(idx, 1);
  _scnEditedSlides.forEach((s, i) => s.slide_number = i + 1);
  scnRenderSlideEditors();
}

function scnCollectEditedSlides() {
  return _scnEditedSlides.map((slide, idx) => ({
    slide_number: idx + 1,
    title: document.getElementById(`scn-slide-title-${idx}`)?.value?.trim() || slide.title,
    body: document.getElementById(`scn-slide-body-${idx}`)?.value?.trim() || slide.body,
    visual_prompt: document.getElementById(`scn-slide-visual-${idx}`)?.value?.trim() || slide.visual_prompt || '',
  }));
}

async function scnRegenerateTexts() {
  await scnGenerateTexts();
}

async function scnGenerateBatchFromEditor() {
  // 편집된 슬라이드 수집
  _scnEditedSlides = scnCollectEditedSlides();
  if (!_scnEditedSlides.length) { toast('슬라이드가 없습니다', 'error'); return; }
  // count를 편집된 슬라이드 수로 맞추고 생성
  document.getElementById('single-cn-count').value = _scnEditedSlides.length;
  _scnState._useEditedSlides = true;
  await scnGenerateBatch();
  _scnState._useEditedSlides = false;
}

async function scnAutoCreateAndEdit() {
  const topic = (document.getElementById('single-cn-topic')?.value || '').trim();
  const body = (document.getElementById('single-cn-body')?.value || '').trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }

  if (typeof _logActivity === 'function') _logActivity('single-cardnews', 'auto-create-edit');

  // 반자동 에디터에 입력 내용 전달
  window._mcnAutoFillData = {
    topic,
    body,
    profileId: parseInt(window._globalProfileId || 0),
    images: scnGetSelectedImageUrls(),
  };

  // 반자동 에디터 페이지로 이동
  navigateToPage('manual-cardnews', { skipConfirm: true });

  // 에디터 렌더링 대기 후 AI 자동 채우기 실행
  setTimeout(() => {
    // 주제 입력
    const topicInput = document.querySelector('[data-mcn-field="topic"]') || document.getElementById('mcn-topic');
    if (topicInput) topicInput.value = topic;

    // AI 자동 채우기 실행
    if (typeof window.mcnAiAutoFill === 'function') {
      toast('AI가 카드뉴스를 자동 생성합니다. 완료 후 편집하세요.');
      window.mcnAiAutoFill();
    } else {
      toast('반자동 에디터에서 "AI 자동 채우기" 버튼을 눌러주세요.', 'info');
    }
  }, 1000);
}

window.scnAutoCreateAndEdit = scnAutoCreateAndEdit;
window.scnGenerateTexts = scnGenerateTexts;
window.scnRegenerateTexts = scnRegenerateTexts;
window.scnGenerateBatchFromEditor = scnGenerateBatchFromEditor;
window.scnRemoveSlide = scnRemoveSlide;

// ── 이미지 생성 ──────────────────────────────────────────────

async function scnGenerateBatch() {
  if (typeof _logActivity === 'function') _logActivity('single-cardnews', 'generate');
  if (_scnState.generating) {
    toast('이미 생성 중입니다', 'error');
    return;
  }

  const topic = (document.getElementById('single-cn-topic')?.value || '').trim();
  const body = (document.getElementById('single-cn-body')?.value || '').trim();
  const count = Math.max(1, Math.min(20, parseInt(document.getElementById('single-cn-count')?.value || '1', 10) || 1));
  const statusEl = document.getElementById('single-cn-generate-status');
  const btn = document.getElementById('single-cn-generate-btn');

  // 생성 시 자동 저장 (다음에 다시 사용 가능)
  scnSaveDefaults(true);

  if (!(document.getElementById('single-cn-topic')?.value || '').trim()) {
    toast('주제 / 제목을 입력하세요', 'error');
    return;
  }
  if (!(document.getElementById('single-cn-body')?.value || '').trim()) {
    toast('카드 안에 넣을 글을 입력하세요', 'error');
    return;
  }

  scnResetRunState(count);
  _scnState.generating = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 생성 중...';
  }

  let successCount = 0;
  try {
    for (let i = 0; i < count; i++) {
      if (statusEl) statusEl.textContent = `${i + 1}/${count}번째 카드뉴스를 생성하는 중입니다.`;
      try {
        await scnGenerateAt(i, count);
        successCount += 1;
      } catch (e) {
        scnMarkResult(i, { status: 'error', error: e.message || '생성 실패' });
      }
    }
    if (statusEl) statusEl.textContent = `카드뉴스 생성 완료: ${successCount}/${count}장`;
    if (successCount > 0) scnLoadHistory();
    toast(`카드뉴스 생성 완료: ${successCount}/${count}장`);
  } finally {
    _scnState.generating = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> 카드뉴스 만들기';
    }
  }
}

async function scnRetryResult(index) {
  if (_scnState.generating) {
    toast('전체 생성이 끝난 뒤 다시 시도하세요', 'error');
    return;
  }
  const count = _scnState.results.length || 1;
  try {
    await scnGenerateAt(index, count);
    scnLoadHistory();
    toast(`${index + 1}번째 카드뉴스를 다시 생성했습니다.`);
  } catch (e) {
    scnMarkResult(index, { status: 'error', error: e.message || '생성 실패' });
    toast(`재생성 실패: ${e.message}`, 'error');
  }
}

async function scnRetryFailed() {
  if (_scnState.generating) {
    toast('전체 생성이 끝난 뒤 다시 시도하세요', 'error');
    return;
  }
  const targets = _scnState.results
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item?.imageUrl || item?.status === 'error');
  if (!targets.length) {
    toast('재시도할 실패 카드가 없습니다');
    return;
  }
  let ok = 0;
  for (const target of targets) {
    try {
      await scnGenerateAt(target.index, _scnState.results.length || targets.length);
      ok += 1;
    } catch (e) {
      scnMarkResult(target.index, { status: 'error', error: e.message || '생성 실패' });
    }
  }
  if (ok > 0) scnLoadHistory();
  toast(`실패 카드 재시도 완료: ${ok}/${targets.length}장`);
}

async function scnMakeVideo(cardnewsId) {
  const btn = document.getElementById(`scn-video-btn-${cardnewsId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 영상 생성 중...';
  }
  try {
    const histRes = await api(`/api/cardnews/history/${cardnewsId}`);
    const item = histRes.item || {};
    if (!item.project_dir) throw new Error('프로젝트 폴더를 찾을 수 없습니다.');

    const voice = window._contentOpts?.voice || getOpt('voice', 'gemini-Kore');
    const res = await api('/api/video/create', {
      method: 'POST',
      body: {
        source: 'cardnews',
        method: 'slide',
        project_dir: item.project_dir,
        voice,
        speed: 1.0,
        camera_freedom: window._contentOpts?.camera || getOpt('camera', 'subtle'),
      },
    });
    toast('슬라이드 영상 생성 완료!');
    if (res.video_url) {
      window.open(res.video_url, '_blank');
    } else if (res.video_path) {
      await api('/api/open-folder', { method: 'POST', body: { folder: res.video_path } });
    }
  } catch (e) {
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '슬라이드 영상';
    }
  }
}

async function scnMakeVideoFromCurrent() {
  if (!_scnState.projectDir) {
    toast('먼저 카드뉴스를 생성하세요', 'error');
    return;
  }
  const successCount = _scnState.results.filter(r => r?.status === 'done').length;
  if (successCount < 2) {
    toast('슬라이드 영상은 2장 이상의 카드뉴스가 필요합니다', 'error');
    return;
  }

  const btn = document.getElementById('scn-video-current-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 영상 생성 중...';
  }
  try {
    const voice = window._contentOpts?.voice || getOpt('voice', 'gemini-Kore');
    const res = await api('/api/video/create', {
      method: 'POST',
      body: {
        source: 'cardnews',
        method: 'slide',
        project_dir: _scnState.projectDir,
        voice,
        speed: 1.0,
        camera_freedom: window._contentOpts?.camera || getOpt('camera', 'subtle'),
      },
    });
    toast('슬라이드 영상 생성 완료!');
    if (res.video_url) {
      window.open(res.video_url, '_blank');
    } else if (res.video_path) {
      await api('/api/open-folder', { method: 'POST', body: { folder: res.video_path } });
    }
  } catch (e) {
    toast('영상 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 슬라이드 영상 만들기';
    }
  }
}

function scnOpenFolder() {
  const firstDone = _scnState.results.find(item => item?.imagePath || item?.imageUrl);
  const dir = _scnState.projectDir || firstDone?.imagePath || 'output/cardnews';
  api('/api/ce2/open-folder', { method: 'POST', body: { folder: dir } })
    .then(() => toast('폴더를 열었습니다.'))
    .catch(e => toast('폴더 열기 실패: ' + e.message, 'error'));
}

async function scnDownloadAll() {
  const images = _scnState.results.filter(item => item?.imageUrl);
  if (!images.length) {
    toast('다운로드할 카드뉴스가 없습니다', 'error');
    return;
  }
  for (let i = 0; i < images.length; i++) {
    const a = document.createElement('a');
    a.href = images[i].imageUrl.split('?')[0];
    a.download = `single_cardnews_${i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (i < images.length - 1) await new Promise(resolve => setTimeout(resolve, 200));
  }
  toast(`${images.length}장 다운로드 시작`);
}

window.scnOpenFolder = scnOpenFolder;
window.scnDownloadAll = scnDownloadAll;
window.scnRetryResult = scnRetryResult;
window.scnRetryFailed = scnRetryFailed;
window.scnMakeVideoFromCurrent = scnMakeVideoFromCurrent;
