function hardRefreshApp() {
  try {
    if (window._trendAbort) window._trendAbort.abort();
  } catch {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_reload', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

function openScreenTestTarget(page) {
  try {
    const link = document.querySelector(`.sidebar nav a[data-page="${page}"]`);
    if (link) {
      link.click();
      return;
    }
    document.querySelectorAll('.sidebar nav a').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    document.getElementById('page-' + page)?.classList.add('active');
  } catch (e) {
    toast('화면 이동 실패: ' + e.message, 'error');
  }
}

// ---- 블로그 글 선택 모달 (검색+정렬+페이징) ----
const BLOG_PAGE_SIZE = 8;
let _blogPickerPage = 0;

async function openBlogPickerModal() {
  _blogPickerPage = 0;
  document.getElementById('cv-blog-picker-modal').style.display = 'block';
  await loadBlogPickerPage(0);
}

async function loadBlogPickerPage(page) {
  _blogPickerPage = page;
  const list = document.getElementById('cv-blog-picker-list');
  const paging = document.getElementById('cv-blog-picker-paging');
  list.innerHTML = '<div style="text-align:center;padding:30px;"><span class="spinner"></span></div>';

  try {
    const searchQ = (document.getElementById('cv-blog-search')?.value || '').trim();
    const sortVal = document.getElementById('cv-blog-sort')?.value || 'newest';
    const res = await api(`/api/blog/posts?limit=${BLOG_PAGE_SIZE}&offset=${page * BLOG_PAGE_SIZE}&q=${encodeURIComponent(searchQ)}&sort=${sortVal}`);
    const items = res.posts || [];
    const total = res.total || 0;
    const totalPages = Math.ceil(total / BLOG_PAGE_SIZE);

    if (items.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">블로그 글이 없습니다.</div>';
      paging.innerHTML = '';
      return;
    }

    list.innerHTML = items.map(post => {
      const date = post.created_at ? post.created_at.slice(0, 16).replace('T', ' ') : '';
      const preview = (post.content || '').replace(/<[^>]+>/g, '').substring(0, 80);
      const statusBadge = post.status === 'published'
        ? '<span style="background:rgba(76,175,80,0.15);color:#4caf50;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">발행됨</span>'
        : '<span style="background:rgba(255,159,10,0.15);color:#ff9f0a;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;">초안</span>';
      return `<div onclick="selectBlogFromPicker(${post.id}, '${escapeHtml((post.title || '').replace(/'/g, "\\'"))}')"
        style="padding:14px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;border-radius:10px;transition:background 0.15s;"
        onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          ${statusBadge}
          <div style="font-size:14px;font-weight:600;color:#f5f5f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${escapeHtml(post.title || '제목 없음')}</div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-bottom:2px;">${date}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preview)}</div>
      </div>`;
    }).join('');

    if (totalPages > 1) {
      let btns = '';
      if (page > 0) btns += `<button class="btn btn-secondary btn-sm" onclick="loadBlogPickerPage(${page - 1})">이전</button>`;
      btns += `<span style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 10px;">${page + 1} / ${totalPages}</span>`;
      if (page < totalPages - 1) btns += `<button class="btn btn-secondary btn-sm" onclick="loadBlogPickerPage(${page + 1})">다음</button>`;
      paging.innerHTML = btns;
    } else {
      paging.innerHTML = '';
    }
  } catch (e) {
    list.innerHTML = `<div style="color:#ff453a;padding:16px;">불러오기 실패: ${escapeHtml(e.message)}</div>`;
  }
}

function selectBlogFromPicker(id, title) {
  _cvSelectedBlog = { id, title };
  // 버튼 텍스트 업데이트
  document.getElementById('cv-blog-picker-btn').innerHTML = `<span style="color:#5b9bf5;font-weight:600;">${escapeHtml(title || '글 #' + id)}</span> <span style="color:rgba(255,255,255,0.3);font-size:12px;">변경</span>`;
  document.getElementById('cv-blog-picker-modal').style.display = 'none';
  // 미리보기 + 액션 카드 직접 표시
  const preview = document.getElementById('cv-preview');
  document.getElementById('cv-preview-title').textContent = title;
  document.getElementById('cv-preview-meta').textContent = '블로그 글';
  document.getElementById('cv-preview-images').innerHTML = '';
  preview.style.display = 'block';
  document.getElementById('cv-actions-card').style.display = 'block';
  toast('블로그 글 선택: ' + (title || '#' + id));
}

// ---- 카드뉴스 선택 모달 (검색+정렬+페이징) ----
const CN_PAGE_SIZE = 8;
let _cnPickerPage = 0;

async function openCnPickerModal() {
  _cnPickerPage = 0;
  document.getElementById('cv-cn-picker-modal').style.display = 'block';
  await loadCnPickerPage(0);
}

async function loadCnPickerPage(page) {
  _cnPickerPage = page;
  const list = document.getElementById('cv-cn-picker-list');
  const paging = document.getElementById('cv-cn-picker-paging');
  list.innerHTML = '<div style="text-align:center;padding:30px;"><span class="spinner"></span></div>';

  try {
    const searchQ = (document.getElementById('cv-cn-search')?.value || '').trim();
    const sortVal = document.getElementById('cv-cn-sort')?.value || 'newest';
    const res = await api(`/api/cardnews/history?limit=${CN_PAGE_SIZE}&offset=${page * CN_PAGE_SIZE}&q=${encodeURIComponent(searchQ)}&sort=${sortVal}`);
    const items = res.items || [];
    const total = res.total || 0;
    const totalPages = Math.ceil(total / CN_PAGE_SIZE);

    if (items.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">카드뉴스가 없습니다.</div>';
      paging.innerHTML = '';
      return;
    }

    list.innerHTML = items.map(item => {
      const thumbUrl = item.thumbnail ? `/api/cardnews/image/${item.thumbnail}` : '';
      const slideCount = (item.slides || []).length;
      const date = item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '';
      return `<div onclick="selectCnFromPicker(${item.id}, '${escapeHtml(item.project_dir || '')}', '${escapeHtml(item.topic || '')}')"
        style="display:flex;gap:14px;padding:12px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;border-radius:10px;transition:background 0.15s;"
        onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
        ${thumbUrl
          ? `<img src="${thumbUrl}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.08);flex-shrink:0;" onerror="this.style.display='none'">`
          : `<div style="width:70px;height:70px;background:rgba(91,155,245,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#5b9bf5;font-size:20px;font-weight:700;flex-shrink:0;">${slideCount}</div>`
        }
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#f5f5f7;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.topic || '제목 없음')}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.4);">${slideCount}장 · ${item.style || ''} · ${date}</div>
          <div style="display:flex;gap:4px;margin-top:6px;overflow:hidden;">
            ${(item.slides || []).slice(0, 4).map(s => {
              const sUrl = s.image_url ? `/api/cardnews/image/${s.image_url}` : '';
              return sUrl ? `<img src="${sUrl}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.06);" onerror="this.style.display='none'">` : '';
            }).join('')}
          </div>
        </div>
      </div>`;
    }).join('');

    // 페이징 버튼
    if (totalPages > 1) {
      let btns = '';
      if (page > 0) btns += `<button class="btn btn-secondary btn-sm" onclick="loadCnPickerPage(${page - 1})">이전</button>`;
      btns += `<span style="color:rgba(255,255,255,0.4);font-size:13px;padding:6px 10px;">${page + 1} / ${totalPages}</span>`;
      if (page < totalPages - 1) btns += `<button class="btn btn-secondary btn-sm" onclick="loadCnPickerPage(${page + 1})">다음</button>`;
      paging.innerHTML = btns;
    } else {
      paging.innerHTML = '';
    }
  } catch (e) {
    list.innerHTML = `<div style="color:#ff453a;padding:16px;">불러오기 실패: ${escapeHtml(e.message)}</div>`;
  }
}

function selectCnFromPicker(id, dir, topic) {
  _cvSelectedCn = { id, dir, topic };
  // 버튼 텍스트 업데이트
  document.getElementById('cv-cn-picker-btn').innerHTML = `<span style="color:#5b9bf5;font-weight:600;">${escapeHtml(topic || '카드뉴스 #' + id)}</span> <span style="color:rgba(255,255,255,0.3);font-size:12px;">변경</span>`;
  // 모달 닫기
  document.getElementById('cv-cn-picker-modal').style.display = 'none';
  // 미리보기 + 액션 카드 직접 표시
  const preview = document.getElementById('cv-preview');
  document.getElementById('cv-preview-title').textContent = topic || '카드뉴스 #' + id;
  document.getElementById('cv-preview-meta').textContent = '카드뉴스';
  const imagesEl = document.getElementById('cv-preview-images');
  imagesEl.innerHTML = '<span class="spinner" style="display:none;"></span>';
  preview.style.display = 'block';
  document.getElementById('cv-actions-card').style.display = 'block';
  // 슬라이드 이미지 미리보기 로드
  api('/api/cardnews/history/' + id).then(data => {
    const item = data.item || {};
    const slides = item.slides || [];
    const aspectRatio = window.MKK_CARDNEWS_RATIOS?.css?.(item.aspect_ratio || '1:1') || '1 / 1';
    imagesEl.innerHTML = slides.map(s => {
      const url = s.image_url ? ('/api/cardnews/image/' + s.image_url.split('/').map(p => encodeURIComponent(p)).join('/')) : '';
      return url ? `<img src="${url}" style="width:120px;aspect-ratio:${aspectRatio};object-fit:cover;border-radius:10px;cursor:pointer;border:1px solid rgba(0,0,0,0.08);" onclick="window.open(this.src)">` : '';
    }).join('') || '<span style="color:rgba(255,255,255,0.3);font-size:12px;">이미지 없음</span>';
  }).catch(() => { imagesEl.innerHTML = ''; });
  toast('카드뉴스 선택: ' + (topic || '#' + id));
}

// ---- BGM 관리 ----
let _selectedBgmPath = '';

function _normalizeBgmListResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.files)) {
    return payload.files.map((file) => ({
      filename: file.filename || file.name || file.path || '',
      path: file.path || file.filename || '',
      url: file.url || (file.path ? `/api/bgm/file/${encodeURIComponent(file.path)}` : ''),
    }));
  }
  return [];
}

