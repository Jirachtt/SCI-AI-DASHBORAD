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

// Models to try in order — spread across different model families for separate quota pools
const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
];

function getApiUrl(model) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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

// Rate limiting — minimum 2s between requests
let lastRequestTime = 0;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < 2000) {
        await new Promise(r => setTimeout(r, 2000 - elapsed));
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

// Cached system instruction (rebuilt only when needed)
let cachedSystemInstruction = null;

// Build compact system instruction — optimized for token efficiency
function buildSystemInstruction() {
    const budgetActual = universityBudgetData.yearly.filter(y => y.type === 'actual');
    const sciBudgetActual = scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual');

    // Build student summary (compact)
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

    // All student data as compact JSON (for accurate answers)
    const studentJSON = JSON.stringify(scienceStudentList.map(s => ({
        id: s.id, n: s.name, m: s.major, y: s.year, g: s.gpa, s: s.status, l: s.level
    })));

    return `คุณคือ "MJU AI Assistant" ผู้เชี่ยวชาญมหาวิทยาลัยแม่โจ้ (MJU)
ตอบเฉพาะเรื่องแม่โจ้เท่านั้น ถ้าถามเรื่องอื่นที่ไม่เกี่ยวกับแม่โจ้ → ปฏิเสธสุภาพ

## กฎ
1. ตอบภาษาไทย ใช้ emoji กระชับ
2. ข้อมูล Dashboard = แม่นยำสุด, เรื่องแม่โจ้ทั่วไป = ใช้ความรู้
3. เรื่องไม่เกี่ยวแม่โจ้ → ปฏิเสธ: "ขออภัยค่ะ ตอบได้เฉพาะเรื่องแม่โจ้เท่านั้นค่ะ 🎓"
4. **⚠️ สำคัญมาก: เมื่อสร้างกราฟ ต้องใช้ \`\`\`json_chart\`\`\` เท่านั้น (ห้ามใช้ \`\`\`json\`\`\`)** รูปแบบ:
\`\`\`json_chart
{"chartType":"bar","data":{"labels":["A","B"],"datasets":[{"label":"X","data":[10,20],"backgroundColor":["#00a651","#7B68EE"]}]}}
\`\`\`
รองรับ chartType: "bar", "line", "pie", "doughnut", "radar", "polarArea"
5. พยากรณ์ → คำนวณ + json_chart เสมอ
6. ถามนศ./รายชื่อ → ใช้ข้อมูลนักศึกษาด้านล่าง
7. **เปรียบเทียบข้ามหมวด:** เมื่อผู้ใช้ขอเปรียบเทียบ/รวมข้อมูลข้ามหมวด (เช่น นักศึกษา vs งบประมาณ, ค่าเทอม vs จำนวนนักศึกษา) → สร้าง json_chart ที่มีหลาย datasets แต่ละ dataset มาจากข้อมูลคนละหมวด ใช้สีต่างกันชัดเจน ถ้าหน่วยต่างกัน (คน vs ล้านบาท) → อธิบายหน่วยใน label ของ dataset
8. **ไฟล์ที่อัปโหลด:** ถ้ามีข้อมูลไฟล์ในบริบท สามารถรวมกับข้อมูล Dashboard เพื่อสร้างกราฟเปรียบเทียบได้

## แม่โจ้
- ก่อตั้ง 2477 ปรัชญา:"มหาวิทยาลัยแห่งชีวิต" ที่ตั้ง:สันทราย เชียงใหม่ 14,000ไร่
- 16คณะ: ผลิตกรรมฯ,วิทย์,วิศวะฯ,บริหาร,เศรษฐศาสตร์,ท่องเที่ยว,ศิลปศาสตร์,สถาปัตย์,สารสนเทศ,ประมง,สัตวศาสตร์,พลังงาน,นานาชาติ,พยาบาล,แพร่,ชุมพร
- คณะวิทย์: CS,IT,เคมี,ชีวะ,คณิต,ฟิสิกส์,สถิติ,DataSci,Biotech,เคมีอุตฯ
- TCAS: Portfolio/โควตา/Admission/Direct | ป.ตรี-โท-เอก

## Dashboard
- นิสิต:${dashboardSummary.totalStudents} GPA:${dashboardSummary.avgGPA} สำเร็จ:${dashboardSummary.graduationRate}% เทอม:${dashboardSummary.currentSemester}/${dashboardSummary.academicYear}
- คณะ: ${dashboardSummary.faculties.map(f => `${f.name}(${f.totalStudents},GPA${f.avgGPA.toFixed(2)},${f.graduationRate}%)`).join(' | ')}
- ระดับ: ${studentStatsData.current.byLevel.map(l => `${l.level}:${l.count}`).join(', ')} รวม:${studentStatsData.current.total}
- แยกคณะ: ${studentStatsData.byFaculty.map(f => `${f.name}(ตรี${f.bachelor}/โท${f.master}/เอก${f.doctoral})`).join(', ')}
- แนวโน้ม: ${studentStatsData.trend.map(t => `${t.year}:${t.total}(${t.type === 'actual' ? 'จริง' : 'พยากรณ์'})`).join(', ')}
- คณะวิทย์: ระดับ ${studentStatsData.scienceFaculty.byLevel.map(l => `${l.level}${l.count}`).join('/')} บุคลากร${studentStatsData.scienceFaculty.personnel.total}คน
- งบมหา'ลัย(ล้านบ.): ${budgetActual.map(y => `${y.year}:รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}
- งบคณะวิทย์(ล้านบ.): ${sciBudgetActual.map(y => `${y.year}:รับ${y.revenue}/จ่าย${y.expense}`).join(', ')}
- ค่าเทอม: ${tuitionData.flatRate.min}-${tuitionData.flatRate.max}บ./เทอม แยกคณะ:${tuitionData.byFaculty.map(f => `${f.name}${f.fee}บ.`).join(',')}
- การเงิน: เทอมนี้${financialData.tuitionStatus.current.amount}บ.(${financialData.tuitionStatus.current.status}) ชำระ${financialData.tuitionStatus.total.totalPaid}บ. ค้าง${financialData.tuitionStatus.total.totalRemaining}บ.
- ทุน:${financialData.scholarship.name} ${financialData.scholarship.amount}บ.(${financialData.scholarship.status})
- กิจกรรม: เป้า${studentLifeData.activityHours.target}ชม. ผ่าน${studentLifeData.activityHours.completed}ชม. ประพฤติ:${studentLifeData.behaviorScore.score}/${studentLifeData.behaviorScore.maxScore}

## นักศึกษาคณะวิทยาศาสตร์ (${scienceStudentList.length}คน)
สาขา: ${majorSummary}
ชั้นปี: ${yearSummary}
สถานะ: ปกติ${statusNormal} รอพินิจ${statusAtRisk}
ข้อมูลทั้งหมด(id=รหัส,n=ชื่อ,m=สาขา,y=ปี,g=GPA,s=สถานะ,l=ระดับ):
${studentJSON}`;
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

    const requestBody = {
        system_instruction: {
            parts: [{ text: cachedSystemInstruction || (cachedSystemInstruction = buildSystemInstruction()) }]
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

    let lastError = null;
    let allQuotaExhausted = true;

    // Try each model in order, skip models on cooldown
    for (const model of MODELS) {
        if (isModelOnCooldown(model)) {
            console.log(`[Gemini] Skipping ${model} (cooldown)`);
            continue;
        }

        try {
            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetchSmart(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (response.status === 429) {
                // Quota exceeded — put model on cooldown and try next
                modelCooldowns[model] = Date.now() + COOLDOWN_MS;
                console.warn(`[Gemini] ${model} quota exceeded, cooldown 60s`);
                lastError = new Error('QUOTA_EXCEEDED');
                continue;
            }

            if (response.status === 404) {
                // Model not found / deprecated — skip silently
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

            // Keep history compact — max 16 messages
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

    const sysInstruction = cachedSystemInstruction || (cachedSystemInstruction = buildSystemInstruction());
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
