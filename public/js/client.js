// 전역 데이터 객체
let consultationData = {
  location: '',
  symptom: '',
  photoFile: null
};

let appSettings = {
  travelFee: "30,000",
  availableDays: ["월", "화", "수", "목", "금"],
  availableHours: ["09:00", "11:00", "13:00", "15:00", "17:00"]
};

// 실시간 접수 번호 로컬 보관용 (배열로도 관리하여 다중 접수 목록 지원)
let latestConsultationId = localStorage.getItem('my_consultation_id') || null;
let latestConsultationIds = [];
try {
  latestConsultationIds = JSON.parse(localStorage.getItem('my_consultation_ids') || '[]');
} catch (e) {
  latestConsultationIds = [];
}
if (latestConsultationId && !latestConsultationIds.includes(latestConsultationId)) {
  latestConsultationIds.push(latestConsultationId);
  localStorage.setItem('my_consultation_ids', JSON.stringify(latestConsultationIds));
}

// 돔 로드 시 기본 세팅 및 설정 불러오기
document.addEventListener("DOMContentLoaded", async () => {
  await fetchSettings();
  initCalendar();
  initDragAndDrop();
  
  // 🌟 URL 쿼리 파라미터 (?id=C-xxx 또는 ?ids=C-xxx,C-yyy) 검사하여 존재 시 실시간 추적기 자동 진입
  const urlParams = new URLSearchParams(window.location.search);
  const queryId = urlParams.get('id');
  const queryIds = urlParams.get('ids');
  
  let hasQuery = false;
  
  if (queryIds) {
    hasQuery = true;
    const idList = queryIds.split(',');
    idList.forEach(id => {
      const trimmedId = id.trim();
      if (trimmedId && !latestConsultationIds.includes(trimmedId)) {
        latestConsultationIds.push(trimmedId);
      }
    });
    if (latestConsultationIds.length > 0) {
      latestConsultationId = latestConsultationIds[0];
      localStorage.setItem('my_consultation_id', latestConsultationId);
      localStorage.setItem('my_consultation_ids', JSON.stringify(latestConsultationIds));
    }
  }
  
  if (queryId) {
    hasQuery = true;
    latestConsultationId = queryId;
    localStorage.setItem('my_consultation_id', queryId);
    if (!latestConsultationIds.includes(queryId)) {
      latestConsultationIds.push(queryId);
      localStorage.setItem('my_consultation_ids', JSON.stringify(latestConsultationIds));
    }
  }

  if (hasQuery) {
    openStatusTracker();
  } 
  else if (latestConsultationIds.length > 0) {
    // 기존에 접수했던 내역이 있을 시 메인 첫 화면 퀵 배너 노출
    const banner = document.getElementById('quick-status-banner');
    if (banner) {
      banner.style.display = 'flex';
      const textSpan = banner.querySelector('span');
      if (textSpan) {
        textSpan.textContent = `📝 접수하신 내역이 ${latestConsultationIds.length}건 있습니다.`;
      }
    }
  }
});

// 설정 로드
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      appSettings = await res.json();
      document.getElementById('travel-fee-display').textContent = appSettings.travelFee;
    }
  } catch (error) {
    console.error("설정 로드 실패:", error);
  }
}

// 🌟 일반 vs 긴급 스위칭 제어
let isEmergencyMode = false;

function toggleConsultationType(type) {
  const tabNormal = document.getElementById('tab-normal-type');
  const tabEmergency = document.getElementById('tab-emergency-type');
  const emergencyForm = document.getElementById('emergency-form-section');
  const nextBtn = document.getElementById('btn-step1-next');
  
  if (type === 'emergency') {
    isEmergencyMode = true;
    tabNormal.classList.add('btn-secondary');
    tabNormal.style.background = 'rgba(255,255,255,0.05)';
    
    tabEmergency.classList.remove('btn-secondary');
    tabEmergency.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
    tabEmergency.style.color = '#fff';
    
    // 긴급 폼 노출 및 다음단계 버튼 숨김
    emergencyForm.style.display = 'block';
    nextBtn.style.display = 'none';
    
    // AI 말풍선 경고 고지 업데이트
    document.getElementById('ai-instructions').innerHTML = 
      `🚨 아이고, 긴급 상황이시군요! 즉시 몰드버스터 당일 출동반을 매칭해 드릴게요. <b>당일 긴급 방문 출장비 150,000원</b> 동의 후 성함, 주소를 기입해 접수하시면 전문가 폰에 사이렌이 울립니다!`;
  } else {
    isEmergencyMode = false;
    tabNormal.classList.remove('btn-secondary');
    tabNormal.style.background = 'var(--primary)';
    
    tabEmergency.classList.add('btn-secondary');
    tabEmergency.style.background = 'rgba(255,255,255,0.05)';
    
    // 긴급 폼 숨김 및 다음단계 버튼 노출
    emergencyForm.style.display = 'none';
    nextBtn.style.display = 'block';
    
    document.getElementById('ai-instructions').innerHTML = 
      `안녕하세요! 곰팡이 진단/단열 시공 전문 <b>몰드버스터 AI 접수원</b>입니다.<br>현장 작업 중이신 전문가님을 대신하여 상담 접수를 도와드릴게요. 먼저 고객님의 존함과 연락처를 알려주시겠어요?`;
  }
}

