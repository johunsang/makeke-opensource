/* ============================================================
 *  이커머스 — 브랜드 관련 서비스
 *  로고, 온라인샵 브랜딩
 * ============================================================ */

const MARKETING_SKILL_CATEGORIES = {
  foundation: { title: '브랜드 기초', description: '제품, 포지셔닝, 가격, 시장 맥락을 먼저 정리하는 기본 스킬 묶음입니다.', icon: '&#9670;', color: '#007aff' },
  cro: { title: '전환 최적화 (CRO)', description: '페이지, 가입, 온보딩, 폼, 팝업, 업그레이드 전환율을 높이는 스킬입니다.', icon: '&#9650;', color: '#ff9500' },
  content: { title: '콘텐츠 & 카피', description: '카피, 이메일, 소셜, 콘텐츠 전략과 고객 리서치를 다루는 스킬입니다.', icon: '&#9998;', color: '#34c759' },
  seo: { title: 'SEO & 검색', description: '기술 SEO, AI 검색, 정보구조, 스키마, 링크 진단 스킬입니다.', icon: '&#128270;', color: '#5856d6' },
  ads: { title: '광고 & 배포', description: '유료 광고, 광고 소재, 배포용 크리에이티브를 만드는 스킬입니다.', icon: '&#9733;', color: '#ff2d55' },
  measurement: { title: '측정 & 테스트', description: '분석 추적과 실험 설계를 위한 스킬입니다.', icon: '&#9881;', color: '#8e8e93' },
  retention: { title: '리텐션 & 성장', description: '이탈 방지, 추천, 커뮤니티, 무료 도구 성장 전략 스킬입니다.', icon: '&#10227;', color: '#af52de' },
  strategy: { title: '전략 & 런칭', description: '아이디어, 심리학, 런칭, 가격 전략을 다루는 스킬입니다.', icon: '&#9813;', color: '#ff8c00' },
  sales: { title: '영업 & RevOps', description: '영업 자료, 핸드오프, 파이프라인 운영 스킬입니다.', icon: '&#9749;', color: '#30b0c7' },
};

const BRANDING_WORKFLOWS = [
  { title: '신규 브랜드 셋업', desc: '처음 시작하는 브랜드의 기초를 잡는 워크플로우', steps: ['product-marketing-context', 'pricing-strategy', 'copywriting', 'page-cro', 'seo-audit'] },
  { title: '전환율 개선', desc: '방문자는 있는데 전환이 안 될 때', steps: ['page-cro', 'form-cro', 'ab-test-setup', 'marketing-psychology', 'analytics-tracking'] },
  { title: '콘텐츠 마케팅 시작', desc: '블로그/SNS 콘텐츠로 유입을 만드는 전략', steps: ['customer-research', 'content-strategy', 'social-content', 'seo-audit', 'lead-magnets'] },
  { title: '런칭 준비', desc: '새 제품/기능 출시 전 체크리스트', steps: ['launch-strategy', 'ad-creative', 'email-sequence', 'copywriting', 'analytics-tracking'] },
  { title: '이탈 방지 & 성장', desc: '기존 고객을 지키고 추천을 만드는 전략', steps: ['churn-prevention', 'onboarding-cro', 'referral-program', 'community-marketing', 'email-sequence'] },
];

const MARKETING_SKILLS = [
  { slug: 'product-marketing-context', title: '프로덕트 마케팅 컨텍스트', category: 'foundation', summary: '제품, 고객, 차별점, 핵심 메시지를 한 장짜리 기준 문서로 정리합니다.', deliverables: ['ICP 요약', '핵심 가치 제안', '차별점 3개', '메시지 프레임'], inputs: ['제품 설명', '핵심 고객', '경쟁사', '현재 메시지'], related: ['copywriting', 'page-cro', 'pricing-strategy'] },
  { slug: 'pricing-strategy', title: '가격 전략', category: 'foundation', summary: '패키징, 요금제, 업셀 구조, 가격 앵커를 정리합니다.', deliverables: ['가격 구조안', '패키징 비교표', '가격 테스트 가설'], inputs: ['현재 가격', '경쟁 가격', '고객 세그먼트', '매출 목표'], related: ['paywall-upgrade-cro', 'marketing-psychology', 'revops'] },

  { slug: 'page-cro', title: '페이지 CRO', category: 'cro', summary: '홈페이지, 랜딩, 가격 페이지의 메시지와 레이아웃을 전환 중심으로 점검합니다.', deliverables: ['전환 진단', '개선 포인트', '헤드라인 대안', '테스트 가설'], inputs: ['검사 URL', '주요 CTA', '전환 목표', '현재 카피'], related: ['copywriting', 'ab-test-setup', 'analytics-tracking'], toolPage: 'ec-rebuild', toolLabel: '상세페이지 진단 열기' },
  { slug: 'signup-flow-cro', title: '가입 플로우 CRO', category: 'cro', summary: '회원가입과 등록 플로우의 마찰 구간을 줄여 가입 전환율을 높입니다.', deliverables: ['플로우 진단', '마찰 요소 목록', '화면별 개선안'], inputs: ['가입 URL', '단계 수', '이탈 지점', '필수 입력값'], related: ['analytics-tracking', 'ab-test-setup', 'onboarding-cro'] },
  { slug: 'onboarding-cro', title: '온보딩 CRO', category: 'cro', summary: '가입 직후 활성화와 첫 가치 경험까지의 시간을 줄이는 온보딩 스킬입니다.', deliverables: ['온보딩 시나리오', '활성화 체크리스트', '메시지 개선안'], inputs: ['첫 실행 흐름', '핵심 activation event', '현재 튜토리얼'], related: ['signup-flow-cro', 'email-sequence', 'churn-prevention'] },
  { slug: 'form-cro', title: '폼 CRO', category: 'cro', summary: '리드 폼, 문의 폼, 신청 폼의 완료율을 올리도록 구조와 문구를 정리합니다.', deliverables: ['폼 개선안', '입력 항목 정리', '에러/도움말 카피'], inputs: ['폼 URL', '질문 항목', '완료율', '이탈 구간'], related: ['copywriting', 'analytics-tracking', 'ab-test-setup'] },
  { slug: 'popup-cro', title: '팝업 CRO', category: 'cro', summary: '모달, 오버레이, 배너, 팝업의 노출 조건과 메시지를 최적화합니다.', deliverables: ['노출 규칙안', '카피 대안', '세그먼트별 제안'], inputs: ['팝업 목적', '현재 문구', '노출 타이밍', '대상 세그먼트'], related: ['copywriting', 'lead-magnets', 'ab-test-setup'] },
  { slug: 'paywall-upgrade-cro', title: '페이월/업그레이드 CRO', category: 'cro', summary: '업그레이드 화면, 기능 잠금, 업셀 모달의 전환율을 개선합니다.', deliverables: ['업그레이드 화면 카피', '가격 비교 구조', '업셀 메시지'], inputs: ['요금제 구조', '업그레이드 화면', '잠금 포인트', '전환 목표'], related: ['pricing-strategy', 'marketing-psychology', 'ab-test-setup'] },

  { slug: 'copywriting', title: '카피라이팅', category: 'content', summary: '홈페이지, 랜딩, 가격 페이지 등 설득형 마케팅 카피를 작성합니다.', deliverables: ['헤드라인 후보', '본문 카피', 'CTA 카피', '섹션 구조안'], inputs: ['제품 설명', '타깃 고객', '핵심 제안', '원하는 톤'], related: ['customer-research', 'page-cro', 'copy-editing'] },
  { slug: 'copy-editing', title: '카피 편집', category: 'content', summary: '기존 카피를 다듬고, 장황하거나 약한 메시지를 더 선명하게 고칩니다.', deliverables: ['편집본', '수정 포인트', '톤 교정 메모'], inputs: ['현재 카피 원문', '브랜드 톤', '남기고 싶은 표현'], related: ['copywriting', 'marketing-psychology', 'page-cro'] },
  { slug: 'cold-email', title: '콜드 이메일', category: 'content', summary: 'B2B 아웃바운드 메일과 후속 메일 시퀀스를 작성합니다.', deliverables: ['초기 메일', '후속 메일 2-3개', '제목 후보'], inputs: ['대상 업종', '제안 내용', '차별점', '성과 근거'], related: ['sales-enablement', 'customer-research', 'email-sequence'] },
  { slug: 'email-sequence', title: '이메일 시퀀스', category: 'content', summary: '온보딩, 웰컴, 재참여, 리드 육성용 이메일 플로우를 설계합니다.', deliverables: ['이메일 흐름도', '메일별 목적', '메일 원문'], inputs: ['시퀀스 목적', '세그먼트', '행동 트리거', '브랜드 톤'], related: ['copywriting', 'onboarding-cro', 'churn-prevention'] },
  { slug: 'social-content', title: '소셜 콘텐츠', category: 'content', summary: 'LinkedIn, X, Instagram, 커뮤니티용 소셜 콘텐츠를 기획합니다.', deliverables: ['채널별 포맷', '포스트 초안', '반복 시리즈안'], inputs: ['채널', '주제', '오퍼', '브랜드 톤'], related: ['content-strategy', 'ad-creative', 'community-marketing'] },
  { slug: 'content-strategy', title: '콘텐츠 전략', category: 'content', summary: '무엇을 언제 어떤 목적을 가지고 만들지 콘텐츠 로드맵을 세웁니다.', deliverables: ['토픽 클러스터', '콘텐츠 캘린더', '채널별 역할'], inputs: ['목표 채널', '핵심 키워드', '전환 목표', '현재 자산'], related: ['customer-research', 'seo-audit', 'social-content'] },
  { slug: 'lead-magnets', title: '리드 마그넷', category: 'content', summary: '이메일 수집용 체크리스트, 템플릿, 툴킷, 미니 가이드 같은 오퍼를 설계합니다.', deliverables: ['오퍼 아이디어', '랜딩 구조안', '다운로드 콘텐츠 개요'], inputs: ['타깃 고객', '문제 영역', '수집 채널', '기존 오퍼'], related: ['popup-cro', 'form-cro', 'free-tool-strategy'] },
  { slug: 'customer-research', title: '고객 리서치', category: 'content', summary: 'VOC, 인터뷰, 리뷰, 영업 기록을 바탕으로 고객 언어와 불만을 정리합니다.', deliverables: ['고객 인사이트', '핵심 불만 5개', '자주 쓰는 표현', '메시지 힌트'], inputs: ['리뷰/인터뷰 원문', '고객 유형', '경쟁사 언급'], related: ['copywriting', 'page-cro', 'competitor-alternatives'] },

  { slug: 'seo-audit', title: 'SEO 진단', category: 'seo', summary: '사이트 전체 기준으로 기술 SEO와 온페이지 문제를 한 번에 점검합니다.', deliverables: ['우선순위 이슈', '빠른 개선 포인트', '점수 요약'], inputs: ['검사 URL', '주요 페이지', '타깃 키워드'], related: ['ai-seo', 'schema-markup', 'site-architecture'], toolPage: 'ec-seo-audit', toolLabel: 'SEO 진단 열기' },
  { slug: 'ai-seo', title: 'AI SEO', category: 'seo', summary: 'ChatGPT, Perplexity, Gemini 같은 AI 검색에 인용되기 쉬운 구조를 설계합니다.', deliverables: ['AI 검색 개선안', 'FAQ/인용 구조', 'llms.txt 체크리스트'], inputs: ['검사 URL', '핵심 질문', '타깃 주제'], related: ['seo-audit', 'content-strategy', 'schema-markup'], toolPage: 'geo-seo-consultant', toolLabel: 'GEO SEO 컨설턴트 열기' },
  { slug: 'programmatic-seo', title: '프로그래매틱 SEO', category: 'seo', summary: '데이터와 템플릿으로 대량 SEO 페이지를 설계합니다.', deliverables: ['템플릿 구조', '데이터 필드', '인덱싱 정책'], inputs: ['데이터 소스', '생성할 페이지 유형', '핵심 키워드'], related: ['site-architecture', 'competitor-alternatives', 'schema-markup'] },
  { slug: 'site-architecture', title: '사이트 아키텍처', category: 'seo', summary: '페이지 계층, URL 구조, 탐색 흐름, 내부 링크를 정리합니다.', deliverables: ['사이트맵 구조', 'URL 규칙', '내부 링크 제안'], inputs: ['현재 메뉴 구조', '핵심 전환 페이지', '콘텐츠 목록'], related: ['seo-audit', 'programmatic-seo', 'page-cro'] },
  { slug: 'competitor-alternatives', title: '경쟁사 대안 페이지', category: 'seo', summary: '비교형 랜딩과 대안 페이지를 만들어 검색과 영업 양쪽에 쓰도록 설계합니다.', deliverables: ['페이지 구조', '비교 포인트', '카피 초안'], inputs: ['비교 대상', '차별점', '근거 자료'], related: ['customer-research', 'copywriting', 'site-architecture'] },
  { slug: 'schema-markup', title: '스키마 마크업', category: 'seo', summary: 'JSON-LD 구조화 데이터를 설계하고 리치 결과 가능성을 높입니다.', deliverables: ['권장 스키마 목록', 'JSON-LD 초안', '구현 체크리스트'], inputs: ['페이지 유형', '페이지 URL', '엔티티 정보'], related: ['seo-audit', 'ai-seo', 'site-architecture'], toolPage: 'ec-seo-audit', toolLabel: '스키마 점검 열기' },

  { slug: 'paid-ads', title: '유료 광고', category: 'ads', summary: 'Google, Meta, LinkedIn 등 광고 채널별 캠페인 전략을 설계합니다.', deliverables: ['채널 제안', '캠페인 구조', '오퍼/타깃 제안'], inputs: ['목표 예산', '목표 CAC/ROAS', '오퍼', '타깃 고객'], related: ['ad-creative', 'analytics-tracking', 'landing-page-cro'] },
  { slug: 'ad-creative', title: '광고 크리에이티브', category: 'ads', summary: '헤드라인, 바디 카피, 시각 방향을 대량으로 반복 생성하는 스킬입니다.', deliverables: ['광고 훅 10개', '카피 세트', '소재 각도'], inputs: ['오퍼', '타깃 고객', '브랜드 톤', '금지 표현'], related: ['paid-ads', 'copywriting', 'marketing-psychology'], toolPage: 'ec-banner', toolLabel: '배너 도구 열기' },

  { slug: 'analytics-tracking', title: '분석 추적 설정', category: 'measurement', summary: 'GA4, GTM, 이벤트, UTM, 전환 추적 기준을 정리합니다.', deliverables: ['이벤트 맵', '속성 정의', '검증 체크리스트'], inputs: ['핵심 전환', '제품 플로우', '현재 추적 도구'], related: ['ab-test-setup', 'signup-flow-cro', 'page-cro'] },
  { slug: 'ab-test-setup', title: 'A/B 테스트 설계', category: 'measurement', summary: '실험 가설, 변수, 기간, 성공 지표를 정의하는 스킬입니다.', deliverables: ['실험 계획서', '가설 문장', '지표 정의', '분석 기준'], inputs: ['실험 대상 페이지', '현재 문제', '트래픽 규모'], related: ['analytics-tracking', 'page-cro', 'pricing-strategy'] },

  { slug: 'churn-prevention', title: '이탈 방지', category: 'retention', summary: '해지 플로우, 세이브 오퍼, 윈백 메시지를 설계합니다.', deliverables: ['해지 방지 플로우', '세이브 오퍼', '윈백 카피'], inputs: ['해지 이유', '현재 해지 화면', '잔존 목표'], related: ['email-sequence', 'paywall-upgrade-cro', 'customer-research'] },
  { slug: 'free-tool-strategy', title: '무료 도구 전략', category: 'retention', summary: '리드 획득과 SEO를 위한 무료 계산기/생성기/체커를 기획합니다.', deliverables: ['도구 아이디어', '입력/출력 구조', 'SEO 가치 설명'], inputs: ['타깃 키워드', '고객 문제', '수집하려는 리드'], related: ['lead-magnets', 'programmatic-seo', 'content-strategy'] },
  { slug: 'referral-program', title: '추천 프로그램', category: 'retention', summary: '추천, 제휴, 앰배서더 프로그램 설계를 도와줍니다.', deliverables: ['보상 구조', '프로그램 규칙', '추천 카피'], inputs: ['제품 가격', 'LTV', '보상 한도', '대상 고객'], related: ['churn-prevention', 'community-marketing', 'marketing-psychology'] },
  { slug: 'community-marketing', title: '커뮤니티 마케팅', category: 'retention', summary: 'Slack, Discord, 카페, 오픈채팅 같은 커뮤니티 성장 전략을 설계합니다.', deliverables: ['커뮤니티 운영안', '초기 콘텐츠', '참여 유도 구조'], inputs: ['운영 채널', '핵심 고객군', '커뮤니티 목적'], related: ['social-content', 'referral-program', 'launch-strategy'] },

  { slug: 'marketing-ideas', title: '마케팅 아이디어', category: 'strategy', summary: '아이디어가 막힐 때 시도할 수 있는 성장 전술과 실험 아이디어를 넓게 제안합니다.', deliverables: ['아이디어 리스트', '우선순위', '실행 난이도'], inputs: ['제품 단계', '예산', '현재 채널', '목표'], related: ['launch-strategy', 'free-tool-strategy', 'paid-ads'] },
  { slug: 'marketing-psychology', title: '마케팅 심리학', category: 'strategy', summary: '앵커링, 사회적 증거, 희소성, 손실회피 같은 원리를 적용합니다.', deliverables: ['심리 트리거 적용안', '카피 교정 포인트', '실험 아이디어'], inputs: ['적용할 페이지', '현재 카피', '원하는 행동'], related: ['copywriting', 'pricing-strategy', 'paywall-upgrade-cro'] },
  { slug: 'launch-strategy', title: '런칭 전략', category: 'strategy', summary: '신규 출시, 기능 오픈, 베타 론치의 일정과 메시지 전략을 정리합니다.', deliverables: ['런칭 타임라인', '채널별 메시지', '준비 체크리스트'], inputs: ['출시 대상', '출시일', '주요 채널', '목표'], related: ['marketing-ideas', 'social-content', 'sales-enablement'] },

  { slug: 'revops', title: 'RevOps', category: 'sales', summary: 'MQL/SQL 기준, 라우팅, CRM 상태, 핸드오프 규칙을 정리합니다.', deliverables: ['리드 단계 정의', '라우팅 규칙', '운영 체크리스트'], inputs: ['현재 CRM 흐름', '세일즈 팀 구조', '핵심 리드 기준'], related: ['sales-enablement', 'analytics-tracking', 'pricing-strategy'] },
  { slug: 'sales-enablement', title: '세일즈 인에이블먼트', category: 'sales', summary: '피치덱, 원페이저, objection handling, 데모 스크립트를 정리합니다.', deliverables: ['원페이저 개요', '이의응답 문서', '데모 흐름'], inputs: ['세일즈 상황', '주요 반론', '대상 업종'], related: ['revops', 'cold-email', 'competitor-alternatives'] },
];

