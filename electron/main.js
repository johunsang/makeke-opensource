const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// EPIPE 에러 무시 (백엔드 프로세스 종료 시 발생)
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

// ── 크래시 로그 ──────────────────────────────────────────────
const _crashLogPath = path.join(app.getPath('userData'), 'crash.log');
function _writeCrashLog(label, error) {
  try {
    const ts = new Date().toISOString();
    const msg = `[${ts}] [${label}] ${error?.stack || error?.message || String(error)}\n`;
    fs.appendFileSync(_crashLogPath, msg, 'utf-8');
    console.error(`[CrashLog] ${label}:`, error?.message || error);
  } catch {}
}

process.on('uncaughtException', (err) => {
  _writeCrashLog('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  _writeCrashLog('unhandledRejection', reason);
});



let mainWindow = null;
let serverLogWindow = null;
let backendProcess = null;
let chromeProcess = null;
let serverWatchdog = null;
let backendRestarting = false;
let isQuitting = false;
let currentBackendRuntime = 'unknown';
const childWindows = new Set();
const appWindows = new Map();
const serverLogBuffer = [];
const DEFAULT_PORT = 8818;
const PORT = Number.parseInt(String(process.env.MAKEKE_PORT || DEFAULT_PORT), 10) || DEFAULT_PORT;
const isDev = !app.isPackaged || process.argv.includes('--dev');
const START_PATH = String(process.env.MAKEKE_START_PATH || '/').trim() || '/';
const REQUESTED_BACKEND_RUNTIME = 'go';
const APP_WINDOW_TITLE = '마케케';
const isWindowsPackaged = process.platform === 'win32' && !isDev;
const enableServerWatchdog = process.env.MAKEKE_ENABLE_SERVER_WATCHDOG === '1' || isWindowsPackaged;
const SERVER_START_RETRIES = process.platform === 'win32' ? 75 : 30;
const SERVER_RESTART_RETRIES = process.platform === 'win32' ? 60 : 30;
const SERVER_WATCHDOG_INTERVAL_MS = process.platform === 'win32' ? 7000 : 10000;
const autoLaunchChromeOnStartup = process.env.MAKEKE_AUTO_LAUNCH_CHROME === '1';
const enableServerLogConsole = process.env.MAKEKE_SHOW_SERVER_LOG === '1';
const externalDataDir = process.env.MAKEKE_DATA_DIR || path.join(app.getPath('appData'), 'Makeke');
const { nativeImage } = require('electron');
const APP_ICON = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
const SERVER_LOG_DIR = path.join(externalDataDir, 'logs');
const SERVER_LOG_FILE = path.join(SERVER_LOG_DIR, 'backend-server.log');

function isWindowAlive(win) {
  return !!win && !win.isDestroyed();
}

function getServerLogWindowHtml() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Makeke 서버 로그</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #060606;
      color: #9ef38f;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: #0f0f10;
      color: #f5f5f5;
    }
    .title { font-size: 13px; font-weight: 700; }
    .hint { font-size: 11px; color: rgba(255,255,255,0.55); }
    .actions { display: flex; gap: 8px; }
    button {
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: #fff;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 11px;
      cursor: pointer;
    }
    pre {
      flex: 1;
      margin: 0;
      padding: 14px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <div class="title">서버 로그 콘솔</div>
      <div class="hint">Go 게이트웨이와 레거시 백엔드 시작 로그를 실시간으로 확인합니다.</div>
    </div>
    <div class="actions">
      <button onclick="window.copyLogs()">복사</button>
      <button onclick="window.clearLogs()">비우기</button>
    </div>
  </div>
  <pre id="log"></pre>
  <script>
    const logEl = document.getElementById('log');
    window.setServerLog = function(text) {
      logEl.textContent = text || '';
      logEl.scrollTop = logEl.scrollHeight;
    };
    window.appendServerLog = function(line) {
      logEl.textContent += (logEl.textContent ? '\\n' : '') + (line || '');
      logEl.scrollTop = logEl.scrollHeight;
    };
    window.copyLogs = async function() {
      try { await navigator.clipboard.writeText(logEl.textContent || ''); } catch {}
    };
    window.clearLogs = function() { logEl.textContent = ''; };
  </script>
</body>
</html>`)}`;
}

function syncServerLogWindow() {
  if (!isWindowAlive(serverLogWindow)) return;
  const payload = JSON.stringify(serverLogBuffer.join('\n'));
  serverLogWindow.webContents.executeJavaScript(`window.setServerLog(${payload});`, true).catch(() => {});
}

function createServerLogWindow(force = false) {
  if (!enableServerLogConsole) return null;
  if (isWindowAlive(serverLogWindow)) {
    serverLogWindow.show();
    serverLogWindow.focus();
    syncServerLogWindow();
    return serverLogWindow;
  }

  serverLogWindow = new BrowserWindow({
    width: 760,
    height: 460,
    minWidth: 540,
    minHeight: 320,
    title: 'Makeke 서버 로그',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#060606',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  serverLogWindow.loadURL(getServerLogWindowHtml());
  serverLogWindow.once('ready-to-show', () => {
    serverLogWindow.show();
    syncServerLogWindow();
  });
  serverLogWindow.webContents.on('did-finish-load', () => syncServerLogWindow());
  serverLogWindow.on('closed', () => {
    serverLogWindow = null;
  });
  return serverLogWindow;
}

function appendServerLog(message) {
  const line = `[${new Date().toISOString()}] ${String(message || '')}`;
  serverLogBuffer.push(line);
  if (serverLogBuffer.length > 800) {
    serverLogBuffer.splice(0, serverLogBuffer.length - 800);
  }
  try {
    fs.mkdirSync(SERVER_LOG_DIR, { recursive: true });
    fs.appendFileSync(SERVER_LOG_FILE, `${line}\n`);
  } catch {}
  if (isWindowAlive(serverLogWindow)) {
    serverLogWindow.webContents.executeJavaScript(`window.appendServerLog(${JSON.stringify(line)});`, true).catch(() => {});
  }
}

function buildServerEnv({ useBinary, extensionDir }) {
  const env = {
    ...process.env,
    MAKEKE_BACKEND_RUNTIME: 'go',
    MAKEKE_DATA_DIR: externalDataDir,
    MAKEKE_CHROME_EXTENSION_DIR: extensionDir,
    MAKEKE_BROWSER_WS_PORT: '9878',
  };

  if (useBinary) {
    [
      'VIRTUAL_ENV',
      'CONDA_PREFIX',
      'CONDA_DEFAULT_ENV',
      '__PYVENV_LAUNCHER__',
    ].forEach((key) => {
      delete env[key];
    });
  }

  return env;
}

function ensureExternalDataDir() {
  fs.mkdirSync(externalDataDir, { recursive: true });
}

function getPackagedProjectDir() {
  const fs = require('fs');
  const candidates = [
    path.join(process.resourcesPath, 'app'),
    path.join(process.resourcesPath, 'app.asar.unpacked'),
    process.resourcesPath,
  ];
  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    if (fs.existsSync(path.join(candidate, 'chrome-extension', 'manifest.json'))) {
      return candidate;
    }
  }
  const packagedPlainDir = path.join(process.resourcesPath, 'app');
  const packagedUnpackedDir = path.join(process.resourcesPath, 'app.asar.unpacked');
  return fs.existsSync(packagedPlainDir) ? packagedPlainDir : packagedUnpackedDir;
}

function getProjectDir() {
  return isDev ? path.join(__dirname, '..') : getPackagedProjectDir();
}

function safeRequireModule(moduleName) {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
}

function resolveBundledMediaBinary(name) {
  const envName = name === 'ffprobe' ? 'MAKEKE_FFPROBE_PATH' : 'MAKEKE_FFMPEG_PATH';
  const envPath = String(process.env[envName] || '').trim();
  const candidates = [];
  if (envPath) candidates.push(envPath);

  if (name === 'ffmpeg') {
    const ffmpegStatic = safeRequireModule('ffmpeg-static');
    if (typeof ffmpegStatic === 'string') candidates.push(ffmpegStatic);
  }
  if (name === 'ffprobe') {
    const ffprobeStatic = safeRequireModule('ffprobe-static');
    if (ffprobeStatic && typeof ffprobeStatic.path === 'string') candidates.push(ffprobeStatic.path);
  }

  const binaryName = process.platform === 'win32' ? `${name}.exe` : name;
  candidates.push(path.join(externalDataDir, 'media-tools', `${process.platform}-${process.arch}`, binaryName));
  for (const base of getPackagedPathCandidates()) {
    candidates.push(path.join(base, 'node_modules', name === 'ffprobe' ? 'ffprobe-static' : 'ffmpeg-static', binaryName));
    candidates.push(path.join(base, 'vendor', 'ffmpeg', process.platform + '-' + process.arch, binaryName));
  }
  candidates.push(name);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === name || fs.existsSync(candidate)) return candidate;
  }
  return '';
}

