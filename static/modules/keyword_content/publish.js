// keyword_content/publish.js — 블로그/SNS/유튜브 플랫폼 발행

async function kcPublishImageBlog() {
  const blogId = getBlogId();
  if (!blogId) { toast('블로그 주소를 먼저 입력하세요', 'error'); return; }
  if (_kcImageBlogSlides.length === 0) { toast('먼저 이미지를 생성하세요', 'error'); return; }
  if (!await kcCheckPublishReady()) return;

  const title = document.getElementById('kc-blog-title').value.trim();
  const tagStr = document.getElementById('kc-blog-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!confirm(`네이버 블로그에 이미지 ${_kcImageBlogSlides.length}장으로 발행할까요?\n\n제목: ${title}`)) return;

  try {
    // 이미지만으로 발행 — 제목 + 이미지들 (본문은 이미지가 대체)
    const pubBtn = document.querySelector('button[onclick="kcPublishImageBlog()"]');
    if (pubBtn) { pubBtn.disabled = true; pubBtn.innerHTML = '<span class="spinner"></span> 발행 중...'; }
    const pubRes = await api('/api/blog/publish', {
      method: 'POST',
      body: {
        post_id: _kcBlogPostId,
        title,
        content: title,  // 제목만 본문으로 (이미지가 본문 역할)
        tags,
        images: _kcImageBlogSlides,
        header_images: kcGetSlotImages().header.map(x => x.url),
        footer_images: kcGetSlotImages().footer.map(x => x.url),
        profile_id: parseInt(window._globalProfileId || 0),
      },
    });
    if (pubBtn) { pubBtn.disabled = false; pubBtn.innerHTML = '네이버에 이미지로 발행'; }
    const blogUrl = pubRes?.result?.url || pubRes?.url || '';
    toast(`네이버 블로그에 상세페이지 이미지 ${_kcImageBlogSlides.length}장으로 발행 완료!` + (blogUrl ? `\n${blogUrl}` : ''));
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

async function kcPublishBlogWithCardnews() {
  const blogId = getBlogId();
  if (!blogId) { toast('상단에 네이버 블로그 주소를 먼저 입력하세요!', 'error'); return; }

  const title = document.getElementById('kc-blog-title').value.trim();
  const content = document.getElementById('kc-blog-body').value.trim();
  const tagStr = document.getElementById('kc-blog-tags').value;
  const tags = tagStr ? tagStr.split(',').map(t => t.trim()).filter(t => t) : [];

  if (!title || !content) { toast('제목과 본문을 입력하세요', 'error'); return; }

  // 카드뉴스 이미지 수집
  const cardnewsImages = [];
  if (_kcCardnewsDir) {
    const cnSlides = document.querySelectorAll('#kc-cardnews-slides img');
    cnSlides.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || '';
      if (src) cardnewsImages.push(src);
    });
  }

  // 기사 이미지 + 내 업로드 이미지 + 카드뉴스 이미지
  const pubImages = [...cardnewsImages];
  _kcSelectedSources.filter(s => s.checked && s.scrapedImages).forEach(s => {
    if (s._selectedImages && s._selectedImages.size > 0) {
      s._selectedImages.forEach(imgIdx => {
        const img = s.scrapedImages[imgIdx];
        if (img && !pubImages.includes(img)) pubImages.push(img);
      });
    }
  });
  _kcUploadedImages.forEach(img => {
    const url = typeof img === 'string' ? img : img.url || img.path;
    if (url && !pubImages.includes(url)) pubImages.push(url);
  });

  if (!confirm(`네이버 블로그(${blogId})에 발행할까요?\n\n제목: ${title}\n이미지: ${pubImages.length}장 (카드뉴스 ${cardnewsImages.length}장 포함)\n태그: ${tags.join(', ')}`)) return;

  try {
    await api('/api/blog/publish', {
      method: 'POST',
      body: {
        post_id: _kcBlogPostId, title, content, tags, images: pubImages,
        header_images: kcGetSlotImages().header.map(x => x.url),
        footer_images: kcGetSlotImages().footer.map(x => x.url),
        profile_id: parseInt(window._globalProfileId || 0),
      },
    });
    toast(`네이버 블로그에 발행 완료! (이미지 ${pubImages.length}장, 카드뉴스 ${cardnewsImages.length}장 포함)`);
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

function kcCopyBlog() {
  const title = document.getElementById('kc-blog-title').value;
  const body = document.getElementById('kc-blog-body').value;
  navigator.clipboard.writeText(title + '\n\n' + body);
  toast('블로그 글이 클립보드에 복사되었습니다.');
}

// ═══ 플랫폼별 업로드 모달 ═══
function openPlatformUploadModal(platform) {
  if (platform !== 'ig') {
    toast('업로드는 인스타그램만 가능합니다.', 'error');
    return;
  }
  // 인라인 옵션 패널 토글
  const rowId = {
    blog: 'kc-upload-blog-row', threads: 'kc-upload-threads-row', twitter: 'kc-upload-twitter-row',
    ig: 'kc-upload-ig-row', youtube: 'kc-upload-youtube-row',
    reels: 'kc-upload-reels-row', tiktok: 'kc-upload-tiktok-row',
  }[platform];
  const row = document.getElementById(rowId);
  if (!row) return;

  // 기존 패널 있으면 토글
  let panel = row.querySelector('.upload-inline-panel');
  if (panel) { panel.remove(); return; }

  // 다른 패널 닫기
  document.querySelectorAll('.upload-inline-panel').forEach(p => p.remove());

  // 데이터 수집
  let threadsText = document.getElementById('kc-sns-threads-text')?.value?.trim() || '';
  let twitterText = document.getElementById('kc-sns-twitter-text')?.value?.trim() || '';
  const cnImages = [];
  document.querySelectorAll('#kc-cardnews-slides img[src*="cardnews"]').forEach(img => cnImages.push(img.src));
  if (cnImages.length === 0) document.querySelectorAll('#proj-content-sections img[src*="cardnews"]').forEach(img => cnImages.push(img.src));
  let hasCn = cnImages.length > 0;
  const comicImg = document.querySelector('#kc-panel-comic img[src*="comic"]')?.src || document.getElementById('kc-comic-image')?.src || document.querySelector('#kc-comic-result img')?.src || document.querySelector('#proj-content-sections img[src*="comic"]')?.src || '';
  const hasComic = !!comicImg;
  const hasVideo = typeof _kcVideoPath !== 'undefined' && !!_kcVideoPath;
  let igCaption = document.getElementById('kc-cn-ig-caption')?.value || '';
  let pa = {};
  try { pa = window._globalProfileData?.platform_accounts ? (typeof window._globalProfileData.platform_accounts === 'string' ? JSON.parse(window._globalProfileData.platform_accounts) : window._globalProfileData.platform_accounts) : {}; } catch {}

  // 모달 대신 인라인 패널 생성 (이전 모달 제거)
  let existing = document.getElementById('platform-upload-modal');
  if (existing) existing.remove();
  const modal = { innerHTML: '', remove: () => {} }; // 호환용 더미

  let body = '';
  let title = '';
  let color = '#ff8c00';

  if (platform === 'blog') {
    title = '네이버 블로그 발행';
    color = '#03c75a';
    const blogTitle = document.getElementById('kc-blog-title')?.value?.trim() || '';
    const blogTags = document.getElementById('kc-blog-tags')?.value?.trim() || '';
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">발행 형태</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <label style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 11px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.08);"><input type="radio" name="pum-blog-type" value="text" checked> 블로그 글</label>
          <label style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 11px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.08);"><input type="radio" name="pum-blog-type" value="detail"> 상세페이지 이미지</label>
        </div>
      </div>
      ${blogTitle ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);margin-bottom:8px;">제목: ${escapeHtml(blogTitle)}</div>` : ''}
      ${blogTags ? `<div style="font-size:11px;color:rgba(0,0,0,0.35);margin-bottom:8px;">태그: ${escapeHtml(blogTags)}</div>` : ''}`;
    window._pumType = 'blog';
  } else if (platform === 'threads') {
    title = '@ 스레드 게시';
    color = '#1c1c1e';
    const defType = pa.upload_threads || 'text';
    const snsOpts = getContentOpts();
    const threadSegments = kcBuildThreadsSegments(threadsText, snsOpts);
    const threadsLengthLabel = {
      short: '짧게',
      medium: '보통',
      long: '길게',
    }[snsOpts?.threads_length || 'medium'];
    const threadsModeLabel = (snsOpts?.threads_mode || 'auto') === 'single' ? '한 번에 맞춰 줄임' : '자동 이어쓰기';
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">게시 내용</label>
        <textarea id="pum-threads-text" rows="4" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${escapeHtml(threadsText)}</textarea>
        <div style="font-size:10px;color:${threadSegments.length > 1 ? '#ff9500' : 'rgba(0,0,0,0.3)'};margin-top:4px;text-align:right;">${threadsText.length}자 · ${threadSegments.length > 1 ? `${threadSegments.length}개 스레드로 나눠 게시` : '한 번에 게시'} · ${threadsLengthLabel} / ${threadsModeLabel}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">게시 형태</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <label class="upload-type-chip" style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 11px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.08);transition:all 0.18s ease;"><input type="radio" name="pum-threads-type" value="text" ${defType==='text'||!hasCn?'checked':''}> 텍스트</label>
          <label class="upload-type-chip" style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:6px 11px;background:#fff;border-radius:10px;border:1px solid rgba(0,0,0,0.08);transition:all 0.18s ease;${hasCn?'':'opacity:0.35;pointer-events:none;'}"><input type="radio" name="pum-threads-type" value="cardnews" ${defType==='cardnews'&&hasCn?'checked':''}> 카드뉴스 ${hasCn?cnImages.length+'장':''}</label>
        </div>
      </div>`;
    window._pumType = defType === 'cardnews' && hasCn ? 'cardnews' : 'text';
  } else if (platform === 'twitter') {
    title = '𝕏 트위터 게시';
    color = '#1da1f2';
    const defTwitter = pa.upload_twitter || 'text';
    const safeTwitterText = normalizeTwitterPostText(twitterText);
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">게시 내용</label>
        <textarea id="pum-twitter-text" rows="4" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${escapeHtml(safeTwitterText)}</textarea>
        <div id="pum-twitter-counter" style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;text-align:right;"></div>
        <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:4px;">무료 기준에서 막히지 않게 250자 안쪽으로 자동 정리해서 올립니다.</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">게시 형태</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <label style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;background:#fff;border-radius:6px;border:1px solid rgba(0,0,0,0.08);"><input type="radio" name="pum-twitter-type" value="text" checked> 텍스트</label>
          <label style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;background:#fff;border-radius:6px;border:1px solid rgba(0,0,0,0.08);${hasCn?'':'opacity:0.35;pointer-events:none;'}"><input type="radio" name="pum-twitter-type" value="cardnews"> 카드뉴스 ${hasCn?cnImages.length+'장':''}</label>
          <label style="font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:5px 10px;background:#fff;border-radius:6px;border:1px solid rgba(0,0,0,0.08);${hasComic?'':'opacity:0.35;pointer-events:none;'}"><input type="radio" name="pum-twitter-type" value="comic"> 만화</label>
        </div>
      </div>`;
    window._pumType = defTwitter;
  } else if (platform === 'ig') {
    title = '📷 인스타그램 업로드';
    color = '#e1306c';
    const defReels = pa.upload_ig_reels || 'none';
    const defStory = pa.upload_ig_story || 'none';
    const defaultIgTarget = (() => {
      if (hasVideo && defReels !== 'none') return 'reels';
      if ((hasCn || hasVideo) && defStory !== 'none') return 'story';
      if (hasVideo) return 'reels';
      if (hasCn || hasComic) return 'story';
      return '';
    })();
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">캡션</label>
        <textarea id="pum-ig-caption" rows="3" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${escapeHtml(igCaption)}</textarea>
      </div>
      <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-bottom:8px;">지금은 한 번에 하나만 업로드합니다. 릴스 또는 스토리 중 하나만 선택하세요.</div>
      <table style="width:100%;margin-bottom:16px;border-collapse:separate;border-spacing:0 6px;">
        <tr style="background:${hasVideo?'rgba(225,48,108,0.04)':'rgba(0,0,0,0.02)'};${hasVideo?'':'opacity:0.4;'}">
          <td style="padding:10px;border-radius:10px 0 0 10px;"><input type="radio" name="pum-ig-target" value="reels" ${defaultIgTarget==='reels'?'checked':''} ${hasVideo?'':'disabled'}></td>
          <td style="padding:10px;white-space:nowrap;"><b style="font-size:13px;">릴스</b> <span style="font-size:10px;color:rgba(0,0,0,0.35);">${hasVideo?'준비됨':'없음'}</span></td>
          <td style="padding:10px;border-radius:0 10px 10px 0;text-align:right;"><select id="pum-ig-reels-type" style="padding:4px 8px;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);" ${hasVideo?'':'disabled'}><option value="slide" ${defReels==='slide'?'selected':''}>슬라이드</option><option value="veo" ${defReels==='veo'?'selected':''}>AI영상</option></select></td>
        </tr>
        <tr style="background:${(hasCn||hasVideo||hasComic)?'rgba(225,48,108,0.04)':'rgba(0,0,0,0.02)'};${(hasCn||hasVideo||hasComic)?'':'opacity:0.4;'}">
          <td style="padding:10px;border-radius:10px 0 0 10px;"><input type="radio" name="pum-ig-target" value="story" ${defaultIgTarget==='story'?'checked':''} ${(hasCn||hasVideo||hasComic)?'':'disabled'}></td>
          <td style="padding:10px;white-space:nowrap;"><b style="font-size:13px;">스토리</b> <span style="font-size:10px;color:rgba(0,0,0,0.35);">${hasCn&&hasVideo?'이미지/영상':hasCn?'이미지':hasVideo?'영상':'없음'}</span></td>
          <td style="padding:10px;border-radius:0 10px 10px 0;text-align:right;"><select id="pum-ig-story-type" style="padding:4px 8px;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.1);" ${(hasCn||hasVideo||hasComic)?'':'disabled'}><option value="image" ${defStory==='image'?'selected':''} ${hasCn?'':'disabled'}>카드뉴스</option><option value="comic" ${defStory==='comic'?'selected':''} ${hasComic?'':'disabled'}>만화</option><option value="slide" ${defStory==='slide'?'selected':''} ${hasVideo?'':'disabled'}>슬라이드</option><option value="veo" ${defStory==='veo'?'selected':''} ${hasVideo?'':'disabled'}>AI영상</option></select></td>
        </tr>
      </table>`;
  } else if (platform === 'youtube') {
    title = '▶ 유튜브 쇼츠 업로드';
    color = '#ff0000';
    const keyword = document.getElementById('kc-keyword')?.value || '';
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">제목</label>
        <input type="text" id="pum-yt-title" value="${escapeHtml(keyword)}" style="width:100%;padding:10px 14px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">설명</label>
        <textarea id="pum-yt-desc" rows="3" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;" placeholder="영상 설명 (선택)"></textarea>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">공개 설정</label>
        <select id="pum-yt-privacy" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);">
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </div>
      ${hasVideo ? '' : '<div style="padding:12px;background:rgba(255,0,0,0.05);border-radius:8px;font-size:12px;color:#ff0000;margin-bottom:14px;">영상이 없습니다. 먼저 영상을 생성하세요.</div>'}`;
    window._pumType = 'youtube';
  } else if (platform === 'tiktok') {
    title = '♪ 틱톡 업로드';
    color = '#1c1c1e';
    body = `
      <div style="padding:16px;background:rgba(0,0,0,0.03);border-radius:10px;margin-bottom:14px;">
        <div style="font-size:13px;color:#1c1c1e;line-height:1.6;">틱톡은 자동 업로드가 지원되지 않습니다.<br>아래 버튼을 누르면:</div>
        <ul style="font-size:12px;color:rgba(0,0,0,0.5);margin:8px 0 0 16px;line-height:1.8;">
          <li>틱톡 업로드 페이지가 열립니다</li>
          <li>영상 폴더가 열립니다</li>
          <li>영상 파일을 드래그하여 업로드하세요</li>
        </ul>
      </div>
      ${hasVideo ? '' : '<div style="padding:12px;background:rgba(255,140,0,0.05);border-radius:8px;font-size:12px;color:#ff8c00;margin-bottom:14px;">영상이 없습니다. 먼저 영상을 생성하세요.</div>'}`;
    window._pumType = 'tiktok';
  } else if (platform === 'reels') {
    title = '📷 인스타 릴스 업로드';
    color = '#e1306c';
    const igCaption = document.getElementById('kc-cn-ig-caption')?.value || '';
    body = `
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">캡션</label>
        <textarea id="pum-reels-caption" rows="3" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${escapeHtml(igCaption)}</textarea>
      </div>
      ${hasVideo ? `<div style="padding:12px;background:rgba(225,48,108,0.04);border-radius:8px;font-size:12px;color:#e1306c;margin-bottom:14px;">영상이 준비되었습니다. 릴스로 업로드합니다.</div>` : '<div style="padding:12px;background:rgba(255,0,0,0.05);border-radius:8px;font-size:12px;color:#ff0000;margin-bottom:14px;">영상이 없습니다. 먼저 영상을 생성하세요.</div>'}`;
    window._pumType = 'reels';
  }

  // 인라인 패널 렌더링
  panel = document.createElement('div');
  panel.className = 'upload-inline-panel';
  panel.style.cssText = 'margin-top:12px;padding:16px;background:rgba(0,0,0,0.02);border:1px solid rgba(0,0,0,0.06);border-radius:12px;animation:fadeIn 0.2s;';
  panel.innerHTML = `
    ${body}
    <button onclick="_doPlatformUpload('${platform}')" style="width:100%;padding:12px;background:${color};color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
      게시하기
    </button>
  `;
  row.appendChild(panel);
  if (platform === 'threads') bindUploadTypeChips('pum-threads-type');
  if (platform === 'twitter') bindTwitterComposerCounter('pum-twitter-text', 'pum-twitter-counter');
}

// 발행 중단용 AbortController

async function _doPlatformUpload(platform) {
  if (platform !== 'ig') {
    toast('업로드는 인스타그램만 가능합니다.', 'error');
    return;
  }
  const btn = document.getElementById(`kc-upload-${platform}-btn`);
  if (btn?.disabled) return;
  // CDP 플랫폼은 한 번에 하나만 실행
  const cdpPlatforms = ['blog', 'threads', 'twitter', 'tiktok'];
  if (cdpPlatforms.includes(platform)) {
    if (_cdpUploadLock) {
      toast('다른 업로드가 진행 중입니다. 완료 후 시도하세요.', 'error');
      return;
    }
    _cdpUploadLock = true;
  }
  const origHtml = btn?.innerHTML || '';
  const row = document.getElementById(`kc-upload-${platform}-row`);

  // 중단 버튼 표시
  _kcUploadAbort = new AbortController();
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>';
  }
  let stopBtn = null;
  if (row) {
    stopBtn = document.createElement('button');
    stopBtn.id = `kc-upload-${platform}-stop`;
    stopBtn.style.cssText = 'padding:6px 14px;background:rgba(255,59,48,0.1);color:#ff3b30;border:1px solid rgba(255,59,48,0.2);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px;';
    stopBtn.textContent = '중단';
    stopBtn.onclick = () => {
      _kcUploadAbort?.abort();
      _cdpUploadLock = false;
      // CDP 경고 배너 제거
      document.getElementById('kc-cdp-warning')?.remove();
      document.getElementById('kc-cdp-log')?.remove();
      // 버튼 복원
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; btn.style.opacity = '1'; }
      stopBtn.remove();
      toast('업로드 중단됨', 'error');
    };
    btn.parentElement.appendChild(stopBtn);
  }

  // 재시도 UI 헬퍼
  function showRetryUI(errMsg) {
    if (stopBtn) stopBtn.remove();
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; btn.style.opacity = '1'; }
    // 재시도 바 표시
    let retryBar = document.getElementById(`kc-upload-${platform}-retry`);
    if (retryBar) retryBar.remove();
    retryBar = document.createElement('div');
    retryBar.id = `kc-upload-${platform}-retry`;
    retryBar.style.cssText = 'margin-top:8px;padding:10px 14px;background:rgba(255,59,48,0.06);border:1px solid rgba(255,59,48,0.15);border-radius:10px;display:flex;align-items:center;gap:10px;';
    retryBar.innerHTML = `
      <span style="flex:1;font-size:12px;color:#ff3b30;line-height:1.4;">${errMsg.length > 80 ? errMsg.substring(0,80) + '...' : errMsg}</span>
      <button onclick="document.getElementById('kc-upload-${platform}-retry')?.remove();_doPlatformUpload('${platform}')" style="padding:6px 16px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">재시도</button>
    `;
    if (row) row.appendChild(retryBar);
  }

  let cdpLogInterval = null;
  try {
    // Chrome 연결 필수 확인 — 프로필 설정 → 같은 프로필인지 → 자동 연결
    if (['threads', 'twitter', 'ig', 'blog', 'tiktok'].includes(platform)) {
      const profileDir = getPreferredChromeProfileDir();
      if (!profileDir) throw new Error('Chrome 프로필이 설정되어 있지 않습니다. 프로필 편집에서 Chrome 프로필을 연결하세요.');
      // 다른 프로필로 연결되어 있으면 재연결
      if (window._connectedChromeProfileDir && window._connectedChromeProfileDir !== profileDir) {
        const label = typeof _getChromeProfileLabel === 'function' ? _getChromeProfileLabel(profileDir) : profileDir;
        toast(`${label} 프로필로 재연결 중...`, 'info');
        await connectChrome(true, true);
        await new Promise(r => setTimeout(r, 3000));
      }
      const status = await api('/api/browser/status');
      if (!status.connected) {
        toast('Chrome 자동 연결 중...', 'info');
        await connectChrome(true, true);
        await new Promise(r => setTimeout(r, 3000));
        const retry = await api('/api/browser/status');
        if (!retry.connected) {
          if (typeof _showExtensionSetupBanner === 'function') _showExtensionSetupBanner();
          throw new Error('Chrome 확장프로그램이 연결되지 않았습니다. 상단의 "자동 설정" 버튼을 눌러 설정해주세요.');
        }
      }
    }
    // 중단 체크
    if (_kcUploadAbort?.signal?.aborted) throw new Error('업로드가 중단되었습니다');

    // CDP 플랫폼: 경고 배너 + 실시간 로그 패널
    const cdpPlatforms = ['blog', 'threads', 'twitter', 'tiktok'];
    let cdpWarning = null;
    let cdpLogPanel = null;
    if (cdpPlatforms.includes(platform)) {
      const names = { blog: '네이버 블로그', threads: '스레드', twitter: '트위터' };
      // 경고 배너
      cdpWarning = document.createElement('div');
      cdpWarning.id = 'kc-cdp-warning';
      cdpWarning.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 20px;background:linear-gradient(135deg,#ff3b30,#ff6b00);color:#fff;font-size:13px;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 20px rgba(255,59,48,0.3);animation:kcCdpPulse 2s infinite;';
      cdpWarning.innerHTML = `<style>@keyframes kcCdpPulse{0%,100%{opacity:1}50%{opacity:0.85}}</style><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${names[platform]} 발행 중 — 크롬 브라우저를 절대 건드리지 마세요!`;
      document.body.appendChild(cdpWarning);
      // 실시간 로그 패널
      cdpLogPanel = document.createElement('div');
      cdpLogPanel.id = 'kc-cdp-log';
      cdpLogPanel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99998;max-height:180px;overflow-y:auto;background:rgba(0,0,0,0.92);color:#0f0;font-family:monospace;font-size:11px;padding:10px 16px;line-height:1.6;box-shadow:0 -4px 20px rgba(0,0,0,0.3);';
      cdpLogPanel.innerHTML = '<div style="color:rgba(255,255,255,0.4);margin-bottom:4px;">📡 CDP 로그</div>';
      document.body.appendChild(cdpLogPanel);
      // 폴링으로 로그 가져오기
      let lastLogLen = 0;
      cdpLogInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/browser/logs?lines=20');
          const data = await res.json();
          const logs = data.logs || [];
          if (logs.length > lastLogLen) {
            const newLogs = logs.slice(lastLogLen);
            newLogs.forEach(l => {
              const line = document.createElement('div');
              line.textContent = l;
              line.style.color = l.includes('실패') || l.includes('error') || l.includes('Error') ? '#ff6b6b' : l.includes('완료') || l.includes('성공') ? '#69db7c' : '#0f0';
              cdpLogPanel.appendChild(line);
            });
            lastLogLen = logs.length;
            cdpLogPanel.scrollTop = cdpLogPanel.scrollHeight;
          }
        } catch {}
      }, 1000);
    }

    let url = '';
    if (platform === 'blog') {
      const blogType = document.querySelector('input[name="kc-up-blog-type"]:checked')?.value || 'text';
      if (blogType === 'detail') {
        // 글 + 상세페이지 이미지
        if (!_kcImageBlogSlides || _kcImageBlogSlides.length === 0) throw new Error('상세페이지 이미지가 없습니다. 먼저 생성하세요.');
        const title = document.getElementById('kc-blog-title')?.value?.trim();
        const content = document.getElementById('kc-blog-body')?.value?.trim();
        const tags = (document.getElementById('kc-blog-tags')?.value || '').split(',').map(t=>t.trim()).filter(t=>t);
        if (!title || !content) throw new Error('제목과 본문을 입력하세요');
        // 상세페이지 이미지 + 블로그 이미지 + 선택 이미지
        const detailImgs = _kcImageBlogSlides.map(u => u.split('?')[0]);
        const blogGenImages = (window._kcBlogImages || []).map(x => x.url);
        const selectedImages = (_kcFinalImages || []).filter(x => x.selected).map(x => x.url);
        const allImages = [...detailImgs, ...blogGenImages, ...selectedImages];
        await api('/api/blog/publish', {
          method: 'POST',
          body: { post_id: _kcBlogPostId, title, content, tags, images: allImages }
        });
        toast(`네이버 블로그 발행 완료! (글 + 상세페이지 ${detailImgs.length}장 + 이미지 ${blogGenImages.length + selectedImages.length}장)`);
      } else if (blogType === 'text+cardnews') {
        // 글 + 카드뉴스 이미지
        if (!_kcCardnewsDir) throw new Error('카드뉴스가 없습니다. 먼저 생성하세요.');
        await kcPublishBlogWithCardnews();
      } else if (blogType === 'text+comic') {
        // 글 + 만화 이미지 (DOM 우선, 없으면 kc-comic-image 또는 kc-comic-result에서 탐색)
        const comicImg = document.querySelector('#kc-panel-comic img[src*="comic"]')?.src
          || document.getElementById('kc-comic-image')?.src
          || document.querySelector('#kc-comic-result img')?.src
          || '';
        if (!comicImg) throw new Error('만화가 없습니다. 먼저 만화를 생성하세요.');
        const pubImages = [comicImg];
        const blogGenImages = (window._kcBlogImages || []).map(x => x.url);
        await api('/api/blog/publish', {
          method: 'POST',
          body: { post_id: _kcBlogPostId, title: document.getElementById('kc-blog-title')?.value?.trim(), content: document.getElementById('kc-blog-body')?.value?.trim(), tags: (document.getElementById('kc-blog-tags')?.value || '').split(',').map(t=>t.trim()).filter(t=>t), images: [...pubImages, ...blogGenImages] }
        });
        toast('네이버 블로그 발행 완료! (글 + 만화)');
      } else if (blogType === 'text+image') {
        // 글 + 이미지
        const hasImages = (_kcFinalImages || []).some(x => x.selected) || (window._kcBlogImages || []).length > 0;
        if (!hasImages) throw new Error('이미지가 없습니다. 3단계에서 이미지를 선택하거나 생성하세요.');
        await kcPublishBlog();
      } else {
        // 글만
        await kcPublishBlog();
      }
      const blogId = getBlogId();
      url = blogId ? `https://blog.naver.com/${blogId}` : '';
    } else if (platform === 'threads') {
      // 모달 textarea 우선, 없으면 원본 textarea
      const pumThreads = document.getElementById('pum-threads-text');
      const rawThreads = (pumThreads?.value ?? '') || document.getElementById('kc-sns-threads-text')?.value || '';
      if (pumThreads?.value) {
        const origEl = document.getElementById('kc-sns-threads-text');
        if (origEl) origEl.value = pumThreads.value;
      }
      const text = normalizeThreadsText(rawThreads);
      if (!text) throw new Error('게시할 내용이 없습니다');
      const segments = kcBuildThreadsSegments(text);
      const type = document.querySelector('input[name="kc-up-threads-type"]:checked')?.value || 'text';
      const body = { text, segments };
      if (type === 'cardnews' || type === 'comic') {
        const imgs = [];
        const selector = type === 'comic' ? '#kc-panel-comic img[src*="comic"], #proj-content-sections img[src*="comic"]' : '#kc-cardnews-slides img[src*="cardnews"], #proj-content-sections img[src*="cardnews"]';
        document.querySelectorAll(selector).forEach(img => imgs.push(img.src));
        if (imgs.length) body.images = imgs;
      }
      await api('/api/threads/post', { method: 'POST', body });
      toast(`스레드 게시 완료!${segments.length > 1 ? ` (${segments.length}개 이어쓰기)` : ''}`);
    } else if (platform === 'twitter') {
      // 모달 textarea 우선, 없으면 원본 textarea
      const pumTwitter = document.getElementById('pum-twitter-text');
      const rawText = (pumTwitter?.value ?? '') || document.getElementById('kc-sns-twitter-text')?.value || '';
      // 모달에서 수정한 내용을 원본에도 반영
      if (pumTwitter?.value) {
        const origEl = document.getElementById('kc-sns-twitter-text');
        if (origEl) origEl.value = pumTwitter.value;
      }
      const text = normalizeTwitterPostText(rawText);
      if (!text) throw new Error('게시할 내용이 없습니다');
      const type = document.querySelector('input[name="kc-up-twitter-type"]:checked')?.value || 'text';
      const body = { text };
      if (type === 'cardnews' || type === 'comic') {
        const imgs = [];
        const selector = type === 'comic' ? '#kc-panel-comic img[src*="comic"], #proj-content-sections img[src*="comic"]' : '#kc-cardnews-slides img[src*="cardnews"], #proj-content-sections img[src*="cardnews"]';
        document.querySelectorAll(selector).forEach(img => imgs.push(img.src));
        if (imgs.length) body.images = imgs;
      }
      await api('/api/twitter/post', { method: 'POST', body });
      toast('트위터 게시 완료!');
    } else if (platform === 'ig') {
      const igTarget = document.querySelector('input[name="pum-ig-target"]:checked')?.value || '';
      let igCaption = document.getElementById('pum-ig-caption')?.value?.trim() || document.getElementById('kc-cn-ig-caption')?.value?.trim() || '';
      const profileId = parseInt(window._globalProfileId || 0);
      // 캡션이 비어있으면 자동 생성 (제목 + 본문 + 해시태그 구조)
      if (!igCaption) {
        const keyword = document.getElementById('kc-keyword')?.value?.trim() || '';
        const blogTitle = document.getElementById('kc-blog-title')?.value?.trim() || '';
        const blogBody = document.getElementById('kc-blog-body')?.value?.trim() || '';
        const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';
        const title = (blogTitle || keyword).substring(0, 30);
        const body = blogBody ? blogBody.substring(0, 200).replace(/\n+/g, ' ').trim() : keyword;
        const tags = '#' + (keyword || '마케팅').replace(/\s+/g, ' ').split(' ').filter(w=>w).slice(0,5).join(' #');
        igCaption = `${title}\n\n${body}\n\n${tags}`;
        const el = document.getElementById('kc-cn-ig-caption');
        if (el) el.value = igCaption;
      }
      if (!igTarget) throw new Error('인스타그램 업로드 타입을 하나 선택하세요.');

      if (igTarget === 'feed') {
        throw new Error('현재 화면에서는 해당 게시 방식을 사용하지 않습니다.');
      } else if (igTarget === 'reels') {
        const reelsType = document.getElementById('pum-ig-reels-type')?.value || 'slide';
        const vPath = reelsType === 'veo' ? _kcVideoPath : (_kcVideoPathSlide || _kcVideoPath);
        if (!vPath) throw new Error('영상이 없습니다');
        await api('/api/instagram/reels', { method: 'POST', body: { video_path: vPath, caption: igCaption, profile_id: profileId } });
        toast('인스타 릴스 업로드 완료!');
      } else if (igTarget === 'story') {
        const storyType = document.getElementById('pum-ig-story-type')?.value || 'image';
        const storyBody = { caption: igCaption, profile_id: profileId, image_paths: [], video_path: '' };
        if (storyType === 'image') {
          const imgs = [];
          document.querySelectorAll('#kc-cardnews-slides img').forEach(img => { if (img.src) imgs.push(img.src); });
          if (!imgs.length) throw new Error('카드뉴스 이미지가 없습니다');
          storyBody.image_paths = imgs;
        } else if (storyType === 'comic') {
          const comicImg = document.querySelector('#kc-panel-comic img[src*="comic"]')?.src || document.getElementById('kc-comic-image')?.src || '';
          if (!comicImg) throw new Error('만화가 없습니다');
          storyBody.image_paths = [comicImg];
        } else if (storyType === 'slide') {
          if (!_kcVideoPathSlide) throw new Error('슬라이드 영상이 없습니다');
          storyBody.video_path = _kcVideoPathSlide;
        } else if (storyType === 'veo') {
          if (!_kcVideoPath) throw new Error('AI 영상이 없습니다');
          storyBody.video_path = _kcVideoPath;
        }
        await api('/api/instagram/story', { method: 'POST', body: storyBody });
        toast(`인스타 스토리 업로드 완료! (${storyType})`);
      }
    } else if (platform === 'youtube') {
      if (!_kcVideoPath && !_kcVideoPathSlide) throw new Error('영상이 없습니다');
      const keyword = document.getElementById('kc-keyword')?.value || '';
      const ytPrivacy = document.getElementById('kc-up-yt-privacy')?.value || 'public';
      const ytType = document.querySelector('input[name="kc-up-yt-type"]:checked')?.value || 'slide';
      const videoPath = ytType === 'ai' ? _kcVideoPath : (_kcVideoPathSlide || _kcVideoPath);
      const result = await api('/api/upload/youtube', {
        method: 'POST',
        body: { video_path: videoPath, title: keyword || '영상', description: '', privacy_status: ytPrivacy, is_shorts: true, profile_id: parseInt(window._globalProfileId || 0) }
      });
      url = result.url || '';
      toast('유튜브 쇼츠 업로드 완료!');
      if (url) window.open(url, '_blank');
    } else if (platform === 'reels') {
      if (!_kcVideoPath) throw new Error('영상이 없습니다');
      const reelsCaption = document.getElementById('kc-cn-ig-caption')?.value?.trim() || '';
      await api('/api/instagram/reels', { method: 'POST', body: { video_path: _kcVideoPath, caption: reelsCaption, profile_id: parseInt(window._globalProfileId || 0) } });
      toast('인스타 릴스 업로드 완료!');
    } else if (platform === 'tiktok') {
      if (!_kcVideoPath && !_kcVideoPathSlide) throw new Error('영상이 없습니다');
      const tiktokType = document.querySelector('input[name="kc-up-tiktok-type"]:checked')?.value || 'slide';
      const videoPath = tiktokType === 'ai' ? _kcVideoPath : (_kcVideoPathSlide || _kcVideoPath);
      const caption = document.getElementById('kc-sns-threads-text')?.value?.trim()?.substring(0, 150) || document.getElementById('kc-keyword')?.value || '';
      const tiktokRes = await api('/api/tiktok/upload', {
        method: 'POST',
        body: { video_path: videoPath, caption, profile_id: parseInt(window._globalProfileId || 0) }
      });
      url = tiktokRes.url || '';
      toast(tiktokRes.message || '틱톡 업로드 완료!');
      if (url) window.open(url, '_blank');
    }

    // 프로젝트에 업로드 상태 저장
    if (_kcProjectId) {
      const updateData = {};
      updateData[platform + '_uploaded_at'] = new Date().toISOString();
      if (url) updateData[platform + '_url'] = url;
      try { await api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: updateData }); } catch {}
    }

    // 성공: 경고/로그/중단 버튼 제거, 재시도 바 제거
    if (cdpLogInterval) clearInterval(cdpLogInterval);
    setTimeout(() => {
      document.getElementById('kc-cdp-warning')?.remove();
      document.getElementById('kc-cdp-log')?.remove();
    }, 2000);
    if (stopBtn) stopBtn.remove();
    document.getElementById(`kc-upload-${platform}-retry`)?.remove();
    _kcUploadAbort = null;
    _cdpUploadLock = false;
    kcShowUploadSuccess(platform, url);
  } catch (e) {
    if (cdpLogInterval) clearInterval(cdpLogInterval);
    document.getElementById('kc-cdp-warning')?.remove();
    setTimeout(() => document.getElementById('kc-cdp-log')?.remove(), 5000);
    toast(e.message, 'error');
    _kcUploadAbort = null;
    _cdpUploadLock = false;
    showRetryUI(e.message);
  }
}

