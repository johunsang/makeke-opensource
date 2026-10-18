// keyword_content/sources/quick_actions.js — URL 인라인 스크래핑, 빠른 카드뉴스/만화, qs-btn 전역 핸들러

// 이미지 크기순 정렬
function kcSortImages(sourceIdx) {
  if (_sortTimers[sourceIdx]) clearTimeout(_sortTimers[sourceIdx]);
  _sortTimers[sourceIdx] = setTimeout(() => {
    const grid = document.getElementById('kc-img-grid-' + sourceIdx);
    if (!grid) return;
    const items = [...grid.children].filter(el => el.style.display !== 'none');
    items.sort((a, b) => {
      const imgA = a.querySelector('img'), imgB = b.querySelector('img');
      const sizeA = (parseInt(imgA?.dataset.w) || 0) * (parseInt(imgA?.dataset.h) || 0);
      const sizeB = (parseInt(imgB?.dataset.w) || 0) * (parseInt(imgB?.dataset.h) || 0);
      return sizeB - sizeA;
    });
    items.forEach(el => grid.appendChild(el));
  }, 500);
}

// URL을 소스에 추가 → 2단계로 이동
async function kcAddUrlAsSource() {
  const url = document.getElementById('kc-product-url').value.trim();
  if (!url || !url.startsWith('http')) { toast('URL을 입력하세요', 'error'); return; }

  _kcSearchData = _kcSearchData || { keyword: url, sources: [] };
  _kcSelectedSources.push({
    title: url,
    url: url,
    source: '',
    type: 'url',
    checked: true,
  });

  document.getElementById('kc-keyword').value = document.getElementById('kc-keyword').value || url.replace(/https?:\/\//, '').split('/')[0];
  kcRenderSourcesList();
  kcGoToStep(2);
  toast('URL 추가됨 → 본문 수집 중...');

  // 자동 스크래핑
  const idx = _kcSelectedSources.length - 1;
  kcScrapeArticle(idx);
}

// 이전 설정 버튼은 세션 중 저장했을 때만 노출

// 모든 qs-btn 클릭 시 체크박스/라디오 토글 + qs-active (단일 핸들러)
document.addEventListener('click', e => {
  const btn = e.target.closest('.qs-btn');
  if (!btn) return;

  // 1단계 스타일 (단일 선택, data-style)
  if (btn.dataset.style) {
    document.querySelectorAll('#kc-style-grid .qs-btn').forEach(b => b.classList.remove('qs-active'));
    btn.classList.add('qs-active');
    document.getElementById('kc-quick-style').value = btn.dataset.style;
    return;
  }

  // 체크박스 처리
  const cb = btn.querySelector('input[type="checkbox"]');
  if (cb) {
    // display:none인 체크박스는 브라우저가 자동 토글하지 않으므로 수동 토글
    if (cb.style.display === 'none') {
      e.preventDefault();
      cb.checked = !cb.checked;
    }
    // 보이는 체크박스(mystyle 등)는 브라우저가 이미 토글 → 그대로 사용
    btn.classList.toggle('qs-active', cb.checked);
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // 라디오 처리
  const radio = btn.querySelector('input[type="radio"]');
  if (radio) {
    radio.checked = true;
    document.querySelectorAll(`input[name="${radio.name}"]`).forEach(r => {
      r.closest('.qs-btn')?.classList.toggle('qs-active', r.checked);
    });
    return;
  }
});

// 만화 빠른 생성
async function kcQuickComic() {
  const topic = document.getElementById('kc-keyword').value.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }
  const btn = document.getElementById('kc-quick-comic-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';
  try {
    const comicStyle = window._contentOpts?.comic_style || 'cute';
    const logoEnabled = !!getOpt('logo_insert');
    const res = await api('/api/comic/generate', {
      method: 'POST',
      body: {
        topic,
        style: comicStyle,
        layout: '2x2',
        profile_id: parseInt(window._globalProfileId || 0),
        logo_enabled: logoEnabled,
        logo_text: '',
      }
    });
    toast(`만화 ${res.success_count}/${res.panel_count}컷 생성 완료!`);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-comic-gallery').classList.add('active');
  } catch (e) {
    toast('만화 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '만화';
  }
}

// URL 인라인 스크래핑 + 생성
async function kcInlineScrape(useChrome) {
  const url = document.getElementById('kc-product-url').value.trim();
  if (!url) { toast('URL을 입력하세요', 'error'); return; }

  const btn = document.getElementById('kc-url-scrape-btn');
  const result = document.getElementById('kc-url-result');
  const content = document.getElementById('kc-url-result-content');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span>';
  result.style.display = 'block';
  content.innerHTML = '<div style="text-align:center;padding:16px;"><span class="spinner"></span> 페이지 분석 중...</div>';

  try {
    const res = await api('/api/product/scrape', { method: 'POST', body: { url, use_chrome: useChrome } });
    _kcScrapedProduct = res.data;
    const p = _kcScrapedProduct;

    // 이미지 갤러리
    const images = p.local_images || p.images || [];
    const imgHtml = images.length > 0
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;">${images.slice(0, 10).map(img => {
          const src = img.startsWith('http') ? img : '/api/product/image/' + encodeURIComponent(img);
          return `<img src="${src}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.08);" onerror="this.style.display='none'"
                   onmouseenter="kcShowImageHover(this,'${src.replace(/'/g,"\\'")}')" onmouseleave="kcHideImageHover()">`;
        }).join('')}${images.length > 10 ? `<span style="font-size:11px;color:rgba(255,255,255,0.3);align-self:center;">+${images.length-10}</span>` : ''}</div>`
      : '';

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;color:#f5f5f7;margin-bottom:4px;">${escapeHtml(p.name || '제목 없음')}</div>
          <div style="font-size:13px;color:#5b9bf5;margin-bottom:4px;">${escapeHtml(p.price || '')} ${p.platform ? '<span style="font-size:11px;color:rgba(255,255,255,0.3);">(' + escapeHtml(p.platform) + ')</span>' : ''}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.4);max-height:60px;overflow:hidden;">${escapeHtml((p.description || '').substring(0, 150))}</div>
        </div>
      </div>
      ${imgHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);"><input type="checkbox" id="kc-url-gen-blog" checked style="accent-color:#5b9bf5;"> 블로그</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);"><input type="checkbox" id="kc-url-gen-cn" checked style="accent-color:#f5a623;"> 카드뉴스</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,0.5);"><input type="checkbox" id="kc-url-gen-video" style="accent-color:#a855f7;"> 영상</label>
        <button class="btn btn-primary btn-sm" onclick="kcInlineGenerate()" id="kc-url-gen-btn" style="margin-left:auto;font-weight:600;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>가져온 자료로 생성</button>
      </div>
      <div id="kc-url-gen-result" style="margin-top:12px;"></div>`;
    toast(`${p.name || 'URL'} 정보 가져옴!`);
  } catch (e) {
    content.innerHTML = `<div style="color:#ff453a;font-size:13px;">스크래핑 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '가져오기';
  }
}

async function kcInlineGenerate() {
  if (!_kcScrapedProduct) return;
  const btn = document.getElementById('kc-url-gen-btn');
  const result = document.getElementById('kc-url-gen-result');
  const genBlog = document.getElementById('kc-url-gen-blog').checked;
  const genCn = document.getElementById('kc-url-gen-cn').checked;
  const genVideo = document.getElementById('kc-url-gen-video').checked;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';
  result.innerHTML = '';

  try {
    const res = await api('/api/product/generate', {
      method: 'POST',
      body: {
        product: _kcScrapedProduct,
        generate_blog: genBlog,
        generate_cardnews: genCn,
        generate_video: genVideo,
      },
    });

    let html = '';
    if (res.blog && !res.blog.error) {
      html += `<div style="margin-bottom:10px;padding:10px;background:rgba(79,192,141,0.08);border-radius:8px;">
        <span style="font-size:12px;font-weight:600;color:#4fc08d;">블로그 생성 완료</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.3);margin-left:8px;">${(res.blog.content || '').length}자</span>
      </div>`;
    }
    if (res.cardnews && !res.cardnews.error) {
      html += `<div style="margin-bottom:10px;padding:10px;background:rgba(245,166,35,0.08);border-radius:8px;">
        <span style="font-size:12px;font-weight:600;color:#f5a623;">카드뉴스 생성 완료</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.3);margin-left:8px;">${res.cardnews.success_count || 0}장</span>
      </div>`;
    }
    if (res.video && !res.video.error && res.video.video_path) {
      const vp = res.video.video_path.split('/videos/');
      html += `<div style="margin-bottom:10px;padding:10px;background:rgba(168,85,247,0.08);border-radius:8px;">
        <span style="font-size:12px;font-weight:600;color:#a855f7;">영상 생성 완료</span>
        <video src="/api/videos/play/${vp[1] || ''}" controls style="width:100%;max-width:300px;border-radius:8px;margin-top:8px;"></video>
      </div>`;
    }
    result.innerHTML = html || '<div style="color:rgba(255,255,255,0.3);font-size:12px;">생성된 콘텐츠가 없습니다.</div>';
    toast('콘텐츠 생성 완료!');
  } catch (e) {
    result.innerHTML = `<div style="color:#ff453a;font-size:12px;">생성 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '콘텐츠 생성';
  }
}

