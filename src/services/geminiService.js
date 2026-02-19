// Gemini API Service for MJU AI Dashboard Chatbot
import {
    studentStatsData, universityBudgetData, scienceFacultyBudgetData,
    tuitionData, financialData, studentLifeData, dashboardSummary
} from '../data/mockData';

const API_KEY = 'AIzaSyAzKvbB_3uXi5swR0RDjd5nkP6Gq6hHjCw';

// Models to try in order (fallback chain)
const MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-flash',
];

function getApiUrl(model) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
}

// Build the system instruction with all dashboard data as context
function buildSystemInstruction() {
    // Serialize all dashboard data for the AI context
    const budgetActual = universityBudgetData.yearly.filter(y => y.type === 'actual');
    const budgetForecast = universityBudgetData.yearly.filter(y => y.type === 'forecast');
    const sciBudgetActual = scienceFacultyBudgetData.yearly.filter(y => y.type === 'actual');
    const sciBudgetForecast = scienceFacultyBudgetData.yearly.filter(y => y.type === 'forecast');

    return `คุณคือ "MJU AI Assistant" ผู้เชี่ยวชาญด้าน Dashboard ของมหาวิทยาลัยแม่โจ้ (Maejo University - MJU)
คุณมีหน้าที่ตอบคำถามเกี่ยวกับข้อมูลที่มีอยู่ในระบบ Dashboard เท่านั้น

## กฎสำคัญ
1. ตอบเป็นภาษาไทยเสมอ ยกเว้นคำศัพท์เฉพาะ
2. ตอบเฉพาะข้อมูลที่มีอยู่ในระบบ Dashboard ด้านล่างเท่านั้น
3. ถ้าถูกถามเรื่องที่ไม่เกี่ยวข้องกับข้อมูลใน Dashboard หรือไม่มีข้อมูลในระบบ ให้ตอบว่า "ไม่ทราบข้อมูลนี้ในปัจจุบัน ผมตอบได้เฉพาะข้อมูลที่มีใน Dashboard มหาวิทยาลัยแม่โจ้เท่านั้นครับ"
4. ใช้ emoji ประกอบเพื่อให้อ่านง่าย
5. ตอบกระชับ ได้ใจความ
6. **คำสั่งพิเศษ: การสร้างกราฟอัตโนมัติ (Generative Chart)**
   เมื่อผู้ใช้ถามเรื่องสถิติ/งบประมาณ/การเปรียบเทียบในรูปแบบ **กราฟ (Chart)** 
   คุณสามารถวาดกราฟได้โดยตอบแนบ JSON block ไว้ส่วนท้ายของข้อความ ในรูปแบบดังนี้:
   \`\`\`json_chart
   {
     "chartType": "bar", // รองรับ "bar", "line", "pie", "doughnut", "radar", "polarArea"
     "data": {
       "labels": ["ปี 65", "ปี 66", "ปี 67"],
       "datasets": [
         {
           "label": "ตัวอย่างข้อมูล",
           "data": [100, 120, 150],
           "backgroundColor": ["#00a651", "#7B68EE", "#E91E63"], // สามารถใช้ array สีได้ยาวๆ ถ้าเป็น pie/doughnut/polarArea
           "borderColor": "#006838"
         }
       ]
     }
   }
   \`\`\`
   - พยายามเลือกโทนสีกราฟให้เหมาะสม (เช่น สีเขียว #00a651 สำหรับรายรับ/ภาพรวม, สีแดง #e91e63 สำหรับรายจ่าย, สำน้ำเงิน/ม่วง สำหรับนิสิต)
   - **สำคัญมากสำหรับ Radar Chart:** 
     1. ต้องมีข้อมูลอย่างน้อย 3 แกน (labels) ขึ้นไปเสมอ เพื่อให้กราฟสามารถวาดเป็นรูปหลายเหลี่ยมได้ (ห้ามสร้างดึงมาแค่ 1-2 ค่า เช่น เอามาแค่ GPA กับ อัตราสำเร็จ จะทำให้กราฟกลายเป็นเส้นตรงดิ่ง) แนะนำให้ดึงข้อมูลอื่่นมาเสริม เช่น จำนวนวิชาทั้งหมด หรือ จำนวนนิสิตที่นำมาแปลงสเกลแล้ว
     2. ข้อมูลแต่ละแนวแกนต้องมีสเกลใกล้เคียงกันเสมอ (0-100) หากต้องเปรียบเทียบข้อมูลคนละหน่วย (เช่น GPA 0-4 และ อัตราสำเร็จ 0-100%) **ให้คุณแปลงค่าทางคณิตศาสตร์ให้เป็นเปอร์เซ็นต์ (0-100%) ก่อนใส่ข้อมูลลงกราฟเสมอ** (เช่น GPA 3.0 ให้พ่นค่าออกมาเป็น 75) เพื่อไม่ให้กราฟเบี้ยว

7. **คำสั่งพิเศษ: การพยากรณ์ล่วงหน้า (Forecasting 5 ปี)**
   หากผู้ใช้ระบุคำว่า "พยากรณ์" หรือ "คาดการณ์แนวโน้ม" ล่วงหน้า (เช่น 5 ปี หรือถึงปี 2573)
   ให้คุณนำข้อมูลจริงในอดีต (Trend) มาคำนวณแนวโน้มการเติบโต (เช่น % เติบโตเฉลี่ย หรือ Linear Regression อย่างง่ายด้วยตัวคุณเอง)
   และ **สร้างข้อมูลอนาคตต่อเนื่องไปอีก 5 ปี** รวมเข้ากับข้อมูลเก่า 
   จากนั้นวาด \`\`\`json_chart\`\`\` กลับมา เป็น 'line' หรือ 'bar'
   - Label ของปีในอนาคต ให้ต่อท้ายด้วยคำว่า "(พยากรณ์)" เสมอ
   - คุณสามารถแยก dataset 2 ตัว (อดีต vs พยากรณ์) เพื่อให้กราฟแสดงเส้นประหรือสีอ่อนลงสำหรับช่วงพยากรณ์ได้

## ข้อมูลในระบบ Dashboard

### 1. สรุปภาพรวมมหาวิทยาลัย
- นิสิตคงอยู่ทั้งหมด: ${dashboardSummary.totalStudents.toLocaleString()} คน
- รายวิชาทั้งหมด: ${dashboardSummary.totalCourses} วิชา
- GPA เฉลี่ย: ${dashboardSummary.avgGPA}
- อัตราสำเร็จการศึกษา: ${dashboardSummary.graduationRate}%
- ภาคเรียนปัจจุบัน: ${dashboardSummary.currentSemester}
- ปีการศึกษา: ${dashboardSummary.academicYear}

### 2. ข้อมูลประสิทธิภาพระดับคณะ
${dashboardSummary.faculties.map(f => `- ${f.name}: นิสิต ${f.totalStudents.toLocaleString()} คน, ${f.totalCourses} รายวิชา, GPA เฉลี่ย ${f.avgGPA.toFixed(2)}, อัตราสำเร็จการศึกษา ${f.graduationRate}%`).join('\n')}

### 3. สถิตินิสิตปัจจุบัน (แยกตามระดับ)
${studentStatsData.current.byLevel.map(l => `- ${l.level}: ${l.count.toLocaleString()} คน`).join('\n')}
- รวม: ${studentStatsData.current.total.toLocaleString()} คน

### 4. สถิตินิสิตแยกตามคณะ
${studentStatsData.byFaculty.map(f => `- ${f.name}: ป.ตรี ${f.bachelor} / ป.โท ${f.master} / ป.เอก ${f.doctoral} (รวม ${f.bachelor + f.master + f.doctoral})`).join('\n')}

### 5. แนวโน้มจำนวนนิสิต (ย้อนหลัง + พยากรณ์)
${studentStatsData.trend.map(t => `- ปี ${t.year} (${t.type === 'actual' ? 'ข้อมูลจริง' : 'พยากรณ์'}): รวม ${t.total.toLocaleString()} คน (ป.ตรี ${t.bachelor.toLocaleString()} / ป.โท ${t.master} / ป.เอก ${t.doctoral})`).join('\n')}

### 6. คณะวิทยาศาสตร์ - รายละเอียด
- จำนวนนิสิตแยกตามระดับ:
${studentStatsData.scienceFaculty.byLevel.map(l => `  - ${l.level}: ${l.count} คน`).join('\n')}
- จำนวนนิสิตแยกตามปีที่เข้า:
${studentStatsData.scienceFaculty.byEnrollmentYear.map(e => `  - ปี ${e.year}: ${e.count} คน`).join('\n')}
- บุคลากร: ${studentStatsData.scienceFaculty.personnel.total} คน (ชาย ${studentStatsData.scienceFaculty.personnel.male} / หญิง ${studentStatsData.scienceFaculty.personnel.female})
  - ตามประเภท: ${studentStatsData.scienceFaculty.personnel.byType.map(t => `${t.type} ${t.count} คน`).join(', ')}
  - ตามตำแหน่ง: ${studentStatsData.scienceFaculty.personnel.byPosition.map(p => `${p.position} ${p.count} คน`).join(', ')}
  - ตามวุฒิ: ${studentStatsData.scienceFaculty.personnel.byEducation.map(e => `${e.level} ${e.count} คน`).join(', ')}

### 7. งบประมาณมหาวิทยาลัย (ล้านบาท)
ข้อมูลจริง:
${budgetActual.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
พยากรณ์:
${budgetForecast.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
- อัตราเติบโตรายรับเฉลี่ย: ${universityBudgetData.summary.avgGrowthRevenue}% ต่อปี
- อัตราเติบโตรายจ่ายเฉลี่ย: ${universityBudgetData.summary.avgGrowthExpense}% ต่อปี

### 8. งบประมาณคณะวิทยาศาสตร์ (ล้านบาท)
ข้อมูลจริง:
${sciBudgetActual.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
พยากรณ์:
${sciBudgetForecast.map(y => `- ปี ${y.year}: รายรับ ${y.revenue} / รายจ่าย ${y.expense} / คงเหลือ ${y.surplus}`).join('\n')}
- อัตราเติบโตรายรับเฉลี่ย: ${scienceFacultyBudgetData.summary.avgGrowthRevenue}% ต่อปี

### 9. ค่าธรรมเนียมการศึกษา
- ค่าเทอม (เหมาจ่าย): ${tuitionData.flatRate.min.toLocaleString()} - ${tuitionData.flatRate.max.toLocaleString()} บาท/เทอม
- ค่าแรกเข้า: ${tuitionData.entryFee.min.toLocaleString()} - ${tuitionData.entryFee.max.toLocaleString()} บาท
- ตลอดหลักสูตร 4 ปี: ${tuitionData.totalCost.min.toLocaleString()} - ${tuitionData.totalCost.max.toLocaleString()} บาท
- แยกตามคณะ:
${tuitionData.byFaculty.map(f => `  - ${f.name}: ${f.fee.toLocaleString()} บาท`).join('\n')}

### 10. ข้อมูลการเงิน
- ค่าเทอมปัจจุบัน: ${financialData.tuitionStatus.current.amount.toLocaleString()} บาท (${financialData.tuitionStatus.current.status})
- ครบกำหนด: ${financialData.tuitionStatus.current.dueDate}
- ยอดชำระแล้วรวม: ${financialData.tuitionStatus.total.totalPaid.toLocaleString()} บาท
- ยอดคงค้าง: ${financialData.tuitionStatus.total.totalRemaining.toLocaleString()} บาท
- ทุนการศึกษา: ${financialData.scholarship.name} — ${financialData.scholarship.amount.toLocaleString()} บาท (${financialData.scholarship.status})

### 11. กิจกรรมนักศึกษา
- ชั่วโมงกิจกรรมเป้าหมาย: ${studentLifeData.activityHours.target} ชม.
- ผ่านแล้ว: ${studentLifeData.activityHours.completed} ชม.
- แยกตามหมวด:
${studentLifeData.activityHours.categories.map(c => `  - ${c.name}: ${c.hours} ชม.`).join('\n')}

### 12. คะแนนความประพฤติ
- คะแนนปัจจุบัน: ${studentLifeData.behaviorScore.score}/${studentLifeData.behaviorScore.maxScore}
- ประวัติ: ${studentLifeData.behaviorScore.history.map(h => `${h.semester}: ${h.score}`).join(' → ')}

### 13. ห้องสมุด (รายการยืมหนังสือ)
${studentLifeData.library.map(b => `- ${b.title}: สถานะ ${b.status}${b.fine > 0 ? ` (ค่าปรับ ${b.fine} บาท)` : ''}`).join('\n')}

### 14. หน้าต่างๆ ที่มีใน Dashboard
- หน้าแรก: สรุปข้อมูลทั้งหมด
- ค่าธรรมเนียม: ค่าเทอมแยกตามคณะ
- สถิตินิสิต: จำนวนนิสิตแยกคณะ/ระดับ
- งบประมาณคณะ: รายรับ-รายจ่าย พร้อมกราฟพยากรณ์
- การเงิน: สถานะค่าเทอม/ทุน
- กิจกรรม: ชั่วโมงกิจกรรม/ความประพฤติ
- รายชื่อนักศึกษา: ค้นหา/กรอง/Export CSV
- ตรวจสอบการจบ: ตรวจหน่วยกิต/เกรด`;
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
    // Add user message to history
    conversationHistory.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const requestBody = {
        system_instruction: {
            parts: [{ text: buildSystemInstruction() }]
        },
        contents: conversationHistory,
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
    };

    let lastError = null;

    // Try each model in order
    for (const model of MODELS) {
        try {
            console.log(`[Gemini] Trying model: ${model}...`);
            const apiUrl = getApiUrl(model);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.warn(`[Gemini] Model ${model} failed with status ${response.status}:`, errorData?.error?.message || errorData);
                lastError = new Error(`${model}: HTTP ${response.status} - ${errorData?.error?.message || 'Unknown error'}`);
                continue; // Try next model
            }

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiText) {
                console.warn(`[Gemini] Model ${model} returned empty response:`, JSON.stringify(data).substring(0, 500));
                lastError = new Error(`${model}: Empty response`);
                continue; // Try next model
            }

            // Success!
            console.log(`[Gemini] ✅ Model ${model} responded successfully`);

            // Add AI response to history
            conversationHistory.push({
                role: 'model',
                parts: [{ text: aiText }]
            });

            // Keep history manageable (last 20 turns)
            if (conversationHistory.length > 40) {
                conversationHistory = conversationHistory.slice(-40);
            }

            return aiText;

        } catch (error) {
            // Network error or other issue
            console.warn(`[Gemini] Model ${model} error:`, error.message);
            lastError = error;
            continue; // Try next model
        }
    }

    // All models failed — remove the failed user message from history
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

    const prompt = `จากข้อมูลใน Dashboard ของมหาวิทยาลัยแม่โจ้ต่อไปนี้:\n${buildSystemInstruction()}
    
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

    try {
        const apiUrl = getApiUrl(MODELS[0]); // Use primary model
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const match = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
            const insights = JSON.parse(match[1]);
            sessionStorage.setItem('ai_insights', JSON.stringify(insights));
            return insights;
        }
    } catch (error) {
        console.error("Failed to fetch AI insights", error);
    }

    // Fallback static insights if API fails
    return [
        "ข้อมูลนิสิตปี 2568 คาดว่าจะแตะ 21,200 คน เติบโตขึ้นราว 7%",
        "คณะศิลปศาสตร์มีอัตราสำเร็จการศึกษาสูงกว่าค่าเฉลี่ยมหาวิทยาลัย (94.1%)",
        "คะแนนความประพฤติเฉลี่ยของนิสิตส่วนใหญ่อยู่ในเกณฑ์ดีเยี่ยม (92/100)"
    ];
}