async function kcUploadThreads() {
  const text = normalizeThreadsText(document.getElementById('kc-sns-threads-text')?.value);
  if (!text) { toast('스레드 글이 없습니다', 'error'); return; }
  const segments = kcBuildThreadsSegments(text);

  // 프로필 업로드 설정 확인
  let uploadType = 'text';
  try {
    const pa = window._globalProfileData?.platform_accounts ?
      (typeof window._globalProfileData.platform_accounts === 'string' ? JSON.parse(window._globalProfileData.platform_accounts) : window._globalProfileData.platform_accounts) : {};
    uploadType = pa.upload_threads || 'text';
  } catch {}

  // 카드뉴스 이미지 수집
  let cnImages = [];
  if (uploadType === 'cardnews') {
    document.querySelectorAll('#kc-cardnews-slides img[src*="cardnews"]').forEach(img => cnImages.push(img.src));
    if (cnImages.length === 0) {
      toast('카드뉴스 이미지가 없어 텍스트로 게시합니다');
      uploadType = 'text';
    }
  }

  const btn = event?.target?.closest('button');
  try {
    const status = await api('/api/browser/status');
    if (status.connected) {
      const typeLabel = uploadType === 'cardnews' ? `카드뉴스 ${cnImages.length}장 + 텍스트` : '텍스트';
      if (!confirm(`스레드에 게시할까요? (${typeLabel})\n\n${text.substring(0, 100)}...`)) return;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 게시 중...'; }
      const body = { text, segments };
      if (uploadType === 'cardnews' && cnImages.length > 0) body.images = cnImages;
      await api('/api/threads/post', { method: 'POST', body });
      if (btn) { btn.innerHTML = '✓ 게시 완료'; btn.style.background = '#34c759'; }
      toast(`스레드 게시 완료!${segments.length > 1 ? ` (${segments.length}개 이어쓰기)` : ''}`);
    } else {
      await navigator.clipboard.writeText(text);
      toast('Chrome 미연결 — 글이 복사되었습니다. threads.net에서 붙여넣기하세요.');
      window.open('https://www.threads.net', '_blank');
    }
  } catch (e) {
    await navigator.clipboard.writeText(text);
    toast('자동 게시 실패 — 글이 복사되었습니다.');
    window.open('https://www.threads.net', '_blank');
    if (btn) { btn.disabled = false; }
  }
}

async function kcUploadTwitter() {
  const text = normalizeTwitterPostText(document.getElementById('kc-sns-twitter-text')?.value);
  if (!text) { toast('트위터 글이 없습니다', 'error'); return; }
  const btn = event?.target?.closest('button');
  try {
    const status = await api('/api/browser/status');
    if (status.connected) {
      if (!confirm(`트위터(X)에 게시할까요?\n\n${text.substring(0, 100)}...`)) return;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 게시 중...'; }
      await api('/api/twitter/post', { method: 'POST', body: { text } });
      if (btn) { btn.innerHTML = '✓ 게시 완료'; btn.style.background = '#34c759'; }
      toast('트위터 게시 완료!');
    } else {
      await navigator.clipboard.writeText(text);
      toast('Chrome 미연결 — 글이 복사되었습니다.');
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
  } catch (e) {
    await navigator.clipboard.writeText(text);
    toast('자동 게시 실패 — 글이 복사되었습니다.');
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    if (btn) { btn.disabled = false; }
  }
}
