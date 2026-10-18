/**
 * static/modules/shared/source_client.js
 *
 * 공용 소스 수집 클라이언트 — 6개 에이전트(블로그·카드뉴스·SNS·영상·코믹·디테일)가
 * 각자 호출하던 /api/ce2/youtube-analyze, /api/ce2/fetch-url, /api/ce2/parse-file,
 * /api/content/search, /api/content/search-global 래퍼와 공용 모달(뉴스)
 * 핸들러를 하나의 네임스페이스로 통합.
 *
 * 목표:
 * - 타임아웃·에러 shape 일관화({ ok, text, error, title, meta }).
 * - AbortController 에 항상 reason 을 붙여 "signal is aborted without reason" 제거.
 * - 각 에이전트는 이 모듈 호출 한 번으로 소스를 받는다.
 *
 * URL 본문 수집 강제 규칙:
 * - 프런트의 모든 URL 본문 수집은 반드시 window._VAGSource.scrapeArticle() 로만 진입한다.
 * - 이 모듈만 /api/content/scrape-article 을 직접 호출할 수 있다.
 * - Electron 런타임에서는 headless 없이 내부 Electron 브라우저(window.electronAPI.scrapeUrl)를
 *   반드시 1순위로 사용한다.
 * - 백엔드의 공식 공통 함수는 api/internal/content/scrape_pipeline.go 의
 *   scrapeArticleWithPipeline(cfg, rawURL, fallbackTitle) 이다.
 * - 백엔드 fallback 정책은 "원문 복원 -> Colly -> 판다 브라우저 -> HTTP fallback" 이며,
 *   설정에서 Chrome 확장이 연결된 경우 이 모듈이 마지막 단계로 기존 Chrome 탭 수집을 한 번 더 시도한다.
 *   단계 추가/변경은 위 두 공통 함수와 문서를 함께 갱신할 때만 허용한다.
 *
 * 공용 API: window._VAGSource = {
 *   analyzeYouTube(url, opts?): Promise<{ok, text, title, error, rawLength}>
 *   fetchUrl(url, opts?): Promise<{ok, text, title, error}>
 *   parseDocument(file, opts?): Promise<{ok, text, name, error}>
 *   scrapeArticle(url, opts?): Promise<{ok, text, title, images, method, error, stageTrace}>
 *   scrapeSelectedSources(items, opts?): Promise<Array<{title, snippet, url, scrapedText, scrapedImages, textBlock}>>
 *   searchGoogleNews(keyword, opts?): Promise<{ok, items, error}>
 *   openNewsModal(): Promise<{ok, text, error}>           // ce2OpenNewsSearchModal 래핑
 *   openNaverModal(): Promise<{ok, text, error}>          // ce2OpenNaverSearchModal 래핑
 * }
 *
 * 하위 호환 별칭: window.VAGSource = window._VAGSource (다른 파일에서 typing 편의).
 */
