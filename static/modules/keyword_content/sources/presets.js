// keyword_content/sources/presets.js — 업종 프리셋, 옵션 프리셋, 이전 설정 저장/복원

// 키워드 콘텐츠 페이지에 업종 프리셋 렌더링
function kcRenderPresets() {
  const presets = getPresets();
  const container = document.getElementById('kc-presets-panel');
  if (!container) return;

  const categories = {
    '음식/외식': ['cafe','restaurant','bakery','bar','delivery','korean','japanese','chinese','western','chicken','dessert','brunch','vegan','streetfood'],
    '뷰티/패션': ['beauty','skincare','nail','hair','fashion','luxury','makeup','perfume','mens','shoes','accessory','secondhand'],
    '건강/의료': ['fitness','yoga','hospital','dental','pharmacy','mental','diet','derma','ophth','ortho','korean_med','plastic','supplement'],
    '교육': ['education','english','coding','kids','math','exam','certificate','piano','art','dance','swimming','taekwondo'],
    '부동산/금융': ['realestate','interior','finance','insurance','stock','crypto','loan','apartment','officetel','jeonse'],
    'IT/테크': ['tech','ai','ecommerce','marketing','smartphone','laptop','gadget','app','saas','seo','youtube','instagram'],
    '생활/서비스': ['travel','pet','car','wedding','moving','photo','jeju','camping','golf','fishing','garden','cooking','cleaning','laundry','parenting','pregnancy'],
    '전문직': ['lawyer','tax','startup','hr','freelance','patent','consulting','franchise','export','sidejob'],
    '문화/엔터': ['music','drama','book','game','webtoon','concert','idol','animation','podcast'],
    '지역': ['gangnam','hongdae','itaewon','busan','daegu','incheon','gwangju','daejeon','suwon','pangyo'],
  };

  let html = '';
  for (const [catName, keys] of Object.entries(categories)) {
    const btns = keys.filter(k => presets[k]).map(k =>
      `<button class="qs-btn" style="font-size:11px;" onclick="kcApplyPreset('${k}')">${presets[k].name}</button>`
    ).join('');
    if (!btns) continue;
    html += `<div style="margin-bottom:6px;">
      <span style="font-size:10px;color:rgba(0,0,0,0.3);margin-right:6px;">${catName}</span>
      ${btns}
    </div>`;
  }
  container.innerHTML = html;
}

// 프리셋 적용 (키워드 + 스타일 + 캡션 자동 설정)
function kcApplyPreset(key) {
  const presets = getPresets();
  const p = presets[key];
  if (!p) return;
  // 업종 이름만 키워드에 넣기 (고정 주제 X)
  document.getElementById('kc-keyword').value = p.name;
  if (document.getElementById('kc-quick-style')) {
    document.getElementById('kc-quick-style').value = p.style || 'modern';
    document.querySelectorAll('.qs-btn').forEach(b => b.classList.toggle('qs-active', b.dataset.style === (p.style || 'modern')));
  }
  toast(`${p.name} 선택됨 — 검색 또는 카드뉴스 생성을 누르세요`);
}

// 이전 설정 저장/불러오기
function kcSavePrevSettings() {
  window._kcPrevSettings = {
    keyword: document.getElementById('kc-keyword')?.value || '',
    style: document.getElementById('kc-quick-style')?.value || 'modern',
    slides: document.getElementById('kc-quick-slides')?.value || '5',
    productUrl: document.getElementById('kc-product-url')?.value || '',
    savedAt: new Date().toLocaleString('ko-KR'),
  };
  const prevBtn = document.getElementById('kc-load-prev-btn');
  if (prevBtn) prevBtn.style.display = 'inline-flex';
}

function kcLoadPrevSettings() {
  try {
    const data = window._kcPrevSettings;
    if (!data) { toast('저장된 이전 설정이 없습니다', 'error'); return; }
    if (data.keyword) document.getElementById('kc-keyword').value = data.keyword;
    if (data.style) {
      document.getElementById('kc-quick-style').value = data.style;
      document.querySelectorAll('.qs-btn').forEach(b => { b.classList.toggle('qs-active', b.dataset.style === data.style); });
    }
    if (data.slides) document.getElementById('kc-quick-slides').value = data.slides;
    if (data.productUrl && document.getElementById('kc-product-url')) document.getElementById('kc-product-url').value = data.productUrl;
    toast(`이전 설정 복원 (${data.savedAt})`);
  } catch { toast('이전 설정 불러오기 실패', 'error'); }
}

// ═══ 콘텐츠 생성 프리셋 ═══
async function kcLoadPresetList() {
  try {
    const res = await api('/api/content-presets');
    const sel = document.getElementById('kc-preset-select');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">프리셋 선택...</option>';
    (res.presets || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.is_default ? '⭐ ' : '') + p.name;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
    // 기본 프리셋 자동 적용
    const def = (res.presets || []).find(p => p.is_default);
    if (def && !prev) { sel.value = def.id; kcLoadPreset(def.id); }
  } catch {}
}

function kcGetCurrentOptions() {
  const tones = [];
  document.querySelectorAll('input[name="kc-tone"]:checked').forEach(c => tones.push(c.value));
  const cnStyles = [];
  document.querySelectorAll('input[name="kc-cn-style"]:checked').forEach(c => cnStyles.push(c.value));
  return {
    gen_blog: document.getElementById('kc-gen-blog')?.checked || false,
    gen_blog_images: document.getElementById('kc-blog-with-images')?.checked || false,
    blog_image_count: parseInt(window._contentOpts?.blog_image_count || 0),
    gen_cardnews: (document.querySelector('input[name="kc-image-type"]:checked')?.value || '') === 'cardnews',
    gen_sns: document.getElementById('kc-gen-sns')?.checked || false,
    tones,
    blog_length: document.querySelector('input[name="kc-blog-length"]:checked')?.value || 'medium',
    cn_styles: cnStyles,
    cn_slides: document.getElementById('kc-cn-slides')?.value || '5',
    cn_ratio: document.querySelector('input[name="kc-cn-ratio"]:checked')?.value || '1:1',
  };
}

