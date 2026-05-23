let currentTab = 'board';
let consultations = [];
let knownIds = new Set();
let selectedItem = null;

// 페이지 로드 시 시작
document.addEventListener("DOMContentLoaded", () => {
  switchTab('board');
  loadSettings();
  
  // 첫 동기화 및 3초 간격 폴링 시작
  syncData();
  setInterval(syncData, 3000);
});

// 탭 스위칭
function switchTab(tab) {
  currentTab = tab;
  
  const boardContent = document.getElementById('tab-board-content');
  const settingsContent = document.getElementById('tab-settings-content');
  const menuBoard = document.getElementById('menu-board');
  const menuSettings = document.getElementById('menu-settings');

  if (tab === 'board') {
    boardContent.style.display = 'block';
    settingsContent.style.display = 'none';
    menuBoard.classList.add('active');
    menuSettings.classList.remove('active');
  } else {
    boardContent.style.display = 'none';
    settingsContent.style.display = 'block';
    menuBoard.classList.remove('active');
    menuSettings.classList.add('active');
  }
}

// 실시간 데이터 동기화
async function syncData() {
  try {
    const res = await fetch('/api/consultations');
    if (!res.ok) throw new Error("서버 응답 오류");
    
    const data = await res.json();
    consultations = data;
    
    // 신규 접수 건 여부 및 긴급 포함 여부 판단 (알림음 & 쉐이크 효과)
    let hasNew = false;
    let hasEmergency = false;
    data.forEach(item => {
      if (!knownIds.has(item.id)) {
        knownIds.add(item.id);
        hasNew = true;
        if (item.isEmergency) {
          hasEmergency = true;
        }
      }
    });

    // 최초 로드 시에는 소리가 울리지 않도록 knownIds 크기로 체크
    if (hasNew && knownIds.size > data.length) {
      triggerNotificationAlert(hasEmergency);
    }

    renderKanbanBoard();
    
    // 만약 상세 모달이 열려 있다면 해당 데이터 실시간 업데이트
    if (selectedItem) {
      const updated = data.find(c => c.id === selectedItem.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedItem)) {
        selectedItem = updated;
        updateModalContent();
      }
    }

    document.getElementById('network-status').textContent = "● 실시간 연결 중";
    document.getElementById('network-status').style.color = "var(--accent)";

  } catch (error) {
    console.error("데이터 동기화 실패:", error);
    document.getElementById('network-status').textContent = "● 연결 불안정";
    document.getElementById('network-status').style.color = "var(--status-pending)";
  }
}

// 알림 효과 실행 (긴급 시 비상 사이렌 소리 연동)
function triggerNotificationAlert(isEmergency = false) {
  const normalSound = document.getElementById('alert-sound');
  const emergencySound = document.getElementById('emergency-sound');
  
  if (isEmergency && emergencySound) {
    emergencySound.currentTime = 0;
    emergencySound.volume = 1.0; // 비상 사이렌 최대 음량
    emergencySound.play().catch(e => console.log("자동재생 정책으로 인해 사용자의 첫 클릭 후 활성화됩니다."));
  } else if (normalSound) {
    normalSound.currentTime = 0;
    normalSound.play().catch(e => console.log("자동재생 정책으로 인해 사용자의 첫 클릭 후 활성화됩니다."));
  }

  // 대시보드 바디 진동/쉐이크
  const mainSec = document.getElementById('admin-main-section');
  if (mainSec) {
    mainSec.classList.add('sound-effect-triggered');
    setTimeout(() => {
      mainSec.classList.remove('sound-effect-triggered');
    }, 600);
  }
}