function buildMediaToolEnv(baseEnv = process.env) {
  const ffmpegPath = resolveBundledMediaBinary('ffmpeg');
  const ffprobePath = resolveBundledMediaBinary('ffprobe');
  const pathDirs = [];
  for (const binaryPath of [ffmpegPath, ffprobePath]) {
    if (binaryPath && binaryPath !== 'ffmpeg' && binaryPath !== 'ffprobe') pathDirs.push(path.dirname(binaryPath));
  }
  const uniquePathDirs = [...new Set(pathDirs)];
  return {
    ...baseEnv,
    ...(ffmpegPath ? { MAKEKE_FFMPEG_PATH: ffmpegPath } : {}),
    ...(ffprobePath ? { MAKEKE_FFPROBE_PATH: ffprobePath } : {}),
    PATH: uniquePathDirs.length ? `${uniquePathDirs.join(path.delimiter)}${path.delimiter}${baseEnv.PATH || ''}` : (baseEnv.PATH || ''),
  };
}

function getMediaToolsStatus() {
  const ffmpegPath = resolveBundledMediaBinary('ffmpeg');
  const ffprobePath = resolveBundledMediaBinary('ffprobe');
  return {
    ok: !!(ffmpegPath && ffprobePath),
    ffmpegPath,
    ffprobePath,
  };
}

async function installBundledMediaTools() {
  const status = getMediaToolsStatus();
  if (!status.ffmpegPath || !status.ffprobePath || status.ffmpegPath === 'ffmpeg' || status.ffprobePath === 'ffprobe') {
    throw new Error('앱에 내장된 FFmpeg를 찾을 수 없습니다. 최신 버전으로 업데이트가 필요합니다.');
  }
  const installDir = path.join(externalDataDir, 'media-tools', `${process.platform}-${process.arch}`);
  fs.mkdirSync(installDir, { recursive: true });
  const ffmpegDest = path.join(installDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const ffprobeDest = path.join(installDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  fs.copyFileSync(status.ffmpegPath, ffmpegDest);
  fs.copyFileSync(status.ffprobePath, ffprobeDest);
  if (process.platform !== 'win32') {
    fs.chmodSync(ffmpegDest, 0o755);
    fs.chmodSync(ffprobeDest, 0o755);
  }
  process.env.MAKEKE_FFMPEG_PATH = ffmpegDest;
  process.env.MAKEKE_FFPROBE_PATH = ffprobeDest;
  process.env.PATH = `${installDir}${path.delimiter}${process.env.PATH || ''}`;
  return { ok: true, ffmpegPath: ffmpegDest, ffprobePath: ffprobeDest };
}

function normalizeBackendRuntime(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'go') return normalized;
  return 'auto';
}

function resolveGoCommand() {
  const envPath = String(process.env.MAKEKE_GO_PATH || '').trim();
  const candidates = [];
  if (envPath) candidates.push(envPath);

  if (process.platform === 'win32') {
    candidates.push('go');
  } else if (process.platform === 'darwin') {
    candidates.push('go', '/opt/homebrew/bin/go', '/usr/local/bin/go', '/usr/bin/go');
  } else {
    candidates.push('go', '/usr/local/bin/go', '/usr/bin/go');
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    if (!path.isAbsolute(candidate)) {
      try {
        const lookupCommand = process.platform === 'win32'
          ? `where ${candidate}`
          : `command -v ${candidate}`;
        const resolved = execSync(lookupCommand, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh',
        }).trim();
        if (resolved) return resolved.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || candidate;
      } catch {}
    }
  }
  return '';
}

function buildGoLaunch(sourceDir) {
  const goCmd = resolveGoCommand();
  if (!goCmd) return { goCmd: '', args: [], cwd: sourceDir };
  return {
    goCmd,
    args: ['run', './cmd/makeke-server', '--port', String(PORT)],
    cwd: sourceDir,
  };
}

function getManagedExtensionDir() {
  return path.join(externalDataDir, 'chrome-extension');
}

function findExtensionSourceDir() {
  const projectDir = getProjectDir();
  const appPath = (() => {
    try { return app.getAppPath(); } catch { return ''; }
  })();
  const candidateBases = [
    projectDir,
    appPath,
    process.resourcesPath,
    path.join(process.resourcesPath, 'app'),
    path.join(process.resourcesPath, 'app.asar.unpacked'),
  ].filter(Boolean);

  const seen = new Set();
  for (const base of candidateBases) {
    const resolvedBase = path.resolve(base);
    if (seen.has(resolvedBase)) continue;
    seen.add(resolvedBase);
    const direct = path.join(resolvedBase, 'chrome-extension');
    const directManifest = path.join(direct, 'manifest.json');
    if (fs.existsSync(directManifest)) {
      return direct;
    }
  }
  return '';
}

function getPackagedPathCandidates() {
  const appPath = (() => {
    try { return app.getAppPath(); } catch { return ''; }
  })();
  return [
    getProjectDir(),
    appPath,
    process.resourcesPath,
    path.join(process.resourcesPath, 'app'),
    path.join(process.resourcesPath, 'app.asar.unpacked'),
  ].filter(Boolean);
}

function findServerBinaryInfo() {
  const serverBinaryName = process.platform === 'win32' ? 'makeke-server.exe' : 'makeke-server';
  const seen = new Set();
  const candidates = [];
  for (const base of getPackagedPathCandidates()) {
    const resolvedBase = path.resolve(base);
    if (seen.has(resolvedBase)) continue;
    seen.add(resolvedBase);
    candidates.push(path.join(resolvedBase, 'makeke-server', serverBinaryName));
    candidates.push(path.join(resolvedBase, serverBinaryName));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        serverBinary: candidate,
        serverBinaryDir: path.dirname(candidate),
        candidates,
      };
    }
  }
  return {
    serverBinary: '',
    serverBinaryDir: '',
    candidates,
  };
}

function findGoServerBinaryInfo() {
  const serverBinaryName = process.platform === 'win32' ? 'makeke-server-go.exe' : 'makeke-server-go';
  const seen = new Set();
  const candidates = [];
  for (const base of getPackagedPathCandidates()) {
    const resolvedBase = path.resolve(base);
    if (seen.has(resolvedBase)) continue;
    seen.add(resolvedBase);
    candidates.push(path.join(resolvedBase, 'api', 'bin', serverBinaryName));
    candidates.push(path.join(resolvedBase, serverBinaryName));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        serverBinary: candidate,
        serverBinaryDir: path.dirname(candidate),
        candidates,
      };
    }
  }
  return {
    serverBinary: '',
    serverBinaryDir: '',
    candidates,
  };
}

