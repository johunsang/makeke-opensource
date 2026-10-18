/**
 * cardnews_editor2.js
 * 카드뉴스(편집2) - 캔버스 + Fabric.js 기반 편집기
 * 단계: 1.기본정보 → 2.배경이미지 → 3.전략구성 → 4.전체생성
 */
(function () {
  'use strict';

  let _initialized = false;
  let _selectedCount = 6;
  let _slides = [];
  let _pendingBgMode = '';
  let _pendingBgTemplate = null;
  let _sourceContent = ''; // 사용자 제공 소재 (직접입력/URL/파일)
  let _sourcePreviewHTML = '';
  let _strategyFlow = [];
  let _userUploadedImages = [];
  let _includeCta = true;
  let _cardnewsProjectDir = '';
  let _cardnewsID = null;
  // 스텝 상태는 채팅 모달에서 관리

  const FONTS = ['Pretendard','SUIT','Noto Sans KR','Noto Serif KR','Black Han Sans','Do Hyeon','Nanum Gothic','Nanum Myeongjo','Gowun Batang','Arial','Georgia'];
  const FONT_SIZES = [10,12,14,16,18,20,24,28,32,36,40,48,56,64];
  const TEXT_COLORS = ['#ffffff','#000000','#ff8c00','#ff3b30','#34c759','#007aff','#ffd60a','#bf5af2','#f5f5f7','#1c1c1e'];
  let _activeTextEl = null;

  const MOCK_BG_COLORS = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #fccb90, #d57eeb)',
    'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
  ];
  // 역할별 색상 매핑
  const ROLE_BG_MAP = {
    '히어로': 'linear-gradient(135deg, #0f0c29, #302b63)',
    '표지': 'linear-gradient(135deg, #1a1a2e, #16213e)',
    '후킹': 'linear-gradient(135deg, #e44d26, #f7971e)',
    '공감': 'linear-gradient(135deg, #667eea, #764ba2)',
    '문제': 'linear-gradient(135deg, #434343, #1a1a2e)',
    '핵심': 'linear-gradient(135deg, #11998e, #38ef7d)',
    '가치': 'linear-gradient(135deg, #56ab2f, #a8e063)',
    '솔루션': 'linear-gradient(135deg, #4facfe, #00f2fe)',
    '해결': 'linear-gradient(135deg, #4facfe, #00f2fe)',
    '차별': 'linear-gradient(135deg, #f093fb, #f5576c)',
    '상세': 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    '제품': 'linear-gradient(135deg, #fccb90, #d57eeb)',
    '후기': 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    '신뢰': 'linear-gradient(135deg, #667eea, #764ba2)',
    '증거': 'linear-gradient(135deg, #89f7fe, #66a6ff)',
    'CTA': 'linear-gradient(135deg, #ff8c00, #ff6b00)',
    '전환': 'linear-gradient(135deg, #ff8c00, #ff6b00)',
    '행동': 'linear-gradient(135deg, #fa709a, #fee140)',
  };
  function _bgForRole(role, idx) {
    if (!role) return MOCK_BG_COLORS[idx % MOCK_BG_COLORS.length];
    for (const [key, bg] of Object.entries(ROLE_BG_MAP)) {
      if (role.includes(key)) return bg;
    }
    return MOCK_BG_COLORS[idx % MOCK_BG_COLORS.length];
  }

  /* ── 초기화 ── */
  function ce2Init() {
    if (typeof mkkRenderSingleImageModelBanner === 'function') {
      mkkRenderSingleImageModelBanner('cardnews-editor2', { note: '카드뉴스 글과 이미지 생성 전 현재 설정 모델을 사용합니다.' });
    }
    if (_initialized) return;
    _initialized = true;
    const root = document.getElementById('cardnews-editor2-root');
    if (!root) return;
    _renderLayout(root);
    _renderPresetList();
    // 프로필 업종 자동 입력
    _fillFromProfile();
  }

  let _brandName = '';
  let _brandDesc = '';
  let _brandContact = '';
  let _brandWebsite = '';
  let _brandBizDetail = '';
  let _brandLogoUrl = '';
  let _brandColor = '';
  let _brandImages = [];

  async function _ce2UploadReferenceFile(file) {
    if (!file) return '';
    const formData = new FormData();
    formData.append('files', file);
    const res = await fetch('/api/content/upload-image', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || '참조 이미지 업로드 실패');
    const image = Array.isArray(data.images) ? data.images[0] : null;
    return image?.url || data.url || '';
  }

  function _fillFromProfile() {
    const p = window._globalProfileData;
    if (!p) return;
    const industryEl = document.getElementById('ce2-industry');
    if (industryEl && p.business_type) industryEl.value = p.business_type;
    _brandName = p.name || '';
    _brandDesc = p.description || '';
    _brandContact = p.contact_info || '';
    _brandWebsite = p.website || '';
    _brandBizDetail = p.biz_detail || '';
    _brandLogoUrl = p.logo_path ? `/api/library/image/${p.id}/${p.logo_path}` : '';
    _brandColor = p.brand_color || '';
    try {
      const imgs = JSON.parse(p.images_json || '[]');
      _brandImages = imgs.map(img => typeof img === 'string' ? img : (img.path || img.url || ''));
    } catch { _brandImages = []; }

    // 프로필 카드 — 비표시 (데이터만 로드)
    const card = document.getElementById('ce2-profile-card');
    if (card) card.style.display = 'none';
  }

  /* ── 프리셋 관리 ── */
  const PRESET_STORAGE_KEY = 'ce2_presets_v1';

  function _loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function _savePresetToStorage(preset) {
    const presets = _loadPresets();
    // 같은 업종+주제 중복 방지
    const key = `${preset.industry}|${preset.topic}`;
    const idx = presets.findIndex(p => `${p.industry}|${p.topic}` === key);
    if (idx >= 0) presets[idx] = preset;
    else presets.unshift(preset);
    // 최대 20개
    if (presets.length > 20) presets.length = 20;
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  }

  const PRESET_PAGE_SIZE = 3;
  let _presetPage = 0;

  function _renderPresetList() {
    const el = document.getElementById('ce2-preset-list');
    if (!el) return;
    const presets = _loadPresets();
    if (!presets.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = presets.map((p, idx) => {
      const label = [p.industry, p.topic].filter(Boolean).join(' · ');
      return `<span onclick="ce2LoadPreset(${idx})" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;border:1px solid rgba(0,0,0,0.06);background:rgba(120,120,128,0.04);cursor:pointer;font-size:10px;color:rgba(0,0,0,0.5);white-space:nowrap;transition:all 0.15s;max-width:160px;" onmouseenter="this.style.background='rgba(255,140,0,0.08)';this.style.borderColor='rgba(255,140,0,0.2)';this.style.color='#ff8c00'" onmouseleave="this.style.background='rgba(120,120,128,0.04)';this.style.borderColor='rgba(0,0,0,0.06)';this.style.color='rgba(0,0,0,0.5)'"><span style="overflow:hidden;text-overflow:ellipsis;">${_esc(label)}</span><span onclick="event.stopPropagation();ce2DeletePreset(${idx})" style="color:rgba(0,0,0,0.2);cursor:pointer;font-size:11px;line-height:1;">&times;</span></span>`;
    }).join('');
  }

  function ce2PresetPrev() { _presetPage--; _renderPresetList(); }
  function ce2PresetNext() { _presetPage++; _renderPresetList(); }

  function ce2LoadPreset(idx) {
    const presets = _loadPresets();
    const p = presets[idx];
    if (!p) return;
    document.getElementById('ce2-industry').value = p.industry || '';
    const topicInput = document.getElementById('ce2-topic-input');
    if (topicInput) topicInput.value = p.topic || '';
    document.getElementById('ce2-topic').value = p.topic || '';
    document.getElementById('ce2-purpose').value = p.purpose || '';
    _selectedCount = p.count || 6;
    _includeCta = p.includeCta !== false;
    _pendingBgMode = p.bgMode || '';
    _pendingBgTemplate = p.bgTemplate || null;
    _strategyFlow = p.strategyFlow || [];
    // 바로 생성
    if (_strategyFlow.length) {
      ce2AiGenerate();
      _updateSummary();
    }
  }

  function ce2DeletePreset(idx) {
    const presets = _loadPresets();
    presets.splice(idx, 1);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    _renderPresetList();
  }

  function ce2ClearPresets() {
    localStorage.removeItem(PRESET_STORAGE_KEY);
    _renderPresetList();
  }

  function _autoSavePreset() {
    const industry = (document.getElementById('ce2-industry')?.value || '').trim();
    const topic = (document.getElementById('ce2-topic')?.value || '').trim();
    const purpose = (document.getElementById('ce2-purpose')?.value || '').trim();
    if (!industry || !topic) return;
    _savePresetToStorage({
      industry, topic, purpose,
      count: _selectedCount,
      includeCta: _includeCta,
      bgMode: _pendingBgMode,
      bgTemplate: _pendingBgTemplate,
      strategyFlow: _strategyFlow,
      savedAt: new Date().toISOString(),
    });
    _renderPresetList();
  }

  /* ── 레이아웃 ── */
  function _inputStyle() {
    return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;transition:border-color 0.2s;';
  }

  function _renderLayout(root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow-y:auto;overflow-x:hidden;">

        <!-- 숨겨진 입력값 -->
        <div style="display:none;">
          <input type="hidden" id="ce2-industry">
          <input type="text" id="ce2-topic-input" value="">
        </div>

        <!-- 기존 소재 탭 (숨김 — 모달에서 사용) -->
        <div style="display:none;">
          <div id="ce2-src-text"></div>
          <div id="ce2-src-news"><div id="ce2-news-picked"></div></div>
          <div id="ce2-src-naver"><div id="ce2-naver-picked"></div></div>
        </div>

        <!-- 기존 폼 (완전 숨김) -->
        <div style="display:none;">
          <div id="ce2-preset-list"></div>
          <div id="ce2-profile-card"></div>
          <div id="ce2-summary"></div>
          <input type="hidden" id="ce2-topic">
          <input type="hidden" id="ce2-purpose">
          <textarea id="ce2-source-text"></textarea>
        </div>

        <!-- 2단: 어시스턴트 채팅 -->
        <div id="ce2-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;display:flex;flex-direction:column;flex:1;min-height:400px;overflow:visible;">
          <div style="padding:10px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
            <div style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:11px;height:11px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
            </div>
            <span style="font-size:13px;font-weight:700;color:#1c1c1e;">AI 어시스턴트</span>
            <button type="button" onclick="ce2Reset()" title="처음부터 다시 시작" style="margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:rgba(0,0,0,0.55);font-size:11px;font-weight:700;cursor:pointer;">재시작</button>
          </div>
          <div id="ce2-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 0;gap:12px;">
              <div style="font-size:32px;">&#x2728;</div>
              <div style="font-size:14px;color:rgba(0,0,0,0.3);text-align:center;">AI가 단계별로 안내하며<br>카드뉴스를 완성합니다</div>
              <button onclick="ce2OnIndustryEnter()" style="padding:14px 40px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(255,140,0,0.3);display:flex;align-items:center;gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
                AI로 시작하기
              </button>
            </div>
          </div>
          <div id="ce2-chat-input-area" style="padding:10px 16px;border-top:1px solid rgba(0,0,0,0.06);display:none;">
            <div style="display:flex;gap:8px;">
              <input type="text" id="ce2-chat-input" placeholder="직접 입력..." style="flex:1;padding:8px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);outline:none;" onkeydown="if(event.key==='Enter'){event.preventDefault();ce2ChatSend();}">
              <button onclick="ce2ChatSend()" style="padding:8px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">전송</button>
            </div>
          </div>
          <!-- 이미지 결과 (어시스턴트 바로 아래) -->
          <div id="ce2-canvas-area" style="padding:12px 16px;">
            <div id="ce2-empty-state" style="display:none;"></div>
            <div id="ce2-slides-grid" style="display:none;grid-template-columns:repeat(3,1fr);gap:16px;"></div>
          </div>
        </div>
      </div>
    `;
    _selectedCount = 6;
  }

  /* ── Step 1: 입력 감지 ── */
  function ce2OnStep1Input() {
    _checkStep1();
  }

  /* ── 업종 Enter → AI 어시스턴트 모달 ── */
  const INDUSTRY_SUBTYPES = {
    '병원': ['피부과','성형외과','치과','안과','정형외과','내과','한의원','산부인과','소아과','기타'],
    '학원': ['영어학원','수학학원','입시학원','코딩학원','음악학원','미술학원','태권도','기타'],
    '학교': ['초등학교','중학교','고등학교','대학교','유치원/어린이집','기타'],
    '카페': ['디저트 카페','브런치 카페','베이커리 카페','스터디 카페','애견 카페','기타'],
    '음식점': ['한식','일식','중식','양식','분식','고깃집','횟집','기타'],
    '부동산': ['아파트','오피스텔','상가','토지','전원주택','기타'],
    '뷰티': ['네일샵','헤어샵','에스테틱','속눈썹','피부관리','기타'],
    '쇼핑몰': ['패션','식품','리빙','유아동','건강식품','기타'],
    '헬스장': ['피트니스','요가','필라테스','크로스핏','수영','기타'],
  };

  const TOPIC_SUGGESTIONS = {
    '카페': ['시그니처 메뉴 소개','신메뉴 출시 안내','매장 분위기 소개','이벤트/할인 안내','고객 후기 모음','계절 메뉴 추천'],
    '병원': ['시술 과정 안내','전후 비교 사례','의료진 소개','진료 안내','건강 정보 콘텐츠','이벤트/프로모션'],
    '학원': ['커리큘럼 안내','성적 향상 사례','신규 개강 안내','강사 소개','학습 팁 콘텐츠','수강 후기'],
    '음식점': ['대표 메뉴 소개','오늘의 추천','매장 분위기','이벤트/할인','고객 후기','계절 메뉴'],
    '부동산': ['신규 매물 소개','입지 분석','시세 동향','인테리어 팁','생활권 안내','성공 사례'],
    '뷰티': ['시술 소개','비포/애프터','신규 메뉴','이벤트/할인','관리 팁','고객 후기'],
    '쇼핑몰': ['신상품 소개','베스트 아이템','이벤트/세일','코디 추천','고객 리뷰','브랜드 소개'],
    '헬스장': ['프로그램 소개','회원 변화 사례','이벤트/할인','운동 팁','시설 안내','트레이너 소개'],
  };
  const EXTRA_TOPIC_SUGGESTIONS = [
    '처음 방문하는 고객 안내', '자주 묻는 질문 정리', '가격보다 중요한 선택 기준', '고객이 놓치기 쉬운 체크포인트',
    '방문 전 준비사항', '이용 과정 한눈에 보기', '초보자를 위한 시작 가이드', '실패하지 않는 선택법',
    '우리 브랜드가 다른 이유', '고객 고민 해결 사례', '서비스 이용 전후 변화', '대표 상품 비교',
    '이번 달 추천 메뉴/서비스', '예약 전 꼭 알아둘 점', '후기에서 많이 나온 장점', '사장님이 직접 알려주는 팁',
    '비슷한 곳과 비교 포인트', '가성비보다 만족도를 높이는 기준', '첫 구매 고객 혜택', '재방문 고객이 많은 이유',
    '계절별 추천 콘텐츠', '고객 유형별 추천', '문제 상황별 해결법', '하루 루틴 속 활용법',
    '브랜드 스토리 소개', '신뢰를 만드는 운영 원칙', '처음 보는 사람을 위한 요약', '구매 전 비교 체크리스트',
    '상담이 필요한 순간', '서비스 선택 실수 줄이는 법', '인기 상품/서비스 TOP 5', '우리 매장의 숨은 장점'
  ];

  const PURPOSE_OPTIONS = ['방문 유도','상품 판매','브랜드 인지도','이벤트 홍보','고객 후기 공유','신규 오픈 안내','전문성 어필','팔로워 확보'];

  let _chatMessages = [];
  let _chatState = 'idle'; // idle, ask_subtype, ask_topic, ask_source, ask_source_text, ask_source_url, ask_source_youtube, ask_purpose, ask_count, ask_cta, done

  function ce2OnIndustryEnter() {
    const industry = (document.getElementById('ce2-industry')?.value || '').trim();
    if (!industry) return;
    const topicInput = (document.getElementById('ce2-topic-input')?.value || '').trim();
    _collectSourceContent();
    _openAssistModal(industry, topicInput);
  }

  function _openAssistModal(industry, prefillTopic) {
    _chatMessages = [];
    _chatState = 'idle';
    _includeCta = true;

    // 인라인 패널의 채팅 영역 초기화
    const chatBody = document.getElementById('ce2-chat-body');
    if (chatBody) chatBody.innerHTML = '';
    const inputArea = document.getElementById('ce2-chat-input-area');
    if (inputArea) inputArea.style.display = 'none';

    _startChat(industry, prefillTopic);
  }

  function _scrollAssistIntoView() {
    const panel = document.getElementById('ce2-assist-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _addChatMsg(role, html) {
    _chatMessages.push({ role, html });
    const body = document.getElementById('ce2-chat-body');
    if (!body) return;
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${isAi ? 'flex-start' : 'flex-end'};`;
    div.innerHTML = `<div style="max-width:85%;padding:10px 14px;border-radius:${isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};background:${isAi ? 'rgba(120,120,128,0.08)' : 'linear-gradient(135deg,#ff8c00,#ff6b00)'};color:${isAi ? '#1c1c1e' : '#fff'};font-size:13px;line-height:1.6;">${html}</div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    _scrollAssistIntoView();
  }

  function _addOptionBtns(options, callback) {
    const body = document.getElementById('ce2-chat-body');
    if (!body) return;
    const wrap = document.createElement('div');
    wrap.className = 'ce2-chat-options';
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;';
      btn.onmouseenter = () => { btn.style.background = 'rgba(255,140,0,0.15)'; };
      btn.onmouseleave = () => { btn.style.background = 'rgba(255,140,0,0.06)'; };
      btn.onclick = () => {
        // 선택된 옵션들 제거하고 사용자 메시지로 표시
        const allOpts = body.querySelectorAll('.ce2-chat-options');
        allOpts.forEach(el => el.remove());
        _addChatMsg('user', opt);
        callback(opt);
      };
      wrap.appendChild(btn);
    });
    // 직접 입력 버튼
    const directBtn = document.createElement('button');
    directBtn.textContent = '직접 입력';
    directBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;';
    directBtn.onclick = () => {
      const allOpts = body.querySelectorAll('.ce2-chat-options');
      allOpts.forEach(el => el.remove());
      const inputArea = document.getElementById('ce2-chat-input-area');
      if (inputArea) inputArea.style.display = 'block';
      document.getElementById('ce2-chat-input')?.focus();
    };
    wrap.appendChild(directBtn);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    _scrollAssistIntoView();
  }

  let _currentIndustry = '';
  let _currentSubtype = '';
  let _prefillTopic = '';
  let _topicSuggestionRound = 0;
  let _shownTopicSuggestions = new Set();

  function _topicBaseKey() {
    const current = String(_currentIndustry || '').split('(')[0].trim();
    return Object.keys(TOPIC_SUGGESTIONS).find(key => current.includes(key) || String(_currentIndustry || '').includes(key)) || current;
  }

  function _topicFallbackPool() {
    const base = TOPIC_SUGGESTIONS[_topicBaseKey()] || [];
    return [...base, ...EXTRA_TOPIC_SUGGESTIONS];
  }

  function _freshTopicOptions(candidates, count) {
    const pool = [...(Array.isArray(candidates) ? candidates : []), ..._topicFallbackPool()]
      .map(item => String(item || '').trim())
      .filter(Boolean);
    const unique = [];
    pool.forEach(item => {
      if (!unique.includes(item)) unique.push(item);
    });
    let fresh = unique.filter(item => !_shownTopicSuggestions.has(item)).slice(0, count);
    if (!fresh.length) {
      const fallback = _topicFallbackPool();
      const start = (_topicSuggestionRound * count) % Math.max(1, fallback.length);
      fresh = fallback.slice(start, start + count);
      if (fresh.length < count) fresh = fresh.concat(fallback.slice(0, count - fresh.length));
    }
    fresh.forEach(item => _shownTopicSuggestions.add(item));
    _topicSuggestionRound += 1;
    return fresh;
  }

  async function _apiAssist(action, extra = {}) {
    try {
      const resp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, industry: _currentIndustry, subtype: _currentSubtype, ...extra }),
      });
      const data = await resp.json();
      if (data.ok) return data.items || [];
      console.warn('ce2 assist error:', data.error);
      return null;
    } catch (e) {
      console.error('ce2 assist fetch error:', e);
      return null;
    }
  }

  async function _startChat(industry, prefillTopic) {
    _currentIndustry = industry;
    _currentSubtype = '';
    _prefillTopic = prefillTopic || '';
    _topicSuggestionRound = 0;
    _shownTopicSuggestions = new Set();
    const hasSource = !!_sourceContent;

    // 소재가 있으면 주제/세부업종 추천 모두 건너뛰고 바로 목적으로
    if (hasSource) {
      const topicLabel = _prefillTopic || '(소재 기반 자동 설정)';
      document.getElementById('ce2-topic').value = _prefillTopic || _sourceContent.slice(0, 50);
      let msg = `소재가 입력되었습니다. (${_sourceContent.length}자)`;
      if (_brandName) msg = `<b>${_esc(_brandName)}</b> — ${msg}`;
      if (_prefillTopic) msg += `<br>주제: <b>${_esc(_prefillTopic)}</b>`;
      _addChatMsg('ai', `${msg}<br>목적을 선택해주세요.`);
      // 소재 내용 미리보기 (접을 수 있게)
      const chatBody = document.getElementById('ce2-chat-body');
      if (chatBody) {
        const srcWrap = document.createElement('div');
        srcWrap.style.cssText = 'margin:4px 0;';
        const preview = _sourceContent.length > 300 ? _esc(_sourceContent.slice(0, 300)) + '...' : _esc(_sourceContent);
        const fullId = 'ce2-src-full-' + Date.now();
        srcWrap.innerHTML = `
          <div style="background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.1);border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.6;color:rgba(0,0,0,0.5);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-weight:600;color:rgba(0,0,0,0.4);">수집된 소재 미리보기</span>
              <button onclick="var f=document.getElementById('${fullId}');if(f){f.style.display=f.style.display==='none'?'block':'none';this.textContent=f.style.display==='none'?'전체보기':'접기'}" style="padding:2px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.15);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;cursor:pointer;">전체보기</button>
            </div>
            <div>${preview}</div>
            <div id="${fullId}" style="display:none;margin-top:8px;white-space:pre-wrap;max-height:300px;overflow-y:auto;border-top:1px solid rgba(0,0,0,0.06);padding-top:8px;">${_esc(_sourceContent)}</div>
          </div>`;
        chatBody.appendChild(srcWrap);
      }
      _chatState = 'ask_purpose';
      await _askPurpose();
      return;
    }

    // 프로필 정보가 있으면 요약 표시 후 바로 주제로
    if (_brandName) {
      let intro = `<b>${_esc(_brandName)}</b>`;
      if (industry) intro += ` (${_esc(industry)})`;
      if (_brandDesc) intro += `<br><span style="font-size:11px;color:rgba(0,0,0,0.4);">${_esc(_brandDesc)}</span>`;
      _addChatMsg('ai', `${intro}<br><br>프로필 정보를 기반으로 진행합니다!`);

      // 주제가 이미 있으면 목적으로
      if (_prefillTopic) {
        document.getElementById('ce2-topic').value = _prefillTopic;
        _chatState = 'ask_purpose';
        _addChatMsg('ai', `주제: <b>${_prefillTopic}</b><br>목적을 선택해주세요.`);
        await _askPurpose();
        return;
      }
      // 주제 추천
      _chatState = 'ask_topic';
      _addChatMsg('ai', '<span style="color:rgba(0,0,0,0.3);font-size:11px;">AI가 주제를 추천 중...</span>');
      await _suggestTopics();
      return;
    }

    // 프로필 없음 → 기존 플로우 (세부업종 질문)
    _chatState = 'ask_subtype';
    _addChatMsg('ai', `<b>${industry}</b>을(를) 입력하셨네요!${_prefillTopic ? `<br>주제: <b>${_prefillTopic}</b>` : ''}<br>좀 더 구체적으로 알려주시면 맞춤 추천을 드릴게요.`);
    _addChatMsg('ai', '<span style="color:rgba(0,0,0,0.3);font-size:11px;">AI가 세부 업종을 분석 중...</span>');

    const subtypes = await _apiAssist('subtypes');
    // 마지막 로딩 메시지 제거
    const body = document.getElementById('ce2-chat-body');
    if (body && body.lastChild) body.removeChild(body.lastChild);

    if (subtypes && subtypes.length > 1) {
      _addChatMsg('ai', '어떤 종류인가요?');
      _addOptionBtns(subtypes, (selected) => _onSubtypeSelected(selected));
    } else {
      // 세부 분류 불필요 → 바로 주제 추천
      _chatState = 'ask_topic';
      _addChatMsg('ai', '카드뉴스 주제를 추천드릴게요!');
      await _suggestTopics();
    }
  }

  async function _onSubtypeSelected(subtype) {
    _currentSubtype = subtype;
    const fullIndustry = `${_currentIndustry} (${subtype})`;
    document.getElementById('ce2-industry').value = fullIndustry;
    // 주제가 이미 입력되어 있으면 스킵
    if (_prefillTopic) {
      document.getElementById('ce2-topic').value = _prefillTopic;
      _addChatMsg('ai', `<b>${fullIndustry}</b> + 주제: <b>${_prefillTopic}</b><br>목적을 선택해주세요.`);
      _chatState = 'ask_purpose';
      await _askPurpose();
      return;
    }
    _chatState = 'ask_topic';
    _addChatMsg('ai', `<b>${fullIndustry}</b>에 딱 맞는 주제를 추천드릴게요!`);
    _addChatMsg('ai', '<span style="color:rgba(0,0,0,0.3);font-size:11px;">AI가 주제를 생성 중...</span>');
    await _suggestTopics();
  }

  async function _suggestTopics() {
    const topics = await _apiAssist('topics', { brand_name: _brandName, brand_desc: _brandDesc, brand_biz_detail: _brandBizDetail, count: 30 });
    const body = document.getElementById('ce2-chat-body');
    if (body && body.lastChild) body.removeChild(body.lastChild);

    const list = _freshTopicOptions((topics && topics.length) ? topics : [], 8);
    _addChatMsg('ai', '어떤 주제로 카드뉴스를 만들까요?');
    _addOptionBtns(list, (selected) => _onTopicSelected(selected));
    // 더 추천받기 + 직접 입력
    if (body) {
      const extra = document.createElement('div');
      extra.className = 'ce2-chat-options';
      extra.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
      const moreBtn = document.createElement('button');
      moreBtn.textContent = '더 추천받기';
      moreBtn.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.1);background:rgba(0,0,0,0.03);color:rgba(0,0,0,0.4);font-size:12px;font-weight:500;cursor:pointer;';
      moreBtn.onclick = async () => {
        moreBtn.textContent = '추천 중...';
        moreBtn.disabled = true;
        const moreTopics = await _apiAssist('topics', { brand_name: _brandName, brand_desc: _brandDesc, brand_biz_detail: _brandBizDetail, count: 30 });
        const freshTopics = _freshTopicOptions((moreTopics && moreTopics.length) ? moreTopics : [], 8);
        if (freshTopics.length) {
          // 기존 옵션 뒤에 새 옵션 추가 (extra 바로 앞에)
          const newWrap = document.createElement('div');
          newWrap.className = 'ce2-chat-options';
          newWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;';
          freshTopics.forEach(opt => {
            const b = document.createElement('button');
            b.textContent = opt;
            b.style.cssText = 'padding:7px 14px;border-radius:20px;border:1px solid rgba(255,140,0,0.25);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;';
            b.onmouseenter = () => { b.style.background = 'rgba(255,140,0,0.15)'; };
            b.onmouseleave = () => { b.style.background = 'rgba(255,140,0,0.06)'; };
            b.onclick = () => {
              body.querySelectorAll('.ce2-chat-options').forEach(el => el.remove());
              _addChatMsg('user', opt);
              _onTopicSelected(opt);
            };
            newWrap.appendChild(b);
          });
          extra.before(newWrap);
        } else {
          _addChatMsg('ai', '<span style="color:#ff9500;">새 추천을 가져오지 못했습니다. 직접 입력으로 진행해주세요.</span>');
        }
        moreBtn.textContent = '더 추천받기';
        moreBtn.disabled = false;
        body.scrollTop = body.scrollHeight;
        _scrollAssistIntoView();
      };
      extra.appendChild(moreBtn);
      body.appendChild(extra);
    }
  }

  async function _onTopicSelected(topic) {
    document.getElementById('ce2-topic').value = topic;
    // 주제 입력란에도 반영
    const topicInput = document.getElementById('ce2-topic-input');
    if (topicInput) topicInput.value = topic;
    _chatState = 'ask_source';
    _addChatMsg('ai', `좋아요! <b>"${topic}"</b> 주제로 진행할게요.<br>이제 카드뉴스에 반영할 소재를 고를까요?`);
    _askSource();
  }

  function _askSource() {
    _chatState = 'ask_source';
    _addOptionBtns(['뉴스 검색', '네이버 검색', 'YouTube 분석', 'URL 가져오기', '직접 입력', '파일 업로드', '소재 없이 진행'], (selected) => _onSourceSelected(selected));
  }

  function _askSourceCompletion() {
    _chatState = 'ask_source';
    _addChatMsg('ai', '소재를 적용했으면 계속 진행할게요.');
    _addOptionBtns(['소재 적용 완료', '다른 소재 선택', '소재 없이 진행'], async (selected) => {
      if (selected === '소재 적용 완료') {
        _collectSourceContent();
        if (!_sourceContent) {
          _addChatMsg('ai', '<span style="color:#ff3b30;">아직 적용된 소재가 없습니다. 검색 모달에서 적용하거나 직접 입력해주세요.</span>');
          _askSource();
          return;
        }
        await _moveToPurposeWithSource();
        return;
      }
      if (selected === '다른 소재 선택') {
        _askSource();
        return;
      }
      _sourceContent = '';
      window._sharedSourceContent = '';
      await _askPurpose();
    });
  }

  async function _moveToPurposeWithSource() {
    _collectSourceContent();
    const preview = _sourceContent.length > 240 ? `${_sourceContent.slice(0, 240)}...` : _sourceContent;
    const richPreview = _sourcePreviewHTML || (window._VAGSource?.sourceTextPreviewHTML
      ? window._VAGSource.sourceTextPreviewHTML('소재 반영 내용', _sourceContent)
      : `<br><span style="font-size:11px;color:rgba(0,0,0,0.42);">${_esc(preview)}</span>`);
    _addChatMsg('ai', `소재를 반영했습니다. (${_sourceContent.length}자)` + richPreview);
    _sourcePreviewHTML = '';
    await _askPurpose();
  }

  async function _onSourceSelected(selected) {
    if (selected === '소재 없이 진행') {
      _sourceContent = '';
      _sourcePreviewHTML = '';
      window._sharedSourceContent = '';
      await _askPurpose();
      return;
    }

    if (selected === '직접 입력') {
      _chatState = 'ask_source_text';
      _addChatMsg('ai', '반영할 소재 내용을 직접 입력해주세요.');
      const inputArea = document.getElementById('ce2-chat-input-area');
      if (inputArea) inputArea.style.display = 'block';
      document.getElementById('ce2-chat-input')?.focus();
      return;
    }

    if (selected === 'URL 가져오기') {
      _chatState = 'ask_source_url';
      _addChatMsg('ai', '가져올 URL을 입력해주세요.');
      const inputArea = document.getElementById('ce2-chat-input-area');
      if (inputArea) inputArea.style.display = 'block';
      document.getElementById('ce2-chat-input')?.focus();
      return;
    }

    if (selected === 'YouTube 분석') {
      _chatState = 'ask_source_youtube';
      _addChatMsg('ai', '분석할 YouTube URL을 입력해주세요.');
      const inputArea = document.getElementById('ce2-chat-input-area');
      if (inputArea) inputArea.style.display = 'block';
      document.getElementById('ce2-chat-input')?.focus();
      return;
    }

    if (selected === '파일 업로드') {
      _sourcePreviewHTML = '';
      ce2PickSourceFile();
      _askSourceCompletion();
      return;
    }

    if (selected === '뉴스 검색') {
      _sourcePreviewHTML = '';
      ce2OpenNewsSearchModal({ query: document.getElementById('ce2-topic-input')?.value || document.getElementById('ce2-topic')?.value || '' });
      _askSourceCompletion();
      return;
    }

    if (selected === '네이버 검색') {
      _sourcePreviewHTML = '';
      ce2OpenNaverSearchModal({ query: document.getElementById('ce2-topic-input')?.value || document.getElementById('ce2-topic')?.value || '' });
      _askSourceCompletion();
      return;
    }

  }

  async function _askPurpose() {
    _chatState = 'ask_purpose';
    _addChatMsg('ai', '<span style="color:rgba(0,0,0,0.3);font-size:11px;">AI가 목적을 추천 중...</span>');
    const topic = document.getElementById('ce2-topic').value;
    const purposes = await _apiAssist('purposes', { topic });
    const body = document.getElementById('ce2-chat-body');
    if (body && body.lastChild) body.removeChild(body.lastChild);
    const list = (purposes && purposes.length) ? purposes : PURPOSE_OPTIONS;
    _addOptionBtns(list, (selected) => _onPurposeSelected(selected));
  }

  function _onPurposeSelected(purpose) {
    document.getElementById('ce2-purpose').value = purpose;
    _chatState = 'ask_count';
    _addChatMsg('ai', `목적: <b>${purpose}</b><br><br>카드뉴스를 몇 장으로 만들까요?`);
    _addOptionBtns(['1장','2장','3장','4장','5장','6장','7장','8장'], (selected) => {
      const n = parseInt(selected);
      _selectedCount = n;
      _onCountSelected(n);
    });
  }

  function _parseCtaChoice(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    const normalized = raw.replace(/\s+/g, '');
    const yesWords = ['예', '네', '응', '어', '포함', '넣어', '넣기', '추가', '사용', 'yes', 'y', 'include', 'on', 'cta포함'];
    const noWords = ['아니오', '아니요', '아니', '빼줘', '빼기', '빼', '제외', '없음', '없이', 'no', 'n', 'exclude', 'off', 'cta제외'];
    if (yesWords.some(word => normalized.includes(word))) return true;
    if (noWords.some(word => normalized.includes(word))) return false;
    return null;
  }

  function _askCtaOption() {
    _chatState = 'ask_cta';
    _addChatMsg('ai', '마지막 카드에 CTA를 넣을까요?');
    _addOptionBtns(['포함', '빼기'], (selected) => _onCtaSelected(selected));
  }

  function _onCtaSelected(choice) {
    const parsed = typeof choice === 'boolean' ? choice : _parseCtaChoice(choice);
    _includeCta = parsed !== false;
    _addChatMsg('ai', `CTA: <b>${_includeCta ? '포함' : '제외'}</b><br><br>전략을 만들게요.`);
    _askStrategy();
  }

  /* ── 소재 입력 (직접입력 / URL / 파일) ── */
  let _sourceMode = 'text'; // text | url | file

  function ce2ToggleSource(mode) {
    _sourceMode = mode;
    ['text','news','naver','youtube','url','file','knowledge'].forEach(m => {
      const panel = document.getElementById('ce2-src-' + m);
      const btn = document.getElementById('ce2-src-btn-' + m);
      if (panel) panel.style.display = m === mode ? '' : 'none';
      if (btn) {
        btn.style.background = m === mode ? 'rgba(255,140,0,0.08)' : 'rgba(0,0,0,0.02)';
        btn.style.borderColor = m === mode ? 'rgba(255,140,0,0.2)' : 'rgba(0,0,0,0.08)';
        btn.style.color = m === mode ? '#ff8c00' : 'rgba(0,0,0,0.4)';
      }
    });
    // 뉴스/네이버 선택 시 바로 모달
    if (mode === 'news') ce2OpenNewsSearchModal();
    if (mode === 'naver') ce2OpenNaverSearchModal();
  }

  let _naverSearchItems = [];

  function ce2OpenNaverSearchModal(opts) {
    const existing = document.getElementById('ce2-naver-modal');
    if (existing) existing.remove();
    const modalOpts = (opts && typeof opts === 'object') ? opts : {};

    const modal = document.createElement('div');
    modal.id = 'ce2-naver-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:680px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden;" onclick="event.stopPropagation()">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:8px;background:#03c75a;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">N</div>
            <span style="font-size:14px;font-weight:700;color:#1c1c1e;">네이버 자료 조사</span>
          </div>
          <button onclick="document.getElementById('ce2-naver-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,0.06);cursor:pointer;font-size:14px;color:#666;display:flex;align-items:center;justify-content:center;">&times;</button>
        </div>
        <div style="padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;gap:8px;">
            <input type="text" id="ce2-naver-modal-query" placeholder="검색어 입력..." style="flex:1;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);outline:none;" onfocus="this.style.borderColor='#03c75a'" onblur="this.style.borderColor='rgba(0,0,0,0.08)'" onkeydown="if(event.key==='Enter'){event.preventDefault();ce2NaverSearch();}">
            <button onclick="ce2NaverSearch()" id="ce2-naver-modal-btn" style="padding:10px 20px;border-radius:10px;border:none;background:#03c75a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;">검색</button>
          </div>
        </div>
        <div id="ce2-naver-modal-results" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;min-height:200px;">
          <div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);font-size:13px;">검색어를 입력하고 검색 버튼을 눌러주세요</div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <span id="ce2-naver-modal-count" style="font-size:12px;color:rgba(0,0,0,0.4);">선택된 항목이 소재로 사용됩니다</span>
          <button onclick="ce2NaverApply()" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">선택 완료</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // 현재 활성 페이지의 topic을 기본 검색어로 사용하되, 호출자가 직접 검색어를 넘기면 그 값을 우선한다.
    const activePage = document.querySelector('.page.active')?.id || '';
    const hasProvidedQuery = typeof opts === 'string' || Object.prototype.hasOwnProperty.call(modalOpts, 'query');
    let topicVal = typeof opts === 'string' ? opts : (modalOpts.query || '');
    let autoSearch = modalOpts.autoSearch;
    if (!topicVal && !hasProvidedQuery) {
      if (activePage.includes('cardnews') || activePage.includes('ce2')) topicVal = (document.getElementById('ce2-topic-input')?.value || '').trim();
      else if (activePage.includes('blog')) topicVal = (document.getElementById('bag-topic')?.value || '').trim();
      else if (activePage.includes('sns')) topicVal = (document.getElementById('sag-topic')?.value || '').trim();
      else if (activePage.includes('video')) topicVal = (document.getElementById('vag-topic')?.value || '').trim();
      else if (activePage.includes('comic')) topicVal = (document.getElementById('cag-topic')?.value || '').trim();
    }
    if (autoSearch === undefined) autoSearch = !!topicVal;
    const qInput = document.getElementById('ce2-naver-modal-query');
    if (qInput && topicVal) {
      qInput.value = topicVal;
      if (autoSearch) ce2NaverSearch();
      else qInput.focus();
    }
    else if (qInput) qInput.focus();
  }

  async function ce2NaverSearch() {
    const queryInput = document.getElementById('ce2-naver-modal-query');
    const results = document.getElementById('ce2-naver-modal-results');
    const btn = document.getElementById('ce2-naver-modal-btn');
    const query = (queryInput?.value || '').trim();
    if (!query) return;
    if (btn) { btn.textContent = '검색 중...'; btn.disabled = true; }
    if (results) results.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">네이버에서 검색 중...</div>';
    _naverSearchItems = [];
    try {
      const resp = await fetch('/api/ce2/naver-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await resp.json();
      if (!resp.ok || data.ok === false) {
        throw new Error(data.error || '네이버 검색에 실패했습니다');
      }
      if (data.ok && data.items && data.items.length) {
        _naverSearchItems = data.items;
        results.innerHTML = '';
        data.items.forEach((item, idx) => {
          const itemUrl = String(item.url || item.link || '').trim();
          const row = document.createElement('label');
          row.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.04);background:rgba(0,0,0,0.01);cursor:pointer;transition:all 0.15s;';
          row.onmouseenter = () => { row.style.background = 'rgba(3,199,90,0.04)'; row.style.borderColor = 'rgba(3,199,90,0.2)'; };
          row.onmouseleave = () => { row.style.background = 'rgba(0,0,0,0.01)'; row.style.borderColor = 'rgba(0,0,0,0.04)'; };
          const srcBadge = item.source === '블로그' ? '<span style="padding:2px 6px;border-radius:4px;background:rgba(3,199,90,0.1);color:#03c75a;font-size:9px;font-weight:600;">블로그</span>'
            : '<span style="padding:2px 6px;border-radius:4px;background:rgba(0,122,255,0.1);color:#007aff;font-size:9px;font-weight:600;">뉴스</span>';
          row.innerHTML = `<input type="checkbox" data-nidx="${idx}" style="margin-top:3px;width:18px;height:18px;accent-color:#03c75a;" onchange="ce2NaverUpdateCount()"><div style="flex:1;min-width:0;"><div style="display:flex;gap:6px;align-items:center;margin-bottom:3px;">${srcBadge}<span style="font-size:13px;font-weight:600;color:#1c1c1e;">${item.title || ''}</span></div>${item.description ? `<div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.5;">${_esc(item.description)}</div>` : ''}${itemUrl ? `<div style="font-size:10px;color:#007aff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px;">${_esc(itemUrl)}</div>` : ''}</div>`;
          results.appendChild(row);
        });
        ce2NaverUpdateCount();
      } else {
        results.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">검색 결과가 없습니다</div>';
      }
    } catch (e) {
      if (results) results.innerHTML = `<div style="text-align:center;padding:30px;color:#ff3b30;">오류: ${e.message}</div>`;
    }
    if (btn) { btn.textContent = '검색'; btn.disabled = false; }
  }

  function ce2NaverUpdateCount() {
    const results = document.getElementById('ce2-naver-modal-results');
    const countEl = document.getElementById('ce2-naver-modal-count');
    if (!results || !countEl) return;
    const checked = results.querySelectorAll('input[type="checkbox"]:checked').length;
    const total = results.querySelectorAll('input[type="checkbox"]').length;
    countEl.textContent = `${checked}/${total}건 선택됨`;
  }

  async function ce2NaverApply() {
    const results = document.getElementById('ce2-naver-modal-results');
    if (!results) return;
    const countEl = document.getElementById('ce2-naver-modal-count');
    const selectedItems = [];
    results.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.nidx);
      const item = _naverSearchItems[idx];
      if (item) selectedItems.push(item);
    });
    if (!selectedItems.length) return;
    if (countEl) countEl.textContent = `선택한 ${selectedItems.length}건의 네이버 본문을 가져오는 중...`;
    const selectedSources = window._VAGSource && typeof window._VAGSource.scrapeSelectedSources === 'function'
      ? await window._VAGSource.scrapeSelectedSources(selectedItems, {
        minLength: 50,
        showProgressModal: true,
        onItemStart: (_item, idx, total) => {
          if (countEl) countEl.textContent = `네이버 본문 크롤링 중... ${idx + 1}/${total}`;
        },
      })
      : selectedItems.map(item => {
        const url = String(item.url || item.link || '').trim();
        const title = String(item.title || '').trim();
        const snippet = String(item.description || item.snippet || '').trim();
        return {
          title,
          snippet,
          url,
          link: url,
          source: item.source || '',
          type: item.type || (item.source === '뉴스' ? 'news' : 'blog'),
          checked: true,
          scrapedText: '',
          scrapedImages: [],
          scrapeStatus: 'source-client-missing',
          textBlock: [`[${title}]`, url ? `URL: ${url}` : '', snippet].filter(Boolean).join('\n'),
        };
      });
    const parts = selectedSources.map(source => source.textBlock || '').filter(Boolean);
    _sourceContent = parts.join('\n\n');
    window._sharedSourceContent = _sourceContent;
    window._sharedSelectedSources = selectedSources;
    const picked = _getActivePickedEl('naver');
    const crawledCount = selectedSources.filter(s => String(s.scrapedText || '').trim()).length;
    const imageCount = selectedSources.reduce((sum, s) => sum + (Array.isArray(s.scrapedImages) ? s.scrapedImages.length : 0), 0);
    if (picked) picked.innerHTML = `<span style="color:#34c759;">${parts.length}건 선택됨 (${selectedSources.filter(s => s.url).length}개 URL · 본문 ${crawledCount}건 · 이미지 ${imageCount}장 · ${_sourceContent.length}자)</span>`;
    const modal = document.getElementById('ce2-naver-modal');
    if (modal) modal.remove();
  }

  /* ── 자료 수집 모달 (공통) — 워크스페이스 풀 수집 방식 ── */
  let _newsSearchItems = [];

  /** 활성 페이지 기준으로 올바른 picked 요소 찾기 */
  function _getActivePickedEl(type) {
    const activePage = document.querySelector('.page.active')?.id || '';
    const prefixMap = {
      'cardnews': 'ce2', 'ce2': 'ce2',
      'blog': 'bag',
      'sns': 'sag',
      'video': 'vag',
      'comic': 'cag',
      'detailpage': 'dpag',
      'planner': 'pag',
    };
    for (const [key, prefix] of Object.entries(prefixMap)) {
      if (activePage.includes(key)) {
        return document.getElementById(`${prefix}-${type}-picked`);
      }
    }
    return document.getElementById('ce2-' + type + '-picked')
      || document.getElementById('bag-' + type + '-picked')
      || document.getElementById('sag-' + type + '-picked')
      || document.getElementById('vag-' + type + '-picked')
      || document.getElementById('cag-' + type + '-picked');
  }

  /** 소스 타입별 배지 HTML */
  function _newsTypeBadge(type) {
    const map = {
      news: { bg: 'rgba(255,59,48,0.1)', color: '#ff3b30', label: '뉴스' },
      blog: { bg: 'rgba(3,199,90,0.1)', color: '#03c75a', label: '블로그' },
      url: { bg: 'rgba(3,199,90,0.1)', color: '#03c75a', label: '블로그' },
      youtube: { bg: 'rgba(255,0,0,0.1)', color: '#ff0000', label: 'YouTube' },
    };
    const s = map[type] || { bg: 'rgba(0,0,0,0.06)', color: '#666', label: type || '기타' };
    return `<span style="padding:2px 6px;border-radius:4px;background:${s.bg};color:${s.color};font-size:9px;font-weight:600;flex-shrink:0;">${s.label}</span>`;
  }

  function ce2OpenNewsSearchModal(opts) {
    const existing = document.getElementById('ce2-news-modal');
    if (existing) existing.remove();
    const modalOpts = (opts && typeof opts === 'object') ? opts : {};
    const modal = document.createElement('div');
    modal.id = 'ce2-news-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:760px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden;" onclick="event.stopPropagation()">
        <div style="padding:16px 20px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;">S</div>
            <span style="font-size:14px;font-weight:700;color:#1c1c1e;">자료 수집</span>
            <span style="font-size:11px;color:rgba(0,0,0,0.3);">뉴스 + 블로그 검색</span>
          </div>
          <button onclick="document.getElementById('ce2-news-modal').remove()" style="width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,0.06);cursor:pointer;font-size:14px;">&times;</button>
        </div>
        <div style="padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="display:flex;gap:8px;">
            <input type="text" id="ce2-news-q" placeholder="검색어 입력..." style="flex:1;padding:10px 14px;font-size:14px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);outline:none;" onkeydown="if(event.key==='Enter'){event.preventDefault();ce2NewsSearch();}">
            <button onclick="ce2NewsSearch()" id="ce2-news-btn" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:14px;font-weight:600;cursor:pointer;">전체 수집</button>
          </div>
          <div id="ce2-news-related" style="display:none;margin-top:8px;"></div>
        </div>
        <div id="ce2-news-progress" style="display:none;padding:8px 20px;border-bottom:1px solid rgba(0,0,0,0.06);"></div>
        <div id="ce2-news-results" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:8px;min-height:200px;">
          <div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">검색어를 입력하면 뉴스·블로그를 한번에 수집합니다</div>
        </div>
        <div style="padding:12px 20px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;">
          <span id="ce2-news-count" style="font-size:12px;color:rgba(0,0,0,0.4);">선택한 자료의 본문을 가져와 소재로 사용합니다</span>
          <button id="ce2-news-apply-btn" onclick="ce2NewsApply()" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">선택 완료</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // 현재 활성 페이지의 topic을 기본 검색어로 사용하되, 호출자가 직접 검색어를 넘기면 그 값을 우선한다.
    const activePage = document.querySelector('.page.active')?.id || '';
    const hasProvidedQuery = typeof opts === 'string' || Object.prototype.hasOwnProperty.call(modalOpts, 'query');
    let topicVal = typeof opts === 'string' ? opts : (modalOpts.query || '');
    let autoSearch = modalOpts.autoSearch;
    if (!topicVal && !hasProvidedQuery) {
      if (activePage.includes('cardnews') || activePage.includes('ce2')) topicVal = (document.getElementById('ce2-topic-input')?.value || '').trim();
      else if (activePage.includes('blog')) topicVal = (document.getElementById('bag-topic')?.value || '').trim();
      else if (activePage.includes('sns')) topicVal = (document.getElementById('sag-topic')?.value || '').trim();
      else if (activePage.includes('video')) topicVal = (document.getElementById('vag-topic')?.value || '').trim();
      else if (activePage.includes('comic')) topicVal = (document.getElementById('cag-topic')?.value || '').trim();
    }
    if (autoSearch === undefined) autoSearch = !!topicVal;
    if (topicVal) {
      document.getElementById('ce2-news-q').value = topicVal;
      if (autoSearch) ce2NewsSearch();
      else document.getElementById('ce2-news-q')?.focus();
    }
    else document.getElementById('ce2-news-q')?.focus();
  }

  async function ce2NewsSearch() {
    const q = (document.getElementById('ce2-news-q')?.value || '').trim();
    if (!q) return;
    const btn = document.getElementById('ce2-news-btn');
    const results = document.getElementById('ce2-news-results');
    const progress = document.getElementById('ce2-news-progress');
    const relatedEl = document.getElementById('ce2-news-related');
    if (btn) { btn.textContent = '수집 중...'; btn.disabled = true; }
    _newsSearchItems = [];

    if (progress) {
      progress.style.display = 'block';
      progress.innerHTML = '<div style="display:flex;align-items:center;gap:6px;"><span class="spinner" style="width:14px;height:14px;flex-shrink:0;"></span><span style="font-size:12px;color:rgba(0,0,0,0.5);">트렌드 분석 + 뉴스·블로그 수집 중...</span></div>';
    }
    if (results) results.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.2);">자료를 수집하고 있습니다...</div>';

    try {
      // 워크스페이스와 동일한 /api/content/search 엔드포인트 호출 — 60초 타임아웃
      // (네이버·다음 다중 소스 스크래핑이 30초를 넘기는 경우가 있어 여유를 둠)
      const _searchAc = new AbortController();
      const _searchTimer = setTimeout(function () {
        try { _searchAc.abort(new DOMException('뉴스·블로그 검색 60초 타임아웃', 'TimeoutError')); }
        catch (_) { _searchAc.abort(); }
      }, 60000);
      let resp;
      try {
        resp = await fetch('/api/content/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: q }),
          signal: _searchAc.signal,
        });
      } finally {
        clearTimeout(_searchTimer);
      }
      const data = await resp.json();

      if (data.status === 'ok' && data.data) {
        const searchData = data.data;
        const sources = searchData.sources || [];
        const related = searchData.related_keywords || [];

        // 연관 키워드 표시
        if (related.length > 0 && relatedEl) {
          relatedEl.style.display = 'block';
          relatedEl.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
              <span style="font-size:10px;color:rgba(0,0,0,0.3);margin-right:4px;">연관:</span>
              ${related.map(k => `<button onclick="document.getElementById('ce2-news-q').value='${_esc(k)}';ce2NewsSearch();" style="padding:3px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.15);background:rgba(255,140,0,0.05);color:#ff8c00;font-size:10px;cursor:pointer;">${_esc(k)}</button>`).join('')}
            </div>`;
        } else if (relatedEl) {
          relatedEl.style.display = 'none';
        }

        // 소스를 뉴스/블로그로 분류 (YouTube는 별도 탭에서 처리)
        const news = sources.filter(s => s.type === 'news');
        const blogs = sources.filter(s => s.type === 'blog' || s.type === 'url');
        const others = sources.filter(s => !['news','blog','url','youtube'].includes(s.type));
        const allSorted = [...news, ...blogs, ...others];

        _newsSearchItems = allSorted.map(s => ({
          title: s.title || '',
          description: s.snippet || s.description || '',
          link: s.url || s.link || '',
          source: s.press || s.channel || '',
          date: s.date || '',
          type: s.type || 'news',
        }));

        if (_newsSearchItems.length) {
          results.innerHTML = '';
          let currentSection = '';
          _newsSearchItems.forEach((item, idx) => {
            const section = (item.type === 'blog' || item.type === 'url') ? 'blog' : 'news';
            if (section !== currentSection) {
              currentSection = section;
              const sectionLabels = { news: { label: '뉴스', color: '#ff3b30' }, blog: { label: '블로그', color: '#03c75a' } };
              const sl = sectionLabels[section] || { label: section, color: '#666' };
              const count = _newsSearchItems.filter(i => { const t = (i.type === 'blog' || i.type === 'url') ? 'blog' : 'news'; return t === section; }).length;
              const sectionEl = document.createElement('div');
              sectionEl.style.cssText = `font-size:11px;font-weight:700;color:${sl.color};margin:${idx > 0 ? '12px' : '0'} 0 4px;display:flex;align-items:center;gap:6px;`;
              sectionEl.innerHTML = `${sl.label} <span style="font-weight:400;color:rgba(0,0,0,0.3);">${count}건</span>`;
              results.appendChild(sectionEl);
            }
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.04);background:rgba(0,0,0,0.01);cursor:pointer;transition:all 0.15s;';
            label.onmouseenter = () => { label.style.background = 'rgba(255,140,0,0.04)'; };
            label.onmouseleave = () => { label.style.background = 'rgba(0,0,0,0.01)'; };
            const dateStr = item.date ? new Date(item.date).toLocaleDateString('ko-KR') : '';
            label.innerHTML = `
              <input type="checkbox" data-nidx="${idx}" style="margin-top:3px;width:18px;height:18px;accent-color:#ff8c00;flex-shrink:0;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:2px;">
                  ${_newsTypeBadge(item.type)}
                  <span style="font-size:13px;font-weight:600;color:#1c1c1e;">${item.title || ''}</span>
                </div>
                ${item.description ? `<div style="font-size:11px;color:rgba(0,0,0,0.5);line-height:1.4;">${_esc(item.description)}</div>` : ''}
                <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-top:2px;">${_esc(item.source || '')} ${dateStr}</div>
              </div>`;
            results.appendChild(label);
          });
        } else {
          results.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">검색 결과 없음</div>';
        }

        if (progress) {
          progress.innerHTML = `<div style="font-size:12px;color:#34c759;font-weight:600;">수집 완료 — 뉴스 ${news.length}건 · 블로그 ${blogs.length}건 (총 ${allSorted.length}건)</div>`;
          setTimeout(() => { if (progress) progress.style.display = 'none'; }, 5000);
        }
      } else {
        results.innerHTML = `<div style="text-align:center;padding:30px;color:rgba(0,0,0,0.3);">검색 결과 없음${data.detail ? ': ' + _esc(String(data.detail)) : ''}</div>`;
        if (progress) progress.style.display = 'none';
      }
    } catch (e) {
      if (results) results.innerHTML = `<div style="color:#ff3b30;padding:20px;">${_esc(e.message)}</div>`;
      if (progress) progress.style.display = 'none';
    }
    if (btn) { btn.textContent = '전체 수집'; btn.disabled = false; }
  }

  async function ce2NewsApply() {
    const results = document.getElementById('ce2-news-results');
    if (!results) return;
    const checked = results.querySelectorAll('input[type="checkbox"]:checked');
    if (!checked.length) { document.getElementById('ce2-news-modal')?.remove(); return; }
    const countEl = document.getElementById('ce2-news-count');
    const applyBtn = document.getElementById('ce2-news-apply-btn');
    if (applyBtn) { applyBtn.disabled = true; applyBtn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:4px;"></span>본문 수집 중...'; }

    const parts = [];
    const total = checked.length;

    for (let i = 0; i < total; i++) {
      const cb = checked[i];
      const idx = parseInt(cb.dataset.nidx);
      const item = _newsSearchItems[idx];
      if (!item) continue;

      let body = item.description || '';
      const tryUrl = item.link || '';
      const scrapeTitle = (item.title || '').replace(/\s*[-\u2013\u2014|·]\s*\S+\s*$/, '').trim();

      if (countEl) countEl.innerHTML = `<b>${i + 1}/${total}</b> 수집 중: ${_esc(scrapeTitle.slice(0, 25))}`;

      // 스크래핑 실패 원인 로그 — 디버깅용
      window._newsScrapeLog = window._newsScrapeLog || [];
      var _scrapeLog = { idx: i + 1, url: tryUrl, title: scrapeTitle.slice(0, 40), method: '', reason: '', chars: 0 };

      // 백엔드가 이미 5단계 폴백(Lightpanda → requests → Chrome Extension → Electron CDP → Chrome CDP)
      // 을 내부에서 돌리므로 프론트는 한 번만 호출. 공용 _VAGSource.scrapeArticle 이 45초 타임아웃 +
      // AbortController reason + 응답 정규화까지 담당.
      if (tryUrl) {
        const res = await window._VAGSource.scrapeArticle(tryUrl, { title: scrapeTitle, minLength: 100 });
        if (res.ok) {
          body = res.text;
          _scrapeLog.method = res.method || 'backend';
          _scrapeLog.chars = res.text.length;
          if (countEl) {
            countEl.innerHTML = `<b>${i + 1}/${total}</b> <span style="color:#34c759;">✓ ${_esc(res.method || 'ok')}</span> ${_esc(scrapeTitle.slice(0, 22))} · ${res.text.length}자`;
          }
        } else {
          _scrapeLog.reason = res.error + (res.method ? ' · method=' + res.method : '') + (res.text ? ' · len=' + res.text.length : '');
        }
      }

      window._newsScrapeLog.push(_scrapeLog);
      if (!body || body.length < 100) {
        console.warn('[ce2-news] 스크래핑 실패:', _scrapeLog);
      }

      if (countEl) {
        if (body.length > 100) {
          countEl.innerHTML = `<b>${i + 1}/${total}</b> <span style="color:#34c759;">✓ ${_esc(_scrapeLog.method || 'ok')}</span> · ${body.length}자 · ${_esc(scrapeTitle.slice(0, 20))}`;
        } else {
          countEl.innerHTML = `<b>${i + 1}/${total}</b> <span style="color:#ff9500;" title="${_esc(_scrapeLog.reason || '')}">⚠ 설명만</span> · ${_esc(scrapeTitle.slice(0, 20))}`;
        }
      }
      // body 가 실제 본문(> 100자) 일 때만 parts 에 담는다. 짧은 RSS snippet·빈 값이면 제외.
      // 이렇게 해야 "제목만 줄줄이 쌓여 _sharedSourceContent 가 30자를 넘어 완료로 보이는" 버그 방지.
      const fallbackMaterial = [item.title, item.description].filter(Boolean).join('\n').trim();
      if (body && body.length > 100) {
        parts.push('[' + item.title + ']\n' + body);
      } else if (fallbackMaterial.length >= 12) {
        parts.push('[' + item.title + ']\n' + fallbackMaterial);
      }
    }

    // 전체 스크래핑 로그를 콘솔에 요약 — 실패율 파악 쉬움
    var _logs = window._newsScrapeLog || [];
    var _success = _logs.filter(function (l) { return l.chars >= 100; }).length;
    var _fail = _logs.length - _success;
    console.info('[ce2-news] 스크래핑 요약 — 성공 ' + _success + ' / 실패 ' + _fail + ' / 총 ' + _logs.length);
    if (_fail > 0) { try { console.table(_logs.filter(function (l) { return l.chars < 100; })); } catch (_) {} }

    // 본문이 하나도 없으면 (모두 설명만이거나 전부 실패) — 사용자에게 명시적 실패 피드백
    if (!parts.length) {
      var _detail = _logs.slice(0, 3).map(function (l) { return '• ' + (l.title || '(제목 없음)') + ' → ' + (l.reason || '사유 없음'); }).join('\n');
      if (countEl) countEl.innerHTML = '<span style="color:#ff3b30;font-weight:700;">❌ 본문 수집 실패 — 0건 완료</span>';
      // 모달 자동 닫기 방지 · 사용자가 재검색하도록 에러 표시
      if (results) {
        var errorEl = document.createElement('div');
        errorEl.style.cssText = 'margin-top:8px;padding:12px;background:rgba(255,59,48,0.06);border:1px solid rgba(255,59,48,0.18);border-radius:8px;font-size:11px;color:#b42318;line-height:1.5;';
        errorEl.innerHTML = '<div style="font-weight:700;margin-bottom:4px;">❌ 선택한 ' + total + '개 기사 중 본문을 가져온 게 0건입니다.</div>' +
          '<div style="white-space:pre-wrap;color:rgba(0,0,0,0.65);">' + _esc(_detail) + '</div>' +
          '<div style="margin-top:6px;color:rgba(0,0,0,0.5);">다른 키워드로 재검색하거나, URL 직접 입력으로 시도해주세요. 자세한 로그는 개발자 콘솔 F12 에 있습니다.</div>';
        results.appendChild(errorEl);
      }
      if (applyBtn) { applyBtn.disabled = false; applyBtn.innerHTML = '선택 완료'; }
      window._sharedSourceContent = '';  // 완료 신호 미발사 — 소재 없음으로 처리
      return;  // 모달 유지, 함수 종료 (_sharedSourceContent 비어있음 → 뉴스 버튼은 "취소됨" 으로 감지)
    }
    _sourceContent = parts.join('\n\n---\n\n');
    window._sharedSourceContent = _sourceContent;

    // 모달 닫기
    document.getElementById('ce2-news-modal')?.remove();

    // 활성 페이지 기준으로 올바른 picked 요소 찾기
    const picked = _getActivePickedEl('news');
    if (picked) {
      const successCount = parts.filter(p => p.length > 150).length;
      const preview = _sourceContent.length > 200 ? _sourceContent.slice(0, 200) + '...' : _sourceContent;
      const fid = 'news-preview-' + Date.now();
      picked.innerHTML = `
        <div style="margin-top:6px;">
          <div style="font-size:11px;color:#34c759;font-weight:600;margin-bottom:4px;">${successCount}/${parts.length}건 수집 완료 (${_sourceContent.length}자)</div>
          <div style="background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.1);border-radius:8px;padding:8px 10px;font-size:11px;line-height:1.5;color:rgba(0,0,0,0.5);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-weight:600;color:rgba(0,0,0,0.4);">수집된 소재</span>
              <button onclick="var f=document.getElementById('${fid}');if(f){f.style.display=f.style.display==='none'?'block':'none';this.textContent=f.style.display==='none'?'전체보기':'접기'}" style="padding:2px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.15);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;cursor:pointer;">전체보기</button>
            </div>
            <div style="color:rgba(0,0,0,0.4);">${_esc(preview)}</div>
            <div id="${fid}" style="display:none;margin-top:6px;white-space:pre-wrap;max-height:250px;overflow-y:auto;border-top:1px solid rgba(0,0,0,0.06);padding-top:6px;">${_esc(_sourceContent)}</div>
          </div>
        </div>`;
    }
  }

  async function ce2FetchYoutube() {
    const urlInput = document.getElementById('ce2-youtube-url');
    const status = document.getElementById('ce2-yt-status');
    const btn = document.getElementById('ce2-yt-fetch-btn');
    const url = (urlInput?.value || '').trim();
    if (!url) { if (status) status.textContent = 'YouTube URL을 입력하세요'; return; }
    if (btn) { btn.textContent = '분석 중...'; btn.disabled = true; }
    if (status) status.innerHTML = '영상 내용을 분석 중... <span style="color:rgba(0,0,0,0.25);">(시간이 걸릴 수 있습니다)</span>';
    try {
      const data = await window._VAGSource.analyzeYouTube(url);
      if (data.ok && data.text) {
        _sourceContent = data.text;
        _sourcePreviewHTML = window._VAGSource.youtubeAnalysisPreviewHTML(data);
        if (status) status.innerHTML = `<span style="color:#34c759;">분석 완료 (${data.text.length}자)</span>` + window._VAGSource.youtubeAnalysisPreviewHTML(data);
      } else {
        if (status) status.innerHTML = `<span style="color:#ff3b30;">${_esc(data.error || '분석 실패')}</span>`;
      }
    } catch (e) {
      if (status) status.innerHTML = `<span style="color:#ff3b30;">오류: ${e.message}</span>`;
    }
    if (btn) { btn.textContent = '분석'; btn.disabled = false; }
  }

  async function ce2FetchUrl() {
    const urlInput = document.getElementById('ce2-source-url');
    const status = document.getElementById('ce2-url-status');
    const btn = document.getElementById('ce2-url-fetch-btn');
    const url = (urlInput?.value || '').trim();
    if (!url) { if (status) status.textContent = 'URL을 입력하세요'; return; }
    if (btn) { btn.textContent = '가져오는 중...'; btn.disabled = true; }
    if (status) status.textContent = '페이지 내용을 추출 중...';
    try {
      const resp = await fetch('/api/ce2/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (data.ok && data.text) {
        _sourceContent = data.text;
        const preview = data.text.length > 100 ? data.text.slice(0, 100) + '...' : data.text;
        if (status) status.innerHTML = `<span style="color:#34c759;">가져옴 (${data.text.length}자)</span> — ${_esc(preview)}`;
      } else {
        if (status) status.innerHTML = `<span style="color:#ff3b30;">실패: ${_esc(data.error || '내용을 추출할 수 없습니다')}</span>`;
      }
    } catch (e) {
      if (status) status.innerHTML = `<span style="color:#ff3b30;">오류: ${e.message}</span>`;
    }
    if (btn) { btn.textContent = '가져오기'; btn.disabled = false; }
  }

  function ce2PickSourceFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.html,.htm,.docx,.doc,.pdf,.csv,.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('ce2-file-status');
      if (status) status.textContent = `${file.name} 읽는 중...`;
      try {
        // 먼저 텍스트로 직접 읽어보기
        let directRead = false;
        if (/\.(txt|md|html|htm|csv|json)$/i.test(file.name) || file.type.startsWith('text/')) {
          try {
            const text = await file.text();
            let clean = text;
            if (/\.html?$/i.test(file.name)) {
              const tmp = document.createElement('div');
              tmp.innerHTML = text;
              clean = tmp.innerText || tmp.textContent || text;
            }
            if (clean.trim().length > 10) {
              _sourceContent = clean.trim();
              const preview = _sourceContent.length > 100 ? _sourceContent.slice(0, 100) + '...' : _sourceContent;
              if (status) status.innerHTML = `<span style="color:#34c759;">${_esc(file.name)} (${_sourceContent.length}자)</span> — ${_esc(preview)}`;
              directRead = true;
            }
          } catch (readErr) { /* 직접 읽기 실패 → 서버로 */ }
        }
        if (!directRead) {
          // 서버에서 처리 (docx, pdf 등)
          const formData = new FormData();
          formData.append('file', file);
          const resp = await fetch('/api/ce2/parse-file', { method: 'POST', body: formData });
          const data = await resp.json();
          if (data.ok && data.text) {
            _sourceContent = data.text;
            const preview = data.text.length > 100 ? data.text.slice(0, 100) + '...' : data.text;
            if (status) status.innerHTML = `<span style="color:#34c759;">${_esc(file.name)} (${data.text.length}자)</span> — ${_esc(preview)}`;
          } else {
            if (status) status.innerHTML = `<span style="color:#ff3b30;">파싱 실패: ${_esc(data.error || '')}</span>`;
          }
        }
      } catch (err) {
        if (status) status.innerHTML = `<span style="color:#ff3b30;">읽기 실패: ${err.message}</span>`;
      }
    };
    input.click();
  }

  function _collectSourceContent() {
    if (_sourceMode === 'text') {
      const el = document.getElementById('ce2-source-text');
      _sourceContent = (el?.value || '').trim();
    }
    // 공유 소재 (뉴스/네이버 검색 모달에서 저장됨)
    if (!_sourceContent && window._sharedSourceContent) {
      _sourceContent = window._sharedSourceContent;
    }
    console.log('[CE2] collectSource — mode:', _sourceMode, 'length:', _sourceContent?.length || 0);
    return _sourceContent;
  }

  // 슬라이드별 참조 이미지 (인덱스 → {src, name} 또는 null)
  let _slideRefImages = [];

  function _onCountSelected(count) {
    _slideRefImages = new Array(count).fill(null);
    _addChatMsg('ai', `${count}장으로 진행할게요.`);
    _askCtaOption();
  }

  function _pickRefImageForSlide(slideIdx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      _slideRefImages[slideIdx] = { src: '', url: '', name: file.name, uploading: true };
      _renderRefSlot(slideIdx);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const current = _slideRefImages[slideIdx] || {};
        _slideRefImages[slideIdx] = { ...current, src: ev.target.result, name: file.name };
        _renderRefSlot(slideIdx);
      };
      reader.readAsDataURL(file);
      try {
        const url = await _ce2UploadReferenceFile(file);
        const current = _slideRefImages[slideIdx] || {};
        _slideRefImages[slideIdx] = { ...current, url, uploading: false };
        _renderRefSlot(slideIdx);
      } catch (err) {
        const current = _slideRefImages[slideIdx] || {};
        _slideRefImages[slideIdx] = { ...current, uploading: false, error: err.message || '업로드 실패' };
        _renderRefSlot(slideIdx);
      }
    };
    input.click();
  }

  function _renderRefSlot(slideIdx) {
    const slot = document.querySelector(`.ce2-ref-slot[data-si="${slideIdx}"]`);
    if (!slot) return;
    const img = _slideRefImages[slideIdx];
    if (img) {
      const preview = img.src || img.url || '';
      slot.innerHTML = preview
        ? `<img src="${preview}" style="width:100%;height:100%;object-fit:cover;">${img.uploading ? '<span style="position:absolute;inset:auto 2px 2px 2px;padding:1px 3px;border-radius:4px;background:rgba(0,0,0,0.55);color:#fff;font-size:8px;text-align:center;">업로드</span>' : ''}`
        : '<span style="font-size:10px;color:rgba(255,140,0,0.65);">업로드</span>';
      if (img.error) slot.title = img.error;
      const clearBtn = slot.parentElement.querySelector('.ce2-ref-clear');
      if (clearBtn) clearBtn.style.display = 'inline';
    } else {
      slot.innerHTML = '<span style="font-size:14px;color:rgba(255,140,0,0.4);">+</span>';
      const clearBtn = slot.parentElement.querySelector('.ce2-ref-clear');
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }

  function _ce2ProfileID() {
    return parseInt(window._globalProfileId || 0, 10) || 0;
  }

  function _ce2LogoEnabled() {
    try {
      return !!(
        typeof getOpt === 'function' &&
        getOpt('logo_insert', false) &&
        _brandLogoUrl
      );
    } catch {
      return false;
    }
  }

  function _ce2ResolveCardnewsImageUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
    const path = value.startsWith('/api/') ? value : '/api/cardnews/image/' + value;
    if (path.includes('%')) return path;
    return path.split('/').map((part, idx) => idx <= 2 ? part : encodeURIComponent(part)).join('/');
  }

  function _ce2ImageModelLabel(data) {
    const provider = String(data?.image_provider || data?.provider || '').trim();
    const model = String(data?.image_model || data?.model || '').trim();
    if (!provider && !model) return '이미지 모델: 설정값 사용';
    return `이미지 모델: ${provider || '설정'} · ${model || '설정'}`;
  }

  function _ce2FallbackCaption(industry, topic) {
    const cleanTopic = String(topic || industry || '카드뉴스').replace(/\s+/g, ' ').trim();
    const summary = _strategyFlow
      .slice(0, 4)
      .map(item => [item?.title || '', item?.body || ''].join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 240)
      .trim();
    const tags = cleanTopic
      .replace(/[^\w가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .map(tag => '#' + tag);
    return [cleanTopic, summary, ['#카드뉴스', ...tags].join(' ')].filter(Boolean).join('\n\n');
  }

  function _ce2VideoModelLabel(data) {
    const model = String(data?.model || data?.video_model || data?.engine || '슬라이드 영상 엔진').trim();
    return `영상 모델/엔진: ${model}`;
  }

  function _ce2DefaultRole(index) {
    if (index === 0) return '표지';
    if (index === _selectedCount - 1) return _includeCta ? 'CTA' : '마무리 요약';
    return ['문제 제기', '핵심 정보', '상세 설명', '신뢰 근거', '차별점'][Math.max(0, index - 1) % 5];
  }

  function _ce2SlideFromStrategy(item, index) {
    const title = String(item?.title || item?.role || `슬라이드 ${index + 1}`).trim();
    const body = String(item?.body || '').trim();
    const role = String(item?.role || _ce2DefaultRole(index)).trim();
    const visualPrompt = String(item?.imageHint || item?.visual_prompt || item?.visualPrompt || '').trim()
      || [role, title, body, '카드뉴스용 정사각형 완성 이미지, 제목과 본문은 이미지 안에 읽기 좋은 한국어 타이포그래피로 배치'].filter(Boolean).join('. ');
    return {
      slide_number: index + 1,
      title,
      body,
      role,
      visual_prompt: visualPrompt,
    };
  }

  function _ce2ReferenceURLForSlide(index, explicitRef = null) {
    const candidate = explicitRef || _slideRefImages[index] || {};
    const url = String(candidate.url || '').trim();
    if (url) return url;
    const src = String(candidate.src || candidate || '').trim();
    if (src && !src.startsWith('data:')) return src;
    const strategyImageUrl = String(_strategyFlow[index]?.userImageUrl || '').trim();
    if (strategyImageUrl) return strategyImageUrl;
    const strategyImage = String(_strategyFlow[index]?.userImage || '').trim();
    if (strategyImage && !strategyImage.startsWith('data:')) return strategyImage;
    return '';
  }

  async function _ce2GenerateCardnewsTexts(industry, topic, purpose) {
    const keyword = topic || _brandName || industry || '카드뉴스';
    const resp = await fetch('/api/cardnews/generate-texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword,
        topic: keyword,
        cardnews_slides: _selectedCount,
        count: _selectedCount,
        cardnews_style: 'ai-auto',
        scraped_texts: _sourceContent ? [_sourceContent] : [],
        body: _sourceContent || '',
        brand_name: _brandName,
        brand_description: [_brandDesc, _brandBizDetail].filter(Boolean).join('\n\n'),
        brand_color: _brandColor,
        brand_logo_url: _brandLogoUrl,
        contact_info: _brandContact,
        business_goal: purpose,
        include_cta: _includeCta,
        profile_id: _ce2ProfileID(),
      }),
    });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || '카드뉴스 문구 생성 실패');
    return data;
  }

  async function _ce2GenerateSlideImage(slide, index, refImage) {
    const topic = document.getElementById('ce2-topic')?.value || _brandName || '카드뉴스';
    const prevImage = (index > 0 && _slides[index - 1]?.imageUrl) ? _slides[index - 1].imageUrl : '';
    const logoEnabled = _ce2LogoEnabled();
    const body = {
      slide,
      topic,
      style: 'modern',
      aspect_ratio: '1:1',
      project_dir: _cardnewsProjectDir || '',
      cardnews_id: _cardnewsID || null,
      brand_name: _brandName,
      brand_color: _brandColor,
      brand_logo_url: _brandLogoUrl,
      logo_enabled: logoEnabled,
      logo_text: '',
      image_provider: '',
      image_model: '',
      profile_id: _ce2ProfileID(),
      use_profile_design_ref: true,
      slide_count: _selectedCount,
      prev_image_url: prevImage,
    };
    const referenceURL = _ce2ReferenceURLForSlide(index, refImage);
    if (referenceURL) {
      body.user_image_url = referenceURL;
      body.user_image_urls = [referenceURL];
    }
    const resp = await fetch('/api/cardnews/generate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok || data.error || !data.image_url) throw new Error(data.error || '이미지 생성 실패');
    _cardnewsProjectDir = data.project_dir || _cardnewsProjectDir;
    _cardnewsID = data.cardnews_id || _cardnewsID;
    return { url: _ce2ResolveCardnewsImageUrl(data.image_url), modelLabel: _ce2ImageModelLabel(data) };
  }

  async function _askStrategy() {
    _chatState = 'strategy';
    const industry = document.getElementById('ce2-industry').value || '';
    const topic = document.getElementById('ce2-topic').value || '';
    const purpose = document.getElementById('ce2-purpose').value || '';

    // ── 카드뉴스 문구 생성 ──
    // 소재 최종 수집
    if (!_sourceContent && window._sharedSourceContent) _sourceContent = window._sharedSourceContent;
    console.log('[CE2] strategy — source_content length:', _sourceContent?.length || 0, 'topic:', topic);
    _addChatMsg('ai', '카드뉴스 문구를 만들고 있습니다...');
    _cardnewsProjectDir = '';
    _cardnewsID = null;
    _strategyFlow = [];
    try {
      const data = await _ce2GenerateCardnewsTexts(industry, topic, purpose);
      const generatedSlides = Array.isArray(data.slides) ? data.slides : (Array.isArray(data.texts) ? data.texts : []);
      _cardnewsProjectDir = data.project_dir || '';
      _cardnewsID = data.cardnews_id || null;
      if (generatedSlides.length) {
        _strategyFlow = generatedSlides.slice(0, _selectedCount).map((slide, idx) => ({
          role: slide.role || slide.type || _ce2DefaultRole(idx),
          title: slide.title || slide.heading || slide.headline || '',
          body: slide.body || slide.content || slide.copy || '',
          imageHint: slide.visual_prompt || slide.image_prompt || '',
        }));
      }
    } catch (e) {
      console.error('cardnews text error:', e);
      _addChatMsg('ai', `<span style="color:#ff9500;">문구 생성 API가 실패해 기본 구성으로 이어갑니다. ${_esc(e.message || '')}</span>`);
    }
    // 폴백
    if (!_strategyFlow.length) {
      const roles = ['히어로 표지','핵심 정보','상세 설명','차별점','사회적 증거','CTA'];
      for (let i = 0; i < _selectedCount; i++) _strategyFlow.push({ role: roles[i % roles.length], title: '', body: '', imageHint: '' });
    }

    if (!_includeCta && _strategyFlow.length) {
      const last = _strategyFlow[_strategyFlow.length - 1];
      if (last) {
        if (!last.role || /cta|문의|방문|예약|구매|신청|상담/i.test(last.role)) last.role = '마무리 요약';
        if (/(문의|방문|예약|구매|신청|상담|지금|클릭|연락)/.test(last.title || '')) last.title = topic || '핵심 요약';
        if (/(문의|예약|구매|신청|상담|지금|클릭|연락|방문하기|방문하세요|방문해\s*보세요|방문\s*예약)/.test(last.body || '')) last.body = `${topic || '주제'}의 핵심 내용을 한눈에 정리했습니다.`;
      }
    }

    // ── 문구 확인 카드 + 슬라이드별 참조 이미지 업로드 ──
    _addChatMsg('ai', '<b>문구를 확인해주세요.</b><br><span style="font-size:11px;color:rgba(0,0,0,0.4);">수정할 문구가 있으면 고친 뒤 아래 <b>확인하고 이미지 생성 시작</b>을 눌러주세요.</span>');
    const chatBody = document.getElementById('ce2-chat-body');
    if (chatBody) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:4px 0;';
      _strategyFlow.forEach((item, i) => {
        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:10px;padding:10px;display:flex;gap:10px;align-items:flex-start;';

        // 참조 이미지 슬롯 (왼쪽)
        const refCol = document.createElement('div');
        refCol.style.cssText = 'flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;';
        const slot = document.createElement('div');
        slot.className = 'ce2-ref-slot';
        slot.dataset.si = i;
        slot.style.cssText = 'width:56px;height:56px;border-radius:8px;border:2px dashed rgba(255,140,0,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color 0.15s;';
        slot.innerHTML = '<span style="font-size:20px;color:rgba(255,140,0,0.35);">+</span>';
        slot.onmouseenter = () => { if (!_slideRefImages[i]) slot.style.borderColor = 'rgba(255,140,0,0.6)'; };
        slot.onmouseleave = () => { slot.style.borderColor = _slideRefImages[i] ? '#ff8c00' : 'rgba(255,140,0,0.3)'; };
        slot.onclick = () => _pickRefImageForSlide(i);
        refCol.appendChild(slot);
        // 해제 버튼
        const clearBtn = document.createElement('button');
        clearBtn.className = 'ce2-ref-clear';
        clearBtn.dataset.si = i;
        clearBtn.style.cssText = 'display:none;font-size:9px;color:rgba(0,0,0,0.3);background:none;border:none;cursor:pointer;padding:0;';
        clearBtn.textContent = '해제';
        clearBtn.onclick = (e) => { e.stopPropagation(); _slideRefImages[i] = null; _renderRefSlot(i); };
        refCol.appendChild(clearBtn);
        card.appendChild(refCol);

        // 텍스트 영역 (오른쪽)
        const textCol = document.createElement('div');
        textCol.style.cssText = 'flex:1;min-width:0;';
        textCol.innerHTML = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;"><span style="width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</span><span style="font-size:10px;font-weight:700;color:#ff8c00;">${_esc(item.role)}</span></div><input type="text" value="${_esc(item.title || '')}" placeholder="제목" data-si="${i}" data-sf="title" style="width:100%;padding:5px 8px;font-size:13px;font-weight:700;border:1px solid rgba(0,0,0,0.06);border-radius:6px;background:rgba(0,0,0,0.02);outline:none;margin-bottom:4px;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'"><textarea rows="2" placeholder="본문" data-si="${i}" data-sf="body" style="width:100%;padding:5px 8px;font-size:11px;border:1px solid rgba(0,0,0,0.06);border-radius:6px;background:rgba(0,0,0,0.02);outline:none;resize:none;line-height:1.5;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">${_esc(item.body || '')}</textarea>`;
        card.appendChild(textCol);
        wrap.appendChild(card);
      });
      wrap.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.si); const f = e.target.dataset.sf;
        if (!isNaN(i) && f && _strategyFlow[i]) _strategyFlow[i][f] = e.target.value;
      });
      chatBody.appendChild(wrap);
      chatBody.scrollTop = chatBody.scrollHeight;
      _scrollAssistIntoView();
    }

    // ── 확인 → 이미지 생성 ──
    await new Promise(resolve => {
      _addOptionBtns(['확인하고 이미지 생성 시작'], () => resolve());
    });

    // 슬라이드 렌더 (문구 적용)
    ce2AiGenerate();

    // ── 한 장씩 이미지 생성 ──
    _addChatMsg('ai', `이미지를 한 장씩 생성합니다. (${_selectedCount}장)`);
    for (let i = 0; i < _selectedCount; i++) {
      const item = _strategyFlow[i] || {};
      const n = i + 1;
      const refImage = _slideRefImages[i] || null;

      if (_slides[i] && !_slides[i].imageUrl) {
        _addChatMsg('ai', `<b>${n}장</b> 이미지 생성 중...`);
        let imgOk = false;
        for (let attempt = 0; attempt < 2 && !imgOk; attempt++) {
          try {
            if (attempt > 0) _addChatMsg('ai', `<b>${n}장</b> 재시도 중... (${attempt + 1}/2)`);
            const imageResult = await _ce2GenerateSlideImage(_ce2SlideFromStrategy(item, i), i, refImage);
            if (_slides[i]) { _slides[i].imageUrl = imageResult.url; _slides[i].modelLabel = imageResult.modelLabel; imgOk = true; }
          } catch (e) {
            console.error(`slide ${n} img err:`, e);
            _addChatMsg('ai', `<span style="color:#ff3b30;">${n}장 생성 오류: ${_esc(e.message)}</span>`);
          }
        }
        _renderSlides(_slides);
      }
      _addChatMsg('ai', _slides[i]?.imageUrl ? `<b>${n}장 완료!</b><br><span style="font-size:11px;color:rgba(0,0,0,0.45);">${_esc(_slides[i].modelLabel || _ce2ImageModelLabel())}</span>` : `<span style="color:#ff3b30;"><b>${n}장 생성 실패</b> — 나중에 재생성하세요</span>`);
    }

    _updateSummary();
    // 자동 저장 + 히스토리 갱신
    await ce2SaveAndOpenFolder(true);
    ce2HistoryInit();
    _addChatMsg('ai', `<b>카드뉴스 ${_selectedCount}장 생성 완료!</b> 자동 저장되었습니다.<br><span style="font-size:11px;color:rgba(0,0,0,0.45);">${_esc(_slides.find(s => s.modelLabel)?.modelLabel || _ce2ImageModelLabel())}</span>`);

    // 캡션 자동 생성
    _addChatMsg('ai', '캡션을 생성 중...');
    let captionText = '';
    try {
      const capResp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'caption', industry, topic, platform: 'instagram' }),
      });
      const capData = await capResp.json();
      if (capData.ok && capData.caption) captionText = capData.caption;
    } catch (e) { console.warn('caption generation failed:', e); }
    if (!captionText) captionText = _ce2FallbackCaption(industry, topic);

    // 채팅에 캡션 표시 (수정 + 복사 가능)
    const chatBody2 = document.getElementById('ce2-chat-body');
    if (chatBody2) {
      // 마지막 로딩 메시지 제거
      if (chatBody2.lastChild) chatBody2.removeChild(chatBody2.lastChild);
      const capWrap = document.createElement('div');
      capWrap.style.cssText = 'padding:8px 0;';
      capWrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);">SNS 캡션</span>
          <button onclick="navigator.clipboard.writeText(document.getElementById('ce2-gen-caption').value);this.textContent='복사됨!';setTimeout(()=>this.textContent='복사',1000)" style="padding:2px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.4);font-size:9px;cursor:pointer;">복사</button>
        </div>
        <textarea id="ce2-gen-caption" rows="3" style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);outline:none;resize:vertical;line-height:1.5;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">${_esc(captionText)}</textarea>
      `;
      chatBody2.appendChild(capWrap);
      chatBody2.scrollTop = chatBody2.scrollHeight;
      _scrollAssistIntoView();
    }

    // 바로 업로드 버튼
    const uploadWrap = document.createElement('div');
    uploadWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;';
    uploadWrap.innerHTML = `
      <button onclick="ce2DownloadAll()" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">다운로드</button>
      <button onclick="ce2SaveAndOpenFolder(false)" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:12px;cursor:pointer;">폴더 열기</button>
    `;
    const chatBody3 = document.getElementById('ce2-chat-body');
    if (chatBody3) {
      chatBody3.appendChild(uploadWrap);
      chatBody3.scrollTop = chatBody3.scrollHeight;
      _scrollAssistIntoView();
    }
    // 업로드 상태 표시
    const pubStatus = document.createElement('div');
    pubStatus.id = 'ce2-publish-status';
    pubStatus.style.cssText = 'font-size:11px;color:rgba(0,0,0,0.4);padding:4px 0;';
    if (chatBody3) chatBody3.appendChild(pubStatus);
  }

  function _updateSummary() {
    const el = document.getElementById('ce2-summary');
    if (!el) return;
    el.style.display = 'block';
    const industry = document.getElementById('ce2-industry').value;
    const topic = document.getElementById('ce2-topic').value;
    const purpose = document.getElementById('ce2-purpose').value;
    const hasImages = _slides.some(s => s.imageUrl);
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);margin-bottom:8px;">현재 설정</div>
      <div><b>업종:</b> ${_esc(industry)}</div>
      <div><b>주제:</b> ${_esc(topic)}</div>
      <div><b>목적:</b> ${_esc(purpose)}</div>
      <div><b>카드:</b> ${_selectedCount}장</div>
      ${hasImages ? `
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button onclick="ce2DownloadAll()" style="flex:1;padding:9px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">다운로드</button>
        <button onclick="ce2SaveAndOpenFolder()" style="flex:1;padding:9px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);color:#1c1c1e;font-size:11px;font-weight:600;cursor:pointer;">폴더 열기</button>
      </div>
      <div style="margin-top:10px;">
        <button onclick="ce2MakeVideo()" style="width:100%;padding:9px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);color:#1c1c1e;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          슬라이드 영상 만들기
        </button>
      </div>
      <div id="ce2-video-status" style="font-size:10px;color:rgba(0,0,0,0.3);min-height:14px;margin-top:4px;text-align:center;"></div>
      ` : ''}
      <div style="margin-top:8px;"><button onclick="ce2OnIndustryEnter()" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:600;cursor:pointer;">다시 설정</button></div>
    `;
  }

  async function ce2ChatSend() {
    const input = document.getElementById('ce2-chat-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    _addChatMsg('user', val);
    const inputArea = document.getElementById('ce2-chat-input-area');
    if (inputArea) inputArea.style.display = 'none';

    if (_chatState === 'ask_subtype') {
      _onSubtypeSelected(val);
    } else if (_chatState === 'ask_topic') {
      _onTopicSelected(val);
    } else if (_chatState === 'ask_source_text') {
      _sourceMode = 'text';
      _sourceContent = val;
      window._sharedSourceContent = val;
      _moveToPurposeWithSource();
    } else if (_chatState === 'ask_source_url') {
      const status = document.createElement('div');
      status.id = 'ce2-url-status';
      status.style.display = 'none';
      document.body.appendChild(status);
      const input = document.createElement('input');
      input.id = 'ce2-source-url';
      input.value = val;
      input.style.display = 'none';
      document.body.appendChild(input);
      _sourceMode = 'url';
      await ce2FetchUrl();
      input.remove();
      status.remove();
      if (_sourceContent) await _moveToPurposeWithSource();
      else _askSource();
    } else if (_chatState === 'ask_source_youtube') {
      const status = document.createElement('div');
      status.id = 'ce2-yt-status';
      status.style.display = 'none';
      document.body.appendChild(status);
      const input = document.createElement('input');
      input.id = 'ce2-youtube-url';
      input.value = val;
      input.style.display = 'none';
      document.body.appendChild(input);
      const btn = document.createElement('button');
      btn.id = 'ce2-yt-fetch-btn';
      btn.style.display = 'none';
      document.body.appendChild(btn);
      _sourceMode = 'youtube';
      await ce2FetchYoutube();
      input.remove();
      status.remove();
      btn.remove();
      if (_sourceContent) await _moveToPurposeWithSource();
      else _askSource();
    } else if (_chatState === 'ask_purpose') {
      _onPurposeSelected(val);
    } else if (_chatState === 'ask_count') {
      const n = parseInt(val) || 6;
      _selectedCount = Math.max(1, Math.min(8, n));
      _onCountSelected(_selectedCount);
    } else if (_chatState === 'ask_cta') {
      const parsed = _parseCtaChoice(val);
      _onCtaSelected(parsed === null ? true : parsed);
    }
  }

  /* ── 카드 수 선택 ── */
  function ce2SelectCount(n) {
    _selectedCount = Math.max(1, Math.min(8, parseInt(n, 10) || 1));
    const btns = document.querySelectorAll('#ce2-count-group button');
    btns.forEach(btn => {
      const v = parseInt(btn.dataset.count);
      if (v === _selectedCount) {
        btn.style.background = 'linear-gradient(135deg,#ff8c00,#ff6b00)';
        btn.style.color = '#fff';
        btn.style.fontWeight = '700';
        btn.style.borderColor = 'transparent';
      } else {
        btn.style.background = 'rgba(120,120,128,0.08)';
        btn.style.color = '#1c1c1e';
        btn.style.fontWeight = '500';
        btn.style.borderColor = 'rgba(0,0,0,0.08)';
      }
    });
  }

  /* ── Step 2: 배경 이미지 ── */
  function ce2AiBgGenerate() {
    _pendingBgMode = 'ai';
    _pendingBgTemplate = null;
    _stepDone[2] = true;
    _updateStepStates();
    const st = document.getElementById('ce2-bg-status');
    if (st) { st.textContent = 'AI 배경 생성 선택됨'; st.style.color = '#34c759'; }
    // 이미 슬라이드가 있으면 바로 적용
    if (_slides.length) {
      _slides.forEach((s) => {
        s.bgColor = MOCK_BG_COLORS[Math.floor(Math.random() * MOCK_BG_COLORS.length)];
        s.imageUrl = '';
      });
      _renderSlides(_slides);
    }
  }

  /* ── 템플릿 데이터 ── */
  const TEMPLATES = [
    { key: 'gradient-warm',   name: '따뜻한 그라데이션', colors: ['#ff9a9e','#fad0c4','#ffecd2','#fcb69f','#ff9a9e','#fbc2eb','#a18cd1','#fad0c4'] },
    { key: 'gradient-cool',   name: '시원한 그라데이션', colors: ['#667eea','#764ba2','#4facfe','#00f2fe','#a1c4fd','#c2e9fb','#89f7fe','#66a6ff'] },
    { key: 'gradient-nature', name: '자연 그라데이션',   colors: ['#43e97b','#38f9d7','#0ba360','#3cba92','#56ab2f','#a8e063','#11998e','#38ef7d'] },
    { key: 'gradient-sunset', name: '선셋 그라데이션',   colors: ['#fa709a','#fee140','#f7971e','#ffd200','#fc4a1a','#f7b733','#e44d26','#f09819'] },
    { key: 'dark-modern',     name: '다크 모던',         colors: ['#0f0c29','#302b63','#24243e','#141e30','#243b55','#1a1a2e','#16213e','#0f3460'] },
    { key: 'pastel-soft',     name: '파스텔 소프트',     colors: ['#fbc2eb','#a6c1ee','#d4fc79','#96e6a1','#ffecd2','#fcb69f','#e0c3fc','#8ec5fc'] },
    { key: 'mono-white',      name: '화이트 미니멀',     colors: ['#f5f7fa','#e8ecf1','#dfe6ed','#f0f4f8','#edf2f7','#e2e8f0','#f7fafc','#edf2f7'] },
    { key: 'mono-black',      name: '블랙 미니멀',       colors: ['#1a1a1a','#2d2d2d','#3a3a3a','#252525','#1f1f1f','#333333','#2a2a2a','#1e1e1e'] },
  ];

  function _buildGradient(c1, c2) {
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }

  function ce2OpenTemplateModal() {
    const existing = document.getElementById('ce2-template-modal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'ce2-template-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;width:90%;max-width:720px;max-height:80vh;overflow-y:auto;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">템플릿 선택</h2>
            <p style="font-size:12px;color:rgba(0,0,0,0.4);margin-top:4px;">모든 슬라이드에 일괄 적용됩니다</p>
          </div>
          <button onclick="document.getElementById('ce2-template-modal').remove()" style="width:32px;height:32px;border-radius:10px;border:none;background:rgba(0,0,0,0.06);cursor:pointer;font-size:16px;color:#666;display:flex;align-items:center;justify-content:center;">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
          ${TEMPLATES.map(t => `
            <div onclick="ce2ApplyTemplate('${t.key}')" style="border:1px solid rgba(0,0,0,0.08);border-radius:14px;overflow:hidden;cursor:pointer;transition:all 0.2s;" onmouseenter="this.style.boxShadow='0 4px 16px rgba(255,140,0,0.15)';this.style.borderColor='rgba(255,140,0,0.3)'" onmouseleave="this.style.boxShadow='none';this.style.borderColor='rgba(0,0,0,0.08)'">
              <div style="display:flex;gap:2px;height:60px;">
                ${t.colors.slice(0, 4).map((c, ci) => `<div style="flex:1;background:${_buildGradient(c, t.colors[(ci + 1) % t.colors.length])};"></div>`).join('')}
              </div>
              <div style="padding:10px 14px;">
                <div style="font-size:13px;font-weight:600;color:#1c1c1e;">${t.name}</div>
                <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px;">${t.colors.length}가지 색상 조합</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function ce2ApplyTemplate(key) {
    const tpl = TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    _pendingBgMode = 'template';
    _pendingBgTemplate = key;
    _stepDone[2] = true;
    _updateStepStates();
    if (_slides.length) {
      _slides.forEach((s, i) => {
        s.bgColor = _buildGradient(tpl.colors[i % tpl.colors.length], tpl.colors[(i + 1) % tpl.colors.length]);
        s.imageUrl = '';
      });
      _renderSlides(_slides);
    }
    const modal = document.getElementById('ce2-template-modal');
    if (modal) modal.remove();
    const st = document.getElementById('ce2-bg-status');
    if (st) { st.textContent = `"${tpl.name}" 선택됨`; st.style.color = '#34c759'; }
  }

  /* ── Step 3: AI 전략 구성 ── */
  function ce2AiStrategy() {
    const industry = (document.getElementById('ce2-industry')?.value || '').trim();
    const topic = (document.getElementById('ce2-topic')?.value || '').trim();
    const purpose = (document.getElementById('ce2-purpose')?.value || '').trim();
    const st = document.getElementById('ce2-comp-status');
    if (!industry || !topic) {
      if (st) { st.textContent = '업종과 주제를 먼저 입력해주세요.'; st.style.color = '#ff3b30'; }
      return;
    }
    if (st) { st.textContent = 'AI 전략 구성 중...'; st.style.color = 'rgba(0,0,0,0.35)'; }
    const btn = document.getElementById('ce2-strategy-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    // TODO: 백엔드 API 연동
    setTimeout(() => {
      const purposeKey = purpose || '방문 유도';
      const strategies = {
        '방문 유도': [
          { role: '히어로 표지', imageHint: '매장 외관 또는 대표 이미지' },
          { role: '공감/문제', imageHint: '고민 상황 이미지' },
          { role: '핵심 가치', imageHint: '서비스/제품 클로즈업' },
          { role: '차별점', imageHint: '비교 또는 강점 이미지' },
          { role: '사회적 증거', imageHint: '후기/리뷰 사진' },
          { role: '방문 CTA', imageHint: '위치/연락처 이미지' },
        ],
        '상품 판매': [
          { role: '히어로 표지', imageHint: '제품 메인 사진' },
          { role: '고객 페인포인트', imageHint: '불편함 표현 이미지' },
          { role: '솔루션 제시', imageHint: '제품 사용 장면' },
          { role: '제품 상세', imageHint: '성분/스펙 이미지' },
          { role: '후기/신뢰', imageHint: '실사용 후기 사진' },
          { role: '구매 CTA', imageHint: '할인/혜택 배너' },
        ],
        '브랜드 인지도': [
          { role: '브랜드 인트로', imageHint: '로고/브랜드 비주얼' },
          { role: '미션/가치', imageHint: '팀/공간 사진' },
          { role: '스토리', imageHint: '히스토리 이미지' },
          { role: '핵심 강점', imageHint: '성과/수치 그래픽' },
          { role: '비하인드', imageHint: '작업/제조 과정' },
          { role: '팔로우 CTA', imageHint: 'SNS 프로필 이미지' },
        ],
      };
      const base = strategies[purposeKey] || strategies['방문 유도'];
      _strategyFlow = [];
      for (let i = 0; i < _selectedCount; i++) {
        _strategyFlow.push(base[i % base.length]);
      }

      const resultEl = document.getElementById('ce2-strategy-result');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = _strategyFlow.map((item, i) => `
          <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
            <span style="width:16px;height:16px;border-radius:4px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;color:#1c1c1e;font-weight:600;">${item.role}</div>
              <div style="font-size:9px;color:rgba(0,0,0,0.3);margin-top:1px;">${item.imageHint}</div>
            </div>
            <div onclick="ce2PickStrategyImage(${i})" style="width:28px;height:28px;border-radius:7px;border:1px dashed rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;overflow:hidden;background:rgba(0,0,0,0.02);" id="ce2-strat-img-${i}" title="이미지 첨부">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="2" style="width:12px;height:12px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
          </div>
        `).join('');
      }

      if (_slides.length) {
        _slides.forEach((s, i) => {
          const item = _strategyFlow[i];
          s.role = item ? item.role : '';
        });
        _renderSlides(_slides);
      }

      _stepDone[3] = true;
      _updateStepStates();
      if (st) { st.textContent = '전략 구성 완료'; st.style.color = '#34c759'; }
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }, 600);
  }

  /* ── 전체 생성 ── */
  function ce2AiGenerate() {
    const industry = (document.getElementById('ce2-industry')?.value || '').trim();
    const topic = (document.getElementById('ce2-topic')?.value || '').trim();

    // 전략 구성 기반으로 슬라이드 생성 (AI가 만든 제목/본문 사용)
    const slides = [];
    for (let i = 0; i < _selectedCount; i++) {
      const item = _strategyFlow[i] || {};
      slides.push({
        index: i + 1,
        title: item.title || item.role || `슬라이드 ${i + 1}`,
        body: item.body || '',
        bgColor: _bgForRole(item.role, i),
        imageUrl: '',
        refImageUrl: item.userImageUrl || item.userImage || '',
        role: item.role || '',
      });
    }
    _renderSlides(slides);
    _updateSummary();
    _autoSavePreset();
  }

  /* ── 슬라이드 렌더링 (원본 이미지 미리보기) ── */
  function _ce2SlidePreviewHtml(s, i) {
    if (!s.imageUrl) {
      return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(0,0,0,0.36);font-size:14px;">생성 대기</div>`;
    }
    return `
      <img src="${s.imageUrl}" alt="카드뉴스 ${i + 1}장" style="width:100%;height:100%;object-fit:cover;display:block;cursor:pointer;" onclick="ce2ViewLarge(${i})">
    `;
  }

  function _renderSlides(slides) {
    _slides = slides;
    const empty = document.getElementById('ce2-empty-state');
    const grid = document.getElementById('ce2-slides-grid');
    if (empty) empty.style.display = 'none';
    if (!grid) return;
    grid.style.display = 'grid';
    // 캔버스 영역으로 자동 스크롤
    setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    grid.innerHTML = slides.map((s, i) => `
      <div class="ce2-slide-card" data-index="${i}" style="position:relative;border-radius:14px;overflow:hidden;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.08);background:#fff;border:1px solid rgba(0,0,0,0.06);" onmouseenter="this.style.boxShadow='0 4px 24px rgba(0,0,0,0.18)';this.querySelector('.ce2-img-overlay-btn').style.opacity='1'" onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';this.querySelector('.ce2-img-overlay-btn').style.opacity='0'">
        <div style="aspect-ratio:1/1;background:${s.imageUrl ? '#fff' : (s.bgColor || '#f4f6f8')};position:relative;overflow:hidden;">
          ${_ce2SlidePreviewHtml(s, i)}
          <!-- hover 버튼 -->
          <div style="position:absolute;bottom:8px;right:8px;display:flex;gap:4px;z-index:4;opacity:0;transition:opacity 0.2s;" class="ce2-img-overlay-btn">
            <div onclick="event.stopPropagation();ce2AiImageLayer(${i})" style="width:30px;height:30px;border-radius:8px;background:rgba(255,140,0,0.8);display:flex;align-items:center;justify-content:center;cursor:pointer;" title="AI 재생성">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
            </div>
            <div onclick="event.stopPropagation();ce2DeleteSlide(${i})" style="width:30px;height:30px;border-radius:8px;background:rgba(255,59,48,0.8);display:flex;align-items:center;justify-content:center;cursor:pointer;" title="삭제">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
          </div>
          <!-- 선택 체크박스 -->
          <div style="position:absolute;top:8px;right:8px;z-index:4;">
            <input type="checkbox" data-slide-check="${i}" onclick="event.stopPropagation();ce2ToggleSelect(${i})" style="width:20px;height:20px;cursor:pointer;accent-color:#ff8c00;">
          </div>
          <!-- 슬라이드 번호 + 역할 -->
        </div>
        ${s.imageUrl ? '' : `
          <div style="padding:10px 10px 12px;background:#fff;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
              <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:7px;background:rgba(0,0,0,0.06);color:#1c1c1e;font-size:11px;font-weight:800;">${s.index}</span>
              ${s.role ? `<span style="padding:4px 8px;border-radius:7px;background:rgba(255,140,0,0.10);color:#ff8c00;font-size:10px;font-weight:800;">${_esc(s.role)}</span>` : ''}
            </div>
            <div style="font-size:12px;font-weight:800;color:#1c1c1e;line-height:1.35;">${_esc(s.title || `슬라이드 ${i + 1}`)}</div>
            ${s.body ? `<div style="font-size:11px;color:rgba(0,0,0,0.52);line-height:1.5;margin-top:4px;">${_esc(s.body)}</div>` : ''}
          </div>
        `}
        ${s.modelLabel ? `<div style="padding:7px 10px;border-top:1px solid rgba(0,0,0,0.05);font-size:10px;color:rgba(0,0,0,0.42);background:#fff;">${_esc(s.modelLabel)}</div>` : ''}
      </div>
    `).join('');
    // 선택 재생성 버튼 바
    let actionBar = document.getElementById('ce2-slide-actions');
    if (!actionBar) {
      actionBar = document.createElement('div');
      actionBar.id = 'ce2-slide-actions';
      actionBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:12px 0 4px;';
      grid.parentElement.appendChild(actionBar);
    }
    actionBar.innerHTML = `
      <button onclick="ce2RegenSelected()" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
        선택 이미지 재생성
      </button>
      <button onclick="ce2DeselectAll()" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.5);font-size:12px;cursor:pointer;">선택 해제</button>
      <div id="ce2-regen-status" style="font-size:11px;color:rgba(0,0,0,0.3);display:flex;align-items:center;"></div>
    `;
  }

  /* ── 이미지 레이어 추가 ── */
  function ce2AddImageLayer(slideIdx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const s = _slides[slideIdx];
        if (!s) return;
        s.imageUrl = ev.target.result;
        _renderSlides(_slides);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function _deleteImageLayer(slideIdx, layerIdx) {
    const s = _slides[slideIdx];
    if (!s || !s.layers) return;
    s.layers.splice(layerIdx, 1);
    _renderSlides(_slides);
  }

  /* ── AI 이미지 레이어 생성 ── */
  async function ce2RegenSelected() {
    const checks = document.querySelectorAll('[data-slide-check]');
    const selected = [];
    checks.forEach(cb => { if (cb.checked) selected.push(parseInt(cb.dataset.slideCheck)); });
    if (!selected.length) { alert('재생성할 슬라이드를 체크박스로 선택하세요.'); return; }
    const statusEl = document.getElementById('ce2-regen-status');
    for (const i of selected) {
      const s = _slides[i];
      if (!s) continue;
      const item = _strategyFlow[i] || {};
      if (statusEl) statusEl.textContent = `${i + 1}장 재생성 중...`;
      try {
        const imageResult = await _ce2GenerateSlideImage(_ce2SlideFromStrategy({ ...item, title: s.title, body: s.body, role: s.role }, i), i, null);
        s.imageUrl = imageResult.url;
        s.modelLabel = imageResult.modelLabel;
      } catch (e) {
        console.error(`regen slide ${i + 1} error:`, e);
        if (statusEl) {
          statusEl.textContent = `${i + 1}장 재생성 실패: ${e.message}`;
          statusEl.style.color = '#ff3b30';
        }
      }
      _renderSlides(_slides);
    }
    if (statusEl) {
      statusEl.textContent = `${selected.length}장 재생성 완료!`;
      statusEl.style.color = '#34c759';
    }
    await ce2SaveAndOpenFolder(true);
    ce2HistoryInit();
  }

  function ce2AiImageLayer(slideIdx) {
    const s = _slides[slideIdx];
    if (!s) return;
    const industry = (document.getElementById('ce2-industry')?.value || '').trim();
    const role = s.role || '';
    const title = s.title || '';
    const hint = (_strategyFlow[slideIdx] && _strategyFlow[slideIdx].imageHint) || '';
    const defaultVal = hint || `${industry} ${title} 관련 이미지`;

    // 커스텀 입력 모달
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;width:400px;box-shadow:0 16px 48px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
        <div style="font-size:15px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">AI 이미지 생성</div>
        <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-bottom:12px;">슬라이드 ${slideIdx + 1}: ${_esc(role)}</div>
        <textarea id="ce2-ai-img-prompt" rows="3" style="width:100%;padding:10px 12px;font-size:13px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:rgba(0,0,0,0.02);outline:none;resize:none;line-height:1.5;">${_esc(defaultVal)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button onclick="this.closest('div[style]').parentElement.remove()" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;font-size:13px;cursor:pointer;">취소</button>
          <button id="ce2-ai-img-go" style="padding:8px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">생성</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const goBtn = modal.querySelector('#ce2-ai-img-go');
    goBtn.onclick = async () => {
      const desc = modal.querySelector('#ce2-ai-img-prompt').value.trim();
      if (!desc) return;
      goBtn.disabled = true;
      goBtn.textContent = '생성 중...';
      goBtn.style.opacity = '0.6';
      try {
        const item = _strategyFlow[slideIdx] || {};
        const nextItem = { ...item, title: s.title, body: s.body, role: s.role, imageHint: desc };
        const imageResult = await _ce2GenerateSlideImage(_ce2SlideFromStrategy(nextItem, slideIdx), slideIdx, null);
        s.imageUrl = imageResult.url;
        s.modelLabel = imageResult.modelLabel;
        if (_strategyFlow[slideIdx]) _strategyFlow[slideIdx].imageHint = desc;
        _renderSlides(_slides);
        modal.remove();
      } catch (err) {
        goBtn.textContent = '오류 — 다시 시도';
        goBtn.disabled = false;
        goBtn.style.opacity = '1';
      }
    };
  }

  /* ── 텍스트 박스 선택/이동/리사이즈 (이벤트 위임) ── */
  let _dragInfo = null;
  let _resizeInfo = null;

  function _selectBox(box) {
    ce2DeselectAll();
    box.style.borderColor = box.classList.contains('ce2-img-layer') ? '#007aff' : '#ff8c00';
    box.querySelectorAll('.ce2-resize-handle, .ce2-layer-delete').forEach(h => h.style.display = 'block');
  }

  function ce2DeselectAll() {
    document.querySelectorAll('.ce2-textbox, .ce2-img-layer').forEach(b => {
      b.style.borderColor = 'transparent';
      b.querySelectorAll('.ce2-resize-handle, .ce2-layer-delete').forEach(h => h.style.display = 'none');
    });
  }

  // contenteditable 이벤트 위임
  document.addEventListener('input', (e) => {
    const el = e.target.closest('.ce2-editable');
    if (!el) return;
    const idx = parseInt(el.dataset.idx);
    const field = el.dataset.field;
    if (_slides[idx]) _slides[idx][field] = el.innerText;
  }, true);
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('.ce2-editable');
    if (el) ce2ShowToolbar(el);
  }, true);
  document.addEventListener('focusout', (e) => {
    const el = e.target.closest('.ce2-editable');
    if (el) ce2HideToolbarDelay();
  }, true);

  // 이벤트 위임: mousedown
  document.addEventListener('mousedown', (e) => {
    // 레이어 삭제 버튼
    if (e.target.classList.contains('ce2-layer-delete')) {
      e.preventDefault();
      e.stopPropagation();
      const si = parseInt(e.target.dataset.slide);
      const li = parseInt(e.target.dataset.layer);
      _deleteImageLayer(si, li);
      return;
    }
    // 리사이즈 핸들 (텍스트박스 + 이미지레이어 공용)
    if (e.target.classList.contains('ce2-resize-handle')) {
      e.preventDefault();
      e.stopPropagation();
      const resizeHandle = e.target;
      // 이미지 레이어 리사이즈인지 텍스트박스 리사이즈인지 판별
      const imgLayerBox = resizeHandle.closest('.ce2-img-layer');
      const textBox = resizeHandle.closest('.ce2-textbox');
      const box = imgLayerBox || textBox;
      if (!box) return;
      const parent = imgLayerBox ? box.closest('[id^="ce2-img-area-"]') : box.closest('.ce2-slide-card');
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      const idx = parseInt(resizeHandle.dataset.idx || resizeHandle.dataset.slide);
      const field = resizeHandle.dataset.field || null;
      const layerIdx = resizeHandle.dataset.layer !== undefined ? parseInt(resizeHandle.dataset.layer) : null;
      _resizeInfo = { idx, field, layerIdx, box, pRect, startX: e.clientX, startY: e.clientY, origW: parseFloat(box.style.width) || 30 };
      return;
    }
    // 이미지 레이어 드래그
    const imgLayer = e.target.closest('.ce2-img-layer');
    if (imgLayer && !e.target.classList.contains('ce2-resize-handle') && !e.target.classList.contains('ce2-layer-delete')) {
      e.preventDefault();
      _selectBox(imgLayer);
      const parent = imgLayer.closest('[id^="ce2-img-area-"]');
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      const si = parseInt(imgLayer.dataset.slide);
      const li = parseInt(imgLayer.dataset.layer);
      _dragInfo = {
        idx: si, field: null, layerIdx: li, box: imgLayer, pRect,
        startX: e.clientX, startY: e.clientY,
        origLeft: parseFloat(imgLayer.style.left) || 0,
        origTop: parseFloat(imgLayer.style.top) || 0,
      };
      return;
    }
    // 텍스트 박스 드래그 (contenteditable 내부 클릭이면 스킵)
    const textbox = e.target.closest('.ce2-textbox');
    if (textbox) {
      _selectBox(textbox);
      // contenteditable 내부 클릭이면 텍스트 편집 모드
      if (e.target.contentEditable === 'true' || e.target.closest('[contenteditable="true"]')) return;
      e.preventDefault();
      const parent = textbox.closest('.ce2-slide-card');
      if (!parent) return;
      const pRect = parent.getBoundingClientRect();
      const idx = parseInt(textbox.dataset.idx);
      const field = textbox.dataset.field;
      _dragInfo = {
        idx, field, box: textbox, pRect,
        startX: e.clientX, startY: e.clientY,
        origLeft: parseFloat(textbox.style.left) || 0,
        origTop: parseFloat(textbox.style.top) || 0,
      };
      return;
    }
    // img-area 클릭 → 선택 해제
    if (e.target.closest('[id^="ce2-img-area-"]')) {
      ce2DeselectAll();
    }
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (_dragInfo) {
      const d = _dragInfo;
      const dx = ((e.clientX - d.startX) / d.pRect.width) * 100;
      const dy = ((e.clientY - d.startY) / d.pRect.height) * 100;
      d.box.style.left = Math.max(0, Math.min(90, d.origLeft + dx)) + '%';
      d.box.style.top = Math.max(0, Math.min(90, d.origTop + dy)) + '%';
    }
    if (_resizeInfo) {
      const r = _resizeInfo;
      const dx = ((e.clientX - r.startX) / r.pRect.width) * 100;
      r.box.style.width = Math.max(20, Math.min(96, r.origW + dx)) + '%';
    }
  });

  document.addEventListener('mouseup', () => {
    if (_dragInfo) {
      const d = _dragInfo;
      const s = _slides[d.idx];
      if (s) {
        if (d.layerIdx !== undefined && d.layerIdx !== null && s.layers && s.layers[d.layerIdx]) {
          // 이미지 레이어
          s.layers[d.layerIdx].x = parseFloat(d.box.style.left);
          s.layers[d.layerIdx].y = parseFloat(d.box.style.top);
        } else if (d.field) {
          // 텍스트 박스
          s[d.field + 'X'] = parseFloat(d.box.style.left);
          s[d.field + 'Y'] = parseFloat(d.box.style.top);
        }
      }
      _dragInfo = null;
    }
    if (_resizeInfo) {
      const r = _resizeInfo;
      const s = _slides[r.idx];
      if (s) {
        if (r.layerIdx !== undefined && r.layerIdx !== null && s.layers && s.layers[r.layerIdx]) {
          s.layers[r.layerIdx].w = parseFloat(r.box.style.width);
        } else if (r.field) {
          s[r.field + 'W'] = parseFloat(r.box.style.width);
        }
      }
      _resizeInfo = null;
    }
  });

  /* ── 전략 구성 이미지 업로드 ── */
  function ce2PickStrategyImage(idx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target.result;
        if (_strategyFlow[idx]) _strategyFlow[idx].userImage = url;
        // 미리보기 업데이트
        const box = document.getElementById(`ce2-strat-img-${idx}`);
        if (box) {
          box.style.border = 'none';
          box.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        // 슬라이드가 이미 있으면 바로 적용
        if (_slides[idx]) _slides[idx].refImageUrl = url;
      };
      reader.readAsDataURL(file);
      try {
        const uploadedURL = await _ce2UploadReferenceFile(file);
        if (_strategyFlow[idx]) _strategyFlow[idx].userImageUrl = uploadedURL;
        if (_slides[idx]) _slides[idx].refImageUrl = uploadedURL;
      } catch (err) {
        console.warn('[CE2] strategy reference upload failed:', err);
      }
    };
    input.click();
  }

  /* ── 플로팅 텍스트 편집 바 (컴팩트) ── */
  let _hideTimer = null;

  function _ensureFloatingPanel() {
    let panel = document.getElementById('ce2-text-float');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'ce2-text-float';
    panel.style.cssText = 'position:fixed;z-index:9999;background:#1c1c1e;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:6px 8px;display:none;align-items:center;gap:5px;user-select:none;';
    panel.innerHTML = `
      <select id="ce2-float-font" onchange="ce2ApplyFont(this.value)" style="width:90px;padding:4px;font-size:10px;border-radius:6px;border:none;background:#333;color:#fff;outline:none;">${FONTS.map(f => `<option value="${f}">${f}</option>`).join('')}</select>
      <select id="ce2-float-size" onchange="ce2ApplySize(this.value)" style="width:52px;padding:4px;font-size:10px;border-radius:6px;border:none;background:#333;color:#fff;outline:none;">${FONT_SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <button id="ce2-float-bold" onclick="ce2ToggleBold()" style="width:26px;height:26px;border-radius:6px;border:none;background:#333;font-weight:900;font-size:12px;cursor:pointer;color:#fff;">B</button>
      <span style="width:1px;height:18px;background:rgba(255,255,255,0.15);"></span>
      <button onclick="ce2ApplyAlign('left')" data-align="left" class="ce2-align-btn" style="width:26px;height:26px;border-radius:6px;border:none;background:#333;cursor:pointer;color:#fff;font-size:11px;">L</button>
      <button onclick="ce2ApplyAlign('center')" data-align="center" class="ce2-align-btn" style="width:26px;height:26px;border-radius:6px;border:none;background:#333;cursor:pointer;color:#fff;font-size:11px;">C</button>
      <button onclick="ce2ApplyAlign('right')" data-align="right" class="ce2-align-btn" style="width:26px;height:26px;border-radius:6px;border:none;background:#333;cursor:pointer;color:#fff;font-size:11px;">R</button>
      <span style="width:1px;height:18px;background:rgba(255,255,255,0.15);"></span>
      <div id="ce2-float-recent-colors" style="display:flex;gap:3px;align-items:center;"></div>
      <div style="position:relative;width:26px;height:26px;flex-shrink:0;">
        <input type="color" id="ce2-float-color-picker" value="#ffffff" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:none;padding:0;">
        <div id="ce2-float-color-preview" style="width:26px;height:26px;border-radius:50%;background:#fff;border:2px solid rgba(255,255,255,0.3);pointer-events:none;"></div>
      </div>
      <span onclick="ce2CloseFloating()" style="color:rgba(255,255,255,0.3);cursor:pointer;font-size:14px;margin-left:2px;">&times;</span>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('mousedown', (e) => {
      // select, input은 정상 동작하도록 허용
      const tag = e.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'OPTION') return;
      e.preventDefault();
    });
    // color picker 이벤트
    const picker = panel.querySelector('#ce2-float-color-picker');
    if (picker) {
      picker.addEventListener('input', (e) => {
        const c = e.target.value;
        ce2ApplyColor(c);
        document.getElementById('ce2-float-color-preview').style.background = c;
        _addRecentColor(c);
        _renderRecentColors();
      });
    }
    _renderRecentColors();
    return panel;
  }

  const RECENT_COLORS_KEY = 'ce2_recent_colors';
  function _getRecentColors() {
    try { return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || '[]'); } catch { return []; }
  }
  function _addRecentColor(c) {
    let arr = _getRecentColors().filter(x => x !== c);
    arr.unshift(c);
    if (arr.length > 8) arr.length = 8;
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(arr));
  }
  function _renderRecentColors() {
    const el = document.getElementById('ce2-float-recent-colors');
    if (!el) return;
    const colors = _getRecentColors();
    if (!colors.length) {
      // 기본 색상
      const defaults = ['#ffffff','#000000','#ff8c00','#ff3b30','#34c759','#007aff'];
      el.innerHTML = defaults.map(c => `<div onclick="ce2ApplyColor('${c}')" style="width:16px;height:16px;border-radius:50%;background:${c};border:1.5px solid ${c === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'transparent'};cursor:pointer;flex-shrink:0;"></div>`).join('');
      return;
    }
    el.innerHTML = colors.slice(0, 6).map(c => `<div onclick="ce2ApplyColor('${c}')" style="width:16px;height:16px;border-radius:50%;background:${c};border:1.5px solid ${c === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'transparent'};cursor:pointer;flex-shrink:0;"></div>`).join('');
  }

  function ce2ShowToolbar(el) {
    clearTimeout(_hideTimer);
    _activeTextEl = el;
    const panel = _ensureFloatingPanel();
    const rect = el.getBoundingClientRect();
    panel.style.display = 'flex';
    // 텍스트 바로 위에 작게 표시
    const panelW = 520;
    panel.style.left = Math.max(10, Math.min(rect.left + rect.width / 2 - panelW / 2, window.innerWidth - panelW - 10)) + 'px';
    panel.style.top = Math.max(10, rect.top - 44) + 'px';

    // 현재 스타일 반영
    const idx = parseInt(el.dataset.idx);
    const field = el.dataset.field;
    const s = _slides[idx];
    if (!s) return;
    const prefix = field === 'title' ? 'title' : 'body';
    const fontSel = document.getElementById('ce2-float-font');
    const sizeSel = document.getElementById('ce2-float-size');
    if (fontSel) fontSel.value = s[prefix + 'Font'] || FONTS[0];
    if (sizeSel) sizeSel.value = s[prefix + 'Size'] || (field === 'title' ? 18 : 12);
    // 굵기 표시
    const boldBtn = document.getElementById('ce2-float-bold');
    const w = s[prefix + 'Weight'] || (field === 'title' ? 800 : 500);
    if (boldBtn) boldBtn.style.background = w >= 700 ? 'rgba(255,140,0,0.2)' : 'rgba(120,120,128,0.08)';
    // 정렬 표시
    const align = s[prefix + 'Align'] || 'center';
    document.querySelectorAll('.ce2-align-btn').forEach(b => {
      b.style.background = b.dataset.align === align ? 'rgba(255,140,0,0.15)' : 'rgba(120,120,128,0.06)';
    });
  }

  function ce2HideToolbarDelay() {
    _hideTimer = setTimeout(() => {
      const panel = document.getElementById('ce2-text-float');
      if (panel) panel.style.display = 'none';
      _activeTextEl = null;
    }, 200);
  }

  function ce2CloseFloating() {
    const panel = document.getElementById('ce2-text-float');
    if (panel) panel.style.display = 'none';
    _activeTextEl = null;
  }

  function _getActiveSlideField() {
    if (!_activeTextEl) return null;
    const idx = parseInt(_activeTextEl.dataset.idx);
    const field = _activeTextEl.dataset.field;
    const s = _slides[idx];
    if (!s) return null;
    const prefix = field === 'title' ? 'title' : 'body';
    return { slide: s, prefix, el: _activeTextEl };
  }

  function ce2ApplyFont(val) {
    const ctx = _getActiveSlideField();
    if (!ctx) return;
    ctx.slide[ctx.prefix + 'Font'] = val;
    ctx.el.style.fontFamily = val;
  }

  function ce2ApplySize(val) {
    const ctx = _getActiveSlideField();
    if (!ctx) return;
    ctx.slide[ctx.prefix + 'Size'] = parseInt(val);
    ctx.el.style.fontSize = val + 'px';
  }

  function ce2ToggleBold() {
    const ctx = _getActiveSlideField();
    if (!ctx) return;
    const cur = ctx.slide[ctx.prefix + 'Weight'] || (ctx.prefix === 'title' ? 800 : 500);
    const next = cur >= 700 ? 400 : 800;
    ctx.slide[ctx.prefix + 'Weight'] = next;
    ctx.el.style.fontWeight = next;
    const boldBtn = document.getElementById('ce2-float-bold');
    if (boldBtn) boldBtn.style.background = next >= 700 ? 'rgba(255,140,0,0.2)' : 'rgba(120,120,128,0.08)';
  }

  function ce2ApplyAlign(val) {
    const ctx = _getActiveSlideField();
    if (!ctx) return;
    ctx.slide[ctx.prefix + 'Align'] = val;
    ctx.el.style.textAlign = val;
    document.querySelectorAll('.ce2-align-btn').forEach(b => {
      b.style.background = b.dataset.align === val ? 'rgba(255,140,0,0.15)' : 'rgba(120,120,128,0.06)';
    });
  }

  function ce2ApplyColor(val) {
    const ctx = _getActiveSlideField();
    if (!ctx) return;
    ctx.slide[ctx.prefix + 'Color'] = val;
    ctx.el.style.color = val;
    // preview + 최근 색상 업데이트
    const preview = document.getElementById('ce2-float-color-preview');
    if (preview) preview.style.background = val;
    const picker = document.getElementById('ce2-float-color-picker');
    if (picker) picker.value = val.startsWith('#') ? val : '#ffffff';
    _addRecentColor(val);
    _renderRecentColors();
  }

  /* ── 이미지 교체 ── */
  function ce2PickImage(idx) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (_slides[idx]) _slides[idx].imageUrl = ev.target.result;
        _renderSlides(_slides);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function ce2UpdateSlide(idx, field, value) {
    if (_slides[idx]) _slides[idx][field] = value;
  }

  /* ── 크게보기 (라이트박스) ── */
  function ce2ViewLarge(idx) {
    const s = _slides[idx];
    if (!s || !s.imageUrl) return;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;';
    modal.onclick = () => modal.remove();
    // 좌우 이동
    let cur = idx;
    const render = () => {
      const sl = _slides[cur];
      if (!sl || !sl.imageUrl) return;
      modal.innerHTML = `
        <div style="position:relative;max-width:90vw;max-height:90vh;" onclick="event.stopPropagation()">
          <img src="${sl.imageUrl}" style="max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.4);">
          <div style="position:absolute;bottom:-36px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;">
            <button onclick="event.stopPropagation();ce2LightboxNav(-1)" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:18px;cursor:pointer;">&lt;</button>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">${cur + 1} / ${_slides.length}</span>
            <button onclick="event.stopPropagation();ce2LightboxNav(1)" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:18px;cursor:pointer;">&gt;</button>
          </div>
          <button onclick="event.stopPropagation();document.getElementById('ce2-lightbox').remove()" style="position:absolute;top:-12px;right:-12px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.2);color:#fff;font-size:16px;cursor:pointer;">&times;</button>
        </div>
      `;
    };
    modal.id = 'ce2-lightbox';
    window._ce2LightboxCur = cur;
    window.ce2LightboxNav = (dir) => {
      window._ce2LightboxCur = Math.max(0, Math.min(_slides.length - 1, window._ce2LightboxCur + dir));
      cur = window._ce2LightboxCur;
      render();
    };
    render();
    document.body.appendChild(modal);
    // 키보드 좌우
    const keyHandler = (e) => {
      if (e.key === 'ArrowLeft') window.ce2LightboxNav(-1);
      else if (e.key === 'ArrowRight') window.ce2LightboxNav(1);
      else if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);
  }

  /* ── 슬라이드 선택/삭제 ── */
  function ce2DeleteSlide(idx) {
    _slides.splice(idx, 1);
    // index 재정렬
    _slides.forEach((s, i) => s.index = i + 1);
    _selectedCount = _slides.length;
    _renderSlides(_slides);
    _updateSummary();
  }

  function ce2ToggleSelect(idx) {
    // 체크박스 상태는 DOM에서 직접 관리
  }

  function _getSelectedSlides() {
    const checks = document.querySelectorAll('[data-slide-check]');
    const selected = [];
    checks.forEach(cb => {
      if (cb.checked) {
        const idx = parseInt(cb.dataset.slideCheck);
        if (_slides[idx]) selected.push(_slides[idx]);
      }
    });
    return selected.length ? selected : _slides; // 선택 없으면 전체
  }

  /* ── SNS 업로드 ── */
  async function ce2Publish(platform) {
    const status = document.getElementById('ce2-publish-status');
    const topic = (document.getElementById('ce2-topic')?.value || '').trim();
    const purpose = (document.getElementById('ce2-purpose')?.value || '').trim();

    // 먼저 이미지를 서버에 저장
    if (status) { status.textContent = `${platform} 업로드 준비 중...`; status.style.color = '#ff8c00'; }
    const selected = _getSelectedSlides();
    let savedFolder = '';
    let savedFiles = [];
    try {
      const saveResp = await fetch('/api/ce2/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: selected.map(s => ({ index: s.index, imageUrl: s.imageUrl || '', role: s.role || '', title: s.title || '' })), industry: document.getElementById('ce2-industry')?.value || '', topic, profile_name: window._globalProfileData?.name || '', profile_id: parseInt(window._globalProfileId || 0) }),
      });
      const saveData = await saveResp.json();
      if (saveData.ok) { savedFolder = saveData.folder; savedFiles = saveData.files || []; }
    } catch (e) { console.error('save error:', e); }

    if (!savedFiles.length) {
      console.error('[ce2Publish] 이미지 저장 실패 — slides:', selected.length, 'imageUrl 유무:', selected.map(s => !!s.imageUrl));
      if (status) { status.textContent = '이미지 저장 실패 — 이미지를 먼저 생성하세요'; status.style.color = '#ff3b30'; }
      return;
    }

    const imagePaths = savedFiles.map(f => savedFolder.replace(/\\/g, '/') + '/' + f);
    // AI 생성 캡션 우선 사용, 없으면 기본 조합
    const aiCaption = (document.getElementById('ce2-gen-caption')?.value || '').trim();
    const caption = aiCaption || `${_brandName ? _brandName + ' | ' : ''}${topic}${purpose ? ' | ' + purpose : ''}`;
    const profileId = parseInt(window._globalProfileId || 0);

    if (status) { status.textContent = `${platform}에 업로드 중...`; status.style.color = '#ff8c00'; }

    try {
      let resp;
      if (platform === 'threads') {
        resp = await fetch('/api/threads/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }),
        });
      } else if (platform === 'twitter') {
        resp = await fetch('/api/twitter/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }),
        });
      } else if (platform === 'instagram') {
        resp = await fetch('/api/instagram/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption, image_paths: imagePaths, profile_id: profileId }),
        });
      } else if (platform === 'naver') {
        // 네이버 블로그는 이미지를 본문에 삽입
        const title = `${_brandName ? _brandName + ' ' : ''}${topic}`;
        const content = _slides.map(s => `<p>${s.title || ''}</p><p>${s.body || ''}</p>`).join('');
        resp = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, content, images: imagePaths, profile_id: profileId }),
        });
      }

      const data = await resp.json();
      if (data.error) {
        if (status) { status.textContent = `실패: ${data.error.substring(0, 50)}`; status.style.color = '#ff3b30'; }
      } else {
        if (status) { status.textContent = `${platform} 업로드 완료!`; status.style.color = '#34c759'; }
      }
    } catch (e) {
      if (status) { status.textContent = `오류: ${e.message}`; status.style.color = '#ff3b30'; }
    }
  }

  /* ── 슬라이드 영상 만들기 ── */
  let _lastSavedFolder = '';

  async function ce2MakeVideo() {
    const status = document.getElementById('ce2-video-status');
    // 먼저 저장
    if (!_lastSavedFolder) {
      if (status) { status.textContent = '이미지 저장 중...'; status.style.color = '#ff8c00'; }
      try {
        const resp = await fetch('/api/ce2/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides: _slides.map(s => ({ index: s.index, imageUrl: s.imageUrl || '' })), industry: document.getElementById('ce2-industry')?.value || '', topic: document.getElementById('ce2-topic')?.value || '', profile_name: window._globalProfileData?.name || '', profile_id: parseInt(window._globalProfileId || 0) }),
        });
        const data = await resp.json();
        if (data.ok) _lastSavedFolder = data.folder;
      } catch (e) { console.error(e); }
    }
    if (!_lastSavedFolder) {
      if (status) { status.textContent = '이미지 저장 실패'; status.style.color = '#ff3b30'; }
      return;
    }
    if (status) { status.textContent = '슬라이드 영상 생성 중... (시간이 걸릴 수 있습니다)'; status.style.color = '#ff8c00'; }
    try {
      const resp = await fetch('/api/video/from-cardnews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_dir: _lastSavedFolder, profile_id: parseInt(window._globalProfileId || 0) }),
      });
      const data = await resp.json();
      if (data.video_path) {
        if (status) { status.textContent = '영상 생성 완료! · ' + _ce2VideoModelLabel(data); status.style.color = '#34c759'; }
        // 폴더 열기
        await fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: _lastSavedFolder }) });
      } else {
        if (status) { status.textContent = `실패: ${data.detail || data.error || '알 수 없는 오류'}`; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = `오류: ${e.message}`; status.style.color = '#ff3b30'; }
    }
  }

  /* ── 다운로드 / 폴더 열기 ── */
  async function ce2SaveAndOpenFolder(silent) {
    if (_cardnewsProjectDir) {
      _lastSavedFolder = _cardnewsProjectDir;
      if (!silent) {
        await fetch('/api/ce2/open-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: _cardnewsProjectDir }),
        });
      }
      return;
    }
    try {
      const resp = await fetch('/api/ce2/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: _slides.map(s => ({ index: s.index, imageUrl: s.imageUrl || '', role: s.role || '', title: s.title || '', body: s.body || '' })), industry: document.getElementById('ce2-industry')?.value || '', topic: document.getElementById('ce2-topic')?.value || '', profile_name: window._globalProfileData?.name || '', profile_id: parseInt(window._globalProfileId || 0) }),
      });
      const data = await resp.json();
      if (data.ok && data.folder) _lastSavedFolder = data.folder;
      if (data.ok && data.folder && !silent) {
        await fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: data.folder }) });
      }
    } catch (e) {
      console.error('save error:', e);
    }
  }

  async function ce2DownloadAll() {
    const topic = (document.getElementById('ce2-topic')?.value || 'cardnews').trim();
    const selected = _getSelectedSlides();
    const imageSlides = selected.filter(s => s && s.imageUrl);
    if (!imageSlides.length) {
      console.warn('[ce2DownloadAll] 다운로드할 이미지가 없습니다.');
      return;
    }
    const safeTopic = (topic.replace(/[^a-zA-Z0-9가-힣 _-]/g, '').trim() || 'cardnews');
    if (_cardnewsProjectDir) {
      imageSlides.forEach((slide, idx) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = slide.imageUrl;
          a.download = `${safeTopic}-${String(slide.index || idx + 1).padStart(2, '0')}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, idx * 180);
      });
      return;
    }
    try {
      const resp = await fetch('/api/ce2/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: imageSlides.map(s => ({ index: s.index, imageUrl: s.imageUrl || '' })), topic }),
      });
      if (!resp.ok) throw new Error(`download failed (${resp.status})`);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = safeTopic + '.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('download zip error:', e);
      imageSlides.forEach((slide, idx) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = slide.imageUrl;
          a.download = `${safeTopic}-${String(slide.index || idx + 1).padStart(2, '0')}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, idx * 180);
      });
    }
  }

  /* ── 히스토리 ── */
  async function ce2HistoryInit() {
    console.log('[ce2] HistoryInit called');
    const root = document.getElementById('ce2-history-root');
    if (!root) { console.warn('[ce2] ce2-history-root not found'); return; }
    root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.3);">불러오는 중...</div>';
    try {
      const resp = await fetch('/api/ce2/history');
      const data = await resp.json();
      if (!data.ok || !data.items || !data.items.length) {
        root.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(0,0,0,0.2);">아직 생성된 카드뉴스가 없습니다</div>';
        return;
      }
      // 히스토리 데이터를 저장해서 인덱스로 접근 + 영상 경로 설정
      data.items.forEach(item => {
        if (item.videos && item.videos.length) item._videoPath = item.videos[0];
      });
      window._ce2HistoryItems = data.items;
      root.innerHTML = data.items.map((item, hi) => `
        <div style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px 20px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${item.profile_id ? `<img src="/api/library/profiles/${item.profile_id}/logo" style="width:22px;height:22px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);" onerror="this.style.display='none'">` : ''}
                <div style="font-size:14px;font-weight:700;color:#1c1c1e;">${_esc(item.industry || '')} — ${_esc(item.topic || '')}</div>
              </div>
              <div style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:2px;">${item.profile_name ? _esc(item.profile_name) + ' · ' : ''}${_esc(item.created || '')} · ${item.slides || 0}장</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="ce2HistoryDownload(${hi})" style="padding:6px 12px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">다운로드</button>
              <button onclick="ce2HistoryOpen(window._ce2HistoryItems[${hi}].folder)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button>
              <button onclick="ce2HistoryDelete(window._ce2HistoryItems[${hi}].folder)" style="padding:6px 12px;border-radius:8px;border:none;background:rgba(255,59,48,0.08);color:#ff3b30;font-size:11px;cursor:pointer;">삭제</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;">
            ${(item.images || []).map((img, ii) => {
              const imgUrl = '/api/ce2/history/image?folder=' + encodeURIComponent(item.folder) + '&name=' + encodeURIComponent(img);
              return `<div style="position:relative;flex-shrink:0;" onmouseenter="this.querySelector('.ce2-hdel').style.opacity='1'" onmouseleave="this.querySelector('.ce2-hdel').style.opacity='0'">
                <img src="${imgUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(0,0,0,0.06);" onclick="ce2HistoryViewImage(${hi},${ii})">
                <div class="ce2-hdel" onclick="event.stopPropagation();ce2HistoryDeleteImage(${hi},${ii})" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;background:#ff3b30;border:2px solid #fff;border-radius:50%;color:#fff;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;box-shadow:0 1px 4px rgba(0,0,0,0.3);">&times;</div>
              </div>`;
            }).join('')}
          </div>
          <!-- 캡션 -->
          <div style="margin-top:10px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <label style="font-size:10px;color:rgba(0,0,0,0.35);font-weight:600;">캡션</label>
              <button onclick="ce2HistoryGenCaption(${hi})" id="ce2-hcap-btn-${hi}" style="padding:2px 8px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:9px;font-weight:600;cursor:pointer;">AI 생성</button>
              <button onclick="navigator.clipboard.writeText(document.getElementById('ce2-hcap-${hi}').value);this.textContent='복사됨!';setTimeout(()=>this.textContent='복사',1000)" style="padding:2px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.4);font-size:9px;cursor:pointer;">복사</button>
            </div>
            <textarea id="ce2-hcap-${hi}" rows="2" placeholder="캡션을 입력하거나 AI 생성 버튼을 눌러주세요..." style="width:100%;padding:8px 10px;font-size:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);outline:none;resize:vertical;line-height:1.5;" onfocus="this.style.borderColor='#ff8c00'" onblur="this.style.borderColor='rgba(0,0,0,0.06)'">${_esc(item.caption || '')}</textarea>
          </div>
          <!-- 영상 만들기 -->
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
            <button onclick="ce2HistoryMakeVideo(${hi})" id="ce2-hvid-btn-${hi}" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);color:#1c1c1e;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              슬라이드 영상 만들기
            </button>
            <span id="ce2-hvid-status-${hi}" style="font-size:10px;color:rgba(0,0,0,0.3);"></span>
          </div>
          <div id="ce2-hvid-preview-${hi}" style="margin-top:6px;${(item.videos && item.videos.length) ? '' : 'display:none;'}">
            <video id="ce2-hvid-player-${hi}" controls style="width:100%;max-height:240px;border-radius:10px;background:#000;"${(item.videos && item.videos.length) ? ` src="/api/ce2/history/image?path=${encodeURIComponent(item.videos[0])}"` : ''}></video>
          </div>
          <!-- 발행 -->
          <div style="margin-top:10px;">
            <button onclick="ce2HistoryOpenUpload(${hi})" style="width:100%;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              SNS 발행
            </button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      root.innerHTML = `<div style="text-align:center;padding:40px;color:#ff3b30;">오류: ${e.message}</div>`;
    }
  }

  function ce2HistoryOpenUpload(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const existing = document.getElementById('ce2-upload-modal');
    if (existing) existing.remove();

    const hasCn = (item.images || []).length > 0;
    const caption = document.getElementById(`ce2-hcap-${hi}`)?.value || item.topic || '';

    const modal = document.createElement('div');
    modal.id = 'ce2-upload-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:24px;width:520px;max-width:92vw;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;font-size:18px;font-weight:700;color:#1c1c1e;">SNS 발행 / 영상 변환</h2>
          <button onclick="document.getElementById('ce2-upload-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:rgba(0,0,0,0.3);">&times;</button>
        </div>

        <!-- 캡션 -->
        <div style="margin-bottom:16px;">
          <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:4px;display:block;">캡션</label>
          <textarea id="ce2-um-caption" rows="3" style="width:100%;padding:10px;font-size:13px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;resize:vertical;">${_esc(caption)}</textarea>
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button onclick="ce2UmGenCaption(${hi})" id="ce2-um-cap-btn" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(255,140,0,0.2);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:10px;font-weight:600;cursor:pointer;">AI 캡션 생성</button>
            <button onclick="navigator.clipboard.writeText(document.getElementById('ce2-um-caption').value);this.textContent='복사됨!';setTimeout(()=>this.textContent='복사',1000)" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);color:rgba(0,0,0,0.4);font-size:10px;cursor:pointer;">복사</button>
          </div>
        </div>

        <!-- 이미지 미리보기 -->
        <div style="margin-bottom:16px;">
          <label style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;display:block;">카드뉴스 이미지 (${(item.images||[]).length}장)</label>
          <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">
            ${(item.images || []).map(img => `<img src="/api/ce2/history/image?folder=${encodeURIComponent(item.folder)}&name=${encodeURIComponent(img)}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.06);">`).join('')}
          </div>
        </div>

        <!-- 영상 발행 -->
        <div style="font-size:12px;font-weight:700;color:rgba(0,0,0,0.5);margin-bottom:8px;">영상 발행</div>
        <div style="font-size:10px;color:rgba(0,0,0,0.3);margin-bottom:6px;">리스트에서 먼저 '슬라이드 영상 만들기'로 영상을 생성하세요.</div>
        <table style="width:100%;border-collapse:separate;border-spacing:0 6px;">
          <tr style="background:rgba(225,48,108,0.04);">
            <td style="padding:10px 14px;border-radius:10px 0 0 10px;"><b style="font-size:13px;">Instagram 릴스</b></td>
            <td style="padding:10px;font-size:11px;color:rgba(0,0,0,0.4);">슬라이드 영상</td>
            <td style="padding:10px 14px;border-radius:0 10px 10px 0;text-align:right;"><button onclick="ce2UmPublishVideo(${hi},'reels')" style="padding:5px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">게시</button> <span id="ce2-um-s-reels" style="font-size:10px;color:rgba(0,0,0,0.3);"></span></td>
          </tr>
          <tr style="background:rgba(225,48,108,0.04);">
            <td style="padding:10px 14px;border-radius:10px 0 0 10px;"><b style="font-size:13px;">Instagram 스토리</b></td>
            <td style="padding:10px;font-size:11px;color:rgba(0,0,0,0.4);">슬라이드 영상</td>
            <td style="padding:10px 14px;border-radius:0 10px 10px 0;text-align:right;"><button onclick="ce2UmPublishVideo(${hi},'story')" style="padding:5px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">게시</button> <span id="ce2-um-s-story" style="font-size:10px;color:rgba(0,0,0,0.3);"></span></td>
          </tr>
        </table>
      </div>
    `;
    document.body.appendChild(modal);
  }

  async function ce2UmGenCaption(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const btn = document.getElementById('ce2-um-cap-btn');
    const textarea = document.getElementById('ce2-um-caption');
    if (btn) { btn.textContent = '생성 중...'; btn.disabled = true; }
    try {
      const resp = await fetch('/api/ce2/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'caption', industry: item.industry || '', topic: item.topic || '', platform: 'instagram' }) });
      const data = await resp.json();
      if (data.ok && data.caption && textarea) textarea.value = data.caption;
    } catch (e) {}
    if (btn) { btn.textContent = 'AI 캡션 생성'; btn.disabled = false; }
  }

  async function ce2UmPublish(hi, platform) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const status = document.getElementById(`ce2-um-s-${platform}`);
    const caption = (document.getElementById('ce2-um-caption')?.value || '').trim() || item.topic || '';
    const imagePaths = item.images || [];
    const profileId = parseInt(window._globalProfileId || 0);
    if (status) { status.textContent = '업로드 중...'; status.style.color = '#ff8c00'; }
    try {
      let resp;
      if (platform === 'threads') {
        resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
      } else if (platform === 'instagram') {
        resp = await fetch('/api/instagram/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, image_paths: imagePaths, profile_id: profileId }) });
      } else if (platform === 'twitter') {
        resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
      } else if (platform === 'naver') {
        const title = `${item.industry || ''} ${item.topic || ''}`.trim();
        resp = await fetch('/api/blog/publish-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, image_paths: imagePaths, profile_id: profileId }) });
      }
      const data = await resp.json();
      if (data.ok || data.success || data.post_url) {
        if (status) { status.textContent = '완료!'; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.error || data.detail || '실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
  }

  async function ce2UmMakeVideo(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const btn = document.getElementById('ce2-um-vid-btn');
    const status = document.getElementById('ce2-um-vid-status');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 영상 생성 중...'; }
    if (status) { status.textContent = '슬라이드 영상을 만들고 있습니다...'; status.style.color = '#ff8c00'; }
    try {
      const resp = await fetch('/api/video/from-cardnews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_dir: item.folder, profile_id: parseInt(window._globalProfileId || 0) }) });
      const data = await resp.json();
      if (data.video_path) {
        item._videoPath = data.video_path;
        if (status) { status.textContent = '영상 생성 완료!'; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.detail || data.error || '실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> 슬라이드 영상 만들기'; }
  }

  async function ce2UmPublishVideo(hi, platform) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const status = document.getElementById(`ce2-um-s-${platform}`);
    if (!item._videoPath) {
      if (status) { status.textContent = '영상 먼저 생성...'; status.style.color = '#ff8c00'; }
      await ce2UmMakeVideo(hi);
      if (!item._videoPath) return;
    }
    const caption = (document.getElementById('ce2-um-caption')?.value || '').trim() || item.topic || '';
    const profileId = parseInt(window._globalProfileId || 0);
    if (status) { status.textContent = '업로드 중...'; status.style.color = '#ff8c00'; }
    try {
      let resp;
      if (platform === 'reels') {
        resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, type: 'reels', profile_id: profileId }) });
      } else if (platform === 'story') {
        resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, type: 'story', profile_id: profileId }) });
      } else if (platform === 'shorts') {
        resp = await fetch('/api/youtube/upload-shorts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caption.slice(0, 100), description: caption, video_path: item._videoPath, profile_id: profileId }) });
      } else if (platform === 'tiktok') {
        resp = await fetch('/api/tiktok/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, profile_id: profileId }) });
      }
      const data = await resp.json();
      if (data.ok || data.success || data.url || data.post_url) {
        if (status) { status.textContent = '완료!'; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.error || data.detail || '실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
  }

  function ce2HistoryMakeVideo(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;

    const existing = document.getElementById('ce2-vid-options-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ce2-vid-options-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background:#fff;border-radius:22px;padding:28px;width:92%;max-width:480px;box-shadow:0 25px 60px rgba(0,0,0,0.15);animation:modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h2 style="font-size:18px;font-weight:700;color:#1c1c1e;margin:0;">슬라이드 영상 옵션</h2>
          <button onclick="document.getElementById('ce2-vid-options-modal').remove()" style="background:rgba(0,0,0,0.06);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(0,0,0,0.4);">&times;</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">나레이션</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <label class="qs-btn qs-active"><input type="radio" name="ce2v-narration" value="on" checked style="display:none;"> TTS 나레이션</label>
              <label class="qs-btn"><input type="radio" name="ce2v-narration" value="off" style="display:none;"> BGM만</label>
            </div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">TTS 음성</div>
            <select id="ce2v-voice" style="padding:7px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.1);font-size:12px;background:#f9f9fb;width:100%;">
              <optgroup label="한국어 추천">
                <option value="gemini-Kore" selected>Kore (한국어 기본)</option>
              </optgroup>
              <optgroup label="여성 음성">
                <option value="gemini-Aoede">Aoede (밝고 경쾌)</option>
                <option value="gemini-Leda">Leda (부드럽고 차분)</option>
                <option value="gemini-Zephyr">Zephyr (따뜻하고 자연스러운)</option>
              </optgroup>
              <optgroup label="남성 음성">
                <option value="gemini-Charon">Charon (낮고 안정적)</option>
                <option value="gemini-Fenrir">Fenrir (힘 있고 깊은)</option>
                <option value="gemini-Puck">Puck (활발하고 에너지)</option>
                <option value="gemini-Orus">Orus (무겁고 단단한)</option>
                <option value="gemini-Achernar">Achernar (선명하고 또렷한)</option>
                <option value="gemini-Perseus">Perseus (내레이션 전문)</option>
              </optgroup>
            </select>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">자막 스타일</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <label class="qs-btn qs-active"><input type="radio" name="ce2v-subtitle" value="promo" checked style="display:none;"> 프로모션</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="minimal" style="display:none;"> 미니멀</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="neon" style="display:none;"> 네온</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="pop" style="display:none;"> 팝</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="news" style="display:none;"> 뉴스</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="cinematic" style="display:none;"> 시네마틱</label>
              <label class="qs-btn"><input type="radio" name="ce2v-subtitle" value="none" style="display:none;"> 없음</label>
            </div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:600;color:rgba(0,0,0,0.4);margin-bottom:6px;">배경음악 (BGM)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <label class="qs-btn qs-active"><input type="radio" name="ce2v-bgm" value="random" checked style="display:none;"> 라이브러리 랜덤</label>
              <label class="qs-btn"><input type="radio" name="ce2v-bgm" value="custom" style="display:none;"> 직접 선택</label>
              <label class="qs-btn"><input type="radio" name="ce2v-bgm" value="none" style="display:none;"> 없음</label>
            </div>
            <div id="ce2v-bgm-file-area" style="display:none;margin-top:6px;">
              <button onclick="ce2PickBgmFile()" style="padding:6px 12px;border-radius:8px;border:1px dashed rgba(255,140,0,0.3);background:rgba(255,140,0,0.04);color:#ff8c00;font-size:11px;cursor:pointer;">BGM 파일 선택 (.mp3, .wav)</button>
              <span id="ce2v-bgm-file-name" style="font-size:10px;color:rgba(0,0,0,0.3);margin-left:6px;"></span>
            </div>
          </div>
        </div>
        <button onclick="ce2DoMakeVideo(${hi})" id="ce2v-go-btn" style="margin-top:18px;width:100%;padding:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          영상 생성 시작
        </button>
        <div id="ce2v-status" style="font-size:11px;color:rgba(0,0,0,0.3);margin-top:8px;text-align:center;min-height:16px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    // qs-btn 토글 (프로젝트 워크스페이스와 동일)
    modal.querySelectorAll('input[type="radio"]').forEach(r => {
      r.addEventListener('change', () => {
        modal.querySelectorAll(`input[name="${r.name}"]`).forEach(sib => {
          const label = sib.closest('.qs-btn');
          if (!label) return;
          if (sib.checked) label.classList.add('qs-active');
          else label.classList.remove('qs-active');
        });
        // BGM 직접 선택 영역 토글
        const bgmArea = document.getElementById('ce2v-bgm-file-area');
        const bgmVal = modal.querySelector('input[name="ce2v-bgm"]:checked')?.value;
        if (bgmArea) bgmArea.style.display = bgmVal === 'custom' ? 'block' : 'none';
      });
    });
  }

  let _ce2BgmFilePath = '';

  function ce2PickBgmFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav,.m4a,.ogg';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const nameEl = document.getElementById('ce2v-bgm-file-name');
      if (nameEl) nameEl.textContent = file.name;
      // 서버에 업로드
      const formData = new FormData();
      formData.append('file', file);
      try {
        const resp = await fetch('/api/ce2/upload-bgm', { method: 'POST', body: formData });
        const data = await resp.json();
        if (data.ok && data.path) {
          _ce2BgmFilePath = data.path;
          if (nameEl) nameEl.textContent = `${file.name} (준비됨)`;
        }
      } catch (err) {
        if (nameEl) nameEl.textContent = `업로드 실패: ${err.message}`;
      }
    };
    input.click();
  }

  async function ce2DoMakeVideo(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const modal = document.getElementById('ce2-vid-options-modal');
    const goBtn = document.getElementById('ce2v-go-btn');
    const status = document.getElementById('ce2v-status');
    const voice = modal?.querySelector('input[name="ce2v-narration"]:checked')?.value === 'off' ? '' : (document.getElementById('ce2v-voice')?.value || 'gemini-Kore');
    const subtitleStyle = modal?.querySelector('input[name="ce2v-subtitle"]:checked')?.value || 'promo';
    const bgmVal = modal?.querySelector('input[name="ce2v-bgm"]:checked')?.value || 'random';
    const skipBgm = bgmVal === 'none';
    const bgmPath = bgmVal === 'custom' ? _ce2BgmFilePath : '';

    if (goBtn) { goBtn.disabled = true; goBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> 영상 생성 중...'; }
    if (status) { status.textContent = '시간이 걸릴 수 있습니다...'; status.style.color = '#ff8c00'; }

    try {
      const resp = await fetch('/api/video/from-cardnews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_dir: item.folder,
          profile_id: parseInt(window._globalProfileId || 0),
          voice: voice,
          subtitle_style: subtitleStyle,
          skip_bgm: skipBgm,
          bgm_path: bgmPath,
        }),
      });
      const data = await resp.json();
      if (data.video_path) {
        item._videoPath = data.video_path;
        if (status) { status.textContent = '영상 생성 완료!'; status.style.color = '#34c759'; }
        // meta.json에 영상 경로 저장
        try {
          await fetch('/api/ce2/save-video-path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: item.folder, video_path: data.video_path }) });
        } catch (e) { console.warn('video path save failed:', e); }
        // 모달 닫고 리스트에 미리보기 표시
        if (modal) modal.remove();
        const preview = document.getElementById(`ce2-hvid-preview-${hi}`);
        const player = document.getElementById(`ce2-hvid-player-${hi}`);
        if (preview && player) {
          player.src = '/api/ce2/history/image?path=' + encodeURIComponent(data.video_path);
          preview.style.display = 'block';
        }
        const listStatus = document.getElementById(`ce2-hvid-status-${hi}`);
        if (listStatus) { listStatus.textContent = '영상 생성 완료!'; listStatus.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.detail || data.error || '영상 생성 실패'; status.style.color = '#ff3b30'; }
        if (goBtn) { goBtn.disabled = false; goBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 다시 시도'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
      if (goBtn) { goBtn.disabled = false; goBtn.innerHTML = '다시 시도'; }
    }
  }

  async function ce2HistoryPublishVideo(hi, platform) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const status = document.getElementById(`ce2-hvid-status-${hi}`);

    // 영상이 없으면 먼저 생성
    if (!item._videoPath) {
      if (status) { status.textContent = '영상을 먼저 생성합니다...'; status.style.color = '#ff8c00'; }
      await ce2HistoryMakeVideo(hi);
      if (!item._videoPath) return;
    }

    const textarea = document.getElementById(`ce2-hcap-${hi}`);
    const caption = (textarea?.value || item.topic || '').trim();
    const profileId = parseInt(window._globalProfileId || 0);
    if (status) { status.textContent = `${platform} 업로드 중...`; status.style.color = '#ff8c00'; }

    try {
      let resp;
      if (platform === 'reels') {
        resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, type: 'reels', profile_id: profileId }) });
      } else if (platform === 'story') {
        resp = await fetch('/api/instagram/upload-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, type: 'story', profile_id: profileId }) });
      } else if (platform === 'shorts') {
        resp = await fetch('/api/youtube/upload-shorts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caption.slice(0, 100), description: caption, video_path: item._videoPath, profile_id: profileId }) });
      } else if (platform === 'tiktok') {
        resp = await fetch('/api/tiktok/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, video_path: item._videoPath, profile_id: profileId }) });
      }
      const data = await resp.json();
      if (data.ok || data.success || data.url || data.post_url) {
        if (status) { status.textContent = `${platform} 업로드 완료!`; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.error || data.detail || '업로드 실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
  }

  async function ce2HistoryGenCaption(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const btn = document.getElementById(`ce2-hcap-btn-${hi}`);
    const textarea = document.getElementById(`ce2-hcap-${hi}`);
    if (btn) { btn.textContent = '생성 중...'; btn.disabled = true; }
    try {
      const resp = await fetch('/api/ce2/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'caption', industry: item.industry || '', topic: item.topic || '', platform: 'instagram' }),
      });
      const data = await resp.json();
      if (data.ok && data.caption && textarea) textarea.value = data.caption;
    } catch (e) { console.warn('caption gen failed'); }
    if (btn) { btn.textContent = 'AI 생성'; btn.disabled = false; }
  }

  async function ce2HistoryPublish(hi, platform) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi]) return;
    const item = items[hi];
    const status = document.getElementById(`ce2-hpub-status-${hi}`);
    const imagePaths = (item.images || []);
    if (!imagePaths.length) { if (status) status.textContent = '이미지 없음'; return; }
    const profileId = parseInt(window._globalProfileId || 0);

    // textarea에서 캡션 가져오기 (비어있으면 자동 생성)
    const textarea = document.getElementById(`ce2-hcap-${hi}`);
    let caption = (textarea?.value || '').trim();
    if (!caption) {
      if (status) { status.textContent = '캡션 생성 중...'; status.style.color = '#ff8c00'; }
      try {
        const capResp = await fetch('/api/ce2/assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'caption', industry: item.industry || '', topic: item.topic || '', platform }),
        });
        const capData = await capResp.json();
        if (capData.ok && capData.caption) { caption = capData.caption; if (textarea) textarea.value = caption; }
      } catch (e) { caption = item.topic || item.industry || ''; }
    }

    if (status) { status.textContent = `${platform} 업로드 중...`; status.style.color = '#ff8c00'; }
    try {
      let resp;
      if (platform === 'threads') {
        resp = await fetch('/api/threads/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
      } else if (platform === 'instagram') {
        resp = await fetch('/api/instagram/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, image_paths: imagePaths, profile_id: profileId }) });
      } else if (platform === 'twitter') {
        resp = await fetch('/api/twitter/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: caption, images: imagePaths, profile_id: profileId }) });
      }
      const data = await resp.json();
      if (data.ok || data.success || data.post_url) {
        if (status) { status.textContent = `${platform} 업로드 완료!`; status.style.color = '#34c759'; }
      } else {
        if (status) { status.textContent = data.error || data.detail || '업로드 실패'; status.style.color = '#ff3b30'; }
      }
    } catch (e) {
      if (status) { status.textContent = e.message; status.style.color = '#ff3b30'; }
    }
  }

  async function ce2HistoryOpen(folder) {
    try {
      await fetch('/api/ce2/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
    } catch (e) { console.error('open folder error:', e); }
  }

  async function ce2HistoryDelete(folder) {
    if (!confirm('이 카드뉴스를 삭제하시겠습니까?')) return;
    await fetch('/api/ce2/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
    ce2HistoryInit();
  }

  function ce2HistoryViewImage(hi, ii) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi] || !items[hi].images) return;
    const images = items[hi].images;
    let cur = ii;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;cursor:pointer;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    const render = () => {
      const imgUrl = '/api/ce2/history/image?folder=' + encodeURIComponent(items[hi].folder) + '&name=' + encodeURIComponent(images[cur]);
      modal.innerHTML = `
        <div style="position:relative;" onclick="event.stopPropagation()">
          <img src="${imgUrl}" style="max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.4);">
          <div style="position:absolute;bottom:-36px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;">
            <button onclick="event.stopPropagation();window._ce2HvNav(-1)" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:18px;cursor:pointer;">&lt;</button>
            <span style="color:rgba(255,255,255,0.6);font-size:13px;">${cur + 1} / ${images.length}</span>
            <button onclick="event.stopPropagation();window._ce2HvNav(1)" style="width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:18px;cursor:pointer;">&gt;</button>
          </div>
          <button onclick="event.stopPropagation();this.closest('div[style]').parentElement.remove()" style="position:absolute;top:-12px;right:-12px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.2);color:#fff;font-size:16px;cursor:pointer;">&times;</button>
        </div>`;
    };
    window._ce2HvNav = (dir) => { cur = Math.max(0, Math.min(images.length - 1, cur + dir)); render(); };
    render();
    document.body.appendChild(modal);
  }

  async function ce2HistoryDeleteImage(hi, ii) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi] || !items[hi].images || !items[hi].images[ii]) return;
    const imgPath = items[hi].images[ii];
    try {
      await fetch('/api/ce2/history/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: items[hi].folder, name: imgPath }) });
      items[hi].images.splice(ii, 1);
      items[hi].slides = items[hi].images.length;
      if (!items[hi].images.length) {
        // 이미지 다 삭제되면 폴더도 삭제
        await fetch('/api/ce2/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: items[hi].folder }) });
      }
      ce2HistoryInit();
    } catch (e) { console.error('delete image error:', e); }
  }

  function ce2HistoryDownload(hi) {
    const items = window._ce2HistoryItems;
    if (!items || !items[hi] || !items[hi].images) return;
    items[hi].images.forEach((img, ii) => {
      const a = document.createElement('a');
      a.href = '/api/ce2/history/image?folder=' + encodeURIComponent(items[hi].folder) + '&name=' + encodeURIComponent(img);
      a.download = `cardnews_${String(ii + 1).padStart(2, '0')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  function _esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // expose
  function ce2Reset() {
    _initialized = false;
    _slides = [];
    _strategyFlow = [];
    _userUploadedImages = [];
    _sourceContent = '';
    _sourcePreviewHTML = '';
    _selectedCount = 6;
    ce2Init();
  }

  window.ce2Init = ce2Init;
  window.ce2Reset = ce2Reset;
  window.ce2Publish = ce2Publish;
  window.ce2MakeVideo = ce2MakeVideo;
  window.ce2DeleteSlide = ce2DeleteSlide;
  window.ce2ToggleSelect = ce2ToggleSelect;
  window.ce2DownloadAll = ce2DownloadAll;
  window.ce2SaveAndOpenFolder = ce2SaveAndOpenFolder;
  window.ce2ViewLarge = ce2ViewLarge;
  window.ce2HistoryInit = ce2HistoryInit;
  window.ce2HistoryOpenUpload = ce2HistoryOpenUpload;
  window.ce2UmGenCaption = ce2UmGenCaption;
  window.ce2UmPublish = ce2UmPublish;
  window.ce2UmMakeVideo = ce2UmMakeVideo;
  window.ce2UmPublishVideo = ce2UmPublishVideo;
  window.ce2HistoryMakeVideo = ce2HistoryMakeVideo;
  window.ce2DoMakeVideo = ce2DoMakeVideo;
  window.ce2PickBgmFile = ce2PickBgmFile;
  window.ce2HistoryPublishVideo = ce2HistoryPublishVideo;
  window.ce2HistoryGenCaption = ce2HistoryGenCaption;
  window.ce2HistoryPublish = ce2HistoryPublish;
  window.ce2HistoryOpen = ce2HistoryOpen;
  window.ce2HistoryDelete = ce2HistoryDelete;
  window.ce2HistoryViewImage = ce2HistoryViewImage;
  window.ce2HistoryDownload = ce2HistoryDownload;
  window.ce2HistoryDeleteImage = ce2HistoryDeleteImage;
  window.ce2OnIndustryEnter = ce2OnIndustryEnter;
  window.ce2LoadPreset = ce2LoadPreset;
  window.ce2DeletePreset = ce2DeletePreset;
  window.ce2ClearPresets = ce2ClearPresets;
  window.ce2PresetPrev = ce2PresetPrev;
  window.ce2PresetNext = ce2PresetNext;
  window.ce2ChatSend = ce2ChatSend;
  window.ce2AiGenerate = ce2AiGenerate;
  window.ce2UpdateSlide = ce2UpdateSlide;
  window.ce2PickImage = ce2PickImage;
  window.ce2OpenTemplateModal = ce2OpenTemplateModal;
  window.ce2ApplyTemplate = ce2ApplyTemplate;
  window.ce2DeselectAll = ce2DeselectAll;
  window.ce2ToggleSource = ce2ToggleSource;
  window.ce2OpenNaverSearchModal = ce2OpenNaverSearchModal;
  window.ce2NaverSearch = ce2NaverSearch;
  window.ce2NaverUpdateCount = ce2NaverUpdateCount;
  window.ce2NaverApply = ce2NaverApply;
  window.ce2OpenNewsSearchModal = ce2OpenNewsSearchModal;
  window.ce2NewsSearch = ce2NewsSearch;
  window.ce2NewsApply = ce2NewsApply;
  window.ce2FetchYoutube = ce2FetchYoutube;
  window.ce2FetchUrl = ce2FetchUrl;
  window.ce2PickSourceFile = ce2PickSourceFile;
  window.ce2AddImageLayer = ce2AddImageLayer;
  window.ce2RegenSelected = ce2RegenSelected;
  window.ce2AiImageLayer = ce2AiImageLayer;
  window.ce2PickStrategyImage = ce2PickStrategyImage;
  window.ce2ShowToolbar = ce2ShowToolbar;
  window.ce2HideToolbarDelay = ce2HideToolbarDelay;
  window.ce2CloseFloating = ce2CloseFloating;
  window.ce2ApplyFont = ce2ApplyFont;
  window.ce2ApplySize = ce2ApplySize;
  window.ce2ToggleBold = ce2ToggleBold;
  window.ce2ApplyAlign = ce2ApplyAlign;
  window.ce2ApplyColor = ce2ApplyColor;
})();