async function loadBgmList() {
  const select = document.getElementById('cv-bgm');
  if (!select) return;
  const current = select.value;
  try {
    const list = _normalizeBgmListResponse(await api('/api/bgm/list'));
    select.innerHTML = '<option value="">자동 (기본)</option>';
    for (const bgm of list) {
      const opt = document.createElement('option');
      opt.value = bgm.path;
      opt.textContent = bgm.filename || bgm.path || '';
      select.appendChild(opt);
    }
    if (current) select.value = current;
  } catch {}
}

// BGM 선택 변경 시 미리듣기
document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'cv-bgm') {
    const preview = document.getElementById('cv-bgm-preview');
    if (e.target.value) {
      const filename = e.target.value.split('/').pop();
      preview.src = '/api/bgm/play/' + filename;
      preview.style.display = 'block';
    } else {
      preview.src = '';
      preview.style.display = 'none';
    }
    _selectedBgmPath = e.target.value;
  }
});

function openBgmPanel() {
  const modal = document.getElementById('cv-bgm-modal');
  if (modal) { modal.style.display = 'block'; loadBgmPanelList(); return; }
  // 모달이 없으면 동적 생성
  const div = document.createElement('div');
  div.id = 'cv-bgm-modal';
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,0.7);overflow-y:auto;';
  div.innerHTML = `
    <div style="max-width:560px;margin:60px auto;background:#1c1c1e;border-radius:16px;border:1px solid rgba(255,255,255,0.1);padding:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:18px;font-weight:700;color:#f5f5f7;margin:0;">BGM 음악 관리</h2>
        <button onclick="document.getElementById('cv-bgm-modal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:24px;cursor:pointer;">&times;</button>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#ff9f0a;margin-bottom:8px;">무료 BGM 검색</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='upbeat corporate bgm';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(255,159,10,0.1);color:#ff9f0a;border:1px solid rgba(255,159,10,0.2);">밝고 경쾌한</button>
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='calm piano background';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(91,155,245,0.1);color:#5b9bf5;border:1px solid rgba(91,155,245,0.2);">잔잔한 피아노</button>
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='cinematic epic trailer';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(168,85,247,0.1);color:#a855f7;border:1px solid rgba(168,85,247,0.2);">시네마틱</button>
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='lofi chill hip hop';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(76,175,80,0.1);color:#4caf50;border:1px solid rgba(76,175,80,0.2);">로파이 힙합</button>
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='happy acoustic guitar';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(255,214,0,0.1);color:#ffd600;border:1px solid rgba(255,214,0,0.2);">어쿠스틱</button>
          <button class="btn btn-sm" onclick="document.getElementById('bgm-search-query').value='modern tech futuristic';searchFreeBgm()" style="font-size:10px;padding:3px 8px;background:rgba(0,188,212,0.1);color:#00bcd4;border:1px solid rgba(0,188,212,0.2);">테크/미래</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" id="bgm-search-query" placeholder="직접 검색..." style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f5f5f7;font-size:13px;">
          <button class="btn btn-primary btn-sm" id="bgm-search-btn" onclick="searchFreeBgm()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>검색</button>
        </div>
        <div id="bgm-search-results" style="max-height:240px;overflow-y:auto;"></div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.4);margin-bottom:8px;">또는 YouTube URL 직접 입력</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="bgm-youtube-url" placeholder="YouTube URL 붙여넣기" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f5f5f7;font-size:13px;">
          <button class="btn btn-primary btn-sm" id="bgm-yt-btn" onclick="downloadYoutubeBgm()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>다운로드</button>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#a855f7;margin-bottom:8px;">Suno AI BGM 생성</div>
        <div style="display:flex;gap:8px;margin-bottom:6px;">
          <input type="text" id="bgm-suno-prompt" placeholder="예: 밝고 경쾌한 홍보 영상 배경음악" style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#f5f5f7;font-size:13px;">
          <button class="btn btn-sm" id="bgm-suno-btn" onclick="generateSunoBgm()" style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>생성</button>
        </div>
      </div>

      <div>
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:8px;">저장된 BGM</div>
        <div id="bgm-panel-list"></div>
      </div>
    </div>`;
  document.body.appendChild(div);
  loadBgmPanelList();
}