function findGoServerSourceInfo() {
  const seen = new Set();
  const candidates = [];
  for (const base of getPackagedPathCandidates()) {
    const resolvedBase = path.resolve(base);
    if (seen.has(resolvedBase)) continue;
    seen.add(resolvedBase);
    candidates.push(path.join(resolvedBase, 'api'));
  }
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'go.mod')) &&
      fs.existsSync(path.join(candidate, 'cmd', 'makeke-server', 'main.go'))
    ) {
      return {
        sourceDir: candidate,
        candidates,
      };
    }
  }
  return {
    sourceDir: '',
    candidates,
  };
}

function buildBackendLaunchPlan() {
  const projectDir = getProjectDir();
  const goBinaryInfo = findGoServerBinaryInfo();
  const goSourceInfo = findGoServerSourceInfo();
  const goLaunch = buildGoLaunch(goSourceInfo.sourceDir || path.join(projectDir, 'api'));

  // Development must execute edited source, even when an old release binary is present.
  const preferSource = isDev && goSourceInfo.sourceDir && goLaunch.goCmd;
  if (!preferSource && goBinaryInfo.serverBinary && fs.existsSync(goBinaryInfo.serverBinary)) {
    return {
      runtime: 'go',
      mode: 'binary',
      cmd: goBinaryInfo.serverBinary,
      args: [String(PORT)],
      cwd: goBinaryInfo.serverBinaryDir,
      useBinary: true,
      candidates: goBinaryInfo.candidates,
    };
  }

  if (goSourceInfo.sourceDir && goLaunch.goCmd) {
    return {
      runtime: 'go',
      mode: 'source',
      cmd: goLaunch.goCmd,
      args: goLaunch.args,
      cwd: goLaunch.cwd,
      useBinary: false,
      candidates: goSourceInfo.candidates,
    };
  }

  return {
    runtime: 'go',
    mode: 'missing',
    cmd: '',
    args: [],
    cwd: projectDir,
    useBinary: false,
    candidates: [...(goBinaryInfo.candidates || []), ...(goSourceInfo.candidates || [])],
  };
}

function readManifestVersion(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw).version || '';
  } catch {
    return '';
  }
}

function readExtensionSignature(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return '';
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1');
    const walk = (currentDir, relativeBase = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativeBase, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
          continue;
        }
        hash.update(relPath);
        hash.update('\n');
        hash.update(fs.readFileSync(fullPath));
        hash.update('\n');
      }
    };
    walk(dirPath);
    return hash.digest('hex');
  } catch {
    return '';
  }
}

function syncChromeExtension() {
  const projectDir = getProjectDir();
  const sourceDir = findExtensionSourceDir();
  const targetDir = getManagedExtensionDir();
  const sourceManifest = path.join(sourceDir, 'manifest.json');
  const targetManifest = path.join(targetDir, 'manifest.json');

  console.log(`[Electron] Chrome 익스텐션 경로 — 프로젝트: ${projectDir}, 소스: ${sourceDir}, 타겟: ${targetDir}`);

  if (!sourceDir || !fs.existsSync(sourceManifest)) {
    console.log('[Electron] Chrome 익스텐션 원본을 찾지 못했습니다:', sourceManifest);
    try {
      const candidates = getPackagedPathCandidates();
      console.log('[Electron] 확장 원본 후보:', candidates.join(' | '));
    } catch (e) { console.log('[Electron] 디렉토리 읽기 실패:', e.message); }
    return null;
  }

  const sourceVersion = readManifestVersion(sourceManifest);
  const targetVersion = readManifestVersion(targetManifest);
  const sourceSignature = readExtensionSignature(sourceDir);
  const targetSignature = readExtensionSignature(targetDir);
  const needsSync = !fs.existsSync(targetManifest)
    || compareVersions(sourceVersion, targetVersion) > 0
    || (!!sourceSignature && sourceSignature !== targetSignature);

  if (needsSync) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`[Electron] Chrome 익스텐션 동기화 완료: ${targetVersion || '없음'} -> ${sourceVersion || 'unknown'} (${sourceSignature.slice(0, 8) || 'nosig'})`);
  }

  return targetDir;
}

function isServerReachable(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      resolve(false);
    });
  });
}

function isLocalPortReachable(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, '127.0.0.1');
  });
}

function getRunningBackendRuntime(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/runtime/status`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve('');
          return;
        }
        try {
          const parsed = JSON.parse(body || '{}');
          resolve(normalizeBackendRuntime(parsed?.runtime || ''));
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch {}
      resolve('');
    });
  });
}

function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(v => parseInt(v, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map(v => parseInt(v, 10) || 0);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i += 1) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function getAppUrl(startPath = START_PATH) {
  const normalized = String(startPath || '/').startsWith('/') ? String(startPath || '/') : `/${String(startPath || '/')}`;
  return `http://127.0.0.1:${PORT}${normalized}`;
}

function buildReloadUrl() {
  try {
    const currentUrl = mainWindow?.webContents?.getURL?.() || getAppUrl();
    const url = new URL(currentUrl.startsWith('http') ? currentUrl : getAppUrl());
    url.searchParams.set('_reload', String(Date.now()));
    return url.toString();
  } catch {
    return `${getAppUrl()}?_reload=${Date.now()}`;
  }
}

async function safeReloadMainWindow() {
  if (!isWindowAlive(mainWindow)) return;
  try {
    const reachable = await isServerReachable(1500);
    if (!reachable) {
      appendServerLog('manual refresh detected backend unreachable -> restarting');
      await restartBackendServer(true);
      await waitForServer(Math.max(20, Math.floor(SERVER_RESTART_RETRIES * 0.66)));
    }
    mainWindow.loadURL(buildReloadUrl());
  } catch (error) {
    appendServerLog(`manual refresh failed ${error?.message || error}`);
    createServerLogWindow(true);
    mainWindow.loadURL(buildReloadUrl());
  }
}