function kcSyncGenerationFlagsFromProfile() {
  if (!window._globalProfileData || !window._contentOpts) return;
  let pa = {};
  try {
    pa = window._globalProfileData.platform_accounts
      ? (typeof window._globalProfileData.platform_accounts === 'string'
          ? JSON.parse(window._globalProfileData.platform_accounts)
          : window._globalProfileData.platform_accounts)
      : {};
  } catch {
    pa = {};
  }
  const o = window._contentOpts;
  const keys = ['gen_blog', 'gen_sns', 'gen_cardnews', 'gen_comic', 'gen_video_slide', 'gen_video_veo', 'gen_detail_page'];
  keys.forEach(key => {
    if (typeof pa[key] === 'boolean') o[key] = pa[key];
  });
  // 카드뉴스와 만화는 독립 선택 (동시 가능)
  if (pa.gen_cardnews === undefined && pa.image_type) {
    o.gen_cardnews = pa.image_type === 'cardnews' || pa.image_type === 'both';
    o.gen_comic = pa.image_type === 'comic' || pa.image_type === 'both';
  }
  if (pa.gen_video_slide === undefined && pa.video_type) {
    o.gen_video_slide = pa.video_type === 'slide';
    o.gen_video_veo = pa.video_type === 'veo';
  }
  o.image_type = (o.gen_cardnews && o.gen_comic) ? 'both' : o.gen_cardnews ? 'cardnews' : o.gen_comic ? 'comic' : 'none';
  o.video_type = o.gen_video_veo ? 'veo' : o.gen_video_slide ? 'slide' : 'none';
  try {
    if (typeof syncOptsToUI === 'function') syncOptsToUI('kc');
  } catch {}
}

function kcApplyOptions(data) {
  if (!data) return;
  // 콘텐츠 선택
  const setBool = (id, val) => { const el = document.getElementById(id); if (el) { el.checked = val; el.closest('label.qs-btn')?.classList.toggle('qs-active', val); } };
  setBool('kc-gen-blog', data.gen_blog !== false);
  setBool('kc-blog-with-images', data.gen_blog_images || false);
  // kc-gen-cardnews는 라디오로 변경됨
  setBool('kc-gen-sns', data.gen_sns !== false);
  const cnOpt = document.getElementById('kc-cn-options');
  if (cnOpt) cnOpt.style.display = data.gen_cardnews !== false ? 'block' : 'none';

  // 톤
  document.querySelectorAll('input[name="kc-tone"]').forEach(c => {
    const checked = (data.tones || ['professional']).includes(c.value);
    c.checked = checked;
    c.closest('label.qs-btn')?.classList.toggle('qs-active', checked);
  });

  // 글 길이
  document.querySelectorAll('input[name="kc-blog-length"]').forEach(r => {
    r.checked = r.value === (data.blog_length || 'medium');
    r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
  });

  // 카드뉴스 스타일
  document.querySelectorAll('input[name="kc-cn-style"]').forEach(c => {
    const checked = (data.cn_styles || ['modern']).includes(c.value);
    c.checked = checked;
    c.closest('label.qs-btn')?.classList.toggle('qs-active', checked);
  });

  // 슬라이드 수, 비율
  const slides = document.getElementById('kc-cn-slides');
  if (slides) slides.value = data.cn_slides || '5';
  document.querySelectorAll('input[name="kc-cn-ratio"]').forEach(r => {
    r.checked = r.value === (data.cn_ratio || '1:1');
    r.closest('label.qs-btn')?.classList.toggle('qs-active', r.checked);
  });
}

async function kcLoadPreset(presetId) {
  const delBtn = document.getElementById('kc-preset-delete-btn');
  if (!presetId) { if (delBtn) delBtn.style.display = 'none'; return; }
  if (delBtn) delBtn.style.display = '';
  try {
    const res = await api('/api/content-presets');
    const preset = (res.presets || []).find(p => String(p.id) === String(presetId));
    if (preset) {
      const data = typeof preset.preset_data === 'string' ? JSON.parse(preset.preset_data) : preset.preset_data;
      kcApplyOptions(data);
      toast(`"${preset.name}" 프리셋 적용됨`);
    }
  } catch {}
}

async function kcSavePresetDialog() {
  const name = window.prompt ? prompt('프리셋 이름을 입력하세요:') : '프리셋 ' + new Date().toLocaleDateString('ko-KR');
  if (!name) return;
  const isDefault = window.confirm ? confirm('기본 프리셋으로 설정할까요?') : true;
  try {
    await api('/api/content-presets', {
      method: 'POST',
      body: { name, preset_data: kcGetCurrentOptions(), is_default: isDefault },
    });
    toast(`"${name}" 프리셋 저장됨!`);
    kcLoadPresetList();
  } catch (e) { toast('저장 실패: ' + e.message, 'error'); }
}

async function kcDeletePreset() {
  const sel = document.getElementById('kc-preset-select');
  const id = sel?.value;
  if (!id) return;
  const name = sel.selectedOptions[0]?.textContent || '';
  if (!confirm(`"${name}" 프리셋을 삭제할까요?`)) return;
  try {
    await api(`/api/content-presets/${id}`, { method: 'DELETE' });
    toast('프리셋 삭제됨');
    sel.value = '';
    document.getElementById('kc-preset-delete-btn').style.display = 'none';
    kcLoadPresetList();
  } catch {}
}