(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 60000;        // 일반 REST 호출 기본 타임아웃
  const ELECTRON_SCRAPE_TIMEOUT_MS = 22000; // Electron 내부 브라우저 1차 수집 최대 대기
  const MODAL_TIMEOUT_MS = 240000;         // 사용자 상호작용 모달 최대 대기
  const MIN_USEFUL_TEXT = 30;              // 본문 수집 성공 판단 임계 (최소 길이)

  // ── 내부 헬퍼 ────────────────────────────────────────────────────

  function _nowMs() { return Date.now(); }

  function normalizeNaverBlogUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return value;
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith('blog.naver.com') && host !== 'm.blog.naver.com') return value;
      let blogId = (parsed.searchParams.get('blogId') || '').trim();
      let logNo = (parsed.searchParams.get('logNo') || '').trim();
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (host === 'm.blog.naver.com' && parts.length >= 2) {
        blogId = blogId || parts[0];
        logNo = logNo || parts[1];
      } else if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
        blogId = blogId || parts[0];
        logNo = logNo || parts[1];
      }
      if (!blogId || !logNo) return value;
      const q = new URLSearchParams();
      q.set('blogId', blogId);
      q.set('logNo', logNo);
      q.set('redirect', 'Dlog');
      q.set('widgetTypeCall', 'true');
      q.set('directAccess', 'false');
      return 'https://blog.naver.com/PostView.naver?' + q.toString();
    } catch (_) {
      return value;
    }
  }

  function sourceCandidateUrls(rawUrl) {
    const original = String(rawUrl || '').trim();
    const normalized = normalizeNaverBlogUrl(original);
    if (!original || normalized === original) return original ? [original] : [];
    return [normalized, original];
  }

  // AbortController + reason 기반 타임아웃 fetch. try/finally 로 타이머 누수 방지.
  async function _fetchWithTimeout(url, init, timeoutMs, reasonLabel) {
    const ac = new AbortController();
    const timer = setTimeout(function () {
      try { ac.abort(new DOMException(reasonLabel + ' 타임아웃 (' + timeoutMs + 'ms)', 'TimeoutError')); }
      catch (_) { ac.abort(); }
    }, timeoutMs);
    try {
      return await fetch(url, Object.assign({}, init || {}, { signal: ac.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function _promiseWithTimeout(promise, timeoutMs, reasonLabel) {
    let timer = null;
    const timeout = new Promise(function (_resolve, reject) {
      timer = setTimeout(function () {
        reject(new DOMException(reasonLabel + ' 타임아웃 (' + timeoutMs + 'ms)', 'TimeoutError'));
      }, timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function _extractError(data, resp, parseFail) {
    if (parseFail) return 'JSON 파싱 실패: ' + (parseFail.message || parseFail);
    if (data && (data.detail || data.error || data.message)) {
      return String(data.detail || data.error || data.message);
    }
    if (resp && !resp.ok) return 'HTTP ' + resp.status + ' ' + (resp.statusText || '');
    return '응답이 비어있거나 형식이 다름';
  }

  function _abortReason(e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) return '타임아웃';
    return (e && (e.message || e.name)) || String(e);
  }

  function _escapeHTML(value) {
    const d = document.createElement('div');
    d.textContent = String(value || '');
    return d.innerHTML;
  }

  function youtubeAnalysisPreviewHTML(result, opts) {
    const res = result || {};
    const options = opts || {};
    const text = String(res.summary || res.text || '').trim();
    const previewLimit = Number(options.limit || 900);
    const preview = text.length > previewLimit ? text.slice(0, previewLimit) + '...' : text;
    const meta = [res.channel, res.duration, res.language].filter(Boolean).join(' · ');
    const title = String(res.title || options.title || 'YouTube 분석 결과').trim();
    const thumbnail = String(res.thumbnail || '').trim();
    return `
      <div class="makeke-source-preview makeke-youtube-preview">
        <div class="makeke-source-preview-head">
          ${thumbnail ? `<img class="makeke-source-preview-thumb" src="${_escapeHTML(thumbnail)}" alt="">` : ''}
          <div style="min-width:0;">
            <div class="makeke-source-preview-title">${_escapeHTML(title)}</div>
            ${meta ? `<div class="makeke-source-preview-meta">${_escapeHTML(meta)}</div>` : ''}
            <div class="makeke-source-preview-meta">분석 본문 ${Number(res.rawLength || (res.text || '').length || 0).toLocaleString()}자</div>
          </div>
        </div>
        <div class="makeke-source-preview-text">${_escapeHTML(preview || '분석 결과 본문이 비어 있습니다.')}</div>
      </div>`;
  }

  function sourceTextPreviewHTML(title, text, opts) {
    const options = opts || {};
    const body = String(text || '').trim();
    if (!body) return '';
    const id = 'makeke-source-text-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    const previewLimit = Number(options.limit || 900);
    const preview = body.length > previewLimit ? body.slice(0, previewLimit) + '...' : body;
    const heading = String(title || '수집된 소재').trim();
    return `
      <div class="makeke-source-preview makeke-source-text-preview">
        <div class="makeke-source-preview-toolbar">
          <div>
            <div class="makeke-source-preview-title">${_escapeHTML(heading)}</div>
            <div class="makeke-source-preview-meta">총 ${body.length.toLocaleString()}자 반영됨</div>
          </div>
          <button type="button" class="makeke-source-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('${id}')?.textContent || '').then(()=>{this.textContent='복사됨';setTimeout(()=>this.textContent='복사',900);})">복사</button>
        </div>
        <div class="makeke-source-preview-text">${_escapeHTML(preview)}</div>
        <details class="makeke-source-preview-details">
          <summary>전체 내용 보기</summary>
          <div id="${id}" class="makeke-source-preview-full">${_escapeHTML(body.slice(0, Number(options.fullLimit || 12000)))}</div>
        </details>
      </div>`;
  }

  // ── 1) YouTube 분석 ──────────────────────────────────────────────
  async function analyzeYouTube(url, opts) {
    if (!url || typeof url !== 'string') return { ok: false, error: 'URL 이 없습니다.' };
    const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/ce2/youtube-analyze',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) },
        timeoutMs,
        'YouTube 분석'
      );
    } catch (e) {
      return { ok: false, error: 'YouTube 분석 오류: ' + _abortReason(e) };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    const text = (data && data.text) ? String(data.text) : '';
    if (resp.ok && data && data.ok && text.length >= MIN_USEFUL_TEXT) {
      return {
        ok: true,
        text: text,
        title: (data.title || '').toString(),
        url: (data.url || url || '').toString(),
        channel: (data.channel || '').toString(),
        duration: (data.duration || '').toString(),
        thumbnail: (data.thumbnail || '').toString(),
        language: (data.language || '').toString(),
        summary: (data.summary || '').toString(),
        rawLength: text.length,
      };
    }
    return { ok: false, error: _extractError(data, resp, parseFail) };
  }

  // ── 2) URL 본문 가져오기 ────────────────────────────────────────
  async function fetchUrl(url, opts) {
    if (!url || typeof url !== 'string') return { ok: false, error: 'URL 이 없습니다.' };
    return await scrapeArticle(url, Object.assign({ minLength: MIN_USEFUL_TEXT }, opts || {}));
  }

  // ── 3) 문서 파싱 (PDF/DOCX/TXT) ─────────────────────────────────
  async function parseDocument(file, opts) {
    if (!file) return { ok: false, error: '파일이 없습니다.' };
    const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
    const form = new FormData();
    form.append('file', file);
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/ce2/parse-file',
        { method: 'POST', body: form },
        timeoutMs,
        '문서 파싱'
      );
    } catch (e) {
      return { ok: false, error: '문서 파싱 오류: ' + _abortReason(e) };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    const text = (data && data.text) ? String(data.text) : '';
    if (resp.ok && data && data.ok && text.length >= MIN_USEFUL_TEXT) {
      return { ok: true, text: text, name: (file.name || '') };
    }
    return { ok: false, error: _extractError(data, resp, parseFail) };
  }

  function _notifyStage(opts, stage) {
    if (!opts || typeof opts.onStage !== 'function') return;
    try { opts.onStage(stage); } catch (_) {}
  }

  function _modalStageKey(stage) {
    const key = String((stage && stage.key) || '').toLowerCase();
    const method = String((stage && stage.method) || '').toLowerCase();
    if (key === 'electron' || /electron/.test(method)) return 'electron';
    if (key === 'lightpanda' || /panda|lightpanda/.test(method)) return 'lightpanda';
    if (key === 'cdp' || /cdp|chrome/.test(method)) return 'cdp';
    if (key === 'images') return 'images';
    if (key === 'colly' || key === 'requests' || key === 'server' || /colly|request|http/.test(method)) return 'requests';
    return key;
  }

  function _stageState(stage, fallback) {
    if (!stage || typeof stage.success !== 'boolean') return fallback || 'running';
    return stage.success ? 'success' : 'failed';
  }

  function _createProgressModal(url, title, opts) {
    if (opts && opts.showProgressModal === false) return null;
    if (typeof window.kcCreateSourceScrapeModal !== 'function') return null;
    try {
      return window.kcCreateSourceScrapeModal({
        title: title || url,
        url: url,
      }, {
        idx: -1,
        summary: '공통 본문/이미지 확보 로직으로 수집 중입니다.',
      });
    } catch (_) {
      return null;
    }
  }

  function _modalStage(modal, stage, fallbackState) {
    if (!modal || !stage) return;
    const key = _modalStageKey(stage);
    if (!key || typeof modal.updateStage !== 'function') return;
    const message = stage.message || stage.label || '진행 중';
    modal.updateStage(key, _stageState(stage, fallbackState), message);
  }

  async function _collectImagesForUrl(url, existingImages, opts, modal) {
    const merged = Array.isArray(existingImages) ? existingImages.filter(Boolean) : [];
    _notifyStage(opts, { key: 'images', label: '이미지 확보', method: 'fetch_images' });
    _modalStage(modal, { key: 'images', message: '본문에 맞는 이미지를 확보하는 중입니다.' }, 'running');
    if (merged.length > 0) {
      _modalStage(modal, { key: 'images', success: true, message: '이미지 ' + merged.length + '장 발견, 추가 이미지를 확인 중입니다.' });
    }
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/content/fetch-images',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([url]) },
        30000,
        '이미지 확보'
      );
      try { data = await resp.json(); } catch (e) { parseFail = e; }
      const extraImages = _extractFetchedImages(data, url);
      const images = Array.from(new Set(merged.concat(extraImages))).filter(Boolean);
      _modalStage(modal, { key: 'images', success: images.length > 0, message: images.length > 0 ? '이미지 ' + images.length + '장 확보' : '이미지를 확보하지 못했습니다.' });
      return images;
    } catch (e) {
      const msg = _abortReason(e) || _extractError(data, resp, parseFail);
      _modalStage(modal, { key: 'images', success: false, message: msg });
      return merged;
    }
  }

  function _extractFetchedImages(data, targetUrl) {
    const images = [];
    if (Array.isArray(data && data.images)) images.push(...data.images);
    const lists = data && data.image_lists;
    if (Array.isArray(lists)) {
      const normalizedTarget = String(targetUrl || '').trim();
      lists.forEach(item => {
        const itemUrl = String(item && item.url || '').trim();
        if (!normalizedTarget || !itemUrl || itemUrl === normalizedTarget) {
          if (Array.isArray(item && item.images)) images.push(...item.images);
        }
      });
    } else if (lists && Array.isArray(lists[targetUrl])) {
      images.push(...lists[targetUrl]);
    }
    return Array.from(new Set(images.filter(Boolean)));
  }

  async function _validateArticleText(url, title, text) {
    const candidate = String(text || '').trim();
    if (!candidate) return { valid: false, reason: '본문이 비어 있습니다.', cleaned_text: '' };
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/content/validate-article-text',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, title: title || '', text: candidate }),
        },
        15000,
        '본문 검증'
      );
    } catch (e) {
      return { valid: candidate.length >= MIN_USEFUL_TEXT, reason: _abortReason(e), cleaned_text: candidate };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    if (resp && resp.ok && data && typeof data.valid === 'boolean') return data;
    return {
      valid: candidate.length >= MIN_USEFUL_TEXT,
      reason: _extractError(data, resp, parseFail),
      cleaned_text: candidate,
    };
  }

  function _normalizeStageTrace(rawStages, fallbackKey, fallbackLabel, fallbackMethod, success, message) {
    const list = Array.isArray(rawStages) ? rawStages.filter(Boolean) : [];
    if (list.length > 0) {
      return list.map(function (stage) {
        return {
          key: String(stage.key || fallbackKey || ''),
          label: String(stage.label || fallbackLabel || ''),
          method: String(stage.method || ''),
          success: typeof stage.success === 'boolean' ? stage.success : !!success,
          message: String(stage.message || ''),
        };
      });
    }
    return [{
      key: fallbackKey || '',
      label: fallbackLabel || '',
      method: fallbackMethod || '',
      success: !!success,
      message: message || '',
    }];
  }

  function _appendStageFailure(stageTrace, key, label, method, message) {
    const failure = {
      key: key || '',
      label: label || key || '수집',
      method: method || key || '',
      success: false,
      message: message || '충분한 본문을 얻지 못했습니다.',
    };
    const list = Array.isArray(stageTrace) ? stageTrace : [];
    const target = list.length ? list[list.length - 1] : null;
    if (target && target.success !== false) {
      target.success = false;
      target.message = target.message || failure.message;
      if (!target.method) target.method = failure.method;
      if (!target.label) target.label = failure.label;
      if (!target.key) target.key = failure.key;
      return list;
    }
    list.push(failure);
    return list;
  }

  function _stageErrorMessage(label) {
    const stageLabel = String(label || '').replace(/\s*수집$/, ' 단계');
    return stageLabel + '에서 충분한 본문을 얻지 못했습니다.';
  }

  function _summarizeFailedStages(stageTrace, fallback) {
    const failures = (Array.isArray(stageTrace) ? stageTrace : [])
      .filter(function (stage) { return stage && stage.success === false && stage.message; })
      .map(function (stage) {
        const label = stage.label || stage.key || '수집';
        return label + ': ' + stage.message;
      });
    if (failures.length > 0) return '모든 수집 시도 실패 - ' + failures.join(' / ');
    return fallback || '본문 수집에 실패했습니다.';
  }

  async function _runServerScrape(url, title, opts) {
    const timeoutMs = (opts && opts.timeoutMs) || 45000;
    _notifyStage(opts, { key: 'server', label: 'Colly/판다/HTTP 수집' });
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/content/scrape-article',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, title: title || '', only_stage: (opts && opts.onlyStage) || '' }),
        },
        timeoutMs,
        '본문 스크래핑'
      );
    } catch (e) {
      return {
        ok: false,
        error: '서버 스크래핑 오류: ' + _abortReason(e),
        method: 'server',
        stageTrace: _normalizeStageTrace([], 'server', 'Colly/판다/HTTP 수집', 'server', false, _abortReason(e)),
      };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    const payload = (data && data.data) ? data.data : {};
    const text = payload.text || (data && data.content) || (data && data.text) || '';
    const method = String(payload.method || 'server');
    const images = Array.isArray(payload.images) ? payload.images : [];
    const gotTitle = String(payload.title || title || url);
    const stageTrace = _normalizeStageTrace(payload.stages, 'server', 'Colly/판다/HTTP 수집', method, resp && resp.ok, '');
    stageTrace.forEach(function (stage) {
      if (stage && stage.key && stage.key !== 'server') _notifyStage(opts, stage);
    });
    if (resp.ok && text && text.length >= (((opts && opts.minLength) || 100))) {
      return { ok: true, text: text, method: method, title: gotTitle, images: images, stageTrace: stageTrace };
    }
    const message = text
      ? '서버 수집 파이프라인에서 충분한 본문을 얻지 못했습니다.'
      : _extractError(data, resp, parseFail);
    return {
      ok: false,
      error: message,
      method: method,
      text: text,
      title: gotTitle,
      images: images,
      stageTrace: _appendStageFailure(stageTrace, 'server', '서버 수집 파이프라인', method, message),
    };
  }

  async function _runChromeBridgeScrape(url, title, opts) {
    const timeoutMs = (opts && opts.chromeBridgeTimeoutMs) || Math.min((opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS, 30000);
    const minLength = (opts && typeof opts.minLength === 'number') ? opts.minLength : 100;
    _notifyStage(opts, {
      key: 'chrome_bridge',
      label: 'Chrome 확장 브릿지 수집',
      method: 'chrome_extension_bridge',
      message: '공통 크롤링 마지막 단계로 기존 Chrome 탭을 사용합니다.',
    });
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/browser/scrape-url',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, title: title || '', min_length: minLength }),
        },
        timeoutMs,
        'Chrome 확장 브릿지 수집'
      );
    } catch (e) {
      const msg = _abortReason(e);
      return {
        ok: false,
        error: 'Chrome 확장 브릿지 오류: ' + msg,
        method: 'chrome_extension_bridge',
        stageTrace: _normalizeStageTrace([], 'chrome_bridge', 'Chrome 확장 브릿지 수집', 'chrome_extension_bridge', false, msg),
      };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    const payload = (data && data.data) ? data.data : {};
    const text = String(payload.text || '').trim();
    const images = Array.isArray(payload.images) ? payload.images : [];
    const gotTitle = String(payload.title || title || url);
    const stageTrace = _normalizeStageTrace(payload.stages, 'chrome_bridge', 'Chrome 확장 브릿지 수집', 'chrome_extension_bridge', resp && resp.ok, '');
    if (resp.ok && data && data.ok && text.length >= minLength) {
      return { ok: true, text: text, method: 'chrome_extension_bridge', title: gotTitle, images: images, url: payload.url || url, stageTrace: stageTrace };
    }
    const message = _extractError(data, resp, parseFail);
    return {
      ok: false,
      error: message,
      method: 'chrome_extension_bridge',
      text: text,
      title: gotTitle,
      images: images,
      stageTrace: _appendStageFailure(stageTrace, 'chrome_bridge', 'Chrome 확장 브릿지 수집', 'chrome_extension_bridge', message),
    };
  }

  async function _runElectronBrowserScrape(url, title, opts) {
    if (!window.electronAPI || typeof window.electronAPI.scrapeUrl !== 'function') {
      return {
        ok: false,
        error: 'Electron 내부 브라우저 API를 찾지 못했습니다.',
        method: 'electron_internal_browser',
        stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', 'electron_internal_browser', false, 'Electron API 없음'),
      };
    }
    const minLength = (opts && typeof opts.minLength === 'number') ? opts.minLength : 100;
    _notifyStage(opts, { key: 'electron', label: '내부 Electron 브라우저 수집', method: 'electron_internal_browser', message: 'headless 없이 실제 Electron 창으로 페이지를 엽니다.' });
    let result;
    try {
      const electronTimeoutMs = Math.max(
        3000,
        Number((opts && opts.electronTimeoutMs) || Math.min(Number((opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS), ELECTRON_SCRAPE_TIMEOUT_MS))
      );
      result = await _promiseWithTimeout(
        window.electronAPI.scrapeUrl(url, Object.assign({ mode: 'full', show: true, visible: true }, (opts && opts.electronOptions) || {})),
        electronTimeoutMs,
        'Electron 내부 브라우저 수집'
      );
    } catch (e) {
      const msg = _abortReason(e);
      return {
        ok: false,
        error: 'Electron 내부 브라우저 오류: ' + msg,
        method: 'electron_internal_browser',
        stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', 'electron_internal_browser', false, msg),
      };
    }
    const text = String((result && result.text) || '').trim();
    const gotTitle = String((result && result.title) || title || url).trim();
    const images = Array.isArray(result && result.images) ? result.images : [];
    const method = String((result && result.method) || 'electron_internal_browser');
    if (result && result.error && text.length < minLength) {
      return {
        ok: false,
        error: String(result.error),
        method: method,
        text: text,
        title: gotTitle,
        images: images,
        stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', method, false, String(result.error)),
      };
    }
    if (text.length >= minLength) {
      const verified = await _validateArticleText(url, gotTitle, text);
      const cleaned = String((verified && verified.cleaned_text) || text).trim();
      if (!verified || verified.valid !== false) {
        return {
          ok: true,
          text: cleaned || text,
          method: method,
          title: gotTitle,
          images: images,
          url: String((result && result.url) || url),
          stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', method, true, '내부 Electron 브라우저로 본문을 수집했습니다.'),
        };
      }
      return {
        ok: false,
        error: verified.reason || 'Electron 브라우저 본문 검증 실패',
        method: method,
        text: cleaned || text,
        title: gotTitle,
        images: images,
        stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', method, false, verified.reason || '본문 검증 실패'),
      };
    }
    return {
      ok: false,
      error: 'Electron 내부 브라우저가 충분한 본문을 얻지 못했습니다.',
      method: method,
      text: text,
      title: gotTitle,
      images: images,
      stageTrace: _normalizeStageTrace([], 'electron', '내부 Electron 브라우저 수집', method, false, '본문 ' + text.length + '자'),
    };
  }

  async function _runRequestedSingleStage(url, title, opts, progressModal) {
    const requested = String((opts && opts.onlyStage) || '').trim().toLowerCase();
    const stageTrace = [];
    let res = null;
    if (requested === 'electron') {
      _modalStage(progressModal, { key: 'electron', method: 'electron_internal_browser', message: '내부 Electron 브라우저 단계만 다시 실행합니다.' }, 'running');
      res = await _runElectronBrowserScrape(url, title, opts);
    } else if (requested === 'cdp' || requested === 'chrome' || requested === 'chrome_bridge') {
      _modalStage(progressModal, { key: 'cdp', method: 'chrome_extension_bridge', message: 'Chrome 브릿지 단계만 다시 실행합니다.' }, 'running');
      res = await _runChromeBridgeScrape(url, title, opts);
    } else if (requested === 'lightpanda' || requested === 'panda') {
      _modalStage(progressModal, { key: 'lightpanda', method: 'lightpanda', message: '판다 브라우저 단계만 다시 실행합니다.' }, 'running');
      res = await _runServerScrape(url, title, Object.assign({}, opts || {}, { onlyStage: 'lightpanda' }));
    } else if (requested === 'requests' || requested === 'request' || requested === 'colly' || requested === 'http') {
      _modalStage(progressModal, { key: 'requests', method: 'requests_html', message: '요청 본문 단계만 다시 실행합니다.' }, 'running');
      res = await _runServerScrape(url, title, Object.assign({}, opts || {}, { onlyStage: 'requests' }));
    } else {
      _modalStage(progressModal, { key: 'server', method: 'server', message: '서버 수집 파이프라인 단계만 다시 실행합니다.' }, 'running');
      res = await _runServerScrape(url, title, opts);
    }
    stageTrace.push.apply(stageTrace, (res && res.stageTrace) || []);
    stageTrace.forEach(function (stage) { _modalStage(progressModal, stage); });
    if (res && res.ok && opts.collectImages !== false) {
      res.images = await _collectImagesForUrl(url, res.images, opts, progressModal);
    }
    if (progressModal) {
      if (res && res.ok) {
        progressModal.setSummary && progressModal.setSummary('선택한 단계로 본문 ' + res.text.length.toLocaleString() + '자와 이미지 ' + (res.images || []).length + '장을 확보했습니다.', '#34c759');
      } else {
        progressModal.setSummary && progressModal.setSummary('선택한 단계에서 충분한 본문을 확보하지 못했습니다.', '#ff9500');
      }
    }
    return Object.assign({}, res || {}, { stageTrace: stageTrace });
  }

  // ── 3.5) 기사 본문 스크래핑 공통 파이프라인 ─────────────────────
  // 프런트의 모든 URL 본문 수집은 반드시 이 함수로만 들어온다.
  // Electron 런타임에서는 내부 Electron 브라우저를 1순위로 쓰고, 실패 시 서버 공통 파이프라인으로 폴백한다.
  async function scrapeArticle(url, opts) {
    if (!url || typeof url !== 'string') return { ok: false, error: 'URL 이 없습니다.' };
    url = normalizeNaverBlogUrl(url);
    const title = (opts && opts.title) || '';
    const minLength = (opts && typeof opts.minLength === 'number') ? opts.minLength : 100;
    const mergedOpts = Object.assign({}, opts || {}, { minLength: minLength });
    const stageTrace = [];
    const progressModal = _createProgressModal(url, title, mergedOpts);
    const maxAttempts = Math.max(1, Math.min(3, Number(mergedOpts.maxAttempts || 3) || 3));
    let lastRes = null;

    if (mergedOpts.onlyStage) {
      return await _runRequestedSingleStage(url, title, mergedOpts, progressModal);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (progressModal && typeof progressModal.setAttempt === 'function') {
        progressModal.setAttempt(attempt, maxAttempts, '본문/이미지 확보 중');
      }
      if (progressModal && typeof progressModal.addLog === 'function') {
        progressModal.addLog('🔄', attempt + '차 시도를 시작합니다.', '#ff8c00');
      }

      if (!mergedOpts.skipElectron) {
        _modalStage(progressModal, {
          key: 'electron',
          method: 'electron_internal_browser',
          message: '내부 Electron 브라우저를 직접 열어 본문을 가져오는 중입니다.',
        }, 'running');
        const electronRes = await _runElectronBrowserScrape(url, title, mergedOpts);
        stageTrace.push.apply(stageTrace, electronRes.stageTrace || []);
        (electronRes.stageTrace || []).forEach(function (stage) { _modalStage(progressModal, stage); });
        if (electronRes.ok) {
          electronRes.images = await _collectImagesForUrl(url, electronRes.images, mergedOpts, progressModal);
          electronRes.stageTrace = stageTrace;
          if (progressModal) {
            progressModal.setSummary && progressModal.setSummary('본문 ' + electronRes.text.length.toLocaleString() + '자와 이미지 ' + (electronRes.images || []).length + '장을 확보했습니다.', '#34c759');
            progressModal.addLog && progressModal.addLog('🎉', '공통 본문/이미지 확보가 끝났습니다.', '#34c759');
          }
          return electronRes;
        }
        lastRes = electronRes;
      }

      const serverRes = await _runServerScrape(url, title, mergedOpts);
      stageTrace.push.apply(stageTrace, serverRes.stageTrace || []);
      (serverRes.stageTrace || []).forEach(function (stage) { _modalStage(progressModal, stage); });
      if (serverRes.ok) {
        serverRes.images = await _collectImagesForUrl(url, serverRes.images, mergedOpts, progressModal);
        serverRes.stageTrace = stageTrace;
        if (progressModal) {
          progressModal.setSummary && progressModal.setSummary('본문 ' + serverRes.text.length.toLocaleString() + '자와 이미지 ' + (serverRes.images || []).length + '장을 확보했습니다.', '#34c759');
          progressModal.addLog && progressModal.addLog('🎉', '공통 본문/이미지 확보가 끝났습니다.', '#34c759');
        }
        return serverRes;
      }
      lastRes = serverRes;
      if (progressModal && typeof progressModal.addLog === 'function') {
        progressModal.addLog('❌', serverRes.error || '본문을 가져오지 못했습니다.', '#ff3b30');
      }
    }

    if (!mergedOpts.skipChromeBridge) {
      _modalStage(progressModal, {
        key: 'chrome_bridge',
        method: 'chrome_extension_bridge',
        message: '마지막 단계로 설정에서 연결한 Chrome 확장 브릿지를 확인합니다.',
      }, 'running');
      const bridgeRes = await _runChromeBridgeScrape(url, title, mergedOpts);
      stageTrace.push.apply(stageTrace, bridgeRes.stageTrace || []);
      (bridgeRes.stageTrace || []).forEach(function (stage) { _modalStage(progressModal, stage); });
      if (bridgeRes.ok) {
        bridgeRes.images = await _collectImagesForUrl(url, bridgeRes.images, mergedOpts, progressModal);
        bridgeRes.stageTrace = stageTrace;
        if (progressModal) {
          progressModal.setSummary && progressModal.setSummary('본문 ' + bridgeRes.text.length.toLocaleString() + '자와 이미지 ' + (bridgeRes.images || []).length + '장을 확보했습니다.', '#34c759');
          progressModal.addLog && progressModal.addLog('🎉', 'Chrome 확장 브릿지로 공통 본문/이미지 확보가 끝났습니다.', '#34c759');
        }
        return bridgeRes;
      }
      lastRes = bridgeRes;
      if (progressModal && typeof progressModal.addLog === 'function') {
        progressModal.addLog('⚠️', bridgeRes.error || 'Chrome 확장 브릿지 수집을 사용할 수 없습니다.', '#ff9500');
      }
    }

    const serverRes = lastRes || {};
    if (progressModal) {
      progressModal.setSummary && progressModal.setSummary('아직 본문과 이미지를 모두 확보하지 못했습니다. 다시 시도하거나 직접 붙여넣기를 사용해 주세요.', '#ff9500');
      progressModal.showManual && progressModal.showManual();
    }
    return {
      ok: false,
      error: _summarizeFailedStages(stageTrace, serverRes.error),
      method: serverRes.method || '',
      text: serverRes.text || '',
      title: serverRes.title || title || url,
      images: serverRes.images || [],
      stageTrace: stageTrace,
    };
  }

  // ── 4) 구글 뉴스 (영·한 글로벌) ─────────────────────────────────
  async function searchGoogleNews(keyword, opts) {
    const q = (keyword || '').trim();
    if (!q) return { ok: false, error: '키워드가 비어있습니다.' };
    const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;
    let resp, data, parseFail;
    try {
      resp = await _fetchWithTimeout(
        '/api/content/search-global',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: q }) },
        timeoutMs,
        'Google 뉴스 검색'
      );
    } catch (e) {
      return { ok: false, error: 'Google 검색 오류: ' + _abortReason(e) };
    }
    try { data = await resp.json(); } catch (e) { parseFail = e; }
    const items = (data && data.data && Array.isArray(data.data.sources))
      ? data.data.sources
      : (data && Array.isArray(data.sources))
        ? data.sources
        : (data && data.data && Array.isArray(data.data))
          ? data.data
          : (Array.isArray(data && data.items) ? data.items : []);
    if (resp.ok && items.length > 0) return { ok: true, items: items };
    return { ok: false, error: _extractError(data, resp, parseFail) };
  }

  // ── 5) 뉴스 모달 래퍼 ───────────────────────────────────────────
  // 내부 구현: window.ce2OpenNewsSearchModal (cardnews_editor2.js) 을 호출하고,
  // 사용자가 선택 → ce2NewsApply 가 window._sharedSourceContent 에 저장할 때까지 폴링.
  async function openNewsModal(opts) {
    if (typeof window.ce2OpenNewsSearchModal !== 'function') {
      return { ok: false, error: '뉴스 검색 모달 함수를 찾지 못했습니다. cardnews_editor2.js 로드 확인 필요.' };
    }
    const timeoutMs = (opts && opts.timeoutMs) || MODAL_TIMEOUT_MS;
    const prev = window._sharedSourceContent || '';
    window._sharedSourceContent = '';
    window.ce2OpenNewsSearchModal(opts || {});
    return await _awaitModalSelection('ce2-news-modal', timeoutMs, prev);
  }

  async function openNaverModal(opts) {
    if (typeof window.ce2OpenNaverSearchModal !== 'function') {
      return { ok: false, error: '네이버 검색 모달 함수를 찾지 못했습니다.' };
    }
    const timeoutMs = (opts && opts.timeoutMs) || MODAL_TIMEOUT_MS;
    const prev = window._sharedSourceContent || '';
    window._sharedSourceContent = '';
    window.ce2OpenNaverSearchModal(opts || {});
    return await _awaitModalSelection('ce2-naver-modal', timeoutMs, prev);
  }

  async function scrapeSelectedSources(items, opts) {
    const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const options = opts || {};
    const results = [];
    for (let idx = 0; idx < sourceItems.length; idx += 1) {
      const item = sourceItems[idx] || {};
      const url = String(item.url || item.link || '').trim();
      const title = String(item.title || item.name || '').trim();
      const snippet = String(item.description || item.snippet || '').trim();
      const source = String(item.source || '').trim();
      const type = String(item.type || (source === '뉴스' ? 'news' : 'blog')).trim();
      let scrapedText = '';
      let scrapedImages = [];
      let scrapeStatus = url ? 'pending' : 'url-empty';
      let scrapeMethod = '';
      let usedUrl = url;
      if (url) {
        if (typeof options.onItemStart === 'function') {
          try { options.onItemStart(item, idx, sourceItems.length); } catch (_) {}
        }
        try {
          let res = null;
          const candidates = sourceCandidateUrls(url);
          for (const candidateUrl of candidates) {
            res = await scrapeArticle(candidateUrl, {
              title: title || candidateUrl,
              minLength: Number(options.minLength || 50),
              showProgressModal: options.showProgressModal === true,
              timeoutMs: Number(options.timeoutMs || DEFAULT_TIMEOUT_MS),
              electronOptions: Object.assign({ mode: 'full', show: true, visible: true }, options.electronOptions || {}),
            });
            usedUrl = candidateUrl;
            if (res && (res.ok || String(res.text || '').trim().length >= Number(options.minLength || 50))) break;
          }
          scrapeMethod = String((res && res.method) || '').trim();
          if (res && res.ok) {
            scrapedText = String(res.text || '').trim();
            scrapedImages = Array.isArray(res.images) ? res.images.filter(Boolean) : [];
            scrapeStatus = scrapeMethod || 'scraped';
          } else {
            scrapedText = String((res && res.text) || '').trim();
            scrapedImages = Array.isArray(res && res.images) ? res.images.filter(Boolean) : [];
            scrapeStatus = 'failed: ' + String((res && res.error) || '본문 수집 실패');
          }
        } catch (e) {
          scrapeStatus = 'failed: ' + String((e && e.message) || e || '본문 수집 실패');
        }
      }
      const textBlock = [
        title ? '[' + title + ']' : '',
        usedUrl ? 'URL: ' + usedUrl : '',
        scrapedText || snippet,
      ].filter(Boolean).join('\n');
      const normalized = {
        title: title,
        snippet: snippet,
        url: usedUrl,
        link: usedUrl,
        originalUrl: usedUrl !== url ? url : '',
        source: source,
        type: type,
        checked: true,
        scrapedText: scrapedText,
        scrapedImages: scrapedImages,
        scrapeStatus: scrapeStatus,
        scrapeMethod: scrapeMethod,
        textBlock: textBlock,
      };
      results.push(normalized);
      if (typeof options.onItemDone === 'function') {
        try { options.onItemDone(normalized, idx, sourceItems.length); } catch (_) {}
      }
    }
    return results;
  }

  // 모달 닫힘 또는 _sharedSourceContent 세팅을 폴링 — 공통 로직.
  async function _awaitModalSelection(modalId, timeoutMs, prevValue) {
    const startedAt = _nowMs();
    return await new Promise(function (resolve) {
      const iv = setInterval(function () {
        const cur = window._sharedSourceContent || '';
        const modalGone = !document.getElementById(modalId);
        if (cur && cur.length >= MIN_USEFUL_TEXT) {
          clearInterval(iv);
          resolve({ ok: true, text: cur });
          return;
        }
        if (modalGone) {
          clearInterval(iv);
          // 취소된 것으로 간주, 이전 값 복원
          window._sharedSourceContent = prevValue || '';
          resolve({ ok: false, error: '모달이 닫히거나 선택이 취소됐습니다.' });
          return;
        }
        if (_nowMs() - startedAt > timeoutMs) {
          clearInterval(iv);
          window._sharedSourceContent = prevValue || '';
          resolve({ ok: false, error: '모달 대기 타임아웃 (' + timeoutMs + 'ms)' });
        }
      }, 400);
    });
  }

  // ── 노출 ─────────────────────────────────────────────────────────
  const API = Object.freeze({
    analyzeYouTube: analyzeYouTube,
    fetchUrl: fetchUrl,
    parseDocument: parseDocument,
    scrapeArticle: scrapeArticle,
    scrapeSelectedSources: scrapeSelectedSources,
    youtubeAnalysisPreviewHTML: youtubeAnalysisPreviewHTML,
    sourceTextPreviewHTML: sourceTextPreviewHTML,
    searchGoogleNews: searchGoogleNews,
    openNewsModal: openNewsModal,
    openNaverModal: openNaverModal,
    normalizeNaverBlogUrl: normalizeNaverBlogUrl,
    // 상수 (외부에서 참고용)
    MIN_USEFUL_TEXT: MIN_USEFUL_TEXT,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    MODAL_TIMEOUT_MS: MODAL_TIMEOUT_MS,
  });
  window._VAGSource = API;
  window.VAGSource = API;
})();
