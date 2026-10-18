(function () {
  const SERVICES = [
    { key: 'h_auth', name: '중앙 인증 대시보드', shortName: '인증 대시보드', category: 'auth', categoryLabel: '인증', url: 'https://auth.hwasubun.ai', domain: 'auth.hwasubun.ai', description: '화수분 전체 서비스의 SSO 로그인과 계정 상태를 관리합니다.' },
    { key: 'h_banner', name: '배너 공장', shortName: '배너 공장', category: 'design', categoryLabel: '브랜딩', url: 'https://banner.hwasubun.ai', domain: 'banner.hwasubun.ai', description: '1:1, 16:9, 9:16 등 다양한 비율의 배너를 생성합니다.' },
    { key: 'h_board', name: '포스터 생성기', shortName: '포스터 생성기', category: 'design', categoryLabel: '브랜딩', url: 'https://board.hwasubun.ai', domain: 'board.hwasubun.ai', description: '42개 테마 기반의 공지/홍보 포스터 이미지를 만듭니다.' },
    { key: 'h_cartoon', name: 'AI 만화 생성기', shortName: 'AI 만화', category: 'image', categoryLabel: '이미지', url: 'https://cartoon.hwasubun.ai', domain: 'cartoon.hwasubun.ai', description: '1~100페이지 만화와 웹툰을 다양한 스타일로 생성합니다.' },
    { key: 'h_detail', name: '상세페이지 생성기', shortName: '상세페이지', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://detail.hwasubun.ai', domain: 'detail.hwasubun.ai', description: '상품 정보를 바탕으로 판매용 상세페이지를 구성합니다.' },
    { key: 'h_smartstore', name: '스마트스토어 디자이너', shortName: '스마트스토어', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://smartstore.hwasubun.ai', domain: 'smartstore.hwasubun.ai', description: '네이버 스마트스토어 브랜딩과 스토어 구성을 6단계로 도와줍니다.' },
    { key: 'h_mov', name: '영상 생성기', shortName: '영상 생성기', category: 'video', categoryLabel: '영상', url: 'https://mov.hwasubun.ai', domain: 'mov.hwasubun.ai', description: 'AI 기반 영상 콘텐츠 제작 흐름을 제공합니다.' },
    { key: 'h_thumb', name: '썸네일 제작기', shortName: '썸네일', category: 'design', categoryLabel: '브랜딩', url: 'https://thumb.hwasubun.ai', domain: 'thumb.hwasubun.ai', description: '유튜브 및 마케팅용 썸네일을 빠르게 제작합니다.' },
    { key: 'h_logo', name: '로고 생성기', shortName: '로고 생성기', category: 'design', categoryLabel: '브랜딩', url: 'https://logo.hwasubun.ai', domain: 'logo.hwasubun.ai', description: '브랜드용 AI 로고 시안을 생성합니다.' },
    { key: 'h_influencer', name: '데일리 이미지', shortName: '데일리 이미지', category: 'image', categoryLabel: '이미지', url: 'https://influencer.hwasubun.ai', domain: 'influencer.hwasubun.ai', description: '인플루언서 배경 변경과 제품 착용 이미지를 만듭니다.' },
    { key: 'h_model', name: '모델 이미지 생성기', shortName: '모델 이미지', category: 'image', categoryLabel: '이미지', url: 'https://model.hwasubun.ai', domain: 'model.hwasubun.ai', description: '광고/상품용 모델 이미지를 생성합니다.' },
    { key: 'h_outfit', name: '착장 이미지 생성기', shortName: '착장 이미지', category: 'image', categoryLabel: '이미지', url: 'https://outfit.hwasubun.ai', domain: 'outfit.hwasubun.ai', description: '의류와 스타일링 중심의 착장 이미지를 만듭니다.' },
    { key: 'h_product', name: '상품촬영 이미지 생성기', shortName: '상품촬영', category: 'image', categoryLabel: '이미지', url: 'https://product.hwasubun.ai', domain: 'product.hwasubun.ai', description: '스튜디오 촬영 없이 상품 이미지를 제작합니다.' },
    { key: 'h_adpack', name: '광고 풀패키지', shortName: '광고 풀패키지', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://adpack.hwasubun.ai', domain: 'adpack.hwasubun.ai', description: '상세페이지와 영상을 묶은 광고 패키지를 생성합니다.' },
    { key: 'h_adcopy', name: '광고 흉내내기', shortName: '광고 흉내내기', category: 'image', categoryLabel: '이미지', url: 'https://adcopy.hwasubun.ai', domain: 'adcopy.hwasubun.ai', description: '원본 광고와 모델 요소를 조합해 광고 시안을 만듭니다.' },
    { key: 'h_rotate360', name: '360도 영상', shortName: '360도 영상', category: 'video', categoryLabel: '영상', url: 'https://rotate360.hwasubun.ai', domain: 'rotate360.hwasubun.ai', description: '상품 회전 영상을 자동으로 생성합니다.' },
    { key: 'h_interior', name: '인테리어 시뮬', shortName: '인테리어 시뮬', category: 'image', categoryLabel: '이미지', url: 'https://interior.hwasubun.ai', domain: 'interior.hwasubun.ai', description: '가구와 공간 배치를 시뮬레이션합니다.' },
    { key: 'h_review', name: '리뷰 상세페이지', shortName: '리뷰 상세페이지', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://review.hwasubun.ai', domain: 'review.hwasubun.ai', description: '리뷰를 분석해 매출용 상세페이지 구조를 제안합니다.' },
    { key: 'h_rebuild', name: '상페 컨설팅', shortName: '상페 컨설팅', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://rebuild.hwasubun.ai', domain: 'rebuild.hwasubun.ai', description: '기존 상세페이지를 진단하고 개선안을 제공합니다.' },
    { key: 'h_pet', name: '동물이미지 생성기', shortName: '동물이미지', category: 'image', categoryLabel: '이미지', url: 'https://pet.hwasubun.ai', domain: 'pet.hwasubun.ai', description: '반려동물 중심의 AI 이미지를 생성합니다.' },
    { key: 'h_pet_outfit', name: '동물 착장', shortName: '동물 착장', category: 'image', categoryLabel: '이미지', url: 'https://pet-outfit.hwasubun.ai', domain: 'pet-outfit.hwasubun.ai', description: '반려동물 의류와 액세서리 착장 이미지를 만듭니다.' },
    { key: 'h_advideo', name: '광고영상 생성기', shortName: '광고영상', category: 'video', categoryLabel: '영상', url: 'https://advideo.hwasubun.ai', domain: 'advideo.hwasubun.ai', description: '120개 카메라 무빙 프리셋으로 광고 영상을 생성합니다.' },
    { key: 'h_intro', name: '로고 인트로 영상', shortName: '로고 인트로', category: 'video', categoryLabel: '영상', url: 'https://intro.hwasubun.ai', domain: 'intro.hwasubun.ai', description: '유튜브나 상품 상세용 로고 인트로 영상을 만듭니다.' },
    { key: 'h_richpage', name: '리치 상세페이지', shortName: '리치 상세페이지', category: 'commerce', categoryLabel: '상세/커머스', url: 'https://richpage.hwasubun.ai', domain: 'richpage.hwasubun.ai', description: 'AI 스토리라인 기반의 HTML 상세페이지를 빌드합니다.' },
  ];

  const CATEGORY_ORDER = ['all', 'auth', 'design', 'commerce', 'image', 'video'];
  const CATEGORY_LABELS = {
    all: '전체',
    auth: '인증',
    design: '브랜딩',
    commerce: '상세/커머스',
    image: '이미지',
    video: '영상',
  };

  const state = {
    category: 'all',
    query: '',
    lastOpenedKey: '',
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findService(key) {
    return SERVICES.find(service => service.key === key) || null;
  }

  function filteredServices() {
    const q = state.query.trim().toLowerCase();
    return SERVICES.filter(service => {
      const categoryMatch = state.category === 'all' || service.category === state.category;
      if (!categoryMatch) return false;
      if (!q) return true;
      const haystack = [
        service.name,
        service.shortName,
        service.description,
        service.domain,
        service.categoryLabel,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  function categoryCount(category) {
    if (category === 'all') return SERVICES.length;
    return SERVICES.filter(service => service.category === category).length;
  }

  function renderSidebar() {
    const root = document.getElementById('hweb-sidebar-group');
    if (!root) return;

    root.innerHTML = `
      <div class="nav-group" data-nav-group="hweb">
        <button class="nav-group-toggle" type="button" onclick="toggleSidebarGroup('hweb')">
          <span style="display:flex;align-items:center;gap:12px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h7v7H4z"/>
              <path d="M13 4h7v7h-7z"/>
              <path d="M4 13h7v7H4z"/>
              <path d="M13 13h7v7h-7z"/>
            </svg>
            화수분 웹툴
          </span>
          <span class="nav-group-arrow">▾</span>
        </button>
        <div class="nav-submenu">
          <a href="#" data-page="hweb-hub" onclick="navigateToPage('hweb-hub', { skipConfirm: true }); return false;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/><path d="M12 3v18"/><circle cx="12" cy="12" r="9"/></svg>
            전체 허브
          </a>
          ${SERVICES.map(service => `
            <a href="#" onclick="hwebOpenService('${service.key}'); return false;" title="${escapeHtml(service.description)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v7h-7"/><path d="M3 10V3h7"/><path d="M3 21l7-7"/></svg>
              ${escapeHtml(service.shortName)}
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const root = document.getElementById('hweb-summary');
    if (!root) return;
    const items = [
      { label: '전체 서비스', value: String(SERVICES.length) },
      { label: '현재 필터', value: CATEGORY_LABELS[state.category] || '전체' },
      { label: '검색 결과', value: String(filteredServices().length) },
    ];
    root.innerHTML = items.map(item => `
      <div style="min-width:96px;padding:12px 14px;background:rgba(255,140,0,0.06);border:1px solid rgba(255,140,0,0.12);border-radius:14px;">
        <div style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.32);text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(item.label)}</div>
        <div style="font-size:20px;font-weight:800;color:#1c1c1e;margin-top:4px;">${escapeHtml(item.value)}</div>
      </div>
    `).join('');
  }

  function renderCategoryChips() {
    const root = document.getElementById('hweb-category-chips');
    if (!root) return;
    root.innerHTML = CATEGORY_ORDER.map(category => {
      const active = state.category === category;
      return `
        <button
          type="button"
          onclick="hwebSetCategory('${category}')"
          style="
            padding:9px 14px;
            border-radius:999px;
            border:1px solid ${active ? 'rgba(255,140,0,0.28)' : 'rgba(0,0,0,0.08)'};
            background:${active ? 'rgba(255,140,0,0.12)' : '#fff'};
            color:${active ? '#ff8c00' : 'rgba(0,0,0,0.55)'};
            font-size:12px;
            font-weight:700;
            cursor:pointer;
          "
        >
          ${escapeHtml(CATEGORY_LABELS[category])} ${categoryCount(category)}
        </button>
      `;
    }).join('');
  }

  function renderGrid() {
    const root = document.getElementById('hweb-hub-grid');
    if (!root) return;

    const items = filteredServices();
    if (!items.length) {
      root.innerHTML = `
        <div class="card" style="grid-column:1 / -1;text-align:center;padding:34px 24px;">
          <div style="font-size:16px;font-weight:800;color:#1c1c1e;margin-bottom:8px;">검색 결과가 없습니다</div>
          <div style="font-size:13px;color:rgba(0,0,0,0.42);line-height:1.6;">카테고리를 바꾸거나 검색어를 지우고 다시 확인해보세요.</div>
        </div>
      `;
      return;
    }

    root.innerHTML = items.map(service => {
      const highlighted = state.lastOpenedKey === service.key;
      return `
        <div class="card" style="padding:18px;border:${highlighted ? '1px solid rgba(255,140,0,0.24)' : '1px solid rgba(0,0,0,0.06)'};box-shadow:${highlighted ? '0 10px 28px rgba(255,140,0,0.12)' : '0 4px 16px rgba(0,0,0,0.04)'};">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
            <div>
              <div style="display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff8c00;font-size:10px;font-weight:800;margin-bottom:10px;">${escapeHtml(service.categoryLabel)}</div>
              <div style="font-size:17px;font-weight:800;color:#1c1c1e;line-height:1.35;">${escapeHtml(service.name)}</div>
            </div>
            <div style="flex-shrink:0;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,rgba(255,140,0,0.14),rgba(255,107,0,0.10));display:flex;align-items:center;justify-content:center;color:#ff8c00;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v7h-7"/><path d="M3 10V3h7"/><path d="M3 21l7-7"/></svg>
            </div>
          </div>
          <div style="font-size:13px;line-height:1.7;color:rgba(0,0,0,0.46);min-height:66px;">${escapeHtml(service.description)}</div>
          <div style="margin-top:12px;font-size:11px;color:rgba(0,0,0,0.32);font-weight:700;">${escapeHtml(service.domain)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
            <button type="button" onclick="hwebOpenService('${service.key}')" style="flex:1;min-width:120px;padding:10px 14px;border:none;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;font-size:12px;font-weight:700;cursor:pointer;">바로 열기</button>
            <button type="button" onclick="hwebCopyUrl('${service.key}')" style="padding:10px 14px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;color:#1c1c1e;font-size:12px;font-weight:700;cursor:pointer;">URL 복사</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderSummary();
    renderCategoryChips();
    renderGrid();
  }

  window.hwebSetCategory = function (category) {
    state.category = CATEGORY_LABELS[category] ? category : 'all';
    renderAll();
  };

  window.hwebUpdateQuery = function (value) {
    state.query = String(value || '');
    renderAll();
  };

  window.hwebResetFilters = function () {
    state.category = 'all';
    state.query = '';
    const input = document.getElementById('hweb-search');
    if (input) input.value = '';
    renderAll();
  };

  window.hwebCopyUrl = async function (key) {
    const service = findService(key);
    if (!service) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(service.url);
      } else {
        const input = document.createElement('input');
        input.value = service.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      if (typeof toast === 'function') toast(`${service.name} URL을 복사했습니다.`);
    } catch (error) {
      if (typeof toast === 'function') toast(`URL 복사 실패: ${error.message}`, 'error');
    }
  };

  window.hwebOpenService = function (key) {
    const service = findService(key);
    if (!service) {
      if (typeof toast === 'function') toast('서비스 정보를 찾지 못했습니다.', 'error');
      return;
    }
    state.lastOpenedKey = key;
    renderGrid();
    try {
      window.open(service.url, '_blank');
      if (typeof toast === 'function') toast(`${service.name} 열기`);
    } catch (error) {
      if (typeof toast === 'function') toast(`외부 서비스 열기 실패: ${error.message}`, 'error');
    }
  };

  window.hwebInit = function () {
    renderSidebar();
    renderAll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.hwebInit();
    });
  } else {
    window.hwebInit();
  }
})();
