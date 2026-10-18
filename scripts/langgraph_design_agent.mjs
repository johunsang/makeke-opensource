import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

const input = await readStdinJson();

const State = Annotation.Root({
  mode: Annotation(),
  html: Annotation(),
  instruction: Annotation(),
  prompt: Annotation(),
  apiKey: Annotation(),
  model: Annotation(),
  images: Annotation(),
  attempt: Annotation(),
  response: Annotation(),
  finalHtml: Annotation(),
  error: Annotation(),
});

const graph = new StateGraph(State)
  .addNode('prepare', preparePrompt)
  .addNode('generate', callAtlas)
  .addNode('validate', validateHtml)
  .addNode('repair', repairPrompt)
  .addEdge(START, 'prepare')
  .addEdge('prepare', 'generate')
  .addEdge('generate', 'validate')
  .addConditionalEdges('validate', (state) => {
    if (state.finalHtml) return END;
    if ((state.attempt || 0) >= 2) return END;
    return 'repair';
  })
  .addEdge('repair', 'generate')
  .compile();

const result = await graph.invoke({
  mode: input.mode || 'edit',
  html: input.html || '',
  instruction: input.instruction || '',
  prompt: input.prompt || '',
  apiKey: input.api_key || input.apiKey || '',
  model: input.model || 'openai/gpt-5.4',
  images: Array.isArray(input.images) ? input.images : [],
  attempt: 0,
});

if (result.finalHtml) {
  writeJson({ status: 'ok', html: result.finalHtml, provider: 'atlas-langgraph', model: result.model });
} else {
  writeJson({ status: 'error', error: result.error || 'LangGraph 디자인 에이전트가 HTML을 만들지 못했습니다.' });
  process.exitCode = 1;
}

function preparePrompt(state) {
  const baseRules = [
    '[절대 출력 규칙]',
    '- 설명, 마크다운, 코드펜스 없이 완전한 HTML 문서만 출력하세요.',
    '- 반드시 <!DOCTYPE html>로 시작하고 </html>로 끝나야 합니다.',
    '- CSS와 JavaScript는 HTML 안에 포함하세요.',
    '- 상대 이미지 경로, source.unsplash.com, via.placeholder.com을 쓰지 마세요.',
    '- 이미지가 필요한 위치는 <img src="#reference-image-N"> 형태로 표시하세요.',
    '- 모든 주요 콘텐츠는 캔버스 안쪽 안전 여백 안에 완전히 보여야 합니다.',
    '- 제목/본문/CTA 텍스트는 절대 잘리거나 화면 밖으로 나가면 안 됩니다.',
    '- 큰 장식 타이포를 쓰더라도 한글 단어가 쪼개지거나 프레임 밖으로 밀리면 실패입니다.',
    '- hero 제목은 clamp()로 제한하고 최대 96px를 넘기지 마세요.',
    '- 한글은 word-break: keep-all; overflow-wrap: break-word; line-height: 1.08 이상을 적용하세요.',
    '- overflow:hidden에 의존해 텍스트를 자르지 마세요.',
    '- 매번 같은 베이지 종이/격자 배경, 왼쪽 큰 제목 + 오른쪽 카드/대시보드, 하단 CTA 띠 구조로 수렴하지 마세요.',
    '- 마케케 앱의 앱 기본 강조색(#ff8c00/#ff6b00)은 앱 UI 색상일 뿐입니다. 프로필 브랜드 색상에 앱 기본 강조색이 없고 사용자가 요구하지 않았다면 결과물의 메인 포인트/CTA/배지 색으로 쓰지 마세요.',
    '- 생성 요청에서는 시각 시스템을 먼저 정하세요. 예: 스위스 에디토리얼, 매거진 커버, 프리미엄 룩북, 브루탈리스트 세일즈 카드, 데이터 인포그래픽, 이벤트 티켓.',
  ].join('\n');
  const chatRule = [
    '[채팅형 디자인 에이전트 규칙]',
    '- 사용자의 마지막 채팅 지시를 우선합니다.',
    '- 기존 디자인의 좋은 부분은 유지하고, 필요한 부분만 고칩니다.',
    '- 선택 요소 컨텍스트가 있으면 그 요소를 중심으로 수정합니다.',
    '- 전체 재작성보다 빠르고 정확한 패치를 목표로 합니다.',
  ].join('\n');
  const prompt = state.mode === 'generate'
    ? `${baseRules}\n\n${chatRule}\n\n[생성 요청]\n${state.prompt || state.instruction}`
    : `${baseRules}\n\n${chatRule}\n\n[수정 지시]\n${state.instruction}\n\n[현재 HTML]\n${state.html}`;
  return { prompt, attempt: state.attempt || 0 };
}

async function callAtlas(state) {
  const includeImages = state.attempt === 0;
  const content = [{ type: 'text', text: state.prompt }];
  if (includeImages) {
    for (const dataUrl of state.images || []) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        content.push({ type: 'image_url', image_url: { url: dataUrl } });
      }
    }
  }
  const message = content.length > 1
    ? { role: 'user', content }
    : { role: 'user', content: state.prompt };
  const response = await fetch('https://api.atlascloud.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: state.model || 'openai/gpt-5.4',
      messages: [message],
      temperature: 0.35,
      max_tokens: 24000,
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    return { response: '', error: `Atlas API 오류 ${response.status}: ${raw.slice(0, 500)}` };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { response: '', error: `Atlas 응답 JSON 파싱 실패: ${raw.slice(0, 300)}` };
  }
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { response: text, error: text ? '' : 'Atlas 응답 텍스트가 비어 있습니다.' };
}

function validateHtml(state) {
  const html = extractHtml(state.response || '');
  if (!html) return { finalHtml: '', error: state.error || '응답에서 HTML을 찾지 못했습니다.' };
  if (!/<body[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    return { finalHtml: '', error: 'HTML 구조가 불완전합니다.' };
  }
  return { finalHtml: html, error: '' };
}

function repairPrompt(state) {
  return {
    attempt: (state.attempt || 0) + 1,
    prompt: [
      '[이전 응답 문제]',
      state.error || 'HTML 검증 실패',
      '',
      '[다시 출력]',
      '설명 없이 <!DOCTYPE html>부터 </html>까지 완전한 HTML만 다시 출력하세요.',
      '',
      state.prompt,
    ].join('\n'),
  };
}

function extractHtml(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const docMatches = text.match(/(?:<!DOCTYPE\s+html[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/gi);
  if (!docMatches || docMatches.length === 0) return '';
  if (docMatches.length === 1) {
    const html = docMatches[0].trim();
    return /^<!DOCTYPE/i.test(html) ? html : `<!DOCTYPE html>\n${html}`;
  }
  return mergeHtmlDocs(docMatches);
}

function mergeHtmlDocs(docs) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Makeke Multi Page Design</title>
<style>html,body{margin:0;background:#f5f5f7;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.makeke-deck{display:flex;flex-direction:column;gap:40px;padding:40px;box-sizing:border-box}.makeke-page{position:relative;overflow:hidden;background:#fff;border-radius:24px;box-shadow:0 18px 55px rgba(0,0,0,.10);min-height:720px}</style>
</head>
<body>
<main class="makeke-deck" data-makeke-multi-html="true" data-slide-count="${docs.length}">
${docs.map((doc, i) => `<section class="makeke-page" data-slide="${i}" data-makeke-page="${i + 1}">${extractBody(doc)}</section>`).join('\n')}
</main>
</body>
</html>`;
}

function extractBody(html) {
  const match = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function readStdinJson() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    process.stdin.on('error', reject);
  });
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