function canAccessPath(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function findChromeExecutable() {
  const checked = [];

  const remember = (targetPath) => {
    const normalized = String(targetPath || '').trim().replace(/^"(.*)"$/, '$1');
    if (normalized && !checked.includes(normalized)) checked.push(normalized);
    return normalized;
  };

  const existing = (targetPath) => {
    const normalized = remember(targetPath);
    return normalized && canAccessPath(normalized) ? normalized : null;
  };

  const envPath = process.env.MAKEKE_CHROME_PATH;
  if (envPath) {
    const found = existing(envPath);
    if (found) return { path: found, checked };
  }

  if (process.platform === 'darwin') {
    const appCandidates = [
      '/Applications/Google Chrome.app',
      '/Applications/Google Chrome for Testing.app',
      '/Applications/Google Chrome Beta.app',
      '/Applications/Google Chrome Canary.app',
      '/Applications/Chromium.app',
      path.join(process.env.HOME || '', 'Applications/Google Chrome.app'),
      path.join(process.env.HOME || '', 'Applications/Google Chrome for Testing.app'),
      path.join(process.env.HOME || '', 'Applications/Google Chrome Beta.app'),
      path.join(process.env.HOME || '', 'Applications/Google Chrome Canary.app'),
      path.join(process.env.HOME || '', 'Applications/Chromium.app'),
    ];
    for (const appPath of appCandidates) {
      const normalized = remember(appPath);
      if (normalized && fs.existsSync(normalized)) {
        const appName = path.basename(normalized, '.app');
        const found = existing(path.join(normalized, 'Contents', 'MacOS', appName));
        if (found) return { path: found, checked };
      }
    }

    const spotlightQueries = [
      'kMDItemCFBundleIdentifier == "com.google.Chrome"',
      'kMDItemCFBundleIdentifier == "com.google.Chrome.beta"',
      'kMDItemCFBundleIdentifier == "com.google.Chrome.canary"',
      'kMDItemCFBundleIdentifier == "org.chromium.Chromium"',
    ];
    for (const query of spotlightQueries) {
      try {
        const result = execSync(`mdfind '${query}'`, { encoding: 'utf-8', timeout: 3000 });
        for (const rawPath of result.split('\n').map(v => v.trim()).filter(Boolean)) {
          if (!rawPath.endsWith('.app')) continue;
          const appName = path.basename(rawPath, '.app');
          const found = existing(path.join(rawPath, 'Contents', 'MacOS', appName));
          if (found) return { path: found, checked };
        }
      } catch {}
    }
  } else if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome SxS/Application/chrome.exe'),
    ];
    for (const candidate of candidates) {
      const found = existing(candidate);
      if (found) return { path: found, checked };
    }

    const regKeys = [
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
      'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
    ];
    for (const regKey of regKeys) {
      try {
        const result = execSync(`reg query "${regKey}" /ve`, { encoding: 'utf-8', timeout: 3000 });
        const match = result.match(/REG_SZ\s+([^\r\n]+)/);
        const found = match ? existing(match[1].trim()) : null;
        if (found) return { path: found, checked };
      } catch {}
    }

    for (const cmd of ['chrome.exe', 'chrome']) {
      try {
        const found = execSync(`where ${cmd}`, { encoding: 'utf-8', timeout: 3000 })
          .split(/\r?\n/)
          .map(v => v.trim())
          .find(Boolean);
        if (found) {
          remember(found);
          return { path: found, checked };
        }
      } catch {}
    }
  } else {
    for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      try {
        const found = execSync(`command -v ${cmd}`, { encoding: 'utf-8', timeout: 3000 }).trim();
        if (found) {
          remember(found);
          return { path: found, checked };
        }
      } catch {}
    }
  }

  return { path: null, checked };
}

function openExternalUrl(url, options = {}) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl) return false;

  const preferChrome = !!options.preferChrome;
  if (preferChrome) {
    const chrome = findChromeExecutable();
    if (chrome.path) {
      try {
        const spawnOptions = {
          detached: true,
          stdio: 'ignore',
        };
        if (process.platform === 'win32') {
          spawnOptions.windowsHide = true;
        }
        const child = spawn(chrome.path, [targetUrl], spawnOptions);
        child.unref();
        console.log(`[Electron] Chrome로 외부 URL 열기: ${targetUrl}`);
        return true;
      } catch (error) {
        console.log(`[Electron] Chrome 직접 실행 실패, 시스템 기본 브라우저로 폴백: ${error.message}`);
      }
    } else {
      console.log(`[Electron] Chrome 미탐지, 시스템 기본 브라우저로 폴백: ${targetUrl}`);
    }
  }

  shell.openExternal(targetUrl);
  return true;
}

function resolveLocalUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || ''), `http://127.0.0.1:${PORT}`);
  } catch {
    return null;
  }
}

function isLocalHostUrl(urlObj) {
  if (!urlObj || !['http:', 'https:'].includes(urlObj.protocol) || urlObj.username || urlObj.password) return false;
  const host = String(urlObj.hostname || '').toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

function getAppWindowKey(rawUrl) {
  const urlObj = resolveLocalUrl(rawUrl);
  if (!isLocalHostUrl(urlObj)) return '';

  const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
  const pathname = urlObj.pathname || '/';

  if (port === String(PORT)) {
    if (pathname === '/' || pathname === '/static/index.html') return 'makeke';
  }
  return '';
}

function getAppWindowMeta(key) {
  const defaults = { title: '마케케', width: 1280, height: 900, backgroundColor: '#f5f5f7' };
  const map = {
    makeke: { title: '마케케', width: 1400, height: 900 },
  };
  return { ...defaults, ...(map[key] || {}) };
}

function attachAppWindowHandlers(win) {
  if (!isWindowAlive(win)) return;

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!getAppWindowKey(targetUrl) && !isLocalHostUrl(resolveLocalUrl(targetUrl))) {
      event.preventDefault();
      openExternalUrl(targetUrl);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    const appKey = getAppWindowKey(url);
    if (appKey) {
      openOrFocusAppWindow(url);
      return { action: 'deny' };
    }

    const urlObj = resolveLocalUrl(url);
    if (urlObj && (urlObj.protocol === 'blob:' || urlObj.protocol === 'data:')) {
      return { action: 'allow' };
    }

    if (!isLocalHostUrl(urlObj)) {
      openExternalUrl(url);
      return { action: 'deny' };
    }

    return { action: 'allow' };
  });
}

function openOrFocusAppWindow(rawUrl) {
  const key = getAppWindowKey(rawUrl);
  if (!key) return null;

  const targetUrl = resolveLocalUrl(rawUrl).toString();
  const existing = appWindows.get(key);
  if (isWindowAlive(existing)) {
    if (existing.webContents.getURL() !== targetUrl) {
      existing.loadURL(targetUrl);
    }
    existing.show();
    existing.focus();
    return existing;
  }

  const meta = getAppWindowMeta(key);
  const appWin = new BrowserWindow({
    width: meta.width,
    height: meta.height,
    minWidth: 900,
    minHeight: 650,
    title: meta.title,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: meta.backgroundColor,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  childWindows.add(appWin);
  appWindows.set(key, appWin);
  attachAppWindowHandlers(appWin);

  appWin.on('closed', () => {
    childWindows.delete(appWin);
    if (appWindows.get(key) === appWin) {
      appWindows.delete(key);
    }
  });

  appWin.loadURL(targetUrl);
  return appWin;
}

// 단일 인스턴스 강제 — 이미 실행 중이면 기존 창 활성화
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.exit(0); }
app.on('second-instance', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    try {
      await waitForServer(10);
      mainWindow.loadURL(getAppUrl());
    } catch (error) {
      console.error('[Electron] 기존 인스턴스 창 복구 실패:', error);
    }
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  try {
    const reachable = await isServerReachable(1200);
    if (!reachable) {
      console.log('[Electron] 기존 인스턴스 복구: 백엔드 미응답 → 재시작');
      await restartBackendServer(true);
    }
    const targetUrl = getAppUrl();
    if (mainWindow.webContents.getURL() !== targetUrl) {
      mainWindow.loadURL(targetUrl);
    } else if (reachable) {
      mainWindow.webContents.reloadIgnoringCache();
    } else {
      mainWindow.loadURL(targetUrl);
    }
  } catch (error) {
    console.error('[Electron] 기존 인스턴스 복구 실패:', error);
  }
});


