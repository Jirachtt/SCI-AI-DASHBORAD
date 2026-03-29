// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, financialData, studentLifeData, dashboardSummary
} from '../data/mockData';
import { scienceStudentList, SCIENCE_MAJORS } from '../data/studentListData';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
if (!API_KEY) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is not set.');
}

// Models ordered by free-tier quota: highest RPM first
const MODELS = [
    'gemini-2.0-flash-lite',   // 30 RPM free
    'gemini-2.0-flash',        // 15 RPM free
    'gemini-2.5-flash',        // 10 RPM free
];

function getApiUrl(modelId) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Per-model cooldown tracking — skip models that recently hit quota
const modelCooldowns = {};
const COOLDOWN_MS = 60000; // 60s cooldown after quota error

function isModelOnCooldown(model) {
    const until = modelCooldowns[model];
    if (!until) return false;
    if (Date.now() >= until) { delete modelCooldowns[model]; return false; }
    return true;
}

// Rate limiting — minimum 4s between requests (prevents quota burn)
let lastRequestTime = 0;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < 4000) {
        await new Promise(r => setTimeout(r, 4000 - elapsed));
    }
    lastRequestTime = Date.now();
}

// Simple fetch with timeout — NO retry on 429 quota errors
async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('คำขอหมดเวลา (Timeout 30s) — กรุณาลองใหม่อีกครั้ง');
        }
        throw err;
    }
}

// Retry only on 5xx server errors, NOT on 429 quota
async function fetchSmart(url, options) {
    const response = await fetchWithTimeout(url, options);

    // 429 = quota/rate limit — do NOT retry, just return so caller can try next model
    if (response.status === 429) return response;

    // 5xx = server error — retry once after 2s
    if (response.status >= 500) {
        console.warn(`[Gemini] Server error ${response.status}, retrying once...`);
        await new Promise(r => setTimeout(r, 2000));
        return fetchWithTimeout(url, options);
    }

    return response;
}

