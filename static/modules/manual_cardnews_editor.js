(function () {
  const STORAGE_KEY = 'manual_cardnews_workspace_v3';
  const FONT_OPTIONS = ['Pretendard', 'SUIT', 'Noto Sans KR', 'Noto Serif KR', 'Black Han Sans', 'Do Hyeon', 'Nanum Gothic', 'Nanum Myeongjo', 'Gowun Batang', 'Arial', 'Georgia'];
  const GOOGLE_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Gowun+Batang:wght@400;700&family=Nanum+Gothic:wght@400;700;800&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;500;700;900&display=swap';
  const GOOGLE_FONT_NAMES = new Set(['Noto Sans KR', 'Noto Serif KR', 'Black Han Sans', 'Do Hyeon', 'Nanum Gothic', 'Nanum Myeongjo', 'Gowun Batang']);
  const RATIOS = {
    portrait: { label: '4:5', width: 1080, height: 1350 },
    square: { label: '1:1', width: 1080, height: 1080 },
    story: { label: '9:16', width: 1080, height: 1920 },
    wide: { label: '16:9', width: 1600, height: 900 },
  };
  const PRESETS = [
    {
      key: 'hospital',
      name: '병원',
      accent: '#0ea5a4',
      description: '진료 전환과 전문성 전달에 맞는 구조',
      slides: [
        { title: '증상 공감', kicker: '문제 인식', heading: '이런 증상이 계속 반복되나요?', body: '고객이 먼저 공감할 만한 증상과 불편을 짧고 강하게 정리합니다.', cta: '상담 문의', bg1: '#f0fdfa', bg2: '#ccfbf1' },
        { title: '해결 포인트', kicker: '핵심 안내', heading: '지금 확인해야 할 체크포인트', body: '치료 전 확인할 기준과 병원 선택 기준을 보기 쉽게 나눠 전달합니다.', cta: '체크리스트 보기', bg1: '#ecfeff', bg2: '#cffafe' },
        { title: '과정 설명', kicker: '프로세스', heading: '상담부터 관리까지 한눈에', body: '상담, 검사, 시술, 관리 흐름을 카드뉴스 구조에 맞게 단계별로 보여줍니다.', cta: '진료 과정 확인', bg1: '#f8fafc', bg2: '#e2e8f0' },
        { title: '전환 유도', kicker: 'CTA', heading: '지금 예약하면 놓치지 않는 이유', body: '방문 전 알아두면 좋은 포인트와 행동 유도 문구를 마지막 장에 정리합니다.', cta: '예약하기', bg1: '#f0f9ff', bg2: '#dbeafe' },
      ],
    },
    {
      key: 'cafe',
      name: '카페',
      accent: '#a16207',
      description: '감성, 메뉴, 방문 동선을 함께 전달하는 구조',
      slides: [
        { title: '메뉴 소개', kicker: '시즌 메뉴', heading: '이번 주 눈에 띄는 메뉴 한 장 요약', body: '메뉴의 무드, 맛 포인트, 추천 상황을 카드형 정보로 정리합니다.', cta: '메뉴 보기', bg1: '#fffbeb', bg2: '#fde68a' },
        { title: '분위기 전달', kicker: '공간 무드', heading: '왜 이 공간이 기억에 남는지', body: '공간의 분위기와 체류 경험을 한 번에 떠올릴 수 있게 보여줍니다.', cta: '매장 보기', bg1: '#fafaf9', bg2: '#e7e5e4' },
        { title: '추천 포인트', kicker: '베스트 조합', heading: '처음 와도 실패하지 않는 선택', body: '대표 메뉴, 세트 조합, 추천 시간대를 명확하게 안내합니다.', cta: '추천 조합 보기', bg1: '#fefce8', bg2: '#fef08a' },
        { title: '방문 CTA', kicker: '이벤트', heading: '이번 방문에서 챙겨야 할 혜택', body: '리뷰, 쿠폰, 시즌 이벤트처럼 방문을 당길 요소를 마지막 장에 압축합니다.', cta: '방문하기', bg1: '#fff7ed', bg2: '#fed7aa' },
      ],
    },
    {
      key: 'realestate',
      name: '부동산',
      accent: '#1d4ed8',
      description: '매물 정보와 상담 유도를 직관적으로 전달하는 구조',
      slides: [
        { title: '매물 한눈에', kicker: '핵심 요약', heading: '이 매물을 먼저 봐야 하는 이유', body: '입지, 가격, 구조, 생활권의 강점을 짧은 문장으로 빠르게 전달합니다.', cta: '매물 문의', bg1: '#eff6ff', bg2: '#bfdbfe' },
        { title: '생활권 분석', kicker: '입지 장점', heading: '실거주 기준으로 보면 달라집니다', body: '교통, 학군, 편의시설, 개발 요소를 비교 가능한 방식으로 정리합니다.', cta: '입지 보기', bg1: '#f8fafc', bg2: '#dbeafe' },
        { title: '비교 포인트', kicker: '비교 설득', heading: '비슷한 매물과 무엇이 다른가요?', body: '가격, 면적, 관리비, 입주 조건을 카드 구조에 맞게 비교합니다.', cta: '비교표 받기', bg1: '#eef2ff', bg2: '#c7d2fe' },
        { title: '현장 CTA', kicker: '행동 유도', heading: '방문 전 체크해야 할 질문', body: '상담으로 이어질 핵심 질문과 예약 유도 문구를 마지막에 정리합니다.', cta: '방문 예약', bg1: '#dbeafe', bg2: '#93c5fd' },
      ],
    },
    {
      key: 'academy',
      name: '학원',
      accent: '#7c3aed',
      description: '성과와 커리큘럼을 동시에 보여주는 구조',
      slides: [
        { title: '과정 소개', kicker: '커리큘럼', heading: '과정이 어떻게 설계되어 있나요?', body: '기초부터 실전까지 학습 구조를 단계별로 보여줍니다.', cta: '과정 확인', bg1: '#faf5ff', bg2: '#ddd6fe' },
        { title: '대상 구분', kicker: '타깃 안내', heading: '이런 학생에게 특히 맞습니다', body: '학년, 수준, 목표에 따라 어떤 학생에게 적합한지 분명하게 설명합니다.', cta: '대상 보기', bg1: '#f5f3ff', bg2: '#c4b5fd' },
        { title: '성과 전달', kicker: '결과 강조', heading: '실제 변화는 이렇게 나타납니다', body: '성적 변화, 루틴, 피드백 구조를 보기 쉽게 정리합니다.', cta: '후기 보기', bg1: '#ede9fe', bg2: '#c4b5fd' },
        { title: '등록 CTA', kicker: '상담 유도', heading: '상담을 먼저 받아야 하는 이유', body: '레벨 테스트, 상담 절차, 등록 시기 포인트를 마지막 장에 정리합니다.', cta: '상담 신청', bg1: '#fdf4ff', bg2: '#f5d0fe' },
      ],
    },
    {
      key: 'beauty',
      name: '뷰티',
      accent: '#db2777',
      description: '제품 매력과 후기 설득을 동시에 가져가는 구조',
      slides: [
        { title: '제품 소개', kicker: 'Beauty pick', heading: '왜 이 제품이 눈에 띄는가', body: '제형, 발림성, 포인트 성분을 감각적인 문장으로 정리합니다.', cta: '제품 보기', bg1: '#fdf2f8', bg2: '#fbcfe8' },
        { title: '비교 설득', kicker: 'Compare', heading: '비슷한 제품과 무엇이 다른가요?', body: '텍스처, 지속력, 사용감 차이를 비교형 문장으로 보여줍니다.', cta: '비교 보기', bg1: '#fff1f2', bg2: '#fecdd3' },
        { title: '사용 루틴', kicker: 'How to', heading: '이렇게 쓰면 만족도가 달라집니다', body: '사용 순서와 조합 팁을 보기 쉽게 정리해 활용도를 높입니다.', cta: '루틴 확인', bg1: '#fdf4ff', bg2: '#f5d0fe' },
        { title: '구매 CTA', kicker: 'Action', heading: '지금 반응이 좋은 이유', body: '후기와 전환 문구를 섞어 구매 행동을 당기는 마무리를 만듭니다.', cta: '지금 확인', bg1: '#fff7ed', bg2: '#fed7aa' },
      ],
    },
    {
      key: 'commerce',
      name: '쇼핑몰',
      accent: '#ea580c',
      description: '상품 장점과 구매 전환에 강한 구조',
      slides: [
        { title: '상품 소개', kicker: 'Best item', heading: '이 상품을 먼저 봐야 하는 이유', body: '핵심 장점과 사용 상황을 명확한 문장으로 보여줍니다.', cta: '상품 보기', bg1: '#fff7ed', bg2: '#fdba74' },
        { title: '장점 정리', kicker: 'Benefit', heading: '고객이 바로 체감하는 포인트', body: '가격, 품질, 편의성 같은 핵심 장점을 빠르게 정리합니다.', cta: '장점 확인', bg1: '#fffbeb', bg2: '#fde68a' },
        { title: '후기 활용', kicker: 'Review', heading: '실제 고객 반응은 이렇게 모입니다', body: '실사용 후기와 별점 포인트를 카드 흐름에 맞게 정리합니다.', cta: '후기 보기', bg1: '#f8fafc', bg2: '#e2e8f0' },
        { title: '프로모션', kicker: 'Offer', heading: '이번에 사야 하는 이유를 남깁니다', body: '쿠폰, 묶음 혜택, 배송 조건을 마지막 장에 정리합니다.', cta: '지금 구매', bg1: '#fff1f2', bg2: '#fecdd3' },
      ],
    },
  ];
  const AXES = {
    objective: [
      { key: 'lead', label: '문의 전환', heading: '상담 문의를 늘리는 구조', kicker: '문의 전환형' },
      { key: 'visit', label: '방문 유도', heading: '오프라인 방문을 당기는 구조', kicker: '방문 유도형' },
      { key: 'sale', label: '판매 전환', heading: '구매를 당기는 판매형 구조', kicker: '판매 전환형' },
      { key: 'trust', label: '신뢰 형성', heading: '브랜드 신뢰를 만드는 구조', kicker: '신뢰 형성형' },
      { key: 'review', label: '후기 강조', heading: '후기로 설득하는 구조', kicker: '후기 강조형' },
      { key: 'event', label: '이벤트 홍보', heading: '프로모션 홍보에 맞는 구조', kicker: '이벤트형' },
      { key: 'faq', label: '질문 해결', heading: '고객 질문을 먼저 풀어주는 구조', kicker: 'FAQ형' },
      { key: 'compare', label: '비교 설득', heading: '비교 포인트가 살아있는 구조', kicker: '비교 설득형' },
    ],
    angle: [
      { key: 'beginner', label: '입문형', body: '처음 보는 고객도 쉽게 이해할 수 있게 설명합니다.' },
      { key: 'benefit', label: '장점 중심', body: '바로 체감할 수 있는 강점만 압축해 보여줍니다.' },
      { key: 'problem', label: '문제 공감', body: '고객이 겪는 불편과 고민을 먼저 끌어냅니다.' },
      { key: 'result', label: '결과 강조', body: '전후 변화와 실제 결과를 중심으로 설계합니다.' },
      { key: 'routine', label: '사용 루틴', body: '실사용 장면과 활용법을 중심으로 정리합니다.' },
      { key: 'local', label: '지역 방문', body: '방문과 예약으로 바로 이어지게 구성합니다.' },
      { key: 'proof', label: '근거 중심', body: '수치, 후기, 비교 포인트를 앞세워 설득합니다.' },
      { key: 'offer', label: '혜택 중심', body: '지금 행동해야 하는 이유와 혜택을 분명하게 남깁니다.' },
    ],
    mood: [
      { key: 'clean', label: '클린', bg1: '#f8fafc', bg2: '#e2e8f0' },
      { key: 'warm', label: '웜', bg1: '#fff7ed', bg2: '#fed7aa' },
      { key: 'soft', label: '소프트', bg1: '#fdf4ff', bg2: '#f5d0fe' },
      { key: 'bold', label: '볼드', bg1: '#eff6ff', bg2: '#bfdbfe' },
      { key: 'premium', label: '프리미엄', bg1: '#fafaf9', bg2: '#e7e5e4' },
      { key: 'fresh', label: '프레시', bg1: '#f0fdfa', bg2: '#ccfbf1' },
    ],
    layout: [
      { key: 'hero', label: '히어로' },
      { key: 'split', label: '분할형' },
      { key: 'stack', label: '정보 스택' },
      { key: 'qa', label: 'Q&A' },
      { key: 'story', label: '스토리형' },
      { key: 'check', label: '체크리스트' },
    ],
    cta: [
      { key: 'consult', label: '상담 CTA', text: '상담 문의' },
      { key: 'visit', label: '방문 CTA', text: '방문 예약' },
      { key: 'buy', label: '구매 CTA', text: '지금 확인' },
      { key: 'save', label: '저장 CTA', text: '저장해두기' },
      { key: 'message', label: '메시지 CTA', text: '메시지 보내기' },
    ],
  };

  let state = null;
  let dragState = null;
  let resizeState = null;
  let autoAiRunning = false;

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toastMessage(message, type) {
    if (typeof window.toast === 'function') {
      window.toast(message, type || 'info');
      return;
    }
    console.log('[manual-cardnews]', message);
  }

  function presetByKey(key) {
    const normalized = String(key || '').split('__')[0];
    return PRESETS.find((item) => item.key === normalized) || PRESETS[0];
  }

  function axisItem(axisName, key) {
    const axis = AXES[axisName] || [];
    return axis.find((item) => item.key === key) || axis[0];
  }

  function profileBusinessType() {
    return String(window._globalProfileData?.business_type || '').trim().toLowerCase();
  }

  function detectPresetKeyFromProfile() {
    const businessType = profileBusinessType();
    if (!businessType) return PRESETS[0].key;
    if (/(병원|치과|의원|피부|성형|한의원)/.test(businessType)) return 'hospital';
    if (/(카페|커피|베이커리|디저트)/.test(businessType)) return 'cafe';
    if (/(부동산|매물|공인중개|분양)/.test(businessType)) return 'realestate';
    if (/(학원|교육|입시|과외)/.test(businessType)) return 'academy';
    if (/(뷰티|미용|에스테틱|네일|헤어|화장품)/.test(businessType)) return 'beauty';
    if (/(쇼핑몰|커머스|이커머스|리테일|스마트스토어|판매)/.test(businessType)) return 'commerce';
    return PRESETS[0].key;
  }

  function selectionDefaults(industryKey, objectiveKey) {
    const defaultsByObjective = {
      lead: { angle: 'problem', mood: 'clean', layout: 'hero', cta: 'consult' },
      visit: { angle: 'local', mood: 'warm', layout: 'story', cta: 'visit' },
      sale: { angle: 'benefit', mood: 'bold', layout: 'split', cta: 'buy' },
      trust: { angle: 'proof', mood: 'premium', layout: 'stack', cta: 'message' },
      review: { angle: 'result', mood: 'soft', layout: 'story', cta: 'save' },
      event: { angle: 'offer', mood: 'warm', layout: 'hero', cta: 'buy' },
      faq: { angle: 'beginner', mood: 'clean', layout: 'qa', cta: 'message' },
      compare: { angle: 'proof', mood: 'bold', layout: 'check', cta: 'consult' },
    };
    return {
      industry: presetByKey(industryKey).key,
      objective: axisItem('objective', objectiveKey).key,
      ...(defaultsByObjective[axisItem('objective', objectiveKey).key] || defaultsByObjective.lead),
    };
  }

  function applySelectionDefaults(nextSelection) {
    return {
      ...nextSelection,
      ...selectionDefaults(nextSelection.industry, nextSelection.objective),
    };
  }

  function syncAiAssistFromSelection() {
    const preset = presetByKey(state.presetSelection.industry);
    const objective = axisItem('objective', state.presetSelection.objective);
    const profileGoal = String(window._globalProfileData?.business_goal || '').trim();
    state.aiAssist.objective = state.aiAssist.objective || profileGoal || `${objective.label} 카드뉴스`;
    state.aiAssist.product = state.aiAssist.product || `${preset.name} 대표 상품 또는 서비스`;
    state.aiAssist.audience = state.aiAssist.audience || `${preset.name} 고객층`;
    state.aiAssist.tone = state.aiAssist.tone || '전문적이지만 이해하기 쉬운 톤';
  }

  function inferObjectiveFromInputs(industryKey, topic) {
    const text = String(topic || '').toLowerCase();
    if (/(이벤트|프로모션|오픈|행사|할인|쿠폰|혜택)/.test(text)) return 'event';
    if (/(후기|리뷰|체험|전후|비포|애프터)/.test(text)) return 'review';
    if (/(비교|차이|vs|대비)/.test(text)) return 'compare';
    if (/(faq|질문|궁금|문의 전|자주 묻는)/.test(text)) return 'faq';
    if (/(메뉴|시그니처|신메뉴|공간|방문|위치|매장)/.test(text)) return 'visit';
    if (industryKey === 'cafe') return 'visit';
    if (industryKey === 'commerce') return 'sale';
    return 'lead';
  }

  function inferPresetSelectionFromInputs(industryKey, topic) {
    const text = String(topic || '').toLowerCase();
    const base = selectionDefaults(industryKey, inferObjectiveFromInputs(industryKey, topic));
    const next = { industry: industryKey, objective: base.objective, angle: base.angle, mood: base.mood, layout: base.layout, cta: base.cta };

    if (/(시그니처|signature|대표|베스트|best|추천)/.test(text)) next.angle = 'benefit';
    if (/(공간|인테리어|분위기|무드|좌석|뷰|포토존)/.test(text)) next.angle = 'local';
    if (/(후기|리뷰|전후|before|after)/.test(text)) next.angle = 'result';
    if (/(비교|차이|vs|대비)/.test(text)) next.angle = 'proof';
    if (/(faq|질문|가이드|정리|팁)/.test(text)) next.angle = 'beginner';

    if (/(프리미엄|고급|시그니처|signature)/.test(text)) next.mood = 'premium';
    else if (/(따뜻|감성|디저트|브런치|카페)/.test(text)) next.mood = 'warm';
    else if (/(상큼|신메뉴|여름|음료)/.test(text)) next.mood = 'fresh';
    else if (/(진한|강렬|핵심|포인트)/.test(text)) next.mood = 'bold';

    if (/(faq|질문|정리)/.test(text)) next.layout = 'qa';
    else if (/(비교|차이|vs|대비)/.test(text)) next.layout = 'check';
    else if (/(공간|분위기|스토리|브랜드)/.test(text)) next.layout = 'story';
    else if (/(메뉴|구성|조합|라인업)/.test(text)) next.layout = 'split';
    else if (/(혜택|이벤트|프로모션)/.test(text)) next.layout = 'hero';

    if (next.objective === 'visit') next.cta = 'visit';
    else if (next.objective === 'sale' || next.objective === 'event') next.cta = 'buy';
    else if (next.objective === 'review') next.cta = 'save';
    else if (next.objective === 'faq' || next.objective === 'trust') next.cta = 'message';

    return applySelectionDefaults(next);
  }

  function buildPresetFromSelection(selection) {
    const base = presetByKey(selection.industry);
    const objective = axisItem('objective', selection.objective);
    const angle = axisItem('angle', selection.angle);
    const mood = axisItem('mood', selection.mood);
    const layout = axisItem('layout', selection.layout);
    const cta = axisItem('cta', selection.cta);
    return {
      key: `${base.key}__manual`,
      baseKey: base.key,
      name: `${base.name} · ${objective.label} · ${angle.label} · ${layout.label}`,
      description: `${mood.label} 무드 / ${cta.label}`,
      accent: base.accent,
      previewKeywords: [base.name, objective.label, angle.label, mood.label, layout.label],
      slides: base.slides.map((slide, index) => ({
        ...slide,
        title: `${objective.label} ${index + 1}`,
        kicker: `${objective.kicker} · ${layout.label}`,
        heading: index === 0 ? objective.heading : `${slide.heading} ${angle.label}`,
        body: `${slide.body} ${angle.body}`,
        cta: cta.text,
        bg1: mood.bg1,
        bg2: mood.bg2,
      })),
    };
  }

  function ratioMeta(key) {
    return RATIOS[key] || RATIOS.portrait;
  }

  function createTextLayer(partial) {
    return Object.assign({
      id: uid('text'),
      type: 'text',
      name: '텍스트',
      x: 110,
      y: 120,
      width: 720,
      height: 180,
      rotation: 0,
      opacity: 1,
      text: '텍스트를 입력하세요',
      fontFamily: 'Pretendard',
      fontSize: 62,
      fontWeight: 800,
      lineHeight: 1.28,
      align: 'left',
      color: '#111111',
      padding: 0,
      backgroundColor: 'transparent',
    }, partial || {});
  }

  function createShapeLayer(partial) {
    return Object.assign({
      id: uid('shape'),
      type: 'shape',
      name: '도형',
      x: 96,
      y: 86,
      width: 888,
      height: 1178,
      rotation: 0,
      opacity: 1,
      fill: '#ffffff',
      stroke: 'transparent',
      strokeWidth: 0,
      radius: 40,
    }, partial || {});
  }

  function createImageLayer(partial) {
    return Object.assign({
      id: uid('image'),
      type: 'image',
      name: '이미지',
      x: 110,
      y: 360,
      width: 860,
      height: 620,
      rotation: 0,
      opacity: 1,
      src: '',
      fit: 'cover',
      borderRadius: 34,
      borderColor: 'transparent',
      borderWidth: 0,
      backgroundColor: '#ffffff',
      locked: false,
    }, partial || {});
  }

  function buildSlideFromPreset(item, accent) {
    return {
      id: uid('slide'),
      title: item.title,
      ratioKey: 'portrait',
      backgroundMode: 'gradient',
      backgroundColor: item.bg1,
      backgroundColor2: item.bg2,
      backgroundImage: '',
      notes: '',
      layers: [
        createShapeLayer({ name: '배경 카드', fill: 'rgba(255,255,255,0.92)', radius: 42 }),
        createTextLayer({ name: '키커', x: 118, y: 118, width: 520, height: 60, text: item.kicker, fontSize: 24, fontWeight: 700, color: accent }),
        createTextLayer({ name: '헤드라인', x: 118, y: 178, width: 760, height: 230, text: item.heading, fontSize: 74, fontWeight: 900, color: '#111111' }),
        createShapeLayer({ name: '이미지 박스', x: 118, y: 468, width: 844, height: 430, fill: 'rgba(255,255,255,0.86)', stroke: 'rgba(0,0,0,0.06)', strokeWidth: 2, radius: 32 }),
        createTextLayer({ name: '설명', x: 122, y: 934, width: 724, height: 150, text: item.body, fontSize: 34, fontWeight: 600, color: '#4b5563', lineHeight: 1.42 }),
        createShapeLayer({ name: 'CTA 버튼', x: 118, y: 1130, width: 268, height: 92, fill: accent, radius: 999 }),
        createTextLayer({ name: 'CTA 텍스트', x: 176, y: 1154, width: 200, height: 44, text: item.cta, fontSize: 30, fontWeight: 800, color: '#ffffff' }),
      ],
    };
  }

  function createWorkspace(presetKey) {
    const preset = buildPresetFromSelection(selectionDefaults(presetKey || detectPresetKeyFromProfile(), 'lead'));
    const slides = preset.slides.map((item) => buildSlideFromPreset(item, preset.accent));
    return {
      version: 3,
      presetKey: preset.baseKey || preset.key,
      presetSelection: selectionDefaults(preset.baseKey || preset.key, 'lead'),
      aiAssist: {
        objective: '신규 고객 문의를 늘리는 카드뉴스',
        product: `${preset.name} 대표 상품 또는 서비스`,
        audience: `${preset.name} 고객층`,
        tone: '전문적이지만 이해하기 쉬운 톤',
      },
      assetLab: {
        sourceImage: '',
        cutoutImage: '',
        backgroundImage: '',
        compositeImage: '',
      },
      presetImages: { items: [], page: 1, total: 0, query: '', loading: false, error: '' },
      uiPanel: 'compose',
      selectedSlideId: slides[0].id,
      selectedLayerId: slides[0].layers[2].id,
      editingLayerId: null,
      showGrid: false,
      slides,
    };
  }

  function currentSlide() {
    return state?.slides?.find((slide) => slide.id === state.selectedSlideId) || null;
  }

  function currentLayer() {
    return currentSlide()?.layers?.find((layer) => layer.id === state.selectedLayerId) || null;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createWorkspace(detectPresetKeyFromProfile());
      const parsed = JSON.parse(raw);
      if (!parsed?.slides?.length) return createWorkspace(detectPresetKeyFromProfile());
      parsed.version = 3;
      parsed.presetSelection = applySelectionDefaults(parsed.presetSelection || selectionDefaults(detectPresetKeyFromProfile(), 'lead'));
      parsed.aiAssist = parsed.aiAssist || createWorkspace(parsed.presetSelection.industry).aiAssist;
      parsed.assetLab = parsed.assetLab || createWorkspace(parsed.presetSelection.industry).assetLab;
      parsed.presetImages = parsed.presetImages || createWorkspace(parsed.presetSelection.industry).presetImages;
      parsed.uiPanel = parsed.uiPanel || 'compose';
      parsed.editingLayerId = parsed.editingLayerId || null;
      return parsed;
    } catch (error) {
      console.warn('manual cardnews load failed', error);
      return createWorkspace(detectPresetKeyFromProfile());
    }
  }

  function setState(nextState) {
    state = nextState;
    saveState();
    render();
  }

  function setStateSilently(nextState) {
    state = nextState;
    saveState();
  }

  function scaleForStage() {
    const wrap = document.querySelector('#manual-cardnews-root .mcn-stage-frame');
    const slide = currentSlide();
    if (!wrap || !slide) return 0.36;
    const ratio = ratioMeta(slide.ratioKey);
    const availableWidth = Math.max(320, wrap.clientWidth - 28);
    const availableHeight = Math.max(360, wrap.clientHeight - 28);
    const fitScale = Math.min(availableWidth / ratio.width, availableHeight / ratio.height);
    return Math.max(0.22, Math.min(0.42, fitScale));
  }

  function slideBgCss(slide) {
    if (slide.backgroundMode === 'solid') return slide.backgroundColor || '#ffffff';
    if (slide.backgroundMode === 'image' && slide.backgroundImage) return `center / cover no-repeat url("${slide.backgroundImage}")`;
    return `linear-gradient(160deg, ${slide.backgroundColor || '#ffffff'}, ${slide.backgroundColor2 || '#f3f4f6'})`;
  }

  function field(label, control) {
    return `<label class="mcn-field"><span>${label}</span>${control}</label>`;
  }

    function renderPresetList() {
    const selectedPreset = buildPresetFromSelection(state.presetSelection);
    const objective = axisItem('objective', state.presetSelection.objective);
    return `
      <div class="mcn-card">
        <h3>?? ??</h3>
        <p class="mcn-section-copy">?? ??? ???? ?? ?????.</p>
        <div class="mcn-preset-summary">
          <strong>${esc(selectedPreset.name)}</strong>
          <span>${esc(objective.heading)}</span>
          <small>${esc(selectedPreset.description)}</small>
        </div>
        <div class="mcn-chip-row">
          ${(selectedPreset.previewKeywords || []).map((keyword) => `<span class="mcn-chip">${esc(keyword)}</span>`).join('')}
        </div>
      </div>
    `;
  }

    function renderAiPanel() {
    return `
      <div class="mcn-card">
        <h3>AI \uBCF4\uC870</h3>
        <p class="mcn-section-copy">\uC5C5\uC885\uACFC \uC8FC\uC81C\uB97C \uAE30\uC900\uC73C\uB85C \uBB38\uAD6C, \uBC30\uACBD, \uC774\uBBF8\uC9C0\uB97C \uCC44\uC6B0\uACE0 \uD544\uC694\uD55C \uB808\uC774\uC5B4\uB9CC \uB2E4\uC2DC \uC0DD\uC131\uD569\uB2C8\uB2E4.</p>
        ${field('\uC694\uCCAD \uBB38\uAD6C', `<textarea rows="3" data-assist-field="objective" placeholder="\uC608: \uCE74\uD398 \uC2DC\uADF8\uB2C8\uCC98 \uBA54\uB274 \uC18C\uAC1C">${esc(state.aiAssist.objective || '')}</textarea>`)}
        ${field('\uC8FC\uC81C', `<input type="text" value="${esc(state.aiAssist.product || '')}" data-assist-field="product">`)}
        ${field('\uB300\uC0C1 \uACE0\uAC1D', `<input type="text" value="${esc(state.aiAssist.audience || '')}" data-assist-field="audience">`)}
        ${field('\uD1A4', `<input type="text" value="${esc(state.aiAssist.tone || '')}" data-assist-field="tone">`)}
        <div class="mcn-row">
          <button class="mcn-btn" onclick="window.mcnAiAutoFill()" ${autoAiRunning ? 'disabled' : ''}>\uC804\uCCB4 \uC790\uB3D9 \uCC44\uC6B0\uAE30</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiGenerateScript()" ${autoAiRunning ? 'disabled' : ''}>\uBB38\uAD6C\uB9CC \uC0DD\uC131</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiGenerateLayerCopy()">\uC120\uD0DD \uBB38\uAD6C \uB2E4\uC2DC\uC4F0\uAE30</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiGenerateBackground()">\uD604\uC7AC \uBC30\uACBD \uC0DD\uC131</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiGenerateSlideImage()">\uC120\uD0DD \uC774\uBBF8\uC9C0 \uC0DD\uC131</button>
        </div>
      </div>
    `;
  }

    function renderAssetCard(label, imageUrl, action) {
    return `
      <div class="mcn-asset-card">
        <strong>${esc(label)}</strong>
        <div class="mcn-asset-preview">
          ${imageUrl ? `<img src="${imageUrl}" alt="${esc(label)}">` : '<div class="mcn-asset-empty">??</div>'}
        </div>
        <button class="mcn-btn mcn-btn-secondary" onclick="${action}" ${imageUrl ? '' : 'disabled'}>?? ??? ??</button>
      </div>
    `;
  }

    function renderPresetImageGallery() {
    const gallery = state.presetImages || {};
    if (gallery.loading) return '<div class="mcn-empty-block">???? ???? ????.</div>';
    if (gallery.error) return `<div class="mcn-empty-block">${esc(gallery.error)}</div>`;
    if (!gallery.items?.length) return '<div class="mcn-empty-block">??? ?? ???? ????.</div>';
    return `
      <div class="mcn-unsplash-grid">
        ${gallery.items.map((item) => `
          <button class="mcn-unsplash-card" onclick="window.mcnUseUnsplashImage('${item.regular}')">
            <div class="mcn-unsplash-thumb"><img src="${item.thumb}" alt="${esc(item.alt || '')}"></div>
            <div class="mcn-unsplash-meta">${esc(item.photographer || 'Unsplash')}</div>
          </button>
        `).join('')}
      </div>
    `;
  }

    function renderAssetsPanel() {
    return `
      <div class="mcn-card">
        <h3>?? ?</h3>
        <p class="mcn-section-copy">?? ???? ?? ??, ?? ??, ???? ? ?? ?????.</p>
        <label class="mcn-field">
          <span>?? ???</span>
          <input type="file" accept="image/*" data-asset-upload="source">
        </label>
        <div class="mcn-row">
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiCutout()">??</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiGenerateAssetBackground()">?? ??</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAiComposite()">??</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnLoadPresetImages()">?? ???</button>
        </div>
        <div class="mcn-asset-grid">
          ${renderAssetCard('??', state.assetLab.sourceImage, 'window.mcnUseAsset("sourceImage")')}
          ${renderAssetCard('??', state.assetLab.cutoutImage, 'window.mcnUseAsset("cutoutImage")')}
          ${renderAssetCard('??', state.assetLab.backgroundImage, 'window.mcnUseAsset("backgroundImage")')}
          ${renderAssetCard('??', state.assetLab.compositeImage, 'window.mcnUseAsset("compositeImage")')}
        </div>
        <div style="margin-top:12px;">${renderPresetImageGallery()}</div>
      </div>
    `;
  }

  function renderTopPanel() {
    if (state.uiPanel === 'ai') return renderAiPanel();
    if (state.uiPanel === 'assets') return renderAssetsPanel();
    return renderAiPanel();
  }

  function renderSlideList() {
    return state.slides.map((slide, index) => `
      <button class="mcn-slide-card ${slide.id === state.selectedSlideId ? 'is-active' : ''}" data-slide-id="${slide.id}">
        <div class="mcn-slide-thumb" style="background:${slideBgCss(slide)};">
          <div class="mcn-slide-thumb-inner">
            <div class="mcn-slide-kicker">${esc(slide.layers.find((item) => item.name === '??')?.text || slide.title || '')}</div>
            <div class="mcn-slide-title">${esc(slide.layers.find((item) => item.name === '????')?.text || slide.title || '')}</div>
          </div>
        </div>
        <strong>${index + 1}. ${esc(slide.title)}</strong>
        <span>${esc(ratioMeta(slide.ratioKey).label)} ? ??? ${slide.layers.length}</span>
      </button>
    `).join('');
  }

  function isLockedLayer(layer) {
    return Boolean(layer?.locked || ['\uBC30\uACBD \uCE74\uB4DC', '\uC774\uBBF8\uC9C0 \uBC15\uC2A4', 'AI \uC774\uBBF8\uC9C0'].includes(String(layer?.name || '')));
  }

  function renderLayerDom(layer, scale) {
    const selected = state.selectedLayerId === layer.id;
    const locked = isLockedLayer(layer);
    const baseStyle = [
      `left:${layer.x * scale}px`,
      `top:${layer.y * scale}px`,
      `width:${layer.width * scale}px`,
      `height:${layer.height * scale}px`,
      `transform:rotate(${Number(layer.rotation || 0)}deg)`,
      `opacity:${Number(layer.opacity ?? 1)}`,
    ].join(';');
    const resizeHandle = selected && !locked ? `<button type="button" class="mcn-layer-resize" data-layer-resize="${layer.id}" aria-label="resize"></button>` : '';
    if (layer.type === 'text') {
      const isEditing = state.editingLayerId === layer.id;
      const inlineToolbar = selected ? `
        <div class="mcn-inline-toolbar" data-layer-toolbar="${layer.id}">
          <select data-quick-layer-field="fontFamily">
            ${FONT_OPTIONS.map((font) => `<option value="${font}" ${layer.fontFamily === font ? 'selected' : ''}>${font}</option>`).join('')}
          </select>
          <input type="number" min="10" value="${Number(layer.fontSize || 40)}" data-quick-layer-field="fontSize">
          <select data-quick-layer-field="align">
            <option value="left" ${layer.align === 'left' ? 'selected' : ''}>왼쪽</option>
            <option value="center" ${layer.align === 'center' ? 'selected' : ''}>가운데</option>
            <option value="right" ${layer.align === 'right' ? 'selected' : ''}>오른쪽</option>
          </select>
          <input type="color" value="${esc(layer.color || '#111111')}" data-quick-layer-field="color">
        </div>
      ` : '';
      return `
        <div class="mcn-layer ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-layer-id="${layer.id}" data-layer-locked="${locked ? '1' : '0'}" style="${baseStyle};padding:${Number(layer.padding || 0) * scale}px;font-family:${esc(layer.fontFamily)};font-size:${Number(layer.fontSize || 40) * scale}px;font-weight:${Number(layer.fontWeight || 700)};line-height:${Number(layer.lineHeight || 1.3)};text-align:${layer.align || 'left'};color:${layer.color || '#111111'};background:${layer.backgroundColor || 'transparent'};">
          ${inlineToolbar}
          <div class="mcn-text-content ${isEditing ? 'is-editing' : ''}" data-text-editor="${layer.id}" contenteditable="true" spellcheck="false">${esc(layer.text || '').replace(/\n/g, '<br>')}</div>
          ${resizeHandle}
        </div>
      `;
    }
    if (layer.type === 'shape') {
      return `
        <div class="mcn-layer ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-layer-id="${layer.id}" data-layer-locked="${locked ? '1' : '0'}" style="${baseStyle};background:${layer.fill || '#ffffff'};border:${Number(layer.strokeWidth || 0) * scale}px solid ${layer.stroke || 'transparent'};border-radius:${Number(layer.radius || 0) * scale}px;">
          ${resizeHandle}
        </div>
      `;
    }
    return `
      <div class="mcn-layer ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}" data-layer-id="${layer.id}" data-layer-locked="${locked ? '1' : '0'}" style="${baseStyle};overflow:visible;">
        <div style="width:100%;height:100%;background:${layer.backgroundColor || '#ffffff'};border:${Number(layer.borderWidth || 0) * scale}px solid ${layer.borderColor || 'transparent'};border-radius:${Number(layer.borderRadius || 0) * scale}px;overflow:hidden;">
          ${layer.src ? `<img src="${layer.src}" alt="" style="width:100%;height:100%;object-fit:${layer.fit || 'cover'};display:block;">` : '<div class="mcn-empty-image">이미지</div>'}
        </div>
        ${resizeHandle}
      </div>
    `;
  }

  function renderStageQuickEditor(layer) {
    if (!layer) return '';
    if (layer.type === 'text') {
      return `
        <div class="mcn-card mcn-quick-editor">
          <div class="mcn-card-head"><h3>\uC120\uD0DD \uB808\uC774\uC5B4 \uBE60\uB978 \uD3B8\uC9D1</h3><span class="mcn-layer-badge">\uD14D\uC2A4\uD2B8</span></div>
          <div class="mcn-quick-grid">
            ${field('\uD14D\uC2A4\uD2B8', `<textarea rows="3" data-quick-layer-field="text">${esc(layer.text || '')}</textarea>`)}
            ${field('\uD3F0\uD2B8', `<select data-quick-layer-field="fontFamily">${FONT_OPTIONS.map((font) => `<option value="${font}" ${layer.fontFamily === font ? 'selected' : ''}>${font}</option>`).join('')}</select>`)}
            ${field('\uAE00\uC790 \uD06C\uAE30', `<input type="number" min="10" value="${Number(layer.fontSize || 40)}" data-quick-layer-field="fontSize">`)}
            ${field('\uAD75\uAE30', `<input type="number" min="100" max="900" step="100" value="${Number(layer.fontWeight || 700)}" data-quick-layer-field="fontWeight">`)}
            ${field('\uC815\uB82C', `<select data-quick-layer-field="align"><option value="left" ${layer.align === 'left' ? 'selected' : ''}>\uC67C\uCABD</option><option value="center" ${layer.align === 'center' ? 'selected' : ''}>\uAC00\uC6B4\uB370</option><option value="right" ${layer.align === 'right' ? 'selected' : ''}>\uC624\uB978\uCABD</option></select>`)}
            ${field('\uAE00\uC790\uC0C9', `<input type="color" value="${esc(layer.color || '#111111')}" data-quick-layer-field="color">`)}
            ${field('\uC904 \uAC04\uACA9', `<input type="number" min="1" max="2.4" step="0.05" value="${Number(layer.lineHeight || 1.3)}" data-quick-layer-field="lineHeight">`)}
          </div>
        </div>
      `;
    }
    if (layer.type === 'shape') {
      return `
        <div class="mcn-card mcn-quick-editor">
          <div class="mcn-card-head"><h3>\uC120\uD0DD \uB808\uC774\uC5B4 \uBE60\uB978 \uD3B8\uC9D1</h3><span class="mcn-layer-badge">\uB3C4\uD615</span></div>
          <div class="mcn-quick-grid">
            ${field('\uCC44\uC6B0\uAE30', `<input type="color" value="${esc(layer.fill || '#ffffff')}" data-quick-layer-field="fill">`)}
            ${field('\uC120 \uC0C9\uC0C1', `<input type="color" value="${esc(layer.stroke || '#ffffff')}" data-quick-layer-field="stroke">`)}
            ${field('\uC120 \uB450\uAED8', `<input type="number" min="0" value="${Number(layer.strokeWidth || 0)}" data-quick-layer-field="strokeWidth">`)}
            ${field('\uBAA8\uC11C\uB9AC', `<input type="number" min="0" value="${Number(layer.radius || 0)}" data-quick-layer-field="radius">`)}
          </div>
        </div>
      `;
    }
    return `
      <div class="mcn-card mcn-quick-editor">
        <div class="mcn-card-head"><h3>\uC120\uD0DD \uB808\uC774\uC5B4 \uBE60\uB978 \uD3B8\uC9D1</h3><span class="mcn-layer-badge">\uC774\uBBF8\uC9C0</span></div>
        <div class="mcn-quick-grid">
          ${field('\uB9DE\uCDA4 \uBC29\uC2DD', `<select data-quick-layer-field="fit"><option value="cover" ${layer.fit === 'cover' ? 'selected' : ''}>\uCC44\uC6B0\uAE30</option><option value="contain" ${layer.fit === 'contain' ? 'selected' : ''}>\uB9DE\uCD94\uAE30</option></select>`)}
          ${field('\uBC30\uACBD\uC0C9', `<input type="color" value="${esc(layer.backgroundColor || '#ffffff')}" data-quick-layer-field="backgroundColor">`)}
          ${field('\uD14C\uB450\uB9AC\uC0C9', `<input type="color" value="${esc(layer.borderColor || '#ffffff')}" data-quick-layer-field="borderColor">`)}
          ${field('\uBAA8\uC11C\uB9AC', `<input type="number" min="0" value="${Number(layer.borderRadius || 0)}" data-quick-layer-field="borderRadius">`)}
        </div>
      </div>
    `;
  }

  function renderLayerList() {
    const slide = currentSlide();
    if (!slide) return '';
    return `
      <div class="mcn-card">
        <div class="mcn-card-head">
          <h3>\uB808\uC774\uC5B4</h3>
          <div class="mcn-row">
            <button class="mcn-icon-btn" onclick="window.mcnAddTextLayer()">T</button>
            <button class="mcn-icon-btn" onclick="window.mcnAddShapeLayer()">\uB3C4\uD615</button>
            <button class="mcn-icon-btn" onclick="window.mcnAddImageLayer()">\uC774\uBBF8\uC9C0</button>
          </div>
        </div>
        <div class="mcn-layer-list">
          ${slide.layers.map((layer, index) => `
            <button class="mcn-layer-list-item ${layer.id === state.selectedLayerId ? 'is-active' : ''}" data-layer-id="${layer.id}">
              <div>
                <strong>${index + 1}. ${esc(layer.name || layer.type)}</strong>
                <span>${layer.type === 'text' ? '\uD14D\uC2A4\uD2B8' : layer.type === 'shape' ? '\uB3C4\uD615' : '\uC774\uBBF8\uC9C0'} \u00B7 ${Math.round(layer.width)}\u00D7${Math.round(layer.height)}</span>
              </div>
              <span class="mcn-layer-badge">${layer.type}</span>
            </button>
          `).join('')}
        </div>
        <div class="mcn-row" style="margin-top:12px;">
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnMoveLayer(-1)">\uC55E\uC73C\uB85C</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnMoveLayer(1)">\uB4A4\uB85C</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnDuplicateLayer()">\uBCF5\uC81C</button>
          <button class="mcn-btn mcn-btn-danger" onclick="window.mcnDeleteLayer()">\uC0AD\uC81C</button>
        </div>
      </div>
    `;
  }

  function renderInspector() {
    const slide = currentSlide();
    const layer = currentLayer();
    if (!slide) return '';

    const slideCard = `
      <div class="mcn-card">
        <h3>???? ??</h3>
        ${field('??', `<input type="text" value="${esc(slide.title)}" data-slide-field="title">`)}
        ${field('??', `<select data-slide-field="ratioKey">${Object.entries(RATIOS).map(([key, meta]) => `<option value="${key}" ${slide.ratioKey === key ? 'selected' : ''}>${meta.label}</option>`).join('')}</select>`)}
        ${field('?? ??', `<select data-slide-field="backgroundMode"><option value="gradient" ${slide.backgroundMode === 'gradient' ? 'selected' : ''}>?????</option><option value="solid" ${slide.backgroundMode === 'solid' ? 'selected' : ''}>??</option><option value="image" ${slide.backgroundMode === 'image' ? 'selected' : ''}>???</option></select>`)}
        ${field('??? 1', `<input type="color" value="${esc(slide.backgroundColor || '#ffffff')}" data-slide-field="backgroundColor">`)}
        ${field('??? 2', `<input type="color" value="${esc(slide.backgroundColor2 || '#f3f4f6')}" data-slide-field="backgroundColor2">`)}
        <label class="mcn-field"><span>?? ???</span><input type="file" accept="image/*" data-slide-upload="background"></label>
        <div class="mcn-row">
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnMoveSlide(-1)">???</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnMoveSlide(1)">??</button>
          <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnDuplicateSlide()">??</button>
          <button class="mcn-btn mcn-btn-danger" onclick="window.mcnDeleteSlide()">??</button>
        </div>
      </div>
    `;

    if (!layer) return slideCard;

    const common = `
      ${field('??', `<input type="text" value="${esc(layer.name || '')}" data-layer-field="name">`)}
      ${field('X', `<input type="number" value="${Number(layer.x || 0)}" data-layer-field="x">`)}
      ${field('Y', `<input type="number" value="${Number(layer.y || 0)}" data-layer-field="y">`)}
      ${field('??', `<input type="number" min="20" value="${Number(layer.width || 0)}" data-layer-field="width">`)}
      ${field('??', `<input type="number" min="20" value="${Number(layer.height || 0)}" data-layer-field="height">`)}
      ${field('??', `<input type="number" value="${Number(layer.rotation || 0)}" data-layer-field="rotation">`)}
      ${field('???', `<input type="number" min="0" max="1" step="0.05" value="${Number(layer.opacity ?? 1)}" data-layer-field="opacity">`)}
    `;

    let detailCard = '';
    if (layer.type === 'text') {
      detailCard = `
        <div class="mcn-card">
          <h3>??? ??</h3>
          ${common}
          ${field('???', `<textarea rows="5" data-layer-field="text">${esc(layer.text || '')}</textarea>`)}
          ${field('??', `<select data-layer-field="fontFamily">${FONT_OPTIONS.map((font) => `<option value="${font}" ${layer.fontFamily === font ? 'selected' : ''}>${font}</option>`).join('')}</select>`)}
          ${field('?? ??', `<input type="number" min="10" value="${Number(layer.fontSize || 40)}" data-layer-field="fontSize">`)}
          ${field('??', `<input type="number" min="100" max="900" step="100" value="${Number(layer.fontWeight || 700)}" data-layer-field="fontWeight">`)}
          ${field('??', `<select data-layer-field="align"><option value="left" ${layer.align === 'left' ? 'selected' : ''}>??</option><option value="center" ${layer.align === 'center' ? 'selected' : ''}>???</option><option value="right" ${layer.align === 'right' ? 'selected' : ''}>???</option></select>`)}
          ${field('??', `<input type="color" value="${esc(layer.color || '#111111')}" data-layer-field="color">`)}
          ${field('? ??', `<input type="number" min="1" max="2.4" step="0.05" value="${Number(layer.lineHeight || 1.3)}" data-layer-field="lineHeight">`)}
        </div>
      `;
    } else if (layer.type === 'shape') {
      detailCard = `
        <div class="mcn-card">
          <h3>?? ??</h3>
          ${common}
          ${field('???', `<input type="color" value="${esc(layer.fill || '#ffffff')}" data-layer-field="fill">`)}
          ${field('???', `<input type="color" value="${esc(layer.stroke || '#ffffff')}" data-layer-field="stroke">`)}
          ${field('? ??', `<input type="number" min="0" value="${Number(layer.strokeWidth || 0)}" data-layer-field="strokeWidth">`)}
          ${field('???', `<input type="number" min="0" value="${Number(layer.radius || 0)}" data-layer-field="radius">`)}
        </div>
      `;
    } else {
      detailCard = `
        <div class="mcn-card">
          <h3>??? ??</h3>
          ${common}
          <label class="mcn-field"><span>??? ???</span><input type="file" accept="image/*" data-layer-upload="image"></label>
          ${field('?? ??', `<select data-layer-field="fit"><option value="cover" ${layer.fit === 'cover' ? 'selected' : ''}>???</option><option value="contain" ${layer.fit === 'contain' ? 'selected' : ''}>???</option></select>`)}
          ${field('???', `<input type="color" value="${esc(layer.backgroundColor || '#ffffff')}" data-layer-field="backgroundColor">`)}
          ${field('????', `<input type="color" value="${esc(layer.borderColor || '#ffffff')}" data-layer-field="borderColor">`)}
          ${field('??? ??', `<input type="number" min="0" value="${Number(layer.borderWidth || 0)}" data-layer-field="borderWidth">`)}
          ${field('???', `<input type="number" min="0" value="${Number(layer.borderRadius || 0)}" data-layer-field="borderRadius">`)}
        </div>
      `;
    }

    return `${slideCard}${detailCard}`;
  }

  function ensureGoogleFontStylesheet() {
    if (document.getElementById('mcn-google-fonts')) return;
    const preconnectA = document.createElement('link');
    preconnectA.rel = 'preconnect';
    preconnectA.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnectA);
    const preconnectB = document.createElement('link');
    preconnectB.rel = 'preconnect';
    preconnectB.href = 'https://fonts.gstatic.com';
    preconnectB.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectB);
    const link = document.createElement('link');
    link.id = 'mcn-google-fonts';
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONT_HREF;
    document.head.appendChild(link);
  }

  function ensureStyles() {
    if (document.getElementById('manual-cardnews-editor-style')) return;
    const style = document.createElement('style');
    style.id = 'manual-cardnews-editor-style';
    style.textContent = `
      .mcn-root{max-width:1560px;margin:0 auto;padding:10px 0 26px}
      .mcn-hero{display:grid;grid-template-columns:minmax(0,1.7fr) repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .mcn-hero-card{background:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.88));border:1px solid rgba(0,0,0,0.06);border-radius:20px;padding:18px}
      .mcn-hero-card h2,.mcn-card h3{margin:0;font-size:16px;color:#111827}
      .mcn-hero-card p,.mcn-section-copy{margin:8px 0 0;font-size:12px;line-height:1.6;color:rgba(0,0,0,0.52)}
      .mcn-stat-number{display:block;font-size:26px;font-weight:900;color:#111827}
      .mcn-stat-label{display:block;margin-top:6px;font-size:12px;color:rgba(0,0,0,0.46)}
      .mcn-shell{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;align-items:start}
      .mcn-column{display:flex;flex-direction:column;gap:12px;min-width:0}
      .mcn-card{background:rgba(255,255,255,0.93);border:1px solid rgba(0,0,0,0.06);border-radius:18px;padding:14px}
      .mcn-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
      .mcn-tabs{display:flex;gap:8px}
      .mcn-tab{flex:1;border:none;background:rgba(0,0,0,0.05);color:#111827;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer}
      .mcn-tab.is-active{background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;box-shadow:0 10px 24px rgba(255,140,0,0.22)}
      .mcn-row{display:flex;gap:8px;flex-wrap:wrap}
      .mcn-quick-editor{margin-bottom:12px}
      .mcn-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .mcn-btn,.mcn-icon-btn{border:none;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff}
      .mcn-btn:disabled{opacity:0.5;cursor:not-allowed}
      .mcn-btn-secondary,.mcn-icon-btn{background:rgba(0,0,0,0.05);color:#111827}
      .mcn-btn-danger{background:rgba(255,59,48,0.12);color:#ff3b30}
      .mcn-field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
      .mcn-field span{font-size:11px;color:rgba(0,0,0,0.5);font-weight:700}
      .mcn-field input,.mcn-field textarea,.mcn-field select{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,0.1);border-radius:12px;padding:10px 12px;font-size:12px;background:#fff}
      .mcn-preset-summary{padding:12px;border-radius:14px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.16);margin:10px 0}
      .mcn-preset-summary strong{display:block;font-size:13px}
      .mcn-preset-summary span,.mcn-preset-summary small{display:block;margin-top:4px;color:rgba(0,0,0,0.58);font-size:11px}
      .mcn-chip-row{display:flex;flex-wrap:wrap;gap:6px}
      .mcn-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.05);font-size:11px;font-weight:700;color:#374151}
      .mcn-workspace-card{padding:12px}
      .mcn-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px;flex-wrap:wrap}
      .mcn-toolbar-meta{display:flex;gap:8px;flex-wrap:wrap}
      .mcn-toolbar-badge{display:inline-flex;align-items:center;padding:8px 10px;border-radius:999px;background:rgba(255,140,0,0.08);font-size:11px;font-weight:700;color:#b45309}
      .mcn-workspace-grid{display:grid;grid-template-columns:132px minmax(0,1fr);gap:10px;min-height:920px}
      .mcn-slide-rail{display:flex;flex-direction:column;gap:10px}
      .mcn-slide-rail-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
      .mcn-slide-list{display:flex;flex-direction:column;gap:8px;max-height:860px;overflow:auto;padding-right:2px}
      .mcn-slide-card{border:1px solid rgba(0,0,0,0.08);background:#fff;border-radius:14px;padding:6px;text-align:left;cursor:pointer}
      .mcn-slide-card.is-active{border-color:rgba(255,140,0,0.45);box-shadow:0 0 0 3px rgba(255,140,0,0.12)}
      .mcn-slide-card strong{display:block;font-size:11px;color:#111827}
      .mcn-slide-card span{display:block;margin-top:3px;font-size:9px;color:rgba(0,0,0,0.46)}
      .mcn-slide-thumb{height:84px;border-radius:10px;padding:8px;border:1px solid rgba(0,0,0,0.06);margin-bottom:6px}
      .mcn-slide-thumb-inner{height:100%;border-radius:8px;background:rgba(255,255,255,0.84);padding:8px}
      .mcn-slide-kicker{font-size:9px;font-weight:800;color:#ff8c00;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mcn-slide-title{margin-top:4px;font-size:10px;font-weight:900;color:#111827;line-height:1.2;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .mcn-stage-frame{display:flex;align-items:center;justify-content:center;min-height:920px;border-radius:18px;background:linear-gradient(180deg,#ededf3,#e5e7eb);padding:10px;overflow:auto}
      .mcn-stage{position:relative;border-radius:28px;box-shadow:0 28px 64px rgba(15,23,42,0.16);flex:none}
      .mcn-stage.show-grid::before{content:"";position:absolute;inset:0;border-radius:28px;background-image:linear-gradient(rgba(0,0,0,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.035) 1px,transparent 1px);background-size:54px 54px;pointer-events:none}
      .mcn-layer{position:absolute;box-sizing:border-box;cursor:move;user-select:none}
      .mcn-layer.is-selected{outline:2px solid #ff8c00;outline-offset:2px;z-index:4}
      .mcn-layer.is-locked{cursor:default;pointer-events:none}
      .mcn-layer.is-locked img{pointer-events:none}
      .mcn-layer-resize{position:absolute;right:-10px;bottom:-10px;width:22px;height:22px;border:none;border-radius:999px;background:#ff8c00;box-shadow:0 10px 24px rgba(255,140,0,0.28);cursor:nwse-resize;z-index:6}
      .mcn-layer-resize::before{content:"";position:absolute;inset:6px;border-right:2px solid #fff;border-bottom:2px solid #fff}
      .mcn-empty-image{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(0,0,0,0.34);font-size:12px;background:linear-gradient(135deg,#f3f4f6,#e5e7eb)}
      .mcn-text-content{min-height:1em;outline:none;border-radius:6px;transition:background 0.15s;cursor:text}
      .mcn-text-content:hover,.mcn-text-content.is-editing,.mcn-text-content:focus{background:rgba(255,140,0,0.06)}
      .mcn-inline-toolbar{position:absolute;left:0;bottom:calc(100% + 8px);display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;background:rgba(17,24,39,0.92);box-shadow:0 12px 28px rgba(15,23,42,0.28);z-index:8}
      .mcn-inline-toolbar select,.mcn-inline-toolbar input{border:none;border-radius:8px;padding:6px 8px;font-size:11px;background:#fff;color:#111827}
      .mcn-inline-toolbar input[type="number"]{width:70px}
      .mcn-inline-toolbar input[type="color"]{width:36px;height:32px;padding:2px}
      .mcn-layer-list{display:flex;flex-direction:column;gap:8px}
      .mcn-layer-list-item{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;width:100%;text-align:left;border:1px solid rgba(0,0,0,0.08);background:#fff;border-radius:14px;padding:12px;cursor:pointer}
      .mcn-layer-list-item.is-active{border-color:rgba(255,140,0,0.45);box-shadow:0 0 0 3px rgba(255,140,0,0.12)}
      .mcn-layer-list-item strong{display:block;font-size:12px;color:#111827}
      .mcn-layer-list-item span{display:block;margin-top:4px;font-size:10px;color:rgba(0,0,0,0.46)}
      .mcn-layer-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(0,0,0,0.05);font-size:10px;font-weight:700;color:#374151;text-transform:uppercase}
      .mcn-asset-grid,.mcn-unsplash-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .mcn-asset-card{border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:10px;background:#fff}
      .mcn-asset-card strong{display:block;font-size:12px;margin-bottom:8px}
      .mcn-asset-preview{aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;margin-bottom:8px}
      .mcn-asset-preview img{width:100%;height:100%;object-fit:cover;display:block}
      .mcn-asset-empty,.mcn-empty-block{font-size:11px;color:rgba(0,0,0,0.45)}
      .mcn-empty-block{padding:12px;border-radius:12px;background:rgba(0,0,0,0.04)}
      .mcn-unsplash-card{border:none;background:#fff;padding:0;text-align:left;cursor:pointer}
      .mcn-unsplash-thumb{aspect-ratio:4/5;border-radius:12px;overflow:hidden;background:#f3f4f6}
      .mcn-unsplash-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .mcn-unsplash-meta{padding-top:6px;font-size:10px;color:rgba(0,0,0,0.46)}
      @media (max-width: 1420px){.mcn-shell{grid-template-columns:230px minmax(0,1fr)}}
      @media (max-width: 1080px){.mcn-hero{grid-template-columns:1fr 1fr}.mcn-shell{grid-template-columns:1fr}.mcn-workspace-grid{grid-template-columns:1fr}.mcn-slide-list{flex-direction:row;overflow:auto;max-height:none}.mcn-slide-rail{overflow:hidden}.mcn-slide-card{min-width:200px}.mcn-stage-frame{min-height:520px}}
      @media (max-width: 720px){.mcn-root{padding-bottom:16px}.mcn-hero{grid-template-columns:1fr}.mcn-card,.mcn-hero-card{padding:14px}.mcn-stage-frame{padding:10px}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    const root = document.getElementById('manual-cardnews-root');
    if (!root || !state) return;
    ensureStyles();
    ensureGoogleFontStylesheet();
    const slide = currentSlide();
    if (!slide) return;
    const scale = scaleForStage();
    const ratio = ratioMeta(slide.ratioKey);
    const stageWidth = ratio.width * scale;
    const stageHeight = ratio.height * scale;
    const selectedLayer = currentLayer();

    root.innerHTML = `
      <div class="mcn-root">
        <div class="mcn-shell">
          <div class="mcn-column">
            <div class="mcn-card"><div class="mcn-tabs"><button class="mcn-tab ${state.uiPanel !== 'assets' ? 'is-active' : ''}" data-ui-panel="ai">AI</button><button class="mcn-tab ${state.uiPanel === 'assets' ? 'is-active' : ''}" data-ui-panel="assets">\uC18C\uC7AC</button></div></div>
            ${renderTopPanel()}
          </div>
          <div class="mcn-column">
            <div class="mcn-card mcn-workspace-card">
              <div class="mcn-toolbar">
                <div><h3 style="margin:0;font-size:18px;">${esc(slide.title)}</h3><p class="mcn-section-copy">${selectedLayer ? `${esc(selectedLayer.name)} \uB808\uC774\uC5B4\uB97C \uD3B8\uC9D1 \uC911\uC785\uB2C8\uB2E4.` : '\uC2AC\uB77C\uC774\uB4DC\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.'}</p></div>
                <div class="mcn-toolbar-meta"><span class="mcn-toolbar-badge">${esc(ratio.label)}</span><span class="mcn-toolbar-badge">${state.showGrid ? '\uADF8\uB9AC\uB4DC \uD45C\uC2DC' : '\uADF8\uB9AC\uB4DC \uC228\uAE40'}</span><span class="mcn-toolbar-badge">${autoAiRunning ? 'AI \uC0DD\uC131 \uC911' : '\uC218\uB3D9 \uD3B8\uC9D1 \uC911'}</span></div>
              </div>
              <div class="mcn-row" style="margin-bottom:12px;">
                <button class="mcn-btn" onclick="window.mcnAiAutoFill()" ${autoAiRunning ? 'disabled' : ''}>AI \uC790\uB3D9 \uCC44\uC6B0\uAE30</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAddTextLayer()">\uD14D\uC2A4\uD2B8 \uCD94\uAC00</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAddShapeLayer()">\uB3C4\uD615 \uCD94\uAC00</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnAddImageLayer()">\uC774\uBBF8\uC9C0 \uCD94\uAC00</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnToggleGrid()">${state.showGrid ? '\uADF8\uB9AC\uB4DC \uB044\uAE30' : '\uADF8\uB9AC\uB4DC \uCF1C\uAE30'}</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnExportCurrentSlide()">\uD604\uC7AC \uC2AC\uB77C\uC774\uB4DC \uC800\uC7A5</button>
                <button class="mcn-btn mcn-btn-secondary" onclick="window.mcnExportAllSlides()">\uC804\uCCB4 \uC800\uC7A5</button>
              </div>
              <div class="mcn-workspace-grid">
                <aside class="mcn-slide-rail">
                  <div class="mcn-slide-rail-head"><strong style="font-size:13px;">\uC2AC\uB77C\uC774\uB4DC</strong><div class="mcn-row"><button class="mcn-icon-btn" onclick="window.mcnAddSlide()">+</button><button class="mcn-icon-btn" onclick="window.mcnDuplicateSlide()">\uBCF5\uC81C</button></div></div>
                  <div class="mcn-slide-list">${renderSlideList()}</div>
                  ${renderLayerList()}
                </aside>
                <div class="mcn-stage-frame"><div class="mcn-stage ${state.showGrid ? 'show-grid' : ''}" id="mcn-stage" style="width:${stageWidth}px;height:${stageHeight}px;background:${slideBgCss(slide)};" data-scale="${scale}">${slide.layers.map((item) => renderLayerDom(item, scale)).join('')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    bindDomEvents();
  }

  function bindDomEvents() {
    document.querySelectorAll('[data-ui-panel]').forEach((button) => {
      button.onclick = () => setUiPanel(button.getAttribute('data-ui-panel'));
    });
    document.querySelectorAll('[data-preset-field]').forEach((input) => {
      input.onchange = () => updatePresetSelection(input.getAttribute('data-preset-field'), input.value);
    });
    document.querySelectorAll('[data-slide-id]').forEach((button) => {
      button.onclick = () => selectSlide(button.getAttribute('data-slide-id'));
    });
    document.querySelectorAll('[data-layer-id]').forEach((element) => {
      const locked = element.getAttribute('data-layer-locked') === '1';
      element.addEventListener('click', () => { if (!locked || !element.classList.contains('mcn-layer')) selectLayer(element.getAttribute('data-layer-id')); });
      if (element.classList.contains('mcn-layer') && !locked) {
        element.addEventListener('dblclick', () => startInlineTextEdit(element.getAttribute('data-layer-id')));
        element.addEventListener('pointerdown', startDrag);
      }
    });
    document.querySelectorAll('[data-layer-resize]').forEach((button) => {
      button.onpointerdown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        startResize(event, button.getAttribute('data-layer-resize'));
      };
    });
    document.querySelectorAll('[data-text-editor]').forEach((editor) => {
      editor.oninput = () => updateInlineText(editor.getAttribute('data-text-editor'), editor.innerText);
      editor.onblur = () => {
        updateInlineText(editor.getAttribute('data-text-editor'), editor.innerText);
        stopInlineTextEdit(editor.getAttribute('data-text-editor'));
      };
      editor.onpointerdown = (event) => event.stopPropagation();
      editor.onfocus = () => {
        const layerId = editor.getAttribute('data-text-editor');
        state.editingLayerId = layerId;
        state.selectedLayerId = layerId;
        saveState();
      };
    });
    document.querySelectorAll('[data-slide-field]').forEach((input) => {
      input.oninput = () => updateSlideField(input.getAttribute('data-slide-field'), input.value);
      input.onchange = () => updateSlideField(input.getAttribute('data-slide-field'), input.value);
    });
    document.querySelectorAll('[data-assist-field]').forEach((input) => {
      input.oninput = () => {
        state.aiAssist[input.getAttribute('data-assist-field')] = input.value;
        saveState();
      };
    });
    document.querySelectorAll('[data-layer-field]').forEach((input) => {
      input.oninput = () => updateLayerField(input.getAttribute('data-layer-field'), input.value);
      input.onchange = () => updateLayerField(input.getAttribute('data-layer-field'), input.value);
    });
    document.querySelectorAll('[data-quick-layer-field]').forEach((input) => {
      input.oninput = () => updateLayerField(input.getAttribute('data-quick-layer-field'), input.value);
      input.onchange = () => updateLayerField(input.getAttribute('data-quick-layer-field'), input.value);
      input.onpointerdown = (event) => event.stopPropagation();
    });
    document.querySelectorAll('[data-slide-upload="background"]').forEach((input) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        updateSlideField('backgroundMode', 'image');
        updateSlideField('backgroundImage', dataUrl);
      };
    });
    document.querySelectorAll('[data-layer-upload="image"]').forEach((input) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        updateLayerField('src', dataUrl);
      };
    });
    document.querySelectorAll('[data-asset-upload="source"]').forEach((input) => {
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        state.assetLab.sourceImage = await readFileAsDataUrl(file);
        setState({ ...state });
      };
    });
  }

  function setUiPanel(panel) {
    state.uiPanel = panel === 'compose' ? 'ai' : panel;
    setState({ ...state });
  }

  function updatePresetSelection(fieldName, value) {
    const nextSelection = applySelectionDefaults({ ...state.presetSelection, [fieldName]: value });
    state.presetSelection = nextSelection;
    if (fieldName === 'industry') {
      const preset = presetByKey(value);
      state.aiAssist.product = `${preset.name} 대표 상품 또는 서비스`;
      state.aiAssist.audience = `${preset.name} 고객층`;
    }
    if (fieldName === 'objective') {
      state.aiAssist.objective = `${axisItem('objective', value).label} 카드뉴스`;
    }
    setState({ ...state });
  }

  async function applySelectedPreset() {
    const preset = buildPresetFromSelection(state.presetSelection);
    const confirmed = typeof _mkkConfirm === 'function'
      ? await _mkkConfirm(`'${preset.name}' 조합으로 다시 시작할까요? 현재 슬라이드는 새 조합으로 재구성됩니다.`)
      : window.confirm(`'${preset.name}' 조합으로 다시 시작할까요? 현재 슬라이드는 새 조합으로 재구성됩니다.`);
    if (!confirmed) return;
    const next = createWorkspace(preset.baseKey || preset.key);
    next.presetSelection = { ...state.presetSelection };
    next.aiAssist = { ...state.aiAssist };
    next.slides = preset.slides.map((item) => buildSlideFromPreset(item, preset.accent));
    next.selectedSlideId = next.slides[0].id;
    next.selectedLayerId = next.slides[0].layers[2].id;
    setState(next);
    toastMessage(`${preset.name} 조합을 적용했습니다.`);
  }

  function selectSlide(slideId) {
    const slide = state.slides.find((item) => item.id === slideId);
    if (!slide) return;
    state.selectedSlideId = slideId;
    state.selectedLayerId = slide.layers.find((layer) => layer.type === 'text')?.id || slide.layers[0]?.id || null;
    state.editingLayerId = null;
    setState({ ...state });
  }

  function selectLayer(layerId) {
    const layer = currentSlide()?.layers?.find((item) => item.id === layerId);
    if (!layer) return;
    state.selectedLayerId = layerId;
    setState({ ...state });
  }

  function addSlide() {
    const preset = buildPresetFromSelection(state.presetSelection);
    const template = preset.slides[state.slides.length % preset.slides.length] || preset.slides[0];
    const slide = buildSlideFromPreset(template, preset.accent);
    slide.title = `새 슬라이드 ${state.slides.length + 1}`;
    state.slides.push(slide);
    state.selectedSlideId = slide.id;
    state.selectedLayerId = slide.layers[2].id;
    setState({ ...state });
  }

  function duplicateSlide() {
    const slide = currentSlide();
    if (!slide) return;
    const cloned = JSON.parse(JSON.stringify(slide));
    cloned.id = uid('slide');
    cloned.title = `${slide.title} 복제본`;
    cloned.layers = cloned.layers.map((layer) => ({ ...layer, id: uid(layer.type) }));
    state.slides.splice(state.slides.indexOf(slide) + 1, 0, cloned);
    state.selectedSlideId = cloned.id;
    state.selectedLayerId = cloned.layers[0]?.id || null;
    setState({ ...state });
  }

  function deleteSlide() {
    if (state.slides.length <= 1) {
      toastMessage('슬라이드는 최소 1장 필요합니다.', 'error');
      return;
    }
    state.slides = state.slides.filter((item) => item.id !== state.selectedSlideId);
    state.selectedSlideId = state.slides[0].id;
    state.selectedLayerId = state.slides[0].layers[0]?.id || null;
    setState({ ...state });
  }

  function moveSlide(direction) {
    const index = state.slides.findIndex((item) => item.id === state.selectedSlideId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.slides.length) return;
    const [slide] = state.slides.splice(index, 1);
    state.slides.splice(target, 0, slide);
    setState({ ...state });
  }

  function addTextLayer() {
    const slide = currentSlide();
    const layer = createTextLayer({ x: 140, y: 240, width: 720, height: 120, text: '새 텍스트' });
    slide.layers.push(layer);
    state.selectedLayerId = layer.id;
    setState({ ...state });
  }

  function addShapeLayer() {
    const slide = currentSlide();
    const layer = createShapeLayer({ x: 180, y: 220, width: 260, height: 160, fill: '#ffd7a8' });
    slide.layers.push(layer);
    state.selectedLayerId = layer.id;
    setState({ ...state });
  }

  function addImageLayer() {
    const slide = currentSlide();
    const layer = createImageLayer({ x: 150, y: 420, width: 780, height: 380 });
    slide.layers.push(layer);
    state.selectedLayerId = layer.id;
    setState({ ...state });
  }

  function duplicateLayer() {
    const slide = currentSlide();
    const layer = currentLayer();
    if (!slide || !layer) return;
    const clone = JSON.parse(JSON.stringify(layer));
    clone.id = uid(layer.type);
    clone.name = `${layer.name} 복제`;
    clone.x += 18;
    clone.y += 18;
    slide.layers.push(clone);
    state.selectedLayerId = clone.id;
    setState({ ...state });
  }

  function deleteLayer() {
    const slide = currentSlide();
    if (!slide || !state.selectedLayerId) return;
    if (slide.layers.length <= 1) {
      toastMessage('레이어는 최소 1개 필요합니다.', 'error');
      return;
    }
    slide.layers = slide.layers.filter((item) => item.id !== state.selectedLayerId);
    state.selectedLayerId = slide.layers[0]?.id || null;
    setState({ ...state });
  }

  function moveLayer(direction) {
    const slide = currentSlide();
    const index = slide?.layers?.findIndex((item) => item.id === state.selectedLayerId);
    const target = index + direction;
    if (!slide || index < 0 || target < 0 || target >= slide.layers.length) return;
    const [layer] = slide.layers.splice(index, 1);
    slide.layers.splice(target, 0, layer);
    setState({ ...state });
  }

  function coerceValue(fieldName, value) {
    const numericFields = new Set(['x', 'y', 'width', 'height', 'rotation', 'fontSize', 'fontWeight', 'lineHeight', 'opacity', 'strokeWidth', 'radius', 'borderWidth', 'borderRadius']);
    return numericFields.has(fieldName) ? Number(value) : value;
  }

  function updateSlideField(fieldName, value) {
    const slide = currentSlide();
    if (!slide) return;
    slide[fieldName] = fieldName === 'ratioKey' || fieldName === 'backgroundMode' ? value : coerceValue(fieldName, value);
    setState({ ...state });
  }

  function updateLayerField(fieldName, value) {
    const layer = currentLayer();
    if (!layer) return;
    layer[fieldName] = coerceValue(fieldName, value);
    setState({ ...state });
  }

  function startInlineTextEdit(layerId) {
    const layer = currentSlide()?.layers?.find((item) => item.id === layerId);
    if (!layer || layer.type !== 'text') return;
    state.editingLayerId = layerId;
    state.selectedLayerId = layerId;
    setState({ ...state });
    requestAnimationFrame(() => {
      const editor = document.querySelector(`[data-text-editor="${layerId}"]`);
      if (!editor) return;
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }

  function stopInlineTextEdit(layerId) {
    if (state.editingLayerId !== layerId) return;
    state.editingLayerId = null;
    saveState();
  }

  function updateInlineText(layerId, text) {
    const layer = currentSlide()?.layers?.find((item) => item.id === layerId);
    if (!layer || layer.type !== 'text') return;
    layer.text = text;
    saveState();
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function nudgeCurrentLayer(deltaX, deltaY) {
    const layer = currentLayer();
    if (!layer || isLockedLayer(layer)) return;
    layer.x = Math.max(0, Number(layer.x || 0) + deltaX);
    layer.y = Math.max(0, Number(layer.y || 0) + deltaY);
    setState({ ...state });
  }

  function handleWorkspaceKeydown(event) {
    const root = document.getElementById('manual-cardnews-root');
    const page = document.getElementById('page-manual-cardnews');
    if (!root || !page?.classList.contains('active')) return;

    const layer = currentLayer();
    const typing = isTypingTarget(event.target);
    const step = event.shiftKey ? 10 : 1;

    if ((event.key === 'Delete' || event.key === 'Backspace') && !typing && layer) {
      event.preventDefault();
      deleteLayer();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && !typing && layer) {
      event.preventDefault();
      duplicateLayer();
      return;
    }
    if (event.key === 'Enter' && !typing && layer?.type === 'text') {
      event.preventDefault();
      startInlineTextEdit(layer.id);
      return;
    }
    if (event.key === 'Escape' && state.editingLayerId) {
      event.preventDefault();
      stopInlineTextEdit(state.editingLayerId);
      render();
      return;
    }
    if (!typing && layer) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeCurrentLayer(-step, 0);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeCurrentLayer(step, 0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeCurrentLayer(0, -step);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeCurrentLayer(0, step);
      }
    }
  }

  function toggleGrid() {
    state.showGrid = !state.showGrid;
    setState({ ...state });
  }

  async function resetWorkspace() {
    const confirmed = typeof _mkkConfirm === 'function'
      ? await _mkkConfirm('현재 카드뉴스 작업공간을 초기화할까요?')
      : window.confirm('현재 카드뉴스 작업공간을 초기화할까요?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = createWorkspace(detectPresetKeyFromProfile());
    syncAiAssistFromSelection();
    setState({ ...state });
    toastMessage('카드뉴스 편집 작업공간을 초기화했습니다.');
  }

  function startDrag(event) {
    const layerId = event.currentTarget.getAttribute('data-layer-id');
    const layer = currentSlide()?.layers?.find((item) => item.id === layerId);
    const stage = document.getElementById('mcn-stage');
    if (!layer || !stage) return;
    state.selectedLayerId = layerId;
    const scale = Number(stage.dataset.scale || '1');
    dragState = { layerId, startX: event.clientX, startY: event.clientY, originX: layer.x, originY: layer.y, scale };
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', stopDrag);
  }

  function onDragMove(event) {
    if (!dragState) return;
    const layer = currentLayer();
    if (!layer) return;
    layer.x = Math.max(0, Math.round(dragState.originX + ((event.clientX - dragState.startX) / dragState.scale)));
    layer.y = Math.max(0, Math.round(dragState.originY + ((event.clientY - dragState.startY) / dragState.scale)));
    setStateSilently({ ...state });
    render();
  }

  function stopDrag() {
    dragState = null;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', stopDrag);
  }

  function startResize(event, layerId) {
    const layer = currentSlide()?.layers?.find((item) => item.id === layerId);
    const stage = document.getElementById('mcn-stage');
    if (!layer || !stage) return;
    resizeState = {
      layerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: Number(layer.width || 0),
      originHeight: Number(layer.height || 0),
      originFontSize: Number(layer.fontSize || 0),
      type: layer.type,
      scale: Number(stage.dataset.scale || '1'),
    };
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', stopResize);
  }

  function onResizeMove(event) {
    if (!resizeState) return;
    const layer = currentLayer();
    if (!layer) return;
    const dx = (event.clientX - resizeState.startX) / resizeState.scale;
    const dy = (event.clientY - resizeState.startY) / resizeState.scale;
    layer.width = Math.max(80, Math.round(resizeState.originWidth + dx));
    layer.height = Math.max(48, Math.round(resizeState.originHeight + dy));
    if (resizeState.type === 'text') {
      layer.fontSize = Math.max(14, Math.round(resizeState.originFontSize + Math.max(dx, dy) * 0.08));
    }
    setStateSilently({ ...state });
    render();
  }

  function stopResize() {
    resizeState = null;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', stopResize);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function ensureFontReady(fontFamily, fontSize) {
    if (!fontFamily) return;
    if (GOOGLE_FONT_NAMES.has(fontFamily)) ensureGoogleFontStylesheet();
    if (!document.fonts?.load) return;
    try {
      await document.fonts.load(`700 ${Math.max(16, Number(fontSize || 40))}px "${fontFamily}"`);
    } catch (error) {
      console.warn('[manual-cardnews] font load skipped', fontFamily, error);
    }
  }

  function wrapText(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(' ');
      let line = '';
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      });
      lines.push(line);
    });
    return lines.filter(Boolean);
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke, strokeWidth) {
    const r = Math.max(0, Math.min(radius || 0, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    if (fill && fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && stroke !== 'transparent' && strokeWidth) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }

  async function renderSlideToCanvas(slide) {
    const ratio = ratioMeta(slide.ratioKey);
    const canvas = document.createElement('canvas');
    canvas.width = ratio.width;
    canvas.height = ratio.height;
    const ctx = canvas.getContext('2d');

    if (slide.backgroundMode === 'solid') {
      ctx.fillStyle = slide.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (slide.backgroundMode === 'image' && slide.backgroundImage) {
      const bg = await loadImage(slide.backgroundImage);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, slide.backgroundColor || '#ffffff');
      gradient.addColorStop(1, slide.backgroundColor2 || '#f3f4f6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const layer of slide.layers) {
      ctx.save();
      ctx.globalAlpha = Number(layer.opacity ?? 1);
      ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
      ctx.rotate((Number(layer.rotation || 0) * Math.PI) / 180);
      ctx.translate(-layer.width / 2, -layer.height / 2);
      if (layer.type === 'shape') {
        roundRect(ctx, 0, 0, layer.width, layer.height, layer.radius, layer.fill, layer.stroke, layer.strokeWidth);
      } else if (layer.type === 'image') {
        roundRect(ctx, 0, 0, layer.width, layer.height, layer.borderRadius, layer.backgroundColor, layer.borderColor, layer.borderWidth);
        if (layer.src) {
          const img = await loadImage(layer.src);
          ctx.save();
          roundRect(ctx, 0, 0, layer.width, layer.height, layer.borderRadius, null, null, 0);
          ctx.clip();
          if ((layer.fit || 'cover') === 'contain') {
            const scale = Math.min(layer.width / img.width, layer.height / img.height);
            const width = img.width * scale;
            const height = img.height * scale;
            ctx.drawImage(img, (layer.width - width) / 2, (layer.height - height) / 2, width, height);
          } else {
            const scale = Math.max(layer.width / img.width, layer.height / img.height);
            const width = img.width * scale;
            const height = img.height * scale;
            ctx.drawImage(img, (layer.width - width) / 2, (layer.height - height) / 2, width, height);
          }
          ctx.restore();
        }
      } else {
        await ensureFontReady(layer.fontFamily, layer.fontSize);
        ctx.font = `${Number(layer.fontWeight || 700)} ${Number(layer.fontSize || 40)}px ${layer.fontFamily || 'Pretendard'}`;
        ctx.fillStyle = layer.color || '#111111';
        ctx.textBaseline = 'top';
        ctx.textAlign = layer.align || 'left';
        const x = layer.align === 'center' ? layer.width / 2 : layer.align === 'right' ? layer.width : 0;
        let y = 0;
        wrapText(ctx, layer.text || '', layer.width).forEach((line) => {
          ctx.fillText(line, x, y);
          y += Number(layer.fontSize || 40) * Number(layer.lineHeight || 1.3);
        });
      }
      ctx.restore();
    }

    return canvas;
  }

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  }

  async function exportCurrentSlide() {
    const slide = currentSlide();
    if (!slide) return;
    const canvas = await renderSlideToCanvas(slide);
    downloadCanvas(canvas, `${slide.title || 'slide'}.png`);
  }

  async function exportAllSlides() {
    for (let index = 0; index < state.slides.length; index += 1) {
      const slide = state.slides[index];
      const canvas = await renderSlideToCanvas(slide);
      downloadCanvas(canvas, `${String(index + 1).padStart(2, '0')}-${slide.title || 'slide'}.png`);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  async function aiGenerateScript() {
    const preset = presetByKey(state.presetSelection.industry);
    toastMessage('AI가 카드뉴스 문구를 만드는 중입니다.');
    const response = await fetch('/api/ecommerce/cardnews-assist/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: preset.name,
        objective: state.aiAssist.objective,
        product: state.aiAssist.product,
        audience: state.aiAssist.audience,
        tone: state.aiAssist.tone,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    const slides = (data.slides || []).map((item) => buildSlideFromPreset({
      title: item.title || '슬라이드',
      kicker: item.kicker || preset.name,
      heading: item.heading || '헤드라인',
      body: item.body || '',
      cta: item.cta || '문의하기',
      bg1: item.bg1 || '#fff7ed',
      bg2: item.bg2 || '#ffedd5',
    }, preset.accent));
    if (!slides.length) throw new Error('슬라이드 초안이 비어 있습니다.');
    state.slides = slides;
    state.selectedSlideId = slides[0].id;
    state.selectedLayerId = slides[0].layers[2]?.id || slides[0].layers[0]?.id || null;
    setState({ ...state });
    toastMessage('AI 문구 초안을 반영했습니다.');
  }

  async function requestAiBackground(slide) {
    const preset = presetByKey(state.presetSelection.industry);
    const response = await fetch('/api/ecommerce/cardnews-assist/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: preset.name,
        objective: state.aiAssist.objective,
        product: state.aiAssist.product,
        audience: state.aiAssist.audience,
        tone: state.aiAssist.tone,
        slide_title: slide.title,
        slide_heading: slide.layers.find((item) => item.name === '헤드라인')?.text || '',
        aspect_ratio: ratioMeta(slide.ratioKey).label,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    return data.image_url;
  }

  function ensureSlideImageLayer(slide) {
    let imageLayer = slide.layers.find((item) => item.type === 'image' && item.name === 'AI 이미지');
    if (imageLayer) return imageLayer;
    const imageBox = slide.layers.find((item) => item.name === '이미지 박스');
    imageLayer = createImageLayer({
      name: 'AI 이미지',
      x: imageBox?.x || 118,
      y: imageBox?.y || 468,
      width: imageBox?.width || 844,
      height: imageBox?.height || 430,
      borderRadius: imageBox?.radius || 32,
      backgroundColor: '#ffffff',
    });
    const imageBoxIndex = slide.layers.findIndex((item) => item.id === imageBox?.id);
    if (imageBoxIndex >= 0) slide.layers.splice(imageBoxIndex + 1, 0, imageLayer);
    else slide.layers.push(imageLayer);
    return imageLayer;
  }

  async function requestAiSlideImage(slide) {
    const preset = presetByKey(state.presetSelection.industry);
    const response = await fetch('/api/ecommerce/cardnews-assist/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: preset.name,
        objective: `${state.aiAssist.objective} / 이미지 중심 비주얼`,
        product: state.aiAssist.product,
        audience: state.aiAssist.audience,
        tone: `${state.aiAssist.tone} / text-free hero visual / centered subject`,
        slide_title: slide.title,
        slide_heading: slide.layers.find((item) => item.name === '헤드라인')?.text || '',
        aspect_ratio: '16:9',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    return data.image_url;
  }

  async function aiGenerateBackground() {
    const slide = currentSlide();
    if (!slide) return;
    try {
      toastMessage('AI가 현재 슬라이드 배경을 생성하는 중입니다.');
      slide.backgroundMode = 'image';
      slide.backgroundImage = await requestAiBackground(slide);
      setState({ ...state });
      toastMessage('AI 배경 이미지를 적용했습니다.');
    } catch (error) {
      toastMessage(`AI 배경 생성 실패: ${error.message}`, 'error');
    }
  }

  async function aiGenerateSlideImage() {
    const slide = currentSlide();
    if (!slide) return;
    try {
      toastMessage('AI가 현재 슬라이드 이미지를 생성하는 중입니다.');
      const selectedLayer = currentLayer();
      const imageLayer = selectedLayer?.type === 'image' ? selectedLayer : ensureSlideImageLayer(slide);
      imageLayer.src = await requestAiSlideImage(slide);
      state.selectedLayerId = imageLayer.id;
      setState({ ...state });
      toastMessage('AI 이미지를 카드에 적용했습니다.');
    } catch (error) {
      toastMessage(`AI 이미지 생성 실패: ${error.message}`, 'error');
    }
  }

  async function requestAiLayerCopy(slide, layer) {
    const preset = presetByKey(state.presetSelection.industry);
    const response = await fetch('/api/ecommerce/cardnews-assist/layer-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: preset.name,
        objective: state.aiAssist.objective,
        product: state.aiAssist.product,
        audience: state.aiAssist.audience,
        tone: state.aiAssist.tone,
        slide_title: slide?.title || '',
        slide_heading: slide?.layers?.find((item) => item.name === '헤드라인')?.text || '',
        slide_body: slide?.layers?.find((item) => item.name === '본문')?.text || '',
        layer_name: layer?.name || '',
        current_text: layer?.text || '',
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    return String(data.text || '').trim();
  }

  async function aiGenerateLayerCopy() {
    const slide = currentSlide();
    const layer = currentLayer();
    if (!slide || !layer || layer.type !== 'text') {
      toastMessage('텍스트 레이어를 선택한 뒤 다시 시도해 주세요.', 'error');
      return;
    }
    try {
      toastMessage('선택한 텍스트 레이어 문구를 AI가 다시 작성하는 중입니다.');
      const nextText = await requestAiLayerCopy(slide, layer);
      if (!nextText) throw new Error('문구를 생성하지 못했습니다.');
      layer.text = nextText;
      setState({ ...state });
      toastMessage('선택한 텍스트 레이어만 새 문구로 바꿨습니다.');
    } catch (error) {
      toastMessage(`문구 재작성 실패: ${error.message}`, 'error');
    }
  }

  async function aiAutoFill() {
    if (autoAiRunning) return;
    if (window._mcnAutoFillData) {
      const data = window._mcnAutoFillData;
      if (data.topic) state.aiAssist.product = data.topic;
      if (data.body) state.aiAssist.objective = data.body.slice(0, 200);
      window._mcnAutoFillData = null;
    }
    state.presetSelection = inferPresetSelectionFromInputs(
      state.presetSelection?.industry || detectPresetKeyFromProfile(),
      state.aiAssist.product || state.aiAssist.objective,
    );
    syncAiAssistFromSelection();
    autoAiRunning = true;
    render();
    try {
      await aiGenerateScript();
      const slides = [...state.slides];
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index];
        try {
          slide.backgroundMode = 'image';
          slide.backgroundImage = await requestAiBackground(slide);
          const imageLayer = ensureSlideImageLayer(slide);
          imageLayer.src = await requestAiSlideImage(slide);
          if (index === 0) {
            state.selectedSlideId = slide.id;
            state.selectedLayerId = imageLayer.id;
          }
          setStateSilently({ ...state });
        } catch (error) {
          console.warn('manual cardnews visual fill failed', error);
        }
      }
      setState({ ...state });
      toastMessage('Gemini가 문구, 배경, 이미지를 자동으로 채웠습니다.');
    } catch (error) {
      toastMessage(`AI 자동 채우기 실패: ${error.message}`, 'error');
    } finally {
      autoAiRunning = false;
      render();
    }
  }

  async function aiCutout() {
    if (!state.assetLab.sourceImage) {
      toastMessage('먼저 원본 이미지를 넣어주세요.', 'error');
      return;
    }
    try {
      toastMessage('AI 누끼 처리 중입니다.');
      const response = await fetch('/api/ecommerce/cardnews-assist/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ref: state.assetLab.sourceImage, crop: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      state.assetLab.cutoutImage = data.image_url;
      setState({ ...state });
      toastMessage('누끼 이미지를 만들었습니다.');
    } catch (error) {
      toastMessage(`누끼 생성 실패: ${error.message}`, 'error');
    }
  }

  async function aiGenerateAssetBackground() {
    try {
      const preset = presetByKey(state.presetSelection.industry);
      toastMessage('소재용 배경을 생성하는 중입니다.');
      const response = await fetch('/api/ecommerce/cardnews-assist/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: preset.name,
          objective: state.aiAssist.objective,
          product: state.aiAssist.product,
          audience: state.aiAssist.audience,
          tone: state.aiAssist.tone,
          slide_title: currentSlide()?.title || '',
          slide_heading: currentSlide()?.layers.find((item) => item.name === '헤드라인')?.text || '',
          aspect_ratio: ratioMeta(currentSlide()?.ratioKey || 'portrait').label,
          image_ref: state.assetLab.sourceImage || state.assetLab.cutoutImage || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      state.assetLab.backgroundImage = data.image_url;
      setState({ ...state });
      toastMessage('배경 이미지를 만들었습니다.');
    } catch (error) {
      toastMessage(`배경 생성 실패: ${error.message}`, 'error');
    }
  }

  async function aiComposite() {
    const source = state.assetLab.cutoutImage || state.assetLab.sourceImage;
    if (!source) {
      toastMessage('원본 또는 누끼 이미지가 필요합니다.', 'error');
      return;
    }
    if (!state.assetLab.backgroundImage) {
      toastMessage('먼저 배경 이미지를 생성해주세요.', 'error');
      return;
    }
    try {
      toastMessage('상품 컷을 배경과 합성하는 중입니다.');
      const response = await fetch('/api/ecommerce/cardnews-assist/composite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_image: source,
          background_image: state.assetLab.backgroundImage,
          aspect_ratio: ratioMeta(currentSlide()?.ratioKey || 'portrait').label,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      state.assetLab.compositeImage = data.image_url;
      setState({ ...state });
      toastMessage('합성 이미지를 만들었습니다.');
    } catch (error) {
      toastMessage(`합성 실패: ${error.message}`, 'error');
    }
  }

  function useAsset(assetKey) {
    const imageUrl = state.assetLab[assetKey];
    if (!imageUrl) return;
    const layer = currentLayer();
    if (layer?.type === 'image') {
      layer.src = imageUrl;
      setState({ ...state });
      return;
    }
    const slide = currentSlide();
    const newLayer = createImageLayer({ src: imageUrl, x: 120, y: 460, width: 840, height: 430 });
    slide.layers.push(newLayer);
    state.selectedLayerId = newLayer.id;
    setState({ ...state });
  }

  async function loadPresetImages() {
    const preset = buildPresetFromSelection(state.presetSelection);
    state.presetImages = { ...(state.presetImages || {}), loading: true, error: '' };
    setState({ ...state });
    try {
      const response = await fetch('/api/ecommerce/cardnews-assist/preset-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: presetByKey(preset.baseKey || preset.key).name,
          keywords: preset.previewKeywords || [preset.name],
          page: 1,
          per_page: 8,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
      state.presetImages = {
        items: data.items || [],
        page: data.page || 1,
        total: data.total || 0,
        query: data.query || '',
        loading: false,
        error: data.error || '',
      };
      setState({ ...state });
    } catch (error) {
      state.presetImages = { items: [], page: 1, total: 0, query: '', loading: false, error: error.message };
      setState({ ...state });
    }
  }

  function useUnsplashImage(url) {
    if (!url) return;
    state.assetLab.backgroundImage = url;
    setState({ ...state });
    toastMessage('레퍼런스 이미지를 배경 후보로 넣었습니다.');
  }

  function init() {
    const root = document.getElementById('manual-cardnews-root');
    if (!root) return;
    if (!window._mcnKeyboardBound) {
      document.addEventListener('keydown', handleWorkspaceKeydown);
      window._mcnKeyboardBound = true;
    }
    state = loadState();
    syncAiAssistFromSelection();
    render();
  }

  function startAutoCreate() {
    const industryInput = document.getElementById('mcn-start-industry');
    const topicInput = document.getElementById('mcn-start-topic');
    const statusEl = document.getElementById('mcn-start-status');
    const industry = String(industryInput?.value || '').trim();
    const topic = String(topicInput?.value || '').trim();
    if (!industry && !topic) {
      toastMessage('업종 또는 주제를 입력해주세요.', 'error');
      return;
    }
    const matchedPreset = PRESETS.find((preset) => industry.includes(preset.name)) || presetByKey(detectPresetKeyFromProfile());
    const inferredSelection = inferPresetSelectionFromInputs(matchedPreset.key, topic || industry);
    localStorage.removeItem(STORAGE_KEY);
    window._mcnAutoFillData = null;
    state = createWorkspace(matchedPreset.key);
    state.aiAssist.product = topic || industry || `${matchedPreset.name} 대표 상품`;
    state.aiAssist.objective = topic || industry || state.aiAssist.objective;
    state.presetSelection = inferredSelection;
    syncAiAssistFromSelection();
    render();
    if (statusEl) statusEl.textContent = 'AI가 문구와 이미지를 채우는 중입니다...';
    aiAutoFill().finally(() => {
      if (statusEl) statusEl.textContent = '';
    });
  }

  window.mcnInit = init;
  window.mcnSetUiPanel = setUiPanel;
  window.mcnApplySelectedPreset = applySelectedPreset;
  window.mcnAddSlide = addSlide;
  window.mcnDuplicateSlide = duplicateSlide;
  window.mcnDeleteSlide = deleteSlide;
  window.mcnMoveSlide = moveSlide;
  window.mcnAddTextLayer = addTextLayer;
  window.mcnAddShapeLayer = addShapeLayer;
  window.mcnAddImageLayer = addImageLayer;
  window.mcnDuplicateLayer = duplicateLayer;
  window.mcnDeleteLayer = deleteLayer;
  window.mcnMoveLayer = moveLayer;
  window.mcnToggleGrid = toggleGrid;
  window.mcnExportCurrentSlide = exportCurrentSlide;
  window.mcnExportAllSlides = exportAllSlides;
  window.mcnResetWorkspace = resetWorkspace;
  window.mcnAiGenerateScript = aiGenerateScript;
  window.mcnAiGenerateBackground = aiGenerateBackground;
  window.mcnAiGenerateSlideImage = aiGenerateSlideImage;
  window.mcnAiGenerateLayerCopy = aiGenerateLayerCopy;
  window.mcnAiAutoFill = aiAutoFill;
  window.mcnAiCutout = aiCutout;
  window.mcnAiGenerateAssetBackground = aiGenerateAssetBackground;
  window.mcnAiComposite = aiComposite;
  window.mcnUseAsset = useAsset;
  window.mcnLoadPresetImages = loadPresetImages;
  window.mcnUseUnsplashImage = useUnsplashImage;
  window.mcnRenderStartPresets = function () {};
  window.mcnSelectStartPreset = function (key) {
    state = createWorkspace(key);
    syncAiAssistFromSelection();
    render();
  };
  window.mcnStartAutoCreate = startAutoCreate;

  document.addEventListener('DOMContentLoaded', init);
})();