// 스텝 전환 관리
function goToNextStep(currentStep) {
  if (currentStep === 1) {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const address = document.getElementById('address').value.trim();

    if (!name || !phone || !address) {
      alert("성함, 연락처, 주소를 모두 올바르게 기재해 주세요!");
      return;
    }
    
    // AI 버블 가이드 업데이트
    document.getElementById('ai-instructions').innerHTML = 
      `감사합니다, <b>${name}</b> 고객님! 접수 대장이 작성되었습니다.<br>시공이 필요한 <b>부위</b>와 <b>불편 사항</b>을 카드에서 골라주세요.`;
    
    switchStep(1, 2);
  } 
  else if (currentStep === 2) {
    const selectedLocation = document.getElementById('selected-location').value;
    const selectedSymptom = document.getElementById('selected-symptom').value;

    if (!selectedLocation || !selectedSymptom) {
      alert("원하시는 시공 부위와 문제 증상을 선택해 주세요!");
      return;
    }

    document.getElementById('ai-instructions').innerHTML = 
      `좋습니다. <b>${selectedLocation}</b> 부위의 <b>${selectedSymptom}</b> 문제를 전문가에게 전달하겠습니다.<br>현장의 상태를 판단할 수 있는 사진이 있다면 여기에 올려주세요! AI가 꼼꼼히 정리해 드릴게요.`;

    switchStep(2, 3);
  } 
  else if (currentStep === 3) {
    // 사진은 필수가 아니므로 바로 패스 가능
    document.getElementById('ai-instructions').innerHTML = 
      `이제 마지막 단계입니다! 전문가님이 언제 방문하여 정밀 진단(점검)을 해드리면 좋을지 편하신 요일과 시간대를 골라주세요.`;

    switchStep(3, 4);
  }
}

function goToPrevStep(currentStep) {
  if (currentStep === 2) {
    document.getElementById('ai-instructions').innerHTML = 
      `처음 기재하신 존함, 연락처, 점검 주소가 맞는지 다시 한번 확인해 주세요.`;
    switchStep(2, 1);
  } 
  else if (currentStep === 3) {
    document.getElementById('ai-instructions').innerHTML = 
      `시공이 필요한 <b>부위</b>와 <b>증상</b>을 카드에서 골라주세요.`;
    switchStep(3, 2);
  } 
  else if (currentStep === 4) {
    document.getElementById('ai-instructions').innerHTML = 
      `현장의 상태를 판단할 수 있는 사진이 있다면 여기에 올려주세요!`;
    switchStep(4, 3);
  }
}

function switchStep(from, to) {
  // 스텝 카드 컨텐츠 애니메이션 아웃 후 인
  const card = document.getElementById('step-card-box');
  card.style.opacity = 0;
  card.style.transform = 'translateY(15px)';

  setTimeout(() => {
    document.getElementById(`step-${from}-content`).style.display = 'none';
    document.getElementById(`step-${to}-content`).style.display = 'block';
    
    // 인디케이터 업데이트
    document.getElementById(`dot-${from}`).classList.remove('active');
    document.getElementById(`dot-${to}`).classList.add('active');

    card.style.opacity = 1;
    card.style.transform = 'translateY(0)';
  }, 250);
}

// 카드형 옵션 선택 핸들러
function selectOption(type, value, element) {
  consultationData[type] = value;
  document.getElementById(`selected-${type}`).value = value;
  
  // 기존 선택 해제 및 신규 선택
  const siblingCards = document.querySelectorAll(`#${type}-options .option-card`);
  siblingCards.forEach(card => card.classList.remove('selected'));
  element.classList.add('selected');
}

// 드래그 앤 드롭 및 이미지 업로드 처리
function initDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      document.getElementById('photo-input').files = files;
      previewImage(document.getElementById('photo-input'));
    }
  });
}

