// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, financialData, studentLifeData, dashboardSummary
} from '../data/mockData';
import { scienceStudentList, SCIENCE_MAJORS } from '../data/studentListData';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
if (!API_KEY) {
    console.warn('[Gemini] ⚠️ VITE_GEMINI_API_KEY is not set. AI Chat will fall back to local responses only.');
}

// Models to try in order (fallback chain) — verified available via API
const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
];

function getApiUrl(model) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
}

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

// Retry helper for rate-limited and transient error requests
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
                const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[Gemini] HTTP ${response.status}, retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, waitMs));
                continue;
            }
            return response;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('คำขอหมดเวลา (Timeout 30s) — กรุณาลองใหม่อีกครั้ง');
            }
            throw err;
        }
    }
}

// Cached system instruction (rebuilt only when needed)
let cachedSystemInstruction = null;

// Build the system instruction with all dashboard data + MJU general knowledge
function buildSystemInstruction() {
    const budgetActual = universityBudgetData.yearly.filter(y => y.type === 'actual');
    const budgetForecast = universityBudgetData.yearly.filter(y => y.type === 'forecast');
    const sciBudgetActual = scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual');
    const sciBudgetForecast = scienceFacultyBudgetData.yearly.filter(y => y.type === 'forecast');

    // Build student summary for AI context
    const majorCounts = {};
    const yearCounts = {};
    let statusNormal = 0, statusAtRisk = 0;
    scienceStudentList.forEach(s => {
        majorCounts[s.major] = (majorCounts[s.major] || 0) + 1;
        yearCounts[s.year] = (yearCounts[s.year] || 0) + 1;
        if (s.status === 'รอพินิจ') statusAtRisk++; else statusNormal++;
    });
    const majorSummary = Object.entries(majorCounts).map(([m, c]) => `- สาขา${m}: ${c} คน`).join('\n');
    const yearSummary = Object.entries(yearCounts).sort().map(([y, c]) => `- ชั้นปี ${y}: ${c} คน`).join('\n');
    const sampleStudents = scienceStudentList.slice(0, 20).map((s, i) =>
        `${i + 1}. ${s.id} ${s.name} (${s.major}, ปี${s.year}, GPA ${s.gpa})`
    ).join('\n');

    return `คุณคือ "MJU AI Assistant" ผู้เชี่ยวชาญด้านมหาวิทยาลัยแม่โจ้ (Maejo University - MJU) ทุกด้าน
คุณตอบคำถามเกี่ยวกับข้อมูลในระบบ Dashboard และข้อมูลทั่วไปเกี่ยวกับมหาวิทยาลัยแม่โจ้ทุกเรื่อง

## กฎสำคัญ
1. ตอบเป็นภาษาไทยเสมอ ยกเว้นคำศัพท์เฉพาะ
2. ถ้ามีข้อมูลใน Dashboard ให้ใช้ข้อมูลนั้นเป็นหลัก (แม่นยำสุด)
3. ถ้าถูกถามเรื่องเกี่ยวกับแม่โจ้ที่ไม่มีใน Dashboard ให้ใช้ความรู้ทั่วไปตอบ
4. ถ้าถูกถามเรื่องทั่วไปที่ไม่เกี่ยวข้องกับมหาวิทยาลัยแม่โจ้ ห้ามตอบเด็ดขาด ให้ปฏิเสธอย่างสุภาพว่า "ขออภัยค่ะ ฉันเป็น MJU AI Assistant สามารถตอบได้เฉพาะเรื่องที่เกี่ยวข้องกับมหาวิทยาลัยแม่โจ้เท่านั้นค่ะ 🎓 ลองถามเรื่องเกี่ยวกับแม่โจ้ได้เลยนะคะ!"
5. ใช้ emoji ประกอบเพื่อให้อ่านง่าย ตอบกระชับ ได้ใจความ
6. **คำสั่งบังคับ: การสร้างกราฟ (MANDATORY Chart Generation)**
   เมื่อผู้ใช้ขอ กราฟ, chart, แผนภูมิ, แท่ง, เส้น, วงกลม, radar → ต้องแนบ \`\`\`json_chart\`\`\` block ท้ายข้อความเสมอ ห้ามตอบเป็นแค่ตัวหนังสือ
   รูปแบบ:
   \`\`\`json_chart
   {"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["#00a651","#7B68EE"]}]}}
   \`\`\`
   รองรับ: "bar", "line", "pie", "doughnut", "radar", "polarArea"
   - Radar: ต้อง ≥3 แกน, ข้อมูลสเกลเดียวกัน (0-100%)
   - **⚠️ กราฟ/chart/แท่ง/เส้น/วงกลม → ต้องมี json_chart block เสมอ**
7. **พยากรณ์:** ถ้าผู้ใช้พูด "พยากรณ์"/"คาดการณ์" → คำนวณแนวโน้ม + สร้าง json_chart เสมอ
8. **เมื่อถูกถามเรื่องนักศึกษา/รายชื่อ** → ใช้ข้อมูลจากส่วน "รายชื่อนักศึกษา" ด้านล่าง

## ข้อมูลทั่วไปมหาวิทยาลัยแม่โจ้

### ประวัติ
- ชื่อเต็ม: มหาวิทยาลัยแม่โจ้ (Maejo University) ก่อตั้ง พ.ศ. 2477 (ค.ศ. 1934)
- เดิมชื่อ "โรงเรียนฝึกหัดครูประถมกสิกรรมภาคเหนือ" → สถาบันเทคโนโลยีการเกษตรแม่โจ้ → มหาวิทยาลัยแม่โจ้ (พ.ศ. 2539)
- ปรัชญา: "มหาวิทยาลัยแห่งชีวิต" สีประจำ: เขียว-ขาว-เหลือง ต้นไม้: อินทนิล
- อายุ: 90+ ปี เป็นหนึ่งในมหาวิทยาลัยเก่าแก่ที่สุดของประเทศไทย

### ที่ตั้ง
- 63 หมู่ 4 ต.หนองหาร อ.สันทราย จ.เชียงใหม่ 50290 (ห่างตัวเมือง ~15 กม.)
- วิทยาเขต: เชียงใหม่ (หลัก), แพร่ เฉลิมพระเกียรติ, ชุมพร
- พื้นที่: ~14,000 ไร่ มีฟาร์มเกษตร 7,000+ ไร่

### คณะ/วิทยาลัย (16+ หน่วยงาน)
1.ผลิตกรรมการเกษตร 2.วิทยาศาสตร์ 3.วิศวกรรมและอุตสาหกรรมเกษตร 4.บริหารธุรกิจ 5.เศรษฐศาสตร์ 6.พัฒนาการท่องเที่ยว 7.ศิลปศาสตร์ 8.สถาปัตยกรรมศาสตร์ 9.สารสนเทศและการสื่อสาร 10.เทคโนโลยีการประมง 11.สัตวศาสตร์และเทคโนโลยี 12.วิทยาลัยพลังงานทดแทน 13.วิทยาลัยนานาชาติ 14.พยาบาลศาสตร์ 15.แม่โจ้-แพร่ 16.แม่โจ้-ชุมพร

### คณะวิทยาศาสตร์ (รายละเอียด)
- หลักสูตร: วิทยาการคอมพิวเตอร์, IT, เคมี, ชีววิทยา, คณิตศาสตร์, ฟิสิกส์ประยุกต์, สถิติ, วิทยาการข้อมูล, เทคโนโลยีชีวภาพ, เคมีอุตสาหกรรม
- จุดเด่น: หลักสูตร Data Science ที่ทันสมัย, ห้องปฏิบัติการวิจัยครบครัน

### การรับสมัคร
- TCAS: Portfolio, โควตา, Admission, Direct Admission
- ระดับ: ป.ตรี, ป.โท, ป.เอก
- เว็บสมัคร: admissions.mju.ac.th | เว็บหลัก: www.mju.ac.th

### ความโดดเด่น
- มหาวิทยาลัยเกษตรชั้นนำของภาคเหนือ
- ศูนย์วิจัยเกษตรอินทรีย์ชั้นนำ มีพิพิธภัณฑ์วัฒนธรรมเกษตร
- สิ่งอำนวยความสะดวก: สนามกีฬา, สระว่ายน้ำ, หอพัก, โรงอาหาร
- เครือข่ายศิษย์เก่าเข้มแข็งทั่วประเทศ

## ข้อมูลในระบบ Dashboard

### 1. สรุปภาพรวม
- นิสิตคงอยู่: ${dashboardSummary.totalStudents.toLocaleString()} คน, ${dashboardSummary.totalCourses} วิชา
- GPA เฉลี่ย: ${dashboardSummary.avgGPA}, อัตราสำเร็จ: ${dashboardSummary.graduationRate}%
- ภาคเรียน: ${dashboardSummary.currentSemester} ปีการศึกษา ${dashboardSummary.academicYear}

### 2. ข้อมูลคณะ
${dashboardSummary.faculties.map(f => `- ${f.name}: ${f.totalStudents.toLocaleString()} คน, ${f.totalCourses} วิชา, GPA ${f.avgGPA.toFixed(2)}, สำเร็จ ${f.graduationRate}%`).join('\n')}

### 3. สถิตินิสิตปัจจุบัน
${studentStatsData.current.byLevel.map(l => `- ${l.level}: ${l.count.toLocaleString()} คน`).join('\n')}
- รวม: ${studentStatsData.current.total.toLocaleString()} คน

### 4. สถิตินิสิตแยกตามคณะ
${studentStatsData.byFaculty.map(f => `- ${f.name}: ป.ตรี ${f.bachelor} / ป.โท ${f.master} / ป.เอก ${f.doctoral}`).join('\n')}

### 5. แนวโน้มจำนวนนิสิต
${studentStatsData.trend.map(t => `- ปี ${t.year} (${t.type === 'actual' ? 'จริง' : 'พยากรณ์'}): รวม ${t.total.toLocaleString()} คน`).join('\n')}

### 6. คณะวิทยาศาสตร์
- นิสิตแยกตามระดับ: ${studentStatsData.scienceFaculty.byLevel.map(l => `${l.level} ${l.count} คน`).join(', ')}
- นิสิตแยกตามปีเข้า: ${studentStatsData.scienceFaculty.byEnrollmentYear.map(e => `ปี${e.year} ${e.count}คน`).join(', ')}
- บุคลากร: ${studentStatsData.scienceFaculty.personnel.total} คน (ชาย ${studentStatsData.scienceFaculty.personnel.male} / หญิง ${studentStatsData.scienceFaculty.personnel.female})
  - ตำแหน่ง: ${studentStatsData.scienceFaculty.personnel.byPosition.map(p => `${p.position} ${p.count}`).join(', ')}
  - วุฒิ: ${studentStatsData.scienceFaculty.personnel.byEducation.map(e => `${e.level} ${e.count}`).join(', ')}

### 7. งบประมาณมหาวิทยาลัย (ล้านบาท)
${budgetActual.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
พยากรณ์: ${budgetForecast.map(y => `ปี${y.year}: รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}
- เติบโตรายรับ: ${universityBudgetData.summary.avgGrowthRevenue}%/ปี, รายจ่าย: ${universityBudgetData.summary.avgGrowthExpense}%/ปี

