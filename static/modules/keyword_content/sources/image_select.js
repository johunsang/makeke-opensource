// keyword_content/sources/image_select.js — 이미지 업로드/선택/호버/요약 갱신 (4단계)

async function kcUploadImages() {
  const input = document.getElementById('kc-images');
  if (!input.files || input.files.length === 0) return;

  const uploading = document.getElementById('kc-image-uploading');
  uploading.style.display = 'block';

  try {
    const formData = new FormData();
    for (const file of input.files) {
      formData.append('files', file);
    }

    const res = await fetch('/api/content/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    _kcUploadedImages.push(...(data.images || []));

    // 썸네일 표시 (kcRefreshImagePreview 호출로 통합)
    kcRefreshImagePreview();

    toast(`${data.images.length}장의 이미지가 업로드되었습니다.`);
  } catch (e) {
    toast('이미지 업로드 실패: ' + e.message, 'error');
  } finally {
    uploading.style.display = 'none';
    input.value = '';
  }
}

function kcRefreshImagePreview() {
  const preview = document.getElementById('kc-image-preview');
  preview.innerHTML = _kcUploadedImages.map((img, i) => {
    const imgUrl = typeof img === 'string' ? img : img.url;
    return `
    <div style="position:relative;display:inline-block;">
      <img src="${imgUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #1e3a52;">
      <button onclick="_kcUploadedImages.splice(${i},1);kcRefreshImagePreview();" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#e05c5c;color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;">x</button>
      <button onclick="openImageEditor('${imgUrl}',{context:'general',onSave:function(data){_kcUploadedImages[${i}]={filename:data.filename,path:data.path||'',url:data.url};kcRefreshImagePreview();}})" style="position:absolute;bottom:2px;right:2px;padding:2px 6px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:3px;font-size:9px;cursor:pointer;">편집</button>
    </div>`;
  }).join('');
}

function kcUpdateSummary() {
  const keyword = document.getElementById('kc-keyword').value.trim();
  const selectedCount = _kcSelectedSources.filter(s => s.checked).length;
  const scrapedCount = _kcSelectedSources.filter(s => s.checked && typeof kcSourceBodyReady === 'function' && kcSourceBodyReady(s)).length;
  const brandName = document.getElementById('kc-brand-name').value.trim();

  document.getElementById('kc-summary-keyword').textContent = keyword || '-';
  document.getElementById('kc-summary-sources').textContent = selectedCount + '건';
  document.getElementById('kc-summary-scraped').textContent = scrapedCount + '건 (본문 확보)';
  document.getElementById('kc-summary-brand').textContent = brandName || '(미입력)';
  const scrapedImageCount = _kcSelectedSources
    .filter(s => s.checked && typeof kcSourceImagesReady === 'function' && kcSourceImagesReady(s))
    .reduce((sum, s) => sum + s.scrapedImages.length, 0);
  const totalImages = _kcUploadedImages.length + scrapedImageCount;
  document.getElementById('kc-summary-images').textContent = _kcFinalImages.filter(x => x.selected).length + '장';

  // 버튼 텍스트
  syncUIToOpts('kc');
  _updateGenerateBtnLabel();
}

// ── 이미지 선택/제외 (4단계) ──

function kcBuildImageList() {
  _kcFinalImages = [];
  // 1. 프로필 라이브러리 이미지
  _kcUploadedImages.forEach(img => {
    const url = typeof img === 'string' ? img : (img.url || img.path);
    if (url) _kcFinalImages.push({ url, source: 'library', selected: false });
  });
  // 2. 소스에서 선택된 이미지
  _kcSelectedSources.filter(s => s.checked).forEach(s => {
    if (s.scrapedImages) {
      const selSet = s._selectedImages || new Set();
      s.scrapedImages.forEach((imgUrl, idx) => {
        if (selSet.size === 0 || selSet.has(idx)) {
          if (!_kcFinalImages.some(x => x.url === imgUrl)) {
            _kcFinalImages.push({ url: imgUrl, source: 'scrape', selected: false });
          }
        }
      });
    }
  });
}

function kcCollectExplicitSourceSelectedImages(selectedSources = _kcSelectedSources || []) {
  const urls = [];
  selectedSources.filter(s => s.checked && s.scrapedImages).forEach(s => {
    if (s._selectedImages && s._selectedImages.size > 0) {
      s._selectedImages.forEach(imgIdx => {
        const imgUrl = s.scrapedImages[imgIdx];
        if (imgUrl) urls.push(imgUrl);
      });
    }
  });
  return [...new Set(urls)].filter(Boolean);
}

function kcRenderImageSelectGrid() {
  const card = document.getElementById('kc-image-select-card');
  const grid = document.getElementById('kc-image-select-grid');
  // 항상 표시 (이미지 없어도 업로드 가능)
  card.style.display = 'block';
  if (_kcFinalImages.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(0,0,0,0.3);font-size:12px;">수집된 이미지가 없습니다. "이미지 추가" 버튼으로 직접 업로드하세요</div>';
    kcUpdateImageSelectCount();
    return;
  }
  grid.innerHTML = _kcFinalImages.map((img, i) => `
    <div onclick="kcToggleImageSelect(${i})" onmouseenter="kcImgHover(this,true,'${img.url.replace(/'/g,"\\'")}')" onmouseleave="kcImgHover(this,false)" style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid ${img.selected ? '#007aff' : 'rgba(0,0,0,0.08)'};transition:all 0.2s;">
      <img src="${img.url}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;${img.selected ? '' : 'opacity:0.35;filter:grayscale(100%);'}" onerror="this.parentElement.style.display='none'">
      <div style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:${img.selected ? '#007aff' : 'rgba(0,0,0,0.15)'};display:flex;align-items:center;justify-content:center;">
        ${img.selected ? '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:2px 4px;background:rgba(0,0,0,0.5);font-size:9px;color:#fff;text-align:center;">${img.source === 'library' ? '라이브러리' : img.source === 'upload' ? '업로드' : '수집'}</div>
    </div>
  `).join('');
  kcUpdateImageSelectCount();
}

function kcImgHover(el, show, url) {
  if (!show) {
    if (_imgHoverEl) { _imgHoverEl.remove(); _imgHoverEl = null; }
    return;
  }
  if (_imgHoverEl) _imgHoverEl.remove();
  const rect = el.getBoundingClientRect();
  _imgHoverEl = document.createElement('div');
  _imgHoverEl.style.cssText = `position:fixed;z-index:9999;pointer-events:none;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.3);border:2px solid rgba(0,0,0,0.1);transition:opacity 0.15s;`;
  // 위치: 요소 오른쪽 또는 왼쪽
  const size = 240;
  let left = rect.right + 10;
  if (left + size > window.innerWidth) left = rect.left - size - 10;
  let top = rect.top;
  if (top + size > window.innerHeight) top = window.innerHeight - size - 10;
  _imgHoverEl.style.left = left + 'px';
  _imgHoverEl.style.top = top + 'px';
  _imgHoverEl.style.width = size + 'px';
  _imgHoverEl.style.height = size + 'px';
  _imgHoverEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
  document.body.appendChild(_imgHoverEl);
}

function kcToggleImageSelect(idx) {
  _kcFinalImages[idx].selected = !_kcFinalImages[idx].selected;
  kcRenderImageSelectGrid();
}

function kcSelectAllImages(select) {
  _kcFinalImages.forEach(img => img.selected = select);
  kcRenderImageSelectGrid();
}

function kcUpdateImageSelectCount() {
  const count = _kcFinalImages.filter(x => x.selected).length;
  const el = document.getElementById('kc-image-select-count');
  if (el) el.innerHTML = count > 0
    ? `<span style="color:#007aff;font-weight:700;">${count}장 선택됨</span> (전체 ${_kcFinalImages.length}장) · 선택된 이미지가 콘텐츠에 포함됩니다`
    : `0장 선택됨 (전체 ${_kcFinalImages.length}장) · <span style="color:#ff8c00;">이미지를 클릭하면 콘텐츠에 포함됩니다</span>`;
  document.getElementById('kc-summary-images').textContent = `${count}장 선택됨 / 전체 ${_kcFinalImages.length}장`;
}

async function kcUploadRefImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of input.files) {
      const form = new FormData();
      form.append('file', file);
      try {
        const res = await fetch('/api/content/upload-image', { method: 'POST', body: form });
        const data = await res.json();
        if (data.url) {
          _kcFinalImages.push({ url: data.url, source: 'upload', selected: true });
        }
      } catch(e) { toast('업로드 실패: ' + e.message, 'error'); }
    }
    kcRenderImageSelectGrid();
    kcUpdateImageSelectCount();
    toast('이미지 추가 완료!');
  };
  input.click();
}
