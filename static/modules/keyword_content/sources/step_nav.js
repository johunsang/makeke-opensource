// keyword_content/sources/step_nav.js — 1~5단계 내비게이션, Step 5 업로드 UI

function _kcForceShowStep(step) {
  _kcCurrentStep = step;
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById('kc-card-' + i);
    if (card) card.style.display = i === step ? 'block' : 'none';
  }
  if (step === 5) kcInitUploadStep();
  // 인디케이터 업데이트
  [1,2,3,4,5].forEach((s, idx) => {
    const numEl = document.getElementById('kc-step-num-' + s);
    const labelEl = document.getElementById('kc-step-label-' + s);
    const lineFill = idx > 0 ? document.getElementById('kc-step-line-fill-' + idx) : null;
    const stepIdx = step - 1;
    if (idx < stepIdx) {
      if (numEl) { numEl.style.background = '#34c759'; numEl.style.color = '#fff'; numEl.textContent = '\u2713'; numEl.style.boxShadow = '0 2px 8px rgba(52,199,89,0.3)'; }
      if (labelEl) labelEl.style.color = '#34c759';
      if (lineFill) lineFill.style.width = '100%';
    } else if (idx === stepIdx) {
      if (numEl) { numEl.style.background = '#34c759'; numEl.style.color = '#fff'; numEl.textContent = idx + 1; numEl.style.boxShadow = '0 2px 8px rgba(52,199,89,0.3)'; }
      if (labelEl) labelEl.style.color = '#34c759';
      if (lineFill) lineFill.style.width = '100%';
    } else {
      if (numEl) { numEl.style.background = 'rgba(0,0,0,0.06)'; numEl.style.color = 'rgba(0,0,0,0.3)'; numEl.textContent = idx + 1; numEl.style.boxShadow = 'none'; }
      if (labelEl) labelEl.style.color = 'rgba(0,0,0,0.3)';
      if (lineFill) lineFill.style.width = '0%';
    }
  });
}
function kcGoToUploadFromHistory(keyword, projectId) {
  if (keyword) {
    const el = document.getElementById('kc-keyword');
    if (el) el.value = keyword;
  }
  if (projectId) {
    _kcProjectId = projectId;
  }
  navigateToPage('keyword-content', { skipConfirm: true });
  setTimeout(() => _kcForceShowStep(5), 300);
}
function kcGoToSourceFromHistory(keyword) {
  if (keyword) {
    const el = document.getElementById('kc-keyword');
    if (el) el.value = keyword;
  }
  navigateToPage('keyword-content', { skipConfirm: true });
  setTimeout(() => _kcForceShowStep(1), 300);
}

