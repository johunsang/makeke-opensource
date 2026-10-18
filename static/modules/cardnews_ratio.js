// cardnews_ratio.js — shared cardnews aspect-ratio normalization for all cardnews screens
(function () {
  const RATIO_MAP = {
    '1:1': '1 / 1',
    '9:16': '9 / 16',
    '16:9': '16 / 9',
    '4:5': '4 / 5',
    '3:4': '3 / 4',
    '4:3': '4 / 3',
  };

  function normalize(value, fallback = '1:1') {
    const raw = String(value || '').trim();
    if (RATIO_MAP[raw]) return raw;
    const compact = raw.replace(/\s+/g, '').replace('/', ':');
    if (RATIO_MAP[compact]) return compact;
    return RATIO_MAP[fallback] ? fallback : '1:1';
  }

  function css(value, fallback = '1:1') {
    return RATIO_MAP[normalize(value, fallback)] || RATIO_MAP['1:1'];
  }

  function getOption(key, fallback) {
    if (typeof getOpt === 'function') return getOpt(key, fallback);
    return window._contentOpts?.[key] || fallback;
  }

  function radioValue(name, fallback) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
  }

  function currentSingle() {
    return normalize(
      document.getElementById('single-cn-ratio')?.value ||
      window._contentOpts?.cn_ratio ||
      getOption('cn_ratio', '1:1')
    );
  }

  function currentKeyword() {
    return normalize(radioValue('kc-cn-ratio', getOption('cn_ratio', '1:1')));
  }

  function currentBrowser() {
    return normalize(radioValue('cn-ratio', getOption('cn_ratio', '1:1')));
  }

  function currentBiz() {
    return normalize(radioValue('biz-cn-ratio', getOption('cn_ratio', '1:1')));
  }

  window.MKK_CARDNEWS_RATIOS = {
    values: Object.keys(RATIO_MAP),
    normalize,
    css,
    currentSingle,
    currentKeyword,
    currentBrowser,
    currentBiz,
  };
  window.mkkNormalizeCardnewsRatio = normalize;
  window.mkkCardnewsAspectCss = css;
})();
