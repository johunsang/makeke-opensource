/* single_advideo — 공용 상태/상수
 * 분할된 single_advideo 모듈이 공유하는 최상위 바인딩을 한 곳에 모은다.
 * top-level var/let/const 는 이 스크립트의 Script 환경에만 살아있으므로,
 * 다른 분할 파일에서도 바로 쓸 수 있도록 var 로 선언해 window 에 귀속시킨다.
 */

var _savState = {
  uploadedImages: [],
  sceneImages: {},    // { sceneIndex: [url1, url2, ...] } — 씬별 참조 이미지
  script: null,
  sceneResults: [],
  projectDir: '',
  finalVideoPath: '',
  generating: false,
  aiUsage: {},
};

var SAV_SUBTITLE_FONT_MAP = {
  'nanum-square': "'NanumSquare', 'Apple SD Gothic Neo', sans-serif",
  'nanum-gothic': "'NanumGothic', 'Apple SD Gothic Neo', sans-serif",
  'pretendard': "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
};

var SAV_SUBTITLE_STYLE_PRESETS = {
  promo: { label: '프로모션', text: '핵심 할인 혜택', color: '#ffffff', bg: 'linear-gradient(135deg, rgba(0,230,118,0.92), rgba(255,213,0,0.92))', textShadow: '0 3px 10px rgba(0,0,0,0.35)', border: '', stroke: '', radius: '14px', weight: '900' },
  minimal: { label: '미니멀', text: '깔끔한 자막 스타일', color: '#ffffff', bg: 'transparent', textShadow: '', border: '', stroke: '3px rgba(0,0,0,0.9)', radius: '0', weight: '800' },
  news: { label: '뉴스형', text: '핵심 정보 요약 자막', color: '#ffffff', bg: 'rgba(0,0,0,0.74)', textShadow: '', border: '', stroke: '', radius: '10px', weight: '800' },
  pop: { label: '팝', text: '지금 바로 확인!', color: '#fff200', bg: 'transparent', textShadow: '0 4px 10px rgba(0,0,0,0.45)', border: '', stroke: '2px rgba(0,0,0,0.95)', radius: '0', weight: '900' },
  neon: { label: '네온', text: '네온 발광 자막', color: '#00ffc8', bg: 'transparent', textShadow: '0 0 12px rgba(0,255,200,0.85), 0 0 24px rgba(0,255,200,0.45)', border: '', stroke: '', radius: '0', weight: '800' },
  cinematic: { label: '시네마틱', text: 'cinematic subtitle', color: '#dcdcdc', bg: 'rgba(0,0,0,0.58)', textShadow: '0 2px 6px rgba(0,0,0,0.5)', border: '', stroke: '', radius: '8px', weight: '700', letterSpacing: '0.06em' },
  soft: { label: '소프트', text: '은은한 감성 자막', color: '#fff5eb', bg: 'rgba(255,255,255,0.06)', textShadow: '0 3px 10px rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', stroke: '', radius: '12px', weight: '700' },
  bold: { label: '볼드', text: '강하게 강조하기', color: '#ffffff', bg: 'transparent', textShadow: '0 5px 14px rgba(0,0,0,0.3)', border: '', stroke: '4px rgba(0,0,0,0.95)', radius: '0', weight: '900' },
  label: { label: '라벨형', text: '혜택 요약 라벨', color: '#ffffff', bg: 'linear-gradient(135deg, rgba(28,28,30,0.88), rgba(66,66,69,0.88))', textShadow: '', border: '1px solid rgba(255,255,255,0.16)', stroke: '', radius: '999px', weight: '800' },
  none: { label: '없음', text: '자막 없음', color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.05)', textShadow: '', border: '1px dashed rgba(255,255,255,0.15)', stroke: '', radius: '10px', weight: '700' },
};

