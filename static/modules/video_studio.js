(function () {
  'use strict';

  const state = {
    sourceType: 'youtube',
    format: 'shortform',
    youtubeItems: [],
    newsItems: [],
    selectedSource: null,
    selectedText: '',
  };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  };
  const formatCount = (value) => {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) return '-';
    return num.toLocaleString('ko-KR');
  };
  const ytThumb = (id) => id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';

  function sourceChip(type, label, desc) {
    const active = state.sourceType === type;
    return `<button type="button" onclick="vsSetSourceType('${type}')" style="flex:1;min-width:190px;padding:16px 18px;border-radius:18px;border:${active ? '1px solid rgba(255,140,0,0.32)' : '1px solid rgba(0,0,0,0.08)'};background:${active ? 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,107,0,0.08))' : '#fff'};text-align:left;cursor:pointer;">
      <div style="font-size:15px;font-weight:800;color:${active ? '#ff8c00' : '#1c1c1e'};">${label}</div>
      <div style="margin-top:6px;font-size:12px;line-height:1.6;color:rgba(0,0,0,0.48);">${desc}</div>
    </button>`;
  }

  function formatChip(type, label, desc) {
    const active = state.format === type;
    return `<button type="button" onclick="vsSetFormat('${type}')" style="flex:1;min-width:200px;padding:14px 16px;border-radius:16px;border:${active ? '1px solid rgba(0,122,255,0.22)' : '1px solid rgba(0,0,0,0.08)'};background:${active ? 'rgba(0,122,255,0.08)' : '#fff'};text-align:left;cursor:pointer;">
      <div style="font-size:14px;font-weight:800;color:${active ? '#007aff' : '#1c1c1e'};">${label}</div>
      <div style="margin-top:5px;font-size:12px;line-height:1.6;color:rgba(0,0,0,0.48);">${desc}</div>
    </button>`;
  }

  function currentPreset() {
    if (state.format === 'longform') {
      return { ratio: '16:9', scenes: '6', style: 'storytelling', subtitleStyle: 'news' };
    }
    return { ratio: '9:16', scenes: '4', style: 'reels', subtitleStyle: 'promo' };
  }

  function setStatus(message, tone) {
    const el = $('vs-status');
    if (!el) return;
    const style = tone === 'error'
      ? 'color:#ff3b30;background:rgba(255,59,48,.08);border-color:rgba(255,59,48,.16);'
      : tone === 'success'
        ? 'color:#34c759;background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.16);'
        : 'color:#ff8c00;background:rgba(255,140,0,.08);border-color:rgba(255,140,0,.16);';
    el.style.cssText = `display:block;padding:11px 13px;border:1px solid transparent;border-radius:12px;font-size:12px;font-weight:700;${style}`;
    el.textContent = message;
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || '요청에 실패했습니다.');
    return data;
  }

  function renderYouTubeResults() {
    if (!state.youtubeItems.length) {
      return '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,0.28);font-size:12px;">검색 결과가 아직 없습니다.</div>';
    }
    return state.youtubeItems.map((item, index) => {
      const selected = state.selectedSource?.kind === 'youtube' && state.selectedSource?.index === index;
      return `<div style="display:grid;grid-template-columns:152px 1fr;gap:14px;padding:14px;border:1px solid ${selected ? 'rgba(255,140,0,0.22)' : 'rgba(0,0,0,0.06)'};border-radius:16px;background:${selected ? 'rgba(255,140,0,0.04)' : '#fff'};">
        <div style="width:152px;height:86px;border-radius:12px;overflow:hidden;background:rgba(0,0,0,0.04);">
          <img src="${esc(item.thumbnail || ytThumb(item.video_id))}" alt="" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="min-width:0;">
          <div style="font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(item.title || '제목 없음')}</div>
          <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,0.45);">${esc([item.channel, item.duration].filter(Boolean).join(' · '))}</div>
          <div style="margin-top:4px;font-size:12px;color:rgba(0,0,0,0.4);">조회수 ${formatCount(item.view_count)} · 좋아요 ${formatCount(item.like_count)} · 구독자 ${formatCount(item.subscriber_count)}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <a href="${esc(item.url || '#')}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.08);color:#ff8c00;font-size:12px;font-weight:700;text-decoration:none;">열기</a>
            <button type="button" onclick="vsAnalyzeYoutube(${index})" style="padding:8px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">분석해서 넣기</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function renderNewsResults() {
    if (!state.newsItems.length) {
      return '<div style="padding:18px 12px;text-align:center;color:rgba(0,0,0,0.28);font-size:12px;">검색 결과가 아직 없습니다.</div>';
    }
    return state.newsItems.map((item, index) => {
      const selected = state.selectedSource?.kind === 'news' && state.selectedSource?.index === index;
      return `<div style="padding:14px;border:1px solid ${selected ? 'rgba(255,140,0,0.22)' : 'rgba(0,0,0,0.06)'};border-radius:16px;background:${selected ? 'rgba(255,140,0,0.04)' : '#fff'};">
        <div style="font-size:14px;font-weight:800;color:#1c1c1e;line-height:1.5;">${esc(item.title || '제목 없음')}</div>
        <div style="margin-top:6px;font-size:12px;color:rgba(0,0,0,0.42);">${esc([item.source, item.date].filter(Boolean).join(' · '))}</div>
        <div style="margin-top:8px;font-size:12px;line-height:1.7;color:rgba(0,0,0,0.52);">${esc(item.description || '')}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <a href="${esc(item.link || '#')}" target="_blank" rel="noopener" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,140,0,0.08);color:#ff8c00;font-size:12px;font-weight:700;text-decoration:none;">기사 열기</a>
          <button type="button" onclick="vsFetchNews(${index})" style="padding:8px 12px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:800;cursor:pointer;">본문 넣기</button>
        </div>
      </div>`;
    }).join('');
  }

  function buildDraft() {
    const topic = ($('vs-topic')?.value || '').trim();
    const selectedUrl = ($('vs-url')?.value || '').trim() || String(state.selectedSource?.url || '').trim();
    const summary = ($('vs-summary')?.value || '').trim() || state.selectedText.trim();
    const note = ($('vs-note')?.value || '').trim();
    const preset = currentPreset();
    const message = [
      note,
      summary ? `[핵심 자료]\n${summary}` : '',
      state.sourceType === 'youtube' && selectedUrl ? `이 영상의 핵심 내용과 흐름을 바탕으로 구성해 주세요.\nURL: ${selectedUrl}` : '',
      state.sourceType === 'news' && selectedUrl ? `이 기사 내용을 바탕으로 정보형 구성으로 정리해 주세요.\nURL: ${selectedUrl}` : '',
      '자막과 음성은 기본 포함으로 두고, 장면별 메시지가 또렷하게 보이게 구성해 주세요.',
    ].filter(Boolean).join('\n\n');
    return {
      topic: topic || String(state.selectedSource?.title || '').trim(),
      sourceUrl: selectedUrl,
      message,
      ratio: preset.ratio,
      scenes: preset.scenes,
      style: preset.style,
      subtitleStyle: preset.subtitleStyle,
      model: 'veo-3.1-lite-generate-preview',
      voice: 'gemini-Kore',
      generateAudio: true,
      addTts: true,
      addBgm: true,
      enhancePrompt: true,
    };
  }

  function render() {
    const root = $('video-studio-root');
    if (!root) return;
    const preset = currentPreset();
    root.innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(360px,520px) minmax(420px,1fr);gap:18px;align-items:start;">
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div style="display:flex;flex-direction:column;gap:16px;">
              <div>
                <div style="font-size:18px;font-weight:800;color:#1c1c1e;">1. 소스와 포맷 선택</div>
                <div style="margin-top:6px;font-size:13px;line-height:1.7;color:rgba(0,0,0,0.45);">여기서는 소스를 정리하고 기존 광고영상 편집기로 넘깁니다. 실제 자막, 음성, 장면 문구 편집은 기존 편집기에서 이어집니다.</div>
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${sourceChip('youtube', 'YouTube 기반', '영상 검색이나 URL로 소스를 고른 뒤 자막과 요약을 가져옵니다.')}
                ${sourceChip('news', '뉴스 기반', '뉴스 검색 후 본문을 가져와 정보형 숏폼 또는 롱폼 초안으로 넘깁니다.')}
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${formatChip('shortform', '숏폼', '9:16, 4장면, 빠른 리듬, 프로모 자막 기본값')}
                ${formatChip('longform', '롱폼', '16:9, 6장면, 설명형 흐름, 정보형 자막 기본값')}
              </div>
              <div style="padding:14px 16px;border-radius:14px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.14);font-size:12px;line-height:1.8;color:rgba(0,0,0,0.58);">
                기본 설정: <b>Veo 3.1 Lite</b>, 자막 포함, TTS 음성 포함, BGM 포함
                <div style="margin-top:4px;">현재 포맷 기본값: ${preset.ratio} · ${preset.scenes}장면 · ${preset.style}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div style="font-size:18px;font-weight:800;color:#1c1c1e;">2. 소스 가져오기</div>
              <div class="form-group" style="margin:0;">
                <label for="vs-topic">영상 주제</label>
                <input id="vs-topic" type="text" placeholder="예: 마케팅 자동화가 왜 필요한가, 2026 AI 뉴스 요약" value="${esc($('vs-topic')?.value || state.selectedSource?.title || '')}">
              </div>
              ${state.sourceType === 'youtube' ? `
                <div style="display:flex;gap:8px;align-items:flex-start;">
                  <textarea id="vs-query" rows="2" placeholder="유튜브 검색어를 입력하세요" style="resize:vertical;min-height:44px;">${esc($('vs-query')?.value || '')}</textarea>
                  <button type="button" onclick="vsSearchYoutube()" style="white-space:nowrap;">검색</button>
                </div>
                <div class="form-group" style="margin:0;">
                  <label for="vs-url">YouTube URL 직접 입력</label>
                  <textarea id="vs-url" rows="2" placeholder="https://www.youtube.com/watch?v=..." style="resize:vertical;min-height:44px;">${esc($('vs-url')?.value || state.selectedSource?.url || '')}</textarea>
                </div>
                <div id="vs-source-results" style="display:flex;flex-direction:column;gap:10px;">${renderYouTubeResults()}</div>
              ` : `
                <div style="display:flex;gap:8px;align-items:flex-start;">
                  <textarea id="vs-query" rows="2" placeholder="뉴스 검색어를 입력하세요" style="resize:vertical;min-height:44px;">${esc($('vs-query')?.value || '')}</textarea>
                  <button type="button" onclick="vsSearchNews()" style="white-space:nowrap;">검색</button>
                </div>
                <div class="form-group" style="margin:0;">
                  <label for="vs-url">기사 URL 직접 입력</label>
                  <textarea id="vs-url" rows="2" placeholder="https://..." style="resize:vertical;min-height:44px;">${esc($('vs-url')?.value || state.selectedSource?.url || '')}</textarea>
                </div>
                <div id="vs-source-results" style="display:flex;flex-direction:column;gap:10px;">${renderNewsResults()}</div>
              `}
              <div id="vs-status" style="display:none;"></div>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div style="display:flex;flex-direction:column;gap:14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                <div>
                  <div style="font-size:18px;font-weight:800;color:#1c1c1e;">3. 편집기 초안</div>
                  <div style="margin-top:6px;font-size:13px;line-height:1.7;color:rgba(0,0,0,0.45);">아래 내용이 기존 광고영상 편집기의 주제, 참고 URL, 메시지 칸에 채워집니다.</div>
                </div>
                <button type="button" onclick="vsOpenEditor()" style="padding:12px 16px;border:none;border-radius:14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">편집기로 열기</button>
              </div>
              <div class="form-group" style="margin:0;">
                <label for="vs-summary">소스 요약 / 본문</label>
                <textarea id="vs-summary" rows="16" placeholder="유튜브 자막 요약이나 뉴스 본문이 여기에 들어옵니다." style="resize:vertical;">${esc(state.selectedText)}</textarea>
              </div>
              <div class="form-group" style="margin:0;">
                <label for="vs-note">추가 지시</label>
                <textarea id="vs-note" rows="5" placeholder="예: 첫 장면은 강한 훅으로 시작, 후반부에 CTA는 약하게, 숫자는 크게 강조" style="resize:vertical;">${esc($('vs-note')?.value || '')}</textarea>
              </div>
            </div>
          </div>
          <div class="card" style="padding:18px 20px;">
            <div style="font-size:15px;font-weight:800;color:#1c1c1e;">작업 흐름</div>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;font-size:12px;line-height:1.8;color:rgba(0,0,0,0.52);">
              <div>1. 유튜브나 뉴스를 고릅니다.</div>
              <div>2. 분석해서 넣기로 본문을 가져옵니다.</div>
              <div>3. 편집기로 열기를 누르면 기존 광고영상 편집기로 이동합니다.</div>
              <div>4. 장면별 자막, 음성, 문구, 비주얼 프롬프트를 직접 수정한 뒤 생성합니다.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function searchYoutube() {
    const query = ($('vs-query')?.value || $('vs-topic')?.value || '').trim();
    if (!query) {
      setStatus('유튜브 검색어를 입력해 주세요.', 'error');
      return;
    }
    setStatus('유튜브 검색 중입니다...', 'info');
    try {
      const data = await postJson('/api/utils/youtube-search', { query, count: 24 });
      state.youtubeItems = Array.isArray(data.items) ? data.items : [];
      state.selectedSource = null;
      state.selectedText = '';
      render();
      setStatus(`${state.youtubeItems.length}개의 영상을 찾았습니다.`, 'success');
    } catch (err) {
      setStatus(err.message || '유튜브 검색에 실패했습니다.', 'error');
    }
  }

  async function analyzeYoutube(index) {
    const item = state.youtubeItems[index];
    const directUrl = ($('vs-url')?.value || '').trim();
    const url = String(item?.url || directUrl || '').trim();
    if (!url) {
      setStatus('YouTube URL이 없습니다.', 'error');
      return;
    }
    setStatus('유튜브 자막과 내용을 가져오는 중입니다...', 'info');
    try {
      const data = await postJson('/api/content/youtube-transcript', { url });
      const payload = data.data || {};
      state.selectedSource = { kind: 'youtube', index, url, title: item?.title || payload.title || '' };
      state.selectedText = String(payload.text || payload.summary || '').trim();
      render();
      setStatus('유튜브 내용을 초안에 넣었습니다.', 'success');
    } catch (err) {
      setStatus(err.message || '유튜브 분석에 실패했습니다.', 'error');
    }
  }

  async function searchNews() {
    const query = ($('vs-query')?.value || $('vs-topic')?.value || '').trim();
    if (!query) {
      setStatus('뉴스 검색어를 입력해 주세요.', 'error');
      return;
    }
    setStatus('뉴스를 검색 중입니다...', 'info');
    try {
      const data = await postJson('/api/ce2/news-search', { query });
      state.newsItems = Array.isArray(data.items) ? data.items : [];
      state.selectedSource = null;
      state.selectedText = '';
      render();
      setStatus(`${state.newsItems.length}개의 기사를 찾았습니다.`, 'success');
    } catch (err) {
      setStatus(err.message || '뉴스 검색에 실패했습니다.', 'error');
    }
  }

  async function fetchNews(index) {
    const item = state.newsItems[index];
    const url = String(item?.link || $('vs-url')?.value || '').trim();
    if (!url && !item?.title) {
      setStatus('기사 URL이 없습니다.', 'error');
      return;
    }
    setStatus('기사 본문을 가져오는 중입니다...', 'info');
    try {
      const data = await postJson('/api/ce2/news-fetch', { url, title: item?.title || '', source: item?.source || '' });
      if (!data.ok || !data.text) throw new Error(data.error || '기사 본문을 가져오지 못했습니다.');
      state.selectedSource = { kind: 'news', index, url: data.url || url, title: item?.title || '' };
      state.selectedText = String(data.text || '').trim();
      render();
      setStatus('기사 본문을 초안에 넣었습니다.', 'success');
    } catch (err) {
      setStatus(err.message || '기사 본문 가져오기에 실패했습니다.', 'error');
    }
  }

  function openEditor() {
    const draft = buildDraft();
    if (!draft.topic && !draft.message) {
      setStatus('주제나 소스를 먼저 준비해 주세요.', 'error');
      return;
    }
    window._videoStudioDraft = draft;
    if (typeof navigateToPage === 'function') navigateToPage('single-advideo');
  }

  window.vsInit = function () {
    render();
  };
  window.vsSetSourceType = function (type) {
    state.sourceType = type === 'news' ? 'news' : 'youtube';
    state.selectedSource = null;
    state.selectedText = '';
    render();
  };
  window.vsSetFormat = function (type) {
    state.format = type === 'longform' ? 'longform' : 'shortform';
    render();
  };
  window.vsSearchYoutube = searchYoutube;
  window.vsAnalyzeYoutube = analyzeYoutube;
  window.vsSearchNews = searchNews;
  window.vsFetchNews = fetchNews;
  window.vsOpenEditor = openEditor;
})();
