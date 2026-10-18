/* ============================================================
 *  단일 네이버 블로그 — URL/주제로 블로그 글 생성 + 발행
 * ============================================================ */

let _sblogResult = null;
const _sblogHistory = [];
let _sblogUploadedImages = []; // 업로드된 이미지 URL 목록

// ── 이미지 업로드 ────────────────────────────────────────────

async function sblogUploadImages() {
  const input = document.getElementById('single-blog-images');
  if (!input?.files?.length) return;
  const statusEl = document.getElementById('single-blog-image-status');
  if (statusEl) statusEl.textContent = '업로드 중...';

  for (const file of input.files) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/content/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) _sblogUploadedImages.push(data.url);
    } catch {}
  }
  input.value = '';
  if (statusEl) statusEl.textContent = `${_sblogUploadedImages.length}장 업로드됨`;
  sblogRenderImagePreview();
}

function sblogClearImages() {
  _sblogUploadedImages = [];
  sblogRenderImagePreview();
  const statusEl = document.getElementById('single-blog-image-status');
  if (statusEl) statusEl.textContent = '';
}

function sblogRenderImagePreview() {
  const wrap = document.getElementById('single-blog-image-preview');
  if (!wrap) return;
  if (!_sblogUploadedImages.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = _sblogUploadedImages.map((url, idx) => `
    <div style="position:relative;flex-shrink:0;">
      <img src="${url}" style="height:80px;border-radius:10px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">
      <button onclick="_sblogUploadedImages.splice(${idx},1);sblogRenderImagePreview();" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#ff3b30;color:#fff;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
    </div>
  `).join('');
}

// ── URL 스크래핑 ─────────────────────────────────────────────

async function sblogScrapeUrl() {
  const urlEl = document.getElementById('single-blog-source-url');
  const urls = (urlEl?.value || '').trim().split('\n').map(u => u.trim()).filter(Boolean);
  if (!urls.length) { toast('URL을 입력해주세요.', 'error'); return; }

  const btn = document.getElementById('single-blog-scrape-btn');
  if (btn) { btn.disabled = true; btn.textContent = '수집 중...'; }

  const bodyEl = document.getElementById('single-blog-body');
  const topicEl = document.getElementById('single-blog-topic');
  let allText = bodyEl?.value || '';

  for (const url of urls) {
    try {
      const scrape = window._VAGSource?.scrapeArticle;
      if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
      // 네이버 블로그는 모바일 URL로 변환하여 수집 (JS 렌더링 불필요)
      let scrapeUrl = url;
      if (/blog\.naver\.com/.test(url) && !/m\.blog\.naver/.test(url)) {
        scrapeUrl = url.replace('blog.naver.com', 'm.blog.naver.com');
      }
      let res = await scrape(scrapeUrl, { minLength: 50, timeoutMs: 45000 });
      if (!res.ok && scrapeUrl !== url) {
        res = await scrape(url, { minLength: 50, timeoutMs: 45000 });
      }
      const text = res?.text || '';
      const title = res?.title || '';
      if (text) {
        allText += (allText ? '\n\n---\n\n' : '') + (title ? `[${title}]\n` : '') + text;
        if (!topicEl?.value && title) topicEl.value = title;
      }
    } catch (e) {
      toast(`스크래핑 실패: ${url}`, 'error');
    }
  }

  if (bodyEl) bodyEl.value = allText;
  if (btn) { btn.disabled = false; btn.textContent = '가져오기'; }
  toast(`${urls.length}개 URL 수집 완료`);
}

// ── 블로그 글 생성 ───────────────────────────────────────────

async function sblogGenerate() {
  if (typeof _logActivity === 'function') _logActivity('single-blog', 'generate');
  const topic = document.getElementById('single-blog-topic')?.value?.trim();
  const body = document.getElementById('single-blog-body')?.value?.trim();
  if (!topic && !body) { toast('주제 또는 본문을 입력해주세요.', 'error'); return; }

  const btn = document.getElementById('single-blog-gen-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px;"></span>생성 중...'; }

  let referenceText = body || '';

  try {
    const profileId = parseInt(window._globalProfileId || 0);
    const imageCount = parseInt(document.getElementById('single-blog-image-count')?.value || '0');
    const imgSource = document.getElementById('single-blog-image-source')?.value || 'ai';
    const libImages = Array.isArray(window._kcLibraryImages) ? window._kcLibraryImages.slice(0, 5) : [];
    const allImages = [..._sblogUploadedImages, ...libImages];
    let contentOpts = {};
    try { contentOpts = JSON.parse(window._globalProfileData?.content_options || '{}'); } catch {}
    const logoUrl = window._globalProfileData?.logo_path && profileId
      ? encImg('/api/library/image/' + profileId + '/' + window._globalProfileData.logo_path)
      : '';
    const logoInsert = !!logoUrl && contentOpts.logo_insert !== false && window._contentOpts?.logo_insert !== false;

    // 프로필 문체 스타일 우선 (mystyle이면 프로필 학습 문체 적용)
    const profileTone = window._globalProfileData?.tone || '';
    const uiTone = document.getElementById('single-blog-tone')?.value || '';
    const tone = uiTone === 'mystyle' ? 'mystyle' : (profileTone || uiTone || 'friendly');

    const res = await api('/api/content/generate', {
      method: 'POST',
      body: {
        keyword: topic || '블로그 글',
        scraped_texts: referenceText ? [referenceText] : [],
        brand_name: window._globalProfileData?.name || '',
        brand_logo_url: logoUrl,
        logo_insert: logoInsert,
        brand_description: (window._globalProfileData?.service_description || '')
          + (window._globalProfileData?.business_type ? ' (업종: ' + window._globalProfileData.business_type + ')' : '')
          + (window._globalProfileData?.keywords ? ' (키워드: ' + window._globalProfileData.keywords + ')' : ''),
        business_goal: window._globalProfileData?.business_goal || '',
        contact_info: window._globalProfileData?.contact_info || '',
        cta_text: window._globalProfileData?.cta_text || '',
        user_image_urls: allImages,
        generate_blog: true,
        generate_cardnews: false,
        generate_video: false,
        generate_sns: false,
        tone: tone,
        blog_length: document.getElementById('single-blog-length')?.value || contentOpts.blog_length || 'medium',
        comma_rate: contentOpts.comma_rate || 50,
        period_rate: contentOpts.period_rate || 70,
        human_level: contentOpts.human_level || 'light',
        include_cta: document.getElementById('single-blog-cta')?.value === '1',
        seo: document.getElementById('single-blog-seo')?.value === '1',
        text_provider: '',
        image_provider: '',
        image_model: '',
        profile_id: profileId,
        blog_image_count: imageCount,
        blog_img_source: imgSource,
      },
    });

    if (res.blog && !res.blog.error) {
      _sblogResult = res.blog;
      _sblogResult._blogImages = res.blog_images || null;
      const resultEl = document.getElementById('single-blog-result');
      resultEl.style.display = 'block';
      document.getElementById('single-blog-title-display').textContent = res.blog.title || '';
      document.getElementById('single-blog-content-display').innerHTML = (res.blog.body || res.blog.content || '').replace(/\n/g, '<br>');

      // 블로그 이미지 결과 표시
      const imgResultEl = document.getElementById('single-blog-images-result');
      const imgGrid = document.getElementById('single-blog-images-grid');
      const blogImages = res.blog_images;
      if (blogImages && !blogImages.error && blogImages.count > 0) {
        const images = blogImages.images || [];
        imgGrid.innerHTML = images.map((img, idx) => `
          <div style="border:1px solid rgba(0,0,0,0.06);border-radius:12px;overflow:hidden;">
            <img src="${img.url}?t=${Date.now()}" style="width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;" onclick="window.open(this.src)" loading="lazy">
            <div style="padding:6px 8px;font-size:11px;color:rgba(0,0,0,0.4);">${img.section || '이미지 ' + (idx + 1)}</div>
          </div>
        `).join('');
        imgResultEl.style.display = 'block';
      } else {
        imgResultEl.style.display = 'none';
      }

      document.getElementById('single-blog-meta-display').textContent =
        `${res.blog.char_count || 0}자${blogImages?.count ? ' · 이미지 ' + blogImages.count + '장' : ''} · 모델: ${res.blog.model || ''} · ${new Date().toLocaleTimeString('ko-KR')}`;

      // 히스토리에 추가
      _sblogHistory.unshift({
        title: res.blog.title,
        content: res.blog.body || res.blog.content,
        char_count: res.blog.char_count,
        created_at: new Date().toISOString(),
        topic,
      });
      sblogRenderHistory();
      toast('블로그 글 생성 완료!');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      toast('블로그 생성 실패: ' + (res.blog?.error || '알 수 없는 오류'), 'error');
    }
  } catch (e) {
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '블로그 글 생성'; }
  }
}

