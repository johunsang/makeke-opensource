/**
 * detailpage_agent.js
 * ?곸꽭?섏씠吏 ?먯씠?꾪듃 ????뷀삎 ?듭뀡 ?좏깮 ???뱀뀡 遺꾪븷 ???대?吏 ?앹꽦
 */
(function () {
  'use strict';

  let _dpagSourceContent = '';
  let _dpagSourceMode = '';
  let _dpagTitle = '';
  let _dpagSections = [];
  let _dpagImages = [];
  let _dpagSourceImages = [];
  let _dpagReferenceImages = [];
  let _dpagSavedFolder = '';
  let _dpagPromptDrafts = [];
  let _dpagLastRunContext = null;

  const DPAG_STYLE_OPTIONS = [
    { label: 'AI 자동', value: '', hint: '브랜드와 소재에 맞춰 자동으로 구성합니다.' },
    { label: '모던 미니멀', value: 'modern', hint: '여백과 정돈된 타이포 중심입니다.' },
    { label: '프리미엄 럭셔리', value: 'luxury', hint: '고급스러운 광택과 집중도 높은 레이아웃입니다.' },
    { label: '내추럴 오가닉', value: 'natural', hint: '성분, 웰니스, 친환경 제품에 맞습니다.' },
    { label: '클린 코스메틱', value: 'clean_beauty', hint: '맑고 깨끗한 뷰티 상세페이지 톤입니다.' },
    { label: '테크 하이엔드', value: 'tech', hint: '디바이스, 전자제품, 기능 강조형에 맞습니다.' },
    { label: '헬스케어 트러스트', value: 'healthcare', hint: '신뢰감과 안정감을 주는 정보형 톤입니다.' },
    { label: '웜 라이프스타일', value: 'warm_lifestyle', hint: '생활용품과 리빙 브랜드에 맞습니다.' },
    { label: '매거진 에디토리얼', value: 'magazine', hint: '브랜드 화보처럼 감도 있게 보여줍니다.' },
    { label: '소프트 페미닌', value: 'soft_feminine', hint: '부드럽고 섬세한 여성 타깃 톤입니다.' },
    { label: '프리미엄 푸드', value: 'gourmet', hint: '식품, 디저트, 식음료에 적합합니다.' },
    { label: '키즈 플레이풀', value: 'playful', hint: '밝고 친근한 아동 상품 톤입니다.' },
    { label: '큐트 캐주얼', value: 'cute', hint: '가볍고 귀여운 소비재에 어울립니다.' },
    { label: '다크 시크', value: 'dark', hint: '강한 대비와 묵직한 분위기를 줍니다.' },
    { label: '레트로 팝', value: 'retro_pop', hint: '강한 컬러와 재미있는 구성이 특징입니다.' },
    { label: '미니 인포그래픽', value: 'infographic', hint: '기능과 비교 포인트 전달에 강합니다.' },
    { label: '브랜드 스토리텔링', value: 'storytelling', hint: '브랜드 메시지와 감정선을 강조합니다.' },
    { label: '수채화 일러스트', value: 'watercolor', hint: '감성적인 일러스트 중심 톤입니다.' },
  ];

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function _summaryChip(label, value, tone) {
    if (!value) return '';
    const palette = tone === 'source'
      ? 'background:rgba(0,122,255,0.08);color:#007aff;border-color:rgba(0,122,255,0.15);'
      : 'background:rgba(255,140,0,0.08);color:#ff8c00;border-color:rgba(255,140,0,0.18);';
    return `<div style="display:inline-flex;align-items:center;gap:6px;padding:8px 11px;border-radius:999px;border:1px solid transparent;font-size:12px;font-weight:700;${palette}"><span style="opacity:0.65;">${label}</span><span>${_esc(value)}</span></div>`;
  }
  function _getSourceLabel(mode) {
    return {
      text: '직접 입력',
      news: '뉴스 검색',
      naver: '네이버 검색',
      youtube: 'YouTube 분석',
      url: 'URL 가져오기',
      file: '파일 업로드',
      none: '소재 없이 진행',
    }[mode] || '';
  }
  function _setSummary() {
    const el = document.getElementById('dpag-summary');
    if (!el) return;
    el.innerHTML = `${_summaryChip('주제', _dpagTitle, 'title')}${_summaryChip('소재', _getSourceLabel(_dpagSourceMode), 'source')}`;
    el.style.display = el.innerHTML ? 'flex' : 'none';
  }
  function _resetState() {
    _dpagSourceContent = '';
    _dpagSourceMode = '';
    _dpagTitle = '';
    _dpagSections = [];
    _dpagImages = [];
    _dpagSourceImages = [];
    _dpagReferenceImages = [];
    _dpagSavedFolder = '';
    _dpagPromptDrafts = [];
    _dpagLastRunContext = null;
    _setSummary();
  }

  function dpagInit() {
    const root = document.getElementById('detailpage-agent-root');
    if (!root) return;
    if (typeof mkkRenderSingleImageModelBanner === 'function') {
      mkkRenderSingleImageModelBanner('detailpage-agent', { note: '상세페이지 섹션 이미지 생성 시작 전 설정 모델을 사용합니다.' });
    }
    _resetState();
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;min-height:calc(100vh - 140px);">
        <div id="dpag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:18px;display:flex;flex-direction:column;min-height:540px;overflow:hidden;">
          <div style="padding:16px 18px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">
            <div style="display:flex;align-items:flex-start;gap:10px;">
              <div style="width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(255,140,0,0.24);">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              </div>
              <div>
                <div style="font-size:14px;font-weight:800;color:#1c1c1e;">상세페이지 에이전트</div>
                <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:4px;line-height:1.6;">상품명과 소재를 넣으면 섹션형 상세페이지 이미지를 만듭니다.</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <button type="button" onclick="dpagRestart()" title="처음부터 다시 시작" style="padding:10px 13px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:12px;font-weight:800;cursor:pointer;">재시작</button>
              <button type="button" onclick="dpagGenerate()" id="dpag-gen-btn" style="padding:12px 16px;border-radius:14px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 8px 20px rgba(255,140,0,0.24);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                상세페이지 생성 시작
              </button>
            </div>
          </div>
          <div id="dpag-summary" style="display:none;gap:8px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,0.06);background:rgba(255,140,0,0.03);"></div>
          <div id="dpag-chat-body" data-empty="true" style="padding:16px 18px;display:flex;flex-direction:column;gap:8px;flex:1;overflow:auto;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:240px;text-align:center;color:rgba(0,0,0,0.2);padding:24px 10px;">
              <div style="font-size:34px;">🧾</div>
              <div style="margin-top:10px;font-size:15px;font-weight:800;color:rgba(0,0,0,0.38);">상세페이지를 만듭니다</div>
              <div style="margin-top:8px;font-size:12px;line-height:1.7;color:rgba(0,0,0,0.32);">상품명과 소재를 고르면<br>섹션별 이미지를 만들어 보여드립니다.</div>
            </div>
          </div>
          <div id="dpag-result" style="display:none;padding:16px 18px;border-top:1px solid rgba(0,0,0,0.06);background:rgba(245,245,247,0.55);">
            <div id="dpag-result-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;"></div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
              <button onclick="dpagEditPromptsAndRegenerate()" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:800;cursor:pointer;">지시문 수정 후 다시 만들기</button>
              <button onclick="dpagDownloadAll()" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">전체 다운로드</button>
              <button onclick="dpagOpenFolder()" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;font-weight:700;cursor:pointer;">폴더 열기</button>
            </div>
          </div>
        </div>
      </div>`;
  }
  function _scrollChatToBottom() {
    const body = document.getElementById('dpag-chat-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  function _waitForSharedSource(previousValue, timeoutMs) {
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        const current = String(window._sharedSourceContent || '').trim();
        const modalOpen = !!document.querySelector('#ce2-news-modal, #ce2-naver-modal, #ce2-knowledge-modal');
        if (current && current !== previousValue) {
          clearInterval(timer);
          resolve(current);
          return;
        }
        if (!modalOpen && Date.now() - started > 600) {
          clearInterval(timer);
          resolve('');
          return;
        }
        if (Date.now() - started >= timeoutMs) {
          clearInterval(timer);
          resolve('');
        }
      }, 400);
    });
  }

  async function dpagToggleSource(mode) {
    _dpagSourceMode = mode;
    _setSummary();
    if (mode === 'news' && typeof ce2OpenNewsSearchModal === 'function') ce2OpenNewsSearchModal();
    if (mode === 'naver' && typeof ce2OpenNaverSearchModal === 'function') ce2OpenNaverSearchModal();
    if (mode === 'knowledge' && typeof ce2OpenKnowledgeModal === 'function') ce2OpenKnowledgeModal();
    const previous = String(window._sharedSourceContent || '').trim();
    if (mode === 'news' || mode === 'naver' || mode === 'knowledge') {
      const picked = await _waitForSharedSource(previous, 120000);
      if (picked) _dpagSourceContent = picked;
      return picked;
    }
    return _dpagSourceContent;
  }

  async function dpagFetchYoutube(urlArg) {
    const url = String(urlArg || '').trim();
    if (!url) return '';
    const res = await window._VAGSource.analyzeYouTube(url);
    if (res.ok) {
      _dpagSourceContent = res.text;
      return res.text;
    }
    _addMsg('ai', `<span style="color:#ff3b30;">${_esc(res.error)}</span>`);
    return '';
  }

  async function dpagFetchUrl(urlArg) {
    const url = String(urlArg || '').trim();
    if (!url) return '';
    const res = await window._VAGSource.scrapeArticle(url, { minLength: 50 });
    if (res.ok) {
      _dpagSourceContent = res.text;
      _dpagSourceImages = _dedupeURLs(res.images || [], 24);
      return res.text;
    }
    _addMsg('ai', `<span style="color:#ff3b30;">${_esc(res.error || '내용을 충분히 가져오지 못했습니다.')}</span>`);
    return '';
  }

  function _parseURLs(raw) {
    const text = String(raw || '').trim();
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s,]+/gi) || [];
    const split = text.split(/[\s,\n]+/).filter(item => /^https?:\/\//i.test(item));
    return _dedupeURLs(matches.concat(split).map(item => item.replace(/[)\].,，。]+$/g, '')), 20);
  }

  function _dedupeURLs(list, limit) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach(item => {
      const url = String(typeof item === 'string' ? item : (item?.url || '')).trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out.slice(0, limit || out.length);
  }

  async function dpagFetchUrls(rawArg) {
    const urls = _parseURLs(rawArg);
    if (!urls.length) return '';
    const items = urls.map((url, idx) => ({ title: `URL ${idx + 1}`, url, type: 'url' }));
    try {
      if (window._VAGSource && typeof window._VAGSource.scrapeSelectedSources === 'function') {
        const results = await window._VAGSource.scrapeSelectedSources(items, {
          minLength: 50,
          timeoutMs: 60000,
          showProgressModal: true,
          electronOptions: { show: true, visible: true },
        });
        const blocks = [];
        const images = [];
        results.forEach((item, idx) => {
          const text = String(item?.textBlock || item?.scrapedText || item?.text || '').trim();
          if (text) blocks.push(text);
          if (Array.isArray(item?.scrapedImages)) images.push(...item.scrapedImages);
          if (Array.isArray(item?.images)) images.push(...item.images);
          if (!text) blocks.push(`[URL ${idx + 1}] ${urls[idx]}`);
        });
        _dpagSourceImages = _dedupeURLs(images, 48);
        _dpagSourceContent = blocks.join('\n\n').trim();
        return _dpagSourceContent;
      }
    } catch (e) {
      console.warn('[DPAG] scrapeSelectedSources failed:', e);
    }

    const blocks = [];
    const images = [];
    for (const url of urls) {
      const res = await window._VAGSource.scrapeArticle(url, {
        minLength: 50,
        timeoutMs: 60000,
        electronOptions: { show: true, visible: true },
      });
      if (res.ok) {
        blocks.push(`### ${res.title || url}\n${res.text || ''}`);
        if (Array.isArray(res.images)) images.push(...res.images);
      } else {
        _addMsg('ai', `<span style="color:#ff9500;">${_esc(url)} 수집 실패: ${_esc(res.error || '본문 부족')}</span>`);
      }
    }
    _dpagSourceImages = _dedupeURLs(images, 48);
    _dpagSourceContent = blocks.join('\n\n').trim();
    return _dpagSourceContent;
  }

  function dpagPickFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.html,.docx';
      input.onchange = evt => {
        const file = evt.target.files?.[0];
        if (!file) {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
          _dpagSourceContent = String(ev.target?.result || '');
          resolve(_dpagSourceContent);
        };
        reader.onerror = () => resolve('');
        reader.readAsText(file);
      };
      input.click();
    });
  }
  function _addMsg(role, html) {
    const body = document.getElementById('dpag-chat-body');
    if (!body) return;
    if (body.dataset.empty === 'true') {
      body.innerHTML = '';
      body.dataset.empty = 'false';
    }
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${isAi ? 'flex-start' : 'flex-end'};`;
    div.innerHTML = `<div style="max-width:86%;padding:11px 14px;border-radius:${isAi ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};background:${isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)'};color:${isAi ? '#1c1c1e' : '#fff'};font-size:13px;line-height:1.65;">${html}</div>`;
    body.appendChild(div);
    _scrollChatToBottom();
  }

  function _clearOptionRows() {
    const body = document.getElementById('dpag-chat-body');
    if (!body) return;
    body.querySelectorAll('.dpag-chat-options, .dpag-inline-card').forEach(el => el.remove());
  }

  function _addSourcePreview(title, text, tone) {
    if (!text) return;
    if (window._VAGSource && typeof window._VAGSource.sourceTextPreviewHTML === 'function') {
      const body = document.getElementById('dpag-chat-body');
      if (!body) return;
      const card = document.createElement('div');
      card.className = 'dpag-inline-card';
      card.innerHTML = window._VAGSource.sourceTextPreviewHTML(title, text);
      body.appendChild(card);
      _scrollChatToBottom();
      return;
    }
    const color = tone === 'knowledge' ? '#5856d6' : '#007aff';
    const border = tone === 'knowledge' ? 'rgba(88,86,214,0.14)' : 'rgba(0,122,255,0.14)';
    const bg = tone === 'knowledge' ? 'rgba(88,86,214,0.06)' : 'rgba(0,122,255,0.06)';
    const body = document.getElementById('dpag-chat-body');
    if (!body) return;
    const card = document.createElement('div');
    card.className = 'dpag-inline-card';
    card.style.cssText = `padding:12px;border:1px solid ${border};background:${bg};border-radius:16px;`;
    card.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:${color};">${_esc(title)}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.42);margin-top:4px;">총 ${text.length}자 반영됨</div>
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:12px;font-weight:700;color:#1c1c1e;">내용 확인</summary>
        <div style="margin-top:10px;padding:11px 12px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);font-size:12px;line-height:1.72;color:#1c1c1e;white-space:pre-wrap;max-height:220px;overflow:auto;">${_esc(text.slice(0, 4000))}</div>
      </details>`;
    body.appendChild(card);
    _scrollChatToBottom();
  }

  function _collectedSourceImages() {
    const images = [..._dpagSourceImages];
    const shared = Array.isArray(window._sharedSelectedSources) ? window._sharedSelectedSources : [];
    shared.forEach(source => {
      if (Array.isArray(source?.scrapedImages)) images.push(...source.scrapedImages);
      if (Array.isArray(source?.images)) images.push(...source.images);
      if (source?.thumbImage) images.push(source.thumbImage);
      if (source?.thumbnail) images.push(source.thumbnail);
    });
    return _dedupeURLs(images, 48);
  }

  async function _uploadReferenceImages() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files || []);
        if (!files.length) {
          resolve([]);
          return;
        }
        const fd = new FormData();
        files.forEach(file => fd.append('files', file));
        try {
          const res = await fetch('/api/content/upload-image', { method: 'POST', body: fd });
          const data = await res.json();
          const uploaded = [];
          if (data.url) uploaded.push(data.url);
          (data.images || []).forEach(img => {
            const url = typeof img === 'string' ? img : img?.url;
            if (url) uploaded.push(url);
          });
          resolve(_dedupeURLs(uploaded, 24));
        } catch (e) {
          console.warn('[DPAG] image upload failed:', e);
          resolve([]);
        }
      };
      input.click();
    });
  }

  function _addImageReferencePreview(title, urls) {
    const images = _dedupeURLs(urls, 12);
    if (!images.length) return;
    const body = document.getElementById('dpag-chat-body');
    if (!body) return;
    const card = document.createElement('div');
    card.className = 'dpag-inline-card';
    card.style.cssText = 'padding:12px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.045);border-radius:16px;';
    card.innerHTML = `
      <div style="font-size:12px;font-weight:900;color:#1c1c1e;">${_esc(title)}</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:3px;">${images.length}장 반영 예정</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-top:10px;max-width:560px;">
        ${images.map(url => `<img src="${_esc(url)}" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:#fff;">`).join('')}
      </div>`;
    body.appendChild(card);
    _scrollChatToBottom();
  }

  async function _askReferenceImages() {
    const collected = _collectedSourceImages();
    _addMsg('ai', '상세페이지에 참고 이미지를 넣을까요?<br><span style="font-size:11px;color:rgba(0,0,0,0.38);">상품 사진, 강의 썸네일, 서비스 소개 이미지, 후기 캡처, 브랜드 이미지 등을 여러 장 넣을 수 있습니다.</span>');
    const options = [
      { label: '이미지 업로드', desc: '내 컴퓨터의 이미지를 여러 장 선택' },
      { label: '건너뛰기', desc: '이미지 없이 텍스트와 주제로 구성' },
    ];
    if (collected.length) {
      options.splice(1, 0, { label: '수집 이미지 사용', desc: `링크에서 긁어온 이미지 ${collected.length}장 사용` });
      options.splice(2, 0, { label: '업로드 + 수집 이미지', desc: '내 이미지와 수집 이미지를 함께 사용' });
    }
    const choice = await _askOptions(options);
    let refs = [];
    if (choice === '이미지 업로드' || choice === '업로드 + 수집 이미지') {
      const uploaded = await _uploadReferenceImages();
      refs.push(...uploaded);
    }
    if (choice === '수집 이미지 사용' || choice === '업로드 + 수집 이미지') {
      refs.push(...collected);
    }
    refs = _dedupeURLs(refs, 12);
    _dpagReferenceImages = refs;
    if (refs.length) {
      _addMsg('ai', `참고 이미지 ${refs.length}장을 이미지 생성에 함께 전달합니다.`);
      _addImageReferencePreview('상세페이지 참고 이미지', refs);
    } else {
      _addMsg('ai', '참고 이미지 없이 구성하겠습니다.');
    }
    return refs;
  }

  function _askOptions(options) {
    return new Promise(resolve => {
      const body = document.getElementById('dpag-chat-body');
      if (!body) {
        resolve(options[0]?.label || '');
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'dpag-chat-options';
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 8px;';
      options.forEach(opt => {
        const label = typeof opt === 'string' ? opt : opt.label;
        const desc = typeof opt === 'string' ? '' : (opt.desc || '');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = 'padding:9px 13px;border-radius:16px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;text-align:left;';
        btn.innerHTML = desc ? `<div>${_esc(label)}</div><div style="font-size:10px;font-weight:500;opacity:0.75;margin-top:2px;">${_esc(desc)}</div>` : _esc(label);
        btn.onclick = () => {
          _clearOptionRows();
          _addMsg('user', _esc(label));
          resolve(label);
        };
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
      _scrollChatToBottom();
    });
  }

  function _askTextInput(config) {
    return new Promise(resolve => {
      const body = document.getElementById('dpag-chat-body');
      if (!body) {
        resolve('');
        return;
      }
      const card = document.createElement('div');
      card.className = 'dpag-inline-card';
      card.style.cssText = 'padding:12px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.05);border-radius:16px;display:flex;flex-direction:column;gap:10px;';
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:12px;font-weight:800;color:#1c1c1e;">${_esc(config.title || '입력')}</div>
            ${config.caption ? `<div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:3px;">${_esc(config.caption)}</div>` : ''}
          </div>
          ${config.badge ? `<div style="padding:6px 10px;border-radius:999px;background:#fff;color:#ff8c00;border:1px solid rgba(255,140,0,0.15);font-size:10px;font-weight:800;">${_esc(config.badge)}</div>` : ''}
        </div>
        ${config.multiline !== false
          ? `<textarea rows="${config.rows || 6}" placeholder="${_esc(config.placeholder || '')}" style="width:100%;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;font-size:13px;line-height:1.65;background:#fff;resize:vertical;outline:none;">${_esc(config.value || '')}</textarea>`
          : `<input type="text" value="${_esc(config.value || '')}" placeholder="${_esc(config.placeholder || '')}" style="width:100%;padding:12px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:14px;font-size:13px;background:#fff;outline:none;">`}
        <div style="display:flex;gap:8px;">
          <button type="button" data-role="submit" style="padding:10px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">확인</button>
          ${config.allowSkip ? '<button type="button" data-role="skip" style="padding:10px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:12px;background:#fff;color:rgba(0,0,0,0.55);font-size:12px;font-weight:700;cursor:pointer;">건너뛰기</button>' : ''}
        </div>`;
      const field = card.querySelector(config.multiline !== false ? 'textarea' : 'input');
      const submit = () => {
        const value = String(field?.value || '').trim();
        if (!value && !config.allowEmpty) {
          field?.focus();
          return;
        }
        card.remove();
        _addMsg('user', value ? _esc(config.preview ? config.preview(value) : value) : '건너뛰기');
        resolve(value);
      };
      card.querySelector('[data-role="submit"]')?.addEventListener('click', submit);
      card.querySelector('[data-role="skip"]')?.addEventListener('click', () => {
        card.remove();
        _addMsg('user', '건너뛰기');
        resolve('');
      });
      field?.addEventListener('keydown', evt => {
        if (config.multiline === false && evt.key === 'Enter') {
          evt.preventDefault();
          submit();
        }
      });
      body.appendChild(card);
      field?.focus();
      _scrollChatToBottom();
    });
  }

  function _askMultiSelect(title, options, defaults) {
    return new Promise(resolve => {
      const body = document.getElementById('dpag-chat-body');
      if (!body) {
        resolve(defaults || []);
        return;
      }
      const card = document.createElement('div');
      card.className = 'dpag-inline-card';
      card.style.cssText = 'padding:12px;border:1px solid rgba(0,0,0,0.06);background:rgba(120,120,128,0.04);border-radius:16px;display:flex;flex-direction:column;gap:10px;';
      const checks = options.map(opt => `
        <label style="display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,0.06);cursor:pointer;font-size:12px;font-weight:600;color:#1c1c1e;">
          <input type="checkbox" value="${_esc(opt)}" ${defaults.includes(opt) ? 'checked' : ''} style="accent-color:#ff8c00;width:16px;height:16px;">
          <span>${_esc(opt)}</span>
        </label>`).join('');
      card.innerHTML = `<div style="font-size:12px;font-weight:800;color:#1c1c1e;">${_esc(title)}</div><div style="display:flex;flex-direction:column;gap:6px;">${checks}</div><button type="button" data-role="submit" style="align-self:flex-start;padding:10px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">선택 완료</button>`;
      card.querySelector('[data-role="submit"]')?.addEventListener('click', () => {
        const selected = [...card.querySelectorAll('input:checked')].map(el => el.value);
        card.remove();
        _addMsg('user', _esc(selected.join(', ') || '기본 구성'));
        resolve(selected);
      });
      body.appendChild(card);
      _scrollChatToBottom();
    });
  }

  function _setGenerateButtonLoading(isLoading) {
    const btn = document.getElementById('dpag-gen-btn');
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:15px;height:15px;border-width:2px;"></span> 상세페이지 생성중...';
      return;
    }
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg> 상세페이지 생성 시작';
  }

  function _detailSectionSlide(sec, idx, total) {
    const title = String(sec?.title || sec?.type || `상세페이지 ${idx + 1}`).trim();
    const body = String(sec?.body || '').trim();
    const role = idx === 0 || sec?.type === 'cover' ? '상세페이지 표지' : '상세페이지 본문 섹션';
    return {
      slide_number: idx + 1,
      title,
      body,
      role,
      visual_prompt: [
        role,
        title,
        body,
        '모바일 상세페이지용 세로 이미지, 제품/서비스 소개에 맞는 섹션형 레이아웃, 읽기 쉬운 정보 구조',
        `전체 ${total}장 중 ${idx + 1}장`
      ].filter(Boolean).join('. '),
    };
  }

  function _detailImageInstructions(params) {
    const type = params.detailTypeLabel || '범용 상세페이지';
    const refs = Array.isArray(params.referenceImages) ? params.referenceImages.length : 0;
    return [
      `상세페이지 유형: ${type}`,
      '한국 시장의 상품, 강의, 서비스, 병원/뷰티, 로컬 매장, B2B, 행사, 앱/솔루션 등 다양한 업종에 맞는 상세페이지 이미지로 구성하세요.',
      '첨부 참조 이미지가 있으면 제품/인물/공간/강의자료/서비스 화면/후기 캡처/브랜드 요소를 우선 반영하되, 억지 합성이나 별도 워터마크처럼 붙이지 말고 자연스럽게 장면 안에 녹이세요.',
      '링크에서 수집된 본문과 이미지의 사실 관계를 유지하고, 없는 수치나 인증은 만들어내지 마세요.',
      '한국어 텍스트를 사용하고 영어 라벨을 남발하지 마세요.',
      refs ? `참조 이미지 ${refs}장을 반영합니다.` : '참조 이미지 없이 업종과 소재에 맞는 원본 비주얼을 생성합니다.',
    ].join('\n');
  }

  function _resolveGeneratedImageUrl(data) {
    const raw = String(data?.image_url || data?.imageUrl || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const path = raw.startsWith('/api/') ? raw : '/api/cardnews/image/' + raw;
    if (path.includes('%')) return path;
    return path.split('/').map((part, idx) => idx <= 2 ? part : encodeURIComponent(part)).join('/');
  }

  function _imageModelLabel(data) {
    const provider = String(data?.image_provider || data?.provider || '').trim();
    const model = String(data?.image_model || data?.model || '').trim();
    if (!provider && !model) return '이미지 모델: 설정값 사용';
    return `이미지 모델: ${provider || '설정'} · ${model || '설정'}`;
  }

  async function _generateDetailSectionImage(params) {
    let lastError = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const imgResp = await fetch('/api/cardnews/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide: params.slide,
          topic: params.topic,
          style: attempt === 1 ? params.style : 'modern',
          aspect_ratio: '9:16',
          project_dir: params.projectDir,
          cardnews_id: params.cardnewsID,
          brand_name: params.brandName,
          brand_color: params.brandColor,
          image_size: '1K',
          image_provider: '',
          image_model: '',
          profile_id: params.profileId,
          user_image_url: (params.referenceImages || [])[0] || '',
          user_image_urls: params.referenceImages || [],
          use_profile_design_ref: !(params.referenceImages && params.referenceImages.length),
          custom_instructions: _detailImageInstructions(params),
          source: 'detailpage',
        }),
      });
      let imgData = {};
      try {
        imgData = await imgResp.json();
      } catch (e) {
        imgData = { error: e.message };
      }
      const imageUrl = _resolveGeneratedImageUrl(imgData);
      if (imgResp.ok && imageUrl) {
        return { ok: true, imageUrl, data: imgData, attempts: attempt };
      }
      lastError = imgData.error || imgData.message || `이미지 생성 실패 (${imgResp.status})`;
      if (attempt === 1) {
        _addMsg('ai', `<span style="color:#ff9500;">${params.indexLabel} 이미지가 비어 있어 한 번 더 시도합니다.</span>`);
        await new Promise(resolve => setTimeout(resolve, 900));
      }
    }
    return { ok: false, error: lastError || '이미지 데이터가 없습니다', data: {}, attempts: 2 };
  }

  function _buildDetailPromptDrafts(sections) {
    const list = Array.isArray(sections) ? sections : [];
    return list.map((sec, i) => _detailSectionSlide(sec, i, list.length));
  }

  function _collectDetailPromptDrafts(card, fallbackDrafts) {
    return fallbackDrafts.map((draft, idx) => {
      const read = field => String(card.querySelector(`[data-index="${idx}"][data-field="${field}"]`)?.value || '').trim();
      return {
        ...draft,
        title: read('title') || draft.title,
        body: read('body'),
        visual_prompt: read('visual_prompt') || draft.visual_prompt,
      };
    });
  }

  function _reviewDetailPrompts(drafts, label) {
    return new Promise(resolve => {
      const body = document.getElementById('dpag-chat-body');
      const safeDrafts = (Array.isArray(drafts) ? drafts : []).map(item => ({ ...item }));
      if (!body || !safeDrafts.length) {
        resolve(safeDrafts);
        return;
      }
      const card = document.createElement('div');
      card.className = 'dpag-inline-card';
      card.style.cssText = 'padding:14px;border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.045);border-radius:16px;display:flex;flex-direction:column;gap:12px;';
      card.innerHTML = `
        <div>
          <div style="font-size:13px;font-weight:900;color:#1c1c1e;">${_esc(label || '이미지 만들기 전 지시문 확인')}</div>
          <div style="font-size:11px;color:rgba(0,0,0,0.48);line-height:1.65;margin-top:4px;">아래 내용이 이미지 만들기에 전달됩니다. 원하는 문장으로 고친 뒤 시작하세요.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;max-height:520px;overflow:auto;padding-right:2px;">
          ${safeDrafts.map((draft, idx) => `
            <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:12px;font-weight:900;color:#ff8c00;">${idx + 1}장</div>
              <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">제목
                <input data-index="${idx}" data-field="title" value="${_esc(draft.title || '')}" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;color:#1c1c1e;background:#fff;outline:none;">
              </label>
              <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">본문 문구
                <textarea data-index="${idx}" data-field="body" rows="3" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(draft.body || '')}</textarea>
              </label>
              <label style="display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:rgba(0,0,0,0.52);">이미지 지시문
                <textarea data-index="${idx}" data-field="visual_prompt" rows="5" style="width:100%;padding:10px 11px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;font-size:12px;line-height:1.55;color:#1c1c1e;background:#fff;resize:vertical;outline:none;">${_esc(draft.visual_prompt || '')}</textarea>
              </label>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" data-role="submit" style="padding:10px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">이 지시문으로 이미지 만들기</button>
        </div>`;
      card.querySelector('[data-role="submit"]')?.addEventListener('click', () => {
        const edited = _collectDetailPromptDrafts(card, safeDrafts);
        card.remove();
        _addMsg('user', '지시문 확인 완료');
        resolve(edited);
      });
      body.appendChild(card);
      _scrollChatToBottom();
    });
  }

  async function _generateDetailImagesFromDrafts(drafts, context) {
    const resultEl = document.getElementById('dpag-result');
    const grid = document.getElementById('dpag-result-grid');
    const safeDrafts = Array.isArray(drafts) ? drafts : [];
    _dpagImages = [];
    if (resultEl) resultEl.style.display = 'block';
    if (grid) grid.innerHTML = '';
    let projectDir = '';
    let cardnewsID = null;

    for (let i = 0; i < safeDrafts.length; i += 1) {
      const draft = safeDrafts[i];
      _addMsg('ai', `<b>${i + 1}/${safeDrafts.length}</b> ${_esc(draft.title || '섹션')} 이미지를 생성 중입니다...`);
      try {
        const imgResult = await _generateDetailSectionImage({
          slide: draft,
          topic: context.topic || '상세페이지',
          style: context.styleValue || 'modern',
          projectDir,
          cardnewsID,
          brandName: context.brandName || '',
          brandColor: context.brandColor || '',
          profileId: context.profileId || 0,
          detailTypeLabel: context.detailTypeLabel || '',
          referenceImages: context.referenceImages || [],
          indexLabel: `${i + 1}장`,
        });
        if (imgResult.ok && imgResult.imageUrl) {
          const imgData = imgResult.data || {};
          projectDir = imgData.project_dir || projectDir;
          cardnewsID = imgData.cardnews_id || cardnewsID;
          if (projectDir) _dpagSavedFolder = projectDir;
          const viewUrl = imgResult.imageUrl + (imgResult.imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
          _dpagImages.push(viewUrl);
          if (grid) {
            const modelLabel = _imageModelLabel(imgData);
            grid.innerHTML += `<div style="border:1px solid rgba(0,0,0,0.06);border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,0.05);"><img src="${viewUrl}" style="width:100%;height:260px;object-fit:cover;display:block;cursor:pointer;" onclick="window.open(this.src)"><div style="padding:10px 12px;"><div style="font-size:11px;font-weight:800;color:#1c1c1e;">${i + 1}장</div><div style="font-size:12px;color:rgba(0,0,0,0.55);margin-top:4px;line-height:1.5;">${_esc(draft.title || '')}</div><div style="font-size:10px;color:rgba(0,0,0,0.38);margin-top:6px;line-height:1.45;">${_esc(modelLabel)}</div></div></div>`;
          }
        } else {
          _dpagImages.push('');
          _addMsg('ai', `<span style="color:#ff3b30;">${i + 1}장 생성에 실패했습니다. ${_esc(imgResult.error || '')}</span>`);
        }
      } catch (e) {
        _dpagImages.push('');
        _addMsg('ai', `<span style="color:#ff3b30;">오류: ${_esc(e.message)}</span>`);
      }
    }

    const successCount = _dpagImages.filter(Boolean).length;
    const failCount = safeDrafts.length - successCount;
    if (successCount === safeDrafts.length) {
      _addMsg('ai', `<b>상세페이지 ${successCount}장 생성 완료!</b>`);
    } else if (successCount > 0) {
      _addMsg('ai', `<b>상세페이지 ${successCount}장은 생성했고, ${failCount}장은 실패했습니다.</b><br><span style="font-size:11px;color:#ff9500;">실패한 장면은 오류 내용을 확인한 뒤 다시 시도해주세요.</span>`);
    } else {
      _addMsg('ai', `<b style="color:#ff3b30;">상세페이지 이미지를 생성하지 못했습니다.</b><br><span style="font-size:11px;color:rgba(0,0,0,0.55);">위에 표시된 오류를 확인한 뒤 다시 시도해주세요.</span>`);
    }
  }

  async function dpagEditPromptsAndRegenerate() {
    if (!_dpagPromptDrafts.length || !_dpagLastRunContext) {
      _addMsg('ai', '먼저 상세페이지를 한 번 만들어주세요. 그러면 방금 사용한 지시문을 다시 고칠 수 있습니다.');
      return;
    }
    const edited = await _reviewDetailPrompts(_dpagPromptDrafts, '다시 만들 지시문 수정');
    _dpagPromptDrafts = edited;
    _addMsg('ai', '수정한 지시문으로 다시 만들겠습니다.');
    _setGenerateButtonLoading(true);
    try {
      await _generateDetailImagesFromDrafts(edited, _dpagLastRunContext);
    } finally {
      _setGenerateButtonLoading(false);
    }
  }

  async function dpagGenerate() {
    _resetState();
    _clearOptionRows();
    const chatBody = document.getElementById('dpag-chat-body');
    const resultEl = document.getElementById('dpag-result');
    const grid = document.getElementById('dpag-result-grid');
    if (chatBody) {
      chatBody.innerHTML = '';
      chatBody.dataset.empty = 'false';
    }
    if (resultEl) resultEl.style.display = 'none';
    if (grid) grid.innerHTML = '';

    const brandName = window._globalProfileData?.name || '';
    const defaultTitle = brandName || '';

    try {
      _addMsg('ai', '상세페이지를 만듭니다. 먼저 상품명, 서비스명, 혹은 이번에 밀고 싶은 주제를 알려주세요.');
      _dpagTitle = await _askTextInput({
        title: '주제 또는 상품명',
        caption: '브랜드명만 넣기보다 이번 상세페이지의 핵심 상품이나 서비스명을 적는 편이 결과가 정확합니다.',
        badge: '주제',
        value: defaultTitle,
        placeholder: '예: 프리미엄 비타민C 세럼 / 두피케어 샴푸 / 피부과 리프팅 프로그램',
        multiline: false,
        preview: value => value,
        allowEmpty: false,
      });
      _setSummary();

      _addMsg('ai', '이번 상세페이지에 넣을 소재를 어떻게 준비할까요? 직접 입력도 바로 받을 수 있고, 검색이나 URL도 가능합니다.');
      const sourceChoice = await _askOptions([
        { label: '직접 입력', desc: '설명과 카피를 내가 직접 넣기' },
        { label: '뉴스 검색', desc: '기사 기반으로 소재 정리' },
        { label: '네이버 검색', desc: '블로그/포스트 기반 자료 수집' },
        { label: 'YouTube 분석', desc: '영상 내용을 소재로 요약' },
        { label: 'URL 가져오기', desc: '기사/블로그/상품/강의/서비스 페이지 여러 개 수집' },
        { label: '파일 업로드', desc: '텍스트 문서 내용을 소재로 사용' },
        { label: '소재 없이 진행', desc: '주제와 옵션만으로 바로 구성' },
      ]);
      const sourceModeMap = {
        '직접 입력': 'text',
        '뉴스 검색': 'news',
        '네이버 검색': 'naver',
        'YouTube 분석': 'youtube',
        'URL 가져오기': 'url',
        '파일 업로드': 'file',
        '소재 없이 진행': 'none',
      };
      _dpagSourceMode = sourceModeMap[sourceChoice] || 'none';
      _setSummary();

      if (_dpagSourceMode === 'text') {
        _dpagSourceContent = await _askTextInput({
          title: '직접 입력 소재',
          caption: '상세페이지에 꼭 들어가야 할 설명, 효능, 특징, 후기, CTA 문구를 자유롭게 적어주세요.',
          badge: '직접 입력',
          placeholder: '예: 비타민C 23%, 저자극 테스트 완료, 끈적임 없이 흡수, 아침 저녁 사용...',
          rows: 8,
          preview: value => value.length > 60 ? `${value.slice(0, 60)}...` : value,
        });
        if (_dpagSourceContent) _addSourcePreview('직접 입력 내용', _dpagSourceContent, 'source');
      } else if (_dpagSourceMode === 'youtube') {
        const youtubeUrl = await _askTextInput({
          title: 'YouTube URL',
          caption: '영상 설명이나 후기 영상 URL을 넣으면 내용을 분석해 상세페이지 소재로 정리합니다.',
          badge: 'YouTube',
          placeholder: 'https://www.youtube.com/watch?v=...',
          multiline: false,
        });
        _dpagSourceContent = await dpagFetchYoutube(youtubeUrl);
        if (_dpagSourceContent) _addSourcePreview('YouTube 분석 내용', _dpagSourceContent, 'source');
      } else if (_dpagSourceMode === 'url') {
        const sourceUrls = await _askTextInput({
          title: 'URL 가져오기',
          caption: '뉴스, 네이버 블로그, 상품/강의/서비스 페이지 URL을 여러 줄로 넣으면 내부 브라우저로 순서대로 수집합니다.',
          badge: 'URL',
          placeholder: 'https://...\nhttps://...',
          rows: 4,
        });
        _dpagSourceContent = await dpagFetchUrls(sourceUrls);
        if (_dpagSourceContent) _addSourcePreview('URL 가져온 내용', _dpagSourceContent, 'source');
      } else if (_dpagSourceMode === 'file') {
        _addMsg('ai', '텍스트 파일이나 문서를 고르면 내용을 그대로 소재로 가져옵니다.');
        _dpagSourceContent = await dpagPickFile();
        if (_dpagSourceContent) _addSourcePreview('업로드 파일 내용', _dpagSourceContent, 'source');
      } else if (_dpagSourceMode === 'news' || _dpagSourceMode === 'naver') {
        const picked = await dpagToggleSource(_dpagSourceMode);
        _dpagSourceContent = picked || '';
        if (_dpagSourceContent) _addSourcePreview(`${_getSourceLabel(_dpagSourceMode)} 반영 내용`, _dpagSourceContent, 'source');
        if (!_dpagSourceContent) _addMsg('ai', `<span style="color:#ff9500;">${_getSourceLabel(_dpagSourceMode)} 내용을 가져오지 못했습니다. 계속 진행은 가능하지만 다시 선택하는 편이 안전합니다.</span>`);
      } else {
        _addMsg('ai', '좋습니다. 소재 없이 주제와 옵션만으로 바로 구성하겠습니다.');
      }

      await _askReferenceImages();

      _addMsg('ai', '어떤 업종/유형의 상세페이지인지 골라주세요.');
      const detailTypeLabel = await _askOptions([
        { label: 'AI 자동 판단', desc: '소재를 보고 상품/서비스/강의 등을 자동 분류' },
        { label: '상품/커머스', desc: '제품, 식품, 화장품, 생활용품, 패키지' },
        { label: '강의/교육', desc: '온라인 강의, 클래스, 코칭, 커리큘럼' },
        { label: '서비스/상담', desc: '컨설팅, 대행, SaaS, 전문 서비스' },
        { label: '병원/뷰티/헬스', desc: '시술, 프로그램, 케어, 클리닉' },
        { label: '매장/로컬', desc: '식당, 카페, 숙소, 공간, 오프라인 예약' },
        { label: '행사/모집', desc: '세미나, 웨비나, 채용, 체험단, 이벤트' },
        { label: 'B2B/제조/기술', desc: '솔루션, 장비, 부품, 제조, 기관용' },
      ]);

      _addMsg('ai', '이번 결과물을 어떤 용도로 맞출지 선택해주세요.');
      const platformLabel = await _askOptions([
        { label: '상세 소개형', desc: '섹션형 소개와 설명이 많은 기본형' },
        { label: '모바일 랜딩', desc: '짧고 강한 전환 흐름 중심' },
        { label: '프로모션 배너', desc: '한 장 또는 소수 장수의 메시지 집중형' },
        { label: '범용', desc: '어디에나 붙이기 쉬운 기본형' },
      ]);
      const platformMap = {
        '상세 소개형': 'detail',
        '모바일 랜딩': 'mobile_landing',
        '프로모션 배너': 'banner',
        '범용': 'general',
      };

      _addMsg('ai', '디자인 스타일을 골라주세요. 이번에는 선택 폭을 더 넓혔습니다.');
      const styleLabel = await _askOptions(DPAG_STYLE_OPTIONS.map(item => ({ label: item.label, desc: item.hint })));
      const styleValue = DPAG_STYLE_OPTIONS.find(item => item.label === styleLabel)?.value || '';

      _addMsg('ai', '몇 장 정도의 상세페이지로 구성할까요?');
      const countLabel = await _askOptions(['AI 자동', '4섹션', '6섹션', '8섹션', '10섹션', '12섹션']);
      const countMap = { 'AI 자동': 0, '4섹션': 4, '6섹션': 6, '8섹션': 8, '10섹션': 10, '12섹션': 12 };

      _addMsg('ai', '어떤 블록을 넣을지 체크해주세요.');
      const components = await _askMultiSelect('구성 요소 선택', ['표지', '문제 제기', '핵심 장점', '상세 스펙/구성', '커리큘럼/진행 방식', '서비스 프로세스', '사용 방법', '전후 비교', '후기/신뢰 요소', 'FAQ', 'CTA/구매/상담/신청 유도'], ['표지', '핵심 장점', '상세 스펙/구성']);

      _addMsg('ai', '텍스트 밀도는 어느 정도가 좋을까요?');
      const textLabel = await _askOptions([
        { label: '최소', desc: '비주얼 중심, 문구만 짧게' },
        { label: '보통', desc: '설명과 가독성의 균형' },
        { label: '상세', desc: '텍스트를 충분히 넣는 정보형' },
      ]);
      const textMap = { '최소': 'minimal', '보통': 'normal', '상세': 'detailed' };

      _addMsg('ai', `좋습니다. <b>${_esc(_dpagTitle)}</b> 상세페이지를 구성하겠습니다.<br><span style="font-size:11px;color:rgba(0,0,0,0.42);">소재 분석 -> 섹션 기획 -> 이미지 생성</span>`);
      _setGenerateButtonLoading(true);

      const profileId = parseInt(window._globalProfileId || 0, 10);
      const brandColor = window._globalProfileData?.brand_color || '';
      const businessType = window._globalProfileData?.business_type || '';

      _addMsg('ai', '소재를 바탕으로 섹션 구조를 나누고 있습니다...');
      const sectResp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detail_page_sections',
          title: _dpagTitle,
          source_content: _dpagSourceContent,
          style: styleValue,
          platform: platformMap[platformLabel] || 'smartstore',
          section_count: countMap[countLabel] || 0,
          text_amount: textMap[textLabel] || 'normal',
          components,
          detail_page_type: detailTypeLabel,
          reference_image_count: _dpagReferenceImages.length,
          brand_name: brandName,
          brand_color: brandColor,
          industry: businessType,
          profile_id: profileId,
        }),
      });
      const sectData = await sectResp.json();
      let sections = [];
      if (sectData.ok && Array.isArray(sectData.sections) && sectData.sections.length) {
        sections = sectData.sections;
      } else {
        const paragraphs = String(_dpagSourceContent || '').split(/\n\s*\n/).map(item => item.trim()).filter(item => item.length > 30);
        sections = [{ type: 'cover', title: _dpagTitle || '상세페이지', body: '' }, ...paragraphs.slice(0, 5).map((text, idx) => ({ type: 'section', title: `섹션 ${idx + 1}`, body: text.slice(0, 220) }))];
        if (sections.length === 1) sections.push({ type: 'section', title: '핵심 소개', body: _dpagSourceContent || _dpagTitle });
      }
      _dpagSections = sections;
      _addMsg('ai', `<b>${sections.length}개 섹션</b>으로 기획했습니다. 이미지 만들기 전에 지시문을 확인해주세요.`);
      _dpagPromptDrafts = await _reviewDetailPrompts(_buildDetailPromptDrafts(sections), '이미지 만들기 전 지시문 확인');
      _dpagLastRunContext = {
        topic: _dpagTitle || '상세페이지',
        styleValue: styleValue || 'modern',
        brandName,
        brandColor,
        profileId,
        detailTypeLabel,
        referenceImages: _dpagReferenceImages.slice(),
      };
      await _generateDetailImagesFromDrafts(_dpagPromptDrafts, _dpagLastRunContext);
    } catch (flowErr) {
      console.error('[DPAG] flow error:', flowErr);
      _addMsg('ai', `<span style="color:#ff3b30;">오류가 발생했습니다: ${_esc(flowErr.message)}<br>다시 시도해주세요.</span>`);
    } finally {
      _setGenerateButtonLoading(false);
    }
  }
  function dpagDownloadAll() {
    _dpagImages.forEach((img, i) => {
      if (!img) return;
      const a = document.createElement('a'); a.href = img; a.download = `detailpage_${String(i+1).padStart(2,'0')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
  }
  async function dpagOpenFolder() {
    if (_dpagSavedFolder) await fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: _dpagSavedFolder }) });
  }

  /* ?? ?덉뒪?좊━ ?? */
  async function dpagHistoryInit() {
    const root = document.getElementById('detailpage-agent-history-root');
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      const resp = await fetch('/api/ce2/history');
      const data = await resp.json();
      if (!data.ok || !data.items?.length) { root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 상세페이지가 없습니다</div>'; return; }
      const items = data.items.filter(it => it.industry === 'detailpage' || it.source === 'detailpage');
      if (!items.length) { root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 상세페이지가 없습니다</div>'; return; }
      root.innerHTML = items.map((item, hi) => `
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(item.topic || '상세페이지')}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(item.created || '')} · ${item.slides || 0}장</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="dpagHistoryOpen('${_esc(item.folder)}')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button>
              <button onclick="dpagHistoryDelete('${_esc(item.folder)}')" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
            ${(item.images || []).map(img => {
              const imgUrl = '/api/ce2/history/image?folder=' + encodeURIComponent(item.folder) + '&name=' + encodeURIComponent(img);
              return `<img src="${imgUrl}" style="height:80px;border-radius:8px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);cursor:pointer;flex-shrink:0;" onclick="window.open(this.src)">`;
            }).join('')}
          </div>
        </div>`).join('');
    } catch (e) { root.innerHTML = `<div style="color:#ff3b30;padding:20px;">${_esc(e.message)}</div>`; }
  }
  async function dpagHistoryOpen(folder) { await fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) }); }
  async function dpagHistoryDelete(folder) {
    if (!confirm('이 상세페이지를 삭제하시겠습니까?')) return;
    await fetch('/api/ce2/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
    dpagHistoryInit();
  }

  function dpagRestart() {
    _resetState();
    window._sharedSourceContent = '';
    dpagInit();
  }

  window.dpagInit = dpagInit;
  window.dpagGenerate = dpagGenerate;
  window.dpagRestart = dpagRestart;
  window.dpagToggleSource = dpagToggleSource;
  window.dpagFetchUrl = dpagFetchUrl;
  window.dpagFetchUrls = dpagFetchUrls;
  window.dpagFetchYoutube = dpagFetchYoutube;
  window.dpagPickFile = dpagPickFile;
  window.dpagDownloadAll = dpagDownloadAll;
  window.dpagOpenFolder = dpagOpenFolder;
  window.dpagEditPromptsAndRegenerate = dpagEditPromptsAndRegenerate;
  window.dpagHistoryInit = dpagHistoryInit;
  window.dpagHistoryOpen = dpagHistoryOpen;
  window.dpagHistoryDelete = dpagHistoryDelete;
})();