const MARKETING_SKILL_MAP = Object.fromEntries(MARKETING_SKILLS.map((skill) => [skill.slug, skill]));
const BRANDING_SKILL_SECTIONS = Object.keys(MARKETING_SKILL_CATEGORIES).map((key) => ({
  key,
  title: MARKETING_SKILL_CATEGORIES[key].title,
  description: MARKETING_SKILL_CATEGORIES[key].description,
  skills: MARKETING_SKILLS.filter((skill) => skill.category === key),
}));

const BRANDING_EXECUTION_TOOLS = [
  { title: '온라인샵 브랜딩', summary: '브랜드명, 슬로건, 로고, 배너를 한 번에 생성합니다.', page: 'ec-smartstore', actionLabel: '온라인샵 브랜딩' },
  { title: '오프라인샵 브랜딩', summary: '매장명, 슬로건, 로고, 공간 톤 자산을 만듭니다.', page: 'ec-offlineshop', actionLabel: '오프라인샵 브랜딩' },
  { title: '로고 생성', summary: '브랜드 타입과 스타일을 정하고 로고 시안을 생성합니다.', page: 'ec-logo', actionLabel: '로고 생성' },
  { title: '광고 배너', summary: '광고/프로모션용 배너를 생성합니다.', page: 'ec-banner', actionLabel: '배너 만들기' },
  { title: '광고 영상', summary: '브랜드 메시지 기반 광고 영상을 생성합니다.', page: 'ec-advideo', actionLabel: '광고 영상' },
  { title: '상세페이지 생성', summary: '상품 정보를 바탕으로 상세페이지를 생성합니다.', page: 'ec-detailpage', actionLabel: '상세페이지 생성' },
  { title: '상세페이지 진단', summary: '기존 상세페이지를 진단하고 개선 포인트를 정리합니다.', page: 'ec-rebuild', actionLabel: '상세페이지 진단' },
  { title: '모델 생성', summary: '상품 촬영용 AI 모델을 생성합니다.', page: 'ec-model', actionLabel: '모델 생성' },
  { title: '의상 합성', summary: '모델에 의상을 합성합니다.', page: 'ec-outfit', actionLabel: '의상 합성' },
  { title: '인플루언서 합성', summary: '인플루언서 상품 홍보 이미지를 합성합니다.', page: 'ec-influencer', actionLabel: '인플루언서' },
  { title: '아트 변환', summary: '브랜드 이미지를 다양한 아트 스타일로 변환합니다.', page: 'ec-art', actionLabel: '아트 변환' },
  { title: '인테리어', summary: '가구/소품을 공간 이미지에 합성합니다.', page: 'ec-interior', actionLabel: '인테리어' },
  { title: '펫 모델', summary: '반려동물 기반 홍보 이미지를 생성합니다.', page: 'ec-pet', actionLabel: '펫 모델' },
];

function ecGetMarketingSkill(slug) {
  return MARKETING_SKILL_MAP[slug] || MARKETING_SKILLS[0];
}

function ecOpenMarketingSkill(slug) {
  EC_STATE.activeMarketingSkill = slug;
  navigateToPage('ec-marketing-skill', { skipConfirm: true });
}

function ecOpenMarketingSkillTool(slug) {
  const skill = ecGetMarketingSkill(slug);
  if (!skill?.toolPage) return;
  navigateToPage(skill.toolPage, { skipConfirm: true });
  setTimeout(() => {
    if (skill.toolPage === 'ec-seo-audit') {
      const modeMap = {
        'seo-audit': 'audit',
        'ai-seo': 'geo',
        'schema-markup': 'schema',
      };
      const mode = modeMap[skill.slug];
      const modeEl = document.getElementById('ec-seo-audit-mode');
      const urlEl = document.getElementById('ec-seo-audit-target');
      const draft = ecLoadMarketingSkillDraft(skill.slug);
      if (mode && modeEl) modeEl.value = mode;
      if (draft.url && urlEl && !urlEl.value.trim()) urlEl.value = draft.url;
    }
    if (skill.toolPage === 'geo-seo-consultant') {
      const draft = ecLoadMarketingSkillDraft(skill.slug);
      const urlEl = document.getElementById('geo-seo-consultant-url');
      const keywordEl = document.getElementById('geo-seo-consultant-keyword');
      if (draft.url && urlEl && !urlEl.value.trim()) urlEl.value = draft.url;
      if (draft.topic && keywordEl && !keywordEl.value.trim()) keywordEl.value = draft.topic;
    }
  }, 80);
}

function ecLoadMarketingSkillDraft(slug) {
  try {
    return JSON.parse(localStorage.getItem(`ec_marketing_skill_${slug}`) || '{}');
  } catch (e) {
    return {};
  }
}

function ecSaveMarketingSkillDraft(slug, data) {
  try {
    localStorage.setItem(`ec_marketing_skill_${slug}`, JSON.stringify(data || {}));
  } catch (e) {
    /* ignore localStorage failure */
  }
}

function ecReadMarketingSkillForm() {
  const base = {
    company: document.getElementById('ec-ms-company')?.value?.trim() || '',
    product: document.getElementById('ec-ms-product')?.value?.trim() || '',
    audience: document.getElementById('ec-ms-audience')?.value?.trim() || '',
    goal: document.getElementById('ec-ms-goal')?.value?.trim() || '',
    url: document.getElementById('ec-ms-url')?.value?.trim() || '',
    assets: document.getElementById('ec-ms-assets')?.value?.trim() || '',
    context: document.getElementById('ec-ms-context')?.value?.trim() || '',
    constraints: document.getElementById('ec-ms-constraints')?.value?.trim() || '',
  };
  // 스킬별 동적 입력 읽기
  const dynamicInputs = {};
  document.querySelectorAll('[id^="ec-ms-input-"]').forEach(el => {
    const key = el.id.replace('ec-ms-input-', '');
    dynamicInputs[key] = el.value?.trim() || '';
  });
  base.skillInputs = dynamicInputs;
  return base;
}

