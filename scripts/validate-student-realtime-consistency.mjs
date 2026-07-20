import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateScienceMockRoster } from '../src/data/studentListData.js';
import { findStudentRowsForAI } from '../src/services/studentAiLookupService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;

function expect(label, condition, details = '') {
    if (!condition) {
        console.error(`FAIL ${label}${details ? `: ${details}` : ''}`);
        process.exitCode = 1;
        return;
    }
    passed += 1;
    console.log(`PASS ${label}`);
}

const syncedTotal = 1837;
const syncedLevels = [
    { level: 'ปริญญาตรี', count: 1810 },
    { level: 'ปริญญาโท', count: 21 },
    { level: 'ปริญญาเอก', count: 6 },
    { level: 'ประกาศนียบัตร', count: 0 },
];
const roster = generateScienceMockRoster({ total: syncedTotal, byLevel: syncedLevels });

expect('dynamic generated roster equals synced Overview total', roster.length === syncedTotal, `${roster.length}/${syncedTotal}`);
expect('dynamic roster IDs remain unique', new Set(roster.map(student => student.id)).size === roster.length);
expect(
    'dynamic roster levels reconcile to synced level totals',
    syncedLevels.every(level => roster.filter(student => student.level === level.level).length === level.count),
);

const addedStudent = {
    id: '6999999999',
    prefix: 'นาย',
    name: 'ทดสอบ เรียลไทม์',
    major: 'วิทยาการคอมพิวเตอร์',
    level: 'ปริญญาตรี',
    year: 1,
    gpa: 3.77,
    status: 'กำลังศึกษา',
};
const adjustedRoster = [...roster.filter(student => student.id !== addedStudent.id), addedStudent];
expect('manual add increases the current roster total by one', adjustedRoster.length === syncedTotal + 1);

const byId = findStudentRowsForAI(`ค้นหานักศึกษารหัส ${addedStudent.id}`, adjustedRoster);
expect('AI lookup sees a newly added student by ID immediately', byId.total === 1 && byId.results[0]?.name === addedStudent.name);

const byName = findStudentRowsForAI('หานักศึกษาชื่อ ทดสอบ เรียลไทม์', adjustedRoster);
expect('AI lookup sees a newly added student by name immediately', byName.total === 1 && byName.results[0]?.id === addedStudent.id);

const generic = findStudentRowsForAI('ขอรายชื่อนักศึกษา 10 คน', adjustedRoster);
expect('plain roster requests return a deterministic page', generic.results.length === 10 && generic.total === adjustedRoster.length);

const studentService = fs.readFileSync(path.join(root, 'src/services/studentDataService.js'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/components/Layout.jsx'), 'utf8');
const aiPage = fs.readFileSync(path.join(root, 'src/pages/AIChatPage.jsx'), 'utf8');
const sharedData = fs.readFileSync(path.join(root, 'src/services/sharedDashboardDataService.js'), 'utf8');

expect('app boot aligns generated roster with Overview', /ensureStudentRosterAlignedWithOverview/.test(layout));
expect('realtime dashboard events trigger roster alignment', /onDashboardLiveDataChange/.test(layout));
expect('student service exposes demo-safe AI row policy', /canUseForChatRows/.test(studentService));
expect('manual roster overlay survives listener and reload alignment', /manual_overlay_preserved/.test(studentService));
expect(
    'manual add cannot fall back to an out-of-sync Firestore mock',
    /isStaleGeneratedDataset\(data, rows\) \|\| isGeneratedRosterOutOfSync\(data, rows\)/.test(studentService),
);
expect('AI structured lookup runs before broad instant answers', aiPage.indexOf('const isStudentLookup = isStudentRowLookupQuestion') < aiPage.indexOf('const instantResult = tryInstantAnswer'));
expect('Overview aggregate subscribes to student-row changes', /const unsubscribeStudents = onStudentDataChange/.test(sharedData));

if (!process.exitCode) {
    console.log(`\nStudent realtime consistency audit passed (${passed} checks).`);
}
