/* ============================================================
 *  이커머스 공통 유틸
 *  EC_STATE, 옵션 그리드, 파일 업로드, 이미지 렌더링,
 *  라이트박스, 히스토리, 페이지 초기화
 * ============================================================ */

// ── 공통 상태 ──────────────────────────────────────────────

const EC_STATE = {};

// ── 옵션 그리드/셀렉트 ──────────────────────────────────────

function ecOptionGrid(containerId, options, stateKey, defaultIdx = 0) {
  const el = document.getElementById(containerId);
  if (!el) return;
  EC_STATE[stateKey] = options[defaultIdx]?.value ?? '';
  el.innerHTML = options.map((o, i) => `
    <button type="button" class="${i === defaultIdx ? 'selected' : ''}" data-val="${o.value}" onclick="ecSelectOption('${containerId}','${stateKey}',this)">
      ${o.icon ? `<span class="ec-opt-icon">${o.icon}</span>` : ''}
      <span>${o.label}</span>
    </button>
  `).join('');
}

function ecSelectOption(containerId, stateKey, btn) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  EC_STATE[stateKey] = btn.dataset.val;
}

function ecSelectPopulate(selectId, options, stateKey) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  EC_STATE[stateKey] = options[0]?.value ?? '';
  el.onchange = () => { EC_STATE[stateKey] = el.value; };
}

// ── 공통 비율 옵션 ──────────────────────────────────────────

const EC_RATIO_STANDARD = [
  { label: '1:1', value: '1:1' }, { label: '4:3', value: '4:3' }, { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' },
];
const EC_RATIO_SQUARE = [
  { label: '1:1', value: '1:1' }, { label: '3:4', value: '3:4' }, { label: '4:3', value: '4:3' },
];

// ── 파일 업로드 ──────────────────────────────────────────────

async function ecFileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function ecUploadPreview(inputEl, areaId) {
  const file = inputEl.files[0];
  if (!file) return;
  const area = document.getElementById(areaId);
  const reader = new FileReader();
  reader.onload = e => {
    area.innerHTML = `<img src="${e.target.result}" alt="preview">`;
    area.dataset.base64 = e.target.result;
  };
  reader.readAsDataURL(file);
}

function ecMultiUploadPreview(inputEl, containerId, maxCount = 10) {
  const container = document.getElementById(containerId);
  const files = Array.from(inputEl.files);
  const existing = container.querySelectorAll('.ec-upload-thumb').length;
  if (existing + files.length > maxCount) {
    toast(`최대 ${maxCount}장까지 업로드 가능합니다`, 'error');
    return;
  }
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const thumb = document.createElement('div');
      thumb.className = 'ec-upload-thumb';
      thumb.dataset.base64 = e.target.result;
      thumb.innerHTML = `<img src="${e.target.result}"><button class="ec-remove" onclick="this.parentElement.remove()">×</button>`;
      container.insertBefore(thumb, container.querySelector('.ec-upload-area'));
    };
    reader.readAsDataURL(file);
  });
  inputEl.value = '';
}

function ecGetMultiImages(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  return Array.from(el.querySelectorAll('.ec-upload-thumb'))
    .map(t => t.dataset.base64);
}

// ── 로딩 ──────────────────────────────────────────────────

function ecShowLoading(containerId, msg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="ec-loading-overlay">
      <div class="ec-spinner"></div>
      <p>${msg || 'AI가 생성 중입니다...'}</p>
    </div>`;
}

// ── 라이트박스 (크게보기) ──────────────────────────────────

function ecShowLightbox(src) {
  let overlay = document.getElementById('ec-lightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ec-lightbox';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:40px;';
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<img src="${src}" style="max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <button style="position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;" onclick="this.parentElement.remove()">×</button>`;
}

// ── 이미지 렌더링 ──────────────────────────────────────────

