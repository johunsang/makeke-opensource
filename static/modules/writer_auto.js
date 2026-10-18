// Writer Auto — 내 글 수집 / 스타일 분석 / 글 쓰기
// ============================================================

// ── 내 글 수집 ──
async function waCrawlPlatform(platform) {
  const config = {
    naver: { endpoint: '/api/articles/naver-blog', key: 'blog_id', btnId: 'wa-btn-naver' },
    tistory: { endpoint: '/api/articles/tistory', key: 'blog_id', btnId: 'wa-btn-tistory' },
    brunch: { endpoint: '/api/articles/brunch', key: 'user_id', btnId: 'wa-btn-brunch' },
    velog: { endpoint: '/api/articles/velog', key: 'username', btnId: 'wa-btn-velog' },
    threads: { endpoint: '/api/articles/threads', key: 'username', btnId: 'wa-btn-threads' },
  };
  const c = config[platform];
  if (!c) return;

  // 설정에서 ID 가져오기
  let settings;
  try { settings = await api('/api/settings'); } catch { toast('설정을 불러올 수 없습니다.', 'error'); return; }
  const idMap = { naver: settings.naver_blog_id, tistory: settings.tistory_blog_id, brunch: settings.brunch_user_id, velog: settings.velog_username, threads: settings.threads_username };
  const blogId = idMap[platform];
  if (!blogId) { toast('설정에서 블로그 ID를 먼저 입력해주세요.', 'error'); return; }

  const btn = document.getElementById(c.btnId);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const progress = document.getElementById('wa-crawl-progress');
  const bar = document.getElementById('wa-crawl-bar');
  const status = document.getElementById('wa-crawl-status');
  progress.style.display = 'block';

  try {
    const body = {};
    body[c.key] = blogId;
    const res = await fetch(c.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let successCount = 0, errorCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.substring(5).trim());
          if (data.status === 'done') continue;
          if (data.status === 'ok') successCount++;
          else errorCount++;
          const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
          bar.style.width = pct + '%';
          status.textContent = `${data.current}/${data.total} (성공: ${successCount}, 실패: ${errorCount})`;
        } catch {}
      }
    }
    toast(`수집 완료! 성공: ${successCount}, 실패: ${errorCount}`);
    waLoadArticles();
  } catch (e) {
    toast('수집 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = platform === 'naver' ? '네이버' : platform === 'tistory' ? '티스토리' : platform === 'brunch' ? '브런치' : platform === 'velog' ? '벨로그' : '스레드';
  }
}

function waToggleMode(mode) {
  document.getElementById('wa-manual-form').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('wa-url-form').style.display = mode === 'url' ? 'block' : 'none';
  document.getElementById('wa-mode-manual').style.background = mode === 'manual' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('wa-mode-manual').classList.toggle('active', mode === 'manual');
  document.getElementById('wa-mode-url').style.background = mode === 'url' ? 'rgba(255,255,255,0.1)' : 'transparent';
  document.getElementById('wa-mode-url').classList.toggle('active', mode === 'url');
}

async function waSubmitManual() {
  // 통합 페이지: wa-manual-text 또는 기존 wa-manual-title + wa-manual-content
  const textEl = document.getElementById('wa-manual-text');
  let title = '', content = '';
  if (textEl) {
    content = textEl.value.trim();
    if (!content) { toast('본문을 입력해주세요.', 'error'); return; }
    title = content.substring(0, 50).split('\n')[0];
  } else {
    title = document.getElementById('wa-manual-title')?.value?.trim() || '';
    content = document.getElementById('wa-manual-content')?.value?.trim() || '';
    if (!content) { toast('본문을 입력해주세요.', 'error'); return; }
  }
  try {
    await api('/api/articles/manual', { method: 'POST', body: { title: title || '직접 입력', content } });
    if (textEl) textEl.value = '';
    else {
      if (document.getElementById('wa-manual-title')) document.getElementById('wa-manual-title').value = '';
      if (document.getElementById('wa-manual-content')) document.getElementById('wa-manual-content').value = '';
    }
    toast('글이 추가되었습니다.');
    waLoadArticles();
  } catch (e) { toast('오류: ' + e.message, 'error'); }
}

async function waSubmitAndAnalyze() {
  const textEl = document.getElementById('wa-manual-text');
  const text = textEl?.value?.trim() || '';
  if (text.length < 50) { toast('최소 50자 이상 입력하세요', 'error'); return; }
  const name = await showInputModal('스타일 이름', '이 글의 문체로 만들 스타일 이름을 입력하세요', '내 스타일');
  if (!name) return;
  toast('글을 분석하여 스타일을 생성합니다...');
  try {
    await api('/api/writing-styles/analyze-create', { method: 'POST', body: { name, sample_text: text } });
    toast(`"${name}" 스타일이 저장되었습니다!`);
    textEl.value = '';
    loadStyleList();
    switchStyleTab('styles', document.querySelector('.style-tab'));
  } catch (e) { toast('스타일 생성 실패: ' + e.message, 'error'); }
}