async function loadBgmPanelList() {
  const list = document.getElementById('bgm-panel-list');
  if (!list) return;
  try {
    const bgms = _normalizeBgmListResponse(await api('/api/bgm/list'));
    if (bgms.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.2);font-size:12px;">저장된 BGM이 없습니다</div>';
      return;
    }
    list.innerHTML = bgms.map(b => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <audio src="${b.url}" style="height:28px;flex:1;" controls preload="none"></audio>
        <span style="font-size:11px;color:rgba(255,255,255,0.4);min-width:80px;">${b.filename}</span>
        <button class="btn btn-sm" onclick="selectBgm('${b.path}','${b.filename}')" style="font-size:11px;padding:3px 10px;background:rgba(91,155,245,0.15);color:#5b9bf5;border:1px solid rgba(91,155,245,0.3);">선택</button>
        <button onclick="deleteBgm('${b.filename}')" style="background:none;border:none;color:#ff453a;cursor:pointer;font-size:16px;">&times;</button>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div style="color:#ff453a;padding:10px;">목록 로드 실패</div>';
  }
}

function selectBgm(path, filename) {
  _selectedBgmPath = path;
  const select = document.getElementById('cv-bgm');
  // option 추가 (없으면)
  let found = false;
  for (const opt of select.options) { if (opt.value === path) { found = true; break; } }
  if (!found) {
    const opt = document.createElement('option');
    opt.value = path;
    opt.textContent = filename;
    select.appendChild(opt);
  }
  select.value = path;
  const preview = document.getElementById('cv-bgm-preview');
  preview.src = '/api/bgm/play/' + filename;
  preview.style.display = 'block';
  document.getElementById('cv-bgm-modal').style.display = 'none';
  toast('BGM 선택: ' + filename);
  loadBgmList();
}