// Build compact system instruction — optimized for token efficiency
// Split into base (small) and student detail (large) parts
function buildBaseInstruction() {
    const budgetActual = universityBudgetData.yearly.filter(y => y.type === 'actual');
    const sciBudgetActual = scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual');

    const majorCounts = {};
    const yearCounts = {};
    let statusNormal = 0, statusAtRisk = 0;
    scienceStudentList.forEach(s => {
        majorCounts[s.major] = (majorCounts[s.major] || 0) + 1;
        yearCounts[s.year] = (yearCounts[s.year] || 0) + 1;
        if (s.status === 'รอพินิจ') statusAtRisk++; else statusNormal++;
    });
    const majorSummary = Object.entries(majorCounts).map(([m, c]) => `${m}:${c}`).join(', ');
    const yearSummary = Object.entries(yearCounts).sort().map(([y, c]) => `ปี${y}:${c}`).join(', ');

    // Compute GPA stats per major for quick answers
    const gpaByMajor = {};
    scienceStudentList.forEach(s => {
        if (!gpaByMajor[s.major]) gpaByMajor[s.major] = { sum: 0, count: 0 };
        gpaByMajor[s.major].sum += s.gpa;
        gpaByMajor[s.major].count++;
    });
    const gpaSummary = Object.entries(gpaByMajor).map(([m, d]) => `${m}:${(d.sum / d.count).toFixed(2)}`).join(', ');

    return `คุณคือ "MJU AI Assistant" ผู้เชี่ยวชาญมหาวิทยาลัยแม่โจ้ (MJU) ตอบได้ทุกเรื่องเกี่ยวกับแม่โจ้อย่างครบถ้วน

## กฎ
1. ตอบภาษาไทย ใช้ emoji กระชับ
2. **ลำดับการหาข้อมูล:**
   - ข้อมูล Dashboard (ด้านล่าง) = ใช้ก่อนเสมอ (แม่นยำสุด)
   - ถ้าไม่มีใน Dashboard → ใช้ความรู้ทั่วไปเกี่ยวกับแม่โจ้จาก mju.ac.th และแหล่งข้อมูลอื่น
   - สามารถตอบเรื่องทั่วไปของแม่โจ้ได้ทุกเรื่อง เช่น ประวัติ คณะ หลักสูตร การรับสมัคร วิจัย กิจกรรม สถานที่ การเดินทาง ฯลฯ
3. **ห้ามแต่งตัวเลขสถิติเด็ดขาด:** ถ้าถามตัวเลขที่ไม่มีใน Dashboard → ใช้ความรู้ทั่วไปได้แต่ต้องระบุว่า "ข้อมูลนี้ไม่ได้มาจาก Dashboard แนะนำตรวจสอบเพิ่มเติมที่ mju.ac.th"
4. เรื่องไม่เกี่ยวกับแม่โจ้เลย → ปฏิเสธ: "ขออภัยค่ะ ตอบได้เฉพาะเรื่องแม่โจ้เท่านั้นค่ะ 🎓"
5. **⚠️ สำคัญมาก: เมื่อสร้างกราฟ ต้องใช้ \`\`\`json_chart\`\`\` เท่านั้น (ห้ามใช้ \`\`\`json\`\`\`)** รูปแบบ:
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["#00a651","#7B68EE"]}]}}
\`\`\`
รองรับ chartType: "bar", "line", "pie", "doughnut", "radar", "polarArea"
6. พยากรณ์ → คำนวณ + json_chart เสมอ
7. ถามนศ./รายชื่อ → ใช้ข้อมูลนักศึกษาที่ให้มา
8. **เปรียบเทียบข้ามหมวด:** สร้าง json_chart ที่มีหลาย datasets ใช้สีต่างกัน ถ้าหน่วยต่างกัน → อธิบายใน label
9. **ไฟล์ที่อัปโหลด:** รวมกับข้อมูล Dashboard เพื่อสร้างกราฟเปรียบเทียบได้
10. **ถ้าถามเรื่องทั่วไปของแม่โจ้** (เช่น ประวัติ สถานที่ การรับสมัคร) → ตอบจากความรู้ด้านล่างและความรู้ทั่วไปได้เลย ไม่ต้องปฏิเสธ

## มหาวิทยาลัยแม่โจ้ — ข้อมูลครบถ้วน
### ประวัติและข้อมูลทั่วไป
- ชื่อเต็ม: มหาวิทยาลัยแม่โจ้ (Maejo University) ชื่อย่อ: มจ./MJU
- ก่อตั้ง: พ.ศ. 2477 (ค.ศ. 1934) เดิมชื่อ "โรงเรียนฝึกหัดครูประถมกสิกรรมภาคเหนือ"
- ปรัชญา: "มหาวิทยาลัยแห่งชีวิต" (University of Life)
- วิสัยทัศน์: มหาวิทยาลัยชั้นนำด้านเกษตรอินทรีย์ (Organic Agriculture) ระดับนานาชาติ
- อัตลักษณ์: นักศึกษาแม่โจ้ "เป็นนักปฏิบัติที่ทันต่อการเปลี่ยนแปลง"
- สีประจำ: เขียว-ขาว-เหลือง | ดอกไม้ประจำ: ดอกจามจุรี (ก้ามปู)
- เว็บไซต์หลัก: www.mju.ac.th

### ที่ตั้งและวิทยาเขต
- **วิทยาเขตหลัก (เชียงใหม่):** 63 หมู่ 4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290 โทร 053-873000
  - พื้นที่ ~900 ไร่ สภาพแวดล้อมร่มรื่น มีสวนเกษตร ฟาร์มสาธิต อ่างเก็บน้ำ
  - การเดินทาง: ห่างจากตัวเมืองเชียงใหม่ ~15 กม. ทางเหนือ
- **มหาวิทยาลัยแม่โจ้-แพร่ เฉลิมพระเกียรติ:** ต.แม่ทราย อ.ร้องกวาง จ.แพร่
  - หลักสูตร: เกษตรป่าไม้ วนศาสตร์ รัฐศาสตร์ บัญชี
- **มหาวิทยาลัยแม่โจ้-ชุมพร:** ต.ละแม อ.ละแม จ.ชุมพร
  - หลักสูตร: การเพาะเลี้ยงสัตว์น้ำ พืชศาสตร์ การท่องเที่ยว

### 16 คณะ/วิทยาลัย
1. **คณะผลิตกรรมการเกษตร** — พืชไร่ พืชสวน ปฐพีศาสตร์ กีฏวิทยา โรคพืช ส่งเสริมการเกษตร เกษตรอินทรีย์
2. **คณะวิทยาศาสตร์** — วิทยาการคอมพิวเตอร์(CS) เทคโนโลยีสารสนเทศ(IT) เคมี ชีววิทยา คณิตศาสตร์ ฟิสิกส์ สถิติ วิทยาการข้อมูล(DataSci) เทคโนโลยีชีวภาพ(Biotech) เคมีอุตสาหกรรม นาโนวิทยา
3. **คณะวิศวกรรมและอุตสาหกรรมเกษตร** — วิศวกรรมเกษตร วิศวกรรมอาหาร เทคโนโลยีหลังการเก็บเกี่ยว
4. **คณะบริหารธุรกิจ** — การจัดการ การตลาด การเงิน บัญชี ระบบสารสนเทศ
5. **คณะเศรษฐศาสตร์** — เศรษฐศาสตร์ เศรษฐศาสตร์เกษตร เศรษฐศาสตร์สหกรณ์
6. **คณะพัฒนาการท่องเที่ยว** — การท่องเที่ยว การโรงแรม การจัดการอีเวนต์
7. **คณะศิลปศาสตร์** — ภาษาอังกฤษ นิเทศศาสตร์ ภาษาไทย
8. **คณะสถาปัตยกรรมศาสตร์และการออกแบบสิ่งแวดล้อม** — สถาปัตยกรรม ภูมิสถาปัตยกรรม เทคโนโลยีภูมิทัศน์
9. **คณะสารสนเทศและการสื่อสาร** — การสื่อสารดิจิทัล
10. **คณะเทคโนโลยีการประมงและทรัพยากรทางน้ำ** — การประมง เพาะเลี้ยงสัตว์น้ำ
11. **คณะสัตวศาสตร์และเทคโนโลยี** — สัตวศาสตร์ สัตวแพทย์
12. **วิทยาลัยพลังงานทดแทน** — พลังงานทดแทน วิศวกรรมพลังงาน
13. **วิทยาลัยนานาชาติ** — หลักสูตรนานาชาติ
14. **คณะพยาบาลศาสตร์** — พยาบาลศาสตรบัณฑิต
15. **มหาวิทยาลัยแม่โจ้-แพร่ฯ** — เกษตรป่าไม้ รัฐศาสตร์ บัญชี
16. **มหาวิทยาลัยแม่โจ้-ชุมพร** — เพาะเลี้ยงสัตว์น้ำ พืชศาสตร์ ท่องเที่ยว

### การรับสมัครนักศึกษา
- **TCAS (Thai University Central Admission System):**
  - รอบ 1: Portfolio (ธ.ค.-ม.ค.)
  - รอบ 2: Quota/โควตา (ก.พ.-เม.ย.)
  - รอบ 3: Admission (พ.ค.-มิ.ย.)
  - รอบ 4: Direct Admission (มิ.ย.)
- เว็บรับสมัคร: https://admissions.mju.ac.th
- ค่าเทอมเหมาจ่าย: 16,000-19,000 บาท/เทอม (แล้วแต่คณะ)

### จุดเด่นและความโดดเด่น
- **เกษตรอินทรีย์อันดับ 1 ของไทย** — ผู้นำด้าน Organic Agriculture
- **ฟาร์มมหาวิทยาลัย** — มีพื้นที่เกษตรกว่า 400 ไร่สำหรับเรียนรู้และวิจัย
- **ศูนย์วิจัยข้าว** — พัฒนาพันธุ์ข้าวเหนียวและข้าวอินทรีย์
- **อ่างเก็บน้ำแม่โจ้** — สถานที่ท่องเที่ยวและออกกำลังกายในมหาวิทยาลัย
- **ประเพณีรับน้องรวมใจ** — มีชื่อเสียงด้านกิจกรรมนักศึกษาที่แน่นแฟ้น
- **สวนพฤกษศาสตร์** — แหล่งรวมพันธุ์ไม้ภาคเหนือ
- **บัณฑิตพันธุ์ใหม่** — หลักสูตรร่วมกับภาคอุตสาหกรรม

### สิ่งอำนวยความสะดวก
- หอพักนักศึกษา (ในมหาวิทยาลัย + รอบข้าง)
- สนามกีฬา สระว่ายน้ำ ฟิตเนส
- ห้องสมุดกลาง (สำนักหอสมุด)
- โรงอาหาร ร้านสะดวกซื้อ
- คลินิกสุขภาพ / ศูนย์สุขภาพ
- WiFi ครอบคลุมทั่วมหาวิทยาลัย
- รถสาธารณะ / สายรถเมล์เข้าเมืองเชียงใหม่

### งานวิจัยและความเป็นเลิศ
- ศูนย์ความเป็นเลิศด้านเกษตรอินทรีย์
- ศูนย์วิจัยพลังงานทดแทน
- สถาบันวิจัยเทคโนโลยีเกษตร
- ความร่วมมือวิจัยกับมหาวิทยาลัยต่างประเทศ (ญี่ปุ่น จีน ไต้หวัน เกาหลี ออสเตรเลีย)
- วารสารวิชาการแม่โจ้

## Dashboard
- นิสิต:${dashboardSummary.totalStudents} GPA:${dashboardSummary.avgGPA} สำเร็จ:${dashboardSummary.graduationRate}% เทอม:${dashboardSummary.currentSemester}/${dashboardSummary.academicYear}
- คณะ: ${dashboardSummary.faculties.map(f => `${f.name}(${f.totalStudents},GPA${f.avgGPA.toFixed(2)},${f.graduationRate}%)`).join(' | ')}
- แนวโน้ม: ${studentStatsData.trend.map(t => `${t.year}:${t.total}(${t.type === 'actual' ? 'จริง' : 'พยากรณ์'})`).join(', ')}
- งบมหา'ลัย(ล้านบ.): ${budgetActual.map(y => `${y.year}:รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}
- งบคณะวิทย์(ล้านบ.): ${sciBudgetActual.map(y => `${y.year}:รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}
- ค่าเทอม: ${tuitionData.flatRate.min}-${tuitionData.flatRate.max}บ./เทอม
- คณะวิทย์: นศ.${scienceStudentList.length}คน สาขา: ${majorSummary} | ชั้นปี: ${yearSummary} | ปกติ${statusNormal} รอพินิจ${statusAtRisk}
- GPA เฉลี่ยแยกสาขา: ${gpaSummary}`;
}

// Full student list — only included when query is about students
function buildStudentData() {
    return '\n\n## รายชื่อนักศึกษา(id=รหัส,n=ชื่อ,m=สาขา,y=ปี,g=GPA,s=สถานะ):\n' +
        JSON.stringify(scienceStudentList.map(s => ({
            id: s.id, n: s.name, m: s.major, y: s.year, g: s.gpa, s: s.status
        })));
}

// Check if user message needs student detail data
function needsStudentDetail(msg) {
    const q = msg.toLowerCase();
    const keywords = ['รายชื่อ', 'ชื่อนักศึกษา', 'ชื่อนิสิต', 'ค้นหานักศึกษา', 'หานักศึกษา', 'รหัส 6', 'ใครบ้าง', 'คนไหน', 'gpa สูง', 'เกรดสูง', 'รอพินิจ', 'เกรดต่ำ', 'เกียรตินิยม', 'กราฟเกรด', 'กราฟนักศึกษา', 'จำนวนนักศึกษา', 'สถิตินักศึกษา', 'เกรดแต่ละสาขา', 'นักศึกษาแต่ละสาขา'];
    return keywords.some(k => q.includes(k));
}

// Conversation history for multi-turn chat
let conversationHistory = [];

/**
 * Send a message to the Gemini API and return the response text.
 * Tries multiple models in order until one succeeds.
 */
export async function sendMessageToGemini(userMessage) {
    // Detect chart/graph request keywords and append reminder
    const chartKeywords = ['กราฟ', 'chart', 'แผนภูมิ', 'แผนภาพ', 'แท่ง', 'เส้น', 'วงกลม', 'radar', 'พยากรณ์', 'คาดการณ์', 'forecast', 'bar chart', 'line chart', 'pie chart', 'กราฟแท่ง', 'กราฟเส้น', 'กราฟวงกลม'];
    const lowerMsg = userMessage.toLowerCase();
    const isChartRequest = chartKeywords.some(kw => lowerMsg.includes(kw));

    let finalMessage = userMessage;
    if (isChartRequest) {
        finalMessage = userMessage + '\n\n[ระบบ: ผู้ใช้ขอดูกราฟ — กรุณาแนบ ```json_chart``` block ท้ายข้อความด้วยเสมอ ห้ามตอบเป็นแค่ตัวหนังสือ]';
    }

    // Add user message to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: finalMessage }]
    });

    // Rate limit
    await waitForRateLimit();

    let lastError = null;
    let allQuotaExhausted = true;

    // Only include full student data when the question is about students
    const baseInstruction = buildBaseInstruction();
    const systemText = needsStudentDetail(userMessage)
        ? baseInstruction + buildStudentData()
        : baseInstruction;

    const requestBody = {
        system_instruction: {
            parts: [{ text: systemText }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 4096,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    // Try each model in order, skip models on cooldown
    let attemptCount = 0;
    for (const model of MODELS) {
        if (isModelOnCooldown(model)) {
            console.log(`[Gemini] Skipping ${model} (cooldown)`);
            continue;
        }

        // Wait between model attempts to avoid burning shared quota
        if (attemptCount > 0) {
            await new Promise(r => setTimeout(r, 2000));
        }
        attemptCount++;

        try {
            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                modelCooldowns[model] = Date.now() + COOLDOWN_MS;
                console.warn(`[Gemini] ${model} quota exceeded, cooldown ${COOLDOWN_MS / 1000}s`);
                lastError = new Error('QUOTA_EXCEEDED');
                continue;
            }

            if (response.status === 404) {
                allQuotaExhausted = false;
                console.warn(`[Gemini] ${model} not found (404), skipping...`);
                lastError = new Error(`${model}: Model not available`);
                continue;
            }

            if (!response.ok) {
                allQuotaExhausted = false;
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini] ${model} failed: ${response.status}`);
                lastError = new Error(`${model}: HTTP ${response.status} - ${errorData?.error?.message || 'Unknown'}`);
                continue;
            }

            allQuotaExhausted = false;
            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                console.warn(`[Gemini] ${model} empty response`);
                lastError = new Error(`${model}: Empty response`);
                continue;
            }

            console.log(`[Gemini] ✅ ${model} OK`);

            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            if (conversationHistory.length > 16) {
                conversationHistory = conversationHistory.slice(-16);
            }

            return aiText;

        } catch (error) {
            allQuotaExhausted = false;
            console.warn(`[Gemini] ${model} error:`, error.message);
            lastError = error;
            continue;
        }
    }

    // Remove the failed user message from history
    conversationHistory.pop();

    // Throw a user-friendly error
    if (allQuotaExhausted || lastError?.message === 'QUOTA_EXCEEDED') {
        throw new Error('⏳ API ถูกใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ (ประมาณ 1 นาที)');
    }

    console.error('[Gemini] ❌ All models failed:', lastError);
    throw lastError || new Error('ไม่สามารถเชื่อมต่อ AI ได้');
}

/**
 * Reset conversation history (e.g., when chat is closed/reopened)
 */
export function resetConversation() {
    conversationHistory = [];
}

// ==================== Proactive AI Insights ====================
export async function getDashboardInsights() {
    const cached = sessionStorage.getItem('ai_insights');
    if (cached) return JSON.parse(cached);

    const sysInstruction = buildBaseInstruction();
    const prompt = `จากข้อมูล Dashboard แม่โจ้:\n${sysInstruction}\n\nวิเคราะห์สรุป Insight 3 ข้อสั้นๆ (ข้อละ 1-2 บรรทัด) ห้ามแต่งตัวเลข ตอบเป็น JSON array เท่านั้น:\n\`\`\`json\n["insight1","insight2","insight3"]\n\`\`\``;

    await waitForRateLimit();

    for (const model of MODELS) {
        if (isModelOnCooldown(model)) continue;

        try {
            const apiUrl = getApiUrl(model);
            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
                })
            });

            if (response.status === 429) {
                modelCooldowns[model] = Date.now() + COOLDOWN_MS;
                continue;
            }
            if (!response.ok) continue;

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*?\]/);
            if (match) {
                const jsonStr = match[1] || match[0];
                const insights = JSON.parse(jsonStr);
                sessionStorage.setItem('ai_insights', JSON.stringify(insights));
                return insights;
            }
        } catch (error) {
            console.warn(`[Insights] ${model} error:`, error.message);
            continue;
        }
    }

    return [
        "ข้อมูลนิสิตปี 2568 คาดว่าจะแตะ 21,200 คน เติบโตขึ้นราว 7%",
        "คณะศิลปศาสตร์มีอัตราสำเร็จการศึกษาสูงกว่าค่าเฉลี่ยมหาวิทยาลัย (94.1%)",
        "คะแนนความประพฤติเฉลี่ยของนิสิตส่วนใหญ่อยู่ในเกณฑ์ดีเยี่ยม (92/100)"
    ];
}
