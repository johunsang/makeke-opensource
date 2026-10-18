let _sssInitialized = false;
let _sssState = {
  importedImages: [],
  generating: false,
};

function sssSplitThreadText(rawText, limit = 400) {
  const clean = String(rawText || '').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  const sentences = clean
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';
  for (const sentence of sentences.length ? sentences : [clean]) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current.trim());
    if (sentence.length <= limit) {
      current = sentence;
      continue;
    }
    let rest = sentence;
    while (rest.length > limit) {
      let splitAt = rest.lastIndexOf(' ', limit);
      if (splitAt < Math.floor(limit * 0.55)) splitAt = limit;
      chunks.push(rest.slice(0, splitAt).trim());
      rest = rest.slice(splitAt).trim();
    }
    current = rest;
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function sssInit() {
  if (!_sssInitialized) {
    _sssInitialized = true;
  }
  sssRefreshProfileSummary();
  sssRenderImages();
  sssRestoreDefaults();
  sssRefreshMeta();
}

function sssSaveDefaults(silent) {
  const data = {
    url: (document.getElementById('single-sns-url')?.value || '').trim(),
    topic: (document.getElementById('single-sns-topic')?.value || '').trim(),
    body: (document.getElementById('single-sns-body')?.value || '').trim(),
  };
  localStorage.setItem('sss_defaults', JSON.stringify(data));
  if (!silent) toast('단일 스레드/X 기본값이 저장되었습니다');
}

function sssRestoreDefaults() {
  const saved = localStorage.getItem('sss_defaults');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined) el.value = value;
    };
    set('single-sns-url', data.url);
    set('single-sns-topic', data.topic);
    set('single-sns-body', data.body);
  } catch (e) {}
}

function sssClearDefaults() {
  localStorage.removeItem('sss_defaults');
  toast('저장된 기본값이 초기화되었습니다');
}

function sssRefreshProfileSummary() {
  const profile = window._globalProfileData || null;
  const nameEl = document.getElementById('single-sns-profile-name');
  const metaEl = document.getElementById('single-sns-profile-meta');
  if (!nameEl || !metaEl) return;

  if (!profile) {
    nameEl.textContent = '프로필 미선택';
    metaEl.textContent = '프로필을 선택하면 저장된 스레드 문체와 SNS 스타일을 기준으로 문구를 생성합니다.';
    return;
  }

  const businessType = profile.business_type ? ` · ${profile.business_type}` : '';
  nameEl.textContent = `${profile.name || '이름 없는 프로필'}${businessType}`;
  metaEl.textContent = '현재 선택된 프로필의 스레드/X 문체를 기준으로 URL 본문을 SNS 문구로 바꿉니다.';
}

function sssRenderImages() {
  const wrap = document.getElementById('single-sns-image-preview');
  if (!wrap) return;
  if (!_sssState.importedImages.length) {
    wrap.innerHTML = '<div style="grid-column:1/-1;padding:18px;border:1px dashed rgba(0,0,0,0.08);border-radius:14px;color:rgba(0,0,0,0.35);font-size:12px;text-align:center;">URL에서 가져온 이미지가 여기에 표시됩니다.</div>';
    return;
  }

  wrap.innerHTML = _sssState.importedImages.map((url, idx) => `
    <div style="position:relative;border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;background:#fff;">
      <img src="${escapeHtml(url)}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;">
      <button type="button" onclick="sssRemoveImage(${idx})" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border:none;border-radius:999px;background:rgba(0,0,0,0.72);color:#fff;font-size:12px;cursor:pointer;">×</button>
    </div>
  `).join('');
}

async function sssUploadImages() {
  const input = document.getElementById('single-sns-images');
  const statusEl = document.getElementById('single-sns-upload-status');
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
    const incoming = (data.images || []).filter(Boolean);
    const merged = [..._sssState.importedImages];
    const seen = new Set(merged);
    incoming.forEach(url => {
      if (!seen.has(url)) {
        merged.push(url);
        seen.add(url);
      }
    });
    _sssState.importedImages = merged;
    sssRenderImages();
    toast(`${incoming.length}장의 이미지를 추가했습니다.`);
  } catch (e) {
    toast('이미지 추가 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
    if (input) input.value = '';
  }
}

function sssRemoveImage(index) {
  _sssState.importedImages.splice(index, 1);
  sssRenderImages();
}

function sssClearImages() {
  _sssState.importedImages = [];
  sssRenderImages();
}

function sssRefreshMeta() {
  const threadsText = (document.getElementById('single-sns-threads-text')?.value || '').trim();
  const twitterText = (document.getElementById('single-sns-twitter-text')?.value || '').trim();
  const threadsMeta = document.getElementById('single-sns-threads-meta');
  const twitterMeta = document.getElementById('single-sns-twitter-meta');
  if (threadsMeta) {
    const segments = sssSplitThreadText(threadsText, 400);
    threadsMeta.textContent = threadsText ? `${threadsText.length}자 · ${segments.length}개 항목` : '아직 생성되지 않았습니다.';
  }
  if (twitterMeta) twitterMeta.textContent = twitterText ? `${twitterText.length}자` : '아직 생성되지 않았습니다.';
  sssRenderThreadSegments(threadsText);
}

