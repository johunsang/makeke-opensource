// Remove retired Makeke product sessions only. Provider/SNS accounts remain untouched.
(function() {
  'use strict';
  const retiredKeys = ['makeke_token', 'makeke_support_email', 'makeke_support_name', '_makeke_auth_cache', 'makeke_agreed', 'makeke_marketing'];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    retiredKeys.forEach(key => storage.removeItem(key));
  }
  ['makeke_token', 'sb_auth'].forEach(name => {
    document.cookie = name + '=; path=/; max-age=0; SameSite=Lax';
  });
})();
