/**
 * video_agent_layout.js
 * 영상 에이전트 메인 레이아웃 HTML 렌더러 — video_agent.js 에서 분리.
 *
 * 공용 API: window._VAGLayout = { render(rootElement) }.
 * vagInit() 내부에서 `_renderLayout(root)` 대신 `window._VAGLayout.render(root)` 를 호출.
 *
 * 외부 의존(호출 시점에 필요):
 * - window.vagCopyCode, vagGenerate, vagDirectorMode, vagAttachImages, vagAttachLogo,
 *   vagSearchSources, vagToggleSourcePanel, vagValidateCode, vagOpenFolder, vagCopyFinalPrompt
 *   — 모두 video_agent.js 가 window 에 등록. render 는 외부 호출 후 시점이라 이미 준비됨.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  V._vagTTSVoices = V._vagTTSVoices || [
    { value: 'gemini-Kore', label: 'Kore · 단호하고 안정적' },
    { value: 'gemini-Zephyr', label: 'Zephyr · 밝고 산뜻하게' },
    { value: 'gemini-Puck', label: 'Puck · 활기차고 경쾌하게' },
    { value: 'gemini-Charon', label: 'Charon · 정보전달형' },
    { value: 'gemini-Fenrir', label: 'Fenrir · 흥미진진하고 힘 있게' },
    { value: 'gemini-Leda', label: 'Leda · 젊고 가볍게' },
    { value: 'gemini-Orus', label: 'Orus · 확고하고 또렷하게' },
    { value: 'gemini-Aoede', label: 'Aoede · 쾌활하고 부드럽게' },
    { value: 'gemini-Callirrhoe', label: 'Callirrhoe · 차분하고 매끄럽게' },
    { value: 'gemini-Autonoe', label: 'Autonoe · 자연스럽고 편안하게' },
    { value: 'gemini-Enceladus', label: 'Enceladus · 숨결감 있고 밝게' },
    { value: 'gemini-Iapetus', label: 'Iapetus · 깊고 신뢰감 있게' },
    { value: 'gemini-Umbriel', label: 'Umbriel · 낮고 차분하게' },
    { value: 'gemini-Algieba', label: 'Algieba · 따뜻하고 안정적' },
    { value: 'gemini-Despina', label: 'Despina · 선명하고 친근하게' },
    { value: 'gemini-Erinome', label: 'Erinome · 또렷하고 담백하게' },
    { value: 'gemini-Algenib', label: 'Algenib · 진중하고 명확하게' },
    { value: 'gemini-Rasalgethi', label: 'Rasalgethi · 풍부하고 성숙하게' },
    { value: 'gemini-Laomedeia', label: 'Laomedeia · 부드럽고 자연스럽게' },
    { value: 'gemini-Achernar', label: 'Achernar · 선명하고 밝게' },
    { value: 'gemini-Alnilam', label: 'Alnilam · 단단하고 차분하게' },
    { value: 'gemini-Schedar', label: 'Schedar · 균형 잡힌 안내톤' },
    { value: 'gemini-Gacrux', label: 'Gacrux · 성숙하고 묵직하게' },
    { value: 'gemini-Pulcherrima', label: 'Pulcherrima · 밝고 섬세하게' },
    { value: 'gemini-Achird', label: 'Achird · 친근하고 편안하게' },
    { value: 'gemini-Zubenelgenubi', label: 'Zubenelgenubi · 낮고 안정적' },
    { value: 'gemini-Vindemiatrix', label: 'Vindemiatrix · 명료하고 전문적으로' },
    { value: 'gemini-Sadachbia', label: 'Sadachbia · 온화하고 부드럽게' },
    { value: 'gemini-Sadaltager', label: 'Sadaltager · 깊고 차분하게' },
    { value: 'gemini-Sulafat', label: 'Sulafat · 따뜻하고 여유롭게' },
  ];
  function _voiceOptionsHtml(current) {
    var selected = typeof current === 'undefined' ? 'gemini-Kore' : current;
    return '<option value=""' + (selected === '' ? ' selected' : '') + '>나레이션 없음</option>' +
      V._vagTTSVoices.map(function (voice) {
        return '<option value="' + voice.value + '"' + (voice.value === selected ? ' selected' : '') + '>' + voice.label + '</option>';
      }).join('');
  }
  function _textareaStyle() { return 'width:100%;min-height:220px;padding:12px 14px;font-size:12px;line-height:1.65;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.05);color:#1c1c1e;resize:vertical;'; }

  function render(root) {
    if (!root) return;
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;height:calc(100vh - 140px);overflow:hidden;">
        <div style="display:none;">
          <span id="vag-bg-badge" style="display:none;align-items:center;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:800;"></span>
          <!-- 모든 옵션은 채팅 대화로 받음. 아래는 상태 저장용 hidden inputs -->
          <select id="vag-provider" style="display:none;"><option value="gemini" selected>Gemini</option><option value="codex">Codex</option><option value="kimi">Kimi</option><option value="atlas:openai/gpt-5.5">GPT 5.5</option><option value="atlas:anthropic/claude-opus-4.7">Claude Opus 4.7</option><option value="atlas:moonshotai/kimi-k2.6">Kimi K2.6</option><option value="atlas:deepseek-ai/deepseek-v4-pro">DeepSeek V4 Pro</option><option value="atlas:qwen/qwen3-max-2026-01-23">Qwen3 Max</option><option value="remotion">remotion</option></select>
          <select id="vag-mode" style="display:none;"><option value="short" selected>short</option><option value="120">120</option><option value="180">180</option><option value="300">300</option><option value="600">600</option><option value="1200">1200</option><option value="1800">1800</option></select>
          <input type="file" id="vag-image-input" multiple accept="image/*" style="display:none;" onchange="vagAttachImages(event.target.files)">
          <input type="file" id="vag-logo-input" accept="image/*" style="display:none;" onchange="vagAttachLogo(event.target.files[0])">
          <input type="checkbox" id="vag-auto-narration" checked style="display:none;">
          <input type="checkbox" id="vag-auto-bgm" checked style="display:none;">
          <input type="range" id="vag-bgm-volume" min="0" max="40" value="18" style="display:none;">
          <input type="text" id="vag-cta-input" style="display:none;">
          <button onclick="vagDirectorMode()" id="vag-director-btn" style="display:none;">🎭 감독</button>
          <input type="hidden" id="vag-topic" value="">
          <input type="hidden" id="vag-scene-count" value="6">
          <input type="hidden" id="vag-aspect" value="9:16">
          <input type="hidden" id="vag-voice" value="gemini-Kore">
          <input type="hidden" id="vag-subtitle" value="promo">
          <input type="hidden" id="vag-ai-bg-video" value="auto">
          <input type="hidden" id="vag-ai-bg-video-model" value="">
          <input type="hidden" id="vag-bg-image-provider" value="gemini">
          <input type="hidden" id="vag-bg-image-model" value="gemini-3.1-flash-image-preview">
          <input type="hidden" id="vag-bg-image-candidates" value="1">
          <input type="hidden" id="vag-output-mode" value="motion">
        </div>
        <div id="vag-attachments" style="display:none;padding:8px 12px;background:rgba(255,140,0,0.04);border:1px solid rgba(255,140,0,0.15);border-radius:10px;"></div>
        <div id="vag-source-search-panel" style="display:none;padding:10px;background:#fff;border:1px solid rgba(255,140,0,0.2);border-radius:10px;">
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="text" id="vag-source-query" placeholder="외부 자료 키워드 (예: 한라봉 효능, 겨울 음료 트렌드)" style="flex:1;padding:7px 10px;font-size:11px;border:1px solid rgba(0,0,0,0.1);border-radius:8px;" onkeydown="if(event.key==='Enter'){event.preventDefault();vagSearchSources();}">
            <button type="button" onclick="vagSearchSources()" style="padding:7px 14px;font-size:11px;font-weight:700;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:8px;cursor:pointer;">검색</button>
            <button type="button" onclick="vagToggleSourcePanel()" style="padding:7px 10px;font-size:11px;border:1px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.6);border-radius:8px;cursor:pointer;">닫기</button>
          </div>
          <div id="vag-source-results" style="margin-top:8px;max-height:220px;overflow-y:auto;"></div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(340px,0.9fr) minmax(520px,1.1fr);gap:12px;flex:1;min-height:0;">
          <div id="vag-assist-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:20px;display:flex;flex-direction:column;min-height:0;overflow:hidden;">
            <div style="padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#ff8c00,#ff6b00);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" style="width:12px;height:12px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
                <span style="font-size:13px;font-weight:800;color:#1c1c1e;white-space:nowrap;">영상 에이전트 대화</span>
              </div>
              <button onclick="(window._vagAutoStarted=false,vagGenerate())" id="vag-gen-btn" title="대화 재시작" style="padding:7px 11px;border-radius:10px;border:1px solid rgba(255,140,0,0.3);background:#fff;color:#ff6b00;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                대화로 시작
              </button>
            </div>
            <div id="vag-chat-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;flex:1;overflow:auto;min-height:0;">
              <div id="vag-chat-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:120px;color:rgba(0,0,0,0.18);font-size:13px;text-align:center;">
                <div style="font-size:30px;margin-bottom:8px;">&#x1F4FD;</div>
                <div>새 영상 시작을 누르면 자료 수집부터 영상화까지 차례대로 안내합니다</div>
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;min-height:0;overflow:auto;padding-right:2px;">
            <div style="background:linear-gradient(180deg,#ffffff 0%,#fafafc 100%);border:1px solid rgba(0,0,0,0.06);border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#ff8c00,#ff6b00);box-shadow:0 0 0 3px rgba(255,140,0,0.12);display:inline-block;"></span>
                    <div style="font-size:13px;font-weight:900;color:#1c1c1e;letter-spacing:-0.01em;">작업 흐름</div>
                  </div>
                  <div style="font-size:11px;color:rgba(0,0,0,0.46);line-height:1.5;margin-top:5px;">왼쪽 대화에서 고르고, 오른쪽은 지금 단계만 확인하세요.</div>
                </div>
                <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:linear-gradient(135deg,rgba(255,140,0,0.1),rgba(255,107,0,0.06));color:#ff8c00;font-size:10px;font-weight:900;border:1px solid rgba(255,140,0,0.15);">간단 모드</div>
              </div>
              <div id="vag-current-stage-banner" style="margin-bottom:12px;padding:13px 15px;border-radius:16px;border:1px solid rgba(255,140,0,0.22);background:linear-gradient(135deg,rgba(255,140,0,0.12),rgba(255,107,0,0.05));box-shadow:0 10px 28px rgba(255,140,0,0.10);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <div style="min-width:0;">
                  <div id="vag-current-stage-title" style="font-size:14px;font-weight:950;color:#8a4b00;line-height:1.35;">현재 단계: 대기</div>
                  <div id="vag-current-stage-detail" style="margin-top:3px;font-size:11px;font-weight:750;color:rgba(138,75,0,0.72);line-height:1.45;">자료 준비, 시나리오 확인, 영상 생성 순서로 진행됩니다.</div>
                </div>
                <div id="vag-current-stage-status" style="display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;background:rgba(255,140,0,0.14);color:#ff6b00;font-size:11px;font-weight:950;white-space:nowrap;">
                  <span style="width:7px;height:7px;border-radius:50%;background:#ff8c00;display:inline-block;"></span> 대기
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:stretch;">
                ${_stageCardHtml('source', '1', '자료', '자료 준비', 'URL, 파일, 검색 자료를 모읍니다.')}
                ${_stageCardHtml('code', '2', '확인', '장면 확인', '문구와 나레이션을 먼저 고칩니다.')}
                ${_stageCardHtml('render', '3', '생성', '영상 생성', '확인 후 음성과 MP4를 만듭니다.')}
              </div>
            </div>
            <div id="vag-board-plan-host"></div>

            <details id="vag-technical-panel" style="background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:16px;overflow:hidden;">
              <summary style="list-style:none;cursor:pointer;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <span style="display:flex;flex-direction:column;gap:3px;min-width:0;">
                  <span style="font-size:12px;font-weight:900;color:#1c1c1e;">수집 자료·영상 코드 보기</span>
                  <span style="font-size:10.5px;font-weight:700;color:rgba(0,0,0,0.42);line-height:1.45;">필요할 때만 펼쳐 확인합니다.</span>
                </span>
                <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(120,120,128,0.08);color:rgba(0,0,0,0.52);font-size:10px;font-weight:900;flex:0 0 auto;">고급 확인</span>
              </summary>
              <div style="padding:0 14px 14px;border-top:1px solid rgba(0,0,0,0.05);">
                <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding-top:12px;">
                <div style="min-width:0;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                    <div style="font-size:12px;font-weight:800;color:#1c1c1e;">수집 자료</div>
                    <div id="vag-source-meta" style="font-size:10px;color:rgba(0,0,0,0.42);font-weight:700;">자료 미선택</div>
                  </div>
                  <textarea id="vag-source-preview" readonly style="width:100%;min-height:170px;padding:11px 12px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.05);font-size:11px;line-height:1.6;color:#1c1c1e;resize:vertical;"></textarea>
                </div>
                <div style="min-width:0;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                    <div style="font-size:12px;font-weight:800;color:#1c1c1e;">영상 코드</div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <div id="vag-code-meta" style="font-size:10px;color:rgba(0,0,0,0.42);font-weight:700;">코드 대기 중</div>
                      <button id="vag-validate-code" type="button" onclick="vagValidateCode()" style="padding:6px 10px;border-radius:9px;border:1px solid rgba(255,140,0,0.3);background:rgba(255,140,0,0.08);color:#ff8c00;font-size:10px;font-weight:800;cursor:pointer;">🔍 코드 검증</button>
                      <button id="vag-copy-code" type="button" style="padding:6px 10px;border-radius:9px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:10px;font-weight:700;cursor:pointer;">코드 복사</button>
                    </div>
                  </div>
                  <div id="vag-validate-result" style="display:none;margin-bottom:8px;padding:8px 10px;font-size:11px;line-height:1.6;border-radius:8px;"></div>
                  <textarea id="vag-code-preview" readonly style="width:100%;min-height:170px;padding:11px 12px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#faf8f5;font-size:10.5px;line-height:1.58;color:#1c1c1e;resize:vertical;font-family:'SFMono-Regular',Menlo,Consolas,monospace;"></textarea>
                </div>
                </div>
              </div>
            </details>

            <div id="vag-result" style="display:none;background:#fff;border:1px solid rgba(0,0,0,0.06);border-radius:20px;padding:16px;">
              <video id="vag-video-player" controls style="width:100%;max-height:420px;border-radius:14px;background:#000;"></video>
              <div id="vag-result-meta" style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:8px;"></div>
              <div id="vag-final-prompt-wrap" style="display:none;margin-top:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                  <div style="font-size:12px;font-weight:800;color:#1c1c1e;">AI 영상 최종 프롬프트</div>
                  <button onclick="vagCopyFinalPrompt()" style="padding:7px 12px;border-radius:9px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:11px;font-weight:700;cursor:pointer;">복사</button>
                </div>
                <textarea id="vag-final-prompt" readonly style="${_textareaStyle()}"></textarea>
              </div>
              <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
                <button onclick="vagOpenFolder()" style="flex:1;padding:9px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);font-size:11px;cursor:pointer;">폴더 열기</button>
              </div>
            </div>

            <div id="vag-text-edit-card" style="display:none;background:#fff;border:1px solid rgba(255,140,0,0.18);border-radius:20px;padding:16px;box-shadow:0 12px 36px rgba(255,140,0,0.08);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                <div>
                  <div style="font-size:13px;font-weight:950;color:#1c1c1e;">렌더 전 최종 확인</div>
                  <div style="font-size:11px;color:rgba(0,0,0,0.48);line-height:1.55;margin-top:4px;">씬별 나레이션을 확인한 뒤, 아래 큰 앱 기본 강조색 버튼을 누르면 음성과 영상을 만듭니다.</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button id="vag-text-reset" type="button" onclick="vagResetTextEdits()" style="padding:7px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:11px;font-weight:800;cursor:pointer;">되돌리기</button>
                  <button id="vag-text-apply" type="button" onclick="vagApplyTextEdits()" style="padding:7px 12px;border-radius:10px;border:1px solid rgba(255,140,0,0.20);background:rgba(255,140,0,0.08);color:#c85f00;font-size:11px;font-weight:900;cursor:pointer;">미리보기만 반영</button>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:12px;padding:10px 12px;border-radius:14px;background:rgba(255,140,0,0.07);border:1px solid rgba(255,140,0,0.12);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                  <div style="font-size:11px;font-weight:900;color:#8a4a00;">현재 단계</div>
                  <div style="font-size:11px;font-weight:950;color:#ff6b00;">확인 후 영상 생성</div>
                </div>
                <div style="font-size:11px;color:rgba(0,0,0,0.58);line-height:1.55;">수정만 해보고 싶으면 미리보기만 반영, 바로 만들려면 카드 하단의 음성 만들고 영상 생성 시작을 누르세요.</div>
              </div>
              <label style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
                <span style="font-size:11px;font-weight:900;color:#ff6b00;">목소리 선택</span>
                <select id="vag-voice-select" style="width:100%;padding:9px 11px;border-radius:12px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:12px;font-weight:800;color:#1c1c1e;">
                  ${_voiceOptionsHtml('gemini-Kore')}
                </select>
              </label>
              <div style="display:flex;gap:6px;margin-bottom:12px;">
                <select id="vag-preset-select" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);font-size:11px;font-weight:700;color:#1c1c1e;">
                  <option value="">⭐ 즐겨찾기 설정</option>
                </select>
                <button onclick="vagSavePreset()" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(255,140,0,0.2);background:#fff;font-size:11px;font-weight:800;color:#ff8c00;cursor:pointer;">저장</button>
                <button onclick="vagLoadPreset()" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:11px;font-weight:800;color:#1c1c1e;cursor:pointer;">적용</button>
              </div>
              <div id="vag-text-edit-list" style="display:flex;flex-direction:column;gap:10px;max-height:520px;overflow:auto;padding-right:4px;"></div>
            </div>

          </div>
        </div>
      </div>`;
    // 목소리 선택 즉시 hidden input 동기화
    var voiceSel = document.getElementById('vag-voice-select');
    var voiceHid = document.getElementById('vag-voice');
    if (voiceSel && voiceHid) {
      voiceSel.addEventListener('change', function() { voiceHid.value = voiceSel.value; });
    }
    // vag-copy-code 버튼은 onclick 인라인 대신 addEventListener 로 등록 (기존 동작 유지)
    var copyBtn = document.getElementById('vag-copy-code');
    if (copyBtn && typeof window.vagCopyCode === 'function') {
      copyBtn.addEventListener('click', window.vagCopyCode);
    }
  }

  function _stageCardHtml(step, n, badge, title, detail) {
    return (
      `<div id="vag-stage-${step}" class="vag-stage-card" style="position:relative;border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:12px 12px 12px 16px;display:flex;flex-direction:column;min-height:108px;background:linear-gradient(180deg,#ffffff 0%, rgba(120,120,128,0.04) 100%);overflow:hidden;transition:transform 0.25s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.25s ease, border-color 0.25s ease;">
        <div data-vag-stage-strip style="position:absolute;left:0;top:0;bottom:0;width:4px;background:rgba(0,0,0,0.06);transition:background 0.25s ease;"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <div data-vag-stage-order style="position:relative;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.42);font-size:14px;font-weight:950;letter-spacing:-0.02em;transition:background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);flex-shrink:0;">${n}</div>
            <div data-vag-stage-badge style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.48);font-size:10px;font-weight:900;letter-spacing:0.02em;transition:background 0.25s ease, color 0.25s ease;white-space:nowrap;">${badge}</div>
          </div>
          <div data-vag-stage-status style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,0.04);color:rgba(0,0,0,0.42);font-size:10px;font-weight:900;transition:background 0.25s ease, color 0.25s ease;white-space:nowrap;">
            <span data-vag-stage-dot style="width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,0.3);display:inline-block;transition:background 0.25s ease;"></span>
            <span data-vag-stage-status-label>대기</span>
          </div>
        </div>
        <div data-vag-stage-title style="font-size:13px;font-weight:900;color:#1c1c1e;margin-top:10px;line-height:1.35;letter-spacing:-0.01em;">${title}</div>
        <div data-vag-stage-detail-wrap style="margin-top:auto;padding-top:7px;border-top:1px solid rgba(0,0,0,0.05);transition:border-color 0.25s ease;">
          <div data-vag-stage-detail style="font-size:10.5px;color:rgba(0,0,0,0.5);line-height:1.45;">${detail}</div>
        </div>
      </div>`
    );
  }

  window._VAGLayout = Object.freeze({ render: render });

  // 영상 설정 즐겨찾기
  var PRESET_KEY = 'vag_presets';
  function _getPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); } catch { return []; } }
  function _savePresets(list) { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); }
  function _refreshPresetSelect() {
    var sel = document.getElementById('vag-preset-select');
    if (!sel) return;
    var presets = _getPresets();
    sel.innerHTML = '<option value="">⭐ 즐겨찾기 설정 (' + presets.length + '개)</option>' + presets.map(function(p, i) {
      return '<option value="' + i + '">' + (p.name || '설정 ' + (i+1)) + '</option>';
    }).join('');
  }
  window.vagSavePreset = function() {
    var name = prompt('즐겨찾기 이름을 입력하세요:');
    if (!name) return;
    var preset = {
      name: name,
      voice: (document.getElementById('vag-voice-select') || {}).value || '',
      bgImageModel: (document.getElementById('vag-bg-image-model') || {}).value || '',
      bgImageProvider: (document.getElementById('vag-bg-image-provider') || {}).value || '',
      aiBgVideoModel: (document.getElementById('vag-ai-bg-video-model') || {}).value || '',
      subtitle: (document.getElementById('vag-subtitle') || {}).value || '',
    };
    var presets = _getPresets();
    presets.push(preset);
    _savePresets(presets);
    _refreshPresetSelect();
    alert('저장 완료: ' + name);
  };
  window.vagLoadPreset = function() {
    var sel = document.getElementById('vag-preset-select');
    if (!sel || sel.value === '') return alert('즐겨찾기를 선택하세요.');
    var presets = _getPresets();
    var p = presets[parseInt(sel.value)];
    if (!p) return;
    if (p.voice) { var v = document.getElementById('vag-voice-select'); if (v) v.value = p.voice; var h = document.getElementById('vag-voice'); if (h) h.value = p.voice; }
    if (p.bgImageModel) { var m = document.getElementById('vag-bg-image-model'); if (m) m.value = p.bgImageModel; }
    if (p.bgImageProvider) { var pr = document.getElementById('vag-bg-image-provider'); if (pr) pr.value = p.bgImageProvider; }
    if (p.aiBgVideoModel) { var av = document.getElementById('vag-ai-bg-video-model'); if (av) av.value = p.aiBgVideoModel; }
    alert('설정 적용: ' + p.name);
  };
  setTimeout(_refreshPresetSelect, 500);
})();