// 감독 작업 중 표시 (모든 감독 관련 API 호출 자동 래핑)
var _SAV_DIRECTOR_BUSY_LABELS = {
  'director-note': '지시 정리',
  'direct-film': '트리트먼트 작성',
  'create-character': '가상 인물 캐스팅',
  'storyboard': '콘티 이미지 생성',
  'critique-scene': '씬 재검토',
  'continuity-lock': '일관성 락 설계',
  'forecast': '성과 예측',
  'research': '시장 리서치',
  'team-treatment': '5인 팀 협업',
  'suggest-brief': '브리프 추천',
  'suggest-unique-style': '유니크 스타일 3종 추천',
  'suggest-story-angle': '스토리 각도 추천',
  'bgm-first': 'BGM 생성',
  'per-scene-voice': '씬별 보이스 설계',
  'color-lut': '색보정 설계',
  'ab-variants': 'A/B 변주 생성',
  'multi-format': '멀티 포맷 설계',
  'suggest-images': 'AI 소재 이미지 생성',
  'classify-image': '이미지 분류',
  'generate-image': '이미지 생성',
  'auto-direct': '씬 디렉팅 자동 보정',
  'script': '씬 스크립트 작성',
  'multi-format-render': '멀티포맷 실렌더',
  'generate': '영상 생성',
};

var _savBusyCounter = 0;
var _savBusyCurrentLabel = '';
var _savBusyWatchdog = null;

function savAiProviderLabel(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (value === 'codex') return 'Codex CLI';
  if (value === 'gemini') return 'Gemini API';
  return provider || '기본';
}

function savFormatAiEngine(provider, model) {
  const parts = [];
  const providerLabel = savAiProviderLabel(provider);
  if (providerLabel) parts.push(providerLabel);
  if (model) parts.push(model);
  return parts.join(' · ');
}

function savRenderAiUsage() {
  const wrap = document.getElementById('sav-ai-engine-meta');
  if (!wrap) return;
  const entries = Object.values(_savState.aiUsage || {});
  if (!entries.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:rgba(0,0,0,0.4);">아직 실행 전입니다. 브리프 추천, 소재 이미지, 스크립트를 돌리면 여기에 실제 사용 엔진이 기록됩니다.</div>';
    return;
  }
  wrap.innerHTML = entries.slice(-4).reverse().map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;background:#fff;border:1px solid rgba(255,140,0,0.12);border-radius:12px;">
      <div style="min-width:0;">
        <div style="font-size:10px;font-weight:800;color:#ff8c00;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(item.label || 'AI')}</div>
        <div style="font-size:11px;color:#1c1c1e;font-weight:700;line-height:1.45;word-break:break-word;">${escapeHtml(savFormatAiEngine(item.provider, item.model) || '기록 없음')}</div>
      </div>
      <div style="flex:0 0 auto;padding:4px 8px;border-radius:999px;background:rgba(255,140,0,0.08);font-size:10px;font-weight:800;color:#ff8c00;">${escapeHtml(savAiProviderLabel(item.provider))}</div>
    </div>
  `).join('');
}

function savRememberAiUsage(key, label, provider, model) {
  if (!key || (!provider && !model)) return;
  _savState.aiUsage[key] = {
    key,
    label: label || key,
    provider: provider || '',
    model: model || '',
  };
  savRenderAiUsage();
}

function savRememberAiUsageFromResponse(key, label, res, providerKey = 'text_provider', modelKey = 'text_model') {
  if (!res || typeof res !== 'object') return;
  savRememberAiUsage(key, label, res[providerKey], res[modelKey]);
}

window.savRenderAiUsage = savRenderAiUsage;
window.savRememberAiUsage = savRememberAiUsage;
window.savRememberAiUsageFromResponse = savRememberAiUsageFromResponse;

// 7단계 — 4번 = 스크립트+자동 씬 디렉팅 (병합)
var SAV_STEP_MAP = {
  1: { panel: 1, anchor: null },  // 소재
  2: { panel: 2, anchor: null },  // 브리프
  3: { panel: 3, anchor: null },  // 스타일·모델
  4: { panel: 5, anchor: null },  // 스크립트 + 자동 씬 디렉팅 (패널ID 5)
  5: { panel: 6, anchor: null },  // AI 보정
  6: { panel: 7, anchor: null },  // 자막·TTS·BGM
  7: { panel: 8, anchor: null },  // 영상 생성
};

var SAV_STEP_TITLES = {
  1: '1. 소재 입력',
  2: '2. 브리프',
  3: '3. 스타일 · 영상 모델',
  4: '4. 스크립트 + 씬 디렉팅',
  5: '5. 🤖 AI 씬 보정',
  6: '6. 자막 · TTS · BGM',
  7: '7. 영상 생성',
};