// 칸반 보드 그리기
function renderKanbanBoard() {
  const columns = {
    '접수완료': { list: document.getElementById('column-pending-list'), badge: document.getElementById('count-pending'), count: 0 },
    '방문확정': { list: document.getElementById('column-confirmed-list'), badge: document.getElementById('count-confirmed'), count: 0 },
    '시공중': { list: document.getElementById('column-ongoing-list'), badge: document.getElementById('count-ongoing'), count: 0 },
    '완료': { list: document.getElementById('column-completed-list'), badge: document.getElementById('count-completed'), count: 0 }
  };

  // 초기화
  Object.keys(columns).forEach(key => {
    columns[key].list.innerHTML = '';
  });

  // 카드 채우기
  consultations.forEach(item => {
    const col = columns[item.status];
    if (!col) return;

    col.count++;
    
    const card = document.createElement('div');
    // 🌟 긴급 건일 경우 emergency-mode 클래스 추가
    card.className = `consultation-card ${item.isEmergency ? 'emergency-mode' : ''}`;
    card.onclick = () => openModal(item);

    // 카드 마크업 생성
    let tagClass = 'tag-pending';
    if (item.status === '방문확정') tagClass = 'tag-confirmed';
    else if (item.status === '시공중') tagClass = 'tag-ongoing';
    else if (item.status === '완료') tagClass = 'tag-completed';

    // AI 요약 첫째 줄만 가져오기
    const aiLines = item.aiSummary.split('\n');
    const firstLineSummary = aiLines.find(l => l.includes('-')) || `${item.location} - ${item.symptom}`;

    // 🌟 긴급 뱃지 태그 결합
    const emergencyTag = item.isEmergency ? `<span class="card-tag tag-emergency">🚨 긴급 당일</span>` : '';

    card.innerHTML = `
      <div class="card-header">
        <span class="card-client-name">${item.clientName}</span>
        <div style="display:flex; gap: 5px; align-items:center;">
          ${emergencyTag}
          <span class="card-tag ${tagClass}">${item.status}</span>
        </div>
      </div>
      <div class="card-body">
        <div style="font-weight:600;">📞 ${item.clientPhone}</div>
        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${item.address}</div>
        <div style="font-weight: 600; color: ${item.isEmergency ? '#ef4444' : 'var(--primary)'}; font-size: 0.85rem; margin-top: 4px;">
          🕒 ${item.isEmergency ? '🚨 당일 즉시 긴급 출동 요청 건' : `방문요청: ${item.reservedDate} (${item.reservedTime})`}
        </div>
        <div class="card-summary-preview" style="${item.isEmergency ? 'background:rgba(239,68,68,0.06); border-left-color:#ef4444;' : ''}">
          🤖 AI 접수: ${firstLineSummary.replace('- ', '').trim()}
        </div>
      </div>
    `;

    // 🌟 긴급 카드는 맨 위에 노출되게 prepend하고 일반 카드는 append한다!
    if (item.isEmergency) {
      col.list.prepend(card);
    } else {
      col.list.appendChild(card);
    }
  });

  // 카운트 배지 갱신
  Object.keys(columns).forEach(key => {
    columns[key].badge.textContent = columns[key].count;
    if (columns[key].count === 0) {
      columns[key].list.innerHTML = `
        <div style="text-align:center; padding: 40px 10px; color: var(--text-muted); font-size: 0.85rem; border: 1px dashed var(--border-glass); border-radius: 16px;">
          상담이 없습니다.
        </div>
      `;
    }
  });
}

// 상세 모달 오픈
function openModal(item) {
  selectedItem = item;
  const modal = document.getElementById('detail-modal');
  modal.classList.add('active');
  updateModalContent();
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('detail-modal') || typeof e === 'string') {
    document.getElementById('detail-modal').classList.remove('active');
    selectedItem = null;
  }
}

