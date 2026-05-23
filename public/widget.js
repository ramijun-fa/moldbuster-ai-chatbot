/**
 * 시공링크 (SigongLink) - moldbuster.kr 용 간편 웹 통합 임베드 위젯 스크립트
 * 
 * [설치 방법]
 * moldbuster.kr 홈페이지 HTML의 </body> 태그 직전에 아래 코드를 한 줄 삽입하세요:
 * <script src="http://localhost:3000/widget.js"></script>
 */

(function () {
  // 중복 실행 방지
  if (window.SigongLinkWidgetInitialized) return;
  window.SigongLinkWidgetInitialized = true;

  // 🌟 위젯 스크립트가 로드된 호스트를 동적 감지하여 서버 주소로 자동 지정 (로컬/운영 100% 호환)
  let baseServerUrl = 'http://localhost:3000';
  if (document.currentScript && document.currentScript.src) {
    try {
      const url = new URL(document.currentScript.src);
      baseServerUrl = url.origin;
    } catch (e) {
      console.warn("SigongLink 위젯 호스트 파싱 실패, 기본값으로 대체합니다.");
    }
  }
  const SERVER_URL = baseServerUrl;

  // 1. 필요한 위젯 스타일 추가
  const style = document.createElement('style');
  style.innerHTML = `
    /* 플로팅 버튼 */
    #sigong-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3a86ff, #06d6a0);
      box-shadow: 0 8px 24px rgba(58, 134, 255, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    #sigong-widget-btn:hover {
      transform: scale(1.1) translateY(-3px);
      box-shadow: 0 12px 30px rgba(58, 134, 255, 0.6);
    }
    #sigong-widget-btn:active {
      transform: scale(0.95);
    }
    #sigong-widget-btn .widget-icon {
      font-size: 28px;
    }
    
    /* 버튼 툴팁 안내 */
    #sigong-widget-tooltip {
      position: fixed;
      bottom: 40px;
      right: 98px;
      background: #0b132b;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 999998;
      pointer-events: none;
      opacity: 0;
      transform: translateX(10px);
      transition: all 0.4s ease;
      white-space: nowrap;
      font-family: sans-serif;
    }
    #sigong-widget-tooltip.show {
      opacity: 1;
      transform: translateX(0);
    }
    #sigong-widget-tooltip::after {
      content: '';
      position: absolute;
      top: 50%;
      right: -6px;
      transform: translateY(-50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: #0b132b;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* 위젯 아이프레임 윈도우 */
    #sigong-widget-container {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 420px;
      height: 75vh;
      max-height: 700px;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      z-index: 999997;
      transform: translateY(30px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    #sigong-widget-container.active {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }
    #sigong-widget-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #0b132b;
    }

    /* 모바일 대응 반응형 */
    @media (max-width: 480px) {
      #sigong-widget-container {
        bottom: 0;
        right: 0;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
      }
      #sigong-widget-btn {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // 2. 돔 요소 동적 생성 및 바인딩
  const widgetBtn = document.createElement('div');
  widgetBtn.id = 'sigong-widget-btn';
  widgetBtn.innerHTML = '<span class="widget-icon">🤖</span>';

  const tooltip = document.createElement('div');
  tooltip.id = 'sigong-widget-tooltip';
  tooltip.innerHTML = '⚡ <b>AI 사진진단 및 빠른 상담 접수</b>';

  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'sigong-widget-container';
  widgetContainer.innerHTML = `<iframe id="sigong-widget-iframe" src="${SERVER_URL}/index.html"></iframe>`;

  document.body.appendChild(widgetBtn);
  document.body.appendChild(tooltip);
  document.body.appendChild(widgetContainer);

  let isOpen = false;

  // 3. 인터랙션 바인딩
  widgetBtn.addEventListener('click', function () {
    isOpen = !isOpen;
    if (isOpen) {
      widgetContainer.classList.add('active');
      widgetBtn.innerHTML = '<span class="widget-icon" style="font-size: 20px;">✕</span>';
      tooltip.classList.remove('show');
    } else {
      widgetContainer.classList.remove('active');
      widgetBtn.innerHTML = '<span class="widget-icon">🤖</span>';
    }
  });

  // 최초 로드 1.5초 후 툴팁 보여주기, 6초 뒤 알아서 사라지기
  setTimeout(() => {
    if (!isOpen) tooltip.classList.add('show');
  }, 1500);

  setTimeout(() => {
    tooltip.classList.remove('show');
  }, 7500);

  // 4. iframe 자식 창으로부터 위젯 닫기 요청 수신 (postMessage 연동)
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'CLOSE_SIGONG_WIDGET') {
      isOpen = false;
      widgetContainer.classList.remove('active');
      widgetBtn.innerHTML = '<span class="widget-icon">🤖</span>';
    }
  });

})();