// 카드뉴스 빠른 생성 (검색 없이)
async function kcQuickCardnews() {
  const topic = document.getElementById('kc-keyword').value.trim();
  if (!topic) { toast('주제를 입력하세요', 'error'); return; }
  kcSavePrevSettings();
  const style = document.getElementById('kc-quick-style').value;
  const slideCount = parseInt(document.getElementById('kc-quick-slides').value);

  const btn = document.getElementById('kc-quick-cn-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 텍스트 생성 중...';

  try {
    // 1. 텍스트 생성
    const textRes = await api('/api/cardnews/texts', {
      method: 'POST',
      body: { topic, slide_count: slideCount, style, aspect_ratio: '1:1' },
    });

    toast('카드뉴스 텍스트 생성 완료! 이미지 생성 중...');
    btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 이미지 생성 중...';

    // 2. 이미지 순차 생성
    const slides = textRes.slides || [];
    const projectDir = textRes.project_dir || '';
    const cardnewsId = textRes.cardnews_id;
    let successCount = 0;

    for (let i = 0; i < slides.length; i++) {
      btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;"></span> 이미지 ${i+1}/${slides.length}...`;
      try {
        // 브랜드 정보 (라이브러리에서 선택된 프로필)
        const kcBrand = document.getElementById('kc-brand-name')?.value || '';
        await api('/api/cardnews/generate-single', {
          method: 'POST',
          body: {
            slide: slides[i],
            topic,
            style,
            aspect_ratio: '1:1',
            project_dir: projectDir,
            cardnews_id: cardnewsId,
            brand_name: kcBrand,
            image_provider: window._contentOpts?.image_provider || '',
            image_model: window._contentOpts?.image_model || '',
            user_image_url: kcGetSelectedImageUrls()[i % Math.max(1, kcGetSelectedImageUrls().length)] || '',
            user_image_urls: kcGetSelectedImageUrls(),
            design_ref_url: _kcSelectedDesignRef || '',
            profile_id: parseInt(window._globalProfileId || 0),
            use_profile_design_ref: kcGetSelectedImageUrls().length === 0 && !_kcSelectedDesignRef,
          },
        });
        successCount++;
      } catch {}
    }

    toast(`카드뉴스 ${successCount}/${slides.length}장 생성 완료!`);

    // 카드뉴스 갤러리로 이동
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-cardnews-gallery').classList.add('active');
  } catch (e) {
    toast('카드뉴스 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '카드뉴스 생성';
  }
}
