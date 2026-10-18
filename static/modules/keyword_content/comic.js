// keyword_content/comic.js — 스토리 만화 생성/재생성

function kcResolveNaturalComicPanelCount(reference) {
  const configured = String(window._contentOpts?.comic_panels || '').trim();
  const parsed = parseInt(configured, 10);
  if (parsed >= 5 && parsed <= 10) return parsed;
  const length = String(reference || '').length;
  if (length > 2400) return 8;
  if (length > 1300) return 7;
  if (length > 650) return 6;
  return 5;
}

async function kcGenerateComic() {
  const keyword = kcCleanTopicTitle(document.getElementById('kc-keyword')?.value?.trim() || '');
  // 블로그 본문이 있으면 우선 사용, 없으면 핵심요약
  const blogBodyEl = document.getElementById('kc-blog-body');
  const blogBody = (blogBodyEl?.value || '').trim() || (blogBodyEl?.textContent || '').trim();
  const sourceSummary = String(_kcPromptOverrides?.comic_workbench?.reference_context || _kcLastPromptSourceSummary || '').trim();
  console.log(`[KC] 만화 입력 확인: blogBody=${blogBody.length}자, sourceSummary=${sourceSummary.length}자`);
  const topic = keyword || sourceSummary.split('\n').find(Boolean)?.replace(/^\[(.+?)\]$/, '').trim() || '';
  if (!topic) { toast('핵심 요약본이나 키워드가 필요합니다', 'error'); return; }

  const style = window._contentOpts?.comic_style || 'cute';
  const btn = document.getElementById('kc-comic-gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 만화 생성 중... (시간이 걸릴 수 있음)';

  try {
    const payload = kcBuildGeneratePayload();
    // 블로그 본문이 있으면 무조건 블로그 본문 우선 사용 (요약본 폴백 방지)
    const reference = blogBody ? blogBody.slice(0, 3000) : (sourceSummary || kcPromptSourceDigest(payload, null, 8000));
    const panelCount = kcResolveNaturalComicPanelCount(reference);
    console.log(`[KC] 만화 reference 소스: ${blogBody ? '블로그본문' : sourceSummary ? '핵심요약' : '소스다이제스트'} (${reference.length}자)`);
    // 블로그 본문이 있으면 이전 패널 무시 — reference(블로그 본문)로 새로 생성
    const panelsOverride = blogBody ? [] : (
      Array.isArray(_kcPromptOverrides?.comic_panels) && _kcPromptOverrides.comic_panels.length
        ? _kcPromptOverrides.comic_panels : []
    );
    if (blogBody) console.log('[KC] 만화: 블로그 본문 기반 → 이전 패널 무시, 새로 생성');
    const brandName = document.getElementById('kc-brand-name')?.value?.trim() || '';
    // script_prompt_override를 비워서 reference가 직접 사용되도록 함
    const logoEnabled = !!getOpt('logo_insert');
    const scriptRes = await api('/api/comic/script', {
      method: 'POST',
      body: {
        topic,
        style,
        reference,
        panel_count: panelCount,
        panels_override: panelsOverride,
        profile_id: parseInt(window._globalProfileId || 0),
        user_image_urls: _kcSelectedSources.flatMap(s => (s.scrapedImages || []).slice(0, 2)).filter(Boolean),
      },
    });
    const panels = Array.isArray(scriptRes.panels) ? scriptRes.panels : [];
    const projectDir = scriptRes.project_dir || '';
    if (!projectDir || !panels.length) throw new Error('만화 스크립트를 만들지 못했습니다.');

    _kcComicPanels = panels.map(p => ({ ...p, status: 'pending', image_path: '' }));
    _kcComicDir = projectDir;
    _kcComicId = null;
    _kcComicTopic = topic;
    _kcComicStyle = style;

    const resultDiv = document.getElementById('kc-comic-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '';
    kcRenderComicProgressShell(panels);
    kcRevealGeneratedContent('comic');

    for (let i = 0; i < panels.length; i++) {
      kcSetComicProgressItem(i, 'loading', panels[i]);
      try {
        const panelRes = await api('/api/comic/generate-panel', {
          method: 'POST',
          body: {
            panel: panels[i],
            topic,
            style,
            project_dir: projectDir,
            profile_id: parseInt(window._globalProfileId || 0),
            logo_enabled: logoEnabled && i === panels.length - 1,
            user_image_urls: _kcSelectedSources.flatMap(s => (s.scrapedImages || []).slice(0, 2)).filter(Boolean),
          },
        });
        const imgUrl = panelRes.image_url
          ? `/api/comic/image/${panelRes.image_url}?t=${Date.now()}`
          : '';
        _kcComicPanels[i] = {
          ...panels[i],
          image_path: panelRes.image_path || '',
          status: 'ok',
        };
        kcSetComicProgressItem(i, 'done', _kcComicPanels[i], imgUrl);
      } catch (panelError) {
        _kcComicPanels[i] = { ...panels[i], status: 'error: ' + (panelError?.message || '생성 실패') };
        kcSetComicProgressItem(i, 'error', _kcComicPanels[i], '', panelError?.message || '생성 실패');
      }
    }

    const res = await api('/api/comic/recompose', {
      method: 'POST',
      body: {
        project_dir: projectDir,
        topic,
        style,
        panels: _kcComicPanels,
      },
    });

    if (res.composed_image) {
      _kcComicId = res.comic_id || null;
      if (_kcProjectId && _kcComicId) {
        await api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { comic_id: _kcComicId } });
      }
      const composedUrl = `/api/comic/image/${res.composed_image.split('/comics/').pop()}`;
      const resultDiv = document.getElementById('kc-comic-result');
      resultDiv.innerHTML = '';

      // 통합 이미지 1장 크게 표시
      const comicMainDiv = document.createElement('div');
      comicMainDiv.style.cssText = 'text-align:center;margin-bottom:12px;';
      comicMainDiv.innerHTML = `<img id="kc-comic-image" src="${composedUrl}?t=${Date.now()}" style="max-width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);" alt="스토리 만화">`;
      resultDiv.appendChild(comicMainDiv);

      // 합성 이미지 (접을 수 있게)
      const comicExtraDiv = document.createElement('div');
      comicExtraDiv.style.cssText = 'text-align:center;margin-top:8px;';
      comicExtraDiv.innerHTML = `
        <details style="cursor:pointer;">
          <summary style="font-size:12px;color:rgba(0,0,0,0.4);font-weight:600;padding:8px;">합성 이미지 보기</summary>
          <img id="kc-comic-image" src="${composedUrl}?t=${Date.now()}" style="max-width:100%;border-radius:10px;border:1px solid rgba(0,0,0,0.06);cursor:pointer;margin-top:8px;" onclick="kcShowImagePreview(this.src)">
        </details>
        <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;">
          <a id="kc-comic-download" href="${composedUrl}" download="comic.png" style="padding:6px 14px;background:rgba(0,0,0,0.06);color:#1c1c1e;border-radius:8px;font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>다운로드</a>
        </div>`;
      resultDiv.appendChild(comicExtraDiv);

      toast('스토리 만화 생성 완료!');
      return true;
    } else {
      toast('만화 생성 실패', 'error');
      return false;
    }
  } catch (e) {
    toast('만화 생성 실패: ' + e.message, 'error');
    throw e;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '스토리 만화 생성하기';
  }
}

