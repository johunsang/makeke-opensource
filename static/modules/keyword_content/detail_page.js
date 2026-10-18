// keyword_content/detail_page.js — 상세페이지 이미지 생성/관리

// 상세페이지 이미지 생성 (본문 → 섹션별 이미지)

async function kcGenerateImageBlog(options = {}) {
  if (_kcImageBlogGenerating) { toast('이미 생성 중입니다', 'error'); return; }
  const content = document.getElementById('kc-blog-body').value.trim();
  const title = document.getElementById('kc-blog-title').value.trim();
  const sourceSummary = String(_kcPromptOverrides?.detail_page_workbench?.source_context || _kcLastPromptSourceSummary || '').trim();
  if (!content && !sourceSummary) { toast('블로그 본문이 없습니다', 'error'); return; }
  _kcImageBlogGenerating = true;
  // 즉시 버튼 표시 변경
  const imgBtn = document.querySelector('#kc-panel-detail button[onclick*="kcGenerateImageBlog"]') || document.querySelector('button[onclick*="kcGenerateImageBlog"]');
  if (imgBtn) { imgBtn.disabled = true; imgBtn.innerHTML = '<span class="spinner"></span> 생성 중...'; }

  // 블로그 본문이 있으면 블로그 기반, 없으면 핵심요약 기반 (헤딩 제거됨)
  const sectionSource = content || sourceSummary;
  const sourceParagraphs = sectionSource
    .split(/\n\s*\n/)
    .map(x => x.trim())
    .filter(x => x.length > 40);
  let fallbackTarget = 2;
  if (sourceParagraphs.length >= 4 || sectionSource.length > 1800) fallbackTarget = 3;
  if (sourceParagraphs.length >= 7 || sectionSource.length > 3200) fallbackTarget = 4;
  let sections = kcBuildBlogDrivenSections(title || kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || ''), sectionSource, fallbackTarget);

  // 핵심 요약본이 없을 때만 본문을 폴백으로 사용
  const lines = content.split('\n').filter(l => l.trim());
  let currentSection = { title: title, body: '' };
  if (!sections.length && content) {
    for (const line of lines) {
      const trimmed = line.trim();
      // 소제목 감지 (짧은 줄 + 다음 줄이 긴 내용)
      if (trimmed.length < 30 && trimmed.length > 2 && !trimmed.endsWith('.') && !trimmed.endsWith('다') && currentSection.body.length > 50) {
        sections.push({ ...currentSection });
        currentSection = { title: trimmed, body: '' };
      } else {
        currentSection.body += (currentSection.body ? '\n' : '') + trimmed;
      }
    }
    if (currentSection.body) sections.push(currentSection);
  }

  // 첫 섹션은 표지
  if (sections.length > 0 && sections[0].title === title) {
    sections[0].iscover = true;
  }

  if (!sections.length && content) {
    const paragraphs = content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 30);

    const sourceBlocks = paragraphs.length > 1 ? paragraphs : content
      .split(/(?<=[.!?।다])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    if (sourceBlocks.length > 1) {
      const grouped = [];
      const chunkSize = Math.max(1, Math.ceil(sourceBlocks.length / fallbackTarget));
      for (let i = 0; i < sourceBlocks.length; i += chunkSize) {
        grouped.push(sourceBlocks.slice(i, i + chunkSize).join('\n\n').trim());
      }
      sections = grouped
        .filter(Boolean)
        .slice(0, fallbackTarget)
        .map((body, idx) => ({
          title: idx === 0 ? title : `${title} ${idx + 1}`,
          body,
          iscover: idx === 0,
        }));
    }
  }

  if (sections.length === 0) {
    sections = [{ title: title || '상세페이지', body: sourceSummary || content, iscover: true }];
  }

  if (sections.length > fallbackTarget) {
    sections = sections.slice(0, fallbackTarget);
  }

  const usePrebuiltSlides = options.usePrebuiltSlides === true;
  const detailSlides = usePrebuiltSlides && Array.isArray(_kcPromptOverrides?.detail_page_slides) && _kcPromptOverrides.detail_page_slides.length
    ? _kcPromptOverrides.detail_page_slides
    : kcBuildDetailPromptSlides(title, sections);
  _kcDetailPromptOverrides = detailSlides;

  const resultDiv = document.getElementById('kc-image-blog-result');
  const slidesDiv = document.getElementById('kc-image-blog-slides');
  const loadingDiv = document.getElementById('kc-image-blog-loading');
  const progressSpan = document.getElementById('kc-image-blog-progress');

  resultDiv.style.display = 'block';
  loadingDiv.style.display = 'block';
  slidesDiv.innerHTML = '';
  slidesDiv.style.display = 'grid';
  slidesDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
  slidesDiv.style.gap = '14px';
  slidesDiv.style.alignItems = 'start';
  _kcImageBlogSlides = [];

  toast(`${sections.length}개 섹션 이미지 생성을 시작합니다...`);

  let imgBlogDir = '';
  let imgBlogCnId = null;  // 카드뉴스 ID (프로젝트 연결용)

  for (let i = 0; i < sections.length; i++) {
    progressSpan.textContent = `${i + 1}/${sections.length}`;
    const sec = sections[i];
    const slideData = detailSlides[i] || kcBuildDetailPromptSlides(title, [sec])[0];

    try {
      const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';

      // 선택 이미지는 한 번만 사용하고 다시 재사용하지 않음
      // 디자인 참조: 선택 이미지 > 디자인 참조 선택 > 프로필 디자인 참조 (자동)
      const selImgs = kcGetSelectedImageUrls();
      const profileId = parseInt(window._globalProfileId || 0);
      const profile = window._globalProfileData || {};
      const logoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
      const logoEnabled = !!(getOpt('logo_insert') && logoUrl);
      let userImg = '';
      if (selImgs.length > 0) {
        userImg = selImgs[i % selImgs.length] || '';
      } else if (_kcSelectedDesignRef) {
        userImg = _kcSelectedDesignRef;
      }
      // profile_id가 있으면 서버에서 프로필 디자인 참조를 자동으로 사용함

      const res = await api('/api/cardnews/generate-single', {
        method: 'POST',
        body: {
          slide: slideData,
          topic: title,
          style: window._contentOpts?.cn_style || getOpt('cn_style', 'modern'),
          aspect_ratio: '9:16',
          project_dir: imgBlogDir || '',
          cardnews_id: imgBlogCnId || null,
          brand_name: brandName,
          brand_logo_url: logoUrl,
          logo_enabled: logoEnabled,
          logo_text: '',
          image_size: window._contentOpts?.cn_resolution || getOpt('cn_resolution', '1K'),
          image_provider: window._contentOpts?.image_provider || '',
          image_model: window._contentOpts?.image_model || '',
          user_image_url: userImg,
          user_image_urls: selImgs,
          design_ref_url: _kcSelectedDesignRef || '',
          profile_id: parseInt(window._globalProfileId || 0),
          use_profile_design_ref: !userImg && !_kcSelectedDesignRef,
        },
      });
      if (!imgBlogDir && res.project_dir) { imgBlogDir = res.project_dir; window._kcImgBlogDir = imgBlogDir; }
      if (!imgBlogCnId && res.cardnews_id) imgBlogCnId = res.cardnews_id;

      if (res.image_url) {
        const imgUrl = `${encImg('/api/cardnews/image/' + res.image_url)}?t=${Date.now()}`;
        _kcImageBlogSlides.push(imgUrl);
        slidesDiv.innerHTML += `<div id="kc-detail-slide-${i}" style="position:relative;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:16px;padding:12px;box-shadow:0 10px 24px rgba(15,23,42,0.05);">
          <div style="font-size:12px;font-weight:800;color:#1c1c1e;margin-bottom:8px;">${i + 1}장 · ${escapeHtml(sec.title || `상세페이지 ${i + 1}`)}</div>
          <img src="${imgUrl}" style="display:block;width:100%;border-radius:12px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;background:#f5f5f7;min-height:220px;object-fit:cover;" onclick="kcShowImagePreview(this.src)">
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px;">
            <button onclick="kcRegenDetailSlide(${i})" style="padding:6px 10px;font-size:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 생성</button>
            <a href="${imgUrl}" download="detail_${i+1}.png" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.06);color:#1c1c1e;border-radius:8px;text-decoration:none;">다운로드</a>
          </div>
        </div>`;
      }
    } catch (e) {
      console.error(`섹션 ${i + 1} 이미지 생성 실패:`, e);
      slidesDiv.innerHTML += `<div id="kc-detail-slide-${i}" style="padding:20px;text-align:center;background:rgba(0,0,0,0.03);border:1px dashed rgba(255,59,48,0.3);border-radius:16px;">
        <div style="color:#ff3b30;font-size:13px;font-weight:600;margin-bottom:8px;">섹션 ${i + 1} 실패</div>
        <div style="color:rgba(0,0,0,0.4);font-size:11px;margin-bottom:10px;">${escapeHtml(e.message).substring(0,50)}</div>
        <button onclick="kcRegenDetailSlide(${i})" style="padding:6px 14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 생성</button>
      </div>`;
    }
  }

  loadingDiv.style.display = 'none';
  _kcImageBlogGenerating = false;
  if (imgBtn) { imgBtn.disabled = false; imgBtn.innerHTML = '상세페이지 이미지 생성'; }

  // 프로젝트에 detail_page_dir 저장 (상세페이지 이미지)
  if (_kcProjectId && imgBlogDir) {
    api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { detail_page_dir: imgBlogDir } }).catch(() => {});
  }

  kcRevealGeneratedContent('detail');
  toast(`상세페이지 이미지 ${_kcImageBlogSlides.length}장 생성 완료!`);
  return true;
}

