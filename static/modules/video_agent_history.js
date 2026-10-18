/**
 * video_agent_history.js
 * 영상 에이전트 히스토리 카드 UI — video_agent.js 에서 분리.
 *
 * 공용 API:
 * - window.vagHistoryInit(rootId?, compact?)  — 카드 목록 렌더
 * - window.vagHistoryOpen(index)              — 해당 영상의 프로젝트 폴더 열기
 * - window.vagHistoryDelete(index)            — 삭제 확인 후 제거, 목록 재로드
 *
 * 외부 의존:
 * - `window._globalProfileId` — 현재 선택된 브랜드 프로필 ID
 * - `window._vagHistoryItems`  — init 이 채우는 히스토리 배열 (onclick 핸들러들이 인덱스로 접근)
 */
(function () {
  'use strict';

  function _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  async function _fetch(url, opts, retries) {
    if (retries === undefined) retries = 4;
    try {
      return await fetch(url, opts);
    } catch (e) {
      var msg = (e && e.message) || String(e);
      if (retries > 0 && /Failed to fetch|NetworkError|Load failed|ERR_CONNECTION/i.test(msg)) {
        await new Promise(function (r) { setTimeout(r, 1200); });
        return _fetch(url, opts, retries - 1);
      }
      throw e;
    }
  }

  function _card(item, hi, compact) {
    var wrapPadding = compact ? '14px 16px' : '16px 20px';
    var previewHeight = compact ? '180px' : '240px';
    var source = String(item.source || 'video-agent');
    var sourceLabel = source === 'advideo' ? 'AI영상' : '모션영상';
    var sourceColor = source === 'advideo' ? '#5856d6' : '#ff8c00';
    return '<div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:' + wrapPadding + ';margin-bottom:12px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">'
      + '<div>'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<img src="/api/library/profiles/' + (item.profile_id || window._globalProfileId || 0) + '/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display=\'none\'">'
      + '<div style="font-size:14px;font-weight:700;color:#1c1c1e;">' + _esc(item.topic || sourceLabel) + '</div>'
      + '<span style="padding:3px 8px;border-radius:999px;background:' + (source === 'advideo' ? 'rgba(88,86,214,0.1)' : 'rgba(255,140,0,0.1)') + ';color:' + sourceColor + ';font-size:10px;font-weight:800;">' + sourceLabel + '</span>'
      + '</div>'
      + '<div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">' + _esc(item.profile_name || '') + (item.profile_name ? ' \u00B7 ' : '') + _esc(item.created || '') + ' \u00B7 ' + (item.scene_count || 0) + '장면 \u00B7 ' + _esc(item.aspect || '') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
      + '<button onclick="vagHistoryOpen(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button>'
      + '<button onclick="vagHistoryDelete(' + hi + ')" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>'
      + '</div>'
      + '</div>'
      + (item.video_path ? '<video controls style="width:100%;max-height:' + previewHeight + ';border-radius:10px;background:#000;" src="/api/ce2/history/image?path=' + encodeURIComponent(item.video_path) + '"></video>' : '<div style="padding:20px;text-align:center;color:rgba(0,0,0,0.2);">영상 파일 없음</div>')
      + '</div>';
  }

  async function init(rootId, compact) {
    var targetId = rootId || 'video-agent-history-root';
    var isCompact = !!compact;
    var root = document.getElementById(targetId);
    if (!root) return;
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      var resp = await _fetch('/api/vag/history');
      var data = await resp.json();
      if (!data.ok || !data.items || !data.items.length) {
        root.innerHTML = '<div style="text-align:center;padding:32px;color:rgba(0,0,0,0.2);">아직 생성된 영상이 없습니다</div>';
        return;
      }
      window._vagHistoryItems = data.items;
      var items = isCompact ? data.items.slice(0, 4) : data.items;
      root.innerHTML = items.map(function (item, hi) { return _card(item, hi, isCompact); }).join('');
    } catch (e) {
      root.innerHTML = '<div style="text-align:center;padding:40px;color:#ff3b30;">오류: ' + e.message + '</div>';
    }
  }

  async function open(hi) {
    var item = (window._vagHistoryItems || [])[hi];
    if (!item || !item.project_dir) return;
    fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.project_dir }) });
  }

  async function del(hi) {
    var item = (window._vagHistoryItems || [])[hi];
    if (!item || !item.folder) return;
    if (!confirm('삭제하시겠습니까?')) return;
    await _fetch('/api/vag/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder }) });
    init();
  }

  async function publish(hi, platform) {
    var item = (window._vagHistoryItems || [])[hi];
    if (!item || !item.video_path) return;
    var status = document.getElementById('vag-h-status-' + hi);
    var profileId = parseInt(window._globalProfileId || 0);
    if (!profileId) {
      if (status) status.innerHTML = '<span style="color:#ff3b30;">프로필 선택</span>';
      return;
    }
    var caption = item.topic || '';
    if (status) { status.textContent = platform + ' 업로드 중...'; status.style.color = '#ff8c00'; }
    try {
      var resp;
      if (platform === 'reels' || platform === 'story') {
        resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: caption, video_path: item.video_path, type: platform, profile_id: profileId }) });
      } else if (platform === 'shorts') {
        resp = await fetch('/api/youtube/upload-shorts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caption, description: caption, video_path: item.video_path, profile_id: profileId }) });
      } else if (platform === 'tiktok') {
        resp = await fetch('/api/tiktok/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: caption, video_path: item.video_path, profile_id: profileId }) });
      }
      var rdata = await resp.json();
      if (rdata.ok || rdata.success || rdata.url) {
        if (status) { status.textContent = '완료!'; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = rdata.error || '실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
  }

  // 기존 onclick 핸들러가 직접 호출하므로 window 에 같은 이름으로 export
  window.vagHistoryInit = init;
  window.vagHistoryOpen = open;
  window.vagHistoryDelete = del;
  window.vagHistoryPublish = publish;
})();