async function kcGoToStep(step) {
  // 스텝 유효성 체크
  if (step >= 2 && !_kcSearchData && _kcSelectedSources.length === 0) { toast('먼저 키워드를 검색하세요', 'error'); return; }

  if (step === 4 && !_kcPromptReviewed) {
    // 이미 생성 결과가 있으면 프롬프트 확인 없이 4단계 진입 허용
    const hasResult = !!(document.getElementById('kc-blog-title')?.value?.trim()) || !!_kcCardnewsDir;
    const cameFromPromptStep = _kcCurrentStep === 3;
    if (hasResult || cameFromPromptStep) {
      _kcPromptReviewed = true;
    } else {
      toast('먼저 3단계에서 프롬프트를 확인하세요', 'error');
      return kcGoToStep(3);
    }
  }

  // 5단계 진입 시 콘텐츠 생성 확인
  if (step === 5) {
    const hasBlog = !!(document.getElementById('kc-blog-title')?.value?.trim());
    const hasCardnews = !!_kcCardnewsDir;
    const hasThreads = !!(document.getElementById('kc-sns-threads-text')?.value?.trim());
    const hasTwitter = !!(document.getElementById('kc-sns-twitter-text')?.value?.trim());
    const hasImageBlog = _kcImageBlogSlides && _kcImageBlogSlides.length > 0;
    if (!hasBlog && !hasCardnews && !hasThreads && !hasTwitter && !hasImageBlog) {
      toast('먼저 콘텐츠를 생성하세요', 'error');
      return;
    }
  }

  // 2단계 진입 시 프롬프트 세트 로드
  if (step === 2) {
    kcLoadPromptSets();
  }

  // 3단계 재진입 시 기존 모달/오버레이 정리 + 프롬프트 세트 로드
  if (step === 3) {
    kcCloseOverlappingPromptModals();
    unlockScreen();
    kcLoadPromptSets();
  }

  // 3단계 진입 시 본문 수집 체크 + 프로필 반영
  if (step === 3 || step === 4) {
    let checkedSources = _kcSelectedSources.filter(s => s.checked);
    let hasScraped = checkedSources.some(s => (typeof kcSourceTextReady === 'function' ? kcSourceTextReady(s) : !!(s.scrapedText || s.snippet || s.title)));
    if (checkedSources.length === 0) {
      toast('참고할 소스를 선택하거나, 1단계에서 "직접 입력"을 사용하세요', 'error');
      return;
    }
    if (!hasScraped) {
      const pendingIndexes = _kcSelectedSources
        .map((s, idx) => ({ s, idx }))
        .filter(item => item.s.checked && item.s.url && !(typeof kcSourceBodyReady === 'function' ? kcSourceBodyReady(item.s) : !!item.s.scrapedText) && !item.s.scraping)
        .map(item => item.idx);
      if (pendingIndexes.length > 0) {
        toast(`선택한 소스 ${pendingIndexes.length}건의 본문을 가져오는 중입니다...`);
        for (const sourceIdx of pendingIndexes) {
          await kcScrapeArticle(sourceIdx);
        }
        checkedSources = _kcSelectedSources.filter(s => s.checked);
        hasScraped = checkedSources.some(s => (typeof kcSourceTextReady === 'function' ? kcSourceTextReady(s) : !!(s.scrapedText || s.snippet || s.title)));
      }
    }
    if (!hasScraped) {
      const hasURL = checkedSources.some(s => s.url);
      toast(hasURL ? '선택한 소스의 본문 수집에 실패했습니다. 다른 소스를 선택하거나 URL/직접 입력을 사용하세요' : '선택한 소스에 실제 URL이나 본문이 없습니다. 1단계에서 URL/직접 입력을 사용하세요', 'error');
      return;
    }
    // 프로필 자동 적용 — 브랜드명/설명/연락처 세팅 + 프로필 카드 표시
    if (window._globalProfileId) {
      try {
        const p = window._globalProfileData || await api(`/api/library/profiles/${window._globalProfileId}`);
        document.getElementById('kc-brand-name').value = p.name || '';
        document.getElementById('kc-brand-desc').value = p.description || '';
        document.getElementById('kc-contact').value = p.contact_info || '';
        document.getElementById('kc-business-goal').value = p.business_goal || '';
        const images = JSON.parse(p.images_json || '[]');
        _kcUploadedImages = images.map(f => ({ filename: f, path: `output/library/${p.id}/${f}`, url: `/api/library/image/${p.id}/${f}` }));

        // 프로필 데이터만 저장 (카드 표시 안 함)
        const nameEl = document.getElementById('kc-profile-name');
        const typeEl = document.getElementById('kc-profile-type');
        if (nameEl) nameEl.textContent = p.name || '';
        if (typeEl) typeEl.textContent = p.business_type || '';
      } catch {}
    }
    kcLoadPresetList();
  }

  _kcCurrentStep = step;

  // 카드 표시/숨김
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById('kc-card-' + i);
    if (card) card.style.display = i === step ? 'block' : 'none';
  }

  // 3단계 진입 시 프로필 + 프롬프트 세트 동기화 + 프롬프트 자동 재빌드
  if (step === 3) {
    await kcLoadProfileSelect();
    await kcLoadPromptSets();
    kcSyncStep3Profile();
    // 프롬프트 워크벤치가 비어있으면 자동으로 다시 빌드
    const root = document.getElementById('kc-prompt-inline-root');
    if (root && (!root.innerHTML.trim() || root.style.display === 'none')) {
      const payload = kcBuildGeneratePayload();
      if (payload) {
        kcReviewPromptsBeforeGenerate(payload);
      }
    }
  }

  // 4단계 진입 시 플랫폼 토글 + 프로필 + 프롬프트 세트 + 이미지 슬롯 동기화
  if (step === 4) {
    kcSyncPlatformToggles();
    kcLoadProfileSelect();
    kcLoadPromptSets();
    kcRenderImageSlots();
    const wsEl = document.getElementById('kc-web-search-enhance');
    if (wsEl) {
      wsEl.checked = !!getOpt('web_search_enhance', false);
      const kwWrap = document.getElementById('kc-web-search-keyword-wrap');
      if (kwWrap) kwWrap.style.display = wsEl.checked ? 'flex' : 'none';
    }
    const wsKw = document.getElementById('kc-web-search-keyword');
    if (wsKw) wsKw.value = getOpt('web_search_keyword', '') || '';
  }

  // 결과 카드: step 4에서 표시, step 5에서는 숨김
  const resultCard = document.getElementById('kc-result-card');
  if (resultCard) {
    if (step === 5) resultCard.style.display = 'none';
    else if (step === 4) {
      const hasAnyResult = ['kc-blog-result','kc-sns-result','kc-cardnews-result'].some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
      });
      if (hasAnyResult) resultCard.style.display = 'block';
    }
  }

  // 스텝 인디케이터 업데이트
  const steps = [1, 2, 3, 4, 5];
  const lineIds = [1, 2, 3, 4]; // line-fill IDs between steps
  const stepIdx = steps.indexOf(step);
  steps.forEach((s, idx) => {
    const numEl = document.getElementById('kc-step-num-' + s);
    const labelEl = document.getElementById('kc-step-label-' + s);
    const stepEl = s === 1 ? document.querySelector('.kc-step-item[data-step="1"]') : document.getElementById('kc-step-' + s);
    const lineFill = idx > 0 ? document.getElementById('kc-step-line-fill-' + lineIds[idx - 1]) : null;

    if (idx < stepIdx) {
      // 완료
      if (numEl) { numEl.style.background = '#34c759'; numEl.style.color = '#fff'; numEl.textContent = '\u2713'; numEl.style.boxShadow = '0 2px 8px rgba(52,199,89,0.3)'; }
      if (labelEl) labelEl.style.color = '#34c759';
      if (stepEl) stepEl.style.opacity = '1';
      if (lineFill) lineFill.style.width = '100%';
    } else if (idx === stepIdx) {
      // 현재
      if (numEl) { numEl.style.background = '#34c759'; numEl.style.color = '#fff'; numEl.textContent = idx + 1; numEl.style.boxShadow = '0 2px 8px rgba(52,199,89,0.3)'; }
      if (labelEl) labelEl.style.color = '#34c759';
      if (stepEl) stepEl.style.opacity = '1';
      if (lineFill) lineFill.style.width = '100%';
    } else {
      // 미래
      if (numEl) { numEl.style.background = 'rgba(0,0,0,0.06)'; numEl.style.color = 'rgba(0,0,0,0.3)'; numEl.textContent = idx + 1; numEl.style.boxShadow = 'none'; }
      if (labelEl) labelEl.style.color = 'rgba(0,0,0,0.3)';
      if (stepEl) stepEl.style.opacity = '0.4';
      if (lineFill) lineFill.style.width = '0%';
    }
  });

  // Step 3 진입 시 프로필 드롭다운 로드 + 기본 프로필 자동 적용
  if (step === 3) {
    kcLoadLibraryDropdown();
    applyDefaultProfile({
      brandNameId: 'kc-brand-name',
      descriptionId: 'kc-brand-desc',
      contactId: 'kc-brand-contact',
    });
    // 기본 프로필 이미지도 자동 로드
    if (_defaultProfile && _defaultProfile.image_urls && _defaultProfile.image_urls.length > 0) {
      const preview = document.getElementById('kc-uploaded-images');
      if (preview && !preview.innerHTML.trim()) {
        _kcUploadedImages = _defaultProfile.image_urls.map(u => ({url: u, path: '', filename: ''}));
        kcRefreshImagePreview();
      }
    }
  }

  // Step 4 진입 시 이미지 선택 그리드 + 디자인 참조 + 요약 업데이트
  if (step === 4) {
    kcBuildImageList();
    kcRenderImageSelectGrid();
    kcLoadDesignRefs();
    kcUpdateSummary();
    kcCheckStyleStatus();
  }

  // Step 5 진입 시 업로드 UI 초기화
  if (step === 5) {
    await kcInitUploadStep();
  }

  if (step === 3) {
    const promptPayload = kcBuildGeneratePayload();
    kcEnsureFreshPromptReviewState(promptPayload);
    kcUpdatePromptReviewStatus();
    const promptRoot = kcGetPromptInlineRoot();
    const hasInlineEditor = !!(promptRoot && promptRoot.style.display !== 'none' && promptRoot.innerHTML.trim());
    if (!hasInlineEditor && !_kcPromptReviewOpening) {
      setTimeout(() => {
        if (_kcCurrentStep !== 3 || _kcPromptReviewOpening) return;
        const latestRoot = kcGetPromptInlineRoot();
        const alreadyOpen = !!(latestRoot && latestRoot.style.display !== 'none' && latestRoot.innerHTML.trim());
        if (alreadyOpen) return;
        kcRunPromptReviewStep().catch(e => {
          console.error('[KC] auto open prompt review failed', e);
        });
      }, 0);
    }
  }
}

