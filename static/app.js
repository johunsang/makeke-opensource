// ---- Dark Mode ----
function initTheme() {
    // 클라이언트 영구 저장 없이 항상 라이트 테마로 시작
    document.documentElement.removeAttribute('data-theme');
    updateThemeIcon(false);
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    updateThemeIcon(!isDark);
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = isDark ? '&#9788;' : '&#9790;';
}

document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
initTheme();

// ---- Toast Notifications ----
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Ripple Effect ----
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

// ---- Tab switching ----
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Input mode toggle
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('manual-form').style.display = btn.dataset.mode === 'manual' ? 'block' : 'none';
        document.getElementById('url-form').style.display = btn.dataset.mode === 'url' ? 'block' : 'none';
    });
});

// ---- Articles ----
async function submitManual() {
    const title = document.getElementById('manual-title').value.trim();
    const content = document.getElementById('manual-content').value.trim();
    if (!title || !content) return showToast('제목과 본문을 모두 입력해 주세요.', 'error');

    const btn = document.getElementById('btn-manual');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 저장 중...';

    try {
        const res = await fetch('/api/articles/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        document.getElementById('manual-title').value = '';
        document.getElementById('manual-content').value = '';
        showToast('글이 저장되었습니다.');
        loadArticles();
    } catch (e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '저장';
    }
}

async function submitUrl() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return showToast('URL을 입력해 주세요.', 'error');

    const btn = document.getElementById('btn-url');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 크롤링 중...';

    try {
        const res = await fetch('/api/articles/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        document.getElementById('url-input').value = '';
        showToast('URL에서 글을 수집했습니다.');
        loadArticles();
    } catch (e) {
        showToast('오류: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '수집';
    }
}

function getSourceBadge(source) {
    const map = {
        manual: { label: '수동', cls: 'badge-manual' },
        url: { label: 'URL', cls: 'badge-url' },
        naver: { label: '네이버', cls: 'badge-naver' },
        tistory: { label: '티스토리', cls: 'badge-tistory' },
        brunch: { label: '브런치', cls: 'badge-brunch' },
        velog: { label: '벨로그', cls: 'badge-velog' },
        threads: { label: '스레드', cls: 'badge-threads' },
    };
    const info = map[source] || map['manual'];
    return `<span class="badge ${info.cls}">${info.label}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadArticles() {
    const list = document.getElementById('article-list');
    try {
        const res = await fetch('/api/articles');
        const articles = await res.json();
        if (articles.length === 0) {
            list.innerHTML = '<div class="empty-state">아직 수집된 글이 없습니다.</div>';
            return;
        }
        list.innerHTML = articles.map(a => `
            <li class="article-item">
                <div class="article-info">
                    <h4>${escapeHtml(a.title)}</h4>
                    <div class="article-meta">
                        ${getSourceBadge(a.source || 'manual')}
                        <p>${formatDate(a.created_at) ? formatDate(a.created_at) + ' · ' : ''}${escapeHtml(a.preview)} · ${a.chunk_count}개 청크</p>
                    </div>
                </div>
                <button class="btn btn-danger" onclick="deleteArticle('${a.id}')">삭제</button>
            </li>
        `).join('');
    } catch {
        list.innerHTML = '<div class="empty-state">목록을 불러올 수 없습니다.</div>';
    }
}

async function deleteArticle(id) {
    if (!confirm('이 글을 삭제할까요?')) return;
    await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    showToast('글이 삭제되었습니다.');
    loadArticles();
}

// ---- Style ----
async function analyzeStyle() {
    const btn = document.getElementById('btn-analyze');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 분석 중...';
    const result = document.getElementById('style-result');

    try {
        const res = await fetch('/api/style/analyze', { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).detail);
        const data = await res.json();
        renderStyle(data);
        showToast('스타일 분석이 완료되었습니다.');
    } catch (e) {
        result.innerHTML = `<div class="empty-state">오류: ${escapeHtml(e.message)}</div>`;
        showToast('분석 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '내 스타일 분석하기';
    }
}

function renderStyle(s) {
    document.getElementById('style-result').innerHTML = `
        <div class="style-grid">
            <div class="style-item"><label>어조</label><p>${escapeHtml(s.tone)}</p></div>
            <div class="style-item"><label>문장 스타일</label><p>${escapeHtml(s.sentence_style)}</p></div>
            <div class="style-item"><label>자주 쓰는 표현</label>
                <ul>${(s.expressions||[]).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
            </div>
            <div class="style-item"><label>수사법</label>
                <ul>${(s.rhetoric||[]).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
            </div>
            <div class="style-item"><label>글 시작 패턴</label><p>${escapeHtml(s.opening_pattern)}</p></div>
            <div class="style-item"><label>글 마무리 패턴</label><p>${escapeHtml(s.closing_pattern)}</p></div>
        </div>`;
}

// ---- Generate ----
let generatedRawText = '';

async function generateArticle() {
    const topic = document.getElementById('gen-topic').value.trim();
    if (!topic) return showToast('주제를 입력해 주세요.', 'error');

    const keywords = document.getElementById('gen-keywords').value.trim()
        .split(',').map(k => k.trim()).filter(Boolean);
    const length = document.getElementById('gen-length').value;

    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 생성 중...';
    const output = document.getElementById('gen-output');
    output.textContent = '';
    generatedRawText = '';

    try {
        const res = await fetch('/api/generate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, keywords, length })
        });

        if (!res.ok) throw new Error((await res.json()).detail);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    generatedRawText += data;
                }
            }
            // Render markdown as it streams (sanitized)
            if (typeof marked !== 'undefined') {
                output.innerHTML = marked.parse(generatedRawText, { breaks: true });
                output.querySelectorAll('a').forEach(function(a) { a.setAttribute('rel', 'noopener noreferrer'); a.setAttribute('target', '_blank'); });
                output.querySelectorAll('script, iframe, object, embed').forEach(function(el) { el.remove(); });
            } else {
                output.textContent = generatedRawText;
            }
        }
        // Final render (sanitized)
        if (typeof marked !== 'undefined') {
            output.innerHTML = marked.parse(generatedRawText, { breaks: true });
            output.querySelectorAll('a').forEach(function(a) { a.setAttribute('rel', 'noopener noreferrer'); a.setAttribute('target', '_blank'); });
            output.querySelectorAll('script, iframe, object, embed').forEach(function(el) { el.remove(); });
        }
        showToast('글 생성이 완료되었습니다.');
    } catch (e) {
        output.textContent = '오류: ' + e.message;
        showToast('글 생성 중 오류가 발생했습니다.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '글 생성';
    }
}

function copyOutput() {
    const text = generatedRawText || document.getElementById('gen-output').textContent;
    if (!text.trim()) return showToast('복사할 내용이 없습니다.', 'error');
    navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다.');
}

function downloadOutput() {
    const text = generatedRawText || document.getElementById('gen-output').textContent;
    if (!text.trim()) return showToast('다운로드할 내용이 없습니다.', 'error');
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-article.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('파일이 다운로드되었습니다.');
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ---- Settings ----
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        document.getElementById('setting-naver-id').value = data.naver_blog_id || '';
        document.getElementById('setting-tistory-id').value = data.tistory_blog_id || '';
        document.getElementById('setting-brunch-id').value = data.brunch_user_id || '';
        document.getElementById('setting-velog-id').value = data.velog_username || '';
        document.getElementById('setting-threads-id').value = data.threads_username || '';
    } catch {}
}

async function saveSettings() {
    await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            naver_blog_id: document.getElementById('setting-naver-id').value.trim(),
            tistory_blog_id: document.getElementById('setting-tistory-id').value.trim(),
            brunch_user_id: document.getElementById('setting-brunch-id').value.trim(),
            velog_username: document.getElementById('setting-velog-id').value.trim(),
            threads_username: document.getElementById('setting-threads-id').value.trim(),
        })
    });
    showToast('설정이 저장되었습니다.');
}

async function resetAll() {
    if (!confirm('모든 수집된 글을 삭제합니다. 계속할까요?')) return;
    await fetch('/api/articles/reset', { method: 'DELETE' });
    showToast('모든 글이 초기화되었습니다.');
    loadArticles();
}

// ---- Platform Crawl ----
const PLATFORM_CONFIG = {
    naver: { api: '/api/articles/naver-blog', bodyKey: 'blog_id', settingId: 'setting-naver-id', label: '네이버' },
    tistory: { api: '/api/articles/tistory', bodyKey: 'blog_id', settingId: 'setting-tistory-id', label: '티스토리' },
    brunch: { api: '/api/articles/brunch', bodyKey: 'user_id', settingId: 'setting-brunch-id', label: '브런치' },
    velog: { api: '/api/articles/velog', bodyKey: 'username', settingId: 'setting-velog-id', label: '벨로그' },
    threads: { api: '/api/articles/threads', bodyKey: 'username', settingId: 'setting-threads-id', label: '스레드' },
};

async function crawlPlatform(platform) {
    const cfg = PLATFORM_CONFIG[platform];
    let userId = '';
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        const keyMap = { naver: 'naver_blog_id', tistory: 'tistory_blog_id', brunch: 'brunch_user_id', velog: 'velog_username', threads: 'threads_username' };
        userId = data[keyMap[platform]];
    } catch {}

    if (!userId) {
        showToast(`설정 탭에서 ${cfg.label} 아이디를 먼저 입력해 주세요.`, 'error');
        return;
    }

    const btn = document.getElementById(`btn-${platform}`);
    const origText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const progress = document.getElementById('crawl-progress');
    const bar = document.getElementById('crawl-bar');
    const status = document.getElementById('crawl-status');
    progress.style.display = 'block';
    bar.style.width = '0%';
    let successCount = 0, errorCount = 0;

    try {
        const res = await fetch(cfg.api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [cfg.bodyKey]: userId })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.status === 'done') break;
                        if (data.status === 'ok') successCount++;
                        else errorCount++;
                        const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
                        bar.style.width = pct + '%';
                        status.textContent = `[${cfg.label}] ${data.current}/${data.total} (성공: ${successCount}, 실패: ${errorCount}) - ${data.title || ''}`;
                    } catch {}
                }
            }
        }
        status.textContent = `[${cfg.label}] 완료! ${successCount}개 수집, ${errorCount}개 실패`;
        showToast(`${cfg.label} 수집 완료: ${successCount}개 성공`);
        loadArticles();
    } catch (e) {
        status.textContent = '오류: ' + e.message;
        showToast(`${cfg.label} 수집 중 오류가 발생했습니다.`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// Init
loadArticles();
loadSettings();
fetch('/api/style').then(r => r.ok ? r.json() : null).then(s => { if (s) renderStyle(s); });