function previewImage(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    if (file.size > 10 * 1024 * 1024) {
      alert("이미지 크기는 최대 10MB를 넘길 수 없습니다!");
      input.value = "";
      return;
    }

    consultationData.photoFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
      const imgPreview = document.getElementById('image-preview');
      imgPreview.src = e.target.result;
      imgPreview.style.display = 'block';
      
      document.getElementById('upload-label-text').innerHTML = 
        `📸 사진이 선택되었습니다: <b>${file.name}</b><br><span style="color:var(--accent);">다시 업로드하려면 터치하세요.</span>`;
    };
    reader.readAsDataURL(file);
  }
}

// 캘린더 드로잉 및 예약 로직 (향후 35일간 주말/요일 무관 전격 오픈 및 월 구분 추가)
function initCalendar() {
  const calendarGrid = document.getElementById('calendar-element');
  calendarGrid.innerHTML = ''; // 초기화

  // 요일 헤더 추가
  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  daysOfWeek.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    header.textContent = day;
    calendarGrid.appendChild(header);
  });

  const today = new Date();
  
  // 달력의 시작을 이번 주 일요일로 잡기
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - today.getDay());

  // 총 35일(5주 분량) 치 날짜 그리기 (과거 날짜 외에 모든 날짜를 100% 오픈하여 자율성 극대화)
  for (let i = 0; i < 35; i++) {
    const current = new Date(startDay);
    current.setDate(startDay.getDate() + i);

    const dayBtn = document.createElement('div');
    dayBtn.className = 'calendar-day';

    // 🌟 월 구분 시각화 (첫 번째 칸이거나 월의 1일인 경우 작은 월 뱃지를 동적 삽입)
    const isFirstCell = (i === 0);
    const isFirstDayOfMonth = (current.getDate() === 1);

    if (isFirstCell || isFirstDayOfMonth) {
      dayBtn.innerHTML = `<span style="font-size: 0.72rem; display: block; line-height: 1; margin-bottom: 2px; color: var(--accent); font-weight: 700;">${current.getMonth() + 1}월</span>${current.getDate()}`;
      dayBtn.style.flexDirection = 'column';
      dayBtn.style.lineHeight = '1.2';
    } else {
      dayBtn.textContent = current.getDate();
    }

    // 과거 날짜만 막고, 주말을 포함한 미래의 모든 일정은 전격 오픈!
    const isPast = current < new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (isPast) {
      dayBtn.classList.add('inactive');
    } else {
      dayBtn.classList.add('active');
      const formattedDate = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      dayBtn.addEventListener('click', () => {
        // 기존 선택 해제
        document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
        dayBtn.classList.add('selected');
        
        document.getElementById('selected-date').value = formattedDate;
        loadTimeSlots(formattedDate);
      });
    }

    calendarGrid.appendChild(dayBtn);
  }
}

// 시간 슬롯 그리기 (기본 슬롯 + 기타 시간대 직접 입력 버튼)
function loadTimeSlots(dateStr) {
  const container = document.getElementById('time-slots-container');
  container.innerHTML = '';

  // 기본 세팅된 영업 시간 슬롯
  appSettings.availableHours.forEach(hour => {
    const slot = document.createElement('div');
    slot.className = 'time-slot';
    slot.textContent = hour;
    
    slot.addEventListener('click', () => {
      document.querySelectorAll('.time-slot.selected').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      document.getElementById('selected-time').value = hour;
      
      // 직접 입력 폼 숨김
      document.getElementById('custom-time-box').style.display = 'none';
    });

    container.appendChild(slot);
  });

  // 🌟 자율성 강화를 위한 '직접 작성 / 조율' 버튼 추가
  const customSlot = document.createElement('div');
  customSlot.className = 'time-slot';
  customSlot.innerHTML = '✍️ 직접 입력 / 조율';
  customSlot.style.borderColor = 'var(--accent)';
  customSlot.style.background = 'rgba(6, 214, 160, 0.03)';
  
  customSlot.addEventListener('click', () => {
    document.querySelectorAll('.time-slot.selected').forEach(s => s.classList.remove('selected'));
    customSlot.classList.add('selected');
    document.getElementById('selected-time').value = '직접 입력';
    
    // 직접 입력 인풋 상자 노출 및 포커스
    const customTimeBox = document.getElementById('custom-time-box');
    customTimeBox.style.display = 'block';
    document.getElementById('custom-time-input').focus();
  });

  container.appendChild(customSlot);
}

