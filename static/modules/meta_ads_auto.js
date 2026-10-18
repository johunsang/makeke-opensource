(function () {
  let _maaInitialized = false;
  let _maaSelectedConfigId = 0;
  let _maaConfigCache = [];
  let _maaBootstrap = null;

  function $(id) {
    return document.getElementById(id);
  }

  function maaHasRoot() {
    return !!($('page-meta-ads-auto') || $('meta-panel') || $('maa-name'));
  }

  function maaEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value || '');
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function maaStatus(message, type) {
    const el = $('maa-status');
    if (!el) return;
    const palette = {
      success: { bg: 'rgba(52,199,89,0.10)', color: '#34c759' },
      error: { bg: 'rgba(255,59,48,0.10)', color: '#ff3b30' },
      info: { bg: 'rgba(0,122,255,0.08)', color: '#007aff' },
    }[type || 'info'] || { bg: 'rgba(0,122,255,0.08)', color: '#007aff' };
    el.innerHTML = `<div style="padding:12px 14px;border-radius:12px;background:${palette.bg};color:${palette.color};font-size:13px;line-height:1.6;">${message}</div>`;
  }

  function maaApiInfo(message, type) {
    const el = $('maa-api-status');
    if (!el) return;
    const palette = {
      success: { bg: 'rgba(52,199,89,0.10)', color: '#34c759' },
      error: { bg: 'rgba(255,59,48,0.10)', color: '#ff3b30' },
      info: { bg: 'rgba(0,122,255,0.08)', color: '#007aff' },
    }[type || 'info'] || { bg: 'rgba(0,122,255,0.08)', color: '#007aff' };
    el.innerHTML = `<div style="padding:10px 12px;border-radius:12px;background:${palette.bg};color:${palette.color};font-size:12px;line-height:1.6;">${message}</div>`;
  }

  function maaSplitList(value) {
    return String(value || '')
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function maaEnsureOption(select, value, label) {
    if (!select || !value) return;
    const exists = Array.from(select.options || []).some(opt => opt.value === value);
    if (!exists) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label || value;
      select.appendChild(option);
    }
  }

  function maaSelectedText(id) {
    const select = $(id);
    if (!select) return '';
    const option = select.options[select.selectedIndex];
    return option ? option.textContent : '';
  }

  function maaSyncSelectionLabels() {
    const pageText = maaSelectedText('maa-page-id');
    const igText = maaSelectedText('maa-instagram-user-id');
    const pageName = pageText.split('(')[0].trim();
    const igName = igText.split('(')[0].trim();
    if ($('maa-page-name') && pageName) $('maa-page-name').value = pageName;
    if ($('maa-instagram-account') && igName) $('maa-instagram-account').value = igName;
  }

  function maaRenderValidation(validation) {
    const missing = (validation && validation.missing) || [];
    if (!missing.length) {
      maaApiInfo('Meta Marketing API 연결 정보가 준비되었습니다. 이제 광고계정과 페이지를 선택해 실행할 수 있습니다.', 'success');
      return;
    }
    maaApiInfo(`Meta API 설정이 아직 부족합니다: ${missing.map(maaEscape).join(', ')}`, 'error');
  }

  function maaRenderCampaigns(campaigns) {
    const list = $('maa-campaign-list');
    if (!list) return;
    const items = campaigns || [];
    if (!items.length) {
      list.innerHTML = '<div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">최근 Meta 캠페인이 없습니다.</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
        <div style="font-size:13px;font-weight:700;color:#1c1c1e;margin-bottom:5px;">${maaEscape(item.name || item.id)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.5;">${maaEscape(item.objective || '-')} | ${maaEscape(item.status || '-')} | ${maaEscape(item.updated_time || item.created_time || '')}</div>
      </div>
    `).join('');
  }

  function maaPopulateBootstrap(data) {
    _maaBootstrap = data || {};
    const settings = data.settings || {};
    if ($('maa-api-version')) $('maa-api-version').value = settings.api_version || 'v22.0';
    if ($('maa-access-token')) $('maa-access-token').value = settings.access_token && settings.access_token.endsWith('...') ? '' : (settings.access_token || '');
    if ($('maa-page-name') && settings.page_name) $('maa-page-name').value = settings.page_name;
    if ($('maa-instagram-account') && settings.instagram_username) $('maa-instagram-account').value = settings.instagram_username;

    const adSelect = $('maa-ad-account-id');
    const pageSelect = $('maa-page-id');
    const igSelect = $('maa-instagram-user-id');
    if (adSelect) {
      adSelect.innerHTML = '<option value="">광고계정을 선택하세요</option>';
      (data.ad_accounts || []).forEach(account => {
        const option = document.createElement('option');
        option.value = account.id || account.account_id || '';
        option.textContent = `${account.name || account.id} (${account.currency || '-'})`;
        adSelect.appendChild(option);
      });
      if (settings.ad_account_id) adSelect.value = settings.ad_account_id;
    }
    if (pageSelect) {
      pageSelect.innerHTML = '<option value="">페이지를 선택하세요</option>';
      (data.pages || []).forEach(page => {
        const option = document.createElement('option');
        option.value = page.id || '';
        option.textContent = page.name || page.id || '';
        option.dataset.instagramUserId = page.instagram_business_account?.id || '';
        option.dataset.instagramUsername = page.instagram_business_account?.username || '';
        pageSelect.appendChild(option);
      });
      if (settings.page_id) pageSelect.value = settings.page_id;
    }
    if (igSelect) {
      igSelect.innerHTML = '<option value="">Instagram 계정 없음</option>';
      (data.pages || []).forEach(page => {
        const ig = page.instagram_business_account;
        if (!ig || !ig.id) return;
        const option = document.createElement('option');
        option.value = ig.id;
        option.textContent = `${ig.username || ig.id} (${page.name || '연결 페이지'})`;
        igSelect.appendChild(option);
      });
      if (settings.instagram_user_id) igSelect.value = settings.instagram_user_id;
    }
    if ($('maa-api-profile')) {
      const profile = data.profile || {};
      $('maa-api-profile').textContent = profile.name ? `${profile.name} (${profile.id})` : 'Meta 프로필 미확인';
    }
    maaRenderValidation(data.validation || {});
    maaRenderCampaigns(data.campaigns || []);
    maaSyncSelectionLabels();
  }

  async function maaLoadBootstrap() {
    try {
      const data = await api('/api/automation/meta-ads/bootstrap');
      maaPopulateBootstrap(data);
    } catch (error) {
      maaApiInfo(`Meta API 정보 로드 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  async function maaSaveApiSettings() {
    try {
      const adAccountId = $('maa-ad-account-id')?.value || '';
      const pageId = $('maa-page-id')?.value || '';
      const igId = $('maa-instagram-user-id')?.value || '';
      const pageOption = $('maa-page-id')?.selectedOptions?.[0];
      const igOption = $('maa-instagram-user-id')?.selectedOptions?.[0];
      const body = {
        api_version: $('maa-api-version')?.value || 'v22.0',
        access_token: $('maa-access-token')?.value?.trim() || '',
        ad_account_id: adAccountId,
        page_id: pageId,
        page_name: pageOption ? pageOption.textContent.trim() : '',
        instagram_user_id: igId,
        instagram_username: igOption ? igOption.textContent.split('(')[0].trim() : '',
      };
      const data = await api('/api/automation/meta-ads/api-settings', { method: 'POST', body });
      maaPopulateBootstrap({
        ..._maaBootstrap,
        settings: data.settings || {},
        validation: data,
      });
      maaApiInfo('Meta API 연결 설정을 저장했습니다.', 'success');
    } catch (error) {
      maaApiInfo(`Meta API 설정 저장 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  function maaGetPayload() {
    maaSyncSelectionLabels();
    return {
      name: $('maa-name')?.value?.trim() || '',
      description: '',
      campaign_name: $('maa-campaign-name')?.value?.trim() || '',
      adset_name: $('maa-adset-name')?.value?.trim() || '',
      ad_name: $('maa-ad-name')?.value?.trim() || '',
      objective: $('maa-objective')?.value || '트래픽',
      daily_budget: parseInt($('maa-daily-budget')?.value || '30000', 10) || 30000,
      age_min: parseInt($('maa-age-min')?.value || '25', 10) || 25,
      age_max: parseInt($('maa-age-max')?.value || '55', 10) || 55,
      genders: maaSplitList($('maa-genders')?.value || '전체'),
      locations: maaSplitList($('maa-locations')?.value || ''),
      interests: maaSplitList($('maa-interests')?.value || ''),
      placements: maaSplitList($('maa-placements')?.value || ''),
      page_name: $('maa-page-name')?.value?.trim() || '',
      instagram_account: $('maa-instagram-account')?.value?.trim() || '',
      ad_account_id: $('maa-ad-account-id')?.value || '',
      page_id: $('maa-page-id')?.value || '',
      instagram_user_id: $('maa-instagram-user-id')?.value || '',
      primary_text: $('maa-primary-text')?.value?.trim() || '',
      headline: $('maa-headline')?.value?.trim() || '',
      creative_description: $('maa-creative-description')?.value?.trim() || '',
      landing_url: $('maa-landing-url')?.value?.trim() || '',
      image_url: $('maa-image-url')?.value?.trim() || '',
      cta: $('maa-cta')?.value || '더 알아보기',
      auto_publish: !!$('maa-auto-publish')?.checked,
      notes: $('maa-notes')?.value?.trim() || '',
    };
  }

  async function maaGenerateAI() {
    const payload = maaGetPayload();
    if (!payload.name && !payload.landing_url && !payload.notes) {
      maaStatus('AI 생성을 위해 자동화 이름이나 랜딩 URL, 메모 중 하나는 입력해주세요.', 'error');
      return;
    }
    maaStatus('AI가 메타 광고 문구와 타게팅 초안을 생성하는 중입니다.', 'info');
    try {
      const res = await api('/api/automation/ad-ai/generate', {
        method: 'POST',
        body: { platform: 'meta', payload },
      });
      const s = res.suggestion || {};
      if (s.campaign_name) $('maa-campaign-name').value = s.campaign_name;
      if (s.adset_name) $('maa-adset-name').value = s.adset_name;
      if (s.ad_name) $('maa-ad-name').value = s.ad_name;
      if (s.primary_text) $('maa-primary-text').value = s.primary_text;
      if (s.headline) $('maa-headline').value = s.headline;
      if (s.creative_description) $('maa-creative-description').value = s.creative_description;
      if (s.cta) $('maa-cta').value = s.cta;
      if (Array.isArray(s.interests)) $('maa-interests').value = s.interests.join(', ');
      if (Array.isArray(s.locations)) $('maa-locations').value = s.locations.join(', ');
      if (s.notes) $('maa-notes').value = s.notes;
      maaStatus('AI 초안을 반영했습니다. 필요한 부분만 다듬어 실행하시면 됩니다.', 'success');
    } catch (error) {
      maaStatus(`AI 생성 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  function maaApplyConfig(item) {
    const config = item.config_json || {};
    _maaSelectedConfigId = item.id;
    $('maa-name').value = config.name || '';
    $('maa-campaign-name').value = config.campaign_name || '';
    $('maa-adset-name').value = config.adset_name || '';
    $('maa-ad-name').value = config.ad_name || '';
    $('maa-objective').value = config.objective || '트래픽';
    $('maa-daily-budget').value = config.daily_budget || 30000;
    $('maa-age-min').value = config.age_min || 25;
    $('maa-age-max').value = config.age_max || 55;
    $('maa-genders').value = (config.genders || []).join(', ');
    $('maa-locations').value = (config.locations || []).join(', ');
    $('maa-interests').value = (config.interests || []).join(', ');
    $('maa-placements').value = (config.placements || []).join(', ');
    $('maa-page-name').value = config.page_name || '';
    $('maa-instagram-account').value = config.instagram_account || '';
    $('maa-primary-text').value = config.primary_text || '';
    $('maa-headline').value = config.headline || '';
    $('maa-creative-description').value = config.creative_description || '';
    $('maa-landing-url').value = config.landing_url || '';
    $('maa-image-url').value = config.image_url || '';
    $('maa-cta').value = config.cta || '더 알아보기';
    $('maa-auto-publish').checked = !!config.auto_publish;
    $('maa-notes').value = config.notes || '';
    maaEnsureOption($('maa-ad-account-id'), config.ad_account_id || '', config.ad_account_id || '');
    maaEnsureOption($('maa-page-id'), config.page_id || '', config.page_name || config.page_id || '');
    maaEnsureOption($('maa-instagram-user-id'), config.instagram_user_id || '', config.instagram_account || config.instagram_user_id || '');
    if (config.ad_account_id) $('maa-ad-account-id').value = config.ad_account_id;
    if (config.page_id) $('maa-page-id').value = config.page_id;
    if (config.instagram_user_id) $('maa-instagram-user-id').value = config.instagram_user_id;
    maaStatus(`"${maaEscape(config.name || '')}" 설정을 불러왔습니다.`, 'info');
  }

  function maaResetForm() {
    _maaSelectedConfigId = 0;
    $('maa-name').value = '';
    $('maa-campaign-name').value = '';
    $('maa-adset-name').value = '';
    $('maa-ad-name').value = '';
    $('maa-objective').value = '트래픽';
    $('maa-daily-budget').value = '30000';
    $('maa-age-min').value = '25';
    $('maa-age-max').value = '55';
    $('maa-genders').value = '전체';
    $('maa-locations').value = '';
    $('maa-interests').value = '';
    $('maa-placements').value = 'Facebook 피드, Instagram 피드, Instagram 스토리';
    $('maa-page-name').value = '';
    $('maa-instagram-account').value = '';
    $('maa-primary-text').value = '';
    $('maa-headline').value = '';
    $('maa-creative-description').value = '';
    $('maa-landing-url').value = '';
    $('maa-image-url').value = '';
    $('maa-cta').value = '더 알아보기';
    $('maa-auto-publish').checked = false;
    $('maa-notes').value = '';
    maaStatus('메타 광고 설정 입력값을 초기화했습니다.', 'info');
  }

  async function maaSaveConfig() {
    const payload = maaGetPayload();
    if (!payload.name || !payload.landing_url || !payload.primary_text || !payload.headline) {
      maaStatus('자동화 이름, 랜딩 URL, 기본 문구, 헤드라인을 입력하세요.', 'error');
      return null;
    }
    try {
      const res = await api(
        _maaSelectedConfigId ? `/api/automation/meta-ads-configs/${_maaSelectedConfigId}` : '/api/automation/meta-ads-configs',
        { method: _maaSelectedConfigId ? 'PUT' : 'POST', body: payload }
      );
      _maaSelectedConfigId = res.config.id;
      maaStatus('메타 광고 API 자동화를 저장했습니다.', 'success');
      await maaLoadConfigs();
      return res.config;
    } catch (error) {
      maaStatus(`저장 실패: ${maaEscape(error.message)}`, 'error');
      return null;
    }
  }

  async function maaRunConfig() {
    const payload = maaGetPayload();
    if (!payload.name || !payload.landing_url || !payload.primary_text || !payload.headline) {
      maaStatus('실행 전에 자동화 이름, 랜딩 URL, 기본 문구, 헤드라인을 입력하세요.', 'error');
      return;
    }
    maaStatus('Meta Marketing API로 캠페인 생성 요청을 보내는 중입니다.', 'info');
    try {
      const res = await api('/api/automation/meta-ads/run', {
        method: 'POST',
        body: {
          ...payload,
          config_id: _maaSelectedConfigId || 0,
        },
      });
      const result = res.result || {};
      maaStatus(`생성 완료: 캠페인 ${maaEscape(result.campaign_id || '-')} / 광고 ${maaEscape(result.ad_id || '-')}`, 'success');
      if (typeof toast === 'function') toast('메타 광고 API 생성 완료');
      await Promise.all([maaLoadRuns(), maaLoadConfigs(), maaLoadBootstrap()]);
    } catch (error) {
      maaStatus(`실행 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  function maaScheduleBody() {
    const triggerType = $('maa-trigger-type')?.value || 'daily';
    let triggerConfig = {};
    if (triggerType === 'daily') {
      triggerConfig = {
        hour: parseInt($('maa-trigger-hour')?.value || '10', 10) || 10,
        minute: parseInt($('maa-trigger-minute')?.value || '0', 10) || 0,
      };
    } else if (triggerType === 'interval') {
      triggerConfig = { minutes: parseInt($('maa-trigger-interval')?.value || '60', 10) || 60 };
    } else {
      triggerConfig = { run_at: $('maa-trigger-once')?.value || '' };
    }
    return { trigger_type: triggerType, trigger_config: triggerConfig };
  }

  async function maaCreateSchedule() {
    let selectedId = _maaSelectedConfigId;
    if (!selectedId) {
      const saved = await maaSaveConfig();
      if (!saved) return;
      selectedId = saved.id;
    }
    try {
      await api('/api/automation/meta-ads-schedules', {
        method: 'POST',
        body: {
          config_id: selectedId,
          name: ($('maa-schedule-name')?.value || '').trim() || `${$('maa-name')?.value?.trim() || '메타 광고'} 예약`,
          enabled: true,
          ...maaScheduleBody(),
        },
      });
      maaStatus('메타 광고 API 예약 작업을 등록했습니다.', 'success');
      await maaLoadSchedules();
    } catch (error) {
      maaStatus(`예약 등록 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  async function maaDeleteConfig(configId) {
    if (!confirm('저장된 메타 광고 API 자동화를 삭제하시겠습니까?')) return;
    try {
      await api(`/api/automation/meta-ads-configs/${configId}`, { method: 'DELETE' });
      if (_maaSelectedConfigId === configId) maaResetForm();
      maaStatus('메타 광고 자동화를 삭제했습니다.', 'success');
      await Promise.all([maaLoadConfigs(), maaLoadSchedules(), maaLoadRuns()]);
    } catch (error) {
      maaStatus(`삭제 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  async function maaToggleSchedule(scheduleId, enabled) {
    try {
      await api(`/api/automation/meta-ads-schedules/${scheduleId}`, { method: 'PUT', body: { enabled } });
      await maaLoadSchedules();
    } catch (error) {
      maaStatus(`예약 상태 변경 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  async function maaDeleteSchedule(scheduleId) {
    if (!confirm('이 메타 광고 API 예약 작업을 삭제하시겠습니까?')) return;
    try {
      await api(`/api/automation/meta-ads-schedules/${scheduleId}`, { method: 'DELETE' });
      maaStatus('메타 광고 예약 작업을 삭제했습니다.', 'success');
      await maaLoadSchedules();
    } catch (error) {
      maaStatus(`예약 삭제 실패: ${maaEscape(error.message)}`, 'error');
    }
  }

  async function maaLoadConfigs() {
    const list = $('maa-config-list');
    if (!list) return;
    const res = await api('/api/automation/meta-ads-configs');
    _maaConfigCache = res.configs || [];
    if (!_maaConfigCache.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">저장된 Meta API 자동화가 없습니다.</div>';
      return;
    }
    list.innerHTML = _maaConfigCache.map(item => {
      const config = item.config_json || {};
      return `
        <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
          <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${maaEscape(item.name)}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">${maaEscape(config.objective || '-')} | ${maaEscape(config.landing_url || '')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">${Number(config.daily_budget || 0).toLocaleString('ko-KR')}원/일</span>
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">실행 ${item.run_count || 0}회</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button onclick="maaFillConfigById(${item.id})" style="padding:7px 12px;font-size:12px;background:rgba(255,140,0,0.08);color:#ff6b00;border:none;border-radius:10px;cursor:pointer;">불러오기</button>
            <button onclick="maaRunSavedConfig(${item.id})" style="padding:7px 12px;font-size:12px;background:#34c759;color:#fff;border:none;border-radius:10px;cursor:pointer;">실행</button>
            <button onclick="maaDeleteConfig(${item.id})" style="padding:7px 12px;font-size:12px;background:#ff3b30;color:#fff;border:none;border-radius:10px;cursor:pointer;">삭제</button>
          </div>
        </div>`;
    }).join('');
  }

  async function maaLoadSchedules() {
    const list = $('maa-schedule-list');
    if (!list) return;
    const res = await api('/api/automation/meta-ads-schedules');
    const schedules = res.schedules || [];
    if (!schedules.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">예약된 Meta API 자동화가 없습니다.</div>';
      return;
    }
    list.innerHTML = schedules.map(schedule => `
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
        <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${maaEscape(schedule.name)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">${maaEscape(schedule.meta_name || '')} | ${maaEscape(schedule.trigger_type)} | 다음 실행 ${maaEscape(schedule.next_run_at || '없음')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button onclick="maaToggleSchedule(${schedule.id}, ${schedule.enabled ? 'false' : 'true'})" style="padding:7px 12px;font-size:12px;background:rgba(255,140,0,0.08);color:#ff6b00;border:none;border-radius:10px;cursor:pointer;">${schedule.enabled ? '중지' : '재개'}</button>
          <button onclick="maaDeleteSchedule(${schedule.id})" style="padding:7px 12px;font-size:12px;background:#ff3b30;color:#fff;border:none;border-radius:10px;cursor:pointer;">삭제</button>
        </div>
      </div>
    `).join('');
  }

  async function maaLoadRuns() {
    const list = $('maa-run-list');
    if (!list) return;
    const res = await api('/api/automation/meta-ads-runs?limit=12');
    const runs = res.runs || [];
    if (!runs.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">최근 실행 이력이 없습니다.</div>';
      return;
    }
    list.innerHTML = runs.map(run => {
      const result = run.result_json || {};
      return `
        <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
          <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${maaEscape(run.meta_name || run.config_name || '메타 광고 자동화')}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">상태 ${maaEscape(run.status)} | 시작 ${maaEscape(run.started_at || '')} | 완료 ${maaEscape(run.finished_at || '진행 중')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">${maaEscape(run.trigger_source || 'manual')}</span>
            ${result.campaign_id ? `<span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">캠페인 ${maaEscape(result.campaign_id)}</span>` : ''}
            ${result.ad_id ? `<span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">광고 ${maaEscape(result.ad_id)}</span>` : ''}
          </div>
          ${run.error_message ? `<div style="margin-top:10px;font-size:12px;color:#ff3b30;line-height:1.5;">${maaEscape(run.error_message)}</div>` : ''}
        </div>`;
    }).join('');
  }

  async function maaLoadAll() {
    await Promise.all([maaLoadBootstrap(), maaLoadConfigs(), maaLoadSchedules(), maaLoadRuns()]);
  }

  function maaSyncTriggerFields() {
    const triggerType = $('maa-trigger-type')?.value || 'daily';
    document.querySelectorAll('.maa-trigger-daily').forEach(el => { el.style.display = triggerType === 'daily' ? '' : 'none'; });
    document.querySelectorAll('.maa-trigger-interval').forEach(el => { el.style.display = triggerType === 'interval' ? '' : 'none'; });
    document.querySelectorAll('.maa-trigger-once').forEach(el => { el.style.display = triggerType === 'once' ? '' : 'none'; });
  }

  function maaBind() {
    $('maa-save-api-btn')?.addEventListener('click', maaSaveApiSettings);
    $('maa-load-api-btn')?.addEventListener('click', maaLoadBootstrap);
    $('maa-ai-fill-btn')?.addEventListener('click', maaGenerateAI);
    $('maa-page-id')?.addEventListener('change', () => {
      const selected = $('maa-page-id').selectedOptions[0];
      if (selected && selected.dataset.instagramUserId && $('maa-instagram-user-id')) {
        $('maa-instagram-user-id').value = selected.dataset.instagramUserId;
      }
      maaSyncSelectionLabels();
    });
    $('maa-instagram-user-id')?.addEventListener('change', maaSyncSelectionLabels);
    $('maa-save-btn')?.addEventListener('click', maaSaveConfig);
    $('maa-run-btn')?.addEventListener('click', maaRunConfig);
    $('maa-schedule-btn')?.addEventListener('click', maaCreateSchedule);
    $('maa-reset-btn')?.addEventListener('click', maaResetForm);
    $('maa-trigger-type')?.addEventListener('change', maaSyncTriggerFields);
  }

  window.maaFillConfigById = function (configId) {
    const item = _maaConfigCache.find(config => config.id === configId);
    if (item) maaApplyConfig(item);
  };
  window.maaDeleteConfig = maaDeleteConfig;
  window.maaToggleSchedule = maaToggleSchedule;
  window.maaDeleteSchedule = maaDeleteSchedule;
  window.maaRunSavedConfig = async function (configId) {
    const item = _maaConfigCache.find(config => config.id === configId);
    if (!item) return;
    maaApplyConfig(item);
    await maaRunConfig();
  };

  window.maaInit = async function () {
    if (!maaHasRoot()) return;
    if (!_maaInitialized) {
      _maaInitialized = true;
      maaBind();
    }
    maaSyncTriggerFields();
    try {
      await maaLoadAll();
    } catch (error) {
      maaStatus(`메타 광고 API 초기화 실패: ${maaEscape(error.message)}`, 'error');
    }
  };
})();