### 8. งบประมาณคณะวิทยาศาสตร์ (ล้านบาท)
${sciBudgetActual.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
พยากรณ์: ${sciBudgetForecast.map(y => `ปี${y.year}: รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}

### 9. ค่าธรรมเนียมการศึกษา
- ค่าเทอม: ${tuitionData.flatRate.min.toLocaleString()}-${tuitionData.flatRate.max.toLocaleString()} บาท/เทอม
- ค่าแรกเข้า: ${tuitionData.entryFee.min.toLocaleString()}-${tuitionData.entryFee.max.toLocaleString()} บาท
- ตลอดหลักสูตร: ${tuitionData.totalCost.min.toLocaleString()}-${tuitionData.totalCost.max.toLocaleString()} บาท
- แยกตามคณะ: ${tuitionData.byFaculty.map(f => `${f.name} ${f.fee.toLocaleString()}บ.`).join(', ')}

### 10. ข้อมูลการเงิน
- ค่าเทอม: ${financialData.tuitionStatus.current.amount.toLocaleString()} บาท (${financialData.tuitionStatus.current.status}) กำหนด ${financialData.tuitionStatus.current.dueDate}
- ชำระแล้ว: ${financialData.tuitionStatus.total.totalPaid.toLocaleString()} บาท คงค้าง: ${financialData.tuitionStatus.total.totalRemaining.toLocaleString()} บาท
- ทุน: ${financialData.scholarship.name} — ${financialData.scholarship.amount.toLocaleString()} บาท (${financialData.scholarship.status})

### 11. กิจกรรมนักศึกษา
- เป้าหมาย: ${studentLifeData.activityHours.target} ชม. ผ่านแล้ว: ${studentLifeData.activityHours.completed} ชม.
- หมวด: ${studentLifeData.activityHours.categories.map(c => `${c.name} ${c.hours}ชม.`).join(', ')}

### 12. ความประพฤติ
- คะแนน: ${studentLifeData.behaviorScore.score}/${studentLifeData.behaviorScore.maxScore}

### 13. รายชื่อนักศึกษาในระบบ (คณะวิทยาศาสตร์)
จำนวนทั้งหมด: ${scienceStudentList.length} คน
แยกตามสาขา:
${majorSummary}
แยกตามชั้นปี:
${yearSummary}
สถานะ: ปกติ ${statusNormal} คน / รอพินิจ ${statusAtRisk} คน
ตัวอย่างรายชื่อ (20 คนแรก):
${sampleStudents}
**ถ้าถูกถามเรื่องนักศึกษา ให้ตอบจากข้อมูลนี้ได้เลย**

### 14. หน้าต่างๆ ใน Dashboard
- Overview: สรุปภาพรวม | HR: บุคลากร | สถิตินิสิต: แยกคณะ/ระดับ
- รายชื่อนักศึกษา: ค้นหา/กรอง/Export (admin only)
- ตรวจสอบการจบ | กิจกรรม/พฤติกรรม | วิจัย/Scopus
- รายรับ-รายจ่าย | ค่าธรรมเนียม | พยากรณ์งบ (Linear Regression)
- ยุทธศาสตร์/OKR | AI Chat: แชทกับ AI + อัปโหลด CSV + สั่งด้วยเสียง`;
}

// Conversation history for multi-turn chat
let conversationHistory = [];

/**
 * Send a message to the Gemini API and return the response text.
 * Tries multiple models in order until one succeeds.
 * @param {string} userMessage - The user's message
 * @returns {Promise<string>} - The AI response text
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

    const requestBody = {
        system_instruction: {
            parts: [{ text: cachedSystemInstruction || (cachedSystemInstruction = buildSystemInstruction()) }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ]
    };

    let lastError = null;

    // Try each model in order
    for (const model of MODELS) {
        try {
            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini] Model ${model} failed with status ${response.status}:`, errorData?.error?.message || errorData);
                lastError = new Error(`${model}: HTTP ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
                continue;
            }

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                console.warn(`[Gemini] Model ${model} returned empty response:`, JSON.stringify(data).substring(0, 500));
                lastError = new Error(`${model}: Empty response`);
                continue;
            }

            console.log(`[Gemini] ✅ Model ${model} responded successfully`);

            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            if (conversationHistory.length > 40) {
                conversationHistory = conversationHistory.slice(-40);
            }

            return aiText;

        } catch (error) {
            console.warn(`[Gemini] Model ${model} error:`, error.message);
            lastError = error;
            continue;
        }
    }

    conversationHistory.pop();
    console.error('[Gemini] ❌ All models failed. Last error:', lastError);
    throw lastError || new Error('All Gemini models failed');
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

    const sysInstruction = cachedSystemInstruction || (cachedSystemInstruction = buildSystemInstruction());
    const prompt = `จากข้อมูลใน Dashboard ของมหาวิทยาลัยแม่โจ้ต่อไปนี้:\n${sysInstruction}
    
บรรทัดฐาน:
ให้คุณทำหน้าที่เป็น Data Analyst วิเคราะห์ข้อมูลทั้งหมดแล้วสรุป "Insight ที่น่าสนใจ / ข้อควรระวัง / หรือแนวโน้มสำคัญ" มา 3 ข้อสั้นๆ กระชับๆ (ข้อละไม่เกิน 1-2 บรรทัด)
ห้ามแต่งตัวเลขเองเด็ดขาด ให้ดึงจากข้อมูลที่มีเท่านั้น
ให้ตอบกลับมาเป็น JSON array ของ String เท่านั้น ห้ามพิมพ์ข้อความอื่นนอกกรอบ JSON
ตัวอย่าง: 
\`\`\`json
[
  "อัตราสำเร็จการศึกษาของคณะศิลปศาสตร์โดดเด่นสูงสุดที่ 94.1% ทิ้งห่างค่าเฉลี่ยของมหาวิทยาลัย",
  "แนวโน้มจำนวนนิสิต ป.ตรี ในปี 2568 คาดว่าจะเติบโตขึ้นทะลุ 20,000 คน",
  "งบประมาณรวมของมหาวิทยาลัยมีรายได้มากกว่ารายจ่าย แต่ควรระวังสถานะค้างชำระค่าเทอมของเทอม 1/2568"
]
\`\`\`
`;

    for (const model of MODELS) {
        try {
            const apiUrl = getApiUrl(model);
            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });

            if (!response.ok) { console.warn(`[Insights] Model ${model} failed`); continue; }
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const match = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) {
                const insights = JSON.parse(match[1]);
                sessionStorage.setItem('ai_insights', JSON.stringify(insights));
                return insights;
            }
        } catch (error) {
            console.warn(`[Insights] Model ${model} error:`, error.message);
            continue;
        }
    }

    return [
        "ข้อมูลนิสิตปี 2568 คาดว่าจะแตะ 21,200 คน เติบโตขึ้นราว 7%",
        "คณะศิลปศาสตร์มีอัตราสำเร็จการศึกษาสูงกว่าค่าเฉลี่ยมหาวิทยาลัย (94.1%)",
        "คะแนนความประพฤติเฉลี่ยของนิสิตส่วนใหญ่อยู่ในเกณฑ์ดีเยี่ยม (92/100)"
    ];
}