function ecRenderImages(containerId, images) {
  const valid = (images || []).filter(i => i && (i.url || typeof i === 'string'));
  if (!valid.length) {
    document.getElementById(containerId).innerHTML = `<div class="card" style="text-align:center;padding:40px;color:rgba(0,0,0,0.4);">이미지 생성 결과가 없습니다. 다시 시도해주세요.</div>`;
    toast('이미지 생성에 실패했습니다. API 키와 설정을 확인하세요.', 'error');
    return;
  }
  document.getElementById(containerId).innerHTML = valid.map((img, i) => {
    const src = img.url || img;
    return `<div class="ec-result-card">
      <img src="${src}" alt="생성 결과 ${i + 1}" style="cursor:pointer;" onclick="ecShowLightbox('${src.replace(/'/g, "\\'")}')">
      <div class="ec-result-actions">
        <button onclick="ecShowLightbox('${src.replace(/'/g, "\\'")}')">크게보기</button>
        <button onclick="ecDownloadImage('${src.replace(/'/g, "\\'")}', 'result_${i + 1}.png')">다운로드</button>
      </div>
    </div>`;
  }).join('');
  // 히스토리 저장 + 화면 갱신
  ecSaveHistory(containerId, valid);
  ecRefreshCurrentHistory();
}

function ecDownloadImage(url, filename) {
  // data URL에서 실제 MIME 타입을 읽어 올바른 확장자로 저장
  let ext = 'png';
  if (url.startsWith('data:image/jpeg')) ext = 'jpg';
  else if (url.startsWith('data:image/webp')) ext = 'webp';
  const finalName = filename.replace(/\.\w+$/, '') + '.' + ext;
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── 히스토리 ──────────────────────────────────────────────

const EC_PAGE_LABELS = {
  'ec-branding': '브랜딩',
  'ec-marketing-skill': '스킬',
  'ec-seo-audit': 'SEO진단',
  'ec-backlink-checker': '백링크',
  'ec-broken-link-checker': '브로큰링크',
  'ec-banner': '배너', 'ec-detailpage': '상세페이지', 'ec-rebuild': '진단',
  'ec-advideo': '광고영상', 'ec-thumbnail': '썸네일', 'ec-logo': '로고',
  'ec-smartstore': '온라인샵', 'ec-offlineshop': '오프라인샵', 'ec-model': '모델', 'ec-outfit': '의상합성',
  'ec-influencer': '인플루언서', 'ec-art': '아트', 'ec-cartoon': '만화',
  'ec-interior': '인테리어', 'ec-pet': '펫', 'ec-pet-outfit': '펫의상',
};

const EC_HISTORY_PAGE_SIZE = 4;
const EC_HISTORY_VIEW_STATE = {};

function ecSaveHistory(containerId, images, pageOverride = '') {
  try {
    const rawPage = pageOverride || containerId.replace('-results', '').replace('ec-', '');
    const page = String(rawPage || '').replace(/^ec-/, '');
    const allHistory = ecLoadAllHistory();
    const srcs = images.map(i => i.url || i);
    allHistory.unshift({
      id: `ec_hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      page,
      images: srcs,
      timestamp: Date.now(),
    });
    if (allHistory.length > 100) allHistory.length = 100;
    localStorage.setItem('ec_history_all', JSON.stringify(allHistory));
  } catch(e) { /* localStorage 실패 무시 */ }
}

function ecLoadAllHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem('ec_history_all') || '[]');
    let changed = false;
    const normalized = (Array.isArray(raw) ? raw : []).map((item, idx) => {
      const id = item?.id || `ec_hist_${item?.timestamp || Date.now()}_${idx}`;
      const page = String(item?.page || '').replace(/^ec-/, '');
      const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
      if (!item?.id || item?.page !== page) changed = true;
      return { ...item, id, page, images };
    });
    if (changed) localStorage.setItem('ec_history_all', JSON.stringify(normalized));
    return normalized;
  }
  catch(e) { return []; }
}

function ecHistoryStateKey(containerId) {
  return `ec_history_page_${containerId}`;
}

function ecDeleteHistoryEntry(historyId, containerId, currentPage) {
  try {
    const next = ecLoadAllHistory().filter((item) => item.id !== historyId);
    localStorage.setItem('ec_history_all', JSON.stringify(next));
    const pageKey = String(currentPage || '').replace(/^ec-/, '');
    const totalPages = Math.max(1, Math.ceil(next.filter((item) => item.page === pageKey).length / EC_HISTORY_PAGE_SIZE));
    const stateKey = ecHistoryStateKey(containerId);
    EC_HISTORY_VIEW_STATE[stateKey] = Math.min(EC_HISTORY_VIEW_STATE[stateKey] || 0, totalPages - 1);
    ecShowHistory(containerId, currentPage);
    toast('히스토리 항목을 삭제했습니다');
  } catch (e) {
    toast('히스토리 삭제 실패', 'error');
  }
}

function ecHistoryPageChange(containerId, currentPage, nextPage) {
  const pageKey = String(currentPage || '').replace(/^ec-/, '');
  const totalPages = Math.max(1, Math.ceil(ecLoadAllHistory().filter((item) => item.page === pageKey).length / EC_HISTORY_PAGE_SIZE));
  EC_HISTORY_VIEW_STATE[ecHistoryStateKey(containerId)] = Math.max(0, Math.min(nextPage, totalPages - 1));
  ecShowHistory(containerId, currentPage);
}

function ecShowHistory(containerId, currentPage) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pageKey = String(currentPage || '').replace(/^ec-/, '');
  const filtered = ecLoadAllHistory().filter((item) => item.page === pageKey);
  if (!filtered.length) {
    el.innerHTML = '<div style="text-align:center;color:rgba(0,0,0,0.35);font-size:13px;padding:24px 0;line-height:1.7;">아직 이 화면에서 생성한 결과가 없습니다.<br>브랜딩 에셋을 만들면 여기에 쌓입니다.</div>';
    return;
  }
  const stateKey = ecHistoryStateKey(containerId);
  const totalPages = Math.max(1, Math.ceil(filtered.length / EC_HISTORY_PAGE_SIZE));
  const currentIndex = Math.max(0, Math.min(EC_HISTORY_VIEW_STATE[stateKey] || 0, totalPages - 1));
  EC_HISTORY_VIEW_STATE[stateKey] = currentIndex;
  const start = currentIndex * EC_HISTORY_PAGE_SIZE;
  const slice = filtered.slice(start, start + EC_HISTORY_PAGE_SIZE);

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${slice.map((item) => `
        <div style="padding:12px;border-radius:16px;background:rgba(255,255,255,0.74);border:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.42);">
              ${new Date(item.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${item.images.length}개 에셋
            </div>
            <button class="btn btn-secondary btn-sm" type="button" onclick="ecDeleteHistoryEntry('${item.id}','${containerId}','${currentPage}')">삭제</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
            ${item.images.slice(0, 3).map((img, idx) => `
              <div class="ec-history-thumb" style="position:relative;border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);background:#fff;">
                <img src="${img}" style="width:100%;aspect-ratio:1/1;object-fit:cover;cursor:pointer;display:block;" onclick="ecShowLightbox(this.src)">
                <div style="position:absolute;left:6px;right:6px;bottom:6px;display:flex;justify-content:space-between;gap:6px;">
                  <button type="button" onclick="ecShowLightbox(this.closest('.ec-history-thumb').querySelector('img').src)" style="flex:1;padding:4px 0;border:none;border-radius:8px;background:rgba(255,255,255,0.92);font-size:11px;font-weight:700;cursor:pointer;">보기</button>
                  <button type="button" onclick="ecDownloadImage(this.closest('.ec-history-thumb').querySelector('img').src, 'history_${idx + 1}.png')" style="flex:1;padding:4px 0;border:none;border-radius:8px;background:rgba(28,28,30,0.78);color:#fff;font-size:11px;font-weight:700;cursor:pointer;">저장</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:2px;">
        <div style="font-size:12px;color:rgba(0,0,0,0.38);">페이지 ${currentIndex + 1} / ${totalPages}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" type="button" ${currentIndex <= 0 ? 'disabled' : ''} onclick="ecHistoryPageChange('${containerId}','${currentPage}',${currentIndex - 1})">이전</button>
          <button class="btn btn-secondary btn-sm" type="button" ${currentIndex >= totalPages - 1 ? 'disabled' : ''} onclick="ecHistoryPageChange('${containerId}','${currentPage}',${currentIndex + 1})">다음</button>
        </div>
      </div>
    </div>
  `;
}

/** 히스토리 이미지를 현재 페이지의 참고이미지 영역에 삽입 */
function ecUseAsReference(src) {
  // 현재 활성 페이지 찾기
  const activePage = document.querySelector('.page[style*="display: block"], .page[style*="display:block"], .page.active');
  if (!activePage) { toast('활성 페이지를 찾을 수 없습니다', 'error'); return; }

  // 1) 단일 업로드 영역 찾기 (.ec-upload-area)
  const singleArea = activePage.querySelector('.ec-upload-area:not(.ec-multi-upload .ec-upload-area)');
  if (singleArea) {
    singleArea.innerHTML = `<img src="${src}" alt="참고이미지">`;
    singleArea.dataset.base64 = src;
    toast('참고이미지가 삽입되었습니다');
    return;
  }

  // 2) 다중 업로드 영역 찾기 (.ec-multi-upload)
  const multiArea = activePage.querySelector('.ec-multi-upload');
  if (multiArea) {
    const thumb = document.createElement('div');
    thumb.className = 'ec-upload-thumb';
    thumb.dataset.base64 = src;
    thumb.innerHTML = `<img src="${src}"><button class="ec-remove" onclick="this.parentElement.remove()">×</button>`;
    const uploadBtn = multiArea.querySelector('.ec-upload-area');
    if (uploadBtn) multiArea.insertBefore(thumb, uploadBtn);
    else multiArea.appendChild(thumb);
    toast('참고이미지가 추가되었습니다');
    return;
  }

  toast('이 페이지에는 이미지 삽입 영역이 없습니다', 'error');
}

// ── 페이지 초기화 매핑 ──────────────────────────────────────

const EC_PAGE_INITS = {
  'ec-history': () => ecHistoryPageInit(),
  'ec-branding': () => ecBrandingInit(),
  'ec-marketing-skill': () => ecMarketingSkillInit(),
  'ec-seo-audit': () => ecSeoAuditInit(),
  'ec-backlink-checker': () => ecBacklinkInit(),
  'ec-broken-link-checker': () => ecBrokenLinkInit(),
  'ec-banner': () => ecBannerInit(),
  'ec-detailpage': () => ecDpInit(),
  'ec-rebuild': () => {},
  'ec-advideo': () => ecAdvInit(),
  'ec-thumbnail': () => ecThumbInit(),
  'ec-logo': () => ecLogoInit(),
  'ec-smartstore': () => ecSsInit(),
  'ec-offlineshop': () => ecOsInit(),
  'ec-model': () => ecModelInit(),
  'ec-outfit': () => ecOutfitInit(),
  'ec-influencer': () => ecInfInit(),
  'ec-art': () => ecArtInit(),
  'ec-cartoon': () => ecCartoonInit(),
  'ec-interior': () => ecIntInit(),
  'ec-pet': () => ecPetInit(),
  'ec-pet-outfit': () => ecPetOutInit(),
};

// ── 히스토리 전용 페이지 ──────────────────────────────────

let _ecHistoryFilterPage = 'all';

function ecHistoryPageInit() {
  _ecHistoryFilterPage = 'all';
  // 필터 버튼 생성
  const filterEl = document.getElementById('ec-history-filter');
  if (filterEl) {
    const pages = Object.keys(EC_PAGE_LABELS);
    filterEl.innerHTML = `<button class="btn btn-secondary btn-sm ec-hf-active" onclick="ecHistoryFilter('all',this)">전체</button>` +
      pages.map(p => `<button class="btn btn-secondary btn-sm" onclick="ecHistoryFilter('${p.replace('ec-','')}',this)">${EC_PAGE_LABELS[p]}</button>`).join('');
  }
  ecHistoryRenderFull();
}

function ecHistoryFilter(page, btn) {
  _ecHistoryFilterPage = page;
  document.querySelectorAll('#ec-history-filter button').forEach(b => b.classList.remove('ec-hf-active'));
  if (btn) btn.classList.add('ec-hf-active');
  ecHistoryRenderFull();
}

function ecHistoryRenderFull() {
  const el = document.getElementById('ec-history-full');
  if (!el) return;
  const allHistory = ecLoadAllHistory();
  if (!allHistory.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:60px;color:rgba(0,0,0,0.3);">아직 생성된 이미지가 없습니다.<br>이커머스 서비스에서 이미지를 생성해보세요.</div>';
    return;
  }
  // 필터 적용
  const filtered = _ecHistoryFilterPage === 'all' ? allHistory : allHistory.filter(h => h.page === _ecHistoryFilterPage);
  // 모든 이미지를 개별 카드로 표시
  const allImages = [];
  filtered.forEach(item => {
    const label = EC_PAGE_LABELS['ec-' + item.page] || item.page;
    const time = new Date(item.timestamp).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    (item.images || []).forEach(img => allImages.push({ img, label, time }));
  });
  if (!allImages.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">해당 카테고리에 생성된 이미지가 없습니다.</div>';
    return;
  }
  el.innerHTML = allImages.map((item, i) => `
    <div class="ec-result-card">
      <div style="position:relative;">
        <img src="${item.img}" alt="히스토리 ${i+1}" style="cursor:pointer;" onclick="ecShowLightbox(this.src)">
        <span style="position:absolute;top:8px;left:8px;font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(0,0,0,0.6);color:#fff;font-weight:600;">${item.label}</span>
      </div>
      <div class="ec-result-actions">
        <span style="font-size:10px;color:rgba(0,0,0,0.3);margin-right:auto;padding-left:4px;">${item.time}</span>
        <button onclick="ecUseAsReference(this.closest('.ec-result-card').querySelector('img').src)">참고이미지</button>
        <button onclick="ecDownloadImage(this.closest('.ec-result-card').querySelector('img').src, 'history_${i+1}.png')">다운로드</button>
      </div>
    </div>
  `).join('');
}

function ecHistoryClear() {
  if (!confirm('모든 이커머스 히스토리를 삭제하시겠습니까?')) return;
  localStorage.removeItem('ec_history_all');
  ecHistoryRenderFull();
  toast('히스토리가 삭제되었습니다');
}

function ecPageInit(page) {
  const initFn = EC_PAGE_INITS[page];
  if (initFn) initFn();
  const historyEl = document.getElementById(page + '-history');
  if (historyEl) {
    historyEl.innerHTML = '<div style="padding:18px 0;font-size:13px;color:rgba(0,0,0,0.32);text-align:center;">최근 결과를 불러오는 중입니다...</div>';
    requestAnimationFrame(() => requestAnimationFrame(() => ecShowHistory(page + '-history', page)));
  }
}

/** 현재 보이는 페이지의 히스토리 새로고침 */
function ecRefreshCurrentHistory() {
  const activePage = document.querySelector('.page[style*="display: block"], .page[style*="display:block"], .page.active');
  if (!activePage) return;
  const pageId = activePage.id.replace('page-', '');
  const historyEl = document.getElementById(pageId + '-history');
  if (historyEl) requestAnimationFrame(() => ecShowHistory(pageId + '-history', pageId));
}
