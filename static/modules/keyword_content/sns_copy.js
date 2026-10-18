// keyword_content/sns_copy.js — 카드뉴스 업로드/SNS 텍스트 복사

async function kcUploadCardnews() {
  if (!_kcCardnewsDir) { toast('먼저 카드뉴스를 생성하세요', 'error'); return; }

  // 인스타그램 ID 확인
  try {
    const config = await api('/api/config');
    const igId = config?.INSTAGRAM?.instagram_id || '';
    if (!igId) {
      toast('설정에서 인스타그램 ID를 먼저 입력해주세요!', 'error');
      return;
    }
  } catch {}

  const captionEl = document.getElementById('kc-cn-ig-caption');
  let caption = captionEl ? captionEl.value.trim() : '';
  if (!caption) {
    const keyword = document.getElementById('kc-keyword').value.trim();
    const brandName = document.getElementById('kc-business-name')?.value?.trim() || '';
    caption = `${brandName ? brandName + '\n\n' : ''}${keyword}`;
  }
  // 모달에서 이미 확인했으므로 바로 진행

  try {
    toast('인스타그램 업로드 시작...');
    await api('/api/instagram/upload', {
      method: 'POST',
      body: { project_dir: _kcCardnewsDir, caption, profile_id: parseInt(window._globalProfileId || 0) },
    });
    toast('인스타그램 업로드 완료!');
  } catch (e) {
    toast('인스타 업로드 실패: ' + e.message, 'error');
  }
}

async function kcCopyWorkspaceText(platform) {
  const statusEl = document.getElementById(`kc-upload-${platform}-status`);
  const btn = document.getElementById(`kc-upload-${platform}-btn`);
  const origHtml = btn?.innerHTML || '';
  try {
    let text = '';
    if (platform === 'threads') {
      text = normalizeThreadsText(document.getElementById('kc-sns-threads-text')?.value || '');
    } else if (platform === 'twitter') {
      text = normalizeTwitterPostText(document.getElementById('kc-sns-twitter-text')?.value || '');
    }
    if (!text) throw new Error('복사할 문구가 없습니다');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '복사 중...';
    }
    await navigator.clipboard.writeText(text);
    if (statusEl) {
      statusEl.textContent = '복사됨';
      statusEl.style.color = '#34c759';
    }
    toast(`${platform === 'threads' ? '스레드' : '트위터'} 문구를 복사했습니다.`);
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = e.message || '복사 실패';
      statusEl.style.color = '#ff3b30';
    }
    toast((platform === 'threads' ? '스레드' : '트위터') + ' 복사 실패: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml || '복사';
    }
  }
}