// 서버에 데이터 최종 제출
async function submitConsultation() {
  const isAgree = document.getElementById('travel-fee-agree').checked;
  if (!isAgree) {
    alert("방문 진단 출장비 관련 유의사항에 동의해 주셔야 최종 접수가 가능합니다.");
    return;
  }

  const reservedDate = document.getElementById('selected-date').value;
  let reservedTime = document.getElementById('selected-time').value;

  if (!reservedDate || !reservedTime) {
    alert("방문 진단 일정(날짜 및 시간)을 선택해 주세요!");
    return;
  }

  // 직접 시간대 작성을 한 경우 값 가공
  if (reservedTime === '직접 입력') {
    const customTimeText = document.getElementById('custom-time-input').value.trim();
    if (!customTimeText) {
      alert("희망하시는 시간대를 상세히 입력해 주세요! (예: 오후 2시 이후 / 아무때나)");
      return;
    }
    reservedTime = customTimeText;
  }

  // 폼 및 파일 데이터 결합
  const formData = new FormData();
  formData.append('clientName', document.getElementById('clientName').value.trim());
  formData.append('clientPhone', document.getElementById('clientPhone').value.trim());
  formData.append('address', document.getElementById('address').value.trim());
  formData.append('location', consultationData.location);
  formData.append('symptom', consultationData.symptom);
  formData.append('details', document.getElementById('details').value.trim());
  formData.append('reservedDate', reservedDate);
  formData.append('reservedTime', reservedTime);
  
  if (consultationData.photoFile) {
    formData.append('photo', consultationData.photoFile);
  }

  // 로딩 화면 전환
  document.getElementById('step-4-content').style.display = 'none';
  document.getElementById('ai-instructions').innerHTML = 
    `✍️ AI 접수원이 사진과 하자를 정밀하게 판독하여 전문가님 전송용 <b>요약 보고서</b>를 짓고 있습니다. 잠시만 기다려 주세요!`;
  
  const indicator = document.querySelector('.step-indicator');
  if (indicator) indicator.style.display = 'none';

  try {
    const response = await fetch('/api/consultations', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      showSuccessPage(data);
    } else {
      const err = await response.json();
      alert(`접수 오류: ${err.error || '알 수 없는 서버 오류가 발생했습니다.'}`);
      window.location.reload();
    }
  } catch (error) {
    console.error("접수 제출 중 에러 발생:", error);
    alert("서버 연결에 실패했습니다. 네트워크 상태를 확인해 주세요.");
    window.location.reload();
  }
}