async function waSubmitUrl() {
  const url = document.getElementById('wa-url-input').value.trim();
  if (!url) { toast('URL을 입력해주세요.', 'error'); return; }
  const btn = document.getElementById('wa-btn-url');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 수집 중...';
  try {
    await api('/api/articles/url', { method: 'POST', body: { url } });
    document.getElementById('wa-url-input').value = '';
    toast('URL에서 글을 수집했습니다.');
    waLoadArticles();
  } catch (e) { toast('오류: ' + e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '수집'; }
}

async function waLoadArticles() {
  const list = document.getElementById('wa-article-list');
  try {
    const articles = await api('/api/articles');
    const countEl = document.getElementById('wa-article-count');
    if (countEl) countEl.textContent = articles?.length ? `${articles.length}개` : '';
    if (!articles || articles.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">아직 수집된 글이 없습니다.</div>';
      return;
    }
    const badgeMap = { manual: ['수동','#0a84ff'], url: ['URL','#ff9f0a'], naver: ['네이버','#30d158'], tistory: ['티스토리','#ff9500'], brunch: ['브런치','#8e8e93'], velog: ['벨로그','#34c759'], threads: ['스레드','#fff'] };
    list.innerHTML = articles.map(a => {
      const [label, color] = badgeMap[a.source] || badgeMap.manual;
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(a.title)}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
            <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${color}18;color:${color};">${label}</span>
            <span style="font-size:12px;color:rgba(0,0,0,0.3);">${a.chunk_count}개 청크</span>
          </div>
        </div>
        <button class="btn btn-sm" style="color:#ff453a;background:none;font-size:12px;" onclick="waDeleteArticle('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>삭제</button>
      </div>`;
    }).join('');
  } catch { list.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">목록을 불러올 수 없습니다.</div>'; }
}

async function waDeleteArticle(id) {
  await api('/api/articles/' + id, { method: 'DELETE' });
  toast('삭제되었습니다.');
  waLoadArticles();
}

// ── 스타일 분석 ──
async function waAnalyzeStyle() {
  // 먼저 스타일 이름 물어보기
  const name = await showInputModal('스타일 이름 입력', '수집된 글을 분석하여 저장할 스타일 이름을 입력하세요', '내 글 스타일');
  if (!name) return;

  const btn = document.getElementById('wa-btn-analyze');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 분석 중...';
  try {
    const res = await api('/api/style/analyze', { method: 'POST' });
    waRenderStyle(res);

    // 분석 결과를 바로 writing_styles에 저장
    await api('/api/writing-styles', {
      method: 'POST',
      body: { name, style_data: res },
    });

    document.getElementById('wa-style-actions').style.display = 'block';
    toast(`"${name}" 스타일이 저장되었습니다!`);
    loadStyleList();

    // 완료 후 안내: 다른 스타일을 만들려면 글 비우기
    document.getElementById('wa-style-actions').innerHTML = `
      <p style="color:#34c759;font-size:14px;margin-bottom:10px;">"${escapeHtml(name)}" 스타일 저장 완료!</p>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-sm" onclick="switchStyleTab('styles',document.querySelector('.style-tab'))" style="background:#ff8c00;color:#fff;border:none;border-radius:8px;padding:8px 14px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>스타일 목록 보기</button>
        <button class="btn btn-sm" onclick="waClearArticlesForNew()" style="background:rgba(255,149,0,0.1);color:#ff9500;border:none;border-radius:8px;padding:8px 14px;">글 비우고 새 스타일 만들기</button>
      </div>`;
  } catch (e) {
    document.getElementById('wa-style-result').innerHTML = `<div class="card" style="text-align:center;color:#ff453a;">분석 실패: ${escapeHtml(e.message)}</div>`;
    toast('분석 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '수집된 글로 스타일 분석';
  }
}

// 글 전부 비우고 새 스타일 준비
async function waClearArticlesForNew() {
  try {
    const articles = await api('/api/articles');
    for (const a of articles) {
      await api('/api/articles/' + a.id, { method: 'DELETE' });
    }
    toast('수집된 글을 모두 비웠습니다. 새 스타일용 글을 추가하세요.');
    document.getElementById('wa-style-result').innerHTML = '';
    document.getElementById('wa-style-actions').style.display = 'none';
    waLoadArticles();
    document.getElementById('wa-manual-text')?.focus();
  } catch (e) { toast('비우기 실패: ' + e.message, 'error'); }
}

function waRenderStyle(s) {
  const items = [
    ['어조', s.tone],
    ['문장 스타일', s.sentence_style],
    ['자주 쓰는 표현', (s.expressions||[]).map(e => `<span style="display:inline-block;padding:3px 10px;background:rgba(0,0,0,0.04);border-radius:20px;font-size:13px;margin:2px;">${escapeHtml(e)}</span>`).join('')],
    ['수사법', (s.rhetoric||[]).map(r => `<span style="display:inline-block;padding:3px 10px;background:rgba(0,0,0,0.04);border-radius:20px;font-size:13px;margin:2px;">${escapeHtml(r)}</span>`).join('')],
    ['글 시작 패턴', s.opening_pattern],
    ['글 마무리 패턴', s.closing_pattern],
  ];
  document.getElementById('wa-style-result').innerHTML = `<div class="card"><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
    ${items.map(([label, val]) => `<div style="background:rgba(0,0,0,0.02);border-radius:14px;padding:16px;">
      <div style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">${label}</div>
      <div style="font-size:14px;color:#1c1c1e;">${typeof val === 'string' && !val.includes('<') ? escapeHtml(val) : val}</div>
    </div>`).join('')}
  </div></div>`;
}

async function waLoadCachedStyle() {
  try {
    const s = await api('/api/style');
    if (s && s.tone) {
      waRenderStyle(s);
      document.getElementById('wa-style-actions').style.display = 'block';
      // 글 쓰기 페이지에 스타일 뱃지 표시
      document.getElementById('wa-style-badge').innerHTML = `<div style="padding:8px 14px;background:rgba(48,209,88,0.1);border:1px solid rgba(48,209,88,0.2);border-radius:12px;font-size:13px;color:#30d158;">내 스타일 적용됨: ${escapeHtml(s.tone)} · ${escapeHtml(s.sentence_style)}</div>`;
    }
  } catch {}
}

// ── 글 쓰기 ──
let _waGeneratedText = '';

async function waGenerateArticle() {
  const topic = document.getElementById('wa-gen-topic').value.trim();
  if (!topic) { toast('주제를 입력해주세요.', 'error'); return; }
  const keywords = (document.getElementById('wa-gen-keywords')?.value || '').trim().split(',').map(k => k.trim()).filter(Boolean);
  const length = document.getElementById('wa-gen-length')?.value || 'medium';

  const btn = document.getElementById('wa-btn-gen') || document.getElementById('wa-btn-generate');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 생성 중...';
  const output = document.getElementById('wa-gen-result') || document.getElementById('wa-gen-output');
  output.innerHTML = '<div style="text-align:center;padding:20px;"><span class="spinner"></span><div style="margin-top:8px;color:rgba(0,0,0,0.4);font-size:13px;">내 스타일로 글을 쓰고 있습니다...</div></div>';
  _waGeneratedText = '';

  try {
    // 스타일 캐시에서 프롬프트에 반영
    const res = await api('/api/content/generate', {
      method: 'POST',
      body: {
        keyword: topic,
        scraped_texts: [topic],
        selected_sources: [],
        brand_name: window._globalProfileData?.name || '',
        brand_description: window._globalProfileData?.description || '',
        contact_info: window._globalProfileData?.contact_info || '',
        business_goal: window._globalProfileData?.business_goal || '',
        generate_blog: true,
        generate_cardnews: false,
        generate_video: false,
        generate_sns: false,
        tone: document.querySelector('input[name="wa-tone"]:checked')?.value || 'mystyle',
        blog_length: document.querySelector('input[name="wa-length"]:checked')?.value || 'medium',
        comma_rate: parseInt(document.querySelector('input[name="wa-comma"]:checked')?.value || '50'),
        period_rate: parseInt(document.querySelector('input[name="wa-period"]:checked')?.value || '70'),
        human_level: document.querySelector('input[name="wa-human"]:checked')?.value || 'light',
        text_provider: '',
        image_provider: '',
        image_model: '',
        user_image_urls: [],
      },
    });

    if (res.blog && !res.blog.error) {
      _waGeneratedText = res.blog.body || res.blog.content || '';
      output.innerHTML = `
        <div style="padding:16px;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;">
          <div style="font-size:16px;font-weight:700;color:#1c1c1e;margin-bottom:12px;">${escapeHtml(res.blog.title)}</div>
          <div style="font-size:14px;line-height:1.8;color:#1c1c1e;white-space:pre-wrap;">${escapeHtml(_waGeneratedText)}</div>
          <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.06);">
            <button class="btn btn-sm" onclick="navigator.clipboard.writeText(_waGeneratedText);toast('복사됨')" style="background:rgba(0,0,0,0.06);color:#1c1c1e;border:none;border-radius:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>복사</button>
            <span style="font-size:12px;color:rgba(0,0,0,0.3);padding:6px 0;">${_waGeneratedText.length}자</span>
          </div>
        </div>`;
      toast('샘플 글 생성 완료!');
    } else {
      output.innerHTML = `<div style="color:#ff3b30;padding:16px;">생성 실패: ${escapeHtml(res.blog?.error || '알 수 없는 오류')}</div>`;
    }
  } catch (e) {
    output.innerHTML = `<div style="color:#ff3b30;padding:16px;">생성 실패: ${escapeHtml(e.message)}</div>`;
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '샘플 글 생성';
  }
}

function waCopyOutput() {
  if (!_waGeneratedText) { toast('복사할 내용이 없습니다.', 'error'); return; }
  navigator.clipboard.writeText(_waGeneratedText);
  toast('클립보드에 복사되었습니다.');
}

function waDownloadOutput() {
  if (!_waGeneratedText) { toast('다운로드할 내용이 없습니다.', 'error'); return; }
  const blob = new Blob([_waGeneratedText], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'generated-article.md';
  a.click();
}

// ── 내 스타일 토글 ──
function kcToggleMyStyle(checked) {
  const label = document.getElementById('kc-tone-mystyle-label');
  if (checked) {
    label.style.borderColor = 'rgba(10,132,255,0.6)';
    label.style.background = 'rgba(10,132,255,0.15)';
    // 다른 톤 해제
    document.querySelectorAll('input[name="kc-tone"]').forEach(c => {
      if (c.value !== 'mystyle') c.checked = false;
    });
  } else {
    label.style.borderColor = 'rgba(10,132,255,0.4)';
    label.style.background = 'rgba(10,132,255,0.08)';
  }
}

// ── 스타일 상태 (프로필에서 관리, 여기서는 미표시) ──
async function kcCheckStyleStatus() {
  // 스타일은 프로필에서 관리됨 — 표시하지 않음
  const el = document.getElementById('kc-style-status');
  if (el) el.style.display = 'none';
}

// ── Suno 쿠키 저장 ──
// ═══ AI 모델 설정 ═══
const MODEL_PROVIDER_OPTIONS = {
  text: {
    cli: [
      ['codex-cli', 'Codex CLI'],
      ['claude-code', 'Claude Code'],
      ['gemini-cli', 'Gemini CLI'],
      ['kimi-cli', 'Kimi CLI'],
    ],
    gemini: [
      ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro'],
      ['gemini-3-flash-preview', 'Gemini 3 Flash'],
      ['gemini-3.1-flash-lite-preview', 'Gemini 3.1 Lite'],
      ['gemini-2.5-flash', 'Gemini 2.5 Flash'],
    ],
    atlas: [
      ['openai/gpt-5.5', 'GPT 5.5'],
      ['openai/gpt-5.3-codex', 'GPT 5.3 Codex'],
      ['anthropic/claude-opus-4.7', 'Claude Opus 4.7'],
      ['anthropic/claude-sonnet-4.6', 'Claude Sonnet 4.6'],
      ['deepseek-ai/deepseek-v4-pro', 'DeepSeek V4 Pro'],
      ['deepseek-ai/deepseek-v4-flash', 'DeepSeek V4 Flash'],
      ['moonshotai/kimi-k2.6', 'Kimi K2.6'],
      ['qwen/qwen3-max-2026-01-23', 'Qwen3 Max'],
    ],
  },
  image: {
    cli: [
      ['codex-cli', 'Codex CLI 직접 이미지 생성'],
    ],
    gemini: [
      ['gemini-3.1-flash-image-preview', 'Gemini 3.1 Flash Image'],
      ['gemini-3-pro-image-preview', 'Gemini 3 Pro Image'],
      ['gemini-2.5-flash-image', 'Gemini 2.5 Flash Image'],
      ['imagen-4.0-generate-001', 'Imagen 4'],
    ],
    atlas: [
      ['openai/gpt-image-2-developer/edit', 'GPT Image 2 Edit'],
      ['qwen/qwen-image-2.0-pro/edit', 'Qwen Image 2.0 Pro Edit'],
      ['alibaba/qwen-image/edit-plus-20251215', 'Qwen Image Edit Plus'],
    ],
  },
  tts: {
    gemini: [
      ['gemini-2.5-flash-preview-tts', 'Gemini Flash TTS'],
      ['gemini-2.5-pro-preview-tts', 'Gemini Pro TTS'],
    ],
  },
};

function normalizeModelProvider(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'cli';
  if (raw === 'cli' || raw === 'codex' || raw === 'kimi' || raw.startsWith('cli:') || raw.endsWith('-cli') || raw.includes('codex cli') || raw.includes('kimi cli')) return 'cli';
  if (raw === 'gemini' || raw === 'google' || raw === 'google-gemini' || raw.includes('gemini') || raw.includes('imagen')) return 'gemini';
  if (raw === 'atlas' || raw === 'atlascloud' || raw === 'atlas-cloud' || raw.includes('atlas') || raw.startsWith('openai/') || raw.startsWith('anthropic/') || raw.startsWith('deepseek') || raw.startsWith('moonshot') || raw.startsWith('qwen/') || raw.startsWith('alibaba/') || raw.startsWith('baidu/')) return 'atlas';
  return 'cli';
}

function setProviderSelectValue(select, value, fallback = 'cli') {
  if (!select) return fallback;
  const normalized = normalizeModelProvider(value || fallback);
  const hasOption = Array.from(select.options || []).some(option => option.value === normalized);
  select.value = hasOption ? normalized : fallback;
  return select.value || fallback;
}

function renderProviderModelOptions(kind, selectedValue = '') {
  const fallbackProvider = kind === 'tts' || kind === 'image' ? 'gemini' : 'cli';
  const provider = normalizeModelProvider(document.getElementById(`set-${kind}-provider`)?.value || fallbackProvider);
  const select = document.getElementById(`set-${kind}-model`);
  const options = MODEL_PROVIDER_OPTIONS[kind]?.[provider] || MODEL_PROVIDER_OPTIONS[kind]?.cli || [];
  if (!select || !options.length) return;
  const selected = options.some(([value]) => value === selectedValue) ? selectedValue : options[0][0];
  select.innerHTML = options.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  if (kind === 'text') renderTextCliQuickPick(provider, selected);
}

function renderTextCliQuickPick(provider = '', selectedValue = '') {
  const wrap = document.getElementById('set-text-cli-quickpick');
  const select = document.getElementById('set-text-model');
  if (!wrap || !select) return;
  const isCli = normalizeModelProvider(provider || document.getElementById('set-text-provider')?.value) === 'cli';
  if (!isCli) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  const selected = selectedValue || select.value || 'codex-cli';
  wrap.style.display = 'flex';
  wrap.innerHTML = MODEL_PROVIDER_OPTIONS.text.cli.map(([value, label]) => {
    const active = value === selected;
    const bg = active ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
    const color = active ? '#fff' : '#1c1c1e';
    const border = active ? 'rgba(255,140,0,0.55)' : 'rgba(0,0,0,0.1)';
    return `<button type="button" data-text-cli-model="${value}" style="padding:6px 9px;border-radius:8px;border:1px solid ${border};background:${bg};color:${color};font-size:11px;font-weight:800;cursor:pointer;line-height:1.1;box-shadow:${active ? '0 6px 14px rgba(255,140,0,0.18)' : 'none'};">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('[data-text-cli-model]').forEach(btn => {
    btn.addEventListener('click', () => {
      select.value = btn.dataset.textCliModel || 'codex-cli';
      renderTextCliQuickPick('cli', select.value);
    });
  });
}

function syncModelCategoryOptions(saved = {}) {
  renderProviderModelOptions('text', saved.text_model || document.getElementById('set-text-model')?.value || '');
  renderProviderModelOptions('image', saved.image_model || document.getElementById('set-image-model')?.value || '');
  renderProviderModelOptions('tts', saved.tts_model || document.getElementById('set-tts-model')?.value || '');
}
window.syncModelCategoryOptions = syncModelCategoryOptions;

function readValidatedModelSetting(kind, fallbackProvider = 'cli') {
  const providerEl = document.getElementById(`set-${kind}-provider`);
  const modelEl = document.getElementById(`set-${kind}-model`);
  const provider = setProviderSelectValue(providerEl, providerEl?.value || fallbackProvider, fallbackProvider);
  renderProviderModelOptions(kind, modelEl?.value || '');
  return {
    provider,
    model: document.getElementById(`set-${kind}-model`)?.value || '',
  };
}

function bindModelCategoryOptions() {
  const textProvider = document.getElementById('set-text-provider');
  const imageProvider = document.getElementById('set-image-provider');
  const ttsProvider = document.getElementById('set-tts-provider');
  if (textProvider && !textProvider.dataset.modelBound) {
    textProvider.dataset.modelBound = '1';
    textProvider.addEventListener('change', () => renderProviderModelOptions('text'));
  }
  const textModel = document.getElementById('set-text-model');
  if (textModel && !textModel.dataset.modelBound) {
    textModel.dataset.modelBound = '1';
    textModel.addEventListener('change', () => renderTextCliQuickPick('cli', textModel.value));
  }
  if (imageProvider && !imageProvider.dataset.modelBound) {
    imageProvider.dataset.modelBound = '1';
    imageProvider.addEventListener('change', () => renderProviderModelOptions('image'));
  }
  if (ttsProvider && !ttsProvider.dataset.modelBound) {
    ttsProvider.dataset.modelBound = '1';
    ttsProvider.addEventListener('change', () => renderProviderModelOptions('tts'));
  }
  syncModelCategoryOptions();
}
window.bindModelCategoryOptions = bindModelCategoryOptions;

function applyModelSettingsToForm(settings = {}) {
  const textProvider = document.getElementById('set-text-provider');
  const imageProvider = document.getElementById('set-image-provider');
  const ttsProvider = document.getElementById('set-tts-provider');
  setProviderSelectValue(textProvider, settings.text_provider || textProvider?.value || 'cli', 'cli');
  setProviderSelectValue(imageProvider, settings.image_provider || imageProvider?.value || 'gemini', 'gemini');
  setProviderSelectValue(ttsProvider, 'gemini', 'gemini');
  syncModelCategoryOptions(settings);
}

function modelSettingsMismatch(saved = {}, expected = {}) {
  const savedTextProvider = normalizeModelProvider(saved.text_provider);
  const savedImageProvider = normalizeModelProvider(saved.image_provider);
  return (
    savedTextProvider !== expected.text_provider ||
    (saved.text_model || '') !== expected.text_model ||
    savedImageProvider !== expected.image_provider ||
    (saved.image_model || '') !== expected.image_model ||
    (saved.tts_model || '') !== expected.tts_model
  );
}

async function saveModelSettings() {
  bindModelCategoryOptions();
  const text = readValidatedModelSetting('text', 'cli');
  const image = readValidatedModelSetting('image', 'gemini');
  const tts = readValidatedModelSetting('tts', 'gemini');
  const models = {
    text_provider: text.provider,
    text_model: text.model,
    image_provider: image.provider,
    image_model: image.model,
    tts_model: tts.model,
  };
  const status = document.getElementById('set-model-status');
  try {
    if (status) {
      status.textContent = '저장 중...';
      status.style.color = 'rgba(0,0,0,0.45)';
    }
    await Promise.all([
      api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'text_provider', value: models.text_provider } }),
      api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'text_model', value: models.text_model } }),
      api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'image_provider', value: models.image_provider } }),
      api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'image_model', value: models.image_model } }),
      api('/api/config/update', { method: 'POST', body: { section: 'MODELS', key: 'tts_model', value: models.tts_model } }),
    ]);
    // 전역 옵션에도 반영
    window._contentOpts.text_provider = models.text_provider;
    window._contentOpts.text_model = models.text_model;
    window._contentOpts.image_provider = models.image_provider;
    window._contentOpts.image_model = models.image_model;
    const config = await api('/api/config');
    const saved = config.MODELS || {};
    applyModelSettingsToForm(saved);
    if (modelSettingsMismatch(saved, models)) {
      throw new Error('저장값 확인 실패. 앱을 새로고침한 뒤 다시 저장해 주세요.');
    }
    if (status) {
      status.textContent = '저장 완료!';
      status.style.color = '#34c759';
    }
    toast('AI 모델 설정이 저장되었습니다');
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch (e) {
    console.error('[모델 설정] 저장 실패:', e);
    if (status) {
      status.textContent = '저장 실패';
      status.style.color = '#ff3b30';
    }
    toast('저장 실패: ' + e.message, 'error');
  }
}
window.saveModelSettings = saveModelSettings;