// 백엔드 서버 시작
function startBackendServer() {
  const extensionDir = syncChromeExtension();
  const launchPlan = buildBackendLaunchPlan();
  currentBackendRuntime = launchPlan.runtime;
  const env = buildServerEnv({ useBinary: launchPlan.useBinary, extensionDir });

  if (!launchPlan.cmd) {
    const message = 'Go 백엔드를 찾지 못해 앱을 시작할 수 없습니다.';
    console.error(`[Electron] ${message}`);
    appendServerLog(message);
    appendServerLog(`launch candidates=${JSON.stringify(launchPlan.candidates || [])}`);
    dialog.showErrorBox('Go 서버 시작 실패', message);
    return;
  }

  console.log(`[Electron] 서버 시작: ${launchPlan.runtime}/${launchPlan.mode} → ${launchPlan.cmd}`);
  appendServerLog(`start runtime=${launchPlan.runtime} mode=${launchPlan.mode} cmd=${launchPlan.cmd} cwd=${launchPlan.cwd} args=${JSON.stringify(launchPlan.args)}`);
  appendServerLog(`requested backend runtime=${REQUESTED_BACKEND_RUNTIME}`);
  appendServerLog(`launch candidates=${JSON.stringify(launchPlan.candidates || [])}`);

  backendProcess = spawn(launchPlan.cmd, launchPlan.args, {
    cwd: launchPlan.cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: process.platform === 'win32',
  });

  backendProcess.stdout.on('data', (data) => {
    try {
      const text = data.toString().trim();
      if (enableServerLogConsole && text) console.log(`[Backend:${launchPlan.runtime}] ${text}`);
      if (text) appendServerLog(`[stdout] ${text}`);
    } catch {}
  });

  backendProcess.stderr.on('data', (data) => {
    try {
      const text = data.toString().trim();
      if (enableServerLogConsole && text) console.log(`[Backend:${launchPlan.runtime}] ${text}`);
      if (text) appendServerLog(`[stderr] ${text}`);
    } catch {}
  });

  backendProcess.stdout.on('error', () => {});
  backendProcess.stderr.on('error', () => {});

  backendProcess.on('error', (err) => {
    console.error('[Electron] 백엔드 시작 실패:', err);
    appendServerLog(`spawn error ${err?.message || err}`);
    createServerLogWindow(true);
    dialog.showErrorBox('Go 서버 시작 실패', `Go 서버를 시작할 수 없습니다.\n\n${err.message}`);
  });

  let _serverCrashCount = 0;
  backendProcess.on('exit', async (code) => {
    console.log(`[Electron] ${launchPlan.runtime} 백엔드 종료 (code: ${code})`);
    appendServerLog(`exit code=${code}`);
    backendProcess = null;
    if (code !== 0 && code !== null) {
      const existingServerReachable = await isServerReachable(1200).catch(() => false);
      if (existingServerReachable) {
        const runningRuntime = await getRunningBackendRuntime().catch(() => '');
        currentBackendRuntime = runningRuntime || launchPlan.runtime;
        console.log(`[Electron] ${launchPlan.runtime} 시작은 실패했지만 기존 ${PORT} 서버를 재사용합니다.`);
        appendServerLog(`[REUSE] existing backend reachable runtime=${runningRuntime || 'unknown'} after spawn exit`);
        return;
      }
      _serverCrashCount++;
      const crashErr = { message: `${launchPlan.runtime} 서버 비정상 종료 code=${code} (${_serverCrashCount}회)` };
      _writeCrashLog(`${launchPlan.runtime}-server-crash`, crashErr);
      appendServerLog(`[CRASH] ${launchPlan.runtime} 서버 비정상 종료 code=${code} (${_serverCrashCount}회)`);

      if (_serverCrashCount <= 3) {
        console.log(`[Electron] 서버 자동 재시작 (${_serverCrashCount}회차)...`);
        appendServerLog(`[AUTO-RESTART] 서버 자동 재시작 시도 (${_serverCrashCount}회차)`);
        setTimeout(() => {
          if (!backendProcess) startBackendServer();
        }, 2000);
      } else {
        dialog.showErrorBox('서버 오류', `서버가 반복적으로 종료되고 있습니다.\n앱을 재시작해주세요.\n\n(오류 코드: ${code})`);
      }
    }
  });
}

function stopBackendServer() {
  if (!backendProcess) return;
  try {
    backendProcess.kill('SIGTERM');
  } catch {}
  backendProcess = null;
  currentBackendRuntime = 'unknown';
}

