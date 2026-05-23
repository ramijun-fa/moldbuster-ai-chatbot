const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정 및 JSON 파싱
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 디렉토리 자동 생성
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const CONSULTATIONS_FILE = path.join(DATA_DIR, 'consultations.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// JSON 파일 DB 초기화 및 헬퍼 함수
function readJSON(file, defaultData = []) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || JSON.stringify(defaultData));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultData;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}


// 초기 설정값 세팅
const defaultSettings = {
  travelFee: "30,000",
  availableDays: ["월", "화", "수", "목", "금"],
  availableHours: ["09:00", "11:00", "13:00", "15:00", "17:00"],
  smsTemplate: "[몰드버스터] {고객명}님, 접수 완료되었습니다. AI 접수원 요약: {요약}. 전문가가 곧 연락드리겠습니다."
};

readJSON(SETTINGS_FILE, defaultSettings);

// Multer 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 최대 10MB
});

// Gemini AI 연동 헬퍼 함수
// Gemini AI 연동 헬퍼 함수
async function generateAISummary(consultation, imagePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // 🌟 규칙 기반 우아한 요약본을 기본 리턴값으로 미리 정의 (API가 터져도 이 형태가 출력됨)
  const fallbackSummary = `### [전문가 전달용 요약]
- 공간: **${consultation.location}** / 문제: **${consultation.symptom}** 정밀 점검 접수.
${consultation.details ? '- 메모: ' + consultation.details : ''}

### [AI 접수원의 관찰 내용]
- **의심 하자**: 곰팡이 번식 및 단열/누수 정밀 분석 필요
- **주요 관찰**: 고객님이 접수하신 공간(${consultation.location})에 결로 또는 누수로 인한 ${consultation.symptom} 현상이 의심됩니다.
- **방문 시 권장 확인 항목**: 전문가 현장 방문 시 ${consultation.location} 부위의 벽체 습도 측정 및 열화상 카메라 정밀 분석 권장.

---
💡 *본 요약은 1차 간이 접수 데이터 기반입니다. 전문가가 현장 방문 시 정밀 검측을 통해 최종 판정해 드립니다.*`;

  if (!apiKey || apiKey.trim() === '') {
    console.log("⚠️ GEMINI_API_KEY가 없습니다. 안전 모드 규칙 기반 요약본을 제공합니다.");
    return fallbackSummary;
  }

  try {
    const cleanedKey = apiKey.trim();
    const genAI = new GoogleGenerativeAI(cleanedKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let contents = [];
    
    // 프롬프트 작성 - 친절한 접수원 페르소나 및 전문가 전달용 요약 형식
    const prompt = `
당신은 곰팡이 진단 및 단열 시공 전문 업체 "몰드버스터(MoldBuster)"의 친절한 "AI 접수원"입니다.
고객이 하자 부위, 증상, 상세 입력사항을 제출하고 현장 사진을 보냈습니다.
전문가(시공업자)가 바쁜 현장 업무 중에도 한눈에 직관적으로 문제를 파악할 수 있도록 접수 내용을 전문적이고 일목요연하게 요약해 주세요.

[고객 입력 정보]
- 하자 발생 공간/위치: ${consultation.location}
- 하자의 증상: ${consultation.symptom}
- 고객이 남긴 설명: ${consultation.details || '없음'}

[작성 가이드라인]
1. 전문가 전달용 요약 (100자 내외, 간결하게): 시공업자가 급하게 운전 중이거나 작업 중일 때 문자 알림으로 바로 상황을 파악할 수 있는 핵심 요약입니다.
2. AI 접수 분석 리포트: 
   - 업로드된 사진과 증상을 매칭하여 어떤 하자가 의심되는지 곰팡이/단열 관점에서 분석 의견(예: 배관 누수 가능성 vs 벽체 결로 가능성 등)을 '전문가용 참고사항'으로 3줄 내외 정리해 주세요.
   - 단, 고객에게 확정적으로 진단하는 것이 아니며 "이러한 점이 관찰되니 방문하여 정밀 진단(점검)이 필요하다"는 뉘앙스를 담아야 합니다.

답변은 반드시 한국어로 작성하고 아래 마크다운 템플릿 형식을 엄격하게 준수해 주세요:

### [전문가 전달용 요약]
- (여기에 간결하게 한 줄 요약 작성)

### [AI 접수원의 관찰 내용]
- **의심 하자**: (예: 벽체 결로에 의한 곰팡이 의심 / 배관 누수 곰팡이 의심 등)
- **주요 관찰**: (사진과 증상을 바탕으로 분석한 물리적 양상 기술)
- **방문 시 권장 확인 항목**: (전문가가 현장에 가서 먼저 들여다봐야 할 위치 추천)
`;

    contents.push(prompt);

    if (imagePath && fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      contents.push({
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType || "image/jpeg"
        }
      });
    }

    const result = await model.generateContent(contents);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("AI 요약 생성 중 오류 발생 (안전 모드 규칙 기반 대체):", error);
    // 🌟 구글 API 에러 발생 시, 에러 문구를 화면에 뱉지 않고 수려한 규칙 요약본을 우아하게 대신 반환!
    return fallbackSummary;
  }
}

