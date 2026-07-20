function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
}
function parseLimit(question = '', fallback = 10) {
    const text = normalizeText(question);
    const explicit = text.match(/(?:แค่|ขอ|เอา|แสดง|โชว์|top)\s*(\d+)/i)
        || text.match(/(\d+)\s*(คน|ราย|รายการ|อันดับ)?/);
    const value = Number(explicit?.[1]);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.min(Math.max(Math.trunc(value), 1), 50);
}

function isTopGpaQuery(text) {
    return /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(สูงสุด|มากสุด|มากที่สุด|top)|(?:สูงสุด|มากสุด|มากที่สุด|top).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)/.test(text);
}

function isLowGpaQuery(text) {
    return /(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย).*(ต่ำสุด|น้อยสุด|น้อยที่สุด|ต่ำ|รอพินิจ|เสี่ยง)|(?:ต่ำสุด|น้อยสุด|น้อยที่สุด).*(gpa|เกรด|คะแนนเฉลี่ย|เกรดเฉลี่ย)|รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยงพ้นสภาพ/.test(text);
}

function fullName(student = {}) {
    return `${student.prefix || ''}${student.name || ''}`.replace(/\s+/g, ' ').trim();
}

export function isStudentRosterLookupQuestion(question = '') {
    const text = normalizeText(question);
    if (/\b6\d{9}\b/.test(text)) return true;
    if (/(?:รหัส|id)\s*\d{2,}/i.test(text)) return true;
    if (/(ค้นหานักศึกษา|หานักศึกษา|ชื่อนักศึกษา|ชื่อนิสิต|รายชื่อนักศึกษา|รายชื่อนิสิต)/.test(text)) return true;
    if (/รายชื่อ/.test(text) && /(นักศึกษา|นิสิต|รหัส|gpa|เกรด|ชั้นปี|สาขา|รอพินิจ|เสี่ยง|เกียรตินิยม)/.test(text)) return true;
    return isTopGpaQuery(text) || isLowGpaQuery(text);
}

/**
 * Deterministic roster lookup used by both AI chat surfaces. It always reads
 * the rows supplied by the caller, so a Firestore/local realtime update is
 * visible on the very next question without waiting for an LLM cache refresh.
 */
export function findStudentRowsForAI(question = '', studentRows = []) {
    const all = Array.isArray(studentRows) ? studentRows.filter(Boolean) : [];
    if (all.length === 0) return { results: [], total: 0, description: '', limit: 0 };

    const text = normalizeText(question);
    let results = [];
    let description = '';
    let limit = parseLimit(text, 10);

    const wantsTop = isTopGpaQuery(text);
    const wantsLow = isLowGpaQuery(text);
    if (wantsTop || wantsLow) {
        results = all
            .filter(student => Number.isFinite(Number(student.gpa)))
            .sort((a, b) => {
                const delta = wantsLow
                    ? Number(a.gpa) - Number(b.gpa)
                    : Number(b.gpa) - Number(a.gpa);
                return delta || String(a.id || '').localeCompare(String(b.id || ''), 'th');
            });
        description = wantsLow ? 'GPA ต่ำสุด' : 'GPA สูงสุด';
    }

    const fullId = results.length === 0 ? text.match(/\b(6\d{9})\b/)?.[1] : null;
    if (fullId) {
        results = all.filter(student => String(student.id || '') === fullId);
        description = `รหัสนักศึกษา "${fullId}"`;
        limit = 1;
    }

    if (results.length === 0) {
        const prefix = (text.match(/(?:รหัส|id)\s*(\d{2,9})/i) || text.match(/\b(6\d{1,8})\b/))?.[1];
        if (prefix) {
            results = all.filter(student => String(student.id || '').startsWith(prefix));
            description = `รหัสขึ้นต้นด้วย "${prefix}"`;
        }
    }

    if (results.length === 0) {
        const quotedName = text.match(/["“”']([^"“”']{2,})["“”']/)?.[1]?.trim();
        const named = text.match(/(?:ชื่อ|ค้นหา|หา)\s+([^\d,?]{2,})/)?.[1]?.trim();
        const searchName = quotedName || named;
        if (searchName) {
            const compactSearch = searchName.replace(/\s+/g, ' ').trim();
            results = all.filter(student => fullName(student).toLowerCase().includes(compactSearch));
            description = `ชื่อ "${compactSearch}"`;
        }
    }

    const majorKeywords = {
        'คอม': 'วิทยาการคอมพิวเตอร์',
        'ไอที': 'เทคโนโลยีสารสนเทศ',
        'it': 'เทคโนโลยีสารสนเทศ',
        'คณิต': 'คณิตศาสตร์',
        'เคมี': 'เคมี',
        'ฟิสิกส์': 'ฟิสิกส์ประยุกต์',
        'ชีว': 'เทคโนโลยีชีวภาพ',
        'วัสดุ': 'วัสดุศาสตร์',
        'สิ่งทอ': 'เคมีอุตสาหกรรมและเทคโนโลยีสิ่งทอ',
        'สถิติ': 'สถิติ',
    };
    if (results.length === 0) {
        const matchedMajor = Object.entries(majorKeywords).find(([keyword]) => text.includes(keyword));
        if (matchedMajor && /(สาขา|นักศึกษา|นิสิต|คน|รายชื่อ|ใคร)/.test(text)) {
            results = all.filter(student => student.major === matchedMajor[1]);
            description = `สาขา${matchedMajor[1]}`;
        }
    }

    if (results.length === 0) {
        const year = Number(text.match(/(?:ชั้นปี|ปี)\s*([1-4])/)?.[1]);
        if (year && /(นักศึกษา|นิสิต|รายชื่อ|คน|ใคร)/.test(text)) {
            results = all.filter(student => Number(student.year) === year);
            description = `ชั้นปี ${year}`;
        }
    }

    if (results.length === 0 && /(รอพินิจ|เกรดต่ำ|กลุ่มเสี่ยง|เสี่ยง)/.test(text)) {
        results = all.filter(student => Number(student.gpa) < 2);
        description = 'สถานะรอพินิจ (GPA < 2.00)';
    }

    if (results.length === 0 && /(เกรดสูง|เกียรตินิยม|gpa สูง)/.test(text)) {
        results = all
            .filter(student => Number(student.gpa) >= 3.5)
            .sort((a, b) => Number(b.gpa) - Number(a.gpa));
        description = 'GPA สูง (>= 3.50)';
    }

    // A plain roster request should still return a deterministic page rather
    // than falling through to an LLM that may invent or reorder names.
    if (results.length === 0 && /(รายชื่อนักศึกษา|รายชื่อนิสิต|ขอรายชื่อ)/.test(text)) {
        results = [...all].sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'th'));
        description = 'จาก roster ปัจจุบันของระบบ';
    }

    const total = results.length;
    return {
        results: results.slice(0, limit),
        total,
        description,
        limit,
    };
}
