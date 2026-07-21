import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildClaims } from '../api/mju-sso-exchange.js';

const nestedClaims = buildClaims({
    data: {
        profile: {
            studentID: '6500000001',
            firstName: 'ทดสอบ',
            lastName: 'ระบบ',
            e_mail: 'student@mju.ac.th',
            faculty: 'คณะวิทยาศาสตร์',
            majorName: 'วิทยาการคอมพิวเตอร์',
            GPAX: '3.42',
            sumCredit: '118',
            curriculumCredits: '130',
            activityHour: '64',
            activityHoursRequired: '80',
            studyYear: '2569',
            semester: '1',
        },
    },
});

assert.equal(nestedClaims.studentCode, '6500000001', 'nested SSO student id should be normalized');
assert.equal(nestedClaims.gpax, '3.42', 'nested SSO GPAX should be normalized');
assert.equal(nestedClaims.earnedCredits, '118', 'nested SSO credits should be normalized');
assert.equal(nestedClaims.activityHoursCompleted, '64', 'nested activity hours should be normalized');

const linkedService = readFileSync(new URL('../src/services/mjuLinkedUserDataService.js', import.meta.url), 'utf8');
const connectedService = readFileSync(new URL('../src/services/mjuConnectedDataService.js', import.meta.url), 'utf8');
assert.match(linkedService, /const student = isMjuLinked \? null : resolveMjuLinkedStudent/,
    'verified MJU users must never be matched to generated roster rows');
assert.match(linkedService, /MJU SSO ยังไม่ได้ส่ง GPAX/,
    'missing MJU GPAX must produce an unavailable state');
assert.match(linkedService, /current: consentGranted \? gpax : null/,
    'MJU GPAX must remain hidden until consent');
assert.match(connectedService, /safeDomainDataForAI/,
    'AI context must use a privacy-safe field allowlist');
assert.doesNotMatch(
    connectedService.slice(connectedService.indexOf('function safeDomainDataForAI'), connectedService.indexOf('function normalizeUserType')),
    /studentCode|employeeCode|fullName|email/,
    'AI connected-data allowlist must not include direct identifiers',
);

console.log('MJU connected-data validation passed.');