async function loadModelSettings() {
  try {
    const config = await api('/api/config');
    const m = config.MODELS || {};
    applyModelSettingsToForm(m);
    if (typeof refreshCliToolsStatus === 'function') refreshCliToolsStatus();
  } catch (e) {
    console.error('[모델 설정] 로드 실패:', e);
  }
}
window.loadModelSettings = loadModelSettings;

const CLI_TOOL_LABELS = {
  claude: { label: 'Claude', icon: '🟠', color: '#d97706' },
  codex: { label: 'Codex', icon: '🟦', color: '#007aff' },
  gemini: { label: 'Gemini CLI', icon: '🟢', color: '#34a853' },
  kimi: { label: 'Kimi', icon: '🌙', color: '#7d5cc7' },
};

function renderCliToolsStatus(tools = {}) {
  const badge = document.getElementById('set-cli-tools-badge');
  const meta = document.getElementById('set-cli-tools-meta');
  const list = document.getElementById('set-cli-tools-list');
  const hint = document.getElementById('set-cli-tools-hint');
  if (!badge || !meta || !list || !hint) return;

  const names = ['claude', 'codex', 'gemini', 'kimi'];
  const installedCount = names.filter(name => tools[name]?.installed).length;
  const loggedInCount = names.filter(name => tools[name]?.logged_in).length;
  const allReady = installedCount === names.length && loggedInCount === names.length;

  badge.textContent = allReady ? '전체 사용 가능' : `${loggedInCount}/${names.length} 로그인`;
  badge.style.background = allReady ? 'rgba(52,199,89,0.12)' : 'rgba(255,149,0,0.12)';
  badge.style.color = allReady ? '#34c759' : '#ff9500';
  meta.textContent = `설치 ${installedCount}/${names.length} · 로그인 ${loggedInCount}/${names.length}`;
  hint.textContent = allReady
    ? 'Claude, Codex, Gemini, Kimi 설치 및 로그인 상태가 확인되어 CLI 선택에서 바로 사용할 수 있습니다.'
    : '미설치 또는 미로그인 도구는 각 CLI를 설치하고 터미널에서 직접 로그인한 뒤 새로고침하세요. 이 화면에서는 로그인 절차를 실행하지 않습니다.';

  list.innerHTML = names.map(name => {
    const item = tools[name] || {};
    const meta = CLI_TOOL_LABELS[name];
    const installed = !!item.installed;
    const loggedIn = !!item.logged_in;
    const statusText = !installed ? '미설치' : (loggedIn ? '로그인됨' : '로그인 필요');
    const statusColor = !installed ? '#ff3b30' : (loggedIn ? '#34c759' : '#ff9500');
    const bg = !installed ? 'rgba(255,59,48,0.06)' : (loggedIn ? 'rgba(52,199,89,0.06)' : 'rgba(255,149,0,0.07)');
    return `
      <div style="padding:12px;border-radius:12px;border:1px solid rgba(0,0,0,0.07);background:#fff;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:800;color:${meta.color};">${meta.icon} ${meta.label}</div>
          <span style="padding:3px 8px;border-radius:999px;background:${bg};color:${statusColor};font-size:10px;font-weight:800;">${statusText}</span>
        </div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);line-height:1.5;word-break:break-all;">${installed ? `경로: ${escapeHtml(item.path || '-')}` : '경로: 없음'}</div>
        <div style="margin-top:9px;padding:7px 9px;border-radius:8px;background:rgba(0,0,0,0.03);font-size:10px;color:rgba(0,0,0,0.48);line-height:1.5;">
          ${installed ? '터미널에서 로그인 완료 후 새로고침하세요.' : '먼저 CLI를 설치하세요.'}
        </div>
      </div>
    `;
  }).join('');
}