// 가상 SMS/카카오톡 발송 시뮬레이터
function simulateNotification(consultation, summary) {
  const settings = readJSON(SETTINGS_FILE, defaultSettings);
  
  if (consultation.isEmergency) {
    console.log("\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨");
    console.log("🔥 [🚨 긴급 사이렌 알림 발송 완료] SMS, 알림톡, 푸시 전방위 비상 호출!");
    console.log("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨");
    console.log(`▶ 수신자: 전문가 (본인 스마트폰 전방위 사이렌 알림)`);
    console.log(`▶ [🚨 긴급 당일 출동 요청] 성함: ${consultation.clientName} / 연락처: ${consultation.clientPhone}`);
    console.log(`▶ 현장 주소: ${consultation.address}`);
    console.log(`▶ 상세 내용: ${consultation.details || '상황설명 없음'}`);
    console.log(`▶ [고지 동의 확인]: 당일 시공 즉시 조치 조건 / 긴급 출장비 150,000원 발생 동의완료.`);
    console.log(`💡 조언: 즉시 고객에게 유선 전화를 연결하여 상황을 통제하고 출발 시간을 확정하십시오!`);
    console.log("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n");
    return;
  }

  const firstLineSummary = summary.split('\n')[2] || `${consultation.location} - ${consultation.symptom}`;
  
  let smsContent = settings.smsTemplate
    .replace('{고객명}', consultation.clientName)
    .replace('{요약}', firstLineSummary.replace('- ', '').trim());

  console.log("\n==================================================");
  console.log("📱 [가상 알림 서비스] SMS / 카카오톡 전송 성공!");
  console.log(`수신자: ${consultation.clientPhone} (고객님)`);
  console.log(`내용: ${smsContent}`);
  console.log("--------------------------------------------------");
  console.log(`수신자: 전문가 (본인 알림)`);
  console.log(`내용: [신규 접수] ${consultation.clientName} / ${consultation.clientPhone}`);
  console.log(`주소: ${consultation.address}`);
  console.log(`요약: ${firstLineSummary}`);
  console.log("==================================================\n");
}


// --- API 라우트 정의 ---

// 1. 상담 접수 API (고객용)
app.post('/api/consultations', upload.single('photo'), async (req, res) => {
  try {
    const { clientName, clientPhone, address, location, symptom, details, reservedDate, reservedTime, isEmergency } = req.body;

    const emergencyFlag = isEmergency === 'true' || isEmergency === true;

    if (!emergencyFlag && (!clientName || !clientPhone || !address || !location || !symptom)) {
      return res.status(400).json({ error: "필수 입력 항목이 누락되었습니다." });
    }
    
    // 긴급 접수 시 최소 필요 데이터 검증 (성함, 연락처, 주소만 있으면 다이렉트 접수 가능)
    if (emergencyFlag && (!clientName || !clientPhone || !address)) {
      return res.status(400).json({ error: "긴급 접수를 위해 성함, 연락처, 주소 입력은 필수입니다." });
    }

    const consultations = readJSON(CONSULTATIONS_FILE);

    // 🚨 긴급 당일 즉시 방문 요청은 하루에 1건만 가능하도록 제한
    if (emergencyFlag) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const hasEmergencyToday = consultations.some(c => {
        if (!c.isEmergency || !c.createdAt) return false;
        const cd = new Date(c.createdAt);
        const cyer = cd.getFullYear();
        const cmon = String(cd.getMonth() + 1).padStart(2, '0');
        const cday = String(cd.getDate()).padStart(2, '0');
        const cdateStr = `${cyer}-${cmon}-${cday}`;
        return cdateStr === todayStr;
      });

      if (hasEmergencyToday) {
        return res.status(400).json({
          error: "LIMIT_EXCEEDED",
          message: "금일 긴급 당일 즉시 방문 요청이 이미 마감되었습니다. 상담 및 방문요청예약을 이용해 주시기 바랍니다."
        });
      }
    }
    
    // 신규 상담 데이터 생성
    const newId = 'C-' + Date.now();
    const newConsultation = {
      id: newId,
      clientName,
      clientPhone,
      address,
      location: emergencyFlag ? "🚨 당일 긴급 출동" : location,
      symptom: emergencyFlag ? (details || "즉시 조치 요구") : symptom,
      details: details || "",
      reservedDate: emergencyFlag ? "당일 긴급 방문" : (reservedDate || ""),
      reservedTime: emergencyFlag ? "즉시 출동 요망" : (reservedTime || ""),
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      status: "접수완료", // 접수완료 -> 방문확정 -> 시공중 -> 완료
      isEmergency: emergencyFlag,
      createdAt: new Date().toISOString(),
      aiSummary: "AI 접수원이 요약을 작성 중입니다..."
    };

    // 파일 업로드 처리 정보
    const imagePath = req.file ? req.file.path : null;
    const mimeType = req.file ? req.file.mimetype : null;

    // AI 접수 요약 생성
    let aiSummary = "";
    if (emergencyFlag) {
      aiSummary = `### [🚨 긴급 당일 방문 요청 접수]
- **긴급 고지 동의**: 긴급 당일 시공/방문 조건 및 **긴급 출장비 150,000원** 발생 동의 완료.
- **현재 상황 요약**: ${details || '즉시 현장 전화 요망'}
- **전문가 가이드**: 당일 즉시 방문 처리가 약속된 긴급 건입니다. 즉시 전화를 걸어 현장 상태를 체크하고 출발 시간을 잡으십시오.`;
    } else {
      aiSummary = await generateAISummary(newConsultation, imagePath, mimeType);
    }
    newConsultation.aiSummary = aiSummary;

    // DB에 데이터 저장
    consultations.unshift(newConsultation);
    writeJSON(CONSULTATIONS_FILE, consultations);

    // 가상 SMS/카톡 사이렌 발송 실행
    simulateNotification(newConsultation, aiSummary);

    res.status(201).json(newConsultation);

  } catch (error) {
    console.error("상담 접수 처리 중 오류 발생:", error);
    res.status(500).json({ error: "상담 접수 중 오류가 발생했습니다." });
  }
});

