/**
 * blog_agent.js
 * 블로그 에이전트 — 카드뉴스 에이전트와 동일한 UI 패턴
 * 소재 입력 → AI 어시스턴트 → 블로그 생성 → 히스토리
 */
(function () {
  'use strict';

  let _bagInitialized = false;
  let _bagSourceContent = '';
  let _bagSourceMode = 'text';
  let _bagResult = null; // { title, body, char_count, model, images }
  let _bagChatMessages = [];
  let _bagSelectedImages = [];

  // 프로필 데이터
  let _bagBrandName = '';
  let _bagBrandDesc = '';
  let _bagProfileId = 0;
  const BAG_TOPIC_SUGGESTION_COUNT = 24;

  function _bagBuildBrandContext(profile = {}) {
    const parts = [];
    const serviceDesc = String(profile.service_description || '').trim();
    const bizDetail = String(profile.biz_detail || '').trim();
    const website = String(profile.website || '').trim();
    if (serviceDesc) parts.push(serviceDesc);
    if (bizDetail) parts.push(`세부 비즈니스 설명: ${bizDetail}`);
    if (website) parts.push(`웹사이트: ${website}`);
    return parts.join('\n');
  }

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function _modelText(data, requestedImageCount) {
    const meta = data?.meta || {};
    const blog = data?.blog || {};
    const blogImages = data?.blog_images || {};
    const textModel = String(meta.text_model || blog.model || '').trim();
    const textProvider = String(meta.text_provider || '').trim();
    const imageModel = String(blogImages.image_model || meta.image_model || '').trim();
    const imageProvider = String(blogImages.image_provider || meta.image_provider || '').trim();
    const hasImages = !blogImages.error && Number(blogImages.count || 0) > 0;
    const parts = [];
    if (textModel) parts.push(`글 모델: ${textProvider ? textProvider + ' · ' : ''}${textModel}`);
    if (requestedImageCount > 0 && hasImages && imageModel) parts.push(`이미지 모델: ${imageProvider ? imageProvider + ' · ' : ''}${imageModel}`);
    return parts.join(' / ');
  }

  function _imageStatusText(data, requestedImageCount) {
    if (!requestedImageCount) return '';
    const blogImages = data?.blog_images || {};
    if (blogImages.error) return `이미지 생성 실패: ${blogImages.error}`;
    const count = Number(blogImages.count || 0);
    if (count > 0) return `이미지 ${count}장 생성 완료`;
    return '이미지 생성 결과가 비어 있습니다. 다시 시도해주세요.';
  }

  function _bagProfileImageOptions() {
    const profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) return [];
    let images = [];
    try { images = JSON.parse(window._globalProfileData?.images_json || '[]'); } catch {}
    return (Array.isArray(images) ? images : [])
      .map(filename => ({
        filename,
        url: encImg('/api/library/image/' + profileId + '/' + filename),
      }))
      .filter(item => item.filename && item.url);
  }

  async function _bagUploadReferenceImages() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        if (!files.length) return resolve([]);
        const uploaded = [];
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          try {
            const res = await fetch('/api/content/upload-image', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.url) uploaded.push(data.url);
            (data.images || []).forEach(img => {
              const url = typeof img === 'string' ? img : img.url;
              if (url) uploaded.push(url);
            });
          } catch (e) {
            console.warn('[BAG] image upload failed:', e);
          }
        }
        resolve([...new Set(uploaded)].filter(Boolean));
      };
      input.click();
    });
  }

  async function _bagAskImageReferences() {
    _bagSelectedImages = [];
    _addMsg('ai', '블로그 이미지에 참고 이미지를 넣을까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.35);">선택한 이미지만 반영하고, 선택하지 않으면 아무 이미지도 넣지 않습니다.</span>');
    const method = await new Promise(resolve => {
      _addOptions(['프로필 이미지 선택', '이미지 업로드', '선택 안 함'], resolve);
    });
    if (method === '선택 안 함') {
      _addMsg('ai', '참고 이미지 없이 생성합니다.');
      return [];
    }
    if (method === '이미지 업로드') {
      const uploaded = await _bagUploadReferenceImages();
      _bagSelectedImages = uploaded;
      _addMsg('ai', uploaded.length ? `업로드 이미지 ${uploaded.length}장을 참고 이미지로 넣습니다.` : '업로드된 이미지가 없어 참고 이미지 없이 진행합니다.');
      return uploaded;
    }

    const images = _bagProfileImageOptions();
    if (!images.length) {
      _addMsg('ai', '프로필에 선택할 이미지가 없습니다. 참고 이미지 없이 진행합니다.');
      return [];
    }
    return new Promise(resolve => {
      const body = document.getElementById('bag-chat-body');
      const wrap = document.createElement('div');
      wrap.className = 'bag-chat-options';
      wrap.style.cssText = 'padding:8px 0;display:flex;flex-direction:column;gap:10px;';
      wrap.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;max-width:520px;">
          ${images.map((img, idx) => `
            <label style="position:relative;border:2px solid rgba(0,0,0,0.08);border-radius:10px;overflow:hidden;cursor:pointer;background:#fff;">
              <input type="checkbox" data-bag-img="${idx}" style="position:absolute;top:6px;right:6px;width:18px;height:18px;accent-color:#ff8c00;z-index:2;">
              <img src="${img.url}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;" loading="lazy" onerror="this.closest('label').style.display='none'">
            </label>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <button id="bag-img-select-go" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">선택 완료</button>
          <button id="bag-img-select-none" style="padding:8px 14px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:12px;font-weight:700;cursor:pointer;">넣지 않음</button>
        </div>`;
      body.appendChild(wrap);
      document.getElementById('bag-img-select-go').onclick = () => {
        const selected = Array.from(wrap.querySelectorAll('input[data-bag-img]:checked'))
          .map(cb => images[parseInt(cb.dataset.bagImg, 10)]?.url)
          .filter(Boolean);
        _bagSelectedImages = [...new Set(selected)];
        wrap.remove();
        _addMsg('user', _bagSelectedImages.length ? `이미지 ${_bagSelectedImages.length}장 선택` : '이미지 선택 안 함');
        resolve(_bagSelectedImages);
      };
      document.getElementById('bag-img-select-none').onclick = () => {
        _bagSelectedImages = [];
        wrap.remove();
        _addMsg('user', '이미지 선택 안 함');
        resolve([]);
      };
    });
  }

  function _inputStyle() {
    return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;transition:border-color 0.2s;';
  }

  /* ── 초기화 ── */
  function bagInit() {
    const root = document.getElementById('blog-agent-root');
    if (!root) return;
    if (typeof mkkRenderSingleImageModelBanner === 'function') {
      mkkRenderSingleImageModelBanner('blog-agent', { note: '블로그 글과 블로그 이미지 생성 전 현재 설정 모델을 사용합니다.' });
    }

    _bagProfileId = parseInt(window._globalProfileId || 0);
    const pd = window._globalProfileData || {};
    _bagBrandName = pd.name || pd.brand_name || '';
    _bagBrandDesc = _bagBuildBrandContext(pd);

    _renderLayout(root);
    _bagInitialized = true;
  }

  /* ── 레이아웃 (완전 채팅형) ── */
  function _renderLayout(root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow-y:auto;overflow-x:hidden;">
        <!-- 숨겨진 값 저장용 -->
        <input type="hidden" id="bag-topic" value="">
        <input type="hidden" id="bag-length" value="medium">
        <input type="hidden" id="bag-tone" value="mystyle">
        <input type="hidden" id="bag-image-count" value="1">
        <input type="hidden" id="bag-image-style" value="">

        <!-- AI 어시스턴트 / 결과 -->
        <div id="bag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex:1;min-height:400px;overflow:visible;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">AI 어시스턴트</span>
            <button type="button" onclick="bagRestart()" title="처음부터 다시 시작" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
          </div>
          <div id="bag-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 0;gap:12px;">
              <div style="font-size:32px;">&#x2728;</div>
              <div style="font-size:14px;color:rgba(0,0,0,0.3);text-align:center;">AI가 단계별로 안내하며<br>블로그 글을 완성합니다</div>
              <button onclick="bagGenerate()" id="bag-gen-btn" style="padding:14px 40px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(255,140,0,0.3);display:flex;align-items:center;gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
                AI로 시작하기
              </button>
            </div>
          </div>
          <!-- 결과 영역 -->
          <div id="bag-result" style="display:none;padding:16px;border-top:1px solid rgba(0,0,0,0.06);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <div id="bag-result-title" style="font-size:16px;font-weight:700;color:#1c1c1e;"></div>
              <div style="display:flex;gap:6px;">
                <button onclick="bagCopyResult()" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:11px;cursor:pointer;">복사</button>
              </div>
            </div>
            <div id="bag-result-meta" style="font-size:11px;color:rgba(0,0,0,0.3);margin-bottom:10px;"></div>
            <div id="bag-result-body" style="font-size:13px;line-height:1.8;color:#1c1c1e;max-height:400px;overflow-y:auto;white-space:pre-wrap;"></div>
            <!-- 태그 -->
            <div style="margin-top:12px;">
              <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;">태그</div>
              <input type="text" id="bag-result-tags" placeholder="태그1, 태그2, ..." style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">
            </div>
            <!-- 이미지 -->
            <div id="bag-result-images" style="display:none;margin-top:12px;">
              <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">블로그 이미지</div>
              <div id="bag-result-images-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── 소재 탭 전환 ── */
  function bagToggleSource(mode) {
    _bagSourceMode = mode;
    ['text','news','naver','youtube','url','file','knowledge'].forEach(m => {
      const panel = document.getElementById('bag-src-' + m);
      const btn = document.getElementById('bag-src-btn-' + m);
      if (panel) panel.style.display = m === mode ? '' : 'none';
      if (btn) {
        btn.style.background = m === mode ? 'rgba(255,140,0,0.08)' : 'rgba(0,0,0,0.02)';
        btn.style.borderColor = m === mode ? 'rgba(255,140,0,0.2)' : 'rgba(0,0,0,0.08)';
        btn.style.color = m === mode ? '#ff8c00' : 'rgba(0,0,0,0.4)';
      }
    });
    if (mode === 'news' && typeof ce2OpenNewsSearchModal === 'function') ce2OpenNewsSearchModal();
    if (mode === 'naver') bagOpenNaverSearch();
    if (mode === 'knowledge' && typeof ce2OpenKnowledgeModal === 'function') ce2OpenKnowledgeModal();
  }

  /* ── 소재 수집 ── */
  function _collectSource() {
    if (_bagSourceMode === 'text') {
      _bagSourceContent = (document.getElementById('bag-source-text')?.value || '').trim();
    }
    // 뉴스/네이버 검색 결과 (공용 모달에서 저장)
    if (!_bagSourceContent && window._sharedSourceContent) _bagSourceContent = window._sharedSourceContent;
    return _bagSourceContent;
  }

  /* ── 네이버 검색 (ce2와 동일 API 재사용) ── */
  function bagOpenNaverSearch(query) {
    // ce2의 네이버 검색 모달 재사용
    if (typeof ce2OpenNaverSearchModal === 'function') {
      ce2OpenNaverSearchModal({ query: query || '', autoSearch: !!query });
      return;
    }
    // 폴백: 직접 모달
    _bagOpenNaverModal(query || '');
  }

  let _bagNaverItems = [];
  function _bagOpenNaverModal(query) {
    const existing = document.getElementById('bag-naver-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'bag-naver-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:680px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden;" onclick="event.stopPropagation()">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:700;">네이버 자료 조사</span>
          <button onclick="document.getElementById('bag-naver-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,0.06);cursor:pointer;font-size:14px;">&times;</button>
        </div>
        <div style="padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;gap:8px;">
            <input type="text" id="bag-naver-q" placeholder="검색어..." style="flex:1;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);outline:none;" onkeydown="if(event.key==='Enter'){event.preventDefault();bagNaverSearch();}">
            <button onclick="bagNaverSearch()" id="bag-naver-btn" style="padding:10px 20px;border-radius:10px;border:none;background:#03c75a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">검색</button>
          </div>
        </div>
        <div id="bag-naver-results" style="flex:1;overflow-y:auto;padding:16px 20px;min-height:200px;"><div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">검색어를 입력하세요</div></div>
        <div style="padding:12px 20px;border-top:1px solid rgba(0,0,0,0.06);text-align:right;">
          <button onclick="bagNaverApply()" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">선택 완료</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const qInput = document.getElementById('bag-naver-q');
    if (qInput && query) { qInput.value = query; bagNaverSearch(); }
    else if (qInput) qInput.focus();
  }

  async function bagNaverSearch() {
    const q = (document.getElementById('bag-naver-q')?.value || '').trim();
    if (!q) return;
    const btn = document.getElementById('bag-naver-btn');
    const results = document.getElementById('bag-naver-results');
    if (btn) { btn.textContent = '검색 중...'; btn.disabled = true; }
    try {
      const resp = await fetch('/api/ce2/naver-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const data = await resp.json();
      if (!resp.ok || data.ok === false) throw new Error(data.error || '네이버 검색에 실패했습니다');
      _bagNaverItems = (data.ok && data.items) ? data.items : [];
      if (_bagNaverItems.length) {
        results.innerHTML = _bagNaverItems.map((item, idx) => `
          <label style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.04);background:rgba(0,0,0,0.01);cursor:pointer;margin-bottom:6px;">
            <input type="checkbox" data-nidx="${idx}" style="margin-top:3px;accent-color:#03c75a;">
            <div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">${item.title || ''}</div>${item.description ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);margin-top:2px;">${_esc(item.description)}</div>` : ''}${(item.url || item.link) ? `<div style="font-size:10px;color:#007aff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;">${_esc(item.url || item.link)}</div>` : ''}</div>
          </label>`).join('');
      } else {
        results.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">결과 없음</div>';
      }
    } catch (e) { if (results) results.innerHTML = `<div style="color:#ff3b30;padding:20px;">${e.message}</div>`; }
    if (btn) { btn.textContent = '검색'; btn.disabled = false; }
  }

  async function bagNaverApply() {
    const results = document.getElementById('bag-naver-results');
    if (!results) return;
    const selectedItems = [];
    results.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.nidx);
      const item = _bagNaverItems[idx];
      if (item) selectedItems.push(item);
    });
    if (!selectedItems.length) return;
    const applyBtn = document.querySelector('#bag-naver-modal button[onclick="bagNaverApply()"]');
    if (applyBtn) { applyBtn.textContent = '본문 가져오는 중...'; applyBtn.disabled = true; }
    const selectedSources = window._VAGSource && typeof window._VAGSource.scrapeSelectedSources === 'function'
      ? await window._VAGSource.scrapeSelectedSources(selectedItems, {
        minLength: 50,
        showProgressModal: true,
        onItemStart: (_item, idx, total) => {
          if (applyBtn) applyBtn.textContent = `본문 ${idx + 1}/${total}`;
        },
      })
      : selectedItems.map(item => {
        const url = String(item.url || item.link || '').trim();
        const title = String(item.title || '').trim();
        const snippet = String(item.description || item.snippet || '').trim();
        return {
          title,
          snippet,
          url,
          link: url,
          source: item.source || '',
          type: item.type || (item.source === '뉴스' ? 'news' : 'blog'),
          checked: true,
          scrapedText: '',
          scrapedImages: [],
          scrapeStatus: 'source-client-missing',
          textBlock: [`[${title}]`, url ? `URL: ${url}` : '', snippet].filter(Boolean).join('\n'),
        };
      });
    const parts = selectedSources.map(source => source.textBlock || '').filter(Boolean);
    _bagSourceContent = parts.join('\n\n');
    window._sharedSourceContent = _bagSourceContent;
    window._sharedSelectedSources = selectedSources;
    const picked = document.getElementById('bag-naver-picked');
    const crawledCount = selectedSources.filter(s => String(s.scrapedText || '').trim()).length;
    const imageCount = selectedSources.reduce((sum, s) => sum + (Array.isArray(s.scrapedImages) ? s.scrapedImages.length : 0), 0);
    if (picked) picked.innerHTML = `<span style="color:#34c759;">${parts.length}건 선택됨 (${selectedSources.filter(s => s.url).length}개 URL · 본문 ${crawledCount}건 · 이미지 ${imageCount}장)</span>`;
    document.getElementById('bag-naver-modal')?.remove();
  }

  // 소재 수집: 공용 _VAGSource 로 통일. 상태 뱃지만 에이전트별 유지.
  async function bagFetchYoutube() {
    const url = (document.getElementById('bag-youtube-url')?.value || '').trim();
    const status = document.getElementById('bag-yt-status');
    const btn = document.getElementById('bag-yt-btn');
    if (!url) return;
    if (btn) { btn.textContent = '분석 중...'; btn.disabled = true; }
    if (status) status.textContent = '영상 분석 중...';
    const res = await window._VAGSource.analyzeYouTube(url);
    if (res.ok) {
      _bagSourceContent = res.text;
      if (status) status.innerHTML = `<span style="color:#34c759;">분석 완료 (${res.text.length}자)</span>` + window._VAGSource.youtubeAnalysisPreviewHTML(res);
    } else if (status) {
      status.innerHTML = `<span style="color:#ff3b30;">${_esc(res.error)}</span>`;
    }
    if (btn) { btn.textContent = '분석'; btn.disabled = false; }
  }

  async function bagFetchUrl() {
    const url = (document.getElementById('bag-source-url')?.value || '').trim();
    const status = document.getElementById('bag-url-status');
    const btn = document.getElementById('bag-url-btn');
    if (!url) return;
    if (btn) { btn.textContent = '가져오는 중...'; btn.disabled = true; }
    const res = await window._VAGSource.fetchUrl(url);
    if (res.ok) {
      _bagSourceContent = res.text;
      if (status) status.innerHTML = `<span style="color:#34c759;">가져옴 (${res.text.length}자)</span>`;
    } else if (status) {
      status.innerHTML = `<span style="color:#ff3b30;">${_esc(res.error)}</span>`;
    }
    if (btn) { btn.textContent = '가져오기'; btn.disabled = false; }
  }

  function bagPickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.html,.htm,.docx,.doc,.pdf,.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('bag-file-status');
      if (status) status.textContent = `${file.name} 읽는 중...`;
      // 로컬에서 읽을 수 있는 텍스트 계열은 네트워크 없이 직접 읽음(기존 유지).
      if (/\.(txt|md|html|htm|csv|json)$/i.test(file.name) || file.type.startsWith('text/')) {
        try {
          const text = await file.text();
          let clean = text;
          if (/\.html?$/i.test(file.name)) { const tmp = document.createElement('div'); tmp.innerHTML = text; clean = tmp.innerText || text; }
          _bagSourceContent = clean.trim();
          if (status) status.innerHTML = `<span style="color:#34c759;">${_esc(file.name)} (${_bagSourceContent.length}자)</span>`;
        } catch (err) { if (status) status.innerHTML = `<span style="color:#ff3b30;">${_esc(err.message || err)}</span>`; }
        return;
      }
      // 바이너리(PDF/DOCX) 는 공용 모듈로 파싱.
      const res = await window._VAGSource.parseDocument(file);
      if (res.ok) {
        _bagSourceContent = res.text;
        if (status) status.innerHTML = `<span style="color:#34c759;">${_esc(file.name)} (${res.text.length}자)</span>`;
      } else if (status) {
        status.innerHTML = `<span style="color:#ff3b30;">${_esc(res.error)}</span>`;
      }
    };
    input.click();
  }

  /* ── 채팅 메시지 ── */
  function _showTyping() {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    const ti = document.createElement('div');
    ti.className = 'typing-indicator';
    ti.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;';
    ti.innerHTML = '<div style="display:flex;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:rgba(255,140,0,0.4);animation:typingDot 1.2s 0.4s infinite;"></span></div><span style="font-size:12px;color:rgba(0,0,0,0.3);">AI가 생각하고 있어요...</span>';
    body.appendChild(ti);
    body.scrollTop = body.scrollHeight;
  }

  function _removeLoadingMsg() {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.bag-loading-msg').forEach(el => el.remove());
  }

  function _appendLoadingLog(message) {
    const log = document.getElementById('bag-loading-log');
    if (!log || !message) return;
    const line = document.createElement('div');
    line.style.cssText = 'font-size:11px;color:rgba(0,0,0,0.42);line-height:1.5;';
    line.textContent = '• ' + message;
    log.appendChild(line);
    while (log.childElementCount > 4) log.removeChild(log.firstChild);
  }

  function _updateLoadingMsg(message, detail) {
    const titleEl = document.getElementById('bag-loading-title');
    const detailEl = document.getElementById('bag-loading-detail');
    if (titleEl && message) titleEl.textContent = message;
    if (detailEl && typeof detail === 'string') detailEl.textContent = detail;
  }

  function _addLoadingMsg(message, detail, logs) {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    _removeLoadingMsg();
    const row = document.createElement('div');
    row.className = 'bag-loading-msg';
    row.style.cssText = 'display:flex;justify-content:flex-start;';
    row.innerHTML = `
      <div style="max-width:85%;padding:10px 14px;border-radius:4px 14px 14px 14px;background:rgba(120,120,128,0.08);color:#1c1c1e;font-size:13px;line-height:1.6;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
          <span id="bag-loading-title">${_esc(message || '블로그 글을 생성 중입니다')}</span>
          <span style="display:flex;gap:4px;align-items:center;">
            <span style="width:6px;height:6px;border-radius:50%;background:rgba(255,140,0,0.45);animation:typingDot 1.2s infinite;"></span>
            <span style="width:6px;height:6px;border-radius:50%;background:rgba(255,140,0,0.45);animation:typingDot 1.2s 0.2s infinite;"></span>
            <span style="width:6px;height:6px;border-radius:50%;background:rgba(255,140,0,0.45);animation:typingDot 1.2s 0.4s infinite;"></span>
          </span>
        </div>
        <div id="bag-loading-detail" style="margin-top:6px;font-size:11px;color:rgba(0,0,0,0.34);">${_esc(detail || '요청을 준비하고 있습니다')}</div>
        <div id="bag-loading-log" style="margin-top:8px;display:flex;flex-direction:column;gap:2px;"></div>
      </div>`;
    body.appendChild(row);
    (logs || []).forEach(_appendLoadingLog);
    body.scrollTop = body.scrollHeight;
  }

  function _setPublishButtonLoading(isLoading) {
    const result = document.getElementById('bag-result');
    if (!result) return;
    const publishBtn = Array.from(result.querySelectorAll('button')).find(btn => (btn.textContent || '').includes('네이버 발행') || btn.dataset.role === 'bag-publish');
    if (!publishBtn) return;
    publishBtn.dataset.role = 'bag-publish';
    if (!publishBtn.dataset.origHtml) publishBtn.dataset.origHtml = publishBtn.innerHTML;
    publishBtn.disabled = !!isLoading;
    publishBtn.style.opacity = isLoading ? '0.65' : '1';
    publishBtn.innerHTML = isLoading
      ? '<span class="spinner" style="width:12px;height:12px;border-width:2px;border-color:rgba(255,255,255,0.3);border-top-color:#fff;"></span> 네이버 발행 중...'
      : publishBtn.dataset.origHtml;
  }

  function _addMsg(role, html) {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    // 초기 플레이스홀더 제거
    if (body.children.length === 1 && body.firstChild.textContent.includes('블로그 글 생성을 누르면')) body.innerHTML = '';
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${isAi ? 'flex-start' : 'flex-end'};`;
    div.innerHTML = `<div style="max-width:85%;padding:10px 14px;border-radius:${isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};background:${isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)'};color:${isAi ? '#1c1c1e' : '#fff'};font-size:13px;line-height:1.6;">${html}</div>`;
    // 타이핑 인디케이터 제거
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    _removeLoadingMsg();
    body.appendChild(div);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _clearChatOptions() {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
  }

  function _addChatActionOptions(labels, onSelect) {
    const body = document.getElementById('bag-chat-body');
    if (!body || !Array.isArray(labels) || !labels.length) return;
    _clearChatOptions();
    const wrap = document.createElement('div');
    wrap.className = 'bag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:4px 0 10px;';
    labels.forEach(label => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = 'padding:9px 14px;border-radius:12px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;';
      btn.onclick = () => {
        _clearChatOptions();
        try { onSelect && onSelect(label); } catch (e) { console.warn(e); }
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _askPublishAfterGenerate() {
    _clearChatOptions();
    _addMsg('ai', '생성한 글은 아래 결과 영역에 저장해두었습니다. 네이버 자동 발행 기능은 제거되어 복사해서 사용할 수 있습니다.');
  }

  function _addSourcePreview(title, text, tone) {
    const body = document.getElementById('bag-chat-body');
    if (!body || !text) return;
    if (window._VAGSource && typeof window._VAGSource.sourceTextPreviewHTML === 'function') {
      const card = document.createElement('div');
      card.innerHTML = window._VAGSource.sourceTextPreviewHTML(title, text);
      body.appendChild(card);
      const panel = document.getElementById('bag-assist-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const color = tone === 'knowledge' ? '#5856d6' : '#007aff';
    const border = tone === 'knowledge' ? 'rgba(88,86,214,0.14)' : 'rgba(0,122,255,0.14)';
    const bg = tone === 'knowledge' ? 'rgba(88,86,214,0.06)' : 'rgba(0,122,255,0.06)';
    const card = document.createElement('div');
    card.style.cssText = `padding:12px;border:1px solid ${border};background:${bg};border-radius:16px;`;
    card.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:${color};">${_esc(title)}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-top:4px;">총 ${text.length}자 반영됨</div>
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:12px;font-weight:700;color:#1c1c1e;">내용 확인</summary>
        <div style="margin-top:10px;padding:11px 12px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.72;color:#1c1c1e;white-space:pre-wrap;max-height:220px;overflow:auto;">${_esc(text.slice(0, 4000))}</div>
      </details>`;
    body.appendChild(card);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _bagNormalizeTopicSuggestions(items, minCount = BAG_TOPIC_SUGGESTION_COUNT) {
    const normalized = [];
    (items || []).forEach(item => {
      const value = String(item || '').trim();
      if (value && !normalized.includes(value)) normalized.push(value);
    });
    const fallback = [
      '업종 소개',
      '고객 후기',
      '이벤트 안내',
      '전문성 어필',
      '꿀팁 공유',
      '제품 리뷰',
      '자주 묻는 질문',
      '비교 포인트 정리',
      '문제 해결 가이드',
      '브랜드 스토리',
      '시즌 추천',
      '초보자 가이드',
      '실전 활용법',
      '추천 체크리스트',
      '입문자 실수 모음',
      '가격/비용 안내',
      '선택 기준 정리',
      '비하인드 스토리',
      '업무 노하우 공개',
      '후기 분석',
      '전후 비교',
      '트렌드 정리',
      '상황별 추천',
      '업체 선택 팁',
      '서비스 차이점',
      '관리 방법',
      '준비 과정',
      '추천 조합',
      '오해와 진실',
      '핵심 요약',
    ];
    fallback.forEach(item => {
      if (normalized.length < minCount && !normalized.includes(item)) normalized.push(item);
    });
    return normalized;
  }

  /* ── 어시스턴트 대화 옵션 버튼 ── */
  function _addOptions(options, callback) {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    const wrap = document.createElement('div');
    wrap.className = 'bag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;';
      btn.onmouseenter = () => { btn.style.background = 'rgba(255,140,0,0.15)'; };
      btn.onmouseleave = () => { btn.style.background = 'rgba(255,140,0,0.06)'; };
      btn.onclick = () => {
        body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
        _addMsg('user', opt);
        callback(opt);
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _addOptionsWithRefresh(options, callback, refreshCallback) {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    const wrap = document.createElement('div');
    wrap.className = 'bag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;';
      btn.onmouseenter = () => { btn.style.background = 'rgba(255,140,0,0.15)'; };
      btn.onmouseleave = () => { btn.style.background = 'rgba(255,140,0,0.06)'; };
      btn.onclick = () => {
        body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
        _addMsg('user', opt);
        callback(opt);
      };
      wrap.appendChild(btn);
    });
    // 더 보기 버튼
    if (refreshCallback) {
      const moreBtn = document.createElement('button');
      moreBtn.textContent = '더 추천받기';
      moreBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;';
      moreBtn.onclick = () => {
        body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
        refreshCallback();
      };
      wrap.appendChild(moreBtn);
    }
    // 직접 입력 버튼
    const directBtn = document.createElement('button');
    directBtn.textContent = '직접 입력';
    directBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;';
    directBtn.onclick = () => {
      body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
      // 입력창 표시
      const inputWrap = document.createElement('div');
      inputWrap.className = 'bag-chat-options';
      inputWrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
      inputWrap.innerHTML = `<input type="text" id="bag-direct-topic" placeholder="주제를 입력하세요..." style="flex:1;padding:8px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);outline:none;" onfocus="this.style.borderColor='#ff8c00'" onkeydown="if(event.key==='Enter'){event.preventDefault();bagDirectTopic();}"><button onclick="bagDirectTopic()" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>`;
      body.appendChild(inputWrap);
      document.getElementById('bag-direct-topic')?.focus();
    };
    wrap.appendChild(directBtn);
    body.appendChild(wrap);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _bagShowTopicOptions(suggestions, source) {
    const body = document.getElementById('bag-chat-body');
    if (!body) return;
    body.querySelectorAll('.typing-indicator').forEach(el => el.remove());
    // 옵션 버튼 추가
    const wrap = document.createElement('div');
    wrap.className = 'bag-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    suggestions.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;';
      btn.onclick = () => { body.querySelectorAll('.bag-chat-options,.bag-extra-btns').forEach(el => el.remove()); _addMsg('user', opt); document.getElementById('bag-topic').value = opt; _askTone(opt, source); };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    // 더 추천받기 + 직접 입력 (별도 행)
    const extra = document.createElement('div');
    extra.className = 'bag-extra-btns';
    extra.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
    const moreBtn = document.createElement('button');
    moreBtn.textContent = '더 추천받기';
    moreBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;';
    moreBtn.onclick = async () => {
      moreBtn.textContent = '추천 중...'; moreBtn.disabled = true;
      try {
        const resp = await fetch('/api/ce2/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topics', industry: window._globalProfileData?.business_type || '', brand_name: _bagBrandName, brand_desc: _bagBrandDesc, brand_biz_detail: window._globalProfileData?.biz_detail || '', count: BAG_TOPIC_SUGGESTION_COUNT }) });
        const data = await resp.json();
        if (data.ok && data.items?.length) {
          const topicItems = _bagNormalizeTopicSuggestions(data.items);
          // 기존 유지, 새 옵션 extra 앞에 추가
          const newWrap = document.createElement('div');
          newWrap.className = 'bag-chat-options';
          newWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
          topicItems.forEach(opt => {
            const b = document.createElement('button');
            b.textContent = opt;
            b.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;';
            b.onclick = () => { body.querySelectorAll('.bag-chat-options,.bag-extra-btns').forEach(el => el.remove()); _addMsg('user', opt); document.getElementById('bag-topic').value = opt; _askTone(opt, source); };
            newWrap.appendChild(b);
          });
          extra.before(newWrap);
        }
      } catch (e) {}
      moreBtn.textContent = '더 추천받기'; moreBtn.disabled = false;
    };
    extra.appendChild(moreBtn);
    const directBtn = document.createElement('button');
    directBtn.textContent = '직접 입력';
    directBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;';
    directBtn.onclick = () => {
      body.querySelectorAll('.bag-chat-options,.bag-extra-btns').forEach(el => el.remove());
      const inputWrap = document.createElement('div');
      inputWrap.className = 'bag-chat-options';
      inputWrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
      inputWrap.innerHTML = `<input type="text" id="bag-direct-topic" placeholder="주제를 입력하세요..." style="flex:1;padding:8px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);outline:none;" onfocus="this.style.borderColor='#ff8c00'" onkeydown="if(event.key==='Enter'){event.preventDefault();bagDirectTopic();}"><button onclick="bagDirectTopic()" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>`;
      body.appendChild(inputWrap);
      document.getElementById('bag-direct-topic')?.focus();
    };
    extra.appendChild(directBtn);
    body.appendChild(extra);
    const panel = document.getElementById('bag-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bagDirectTopic() {
    const input = document.getElementById('bag-direct-topic');
    const val = (input?.value || '').trim();
    if (!val) return;
    const body = document.getElementById('bag-chat-body');
    if (body) body.querySelectorAll('.bag-chat-options').forEach(el => el.remove());
    document.getElementById('bag-topic').value = val;
    _addMsg('user', val);
    _askTone(val, _bagSourceContent);
  }

  /* ── 블로그 생성 (완전 채팅형) ── */
  async function bagGenerate() {
    const chatBody = document.getElementById('bag-chat-body');
    if (chatBody) chatBody.innerHTML = '<div class="typing-indicator" style="display:flex;align-items:center;gap:6px;padding:10px 14px;"><span class="spinner" style="width:16px;height:16px;border-width:2px;"></span><span style="font-size:13px;color:rgba(0,0,0,0.4);">AI가 준비 중...</span></div>';
    const resultEl = document.getElementById('bag-result');
    if (resultEl) resultEl.style.display = 'none';
    _bagSourceContent = '';
    _bagSelectedImages = [];
    window._sharedSourceContent = '';

    const btn = document.getElementById('bag-gen-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

    try {
      // 인사
      _addMsg('ai', _bagBrandName ? `<b>${_esc(_bagBrandName)}</b> 블로그 글을 만들어 드릴게요!` : '블로그 글을 만들어 드릴게요!');

      // 1. 키워드 입력
      _addMsg('ai', '어떤 주제로 글을 쓸까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.3);">키워드를 입력하거나 추천 주제를 선택하세요</span>');
      // AI 추천
      _showTyping();
      let suggestions = [];
      try {
        const resp = await fetch('/api/ce2/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'topics', industry: window._globalProfileData?.business_type || '', brand_name: _bagBrandName, brand_desc: _bagBrandDesc, count: BAG_TOPIC_SUGGESTION_COUNT }) });
        const data = await resp.json();
        if (data.ok && data.items?.length) suggestions = _bagNormalizeTopicSuggestions(data.items);
      } catch {}
      if (!suggestions.length) suggestions = _bagNormalizeTopicSuggestions([]);

      const topic = await new Promise(resolve => {
        // 직접 입력 필드
        const body = document.getElementById('bag-chat-body');
        const inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
        inputWrap.innerHTML = `<input type="text" id="bag-chat-topic-input" placeholder="키워드 직접 입력..." style="flex:1;${_inputStyle()}" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('bag-chat-topic-go').click();}"><button id="bag-chat-topic-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>`;
        body.appendChild(inputWrap);
        document.getElementById('bag-chat-topic-go').onclick = () => {
          const v = document.getElementById('bag-chat-topic-input').value.trim();
          if (v) { inputWrap.remove(); body.querySelectorAll('.bag-chat-options').forEach(el => el.remove()); _addMsg('user', v); resolve(v); }
        };
        // 추천 옵션
        _addOptions(suggestions, (sel) => { inputWrap.remove(); resolve(sel); });
      });
      document.getElementById('bag-topic').value = topic;

      // 2. 소재 수집 방법
      if (!_bagSourceContent) {
        // AI가 주제 기반으로 소재 추천
        let sourceHint = `<b>"${_esc(topic)}"</b> 주제로 소재를 준비해볼까요?`;
        sourceHint += `<br><span style="font-size:11px;color:rgba(0,0,0,0.4);">추천: "<b>${_esc(topic)}</b>"로 뉴스 검색하면 최신 트렌드와 전문 자료를 바로 활용할 수 있어요.</span>`;
        _addMsg('ai', sourceHint);
        const sourceMethod = await new Promise(resolve => {
          _addOptions(['뉴스 검색', '네이버 검색', 'YouTube 분석', 'URL 가져오기', '직접 입력', '소재 없이 진행'], resolve);
        });

        if (sourceMethod.includes('뉴스 검색')) {
          _addMsg('ai', '뉴스 검색에 사용할 키워드를 입력하세요.');
          const newsKeyword = await new Promise(resolve => {
            const body = document.getElementById('bag-chat-body');
            const w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = `<input type="text" id="bag-chat-news-keyword" placeholder="${_esc(topic)}" value="${_esc(topic)}" style="flex:1;${_inputStyle()}" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('bag-chat-news-go').click();}"><button id="bag-chat-news-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">검색</button>`;
            body.appendChild(w);
            document.getElementById('bag-chat-news-go').onclick = () => {
              const v = document.getElementById('bag-chat-news-keyword').value.trim();
              if (v) { w.remove(); _addMsg('user', v); resolve(v); }
            };
          });
          document.getElementById('bag-topic').value = newsKeyword;
          _addMsg('ai', `<b>"${_esc(newsKeyword)}"</b>로 뉴스·블로그 자료조사 모달을 열겠습니다.`);
          const picked = window._VAGSource && typeof window._VAGSource.openNewsModal === 'function'
            ? await window._VAGSource.openNewsModal({ query: newsKeyword, showProgressModal: true })
            : { ok: false, error: '자료조사 모듈을 찾지 못했습니다.' };
          if (picked.ok) _bagSourceContent = picked.text;
          else _addMsg('ai', `<span style="color:#ff9500;">${_esc(picked.error || '뉴스 자료를 가져오지 못했습니다.')}</span>`);
        } else if (sourceMethod === '네이버 검색') {
          _addMsg('ai', '네이버에서 찾을 말을 입력하세요.');
          const naverKeyword = await new Promise(resolve => {
            const body = document.getElementById('bag-chat-body');
            const w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = `<input type="text" id="bag-chat-naver-keyword" placeholder="검색어를 직접 입력하세요" style="flex:1;${_inputStyle()}" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('bag-chat-naver-go').click();}"><button id="bag-chat-naver-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">검색</button>`;
            body.appendChild(w);
            document.getElementById('bag-chat-naver-go').onclick = () => {
              const v = document.getElementById('bag-chat-naver-keyword').value.trim();
              if (v) { w.remove(); _addMsg('user', v); resolve(v); }
            };
          });
          _addMsg('ai', `<b>"${_esc(naverKeyword)}"</b>로 네이버 자료조사 모달을 열겠습니다.`);
          const picked = window._VAGSource && typeof window._VAGSource.openNaverModal === 'function'
            ? await window._VAGSource.openNaverModal({ query: naverKeyword, showProgressModal: true })
            : { ok: false, error: '네이버 자료조사 모듈을 찾지 못했습니다.' };
          if (picked.ok) _bagSourceContent = picked.text;
          else _addMsg('ai', `<span style="color:#ff9500;">${_esc(picked.error || '네이버 자료를 가져오지 못했습니다.')}</span>`);
        } else if (sourceMethod === 'YouTube 분석') {
          _addMsg('ai', 'YouTube URL을 입력하세요.');
          const ytUrl = await new Promise(resolve => {
            const body = document.getElementById('bag-chat-body');
            const w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = `<input type="text" id="bag-chat-yt" placeholder="https://youtube.com/..." style="flex:1;${_inputStyle()}"><button id="bag-chat-yt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff0000;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">분석</button>`;
            body.appendChild(w);
            document.getElementById('bag-chat-yt-go').onclick = () => { const v = document.getElementById('bag-chat-yt').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', 'YouTube 영상을 분석 중...');
          {
            const res = await window._VAGSource.analyzeYouTube(ytUrl);
            if (res.ok) { _bagSourceContent = res.text; _addMsg('ai', `<span style="color:#34c759;">분석 완료 (${res.text.length}자)</span>${window._VAGSource.youtubeAnalysisPreviewHTML(res)}`); }
            else { _addMsg('ai', `<span style="color:#ff3b30;">${_esc(res.error)}</span>`); }
          }
        } else if (sourceMethod === 'URL 가져오기') {
          _addMsg('ai', 'URL을 입력하세요.');
          const srcUrl = await new Promise(resolve => {
            const body = document.getElementById('bag-chat-body');
            const w = document.createElement('div');
            w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
            w.innerHTML = `<input type="text" id="bag-chat-url" placeholder="https://..." style="flex:1;${_inputStyle()}"><button id="bag-chat-url-go" style="padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">가져오기</button>`;
            body.appendChild(w);
            document.getElementById('bag-chat-url-go').onclick = () => { const v = document.getElementById('bag-chat-url').value.trim(); if (v) { w.remove(); _addMsg('user', v); resolve(v); } };
          });
          _addMsg('ai', '페이지 내용을 가져오는 중... (백엔드 5단계 폴백 · 최대 45초)');
          {
            const res = await window._VAGSource.scrapeArticle(srcUrl, { minLength: 50 });
            if (res.ok) { _bagSourceContent = res.text; _addMsg('ai', `<span style="color:#34c759;">가져오기 완료 (${res.text.length}자 · ${_esc(res.method || 'ok')})</span>`); }
            else { _addMsg('ai', `<span style="color:#ff3b30;">${_esc(res.error || '내용을 가져올 수 없습니다')}</span>`); }
          }
        } else if (sourceMethod === '직접 입력') {
          _addMsg('ai', '소재를 직접 입력하세요.');
          const directText = await new Promise(resolve => {
            const body = document.getElementById('bag-chat-body');
            const w = document.createElement('div');
            w.style.cssText = 'padding:4px 0;';
            w.innerHTML = `<textarea id="bag-chat-direct" rows="4" placeholder="블로그에 넣을 내용..." style="width:100%;${_inputStyle()}resize:vertical;line-height:1.5;"></textarea><button id="bag-chat-direct-go" style="margin-top:4px;padding:7px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">확인</button>`;
            body.appendChild(w);
            document.getElementById('bag-chat-direct-go').onclick = () => { const v = document.getElementById('bag-chat-direct').value.trim(); if (v) { w.remove(); _addMsg('user', v.length > 100 ? v.slice(0, 100) + '...' : v); _bagSourceContent = v; resolve(v); } };
          });
        }
        if (_bagSourceContent) {
          _addMsg('ai', `소재 준비 완료 (${_bagSourceContent.length}자)`);
          _addSourcePreview('소재 반영 내용', _bagSourceContent, 'source');
        }
      }

      // 4. 톤 선택
      _addMsg('ai', '어떤 톤으로 작성할까요?');
      const toneSel = await new Promise(resolve => { _addOptions(['내 문체','친근한','전문적','캐주얼','유머러스'], resolve); });
      const toneMap = {'친근한':'friendly','전문적':'professional','캐주얼':'casual','유머러스':'humorous','내 문체':'mystyle'};
      const tone = toneMap[toneSel] || 'mystyle';

      // 5. 글 길이
      _addMsg('ai', '글 길이는?');
      const lenSel = await new Promise(resolve => { _addOptions(['짧게 (1000자)','보통 (2000자)','길게 (3000자)','매우 길게 (5000자+)'], resolve); });
      const lenMap = {'짧게 (1000자)':'short','보통 (2000자)':'medium','길게 (3000자)':'long','매우 길게 (5000자+)':'extra_long'};
      const length = lenMap[lenSel] || 'medium';

      // 6. 이미지 스타일
      _addMsg('ai', '이미지 스타일을 선택하세요.');
      const imgStyleSel = await new Promise(resolve => { _addOptions(['AI 자동','사진풍','일러스트','3D','플랫','수채화','미니멀','시네마틱'], resolve); });
      const imgStyleMap = {'AI 자동':'','사진풍':'photo','일러스트':'illustration','3D':'3d','플랫':'flat','수채화':'watercolor','미니멀':'minimal','시네마틱':'cinematic'};
      document.getElementById('bag-image-style').value = imgStyleMap[imgStyleSel] || '';

      // 7. 이미지 수
      _addMsg('ai', '이미지는 몇 장?');
      const imgCountSel = await new Promise(resolve => { _addOptions(['1장','2장','3장','4장','5장'], resolve); });
      const countMap = {'1장':1,'2장':2,'3장':3,'4장':4,'5장':5};
      const imageCount = countMap[imgCountSel] ?? 1;
      const imgCountInput = document.getElementById('bag-image-count');
      if (imgCountInput) imgCountInput.value = String(imageCount);
      const selectedImages = imageCount > 0 ? await _bagAskImageReferences() : [];

      // 생성!
      _doGenerate(topic, _bagSourceContent, tone, length, imageCount, selectedImages);

    } catch (flowErr) {
      console.error('[BAG] flow error:', flowErr);
      _addMsg('ai', `<span style="color:#ff3b30;">오류: ${_esc(flowErr.message)}<br>다시 시도해주세요.</span>`);
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }

  async function _doGenerate(topic, source, tone, length, imageCount, selectedImages = []) {
    _addLoadingMsg('블로그 글을 생성 중입니다', 'AI 작성 요청을 시작합니다', [
      `주제: ${topic || '미입력'}`,
      `톤: ${tone || 'friendly'} / 길이: ${length || 'medium'}`,
      `이미지: ${imageCount || 0}장`
    ]);

    const btn = document.getElementById('bag-gen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 생성 중...'; }
    const resultEl = document.getElementById('bag-result');

    try {
      _updateLoadingMsg('블로그 글을 생성 중입니다', '본문 생성 요청을 전송했습니다');
      _appendLoadingLog(source ? `소재 반영: ${Math.min(source.length, 9999)}자` : '소재 없이 주제 기반 생성');
      _appendLoadingLog(selectedImages.length ? `선택 이미지 ${selectedImages.length}장 반영` : '선택 이미지 없음');
      const profileId = parseInt(window._globalProfileId || 0);
      let contentOpts = {};
      try { contentOpts = JSON.parse(window._globalProfileData?.content_options || '{}'); } catch {}
      const logoUrl = window._globalProfileData?.logo_path && profileId
        ? encImg('/api/library/image/' + profileId + '/' + window._globalProfileData.logo_path)
        : '';
      const logoInsert = !!logoUrl && contentOpts.logo_insert !== false && window._contentOpts?.logo_insert !== false;

      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: topic || '블로그 글',
          scraped_texts: source ? [source] : [],
          brand_name: _bagBrandName,
          brand_logo_url: logoUrl,
          logo_insert: logoInsert,
          brand_description: (_bagBuildBrandContext(window._globalProfileData || {}))
            + (window._globalProfileData?.business_type ? '\n업종: ' + window._globalProfileData.business_type : ''),
          business_goal: window._globalProfileData?.business_goal || '',
          contact_info: window._globalProfileData?.contact_info || '',
          cta_text: window._globalProfileData?.cta_text || '',
          user_image_urls: selectedImages,
          generate_blog: true,
          generate_cardnews: false,
          generate_video: false,
          generate_sns: false,
          tone: tone,
          blog_length: length,
          comma_rate: contentOpts.comma_rate || 50,
          period_rate: contentOpts.period_rate || 70,
          human_level: contentOpts.human_level || 'light',
          include_cta: false,
          seo: true,
          text_provider: '',
          image_provider: '',
          image_model: '',
          profile_id: profileId,
          blog_image_count: imageCount,
          blog_img_source: 'ai',
          blog_img_style: document.getElementById('bag-image-style')?.value || '',
        }),
      });
      const data = await res.json();
      _updateLoadingMsg('블로그 글을 생성 중입니다', '본문 응답을 받아 후처리 중입니다');
      _appendLoadingLog('본문 생성 응답 수신');

      if (data.blog && !data.blog.error) {
        _bagResult = data.blog;
        _bagResult._images = data.blog_images || null;
        _appendLoadingLog(`본문 길이: ${data.blog.char_count || 0}자`);

        // 태그 자동 생성
        _bagResult._tags = [];
        try {
          _updateLoadingMsg('블로그 글을 생성 중입니다', '태그를 정리하고 있습니다');
          _appendLoadingLog('태그 생성 요청');
          const tagResp = await fetch('/api/ce2/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'blog_tags', industry: window._globalProfileData?.business_type || '', topic: topic || data.blog.title || '', body: (data.blog.body || '').slice(0, 1000) }),
          });
          const tagData = await tagResp.json();
          if (tagData.ok && tagData.tags) _bagResult._tags = tagData.tags;
          if (tagData.ok && tagData.tags?.length) _appendLoadingLog(`태그 ${tagData.tags.length}개 생성`);
        } catch (e) { console.warn('tag gen failed'); }

        _updateLoadingMsg('블로그 글을 생성 중입니다', '결과를 화면에 정리하고 있습니다');
        const imageStatusText = _imageStatusText(data, imageCount);
        _appendLoadingLog(imageStatusText || '이미지 없음');

        // 채팅에 완료 표시
        _removeLoadingMsg();
        const modelText = _modelText(data, imageCount);
        const imageStatusHtml = imageStatusText
          ? `<br><span style="color:${data.blog_images?.error ? '#ff3b30' : 'rgba(0,0,0,0.45)'};">${_esc(imageStatusText)}</span>`
          : '';
        _addMsg('ai', `<b>블로그 글 생성 완료!</b><br>${data.blog.char_count || 0}자${modelText ? '<br>' + _esc(modelText) : ''}${imageStatusHtml}`);

        // 결과 표시
        if (resultEl) resultEl.style.display = 'block';
        document.getElementById('bag-result-title').textContent = data.blog.title || '';
        document.getElementById('bag-result-body').textContent = data.blog.body || data.blog.content || '';
        document.getElementById('bag-result-meta').textContent = `${data.blog.char_count || 0}자${modelText ? ' · ' + modelText : ''} · ${new Date().toLocaleTimeString('ko-KR')}`;
        // 태그 표시
        const tagsInput = document.getElementById('bag-result-tags');
        if (tagsInput && _bagResult._tags?.length) tagsInput.value = _bagResult._tags.join(', ');

        // 이미지
        const imgGrid = document.getElementById('bag-result-images-grid');
        const imgWrap = document.getElementById('bag-result-images');
        if (data.blog_images && !data.blog_images.error && data.blog_images.count > 0) {
          imgGrid.innerHTML = (data.blog_images.images || []).map((img, idx) => `
            <div style="border:1px solid rgba(0,0,0,0.06);border-radius:10px;overflow:hidden;">
              <img src="${img.url}?t=${Date.now()}" style="width:100%;aspect-ratio:16/9;object-fit:cover;cursor:pointer;" onclick="window.open(this.src)" loading="lazy">
            </div>`).join('');
          imgWrap.style.display = 'block';
        } else { imgWrap.style.display = 'none'; }

        // 히스토리에 저장
        try {
          await fetch('/api/bag/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: data.blog.title || '',
              body: data.blog.body || data.blog.content || '',
              char_count: data.blog.char_count || 0,
              model: data.blog.model || '',
              topic: topic || '',
              industry: window._globalProfileData?.business_type || '',
              images: (data.blog_images?.images || []).map(i => i.url),
              profile_name: window._globalProfileData?.name || '',
              profile_id: parseInt(window._globalProfileId || 0),
            }),
          });
        } catch (e) { console.warn('blog agent save failed:', e); }

        _askPublishAfterGenerate();

      } else {
        _appendLoadingLog('본문 생성 실패 응답');
        _removeLoadingMsg();
        _addMsg('ai', `<span style="color:#ff3b30;">생성 실패: ${_esc(data.blog?.error || '알 수 없는 오류')}</span>`);
      }
    } catch (e) {
      _appendLoadingLog(`오류: ${e.message}`);
      _removeLoadingMsg();
      _addMsg('ai', `<span style="color:#ff3b30;">오류: ${_esc(e.message)}</span>`);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg> 블로그 글 생성'; }
  }

  function bagCopyResult() {
    if (!_bagResult) return;
    const text = (_bagResult.title || '') + '\n\n' + (_bagResult.body || _bagResult.content || '');
    navigator.clipboard.writeText(text).then(() => alert('복사됨'));
  }

  function bagRestart() {
    _bagSourceContent = '';
    _bagSourceMode = 'text';
    _bagResult = null;
    _bagChatMessages = [];
    _bagSelectedImages = [];
    window._sharedSourceContent = '';
    const root = document.getElementById('blog-agent-root');
    if (root) _renderLayout(root);
  }

  async function _bagCheckBrowser() {
    try {
      const resp = await fetch('/api/browser/status');
      const data = await resp.json();
      if (!data.connected) {
        _addMsg('ai', '<span style="color:#ff3b30;">Chrome 확장 프로그램이 연결되지 않았습니다.</span>');
        if (typeof window.showChromeExtensionGuide === 'function') window.showChromeExtensionGuide();
        return false;
      }
      return true;
    } catch (e) { return true; }
  }

  async function bagPublish(options = {}) {
    if (!_bagResult) return;
    const skipConfirm = !!options.skipConfirm;
    const profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { _addMsg('ai', '<span style="color:#ff3b30;">프로필을 먼저 선택해주세요. (좌측 상단 프로필 선택)</span>'); return; }
    _addLoadingMsg('네이버에 발행 중입니다', '브라우저 연결 상태를 확인하고 있습니다', [
      `프로필 ID: ${profileId}`,
      `제목 길이: ${(_bagResult.title || '').length}자`
    ]);
    _setPublishButtonLoading(true);
    _appendLoadingLog('브라우저 연결 확인 시작');
    if (!(await _bagCheckBrowser())) { _removeLoadingMsg(); _setPublishButtonLoading(false); return; }
    if (!skipConfirm && !confirm('이 글을 네이버 블로그에 발행할까요?')) {
      _removeLoadingMsg();
      _setPublishButtonLoading(false);
      return;
    }
    _updateLoadingMsg('네이버에 발행 중입니다', '네이버 블로그 발행 요청을 준비하고 있습니다');
    _appendLoadingLog(skipConfirm ? '에이전트 발행 승인 완료' : '사용자 발행 확인 완료');
    try {
      _appendLoadingLog('발행 요청 전송');
      const resp = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: _bagResult.title || '',
          content: _bagResult.body || _bagResult.content || '',
          tags: (document.getElementById('bag-result-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean),
          images: (_bagResult._images?.images || []).map(i => i.url),
          profile_id: profileId,
        }),
      });
      const data = await resp.json();
      _updateLoadingMsg('네이버에 발행 중입니다', '발행 응답을 확인하고 있습니다');
      _appendLoadingLog('발행 응답 수신');
      const innerResult = data.result || {};
      const isSuccess = (data.status === 'ok' || data.success || data.ok) && innerResult.status !== 'error';
      if (isSuccess) {
        _appendLoadingLog('네이버 발행 완료');
        _removeLoadingMsg();
        _addMsg('ai', '네이버 블로그 발행 완료!');
      } else {
        _appendLoadingLog('네이버 발행 실패 응답');
        _removeLoadingMsg();
        _addMsg('ai', `<span style="color:#ff3b30;">발행 실패: ${_esc(innerResult.message || data.error || data.detail || '')}</span>`);
      }
    } catch (e) {
      _appendLoadingLog(`발행 오류: ${e.message}`);
      _removeLoadingMsg();
      _addMsg('ai', `<span style="color:#ff3b30;">발행 실패: ${_esc(e.message)}</span>`);
    }
    _setPublishButtonLoading(false);
  }

  /* ── 히스토리 ── */
  function bagHistoryRenderCards(items) {
    return items.map((item, hi) => `
      <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px;">
          <div style="min-width:0;flex:1;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${item.profile_id ? `<img src="/api/library/profiles/${item.profile_id}/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display='none'">` : ''}
              <div style="font-size:14px;font-weight:700;color:#1c1c1e;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(item.title || '')}</div>
            </div>
            <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${item.profile_name ? _esc(item.profile_name) + ' · ' : ''}${_esc(item.created || '')} · ${item.char_count || 0}자</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
            <button onclick="bagHistoryToggle(${hi})" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:11px;cursor:pointer;">전체보기</button>
            <button onclick="bagHistoryOpenEdit(${hi})" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:11px;cursor:pointer;">수정</button>
            <button onclick="bagHistoryCopy(${hi})" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">복사</button>
            <button onclick="bagHistoryDelete(${hi})" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>
          </div>
        </div>
        <div id="bag-h-preview-${hi}" style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.6;max-height:60px;overflow:hidden;cursor:pointer;" onclick="bagHistoryToggle(${hi})">${_esc((item.body || '').slice(0, 200))}${(item.body || '').length > 200 ? '... <span style=&quot;color:#ff8c00;font-weight:600;&quot;>전체보기</span>' : ''}</div>
        <div id="bag-h-full-${hi}" style="display:none;margin-top:8px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">제목</span>
            <button onclick="bagHistorySave(${hi})" style="padding:2px 10px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">수정 저장</button>
            <button onclick="bagHistoryToggle(${hi})" style="padding:2px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.4);font-size:9px;cursor:pointer;">닫기</button>
          </div>
          <input type="text" id="bag-h-title-${hi}" value="${_esc(item.title || '')}" style="width:100%;padding:8px 10px;font-size:14px;font-weight:700;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;margin-bottom:6px;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">
          <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">본문</span>
          <textarea id="bag-h-body-${hi}" rows="12" style="width:100%;padding:10px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.7;margin-top:4px;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">${_esc(item.body || '')}</textarea>
        </div>
        ${item.images && item.images.length ? `
          <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
            ${item.images.map(img => `<img src="${img}?t=${Date.now()}" style="height:60px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);cursor:pointer;" onclick="window.open(this.src)" onerror="this.style.display='none'">`).join('')}
          </div>` : ''}
      </div>
    `).join('');
  }

  async function bagHistoryInit() {
    const root = document.getElementById('blog-agent-history-root');
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      const resp = await fetch('/api/bag/history');
      const data = await resp.json();
      if (!data.ok || !data.items || !data.items.length) {
        root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 블로그 글이 없습니다</div>';
        return;
      }
      window._bagHistoryItems = data.items;
      root.innerHTML = bagHistoryRenderCards(data.items);
      return;
      root.innerHTML = data.items.map((item, hi) => `
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${item.profile_id ? `<img src="/api/library/profiles/${item.profile_id}/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display='none'">` : ''}
                <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(item.title || '')}</div>
              </div>
              <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${item.profile_name ? _esc(item.profile_name) + ' · ' : ''}${_esc(item.created || '')} · ${item.char_count || 0}자</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="bagHistoryCopy(${hi})" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">복사</button>
              <button onclick="bagHistoryDelete(${hi})" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>
            </div>
          </div>
          <!-- 본문 미리보기 -->
          <div id="bag-h-preview-${hi}" style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.6;max-height:60px;overflow:hidden;cursor:pointer;" onclick="bagHistoryToggle(${hi})">${_esc((item.body || '').slice(0, 200))}${(item.body || '').length > 200 ? '... <span style=&quot;color:#ff8c00;font-weight:600;&quot;>더보기</span>' : ''}</div>
          <!-- 본문 전체 보기/수정 -->
          <div id="bag-h-full-${hi}" style="display:none;margin-top:8px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">제목</span>
              <button onclick="bagHistorySave(${hi})" style="padding:2px 10px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">저장</button>
              <button onclick="bagHistoryToggle(${hi})" style="padding:2px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.4);font-size:9px;cursor:pointer;">접기</button>
            </div>
            <input type="text" id="bag-h-title-${hi}" value="${_esc(item.title || '')}" style="width:100%;padding:8px 10px;font-size:14px;font-weight:700;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;margin-bottom:6px;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">
            <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">본문</span>
            <textarea id="bag-h-body-${hi}" rows="12" style="width:100%;padding:10px;font-size:13px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);outline:none;resize:vertical;line-height:1.7;margin-top:4px;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">${_esc(item.body || '')}</textarea>
          </div>
          ${item.images && item.images.length ? `
            <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;">
              ${item.images.map(img => `<img src="${img}" style="height:60px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">`).join('')}
            </div>` : ''}
        </div>
      `).join('');
    } catch (e) {
      root.innerHTML = `<div style="text-align:center;padding:40px;color:#ff3b30;">오류: ${e.message}</div>`;
    }
  }

  function bagHistoryToggle(hi) {
    const preview = document.getElementById(`bag-h-preview-${hi}`);
    const full = document.getElementById(`bag-h-full-${hi}`);
    if (!preview || !full) return;
    const isOpen = full.style.display !== 'none';
    full.style.display = isOpen ? 'none' : 'block';
    preview.style.display = isOpen ? '' : 'none';
  }

  function bagHistoryOpenEdit(hi) {
    const preview = document.getElementById(`bag-h-preview-${hi}`);
    const full = document.getElementById(`bag-h-full-${hi}`);
    if (!preview || !full) return;
    preview.style.display = 'none';
    full.style.display = 'block';
    document.getElementById(`bag-h-title-${hi}`)?.focus();
  }

  async function bagHistorySave(hi) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item || !item.folder) return;
    const newTitle = document.getElementById(`bag-h-title-${hi}`)?.value || '';
    const newBody = document.getElementById(`bag-h-body-${hi}`)?.value || '';
    try {
      await fetch('/api/bag/save-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: item.folder, title: newTitle, body: newBody }),
      });
      item.title = newTitle;
      item.body = newBody;
      item.char_count = newBody.length;
      // 제목 업데이트
      const titleEl = document.getElementById(`bag-h-preview-${hi}`)?.closest('div')?.querySelector('div[style*="font-weight:700"]');
      if (titleEl) titleEl.textContent = newTitle;
      alert('저장됨');
    } catch (e) { alert('저장 실패: ' + e.message); }
  }

  function bagHistoryCopy(hi) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item) return;
    navigator.clipboard.writeText((item.title || '') + '\n\n' + (item.body || '')).then(() => alert('복사됨'));
  }

  async function bagHistoryPublish(hi) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item) return;
    const profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) { alert('프로필을 먼저 선택해주세요.'); return; }
    try {
      const bs = await fetch('/api/browser/status');
      const bsd = await bs.json();
      if (!bsd.connected) { alert('Chrome 확장 프로그램이 연결되지 않았습니다. 프로필 연결에서 Chrome을 연결하세요.'); return; }
    } catch (e) {}
    if (!confirm('네이버 블로그에 발행할까요?')) return;
    try {
      const resp = await fetch('/api/blog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title || '', content: item.body || '', tags: [], images: item.images || [], profile_id: profileId }),
      });
      const data = await resp.json();
      const ir = data.result || {};
      const ok = (data.status === 'ok' || data.success || data.ok) && ir.status !== 'error';
      alert(ok ? '발행 완료!' : '발행 실패: ' + (ir.message || data.error || data.detail || ''));
    } catch (e) { alert('발행 실패: ' + e.message); }
  }

  async function bagHistoryDelete(hi) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item || !item.folder) return;
    if (!confirm('이 블로그 글을 삭제하시겠습니까?')) return;
    await fetch('/api/bag/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder }) });
    bagHistoryInit();
  }

  function bagHistoryOpenUpload(hi) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item) return;
    // 카드뉴스 에이전트의 발행 모달과 동일한 구조
    const existing = document.getElementById('bag-upload-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'bag-upload-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:520px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;font-size:18px;font-weight:700;">SNS 발행</h2>
          <button onclick="document.getElementById('bag-upload-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:rgba(0,0,0,0.3);">&times;</button>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">캡션/내용</label>
          <textarea id="bag-um-caption" rows="3" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${_esc(item.title || '')}</textarea>
        </div>
        <div style="padding:12px 14px;border-radius:10px;background:rgba(0,0,0,0.03);font-size:12px;color:rgba(0,0,0,0.48);">게시 버튼은 표시하지 않습니다.</div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function bagUmPost(hi, platform) {
    const item = (window._bagHistoryItems || [])[hi];
    if (!item) return;
    const caption = (document.getElementById('bag-um-caption')?.value || item.title || '').trim();
    const status = document.getElementById(`bag-um-s-${platform}`);
    const profileId = parseInt(window._globalProfileId || 0);
    if (status) { status.textContent = '게시 중...'; status.style.color = '#ff8c00'; }
    try {
      let resp;
      if (platform === 'threads') {
        resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: item.images || [], profile_id: profileId }) });
      } else if (platform === 'instagram') {
        resp = await fetch('/api/instagram/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, image_paths: item.images || [], profile_id: profileId }) });
      } else if (platform === 'twitter') {
        resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: item.images || [], profile_id: profileId }) });
      }
      const data = await resp.json();
      if (data.ok || data.success || data.post_url) { if (status) { status.textContent = '완료!'; status.style.color = '#34c759'; } }
      else { if (status) { status.textContent = data.error || '실패'; status.style.color = '#ff3b30'; } }
    } catch (e) { if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; } }
  }

  /* ── 전역 노출 ── */
  window.bagInit = bagInit;
  window.bagHistoryInit = bagHistoryInit;
  window.bagToggleSource = bagToggleSource;
  window.bagOpenNaverSearch = bagOpenNaverSearch;
  window.bagNaverSearch = bagNaverSearch;
  window.bagNaverApply = bagNaverApply;
  window.bagFetchYoutube = bagFetchYoutube;
  window.bagFetchUrl = bagFetchUrl;
  window.bagPickFile = bagPickFile;
  window.bagGenerate = bagGenerate;
  window.bagRestart = bagRestart;
  window.bagDirectTopic = bagDirectTopic;
  window.bagCopyResult = bagCopyResult;
  window.bagPublish = bagPublish;
  window.bagHistoryToggle = bagHistoryToggle;
  window.bagHistoryOpenEdit = bagHistoryOpenEdit;
  window.bagHistorySave = bagHistorySave;
  window.bagHistoryCopy = bagHistoryCopy;
  window.bagHistoryPublish = bagHistoryPublish;
  window.bagHistoryDelete = bagHistoryDelete;
  window.bagHistoryOpenUpload = bagHistoryOpenUpload;
  window.bagUmPost = bagUmPost;
})();