// ── Step 5: 업로드 ──

async function kcInitUploadStep() {
  // 프로젝트 DB 데이터도 함께 확인 (히스토리에서 열었을 때 DOM이 비어있을 수 있음)
  let proj = {};
  let projRes = {};
  if (_kcProjectId) {
    try { projRes = await api(`/api/projects/${_kcProjectId}`); proj = projRes.project || {}; } catch {}
  }

  // 히스토리에서 온 경우: DOM이 비어있으면 DB 데이터로 메모리 변수 복원
  if (_kcProjectId && proj.id) {
    // 블로그 글 복원
    if (!document.getElementById('kc-blog-title')?.value?.trim() && projRes.blog) {
      const blog = projRes.blog;
      _kcBlogPostId = blog.id;
      const titleEl = document.getElementById('kc-blog-title');
      const bodyEl = document.getElementById('kc-blog-body');
      const tagsEl = document.getElementById('kc-blog-tags');
      if (titleEl) titleEl.value = blog.title || '';
      if (bodyEl) bodyEl.value = blog.content || '';
      if (tagsEl) tagsEl.value = Array.isArray(blog.tags) ? blog.tags.join(', ') : (blog.tags || '');
    }
    // 상세페이지 이미지 복원 (detail_images 우선, 없으면 blog_images 폴백)
    if (!_kcImageBlogSlides || _kcImageBlogSlides.length === 0) {
      if (projRes.detail_images && projRes.detail_images.count > 0) {
        _kcImageBlogSlides = (projRes.detail_images.images || []).map(img => img.url);
        window._kcImgBlogDir = projRes.detail_images.project_dir || proj.detail_page_dir || '';
      } else if (projRes.blog_images && projRes.blog_images.count > 0) {
        _kcImageBlogSlides = (projRes.blog_images.images || []).map(img => img.url);
        window._kcImgBlogDir = projRes.blog_images.project_dir || proj.blog_images_dir || '';
      }
    }
    // SNS 텍스트 복원
    if (!document.getElementById('kc-sns-threads-text')?.value?.trim() && proj.threads_text) {
      const el = document.getElementById('kc-sns-threads-text');
      if (el) el.value = proj.threads_text;
    }
    if (!document.getElementById('kc-sns-twitter-text')?.value?.trim() && proj.twitter_text) {
      const el = document.getElementById('kc-sns-twitter-text');
      if (el) el.value = proj.twitter_text;
    }
    // 카드뉴스 복원
    if (!_kcCardnewsDir && projRes.cardnews && projRes.cardnews.id) {
      _kcCardnewsDir = projRes.cardnews.project_dir || '';
    }
    // 영상 경로 복원
    if (!_kcVideoPathSlide && proj.video_path_slide) {
      _kcVideoPathSlide = proj.video_path_slide;
    }
    if (!_kcVideoPath && proj.video_path) {
      _kcVideoPath = proj.video_path;
    }
  }

  // DOM 기준 (현재 세션에서 생성된 것)
  const domBlog = !!(document.getElementById('kc-blog-title')?.value?.trim());
  const domCardnews = !!_kcCardnewsDir;
  const domThreads = !!(document.getElementById('kc-sns-threads-text')?.value?.trim());
  const domTwitter = !!(document.getElementById('kc-sns-twitter-text')?.value?.trim());
  const domImageBlog = _kcImageBlogSlides && _kcImageBlogSlides.length > 0;
  const domComic = !!(document.querySelector('#kc-panel-comic img[src*="comic"]') || document.getElementById('kc-comic-image') || document.querySelector('#kc-comic-result img'));
  const domSlideVideo = !!(typeof _kcVideoPathSlide !== 'undefined' && _kcVideoPathSlide);
  const domAiVideo = !!(typeof _kcVideoPath !== 'undefined' && _kcVideoPath);

  // 행 활성화는 DOM + DB 둘 다 확인 (히스토리에서 열었을 때)
  const hasBlog = domBlog || !!proj.blog_id;
  const hasCardnews = domCardnews || !!proj.cardnews_id;
  const hasThreads = domThreads || !!(proj.threads_text);
  const hasTwitter = domTwitter || !!(proj.twitter_text);
  const hasImageBlog = domImageBlog || !!proj.detail_page_dir || !!proj.blog_images_dir;
  const hasComic = domComic || !!proj.comic_id;
  const hasSlideVideo = domSlideVideo || !!(proj.video_path_slide);
  const hasAiVideo = domAiVideo || !!(proj.video_path);

  // 라디오 옵션 비활성화는 DOM 기준 (실제 콘텐츠가 있어야 업로드 가능)
  const hasImages = (_kcFinalImages || []).some(x => x.selected) || (window._kcBlogImages || []).length > 0;

  function setRowState(rowId, btnId, descId, enabled, desc) {
    const row = document.getElementById(rowId);
    const btn = document.getElementById(btnId);
    const descEl = document.getElementById(descId);
    if (row) row.style.opacity = enabled ? '1' : '0.4';
    if (btn) { btn.disabled = !enabled; btn.style.opacity = enabled ? '1' : '0.4'; }
    if (descEl && desc) descEl.textContent = desc;
  }

  function setRadioEnabled(name, value, enabled) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (!radio) return;
    const label = radio.closest('label');
    if (!label) return;
    radio.disabled = !enabled;
    if (enabled) {
      label.style.opacity = '1';
      label.style.pointerEvents = '';
    } else {
      label.style.opacity = '0.3';
      label.style.pointerEvents = 'none';
      // 비활성화된 옵션이 선택 중이면 첫 번째 활성 옵션으로 전환
      if (radio.checked) {
        radio.checked = false;
        const allRadios = document.querySelectorAll(`input[name="${name}"]`);
        for (const r of allRadios) {
          if (!r.disabled) { r.checked = true; break; }
        }
      }
    }
  }

  // 블로그 — 글이 있어야 모든 옵션 가능
  setRowState('kc-upload-blog-row', 'kc-upload-blog-btn', 'kc-upload-blog-desc', hasBlog, hasBlog ? '블로그 발행' : '생성된 블로그 글 없음');
  // 라디오 옵션 — DOM + DB 둘 다 확인 (히스토리에서 올 때 DOM이 비어있음)
  setRadioEnabled('kc-up-blog-type', 'text', hasBlog);
  setRadioEnabled('kc-up-blog-type', 'text+image', hasBlog && (hasImages || domBlog));
  setRadioEnabled('kc-up-blog-type', 'text+cardnews', hasBlog && hasCardnews);
  setRadioEnabled('kc-up-blog-type', 'text+comic', hasBlog && hasComic);
  setRadioEnabled('kc-up-blog-type', 'detail', hasBlog && hasImageBlog);

  // 인스타그램
  const igEnabled = hasCardnews || hasComic || hasSlideVideo || hasAiVideo || hasImageBlog;
  setRowState('kc-upload-ig-row', 'kc-upload-ig-btn', 'kc-upload-ig-desc', igEnabled, igEnabled ? '릴스 · 스토리' : '콘텐츠 없음');
  setRadioEnabled('kc-up-ig-type', 'cardnews', hasCardnews);
  setRadioEnabled('kc-up-ig-type', 'comic', hasComic);
  // 상세페이지 제거됨
  setRadioEnabled('kc-up-ig-type', 'reels-slide', hasSlideVideo);
  setRadioEnabled('kc-up-ig-type', 'reels-ai', hasAiVideo);
  setRadioEnabled('kc-up-ig-type', 'story-cardnews', hasCardnews);
  setRadioEnabled('kc-up-ig-type', 'story-comic', hasComic);
  setRadioEnabled('kc-up-ig-type', 'story-slide', !!_kcVideoPathSlide);
  setRadioEnabled('kc-up-ig-type', 'story-veo', !!_kcVideoPath);
  setRadioEnabled('kc-up-ig-type', 'story-reels', hasSlideVideo || hasAiVideo);

  // 스레드
  setRowState('kc-upload-threads-row', 'kc-upload-threads-btn', 'kc-upload-threads-desc', hasThreads, hasThreads ? '스레드 업로드' : '생성된 스레드 글 없음');
  setRadioEnabled('kc-up-threads-type', 'text', hasThreads);
  setRadioEnabled('kc-up-threads-type', 'cardnews', hasCardnews);
  setRadioEnabled('kc-up-threads-type', 'comic', hasComic);

  // 트위터
  setRowState('kc-upload-twitter-row', 'kc-upload-twitter-btn', 'kc-upload-twitter-desc', hasTwitter, hasTwitter ? '트위터(X) 업로드' : '생성된 트위터 글 없음');
  setRadioEnabled('kc-up-twitter-type', 'text', hasTwitter);
  setRadioEnabled('kc-up-twitter-type', 'cardnews', hasCardnews);
  setRadioEnabled('kc-up-twitter-type', 'comic', hasComic);

  // 유튜브
  const ytEnabled = hasSlideVideo || hasAiVideo;
  setRowState('kc-upload-youtube-row', 'kc-upload-youtube-btn', 'kc-upload-youtube-desc', ytEnabled, ytEnabled ? 'YouTube Shorts' : '영상 없음');
  setRadioEnabled('kc-up-yt-type', 'slide', hasSlideVideo);
  setRadioEnabled('kc-up-yt-type', 'ai', hasAiVideo);

  // 릴스 (인스타에 통합)
  setRowState('kc-upload-reels-row', 'kc-upload-reels-btn', null, false, null);

  // 틱톡
  setRowState('kc-upload-tiktok-row', 'kc-upload-tiktok-btn', 'kc-upload-tiktok-desc', ytEnabled, ytEnabled ? '틱톡 업로드' : '영상 없음');
  setRadioEnabled('kc-up-tiktok-type', 'slide', hasSlideVideo);
  setRadioEnabled('kc-up-tiktok-type', 'ai', hasAiVideo);

  kcRestoreUploadStatus();
}