// 성공 화면 노출
function showSuccessPage(data) {
  // 🌟 실시간 접수 번호 로컬스토리지에 저장
  latestConsultationId = data.id;
  localStorage.setItem('my_consultation_id', data.id);

  if (!latestConsultationIds.includes(data.id)) {
    latestConsultationIds.push(data.id);
    localStorage.setItem('my_consultation_ids', JSON.stringify(latestConsultationIds));
  }

  document.getElementById('ai-instructions').innerHTML = 
    `접수가 완벽히 완료되었습니다! <b>${data.clientName}</b> 고객님, 진단을 접수하고 소중한 일정을 확보해 주셔서 대단히 감사합니다.`;

  // 마크다운 형식의 AI 요약을 읽기 쉬운 HTML로 포맷팅
  let formattedSummary = data.aiSummary
    .replace(/\n/g, '<br>')
    .replace(/###\s*(.*)/g, '<h4 style="margin: 15px 0 8px; color:var(--primary); font-size:1.1rem; font-weight:600;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  document.getElementById('success-summary-box').innerHTML = formattedSummary;
  
  // 성공 창 전환
  document.getElementById('step-success-content').style.display = 'block';
}

// ==========================================
// 4. 실시간 접수 상태 추적기 (Status Tracker) 연동 함수
// ==========================================

// 상태 추적기 뷰 전환 (1건이면 상세, 2건 이상이면 목록 우선 노출)
function openStatusTracker() {
  if (latestConsultationIds.length === 0) {
    alert("접수하신 이력이 없습니다. 먼저 빠른 상담 접수를 진행해 주세요!");
    return;
  }

  const card = document.getElementById('step-card-box');
  card.style.opacity = 0;
  card.style.transform = 'translateY(15px)';

  setTimeout(async () => {
    // 모든 폼 스텝 숨김
    const contents = document.querySelectorAll('.step-content');
    contents.forEach(el => el.style.display = 'none');

    // 상단 인디케이터 숨김
    const indicator = document.querySelector('.step-indicator');
    if (indicator) indicator.style.display = 'none';

    // 추적기 뷰 노출
    document.getElementById('step-status-tracker').style.display = 'block';
    
    card.style.opacity = 1;
    card.style.transform = 'translateY(0)';

    // 접수 내역 개수에 따라 분기 처리
    if (latestConsultationIds.length === 1) {
      // 1건이면 곧바로 상세 페이지
      selectTrackerItem(latestConsultationIds[0]);
    } else {
      // 2건 이상이면 접수 목록 페이지
      showTrackerListView();
    }
  }, 250);
}

// 🌟 다중 접수 내역 목록 뷰 렌더링
async function showTrackerListView() {
  const listView = document.getElementById('tracker-list-view');
  const detailView = document.getElementById('tracker-detail-view');
  const listContainer = document.getElementById('tracker-items-list');
  const backToListBtn = document.getElementById('btn-back-to-list');
  
  listView.style.display = 'block';
  detailView.style.display = 'none';
  backToListBtn.style.display = 'none'; // 목록 화면이므로 목록가기 버튼 숨김
  
  document.getElementById('tracker-instructions').innerHTML = 
    `고객님께서 접수하신 모든 상담 내역과 진행 현황입니다.<br>각 항목을 터치하시면 **실시간 방문 및 시공 상세 진행 단계**를 확인하실 수 있습니다.`;
  
  listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.9rem;">🔄 접수 목록을 실시간 동기화 중입니다...</div>';
  
  try {
    // 병렬로 API 조회
    const promises = latestConsultationIds.map(id => 
      fetch(`/api/consultations/${id}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
    );
    
    const results = await Promise.all(promises);
    const validItems = results.filter(item => item !== null);
    
    if (validItems.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.9rem;">접수하신 내역이 없습니다.</div>';
      return;
    }
    
    // 최신 등록일 순 정렬
    validItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    listContainer.innerHTML = '';
    
    validItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'glass-panel tracker-item-card';
      card.style.cssText = 'padding: 18px; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 14px; background: rgba(255, 255, 255, 0.02); transition: all 0.25s ease-in-out; border: 1px solid var(--border-glass); margin-bottom: 5px;';
      
      // 마우스 오버 효과 동적 적용
      card.addEventListener('mouseenter', () => {
        card.style.background = 'rgba(255, 255, 255, 0.06)';
        card.style.borderColor = 'var(--primary)';
        card.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.background = 'rgba(255, 255, 255, 0.02)';
        card.style.borderColor = 'var(--border-glass)';
        card.style.transform = 'translateY(0)';
      });
      
      // 상태 배지 색상 및 명칭 매칭
      let statusColor = 'var(--primary)';
      if (item.status === '방문확정') {
        statusColor = 'var(--accent)';
      } else if (item.status === '시공진행') {
        statusColor = '#f59e0b';
      } else if (item.status === '완료') {
        statusColor = '#10b981';
      }
      
      // 긴급 🚨 텍스트 강조
      const emergencyTag = item.isEmergency ? '<span style="color:#ef4444; font-weight:700; margin-right:6px;">[🚨 긴급당일]</span>' : '';
      
      card.innerHTML = `
        <div style="flex: 1; padding-right: 15px;">
          <div style="font-size: 0.98rem; font-weight: 600; margin-bottom: 5px; color: var(--text-main); display: flex; align-items: center;">
            ${emergencyTag}${item.location}
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
            접수자: ${item.clientName}님 (${item.clientPhone})<br>
            일정: ${item.reservedDate} ${item.reservedTime}<br>
            접수번호: <span style="font-family: monospace; font-size:0.75rem;">${item.id}</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          <span style="display:inline-block; font-size:0.78rem; font-weight:600; padding:6px 12px; border-radius:8px; border:1px solid ${statusColor}; color:${statusColor}; background:rgba(255,255,255,0.02); white-space: nowrap;">
            ${item.status}
          </span>
          <button type="button" class="btn-premium btn-secondary" style="padding: 4px 8px; font-size: 0.72rem; border-radius: 6px; display: flex; align-items: center; gap: 3px; box-shadow: none; min-width: auto; width: auto; background: rgba(255,255,255,0.05);" onclick="shareSingleItem(event, '${item.id}')">
            🔗 공유
          </button>
        </div>
      `;
      
      card.addEventListener('click', () => {
        selectTrackerItem(item.id);
      });
      
      listContainer.appendChild(card);
    });
    
    document.getElementById('ai-instructions').innerHTML = 
      `고객님께서 접수하신 내역은 총 <b>${validItems.length}건</b>입니다. 진행 상태를 실시간 확인하세요.`;
      
  } catch (error) {
    console.error("목록 동기화 실패:", error);
    listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:#ef4444; font-size:0.9rem;">⚠️ 목록 조회 실패. 네트워크를 확인해 주세요.</div>';
  }
}

// 🌟 접수 내역 선택 시 단일 상세 화면으로 전환
function selectTrackerItem(id) {
  latestConsultationId = id;
  
  const listView = document.getElementById('tracker-list-view');
  const detailView = document.getElementById('tracker-detail-view');
  const backToListBtn = document.getElementById('btn-back-to-list');
  
  listView.style.display = 'none';
  detailView.style.display = 'block';
  
  // 접수 목록이 2개 이상일 때만 목록가기 버튼 노출
  if (latestConsultationIds.length > 1) {
    backToListBtn.style.display = 'block';
  } else {
    backToListBtn.style.display = 'none';
  }
  
  document.getElementById('tracker-instructions').textContent = 
    "전문가님의 예약 관리 시스템과 연동되어 실시간 상태를 추적합니다.";
    
  refreshTracker();
}

// 뒤로가기 버튼 클릭 시 분기 (목록으로 돌아갈지, 첫 화면으로 갈지)
function backToMainOrList() {
  if (latestConsultationIds.length > 1) {
    showTrackerListView();
  } else {
    backToMain();
  }
}

// 실시간 새로고침 및 렌더링
async function refreshTracker() {
  if (!latestConsultationId) return;

  try {
    const response = await fetch(`/api/consultations/${latestConsultationId}`);
    if (!response.ok) {
      throw new Error("조회 실패");
    }

    const item = await response.json();

    // 1. 기본 텍스트 렌더링
    document.getElementById('tracker-client-info').textContent = `${item.clientName} (${item.clientPhone})`;
    document.getElementById('tracker-address').textContent = item.address;

    // 2. 방문 일정 동적 고지
    const dateDiv = document.getElementById('tracker-reserved-date');
    if (item.status === '접수완료') {
      dateDiv.innerHTML = `🕒 접수 완료 (전문가 일정 조율 대기 중)<br><span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted); display:block; margin-top:5px;">제출해주신 희망일(${item.reservedDate} ${item.reservedTime})을 기반으로 전문가가 연락을 드릴 예정입니다.</span>`;
      dateDiv.style.color = 'var(--status-pending)';
    } else {
      dateDiv.innerHTML = `📅 확정 일정: ${item.reservedDate} ${item.reservedTime}<br><span style="font-size:0.8rem; font-weight:normal; color:var(--accent); display:block; margin-top:5px;">전문가가 스케줄 검토 후 방문 일정을 최종 확정했습니다!</span>`;
      dateDiv.style.color = 'var(--accent)';
    }

    // 3. AI 요약 보고서 포맷팅
    let formattedSummary = item.aiSummary
      .replace(/\n/g, '<br>')
      .replace(/###\s*(.*)/g, '<h4 style="margin: 12px 0 6px; color:var(--primary); font-size:0.95rem; font-weight:600;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    document.getElementById('tracker-ai-summary').innerHTML = formattedSummary;

    // 4. 상태 게이지 업데이트 (접수완료 -> 방문확정 -> 시공중 -> 완료)
    const progressLine = document.getElementById('tracker-progress');
    const steps = [
      document.getElementById('t-step-0'), // 접수완료
      document.getElementById('t-step-1'), // 방문확정
      document.getElementById('t-step-2'), // 시공중
      document.getElementById('t-step-3')  // 완료
    ];

    // 초기화
    steps.forEach(step => {
      step.classList.remove('active', 'completed');
    });

    if (item.status === '접수완료') {
      progressLine.style.width = '0%';
      steps[0].classList.add('active');
    } 
    else if (item.status === '방문확정') {
      progressLine.style.width = '33.3%';
      steps[0].classList.add('completed');
      steps[1].classList.add('active');
    } 
    else if (item.status === '시공중') {
      progressLine.style.width = '66.6%';
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      steps[2].classList.add('active');
    } 
    else if (item.status === '완료') {
      progressLine.style.width = '100%';
      steps[0].classList.add('completed');
      steps[1].classList.add('completed');
      steps[2].classList.add('completed');
      steps[3].classList.add('completed', 'active');
    }

    document.getElementById('ai-instructions').innerHTML = 
      `성공적으로 동기화되었습니다! 현재 선택된 <b>${item.location}</b> 건은 <b>"${item.status}"</b> 단계입니다.`;

  } catch (error) {
    console.error("실시간 상태 조회 오류:", error);
    document.getElementById('ai-instructions').innerHTML = 
      `⚠️ <b>실시간 동기화 오류 발생.</b> 네트워크 상태가 불안정하거나 접수서 조회가 지연되고 있습니다. 잠시 후 새로고침 버튼을 눌러주세요.`;
  }
}

// 메인으로 돌아가기
function backToMain() {
  const card = document.getElementById('step-card-box');
  card.style.opacity = 0;
  card.style.transform = 'translateY(15px)';

  setTimeout(() => {
    // 추적기 및 목록보기 버튼 숨김
    document.getElementById('step-status-tracker').style.display = 'none';
    document.getElementById('btn-back-to-list').style.display = 'none';

    // 메인 첫 단계(Step 1) 및 상단 인디케이터 노출
    document.getElementById('step-1-content').style.display = 'block';
    
    const indicator = document.querySelector('.step-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
      // 모든 인디케이터 초기화
      document.querySelectorAll('.step-dot').forEach(el => el.classList.remove('active'));
      document.getElementById('dot-1').classList.add('active');
    }

    // 퀵 배너 재노출 체크
    if (latestConsultationIds.length > 0) {
      const banner = document.getElementById('quick-status-banner');
      if (banner) {
        banner.style.display = 'flex';
        const textSpan = banner.querySelector('span');
        if (textSpan) {
          textSpan.textContent = `📝 접수하신 내역이 ${latestConsultationIds.length}건 있습니다.`;
        }
      }
    }

    document.getElementById('ai-instructions').innerHTML = 
      `안녕하세요! 곰팡이 진단/단열 시공 전문 <b>몰드버스터 AI 접수원</b>입니다.<br>먼저 고객님의 존함과 연락처를 알려주시겠어요?`;

    card.style.opacity = 1;
    card.style.transform = 'translateY(0)';
  }, 250);
}

// 🌟 고유 접수 조회 링크 복사 및 공유 API 연동
function copyStatusLink() {
  if (!latestConsultationId) {
    alert("현재 진행 중인 접수 내역이 없습니다.");
    return;
  }
  
  const shareUrl = `${window.location.origin}/index.html?id=${latestConsultationId}`;
  
  // 스마트폰 모바일 OS 웹 공유 API (navigator.share) 우선 지원
  if (navigator.share) {
    navigator.share({
      title: '몰드버스터 실시간 예약 현황',
      text: '제출하신 몰드버스터 곰팡이/단열 진단 상태를 실시간 확인하고 보관해 보세요!',
      url: shareUrl
    }).catch(err => console.log("공유 취소 또는 에러:", err));
  } else {
    // 일반 클립보드 복사 폴백
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("🔗 고객님만의 [고유 상태조회 링크]가 클립보드에 복사되었습니다!\n\n카카오톡 '나에게 보내기' 또는 스마트폰 메모장에 붙여넣어 보관하시면, 이 창을 나가거나 브라우저를 닫아도 언제든지 실시간으로 접수 상태를 모니터링하실 수 있습니다.");
    }).catch(err => {
      // 구형 모바일/브라우저 대응 복사 강제 수행
      const tempInput = document.createElement('input');
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      alert("🔗 고객님만의 [고유 상태조회 링크]가 복사되었습니다!\n카카오톡이나 메모장에 보관해 주세요.");
    });
  }
}