async function refreshCliToolsStatus() {
  const badge = document.getElementById('set-cli-tools-badge');
  const meta = document.getElementById('set-cli-tools-meta');
  const list = document.getElementById('set-cli-tools-list');
  if (!badge || !meta || !list) return;

  badge.textContent = '확인 중...';
  badge.style.background = 'rgba(0,0,0,0.06)';
  badge.style.color = 'rgba(0,0,0,0.45)';
  meta.textContent = 'CLI 설치/로그인 상태를 조회하고 있습니다.';
  list.innerHTML = '<div style="padding:12px;border-radius:12px;background:rgba(0,0,0,0.03);font-size:11px;color:rgba(0,0,0,0.42);">Claude · Codex · Gemini · Kimi 상태 확인 중...</div>';

  try {
    const res = await api('/api/coding-agent/which');
    renderCliToolsStatus(res?.tools || {});
  } catch (e) {
    badge.textContent = '확인 실패';
    badge.style.background = 'rgba(255,59,48,0.1)';
    badge.style.color = '#ff3b30';
    meta.textContent = `상태 조회 실패: ${e.message || e}`;
    list.innerHTML = '<div style="padding:12px;border-radius:12px;background:rgba(255,59,48,0.06);font-size:11px;color:#ff3b30;">백엔드 상태 조회가 실패했습니다.</div>';
  }
}
window.refreshCliToolsStatus = refreshCliToolsStatus;
window.refreshCodexCliStatus = refreshCliToolsStatus;
window.openCliToolLogin = () => toast('설정 화면에서는 로그인하지 않습니다. 터미널에서 CLI 로그인을 먼저 완료하세요.', 'error');
window.openCodexCliLogin = window.openCliToolLogin;