async function kcRestoreUploadStatus() {
  if (!_kcProjectId) return;
  try {
    const res = await api(`/api/projects/${_kcProjectId}`);
    const p = res.project;
    if (!p) return;
    const platforms = ['blog', 'ig', 'threads', 'twitter', 'youtube'];
    platforms.forEach(platform => {
      const uploadedAt = p[platform + '_uploaded_at'];
      const url = p[platform + '_url'];
      if (uploadedAt) {
        kcShowUploadSuccess(platform, url, true);
      }
    });
  } catch {}
}

async function kcStep5Upload(platform) {
  if (platform !== 'ig') {
    toast('업로드는 인스타그램만 가능합니다.', 'error');
    return;
  }
  const btn = document.getElementById(`kc-upload-${platform}-btn`);
  const statusEl = document.getElementById(`kc-upload-${platform}-status`);
  if (!btn || btn.disabled) return;

  // 로딩 상태
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 처리 중...';
  btn.style.opacity = '0.7';

  try {
    let url = '';
    if (platform === 'blog') {
      if (window._blogUploadMode === 'image') {
        // 이미지 상세페이지 발행
        await kcPublishImageBlog();
      } else {
        // 텍스트 글 발행
        await kcPublishBlog();
      }
      const blogId = getBlogId();
      url = blogId ? `https://blog.naver.com/${blogId}` : '';
    } else if (platform === 'ig') {
      await kcUploadCardnews();
    } else if (platform === 'threads') {
      await kcUploadThreads();
    } else if (platform === 'twitter') {
      await kcUploadTwitter();
    } else if (platform === 'youtube') {
      // YouTube 쇼츠 업로드
      const videoSrc = document.getElementById('kc-video-player')?.src || '';
      if (!videoSrc) { throw new Error('영상이 없습니다'); }
      const keyword = document.getElementById('kc-keyword')?.value || '';
      const result = await api('/api/upload/youtube', {
        method: 'POST',
        body: {
          video_path: _kcVideoPath || '',
          title: keyword || '영상',
          description: '',
          privacy_status: 'public',
          is_shorts: true,
          profile_id: parseInt(window._globalProfileId || 0),
        }
      });
      url = result.url || '';
    } else if (platform === 'reels') {
      // 인스타 릴스 업로드
      const caption = document.getElementById('kc-cn-ig-caption')?.value || '';
      await api('/api/instagram/reels', {
        method: 'POST',
        body: { video_path: _kcVideoPath || '', caption: caption }
      });
    } else if (platform === 'tiktok') {
      // TikTok — 웹 열기 + 폴더 열기
      window.open('https://www.tiktok.com/upload', '_blank');
      api('/api/open-folder', { method: 'POST', body: { folder: 'output/videos' } });
    }

    // 프로젝트에 업로드 상태 저장
    if (_kcProjectId) {
      const updateData = {};
      if (platform === 'youtube') {
        updateData['youtube_uploaded_at'] = new Date().toISOString();
        if (url) updateData['youtube_url'] = url;
      } else {
        updateData[platform + '_uploaded_at'] = new Date().toISOString();
        if (url) updateData[platform + '_url'] = url;
      }
      try {
        await api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: updateData });
      } catch {}
    }

    // 성공 UI
    kcShowUploadSuccess(platform, url);
  } catch (e) {
    // 실패 — 원래 상태로 복원
    btn.disabled = false;
    btn.innerHTML = origHtml;
    btn.style.opacity = '1';
    toast(`${platform} 업로드 실패: ${e.message}`, 'error');
  }
}