// 🌟 긴급 당일 방문 접수 초고속 제출 로직
let emergencyLoadingTimeout = null;

async function submitEmergencyConsultation() {
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!name || !phone || !address) {
    alert("긴급 당일 시공 출동을 위해 성함, 연락처, 주소를 모두 정확하게 입력해 주세요!");
    return;
  }

  const isAgree = document.getElementById('emergency-fee-agree').checked;
  if (!isAgree) {
    alert("긴급 당일 즉시 방문 시 발생하는 긴급 출장비 150,000원 안내를 확인하고 동의해 주셔야 긴급 출동 접수가 완료됩니다.");
    return;
  }

  const emergencyDetails = document.getElementById('emergencyDetails').value.trim();

  // 긴급 폼 데이터 조립
  const formData = new FormData();
  formData.append('clientName', name);
  formData.append('clientPhone', phone);
  formData.append('address', address);
  formData.append('details', emergencyDetails || "🚨 당일 긴급 조치 및 즉시 유선 통화 요청");
  formData.append('isEmergency', true);

  // 로딩 화면 전환
  const card = document.getElementById('step-card-box');
  card.style.opacity = 0;
  card.style.transform = 'translateY(15px)';

  if (emergencyLoadingTimeout) clearTimeout(emergencyLoadingTimeout);

  emergencyLoadingTimeout = setTimeout(() => {
    document.getElementById('step-1-content').style.display = 'none';
    document.getElementById('ai-instructions').innerHTML = 
      `🚨 [긴급 호출 가동 중] 전문가 스마트폰 전방위 사이렌 및 가상 알림망을 통해 비상 호출을 전송하고 있습니다. 잠시만 대기해 주세요!`;
    
    const indicator = document.querySelector('.step-indicator');
    if (indicator) indicator.style.display = 'none';
    
    card.style.opacity = 1;
    card.style.transform = 'translateY(0)';
  }, 250);

  try {
    const response = await fetch('/api/consultations', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      if (emergencyLoadingTimeout) clearTimeout(emergencyLoadingTimeout);
      const data = await response.json();
      
      // 스토리지 저장 및 성공 화면 진입
      latestConsultationId = data.id;
      localStorage.setItem('my_consultation_id', data.id);
      
      showSuccessPage(data);
    } else {
      if (emergencyLoadingTimeout) clearTimeout(emergencyLoadingTimeout);
      const err = await response.json();
      if (err.error === 'LIMIT_EXCEEDED') {
        alert("🚨 당일 긴급 방문 접수가 마감되었습니다.\n\n금일 긴급 방문 예약은 이미 조기 마감되었습니다. 입력하신 내용을 바탕으로 '일반 점검 예약(출장비 3만원)'으로 자동 전환해 접수를 진행해 드릴 테니 다음 단계로 이동해 주세요.");
        
        // 일반 접수로 강제 전환
        toggleConsultationType('normal');
        
        // 로딩 화면 복구
        document.getElementById('step-1-content').style.display = 'block';
        const indicator = document.querySelector('.step-indicator');
        if (indicator) indicator.style.display = 'flex';
        
        // 카드 투명도 및 위치 초기화
        card.style.opacity = 1;
        card.style.transform = 'translateY(0)';
      } else {
        alert(`긴급 접수 오류: ${err.message || err.error || '서버 오류가 발생했습니다.'}`);
        window.location.reload();
      }
    }
  } catch (error) {
    if (emergencyLoadingTimeout) clearTimeout(emergencyLoadingTimeout);
    console.error("긴급 접수 에러:", error);
    alert("서버 연결 실패. 네트워크 상태를 체크하십시오.");
    window.location.reload();
  }
}

