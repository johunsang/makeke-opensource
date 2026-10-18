(function () {
  'use strict';

  const ROOT_ID = 'animation-ad-root';
  const DEFAULT_VIDEO_MODEL = 'kwaivgi/kling-v3.0-pro/image-to-video';
  const DEFAULT_SCENE_COUNT = 8;
  const DEFAULT_DURATION = 30;
  const DEFAULT_PRODUCTION_MODE = 'hybrid';
  const AI_BRIEF_PACK_COUNT = 3;
  const MIN_MICRO_CUTS = 5;
  const DEFAULT_PERSONA_RULES = [
    '모델 기준 이미지는 반드시 한 명의 주인공만, 한 포즈만, 한 프레임 안에 만든다.',
    '캐릭터 시트, 턴어라운드, 여러 포즈, 여러 칸 패널, 비교 박스, 빈 스토리보드 박스, 같은 사람의 중복 버전은 절대 만들지 않는다.',
    '전신 또는 허리 위 단일 인물 초상으로 만들고 얼굴형, 헤어, 의상 톤, 체형/실루엣, 표정 에너지, 손동작 습관을 이후 모든 컷에서 유지한다.',
    '브랜드 컬러나 실제 로고 reference는 배지, 앱 아이콘, 유니폼 패치, 소품처럼 자연스럽게만 들어가며 떠 있는 오버레이나 가짜 로고로 만들지 않는다.',
    '읽을 수 있는 글자, 자막, 가격표, UI 라벨, 워터마크, 두 번째 인물, 랜덤 배경 스톡 사진을 넣지 않는다.',
  ].join('\n');
  const ANIMATION_STYLES = [
    ['world-class-commercial', '월드클래스 광고 필름', '고급 광고 촬영처럼 명확한 피사체, 세련된 조명, 빠른 감정 곡선, 절제된 카메라 움직임'],
    ['premium-product-macro', '프리미엄 제품 매크로', '제품 표면, 질감, 반사광, 손의 터치, 매크로 렌즈 움직임을 강조'],
    ['cinematic-brand-film', '시네마틱 브랜드 필름', '넓은 다이내믹 레인지, 감정적 롱테이크, 우아한 컷 전환'],
    ['social-hook-snap', '숏폼 훅 스냅', '첫 1초에 시선을 끄는 빠른 줌, 스냅 컷, 강한 전후 대비'],
    ['luxury-fashion-editorial', '럭셔리 패션 에디토리얼', '패션 화보식 포즈, 하이 콘트라스트 조명, 우아한 슬로모션'],
    ['beauty-glow-commercial', '뷰티 글로우 광고', '피부광, 액체 하이라이트, 손 제스처, 부드러운 카메라 아크'],
    ['food-sizzle-commercial', '푸드 시즐 광고', '김, 윤기, 소스 흐름, 바삭한 질감, 먹음직스러운 매크로'],
    ['app-service-metaphor', '앱 서비스 은유', '실제 UI 복제 대신 생활 속 문제 해결을 시각 은유로 표현'],
    ['retail-promo-burst', '리테일 프로모션 버스트', '빠른 상품 등장, 혜택 분위기, 에너지 있는 그래픽 오버레이 여백'],
    ['founder-story-film', '창업자 스토리 필름', '사람 중심 다큐 감성, 손과 시선, 작은 행동의 진정성'],
    ['squash-stretch', '스쿼시 앤 스트레치', '무게와 탄성을 느끼게 하는 압축과 늘어남을 과장'],
    ['anticipation', '안티시페이션', '주요 행동 전에 반대 방향 준비 동작을 넣어 기대감을 만든다'],
    ['clear-staging', '클리어 스테이징', '한 컷의 의도를 한눈에 읽게 피사체, 조명, 시선을 정리'],
    ['straight-ahead-energy', '스트레이트 어헤드 에너지', '예측 불가능하고 살아있는 연속 움직임을 강조'],
    ['pose-to-pose-precision', '포즈 투 포즈 정교함', '강한 키포즈와 명확한 중간 동작으로 컷 리듬을 설계'],
    ['follow-through-overlap', '팔로스루 오버랩', '머리카락, 옷, 소품이 본동작 뒤에 늦게 따라오게 만든다'],
    ['slow-in-slow-out', '슬로 인 슬로 아웃', '시작과 끝은 부드럽게, 중간은 빠르게 움직여 물리감을 만든다'],
    ['arc-motion', '아크 모션', '직선보다 호를 그리는 카메라와 피사체 움직임을 사용'],
    ['secondary-action', '세컨더리 액션', '주요 행동을 방해하지 않는 작은 보조 행동으로 풍부하게 만든다'],
    ['timing-spacing-master', '타이밍 스페이싱 마스터', '컷의 속도와 간격을 감정에 맞춰 강하게 설계'],
    ['exaggerated-appeal', '과장된 어필', '핵심 감정과 실루엣을 광고적으로 더 크게 보여준다'],
    ['solid-drawing-volume', '솔리드 드로잉 볼륨', '형태, 무게, 공간감이 무너지지 않는 입체적인 움직임'],
    ['rotoscope-realism', '로토스코프 리얼리즘', '실사 움직임을 추적한 듯 자연스러운 인체와 카메라 동작'],
    ['cel-animation-classic', '클래식 셀 애니메이션', '선명한 라인, 손그림 색면, 전통 2D 애니메이션 질감'],
    ['limited-animation-smart', '리미티드 애니메이션', '정지 프레임, 눈깜박임, 입모양, 카메라 이동으로 효율적 리듬'],
    ['sakuga-impact', '사쿠가 임팩트', '액션 순간에 프레임 밀도와 드로잉 에너지를 폭발시킨다'],
    ['smear-frame-speed', '스미어 프레임 스피드', '빠른 움직임에 늘어난 중간 프레임과 모션 블러 감각을 준다'],
    ['anime-speed-lines', '애니 속도선 액션', '속도선, 임팩트 프레임, 강한 카메라 팬으로 추진력 강조'],
    ['manga-panel-motion', '만화 패널 모션', '패널 분할, 컷인, 말풍선 없는 그래픽 리듬으로 전개'],
    ['ghibli-inspired-warmth', '따뜻한 수채 모험풍', '따뜻한 배경, 손그림 질감, 생활감 있는 작은 움직임'],
    ['noir-anime-commercial', '누아르 애니 광고', '강한 그림자, 네온, 비 오는 거리, 절제된 하드보일드 움직임'],
    ['kawaii-pop-motion', '카와이 팝 모션', '둥근 형태, 빠른 리액션, 통통 튀는 색감'],
    ['chibi-comedy-beat', '치비 코미디 비트', '작고 귀여운 비율, 과장 리액션, 빠른 타이밍'],
    ['mecha-tech-motion', '메카 테크 모션', '기계 부품, 패널 슬라이드, 하드서피스 회전'],
    ['cyberpunk-neon-rain', '사이버펑크 네온 레인', '네온 반사, 비, 글리치 빛, 도시 야간 카메라'],
    ['solarpunk-organic', '솔라펑크 오가닉', '자연광, 식물, 미래적 친환경 소재, 부드러운 상승감'],
    ['retro-futurism', '레트로 퓨처리즘', '빈티지 미래 디자인, 크롬, 아날로그 계기, 따뜻한 필름톤'],
    ['y2k-chrome-motion', 'Y2K 크롬 모션', '메탈릭 크롬, 젤리 버튼 감각, 빠른 반짝임'],
    ['vaporwave-dream', '베이퍼웨이브 드림', '파스텔 네온, 그리드, 느린 부유감, 몽환적 광고톤'],
    ['synthwave-drive', '신스웨이브 드라이브', '80년대 네온 도로, 태양, 고속 카메라 이동'],
    ['pixel-art-motion', '픽셀 아트 모션', '저해상도 픽셀 질감, 단계적 움직임, 게임 같은 임팩트'],
    ['voxel-commercial', '복셀 광고', '작은 큐브 구조와 부드러운 카메라로 귀여운 3D 제품감'],
    ['low-poly-stylized', '로우폴리 스타일', '각진 면, 단순 색면, 명확한 실루엣'],
    ['isometric-explainer', '아이소메트릭 설명', '45도 공간, 작은 캐릭터와 서비스 흐름을 명료하게 표현'],
    ['paper-cutout', '페이퍼 컷아웃', '종이 레이어, 그림자, 손으로 오린 듯한 움직임'],
    ['paper-craft-stopmotion', '페이퍼크래프트 스톱모션', '종이 소품을 한 프레임씩 움직인 듯한 촉감'],
    ['claymation-soft', '클레이메이션 소프트', '점토 질감, 손으로 빚은 형태, 부드러운 변형'],
    ['felt-wool-miniature', '펠트 울 미니어처', '양모와 섬유 질감, 따뜻한 작은 세트'],
    ['miniature-diorama', '미니어처 디오라마', '작은 세트, 얕은 심도, 장난감 같은 현실감'],
    ['toy-photography-motion', '토이 포토그래피 모션', '피규어와 소품을 광고처럼 연출한 미니어처 움직임'],
    ['brick-stop-motion', '브릭 스톱모션', '블록 장난감 같은 조립감과 끊어지는 프레임 리듬'],
    ['silhouette-shadow', '실루엣 그림자극', '검은 실루엣과 빛의 대비로 우아하게 전개'],
    ['shadow-puppet-modern', '모던 그림자 인형극', '레이어 그림자와 종이 인형 같은 관절 움직임'],
    ['ink-wash-motion', '수묵 애니메이션', '먹 번짐, 여백, 붓의 속도감'],
    ['watercolor-bloom', '수채 번짐 모션', '색이 번지고 스며드는 질감으로 감정적인 장면'],
    ['gouache-poster', '과슈 포스터 모션', '불투명한 색면, 포스터 같은 대담한 구도'],
    ['oil-paint-living', '유화 라이브 페인팅', '두꺼운 붓터치와 빛 반사가 움직이는 회화적 스타일'],
    ['charcoal-sketch', '목탄 스케치 모션', '거친 선과 먼지, 손그림 드로잉의 생동감'],
    ['pencil-rough-test', '연필 러프 테스트', '애니메이터 러프처럼 선이 살아있는 동작'],
    ['ligne-claire', '리뉴 클레르', '균일한 선, 깨끗한 색면, 명료한 유럽 만화풍'],
    ['risograph-print', '리소그래프 프린트', '잉크 겹침, 미세한 오프셋, 그래픽 포스터 질감'],
    ['screenprint-bold', '실크스크린 볼드', '단순 색상, 강한 대비, 인쇄 질감'],
    ['collage-magazine', '매거진 콜라주', '사진 조각, 종이 질감, 빠른 컷아웃 전환'],
    ['photo-collage-surreal', '초현실 포토콜라주', '실사 사진과 일러스트 조각을 낯설게 결합'],
    ['mixed-media-ad', '믹스드 미디어 광고', '실사, 2D, 3D, 종이 텍스처를 레이어로 혼합'],
    ['kinetic-typography', '키네틱 타이포그래피', '텍스트는 HyperFrames 레이어에서 리듬감 있게 움직인다'],
    ['broadcast-package', '방송 패키지 모션', '뉴스/예능 오프닝 같은 선명한 그래픽 전환'],
    ['sports-hype-motion', '스포츠 하이프 모션', '강한 줌, 플래시, 스톰프 타이밍, 박력 있는 컷'],
    ['music-video-pop', '팝 뮤직비디오 스타일', '비트 싱크, 빠른 색 변화, 퍼포먼스 중심'],
    ['documentary-animated', '애니 다큐멘터리', '사실적인 컷과 그래픽 설명을 섞어 신뢰감 있게 전개'],
    ['architectural-walkthrough', '건축 워크스루', '공간을 미끄러지듯 이동하는 카메라와 빛의 흐름'],
    ['interior-lifestyle', '인테리어 라이프스타일', '공간 무드, 소품, 사람의 동선을 부드럽게 표현'],
    ['travel-postcard', '여행 엽서 모션', '장소의 상징을 엽서처럼 넘기며 감성적으로 전개'],
    ['nature-macro', '자연 매크로', '물방울, 잎, 바람, 빛의 움직임을 섬세하게 표현'],
    ['liquid-fluid', '리퀴드 플루이드', '액체, 젤, 잉크, 파동이 제품을 감싸는 움직임'],
    ['smoke-ink-reveal', '연기 잉크 리빌', '연기와 잉크가 피사체를 드러내는 전환'],
    ['particle-reveal', '파티클 리빌', '작은 입자가 모여 제품이나 장면을 드러냄'],
    ['glass-refraction', '글래스 리프랙션', '유리 굴절, 투명 소재, 빛 번짐을 광고적으로 사용'],
    ['hologram-ui', '홀로그램 UI', '실제 UI 복제 없이 빛나는 데이터 레이어와 손 제스처로 표현'],
    ['data-visual-motion', '데이터 비주얼 모션', '숫자 대신 그래프적 형태와 흐름으로 성장을 표현'],
    ['map-route-motion', '지도 루트 모션', '경로, 위치, 연결을 그래픽 라인으로 보여준다'],
    ['medical-clean-motion', '메디컬 클린 모션', '깨끗한 흰 공간, 부드러운 라인, 신뢰감 있는 속도'],
    ['finance-premium-motion', '파이낸스 프리미엄 모션', '차분한 데이터 흐름, 금속 질감, 안정적인 카메라'],
    ['education-friendly', '교육 친화 애니', '간단한 캐릭터와 도식으로 이해를 빠르게 만든다'],
    ['kids-playful', '키즈 플레이풀', '밝은 색, 둥근 형태, 짧은 리액션과 반복 리듬'],
    ['character-mascot-ad', '캐릭터 마스코트 광고', '마스코트의 표정, 포즈, 작은 행동으로 브랜드 기억 강화'],
    ['mascot-squash-pop', '마스코트 스쿼시 팝', '마스코트가 통통 튀며 CTA를 향해 시선을 유도'],
    ['emotion-face-closeup', '감정 클로즈업', '눈, 손, 표정의 작은 변화로 공감을 만든다'],
    ['hands-craft-detail', '손작업 디테일', '손이 제품을 열고 만지고 조립하는 촉각적 컷'],
    ['before-after-transform', '비포애프터 변신', '문제 상태에서 해결 상태로 매끄럽게 전환'],
    ['morphing-product', '제품 모핑', '제품 형태나 사용 상황이 유연하게 변하지만 정체성은 유지'],
    ['match-cut-ad', '매치 컷 광고', '비슷한 형태와 동작을 이어 붙여 자연스럽게 장면 전환'],
    ['whip-pan-transition', '휩팬 전환', '빠른 팬과 모션 블러로 컷을 연결'],
    ['push-in-reveal', '푸시인 리빌', '카메라가 천천히 다가가며 핵심 대상을 드러냄'],
    ['pull-back-world', '풀백 월드 리빌', '작은 디테일에서 넓은 세계로 빠져나오며 맥락 공개'],
    ['orbit-camera', '오빗 카메라', '대상 주위를 돌며 입체감과 고급감을 만든다'],
    ['dolly-zoom-drama', '돌리줌 드라마', '배경과 피사체 거리감 변화로 긴장감 연출'],
    ['top-shot-graphic', '탑샷 그래픽', '위에서 내려다보는 정돈된 제품 배열과 손 동선'],
    ['one-take-flow', '원테이크 플로우', '여러 장면이 끊기지 않고 이어지는 듯한 매끄러운 광고'],
    ['rapid-montage', '래피드 몽타주', '짧은 컷을 압축해 정보량과 에너지를 높임'],
    ['slow-motion-hero', '슬로모션 히어로', '결정적 순간을 느리게 보여 고급감과 감정 강조'],
    ['hyperlapse-city', '하이퍼랩스 도시', '도시/공간을 빠르게 이동하며 서비스 스케일 표현'],
    ['time-lapse-growth', '타임랩스 성장', '변화와 성장을 시간 압축으로 보여준다'],
    ['loopable-gif-style', '루프형 GIF 스타일', '짧고 반복 가능한 동작으로 기억성을 높임'],
    ['seamless-loop-ad', '심리스 루프 광고', '처음과 끝이 자연스럽게 이어지는 숏폼 반복 구조'],
    ['split-screen-compare', '스플릿 비교', '좌우/상하 비교 구도를 영상과 오버레이로 명확하게 표현'],
    ['multi-panel-grid', '멀티 패널 그리드', '여러 컷을 격자처럼 동시에 보여 정보 밀도 강화'],
    ['comic-burst-lines', '코믹 버스트 라인', '방사형 선, 임팩트 모양, 과장된 리액션'],
    ['sticker-pop-motion', '스티커 팝 모션', '스티커 같은 그래픽 조각이 튀어나오는 경쾌함'],
    ['emoji-like-reaction', '이모지 리액션풍', '감정 아이콘 같은 과장 표정과 빠른 반응'],
    ['clean-saas-motion', '클린 SaaS 모션', '복잡한 기능을 정돈된 은유와 깔끔한 그래픽으로 전달'],
    ['enterprise-trust', '엔터프라이즈 신뢰감', '느린 카메라, 구조적 그래픽, 안정적인 색과 리듬'],
    ['startup-energy', '스타트업 에너지', '빠른 전환, 밝은 조명, 문제 해결의 추진력'],
    ['creator-economy-pop', '크리에이터 이코노미 팝', '촬영 장비, 소셜 피드 은유, 빠른 콘텐츠 리듬'],
    ['beauty-before-after-soft', '뷰티 비포애프터 소프트', '부드러운 빛과 세밀한 표정 변화로 개선감 표현'],
    ['fitness-impact', '피트니스 임팩트', '근육 움직임, 땀, 타격감 있는 컷 전환'],
    ['wellness-calm', '웰니스 캄', '느린 호흡, 자연광, 편안한 공간 이동'],
    ['hospitality-warm', '호스피탈리티 웜', '매장/호텔/카페의 환대와 따뜻한 손동작'],
    ['real-estate-premium', '부동산 프리미엄', '공간의 깊이, 창밖 빛, 넓은 이동 동선'],
    ['automotive-speed', '오토모티브 스피드', '차체 라인, 반사광, 도로 움직임, 속도감'],
    ['tech-blueprint', '테크 블루프린트', '제품 구조와 내부 원리를 청사진처럼 정교하게 표현'],
    ['exploded-view', '익스플로디드 뷰', '부품이 분해되고 조립되며 기능을 보여준다'],
    ['xray-cutaway', '엑스레이 컷어웨이', '보이지 않는 내부 작동을 투명하게 보여주는 연출'],
    ['material-transformation', '소재 변환', '원재료가 제품으로 변화하는 질감 중심 애니메이션'],
    ['factory-process', '팩토리 프로세스', '제조/준비/검수 과정을 리듬 있게 연결'],
    ['delivery-journey', '배송 여정', '출발, 이동, 도착을 지도와 생활 컷으로 표현'],
    ['community-mosaic', '커뮤니티 모자이크', '여러 사람/상황 조각이 모여 하나의 메시지가 됨'],
    ['testimonial-vignette', '후기 비네트', '고객 순간을 짧은 장면으로 묶어 신뢰를 만든다'],
    ['festival-confetti', '페스티벌 컨페티', '축제 조명, 색종이, 리듬감 있는 카메라'],
    ['holiday-gift-motion', '홀리데이 선물 모션', '포장, 리본, 따뜻한 조명, 선물 개봉감'],
    ['black-friday-kinetic', '블랙프라이데이 키네틱', '텍스트는 오버레이로 강하게, 배경은 빠른 제품 리듬'],
    ['calm-minimal-luxury', '미니멀 럭셔리', '빈 공간, 절제된 움직임, 한 가지 대상에 집중'],
    ['maximal-pop-collage', '맥시멀 팝 콜라주', '많은 색과 조각을 통제된 리듬으로 쌓는다'],
    ['surreal-product-dream', '초현실 제품 드림', '제품이 비현실적 공간에서 감각적으로 떠오름'],
    ['magic-realism', '매직 리얼리즘', '현실 공간에 작은 마법 같은 변화가 자연스럽게 발생'],
    ['cinematic-vfx-reveal', '시네마틱 VFX 리빌', '광원, 파티클, 카메라가 합쳐져 제품을 웅장하게 공개'],
    ['hand-drawn-scribble', '핸드드로운 스크리블', '손으로 그린 선과 화살표 같은 생동감 있는 강조'],
    ['whiteboard-premium', '프리미엄 화이트보드', '단순한 선 드로잉을 고급 광고 톤으로 정리'],
    ['infographic-motion', '인포그래픽 모션', '복잡한 정보를 형태, 흐름, 단계로 쉽게 보여준다'],
    ['editorial-title-sequence', '에디토리얼 타이틀 시퀀스', '잡지 표지와 영화 오프닝 사이의 세련된 구성'],
  ].map(function (item) {
    return { value: item[0], label: item[1], guide: item[2] };
  });
  const VFX_PRESETS = [
    ['cinematic-light-sweep', '시네마틱 빛 스윕', '제품/인물 위를 지나가는 넓은 빛줄기와 렌즈 플레어로 고급 리빌'],
    ['particle-trail', '파티클 트레일', '움직임 뒤로 작은 입자와 잔상이 따라붙어 속도와 에너지를 만든다'],
    ['energy-ring-reveal', '에너지 링 리빌', '대상을 중심으로 원형 에너지 파동이 퍼지며 핵심 장면을 드러낸다'],
    ['glass-shard-transition', '글래스 샤드 전환', '투명한 유리 조각/프리즘 조각이 화면을 쓸며 다음 컷으로 넘어간다'],
    ['hologram-scan', '홀로그램 스캔', '얇은 스캔 라인, 데이터 점, 빛나는 테두리로 미래적 정보감을 준다'],
    ['liquid-chrome-flow', '리퀴드 크롬 플로우', '금속성 액체가 흐르며 제품 윤곽이나 공간을 감싼다'],
    ['smoke-ink-bloom', '연기 잉크 블룸', '연기와 잉크가 부드럽게 번지며 감정적 장면 전환을 만든다'],
    ['neon-glitch-pulse', '네온 글리치 펄스', '짧은 디지털 글리치, RGB 분리, 네온 떨림으로 임팩트를 준다'],
    ['shockwave-impact', '쇼크웨이브 임팩트', '강한 비트에 맞춰 화면이 눌리고 파동이 퍼진다'],
    ['speed-ramp-streak', '스피드 램프 스트릭', '속도선, 모션 블러, 빠른 가속/감속으로 숏폼 에너지를 만든다'],
    ['magic-sparkle', '매직 스파클', '작은 빛 입자와 반짝임으로 변화/혜택/완성 순간을 강조한다'],
    ['cinematic-fog-depth', '시네마틱 포그 깊이감', '전경/후경 안개와 빛 번짐으로 공간 깊이와 영화감을 만든다'],
    ['laser-outline', '레이저 아웃라인', '얇은 빛 선이 피사체 윤곽을 따라가며 제품을 강조한다'],
    ['data-rain', '데이터 레인', '추상 데이터 점과 수직 흐름으로 기술/성과/분석 이미지를 만든다'],
    ['prism-refraction', '프리즘 리프랙션', '무지개 굴절광과 투명 반사로 뷰티/럭셔리 감도를 높인다'],
    ['fire-ember', '파이어 엠버', '작은 불티와 따뜻한 광원으로 열정/속도/이벤트 감각을 만든다'],
    ['ice-crystal', '아이스 크리스탈', '차갑고 선명한 결정 질감과 반짝임으로 신선함을 강조한다'],
    ['electric-arcs', '일렉트릭 아크', '짧은 전기 아크와 빛나는 연결선으로 파워와 연결감을 만든다'],
    ['portal-wipe', '포털 와이프', '공간이 열리는 듯한 원형/타원형 전환으로 세계를 바꾼다'],
    ['lens-flare-hero', '렌즈 플레어 히어로', '히어로 샷에 강한 플레어와 후광을 넣어 광고적 클라이맥스 생성'],
    ['dust-mote-sunbeam', '더스트 모트 선빔', '햇살 속 먼지 입자와 얕은 심도로 따뜻한 현실감을 준다'],
    ['water-ripple', '워터 리플', '물결 왜곡과 반사로 부드러운 변화/정화/뷰티 메시지 표현'],
    ['matrix-grid', '매트릭스 그리드', '3D 그리드와 얇은 선으로 공간/데이터/서비스 구조를 드러낸다'],
    ['chromatic-pop', '크로매틱 팝', '짧은 색수차와 팝 플래시로 컷 전환을 강하게 만든다'],
    ['bokeh-burst', '보케 버스트', '렌즈 보케가 전경에서 터지며 감성적 리듬을 만든다'],
    ['sci-fi-hud', 'SF HUD', '텍스트 없는 HUD 링, 타깃 마커, 얇은 계측선으로 기술 광고감을 준다'],
    ['gold-dust-luxury', '골드 더스트 럭셔리', '금빛 먼지와 하이라이트로 프리미엄/고가 이미지를 만든다'],
    ['paper-confetti', '페이퍼 컨페티', '작은 종이 조각과 축하 파편으로 이벤트/런칭 분위기 강조'],
    ['ink-line-draw', '잉크 라인 드로우', '손그림 선이 대상 주변을 그리며 집중선을 만든다'],
    ['cinema-light-leak', '시네마 라이트 리크', '필름 빛샘과 따뜻한 플래시로 회상/브랜드 필름 분위기'],
    ['micro-spark-impact', '마이크로 스파크 임팩트', '컷마다 작은 스파크와 초단기 광량 변화로 박자를 살린다'],
    ['no-vfx-clean', 'VFX 최소화', '화면을 과하게 꾸미지 않고 영상 API의 자연스러운 움직임과 마지막 브랜드만 유지한다'],
  ].map(function (item) {
    return { value: item[0], label: item[1], guide: item[2] };
  });
  const BRIEF_PACKS = [
    {
      value: 'launch-premium',
      label: '런칭 · 프리미엄 신제품',
      topic: '신제품 런칭 애니메이션 광고',
      objective: '첫 3초 주목, 제품 기억, 클릭 전환',
      tone: '프리미엄하고 선명한 톤',
      cta: '지금 확인하기',
      duration: '30',
      scenes: '8',
      style: 'world-class-commercial',
      vfx: 'cinematic-light-sweep',
      source: '제품의 첫 등장, 핵심 기능, 사용자가 얻게 될 변화, 출시 혜택을 중심으로 구성',
    },
    {
      value: 'sales-direct',
      label: '판매 전환 · 문제 해결',
      topic: '판매 전환 애니메이션 광고',
      objective: '문제 공감, 혜택 납득, 구매 클릭',
      tone: '직설적인 세일즈 톤',
      cta: '혜택 받고 시작하기',
      duration: '30',
      scenes: '6',
      style: 'retail-promo-burst',
      vfx: 'shockwave-impact',
      source: '고객의 불편, 제품 해결 장면, 전후 비교, 후기/증거, 구매 이유를 빠르게 전달',
    },
    {
      value: 'brand-film',
      label: '브랜드 필름 · 감정 기억',
      topic: '브랜드 필름형 애니메이션 광고',
      objective: '브랜드 인지도, 감정 기억, 신뢰 형성',
      tone: '감성적인 브랜드 필름 톤',
      cta: '브랜드 스토리 보기',
      duration: '60',
      scenes: '10',
      style: 'cinematic-brand-film',
      vfx: 'cinematic-fog-depth',
      source: '브랜드 철학, 공간/사람/제품의 감정, 시네마틱 장면 전환, 마지막 브랜드 메시지',
    },
    {
      value: 'app-service',
      label: '앱·서비스 · 기능 이해',
      topic: '앱·서비스 애니메이션 광고',
      objective: '문제 제시, 기능 이해, 가입/문의 전환',
      tone: '밝고 빠른 숏폼 톤',
      cta: '무료로 확인하기',
      duration: '30',
      scenes: '8',
      style: 'app-service-metaphor',
      vfx: 'hologram-scan',
      source: '사용 전 문제, 앱 화면을 직접 그리지 않는 서비스 은유, 해결 과정, 결과, CTA',
    },
    {
      value: 'event-burst',
      label: '이벤트 · 빠른 참여',
      topic: '이벤트·프로모션 애니메이션 광고',
      objective: '긴급성, 혜택 인지, 신청 전환',
      tone: '밝고 빠른 숏폼 톤',
      cta: '이벤트 참여하기',
      duration: '30',
      scenes: '4',
      style: 'festival-confetti',
      vfx: 'paper-confetti',
      source: '행사 분위기, 혜택, 일정 긴급성, 참여 유도. 이미지 안 숫자/가격 텍스트는 만들지 않기',
    },
    {
      value: 'beauty-glow',
      label: '뷰티 · 변화 체감',
      topic: '뷰티 제품 애니메이션 광고',
      objective: '사용 전후 기대감, 피부/질감 개선 인지, 구매 전환',
      tone: '프리미엄하고 선명한 톤',
      cta: '내 피부에 맞게 보기',
      duration: '30',
      scenes: '8',
      style: 'beauty-glow-commercial',
      vfx: 'prism-refraction',
      source: '피부광, 손 제스처, 제품 질감, 사용 직후 변화, 부드러운 빛과 신뢰감을 중심으로 구성',
    },
    {
      value: 'food-sizzle',
      label: '푸드 · 식욕 자극',
      topic: '푸드 시즐 애니메이션 광고',
      objective: '먹고 싶은 감정, 메뉴 기억, 주문 클릭',
      tone: '밝고 빠른 숏폼 톤',
      cta: '지금 주문하기',
      duration: '30',
      scenes: '6',
      style: 'food-sizzle-commercial',
      vfx: 'dust-mote-sunbeam',
      source: '김, 윤기, 소스 흐름, 한입 직전 순간, 주문을 부르는 클로즈업 중심',
    },
    {
      value: 'tech-trust',
      label: '테크 · 신뢰와 혁신',
      topic: '기술 서비스 애니메이션 광고',
      objective: '복잡한 기능을 쉽게 이해시키고 도입 문의 전환',
      tone: '프리미엄하고 선명한 톤',
      cta: '데모 확인하기',
      duration: '60',
      scenes: '10',
      style: 'tech-blueprint',
      vfx: 'sci-fi-hud',
      source: '문제 상황, 기술 원리 은유, 보안/속도/자동화 장점, 도입 후 변화 중심',
    },
    {
      value: 'local-store',
      label: '매장 · 방문 유도',
      topic: '매장 방문 유도 애니메이션 광고',
      objective: '공간 매력, 메뉴/서비스 기억, 예약/방문 전환',
      tone: '감성적인 브랜드 필름 톤',
      cta: '가까운 매장 보기',
      duration: '30',
      scenes: '8',
      style: 'hospitality-warm',
      vfx: 'cinema-light-leak',
      source: '입구, 공간 분위기, 손님 동선, 대표 메뉴/서비스, 방문하고 싶은 따뜻한 장면 중심',
    },
    {
      value: 'luxury-drop',
      label: '럭셔리 · 한정판 공개',
      topic: '한정판 럭셔리 애니메이션 광고',
      objective: '희소성, 고급감, 출시 알림/예약 전환',
      tone: '프리미엄하고 선명한 톤',
      cta: '한정판 보기',
      duration: '30',
      scenes: '8',
      style: 'calm-minimal-luxury',
      vfx: 'gold-dust-luxury',
      source: '검은 배경, 질감 클로즈업, 금빛 하이라이트, 천천히 드러나는 제품 공개 중심',
    },
  ];
  const BRIEF_VERTICALS = [
    { value: 'beauty', label: '뷰티', topic: '뷰티/케어 쇼츠 광고', style: 'beauty-glow-commercial', vfx: 'prism-refraction', product: '피부광, 텍스처, 손 제스처, 사용 직후 변화' },
    { value: 'food', label: '푸드', topic: '푸드/카페 쇼츠 광고', style: 'food-sizzle-commercial', vfx: 'dust-mote-sunbeam', product: '김, 윤기, 소스, 한입 직전, 조리 클로즈업' },
    { value: 'app', label: '앱', topic: '앱/서비스 쇼츠 광고', style: 'app-service-metaphor', vfx: 'hologram-scan', product: '복잡함, 자동 정리, 결과 확인, 빠른 해결' },
    { value: 'store', label: '매장', topic: '오프라인 매장 쇼츠 광고', style: 'hospitality-warm', vfx: 'cinema-light-leak', product: '입구, 공간, 사람 동선, 대표 경험, 방문하고 싶은 분위기' },
    { value: 'fashion', label: '패션', topic: '패션/라이프스타일 쇼츠 광고', style: 'cinematic-brand-film', vfx: 'gold-dust-luxury', product: '착장 전환, 질감, 거울, 스트리트 무드, 룩 완성' },
    { value: 'fitness', label: '피트니스', topic: '운동/헬스 쇼츠 광고', style: 'world-class-commercial', vfx: 'shockwave-impact', product: '몸의 변화, 호흡, 땀, 루틴, 성취감' },
    { value: 'education', label: '교육', topic: '교육/강의 쇼츠 광고', style: 'editorial-explainer', vfx: 'ink-line-draw', product: '막힌 순간, 이해되는 순간, 학습 루틴, 작은 성취' },
    { value: 'clinic', label: '클리닉', topic: '병원/클리닉 쇼츠 광고', style: 'calm-minimal-luxury', vfx: 'cinematic-light-sweep', product: '상담, 안심, 전문성, 깨끗한 공간, 변화 기대' },
    { value: 'pet', label: '펫', topic: '반려동물 쇼츠 광고', style: 'mascot-squash-pop', vfx: 'paper-confetti', product: '귀여운 반응, 보호자 공감, 사용 전후, 놀이 리듬' },
    { value: 'home', label: '홈리빙', topic: '홈/리빙 쇼츠 광고', style: 'calm-minimal-luxury', vfx: 'dust-mote-sunbeam', product: '어질러짐, 정리 쾌감, 빛 좋은 공간, 손의 움직임' },
  ];
  const BRIEF_FORMULAS = [
    { value: 'hook', label: '첫 1초 훅', objective: '첫 1초 정지 화면 주목, 브랜드 기억', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '예상 밖 첫 장면, 사람 리액션, 제품 단서로 스크롤을 멈추게 한다.' },
    { value: 'purple-cow', label: '퍼플카우 차별화', objective: '카테고리에서 튀는 기억, 댓글, 공유', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '카테고리에서 흔한 장면을 뒤집고 한 문장으로 말할 수 있는 이상한 장면을 만든다.' },
    { value: 'story-brain', label: '팩트보다 스토리', objective: '감정 몰입, 끝까지 시청, 브랜드 기억', tone: '감성적인 브랜드 필름 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '스펙과 장점 나열을 버리고 인물의 목표, 방해, 선택, 감정 변화로 기억하게 한다.' },
    { value: 'problem', label: '문제 폭로', objective: '문제 공감, 해결 기대, 문의 전환', tone: '직설적인 세일즈 톤', duration: '30', scenes: '8', cta: '해결 방법 보기', source: '작은 불편을 크게 보여주고 곧바로 해결 전환을 예고한다.' },
    { value: 'transform', label: '전후 변화', objective: '변화 체감, 저장/공유, 제품 기억', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '8', cta: '변화 확인하기', source: '전후 차이를 말보다 화면 쾌감으로 보여준다.' },
    { value: 'comedy', label: '코미디 반전', objective: '웃음, 댓글, 공유, 브랜드 호감', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '상황의 부조리를 웃기게 만들고 제품을 해결 단서로 등장시킨다.' },
    { value: 'film', label: '미니 영화', objective: '감정 몰입, 브랜드 호감, 기억 형성', tone: '감성적인 브랜드 필름 톤', duration: '60', scenes: '10', cta: '브랜드 기억하기', source: '한 사람의 감정 변화와 공간 분위기를 영화처럼 따라간다.' },
    { value: 'proof', label: '증거 다큐', objective: '신뢰 형성, 결과 납득, 전환', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '8', cta: '결과 확인하기', source: '사용 과정, 디테일, 비교, 주변 반응으로 증거를 쌓는다.' },
    { value: 'pov-crisis', label: '1인칭 위기', objective: '즉시 몰입, 문제 체감, 해결 기대', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '시청자가 직접 당하는 듯한 1인칭 시점 위기에서 시작하고 제품이 탈출 단서가 된다.' },
    { value: 'staged-experiment', label: '연출 실험', objective: '호기심, 증거, 댓글 토론', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '8', cta: '결과 확인하기', source: '실제 몰래촬영처럼 속이지 않고 연출된 실험으로 조건, 반응, 결과를 빠르게 보여준다.' },
    { value: 'object-hero', label: '소품 주인공', objective: '기억나는 오브젝트, 브랜드 연상', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '제품이나 상징 소품이 사람처럼 문제를 보고 움직이며 장면을 끌고 간다.' },
    { value: 'comment-bait', label: '댓글 떡밥', objective: '댓글, 저장, 공유', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '정답이 갈리는 상황, 선택지 대립, 마지막 반전으로 댓글을 부르되 거짓 논쟁은 만들지 않는다.' },
    { value: 'rival-duel', label: '선택지 대결', objective: '비교 이해, 선호 형성, 전환', tone: '직설적인 세일즈 톤', duration: '30', scenes: '8', cta: '결과 확인하기', source: '기존 방식과 새로운 방식을 캐릭터처럼 맞붙이고 화면 리듬으로 차이를 납득시킨다.' },
    { value: 'asmr-ritual', label: 'ASMR 의식', objective: '감각 몰입, 반복 시청, 저장', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '소리, 손동작, 질감, 빛, 작은 반복 의식으로 제품을 말 없이 기억하게 한다.' },
    { value: 'mystery-reveal', label: '미스터리 리빌', objective: '끝까지 시청, 반전 기억', tone: '감성적인 브랜드 필름 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '정체를 숨긴 단서들이 쌓이다가 마지막 직전 제품/브랜드 경험으로 의미가 열린다.' },
    { value: 'fail-compilation', label: '실패 모음 반전', objective: '공감 웃음, 문제 인식, 해결 기대', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '고객이 겪는 작은 실패들을 빠르게 쌓고 마지막에 하나의 해결 리듬으로 뒤집는다.' },
    { value: 'taboo-reversal', label: '금기 뒤집기', objective: '도발적 주목, 관점 전환', tone: '직설적인 세일즈 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '업계가 당연하게 말하는 금기를 안전하게 뒤집고 왜 그런지 장면으로 회수한다.' },
    { value: 'micro-quest', label: '작은 퀘스트', objective: '스토리 몰입, 완주 시청', tone: '감성적인 브랜드 필름 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '주인공이 30초 안에 작은 임무를 해결해야 하고 제품은 그 여정의 도구가 된다.' },
    { value: 'creator-confession', label: '크리에이터 고백', objective: '진정성, 공감, 브랜드 호감', tone: '감성적인 브랜드 필름 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '크리에이터가 완벽한 척을 멈추고 실제 불편과 선택 이유를 행동으로 보여준다.' },
    { value: 'rescue-moment', label: '구출 순간', objective: '문제 긴장, 안도, 공유', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '작은 위기에 빠진 상황을 빠르게 만들고 제품/서비스가 마지막 1초 전에 구출한다.' },
    { value: 'time-pressure', label: '시간 압박', objective: '긴장, 빠른 이해, 전환', tone: '직설적인 세일즈 톤', duration: '30', scenes: '6', cta: '해결 방법 보기', source: '카운트다운, 마감, 놓치기 직전의 압박 속에서 제품 가치가 화면으로 증명된다.' },
    { value: 'surreal-metaphor', label: '초현실 은유', objective: '기억나는 비주얼, 공유', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '고객 문제를 거대한 물체, 뒤집힌 공간, 불가능한 물리처럼 초현실 비주얼로 바꾼다.' },
    { value: 'sensory-loop', label: '감각 루프', objective: '반복 시청, 제품 감각 기억', tone: '프리미엄하고 선명한 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '첫 장면과 마지막 장면이 자연스럽게 이어지는 루프 구조로 감각 디테일을 반복 각인한다.' },
    { value: 'myth-bust', label: '오해 깨기', objective: '관점 전환, 신뢰, 저장', tone: '직설적인 세일즈 톤', duration: '30', scenes: '8', cta: '결과 확인하기', source: '고객이 믿는 흔한 오해를 첫 장면에 제시하고 장면 증거로 조용히 깨뜨린다.' },
    { value: 'before-after-judge', label: '전후 심판', objective: '비교 체감, 댓글, 전환', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '8', cta: '변화 확인하기', source: '전과 후를 제3의 시선, 주변 반응, 상징적인 판정 장면으로 재미있게 비교한다.' },
    { value: 'absurd-scale', label: '스케일 과장', objective: '웃음, 놀라움, 공유', tone: '밝고 빠른 숏폼 톤', duration: '30', scenes: '6', cta: '브랜드 기억하기', source: '작은 문제를 말도 안 되게 큰 스케일로 키워서 웃긴 뒤 실제 해결은 작고 명확하게 보여준다.' },
    { value: 'customer-pov', label: '고객 눈높이', objective: '공감, 문제 명확화, 전환', tone: '감성적인 브랜드 필름 톤', duration: '30', scenes: '8', cta: '브랜드 기억하기', source: '브랜드가 말하지 않고 고객의 눈, 손, 표정, 망설임을 따라가며 필요성을 느끼게 한다.' },
    { value: 'behind-scenes', label: '비하인드 장면', objective: '신뢰, 인간미, 브랜드 호감', tone: '감성적인 브랜드 필름 톤', duration: '60', scenes: '10', cta: '브랜드 기억하기', source: '완성품보다 준비 과정, 손의 노력, 실수와 수정, 마지막 완성 순간을 영화처럼 보여준다.' },
  ];
  BRIEF_VERTICALS.forEach(function (vertical) {
    BRIEF_FORMULAS.forEach(function (formula) {
      BRIEF_PACKS.push({
        value: vertical.value + '-' + formula.value,
        label: vertical.label + ' · ' + formula.label,
        topic: vertical.topic,
        objective: formula.objective,
        tone: formula.tone,
        cta: formula.cta,
        duration: formula.duration,
        scenes: formula.scenes,
        style: vertical.style,
        vfx: vertical.vfx,
        source: vertical.product + ' 중심. ' + formula.source,
      });
    });
  });
  const BRIEF_PACK_DETAILS = {
    'launch-premium': {
      target: '새로운 제품/서비스를 처음 접하는 잠재 고객. 아직 필요성은 있지만 브랜드 기억이 약한 상태.',
      hook: '첫 1초에 제품 실루엣과 브랜드 컬러의 빛이 동시에 열리며 “새로운 기준이 등장했다”는 감각을 준다.',
      problem: '기존 선택지는 비슷해 보이고, 사용자는 무엇이 다른지 빠르게 이해하지 못한다.',
      proof: '제품 구조, 핵심 기능, 사용 장면, 결과 변화를 5컷 이상으로 잘게 나누어 차별점을 시각 증거로 보여준다.',
      offer: '출시 혜택, 초기 체험, 데모 확인, 예약 알림 중 하나를 마지막 CTA로 고정한다.',
      scenes: ['티저 실루엣', '제품/서비스 첫 공개', '핵심 기능 1개를 매크로로 증명', '사용 전후 변화', '출시 혜택과 CTA'],
      visual: '프리미엄 조명, 넓은 여백, 제품 매크로, 브랜드 컬러 rim light, 과도한 UI 텍스트 없는 키비주얼.',
      sound: '저역 드론에서 시작해 공개 순간 밝은 히트, 기능 증명 구간은 짧은 클릭/스파크, 마지막은 안정적인 resolve.',
      overlay: 'HyperFrames는 AI가 만든 핵심 표어를 중간 2~4곳에 짧고 강하게 치고, 마지막 컷에서 브랜드 락업만 남긴다. 증거 칩, 설명 자막, CTA 버튼은 쓰지 않는다.',
      avoid: '이미지 안 글자, 가짜 로고, 가격 숫자, 과장된 보장 표현, 모든 컷이 같은 중앙 제품샷으로 반복되는 구성.',
    },
    'sales-direct': {
      target: '문제를 이미 느끼고 있지만 구매 이유와 즉시 행동할 명분이 필요한 고객.',
      hook: '불편한 순간을 한 컷으로 압축하고 곧바로 해결 장면을 예고해 스크롤을 멈추게 한다.',
      problem: '시간 낭비, 선택 피로, 비용 부담, 결과 불확실성처럼 사용자가 매일 겪는 마찰을 구체화한다.',
      proof: '전후 비교, 사용 단계, 후기 느낌의 상황 증거, 혜택 체감 컷을 빠른 리듬으로 연결한다.',
      offer: '무료 진단, 첫 구매 혜택, 상담 예약, 체험 시작처럼 바로 누를 이유가 있는 CTA를 강조한다.',
      scenes: ['문제 한 방', '해결 제품 등장', '전후 비교', '믿을 이유', '혜택/CTA 잠금'],
      visual: '강한 대비, 빠른 줌, split-screen 비교, 제품/서비스가 문제를 정리하는 시각 은유.',
      sound: '초반 짧은 tension tick, 해결 순간 shockwave, 혜택 구간은 상승감 있는 비트, CTA는 명확한 hit.',
      overlay: 'HyperFrames는 핵심 표어와 마지막 브랜드만 보여준다. 혜택/제한 조건/CTA는 영상 속 장면으로 암시하고 긴 텍스트로 쓰지 않는다.',
      avoid: '공포 마케팅, 의료/효능 보장, 허위 후기처럼 보이는 연출, 이미지 픽셀 속 가격표/쿠폰 문구.',
    },
    'brand-film': {
      target: '브랜드를 오래 기억하게 만들고 싶은 신규/기존 고객. 즉시 구매보다 호감과 신뢰가 우선.',
      hook: '사람, 공간, 빛, 물성 중 하나로 브랜드의 감정을 먼저 보여주고 설명은 늦게 등장시킨다.',
      problem: '기능 설명만으로는 브랜드가 기억되지 않고 경쟁사와 감정적으로 구분되지 않는다.',
      proof: '브랜드 철학이 실제 행동, 공간, 제품 디테일, 고객 경험으로 이어지는 장면을 쌓는다.',
      offer: '브랜드 스토리 보기, 상담/방문, 컬렉션 확인처럼 낮은 부담의 다음 행동을 제안한다.',
      scenes: ['감정 오프닝', '브랜드 철학의 물성', '사람/공간의 온도', '경험의 클라이맥스', '조용한 CTA'],
      visual: '시네마틱 자연광, 느린 카메라, shallow depth, 필름 grain 느낌, 지나친 정보 그래픽 없는 여백.',
      sound: '피아노/스트링/앰비언트 계열. 컷 전환은 숨처럼 부드럽고, 마지막은 오래 남는 잔향.',
      overlay: '중간에는 감정 표어만 짧게 남기고, 마지막 컷은 브랜드명만 또렷하게 남긴다. 설명 문장과 CTA 없이 빛, 여백, 잔향으로 기억을 만든다.',
      avoid: '세일즈 문구 과다, 할인 강조, 지나친 파티클, 모든 장면을 제품 클로즈업으로만 구성.',
    },
    'app-service': {
      target: '앱/서비스가 편해 보이면 가입하거나 문의할 의향이 있지만 복잡한 설명을 싫어하는 사용자.',
      hook: '실제 UI 글자를 만들지 않고 생활 속 문제와 추상 인터페이스가 맞물리는 장면으로 기능을 직관화한다.',
      problem: '업무/예약/정리/분석 같은 반복 작업이 흩어져 있고 사용자는 어디서 시작할지 모른다.',
      proof: '문제 입력, 자동 정리, 선택지 추천, 결과 확인, CTA까지 흐름을 실제 사용 여정처럼 보여준다.',
      offer: '무료 확인, 데모, 가입 시작, 상담 요청처럼 낮은 마찰의 CTA를 사용한다.',
      scenes: ['복잡함의 시각화', '서비스 은유 등장', '자동 정리 흐름', '결과가 보이는 순간', '가입/문의 CTA'],
      visual: '텍스트 없는 와이어프레임, 빈 패널, 홀로그램 라인, 손 제스처, 서비스 흐름을 상징하는 그래픽.',
      sound: '가벼운 디지털 클릭, 스캔 사운드, 정리 순간 맑은 상승음. BGM은 빠르지만 차분해야 한다.',
      overlay: '기능명과 단계 chip은 쓰지 않는다. 핵심 표어와 마지막 브랜드명만 보여주고, 기능 이해는 화면 사건으로 해결한다.',
      avoid: '가짜 앱 화면의 한글/영문 텍스트, 실제 존재하지 않는 대시보드 로고, 복잡한 표/차트 픽셀 생성.',
    },
    'event-burst': {
      target: '짧은 기간 혜택을 보고 바로 참여할 수 있는 기존/잠재 고객.',
      hook: '첫 프레임부터 축제감과 혜택 분위기를 보여주되 숫자/가격은 이미지가 아니라 오버레이로 처리한다.',
      problem: '이벤트가 많아 보이지만 무엇을 지금 해야 하는지 즉시 읽히지 않는다.',
      proof: '참여 장면, 혜택을 받는 순간, 즐거운 반응, 마감 리듬을 빠른 컷으로 보여준다.',
      offer: '참여하기, 쿠폰 받기, 예약하기처럼 즉시 행동형 CTA를 사용한다.',
      scenes: ['이벤트 오픈', '혜택 분위기', '참여 방법 은유', '마감 임박 리듬', 'CTA 폭발'],
      visual: '컨페티, 밝은 조명, 빠른 카메라, 브랜드 컬러 배너 느낌. 단, 배너 안 텍스트는 금지.',
      sound: '밝은 팝 비트, 컨페티 burst, CTA 순간 짧고 강한 hit.',
      overlay: '기간/혜택/CTA 텍스트는 쓰지 않는다. 중간 핵심 표어와 마지막 브랜드만 남기고 이벤트감은 영상 API의 색, 리듬, SFX로 만든다.',
      avoid: '이미지 안 숫자, 날짜, 가격, 할인율, 쿠폰 코드. 지나치게 어지러운 배경.',
    },
    'beauty-glow': {
      target: '피부/제품 질감과 사용감을 보고 구매를 판단하는 뷰티 관심 고객.',
      hook: '피부광, 액체 질감, 제품 표면 반사광을 매크로로 보여주며 즉각적인 감각을 만든다.',
      problem: '효과를 말로만 설명하면 믿기 어렵고, 제품 질감/사용감이 보이지 않으면 구매 전환이 약하다.',
      proof: '제형, 손 제스처, 흡수/발림, 빛 변화, 사용 후 분위기를 부드럽게 증명한다.',
      offer: '내 피부에 맞게 보기, 루틴 확인, 제품 자세히 보기처럼 개인화 느낌의 CTA를 사용한다.',
      scenes: ['텍스처 매크로', '손 제스처', '피부/표면 glow', '루틴 완성', '개인화 CTA'],
      visual: '부드러운 하이라이트, 프리즘 굴절, 깨끗한 배경, 피부 과장 보정 금지, 제품 물성 중심.',
      sound: '부드러운 shimmer, 유리/액체 작은 소리, 안정적인 고급 BGM.',
      overlay: '효능 문구와 CTA를 쓰지 않는다. 중간 핵심 표어는 감각만 남기고 마지막 컷에서 브랜드만 부드러운 glow와 함께 남긴다.',
      avoid: '의학적 효과 보장, 극단적 before/after, 피부 결점 과장, 이미지 안 제품명 텍스트 생성.',
    },
    'food-sizzle': {
      target: '짧은 영상에서 맛과 식감을 보고 주문을 결정하는 고객.',
      hook: '김, 윤기, 소스 흐름, 한입 직전의 순간을 첫 1초 안에 배치한다.',
      problem: '메뉴 설명만으로는 식욕이 생기지 않고, 음식의 온도/식감이 전달되지 않는다.',
      proof: '재료, 조리 소리, 소스/치즈/육즙, 플레이팅, 먹기 직전 컷으로 맛의 증거를 만든다.',
      offer: '지금 주문하기, 메뉴 보기, 가까운 매장 보기처럼 바로 행동 가능한 CTA.',
      scenes: ['뜨거운 오프닝', '재료 디테일', '조리 클라이맥스', '한입 직전', '주문 CTA'],
      visual: '극단적 매크로, 따뜻한 빛, steam, gloss, 손/도구 디테일. 메뉴판 텍스트는 이미지에 넣지 않는다.',
      sound: 'sizzle, crunch, pour, pop 같은 SFX를 BGM 리듬과 맞춘다.',
      overlay: '맛 표현, 가격, 메뉴명, CTA 텍스트를 쓰지 않는다. 중간 핵심 표어와 마지막 브랜드만 식욕이 남는 리듬으로 고정한다.',
      avoid: '과도한 연기, 비위생적 손 연출, 읽히는 메뉴판/가격표, 실제보다 과장된 크기 표현.',
    },
    'tech-trust': {
      target: '복잡한 기술/전문 서비스를 이해하고 신뢰 근거를 확인해야 도입하는 B2B/B2C 고객.',
      hook: '복잡한 문제를 한 번에 정리하는 홀로그램/블루프린트 리빌로 전문성을 먼저 보여준다.',
      problem: '기술이 어렵게 느껴져 도입 가치가 즉시 이해되지 않고, 신뢰 근거 없이는 문의로 이어지지 않는다.',
      proof: '문제 구조, 작동 원리, 데이터 흐름, 보안/정확도/속도, 도입 후 변화 순서로 증명한다.',
      offer: '데모 확인, 상담 예약, 진단 받기처럼 실제 전환 가능성이 높은 CTA.',
      scenes: ['문제 구조 스캔', '기술 원리 분해', '데이터/프로세스 정렬', '신뢰 증거', '데모 CTA'],
      visual: '텍스트 없는 HUD, 와이어프레임, 블루프린트, 투명 레이어, 실제 사람보다 추상 기술 오브젝트 중심.',
      sound: '정교한 scan, data click, low pulse, 마지막은 안정적인 corporate resolve.',
      overlay: '전문 용어와 증거 chip을 쓰지 않는다. 핵심 표어와 마지막 브랜드만 선명하게 남기고 신뢰는 장면 증거로 만든다.',
      avoid: '가짜 숫자 대시보드, 읽히는 표/차트, 보안/성과 과장, 모델이 만든 랜덤 UI 텍스트.',
    },
    'local-store': {
      target: '근처 매장/공간/서비스를 실제로 방문하거나 예약할 수 있는 지역 고객.',
      hook: '입구, 손님 동선, 따뜻한 조명, 대표 메뉴/서비스가 한 컷에 보이며 방문 욕구를 만든다.',
      problem: '사진 한 장만으로는 공간 분위기와 서비스 경험이 충분히 전달되지 않는다.',
      proof: '입구, 내부 동선, 손 디테일, 대표 상품/서비스, 고객이 머무는 순간을 순서대로 보여준다.',
      offer: '가까운 매장 보기, 예약하기, 방문 혜택 확인 같은 지역 행동 CTA.',
      scenes: ['입구 초대', '공간 무드', '대표 경험', '머무는 순간', '방문 CTA'],
      visual: '따뜻한 자연광, 손님 없는 정돈된 공간 또는 자연스러운 생활 컷, 과도한 인파 연출 금지.',
      sound: '문 열림, 잔잔한 공간 ambience, 따뜻한 악기, CTA에서 부드러운 bell.',
      overlay: '위치/예약/영업 정보 텍스트는 쓰지 않는다. 중간 핵심 표어와 마지막 브랜드만 보여주고 방문 욕구는 공간 장면으로 만든다.',
      avoid: '간판의 가짜 글자, 복잡한 지도 텍스트, 실제와 다른 매장명, 과도한 사람 군중.',
    },
    'luxury-drop': {
      target: '한정판, 고가 제품, 프리미엄 서비스를 희소성과 감성으로 판단하는 고객.',
      hook: '어두운 배경에서 소재 표면과 실루엣만 천천히 드러내 희소성과 긴장감을 만든다.',
      problem: '프리미엄은 설명이 많을수록 힘이 떨어지고, 물성/희소성/완성도가 먼저 보여야 한다.',
      proof: '소재 매크로, 장인정신 디테일, 패키징, 제품 공개, 예약 CTA를 절제된 호흡으로 보여준다.',
      offer: '한정판 보기, 예약 알림 받기, 컬렉션 확인처럼 고급스럽고 낮은 압박의 CTA.',
      scenes: ['실루엣 암전', '소재 매크로', '제작 디테일', '제품 리빌', '예약 CTA'],
      visual: '검은 배경, 금빛 먼지, 낮은 카메라, 느린 pull-back, 여백 많은 lockup.',
      sound: '낮은 sub, 금속성 shimmer, 느린 심장박동 같은 pulse, 마지막 긴 잔향.',
      overlay: '제품명/CTA 문구 없이 AI 핵심 표어와 마지막 브랜드만 절제해 남긴다. 고급감은 타이포보다 질감과 여백으로 만든다.',
      avoid: '과한 할인 표현, 이미지 속 가격/한정 수량 숫자, 번쩍이는 저가 이벤트 톤.',
    },
  };

  const state = {
    busy: '',
    logs: [],
    modelSettings: {
      loading: true,
      text_provider: '',
      text_model: '',
      image_provider: '',
      image_model: '',
    },
    form: {
      'aad-topic': '신제품 런칭 애니메이션 광고',
      'aad-brief-pack': 'launch-premium',
      'aad-objective': '첫 3초 주목, 제품 기억, 클릭 전환',
      'aad-tone': '프리미엄하고 선명한 톤',
      'aad-cta': '지금 확인하기',
      'aad-aspect': '9:16',
      'aad-duration': '30',
      'aad-scene-count': String(DEFAULT_SCENE_COUNT),
      'aad-voice': 'gemini-Kore',
      'aad-music-direction': '',
      'aad-narration-text': '',
      'aad-final-brand-name': '',
      'aad-plan-engine': 'gemini',
      'aad-image-engine': 'gemini',
      'aad-storyboard-model': '',
      'aad-image-model': '',
      'aad-video-model': DEFAULT_VIDEO_MODEL,
      'aad-production-mode': DEFAULT_PRODUCTION_MODE,
      'aad-story-arc': 'native-shorts-story',
      'aad-attention-hook': 'cinematic-tension',
      'aad-semantic-structure': 'auto-semantic-graph',
      'aad-exception-rule': 'ai-auto',
      'aad-creativity-rule': 'ai-creative-auto',
      'aad-platform-playbook': 'native-hook-shorts',
      'aad-hook-recipe': 'first-frame-shock',
      'aad-persona-type': 'brand-creator',
      'aad-persona-description': '',
      'aad-persona-rules': DEFAULT_PERSONA_RULES,
      'aad-persona-age': 'ai-auto',
      'aad-persona-gender': 'ai-auto',
      'aad-persona-hair': '',
      'aad-persona-outfit': '',
      'aad-persona-expression': 'confident-bright',
      'aad-persona-framing': 'waist-up',
      'aad-persona-brand-detail': '',
      'aad-persona-model-id': '',
      'aad-user-intent': '',
      'aad-animation-style': 'world-class-commercial',
      'aad-vfx-preset': 'cinematic-light-sweep',
      'aad-use-profile': 'yes',
      'aad-use-profile-logo': 'yes',
      'aad-source': '',
      'aad-benchmark-url': '',
      'aad-benchmark-notes': '',
      'aad-success-case-title': '',
      'aad-success-case-url': '',
      'aad-success-case-notes': '',
      'aad-success-case-raw': '',
      'aad-reference-images': '',
      'aad-product-images': '',
      'aad-brand-images': '',
      'aad-persona-images': '',
    },
    scenes: [],
    images: {},
    videos: {},
    generating: {
      images: {},
      videos: {},
      actions: {},
      storyboard: false,
    },
    narration: null,
    bgm: null,
    finalJob: null,
    finalUrl: '',
    quality: null,
    storyboardMeta: {
      creative_field: null,
      selection_strategy: '',
      selection_criteria: [],
      creative_audit: [],
      diversity_axes: [],
      required_roles: [],
      field_questions: [],
      field_constraints: [],
    },
    storyboardIndex: null,
    activeStep: 1,
    stepMoving: 0,
    briefSubStep: 1,
    currentHistoryId: 0,
    initPending: false,
    aiBriefPacks: {
      items: [],
      loading: false,
      error: '',
      generatedAt: '',
    },
    history: {
      items: [],
      loading: false,
      saving: false,
      openingId: 0,
    },
    semantics: {
      items: [],
      loading: false,
    },
    successCases: {
      items: [],
      loading: false,
      saving: false,
      error: '',
    },
    benchmarkLibrary: {
      items: [],
      loading: false,
      error: '',
      open: false,
      filter: 'all',
      analyzingURL: '',
    },
    creativeReports: {
      items: [],
      loading: false,
      error: '',
      applied: '',
    },
    personaLibrary: {
      items: [],
      loading: false,
      saving: false,
      editingId: 0,
      previewId: 0,
      editDraft: {},
    },
    personaModelModalOpen: false,
    logVisibleCount: 3,
  };
  let historySaveTimer = null;
  let historyCheckpointQueue = Promise.resolve();
  let suppressNextFormSync = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function compactText(value, maxLength) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const limit = Number(maxLength || 160);
    return text.length > limit ? text.slice(0, Math.max(0, limit - 1)) + '...' : text;
  }

  function compactPromptText(value, maxLength) {
    const text = String(value || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const limit = Number(maxLength || 1200);
    if (!text || text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 34)).trim() + '\n...[요청 안정화를 위해 일부 축약]';
  }

  function compactHistorySceneText(key, value) {
    if (typeof value !== 'string') return value;
    const promptFields = new Set(['image_prompt', 'video_prompt']);
    const longFields = new Set(['body', 'action', 'field_coupling_reason', 'shot_diversity_reason', 'retention_goal']);
    if (promptFields.has(key)) return compactPromptText(value, 2400);
    if (longFields.has(key)) return compactPromptText(value, 700);
    return compactPromptText(value, 360);
  }

  function compactHistorySceneNode(node) {
    if (!node || typeof node !== 'object') return node;
    const out = Object.assign({}, node);
    Object.keys(out).forEach(function (key) {
      if (key === 'micro_cuts' && Array.isArray(out[key])) {
        out[key] = out[key].map(compactHistorySceneNode);
      } else {
        out[key] = compactHistorySceneText(key, out[key]);
      }
    });
    return out;
  }

  function compactPayloadValue(value, maxString, depth) {
    const limit = Number(maxString || 900);
    const remain = Number(depth == null ? 3 : depth);
    if (value == null) return value;
    if (typeof value === 'string') return compactPromptText(value, limit);
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.slice(0, 12).map(function (item) { return compactPayloadValue(item, limit, remain - 1); });
    }
    if (remain <= 0) return '[축약]';
    return Object.keys(value).slice(0, 40).reduce(function (acc, key) {
      acc[key] = compactPayloadValue(value[key], limit, remain - 1);
      return acc;
    }, {});
  }

  function requestTimeoutMessage(url, ms) {
    if (/generate-scenario-plan/.test(String(url || ''))) {
      return '콘티 초안 생성 시간이 ' + Math.round(ms / 1000) + '초를 넘었습니다. 입력/참고자료를 줄이거나 글쓰기 모델을 빠른 모델로 바꿔 다시 시도해주세요.';
    }
    return '요청 시간이 ' + Math.round(ms / 1000) + '초를 넘었습니다. 잠시 후 다시 시도해주세요.';
  }

  function apiRequestJSON(url, options) {
    const init = Object.assign({ method: 'GET' }, options || {});
    const timeoutMs = Number(init.timeoutMs || 0);
    let timeoutId = null;
    if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
      init.signal = init.signal || controller.signal;
      delete init.timeoutMs;
    }
    if (init.body && typeof init.body !== 'string') {
      init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers || {});
      init.body = JSON.stringify(init.body);
    }
    return fetch(url, init).then(async function (res) {
      const raw = await res.text().catch(function () { return ''; });
      let data = {};
      if (raw && raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch (err) {
          data = { error: '서버 응답을 JSON으로 읽지 못했습니다.', detail: compactPromptText(raw, 300) };
        }
      }
      if (!res.ok || data.ok === false) {
        const err = new Error(data.detail || data.error || ('HTTP ' + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }).catch(function (err) {
      if (err && err.name === 'AbortError' && timeoutMs > 0) {
        throw new Error(requestTimeoutMessage(url, timeoutMs));
      }
      throw err;
    }).finally(function () {
      if (timeoutId) clearTimeout(timeoutId);
    });
  }

  function apiJSON(url, body) {
    return apiRequestJSON(url, { method: 'POST', body: body || {} });
  }

  function apiJSONTimed(url, body, timeoutMs) {
    return apiRequestJSON(url, { method: 'POST', body: body || {}, timeoutMs: timeoutMs });
  }

  function root() {
    return document.getElementById(ROOT_ID);
  }

  function field(id, fallback) {
    const el = document.getElementById(id);
    const value = el ? String(el.value || '').trim() : '';
    const picked = value || state.form[id] || fallback || '';
    return id === 'aad-video-model' ? normalizeVideoModel(picked) : picked;
  }

  function numericField(id, fallback) {
    const value = Number(field(id, ''));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function optionTags(items, current) {
    return items.map(function (item) {
      const selected = String(item.value) === String(current) ? ' selected' : '';
      return '<option value="' + esc(item.value) + '"' + selected + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function currentAnimationStyle() {
    const value = field('aad-animation-style', 'world-class-commercial');
    return ANIMATION_STYLES.find(function (style) { return style.value === value; }) || ANIMATION_STYLES[0];
  }

  function currentVFXPreset() {
    const value = field('aad-vfx-preset', 'cinematic-light-sweep');
    return VFX_PRESETS.find(function (preset) { return preset.value === value; }) || VFX_PRESETS[0];
  }

  function vfxPresetByValue(value) {
    return VFX_PRESETS.find(function (preset) { return preset.value === value; }) || currentVFXPreset();
  }

  function cutVFXPreset(cut) {
    return vfxPresetByValue(cut?.vfx_preset || field('aad-vfx-preset', 'cinematic-light-sweep'));
  }

  function productionModeOptions() {
    return [
      { value: 'animation', label: '애니메이션 광고', icon: 'ANI', short: '그림/캐릭터/스타일화', guide: '스타일화된 그림체, 과장된 움직임, 캐릭터/제품 모션을 중심으로 만듭니다.' },
      { value: 'live-action', label: '실사 광고', icon: 'LIVE', short: '촬영감/인물/제품 현실감', guide: '실제 촬영처럼 인물, 제품, 공간, 렌즈, 조명, 피부/재질, 카메라 움직임을 자연스럽게 만듭니다.' },
      { value: 'hybrid', label: '실사+애니 하이브리드', icon: 'MIX', short: '실사 위 VFX/그래픽 에너지', guide: '실사 같은 제품/인물 위에 애니메이션적 VFX와 그래픽 에너지를 섞습니다.' },
    ];
  }

  function currentProductionMode() {
    const value = field('aad-production-mode', DEFAULT_PRODUCTION_MODE);
    return productionModeOptions().find(function (item) { return item.value === value; }) || productionModeOptions().find(function (item) { return item.value === DEFAULT_PRODUCTION_MODE; }) || productionModeOptions()[0];
  }

  function productionModeGuide() {
    const mode = currentProductionMode();
    return mode.label + ': ' + mode.guide;
  }

  function renderProductionModePicker() {
    const current = currentProductionMode().value;
    return `
      <div class="aad-mode-picker wide">
        <input type="hidden" id="aad-production-mode" value="${esc(current)}">
        <div class="aad-mode-title">
          <b>애니메이션 / 실사 구분</b>
          <span id="aad-production-mode-guide">${esc(productionModeGuide())}</span>
        </div>
        <div class="aad-mode-options">
          ${productionModeOptions().map(function (item) {
            const active = item.value === current ? ' active' : '';
            return '<button type="button" class="aad-mode-card' + active + '" aria-pressed="' + (item.value === current ? 'true' : 'false') + '" onclick="aadSetProductionMode(&quot;' + esc(item.value) + '&quot;)"><strong>' + esc(item.icon) + '</strong><b>' + esc(item.label) + '</b><span>' + esc(item.short) + '</span><em>' + esc(item.guide) + '</em></button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function setProductionMode(value) {
    if (!productionModeOptions().some(function (item) { return item.value === value; })) return;
    setInput('aad-production-mode', value);
    invalidateQuality();
    refreshStyleGuide();
    render();
  }

  function storyboardModelOptions() {
    const configured = String((state.modelSettings && state.modelSettings.text_model) || '').trim();
    const provider = String((state.modelSettings && state.modelSettings.text_provider) || '').trim();
    const options = [];
    if (configured) {
      options.push({ value: configured, label: '현재 설정 글쓰기 모델 · ' + (provider ? provider + ' · ' : '') + configured });
    }
    return uniqueByValue(options.concat([
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · 콘티 품질형' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · 빠른 콘티' },
      { value: 'codex-cli', label: 'Codex CLI · 로컬 콘티' },
    ]));
  }

  function imageModelOptions() {
    const configured = String((state.modelSettings && state.modelSettings.image_model) || '').trim();
    const provider = String((state.modelSettings && state.modelSettings.image_provider) || '').trim();
    const options = [];
    if (configured) {
      options.push({ value: configured, label: '현재 설정 그림 모델 · ' + (provider ? provider + ' · ' : '') + configured });
    }
    return uniqueByValue(options.concat([
      { value: 'openai/gpt-image-2-developer/text-to-image', label: 'Atlas GPT Image 2 · 고품질' },
      { value: 'qwen/qwen-image-2-pro/text-to-image', label: 'Atlas Qwen Image 2 Pro' },
      { value: 'codex-cli', label: 'Codex CLI · 직접 이미지 생성' },
    ]));
  }

  function uniqueByValue(items) {
    const seen = {};
    return items.filter(function (item) {
      const value = String(item && item.value || '').trim();
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function normalizeVideoModel(value) {
    const model = String(value || '').trim();
    const lower = model.toLowerCase();
    if (!model) return DEFAULT_VIDEO_MODEL;
    if (lower.includes('seedance-2.0') || lower.includes('dreamina-seedance')) return DEFAULT_VIDEO_MODEL;
    return model;
  }

  function currentVideoModel() {
    const normalized = normalizeVideoModel(state.form['aad-video-model'] || DEFAULT_VIDEO_MODEL);
    state.form['aad-video-model'] = normalized;
    const el = document.getElementById('aad-video-model');
    if (el && el.value !== normalized) el.value = normalized;
    return normalized;
  }

  function videoModelOptions() {
    return [
      { value: DEFAULT_VIDEO_MODEL, label: 'Atlas Cloud · Kling 3 Pro 최신 기본' },
      { value: 'kwaivgi/kling-v3.0-std/image-to-video', label: 'Atlas Cloud · Kling 3 Std 안정형' },
      { value: 'kwaivgi/kling-video-o3-pro/image-to-video', label: 'Atlas Cloud · Kling O3 Pro 고급 모션' },
      { value: 'kwaivgi/kling-video-o3-std/image-to-video', label: 'Atlas Cloud · Kling O3 Std 균형 모션' },
      { value: 'atlascloud/wan-2.2-turbo-spicy/image-to-video', label: 'Atlas Cloud · Wan 2.2 Turbo Spicy 인물 안전' },
      { value: 'alibaba/wan-2.7/image-to-video', label: 'Atlas Cloud · Wan 2.7 최신 실사' },
      { value: 'alibaba/wan-2.6/image-to-video', label: 'Atlas Cloud · Wan 2.6 균형형' },
      { value: 'alibaba/wan-2.6/image-to-video-flash', label: 'Atlas Cloud · Wan 2.6 Flash 빠른 실험' },
      { value: 'alibaba/wan-2.5/image-to-video', label: 'Atlas Cloud · Wan 2.5 제품/실사' },
      { value: 'alibaba/wan-2.5/image-to-video-fast', label: 'Atlas Cloud · Wan 2.5 Fast 빠른 제품컷' },
      { value: 'google/veo3.1/image-to-video', label: 'Atlas Cloud · Veo 3.1 고품질 영화감' },
      { value: 'google/veo3.1-fast/image-to-video', label: 'Atlas Cloud · Veo 3.1 Fast 빠른 영화감' },
      { value: 'google/veo3.1-lite/image-to-video', label: 'Atlas Cloud · Veo 3.1 Lite 가벼운 영화감' },
      { value: 'vidu/q3-pro/image-to-video', label: 'Atlas Cloud · Vidu Q3 Pro 광고 모션' },
      { value: 'vidu/q3-turbo/image-to-video', label: 'Atlas Cloud · Vidu Q3 Turbo 빠른 광고 모션' },
    ];
  }

  function storyArcOptions() {
    return [
      {
        value: 'native-shorts-story',
        label: '광고 아닌 척 쇼츠형',
        guide: '제품 소개가 아니라 실제 숏폼 사건처럼 시작하고, 실수·반응·변화·브랜드 기억 순서로 1분 이하를 끌고 갑니다.',
      },
      {
        value: 'cinematic-trailer',
        label: '영화 예고편형',
        guide: '한 사람의 문제, 긴장 고조, 제품/서비스 리빌, 증거, CTA를 예고편처럼 압축합니다.',
      },
      {
        value: 'human-mini-drama',
        label: '인물 미니드라마',
        guide: '주인공의 하루와 감정 변화를 따라가며 제품은 해결의 순간에만 등장합니다.',
      },
      {
        value: 'problem-thriller',
        label: '문제 스릴러',
        guide: '불편함을 위기처럼 키우고, 해결 장면을 반전처럼 보여줍니다.',
      },
      {
        value: 'sensory-product-film',
        label: '감각 제품 필름',
        guide: '소리, 질감, 손동작, 빛, 매크로 디테일로 제품을 말 없이 기억하게 합니다.',
      },
      {
        value: 'social-proof-docu',
        label: '증거 다큐형',
        guide: '상황 증거, 전후 맥락, 사용 장면, 결과의 이유를 다큐 광고처럼 보여줍니다.',
      },
    ];
  }

  function currentStoryArc() {
    const value = field('aad-story-arc', 'native-shorts-story');
    return storyArcOptions().find(function (item) { return item.value === value; }) || storyArcOptions()[0];
  }

  function attentionHookOptions() {
    return [
      {
        value: 'cinematic-tension',
        label: '영화적 긴장',
        guide: '위험 신호, 침묵, 빠른 전환, 리빌을 써서 예고편처럼 계속 보게 만듭니다.',
      },
      {
        value: 'comedy-twist',
        label: '코미디 반전',
        guide: '예상과 다른 상황, 표정 리액션, 타이밍 개그, 마지막 반전으로 기억에 남게 만듭니다.',
      },
      {
        value: 'purple-cow',
        label: '퍼플카우 훅',
        guide: '흔한 광고 장면을 버리고 한 문장으로 설명되는 이상한 장면, 반전 행동, 낯선 맥락으로 공유할 이유를 만듭니다.',
      },
      {
        value: 'story-brain',
        label: '팩트보다 스토리 훅',
        guide: '스펙과 장점 나열 대신 인물의 목표, 방해물, 감정 변화, 선택 순간으로 뇌가 따라가게 만듭니다.',
      },
      {
        value: 'meme-chaos',
        label: '밈/과장 리액션',
        guide: 'SNS에서 멈춰 볼 만큼 과장된 상황, 빠른 리액션, 시각적 농담을 광고 맥락 안에서 씁니다.',
      },
      {
        value: 'sensual-premium',
        label: '섹시한 프리미엄 무드',
        guide: '노골적인 성적 표현 없이 조명, 질감, 향, 손동작, 시선, 로맨틱 긴장으로 관능적인 분위기를 만듭니다.',
      },
      {
        value: 'provocative-challenge',
        label: '도발적 질문',
        guide: '고객이 찔리는 질문, 반대 관점, 강한 첫 문장으로 호기심을 만들되 혐오/비하 없이 처리합니다.',
      },
      {
        value: 'rage-bait-safe',
        label: '어그로 훅',
        guide: '멈칫하게 만드는 도발, 금기처럼 보이는 질문, 반대 의견을 쓰되 거짓 낚시나 혐오 없이 바로 근거로 회수합니다.',
      },
      {
        value: 'emotional-drama',
        label: '감정 드라마',
        guide: '인물의 좌절, 발견, 안도, 작은 승리를 따라가며 제품 설명보다 감정 변화를 앞세웁니다.',
      },
    ];
  }

  function currentAttentionHook() {
    const value = field('aad-attention-hook', 'cinematic-tension');
    return attentionHookOptions().find(function (item) { return item.value === value; }) || attentionHookOptions()[0];
  }

  function semanticItemsByKind(kind) {
    return state.semantics.items.filter(function (item) { return item.kind === kind; });
  }

  function semanticItemBySlug(slug) {
    return state.semantics.items.find(function (item) { return item.slug === slug; }) || null;
  }

  function semanticStructureOptions() {
    const structures = semanticItemsByKind('structure');
    if (!structures.length) {
      return [
        {
          value: 'auto-semantic-graph',
          label: 'AI가 시맨틱 구조 자동 선택',
          guide: 'DB 시맨틱 구조를 불러오는 중입니다. 로딩 전에는 AI가 이름, 주인공, 주제, 예외성, 장면 연결을 자동으로 구성합니다.',
        },
      ];
    }
    return structures.map(function (item) {
      return {
        value: item.slug,
        label: item.name,
        guide: item.description,
      };
    });
  }

  function currentSemanticStructure() {
    const value = field('aad-semantic-structure', 'auto-semantic-graph');
    const item = semanticItemBySlug(value);
    if (item) return item;
    const fallback = semanticItemBySlug('auto-semantic-graph');
    if (fallback) return fallback;
    return {
      kind: 'structure',
      slug: 'auto-semantic-graph',
      name: 'AI가 시맨틱 구조 자동 선택',
      description: 'AI가 이름, 주인공, 주제, 예외성, 장면, 감정, 오브젝트 연결을 자동으로 구성합니다.',
      linked_slugs: [],
      prompt: 'AI가 업종 클리셰와 제품 진실을 비교해 하나의 의미망을 선택한다.',
    };
  }

  function semanticStructurePrompt() {
    const structure = currentSemanticStructure();
    const linked = Array.isArray(structure.linked_slugs) ? structure.linked_slugs.map(semanticItemBySlug).filter(Boolean) : [];
    const lines = [
      '광고 시맨틱 구조: ' + structure.name + ' - ' + structure.description,
      structure.prompt ? '구조 프롬프트: ' + structure.prompt : '',
      linked.length ? '연결 노드:' : '',
    ];
    linked.forEach(function (node) {
      lines.push('- [' + node.kind + '] ' + node.name + ': ' + node.description + ' / ' + node.prompt);
    });
    lines.push('시맨틱 규칙: 이름, 주인공, 주제, 예외성, 장면, 감정, 오브젝트, 공간, 장르는 따로 놀면 실패다. 모든 씬은 선택한 의미 구조 안에서 하나의 이유로 연결되어야 한다.');
    lines.push('AI는 콘티 생성 전에 "이름 -> 주인공 -> 주제 -> 예외성 -> 첫 장면 -> 감정 변화 -> 반복 오브젝트 -> 마지막 브랜드" 연결을 정하고, 각 micro_cut의 action/video_prompt에 그 연결이 보이게 쓴다.');
    return lines.filter(Boolean).join('\n');
  }

  function creativityRuleOptions() {
    const rules = semanticItemsByKind('creativity');
    if (!rules.length) {
      return [
        {
          value: 'ai-creative-auto',
          label: 'AI가 창조성 자동 선택',
          guide: 'DB 창조성 규칙을 불러오는 중입니다. 로딩 전에는 AI가 낯선 연결과 제품 진실을 자동으로 조합합니다.',
        },
      ];
    }
    return rules.map(function (item) {
      return {
        value: item.slug,
        label: item.name,
        guide: item.description,
      };
    });
  }

  function currentCreativityRule() {
    const value = field('aad-creativity-rule', 'ai-creative-auto');
    const item = semanticItemBySlug(value);
    if (item) return item;
    const fallback = semanticItemBySlug('ai-creative-auto');
    if (fallback) return fallback;
    return {
      kind: 'creativity',
      slug: 'ai-creative-auto',
      name: 'AI가 창조성 자동 선택',
      description: 'AI가 낯선 연결과 제품 진실을 자동으로 조합합니다.',
      linked_slugs: [],
      prompt: 'AI가 가장 멀리 떨어진 의미 두 개를 제품 진실로 묶어 새 장면을 만든다.',
    };
  }

  function creativityRulePrompt() {
    const rule = currentCreativityRule();
    const linked = Array.isArray(rule.linked_slugs) ? rule.linked_slugs.map(semanticItemBySlug).filter(Boolean) : [];
    const lines = [
      '창조성 규칙: ' + rule.name + ' - ' + rule.description,
      rule.prompt ? '창조성 프롬프트: ' + rule.prompt : '',
      linked.length ? '창조성 연결 노드:' : '',
    ];
    linked.forEach(function (node) {
      lines.push('- [' + node.kind + '] ' + node.name + ': ' + node.description + ' / ' + node.prompt);
    });
    lines.push('창조성은 무작위 새로움이 아니라 멀리 떨어진 의미를 제품 진실로 묶는 것이다. 광고는 익숙한 문제와 낯선 표현이 동시에 있어야 한다.');
    lines.push('AI는 각 씬마다 "낯선 연결 -> 제품 진실 -> 감정 반응 -> 기억 단서"가 드러나게 action, image_prompt, video_prompt를 작성한다.');
    return lines.filter(Boolean).join('\n');
  }

  function successOntologyItems() {
    return semanticItemsByKind('success_formula')
      .slice()
      .sort(function (a, b) { return Number(b.weight || 0) - Number(a.weight || 0); });
  }

  function successOntologyContext() {
    return successOntologyItems().slice(0, 12).map(function (item) {
      const linked = Array.isArray(item.linked_slugs) ? item.linked_slugs.map(semanticItemBySlug).filter(Boolean).slice(0, 6) : [];
      return {
        slug: item.slug,
        name: item.name,
        description: item.description,
        prompt: item.prompt,
        linked_nodes: linked.map(function (node) {
          return {
            kind: node.kind,
            slug: node.slug,
            name: node.name,
            description: node.description,
            prompt: node.prompt,
          };
        }),
      };
    });
  }

  function successCaseContext() {
    return (state.successCases.items || []).slice(0, 6).map(function (item) {
      return {
        title: item.title,
        source_url: item.source_url,
        summary: item.summary,
        nodes: Array.isArray(item.nodes) ? item.nodes.slice(0, 7).map(function (node) {
          return {
            slug: node.slug,
            name: node.name,
            description: node.description,
            prompt: node.prompt,
          };
        }) : [],
      };
    });
  }

  function successOntologyPrompt() {
    const items = successOntologyItems().slice(0, 12);
    if (!items.length) {
      return [
        '성공 방정식 온톨로지: DB 노드가 없으면 AI가 성공 쇼츠 광고의 공통 구조를 직접 추론한다.',
        '필수 추론: 첫 정지 프레임 훅, 감정 급전환, 개연성 있는 이상함, 광고 아닌 척 사건, 제품 진실 다리, 기억 앵커, 공유 트리거, 컷 리듬 상승을 현재 브랜드/소재에 맞게 선택한다.',
      ].join('\n');
    }
    const lines = ['성공 방정식 온톨로지: 성공했던 릴스/쇼츠 광고의 공통 원리를 노드와 관계로 보고, 현재 브랜드에 맞는 조합을 추론한다.'];
    items.forEach(function (item, index) {
      const linked = Array.isArray(item.linked_slugs) ? item.linked_slugs.map(semanticItemBySlug).filter(Boolean).slice(0, 4) : [];
      lines.push((index + 1) + '. ' + item.name + ': ' + item.description + ' / ' + item.prompt);
      if (linked.length) {
        lines.push('   연결: ' + linked.map(function (node) { return '[' + node.kind + '] ' + node.name; }).join(', '));
      }
    });
    lines.push('AI는 후보마다 success_formula와 ontology_trace를 작성한다. success_formula는 선택한 성공 방정식 조합이고, ontology_trace는 왜 이 브랜드/소재에서 그 조합이 먹히는지의 추론 경로다.');
    lines.push('좋은 후보는 "스크롤 정지 -> 감정 전환 -> 제품 진실 연결 -> 기억 앵커 -> 공유 이유"가 끊기지 않는다. 하나라도 비면 후보를 버리고 다시 만든다.');
    return lines.join('\n');
  }

  async function loadSemanticGraph(options) {
    const opts = options || {};
    state.semantics.loading = true;
    try {
      const data = await apiRequestJSON('/api/animation-ad/semantics');
      state.semantics.items = Array.isArray(data.items) ? data.items : [];
      if (!semanticItemBySlug(field('aad-semantic-structure', 'auto-semantic-graph'))) {
        state.form['aad-semantic-structure'] = 'auto-semantic-graph';
      }
      if (!semanticItemBySlug(field('aad-creativity-rule', 'ai-creative-auto'))) {
        state.form['aad-creativity-rule'] = 'ai-creative-auto';
      }
    } catch (err) {
      if (!opts.silent) addLog('시맨틱 구조 DB 불러오기 실패: ' + err.message, 'error');
    } finally {
      state.semantics.loading = false;
      if (opts.render !== false) render();
    }
  }

  async function loadSuccessCases(options) {
    const opts = options || {};
    state.successCases.loading = true;
    try {
      const data = await apiRequestJSON('/api/animation-ad/success-cases');
      state.successCases.items = Array.isArray(data.items) ? data.items : [];
      state.successCases.error = '';
    } catch (err) {
      state.successCases.error = err.message;
      if (!opts.silent) addLog('성공 광고 사례 이력 불러오기 실패: ' + err.message, 'error');
    } finally {
      state.successCases.loading = false;
      if (opts.render !== false) render();
    }
  }

  async function learnSuccessCase() {
    if (state.successCases.saving) return;
    syncForm();
    const payload = {
      title: field('aad-success-case-title', ''),
      source_url: field('aad-success-case-url', ''),
      notes: compactPromptText(field('aad-success-case-notes', ''), 3000),
      raw_text: compactPromptText(field('aad-success-case-raw', ''), 6000),
      profile_context: compactPayloadValue(currentProfileContext() || {}, 900, 3),
      model: field('aad-storyboard-model', state.modelSettings.text_model || 'gemini-2.5-flash'),
    };
    if (![payload.title, payload.source_url, payload.notes, payload.raw_text].some(Boolean)) {
      alert('성공 광고 URL, 제목, 메모, 원문 중 하나 이상을 입력해주세요.');
      return;
    }
    state.successCases.saving = true;
    state.successCases.error = '';
    setBusy('작동중 · 성공 광고 사례를 온톨로지로 분석중');
    render();
    try {
      const data = await apiJSON('/api/animation-ad/success-cases', payload);
      const nodes = Array.isArray(data.nodes) ? data.nodes.length : 0;
      setInput('aad-success-case-title', '');
      setInput('aad-success-case-url', '');
      setInput('aad-success-case-notes', '');
      setInput('aad-success-case-raw', '');
      await loadSemanticGraph({ silent: true, render: false });
      await loadSuccessCases({ silent: true, render: false });
      addLog('성공 광고 사례 학습 완료 · 온톨로지 노드 ' + nodes + '개 저장', 'success');
    } catch (err) {
      state.successCases.error = err.message;
      addLog('성공 광고 사례 학습 실패: ' + err.message, 'error');
      alert('성공 광고 사례 학습 실패: ' + err.message);
    } finally {
      state.successCases.saving = false;
      setBusy('');
      render();
    }
  }

  function encodeQueryValue(value) {
    return encodeURIComponent(String(value || '').trim().replace(/\s+/g, ' '));
  }

  function buildBenchmarkURL(template, item) {
    const source = String(template || '');
    return source
      .replace(/\{brand\}/g, encodeQueryValue(item.brand))
      .replace(/\{campaign\}/g, encodeQueryValue(item.campaign))
      .replace(/\{year\}/g, encodeQueryValue(item.year))
      .replace(/\{category\}/g, encodeQueryValue(item.category));
  }

  function normalizeBenchmarkCatalog(data) {
    const templates = Array.isArray(data?.youtube_query_templates) ? data.youtube_query_templates : [];
    const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : [];
    const direct = Array.isArray(data?.links) ? data.links : [];
    const generated = [];
    campaigns.forEach(function (campaign, campaignIndex) {
      templates.forEach(function (template, templateIndex) {
        const url = buildBenchmarkURL(template.url, campaign);
        generated.push({
          id: 'seed-' + campaignIndex + '-' + templateIndex,
          brand: campaign.brand || '',
          campaign: campaign.campaign || '',
          category: campaign.category || 'global',
          emotion: campaign.emotion || '',
          pattern: campaign.pattern || '',
          year: campaign.year || '',
          youtube_url: url,
          link_type: template.label || 'YouTube search',
          notes: [
            campaign.pattern ? '성공 구조: ' + campaign.pattern : '',
            campaign.emotion ? '감정 축: ' + campaign.emotion : '',
            campaign.lesson ? '벤치마킹 포인트: ' + campaign.lesson : '',
          ].filter(Boolean).join('\n'),
        });
      });
    });
    return direct.concat(generated).map(function (item, index) {
      return {
        index: index,
        id: item.id || ('benchmark-' + index),
        brand: item.brand || '',
        campaign: item.campaign || item.title || '광고 레퍼런스',
        category: item.category || 'global',
        emotion: item.emotion || '',
        pattern: item.pattern || '',
        year: item.year || '',
        youtube_url: item.youtube_url || item.url || '',
        link_type: item.link_type || 'YouTube',
        notes: item.notes || item.summary || '',
      };
    }).filter(function (item) {
      return item.youtube_url || item.notes;
    });
  }

  async function loadBenchmarkLibrary(options) {
    const opts = options || {};
    if (state.benchmarkLibrary.items.length && !opts.force) return;
    state.benchmarkLibrary.loading = true;
    state.benchmarkLibrary.error = '';
    try {
      const res = await fetch('/static/data/animation_ad_benchmark_ads.json?v=20260505-benchmark-modal');
      if (!res.ok) throw new Error('광고 레퍼런스 JSON을 불러오지 못했습니다.');
      const data = await res.json();
      state.benchmarkLibrary.items = normalizeBenchmarkCatalog(data);
      addLog('광고 레퍼런스 링크 ' + state.benchmarkLibrary.items.length + '개 불러옴', 'success');
    } catch (err) {
      state.benchmarkLibrary.error = err.message;
      addLog('광고 레퍼런스 불러오기 실패: ' + err.message, 'error');
    } finally {
      state.benchmarkLibrary.loading = false;
      if (opts.render !== false) render();
    }
  }

  async function openBenchmarkModal() {
    state.benchmarkLibrary.open = true;
    render();
    await loadBenchmarkLibrary();
  }

  function closeBenchmarkModal() {
    state.benchmarkLibrary.open = false;
    render();
  }

  function benchmarkCategories() {
    const categories = new Set(['all']);
    (state.benchmarkLibrary.items || []).forEach(function (item) {
      if (item.category) categories.add(item.category);
    });
    return Array.from(categories);
  }

  function filteredBenchmarkAds() {
    const filter = state.benchmarkLibrary.filter || 'all';
    return (state.benchmarkLibrary.items || []).filter(function (item) {
      return filter === 'all' || item.category === filter;
    });
  }

  function setBenchmarkFilter(value) {
    state.benchmarkLibrary.filter = value || 'all';
    render();
  }

  function isPlayableYouTubeURL(url) {
    return /(?:youtube\.com\/(?:watch\?|shorts\/|embed\/)|youtu\.be\/)/i.test(String(url || ''));
  }

  function benchmarkNotesFromItem(item, analysis) {
    const analyzed = analysis || {};
    return [
      item?.brand || item?.campaign ? '[선택한 글로벌 광고 레퍼런스] ' + [item.brand, item.campaign].filter(Boolean).join(' · ') : '',
      item?.link_type ? '링크 유형: ' + item.link_type : '',
      item?.pattern ? '성공 구조: ' + item.pattern : '',
      item?.emotion ? '감정 축: ' + item.emotion : '',
      item?.notes ? item.notes : '',
      analyzed.title ? '[YouTube 실시간 분석] ' + analyzed.title : '',
      analyzed.channel ? '채널: ' + analyzed.channel : '',
      analyzed.duration ? '길이: ' + analyzed.duration : '',
      analyzed.summary ? '분석 요약: ' + compactPromptText(analyzed.summary, 1200) : '',
      '적용 방식: 원본을 복제하지 않고 첫 프레임 훅, 컷 리듬, 감정 전환, 사운드 히트, 마지막 브랜드 타이밍만 우리 브랜드에 맞게 재구성한다.',
    ].filter(Boolean).join('\n');
  }

  async function applyBenchmarkAd(index, analyze) {
    const item = (state.benchmarkLibrary.items || [])[Number(index)];
    if (!item) return;
    setInput('aad-benchmark-url', item.youtube_url || '');
    setInput('aad-benchmark-notes', benchmarkNotesFromItem(item));
    addLog('벤치마크 적용: ' + [item.brand, item.campaign].filter(Boolean).join(' · '), 'success');
    if (analyze) {
      await analyzeBenchmarkURL(item);
      return;
    }
    state.benchmarkLibrary.open = false;
    render();
  }

  function creativeReportNotes(item) {
    const sections = Array.isArray(item.sections) ? item.sections : [];
    const rules = Array.isArray(item.rules) ? item.rules : [];
    return [
      '[광고 리포트 적용] ' + (item.title || '광고 크리에이티브 리포트'),
      item.source ? '출처: ' + item.source : '',
      item.summary ? '핵심 요약: ' + item.summary : '',
      sections.length ? '적용 인사이트:\n- ' + sections.map(function (section) {
        return [section.name, section.insight].filter(Boolean).join(': ');
      }).join('\n- ') : '',
      rules.length ? '생성 규칙:\n- ' + rules.join('\n- ') : '',
      '적용 방식: 리포트의 CTR/소재 교체/문구/이미지 반응 구조를 복제하지 않고, 쇼츠 첫 1초 훅·컷 리듬·감정 전환·마지막 브랜드 기억 규칙으로 변환한다.',
    ].filter(Boolean).join('\n');
  }

  async function loadCreativeReports(options) {
    const opts = options || {};
    if (state.creativeReports.items.length && !opts.force) return state.creativeReports.items;
    state.creativeReports.loading = true;
    state.creativeReports.error = '';
    render();
    try {
      const res = await fetch('/static/data/animation_ad_creative_reports.json?v=20260505-toss-report');
      if (!res.ok) throw new Error('광고 리포트 옵션을 불러오지 못했습니다.');
      const data = await res.json();
      state.creativeReports.items = Array.isArray(data.items) ? data.items : [];
      return state.creativeReports.items;
    } catch (err) {
      state.creativeReports.error = err.message;
      addLog('광고 리포트 옵션 불러오기 실패: ' + err.message, 'error');
      return [];
    } finally {
      state.creativeReports.loading = false;
      render();
    }
  }

  async function applyCreativeReport(id) {
    const items = await loadCreativeReports();
    const item = items.find(function (entry) { return String(entry.id || '') === String(id || ''); }) || items[0];
    if (!item) {
      alert('적용할 광고 리포트 옵션이 없습니다.');
      return;
    }
    const current = field('aad-benchmark-notes', '');
    const notes = creativeReportNotes(item);
    setInput('aad-benchmark-notes', [current, notes].filter(Boolean).join('\n\n'));
    state.creativeReports.applied = item.id || item.title || 'creative-report';
    addLog('광고 리포트 적용 완료: ' + (item.title || 'Toss 광고 소재 리포트'), 'success');
    render();
  }

  function renderCreativeReportControls() {
    const applied = state.creativeReports.applied ? '적용됨' : '선택 옵션';
    return `
      <div class="aad-creative-report-row">
        <div>
          <b>Toss 광고 소재 리포트</b>
          <span>CTR 차이, 7일 소재 교체, 긴급성/참여형 문구, 데모별 반응 인사이트를 컨셉/콘티 조건에 넣습니다.</span>
        </div>
        <button type="button" class="${state.creativeReports.loading ? 'aad-loading-action' : ''}" onclick="aadApplyCreativeReport('toss-ads-creative-report')" ${state.creativeReports.loading ? 'disabled' : ''}>${state.creativeReports.loading ? '불러오는 중' : applied + ' 적용'}</button>
      </div>
      ${state.creativeReports.error ? '<div class="aad-inline-error">' + esc(state.creativeReports.error) + '</div>' : ''}
    `;
  }

  async function analyzeBenchmarkURL(sourceItem) {
    syncForm();
    const url = field('aad-benchmark-url', '');
    if (!url) {
      alert('분석할 YouTube URL을 입력해주세요.');
      return;
    }
    if (!isPlayableYouTubeURL(url)) {
      alert('검색 결과 링크는 바로 분석할 수 없습니다. YouTube에서 실제 영상의 공유 URL을 붙여넣으면 실시간 분석합니다.');
      return;
    }
    state.benchmarkLibrary.analyzingURL = url;
    setBusy('작동중 · YouTube 벤치마크 분석중');
    render();
    try {
      const data = await apiJSON('/api/ce2/youtube-analyze', { url: url });
      setInput('aad-benchmark-notes', benchmarkNotesFromItem(sourceItem || {}, data));
      addLog('YouTube 벤치마크 분석 완료: ' + (data.title || url), 'success');
      state.benchmarkLibrary.open = false;
    } catch (err) {
      addLog('YouTube 벤치마크 분석 실패: ' + err.message, 'error');
      alert('YouTube 벤치마크 분석 실패: ' + err.message);
    } finally {
      state.benchmarkLibrary.analyzingURL = '';
      setBusy('');
      render();
    }
  }

  async function analyzeBenchmarkModalURL() {
    const el = document.getElementById('aad-benchmark-modal-url');
    const value = el ? el.value : '';
    setInput('aad-benchmark-url', value);
    await analyzeBenchmarkURL({});
  }

  function exceptionRuleOptions() {
    return [
      {
        value: 'ai-auto',
        label: 'AI가 예외성 자동 선택',
        guide: 'AI가 업종 클리셰를 먼저 찾고 주인공, 장소, 시간, 물리법칙, 금기, 관점 중 가장 강한 예외 축을 하나 고릅니다.',
      },
      {
        value: 'wrong-hero',
        label: '주인공 예외',
        guide: '보통 사람이 주인공인 광고에서 제품, 소품, 그림자, 손, 공간, 조연을 주인공처럼 움직입니다.',
      },
      {
        value: 'wrong-place',
        label: '장소 예외',
        guide: '업종이 절대 가지 않을 것 같은 장소에 제품 문제를 옮겨 낯선 대비를 만듭니다.',
      },
      {
        value: 'wrong-time',
        label: '시간 예외',
        guide: '결말을 먼저 보여주거나, 1초 뒤 미래/하루 전/10년 후를 오가며 이유를 추적합니다.',
      },
      {
        value: 'scale-break',
        label: '스케일 예외',
        guide: '작은 불편을 거대한 재난처럼, 큰 문제를 손끝의 작은 제스처처럼 반대로 축소/확대합니다.',
      },
      {
        value: 'physics-break',
        label: '물리법칙 예외',
        guide: '제품 가치가 중력, 빛, 속도, 공간 접힘처럼 보이는 초현실 장면으로 드러나게 합니다.',
      },
      {
        value: 'taboo-truth',
        label: '금기 진실 예외',
        guide: '업계가 보통 숨기는 불편한 진실을 안전하고 정직하게 보여주고 제품의 태도로 회수합니다.',
      },
      {
        value: 'reverse-role',
        label: '역할 반전 예외',
        guide: '고객이 브랜드를 고르는 게 아니라 제품/공간/상황이 고객을 시험하거나 선택하는 구조로 뒤집습니다.',
      },
      {
        value: 'genre-invasion',
        label: '장르 침입 예외',
        guide: '평범한 제품 순간에 스릴러, 로맨스, 스포츠 중계, 요리 배틀, 다큐 같은 낯선 장르 문법을 침입시킵니다.',
      },
      {
        value: 'silence-gap',
        label: '침묵/공백 예외',
        guide: '시끄러운 숏폼 문법과 반대로 순간적인 정적, 멈춤, 빈 공간으로 시선을 잡고 다음 컷에서 폭발시킵니다.',
      },
      {
        value: 'forbidden-angle',
        label: '카메라 관점 예외',
        guide: '사람 눈높이 대신 서랍 속, 제품 표면, 손바닥, 천장, 거울, CCTV 같은 비정상 관점으로 사건을 봅니다.',
      },
    ];
  }

  function currentExceptionRule() {
    const value = field('aad-exception-rule', 'ai-auto');
    return exceptionRuleOptions().find(function (item) { return item.value === value; }) || exceptionRuleOptions()[0];
  }

  function platformPlaybookOptions() {
    return [
      {
        value: 'native-hook-shorts',
        label: '릴스/쇼츠 네이티브 훅',
        guide: '인스타 릴스와 유튜브 쇼츠에서 광고처럼 보이지 않게 시작합니다. 로고 인트로, 제품 자랑, 혜택 나열 없이 사건·실수·리액션·궁금증으로 붙잡고 마지막에 브랜드만 남깁니다.',
      },
      {
        value: 'auto-cross-platform',
        label: 'Reels + Shorts 통합',
        guide: '인스타 릴스와 유튜브 쇼츠 공통 기준으로 9:16, 첫 3초 훅, 사운드 온, safe zone, 마지막 브랜드 기억을 모두 챙깁니다.',
      },
      {
        value: 'meta-reels',
        label: 'Instagram Reels 집중',
        guide: '9:16 세로, 오디오, 핵심 요소 safe zone, 크리에이터/UGC 느낌, 손·얼굴·제품을 크게 보여주는 모바일 몰입형입니다.',
      },
      {
        value: 'youtube-shorts',
        label: 'YouTube Shorts 집중',
        guide: '10~30초 액션형 쇼츠에 맞춰 소셜 퍼스트, vertical, sound-on, organic blend, creator asset 느낌을 우선합니다.',
      },
      {
        value: 'creator-ugc',
        label: '크리에이터 UGC형',
        guide: '광고처럼 과하게 꾸미기보다 실제 사용자의 발견, 반응, 손동작, 현장감, 자연스러운 소리로 설득합니다.',
      },
      {
        value: 'tiktok-top-ads',
        label: 'TikTok 참고 분석',
        guide: '릴스/쇼츠 제작을 보조하기 위해 초 단위·프레임 단위 훅, 피크, 이탈 지점, 사운드 히트만 참고합니다.',
      },
    ];
  }

  function currentPlatformPlaybook() {
    const value = field('aad-platform-playbook', 'native-hook-shorts');
    return platformPlaybookOptions().find(function (item) { return item.value === value; }) || platformPlaybookOptions()[0];
  }

  function hookRecipeOptions() {
    return [
      {
        value: 'first-frame-shock',
        label: '첫 프레임 충격',
        guide: '정지 화면만 봐도 멈추게 하는 이상 신호, 손동작, 표정, 제품 단서, 위험한 듯한 장면을 첫 컷에 둡니다.',
      },
      {
        value: 'problem-open-loop',
        label: '문제 오픈루프',
        guide: '첫 3초에 문제를 바로 보여주고 답은 조금 늦게 공개해 끝까지 보게 만듭니다.',
      },
      {
        value: 'satisfying-transform',
        label: '쾌감 전후변화',
        guide: '복잡함이 정리되거나 더러움이 깨끗해지는 식의 시각적 만족감을 짧은 리듬으로 만듭니다.',
      },
      {
        value: 'creator-reaction',
        label: '리액션 증거',
        guide: '사람의 얼굴, 손, 몸짓, 주변 반응이 제품 설명보다 먼저 증거가 되게 구성합니다.',
      },
      {
        value: 'sound-hit-transition',
        label: '사운드 드랍 전환',
        guide: 'BGM 드랍, 충격음, ASMR, 움직임 소리가 컷 전환을 밀어주게 설계합니다.',
      },
      {
        value: 'loop-twist',
        label: '루프 반전',
        guide: '마지막 장면이 첫 장면의 의미를 바꾸거나 자연스럽게 처음으로 이어져 다시 보게 만듭니다.',
      },
    ];
  }

  function currentHookRecipe() {
    const value = field('aad-hook-recipe', 'first-frame-shock');
    return hookRecipeOptions().find(function (item) { return item.value === value; }) || hookRecipeOptions()[0];
  }

  function personaOptions() {
    return [
      {
        value: 'brand-creator',
        label: '브랜드 크리에이터',
        guide: '광고 전체에 같은 인물/말투/표정 에너지가 반복 등장합니다. 릴스/쇼츠 UGC 느낌에 가장 잘 맞습니다.',
      },
      {
        value: 'signature-model',
        label: '시그니처 모델',
        guide: '같은 모델의 얼굴, 헤어, 의상 톤, 자세를 유지해 브랜드 얼굴처럼 보이게 만듭니다.',
      },
      {
        value: 'mascot-character',
        label: '마스코트 캐릭터',
        guide: '애니메이션/하이브리드 광고에서 반복 등장하는 캐릭터를 정해 기억 포인트로 씁니다.',
      },
      {
        value: 'product-as-hero',
        label: '제품이 주인공',
        guide: '사람보다 제품/패키지/오브젝트의 형태와 움직임을 일관되게 유지합니다.',
      },
      {
        value: 'none',
        label: '페르소나 없음',
        guide: '업종상 인물/캐릭터 고정이 불필요할 때만 사용합니다. 컷 일관성은 제품과 공간으로 유지합니다.',
      },
    ];
  }

  function currentPersona() {
    const value = field('aad-persona-type', 'brand-creator');
    return personaOptions().find(function (item) { return item.value === value; }) || personaOptions()[0];
  }

  function personaAgeOptions() {
    return [
      { value: 'ai-auto', label: 'AI가 광고에 맞춰 선택' },
      { value: '20s', label: '20대' },
      { value: '30s', label: '30대' },
      { value: '40s', label: '40대' },
      { value: '50s-plus', label: '50대 이상' },
      { value: 'ageless-character', label: '나이 특정 없는 캐릭터' },
    ];
  }

  function personaGenderOptions() {
    return [
      { value: 'ai-auto', label: 'AI가 광고에 맞춰 선택' },
      { value: 'female-presenting', label: '여성형' },
      { value: 'male-presenting', label: '남성형' },
      { value: 'neutral-presenting', label: '중성적/성별 강조 없음' },
      { value: 'mascot', label: '사람 아닌 마스코트' },
    ];
  }

  function personaExpressionOptions() {
    return [
      { value: 'confident-bright', label: '밝고 자신감 있는 표정' },
      { value: 'comic-reactive', label: '웃긴 리액션이 큰 표정' },
      { value: 'premium-calm', label: '고급스럽고 차분한 표정' },
      { value: 'curious-shocked', label: '호기심/놀람이 강한 표정' },
      { value: 'dramatic-intense', label: '영화처럼 강렬한 표정' },
    ];
  }

  function personaFramingOptions() {
    return [
      { value: 'waist-up', label: '허리 위 단일 초상' },
      { value: 'full-body', label: '전신 단일 초상' },
      { value: 'close-portrait', label: '얼굴 중심 초상' },
      { value: 'creator-desk', label: '크리에이터 작업 공간' },
      { value: 'product-hold', label: '제품/소품을 든 초상' },
    ];
  }

  function optionLabel(options, value) {
    const item = options.find(function (candidate) { return String(candidate.value) === String(value); });
    return item ? item.label : String(value || '');
  }

  function personaModelOptions() {
    return {
      age: field('aad-persona-age', 'ai-auto'),
      gender: field('aad-persona-gender', 'ai-auto'),
      hair: field('aad-persona-hair', '').trim(),
      outfit: field('aad-persona-outfit', '').trim(),
      expression: field('aad-persona-expression', 'confident-bright'),
      framing: field('aad-persona-framing', 'waist-up'),
      brand_detail: field('aad-persona-brand-detail', '').trim(),
    };
  }

  function personaModelOptionSummary(options) {
    const opts = options || personaModelOptions();
    return [
      '연령: ' + optionLabel(personaAgeOptions(), opts.age || 'ai-auto'),
      '성별/인상: ' + optionLabel(personaGenderOptions(), opts.gender || 'ai-auto'),
      opts.hair ? '헤어/얼굴: ' + opts.hair : '',
      opts.outfit ? '의상: ' + opts.outfit : '',
      '표정 에너지: ' + optionLabel(personaExpressionOptions(), opts.expression || 'confident-bright'),
      '구도: ' + optionLabel(personaFramingOptions(), opts.framing || 'waist-up'),
      opts.brand_detail ? '브랜드 디테일: ' + opts.brand_detail : '',
    ].filter(Boolean).join('\n');
  }

  function personaPrompt() {
    const persona = currentPersona();
    const description = field('aad-persona-description', '').trim();
    if (persona.value === 'none') {
      return '고정 인물/캐릭터 페르소나는 사용하지 않는다. 대신 제품, 공간, 브랜드 컬러, 소품, 카메라 톤을 모든 컷에서 일관되게 유지한다.';
    }
    return [
      '광고 페르소나: ' + persona.label + ' - ' + persona.guide,
      description ? '사용자 지정 페르소나: ' + description : 'AI가 브랜드와 업종에 맞는 한 명의 대표 인물/캐릭터/제품 주인공을 정하고 모든 씬에서 같은 정체성을 유지한다.',
      referenceImageGroups().persona.length ? '모델/페르소나 참고 이미지를 최우선 identity reference로 사용한다. 얼굴, 헤어, 의상 톤, 체형/실루엣, 포즈, 손동작, 표정 에너지를 모든 컷에서 유지한다.' : '',
      '페르소나는 컷마다 랜덤하게 바뀌면 실패다. 얼굴형, 헤어, 의상 톤, 체형/실루엣, 손/움직임 습관, 감정 톤, 카메라 거리, 브랜드 컬러 소품을 반복 단서로 유지한다.',
      '콘티에는 persona_continuity 또는 각 컷 action/camera/image_prompt/video_prompt에 같은 페르소나 단서를 써서 이미지/영상 모델이 일관되게 생성할 수 있게 한다.',
    ].filter(Boolean).join('\n');
  }

  function brandIdentityPrompt() {
    const profile = currentProfileContext();
    const groups = referenceImageGroups();
    return [
      '브랜드 아이덴티티 고정 규칙:',
      profile?.brand ? '브랜드명: ' + profile.brand : '',
      profile?.colors ? '브랜드 색상: ' + profile.colors : '',
      profile?.business ? '비즈니스 설명: ' + profile.business : '',
      profile?.service ? '서비스 설명: ' + profile.service : '',
      profile?.design_rules ? '디자인 규칙: ' + profile.design_rules : '',
      groups.brand.length ? '브랜드/로고 참고 이미지가 있으면 실제 로고, 워드마크, 컬러, 공간 무드를 identity reference로 유지한다.' : '',
      '브랜드 로고는 새로 만들거나 가짜 글자로 재해석하지 않는다. 필요할 때만 사용자가 준 실제 로고 reference를 제품 표식, 패키지 라벨, 매장 간판, 앱 아이콘, 유니폼 패치, 소품처럼 이미지/영상 안에 자연스럽게 들어가게 한다.',
      'HyperFrames는 로고 이미지를 얹지 않는다. 로고는 이미지/영상 생성 reference로만 사용하고, 마지막 컷에는 브랜드명 텍스트와 브랜드 색 강조선만 최소로 표시한다.',
    ].filter(Boolean).join('\n');
  }

  function purpleCowRules() {
    return [
      '퍼플카우 원칙: 카테고리에서 흔한 "좋은 제품 소개" 장면은 갈색 소처럼 지나간다. 첫 프레임에는 시청자가 한 문장으로 친구에게 말할 수 있는 이상한 장면, 낯선 행동, 반전 맥락, 기억나는 오브젝트 중 하나가 있어야 한다.',
      '퍼플카우는 랜덤 괴상함이 아니다. 제품/브랜드의 진짜 차별점, 고객 문제, 사용 순간, 디자인 특징, 공간 경험 중 하나를 과장된 장면으로 바꿔야 한다.',
      '각 씬은 "이 장면을 누가 왜 공유하지?"라는 질문에 답해야 한다. 답이 없으면 제품 설명 컷이 아니라 사건 컷으로 다시 쓴다.',
      '거짓 낚시, 혐오, 비하, 위험 행동, 허위 보장, 충격을 위한 충격은 금지한다. 놀라움은 반드시 제품 문제/해결과 연결한다.',
    ].join('\n');
  }

  function factsToStoryRules() {
    return [
      '팩트보다 스토리 원칙: 사람은 스펙, 수치, 장점 나열보다 목표를 가진 인물, 방해물, 선택, 감정 변화, 감각적 장면을 더 오래 따라간다.',
      '모든 제품 장점은 문장으로 설명하지 말고 상황으로 번역한다. 예: "빠르다"는 늦은 사람이 위기를 벗어나는 장면, "고급스럽다"는 손끝의 재질과 주변 반응, "편하다"는 짜증이 풀리는 표정으로 보여준다.',
      '컷마다 감정 동사를 하나씩 가진다. 놀람, 초조, 부끄러움, 욕망, 안도, 웃음, 질투, 호기심, 해방감 중 하나가 화면에서 읽혀야 한다.',
      '광고 문장은 마지막 브랜드만 남긴다. 중간 정보는 표정, 손동작, 사운드 히트, 전후 리듬, 공간 변화, 제품 반응으로 전달한다.',
    ].join('\n');
  }

  function adCutDiversityRules() {
    return [
      '광고 컷 다양성 감독 규칙: 같은 모델/브랜드를 유지하되 컷 문법은 반복하지 않는다. 모든 컷이 같은 중앙 인물샷, 같은 손동작, 같은 제품 클로즈업, 같은 배경, 같은 줌인으로 보이면 실패다.',
      '최소 10가지 샷 역할을 섞는다: cold_open_incident, human_reaction, object_macro, hand_process, environment_wide, over_the_shoulder, pov_screen_or_object, transformation_match_cut, proof_detail, sensory_texture, social_reaction, final_brand_hold.',
      '인접한 두 마이크로 컷은 camera distance, angle, motion, subject scale, emotional verb, object focus 중 최소 3개가 달라야 한다.',
      '한 씬 안의 5개 마이크로 컷은 반드시 1) 상황 훅, 2) 이상 징후/문제, 3) 디테일 증거, 4) 감정 피크/리액션, 5) 전환 목적을 나눠 가진다. 같은 역할을 2번 연속 쓰지 않는다.',
      '30초 영상의 실제 영상화 후보는 8~12개만 선별한다. 선별 기준은 첫 프레임 충격, 감정 피크, 제품/서비스 진실 증거, 전환 리듬, 브랜드 기억 기여도이며, 단순 설명 컷과 중복 컷은 낮은 importance를 준다.',
      '컷마다 shot_diversity_reason을 내부적으로 정하고 action 또는 video_prompt 안에 "왜 이 컷이 직전 컷과 다른지"가 보이게 쓴다.',
    ].join('\n');
  }

  function creativeExceptionRules() {
    const rule = currentExceptionRule();
    return [
      '창조적 예외성 선택: ' + rule.label + ' - ' + rule.guide,
      '창조적 예외성 공식: 먼저 해당 업종의 흔한 광고 클리셰 3개를 찾고, 그중 하나를 의도적으로 깨는 장면을 만든다.',
      rule.value === 'ai-auto' ? 'AI 자동 선택일 때는 주인공 예외, 장소 예외, 시간 예외, 스케일 예외, 물리법칙 예외, 금기 진실 예외, 역할 반전 예외, 장르 침입 예외, 침묵/공백 예외, 카메라 관점 예외 중 가장 제품 진실과 강하게 붙는 축을 하나만 고른다.' : '선택한 예외 축을 모든 씬의 핵심 차별화 장치로 유지하되 컷마다 반복 방식은 다르게 변주한다.',
      '예외 장면은 반드시 제품 진실과 연결되어야 한다. 제품과 상관없는 기괴함, 충격, 밈 복붙, 유행어 나열은 창조성이 아니라 소음이다.',
      'AI는 콘티 생성 전에 "흔한 클리셰 -> 깬 규칙 -> 제품 진실 -> 첫 프레임 증거"를 내부적으로 정리하고, 결과 콘티에는 깬 규칙이 화면 행동으로 보이게 쓴다.',
      '콘티를 쓸 때 각 씬마다 "이 컷이 다른 광고와 다른 단 하나의 이유"를 action 또는 video_prompt에 남긴다.',
    ].join('\n');
  }

  function platformPlaybookRules() {
    const playbook = currentPlatformPlaybook();
    const recipe = currentHookRecipe();
    return [
      '플랫폼 플레이북: ' + playbook.label + ' - ' + playbook.guide,
      '후킹 레시피: ' + recipe.label + ' - ' + recipe.guide,
      personaPrompt(),
      brandIdentityPrompt(),
      '기본 최적화 대상은 Instagram Reels와 YouTube Shorts다. TikTok은 초 단위 훅과 피크 분석을 참고하는 보조 벤치마크로만 사용한다.',
      'Instagram Reels식으로 9:16 세로, 오디오가 있는 영상, 핵심 피사체와 마지막 브랜드가 UI safe zone에 가려지지 않는 구도를 우선한다.',
      'YouTube Shorts식으로 10~30초 액션형 광고는 소셜 퍼스트, 모바일 최적화, organic blend, creator asset 느낌을 우선한다. 1분 광고도 첫 30초 안에 핵심 사건과 브랜드 기억을 완결한다.',
      'TikTok Top Ads식 분석은 0~1초, 1~3초, 3~6초, 중반, 마지막 브랜드 구간의 볼거리와 감정 피크를 확인할 때만 참고한다.',
      nativeShortsRules(),
      '화면 텍스트가 없으므로 사운드, 표정, 손동작, 제품 단서, 카메라 움직임이 정보 전달을 대신해야 한다.',
      '벤치마크 URL이 있으면 원본의 카피가 아니라 retention curve, key frame, scene change timing, sound hit timing, product/brand reveal timing만 참고한다.',
    ].join('\n');
  }

  function entertainmentAdRules() {
    return [
      '광고 서사 방식: ' + currentStoryArc().label + ' - ' + currentStoryArc().guide,
      '시선 훅: ' + currentAttentionHook().label + ' - ' + currentAttentionHook().guide,
      platformPlaybookRules(),
      purpleCowRules(),
      factsToStoryRules(),
      creativeExceptionRules(),
      adCutDiversityRules(),
      '제품이 좋다, 편하다, 추천한다 같은 자기칭찬 문장을 반복하지 않는다. 장면이 먼저 설득하고, 화면 텍스트는 마지막 브랜드만 담당한다.',
      '모든 씬은 사건이어야 한다. 갈등, 욕망, 방해물, 발견, 반전, 리액션, 증거, 보상 중 최소 2개를 포함한다.',
      '만화/애니메이션 광고는 귀여운 설명 카드가 아니라 웃긴 상황, 과장된 표정, 시각적 농담, 반전 타이밍, 기억나는 캐릭터 행동 중 최소 1개를 컷마다 가진다.',
      '실사 광고도 단순 제품 클로즈업만 반복하지 않는다. 실제 사람이 겪는 압박, 망설임, 사용 순간, 안도, 주변 반응을 영화 장면처럼 만든다.',
      '관능/섹시 무드는 조명, 재질, 손동작, 향, 속도, 시선, 공간 온도로 표현한다. 노골적인 성행위, 신체 부위 집착, 대상화, 미성년자/어려 보이는 인물, 동의 없는 상황, 선정적 카피는 금지한다.',
      '웃긴 광고를 선택하면 제품을 웃음거리로 만들지 않고, 고객 문제나 상황의 부조리를 웃기게 만든 뒤 해결 장면을 명확히 보여준다.',
      '기술/앱/서비스 광고는 추상 네트워크 배경만 반복하지 않는다. 사람의 과부하, 알림 폭주, 작업 충돌, 한 번에 정리되는 쾌감처럼 볼거리가 있는 사건으로 만든다.',
    ].join('\n');
  }

  function adCreativeBenchmarkRules() {
    return [
      '벤치마킹 규칙: 인스타 릴스와 유튜브 쇼츠를 기본 배포면으로 보고, 첫 3초 안에 광고의 핵심 사건이나 문제를 보여주고 첫 6초 안에는 서스펜스, 놀라움, 감정, 움직임으로 훅을 만든다.',
      '벤치마킹 규칙: Meta Reels식으로 9:16 영상, 오디오, safe zone, 크리에이터형 자연스러움을 우선하고 핵심 피사체가 앱 UI에 가리지 않게 한다.',
      '벤치마킹 규칙: YouTube Shorts식으로 vertical, sound-on, social-first, organic blend, creator asset 느낌을 우선하고 10~30초 액션형 구조에 맞춘다.',
      '벤치마킹 규칙: YouTube ABCD처럼 Attention, Branding, Connection, Direction을 모두 포함한다. 브랜드는 로고 덩어리로 끼워 넣지 말고 이야기와 장면 안에 일찍 녹인다.',
      '벤치마킹 규칙: Runway/LTX식 멀티샷 제작처럼 모든 컷은 독립 수정 가능한 shot-by-shot 단위여야 하고, 재미없는 컷 하나만 다시 만들 수 있게 프롬프트가 분리되어야 한다.',
      '벤치마킹 규칙: HeyGen/Creatify식 제품 URL/브랜드킷 광고화처럼 상품/브랜드 reference, 톤, CTA, 플랫폼 비율을 일관되게 유지하되 같은 훅만 반복하지 않고 변형 테스트를 전제로 한다.',
      '벤치마킹 규칙: Kantar식 감정 광고 관점으로 웃음, 놀라움, 관능, 안도, 긴장 중 하나가 장면을 밀고 가야 한다. 단 재미는 브랜드 메시지를 훔치지 않고 제품 문제/해결과 붙어 있어야 한다.',
      '벤치마킹 규칙: 퍼플카우 관점으로 카테고리에서 뻔한 장면을 찾아 뒤집는다. 제품의 진짜 차별점을 낯선 장면, 뜻밖의 사용 맥락, 기억나는 오브젝트, 한 번 더 보고 싶은 행동으로 만든다.',
      '벤치마킹 규칙: 팩트 나열형 광고는 피한다. 장점/스펙/숫자는 인물의 감정 변화와 사건으로 번역하고, 화면이 먼저 설득하게 한다.',
      '벤치마킹 규칙: 섹시/관능 훅은 브랜드와 카테고리에 맞을 때만 쓰며, 성적 대상화가 아니라 프리미엄 감각 연출로 처리한다.',
      '벤치마킹 규칙: TikTok Creative Insights/Top Ads식 key frame analysis는 보조 참고로만 쓰고, 최종 산출물은 인스타 릴스/유튜브 쇼츠 네이티브 문법에 맞춘다.',
      '벤치마킹 규칙: 광고처럼 느껴지는 로고 인트로, 정면 제품 영웅샷, 혜택 나열, 세일즈 문장, 과한 스튜디오 조명은 피하고 실제 사람이 찍은 듯한 사건/반응/실험/실수/비하인드 흐름으로 만든다.',
      viralShortsRules(),
    ].join('\n');
  }

  function benchmarkAdContextPrompt() {
    const url = field('aad-benchmark-url', '');
    const notes = field('aad-benchmark-notes', '');
    if (!url && !notes) return '';
    return [
      '[벤치마크 광고 구조 참고]',
      url ? '벤치마크 광고 URL: ' + url : '',
      notes ? '사용자 메모: ' + notes : '',
      '이 벤치마크는 그대로 복제하지 않는다. 훅 구조, 컷 리듬, 카메라 패턴, 감정 장치, 마지막 브랜드 락업 타이밍, 쇼츠 화면 구성만 분석해 우리 상품/브랜드에 맞는 새 광고로 재구성한다.',
      '분석 항목: 첫 프레임, 첫 3초 훅, 첫 6초 감정 장치, 컷 수와 컷당 길이, 사람/제품 등장 타이밍, retention peak로 보이는 순간, scene change timing, 마지막 브랜드 등장 타이밍, 사운드 큐, 코미디/관능/긴장/감정 반전.',
      '금지: 원본 광고의 카피, 고유 장면, 인물/캐릭터, 음악, 로고, 상표, 독창적 대사, 프레임 구도를 그대로 베끼지 않는다.',
      '릴스/쇼츠 우선: 기본은 9:16 세로, 빠른 첫 프레임, 모바일 safe zone, 짧은 컷, 큰 리액션, 사운드 히트, 마지막 브랜드 기억으로 설계한다. TikTok 링크는 구조 참고만 하고 최종 문법은 Instagram Reels/YouTube Shorts에 맞춘다.',
    ].filter(Boolean).join('\n');
  }

  function viralShortsRules() {
    return [
      '목표는 1천만 뷰를 노리는 쇼츠 광고 구조다. 보장은 하지 않지만, 첫 프레임부터 공유/저장/댓글을 유도할 만큼 강한 사건으로 설계한다.',
      '첫 0.5초: 정지 화면으로도 궁금해야 한다. 표정, 손동작, 제품 단서, 위험 신호, 예상 밖 장면 중 하나를 반드시 넣는다.',
      '첫 3초: 누가, 왜, 무엇 때문에 멈춰 봐야 하는지 즉시 보인다. 느린 로고 인트로, 추상 배경, 제품 중앙샷만 시작하는 구성은 실패다.',
      '어그로 훅: 충격 질문, 반대 의견, 실수 폭로, 사용 전후 반전, 금기처럼 보이는 장면을 쓸 수 있다. 단 3초 안에 제품/문제와 연결되고, 거짓 낚시·허위 보장·혐오·비하·공포 조장은 금지한다.',
      '첫 6초: 감정 변화가 있어야 한다. 웃김, 긴장, 당황, 감탄, 관능적 호기심, 안도 중 하나가 올라와야 한다.',
      '중반: 같은 정보 반복 금지. 2~3초마다 새 시각 사건, 새 리액션, 새 증거, 새 전환을 넣는다.',
      '루프 포인트: 마지막 컷은 첫 컷으로 자연스럽게 되돌아가거나, 다시 보게 만드는 반전/미해결 질문/시각 잔상을 남긴다.',
      '댓글 유도: 억지 질문이 아니라 사용자가 자기 상황을 떠올리게 하는 도발 질문이나 공감 문장을 1개만 둔다.',
      '인스타 릴스/유튜브 쇼츠 광고는 9:16 세로를 기본 우선으로 보고, 얼굴/손/제품/문제 단서가 모바일 화면에서 크게 보여야 한다.',
      'safe zone: 사람 얼굴, 손, 제품, 마지막 브랜드 락업은 Reels/Shorts UI가 덮는 하단 캡션, 우측 버튼, 상단 계정 영역에 걸리지 않게 한다.',
      '사운드: 나레이션은 쓰지 않지만 BGM 리듬, SFX hit, ASMR action sound, transition sound가 장면 이해를 도와야 한다.',
      '중간에는 호기심을 유지하고 마지막 3~5초에 브랜드만 강하게 각인한다. 별도 CTA 문구나 버튼은 넣지 않는다.',
    ].join('\n');
  }

  function nativeShortsRules() {
    return [
      '릴스/쇼츠 네이티브 공식: 광고처럼 시작하지 않는다. 첫 화면에 로고, 제품 중앙샷, 가격/혜택, 할인 느낌, 광고 문구, 브랜드 슬로건을 두지 않는다.',
      '첫 0~1초는 실제 숏폼처럼 사건으로 시작한다. 실수, 이상한 상황, 예상 밖 반응, 손동작, 표정, 현장감, 전후변화, 궁금한 디테일 중 하나를 먼저 보여준다.',
      '제품/서비스는 주인공이 아니다. 상황을 바꾸는 단서처럼 등장하고, 사람의 반응이나 문제 해결 순간이 먼저 보여야 한다.',
      '촬영감은 너무 광고 스튜디오처럼 매끈하지 않게 한다. handheld, candid, POV, close hand detail, behind-the-scenes, creator-style framing을 쓸 수 있다.',
      '세일즈 문장 대신 관찰 가능한 행동을 쓴다. “좋다/편하다/추천” 같은 문장을 금지하고, 화면에서 바뀌는 사실만 보여준다.',
      '브랜드는 숨기지 않지만 티 내지 않는다. 중간에는 제품/공간/색/오브젝트로 자연스럽게 스며들고, 마지막 컷에서만 브랜드명이 조용히 고정된다.',
    ].join('\n');
  }

  function modelLabel(options, value) {
    const found = options.find(function (item) { return item.value === value; });
    return found ? found.label : (value || '자동');
  }

  function narrationVoiceOptions() {
    return [
      { value: 'gemini-Kore', label: 'Kore · 안정적인 광고톤' },
      { value: 'gemini-Aoede', label: 'Aoede · 밝고 감성적' },
      { value: 'gemini-Charon', label: 'Charon · 묵직한 프리미엄' },
      { value: 'gemini-Puck', label: 'Puck · 빠르고 경쾌함' },
    ];
  }

  function renderModelPicker() {
    const refs = videoCutRefs();
    const imageReady = refs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
    const videoReady = refs.filter(function (ref) { return hasRealSceneVideo(ref.key); }).length;
    const stepTwoPrompt = activeFlowStepNo() === 2 && !state.busy;
    return `
      <div class="aad-model-picker">
        <div class="aad-model-head">
          <div>${stepTag(2, 'AI 모델 선택')}<b>AI 모델 선택</b></div>
          <span>스토리보드, 이미지, 영상 모델을 시작 전에 고릅니다. BGM/SFX/VFX는 영상 생성 옵션 안에 넣고 최종 렌더에서 음악과 나레이션을 함께 합성합니다.</span>
        </div>
        <div class="aad-model-grid">
          <label>스토리보드 모델<select id="aad-storyboard-model" onchange="aadSyncModelPicker()">${optionTags(storyboardModelOptions(), state.form['aad-storyboard-model'])}</select></label>
          <label>이미지 모델<select id="aad-image-model" onchange="aadSyncModelPicker()">${optionTags(imageModelOptions(), state.form['aad-image-model'])}</select></label>
          <label>영상 모델 · BGM/SFX/VFX 포함<select id="aad-video-model" onchange="aadSyncModelPicker()">${optionTags(videoModelOptions(), currentVideoModel())}</select></label>
        </div>
        <div class="aad-model-actions">
          <button type="button" onclick="aadReapplySelectedVideoModel()"${state.busy || !refs.length ? ' disabled' : ''}>선택 영상 모델 재적용</button>
          <button type="button" onclick="aadGenerateAllVideos(true)"${state.busy || !imageReady ? ' disabled title="먼저 선별 컷 이미지를 생성하세요"' : ''}>선별 컷 영상 재생성</button>
          <button type="button" class="${stepTwoPrompt ? 'aad-next-action' : ''}" onclick="aadJumpFlowStep(3)"${state.busy ? ' disabled' : ''}>모델 선택 완료 · 3단계로 이동</button>
          <span>선별 컷 ${videoReady}/${refs.length} · 이미지 ${imageReady}/${refs.length}</span>
        </div>
        ${renderPersonaModelStatus()}
      </div>
    `;
  }

  function syncModelPicker() {
    syncForm();
    const storyboard = field('aad-storyboard-model', state.modelSettings.text_model || 'gemini-2.5-flash');
    const image = field('aad-image-model', state.modelSettings.image_model || 'openai/gpt-image-2-developer/text-to-image');
    currentVideoModel();
    setInput('aad-plan-engine', storyboard === 'codex-cli' ? 'codex' : 'gemini');
    setInput('aad-image-engine', image === 'codex-cli' ? 'codex' : 'gemini');
    scheduleHistoryAutosave();
  }

  function aspectOptions() {
    return [
      { value: '9:16', label: '9:16 세로', size: '1080 x 1920', guide: '인스타 릴스와 유튜브 쇼츠용 세로 광고. 인물/제품은 중앙 세로 축에 두고 하단 캡션, 우측 버튼, 상단 계정 UI 안전 여백을 확보합니다.' },
      { value: '16:9', label: '16:9 가로', size: '1920 x 1080', guide: '유튜브, 랜딩, 프레젠테이션용 가로 광고. 좌우 공간과 배경 스케일, 와이드 카메라 무빙을 살립니다.' },
      { value: '1:1', label: '1:1 정사각', size: '1080 x 1080', guide: '피드, 카드형 광고용 정사각. 중심 피사체와 짧은 카피 안전 영역을 균형 있게 배치합니다.' },
    ];
  }

  function currentAspectSpec() {
    const value = field('aad-aspect', '9:16');
    return aspectOptions().find(function (item) { return item.value === value; }) || aspectOptions()[0];
  }

  function renderAspectPicker() {
    const current = currentAspectSpec().value;
    return `
      <div class="aad-aspect-picker wide">
        <input type="hidden" id="aad-aspect" value="${esc(current)}">
        <div class="aad-aspect-title">
          <b>이미지/영상 화면비</b>
          <span>콘티 이미지, AI 영상 클립, 최종 렌더를 같은 비율로 고정합니다.</span>
        </div>
        <div class="aad-aspect-options">
          ${aspectOptions().map(function (item) {
            const active = item.value === current ? ' active' : '';
            return '<button type="button" class="aad-aspect-card' + active + '" data-aspect-value="' + esc(item.value) + '" aria-pressed="' + (item.value === current ? 'true' : 'false') + '" aria-label="' + esc(item.label + ' ' + item.size) + '" onclick="aadSetAspect(&quot;' + esc(item.value) + '&quot;)"><strong>' + esc(item.value) + '</strong><b>' + esc(item.label.replace(item.value + ' ', '')) + '</b><span>' + esc(item.size) + '</span><em>' + esc(item.guide) + '</em></button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function setAspect(value) {
    if (!aspectOptions().some(function (item) { return item.value === value; })) return;
    setInput('aad-aspect', value);
    invalidateQuality();
    scheduleHistoryAutosave();
    render();
  }

  function availableBriefPacks() {
    return state.aiBriefPacks.items.length ? state.aiBriefPacks.items : BRIEF_PACKS;
  }

  function briefPackOptions() {
    const packs = availableBriefPacks();
    if (!state.aiBriefPacks.items.length) {
      return [{ value: '', label: 'AI가 프로필을 보고 먼저 생성해야 합니다' }];
    }
    return packs.map(function (pack) {
      return { value: pack.value, label: pack.label };
    });
  }

  function currentBriefPack() {
    const value = field('aad-brief-pack', 'launch-premium');
    return availableBriefPacks().find(function (pack) { return pack.value === value; }) || availableBriefPacks()[0] || BRIEF_PACKS[0];
  }

  function briefPackDetail(pack) {
    return pack.detail || BRIEF_PACK_DETAILS[pack.value] || {};
  }

  function currentBriefDetail() {
    return briefPackDetail(currentBriefPack());
  }

  function briefPackGuideText() {
    const pack = currentBriefPack();
    const detail = briefPackDetail(pack);
    return [
      detail.target ? '타깃: ' + detail.target : '',
      detail.hook ? '훅: ' + detail.hook : '',
      detail.visual ? '비주얼: ' + detail.visual : '',
    ].filter(Boolean).join('\n') || '추천 세트를 고르면 주제, 목표, CTA, 길이, 씬 수, 스타일, VFX, 영화적 연출 방향이 한 번에 채워집니다.';
  }

  function featuredBriefPacks() {
    return state.aiBriefPacks.items.slice(0, AI_BRIEF_PACK_COUNT);
  }

  function briefGenerationButtonText(defaultText) {
    return state.aiBriefPacks.loading ? '작동중 · 3개 생성중' : defaultText;
  }

  function briefGenerationButtonClass() {
    if (state.aiBriefPacks.loading) return 'aad-loading-action';
    return state.aiBriefPacks.items.length ? '' : 'aad-next-action';
  }

  function isStoryboardBusy() {
    return !!state.busy && /콘티|스토리보드/.test(String(state.busy));
  }

  function isStoryboardGenerating() {
    return !!state.generating.storyboard;
  }

  function activeBriefSubStep() {
    const value = Number(state.briefSubStep || 1);
    return Math.max(1, Math.min(3, Number.isFinite(value) ? value : 1));
  }

  function setBriefSubStep(stepNo) {
    syncForm();
    state.briefSubStep = Math.max(1, Math.min(3, Number(stepNo) || 1));
    render();
    setTimeout(function () {
      const el = document.querySelector('.aad-brief-substeps') || document.querySelector('.aad-step-one-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function briefSubStepDone(stepNo) {
    if (stepNo === 1) {
      return !!(field('aad-user-intent', '').trim() || field('aad-source', '').trim() || field('aad-benchmark-url', '').trim());
    }
    if (stepNo === 2) {
      return !!(field('aad-use-profile', 'yes') || referenceImageGroups().persona.length);
    }
    if (stepNo === 3) {
      return state.aiBriefPacks.items.length >= AI_BRIEF_PACK_COUNT;
    }
    return false;
  }

  function renderBriefSubSteps() {
    const active = activeBriefSubStep();
    const steps = [
      { no: 1, title: '광고 입력', desc: '무엇을 광고할지와 소재를 적습니다' },
      { no: 2, title: '브랜드·모델 기준', desc: '프로필, 로고, 모델, 화면비를 정합니다' },
      { no: 3, title: 'AI 컨셉 선택', desc: '3개 추천안 중 콘티 기준을 고릅니다' },
    ];
    return '<div class="aad-brief-substeps">' + steps.map(function (step) {
      const cls = [step.no === active ? 'active' : '', briefSubStepDone(step.no) ? 'done' : '', step.no === active && !state.busy ? 'aad-next-action' : ''].filter(Boolean).join(' ');
      return '<button type="button" class="' + cls + '" onclick="aadSetBriefSubStep(' + step.no + ')"><strong>1-' + step.no + '</strong><b>' + esc(step.title) + '</b><span>' + esc(step.desc) + '</span></button>';
    }).join('') + '</div>';
  }

  function normalizeGeneratedBriefPack(raw, index) {
    const pack = raw && typeof raw === 'object' ? raw : {};
    const detail = pack.detail && typeof pack.detail === 'object' ? pack.detail : {};
    const value = String(pack.value || ('ai-brief-' + (index + 1))).trim() || ('ai-brief-' + (index + 1));
    return {
      value: value,
      label: String(pack.label || ('AI 추천안 ' + (index + 1))).trim(),
      topic: String(pack.topic || field('aad-topic', '쇼츠 광고')).trim(),
      objective: String(pack.objective || field('aad-objective', '브랜드 기억과 전환')).trim(),
      tone: String(pack.tone || field('aad-tone', '네이티브 쇼츠 톤')).trim(),
      cta: String(pack.cta || field('aad-cta', '브랜드 확인')).trim(),
      duration: Number(pack.duration || selectedDuration() || 30),
      scenes: Number(pack.scenes || numericField('aad-scene-count', DEFAULT_SCENE_COUNT)),
      style: String(pack.style || 'world-class-commercial').trim(),
      vfx: String(pack.vfx || 'cinematic-light-sweep').trim(),
      source: String(pack.source || '').trim(),
      story_arc: String(pack.story_arc || 'native-shorts-story').trim(),
      attention_hook: String(pack.attention_hook || 'purple-cow').trim(),
      hook_recipe: String(pack.hook_recipe || 'first-frame-shock').trim(),
      platform_playbook: String(pack.platform_playbook || 'native-hook-shorts').trim(),
      persona_type: String(pack.persona_type || 'brand-creator').trim(),
      generated: true,
      detail: {
        target: String(detail.target || '').trim(),
        hook: String(detail.hook || '').trim(),
        problem: String(detail.problem || '').trim(),
        proof: String(detail.proof || '').trim(),
        offer: String(detail.offer || '').trim(),
        scenes: Array.isArray(detail.scenes) ? detail.scenes.map(function (item) { return String(item || '').trim(); }).filter(Boolean) : [],
        visual: String(detail.visual || '').trim(),
        sound: String(detail.sound || '').trim(),
        overlay: String(detail.overlay || '').trim(),
        avoid: String(detail.avoid || '').trim(),
        purple_cow: String(detail.purple_cow || '').trim(),
        exception_rule: String(detail.exception_rule || '').trim(),
        plausibility: String(detail.plausibility || '').trim(),
        creativity: String(detail.creativity || '').trim(),
        emotional_appeal: String(detail.emotional_appeal || '').trim(),
        contagious_rule: String(detail.contagious_rule || '').trim(),
        success_formula: String(detail.success_formula || '').trim(),
        ontology_trace: String(detail.ontology_trace || '').trim(),
        selection_reason: String(detail.selection_reason || '').trim(),
      },
    };
  }

  function briefRecommendationPayload() {
    return {
      topic: field('aad-topic', '쇼츠 광고'),
      objective: field('aad-objective', '브랜드 기억과 전환'),
      tone: field('aad-tone', '네이티브 쇼츠 톤'),
      cta: field('aad-cta', '브랜드 확인'),
      duration: selectedDuration(),
      scene_count: numericField('aad-scene-count', DEFAULT_SCENE_COUNT),
      aspect: field('aad-aspect', '9:16'),
      production_mode: currentProductionMode().value,
      profile_context: compactPayloadValue(currentProfileContext() || {}, 900, 3),
      profile_prompt: compactPromptText(profileContextPrompt(), 1800),
      reference_context: compactPromptText(referenceContextPrompt(), 1400),
      benchmark_url: field('aad-benchmark-url', ''),
      benchmark_notes: compactPromptText(field('aad-benchmark-notes', ''), 900),
      source: compactPromptText([field('aad-user-intent', ''), field('aad-source', '')].filter(Boolean).join('\n\n'), 2400),
      story_arc: currentStoryArc(),
      attention_hook: currentAttentionHook(),
      semantic_structure: currentSemanticStructure(),
      success_ontology: successOntologyContext(),
      success_cases: successCaseContext(),
      exception_rule: currentExceptionRule(),
      creativity_rule: currentCreativityRule(),
      platform_playbook: currentPlatformPlaybook(),
      hook_recipe: currentHookRecipe(),
      model: field('aad-storyboard-model', state.modelSettings.text_model || 'gemini-2.5-flash'),
    };
  }

  function modelSettingLabel(kind) {
    const settings = state.modelSettings || {};
    const provider = String(settings[kind + '_provider'] || '').trim();
    const model = String(settings[kind + '_model'] || '').trim();
    if (state.modelSettings.loading) return '설정 불러오는 중';
    if (!model) return kind === 'text' ? '글쓰기 모델 미설정' : '이미지 모델 미설정';
    return [provider ? provider.toUpperCase() : '', model].filter(Boolean).join(' · ');
  }

  function renderModelSettingsBar() {
    return `
      <div class="aad-model-settings-bar">
        <div>
          <span>현재 설정</span>
          <b>글쓰기 모델</b>
          <strong>${esc(modelSettingLabel('text'))}</strong>
        </div>
        <div>
          <span>현재 설정</span>
          <b>그림 모델</b>
          <strong>${esc(modelSettingLabel('image'))}</strong>
        </div>
        <button type="button" onclick="aadLoadModelSettings()">새로고침</button>
      </div>
    `;
  }

  function renderSuccessCaseLearningPanel() {
    const items = state.successCases.items || [];
    const saving = state.successCases.saving;
    const learnedNodes = successOntologyItems().filter(function (item) {
      return String(item.slug || '').indexOf('learned-') === 0;
    }).length;
    const itemList = items.length
      ? items.slice(0, 6).map(function (item) {
        const nodes = Array.isArray(item.nodes) ? item.nodes.length : 0;
        return '<article><b>' + esc(item.title || '성공 광고 사례') + '</b><span>' + esc(compactText(item.summary || item.source_url || item.notes, 130)) + '</span><em>저장 노드 ' + nodes + '개</em></article>';
      }).join('')
      : '<div class="aad-empty-inline">아직 학습한 성공 광고 사례가 없습니다.</div>';
    return `
      <div class="aad-success-learning">
        <div class="aad-success-learning-head">
          <div>
            <b>성공 광고 사례 학습</b>
            <span>성공한 쇼츠/릴스 사례를 넣으면 AI가 성공 방정식 노드를 추출해 DB에 저장하고 다음 1단계 컨셉에 반영합니다.</span>
          </div>
          <button type="button" class="${saving ? 'aad-loading-action' : 'aad-next-action'}" onclick="aadLearnSuccessCase()"${saving ? ' disabled' : ''}>${saving ? '작동중 · 온톨로지 추출중' : '사례 분석해서 DB 저장'}</button>
        </div>
        ${saving ? '<div class="aad-step-loading compact"><span class="spinner"></span><div><b>작동중 · 성공 광고 온톨로지 추출중</b><p>훅, 감정 전환, 개연성, 기억 앵커, 공유 장치를 노드로 분해하고 있습니다.</p></div></div>' : ''}
        <div class="aad-success-learning-grid">
          <label>사례 제목<input id="aad-success-case-title" value="${formValue('aad-success-case-title', '')}" placeholder="예: 댓글이 폭발한 릴스 광고"></label>
          <label>성공 광고 URL<input id="aad-success-case-url" value="${formValue('aad-success-case-url', '')}" placeholder="Instagram Reels, YouTube Shorts, TikTok URL"></label>
          <label class="wide">성공 이유/관찰<textarea id="aad-success-case-notes" rows="3" placeholder="첫 1초 훅, 반전, 댓글 포인트, 컷 리듬, 마지막 브랜드 처리 등">${formValue('aad-success-case-notes', '')}</textarea></label>
          <label class="wide">원문/스크립트/장면 메모<textarea id="aad-success-case-raw" rows="4" placeholder="영상 내용을 직접 적거나 캡션/댓글/장면 분석을 붙여넣으세요.">${formValue('aad-success-case-raw', '')}</textarea></label>
        </div>
        <div class="aad-success-learning-meta">
          <span>학습 사례 ${items.length}개</span>
          <span>추출 노드 ${learnedNodes}개</span>
          <button type="button" onclick="aadLoadSuccessCases()"${state.successCases.loading ? ' disabled' : ''}>${state.successCases.loading ? '불러오는 중' : '학습 이력 새로고침'}</button>
        </div>
        ${state.successCases.error ? '<div class="aad-inline-error">' + esc(state.successCases.error) + '</div>' : ''}
        <div class="aad-success-case-list">${itemList}</div>
      </div>
    `;
  }

  function renderBenchmarkLibraryModal() {
    if (!state.benchmarkLibrary.open) return '';
    const categories = benchmarkCategories();
    const items = filteredBenchmarkAds();
    const analyzing = !!state.benchmarkLibrary.analyzingURL;
    return `
      <div class="aad-benchmark-backdrop" onclick="if(event.target===this)aadCloseBenchmarkModal()">
        <section class="aad-benchmark-modal">
          <div class="aad-benchmark-head">
            <div>
              <b>글로벌 광고 레퍼런스</b>
              <h3>유명 광고를 고르면 벤치마킹 구조로 바로 시작합니다</h3>
              <span>준비된 YouTube 검색 링크 ${state.benchmarkLibrary.items.length}개와 직접 붙여넣은 영상 URL을 분석해 훅, 리듬, 감정 전환, 마지막 브랜드 타이밍만 가져옵니다.</span>
            </div>
            <button type="button" onclick="aadCloseBenchmarkModal()">닫기</button>
          </div>
          <div class="aad-benchmark-direct">
            <label>실제 YouTube 영상 URL<input id="aad-benchmark-modal-url" value="${esc(field('aad-benchmark-url', ''))}" placeholder="YouTube watch/shorts/youtu.be URL을 붙여넣으면 실시간 분석합니다."></label>
            <button type="button" class="${analyzing ? 'aad-loading-action' : 'aad-next-action'}" onclick="aadAnalyzeBenchmarkModalURL()"${analyzing ? ' disabled' : ''}>${analyzing ? '분석중...' : '이 URL 분석해서 적용'}</button>
          </div>
          <div class="aad-benchmark-tabs">
            ${categories.map(function (category) {
              const active = (state.benchmarkLibrary.filter || 'all') === category ? ' active' : '';
              const label = category === 'all' ? '전체' : category;
              return '<button type="button" class="' + active + '" onclick="aadSetBenchmarkFilter(\'' + esc(category) + '\')">' + esc(label) + '</button>';
            }).join('')}
          </div>
          ${state.benchmarkLibrary.loading ? '<div class="aad-step-loading compact"><span class="spinner"></span><div><b>작동중 · 레퍼런스 링크 불러오는 중</b><p>설치형 JSON 라이브러리에서 글로벌 광고 후보를 준비합니다.</p></div></div>' : ''}
          ${state.benchmarkLibrary.error ? '<div class="aad-inline-error">' + esc(state.benchmarkLibrary.error) + '</div>' : ''}
          <div class="aad-benchmark-list">
            ${items.map(function (item) {
              const canAnalyze = isPlayableYouTubeURL(item.youtube_url);
              return `
                <article>
                  <div>
                    <b>${esc([item.brand, item.campaign].filter(Boolean).join(' · ') || '광고 레퍼런스')}</b>
                    <span>${esc([item.category, item.emotion, item.year].filter(Boolean).join(' / '))}</span>
                  </div>
                  <p>${esc(compactText(item.notes || item.pattern || item.link_type, 160))}</p>
                  <em>${esc(item.link_type || 'YouTube')}</em>
                  <div class="aad-benchmark-actions">
                    <a href="${esc(item.youtube_url)}" target="_blank" rel="noreferrer">YouTube 열기</a>
                    <button type="button" onclick="aadApplyBenchmarkAd(${item.index}, false)">구조 적용</button>
                    <button type="button" onclick="aadApplyBenchmarkAd(${item.index}, true)"${canAnalyze ? '' : ' disabled title="검색 링크는 YouTube에서 실제 영상 URL을 연 뒤 붙여넣어 분석하세요."'}>${canAnalyze ? '실시간 분석' : 'URL 필요'}</button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;
  }

  async function loadModelSettings() {
    state.modelSettings.loading = true;
    try {
      const config = await apiRequestJSON('/api/config');
      const models = config.MODELS || {};
      state.modelSettings = {
        loading: false,
        text_provider: models.text_provider || '',
        text_model: models.text_model || '',
        image_provider: models.image_provider || '',
        image_model: models.image_model || '',
      };
      const currentStoryboard = String(state.form['aad-storyboard-model'] || '').trim();
      if (models.text_model && (!currentStoryboard || currentStoryboard === 'gemini-3.1-pro-preview' || currentStoryboard === 'gemini-3.1-flash-preview')) {
        state.form['aad-storyboard-model'] = models.text_model;
      }
      const currentImage = String(state.form['aad-image-model'] || '').trim();
      if (models.image_model && (!currentImage || currentImage === 'gemini-3.1-flash-image-preview')) {
        state.form['aad-image-model'] = models.image_model;
      }
    } catch (err) {
      state.modelSettings.loading = false;
      addLog('모델 설정 표시 실패: ' + err.message, 'error');
    }
    render();
  }

  async function generateBriefRecommendations() {
    if (state.aiBriefPacks.loading) return;
    syncForm();
    state.aiBriefPacks.loading = true;
    state.aiBriefPacks.error = '';
    setBusy('작동중 · AI 광고 컨셉 3개 생성중');
    addLog('AI 광고 세트 생성 시작 · 브랜드/소재/온톨로지/벤치마크 조건을 보냈습니다.', 'info', { persist: false });
    render();
    try {
      const data = await apiJSON('/api/animation-ad/recommend-brief-packs', briefRecommendationPayload());
      const items = Array.isArray(data.items) ? data.items.map(normalizeGeneratedBriefPack).filter(function (pack) {
        return pack.label && pack.source;
      }).slice(0, AI_BRIEF_PACK_COUNT) : [];
      if (items.length < AI_BRIEF_PACK_COUNT) throw new Error('AI 추천 광고 세트가 3개보다 적습니다.');
      state.aiBriefPacks.items = items;
      state.aiBriefPacks.generatedAt = data.generated_at || new Date().toISOString();
      setInput('aad-brief-pack', items[0].value);
      applyBriefPack(items[0].value, { silent: true });
      addLog('AI 응답 검토 완료 · 3개 컨셉 모두 퍼플카우/예외성/개연성/감정호소 조건을 통과했습니다.', 'success');
      addLog('프로필 기반 AI 광고 세트 3개 생성 완료 · ' + (data.model || 'Gemini'), 'success');
      scheduleHistoryAutosave();
    } catch (err) {
      const detail = describeBriefGenerationError(err);
      state.aiBriefPacks.error = detail.message;
      addLog('AI 광고 세트 생성 실패 · ' + detail.message, 'error');
      if (detail.cause) addLog('실패 원인 · ' + detail.cause, 'error', { persist: false });
      if (detail.next) addLog('다음 행동 · ' + detail.next, 'info', { persist: false });
      alert('AI 광고 세트 생성 실패: ' + detail.message);
    } finally {
      state.aiBriefPacks.loading = false;
      setBusy('');
      render();
    }
  }

  function describeBriefGenerationError(err) {
    const message = String(err?.message || '알 수 없는 오류').trim();
    const raw = compactText(err?.data?.raw || '', 260);
    if (/3개보다 적습니다|0개|광고 세트 목록/.test(message)) {
      return {
        message: message,
        cause: raw ? 'AI 응답 일부: ' + raw : 'AI 응답을 3개 광고 컨셉 목록으로 읽지 못했습니다.',
        next: '응답 해석기를 넓혔으니 같은 입력으로 다시 3개 생성을 눌러주세요.',
      };
    }
    if (/timeout|deadline|504|awaiting headers/i.test(message)) {
      return {
        message: message,
        cause: '모델 서버 응답이 제한 시간 안에 도착하지 않았습니다.',
        next: '소재 입력을 조금 줄이거나 잠시 뒤 다시 생성하세요. 진행 상태는 로그에 남습니다.',
      };
    }
    if (/model|not found|CLI|키|API/i.test(message)) {
      return {
        message: message,
        cause: '현재 선택된 글쓰기 모델 또는 API 키 설정을 확인해야 합니다.',
        next: '상단 현재 설정의 글쓰기 모델을 Gemini/Atlas 글쓰기 모델로 바꾼 뒤 다시 시도하세요.',
      };
    }
    return {
      message: message,
      cause: raw ? '서버 응답 일부: ' + raw : '',
      next: '최근 작업 로그의 바로 위 원인을 확인하고 같은 단계에서 다시 시도하세요.',
    };
  }

  function valueHasAny(value, names) {
    return names.some(function (name) { return value.indexOf(name) >= 0; });
  }

  function storyArcForPack(value) {
    if (valueHasAny(value, ['story-brain', 'film', 'micro-quest', 'creator-confession', 'rescue-moment', 'customer-pov', 'behind-scenes'])) return 'human-mini-drama';
    if (valueHasAny(value, ['problem', 'pov-crisis', 'time-pressure', 'mystery-reveal'])) return 'problem-thriller';
    if (valueHasAny(value, ['asmr-ritual', 'sensory-loop', 'object-hero', 'luxury-drop'])) return 'sensory-product-film';
    if (valueHasAny(value, ['proof', 'staged-experiment', 'myth-bust', 'before-after-judge'])) return 'social-proof-docu';
    return 'cinematic-trailer';
  }

  function attentionHookForPack(value) {
    if (valueHasAny(value, ['purple-cow', 'object-hero', 'mystery-reveal', 'taboo-reversal', 'surreal-metaphor'])) return 'purple-cow';
    if (valueHasAny(value, ['story-brain', 'micro-quest', 'creator-confession', 'rescue-moment', 'customer-pov', 'behind-scenes'])) return 'story-brain';
    if (valueHasAny(value, ['comedy', 'fail-compilation', 'absurd-scale', 'comment-bait'])) return 'comedy-twist';
    if (valueHasAny(value, ['asmr-ritual', 'sensory-loop', 'beauty-glow', 'luxury-drop'])) return 'sensual-premium';
    if (valueHasAny(value, ['staged-experiment', 'rival-duel', 'myth-bust', 'before-after-judge'])) return 'provocative-challenge';
    if (valueHasAny(value, ['event-burst'])) return 'meme-chaos';
    return 'cinematic-tension';
  }

  function hookRecipeForPack(value) {
    if (valueHasAny(value, ['problem', 'pov-crisis', 'time-pressure', 'rescue-moment', 'myth-bust'])) return 'problem-open-loop';
    if (valueHasAny(value, ['transform', 'before-after-judge', 'rival-duel'])) return 'before-after-satisfaction';
    if (valueHasAny(value, ['story-brain', 'creator-confession', 'customer-pov', 'behind-scenes'])) return 'creator-reaction';
    if (valueHasAny(value, ['event-burst', 'food-sizzle', 'asmr-ritual', 'sensory-loop'])) return 'sound-hit-transition';
    if (valueHasAny(value, ['mystery-reveal', 'comment-bait'])) return 'loop-reversal';
    return 'first-frame-shock';
  }

  function renderBriefPackCards() {
    const current = field('aad-brief-pack', 'launch-premium');
    const packs = featuredBriefPacks();
    if (state.aiBriefPacks.loading) {
      return `
        <div class="aad-pack-panel aad-pack-empty">
          <div class="aad-pack-panel-head">
            <div>
              <b>STEP 1 핵심 · AI 광고 컨셉 생성</b>
              <span>브랜드 프로필을 읽고 퍼플카우, 예외성, 개연성, 창조성을 동시에 만족하는 쇼츠 광고 세트 3개를 만드는 중입니다.</span>
            </div>
          </div>
          <div class="aad-pack-loading"><b>작동중 · 3개 생성중</b><span>AI 크리에이티브 디렉터가 1단계 광고 컨셉을 설계하고 있습니다.</span></div>
        </div>
      `;
    }
    if (!packs.length) {
      return `
        <div class="aad-pack-panel aad-pack-empty">
          <div class="aad-pack-panel-head">
            <div>
              <b>STEP 1 핵심 · AI 광고 컨셉 생성</b>
              <span>미리 정한 카드가 아니라 현재 프로필, 브랜드 색상, 서비스 설명, 디자인 규칙, 참고 이미지를 보고 매번 새 광고 세트 3개를 생성합니다.</span>
            </div>
            <button type="button" onclick="aadGenerateBriefRecommendations()">프로필 보고 3개 생성</button>
          </div>
          <div class="aad-creative-rule-grid">
            <div><b>퍼플카우</b><span>스크롤을 멈추게 하는 낯선 첫 장면</span></div>
            <div><b>예외성</b><span>업종 클리셰를 깨는 비틀림</span></div>
            <div><b>개연성</b><span>왜 이 브랜드라 가능한지 설명되는 연결</span></div>
            <div><b>창조성</b><span>멀리 떨어진 의미를 제품 진실로 묶는 구조</span></div>
            <div><b>감정호소</b><span>웃음, 놀람, 긴장, 욕망, 안도 중 어떤 감정을 누를지 지정</span></div>
            <div><b>입소문 6원리</b><span>소셜 화폐, 계기, 감정, 공개성, 실용, 이야기 중 공유 장치 선택</span></div>
          </div>
          ${state.aiBriefPacks.error ? '<div class="aad-pack-error">' + esc(state.aiBriefPacks.error) + '</div>' : ''}
        </div>
      `;
    }
    return `
      <div class="aad-pack-panel">
        <div class="aad-pack-panel-head">
          <div>
            <b>AI 추천 광고 세트</b>
            <span>현재 브랜드 프로필을 보고 AI가 방금 생성한 3개입니다. 각 세트는 퍼플카우·예외성·개연성·창조성·감정호소·입소문 원리를 함께 가져야 합니다.</span>
          </div>
          <button type="button" onclick="aadGenerateBriefRecommendations()">AI로 다시 생성</button>
        </div>
        <div class="aad-pack-grid">
        ${packs.map(function (pack) {
          const detail = briefPackDetail(pack);
          const active = pack.value === current ? ' active' : '';
          return `
            <button type="button" class="aad-pack-card${active}" onclick="aadApplyBriefPack('${esc(pack.value)}')">
              <strong>${esc(pack.label)}</strong>
              <span>${esc(detail.hook || detail.purple_cow || pack.source || '')}</span>
              <em>${esc(pack.duration)}초 · ${esc(pack.scenes)}씬</em>
            </button>
          `;
        }).join('')}
        </div>
      </div>
    `;
  }

  function renderBriefPackSelect() {
    const disabled = state.aiBriefPacks.items.length ? '' : ' disabled';
    return `
      <label class="wide aad-select-with-guide">AI 추천 광고 세트
        <div>
          <select id="aad-brief-pack" onchange="aadApplyBriefPack(this.value)"${disabled}>${optionTags(briefPackOptions(), state.form['aad-brief-pack'])}</select>
          <span id="aad-brief-pack-guide">${esc(briefPackGuideText())}</span>
        </div>
      </label>
    `;
  }

  function renderSelectedBriefPackInsight() {
    if (!state.aiBriefPacks.items.length) return '';
    const pack = currentBriefPack();
    const detail = briefPackDetail(pack);
    return `
      <div class="aad-selected-brief">
        <div>
          <b>${esc(pack.label)}</b>
          <span>${esc(detail.selection_reason || '현재 브랜드 프로필 기준으로 AI가 선택한 광고 컨셉입니다.')}</span>
        </div>
        <div class="aad-selected-brief-grid">
          <section><strong>퍼플카우</strong><p>${esc(detail.purple_cow || detail.hook || '첫 프레임에서 멈추게 할 낯선 장면')}</p></section>
          <section><strong>예외성</strong><p>${esc(detail.exception_rule || '업종 클리셰를 깨는 장면 규칙')}</p></section>
          <section><strong>개연성</strong><p>${esc(detail.plausibility || '브랜드/상품 진실과 이상한 장면의 연결')}</p></section>
          <section><strong>창조성</strong><p>${esc(detail.creativity || '멀리 떨어진 의미를 묶는 발상')}</p></section>
          <section><strong>감정호소</strong><p>${esc(detail.emotional_appeal || '웃음, 놀람, 긴장, 욕망, 안도 중 하나의 감정 버튼')}</p></section>
          <section><strong>입소문 6원리</strong><p>${esc(detail.contagious_rule || '소셜 화폐, 계기, 감정, 공개성, 실용적 가치, 이야기 중 공유 이유')}</p></section>
          <section><strong>성공 방정식</strong><p>${esc(detail.success_formula || '스크롤 정지, 감정 전환, 제품 진실, 기억 앵커, 공유 이유를 연결')}</p></section>
          <section><strong>온톨로지 추론</strong><p>${esc(detail.ontology_trace || '왜 이 조합이 현재 브랜드와 소재에서 작동하는지 추론')}</p></section>
        </div>
      </div>
    `;
  }

  function buildBriefPackSource(pack) {
    const detail = briefPackDetail(pack);
    const sceneLines = (detail.scenes || []).map(function (item, index) {
      return (index + 1) + '. ' + item;
    }).join('\n');
    return [
      '[AI 추천 광고 세트: ' + pack.label + ']',
      '기본 메모: ' + (pack.source || ''),
      '',
      '[영화 수준 애니메이션 광고 연출]',
      '- 모든 씬은 실제 영화 프리프로덕션처럼 카메라 블로킹, 렌즈, 조명, 미술, 피사체 동선, 컷 리듬, 사운드 디자인을 구체화한다.',
      '- 한 씬 안에서도 최소 5개 마이크로 컷으로 나누고, 각 컷은 시작 프레임, 움직임, 디테일, 감정 피크, 전환 목적이 달라야 한다.',
      '- 이미지 픽셀 안에는 글자, 자막, 가격, 버튼, 가짜 로고를 만들지 않는다. 브랜드명은 마지막 컷에서만 HyperFrames HTML 레이어로 최소 표시한다.',
      '- 선택한 영상 모델에는 시작 이미지 정체성 유지, 자연스러운 카메라 움직임, 물성 유지, 텍스트 생성 금지를 강하게 지시한다.',
      '- 광고는 제품 칭찬이 아니라 볼거리가 있는 사건이어야 한다. 갈등, 반전, 웃긴 리액션, 관능적인 무드, 증거 장면 중 선택한 훅을 컷마다 반영한다.',
      '- 노골적인 성적 표현은 금지하고, 섹시한 무드는 프리미엄 조명, 질감, 시선, 손동작, 속도감으로만 안전하게 만든다.',
      '',
      detail.target ? '[타깃]\n' + detail.target : '',
      detail.hook ? '[첫 1초 훅]\n' + detail.hook : '',
      detail.problem ? '[고객 문제]\n' + detail.problem : '',
      detail.proof ? '[증거/신뢰 설계]\n' + detail.proof : '',
      detail.offer ? '[오퍼/전환]\n' + detail.offer : '',
      sceneLines ? '[추천 씬 아크]\n' + sceneLines : '',
      detail.visual ? '[비주얼 디렉션]\n' + detail.visual : '',
      detail.sound ? '[사운드 디자인]\n' + detail.sound : '',
      detail.overlay ? '[마지막 브랜드 마감 참고]\n' + detail.overlay : '',
      detail.purple_cow ? '[퍼플카우]\n' + detail.purple_cow : '',
      detail.exception_rule ? '[예외성]\n' + detail.exception_rule : '',
      detail.plausibility ? '[개연성]\n' + detail.plausibility : '',
      detail.creativity ? '[창조성]\n' + detail.creativity : '',
      detail.emotional_appeal ? '[감정호소]\n' + detail.emotional_appeal : '',
      detail.contagious_rule ? '[전략적 입소문 6원리]\n' + detail.contagious_rule : '',
      detail.success_formula ? '[성공 방정식]\n' + detail.success_formula : '',
      detail.ontology_trace ? '[온톨로지 추론 경로]\n' + detail.ontology_trace : '',
      detail.selection_reason ? '[브랜드 추천 이유]\n' + detail.selection_reason : '',
      detail.avoid ? '[금지/주의]\n' + detail.avoid : '',
    ].filter(Boolean).join('\n');
  }

  function beginnerImageBlueprint() {
    const detail = briefPackDetail(currentBriefPack());
    const scenes = Array.isArray(detail.scenes) && detail.scenes.length ? detail.scenes : ['오프닝 훅', '문제/욕구', '증거 컷', 'CTA 마무리'];
    const modeLabel = currentProductionMode().label.replace(' 광고', '');
    return scenes.slice(0, 5).map(function (scene, index) {
      const role = ['훅 이미지', '문제 이미지', '증거 이미지', '전환 이미지', 'CTA 이미지'][index] || ('컷 이미지 ' + (index + 1));
      return {
        role: role,
        shot: scene,
        guide: modeLabel + ' 기준으로 피사체, 배경, 조명, 카메라, 소품을 AI가 정합니다.',
      };
    });
  }

  function renderBeginnerDirectorPanel() {
    const pack = currentBriefPack();
    const detail = briefPackDetail(pack);
    const aspect = currentAspectSpec();
    const items = beginnerImageBlueprint();
    const arc = currentStoryArc();
    const hook = currentAttentionHook();
    const platform = currentPlatformPlaybook();
    const recipe = currentHookRecipe();
    const persona = currentPersona();
    return `
      <div class="aad-beginner-panel">
        <div class="aad-beginner-head">
          <div>
            <span>AI 광고 에이전트</span>
            <b>${esc(pack.label)}</b>
          </div>
          <div class="aad-beginner-actions">
            <button type="button" onclick="aadBeginnerAutoSet()">AI 추천안 적용</button>
            <button type="button" onclick="aadBeginnerOneClick()">콘티까지 제작</button>
          </div>
        </div>
        <div class="aad-director-grid">
          <div><b>광고 구조</b><span>${esc(detail.hook || pack.source || '첫 장면 훅과 마지막 브랜드 기억을 선명하게 잡습니다.')}</span></div>
          <div><b>서사 방식</b><span>${esc(arc.label + ' · ' + arc.guide)}</span></div>
          <div><b>시선 훅</b><span>${esc(hook.label + ' · ' + hook.guide)}</span></div>
          <div><b>플랫폼 기준</b><span>${esc(platform.label + ' · ' + platform.guide)}</span></div>
          <div><b>후킹 레시피</b><span>${esc(recipe.label + ' · ' + recipe.guide)}</span></div>
          <div><b>고정 페르소나</b><span>${esc(persona.label + ' · ' + persona.guide)}</span></div>
          <div><b>영상 프레임</b><span>${esc(aspect.label + ' · ' + aspect.size)}</span></div>
          <div><b>비주얼 톤</b><span>${esc(detail.visual || currentAnimationStyle().guide)}</span></div>
          <div><b>음향 방향</b><span>${esc(detail.sound || '영상 API가 BGM과 SFX를 컷 움직임과 함께 자연스럽게 만들고, 최종 렌더에서 나레이션을 합성합니다.')}</span></div>
          <div><b>컷 선별</b><span>${esc('사건이 있는 훅, 반전, 리액션, 증거, 감정 피크, 브랜드 각인 컷을 우선으로 뽑고 30초는 8~12개만 영상화합니다.')}</span></div>
          <div><b>상용 기준</b><span>${esc('제품 자랑 반복 금지, 이미지 안 텍스트 금지, 중간 자막 금지, 마지막 브랜드와 나레이션 호흡을 검사합니다.')}</span></div>
        </div>
        <div class="aad-image-blueprint">
          ${items.map(function (item) {
            return '<div><strong>' + esc(item.role) + '</strong><b>' + esc(item.shot) + '</b><span>' + esc(item.guide) + '</span></div>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderGlobalPlatformIdeas() {
    const ideas = [
      ['URL/소재 빠른 광고화', 'Creatify식으로 상품 링크나 소재 설명에서 제품 포인트, 스크립트, 컷 구성을 빠르게 뽑습니다.'],
      ['브랜드킷 고정', 'HeyGen식으로 프로필 색상, 로고/공간/상품 reference, 톤을 모든 컷에 유지합니다.'],
      ['스토리보드 우선 제작', 'LTX Studio식으로 스크립트, 샷리스트, 콘티, 러프컷 순서로 제작 흐름을 잡습니다.'],
      ['레퍼런스/VFX 일관성', 'Runway식으로 캐릭터, 제품, 조명, 카메라, VFX 위치를 컷마다 명시합니다.'],
      ['대량 변형 테스트', '같은 구조에서 훅, CTA, 톤, 비율을 바꿔 여러 광고 세트를 만들 수 있게 확장합니다.'],
      ['컷별 재생성', '한 장면이 재미없으면 전체를 다시 뽑지 않고 해당 컷의 훅, 이미지, 영상 프롬프트만 고쳐 다시 만듭니다.'],
      ['첫 3초 설계', '릴스/쇼츠식으로 첫 프레임부터 문제, 반전, 사람 리액션, 상품 단서를 보여주고 느린 로고 인트로를 피합니다.'],
      ['ABCD 점검', 'YouTube식으로 주목, 브랜드 기억, 감정 연결, 다음 행동을 콘티와 최종 렌더에서 함께 검사합니다.'],
      ['Instagram Reels 최적화', '9:16, 오디오, 핵심 요소 safe zone, 크리에이터형 자연스러움을 함께 검사합니다.'],
      ['YouTube Shorts 최적화', '10~30초 액션형, vertical, sound-on, organic blend, creator asset 느낌을 우선합니다.'],
      ['Top Ads 참고 분석', '틱톡식 초 단위·프레임 단위 피크는 보조 참고로만 쓰고 장면 전환과 사운드 히트 타이밍을 콘티에 적습니다.'],
      ['벤치마크 URL', '잘 된 릴스/쇼츠 광고 URL을 넣으면 원본을 베끼지 않고 훅 구조, 컷 리듬, 마지막 브랜드 타이밍만 분석해 새 광고로 재구성합니다.'],
      ['바이럴 루프', '마지막 컷이 첫 컷으로 이어지거나 댓글을 부르는 반전/질문을 남겨 다시 보게 만드는 구조를 설계합니다.'],
    ];
    return `
      <div class="aad-global-ideas">
        <div class="aad-global-head">
          <b>릴스/쇼츠 광고 공식</b>
          <span>Instagram Reels · YouTube Shorts 공식과 상용 광고 제작 플랫폼 흐름을 마케케 방식으로 결합합니다.</span>
        </div>
        <div class="aad-global-grid">
          ${ideas.map(function (item) {
            return '<div><b>' + esc(item[0]) + '</b><span>' + esc(item[1]) + '</span></div>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function uniqueOptions(key) {
    const seen = new Set();
    return BRIEF_PACKS.map(function (pack) {
      return { value: pack[key], label: pack[key] };
    }).filter(function (option) {
      if (!option.value || seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }

  function profileText(profile, keys) {
    for (let i = 0; i < keys.length; i++) {
      const value = profile && profile[keys[i]];
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function profileImageValues(profile, keys) {
    const values = [];
    const push = function (value) {
      if (Array.isArray(value)) {
        value.forEach(push);
        return;
      }
      if (value && typeof value === 'object') {
        push(value.url || value.image_url || value.src || value.path || value.filename || value.file_name);
        return;
      }
      if (typeof value === 'string' && value.trim()) {
        try {
          if (/^\s*\[/.test(value)) {
            JSON.parse(value).forEach(push);
            return;
          }
        } catch {}
        values.push(value.trim());
      }
    };
    keys.forEach(function (key) { push(profile && profile[key]); });
    return values;
  }

  function absoluteProfileAssetURL(value, profileID) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:|\/api\/|\/static\/|\/output\/)/i.test(raw)) return raw;
    if (profileID > 0) return '/api/library/image/' + encodeURIComponent(profileID) + '/' + encodeURIComponent(raw);
    return raw;
  }

  function uniqueStrings(items) {
    const seen = new Set();
    return (items || []).map(function (item) { return String(item || '').trim(); }).filter(function (item) {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  function currentProfileContext() {
    if (field('aad-use-profile', 'yes') !== 'yes') return null;
    const profile = window._globalProfileData || {};
    const profileID = Number(window._globalProfileId || profile.id || 0) || 0;
    const useLogo = field('aad-use-profile-logo', 'yes') !== 'no';
    const brand = profileText(profile, ['name', 'brand_name', 'business_name', 'company_name', 'title']);
    const colors = profileText(profile, ['brand_color', 'brand_colors', 'main_color', 'primary_color']);
    const business = [
      profileText(profile, ['business_type', 'biz_type', 'industry', 'category', 'type']),
      profileText(profile, ['business_goal', 'goal']),
      profileText(profile, ['biz_detail', 'business_detail', 'description', 'intro', 'about', 'memo', 'profile_memo']),
    ].filter(Boolean).join(' / ');
    const service = profileText(profile, ['service_description', 'service_detail', 'product_or_service', 'offer_description']);
    const designRules = profileText(profile, ['design_rules', 'design_rule', 'brand_design_rules', 'brand_guide', 'design_guide']);
    const rawLogoURL = absoluteProfileAssetURL(profileText(profile, ['logo_url', 'brand_logo_url', 'profile_logo_url', 'logo_path', 'brand_logo', 'logo']), profileID);
    const logoURL = useLogo ? rawLogoURL : '';
    const imageURLs = uniqueStrings(profileImageValues(profile, ['image_urls', 'brand_image_urls', 'images', 'images_json']).map(function (item) {
      return absoluteProfileAssetURL(item, profileID);
    }));
    if (!brand && !colors && !business && !service && !designRules && !logoURL && !imageURLs.length) return null;
    return {
      profile_id: profileID,
      brand: brand,
      colors: colors,
      business: business,
      service: service,
      design_rules: designRules,
      logo_reference_enabled: useLogo,
      raw_logo_url: rawLogoURL,
      logo_url: logoURL,
      image_urls: imageURLs,
    };
  }

  function profileContextText() {
    const ctx = currentProfileContext();
    if (!ctx) return '프로필 브랜드 정보를 사용하지 않거나 불러온 정보가 없습니다.';
    return [
      ctx.brand ? '브랜드: ' + ctx.brand : '',
      ctx.colors ? '색상: ' + ctx.colors : '',
      ctx.business ? '비즈니스: ' + ctx.business : '',
      ctx.service ? '서비스: ' + ctx.service : '',
      ctx.design_rules ? '디자인 규칙: ' + ctx.design_rules : '',
      ctx.logo_url ? '프로필 로고: 사용' : '',
      ctx.raw_logo_url && !ctx.logo_reference_enabled ? '프로필 로고: 참조 안 함' : '',
      ctx.image_urls?.length ? '프로필 브랜드 이미지: ' + ctx.image_urls.length + '장' : '',
    ].filter(Boolean).join('\n');
  }

  function profileContextPrompt() {
    const text = profileContextText();
    return text && !/^프로필 브랜드/.test(text) ? text : '';
  }

  function brandAccentColor() {
    const ctx = currentProfileContext();
    const match = String(ctx?.colors || '').match(/#[0-9a-fA-F]{6}\b/);
    return match ? match[0] : '#ff8c00';
  }

  function sampleVisualUrl(sceneIndex, cutIndex) {
    const accent = brandAccentColor();
    const palettes = [
      ['#07111f', accent, '#f8fafc'],
      ['#081a2b', '#0ea5e9', '#f59e0b'],
      ['#111827', '#22c55e', '#f8fafc'],
      ['#140f2d', '#a855f7', accent],
    ];
    const palette = palettes[sceneIndex % palettes.length];
    const shapeX = 160 + ((sceneIndex * 97 + cutIndex * 41) % 720);
    const shapeY = 280 + ((sceneIndex * 53 + cutIndex * 89) % 980);
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">',
      '<defs>',
      '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + palette[0] + '"/><stop offset=".54" stop-color="' + palette[1] + '"/><stop offset="1" stop-color="#020617"/></linearGradient>',
      '<radialGradient id="glow" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="' + palette[2] + '" stop-opacity=".9"/><stop offset=".36" stop-color="' + palette[1] + '" stop-opacity=".34"/><stop offset="1" stop-color="' + palette[0] + '" stop-opacity="0"/></radialGradient>',
      '</defs>',
      '<rect width="1080" height="1920" fill="url(#bg)"/>',
      '<circle cx="' + shapeX + '" cy="' + shapeY + '" r="' + (260 + cutIndex * 22) + '" fill="url(#glow)"/>',
      '<path d="M80 ' + (420 + cutIndex * 70) + ' C 340 ' + (260 + sceneIndex * 80) + ', 690 ' + (760 + cutIndex * 36) + ', 1000 ' + (540 + sceneIndex * 92) + '" fill="none" stroke="' + palette[2] + '" stroke-opacity=".22" stroke-width="18"/>',
      '<path d="M-40 ' + (1180 - cutIndex * 44) + ' C 260 ' + (960 + sceneIndex * 30) + ', 620 ' + (1480 - cutIndex * 52) + ', 1120 ' + (1200 + sceneIndex * 48) + '" fill="none" stroke="' + palette[1] + '" stroke-opacity=".35" stroke-width="26"/>',
      '<rect x="' + (170 + sceneIndex * 38) + '" y="' + (980 + cutIndex * 38) + '" width="720" height="360" rx="64" fill="#ffffff" opacity=".08"/>',
      '<rect x="' + (230 + cutIndex * 18) + '" y="' + (1040 + sceneIndex * 42) + '" width="520" height="210" rx="48" fill="#ffffff" opacity=".14"/>',
      '</svg>',
    ].join('');
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function sampleStoryboardMeta() {
    const profile = currentProfileContext();
    const brand = profile?.brand || '마케케 테스트 브랜드';
    const hook = currentAttentionHook();
    return normalizeStoryboardMeta({
      creative_field: {
        name: brand + ' 광고 중심장',
        core: '설명보다 사건으로 멈추게 하고 마지막에 브랜드만 남기는 쇼츠 광고 구조',
        tension: '평범한 업무/일상 흐름이 1초 만에 막히는 압박',
        desire: '복잡한 일이 한 번에 정리되는 안도와 통제감',
        exception: hook.label + '로 업종 클리셰를 깨는 첫 장면',
        gravity: brand + '라서 복잡한 마케팅 흐름을 한곳으로 당겨 정리할 수 있다는 개연성',
        mass_rule: '문제를 말로 설명하는 컷보다 멈춤, 충돌, 리액션, 전환, 각인을 가진 컷에 더 큰 질량을 준다',
      },
      selection_strategy: '각 씬의 대표 사건 컷을 먼저 고르고, 중심장 결합값과 컷 다양성으로 실제 영상화 컷을 선별한다.',
      selection_criteria: [
        { name: '중심장 결합', detail: '긴장, 욕망, 예외성, 브랜드 중력 중 2개 이상을 동시에 가진 컷을 우선한다.' },
        { name: '시선 중단', detail: '첫 1초에 설명 없이 멈추게 하는 리액션 또는 사건이 있는 컷을 포함한다.' },
        { name: '컷 다양성', detail: '클로즈업, 리액션, 오브젝트, 전환, 브랜드 각인이 반복되지 않도록 섞는다.' },
      ],
      creative_audit: [
        { name: '첫 장면', status: '검토', detail: '광고처럼 시작하지 않고 사건처럼 시작한다.' },
        { name: '개연성', status: '검토', detail: brand + '가 해결하는 이유가 장면 안에서 보인다.' },
        { name: '마지막 각인', status: '검토', detail: '마지막 컷에는 브랜드만 남긴다.' },
      ],
      diversity_axes: [
        { name: '감정 축', detail: '당황, 긴장, 안도, 확신' },
        { name: '화면 축', detail: '인물 리액션, 문제 오브젝트, 해결 오브젝트, 브랜드 여백' },
      ],
      required_roles: [
        { name: 'HOOK', detail: '사건 발생' },
        { name: 'PROBLEM', detail: '압박 확대' },
        { name: 'PROOF', detail: '해결 증거' },
        { name: 'BRAND', detail: '브랜드 각인' },
      ],
      field_questions: [
        { name: '왜 멈추나', detail: '첫 화면만 보고도 이상한 일이 벌어진다는 감각이 있는가' },
        { name: '왜 이 브랜드인가', detail: '브랜드가 장면의 중력을 만드는가' },
      ],
      field_constraints: [
        { name: '설명 금지', detail: '중간 컷은 제품 자랑보다 사건과 리액션을 우선한다.' },
        { name: '브랜드 후반 집중', detail: '로고/브랜드명은 장면 안에 자연스럽게 녹이고 마지막에만 명확히 남긴다.' },
      ],
    });
  }

  function sampleScenes() {
    const profile = currentProfileContext();
    const brand = profile?.brand || '마케케 테스트 브랜드';
    const hook = currentAttentionHook();
    return [
      {
        title: '일이 터지는 첫 1초',
        body: brand + '가 등장하기 전, 주인공의 상황이 영화처럼 꼬이며 시선을 붙잡는 오프닝입니다.',
        role: 'HOOK',
        shot_type: 'cold open incident',
        subject_action: '평온한 순간이 갑자기 깨지고 주인공이 당황한 리액션을 보인다',
        camera: 'quick push-in to reaction, then snap cut',
        lens: '35mm commercial lens',
        lighting: hook.value === 'sensual-premium' ? 'low key premium light with glossy highlights' : 'high contrast cold open light with warm subject rim',
        art_direction: hook.label + '를 반영한 상업 광고 오프닝',
        composition: 'main reaction in foreground, clear copy safe area, no text in image',
        transition: 'impact match cut',
        sound_cue: hook.value === 'comedy-twist' ? 'awkward silence then comic hit' : 'sharp tension rise and impact hit',
        edit_beat: 'hook shock',
        cut_plan: '평온함, 이상 신호, 리액션, 반전, 해결 예고로 쪼갠다',
        narration: '처음 1초는 설명이 아니라 사건으로 붙잡습니다.',
        negative_constraints: 'no embedded text, no fake logo, no price label',
        micro_cuts: [
          ['평온한 착각', '주인공이 아직 문제를 모른 채 자신만만하게 움직인다', 'locked calm frame', '괜찮다고 생각한 순간', 'soft room tone'],
          ['이상 신호', '작은 오류나 방해물이 화면 한쪽에서 갑자기 커진다', 'fast insert', '뭔가 이상합니다', 'tiny glitch pop'],
          ['리액션 폭발', '주인공의 표정이나 몸짓이 과장되게 멈춘다', 'snap zoom reaction', '멈춰 보게 되는 1초', 'impact hit'],
          ['반전 예고', brand + '를 상징하는 빛이나 오브젝트가 상황을 뒤집을 듯 등장한다', 'low angle reveal', '이제 판이 바뀝니다', 'reverse swell'],
          ['해결로 연결', '혼란이 다음 장면 방향으로 빨려 들어가며 전환된다', 'whip pull transition', '답은 바로 다음 컷에', 'whoosh'],
        ],
      },
      {
        title: '문제가 주인공을 몰아붙이는 장면',
        body: '고객 문제가 말로 설명되지 않고 장면 속 압박과 코미디/긴장 리액션으로 보입니다.',
        role: 'PROBLEM',
        shot_type: 'character pressure scene',
        subject_action: '문제 요소들이 주인공 주변으로 몰려오고 주인공은 빠져나갈 방법을 찾는다',
        camera: 'side dolly with escalating inserts',
        lens: '50mm shallow depth',
        lighting: 'slightly cooler ambient with warm subject light',
        art_direction: 'realistic service metaphor',
        composition: 'subject left, empty right for overlay',
        transition: 'match cut from problem to solution',
        sound_cue: 'low tension tick',
        edit_beat: 'problem hold',
        cut_plan: '압박 시작, 선택 피로, 웃기거나 긴장되는 리액션, 해결 기대감, 전환으로 구성한다',
        narration: '고객 문제는 설명보다 상황으로 먼저 느껴져야 합니다.',
        negative_constraints: 'no fear, no excessive anxiety, no medical guarantee',
        micro_cuts: [
          ['압박 시작', '작은 문제가 순식간에 여러 개로 불어나 주인공을 둘러싼다', 'foreground detail', '하나가 둘이 되는 순간', 'low tick'],
          ['선택 피로', '주인공이 선택지 사이에서 과장되게 굳거나 한숨을 쉰다', 'medium reaction hold', '고민이 커질수록', 'soft tension'],
          ['부조리 확대', '문제 요소가 말도 안 되게 커 보이는 시각적 농담 또는 스릴러식 압박으로 변한다', 'distorted close-up', '이건 너무 많습니다', 'rubber hit'],
          ['해결 예고', '브랜드 컬러의 선이 문제 영역을 정리하듯 지나간다', 'clean line move', '여기서 판이 정리됩니다', 'line sweep'],
          ['전환', '정리된 화면이 다음 해결 장면으로 열립니다', 'push transition', '다음 장면에서 답을 보여줍니다', 'transition rise'],
        ],
      },
      {
        title: brand + '가 상황을 뒤집는 장면',
        body: '제품/서비스가 좋다는 설명 대신, 실제로 장면이 바뀌는 순간을 보여줍니다.',
        role: 'PROOF',
        shot_type: 'clean process montage',
        subject_action: brand + '의 핵심 가치가 등장하자 복잡한 상황이 빠르게 정리되고 주인공의 표정이 바뀐다',
        camera: 'top shot to angled close-up',
        lens: '45mm crisp detail',
        lighting: 'bright controlled studio light',
        art_direction: 'trustworthy process film',
        composition: 'layered process objects, no text in image',
        transition: 'grid wipe',
        sound_cue: 'confident click sequence',
        edit_beat: 'proof rhythm',
        cut_plan: '등장, 작동, 반응, 증거, 다음 행동 예고로 쪼갠다',
        narration: '해결 장면은 기능 설명보다 강합니다.',
        negative_constraints: 'no fake chart text, no unreadable labels',
        micro_cuts: [
          ['해결 등장', brand + '의 상징이 화면 중앙이 아니라 문제 사이로 자연스럽게 들어온다', 'hero insert', '등장만으로 분위기가 바뀝니다', 'grid lock'],
          ['작동 순간', '사람의 손이나 오브젝트가 핵심 행동을 단 한 번 수행한다', 'hand detail', '한 번에 정리되는 감각', 'click'],
          ['리액션 전환', '주인공의 표정이 당황에서 안도나 웃음으로 바뀐다', 'reaction close-up', '표정이 증거입니다', 'spark'],
          ['증거 디테일', '완성된 상태의 질감, 속도, 공간 변화가 가까이 보인다', 'macro result shot', '말보다 분명한 장면', 'warm swell'],
          ['브랜드 예고', '브랜드 컬러의 라인이 마지막 각인 장면으로 이어진다', 'line follow', '브랜드가 남는 순간', 'brand lift'],
        ],
      },
      {
        title: '브랜드만 남기는 마지막 컷',
        body: 'CTA 없이 브랜드 락업만 가장 기억나는 마지막 프레임으로 고정합니다.',
        role: 'BRAND',
        shot_type: 'final lockup scene',
        subject_action: '핵심 대상이 안정적인 히어로 포즈로 정리된다',
        camera: 'slow pull-back to final lockup',
        lens: '40mm premium commercial',
        lighting: 'hero rim light and clean glow',
        art_direction: 'final advertising lockup',
        composition: 'strong central subject with clean brand lockup safe area',
        transition: 'final hold',
        sound_cue: 'final bright resolve',
        edit_beat: 'brand lock',
        cut_plan: '히어로 고정, 브랜드 색상, 브랜드 등장, 여백 유지, 잔상 마무리',
        narration: '마지막에는 브랜드만 남습니다.',
        negative_constraints: 'no embedded CTA button, no price text in pixels',
        micro_cuts: [
          ['히어로 고정', '대상이 화면 중앙에서 안정적으로 멈춘다', 'center lock', '결정적인 선택', 'hero hit'],
          ['브랜드 색상', '브랜드 컬러 빛이 화면 하단을 정리한다', 'low sweep', '브랜드의 기준으로', 'brand glow'],
          ['브랜드 등장', 'HyperFrames 브랜드 락업이 영상 위로 또렷하게 올라올 여백을 확보한다', 'brand-safe hold', brand, 'brand rise'],
          ['브랜드 집중', '브랜드 주변 빛이 짧게 집중되고 버튼이나 설명 문구는 나오지 않는다', 'brand push', '브랜드만', 'brand pulse'],
          ['잔상 마무리', '빛과 입자가 천천히 사라지며 마지막 프레임을 고정한다', 'slow final hold', brand, 'resolve'],
        ],
      },
    ].map(function (scene) {
      scene.micro_cuts = scene.micro_cuts.map(function (cut, cutIndex) {
        const score = Math.max(62, Math.min(98, 82 + scene.title.length % 7 + cutIndex * 3));
        const mass = Math.max(58, Math.min(96, 74 + cut[0].length % 9 + cutIndex * 4));
        return {
          title: cut[0],
          action: cut[1],
          camera: cut[2],
          copy: cut[3],
          sound_cue: cut[4],
          field_coupling_score: score,
          creative_mass: mass,
          selected_priority: cutIndex === 0 || cutIndex === scene.micro_cuts.length - 1 ? 88 : 72,
          field_coupling_reason: scene.role + ' 역할에서 ' + cut[0] + '가 광고 중심장의 긴장과 브랜드 중력을 연결합니다.',
          shot_diversity_reason: cut[2] + '로 이전 컷과 다른 감정/화면 축을 만듭니다.',
          vfx_preset: currentVFXPreset().value,
          vfx_cue: currentVFXPreset().label + ' · ' + cut[4],
          image_prompt: scene.body + ' / ' + cut[1],
          video_prompt: scene.cut_plan + ' / ' + cut[2],
        };
      });
      return scene;
    });
  }

  function refreshStyleGuide() {
    syncForm();
    const styleGuide = document.getElementById('aad-animation-style-guide');
    const vfxGuide = document.getElementById('aad-vfx-preset-guide');
    const profileGuide = document.getElementById('aad-profile-context-guide');
    const briefGuide = document.getElementById('aad-brief-pack-guide');
    const modeGuide = document.getElementById('aad-production-mode-guide');
    const storyArcGuide = document.getElementById('aad-story-arc-guide');
    const attentionHookGuide = document.getElementById('aad-attention-hook-guide');
    const semanticGuide = document.getElementById('aad-semantic-structure-guide');
    const exceptionRuleGuide = document.getElementById('aad-exception-rule-guide');
    const creativityRuleGuide = document.getElementById('aad-creativity-rule-guide');
    const platformPlaybookGuide = document.getElementById('aad-platform-playbook-guide');
    const hookRecipeGuide = document.getElementById('aad-hook-recipe-guide');
    const personaGuide = document.getElementById('aad-persona-type-guide');
    if (styleGuide) styleGuide.textContent = currentAnimationStyle().guide;
    if (vfxGuide) vfxGuide.textContent = currentVFXPreset().guide + ' · 새 컷의 기본값이며 컷마다 따로 바꿀 수 있습니다.';
    if (profileGuide) profileGuide.textContent = profileContextText();
    if (briefGuide) briefGuide.textContent = briefPackGuideText();
    if (modeGuide) modeGuide.textContent = productionModeGuide();
    if (storyArcGuide) storyArcGuide.textContent = currentStoryArc().guide;
    if (attentionHookGuide) attentionHookGuide.textContent = currentAttentionHook().guide;
    if (semanticGuide) semanticGuide.textContent = currentSemanticStructure().description;
    if (exceptionRuleGuide) exceptionRuleGuide.textContent = currentExceptionRule().guide;
    if (creativityRuleGuide) creativityRuleGuide.textContent = currentCreativityRule().description;
    if (platformPlaybookGuide) platformPlaybookGuide.textContent = currentPlatformPlaybook().guide;
    if (hookRecipeGuide) hookRecipeGuide.textContent = currentHookRecipe().guide;
    if (personaGuide) personaGuide.textContent = currentPersona().guide;
    scheduleHistoryAutosave();
  }

  function applyBriefPack(value, options) {
    const opts = options || {};
    const pack = availableBriefPacks().find(function (item) { return item.value === value; });
    if (!pack) {
      if (!opts.silent) alert('먼저 프로필 기반 AI 광고 세트를 생성해주세요.');
      return;
    }
    setInput('aad-brief-pack', pack.value);
    setInput('aad-topic', pack.topic);
    setInput('aad-objective', pack.objective);
    setInput('aad-tone', pack.tone);
    setInput('aad-cta', pack.cta);
    setInput('aad-duration', pack.duration);
    setInput('aad-scene-count', pack.scenes);
    setInput('aad-animation-style', pack.style);
    setInput('aad-vfx-preset', pack.vfx);
    const packValue = pack.value || '';
    setInput('aad-story-arc', pack.story_arc || storyArcForPack(packValue));
    setInput('aad-attention-hook', pack.attention_hook || attentionHookForPack(packValue));
    setInput('aad-platform-playbook', pack.platform_playbook || 'native-hook-shorts');
    setInput('aad-hook-recipe', pack.hook_recipe || hookRecipeForPack(packValue));
    setInput('aad-persona-type', pack.persona_type || (pack.value === 'luxury-drop' || pack.value === 'food-sizzle' ? 'product-as-hero' : (pack.value === 'event-burst' ? 'mascot-character' : 'brand-creator')));
    setInput('aad-source', buildBriefPackSource(pack));
    invalidateQuality();
    refreshStyleGuide();
    if (!opts.silent) addLog('AI 추천 광고 세트 적용: ' + pack.label, 'success');
    scheduleHistoryAutosave();
  }

  function beginnerAutoSet() {
    applyBriefPack(field('aad-brief-pack', 'launch-premium'));
  }

  async function beginnerOneClick() {
    beginnerAutoSet();
    await generatePlan();
    state.activeStep = 3;
  }

  function syncForm() {
    Object.keys(state.form).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) state.form[id] = el.value;
    });
  }

  function formValue(id, fallback) {
    return esc(state.form[id] || fallback || '');
  }

  function hasHistoryWork() {
    return !!(
      state.scenes.length ||
      Object.keys(state.images || {}).length ||
      Object.keys(state.videos || {}).length ||
      state.narration ||
      state.bgm ||
      state.finalUrl
    );
  }

  function firstHistoryThumbnail() {
    const refs = allCutRefs();
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex) || (state.images[ref.key] || [])[0];
      if (mediaUrl(image)) return mediaUrl(image);
      if (mediaUrl(state.videos[ref.key])) return mediaUrl(state.videos[ref.key]);
    }
    return '';
  }

  function buildHistoryPayload() {
    state.form['aad-video-model'] = currentVideoModel();
    return {
      version: 1,
      form: Object.assign({}, state.form),
      scenes: state.scenes,
      images: state.images,
      videos: state.videos,
      narration: state.narration,
      bgm: state.bgm,
      finalJob: state.finalJob,
      finalUrl: state.finalUrl,
      quality: state.quality,
      storyboard_meta: state.storyboardMeta,
      logs: state.logs,
      active_step: state.activeStep,
      ai_brief_packs: state.aiBriefPacks,
      profile_context: currentProfileContext(),
      saved_at: new Date().toISOString(),
    };
  }

  function historyTitle() {
    const topic = field('aad-topic', '애니메이션 광고');
    const pack = currentBriefPack();
    return topic + ' · ' + pack.label;
  }

  function historySummaryFromState() {
    return {
      id: Number(state.currentHistoryId || 0),
      title: historyTitle(),
      topic: field('aad-topic', '애니메이션 광고'),
      profile_id: Number(currentProfileContext()?.profile_id || window._globalProfileId || 0) || 0,
      duration: selectedDuration(),
      aspect: field('aad-aspect', '9:16'),
      thumbnail_url: firstHistoryThumbnail(),
      final_url: state.finalUrl || '',
      payload: buildHistoryPayload(),
    };
  }

  function restoreHistoryPayload(item) {
    const payload = item?.payload || {};
    state.form = Object.assign({}, state.form, payload.form || {});
    state.form['aad-video-model'] = normalizeVideoModel(state.form['aad-video-model']);
    state.scenes = Array.isArray(payload.scenes) ? payload.scenes.map(compactHistorySceneNode) : [];
    state.scenes.forEach(function (scene, index) { ensureMicroCuts(scene, index); });
    applyCameraMotionDiversity();
    state.images = payload.images && typeof payload.images === 'object' ? payload.images : {};
    state.videos = payload.videos && typeof payload.videos === 'object' ? payload.videos : {};
    state.narration = payload.narration || null;
    state.bgm = payload.bgm || null;
    state.finalJob = payload.finalJob || null;
    state.finalUrl = payload.finalUrl || item.final_url || '';
    state.quality = payload.quality || null;
    state.storyboardMeta = normalizeStoryboardMeta(payload.storyboard_meta || {});
    state.logs = Array.isArray(payload.logs) ? payload.logs.slice(0, 10) : state.logs;
    state.activeStep = resumeStepFromHistory(Number(payload.active_step || 3));
    state.aiBriefPacks = Object.assign({}, state.aiBriefPacks, payload.ai_brief_packs || {});
    state.aiBriefPacks.items = Array.isArray(state.aiBriefPacks.items) ? state.aiBriefPacks.items.map(normalizeGeneratedBriefPack) : [];
    state.aiBriefPacks.loading = false;
    state.currentHistoryId = Number(item.id || 0);
    state.storyboardIndex = null;
    suppressNextFormSync = true;
    render();
  }

  function resumeStepFromHistory(savedStep) {
    const step = Math.max(1, Math.min(8, Number(savedStep) || 1));
    if (step < 8) return step;
    return inferredProductionStep();
  }

  function inferredProductionStep() {
    if (!state.scenes.length) return state.aiBriefPacks.items.length ? 3 : 1;
    const refs = videoCutRefs();
    if (!refs.length) return 3;
    if (!allSelectedImagesReady(refs)) return 4;
    if (!allSelectedVideosReady(refs)) return 5;
    if (!state.finalUrl) return 6;
    return 7;
  }

  function formatHistoryDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function scheduleHistoryAutosave(delayMs) {
    if (!hasHistoryWork()) return;
    clearTimeout(historySaveTimer);
    historySaveTimer = setTimeout(function () {
      saveHistory({ silent: true }).catch(function (err) {
        addLog('작업 이력 자동 저장 실패: ' + err.message, 'error', { persist: false });
      });
    }, Number(delayMs || 1400));
  }

  function saveHistoryCheckpoint(reason) {
    if (!hasHistoryWork()) return Promise.resolve(null);
    clearTimeout(historySaveTimer);
    historyCheckpointQueue = historyCheckpointQueue.catch(function () { return null; }).then(function () {
      return saveHistory({ silent: true, render: false });
    }).catch(function (err) {
      state.history.saving = false;
      addLog((reason ? reason + ' ' : '') + 'DB 체크포인트 저장 실패: ' + err.message, 'error');
      return null;
    });
    return historyCheckpointQueue;
  }

  async function loadHistoryList(options) {
    const opts = options || {};
    state.history.loading = true;
    if (!opts.silent) render();
    try {
      const data = await apiRequestJSON('/api/animation-ad/history?limit=30');
      state.history.items = Array.isArray(data.items) ? data.items : [];
    } catch (err) {
      if (!opts.silent) addLog('작업 이력 불러오기 실패: ' + err.message, 'error');
    } finally {
      state.history.loading = false;
      if (opts.render !== false) render();
    }
  }

  async function saveHistory(options) {
    const opts = options || {};
    syncForm();
    if (!hasHistoryWork()) {
      if (!opts.silent) alert('저장할 콘티나 결과물이 아직 없습니다.');
      return null;
    }
    state.history.saving = true;
    if (!opts.silent) render();
    try {
      const data = await apiJSON('/api/animation-ad/history', historySummaryFromState());
      state.currentHistoryId = Number(data.id || data.item?.id || state.currentHistoryId || 0);
      await loadHistoryList({ silent: true, render: false });
      if (!opts.silent) addLog('애니메이션 광고 작업 이력을 DB에 저장했습니다.', 'success');
      return data.item || null;
    } catch (err) {
      if (!opts.silent) {
        addLog('작업 이력 저장 실패: ' + err.message, 'error');
        alert('작업 이력 저장 실패: ' + err.message);
      }
      throw err;
    } finally {
      state.history.saving = false;
      if (opts.render !== false) render();
    }
  }

  async function openHistory(id) {
    const historyId = Number(id || 0);
    if (!historyId || state.history.openingId) return;
    if (state.busy) {
      addLog('현재 작업 처리 중이라 이력 이어하기를 잠시 멈췄습니다. 작업이 끝나면 다시 눌러주세요.', 'info', { persist: false });
      return;
    }
    state.history.openingId = historyId;
    showHistoryOpeningFeedback(historyId);
    try {
      const data = await apiRequestJSON('/api/animation-ad/history/' + encodeURIComponent(historyId));
      restoreHistoryPayload(data.item || {});
      addLog('저장된 쇼츠 광고 작업을 불러왔습니다. 이어서 수정할 수 있습니다.', 'success', { persist: false });
      setTimeout(focusCurrentStep, 80);
    } catch (err) {
      addLog('작업 이력 열기 실패: ' + err.message, 'error');
      alert('작업 이력 열기 실패: ' + err.message);
    } finally {
      state.history.openingId = 0;
      setBusy('');
    }
  }

  async function deleteHistory(id) {
    if (!confirm('이 작업 이력을 삭제할까요?')) return;
    try {
      await apiRequestJSON('/api/animation-ad/history/' + encodeURIComponent(id), { method: 'DELETE' });
      if (Number(state.currentHistoryId) === Number(id)) state.currentHistoryId = 0;
      await loadHistoryList({ silent: true, render: false });
      addLog('작업 이력을 삭제했습니다.', 'success');
    } catch (err) {
      addLog('작업 이력 삭제 실패: ' + err.message, 'error');
      alert('작업 이력 삭제 실패: ' + err.message);
    } finally {
      render();
    }
  }

  async function deleteAllHistory() {
    const items = state.history.items || [];
    if (!items.length && !confirm('작업 이력이 비어 있습니다. 그래도 전체 삭제 요청을 보낼까요?')) return;
    if (items.length && !confirm('저장된 쇼츠 광고 작업 이력 ' + items.length + '개를 전부 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      const data = await apiRequestJSON('/api/animation-ad/history', { method: 'DELETE' });
      state.currentHistoryId = 0;
      state.history.items = [];
      addLog('작업 이력 전체 삭제 완료: ' + Number(data.deleted || 0) + '개', 'success');
    } catch (err) {
      addLog('작업 이력 전체 삭제 실패: ' + err.message, 'error');
      alert('작업 이력 전체 삭제 실패: ' + err.message);
    } finally {
      render();
    }
  }

  function lines(value) {
    return String(value || '')
      .split(/\n|,/)
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function referenceImageGroups() {
    const profile = currentProfileContext();
    const profileBrandImages = uniqueStrings([profile?.logo_url].concat(profile?.image_urls || []));
    return {
      product: lines(field('aad-product-images', '')),
      brand: uniqueStrings(lines(field('aad-brand-images', '')).concat(profileBrandImages)),
      persona: lines(field('aad-persona-images', '')),
      general: lines(field('aad-reference-images', '')),
    };
  }

  function allReferenceImages() {
    const groups = referenceImageGroups();
    return [].concat(groups.brand, groups.product, groups.persona, groups.general).filter(Boolean);
  }

  function referenceContextPrompt() {
    const groups = referenceImageGroups();
    return [
      groups.product.length ? '[상품 참고 이미지]\n' + groups.product.join('\n') : '',
      groups.brand.length ? '[브랜드 참고 이미지]\n' + groups.brand.join('\n') : '',
      groups.persona.length ? '[모델/페르소나 참고 이미지]\n' + groups.persona.join('\n') : '',
      groups.general.length ? '[기타 참고 이미지]\n' + groups.general.join('\n') : '',
    ].filter(Boolean).join('\n\n');
  }

  function shouldUseGeneratedPersonaModel() {
    const persona = currentPersona();
    return persona.value !== 'none' && persona.value !== 'product-as-hero';
  }

  function buildPersonaModelImagePrompt() {
    const persona = currentPersona();
    const profile = currentProfileContext();
    const description = field('aad-persona-description', '').trim();
    const rules = field('aad-persona-rules', DEFAULT_PERSONA_RULES).trim() || DEFAULT_PERSONA_RULES;
    const modelOptions = personaModelOptions();
    return [
      '[Fixed model/persona reference image for a commercial shorts ad]',
      'CRITICAL: Generate exactly one protagonist instance in one single portrait frame. Do not create a character sheet, turnaround, multi-panel layout, duplicate poses, comparison boxes, blank UI frames, storyboard frames, or multiple versions of the same person.',
      'Korean hard rule: 한 장 안에는 같은 인물을 여러 번 배치하지 말고, 오직 한 명의 모델만 크게 만든다. 레퍼런스 보드/설정화/3분할 시트/여러 컷 구성으로 만들면 실패다.',
      '[Model creation options]\n' + personaModelOptionSummary(modelOptions),
      '[User-defined model creation rules]\n' + rules,
      'Create one clean, reusable identity reference image for the recurring protagonist.',
      'Persona type: ' + persona.label + ' - ' + persona.guide,
      description ? 'User persona description: ' + description : 'If no user description exists, infer a memorable protagonist from the brand, product, and ad intent.',
      'Brand: ' + (profile?.brand || field('aad-topic', '브랜드')),
      'Ad intent: ' + field('aad-user-intent', field('aad-topic', '쇼츠 광고')),
      'Source material: ' + field('aad-source', ''),
      'Visual mode: ' + currentProductionMode().label + ' / ' + currentAnimationStyle().label,
      'The reference must clearly lock face/character silhouette, hair, outfit color, body shape, expression energy, and repeated brand-color accessory.',
      'Use provided brand/product references only as mood and identity anchors. Do not create text, subtitles, price labels, UI labels, watermarks, or fake logos.',
      'If brand logo reference is provided, it may appear only as a natural small physical detail such as a badge, app icon, product prop, or studio object, not as a floating overlay.',
      'Composition: one protagonist only, one pose only, one portrait frame only, waist-up or full-body portrait, clean background, commercial lighting, enough detail for later image-to-image consistency, no multiple people.',
      'Negative: character sheet, multiple poses, multi-panel layout, storyboard panels, blank boxes, duplicate person, text, caption, watermark, logo hallucination, extra fingers, face distortion, random second character, unrelated stock-photo scene.',
      brandIdentityPrompt(),
      referenceContextPrompt(),
    ].filter(Boolean).join('\n');
  }

  function currentProfileID() {
    const profile = currentProfileContext();
    return Number(profile?.profile_id || window._globalProfileId || 0) || 0;
  }

  function personaModelName() {
    const profile = currentProfileContext();
    const brand = profile?.brand || '브랜드';
    const persona = currentPersona();
    const description = field('aad-persona-description', '').trim();
    if (description) return compactText(description, 28);
    return brand + ' ' + persona.label;
  }

  function personaModelPayload(imageUrl) {
    const persona = currentPersona();
    const firstImage = imageUrl || referenceImageGroups().persona[0] || '';
    const description = field('aad-persona-description', '').trim();
    const rules = field('aad-persona-rules', DEFAULT_PERSONA_RULES).trim() || DEFAULT_PERSONA_RULES;
    const modelOptions = personaModelOptions();
    return {
      profile_id: currentProfileID(),
      name: personaModelName(),
      label: persona.label,
      prompt: buildPersonaModelImagePrompt(),
      image_url: firstImage,
      provider: field('aad-image-engine', 'gemini'),
      model: field('aad-image-model', state.modelSettings.image_model || 'openai/gpt-image-2-developer/text-to-image'),
      source_topic: field('aad-topic', '쇼츠 광고'),
      source_objective: field('aad-objective', ''),
      settings: {
        source: 'shorts-ad',
        persona_type: persona.value,
        persona_label: persona.label,
        persona_description: description,
        persona_rules: rules,
        persona_options: modelOptions,
        production_mode: field('aad-production-mode', DEFAULT_PRODUCTION_MODE),
        animation_style: field('aad-animation-style', 'world-class-commercial'),
        brand: currentProfileContext()?.brand || '',
        reference_images: referenceImageGroups().persona,
      },
    };
  }

  async function loadPersonaModelLibrary(options) {
    const opts = options || {};
    state.personaLibrary.loading = true;
    if (!opts.silent) render();
    try {
      const data = await apiRequestJSON('/api/vag/characters?profile_id=' + encodeURIComponent(currentProfileID()));
      state.personaLibrary.items = Array.isArray(data.items) ? data.items : [];
    } catch (err) {
      if (!opts.silent) addLog('저장 모델 불러오기 실패: ' + err.message, 'error');
    } finally {
      state.personaLibrary.loading = false;
      if (opts.render !== false) render();
    }
  }

  async function saveCurrentPersonaModel(options) {
    const opts = options || {};
    if (state.busy && !opts.allowBusy) return false;
    syncModelPicker();
    let imageUrl = opts.imageUrl || referenceImageGroups().persona[0] || '';
    if (!imageUrl && !opts.skipGenerate) {
      const ready = await generatePersonaModelReference({ silent: opts.silent, saveToLibrary: false });
      if (!ready) return false;
      imageUrl = referenceImageGroups().persona[0] || '';
    }
    if (!imageUrl) {
      if (!opts.silent) alert('먼저 모델 기준 이미지를 만들거나 모델 참고 이미지를 추가해주세요.');
      return false;
    }
    const selectedID = Number(field('aad-persona-model-id', '0')) || 0;
    const payload = personaModelPayload(imageUrl);
    state.personaLibrary.saving = true;
    if (!opts.silent) render();
    try {
      const data = selectedID > 0
        ? await apiRequestJSON('/api/vag/characters/' + selectedID, { method: 'PUT', body: payload })
        : await apiJSON('/api/vag/characters', payload);
      const item = data.item || data;
      if (item && item.id) setInput('aad-persona-model-id', item.id);
      await loadPersonaModelLibrary({ silent: true, render: false });
      addLog(selectedID > 0 ? '저장 모델을 수정했습니다.' : '고정 모델을 저장해 다음 광고에서도 재사용할 수 있습니다.', 'success', { persist: false });
      if (!opts.silent) render();
      return true;
    } catch (err) {
      addLog('모델 저장 실패: ' + err.message, 'error');
      if (!opts.silent) alert('모델 저장 실패: ' + err.message);
      return false;
    } finally {
      state.personaLibrary.saving = false;
      if (!opts.silent) render();
    }
  }

  function applyPersonaModel(id) {
    const item = state.personaLibrary.items.find(function (model) { return Number(model.id) === Number(id); });
    if (!item) return;
    const settings = item.settings || {};
    const modelOptions = settings.persona_options || {};
    setInput('aad-persona-model-id', item.id);
    setInput('aad-persona-type', settings.persona_type || state.form['aad-persona-type'] || 'brand-creator');
    setInput('aad-persona-description', settings.persona_description || item.name || item.label || '');
    setInput('aad-persona-rules', settings.persona_rules || DEFAULT_PERSONA_RULES);
    setInput('aad-persona-age', modelOptions.age || 'ai-auto');
    setInput('aad-persona-gender', modelOptions.gender || 'ai-auto');
    setInput('aad-persona-hair', modelOptions.hair || '');
    setInput('aad-persona-outfit', modelOptions.outfit || '');
    setInput('aad-persona-expression', modelOptions.expression || 'confident-bright');
    setInput('aad-persona-framing', modelOptions.framing || 'waist-up');
    setInput('aad-persona-brand-detail', modelOptions.brand_detail || '');
    if (item.image_url) {
      setReferenceItems('persona', [item.image_url].concat(referenceItems('persona')));
    }
    addLog('저장 모델 "' + (item.name || item.label || '주인공 모델') + '"을 이번 광고에 적용했습니다.', 'success');
    render();
  }

  function previewPersonaModel(id) {
    const item = state.personaLibrary.items.find(function (model) { return Number(model.id) === Number(id); });
    if (!item) return;
    state.personaLibrary.previewId = Number(id);
    render();
  }

  function closePersonaModelPreview() {
    state.personaLibrary.previewId = 0;
    render();
  }

  function editPersonaModel(id) {
    const item = state.personaLibrary.items.find(function (model) { return Number(model.id) === Number(id); });
    if (!item) return;
    state.personaLibrary.editingId = Number(id);
    state.personaLibrary.editDraft = {
      name: item.name || '',
      label: item.label || '',
      description: item.settings?.persona_description || '',
      rules: item.settings?.persona_rules || DEFAULT_PERSONA_RULES,
      age: item.settings?.persona_options?.age || 'ai-auto',
      gender: item.settings?.persona_options?.gender || 'ai-auto',
      hair: item.settings?.persona_options?.hair || '',
      outfit: item.settings?.persona_options?.outfit || '',
      expression: item.settings?.persona_options?.expression || 'confident-bright',
      framing: item.settings?.persona_options?.framing || 'waist-up',
      brand_detail: item.settings?.persona_options?.brand_detail || '',
      image_url: item.image_url || '',
    };
    render();
  }

  function editPersonaModelFromPreview(id) {
    editPersonaModel(id);
    state.personaLibrary.previewId = 0;
    render();
  }

  function cancelPersonaModelEdit() {
    state.personaLibrary.editingId = 0;
    state.personaLibrary.editDraft = {};
    render();
  }

  function updatePersonaModelDraft(key, value) {
    state.personaLibrary.editDraft[key] = String(value || '');
  }

  async function updatePersonaModel(id) {
    const item = state.personaLibrary.items.find(function (model) { return Number(model.id) === Number(id); });
    if (!item) return false;
    const draft = state.personaLibrary.editDraft || {};
    const settings = Object.assign({}, item.settings || {}, {
      persona_description: draft.description || '',
      persona_label: draft.label || item.label || '',
      persona_rules: draft.rules || DEFAULT_PERSONA_RULES,
      persona_options: {
        age: draft.age || 'ai-auto',
        gender: draft.gender || 'ai-auto',
        hair: draft.hair || '',
        outfit: draft.outfit || '',
        expression: draft.expression || 'confident-bright',
        framing: draft.framing || 'waist-up',
        brand_detail: draft.brand_detail || '',
      },
    });
    state.personaLibrary.saving = true;
    render();
    try {
      const data = await apiRequestJSON('/api/vag/characters/' + id, {
        method: 'PUT',
        body: Object.assign({}, item, {
          name: draft.name || item.name || '주인공 모델',
          label: draft.label || item.label || '',
          image_url: draft.image_url || item.image_url || '',
          settings: settings,
        }),
      });
      const updated = data.item || data;
      await loadPersonaModelLibrary({ silent: true, render: false });
      if (Number(field('aad-persona-model-id', '0')) === Number(id)) {
        setInput('aad-persona-description', settings.persona_description || updated.name || '');
        setInput('aad-persona-rules', settings.persona_rules || DEFAULT_PERSONA_RULES);
        setInput('aad-persona-age', settings.persona_options.age || 'ai-auto');
        setInput('aad-persona-gender', settings.persona_options.gender || 'ai-auto');
        setInput('aad-persona-hair', settings.persona_options.hair || '');
        setInput('aad-persona-outfit', settings.persona_options.outfit || '');
        setInput('aad-persona-expression', settings.persona_options.expression || 'confident-bright');
        setInput('aad-persona-framing', settings.persona_options.framing || 'waist-up');
        setInput('aad-persona-brand-detail', settings.persona_options.brand_detail || '');
        if (updated.image_url) setReferenceItems('persona', [updated.image_url].concat(referenceItems('persona')));
      }
      state.personaLibrary.editingId = 0;
      state.personaLibrary.editDraft = {};
      addLog('저장 모델 수정 완료 · 다음 생성부터 수정값을 씁니다.', 'success', { persist: false });
      return true;
    } catch (err) {
      addLog('저장 모델 수정 실패: ' + err.message, 'error');
      alert('저장 모델 수정 실패: ' + err.message);
      return false;
    } finally {
      state.personaLibrary.saving = false;
      render();
    }
  }

  async function deletePersonaModel(id) {
    if (!confirm('저장 모델을 삭제할까요? 이미 만든 콘티/이미지는 지우지 않습니다.')) return;
    state.personaLibrary.saving = true;
    render();
    try {
      await apiRequestJSON('/api/vag/characters/' + id, { method: 'DELETE' });
      if (Number(field('aad-persona-model-id', '0')) === Number(id)) setInput('aad-persona-model-id', '');
      if (Number(state.personaLibrary.previewId) === Number(id)) state.personaLibrary.previewId = 0;
      await loadPersonaModelLibrary({ silent: true, render: false });
      addLog('저장 모델을 삭제했습니다.', 'success', { persist: false });
    } catch (err) {
      addLog('저장 모델 삭제 실패: ' + err.message, 'error');
      alert('저장 모델 삭제 실패: ' + err.message);
    } finally {
      state.personaLibrary.saving = false;
      render();
    }
  }

  function renderPersonaModelLibrary() {
    const library = state.personaLibrary;
    const items = (library.items || []).slice(0, 6);
    const selectedID = Number(field('aad-persona-model-id', '0')) || 0;
    return `
      <div class="aad-model-library">
        <div class="aad-model-library-head">
          <b>저장 모델</b>
          <button type="button" onclick="aadLoadPersonaModels()"${library.loading ? ' disabled' : ''}>${library.loading ? '불러오는 중' : '새로고침'}</button>
        </div>
        ${items.length ? items.map(function (item) {
          const editing = Number(library.editingId) === Number(item.id);
          const title = item.name || item.label || '주인공 모델';
          if (editing) {
            return `
              <article class="aad-model-library-item editing">
                <input value="${esc(library.editDraft.name || '')}" placeholder="모델 이름" oninput="aadUpdatePersonaModelDraft('name',this.value)">
                <input value="${esc(library.editDraft.label || '')}" placeholder="라벨" oninput="aadUpdatePersonaModelDraft('label',this.value)">
                <textarea rows="3" placeholder="모델 설명" oninput="aadUpdatePersonaModelDraft('description',this.value)">${esc(library.editDraft.description || '')}</textarea>
                <div class="aad-model-edit-options">
                  <select onchange="aadUpdatePersonaModelDraft('age',this.value)">${optionTags(personaAgeOptions(), library.editDraft.age || 'ai-auto')}</select>
                  <select onchange="aadUpdatePersonaModelDraft('gender',this.value)">${optionTags(personaGenderOptions(), library.editDraft.gender || 'ai-auto')}</select>
                  <select onchange="aadUpdatePersonaModelDraft('expression',this.value)">${optionTags(personaExpressionOptions(), library.editDraft.expression || 'confident-bright')}</select>
                  <select onchange="aadUpdatePersonaModelDraft('framing',this.value)">${optionTags(personaFramingOptions(), library.editDraft.framing || 'waist-up')}</select>
                </div>
                <input value="${esc(library.editDraft.hair || '')}" placeholder="헤어/얼굴 특징" oninput="aadUpdatePersonaModelDraft('hair',this.value)">
                <input value="${esc(library.editDraft.outfit || '')}" placeholder="의상/색상" oninput="aadUpdatePersonaModelDraft('outfit',this.value)">
                <input value="${esc(library.editDraft.brand_detail || '')}" placeholder="브랜드 디테일" oninput="aadUpdatePersonaModelDraft('brand_detail',this.value)">
                <textarea rows="4" placeholder="모델 만들기 룰" oninput="aadUpdatePersonaModelDraft('rules',this.value)">${esc(library.editDraft.rules || '')}</textarea>
                <input value="${esc(library.editDraft.image_url || '')}" placeholder="기준 이미지 URL" oninput="aadUpdatePersonaModelDraft('image_url',this.value)">
                <div><button type="button" onclick="aadUpdatePersonaModel(${Number(item.id)})">저장</button><button type="button" onclick="aadCancelPersonaModelEdit()">취소</button></div>
              </article>
            `;
          }
          return `
            <article class="aad-model-library-item ${selectedID === Number(item.id) ? 'selected' : ''}" onclick="aadPreviewPersonaModel(${Number(item.id)})" title="크게 보기">
              ${item.image_url ? '<img src="' + esc(item.image_url) + '" alt="">' : '<span class="aad-model-no-image">이미지 없음</span>'}
              <div><b>${esc(title)}</b><span>${esc(item.label || item.settings?.persona_label || '저장된 주인공 모델')}</span></div>
              <button type="button" onclick="event.stopPropagation(); aadApplyPersonaModel(${Number(item.id)})">적용</button>
              <button type="button" onclick="event.stopPropagation(); aadEditPersonaModel(${Number(item.id)})">수정</button>
              <button type="button" class="danger" onclick="event.stopPropagation(); aadDeletePersonaModel(${Number(item.id)})">삭제</button>
            </article>
          `;
        }).join('') : '<div class="aad-model-library-empty">아직 저장된 모델이 없습니다. 모델 만들기를 누르면 자동 저장됩니다.</div>'}
      </div>
    `;
  }

  function renderPersonaModelPreviewModal() {
    const id = Number(state.personaLibrary.previewId || 0);
    if (!id) return '';
    const item = state.personaLibrary.items.find(function (model) { return Number(model.id) === id; });
    if (!item) return '';
    const settings = item.settings || {};
    const title = item.name || item.label || '주인공 모델';
    const desc = settings.persona_description || item.prompt || '저장된 모델 설명이 없습니다.';
    const rules = settings.persona_rules || DEFAULT_PERSONA_RULES;
    const optionSummary = personaModelOptionSummary(settings.persona_options || {});
    return `
      <div class="aad-model-preview-backdrop" onclick="aadClosePersonaModelPreview()">
        <section class="aad-model-preview-modal" onclick="event.stopPropagation()">
          <div class="aad-model-preview-head">
            <div>
              <b>저장 모델 크게 보기</b>
              <h3>${esc(title)}</h3>
              <span>${esc(item.label || settings.persona_label || '저장된 주인공 모델')}</span>
            </div>
            <button type="button" onclick="aadClosePersonaModelPreview()">닫기</button>
          </div>
          <div class="aad-model-preview-body">
            <div class="aad-model-preview-image">
              ${item.image_url ? '<img src="' + esc(item.image_url) + '" alt="">' : '<div>기준 이미지 없음</div>'}
            </div>
            <div class="aad-model-preview-info">
              <dl>
                <div><dt>모델 설명</dt><dd>${esc(desc)}</dd></div>
                <div><dt>모델 생성 옵션</dt><dd>${esc(optionSummary)}</dd></div>
                <div><dt>모델 만들기 룰</dt><dd>${esc(rules)}</dd></div>
                <div><dt>제작 방식</dt><dd>${esc(settings.production_mode || field('aad-production-mode', DEFAULT_PRODUCTION_MODE))}</dd></div>
                <div><dt>스타일</dt><dd>${esc(settings.animation_style || field('aad-animation-style', 'world-class-commercial'))}</dd></div>
                <div><dt>모델 엔진</dt><dd>${esc([item.provider, item.model].filter(Boolean).join(' · ') || '저장 정보 없음')}</dd></div>
              </dl>
              <div class="aad-model-preview-actions">
                <button type="button" onclick="aadApplyPersonaModel(${id}); aadClosePersonaModelPreview()">이 모델 적용</button>
                <button type="button" onclick="aadEditPersonaModelFromPreview(${id})">수정</button>
                <button type="button" class="danger" onclick="aadDeletePersonaModel(${id})">삭제</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderPersonaModelStatus() {
    const persona = currentPersona();
    const items = referenceImageGroups().persona;
    const shouldGenerate = shouldUseGeneratedPersonaModel();
    const busy = !!state.generating.persona;
    const saving = !!state.personaLibrary.saving;
    const title = shouldGenerate ? '고정 모델 기준 이미지' : '모델 기준 이미지 생략';
    const desc = shouldGenerate
      ? (items.length ? '이 이미지가 모든 씬의 주인공 reference로 들어갑니다.' : '아직 모델 reference가 없어 씬마다 인물이 바뀔 수 있습니다.')
      : (persona.value === 'product-as-hero' ? '현재는 제품이 주인공이라 상품 reference를 기준으로 유지합니다.' : '현재 설정은 페르소나 없음입니다.');
    const autoModelNotice = shouldGenerate && !items.length
      ? '<div class="aad-model-auto-note"><b>모델 이미지는 4단계에서 생성</b><span>콘티 단계는 텍스트만 빠르게 작성합니다. 모델 기준 이미지는 4단계 기준 이미지 생성에서 만들거나 저장 모델을 적용하세요.</span></div>'
      : '';
    return `
      <input type="hidden" id="aad-persona-model-id" value="${formValue('aad-persona-model-id', '')}">
      <div class="aad-persona-model-wrap">
        <div class="aad-model-step-note">
          <b>선택 · 고정 모델 기준 이미지</b>
          <span>콘티는 이미지 없이 먼저 만들 수 있습니다. 인물 일관성이 필요하면 4단계에서 모델 이미지를 만들거나 저장 모델을 적용하세요.</span>
        </div>
        <div class="aad-persona-model-card ${items.length ? 'ready' : 'pending'}">
          <div>
            <b>${esc(title)}</b>
            <span>${esc(desc)}</span>
          </div>
          <div class="aad-persona-model-actions">
            <button type="button" onclick="aadOpenPersonaModelBuilder()"${shouldGenerate && !state.busy ? '' : ' disabled'}>${busy ? '모델 생성중...' : (items.length ? '옵션 수정/재생성' : '모델 만들기')}</button>
            <button type="button" onclick="aadSavePersonaModel()"${shouldGenerate && !saving ? '' : ' disabled'}>${saving ? '저장중...' : '모델 저장'}</button>
          </div>
          ${items.length ? '<img src="' + esc(items[0]) + '" alt="">' : ''}
        </div>
        <div class="aad-persona-option-summary">
          <b>현재 모델 옵션</b>
          <span>${esc(personaModelOptionSummary(personaModelOptions()).replace(/\n/g, ' · '))}</span>
        </div>
        ${autoModelNotice}
        ${renderPersonaModelLibrary()}
      </div>
    `;
  }

  function renderPersonaModelOptions() {
    return `
      <div class="aad-persona-options-panel">
        <div class="aad-persona-options-head">
          <div><b>모델 생성 옵션</b><span>모델 만들기 전에 기준 인물/캐릭터를 정합니다.</span></div>
        </div>
        <div class="aad-persona-options-grid">
          <label>모델 역할<select id="aad-persona-type" onchange="aadRefreshStyleGuide()">${optionTags(personaOptions(), state.form['aad-persona-type'])}</select><span id="aad-persona-type-guide">${esc(currentPersona().guide)}</span></label>
          <label>연령<select id="aad-persona-age">${optionTags(personaAgeOptions(), state.form['aad-persona-age'])}</select></label>
          <label>성별/인상<select id="aad-persona-gender">${optionTags(personaGenderOptions(), state.form['aad-persona-gender'])}</select></label>
          <label>표정 에너지<select id="aad-persona-expression">${optionTags(personaExpressionOptions(), state.form['aad-persona-expression'])}</select></label>
          <label>기준 구도<select id="aad-persona-framing">${optionTags(personaFramingOptions(), state.form['aad-persona-framing'])}</select></label>
          <label>헤어/얼굴<input id="aad-persona-hair" value="${formValue('aad-persona-hair', '')}" placeholder="예: 짧은 검은 단발, 선명한 눈매"></label>
          <label>의상/색상<input id="aad-persona-outfit" value="${formValue('aad-persona-outfit', '')}" placeholder="예: 오렌지 재킷, 검정 이너"></label>
          <label>브랜드 디테일<input id="aad-persona-brand-detail" value="${formValue('aad-persona-brand-detail', '')}" placeholder="예: 작은 오렌지 배지, 앱 아이콘 소품"></label>
        </div>
        <label class="aad-persona-description-box">직접 설명<textarea id="aad-persona-description" rows="3" placeholder="예: 30대 초반 브랜드 크리에이터. 빠른 손동작, 자신감 있는 미소, 마케케 오렌지 포인트를 자연스럽게 착용.">${formValue('aad-persona-description', '')}</textarea></label>
      </div>
    `;
  }

  function openPersonaModelBuilder() {
    state.personaModelModalOpen = true;
    render();
  }

  function closePersonaModelBuilder() {
    state.personaModelModalOpen = false;
    render();
  }

  async function buildPersonaModelFromModal() {
    syncForm();
    const ok = await generatePersonaModelReference({ allowBusy: false });
    if (ok) state.personaModelModalOpen = false;
    render();
  }

  async function savePersonaModelFromModal() {
    syncForm();
    await saveCurrentPersonaModel();
    state.personaModelModalOpen = false;
    render();
  }

  function renderPersonaModelBuilderModal() {
    if (!state.personaModelModalOpen) return '';
    const items = referenceImageGroups().persona;
    const busy = !!state.generating.persona;
    const saving = !!state.personaLibrary.saving;
    return `
      <div class="aad-model-builder-backdrop" onclick="if(event.target===this)aadClosePersonaModelBuilder()">
        <section class="aad-model-builder-modal">
          <div class="aad-model-builder-head">
            <div>
              <b>모델 만들기</b>
              <h3>주인공 모델 옵션 설정</h3>
              <span>여기서 정한 옵션과 룰이 기준 이미지 생성과 저장 모델에 함께 남습니다.</span>
            </div>
            <button type="button" onclick="aadClosePersonaModelBuilder()">닫기</button>
          </div>
          <div class="aad-model-builder-body">
            <div class="aad-model-builder-main">
              ${renderPersonaModelOptions()}
              <details class="aad-persona-rule-editor" open>
                <summary><b>모델 만들기 룰</b><span>한 명, 한 포즈, 한 프레임 기준을 유지합니다.</span></summary>
                <textarea id="aad-persona-rules" rows="6" placeholder="예: 한 명의 주인공, 한 포즈, 한 프레임만 생성">${formValue('aad-persona-rules', DEFAULT_PERSONA_RULES)}</textarea>
              </details>
            </div>
            <aside class="aad-model-builder-preview">
              <b>현재 기준 이미지</b>
              ${items.length ? '<img src="' + esc(items[0]) + '" alt="">' : '<div>아직 생성된 모델 이미지가 없습니다.</div>'}
              <span>${esc(personaModelOptionSummary(personaModelOptions()))}</span>
            </aside>
          </div>
          <div class="aad-model-builder-actions">
            <button type="button" onclick="aadBuildPersonaModelFromModal()"${busy || state.busy ? ' disabled' : ''}>${busy ? '모델 생성중...' : (items.length ? '이 옵션으로 재생성' : '이 옵션으로 모델 생성')}</button>
            <button type="button" onclick="aadSavePersonaModelFromModal()"${saving ? ' disabled' : ''}>${saving ? '저장중...' : '현재 모델 저장'}</button>
          </div>
        </section>
      </div>
    `;
  }

  function referenceField(type) {
    return {
      product: 'aad-product-images',
      brand: 'aad-brand-images',
      persona: 'aad-persona-images',
      general: 'aad-reference-images',
    }[type] || 'aad-reference-images';
  }

  function referenceItems(type) {
    return lines(field(referenceField(type), ''));
  }

  function profileBrandReferenceItems() {
    const profile = currentProfileContext();
    return uniqueStrings([profile?.logo_url].concat(profile?.image_urls || []));
  }

  function renderProfileBrandReferencePreview() {
    const items = profileBrandReferenceItems();
    const ctx = currentProfileContext();
    const logoDisabled = !!ctx?.raw_logo_url && !ctx.logo_reference_enabled;
    if (!items.length) {
      if (logoDisabled) {
        return '<div class="aad-brand-ref-empty">프로필 로고 참조를 껐습니다. 장면 안에 로고를 넣고 싶으면 다시 켜거나 브랜드 참고 이미지에 직접 추가하세요.</div>';
      }
      return '<div class="aad-brand-ref-empty">프로필 로고/브랜드 이미지가 없으면 아래 브랜드 참고 이미지에서 추가하세요.</div>';
    }
    return `
      <div class="aad-brand-ref-preview">
        <div><b>프로필 브랜드 이미지 자동 반영</b><span>${logoDisabled ? '프로필 로고는 제외하고 브랜드 이미지만 reference로 전달합니다.' : '이미지/영상 생성 reference로 전달해 장면 안의 패키지, 간판, 앱 아이콘, 유니폼 패치, 소품에 자연스럽게 녹입니다.'}</span></div>
        <div class="aad-brand-ref-strip">
          ${items.slice(0, 6).map(function (url, index) {
            const label = !logoDisabled && index === 0 ? '프로필 로고' : '브랜드 이미지';
            return '<figure><img src="' + esc(url) + '" alt=""><figcaption>' + label + '</figcaption></figure>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function setReferenceItems(type, urls) {
    const fieldId = referenceField(type);
    const unique = [];
    const seen = new Set();
    (urls || []).forEach(function (url) {
      const value = String(url || '').trim();
      if (value && !seen.has(value)) {
        unique.push(value);
        seen.add(value);
      }
    });
    setInput(fieldId, unique.join('\n'));
    invalidateQuality();
    scheduleHistoryAutosave();
  }

  function renderReferenceUploader(type, title, desc) {
    const items = referenceItems(type);
    const fieldId = referenceField(type);
    return `
      <div class="aad-ref-upload-card">
        <textarea id="${esc(fieldId)}" class="aad-hidden-field">${formValue(fieldId, '')}</textarea>
        <div class="aad-ref-upload-head">
          <div><b>${esc(title)}</b><span>${esc(desc)}</span></div>
          <button type="button" onclick="document.getElementById('aad-ref-${esc(type)}-input').click()">이미지 선택</button>
          <input id="aad-ref-${esc(type)}-input" type="file" accept="image/*" multiple onchange="aadUploadReferenceImages('${esc(type)}',this.files)" hidden>
        </div>
        <div class="aad-ref-upload-grid">
          ${items.length ? items.map(function (url, index) {
            return '<div class="aad-ref-thumb"><img src="' + esc(url) + '" alt=""><button type="button" onclick="aadRemoveReferenceImage(&quot;' + esc(type) + '&quot;,' + index + ')">삭제</button></div>';
          }).join('') : '<div class="aad-ref-empty">아직 선택한 이미지가 없습니다.</div>'}
        </div>
      </div>
    `;
  }

  function renderReferenceUploaders() {
    return `
      <div class="aad-reference-uploaders">
        ${renderReferenceUploader('product', '상품 참고 이미지', '제품 형태, 패키지, 재질, 색, 디테일을 고정합니다.')}
        ${renderReferenceUploader('brand', '브랜드 로고/디자인 참고', '실제 로고, 브랜드 색, 디자인 규칙, 매장/공간 정체성을 이미지 안에 자연스럽게 유지합니다.')}
        ${renderReferenceUploader('persona', '모델/페르소나 참고 이미지', '반복 등장할 모델, 크리에이터, 캐릭터의 얼굴·헤어·의상·포즈를 고정합니다.')}
        ${renderReferenceUploader('general', '분위기 참고 이미지', '광고 무드, 배경, 경쟁 광고, 조명 느낌을 참고합니다.')}
      </div>
    `;
  }

  async function uploadReferenceImages(type, files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setBusy('참고 이미지를 업로드하는 중...');
    try {
      const form = new FormData();
      list.forEach(function (file) { form.append('files', file); });
      const res = await fetch('/api/content/upload-image', { method: 'POST', body: form });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.status !== 'ok') throw new Error(data.detail || data.error || '이미지 업로드 실패');
      const urls = (Array.isArray(data.images) ? data.images : [])
        .map(function (item) { return typeof item === 'string' ? item : item?.url; })
        .filter(Boolean);
      setReferenceItems(type, referenceItems(type).concat(urls));
      addLog('참고 이미지 ' + urls.length + '장을 추가했습니다.', 'success');
    } catch (err) {
      addLog('참고 이미지 업로드 실패: ' + err.message, 'error');
      alert('참고 이미지 업로드 실패: ' + err.message);
    } finally {
      const input = document.getElementById('aad-ref-' + type + '-input');
      if (input) input.value = '';
      setBusy('');
    }
  }

  async function generatePersonaModelReference(opts) {
    const options = opts || {};
    if (!shouldUseGeneratedPersonaModel()) {
      if (!options.silent) alert('현재 설정은 별도 모델 기준 이미지가 필요하지 않습니다.');
      return false;
    }
    if (state.busy && !options.allowBusy) return false;
    syncModelPicker();
    const imageModel = field('aad-image-model', state.modelSettings.image_model || 'openai/gpt-image-2-developer/text-to-image');
    const imageEngine = imageModel === 'codex-cli' ? 'codex' : field('aad-image-engine', 'gemini');
    const provider = imageEngine === 'codex' ? 'codex' : 'gemini';
    state.generating.persona = true;
    setBusy('작동중 · 고정 모델 기준 이미지 생성중');
    try {
      const data = await apiJSON('/api/hyperframes/generate-bg-image', {
        topic: field('aad-topic', '쇼츠 광고'),
        objective: field('aad-objective', ''),
        tone: field('aad-tone', ''),
        profile_context: currentProfileContext(),
        aspect: field('aad-aspect', '9:16'),
        provider: provider,
        model: provider === 'codex' ? 'codex-cli' : imageModel,
        style: currentAnimationStyle(),
        scene_title: '고정 모델 기준 이미지',
        scene_body: currentPersona().label + ' / ' + currentPersona().guide,
        narration: '',
        prompt: buildPersonaModelImagePrompt(),
        reference_images: [].concat(referenceImageGroups().brand, referenceImageGroups().product, referenceImageGroups().general).slice(0, 8),
        product_reference_images: referenceImageGroups().product,
        brand_reference_images: referenceImageGroups().brand,
        persona_reference_images: [],
        scene_index: 0,
        duration: 3,
      });
      if (!data.url) throw new Error('모델 이미지 URL이 없습니다');
      setReferenceItems('persona', [data.url].concat(referenceItems('persona')));
      addLog('고정 모델 기준 이미지 생성 완료 · 모든 씬 reference에 자동 반영됩니다.', 'success');
      if (options.saveToLibrary !== false) {
        await saveCurrentPersonaModel({ silent: true, imageUrl: data.url, allowBusy: true, skipGenerate: true });
      }
      await saveHistoryCheckpoint('모델 기준 이미지');
      return true;
    } catch (err) {
      addLog('고정 모델 기준 이미지 생성 실패: ' + err.message, 'error');
      if (!options.silent) alert('고정 모델 기준 이미지 생성 실패: ' + err.message);
      return false;
    } finally {
      state.generating.persona = false;
      setBusy('');
    }
  }

  function removeReferenceImage(type, index) {
    const items = referenceItems(type);
    items.splice(index, 1);
    setReferenceItems(type, items);
    render();
  }

  function selectedDuration() {
    const value = numericField('aad-duration', DEFAULT_DURATION);
    return value >= 45 ? 60 : 30;
  }

  function sceneDuration() {
    const total = selectedDuration();
    const count = Math.max(1, state.scenes.length || numericField('aad-scene-count', DEFAULT_SCENE_COUNT));
    return Math.max(4, Math.min(8, Math.round((total / count) * 10) / 10));
  }

  function cutKey(sceneIndex, cutIndex) {
    return String(sceneIndex) + '-' + String(cutIndex);
  }

  function ensureMicroCuts(scene, sceneIndex) {
    if (!scene) return [];
    if (!Array.isArray(scene.micro_cuts)) scene.micro_cuts = [];
    while (scene.micro_cuts.length < MIN_MICRO_CUTS) {
      const cutIndex = scene.micro_cuts.length;
      scene.micro_cuts.push(buildDefaultMicroCut(scene, sceneIndex, cutIndex));
    }
    scene.micro_cuts.forEach(function (cut, cutIndex) {
      if (cut && !cut.vfx_preset) cut.vfx_preset = currentVFXPreset().value;
      if (cut) enrichCutCameraMotion(sceneIndex, cutIndex, scene, cut);
    });
    return scene.micro_cuts;
  }

  function buildDefaultMicroCut(scene, sceneIndex, cutIndex) {
    const hook = currentAttentionHook();
    const labels = ['갈등 훅', '이상한 징후', '디테일 반전', '리액션 피크', '해결 연결'];
    const actions = [
      hook.value === 'comedy-twist' ? '평범한 상황이 예상 밖의 웃긴 문제로 뒤집히며 시선을 고정한다' : '주인공이나 상품 주변에 갈등이 생기며 시선을 고정한다',
      scene.subject_action || '문제 신호가 커지고 주인공/상품/공간이 반응하기 시작한다',
      hook.value === 'sensual-premium' ? '조명, 질감, 손동작, 시선의 디테일로 관능적인 긴장을 만든다' : '상품/공간/표정의 결정적 디테일이 반전처럼 드러난다',
      hook.value === 'meme-chaos' ? '과장된 표정, 동작, 시각적 농담으로 장면의 리액션 피크를 만든다' : '빛, 표정, 카메라 속도를 올려 장면의 감정 피크를 만든다',
      scene.transition || '해결 기대감이 다음 장면으로 이어지는 방향성 있는 움직임으로 마무리한다',
    ];
    return {
      title: labels[cutIndex] || ('마이크로 컷 ' + (cutIndex + 1)),
      action: actions[cutIndex] || (scene.subject_action || scene.body || ''),
      camera: cutIndex === 0 ? (scene.shot_type || 'establishing shot') : (scene.camera || 'smooth commercial camera move'),
      copy: cutIndex === 0 ? (scene.title || '') : (cutIndex === MIN_MICRO_CUTS - 1 ? (scene.body || scene.narration || '') : ''),
      sound_cue: cutIndex === 0 ? (scene.sound_cue || 'soft hit') : (scene.edit_beat || 'motion accent'),
      vfx_preset: currentVFXPreset().value,
      vfx_cue: cutIndex === 0 ? 'subtle reveal glow' : (cutIndex === 3 ? 'peak impact burst' : currentVFXPreset().guide),
      role: ['hook', 'product', 'proof', 'peak', 'transition'][cutIndex] || 'rhythm',
      importance: cutIndex === 0 ? 95 : (cutIndex === 3 ? 82 : (cutIndex === MIN_MICRO_CUTS - 1 ? 76 : 64)),
      image_prompt: [hook.label, scene.image_prompt || scene.body || scene.title || '', actions[cutIndex] || ''].filter(Boolean).join(' / '),
      video_prompt: [currentStoryArc().label, hook.label, scene.cut_plan || scene.subject_action || scene.camera || '', actions[cutIndex] || ''].filter(Boolean).join(' / '),
    };
  }

  function allCutRefs() {
    const refs = [];
    state.scenes.forEach(function (scene, sceneIndex) {
      ensureMicroCuts(scene, sceneIndex).forEach(function (cut, cutIndex) {
        refs.push({ scene: scene, sceneIndex: sceneIndex, cut: cut, cutIndex: cutIndex, key: cutKey(sceneIndex, cutIndex), order: refs.length });
      });
    });
    return refs;
  }

  function targetVideoClipCount() {
    const duration = selectedDuration();
    const sceneCount = Math.max(1, state.scenes.length || numericField('aad-scene-count', DEFAULT_SCENE_COUNT));
    if (duration <= 30) return Math.max(sceneCount, Math.min(12, sceneCount * 2));
    return Math.max(sceneCount, Math.min(24, sceneCount * 2));
  }

  function pushUniqueRef(list, seen, ref) {
    if (!ref || seen.has(ref.key)) return;
    seen.add(ref.key);
    list.push(ref);
  }

  function videoCutText(ref) {
    if (!ref) return '';
    return [
      ref.scene?.title,
      ref.scene?.body,
      ref.scene?.role,
      ref.scene?.visual_mode,
      ref.cut?.title,
      ref.cut?.action,
      ref.cut?.copy,
      ref.cut?.sound_cue,
      ref.cut?.vfx_cue,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function normalizeMetaItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (item) {
      if (typeof item === 'string') return { name: item, detail: '' };
      if (!item || typeof item !== 'object') return null;
      return {
        name: String(item.name || item.title || item.axis || item.criteria || item.label || '').trim(),
        detail: String(item.detail || item.reason || item.description || item.value || item.note || '').trim(),
        status: String(item.status || item.result || '').trim(),
      };
    }).filter(function (item) { return item && item.name; });
  }

  function normalizeCreativeField(field) {
    const source = field && typeof field === 'object' ? field : {};
    const name = String(source.name || source.field_name || source.title || '').trim();
    const core = String(source.core || source.thesis || source.one_line || source.description || '').trim();
    const tension = String(source.tension || source.conflict || source.hidden_tension || '').trim();
    const desire = String(source.desire || source.customer_desire || source.emotion || '').trim();
    const exception = String(source.exception || source.exceptionality || source.purple_cow || '').trim();
    const gravity = String(source.gravity || source.brand_gravity || source.reason || '').trim();
    const massRule = String(source.mass_rule || source.coupling_rule || source.rule || '').trim();
    if (!name && !core && !tension && !desire && !exception && !gravity && !massRule) return null;
    return {
      name: name || '광고 중심장',
      core: core,
      tension: tension,
      desire: desire,
      exception: exception,
      gravity: gravity,
      mass_rule: massRule,
    };
  }

  function normalizeStoryboardMeta(meta) {
    const source = meta && typeof meta === 'object' ? meta : {};
    return {
      creative_field: normalizeCreativeField(source.creative_field || source.meaning_field || source.field),
      selection_strategy: String(source.selection_strategy || source.strategy || '').trim(),
      selection_criteria: normalizeMetaItems(source.selection_criteria || source.criteria),
      creative_audit: normalizeMetaItems(source.creative_audit || source.audit),
      diversity_axes: normalizeMetaItems(source.diversity_axes || source.axes),
      required_roles: normalizeMetaItems(source.required_roles || source.roles),
      field_questions: normalizeMetaItems(source.field_questions || source.questions),
      field_constraints: normalizeMetaItems(source.field_constraints || source.constraints),
    };
  }

  function roleLabelFromCut(ref) {
    return compactText(
      ref?.cut?.selection_reason ||
      ref?.cut?.field_coupling_reason ||
      ref?.cut?.selection_role ||
      ref?.cut?.role ||
      ref?.scene?.role ||
      ref?.scene?.retention_goal ||
      '',
      34
    );
  }

  function videoCutReason(ref) {
    if (!ref) return '선별 이유 없음';
    const explicit = roleLabelFromCut(ref);
    if (explicit) return explicit;
    const cuts = ensureMicroCuts(ref.scene, ref.sceneIndex);
    if (ref.order === 0) return '첫 컷';
    if (ref.cutIndex === Math.max(0, cuts.length - 1)) return '씬 연결';
    return 'AI 중요도 ' + Math.max(0, Math.min(100, Number(ref.cut?.importance || 0)));
  }

  function videoCutScore(ref) {
    if (!ref) return 0;
    const cuts = ensureMicroCuts(ref.scene, ref.sceneIndex);
    let score = Math.max(0, Math.min(100, Number(ref.cut?.importance || 0)));
    if (ref.cut?.field_coupling_score != null) score += Math.max(0, Math.min(50, Number(ref.cut.field_coupling_score) || 0));
    if (ref.cut?.creative_mass != null) score += Math.max(0, Math.min(35, Number(ref.cut.creative_mass) || 0));
    if (ref.cut?.selected_priority != null) score += Math.max(0, Math.min(40, Number(ref.cut.selected_priority) || 0));
    if (ref.cut?.selection_reason || ref.cut?.shot_diversity_reason) score += 10;
    if (ref.cut?.copy) score += 5;
    if (ref.cut?.image_prompt) score += 3;
    if (ref.cut?.video_prompt) score += 3;
    if (ref.order === 0) score += 14;
    if (ref.cutIndex === 0) score += 8;
    if (ref.cutIndex === Math.max(0, cuts.length - 1)) score += 8;
    return score;
  }

  function cutDiversitySignature(ref) {
    return compactText(
      ref?.cut?.shot_diversity_reason ||
      ref?.cut?.field_coupling_reason ||
      ref?.cut?.visual_axis ||
      ref?.cut?.shot_role ||
      ref?.scene?.visual_axis ||
      [ref?.cut?.camera || ref?.scene?.camera, videoCutReason(ref)].filter(Boolean).join(' · '),
      52
    );
  }

  function dynamicStoryboardAudit(refs, videoRefs) {
    const list = videoRefs && videoRefs.length ? videoRefs : refs;
    const roles = Array.from(new Set(list.map(videoCutReason).filter(Boolean)));
    const axes = Array.from(new Set(list.map(cutDiversitySignature).filter(Boolean)));
    const first = list[0] ? compactText([list[0].cut?.title, list[0].cut?.action].filter(Boolean).join(' · '), 80) : '콘티 없음';
    const last = list[list.length - 1] ? compactText([list[list.length - 1].cut?.title, list[list.length - 1].cut?.action].filter(Boolean).join(' · '), 80) : '콘티 없음';
    return [
      { name: '선별 컷 역할', status: roles.length ? '검토' : '대기', detail: roles.slice(0, 6).join(', ') || 'AI 콘티 생성 후 표시됩니다.' },
      { name: '시각 문법 축', status: axes.length ? '검토' : '대기', detail: axes.slice(0, 6).join(', ') || '컷별 shot_diversity_reason이 필요합니다.' },
      { name: '첫 컷', status: '검토', detail: first },
      { name: '마지막 컷', status: '검토', detail: last },
    ];
  }

  function storyboardCreativeAuditItems(refs, videoRefs) {
    return state.storyboardMeta.creative_audit.length
      ? state.storyboardMeta.creative_audit
      : dynamicStoryboardAudit(refs, videoRefs);
  }

  function storyboardSelectionCriteria(duration, refs, videoRefs) {
    if (state.storyboardMeta.selection_criteria.length) return state.storyboardMeta.selection_criteria;
    return [
      { name: '영상 길이', detail: duration + '초 · 콘티 ' + refs.length + '컷 중 실제 영상 ' + (videoRefs.length || videoCutTotal()) + '컷' },
      { name: '광고 중심장 결합', detail: '각 컷의 중심 결합값, 창조 질량, 선별 이유를 합산해 선별합니다.' },
      { name: '씬 균형', detail: '각 씬의 대표 컷을 먼저 검토한 뒤 전체 리듬 컷을 섞습니다.' },
      { name: '컷 다양성', detail: 'AI가 반환한 shot_diversity_reason과 visual_axis를 화면에 표시합니다.' },
    ];
  }

  function renderCreativeFieldPanel() {
    const fieldMeta = state.storyboardMeta.creative_field;
    if (!fieldMeta) {
      return '<div class="aad-creative-field pending"><b>광고 중심장</b><span>1단계 컨셉과 3단계 콘티를 만들면 AI가 브랜드 안의 보이지 않는 창조장을 생성합니다. 이후 컷은 이 장과의 결합값으로 선별됩니다.</span></div>';
    }
    const items = [
      ['핵심 장', fieldMeta.core],
      ['긴장', fieldMeta.tension],
      ['욕망/감정', fieldMeta.desire],
      ['예외성', fieldMeta.exception],
      ['브랜드 중력', fieldMeta.gravity],
      ['질량 규칙', fieldMeta.mass_rule],
    ].filter(function (item) { return item[1]; });
    return `
      <div class="aad-creative-field">
        <div>
          <b>${esc(fieldMeta.name || '광고 중심장')}</b>
          <span>보이지 않지만 모든 컷의 의미와 무게를 결정하는 창조장입니다.</span>
        </div>
        <ul>
          ${items.map(function (item) {
            return '<li><strong>' + esc(item[0]) + '</strong><span>' + esc(item[1]) + '</span></li>';
          }).join('')}
        </ul>
      </div>
    `;
  }

  function creativeFieldMeta() {
    return state.storyboardMeta.creative_field || null;
  }

  function draftCreativeFieldMeta() {
    const meta = creativeFieldMeta();
    if (meta) return meta;
    const profile = currentProfileContext();
    return normalizeCreativeField({
      name: (profile?.brand || finalBrandNameValue() || '브랜드') + ' 광고 중심장',
      core: field('aad-topic', '쇼츠 광고') + '를 광고처럼 보이지 않는 사건으로 보여준다',
      tension: currentAttentionHook().label + ' · ' + currentHookRecipe().label,
      desire: field('aad-objective', '첫 3초 주목, 제품 기억, 클릭 전환'),
      exception: currentExceptionRule().label,
      gravity: (profile?.brand || finalBrandNameValue() || '브랜드') + '의 실제 강점과 소재 입력에서 개연성을 만든다',
      mass_rule: currentCreativityRule().name + ' 기준으로 멈춤, 반전, 리액션, 증거, 각인을 가진 컷에 무게를 준다',
    });
  }

  function instantStoryboardSceneCount() {
    const duration = selectedDuration();
    const requested = numericField('aad-scene-count', DEFAULT_SCENE_COUNT);
    const cap = duration <= 35 ? 4 : 6;
    return Math.max(3, Math.min(cap, requested || cap));
  }

  function instantSceneTitle(parts, index) {
    const picked = parts.filter(Boolean).map(function (item) { return compactText(item, 16); });
    return picked[index % Math.max(1, picked.length)] || ('장면 ' + (index + 1));
  }

  function buildInstantStoryboardMeta(pack, detail, sceneCount) {
    const profile = currentProfileContext();
    const brand = profile?.brand || finalBrandNameValue() || '브랜드';
    const source = compactText(field('aad-source', field('aad-user-intent', '')), 70);
    const hook = currentAttentionHook();
    const recipe = currentHookRecipe();
    const exception = currentExceptionRule();
    const creativity = currentCreativityRule();
    return normalizeStoryboardMeta({
      creative_field: {
        name: compactText((pack?.label || brand) + ' 광고 중심장', 28),
        core: detail?.hook || source || field('aad-topic', '쇼츠 광고') + '를 광고처럼 보이지 않는 사건으로 시작한다',
        tension: hook.label + ' · ' + recipe.label,
        desire: field('aad-objective', '첫 3초 주목, 제품 기억, 클릭 전환'),
        exception: exception.label + ' · ' + (detail?.visual || exception.guide || ''),
        gravity: brand + '라서 가능한 이유를 마지막 브랜드 기억으로 회수한다',
        mass_rule: creativity.name + ' 기준으로 훅, 반전, 감정 피크, 제품 진실, 브랜드 기억이 강한 컷을 선별한다',
      },
      selection_strategy: '빠른 초안은 3~6개 씬만 먼저 만들고, 실제 영상화 컷은 다음 단계에서 이미지가 필요한 후보만 선별한다.',
      selection_criteria: [
        { name: '첫 1초 정지력', detail: hook.label + '로 스크롤을 멈추게 하는가' },
        { name: '감정 전환', detail: '놀람, 긴장, 웃음, 안도 중 하나가 컷 안에서 변하는가' },
        { name: '제품 진실 연결', detail: '소재 입력과 브랜드 강점으로 개연성이 회수되는가' },
        { name: '컷 다양성', detail: '카메라 거리, 앵글, 이동 방향, 초점 변화가 반복되지 않는가' },
      ],
      creative_audit: [
        { name: '광고 냄새 배제', status: '제품 설명, 혜택 나열, 로고 인트로를 초반에서 제거' },
        { name: '브랜드 자연 삽입', status: '로고/색은 장면 안 소품과 마지막 컷에서만 자연스럽게 사용' },
        { name: '초안 속도', status: sceneCount + '개 씬 빠른 초안으로 먼저 진행' },
      ],
      diversity_axes: [
        { name: '카메라 축', detail: '매크로, 핸드헬드, 궤도, 탑다운, 전경 가림을 섞음' },
        { name: '감정 축', detail: hook.label + '에서 ' + recipe.label + '로 전환' },
        { name: '시각 축', detail: currentProductionMode().label + ' · ' + currentAspectSpec().value },
      ],
      required_roles: [
        { name: '훅', detail: '첫 화면만 봐도 무슨 일이 났는지 궁금해야 함' },
        { name: '문제', detail: '시청자가 자기 문제처럼 느끼는 마찰 제시' },
        { name: '반전', detail: '업종 클리셰를 깨는 낯선 해결 방향' },
        { name: '증거', detail: '상품/브랜드 진실이 행동으로 보임' },
        { name: '브랜드 기억', detail: '마지막에만 이름과 색이 선명하게 남음' },
      ],
      field_questions: [
        { name: '왜 멈추나', detail: hook.guide },
        { name: '왜 믿나', detail: source || field('aad-topic', '쇼츠 광고') },
        { name: '왜 공유하나', detail: '입소문 장치와 예외성이 한 문장으로 설명되는가' },
      ],
      field_constraints: [
        { name: '자막 절제', detail: '중간 표어는 짧은 감정 펀치만 사용' },
        { name: '9:16 우선', detail: currentAspectSpec().guide },
      ],
    });
  }

  function buildInstantCut(scene, sceneIndex, cutIndex, role, context) {
    const motion = cameraMotionProfile(sceneIndex, cutIndex);
    const detail = context.detail || {};
    const source = context.source || '';
    const profile = context.profile || {};
    const brand = profile.brand || finalBrandNameValue() || '브랜드';
    const roleCopy = {
      hook: ['멈추게 하는 사건', '첫 화면에 이상 신호가 터진다'],
      problem: ['문제가 눈에 보임', '고객의 막힘이 물리적인 장면으로 드러난다'],
      twist: ['규칙이 뒤집힘', '업종 공식과 다른 방식으로 해결 단서가 나타난다'],
      proof: ['증거가 움직임으로 보임', '상품/서비스 가치가 말이 아니라 행동으로 증명된다'],
      peak: ['감정 피크', '표정, 빛, 속도가 함께 올라가며 기억점을 만든다'],
      brand: ['마지막 각인', brand + '가 장면 속 오브젝트와 색으로 자연스럽게 남는다'],
    };
    const picked = roleCopy[role] || roleCopy.hook;
    const sloganBase = cleanSloganText(detail.slogan || detail.hook || picked[0], picked[0]);
    const visual = [detail.visual, source, currentAnimationStyle().label, currentProductionMode().label].filter(Boolean).join(' / ');
    const action = [
      picked[1],
      scene.body || scene.retention_goal || '',
      role === 'brand' ? '가짜 로고 없이 실제 프로필 로고/브랜드 색을 소품, 패치, 앱 아이콘, 마지막 장면에 자연스럽게 녹인다' : '',
    ].filter(Boolean).join(' ');
    return {
      title: picked[0],
      action: action,
      camera: motion.label + ' · ' + motion.prompt,
      copy: role === 'brand' ? brand : '',
      overlay_slogan: compactText(sloganBase, 18),
      slogan_motion: role === 'peak' ? '중앙 정렬 큰 글자 · 짧은 플래시 인' : '중앙 정렬 · 컷 리듬에 맞춰 0.4초 등장',
      sound_cue: role === 'hook' ? 'hard stop + micro rise' : (role === 'peak' ? 'impact hit + quick swell' : 'subtle motion tick'),
      vfx_preset: currentVFXPreset().value,
      vfx_cue: role === 'peak' ? 'peak burst, lens flare, speed ramp' : currentVFXPreset().guide,
      role: role,
      importance: role === 'hook' ? 96 : (role === 'peak' ? 90 : (role === 'brand' ? 86 : 72)),
      selected_priority: role === 'hook' || role === 'peak' || role === 'brand' ? 95 : 70,
      field_coupling_score: role === 'hook' || role === 'brand' ? 94 : 82,
      creative_mass: role === 'hook' ? 96 : (role === 'peak' ? 91 : 78),
      field_coupling_reason: context.meta.creative_field.name + '의 ' + picked[0] + ' 역할을 수행',
      shot_diversity_reason: motion.label + '로 인접 컷과 앵글/거리/방향/초점 변화를 다르게 설계',
      retention_goal: role === 'hook' ? '0~1초 정지' : (role === 'brand' ? '마지막 기억' : '이탈 전 감정 변화'),
      image_prompt: compactPromptText([
        currentProductionMode().label,
        currentAspectSpec().value + ' commercial shorts frame',
        visual,
        action,
        'Brand identity: ' + brand + ', color ' + (profile.accent_color || '#ff8c00') + '. No text in image, no fake logo.',
      ].filter(Boolean).join('. '), 900),
      video_prompt: compactPromptText([
        '광고처럼 보이지 않는 쇼츠 컷',
        picked[0],
        action,
        'Camera motion: ' + motion.prompt,
        'Natural VFX/SFX direction: ' + currentVFXPreset().guide,
      ].filter(Boolean).join(' / '), 900),
    };
  }

  function buildInstantStoryboardDraft() {
    const pack = currentBriefPack();
    const detail = currentBriefDetail();
    const sceneCount = instantStoryboardSceneCount();
    const meta = buildInstantStoryboardMeta(pack, detail, sceneCount);
    const profile = currentProfileContext() || {};
    const source = compactText([field('aad-user-intent', ''), field('aad-source', '')].filter(Boolean).join(' / '), 140);
    const roleRows = [
      ['hook', 'problem', 'twist'],
      ['problem', 'proof', 'peak'],
      ['twist', 'proof', 'transition'],
      ['proof', 'peak', 'brand'],
      ['hook', 'peak', 'brand'],
      ['proof', 'transition', 'brand'],
    ];
    const titleParts = [
      detail.hook,
      detail.visual,
      field('aad-topic', ''),
      field('aad-objective', ''),
      currentHookRecipe().label,
      currentExceptionRule().label,
    ];
    const scenes = Array.from({ length: sceneCount }).map(function (_, sceneIndex) {
      const roles = roleRows[sceneIndex % roleRows.length];
      const title = instantSceneTitle(titleParts, sceneIndex);
      const retention = sceneIndex === 0 ? '첫 1초 훅' : (sceneIndex === sceneCount - 1 ? '마지막 브랜드 기억' : currentHookRecipe().label);
      const scene = {
        title: title,
        body: compactText([detail.target, detail.hook, source].filter(Boolean).join(' · '), 120),
        role: roles[0],
        duration: Math.max(4, Math.round((selectedDuration() / sceneCount) * 10) / 10),
        visual_mode: currentProductionMode().label,
        shot_type: cameraMotionProfile(sceneIndex, 0).label,
        subject_action: compactText(detail.visual || source || field('aad-topic', '쇼츠 광고'), 100),
        camera: cameraMotionProfile(sceneIndex, 0).label,
        lens: currentAspectSpec().value + ' mobile-safe composition',
        lighting: currentVFXPreset().label,
        art_direction: currentAnimationStyle().label + ' · ' + currentProductionMode().label,
        props_wardrobe: '브랜드 색과 로고는 장면 안 소품/앱 아이콘/패치로 자연스럽게만 사용',
        composition: currentAspectSpec().guide,
        transition: sceneIndex === sceneCount - 1 ? '마지막 브랜드 락업으로 연결' : '다음 씬으로 빠른 리듬 전환',
        sound_cue: sceneIndex === 0 ? '첫 프레임 스톱 히트' : '리듬 컷 전환음',
        edit_beat: retention,
        retention_goal: retention,
        image_prompt: '',
        video_prompt: '',
        micro_cuts: [],
      };
      scene.micro_cuts = roles.map(function (role, cutIndex) {
        return buildInstantCut(scene, sceneIndex, cutIndex, role === 'transition' ? 'proof' : role, { detail: detail, source: source, profile: profile, meta: meta });
      });
      return scene;
    });
    return { scenes: scenes, storyboard_meta: meta };
  }

  function creativeFieldReady() {
    const meta = creativeFieldMeta();
    return !!(meta && meta.core && meta.tension && meta.exception && meta.gravity && meta.mass_rule);
  }

  function creativeFieldLines(meta) {
    const source = meta || draftCreativeFieldMeta();
    if (!source) return [];
    return [
      ['광고 중심장', source.name],
      ['핵심', source.core],
      ['긴장', source.tension],
      ['욕망/감정', source.desire],
      ['예외성', source.exception],
      ['브랜드 중력', source.gravity],
      ['컷 질량 규칙', source.mass_rule],
    ].filter(function (item) { return item[1]; });
  }

  function metaListLine(label, items, max) {
    const list = (items || []).map(function (item) {
      return [item.name, item.detail || item.status].filter(Boolean).join(': ');
    }).filter(Boolean).slice(0, max || 3);
    return list.length ? label + ': ' + list.join(' / ') : '';
  }

  function creativeFieldPromptBlock(scope, ref) {
    const meta = draftCreativeFieldMeta();
    const lines = [
      '[' + scope + ' creative field]',
      'Every decision must be pulled by this invisible ad field, not by a fixed template.',
    ];
    creativeFieldLines(meta).forEach(function (item) {
      lines.push(item[0] + ': ' + item[1]);
    });
    lines.push(metaListLine('Dynamic selection rules', state.storyboardMeta.selection_criteria, 3));
    lines.push(metaListLine('Diversity axes', state.storyboardMeta.diversity_axes, 2));
    lines.push(metaListLine('Field constraints', state.storyboardMeta.field_constraints, 2));
    if (ref && ref.cut) {
      lines.push('Cut coupling score: ' + (ref.cut.field_coupling_score || 'unset'));
      lines.push('Creative mass: ' + (ref.cut.creative_mass || 'unset'));
      lines.push('Coupling reason: ' + (ref.cut.field_coupling_reason || 'this cut must visibly express the field tension and brand gravity'));
      lines.push('Diversity reason: ' + (ref.cut.shot_diversity_reason || 'make this shot visually different from nearby cuts'));
    }
    return compactText(lines.filter(Boolean).join('\n'), 980);
  }

  function creativeFieldAudioDirection() {
    const meta = draftCreativeFieldMeta();
    const parts = [
      meta?.tension ? '긴장: ' + meta.tension : '',
      meta?.desire ? '감정: ' + meta.desire : '',
      meta?.exception ? '예외성: ' + meta.exception : '',
      meta?.gravity ? '브랜드 중력: ' + meta.gravity : '',
      meta?.mass_rule ? '컷 질량: ' + meta.mass_rule : '',
    ].filter(Boolean);
    return compactText(parts.join(' / '), 420);
  }

  function creativeFieldSloganFallback(ref) {
    const meta = draftCreativeFieldMeta();
    const options = [
      ref?.cut?.field_coupling_reason,
      ref?.cut?.shot_diversity_reason,
      meta?.exception,
      meta?.tension,
      meta?.core,
    ];
    return cleanSloganText(options.find(Boolean), ref?.cut?.title || '멈추는 순간');
  }

  function cutHasCreativeCoupling(ref) {
    if (!ref || !ref.cut) return false;
    return Number(ref.cut.field_coupling_score || 0) > 0 &&
      Number(ref.cut.creative_mass || 0) > 0 &&
      !!String(ref.cut.field_coupling_reason || '').trim() &&
      !!String(ref.cut.shot_diversity_reason || '').trim();
  }

  function limitModelPrompt(text, limit) {
    const max = Number(limit || 2400);
    const value = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
    if (value.length <= max) return value;
    const head = value.slice(0, Math.max(1000, Math.floor(max * 0.58))).trim();
    const tail = value.slice(-Math.max(700, Math.floor(max * 0.32))).trim();
    return head + '\n\n[중간 상세 생략: 모델 제한으로 압축됨]\n\n' + tail;
  }

  function bestVideoRefForScene(refs, sceneIndex, seen) {
    return refs
      .filter(function (ref) { return ref.sceneIndex === sceneIndex && !seen.has(ref.key); })
      .sort(function (a, b) {
        const scoreDiff = videoCutScore(b) - videoCutScore(a);
        return scoreDiff || (a.cutIndex - b.cutIndex);
      })[0];
  }

  function evenlySpacedVideoRefs(refs, max) {
    const list = [];
    for (let i = 0; i < max; i++) {
      const idx = max === 1 ? 0 : Math.round(i * (refs.length - 1) / (max - 1));
      list.push(refs[Math.max(0, Math.min(refs.length - 1, idx))]);
    }
    return list;
  }

  function videoCutRefs() {
    const refs = allCutRefs();
    if (!refs.length) return [];
    const max = Math.min(refs.length, targetVideoClipCount());
    if (refs.length <= max) return refs;
    const picked = [];
    const seen = new Set();

    pushUniqueRef(picked, seen, refs[0]);
    pushUniqueRef(picked, seen, refs[refs.length - 1]);

    state.scenes.forEach(function (scene, sceneIndex) {
      if (picked.length < max) pushUniqueRef(picked, seen, bestVideoRefForScene(refs, sceneIndex, seen));
    });

    evenlySpacedVideoRefs(refs, max).forEach(function (ref) {
      if (picked.length < max) pushUniqueRef(picked, seen, ref);
    });

    refs.slice().sort(function (a, b) {
      const scoreDiff = videoCutScore(b) - videoCutScore(a);
      return scoreDiff || (a.order - b.order);
    }).forEach(function (ref) {
      if (picked.length < max) pushUniqueRef(picked, seen, ref);
    });

    return picked
      .sort(function (a, b) { return a.order - b.order; })
      .slice(0, max);
  }

  function isVideoProductionCut(key) {
    return videoCutRefs().some(function (ref) { return ref.key === key; });
  }

  function microCutDuration() {
    const total = selectedDuration();
    const count = Math.max(1, allCutRefs().length || numericField('aad-scene-count', DEFAULT_SCENE_COUNT) * MIN_MICRO_CUTS);
    return Math.max(0.8, Math.min(3, Math.round((total / count) * 10) / 10));
  }

  function microCutTotal() {
    return allCutRefs().length || numericField('aad-scene-count', DEFAULT_SCENE_COUNT) * MIN_MICRO_CUTS;
  }

  function videoClipDuration() {
    const count = Math.max(1, videoCutRefs().length || targetVideoClipCount());
    return Math.max(1.8, Math.min(5.5, Math.round((selectedDuration() / count) * 10) / 10));
  }

  function videoCutTotal() {
    return videoCutRefs().length || targetVideoClipCount();
  }

  function finalClipDuration(ref) {
    const planned = videoClipDuration();
    const actual = Number(state.videos?.[ref?.key]?.duration || 0);
    if (!Number.isFinite(actual) || actual <= 0) return planned;
    return Math.max(0.4, Math.round(actual * 100) / 100);
  }

  function finalTimelineDuration(refs) {
    return (refs || videoCutRefs()).reduce(function (total, ref) {
      return total + finalClipDuration(ref);
    }, 0);
  }

  function pacingGuideText() {
    const duration = selectedDuration();
    const storyboardCuts = microCutTotal();
    const targetCuts = videoCutTotal();
    const seconds = videoClipDuration();
    const rangeText = duration <= 30 ? '8~12개' : '16~24개';
    return duration + '초 최종 영상은 실제 영상 컷 ' + rangeText + '가 기준입니다. 콘티 ' + storyboardCuts + '컷은 편집 후보이고, 현재는 그중 ' + targetCuts + '컷만 영상화해 컷당 약 ' + seconds + '초 호흡을 유지합니다.';
  }

  function renderVideoCutSelectionReview(refs, videoRefs) {
    const duration = selectedDuration();
    const targetCuts = videoRefs.length || videoCutTotal();
    const criteria = storyboardSelectionCriteria(duration, refs, videoRefs);
    const creativity = storyboardCreativeAuditItems(refs, videoRefs);
    return `
      <div class="aad-selection-review">
        ${renderCreativeFieldPanel()}
        <div>
          <b>후보 선별 조건 · 검토 완료</b>
          <span>${duration}초 영상은 전체 콘티 ${refs.length}컷 중 실제 영상화 대상 ${targetCuts}컷만 고릅니다. 조건은 AI가 만든 광고 중심장과 콘티 메타에서 옵니다.</span>
        </div>
        <ul>
          ${criteria.map(function (item) {
            return '<li><strong>' + esc(item.name) + '</strong><span>' + esc(item.detail || item.status || '') + '</span></li>';
          }).join('')}
        </ul>
        <div class="aad-creativity-audit">
          <b>창조장 결합 검사</b>
          <div>
            ${creativity.map(function (item) {
              const status = String(item.status || '').trim();
              return '<span><strong>' + esc(status ? status + ' · ' + item.name : item.name) + '</strong><em>' + esc(item.detail || '') + '</em></span>';
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function updateCut(sceneIndex, cutIndex, fieldName, value) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;
    const cut = ensureMicroCuts(scene, sceneIndex)[cutIndex];
    if (!cut) return;
    cut[fieldName] = String(value == null ? '' : value);
    invalidateQuality();
    scheduleHistoryAutosave();
    render();
  }

  function rewriteMicroCut(sceneIndex, cutIndex) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;
    const cuts = ensureMicroCuts(scene, sceneIndex);
    cuts[cutIndex] = buildDefaultMicroCut(scene, sceneIndex, cutIndex);
    const key = cutKey(sceneIndex, cutIndex);
    delete state.images[key];
    delete state.videos[key];
    invalidateQuality();
    addLog('씬 ' + (sceneIndex + 1) + '-' + (cutIndex + 1) + ' 컷을 다시 구성했습니다.', 'success');
    scheduleHistoryAutosave();
  }

  function addLog(message, level, options) {
    const opts = options || {};
    state.logs.unshift(makeLog(message, level));
    state.logs = state.logs.slice(0, 30);
    render();
    if (opts.persist !== false && hasHistoryWork() && !state.history.saving) {
      scheduleHistoryAutosave();
    }
  }

  function makeLog(message, level) {
    return {
      message: message,
      level: level || 'info',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  function fallbackRecentLogs() {
    const logs = [];
    if (state.scenes.length) {
      logs.push(makeLog('콘티 ' + state.scenes.length + '개 씬 / 후보 ' + allCutRefs().length + '컷이 준비되어 있습니다.', 'success'));
    }
    const selectedRefs = videoCutRefs();
    const imageCount = selectedRefs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
    if (selectedRefs.length) {
      logs.push(makeLog('선별 이미지 ' + imageCount + '/' + selectedRefs.length + '개 기준으로 다음 단계를 판단합니다.', imageCount >= selectedRefs.length ? 'success' : 'info'));
    }
    if (state.aiBriefPacks.items.length) {
      logs.push(makeLog('AI 추천 광고 세트 ' + state.aiBriefPacks.items.length + '개가 준비되어 있습니다.', 'success'));
    }
    if (state.history.items.length) {
      logs.push(makeLog('최근 작업 이력 ' + state.history.items.length + '개를 불러왔습니다.', 'info'));
    }
    if (!logs.length) {
      logs.push(makeLog('쇼츠 광고 만들기 화면을 열었습니다. 광고 의도와 소재 입력 후 AI 추천 3개를 생성하세요.', 'info'));
    }
    return logs.slice(0, 4);
  }

  function renderLogHistoryResume() {
    const items = (state.history.items || []).slice(0, 3);
    if (!items.length) return '';
    const openingID = Number(state.history.openingId || 0);
    const blocked = !!state.busy || !!openingID;
    return `
      <div class="aad-log-history">
        <div><b>작업 이력에서 이어하기</b><button type="button" onclick="aadJumpFlowStep(8)">전체 이력</button></div>
        ${items.map(function (item) {
          const id = Number(item.id || 0);
          const label = openingID === id ? '불러오는 중...' : '이어하기';
          return '<article><span><strong>' + esc(item.title || item.topic || '쇼츠 광고 작업') + '</strong><em>' + esc(item.duration || 30) + '초 · ' + esc(item.aspect || '9:16') + ' · ' + esc(formatHistoryDate(item.updated_at)) + '</em></span><button type="button" onclick="aadOpenHistory(' + id + ')"' + (blocked ? ' disabled' : '') + '>' + esc(label) + '</button></article>';
        }).join('')}
      </div>
    `;
  }

  function setBusy(label) {
    syncForm();
    state.busy = label || '';
    render();
  }

  function showHistoryOpeningFeedback(historyId) {
    state.busy = '작업 이력 #' + historyId + ' 불러오는 중...';
    const container = root();
    if (!container) return;
    let busy = container.querySelector('.aad-history-opening-busy');
    if (!busy) {
      busy = document.createElement('div');
      busy.className = 'aad-busy aad-history-opening-busy';
      container.insertBefore(busy, container.firstChild);
    }
    busy.innerHTML = '<span class="spinner"></span>' + esc(state.busy);
    Array.from(container.querySelectorAll('button[onclick*="aadOpenHistory"], .aad-history-thumb')).forEach(function (button) {
      button.disabled = true;
      if (/이어|불러/.test(button.textContent || '')) button.textContent = '불러오는 중...';
    });
  }

  function generationActionKey(kind, key) {
    return String(kind || 'action') + ':' + String(key || 'global');
  }

  function isActionLocked(kind, key) {
    return !!state.generating.actions[generationActionKey(kind, key)];
  }

  function setActionLocked(kind, key, value) {
    const actionKey = generationActionKey(kind, key);
    if (value) state.generating.actions[actionKey] = true;
    else delete state.generating.actions[actionKey];
  }

  function generationAttrValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function generationButtonAttrs(kind, key) {
    return ' data-aad-generation-kind="' + esc(kind || 'action') + '" data-aad-generation-key="' + esc(key || 'global') + '"';
  }

  function generationLoadingText(kind, label) {
    if (kind === 'video' || kind === 'bulk-videos') return '영상 생성중...';
    if (kind === 'image' || kind === 'bulk-images') return '이미지 생성중...';
    return label || '작동중...';
  }

  function showGenerationActionFeedback(kind, key, label) {
    const selector = '[data-aad-generation-kind="' + generationAttrValue(kind || 'action') + '"][data-aad-generation-key="' + generationAttrValue(key || 'global') + '"]';
    Array.from(document.querySelectorAll(selector)).forEach(function (button) {
      button.disabled = true;
      button.classList.add('aad-loading-action');
      button.textContent = generationLoadingText(kind, label);
    });
  }

  function beginGenerationAction(kind, key, label, options) {
    const opts = options || {};
    if (isActionLocked(kind, key)) return false;
    if (state.busy && !opts.allowBusy) return false;
    setActionLocked(kind, key, true);
    if (kind === 'image' || kind === 'video') setCutGenerating(kind, key, true);
    setBusy(label || '작동중...');
    showGenerationActionFeedback(kind, key, label);
    return true;
  }

  function endGenerationAction(kind, key, options) {
    const opts = options || {};
    setActionLocked(kind, key, false);
    if (kind === 'image' || kind === 'video') setCutGenerating(kind, key, false);
    if (opts.keepBusy) render();
    else setBusy('');
  }

  function statusPill(text, color) {
    return '<span class="aad-pill" style="--aad-pill:' + esc(color || '#ff8c00') + ';">' + esc(text) + '</span>';
  }

  function stepTag(no, label) {
    return '<span class="aad-step-tag"><b>STEP ' + esc(no) + '</b>' + esc(label || '') + '</span>';
  }

  function selectedSceneImage(index, cutIndex) {
    const key = cutIndex == null ? String(index) : cutKey(index, cutIndex);
    const list = state.images[key] || [];
    const selected = list.find(function (item) { return item.selected && mediaUrl(item); });
    return selected || list.find(function (item) { return mediaUrl(item); }) || null;
  }

  function mediaUrl(item) {
    if (!item || typeof item !== 'object') return '';
    return item.url || item.image_url || item.output_url || item.download_url || item.file_url || item.public_url || item.data_url || item.visualUrl || item.thumbnail_url || item.thumbnailUrl || item.preview_url || item.previewUrl || '';
  }

  function cutPreviewUrl(ref) {
    if (!ref) return '';
    const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex);
    const video = state.videos[ref.key] || {};
    return mediaUrl(image) || mediaUrl(video) || '';
  }

  function shotCardLabel(ref) {
    if (!ref) return '콘티 후보';
    return videoCutReason(ref) || ref.cut?.role || '콘티 후보';
  }

  function renderStoryboardShotCard(ref, compact) {
    const title = ref?.cut?.copy || ref?.cut?.title || ref?.scene?.title || '콘티 컷';
    const body = ref?.cut?.action || ref?.scene?.body || ref?.cut?.image_prompt || '이미지를 생성하기 전에는 이 샷 카드로 화면 구성을 확인합니다.';
    const cls = compact ? 'aad-storyboard-shot-card compact' : 'aad-storyboard-shot-card';
    const generating = cutGeneratingKind(ref?.key);
    const actionLabel = generating === 'image' ? '이미지 생성중...' : '이 컷 이미지 생성';
    const actionDisabled = state.busy || generating ? ' disabled' : '';
    const action = compact ? '' : '<button type="button"' + generationButtonAttrs('image', ref?.key || cutKey(Number(ref?.sceneIndex || 0), Number(ref?.cutIndex || 0))) + ' onclick="aadGenerateSceneImage(' + Number(ref?.sceneIndex || 0) + ',' + Number(ref?.cutIndex || 0) + ')"' + actionDisabled + '>' + esc(actionLabel) + '</button>';
    return '<div class="' + cls + '"><i>S' + esc((ref?.sceneIndex || 0) + 1) + '-C' + esc((ref?.cutIndex || 0) + 1) + '</i><strong>' + esc(title) + '</strong><span>' + esc(shotCardLabel(ref)) + '</span><p>' + esc(body) + '</p>' + action + '</div>';
  }

  function renderStoryboardVisual(ref) {
    const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex);
    const video = state.videos[ref.key] || {};
    const imageUrl = mediaUrl(image);
    const videoUrl = mediaUrl(video);
    const videoPlayer = videoUrl ? '<video class="aad-storyboard-video-player" src="' + esc(videoUrl) + '" controls playsinline preload="metadata"></video>' : '';
    if (imageUrl) {
      return '<div class="aad-storyboard-media-wrap has-image loaded" style="background-image:url(&quot;' + esc(imageUrl) + '&quot;)"><img class="aad-storyboard-media" src="' + esc(imageUrl) + '" alt="" onload="this.parentNode.classList.add(&quot;loaded&quot;)" onerror="this.style.display=&quot;none&quot;">' + videoPlayer + renderStoryboardShotCard(ref, false) + '</div>';
    }
    if (videoUrl) {
      return '<div class="aad-storyboard-media-wrap has-video loaded"><video class="aad-storyboard-media" src="' + esc(videoUrl) + '" controls playsinline onerror="this.parentNode.classList.add(&quot;broken&quot;)"></video>' + renderStoryboardShotCard(ref, false) + '</div>';
    }
    const previewUrl = cutPreviewUrl(ref);
    if (previewUrl) {
      return '<div class="aad-storyboard-media-wrap has-image loaded" style="background-image:url(&quot;' + esc(previewUrl) + '&quot;)"><img class="aad-storyboard-media" src="' + esc(previewUrl) + '" alt="" onload="this.parentNode.classList.add(&quot;loaded&quot;)" onerror="this.style.display=&quot;none&quot;">' + renderStoryboardShotCard(ref, false) + '</div>';
    }
    return renderStoryboardShotCard(ref, false);
  }

  function renderStoryboardThumb(ref, index, active) {
    const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex);
    const imageUrl = mediaUrl(image);
    const visual = imageUrl
      ? '<img src="' + esc(imageUrl) + '" alt="" onerror="this.style.display=&quot;none&quot;">' + renderStoryboardShotCard(ref, true)
      : renderStoryboardShotCard(ref, true);
    return '<button class="' + (active ? 'active' : '') + '" onclick="aadOpenStoryboardModal(' + index + ')">' + visual + '<span>' + (index + 1) + '</span><b>S' + (ref.sceneIndex + 1) + '-C' + (ref.cutIndex + 1) + '</b></button>';
  }

  function hasRealSceneImage(key) {
    return (state.images[key] || []).some(function (item) {
      return item && mediaUrl(item) && !item.mock;
    });
  }

  function hasRealSceneVideo(key) {
    const video = state.videos[key];
    return !!(video && video.url && !video.mock);
  }

  function readyImageCount(refs) {
    return (refs || []).filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
  }

  function readyVideoCount(refs) {
    return (refs || []).filter(function (ref) { return hasRealSceneVideo(ref.key); }).length;
  }

  function allSelectedImagesReady(refs) {
    const list = refs || videoCutRefs();
    return list.length > 0 && readyImageCount(list) >= list.length;
  }

  function allSelectedVideosReady(refs) {
    const list = refs || videoCutRefs();
    return list.length > 0 && readyVideoCount(list) >= list.length;
  }

  function hasGeneratedSceneVideo(key) {
    const video = state.videos[key];
    return !!(video && (video.url || video.mock));
  }

  function setCutGenerating(kind, key, value) {
    const bucket = kind === 'video' ? state.generating.videos : state.generating.images;
    if (!key || !bucket) return;
    if (value) bucket[key] = true;
    else delete bucket[key];
  }

  function cutGeneratingKind(key) {
    if (state.generating.videos[key]) return 'video';
    if (state.generating.images[key]) return 'image';
    return '';
  }

  function cutGeneratingLabel(key) {
    const kind = cutGeneratingKind(key);
    if (kind === 'video') return '영상 생성중';
    if (kind === 'image') return '이미지 생성중';
    return '';
  }

  function renderCutGeneratingOverlay(ref, compact) {
    const label = cutGeneratingLabel(ref?.key);
    if (!label) return '';
    return '<div class="aad-generating-badge ' + esc(cutGeneratingKind(ref?.key)) + (compact ? ' compact' : '') + '"><span class="spinner"></span><div class="aad-generating-title">' + esc(label) + '</div><div class="aad-generating-desc">완료되면 이 컷에 자동 반영됩니다.</div></div>';
  }

  function renderBoardCutActions(ref, productionCut, hasImage, hasVideo, generating) {
    if (!productionCut) return '';
    const imageLabel = generating === 'image' ? '이미지 생성중' : (hasImage ? '이미지 재생성' : '이미지 생성');
    const videoLabel = generating === 'video' ? '영상 생성중' : (hasVideo ? '영상 재생성' : '영상 생성');
    const imageDisabled = state.busy || generating ? ' disabled' : '';
    const videoDisabled = state.busy || generating ? ' disabled' : '';
    return `
      <div class="aad-board-actions">
        <button type="button" class="aad-board-action-btn"${generationButtonAttrs('image', ref.key)} onclick="event.stopPropagation();aadGenerateSceneImage(${ref.sceneIndex},${ref.cutIndex})"${imageDisabled}>${esc(imageLabel)}</button>
        ${hasImage ? '<button type="button" class="aad-board-action-btn video-action"' + generationButtonAttrs('video', ref.key) + ' onclick="event.stopPropagation();aadGenerateSceneVideo(' + ref.sceneIndex + ',' + ref.cutIndex + ')"' + videoDisabled + '>' + esc(videoLabel) + '</button>' : ''}
      </div>
    `;
  }

  function invalidateQuality() {
    state.quality = null;
  }

  function promptHasTextRisk(value) {
    const text = String(value || '').toLowerCase();
    if (!text) return false;
    if (/(no text|without text|textless|unreadable|글자 없는|텍스트 없는|글자 금지|텍스트 금지)/i.test(text)) return false;
    return /(caption|subtitle|logo|watermark|price|cta|copy|text on screen|문구|자막|가격|버튼|로고|브랜드명|광고 카피)/i.test(text);
  }

  function collectQualityAudit() {
    const refs = allCutRefs();
    const totalCuts = refs.length;
    const videoRefs = videoCutRefs();
    const totalVideoCuts = videoRefs.length;
    const items = [];
    const add = function (name, ok, detail, weight) {
      items.push({ name: name, ok: !!ok, detail: detail || '', weight: weight || 1 });
    };
    add('상용 콘티', state.scenes.length > 0, state.scenes.length ? state.scenes.length + '개 씬 준비' : '콘티가 없습니다', 2);
    add('광고 중심장', creativeFieldReady(), creativeFieldReady() ? '중심장 핵심/긴장/예외성/브랜드 중력 준비' : '1단계 AI 컨셉 또는 3단계 콘티에서 중심장 메타가 필요합니다', 2);
    add('씬당 5컷 이상', state.scenes.length > 0 && state.scenes.every(function (scene, index) { return ensureMicroCuts(scene, index).length >= MIN_MICRO_CUTS; }), totalCuts + '개 마이크로 컷', 2);
    const missingFields = refs.filter(function (ref) {
      return ['title', 'action', 'camera', 'copy', 'sound_cue', 'image_prompt', 'video_prompt'].some(function (key) { return !String(ref.cut[key] || '').trim(); });
    }).length;
    add('컷 디테일 완성', totalCuts > 0 && missingFields === 0, missingFields ? missingFields + '개 컷의 필드가 부족합니다' : '모든 컷 필드가 채워졌습니다', 2);
    const missingCoupling = refs.filter(function (ref) { return !cutHasCreativeCoupling(ref); }).length;
    add('컷 결합값', totalCuts > 0 && missingCoupling === 0, missingCoupling ? missingCoupling + '개 컷에 중심장 결합/질량/다양성 이유가 부족합니다' : '모든 컷에 결합값과 선별 근거가 있습니다', 2);
    const textRisk = refs.filter(function (ref) { return promptHasTextRisk(ref.cut.image_prompt) || promptHasTextRisk(ref.scene.image_prompt); }).length;
    add('이미지 텍스트 금지', totalCuts > 0 && textRisk === 0, textRisk ? textRisk + '개 컷 이미지 프롬프트에 텍스트 위험 표현이 있습니다' : '이미지 안 텍스트 위험 없음', 2);
    const selectedImageCount = videoRefs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
    add('기준 이미지', totalVideoCuts > 0 && selectedImageCount === totalVideoCuts, selectedImageCount + '/' + totalVideoCuts + '개 선별 컷 실제 생성', 2);
    const videoCount = videoRefs.filter(function (ref) { return hasRealSceneVideo(ref.key); }).length;
    add('광고 영상 컷', totalVideoCuts > 0 && videoCount === totalVideoCuts, videoCount + '/' + totalVideoCuts + '개 준비 · 콘티 ' + totalCuts + '컷 중 자동 선별', 2);
    const mockCount = videoRefs.filter(function (ref) { return state.videos[ref.key]?.mock; }).length;
    add('실제 영상 모델 산출물', totalVideoCuts > 0 && videoCount === totalVideoCuts && mockCount === 0, mockCount ? mockCount + '개 mock 클립이 남아 있습니다' : '선별된 광고 컷이 모두 실제 산출물입니다', 1);
    add('플랫폼 플레이북', !!field('aad-platform-playbook', ''), currentPlatformPlaybook().label + ' 적용', 1);
    add('후킹 레시피', !!field('aad-hook-recipe', ''), currentHookRecipe().label + ' 적용', 1);
    add('퍼플카우/스토리 공식', !!field('aad-attention-hook', ''), currentAttentionHook().label + ' 적용', 1);
    add('시맨틱 구조 DB', state.semantics.items.length > 0, state.semantics.items.length ? currentSemanticStructure().name + ' · ' + state.semantics.items.length + '개 노드' : '시맨틱 노드가 아직 없습니다', 1);
    add('창조적 예외성', !!field('aad-exception-rule', ''), currentExceptionRule().label + ' 적용', 1);
    add('창조성 규칙', !!field('aad-creativity-rule', ''), currentCreativityRule().name + ' 적용', 1);
    add('페르소나 일관성', currentPersona().value === 'none' || !!field('aad-persona-type', ''), currentPersona().label + ' 적용', 1);
    add('영상 API BGM/SFX/VFX', totalVideoCuts > 0 && videoCount === totalVideoCuts, videoCount + '/' + totalVideoCuts + '개 영상 컷 안에서 음향/VFX 처리', 1);
    add('마지막 브랜드 렌더', !!state.finalUrl, state.finalUrl ? '최종 MP4 준비' : '최종 렌더가 없습니다', 2);
    const totalWeight = items.reduce(function (sum, item) { return sum + item.weight; }, 0) || 1;
    const okWeight = items.reduce(function (sum, item) { return sum + (item.ok ? item.weight : 0); }, 0);
    const score = Math.round((okWeight / totalWeight) * 100);
    return {
      score: score,
      status: score >= 96 ? '상용 준비' : (score >= 82 ? '거의 완성' : (score >= 55 ? '제작 중' : '준비 필요')),
      items: items,
      updatedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  function buildSceneImagePrompt(scene, index, cut, cutIndex) {
    const micro = cut || {};
    const cutVFX = cutVFXPreset(micro);
    const ref = { scene: scene, sceneIndex: index, cut: micro, cutIndex: cutIndex || 0 };
    return [
      '[' + currentProductionMode().label + ' 기준 이미지]',
      creativeFieldPromptBlock('image keyframe', ref),
      '제작 방식: ' + productionModeGuide(),
      'Aspect ratio: ' + currentAspectSpec().value + ' (' + currentAspectSpec().size + '). ' + currentAspectSpec().guide,
      'The image composition must be designed exactly for ' + currentAspectSpec().value + '. Do not create a different crop or leave important subjects outside the safe area.',
      'Continuity lock: keep the same visual world, subject identity, product scale, color palette, lighting direction, and camera orientation as the surrounding cuts. Do not suddenly switch to an unrelated model, location, genre, or stock-photo scene.',
      'Orientation lock: keep the frame upright. No sideways rotation, no mirrored left-right flip, no Dutch angle, no tilted horizon, no upside-down product/person, unless the cut explicitly asks for rotation. For 9:16, the long side is vertical and the subject stands/reads naturally upright.',
      '상용 광고의 image-to-video 시작 프레임으로 쓸 한 장의 키비주얼을 만드세요.',
      '이미지 안에는 읽을 수 있는 글자, 숫자, 자막, 가격표, 버튼, 워터마크, 가짜 로고를 절대 넣지 마세요.',
      '자막은 넣지 않습니다. AI가 만든 핵심 표어는 최종 HyperFrames 레이어에서만 짧게 표시하고, 브랜드 텍스트는 마지막 컷에서만 최소 표시합니다. CTA 문구/버튼도 넣지 않습니다. BGM, SFX, 자연 VFX는 영상 API가 담당하고 최종 렌더에서 음악/나레이션을 합성합니다.',
      '이 프레임은 제품 설명 이미지가 아니라 볼거리가 있는 광고 사건이어야 합니다.',
      entertainmentAdRules(),
      '주인공/상품/공간/소품/색감/조명/카메라 구도를 구체적으로 표현하고, 다음 컷으로 움직이기 좋은 여백과 방향성을 남기세요.',
      'Scene ' + (index + 1) + ': ' + (scene.title || ''),
      'Role: ' + (scene.role || ''),
      'Shot: ' + (scene.shot_type || ''),
      'Subject action: ' + (scene.subject_action || ''),
      'Camera: ' + (scene.camera || ''),
      'Lens: ' + (scene.lens || ''),
      'Lighting: ' + (scene.lighting || ''),
      'Art direction: ' + (scene.art_direction || ''),
      'Visual style: ' + currentAnimationStyle().label + ' - ' + currentAnimationStyle().guide,
      'Video API VFX direction to bake naturally into the generated motion: ' + cutVFX.label + ' - ' + cutVFX.guide,
      'Platform playbook: ' + currentPlatformPlaybook().label + ' - ' + currentPlatformPlaybook().guide,
      'Hook recipe: ' + currentHookRecipe().label + ' - ' + currentHookRecipe().guide,
      personaPrompt(),
      'Keep face, hands, product, and final brand lockup safe from Instagram Reels and YouTube Shorts mobile UI overlays. Leave visual breathing room for bottom captions, right-side buttons, and top account areas without creating text. TikTok safe zones are optional reference only.',
      'HyperFrames will add short AI-generated key phrase punches on selected middle cuts, final narration audio, music, VFX layers, and the final brand lockup on the last cut. Do not add CTA buttons, subtitles, narration text, or explanatory copy inside the image/video pixels. Natural VFX, BGM, SFX, audio hits, light sweeps, particles, shockwaves, camera shake, speed ramps, smoke, sparks, prism, glitches, and impact energy must be planned here.',
      'Profile brand context: ' + profileContextPrompt(),
      brandIdentityPrompt(),
      'Reference images: ' + referenceContextPrompt(),
      referenceImageGroups().product.length ? 'Use product reference images to preserve product shape, material, package, color, and hero details across every scene.' : '',
      referenceImageGroups().brand.length ? 'Use brand reference images, including the current profile logo when available, to preserve the real logo, brand color, typography mood, and store/service identity. A visible physical brand mark from the provided reference must appear naturally in the scene as a product label, package mark, storefront sign, app icon, uniform patch, device sticker, receipt stamp, wall sign, or prop. Do not overlay a floating logo sticker, do not invent a new logo, and do not hallucinate unreadable text.' : '',
      referenceImageGroups().persona.length ? 'Use persona/model reference images as the primary identity anchor for the recurring person or character.' : '',
      'Composition: ' + (scene.composition || ''),
      'Micro cut ' + ((cutIndex || 0) + 1) + ' title: ' + (micro.title || ''),
      'Micro cut action: ' + (micro.action || ''),
      'Micro cut camera: ' + (micro.camera || ''),
      'Micro VFX cue: ' + (micro.vfx_cue || ''),
      'Original prompt: ' + (scene.image_prompt || scene.body || ''),
      'Micro prompt: ' + (micro.image_prompt || ''),
      'Negative: ' + (scene.negative_constraints || 'text, watermark, logo hallucination, extra fingers, distorted product'),
    ].filter(Boolean).join('\n');
  }

  function buildSceneVideoPrompt(scene, index, cut, cutIndex) {
    const micro = cut || {};
    const cutVFX = cutVFXPreset(micro);
    const ref = { scene: scene, sceneIndex: index, cut: micro, cutIndex: cutIndex || 0 };
    const motionDirective = cameraMotionDirective(index, cutIndex || 0, scene, micro);
    return [
      '[AI image-to-video ' + currentProductionMode().label + ' direction]',
      creativeFieldPromptBlock('video motion and sound', ref),
      'Selected video model: ' + modelLabel(videoModelOptions(), field('aad-video-model', DEFAULT_VIDEO_MODEL)),
      'Production mode: ' + productionModeGuide(),
      'Video aspect ratio: ' + currentAspectSpec().value + ' (' + currentAspectSpec().size + '). Keep all motion, subject position, camera movement, and copy-safe area inside this exact frame.',
      'Use the selected image as the exact first frame. Preserve subject identity, product shape, brand mood, lighting, color, and composition.',
      'Maintain upright camera orientation and spatial continuity. Do not rotate the camera sideways, flip left-right, roll the horizon, or turn the subject/product upside down unless the cut explicitly says so.',
      'Make it feel like a polished cinematic commercial shot, not a template animation: motivated camera movement, real depth, physical material continuity, controlled focus, believable parallax, premium pacing.',
      'The motion must reveal the story beat: reaction, interruption, discovery, payoff, comic timing, romantic/sensory tension, or proof. Do not make a boring slow zoom.',
      motionDirective,
      'Create natural commercial-grade motion, BGM, SFX, and audio hit timing when the selected video API supports audio. Do not create narration, subtitles, spoken script, text, UI, labels, prices, watermarks, or fake logos inside the video pixels.',
      'Platform playbook: ' + currentPlatformPlaybook().label + ' - ' + currentPlatformPlaybook().guide,
      'Hook recipe: ' + currentHookRecipe().label + ' - ' + currentHookRecipe().guide,
      personaPrompt(),
      entertainmentAdRules(),
      'Visual style: ' + currentAnimationStyle().label + ' - ' + currentAnimationStyle().guide,
      'Cut VFX intention to generate inside the video pixels naturally: ' + cutVFX.label + ' - ' + cutVFX.guide,
      'Bake the VFX, BGM, and SFX into the AI video motion so it feels physically connected to the scene. HyperFrames should only add short AI-generated key phrase punches on selected middle cuts and the final brand lockup on the last cut.',
      'Keep key action, faces, hands, product, and final brand area in safe zones for Instagram Reels and YouTube Shorts mobile UI. The composition should still work without subtitles or narration. TikTok UI may be considered as optional benchmark only.',
      'Profile brand context: ' + profileContextPrompt(),
      brandIdentityPrompt(),
      'Reference images: ' + referenceContextPrompt(),
      referenceImageGroups().product.length ? 'Keep the product identical to the provided product reference images.' : '',
      referenceImageGroups().brand.length ? 'Keep the brand identity consistent with the provided brand reference images and current profile logo. Keep one visible physical brand mark embedded inside the filmed/generated scene as signage, packaging, app icon, uniform patch, device sticker, receipt stamp, wall sign, or prop. Never add a logo overlay, invent text, or create a fake logo.' : '',
      referenceImageGroups().persona.length ? 'Keep the recurring model/persona identical to the provided persona reference images.' : '',
      'Scene ' + (index + 1) + ': ' + (scene.title || ''),
      'Cut plan: ' + (scene.cut_plan || ''),
      'Subject action: ' + (scene.subject_action || ''),
      'Camera: ' + (scene.camera || ''),
      'Transition: ' + (scene.transition || ''),
      'Edit beat: ' + (scene.edit_beat || ''),
      'Micro cut ' + ((cutIndex || 0) + 1) + ': ' + (micro.title || ''),
      'Micro action: ' + (micro.action || ''),
      'Micro camera: ' + (micro.camera || ''),
      'Micro video direction: ' + (micro.video_prompt || ''),
      'Micro VFX cue for video API generation: ' + (micro.vfx_cue || ''),
      'Sound cue timing reference: ' + (scene.sound_cue || ''),
      'Micro sound cue: ' + (micro.sound_cue || ''),
      'Native audio direction: generate BGM mood, SFX hit, transition sound, and silence/impact timing inside the video API whenever supported. No subtitles. Gemini audio supplies final BGM and narration during HyperFrames render.',
      'Negative constraints: ' + (scene.negative_constraints || 'no text, no morphing, no random objects, no identity drift'),
    ].filter(Boolean).join('\n');
  }

  function cameraMotionProfile(sceneIndex, cutIndex) {
    const motions = [
      { label: '휩팬 리빌', prompt: 'whip-pan reveal into a fast push-in, foreground object crosses the lens, strong parallax' },
      { label: '핸드헬드 매크로 랙포커스', prompt: 'handheld macro move with rack focus from foreground detail to face/product reaction' },
      { label: '로우앵글 오비트', prompt: 'low-angle orbit around the subject/product, background layers slide in opposite direction' },
      { label: '크래시 줌아웃', prompt: 'crash zoom out from extreme detail into the full chaotic situation, speed ramp at the beat' },
      { label: '오버숄더 트래킹', prompt: 'over-the-shoulder tracking move, subject turns and the camera follows with a small shake' },
      { label: '탑다운 디센드', prompt: 'top-down drop shot that descends into eye-level, shadow sweep reveals the key object' },
      { label: '사이드 돌리 가림 전환', prompt: 'side dolly with foreground occlusion wipe, product/person passes behind a dark shape' },
      { label: '스냅 틸트 리액션', prompt: 'snap tilt from object to reaction, then micro push-in with lens breathing' },
      { label: '반사면 풀백', prompt: 'reverse pullback through glass/reflection, background expands with visible depth' },
      { label: '핸드헬드 서치 락온', prompt: 'quick handheld search move, focus hunts once, then locks sharply on the proof moment' },
      { label: '크레인 아크', prompt: 'arc crane move from high wide to tight close-up, motion ends on a clean impact frame' },
      { label: '스피드램프 통과', prompt: 'speed-ramped push past the subject into the next visual axis, no static frontal pose' },
    ];
    return motions[((sceneIndex || 0) * 5 + (cutIndex || 0) * 7) % motions.length];
  }

  function cameraMotionDirective(sceneIndex, cutIndex, scene, cut) {
    const picked = cameraMotionProfile(sceneIndex, cutIndex);
    const existing = [cut?.camera, cut?.video_prompt, scene?.camera, scene?.edit_beat].filter(Boolean).join(' / ');
    return [
      'Mandatory camera movement for this cut: ' + picked.prompt + '.',
      'Existing camera notes to preserve only if they do not make the shot static: ' + existing,
      'Adjacent cuts must not share the same camera distance, angle, movement direction, subject scale, or focus behavior. Avoid static front-facing shots, simple slow zoom, center-only composition, and no-motion keyframe drift.',
      'The first and last frame may be stable, but the middle of the clip must contain visible camera travel, parallax, focus change, or subject/object motion.',
    ].join('\n');
  }

  function isStaticCameraNote(value) {
    const text = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!text) return true;
    return /(front|frontal|static|still|center|정면|고정|중앙|정지|심플|단순|클로즈업만|wide shot only|slow zoom)/i.test(text);
  }

  function applyCameraMotionDiversity() {
    (state.scenes || []).forEach(function (scene, sceneIndex) {
      ensureMicroCuts(scene, sceneIndex).forEach(function (cut, cutIndex) {
        enrichCutCameraMotion(sceneIndex, cutIndex, scene, cut);
      });
    });
  }

  function enrichCutCameraMotion(sceneIndex, cutIndex, scene, cut) {
    if (!cut) return;
    const motion = cameraMotionProfile(sceneIndex, cutIndex);
    const korean = motion.label + ' · 전경 가림/패럴랙스/초점 변화 포함';
    if (isStaticCameraNote(cut.camera)) {
      cut.camera = korean;
    } else if (!String(cut.camera || '').includes(motion.label)) {
      cut.camera = String(cut.camera || '').trim() + ' / ' + korean;
    }
    const motionPrompt = 'Camera motion: ' + motion.prompt + '. Avoid static frontal shot or simple slow zoom.';
    if (isStaticCameraNote(cut.video_prompt)) {
      cut.video_prompt = [cut.video_prompt, motionPrompt].filter(Boolean).join(' / ');
    } else if (!String(cut.video_prompt || '').includes('Camera motion:')) {
      cut.video_prompt = String(cut.video_prompt || '').trim() + ' / ' + motionPrompt;
    }
    const diversity = '카메라 거리, 앵글, 이동 방향, 피사체 스케일, 초점 변화 중 3개 이상을 직전 컷과 다르게 설계';
    if (!String(cut.shot_diversity_reason || '').trim()) {
      cut.shot_diversity_reason = diversity + ' · ' + motion.label;
    }
    if (scene && isStaticCameraNote(scene.camera)) {
      scene.camera = '씬 대표 카메라: ' + korean;
    }
  }

  function storyboardQualityRules() {
    return [
      '스토리보드는 해외 상용 광고 제작 플랫폼 수준으로 만든다.',
      'Creatify식: 상품 URL/소재에서 제품 장점, 고객 문제, 훅, 마지막 브랜드 각인 변형 가능성을 뽑아낸다.',
      'HeyGen식: 브랜드킷, 색상, 플랫폼별 화면비, 마지막 브랜드 타이밍을 일관되게 유지한다.',
      'LTX Studio식: script, shot list, storyboard, rough cut 순서가 드러나야 한다.',
      'Runway식: reference consistency, lighting continuity, camera tracking, VFX notes, clean plate 관점까지 씬에 반영한다.',
      '기본 배포면은 Instagram Reels와 YouTube Shorts다. 모든 스토리보드는 두 플랫폼에서 광고처럼 보이지 않는 네이티브 숏폼으로 설계한다.',
      'Instagram Reels식: 9:16, 오디오, 핵심 피사체 safe zone, 크리에이터형 자연스러움을 스토리보드에 반영한다.',
      'YouTube Shorts식: 10~30초 액션형 광고, 60초 이하, 소셜 퍼스트, 모바일 최적화, organic blend를 반영한다.',
      'TikTok Top Ads식 초 단위 retention 분석은 참고만 하며, 최종 산출물은 릴스/쇼츠 문법으로 정리한다.',
      adCreativeBenchmarkRules(),
      entertainmentAdRules(),
      '각 마이크로 컷은 그림으로 만들 수 있을 정도로 구체적인 화면 구성, 피사체 위치, 렌즈, 조명, 카메라 방향, 전환, 사운드 큐를 가져야 한다.',
      '각 컷의 image_prompt는 한 장의 콘티 이미지로 바로 생성 가능해야 하고, video_prompt는 시작 이미지에서 어떤 움직임이 생기는지 명확해야 한다.',
      '초보자가 보아도 어떤 이미지를 만들지 알 수 있게 컷 제목과 action을 쉬운 한국어로 쓴다.',
    ].join('\n');
  }

  function renderIntro() {
    const hasPlan = state.scenes.length > 0;
    const videoRefs = videoCutRefs();
    const completedImages = videoRefs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
    const completedVideos = videoRefs.filter(function (ref) { return hasRealSceneVideo(ref.key); }).length;
    const totalCuts = microCutTotal();
    const totalVideoCuts = videoCutTotal();
    return `
      <div class="aad-hero">
        <div>
          <div class="aad-kicker">AI Video Models + Gemini Sound</div>
          <h2>인스타 릴스·유튜브 쇼츠 광고 제작소</h2>
          <p>벤치마크 URL과 브리프에서 훅·리듬·어그로를 뽑아 광고처럼 보이지 않는 릴스/쇼츠로 시작합니다. 로고 인트로와 세일즈 문구 없이 사건과 리액션으로 붙잡고, 마지막 컷에만 브랜드를 남깁니다.</p>
        </div>
        <div class="aad-status-grid">
          ${statusPill(hasPlan ? '콘티 준비됨' : '콘티 필요', hasPlan ? '#34c759' : '#ff9500')}
          ${statusPill('콘티 후보 ' + totalCuts + '컷', hasPlan ? '#007aff' : '#ff9500')}
          ${statusPill('선별 이미지 ' + completedImages + '/' + totalVideoCuts, completedImages ? '#34c759' : '#ff8c00')}
          ${statusPill('실제 영상 ' + completedVideos + '/' + totalVideoCuts, completedVideos ? '#34c759' : '#ff8c00')}
          ${statusPill(completedVideos >= totalVideoCuts && totalVideoCuts ? '영상 API 음향/VFX 포함' : '영상 API 음향/VFX 대기', completedVideos >= totalVideoCuts && totalVideoCuts ? '#34c759' : '#ff9500')}
        </div>
      </div>
    `;
  }

  function productionFlowSteps() {
    const refs = allCutRefs();
    const videoRefs = videoCutRefs();
    const totalCuts = refs.length || microCutTotal();
    const totalVideoCuts = videoRefs.length || videoCutTotal();
    const selectedImageCount = readyImageCount(videoRefs);
    const videoCount = readyVideoCount(videoRefs);
    return [
      { no: 1, title: '광고 컨셉', desc: '프로필 기반 AI 추천 3개를 만듭니다', done: state.aiBriefPacks.items.length >= AI_BRIEF_PACK_COUNT },
      { no: 2, title: 'AI 모델 선택', desc: '스토리보드·이미지·영상 모델을 고릅니다', done: !!field('aad-video-model', '') },
      { no: 3, title: '스토리보드', desc: '편집 후보 컷을 촘촘히 만듭니다', done: state.scenes.length > 0 },
      { no: 4, title: '기준 이미지', desc: '선별된 실제 영상 컷 이미지만 만듭니다', done: totalVideoCuts > 0 && selectedImageCount >= totalVideoCuts },
      { no: 5, title: '영상화', desc: totalVideoCuts + '개 실제 영상 컷만 만듭니다', done: totalVideoCuts > 0 && videoCount >= totalVideoCuts },
      { no: 6, title: '영상 API 음향/VFX', desc: 'BGM/SFX/VFX를 영상 컷 안에 자연스럽게 포함합니다', done: !!state.finalUrl },
      { no: 7, title: '표어/브랜드', desc: '핵심 표어와 마지막 브랜드를 렌더합니다', done: !!state.finalUrl },
      { no: 8, title: '이력/재작업', desc: 'DB 저장 후 언제든 이어서 수정합니다', done: !!state.currentHistoryId },
    ];
  }

  function currentFlowStepIndex(steps) {
    const index = steps.findIndex(function (step) { return !step.done; });
    return index >= 0 ? index : steps.length - 1;
  }

  function activeFlowStepNo() {
    const value = Number(state.activeStep || 1);
    return Math.max(1, Math.min(8, Number.isFinite(value) ? value : 1));
  }

  function renderProductionFlow() {
    const steps = productionFlowSteps();
    const suggested = currentFlowStepIndex(steps);
    const activeNo = activeFlowStepNo();
    const suggestedNo = steps[suggested]?.no || 1;
    return `
      <div class="aad-flow-card">
        <div class="aad-flow-head">
          <div>
            <h3>제작 플로우</h3>
            <p>번호 순서대로 진행하면 인스타 릴스와 유튜브 쇼츠에 맞는 1분 이하 네이티브 광고가 완성됩니다.</p>
          </div>
          <button type="button" onclick="aadFocusCurrentStep()">현재 단계로 이동</button>
        </div>
        <div class="aad-flow-steps">
          ${steps.map(function (step, index) {
            const isActive = step.no === activeNo;
            const isSuggested = step.no === suggestedNo && !isActive;
            const cls = [step.done ? 'done' : '', isSuggested ? 'next' : '', isActive ? 'active' : ''].filter(Boolean).join(' ');
            const nextBadge = isSuggested ? '<em>다음 추천</em>' : '';
            return '<button type="button" class="' + cls + '" onclick="aadJumpFlowStep(' + step.no + ')"><strong>' + step.no + '</strong><b>' + esc(step.title) + '</b><span>' + esc(step.desc) + '</span>' + nextBadge + '</button>';
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderBrief(options) {
    const opts = options || {};
    const includeModelPicker = opts.includeModelPicker !== false;
    const includePlatformIdeas = opts.includePlatformIdeas !== false;
    const durationOptions = [
      { value: 30, label: '30초 · 릴스/쇼츠 기본' },
      { value: 60, label: '60초 · 1분 이하 확장' },
    ];
    const sceneOptions = [
      { value: 4, label: '4씬 · 아주 빠르게' },
      { value: 6, label: '6씬 · 균형형' },
      { value: 8, label: '8씬 · 추천' },
      { value: 10, label: '10씬 · 디테일' },
      { value: 12, label: '12씬 · 풀패키지' },
    ];
    const voiceOptions = narrationVoiceOptions();
    const engineOptions = [
      { value: 'gemini', label: 'Gemini API' },
      { value: 'codex', label: 'Codex CLI' },
    ];
    const profileTextValue = profileContextText();
    const profileSummary = compactText(profileTextValue, 220);
    const profilePreview = compactText(profileTextValue, 900);
    const refs = referenceImageGroups();
    const subStep = activeBriefSubStep();
    const headerActions = subStep === 1
      ? '<button type="button" class="aad-next-action" onclick="aadSetBriefSubStep(2)">다음 · 브랜드/모델 기준</button>'
      : (subStep === 2
        ? '<button type="button" class="aad-next-action" onclick="aadSetBriefSubStep(3)">다음 · AI 컨셉 선택</button>'
        : '<button type="button" class="' + (state.aiBriefPacks.loading ? 'aad-loading-action' : (!state.aiBriefPacks.items.length && !state.busy ? 'aad-next-action' : '')) + '" onclick="aadGenerateBriefRecommendations()" ' + (state.aiBriefPacks.loading ? 'disabled' : '') + '>' + briefGenerationButtonText('프로필 보고 3개 생성') + '</button><button type="button" class="' + (isStoryboardBusy() ? 'aad-loading-action' : (state.aiBriefPacks.items.length && !state.busy ? 'aad-next-action' : '')) + '" onclick="aadGeneratePlan()" ' + (state.aiBriefPacks.items.length && !state.busy ? '' : 'disabled') + '>' + (isStoryboardBusy() ? '작동중 · 빠른 콘티 초안 제작중' : '선택안으로 빠른 콘티 제작') + '</button>');
    const briefHtml = `
      <div class="aad-card aad-step-one-card">
        <div class="aad-step-one-head">
          <div>
            ${stepTag(1, '광고 컨셉')}
            <h3>1단계 · 광고 컨셉 발명</h3>
            <p>프로필을 보고 퍼플카우, 예외성, 개연성, 창조성, 감정호소를 만족하는 쇼츠 광고 출발점을 AI가 새로 만듭니다.</p>
          </div>
          <div class="aad-step-one-actions">
            ${headerActions}
          </div>
        </div>

        ${renderBriefSubSteps()}
        ${state.aiBriefPacks.loading ? '<div class="aad-step-loading"><span class="spinner"></span><div><b>작동중 · AI 추천 광고 세트 3개 생성중</b><p>브랜드 프로필, 소재 입력, 퍼플카우/예외성/개연성/창조성 규칙을 읽고 1단계 컨셉을 만들고 있습니다.</p></div></div>' : ''}
        ${isStoryboardBusy() ? '<div class="aad-step-loading aad-storyboard-writing-hero"><span class="spinner"></span><div><em>STEP 1 진행 상태</em><b>빠른 콘티 초안 제작중</b><p>선택한 광고 컨셉을 먼저 씬별 핵심 3컷으로 쪼개고 있습니다. 실제 영상 후보와 필요한 컷은 다음 단계에서 상세 보강합니다.</p></div></div>' : ''}

        <div class="aad-step-one-layout substep">
          <section class="aad-intent-panel ${subStep === 1 ? 'active' : 'inactive'}">
            <div class="aad-section-label">가장 먼저</div>
            <h4>무엇을 광고하고 싶나요?</h4>
            <p>상품, 서비스, 이벤트, 앱, 매장, 브랜드 필름 중 무엇이든 편하게 적어주세요. AI가 이 답을 기준으로 컨셉 3개를 만듭니다.</p>
            <textarea id="aad-user-intent" rows="5" placeholder="예: 마케케의 쇼츠 광고 만들기 기능을 광고하고 싶어. 초보자도 브랜드 프로필만 넣으면 릴스/쇼츠 광고 컨셉과 콘티를 만들 수 있다는 걸 보여주고 싶어.">${formValue('aad-user-intent', '')}</textarea>
            <label class="aad-material-field">소재 입력<textarea id="aad-source" rows="4" placeholder="광고에 반드시 들어가야 할 상품/서비스 특징, 고객 문제, 사용 장면, 금지 표현, 참고 문구를 적어주세요.">${formValue('aad-source', '')}</textarea></label>
            <button type="button" class="${briefGenerationButtonClass()}" onclick="aadGenerateBriefRecommendations()"${state.aiBriefPacks.loading ? ' disabled' : ''}>${briefGenerationButtonText('이 답으로 3개 생성')}</button>
          </section>

          <section class="aad-brief-source-panel ${subStep === 2 ? 'active' : 'inactive'}">
            <div class="aad-section-label">브랜드 소스</div>
            <div class="aad-compact-field">
              <label>프로필 사용<select id="aad-use-profile" onchange="aadRefreshStyleGuide()">${optionTags([{value:'yes',label:'현재 프로필 정보 사용'},{value:'no',label:'사용하지 않음'}], state.form['aad-use-profile'])}</select></label>
              <label>프로필 로고 참조<select id="aad-use-profile-logo" onchange="aadRefreshStyleGuide()">${optionTags([{value:'yes',label:'로고를 장면 reference로 사용'},{value:'no',label:'로고 reference 제외'}], state.form['aad-use-profile-logo'])}</select></label>
            </div>
            <div class="aad-profile-snapshot">
              <b>${esc(currentProfileContext()?.brand || '브랜드 프로필')}</b>
              <span id="aad-profile-context-guide">${esc(profileSummary)}</span>
            </div>
            <div class="aad-ref-counts">
              <span>상품 ${refs.product.length}</span>
              <span>브랜드 ${refs.brand.length}</span>
              <span>모델 ${refs.persona.length}</span>
            </div>
            ${renderPersonaModelStatus()}
            ${renderProfileBrandReferencePreview()}
          </section>

          <section class="aad-brief-engine-panel ${subStep === 3 ? 'active' : 'inactive'}">
            <div class="aad-section-label">AI 컨셉 엔진</div>
            <div class="aad-engine-rules">
              <div><b>퍼플카우</b><span>멈추게 하는 이상한 첫 장면</span></div>
              <div><b>예외성</b><span>업종 공식에서 벗어나는 비틀림</span></div>
              <div><b>개연성</b><span>브랜드라서 가능한 이유</span></div>
              <div><b>창조성</b><span>낯선 의미를 제품 진실로 연결</span></div>
              <div><b>감정호소</b><span>웃음, 놀람, 긴장, 욕망, 안도</span></div>
              <div><b>입소문</b><span>공유될 이유를 심는다</span></div>
              <div><b>성공 방정식</b><span>성공 광고 구조를 온톨로지로 추론</span></div>
            </div>
            <input type="hidden" id="aad-topic" value="${formValue('aad-topic', '신제품 런칭 애니메이션 광고')}">
            <select id="aad-objective" class="aad-hidden-field">${optionTags(uniqueOptions('objective'), state.form['aad-objective'])}</select>
          </section>

          <section class="aad-brief-control-panel ${subStep === 2 ? 'active' : 'inactive'}">
            <div class="aad-section-label">제작 조건</div>
            <div class="aad-mini-grid">
              <label>길이<select id="aad-duration">${optionTags(durationOptions, state.form['aad-duration'])}</select></label>
              <label>씬 구성<select id="aad-scene-count">${optionTags(sceneOptions, state.form['aad-scene-count'])}</select></label>
              <label>톤<select id="aad-tone">${optionTags([{value:'프리미엄하고 선명한 톤',label:'프리미엄하고 선명한 톤'},{value:'밝고 빠른 숏폼 톤',label:'밝고 빠른 숏폼 톤'},{value:'감성적인 브랜드 필름 톤',label:'감성적인 브랜드 필름 톤'},{value:'직설적인 세일즈 톤',label:'직설적인 세일즈 톤'}], state.form['aad-tone'])}</select></label>
              <label>마지막 행동<select id="aad-cta">${optionTags(uniqueOptions('cta'), state.form['aad-cta'])}</select></label>
            </div>
            ${renderProductionModePicker()}
            ${renderAspectPicker()}
          </section>
        </div>

        ${subStep === 3 ? renderBriefPackCards() + renderSelectedBriefPackInsight() : ''}

        <div class="aad-step-one-details">
          <details>
            <summary><b>프로필 원문</b><span>AI에는 전체를 전달하지만 화면에는 요약만 렌더합니다.</span></summary>
            <div class="aad-profile-full">${esc(profilePreview)}</div>
          </details>
          <details>
            <summary><b>소재와 벤치마크</b><span>상품 설명, 참고 이미지, 벤치마크 URL은 AI 컨셉 생성에 직접 들어갑니다.</span></summary>
            <div class="aad-benchmark-picker-row">
              <label class="aad-wide">벤치마크 광고 URL<input id="aad-benchmark-url" value="${formValue('aad-benchmark-url', '')}" placeholder="Instagram Reels, YouTube Shorts 광고 URL을 넣으면 구조만 분석합니다."></label>
              <button type="button" onclick="aadOpenBenchmarkModal()">유명 광고 레퍼런스 고르기</button>
            </div>
            <label class="aad-wide">벤치마크에서 가져올 포인트<textarea id="aad-benchmark-notes" rows="3" placeholder="예: 첫 2초 반전, 컷 속도, 웃긴 리액션, 제품 등장 타이밍, 마지막 브랜드 타이밍">${formValue('aad-benchmark-notes', '')}</textarea></label>
            ${renderCreativeReportControls()}
            ${renderSuccessCaseLearningPanel()}
            ${renderReferenceUploaders()}
          </details>
          <details>
            <summary><b>전문가 옵션</b><span>AI가 자동으로 고르되 필요하면 직접 바꿀 수 있습니다.</span></summary>
            ${includeModelPicker ? renderModelPicker() : ''}
            ${includePlatformIdeas ? renderGlobalPlatformIdeas() : ''}
            <div class="aad-form-grid">
              ${renderBriefPackSelect()}
              <label class="aad-hidden-field">Gemini 음성<select id="aad-voice">${optionTags(voiceOptions, state.form['aad-voice'])}</select></label>
              <label class="aad-hidden-field">콘티 글 엔진<select id="aad-plan-engine">${optionTags(engineOptions, state.form['aad-plan-engine'])}</select></label>
              <label class="aad-hidden-field">기준 이미지 엔진<select id="aad-image-engine">${optionTags(engineOptions, state.form['aad-image-engine'])}</select></label>
              <label class="wide aad-select-with-guide">광고 서사 방식<div><select id="aad-story-arc" onchange="aadRefreshStyleGuide()">${optionTags(storyArcOptions(), state.form['aad-story-arc'])}</select><span id="aad-story-arc-guide">${esc(currentStoryArc().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">시선 훅<div><select id="aad-attention-hook" onchange="aadRefreshStyleGuide()">${optionTags(attentionHookOptions(), state.form['aad-attention-hook'])}</select><span id="aad-attention-hook-guide">${esc(currentAttentionHook().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">시맨틱 구조<div><select id="aad-semantic-structure" onchange="aadRefreshStyleGuide()">${optionTags(semanticStructureOptions(), state.form['aad-semantic-structure'])}</select><span id="aad-semantic-structure-guide">${esc(currentSemanticStructure().description)}</span></div></label>
              <label class="wide aad-select-with-guide">예외성 만들기 규칙<div><select id="aad-exception-rule" onchange="aadRefreshStyleGuide()">${optionTags(exceptionRuleOptions(), state.form['aad-exception-rule'])}</select><span id="aad-exception-rule-guide">${esc(currentExceptionRule().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">창조성 만들기 규칙<div><select id="aad-creativity-rule" onchange="aadRefreshStyleGuide()">${optionTags(creativityRuleOptions(), state.form['aad-creativity-rule'])}</select><span id="aad-creativity-rule-guide">${esc(currentCreativityRule().description)}</span></div></label>
              <label class="wide aad-select-with-guide">플랫폼 플레이북<div><select id="aad-platform-playbook" onchange="aadRefreshStyleGuide()">${optionTags(platformPlaybookOptions(), state.form['aad-platform-playbook'])}</select><span id="aad-platform-playbook-guide">${esc(currentPlatformPlaybook().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">후킹 레시피<div><select id="aad-hook-recipe" onchange="aadRefreshStyleGuide()">${optionTags(hookRecipeOptions(), state.form['aad-hook-recipe'])}</select><span id="aad-hook-recipe-guide">${esc(currentHookRecipe().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">애니메이션 스타일<div><select id="aad-animation-style" onchange="aadRefreshStyleGuide()">${optionTags(ANIMATION_STYLES, state.form['aad-animation-style'])}</select><span id="aad-animation-style-guide">${esc(currentAnimationStyle().guide)}</span></div></label>
              <label class="wide aad-select-with-guide">기본 VFX<div><select id="aad-vfx-preset" onchange="aadRefreshStyleGuide()">${optionTags(VFX_PRESETS, state.form['aad-vfx-preset'])}</select><span id="aad-vfx-preset-guide">${esc(currentVFXPreset().guide)} · 새 컷의 기본값이며 컷마다 따로 바꿀 수 있습니다.</span></div></label>
            </div>
          </details>
        </div>
      </div>
    `;
    if (!state.scenes.length) return briefHtml;
    return '<details class="aad-brief-details"><summary><b>제작 브리프</b><span>' + esc(field('aad-topic', '애니메이션 광고')) + '</span></summary>' + briefHtml + '</details>';
  }

  function renderActions(stepNo) {
    const disabled = state.busy ? ' disabled' : '';
    const step = Number(stepNo || activeFlowStepNo());
    let group = '';
    if (step === 3) {
      const storyboardBusy = isStoryboardBusy();
      const storyboardLabel = storyboardBusy ? '작동중 · 빠른 콘티 초안 제작중' : (state.scenes.length ? '빠른 콘티 다시 제작' : '선택안으로 빠른 콘티 제작');
      const planDisabled = !state.aiBriefPacks.items.length ? ' disabled title="먼저 1단계에서 AI 추천 광고 세트 3개를 생성하세요"' : disabled;
      const planPrompt = !storyboardBusy && !!state.aiBriefPacks.items.length && !state.scenes.length && !state.busy;
      const movingToImage = Number(state.stepMoving || 0) === 4;
      group = `
        <div class="aad-action-group">
          ${stepTag(3, '스토리보드')}
          ${state.scenes.length ? '<button class="' + (movingToImage ? 'aad-loading-action' : 'aad-primary aad-next-action') + '" type="button" onclick="aadGoToImageStage()"' + (movingToImage ? ' disabled' : disabled) + '>' + (movingToImage ? '동작중 · 4단계 이동중' : '4단계 이미지 생성으로 이동') + '</button>' : ''}
          <button class="${storyboardBusy ? 'aad-loading-action' : (planPrompt ? 'aad-primary aad-next-action' : 'aad-secondary-action')}" onclick="aadGeneratePlan()"${planDisabled}>${storyboardLabel}</button>
          ${!state.aiBriefPacks.items.length ? '<button type="button" class="aad-next-action" onclick="aadJumpFlowStep(1)">1단계 컨셉 먼저 생성</button>' : ''}
          <button onclick="aadOpenStoryboardModal(0)"${state.scenes.length ? disabled : ' disabled'}>콘티 모달 보기</button>
          <button onclick="aadLoadTestSample()"${disabled}>테스트 샘플 만들기</button>
        </div>
      `;
    } else if (step === 4) {
      group = `
        <div class="aad-action-group">
          ${stepTag(4, '기준 이미지')}
          <button class="${state.busy ? 'aad-loading-action' : 'aad-next-action'}"${generationButtonAttrs('bulk-images', 'selected')} onclick="aadGenerateSelectedImages()"${disabled}>${state.busy ? '이미지 생성중...' : '선별 컷 이미지만 생성'}</button>
          <button class="aad-secondary-action"${generationButtonAttrs('bulk-images', 'selected-regenerate')} onclick="aadGenerateSelectedImages(true)"${disabled}>선별 컷 이미지 재생성</button>
        </div>
      `;
    } else if (step === 5) {
      group = `
        <div class="aad-action-group">
          ${stepTag(5, '영상화')}
          <button class="${state.busy ? 'aad-loading-action' : 'aad-next-action'}"${generationButtonAttrs('bulk-videos', 'selected')} onclick="aadGenerateAllVideos()"${disabled}>${state.busy ? '영상 생성중...' : '선별 컷 영상 생성'}</button>
          <button class="aad-secondary-action"${generationButtonAttrs('bulk-videos', 'selected-regenerate')} onclick="aadGenerateAllVideos(true)"${disabled}>영상 옵션 재적용</button>
        </div>
      `;
    } else if (step === 6) {
      const videosReady = allSelectedVideosReady();
      group = `
        <div class="aad-action-group">
          ${stepTag(6, '영상 API 음향/VFX')}
          <button class="${state.busy ? 'aad-loading-action' : (!videosReady ? 'aad-next-action' : '')}"${generationButtonAttrs('bulk-videos', 'selected-regenerate')} onclick="aadGenerateAllVideos(true)"${disabled}>${state.busy ? '영상 생성중...' : '영상 옵션·음향/VFX 재적용'}</button>
          <button class="${videosReady && !state.busy ? 'aad-next-action' : 'aad-secondary-action'}" onclick="aadJumpFlowStep(7)"${videosReady && !state.busy ? '' : ' disabled title="먼저 선별 컷 영상을 생성하세요"'}>7단계 표어/브랜드로 이동</button>
        </div>
      `;
    } else if (step === 7) {
      group = `
        <div class="aad-action-group">
          ${stepTag(7, '마지막 브랜드')}
          <button class="${state.busy ? 'aad-loading-action' : 'aad-next-action'}" onclick="aadRenderFinal()"${disabled}>마지막 브랜드 렌더</button>
          <button onclick="aadRunQualityAudit()"${disabled}>완성도 검사</button>
        </div>
      `;
    } else {
      group = `
        <div class="aad-action-group">
          ${stepTag('ALL', '자동 제작')}
          <button onclick="aadRunMasterpieceLoop()"${disabled}>완벽 루프 실행</button>
          <button onclick="aadRunQualityAudit()"${disabled}>완성도 검사</button>
        </div>
      `;
    }
    return `
      <div class="aad-action-board">
        ${group}
      </div>
      ${state.busy ? '<div class="aad-busy"><span class="spinner"></span>' + esc(state.busy) + '</div>' : ''}
    `;
  }

  function renderHistoryPanel() {
    const items = state.history.items || [];
    const openingID = Number(state.history.openingId || 0);
    const disabled = state.busy || state.history.saving || openingID ? ' disabled' : '';
    return `
      <div class="aad-card aad-history-card">
        <div class="aad-card-head">
          <div>
            ${stepTag(8, '이력/재작업')}
            <h3>작업 이력</h3>
            <p>콘티, 컷별 이미지/영상, 마지막 브랜드 렌더와 로그를 DB에 저장해 언제든 다시 열고 이어서 수정합니다.</p>
          </div>
          <div class="aad-history-actions">
            <button class="${!state.busy && !state.history.saving && !openingID ? 'aad-next-action' : ''}" onclick="aadSaveHistory()"${disabled}>현재 작업 저장</button>
            ${items.length ? '<button onclick="aadOpenHistory(' + Number(items[0].id) + ')"' + (disabled || state.history.loading ? ' disabled' : '') + '>' + (openingID === Number(items[0].id) ? '불러오는 중...' : '마지막 작업 이어하기') + '</button>' : ''}
            <button onclick="aadLoadHistoryList()"${state.busy ? ' disabled' : ''}>새로고침</button>
            <button class="danger" onclick="aadDeleteAllHistory()"${state.busy || state.history.loading ? ' disabled' : ''}>전체 삭제</button>
          </div>
        </div>
        <div class="aad-history-meta">
          <span>${state.currentHistoryId ? '현재 이력 #' + esc(state.currentHistoryId) : '아직 연결된 저장 이력 없음'}</span>
          <span>${openingID ? '이어하기 불러오는 중' : (state.history.saving ? '저장 중' : (state.history.loading ? '불러오는 중' : '최근 30개 표시'))}</span>
        </div>
        <div class="aad-history-list">
          ${items.length ? items.map(function (item) {
            const active = Number(item.id) === Number(state.currentHistoryId);
            const thumb = item.thumbnail_url ? '<img src="' + esc(item.thumbnail_url) + '" alt="">' : '<span class="aad-history-placeholder">AD</span>';
            return `
              <article class="aad-history-item${active ? ' active' : ''}">
                <button class="aad-history-thumb" onclick="aadOpenHistory(${Number(item.id)})"${disabled}>${thumb}</button>
                <div>
                  <b>${esc(item.title || item.topic || '애니메이션 광고')}</b>
                  <span>${esc(item.duration || 30)}초 · ${esc(item.aspect || '9:16')} · ${esc(formatHistoryDate(item.updated_at))}</span>
                  ${item.final_url ? '<a href="' + esc(item.final_url) + '" target="_blank">최종 영상 열기</a>' : ''}
                </div>
                <div class="aad-history-row-actions">
                  <button onclick="aadOpenHistory(${Number(item.id)})"${disabled}>${openingID === Number(item.id) ? '불러오는 중...' : '이어 작업'}</button>
                  <button onclick="aadDeleteHistory(${Number(item.id)})"${disabled}>삭제</button>
                </div>
              </article>
            `;
          }).join('') : '<div class="aad-media-empty">저장된 작업 이력이 없습니다. 테스트 샘플이나 콘티를 만든 뒤 저장하세요.</div>'}
        </div>
      </div>
    `;
  }

  function renderQualityPanel() {
    const audit = state.quality || collectQualityAudit();
    const failed = audit.items.filter(function (item) { return !item.ok; });
    return `
      <div class="aad-card aad-quality-card">
        <div class="aad-card-head">
          <div>
            ${stepTag('QA', '완성도 검사')}
            <h3>완성도 검사</h3>
            <p>상용 쇼츠 광고로 내보내기 전 콘티, 컷, 이미지, 영상 API 음향/VFX, 마지막 브랜드 렌더를 한 번에 점검합니다.</p>
          </div>
          <div class="aad-quality-score">
            <b>${audit.score}</b>
            <span>${esc(audit.status)} · ${esc(audit.updatedAt)}</span>
          </div>
        </div>
        <div class="aad-quality-grid">
          ${audit.items.map(function (item) {
            return '<div class="aad-quality-item ' + (item.ok ? 'ok' : 'bad') + '"><b>' + (item.ok ? '✓' : '!') + ' ' + esc(item.name) + '</b><span>' + esc(item.detail) + '</span></div>';
          }).join('')}
        </div>
        ${failed.length ? '<div class="aad-quality-alert">남은 보완: ' + esc(failed.slice(0, 3).map(function (item) { return item.name; }).join(', ')) + (failed.length > 3 ? ' 외 ' + (failed.length - 3) + '개' : '') + '</div>' : '<div class="aad-quality-alert ok">상용 제출 기준을 통과했습니다.</div>'}
      </div>
    `;
  }

  function renderStoryboardBoard() {
    const refs = allCutRefs();
    const videoRefs = videoCutRefs();
    const videoKeys = new Set(videoRefs.map(function (ref) { return ref.key; }));
    const readyImages = refs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
    const readyVideos = videoRefs.filter(function (ref) { return hasRealSceneVideo(ref.key); }).length;
    const currentStep = activeFlowStepNo();
    const movingToImage = Number(state.stepMoving || 0) === 4;
    const boardStepLabel = currentStep === 4 ? stepTag(4, '기준 이미지') : (currentStep === 5 ? stepTag(5, '영상화') : stepTag('3-5', '콘티/이미지/영상'));
    const stageHint = currentStep === 3
      ? '<div class="aad-stage-hint"><b>' + (movingToImage ? '동작중 · 4단계 이미지 화면으로 이동중' : '지금은 3단계 콘티 검토 화면입니다') + '</b><span>이미지는 4단계에서 실제 영상에 쓸 선별 컷만 만듭니다. 버튼을 누르면 4단계 이미지 생성 버튼으로 바로 이동합니다.</span><button type="button" class="' + (movingToImage ? 'aad-loading-action' : 'aad-next-action') + '" onclick="aadGoToImageStage()" ' + (movingToImage ? 'disabled' : '') + '>' + (movingToImage ? '동작중...' : '4단계 이미지 생성으로 이동') + '</button></div>'
      : (currentStep === 4
        ? '<div class="aad-stage-hint active"><b>지금은 4단계 기준 이미지 생성 화면입니다</b><span>파란 테두리의 실제 영상화 대상 컷만 생성합니다. 카드 안의 이미지 생성 버튼도 바로 눌립니다.</span><button type="button" class="' + (state.busy ? 'aad-loading-action' : 'aad-next-action') + '" onclick="aadGenerateSelectedImages()" ' + (state.busy ? 'disabled' : '') + '>' + (state.busy ? '이미지 생성중...' : '선별 컷 이미지 생성') + '</button></div>'
        : '');
    return `
      <div class="aad-card aad-board-card">
        <div class="aad-card-head">
          <div>
            ${boardStepLabel}
            <h3>콘티 한눈에</h3>
            <p>${state.scenes.length}개 씬 · 콘티 후보 ${refs.length}컷 · 이미지 ${readyImages}개 · 실제 영상 ${readyVideos}/${videoRefs.length}개 · ${selectedDuration()}초는 실제 영상 ${videoRefs.length}컷만 사용</p>
          </div>
          <button class="aad-primary" onclick="aadOpenStoryboardModal(0)">크게 보기</button>
        </div>
        ${stageHint}
        ${renderVideoCutSelectionReview(refs, videoRefs)}
        <div class="aad-scene-strip">
          ${state.scenes.map(function (scene, index) {
            const cuts = ensureMicroCuts(scene, index);
            return '<button onclick="aadOpenStoryboardModal(' + Math.max(0, refs.findIndex(function (ref) { return ref.sceneIndex === index; })) + ')"><span>SCENE ' + (index + 1) + '</span><b>' + esc(scene.title || '장면') + '</b><em>' + cuts.length + '컷</em></button>';
          }).join('')}
        </div>
        <div class="aad-board-grid">
          ${refs.map(function (ref, index) {
            const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex);
            const video = state.videos[ref.key];
            const productionCut = videoKeys.has(ref.key);
            const thumb = cutPreviewUrl(ref);
            const generating = cutGeneratingKind(ref.key);
            const hasImage = hasRealSceneImage(ref.key);
            const hasVideo = hasRealSceneVideo(ref.key);
            const status = generating ? cutGeneratingLabel(ref.key) : (hasVideo ? '영상' : (productionCut && hasImage ? '영상 대상' : (hasImage ? '콘티 이미지' : (video?.mock || image?.mock ? '샘플' : '콘티'))));
            const statusClass = hasVideo ? 'video' : (productionCut ? 'production' : (hasImage ? 'image' : (video?.mock || image?.mock ? 'sample' : 'plan')));
            const reason = productionCut ? videoCutReason(ref) : '편집 후보';
            const thumbHtml = thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async">' : '';
            return `
              <article class="aad-board-cut ${statusClass}${thumb ? '' : ' no-thumb'}${generating ? ' generating' : ''}" role="button" tabindex="0" onclick="aadOpenStoryboardModal(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();aadOpenStoryboardModal(${index})}">
                ${thumbHtml}
                <span>${index + 1}</span>
                <b>S${ref.sceneIndex + 1}-C${ref.cutIndex + 1}</b>
                <strong>${esc(ref.cut.copy || ref.cut.title || ref.scene.title || '컷')}</strong>
                <small>${esc(reason)}</small>
                <em>${status}</em>
                ${renderCutGeneratingOverlay(ref, true)}
                ${renderBoardCutActions(ref, productionCut, hasImage, hasVideo, generating)}
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderScenes() {
    if (!state.scenes.length) {
      return '<div class="aad-empty">아직 콘티가 없습니다. 제작 브리프를 넣고 `상용 콘티 생성`을 누르세요.</div>';
    }
    return renderStoryboardBoard();
  }

  function renderStageBlocked(message, stepNo, buttonLabel) {
    return '<div class="aad-empty aad-step-blocked"><span>' + esc(message) + '</span><button type="button" class="aad-next-action" onclick="aadJumpFlowStep(' + Number(stepNo || 1) + ')">' + esc(buttonLabel || '이전 단계로 이동') + '</button></div>';
  }

  function renderImageStage() {
    if (!state.scenes.length) {
      return renderStageBlocked('먼저 3단계에서 콘티를 생성하세요. 기준 이미지는 실제 영상화 대상으로 선별된 컷만 만듭니다.', 3, '3단계 콘티 제작으로 이동');
    }
    return renderActions(4) + renderStoryboardBoard();
  }

  function renderVideoStage() {
    if (!state.scenes.length) {
      return renderStageBlocked('먼저 3단계에서 콘티를 생성하세요. 영상 API는 선별 컷 이미지가 있는 컷만 처리합니다.', 3, '3단계 콘티 제작으로 이동');
    }
    return renderActions(5) + renderStoryboardBoard();
  }

  function renderStage() {
    const step = activeFlowStepNo();
    if (step === 1) return renderBrief({ includeModelPicker: false });
    if (step === 2) return renderModelPicker();
    if (step === 3) return renderActions(3) + renderScenes();
    if (step === 4) return renderImageStage();
    if (step === 5) return renderVideoStage();
    if (step === 6) return renderActions(6) + renderSound();
    if (step === 7) return renderActions(7) + renderSound() + renderQualityPanel();
    if (step === 8) return renderHistoryPanel();
    return renderBrief({ includeModelPicker: false });
  }

  function renderSound() {
    const refs = videoCutRefs();
    const readyVideos = readyVideoCount(refs);
    const allReady = refs.length > 0 && readyVideos >= refs.length;
    return `
      <div class="aad-card">
        <div class="aad-card-head">
          <div>
            ${stepTag(6, '영상 API 음향/VFX')}
            <h3>영상 API BGM/SFX/VFX</h3>
            <p>일반 설명 자막은 넣지 않고, AI 핵심 표어와 마지막 브랜드만 편집합니다. 영상 API가 BGM/SFX/VFX를 컷 움직임과 함께 만들고, 최종 렌더에서 Gemini 음악/나레이션을 합성합니다.</p>
          </div>
          <div class="aad-sound-actions">
            <button type="button" onclick="aadGenerateAllVideos(true)"${state.busy || !refs.length ? ' disabled' : ''}>영상 옵션 재적용</button>
            <button type="button" onclick="aadResetFinalAudioAssets()"${state.busy ? ' disabled' : ''}>음악·목소리 재생성 준비</button>
            ${allReady && !state.finalUrl ? '<button type="button" class="aad-primary aad-next-action" onclick="aadJumpFlowStep(7)">다음: 마지막 브랜드 렌더</button>' : ''}
            ${state.finalUrl ? '<a class="aad-primary link" href="' + esc(state.finalUrl) + '" target="_blank">최종 영상 열기</a>' : ''}
          </div>
        </div>
        ${renderAudioEditPanel(refs, readyVideos)}
        ${renderSloganBrandEditor(refs)}
      </div>
    `;
  }

  function renderAudioEditPanel(refs, readyVideos) {
    const autoNarration = buildFinalNarrationText(refs);
    const customNarration = field('aad-narration-text', '');
    const musicDirection = field('aad-music-direction', currentBriefDetail().sound || '');
    return `
      <div class="aad-audio-edit-panel">
        <div class="aad-edit-panel-head">
          <div>
            <b>음악·목소리 선택</b>
            <span>영상 생성 옵션의 BGM/SFX와 최종 Gemini 음악·나레이션을 여기서 수정합니다.</span>
          </div>
          <em>영상 준비 ${readyVideos}/${refs.length}</em>
        </div>
        <div class="aad-audio-edit-grid">
          <label>목소리 선택<select id="aad-voice" onchange="aadUpdateFinalAudioSetting('aad-voice',this.value,'narration')">${optionTags(narrationVoiceOptions(), state.form['aad-voice'])}</select></label>
          <label>음악 방향<input id="aad-music-direction" value="${esc(musicDirection)}" onchange="aadUpdateFinalAudioSetting('aad-music-direction',this.value,'bgm')" placeholder="예: 낮은 tension tick, 해결 순간 밝은 hit, 마지막 긴 잔향"></label>
          <label class="wide">나레이션 문구<textarea id="aad-narration-text" rows="3" onchange="aadUpdateFinalAudioSetting('aad-narration-text',this.value,'narration')" placeholder="${esc(autoNarration || '비워두면 AI가 콘티와 브랜드를 보고 자동 생성합니다.')}">${esc(customNarration)}</textarea></label>
        </div>
        <div class="aad-audio-status">
          <span>${state.bgm?.url ? '음악 생성됨' : '최종 렌더 때 음악 생성'}</span>
          <span>${state.narration?.url ? '나레이션 생성됨' : '최종 렌더 때 나레이션 생성'}</span>
          <span>컷별 SFX/VFX는 이미 만든 영상 API 결과를 재사용</span>
        </div>
      </div>
    `;
  }

  function renderSloganBrandEditor(refs) {
    const overlayIndexes = new Set(sloganOverlayIndexes(refs.length));
    const finalBrandName = finalBrandNameValue();
    return `
      <div class="aad-slogan-editor">
        <div class="aad-edit-panel-head">
          <div>
            <b>표어·브랜드 수정</b>
            <span>자막 편집은 일반 자막이 아니라 중간 핵심 표어와 마지막 브랜드 문구만 다룹니다.</span>
          </div>
          <em>${refs.length ? '표어 자동 배치 ' + overlayIndexes.size + '곳' : '콘티 필요'}</em>
        </div>
        <label class="aad-final-brand-field">마지막 브랜드명<input id="aad-final-brand-name" value="${esc(finalBrandName)}" onchange="aadUpdateFinalTextSetting('aad-final-brand-name',this.value)"></label>
        <div class="aad-slogan-cut-grid">
          ${refs.length ? refs.map(function (ref, index) {
            const show = overlayIndexes.has(index) || index === refs.length - 1;
            return `
              <article class="${show ? 'active' : ''}">
                <div>
                  <b>S${ref.sceneIndex + 1}-C${ref.cutIndex + 1}</b>
                  <span>${show ? (index === refs.length - 1 ? '마지막 브랜드' : '핵심 표어 노출') : '영상 컷만 사용'}</span>
                </div>
                <input value="${esc(overlaySloganText(ref, index, refs.length))}" placeholder="컷 내용 기반 핵심 표어" onchange="aadUpdateCutFieldOnly(${ref.sceneIndex},${ref.cutIndex},'overlay_slogan',this.value)">
                <input value="${esc(ref.cut.slogan_motion || ref.cut.vfx_cue || '')}" placeholder="표어 모션/감정" onchange="aadUpdateCutFieldOnly(${ref.sceneIndex},${ref.cutIndex},'slogan_motion',this.value)">
              </article>
            `;
          }).join('') : '<div class="aad-media-empty">먼저 콘티를 생성하세요. 선별 컷 기준으로 표어 편집 칸이 생깁니다.</div>'}
        </div>
      </div>
    `;
  }

  function renderLogs() {
    const logs = state.logs.length ? state.logs : fallbackRecentLogs();
    const visibleCount = Math.max(3, Number(state.logVisibleCount || 3));
    const visibleLogs = logs.slice(0, visibleCount);
    const hasMore = logs.length > visibleLogs.length;
    return `
      <div class="aad-log">
        <div class="aad-log-head">
          <div class="aad-mini-title">최근 작업 로그 <span>${visibleLogs.length}/${logs.length}</span></div>
          <div>
            ${(state.history.items || []).length ? '<button type="button" onclick="aadOpenHistory(' + Number(state.history.items[0].id) + ')">마지막 이력 이어하기</button>' : ''}
            <button type="button" onclick="aadJumpFlowStep(8)">이력 보기</button>
          </div>
        </div>
        ${visibleLogs.map(function (item) {
          return '<div class="aad-log-line ' + esc(item.level) + '"><span>' + esc(item.time) + '</span><p>' + esc(item.message) + '</p></div>';
        }).join('')}
        <div class="aad-log-pager">
          ${hasMore ? '<button type="button" onclick="aadShowMoreLogs()">3개 더 보기</button>' : ''}
          ${visibleCount > 3 ? '<button type="button" onclick="aadCollapseLogs()">3개만 보기</button>' : ''}
        </div>
        ${renderLogHistoryResume()}
      </div>
    `;
  }

  function showMoreLogs() {
    state.logVisibleCount = Math.min((state.logs.length ? state.logs : fallbackRecentLogs()).length, Math.max(3, Number(state.logVisibleCount || 3)) + 3);
    render();
  }

  function collapseLogs() {
    state.logVisibleCount = 3;
    render();
  }

  function renderStoryboardModal() {
    if (state.storyboardIndex == null) return '';
    const refs = allCutRefs();
    if (!refs.length) return '';
    const modalIndex = Math.max(0, Math.min(refs.length - 1, Number(state.storyboardIndex) || 0));
    const ref = refs[modalIndex];
    const video = state.videos[ref.key];
    const image = selectedSceneImage(ref.sceneIndex, ref.cutIndex);
    const media = renderStoryboardVisual(ref);
    const hasImage = hasRealSceneImage(ref.key);
    const hasVideo = hasRealSceneVideo(ref.key);
    const canGenerateImage = isVideoProductionCut(ref.key);
    const imageGenerating = !!state.generating.images[ref.key];
    const videoGenerating = !!state.generating.videos[ref.key];
    const imageButtonLabel = imageGenerating ? '이미지 생성중...' : (canGenerateImage ? (hasImage ? '이미지 재생성' : '이미지 생성') : '편집 후보');
    const videoButtonLabel = videoGenerating ? '영상 생성중...' : (hasVideo ? '영상 재생성' : '영상 생성');
    const imageButtonDisabled = canGenerateImage && !state.busy && !imageGenerating ? '' : ' disabled title="실제 영상화 대상 컷만 이미지를 생성합니다"';
    const videoButtonDisabled = mediaUrl(image) && !state.busy && !videoGenerating ? '' : ' disabled';
    return `
      <div class="aad-modal-backdrop" onclick="if(event.target===this)aadCloseStoryboardModal()">
        <div class="aad-storyboard-modal">
          <div class="aad-storyboard-left">
            <div class="aad-storyboard-topbar">
              <div>
                <b>콘티 ${modalIndex + 1} / ${refs.length}</b>
                <span>SCENE ${ref.sceneIndex + 1} · CUT ${ref.cutIndex + 1}</span>
              </div>
              <button onclick="aadCloseStoryboardModal()">닫기</button>
            </div>
            <div class="aad-storyboard-preview">
              <div class="aad-storyboard-sequence">
                ${refs.map(function (item, index) {
                  return renderStoryboardThumb(item, index, index === modalIndex);
                }).join('')}
              </div>
              <div class="aad-storyboard-stage">
                ${media}
                ${renderCutGeneratingOverlay(ref, false)}
                <div class="aad-storyboard-copy">
                  <span>${esc(ref.scene.role || ref.scene.visual_mode || 'CUT')}</span>
                  <b>${esc(ref.cut.copy || ref.cut.title || ref.scene.title || '')}</b>
                </div>
              </div>
            </div>
            <div class="aad-storyboard-nav">
              <button onclick="aadMoveStoryboardModal(-1)"${modalIndex <= 0 ? ' disabled' : ''}>이전 컷</button>
              <button${generationButtonAttrs('image', ref.key)} onclick="aadGenerateSceneImage(${ref.sceneIndex},${ref.cutIndex})"${imageButtonDisabled}>${imageButtonLabel}</button>
              <button${generationButtonAttrs('video', ref.key)} onclick="aadGenerateSceneVideo(${ref.sceneIndex},${ref.cutIndex})"${videoButtonDisabled}>${videoButtonLabel}</button>
              <button onclick="aadReapplyStoryboardCut()"${canGenerateImage && !state.busy ? '' : ' disabled title="선별 컷만 수정값을 다시 적용합니다"'}>수정값 재적용</button>
              <button onclick="aadMoveStoryboardModal(1)"${modalIndex >= refs.length - 1 ? ' disabled' : ''}>다음 컷</button>
            </div>
          </div>
          <div class="aad-storyboard-right">
            <div class="aad-mini-title">컷 값 편집</div>
            <div class="aad-storyboard-edit-actions">
              <button${generationButtonAttrs('image', ref.key)} onclick="aadGenerateSceneImage(${ref.sceneIndex},${ref.cutIndex})"${imageButtonDisabled}>${imageButtonLabel}</button>
              <button${generationButtonAttrs('video', ref.key)} onclick="aadGenerateSceneVideo(${ref.sceneIndex},${ref.cutIndex})"${videoButtonDisabled}>${videoButtonLabel}</button>
              <button onclick="aadReapplyStoryboardCut()"${canGenerateImage && !state.busy ? '' : ' disabled title="선별 컷만 수정값을 다시 적용합니다"'}>수정값 재적용</button>
            </div>
            <label>컷 제목<input value="${esc(ref.cut.title || '')}" oninput="aadUpdateModalCut('title',this.value)"></label>
            <label>카메라<input value="${esc(ref.cut.camera || '')}" oninput="aadUpdateModalCut('camera',this.value)"></label>
            <label>행동/연출<textarea rows="3" oninput="aadUpdateModalCut('action',this.value)">${esc(ref.cut.action || '')}</textarea></label>
            <label>핵심 표어/브랜드 메모<textarea rows="3" oninput="aadUpdateModalCut('copy',this.value)">${esc(ref.cut.copy || '')}</textarea></label>
            <label>컷 VFX<select onchange="aadUpdateModalCut('vfx_preset',this.value)">${optionTags(VFX_PRESETS, cutVFXPreset(ref.cut).value)}</select></label>
            <label>이미지 프롬프트<textarea rows="4" oninput="aadUpdateModalCut('image_prompt',this.value)">${esc(ref.cut.image_prompt || '')}</textarea></label>
            <label>영상 프롬프트<textarea rows="4" oninput="aadUpdateModalCut('video_prompt',this.value)">${esc(ref.cut.video_prompt || '')}</textarea></label>
            <label>VFX 큐<input value="${esc(ref.cut.vfx_cue || '')}" oninput="aadUpdateModalCut('vfx_cue',this.value)"></label>
            <label>사운드 큐<input value="${esc(ref.cut.sound_cue || '')}" oninput="aadUpdateModalCut('sound_cue',this.value)"></label>
            <div class="aad-storyboard-note">
              <b>${esc(ref.scene.title || '')}</b>
              <span>${esc(ref.scene.cut_plan || ref.scene.body || '')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    if (suppressNextFormSync) {
      suppressNextFormSync = false;
    } else {
      syncForm();
    }
    if (state.scenes.length && isStoryboardBusy() && !isStoryboardGenerating()) {
      state.busy = '';
      state.logs.unshift(makeLog('콘티 생성 완료 상태를 확인해 작업중 표시를 해제했습니다.', 'info'));
      state.logs = state.logs.slice(0, 10);
    }
    const el = root();
    if (!el) return;
    document.body.classList.toggle('aad-animation-active', !!document.getElementById('page-animation-ad')?.classList.contains('active'));
    el.innerHTML = renderModelSettingsBar() + renderProductionFlow() + '<div class="aad-stage-anchor" data-aad-active-step="' + activeFlowStepNo() + '">' + renderStage() + '</div>' + renderLogs() + renderStoryboardModal() + renderPersonaModelPreviewModal() + renderPersonaModelBuilderModal() + renderBenchmarkLibraryModal();
  }

  function installStyles() {
    if (document.getElementById('animation-ad-style')) return;
    const style = document.createElement('style');
    style.id = 'animation-ad-style';
    style.textContent = `
      body.aad-animation-active .main{width:calc(100vw - 260px);max-width:none;overflow-x:hidden;overflow-y:visible;}
      #page-animation-ad{width:calc(100vw - 332px);max-width:none!important;min-width:0;overflow-x:hidden;overflow-y:visible;}
      #animation-ad-root{width:100%;min-width:0;max-width:none;overflow-x:hidden;overflow-y:visible;}
      #animation-ad-root,#animation-ad-root *{box-sizing:border-box;}
      .aad-hero,.aad-card,.aad-scene,.aad-log{background:rgba(255,255,255,0.86);border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:18px;margin-bottom:16px;box-shadow:0 10px 28px rgba(0,0,0,0.04);}
      .aad-hero,.aad-card,.aad-scene,.aad-log,.aad-flow-card{min-width:0;max-width:100%;}
      .aad-model-settings-bar{display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) auto;gap:10px;align-items:stretch;margin:0 0 14px;max-width:100%;min-width:0;}
      .aad-model-settings-bar>div{min-width:0;border:1px solid rgba(255,140,0,.16);border-radius:13px;background:linear-gradient(135deg,rgba(255,140,0,.08),rgba(255,255,255,.92));padding:11px 13px;}
      .aad-model-settings-bar span{display:block;font-size:10px;font-weight:950;color:#ff8c00;letter-spacing:.06em;margin-bottom:4px;}
      .aad-model-settings-bar b{display:inline-flex;margin-right:8px;font-size:12px;font-weight:1000;color:#1c1c1e;}
      .aad-model-settings-bar strong{font-size:12px;font-weight:850;color:rgba(0,0,0,.58);word-break:break-all;}
      .aad-model-settings-bar button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:0 14px;cursor:pointer;white-space:nowrap;}
      .aad-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:18px;align-items:start;background:linear-gradient(135deg,rgba(255,140,0,0.08),rgba(255,255,255,0.92));}
      .aad-kicker{font-size:11px;font-weight:900;color:#ff8c00;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;}
      .aad-hero h2{font-size:26px;font-weight:950;letter-spacing:-.03em;margin:0 0 8px;color:#1c1c1e;}
      .aad-hero p,.aad-card p,.aad-scene-head p{font-size:13px;line-height:1.65;color:rgba(0,0,0,0.48);margin:0;}
      .aad-status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;min-width:0;}
      .aad-pill{display:flex;align-items:center;justify-content:center;padding:8px 10px;border-radius:999px;background:rgba(255,140,0,0.08);border:1px solid color-mix(in srgb,var(--aad-pill),transparent 72%);color:var(--aad-pill);font-size:11px;font-weight:900;text-align:center;}
      .aad-flow-card{background:rgba(255,255,255,.88);border:1px solid rgba(255,140,0,.14);border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:0 12px 30px rgba(255,140,0,.06);}
      .aad-stage-anchor{scroll-margin-top:18px;min-width:0;max-width:100%;}
      .aad-flow-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;}
      .aad-flow-head h3{margin:0 0 4px;font-size:17px;font-weight:1000;color:#1c1c1e;}
      .aad-flow-head p{margin:0;font-size:12px;line-height:1.5;font-weight:760;color:rgba(0,0,0,.48);}
      .aad-flow-head button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:9px 12px;cursor:pointer;white-space:nowrap;}
      .aad-flow-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:8px;padding-bottom:2px;min-width:0;}
      .aad-flow-steps button{position:relative;min-height:116px;border:1px solid rgba(0,0,0,.07);border-radius:13px;background:#fff;padding:11px 10px;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 7px 16px rgba(0,0,0,.035);}
      .aad-flow-steps button:after{content:'';position:absolute;left:48px;right:-10px;top:22px;height:2px;background:rgba(255,140,0,.18);}
      .aad-flow-steps button:last-child:after{display:none;}
      .aad-flow-steps strong{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:rgba(0,0,0,.07);color:rgba(0,0,0,.58);font-size:13px;font-weight:1000;margin-bottom:9px;}
      .aad-flow-steps b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;line-height:1.2;margin-bottom:5px;}
      .aad-flow-steps span{display:block;font-size:10px;line-height:1.35;font-weight:760;color:rgba(0,0,0,.48);}
      .aad-flow-steps button.done{background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.2);}
      .aad-flow-steps button.done strong{background:#34c759;color:#fff;}
      .aad-flow-steps button.next{border-color:rgba(255,140,0,.32);box-shadow:0 10px 22px rgba(255,140,0,.08);}
      .aad-flow-steps button.next strong{background:rgba(255,140,0,.12);color:#ff6b00;}
      .aad-flow-steps button em{position:absolute;right:9px;top:9px;border-radius:999px;background:rgba(255,140,0,.12);color:#ff6b00;font-style:normal;font-size:9px;font-weight:1000;padding:4px 7px;}
      .aad-flow-steps button.active{border-color:#1c1c1e;box-shadow:0 0 0 3px rgba(0,0,0,.08),0 12px 24px rgba(0,0,0,.1);}
      .aad-flow-steps button.active strong{background:#1c1c1e;color:#fff;}
      .aad-step-tag{display:inline-flex;align-items:center;gap:6px;width:max-content;margin:0 0 7px;padding:5px 8px;border-radius:999px;background:rgba(255,140,0,.09);border:1px solid rgba(255,140,0,.18);color:#ff6b00;font-size:10px;line-height:1;font-weight:950;letter-spacing:0;}
      .aad-step-tag b{font-size:10px;font-weight:1000;color:#ff8c00;letter-spacing:.04em;}
      .aad-board-card .aad-step-tag{background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.2);color:#ffd59a;}
      .aad-board-card .aad-step-tag b{color:#fff;}
      .aad-stage-hint{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(255,140,0,.22);border-radius:14px;background:rgba(255,255,255,.1);padding:12px;margin:4px 0 12px;color:#fff;}
      .aad-stage-hint b{font-size:13px;font-weight:1000;color:#fff;}
      .aad-stage-hint span{display:block;font-size:11px;line-height:1.5;font-weight:760;color:rgba(255,255,255,.68);margin-top:3px;}
      .aad-stage-hint button{border:none;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;padding:9px 12px;cursor:pointer;white-space:nowrap;}
      .aad-stage-hint.active{border-color:rgba(255,140,0,.55);box-shadow:0 0 0 3px rgba(255,140,0,.12),0 18px 34px rgba(255,140,0,.16);}
      .aad-stage-hint button:disabled{opacity:.58;cursor:wait;}
      .aad-card-head,.aad-scene-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:14px;}
      .aad-card h3,.aad-scene h3{font-size:17px;font-weight:900;margin:0 0 4px;color:#1c1c1e;}
      .aad-primary,.aad-action-group button,.aad-scene-actions button{border:none;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:900;padding:9px 14px;cursor:pointer;text-decoration:none;white-space:nowrap;}
      .aad-action-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px;}
      .aad-action-group{display:flex;flex-direction:column;gap:8px;min-height:116px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.82);padding:12px;box-shadow:0 8px 18px rgba(0,0,0,.035);}
      .aad-action-group .aad-step-tag{margin-bottom:0;}
      .aad-action-group button{width:100%;background:#1c1c1e;}
      .aad-action-group:nth-child(1) button:first-of-type,.aad-action-group:nth-child(4) button,.aad-action-group:nth-child(6) button{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-action-group:nth-child(5) button{background:#34c759;}
      .aad-action-group button.aad-secondary-action{background:rgba(0,0,0,.08);color:#1c1c1e;box-shadow:none;}
      .aad-action-group button:disabled,.aad-scene-actions button:disabled{opacity:.4;cursor:not-allowed;}
      .aad-history-actions,.aad-history-row-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
      .aad-history-actions button,.aad-history-row-actions button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:9px 12px;cursor:pointer;white-space:nowrap;}
      .aad-history-actions button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-history-actions button.danger{background:rgba(255,59,48,.1);color:#ff3b30;border:1px solid rgba(255,59,48,.18);}
      .aad-history-actions button:disabled,.aad-history-row-actions button:disabled{opacity:.42;cursor:not-allowed;}
      .aad-history-meta{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 12px;}
      .aad-history-meta span{display:inline-flex;align-items:center;border-radius:999px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.14);color:#ff6b00;font-size:11px;font-weight:950;padding:7px 10px;}
      .aad-history-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;}
      .aad-history-item{display:grid;grid-template-columns:74px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.68);padding:10px;}
      .aad-history-item.active{border-color:rgba(255,140,0,.42);box-shadow:0 0 0 3px rgba(255,140,0,.1);}
      .aad-history-thumb{width:74px;height:88px;border:none;border-radius:12px;background:#f2f2f7;overflow:hidden;padding:0;cursor:pointer;}
      .aad-history-thumb img{display:block;width:100%;height:100%;object-fit:cover;}
      .aad-history-placeholder{display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(255,140,0,.16),rgba(0,0,0,.04));color:#ff8c00;font-size:17px;font-weight:1000;}
      .aad-history-item b{display:block;font-size:13px;font-weight:950;color:#1c1c1e;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .aad-history-item span{display:block;font-size:11px;font-weight:800;color:rgba(0,0,0,.46);margin-top:3px;}
      .aad-history-item a{display:inline-flex;margin-top:5px;font-size:11px;font-weight:950;color:#007aff;text-decoration:none;}
      .aad-history-row-actions button:last-child{background:rgba(255,59,48,.1);color:#ff3b30;border:1px solid rgba(255,59,48,.14);}
      .aad-brief-details{margin-bottom:16px;}
      .aad-brief-details>summary{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid rgba(255,140,0,.14);border-radius:14px;background:rgba(255,255,255,.88);padding:14px 16px;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.035);}
      .aad-brief-details>summary b{font-size:14px;font-weight:950;color:#1c1c1e;}
      .aad-brief-details>summary span{font-size:12px;font-weight:850;color:rgba(0,0,0,.42);text-align:right;}
      .aad-brief-details>div{margin-top:12px;}
      .aad-board-card{position:relative;overflow:hidden;border-color:rgba(255,140,0,.26);background:radial-gradient(circle at 18% 10%,rgba(255,140,0,.34),transparent 30%),radial-gradient(circle at 84% 0%,rgba(0,122,255,.28),transparent 34%),linear-gradient(135deg,#090d18,#17111f 46%,#251206);box-shadow:0 24px 60px rgba(255,107,0,.14),0 14px 38px rgba(0,0,0,.1);}
      .aad-board-card:before{content:'';position:absolute;inset:-30% auto -30% -18%;width:44%;transform:skewX(-16deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),rgba(255,140,0,.34),transparent);filter:blur(20px);pointer-events:none;animation:aad-board-sweep 5.5s ease-in-out infinite;}
      .aad-board-card>.aad-card-head,.aad-board-card>.aad-scene-strip,.aad-board-card>.aad-board-grid{position:relative;z-index:1;}
      .aad-board-card h3,.aad-board-card .aad-card-head p{color:#fff;}
      .aad-board-card .aad-card-head p{color:rgba(255,255,255,.68);}
      .aad-selection-review{position:relative;z-index:1;margin:4px 0 12px;border:1px solid rgba(255,255,255,.16);border-radius:16px;background:rgba(255,255,255,.1);backdrop-filter:blur(14px);padding:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}
      .aad-selection-review>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-selection-review b{display:block;font-size:13px;font-weight:1000;color:#fff;}
      .aad-selection-review>div span{font-size:11px;line-height:1.45;font-weight:820;color:rgba(255,255,255,.66);text-align:right;}
      .aad-selection-review ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:0;padding:0;list-style:none;}
      .aad-selection-review li{border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.18);padding:9px;}
      .aad-selection-review strong{display:block;font-size:11px;font-weight:1000;color:#ffd59a;margin-bottom:4px;}
      .aad-selection-review li span{display:block;font-size:10px;line-height:1.42;font-weight:760;color:rgba(255,255,255,.62);}
      .aad-creative-field{display:block!important;margin:0 0 12px!important;border:1px solid rgba(255,140,0,.26);border-radius:15px;background:radial-gradient(circle at 12% 0%,rgba(255,140,0,.28),transparent 34%),rgba(0,0,0,.2);padding:12px;}
      .aad-creative-field.pending{background:rgba(0,0,0,.16);border-style:dashed;}
      .aad-creative-field>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-creative-field>div b{font-size:15px;color:#fff;}
      .aad-creative-field>div span{max-width:520px;text-align:right;}
      .aad-creative-field ul{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));}
      .aad-creativity-audit{display:block!important;margin:10px 0 0!important;border-top:1px solid rgba(255,255,255,.12);padding-top:10px;}
      .aad-creativity-audit>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px;}
      .aad-creativity-audit span{display:block!important;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.18);padding:9px;text-align:left!important;}
      .aad-creativity-audit em{display:block;font-style:normal;font-size:10px;line-height:1.42;font-weight:760;color:rgba(255,255,255,.62);}
      .aad-scene-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;}
      .aad-scene-strip button{min-width:168px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.09);backdrop-filter:blur(14px);padding:10px;text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}
      .aad-scene-strip span{display:block;font-size:10px;font-weight:950;color:#ffd59a;letter-spacing:.08em;margin-bottom:3px;}
      .aad-scene-strip b{display:block;font-size:12px;font-weight:950;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .aad-scene-strip em{display:block;margin-top:5px;font-style:normal;font-size:11px;font-weight:900;color:rgba(255,255,255,.56);}
      .aad-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:9px;}
      .aad-board-cut{position:relative;display:block;min-height:224px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:#111827;overflow:hidden;padding:0;cursor:pointer;color:#fff;text-align:left;box-shadow:0 18px 34px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.12);}
      .aad-board-cut.image{border-color:rgba(255,140,0,.72);box-shadow:0 18px 34px rgba(255,140,0,.16),inset 0 1px 0 rgba(255,255,255,.13);}
      .aad-board-cut.production{border-color:rgba(0,122,255,.78);box-shadow:0 18px 34px rgba(0,122,255,.16),inset 0 1px 0 rgba(255,255,255,.13);}
      .aad-board-cut.sample{border-color:rgba(255,255,255,.24);box-shadow:0 18px 34px rgba(142,142,147,.16),inset 0 1px 0 rgba(255,255,255,.13);}
      .aad-board-cut.video{border-color:rgba(52,199,89,.82);box-shadow:0 18px 34px rgba(52,199,89,.18),inset 0 1px 0 rgba(255,255,255,.13);}
      .aad-board-cut.generating{border-color:rgba(255,140,0,.92);box-shadow:0 0 0 3px rgba(255,140,0,.22),0 24px 48px rgba(255,140,0,.22),inset 0 1px 0 rgba(255,255,255,.13);}
      .aad-board-cut img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.82;transition:transform .18s ease;}
      .aad-board-cut:hover img{transform:scale(1.04);}
      .aad-board-cut:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(0,0,0,.18) 38%,rgba(0,0,0,.82)),linear-gradient(135deg,rgba(255,140,0,.2),transparent 36%,rgba(0,122,255,.14));}
      .aad-board-cut:before{content:'';position:absolute;z-index:1;left:-60%;top:0;width:44%;height:100%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);filter:blur(8px);opacity:.55;transition:left .28s ease;}
      .aad-board-cut:hover:before{left:116%;}
      .aad-board-cut span{position:absolute;z-index:2;left:8px;top:8px;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#ff8c00;color:#111827;font-size:11px;font-weight:1000;}
      .aad-board-cut b{position:absolute;z-index:2;right:8px;top:8px;padding:6px 7px;border-radius:999px;background:rgba(0,0,0,.48);backdrop-filter:blur(8px);font-size:10px;font-weight:950;color:#fff;}
      .aad-board-cut strong{position:absolute;z-index:2;left:9px;right:9px;bottom:84px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.28;font-weight:950;color:#fff;}
      .aad-board-cut small{position:absolute;z-index:2;left:9px;right:9px;bottom:61px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:950;color:#ffd59a;}
      .aad-board-cut em{position:absolute;z-index:2;left:9px;bottom:36px;font-style:normal;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.18);font-size:10px;font-weight:950;color:#fff;}
      .aad-board-actions{position:absolute;z-index:4;left:8px;right:8px;bottom:7px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;pointer-events:none;}
      .aad-board-actions button{display:flex;align-items:center;justify-content:center;min-width:0;height:24px;border:0;border-radius:999px;background:#fff;color:#111827;font-style:normal;font-size:10px;font-weight:1000;line-height:1;box-shadow:0 8px 18px rgba(0,0,0,.22);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;padding:0 8px;}
      .aad-board-actions button.video-action{background:#1c1c1e;color:#fff;}
      .aad-board-actions button:hover{background:#ff8c00;color:#111827;}
      .aad-board-actions button:disabled,.aad-storyboard-shot-card button:disabled{opacity:.58;cursor:wait;filter:saturate(.75);}
      .aad-generating-badge{position:absolute;z-index:8;inset:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);border:1px solid rgba(255,140,0,.38);box-shadow:0 24px 60px rgba(0,0,0,.32);color:#fff;text-align:center;pointer-events:none;}
      .aad-storyboard-stage>.aad-generating-badge:not(.compact){inset:18px 18px auto 18px;min-height:86px;flex-direction:row;justify-content:flex-start;text-align:left;padding:16px 18px;background:linear-gradient(135deg,rgba(0,0,0,.72),rgba(0,0,0,.38));backdrop-filter:blur(10px);border-radius:16px;}
      .aad-storyboard-stage>.aad-generating-badge.video:not(.compact){background:linear-gradient(135deg,rgba(0,122,255,.78),rgba(0,0,0,.38));}
      .aad-generating-badge .spinner{width:42px;height:42px;border-width:4px;}
      .aad-generating-title{font-size:24px;line-height:1.1;font-weight:1000;color:#fff;}
      .aad-generating-desc{font-size:12px;line-height:1.35;font-weight:850;color:rgba(255,255,255,.68);}
      .aad-generating-badge.compact{inset:8px;gap:5px;border-radius:12px;background:rgba(0,0,0,.76);}
      .aad-generating-badge.compact .spinner{width:26px;height:26px;border-width:3px;}
      .aad-generating-badge.compact .aad-generating-title{font-size:14px;}
      .aad-generating-badge.compact .aad-generating-desc{display:none;}
      .aad-board-cut.video em{background:rgba(52,199,89,.88);border-color:transparent;color:#fff;}
      .aad-board-cut.image em{background:rgba(255,140,0,.9);border-color:transparent;color:#111827;}
      .aad-board-cut.production em{background:rgba(0,122,255,.9);border-color:transparent;color:#fff;}
      .aad-board-cut.sample em{background:rgba(142,142,147,.9);border-color:transparent;color:#fff;}
      @keyframes aad-board-sweep{0%,55%{transform:translateX(0) skewX(-16deg);opacity:.22}72%{transform:translateX(260%) skewX(-16deg);opacity:.72}100%{transform:translateX(260%) skewX(-16deg);opacity:0}}
      .aad-detail-editor{margin-bottom:16px;}
      .aad-detail-editor summary{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.86);padding:14px 16px;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.035);}
      .aad-detail-editor summary b{font-size:14px;font-weight:950;color:#1c1c1e;}
      .aad-detail-editor summary span{font-size:12px;font-weight:850;color:rgba(0,0,0,.42);text-align:right;}
      .aad-detail-editor[open] summary{margin-bottom:12px;border-color:rgba(255,140,0,.18);}
      .aad-quality-score{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:118px;}
      .aad-quality-score b{font-size:34px;font-weight:950;line-height:1;color:#ff8c00;}
      .aad-quality-score span{font-size:11px;font-weight:900;color:rgba(0,0,0,.46);text-align:right;}
      .aad-quality-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;}
      .aad-quality-item{border:1px solid rgba(0,0,0,.06);background:rgba(0,0,0,.025);border-radius:12px;padding:10px;}
      .aad-quality-item.ok{background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.16);}
      .aad-quality-item.bad{background:rgba(255,149,0,.08);border-color:rgba(255,149,0,.18);}
      .aad-quality-item b{display:block;font-size:12px;font-weight:950;color:#1c1c1e;margin-bottom:4px;}
      .aad-quality-item span{display:block;font-size:11px;line-height:1.45;color:rgba(0,0,0,.54);font-weight:720;}
      .aad-quality-alert{margin-top:10px;border-radius:12px;padding:10px 12px;background:rgba(255,149,0,.09);color:#ff6b00;font-size:12px;font-weight:950;}
      .aad-quality-alert.ok{background:rgba(52,199,89,.09);color:#1f9d49;}
      .aad-pacing-note{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:14px 0 0;padding:12px 14px;border-radius:14px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.16);}
      .aad-pacing-note b{font-size:12px;font-weight:950;color:#ff6b00;white-space:nowrap;}
      .aad-pacing-note span{font-size:12px;line-height:1.55;color:rgba(0,0,0,.58);text-align:right;}
      .aad-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:10px;}
      .aad-form-grid>.wide{grid-column:1/-1;}
      .aad-form-grid label.wide{grid-column:1/-1;}
      .aad-form-grid label,.aad-wide{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:900;color:#1c1c1e;}
      .aad-form-grid input,.aad-form-grid select,.aad-wide textarea{width:100%;border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:10px 11px;background:#fff;font-size:13px;outline:none;}
      .aad-step-one-card{border-color:rgba(255,140,0,.18);background:linear-gradient(180deg,rgba(255,250,244,.96),rgba(255,255,255,.9));}
      .aad-step-one-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px;min-width:0;max-width:100%;overflow:hidden;}
      .aad-step-one-head>div:first-child{flex:1 1 auto;min-width:0;}
      .aad-step-one-head h3{margin:0 0 6px;font-size:22px;font-weight:1000;color:#1c1c1e;}
      .aad-step-one-head p{max-width:820px;font-size:13px;line-height:1.6;font-weight:760;color:rgba(0,0,0,.52);}
      .aad-step-one-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;flex:0 1 360px;min-width:240px;max-width:100%;}
      .aad-step-one-actions button{flex:1 1 160px;min-width:0;border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:11px 12px;cursor:pointer;white-space:normal;}
      .aad-step-one-actions button:last-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-step-one-actions button:disabled{opacity:.45;cursor:not-allowed;}
      .aad-next-action{position:relative!important;box-shadow:0 0 0 4px rgba(255,140,0,.18),0 14px 28px rgba(255,140,0,.2)!important;animation:aad-action-pulse 1.05s ease-in-out infinite,aad-action-glow 1.05s ease-in-out infinite!important;}
      .aad-next-action:after{content:'눌러주세요';position:absolute;right:8px;top:-13px;border-radius:999px;background:#ff8c00;color:#fff;font-size:10px;font-weight:1000;padding:4px 8px;box-shadow:0 8px 18px rgba(255,140,0,.24);z-index:5;white-space:nowrap;}
      .aad-next-action:disabled:after{display:none;}
      .aad-loading-action{background:linear-gradient(135deg,#1c1c1e,#3a3a3c)!important;color:#fff!important;cursor:wait!important;box-shadow:0 0 0 4px rgba(0,0,0,.08),0 14px 28px rgba(0,0,0,.12)!important;}
      @keyframes aad-action-pulse{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
      @keyframes aad-action-glow{0%,100%{filter:brightness(1);box-shadow:0 0 0 4px rgba(255,140,0,.16),0 14px 28px rgba(255,140,0,.18)}50%{filter:brightness(1.12);box-shadow:0 0 0 7px rgba(255,140,0,.28),0 20px 38px rgba(255,140,0,.32)}}
      .aad-step-loading{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:16px 18px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,.16),rgba(255,255,255,.94));border:1px solid rgba(255,140,0,.28);box-shadow:0 16px 34px rgba(255,140,0,.1);color:#1c1c1e;}
      .aad-step-loading .spinner{width:32px;height:32px;border-width:3px;flex:0 0 auto;}
      .aad-step-loading b{display:block;font-size:15px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-step-loading p{margin:0;font-size:12px;line-height:1.45;font-weight:820;color:rgba(0,0,0,.58);}
      .aad-step-loading.compact{margin:10px 0;padding:12px 13px;border-radius:13px;}
      .aad-step-loading.compact .spinner{width:24px;height:24px;}
      .aad-storyboard-writing-hero{align-items:center;margin:0 0 18px;padding:22px 24px;border-radius:20px;background:radial-gradient(circle at 8% 0%,rgba(255,140,0,.32),transparent 30%),linear-gradient(135deg,rgba(28,28,30,.96),rgba(58,58,60,.92));border-color:rgba(255,140,0,.42);box-shadow:0 22px 54px rgba(255,140,0,.18),0 18px 46px rgba(0,0,0,.18);color:#fff;}
      .aad-storyboard-writing-hero .spinner{width:48px;height:48px;border-width:4px;border-top-color:#ff8c00;border-right-color:rgba(255,255,255,.28);border-bottom-color:rgba(255,255,255,.28);border-left-color:rgba(255,255,255,.28);}
      .aad-storyboard-writing-hero em{display:block;margin-bottom:5px;font-style:normal;font-size:11px;line-height:1;font-weight:1000;color:#ffb45b;letter-spacing:.08em;}
      .aad-storyboard-writing-hero b{font-size:28px;line-height:1.08;color:#fff;margin-bottom:7px;}
      .aad-storyboard-writing-hero p{max-width:900px;font-size:13px;color:rgba(255,255,255,.72);}
      .aad-success-learning{margin-top:14px;border:1px solid rgba(255,140,0,.16);border-radius:14px;background:linear-gradient(180deg,rgba(255,140,0,.045),rgba(255,255,255,.94));padding:13px;min-width:0;max-width:100%;}
      .aad-success-learning-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:10px;min-width:0;}
      .aad-success-learning-head b{display:block;font-size:13px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-success-learning-head span{display:block;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.54);}
      .aad-success-learning-head button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:10px 12px;cursor:pointer;white-space:nowrap;}
      .aad-success-learning-head button:disabled{opacity:.48;cursor:wait;}
      .aad-success-learning-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
      .aad-success-learning-grid label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:950;color:#1c1c1e;min-width:0;}
      .aad-success-learning-grid label.wide{grid-column:1/-1;}
      .aad-success-learning-grid input,.aad-success-learning-grid textarea{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px 11px;font-size:12px;line-height:1.45;outline:none;resize:vertical;}
      .aad-success-learning-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px;}
      .aad-success-learning-meta span{border-radius:999px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.14);color:#ff6b00;padding:6px 8px;font-size:11px;font-weight:950;}
      .aad-success-learning-meta button{margin-left:auto;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;color:#1c1c1e;font-size:11px;font-weight:950;padding:7px 9px;cursor:pointer;}
      .aad-success-case-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:10px;}
      .aad-success-case-list article{border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;padding:10px;min-width:0;}
      .aad-success-case-list b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .aad-success-case-list span{display:block;font-size:11px;line-height:1.4;font-weight:760;color:rgba(0,0,0,.55);}
      .aad-success-case-list em{display:inline-flex;margin-top:7px;border-radius:999px;background:rgba(52,199,89,.1);color:#208a3a;padding:4px 7px;font-style:normal;font-size:10px;font-weight:950;}
      .aad-empty-inline{border:1px dashed rgba(255,140,0,.22);border-radius:12px;background:rgba(255,140,0,.035);padding:10px;font-size:11px;font-weight:800;color:rgba(0,0,0,.48);}
      .aad-inline-error{margin-top:9px;border:1px solid rgba(255,59,48,.22);border-radius:10px;background:rgba(255,59,48,.08);color:#b42318;font-size:11px;font-weight:850;line-height:1.4;padding:9px;}
      .aad-benchmark-picker-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;margin-bottom:8px;}
      .aad-benchmark-picker-row button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:11px 13px;cursor:pointer;white-space:nowrap;}
      .aad-creative-report-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin:10px 0 12px;padding:12px;border:1px solid rgba(255,140,0,.18);border-radius:13px;background:rgba(255,140,0,.045);}
      .aad-creative-report-row b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:3px;}
      .aad-creative-report-row span{display:block;font-size:11px;line-height:1.45;font-weight:800;color:rgba(0,0,0,.54);}
      .aad-creative-report-row button{border:none;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:11px;font-weight:1000;padding:10px 12px;cursor:pointer;white-space:nowrap;}
      .aad-creative-report-row button:disabled{opacity:.58;cursor:not-allowed;}
      .aad-benchmark-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.62);backdrop-filter:blur(12px);}
      .aad-benchmark-modal{width:min(1320px,calc(100vw - 44px));max-height:calc(100vh - 44px);display:grid;grid-template-rows:auto auto auto minmax(0,1fr);overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 34px 90px rgba(0,0,0,.34);border:1px solid rgba(255,255,255,.32);}
      .aad-benchmark-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.06);background:linear-gradient(135deg,rgba(255,140,0,.13),rgba(255,255,255,.96));}
      .aad-benchmark-head b{display:block;font-size:11px;font-weight:1000;color:#ff6b00;letter-spacing:.06em;margin-bottom:4px;}
      .aad-benchmark-head h3{margin:0;font-size:24px;line-height:1.18;font-weight:1000;color:#1c1c1e;}
      .aad-benchmark-head span{display:block;max-width:900px;margin-top:6px;font-size:12px;line-height:1.45;font-weight:800;color:rgba(0,0,0,.54);}
      .aad-benchmark-head button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:10px 13px;cursor:pointer;}
      .aad-benchmark-direct{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.06);background:rgba(255,140,0,.035);}
      .aad-benchmark-direct label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;}
      .aad-benchmark-direct input{width:100%;border:1px solid rgba(255,140,0,.18);border-radius:11px;background:#fff;padding:11px 12px;font-size:13px;font-weight:820;outline:none;}
      .aad-benchmark-direct button{align-self:end;border:none;border-radius:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:1000;padding:12px 14px;cursor:pointer;white-space:nowrap;}
      .aad-benchmark-tabs{display:flex;gap:7px;overflow-x:auto;padding:12px 16px;border-bottom:1px solid rgba(0,0,0,.06);}
      .aad-benchmark-tabs button{border:1px solid rgba(0,0,0,.08);border-radius:999px;background:#fff;color:#1c1c1e;font-size:11px;font-weight:950;padding:7px 10px;cursor:pointer;white-space:nowrap;}
      .aad-benchmark-tabs button.active{border-color:rgba(255,140,0,.38);background:rgba(255,140,0,.1);color:#ff6b00;}
      .aad-benchmark-list{overflow:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;}
      .aad-benchmark-list article{border:1px solid rgba(0,0,0,.06);border-radius:14px;background:linear-gradient(180deg,#fff,rgba(255,250,244,.86));padding:12px;min-width:0;box-shadow:0 8px 18px rgba(0,0,0,.035);}
      .aad-benchmark-list article>div:first-child{min-height:48px;}
      .aad-benchmark-list b{display:block;font-size:13px;line-height:1.3;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-benchmark-list span{display:block;font-size:10px;font-weight:900;color:rgba(0,0,0,.46);}
      .aad-benchmark-list p{min-height:52px;margin:9px 0;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.58);}
      .aad-benchmark-list em{display:inline-flex;border-radius:999px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.14);color:#ff6b00;font-style:normal;font-size:10px;font-weight:950;padding:5px 7px;}
      .aad-benchmark-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px;}
      .aad-benchmark-actions a,.aad-benchmark-actions button{display:flex;align-items:center;justify-content:center;min-height:32px;border:none;border-radius:9px;background:#1c1c1e;color:#fff;text-decoration:none;font-size:10px;font-weight:1000;cursor:pointer;text-align:center;}
      .aad-benchmark-actions button:nth-child(2){background:#fff;color:#1c1c1e;border:1px solid rgba(0,0,0,.08);}
      .aad-benchmark-actions button:disabled{opacity:.42;cursor:not-allowed;}
      .aad-brief-substeps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:0 0 14px;}
      .aad-brief-substeps button{position:relative;min-height:82px;border:1px solid rgba(0,0,0,.07);border-radius:14px;background:#fff;padding:12px;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.035);}
      .aad-brief-substeps button:after{content:'';position:absolute;left:52px;right:-12px;top:25px;height:2px;background:rgba(255,140,0,.18);}
      .aad-brief-substeps button:last-child:after{display:none;}
      .aad-brief-substeps strong{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:28px;border-radius:999px;background:rgba(255,140,0,.1);color:#ff6b00;font-size:11px;font-weight:1000;margin-bottom:8px;padding:0 8px;}
      .aad-brief-substeps b{display:block;font-size:13px;line-height:1.25;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-brief-substeps span{display:block;font-size:11px;line-height:1.35;font-weight:760;color:rgba(0,0,0,.5);}
      .aad-brief-substeps button.done{background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.2);}
      .aad-brief-substeps button.done strong{background:#34c759;color:#fff;}
      .aad-brief-substeps button.active{border-color:#1c1c1e;box-shadow:0 0 0 3px rgba(0,0,0,.08),0 14px 30px rgba(0,0,0,.1);}
      .aad-brief-substeps button.active strong{background:#1c1c1e;color:#fff;}
      .aad-step-one-layout{display:grid;grid-template-columns:minmax(260px,1.05fr) minmax(260px,1fr) minmax(300px,.95fr);gap:12px;margin-bottom:14px;align-items:start;min-width:0;max-width:100%;overflow:hidden;}
      .aad-step-one-layout.substep{grid-template-columns:repeat(auto-fit,minmax(320px,1fr));align-items:stretch;}
      .aad-step-one-layout.substep .inactive{display:none;}
      .aad-step-one-layout.substep .active{grid-column:auto;grid-row:auto;}
      .aad-intent-panel{grid-column:1;grid-row:1 / span 2;}
      .aad-brief-source-panel{grid-column:2;grid-row:1;}
      .aad-brief-engine-panel{grid-column:2;grid-row:2;}
      .aad-brief-control-panel{grid-column:3;grid-row:1 / span 2;}
      .aad-intent-panel,.aad-brief-source-panel,.aad-brief-engine-panel,.aad-brief-control-panel{min-width:0;max-width:100%;overflow:hidden;border:1px solid rgba(255,140,0,.14);border-radius:16px;background:#fff;padding:14px;box-shadow:0 8px 20px rgba(0,0,0,.035);}
      .aad-brief-control-panel .aad-mode-picker,.aad-brief-control-panel .aad-aspect-picker{padding:10px;border-radius:13px;margin-top:10px;}
      .aad-brief-control-panel .aad-mode-title,.aad-brief-control-panel .aad-aspect-title{margin-bottom:8px;}
      .aad-brief-control-panel .aad-mode-title span,.aad-brief-control-panel .aad-aspect-title span{display:none;}
      .aad-brief-control-panel .aad-mode-options,.aad-brief-control-panel .aad-aspect-options{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;}
      .aad-brief-control-panel .aad-mode-card{min-height:92px;padding:9px;border-radius:12px;}
      .aad-brief-control-panel .aad-mode-card strong{min-width:34px;height:26px;margin-bottom:6px;font-size:10px;}
      .aad-brief-control-panel .aad-mode-card b{font-size:12px;line-height:1.25;margin-bottom:4px;}
      .aad-brief-control-panel .aad-mode-card span{font-size:10px;line-height:1.25;margin-bottom:0;}
      .aad-brief-control-panel .aad-mode-card em{display:none;}
      .aad-brief-control-panel .aad-aspect-card{min-height:92px;padding:9px;border-radius:12px;}
      .aad-brief-control-panel .aad-aspect-card strong{font-size:18px;}
      .aad-brief-control-panel .aad-aspect-card b{font-size:12px;margin-top:4px;}
      .aad-brief-control-panel .aad-aspect-card span{font-size:9px;padding:4px 6px;}
      .aad-brief-control-panel .aad-aspect-card em{display:none;}
      .aad-section-label{display:inline-flex;border-radius:999px;background:rgba(255,140,0,.1);color:#ff6b00;padding:6px 9px;font-size:10px;font-weight:1000;margin-bottom:10px;}
      .aad-intent-panel h4{margin:0 0 6px;font-size:17px;font-weight:1000;color:#1c1c1e;}
      .aad-intent-panel p{margin:0 0 10px;font-size:12px;line-height:1.5;font-weight:760;color:rgba(0,0,0,.52);}
      .aad-intent-panel textarea{width:100%;min-height:128px;border:1px solid rgba(255,140,0,.18);border-radius:12px;background:rgba(255,140,0,.035);padding:11px;font-size:13px;line-height:1.5;resize:vertical;outline:none;}
      .aad-material-field{display:block;margin-top:10px;font-size:12px;font-weight:950;color:#1c1c1e;}
      .aad-material-field textarea{margin-top:6px;min-height:98px;background:#fffaf4;border-color:rgba(255,140,0,.22);}
      .aad-intent-panel button{width:100%;margin-top:10px;border:none;border-radius:11px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:1000;padding:11px 14px;cursor:pointer;}
      .aad-compact-field{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .aad-compact-field label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;}
      .aad-compact-field select{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px 11px;font-size:12px;font-weight:850;color:#1c1c1e;outline:none;}
      .aad-profile-snapshot{border:1px solid rgba(0,0,0,.06);border-radius:12px;background:rgba(0,0,0,.025);padding:11px;margin-top:10px;}
      .aad-profile-snapshot b{display:block;font-size:13px;font-weight:1000;color:#1c1c1e;margin-bottom:5px;}
      .aad-profile-snapshot span{display:block;font-size:12px;line-height:1.48;font-weight:760;color:rgba(0,0,0,.55);}
      .aad-ref-counts{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px;}
      .aad-ref-counts span{border-radius:999px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.14);color:#ff6b00;padding:6px 8px;font-size:11px;font-weight:950;}
      .aad-brand-ref-preview{margin-top:10px;border:1px solid rgba(255,140,0,.14);border-radius:12px;background:rgba(255,140,0,.045);padding:10px;}
      .aad-brand-ref-preview>div:first-child b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-brand-ref-preview>div:first-child span{display:block;font-size:11px;line-height:1.4;font-weight:760;color:rgba(0,0,0,.55);}
      .aad-brand-ref-strip{display:flex;gap:8px;overflow-x:auto;margin-top:9px;padding-bottom:2px;}
      .aad-brand-ref-strip figure{width:72px;flex:0 0 auto;margin:0;}
      .aad-brand-ref-strip img{display:block;width:72px;height:72px;border-radius:12px;border:1px solid rgba(0,0,0,.08);background:#fff;object-fit:cover;}
      .aad-brand-ref-strip figcaption{margin-top:4px;font-size:10px;font-weight:900;color:rgba(0,0,0,.52);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .aad-brand-ref-empty{margin-top:10px;border:1px dashed rgba(255,140,0,.24);border-radius:12px;background:rgba(255,140,0,.035);padding:10px;font-size:11px;line-height:1.45;font-weight:780;color:rgba(0,0,0,.5);}
      .aad-persona-model-wrap{margin-top:10px;display:flex;flex-direction:column;gap:9px;min-width:0;}
      .aad-persona-model-card{display:grid;grid-template-columns:minmax(0,1fr) auto 56px;gap:10px;align-items:center;border:1px solid rgba(0,122,255,.16);border-radius:12px;background:rgba(0,122,255,.045);padding:10px;min-width:0;}
      .aad-persona-model-card.pending{grid-template-columns:minmax(0,1fr) auto;}
      .aad-persona-model-card.ready{border-color:rgba(52,199,89,.22);background:rgba(52,199,89,.055);}
      .aad-persona-model-card b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-persona-model-card span{display:block;font-size:11px;line-height:1.38;font-weight:760;color:rgba(0,0,0,.55);}
      .aad-persona-model-card button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:11px;font-weight:1000;padding:9px 10px;cursor:pointer;white-space:nowrap;}
      .aad-persona-model-card button:disabled{opacity:.42;cursor:not-allowed;}
      .aad-persona-model-card img{width:56px;height:68px;border-radius:10px;border:1px solid rgba(0,0,0,.08);object-fit:cover;background:#fff;}
      .aad-persona-model-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
      .aad-persona-option-summary{border:1px solid rgba(255,140,0,.12);border-radius:12px;background:rgba(255,140,0,.035);padding:10px;min-width:0;}
      .aad-persona-option-summary b{display:block;font-size:12px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-persona-option-summary span{display:block;font-size:11px;line-height:1.45;font-weight:780;color:rgba(0,0,0,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .aad-model-auto-note{border:1px solid rgba(255,149,0,.22);border-radius:12px;background:linear-gradient(135deg,rgba(255,149,0,.12),rgba(255,255,255,.9));padding:10px;min-width:0;}
      .aad-model-auto-note b{display:block;font-size:12px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-model-auto-note span{display:block;font-size:11px;line-height:1.45;font-weight:820;color:rgba(0,0,0,.58);}
      .aad-persona-options-panel{border:1px solid rgba(255,140,0,.14);border-radius:14px;background:rgba(255,140,0,.04);padding:12px;min-width:0;}
      .aad-persona-options-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-persona-options-head b{display:block;font-size:14px;font-weight:1000;color:#1c1c1e;}
      .aad-persona-options-head span{display:block;font-size:11px;line-height:1.4;font-weight:760;color:rgba(0,0,0,.48);}
      .aad-persona-options-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;}
      .aad-persona-options-grid label,.aad-persona-description-box{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;}
      .aad-persona-options-grid select,.aad-persona-options-grid input,.aad-persona-description-box textarea,.aad-model-edit-options select{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px 11px;font-size:12px;font-weight:820;color:#1c1c1e;outline:none;}
      .aad-persona-options-grid label span{display:block;font-size:10px;line-height:1.35;font-weight:760;color:rgba(0,0,0,.45);margin-top:-1px;}
      .aad-persona-description-box{margin-top:10px;}
      .aad-persona-rule-editor{border:1px solid rgba(255,140,0,.14);border-radius:12px;background:rgba(255,140,0,.035);padding:10px;min-width:0;}
      .aad-persona-rule-editor summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;}
      .aad-persona-rule-editor summary b{font-size:12px;font-weight:1000;color:#1c1c1e;}
      .aad-persona-rule-editor summary span{font-size:10px;line-height:1.35;font-weight:800;color:rgba(0,0,0,.46);text-align:right;}
      .aad-persona-rule-editor textarea{width:100%;margin-top:9px;border:1px solid rgba(255,140,0,.18);border-radius:10px;background:#fff;padding:10px;font-size:11px;line-height:1.5;font-weight:760;color:#1c1c1e;resize:vertical;outline:none;}
      .aad-model-library{border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;padding:9px;min-width:0;}
      .aad-model-library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}
      .aad-model-library-head b{font-size:12px;font-weight:1000;color:#1c1c1e;}
      .aad-model-library-head button,.aad-model-library-item button{border:none;border-radius:9px;background:#1c1c1e;color:#fff;font-size:10px;font-weight:1000;padding:7px 8px;cursor:pointer;white-space:nowrap;}
      .aad-model-library-head button:disabled,.aad-model-library-item button:disabled{opacity:.45;cursor:not-allowed;}
      .aad-model-library-item{display:grid;grid-template-columns:42px minmax(0,1fr) auto auto auto;gap:7px;align-items:center;border:1px solid rgba(0,0,0,.06);border-radius:11px;padding:7px;margin-top:7px;background:rgba(0,0,0,.015);min-width:0;cursor:zoom-in;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease;}
      .aad-model-library-item:hover{border-color:rgba(255,140,0,.34);box-shadow:0 10px 22px rgba(255,140,0,.08);transform:translateY(-1px);}
      .aad-model-library-item.selected{border-color:rgba(255,140,0,.32);background:rgba(255,140,0,.055);}
      .aad-model-library-item img,.aad-model-no-image{width:42px;height:50px;border-radius:9px;border:1px solid rgba(0,0,0,.08);object-fit:cover;background:rgba(0,0,0,.03);}
      .aad-model-no-image{display:flex;align-items:center;justify-content:center;text-align:center;font-size:9px;font-weight:900;color:rgba(0,0,0,.38);line-height:1.2;}
      .aad-model-library-item div{min-width:0;}
      .aad-model-library-item b{display:block;font-size:11px;font-weight:1000;color:#1c1c1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .aad-model-library-item span{display:block;font-size:10px;font-weight:760;color:rgba(0,0,0,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .aad-model-library-item button.danger{background:rgba(255,59,48,.12);color:#c5281f;}
      .aad-model-library-item.editing{grid-template-columns:1fr;align-items:stretch;background:rgba(255,140,0,.04);cursor:default;}
      .aad-model-library-item.editing:hover{transform:none;box-shadow:none;}
      .aad-model-library-item.editing input,.aad-model-library-item.editing textarea{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:9px;background:#fff;padding:8px;font-size:11px;font-weight:780;outline:none;resize:vertical;}
      .aad-model-library-item.editing div{display:flex;gap:6px;justify-content:flex-end;}
      .aad-model-library-item.editing .aad-model-edit-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;}
      .aad-model-library-empty{border:1px dashed rgba(0,0,0,.1);border-radius:11px;padding:10px;font-size:11px;line-height:1.4;font-weight:780;color:rgba(0,0,0,.48);text-align:center;}
      .aad-model-builder-backdrop{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.58);backdrop-filter:blur(12px);}
      .aad-model-builder-modal{width:min(1160px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:hidden;border-radius:18px;background:#fff;border:1px solid rgba(255,255,255,.3);box-shadow:0 34px 90px rgba(0,0,0,.34);display:grid;grid-template-rows:auto minmax(0,1fr) auto;}
      .aad-model-builder-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.06);background:linear-gradient(135deg,rgba(255,140,0,.1),rgba(255,255,255,.96));}
      .aad-model-builder-head b{display:block;font-size:11px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-model-builder-head h3{margin:0;font-size:24px;line-height:1.18;font-weight:1000;color:#1c1c1e;}
      .aad-model-builder-head span{display:block;margin-top:5px;font-size:12px;font-weight:820;color:rgba(0,0,0,.52);}
      .aad-model-builder-head button,.aad-model-builder-actions button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:10px 13px;cursor:pointer;white-space:nowrap;}
      .aad-model-builder-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;padding:16px;min-height:0;overflow:auto;}
      .aad-model-builder-main{display:flex;flex-direction:column;gap:12px;min-width:0;}
      .aad-model-builder-preview{display:flex;flex-direction:column;gap:10px;border:1px solid rgba(0,0,0,.06);border-radius:15px;background:rgba(0,0,0,.025);padding:12px;min-width:0;}
      .aad-model-builder-preview b{font-size:12px;font-weight:1000;color:#1c1c1e;}
      .aad-model-builder-preview img,.aad-model-builder-preview div{width:100%;aspect-ratio:3/4;border-radius:14px;border:1px solid rgba(0,0,0,.08);background:#fff;object-fit:cover;}
      .aad-model-builder-preview div{display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;font-size:12px;line-height:1.45;font-weight:820;color:rgba(0,0,0,.45);background:rgba(255,140,0,.04);}
      .aad-model-builder-preview span{white-space:pre-wrap;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.56);}
      .aad-model-builder-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;padding:14px 16px;border-top:1px solid rgba(0,0,0,.06);background:rgba(0,0,0,.018);}
      .aad-model-builder-actions button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-model-builder-actions button:disabled{opacity:.45;cursor:not-allowed;}
      .aad-model-preview-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.58);backdrop-filter:blur(12px);}
      .aad-model-preview-modal{width:min(1040px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:hidden;border-radius:18px;background:#fff;border:1px solid rgba(255,255,255,.32);box-shadow:0 34px 90px rgba(0,0,0,.34);display:grid;grid-template-rows:auto minmax(0,1fr);}
      .aad-model-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.06);background:linear-gradient(135deg,rgba(255,140,0,.1),rgba(255,255,255,.96));}
      .aad-model-preview-head b{display:block;font-size:11px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-model-preview-head h3{margin:0;font-size:24px;line-height:1.18;font-weight:1000;color:#1c1c1e;}
      .aad-model-preview-head span{display:block;margin-top:5px;font-size:12px;font-weight:820;color:rgba(0,0,0,.52);}
      .aad-model-preview-head button,.aad-model-preview-actions button{border:none;border-radius:11px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:1000;padding:10px 13px;cursor:pointer;white-space:nowrap;}
      .aad-model-preview-body{display:grid;grid-template-columns:minmax(280px,.82fr) minmax(300px,1fr);gap:0;min-height:0;overflow:auto;}
      .aad-model-preview-image{display:flex;align-items:center;justify-content:center;min-height:520px;background:radial-gradient(circle at 30% 10%,rgba(255,140,0,.18),transparent 32%),linear-gradient(135deg,#0b1020,#171717);padding:18px;}
      .aad-model-preview-image img{display:block;max-width:100%;max-height:72vh;border-radius:16px;object-fit:contain;box-shadow:0 24px 64px rgba(0,0,0,.34);background:#fff;}
      .aad-model-preview-image div{display:flex;align-items:center;justify-content:center;width:min(360px,100%);aspect-ratio:3/4;border:1px dashed rgba(255,255,255,.28);border-radius:16px;color:rgba(255,255,255,.7);font-size:13px;font-weight:1000;}
      .aad-model-preview-info{padding:18px 20px;overflow:auto;}
      .aad-model-preview-info dl{display:grid;gap:10px;margin:0;}
      .aad-model-preview-info dl div{border:1px solid rgba(0,0,0,.06);border-radius:13px;background:rgba(0,0,0,.025);padding:12px;}
      .aad-model-preview-info dt{font-size:11px;font-weight:1000;color:#ff6b00;margin-bottom:6px;}
      .aad-model-preview-info dd{margin:0;font-size:13px;line-height:1.55;font-weight:780;color:rgba(0,0,0,.66);white-space:pre-wrap;word-break:break-word;}
      .aad-model-preview-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px;}
      .aad-model-preview-actions button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-model-preview-actions button.danger{background:rgba(255,59,48,.12);color:#c5281f;}
      .aad-engine-rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px;}
      .aad-engine-rules div{min-height:76px;border:1px solid rgba(0,0,0,.06);border-radius:12px;background:rgba(255,140,0,.045);padding:10px;}
      .aad-engine-rules b{display:block;font-size:12px;font-weight:1000;color:#ff6b00;margin-bottom:5px;}
      .aad-engine-rules span{display:block;font-size:11px;line-height:1.38;font-weight:780;color:rgba(0,0,0,.58);}
      .aad-brief-engine-panel label,.aad-mini-grid label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;margin-top:8px;}
      .aad-brief-engine-panel select,.aad-brief-engine-panel input,.aad-mini-grid select{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px 11px;font-size:12px;font-weight:850;color:#1c1c1e;outline:none;}
      .aad-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
      .aad-step-one-details{display:flex;flex-direction:column;gap:10px;margin-top:12px;}
      .aad-step-one-details details{border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff;padding:12px;}
      .aad-step-one-details summary{display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;}
      .aad-step-one-details summary b{font-size:13px;font-weight:1000;color:#1c1c1e;}
      .aad-step-one-details summary span{font-size:12px;font-weight:760;color:rgba(0,0,0,.5);text-align:right;}
      .aad-profile-full{max-height:260px;overflow:auto;white-space:pre-wrap;border:1px solid rgba(0,0,0,.06);border-radius:12px;background:rgba(0,0,0,.025);padding:12px;margin-top:12px;font-size:12px;line-height:1.55;font-weight:720;color:rgba(0,0,0,.58);}
      .aad-selected-brief{border:1px solid rgba(255,140,0,.18);border-radius:16px;background:rgba(255,140,0,.06);padding:14px;margin:12px 0;}
      .aad-selected-brief>div:first-child b{display:block;font-size:18px;font-weight:1000;color:#1c1c1e;margin-bottom:5px;}
      .aad-selected-brief>div:first-child span{font-size:12px;line-height:1.5;font-weight:760;color:rgba(0,0,0,.58);}
      .aad-selected-brief-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin-top:12px;}
      .aad-selected-brief-grid section{border:1px solid rgba(255,140,0,.14);border-radius:12px;background:#fff;padding:10px;min-height:104px;}
      .aad-selected-brief-grid strong{display:block;font-size:11px;font-weight:1000;color:#ff6b00;margin-bottom:5px;}
      .aad-selected-brief-grid p{margin:0;font-size:11px;line-height:1.42;font-weight:760;color:rgba(0,0,0,.58);}
      .aad-aspect-picker{grid-column:1/-1;border:1px solid rgba(255,140,0,.14);border-radius:14px;background:rgba(255,140,0,.045);padding:12px;}
      .aad-aspect-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;}
      .aad-aspect-title b{font-size:12px;font-weight:950;color:#1c1c1e;}
      .aad-aspect-title span{font-size:11px;font-weight:820;color:rgba(0,0,0,.5);text-align:right;}
      .aad-aspect-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}
      .aad-aspect-card{position:relative;min-height:132px;border:1px solid rgba(0,0,0,.08);border-radius:13px;background:#fff;padding:12px;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.035);}
      .aad-aspect-card.active{border-color:rgba(255,140,0,.72);box-shadow:0 0 0 3px rgba(255,140,0,.12),0 12px 24px rgba(255,140,0,.12);}
      .aad-aspect-card strong{display:block;font-size:22px;font-weight:1000;letter-spacing:0;color:#ff8c00;line-height:1;}
      .aad-aspect-card b{display:block;font-size:13px;font-weight:950;color:#1c1c1e;margin-top:5px;}
      .aad-aspect-card span{display:inline-flex;margin-top:6px;border-radius:999px;background:rgba(0,0,0,.05);padding:5px 7px;font-size:10px;font-weight:900;color:rgba(0,0,0,.58);}
      .aad-aspect-card em{display:block;margin-top:8px;font-style:normal;font-size:11px;line-height:1.4;font-weight:760;color:rgba(0,0,0,.54);}
      .aad-select-with-guide>div{display:grid;grid-template-columns:minmax(220px,.55fr) minmax(240px,1fr);gap:10px;align-items:stretch;}
      .aad-select-with-guide span{display:flex;align-items:center;border:1px solid rgba(255,140,0,.14);border-radius:10px;background:rgba(255,140,0,.06);padding:9px 11px;font-size:12px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.66);}
      .aad-wide{margin-top:10px;}
      .aad-busy{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,.16),rgba(255,255,255,.92));border:1px solid rgba(255,140,0,.24);box-shadow:0 14px 34px rgba(255,140,0,.12);font-size:18px;font-weight:1000;color:#ff6b00;text-align:center;}
      .aad-busy .spinner{width:28px;height:28px;border-width:3px;}
      .aad-empty,.aad-media-empty{padding:18px;border:1px dashed rgba(0,0,0,0.12);border-radius:12px;color:rgba(0,0,0,0.4);font-size:12px;text-align:center;background:rgba(255,255,255,0.5);}
      .aad-step-blocked{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;}
      .aad-step-blocked span{font-weight:850;}
      .aad-step-blocked button{border:none;border-radius:10px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;padding:10px 14px;cursor:pointer;}
      .aad-scenes{display:flex;flex-direction:column;gap:12px;}
      .aad-scene-index{font-size:10px;font-weight:950;color:#ff8c00;letter-spacing:.08em;margin-bottom:3px;}
      .aad-scene-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
      .aad-scene-actions button:last-child{background:#1c1c1e;}
      .aad-cut-badge{display:inline-flex;align-items:center;border-radius:999px;background:rgba(0,122,255,.08);border:1px solid rgba(0,122,255,.14);color:#007aff;font-size:11px;font-weight:950;padding:8px 12px;white-space:nowrap;}
      .aad-scene-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:12px 0;}
      .aad-field{padding:10px;border-radius:12px;background:rgba(0,0,0,0.025);border:1px solid rgba(0,0,0,0.04);}
      .aad-field.wide{grid-column:1/-1;}
      .aad-field b{display:block;font-size:10px;color:rgba(0,0,0,0.42);margin-bottom:4px;}
      .aad-field span{font-size:12px;line-height:1.55;color:#1c1c1e;font-weight:650;}
      .aad-media-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.75fr);gap:12px;}
      .aad-mini-title{font-size:11px;font-weight:900;color:#1c1c1e;margin-bottom:7px;}
      .aad-image-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;}
      .aad-image-choice{width:120px;height:150px;border:2px solid transparent;border-radius:12px;padding:0;overflow:hidden;background:#f2f2f7;cursor:pointer;flex:0 0 auto;}
      .aad-image-choice.active{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,0.12);}
      .aad-image-choice img{width:100%;height:100%;object-fit:cover;display:block;}
      .aad-video{width:100%;max-height:240px;border-radius:12px;background:#000;}
      .aad-sample-video{position:relative;width:100%;min-height:210px;border-radius:12px;overflow:hidden;background:#020617;border:1px solid rgba(255,140,0,.16);}
      .aad-sample-video img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.86;}
      .aad-sample-video span{position:absolute;left:12px;bottom:12px;right:12px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.46);backdrop-filter:blur(12px);color:#fff;font-size:11px;font-weight:900;text-align:center;}
      .aad-cut-list{display:flex;flex-direction:column;gap:10px;margin-top:14px;}
      .aad-cut{border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.66);padding:12px;}
      .aad-cut-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-cut-head span{display:block;font-size:10px;font-weight:950;color:#ff8c00;letter-spacing:.08em;margin-bottom:3px;}
      .aad-cut-head b{display:block;font-size:14px;font-weight:950;color:#1c1c1e;}
      .aad-cut-editor{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px;}
      .aad-cut-editor label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:950;color:rgba(0,0,0,.62);}
      .aad-cut-editor label.wide{grid-column:1/-1;}
      .aad-cut-editor input,.aad-cut-editor textarea{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:9px 10px;font-size:12px;line-height:1.45;outline:none;resize:vertical;}
      .aad-audio-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
      .aad-audio-grid audio{width:100%;}
      .aad-audio-edit-panel,.aad-slogan-editor{border:1px solid rgba(255,140,0,.14);border-radius:15px;background:rgba(255,140,0,.045);padding:13px;margin-top:12px;min-width:0;}
      .aad-edit-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;}
      .aad-edit-panel-head b{display:block;font-size:14px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-edit-panel-head span{display:block;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.52);}
      .aad-edit-panel-head em{flex:0 0 auto;font-style:normal;border-radius:999px;background:rgba(255,140,0,.12);border:1px solid rgba(255,140,0,.18);color:#ff6b00;padding:6px 8px;font-size:10px;font-weight:1000;}
      .aad-audio-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
      .aad-audio-edit-grid label,.aad-final-brand-field{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;}
      .aad-audio-edit-grid label.wide{grid-column:1/-1;}
      .aad-audio-edit-grid select,.aad-audio-edit-grid input,.aad-audio-edit-grid textarea,.aad-final-brand-field input,.aad-slogan-cut-grid input{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px;font-size:12px;line-height:1.45;font-weight:760;color:#1c1c1e;outline:none;resize:vertical;}
      .aad-audio-status{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px;}
      .aad-audio-status span{border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.06);padding:6px 8px;font-size:10px;font-weight:950;color:rgba(0,0,0,.56);}
      .aad-slogan-cut-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px;}
      .aad-slogan-cut-grid article{border:1px solid rgba(0,0,0,.06);border-radius:12px;background:#fff;padding:9px;display:grid;gap:7px;}
      .aad-slogan-cut-grid article.active{border-color:rgba(255,140,0,.5);box-shadow:0 0 0 3px rgba(255,140,0,.1);}
      .aad-slogan-cut-grid article>div{display:flex;justify-content:space-between;gap:8px;align-items:center;}
      .aad-slogan-cut-grid b{font-size:11px;font-weight:1000;color:#1c1c1e;}
      .aad-slogan-cut-grid span{font-size:10px;font-weight:900;color:#ff6b00;text-align:right;}
      .aad-log-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;}
      .aad-log-head .aad-mini-title span{display:inline-flex;margin-left:6px;border-radius:999px;background:rgba(255,140,0,.08);color:#ff6b00;padding:3px 7px;font-size:10px;font-weight:1000;}
      .aad-log-head>div:last-child{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;}
      .aad-log-head button,.aad-log-history button,.aad-log-pager button{border:none;border-radius:9px;background:#1c1c1e;color:#fff;font-size:11px;font-weight:950;padding:7px 9px;cursor:pointer;white-space:nowrap;}
      .aad-log-line{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(0,0,0,0.04);font-size:12px;color:#1c1c1e;}
      .aad-log-line span{flex:0 0 auto;color:rgba(0,0,0,0.35);font-size:11px;}
      .aad-log-line p{margin:0;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.45;font-weight:760;}
      .aad-log-line.error{color:#ff3b30;}
      .aad-log-pager{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;padding-top:8px;}
      .aad-log-pager button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-log-history{margin-top:12px;border:1px solid rgba(255,140,0,.14);border-radius:13px;background:rgba(255,140,0,.045);padding:10px;display:flex;flex-direction:column;gap:8px;}
      .aad-log-history>div{display:flex;align-items:center;justify-content:space-between;gap:8px;}
      .aad-log-history>div b{font-size:12px;font-weight:1000;color:#1c1c1e;}
      .aad-log-history article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;border:1px solid rgba(0,0,0,.055);border-radius:11px;background:#fff;padding:9px;}
      .aad-log-history strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:950;color:#1c1c1e;}
      .aad-log-history em{display:block;margin-top:2px;font-style:normal;font-size:10px;font-weight:820;color:rgba(0,0,0,.45);}
      .aad-hidden-field{display:none!important;}
      .aad-pack-panel{margin:4px 0 16px;}
      .aad-pack-panel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:10px;}
      .aad-pack-panel-head>div{display:flex;flex-direction:column;gap:3px;align-items:flex-start;}
      .aad-pack-panel-head b{font-size:14px;font-weight:1000;color:#1c1c1e;}
      .aad-pack-panel-head span{max-width:760px;font-size:12px;font-weight:800;line-height:1.45;color:rgba(0,0,0,.48);}
      .aad-pack-panel-head button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:10px 13px;cursor:pointer;white-space:nowrap;}
      .aad-pack-empty{border:1px solid rgba(255,140,0,.2);border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,.08),rgba(255,255,255,.92));padding:14px;box-shadow:0 10px 24px rgba(255,140,0,.06);}
      .aad-pack-loading{border:1px dashed rgba(255,140,0,.28);border-radius:13px;background:#fff;padding:16px;color:#1c1c1e;}
      .aad-pack-loading b{display:block;font-size:14px;font-weight:1000;color:#ff6b00;margin-bottom:4px;}
      .aad-pack-loading span{display:block;font-size:12px;line-height:1.5;font-weight:850;color:rgba(0,0,0,.56);}
      .aad-pack-error{margin-top:10px;border:1px solid rgba(255,59,48,.16);border-radius:12px;background:rgba(255,59,48,.06);padding:10px 12px;color:#ff3b30;font-size:12px;font-weight:900;}
      .aad-creative-rule-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;}
      .aad-creative-rule-grid div{border:1px solid rgba(255,140,0,.14);border-radius:12px;background:#fff;padding:12px;min-height:86px;}
      .aad-creative-rule-grid b{display:block;font-size:13px;font-weight:1000;color:#ff8c00;margin-bottom:5px;}
      .aad-creative-rule-grid span{display:block;font-size:12px;line-height:1.45;font-weight:780;color:rgba(0,0,0,.58);}
      .aad-pack-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:4px 0 16px;}
      .aad-pack-card{position:relative;min-height:116px;border:1px solid rgba(0,0,0,.07);border-radius:14px;background:#fff;padding:14px;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.045);}
      .aad-pack-card strong{display:block;font-size:15px;line-height:1.25;font-weight:1000;color:#1c1c1e;margin-bottom:8px;}
      .aad-pack-card span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;line-height:1.48;font-weight:760;color:rgba(0,0,0,.52);padding-right:4px;}
      .aad-pack-card em{display:inline-flex;margin-top:12px;border-radius:999px;background:rgba(255,140,0,.09);color:#ff6b00;border:1px solid rgba(255,140,0,.16);font-size:11px;font-style:normal;font-weight:950;padding:6px 9px;}
      .aad-pack-card.active{border-color:rgba(255,140,0,.55);box-shadow:0 0 0 3px rgba(255,140,0,.12),0 15px 30px rgba(255,140,0,.12);}
      .aad-pack-card.active:after{content:'선택됨';position:absolute;top:10px;right:10px;border-radius:999px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:10px;font-weight:1000;padding:5px 8px;}
      .aad-beginner-panel{margin:0 0 14px;border:1px solid rgba(255,140,0,.18);border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,.1),rgba(255,255,255,.94));padding:14px;box-shadow:0 10px 24px rgba(255,140,0,.06);}
      .aad-beginner-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;}
      .aad-beginner-head span{display:block;font-size:10px;font-weight:950;color:#ff8c00;letter-spacing:.08em;margin-bottom:4px;}
      .aad-beginner-head b{display:block;font-size:16px;font-weight:1000;color:#1c1c1e;letter-spacing:0;}
      .aad-beginner-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
      .aad-beginner-actions button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:9px 12px;cursor:pointer;white-space:nowrap;}
      .aad-beginner-actions button:last-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-director-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:10px;}
      .aad-director-grid div,.aad-image-blueprint div{border:1px solid rgba(0,0,0,.055);border-radius:12px;background:rgba(255,255,255,.72);padding:10px;}
      .aad-director-grid b,.aad-image-blueprint strong{display:block;font-size:11px;font-weight:950;color:#ff6b00;margin-bottom:4px;}
      .aad-director-grid span,.aad-image-blueprint span{display:block;font-size:11px;line-height:1.45;color:rgba(0,0,0,.56);font-weight:740;}
      .aad-image-blueprint{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;}
      .aad-image-blueprint b{display:block;font-size:12px;line-height:1.35;font-weight:950;color:#1c1c1e;margin-bottom:4px;}
      .aad-global-ideas,.aad-model-picker{margin:0 0 14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:rgba(255,255,255,.76);padding:14px;box-shadow:0 8px 20px rgba(0,0,0,.035);}
      .aad-global-head,.aad-model-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-model-head>div{display:flex;flex-direction:column;align-items:flex-start;}
      .aad-global-head b,.aad-model-head b{font-size:13px;font-weight:1000;color:#1c1c1e;}
      .aad-global-head span,.aad-model-head span{font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.5);text-align:right;}
      .aad-global-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;}
      .aad-global-grid div{border:1px solid rgba(255,140,0,.12);border-radius:12px;background:rgba(255,140,0,.045);padding:10px;}
      .aad-global-grid b{display:block;font-size:11px;font-weight:950;color:#ff6b00;margin-bottom:4px;}
      .aad-global-grid span{display:block;font-size:11px;line-height:1.45;font-weight:740;color:rgba(0,0,0,.56);}
      .aad-model-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px;}
      .aad-model-grid label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;}
      .aad-model-grid select{width:100%;border:1px solid rgba(255,140,0,.18);border-radius:10px;background:#fff;padding:10px 11px;font-size:12px;font-weight:850;color:#1c1c1e;outline:none;}
      .aad-model-actions,.aad-sound-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;}
      .aad-model-actions button,.aad-sound-actions button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:10px 12px;cursor:pointer;white-space:nowrap;}
      .aad-model-actions button:first-child,.aad-sound-actions button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-model-actions button:disabled,.aad-sound-actions button:disabled{opacity:.42;cursor:not-allowed;}
      .aad-model-actions span{margin-left:auto;font-size:11px;font-weight:850;color:rgba(0,0,0,.5);}
      .aad-model-step-note{border:1px solid rgba(0,122,255,.16);border-radius:12px;background:rgba(0,122,255,.06);padding:10px;margin-bottom:9px;}
      .aad-model-step-note b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-model-step-note span{display:block;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.55);}
      .aad-mode-picker{border:1px solid rgba(255,140,0,.16);border-radius:16px;background:linear-gradient(135deg,rgba(255,140,0,.06),rgba(255,255,255,.9));padding:14px;}
      .aad-mode-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;}
      .aad-mode-title b{font-size:13px;font-weight:1000;color:#1c1c1e;}
      .aad-mode-title span{max-width:680px;font-size:11px;line-height:1.45;font-weight:760;color:rgba(0,0,0,.54);text-align:right;}
      .aad-mode-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;}
      .aad-mode-card{position:relative;min-height:154px;border:1px solid rgba(0,0,0,.06);border-radius:14px;background:#fff;padding:12px;text-align:left;cursor:pointer;overflow:hidden;box-shadow:0 8px 18px rgba(0,0,0,.035);}
      .aad-mode-card:before{content:'';position:absolute;inset:auto -20% -46% -20%;height:88px;background:radial-gradient(circle,rgba(255,140,0,.2),transparent 66%);opacity:.35;}
      .aad-mode-card strong{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:30px;border-radius:999px;background:#1c1c1e;color:#fff;font-size:11px;font-weight:1000;margin-bottom:10px;}
      .aad-mode-card b{position:relative;display:block;font-size:14px;font-weight:1000;color:#1c1c1e;margin-bottom:5px;}
      .aad-mode-card span{position:relative;display:block;font-size:11px;font-weight:900;color:#ff6b00;margin-bottom:8px;}
      .aad-mode-card em{position:relative;display:block;font-style:normal;font-size:11px;line-height:1.45;font-weight:720;color:rgba(0,0,0,.58);}
      .aad-mode-card.active{border-color:rgba(255,140,0,.7);box-shadow:0 0 0 3px rgba(255,140,0,.12),0 12px 24px rgba(255,140,0,.12);}
      .aad-mode-card.active strong{background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#111827;}
      .aad-reference-uploaders{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:14px;}
      .aad-ref-upload-card{border:1px solid rgba(0,0,0,.06);border-radius:14px;background:rgba(255,255,255,.78);padding:12px;}
      .aad-ref-upload-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;margin-bottom:10px;}
      .aad-ref-upload-head b{display:block;font-size:12px;font-weight:1000;color:#1c1c1e;margin-bottom:4px;}
      .aad-ref-upload-head span{display:block;font-size:11px;line-height:1.45;font-weight:720;color:rgba(0,0,0,.5);}
      .aad-ref-upload-head button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:11px;font-weight:950;padding:8px 10px;cursor:pointer;white-space:nowrap;}
      .aad-ref-upload-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;min-height:82px;}
      .aad-ref-thumb{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#f5f5f7;border:1px solid rgba(0,0,0,.06);}
      .aad-ref-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
      .aad-ref-thumb button{position:absolute;right:4px;top:4px;border:none;border-radius:999px;background:rgba(255,59,48,.92);color:#fff;font-size:10px;font-weight:900;padding:4px 6px;cursor:pointer;}
      .aad-ref-empty{grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:82px;border:1px dashed rgba(0,0,0,.12);border-radius:10px;background:rgba(0,0,0,.015);font-size:11px;font-weight:760;color:rgba(0,0,0,.42);text-align:center;}
      .aad-simple-start{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:14px;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(255,140,0,.08),rgba(255,255,255,.92));border:1px solid rgba(255,140,0,.16);}
      .aad-simple-start b{display:block;font-size:13px;font-weight:950;color:#1c1c1e;margin-bottom:3px;}
      .aad-simple-start span{display:block;font-size:12px;color:rgba(0,0,0,.48);}
      .aad-simple-start button{border:none;border-radius:12px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:10px 15px;cursor:pointer;white-space:nowrap;}
      .aad-modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:24px;}
      .aad-storyboard-modal{width:min(1280px,calc(100vw - 48px));height:calc(100vh - 48px);max-height:820px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.72fr);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.28);}
      .aad-storyboard-left{display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:#080b12;color:#fff;min-width:0;min-height:0;overflow:hidden;}
      .aad-storyboard-topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);}
      .aad-storyboard-topbar b{display:block;font-size:15px;font-weight:950;}
      .aad-storyboard-topbar span{display:block;font-size:11px;color:rgba(255,255,255,.52);font-weight:850;margin-top:2px;}
      .aad-storyboard-topbar button,.aad-storyboard-nav button{border:none;border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-weight:950;padding:9px 12px;cursor:pointer;}
      .aad-storyboard-preview{position:relative;min-height:0;height:100%;max-height:100%;display:grid;grid-template-columns:180px minmax(0,1fr);background:#000;overflow:hidden;}
      .aad-storyboard-sequence{overflow-y:auto;background:#0d111b;border-right:1px solid rgba(255,255,255,.08);padding:10px;display:flex;flex-direction:column;gap:8px;}
      .aad-storyboard-sequence button{position:relative;min-height:118px;border:2px solid transparent;border-radius:12px;background:rgba(255,255,255,.08);overflow:hidden;padding:0;cursor:pointer;color:#fff;text-align:left;}
      .aad-storyboard-sequence button.active{border-color:#ff8c00;box-shadow:0 0 0 3px rgba(255,140,0,.18);}
      .aad-storyboard-sequence img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.78;}
      .aad-storyboard-sequence img+.aad-storyboard-shot-card{display:none;}
      .aad-storyboard-sequence span{position:absolute;left:8px;top:8px;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#ff8c00;color:#111827;font-size:11px;font-weight:1000;}
      .aad-storyboard-sequence b{position:absolute;left:8px;right:8px;bottom:8px;padding:6px 7px;border-radius:8px;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);font-size:10px;font-weight:950;color:#fff;text-align:center;}
      .aad-storyboard-stage{position:relative;min-width:0;min-height:0;height:100%;max-height:100%;background:#000;overflow:hidden;display:grid;place-items:center;align-self:stretch;}
      .aad-storyboard-media{position:relative;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;background:transparent;display:block;z-index:2;}
      .aad-storyboard-media-wrap{position:absolute;inset:0;display:grid;place-items:center;background-color:#000;background-repeat:no-repeat;background-position:center center;background-size:contain;z-index:1;padding:0;box-sizing:border-box;overflow:hidden;}
      .aad-storyboard-media-wrap.has-image{background-color:#000;}
      .aad-storyboard-media-wrap.has-image>img.aad-storyboard-media{display:none;}
      .aad-storyboard-media-wrap.has-image .aad-storyboard-media,.aad-storyboard-media-wrap.has-video .aad-storyboard-media{width:100%;height:100%;object-fit:contain;}
      .aad-storyboard-video-player{position:absolute;z-index:4;right:18px;bottom:18px;width:min(280px,36%);max-height:32%;border-radius:12px;background:#000;box-shadow:0 18px 42px rgba(0,0,0,.38);border:1px solid rgba(255,255,255,.22);}
      .aad-storyboard-media-wrap .aad-storyboard-shot-card{position:absolute;inset:0;z-index:1;display:flex;}
      .aad-storyboard-media-wrap.loaded .aad-storyboard-shot-card{display:none;}
      .aad-storyboard-media-wrap.broken .aad-storyboard-media{display:none;}
      .aad-storyboard-media-wrap.broken .aad-storyboard-shot-card{display:flex;}
      .aad-storyboard-stage>.aad-storyboard-shot-card{position:absolute;inset:0;z-index:1;}
      .aad-storyboard-shot-card{width:100%;height:100%;min-height:260px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;padding:42px 42px 140px;background:radial-gradient(circle at 20% 18%,rgba(255,140,0,.32),transparent 34%),radial-gradient(circle at 82% 12%,rgba(0,122,255,.24),transparent 36%),linear-gradient(135deg,#090d18,#17111f 50%,#241103);color:#fff;}
      .aad-storyboard-shot-card i{font-style:normal;font-size:12px;font-weight:1000;color:#ffd59a;letter-spacing:.08em;}
      .aad-storyboard-shot-card strong{display:block;max-width:760px;font-size:34px;line-height:1.08;font-weight:1000;letter-spacing:0;color:#fff;}
      .aad-storyboard-shot-card span{display:inline-flex;width:max-content;border-radius:999px;background:rgba(255,140,0,.18);border:1px solid rgba(255,140,0,.36);padding:7px 10px;font-size:12px;font-weight:950;color:#ffd59a;}
      .aad-storyboard-shot-card p{max-width:760px;margin:0;font-size:14px;line-height:1.65;font-weight:760;color:rgba(255,255,255,.7);}
      .aad-storyboard-shot-card button{border:none;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:13px;font-weight:1000;padding:12px 16px;cursor:pointer;box-shadow:0 14px 28px rgba(255,107,0,.24);}
      .aad-storyboard-shot-card.compact{position:absolute;inset:0;min-height:0;padding:10px;gap:5px;justify-content:flex-end;background:linear-gradient(135deg,#121827,#2b1608);}
      .aad-storyboard-shot-card.compact i{font-size:9px;}
      .aad-storyboard-shot-card.compact strong{font-size:11px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .aad-storyboard-shot-card.compact span{position:relative;left:auto;right:auto;top:auto;bottom:auto;width:auto;height:auto;padding:3px 6px;font-size:9px;}
      .aad-storyboard-shot-card.compact p,.aad-storyboard-shot-card.compact button{display:none;}
      .aad-storyboard-copy{display:none;}
      .aad-storyboard-copy span{display:block;font-size:11px;font-weight:950;color:#ffbf73;letter-spacing:.08em;margin-bottom:6px;}
      .aad-storyboard-copy b{display:block;font-size:26px;line-height:1.08;font-weight:1000;color:#fff;letter-spacing:0;}
      .aad-storyboard-nav{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid rgba(255,255,255,.08);}
      .aad-storyboard-nav button:nth-child(2){background:#ff8c00;color:#111827;}
      .aad-storyboard-nav button:nth-child(3){background:#007aff;}
      .aad-storyboard-nav button:disabled{opacity:.38;cursor:not-allowed;}
      .aad-storyboard-right{min-height:0;max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:18px;background:#f5f5f7;border-left:1px solid rgba(0,0,0,.06);}
      .aad-storyboard-edit-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px;}
      .aad-storyboard-edit-actions button{border:none;border-radius:10px;background:#1c1c1e;color:#fff;font-size:12px;font-weight:950;padding:10px 12px;cursor:pointer;}
      .aad-storyboard-edit-actions button:first-child{background:linear-gradient(135deg,#ff8c00,#ff6b00);}
      .aad-storyboard-edit-actions button:nth-child(3){background:#007aff;}
      .aad-storyboard-edit-actions button:disabled{opacity:.42;cursor:not-allowed;}
      .aad-storyboard-right label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:950;color:#1c1c1e;margin-bottom:10px;}
      .aad-storyboard-right input,.aad-storyboard-right textarea{width:100%;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:10px;font-size:12px;line-height:1.45;outline:none;resize:vertical;}
      .aad-storyboard-note{margin-top:12px;border-radius:12px;border:1px solid rgba(255,140,0,.16);background:rgba(255,140,0,.07);padding:12px;}
      .aad-storyboard-note b{display:block;font-size:12px;font-weight:950;color:#1c1c1e;margin-bottom:5px;}
      .aad-storyboard-note span{display:block;font-size:12px;line-height:1.5;color:rgba(0,0,0,.58);font-weight:720;}
      @media(max-width:1240px){.aad-step-one-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.aad-intent-panel{grid-column:1;grid-row:1 / span 2}.aad-brief-source-panel{grid-column:2;grid-row:1}.aad-brief-engine-panel{grid-column:2;grid-row:2}.aad-brief-control-panel{grid-column:1 / -1;grid-row:auto}.aad-brief-control-panel .aad-mode-options,.aad-brief-control-panel .aad-aspect-options{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:900px){body.aad-animation-active .main{width:calc(100vw - 260px);padding-left:24px;padding-right:24px}#page-animation-ad{width:calc(100vw - 308px)}.aad-hero,.aad-media-row,.aad-audio-grid,.aad-select-with-guide>div,.aad-storyboard-modal,.aad-storyboard-preview,.aad-aspect-options,.aad-mode-options,.aad-step-one-layout,.aad-brief-substeps,.aad-engine-rules,.aad-selected-brief-grid,.aad-success-learning-grid,.aad-model-preview-body,.aad-model-builder-body,.aad-persona-options-grid,.aad-model-library-item.editing .aad-model-edit-options,.aad-model-settings-bar,.aad-benchmark-picker-row,.aad-creative-report-row,.aad-benchmark-direct{grid-template-columns:1fr}.aad-model-settings-bar button{min-height:42px}.aad-intent-panel,.aad-brief-source-panel,.aad-brief-engine-panel,.aad-brief-control-panel{grid-column:auto;grid-row:auto}.aad-aspect-title,.aad-beginner-head,.aad-global-head,.aad-model-head,.aad-flow-head,.aad-mode-title,.aad-pacing-note,.aad-step-one-head,.aad-success-learning-head,.aad-step-one-details summary,.aad-model-preview-head,.aad-model-builder-head,.aad-benchmark-head,.aad-persona-rule-editor summary{flex-direction:column;align-items:flex-start}.aad-step-one-head{overflow:visible}.aad-step-one-actions{min-width:0;flex:1 1 auto}.aad-aspect-title span,.aad-global-head span,.aad-model-head span,.aad-mode-title span,.aad-pacing-note span,.aad-step-one-details summary span,.aad-persona-rule-editor summary span{text-align:left}.aad-flow-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.aad-flow-head button,.aad-step-one-actions,.aad-step-one-actions button,.aad-success-learning-head button,.aad-benchmark-picker-row button,.aad-creative-report-row button,.aad-benchmark-direct button,.aad-model-preview-head button,.aad-model-builder-head button{width:100%;}.aad-beginner-actions{width:100%;justify-content:stretch}.aad-beginner-actions button{flex:1 1 160px}.aad-board-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.aad-board-cut{min-height:174px}.aad-storyboard-sequence{max-height:160px;flex-direction:row;overflow-x:auto;overflow-y:hidden;border-right:none;border-bottom:1px solid rgba(255,255,255,.08)}.aad-storyboard-sequence button{min-width:96px;min-height:128px}.aad-storyboard-modal{height:calc(100vh - 28px);width:calc(100vw - 28px)}.aad-benchmark-backdrop,.aad-model-preview-backdrop,.aad-model-builder-backdrop{padding:12px}.aad-benchmark-modal,.aad-model-preview-modal,.aad-model-builder-modal{width:calc(100vw - 24px);max-height:calc(100vh - 24px)}.aad-model-preview-image{min-height:320px}.aad-model-builder-preview{display:none}.aad-card-head,.aad-scene-head,.aad-cut-head,.aad-detail-editor summary{flex-direction:column;align-items:stretch}.aad-history-item{grid-template-columns:64px minmax(0,1fr)}.aad-history-row-actions{grid-column:1/-1;justify-content:stretch}.aad-primary,.aad-action-group button,.aad-scene-actions button,.aad-history-actions button,.aad-history-row-actions button{width:100%;}.aad-status-grid{grid-template-columns:1fr}}
      @media(max-width:760px){body.aad-animation-active .main{width:100%;margin-left:0;padding-left:16px;padding-right:16px}#page-animation-ad{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function generatePlan() {
    if (state.busy) return;
    syncModelPicker();
    state.generating.storyboard = true;
    setBusy('작동중 · 빠른 콘티 초안 제작중');
    addLog('빠른 콘티 초안 제작중 · 선택한 AI 컨셉을 영상 후보 컷으로 즉시 쪼갭니다.', 'info', { persist: false });
    try {
      const data = buildInstantStoryboardDraft();
      state.scenes = Array.isArray(data.scenes) ? data.scenes : [];
      state.storyboardMeta = normalizeStoryboardMeta(data.storyboard_meta || data.meta || {});
      state.scenes.forEach(function (scene, index) { ensureMicroCuts(scene, index); });
      applyCameraMotionDiversity();
      state.images = {};
      state.videos = {};
      state.finalUrl = '';
      state.activeStep = 3;
      invalidateQuality();
      addLog('빠른 콘티 초안 완료 · ' + state.scenes.length + '개 씬 / ' + allCutRefs().length + '개 편집 후보 · 모델 대기 없이 즉시 생성', 'success', { persist: false });
      scheduleHistoryAutosave(8000);
    } catch (err) {
      addLog('콘티 생성 실패: ' + err.message, 'error');
      alert('콘티 생성 실패: ' + err.message);
    } finally {
      state.generating.storyboard = false;
      setBusy('');
    }
  }

  function setInput(id, value) {
    state.form[id] = String(value == null ? '' : value);
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
  }

  function applyPreset(type) {
    const packMap = {
      launch: 'launch-premium',
      sales: 'sales-direct',
      brand: 'brand-film',
      app: 'app-service',
      event: 'event-burst',
    };
    applyBriefPack(packMap[type] || 'launch-premium');
  }

  async function quickStoryboard() {
    if (!field('aad-source', '')) applyPreset('launch');
    await generatePlan();
  }

  function loadTestSample() {
    syncForm();
    applyBriefPack('tech-trust');
    setInput('aad-duration', '30');
    setInput('aad-scene-count', '4');
    state.storyboardMeta = sampleStoryboardMeta();
    state.scenes = sampleScenes();
    state.images = {};
    state.videos = {};
    state.narration = null;
    state.bgm = null;
    state.finalJob = null;
    state.finalUrl = '';
    state.activeStep = 3;
    videoCutRefs().forEach(function (ref) {
      const visualUrl = sampleVisualUrl(ref.sceneIndex, ref.cutIndex);
      state.images[ref.key] = [{ url: visualUrl, detail: '테스트 기준 이미지', selected: true, mock: true }];
    });
    videoCutRefs().forEach(function (ref) {
      const visualUrl = sampleVisualUrl(ref.sceneIndex, ref.cutIndex);
      state.videos[ref.key] = { mock: true, visualUrl: visualUrl, detail: '테스트용 HyperFrames 배경 클립', model: 'hyperframes-test' };
    });
    invalidateQuality();
    addLog('테스트 광고 샘플 4씬 / 콘티 ' + allCutRefs().length + '컷 / 선별 이미지·영상 ' + videoCutRefs().length + '컷을 만들었습니다.', 'success');
    scheduleHistoryAutosave();
    saveHistoryCheckpoint('테스트 샘플');
  }

  async function generateSceneImage(index, cutIndex, options) {
    const opts = options || {};
    const scene = state.scenes[index];
    const normalizedCutIndex = cutIndex == null ? 0 : cutIndex;
    const cut = scene ? ensureMicroCuts(scene, index)[normalizedCutIndex] : null;
    const key = cutKey(index, normalizedCutIndex);
    const busyLabel = '씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 기준 이미지를 생성하는 중...';
    if (!scene) return false;
    if (!beginGenerationAction('image', key, busyLabel, { allowBusy: opts.allowBusy })) return false;
    syncModelPicker();
    const imageModel = field('aad-image-model', state.modelSettings.image_model || 'openai/gpt-image-2-developer/text-to-image');
    const imageEngine = imageModel === 'codex-cli' ? 'codex' : field('aad-image-engine', 'gemini');
    const provider = imageEngine === 'codex' ? 'codex' : 'gemini';
    try {
      const data = await apiJSON('/api/hyperframes/generate-bg-image', {
        topic: field('aad-topic', ''),
        objective: field('aad-objective', ''),
        tone: field('aad-tone', ''),
        profile_context: currentProfileContext(),
        aspect: field('aad-aspect', '9:16'),
        aspect_spec: currentAspectSpec(),
        provider: provider,
        model: provider === 'codex' ? 'codex-cli' : imageModel,
        style: currentAnimationStyle(),
        vfx: cutVFXPreset(cut),
        scene_title: (scene.title || '') + ' / ' + (cut?.title || ''),
        scene_body: [scene.body, cut?.action, cut?.copy].filter(Boolean).join('\n'),
        narration: scene.narration || '',
        prompt: buildSceneImagePrompt(scene, index, cut, normalizedCutIndex),
        reference_images: allReferenceImages(),
        product_reference_images: referenceImageGroups().product,
        brand_reference_images: referenceImageGroups().brand,
        persona_reference_images: referenceImageGroups().persona,
        scene_index: (index * MIN_MICRO_CUTS) + normalizedCutIndex + 1,
        duration: Math.max(3, microCutDuration()),
      });
      if (!state.images[key]) state.images[key] = [];
      state.images[key].forEach(function (item) { item.selected = false; });
      state.images[key].push({ url: data.url, detail: data.detail || '', selected: true, mock: false });
      if (state.videos[key]) {
        delete state.videos[key];
        addLog('씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 이미지가 바뀌어 기존 영상 결과를 초기화했습니다.', 'info');
      }
      invalidateQuality();
      addLog('씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 이미지 생성 완료 · ' + (provider === 'codex' ? 'Codex CLI' : 'Gemini'), 'success');
      scheduleHistoryAutosave();
      await saveHistoryCheckpoint('컷 이미지');
      return true;
    } catch (err) {
      addLog('씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 이미지 실패: ' + err.message, 'error');
      return false;
    } finally {
      endGenerationAction('image', key, { keepBusy: opts.keepBusy });
    }
  }

  async function generateAllImages() {
    if (!state.scenes.length) { alert('먼저 콘티를 생성하세요.'); return; }
    const refs = allCutRefs();
    addLog('전체 콘티 이미지 ' + refs.length + '개를 생성합니다. 비용과 시간이 많이 들 수 있습니다.', 'info');
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!hasRealSceneImage(ref.key)) await generateSceneImage(ref.sceneIndex, ref.cutIndex);
    }
  }

  async function generateSelectedImages(force) {
    if (!state.scenes.length) { alert('먼저 콘티를 생성하세요.'); return; }
    if (!beginGenerationAction('bulk-images', force ? 'selected-regenerate' : 'selected', force ? '선별 컷 이미지를 재생성하는 중...' : '선별 컷 이미지를 생성하는 중...')) return;
    const refs = videoCutRefs();
    state.activeStep = 4;
    addLog('실제 영상화 대상 ' + refs.length + '개 컷의 기준 이미지만 ' + (force ? '재생성' : '우선 생성') + '합니다.', 'info');
    try {
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i];
        if (force || !hasRealSceneImage(ref.key)) await generateSceneImage(ref.sceneIndex, ref.cutIndex, { allowBusy: true, keepBusy: true });
      }
      const ready = refs.filter(function (ref) { return hasRealSceneImage(ref.key); }).length;
      if (refs.length && ready >= refs.length) {
        state.activeStep = 5;
        addLog('선별 이미지 ' + ready + '/' + refs.length + '개 완료 · 5단계 영상화로 이동합니다.', 'success');
      }
    } finally {
      endGenerationAction('bulk-images', force ? 'selected-regenerate' : 'selected');
    }
  }

  async function generateSceneVideo(index, cutIndex, options) {
    const opts = options || {};
    const scene = state.scenes[index];
    const normalizedCutIndex = cutIndex == null ? 0 : cutIndex;
    const cut = scene ? ensureMicroCuts(scene, index)[normalizedCutIndex] : null;
    const key = cutKey(index, normalizedCutIndex);
    const image = selectedSceneImage(index, normalizedCutIndex);
    const busyLabel = '씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷을 선택한 영상 모델로 영상화하는 중...';
    if (!scene || !image) return false;
    if (!beginGenerationAction('video', key, busyLabel, { allowBusy: opts.allowBusy })) return false;
    const videoModel = currentVideoModel();
    try {
      const data = await apiJSON('/api/hyperframes/generate-image-video', {
        topic: field('aad-topic', ''),
        objective: field('aad-objective', ''),
        tone: field('aad-tone', ''),
        profile_context: currentProfileContext(),
        aspect: field('aad-aspect', '9:16'),
        aspect_spec: currentAspectSpec(),
        model: videoModel,
        style: currentAnimationStyle(),
        vfx: cutVFXPreset(cut),
        image_url: mediaUrl(image),
        scene_name: (scene.title || ('scene-' + (index + 1))) + '-cut-' + (normalizedCutIndex + 1),
        prompt: limitModelPrompt(buildSceneVideoPrompt(scene, index, cut, normalizedCutIndex), 2400),
        duration: videoClipDuration(),
        reference_images: allReferenceImages().slice(0, 8),
        product_reference_images: referenceImageGroups().product.slice(0, 4),
        brand_reference_images: referenceImageGroups().brand.slice(0, 4),
        persona_reference_images: referenceImageGroups().persona.slice(0, 4),
        lip_sync_enabled: false,
      });
      state.videos[key] = {
        url: data.url,
        detail: data.detail || '',
        model: data.model || videoModel,
        duration: Number(data.duration || data.actual_duration || data.target_duration || 0) || videoClipDuration(),
        hasNativeAudio: data.has_audio !== false,
        hasNativeVFX: true,
      };
      invalidateQuality();
      addLog('씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 영상 모델 생성 완료', 'success');
      scheduleHistoryAutosave();
      await saveHistoryCheckpoint('컷 영상');
      return true;
    } catch (err) {
      addLog('씬 ' + (index + 1) + '-' + (normalizedCutIndex + 1) + ' 컷 영상 모델 실패: ' + err.message, 'error');
      return false;
    } finally {
      endGenerationAction('video', key, { keepBusy: opts.keepBusy });
    }
  }

  async function generateAllVideos(force) {
    if (!state.scenes.length) { alert('먼저 콘티를 생성하세요.'); return; }
    if (!beginGenerationAction('bulk-videos', force ? 'selected-regenerate' : 'selected', force ? '선별 컷 영상 옵션을 재적용하는 중...' : '선별 컷 영상을 생성하는 중...')) return;
    const refs = videoCutRefs();
    state.activeStep = 5;
    syncModelPicker();
    addLog('실제 영상화 대상 ' + refs.length + '개 컷만 ' + (force ? '선택 영상 모델로 다시 생성' : '생성') + '합니다. 필요 없는 콘티 후보는 이미지 없이 편집 후보로만 유지됩니다.', 'info');
    try {
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i];
        if (!hasRealSceneImage(ref.key)) await generateSceneImage(ref.sceneIndex, ref.cutIndex, { allowBusy: true, keepBusy: true });
        if (force || !hasRealSceneVideo(ref.key)) await generateSceneVideo(ref.sceneIndex, ref.cutIndex, { allowBusy: true, keepBusy: true });
      }
      state.activeStep = 6;
    } finally {
      endGenerationAction('bulk-videos', force ? 'selected-regenerate' : 'selected');
    }
  }

  async function reapplySelectedVideoModel() {
    if (state.busy) return;
    syncModelPicker();
    addLog('선택한 영상 모델을 선별 컷에 재적용합니다: ' + modelLabel(videoModelOptions(), currentVideoModel()), 'info');
    await generateAllVideos(true);
  }

  function buildFinalHtml() {
    const aspect = currentAspectSpec();
    const width = aspect.value === '16:9' ? 1920 : 1080;
    const height = aspect.value === '9:16' ? 1920 : 1080;
    const refs = videoCutRefs();
    let start = 0;
    const videoClips = [];
    const audioClips = [];
    const overlayClips = [];
    const overlayAnimations = [];
    const vfxClips = [];
    const vfxAnimations = [];
    refs.forEach(function (ref, index) {
      const video = state.videos[ref.key];
      if (!video || (!video.url && !video.mock)) return;
      const dur = finalClipDuration(ref);
      const sceneId = 'aad-copy-' + (ref.sceneIndex + 1) + '-' + (ref.cutIndex + 1);
      const overlayScene = Object.assign({}, ref.scene, {
        title: overlaySloganText(ref, index, refs.length),
        body: ref.cut.action || ref.scene.body,
        role: 'CUT ' + (ref.sceneIndex + 1) + '-' + (ref.cutIndex + 1),
        emphasis: [ref.cut.sound_cue, ref.scene.edit_beat].filter(Boolean),
        sloganMotion: ref.cut.slogan_motion || ref.scene.slogan_motion || ref.cut.vfx_cue || ref.scene.edit_beat || '',
      });
      if (video.mock) {
        videoClips.push(buildMockClip(video, ref, index, start, dur, sceneId));
        overlayAnimations.push(buildMockClipAnimation(sceneId, start, dur));
      } else {
        videoClips.push('<video id="aad-scene-' + (ref.sceneIndex + 1) + '-' + (ref.cutIndex + 1) + '" class="clip" data-start="' + start.toFixed(2) + '" data-duration="' + dur + '" data-track-index="0" src="' + esc(video.url) + '" muted playsinline preload="auto"></video>');
        audioClips.push('<audio id="aad-scene-audio-' + (ref.sceneIndex + 1) + '-' + (ref.cutIndex + 1) + '" data-start="' + start.toFixed(2) + '" data-duration="' + dur + '" data-track-index="1" src="' + esc(video.url) + '" data-volume="0.82"></audio>');
      }
      if (video.hasNativeVFX === false) {
        const cutVFX = cutVFXPreset(ref.cut);
        vfxClips.push(buildVFXLayer(index, start, dur, sceneId, cutVFX));
        vfxAnimations.push(buildVFXAnimation(sceneId, start, dur, cutVFX));
      }
      const overlayHtml = buildCopyOverlay(overlayScene, index, start, dur, sceneId, refs.length);
      if (overlayHtml) {
        overlayClips.push(overlayHtml);
        overlayAnimations.push(buildOverlayAnimation(sceneId, start, dur, overlayHtml.indexOf('aad-slogan-layer') >= 0 ? 'slogan' : 'brand', index));
      }
      start += dur;
    });
    const duration = Math.max(selectedDuration(), Math.ceil(start * 100) / 100);
    if (state.bgm && state.bgm.url) {
      audioClips.push('<audio id="aad-bgm" data-start="0" data-duration="' + duration + '" data-track-index="2" src="' + esc(state.bgm.url) + '" data-volume="0.48"></audio>');
    }
    if (state.narration && state.narration.url) {
      audioClips.push('<audio id="aad-narration" data-start="0.2" data-duration="' + Math.max(1, duration - 0.4) + '" data-track-index="4" src="' + esc(state.narration.url) + '" data-volume="0.95"></audio>');
    }
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<style>' + buildFinalCss(aspect.value, brandAccentColor()) + '</style>' +
      '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>' +
      '</head><body><div data-composition-id="aad-final" data-width="' + width + '" data-height="' + height + '" data-duration="' + duration + '">' +
      videoClips.join('\n') + audioClips.join('\n') + vfxClips.join('\n') + overlayClips.join('\n') +
      '</div><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});' + vfxAnimations.join('') + overlayAnimations.join('') + 'window.__timelines["aad-final"]=tl;</script></body></html>';
  }

  function compactCopy(value, fallback, maxLength) {
    const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trim() + '…';
  }

  function cleanSloganText(value, fallback) {
    let text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
    text = text.replace(/^(핵심\s*표어|표어|카피|copy|slogan)\s*[:：-]\s*/i, '').trim();
    text = text.replace(/[.!?。！？]+$/g, '').trim();
    return compactCopy(text, fallback || '멈추는 순간', 18);
  }

  function isGenericSloganText(value) {
    const text = String(value || '').replace(/\s+/g, '').trim();
    if (!text) return true;
    return [
      '멈추는순간', '이상한징후', '디테일반전', '리액션피크', '해결연결', '감정훅',
      '가장완벽한순간', '시간의지배자', '마지막', '브랜드기억', 'CTA전환',
    ].some(function (token) { return text.indexOf(token) >= 0; });
  }

  function sceneAlignedSlogan(ref) {
    const sources = [
      ref.cut?.action,
      ref.cut?.field_coupling_reason,
      ref.cut?.shot_diversity_reason,
      ref.cut?.copy,
      ref.scene?.body,
      ref.scene?.title,
    ].filter(Boolean).join(' / ');
    const parts = sources
      .replace(/[A-Za-z][A-Za-z0-9_\-:/., ]{18,}/g, ' ')
      .split(/[\/\n\r.!?。！？,，;；]+/)
      .map(function (part) {
        return part
          .replace(/^(광고\s*아닌\s*척|영화적\s*긴장|초숏형|컷|장면|주인공|제품|브랜드)\s*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(function (part) { return /[가-힣]/.test(part) && part.length >= 4; });
    const picked = parts.find(function (part) {
      return !/(프롬프트|카메라|렌즈|영상|이미지|설명|텍스트|금지)/.test(part);
    }) || parts[0] || creativeFieldSloganFallback(ref) || ref.cut?.title || ref.scene?.title || '멈추는 순간';
    return cleanSloganText(picked, '멈추는 순간');
  }

  function overlaySloganText(ref, index, totalCount) {
    const isLast = index === (totalCount || 0) - 1;
    if (isLast) return finalBrandNameValue();
    const manual = ref.cut?.overlay_slogan || ref.scene?.overlay_slogan || '';
    if (manual && !isGenericSloganText(manual)) return cleanSloganText(manual, sceneAlignedSlogan(ref));
    return cleanSloganText(
      sceneAlignedSlogan(ref),
      creativeFieldSloganFallback(ref) || ref.scene?.title || '멈추는 순간'
    );
  }

  function sloganOverlayIndexes(totalCount) {
    const total = Number(totalCount || 0);
    if (total < 4) return [];
    const raw = total <= 8
      ? [1, Math.floor(total * 0.55)]
      : [1, Math.floor(total * 0.42), Math.floor(total * 0.7)];
    return Array.from(new Set(raw.map(function (item) {
      return Math.max(1, Math.min(total - 2, item));
    })));
  }

  function shouldShowSloganOverlay(index, totalCount) {
    return sloganOverlayIndexes(totalCount).indexOf(index) >= 0;
  }

  function buildMockClip(video, ref, index, start, duration, sceneId) {
    return `
      <div id="${sceneId}-mock" class="clip aad-mock-clip aad-mock-${(index % 4) + 1}" data-start="${start.toFixed(2)}" data-duration="${duration}" data-track-index="0">
        <img src="${esc(mediaUrl(video) || mediaUrl(selectedSceneImage(ref.sceneIndex, ref.cutIndex)) || '')}" alt="">
        <i></i>
      </div>
    `;
  }

  function buildMockClipAnimation(sceneId, start, duration) {
    const clip = '#' + sceneId + '-mock';
    const image = clip + ' img';
    const glow = clip + ' i';
    return [
      'tl.fromTo("' + image + '",{scale:1.08,y:18},{scale:1.18,y:-18,duration:' + duration.toFixed(2) + ',ease:"none"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + glow + '",{x:"-32%",opacity:.16},{x:"28%",opacity:.46,duration:' + Math.max(0.6, duration * 0.78).toFixed(2) + ',ease:"power2.out"},' + (start + 0.05).toFixed(2) + ');',
    ].join('');
  }

  function buildCopyOverlay(scene, index, start, duration, sceneId, totalCount) {
    const isLast = index === (totalCount || state.scenes.length) - 1;
    if (!isLast && !shouldShowSloganOverlay(index, totalCount)) return '';
    const brand = compactCopy(finalBrandNameValue(), '브랜드', 30);
    const color = overlayTextColor(index, isLast);
    const className = (isLast ? 'aad-brand-layer ' : 'aad-slogan-layer ') + 'aad-overlay-style-' + ((index % 6) + 1);
    if (!isLast) {
      const title = cleanSloganText(scene.title, scene.body || '멈추는 순간');
      return `
      <div id="${sceneId}" class="clip aad-copy-layer ${className}" style="--aad-overlay-color:${color};" data-start="${start.toFixed(2)}" data-duration="${duration}" data-track-index="3">
        <div class="aad-copy-scrim"></div>
        <div class="aad-copy-safe">
          <div class="aad-copy-title">${esc(title)}</div>
        </div>
      </div>
    `;
    }
    return `
      <div id="${sceneId}" class="clip aad-copy-layer ${className}" style="--aad-overlay-color:${color};" data-start="${start.toFixed(2)}" data-duration="${duration}" data-track-index="3">
        <div class="aad-copy-scrim"></div>
        <div class="aad-copy-safe">
          <div class="aad-copy-title">${esc(brand)}</div>
        </div>
      </div>
    `;
  }

  function overlayTextColor(index, isBrand) {
    if (isBrand) return brandAccentColor();
    const colors = ['#ffffff', '#ffd59a', '#7dd3fc', '#f0abfc', '#bbf7d0', '#fde68a'];
    return colors[index % colors.length];
  }

  function buildOverlayAnimation(sceneId, start, duration, kind, index) {
    const safe = '#' + sceneId + ' .aad-copy-safe';
    const title = '#' + sceneId + ' .aad-copy-title';
    const isSlogan = kind === 'slogan';
    const visibleDuration = isSlogan ? Math.min(Math.max(1.15, duration - 0.2), 1.8) : duration;
    const outAt = Math.max(start + visibleDuration - 0.32, start + 0.65);
    if (isSlogan) {
      const variant = index % 6;
      const intro = [
        'tl.from("' + title + '",{scale:.72,opacity:0,filter:"blur(14px)",duration:.36,ease:"back.out(1.9)"},' + start.toFixed(2) + ');',
        'tl.from("' + title + '",{y:56,opacity:0,duration:.34,ease:"power4.out"},' + start.toFixed(2) + ');',
        'tl.from("' + title + '",{x:-72,opacity:0,rotate:-3,duration:.38,ease:"power3.out"},' + start.toFixed(2) + ');',
        'tl.from("' + title + '",{x:72,opacity:0,rotate:3,duration:.38,ease:"power3.out"},' + start.toFixed(2) + ');',
        'tl.from("' + title + '",{letterSpacing:"0.16em",opacity:0,filter:"blur(10px)",duration:.4,ease:"power2.out"},' + start.toFixed(2) + ');',
        'tl.from("' + title + '",{scale:1.28,opacity:0,filter:"blur(20px)",duration:.34,ease:"power3.out"},' + start.toFixed(2) + ');',
      ][variant];
      return [
        'tl.from("' + safe + '",{opacity:0,duration:.12,ease:"power1.out"},' + start.toFixed(2) + ');',
        intro,
        'tl.to("' + title + '",{scale:1.025,duration:.14,ease:"power1.out",yoyo:true,repeat:1},' + (start + 0.32).toFixed(2) + ');',
        'tl.to("' + title + '",{opacity:0,scale:.94,filter:"blur(10px)",duration:.28,ease:"power2.in"},' + outAt.toFixed(2) + ');',
      ].join('');
    }
    return [
      'tl.from("' + title + '",{opacity:0,scale:.86,filter:"blur(16px)",duration:.62,ease:"power3.out"},' + start.toFixed(2) + ');',
      'tl.to("' + title + '",{scale:1.015,duration:.9,ease:"sine.inOut",yoyo:true,repeat:' + Math.max(0, Math.ceil(duration / 1.8) - 1) + '},' + (start + 0.2).toFixed(2) + ');',
      'tl.to("' + title + '",{opacity:0,filter:"blur(12px)",duration:.36,ease:"power2.in"},' + outAt.toFixed(2) + ');',
    ].join('');
  }

  function vfxFamily(preset) {
    const value = (preset || currentVFXPreset()).value;
    if (/(hologram|data|matrix|hud|laser)/.test(value)) return 'tech';
    if (/(particle|spark|gold|magic|confetti|ember)/.test(value)) return 'particle';
    if (/(glitch|chromatic|speed|shockwave)/.test(value)) return 'impact';
    if (/(smoke|fog|light|flare|bokeh|leak)/.test(value)) return 'light';
    if (/(glass|prism|chrome|water|ice)/.test(value)) return 'prism';
    if (/(no-vfx)/.test(value)) return 'clean';
    return 'cinematic';
  }

  function buildVFXLayer(index, start, duration, sceneId, preset) {
    const family = vfxFamily(preset);
    if (family === 'clean') return '';
    const particles = Array.from({ length: 14 }, function (_, itemIndex) {
      const x = (9 + ((index * 17 + itemIndex * 23) % 82)) + '%';
      const y = (8 + ((index * 29 + itemIndex * 19) % 84)) + '%';
      const delay = ((itemIndex % 5) * 0.08).toFixed(2) + 's';
      return '<b style="--x:' + x + ';--y:' + y + ';--d:' + delay + '"></b>';
    }).join('');
    return `
      <div id="${sceneId}-vfx" class="clip aad-vfx-layer aad-vfx-${family}" data-start="${start.toFixed(2)}" data-duration="${duration}" data-track-index="2">
        <i class="aad-vfx-sweep"></i>
        <i class="aad-vfx-ring"></i>
        <i class="aad-vfx-grid"></i>
        <span class="aad-vfx-particles">${particles}</span>
      </div>
    `;
  }

  function buildVFXAnimation(sceneId, start, duration, preset) {
    const family = vfxFamily(preset);
    if (family === 'clean') return '';
    const root = '#' + sceneId + '-vfx';
    const sweep = root + ' .aad-vfx-sweep';
    const ring = root + ' .aad-vfx-ring';
    const grid = root + ' .aad-vfx-grid';
    const particles = root + ' .aad-vfx-particles b';
    const impactScale = family === 'impact' ? 1.22 : 1.08;
    return [
      'tl.fromTo("' + root + '",{opacity:0},{opacity:1,duration:.16,ease:"power1.out"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + sweep + '",{x:"-62%",opacity:0},{x:"138%",opacity:.92,duration:' + Math.max(0.5, duration * 0.72).toFixed(2) + ',ease:"power3.out"},' + (start + 0.04).toFixed(2) + ');',
      'tl.fromTo("' + ring + '",{scale:.38,opacity:0,rotate:-18},{scale:' + impactScale + ',opacity:.72,rotate:12,duration:' + Math.max(0.55, duration * 0.55).toFixed(2) + ',ease:"power2.out"},' + (start + 0.1).toFixed(2) + ');',
      'tl.to("' + ring + '",{scale:' + (impactScale + 0.38).toFixed(2) + ',opacity:0,duration:.42,ease:"power2.in"},' + Math.max(start + duration - 0.48, start + 0.7).toFixed(2) + ');',
      'tl.fromTo("' + grid + '",{opacity:0,scale:1.12},{opacity:.58,scale:1,duration:.42,ease:"power2.out"},' + (start + 0.05).toFixed(2) + ');',
      'tl.to("' + grid + '",{opacity:0,duration:.34,ease:"power1.in"},' + Math.max(start + duration - 0.38, start + 0.8).toFixed(2) + ');',
      'tl.fromTo("' + particles + '",{y:26,scale:.25,opacity:0},{y:-44,scale:1,opacity:.86,stagger:.018,duration:' + Math.max(0.45, duration * 0.46).toFixed(2) + ',ease:"power2.out"},' + (start + 0.12).toFixed(2) + ');',
      'tl.to("' + root + '",{opacity:0,duration:.24,ease:"power1.in"},' + Math.max(start + duration - 0.25, start + 0.9).toFixed(2) + ');',
    ].join('');
  }

  function buildFinalCss(aspectValue, accentColor) {
    const vertical = aspectValue === '9:16';
    const square = aspectValue === '1:1';
    const titleSize = vertical ? '76px' : (square ? '70px' : '86px');
    const bodySize = vertical ? '28px' : (square ? '26px' : '30px');
    const safePadding = vertical ? '104px 78px' : (square ? '92px' : '108px 140px');
    const accent = /^#[0-9a-fA-F]{6}$/.test(accentColor || '') ? accentColor : '#ff8c00';
    return [
      'html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",sans-serif;}',
      '[data-composition-id="aad-final"]{position:relative;width:100%;height:100%;background:#000;overflow:hidden;}',
      'video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}',
      '.aad-mock-clip{position:absolute;inset:0;overflow:hidden;background:#020617;z-index:0;}',
      '.aad-mock-clip img{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;filter:saturate(1.08) contrast(1.06);}',
      '.aad-mock-clip i{position:absolute;inset:-20% auto -20% 8%;width:34%;transform:skewX(-16deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),' + accent + '55,transparent);filter:blur(22px);}',
      '.aad-vfx-layer{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;mix-blend-mode:screen;}',
      '.aad-vfx-layer i{position:absolute;display:block;pointer-events:none;}',
      '.aad-vfx-sweep{inset:-20% auto -20% 0;width:42%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.26),' + accent + '66,transparent);filter:blur(18px);}',
      '.aad-vfx-ring{left:50%;top:50%;width:70vmin;height:70vmin;margin:-35vmin 0 0 -35vmin;border:3px solid rgba(255,255,255,.26);border-radius:50%;box-shadow:0 0 70px ' + accent + '55,inset 0 0 48px rgba(255,255,255,.12);}',
      '.aad-vfx-grid{inset:0;background:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:72px 72px;mask-image:radial-gradient(circle at 50% 50%,#000,transparent 72%);}',
      '.aad-vfx-particles{position:absolute;inset:0;display:block;}',
      '.aad-vfx-particles b{position:absolute;left:var(--x);top:var(--y);width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.88),0 0 34px ' + accent + '77;animation-delay:var(--d);}',
      '.aad-vfx-tech .aad-vfx-sweep{background:linear-gradient(90deg,transparent,rgba(0,122,255,.38),rgba(255,255,255,.22),transparent);}',
      '.aad-vfx-tech .aad-vfx-grid{background-size:54px 54px;opacity:.9;}',
      '.aad-vfx-particle .aad-vfx-ring{border-color:rgba(251,191,36,.32);}',
      '.aad-vfx-impact{mix-blend-mode:screen;filter:contrast(1.12) saturate(1.2);}',
      '.aad-vfx-impact .aad-vfx-sweep{width:62%;filter:blur(8px);background:linear-gradient(90deg,transparent,rgba(255,255,255,.58),rgba(255,59,48,.28),transparent);}',
      '.aad-vfx-prism .aad-vfx-sweep{background:linear-gradient(90deg,transparent,rgba(0,122,255,.2),rgba(255,59,255,.24),rgba(251,191,36,.2),transparent);}',
      '.aad-vfx-light .aad-vfx-grid{opacity:.22;}',
      '.aad-vfx-cinematic .aad-vfx-ring{opacity:.45;}',
      '.aad-copy-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:#fff;z-index:5;}',
      '.aad-copy-scrim{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.18),rgba(0,0,0,.36) 58%,rgba(0,0,0,.5));}',
      '.aad-overlay-style-2 .aad-copy-scrim{background:radial-gradient(circle at 50% 48%,rgba(255,140,0,.14),rgba(0,0,0,.32) 62%,rgba(0,0,0,.52));}',
      '.aad-overlay-style-3 .aad-copy-scrim{background:radial-gradient(circle at 52% 50%,rgba(0,122,255,.13),rgba(0,0,0,.34) 60%,rgba(0,0,0,.54));}',
      '.aad-overlay-style-4 .aad-copy-scrim{background:radial-gradient(circle at 48% 52%,rgba(255,255,255,.12),rgba(0,0,0,.34) 58%,rgba(0,0,0,.56));}',
      '.aad-overlay-style-5 .aad-copy-scrim{background:radial-gradient(circle at 50% 50%,rgba(52,199,89,.12),rgba(0,0,0,.34) 62%,rgba(0,0,0,.54));}',
      '.aad-overlay-style-6 .aad-copy-scrim{background:radial-gradient(circle at 50% 50%,rgba(251,191,36,.12),rgba(0,0,0,.34) 62%,rgba(0,0,0,.54));}',
      '.aad-copy-safe{position:absolute;inset:0;box-sizing:border-box;padding:' + safePadding + ';display:flex;justify-content:center;align-items:center;text-align:center;text-shadow:0 8px 28px rgba(0,0,0,.72),0 0 42px rgba(0,0,0,.58);}',
      '.aad-copy-title{max-width:' + (vertical ? '860px' : '1160px') + ';font-size:' + titleSize + ';line-height:.98;font-weight:1000;letter-spacing:0;color:var(--aad-overlay-color,#fff);}',
      '.aad-slogan-layer{z-index:6;}',
      '.aad-slogan-layer .aad-copy-title{max-width:' + (vertical ? '820px' : '1040px') + ';font-size:' + (vertical ? '86px' : (square ? '80px' : '98px')) + ';line-height:.94;}',
      '.aad-brand-layer .aad-copy-title{font-size:' + (vertical ? '92px' : (square ? '86px' : '108px')) + ';color:var(--aad-overlay-color,' + accent + ');text-shadow:0 8px 30px rgba(0,0,0,.78),0 0 54px ' + accent + '88;}',
    ].join('');
  }

  function runQualityAudit() {
    state.quality = collectQualityAudit();
    const failed = state.quality.items.filter(function (item) { return !item.ok; });
    addLog('완성도 검사 완료: ' + state.quality.score + '점 · ' + (failed.length ? failed.length + '개 보완 필요' : '상용 준비'), failed.length ? 'info' : 'success');
    scheduleHistoryAutosave();
  }

  function finalBrandNameValue() {
    return field('aad-final-brand-name', currentProfileContext()?.brand || field('aad-topic', '브랜드'));
  }

  function invalidateFinalRender(reason) {
    state.finalUrl = '';
    state.finalJob = null;
    invalidateQuality();
    if (reason) addLog(reason + ' 수정값을 반영했습니다. 최종 렌더를 다시 만들면 적용됩니다.', 'info');
    scheduleHistoryAutosave();
  }

  function updateFinalAudioSetting(id, value, target) {
    setInput(id, value);
    if (target === 'bgm' || target === 'all') state.bgm = null;
    if (target === 'narration' || target === 'all') state.narration = null;
    invalidateFinalRender(target === 'bgm' ? '음악' : '목소리/나레이션');
    render();
  }

  function updateFinalTextSetting(id, value) {
    setInput(id, value);
    invalidateFinalRender('표어/브랜드');
    render();
  }

  function updateCutFieldOnly(sceneIndex, cutIndex, fieldName, value) {
    const scene = state.scenes[sceneIndex];
    if (!scene) return;
    const cut = ensureMicroCuts(scene, sceneIndex)[cutIndex];
    if (!cut) return;
    cut[fieldName] = String(value == null ? '' : value);
    invalidateFinalRender('컷 표어');
  }

  function resetFinalAudioAssets() {
    state.bgm = null;
    state.narration = null;
    invalidateFinalRender('음악·목소리');
    render();
  }

  async function runMasterpieceLoop() {
    if (state.busy) return;
    addLog('완벽 루프를 시작합니다. 콘티, 이미지, 영상 API BGM/SFX/VFX, 마지막 브랜드 렌더를 순서대로 채웁니다.', 'info');
    try {
      if (!state.scenes.length) await generatePlan();
      if (!state.scenes.length) {
        runQualityAudit();
        return;
      }
      await generateSelectedImages();
      await generateAllVideos();
      const refs = videoCutRefs();
      const missingVideos = refs.filter(function (ref) { return !state.videos[ref.key]?.url && !state.videos[ref.key]?.mock; });
      if (!missingVideos.length) await renderFinal();
      runQualityAudit();
      if (state.quality && state.quality.score < 96) {
        addLog('완벽 루프 보완 필요: 완성도 ' + state.quality.score + '점입니다. 노란 항목을 먼저 해결하세요.', 'error');
      }
    } catch (err) {
      addLog('완벽 루프 중단: ' + err.message, 'error');
      runQualityAudit();
    }
  }

  function audioSceneTexts(refs) {
    const fieldAudio = creativeFieldAudioDirection();
    return (refs || videoCutRefs()).map(function (ref) {
      return [
        fieldAudio,
        ref.scene?.title,
        ref.cut?.title,
        ref.cut?.action,
        ref.cut?.field_coupling_reason,
        ref.cut?.shot_diversity_reason,
        ref.cut?.sound_cue || ref.scene?.sound_cue,
        ref.cut?.overlay_slogan || ref.scene?.overlay_slogan,
      ].filter(Boolean).join(' / ');
    }).filter(Boolean).slice(0, 12);
  }

  function buildFinalNarrationText(refs) {
    const custom = field('aad-narration-text', '');
    if (custom) return compactText(custom, 380);
    const brand = finalBrandNameValue() || '마케케';
    const topic = field('aad-topic', '쇼츠 광고');
    const meta = draftCreativeFieldMeta();
    const selected = (refs || videoCutRefs()).slice(0, 6);
    const middle = selected.map(function (ref, index) {
      return overlaySloganText(ref, index, selected.length + 1);
    }).filter(Boolean);
    const lines = [
      meta?.tension ? meta.tension + '.' : '',
      meta?.exception ? meta.exception + '.' : '',
      topic + '.',
      middle.slice(0, 4).join('. '),
      meta?.gravity ? meta.gravity + '.' : '',
      brand + '. 지금 기억해야 할 이름.',
    ].filter(Boolean).join(' ');
    return compactText(lines.replace(/\s+/g, ' ').trim(), 380);
  }

  async function ensureFinalAudioAssets(renderDuration, refs) {
    if (!state.bgm || !state.bgm.url) {
      setBusy('Gemini가 최종 광고 음악을 만드는 중...');
      const musicDirection = field('aad-music-direction', currentBriefDetail().sound || '');
      const fieldMusic = creativeFieldAudioDirection();
      const bgm = await apiJSON('/api/hyperframes/generate-bgm', {
        topic: field('aad-topic', '쇼츠 광고'),
        tone: [field('aad-tone', '프리미엄하고 선명한 톤'), fieldMusic, musicDirection].filter(Boolean).join(' / '),
        objective: field('aad-objective', '첫 3초 주목, 제품 기억, 클릭 전환'),
        source: [
          '이미 영상 API 클립 안에 들어간 SFX/VFX/BGM은 다시 만들지 않는다. 여기서는 전체 광고를 하나로 묶는 얇은 최종 음악 베드만 만든다.',
          field('aad-source', ''),
          creativeFieldPromptBlock('final BGM and narration glue only', null),
          musicDirection ? '사용자 음악 수정: ' + musicDirection : '',
        ].filter(Boolean).join('\n'),
        duration: renderDuration,
        scene_texts: audioSceneTexts(refs),
      });
      state.bgm = bgm;
      addLog('Gemini 음악 생성 완료', 'success');
      await saveHistoryCheckpoint('음악');
    }
    if (!state.narration || !state.narration.url) {
      const text = buildFinalNarrationText(refs);
      if (text) {
        setBusy('Gemini가 최종 나레이션을 만드는 중...');
        const narration = await apiJSON('/api/hyperframes/generate-narration', {
          text: text,
          voice: field('aad-voice', 'Kore'),
          model: 'gemini-auto',
          duration: renderDuration,
        });
        state.narration = Object.assign({ text: text }, narration);
        addLog('Gemini 나레이션 생성 완료', 'success');
        await saveHistoryCheckpoint('나레이션');
      }
    }
  }

  async function renderFinal() {
    const refs = videoCutRefs();
    if (!refs.length) { alert('먼저 콘티를 생성하세요.'); return; }
    const missing = refs.filter(function (ref) { return !state.videos[ref.key]?.url && !state.videos[ref.key]?.mock; });
    if (missing.length) { alert('선별된 실제 영상 컷의 영상 모델 결과가 필요합니다. 남은 컷: ' + missing.length + '개'); return; }
    if (state.busy) return;
    setBusy('HyperFrames가 마지막 브랜드만 얹어 최종 렌더하는 중...');
    try {
      const renderDuration = Math.max(selectedDuration(), Math.ceil(finalTimelineDuration(refs) * 100) / 100);
      await ensureFinalAudioAssets(renderDuration, refs);
      setBusy('HyperFrames가 VFX, 음악, 나레이션, 마지막 브랜드를 최종 렌더하는 중...');
      const data = await apiJSON('/api/hyperframes/render-native-async', {
        html: buildFinalHtml(),
        duration: renderDuration,
        name: 'animation-ad-video-model',
        format: 'mp4',
        fps: 30,
        quality: 'high',
      });
      state.finalJob = data.job || { jobId: data.jobId };
      invalidateQuality();
      addLog('최종 렌더 작업 접수: ' + (data.jobId || ''), 'success');
      await pollFinalJob(data.jobId);
    } catch (err) {
      addLog('최종 렌더 실패: ' + err.message, 'error');
      alert('최종 렌더 실패: ' + err.message);
    } finally {
      setBusy('');
    }
  }

  async function pollFinalJob(jobId) {
    if (!jobId) return;
    const started = Date.now();
    while (Date.now() - started < 15 * 60 * 1000) {
      const res = await fetch('/api/hyperframes/render-jobs/' + encodeURIComponent(jobId));
      const data = await res.json().catch(function () { return {}; });
      const job = data.job || {};
      state.finalJob = job;
      if (job.status === 'complete') {
        state.finalUrl = job.outputUrl || '';
        state.activeStep = 7;
        invalidateQuality();
        addLog('최종 애니메이션 광고 렌더 완료', 'success');
        scheduleHistoryAutosave();
        await saveHistoryCheckpoint('최종 렌더');
        render();
        return;
      }
      if (job.status === 'failed') throw new Error(job.error || '렌더 실패');
      await new Promise(function (resolve) { setTimeout(resolve, 3000); });
    }
    throw new Error('렌더 시간이 초과되었습니다');
  }

  function openStoryboardModal(index) {
    const refs = allCutRefs();
    if (!refs.length) {
      alert('먼저 콘티를 생성하세요.');
      return;
    }
    state.storyboardIndex = Math.max(0, Math.min(refs.length - 1, Number(index) || 0));
    render();
  }

  function openCutModal(sceneIndex, cutIndex) {
    const refs = allCutRefs();
    const found = refs.findIndex(function (ref) {
      return ref.sceneIndex === sceneIndex && ref.cutIndex === cutIndex;
    });
    openStoryboardModal(found >= 0 ? found : 0);
  }

  function closeStoryboardModal() {
    state.storyboardIndex = null;
    render();
  }

  function moveStoryboardModal(delta) {
    const refs = allCutRefs();
    if (!refs.length) return;
    const next = Math.max(0, Math.min(refs.length - 1, (Number(state.storyboardIndex) || 0) + delta));
    state.storyboardIndex = next;
    render();
  }

  async function reapplyStoryboardCut() {
    const refs = allCutRefs();
    const ref = refs[Number(state.storyboardIndex) || 0];
    if (!ref || state.busy) return;
    if (!isVideoProductionCut(ref.key)) {
      alert('실제 영상화 대상으로 선별된 컷만 재적용할 수 있습니다.');
      return;
    }
    addLog('수정값을 컷 ' + (ref.sceneIndex + 1) + '-' + (ref.cutIndex + 1) + '에 재적용합니다. 이미지와 영상이 순서대로 갱신됩니다.', 'info');
    const imageUpdated = await generateSceneImage(ref.sceneIndex, ref.cutIndex);
    if (imageUpdated && hasRealSceneImage(ref.key)) await generateSceneVideo(ref.sceneIndex, ref.cutIndex);
  }

  function updateModalCut(fieldName, value) {
    const refs = allCutRefs();
    const ref = refs[Number(state.storyboardIndex) || 0];
    if (!ref) return;
    const scene = state.scenes[ref.sceneIndex];
    const cut = scene ? ensureMicroCuts(scene, ref.sceneIndex)[ref.cutIndex] : null;
    if (!cut) return;
    cut[fieldName] = String(value == null ? '' : value);
    invalidateQuality();
    scheduleHistoryAutosave();
  }

  function selectImage(sceneIndex, cutIndex, imageIndex) {
    const key = cutKey(sceneIndex, cutIndex);
    const list = state.images[key] || [];
    list.forEach(function (item, index) { item.selected = index === imageIndex; });
    invalidateQuality();
    scheduleHistoryAutosave();
    render();
  }

  function jumpFlowStep(stepNo) {
    state.activeStep = Math.max(1, Math.min(8, Number(stepNo) || 1));
    render();
    setTimeout(function () {
      const el = document.querySelector('.aad-stage-anchor') || document.querySelector('.aad-flow-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function goToImageStage() {
    if (!state.scenes.length) {
      alert('먼저 3단계에서 콘티를 생성하세요.');
      return;
    }
    if (Number(state.stepMoving || 0) === 4) return;
    state.stepMoving = 4;
    state.activeStep = 4;
    state.logs.unshift(makeLog('동작중 · 4단계 기준 이미지 화면으로 이동합니다.', 'info'));
    state.logs = state.logs.slice(0, 10);
    render();
    setTimeout(function () {
      state.stepMoving = 0;
      state.logs.unshift(makeLog('4단계 기준 이미지 화면으로 이동했습니다. 이제 선별 컷 이미지만 생성하세요.', 'info'));
      state.logs = state.logs.slice(0, 30);
      render();
      const action = document.querySelector('.aad-stage-anchor[data-aad-active-step="4"] .aad-action-board') ||
        document.querySelector('.aad-stage-anchor[data-aad-active-step="4"] .aad-stage-hint.active') ||
        document.querySelector('.aad-stage-anchor[data-aad-active-step="4"]');
      if (action) action.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);
  }

  function focusCurrentStep() {
    jumpFlowStep(activeFlowStepNo());
  }

  function init() {
    if (!state.logs.length) {
      state.logs = [makeLog('쇼츠 광고 만들기 화면을 열었습니다. 1단계 광고 컨셉부터 진행하세요.', 'info')];
    }
    const el = root();
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = '<div class="aad-card"><b>쇼츠 광고 만들기 화면 준비중</b><p>설정과 작업 이력을 불러오고 있습니다.</p></div>';
    }
    if (state.initPending) return;
    state.initPending = true;
    setTimeout(function () {
      state.initPending = false;
      installStyles();
      render();
      loadModelSettings();
      loadSemanticGraph({ silent: true, render: false }).then(function () { render(); });
      loadSuccessCases({ silent: true, render: false }).then(function () { render(); });
      loadHistoryList({ silent: true });
      loadPersonaModelLibrary({ silent: true });
    }, 0);
  }

  window.aadInit = init;
  window.aadLoadModelSettings = loadModelSettings;
  window.aadLoadSuccessCases = loadSuccessCases;
  window.aadLearnSuccessCase = learnSuccessCase;
  window.aadOpenBenchmarkModal = openBenchmarkModal;
  window.aadCloseBenchmarkModal = closeBenchmarkModal;
  window.aadSetBenchmarkFilter = setBenchmarkFilter;
  window.aadApplyBenchmarkAd = applyBenchmarkAd;
  window.aadApplyCreativeReport = applyCreativeReport;
  window.aadAnalyzeBenchmarkURL = analyzeBenchmarkURL;
  window.aadAnalyzeBenchmarkModalURL = analyzeBenchmarkModalURL;
  window.aadSetBriefSubStep = setBriefSubStep;
  window.aadGeneratePlan = generatePlan;
  window.aadGenerateBriefRecommendations = generateBriefRecommendations;
  window.aadApplyPreset = applyPreset;
  window.aadApplyBriefPack = applyBriefPack;
  window.aadBeginnerAutoSet = beginnerAutoSet;
  window.aadBeginnerOneClick = beginnerOneClick;
  window.aadSyncModelPicker = syncModelPicker;
  window.aadSetAspect = setAspect;
  window.aadSetProductionMode = setProductionMode;
  window.aadUploadReferenceImages = uploadReferenceImages;
  window.aadRemoveReferenceImage = removeReferenceImage;
  window.aadGeneratePersonaModelReference = generatePersonaModelReference;
  window.aadOpenPersonaModelBuilder = openPersonaModelBuilder;
  window.aadClosePersonaModelBuilder = closePersonaModelBuilder;
  window.aadBuildPersonaModelFromModal = buildPersonaModelFromModal;
  window.aadSavePersonaModelFromModal = savePersonaModelFromModal;
  window.aadLoadPersonaModels = loadPersonaModelLibrary;
  window.aadSavePersonaModel = saveCurrentPersonaModel;
  window.aadApplyPersonaModel = applyPersonaModel;
  window.aadPreviewPersonaModel = previewPersonaModel;
  window.aadClosePersonaModelPreview = closePersonaModelPreview;
  window.aadEditPersonaModel = editPersonaModel;
  window.aadEditPersonaModelFromPreview = editPersonaModelFromPreview;
  window.aadCancelPersonaModelEdit = cancelPersonaModelEdit;
  window.aadUpdatePersonaModelDraft = updatePersonaModelDraft;
  window.aadUpdatePersonaModel = updatePersonaModel;
  window.aadDeletePersonaModel = deletePersonaModel;
  window.aadRefreshStyleGuide = refreshStyleGuide;
  window.aadQuickStoryboard = quickStoryboard;
  window.aadLoadTestSample = loadTestSample;
  window.aadGenerateSceneImage = generateSceneImage;
  window.aadGenerateAllImages = generateAllImages;
  window.aadGenerateSelectedImages = generateSelectedImages;
  window.aadGenerateSceneVideo = generateSceneVideo;
  window.aadGenerateAllVideos = generateAllVideos;
  window.aadReapplySelectedVideoModel = reapplySelectedVideoModel;
  window.aadRenderFinal = renderFinal;
  window.aadRunQualityAudit = runQualityAudit;
  window.aadRunMasterpieceLoop = runMasterpieceLoop;
  window.aadOpenStoryboardModal = openStoryboardModal;
  window.aadOpenCutModal = openCutModal;
  window.aadCloseStoryboardModal = closeStoryboardModal;
  window.aadMoveStoryboardModal = moveStoryboardModal;
  window.aadReapplyStoryboardCut = reapplyStoryboardCut;
  window.aadUpdateModalCut = updateModalCut;
  window.aadSelectImage = selectImage;
  window.aadUpdateCut = updateCut;
  window.aadUpdateCutFieldOnly = updateCutFieldOnly;
  window.aadUpdateFinalAudioSetting = updateFinalAudioSetting;
  window.aadUpdateFinalTextSetting = updateFinalTextSetting;
  window.aadResetFinalAudioAssets = resetFinalAudioAssets;
  window.aadRewriteCut = rewriteMicroCut;
  window.aadJumpFlowStep = jumpFlowStep;
  window.aadGoToImageStage = goToImageStage;
  window.aadFocusCurrentStep = focusCurrentStep;
  window.aadSaveHistory = saveHistory;
  window.aadLoadHistoryList = loadHistoryList;
  window.aadOpenHistory = openHistory;
  window.aadDeleteHistory = deleteHistory;
  window.aadDeleteAllHistory = deleteAllHistory;
  window.aadShowMoreLogs = showMoreLogs;
  window.aadCollapseLogs = collapseLogs;
  window.aadDebugFinalHtml = function () {
    syncForm();
    return buildFinalHtml();
  };
  window.aadDebugVideoCutKeys = function () {
    return videoCutRefs().map(function (ref) { return ref.key; });
  };
})();
