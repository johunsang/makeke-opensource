(function () {
  let _yaaInitialized = false;
  let _yaaSelectedConfigId = 0;
  let _yaaConfigCache = [];
  let _yaaBootstrap = null;

  function $(id) {
    return document.getElementById(id);
  }

  function yaaHasRoot() {
    return !!($('page-youtube-ads-auto') || $('youtube-panel') || $('yaa-name'));
  }

  function yaaEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value || '');
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function yaaBanner(id, message, type) {
    const el = $(id);
    if (!el) return;
    const palette = {
      success: { bg: 'rgba(52,199,89,0.10)', color: '#34c759' },
      error: { bg: 'rgba(255,59,48,0.10)', color: '#ff3b30' },
      info: { bg: 'rgba(0,122,255,0.08)', color: '#007aff' },
    }[type || 'info'] || { bg: 'rgba(0,122,255,0.08)', color: '#007aff' };
    el.innerHTML = `<div style="padding:12px 14px;border-radius:12px;background:${palette.bg};color:${palette.color};font-size:13px;line-height:1.6;">${message}</div>`;
  }

  function yaaStatus(message, type) {
    yaaBanner('yaa-status', message, type);
  }

  function yaaApiInfo(message, type) {
    yaaBanner('yaa-api-status', message, type);
  }

  function yaaSplitList(value) {
    return String(value || '')
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function yaaRenderValidation(validation) {
    const missing = (validation && validation.missing) || [];
    if (!missing.length) {
      yaaApiInfo('Google Ads API 연결 정보가 준비되었습니다. 이제 고객 계정과 캠페인 설정을 저장할 수 있습니다.', 'success');
      return;
    }
    yaaApiInfo(`YouTube Ads API 설정이 아직 부족합니다: ${missing.map(yaaEscape).join(', ')}`, 'error');
  }

  function yaaRenderCampaigns(campaigns) {
    const list = $('yaa-campaign-list');
    if (!list) return;
    const items = campaigns || [];
    if (!items.length) {
      list.innerHTML = '<div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">최근 YouTube 캠페인이 없습니다.</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div style="padding:14px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
        <div style="font-size:13px;font-weight:700;color:#1c1c1e;margin-bottom:5px;">${yaaEscape(item.name || item.id)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.5;">${yaaEscape(item.advertising_channel_type || '-')} / ${yaaEscape(item.advertising_channel_sub_type || '-')} / ${yaaEscape(item.status || '-')}</div>
      </div>
    `).join('');
  }

  function yaaPopulateBootstrap(data) {
    _yaaBootstrap = data || {};
    const settings = data.settings || {};
    if ($('yaa-api-version')) $('yaa-api-version').value = settings.api_version || 'v19';
    if ($('yaa-developer-token')) $('yaa-developer-token').value = settings.developer_token && settings.developer_token.endsWith('...') ? '' : (settings.developer_token || '');
    if ($('yaa-client-id')) $('yaa-client-id').value = settings.client_id || '';
    if ($('yaa-client-secret')) $('yaa-client-secret').value = settings.client_secret && settings.client_secret.endsWith('...') ? '' : (settings.client_secret || '');
    if ($('yaa-refresh-token')) $('yaa-refresh-token').value = settings.refresh_token && settings.refresh_token.endsWith('...') ? '' : (settings.refresh_token || '');
    if ($('yaa-login-customer-id')) $('yaa-login-customer-id').value = settings.login_customer_id || '';
    if ($('yaa-channel-id')) $('yaa-channel-id').value = settings.channel_id || '';

    const customerSelect = $('yaa-customer-id');
    if (customerSelect) {
      customerSelect.innerHTML = '<option value="">고객 계정을 선택하세요</option>';
      (data.customers || []).forEach(resourceName => {
        const value = String(resourceName || '').split('/').pop() || '';
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        customerSelect.appendChild(option);
      });
      if (settings.customer_id) customerSelect.value = settings.customer_id;
    }
    if ($('yaa-api-profile')) {
      const profile = data.profile || {};
      $('yaa-api-profile').textContent = profile.descriptive_name
        ? `${profile.descriptive_name} (${profile.id})`
        : 'Google Ads 프로필 미확인';
    }
    yaaRenderValidation(data.validation || {});
    yaaRenderCampaigns(data.campaigns || []);
  }

  function yaaGetPayload() {
    return {
      name: $('yaa-name')?.value?.trim() || '',
      description: '',
      campaign_name: $('yaa-campaign-name')?.value?.trim() || '',
      ad_group_name: $('yaa-ad-group-name')?.value?.trim() || '',
      ad_name: $('yaa-ad-name')?.value?.trim() || '',
      objective: $('yaa-objective')?.value || '조회수',
      daily_budget: parseInt($('yaa-daily-budget')?.value || '30000', 10) || 30000,
      target_cpm: parseInt($('yaa-target-cpm')?.value || '3000', 10) || 3000,
      video_id: $('yaa-video-id')?.value?.trim() || '',
      landing_url: $('yaa-landing-url')?.value?.trim() || '',
      channel_id: $('yaa-channel-id-config')?.value?.trim() || $('yaa-channel-id')?.value?.trim() || '',
      short_headline: $('yaa-short-headline')?.value?.trim() || '',
      long_headline: $('yaa-long-headline')?.value?.trim() || '',
      description_text: $('yaa-description')?.value?.trim() || '',
      description: $('yaa-description')?.value?.trim() || '',
      call_to_action: $('yaa-call-to-action')?.value || '자세히 보기',
      keywords: yaaSplitList($('yaa-keywords')?.value || ''),
      locations: yaaSplitList($('yaa-locations')?.value || ''),
      audiences: yaaSplitList($('yaa-audiences')?.value || ''),
      customer_id: $('yaa-customer-id')?.value || '',
      auto_publish: !!$('yaa-auto-publish')?.checked,
      notes: $('yaa-notes')?.value?.trim() || '',
    };
  }

  async function yaaLoadBootstrap() {
    try {
      const data = await api('/api/automation/youtube-ads/bootstrap');
      yaaPopulateBootstrap(data);
    } catch (error) {
      yaaApiInfo(`YouTube Ads API 정보 로드 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaSaveApiSettings() {
    try {
      const body = {
        api_version: $('yaa-api-version')?.value || 'v19',
        developer_token: $('yaa-developer-token')?.value?.trim() || '',
        client_id: $('yaa-client-id')?.value?.trim() || '',
        client_secret: $('yaa-client-secret')?.value?.trim() || '',
        refresh_token: $('yaa-refresh-token')?.value?.trim() || '',
        customer_id: $('yaa-customer-id')?.value || '',
        login_customer_id: $('yaa-login-customer-id')?.value?.trim() || '',
        channel_id: $('yaa-channel-id')?.value?.trim() || '',
      };
      const data = await api('/api/automation/youtube-ads/api-settings', { method: 'POST', body });
      yaaPopulateBootstrap({
        ..._yaaBootstrap,
        settings: data.settings || {},
        validation: data,
      });
      yaaApiInfo('YouTube Ads API 연결 설정을 저장했습니다.', 'success');
    } catch (error) {
      yaaApiInfo(`YouTube Ads API 설정 저장 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  function yaaApplyConfig(item) {
    const config = item.config_json || {};
    _yaaSelectedConfigId = item.id;
    $('yaa-name').value = config.name || '';
    $('yaa-campaign-name').value = config.campaign_name || '';
    $('yaa-ad-group-name').value = config.ad_group_name || '';
    $('yaa-ad-name').value = config.ad_name || '';
    $('yaa-objective').value = config.objective || '조회수';
    $('yaa-daily-budget').value = config.daily_budget || 30000;
    $('yaa-target-cpm').value = config.target_cpm || 3000;
    $('yaa-video-id').value = config.video_id || '';
    $('yaa-landing-url').value = config.landing_url || '';
    $('yaa-channel-id-config').value = config.channel_id || '';
    $('yaa-short-headline').value = config.short_headline || '';
    $('yaa-long-headline').value = config.long_headline || '';
    $('yaa-description').value = config.description || config.description_text || '';
    $('yaa-call-to-action').value = config.call_to_action || '자세히 보기';
    $('yaa-keywords').value = (config.keywords || []).join(', ');
    $('yaa-locations').value = (config.locations || []).join(', ');
    $('yaa-audiences').value = (config.audiences || []).join(', ');
    $('yaa-notes').value = config.notes || '';
    $('yaa-auto-publish').checked = !!config.auto_publish;
    if (config.customer_id && $('yaa-customer-id')) {
      const exists = Array.from($('yaa-customer-id').options || []).some(opt => opt.value === config.customer_id);
      if (!exists) {
        const option = document.createElement('option');
        option.value = config.customer_id;
        option.textContent = config.customer_id;
        $('yaa-customer-id').appendChild(option);
      }
      $('yaa-customer-id').value = config.customer_id;
    }
    yaaStatus(`"${yaaEscape(config.name || '')}" 설정을 불러왔습니다.`, 'info');
  }

  function yaaResetForm() {
    _yaaSelectedConfigId = 0;
    $('yaa-name').value = '';
    $('yaa-campaign-name').value = '';
    $('yaa-ad-group-name').value = '';
    $('yaa-ad-name').value = '';
    $('yaa-objective').value = '조회수';
    $('yaa-daily-budget').value = '30000';
    $('yaa-target-cpm').value = '3000';
    $('yaa-video-id').value = '';
    $('yaa-landing-url').value = '';
    $('yaa-channel-id-config').value = '';
    $('yaa-short-headline').value = '';
    $('yaa-long-headline').value = '';
    $('yaa-description').value = '';
    $('yaa-call-to-action').value = '자세히 보기';
    $('yaa-keywords').value = '';
    $('yaa-locations').value = '';
    $('yaa-audiences').value = '';
    $('yaa-notes').value = '';
    $('yaa-auto-publish').checked = false;
    yaaStatus('유튜브 광고 자동화 입력값을 초기화했습니다.', 'info');
  }

  async function yaaGenerateAI() {
    const payload = yaaGetPayload();
    if (!payload.name && !payload.video_id && !payload.notes) {
      yaaStatus('AI 생성을 위해 자동화 이름이나 영상 ID, 메모 중 하나는 입력해주세요.', 'error');
      return;
    }
    yaaStatus('AI가 유튜브 광고 문구와 타게팅 초안을 생성하는 중입니다.', 'info');
    try {
      const res = await api('/api/automation/ad-ai/generate', {
        method: 'POST',
        body: { platform: 'youtube', payload },
      });
      const s = res.suggestion || {};
      if (s.campaign_name) $('yaa-campaign-name').value = s.campaign_name;
      if (s.ad_group_name) $('yaa-ad-group-name').value = s.ad_group_name;
      if (s.ad_name) $('yaa-ad-name').value = s.ad_name;
      if (s.short_headline) $('yaa-short-headline').value = s.short_headline;
      if (s.long_headline) $('yaa-long-headline').value = s.long_headline;
      if (s.description) $('yaa-description').value = s.description;
      if (s.call_to_action) $('yaa-call-to-action').value = s.call_to_action;
      if (Array.isArray(s.keywords)) $('yaa-keywords').value = s.keywords.join(', ');
      if (Array.isArray(s.locations)) $('yaa-locations').value = s.locations.join(', ');
      if (Array.isArray(s.audiences)) $('yaa-audiences').value = s.audiences.join(', ');
      if (s.notes) $('yaa-notes').value = s.notes;
      yaaStatus('AI 초안을 반영했습니다. 필요한 부분만 다듬어 실행하시면 됩니다.', 'success');
    } catch (error) {
      yaaStatus(`AI 생성 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaSaveConfig() {
    const payload = yaaGetPayload();
    if (!payload.name || !payload.video_id || !payload.landing_url || !payload.long_headline || !payload.description) {
      yaaStatus('자동화 이름, 영상 ID, 랜딩 URL, 롱 헤드라인, 광고 설명을 입력하세요.', 'error');
      return null;
    }
    try {
      const res = await api(
        _yaaSelectedConfigId ? `/api/automation/youtube-ads-configs/${_yaaSelectedConfigId}` : '/api/automation/youtube-ads-configs',
        { method: _yaaSelectedConfigId ? 'PUT' : 'POST', body: payload }
      );
      _yaaSelectedConfigId = res.config.id;
      yaaStatus('유튜브 광고 자동화를 저장했습니다.', 'success');
      await yaaLoadConfigs();
      return res.config;
    } catch (error) {
      yaaStatus(`저장 실패: ${yaaEscape(error.message)}`, 'error');
      return null;
    }
  }

  async function yaaRunConfig() {
    const payload = yaaGetPayload();
    if (!payload.name || !payload.video_id || !payload.landing_url || !payload.long_headline || !payload.description) {
      yaaStatus('실행 전에 자동화 이름, 영상 ID, 랜딩 URL, 롱 헤드라인, 광고 설명을 입력하세요.', 'error');
      return;
    }
    yaaStatus('Google Ads API로 YouTube 광고 생성 요청을 보내는 중입니다.', 'info');
    try {
      const res = await api('/api/automation/youtube-ads/run', {
        method: 'POST',
        body: {
          ...payload,
          config_id: _yaaSelectedConfigId || 0,
        },
      });
      const result = res.result || {};
      yaaStatus(`생성 완료: 캠페인 ${yaaEscape(result.campaign_resource_name || '-')} / 광고그룹 ${yaaEscape(result.ad_group_resource_name || '-')}`, 'success');
      if (typeof toast === 'function') toast('유튜브 광고 API 생성 완료');
      await Promise.all([yaaLoadRuns(), yaaLoadConfigs(), yaaLoadBootstrap()]);
    } catch (error) {
      yaaStatus(`실행 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  function yaaScheduleBody() {
    const triggerType = $('yaa-trigger-type')?.value || 'daily';
    let triggerConfig = {};
    if (triggerType === 'daily') {
      triggerConfig = {
        hour: parseInt($('yaa-trigger-hour')?.value || '10', 10) || 10,
        minute: parseInt($('yaa-trigger-minute')?.value || '0', 10) || 0,
      };
    } else if (triggerType === 'interval') {
      triggerConfig = { minutes: parseInt($('yaa-trigger-interval')?.value || '60', 10) || 60 };
    } else {
      triggerConfig = { run_at: $('yaa-trigger-once')?.value || '' };
    }
    return { trigger_type: triggerType, trigger_config: triggerConfig };
  }

  async function yaaCreateSchedule() {
    let selectedId = _yaaSelectedConfigId;
    if (!selectedId) {
      const saved = await yaaSaveConfig();
      if (!saved) return;
      selectedId = saved.id;
    }
    try {
      await api('/api/automation/youtube-ads-schedules', {
        method: 'POST',
        body: {
          config_id: selectedId,
          name: ($('yaa-schedule-name')?.value || '').trim() || `${$('yaa-name')?.value?.trim() || '유튜브 광고'} 예약`,
          enabled: true,
          ...yaaScheduleBody(),
        },
      });
      yaaStatus('유튜브 광고 예약 작업을 등록했습니다.', 'success');
      await yaaLoadSchedules();
    } catch (error) {
      yaaStatus(`예약 등록 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaDeleteConfig(configId) {
    if (!confirm('저장된 유튜브 광고 자동화를 삭제하시겠습니까?')) return;
    try {
      await api(`/api/automation/youtube-ads-configs/${configId}`, { method: 'DELETE' });
      if (_yaaSelectedConfigId === configId) yaaResetForm();
      yaaStatus('유튜브 광고 자동화를 삭제했습니다.', 'success');
      await Promise.all([yaaLoadConfigs(), yaaLoadSchedules(), yaaLoadRuns()]);
    } catch (error) {
      yaaStatus(`삭제 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaToggleSchedule(scheduleId, enabled) {
    try {
      await api(`/api/automation/youtube-ads-schedules/${scheduleId}`, { method: 'PUT', body: { enabled } });
      await yaaLoadSchedules();
    } catch (error) {
      yaaStatus(`예약 상태 변경 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaDeleteSchedule(scheduleId) {
    if (!confirm('이 유튜브 광고 예약 작업을 삭제하시겠습니까?')) return;
    try {
      await api(`/api/automation/youtube-ads-schedules/${scheduleId}`, { method: 'DELETE' });
      yaaStatus('유튜브 광고 예약 작업을 삭제했습니다.', 'success');
      await yaaLoadSchedules();
    } catch (error) {
      yaaStatus(`예약 삭제 실패: ${yaaEscape(error.message)}`, 'error');
    }
  }

  async function yaaLoadConfigs() {
    const list = $('yaa-config-list');
    if (!list) return;
    const res = await api('/api/automation/youtube-ads-configs');
    _yaaConfigCache = res.configs || [];
    if (!_yaaConfigCache.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">저장된 YouTube 광고 자동화가 없습니다.</div>';
      return;
    }
    list.innerHTML = _yaaConfigCache.map(item => {
      const config = item.config_json || {};
      return `
        <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
          <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${yaaEscape(item.name)}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">${yaaEscape(config.objective || '-')} | 영상 ${yaaEscape(config.video_id || '-')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">${Number(config.daily_budget || 0).toLocaleString('ko-KR')}원/일</span>
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">실행 ${item.run_count || 0}회</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button onclick="yaaFillConfigById(${item.id})" style="padding:7px 12px;font-size:12px;background:rgba(255,140,0,0.08);color:#ff6b00;border:none;border-radius:10px;cursor:pointer;">불러오기</button>
            <button onclick="yaaRunSavedConfig(${item.id})" style="padding:7px 12px;font-size:12px;background:#34c759;color:#fff;border:none;border-radius:10px;cursor:pointer;">실행</button>
            <button onclick="yaaDeleteConfig(${item.id})" style="padding:7px 12px;font-size:12px;background:#ff3b30;color:#fff;border:none;border-radius:10px;cursor:pointer;">삭제</button>
          </div>
        </div>`;
    }).join('');
  }

  async function yaaLoadSchedules() {
    const list = $('yaa-schedule-list');
    if (!list) return;
    const res = await api('/api/automation/youtube-ads-schedules');
    const schedules = res.schedules || [];
    if (!schedules.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">예약된 YouTube 광고 자동화가 없습니다.</div>';
      return;
    }
    list.innerHTML = schedules.map(schedule => `
      <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
        <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${yaaEscape(schedule.name)}</div>
        <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">${yaaEscape(schedule.youtube_name || '')} | ${yaaEscape(schedule.trigger_type)} | 다음 실행 ${yaaEscape(schedule.next_run_at || '없음')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
          <button onclick="yaaToggleSchedule(${schedule.id}, ${schedule.enabled ? 'false' : 'true'})" style="padding:7px 12px;font-size:12px;background:rgba(255,140,0,0.08);color:#ff6b00;border:none;border-radius:10px;cursor:pointer;">${schedule.enabled ? '중지' : '재개'}</button>
          <button onclick="yaaDeleteSchedule(${schedule.id})" style="padding:7px 12px;font-size:12px;background:#ff3b30;color:#fff;border:none;border-radius:10px;cursor:pointer;">삭제</button>
        </div>
      </div>
    `).join('');
  }

  async function yaaLoadRuns() {
    const list = $('yaa-run-list');
    if (!list) return;
    const res = await api('/api/automation/youtube-ads-runs?limit=12');
    const runs = res.runs || [];
    if (!runs.length) {
      list.innerHTML = '<div style="padding:18px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:rgba(0,0,0,0.02);font-size:13px;color:rgba(0,0,0,0.35);">최근 실행 이력이 없습니다.</div>';
      return;
    }
    list.innerHTML = runs.map(run => {
      const result = run.result_json || {};
      return `
        <div style="padding:16px;border:1px solid rgba(0,0,0,0.06);border-radius:14px;background:#fff;">
          <div style="font-size:14px;font-weight:700;color:#1c1c1e;margin-bottom:6px;">${yaaEscape(run.youtube_name || run.config_name || '유튜브 광고 자동화')}</div>
          <div style="font-size:12px;color:rgba(0,0,0,0.42);line-height:1.55;">상태 ${yaaEscape(run.status)} | 시작 ${yaaEscape(run.started_at || '')} | 완료 ${yaaEscape(run.finished_at || '진행 중')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">${yaaEscape(run.trigger_source || 'manual')}</span>
            ${result.campaign_resource_name ? `<span style="padding:5px 10px;border-radius:999px;background:rgba(255,140,0,0.08);color:#ff6b00;font-size:11px;font-weight:700;">캠페인 생성</span>` : ''}
          </div>
          ${run.error_message ? `<div style="margin-top:10px;font-size:12px;color:#ff3b30;line-height:1.5;">${yaaEscape(run.error_message)}</div>` : ''}
        </div>`;
    }).join('');
  }

  async function yaaLoadAll() {
    await Promise.all([yaaLoadBootstrap(), yaaLoadConfigs(), yaaLoadSchedules(), yaaLoadRuns()]);
  }

  function yaaSyncTriggerFields() {
    const triggerType = $('yaa-trigger-type')?.value || 'daily';
    document.querySelectorAll('.yaa-trigger-daily').forEach(el => { el.style.display = triggerType === 'daily' ? '' : 'none'; });
    document.querySelectorAll('.yaa-trigger-interval').forEach(el => { el.style.display = triggerType === 'interval' ? '' : 'none'; });
    document.querySelectorAll('.yaa-trigger-once').forEach(el => { el.style.display = triggerType === 'once' ? '' : 'none'; });
  }

  function yaaBind() {
    $('yaa-save-api-btn')?.addEventListener('click', yaaSaveApiSettings);
    $('yaa-load-api-btn')?.addEventListener('click', yaaLoadBootstrap);
    $('yaa-ai-fill-btn')?.addEventListener('click', yaaGenerateAI);
    $('yaa-save-btn')?.addEventListener('click', yaaSaveConfig);
    $('yaa-run-btn')?.addEventListener('click', yaaRunConfig);
    $('yaa-schedule-btn')?.addEventListener('click', yaaCreateSchedule);
    $('yaa-reset-btn')?.addEventListener('click', yaaResetForm);
    $('yaa-trigger-type')?.addEventListener('change', yaaSyncTriggerFields);
  }

  window.yaaFillConfigById = function (configId) {
    const item = _yaaConfigCache.find(config => config.id === configId);
    if (item) yaaApplyConfig(item);
  };
  window.yaaDeleteConfig = yaaDeleteConfig;
  window.yaaToggleSchedule = yaaToggleSchedule;
  window.yaaDeleteSchedule = yaaDeleteSchedule;
  window.yaaRunSavedConfig = async function (configId) {
    const item = _yaaConfigCache.find(config => config.id === configId);
    if (!item) return;
    yaaApplyConfig(item);
    await yaaRunConfig();
  };
  window.yaaInit = async function () {
    if (!yaaHasRoot()) return;
    if (!_yaaInitialized) {
      _yaaInitialized = true;
      yaaBind();
    }
    yaaSyncTriggerFields();
    try {
      await yaaLoadAll();
    } catch (error) {
      yaaStatus(`유튜브 광고 API 초기화 실패: ${yaaEscape(error.message)}`, 'error');
    }
  };
})();