function sssRenderThreadSegments(rawText) {
  const wrap = document.getElementById('single-sns-threads-segments');
  if (!wrap) return;
  const segments = sssSplitThreadText(rawText, 400);
  if (!segments.length) {
    wrap.innerHTML = '<div style="padding:14px;border:1px dashed rgba(0,0,0,0.08);border-radius:12px;color:rgba(0,0,0,0.35);font-size:12px;text-align:center;">스레드 결과가 생성되면 400자 단위 항목이 여기 나뉘어 표시됩니다.</div>';
    return;
  }

  wrap.innerHTML = segments.map((segment, idx) => `
    <div style="padding:12px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:12px;font-weight:800;color:#ff8c00;">항목 ${idx + 1}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:11px;color:rgba(0,0,0,0.38);">${segment.length}자</div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="sssCopyThreadSegment(${idx})">복사</button>
        </div>
      </div>
      <div style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#1c1c1e;">${escapeHtml(segment)}</div>
    </div>
  `).join('');
}

async function sssCopyThreadSegment(index) {
  const text = (document.getElementById('single-sns-threads-text')?.value || '').trim();
  const segments = sssSplitThreadText(text, 400);
  const segment = segments[index] || '';
  if (!segment) {
    toast('복사할 스레드 항목이 없습니다', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(segment);
    toast(`스레드 항목 ${index + 1} 복사 완료`);
  } catch (e) {
    toast('복사 실패: ' + e.message, 'error');
  }
}

async function sssImportFromUrl() {
  const urlEl = document.getElementById('single-sns-url');
  const statusEl = document.getElementById('single-sns-source-status');
  const url = (urlEl?.value || '').trim();
  if (!url || !url.startsWith('http')) {
    toast('올바른 URL을 입력하세요', 'error');
    return;
  }

  if (statusEl) statusEl.style.display = 'block';
  try {
    const scrape = window._VAGSource?.scrapeArticle;
    if (typeof scrape !== 'function') throw new Error('공통 URL 수집기를 찾지 못했습니다.');
    const result = await scrape(url, { minLength: 50, timeoutMs: 45000 });
    if (!result.ok) throw new Error(result.error || '본문을 가져오지 못했습니다.');
    const data = {
      title: result.title || '',
      text: result.text || '',
      images: result.images || [],
    };
    const title = String(data.title || '').trim();
    const text = String(data.text || '').trim();
    let images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    if (!text) throw new Error('본문을 가져오지 못했습니다.');

    if (images.length < 8) {
      try {
        const imgRes = await api('/api/content/fetch-images', {
          method: 'POST',
          body: [url],
        });
        const extraImages = _sssExtractFetchedImages(imgRes, url);
        images = Array.from(new Set([
          ...images,
          ...extraImages,
        ]));
      } catch (e) {}
    }

    const topicEl = document.getElementById('single-sns-topic');
    const bodyEl = document.getElementById('single-sns-body');
    if (topicEl) topicEl.value = title || topicEl.value.trim() || url;
    if (bodyEl) bodyEl.value = text;

    _sssState.importedImages = images.slice(0, 8);
    sssRenderImages();
    sssSaveDefaults(true);
    toast(`URL에서 본문과 이미지 ${_sssState.importedImages.length}개를 가져왔습니다.`);
  } catch (e) {
    toast('URL 가져오기 실패: ' + e.message, 'error');
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

function _sssExtractFetchedImages(data, targetUrl) {
  const images = [];
  if (Array.isArray(data?.images)) images.push(...data.images);
  if (Array.isArray(data?.image_lists)) {
    const normalizedTarget = String(targetUrl || '').trim();
    data.image_lists.forEach(item => {
      const itemUrl = String(item?.url || '').trim();
      if (!normalizedTarget || !itemUrl || itemUrl === normalizedTarget) {
        if (Array.isArray(item?.images)) images.push(...item.images);
      }
    });
  } else if (Array.isArray(data?.image_lists?.[targetUrl])) {
    images.push(...data.image_lists[targetUrl]);
  }
  return Array.from(new Set(images.filter(Boolean)));
}

function sssGetSourcePayload() {
  const topic = (document.getElementById('single-sns-topic')?.value || '').trim();
  const body = (document.getElementById('single-sns-body')?.value || '').trim();
  if (!body) throw new Error('본문을 먼저 준비하세요.');
  return { topic: topic || 'SNS 문구', sourceText: body };
}

async function sssSaveHistory(topic, threadsText, twitterText) {
  const threads = String(threadsText || '').trim();
  const twitter = String(twitterText || '').trim();
  if (!threads && !twitter) return;
  try {
    await api('/api/sag/save', {
      method: 'POST',
      body: {
        topic: topic || 'SNS 문구',
        threads_text: threads,
        twitter_text: twitter,
        industry: window._globalProfileData?.business_type || '',
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
      },
    });
  } catch (e) {
    console.warn('[single-sns] history save failed:', e);
  }
}

async function sssGenerate(platform) {
  if (typeof _logActivity === 'function') _logActivity('single-sns', 'generate', platform);
  if (_sssState.generating) {
    toast('이미 생성 중입니다', 'error');
    return;
  }

  const statusEl = document.getElementById('single-sns-generate-status');
  const btnId = platform === 'threads' ? 'single-sns-generate-threads-btn' : 'single-sns-generate-twitter-btn';
  const btn = document.getElementById(btnId);

  try {
    const { topic, sourceText } = sssGetSourcePayload();
    _sssState.generating = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';
    }
    if (statusEl) statusEl.textContent = `${platform === 'threads' ? '스레드' : 'X'} 문구를 생성하는 중입니다.`;

    const res = await api('/api/content/generate-sns', {
      method: 'POST',
      body: {
        topic,
        source_text: sourceText,
        platform,
        profile_id: parseInt(window._globalProfileId || 0, 10) || 0,
        tone: 'mystyle',
      },
    });

    let text = String(res.text || '').trim();
    if (platform === 'threads') {
      const segments = sssSplitThreadText(text, 400);
      text = segments.join('\n\n');
    }
    const targetId = platform === 'threads' ? 'single-sns-threads-text' : 'single-sns-twitter-text';
    const target = document.getElementById(targetId);
    if (target) target.value = text;
    sssRefreshMeta();
    if (platform === 'threads') {
      await sssSaveHistory(topic, text, document.getElementById('single-sns-twitter-text')?.value || '');
    } else {
      await sssSaveHistory(topic, document.getElementById('single-sns-threads-text')?.value || '', text);
    }
    if (statusEl) statusEl.textContent = `${platform === 'threads' ? '스레드' : 'X'} 문구 생성 완료`;
    toast(`${platform === 'threads' ? '스레드' : 'X'} 문구 생성 완료`);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'SNS 문구 생성 실패';
    toast('SNS 문구 생성 실패: ' + e.message, 'error');
  } finally {
    _sssState.generating = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = platform === 'threads' ? '스레드만' : 'X만';
    }
  }
}

async function sssGenerateBoth() {
  if (_sssState.generating) {
    toast('이미 생성 중입니다', 'error');
    return;
  }

  const btn = document.getElementById('single-sns-generate-both-btn');
  const statusEl = document.getElementById('single-sns-generate-status');

  try {
    const { topic, sourceText } = sssGetSourcePayload();
    _sssState.generating = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;"></span> 생성 중...';
    }
    if (statusEl) statusEl.textContent = '스레드와 X 문구를 순서대로 생성하는 중입니다.';

    const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
    const [threadsRes, twitterRes] = await Promise.all([
      api('/api/content/generate-sns', {
        method: 'POST',
        body: { topic, source_text: sourceText, platform: 'threads', profile_id: profileId, tone: 'mystyle' },
      }),
      api('/api/content/generate-sns', {
        method: 'POST',
        body: { topic, source_text: sourceText, platform: 'twitter', profile_id: profileId, tone: 'mystyle' },
      }),
    ]);

    const threadsEl = document.getElementById('single-sns-threads-text');
    const twitterEl = document.getElementById('single-sns-twitter-text');
    if (threadsEl) {
      const segments = sssSplitThreadText(String(threadsRes.text || '').trim(), 400);
      threadsEl.value = segments.join('\n\n');
    }
    if (twitterEl) twitterEl.value = String(twitterRes.text || '').trim();
    sssRefreshMeta();
    await sssSaveHistory(topic, threadsEl?.value || '', twitterEl?.value || '');
    if (statusEl) statusEl.textContent = '스레드와 X 문구 생성 완료';
    toast('스레드와 X 문구 생성 완료');
  } catch (e) {
    if (statusEl) statusEl.textContent = '스레드/X 문구 생성 실패';
    toast('스레드/X 문구 생성 실패: ' + e.message, 'error');
  } finally {
    _sssState.generating = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;"><path d="M12 5v14"/><path d="M5 12h14"/></svg> 스레드 + X 만들기';
    }
  }
}

async function sssCopyResult(platform) {
  const el = document.getElementById(platform === 'threads' ? 'single-sns-threads-text' : 'single-sns-twitter-text');
  const text = (el?.value || '').trim();
  if (!text) {
    toast('복사할 내용이 없습니다', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(`${platform === 'threads' ? '스레드' : 'X'} 문구 복사 완료`);
  } catch (e) {
    toast('복사 실패: ' + e.message, 'error');
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    sssInit,
    sssSaveDefaults,
    sssRestoreDefaults,
    sssClearDefaults,
    sssRefreshProfileSummary,
    sssUploadImages,
    sssRemoveImage,
    sssClearImages,
    sssImportFromUrl,
    sssGenerate,
    sssGenerateBoth,
    sssCopyResult,
    sssCopyThreadSegment,
  });
}
