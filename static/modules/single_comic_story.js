let _scsInitialized = false;
let _scsState = {
  uploadedImages: [],
  topicIdeas: [],
  selectedTopicIndex: -1,
  storyBundle: null,
  episodes: [],
  projectDir: '',
  generating: false,
};

function scsFixedEpisodeCount() {
  return 1;
}

function scsPanelCount() {
  const configured = parseInt(String(window._contentOpts?.comic_panels || '').trim(), 10);
  const panelCount = Number.isFinite(configured) ? configured : 6;
  return Math.max(4, Math.min(10, panelCount));
}

function scsRecommendedLayout() {
  const panelCount = scsPanelCount();
  if (panelCount <= 4) return '2x2';
  if (panelCount <= 6) return '3x2';
  if (panelCount <= 8) return '4x2';
  return '5x2';
}

function scsStyleLabel(style) {
  const map = {
    cute: '귀여운',
    webtoon: '웹툰',
    comic: '만화',
    realistic: '리얼리스틱',
    chibi: '치비',
    manga: '일본만화',
    gag: '개그만화',
    'slice-of-life': '일상툰',
    simple: '심플',
    retro: '레트로',
  };
  return map[style] || style || '귀여운';
}

function scsInit() {
  if (typeof mkkRenderSingleImageModelBanner === 'function') {
    mkkRenderSingleImageModelBanner('single-comic-story', { note: '스토리만화 이미지 생성 전 설정 모델을 먼저 확인합니다.' });
  }
  if (!_scsInitialized) {
    _scsInitialized = true;
  }
  scsRefreshProfileSummary();
  scsRenderTopicIdeas();
  scsRenderUploadedImages();
  scsRenderPreview();
  scsRenderEpisodes();
  scsRestoreDefaults();
}

function scsSaveDefaults(silent) {
  const data = {
    message: (document.getElementById('single-comic-message')?.value || '').trim(),
    logoEnabled: !!document.getElementById('single-comic-logo-enabled')?.checked,
  };
  localStorage.setItem('scs_defaults', JSON.stringify(data));
  if (!silent) toast('스토리만화 기본값이 저장되었습니다');
}

function scsRestoreDefaults() {
  const saved = localStorage.getItem('scs_defaults');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    const messageEl = document.getElementById('single-comic-message');
    const logoEl = document.getElementById('single-comic-logo-enabled');
    if (messageEl && data.message !== undefined) messageEl.value = data.message;
    if (logoEl && data.logoEnabled !== undefined) logoEl.checked = !!data.logoEnabled;
  } catch (e) {}
}

function scsClearDefaults() {
  localStorage.removeItem('scs_defaults');
  toast('저장된 기본값이 초기화되었습니다');
}

function scsRefreshProfileSummary() {
  const profile = window._globalProfileData || null;
  const nameEl = document.getElementById('single-comic-profile-name');
  const metaEl = document.getElementById('single-comic-profile-meta');
  const styleChip = document.getElementById('single-comic-style-chip');
  const episodeChip = document.getElementById('single-comic-episode-chip');
  const panelChip = document.getElementById('single-comic-panel-chip');
  if (!nameEl || !metaEl || !styleChip) return;

  const comicStyle = String(window._contentOpts?.comic_style || getOpt('comic_style', 'cute') || 'cute');
  styleChip.textContent = scsStyleLabel(comicStyle);
  if (episodeChip) episodeChip.textContent = '1편 고정';
  if (panelChip) panelChip.textContent = `${scsPanelCount()}컷`;

  if (!profile) {
    nameEl.textContent = '프로필 미선택';
    metaEl.textContent = '프로필을 선택하면 저장된 만화 스타일과 로고 설정을 그대로 사용합니다. 스토리만화는 한 편으로 만들고, 안에는 여러 컷을 넣습니다.';
    return;
  }

  const businessType = profile.business_type ? ` · ${profile.business_type}` : '';
  nameEl.textContent = `${profile.name || '이름 없는 프로필'}${businessType}`;
  metaEl.textContent = '현재 선택된 프로필을 기준으로 상품, 서비스, 매장을 자연스럽게 알리는 홍보형 스토리만화를 한 편으로 생성합니다.';
}