function kcRenderComicProgressShell(panels) {
  const resultDiv = document.getElementById('kc-comic-result');
  if (!resultDiv) return;
  resultDiv.innerHTML = `
    <div style="margin-bottom:12px;padding:12px 14px;border-radius:14px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.14);">
      <div style="font-size:13px;font-weight:800;color:#ff8c00;">스토리 만화 생성 진행 중</div>
      <div style="font-size:11px;color:rgba(0,0,0,0.46);margin-top:4px;">컷이 완성되는 즉시 아래에 바로 표시됩니다.</div>
    </div>
    <div id="kc-comic-progress-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;"></div>
  `;
  const grid = document.getElementById('kc-comic-progress-grid');
  if (!grid) return;
  grid.innerHTML = (panels || []).map((panel, idx) => `
    <div id="kc-comic-progress-${idx}" style="border:1px solid rgba(0,0,0,0.08);border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 8px 18px rgba(15,23,42,0.05);">
      <div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,107,0,0.04));color:rgba(0,0,0,0.36);font-size:12px;font-weight:800;">대기</div>
      <div style="padding:10px;">
        <div style="font-size:11px;font-weight:800;color:#1c1c1e;">${idx + 1}컷</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);line-height:1.5;margin-top:4px;">${escapeHtml(panel?.situation || '')}</div>
        <div class="kc-comic-progress-meta" style="font-size:10px;color:#ff8c00;margin-top:6px;">생성 대기</div>
      </div>
    </div>
  `).join('');
}

function kcSetComicProgressItem(index, status, panel, imageUrl = '', message = '') {
  const card = document.getElementById(`kc-comic-progress-${index}`);
  if (!card) return;
  const meta = card.querySelector('.kc-comic-progress-meta');
  if (status === 'loading') {
    card.querySelector('div').innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span>생성 중';
    if (meta) meta.textContent = '이미지 생성 중...';
    return;
  }
  if (status === 'done') {
    card.innerHTML = `
      <div style="position:relative;cursor:pointer;" onclick="kcShowImagePreview('${encImg(imageUrl)}')">
        <img src="${encImg(imageUrl)}" style="width:100%;display:block;aspect-ratio:1/1;object-fit:cover;">
        <div style="position:absolute;top:8px;left:8px;padding:4px 8px;border-radius:999px;background:rgba(52,199,89,0.92);color:#fff;font-size:10px;font-weight:800;">완료</div>
      </div>
      <div style="padding:10px;">
        <div style="font-size:11px;font-weight:800;color:#1c1c1e;">${index + 1}컷</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.42);line-height:1.5;margin-top:4px;">${escapeHtml(panel?.situation || '')}</div>
      </div>
    `;
    return;
  }
  card.querySelector('div').innerHTML = '<span style="color:#ff3b30;font-size:16px;margin-right:8px;">!</span>실패';
  if (meta) {
    meta.textContent = message || '생성 실패';
    meta.style.color = '#ff3b30';
  }
}

