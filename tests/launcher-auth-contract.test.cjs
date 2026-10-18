const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const main = fs.readFileSync('electron/main.js', 'utf8');
const html = fs.readFileSync('static/index.html', 'utf8');
const core = fs.readFileSync('static/modules/index_core.js', 'utf8');
const server = fs.readFileSync('api/internal/httpserver/server.go', 'utf8');
const goModule = fs.readFileSync('api/go.mod', 'utf8');
new vm.Script(main, { filename: 'electron/main.js' });
new vm.Script(core, { filename: 'static/modules/index_core.js' });
assert.ok(main.includes("process.env.MAKEKE_START_PATH || '/'"), 'Makeke must open its core workspace directly');
for (const retired of ['/static/launcher.html', '/static/xiaohongshu.html', '/static/kekelink.html', '/apps/insight', '/apps/seller-booster']) {
  assert.ok(!main.includes(retired), `Electron still launches an add-on: ${retired}`);
  assert.ok(!html.includes(retired), `core UI still opens an add-on: ${retired}`);
}
for (const retired of ['/api/auth/', '/api/access/check', 'login-required-overlay', 'appSyncAuthState', 'openLoginModal']) {
  assert.ok(!html.includes(retired) && !core.includes(retired), `core still requires a product account: ${retired}`);
}
assert.ok(!/insight|seller-booster/.test(goModule), 'core Go module must not depend on add-on applications');
assert.ok(!/registerXiaohongshuRoutes\(mux|registerInsightGateway|registerSellerBoosterGateway/.test(server));
assert.ok(html.includes('data-page="library"') && html.includes('data-page="settings"'), 'core profile/settings menus must remain');
assert.ok(fs.existsSync('chrome-extension/manifest.json'), 'core Chrome collection extension must remain');
console.log('Makeke opens its core workspace directly without product login or add-on applications');