async function loadBgmStorageSettings() {
  try {
    const config = await api('/api/config');
    const storage = config.STORAGE || {};
    const input = document.getElementById('set-bgm-external-dir');
    if (input) input.value = storage.bgm_external_dir || '';
  } catch {}
}

async function chooseBgmExternalDir() {
  try {
    if (!window.electronAPI?.chooseDirectory) {
      toast('현재 환경에서는 폴더 선택을 지원하지 않습니다.', 'error');
      return;
    }
    const selected = await window.electronAPI.chooseDirectory();
    if (selected) {
      const input = document.getElementById('set-bgm-external-dir');
      if (input) input.value = selected;
    }
  } catch (e) {
    toast('폴더 선택 실패: ' + e.message, 'error');
  }
}

async function saveBgmStorageSettings() {
  const value = document.getElementById('set-bgm-external-dir')?.value?.trim() || '';
  try {
    await api('/api/config/update', { method: 'POST', body: { section: 'STORAGE', key: 'bgm_external_dir', value } });
    const status = document.getElementById('set-bgm-storage-status');
    if (status) {
      status.textContent = value ? '외부 폴더 저장 완료' : '외부 폴더 해제 완료';
      status.style.color = '#34c759';
    }
    toast(value ? '외부 BGM 폴더가 저장되었습니다' : '외부 BGM 폴더가 해제되었습니다');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

function clearBgmExternalDir() {
  const input = document.getElementById('set-bgm-external-dir');
  if (input) input.value = '';
  saveBgmStorageSettings();
}

// 설정 페이지 진입 시 로드
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  bindModelCategoryOptions();
  loadModelSettings();
  loadBgmStorageSettings();
}, 2000));

