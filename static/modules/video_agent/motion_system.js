(function () {
  'use strict';

  window.__VAG = window.__VAG || window.VAG || {};
  window.VAG = window.__VAG;
  var V = window.__VAG;

  var PRESETS = {
    cardnews: {
      key: 'cardnews',
      label: 'Cardnews Sequence',
      sceneMin: 2.2,
      sceneMax: 4.2,
      fade: 0.22,
      holdScale: 1.018,
      bgBlur: 34,
      bgOpacity: 0.24,
      easeIn: 'power3.out',
      easeOut: 'power2.in',
    },
    product: {
      key: 'product',
      label: 'Product Launch',
      sceneMin: 2.6,
      sceneMax: 5.0,
      fade: 0.28,
      holdScale: 1.026,
      bgBlur: 30,
      bgOpacity: 0.28,
      easeIn: 'expo.out',
      easeOut: 'power2.in',
    },
    tutorial: {
      key: 'tutorial',
      label: 'Tutorial Flow',
      sceneMin: 3.0,
      sceneMax: 5.4,
      fade: 0.18,
      holdScale: 1.012,
      bgBlur: 26,
      bgOpacity: 0.20,
      easeIn: 'power2.out',
      easeOut: 'power1.in',
    },
    cinematic: {
      key: 'cinematic',
      label: 'Cinematic Campaign',
      sceneMin: 3.0,
      sceneMax: 6.0,
      fade: 0.34,
      holdScale: 1.038,
      bgBlur: 38,
      bgOpacity: 0.32,
      easeIn: 'power4.out',
      easeOut: 'power3.in',
    },
  };

  function clamp(value, min, max) {
    value = Number(value) || 0;
    return Math.max(min, Math.min(max, value));
  }

  function pickPreset(input) {
    var raw = [
      input && input.kind,
      input && input.topic,
      input && input.designFamily,
      input && input.source,
    ].filter(Boolean).join(' ').toLowerCase();
    if (/tutorial|how-to|가이드|튜토리얼|설명|사용법/.test(raw)) return PRESETS.tutorial;
    if (/launch|product|랜딩|제품|출시|프로덕트|cta|광고/.test(raw)) return PRESETS.product;
    if (/cinematic|campaign|브랜드|캠페인|프리미엄/.test(raw)) return PRESETS.cinematic;
    return PRESETS.cardnews;
  }

  V._vagCreateMotionPlan = function _vagCreateMotionPlan(input) {
    input = input || {};
    var preset = pickPreset(input);
    var sceneCount = Math.max(1, Number(input.sceneCount || 1) || 1);
    var duration = Math.max(2, Number(input.duration || sceneCount * preset.sceneMin) || sceneCount * preset.sceneMin);
    var sceneDuration = clamp(duration / sceneCount, preset.sceneMin, preset.sceneMax);
    if (sceneDuration * sceneCount > duration + 0.05) sceneDuration = duration / sceneCount;
    return {
      preset: preset,
      duration: duration,
      sceneCount: sceneCount,
      sceneDuration: sceneDuration,
      caption: {
        maxChars: 42,
        bottomRatio: 0.032,
        widthRatio: 0.72,
      },
    };
  };

  V._vagBuildSceneTween = function _vagBuildSceneTween(id, index, plan, total) {
    var start = index * plan.sceneDuration;
    var end = Math.min(plan.duration, start + plan.sceneDuration);
    var p = plan.preset;
    var fade = Math.min(p.fade, Math.max(0.14, plan.sceneDuration * 0.16));
    var hold = Math.max(0.4, plan.sceneDuration - fade - 0.08);
    var variant = index % 6;
    var driftX = (index % 2 === 0 ? -1 : 1) * (18 + (index % 3) * 10);
    var driftY = (index % 3 === 0 ? -14 : 10);
    var entrance = [
      'tl.fromTo("' + id + '",{scale:1.014,opacity:0},{scale:1,opacity:1,duration:' + fade.toFixed(2) + ',ease:"' + p.easeIn + '"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + id + '",{x:' + (-driftX * 2) + ',opacity:0},{x:0,opacity:1,duration:' + fade.toFixed(2) + ',ease:"power4.out"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + id + '",{y:' + (driftY * 3) + ',scale:.985,opacity:0},{y:0,scale:1,opacity:1,duration:' + fade.toFixed(2) + ',ease:"back.out(1.2)"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + id + '",{clipPath:"inset(0 100% 0 0)",opacity:1},{clipPath:"inset(0 0% 0 0)",duration:' + fade.toFixed(2) + ',ease:"power3.inOut"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + id + '",{rotation:-1.6,scale:1.035,opacity:0},{rotation:0,scale:1,opacity:1,duration:' + fade.toFixed(2) + ',ease:"expo.out"},' + start.toFixed(2) + ');',
      'tl.fromTo("' + id + '",{x:' + (driftX * 3) + ',y:' + (-driftY * 2) + ',scale:1.025,opacity:0},{x:0,y:0,scale:1,opacity:1,duration:' + fade.toFixed(2) + ',ease:"circ.out"},' + start.toFixed(2) + ');',
    ][variant];
    var holdMotion = [
      'tl.to("' + id + '",{scale:' + p.holdScale.toFixed(3) + ',x:' + driftX + ',y:' + driftY + ',duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
      'tl.to("' + id + '",{scale:' + (p.holdScale + 0.006).toFixed(3) + ',x:' + driftX + ',duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
      'tl.to("' + id + '",{scale:' + (p.holdScale - 0.004).toFixed(3) + ',y:' + (driftY * 2) + ',duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
      'tl.to("' + id + '",{scale:' + (p.holdScale + 0.003).toFixed(3) + ',x:' + (-driftX) + ',duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
      'tl.to("' + id + '",{scale:' + (p.holdScale + 0.012).toFixed(3) + ',rotation:.35,duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
      'tl.to("' + id + '",{scale:' + p.holdScale.toFixed(3) + ',x:' + (driftX * -1) + ',y:' + (driftY * 1.4).toFixed(1) + ',duration:' + hold.toFixed(2) + ',ease:"none"},' + (start + fade).toFixed(2) + ');',
    ][variant];
    var lines = [
      'tl.set("' + id + '",{opacity:0,clipPath:"inset(0 0% 0 0)",x:0,y:0,scale:1,rotation:0},0);',
      entrance,
      holdMotion,
    ];
    if (index < total - 1) {
      var exitAt = Math.max(start + fade, end - fade);
      var exit = [
        'tl.to("' + id + '",{opacity:0,scale:.992,duration:' + fade.toFixed(2) + ',ease:"' + p.easeOut + '"},' + exitAt.toFixed(2) + ');',
        'tl.to("' + id + '",{opacity:0,x:' + (driftX * 2) + ',duration:' + fade.toFixed(2) + ',ease:"' + p.easeOut + '"},' + exitAt.toFixed(2) + ');',
        'tl.to("' + id + '",{opacity:0,y:' + (-driftY * 3) + ',scale:1.012,duration:' + fade.toFixed(2) + ',ease:"' + p.easeOut + '"},' + exitAt.toFixed(2) + ');',
        'tl.to("' + id + '",{clipPath:"inset(0 0 0 100%)",duration:' + fade.toFixed(2) + ',ease:"power3.inOut"},' + exitAt.toFixed(2) + ');',
        'tl.to("' + id + '",{opacity:0,rotation:1.2,scale:.99,duration:' + fade.toFixed(2) + ',ease:"' + p.easeOut + '"},' + exitAt.toFixed(2) + ');',
        'tl.to("' + id + '",{opacity:0,x:' + (-driftX * 2) + ',y:' + (driftY * 2) + ',duration:' + fade.toFixed(2) + ',ease:"' + p.easeOut + '"},' + exitAt.toFixed(2) + ');',
      ][variant];
      lines.push(exit);
      lines.push('tl.set("' + id + '",{opacity:0},' + (end + 0.01).toFixed(2) + ');');
    }
    return lines.join('');
  };

  V._vagValidateMotionHtml = function _vagValidateMotionHtml(html) {
    var source = String(html || '');
    var issues = [];
    if (!/data-composition-id=["']makeke-html-motion["']/.test(source) && !/data-composition-id=/.test(source)) {
      issues.push('루트 data-composition-id 없음');
    }
    if (!/window\.__timelines/.test(source)) issues.push('HyperFrames timeline 등록 없음');
    if ((source.match(/<script\b/gi) || []).length !== (source.match(/<\/script>/gi) || []).length) {
      issues.push('script 태그 개수 불일치');
    }
    if (/<\\\/script>/i.test(source)) issues.push('이스케이프된 script 닫힘 태그 잔존');
    if (/src=["'][^"']*\/api\/hyperframes\/audio\//i.test(source)) {
      issues.push('렌더 전 API 오디오 URL 포함 - 서버 materialize 필요');
    }
    var sceneCount = (source.match(/class=["'][^"']*\bscene\b/gi) || []).length || (source.match(/data-scene-index=/gi) || []).length;
    if (sceneCount >= 5) {
      var effectChecks = [
        { key: 'mask', ok: /clipPath|clip-path|mask/i.test(source) },
        { key: 'stagger', ok: /stagger\s*:/i.test(source) },
        { key: 'counter', ok: /onUpdate|textContent|innerText|count(?:er)?|Counter/i.test(source) },
        { key: 'line', ok: /scaleX|draw|strokeDash|progress|width\s*:\s*["']100%/i.test(source) },
        { key: 'parallax', ok: /\b(x|y|xPercent|yPercent|scale|rotation|rotationX|rotationY)\s*:/i.test(source) },
        { key: 'focus', ok: /sharp|focus/i.test(source) },
        { key: 'sweep', ok: /backgroundColor|color sweep|sweep|linear-gradient|radial-gradient/i.test(source) },
        { key: 'pulse', ok: /repeat\s*:|yoyo\s*:|elastic|bounce|back\.out|pulse/i.test(source) },
      ];
      var usedEffects = effectChecks.filter(function (row) { return row.ok; }).map(function (row) { return row.key; });
      if (usedEffects.length < 5) {
        issues.push('모션 효과 다양성 부족: ' + usedEffects.join(', ') + '만 감지됨. clipPath/mask, stagger, counter, line/progress, parallax, focus, color sweep, CTA pulse 중 5종 이상 필요');
      }
      var easeMatches = source.match(/ease\s*:\s*["'][^"']+/gi) || [];
      var uniqueEases = {};
      easeMatches.forEach(function (raw) {
        uniqueEases[String(raw || '').replace(/^ease\s*:\s*["']/, '')] = true;
      });
      if (Object.keys(uniqueEases).length < 3) {
        issues.push('GSAP ease 다양성 부족: 장면별 움직임이 비슷해 보일 수 있음. power/expo/back/sine/circ 등 3종 이상 섞어야 함');
      }
      if (!/clipPath|clip-path/i.test(source) && !/scaleX|strokeDash|width\s*:\s*["']100%/i.test(source)) {
        issues.push('눈에 띄는 wipe/line draw 계열 모션 없음');
      }
    }
    return { ok: issues.length === 0, issues: issues };
  };
})();
