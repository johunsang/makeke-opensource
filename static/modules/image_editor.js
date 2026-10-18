// ============================================================
// 이미지 편집기 (Image Editor)
// ============================================================

let _imgEditor = {
  canvas: null,
  ctx: null,
  overlay: null,
  overlayCtx: null,
  originalImage: null,  // HTMLImageElement - 원본
  currentImage: null,   // HTMLImageElement - 현재 상태
  history: [],          // dataURL 배열
  historyIdx: -1,
  activeTool: null,
  onSave: null,         // callback(url) when saved
  context: '',          // 저장 컨텍스트
  // 크롭 상태
  crop: { active: false, startX: 0, startY: 0, endX: 0, endY: 0, dragging: false },
  // 텍스트 상태
  texts: [],            // [{text, x, y, fontSize, color, dragging}]
  activeTextIdx: -1,
  textDragging: false,
  textDragOffset: { x: 0, y: 0 },
  // 필터 상태
  brightness: 100,
  contrast: 100,
  currentFilter: 'none',
  rotation: 0,
};

function openImageEditor(imageUrl, options = {}) {
  const modal = document.getElementById('imageEditorModal');
  modal.style.display = 'block';
  _imgEditor.onSave = options.onSave || null;
  _imgEditor.context = options.context || 'general';
  _imgEditor.activeTool = null;
  _imgEditor.texts = [];
  _imgEditor.activeTextIdx = -1;
  _imgEditor.brightness = 100;
  _imgEditor.contrast = 100;
  _imgEditor.currentFilter = 'none';
  _imgEditor.rotation = 0;
  _imgEditor.history = [];
  _imgEditor.historyIdx = -1;
  _imgEditor.crop = { active: false, startX: 0, startY: 0, endX: 0, endY: 0, dragging: false };

  // 도구 선택 해제
  document.querySelectorAll('.ie-tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ie-tool-options').innerHTML = '<div style="text-align:center;padding:20px;color:#555;font-size:12px;">도구를 선택하세요</div>';

  _imgEditor.canvas = document.getElementById('ie-canvas');
  _imgEditor.ctx = _imgEditor.canvas.getContext('2d');
  _imgEditor.overlay = document.getElementById('ie-overlay');
  _imgEditor.overlayCtx = _imgEditor.overlay.getContext('2d');

  // 이미지 로드 (CORS 문제 방지: 로컬 이미지는 crossOrigin 없이 로드)
  const isLocal = imageUrl.startsWith('/') || imageUrl.startsWith(location.origin);
  const img = new Image();
  if (!isLocal) img.crossOrigin = 'anonymous';

  function onImageLoaded(loadedImg) {
    _imgEditor.originalImage = loadedImg;
    _imgEditor.currentImage = loadedImg;
    ieResizeCanvas(loadedImg.width, loadedImg.height);
    ieDrawImage();
    iePushHistory();
    ieUpdateUndoRedo();
  }

  img.onload = function() { onImageLoaded(img); };
  img.onerror = function() {
    console.log('[ImageEditor] 이미지 로드 실패, 재시도:', imageUrl);
    // CORS 없이 + 캐시 우회 재시도
    const img2 = new Image();
    img2.onload = function() { onImageLoaded(img2); };
    img2.onerror = function() {
      console.error('[ImageEditor] 이미지 로드 최종 실패:', imageUrl);
      toast('이미지를 불러올 수 없습니다: ' + imageUrl.substring(0, 60), 'error');
    };
    img2.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
  };
  // URL 인코딩 보장
  img.src = imageUrl.includes('%') ? imageUrl : encImg(imageUrl);

  // 캔버스 이벤트 등록
  _imgEditor.canvas.onmousedown = ieCanvasMouseDown;
  _imgEditor.canvas.onmousemove = ieCanvasMouseMove;
  _imgEditor.canvas.onmouseup = ieCanvasMouseUp;
}

function closeImageEditor() {
  document.getElementById('imageEditorModal').style.display = 'none';
  _imgEditor.canvas.onmousedown = null;
  _imgEditor.canvas.onmousemove = null;
  _imgEditor.canvas.onmouseup = null;
  _imgEditor.overlayCtx.clearRect(0, 0, _imgEditor.overlay.width, _imgEditor.overlay.height);
}