// 이미지로 네이버 발행
function kcOpenDetailFolder() {
  // imgBlogDir 또는 _kcCardnewsDir로 정확한 폴더 열기
  const dir = window._kcImgBlogDir || _kcCardnewsDir || 'output/cardnews';
  api('/api/open-folder', { method: 'POST', body: { folder: dir } }).then(() => toast('폴더 열림')).catch(() => toast('폴더 열기 실패', 'error'));
}

function kcOpenCardnewsFolder() {
  const dir = _kcCardnewsDir || 'output/cardnews';
  api('/api/open-folder', { method: 'POST', body: { folder: dir } }).then(() => toast('폴더 열림')).catch(() => toast('폴더 열기 실패', 'error'));
}

function kcRefreshCardnewsFolderHint() {
  const hintEl = document.getElementById('kc-cn-folder-hint');
  if (!hintEl) return;
  const rawDir = (_kcCardnewsDir || 'output/cardnews').replace(/\\/g, '/');
  const parts = rawDir.split('/');
  const leaf = parts[parts.length - 1] || 'cardnews';
  hintEl.textContent = `저장 위치: ${leaf}`;
}

async function kcRegenDetailSlide(idx) {
  if (!_kcDetailPromptOverrides[idx]) { toast('슬라이드 데이터가 없습니다', 'error'); return; }
  const slideData = _kcDetailPromptOverrides[idx];
  const title = document.getElementById('kc-blog-title')?.value?.trim() || '';
  const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';

  const container = document.getElementById('kc-detail-slide-' + idx);
  if (container) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:180px;flex-direction:column;"><span class="spinner"></span><div style="font-size:11px;color:rgba(0,0,0,0.4);margin-top:6px;">재생성 중...</div></div>';
    container.style.border = '1px solid rgba(0,0,0,0.08)';
    container.style.background = '#f5f5f7';
  }

  try {
    const selectedImages = kcGetSelectedImageUrls();
    const profileId = parseInt(window._globalProfileId || 0);
    const profile = window._globalProfileData || {};
    const logoUrl = profile.logo_path && profileId ? encImg('/api/library/image/' + profileId + '/' + profile.logo_path) : '';
    const logoEnabled = !!(getOpt('logo_insert') && logoUrl);
    const res = await api('/api/cardnews/generate-single', {
      method: 'POST',
      body: {
        slide: slideData,
        topic: title,
        style: window._contentOpts?.cn_style || getOpt('cn_style', 'modern'),
        aspect_ratio: '9:16',
        project_dir: window._kcImgBlogDir || '',
        brand_name: brandName,
        brand_logo_url: logoUrl,
        logo_enabled: logoEnabled,
        logo_text: '',
        image_size: window._contentOpts?.cn_resolution || getOpt('cn_resolution', '1K'),
        image_provider: window._contentOpts?.image_provider || '',
        image_model: window._contentOpts?.image_model || '',
        user_image_url: selectedImages[idx % Math.max(1, selectedImages.length)] || '',
        user_image_urls: selectedImages,
        design_ref_url: _kcSelectedDesignRef || '',
        profile_id: parseInt(window._globalProfileId || 0),
        use_profile_design_ref: selectedImages.length === 0 && !_kcSelectedDesignRef,
      },
    });

    if (res.image_url) {
      if (!window._kcImgBlogDir && res.project_dir) window._kcImgBlogDir = res.project_dir;
      const imgUrl = `${encImg('/api/cardnews/image/' + res.image_url)}?t=${Date.now()}`;
      _kcImageBlogSlides[idx] = imgUrl;
      const secTitle = slideData.title || `상세페이지 ${idx + 1}`;
      if (container) {
        container.style.background = '';
        container.innerHTML = `
          <div style="font-size:12px;font-weight:800;color:#1c1c1e;margin-bottom:8px;">${idx + 1}장 · ${escapeHtml(secTitle)}</div>
          <img src="${imgUrl}" style="display:block;width:100%;border-radius:12px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;background:#f5f5f7;min-height:220px;object-fit:cover;" onclick="kcShowImagePreview(this.src)">
          <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:10px;">
            <button onclick="kcRegenDetailSlide(${idx})" style="padding:6px 10px;font-size:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 생성</button>
            <a href="${imgUrl}" download="detail_${idx+1}.png" style="padding:6px 10px;font-size:11px;background:rgba(0,0,0,0.06);color:#1c1c1e;border-radius:8px;text-decoration:none;">다운로드</a>
          </div>`;
      }
      toast(`상세페이지 ${idx + 1}장 재생성 완료!`);
    } else {
      throw new Error('이미지 없음');
    }
  } catch (e) {
    if (container) {
      container.style.background = '';
      container.innerHTML = `<div style="padding:20px;text-align:center;">
        <div style="color:#ff3b30;font-size:12px;margin-bottom:8px;">재생성 실패: ${escapeHtml(e.message).substring(0,50)}</div>
        <button onclick="kcRegenDetailSlide(${idx})" style="padding:6px 14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>다시 시도</button>
      </div>`;
    }
    toast(`상세페이지 ${idx + 1}장 재생성 실패: ${e.message}`, 'error');
  }
}

function kcDownloadAllDetailImages() {
  if (_kcImageBlogSlides.length === 0) { toast('다운로드할 이미지가 없습니다', 'error'); return; }
  _kcImageBlogSlides.forEach((url, i) => {
    const a = document.createElement('a');
    a.href = url.split('?')[0];
    a.download = `detail_page_${i+1}.png`;
    a.click();
  });
  toast(`${_kcImageBlogSlides.length}장 다운로드 시작`);
}
