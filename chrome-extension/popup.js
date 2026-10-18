// 마케케 팝업 — 연결 토글 + 사이트 제외 관리

let currentDomain = '';

// 현재 탭 도메인 가져오기
chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
  if (tabs[0] && tabs[0].url) {
    try {
      const url = new URL(tabs[0].url);
      currentDomain = url.hostname;
      document.getElementById('current-site').textContent = currentDomain || tabs[0].url;
    } catch {
      document.getElementById('current-site').textContent = tabs[0].url || '알 수 없음';
    }
  }
  updateExcludeButton();
});

// 연결 상태 확인
chrome.runtime.sendMessage({ action: 'getStatus' }, function(resp) {
  renderConnectionState(!!(resp && resp.connected));
});

function renderConnectionState(connected) {
  if (connected) {
    document.getElementById('conn-status').textContent = '자동 연결됨';
    document.getElementById('conn-status').className = 'status on';
    document.getElementById('btn-toggle').textContent = '다시 확인';
    document.getElementById('btn-toggle').className = 'btn btn-connect';
  } else {
    document.getElementById('conn-status').textContent = '자동 연결 대기';
    document.getElementById('conn-status').className = 'status off';
    document.getElementById('btn-toggle').textContent = '연결 재시도';
    document.getElementById('btn-toggle').className = 'btn btn-connect';
  }
}

// 연결 재시도
document.getElementById('btn-toggle').addEventListener('click', function() {
  chrome.runtime.sendMessage({ action: 'retryConnection' }, function(resp) {
    renderConnectionState(!!(resp && resp.connected));
  });
});

// 제외 버튼
document.getElementById('btn-exclude').addEventListener('click', function() {
  if (!currentDomain) return;

  chrome.storage.local.get({ excludedSites: [] }, function(data) {
    const list = data.excludedSites || [];
    const idx = list.indexOf(currentDomain);
    if (idx >= 0) {
      // 이미 제외됨 → 복원
      list.splice(idx, 1);
    } else {
      // 제외 추가
      list.push(currentDomain);
    }
    chrome.storage.local.set({ excludedSites: list }, function() {
      updateExcludeButton();
      renderExcludedList();
    });
  });
});

function updateExcludeButton() {
  if (!currentDomain) return;
  chrome.storage.local.get({ excludedSites: [] }, function(data) {
    const list = data.excludedSites || [];
    const btn = document.getElementById('btn-exclude');
    if (list.includes(currentDomain)) {
      btn.textContent = '이 사이트 제외 해제';
      btn.className = 'btn btn-include';
    } else {
      btn.textContent = '이 사이트 제외하기';
      btn.className = 'btn btn-exclude';
    }
  });
}

// 제외 목록 렌더링
function renderExcludedList() {
  chrome.storage.local.get({ excludedSites: [] }, function(data) {
    const list = data.excludedSites || [];
    const container = document.getElementById('excluded-list');
    if (list.length === 0) {
      container.innerHTML = '<div class="empty">제외된 사이트가 없습니다</div>';
      return;
    }
    container.innerHTML = list.map(function(domain) {
      return '<div class="excluded-item">' +
        '<span class="domain">' + domain + '</span>' +
        '<button class="remove-btn" data-domain="' + domain + '">&times;</button>' +
        '</div>';
    }).join('');

    // 삭제 버튼 이벤트
    container.querySelectorAll('.remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const d = this.getAttribute('data-domain');
        chrome.storage.local.get({ excludedSites: [] }, function(data) {
          const newList = (data.excludedSites || []).filter(function(s) { return s !== d; });
          chrome.storage.local.set({ excludedSites: newList }, function() {
            renderExcludedList();
            updateExcludeButton();
          });
        });
      });
    });
  });
}

renderExcludedList();