function ieResizeCanvas(w, h) {
  const wrapper = document.getElementById('ie-canvas-wrapper');
  const container = document.getElementById('ie-canvas-container');
  const maxW = wrapper.clientWidth - 40;
  const maxH = wrapper.clientHeight - 40;
  let scale = 1;
  if (w > maxW || h > maxH) {
    scale = Math.min(maxW / w, maxH / h);
  }
  const displayW = Math.round(w * scale);
  const displayH = Math.round(h * scale);

  // 캔버스 원본 크기
  _imgEditor.canvas.width = w;
  _imgEditor.canvas.height = h;
  _imgEditor.canvas.style.width = displayW + 'px';
  _imgEditor.canvas.style.height = displayH + 'px';

  // 오버레이 — 캔버스와 동일한 내부 해상도 + CSS 크기
  _imgEditor.overlay.width = w;
  _imgEditor.overlay.height = h;
  _imgEditor.overlay.style.width = displayW + 'px';
  _imgEditor.overlay.style.height = displayH + 'px';

  // 컨테이너 크기 맞춤
  container.style.width = displayW + 'px';
  container.style.height = displayH + 'px';
}

function ieDrawImage() {
  const { ctx, canvas, currentImage, brightness, contrast, currentFilter, texts } = _imgEditor;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 필터 설정
  let filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
  if (currentFilter === 'grayscale') filterStr += ' grayscale(100%)';
  else if (currentFilter === 'sepia') filterStr += ' sepia(100%)';
  else if (currentFilter === 'blur') filterStr += ' blur(2px)';
  else if (currentFilter === 'vintage') filterStr += ' sepia(40%) contrast(85%) brightness(110%)';
  ctx.filter = filterStr;
  ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  // 샤프닝은 CSS filter에 없으므로 컨볼루션으로 처리
  if (currentFilter === 'sharpen') {
    ieSharpen();
  }

  // 텍스트 오버레이 그리기
  texts.forEach((t, i) => {
    ctx.font = `${t.fontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = 'top';
    // 배경
    const metrics = ctx.measureText(t.text);
    const textH = t.fontSize * 1.2;
    if (i === _imgEditor.activeTextIdx) {
      ctx.strokeStyle = '#4fc08d';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(t.x - 4, t.y - 4, metrics.width + 8, textH + 8);
      ctx.setLineDash([]);
    }
    ctx.fillText(t.text, t.x, t.y);
  });
}

function ieSharpen() {
  const { ctx, canvas } = _imgEditor;
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  // 3x3 sharpen kernel
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            val += copy[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        data[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function ieGetCanvasCoords(e) {
  const rect = _imgEditor.canvas.getBoundingClientRect();
  const scaleX = _imgEditor.canvas.width / rect.width;
  const scaleY = _imgEditor.canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

// ---- 캔버스 이벤트 ----
function ieCanvasMouseDown(e) {
  const pos = ieGetCanvasCoords(e);

  if (_imgEditor.activeTool === 'crop') {
    _imgEditor.crop.dragging = true;
    _imgEditor.crop.startX = pos.x;
    _imgEditor.crop.startY = pos.y;
    _imgEditor.crop.endX = pos.x;
    _imgEditor.crop.endY = pos.y;
    _imgEditor.canvas.style.cursor = 'crosshair';
  } else if (_imgEditor.activeTool === 'text') {
    // 기존 텍스트 클릭 확인
    let found = -1;
    const ctx = _imgEditor.ctx;
    for (let i = _imgEditor.texts.length - 1; i >= 0; i--) {
      const t = _imgEditor.texts[i];
      ctx.font = `${t.fontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
      const metrics = ctx.measureText(t.text);
      const textH = t.fontSize * 1.2;
      if (pos.x >= t.x && pos.x <= t.x + metrics.width && pos.y >= t.y && pos.y <= t.y + textH) {
        found = i;
        break;
      }
    }
    if (found >= 0) {
      _imgEditor.activeTextIdx = found;
      _imgEditor.textDragging = true;
      _imgEditor.textDragOffset = {
        x: pos.x - _imgEditor.texts[found].x,
        y: pos.y - _imgEditor.texts[found].y,
      };
      _imgEditor.canvas.style.cursor = 'move';
    } else {
      // 새 텍스트 추가
      const text = document.getElementById('ie-text-input')?.value || '텍스트';
      const fontSize = parseInt(document.getElementById('ie-text-size')?.value || '32');
      const color = document.getElementById('ie-text-color')?.value || '#ffffff';
      _imgEditor.texts.push({ text, x: pos.x, y: pos.y, fontSize, color });
      _imgEditor.activeTextIdx = _imgEditor.texts.length - 1;
      iePushHistory();
    }
    ieDrawImage();
  }
}

function ieCanvasMouseMove(e) {
  const pos = ieGetCanvasCoords(e);

  if (_imgEditor.activeTool === 'crop' && _imgEditor.crop.dragging) {
    _imgEditor.crop.endX = pos.x;
    _imgEditor.crop.endY = pos.y;
    ieDrawCropOverlay();
  } else if (_imgEditor.textDragging && _imgEditor.activeTextIdx >= 0) {
    const t = _imgEditor.texts[_imgEditor.activeTextIdx];
    t.x = pos.x - _imgEditor.textDragOffset.x;
    t.y = pos.y - _imgEditor.textDragOffset.y;
    ieDrawImage();
  }
}

function ieCanvasMouseUp(e) {
  if (_imgEditor.activeTool === 'crop' && _imgEditor.crop.dragging) {
    _imgEditor.crop.dragging = false;
    _imgEditor.crop.active = true;
    ieDrawCropOverlay();
  }
  if (_imgEditor.textDragging) {
    _imgEditor.textDragging = false;
    _imgEditor.canvas.style.cursor = 'crosshair';
    iePushHistory();
  }
}

function ieDrawCropOverlay() {
  const { overlayCtx, overlay, crop } = _imgEditor;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  const x = Math.min(crop.startX, crop.endX);
  const y = Math.min(crop.startY, crop.endY);
  const w = Math.abs(crop.endX - crop.startX);
  const h = Math.abs(crop.endY - crop.startY);

  if (w < 2 || h < 2) return;

  // 어두운 오버레이
  overlayCtx.fillStyle = 'rgba(0,0,0,0.5)';
  overlayCtx.fillRect(0, 0, overlay.width, overlay.height);
  // 선택 영역 투명하게
  overlayCtx.clearRect(x, y, w, h);
  // 점선 테두리
  overlayCtx.strokeStyle = '#4fc08d';
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([6, 4]);
  overlayCtx.strokeRect(x, y, w, h);
  overlayCtx.setLineDash([]);
  // 크기 표시
  overlayCtx.fillStyle = '#4fc08d';
  overlayCtx.font = '14px sans-serif';
  overlayCtx.fillText(`${Math.round(w)} x ${Math.round(h)}`, x + 4, y - 8);
}

// ---- 도구 선택 ----
function ieSelectTool(tool) {
  _imgEditor.activeTool = tool;
  document.querySelectorAll('.ie-tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
  // 크롭 오버레이 클리어
  _imgEditor.overlayCtx.clearRect(0, 0, _imgEditor.overlay.width, _imgEditor.overlay.height);
  _imgEditor.crop.active = false;
  _imgEditor.overlay.style.pointerEvents = (tool === 'crop') ? 'none' : 'none';

  const optDiv = document.getElementById('ie-tool-options');

  switch (tool) {
    case 'crop':
      optDiv.innerHTML = `
        <label class="ie-option-label">드래그하여 영역 선택</label>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn btn-sm btn-primary" onclick="ieApplyCrop()" style="flex:1;">자르기 적용</button>
          <button class="btn btn-sm btn-secondary" onclick="ieCancelCrop()" style="flex:1;">취소</button>
        </div>
      `;
      _imgEditor.canvas.style.cursor = 'crosshair';
      break;

    case 'resize':
      optDiv.innerHTML = `
        <label class="ie-option-label">너비 (px)</label>
        <input type="number" id="ie-resize-w" class="ie-input" value="${_imgEditor.canvas.width}" style="margin-bottom:8px;">
        <label class="ie-option-label">높이 (px)</label>
        <input type="number" id="ie-resize-h" class="ie-input" value="${_imgEditor.canvas.height}" style="margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <input type="checkbox" id="ie-resize-lock" checked>
          <label for="ie-resize-lock" style="font-size:12px;color:#aaa;cursor:pointer;">비율 유지</label>
        </div>
        <button class="btn btn-sm btn-primary" onclick="ieApplyResize()" style="width:100%;">크기 변경</button>
      `;
      // 비율 유지 로직
      const wInput = document.getElementById('ie-resize-w');
      const hInput = document.getElementById('ie-resize-h');
      const ratio = _imgEditor.canvas.width / _imgEditor.canvas.height;
      wInput.addEventListener('input', () => {
        if (document.getElementById('ie-resize-lock').checked) {
          hInput.value = Math.round(parseInt(wInput.value) / ratio);
        }
      });
      hInput.addEventListener('input', () => {
        if (document.getElementById('ie-resize-lock').checked) {
          wInput.value = Math.round(parseInt(hInput.value) * ratio);
        }
      });
      _imgEditor.canvas.style.cursor = 'default';
      break;

    case 'rotate':
      optDiv.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button class="btn btn-sm btn-secondary" onclick="ieRotate(-90)" style="flex:1;">90 왼쪽</button>
          <button class="btn btn-sm btn-secondary" onclick="ieRotate(90)" style="flex:1;">90 오른쪽</button>
        </div>
        <label class="ie-option-label">자유 회전: <span id="ie-rotate-val">0</span>도</label>
        <input type="range" class="ie-slider" id="ie-rotate-slider" min="-180" max="180" value="0"
               oninput="document.getElementById('ie-rotate-val').textContent=this.value">
        <button class="btn btn-sm btn-primary" onclick="ieApplyFreeRotate()" style="width:100%;margin-top:8px;">회전 적용</button>
      `;
      _imgEditor.canvas.style.cursor = 'default';
      break;

    case 'brightness':
      optDiv.innerHTML = `
        <label class="ie-option-label">밝기: <span id="ie-bright-val">${_imgEditor.brightness}</span>%</label>
        <input type="range" class="ie-slider" id="ie-bright-slider" min="20" max="200" value="${_imgEditor.brightness}"
               oninput="_imgEditor.brightness=parseInt(this.value);document.getElementById('ie-bright-val').textContent=this.value;ieDrawImage();"
               onchange="iePushHistory();">
        <div style="margin-top:12px;">
          <label class="ie-option-label">대비: <span id="ie-contrast-val">${_imgEditor.contrast}</span>%</label>
          <input type="range" class="ie-slider" id="ie-contrast-slider" min="20" max="200" value="${_imgEditor.contrast}"
                 oninput="_imgEditor.contrast=parseInt(this.value);document.getElementById('ie-contrast-val').textContent=this.value;ieDrawImage();"
                 onchange="iePushHistory();">
        </div>
        <button class="btn btn-sm btn-secondary" onclick="_imgEditor.brightness=100;_imgEditor.contrast=100;ieDrawImage();iePushHistory();ieSelectTool('brightness');" style="width:100%;margin-top:12px;">초기화</button>
      `;
      _imgEditor.canvas.style.cursor = 'default';
      break;

    case 'text':
      optDiv.innerHTML = `
        <label class="ie-option-label">텍스트 내용</label>
        <input type="text" id="ie-text-input" class="ie-input" value="텍스트" placeholder="입력 후 캔버스 클릭" style="margin-bottom:8px;">
        <label class="ie-option-label">글꼴 크기</label>
        <input type="number" id="ie-text-size" class="ie-input" value="32" min="8" max="200" style="margin-bottom:8px;">
        <label class="ie-option-label">색상</label>
        <input type="color" id="ie-text-color" value="#ffffff" style="width:100%;height:32px;border:1px solid #333;border-radius:6px;background:#1a1a1a;cursor:pointer;margin-bottom:8px;">
        <div style="font-size:11px;color:#666;margin-bottom:8px;">캔버스를 클릭하여 텍스트 배치<br>텍스트를 드래그하여 이동</div>
        <button class="btn btn-sm btn-secondary" onclick="ieUpdateActiveText()" style="width:100%;margin-bottom:6px;">선택 텍스트 업데이트</button>
        <button class="btn btn-sm" onclick="ieDeleteActiveText()" style="width:100%;background:#e05c5c;color:#fff;">선택 텍스트 삭제</button>
      `;
      _imgEditor.canvas.style.cursor = 'text';
      break;

    case 'filter':
      const filters = [
        { id: 'none', label: '없음' },
        { id: 'grayscale', label: '흑백' },
        { id: 'sepia', label: '세피아' },
        { id: 'blur', label: '블러' },
        { id: 'sharpen', label: '선명' },
        { id: 'vintage', label: '빈티지' },
      ];
      optDiv.innerHTML = `
        <label class="ie-option-label">필터 선택</label>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${filters.map(f => `
            <button class="ie-filter-btn ${_imgEditor.currentFilter === f.id ? 'active' : ''}"
                    onclick="ieApplyFilter('${f.id}')">${f.label}</button>
          `).join('')}
        </div>
      `;
      _imgEditor.canvas.style.cursor = 'default';
      break;

    case 'watermark':
      optDiv.innerHTML = `
        <label class="ie-option-label">워터마크 이미지</label>
        <input type="file" id="ie-wm-file" accept="image/*" class="ie-input" style="margin-bottom:8px;padding:4px;">
        <label class="ie-option-label">위치</label>
        <select id="ie-wm-position" class="ie-input" style="margin-bottom:8px;">
          <option value="bottom-right">오른쪽 하단</option>
          <option value="bottom-left">왼쪽 하단</option>
          <option value="top-right">오른쪽 상단</option>
          <option value="top-left">왼쪽 상단</option>
          <option value="center">중앙</option>
        </select>
        <label class="ie-option-label">크기: <span id="ie-wm-size-val">20</span>%</label>
        <input type="range" class="ie-slider" id="ie-wm-size" min="5" max="50" value="20"
               oninput="document.getElementById('ie-wm-size-val').textContent=this.value">
        <label class="ie-option-label">투명도: <span id="ie-wm-opacity-val">50</span>%</label>
        <input type="range" class="ie-slider" id="ie-wm-opacity" min="10" max="100" value="50"
               oninput="document.getElementById('ie-wm-opacity-val').textContent=this.value">
        <button class="btn btn-sm btn-primary" onclick="ieApplyWatermark()" style="width:100%;margin-top:8px;">워터마크 적용</button>
      `;
      _imgEditor.canvas.style.cursor = 'default';
      break;
  }
}

// ---- 자르기 ----
function ieApplyCrop() {
  const { crop, canvas, ctx } = _imgEditor;
  if (!crop.active) { toast('먼저 영역을 드래그하여 선택하세요', 'error'); return; }

  const x = Math.min(crop.startX, crop.endX);
  const y = Math.min(crop.startY, crop.endY);
  const w = Math.abs(crop.endX - crop.startX);
  const h = Math.abs(crop.endY - crop.startY);

  if (w < 5 || h < 5) { toast('선택 영역이 너무 작습니다', 'error'); return; }

  // 현재 캔버스에서 잘라내기
  const imageData = ctx.getImageData(x, y, w, h);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCanvas.getContext('2d').putImageData(imageData, 0, 0);

  // 새 이미지로 만들기
  const img = new Image();
  img.onload = () => {
    _imgEditor.currentImage = img;
    ieResizeCanvas(w, h);
    ieDrawImage();
    iePushHistory();
    _imgEditor.overlayCtx.clearRect(0, 0, _imgEditor.overlay.width, _imgEditor.overlay.height);
    _imgEditor.crop.active = false;
  };
  img.src = tempCanvas.toDataURL('image/png');
}

function ieCancelCrop() {
  _imgEditor.crop.active = false;
  _imgEditor.overlayCtx.clearRect(0, 0, _imgEditor.overlay.width, _imgEditor.overlay.height);
}

// ---- 크기 조절 ----
function ieApplyResize() {
  const newW = parseInt(document.getElementById('ie-resize-w').value);
  const newH = parseInt(document.getElementById('ie-resize-h').value);
  if (newW < 10 || newH < 10) { toast('최소 크기는 10px입니다', 'error'); return; }
  if (newW > 8000 || newH > 8000) { toast('최대 크기는 8000px입니다', 'error'); return; }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newW;
  tempCanvas.height = newH;
  const tCtx = tempCanvas.getContext('2d');
  // 현재 캔버스 내용을 새 크기로
  tCtx.drawImage(_imgEditor.canvas, 0, 0, newW, newH);

  const img = new Image();
  img.onload = () => {
    _imgEditor.currentImage = img;
    ieResizeCanvas(newW, newH);
    ieDrawImage();
    iePushHistory();
  };
  img.src = tempCanvas.toDataURL('image/png');
}

// ---- 회전 ----
function ieRotate(deg) {
  const { canvas, ctx } = _imgEditor;
  const tempCanvas = document.createElement('canvas');
  const is90 = (Math.abs(deg) === 90 || Math.abs(deg) === 270);

  if (is90) {
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
  } else {
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
  }

  const tCtx = tempCanvas.getContext('2d');
  tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
  tCtx.rotate(deg * Math.PI / 180);
  tCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  const img = new Image();
  img.onload = () => {
    _imgEditor.currentImage = img;
    ieResizeCanvas(tempCanvas.width, tempCanvas.height);
    ieDrawImage();
    iePushHistory();
  };
  img.src = tempCanvas.toDataURL('image/png');
}

function ieApplyFreeRotate() {
  const deg = parseInt(document.getElementById('ie-rotate-slider').value);
  if (deg === 0) return;

  const { canvas } = _imgEditor;
  const rad = deg * Math.PI / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const newW = Math.round(canvas.width * cos + canvas.height * sin);
  const newH = Math.round(canvas.width * sin + canvas.height * cos);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = newW;
  tempCanvas.height = newH;
  const tCtx = tempCanvas.getContext('2d');
  tCtx.translate(newW / 2, newH / 2);
  tCtx.rotate(rad);
  tCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  const img = new Image();
  img.onload = () => {
    _imgEditor.currentImage = img;
    ieResizeCanvas(newW, newH);
    ieDrawImage();
    iePushHistory();
    document.getElementById('ie-rotate-slider').value = 0;
    document.getElementById('ie-rotate-val').textContent = '0';
  };
  img.src = tempCanvas.toDataURL('image/png');
}

// ---- 필터 ----
function ieApplyFilter(filterId) {
  _imgEditor.currentFilter = filterId;
  ieDrawImage();
  iePushHistory();
  // 버튼 활성화 업데이트
  document.querySelectorAll('.ie-filter-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.ie-filter-btn[onclick="ieApplyFilter('${filterId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

// ---- 텍스트 ----
function ieUpdateActiveText() {
  const idx = _imgEditor.activeTextIdx;
  if (idx < 0 || idx >= _imgEditor.texts.length) { toast('텍스트를 선택하세요', 'error'); return; }
  const t = _imgEditor.texts[idx];
  t.text = document.getElementById('ie-text-input').value || '텍스트';
  t.fontSize = parseInt(document.getElementById('ie-text-size').value || '32');
  t.color = document.getElementById('ie-text-color').value || '#ffffff';
  ieDrawImage();
  iePushHistory();
}

function ieDeleteActiveText() {
  const idx = _imgEditor.activeTextIdx;
  if (idx < 0 || idx >= _imgEditor.texts.length) { toast('텍스트를 선택하세요', 'error'); return; }
  _imgEditor.texts.splice(idx, 1);
  _imgEditor.activeTextIdx = -1;
  ieDrawImage();
  iePushHistory();
}

// ---- 워터마크 ----
function ieApplyWatermark() {
  const fileInput = document.getElementById('ie-wm-file');
  if (!fileInput.files || !fileInput.files[0]) { toast('워터마크 이미지를 선택하세요', 'error'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    const wmImg = new Image();
    wmImg.onload = function() {
      const { canvas, ctx } = _imgEditor;
      const sizePct = parseInt(document.getElementById('ie-wm-size').value) / 100;
      const opacity = parseInt(document.getElementById('ie-wm-opacity').value) / 100;
      const position = document.getElementById('ie-wm-position').value;

      const wmW = Math.round(canvas.width * sizePct);
      const wmH = Math.round((wmImg.height / wmImg.width) * wmW);
      const margin = 20;

      let x = 0, y = 0;
      switch (position) {
        case 'top-left': x = margin; y = margin; break;
        case 'top-right': x = canvas.width - wmW - margin; y = margin; break;
        case 'bottom-left': x = margin; y = canvas.height - wmH - margin; break;
        case 'bottom-right': x = canvas.width - wmW - margin; y = canvas.height - wmH - margin; break;
        case 'center': x = (canvas.width - wmW) / 2; y = (canvas.height - wmH) / 2; break;
      }

      ctx.globalAlpha = opacity;
      ctx.drawImage(wmImg, x, y, wmW, wmH);
      ctx.globalAlpha = 1;

      // 현재 캔버스를 이미지로 변환하여 currentImage 업데이트
      const updatedImg = new Image();
      updatedImg.onload = () => {
        _imgEditor.currentImage = updatedImg;
        iePushHistory();
      };
      updatedImg.src = canvas.toDataURL('image/png');
    };
    wmImg.src = e.target.result;
  };
  reader.readAsDataURL(fileInput.files[0]);
}

// ---- Undo / Redo ----
function iePushHistory() {
  const dataUrl = _imgEditor.canvas.toDataURL('image/png');
  // 현재 위치 이후의 히스토리 제거
  _imgEditor.history = _imgEditor.history.slice(0, _imgEditor.historyIdx + 1);
  _imgEditor.history.push(dataUrl);
  // 최대 20개
  if (_imgEditor.history.length > 20) {
    _imgEditor.history.shift();
  }
  _imgEditor.historyIdx = _imgEditor.history.length - 1;
  ieUpdateUndoRedo();
}

function ieRestoreFromHistory(dataUrl) {
  const img = new Image();
  img.onload = () => {
    _imgEditor.currentImage = img;
    ieResizeCanvas(img.width, img.height);
    _imgEditor.ctx.drawImage(img, 0, 0);
  };
  img.src = dataUrl;
}

function editorUndo() {
  if (_imgEditor.historyIdx <= 0) return;
  _imgEditor.historyIdx--;
  ieRestoreFromHistory(_imgEditor.history[_imgEditor.historyIdx]);
  ieUpdateUndoRedo();
}

function editorRedo() {
  if (_imgEditor.historyIdx >= _imgEditor.history.length - 1) return;
  _imgEditor.historyIdx++;
  ieRestoreFromHistory(_imgEditor.history[_imgEditor.historyIdx]);
  ieUpdateUndoRedo();
}

function ieUpdateUndoRedo() {
  document.getElementById('ie-undo-btn').disabled = _imgEditor.historyIdx <= 0;
  document.getElementById('ie-redo-btn').disabled = _imgEditor.historyIdx >= _imgEditor.history.length - 1;
}

// ---- 원본 복원 ----
function editorReset() {
  if (!confirm('원본 이미지로 복원하시겠습니까?')) return;
  _imgEditor.currentImage = _imgEditor.originalImage;
  _imgEditor.brightness = 100;
  _imgEditor.contrast = 100;
  _imgEditor.currentFilter = 'none';
  _imgEditor.texts = [];
  _imgEditor.activeTextIdx = -1;
  ieResizeCanvas(_imgEditor.originalImage.width, _imgEditor.originalImage.height);
  ieDrawImage();
  iePushHistory();
  toast('원본 이미지로 복원되었습니다.');
}

// ---- 다운로드 ----
function editorDownload() {
  const link = document.createElement('a');
  link.download = `edited_${Date.now()}.png`;
  link.href = _imgEditor.canvas.toDataURL('image/png');
  link.click();
  toast('이미지가 다운로드되었습니다.');
}

// ---- 저장 ----
async function editorSave() {
  const btn = document.getElementById('ie-save-btn');
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const blob = await new Promise(resolve => _imgEditor.canvas.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('file', blob, `edited_${Date.now()}.png`);
    formData.append('context', _imgEditor.context);

    const res = await fetch('/api/image/save', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();

    toast('이미지가 저장되었습니다.');

    if (_imgEditor.onSave) {
      _imgEditor.onSave(data);
    }
    closeImageEditor();
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '저장';
  }
}

// ============================================================