// 스킬별 입력 필드 타입 결정: 원문/코드/긴 텍스트 → textarea, URL → url input, 나머지 → text input
function _ecSkillInputType(inputLabel) {
  const lower = inputLabel.toLowerCase();
  if (/원문|본문|문구|카피|흐름|구조|목록|규칙|스크립트|데이터|항목|자료|기록/.test(lower)) return 'textarea';
  if (/url|주소|링크/.test(lower)) return 'url';
  return 'text';
}

function _ecSkillInputPlaceholder(inputLabel) {
  const lower = inputLabel.toLowerCase();
  if (/원문/.test(lower)) return '분석하거나 편집할 원문을 여기에 붙여넣으세요';
  if (/url|주소|링크/.test(lower)) return 'https://example.com';
  if (/카피|문구/.test(lower)) return '현재 사용 중인 카피를 입력하세요';
  if (/흐름|구조|목록/.test(lower)) return '현재 상태를 구체적으로 작성하세요';
  return `${inputLabel}을(를) 입력하세요`;
}

function ecMarketingSkillChecklist(skill, draft) {
  const base = [
    `${skill.title}의 목표를 한 줄로 다시 정의한다`,
    `${draft.audience || '타깃 고객'} 기준으로 가장 큰 문제와 원하는 결과를 정리한다`,
    `${draft.product || '제품/서비스'}의 차별점과 근거를 먼저 수집한다`,
  ];
  return base
    .concat((skill.inputs || []).map((item) => `${item}을 빠짐없이 채운다`))
    .concat((skill.deliverables || []).map((item) => `${item} 산출물을 한 번에 정리한다`))
    .concat((skill.related || []).slice(0, 3).map((slug) => `${ecGetMarketingSkill(slug).title} 연결 여부를 함께 검토한다`));
}

function ecGetMarketingSkillProfile() {
  const profile = window._globalProfileData || null;
  const profileId = parseInt(window._globalProfileId || profile?.id || 0, 10) || 0;
  if (!profileId || !profile) return null;
  return { profileId, ...profile };
}

function ecApplyMarketingSkillProfileDefaults(draft) {
  const profile = ecGetMarketingSkillProfile();
  const next = { ...(draft || {}), skillInputs: { ...((draft || {}).skillInputs || {}) } };
  if (!profile) return next;
  if (!next.company && profile.name) next.company = profile.name;
  if (!next.goal && profile.business_goal) next.goal = profile.business_goal;
  if (!next.assets && profile.cta_text) next.assets = `현재 CTA: ${profile.cta_text}`;
  if (!next.context) {
    const parts = [
      profile.business_type ? `업종: ${profile.business_type}` : '',
      profile.description ? `설명: ${profile.description}` : '',
      profile.keywords ? `핵심 키워드: ${profile.keywords}` : '',
    ].filter(Boolean);
    if (parts.length) next.context = parts.join('\n');
  }
  return next;
}

function ecMarketingSkillProfileSummary(profile) {
  if (!profile) return '<span style="color:rgba(0,0,0,0.38);">선택된 프로필 없음</span>';
  const lines = [
    `<b style="color:#ff8c00;">${ecEscapeHtml(profile.name || `프로필 ${profile.profileId}`)}</b>`,
    profile.business_type ? `업종 ${ecEscapeHtml(profile.business_type)}` : '',
    profile.business_goal ? `목표 ${ecEscapeHtml(profile.business_goal)}` : '',
  ].filter(Boolean);
  return lines.join(' · ');
}