// 🌟 다중 접수 목록 전체 조회 링크 공유
function copyMultipleStatusLink() {
  if (latestConsultationIds.length === 0) {
    alert("공유할 접수 내역이 없습니다.");
    return;
  }
  
  const idStr = latestConsultationIds.join(',');
  const shareUrl = `${window.location.origin}/index.html?ids=${idStr}`;
  
  if (navigator.share) {
    navigator.share({
      title: '몰드버스터 접수 목록 현황',
      text: `제출하신 몰드버스터 곰팡이/단열 접수 내역(${latestConsultationIds.length}건) 전체 상태를 한눈에 확인해 보세요!`,
      url: shareUrl
    }).catch(err => console.log("공유 취소 또는 에러:", err));
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("🔗 고객님만의 [전체 접수 목록 조회 링크]가 클립보드에 복사되었습니다!\n\n카카오톡 '나에게 보내기' 또는 스마트폰 메모장에 붙여넣어 보관하시면, 브라우저를 닫아도 언제든지 이 링크 하나로 전체 접수 내역 현황판에 바로 접속해 모니터링하실 수 있습니다.");
    }).catch(err => {
      const tempInput = document.createElement('input');
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      alert("🔗 고객님만의 [전체 접수 목록 조회 링크]가 복사되었습니다!\n카카오톡이나 메모장에 보관해 주세요.");
    });
  }
}

// 개별 접수 카드 내에서 바로 단일 건 링크 공유
function shareSingleItem(event, id) {
  event.stopPropagation(); // 카드 클릭(상세페이지 진입) 전파 차단
  
  const shareUrl = `${window.location.origin}/index.html?id=${id}`;
  
  if (navigator.share) {
    navigator.share({
      title: '몰드버스터 실시간 예약 현황',
      text: `제출하신 몰드버스터 접수 건(번호: ${id}) 상태를 실시간 확인하고 보관해 보세요!`,
      url: shareUrl
    }).catch(err => console.log("공유 취소 또는 에러:", err));
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert(`🔗 접수 건 [${id}]의 개별 상태 조회 링크가 클립보드에 복사되었습니다!\n카카오톡이나 메모장에 보관해 주세요.`);
    }).catch(err => {
      const tempInput = document.createElement('input');
      tempInput.value = shareUrl;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      alert(`🔗 접수 건 [${id}]의 개별 상태 조회 링크가 복사되었습니다!\n카카오톡이나 메모장에 보관해 주세요.`);
    });
  }
}