function killServerOnPort() {
  try {
    let pids = [];
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`, { encoding: 'utf-8', timeout: 3000, shell: 'cmd.exe' });
      pids = result.split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1];
      }).filter(pid => pid && /^\d+$/.test(pid));
      pids.forEach(pid => {
        try { execSync(`taskkill /PID ${pid} /F`, { timeout: 3000, shell: 'cmd.exe' }); } catch {}
      });
    } else {
      pids = execSync(`lsof -t -iTCP:${PORT} -sTCP:LISTEN`, { encoding: 'utf-8', timeout: 3000 })
        .split('\n').map(v => v.trim()).filter(Boolean);
      pids.forEach(pid => {
        try { process.kill(Number(pid), 'SIGTERM'); } catch {}
      });
    }
    return pids;
  } catch {
    return [];
  }
}

async function restartBackendServer(forceKillPort = false) {
  if (backendRestarting) {
    return { ok: false, message: '백엔드 서버를 이미 다시 시작하는 중입니다.' };
  }
  backendRestarting = true;
  try {
    if (forceKillPort) {
      killServerOnPort();
    } else {
      stopBackendServer();
    }
    await new Promise(resolve => setTimeout(resolve, process.platform === 'win32' ? 1800 : 1200));
    startBackendServer();
    await waitForServer(SERVER_RESTART_RETRIES);
    return { ok: true, port: PORT, pid: backendProcess ? backendProcess.pid : null };
  } catch (error) {
    return { ok: false, message: error.message || String(error) };
  } finally {
    backendRestarting = false;
  }
}

function startServerWatchdog() {
  if (serverWatchdog) clearInterval(serverWatchdog);
  serverWatchdog = setInterval(async () => {
    if (isQuitting || backendRestarting) return;
    const reachable = await isServerReachable(1200);
    if (reachable) return;
    console.log('[Electron] 백엔드 서버 응답 없음 → 자동 재시작 시도');
    await restartBackendServer(true);
  }, SERVER_WATCHDOG_INTERVAL_MS);
}

// 백엔드 서버 대기
function waitForServer(maxRetries = SERVER_START_RETRIES) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(2000, retry);

      function retry() {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error('서버 시작 시간 초과'));
        } else {
          setTimeout(check, 1000);
        }
      }
    };
    check();
  });
}

// 메뉴 설정
function createMenu() {
  const template = [
    {
      label: '마케케',
      submenu: [
        { label: '마케케 정보', role: 'about' },
        { type: 'separator' },
        {
          label: '새로고침',
          accelerator: 'CmdOrCtrl+R',
          click: () => { safeReloadMainWindow(); },
        },
        {
          label: '개발자 도구',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        {
          label: '서버 로그 콘솔',
          accelerator: 'CmdOrCtrl+Shift+L',
          visible: enableServerLogConsole,
          enabled: enableServerLogConsole,
          click: () => createServerLogWindow(true),
        },
        { type: 'separator' },
        {
          label: 'Chrome 브라우저 열기',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => launchChrome(),
        },
        {
          label: 'API 문서 열기',
          click: () => shell.openExternal(`http://127.0.0.1:${PORT}/docs`),
        },
        { type: 'separator' },
        { label: '종료', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '전체 선택', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '확대', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '원래 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '전체 화면', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 메인 윈도우 생성
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: APP_WINDOW_TITLE,
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'default',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableBlinkFeatures: '',
    },
    show: false,
  });

  // 개발 모드: 캐시 비활성화
  if (isDev) {
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['Cache-Control'] = 'no-cache';
      callback({ requestHeaders: details.requestHeaders });
    });
  }

  // 로딩 화면 표시 (강조색 테마 — 정적, GPU 부담 없음)
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
    <body style="background:%23faf8f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:-apple-system,'SF Pro Display',sans-serif;">
      <div style="text-align:center;color:%231c1c1e;">
        <div style="font-size:42px;font-weight:800;margin-bottom:6px;letter-spacing:-1px;"><span style="color:%23ff8c00;">M</span>akeke</div>
        <p style="color:rgba(0,0,0,0.35);font-size:13px;font-weight:500;">상큼한 AI 마케팅 솔루션</p>
        <p style="color:%23ff8c00;font-size:13px;margin-top:28px;">● 서버 시작 중...</p>
      </div>
    </body>
    </html>
  `);

  mainWindow.once('ready-to-show', () => {
    try {
      mainWindow.setSize(1400, 900);
      mainWindow.center();
    } catch {}
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const msg = `페이지 로드 실패: ${errorCode} ${errorDescription} (${validatedURL})`;
    console.error(`[Electron] ${msg}`);
    _writeCrashLog('did-fail-load', { message: msg });
  });

  mainWindow.webContents.on('did-finish-load', () => {
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const msg = `렌더러 프로세스 종료: reason=${details.reason} exitCode=${details.exitCode}`;
    console.error(`[Electron] ${msg}`);
    _writeCrashLog('render-process-gone', { message: msg });
    appendServerLog(`[CRASH] renderer gone reason=${details.reason} exitCode=${details.exitCode}`);
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => { safeReloadMainWindow(); }, 1200);
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    _writeCrashLog('unresponsive', { message: '렌더러가 응답하지 않습니다' });
    appendServerLog('[CRASH] 렌더러 unresponsive');
    console.error('[Electron] 렌더러 unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('[Electron] 렌더러 다시 응답');
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.log(`[WebContents] ${message} (${sourceId}:${line})`);
      if (level >= 3) _writeCrashLog('console-error', { message: `${message} (${sourceId}:${line})` });
    }
  });

  mainWindow.on('unresponsive', () => {
    _writeCrashLog('window-unresponsive', { message: '메인 윈도우 응답 없음' });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 외부 링크를 시스템 브라우저(크롬)로 열기
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // localhost가 아닌 외부 URL은 시스템 브라우저로
    if (!isLocalHostUrl(resolveLocalUrl(url))) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });

  // 새 창(뉴스 링크 등)이 열릴 때
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {

    // Google 로그인 팝업은 Electron 내부에서 열기
    if (url.includes('accounts.google.com/gsi') || url.includes('accounts.google.com/o/oauth2')) {
      return { action: 'allow' };
    }

    // localhost가 아닌 외부 URL은 시스템 브라우저로
    if (!isLocalHostUrl(resolveLocalUrl(url))) {
      openExternalUrl(url);
      return { action: 'deny' };
    }

    const appWindowKey = getAppWindowKey(url);
    if (appWindowKey) {
      openOrFocusAppWindow(url);
      return { action: 'deny' };
    }

    // 영상 스튜디오(HyperFrames OSS)는 전용 큰 창으로 + 수집바 주입 안 함
    const isVideoStudio = /\/api\/hyperframes\/studio/.test(url);
    const popupTitle = isVideoStudio ? '영상 스튜디오' : '마케케 미리보기';

    // localhost 내부 링크는 새 BrowserWindow로 열기
    const popupWin = new BrowserWindow({
      width: isVideoStudio ? 1400 : 900,
      height: isVideoStudio ? 900 : 700,
      title: popupTitle,
      backgroundColor: isVideoStudio ? '#0f0b09' : '#f5f5f7',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    childWindows.add(popupWin);
    popupWin.on('closed', () => childWindows.delete(popupWin));
    popupWin.loadURL(url);

    // 영상 스튜디오·중국 리서치는 뉴스 수집 UI 주입 없이 그대로 사용
    if (isVideoStudio) {
      return { action: 'deny' };
    }

    // 페이지 로드 완료 후 수집 버튼 주입
    popupWin.webContents.on('did-finish-load', () => {
      popupWin.webContents.executeJavaScript(`
        (function() {
          if (document.getElementById('makeke-collect-bar')) return;
          const bar = document.createElement('div');
          bar.id = 'makeke-collect-bar';
          bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#fff;border-top:1px solid rgba(0,0,0,0.1);padding:10px 20px;display:flex;align-items:center;gap:12px;font-family:-apple-system,sans-serif;';

          const title = document.querySelector('h1')?.innerText || document.title || '';
          const charCount = (document.body.innerText || '').length;

          bar.innerHTML = \`
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#1c1c1e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${title.substring(0,60)}</div>
              <div style="font-size:11px;color:rgba(0,0,0,0.4);">본문 \${charCount.toLocaleString()}자 · \${location.hostname}</div>
            </div>
          \`;
          document.body.appendChild(bar);
          document.body.style.paddingBottom = '60px';

          document.getElementById('makeke-collect-btn').addEventListener('click', function() {
            this.disabled = true;
            this.textContent = '수집 중...';

            // 본문 추출
            const selectors = ['article','#newsct_article','#dic_area','.se-main-container','#postViewArea','.post-view','#article-body','.article_body','main','#content','#contents','.post-content','.entry-content'];
            let text = '';
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.innerText.trim().length > 100) { text = el.innerText.trim(); break; }
            }
            if (!text) text = document.body.innerText.trim();

            // 이미지 수집
            const images = [];
            const ogImg = document.querySelector('meta[property="og:image"]');
            if (ogImg && ogImg.content) images.push(ogImg.content);
            document.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset.src || '';
              if (src && !src.startsWith('data:') && images.length < 15) {
                if (!/icon|logo|sprite|gif/.test(src.toLowerCase()) && img.offsetWidth > 50) {
                  images.push(src);
                }
              }
            });

            // 메인 창에 데이터 전달 (URL 파라미터 방식)
            const data = { title, text: text.substring(0, 10000), images, url: location.href };
            fetch('http://127.0.0.1:${PORT}/api/content/collect-from-popup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            }).then(r => r.json()).then(res => {
              this.textContent = '수집 완료!';
              this.style.background = '#34c759';
              setTimeout(() => window.close(), 1000);
            }).catch(err => {
              this.textContent = '실패: ' + err.message;
              this.style.background = '#ff3b30';
              this.disabled = false;
            });
          });
        })();
      `);
    });

    return { action: 'deny' }; // 기본 동작 차단 (우리가 직접 열었으므로)
  });
}