async function searchFreeBgm() {
  const q = document.getElementById('bgm-search-query').value.trim();
  if (!q) return toast('검색어를 입력하세요', 'error');
  const btn = document.getElementById('bgm-search-btn');
  const results = document.getElementById('bgm-search-results');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span>';
  results.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.3);"><span class="spinner"></span> 검색 중...</div>';

  try {
    const res = await api('/api/bgm/search?q=' + encodeURIComponent(q) + '&limit=8');
    if (!res.items || res.items.length === 0) {
      results.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.3);">검색 결과가 없습니다</div>';
      return;
    }
    results.innerHTML = res.items.map(item => {
      const dur = item.duration ? Math.floor(item.duration / 60) + ':' + String(item.duration % 60).padStart(2, '0') : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.06);">
        ${item.thumbnail ? `<img src="${item.thumbnail}" style="width:48px;height:36px;border-radius:4px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;color:#f5f5f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.3);">${escapeHtml(item.channel)} ${dur ? '· ' + dur : ''}</div>
        </div>
        <button class="btn btn-sm" onclick="downloadBgmFromSearch('${item.url}',this)" style="font-size:11px;padding:4px 10px;background:rgba(255,159,10,0.15);color:#ff9f0a;border:1px solid rgba(255,159,10,0.3);flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>받기</button>
      </div>`;
    }).join('');
  } catch (e) {
    results.innerHTML = `<div style="color:#ff453a;padding:10px;font-size:12px;">검색 실패: ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '검색';
  }
}

async function downloadBgmFromSearch(url, btnEl) {
  btnEl.disabled = true;
  btnEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;"></span>';
  try {
    const res = await api('/api/bgm/youtube', { method: 'POST', body: { url } });
    toast('다운로드 완료: ' + res.title);
    loadBgmPanelList();
    loadBgmList();
    selectBgm(res.path, res.filename);
    btnEl.textContent = '완료';
    btnEl.style.background = 'rgba(76,175,80,0.15)';
    btnEl.style.color = '#4caf50';
  } catch (e) {
    toast('다운로드 실패: ' + e.message, 'error');
    btnEl.textContent = '실패';
    btnEl.style.color = '#ff453a';
  }
}

async function downloadYoutubeBgm() {
  const url = document.getElementById('bgm-youtube-url').value.trim();
  if (!url) return toast('YouTube URL을 입력하세요', 'error');
  const btn = document.getElementById('bgm-yt-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span>';
  try {
    const res = await api('/api/bgm/youtube', { method: 'POST', body: { url } });
    toast('다운로드 완료: ' + res.title);
    document.getElementById('bgm-youtube-url').value = '';
    loadBgmPanelList();
    loadBgmList();
    selectBgm(res.path, res.filename);
  } catch (e) {
    toast('다운로드 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '다운로드';
  }
}

async function generateSunoBgm() {
  const prompt = document.getElementById('bgm-suno-prompt').value.trim();
  if (!prompt) return toast('프롬프트를 입력하세요', 'error');
  const btn = document.getElementById('bgm-suno-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';
  try {
    const res = await api('/api/bgm/suno', { method: 'POST', body: { prompt } });
    toast('Suno BGM 생성 완료!');
    loadBgmPanelList();
    loadBgmList();
    selectBgm(res.path, res.filename);
  } catch (e) {
    toast('Suno 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '생성';
  }
}

async function deleteBgm(filename) {
  await api('/api/bgm/delete', { method: 'POST', body: { filename } });
  loadBgmPanelList();
  loadBgmList();
  toast('BGM 삭제됨');
}

// 페이지 로드 시 BGM 목록 불러오기
setTimeout(loadBgmList, 2000);

// ---- 이미지 선택 팝업 ----
let _pickerImages = [];
let _pickerSelected = new Set();
let _pickerCallback = null;

async function openImagePicker(action) {
  // 소스에서 이미지 수집
  _pickerImages = [];
  try {
    if (_cvMode === 'blog' && _cvSelectedBlog) {
      const postData = await api('/api/blog/posts/' + _cvSelectedBlog.id);
      const content = postData.post.content || '';
      // HTML img 태그에서 이미지 추출
      const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
      let m;
      while ((m = imgRegex.exec(content)) !== null) {
        if (!m[1].endsWith('.gif') && !m[1].includes('icon') && !m[1].includes('logo'))
          _pickerImages.push(m[1]);
      }
      // 마크다운 이미지
      const mdRegex = /!\[.*?\]\(([^)]+)\)/g;
      while ((m = mdRegex.exec(content)) !== null) _pickerImages.push(m[1]);
      // URL 이미지
      const urlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp))/gi;
      while ((m = urlRegex.exec(content)) !== null) {
        if (_pickerImages.indexOf(m[1]) === -1) _pickerImages.push(m[1]);
      }
    } else if (_cvMode === 'cardnews' && _cvSelectedCn) {
      const cnData = await api('/api/cardnews/history/' + _cvSelectedCn.id);
      const slides = cnData.item.slides || [];
      for (const s of slides) {
        if (s.image_url) _pickerImages.push('/api/cardnews/image/' + s.image_url);
        else if (s.image_path && s.image_path.includes('/cardnews/'))
          _pickerImages.push('/api/cardnews/image/' + s.image_path.split('/cardnews/')[1]);
      }
    }
  } catch (e) {
    console.error('이미지 수집 실패:', e);
  }

  // 중복 제거
  _pickerImages = [...new Set(_pickerImages)];

  if (_pickerImages.length === 0) {
    // 이미지 없으면 바로 진행
    if (_pickerCallback) _pickerCallback([]);
    return;
  }

  // 전체 선택 상태로 시작
  _pickerSelected = new Set(_pickerImages.map((_, i) => i));

  // 그리드 렌더
  const grid = document.getElementById('cv-image-picker-grid');
  grid.innerHTML = _pickerImages.map((img, i) => `
    <div id="picker-item-${i}" onclick="togglePickerImage(${i})" style="cursor:pointer;position:relative;border-radius:10px;overflow:hidden;border:3px solid #5b9bf5;transition:all 0.15s;">
      <img src="${img}" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
      <div id="picker-check-${i}" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:12px;background:#5b9bf5;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">✓</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:4px 6px;background:rgba(0,0,0,0.6);font-size:10px;color:rgba(255,255,255,0.6);text-align:center;">${i + 1}</div>
    </div>
  `).join('');

  document.getElementById('cv-image-picker-confirm').textContent = `선택 완료 (${_pickerSelected.size}장)`;
  document.getElementById('cv-image-picker-modal').style.display = 'block';
}

function togglePickerImage(idx) {
  const item = document.getElementById('picker-item-' + idx);
  const check = document.getElementById('picker-check-' + idx);
  if (_pickerSelected.has(idx)) {
    _pickerSelected.delete(idx);
    item.style.border = '3px solid rgba(255,255,255,0.1)';
    item.style.opacity = '0.4';
    check.style.display = 'none';
  } else {
    _pickerSelected.add(idx);
    item.style.border = '3px solid #5b9bf5';
    item.style.opacity = '1';
    check.style.display = 'flex';
  }
  document.getElementById('cv-image-picker-confirm').textContent = `선택 완료 (${_pickerSelected.size}장)`;
}

function pickerSelectAll(select) {
  _pickerImages.forEach((_, i) => {
    if (select) _pickerSelected.add(i);
    else _pickerSelected.delete(i);
    const item = document.getElementById('picker-item-' + i);
    const check = document.getElementById('picker-check-' + i);
    if (item) {
      item.style.border = select ? '3px solid #5b9bf5' : '3px solid rgba(255,255,255,0.1)';
      item.style.opacity = select ? '1' : '0.4';
    }
    if (check) check.style.display = select ? 'flex' : 'none';
  });
  document.getElementById('cv-image-picker-confirm').textContent = `선택 완료 (${_pickerSelected.size}장)`;
}

function closeImagePicker() {
  document.getElementById('cv-image-picker-modal').style.display = 'none';
  _pickerCallback = null;
}

function confirmImagePicker() {
  const selected = [..._pickerSelected].sort().map(i => _pickerImages[i]);
  document.getElementById('cv-image-picker-modal').style.display = 'none';
  if (_pickerCallback) _pickerCallback(selected);
  _pickerCallback = null;
}

// Promise 래퍼
function pickImages(action) {
  return new Promise(function(resolve) {
    _pickerCallback = resolve;
    openImagePicker(action);
  });
}

// ---- 만화 ----
async function generateComic() {
  const topic = document.getElementById('comic-topic').value.trim();
  if (!topic) return toast('주제를 입력해주세요.', 'error');
  const style = document.getElementById('comic-style').value;
  const layout = document.getElementById('comic-layout').value;
  const reference = document.getElementById('comic-reference').value.trim();

  const btn = document.getElementById('comic-gen-btn');
  const resultCard = document.getElementById('comic-result-card');
  const resultEl = document.getElementById('comic-result');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="display:none;"></span> 생성 중... (1~3분)';
  resultCard.style.display = 'block';
  resultEl.innerHTML = '<div style="text-align:center;padding:30px;"><span class="spinner"></span><div style="margin-top:12px;color:rgba(255,255,255,0.4);font-size:13px;">만화를 그리고 있어요...</div></div>';

  try {
    const res = await api('/api/comic/generate', {
      method: 'POST',
      body: { topic, style, layout, reference },
    });
    let html = '';
    // 합성 이미지
    if (res.composed_image && res.composed_image.includes('/comics/')) {
      const relPath = res.composed_image.split('/comics/')[1];
      html += `<div style="text-align:center;margin-bottom:16px;">
        <img src="/api/comic/image/${relPath}" style="width:100%;max-width:560px;border-radius:12px;border:2px solid rgba(255,214,0,0.3);cursor:pointer;" onclick="window.open(this.src)">
        <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,0.3);">클릭하면 원본 크기로 볼 수 있어요</div>
      </div>`;
    }
    // 개별 컷
    html += `<details style="margin-top:12px;"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);">개별 컷 보기</summary>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">`;
    for (const p of (res.panels || [])) {
      const imgUrl = p.image_url || (p.image_path && p.image_path.includes('/comics/') ? p.image_path.split('/comics/')[1] : '');
      if (imgUrl) {
        html += `<div style="text-align:center;">
          <img src="/api/comic/image/${imgUrl}" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">${p.situation || ''}</div>
        </div>`;
      }
    }
    html += `</div></details>`;
    html += `<div class="btn-group" style="margin-top:16px;">
      <button class="btn btn-secondary btn-sm" onclick="api('/api/open-folder',{method:'POST',body:{folder:'output/comics'}}).then(()=>toast('폴더 열림'))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>폴더 열기</button>
    </div>`;
    // 성공 카운트
    html = `<div style="font-size:14px;font-weight:600;color:#ffd600;margin-bottom:12px;">${res.success_count}/${res.panel_count}컷 생성 완료</div>` + html;
    resultEl.innerHTML = html;
    toast('만화 생성 완료!');
    loadComicHistory();
  } catch (e) {
    let errHtml = `<div style="color:#ff453a;padding:16px;font-weight:600;">생성 실패: ${escapeHtml(e.message)}</div>`;
    resultEl.innerHTML = errHtml;
    toast('만화 실패', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '만화 생성';
  }
}

async function previewComicScript() {
  const topic = document.getElementById('comic-topic').value.trim();
  if (!topic) return toast('주제를 입력해주세요.', 'error');
  const style = document.getElementById('comic-style').value;
  const reference = document.getElementById('comic-reference').value.trim();

  const card = document.getElementById('comic-script-card');
  const preview = document.getElementById('comic-script-preview');
  card.style.display = 'block';
  preview.innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span> 스크립트 생성 중...</div>';

  try {
    const res = await api('/api/comic/script', {
      method: 'POST',
      body: { topic, style, reference },
    });
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    const emotions = { happy: '😊', sad: '😢', surprised: '😲', angry: '😤', neutral: '😐', funny: '😂' };
    for (const p of (res.panels || [])) {
      html += `<div style="background:rgba(255,214,0,0.05);border:1px solid rgba(255,214,0,0.15);border-radius:12px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:#ffd600;margin-bottom:6px;">컷 ${p.panel_number} ${emotions[p.emotion] || ''}</div>
        <div style="font-size:13px;font-weight:600;margin-bottom:4px;">${escapeHtml(p.situation || '')}</div>
        ${p.dialogue ? `<div style="font-size:12px;color:#7ee787;margin-bottom:4px;">"${escapeHtml(p.dialogue)}"</div>` : ''}
        ${p.narration ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);font-style:italic;">${escapeHtml(p.narration)}</div>` : ''}
      </div>`;
    }
    html += '</div>';
    preview.innerHTML = html;
  } catch (e) {
    preview.innerHTML = `<div style="color:#ff453a;">스크립트 생성 실패: ${escapeHtml(e.message)}</div>`;
  }
}

async function deleteComic(id) {
  if (!confirm('이 만화를 삭제할까요?')) return;
  try {
    await api('/api/comic/delete', { method: 'POST', body: { id } });
    toast('삭제되었습니다');
    loadComicHistory();
  } catch (e) {
    toast('삭제 실패: ' + e.message, 'error');
  }
}

let _comicPage = 0;
const COMIC_PAGE_SIZE = 10;

async function loadComicHistory(page) {
  if (page !== undefined) _comicPage = page;
  const list = document.getElementById('comic-history-list');
  const paging = document.getElementById('comic-history-paging');
  if (!list) return;

  const q = (document.getElementById('comic-search')?.value || '').trim();
  const sort = document.getElementById('comic-sort')?.value || 'newest';

  try {
    const res = await api(`/api/comic/history?limit=${COMIC_PAGE_SIZE}&offset=${_comicPage * COMIC_PAGE_SIZE}`);
    let items = res.items || [];

    // 클라이언트 필터/정렬
    if (q) items = items.filter(i => (i.topic || '').includes(q));
    if (sort === 'oldest') items.reverse();

    if (items.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">검색 결과가 없습니다.</div>';
      if (paging) paging.innerHTML = '';
      return;
    }

    list.innerHTML = items.map(item => {
      const thumbUrl = item.composed_url ? `/api/comic/image/${item.composed_url}` : '';
      return `<div style="display:flex;gap:14px;padding:12px;border-bottom:1px solid rgba(0,0,0,0.06);align-items:center;">
        ${thumbUrl ? `<img src="${thumbUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.08);flex-shrink:0;cursor:pointer;" onclick="window.open(this.src)">` : `<div style="width:80px;height:80px;background:rgba(255,214,0,0.08);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#ffd600;font-size:20px;font-weight:700;flex-shrink:0;">${item.panel_count}컷</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#1c1c1e;margin-bottom:4px;">${escapeHtml(item.topic)}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.4);">${item.style} · ${item.success_count}/${item.panel_count}컷 · ${item.created_at?.slice(0,16).replace('T',' ') || ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${thumbUrl ? `<button class="btn btn-sm" onclick="window.open('${thumbUrl}')" style="background:#007aff;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:11px;">보기</button>` : ''}
          <button class="btn btn-sm" onclick="deleteComic(${item.id})" style="background:rgba(255,59,48,0.08);color:#ff3b30;border:none;border-radius:8px;padding:5px 12px;font-size:11px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
        </div>
      </div>`;
    }).join('');

    // 페이징
    const total = res.items?.length >= COMIC_PAGE_SIZE ? (_comicPage + 2) * COMIC_PAGE_SIZE : (_comicPage + 1) * COMIC_PAGE_SIZE;
    if (paging) {
      let btns = '';
      if (_comicPage > 0) btns += `<button class="btn btn-secondary btn-sm" onclick="loadComicHistory(${_comicPage - 1})">이전</button>`;
      btns += `<span style="color:rgba(0,0,0,0.4);font-size:13px;padding:6px 10px;">${_comicPage + 1} 페이지</span>`;
      if (items.length >= COMIC_PAGE_SIZE) btns += `<button class="btn btn-secondary btn-sm" onclick="loadComicHistory(${_comicPage + 1})">다음</button>`;
      paging.innerHTML = btns;
    }
  } catch {
    list.innerHTML = '<div style="color:rgba(0,0,0,0.3);text-align:center;padding:20px;">목록을 불러올 수 없습니다.</div>';
  }
}
