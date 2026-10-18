(function () {
  'use strict';

  let ready = false;
  let templates = [];
  let currentTemplate = null;
  let currentHtml = '';
  let currentWidth = 1080;
  let currentHeight = 1920;
  let currentDuration = 6;
  let currentId = '';
  let currentName = '';
  let savedList = [];
  let recorder = null;
  let recordChunks = [];
  let agentThread = [];
  let agentMode = 'create';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => {
    const d = document.createElement('div');
    d.textContent = v == null ? '' : String(v);
    return d.innerHTML;
  };
  const toastMsg = (msg, tone) => {
    try { if (typeof window.toast === 'function') window.toast(msg, tone || ''); } catch {}
  };

  function setStatus(msg, tone) {
    const el = $('hf-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    const color = tone === 'error'
      ? 'color:#ff3b30;background:rgba(255,59,48,.08);border-color:rgba(255,59,48,.16);'
      : tone === 'success'
        ? 'color:#34c759;background:rgba(52,199,89,.08);border-color:rgba(52,199,89,.16);'
        : 'color:#ff8c00;background:rgba(255,140,0,.08);border-color:rgba(255,140,0,.16);';
    el.style.cssText = 'display:block;padding:8px 11px;border:1px solid transparent;border-radius:10px;font-size:11px;font-weight:700;margin-top:8px;' + color;
    el.textContent = msg;
  }

  async function ensurePlayerLoaded() {
    if (window.customElements && window.customElements.get('hyperframes-player')) return;
    await new Promise((resolve, reject) => {
      const existing = document.getElementById('hf-player-script');
      if (existing) { existing.addEventListener('load', resolve); existing.addEventListener('error', reject); return; }
      const s = document.createElement('script');
      s.id = 'hf-player-script';
      s.src = '/api/hyperframes/vendor/player.global.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    // The global bundle exposes HyperframesPlayer on window but doesn't auto-register the custom element.
    if (window.customElements && !window.customElements.get('hyperframes-player')) {
      const Cls = window.HyperframesPlayer && window.HyperframesPlayer.HyperframesPlayer
        ? window.HyperframesPlayer.HyperframesPlayer
        : null;
      if (Cls) {
        try { window.customElements.define('hyperframes-player', Cls); } catch {}
      }
    }
  }

  function layout() {
    const root = $('hyperframes-root');
    if (!root) return;
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="card" style="padding:16px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="font-size:15px;font-weight:900;color:#1c1c1e;">영상 스튜디오</div>
                <span id="hf-studio-project-badge" style="display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:rgba(255,140,0,.10);color:#ff8c00;font-size:10px;font-weight:800;">기본 프로젝트</span>
              </div>
              <div id="hf-studio-profile" style="font-size:11px;color:rgba(0,0,0,.46);margin-top:4px;line-height:1.5;">저장된 쇼츠 프로젝트를 공식 스튜디오에서 바로 이어서 편집할 수 있습니다.</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button id="hf-studio-current" type="button" style="padding:7px 11px;font-size:11px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:8px;cursor:pointer;font-weight:800;">현재 작업 열기</button>
              <button id="hf-studio-refresh" type="button" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;font-weight:700;">새로고침</button>
              <button id="hf-studio-tab" type="button" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;font-weight:700;">새 탭</button>
            </div>
          </div>
          <div style="font-size:11px;color:rgba(0,0,0,.48);line-height:1.7;margin-bottom:10px;">
            빠른 생성기에서 저장한 컴포지션은 프로젝트로 동기화되고, 이 스튜디오에서 코드·타임라인·에셋 편집을 이어서 할 수 있습니다.
          </div>
          <iframe
            id="hf-studio-frame"
            src="/api/hyperframes/studio"
            title="영상 스튜디오"
            style="width:100%;height:760px;border:1px solid rgba(0,0,0,.08);border-radius:18px;background:#0f172a;"
          ></iframe>
        </div>

        <div style="display:grid;grid-template-columns:300px 1fr 360px;gap:14px;align-items:start;">
          <div style="display:flex;flex-direction:column;gap:12px;min-width:0;">
            <div class="card" style="padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                <div style="font-size:13px;font-weight:800;">템플릿</div>
                <button id="hf-reload-tpl" type="button" style="padding:4px 9px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:7px;cursor:pointer;font-weight:600;">새로고침</button>
              </div>
              <div id="hf-template-list" style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;"></div>
            </div>

            <div class="card" style="padding:14px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;">저장된 컴포지션</div>
              <div id="hf-saved-list" style="display:flex;flex-direction:column;gap:5px;max-height:220px;overflow:auto;"></div>
            </div>

            <div class="card" style="padding:14px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;">내보낸 영상</div>
              <div id="hf-outputs" style="display:flex;flex-direction:column;gap:5px;max-height:180px;overflow:auto;"></div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;min-width:0;">
            <div class="card" style="padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                <div>
                  <div style="font-size:13px;font-weight:800;">미리보기</div>
                  <div style="font-size:10px;color:rgba(0,0,0,.45);margin-top:2px;">data-start / data-duration / data-track-index 속성을 해석합니다.</div>
                </div>
                <div id="hf-size-badge" style="font-size:10px;font-weight:700;color:rgba(0,0,0,.5);padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.05);">1080 × 1920 · 6.0s</div>
              </div>
              <div id="hf-player-wrap" style="position:relative;background:#000;border-radius:10px;overflow:hidden;max-height:420px;display:flex;justify-content:center;align-items:center;">
                <hyperframes-player id="hf-player" controls style="width:100%;height:420px;display:block;background:#000;"></hyperframes-player>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap;">
                <button type="button" onclick="hfApplyEditor()" style="padding:7px 11px;font-size:11px;border:1px solid rgba(255,140,0,.2);background:rgba(255,140,0,.08);color:#ff8c00;border-radius:8px;cursor:pointer;font-weight:700;">에디터 반영</button>
                <button type="button" onclick="hfSave()" style="padding:7px 11px;font-size:11px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border-radius:8px;cursor:pointer;font-weight:800;">저장</button>
                <button id="hf-record" type="button" onclick="hfToggleRecord()" style="padding:7px 11px;font-size:11px;border:none;background:#ff3b30;color:#fff;border-radius:8px;cursor:pointer;font-weight:800;" title="브라우저 내 MediaRecorder 로 즉시 녹화">● 녹화</button>
                <button id="hf-native-render" type="button" onclick="hfRenderNative()" style="padding:7px 11px;font-size:11px;border:none;background:#1c1c1e;color:#fff;border-radius:8px;cursor:pointer;font-weight:800;" title="공식 hyperframes CLI (Puppeteer+FFmpeg) 로 정확한 MP4 렌더">🎬 공식 MP4</button>
                <label style="display:flex;align-items:center;gap:4px;font-size:10px;color:rgba(0,0,0,.5);font-weight:600;cursor:pointer;">
                  <input id="hf-to-mp4" type="checkbox" checked style="accent-color:#ff8c00;"> MP4 변환
                </label>
                <div style="flex:1;"></div>
              </div>
              <div id="hf-status"></div>
            </div>

            <details class="card" style="padding:14px;" id="hf-advanced-card">
              <summary style="font-size:13px;font-weight:800;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                <span>⚙️ 고급 · HTML 직접 편집</span>
                <span style="font-size:10px;color:rgba(0,0,0,.45);font-weight:600;">펼치기 / 접기</span>
              </summary>
              <div style="margin-top:10px;">
                <div style="font-size:10px;color:rgba(0,0,0,.5);margin-bottom:6px;">영상 규약(data-start/duration/track-index)을 지켜 주세요. 수정 후 <b>에디터 반영</b>.</div>
                <textarea id="hf-html" spellcheck="false" style="width:100%;height:260px;padding:10px;border:1px solid rgba(0,0,0,.08);border-radius:10px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:11px;background:#fafafa;resize:vertical;line-height:1.5;"></textarea>
              </div>
            </details>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px;min-width:0;">
            <div class="card" style="padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div style="display:flex;gap:10px;min-width:0;">
                  <div id="hf-profile-avatar" style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,rgba(255,140,0,.14),rgba(255,107,0,.08));display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ff8c00;font-size:18px;font-weight:900;">HF</div>
                  <div style="min-width:0;">
                    <div id="hf-profile-name" style="font-size:14px;font-weight:800;color:#1c1c1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">브랜드 프로필 미선택</div>
                    <div id="hf-profile-meta" style="font-size:11px;color:rgba(0,0,0,.48);line-height:1.6;margin-top:4px;">프로필을 고르면 말투, CTA, 브랜드 설명을 쇼츠공장 에이전트가 기본값으로 이어받습니다.</div>
                  </div>
                </div>
                <button id="hf-pick-profile" type="button" style="padding:7px 10px;font-size:10px;border:1px solid rgba(255,140,0,.16);background:rgba(255,140,0,.08);color:#ff8c00;border-radius:8px;cursor:pointer;font-weight:700;white-space:nowrap;">프로필 선택</button>
              </div>
              <div id="hf-profile-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;"></div>
              <div id="hf-agent-brief-summary" style="margin-top:10px;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,.04);font-size:10px;color:rgba(0,0,0,.58);line-height:1.6;">현재 브리프 요약을 불러오는 중...</div>
            </div>

            <div class="card" style="padding:14px;background:linear-gradient(180deg,#fff8ef,#fff);border:1px solid rgba(255,140,0,.18);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
                <div>
                  <div style="font-size:13px;font-weight:900;color:#ff6b00;">에이전트 쇼츠 메이커</div>
                  <div id="hf-agent-helper" style="font-size:10px;color:rgba(0,0,0,.48);line-height:1.6;margin-top:4px;">한 문장으로 요청하면 시안을 만들거나, 현재 화면을 이어서 수정합니다.</div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button type="button" data-hf-agent-mode="create" style="padding:6px 9px;font-size:10px;border-radius:999px;border:1px solid rgba(255,140,0,.18);background:rgba(255,140,0,.10);color:#ff8c00;font-weight:800;cursor:pointer;">새로 만들기</button>
                  <button type="button" data-hf-agent-mode="edit" style="padding:6px 9px;font-size:10px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;color:rgba(0,0,0,.58);font-weight:700;cursor:pointer;">현재 시안 수정</button>
                </div>
              </div>

              <div id="hf-agent-thread" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;padding:4px 2px 6px;"></div>

              <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px;">
                <button type="button" data-hf-agent-chip="프로필 기준으로 9:16 쇼츠 첫 시안을 만들어줘" data-hf-agent-chip-mode="create" style="padding:5px 8px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:999px;cursor:pointer;font-weight:600;">프로필 첫 시안</button>
                <button type="button" data-hf-agent-chip="후기 강조형 버전으로 다시 만들어줘" data-hf-agent-chip-mode="create" style="padding:5px 8px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:999px;cursor:pointer;font-weight:600;">후기 강조형</button>
                <button type="button" data-hf-agent-chip="CTA를 더 세게 바꿔줘" data-hf-agent-chip-mode="edit" style="padding:5px 8px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:999px;cursor:pointer;font-weight:600;">CTA 강화</button>
                <button type="button" data-hf-agent-chip="고급스럽고 차분한 톤으로 다듬어줘" data-hf-agent-chip-mode="edit" style="padding:5px 8px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:999px;cursor:pointer;font-weight:600;">프리미엄 톤</button>
              </div>

              <textarea id="hf-agent-input" rows="4" placeholder="예: 강남 치과 프로필 기준으로 임플란트 상담 예약 유도용 15초 쇼츠 만들어줘. 혜택 숫자를 크게 보여주고 마지막 CTA는 '지금 상담 예약'으로." style="width:100%;padding:11px 12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;font-size:12px;background:#fff;resize:vertical;line-height:1.55;"></textarea>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
                <div style="font-size:10px;color:rgba(0,0,0,.45);line-height:1.5;"><code style="background:rgba(0,0,0,.05);padding:0 4px;border-radius:4px;">Ctrl</code> + <code style="background:rgba(0,0,0,.05);padding:0 4px;border-radius:4px;">Enter</code> 로 실행. 브리프 직접 제어를 열면 목표·톤·비율도 함께 지정할 수 있습니다.</div>
                <button id="hf-agent-send" type="button" style="padding:10px 14px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;">요청 보내기</button>
              </div>
            </div>

            <div class="card" style="padding:14px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;">컴포지션 설정</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <label style="font-size:10px;color:rgba(0,0,0,.5);font-weight:600;grid-column:1/3;">이름
                  <input id="hf-name" type="text" placeholder="컴포지션 이름" style="width:100%;margin-top:3px;padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                </label>
                <label style="font-size:10px;color:rgba(0,0,0,.5);font-weight:600;">가로 (px)
                  <input id="hf-width" type="number" step="1" min="16" max="7680" style="width:100%;margin-top:3px;padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                </label>
                <label style="font-size:10px;color:rgba(0,0,0,.5);font-weight:600;">세로 (px)
                  <input id="hf-height" type="number" step="1" min="16" max="7680" style="width:100%;margin-top:3px;padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                </label>
                <label style="font-size:10px;color:rgba(0,0,0,.5);font-weight:600;grid-column:1/3;">길이 (초)
                  <input id="hf-duration" type="number" step="0.5" min="1" max="600" style="width:100%;margin-top:3px;padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                </label>
              </div>
            </div>

            <details class="card" style="padding:14px;" id="hf-brief-card">
              <summary style="font-size:13px;font-weight:800;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;">
                <span>브리프 직접 제어</span>
                <span style="font-size:10px;color:rgba(0,0,0,.45);font-weight:600;">목표 · 톤 · 메시지</span>
              </summary>
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
                <input id="hf-ai-brand" type="text" placeholder="브랜드 (예: 마케케)" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                <input id="hf-ai-product" type="text" placeholder="제품·캠페인 이름" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                <select id="hf-ai-goal" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                  <option value="신상 출시">🚀 신상 출시</option>
                  <option value="세일/할인 알림">⚡ 세일/할인 알림</option>
                  <option value="쿠폰/프로모션">🎟 쿠폰/프로모션</option>
                  <option value="이벤트/캠페인">🗓 이벤트/캠페인</option>
                  <option value="고객 후기">⭐ 고객 후기</option>
                  <option value="브랜드 소개">🏷 브랜드 소개</option>
                  <option value="특장점 소개">✅ 특장점 소개</option>
                  <option value="Q&A/FAQ 해소">❓ Q&A / FAQ</option>
                  <option value="데이터 증명">📊 데이터 증명</option>
                  <option value="콜투액션 (CTA)">📣 콜투액션</option>
                </select>
                <select id="hf-ai-tone" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                  <option value="감성">감성적 · 이야기형</option>
                  <option value="직설">직설 · 단도직입</option>
                  <option value="유머">유쾌 · 유머</option>
                  <option value="정보">정보 · 전문적</option>
                  <option value="고급">고급 · 프리미엄</option>
                  <option value="트렌디">트렌디 · Z세대</option>
                </select>
                <select id="hf-ai-aspect" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                  <option value="9:16">9:16 (쇼츠·릴스·스토리)</option>
                  <option value="16:9">16:9 (유튜브·광고)</option>
                  <option value="1:1">1:1 (인스타 피드)</option>
                </select>
                <input id="hf-ai-duration" type="number" min="3" max="60" step="1" value="8" placeholder="영상 길이(초)" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                <textarea id="hf-ai-points" placeholder="핵심 메시지 (줄바꿈으로 구분, 예: 50% 할인 / 48시간 한정 / 무료배송)" rows="3" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;resize:vertical;"></textarea>
                <input id="hf-ai-cta" type="text" placeholder="CTA 문구 (예: 지금 구매하기)" style="padding:7px 10px;border:1px solid rgba(0,0,0,.08);border-radius:8px;font-size:11px;background:#fff;">
                <button id="hf-ai-go" type="button" onclick="hfAiGenerate()" style="padding:10px 12px;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer;">브리프만으로 생성</button>
              </div>
            </details>

            <div class="card" style="padding:14px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;">자주 쓰는 조각</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <button type="button" onclick="hfInsertSnippet('title')" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;text-align:left;">+ 타이틀 (페이드)</button>
                <button type="button" onclick="hfInsertSnippet('lower-third')" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;text-align:left;">+ 하단 바 (lower third)</button>
                <button type="button" onclick="hfInsertSnippet('cta-badge')" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;text-align:left;">+ CTA 뱃지</button>
                <button type="button" onclick="hfInsertSnippet('bg-gradient')" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;text-align:left;">+ 그라데이션 배경</button>
                <button type="button" onclick="hfInsertSnippet('card-slide')" style="padding:7px 11px;font-size:11px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:8px;cursor:pointer;text-align:left;">+ 카드 슬라이드</button>
              </div>
            </div>

            <div class="card" style="padding:14px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:8px;">도움말</div>
              <div style="font-size:11px;line-height:1.7;color:rgba(0,0,0,.6);">
                · <b>data-start</b> · 시작 초<br>
                · <b>data-duration</b> · 노출 길이<br>
                · <b>data-track-index</b> · 0=배경, 클수록 위<br>
                · 공식 <code style="background:rgba(0,0,0,.05);padding:0 4px;border-radius:4px;">hyperframes-player</code> 로 표시<br>
                · 녹화: 미리보기 화면을 WebM 으로 저장
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    $('hf-reload-tpl').addEventListener('click', loadTemplates);
    $('hf-studio-current').addEventListener('click', hfOpenStudioCurrent);
    $('hf-studio-refresh').addEventListener('click', () => hfStudioRefresh());
    $('hf-studio-tab').addEventListener('click', () => hfStudioOpenTab());
    $('hf-pick-profile').addEventListener('click', () => {
      if (typeof window.openProfilePickerModal === 'function') {
        window.openProfilePickerModal();
      }
    });
    const htmlTa = $('hf-html');
    if (htmlTa) htmlTa.addEventListener('input', () => { currentHtml = htmlTa.value; });
    $('hf-name').addEventListener('input', () => { currentName = $('hf-name').value; });
    $('hf-width').addEventListener('input', () => { currentWidth = parseInt($('hf-width').value || '1080', 10) || 1080; applyPlayerAttrs(); syncAgentPanels(); });
    $('hf-height').addEventListener('input', () => { currentHeight = parseInt($('hf-height').value || '1920', 10) || 1920; applyPlayerAttrs(); syncAgentPanels(); });
    $('hf-duration').addEventListener('input', () => { currentDuration = parseFloat($('hf-duration').value || '6') || 6; updateBadge(); syncAgentPanels(); });
    ['hf-ai-brand', 'hf-ai-product', 'hf-ai-goal', 'hf-ai-tone', 'hf-ai-aspect', 'hf-ai-duration', 'hf-ai-points', 'hf-ai-cta'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', syncAgentPanels);
      el.addEventListener('change', syncAgentPanels);
    });
    document.querySelectorAll('[data-hf-agent-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setAgentMode(btn.getAttribute('data-hf-agent-mode') || 'create'));
    });
    document.querySelectorAll('[data-hf-agent-chip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-hf-agent-chip-mode') || 'create';
        setAgentMode(mode);
        const prompt = btn.getAttribute('data-hf-agent-chip') || '';
        const inp = $('hf-agent-input');
        if (inp) {
          inp.value = prompt;
          inp.focus();
          inp.selectionStart = inp.selectionEnd = inp.value.length;
        }
      });
    });
    $('hf-agent-send').addEventListener('click', () => hfAgentRun());
    const agentInput = $('hf-agent-input');
    if (agentInput) {
      agentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          hfAgentRun();
        }
      });
    }
    hydrateBriefFromProfile();
    seedAgentThread();
    syncAgentPanels();
  }

  function updateBadge() {
    const badge = $('hf-size-badge');
    if (!badge) return;
    badge.textContent = `${currentWidth} × ${currentHeight} · ${Number(currentDuration).toFixed(1)}s`;
  }

  function studioUrl(projectId) {
    const base = '/api/hyperframes/studio';
    return projectId ? `${base}#project/${encodeURIComponent(projectId)}` : base;
  }

  function updateStudioMeta() {
    const badge = $('hf-studio-project-badge');
    if (badge) {
      badge.textContent = currentId ? `프로젝트: ${currentId}` : '기본 프로젝트';
    }
    const profileEl = $('hf-studio-profile');
    if (!profileEl) return;
    const profileName = window._globalProfileData?.name || '';
    if (currentId && profileName) {
      profileEl.textContent = `${profileName} 프로필 기준 작업입니다. 저장한 컴포지션은 ${currentId} 프로젝트로 동기화됩니다.`;
      return;
    }
    if (currentId) {
      profileEl.textContent = `저장한 컴포지션은 ${currentId} 프로젝트로 동기화됩니다.`;
      return;
    }
    if (profileName) {
      profileEl.textContent = `${profileName} 프로필을 기준으로 빠르게 만들고, 저장 후 공식 Studio에서 세부 편집을 이어갈 수 있습니다.`;
      return;
    }
    profileEl.textContent = '빠른 생성기에서 저장한 컴포지션은 프로젝트로 동기화되고, 이 스튜디오에서 코드·타임라인·에셋 편집을 이어서 할 수 있습니다.';
  }

  function currentProfile() {
    return window._globalProfileData || null;
  }

  function currentProfileId() {
    return parseInt(window._globalProfileId || currentProfile()?.id || 0, 10) || null;
  }

  function briefValue(id, fallback = '') {
    const el = $(id);
    return el ? String(el.value || '').trim() : fallback;
  }

  function briefPoints() {
    return briefValue('hf-ai-points')
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function hydrateBriefFromProfile() {
    const profile = currentProfile();
    if (!profile) {
      syncAgentPanels();
      return;
    }
    const brand = $('hf-ai-brand');
    const product = $('hf-ai-product');
    const cta = $('hf-ai-cta');
    const points = $('hf-ai-points');
    if (brand && !brand.value.trim() && profile.name) brand.value = profile.name;
    if (product && !product.value.trim() && profile.description) product.value = String(profile.description).trim().slice(0, 48);
    if (cta && !cta.value.trim() && profile.cta_text) cta.value = profile.cta_text;
    if (points && !points.value.trim() && profile.keywords) {
      const items = String(profile.keywords)
        .split(/[,\n/|]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (items.length) points.value = items.join('\n');
    }
    syncAgentPanels();
  }

  function renderAgentThread() {
    const host = $('hf-agent-thread');
    if (!host) return;
    host.innerHTML = agentThread.map((msg) => {
      const isUser = msg.role === 'user';
      const align = isUser ? 'flex-end' : 'flex-start';
      const bubbleBg = isUser ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
      const bubbleColor = isUser ? '#fff' : '#1c1c1e';
      const metaColor = isUser ? 'rgba(255,255,255,.72)' : 'rgba(0,0,0,.42)';
      return `
        <div style="display:flex;justify-content:${align};">
          <div style="max-width:92%;padding:10px 11px;border-radius:14px;background:${bubbleBg};color:${bubbleColor};border:${isUser ? 'none' : '1px solid rgba(0,0,0,.06)'};box-shadow:${isUser ? '0 10px 24px rgba(255,140,0,.18)' : 'none'};">
            <div style="font-size:10px;font-weight:800;opacity:${isUser ? '.78' : '.58'};margin-bottom:4px;">${isUser ? '나' : '에이전트'}</div>
            <div style="font-size:12px;line-height:1.6;">${esc(msg.text).replace(/\n/g, '<br>')}</div>
            ${msg.meta ? `<div style="font-size:10px;color:${metaColor};margin-top:6px;line-height:1.5;">${esc(msg.meta)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  function pushAgentMessage(role, text, meta = '') {
    if (!String(text || '').trim()) return;
    agentThread.push({ role, text: String(text).trim(), meta: String(meta || '').trim() });
    if (agentThread.length > 16) agentThread = agentThread.slice(-16);
    renderAgentThread();
  }

  function seedAgentThread() {
    if (agentThread.length) return;
    const profile = currentProfile();
    if (profile?.name) {
      pushAgentMessage('assistant', `${profile.name} 프로필을 기준으로 쇼츠 시안을 바로 만들 수 있어요. 한 줄로 요청하면 코드 컴포지션을 만들고, 마음에 안 들면 같은 대화에서 계속 수정할 수 있습니다.`, profile.business_type ? `업종 ${profile.business_type}` : '프로필 컨텍스트 연결됨');
      return;
    }
    pushAgentMessage('assistant', '프로필 없이도 만들 수 있지만, 프로필을 선택해 두면 브랜드 설명·CTA·키워드를 기본값으로 바로 이어받습니다.', '프로필을 고르면 더 빠르게 브랜드 톤이 맞춰집니다.');
  }

  function setAgentMode(mode) {
    agentMode = mode === 'edit' ? 'edit' : 'create';
    document.querySelectorAll('[data-hf-agent-mode]').forEach((btn) => {
      const active = btn.getAttribute('data-hf-agent-mode') === agentMode;
      btn.style.border = active ? '1px solid rgba(255,140,0,.18)' : '1px solid rgba(0,0,0,.08)';
      btn.style.background = active ? 'rgba(255,140,0,.10)' : '#fff';
      btn.style.color = active ? '#ff8c00' : 'rgba(0,0,0,.58)';
      btn.style.fontWeight = active ? '800' : '700';
    });
    syncAgentPanels();
  }

  function syncAgentPanels() {
    updateStudioMeta();
    const profile = currentProfile();
    const profileId = currentProfileId();
    const avatar = $('hf-profile-avatar');
    const nameEl = $('hf-profile-name');
    const metaEl = $('hf-profile-meta');
    const tags = $('hf-profile-tags');
    const summary = $('hf-agent-brief-summary');
    const helper = $('hf-agent-helper');
    if (avatar) {
      if (profileId) {
        avatar.innerHTML = `<img src="/api/library/profiles/${profileId}/logo" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" onerror="this.parentNode.textContent='HF';">`;
      } else {
        avatar.textContent = 'HF';
      }
    }
    if (nameEl) {
      nameEl.textContent = profile?.name ? profile.name : '브랜드 프로필 미선택';
    }
    if (metaEl) {
      if (profile?.name) {
        const metaBits = [profile.business_type || '', profile.business_goal || '', profile.description || '']
          .filter(Boolean)
          .join(' · ');
        metaEl.textContent = metaBits || '선택된 프로필의 설명과 CTA를 쇼츠공장 에이전트가 바로 이어받습니다.';
      } else {
        metaEl.textContent = '프로필을 고르면 말투, CTA, 브랜드 설명을 쇼츠공장 에이전트가 기본값으로 이어받습니다.';
      }
    }
    if (tags) {
      const items = [];
      if (profile?.business_type) items.push(profile.business_type);
      if (profile?.tone) items.push(`톤 ${profile.tone}`);
      if (profile?.brand_color) items.push(`컬러 ${profile.brand_color}`);
      if (profile?.cta_text) items.push(`CTA ${profile.cta_text}`);
      tags.innerHTML = items.length
        ? items.slice(0, 4).map((item) => `<span style="padding:5px 8px;border-radius:999px;background:rgba(255,140,0,.08);color:#ff8c00;font-size:10px;font-weight:700;">${esc(item)}</span>`).join('')
        : '<span style="padding:5px 8px;border-radius:999px;background:rgba(0,0,0,.05);color:rgba(0,0,0,.45);font-size:10px;font-weight:700;">프로필 없이 수동 브리프로 생성</span>';
    }
    if (summary) {
      const goal = briefValue('hf-ai-goal', '신상 출시');
      const tone = briefValue('hf-ai-tone', '감성');
      const aspect = briefValue('hf-ai-aspect', '9:16');
      const duration = briefValue('hf-ai-duration', '8');
      const brand = briefValue('hf-ai-brand', profile?.name || '');
      const cta = briefValue('hf-ai-cta', profile?.cta_text || '');
      const points = briefPoints();
      const bits = [
        brand ? `브랜드 ${brand}` : '브랜드 자유 입력',
        `목표 ${goal}`,
        `톤 ${tone}`,
        `비율 ${aspect}`,
        `${duration || 8}초`,
        points.length ? `핵심 ${points.slice(0, 2).join(', ')}` : '',
        cta ? `CTA ${cta}` : '',
      ].filter(Boolean);
      summary.textContent = bits.join(' · ');
    }
    if (helper) {
      if (agentMode === 'edit') {
        helper.textContent = currentHtml
          ? '현재 미리보기를 기준으로 텍스트, 톤, CTA, 배치를 다시 다듬습니다.'
          : '아직 현재 시안이 없어서, 요청을 보내면 새 시안 생성으로 자동 전환됩니다.';
      } else {
        helper.textContent = profile?.name
          ? `${profile.name} 프로필을 기본값으로 사용합니다. 한 문장 요청에 브리프 값도 함께 녹여서 새 시안을 만듭니다.`
          : '한 문장 요청으로 새 시안을 만듭니다. 프로필을 고르면 브랜드 맥락까지 함께 들어갑니다.';
      }
    }
  }

  function buildFallbackAgentPrompt(mode) {
    const profile = currentProfile();
    const brand = briefValue('hf-ai-brand', profile?.name || '');
    const product = briefValue('hf-ai-product');
    const goal = briefValue('hf-ai-goal', '신상 출시');
    const tone = briefValue('hf-ai-tone', '감성');
    const aspect = briefValue('hf-ai-aspect', '9:16');
    const duration = briefValue('hf-ai-duration', '8');
    const cta = briefValue('hf-ai-cta', profile?.cta_text || '');
    const points = briefPoints();
    if (mode === 'edit' && currentHtml) {
      return `${tone} 톤을 유지하면서 ${goal} 목적에 더 맞게 다듬고 CTA는 "${cta || '지금 문의하기'}" 쪽으로 강화해줘.`;
    }
    const parts = [
      brand ? `${brand}용` : '',
      `${aspect} 비율`,
      `${duration || 8}초`,
      goal,
      tone ? `${tone} 톤` : '',
      product ? `${product} 중심` : '',
      points.length ? `핵심은 ${points.join(', ')}` : '',
      cta ? `마지막 CTA는 "${cta}"` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }

  function hfStudioRefresh(projectId) {
    const frame = $('hf-studio-frame');
    if (!frame) return;
    const target = studioUrl(projectId || currentId || '');
    frame.src = target;
    updateStudioMeta();
  }

  function hfStudioOpenTab() {
    window.open(studioUrl(currentId || ''), '_blank', 'noopener');
  }

  function hfOpenStudioCurrent() {
    if (!currentId) {
      setStatus('먼저 저장한 뒤 공식 Studio에서 여세요.', 'error');
      return;
    }
    hfStudioRefresh(currentId);
    toastMsg('공식 Studio로 현재 프로젝트를 열었습니다');
  }

  function applyPlayerAttrs() {
    const p = $('hf-player');
    if (!p) return;
    p.setAttribute('width', String(currentWidth));
    p.setAttribute('height', String(currentHeight));
    // Fit player height proportionally within max
    const wrap = $('hf-player-wrap');
    const availableW = wrap ? wrap.clientWidth : 800;
    const maxH = 460;
    const targetH = Math.min(maxH, Math.round(availableW * (currentHeight / currentWidth)));
    p.style.height = targetH + 'px';
    updateBadge();
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/hyperframes/templates');
      const data = await res.json();
      templates = Array.isArray(data?.items) ? data.items : [];
      renderTemplateList();
      if (!currentTemplate && templates.length) {
        applyTemplate(templates[0]);
      }
    } catch (err) {
      setStatus('템플릿 로드 실패: ' + err.message, 'error');
    }
  }

  function renderTemplateList() {
    const host = $('hf-template-list');
    if (!host) return;
    host.innerHTML = templates.map(t => `
      <button type="button" data-tid="${esc(t.id)}" class="hf-tpl-btn" style="text-align:left;padding:8px 10px;border:1px solid ${currentTemplate?.id === t.id ? 'rgba(255,140,0,.35)' : 'rgba(0,0,0,.08)'};background:${currentTemplate?.id === t.id ? 'rgba(255,140,0,.08)' : '#fff'};border-radius:8px;cursor:pointer;">
        <div style="font-size:12px;font-weight:700;color:#1c1c1e;">${esc(t.name)}</div>
        <div style="font-size:10px;color:rgba(0,0,0,.45);margin-top:2px;line-height:1.4;">${esc(t.description || '')}</div>
        <div style="font-size:9px;color:rgba(0,0,0,.35);margin-top:3px;">${t.width}×${t.height} · ${Number(t.duration || 6).toFixed(1)}s</div>
      </button>
    `).join('');
    host.querySelectorAll('.hf-tpl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-tid');
        const tpl = templates.find(t => t.id === tid);
        if (tpl) applyTemplate(tpl);
      });
    });
  }

  function applyTemplate(tpl) {
    currentTemplate = tpl;
    currentHtml = tpl.html || '';
    currentWidth = tpl.width || 1080;
    currentHeight = tpl.height || 1920;
    currentDuration = tpl.duration || 6;
    currentName = tpl.name;
    currentId = '';
    $('hf-name').value = currentName;
    $('hf-width').value = currentWidth;
    $('hf-height').value = currentHeight;
    $('hf-duration').value = currentDuration;
    $('hf-html').value = currentHtml;
    renderTemplateList();
    applyPlayerAttrs();
    syncAgentPanels();
    loadPreviewFromTemplate(tpl.id);
  }

  function loadPreviewFromTemplate(tid) {
    const p = $('hf-player');
    if (!p) return;
    p.setAttribute('src', `/api/hyperframes/view-template/${encodeURIComponent(tid)}?_=${Date.now()}`);
  }

  async function loadPreviewFromEditor() {
    // Save a preview to a temp URL by posting to /preview endpoint.
    try {
      const res = await fetch('/api/hyperframes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: $('hf-html').value, name: currentName }),
      });
      if (!res.ok) throw new Error('preview 실패');
      const blobUrl = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
      const p = $('hf-player');
      if (p) p.setAttribute('src', blobUrl);
    } catch (err) {
      setStatus('미리보기 실패: ' + err.message, 'error');
    }
  }

  function hfApplyEditor() {
    currentHtml = $('hf-html').value;
    currentName = $('hf-name').value || currentName;
    currentWidth = parseInt($('hf-width').value, 10) || currentWidth;
    currentHeight = parseInt($('hf-height').value, 10) || currentHeight;
    currentDuration = parseFloat($('hf-duration').value) || currentDuration;
    applyPlayerAttrs();
    syncAgentPanels();
    loadPreviewFromEditor();
    setStatus('미리보기에 반영했습니다.', 'success');
  }

  async function hfSave() {
    try {
      const payload = {
        id: currentId || null,
        name: currentName || ($('hf-name').value || '쇼츠공장 컴포지션'),
        html: $('hf-html').value,
        width: currentWidth,
        height: currentHeight,
        duration: currentDuration,
      };
      const res = await fetch('/api/hyperframes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.detail || '저장 실패');
      currentId = data.item?.id || currentId;
      syncAgentPanels();
      setStatus('저장했습니다: ' + (data.item?.name || currentId), 'success');
      toastMsg('컴포지션 저장 완료');
      await hfReloadSaved();
      // Switch preview to saved view
      const p = $('hf-player');
      if (p) p.setAttribute('src', `/api/hyperframes/view/${encodeURIComponent(currentId)}?_=${Date.now()}`);
      hfStudioRefresh(currentId);
      return data.item || null;
    } catch (err) {
      setStatus('저장 실패: ' + err.message, 'error');
      return null;
    }
  }

  async function hfReloadSaved() {
    try {
      const [listRes, outRes] = await Promise.all([
        fetch('/api/hyperframes/list'),
        fetch('/api/hyperframes/outputs'),
      ]);
      const list = await listRes.json();
      const outs = await outRes.json();
      savedList = Array.isArray(list?.items) ? list.items : [];
      renderSavedList();
      const outItems = Array.isArray(outs?.items) ? outs.items : [];
      renderOutputs(outItems);
    } catch (err) {
      setStatus('목록 로드 실패: ' + err.message, 'error');
    }
  }

  function renderSavedList() {
    const host = $('hf-saved-list');
    if (!host) return;
    if (!savedList.length) {
      host.innerHTML = '<div style="font-size:10px;color:rgba(0,0,0,.4);padding:8px;text-align:center;">저장된 컴포지션이 없습니다.</div>';
      return;
    }
    host.innerHTML = savedList.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 8px;border:1px solid rgba(0,0,0,.06);border-radius:8px;background:#fff;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:#1c1c1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.name || item.id)}</div>
          <div style="font-size:9px;color:rgba(0,0,0,.45);margin-top:1px;">${item.width}×${item.height} · ${Number(item.duration || 0).toFixed(1)}s</div>
        </div>
        <button data-load="${esc(item.id)}" type="button" style="padding:3px 7px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:6px;cursor:pointer;font-weight:600;">불러오기</button>
        <button data-del="${esc(item.id)}" type="button" style="padding:3px 7px;font-size:10px;border:1px solid rgba(255,59,48,.18);background:rgba(255,59,48,.06);color:#ff3b30;border-radius:6px;cursor:pointer;font-weight:600;">삭제</button>
      </div>
    `).join('');
    host.querySelectorAll('[data-load]').forEach(btn => {
      btn.addEventListener('click', () => hfLoad(btn.getAttribute('data-load')));
    });
    host.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => hfDelete(btn.getAttribute('data-del')));
    });
  }

  async function hfLoad(id) {
    try {
      const res = await fetch('/api/hyperframes/load/' + encodeURIComponent(id));
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.detail || '로드 실패');
      const it = data.item;
      currentId = it.id;
      currentName = it.name || it.id;
      currentHtml = it.html || '';
      currentWidth = it.width || 1080;
      currentHeight = it.height || 1920;
      currentDuration = it.duration || 6;
      $('hf-name').value = currentName;
      $('hf-width').value = currentWidth;
      $('hf-height').value = currentHeight;
      $('hf-duration').value = currentDuration;
      $('hf-html').value = currentHtml;
      currentTemplate = null;
      renderTemplateList();
      applyPlayerAttrs();
      syncAgentPanels();
      const p = $('hf-player');
      if (p) p.setAttribute('src', `/api/hyperframes/view/${encodeURIComponent(currentId)}?_=${Date.now()}`);
      hfStudioRefresh(currentId);
      setStatus('불러왔습니다: ' + currentName, 'success');
      return it;
    } catch (err) {
      setStatus('로드 실패: ' + err.message, 'error');
      return null;
    }
  }

  async function hfDelete(id) {
    if (!confirm('이 컴포지션을 삭제할까요?')) return;
    try {
      const res = await fetch('/api/hyperframes/delete/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!res.ok) throw new Error('삭제 실패');
      if (currentId === id) {
        currentId = '';
        syncAgentPanels();
        hfStudioRefresh();
      }
      toastMsg('삭제했습니다');
      await hfReloadSaved();
    } catch (err) {
      setStatus('삭제 실패: ' + err.message, 'error');
    }
  }

  function renderOutputs(items) {
    const host = $('hf-outputs');
    if (!host) return;
    if (!items.length) {
      host.innerHTML = '<div style="font-size:10px;color:rgba(0,0,0,.4);padding:8px;text-align:center;">아직 내보낸 영상이 없습니다.</div>';
      return;
    }
    host.innerHTML = items.map(it => {
      const isWebm = /\.webm$/i.test(it.name);
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:6px 8px;border:1px solid rgba(0,0,0,.06);border-radius:8px;background:#fff;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:#1c1c1e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(it.name)}</div>
          <div style="font-size:9px;color:rgba(0,0,0,.45);margin-top:1px;">${(it.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        ${isWebm ? `<button data-mp4="${esc(it.name)}" type="button" style="padding:3px 7px;font-size:10px;border:1px solid rgba(255,140,0,.25);background:rgba(255,140,0,.08);color:#ff6b00;border-radius:6px;cursor:pointer;font-weight:700;">MP4</button>` : ''}
        <a href="${esc(it.url)}" target="_blank" rel="noopener" style="padding:3px 7px;font-size:10px;border:1px solid rgba(0,0,0,.08);background:#fff;border-radius:6px;text-decoration:none;color:rgba(0,0,0,.7);font-weight:600;">열기</a>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-mp4]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-mp4');
        btn.disabled = true;
        btn.textContent = '변환중...';
        try {
          const res = await fetch('/api/hyperframes/convert-mp4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) throw new Error(data?.detail || 'MP4 변환 실패');
          toastMsg('MP4 변환 완료');
          await hfReloadSaved();
        } catch (err) {
          setStatus('MP4 변환 실패: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'MP4';
        }
      });
    });
  }

  async function hfRenderNative() {
    const btn = $('hf-native-render');
    if (!btn) return;
    const html = $('hf-html') ? $('hf-html').value : currentHtml;
    if (!html) { setStatus('렌더할 컴포지션이 없습니다. 템플릿을 선택하거나 AI로 생성하세요.', 'error'); return; }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '렌더중...';
    setStatus('공식 hyperframes 로 MP4 렌더 중... (수십초~수 분 소요)', 'info');
    try {
      const res = await fetch('/api/hyperframes/render-native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentId || null,
          html: currentId ? null : html,
          name: currentName || null,
          fps: 30,
          quality: 'standard',
          format: 'mp4',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.detail || '렌더 실패');
      setStatus('MP4 완성: ' + data.name + ' (' + (data.size / 1024 / 1024).toFixed(2) + ' MB)', 'success');
      toastMsg('공식 MP4 렌더 완료 🎬');
      await hfReloadSaved();
    } catch (err) {
      setStatus('공식 렌더 실패: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function hfAiEdit(instructionOverride, opts = {}) {
    const instr = String(instructionOverride || '').trim();
    const statusPrefix = opts.statusPrefix || 'AI가 수정하고 있습니다...';
    if (!instr) { setStatus('수정 요청 문구를 입력해 주세요.', 'error'); return null; }
    const html = $('hf-html') ? $('hf-html').value : currentHtml;
    if (!html) { setStatus('먼저 템플릿을 선택해 주세요.', 'error'); return null; }
    const btn = $('hf-agent-send');
    const original = btn ? btn.textContent : '';
    if (btn && !opts.keepButtonText) {
      btn.disabled = true;
      btn.textContent = '수정중...';
    }
    setStatus(statusPrefix, 'info');
    try {
      const res = await fetch('/api/hyperframes/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          instruction: instr,
          width: currentWidth,
          height: currentHeight,
          duration: currentDuration,
          profile_id: parseInt(window._globalProfileId || 0, 10) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.detail || 'AI 수정 실패');
      currentHtml = data.html || html;
      if ($('hf-html')) $('hf-html').value = currentHtml;
      await loadPreviewFromEditor();
      syncAgentPanels();
      setStatus('수정 완료. 마음에 들면 저장하세요.', 'success');
      toastMsg('AI가 수정했습니다 ✨');
      return { html: currentHtml };
    } catch (err) {
      setStatus('AI 수정 실패: ' + err.message, 'error');
      return null;
    } finally {
      if (btn && !opts.keepButtonText) {
        btn.disabled = false;
        btn.textContent = original || '요청 보내기';
      }
    }
  }

  async function hfAiGenerate(promptOverride, opts = {}) {
    const btn = $('hf-ai-go');
    if (!btn) return;
    const brand = briefValue('hf-ai-brand');
    const product = briefValue('hf-ai-product');
    const goal = briefValue('hf-ai-goal');
    const tone = briefValue('hf-ai-tone');
    const aspect = briefValue('hf-ai-aspect');
    const duration = parseFloat(briefValue('hf-ai-duration', '8') || '8') || 8;
    const key_points = briefPoints();
    const cta = briefValue('hf-ai-cta');
    const extras = String(promptOverride || '').trim();
    const profileId = currentProfileId();
    if (!brand && !product && !goal && !cta && !extras && !key_points.length && !profileId) {
      setStatus('브리프를 조금만 더 넣어 주세요. 한 문장 요청이나 프로필 선택만 있어도 생성할 수 있어요.', 'error');
      return null;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '생성 중...';
    setStatus(opts.statusPrefix || 'AI가 컴포지션을 짜고 있습니다... 보통 10~20초 걸려요.', 'info');
    try {
      const res = await fetch('/api/hyperframes/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          product,
          goal,
          tone,
          platform: '쇼츠',
          aspect,
          duration,
          key_points,
          cta,
          extras,
          profile_id: profileId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.detail || 'AI 생성 실패');
      const it = data.item;
      currentTemplate = null;
      currentId = '';
      currentName = it.name || (product || '커스텀 컴포지션');
      currentHtml = it.html || '';
      currentWidth = it.width || 1080;
      currentHeight = it.height || 1920;
      currentDuration = it.duration || 8;
      $('hf-name').value = currentName;
      $('hf-width').value = currentWidth;
      $('hf-height').value = currentHeight;
      $('hf-duration').value = currentDuration;
      $('hf-html').value = currentHtml;
      renderTemplateList();
      applyPlayerAttrs();
      syncAgentPanels();
      await loadPreviewFromEditor();
      setStatus('AI 생성 완료. 저장하거나 수정하세요.', 'success');
      toastMsg('AI가 컴포지션을 만들었습니다 ✨');
      return it;
    } catch (err) {
      setStatus('AI 생성 실패: ' + err.message, 'error');
      return null;
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function hfAgentRun() {
    const input = $('hf-agent-input');
    const sendBtn = $('hf-agent-send');
    if (!input || !sendBtn) return;
    const typed = input.value.trim();
    const fallback = buildFallbackAgentPrompt(agentMode);
    const prompt = typed || fallback;
    if (!prompt) {
      setStatus('한 문장 요청을 적어 주세요. 프로필만 선택되어 있어도 기본 요청을 만들어 드릴 수 있습니다.', 'error');
      return;
    }
    const effectiveMode = agentMode === 'edit' && currentHtml ? 'edit' : 'create';
    if (agentMode === 'edit' && !currentHtml) {
      pushAgentMessage('assistant', '현재 수정할 시안이 아직 없어서 새 시안 생성으로 전환했어요.', 'edit → create 자동 전환');
    }
    pushAgentMessage('user', prompt, effectiveMode === 'edit' ? '현재 시안 수정 요청' : '새 시안 생성 요청');
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = effectiveMode === 'edit' ? '수정중...' : '생성중...';
    let result = null;
    if (effectiveMode === 'edit') {
      result = await hfAiEdit(prompt, { keepButtonText: true, statusPrefix: '현재 시안을 바탕으로 수정 중입니다...' });
    } else {
      result = await hfAiGenerate(prompt, { statusPrefix: '대화 내용을 바탕으로 새 시안을 생성 중입니다...' });
    }
    sendBtn.disabled = false;
    sendBtn.textContent = '요청 보내기';
    if (!result) {
      pushAgentMessage('assistant', '이번 요청은 처리하지 못했어요. 문구를 조금 더 구체적으로 적거나 브리프 값을 함께 조정해 보세요.', '다시 시도 가능');
      return;
    }
    const meta = `${currentWidth}×${currentHeight} · ${Number(currentDuration).toFixed(1)}초`;
    if (effectiveMode === 'edit') {
      pushAgentMessage('assistant', '현재 시안을 바로 수정해 두었습니다. 미리보기에서 확인한 뒤 저장하거나 공식 Studio에서 이어서 세부 편집하면 됩니다.', meta);
      return;
    }
    pushAgentMessage('assistant', `${currentName || '새 시안'} 초안을 만들었습니다. 이 상태에서 “CTA를 더 세게”처럼 이어 말하면 같은 코드 컴포지션을 다시 다듬을 수 있어요.`, meta);
  }

  function hfOpenInTab() {
    if (!currentId && !currentTemplate) {
      setStatus('먼저 템플릿을 선택하거나 저장하세요.', 'error');
      return;
    }
    const url = currentId
      ? `/api/hyperframes/view/${encodeURIComponent(currentId)}`
      : `/api/hyperframes/view-template/${encodeURIComponent(currentTemplate.id)}`;
    window.open(url, '_blank');
  }

  async function hfToggleRecord() {
    const btn = $('hf-record');
    if (recorder) {
      try { recorder.stop(); } catch {}
      return;
    }
    const player = $('hf-player');
    if (!player) return;
    const iframe = player.iframeElement;
    if (!iframe) { setStatus('플레이어가 아직 준비되지 않았습니다. 템플릿을 다시 선택해 주세요.', 'error'); return; }
    if (!iframe.contentDocument) {
      setStatus('플레이어 iframe 에 접근할 수 없습니다. 페이지를 새로고침(Cmd+R) 해 주세요.', 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = currentWidth;
    canvas.height = currentHeight;
    // Keep canvas in DOM (off-screen) — Chromium 일부 버전에서 detached canvas 의 captureStream 이 빈 프레임을 만든다.
    canvas.style.position = 'fixed';
    canvas.style.left = '-10000px';
    canvas.style.top = '-10000px';
    canvas.style.width = '16px';
    canvas.style.height = '16px';
    canvas.style.opacity = '0';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // 첫 프레임 기본 채움 — 스트림이 최소 1프레임은 포함하도록 보장.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const stream = canvas.captureStream(30);
    recordChunks = [];
    let mimeType = 'video/webm;codecs=vp9';
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    } catch (err) {
      setStatus('녹화 초기화 실패: ' + err.message, 'error');
      try { canvas.remove(); } catch {}
      recorder = null;
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordChunks.push(e.data); };
    recorder.onerror = (e) => { setStatus('MediaRecorder 에러: ' + (e.error?.message || 'unknown'), 'error'); };
    recorder.onstop = async () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      const blob = new Blob(recordChunks, { type: 'video/webm' });
      try { canvas.remove(); } catch {}
      if (blob.size === 0) {
        setStatus('녹화된 데이터가 비어있습니다. 브라우저 허용 설정을 확인해 주세요.', 'error');
        recorder = null;
        recordChunks = [];
        btn.textContent = '● 녹화';
        btn.style.background = '#ff3b30';
        return;
      }
      try {
        const fd = new FormData();
        const compId = currentId || ('hf_' + Date.now());
        fd.append('file', blob, compId + '.webm');
        fd.append('comp_id', compId);
        fd.append('ext', 'webm');
        const wantMp4 = !!document.getElementById('hf-to-mp4')?.checked;
        fd.append('convert_mp4', wantMp4 ? 'true' : 'false');
        const res = await fetch('/api/hyperframes/output', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error('업로드 실패');
        let msg = '녹화 완료: ' + data.name + ' (' + (data.size / 1024 / 1024).toFixed(2) + ' MB)';
        if (data.mp4_name) msg += ' · MP4 ' + (data.mp4_size / 1024 / 1024).toFixed(2) + ' MB';
        else if (data.mp4_error) msg += ' · ' + data.mp4_error;
        setStatus(msg, data.mp4_error ? 'info' : 'success');
        toastMsg('녹화 파일을 저장했습니다');
        await hfReloadSaved();
      } catch (err) {
        setStatus('녹화 저장 실패: ' + err.message, 'error');
      }
      recorder = null;
      recordChunks = [];
      btn.textContent = '● 녹화';
      btn.style.background = '#ff3b30';
    };

    // 200ms 타임슬라이스로 주기적 chunk 발행 — 빈 파일 방지의 핵심.
    recorder.start(200);
    btn.textContent = '■ 중지';
    btn.style.background = '#1c1c1e';

    try { player.seek(0); player.play(); } catch {}
    const startAt = performance.now();
    let frames = 0;
    const tick = async () => {
      if (!recorder || recorder.state !== 'recording') return;
      const t = (performance.now() - startAt) / 1000;
      try {
        await rasterizeIframe(iframe, ctx, canvas.width, canvas.height);
        frames++;
      } catch (err) {
        // 실패해도 기본 채움만 유지
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (t >= currentDuration) {
        try { recorder.stop(); } catch {}
        try { player.pause(); } catch {}
        return;
      }
      requestAnimationFrame(tick);
    };
    setStatus('녹화 중... ' + currentDuration.toFixed(1) + 's', 'info');
    tick();
  }

  async function rasterizeIframe(iframe, ctx, w, h) {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      const styles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('');
      const body = doc.body.outerHTML;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
        <foreignObject width='100%' height='100%'>
          <div xmlns='http://www.w3.org/1999/xhtml' style='width:${w}px;height:${h}px;margin:0;padding:0;'>${styles}${body}</div>
        </foreignObject>
      </svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
      });
    } catch {}
  }

  const SNIPPETS = {
    title: `<div class="clip" data-start="0" data-duration="4" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
  <div style="font-size:120px;font-weight:900;letter-spacing:-2px;">타이틀</div>
</div>`,
    'lower-third': `<div class="clip" data-start="1" data-duration="5" style="position:absolute;left:60px;right:60px;bottom:140px;padding:24px 32px;background:rgba(0,0,0,.6);color:#fff;border-left:8px solid #ff8c00;border-radius:8px;">
  <div style="font-size:48px;font-weight:800;">이름</div>
  <div style="font-size:28px;opacity:.8;margin-top:6px;">역할 · 한 줄 소개</div>
</div>`,
    'cta-badge': `<div class="clip" data-start="2" data-duration="4" style="position:absolute;right:80px;bottom:80px;padding:24px 48px;background:#ff8c00;color:#fff;border-radius:14px;font-size:40px;font-weight:800;">자세히 보기 →</div>`,
    'bg-gradient': `<div class="clip" data-start="0" data-duration="60" data-track-index="0" style="position:absolute;inset:0;background:linear-gradient(135deg,#ff8c00,#ff6b00);"></div>`,
    'card-slide': `<div class="clip" data-start="0" data-duration="3" style="position:absolute;inset:60px;display:flex;flex-direction:column;justify-content:center;padding:80px;background:#fff;color:#1c1c1e;border-radius:48px;box-shadow:0 16px 64px rgba(0,0,0,.12);">
  <div style="font-size:48px;color:#ff8c00;font-weight:800;margin-bottom:24px;">01</div>
  <div style="font-size:96px;font-weight:900;line-height:1.2;">포인트 제목</div>
  <div style="font-size:42px;color:rgba(0,0,0,.55);margin-top:24px;">설명 텍스트</div>
</div>`,
  };

  function hfInsertSnippet(key) {
    const snippet = SNIPPETS[key];
    if (!snippet) return;
    const ta = $('hf-html');
    if (!ta) return;
    const start = ta.selectionStart || ta.value.length;
    const end = ta.selectionEnd || ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + (before.endsWith('\n') ? '' : '\n') + snippet + '\n' + after;
    currentHtml = ta.value;
    ta.focus();
    toastMsg('조각을 추가했습니다');
  }

  async function hfInit() {
    const root = $('hyperframes-root');
    if (!root || ready) return;
    ready = true;
    layout();
    setAgentMode('create');
    try { await ensurePlayerLoaded(); } catch (err) { setStatus('플레이어 로드 실패: ' + err.message, 'error'); }
    await loadTemplates();
    await hfReloadSaved();
    // After first layout, force player size
    setTimeout(() => {
      applyPlayerAttrs();
      hydrateBriefFromProfile();
      syncAgentPanels();
    }, 60);
    window.addEventListener('resize', () => { applyPlayerAttrs(); });
    window.setInterval(() => {
      if (!document.getElementById('hyperframes-root')) return;
      hydrateBriefFromProfile();
      syncAgentPanels();
    }, 2000);
  }

  window.hfInit = hfInit;
  window.hfApplyEditor = hfApplyEditor;
  window.hfSave = hfSave;
  window.hfReloadSaved = hfReloadSaved;
  window.hfToggleRecord = hfToggleRecord;
  window.hfOpenInTab = hfOpenInTab;
  window.hfInsertSnippet = hfInsertSnippet;
  window.hfAiGenerate = hfAiGenerate;
  window.hfAiEdit = hfAiEdit;
  window.hfAgentRun = hfAgentRun;
  window.hfRenderNative = hfRenderNative;
})();