// ── 복사 ─────────────────────────────────────────────────────

function sblogCopy() {
  if (!_sblogResult) return;
  const text = (_sblogResult.title || '') + '\n\n' + (_sblogResult.body || _sblogResult.content || '');
  navigator.clipboard.writeText(text).then(() => toast('복사됨'));
}

// ── 네이버 블로그 발행 ───────────────────────────────────────

async function sblogPublish() {
  if (!_sblogResult) { toast('먼저 글을 생성해주세요.', 'error'); return; }
  if (!confirm('이 글을 네이버 블로그에 발행할까요?')) return;

  try {
    const res = await api('/api/browser/publish-blog', {
      method: 'POST',
      body: {
        title: _sblogResult.title || '',
        content: _sblogResult.body || _sblogResult.content || '',
        tags: [],
      },
    });
    if (res.success || res.ok) {
      toast('네이버 블로그 발행 완료!');
    } else {
      toast('발행 실패: ' + (res.error || ''), 'error');
    }
  } catch (e) {
    toast('발행 실패: ' + e.message, 'error');
  }
}

// ── 히스토리 ─────────────────────────────────────────────────

function sblogRenderHistory() {
  const wrap = document.getElementById('single-blog-history');
  if (!wrap) return;
  if (!_sblogHistory.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(0,0,0,0.35);font-size:13px;">블로그 글을 생성하면 여기에 기록됩니다.</div>';
    return;
  }
  wrap.innerHTML = _sblogHistory.slice(0, 10).map((item, idx) => `
    <div style="border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:14px;margin-bottom:8px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_sblogEsc(item.title || '')}</div>
        <button type="button" onclick="sblogLoadFromHistory(${idx})" class="btn btn-secondary btn-sm" style="flex-shrink:0;">불러오기</button>
      </div>
      <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-top:4px;">
        ${item.char_count || 0}자 · ${new Date(item.created_at).toLocaleString('ko-KR')}
      </div>
    </div>
  `).join('');
}

