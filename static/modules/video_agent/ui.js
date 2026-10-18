/**
 * video_agent/ui.js
 * 영상 에이전트 (ui 모듈) — video_agent.js 에서 분리.
 * 상태·공용 헬퍼는 window.__VAG 네임스페이스를 통해 공유한다.
 */
(function () {
  'use strict';

  var V = window.__VAG = window.__VAG || {};
  V._inputStyle = function _inputStyle() { return 'width:100%;padding:9px 12px;font-size:13px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.08);outline:none;'; }
  V._textareaStyle = function _textareaStyle() { return 'width:100%;min-height:220px;padding:12px 14px;font-size:12px;line-height:1.65;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.05);color:#1c1c1e;resize:vertical;'; }
  V._metricLabel = function _metricLabel(label, value) {
    var num = Number(value || 0);
    if (!num) return '';
    return label + ' ' + num.toLocaleString('ko-KR');
  }
  V._vagSearchCard = function _vagSearchCard(item, index) {
    var metrics = [
      V._metricLabel('조회수', item && item.view_count),
      V._metricLabel('좋아요', item && item.like_count),
      V._metricLabel('구독자', item && item.subscriber_count)
    ].filter(Boolean).join(' · ');
    return ''
      + '<button type="button" data-index="' + index + '" style="width:100%;display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;border:1px solid rgba(0,0,0,0.08);background:#fff;cursor:pointer;text-align:left;">'
      + '<img src="' + V._esc(item.thumbnail || '') + '" alt="" style="width:108px;aspect-ratio:16/9;border-radius:10px;object-fit:cover;background:rgba(0,0,0,0.05);" onerror="this.style.display=\'none\'">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:12px;font-weight:700;color:#1c1c1e;line-height:1.5;">' + V._esc(item.title || '제목 없음') + '</div>'
      + '<div style="margin-top:4px;font-size:11px;color:rgba(0,0,0,0.45);">' + V._esc(item.channel || '') + (item.duration ? ' · ' + V._esc(item.duration) : '') + '</div>'
      + (metrics ? '<div style="margin-top:4px;font-size:11px;color:rgba(0,0,0,0.35);">' + V._esc(metrics) + '</div>' : '')
      + '</div>'
      + '</button>';
  }
  V._vagSearchSortItems = function _vagSearchSortItems(items) {
    var list = Array.isArray(items) ? items.slice() : [];
    if (V._vagYoutubeSearchSort === 'views') return list.sort(function (a, b) { return Number(b && b.view_count || 0) - Number(a && a.view_count || 0); });
    if (V._vagYoutubeSearchSort === 'likes') return list.sort(function (a, b) { return Number(b && b.like_count || 0) - Number(a && a.like_count || 0); });
    if (V._vagYoutubeSearchSort === 'subscribers') return list.sort(function (a, b) { return Number(b && b.subscriber_count || 0) - Number(a && a.subscriber_count || 0); });
    if (V._vagYoutubeSearchSort === 'latest') {
      return list.sort(function (a, b) {
        var ad = Date.parse((a && (a.date || a.upload_date)) || '') || 0;
        var bd = Date.parse((b && (b.date || b.upload_date)) || '') || 0;
        return bd - ad;
      });
    }
    return list;
  }
  V._vagPickYoutubeSearchResult = function _vagPickYoutubeSearchResult(items) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve(''); return; }
      V._vagYoutubeSearchItems = V._vagSearchSortItems(items);
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:6px 0;';
      wrap.innerHTML = '<div style="display:flex;justify-content:flex-end;padding-bottom:4px;"><select id="vag-yt-sort" style="padding:8px 10px;border:1px solid rgba(0,0,0,0.08);border-radius:10px;background:#fff;font-size:12px;font-weight:700;"><option value="relevance">관련도순</option><option value="views">조회수순</option><option value="likes">좋아요순</option><option value="subscribers">구독자순</option><option value="latest">최신순</option></select></div>' + V._vagYoutubeSearchItems.map(function (item, index) { return V._vagSearchCard(item, index); }).join('');
      var foot = document.createElement('div');
      foot.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding-top:2px;';
      foot.innerHTML = ''
        + '<button type="button" data-action="retry" style="padding:7px 12px;border-radius:20px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.06);color:#ff8c00;font-size:12px;font-weight:700;cursor:pointer;">다시 검색</button>'
        + '<button type="button" data-action="manual" style="padding:7px 12px;border-radius:20px;border:1px solid rgba(0,0,0,0.08);background:rgba(120,120,128,0.06);color:#1c1c1e;font-size:12px;font-weight:700;cursor:pointer;">URL 직접 입력</button>';
      wrap.appendChild(foot);
      wrap.querySelectorAll('button[data-index]').forEach(function (btn) {
        btn.onclick = function () {
          var chosen = V._vagYoutubeSearchItems[parseInt(btn.getAttribute('data-index') || '-1', 10)];
          body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
          if (chosen && chosen.url) {
            V._addMsg('user', (chosen.title || chosen.url) + '<br><span style="font-size:11px;opacity:.8;">' + V._esc(chosen.url) + '</span>');
            resolve(chosen.url);
          } else {
            resolve('');
          }
        };
      });
      foot.querySelector('[data-action="retry"]').onclick = function () {
        body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
        resolve('__retry__');
      };
      foot.querySelector('[data-action="manual"]').onclick = function () {
        body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
        resolve('__manual__');
      };
      var sortEl = wrap.querySelector('#vag-yt-sort');
      if (sortEl) {
        sortEl.value = V._vagYoutubeSearchSort;
        sortEl.onchange = function () {
          V._vagYoutubeSearchSort = sortEl.value || 'relevance';
          body.querySelectorAll('.vag-chat-options').forEach(function (el) { el.remove(); });
          V._vagPickYoutubeSearchResult(items).then(resolve);
        };
      }
      body.appendChild(wrap);
    });
  }
  V._vagPromptYoutubeUrl = function _vagPromptYoutubeUrl() {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      var w = document.createElement('div');
      w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
      w.innerHTML = '<input type="text" id="vag-chat-yt" placeholder="https://youtube.com/..." style="flex:1;' + V._inputStyle() + '"><button id="vag-chat-yt-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff0000;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">분석</button>';
      body.appendChild(w);
      document.getElementById('vag-chat-yt-go').onclick = function () {
        var v = document.getElementById('vag-chat-yt').value.trim();
        if (v) { w.remove(); V._addMsg('user', v); resolve(v); }
      };
    });
  }
  V._vagPromptYoutubeSource = async function _vagPromptYoutubeSource(topic) {
    while (true) {
      V._addMsg('ai', 'YouTube URL을 직접 넣거나 먼저 검색해서 고를 수 있어요.');
      var mode = await new Promise(function (resolve) {
        V._addOptions(['YouTube 검색', 'URL 직접 입력'], resolve);
      });
      if (mode === 'URL 직접 입력') {
        return await V._vagPromptYoutubeUrl();
      }
      V._addMsg('ai', '검색할 키워드를 입력하세요.');
      var keyword = await new Promise(function (resolve) {
        var body = document.getElementById('vag-chat-body');
        var w = document.createElement('div');
        w.style.cssText = 'display:flex;gap:6px;padding:4px 0;';
        w.innerHTML = '<input type="text" id="vag-chat-yt-search" placeholder="' + V._esc(topic || '검색 키워드') + '" style="flex:1;' + V._inputStyle() + '"><button id="vag-chat-yt-search-go" style="padding:7px 14px;border-radius:10px;border:none;background:#ff0000;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">검색</button>';
        body.appendChild(w);
        var input = w.querySelector('#vag-chat-yt-search');
        if (input && topic && !input.value) input.value = topic;
        w.querySelector('#vag-chat-yt-search-go').onclick = function () {
          var v = (input && input.value || '').trim();
          if (v) { w.remove(); V._addMsg('user', v); resolve(v); }
        };
      });
      V._addMsg('ai', '<span style="color:#ff8c00;">YouTube 검색 결과를 모으는 중입니다...</span>');
      try {
        var resp = await fetch('/api/utils/youtube-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: keyword, max_results: 12 })
        });
        var data = await resp.json();
        var items = Array.isArray(data.items) ? data.items.filter(function (item) { return item && item.url; }) : [];
        if (!resp.ok || !data.ok || !items.length) {
          V._addMsg('ai', '<span style="color:#ff3b30;">검색 결과를 찾지 못했습니다. 다른 키워드로 다시 시도해주세요.</span>');
          continue;
        }
        V._addMsg('ai', '검색 결과에서 분석할 영상을 골라주세요.');
        var picked = await V._vagPickYoutubeSearchResult(items.slice(0, 8));
        if (picked === '__retry__') continue;
        if (picked === '__manual__') return await V._vagPromptYoutubeUrl();
        if (picked) return picked;
      } catch (e) {
        V._addMsg('ai', '<span style="color:#ff3b30;">' + V._esc(e.message || 'YouTube 검색에 실패했습니다.') + '</span>');
      }
    }
  }
  V._vagFinalPrompt = function _vagFinalPrompt(script, opts) {
    if (!script || !Array.isArray(script.scenes) || !script.scenes.length) return '';
    var header = [
      '광고 HyperFrames 최종 프롬프트',
      '주제: ' + (opts.topic || ''),
      '비율: ' + (opts.aspect || '9:16'),
      '장면 수: ' + script.scenes.length,
      '보이스: ' + (opts.voice || '없음'),
      '자막 스타일: ' + (opts.subtitle || 'promo')
    ].join('\n');
    var referenceBlock = opts.source ? '\n\n참고 소재:\n' + opts.source.trim() : '';
    var scenesBlock = script.scenes.map(function (scene, index) {
      return [
        '[장면 ' + (index + 1) + '] ' + (scene.title || ''),
        '나레이션: ' + (scene.narration || ''),
        '비주얼 프롬프트: ' + (scene.visual_prompt || ''),
        '카메라: ' + (scene.camera_motion || '')
      ].join('\n');
    }).join('\n\n');
    return [header, referenceBlock, '\n\n장면 구성:\n' + scenesBlock].join('').trim();
  }
  V._renderFinalPrompt = function _renderFinalPrompt(promptText) {
    var wrap = document.getElementById('vag-final-prompt-wrap');
    var textarea = document.getElementById('vag-final-prompt');
    if (!wrap || !textarea) return;
    var text = String(promptText || '').trim();
    wrap.style.display = text ? 'block' : 'none';
    textarea.value = text;
  }

  V._vagPromptText = function _vagPromptText(message, placeholder) {
    return new Promise(function (resolve) {
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve(''); return; }
      V._addMsg('ai', message);
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:flex;gap:6px;padding:4px 0;align-items:flex-end;';
      wrap.innerHTML = ''
        + '<textarea id="vag-chat-freeform" rows="3" placeholder="' + V._esc(placeholder || '') + '" style="flex:1;' + V._inputStyle() + 'resize:vertical;line-height:1.55;"></textarea>'
        + '<button id="vag-chat-freeform-go" style="padding:9px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">보내기</button>';
      body.appendChild(wrap);
      var input = wrap.querySelector('#vag-chat-freeform');
      var go = wrap.querySelector('#vag-chat-freeform-go');
      if (input) input.focus();
      function submit() {
        var text = (input && input.value || '').trim();
        if (!text) return;
        wrap.remove();
        V._addMsg('user', V._esc(text));
        resolve(text);
      }
      if (go) go.onclick = submit;
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        });
      }
    });
  }

  V._vagBuildMarketingTopic = function _vagBuildMarketingTopic(baseTopic, objective, tone, cta) {
    var sourceMode = (V._vagSession && V._vagSession.sourceMode) || V._vagSourceMode || '';
    var parts = [baseTopic || '마케팅 영상'];
    if (sourceMode && sourceMode !== '자료 없이 진행' && sourceMode !== '주제 중심 진행') parts.unshift('자료 기반');
    if (objective) parts.push(objective);
    if (tone) parts.push(tone + ' 톤');
    return parts.join(' · ');
  }

  V._vagBuildMarketingSource = function _vagBuildMarketingSource(baseSource, context) {
    var extras = [];
    var sourceMode = (context && context.sourceMode) || V._vagSourceMode || '';
    var sourcePriority = !!(context && context.sourcePriority);
    if (sourcePriority && sourceMode) extras.push('콘텐츠 시작 방식: ' + sourceMode);
    if (sourcePriority) {
      extras.push(
        '━━━ 간접 마케팅 모드 (뉴스 큐레이션 중심) ━━━\n' +
        '이 영상의 포맷은 **"브랜드가 소개하는 뉴스/트렌드 카드"** 다. 광고가 아니라 정보 콘텐츠처럼 보이게 한다.\n' +
        '\n' +
        '[역할]\n' +
        '- 주인공: 위 소재(뉴스·기사·보도·트렌드·데이터) 자체.\n' +
        '- 브랜드: 큐레이터·해설자. 뒤에서 소재를 "자연스럽게 정리·해설해 전달" 하는 위치.\n' +
        '\n' +
        '[씬 구성 원칙]\n' +
        '- 훅(씬 1): 소재에서 가장 눈길 가는 숫자·사실·인용 1개를 **그대로** 전면에 노출. 브랜드 언급 없음.\n' +
        '- 본문(씬 2~N-1): 소재의 핵심 문구·통계·사례·인물명을 그대로 인용해 정보로 전달. 광고 카피 금지.\n' +
        '- 엔드(마지막 씬만): 브랜드명 + 한 줄 큐레이터 멘트(예: "이 이슈, {브랜드}가 정리했습니다") + CTA. 로고는 사용자가 선택했고 디자인에 자연스러울 때만 작게 사용.\n' +
        '\n' +
        '[말투·문구]\n' +
        '- 광고 슬로건·감탄사·과장 금지. 뉴스 자막·정보 카드처럼 건조하고 정확하게.\n' +
        '- 소재에 등장하는 인물·기관·상품·날짜·수치·인용문은 **실명/원문 그대로**. 각색 금지.\n' +
        '- 소재에 없는 수치·효능·후기는 생성하지 말 것(환각 금지). 불확실하면 해당 씬을 건너뛰거나 더 약한 표현으로.\n' +
        '\n' +
        '[브랜드 자연 노출 방식]\n' +
        '- 브랜드 업종과 소재의 연결고리는 시청자가 저절로 떠올리게 둔다. "그래서 우리 브랜드 좋아요" 식의 강요 금지.\n' +
        '- 엔드카드의 큐레이터 멘트 1줄로만 브랜드 존재감을 드러낸다.'
      );
    }
    if (context && context.objective) extras.push('목표: ' + context.objective);
    if (context && context.tone) extras.push('톤: ' + context.tone);
    if (context && context.cta) extras.push('CTA: ' + context.cta);
    if (context && context.structureTemplate && context.structureTemplate.label && context.structureTemplate.label !== 'AI 자동 선택') {
      var st = context.structureTemplate;
      extras.push('영상 구조: ' + st.label + ' — 이 구조를 씬 순서·카피·흐름에 정확히 반영할 것. 주제를 이 구조의 틀 안에서 풀어라.');
    }
    if (context && context.addEndcard) {
      extras.push('엔드카드 사용: 마지막 씬은 브랜드명 + 한 줄 슬로건 + CTA로 정리. 제품 설명·장황한 카피 금지. 로고 URL이 있어도 강제 삽입하지 말고, 사용자가 선택한 경우에만 작고 자연스러운 브랜드 서명으로 사용.');
    } else if (context && context.addEndcard === false) {
      extras.push('엔드카드 없음: 마지막 씬은 로고·브랜드 표시 없이 카피·이미지만으로 마무리. 바이럴 콘텐츠처럼.');
    }
    if (context && context.copyRefreshMode === 'sharper') {
      extras.push('카피 재강화 모드: 구조·스타일·씬 개수는 그대로 유지. 카피만 더 날카롭고 구체적으로 다시 써라. 빈 단어·추상 금지, 한 단어씩 아낌.');
    }
    if (V._vagAttachedImages.length) extras.push('참고 이미지: ' + V._vagAttachedImages.length + '장 첨부됨 — 장식이 아니라 실제 참조 이미지로 사용');
    if (V._vagAttachedSources.length) {
      extras.push('참고 자료: ' + V._vagAttachedSources.slice(0, 4).map(function (row) {
        return '[' + (row.type || 'web') + '] ' + (row.title || '');
      }).join(' / '));
    }
    if (context && context.followupInstruction) extras.push('추가 수정 지시: ' + context.followupInstruction);
    if (context && context.directorMeta) {
      var brief = context.directorMeta.creative_brief || {};
      var outline = Array.isArray(context.directorMeta.scenes_outline) ? context.directorMeta.scenes_outline : [];
      if (brief.target_audience) extras.push('감독 타겟: ' + brief.target_audience);
      if (brief.core_insight) extras.push('감독 인사이트: ' + brief.core_insight);
      if (brief.hook_strategy) extras.push('감독 훅: ' + brief.hook_strategy);
      if (brief.narrative_arc) extras.push('감독 서사: ' + brief.narrative_arc);
      if (outline.length) {
        extras.push('감독 씬 구성: ' + outline.slice(0, 6).map(function (row) {
          return (row.style || 'style') + ' - ' + (row.intent || '');
        }).join(' / '));
      }
    }
    var block = extras.length ? '\n\n마케팅 지시:\n' + extras.join('\n') : '';
    return String(baseSource || '').trim() + block;
  }

  V._vagAspectLabelToValue = function _vagAspectLabelToValue(label) {
    if (label === '16:9 가로') return '16:9';
    if (label === '1:1 정사각') return '1:1';
    return '9:16';
  }

  V._vagDurationFromSceneCount = function _vagDurationFromSceneCount(sceneCount) {
    // 씬당 5초 (TTS·모션 충분) · 최소 15초 · 최대 600초 (cap 풀어 1분+ 영상도 가능)
    var count = Math.max(2, parseInt(sceneCount || 4, 10) || 4);
    return Math.min(600, Math.max(15, count * 5));
  }

  function _vagLooksLikeSourceMeta(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return true;
    if (/https?:\/\/|www\.|news\.google\.com\/rss|CBMi|utm_|[?&]oc=|\.co\.kr\/|\.com\//i.test(line)) return true;
    if (/(Google\s*News|RSS|Britannica|AP\s*News|Reuters|연합뉴스|기사\s*원문|출처\s*:|source\s*:)/i.test(line)) return true;
    if (/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+\w+\s+20\d{2}.*GMT\b/i.test(line)) return true;
    if (/아래\s*최근\s*이슈와\s*출처|영상\s*훅,\s*근거,\s*CTA\s*구성에\s*반영/i.test(line)) return true;
    var latin = (line.match(/[A-Za-z]/g) || []).length;
    var korean = (line.match(/[가-힣]/g) || []).length;
    if (line.length > 42 && latin > korean * 2 && /[-_/:%?=&]/.test(line)) return true;
    return false;
  }

  V._vagBuildKeyPoints = function _vagBuildKeyPoints(source, session) {
    var points = [];
    var isSourcePriority = !!(session && session.sourcePriority && ((session.sourceMode || V._vagSourceMode) && (session.sourceMode || V._vagSourceMode) !== '자료 없이 진행'));
    if (isSourcePriority) {
      points.unshift('자료는 근거로만 사용: URL·출처명·영문 기사 제목은 화면/나레이션에 그대로 넣지 말고 광고 메시지로 압축할 것');
    }
    // 뉴스 스타일 텍스트 정제 — press suffix (연합뉴스·SBS 등) / 중복 공백 / 광고 블록 제거
    var cleanSource = String(source || '')
      .replace(/^\s*(?:▶|▷|■|●|◆|★|※)\s*/gm, '')
      .replace(/\s*\((?:사진|연합뉴스|AP|AFP|로이터|뉴스1|뉴시스|YNA)\s*=?[^)]*\)/g, '')
      .replace(/무단\s*전재[^.]*?금지\.?/g, '')
      .replace(/ⓒ[^\n]{0,50}/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
    // 자료가 많아도 영상에는 핵심 근거만 넣는다. 출처 메타데이터는 별도 참고용으로만 둔다.
    var lineCap = isSourcePriority ? 4 : 4;
    var charCap = isSourcePriority ? 88 : 80;
    var srcLines = cleanSource.split(/\n+/).map(function (line) { return line.trim(); }).filter(function (line) {
      return line && !_vagLooksLikeSourceMeta(line);
    });
    if (srcLines.length === 1 && srcLines[0].length > 200) {
      // 본문이 한 덩어리면 문장 단위로 분할
      srcLines = srcLines[0].split(/(?<=[.!?。])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    srcLines.slice(0, lineCap).forEach(function (line) {
      if (line.length >= 5) points.push(line.slice(0, charCap));
    });
    (V._vagAttachedSources || []).slice(0, 2).forEach(function (row) {
      var title = row && row.title ? String(row.title).slice(0, 80) : '';
      if (title && !_vagLooksLikeSourceMeta(title)) points.push((row.type || 'web') + ': ' + title);
    });
    if (V._vagAttachedImages.length) points.push('참고 이미지 ' + V._vagAttachedImages.length + '장 반영');
    if (session && session.objective) points.unshift('목표: ' + session.objective);
    if (session && session.cta) points.push('CTA: ' + session.cta);
    if (session && session.followupInstruction) points.push(session.followupInstruction.slice(0, 120));
    if (session && session.directorMeta) {
      var brief = session.directorMeta.creative_brief || {};
      var outline = Array.isArray(session.directorMeta.scenes_outline) ? session.directorMeta.scenes_outline : [];
      if (brief.hook_strategy) points.unshift('훅: ' + brief.hook_strategy);
      if (brief.core_insight) points.push('인사이트: ' + brief.core_insight);
      outline.slice(0, 3).forEach(function (row) {
        if (row && row.intent) points.push(row.intent.slice(0, 120));
      });
    }
    return points.slice(0, isSourcePriority ? 7 : 6);
  }

  V._vagBuildDirectorExtras = function _vagBuildDirectorExtras(session) {
    if (!session || !session.directorMeta) return '';
    var meta = session.directorMeta || {};
    var brief = meta.creative_brief || {};
    var theme = meta.theme || {};
    var narration = meta.narration_direction || {};
    var bgm = meta.bgm_direction || {};
    var outline = Array.isArray(meta.scenes_outline) ? meta.scenes_outline : [];
    var lines = ['[AI 광고 감독 브리프]'];
    if (brief.target_audience) lines.push('타겟: ' + brief.target_audience);
    if (brief.core_insight) lines.push('핵심 인사이트: ' + brief.core_insight);
    if (brief.hook_strategy) lines.push('3초 훅 전략: ' + brief.hook_strategy);
    if (brief.narrative_arc) lines.push('서사 흐름: ' + brief.narrative_arc);
    if (theme.mood_tag) lines.push('무드 태그: ' + theme.mood_tag);
    if (theme.bg || theme.fg || theme.accent) {
      lines.push('권장 팔레트: bg ' + (theme.bg || '-') + ' / fg ' + (theme.fg || '-') + ' / accent ' + (theme.accent || '-'));
    }
    if (narration.voice || narration.pace || narration.emotion) {
      lines.push('나레이션 방향: ' + [narration.voice, narration.pace, narration.emotion].filter(Boolean).join(' / '));
    }
    if (bgm.genre || bgm.bpm || bgm.energy_curve) {
      lines.push('BGM 방향: ' + [bgm.genre, bgm.bpm ? (bgm.bpm + ' BPM') : '', bgm.energy_curve].filter(Boolean).join(' / '));
    }
    if (meta.role_outputs) {
      lines.push('감독 팀 구성: 전략가 · 카피 · 아트 · 모션 · 사운드');
      if (meta.role_outputs.strategy && meta.role_outputs.strategy.positioning) lines.push('전략 포지셔닝: ' + meta.role_outputs.strategy.positioning);
    }
    if (outline.length) {
      lines.push('씬 아웃라인:');
      outline.slice(0, 8).forEach(function (row) {
        lines.push('- ' + (row.index || '?') + '씬 | ' + (row.style || 'style') + ' | ' + (row.intent || ''));
      });
    }
    lines.push('규칙: AI 광고 영상처럼 첫 3초 훅을 강하게, 씬마다 디자인/카피/모션을 반복하지 말고 상업용 완성도로 유지.');
    return lines.join('\n');
  }

  V._vagBuildFallbackDirectorMeta = function _vagBuildFallbackDirectorMeta(topic, source, session) {
    var count = Math.max(3, parseInt((document.getElementById('vag-scene-count') || {}).value || '6', 10) || 6);
    var duration = (session && session.hyperDuration) || V._vagDurationFromSceneCount(count);
    var sceneDuration = Math.max(2, duration / count);
    var sourceLines = String(source || '').split(/\n+/).map(function (line) {
      return line.replace(/\s+/g, ' ').trim();
    }).filter(function (line) {
      return line.length >= 12 && !/^\[|^---$/.test(line);
    });
    var intents = [
      '첫 3초 훅으로 가장 강한 이슈나 숫자를 제시',
      '고객이 지금 겪는 문제를 짧게 압축',
      '자료에서 확인된 근거와 변화 흐름 제시',
      '브랜드가 해결하는 방식과 차별점 연결',
      '사용자가 바로 취할 행동을 CTA로 마무리',
    ];
    var scenes = Array.from({ length: count }).map(function (_unused, idx) {
      var sourceLine = sourceLines[idx % Math.max(1, sourceLines.length)] || '';
      return {
        index: idx + 1,
        style: idx === 0 ? 'hook' : idx === count - 1 ? 'cta' : 'evidence',
        intent: sourceLine ? (intents[Math.min(idx, intents.length - 1)] + ' · ' + sourceLine.slice(0, 90)) : intents[Math.min(idx, intents.length - 1)],
        duration_sec: Math.round(sceneDuration * 10) / 10,
      };
    });
    return {
      ok: true,
      fallback: true,
      creative_brief: {
        target_audience: '현재 주제에 관심 있는 잠재 고객',
        core_insight: sourceLines[0] || topic || '주제와 프로필을 기반으로 한 빠른 광고 메시지',
        hook_strategy: scenes[0] && scenes[0].intent || '강한 문제 제기',
        narrative_arc: '훅 -> 문제 -> 근거 -> 해결 -> CTA',
      },
      theme: { accent: (session && session.brandColor) || '#ff8c00' },
      scenes_outline: scenes,
      role_outputs: {},
    };
  }

  V._vagPrepareDirectorBrief = async function _vagPrepareDirectorBrief(topic, source, options) {
    var session = V._vagSession || {};
    var opts = options || {};
    var directorActive = !!(opts.forceDirectorMode || session.directorMode || session.directorAutoEnabled);
    var crewMode = !!(opts.teamMode || session.directorCrewMode);
    var profileId = parseInt(window._globalProfileId || 0);
    var aspect = session.aspect || (document.getElementById('vag-aspect') || {}).value || '9:16';
    var duration = session.hyperDuration || V._vagDurationFromSceneCount((document.getElementById('vag-scene-count') || {}).value || '6');
    var sceneCount = parseInt((document.getElementById('vag-scene-count') || {}).value || '6', 10) || 6;
    var designFamilyExtras = V._vagBuildDesignFamilyBlock(session, aspect);
    var brandLockExtras = V._vagBuildBrandLockBlock(session);
    var payload = {
      brand: (window._globalProfileData || {}).name || '',
      product: topic || session.baseTopic || '마케팅 영상',
      goal: session.objective || '광고 전환',
      tone: session.tone || '직설',
      aspect: aspect,
      duration: duration,
      scene_count: sceneCount,
      key_points: V._vagBuildKeyPoints(source, session),
      cta: (document.getElementById('vag-cta-input')?.value || '').trim() || session.cta || '',
      extras: [String(source || '').slice(0, 2000), designFamilyExtras, brandLockExtras].filter(Boolean).join('\n\n').trim(),
      profile_id: profileId || null,
      reference_images: (V._vagAttachedImages || []).filter(function (im) {
        return im && im.source !== 'profile-logo' && im.dataUrl;
      }).map(function (im) { return im.dataUrl; }),
      brand_color: session.brandColor || '',
    };
    V._addMsg('ai', opts.message || '🎭 AI 광고 감독이 훅, 서사, 씬 구성을 먼저 설계하고 있어요...');
    var endpoint = crewMode ? '/api/hyperframes/remotion-team' : '/api/hyperframes/remotion-meta';
    var metaD = null;
    try {
      var metaR = await V._vagFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      metaD = await metaR.json();
      if (!metaR.ok || !metaD.ok) throw new Error(metaD.detail || '감독 브리프 생성 실패');
    } catch (e) {
      metaD = V._vagBuildFallbackDirectorMeta(topic, source, session);
      V._addMsg('ai', '<span style="color:#ff9500;">장면 플랜 API가 실패해도 멈추지 않고, 기존 수집 자료 기반 기본 씬 플랜으로 이어갑니다: ' + V._esc(e.message || e) + '</span>');
    }
    if (!Array.isArray(metaD.scenes_outline) && Array.isArray(metaD.scenes)) {
      metaD.scenes_outline = metaD.scenes.map(function (row, idx) {
        return {
          index: row.index || (idx + 1),
          style: row.style || '',
          intent: row.intent || row.title || row.body || '',
          duration_sec: row.duration_sec || 0,
        };
      });
    }
    if (!V._vagSession) V._vagSession = {};
    V._vagSession.directorMeta = metaD;
    V._vagSession.directorMode = directorActive;
    V._vagSession.directorAutoEnabled = !!(session.directorAutoEnabled || opts.autoMode);
    V._vagSession.directorCrewMode = crewMode;
    if (metaD.theme && metaD.theme.accent && !V._vagSession.brandColor) V._vagSession.brandColor = metaD.theme.accent;
    V._vagPersistState('director_brief', 'planning', {
      director_mode: !!V._vagSession.directorMode,
      director_auto_enabled: !!V._vagSession.directorAutoEnabled,
      director_crew_mode: !!V._vagSession.directorCrewMode,
      director_brief: metaD.creative_brief || {},
      director_theme: metaD.theme || {},
      director_outline: Array.isArray(metaD.scenes_outline) ? metaD.scenes_outline.slice(0, 8) : [],
      director_role_outputs: metaD.role_outputs || {},
    }, 'director_brief_ready', {
      creative_brief: metaD.creative_brief || {},
      theme: metaD.theme || {},
      scenes_outline: Array.isArray(metaD.scenes_outline) ? metaD.scenes_outline.slice(0, 8) : [],
      role_outputs: metaD.role_outputs || {},
    });
    var summary = [];
    if (metaD.creative_brief && metaD.creative_brief.hook_strategy) summary.push('훅: ' + metaD.creative_brief.hook_strategy);
    if (metaD.creative_brief && metaD.creative_brief.narrative_arc) summary.push('서사: ' + metaD.creative_brief.narrative_arc);
    if (Array.isArray(metaD.scenes_outline) && metaD.scenes_outline.length) {
      summary.push('씬: ' + metaD.scenes_outline.slice(0, 3).map(function (row) {
        return (row.style || 'style') + ' · ' + (row.intent || '');
      }).join(' / '));
    }
    if (metaD.role_outputs) summary.push('팀 역할: 전략 · 카피 · 아트 · 모션 · 사운드');
    V._addMsg('ai', '🎬 감독 브리프 완성. ' + V._esc(summary.join(' | ') || '이 방향으로 실제 생성에 반영합니다.'));
    return metaD;
  }

  V._vagBuildEditInstruction = function _vagBuildEditInstruction(session) {
    var lines = [];
    if (session && session.objective) lines.push('목적을 `' + session.objective + '`에 맞게 반영');
    if (session && session.tone) lines.push('톤을 `' + session.tone + '`으로 조정');
    if (session && session.cta) lines.push('CTA를 `' + session.cta + '` 방향으로 정리');
    if (session && session.followupInstruction) lines.push(session.followupInstruction);
    return lines.join('\n');
  }

  V._vagParentDir = function _vagParentDir(path) {
    var text = String(path || '');
    if (!text) return '';
    var idx = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
    return idx > 0 ? text.slice(0, idx) : '';
  }

  V._vagToast = function _vagToast(message, tone) {
    try {
      if (typeof window.toast === 'function') window.toast(message, tone || '');
    } catch (e) { /* ignore */ }
  }

  V._vagAspectDimensions = function _vagAspectDimensions(aspect) {
    if (aspect === '16:9') return { width: 1920, height: 1080 };
    if (aspect === '1:1') return { width: 1080, height: 1080 };
    return { width: 1080, height: 1920 };
  }

  V._vagSafeId = function _vagSafeId(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  V._vagExtractCss = function _vagExtractCss(html) {
    var source = String(html || '');
    var styles = [];
    source.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function (_, css) {
      var chunk = String(css || '').trim();
      if (chunk) styles.push(chunk);
      return _;
    });
    return styles.join('\n\n');
  }

  V._vagGuessTextLabel = function _vagGuessTextLabel(text, tag) {
    var t = String(text || '').trim();
    var lower = t.toLowerCase();
    if (!t) return '본문';
    if (/[→↗⭢▶▷]|지금|바로|받기|구매|예약|신청|주문|쇼핑|상담/.test(t) && t.length < 40) return 'CTA';
    if (tag === 'button' || tag === 'a') return 'CTA';
    if (/^h[1-3]$/i.test(tag || '')) return '제목';
    if (t.length <= 14) return '강조';
    if (t.length <= 40) return '부제';
    return '본문';
  }

  V._vagClipReadText = function _vagClipReadText(el) {
    var raw = String(el.innerHTML || '');
    var hasBr = /<br\s*\/?>/i.test(raw);
    var text = raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
    text = text.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
    var lines = text.split(/\n+/).map(function (line) {
      return _vagCleanSceneLine(line);
    }).filter(Boolean);
    return { text: lines.join('\n').trim(), hasBr: hasBr || lines.length > 1 };
  }

  V._vagClipWriteText = function _vagClipWriteText(el, text, hasBr) {
    var safe = String(text == null ? '' : text);
    if (hasBr) {
      var lines = safe.split(/\n/);
      el.innerHTML = lines.map(function (line) { return V._esc(line); }).join('<br>');
    } else {
      el.textContent = safe.replace(/\n/g, ' ');
    }
  }

  V._vagHasEditableChildren = function _vagHasEditableChildren(el) {
    var kids = el.children;
    for (var i = 0; i < kids.length; i++) {
      var tag = (kids[i].tagName || '').toLowerCase();
      if (tag !== 'br') return true;
    }
    return false;
  }

  V._vagAnnotateTexts = function _vagAnnotateTexts(html) {
    V._vagTextEntries = [];
    if (!html) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    if (!doc || !doc.documentElement) return html;

    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    var clips = stage
      ? Array.prototype.slice.call(stage.querySelectorAll('[data-start]'))
      : Array.prototype.slice.call(doc.querySelectorAll('[data-start]'));
    if (!clips.length && stage) clips = Array.prototype.slice.call(stage.children || []);
    if (!clips.length) clips = Array.prototype.slice.call(doc.querySelectorAll('#stage > *'));
    // composition root 자체와 <audio>/<video>/<script>/<style> 는 편집 대상 아님
    clips = clips.filter(function (el) {
      if (!el) return false;
      if (stage && el === stage) return false;
      if (el.id === 'stage') return false;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'audio' || tag === 'video' || tag === 'script' || tag === 'style' || tag === 'source') return false;
      if ((el.id || '') === 'bar') return false;
      if (el.classList && (el.classList.contains('progress') || el.classList.contains('bar') || el.classList.contains('vignette'))) return false;
      var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      var hasVisual = !!(el.querySelector && el.querySelector('img,svg,canvas,video,iframe'));
      if (!txt && !hasVisual) return false;
      return true;
    });
    var refCounter = 0;

    clips.forEach(function (clip, idx) {
      var start = parseFloat(clip.getAttribute('data-start') || '0') || 0;
      if (!V._vagHasEditableChildren(clip)) {
        var info = V._vagClipReadText(clip);
        if (!info.text) return;
        var ref = 'vag-txt-' + (refCounter++);
        clip.setAttribute('data-vag-text-ref', ref);
        var tag = (clip.tagName || '').toLowerCase();
        V._vagTextEntries.push({
          ref: ref,
          clipIndex: idx,
          start: start,
          text: info.text,
          hasBr: info.hasBr,
          label: V._vagGuessTextLabel(info.text, tag),
        });
        return;
      }
      var leaves = Array.prototype.slice.call(clip.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,small,strong,em,li,button,a,div'));
      leaves.forEach(function (el) {
        if (V._vagHasEditableChildren(el)) return;
        var leafInfo = V._vagClipReadText(el);
        if (!leafInfo.text) return;
        var leafTag = (el.tagName || '').toLowerCase();
        if (leafTag === 'div' && leafInfo.text.length > 120) return;
        var leafRef = 'vag-txt-' + (refCounter++);
        el.setAttribute('data-vag-text-ref', leafRef);
        V._vagTextEntries.push({
          ref: leafRef,
          clipIndex: idx,
          start: start,
          text: leafInfo.text,
          hasBr: leafInfo.hasBr,
          label: V._vagGuessTextLabel(leafInfo.text, leafTag),
        });
      });
    });

    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  }

  V._vagApplyTextEditsToHtml = function _vagApplyTextEditsToHtml(html, changes) {
    if (!html || !changes) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    if (!doc || !doc.documentElement) return html;
    V._vagTextEntries.forEach(function (entry) {
      if (!(entry.ref in changes)) return;
      var el = doc.querySelector('[data-vag-text-ref="' + entry.ref + '"]');
      if (!el) return;
      V._vagClipWriteText(el, changes[entry.ref], entry.hasBr);
      entry.text = String(changes[entry.ref] || '').trim();
    });
    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  }

  V._vagExtractNarrationScript = function _vagExtractNarrationScript(html, fallbackTopic) {
    if (!html) return String(fallbackTopic || '').trim();
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var clips = doc.querySelectorAll('.cue,[data-vag-narration],[data-caption]');
      if (!clips.length) clips = doc.querySelectorAll('[data-start]:not([data-composition-id]):not(iframe):not(.progress):not(.bar)');
      var lines = [];
      clips.forEach(function (clip) {
        if (clip.querySelector && clip.querySelector('[data-start],iframe,.cue')) return;
        var t = (clip.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) return;
        if (t.length < 3) return;
        if (/^(Makeke Motion|HTML\s*→\s*Motion Video)$/i.test(t)) return;
        if (t.length > 160) t = t.slice(0, 157).trim() + '...';
        if (lines.indexOf(t) >= 0) return;
        lines.push(t);
      });
      var out = lines.slice(0, 6).join('\n');
      return out || String(fallbackTopic || '').trim();
    } catch (e) {
      return String(fallbackTopic || '').trim();
    }
  }

  V._vagBuildPromotionalNarrationScript = function _vagBuildPromotionalNarrationScript(html, fallbackTopic) {
    var rawLines = [];
    try {
      var doc = new DOMParser().parseFromString(html || '', 'text/html');
      var nodes = doc.querySelectorAll('.cue,.poster-line,h1,h2,h3,p,li,button,a');
      nodes.forEach(function (node) {
        if (node.querySelector && node.querySelector('.cue,.poster-line,h1,h2,h3,p,li,button,a')) return;
        var text = _vagCleanSceneLine(node.textContent || '');
        if (!text || text.length < 3) return;
        if (/^(Makeke Motion|HTML\s*→\s*Motion Video|Lead Form|Pricing Card)$/i.test(text)) return;
        if (/^(상담 신청|추천 플랜 예약|자문 문의|법률 상담 예약하기)$/.test(text)) return;
        if (rawLines.indexOf(text) < 0) rawLines.push(text);
      });
    } catch (_) {}
    var topic = String(fallbackTopic || '').replace(/\s*·\s*\d+:\d+.*$/, '').trim();
    var headline = rawLines[0] || topic || '지금 필요한 선택을 정리하세요';
    var support = rawLines.find(function (line) { return line !== headline && line.length >= 18; }) || '';
    var proof = rawLines.find(function (line) { return /체크|자료|상담|리스크|선택|예약|준비/.test(line) && line !== headline && line !== support; }) || '';
    var cta = rawLines.find(function (line) { return /예약|문의|신청|상담/.test(line); }) || '지금 상담을 예약해보세요.';
    var script = [
      headline,
      support || '복잡한 상황을 이해하기 쉬운 다음 행동으로 바꿔드립니다.',
      proof || '필요한 자료와 조심해야 할 표현을 먼저 정리해드립니다.',
      cta.endsWith('.') || cta.endsWith('요') ? cta : cta + ' 지금 시작해보세요.',
    ];
    return script
      .map(function (line) { return line.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean)
      .slice(0, 4)
      .join('\n');
  }

  function _vagIsGarbageSceneLine(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return true;
    if (_vagLooksLikeSourceMeta(line)) return true;
    if (_vagIsInstructionSceneLine(line)) return true;
    var lower = line.toLowerCase();
    if (/wasted budget|no conversion|lorem ipsum|placeholder|sample text|dummy text/.test(lower)) return true;
    var words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 5) {
      var unique = {};
      words.forEach(function (word) { unique[word.toLowerCase()] = true; });
      if (Object.keys(unique).length <= Math.ceil(words.length * 0.38)) return true;
    }
    var latin = (line.match(/[A-Za-z]/g) || []).length;
    var upper = (line.match(/[A-Z]/g) || []).length;
    if (line.length > 24 && latin >= 18 && upper / Math.max(1, latin) > 0.72) return true;
    return false;
  }

  function _vagIsInstructionSceneLine(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return true;
    if (/^(핵심\s*메시지|브랜드\s*메시지|마케팅\s*메시지)[.!?。！？]*$/i.test(line)) return true;
    if (/소개\s*숏폼.*광고\s*전환.*직설\s*톤/.test(line)) return true;
    if (/먼저\s*영상\s*전체|영상\s*전체를\s*관통|핵심\s*메시지\s*1문장|모든\s*씬은|그\s*메시지를\s*증명|행동으로\s*연결해야|자료는\s*근거로만|화면\s*문구와\s*나레이션|URL|RSS|출처명|영문\s*기사|그대로\s*넣지|정하세요|넣으세요|사용하세요|하지\s*마세요|주의\s*사항|주의사항|왜\s*물어봐요|필수\s*구현|브랜드\s*적용|모션\s*다양성|이\s*구조를\s*씬\s*순서|카피\s*흐름에\s*정확히\s*반영|주제를\s*이\s*구조/.test(line)) return true;
    if (/^\s*(규칙|지시|작성\s*규칙|주의\s*사항|주의사항|메시지\s*압축\s*규칙|장면\s*수|핵심\s*메시지\s*계약|필수\s*구현|브랜드\s*적용|모션\s*다양성|마케팅\s*지시|영상\s*지시|생성\s*지시|광고\s*지시|목표|목적|톤|비율|길이|플랫폼|영상\s*구조|구조|엔드카드|브랜드\s*락업)\s*[:：]/i.test(line)) return true;
    if (/^(씬\s*\d+|장면\s*\d+)\s*(에는|은|:|：)/.test(line) && /문제|근거|해결|CTA|행동/.test(line)) return true;
    return false;
  }

  function _vagIsRoleLabelOnly(text) {
    var line = String(text || '').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/g, '').trim();
    return /^(핵심\s*메시지|브랜드\s*메시지|마케팅\s*메시지|문제|근거|해결|효과|행동|CTA|씨티에이)$/i.test(line);
  }

  function _vagRepairSceneNarrationPlan(plan, topic, options) {
    var scenes = Array.isArray(plan) ? plan : [];
    if (!scenes.length) return [];
    var opts = options || {};
    return scenes.map(function (scene, idx) {
      var title = _vagIsRoleLabelOnly(scene && scene.title) ? '' : ((scene && scene.title) || '');
      var body = _vagIsRoleLabelOnly(scene && scene.body) ? '' : ((scene && scene.body) || '');
      var narration = _vagIsRoleLabelOnly(scene && scene.narration) ? '' : ((scene && scene.narration) || '');
      var emphasis = Array.isArray(scene && scene.emphasis) ? scene.emphasis.filter(function (line) {
        return _vagCleanSceneLine(line);
      }) : [];
      if (typeof V._vagNormalizeNarrationForSpeech === 'function') {
        narration = V._vagNormalizeNarrationForSpeech(narration, {
          cta: idx === scenes.length - 1 ? (opts.cta || '') : '',
        });
      }
      if (_vagIsRoleLabelOnly(narration)) narration = [title, body].filter(Boolean).join('. ');
      if (narration && !/[.!?。！？요다까죠니다]$/.test(narration)) narration += '.';
      var cutPlan = String((scene && (scene.cutPlan || scene.cut_plan)) || '').trim();
      if (!cutPlan) {
        var mode = String((scene && (scene.visualMode || scene.visual_mode)) || '').trim();
        cutPlan = idx === 0
          ? '첫 1초는 선택한 이미지의 핵심 피사체를 홀드하고, 천천히 push-in 하며 핵심 문구를 늦게 등장시킨다.'
          : idx === scenes.length - 1
            ? '이미지를 안정적으로 홀드한 뒤 CTA 문구를 또렷하게 고정하고, 마지막 0.5초는 여백을 둔다.'
            : mode.indexOf('image') >= 0
              ? '선택한 이미지를 2초 이상 호흡 있게 보여주고, subtle pan/zoom으로 시선을 한 지점에 모은다.'
              : '이미지 배경 위에 카피를 2단계로 등장시키고, 장면 전환은 빠른 wipe 또는 soft crossfade로 연결한다.';
      }
      return Object.assign({}, scene, {
        title: title,
        body: body,
        role: (scene && scene.role) || '',
        emphasis: emphasis.slice(0, 3),
        lines: [title, body].filter(Boolean),
        cutPlan: cutPlan,
        narration: narration,
      });
    });
  }

  function _vagTextContainsAny(text, terms) {
    var lower = String(text || '').toLowerCase();
    return (terms || []).some(function (term) {
      term = String(term || '').toLowerCase().trim();
      return term.length >= 2 && lower.indexOf(term) >= 0;
    });
  }

  V._vagRepairMotionCopy = function _vagRepairMotionCopy(html, topic, source, options) {
    return html;
  };

  function _vagCleanSceneLine(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 2) return '';
    line = _vagTrimProductionMetaTail(line);
    if (/^(마케팅\s*지시|영상\s*지시|생성\s*지시|광고\s*지시|목표|목적|톤|비율|길이|플랫폼|영상\s*구조|구조|엔드카드|브랜드\s*락업)\s*[:：]/i.test(line)) return '';
    line = line.replace(/^(핵심\s*(?:메시지|문제|근거|해결|행동|효과)|문제|근거|해결\s*\/?\s*행동|행동\s*유도|CTA|씨티에이|요약)\s*[:：]\s*/i, '').trim();
    line = line.replace(/\[[^\]]*(Gemini|제미나이|자동|검색|자료|source|research|issue|이슈)[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
    if (!line || line.length < 2) return '';
    if (_vagIsInstructionSceneLine(line)) return '';
    if (_vagLooksLikeSourceMeta(line)) return '';
    if (/^\[[^\]]*(Gemini|제미나이|자동|검색|자료|source|research|issue|이슈)[^\]]*\]$/i.test(line)) return '';
    if (/^(Gemini|제미나이)\s*(자동|최신|검색|이슈|자료)/i.test(line)) return '';
    if (/^(주제|자료|출처|source|research)\s*[:：]/i.test(line) && line.length < 45) return '';
    if (_vagIsGarbageSceneLine(line)) return '';
    if (/^(Makeke Motion|HTML\s*→\s*Motion Video|Lead Form|Pricing Card)$/i.test(line)) return '';
    if (/^(자료 기반|주제 중심|직설 톤|전문 톤|감성 톤|CTA|BGM|TTS|GSAP|Gemini|Atlas|Claude|Codex|Kimi|9:16|16:9|1:1)$/i.test(line)) return '';
    if (/^(자동|수동|선택|모델|비율|길이|소재|뉴스|구글|라이브러리|URL|문서|비우기)$/i.test(line)) return '';
    if (/^(상담 신청|추천 플랜 예약|자문 문의|법률 상담 예약하기)$/.test(line)) return '';
    if (line.length > 96) line = line.slice(0, 93).trim() + '...';
    return line;
  }

  function _vagTrimProductionMetaTail(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return '';
    var markers = [
      '[첨부소재', '[브랜드 디자인', '[프로필 디자인', '[공통 비주얼',
      '첨부소재·브랜드', '아래 첨부소재', '브랜드 디자인 규칙은',
      '디자인 규칙과 소재', '모델 일관성:', '화면 속 UI가 필요하면',
      '텍스트 없는 추상', '읽히는 글자처럼 보이는'
    ];
    var lower = line.toLowerCase();
    var cut = line.length;
    markers.forEach(function (marker) {
      var idx = lower.indexOf(String(marker).toLowerCase());
      if (idx >= 0 && idx < cut) cut = idx;
    });
    var enumMatch = lower.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/);
    if (enumMatch && enumMatch.index < cut) cut = enumMatch.index;
    return line.slice(0, cut).replace(/[.。·ㆍ|/,\-\s]+$/g, '').trim();
  }

  function _vagIsProductionMetaLine(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!line) return true;
    return /\b[a-z]+(?:_[a-z0-9]+)+\b/.test(line) ||
      /\b(benefit|hook|proof|problem|solution|cta|lockup|image_only|cinematic_image|kinetic_type|data_proof|product_focus)\b/.test(line) ||
      /(shot_type|visual_mode|cut_plan|image_prompt|negative_constraints|subject_action|sound_cue|edit_beat|lip_sync)/.test(line) ||
      /(medium_lifestyle|unboxing|product_detail|hero_packshot|macro_detail)/.test(line) ||
      /(표준\s*렌즈|자연스러운\s*심도|실내\s*자연광|미디엄\s*샷|클로즈업|카메라|렌즈|조명|구도|우측\s*상단|좌측\s*여백|텍스트가\s*올라갈)/.test(line) ||
      /(첨부소재|브랜드\s*디자인\s*규칙|최상위\s*입력|글리프도\s*실패)/.test(line);
  }

  function _vagCleanDisplayConcept(text) {
    var line = _vagTrimProductionMetaTail(text);
    if (!line || _vagIsProductionMetaLine(line)) return '';
    var parts = line.split(/[.!?。！？]+/).map(function (part) {
      return _vagCleanSceneLine(part);
    }).filter(function (part) {
      return part && !_vagIsProductionMetaLine(part);
    });
    var clean = parts.slice(0, 2).join('. ').trim();
    if (clean.length > 130) clean = clean.slice(0, 127).trim() + '...';
    return clean;
  }

  function _vagCleanImagePromptForEditor(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return '';
    var markers = [
      '[첨부소재', '[브랜드 디자인', '[프로필 디자인', '[공통 비주얼',
      '첨부소재·브랜드', '아래 첨부소재', '브랜드 디자인 규칙은',
      '디자인 규칙과 소재', '모델 일관성:', '화면 속 UI가 필요하면',
      '읽히는 글자처럼 보이는'
    ];
    var lower = line.toLowerCase();
    var cut = line.length;
    markers.forEach(function (marker) {
      var idx = lower.indexOf(String(marker).toLowerCase());
      if (idx >= 0 && idx < cut) cut = idx;
    });
    line = line.slice(0, cut).replace(/[.。·ㆍ|/,\-\s]+$/g, '').trim();
    if (line.length > 900) line = line.slice(0, 897).trim() + '...';
    return line;
  }

  function _vagImagePromptEditorValue(scene) {
    var raw = scene && (scene.imagePrompt || scene.image_prompt);
    var clean = _vagCleanImagePromptForEditor(raw);
    if (clean) return clean;
    var p = [];
    var title = _vagCleanSceneLine(scene && scene.title);
    var body = _vagCleanSceneLine(scene && scene.body);
    var shotType = _vagScenarioProductionFieldValue(scene, 'shotType');
    var subjectAction = _vagScenarioProductionFieldValue(scene, 'subjectAction');
    var camera = _vagScenarioProductionFieldValue(scene, 'camera');
    var lens = _vagScenarioProductionFieldValue(scene, 'lens');
    var lighting = _vagScenarioProductionFieldValue(scene, 'lighting');
    var artDirection = _vagScenarioProductionFieldValue(scene, 'artDirection');
    var propsWardrobe = _vagScenarioProductionFieldValue(scene, 'propsWardrobe');
    var composition = _vagScenarioProductionFieldValue(scene, 'composition');
    if (title || body) p.push('장면 메시지: ' + [title, body].filter(Boolean).join(' / '));
    if (shotType) p.push('쇼트: ' + shotType);
    if (subjectAction) p.push('피사체/행동: ' + subjectAction);
    if (camera) p.push('카메라: ' + camera);
    if (lens) p.push('렌즈/초점: ' + lens);
    if (lighting) p.push('조명: ' + lighting);
    if (artDirection) p.push('공간/무드: ' + artDirection);
    if (propsWardrobe) p.push('소품/의상: ' + propsWardrobe);
    if (composition) p.push('구도/여백: ' + composition);
    return p.join('. ').trim();
  }

  function _vagIsVisualSceneNode(stage, node) {
    if (!stage || !node) return false;
    var tag = (node.tagName || '').toLowerCase();
    if (tag === 'audio' || tag === 'script' || tag === 'style' || tag === 'iframe') return false;
    if (tag === 'video' && node.getAttribute('data-vag-bg')) return false;
    if (node.classList && (node.classList.contains('progress') || node.classList.contains('bar') || node.classList.contains('vignette') || node.classList.contains('cue'))) return false;
    if (node.classList && (node.classList.contains('vag-simple-bg') || node.classList.contains('vag-simple-bg-track') || node.classList.contains('vag-bg-track'))) return false;
    if ((node.id || '') === 'bar' || (node.id || '') === 'bgm' || (node.id || '') === 'narration') return false;
    var parentTimed = node.parentElement && node.parentElement.closest('[data-start]');
    if (parentTimed && parentTimed !== stage && stage.contains(parentTimed)) return false;
    return true;
  }

  V._vagExtractSceneNarrationPlan = function _vagExtractSceneNarrationPlan(html, fallbackTopic, options) {
    var opts = options || {};
    var scenes = [];
    try {
      var doc = new DOMParser().parseFromString(html || '', 'text/html');
      var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
      if (!stage) throw new Error('stage missing');
      var nodes = Array.prototype.slice.call(stage.querySelectorAll('[data-start]'))
        .filter(function (node) { return _vagIsVisualSceneNode(stage, node); })
        .sort(function (a, b) {
          return (parseFloat(a.getAttribute('data-start') || '0') || 0) - (parseFloat(b.getAttribute('data-start') || '0') || 0);
        });
      nodes.forEach(function (node, idx) {
        var attrNarration = _vagCleanSceneLine(node.getAttribute('data-vag-narration') || node.getAttribute('data-caption') || '');
        var rawLines = [];
        var selectors = '[data-vag-narration],[data-caption],.poster-line,.headline,.title,.subtitle,.copy,h1,h2,h3,p,li,button,a';
        var textNodes = node.querySelectorAll ? Array.prototype.slice.call(node.querySelectorAll(selectors)) : [];
        if (!textNodes.length) textNodes = [node];
        textNodes.forEach(function (item) {
          if (item !== node && item.querySelector && item.querySelector(selectors)) return;
          var attr = _vagCleanSceneLine(item.getAttribute && (item.getAttribute('data-vag-narration') || item.getAttribute('data-caption')));
          var txt = attr || _vagCleanSceneLine(item.textContent || '');
          if (!txt) return;
          if (rawLines.indexOf(txt) < 0) rawLines.push(txt);
        });
        var fallbackLine = _vagCleanSceneLine(node.textContent || '');
        if (!rawLines.length && fallbackLine) rawLines.push(fallbackLine);
        var title = rawLines[0] || attrNarration || '';
        var body = rawLines.find(function (line) { return line !== title && line.length >= 8; }) || '';
        var emphasis = rawLines.filter(function (line) {
          if (!line || line === title || line === body) return false;
          if (_vagCanonicalNarrationText(line) === _vagCanonicalNarrationText(title)) return false;
          if (body && _vagCanonicalNarrationText(line) === _vagCanonicalNarrationText(body)) return false;
          return line.length <= 28;
        }).slice(0, 3);
        var narration = attrNarration || [title, body].filter(Boolean).join('. ');
        narration = narration.replace(/\. \./g, '.').replace(/\s+/g, ' ').trim();
        if (narration && !/[.!?。！？요다까죠니다]$/.test(narration)) narration += '.';
        scenes.push({
          index: idx + 1,
          start: parseFloat(node.getAttribute('data-start') || '0') || 0,
          duration: parseFloat(node.getAttribute('data-duration') || '0') || 0,
          title: title,
          body: body,
          role: '',
          emphasis: emphasis,
          lines: rawLines.slice(0, 4),
          narration: narration,
        });
      });
    } catch (_) {}
    return scenes;
  };

  V._vagBuildSceneTextsForNarration = function _vagBuildSceneTextsForNarration(html, fallbackTopic, options) {
    return V._vagExtractSceneNarrationPlan(html, fallbackTopic, options)
      .map(function (scene) {
        return ('장면 ' + scene.index + ': ' + [scene.title, scene.body].filter(Boolean).join(' / ')).trim();
      })
      .filter(Boolean)
      .slice(0, 24);
  };

  function _vagSceneKeywords(text) {
    return String(text || '').toLowerCase().split(/[^\w가-힣]+/).map(function (word) {
      return word.trim();
    }).filter(function (word) {
      return word.length >= 2 && !/^(장면|자료|기반|광고|영상|모션|핵심|고객|서비스|지금|바로|우리|당신|위한|그리고|하지만|있는|없는|합니다|하세요|보세요)$/.test(word);
    }).slice(0, 10);
  }

  function _vagDistributeNarrationLines(lines, count) {
    var items = (Array.isArray(lines) ? lines : []).map(function (line) {
      return String(line || '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    var target = Math.max(0, Number(count || 0) || 0);
    if (!items.length || !target) return [];
    if (items.length <= target) return items.slice(0, target);
    var out = [];
    var cursor = 0;
    for (var i = 0; i < target; i++) {
      var remainingLines = items.length - cursor;
      var remainingBuckets = target - i;
      var take = Math.max(1, Math.ceil(remainingLines / remainingBuckets));
      out.push(items.slice(cursor, cursor + take).join(' '));
      cursor += take;
    }
    return out;
  }

  V._vagSplitNarrationIntoSceneLines = function _vagSplitNarrationIntoSceneLines(script, sceneCount) {
    var count = Math.max(0, Number(sceneCount || 0) || 0);
    var raw = String(script || '').replace(/\r/g, '\n').trim();
    if (!raw || !count) return [];
    var lines = raw.split(/\n+/).map(function (line) {
      return line.replace(/^\s*(?:장면\s*)?\d+[\).:-]?\s*/i, '').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    if (lines.length < count) {
      lines = raw.split(/(?<=[.!?。！？요다까죠니다])\s+/).map(function (line) {
        return line.replace(/^\s*(?:장면\s*)?\d+[\).:-]?\s*/i, '').replace(/\s+/g, ' ').trim();
      }).filter(Boolean);
    }
    if (lines.length > count) {
      lines = _vagDistributeNarrationLines(lines, count);
    }
    return lines.slice(0, count);
  };

  function _vagSceneLineMatches(line, scene) {
    var text = String(line || '').toLowerCase();
    var words = _vagSceneKeywords([scene && scene.title, scene && scene.body, scene && Array.isArray(scene.lines) ? scene.lines.join(' ') : ''].filter(Boolean).join(' '));
    if (!words.length) return !!String(line || '').trim();
    var hits = words.filter(function (word) { return text.indexOf(word) >= 0; }).length;
    return hits >= Math.min(2, words.length);
  }

  function _vagCanonicalNarrationText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/makeke\.kr/g, '마케케닷케이알')
      .replace(/makeke/g, '마케케')
      .replace(/마케케\s*닷\s*케이알/g, '마케케닷케이알')
      .replace(/닷\s*케이알/g, '닷케이알')
      .replace(/[^\w가-힣]+/g, '');
  }

  function _vagNarrationContainsCTA(text, cta) {
    var hay = _vagCanonicalNarrationText(text);
    var needle = _vagCanonicalNarrationText(cta);
    if (!needle) return true;
    if (hay.indexOf(needle) >= 0) return true;
    var hasAction = /(상담|문의|신청|예약|확인|구매|시작)/.test(hay);
    var wantsAction = /(상담|문의|신청|예약|확인|구매|시작)/.test(needle);
    var hasBrand = /(마케케|makeke)/.test(hay);
    var wantsBrand = /(마케케|makeke)/.test(needle);
    if (wantsAction && wantsBrand) return hasAction && hasBrand;
    if (wantsAction) return hasAction;
    if (wantsBrand) return hasBrand;
    var tokens = String(cta || '').split(/[^\w가-힣]+/).filter(function (word) {
      return word.length >= 2 && !/^(https?|www|kr|com)$/.test(word.toLowerCase());
    });
    if (!tokens.length) return false;
    var hits = tokens.filter(function (word) { return hay.indexOf(_vagCanonicalNarrationText(word)) >= 0; }).length;
    return hits >= Math.min(2, tokens.length);
  }

  function _vagDedupeNarrationParts(parts) {
    var seen = [];
    return (Array.isArray(parts) ? parts : []).map(function (part) {
      return _vagCollapseRepeatedCopy(String(part || '').replace(/\s+/g, ' ').trim());
    }).filter(function (part) {
      if (!part) return false;
      var key = _vagCanonicalNarrationText(part);
      if (!key) return false;
      var duplicated = seen.some(function (seenKey) {
        if (seenKey === key) return true;
        var shorter = Math.min(seenKey.length, key.length);
        return shorter >= 4 && (seenKey.indexOf(key) >= 0 || key.indexOf(seenKey) >= 0);
      });
      if (duplicated) return false;
      seen.push(key);
      return true;
    });
  }

  function _vagCollapseRepeatedCopy(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    var domainDotToken = '__VAG_DOMAIN_DOT__';
    var protectedClean = clean.replace(/\b([A-Za-z0-9_-]+)\.(co\.kr|com|net|org|kr)\b/gi, function (_match, name, suffix) {
      return name + domainDotToken + String(suffix || '').replace(/\./g, domainDotToken);
    });
    var restoreDomainDots = function (value) {
      return String(value || '').replace(new RegExp(domainDotToken, 'g'), '.');
    };
    var parts = protectedClean.split(/([.!?。！？]+)/).reduce(function (acc, part, idx, arr) {
      if (idx % 2 === 0) {
        var sentence = restoreDomainDots(part).replace(/\s+/g, ' ').trim();
        if (!sentence) return acc;
        var punct = arr[idx + 1] || '';
        acc.push((sentence + punct).trim());
      }
      return acc;
    }, []);
    if (parts.length > 1) {
      return _vagDedupeNarrationParts(parts).join(' ').replace(/\s+/g, ' ').trim();
    }
    var words = restoreDomainDots(protectedClean).split(/\s+/).filter(Boolean);
    for (var size = Math.floor(words.length / 2); size >= 2; size--) {
      for (var start = 0; start + size * 2 <= words.length; start++) {
        var first = words.slice(start, start + size).join(' ').toLowerCase();
        var second = words.slice(start + size, start + size * 2).join(' ').toLowerCase();
        if (first && first === second) {
          words.splice(start + size, size);
          size = Math.floor(words.length / 2) + 1;
          break;
        }
      }
    }
    return words.join(' ').replace(/\s+/g, ' ').trim();
  }

  function _vagComposeSceneNarration(scene, idx, total, cta) {
    var sourceParts = [scene && scene.title, scene && scene.body];
    if (total <= 4 && scene && Array.isArray(scene.lines)) {
      sourceParts = sourceParts.concat(scene.lines.slice(0, 4));
    }
    var parts = _vagDedupeNarrationParts(sourceParts).slice(0, total <= 4 ? 4 : 2);
    parts = parts.map(function (part, partIdx) {
      return partIdx < parts.length - 1 ? part.replace(/[.!?。！？]+$/g, '') : part;
    });
    var text = parts.join('. ').replace(/\s+/g, ' ').trim();
    if (!text) text = _vagCleanSceneLine(scene && scene.narration) || '핵심 메시지를 확인하세요';
    if (idx === total - 1 && cta && !_vagNarrationContainsCTA(text, cta)) {
      text = text.replace(/[.!?。！？]*$/, '') + '. ' + String(cta).replace(/[.!?。！？]*$/, '') + '.';
    }
    text = _vagCollapseRepeatedCopy(text.replace(/([.!?。！？])\s*\1+/g, '$1').replace(/\s+/g, ' ').trim());
    if (text && !/[.!?。！？요다까죠니다]$/.test(text)) text += '.';
    return text;
  }

  V._vagBuildSceneSyncedNarration = function _vagBuildSceneSyncedNarration(html, fallbackTopic, script, options) {
    var opts = options || {};
    var plan = V._vagExtractSceneNarrationPlan(html, fallbackTopic, opts);
    plan = _vagRepairSceneNarrationPlan(plan, fallbackTopic, opts);
    var lines = V._vagSplitNarrationIntoSceneLines(script, plan.length);
    var cta = String(opts.cta || '').replace(/\s+/g, ' ').trim();
    var synced = plan.map(function (scene, idx) {
      var candidate = lines[idx] || '';
      var sceneText = _vagComposeSceneNarration(scene, idx, plan.length, cta);
      var text = (!opts.forceSceneCopy && candidate && _vagSceneLineMatches(candidate, scene)) ? candidate : sceneText;
      text = String(text || '').replace(/\s+/g, ' ').trim();
      if (idx === plan.length - 1 && cta && !_vagNarrationContainsCTA(text, cta)) {
        text = text.replace(/[.!?。！？]*$/, '') + '. ' + cta.replace(/[.!?。！？]*$/, '') + '.';
      }
      if (text && !/[.!?。！？요다까죠니다]$/.test(text)) text += '.';
      return Object.assign({}, scene, { narration: text });
    });
    return {
      plan: synced,
      script: synced.map(function (scene) { return scene.narration; }).filter(Boolean).join('\n').trim(),
    };
  };

  V._vagBuildSceneAlignedNarrationScript = function _vagBuildSceneAlignedNarrationScript(html, fallbackTopic, options) {
    var opts = options || {};
    return V._vagBuildSceneSyncedNarration(html, fallbackTopic, '', opts).script;
  };

  V._vagEnsureNarrationMinimumDensity = function _vagEnsureNarrationMinimumDensity(script, options) {
    var opts = options || {};
    var duration = Number(opts.duration || 0) || 0;
    var lines = String(script || '').split(/\n+/).map(function (line) {
      var clean = _vagCleanNarrationLineBeforeSpeech(line);
      return clean.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    var plan = Array.isArray(opts.plan) ? opts.plan : [];
    var targetChars = duration >= 12 ? Math.round(duration * 5.2) : 0;
    var currentChars = lines.join('').length;
    if (duration >= 12 && plan.length && currentChars < targetChars * 0.72) {
      var cta = String(opts.cta || '').replace(/\s+/g, ' ').trim();
      lines = plan.map(function (scene, idx) {
        var title = _vagCleanSceneLine(scene && scene.title);
        var body = _vagCleanSceneLine(scene && scene.body);
        var narration = _vagCleanNarrationLineBeforeSpeech((scene && scene.narration) || lines[idx] || '');
        var emphasis = Array.isArray(scene && scene.emphasis)
          ? scene.emphasis.map(_vagCleanSceneLine).filter(Boolean).slice(0, 2)
          : [];
        var imageCue = _vagCleanSceneLine(scene && (scene.imagePrompt || scene.image_prompt));
        var parts = _vagDedupeNarrationParts([narration, title, body].concat(emphasis));
        if (imageCue && idx !== plan.length - 1 && parts.join(' ').length < 90) {
          parts.push(imageCue.replace(/^(이미지|컷|장면)\s*(방향|연출)?\s*[:：]?\s*/i, ''));
        }
        var line = parts.join('. ').replace(/\s+/g, ' ').trim();
        line = _vagCollapseRepeatedCopy(line);
        if (idx === plan.length - 1 && cta && !_vagNarrationContainsCTA(line, cta)) {
          line = line.replace(/[.!?。！？]*$/, '') + '. ' + cta.replace(/[.!?。！？]*$/, '') + '.';
        }
        if (line && !/[.!?。！？요다까죠니다]$/.test(line)) line += '.';
        return line;
      }).filter(Boolean);
      currentChars = lines.join('').length;
      if (duration >= 45 && currentChars < targetChars * 0.58) {
        console.warn('[VAG] narration remains short after scene expansion', { duration: duration, targetChars: targetChars, currentChars: currentChars, lines: lines.length });
      }
    } else if (duration >= 45 && lines.length < 2) {
      console.warn('[VAG] narration too sparse; leaving user-visible scene script unchanged for manual correction.', { duration: duration, lines: lines.length });
    }
    return lines.join('\n').trim();
  };

  function _vagSplitNarrationForSceneCopy(line) {
    var clean = _vagCollapseRepeatedCopy(String(line || '').replace(/\s+/g, ' ').trim());
    if (!clean) return { title: '', body: '', emphasis: [] };
    var sentences = _vagDedupeNarrationParts(clean.split(/[.!?。！？]+/).map(function (part) {
      return part.replace(/\s+/g, ' ').trim();
    }).filter(Boolean));
    var title = sentences[0] || clean;
    if (title.length > 30) {
      var words = title.split(/\s+/);
      var picked = [];
      var length = 0;
      words.forEach(function (word) {
        if (picked.length && length + word.length > 30) return;
        picked.push(word);
        length += word.length + 1;
      });
      title = (picked.join(' ') || title.slice(0, 30)).trim();
    }
    var body = _vagDedupeNarrationParts(sentences.slice(1)).join('. ').trim();
    if (body && _vagCanonicalNarrationText(title) === _vagCanonicalNarrationText(body)) body = '';
    if (!body && title !== clean && _vagCanonicalNarrationText(title) !== _vagCanonicalNarrationText(clean)) body = clean;
    var emphasis = _vagDedupeNarrationParts(sentences.slice(1).concat([body, title])).filter(function (part) {
      return part && part.length <= 28 && _vagCanonicalNarrationText(part) !== _vagCanonicalNarrationText(title);
    }).slice(0, 3);
    return { title: title, body: body, emphasis: emphasis };
  }

  function _vagIsDuplicateVisibleCopy(text, keepKeys, seenKeys) {
    var key = _vagCanonicalNarrationText(text);
    if (!key) return false;
    var keys = (keepKeys || []).concat(seenKeys || []);
    return keys.some(function (other) {
      if (!other) return false;
      if (other === key) return true;
      var shorter = Math.min(other.length, key.length);
      return shorter >= 4 && (other.indexOf(key) >= 0 || key.indexOf(other) >= 0);
    });
  }

  function _vagHideDuplicateSceneText(candidates, keepEls, desiredParts) {
    var keep = keepEls || [];
    var keepKeys = (desiredParts || []).map(function (part) {
      return _vagCanonicalNarrationText(part);
    }).filter(Boolean);
    var seenKeys = [];
    (candidates || []).forEach(function (el) {
      if (!el || keep.indexOf(el) >= 0) return;
      var text = _vagCollapseRepeatedCopy(String(el.textContent || '').replace(/\s+/g, ' ').trim());
      if (!text) return;
      var key = _vagCanonicalNarrationText(text);
      if (!key) return;
      if (_vagIsDuplicateVisibleCopy(text, keepKeys, seenKeys)) {
        el.textContent = '';
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.setAttribute('data-vag-duplicate-hidden', '1');
        return;
      }
      seenKeys.push(key);
    });
  }

  function _vagBuildEmphasisParts(copy) {
    var desired = [];
    if (copy && Array.isArray(copy.emphasis)) desired = desired.concat(copy.emphasis);
    desired = desired.concat([copy && copy.body, copy && copy.title]);
    var seen = [];
    var out = [];
    desired.forEach(function (rawPart) {
      var part = _vagCleanSceneLine(rawPart);
      if (!part || part.length < 2) return;
      if (part.length > 26) {
        var pieces = part.split(/[·,\/|→\-]+/).map(function (piece) {
          return _vagCleanSceneLine(piece);
        }).filter(function (piece) {
          return piece.length >= 2 && piece.length <= 18;
        });
        part = pieces[0] || part.slice(0, 24).trim();
      }
      var key = _vagCanonicalNarrationText(part);
      if (!key || seen.indexOf(key) >= 0) return;
      seen.push(key);
      out.push(part);
    });
    return out.slice(0, 3);
  }

  function _vagSyncEmphasisToSceneCopy(node, copy, protectedEls) {
    if (!node || !node.querySelectorAll) return;
    var keep = protectedEls || [];
    var parts = _vagBuildEmphasisParts(copy);
    var emphasisCandidates = Array.prototype.slice.call(node.querySelectorAll(
      '[data-vag-emphasis],[data-vag-highlight],.chip,.chips span,.badge,.tag,.pill,.label,.kicker,strong,em,mark,[class*="chip"],[class*="badge"],[class*="tag"],[class*="pill"],[class*="highlight"],[class*="accent"],[class*="num"]'
    )).filter(function (el) {
      if (!el || keep.indexOf(el) >= 0) return false;
      if (keep.some(function (kept) { return kept && kept.contains && kept.contains(el); })) return false;
      if (/^(SCRIPT|STYLE|AUDIO|VIDEO|SVG|CANVAS|IMG)$/i.test(el.tagName || '')) return false;
      if (el.querySelector && el.querySelector('h1,h2,h3,p,.headline,.title,.subtitle,.copy,.caption,.kicker,.chip,.badge,.tag,.pill,strong,em,mark')) return false;
      var text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length >= 1 && text.length <= 80;
    });
    if (!emphasisCandidates.length) return;
    var desiredKeys = parts.map(function (part) { return _vagCanonicalNarrationText(part); }).filter(Boolean);
    emphasisCandidates.forEach(function (el, idx) {
      if (idx < parts.length) {
        el.textContent = parts[idx];
        el.setAttribute('data-vag-synced-copy', 'emphasis');
        return;
      }
      var key = _vagCanonicalNarrationText(el.textContent || '');
      if (!key || desiredKeys.indexOf(key) < 0) {
        el.textContent = '';
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.setAttribute('data-vag-duplicate-hidden', '1');
      }
    });
  }

  function _vagPruneDuplicateSceneText(node) {
    if (!node || !node.querySelectorAll) return;
    var candidates = Array.prototype.slice.call(node.querySelectorAll(
      '[data-vag-primary-text],h1,h2,h3,.headline,.title,.subtitle,.copy,.caption,.kicker,p,span'
    )).filter(function (el) {
      if (!el || /^(SCRIPT|STYLE|AUDIO|VIDEO|SVG|CANVAS)$/i.test(el.tagName || '')) return false;
      if (el.querySelector && el.querySelector('h1,h2,h3,p,.headline,.title,.subtitle,.copy,.caption,.kicker')) return false;
      return String(el.textContent || '').replace(/\s+/g, ' ').trim().length >= 2;
    });
    var seen = [];
    candidates.forEach(function (el) {
      var text = _vagCollapseRepeatedCopy(String(el.textContent || '').replace(/\s+/g, ' ').trim());
      var key = _vagCanonicalNarrationText(text);
      if (!key) return;
      if (seen.indexOf(key) >= 0) {
        el.textContent = '';
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        el.setAttribute('data-vag-duplicate-hidden', '1');
      } else {
        seen.push(key);
      }
    });
  }

  function _vagMirrorNarrationToSceneCopy(node, line) {
    var copy = _vagSplitNarrationForSceneCopy(line);
    if (!copy.title && !copy.body) return;
    var candidates = Array.prototype.slice.call(node.querySelectorAll(
      '[data-vag-primary-text],h1,h2,h3,.headline,.title,.subtitle,.copy,.caption,.kicker,p,span'
    )).filter(function (el) {
      if (!el || /^(SCRIPT|STYLE|AUDIO|VIDEO|SVG|CANVAS)$/i.test(el.tagName || '')) return false;
      var text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2 || text.length > 180) return false;
      return !el.querySelector('h1,h2,h3,p,.headline,.title,.subtitle,.copy,.caption,.kicker');
    });
    if (!candidates.length) return;
    var titleTarget = candidates.find(function (el) {
      return /^(H1|H2|H3)$/i.test(el.tagName || '') || /\b(headline|title|kicker)\b/.test(String(el.className || ''));
    }) || candidates[0];
    titleTarget.textContent = copy.title || copy.body;
    titleTarget.setAttribute('data-vag-synced-copy', 'title');
    var keepEls = [titleTarget];
    if (!copy.body) {
      _vagSyncEmphasisToSceneCopy(node, copy, keepEls);
      _vagHideDuplicateSceneText(candidates, keepEls, [copy.title]);
      return;
    }
    var bodyTarget = candidates.find(function (el) {
      return el !== titleTarget && (/^(P|SPAN)$/i.test(el.tagName || '') || /\b(subtitle|copy|caption)\b/.test(String(el.className || '')));
    });
    if (bodyTarget) {
      bodyTarget.textContent = copy.body;
      bodyTarget.setAttribute('data-vag-synced-copy', 'body');
      keepEls.push(bodyTarget);
    }
    _vagSyncEmphasisToSceneCopy(node, copy, keepEls);
    _vagHideDuplicateSceneText(candidates, keepEls, [copy.title, copy.body].concat(copy.emphasis || []));
  }

  function _vagRemoveSceneCaptionOverlays(doc) {
    if (!doc) return;
    Array.prototype.slice.call(doc.querySelectorAll('.vag-sync-caption,[data-vag-subtitle-overlay]')).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    Array.prototype.slice.call(doc.querySelectorAll('style[data-vag-sync-caption-style]')).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function _vagCleanNarrationLineBeforeSpeech(line) {
    var text = String(line || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (/[가-힣]/.test(text)) {
      text = text
        .replace(/\b(?:WASTED?|BUDGET|MONEY|ADS?|NO\s+CONVERSION|CONVERSION)\b/gi, '')
        .replace(/\b[A-Z]{3,}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return text;
  }

  function _vagInjectBrandColorLock(html, brandColor) {
    var color = String(brandColor || '').trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(color) || !html) return html;
    var css = '<style data-vag-brand-color-lock="true">:root{--brand:' + color + ';--accent:' + color + ';}' +
      '[data-composition-id],#stage{--brand:' + color + ';--accent:' + color + ';}' +
      '.clip [class*="btn"],.clip [class*="chip"],.clip [class*="badge"],.clip [class*="bar"],.clip [class*="line"],.clip [class*="hl"],.clip [class*="url"]{border-color:var(--brand)!important;}' +
      '.clip [class*="chip"],.clip [class*="btn"],.clip [class*="bar"],.clip [class*="hl"]{background-color:var(--brand)!important;color:#fff!important;}' +
      '.clip [class*="url"],.clip [class*="accent"],.clip [class*="num"],.clip strong,.clip mark{color:var(--brand)!important;}' +
      '</style>';
    var cleaned = html.replace(/<style[^>]*data-vag-brand-color-lock=["'][^"']*["'][^>]*>[\s\S]*?<\/style>/gi, '');
    if (/<\/head>/i.test(cleaned)) return cleaned.replace(/<\/head>/i, css + '</head>');
    return css + cleaned;
  }

  V._vagValidateBrandApplication = function _vagValidateBrandApplication(html, options) {
    var opts = options || {};
    var color = String(opts.brandColor || '').trim().toLowerCase();
    var htmlText = String(html || '').toLowerCase();
    var hasColor = !color || htmlText.indexOf(color) >= 0 || /data-vag-brand-color-lock/.test(String(html || ''));
    var hasBrandVars = !color || /--brand|--accent|data-vag-brand-color-lock/.test(String(html || ''));
    var hasLogo = true;
    return { ok: hasColor && hasBrandVars && hasLogo, hasColor: hasColor, hasBrandVars: hasBrandVars, hasLogo: hasLogo };
  };

  V._vagApplyBrandColorLock = function _vagApplyBrandColorLock(html, brandColor) {
    return _vagInjectBrandColorLock(html, brandColor);
  };

  V._vagApplySceneNarrationToHtml = function _vagApplySceneNarrationToHtml(html, sceneNarrations, options) {
    if (!html || !Array.isArray(sceneNarrations) || !sceneNarrations.length) return html;
    var opts = options || {};
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return html;
    _vagRemoveSceneCaptionOverlays(doc);
    var nodes = Array.prototype.slice.call(stage.querySelectorAll('[data-start]'))
      .filter(function (node) { return _vagIsVisualSceneNode(stage, node); })
      .sort(function (a, b) {
        return (parseFloat(a.getAttribute('data-start') || '0') || 0) - (parseFloat(b.getAttribute('data-start') || '0') || 0);
    });
    nodes.forEach(function (node, idx) {
      var line = _vagCleanNarrationLineBeforeSpeech(sceneNarrations[idx]);
      if (typeof V._vagNormalizeNarrationForSpeech === 'function') line = V._vagNormalizeNarrationForSpeech(line, {});
      line = _vagCollapseRepeatedCopy(line);
      if (!line) return;
      node.setAttribute('data-vag-narration', line);
      if (opts.mirrorVisible) _vagMirrorNarrationToSceneCopy(node, line);
      _vagPruneDuplicateSceneText(node);
    });
    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  };

  V._vagFitSceneDurationsToNarration = function _vagFitSceneDurationsToNarration(html, script, audioDuration, targetDuration) {
    if (!html || !script || !audioDuration) return html;
    var rawLines = String(script || '').split(/\n+/).map(function (line) {
      return line.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    if (rawLines.length < 2) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return html;
    var nodes = Array.prototype.slice.call(stage.querySelectorAll('[data-start]'))
      .filter(function (node) { return _vagIsVisualSceneNode(stage, node); })
      .sort(function (a, b) {
        return (parseFloat(a.getAttribute('data-start') || '0') || 0) - (parseFloat(b.getAttribute('data-start') || '0') || 0);
      });
    if (nodes.length < 2) return html;
    var lines = typeof V._vagSplitNarrationIntoSceneLines === 'function'
      ? V._vagSplitNarrationIntoSceneLines(rawLines.join('\n'), nodes.length)
      : rawLines;
    if (lines.length !== nodes.length && rawLines.length > nodes.length) {
      lines = _vagDistributeNarrationLines(rawLines, nodes.length);
    }
    var requestedTotal = Number(targetDuration || 0) || 0;
    var audioTotal = Number(audioDuration || 0) ? Number(audioDuration || 0) + 0.4 : 0;
    var visualTotal = nodes.reduce(function (maxEnd, node) {
      var start = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var dur = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      return Math.max(maxEnd, start + dur);
    }, 0);
    var total = Math.max(audioTotal || 0, requestedTotal || 0, visualTotal || 0);
    var originalTimings = nodes.map(function (node, idx) {
      var key = 'scene-' + idx;
      node.setAttribute('data-vag-timing-scene', key);
      var start = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var dur = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      return {
        selector: '[data-vag-timing-scene="' + key + '"]',
        start: start,
        end: start + dur,
      };
    });
    var weights = nodes.map(function (_node, idx) {
      return Math.max(8, String(lines[Math.min(idx, lines.length - 1)] || '').length);
    });
    var weightSum = weights.reduce(function (sum, weight) { return sum + weight; }, 0) || nodes.length;
    var cursor = 0;
    var updatedTimings = [];
    nodes.forEach(function (node, idx) {
      var remainingNodes = nodes.length - idx - 1;
      var minRemaining = remainingNodes * 1.2;
      var rawDuration = total * (weights[idx] / weightSum);
      var duration = idx === nodes.length - 1
        ? Math.max(1.2, total - cursor)
        : Math.max(1.2, Math.min(rawDuration, total - cursor - minRemaining));
      node.setAttribute('data-start', cursor.toFixed(2));
      node.setAttribute('data-duration', duration.toFixed(2));
      var narration = lines[Math.min(idx, lines.length - 1)] || '';
      if (narration) node.setAttribute('data-vag-narration', narration);
      updatedTimings.push({
        selector: originalTimings[idx] && originalTimings[idx].selector,
        start: cursor,
        end: cursor + duration,
      });
      cursor += duration;
    });
    stage.setAttribute('data-duration', String(Math.ceil(Math.max(total, cursor))));
    var fitted = _vagPatchTimelineDuration(V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML), Math.max(total, cursor));
    return _vagInstallSceneTimingMapper(fitted, originalTimings, updatedTimings, Math.max(total, cursor));
  };

  V._vagNarrationMatchesScenes = function _vagNarrationMatchesScenes(script, sceneTexts) {
    var scenes = Array.isArray(sceneTexts) ? sceneTexts : [];
    if (!String(script || '').trim() || !scenes.length) return false;
    var lines = V._vagSplitNarrationIntoSceneLines(script, scenes.length);
    if (lines.length !== scenes.length) return false;
    var matched = 0;
    scenes.forEach(function (scene, idx) {
      var sceneBody = String(scene || '').replace(/^\s*장면\s*\d+\s*:\s*/i, '');
      var pseudoScene = { title: sceneBody, body: '', lines: [sceneBody] };
      if (_vagSceneLineMatches(lines[idx], pseudoScene)) matched += 1;
    });
    return matched >= Math.max(1, Math.ceil(scenes.length * 0.75));
  };

  V._vagEnsureMotionFonts = function _vagEnsureMotionFonts(html) {
    if (!html) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    if (!doc || !doc.documentElement) return html;
    var head = doc.querySelector('head');
    if (!head) {
      head = doc.createElement('head');
      doc.documentElement.insertBefore(head, doc.body || null);
    }
    if (!head.querySelector('link[data-vag-fonts="preconnect"]')) {
      var pre1 = doc.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      pre1.setAttribute('data-vag-fonts', 'preconnect');
      head.appendChild(pre1);
      var pre2 = doc.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      pre2.setAttribute('data-vag-fonts', 'preconnect');
      head.appendChild(pre2);
    }
    if (!head.querySelector('link[data-vag-fonts="families"]')) {
      var link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Gugi&family=Noto+Sans+KR:wght@400;600;800;900&display=swap';
      link.setAttribute('data-vag-fonts', 'families');
      head.appendChild(link);
    }
    if (!head.querySelector('style[data-vag-fonts="scene-stack"]')) {
      var style = doc.createElement('style');
      style.setAttribute('data-vag-fonts', 'scene-stack');
      style.textContent = [
        ':root{--vag-font-body:"Noto Sans KR",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--vag-font-display:"Black Han Sans","Noto Sans KR",system-ui,sans-serif;--vag-font-accent:"Gugi","Do Hyeon","Noto Sans KR",system-ui,sans-serif;}',
        '[data-composition-id],#stage{font-family:var(--vag-font-body);}',
        '.scene h1,.scene .headline,.scene .title{font-family:var(--vag-font-display);font-weight:400;letter-spacing:0;}',
        '.scene .chip,.scene .badge,.scene .kicker,.scene [data-font="accent"]{font-family:var(--vag-font-accent);letter-spacing:0;}',
      ].join('\n');
      head.appendChild(style);
    }
    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  };

  V._vagInjectBgmAudio = function _vagInjectBgmAudio(html, audioUrl, duration, volume, sourceDuration) {
    if (!html || !audioUrl) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return html;
    Array.from(stage.querySelectorAll('audio[id^="bgm"]')).forEach(function (prev) {
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    });
    var targetDuration = duration ? Math.max(0.1, Number(duration) || 0) : 30;
    var actualDuration = sourceDuration ? Math.max(0.1, Number(sourceDuration) || 0) : 0;
    var segmentDuration = actualDuration > 0 ? Math.min(actualDuration, targetDuration) : targetDuration;
    var baseVolume = typeof volume === 'number' ? volume : 0.25;
    var fadeInSec = Math.min(0.8, Math.max(0.2, targetDuration * 0.12));
    var fadeOutSec = Math.min(1.2, Math.max(0.25, targetDuration * 0.16));
    if (targetDuration < 3) {
      fadeInSec = Math.min(0.35, targetDuration * 0.18);
      fadeOutSec = Math.min(0.45, targetDuration * 0.22);
    }
    function bgmVolumeAt(start, clipDuration) {
      var midpoint = start + (clipDuration / 2);
      var multiplier = 1;
      if (fadeInSec > 0 && midpoint < fadeInSec) {
        multiplier = Math.max(0.04, midpoint / fadeInSec);
      }
      if (fadeOutSec > 0 && midpoint > targetDuration - fadeOutSec) {
        multiplier = Math.min(multiplier, Math.max(0.04, (targetDuration - midpoint) / fadeOutSec));
      }
      return Math.max(0, Math.round(baseVolume * multiplier * 1000) / 1000);
    }
    function appendBgmClip(start, clipDuration, mediaStart) {
      if (clipDuration <= 0.03) return;
      var audio = doc.createElement('audio');
      audio.id = index === 1 ? 'bgm' : 'bgm-' + index;
      audio.setAttribute('class', 'clip');
      audio.setAttribute('data-start', String(Math.round(start * 100) / 100));
      audio.setAttribute('data-duration', String(Math.round(clipDuration * 100) / 100));
      audio.setAttribute('data-media-start', String(Math.round(Math.max(0, mediaStart || 0) * 100) / 100));
      audio.setAttribute('data-track-index', '1');
      audio.setAttribute('data-volume', String(bgmVolumeAt(start, clipDuration)));
      audio.setAttribute('data-bgm-fade-in', String(Math.round(fadeInSec * 100) / 100));
      audio.setAttribute('data-bgm-fade-out', String(Math.round(fadeOutSec * 100) / 100));
      audio.setAttribute('src', audioUrl);
      if (actualDuration > 0) audio.setAttribute('data-bgm-source-duration', String(Math.round(actualDuration * 100) / 100));
      stage.appendChild(audio);
      index += 1;
    }
    var cursor = 0;
    var mediaCursor = 0;
    var index = 1;
    while (cursor < targetDuration - 0.05 && index <= 120) {
      var remaining = Math.max(0.1, targetDuration - cursor);
      var nextFadeBoundary = cursor < fadeInSec
        ? fadeInSec
        : cursor < targetDuration - fadeOutSec
          ? targetDuration - fadeOutSec
          : targetDuration;
      var maxChunk = (cursor < fadeInSec || cursor >= targetDuration - fadeOutSec) ? 0.25 : remaining;
      var sourceLeft = actualDuration > 0 ? Math.max(0.1, segmentDuration - mediaCursor) : remaining;
      var clipDuration = Math.min(maxChunk, remaining, sourceLeft, Math.max(0.1, nextFadeBoundary - cursor));
      appendBgmClip(cursor, clipDuration, mediaCursor);
      cursor = Math.round((cursor + clipDuration) * 100) / 100;
      mediaCursor = Math.round((mediaCursor + clipDuration) * 100) / 100;
      if (actualDuration > 0 && mediaCursor >= segmentDuration - 0.05) mediaCursor = 0;
    }
    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  }

  function _vagPatchTimelineDuration(html, duration) {
    var nextDur = Math.ceil(Math.round((Number(duration) || 0) * 100) / 100);
    if (!html || !nextDur) return html || '';
    var durationText = String(nextDur);
    return String(html)
      .replace(/window\.__hf=\{duration:\s*\d+(?:\.\d+)?/g, 'window.__hf={duration:' + durationText)
      .replace(/Math\.min\(\s*\d+(?:\.\d+)?\s*,\s*v\s*\)/g, 'Math.min(' + durationText + ',v)')
      .replace(/tl\.to\("#bar",\{width:"100%",duration:\s*\d+(?:\.\d+)?/g, 'tl.to("#bar",{width:"100%",duration:' + durationText);
  }

  function _vagInstallSceneTimingMapper(html, originalTimings, updatedTimings, targetDuration) {
    var original = Array.isArray(originalTimings) ? originalTimings : [];
    var updated = Array.isArray(updatedTimings) ? updatedTimings : [];
    var target = Math.max(0.1, Number(targetDuration || 0) || 0);
    if (!html || original.length < 2 || original.length !== updated.length || !target) return html || '';
    var idMatch = String(html).match(/window\.__timelines\[['"]([^'"]+)['"]\]\s*=\s*tl/);
    var timelineId = idMatch && idMatch[1] ? idMatch[1] : 'makeke-html-motion';
    var scenes = updated.map(function (scene, idx) {
      var source = original[idx] || {};
      return {
        selector: scene.selector || source.selector || '',
        start: Number(scene.start || 0) || 0,
        end: Number(scene.end || 0) || 0,
        sourceStart: Number(source.start || 0) || 0,
        sourceEnd: Number(source.end || 0) || 0,
      };
    }).filter(function (scene) {
      return scene.selector && scene.end > scene.start && scene.sourceEnd > scene.sourceStart;
    });
    if (scenes.length < 2) return html || '';
    var script = '<script data-vag-scene-timing-map="true">(function(){' +
      'var target=' + target.toFixed(3) + ',id=' + JSON.stringify(timelineId) + ',scenes=' + JSON.stringify(scenes) + ';' +
      'function clamp(v,a,b){return Math.max(a,Math.min(b,v));}' +
      'function pick(t){for(var i=0;i<scenes.length;i++){if(t>=scenes[i].start-0.03&&t<scenes[i].end-0.03)return i;}return t>=scenes[scenes.length-1].start?scenes.length-1:0;}' +
      'function show(active){for(var i=0;i<scenes.length;i++){var el=null;try{el=document.querySelector(scenes[i].selector);}catch(e){}if(!el)continue;var on=i===active;el.style.opacity=on?"1":"0";el.style.visibility=on?"visible":"hidden";el.style.pointerEvents=on?"":"none";}}' +
      'function install(){var prev=window.__hf||{};if(prev.__vagSceneTimingMap)return;var seek=function(t){var v=clamp(Number(t)||0,0,target),idx=pick(v),s=scenes[idx];var p=s.end>s.start?clamp((v-s.start)/(s.end-s.start),0,1):0;var mapped=s.sourceStart+p*(s.sourceEnd-s.sourceStart);var tl=window.__timelines&&window.__timelines[id];if(tl&&tl.seek){tl.seek(mapped,false);}else if(prev.seek&&prev.seek!==seek){prev.seek(v);}show(idx);};window.__hf=Object.assign({},prev,{duration:target,seek:seek,__vagSceneTimingMap:true});requestAnimationFrame(function(){if(window.__hf&&window.__hf.seek)window.__hf.seek(0);});}' +
      'install();if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){requestAnimationFrame(install);setTimeout(install,60);});}else{requestAnimationFrame(install);setTimeout(install,60);}' +
      '})();</script>';
    var cleaned = String(html)
      .replace(/<script[^>]*data-vag-scene-timing-map=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script[^>]*data-vag-timeline-stretch=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
    if (/<\/body>/i.test(cleaned)) return cleaned.replace(/<\/body>/i, script + '\n</body>');
    return cleaned + '\n' + script;
  }

  function _vagTimedVisualNodes(stage) {
    if (!stage) return [];
    return Array.prototype.slice.call(stage.querySelectorAll('[data-start]')).filter(function (clip) {
      return clip !== stage && _vagIsVisualSceneNode(stage, clip);
    }).sort(function (a, b) {
      return (parseFloat(a.getAttribute('data-start') || '0') || 0) - (parseFloat(b.getAttribute('data-start') || '0') || 0);
    });
  }

  function _vagExtendLastVisualSceneToDuration(html, targetDuration) {
    var target = Math.max(0, Number(targetDuration || 0) || 0);
    if (!html || !target) return { html: html || '', changed: false, beforeEnd: 0, afterEnd: 0 };
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return { html: html, changed: false, beforeEnd: 0, afterEnd: 0 }; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return { html: html, changed: false, beforeEnd: 0, afterEnd: 0 };
    var nodes = _vagTimedVisualNodes(stage);
    if (!nodes.length) return { html: html, changed: false, beforeEnd: 0, afterEnd: 0 };
    var visualEnd = 0;
    var last = null;
    nodes.forEach(function (node) {
      var s = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      var end = s + d;
      if (end >= visualEnd) {
        visualEnd = end;
        last = node;
      }
    });
    if (!last || visualEnd + 0.05 >= target) {
      stage.setAttribute('data-duration', String(Math.ceil(Math.max(target, visualEnd))));
      return {
        html: _vagPatchTimelineDuration(V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML), Math.max(target, visualEnd)),
        changed: false,
        beforeEnd: visualEnd,
        afterEnd: Math.max(target, visualEnd),
      };
    }
    var start = parseFloat(last.getAttribute('data-start') || '0') || 0;
    var duration = parseFloat(last.getAttribute('data-duration') || '0') || 0;
    last.setAttribute('data-duration', Math.max(0.35, duration + (target - visualEnd)).toFixed(2));
    stage.setAttribute('data-duration', String(Math.ceil(target)));
    var output = V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
    return {
      html: _vagPatchTimelineDuration(output, target),
      changed: true,
      beforeEnd: visualEnd,
      afterEnd: Math.max(target, start + duration + (target - visualEnd)),
    };
  }

  function _vagInstallSeekStretch(html, sourceDuration, targetDuration) {
    var source = Math.max(0.1, Number(sourceDuration || 0) || 0);
    var target = Math.max(0.1, Number(targetDuration || 0) || 0);
    if (!html || !source || !target || Math.abs(source - target) <= Math.max(0.4, target * 0.08)) return html || '';
    var idMatch = String(html).match(/window\.__timelines\[['"]([^'"]+)['"]\]\s*=\s*tl/);
    var timelineId = idMatch && idMatch[1] ? idMatch[1] : 'makeke-html-motion';
    var script = '<script data-vag-timeline-stretch="true">(function(){' +
      'var target=' + target.toFixed(3) + ',source=' + source.toFixed(3) + ',id=' + JSON.stringify(timelineId) + ';' +
      'var prev=window.__hf||{};' +
      'window.__hf={duration:target,seek:function(t){var v=Math.max(0,Math.min(target,Number(t)||0));var mapped=Math.max(0,Math.min(source,v*(source/target)));var tl=window.__timelines&&window.__timelines[id];if(tl&&tl.seek){tl.seek(mapped,false);}else if(prev.seek){prev.seek(mapped);}}};' +
      '})();</script>';
    var cleaned = String(html).replace(/<script[^>]*data-vag-timeline-stretch=["'][^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
    if (/<\/body>/i.test(cleaned)) return cleaned.replace(/<\/body>/i, script + '\n</body>');
    return cleaned + '\n' + script;
  }

  V._vagStretchMotionTimelineToDuration = function _vagStretchMotionTimelineToDuration(html, targetDuration) {
    var target = Number(targetDuration || 0) || 0;
    if (!html || target <= 0) return { html: html || '', changed: false, beforeEnd: 0, afterEnd: 0 };
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return { html: html, changed: false, beforeEnd: 0, afterEnd: 0 }; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return { html: html, changed: false, beforeEnd: 0, afterEnd: 0 };
    var nodes = _vagTimedVisualNodes(stage);
    var visualEnd = nodes.reduce(function (maxEnd, node) {
      var s = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      return Math.max(maxEnd, s + d);
    }, 0);
    if (!visualEnd || Math.abs(visualEnd - target) <= Math.max(0.4, target * 0.08)) {
      stage.setAttribute('data-duration', String(Math.ceil(Math.max(target, visualEnd))));
      return { html: _vagPatchTimelineDuration(V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML), Math.max(target, visualEnd)), changed: false, beforeEnd: visualEnd, afterEnd: visualEnd };
    }
    var originalTimings = nodes.map(function (node, idx) {
      var key = node.getAttribute('data-vag-timing-scene') || ('scene-' + idx);
      node.setAttribute('data-vag-timing-scene', key);
      var s = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      return { selector: '[data-vag-timing-scene="' + key + '"]', start: s, end: s + d };
    });
    var scale = target / visualEnd;
    var updatedTimings = [];
    nodes.forEach(function (node, idx) {
      var s = parseFloat(node.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(node.getAttribute('data-duration') || '0') || 0;
      var nextStart = s * scale;
      var nextDuration = Math.max(0.35, d * scale);
      node.setAttribute('data-start', nextStart.toFixed(2));
      node.setAttribute('data-duration', nextDuration.toFixed(2));
      updatedTimings.push({
        selector: originalTimings[idx] && originalTimings[idx].selector,
        start: nextStart,
        end: nextStart + nextDuration,
      });
    });
    stage.setAttribute('data-duration', String(Math.ceil(target)));
    var stretched = V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
    stretched = _vagPatchTimelineDuration(stretched, target);
    stretched = _vagInstallSceneTimingMapper(stretched, originalTimings, updatedTimings, target);
    return { html: stretched, changed: true, beforeEnd: visualEnd, afterEnd: target };
  };

  function _vagReadMotionTiming(html) {
    var out = { ok: false, sceneCount: 0, visualEnd: 0, audioEnd: 0, narrationEnd: 0, bgmEnd: 0, stageDuration: 0, issues: [] };
    if (!html) {
      out.issues.push('HTML 비어 있음');
      return out;
    }
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) {
      out.issues.push('HTML 파싱 실패');
      return out;
    }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) {
      out.issues.push('composition root 없음');
      return out;
    }
    out.stageDuration = parseFloat(stage.getAttribute('data-duration') || '0') || 0;
    var clips = stage.querySelectorAll('[data-start]');
    clips.forEach(function (clip) {
      var tag = (clip.tagName || '').toLowerCase();
      var s = parseFloat(clip.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(clip.getAttribute('data-duration') || '0') || 0;
      var end = s + d;
      if (tag === 'audio') {
        out.audioEnd = Math.max(out.audioEnd, end);
        if ((clip.id || '') === 'narration') out.narrationEnd = Math.max(out.narrationEnd, end);
        if (/^bgm(?:-\d+)?$/.test(clip.id || '')) out.bgmEnd = Math.max(out.bgmEnd, end);
        return;
      }
      if (clip === stage || !_vagIsVisualSceneNode(stage, clip)) return;
      out.sceneCount += 1;
      out.visualEnd = Math.max(out.visualEnd, end);
      var text = (clip.textContent || '').replace(/\s+/g, ' ').trim();
      var hasImage = tag === 'img' || tag === 'svg' || tag === 'canvas' || tag === 'video' || !!(clip.querySelector && clip.querySelector('img,video,svg,canvas'));
      if (!text && !hasImage) out.issues.push('빈 장면 감지: ' + ((clip.id || clip.className || 'unknown')));
      if (d <= 0.2) out.issues.push('장면 길이 너무 짧음: ' + ((clip.id || 'unknown')) + ' ' + d + '초');
    });
    if (!out.sceneCount) out.issues.push('시각 장면 없음');
    if (out.stageDuration >= 45 && out.sceneCount < 3) out.issues.push('장면 수 부족: ' + out.sceneCount + '개');
    if (out.audioEnd > out.visualEnd + 1.25) out.issues.push('나레이션이 화면보다 김: audio ' + out.audioEnd.toFixed(1) + '초 / visual ' + out.visualEnd.toFixed(1) + '초');
    if (out.stageDuration + 0.5 < Math.max(out.visualEnd, out.audioEnd)) out.issues.push('stage duration 부족');
    out.ok = out.issues.length === 0;
    return out;
  }

  V._vagPreflightMotionHtml = function _vagPreflightMotionHtml(html, options) {
    var opts = options || {};
    var timing = _vagReadMotionTiming(html);
    var fixedHtml = html || '';
    var fixed = false;
    var requestedTarget = Number(opts.duration || 0) || 0;
    var target = requestedTarget > 0
      ? requestedTarget
      : Math.max(timing.stageDuration || 0, timing.visualEnd || 0, timing.narrationEnd || 0);
    if (target > 0) {
      fixedHtml = _vagPatchTimelineDuration(fixedHtml, target);
      fixed = fixedHtml !== html;
      var stretched = V._vagStretchMotionTimelineToDuration(fixedHtml, target);
      if (stretched && stretched.html) {
        fixedHtml = stretched.html;
        fixed = fixed || !!stretched.changed;
        if (stretched.changed) timing.issues.push('시각 타임라인이 목표 길이보다 짧아 전체 길이에 맞춰 확장: visual ' + stretched.beforeEnd.toFixed(1) + '초 -> ' + target.toFixed(1) + '초');
      }
    }
    var after = _vagReadMotionTiming(fixedHtml);
    var audioTarget = Math.max(Number(after.narrationEnd || 0) || 0, Number(after.audioEnd || 0) || 0, target || 0);
    if (audioTarget > 0 && after.visualEnd > 0 && after.visualEnd + 0.15 < audioTarget) {
      var extended = _vagExtendLastVisualSceneToDuration(fixedHtml, audioTarget);
      if (extended && extended.html) {
        fixedHtml = extended.html;
        fixed = fixed || !!extended.changed;
        after = _vagReadMotionTiming(fixedHtml);
      }
    }
    if (opts.requireNarration) {
      var targetDuration = Number(opts.duration || after.stageDuration || after.visualEnd || 0) || 0;
      if (!after.narrationEnd) after.issues.push('나레이션 오디오 없음: target ' + targetDuration.toFixed(1) + '초');
    }
    if (after.bgmEnd && target > 0 && after.bgmEnd > target + 0.5) {
      var doc;
      try { doc = new DOMParser().parseFromString(fixedHtml, 'text/html'); } catch (_) { doc = null; }
      var bgmClips = doc ? Array.from(doc.querySelectorAll('audio[id^="bgm"]')) : [];
      if (bgmClips.length) {
        var lastBgm = bgmClips[bgmClips.length - 1];
        var lastStart = parseFloat(lastBgm.getAttribute('data-start') || '0') || 0;
        lastBgm.setAttribute('data-duration', String(Math.max(0.1, Math.ceil((target - lastStart) * 100) / 100)));
        fixedHtml = V._vagPreserveHead(fixedHtml, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
        fixedHtml = _vagPatchTimelineDuration(fixedHtml, target);
        fixed = true;
        after = _vagReadMotionTiming(fixedHtml);
      }
    }
    after.ok = after.issues.length === 0;
    return {
      ok: after.ok || (after.sceneCount > 0 && after.visualEnd + 0.5 >= after.audioEnd),
      html: fixedHtml,
      fixed: fixed,
      before: timing,
      after: after,
      issues: after.issues || [],
    };
  };

  function _vagNormalizeNarrationForSpeech(script, options) {
    var opts = options || {};
    var raw = String(script || '')
      .replace(/```[\s\S]*?```/g, function (block) { return block.replace(/```/g, ''); })
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/^\s*(나레이션|대본|script|narration|주의\s*사항|주의사항|작성\s*규칙|규칙|지시|필수\s*구현|브랜드\s*적용|모션\s*다양성|핵심\s*(?:메시지|문제|근거|해결|행동|효과)|문제|근거|해결\s*\/?\s*행동|행동\s*유도|CTA|씨티에이|요약)\s*[:：]\s*/gim, '')
      .trim();
    var lines = raw.split(/[\r\n]+/)
      .map(function (line) { return line.replace(/^\s*[-*•\d.)]+\s*/, '').trim(); })
      .filter(function (line) {
        if (!line) return false;
        if (_vagIsInstructionSceneLine(line)) return false;
        return !/^(scene|씬|장면|cut|visual|audio|bgm|tts|cta)\s*\d*\s*[:：]/i.test(line);
      }).map(function (line) {
        return line.replace(/^(주의\s*사항|주의사항|작성\s*규칙|규칙|지시|필수\s*구현|브랜드\s*적용|모션\s*다양성|핵심\s*(?:메시지|문제|근거|해결|행동|효과)|문제|근거|해결\s*\/?\s*행동|행동\s*유도|CTA|씨티에이|요약)\s*[:：]\s*/i, '').trim();
      }).map(function (line) {
        return line.split(/(?<=[.!?。！？])\s+/).filter(function (part) {
          var sentence = String(part || '').trim();
          if (!sentence) return false;
          if (/#[0-9a-f]{3,8}\b/i.test(sentence)) return false;
          if (/(?:프롬프트|레이아웃|팔레트|타이포|폰트|구도|렌즈|조명|그라데이션|오버레이|패널|클립패스|clip-path|z-index)/i.test(sentence)) return false;
          return true;
        }).join(' ').trim();
      }).filter(function (line) {
        return !!line;
      });
    var text = lines.join('\n');
    text = text
      .replace(/\b(?:WASTED?\s+BUDGET|WASTED?|BUDGET|MONEY|ADS?|NO\s+CONVERSION|CONVERSION)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    var pairs = [
      [/\bmakeke\.kr\b/gi, '마케케 닷 케이알'],
      [/\bmakeke\b/gi, '마케케'],
      [/\bAI가\b/g, '인공지능이'],
      [/\bAI는\b/g, '인공지능은'],
      [/\bAI를\b/g, '인공지능을'],
      [/\bAI로\b/g, '인공지능으로'],
      [/\bAI\b/gi, '인공지능'],
      [/\bURL\b/gi, '주소'],
      [/\bSNS\b/gi, '소셜 미디어'],
      [/\bBGM\b/gi, '배경음악'],
      [/\bCTA\b/gi, '행동 유도 문구'],
      [/\bTTS\b/gi, '음성 합성'],
      [/\bMP4\b/gi, '엠피포'],
      [/\bHTML\b/gi, '에이치티엠엘'],
      [/\bGSAP\b/gi, '지에스에이피'],
      [/\bAPI\b/gi, '에이피아이'],
      [/\bCLI\b/gi, '씨엘아이'],
      [/\bHyperFrames\b/gi, '하이퍼프레임'],
      [/\bMotionFrames\b/gi, '모션 프레임'],
      [/\bYouTube\b/gi, '유튜브'],
      [/\bGemini\b/gi, '제미나이'],
      [/\bAtlas\s*Cloud\b/gi, '아틀라스 클라우드'],
      [/\bAtlas\b/gi, '아틀라스'],
      [/\bDeepSeek\b/gi, '딥시크'],
      [/\bQwen\b/gi, '큐원'],
      [/\bKimi\b/gi, '키미'],
      [/\bCodex\b/gi, '코덱스'],
      [/\bClaude\b/gi, '클로드'],
      [/\bGoogle\b/gi, '구글'],
      [/\bNaver\b/gi, '네이버'],
      [/\bInstagram\b/gi, '인스타그램'],
      [/\bFacebook\b/gi, '페이스북'],
      [/\bTikTok\b/gi, '틱톡'],
      [/\bYouTube\b/gi, '유튜브'],
      [/\bmarketing\b/gi, '마케팅'],
      [/\bbrand\b/gi, '브랜드'],
      [/\bdata\b/gi, '데이터'],
      [/\btargeting\b/gi, '타겟팅'],
      [/\btarget\b/gi, '타겟'],
      [/\bconversion\b/gi, '전환'],
      [/\bperformance\b/gi, '성과'],
      [/\bcampaign\b/gi, '캠페인'],
      [/\bkeyword\b/gi, '키워드'],
      [/\bclick\b/gi, '클릭'],
      [/\blead\b/gi, '리드'],
      [/\bsales\b/gi, '매출'],
      [/\broas\b/gi, '로아스'],
      [/\bctr\b/gi, '씨티알'],
      [/\bcpa\b/gi, '씨피에이'],
      [/\bcpc\b/gi, '씨피씨'],
      [/\broi\b/gi, '알오아이'],
      [/\bkpi\b/gi, '케이피아이'],
      [/\bcrm\b/gi, '씨알엠'],
    ];
    pairs.forEach(function (pair) { text = text.replace(pair[0], pair[1]); });
    text = text
      .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '이메일 주소')
      .replace(/\b[A-Za-z][A-Za-z0-9._-]*\.(?:com|net|org|co\.kr|kr)\b/gi, function (match) {
        return match.toLowerCase()
          .replace(/\.co\.kr/g, ' 닷 씨오 닷 케이알')
          .replace(/\.com/g, ' 닷 컴')
          .replace(/\.net/g, ' 닷 넷')
          .replace(/\.org/g, ' 닷 오알지')
          .replace(/\.kr/g, ' 닷 케이알')
          .replace(/[-_]/g, ' ');
      })
      .replace(/\b[A-Z]{2,}\b/g, function (word) {
        var map = { A: '에이', B: '비', C: '씨', D: '디', E: '이', F: '에프', G: '지', H: '에이치', I: '아이', J: '제이', K: '케이', L: '엘', M: '엠', N: '엔', O: '오', P: '피', Q: '큐', R: '알', S: '에스', T: '티', U: '유', V: '브이', W: '더블유', X: '엑스', Y: '와이', Z: '제트' };
        return word.split('').map(function (ch) { return map[ch] || ch; }).join('');
      })
      .replace(/\b[a-z][a-z-]{2,}\b/gi, function (word) {
        if (/[가-힣]/.test(word)) return word;
        return word.split('').map(function (ch) {
          var lowerMap = { a: '에이', b: '비', c: '씨', d: '디', e: '이', f: '에프', g: '지', h: '에이치', i: '아이', j: '제이', k: '케이', l: '엘', m: '엠', n: '엔', o: '오', p: '피', q: '큐', r: '알', s: '에스', t: '티', u: '유', v: '브이', w: '더블유', x: '엑스', y: '와이', z: '제트', '-': ' ' };
          return lowerMap[ch.toLowerCase()] || '';
        }).join('');
      })
      .replace(/인공지능가/g, '인공지능이')
      .replace(/인공지능를/g, '인공지능을')
      .replace(/인공지능로/g, '인공지능으로')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();
    var cta = String(opts.cta || '').replace(/\s+/g, ' ').trim();
    if (cta) {
      var ctaWords = cta.split(/[^\w가-힣]+/).filter(function (word) { return word.length >= 2; });
      var hasCta = _vagNarrationContainsCTA(text, cta) || ctaWords.some(function (word) { return text.indexOf(word) >= 0; });
      if (!hasCta) text += (text ? '\n' : '') + cta.replace(/\.$/, '') + '.';
    }
    return text;
  }
  V._vagNormalizeNarrationForSpeech = _vagNormalizeNarrationForSpeech;

  V._vagValidateNarrationScript = function _vagValidateNarrationScript(script, options) {
    var opts = options || {};
    var normalizedScript = _vagNormalizeNarrationForSpeech(script, opts);
    var text = String(normalizedScript || '').replace(/\s+/g, ' ').trim();
    var issues = [];
    var warnings = [];
    if (text.length < 20) issues.push('나레이션 대본이 너무 짧음');
    if (/레이아웃|카드|버튼|색상|폰트|화면\s*UI|그라데이션/.test(text)) warnings.push('화면 설명식 문구 일부 포함');
    var topic = String(opts.topic || '').replace(/\s+/g, ' ').trim();
    if (topic) {
      var topicWords = topic.split(/[^\w가-힣]+/).filter(function (word) {
        return word.length >= 2 && !/^(영상|모션|마케팅|홍보|광고|콘텐츠|서비스|자동|생성)$/.test(word);
      }).slice(0, 6);
      var hasTopic = topicWords.some(function (word) { return text.indexOf(word) >= 0; });
      if (topicWords.length >= 2 && !hasTopic) warnings.push('주제 핵심어 직접 언급 부족');
    }
    var cta = String(opts.cta || '').replace(/\s+/g, ' ').trim();
    if (cta) {
      var ctaWords = cta.split(/[^\w가-힣]+/).filter(function (word) { return word.length >= 2; });
      var hasCta = _vagNarrationContainsCTA(text, cta) || ctaWords.some(function (word) { return text.indexOf(word) >= 0; });
      if (!hasCta) issues.push('CTA 문구가 나레이션에 없음');
    }
    var duration = Number(opts.duration || 0) || 0;
    var sentenceCount = (normalizedScript.match(/[.!?。！？]|[요다까죠니다]\s/g) || []).length;
    if (duration >= 45 && sentenceCount < 7) warnings.push('1분 영상 대비 문장 수가 적어 TTS 길이 검증에서 보정 필요');
    if (duration >= 25 && duration < 45 && sentenceCount < 4) warnings.push('중간 길이 영상 대비 문장 수가 적어 TTS 길이 검증에서 보정 필요');
    return { ok: issues.length === 0, issues: issues, warnings: warnings, text: text, script: normalizedScript };
  };

  V._vagInjectNarrationAudio = function _vagInjectNarrationAudio(html, audioUrl, duration) {
    if (!html || !audioUrl) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    var stage = doc.querySelector('#stage') || doc.querySelector('[data-composition-id]');
    if (!stage) return html;
    // 기존 #narration 제거 (중복 방지)
    var prev = stage.querySelector('#narration');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    // 시각 타임라인이 끝나는 시각(last clip start + duration) 을 계산해
    // 나레이션이 그보다 길 경우 "마지막 씬" 을 연장해 화면 프리즈를 막는다.
    var visualEnd = 0;
    var clips = stage.querySelectorAll('[data-start]');
    var lastVisualClip = null;
    clips.forEach(function (clip) {
      var tag = (clip.tagName || '').toLowerCase();
      if (tag === 'audio') return;
      if (clip.classList && (clip.classList.contains('progress') || clip.classList.contains('bar') || clip.classList.contains('vignette') || clip.classList.contains('cue'))) return;
      if ((clip.id || '') === 'bar') return;
      var s = parseFloat(clip.getAttribute('data-start') || '0') || 0;
      var d = parseFloat(clip.getAttribute('data-duration') || '0') || 0;
      var end = s + d;
      if (end >= visualEnd) {
        visualEnd = end;
        lastVisualClip = clip;
      }
    });
    var narrationSec = duration ? Math.max(0.1, Number(duration) || 0) : 0;
    var roundedNarrationSec = narrationSec ? Math.round(narrationSec * 100) / 100 : 0;
    var stageCurDur = parseFloat(stage.getAttribute('data-duration') || '0') || 0;
    var targetDur = Math.max(stageCurDur, visualEnd, roundedNarrationSec);

    // 나레이션이 시각보다 명확히 길 때만 마지막 씬을 실제 차이만큼 연장한다.
    if (roundedNarrationSec && visualEnd > 0 && roundedNarrationSec > visualEnd + 0.05 && lastVisualClip) {
      var extraNeeded = Math.max(0, roundedNarrationSec - visualEnd);
      var lastS = parseFloat(lastVisualClip.getAttribute('data-start') || '0') || 0;
      var lastD = parseFloat(lastVisualClip.getAttribute('data-duration') || '0') || 0;
      var nextLastDuration = Math.round((lastD + extraNeeded) * 100) / 100;
      lastVisualClip.setAttribute('data-duration', String(nextLastDuration));
      targetDur = Math.max(targetDur, lastS + lastD + extraNeeded);
      console.info('[VAG] narration(' + roundedNarrationSec.toFixed(1) + 's) > visual(' + visualEnd.toFixed(1) + 's), extending last clip by +' + extraNeeded.toFixed(2) + 's');
    }

    var audio = doc.createElement('audio');
    audio.id = 'narration';
    audio.setAttribute('class', 'clip');
    audio.setAttribute('data-start', '0');
    audio.setAttribute('data-duration', roundedNarrationSec ? String(roundedNarrationSec) : '9');
    audio.setAttribute('data-track-index', '2');
    audio.setAttribute('data-volume', '1');
    audio.setAttribute('src', audioUrl);
    stage.appendChild(audio);

    // stage duration 은 "실제 총 길이" 로 세팅 (나레이션·시각 중 큰 쪽)
    if (targetDur > stageCurDur) {
      stage.setAttribute('data-duration', String(Math.ceil(Math.round(targetDur * 100) / 100)));
    }
    var outputHtml = V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
    return _vagPatchTimelineDuration(outputHtml, targetDur);
  }

  V._vagInjectBackground = function _vagInjectBackground(html, bgUrl) {
    if (!html) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    if (!doc || !doc.documentElement) return html;
    var stage = doc.querySelector('#stage');
    if (!stage) return html;

    function applyStage(el) {
      var style = (el.getAttribute('style') || '').trim();
      // 기존 background-* 속성 제거
      style = style
        .replace(/background(?:-image|-color|-position|-size|-repeat|-attachment)?\s*:[^;]+;?/gi, '')
        .replace(/;\s*;/g, ';')
        .trim();
      if (bgUrl) {
        var url = String(bgUrl);
        var layer = 'url("' + url + '") center/cover no-repeat';
        var baseGradient = 'linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.55))';
        style = (style.endsWith(';') ? style : (style ? style + ';' : '')) +
          'background:' + baseGradient + ',' + layer + ';';
      }
      el.setAttribute('style', style);
      el.setAttribute('data-vag-bg', bgUrl ? 'ai' : 'none');
    }

    applyStage(stage);
    // 보통 첫 번째 풀블리드 `inset:0` 클립이 배경 역할을 함
    var firstBgClip = null;
    var clips = stage.querySelectorAll('[data-start]');
    for (var i = 0; i < clips.length; i++) {
      var s = (clips[i].getAttribute('style') || '').toLowerCase();
      if (/inset\s*:\s*0/.test(s) || /position\s*:\s*absolute\s*;\s*(?:top:0|inset:0|left:0;right:0;top:0;bottom:0)/.test(s)) {
        firstBgClip = clips[i];
        break;
      }
    }
    if (firstBgClip) applyStage(firstBgClip);

    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  }

  V._vagInjectSceneBackgrounds = function _vagInjectSceneBackgrounds(html, sceneImages) {
    if (!html || !Array.isArray(sceneImages) || !sceneImages.length) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch (e) { return html; }
    if (!doc || !doc.documentElement) return html;
    var scenes = Array.from(doc.querySelectorAll('.clip.scene,[data-scene-index]'));
    if (!scenes.length) return html;
    removeGeneratedBrandOverlays();

    function isBackgroundElement(el) {
      if (!el || !el.getAttribute) return false;
      var tag = (el.tagName || '').toLowerCase();
      var cls = String(el.getAttribute('class') || '');
      return el.getAttribute('data-vag-bg') === 'scene-image' ||
        /\b(scene-bg|background|bg-img|bg-image|bg)\b/i.test(cls) ||
        (tag === 'img' && /\b(hero|visual|photo|media)\b/i.test(cls));
    }
    function appendStyle(el, css) {
      if (!el || !css) return;
      var current = String(el.getAttribute('style') || '').trim();
      el.setAttribute('style', (current ? current.replace(/;?\s*$/, ';') : '') + css);
    }
    function removeGeneratedBrandOverlays() {
      var profileName = String(((window._globalProfileData || {}).name || '')).replace(/\s+/g, '');
      var overlaySelectors = [
        '.watermark',
        '.brand-watermark',
        '.logo-watermark',
        '[data-watermark]',
        '[aria-label="watermark"]'
      ];
      Array.from(doc.querySelectorAll(overlaySelectors.join(','))).forEach(function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
      Array.from(doc.querySelectorAll('.brand-logo,.brand-name,.logo-lockup,.brand-lockup,.logo,.mark')).forEach(function (el) {
        if (!el || !el.getAttribute || !el.parentNode) return;
        var style = String(el.getAttribute('style') || '').toLowerCase();
        var cls = String(el.getAttribute('class') || '').toLowerCase();
        var text = String(el.textContent || '').replace(/\s+/g, '');
        var looksPinned = /position\s*:\s*(fixed|absolute)/.test(style) && /(top\s*:|right\s*:|left\s*:)/.test(style);
        var looksHeader = /\b(watermark|corner|header|nav|top|fixed)\b/.test(cls);
        var repeatsBrand = !!profileName && !!text && text.indexOf(profileName) >= 0;
        if (looksPinned || looksHeader || repeatsBrand) {
          el.parentNode.removeChild(el);
        }
      });
    }
    function ensureSceneBackgroundMedia(scene) {
      var media = Array.from(scene.children || []).find(function (child) {
        if (!child || !child.getAttribute) return false;
        var tag = (child.tagName || '').toLowerCase();
        var cls = String(child.getAttribute('class') || '');
        return child.getAttribute('data-vag-bg') === 'scene-image' ||
          /\bvag-scene-bg-media\b|\b(scene-bg|background|bg-img|bg-image|bg)\b/i.test(cls) ||
          tag === 'img' || tag === 'video';
      });
      if (media) return media;
      media = doc.createElement('img');
      media.setAttribute('class', 'vag-scene-bg-media');
      media.setAttribute('alt', '');
      media.setAttribute('aria-hidden', 'true');
      media.setAttribute('data-vag-bg', 'scene-image');
      scene.insertBefore(media, scene.firstChild || null);
      return media;
    }
    function keepForegroundAbove(scene, media) {
      Array.from(scene.children || []).forEach(function (child) {
        if (!child || child === media || /^(SCRIPT|STYLE|AUDIO)$/i.test(child.tagName || '')) return;
        var style = String(child.getAttribute('style') || '');
        if (/z-index\s*:/i.test(style) && /position\s*:/i.test(style)) return;
        var cls = String(child.getAttribute('class') || '');
        var hasText = child.matches && child.matches('.content,.caption,.headline,.title,.subtitle,.copy,.text,.body,.card,.panel,.split-container,.counter-wrap,.feature-list,.post-cards,.workspace,.brand-logo,.slogan,.cta-btn');
        if (!hasText && child.querySelector) {
          hasText = !!child.querySelector('h1,h2,h3,p,.headline,.title,.subtitle,.copy,.caption,.card-title,.card-desc,.counter-text,.feature-item,.brand-logo,.slogan,.cta-btn');
        }
        var decorative = /\b(overlay|bg-panel|bg-circle|bg-shape|decor|lines)\b/i.test(cls);
        appendStyle(child, (style && /position\s*:/i.test(style) ? '' : 'position:relative;') + 'z-index:' + (hasText && !decorative ? '2' : '1') + ';');
      });
    }
    function ensureCommonAnimationTargets(scene) {
      if (!scene || !scene.querySelector) return;
      if (!scene.querySelector('.title-highlight')) {
        var title = scene.querySelector('.title,h1,.headline');
        if (title && title.childNodes && title.childNodes.length) {
          var span = doc.createElement('span');
          span.setAttribute('class', 'title-highlight');
          while (title.firstChild) span.appendChild(title.firstChild);
          title.appendChild(span);
        }
      }
    }
    function applyImage(scene, url) {
      if (!scene || !url) return;
      var media = ensureSceneBackgroundMedia(scene);
      var tag = (media.tagName || '').toLowerCase();
      if (tag === 'img') media.setAttribute('src', url);
      else if (tag === 'video') media.setAttribute('poster', url);
      else {
        var style = media.getAttribute('style') || '';
        media.setAttribute('style', style.replace(/background(?:-image|-color|-position|-size|-repeat|-attachment)?\s*:[^;]+;?/gi, '') + ';background:url("' + String(url) + '") center/cover no-repeat;');
      }
      scene.setAttribute('style', String(scene.getAttribute('style') || '').replace(/background(?:-image|-color|-position|-size|-repeat|-attachment)?\s*:[^;]+;?/gi, ''));
      appendStyle(scene, 'position:relative;overflow:hidden;background:#f7f8fb;');
      appendStyle(media, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;pointer-events:none;opacity:1;filter:none;');
      scene.setAttribute('data-vag-bg', 'scene-image');
      media.setAttribute('data-vag-bg', 'scene-image');
      media.setAttribute('data-vag-bg-index', String(scene.getAttribute('data-scene-index') || ''));
      keepForegroundAbove(scene, media);
      ensureCommonAnimationTargets(scene);
    }

    scenes.forEach(function (scene, idx) {
      var item = sceneImages[idx] || {};
      var url = item.url || item.path || '';
      if (!url) return;
      applyImage(scene, url);
    });
    var readable = doc.createElement('style');
    readable.setAttribute('data-vag-scene-bg-safe-readability', '1');
    readable.textContent = [
      '.clip.scene[data-vag-bg="scene-image"]{isolation:isolate;}',
      '.clip.scene[data-vag-bg="scene-image"],.clip.scene[data-vag-bg="scene-image"] *{box-sizing:border-box;}',
      '.clip.scene[data-vag-bg="scene-image"]::after{content:none!important;}',
      '.clip.scene[data-vag-bg="scene-image"] > :is(.vag-scene-bg-media,.scene-bg,.background,.bg-img,.bg-image,.bg,.bg-layer,[data-vag-bg="scene-image"]){opacity:1!important;filter:none!important;}',
      '.clip.scene[data-vag-bg="scene-image"] > :not(.vag-scene-bg-media):not(style):not(script):not(audio){position:relative;z-index:2;}',
      '.clip.scene[data-vag-bg="scene-image"] :is([class*="split"],[class*="two-col"],[class*="layout"]){background:transparent!important;}',
      '.clip.scene[data-vag-bg="scene-image"] :is([class*="split"]) :is([class*="left"],[class*="right"],[class*="panel"],[class*="col"]){background:transparent!important;}',
      '.clip.scene[data-vag-bg="scene-image"] :is([class*="left-bg"],[class*="right-bg"],[class*="panel-bg"],[class*="split-bg"]){display:none!important;}',
      '@keyframes vagTextLiftIn{0%{opacity:0;transform:translate3d(0,28px,0) scale(.96)}58%{opacity:1;transform:translate3d(0,-3px,0) scale(1.015)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}',
      '@keyframes vagTextGlowPulse{0%,100%{text-shadow:0 4px 24px rgba(0,0,0,.72),0 1px 3px rgba(0,0,0,.9)}50%{text-shadow:0 7px 30px rgba(0,0,0,.78),0 1px 4px rgba(0,0,0,.95)}}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.content,.caption,.headline,.title,.subtitle,.copy,.text,.body,.card,.panel,.split-container,.counter-wrap,.feature-list,.post-cards,.workspace,.slogan,.cta-btn){max-width:calc(100% - 112px)!important;max-height:calc(100% - 112px);overflow:visible!important;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(h1,h2,h3,.headline,.title,.title-highlight,.subtitle,.copy,.text,.body,.caption,.card-title,.card-desc,.counter-text,.feature-item,.slogan,.cta-btn){position:relative;z-index:2;letter-spacing:0!important;word-break:keep-all;overflow-wrap:break-word;text-wrap:balance;white-space:normal!important;paint-order:stroke fill;text-shadow:0 4px 24px rgba(0,0,0,.72),0 1px 3px rgba(0,0,0,.9);animation:vagTextLiftIn .9s cubic-bezier(.16,1,.3,1) both,vagTextGlowPulse 2.8s ease-in-out .9s 2;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(h1,.headline,.title,.title-highlight){line-height:1.05!important;-webkit-text-stroke:.45px rgba(0,0,0,.58);max-width:12em;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(h2,h3,.subtitle,.copy,.body,.caption,p,.card-desc,.feature-item){line-height:1.32!important;-webkit-text-stroke:0 transparent;max-width:34em;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.cta-btn,button,a){line-height:1.15!important;-webkit-text-stroke:0 transparent;box-shadow:0 14px 34px rgba(0,0,0,.22);}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.content,.panel,.split-container,.counter-wrap,.feature-list,.post-cards,.workspace){border-radius:min(18px,2vw);}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.subtitle,.copy,.body,.caption,p){animation-delay:.14s,.95s;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.cta-btn,button,a){animation-delay:.3s,1.1s;}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.caption){background:rgba(10,10,12,.58)!important;color:#fff!important;backdrop-filter:blur(6px);}',
      '.clip.scene[data-vag-bg="scene-image"] :is(.content,.split-container,.counter-wrap,.feature-list,.post-cards,.workspace,.slogan,.cta-btn){pointer-events:none;}',
      '.watermark,.brand-watermark,.logo-watermark,[data-watermark]{display:none!important;}',
    ].join('\n');
    Array.from(doc.querySelectorAll('style[data-vag-scene-bg-safe-readability]')).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    doc.head.appendChild(readable);
    return V._vagPreserveHead(html, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
  }

  V._vagRecommendSceneTextStyle = function _vagRecommendSceneTextStyle(scene, index, total) {
    var idx = Number(index || 0) || 0;
    var count = Math.max(1, Number(total || 1) || 1);
    var text = [
      scene && (scene.composition || scene.composition_hint),
      scene && (scene.visualMode || scene.visual_mode),
      scene && (scene.role || scene.title || scene.body),
      scene && (scene.cutPlan || scene.cut_plan),
    ].filter(Boolean).join(' ').toLowerCase();
    var isLast = idx >= count - 1 || /cta|lockup|문의|상담|예약|신청|행동/.test(text);
    var isProof = /proof|data|number|stat|근거|숫자|비교|증거/.test(text);
    var isProduct = /product|상품|제품|사용|디테일|detail|macro/.test(text);
    var isImage = /image_only|cinematic|hero|풀블리드|시네마틱|이미지/.test(text);
    var explicitTop = /top|upper|상단|위쪽|위/.test(text);
    var explicitCenter = /center|middle|중앙|가운데/.test(text);
    var explicitRight = /right|우측|오른/.test(text);
    var explicitLeft = /left|좌측|왼/.test(text);
    var explicitBottom = /bottom|lower|하단|아래/.test(text);
    var slot = idx % 6;
    var textLayout = explicitCenter || isLast
      ? 'center'
      : explicitRight
        ? (explicitTop ? 'top-right' : explicitBottom ? 'bottom-right' : 'middle-right')
        : explicitLeft
          ? (explicitTop ? 'top-left' : explicitBottom ? 'bottom-left' : 'middle-left')
          : isProof
            ? 'middle-right'
            : isImage
              ? (slot % 2 ? 'top-left' : 'bottom-right')
              : ['bottom-left', 'middle-right', 'top-left', 'center', 'bottom-right', 'middle-left'][slot];
    var textMotion = isLast
      ? 'lock'
      : isProof
        ? 'snap'
        : isImage
          ? 'float'
          : ['rise', 'slide-right', 'drop', 'scale', 'slide-left', 'float'][slot];
    var textDesign = isLast
      ? 'cta'
      : isProof
        ? 'proof'
        : isProduct
          ? 'line'
          : isImage
            ? 'open'
            : ['open', 'glass', 'line', 'proof', 'minimal', 'split'][slot];
    var screenEffect = isLast
      ? 'pulse'
      : isProof
        ? 'pulse'
        : isProduct
          ? 'macro-push'
          : isImage
            ? (slot % 2 ? 'pan-right' : 'pan-left')
            : ['push-in', 'pan-left', 'tilt-drift', 'pull-back', 'pan-right', 'drift-up'][slot];
    var transitionEffect = idx === 0
      ? 'fade'
      : isLast
        ? 'zoom-cut'
        : isProof
          ? 'flash'
          : ['fade', 'wipe-left', 'wipe-up', 'zoom-cut', 'flash', 'dip'][slot];
    return { textLayout: textLayout, textMotion: textMotion, textDesign: textDesign, screenEffect: screenEffect, transitionEffect: transitionEffect };
  };

  V._vagBuildSceneImageTextMotionHtml = function _vagBuildSceneImageTextMotionHtml(sceneImages, options) {
    var opts = options || {};
    var images = Array.isArray(sceneImages) ? sceneImages.filter(Boolean).slice().sort(function (a, b) {
      var ai = Number(a && a.index || 0) || 0;
      var bi = Number(b && b.index || 0) || 0;
      if (ai && bi && ai !== bi) return ai - bi;
      return 0;
    }) : [];
    var plan = Array.isArray(opts.plan) ? opts.plan : [];
    if (!images.length || !plan.length) return '';
    var duration = Math.max(1, Number(opts.duration || 0) || 15);
    var width = opts.aspect === '16:9' ? 1920 : opts.aspect === '1:1' ? 1080 : 1080;
    var height = opts.aspect === '16:9' ? 1080 : opts.aspect === '1:1' ? 1080 : 1920;
    var brand = String((opts.brandColor || (V._vagSession && V._vagSession.brandColor) || '#65A30D')).trim() || '#65A30D';
    var cta = String((opts.cta || (V._vagSession && V._vagSession.cta) || '')).trim();
    var sceneCount = Math.min(images.length, plan.length);
    var fallbackDur = duration / Math.max(1, sceneCount);
    function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }); }
    function text(scene, key) {
      return _vagCleanSceneLine(scene && scene[key]);
    }
    function sceneDuration(scene) {
      var d = Number(scene && (scene.duration || scene.duration_sec) || 0);
      return d > 0 ? d : fallbackDur;
    }
    function sceneTextLayout(scene, idx, total) {
      var manualLayout = String(scene && (scene.textLayout || scene.text_layout) || '').trim();
      var recommended = typeof V._vagRecommendSceneTextStyle === 'function' ? V._vagRecommendSceneTextStyle(scene, idx, total) : {};
      if (manualLayout) {
        return {
          block: manualLayout,
          motion: String(scene && (scene.textMotion || scene.text_motion) || '').trim() || recommended.textMotion || 'rise',
        };
      }
      return {
        block: recommended.textLayout || 'bottom-left',
        motion: String(scene && (scene.textMotion || scene.text_motion) || '').trim() || recommended.textMotion || 'rise',
      };
    }
    function contentStyleForLayout(layout) {
      var base = 'position:relative;z-index:2;width:100%;height:100%;box-sizing:border-box;padding:' + Math.round(height * 0.07) + 'px ' + Math.round(width * 0.078) + 'px ' + Math.round(height * 0.078) + 'px;display:flex;flex-direction:column;gap:22px;';
      var map = {
        'top-left': 'justify-content:flex-start;align-items:flex-start;text-align:left;',
        'top-right': 'justify-content:flex-start;align-items:flex-end;text-align:right;',
        'middle-left': 'justify-content:center;align-items:flex-start;text-align:left;',
        'middle-right': 'justify-content:center;align-items:flex-end;text-align:right;',
        'center': 'justify-content:center;align-items:center;text-align:center;',
        'bottom-right': 'justify-content:flex-end;align-items:flex-end;text-align:right;',
        'bottom-left': 'justify-content:flex-end;align-items:flex-start;text-align:left;',
      };
      return base + (map[layout] || map['bottom-left']);
    }
    function shadeClassForLayout(layout) {
      if (/right/.test(layout)) return ' shade-right';
      if (/top/.test(layout)) return ' shade-top';
      if (layout === 'center') return ' shade-center';
      return ' shade-bottom';
    }
    function titleMotionFromKind(kind) {
      if (kind === 'slide-right') return { x: 74, y: 0, scale: 1 };
      if (kind === 'slide-left') return { x: -74, y: 0, scale: 1 };
      if (kind === 'drop') return { x: 0, y: -58, scale: 1 };
      if (kind === 'scale' || kind === 'lock') return { x: 0, y: 18, scale: 0.92 };
      if (kind === 'snap') return { x: 32, y: 10, scale: 0.98 };
      if (kind === 'float') return { x: 0, y: 28, scale: 1.02 };
      return { x: 0, y: 52, scale: 1 };
    }
    function sceneTextDesign(scene, idx, total) {
      var manualDesign = String(scene && (scene.textDesign || scene.text_design) || '').trim();
      if (manualDesign) return manualDesign;
      var recommended = typeof V._vagRecommendSceneTextStyle === 'function' ? V._vagRecommendSceneTextStyle(scene, idx, total) : {};
      return recommended.textDesign || ['open', 'glass', 'line', 'proof', 'minimal', 'split'][idx % 6];
    }
    function sceneScreenEffect(scene, idx, total) {
      var manualEffect = String(scene && (scene.screenEffect || scene.screen_effect) || '').trim();
      if (manualEffect) return manualEffect;
      var recommended = typeof V._vagRecommendSceneTextStyle === 'function' ? V._vagRecommendSceneTextStyle(scene, idx, total) : {};
      return recommended.screenEffect || ['push-in', 'pan-left', 'tilt-drift', 'pull-back', 'pan-right', 'drift-up'][idx % 6];
    }
    function sceneTransitionEffect(scene, idx, total) {
      var manualEffect = String(scene && (scene.transitionEffect || scene.transition_effect) || '').trim();
      if (manualEffect) return manualEffect;
      var recommended = typeof V._vagRecommendSceneTextStyle === 'function' ? V._vagRecommendSceneTextStyle(scene, idx, total) : {};
      return recommended.transitionEffect || (idx === 0 ? 'fade' : ['fade', 'wipe-left', 'wipe-up', 'zoom-cut', 'flash', 'dip'][idx % 6]);
    }
    function screenEffectVars(effect, w, h) {
      var moveX = Math.max(26, Math.round(w * 0.036));
      var moveY = Math.max(24, Math.round(h * 0.032));
      var map = {
        'push-in': { from: { scale: 1.03, x: 0, y: 0, rotation: 0 }, to: { scale: 1.16, x: 0, y: 0, rotation: 0 } },
        'pull-back': { from: { scale: 1.16, x: 0, y: 0, rotation: 0 }, to: { scale: 1.04, x: 0, y: 0, rotation: 0 } },
        'pan-left': { from: { scale: 1.12, x: moveX, y: 0, rotation: 0 }, to: { scale: 1.12, x: -moveX, y: 0, rotation: 0 } },
        'pan-right': { from: { scale: 1.12, x: -moveX, y: 0, rotation: 0 }, to: { scale: 1.12, x: moveX, y: 0, rotation: 0 } },
        'drift-up': { from: { scale: 1.11, x: 0, y: moveY, rotation: 0 }, to: { scale: 1.11, x: 0, y: -moveY, rotation: 0 } },
        'tilt-drift': { from: { scale: 1.1, x: -Math.round(moveX * 0.45), y: Math.round(moveY * 0.35), rotation: -1.2 }, to: { scale: 1.13, x: Math.round(moveX * 0.45), y: -Math.round(moveY * 0.35), rotation: 1.2 } },
        'macro-push': { from: { scale: 1.08, x: 0, y: 0, rotation: 0 }, to: { scale: 1.22, x: -Math.round(moveX * 0.35), y: Math.round(moveY * 0.2), rotation: 0 } },
        pulse: { from: { scale: 1.05, x: 0, y: 0, rotation: 0 }, to: { scale: 1.1, x: 0, y: 0, rotation: 0 } },
      };
      return map[effect] || map['push-in'];
    }
    function gsapVars(vars) {
      return '{scale:' + vars.scale + ',x:' + vars.x + ',y:' + vars.y + ',rotation:' + vars.rotation + '}';
    }
    function gsapVarsWithTiming(vars, dur) {
      return '{scale:' + vars.scale + ',x:' + vars.x + ',y:' + vars.y + ',rotation:' + vars.rotation + ',duration:' + dur.toFixed(2) + ",ease:'none'}";
    }
    function transitionDuration(effect) {
      if (effect === 'dip') return 0.62;
      if (effect === 'wipe-left' || effect === 'wipe-up') return 0.52;
      if (effect === 'flash') return 0.5;
      if (effect === 'zoom-cut') return 0.42;
      return 0.38;
    }
    var starts = [];
    var cursor = 0;
    for (var i = 0; i < sceneCount; i++) {
      starts.push(cursor);
      cursor += sceneDuration(plan[i]);
    }
    var scale = cursor > 0 ? duration / cursor : 1;
    cursor = 0;
    var sections = [];
    var tweens = [];
    for (var idx = 0; idx < sceneCount; idx++) {
      var scene = plan[idx] || {};
      var item = images[idx] || {};
      var start = Math.round(cursor * 100) / 100;
      var dur = idx === sceneCount - 1 ? Math.max(1, duration - start) : Math.max(1, sceneDuration(scene) * scale);
      cursor += dur;
      var title = text(scene, 'title') || ('장면 ' + (idx + 1));
      var body = text(scene, 'body') || text(scene, 'narration') || '';
      var narration = _vagCleanNarrationLineBeforeSpeech(scene.narration || [title, body].filter(Boolean).join('. '));
      var url = item.url || item.path || '';
      var videoUrl = String(item.videoUrl || item.video_url || '').trim();
      var isLast = idx === sceneCount - 1;
      var layout = sceneTextLayout(scene, idx, sceneCount);
      var motion = titleMotionFromKind(layout.motion);
      var textDesign = sceneTextDesign(scene, idx, sceneCount);
      var screenEffect = sceneScreenEffect(scene, idx, sceneCount);
      var transitionEffect = sceneTransitionEffect(scene, idx, sceneCount);
      var transDur = transitionDuration(transitionEffect);
      var screenVars = screenEffectVars(screenEffect, width, height);
      var ctaHtml = isLast && cta ? '<div class="vag-simple-cta">' + esc(cta) + '</div>' : '';
      var bgMediaHtml = videoUrl
        ? ''
        : '<img class="vag-simple-bg" data-vag-bg="scene-image" data-vag-bg-index="' + (idx + 1) + '" src="' + esc(url) + '" alt="" aria-hidden="true">';
      var bgTrackHtml = videoUrl
        ? '<video class="clip vag-simple-bg vag-simple-bg-track vag-bg-track-' + (idx + 1) + '" data-start="' + start.toFixed(2) + '" data-duration="' + dur.toFixed(2) + '" data-track-index="' + (10 + idx) + '" data-vag-bg="scene-video" data-vag-bg-index="' + (idx + 1) + '" src="' + esc(videoUrl) + '" poster="' + esc(url) + '" muted playsinline loop preload="auto" aria-hidden="true"></video>'
        : '';
      sections.push(
        bgTrackHtml +
        '<section class="clip scene vag-simple-scene scene-' + (idx + 1) + ' text-' + esc(layout.block) + ' motion-' + esc(layout.motion) + ' style-' + esc(textDesign) + ' effect-' + esc(screenEffect) + ' transition-' + esc(transitionEffect) + '" data-scene-index="' + (idx + 1) + '" data-vag-sync-index="' + (idx + 1) + '" data-start="' + start.toFixed(2) + '" data-duration="' + dur.toFixed(2) + '" data-track-index="0" data-vag-narration="' + esc(narration) + '">' +
          bgMediaHtml +
          '<div class="vag-simple-shade' + shadeClassForLayout(layout.block) + '"></div>' +
          '<div class="vag-transition-flash" aria-hidden="true"></div>' +
          '<div class="vag-simple-content" style="' + contentStyleForLayout(layout.block) + '">' +
            '<div class="vag-simple-mark" aria-hidden="true"></div>' +
            '<h1>' + esc(title) + '</h1>' +
            (body ? '<p>' + esc(body) + '</p>' : '') +
            ctaHtml +
          '</div>' +
        '</section>'
      );
      var currentSelector = '.scene-' + (idx + 1);
      var previousSelector = idx > 0 ? '.scene-' + idx : '';
      var otherSelectors = [];
      for (var hideIdx = 0; hideIdx < sceneCount; hideIdx++) {
        if (hideIdx === idx) continue;
        if (idx > 0 && hideIdx === idx - 1) continue;
        otherSelectors.push('.scene-' + (hideIdx + 1));
      }
      tweens.push(
        (otherSelectors.length ? "tl.set('" + otherSelectors.join(',') + "',{autoAlpha:0}," + start.toFixed(2) + ");" : "") +
        "tl.set('" + currentSelector + "',{autoAlpha:1}," + start.toFixed(2) + ");" +
        (transitionEffect === 'fade' ? "tl.fromTo('" + currentSelector + "',{autoAlpha:0},{autoAlpha:1,duration:.38,ease:'power2.out'}," + start.toFixed(2) + ");" : "") +
        (transitionEffect === 'wipe-left' ? "tl.fromTo('" + currentSelector + "',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.52,ease:'power3.out'}," + start.toFixed(2) + ");" : "") +
        (transitionEffect === 'wipe-up' ? "tl.fromTo('" + currentSelector + "',{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0% 0 0 0)',duration:.52,ease:'power3.out'}," + start.toFixed(2) + ");" : "") +
        (transitionEffect === 'zoom-cut' ? "tl.fromTo('" + currentSelector + "',{scale:1.045,autoAlpha:0},{scale:1,autoAlpha:1,duration:.42,ease:'power3.out'}," + start.toFixed(2) + ");" : "") +
        (transitionEffect === 'flash' ? "tl.fromTo('" + currentSelector + " .vag-transition-flash',{autoAlpha:.82},{autoAlpha:0,duration:.5,ease:'power2.out'}," + start.toFixed(2) + ");" : "") +
        (transitionEffect === 'dip' ? "tl.fromTo('" + currentSelector + " .vag-transition-flash',{autoAlpha:.62,background:'rgba(0,0,0,.78)'},{autoAlpha:0,duration:.62,ease:'power2.out'}," + start.toFixed(2) + ");" : "") +
        (previousSelector ? "tl.set('" + previousSelector + "',{autoAlpha:0}," + (start + transDur).toFixed(2) + ");" : "") +
        "tl.fromTo('.vag-bg-track-" + (idx + 1) + "," + currentSelector + " .vag-simple-bg'," + gsapVars(screenVars.from) + "," + gsapVarsWithTiming(screenVars.to, dur) + "," + start.toFixed(2) + ");" +
        (screenEffect === 'pulse' ? "tl.fromTo('" + currentSelector + " .vag-simple-shade',{autoAlpha:.72},{autoAlpha:.9,duration:" + Math.min(1.8, dur * 0.55).toFixed(2) + ",yoyo:true,repeat:" + Math.max(0, Math.ceil(dur / 1.8) - 1) + ",ease:'sine.inOut'}," + start.toFixed(2) + ");" : "") +
        (screenEffect === 'tilt-drift' ? "tl.fromTo('" + currentSelector + " .vag-simple-shade',{x:-24},{x:24,duration:" + dur.toFixed(2) + ",ease:'none'}," + start.toFixed(2) + ");" : "") +
        "tl.from('" + currentSelector + " .vag-simple-mark',{scaleX:0,autoAlpha:0,duration:.48,ease:'power3.out'}," + (start + 0.14).toFixed(2) + ");" +
        "tl.from('" + currentSelector + " h1',{x:" + motion.x + ",y:" + motion.y + ",scale:" + motion.scale + ",autoAlpha:0,duration:.72,ease:'power3.out'}," + (start + 0.25).toFixed(2) + ");" +
        "tl.from('" + currentSelector + " p',{x:" + Math.round(motion.x * 0.45) + ",y:" + Math.round(motion.y * 0.55 + 24) + ",autoAlpha:0,duration:.58,ease:'power3.out'}," + (start + 0.55).toFixed(2) + ");" +
        (isLast && cta ? "tl.from('" + currentSelector + " .vag-simple-cta',{scale:.92,y:24,autoAlpha:0,duration:.55,ease:'back.out(1.6)'}," + (start + 1.0).toFixed(2) + ");" : "")
      );
    }
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>' +
      'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;}' +
      '[data-composition-id="makeke-html-motion"]{position:relative;width:' + width + 'px;height:' + height + 'px;overflow:hidden;color:#fff;background:#111;--brand:' + esc(brand) + ';--accent:' + esc(brand) + ';}' +
      '.clip.scene{position:absolute;inset:0;overflow:hidden;opacity:0;visibility:hidden;isolation:isolate;z-index:2;background:transparent;}' +
      '.vag-simple-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;}' +
      '.vag-simple-bg-track{z-index:0;background:#111;}' +
      '.vag-simple-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.20) 42%,rgba(0,0,0,.58));}' +
      '.vag-simple-shade.shade-right{background:linear-gradient(90deg,rgba(0,0,0,.08),rgba(0,0,0,.12) 36%,rgba(0,0,0,.64));}' +
      '.vag-simple-shade.shade-top{background:linear-gradient(180deg,rgba(0,0,0,.62),rgba(0,0,0,.18) 46%,rgba(0,0,0,.16));}' +
      '.vag-simple-shade.shade-center{background:radial-gradient(circle at 50% 50%,rgba(0,0,0,.42),rgba(0,0,0,.18) 46%,rgba(0,0,0,.46));}' +
      '.vag-simple-shade.shade-bottom{background:linear-gradient(180deg,rgba(0,0,0,.07),rgba(0,0,0,.18) 44%,rgba(0,0,0,.62));}' +
      '.vag-transition-flash{position:absolute;inset:0;z-index:3;background:rgba(255,255,255,.9);opacity:0;pointer-events:none;}' +
      '.vag-simple-content h1{margin:0;max-width:12em;font-size:clamp(54px,' + (width * 0.072).toFixed(1) + 'px,94px);line-height:1.08;letter-spacing:0;word-break:keep-all;overflow-wrap:break-word;text-wrap:balance;text-shadow:0 5px 24px rgba(0,0,0,.72),0 1px 4px rgba(0,0,0,.95);-webkit-text-stroke:.35px rgba(0,0,0,.55);}' +
      '.vag-simple-content p{margin:0;max-width:25em;font-size:clamp(28px,' + (width * 0.035).toFixed(1) + 'px,44px);line-height:1.32;letter-spacing:0;word-break:keep-all;overflow-wrap:break-word;text-wrap:balance;text-shadow:0 4px 22px rgba(0,0,0,.75),0 1px 4px rgba(0,0,0,.95);}' +
      '.vag-simple-mark{width:min(150px,18vw);height:8px;border-radius:999px;background:var(--brand);transform-origin:left center;box-shadow:0 10px 26px rgba(0,0,0,.22);}' +
      '.style-glass .vag-simple-content{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(10px);height:auto!important;width:min(82%,860px)!important;margin:auto 0;border-radius:28px;padding:34px!important;}' +
      '.style-line .vag-simple-content h1{border-left:10px solid var(--brand);padding-left:28px;}' +
      '.style-line .vag-simple-mark{display:none;}' +
      '.style-proof .vag-simple-content h1{font-size:clamp(62px,' + (width * 0.082).toFixed(1) + 'px,112px);}' +
      '.style-proof .vag-simple-content p{padding:.36em .55em;border-radius:14px;background:rgba(0,0,0,.34);}' +
      '.style-minimal .vag-simple-mark{width:56px;height:56px;border-radius:50%;background:transparent;border:7px solid var(--brand);}' +
      '.style-minimal .vag-simple-content p{max-width:18em;}' +
      '.style-open .vag-simple-content h1{font-size:clamp(64px,' + (width * 0.09).toFixed(1) + 'px,126px);max-width:10em;}' +
      '.style-split .vag-simple-content h1{max-width:9.5em;}' +
      '.style-split .vag-simple-content p{max-width:20em;border-top:3px solid rgba(255,255,255,.72);padding-top:18px;}' +
      '.style-cta .vag-simple-content h1{font-size:clamp(62px,' + (width * 0.085).toFixed(1) + 'px,118px);}' +
      '.style-cta .vag-simple-mark{width:min(220px,24vw);height:10px;}' +
      '.text-center .vag-simple-content h1,.text-center .vag-simple-content p{max-width:13em;}' +
      '.text-middle-right .vag-simple-content h1,.text-bottom-right .vag-simple-content h1,.text-top-right .vag-simple-content h1{max-width:11em;}' +
      '.vag-simple-cta{width:max-content;max-width:100%;margin-top:18px;padding:21px 34px;border-radius:22px;background:var(--brand);color:#fff;font-size:clamp(30px,' + (width * 0.038).toFixed(1) + 'px,48px);font-weight:950;line-height:1.1;box-shadow:0 16px 36px rgba(0,0,0,.28);}' +
      '</style></head><body><div data-composition-id="makeke-html-motion" data-width="' + width + '" data-height="' + height + '" data-start="0" data-duration="' + duration + '">' +
      sections.join('') +
      '</div><script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"><\\/script><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});' +
      tweens.join('') +
      "window.__timelines['makeke-html-motion']=tl;window.__hf={seek:function(t){tl.time(t);}};<\\/script></body></html>";
  }

  V._vagShowSceneBackgroundImages = function _vagShowSceneBackgroundImages(sceneImages, options) {
    if (!Array.isArray(sceneImages) || !sceneImages.length || typeof V._addMsg !== 'function') return;
    var opts = options || {};
    var aspectValue = String((V._vagSession && V._vagSession.aspect) || (document.getElementById('vag-aspect') || {}).value || '9:16').trim();
    var previewAspect = aspectValue === '16:9' ? '16/9' : aspectValue === '1:1' ? '1/1' : aspectValue === '4:3' ? '4/3' : aspectValue === '3:4' ? '3/4' : '9/16';
    var gridMin = (previewAspect === '9/16' || previewAspect === '3/4') ? '150px' : '190px';
    var rows = sceneImages.map(function (item, idx) {
      var candidates = item && Array.isArray(item.candidates) && item.candidates.length ? item.candidates : [item];
      var defaultUrl = candidates[0] && (candidates[0].url || candidates[0].path) ? String(candidates[0].url || candidates[0].path) : '';
      if (opts.requireSelection && item && !item.userSelected && defaultUrl) {
        item.url = item.url || defaultUrl;
        item.userSelected = true;
      }
      var selectedUrl = item && item.userSelected && (item.url || item.path) ? String(item.url || item.path) : '';
      if (!selectedUrl && !opts.requireSelection && item && (item.url || item.path)) selectedUrl = String(item.url || item.path);
      var url = selectedUrl || (candidates[0] && (candidates[0].url || candidates[0].path) ? String(candidates[0].url || candidates[0].path) : '');
      if (!url) return '';
      var label = '씬 ' + (item.index || (idx + 1));
      var scenePlan = V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan) ? (V._vagSession.sceneNarrationPlan[idx] || {}) : {};
      var sceneTitle = _vagCleanSceneLine(scenePlan.title || scenePlan.headline || item.sceneTitle || '');
      var sceneNarration = _vagCleanSceneLine(scenePlan.body || scenePlan.narration || item.narration || '');
      var displayConcept = _vagCleanDisplayConcept(item.summary || item.displayPrompt || scenePlan.visualMode || scenePlan.visual_mode || scenePlan.cutPlan || scenePlan.cut_plan || '');
      var source = item.source === 'attached-reference' ? '첨부 이미지' : (item.source || 'AI 생성');
      var candidateButtons = candidates.map(function (candidate, cIdx) {
        var cUrl = candidate && (candidate.url || candidate.path) ? String(candidate.url || candidate.path) : '';
        if (!cUrl) return '';
        var active = !!selectedUrl && cUrl === selectedUrl;
        return '<button type="button" data-vag-bg-choice="' + idx + '" data-vag-bg-choice-url="' + V._esc(cUrl) + '" style="padding:4px 7px;border-radius:999px;border:1px solid ' + (active ? 'rgba(255,140,0,0.65)' : 'rgba(0,0,0,0.1)') + ';background:' + (active ? 'rgba(255,140,0,0.12)' : '#fff') + ';color:' + (active ? '#ff6b00' : 'rgba(0,0,0,0.55)') + ';font-size:10px;font-weight:900;cursor:pointer;">후보 ' + (cIdx + 1) + (active ? ' 선택됨' : ' 선택') + '</button>';
      }).filter(Boolean).join('');
      return '<div style="min-width:0;border:1px solid rgba(0,0,0,0.08);border-radius:10px;overflow:hidden;background:#fff;">' +
        '<button type="button" data-vag-bg-preview="' + V._esc(url) + '" data-vag-bg-label="' + V._esc(label) + '" style="display:block;width:100%;padding:0;border:none;background:#111;cursor:zoom-in;">' +
          '<img data-vag-bg-thumb="' + idx + '" src="' + V._esc(url) + '" alt="' + V._esc(label) + ' 배경 이미지" style="display:block;width:100%;aspect-ratio:' + previewAspect + ';object-fit:contain;object-position:center;background:#111;">' +
        '</button>' +
        '<div style="padding:8px 9px;">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;font-weight:900;color:#1c1c1e;">' +
            '<span>' + V._esc(label) + '</span><span style="font-size:10px;color:rgba(0,0,0,0.46);">' + V._esc(source) + '</span>' +
          '</div>' +
          (sceneTitle ? '<div style="margin-top:5px;font-size:12px;font-weight:950;color:#1c1c1e;line-height:1.35;">' + V._esc(sceneTitle) + '</div>' : '') +
          (sceneNarration ? '<div style="margin-top:3px;font-size:10px;color:rgba(0,0,0,0.58);line-height:1.4;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;">' + V._esc(sceneNarration) + '</div>' : '') +
          (displayConcept ? '<div style="margin-top:4px;font-size:10px;color:rgba(0,0,0,0.48);line-height:1.35;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;">' + V._esc(displayConcept) + '</div>' : '') +
          (opts.requireSelection ? '<div data-vag-bg-picked-label="' + idx + '" style="margin-top:6px;font-size:10px;font-weight:900;color:' + (selectedUrl ? '#34c759' : '#ff9500') + ';">' + (selectedUrl ? (candidates.length > 1 ? '첫 번째 후보 기본 선택' : '자동 선택 완료') : '아직 선택 안 함') + '</div>' : '') +
          (candidateButtons ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;">' + candidateButtons + '</div>' : '') +
          '<button type="button" data-vag-bg-regenerate="' + idx + '" style="margin-top:7px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,140,0,0.22);background:rgba(255,140,0,0.06);color:#ff6b00;font-size:10px;font-weight:900;cursor:pointer;">이 씬 이미지 재작업</button>' +
        '</div>' +
      '</div>';
    }).filter(Boolean).join('');
    if (!rows) return;
    V._addMsg('ai',
      '<div style="border-left:3px solid var(--accent);padding:10px 12px;background:rgba(255,140,0,0.06);border-radius:10px;">' +
        '<div style="font-weight:900;margin-bottom:8px;">생성/배정된 배경 이미지</div>' +
	        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(' + gridMin + ',1fr));gap:10px;">' + rows + '</div>' +
      '</div>',
      { html: true }
    );
    setTimeout(function () {
      document.querySelectorAll('[data-vag-bg-preview]').forEach(function (btn) {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          if (typeof V._vagOpenImagePreview === 'function') {
            V._vagOpenImagePreview(btn.getAttribute('data-vag-bg-preview') || '', btn.getAttribute('data-vag-bg-label') || '배경 이미지');
          }
        });
      });
      document.querySelectorAll('[data-vag-bg-choice]').forEach(function (btn) {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-vag-bg-choice') || '-1', 10);
          var url = btn.getAttribute('data-vag-bg-choice-url') || '';
          if (idx < 0 || !url || !sceneImages[idx]) return;
          sceneImages[idx].url = url;
          sceneImages[idx].userSelected = true;
          var thumb = document.querySelector('[data-vag-bg-thumb="' + idx + '"]');
          var preview = thumb && thumb.closest('[data-vag-bg-preview]');
          var pickedLabel = document.querySelector('[data-vag-bg-picked-label="' + idx + '"]');
          if (thumb) thumb.src = url;
          if (preview) preview.setAttribute('data-vag-bg-preview', url);
          if (pickedLabel) {
            pickedLabel.textContent = '선택 완료';
            pickedLabel.style.color = '#34c759';
          }
          document.querySelectorAll('[data-vag-bg-choice="' + idx + '"]').forEach(function (choice) {
            var active = choice.getAttribute('data-vag-bg-choice-url') === url;
            choice.style.borderColor = active ? 'rgba(255,140,0,0.65)' : 'rgba(0,0,0,0.1)';
            choice.style.background = active ? 'rgba(255,140,0,0.12)' : '#fff';
            choice.style.color = active ? '#ff6b00' : 'rgba(0,0,0,0.55)';
            choice.textContent = choice.textContent.replace(/\s선택됨$/g, '').replace(/\s선택$/g, '') + (active ? ' 선택됨' : ' 선택');
          });
        });
      });
      document.querySelectorAll('[data-vag-bg-regenerate]').forEach(function (btn) {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-vag-bg-regenerate') || '-1', 10);
          var plan = V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan) ? (V._vagSession.sceneNarrationPlan[idx] || {}) : {};
          V._addMsg('ai',
            '씬 ' + (idx + 1) + ' 이미지 재작업 요청을 받았습니다. 현재는 이 씬의 이미지 방향을 다시 확인한 뒤 새 이미지 후보 생성 단계로 돌아가야 합니다.<br>' +
            '<span style="font-size:11px;color:rgba(0,0,0,0.55);">씬: ' + V._esc(plan.title || '') + '</span>',
            { html: true }
          );
        });
      });
    }, 0);
  };

  V._vagOpenImagePreview = function _vagOpenImagePreview(url, label) {
    if (!url) return;
    var old = document.getElementById('vag-image-preview-modal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.id = 'vag-image-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:28px;cursor:zoom-out;';
    modal.innerHTML =
      '<div style="max-width:min(1100px,96vw);max-height:92vh;display:flex;flex-direction:column;gap:10px;cursor:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;color:#fff;">' +
          '<div style="font-size:13px;font-weight:900;">' + V._esc(label || '배경 이미지') + '</div>' +
          '<button type="button" data-vag-close-preview style="padding:8px 11px;border-radius:999px;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.12);color:#fff;font-size:12px;font-weight:900;cursor:pointer;">닫기</button>' +
        '</div>' +
        '<img src="' + V._esc(url) + '" alt="' + V._esc(label || '배경 이미지') + '" style="display:block;max-width:100%;max-height:84vh;object-fit:contain;border-radius:14px;box-shadow:0 28px 80px rgba(0,0,0,0.45);background:#111;">' +
      '</div>';
    modal.addEventListener('click', function (event) {
      if (event.target === modal || event.target.closest('[data-vag-close-preview]')) modal.remove();
    });
    document.addEventListener('keydown', function onEsc(event) {
      if (event.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', onEsc);
      }
    });
    document.body.appendChild(modal);
  };

  V._vagAwaitSceneBackgroundApproval = function _vagAwaitSceneBackgroundApproval(sceneImages, options) {
    return new Promise(function (resolve) {
      var opts = options || {};
      var body = document.getElementById('vag-chat-body');
      if (!body) { resolve({ ok: true }); return; }
      var count = Array.isArray(sceneImages) ? sceneImages.filter(function (item) {
        return item && (item.url || item.path);
      }).length : 0;
      var wrap = document.createElement('div');
      wrap.className = 'vag-chat-options';
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:10px 0;';
      wrap.innerHTML =
        '<div style="border:1px solid rgba(255,140,0,0.18);background:rgba(255,140,0,0.06);border-radius:14px;padding:12px 14px;">' +
          '<div style="font-size:13px;font-weight:950;color:#1c1c1e;">배경 이미지 확인</div>' +
          '<div style="margin-top:5px;font-size:12px;line-height:1.55;color:rgba(0,0,0,0.62);">' +
            '씬별 배경 이미지 ' + count + '장을 먼저 만들었습니다. ' + (opts.requireSelection ? '각 씬의 기준 이미지를 직접 선택해야 다음 단계가 진행됩니다.' : '이미지를 눌러 크게 확인한 뒤, 승인해야 HyperFrames 모션 합성을 시작합니다.') +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
            '<button type="button" data-vag-bg-cancel style="padding:9px 13px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);background:#fff;color:#1c1c1e;font-size:12px;font-weight:850;cursor:pointer;">중단</button>' +
            '<button type="button" data-vag-bg-confirm style="padding:10px 15px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 10px 22px rgba(255,107,0,0.24);">' + (opts.requireSelection ? '선택한 이미지로 계속' : '이 이미지로 모션 합성 시작') + '</button>' +
          '</div>' +
        '</div>';
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        wrap.querySelectorAll('button').forEach(function (btn) { btn.disabled = true; btn.style.cursor = 'default'; btn.style.opacity = '0.7'; });
        resolve(result);
      }
      var confirmBtn = wrap.querySelector('[data-vag-bg-confirm]');
      var cancelBtn = wrap.querySelector('[data-vag-bg-cancel]');
      if (confirmBtn) {
        confirmBtn.onclick = function () {
          if (opts.requireSelection) {
            var missing = (sceneImages || []).filter(function (item) {
              return item && (item.url || item.path || (item.candidates && item.candidates.length)) && !item.userSelected;
            }).length;
            if (missing > 0) {
              if (typeof V._addMsg === 'function') {
                V._addMsg('ai', '<span style="color:#ff9500;">HyperFrames 합성은 각 씬의 배경 컨셉 이미지를 먼저 선택해야 합니다. 아직 ' + missing + '개 씬이 선택되지 않았습니다.</span>', { html: true });
              }
              return;
            }
          }
          confirmBtn.textContent = opts.requireSelection ? '이미지 기준 확정 중...' : '모션 합성 생성중...';
          if (typeof V._vagSetStage === 'function') {
            V._vagSetStage('code', 'working', opts.requireSelection ? '이미지 기준 확정 중' : '모션 합성 생성중', opts.requireSelection ? '선택한 이미지를 다음 단계 입력으로 전달합니다.' : '승인한 배경 이미지를 씬마다 깔고 HTML/GSAP 모션 코드를 만듭니다.');
          }
          finish({ ok: true });
        };
      }
      if (cancelBtn) {
        cancelBtn.onclick = function () {
          if (typeof V._vagSetStage === 'function') {
            V._vagSetStage('code', 'ready', '배경 이미지 확인 대기', '이미지를 확인한 뒤 승인하면 HyperFrames 모션 합성을 시작합니다.');
          }
          finish({ ok: false });
        };
      }
    });
  };

  V._vagFormatClipTime = function _vagFormatClipTime(start) {
    var n = Number(start || 0);
    if (!isFinite(n) || n < 0) n = 0;
    return n.toFixed(1) + 's';
  }

  V._vagRenderTextEditCard = function _vagRenderTextEditCard() {
    var card = document.getElementById('vag-text-edit-card');
    var list = document.getElementById('vag-text-edit-list');
    var narrationBox = document.getElementById('vag-narration-edit');
    var voiceSelect = document.getElementById('vag-voice-select');
    var voiceHidden = document.getElementById('vag-voice');
    if (!card || !list) return;
    var currentNarration = (V._vagSession && V._vagSession.narrationScript) || '';
    var sceneNarrationPlan = (V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan)) ? V._vagSession.sceneNarrationPlan : [];
    if (!currentNarration && V._vagHyperHtml) {
      currentNarration = typeof V._vagBuildPromotionalNarrationScript === 'function'
        ? V._vagBuildPromotionalNarrationScript(V._vagHyperHtml, (V._vagSession && V._vagSession.baseTopic) || '')
        : V._vagExtractNarrationScript(V._vagHyperHtml, (V._vagSession && V._vagSession.baseTopic) || '');
      if (V._vagSession) V._vagSession.narrationScript = currentNarration;
    }
    if (!sceneNarrationPlan.length && V._vagHyperHtml && typeof V._vagExtractSceneNarrationPlan === 'function') {
      sceneNarrationPlan = V._vagExtractSceneNarrationPlan(V._vagHyperHtml, (V._vagSession && V._vagSession.baseTopic) || '', {
        duration: (V._vagSession && V._vagSession.hyperDuration) || 0,
        source: (V._vagSession && V._vagSession.baseSource) || V._vagSourceContent || '',
        cta: (V._vagSession && V._vagSession.cta) || '',
      });
      if (V._vagSession) V._vagSession.sceneNarrationPlan = sceneNarrationPlan;
    }
    if (sceneNarrationPlan.length) {
      sceneNarrationPlan = _vagRepairSceneNarrationPlan(sceneNarrationPlan, (V._vagSession && V._vagSession.baseTopic) || '', {
        source: (V._vagSession && V._vagSession.baseSource) || V._vagSourceContent || '',
        cta: (V._vagSession && V._vagSession.cta) || '',
      });
      if (V._vagSession) {
        V._vagSession.sceneNarrationPlan = sceneNarrationPlan;
        V._vagSession.narrationScript = sceneNarrationPlan.map(function (scene) { return scene.narration; }).filter(Boolean).join('\n');
        currentNarration = V._vagSession.narrationScript;
      }
    }
    if (narrationBox && document.activeElement !== narrationBox) {
      narrationBox.value = currentNarration || '';
      narrationBox.dataset.originalValue = currentNarration || '';
    }
    if (voiceSelect && voiceHidden && document.activeElement !== voiceSelect) {
      voiceSelect.value = voiceHidden.value || '';
    }
    if (voiceSelect && voiceHidden) {
      voiceSelect.onchange = function () {
        voiceHidden.value = voiceSelect.value || '';
        if (V._vagSession) V._vagSession.narrationVoice = voiceHidden.value;
      };
    }
    if (!V._vagTextEntries.length && !currentNarration && !sceneNarrationPlan.length) {
      card.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    if (!V._vagTextEntries.length && !sceneNarrationPlan.length) {
      list.innerHTML = '<div style="padding:12px 14px;border:1px dashed rgba(255,140,0,0.18);border-radius:14px;background:rgba(255,248,241,0.45);font-size:12px;color:rgba(0,0,0,0.5);line-height:1.6;">장면 문구는 찾지 못했지만 씬별 나레이션은 수정할 수 있습니다.</div>';
      card.style.display = 'block';
      return;
    }
    var groups = {};
    var order = [];
    function findSceneGroupKey(entry) {
      if (!sceneNarrationPlan.length) return String(entry.clipIndex);
      var start = Number(entry.start || 0) || 0;
      var bestIdx = 0;
      for (var i = 0; i < sceneNarrationPlan.length; i++) {
        var sceneStart = Number(sceneNarrationPlan[i].start || 0) || 0;
        var nextStart = i < sceneNarrationPlan.length - 1 ? Number(sceneNarrationPlan[i + 1].start || 0) || Infinity : Infinity;
        if (start >= sceneStart - 0.05 && start < nextStart - 0.05) {
          bestIdx = i;
          break;
        }
        if (Math.abs(start - sceneStart) < Math.abs(start - (Number(sceneNarrationPlan[bestIdx].start || 0) || 0))) bestIdx = i;
      }
      return 'scene-' + bestIdx;
    }
    if (sceneNarrationPlan.length) {
      sceneNarrationPlan.forEach(function (scene, idx) {
        var key = 'scene-' + idx;
        groups[key] = { clipIndex: idx, start: Number(scene.start || 0) || 0, scene: scene, items: [] };
        order.push(key);
      });
    }
    V._vagTextEntries.forEach(function (entry) {
      var key = findSceneGroupKey(entry);
      if (!groups[key]) {
        groups[key] = { clipIndex: entry.clipIndex, start: entry.start, items: [] };
        order.push(key);
      }
      groups[key].items.push(entry);
    });

    var html = '';
    if (sceneNarrationPlan.length) {
      html += '<div style="border:1px solid rgba(0,122,255,0.10);border-radius:14px;padding:12px 14px;background:rgba(0,122,255,0.04);display:flex;flex-direction:column;gap:8px;">';
      html += '<div style="font-size:12px;font-weight:900;color:#007aff;">씬별 나레이션 싱크</div>';
      sceneNarrationPlan.forEach(function (scene, idx) {
        html += '<label style="display:flex;flex-direction:column;gap:4px;">';
        var sceneTitleLabel = _vagIsRoleLabelOnly(scene.title) ? ('장면 ' + (idx + 1)) : (scene.title || '');
        html += '<span style="font-size:10px;font-weight:800;color:rgba(0,0,0,0.48);">씬 ' + (idx + 1) + (sceneTitleLabel ? ' · ' + V._esc(sceneTitleLabel) : '') + '</span>';
        var sceneNarrationText = typeof V._vagNormalizeNarrationForSpeech === 'function'
          ? V._vagNormalizeNarrationForSpeech(scene.narration || '', {})
          : (scene.narration || '');
        html += '<textarea data-vag-scene-narration="' + idx + '" rows="2" style="width:100%;padding:8px 10px;border-radius:9px;border:1px solid rgba(0,122,255,0.12);background:#fff;font-size:12px;line-height:1.55;resize:vertical;">' + V._esc(sceneNarrationText) + '</textarea>';
        html += '</label>';
      });
      html += '</div>';
    }
    order.forEach(function (key, sceneIdx) {
      var group = groups[key];
      if (!group.items.length && sceneNarrationPlan.length) return;
      html += '<div style="border:1px solid rgba(0,0,0,0.06);border-radius:14px;padding:12px 14px;background:rgba(255,248,241,0.35);display:flex;flex-direction:column;gap:8px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">';
      html += '<div style="font-size:12px;font-weight:800;color:#1c1c1e;">씬 ' + (group.scene ? group.scene.index : (sceneIdx + 1)) + '</div>';
      html += '<div style="font-size:10px;color:rgba(0,0,0,0.42);font-weight:700;">등장 ' + V._vagFormatClipTime(group.start) + '</div>';
      html += '</div>';
      group.items.forEach(function (entry) {
        var multi = entry.hasBr || entry.text.length > 36;
        html += '<label style="display:flex;flex-direction:column;gap:4px;">';
        html += '<span style="font-size:10px;font-weight:700;color:rgba(0,0,0,0.48);">' + V._esc(entry.label) + '</span>';
        if (multi) {
          html += '<textarea data-vag-ref="' + entry.ref + '" rows="' + Math.min(4, Math.max(2, entry.text.split('\n').length)) + '" style="width:100%;padding:8px 10px;border-radius:9px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;line-height:1.55;resize:vertical;">' + V._esc(entry.text) + '</textarea>';
        } else {
          html += '<input type="text" data-vag-ref="' + entry.ref + '" value="' + V._esc(entry.text) + '" style="width:100%;padding:8px 10px;border-radius:9px;border:1px solid rgba(0,0,0,0.08);background:#fff;font-size:12px;">';
        }
        html += '</label>';
      });
      html += '</div>';
    });

    list.innerHTML = html;
    card.style.display = 'block';
  }

  V._vagSyncScenarioChatEditorToSession = function _vagSyncScenarioChatEditorToSession() {
    var root = document.getElementById('vag-scenario-chat-editor');
    if (!root || !V._vagSession || !Array.isArray(V._vagSession.sceneNarrationPlan)) return;
    var plan = V._vagSession.sceneNarrationPlan.slice();
    root.querySelectorAll('[data-vag-chat-scene-field]').forEach(function (field) {
      var idx = parseInt(field.getAttribute('data-vag-chat-scene-index') || '0', 10) || 0;
      var key = field.getAttribute('data-vag-chat-scene-field') || '';
      if (!plan[idx] || !key) return;
      var value = String(field.value || '').trim();
      plan[idx] = Object.assign({}, plan[idx], { [key]: value });
      if (key === 'imagePrompt') plan[idx].image_prompt = value;
    });
    root.querySelectorAll('[data-vag-scene-choice]').forEach(function (field) {
      var idx = parseInt(field.getAttribute('data-vag-chat-scene-index') || '0', 10) || 0;
      var key = field.getAttribute('data-vag-scene-choice') || '';
      if (!plan[idx] || !key) return;
      plan[idx] = Object.assign({}, plan[idx], { [key]: String(field.value || '').trim() });
    });
    V._vagSession.sceneNarrationPlan = plan;
    V._vagSession.narrationScript = plan.map(function (scene) { return scene.narration || ''; }).filter(Boolean).join('\n');
    var narrationBox = document.getElementById('vag-narration-edit');
    if (narrationBox && document.activeElement !== narrationBox) narrationBox.value = V._vagSession.narrationScript;
  }

  function _vagScenarioProductionFieldValue(scene, key) {
    var snakeMap = {
      shotType: 'shot_type',
      subjectAction: 'subject_action',
      artDirection: 'art_direction',
      propsWardrobe: 'props_wardrobe',
      soundCue: 'sound_cue',
      editBeat: 'edit_beat',
      lipSyncHint: 'lip_sync_hint',
      negativeConstraints: 'negative_constraints',
    };
    return String((scene && (scene[key] || scene[snakeMap[key] || key])) || '').trim();
  }

  function _vagScenarioProductionFields() {
    return [
      ['shotType', '쇼트 타입', '예: medium lifestyle, macro product detail, over-shoulder interview'],
      ['subjectAction', '피사체 행동', '모델/손/제품/공간이 실제로 무엇을 하는지'],
      ['camera', '카메라', '프레이밍, 움직임, push-in/pan/hold 방향'],
      ['lens', '렌즈/초점', '렌즈 느낌, 심도, 초점 이동'],
      ['lighting', '조명', '광원 방향, 색온도, 명암, 무드'],
      ['artDirection', '미술/공간', '공간, 표면 질감, 브랜드 무드'],
      ['propsWardrobe', '소품/의상', '소품, 의상, 손/모델 스타일'],
      ['composition', '구도/여백', '피사체 위치와 텍스트 안전 영역'],
      ['transition', '전환', '이전/다음 씬과 이어지는 방식'],
      ['soundCue', '사운드 큐', 'BGM/SFX/나레이션 반응 지점'],
      ['editBeat', '편집 비트', '컷 타이밍, 홀드, 리빌, 감정 비트'],
      ['lipSyncHint', '립싱크', '말하는 컷이면 입모양/표정/시선 지시, 아니면 lip sync 없음'],
      ['negativeConstraints', '금지 요소', '피해야 할 이미지/모션/텍스트 요소'],
    ];
  }

  V._vagRenderScenarioChatEditor = function _vagRenderScenarioChatEditor(options) {
    var body = document.getElementById('vag-chat-body');
    var plan = (V._vagSession && Array.isArray(V._vagSession.sceneNarrationPlan)) ? V._vagSession.sceneNarrationPlan : [];
    if (!body || !plan.length) return;
    plan = plan.map(function (scene, idx) {
      var recommended = typeof V._vagRecommendSceneTextStyle === 'function' ? V._vagRecommendSceneTextStyle(scene, idx, plan.length) : {};
      return Object.assign({}, scene, {
        textLayout: scene.textLayout || scene.text_layout || recommended.textLayout || 'bottom-left',
        textMotion: scene.textMotion || scene.text_motion || recommended.textMotion || 'rise',
        textDesign: scene.textDesign || scene.text_design || recommended.textDesign || 'open',
        screenEffect: scene.screenEffect || scene.screen_effect || recommended.screenEffect || 'push-in',
        transitionEffect: scene.transitionEffect || scene.transition_effect || recommended.transitionEffect || 'fade',
      });
    });
    if (V._vagSession) V._vagSession.sceneNarrationPlan = plan;
    var old = document.getElementById('vag-scenario-chat-editor-wrap');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'vag-scenario-chat-editor-wrap';
    wrap.style.cssText = 'display:flex;justify-content:flex-start;';
    var inner = document.createElement('div');
    inner.id = 'vag-scenario-chat-editor';
    inner.style.cssText = 'max-width:96%;width:min(760px,96%);padding:14px;border-radius:4px 16px 16px 16px;background:#fff;border:2px solid rgba(255,140,0,0.22);box-shadow:0 14px 34px rgba(255,140,0,0.12);font-size:12px;line-height:1.55;color:#1c1c1e;';
    var html = '';
    if (!document.getElementById('vag-scene-preview-motion-style')) {
      var previewStyle = document.createElement('style');
      previewStyle.id = 'vag-scene-preview-motion-style';
      previewStyle.textContent = [
        '@keyframes vagPreviewRise{0%{opacity:.2;transform:var(--vag-preview-base-transform) translateY(16px) scale(.96)}38%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateY(0) scale(1)}}',
        '@keyframes vagPreviewDrop{0%{opacity:.2;transform:var(--vag-preview-base-transform) translateY(-16px) scale(.98)}42%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateY(0) scale(1)}}',
        '@keyframes vagPreviewSlideRight{0%{opacity:.2;transform:var(--vag-preview-base-transform) translateX(-22px)}42%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateX(0)}}',
        '@keyframes vagPreviewSlideLeft{0%{opacity:.2;transform:var(--vag-preview-base-transform) translateX(22px)}42%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateX(0)}}',
        '@keyframes vagPreviewScale{0%{opacity:.2;transform:var(--vag-preview-base-transform) scale(.78)}46%,100%{opacity:1;transform:var(--vag-preview-base-transform) scale(1)}}',
        '@keyframes vagPreviewSnap{0%{opacity:.15;transform:var(--vag-preview-base-transform) translateX(18px) scale(.92)}22%{opacity:1;transform:var(--vag-preview-base-transform) translateX(-4px) scale(1.06)}42%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateX(0) scale(1)}}',
        '@keyframes vagPreviewFloat{0%,100%{opacity:1;transform:var(--vag-preview-base-transform) translateY(0)}50%{opacity:1;transform:var(--vag-preview-base-transform) translateY(-7px)}}',
        '@keyframes vagPreviewLock{0%,100%{opacity:1;transform:var(--vag-preview-base-transform) scale(1);box-shadow:0 0 0 rgba(255,140,0,0)}50%{opacity:1;transform:var(--vag-preview-base-transform) scale(1.035);box-shadow:0 0 0 5px rgba(255,140,0,.18)}}',
        '@keyframes vagPreviewBgPush{0%{transform:scale(1.02)}100%{transform:scale(1.16)}}',
        '@keyframes vagPreviewBgPull{0%{transform:scale(1.16)}100%{transform:scale(1.03)}}',
        '@keyframes vagPreviewBgPanLeft{0%{transform:scale(1.12) translateX(16px)}100%{transform:scale(1.12) translateX(-16px)}}',
        '@keyframes vagPreviewBgPanRight{0%{transform:scale(1.12) translateX(-16px)}100%{transform:scale(1.12) translateX(16px)}}',
        '@keyframes vagPreviewBgDriftUp{0%{transform:scale(1.1) translateY(14px)}100%{transform:scale(1.1) translateY(-14px)}}',
        '@keyframes vagPreviewBgTilt{0%{transform:scale(1.1) rotate(-1.4deg) translate(-8px,6px)}100%{transform:scale(1.13) rotate(1.4deg) translate(8px,-6px)}}',
        '@keyframes vagPreviewBgMacro{0%{transform:scale(1.07)}100%{transform:scale(1.22) translate(-8px,5px)}}',
        '@keyframes vagPreviewBgPulse{0%,100%{transform:scale(1.05);filter:saturate(1)}50%{transform:scale(1.1);filter:saturate(1.22)}}',
        '@keyframes vagPreviewTransFade{0%{opacity:.7}45%,100%{opacity:0}}',
        '@keyframes vagPreviewTransWipeLeft{0%{transform:translateX(-100%);opacity:.86}55%,100%{transform:translateX(100%);opacity:0}}',
        '@keyframes vagPreviewTransWipeUp{0%{transform:translateY(100%);opacity:.82}55%,100%{transform:translateY(-100%);opacity:0}}',
        '@keyframes vagPreviewTransZoom{0%{opacity:.65;transform:scale(.78)}45%,100%{opacity:0;transform:scale(1.28)}}',
        '@keyframes vagPreviewTransFlash{0%{opacity:.82}28%,100%{opacity:0}}',
        '@keyframes vagPreviewTransDip{0%{opacity:.72;background:rgba(0,0,0,.78)}50%,100%{opacity:0;background:rgba(0,0,0,.78)}}',
      ].join('\n');
      document.head.appendChild(previewStyle);
    }
    var profileDesignGuide = (V._vagSession && V._vagSession.profileDesignGuide)
      || (typeof V._vagBuildProfileDesignGuideBlock === 'function' ? V._vagBuildProfileDesignGuideBlock() : '');
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">';
    html += '<div><div style="font-size:14px;font-weight:950;color:#7c2d12;">시나리오·프로덕션 콘티 확인</div>';
    html += '<div style="font-size:11px;font-weight:750;color:rgba(124,45,18,0.68);margin-top:2px;">배경 컨셉 이미지 생성 전에 씬별 쇼트, 행동, 카메라, 조명, 립싱크까지 확정합니다.</div></div>';
    html += '<button id="vag-scenario-chat-confirm" type="button" style="padding:10px 14px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b00);color:#fff;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 10px 22px rgba(255,107,0,0.24);">이 콘티로 모션 합성</button>';
    html += '</div>';
    if (profileDesignGuide) {
      html += '<div style="margin:8px 0 10px;padding:10px 11px;border-radius:12px;border:1px solid rgba(59,130,246,0.22);background:rgba(59,130,246,0.06);">';
      html += '<div style="font-size:11px;font-weight:950;color:#1d4ed8;margin-bottom:5px;">프로필 디자인 규칙 적용 중</div>';
      html += '<div style="font-size:10.5px;line-height:1.5;color:rgba(0,0,0,0.62);white-space:pre-wrap;max-height:132px;overflow:auto;">' + V._esc(String(profileDesignGuide).slice(0, 1400)) + '</div>';
      html += '</div>';
    } else {
      html += '<div style="margin:8px 0 10px;padding:9px 10px;border-radius:12px;border:1px solid rgba(255,149,0,0.24);background:rgba(255,149,0,0.08);font-size:10.5px;font-weight:800;color:#9a4a00;">프로필 디자인 규칙이 비어 있습니다. 프로필 편집의 디자인 규칙을 저장하면 씬 이미지와 HyperFrames에 함께 반영됩니다.</div>';
    }
    plan.forEach(function (scene, idx) {
      html += '<div style="margin-top:10px;padding:12px;border-radius:14px;border:1px solid rgba(255,140,0,0.16);background:rgba(255,248,241,0.56);display:flex;flex-direction:column;gap:7px;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><b style="font-size:12px;color:#9a4a00;">씬 ' + (idx + 1) + '</b><span style="font-size:10px;font-weight:800;color:rgba(0,0,0,0.42);">' + V._esc(scene.role || '') + '</span></div>';
      html += '<div style="font-size:10.5px;font-weight:800;color:rgba(0,0,0,0.5);">AI가 먼저 골라둔 화면 연출입니다. 마음에 안 드는 것만 바꾸면 됩니다.</div>';
      var layoutValue = scene.textLayout || scene.text_layout || 'bottom-left';
      var motionValue = scene.textMotion || scene.text_motion || 'rise';
      var designValue = scene.textDesign || scene.text_design || 'open';
      var screenEffectValue = scene.screenEffect || scene.screen_effect || 'push-in';
      var transitionEffectValue = scene.transitionEffect || scene.transition_effect || 'fade';
      html += '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:stretch;">';
      html += '<div data-vag-scene-preview="' + idx + '" style="position:relative;min-height:150px;border-radius:12px;background:#111827;overflow:hidden;border:1px solid rgba(255,255,255,0.12);">';
      html += '<div data-vag-preview-bg style="position:absolute;inset:-12%;background:radial-gradient(circle at 30% 24%,rgba(255,255,255,.24),transparent 28%),linear-gradient(135deg,#111827,#334155 48%,#0f172a);"></div>';
      html += '<div data-vag-preview-transition style="position:absolute;inset:0;background:rgba(255,255,255,.75);opacity:0;pointer-events:none;"></div>';
      html += '<div data-vag-preview-text style="position:absolute;max-width:72%;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.14);color:#fff;font-size:9px;font-weight:900;line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,.8);">문구 위치</div>';
      html += '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;">';
      html += '<label style="display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:850;color:rgba(0,0,0,0.55);">전체 효과<select data-vag-chat-scene-index="' + idx + '" data-vag-scene-choice="screenEffect" style="width:100%;padding:7px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:11px;">' +
        [['push-in', '앞으로 다가오기'], ['pull-back', '뒤로 빠지기'], ['pan-left', '왼쪽으로 흐름'], ['pan-right', '오른쪽으로 흐름'], ['drift-up', '위로 천천히'], ['tilt-drift', '살짝 기울기'], ['macro-push', '가까이 당기기'], ['pulse', '강조 펄스']].map(function (item) {
          return '<option value="' + item[0] + '"' + (screenEffectValue === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('') + '</select></label>';
      html += '<label style="display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:850;color:rgba(0,0,0,0.55);">전환 효과<select data-vag-chat-scene-index="' + idx + '" data-vag-scene-choice="transitionEffect" style="width:100%;padding:7px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:11px;">' +
        [['fade', '부드럽게 전환'], ['wipe-left', '옆으로 열림'], ['wipe-up', '위로 열림'], ['zoom-cut', '확대 전환'], ['flash', '밝게 번쩍'], ['dip', '어둡게 전환']].map(function (item) {
          return '<option value="' + item[0] + '"' + (transitionEffectValue === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('') + '</select></label>';
      html += '<label style="display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:850;color:rgba(0,0,0,0.55);">위치<select data-vag-chat-scene-index="' + idx + '" data-vag-scene-choice="textLayout" style="width:100%;padding:7px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:11px;">' +
        [['top-left', '상단 왼쪽'], ['top-right', '상단 오른쪽'], ['middle-left', '중앙 왼쪽'], ['middle-right', '중앙 오른쪽'], ['center', '가운데'], ['bottom-left', '하단 왼쪽'], ['bottom-right', '하단 오른쪽']].map(function (item) {
          return '<option value="' + item[0] + '"' + (layoutValue === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('') + '</select></label>';
      html += '<label style="display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:850;color:rgba(0,0,0,0.55);">애니<select data-vag-chat-scene-index="' + idx + '" data-vag-scene-choice="textMotion" style="width:100%;padding:7px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:11px;">' +
        [['rise', '아래서 등장'], ['slide-right', '오른쪽으로 밀기'], ['slide-left', '왼쪽으로 밀기'], ['drop', '위에서 등장'], ['scale', '확대 등장'], ['snap', '툭 치듯 등장'], ['float', '부드럽게 떠오름'], ['lock', 'CTA 고정']].map(function (item) {
          return '<option value="' + item[0] + '"' + (motionValue === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('') + '</select></label>';
      html += '<label style="display:flex;flex-direction:column;gap:4px;font-size:10px;font-weight:850;color:rgba(0,0,0,0.55);">디자인<select data-vag-chat-scene-index="' + idx + '" data-vag-scene-choice="textDesign" style="width:100%;padding:7px;border-radius:8px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:11px;">' +
        [['open', '큰 오픈 문구'], ['glass', '반투명 박스'], ['line', '라인 강조'], ['proof', '숫자/근거 강조'], ['minimal', '심플 포인트'], ['split', '분리형 문구'], ['cta', 'CTA 강조']].map(function (item) {
          return '<option value="' + item[0] + '"' + (designValue === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
        }).join('') + '</select></label>';
      html += '</div></div>';
      [['title', '화면 핵심 문구', 1], ['body', '화면 보조 문구', 2], ['narration', '나레이션', 2], ['imagePrompt', '배경 이미지 프롬프트', 3]].forEach(function (item) {
        var key = item[0], label = item[1], rows = item[2];
        var value = key === 'imagePrompt' ? _vagImagePromptEditorValue(scene) : (scene[key] || '');
        value = key === 'imagePrompt' ? value : _vagCleanSceneLine(value);
        html += '<label style="display:flex;flex-direction:column;gap:4px;">';
        html += '<span style="font-size:10px;font-weight:850;color:rgba(0,0,0,0.48);">' + label + '</span>';
        html += '<textarea data-vag-chat-scene-index="' + idx + '" data-vag-chat-scene-field="' + key + '" rows="' + rows + '" style="width:100%;padding:8px 9px;border-radius:9px;border:1px solid rgba(255,140,0,0.18);background:#fff;font-size:12px;line-height:1.55;resize:vertical;font-family:inherit;">' + V._esc(value || '') + '</textarea>';
        html += '</label>';
      });
      html += '</div>';
    });
    html += '<div style="margin-top:10px;font-size:10.5px;font-weight:750;color:rgba(0,0,0,0.48);">확정 전에는 배경 컨셉 이미지와 HyperFrames HTML 생성을 시작하지 않습니다. 수정한 콘티는 씬 이미지, BGM, HyperFrames 코드에 함께 반영됩니다.</div>';
    inner.innerHTML = html;
    wrap.appendChild(inner);
    body.querySelectorAll('.typing-indicator').forEach(function (el) { el.remove(); });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    inner.querySelectorAll('[data-vag-chat-scene-field]').forEach(function (field) {
      field.addEventListener('input', function () {
        V._vagSyncScenarioChatEditorToSession();
      });
    });
    function refreshScenePreview(select) {
      var idx = parseInt(select.getAttribute('data-vag-chat-scene-index') || '0', 10) || 0;
      var preview = inner.querySelector('[data-vag-scene-preview="' + idx + '"]');
      var text = preview && preview.querySelector('[data-vag-preview-text]');
      var bg = preview && preview.querySelector('[data-vag-preview-bg]');
      var transition = preview && preview.querySelector('[data-vag-preview-transition]');
      if (!preview || !text || !bg || !transition) return;
      var screenEffect = (inner.querySelector('[data-vag-chat-scene-index="' + idx + '"][data-vag-scene-choice="screenEffect"]') || {}).value || 'push-in';
      var transitionEffect = (inner.querySelector('[data-vag-chat-scene-index="' + idx + '"][data-vag-scene-choice="transitionEffect"]') || {}).value || 'fade';
      var layout = (inner.querySelector('[data-vag-chat-scene-index="' + idx + '"][data-vag-scene-choice="textLayout"]') || {}).value || 'bottom-left';
      var motion = (inner.querySelector('[data-vag-chat-scene-index="' + idx + '"][data-vag-scene-choice="textMotion"]') || {}).value || 'rise';
      var design = (inner.querySelector('[data-vag-chat-scene-index="' + idx + '"][data-vag-scene-choice="textDesign"]') || {}).value || 'open';
      var bgMotionMap = {
        'push-in': 'vagPreviewBgPush',
        'pull-back': 'vagPreviewBgPull',
        'pan-left': 'vagPreviewBgPanLeft',
        'pan-right': 'vagPreviewBgPanRight',
        'drift-up': 'vagPreviewBgDriftUp',
        'tilt-drift': 'vagPreviewBgTilt',
        'macro-push': 'vagPreviewBgMacro',
        pulse: 'vagPreviewBgPulse',
      };
      bg.style.animation = 'none';
      void bg.offsetWidth;
      bg.style.animation = (bgMotionMap[screenEffect] || 'vagPreviewBgPush') + ' 2.2s ease-in-out infinite alternate';
      var transitionMap = {
        fade: 'vagPreviewTransFade',
        'wipe-left': 'vagPreviewTransWipeLeft',
        'wipe-up': 'vagPreviewTransWipeUp',
        'zoom-cut': 'vagPreviewTransZoom',
        flash: 'vagPreviewTransFlash',
        dip: 'vagPreviewTransDip',
      };
      transition.style.animation = 'none';
      transition.style.transform = 'none';
      transition.style.borderRadius = transitionEffect === 'zoom-cut' ? '999px' : '0';
      transition.style.background = transitionEffect === 'dip' ? 'rgba(0,0,0,.78)' : 'rgba(255,255,255,.78)';
      void transition.offsetWidth;
      transition.style.animation = (transitionMap[transitionEffect] || 'vagPreviewTransFade') + ' 2.35s ease-in-out infinite';
      var pos = {
        'top-left': ['10px', 'auto', '10px', 'auto', 'left'],
        'top-right': ['10px', 'auto', 'auto', '10px', 'right'],
        'middle-left': ['50%', 'auto', '10px', 'auto', 'left'],
        'middle-right': ['50%', 'auto', 'auto', '10px', 'right'],
        center: ['50%', 'auto', '50%', 'auto', 'center'],
        'bottom-left': ['auto', '10px', '10px', 'auto', 'left'],
        'bottom-right': ['auto', '10px', 'auto', '10px', 'right'],
      }[layout] || ['auto', '10px', '10px', 'auto', 'left'];
      text.style.top = pos[0];
      text.style.bottom = pos[1];
      text.style.left = pos[2];
      text.style.right = pos[3];
      text.style.textAlign = pos[4];
      var baseTransform = layout === 'center' ? 'translate(-50%,-50%)' : (/middle/.test(layout) ? 'translateY(-50%)' : 'translate(0,0)');
      text.style.setProperty('--vag-preview-base-transform', baseTransform);
      text.style.transform = 'var(--vag-preview-base-transform)';
      text.style.borderLeft = design === 'line' ? '4px solid #ff8c00' : '0';
      text.style.borderRadius = design === 'minimal' ? '999px' : '8px';
      text.style.padding = design === 'minimal' ? '7px 11px' : '6px 8px';
      text.style.borderTop = design === 'split' ? '2px solid rgba(255,255,255,.82)' : '0';
      text.style.background = design === 'open' ? 'transparent' : design === 'proof' ? 'rgba(0,0,0,.56)' : design === 'cta' ? '#ff8c00' : 'rgba(255,255,255,.14)';
      text.style.backdropFilter = design === 'glass' ? 'blur(8px)' : 'none';
      text.style.boxShadow = design === 'cta' ? '0 8px 18px rgba(255,107,0,.35)' : 'none';
      var motionMap = {
        rise: 'vagPreviewRise',
        drop: 'vagPreviewDrop',
        'slide-right': 'vagPreviewSlideRight',
        'slide-left': 'vagPreviewSlideLeft',
        scale: 'vagPreviewScale',
        snap: 'vagPreviewSnap',
        float: 'vagPreviewFloat',
        lock: 'vagPreviewLock',
      };
      text.style.animation = 'none';
      void text.offsetWidth;
      text.style.animation = (motionMap[motion] || 'vagPreviewRise') + ' 1.65s cubic-bezier(.16,1,.3,1) infinite';
    }
    inner.querySelectorAll('[data-vag-scene-choice]').forEach(function (field) {
      field.addEventListener('change', function () {
        V._vagSyncScenarioChatEditorToSession();
        refreshScenePreview(field);
      });
      refreshScenePreview(field);
    });
    var confirmBtn = inner.querySelector('#vag-scenario-chat-confirm');
    if (confirmBtn) confirmBtn.onclick = function () {
      V._vagSyncScenarioChatEditorToSession();
      confirmBtn.disabled = true;
      confirmBtn.textContent = '모션 합성 생성중...';
      if (typeof V._vagSetStage === 'function') {
        V._vagSetStage('code', 'working', '모션 합성 생성중', '확정한 콘티와 배경 컨셉 이미지 방향을 HyperFrames 코드로 변환하고 있습니다.');
        V._vagSetStage('render', 'idle', '렌더 대기', 'HyperFrames 모션 합성이 끝나면 음성·BGM·MP4 렌더가 이어집니다.');
      }
      setTimeout(function () {
        var rightConfirm = document.getElementById('vag-render-confirm');
        if (rightConfirm) rightConfirm.click();
      }, 30);
    };
  }

  V._vagResetTextEditCard = function _vagResetTextEditCard() {
    V._vagTextEntries = [];
    var card = document.getElementById('vag-text-edit-card');
    var list = document.getElementById('vag-text-edit-list');
    if (list) list.innerHTML = '';
    if (card) card.style.display = 'none';
  }

  V._vagEnsureStudioProjectId = function _vagEnsureStudioProjectId(topic) {
    if (V._vagStudioProjectId) return V._vagStudioProjectId;
    var profileName = (window._globalProfileData || {}).name || '';
    var stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
    var parts = ['vag'];
    if (profileName) parts.push(V._vagSafeId(profileName));
    if (topic) parts.push(V._vagSafeId(topic));
    parts.push(stamp);
    V._vagStudioProjectId = parts.filter(Boolean).join('-').slice(0, 90) || ('vag-' + stamp);
    return V._vagStudioProjectId;
  }

  V._vagStudioUrl = function _vagStudioUrl(projectId, cacheBust) {
    var query = cacheBust ? ('?v=' + Date.now()) : '';
    var hash = projectId ? ('#project/' + encodeURIComponent(projectId)) : '';
    return '/api/hyperframes/studio' + query + hash;
  }

  V._vagSetStage = function _vagSetStage(step, tone, title, detail) {
    var el = document.getElementById('vag-stage-' + step);
    if (!el) return;
    var visibleTitle = typeof V._vagHumanizeText === 'function' ? V._vagHumanizeText(title || '') : (title || '');
    var visibleDetail = typeof V._vagHumanizeText === 'function' ? V._vagHumanizeText(detail || '') : (detail || '');
    // 상태 애니메이션 keyframes 1회 주입
    if (!document.getElementById('vag-stage-pulse-style')) {
      var sEl = document.createElement('style');
      sEl.id = 'vag-stage-pulse-style';
      sEl.textContent =
        // 진행 중 - 숫자 원을 감싸는 이중 링 펄스 (box-shadow 로 확장되며 페이드아웃)
        '@keyframes vag-stage-ring-pulse{' +
          '0%{box-shadow:0 0 0 0 rgba(255,140,0,0.55),0 0 0 0 rgba(255,140,0,0.35);}' +
          '60%{box-shadow:0 0 0 8px rgba(255,140,0,0),0 0 0 16px rgba(255,140,0,0);}' +
          '100%{box-shadow:0 0 0 0 rgba(255,140,0,0),0 0 0 0 rgba(255,140,0,0);}' +
        '}' +
        // 진행 중 - 숫자 자체 부드러운 바운스
        '@keyframes vag-stage-number-breathe{' +
          '0%,100%{transform:scale(1);}' +
          '50%{transform:scale(1.08);}' +
        '}' +
        // 상태 도트 펄스
        '@keyframes vag-stage-dot-pulse{' +
          '0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 0 0 rgba(255,140,0,0.6);}' +
          '50%{opacity:0.6;transform:scale(1.4);box-shadow:0 0 0 4px rgba(255,140,0,0);}' +
        '}' +
        // 완료 - 체크 마크 팝인
        '@keyframes vag-stage-check-pop{' +
          '0%{transform:scale(0.3) rotate(-45deg);opacity:0;}' +
          '60%{transform:scale(1.25) rotate(0);opacity:1;}' +
          '100%{transform:scale(1) rotate(0);opacity:1;}' +
        '}' +
        // 상태 전환 시 원 전체가 살짝 튀어오름
        '@keyframes vag-stage-order-pop{' +
          '0%{transform:scale(0.85);}' +
          '55%{transform:scale(1.12);}' +
          '100%{transform:scale(1);}' +
        '}' +
        // 에러 - 좌우 흔들림
        '@keyframes vag-stage-shake{' +
          '0%,100%{transform:translateX(0);}' +
          '20%{transform:translateX(-4px);}' +
          '40%{transform:translateX(4px);}' +
          '60%{transform:translateX(-3px);}' +
          '80%{transform:translateX(2px);}' +
        '}' +
        // 진행 중 - 카드 배경 숨결
        '@keyframes vag-stage-card-breath{' +
          '0%,100%{box-shadow:0 14px 38px rgba(255,140,0,0.16),0 2px 6px rgba(255,140,0,0.08);}' +
          '50%{box-shadow:0 16px 44px rgba(255,140,0,0.24),0 4px 10px rgba(255,140,0,0.12);}' +
        '}' +
        '.vag-stage-card{will-change:transform,box-shadow;}' +
        // 진행 중 - 이중 펄스 + 숫자 바운스 + 카드 숨결
        '.vag-stage-card[data-vag-stage-tone="working"] [data-vag-stage-order]{' +
          'animation:vag-stage-ring-pulse 1.8s cubic-bezier(0.4,0,0.6,1) infinite;' +
        '}' +
        '.vag-stage-card[data-vag-stage-tone="working"] [data-vag-stage-order]::before{' +
          'content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid rgba(255,140,0,0.4);border-top-color:transparent;border-right-color:transparent;animation:vag-stage-order-spin 1.2s linear infinite;pointer-events:none;' +
        '}' +
        '@keyframes vag-stage-order-spin{to{transform:rotate(360deg);}}' +
        '.vag-stage-card[data-vag-stage-tone="working"] [data-vag-stage-number]{' +
          'animation:vag-stage-number-breathe 1.8s ease-in-out infinite;' +
        '}' +
        '.vag-stage-card[data-vag-stage-tone="working"] [data-vag-stage-dot]{' +
          'animation:vag-stage-dot-pulse 1.2s ease-in-out infinite;' +
        '}' +
        '.vag-stage-card[data-vag-stage-tone="working"]{' +
          'animation:vag-stage-card-breath 3s ease-in-out infinite;' +
        '}' +
        // 완료 - 체크 마크 팝인
        '.vag-stage-card[data-vag-stage-tone="ready"] [data-vag-stage-number]{' +
          'animation:vag-stage-check-pop 0.55s cubic-bezier(0.34,1.56,0.64,1);' +
        '}' +
        '.vag-stage-card[data-vag-stage-tone="ready"] [data-vag-stage-order]{' +
          'animation:vag-stage-order-pop 0.45s cubic-bezier(0.34,1.56,0.64,1);' +
        '}' +
        // 에러 - 흔들림
        '.vag-stage-card[data-vag-stage-tone="error"] [data-vag-stage-order]{' +
          'animation:vag-stage-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97);' +
        '}';
      document.head.appendChild(sEl);
    }
    var styleMap = {
      idle: {
        border: 'rgba(0,0,0,0.06)',
        bg: 'linear-gradient(180deg,#ffffff 0%, rgba(120,120,128,0.04) 100%)',
        badgeBg: 'rgba(0,0,0,0.05)',
        badgeColor: 'rgba(0,0,0,0.48)',
        titleColor: '#1c1c1e',
        detailColor: 'rgba(0,0,0,0.5)',
        orderBg: 'rgba(0,0,0,0.05)',
        orderColor: 'rgba(0,0,0,0.42)',
        orderShadow: 'none',
        divider: 'rgba(0,0,0,0.06)',
        shadow: 'none',
        strip: 'linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.04))',
        statusBg: 'rgba(0,0,0,0.04)',
        statusColor: 'rgba(0,0,0,0.42)',
        dotColor: 'rgba(0,0,0,0.28)',
        statusLabel: '대기',
        transform: 'none',
      },
      working: {
        border: 'rgba(255,140,0,0.28)',
        bg: 'linear-gradient(180deg,rgba(255,255,255,1) 0%, rgba(255,140,0,0.1) 100%)',
        badgeBg: 'rgba(255,140,0,0.14)',
        badgeColor: '#ff8c00',
        titleColor: '#8a4b00',
        detailColor: 'rgba(138,75,0,0.78)',
        orderBg: 'linear-gradient(135deg,#ff8c00,#ff6b00)',
        orderColor: '#ffffff',
        orderShadow: '0 4px 14px rgba(255,140,0,0.32)',
        divider: 'rgba(255,140,0,0.16)',
        shadow: '0 14px 38px rgba(255,140,0,0.16), 0 2px 6px rgba(255,140,0,0.08)',
        strip: 'linear-gradient(180deg,#ff8c00,#ff6b00)',
        statusBg: 'rgba(255,140,0,0.14)',
        statusColor: '#ff8c00',
        dotColor: '#ff8c00',
        statusLabel: '진행 중',
        transform: 'translateY(-2px)',
      },
      ready: {
        border: 'rgba(52,199,89,0.24)',
        bg: 'linear-gradient(180deg,rgba(255,255,255,1) 0%, rgba(52,199,89,0.08) 100%)',
        badgeBg: 'rgba(52,199,89,0.14)',
        badgeColor: '#1f8f44',
        titleColor: '#1f8f44',
        detailColor: 'rgba(31,143,68,0.78)',
        orderBg: 'linear-gradient(135deg,#34c759,#1f8f44)',
        orderColor: '#ffffff',
        orderShadow: '0 4px 12px rgba(52,199,89,0.28)',
        divider: 'rgba(52,199,89,0.16)',
        shadow: '0 10px 26px rgba(52,199,89,0.12)',
        strip: 'linear-gradient(180deg,#34c759,#1f8f44)',
        statusBg: 'rgba(52,199,89,0.14)',
        statusColor: '#1f8f44',
        dotColor: '#34c759',
        statusLabel: '완료',
        transform: 'none',
      },
      muted: {
        border: 'rgba(91,141,239,0.22)',
        bg: 'linear-gradient(180deg,rgba(255,255,255,1) 0%, rgba(91,141,239,0.08) 100%)',
        badgeBg: 'rgba(91,141,239,0.14)',
        badgeColor: '#5b8def',
        titleColor: '#315a9d',
        detailColor: 'rgba(49,90,157,0.78)',
        orderBg: 'linear-gradient(135deg,#5b8def,#315a9d)',
        orderColor: '#ffffff',
        orderShadow: '0 4px 12px rgba(91,141,239,0.24)',
        divider: 'rgba(91,141,239,0.16)',
        shadow: '0 10px 26px rgba(91,141,239,0.12)',
        strip: 'linear-gradient(180deg,#5b8def,#315a9d)',
        statusBg: 'rgba(91,141,239,0.14)',
        statusColor: '#5b8def',
        dotColor: '#5b8def',
        statusLabel: '참고',
        transform: 'none',
      },
      error: {
        border: 'rgba(255,59,48,0.28)',
        bg: 'linear-gradient(180deg,rgba(255,255,255,1) 0%, rgba(255,59,48,0.08) 100%)',
        badgeBg: 'rgba(255,59,48,0.14)',
        badgeColor: '#ff3b30',
        titleColor: '#b42318',
        detailColor: 'rgba(180,35,24,0.8)',
        orderBg: 'linear-gradient(135deg,#ff3b30,#b42318)',
        orderColor: '#ffffff',
        orderShadow: '0 4px 12px rgba(255,59,48,0.28)',
        divider: 'rgba(255,59,48,0.18)',
        shadow: '0 10px 26px rgba(255,59,48,0.14)',
        strip: 'linear-gradient(180deg,#ff3b30,#b42318)',
        statusBg: 'rgba(255,59,48,0.14)',
        statusColor: '#ff3b30',
        dotColor: '#ff3b30',
        statusLabel: '실패',
        transform: 'none',
      },
    };
    var theme = styleMap[tone] || styleMap.idle;
    el.dataset.vagStageTone = tone || 'idle';
    el.style.borderColor = theme.border;
    el.style.background = theme.bg;
    el.style.boxShadow = theme.shadow;
    el.style.transform = theme.transform;
    var strip = el.querySelector('[data-vag-stage-strip]');
    if (strip) strip.style.background = theme.strip;
    var badge = el.querySelector('[data-vag-stage-badge]');
    if (badge) {
      badge.style.background = theme.badgeBg;
      badge.style.color = theme.badgeColor;
      badge.textContent = step === 'source' ? '자료 준비' : step === 'code' ? '장면 확인' : '영상 생성';
    }
    var orderEl = el.querySelector('[data-vag-stage-order]');
    if (orderEl) {
      orderEl.style.background = theme.orderBg;
      orderEl.style.color = theme.orderColor;
      orderEl.style.boxShadow = theme.orderShadow;
      // 완료 상태는 ✓ 로 표시, 그 외는 단계 숫자 유지
      var n = step === 'source' ? '1' : step === 'code' ? '2' : '3';
      var content = tone === 'ready' ? '✓' : n;
      // 숫자 자체에 breathe/pop 애니메이션을 걸기 위해 [data-vag-stage-number] 로 감싼다
      // 상태 변경 시 innerHTML 을 재설정하면 CSS 애니메이션이 자연스럽게 재시작됨
      orderEl.innerHTML = '<span data-vag-stage-number style="display:inline-block;line-height:1;">' + content + '</span>';
    }
    var titleEl = el.querySelector('[data-vag-stage-title]');
    if (titleEl) {
      titleEl.textContent = visibleTitle;
      titleEl.style.color = theme.titleColor;
    }
    var detailEl = el.querySelector('[data-vag-stage-detail]');
    if (detailEl) {
      detailEl.textContent = visibleDetail;
      detailEl.style.color = theme.detailColor;
    }
    var detailWrap = el.querySelector('[data-vag-stage-detail-wrap]');
    if (detailWrap) detailWrap.style.borderTopColor = theme.divider;
    var statusEl = el.querySelector('[data-vag-stage-status]');
    if (statusEl) {
      statusEl.style.background = theme.statusBg;
      statusEl.style.color = theme.statusColor;
    }
    var dotEl = el.querySelector('[data-vag-stage-dot]');
    if (dotEl) dotEl.style.background = theme.dotColor;
    var statusLabelEl = el.querySelector('[data-vag-stage-status-label]');
    if (statusLabelEl) statusLabelEl.textContent = theme.statusLabel;
    var banner = document.getElementById('vag-current-stage-banner');
    var bannerTitle = document.getElementById('vag-current-stage-title');
    var bannerDetail = document.getElementById('vag-current-stage-detail');
    var bannerStatus = document.getElementById('vag-current-stage-status');
    if (banner && bannerTitle && bannerDetail && bannerStatus && tone !== 'idle') {
      var stepLabel = step === 'source' ? '자료 준비' : step === 'code' ? '배경 이미지와 장면 확인' : '음성·음악·영상 생성';
      var statusText = tone === 'working' ? '생성중' : tone === 'ready' ? '완료' : tone === 'error' ? '실패' : theme.statusLabel;
      banner.style.borderColor = theme.border;
      banner.style.background = theme.bg;
      banner.style.boxShadow = theme.shadow || '0 10px 28px rgba(255,140,0,0.10)';
      bannerTitle.textContent = '현재 단계: ' + stepLabel + ' - ' + visibleTitle;
      bannerTitle.style.color = theme.titleColor;
      bannerDetail.textContent = visibleDetail;
      bannerDetail.style.color = theme.detailColor;
      bannerStatus.style.background = theme.statusBg;
      bannerStatus.style.color = theme.statusColor;
      bannerStatus.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:' + theme.dotColor + ';display:inline-block;"></span> ' + statusText;
    }
  }

  V._vagLoadStudioFrame = function _vagLoadStudioFrame(cacheBust) {
    var frame = document.getElementById('vag-studio-frame');
    if (!frame || !V._vagStudioProjectId) return;
    var next = V._vagStudioUrl(V._vagStudioProjectId, cacheBust);
    if (cacheBust || frame.getAttribute('src') !== next) frame.setAttribute('src', next);
  }

  V._vagUpdateWorkspace = function _vagUpdateWorkspace() {
    var sourcePreview = document.getElementById('vag-source-preview');
    var sourceMeta = document.getElementById('vag-source-meta');
    var codePreview = document.getElementById('vag-code-preview');
    var codeMeta = document.getElementById('vag-code-meta');
    var studioMeta = document.getElementById('vag-studio-meta');
    var studioBadge = document.getElementById('vag-studio-badge');
    var studioEmpty = document.getElementById('vag-studio-empty');
    var studioWrap = document.getElementById('vag-studio-frame-wrap');
    var studioSyncBtn = document.getElementById('vag-sync-studio');
    var studioOpenBtn = document.getElementById('vag-open-studio');
    var studioRefreshBtn = document.getElementById('vag-refresh-studio');

    if (sourcePreview) {
      sourcePreview.value = V._vagSourceContent
        ? String(V._vagSourceContent).trim()
        : (document.getElementById('vag-topic') || {}).value
          ? '아직 외부 자료는 없고, 선택한 주제와 프로필 정보만으로 진행합니다.\n주제: ' + ((document.getElementById('vag-topic') || {}).value || '')
          : '기사, URL, YouTube, 직접 입력 중 하나를 고르면 여기에 요약 자료가 쌓입니다.';
    }
    if (sourceMeta) {
      sourceMeta.textContent = V._vagSourceContent
        ? ((V._vagSourceMode || '수집 자료') + ' · ' + V._vagSourceContent.length + '자')
        : (V._vagSourceMode || '자료 미선택');
    }

    if (codePreview) {
      codePreview.value = V._vagHyperHtml
        ? V._vagHyperHtml
        : '영상 코드를 생성하면 이 영역에 현재 index.html이 표시됩니다. 렌더 전 장면·나레이션·오디오 검증을 함께 수행합니다.';
    }
    if (codeMeta) {
      codeMeta.textContent = V._vagHyperHtml
        ? ([V._vagLocalHtmlPath, V._vagLocalCssPath].filter(Boolean).join(' · ') || ((V._vagStudioProjectId || '미저장 프로젝트') + ' · index.html 기준'))
        : '코드 대기 중';
    }
    if (studioBadge) {
      studioBadge.textContent = V._vagStudioProjectId ? (V._vagStudioProjectName || V._vagStudioProjectId) : '코드 대기';
    }
    if (studioMeta) {
      studioMeta.textContent = V._vagStudioProjectId
        ? ((V._vagStudioProjectName || V._vagStudioProjectId) + ' 로컬 HTML을 이어서 편집할 수 있습니다.')
        : '코드가 생성되면 같은 화면에서 장면 문구와 나레이션을 바로 조정할 수 있습니다.';
    }
    if (studioEmpty) studioEmpty.style.display = V._vagStudioProjectId ? 'none' : 'flex';
    if (studioWrap) studioWrap.style.display = V._vagStudioProjectId ? 'block' : 'none';
    if (studioSyncBtn) studioSyncBtn.disabled = !V._vagHyperHtml;
    if (studioOpenBtn) studioOpenBtn.disabled = !V._vagStudioProjectId;
    if (studioRefreshBtn) studioRefreshBtn.disabled = !V._vagStudioProjectId;
    V._vagUpdateBgBadge();
    if (V._vagStudioProjectId) V._vagLoadStudioFrame(false);
  }
  V._vagSetWorkspaceTab = function _vagSetWorkspaceTab(tab) {
    var active = String(tab || 'board');
    document.querySelectorAll('[data-vag-wtab]').forEach(function (btn) {
      var on = btn.getAttribute('data-vag-wtab') === active;
      btn.style.background = on ? 'linear-gradient(135deg,#ff8c00,#ff6b00)' : '#fff';
      btn.style.color = on ? '#fff' : '#1c1c1e';
      btn.style.borderColor = on ? 'transparent' : 'rgba(0,0,0,0.08)';
      btn.style.boxShadow = on ? '0 10px 24px rgba(255,140,0,0.22)' : 'none';
    });
    document.querySelectorAll('[data-vag-panel]').forEach(function (panel) {
      panel.style.display = panel.getAttribute('data-vag-panel') === active ? 'block' : 'none';
    });
  }

  V._vagUpdateBgBadge = function _vagUpdateBgBadge() {
    var badge = document.getElementById('vag-bg-badge');
    if (!badge) return;
    var mode = (V._vagSession && V._vagSession.bgMode) || '';
    var url = (V._vagSession && V._vagSession.bgImageUrl) || '';
    if (mode === 'scene-image') {
      badge.style.display = 'inline-flex';
      badge.style.background = 'rgba(52,199,89,0.12)';
      badge.style.color = '#1f8f44';
      badge.innerHTML = '배경 · 씬별 이미지';
    } else if (mode === 'ai' && url) {
      badge.style.display = 'inline-flex';
      badge.style.background = 'rgba(52,199,89,0.12)';
      badge.style.color = '#1f8f44';
      badge.innerHTML = '배경 · 이미지 적용됨';
    } else if (mode === 'ai') {
      badge.style.display = 'inline-flex';
      badge.style.background = 'rgba(255,140,0,0.12)';
      badge.style.color = '#ff8c00';
      badge.innerHTML = '배경 · 이미지 생성 중';
    } else if (mode === 'html') {
      badge.style.display = 'inline-flex';
      badge.style.background = 'rgba(91,141,239,0.12)';
      badge.style.color = '#5b8def';
      badge.innerHTML = '배경 · HTML';
    } else {
      badge.style.display = 'none';
    }
  }

  V._vagResetWorkspace = function _vagResetWorkspace() {
    V._vagSourceContent = '';
    V._vagSourceMode = '';
    V._vagHyperHtml = '';
    V._vagStudioProjectId = '';
    V._vagStudioProjectName = '';
    V._vagRenderMeta = '';
    V._vagLocalHtmlPath = '';
    V._vagLocalCssPath = '';
    V._vagResetTextEditCard();
    V._renderFinalPrompt('');
    V._vagSetStage('source', 'idle', '자료 수집 대기', '기사, URL, YouTube, 직접 입력 중에서 시작합니다.');
    V._vagSetStage('code', 'idle', '모션 합성 대기', '자료가 정리되면 HyperFrames 모션 코드를 만들고 렌더 전 검증을 수행합니다.');
    V._vagSetStage('render', 'idle', '영상 렌더 대기', '코드가 준비되면 MP4 렌더 결과가 여기에 연결됩니다.');
    V._vagUpdateWorkspace();
  }

  V._vagSyncStudioProject = async function _vagSyncStudioProject(topic, aspect, duration) {
    if (!V._vagHyperHtml) return null;
    // 마지막 안전망: _vagHyperHtml 이 <style> 을 잃었다면 원본에서 강제 복원
    if (V._vagOriginalHtml && !/<style/i.test(V._vagHyperHtml) && /<style/i.test(V._vagOriginalHtml)) {
      console.warn('[VAG] _vagHyperHtml lost <style>, restoring from original');
      V._vagHyperHtml = V._vagPreserveHead(V._vagOriginalHtml, V._vagHyperHtml);
      // 여전히 없으면 원본 <head> 내용을 마이그레이션
      if (!/<style/i.test(V._vagHyperHtml)) {
        var origHeadMatch = V._vagOriginalHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        if (origHeadMatch) {
          var origHead = origHeadMatch[1];
          if (/<head[^>]*>/i.test(V._vagHyperHtml)) {
            V._vagHyperHtml = V._vagHyperHtml.replace(/<head([^>]*)>/i, '<head$1>' + origHead);
          } else {
            V._vagHyperHtml = V._vagHyperHtml.replace(/<html([^>]*)>/i, '<html$1><head>' + origHead + '</head>');
          }
        }
      }
      // 원본의 body 끝 <script>(GSAP 타임라인)도 복원
      var origScriptMatches = V._vagOriginalHtml.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
      origScriptMatches.forEach(function (sc) {
        if (V._vagHyperHtml.indexOf(sc) < 0) {
          if (/<\/body>/i.test(V._vagHyperHtml)) {
            V._vagHyperHtml = V._vagHyperHtml.replace(/<\/body>/i, sc + '</body>');
          } else {
            V._vagHyperHtml = V._vagHyperHtml + sc;
          }
        }
      });
    }
    var currentAspect = aspect || (document.getElementById('vag-aspect') || {}).value || '9:16';
    var dims = V._vagAspectDimensions(currentAspect);
    var currentTopic = topic || ((V._vagSession && V._vagSession.baseTopic) || (document.getElementById('vag-topic') || {}).value || '마케팅 영상');
    var projectId = V._vagEnsureStudioProjectId(currentTopic);
    var name = (currentTopic || '마케팅 영상').trim().slice(0, 80) || '마케팅 영상';
    var resp = await V._vagFetch('/api/hyperframes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: projectId,
        name: name,
        width: dims.width,
        height: dims.height,
        duration: Number(duration || (V._vagSession && V._vagSession.hyperDuration) || 8),
        html: V._vagHyperHtml,
      }),
    });
    var data = await resp.json();
    if (!resp.ok || !data.ok || !data.item) {
      throw new Error((data && (data.detail || data.error)) || '로컬 영상 코드 저장 실패');
    }
    V._vagStudioProjectId = data.item.id || projectId;
    V._vagStudioProjectName = data.item.name || name;
    V._vagLocalHtmlPath = 'generated/html/' + V._vagStudioProjectId + '.html';
    V._vagLocalCssPath = 'generated/css/' + V._vagStudioProjectId + '.css';
    var extractedCss = V._vagExtractCss(V._vagHyperHtml);
    try {
      await V._vagFetch('/api/hyperframes/studio-api/projects/' + encodeURIComponent(V._vagStudioProjectId) + '/files/' + encodeURIComponent(V._vagLocalHtmlPath), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: V._vagHyperHtml,
      });
      await V._vagFetch('/api/hyperframes/studio-api/projects/' + encodeURIComponent(V._vagStudioProjectId) + '/files/' + encodeURIComponent(V._vagLocalCssPath), {
        method: 'PUT',
        headers: { 'Content-Type': 'text/css; charset=utf-8' },
        body: extractedCss || '/* 추출된 스타일이 없어 비어 있습니다. */',
      });
    } catch (e) { /* ignore */ }
    if (V._vagSession) V._vagSession.projectId = V._vagStudioProjectId;
    V._vagUpdateWorkspace();
    return data.item;
  }

})();