function ecMarketingSkillPrompt(skill, draft) {
  const profile = ecGetMarketingSkillProfile();
  const lines = [
    `당신은 마케케 안에서 ${skill.title} 스킬을 수행하는 시니어 마케팅 전략가입니다.`,
    '',
    `[스킬]`,
    `- 이름: ${skill.title}`,
    `- 카테고리: ${MARKETING_SKILL_CATEGORIES[skill.category]?.title || ''}`,
    `- 목적: ${skill.summary}`,
    '',
    `[스킬 전용 입력]`,
    ...Object.entries(draft.skillInputs || {}).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`),
    ...(Object.values(draft.skillInputs || {}).some(v => v) ? [''] : []),
    `[선택 프로필]`,
    `- 프로필 ID: ${profile?.profileId || 0}`,
    `- 프로필명: ${profile?.name || '(미선택)'}`,
    `- 업종: ${profile?.business_type || '(미입력)'}`,
    `- 브랜드 설명: ${profile?.description || '(미입력)'}`,
    `- 비즈니스 목표: ${profile?.business_goal || '(미입력)'}`,
    `- 핵심 키워드: ${profile?.keywords || '(미입력)'}`,
    `- CTA: ${profile?.cta_text || '(미입력)'}`,
    '',
    `[입력 컨텍스트]`,
    `- 회사/브랜드: ${draft.company || '(미입력)'}`,
    `- 제품/서비스: ${draft.product || '(미입력)'}`,
    `- 타깃 고객: ${draft.audience || '(미입력)'}`,
    `- 목표: ${draft.goal || '(미입력)'}`,
    `- 참고 URL: ${draft.url || '(미입력)'}`,
    `- 현재 자산/기존 문구: ${draft.assets || '(미입력)'}`,
    `- 추가 맥락: ${draft.context || '(미입력)'}`,
    `- 제약사항: ${draft.constraints || '(미입력)'}`,
    '',
    `[해야 할 일]`,
    ...ecMarketingSkillChecklist(skill, draft).map((item, idx) => `${idx + 1}. ${item}`),
    '',
    `[반드시 포함할 산출물]`,
    ...(skill.deliverables || []).map((item) => `- ${item}`),
    '',
    `[연결해서 볼 스킬]`,
    ...(skill.related || []).map((slug) => `- ${ecGetMarketingSkill(slug).title}`),
    '',
    `[출력 형식]`,
    '- 먼저 핵심 진단/방향을 짧게 요약',
    '- 바로 실행할 우선순위 액션 3-5개',
    '- 실제 문구/구조/체크리스트가 필요한 항목은 바로 초안까지 작성',
  ];
  return lines.join('\n');
}

function _ecBrandingSkillCards(skills) {
  return skills.map((skill) => `
    <div style="border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:16px;background:rgba(255,255,255,0.66);display:flex;flex-direction:column;gap:10px;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="font-size:15px;font-weight:700;color:#1c1c1e;">${skill.title}</div>
          ${skill.toolPage ? '<span style="font-size:9px;padding:2px 6px;border-radius:999px;background:rgba(52,199,89,0.1);color:#34c759;font-weight:800;">도구 연결</span>' : ''}
        </div>
        <div style="font-size:13px;color:rgba(0,0,0,0.48);line-height:1.6;">${skill.summary}</div>
      </div>
      ${(skill.related || []).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;">${skill.related.slice(0, 3).map(r => {
        const rs = MARKETING_SKILL_MAP[r];
        return rs ? `<span style="font-size:10px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.4);">${rs.title}</span>` : '';
      }).join('')}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;">
        <button class="btn btn-secondary" type="button" onclick="ecOpenMarketingSkill('${skill.slug}')">스킬 열기</button>
        ${skill.toolPage ? `<button class="btn btn-secondary" type="button" onclick="ecOpenMarketingSkillTool('${skill.slug}')">${skill.toolLabel}</button>` : ''}
      </div>
    </div>
  `).join('');
}

function ecRenderBrandingSections() {
  const sections = document.getElementById('ec-branding-sections');
  if (!sections) return;
  const activeTab = EC_STATE._brandingTab || 'overview';
  const query = String(EC_STATE.brandingSkillQuery || '').trim().toLowerCase();

  if (activeTab === 'overview') {
    // 개요 탭: 워크플로우 + 카테고리 요약 카드
    sections.innerHTML = `
      <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(255,140,0,0.04),rgba(251,191,36,0.06));border:1px solid rgba(255,140,0,0.12);">
        <h3 style="margin:0 0 6px;">추천 워크플로우</h3>
        <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-bottom:14px;">목적별로 스킬을 순서대로 실행하세요.</div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${BRANDING_WORKFLOWS.map((wf) => `
            <div style="border:1px solid rgba(255,140,0,0.12);border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.8);">
              <div style="font-size:14px;font-weight:800;color:#1c1c1e;margin-bottom:2px;">${wf.title}</div>
              <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:10px;">${wf.desc}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
                ${wf.steps.map((slug, idx) => {
                  const s = MARKETING_SKILL_MAP[slug];
                  const cat = MARKETING_SKILL_CATEGORIES[s?.category];
                  return `<button type="button" onclick="ecOpenMarketingSkill('${slug}')" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:1px solid rgba(0,0,0,0.06);background:#fff;cursor:pointer;font-size:11px;font-weight:700;color:${cat?.color || '#1c1c1e'};"><span style="font-size:10px;color:rgba(0,0,0,0.25);">${idx + 1}</span>${s?.title || slug}</button>`;
                }).join('<span style="color:rgba(0,0,0,0.12);font-size:10px;">→</span>')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        ${Object.entries(MARKETING_SKILL_CATEGORIES).map(([key, cat]) => {
          const count = MARKETING_SKILLS.filter(s => s.category === key).length;
          return `<div onclick="_ecBrandingSelectTab('${key}')" style="border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:20px;background:#fff;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <span style="width:32px;height:32px;border-radius:8px;background:${cat.color}14;color:${cat.color};display:flex;align-items:center;justify-content:center;font-size:16px;">${cat.icon}</span>
              <span style="font-size:15px;font-weight:800;color:#1c1c1e;">${cat.title}</span>
              <span style="margin-left:auto;font-size:11px;padding:3px 8px;border-radius:999px;background:${cat.color}12;color:${cat.color};font-weight:800;">${count}</span>
            </div>
            <div style="font-size:12px;color:rgba(0,0,0,0.45);line-height:1.5;">${cat.description}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="card" style="margin-top:16px;">
        <h3 style="margin:0 0 6px;">마케케 실행 도구</h3>
        <div style="font-size:13px;color:rgba(0,0,0,0.45);margin-bottom:14px;">브랜딩 스킬에서 바로 이어서 실행할 수 있는 제작 도구입니다.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
          ${BRANDING_EXECUTION_TOOLS.map((tool) => `
            <div style="border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:14px;background:rgba(255,255,255,0.66);">
              <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">${tool.title}</div>
              <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:10px;line-height:1.5;">${tool.summary}</div>
              <button class="btn btn-secondary btn-sm" type="button" onclick="navigateToPage('${tool.page}', { skipConfirm: true })">${tool.actionLabel}</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    // 카테고리 스킬 목록
    const cat = MARKETING_SKILL_CATEGORIES[activeTab] || {};
    const skills = MARKETING_SKILLS.filter(s => s.category === activeTab)
      .filter(s => !query || `${s.title} ${s.summary}`.toLowerCase().includes(query));
    sections.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="width:36px;height:36px;border-radius:10px;background:${cat.color || '#ff8c00'}14;color:${cat.color || '#ff8c00'};display:flex;align-items:center;justify-content:center;font-size:18px;">${cat.icon || ''}</span>
        <div>
          <div style="font-size:17px;font-weight:800;color:#1c1c1e;">${cat.title || activeTab}</div>
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${cat.description || ''} · ${skills.length}개 스킬</div>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <input type="text" class="form-input" placeholder="스킬 검색..." value="${ecEscapeHtml(query)}" oninput="EC_STATE.brandingSkillQuery=this.value;ecRenderBrandingSections();" style="max-width:320px;">
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
        ${skills.length ? _ecBrandingSkillCards(skills) : '<div style="padding:32px;text-align:center;color:rgba(0,0,0,0.35);font-size:13px;">검색 결과가 없습니다.</div>'}
      </div>
    `;
  }
}

function _ecBrandingSelectTab(tabKey) {
  EC_STATE._brandingTab = tabKey;
  EC_STATE.brandingSkillQuery = '';
  ecRenderBrandingTabs();
  ecRenderBrandingSections();
}
window._ecBrandingSelectTab = _ecBrandingSelectTab;

function ecRenderBrandingTabs() {
  const tabsEl = document.getElementById('ec-branding-tabs');
  if (!tabsEl) return;
  const activeTab = EC_STATE._brandingTab || 'overview';
  const tabs = [
    { key: 'overview', label: '개요', icon: '&#9776;' },
    ...Object.entries(MARKETING_SKILL_CATEGORIES).map(([key, cat]) => ({ key, label: cat.title, icon: cat.icon, color: cat.color })),
  ];
  tabsEl.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;">${tabs.map(t => {
    const isActive = t.key === activeTab;
    const color = t.color || '#ff8c00';
    return `<button type="button" onclick="_ecBrandingSelectTab('${t.key}')" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:12px;border:1px solid ${isActive ? color + '40' : 'rgba(0,0,0,0.06)'};background:${isActive ? color + '10' : '#fff'};cursor:pointer;font-size:12px;font-weight:${isActive ? '800' : '600'};color:${isActive ? color : 'rgba(0,0,0,0.55)'};">
      <span style="font-size:13px;">${t.icon || ''}</span>${t.label}
    </button>`;
  }).join('')}</div>`;
}

function ecBrandingInit() {
  const meta = document.getElementById('ec-branding-meta');
  if (meta) {
    EC_STATE._brandingTab = EC_STATE._brandingTab || 'overview';
    meta.innerHTML = `
      <div id="ec-branding-tabs"></div>
      <div style="margin-top:10px;font-size:12px;color:rgba(0,0,0,0.3);">
        전체 마케팅 스킬 ${MARKETING_SKILLS.length}개 · 실행 도구 ${BRANDING_EXECUTION_TOOLS.length}개 · 워크플로우 ${BRANDING_WORKFLOWS.length}개
      </div>
    `;
  }
  ecRenderBrandingTabs();
  ecRenderBrandingSections();
}

function ecMarketingSkillInit() {
  const slug = EC_STATE.activeMarketingSkill || 'product-marketing-context';
  const skill = ecGetMarketingSkill(slug);
  const draft = ecApplyMarketingSkillProfileDefaults(ecLoadMarketingSkillDraft(slug));
  const profile = ecGetMarketingSkillProfile();
  const titleEl = document.getElementById('ec-marketing-skill-title');
  const subtitleEl = document.getElementById('ec-marketing-skill-subtitle');
  const bodyEl = document.getElementById('ec-marketing-skill-body');
  if (titleEl) titleEl.textContent = skill.title;
  if (subtitleEl) subtitleEl.textContent = skill.summary;
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <span style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.1);color:#ff8c00;font-size:12px;font-weight:700;">${MARKETING_SKILL_CATEGORIES[skill.category]?.title || ''}</span>
            <span style="padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.45);font-size:12px;font-weight:700;">${skill.slug}</span>
          </div>
          <div style="font-size:13px;color:rgba(0,0,0,0.52);line-height:1.7;">${skill.summary}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-secondary" type="button" onclick="navigateToPage('ec-branding', { skipConfirm: true })">허브로 돌아가기</button>
          ${skill.toolPage ? `<button class="btn btn-secondary" type="button" onclick="ecOpenMarketingSkillTool('${skill.slug}')">${skill.toolLabel}</button>` : ''}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,0.9fr);gap:16px;align-items:start;">
      <div class="card">
        <h3 style="margin:0 0 14px;">스킬 입력</h3>
        <div style="margin-bottom:14px;padding:12px 14px;border-radius:14px;background:rgba(255,140,0,0.08);border:1px solid rgba(255,140,0,0.14);font-size:12px;line-height:1.7;color:rgba(0,0,0,0.62);">
          ${ecMarketingSkillProfileSummary(profile)}
        </div>

        <!-- 스킬별 고유 입력란 -->
        ${(skill.inputs || []).map((inputLabel, idx) => {
          const inputKey = inputLabel.replace(/[^a-zA-Z0-9가-힣]/g, '_').toLowerCase();
          const inputType = _ecSkillInputType(inputLabel);
          const placeholder = _ecSkillInputPlaceholder(inputLabel);
          const savedVal = (draft.skillInputs && draft.skillInputs[inputKey]) || '';
          if (inputType === 'textarea') {
            return `<label class="form-label" ${idx > 0 ? 'style="margin-top:12px;"' : ''}>${inputLabel} <span style="color:#ff8c00;">*</span></label>
              <textarea id="ec-ms-input-${inputKey}" class="form-input" rows="5" placeholder="${placeholder}">${ecEscapeHtml(savedVal)}</textarea>`;
          }
          return `<label class="form-label" ${idx > 0 ? 'style="margin-top:12px;"' : ''}>${inputLabel} <span style="color:#ff8c00;">*</span></label>
            <input type="${inputType === 'url' ? 'url' : 'text'}" id="ec-ms-input-${inputKey}" class="form-input" value="${ecEscapeHtml(savedVal)}" placeholder="${placeholder}">`;
        }).join('')}

        <!-- 공통 기본 필드 (접이식) -->
        <details style="margin-top:16px;">
          <summary style="font-size:13px;font-weight:600;color:rgba(0,0,0,0.45);cursor:pointer;padding:8px 0;">공통 정보 (선택)</summary>
          <div style="margin-top:8px;">
            <label class="form-label">회사/브랜드</label>
            <input type="text" id="ec-ms-company" class="form-input" value="${ecEscapeHtml(draft.company || '')}" placeholder="예: Makeke">
            <label class="form-label" style="margin-top:12px;">제품/서비스</label>
            <input type="text" id="ec-ms-product" class="form-input" value="${ecEscapeHtml(draft.product || '')}" placeholder="예: AI 마케팅 자동화 앱">
            <label class="form-label" style="margin-top:12px;">타깃 고객</label>
            <input type="text" id="ec-ms-audience" class="form-input" value="${ecEscapeHtml(draft.audience || '')}" placeholder="예: 1인 사업자, 쇼핑몰 운영자">
            <label class="form-label" style="margin-top:12px;">이번 목표</label>
            <input type="text" id="ec-ms-goal" class="form-input" value="${ecEscapeHtml(draft.goal || '')}" placeholder="예: 전환율 개선">
            <label class="form-label" style="margin-top:12px;">참고 URL</label>
            <input type="text" id="ec-ms-url" class="form-input" value="${ecEscapeHtml(draft.url || '')}" placeholder="예: https://makeke.kr">
            <label class="form-label" style="margin-top:12px;">현재 자산/기존 문구</label>
            <textarea id="ec-ms-assets" class="form-input" rows="3" placeholder="기존 랜딩 문구, 세일즈 문서 등">${ecEscapeHtml(draft.assets || '')}</textarea>
            <label class="form-label" style="margin-top:12px;">추가 맥락</label>
            <textarea id="ec-ms-context" class="form-input" rows="3" placeholder="경쟁 상황, 고객 반응, 운영 맥락">${ecEscapeHtml(draft.context || '')}</textarea>
            <label class="form-label" style="margin-top:12px;">제약사항</label>
            <textarea id="ec-ms-constraints" class="form-input" rows="3" placeholder="금지 표현, 예산, 일정, 법적 제약">${ecEscapeHtml(draft.constraints || '')}</textarea>
          </div>
        </details>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
          <button class="btn btn-primary" type="button" onclick="ecMarketingSkillExecute()" id="ec-ms-execute-btn">AI 실행</button>
          <button class="btn btn-secondary" type="button" onclick="ecMarketingSkillGenerate()">프롬프트 생성</button>
          <button class="btn btn-secondary" type="button" onclick="ecMarketingSkillSaveCurrent()">입력 저장</button>
          <button class="btn btn-secondary" type="button" onclick="ecMarketingSkillCopyPrompt()">프롬프트 복사</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
          </ul>
        </div>
        <div class="card">
          <h3 style="margin:0 0 10px;">기대 산출물</h3>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:rgba(0,0,0,0.58);line-height:1.8;">
            ${(skill.deliverables || []).map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <h3 style="margin:0 0 10px;">연결 스킬</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${(skill.related || []).map((relatedSlug) => {
              const related = ecGetMarketingSkill(relatedSlug);
              return `<button class="btn btn-secondary btn-sm" type="button" onclick="ecOpenMarketingSkill('${related.slug}')">${related.title}</button>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>

    <div id="ec-marketing-skill-results" style="margin-top:16px;"></div>
  `;

  if (draft.autoBuild) {
    ecMarketingSkillGenerate();
  }
}

function ecMarketingSkillSaveCurrent() {
  const slug = EC_STATE.activeMarketingSkill || 'product-marketing-context';
  const draft = ecApplyMarketingSkillProfileDefaults(ecReadMarketingSkillForm());
  ecSaveMarketingSkillDraft(slug, draft);
  toast('스킬 입력을 저장했습니다');
}

function ecMarketingSkillGenerate() {
  const slug = EC_STATE.activeMarketingSkill || 'product-marketing-context';
  const skill = ecGetMarketingSkill(slug);
  const draft = ecApplyMarketingSkillProfileDefaults(ecReadMarketingSkillForm());
  ecSaveMarketingSkillDraft(slug, { ...draft, autoBuild: true });
  const prompt = ecMarketingSkillPrompt(skill, draft);
  const checklist = ecMarketingSkillChecklist(skill, draft);
  const el = document.getElementById('ec-marketing-skill-results');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <h3 style="margin:0 0 12px;">실행 체크리스트</h3>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:rgba(0,0,0,0.6);line-height:1.9;">
        ${checklist.map((item) => `<li>${ecEscapeHtml(item)}</li>`).join('')}
      </ol>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <h3 style="margin:0;">Codex 작업 프롬프트</h3>
        <button class="btn btn-secondary" type="button" onclick="ecMarketingSkillCopyPrompt()">프롬프트 복사</button>
      </div>
      <textarea id="ec-marketing-skill-prompt" class="form-input" rows="22" style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${ecEscapeHtml(prompt)}</textarea>
    </div>
  `;
  toast(`${skill.title} 프롬프트를 생성했습니다`);
}

function ecMarketingSkillCopyPrompt() {
  const slug = EC_STATE.activeMarketingSkill || 'product-marketing-context';
  const skill = ecGetMarketingSkill(slug);
  const promptEl = document.getElementById('ec-marketing-skill-prompt');
  const prompt = promptEl?.value || ecMarketingSkillPrompt(skill, ecApplyMarketingSkillProfileDefaults(ecReadMarketingSkillForm()));
  navigator.clipboard.writeText(prompt)
    .then(() => toast('프롬프트를 복사했습니다'))
    .catch(() => toast('프롬프트 복사 실패', 'error'));
}

async function ecMarketingSkillExecute() {
  const slug = EC_STATE.activeMarketingSkill || 'product-marketing-context';
  const skill = ecGetMarketingSkill(slug);
  const draft = ecApplyMarketingSkillProfileDefaults(ecReadMarketingSkillForm());
  const profileId = parseInt(window._globalProfileId || 0, 10) || 0;
  ecSaveMarketingSkillDraft(slug, draft);

  const btn = document.getElementById('ec-ms-execute-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'AI 실행 중...'; }

  const el = document.getElementById('ec-marketing-skill-results');
  if (el) el.innerHTML = `
    <div class="card" style="text-align:center;padding:48px 24px;">
      <div style="font-size:14px;color:rgba(0,0,0,0.5);margin-bottom:12px;">AI가 ${ecEscapeHtml(skill.title)} 산출물을 생성하고 있습니다...</div>
      <div style="width:200px;height:4px;background:rgba(0,0,0,0.08);border-radius:4px;margin:0 auto;overflow:hidden;">
        <div style="width:60%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-light));border-radius:4px;animation:ecSkillProgress 2s ease-in-out infinite;"></div>
      </div>
    </div>
    <style>@keyframes ecSkillProgress{0%{transform:translateX(-100%)}50%{transform:translateX(80%)}100%{transform:translateX(-100%)}}</style>
  `;

  try {
    // PMC(프로덕트 마케팅 컨텍스트) 기반 문서가 있으면 자동 주입
    let pmcContext = '';
    if (slug !== 'product-marketing-context') {
      const pmcResult = EC_STATE._lastPmcResult || '';
      if (pmcResult) pmcContext = pmcResult;
    }
    const res = await api('/api/ecommerce/skill/execute', {
      method: 'POST',
      body: { slug, profile_id: profileId, ...draft, pmcContext },
    });
    ecRenderSkillResult(skill, res);
    toast(`${skill.title} 산출물을 생성했습니다`);
  } catch (e) {
    if (el) el.innerHTML = '';
    toast(`AI 실행 실패: ${e.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'AI 실행'; }
  }
}

function ecRenderSkillResult(skill, res) {
  const el = document.getElementById('ec-marketing-skill-results');
  if (!el) return;

  const resultHtml = (res.result || '')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="margin:16px 0 8px;font-size:15px;font-weight:700;color:#1c1c1e;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:20px 0 10px;font-size:17px;font-weight:700;color:#1c1c1e;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:24px 0 12px;font-size:19px;font-weight:700;color:#1c1c1e;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li style="margin-left:18px;line-height:1.8;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:18px;line-height:1.8;list-style:decimal;">$1</li>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <h3 style="margin:0;">${ecEscapeHtml(skill.title)} 결과</h3>
          ${res.framework ? `<span style="padding:4px 10px;border-radius:999px;background:rgba(0,122,255,0.08);color:#007aff;font-size:11px;font-weight:600;">${ecEscapeHtml(res.framework)}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" type="button" onclick="ecCopySkillResult()">결과 복사</button>
          <button class="btn btn-secondary" type="button" onclick="ecMarketingSkillExecute()">다시 실행</button>
        </div>
      </div>
      <div id="ec-skill-result-content" style="font-size:14px;color:rgba(0,0,0,0.72);line-height:1.8;">${resultHtml}</div>
    </div>
  `;

  EC_STATE._lastSkillResult = res.result || '';
  // PMC 스킬 결과는 다른 스킬의 기반 문서로 자동 주입됨
  if (res.slug === 'product-marketing-context') {
    EC_STATE._lastPmcResult = res.result || '';
  }
}

function ecCopySkillResult() {
  const text = EC_STATE._lastSkillResult || '';
  if (!text) return toast('복사할 결과가 없습니다', 'error');
  navigator.clipboard.writeText(text)
    .then(() => toast('결과를 복사했습니다'))
    .catch(() => toast('결과 복사 실패', 'error'));
}

const STORE_BRANDING_CONFIG = {
  online: {
    prefix: 'ec-ss',
    pageId: 'ec-smartstore',
    title: '온라인샵 브랜딩',
    stepCount: 5,
    categoryLabel: '상품 카테고리 *',
    categoryPlaceholder: '예: 패션, 식품, 뷰티 등',
    targetLabel: '타겟 고객',
    targetPlaceholder: '예: 20-30대 여성',
    vibeLabel: '브랜드 분위기',
    vibePlaceholder: '예: 모던하고 고급스러운',
    extraLabel: '추가 요구사항',
    extraPlaceholder: '선택사항',
    startButton: '스토어명 생성 (30개)',
  },
  offline: {
    prefix: 'ec-os',
    pageId: 'ec-offlineshop',
    title: '오프라인샵 브랜딩',
    stepCount: 5,
    categoryLabel: '매장 업종 *',
    categoryPlaceholder: '예: 카페, 음식점, 미용실, 병원, 편집샵',
    targetLabel: '주요 방문 고객',
    targetPlaceholder: '예: 점심 직장인, 20-40대 여성, 가족 단위 방문객',
    vibeLabel: '공간/브랜드 분위기',
    vibePlaceholder: '예: 따뜻하고 감성적인, 프리미엄하고 차분한',
    extraLabel: '간판/매장 운영 요구사항',
    extraPlaceholder: '예: 간판 가독성 강조, 매장 외부 배너 활용, 포장 패키지 고려',
    startButton: '매장명 생성 (30개)',
  },
};

function ecCreateStoreBrandingState() {
  return {
    step: 1,
    prefs: {},
    names: [],
    slogans: [],
    logos: [],
    selection: {},
    loading: false,
    phase: 'idle',
    statusText: '',
  };
}

const STORE_BRANDING_STATE = {
  online: ecCreateStoreBrandingState(),
  offline: ecCreateStoreBrandingState(),
};

function ecStoreCfg(mode) {
  return STORE_BRANDING_CONFIG[mode] || STORE_BRANDING_CONFIG.online;
}

function ecStoreState(mode) {
  return STORE_BRANDING_STATE[mode];
}

function ecStoreEl(mode, suffix) {
  return document.getElementById(`${ecStoreCfg(mode).prefix}-${suffix}`);
}

function ecStoreResetState(mode) {
  STORE_BRANDING_STATE[mode] = ecCreateStoreBrandingState();
  return STORE_BRANDING_STATE[mode];
}

function ecStoreApplyCopy(mode) {
  const cfg = ecStoreCfg(mode);
  const categoryLabel = ecStoreEl(mode, 'category-label');
  const categoryInput = ecStoreEl(mode, 'category');
  const targetLabel = ecStoreEl(mode, 'target-label');
  const targetInput = ecStoreEl(mode, 'target');
  const vibeLabel = ecStoreEl(mode, 'vibe-label');
  const vibeInput = ecStoreEl(mode, 'vibe');
  const extraLabel = ecStoreEl(mode, 'extra-label');
  const extraInput = ecStoreEl(mode, 'extra');
  const startButton = ecStoreEl(mode, 'start-btn');
  if (categoryLabel) categoryLabel.textContent = cfg.categoryLabel;
  if (categoryInput) categoryInput.placeholder = cfg.categoryPlaceholder;
  if (targetLabel) targetLabel.textContent = cfg.targetLabel;
  if (targetInput) targetInput.placeholder = cfg.targetPlaceholder;
  if (vibeLabel) vibeLabel.textContent = cfg.vibeLabel;
  if (vibeInput) vibeInput.placeholder = cfg.vibePlaceholder;
  if (extraLabel) extraLabel.textContent = cfg.extraLabel;
  if (extraInput) extraInput.placeholder = cfg.extraPlaceholder;
  if (startButton) startButton.textContent = cfg.startButton;
}

function ecStoreStepTitle(mode, step) {
  const labels = mode === 'offline'
    ? ['기본 정보', '매장명 선택', '슬로건 선택', '로고 선택', '최종 브랜딩']
    : ['기본 정보', '스토어명 선택', '슬로건 선택', '로고 선택', '브랜딩 에셋'];
  return labels[step - 1] || '브랜딩';
}

function ecStorePhaseMeta(mode, phase) {
  const copy = {
    idle: {
      title: '준비됨',
      detail: mode === 'offline'
        ? '매장 업종과 방문 고객을 입력하면 다음 단계로 바로 넘어갑니다.'
        : '카테고리와 고객 톤을 입력하면 다음 단계로 바로 넘어갑니다.',
    },
    names: {
      title: mode === 'offline' ? '매장명 후보를 정리하는 중' : '스토어명 후보를 정리하는 중',
      detail: mode === 'offline'
        ? '간판, 검색, 소개 문구에서 모두 버틸 이름을 추려오고 있습니다.'
        : '검색 노출과 기억 용이성을 함께 고려한 이름 후보를 추려오고 있습니다.',
    },
    slogans: {
      title: '슬로건 후보를 정리하는 중',
      detail: '선택한 이름과 브랜드 분위기에 맞춰 한 줄 메시지를 압축하고 있습니다.',
    },
    logos: {
      title: '로고 시안을 준비하는 중',
      detail: '작은 썸네일에서도 읽히는 시안을 우선으로 생성하고 있습니다.',
    },
    finalize: {
      title: '최종 브랜딩 에셋을 정리하는 중',
      detail: mode === 'offline'
        ? '현장 적용을 염두에 둔 요약과 에셋을 함께 묶고 있습니다.'
        : '브랜드 브리프와 실제 사용 가능한 에셋을 함께 묶고 있습니다.',
    },
    complete: {
      title: '완료',
      detail: '결과가 준비됐습니다. 히스토리에서도 다시 볼 수 있습니다.',
    },
  };
  return copy[phase] || copy.idle;
}

function ecStoreWaitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function ecStoreRenderBrief(mode) {
  const state = ecStoreState(mode);
  const briefEl = ecStoreEl(mode, 'brief');
  if (!briefEl) return;
  const chips = [];
  if (state.prefs.category) chips.push(`<span style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.1);color:#ff8c00;font-size:12px;font-weight:700;">${ecEscapeHtml(state.prefs.category)}</span>`);
  if (state.prefs.targetAudience) chips.push(`<span style="padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.52);font-size:12px;font-weight:700;">${ecEscapeHtml(state.prefs.targetAudience)}</span>`);
  if (state.prefs.vibe) chips.push(`<span style="padding:6px 10px;border-radius:999px;background:rgba(52,199,89,0.1);color:#2b8a47;font-size:12px;font-weight:700;">${ecEscapeHtml(state.prefs.vibe)}</span>`);
  const rows = [
    ['이름', state.selection.name],
    ['슬로건', state.selection.slogan],
    ['추가 요구', state.prefs.extraDetails],
  ].filter(([, value]) => value);
  briefEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:${chips.length ? '12px' : '0'};">${chips.join('')}</div>
    ${rows.length ? rows.map(([label, value]) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(0,0,0,0.05);">
        <span style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;">${label}</span>
        <span style="font-size:13px;color:#1c1c1e;text-align:right;line-height:1.6;">${ecEscapeHtml(value)}</span>
      </div>
    `).join('') : '<div style="font-size:13px;color:rgba(0,0,0,0.4);line-height:1.7;">아직 브리프가 비어 있습니다. 기본 정보를 입력하면 이곳에 현재 선택 내용이 요약됩니다.</div>'}
  `;
}

function ecStoreRenderStatus(mode) {
  const state = ecStoreState(mode);
  const statusEl = ecStoreEl(mode, 'live-status');
  if (!statusEl) return;
  const phaseMeta = ecStorePhaseMeta(mode, state.loading ? state.phase : (state.step >= 5 ? 'complete' : 'idle'));
  statusEl.style.background = state.loading
    ? 'rgba(255,140,0,0.14)'
    : state.step >= 5
      ? 'rgba(52,199,89,0.12)'
      : 'rgba(255,255,255,0.72)';
  statusEl.style.borderColor = state.loading
    ? 'rgba(255,140,0,0.22)'
    : state.step >= 5
      ? 'rgba(52,199,89,0.2)'
      : 'rgba(0,0,0,0.06)';
  statusEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;letter-spacing:0.04em;">현재 상태</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#1c1c1e;">${phaseMeta.title}</div>
      </div>
      <div style="font-size:12px;color:${state.loading ? '#ff8c00' : state.step >= 5 ? '#2b8a47' : 'rgba(0,0,0,0.42)'};font-weight:700;">
        ${state.loading ? '작업 진행 중' : state.step >= 5 ? '결과 준비 완료' : '입력 대기'}
      </div>
    </div>
    <div style="margin-top:8px;font-size:13px;color:rgba(0,0,0,0.56);line-height:1.7;">${ecEscapeHtml(state.statusText || phaseMeta.detail)}</div>
  `;
}

function ecStoreRenderProgress(mode) {
  const cfg = ecStoreCfg(mode);
  const state = ecStoreState(mode);
  const fillEl = ecStoreEl(mode, 'progress-fill');
  const textEl = ecStoreEl(mode, 'progress-text');
  if (fillEl) fillEl.style.width = `${(state.step / cfg.stepCount) * 100}%`;
  if (textEl) textEl.textContent = `${state.step}/${cfg.stepCount} ${ecStoreStepTitle(mode, state.step)}`;
}

function ecStoreSetBusy(mode, loading, phase = 'idle', statusText = '') {
  const state = ecStoreState(mode);
  state.loading = loading;
  state.phase = phase;
  state.statusText = statusText;
  ecStoreRenderStatus(mode);
  ecStoreRenderBrief(mode);
}

function ecStoreRenderLoadingChoices(containerId, count = 6, multiline = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `
    <div style="padding:${multiline ? '16px' : '14px'};border-radius:14px;background:linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.07), rgba(0,0,0,0.04));background-size:200% 100%;animation:ecSkillProgress 1.6s ease-in-out infinite;">
      <div style="height:12px;border-radius:999px;background:rgba(255,255,255,0.75);width:${multiline ? '92%' : '68%'};"></div>
      ${multiline ? '<div style="height:12px;border-radius:999px;background:rgba(255,255,255,0.7);width:76%;margin-top:10px;"></div>' : ''}
    </div>
  `).join('');
}

/* 두번째 ecBrandingInit 제거됨 — 라인 265의 첫번째 버전(검색/필터 + 스킬 열기) 사용 */

function ecBacklinkInit() {
  const target = document.getElementById('ec-backlink-target');
  if (target && !target.value.trim()) target.value = 'makeke.kr';
}

function ecEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ecRenderBacklinkResults(payload) {
  const resultsEl = document.getElementById('ec-backlink-results');
  if (!resultsEl) return;

  const topDomains = payload.topDomains || [];
  const rows = payload.results || [];
  const attempts = payload.attempts || [];

  const summaryHtml = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">대상 도메인</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${ecEscapeHtml(payload.targetDomain || '-')}</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">검증된 백링크</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${Number(payload.verifiedCount || 0)}개</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">참조 도메인</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${Number(payload.referringDomainCount || 0)}개</div>
        </div>
      </div>
      ${topDomains.length ? `
        <div style="margin-top:14px;">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:8px;">상위 참조 도메인</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${topDomains.map((item) => `
              <span style="padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.1);color:#ff8c00;font-size:12px;font-weight:600;">
                ${ecEscapeHtml(item.domain)} · ${Number(item.count || 0)}
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${attempts.length ? `
        <div style="margin-top:14px;font-size:12px;color:rgba(0,0,0,0.42);line-height:1.7;">
          검색 시도:
          ${attempts.map((attempt) => `${ecEscapeHtml(attempt.provider)} (${ecEscapeHtml(attempt.query)}) ${attempt.ok ? `${Number(attempt.resultCount || 0)}건` : '실패'}`).join(' / ')}
        </div>
      ` : ''}
    </div>
  `;

  if (!rows.length) {
    resultsEl.innerHTML = summaryHtml + `
      <div class="card" style="text-align:center;color:rgba(0,0,0,0.45);padding:36px 24px;">
        아직 검증된 백링크를 찾지 못했습니다. 다른 도메인이나 세부 URL로 다시 시도해보세요.
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = summaryHtml + rows.map((row) => `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">${ecEscapeHtml(row.title || row.referringPage || '-')}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.45);line-height:1.6;">${ecEscapeHtml(row.referringDomain || '')} · ${ecEscapeHtml(row.searchProvider || '')}</div>
        </div>
        <a href="${ecEscapeHtml(row.referringPage || '#')}" target="_blank" rel="noopener" class="btn btn-secondary">페이지 열기</a>
      </div>
      <div style="font-size:13px;color:rgba(0,0,0,0.58);line-height:1.7;margin-bottom:10px;">
        ${ecEscapeHtml(row.snippet || row.links?.[0]?.context || '')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${(row.links || []).map((link) => `
          <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
            <div style="font-size:12px;color:rgba(0,0,0,0.4);margin-bottom:4px;">앵커 텍스트</div>
            <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${ecEscapeHtml(link.anchorText || '-')}</div>
            <div style="font-size:12px;color:rgba(0,0,0,0.5);line-height:1.6;margin-bottom:6px;">${ecEscapeHtml(link.context || '')}</div>
            <div style="font-size:12px;color:#ff8c00;word-break:break-all;">${ecEscapeHtml(link.href || '')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

async function ecBacklinkCheck() {
  const target = document.getElementById('ec-backlink-target')?.value?.trim();
  const limit = parseInt(document.getElementById('ec-backlink-limit')?.value, 10) || 10;
  if (!target) return toast('검사할 도메인이나 URL을 입력하세요', 'error');
  ecShowLoading('ec-backlink-results', '검색 결과를 모으고 실제 백링크를 검증하는 중입니다...');
  try {
    const res = await api('/api/ecommerce/backlink/check', { method: 'POST', body: { target, limit } });
    ecRenderBacklinkResults(res || {});
    toast(`백링크 검사 완료! 검증된 링크 ${Number(res?.verifiedCount || 0)}건`);
  } catch (e) {
    const el = document.getElementById('ec-backlink-results');
    if (el) el.innerHTML = '';
    toast('백링크 검사 실패: ' + e.message, 'error');
  }
}

function ecBrokenLinkInit() {
  const target = document.getElementById('ec-broken-link-target');
  if (target && !target.value.trim()) target.value = 'https://makeke.kr';
}

function ecRenderBrokenLinkResults(payload) {
  const resultsEl = document.getElementById('ec-broken-link-results');
  if (!resultsEl) return;
  const pages = payload.crawledPages || [];
  const broken = payload.brokenLinks || [];
  const crawlErrors = payload.crawlErrors || [];

  const summary = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">대상 도메인</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${ecEscapeHtml(payload.targetDomain || '-')}</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">크롤링 페이지</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${Number(payload.crawledPageCount || 0)}개</div>
        </div>
        <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.72);border:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:rgba(0,0,0,0.45);margin-bottom:4px;">깨진 링크</div>
          <div style="font-size:18px;font-weight:700;color:#1c1c1e;">${Number(payload.brokenCount || 0)}개</div>
        </div>
      </div>
      ${crawlErrors.length ? `
        <div style="margin-top:14px;font-size:12px;color:rgba(0,0,0,0.42);line-height:1.7;">
          페이지 접근 실패:
          ${crawlErrors.slice(0, 5).map((item) => `${ecEscapeHtml(item.url)}${item.statusCode ? ` (${item.statusCode})` : ''}${item.error ? ` - ${ecEscapeHtml(item.error)}` : ''}`).join(' / ')}
        </div>
      ` : ''}
    </div>
  `;

  if (!broken.length) {
    resultsEl.innerHTML = summary + `
      <div class="card" style="text-align:center;color:rgba(0,0,0,0.45);padding:36px 24px;">
        현재 검사 범위에서는 깨진 링크를 찾지 못했습니다.
      </div>
    `;
    return;
  }

  resultsEl.innerHTML = summary + broken.map((item) => `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:#1c1c1e;margin-bottom:4px;">${ecEscapeHtml(item.url || '-')}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.45);line-height:1.6;">
            ${ecEscapeHtml(item.type || '')} · ${ecEscapeHtml(item.tag || '')} · ${item.statusCode ? `${Number(item.statusCode)}` : '요청 실패'}
          </div>
        </div>
        <a href="${ecEscapeHtml(item.sourcePage || '#')}" target="_blank" rel="noopener" class="btn btn-secondary">출처 페이지</a>
      </div>
      ${item.anchorText ? `<div style="font-size:13px;color:rgba(0,0,0,0.58);margin-bottom:6px;">앵커 텍스트: ${ecEscapeHtml(item.anchorText)}</div>` : ''}
      ${item.error ? `<div style="font-size:12px;color:#ff3b30;line-height:1.6;">${ecEscapeHtml(item.error)}</div>` : ''}
      ${item.finalUrl && item.finalUrl !== item.url ? `<div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.6;">최종 이동 URL: ${ecEscapeHtml(item.finalUrl)}</div>` : ''}
    </div>
  `).join('');
}

async function ecBrokenLinkCheck() {
  const target = document.getElementById('ec-broken-link-target')?.value?.trim();
  const maxPages = parseInt(document.getElementById('ec-broken-link-max-pages')?.value, 10) || 20;
  const includeExternal = !!document.getElementById('ec-broken-link-external')?.checked;
  if (!target) return toast('검사할 도메인이나 URL을 입력하세요', 'error');
  ecShowLoading('ec-broken-link-results', '사이트를 크롤링하면서 깨진 링크를 검사하는 중입니다...');
  try {
    const res = await api('/api/ecommerce/link/check', { method: 'POST', body: { target, maxPages, includeExternal } });
    ecRenderBrokenLinkResults(res || {});
    toast(`브로큰 링크 검사 완료! 문제 링크 ${Number(res?.brokenCount || 0)}건`);
  } catch (e) {
    const el = document.getElementById('ec-broken-link-results');
    if (el) el.innerHTML = '';
    toast('브로큰 링크 검사 실패: ' + e.message, 'error');
  }
}

function ecSeoAuditInit() {
  const target = document.getElementById('ec-seo-audit-target');
  if (target && !target.value.trim()) target.value = 'https://makeke.kr';
}

function ecSeoResultCard(title, body) {
  return `
    <div class="card" style="margin-bottom:12px;">
      <h3 style="margin:0 0 10px;">${title}</h3>
      ${body}
    </div>
  `;
}

function ecSeoList(items) {
  if (!items || !items.length) {
    return '<div style="font-size:13px;color:rgba(0,0,0,0.42);">이상 항목이 없습니다.</div>';
  }
  return `<ul style="margin:0;padding-left:18px;font-size:13px;color:rgba(0,0,0,0.62);line-height:1.8;">${items.map((item) => `<li>${ecEscapeHtml(item)}</li>`).join('')}</ul>`;
}

function ecRenderSeoAudit(mode, payload) {
  const el = document.getElementById('ec-seo-audit-results');
  if (!el) return;
  const scoreBadge = (score) => `<span style="display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.1);color:#ff8c00;font-size:12px;font-weight:700;">${Number(score || 0)}점</span>`;

  if (mode === 'audit') {
    el.innerHTML = [
      ecSeoResultCard('종합 점수', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.healthScore)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">페이지 점수<br><strong>${Number(payload.summary?.pageScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">기술 점수<br><strong>${Number(payload.summary?.technicalScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">콘텐츠 점수<br><strong>${Number(payload.summary?.contentScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">AI SEO 점수<br><strong>${Number(payload.summary?.geoScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">로컬 SEO 점수<br><strong>${Number(payload.summary?.localScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">이미지 점수<br><strong>${Number(payload.summary?.imageScore || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">스키마 수<br><strong>${Number(payload.summary?.schemaCount || 0)}</strong></div>
          <div style="padding:12px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">hreflang 수<br><strong>${Number(payload.summary?.hreflangCount || 0)}</strong></div>
        </div>
      `),
      ecSeoResultCard('중요 이슈', ecSeoList(payload.criticalIssues || [])),
      ecSeoResultCard('빠른 개선 포인트', ecSeoList(payload.quickWins || [])),
    ].join('');
    return;
  }

  if (mode === 'page') {
    el.innerHTML = [
      ecSeoResultCard('페이지 SEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          title: ${ecEscapeHtml(payload.title || '-')}<br>
          meta description: ${ecEscapeHtml(payload.metaDescription || '-')}<br>
          canonical: ${ecEscapeHtml(payload.canonical || '-')}<br>
          단어 수: ${Number(payload.wordCount || 0)}<br>
          내부 링크: ${Number(payload.internalLinkCount || 0)} / 외부 링크: ${Number(payload.externalLinkCount || 0)}<br>
          이미지: ${Number(payload.imageCount || 0)} / alt 누락: ${Number(payload.missingAltCount || 0)}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'technical') {
    const security = payload.security || {};
    el.innerHTML = [
      ecSeoResultCard('기술 SEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          HTTPS: ${security.https ? '예' : '아니오'}<br>
          robots.txt: ${payload.robots?.exists ? '있음' : '없음'}<br>
          sitemap: ${payload.sitemap?.exists ? `있음 (${ecEscapeHtml(payload.sitemap?.type || '')})` : '없음'}<br>
          스키마 수: ${Number(payload.schema?.jsonLdCount || 0) + Number(payload.schema?.microdataCount || 0)}<br>
          hreflang 수: ${Number(payload.hreflang?.entries?.length || 0)}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'content') {
    el.innerHTML = [
      ecSeoResultCard('콘텐츠 SEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          단어 수: ${Number(payload.wordCount || 0)}<br>
          문단 수: ${Number(payload.paragraphCount || 0)}<br>
          작성자 신호: ${payload.authorSignals ? '있음' : '없음'}<br>
          문의 신호: ${payload.contactSignals ? '있음' : '없음'}<br>
          소개 신호: ${payload.aboutSignals ? '있음' : '없음'}<br>
          정책 신호: ${payload.policySignals ? '있음' : '없음'}<br>
          FAQ 신호: ${payload.faqSignals ? '있음' : '없음'}<br>
          리뷰 신호: ${payload.reviewSignals ? '있음' : '없음'}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'geo') {
    el.innerHTML = [
      ecSeoResultCard('AI SEO / GEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          llms.txt: ${payload.llmsTxtExists ? '있음' : '없음'}<br>
          FAQ 신호: ${payload.faqSignals ? '있음' : '없음'}<br>
          인용 신호 수: ${Number(payload.citationSignals || 0)}<br>
          차단 AI 크롤러: ${ecEscapeHtml((payload.aiBlockedAgents || []).join(', ') || '-')}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'local') {
    el.innerHTML = [
      ecSeoResultCard('로컬 SEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          LocalBusiness 스키마: ${payload.localBusinessSchema ? '있음' : '없음'}<br>
          전화번호 신호: ${payload.phoneSignal ? '있음' : '없음'}<br>
          주소 신호: ${payload.addressSignal ? '있음' : '없음'}<br>
          영업시간 신호: ${payload.hoursSignal ? '있음' : '없음'}<br>
          리뷰 신호: ${payload.reviewSignal ? '있음' : '없음'}<br>
          지도 링크 수: ${Number(payload.mapLinkCount || 0)}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'schema') {
    el.innerHTML = [
      ecSeoResultCard('스키마 마크업', `
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          JSON-LD: ${Number(payload.jsonLdCount || 0)}<br>
          Microdata: ${Number(payload.microdataCount || 0)}<br>
          타입: ${ecEscapeHtml((payload.types || []).join(', ') || '-')}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'images') {
    el.innerHTML = [
      ecSeoResultCard('이미지 SEO', `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          ${scoreBadge(payload.score)}
          <div style="font-size:13px;color:rgba(0,0,0,0.45);">${ecEscapeHtml(payload.url || '')}</div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
          이미지 수: ${Number(payload.imageCount || 0)}<br>
          alt 누락: ${Number(payload.missingAltCount || 0)}<br>
          일반 파일명: ${Number(payload.genericFilenameCount || 0)}<br>
          최신 포맷 수: ${Number(payload.modernFormatCount || 0)}<br>
          lazy-load 수: ${Number(payload.lazyLoadedCount || 0)}
        </div>
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }

  if (mode === 'sitemap') {
    el.innerHTML = ecSeoResultCard('사이트맵', `
      <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);">
        주소: ${ecEscapeHtml(payload.url || '-')}<br>
        존재 여부: ${payload.exists ? '있음' : '없음'}<br>
        타입: ${ecEscapeHtml(payload.type || '-')}<br>
        항목 수: ${Number(payload.urlCount || 0)}
      </div>
    `);
    return;
  }

  if (mode === 'hreflang') {
    el.innerHTML = [
      ecSeoResultCard('Hreflang', `
        <div style="font-size:13px;line-height:1.8;color:rgba(0,0,0,0.62);margin-bottom:10px;">
          감지 수: ${Number(payload.entries?.length || 0)}
        </div>
        ${(payload.entries || []).length ? `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${(payload.entries || []).map((entry) => `
              <div style="padding:10px;border:1px solid rgba(0,0,0,0.06);border-radius:12px;">
                <strong>${ecEscapeHtml(entry.hreflang || '-')}</strong><br>
                <span style="font-size:12px;color:rgba(0,0,0,0.5);">${ecEscapeHtml(entry.href || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `),
      ecSeoResultCard('이슈', ecSeoList(payload.issues || [])),
    ].join('');
    return;
  }
}

async function ecSeoRun() {
  const url = document.getElementById('ec-seo-audit-target')?.value?.trim();
  const mode = document.getElementById('ec-seo-audit-mode')?.value || 'audit';
  if (!url) return toast('검사할 URL을 입력하세요', 'error');
  ecShowLoading('ec-seo-audit-results', 'SEO 진단을 실행하는 중입니다...');
  try {
    const res = await api(`/api/ecommerce/seo/${mode}`, { method: 'POST', body: { url, mode } });
    ecRenderSeoAudit(mode, res || {});
    toast('SEO 진단 완료!');
  } catch (e) {
    const el = document.getElementById('ec-seo-audit-results');
    if (el) el.innerHTML = '';
    toast('SEO 진단 실패: ' + e.message, 'error');
  }
}

// ── 로고 생성 ──────────────────────────────────────────────

const EC_LOGO_TYPES = [
  { icon: '◉', label: '심볼만', value: 'symbol' }, { icon: 'Aa', label: '워드마크', value: 'wordmark' },
  { icon: '◉A', label: '콤비', value: 'combination' }, { icon: '⊞', label: '스택', value: 'stacked' },
  { icon: '🛡', label: '엠블럼', value: 'emblem' }, { icon: 'A', label: '레터마크', value: 'lettermark' },
  { icon: '🐻', label: '마스코트', value: 'mascot' }, { icon: '◎', label: '추상', value: 'abstract' },
  { icon: '▣', label: '네거티브', value: 'negative_space' }, { icon: '🎬', label: '애니', value: 'animation' },
];
const EC_LOGO_STYLES = [
  { icon: '—', label: '미니멀', value: 'minimalist' }, { icon: '◇', label: '모던', value: 'modern' },
  { icon: '⚜', label: '클래식', value: 'classic' }, { icon: '★', label: '플레이풀', value: 'playful' },
  { icon: '♦', label: '럭셔리', value: 'luxury' }, { icon: '⬢', label: '테크', value: 'tech' },
  { icon: '❀', label: '오가닉', value: 'organic' }, { icon: '△', label: '지오메트릭', value: 'geometric' },
  { icon: '❧', label: '빈티지', value: 'vintage' }, { icon: '▌', label: '볼드', value: 'bold' },
  { icon: '✎', label: '핸드라이팅', value: 'handwritten' }, { icon: '◐', label: '그라디언트', value: 'gradient' },
  { icon: '✧', label: '네온', value: 'neon' }, { icon: '🌿', label: '내추럴', value: 'natural' },
  { icon: '💼', label: '프로', value: 'professional' }, { icon: '🔥', label: '트렌디', value: 'trendy' },
  { icon: '🎨', label: '아트', value: 'artistic' }, { icon: '🏢', label: '코퍼레이트', value: 'corporate' },
];

const EC_LOGO_COLORS = [
  { icon: '⬛', label: '모노크롬', value: 'monochrome' },
  { icon: '🔵', label: '신뢰 블루', value: 'blue_trust' },
  { icon: '🔴', label: '에너지 레드', value: 'red_energy' },
  { icon: '🟢', label: '자연 그린', value: 'green_nature' },
  { icon: '🟣', label: '크리에이티브 퍼플', value: 'purple_creative' },
  { icon: '🟠', label: '따뜻한 웜톤', value: 'orange_warm' },
  { icon: '🩵', label: '모던 틸', value: 'teal_modern' },
  { icon: '🩷', label: '소프트 핑크', value: 'pink_soft' },
  { icon: '🟡', label: '럭셔리 골드', value: 'gold_luxury' },
  { icon: '🔷', label: '클래식 네이비', value: 'navy_classic' },
  { icon: '🌅', label: '선셋 그라디언트', value: 'gradient_sunset' },
  { icon: '🎨', label: 'AI 추천', value: 'auto' },
];

function ecLogoInit() {
  ecOptionGrid('ec-logo-types', EC_LOGO_TYPES, 'logoType', 0);
  ecOptionGrid('ec-logo-styles', EC_LOGO_STYLES, 'logoStyle', 0);
  ecOptionGrid('ec-logo-colors', EC_LOGO_COLORS, 'logoColor', 11);
  ecOptionGrid('ec-logo-ratio', EC_RATIO_STANDARD, 'logoRatio', 0);
}

async function ecLogoGenerate() {
  const brand = document.getElementById('ec-logo-brand').value.trim();
  if (!brand) return toast('브랜드명을 입력하세요', 'error');
  ecShowLoading('ec-logo-results', 'AI가 로고를 디자인하고 있습니다...');
  try {
    const res = await api('/api/ecommerce/logo/generate', { method: 'POST', body: {
      brandName: brand, text: document.getElementById('ec-logo-text').value,
      logoType: EC_STATE.logoType, designStyle: EC_STATE.logoStyle,
      colorPalette: EC_STATE.logoColor, aspectRatio: EC_STATE.logoRatio,
      additionalInstructions: document.getElementById('ec-logo-extra').value,
      count: parseInt(document.getElementById('ec-logo-count').value) || 4,
    }});
    ecRenderImages('ec-logo-results', res.images || []);
    if ((res.images || []).length) toast('로고 생성 완료!');
  } catch (e) { document.getElementById('ec-logo-results').innerHTML = ''; toast('로고 생성 실패: ' + e.message, 'error'); }
}

// ── 온라인샵 브랜딩 ──────────────────────────────────────

function ecSsInit() {
  ecStoreInit('online');
}

function ecSsSetStep(n) {
  ecStoreSetStep('online', n);
}

function ecSsBack(step) { ecStoreSetStep('online', step); }

function ecOsInit() {
  ecStoreInit('offline');
}

function ecOsSetStep(n) {
  ecStoreSetStep('offline', n);
}

function ecOsBack(step) { ecStoreSetStep('offline', step); }

function ecStoreInit(mode) {
  const cfg = ecStoreCfg(mode);
  const state = ecStoreResetState(mode);
  ecStoreApplyCopy(mode);
  const indicator = ecStoreEl(mode, 'step-indicator');
  if (indicator) {
    indicator.innerHTML = Array.from({ length: cfg.stepCount }, (_, idx) => idx + 1).map((s) =>
      `<div class="ec-ss-step-dot ${s === 1 ? 'active' : ''}" id="${cfg.prefix}-dot-${s}">${s}</div>`
    ).join('');
  }
  state.statusText = ecStorePhaseMeta(mode, 'idle').detail;
  ecStoreSetStep(mode, 1);
  ecStoreRenderStatus(mode);
  ecStoreRenderBrief(mode);
}

function ecStoreSetStep(mode, n) {
  const cfg = ecStoreCfg(mode);
  const state = ecStoreState(mode);
  state.step = n;
  for (let i = 1; i <= cfg.stepCount; i++) {
    const el = ecStoreEl(mode, `step${i}`);
    if (el) el.style.display = i === n ? '' : 'none';
    const dot = document.getElementById(`${cfg.prefix}-dot-${i}`);
    if (dot) dot.className = 'ec-ss-step-dot' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  ecStoreRenderProgress(mode);
  ecStoreRenderBrief(mode);
}

function ecSsRenderChoiceButtons(containerId, items, onSelect, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = options.className || 'btn btn-secondary';
    button.textContent = item;
    button.style.padding = options.multiline ? '14px 16px' : '14px 12px';
    button.style.lineHeight = '1.6';
    button.style.minHeight = options.multiline ? '64px' : '52px';
    if (options.multiline) {
      button.style.textAlign = 'left';
      button.style.whiteSpace = 'normal';
    }
    button.onclick = () => onSelect(item);
    container.appendChild(button);
  });
}

function ecStoreRenderLogoChoices(mode, images) {
  const container = ecStoreEl(mode, 'logos');
  if (!container) return;
  container.innerHTML = '';
  images.forEach((img, i) => {
    const src = typeof img === 'string' ? img : img?.url;
    if (!src) return;
    const card = document.createElement('div');
    card.className = 'ec-result-card';
    card.style.cursor = 'pointer';
    card.onclick = () => ecStoreSelectLogo(mode, src);
    card.innerHTML = `<img src="${src}" alt="로고 ${i + 1}">`;
    container.appendChild(card);
  });
}

function ecStoreRenderFinal(mode, assets) {
  const state = ecStoreState(mode);
  const finalEl = ecStoreEl(mode, 'final');
  if (!finalEl) return;
  const chips = (assets.keywords || []).map((keyword) => `
    <span style="padding:6px 10px;border-radius:999px;background:rgba(var(--accent-rgb),0.1);font-size:12px;font-weight:700;color:#ff8c00;">${ecEscapeHtml(keyword)}</span>
  `).join('');
  const strategicRows = [
    ['한 줄 정의', assets.oneLiner],
    ['브랜드 컨셉', assets.concept],
    ['포지셔닝', assets.positioning],
    ['고객 약속', assets.promise],
    ['차별화 포인트', assets.differentiation],
  ].filter(([, value]) => value);
  const customerRows = [
    ['고객 인사이트', assets.audienceInsight],
    ['이름 선택 이유', assets.namingRationale],
    ['슬로건 선택 이유', assets.sloganRationale],
  ].filter(([, value]) => value);
  const copyRows = [
    ['톤앤매너', assets.tone],
    ['메인 카피', assets.heroHeadline],
    ['보조 카피', assets.heroSubheadline],
    ['프로모션 카피', assets.promoMessage],
  ].filter(([, value]) => value);
  const visualRows = [
    ['비주얼 방향', assets.visualDirection],
    ['추천 컬러 팔레트', Array.isArray(assets.colorPalette) ? assets.colorPalette.join(' / ') : assets.colorPalette],
  ].filter(([, value]) => value);
  const listSections = [
    ['메시지 축', assets.messagePillars],
    ['브랜드 성격', assets.brandPersonality],
    ['비주얼 모티프', assets.visualMotifs],
    ['콘텐츠 각도', assets.contentAngles],
    ['활용 아이디어', assets.applicationIdeas],
    ['바로 실행할 항목', assets.quickWins],
    ['주의할 점', assets.riskNotes],
  ].filter(([, items]) => Array.isArray(items) && items.length);
  const assetCards = [
    { label: '선택한 로고', url: assets.selectedLogoUrl || state.selection.logoUrl },
    { label: assets.mainBannerLabel || '메인 에셋', url: assets.mainBannerUrl },
    { label: assets.promoBannerLabel || '프로모션 에셋', url: assets.promoBannerUrl },
  ].filter((item) => item.url);

  finalEl.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px;">
        <div style="max-width:620px;">
          <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;letter-spacing:0.04em;margin-bottom:6px;">FINAL BRAND REPORT</div>
          <h3 style="margin:0 0 6px;">${ecEscapeHtml(state.selection.name || '')}</h3>
          <div style="font-size:14px;color:rgba(0,0,0,0.5);font-weight:600;">${ecEscapeHtml(state.selection.slogan || '')}</div>
          ${assets.description ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.8;color:rgba(0,0,0,0.66);">${ecEscapeHtml(assets.description)}</p>` : ''}
        </div>
        ${chips ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">${chips}</div>` : ''}
      </div>
      ${assets.oneLiner ? `
        <div style="padding:16px 18px;border-radius:16px;background:linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,107,0,0.06));border:1px solid rgba(255,140,0,0.16);">
          <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:6px;">핵심 요약</div>
          <div style="font-size:16px;font-weight:700;line-height:1.6;color:#1c1c1e;">${ecEscapeHtml(assets.oneLiner)}</div>
        </div>
      ` : ''}
    </div>

    ${strategicRows.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
        ${strategicRows.map(([label, value]) => `
          <div class="card" style="padding:16px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:8px;">${label}</div>
            <div style="font-size:14px;color:#1c1c1e;line-height:1.7;">${ecEscapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${(customerRows.length || copyRows.length || visualRows.length) ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:16px;">
        ${customerRows.length ? `
          <div class="card" style="padding:16px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:10px;">고객 관점</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${customerRows.map(([label, value]) => `
                <div>
                  <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:4px;">${label}</div>
                  <div style="font-size:14px;line-height:1.7;color:#1c1c1e;">${ecEscapeHtml(value)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${copyRows.length ? `
          <div class="card" style="padding:16px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:10px;">카피 관점</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${copyRows.map(([label, value]) => `
                <div>
                  <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:4px;">${label}</div>
                  <div style="font-size:14px;line-height:1.7;color:#1c1c1e;">${ecEscapeHtml(value)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${visualRows.length ? `
          <div class="card" style="padding:16px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:10px;">비주얼 시스템</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${visualRows.map(([label, value]) => `
                <div>
                  <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:4px;">${label}</div>
                  <div style="font-size:14px;line-height:1.7;color:#1c1c1e;">${ecEscapeHtml(value)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    ` : ''}

    ${listSections.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
        ${listSections.map(([title, items]) => `
          <div class="card" style="padding:16px;">
            <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:10px;">${title}</div>
            <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.8;color:#1c1c1e;">
              ${items.map((item) => `<li>${ecEscapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${assetCards.length ? assetCards.map((item, idx) => `
      <div class="ec-result-card">
        <div style="padding:10px 12px 0;font-size:12px;color:rgba(0,0,0,0.42);font-weight:700;">${item.label}</div>
        <img src="${item.url}" alt="${item.label}">
        <div class="ec-result-actions">
          <button onclick="ecShowLightbox('${String(item.url).replace(/'/g, "\\'")}')">크게보기</button>
          <button onclick="ecDownloadImage('${String(item.url).replace(/'/g, "\\'")}', 'asset_${idx + 1}.png')">다운로드</button>
        </div>
      </div>
    `).join('') : '<div class="card">결과 이미지가 없습니다.</div>'}
  `;
}

async function ecSsStart() {
  await ecStoreStart('online');
}

async function ecSsSelectName(name) {
  await ecStoreSelectName('online', name);
}

async function ecSsSelectSlogan(slogan) {
  await ecStoreSelectSlogan('online', slogan);
}

async function ecSsSelectLogo(logoUrl) {
  await ecStoreSelectLogo('online', logoUrl);
}

async function ecOsStart() {
  await ecStoreStart('offline');
}

async function ecOsSelectName(name) {
  await ecStoreSelectName('offline', name);
}

async function ecOsSelectSlogan(slogan) {
  await ecStoreSelectSlogan('offline', slogan);
}

async function ecOsSelectLogo(logoUrl) {
  await ecStoreSelectLogo('offline', logoUrl);
}

async function ecStoreStart(mode) {
  const state = ecStoreState(mode);
  const category = ecStoreEl(mode, 'category')?.value.trim();
  if (!category) return toast(mode === 'offline' ? '매장 업종을 입력하세요' : '카테고리를 입력하세요', 'error');
  state.selection = {};
  state.names = [];
  state.slogans = [];
  state.logos = [];
  state.prefs = {
    brandMode: mode,
    category,
    targetAudience: ecStoreEl(mode, 'target')?.value || '',
    vibe: ecStoreEl(mode, 'vibe')?.value || '',
    extraDetails: ecStoreEl(mode, 'extra')?.value || '',
  };
  ecStoreSetStep(mode, 2);
  ecStoreRenderLoadingChoices(ecStoreCfg(mode).prefix + '-names', 9, false);
  ecStoreSetBusy(mode, true, 'names');
  await ecStoreWaitForPaint();
  try {
    const res = await api('/api/ecommerce/smartstore/names', { method: 'POST', body: state.prefs });
    state.names = res.names || [];
    if (!state.names.length) {
      ecStoreSetStep(mode, 1);
      ecStoreSetBusy(mode, false, 'idle', mode === 'offline' ? '매장명을 생성하지 못했습니다. 입력을 조금 더 구체적으로 적어주세요.' : '스토어명을 생성하지 못했습니다. 카테고리나 분위기를 조금 더 구체적으로 적어주세요.');
      return toast(mode === 'offline' ? '매장명을 생성하지 못했습니다. 다시 시도해주세요.' : '스토어명을 생성하지 못했습니다. 다시 시도해주세요.', 'error');
    }
    ecSsRenderChoiceButtons(ecStoreCfg(mode).prefix + '-names', state.names, (name) => ecStoreSelectName(mode, name));
    ecStoreSetBusy(mode, false, 'idle', mode === 'offline' ? '매장명 후보가 준비됐습니다. 마음에 드는 이름을 눌러 다음 단계로 넘어가세요.' : '스토어명 후보가 준비됐습니다. 마음에 드는 이름을 눌러 다음 단계로 넘어가세요.');
  } catch (e) {
    ecStoreSetStep(mode, 1);
    ecStoreSetBusy(mode, false, 'idle', '생성 중 문제가 생겼습니다. 잠시 뒤 다시 시도해주세요.');
    toast('생성 실패: ' + e.message, 'error');
  }
}

async function ecStoreSelectName(mode, name) {
  const state = ecStoreState(mode);
  state.selection.name = name;
  ecStoreSetStep(mode, 3);
  ecStoreRenderLoadingChoices(ecStoreCfg(mode).prefix + '-slogans', 5, true);
  ecStoreSetBusy(mode, true, 'slogans');
  await ecStoreWaitForPaint();
  try {
    const res = await api('/api/ecommerce/smartstore/slogans', { method: 'POST', body: { name, prefs: state.prefs }});
    state.slogans = res.slogans || [];
    if (!state.slogans.length) {
      ecStoreSetStep(mode, 2);
      ecStoreSetBusy(mode, false, 'idle', '슬로건을 만들지 못했습니다. 다른 이름을 선택하거나 브리프를 더 구체적으로 적어주세요.');
      return toast('슬로건을 생성하지 못했습니다. 다시 시도해주세요.', 'error');
    }
    ecSsRenderChoiceButtons(ecStoreCfg(mode).prefix + '-slogans', state.slogans, (slogan) => ecStoreSelectSlogan(mode, slogan), { multiline: true });
    ecStoreSetBusy(mode, false, 'idle', '슬로건 후보가 준비됐습니다. 브랜드 인상과 가장 잘 맞는 한 줄을 골라주세요.');
  } catch (e) {
    ecStoreSetStep(mode, 2);
    ecStoreSetBusy(mode, false, 'idle', '슬로건 생성 중 문제가 생겼습니다. 잠시 뒤 다시 시도해주세요.');
    toast('슬로건 생성 실패: ' + e.message, 'error');
  }
}

async function ecStoreSelectSlogan(mode, slogan) {
  const state = ecStoreState(mode);
  state.selection.slogan = slogan;
  ecStoreSetStep(mode, 4);
  const logoContainer = ecStoreEl(mode, 'logos');
  if (logoContainer) {
    logoContainer.innerHTML = Array.from({ length: 4 }, () => `
      <div class="ec-result-card" style="padding:0;overflow:hidden;">
        <div style="aspect-ratio:1/1;background:linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0.07), rgba(0,0,0,0.04));background-size:200% 100%;animation:ecSkillProgress 1.6s ease-in-out infinite;"></div>
      </div>
    `).join('');
  }
  ecStoreSetBusy(mode, true, 'logos');
  await ecStoreWaitForPaint();
  try {
    const res = await api('/api/ecommerce/smartstore/logos', { method: 'POST', body: { name: state.selection.name, slogan, prefs: state.prefs }});
    state.logos = res.images || [];
    if (!state.logos.length) {
      ecStoreSetStep(mode, 3);
      ecStoreSetBusy(mode, false, 'idle', '로고 시안을 만들지 못했습니다. 다른 슬로건을 골라 다시 시도해보세요.');
      return toast('로고를 생성하지 못했습니다. 다시 시도해주세요.', 'error');
    }
    ecStoreRenderLogoChoices(mode, state.logos);
    ecStoreSetBusy(mode, false, 'idle', '로고 시안이 준비됐습니다. 가장 먼저 손이 가는 시안을 선택해 다음 단계로 넘어가세요.');
  } catch (e) {
    ecStoreSetStep(mode, 3);
    ecStoreSetBusy(mode, false, 'idle', '로고 생성 중 문제가 생겼습니다. 잠시 뒤 다시 시도해주세요.');
    toast('로고 생성 실패: ' + e.message, 'error');
  }
}

async function ecStoreSelectLogo(mode, logoUrl) {
  const state = ecStoreState(mode);
  state.selection.logoUrl = logoUrl;
  ecStoreSetStep(mode, 5);
  const finalEl = ecStoreEl(mode, 'final');
  if (finalEl) {
    finalEl.innerHTML = `
      <div class="card" style="padding:24px;">
        <div style="font-size:12px;color:rgba(0,0,0,0.38);font-weight:700;margin-bottom:8px;">FINALIZING</div>
        <div style="font-size:18px;font-weight:700;color:#1c1c1e;margin-bottom:8px;">브랜드 브리프와 최종 에셋을 정리하고 있습니다</div>
        <div style="font-size:13px;color:rgba(0,0,0,0.52);line-height:1.7;">선택한 이름과 로고를 바탕으로 요약, 메인 카피, 활용 에셋을 함께 묶고 있습니다.</div>
      </div>
    `;
  }
  ecStoreSetBusy(mode, true, 'finalize');
  await ecStoreWaitForPaint();
  try {
    const res = await api('/api/ecommerce/smartstore/finalize', { method: 'POST', body: { selection: state.selection, prefs: state.prefs }});
    const assets = res.assets || {};
    assets.selectedLogoUrl = assets.selectedLogoUrl || state.selection.logoUrl;
    ecStoreRenderFinal(mode, assets);
    ecSaveHistory(ecStoreCfg(mode).prefix + '-final', [assets.selectedLogoUrl, assets.mainBannerUrl, assets.promoBannerUrl].filter(Boolean), ecStoreCfg(mode).pageId);
    ecRefreshCurrentHistory();
    ecStoreSetBusy(mode, false, 'complete', '최종 브랜딩 결과가 준비됐습니다. 히스토리에서도 다시 볼 수 있습니다.');
    toast('브랜딩 에셋 완성!');
  } catch (e) {
    ecStoreSetStep(mode, 4);
    ecStoreSetBusy(mode, false, 'idle', '최종 에셋을 정리하지 못했습니다. 다른 로고를 선택하거나 다시 시도해주세요.');
    toast('생성 실패: ' + e.message, 'error');
  }
}