function kcRenderComicPanelCard(idx, imgUrl, panel) {
  const label = `${idx + 1}컷`;
  const situation = panel.situation || '';
  if (!imgUrl || panel.status !== 'ok') {
    return `<div id="kc-comic-panel-${idx}" style="position:relative;border-radius:10px;overflow:hidden;border:1px dashed rgba(255,59,48,0.3);background:rgba(0,0,0,0.03);min-height:140px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:16px;">
      <div style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;">${label}</div>
      <div style="color:#ff3b30;font-size:11px;margin-bottom:6px;">생성 실패</div>
      <button onclick="kcRegenComicPanel(${idx})" style="padding:4px 12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">다시 생성</button>
    </div>`;
  }
  return `<div id="kc-comic-panel-${idx}" style="position:relative;border-radius:10px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">
    <img src="${imgUrl}" style="width:100%;display:block;cursor:pointer;" onclick="kcShowImagePreview(this.src)">
    <div style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.5);color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;">${label}</div>
    <div style="position:absolute;bottom:4px;right:4px;display:flex;gap:4px;">
      <button onclick="kcRegenComicPanel(${idx})" style="padding:4px 10px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:6px;font-size:10px;cursor:pointer;backdrop-filter:blur(4px);">다시 생성</button>
    </div>
  </div>`;
}

async function kcRegenComicPanel(panelIdx) {
  if (!_kcComicPanels[panelIdx]) { toast('패널 데이터가 없습니다', 'error'); return; }
  const panel = _kcComicPanels[panelIdx];
  const container = document.getElementById('kc-comic-panel-' + panelIdx);
  if (container) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:140px;"><span class="spinner"></span><span style="font-size:11px;color:rgba(0,0,0,0.4);margin-left:6px;">재생성 중...</span></div>';
    container.style.border = '1px solid rgba(0,0,0,0.06)';
    container.style.background = '#f5f5f7';
  }

  try {
    const res = await api('/api/comic/generate-panel', {
      method: 'POST',
      body: {
        panel: { panel_number: panel.panel_number, situation: panel.situation, dialogue: panel.dialogue },
        topic: _kcComicTopic,
        style: _kcComicStyle,
        project_dir: _kcComicDir,
      },
    });

    if (res.image_path) {
      const imgUrl = res.image_url
        ? `/api/comic/image/${res.image_url}?t=${Date.now()}`
        : `/api/comic/image/${res.image_path.replace(/\\/g, '/').split('/comics/').pop()}?t=${Date.now()}`;
      _kcComicPanels[panelIdx] = { ...panel, image_path: res.image_path, status: 'ok' };
      if (container) {
        container.style.background = '';
        container.outerHTML = kcRenderComicPanelCard(panelIdx, imgUrl, _kcComicPanels[panelIdx]);
      }
      // 합성 이미지 재생성 (개별 컷 변경 후 합성 업데이트)
      kcRecomposeComic();
      toast(`${panelIdx + 1}컷 재생성 완료!`);
    } else {
      throw new Error('이미지 없음');
    }
  } catch (e) {
    _kcComicPanels[panelIdx] = { ...panel, status: 'error: ' + e.message };
    if (container) {
      container.style.background = '';
      container.outerHTML = kcRenderComicPanelCard(panelIdx, '', _kcComicPanels[panelIdx]);
    }
    toast(`${panelIdx + 1}컷 재생성 실패: ${e.message}`, 'error');
  }
}

async function kcRecomposeComic() {
  // 개별 컷이 변경된 후 합성 이미지를 다시 만들기 위해 서버에 요청
  if (!_kcComicDir) return;
  try {
    const res = await api('/api/comic/recompose', {
      method: 'POST',
      body: {
        project_dir: _kcComicDir,
        topic: _kcComicTopic || '',
        style: _kcComicStyle || 'cute',
        comic_id: _kcComicId || 0,
        panels: _kcComicPanels || [],
      },
    });
    if (res.composed_image) {
      if (res.comic_id) _kcComicId = res.comic_id;
      if (_kcProjectId && _kcComicId) {
        api(`/api/projects/${_kcProjectId}`, { method: 'PUT', body: { comic_id: _kcComicId } }).catch(() => {});
      }
      const composedUrl = `/api/comic/image/${res.composed_image.split('/comics/').pop()}?t=${Date.now()}`;
      const imgEl = document.getElementById('kc-comic-image');
      const dlEl = document.getElementById('kc-comic-download');
      if (imgEl) imgEl.src = composedUrl;
      if (dlEl) dlEl.href = composedUrl;
    }
  } catch (e) {
    console.warn('[Comic] 합성 이미지 재생성 실패:', e);
  }
}