async function saveSunoCookie() {
  const cookie = document.getElementById('set-suno-cookie').value.trim();
  try {
    await api('/api/config/update', { method: 'POST', body: { section: 'SUNO', key: 'cookie', value: cookie } });
    toast(cookie ? 'Suno 쿠키 저장 완료! 영상 생성 시 AI BGM이 적용됩니다.' : 'Suno 쿠키 해제 (로컬 BGM 사용)');
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function saveElevenlabsSettings() {
  try {
    const key = document.getElementById('set-elevenlabs-key').value.trim();
    const voice = document.getElementById('set-elevenlabs-voice').value.trim();
    if (key) await api('/api/config/update', { method: 'POST', body: { section: 'ELEVENLABS', key: 'api_key', value: key } });
    await api('/api/config/update', { method: 'POST', body: { section: 'ELEVENLABS', key: 'voice_id', value: voice } });
    toast('ElevenLabs 설정 저장 완료!');
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

// ── 설정 저장/로드 ──
async function waSettingsSave() {
  const data = {
    naver_blog_id: document.getElementById('wa-set-naver').value.trim(),
    tistory_blog_id: document.getElementById('wa-set-tistory').value.trim(),
    brunch_user_id: document.getElementById('wa-set-brunch').value.trim(),
    velog_username: document.getElementById('wa-set-velog').value.trim(),
    threads_username: document.getElementById('wa-set-threads').value.trim(),
  };
  try {
    await api('/api/settings', { method: 'PUT', body: data });
    toast('블로그 수집 설정이 저장되었습니다.');
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function waSettingsLoad() {
  try {
    const s = await api('/api/settings');
    if (s.naver_blog_id) document.getElementById('wa-set-naver').value = s.naver_blog_id;
    if (s.tistory_blog_id) document.getElementById('wa-set-tistory').value = s.tistory_blog_id;
    if (s.brunch_user_id) document.getElementById('wa-set-brunch').value = s.brunch_user_id;
    if (s.velog_username) document.getElementById('wa-set-velog').value = s.velog_username;
    if (s.threads_username) document.getElementById('wa-set-threads').value = s.threads_username;
  } catch {}
}
// 페이지 로드 시 설정 불러오기
waSettingsLoad();

// Writer Auto 페이지 진입 시 데이터 로드
const _waPageObserver = new MutationObserver(function() {
  const collectPage = document.getElementById('page-wa-collect');
  const stylePage = document.getElementById('page-wa-style');
  if (collectPage && collectPage.classList.contains('active')) waLoadArticles();
  if (stylePage && stylePage.classList.contains('active')) waLoadCachedStyle();
  const writePage = document.getElementById('page-wa-write');
  if (writePage && writePage.classList.contains('active')) waLoadCachedStyle();
});
document.querySelectorAll('.page').forEach(p => _waPageObserver.observe(p, { attributes: true, attributeFilter: ['class'] }));
