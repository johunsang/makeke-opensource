const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const artifactsDir = path.join(process.cwd(), 'artifacts', 'wdio');
const logsDir = path.join(artifactsDir, 'logs');
const hasCustomDataDir = Boolean(process.env.MAKEKE_E2E_DATA_DIR);
const dataDir = process.env.MAKEKE_E2E_DATA_DIR || path.join(os.tmpdir(), 'makeke-wdio-e2e');
const appPort = Number.parseInt(String(process.env.MAKEKE_PORT || '18818'), 10) || 18818;
const appBaseUrl = `http://127.0.0.1:${appPort}`;

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });
if (!hasCustomDataDir && dataDir.startsWith(os.tmpdir())) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}
fs.mkdirSync(dataDir, { recursive: true });

async function waitForAppServer() {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${appBaseUrl}/api/health`);
      if (response.ok) return;
      lastError = new Error(`health status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw lastError || new Error('Makeke server did not become ready');
}

async function requestJson(pathname, init = {}) {
  const response = await fetch(`${appBaseUrl}${pathname}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    body: init.body && typeof init.body !== 'string' ? JSON.stringify(init.body) : init.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function seedE2EAppData() {
  await requestJson('/api/config/update', {
    method: 'POST',
    body: { section: 'API', key: 'gemini_api_key', value: 'wdio-gemini-key' },
  });

  const profiles = await requestJson('/api/library/profiles');
  let profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile) {
    profile = await requestJson('/api/library/profiles', {
      method: 'POST',
      body: {
        name: 'WDIO 테스트 프로필',
        business_type: '테스트',
        description: 'Electron 격리 테스트용 기본 프로필',
        brand_color: '#ff8c00',
        logo_path: 'makeke.png',
        content_options: JSON.stringify({ logo_insert: true }),
      },
    });
  }

  if (profile?.id) {
    await requestJson('/api/settings', {
      method: 'POST',
      body: { key: 'default_profile_id', value: String(profile.id) },
    });
  }
  return profile;
}

exports.config = {
  runner: 'local',
  specs: [path.join(__dirname, 'specs/**/*.e2e.js')],
  maxInstances: 1,
  outputDir: logsDir,
  logLevel: process.env.WDIO_LOG_LEVEL || 'warn',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
  services: ['electron'],
  capabilities: [{
    browserName: 'electron',
    'wdio:electronServiceOptions': {
      appEntryPoint: './electron/main.js',
      appArgs: ['--dev'],
    },
  }],
  beforeSession: function () {
    process.env.TEST = 'true';
    process.env.MAKEKE_DATA_DIR = dataDir;
    process.env.MAKEKE_PORT = String(appPort);
    process.env.MAKEKE_AUTO_LAUNCH_CHROME = '0';
    process.env.MAKEKE_ENABLE_SERVER_WATCHDOG = '0';
    process.env.MAKEKE_SHOW_SERVER_LOG = '0';
    process.env.MAKEKE_START_PATH = '/';
  },
  before: async function () {
    await waitForAppServer();
    const profile = await seedE2EAppData();
    if (profile?.id) {
      await browser.execute((profileId) => {
        localStorage.setItem('makeke_last_profile_id', String(profileId));
      }, profile.id);
    }
    await browser.url(`${appBaseUrl}/`);
    await browser.waitUntil(async () => {
      return browser.execute(() => document.readyState === 'complete');
    }, {
      timeout: 30000,
      timeoutMsg: '마케케 테스트 화면을 다시 불러오지 못했습니다.',
    });
  },
  onPrepare: function () {
    console.log(`[wdio] screenshot dir: ${artifactsDir}`);
    console.log(`[wdio] log dir: ${logsDir}`);
    console.log(`[wdio] data dir: ${dataDir}`);
  },
  afterTest: async function (test, context, result) {
    if (!result || result.passed) return;
    const safeTitle = String(test.title || 'failed')
      .replace(/[^\w가-힣.-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
    await browser.saveScreenshot(path.join(artifactsDir, `${Date.now()}-${safeTitle}.png`));
  },
};
