// ============================================================
// 상품 콘텐츠 자동 생성
// ============================================================

let _scrapedProduct = null;  // 스크래핑된 상품 데이터
let _productBlogPostId = null;  // 생성된 블로그 post ID
let _productCardnewsDir = '';  // 카드뉴스 디렉토리

async function scrapeProduct() {
  const url = document.getElementById('product-url').value.trim();
  if (!url) { toast('상품 URL을 입력하세요', 'error'); return; }
  if (!url.startsWith('http')) { toast('올바른 URL을 입력하세요 (https://...)', 'error'); return; }

  const btn = document.getElementById('btn-scrape-product');
  const loading = document.getElementById('product-scrape-loading');
  btn.disabled = true;
  loading.style.display = 'block';
  document.getElementById('product-result-card').style.display = 'none';
  document.getElementById('product-gen-result-card').style.display = 'none';

  try {
    const res = await api('/api/product/scrape', {
      method: 'POST',
      body: { url },
    });

    _scrapedProduct = res.data;
    renderProductResult(_scrapedProduct);
    document.getElementById('product-result-card').style.display = 'block';
    document.getElementById('product-result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`상품 정보를 가져왔습니다! (${_scrapedProduct.platform})`);
  } catch (e) {
    toast('스크래핑 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

async function scrapeProductChrome() {
  const url = document.getElementById('product-url').value.trim();
  if (!url) { toast('상품 URL을 입력하세요', 'error'); return; }
  if (!url.startsWith('http')) { toast('올바른 URL을 입력하세요 (https://...)', 'error'); return; }

  const btn = document.getElementById('btn-scrape-chrome');
  const loading = document.getElementById('product-scrape-loading');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="display:none;"></span> Chrome으로 수집 중...';
  loading.style.display = 'block';
  loading.innerHTML = '<span class="spinner"></span> Chrome 브라우저로 페이지를 렌더링하고 있습니다... (JS 렌더링 포함)';
  document.getElementById('product-result-card').style.display = 'none';
  document.getElementById('product-gen-result-card').style.display = 'none';

  try {
    const res = await api('/api/product/scrape', {
      method: 'POST',
      body: { url, use_chrome: true },
    });

    _scrapedProduct = res.data;
    renderProductResult(_scrapedProduct);
    document.getElementById('product-result-card').style.display = 'block';
    document.getElementById('product-result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`Chrome으로 상품 정보를 가져왔습니다! (${_scrapedProduct.platform})`);
  } catch (e) {
    toast('Chrome 스크래핑 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg> Chrome으로 가져오기';
    loading.style.display = 'none';
  }
}

function renderProductResult(product) {
  // 플랫폼 배지
  const platformNames = {
    cafe24: 'Cafe24', godo: '고도몰', makeshop: '메이크샵',
    coupang: '쿠팡', '11st': '11번가', naver_smartstore: '스마트스토어',
    generic: '일반',
  };
  const badge = document.getElementById('product-platform-badge');
  badge.textContent = platformNames[product.platform] || product.platform;

  // 기본 정보
  document.getElementById('product-name').textContent = product.name || '(이름 없음)';

  // 가격
  let priceText = product.price || '';
  if (product.original_price) {
    priceText += ` (정가 ${product.original_price})`;
  }
  document.getElementById('product-price').textContent = priceText || '(가격 정보 없음)';

  document.getElementById('product-category').textContent = product.category || '-';
  document.getElementById('product-brand').textContent = product.brand || '-';
  document.getElementById('product-options').textContent = (product.options || []).join(', ') || '-';
  document.getElementById('product-description').value = product.description || '';

  // 이미지 갤러리 (제외 기능 포함)
  const gallery = document.getElementById('product-images-gallery');
  const images = product.local_images || product.images || [];
  window._productExcludedImages = new Set();
  if (images.length > 0) {
    gallery.innerHTML = images.map((img, idx) => {
      const src = img.startsWith('http') ? img : `${encImg('/api/product/image/'+img)}`;
      return `<div id="product-img-wrap-${idx}" style="position:relative;display:inline-block;flex-shrink:0;" data-img="${escapeHtml(img)}">
        <img src="${src}" id="product-img-${idx}" style="height:160px;width:auto;border-radius:10px;border:2px solid rgba(91,155,245,0.4);object-fit:cover;cursor:pointer;transition:all 0.2s;"
                   onclick="window.open('${src}','_blank')" onerror="this.parentElement.style.display='none'">
        <button onclick="event.stopPropagation();toggleProductImage(${idx},'${escapeHtml(img)}')"
                style="position:absolute;top:6px;right:6px;padding:3px 8px;background:rgba(255,69,58,0.85);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-weight:600;backdrop-filter:blur(4px);"
                id="product-img-btn-${idx}">제외</button>
        <button onclick="event.stopPropagation();openImageEditor('${src}',{context:'product',onSave:function(data){toast('편집된 이미지가 저장되었습니다.');}})" style="position:absolute;bottom:6px;right:6px;padding:3px 8px;background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:4px;font-size:10px;cursor:pointer;">편집</button>
      </div>`;
    }).join('');
  } else {
    gallery.innerHTML = '<div style="padding:40px;text-align:center;color:#6b7f8e;width:100%;background:#0f1923;border-radius:10px;">이미지를 찾을 수 없습니다</div>';
  }

  // 태그 기본값 설정
  const tagInput = document.getElementById('product-blog-tags');
  if (tagInput) {
    const tags = [product.name, product.brand, product.category].filter(Boolean);
    tagInput.value = tags.join(', ');
  }
}

async function generateProductContent() {
  if (!_scrapedProduct) { toast('먼저 상품 정보를 가져오세요', 'error'); return; }

  const genBlog = document.getElementById('product-gen-blog').checked;
  const genCardnews = document.getElementById('product-gen-cardnews').checked;
  const genVideo = document.getElementById('product-gen-video').checked;
  if (!genBlog && !genCardnews && !genVideo) { toast('생성할 콘텐츠를 선택하세요', 'error'); return; }

  // 편집된 설명 반영
  _scrapedProduct.description = document.getElementById('product-description').value;

  const btn = document.getElementById('btn-generate-product');
  const loading = document.getElementById('product-gen-loading');
  btn.disabled = true;
  loading.style.display = 'block';
  document.getElementById('product-gen-result-card').style.display = 'none';

  try {
    const res = await api('/api/product/generate', {
      method: 'POST',
      body: {
        product: _scrapedProduct,
        generate_blog: genBlog,
        generate_cardnews: genCardnews,
        tone: document.getElementById('product-tone').value,
        cardnews_style: document.getElementById('product-cn-style').value,
        cardnews_slides: 5,
      },
    });

    document.getElementById('product-gen-result-card').style.display = 'block';

    // 블로그 결과
    const blogResult = document.getElementById('product-blog-result');
    if (res.blog && !res.blog.error) {
      _productBlogPostId = res.blog.post_id;
      document.getElementById('product-blog-title').value = res.blog.title;
      document.getElementById('product-blog-body').value = res.blog.body;
      document.getElementById('product-blog-chars').textContent = res.blog.char_count;
      // 태그
      const tags = [_scrapedProduct.name, _scrapedProduct.brand, _scrapedProduct.category].filter(Boolean);
      document.getElementById('product-blog-tags').value = tags.join(', ');
      blogResult.style.display = 'block';
      toast('블로그 글 생성 완료!');
    } else if (res.blog && res.blog.error) {
      blogResult.style.display = 'block';
      blogResult.innerHTML = `<h3 style="color:#e05c5c;font-size:15px;">블로그 글 생성 실패</h3><p style="color:#6b7f8e;font-size:13px;">${escapeHtml(res.blog.error)}</p>`;
    } else {
      blogResult.style.display = 'none';
    }

    // 카드뉴스 결과
    const cnResult = document.getElementById('product-cardnews-result');
    if (res.cardnews && !res.cardnews.error) {
      _productCardnewsDir = res.cardnews.project_dir;
      const slidesContainer = document.getElementById('product-cardnews-slides');
      const slides = res.cardnews.slides || [];
      slidesContainer.innerHTML = slides.map(s => {
        if (s.status === 'ok' && s.image_path) {
          const dirParts = res.cardnews.project_dir.split('/cardnews/');
          const relDir = dirParts.length > 1 ? dirParts[1] : '';
          const imgFile = s.image_path.split('/').pop();
          const fullUrl = encImg('/api/cardnews/image/'+relDir+'/'+imgFile);
          return `<img src="${fullUrl}"
                       style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:transform 0.2s;"
                       onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"
                       onclick="kcShowImagePreview(this.src)"
                       onerror="this.outerHTML='<div style=\\'padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;background:rgba(44,44,46,0.5);border-radius:8px;\\'>이미지 없음</div>'">`;
        }
        return `<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;background:rgba(44,44,46,0.5);border-radius:8px;">
                  슬라이드 ${s.slide_number}: ${s.title || ''}</div>`;
      }).join('');
      cnResult.style.display = 'block';
      toast(`카드뉴스 생성 완료! (${res.cardnews.success_count}/${res.cardnews.slide_count}장)`);
    } else if (res.cardnews && res.cardnews.error) {
      cnResult.style.display = 'block';
      cnResult.innerHTML = `<h3 style="color:#e05c5c;font-size:15px;">카드뉴스 생성 실패</h3><p style="color:#6b7f8e;font-size:13px;">${escapeHtml(res.cardnews.error)}</p>`;
    } else {
      cnResult.style.display = 'none';
    }

    // 홍보 영상 생성 (Veo 3.1 — TTS 없이 Veo 자체 오디오 사용)
    if (genVideo) {
      loading.style.display = 'block';
      loading.innerHTML = '<span class="spinner"></span> Veo 3.1로 홍보 영상 생성 중... (장면당 1~5분 소요)';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> 영상 생성 중...';
      try {
        const scenes = parseInt(document.getElementById('product-scenes').value);
        const productText = res.blog
          ? res.blog.content.substring(0, 3000)
          : `상품명: ${_scrapedProduct.name}\n가격: ${_scrapedProduct.price}\n설명: ${_scrapedProduct.description}`;

        const pVeoModel = document.getElementById('product-veo-model')?.value || 'veo-3.1-generate-preview';
        const pSubtitle = document.getElementById('product-subtitle')?.value || 'promo';
        const pNarration = document.getElementById('product-narration')?.value || 'on';
        const pVoice = pNarration === 'on' ? 'gemini-Kore' : '';
        // 상품 이미지를 Veo에 전달 — 제외된 이미지 필터링
        const excluded = window._productExcludedImages || new Set();
        const productImages = (_scrapedProduct.images || []).filter(img => img && !img.includes('icon') && !img.includes('logo') && !excluded.has(img));
        const vidRes = await api('/api/video/create', {
          method: 'POST',
          body: { source: 'text', method: 'veo3', topic: _scrapedProduct.name, source_text: productText, scene_count: scenes, veo_model: pVeoModel, subtitle_style: pSubtitle, narration_mode: pNarration, voice: pVoice, images: productImages },
        });
        if (vidRes.video_path) {
          const vp = vidRes.video_path.split('/videos/');
          const vidHtml = `
            <div id="product-video-result" style="margin-top:20px;">
              <h3 style="color:#5b9bf5;font-size:15px;margin-bottom:12px;">홍보 영상</h3>
              <div style="background:rgba(44,44,46,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:20px;">
                <video src="/api/videos/play/${vp[1] || ''}" controls style="width:100%;max-width:360px;border-radius:12px;background:#000;"></video>
                <div class="btn-group" style="margin-top:12px;">
                                    <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:'output/videos'}}).then(()=>toast('폴더 열림'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>폴더 열기</button>
                </div>
              </div>
            </div>`;
          document.getElementById('product-gen-result-card').insertAdjacentHTML('beforeend', vidHtml);
          toast('홍보 영상 생성 완료!');
        }
      } catch (e) {
        let pConsoleHtml = '';
        if (e.traceback) {
          pConsoleHtml = `
            <div id="product-video-error" style="margin-top:20px;">
              <details open style="margin-top:8px;">
                <summary style="cursor:pointer;font-size:13px;font-weight:600;color:#ff9f0a;margin-bottom:8px;">서버 콘솔 로그</summary>
                <pre style="background:#1a1a2e;color:#e0e0e0;padding:14px;border-radius:10px;font-size:11.5px;line-height:1.6;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;border:1px solid rgba(255,159,10,0.2);">${escapeHtml(e.traceback)}</pre>
              </details>
            </div>`;
          document.getElementById('product-gen-result-card').insertAdjacentHTML('beforeend', pConsoleHtml);
        }
        toast('영상 생성 실패: ' + e.message, 'error');
      }
    }

    document.getElementById('product-gen-result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    toast('콘텐츠 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

async function publishProductBlog() {
  const blogId = getBlogId();
  if (!blogId) {
    toast('상단에 네이버 블로그 주소를 먼저 입력하세요!', 'error');
    /* blog url은 설정에서 관리 */
    return;
  }
  const title = document.getElementById('product-blog-title').value.trim();
  const content = document.getElementById('product-blog-body').value.trim();
  const tagStr = document.getElementById('product-blog-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!title || !content) { toast('제목과 본문을 입력하세요', 'error'); return; }
  if (!confirm(`네이버 블로그(${blogId})에 발행할까요?\n\n제목: ${title}\n태그: ${tags.join(', ')}`)) return;

  try {
    await api('/api/blog/publish', {
      method: 'POST',
      body: { post_id: _productBlogPostId, title, content, tags },
    });
    toast('네이버 블로그에 발행 완료!');
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

function copyProductBlog() {
  const title = document.getElementById('product-blog-title').value;
  const body = document.getElementById('product-blog-body').value;
  const text = title + '\n\n' + body;
  navigator.clipboard.writeText(text);
  toast('블로그 글이 클립보드에 복사되었습니다.');
}

async function uploadProductCardnews() {
  if (!_productCardnewsDir) { toast('먼저 카드뉴스를 생성하세요', 'error'); return; }

  const productName = _scrapedProduct ? _scrapedProduct.name : '';
  const caption = prompt('인스타그램 캡션을 입력하세요:', `${productName}\n\n#상품추천 #쇼핑 #${productName.replace(/\s+/g, '')}`);
  if (caption === null) return;

  try {
    toast('인스타그램 업로드 시작...');
    await api('/api/instagram/upload', {
      method: 'POST',
      body: { project_dir: _productCardnewsDir, caption },
    });
    toast('인스타그램 업로드 완료!');
  } catch (e) {
    toast('인스타 업로드 실패: ' + e.message, 'error');
  }
}