function kcShowUploadSuccess(platform, url, isRestore) {
  const btn = document.getElementById(`kc-upload-${platform}-btn`);
  const statusEl = document.getElementById(`kc-upload-${platform}-status`);
  const names = { blog: '네이버 블로그', ig: '인스타그램', threads: '스레드', twitter: '트위터', youtube: '유튜브 쇼츠', reels: '인스타 릴스', tiktok: '틱톡' };

  if (btn) {
    if (isRestore) {
      // 이전 업로드 복원 — 재업로드 가능
      btn.disabled = false;
      btn.innerHTML = '재업로드';
      btn.style.background = 'rgba(52,199,89,0.15)';
      btn.style.color = '#34c759';
      btn.style.opacity = '1';
    } else {
      // 현재 세션 업로드 완료
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"/></svg> 재업로드';
      btn.style.background = '#34c759';
      btn.style.color = '#fff';
      btn.style.opacity = '1';
    }
  }

  if (statusEl) {
    if (url) {
      statusEl.innerHTML = `<a href="${url}" target="_blank" style="font-size:11px;color:#007aff;text-decoration:none;">링크</a>`;
    } else {
      statusEl.innerHTML = isRestore ? '' : '<span style="font-size:11px;color:#34c759;font-weight:600;">완료</span>';
    }
  }

  // 히스토리에 추가
  const historyDiv = document.getElementById('kc-upload-history');
  const historyList = document.getElementById('kc-upload-history-list');
  if (historyDiv && historyList) {
    historyDiv.style.display = '';
    const existing = historyList.querySelector(`[data-platform="${platform}"]`);
    if (!existing) {
      const item = document.createElement('div');
      item.setAttribute('data-platform', platform);
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(52,199,89,0.06);border-radius:8px;';
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span style="font-size:13px;font-weight:600;color:#1c1c1e;flex:1;">${names[platform] || platform}</span>
        ${url ? `<a href="${url}" target="_blank" style="font-size:11px;color:#007aff;">열기</a>` : '<span style="font-size:11px;color:#34c759;">완료</span>'}`;
      historyList.appendChild(item);
    }
  }
}
