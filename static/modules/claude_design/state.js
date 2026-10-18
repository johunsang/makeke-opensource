// Claude 디자인 — 공용 상태 / 헬퍼
// 분할된 claude_design 모듈이 공유하는 변수/상수/헬퍼를 top-level var 로 두어
// 다른 분할 파일(IIFE) 에서도 자유롭게 읽고 쓸 수 있도록 한다.
// (top-level var 는 window 속성이 되므로 strict 모드 IIFE 에서도 재할당 가능)

// ─── 공용 가변 상태 ─────────────────────────────────────
var _lastHtml = '';
var _lastMeta = {};
var _chatStarted = false;
var _attachedImages = [];   // {name, dataUrl}
var _attachedSources = [];  // [{title, url, snippet, type}]
var _versions = [];         // [{html, meta, ts, prompt}]
var _versionIndex = -1;
var _selectedElement = null;   // {selector, html, text}
var _inlineEditEnabled = true; // 기본 ON (인터랙티브 모드)
var _cdEditUndoStack = [];
var _cdEditRedoStack = [];
var _cdClipboardHtml = '';
var _slideIndex = 0;
var _slideTotal = 0;
var _msgCount = 0;
var _bypassClarify = false;
var _previewFullscreen = false;
var _previewMode = 'fit'; // 's' | 'm' | 'l' | 'fit'
var _previewZoom = 1;
var _currentDesignId = '';
var _cdComments = [];
var _cdCommentMode = false;
var _cdCommentDraftTarget = null;

// ─── 공용 상수 ─────────────────────────────────────────
var _PIXEL_TABLE = {
  '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080],
  '4:3': [1440, 1080], 'A4': [2480, 3508], 'Letter': [2550, 3300],
};
var _SIZE_FACTOR = { 's': 0.4, 'm': 0.7, 'l': 1.0, 'fit': null };

// ─── 공용 헬퍼 ─────────────────────────────────────────
function _esc(s) { return String(s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

if (typeof window !== 'undefined' && typeof window.cdOpenProfileImagePicker !== 'function') {
  window.cdOpenProfileImagePicker = function cdOpenProfileImagePickerFallback() {
    if (typeof toast === 'function') toast('프로필 이미지 선택 기능을 불러오는 중입니다. 잠시 후 다시 눌러주세요.', 'info');
  };
}