// 모달 내용 갱신
function updateModalContent() {
  if (!selectedItem) return;

  const item = selectedItem;
  
  document.getElementById('modal-client-name').textContent = `${item.clientName} 고객님 상담서`;
  document.getElementById('modal-phone').innerHTML = `<a href="tel:${item.clientPhone}" style="color:var(--text-main); text-decoration:none;">📞 ${item.clientPhone}</a>`;
  document.getElementById('modal-address').textContent = item.address;
  document.getElementById('modal-reserved-time').innerHTML = item.isEmergency 
    ? `<span style="color:#ef4444; font-weight:700;">🚨 긴급 당일 즉시 방문 요청 (긴급 출장비 150,000원 발생 동의완료)</span>`
    : `${item.reservedDate} (${item.reservedTime})`;
  document.getElementById('modal-location').textContent = item.location;
  document.getElementById('modal-symptom').textContent = item.symptom;
  document.getElementById('modal-details').textContent = item.details || '상세 입력 내용 없음';

  // 상태 배지 클래스 맞추기
  const badge = document.getElementById('modal-status-badge');
  badge.textContent = item.isEmergency ? `🚨 긴급 당일 (${item.status})` : item.status;
  badge.className = 'card-tag';
  if (item.isEmergency) badge.classList.add('tag-emergency');
  else if (item.status === '접수완료') badge.classList.add('tag-pending');
  else if (item.status === '방문확정') badge.classList.add('tag-confirmed');
  else if (item.status === '시공중') badge.classList.add('tag-ongoing');
  else if (item.status === '완료') badge.classList.add('tag-completed');

  // 사진 표시
  const photoImg = document.getElementById('modal-photo-img');
  if (item.photoUrl) {
    photoImg.src = item.photoUrl;
    photoImg.style.display = 'block';
  } else {
    photoImg.style.display = 'none';
    photoImg.src = '';
  }

  // AI 요약 렌더링 (마크다운 파싱)
  let formattedSummary = item.aiSummary
    .replace(/\n/g, '<br>')
    .replace(/###\s*(.*)/g, '<h4 style="margin: 15px 0 8px; color:var(--primary); font-size:1.05rem; font-weight:600;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  
  document.getElementById('modal-ai-summary').innerHTML = formattedSummary;

  // 상태 변경 버튼들 매핑
  const btnBox = document.getElementById('action-buttons-box');
  btnBox.innerHTML = '';

  if (item.status === '접수완료') {
    btnBox.innerHTML = `
      <button class="btn-premium" style="flex:1;" onclick="updateStatus('${item.id}', '방문확정')">📅 방문 예약 확정</button>
      <button class="btn-premium btn-secondary" onclick="updateStatus('${item.id}', '완료')">보관</button>
    `;
  } else if (item.status === '방문확정') {
    btnBox.innerHTML = `
      <button class="btn-premium" style="flex:1;" onclick="updateStatus('${item.id}', '시공중')">⚡ 시공 개시</button>
      <button class="btn-premium btn-secondary" onclick="updateStatus('${item.id}', '접수완료')">접수로 강등</button>
    `;
  } else if (item.status === '시공중') {
    btnBox.innerHTML = `
      <button class="btn-premium" style="flex:1; background:linear-gradient(135deg, var(--accent), #049f75);" onclick="updateStatus('${item.id}', '완료')">🎉 시공 완료 완료!</button>
      <button class="btn-premium btn-secondary" onclick="updateStatus('${item.id}', '방문확정')">방문으로 격하</button>
    `;
  } else if (item.status === '완료') {
    btnBox.innerHTML = `
      <div style="color:var(--accent); font-weight:600; padding:10px;">✅ 최종 완료 및 시공 종결 건입니다.</div>
      <button class="btn-premium btn-secondary" onclick="updateStatus('${item.id}', '시공중')">재작업 개시</button>
    `;
  }
}

// 상태 업데이트 요청 API
async function updateStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/consultations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (res.ok) {
      const updated = await res.json();
      selectedItem = updated;
      
      // 기 선택된 상담 객체 로컬 동기화
      const localIdx = consultations.findIndex(c => c.id === id);
      if (localIdx !== -1) consultations[localIdx] = updated;

      updateModalContent();
      renderKanbanBoard();
    } else {
      alert("상태 업데이트에 실패했습니다.");
    }
  } catch (error) {
    console.error(error);
    alert("서버 통신 실패");
  }
}

// 설정 불러오기
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error();
    
    const settings = await res.json();
    
    document.getElementById('travelFee').value = settings.travelFee;
    document.getElementById('availableHours').value = settings.availableHours.join(', ');
    document.getElementById('smsTemplate').value = settings.smsTemplate;

    // 요일 체크박스 채우기
    const checkboxes = document.querySelectorAll('input[name="availableDays"]');
    checkboxes.forEach(box => {
      box.checked = settings.availableDays.includes(box.value);
    });

  } catch (error) {
    console.error("설정을 불러오지 못했습니다.", error);
  }
}

// 설정 저장
async function saveSettings() {
  const travelFee = document.getElementById('travelFee').value.trim();
  const availableHoursInput = document.getElementById('availableHours').value;
  const smsTemplate = document.getElementById('smsTemplate').value.trim();

  // 시간 파싱
  const availableHours = availableHoursInput.split(',')
    .map(h => h.trim())
    .filter(h => h.length > 0);

  // 요일 파싱
  const availableDays = [];
  const checkboxes = document.querySelectorAll('input[name="availableDays"]:checked');
  checkboxes.forEach(box => {
    availableDays.push(box.value);
  });

  const payload = {
    travelFee,
    availableDays,
    availableHours,
    smsTemplate
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert("설정이 성공적으로 저장되었습니다!");
      loadSettings();
    } else {
      alert("설정 저장에 실패했습니다.");
    }
  } catch (error) {
    console.error(error);
    alert("서버 연결 실패");
  }
}