function scsRenderTopicIdeas() {
  const wrap = document.getElementById('single-comic-topic-list');
  const metaEl = document.getElementById('single-comic-topic-meta');
  if (!wrap || !metaEl) return;

  const items = _scsState.topicIdeas || [];
  if (!items.length) {
    metaEl.textContent = '아직 추천 아이템이 없습니다.';
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:22px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">프로필 기준으로 20개가 넘는 홍보형 스토리 아이템을 먼저 제안합니다. 마음에 드는 아이템을 눌러 메시지 입력창에 반영하세요.</div>';
    return;
  }

  const selected = items[_scsState.selectedTopicIndex] || null;
  metaEl.textContent = selected
    ? `${items.length}개 추천됨 · 선택: ${selected.topic || '아이템'}`
    : `${items.length}개 추천 아이템이 준비되었습니다.`;

  wrap.innerHTML = items.map((item, idx) => {
    const selectedStyle = idx === _scsState.selectedTopicIndex;
    return `<button type="button" onclick="scsSelectTopicIdea(${idx})" style="text-align:left;padding:14px;border-radius:16px;border:${selectedStyle ? '1.5px solid rgba(255,140,0,0.45)' : '1px solid rgba(0,0,0,0.08)'};background:${selectedStyle ? 'rgba(255,140,0,0.07)' : '#fff'};box-shadow:${selectedStyle ? '0 8px 24px rgba(255,140,0,0.12)' : '0 10px 24px rgba(15,23,42,0.04)'};display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:all .15s;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div style="font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.4;">${escapeHtml(item.topic || `아이템 ${idx + 1}`)}</div>
        <div style="flex-shrink:0;font-size:10px;font-weight:800;color:${selectedStyle ? '#ff8c00' : 'rgba(0,0,0,0.3)'};">${selectedStyle ? '선택됨' : `#${idx + 1}`}</div>
      </div>
      ${item.hook ? `<div style="font-size:12px;color:#ff8c00;font-weight:700;line-height:1.5;">${escapeHtml(item.hook)}</div>` : ''}
      <div style="font-size:12px;color:rgba(0,0,0,0.68);line-height:1.6;">${escapeHtml(item.summary || '-')}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.38);line-height:1.45;">클릭하면 스토리 메시지 입력창에 바로 반영됩니다.</div>
    </button>`;
  }).join('');
}

function scsSelectTopicIdea(idx) {
  const item = (_scsState.topicIdeas || [])[idx];
  if (!item) return;
  _scsState.selectedTopicIndex = idx;
  const messageEl = document.getElementById('single-comic-message');
  if (messageEl) messageEl.value = String(item.story_message || '').trim();
  scsRenderTopicIdeas();
  scsSaveDefaults(true);
  toast('선택한 스토리 아이템을 메시지에 반영했습니다.');
}

async function scsImportFromUrl() {
  const urlEl = document.getElementById('single-comic-source-url');
  const statusEl = document.getElementById('single-comic-source-status');
  const deepCrawl = !!document.getElementById('single-comic-deep-crawl')?.checked;
  const rawInput = (urlEl?.value || '').trim();
  const urls = rawInput.split(/[\n,]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
  if (!urls.length) {
    toast('올바른 URL을 입력하세요', 'error');
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = deepCrawl
      ? '딥 크롤링 중... (사이트 내 링크 탐색)'
      : `${urls.length}개 URL에서 내용 가져오는 중...`;
  }

  try {
    const allTexts = [];
    let successCount = 0;

    if (deepCrawl) {
      for (const url of urls) {
        if (statusEl) statusEl.textContent = `딥 크롤링 중: ${new URL(url).hostname}...`;
        try {
          const res = await api('/api/content/deep-scrape', {
            method: 'POST',
            body: { url, max_pages: 10, max_depth: 2 },
          });
          for (const page of (res.pages || [])) {
            successCount++;
            const title = String(page.title || '').trim();
            const text = String(page.text || '').trim();
            allTexts.push(title ? `[${title}]\n${text}` : text);
          }
        } catch (e) {
          console.warn('[SCS] 딥 크롤링 실패:', e.message);
        }
      }
    } else {

    for (let i = 0; i < urls.length; i++) {
      if (statusEl) statusEl.textContent = `URL ${i + 1}/${urls.length} 수집 중...`;
      const scrape = window._VAGSource?.scrapeArticle;
      let data = null;
      try {
        if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
        const result = await scrape(urls[i], { minLength: 50, timeoutMs: 45000 });
        if (result && result.ok) {
          data = { title: result.title || '', text: result.text, images: result.images || [], method: result.method || 'pipeline' };
        }
      } catch (e) {
        console.warn('[SCS] 공통 scrape 실패:', e.message);
      }
      if (data && String(data.text || '').trim()) {
        successCount++;
        const title = String(data.title || '').trim();
        const text = String(data.text || '').trim();
        allTexts.push(title ? `[${title}]\n${text}` : text);
      }
    }
    } // end else

    if (!successCount) throw new Error('본문을 가져오지 못했습니다.');

    const messageEl = document.getElementById('single-comic-message');
    if (messageEl) {
      const existing = messageEl.value.trim();
      const collected = allTexts.join('\n\n---\n\n');
      const prefix = '아래 자료를 바탕으로 만화 스토리를 만들어줘:\n\n';
      messageEl.value = existing
        ? existing + '\n\n---\n\n' + collected
        : prefix + collected;
    }
    toast(`${successCount}개 페이지에서 참고 자료를 수집했습니다.`);
  } catch (e) {
    toast('URL 가져오기 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

async function scsGenerateTopicIdeas() {
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  if (!profileId) {
    toast('프로필을 먼저 선택하세요', 'error');
    return;
  }

  const btn = document.getElementById('single-comic-topic-btn');
  const messageEl = document.getElementById('single-comic-message');
  const comicStyle = String(window._contentOpts?.comic_style || getOpt('comic_style', 'cute') || 'cute');
  const seed = (messageEl?.value || '').trim();

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 제안 중...';
    }
    const res = await api('/api/comic/story-topics', {
      method: 'POST',
      body: {
        profile_id: profileId,
        episode_count: scsFixedEpisodeCount(),
        panel_count: scsPanelCount(),
        seed,
        style: comicStyle,
        limit: 24,
      },
    });
    _scsState.topicIdeas = Array.isArray(res.items) ? res.items : [];
    _scsState.selectedTopicIndex = -1;
    scsRenderTopicIdeas();
    toast(`${res.count || _scsState.topicIdeas.length || 0}개의 스토리 아이템을 만들었습니다.`);
  } catch (e) {
    toast('스토리 아이템 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 5v14"/><path d="M5 12h14"/></svg> 아이템 24개 추천';
    }
  }
}

async function scsGenerateStoryMessage() {
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  if (!profileId) {
    toast('프로필을 먼저 선택하세요', 'error');
    return;
  }

  const btn = document.getElementById('single-comic-suggest-btn');
  const messageEl = document.getElementById('single-comic-message');
  const seed = (messageEl?.value || '').trim();

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 작성 중...';
    }
    const res = await api('/api/comic/story-message', {
      method: 'POST',
      body: {
        profile_id: profileId,
        episode_count: scsFixedEpisodeCount(),
        panel_count: scsPanelCount(),
        seed,
      },
    });
    if (messageEl) messageEl.value = String(res.message || '').trim();
    scsSaveDefaults(true);
    toast('프로필 기준 스토리 메시지를 넣었습니다.');
  } catch (e) {
    toast('스토리 메시지 생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 5v14"/><path d="M5 12h14"/></svg> 프로필 기준 메시지 만들기';
    }
  }
}

async function scsUploadImages() {
  const input = document.getElementById('single-comic-images');
  const statusEl = document.getElementById('single-comic-upload-status');
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
    _scsState.uploadedImages.push(...(data.images || []));
    scsRenderUploadedImages();
    toast(`${(data.images || []).length}장의 참조 이미지를 업로드했습니다.`);
  } catch (e) {
    toast('이미지 업로드 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
    if (input) input.value = '';
  }
}

function scsClearImages() {
  _scsState.uploadedImages = [];
  scsRenderUploadedImages();
}

function scsRemoveUploadedImage(idx) {
  _scsState.uploadedImages.splice(idx, 1);
  scsRenderUploadedImages();
}

function scsGetSelectedImageUrls() {
  return _scsState.uploadedImages
    .map(img => typeof img === 'string' ? img : (img.url || img.path || ''))
    .filter(Boolean);
}

function scsRenderUploadedImages() {
  const wrap = document.getElementById('single-comic-image-preview');
  if (!wrap) return;
  if (!_scsState.uploadedImages.length) {
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:18px;border:1px dashed rgba(0,0,0,0.08);border-radius:14px;color:rgba(0,0,0,0.35);font-size:12px;text-align:center;">업로드한 이미지가 없습니다. 캐릭터나 분위기 참고 이미지를 넣으면 한 편 전체 컷에 공통으로 반영합니다.</div>';
    return;
  }
  wrap.innerHTML = _scsState.uploadedImages.map((img, idx) => {
    const url = typeof img === 'string' ? img : (img.url || img.path || '');
    return `<div style="position:relative;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;background:#fff;">
      <img src="${escapeHtml(url)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;">
      <button type="button" onclick="scsRemoveUploadedImage(${idx})" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border:none;border-radius:999px;background:rgba(0,0,0,0.72);color:#fff;font-size:12px;cursor:pointer;">×</button>
    </div>`;
  }).join('');
}

function scsRenderEpisodes() {
  const wrap = document.getElementById('single-comic-results');
  const metaEl = document.getElementById('single-comic-result-meta');
  if (!wrap || !metaEl) return;

  if (!_scsState.episodes.length) {
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:28px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">생성된 스토리만화가 여기 표시됩니다.</div>';
    metaEl.textContent = '아직 생성된 결과가 없습니다.';
    return;
  }

  const successCount = _scsState.episodes.filter(item => item?.imageUrl).length;
  metaEl.textContent = `${successCount}/${_scsState.episodes.length}편 생성 완료${_scsState.projectDir ? ' · 프로젝트 폴더 준비됨' : ''}`;

  wrap.innerHTML = _scsState.episodes.map(item => {
    const statusColor = item.error ? '#ff3b30' : item.imageUrl ? '#34c759' : _scsState.generating ? '#ff8c00' : 'rgba(0,0,0,0.35)';
    const statusText = item.error ? item.error : item.imageUrl ? '생성 완료' : _scsState.generating ? '생성 중...' : '대기 중';
    const imageHtml = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#f5f5f7;">`
      : `<div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,rgba(255,214,0,0.12),rgba(255,255,255,0.95));display:flex;align-items:center;justify-content:center;color:${statusColor};font-size:13px;font-weight:700;">${_scsState.generating ? '<span class="spinner"></span>' : item.episode_number + '화'}</div>`;
    return `<div style="border:1px solid rgba(0,0,0,0.08);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,0.05);">
      <div style="padding:12px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div style="font-size:12px;font-weight:800;color:#ff8c00;margin-bottom:4px;">스토리만화 ${item.episode_number}</div>
          <div style="font-size:15px;font-weight:800;color:#1c1c1e;line-height:1.35;">${escapeHtml(item.title || `에피소드 ${item.episode_number}`)}</div>
        </div>
        <div style="font-size:11px;color:${statusColor};max-width:110px;text-align:right;">${escapeHtml(statusText)}</div>
      </div>
      <div>${imageHtml}</div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:12px;color:rgba(0,0,0,0.74);line-height:1.6;"><strong style="color:#1c1c1e;">스토리 요약</strong> ${escapeHtml(item.summary || '-')}</div>
        ${item.cliffhanger ? `<div style="font-size:11px;color:rgba(0,0,0,0.42);line-height:1.55;">다음 연결 아이디어: ${escapeHtml(item.cliffhanger)}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${item.imageUrl ? `<button class="btn btn-secondary btn-sm" type="button" onclick="kcShowImagePreview('${escapeHtml(item.imageUrl)}')">크게 보기</button>` : ''}
          ${item.imageUrl ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(item.imageUrl.split('?')[0])}" download="comic_episode_${item.episode_number}.png" style="text-decoration:none;">다운로드</a>` : ''}
          ${item.projectDir ? `<button class="btn btn-secondary btn-sm" type="button" onclick="scsOpenEpisodeFolder('${escapeHtml(item.projectDir)}')">폴더 열기</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function scsRenderPreview() {
  const wrap = document.getElementById('single-comic-preview-list');
  const metaEl = document.getElementById('single-comic-preview-meta');
  const confirmBtn = document.getElementById('single-comic-confirm-btn');
  if (!wrap || !metaEl || !confirmBtn) return;

  const bundle = _scsState.storyBundle;
  const episodes = bundle?.episodes || [];
  if (!episodes.length) {
    wrap.innerHTML = '<div style="padding:28px;border:1px dashed rgba(0,0,0,0.08);border-radius:16px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">한 편 안의 컷 구성과 대사 미리보기가 여기 표시됩니다.</div>';
    metaEl.textContent = '아직 만든 스토리 구성이 없습니다.';
    confirmBtn.disabled = true;
    return;
  }

  metaEl.textContent = `${bundle.series_title || `${scsPanelCount()}컷 스토리`} · ${episodes.length}편 · ${scsPanelCount()}컷`;
  confirmBtn.disabled = _scsState.generating;
  wrap.innerHTML = episodes.map(episode => `
    <div style="border:1px solid rgba(0,0,0,0.08);border-radius:16px;background:#fff;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <div style="font-size:12px;font-weight:800;color:#ff8c00;margin-bottom:4px;">스토리만화 ${episode.episode_number}</div>
          <div style="font-size:15px;font-weight:800;color:#1c1c1e;line-height:1.35;">${escapeHtml(episode.title || '')}</div>
        </div>
        ${episode.cliffhanger ? `<div style="font-size:11px;color:rgba(0,0,0,0.4);max-width:180px;text-align:right;">다음 연결 아이디어: ${escapeHtml(episode.cliffhanger)}</div>` : ''}
      </div>
      <div style="font-size:12px;color:rgba(0,0,0,0.72);line-height:1.6;margin-bottom:12px;"><strong style="color:#1c1c1e;">스토리 요약</strong> ${escapeHtml(episode.summary || '-')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
        ${(episode.panels || []).map(panel => `
          <div style="padding:10px;border-radius:12px;background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.08);">
            <div style="font-size:11px;font-weight:800;color:#ff8c00;margin-bottom:6px;">컷 ${panel.panel_number}</div>
            <div style="font-size:12px;font-weight:700;color:#1c1c1e;line-height:1.5;margin-bottom:4px;">${escapeHtml(panel.situation || '')}</div>
            ${panel.dialogue ? `<div style="font-size:12px;color:rgba(0,0,0,0.72);line-height:1.55;margin-bottom:4px;">대사: ${escapeHtml(panel.dialogue)}</div>` : ''}
            ${panel.narration ? `<div style="font-size:11px;color:rgba(0,0,0,0.48);line-height:1.5;margin-bottom:4px;">내레이션: ${escapeHtml(panel.narration)}</div>` : ''}
            <div style="font-size:11px;color:rgba(0,0,0,0.42);line-height:1.5;">이미지: ${escapeHtml(panel.visual_prompt || '-')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function scsResetState(source) {
  const rawEpisodes = Array.isArray(source)
    ? source
    : Array.from({ length: source }, (_, idx) => ({ episode_number: idx + 1, title: `에피소드 ${idx + 1}`, summary: '', cliffhanger: '' }));
  _scsState.projectDir = '';
  _scsState.episodes = rawEpisodes.map((episode, idx) => ({
    episode_number: episode?.episode_number || idx + 1,
    title: episode?.title || `에피소드 ${idx + 1}`,
    summary: episode?.summary || '',
    cliffhanger: episode?.cliffhanger || '',
    imageUrl: '',
    composedImage: '',
    projectDir: '',
    error: '',
  }));
  scsRenderEpisodes();
}

function scsBuildEpisodeCaption(item) {
  if (!item) return '';
  const bundle = _scsState.storyBundle || {};
  const seriesTitle = String(bundle.series_title || '').trim();
  const storyBible = String(bundle.story_bible || '').trim();
  const episodeTitle = String(item.title || `에피소드 ${item.episode_number || ''}`).trim();
  const summary = String(item.summary || '').trim();
  const cliffhanger = String(item.cliffhanger || '').trim();
  const tags = [seriesTitle, episodeTitle, '만화', '인스타툰']
    .map(v => String(v || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(v => '#' + v.replace(/[^\w가-힣]+/g, ''))
    .filter(tag => tag.length > 1)
    .slice(0, 6)
    .join(' ');

  return [
    [seriesTitle, episodeTitle].filter(Boolean).join(' · '),
    summary,
    cliffhanger ? `다음 이야기: ${cliffhanger}` : '',
    storyBible ? storyBible.slice(0, 180) : '',
    tags,
  ].filter(Boolean).join('\n\n');
}

function scsResolveComicImageUrl(item) {
  if (!item) return '';
  const composedUrl = String(item.composed_url || item.composedUrl || '').trim();
  if (composedUrl) {
    return `${encImg('/api/comic/image/' + composedUrl)}?t=${Date.now()}`;
  }
  const composedImage = String(item.composed_image || item.composedImage || '').trim().replace(/\\/g, '/');
  if (!composedImage) return '';
  const marker = '/comics/';
  const markerIndex = composedImage.indexOf(marker);
  if (markerIndex < 0) return '';
  const relative = composedImage.slice(markerIndex + marker.length);
  if (!relative) return '';
  return `${encImg('/api/comic/image/' + relative)}?t=${Date.now()}`;
}

async function scsGenerateStoryPreview() {
  if (_scsState.generating) {
    toast('이미 생성 중입니다', 'error');
    return;
  }

  const message = (document.getElementById('single-comic-message')?.value || '').trim();
  const statusEl = document.getElementById('single-comic-generate-status');
  const btn = document.getElementById('single-comic-generate-btn');
  if (!message) {
    toast('스토리 메시지를 입력하세요', 'error');
    return;
  }

  scsSaveDefaults(true);
  _scsState.generating = true;
  _scsState.storyBundle = null;
  _scsState.projectDir = '';
  _scsState.episodes = [];
  scsRenderPreview();
  scsRenderEpisodes();
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;"></span> 생성 중...';
  }
  if (statusEl) statusEl.textContent = `${scsPanelCount()}컷 한 편짜리 스토리 구성을 만드는 중입니다. 컷 수가 많을수록 시간이 더 걸릴 수 있습니다.`;

  try {
    const comicStyle = String(window._contentOpts?.comic_style || getOpt('comic_style', 'cute') || 'cute');
    const res = await api('/api/comic/story-series/preview', {
      method: 'POST',
      body: {
        message,
        episode_count: scsFixedEpisodeCount(),
        panel_count: scsPanelCount(),
        style: comicStyle,
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
      },
    });

    _scsState.storyBundle = res.story_bundle || null;
    scsRenderPreview();
    if (statusEl) statusEl.textContent = `${scsPanelCount()}컷 스토리 구성을 만들었습니다. 내용을 확인한 뒤 진행 버튼을 눌러주세요.`;
    toast(`스토리 구성 완료: ${scsPanelCount()}컷`);
  } catch (e) {
    if (statusEl) statusEl.textContent = '스토리 구성 생성 실패';
    toast('스토리 구성 생성 실패: ' + e.message, 'error');
  } finally {
    _scsState.generating = false;
    scsRenderPreview();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg> 스토리 구성 만들기';
    }
  }
}

async function scsConfirmStorySeries() {
  if (_scsState.generating) {
    toast('이미 생성 중입니다', 'error');
    return;
  }
  if (!_scsState.storyBundle?.episodes?.length) {
    toast('먼저 스토리 구성을 만들어주세요', 'error');
    return;
  }

  const statusEl = document.getElementById('single-comic-generate-status');
  const confirmBtn = document.getElementById('single-comic-confirm-btn');
  const storyEpisodes = _scsState.storyBundle.episodes || [];
  scsResetState(storyEpisodes);
  _scsState.generating = true;
  scsRenderPreview();
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 진행 중...';
  }
  if (statusEl) statusEl.textContent = '확정된 컷 구성으로 스토리만화 이미지를 생성하는 중입니다.';

  try {
    const comicStyle = String(window._contentOpts?.comic_style || getOpt('comic_style', 'cute') || 'cute');
    const logoEnabled = !!(document.getElementById('single-comic-logo-enabled')?.checked || getOpt('logo_insert', false));
    const brandName = window._globalProfileData?.name || '';
    const message = (document.getElementById('single-comic-message')?.value || '').trim();
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    let successCount = 0;
    let seriesProjectDir = '';
    const total = storyEpisodes.length;

    for (let idx = 0; idx < total; idx++) {
      const draft = storyEpisodes[idx] || {};
      _scsState.episodes[idx] = {
        ..._scsState.episodes[idx],
        episode_number: draft.episode_number || idx + 1,
        title: draft.title || `에피소드 ${idx + 1}`,
        summary: draft.summary || '',
        cliffhanger: draft.cliffhanger || '',
        error: '',
      };
      scsRenderEpisodes();
      if (statusEl) statusEl.textContent = `${idx + 1}/${total}편 생성 중... 생성되는 즉시 아래 결과에 표시합니다.`;

      try {
        const res = await api('/api/comic/story-series/episode', {
          method: 'POST',
          body: {
            message,
            episode_index: idx,
            style: comicStyle,
            layout: scsRecommendedLayout(),
            panel_count: scsPanelCount(),
            brand_name: brandName,
            logo_enabled: logoEnabled,
            logo_text: '',
            profile_id: profileId,
            user_image_urls: scsGetSelectedImageUrls(),
            story_bundle: _scsState.storyBundle,
            series_project_dir: seriesProjectDir,
          },
        });

        const item = res.episode || {};
        seriesProjectDir = res.project_dir || seriesProjectDir;
        _scsState.projectDir = seriesProjectDir;
        _scsState.episodes[idx] = {
          episode_number: item.episode_number || idx + 1,
          title: item.title || draft.title || '',
          summary: item.summary || draft.summary || '',
          cliffhanger: item.cliffhanger || draft.cliffhanger || '',
          imageUrl: scsResolveComicImageUrl(item),
          composedImage: item.composed_image || '',
          projectDir: item.project_dir || '',
          error: item.error || '',
        };
        if (_scsState.episodes[idx].imageUrl) successCount += 1;
      } catch (e) {
        _scsState.episodes[idx] = {
          ..._scsState.episodes[idx],
          error: e.message,
        };
      }
      scsRenderEpisodes();
    }
    if (statusEl) statusEl.textContent = `${successCount}/${total}편 생성 완료`;
    toast(`스토리만화 생성 완료: ${successCount}/${total}편`);
  } catch (e) {
    if (statusEl) statusEl.textContent = '스토리만화 생성 실패';
    toast('스토리만화 생성 실패: ' + e.message, 'error');
  } finally {
    _scsState.generating = false;
    scsRenderPreview();
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg> 이 구성으로 진행';
    }
  }
}

function scsOpenFolder() {
  const dir = _scsState.projectDir || 'output/comics';
  api('/api/open-folder', { method: 'POST', body: { folder: dir } })
    .then(() => toast('폴더 열림'))
    .catch(e => toast('폴더 열기 실패: ' + e.message, 'error'));
}

function scsOpenEpisodeFolder(projectDir) {
  if (!projectDir) return;
  api('/api/open-folder', { method: 'POST', body: { folder: projectDir } })
    .then(() => toast('폴더 열림'))
    .catch(e => toast('폴더 열기 실패: ' + e.message, 'error'));
}

async function scsUploadEpisodeInstagram(episodeNumber) {
  const item = (_scsState.episodes || []).find(ep => Number(ep.episode_number) === Number(episodeNumber));
  if (!item?.composedImage) {
    toast('업로드할 스토리만화 이미지가 없습니다', 'error');
    return;
  }

  try {
    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    const caption = scsBuildEpisodeCaption(item);
    await api('/api/instagram/upload', {
      method: 'POST',
      body: {
        image_paths: [item.composedImage],
        caption,
        profile_id: profileId,
      },
    });
    toast(`${item.episode_number}화 인스타그램 피드 등록 완료!`);
  } catch (e) {
    toast(`인스타그램 피드 등록 실패: ${e.message}`, 'error');
  }
}

async function scsDownloadAll() {
  const images = _scsState.episodes.filter(item => item?.imageUrl);
  if (!images.length) {
    toast('다운로드할 스토리만화가 없습니다', 'error');
    return;
  }
  for (let i = 0; i < images.length; i++) {
    const a = document.createElement('a');
    a.href = images[i].imageUrl.split('?')[0];
    a.download = `comic_episode_${images[i].episode_number || i + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (i < images.length - 1) await new Promise(resolve => setTimeout(resolve, 200));
  }
  toast(`${images.length}개 다운로드 시작`);
}