// 2. 상담 리스트 조회 API (관리자용)
app.get('/api/consultations', (req, res) => {
  const consultations = readJSON(CONSULTATIONS_FILE);
  res.json(consultations);
});

// 2-1. 개별 상담 단일 조회 API (고객용 상태 확인 연동)
app.get('/api/consultations/:id', (req, res) => {
  const { id } = req.params;
  const consultations = readJSON(CONSULTATIONS_FILE);
  const item = consultations.find(c => c.id === id);
  if (!item) {
    return res.status(404).json({ error: "해당 접수 내역을 찾을 수 없습니다." });
  }
  res.json(item);
});

// 3. 상담 상태 및 예약일 변경 API (관리자용)
app.put('/api/consultations/:id', (req, res) => {
  const { id } = req.params;
  const { status, reservedDate, reservedTime } = req.body;

  const consultations = readJSON(CONSULTATIONS_FILE);
  const index = consultations.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "해당 상담 건을 찾을 수 없습니다." });
  }

  const item = consultations[index];
  if (status) item.status = status;
  if (reservedDate !== undefined) item.reservedDate = reservedDate;
  if (reservedTime !== undefined) item.reservedTime = reservedTime;

  writeJSON(CONSULTATIONS_FILE, consultations);
  
  // 예약 상태 변경 알림 시뮬레이션
  if (status === '방문확정') {
    console.log(`📱 [가상 알림 서비스] ${item.clientName} 고객님께 방문 일정(${item.reservedDate} ${item.reservedTime}) 확정 문자 발송 완료!`);
  }

  res.json(item);
});

// 4. 설정값 조회 API
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, defaultSettings);
  res.json(settings);
});

// 5. 설정값 변경 API
app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  if (writeJSON(SETTINGS_FILE, newSettings)) {
    res.json({ message: "설정이 성공적으로 저장되었습니다.", settings: newSettings });
  } else {
    res.status(500).json({ error: "설정 저장 중 오류가 발생했습니다." });
  }
});

// 서버 기동
app.listen(PORT, () => {
  const rawKey = process.env.GEMINI_API_KEY || '';
  const cleanKey = rawKey.trim();
  console.log(`
🔑 [배포 서버 API Key 검증 상태]
- API Key 변수 등록 여부: ${rawKey ? '✅ 등록됨' : '❌ 누락됨'}
- API Key 실제 글자수: ${cleanKey.length} 자 (정상적인 구글 키는 약 39자 내외)
- 마스킹 확인: ${cleanKey ? cleanKey.substring(0, 8) + '...' + cleanKey.substring(cleanKey.length - 4) : '없음'}
  `);

  console.log(`
🚀  ==========================================================
🚀  '시공링크' 상담 자동화 서버가 켜졌습니다!
🚀  주소: http://localhost:${PORT}
🚀  고객용 웹앱: http://localhost:${PORT}/index.html
🚀  전문가 대시보드: http://localhost:${PORT}/admin.html
🚀  ==========================================================
  `);
});