function sblogLoadFromHistory(idx) {
  const item = _sblogHistory[idx];
  if (!item) return;
  _sblogResult = { title: item.title, body: item.content, content: item.content, char_count: item.char_count };
  const resultEl = document.getElementById('single-blog-result');
  resultEl.style.display = 'block';
  document.getElementById('single-blog-title-display').textContent = item.title || '';
  document.getElementById('single-blog-content-display').innerHTML = (item.content || '').replace(/\n/g, '<br>');
  document.getElementById('single-blog-meta-display').textContent = `${item.char_count || 0}자`;
  toast('히스토리에서 불러왔습니다.');
}

function sblogLoadHistory() {
  sblogRenderHistory();
}

function _sblogEsc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ── 전체 리셋 ────────────────────────────────────────────────

async function sblogReset() {
  if (!await _mkkConfirm('모든 입력과 생성 결과를 초기화할까요?')) return;
  // 입력 필드 초기화
  const fields = ['single-blog-source-url', 'single-blog-topic', 'single-blog-body'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // 이미지 초기화
  _sblogUploadedImages = [];
  sblogRenderImagePreview();
  const imgStatus = document.getElementById('single-blog-image-status');
  if (imgStatus) imgStatus.textContent = '';
  const imgResult = document.getElementById('single-blog-images-result');
  if (imgResult) imgResult.style.display = 'none';
  // 옵션 기본값
  const defaults = { 'single-blog-length': 'medium', 'single-blog-tone': 'friendly', 'single-blog-seo': '1', 'single-blog-cta': '0', 'single-blog-image-count': '1', 'single-blog-image-source': 'ai' };
  Object.entries(defaults).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
  // 결과 숨기기
  const resultEl = document.getElementById('single-blog-result');
  if (resultEl) resultEl.style.display = 'none';
  // 히스토리 초기화
  _sblogHistory.length = 0;
  _sblogResult = null;
  sblogRenderHistory();
  toast('전체 리셋 완료');
}

// ── 초기화 ───────────────────────────────────────────────────

function sblogInit() {
  if (typeof mkkRenderSingleImageModelBanner === 'function') {
    mkkRenderSingleImageModelBanner('single-blog', { note: '블로그 이미지 생성 시 설정 모델을 사용합니다.' });
  }
  sblogRenderHistory();
}

// 전역 노출
window.sblogInit = sblogInit;
window.sblogScrapeUrl = sblogScrapeUrl;
window.sblogGenerate = sblogGenerate;
window.sblogCopy = sblogCopy;
window.sblogPublish = sblogPublish;
window.sblogLoadHistory = sblogLoadHistory;
window.sblogLoadFromHistory = sblogLoadFromHistory;
window.sblogReset = sblogReset;
window.sblogUploadImages = sblogUploadImages;
window.sblogClearImages = sblogClearImages;
