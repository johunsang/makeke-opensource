// keyword_content/core.js — 페이지 초기화, 메인 탭

function kcMainTab(tab) {
  const tabs = { keyword: '#4fc08d', cardnews: '#f5a623', url: '#5b9bf5' };
  ['keyword', 'cardnews', 'url'].forEach(t => {
    const btn = document.getElementById('kc-main-tab-' + t);
    const panel = document.getElementById('kc-main-panel-' + t);
    if (t === tab) {
      btn.style.background = `rgba(${t === 'keyword' ? '79,192,141' : t === 'cardnews' ? '245,166,35' : '91,155,245'},0.15)`;
      btn.style.color = tabs[t];
      btn.style.border = `1px solid ${tabs[t]}40`;
      if (panel) panel.style.display = 'block';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'rgba(255,255,255,0.4)';
      btn.style.border = '1px solid transparent';
      if (panel) panel.style.display = 'none';
    }
  });

  if (tab === 'cardnews') {
    // 카드뉴스 전용 페이지로 이동 (상세 설정 필요 시)
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-cardnews').classList.add('active');
  } else if (tab === 'url') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-product').classList.add('active');
  }
}

function kcInit() {
  if (typeof mkkRenderSingleImageModelBanner === 'function') {
    mkkRenderSingleImageModelBanner('keyword-content', { note: '종합 콘텐츠 생성 전 현재 설정 모델을 사용합니다.' });
  }
  // ── 워크스페이스 진입 시 전체 자동 정리 ──
  // 플래그 초기화
  _kcGenerating = false;
  _kcCnGenerating = false;
  _kcPromptReviewed = false;
  _kcPromptReviewOpening = false;
  _kcPromptOverrides = {};
  _kcLastPromptSourceSummary = '';
  _kcLastPromptReviewSignature = '';
  _kcImageSlots = [];

  // 오버레이/모달 강제 해제
  unlockScreen();
  kcCloseOverlappingPromptModals();
  kcClearPromptInlineRoot();
  document.getElementById('kc-set-gen-overlay')?.remove();
  document.getElementById('kc-gen-loading') && (document.getElementById('kc-gen-loading').style.display = 'none');

  // 버튼 상태 복원
  kcSetGenerateButtonsLoading(false);
  const uploadBtn = document.getElementById('kc-next-upload-btn');
  if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.style.opacity = '0.3'; }

  // UI 로드
  kcLoadLibraryDropdown();
  kcRenderPresets();

  // 페이지 진입 시 항상 1단계로 리셋
  _kcCurrentStep = 1;
  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById('kc-card-' + i);
    if (card) card.style.display = i === 1 ? 'block' : 'none';
  }
  const resultCard = document.getElementById('kc-result-card');
  if (resultCard) resultCard.style.display = 'none';
}