// Chrome이 기본 브라우저로 설정되어 있는지 확인
function checkDefaultBrowser() {
  const { execSync } = require('child_process');

  try {
    let isChrome = false;
    let detectedBrowser = 'unknown';

    if (process.platform === 'darwin') {
      // macOS: LaunchServices 설정에서 기본 HTTP 핸들러 확인
      try {
        const output = execSync(
          'defaults read ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers 2>/dev/null || echo ""',
          { encoding: 'utf8', timeout: 5000 }
        );
        // LSHandlers plist에서 http 스킴의 핸들러 검색
        const httpMatch = output.match(/LSHandlerURLScheme\s*=\s*https?;[\s\S]*?LSHandlerRoleAll\s*=\s*"?([^";]+)"?/i);
        if (httpMatch && httpMatch[1]) {
          detectedBrowser = httpMatch[1].trim().toLowerCase();
          isChrome = detectedBrowser.includes('chrome') || detectedBrowser.includes('com.google.chrome');
        } else {
          // 대체: 파싱 실패 시 plutil 을 사용
          try {
            const plistJson = execSync(
              'plutil -convert json -o - ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure 2>/dev/null || echo "{}"',
              { encoding: 'utf8', timeout: 5000 }
            );
            const plist = JSON.parse(plistJson);
            const handlers = plist.LSHandlers || [];
            for (const h of handlers) {
              if (h.LSHandlerURLScheme && h.LSHandlerURLScheme.toLowerCase() === 'https') {
                detectedBrowser = (h.LSHandlerRoleAll || '').toLowerCase();
                isChrome = detectedBrowser.includes('chrome') || detectedBrowser.includes('com.google.chrome');
                break;
              }
            }
          } catch (_) {
            // plutil도 실패 — 판별 불가
          }
        }
      } catch (_) {
        console.log('[Electron] macOS 기본 브라우저 확인 실패');
      }
    } else if (process.platform === 'win32') {
      // Windows: 레지스트리에서 HTTP UserChoice ProgId 확인
      try {
        const output = execSync(
          'reg query "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId 2>nul',
          { encoding: 'utf8', timeout: 5000 }
        );
        const match = output.match(/ProgId\s+REG_SZ\s+(.+)/i);
        if (match && match[1]) {
          detectedBrowser = match[1].trim().toLowerCase();
          isChrome = detectedBrowser.includes('chrome');
        }
      } catch (_) {
        console.log('[Electron] Windows 기본 브라우저 확인 실패');
      }
    } else {
      // Linux: xdg-settings로 확인
      try {
        const output = execSync('xdg-settings get default-web-browser 2>/dev/null || echo ""', { encoding: 'utf8', timeout: 5000 });
        detectedBrowser = output.trim().toLowerCase();
        isChrome = detectedBrowser.includes('chrome');
      } catch (_) {
        console.log('[Electron] Linux 기본 브라우저 확인 실패');
      }
    }

    if (isChrome) {
      console.log(`[Electron] Chrome이 기본 브라우저로 설정되어 있습니다. (${detectedBrowser})`);
    } else {
      console.warn(`[Electron] ⚠ Chrome이 기본 브라우저가 아닙니다. (현재: ${detectedBrowser})`);
      // mainWindow에 알림 전송
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          (function() {
            try {
              if (typeof showToast === 'function') {
                showToast('Chrome이 기본 브라우저로 설정되어 있지 않습니다. 일부 기능이 제한될 수 있습니다.', 'warning');
              } else {
                console.warn('[Makeke] Chrome이 기본 브라우저가 아닙니다. 현재: ${detectedBrowser.replace(/'/g, "\\'")}');
              }
            } catch(e) {}
          })();
        `).catch(() => {});
      }
    }

    return isChrome;
  } catch (e) {
    console.error('[Electron] 기본 브라우저 확인 중 오류:', e.message);
    return false;
  }
}

// Chrome 브라우저 실행 (확장 프로그램 자동 로드 + 기본 프로필 사용)
function launchChrome() {
  const fs = require('fs');
  const { execSync } = require('child_process');
  const extensionDir = syncChromeExtension();

  if (!extensionDir) {
    console.log('[Electron] Chrome 익스텐션을 찾지 못해 Chrome을 실행하지 않습니다.');
    return;
  }

  const { path: chromePath, checked } = findChromeExecutable();

  if (!chromePath) {
    console.log('[Electron] Chrome을 찾을 수 없습니다. 확인 경로:', checked);
    return;
  }

  // Chrome이 이미 실행 중인지 확인
  let chromeRunning = false;
  try {
    if (process.platform === 'darwin') {
      const result = execSync('pgrep -x "Google Chrome"', { encoding: 'utf-8', timeout: 3000 }).trim();
      chromeRunning = result.length > 0;
    } else if (process.platform === 'win32') {
      const result = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /NH', { encoding: 'utf-8', timeout: 3000, shell: 'cmd.exe' });
      chromeRunning = result.includes('chrome.exe');
    }
  } catch { chromeRunning = false; }

  if (chromeRunning) {
    console.log('[Electron] Chrome이 이미 실행 중 — 기존 브라우저는 건드리지 않습니다.');
    return extensionDir;
  }

  doLaunchChrome(chromePath, extensionDir);
}

function doLaunchChrome(chromePath, extensionDir) {
  // Windows에서는 네이티브 경로(백슬래시)를 그대로 사용
  const extPath = process.platform === 'win32' ? extensionDir : extensionDir.replace(/\\/g, '/');

  // 기존 Chrome User Data 디렉토리 사용 (사용자 프로필 유지)
  let userDataDir;
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local');
    userDataDir = path.join(localAppData, 'Google', 'Chrome', 'User Data');
  } else if (process.platform === 'darwin') {
    userDataDir = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Google', 'Chrome');
  } else {
    userDataDir = path.join(process.env.HOME || '', '.config', 'google-chrome');
  }

  const args = [
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${extPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--silent-debugger-extension-api',
    `--window-size=1200,800`,
  ];

  console.log(`[Electron] Chrome 실행: ${chromePath}`);
  console.log(`[Electron] 확장 프로그램: ${extensionDir}`);

  chromeProcess = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
  });

  chromeProcess.on('error', (err) => {
    console.error('[Electron] Chrome 실행 실패:', err.message);
  });

  chromeProcess.on('exit', (code) => {
    console.log(`[Electron] Chrome 종료 (code: ${code})`);
    chromeProcess = null;
  });

  chromeProcess.unref();
}

// 앱 시작
// ═══ IPC: Electron 내부 브라우저로 URL 스크래핑 ═══
const activeScrapes = new Set();
ipcMain.handle('scrape-url', async (event, url, options = {}) => {
  if (activeScrapes.has(url)) return { error: 'already scraping', text: '', images: [], title: '' };
  if (activeScrapes.size >= 3) return { error: 'too many scrapes', text: '', images: [], title: '' };
  activeScrapes.add(url);
  const mode = String(options?.mode || 'full').trim().toLowerCase();
  const waitMs = mode === 'minimal-cdp' ? 1800 : 3500;
  const showScrapeWindow = options?.show !== false && options?.visible !== false;
  return new Promise((resolve) => {
    const scrapeWin = new BrowserWindow({
      width: 1280,
      height: 900,
      show: showScrapeWindow,
      title: '마케케 자료 수집',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let resolved = false;
    const done = (result) => { if (!resolved) { resolved = true; clearTimeout(timeout); activeScrapes.delete(url); try { scrapeWin.close(); } catch {} resolve(result); } };
    const timeout = setTimeout(() => {
      done({ error: 'timeout', text: '', images: [], title: '' });
    }, 15000);

    scrapeWin.webContents.on('did-finish-load', async () => {
      try {
        await new Promise(r => setTimeout(r, waitMs));

        const result = await scrapeWin.webContents.executeJavaScript(`
          (${JSON.stringify(mode)} === 'minimal-cdp' ? function() {
            window.scrollTo(0, 0);
            const text = String((document.body && document.body.innerText) || '')
              .replace(/\\u00a0/g, ' ')
              .replace(/\\n{3,}/g, '\\n\\n')
              .replace(/[ \\t]{2,}/g, ' ')
              .trim();
            const images = [];
            const ogImg = document.querySelector('meta[property="og:image"]');
            if (ogImg && ogImg.content) images.push(ogImg.content);
            let title = '';
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) title = ogTitle.content;
            if (!title) title = document.title || location.href;
            return {
              text: text.substring(0, 10000),
              images,
              title: String(title).substring(0, 200),
              url: location.href,
              charCount: text.length,
              method: 'electron_minimal_cdp',
            };
          } : function() {
            window.scrollTo(0, document.body.scrollHeight || 0);
            window.scrollTo(0, 0);

            const selectors = [
              '#newsct_article', '#dic_area', '.se-main-container', '#postViewArea', '.post-view',
              '#article-body', '.article_body', '.article_view', '#news_body', 'article',
              '.detailArea', '.xans-product-detail', '#contents', '#content', 'main'
            ];

            const blockedPatterns = [
              /payment info/i, /exchange info/i, /delivery info/i,
              /결제안내/, /배송 안내/, /교환 및 반품/, /상품문의/, /q&a/i
            ];

            function cleanText(raw) {
              return String(raw || '')
                .replace(/\\u00a0/g, ' ')
                .replace(/\\n{3,}/g, '\\n\\n')
                .replace(/[ \\t]{2,}/g, ' ')
                .trim();
            }

            function scoreText(text, sel) {
              const t = cleanText(text);
              if (!t) return -9999;
              let score = Math.min(t.length, 4000);
              if (sel && /detailArea|xans-product-detail|contents|content/i.test(sel)) score += 800;
              if (/판매가|소비자가|상품명|옵션|리뷰|후기|상품 정보|추가구성상품/.test(t)) score += 900;
              if (blockedPatterns.some(p => p.test(t))) score -= 700;
              return score;
            }

            let bestText = '';
            let bestScore = -9999;
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              const candidate = el && el.innerText ? el.innerText.trim() : '';
              const score = scoreText(candidate, sel);
              if (score > bestScore) {
                bestScore = score;
                bestText = candidate;
              }
            }

            let text = cleanText(bestText);
            if (!text) text = cleanText(document.body && document.body.innerText);

            const images = [];
            const ogImg = document.querySelector('meta[property="og:image"]');
            if (ogImg && ogImg.content) images.push(ogImg.content);
            document.querySelectorAll('img').forEach(img => {
              const src = img.src || img.dataset.src || '';
              if (src && !src.startsWith('data:') && images.length < 15) {
                if (!/icon|logo|sprite|\\.gif/.test(src.toLowerCase()) && img.offsetWidth > 50) {
                  if (!images.includes(src)) images.push(src);
                }
              }
            });

            let title = '';
            const h1 = document.querySelector('h1');
            if (h1) title = h1.innerText.trim();
            if (!title) { const og = document.querySelector('meta[property="og:title"]'); if (og) title = og.content; }
            if (!title) title = document.title;

            return {
              text: text.substring(0, 10000),
              images,
              title: title.substring(0, 200),
              url: location.href,
              charCount: text.length,
              method: 'electron_full',
            };
          })();
        `);
        done(result);
      } catch (err) {
        done({ error: err.message, text: '', images: [], title: '' });
      }
    });

    scrapeWin.webContents.on('did-fail-load', () => {
      done({ error: 'load failed', text: '', images: [], title: '' });
    });

    scrapeWin.loadURL(url);
  });
});

ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('backend-status', async () => {
  const reachable = await isServerReachable();
  return {
    ok: true,
    reachable,
    port: PORT,
    pid: backendProcess ? backendProcess.pid : null,
    managed: !!backendProcess,
    restarting: backendRestarting,
    runtime: currentBackendRuntime,
    requestedRuntime: REQUESTED_BACKEND_RUNTIME,
  };
});

ipcMain.handle('backend-restart', async () => {
  return restartBackendServer(true);
});

ipcMain.handle('media-tools-status', async () => {
  return getMediaToolsStatus();
});

ipcMain.handle('media-tools-install', async () => {
  try {
    return await installBundledMediaTools();
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('app-version', async () => {
  return app.getVersion();
});

ipcMain.handle('open-external-url', async (event, url, options = {}) => {
  return { opened: openExternalUrl(url, options) };
});

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
});

ipcMain.handle('app-update-check', async () => ({
  ok: true,
  currentVersion: String(app.getVersion() || '').replace(/^v/i, ''),
  available: false,
  automaticUpdates: false,
  sourceUrl: 'https://github.com/johunsang/makeke-opensource/releases',
}));

app.whenReady().then(async () => {
  // 개발 모드에서만 캐시 클리어
  if (isDev) {
    const { session } = require('electron');
    await session.defaultSession.clearCache();
    console.log('[Electron] 캐시 클리어 완료');
  }

  createMenu();
  createWindow();
  createServerLogWindow();

  // 패키징 앱은 외부 개발 서버를 재사용하지 않고 항상 자체 서버를 띄운다.
  const serverAlreadyRunning = await isServerReachable();
  const runningRuntime = serverAlreadyRunning ? await getRunningBackendRuntime() : '';
  const runtimeCompatible = !serverAlreadyRunning
    ? false
    : REQUESTED_BACKEND_RUNTIME === 'auto'
      ? true
      : runningRuntime === REQUESTED_BACKEND_RUNTIME;

  if (serverAlreadyRunning && isDev && runtimeCompatible) {
    console.log(`[Electron] 기존 백엔드 서버 재사용 (${runningRuntime || 'unknown'})`);
    currentBackendRuntime = runningRuntime || currentBackendRuntime;
  } else {
    if (serverAlreadyRunning) {
      const reason = !isDev
        ? '패키징 앱 전용 서버로 교체'
        : `요청 런타임(${REQUESTED_BACKEND_RUNTIME})과 실행 중 서버(${runningRuntime || 'unknown'})가 달라 교체`;
      console.log(`[Electron] 기존 ${PORT} 서버 감지 → ${reason}`);
      appendServerLog(`replace existing backend runtime=${runningRuntime || 'unknown'} reason=${reason}`);
      killServerOnPort();
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    startBackendServer();
  }

  try {
    await waitForServer(SERVER_START_RETRIES);
    console.log(`[Electron] ${currentBackendRuntime} 서버 준비 완료!`);
    mainWindow.loadURL(getAppUrl());
    if (enableServerWatchdog) {
      startServerWatchdog();
    } else {
      console.log('[Electron] 서버 워치독 비활성화');
    }

    if (autoLaunchChromeOnStartup) {
      console.log('[Electron] Chrome 자동 실행 활성화');
      setTimeout(() => { checkDefaultBrowser(); launchChrome(); }, 2000);
    } else {
      console.log('[Electron] Chrome 자동 실행 비활성화');
    }
  } catch (e) {
    console.error('[Electron] 서버 시작 실패:', e);
    appendServerLog(`startup failed ${e?.message || e}`);
    createServerLogWindow(true);
    try {
      console.log('[Electron] 서버 시작 재시도');
      await restartBackendServer(true);
      await waitForServer(Math.max(20, Math.floor(SERVER_RESTART_RETRIES * 0.66)));
      console.log(`[Electron] ${currentBackendRuntime} 서버 재시도 후 준비 완료!`);
      mainWindow.loadURL(getAppUrl());
      if (enableServerWatchdog) {
        startServerWatchdog();
      }
      return;
    } catch (retryError) {
      console.error('[Electron] 서버 재시도 실패:', retryError);
      appendServerLog(`startup retry failed ${retryError?.message || retryError}`);
    }
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
      <body style="background:#f5f5f7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:-apple-system,sans-serif;">
        <div style="text-align:center;color:#e0e6ed;">
          <h1 style="font-size:24px;color:#e05c5c;">서버 시작 실패</h1>
          <p style="color:#6b7f8e;font-size:14px;margin-top:12px;">백엔드 서버를 시작하지 못했습니다. 서버 로그 창을 함께 확인해주세요.</p>
          <p style="color:#6b7f8e;font-size:12px;margin-top:8px;">로그 위치: ${SERVER_LOG_FILE.replace(/\\/g, '\\\\')}</p>
        </div>
      </body>
      </html>
    `);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 앱 종료 시 백엔드 서버 + Chrome 강제 종료
app.on('before-quit', () => {
  isQuitting = true;
  _writeCrashLog('app-quit', { message: `앱 정상 종료 (version=${app.getVersion()})` });
  if (serverWatchdog) {
    clearInterval(serverWatchdog);
    serverWatchdog = null;
  }
  if (backendProcess) {
    console.log('[Electron] 백엔드 서버 종료 중...');
    try { backendProcess.kill('SIGTERM'); } catch {}
    // 1초 후에도 안 죽으면 강제 종료
    setTimeout(() => {
      try { backendProcess && backendProcess.kill('SIGKILL'); } catch {}
    }, 1000);
    // 백엔드 포트 점유 프로세스도 확실히 종료
    try {
      if (process.platform === 'win32') {
        execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /PID %a /F 2>nul`, { timeout: 3000, shell: 'cmd.exe' });
      } else {
        execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { timeout: 3000 });
      }
    } catch {}
  }
  if (chromeProcess) {
    console.log('[Electron] Chrome 종료 중...');
    try { chromeProcess.kill('SIGTERM'); } catch {}
  }
});

app.on('window-all-closed', () => {
  console.log('[Electron] window-all-closed -> app.quit()');
  if (!isQuitting) app.quit();
});
