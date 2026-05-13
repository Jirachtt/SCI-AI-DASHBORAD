import { SCIENCE_ACTIVITY_REQUIREMENT } from '../data/scienceActivitiesData';
import { getStudentListSync } from './studentDataService';

const DEFAULT_GRADUATION_CREDITS = {
    current: 112,
    required: 130,
    details: [
        { name: 'หมวดวิชาศึกษาทั่วไป', current: 30, required: 30, status: 'complete' },
        { name: 'หมวดวิชาเฉพาะ', current: 76, required: 94, status: 'incomplete' },
        { name: 'หมวดวิชาเลือกเสรี', current: 6, required: 6, status: 'complete' },
    ],
};

const DEFAULT_GPA = { current: 3.15, required: 1.75 };

function toNumber(value, fallback = null) {
    if (value == null || value === '') return fallback;
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
}

function firstNumber(...values) {
    for (const value of values) {
        const n = toNumber(value, null);
        if (n != null) return n;
    }
    return null;
}

function compact(values = []) {
    return values.map(value => String(value || '').trim()).filter(Boolean);
}

export function getMjuUserIdentifiers(user = {}) {
    const localPart = String(user.email || '').split('@')[0];
    return [...new Set(compact([
        user.studentId,
        user.studentID,
        user.studentCode,
        user.mjuId,
        user.username,
        user.mjuClaims?.studentId,
        user.mjuClaims?.studentID,
        user.mjuClaims?.studentCode,
        user.mjuClaims?.mjuId,
        localPart,
    ]))];
}

export function resolveMjuLinkedStudent(user = {}, rows = getStudentListSync()) {
    const identifiers = getMjuUserIdentifiers(user);
    if (!identifiers.length || !Array.isArray(rows)) return null;
    const idSet = new Set(identifiers.map(id => String(id).toLowerCase()));
    return rows.find(row => idSet.has(String(row.id || row.studentId || row.student_id || '').toLowerCase())) || null;
}

function buildCreditDetails(current, required) {
    const total = Math.max(0, Number(current || 0));
    const general = Math.min(30, total);
    const elective = total >= required ? 6 : Math.min(6, Math.max(0, total - 106));
    const major = Math.max(0, total - general - elective);
    return [
        { name: 'หมวดวิชาศึกษาทั่วไป', current: general, required: 30, status: general >= 30 ? 'complete' : 'incomplete' },
        { name: 'หมวดวิชาเฉพาะ', current: major, required: 94, status: major >= 94 ? 'complete' : 'incomplete' },
        { name: 'หมวดวิชาเลือกเสรี', current: elective, required: 6, status: elective >= 6 ? 'complete' : 'incomplete' },
    ];
}

function estimateCreditsFromStudent(student = {}) {
    const year = toNumber(student.year, 4);
    const byYear = { 1: 32, 2: 68, 3: 98, 4: 112 };
    return byYear[year] || DEFAULT_GRADUATION_CREDITS.current;
}

function normalizeCreditDetails(details, current, required) {
    if (Array.isArray(details) && details.length) {
        return details.map(row => ({
            name: row.name || row.label || row.category || 'หมวดวิชา',
            current: toNumber(row.current ?? row.earned ?? row.value, 0),
            required: toNumber(row.required ?? row.target, 0),
            status: row.status || (toNumber(row.current ?? row.earned ?? row.value, 0) >= toNumber(row.required ?? row.target, 0) ? 'complete' : 'incomplete'),
        }));
    }
    return buildCreditDetails(current, required);
}

function normalizeActivityCategories(categories, completedHours, targetHours) {
    if (Array.isArray(categories) && categories.length) {
        return categories.map((row, index) => ({
            ...SCIENCE_ACTIVITY_REQUIREMENT.categoryTargets[index],
            ...row,
            name: row.name || row.label || SCIENCE_ACTIVITY_REQUIREMENT.categoryTargets[index]?.name || 'กิจกรรม',
            currentHours: toNumber(row.currentHours ?? row.completedHours ?? row.current, 0),
            requiredHours: toNumber(row.requiredHours ?? row.targetHours ?? row.required, 0),
            currentEvents: toNumber(row.currentEvents ?? row.completedEvents, 0),
            requiredEvents: toNumber(row.requiredEvents, 0),
        }));
    }

    const ratio = targetHours ? Math.min(1, completedHours / targetHours) : 0;
    return SCIENCE_ACTIVITY_REQUIREMENT.categoryTargets.map(row => ({
        ...row,
        currentHours: Math.min(row.requiredHours, Math.round(row.requiredHours * ratio)),
        currentEvents: Math.min(row.requiredEvents, Math.round(row.requiredEvents * ratio)),
    }));
}

export function getMjuLinkedUserAcademicProfile(user = {}) {
    const isMjuLinked = Boolean(user?.mjuVerified || user?.authProvider === 'mju_sso');
    const student = resolveMjuLinkedStudent(user);
    const academic = user.mjuAcademic || {};
    const activity = user.mjuActivity || {};
    const claims = user.mjuClaims || {};

    const gpax = firstNumber(
        academic.gpax,
        academic.gpa,
        user.gpax,
        user.gpa,
        claims.gpax,
        claims.gpa,
        claims.gradePointAverage,
        student?.gpa,
        DEFAULT_GPA.current
    );
    const currentCredits = firstNumber(
        academic.earnedCredits,
        academic.totalCredits,
        academic.credits?.current,
        user.earnedCredits,
        claims.earnedCredits,
        claims.totalCredits,
        claims.creditEarned,
        student ? estimateCreditsFromStudent(student) : DEFAULT_GRADUATION_CREDITS.current
    );
    const requiredCredits = firstNumber(
        academic.requiredCredits,
        academic.credits?.required,
        user.requiredCredits,
        claims.requiredCredits,
        claims.creditRequired,
        DEFAULT_GRADUATION_CREDITS.required
    );
    const completedHours = firstNumber(
        activity.completedHours,
        activity.completed,
        user.activityHoursCompleted,
        claims.activityHoursCompleted,
        claims.completedActivityHours,
        claims.activityHours,
        SCIENCE_ACTIVITY_REQUIREMENT.completedHours
    );
    const targetHours = firstNumber(
        activity.targetHours,
        activity.target,
        user.activityHoursTarget,
        claims.activityHoursTarget,
        claims.requiredActivityHours,
        SCIENCE_ACTIVITY_REQUIREMENT.targetHours
    );

    return {
        isMjuLinked,
        student,
        identifiers: getMjuUserIdentifiers(user),
        profileSource: isMjuLinked
            ? (student ? 'mju_sso_student_match' : 'mju_sso_claims_or_profile')
            : 'demo_fallback',
        identityLabel: student?.name || user?.name || user?.email || 'MJU User',
        gpa: {
            current: gpax,
            required: firstNumber(academic.minimumGpax, claims.minimumGpax, DEFAULT_GPA.required),
            source: firstNumber(academic.gpax, academic.gpa, user.gpax, user.gpa, claims.gpax, claims.gpa, null) != null
                ? 'ข้อมูลจาก MJU SSO/REG'
                : (student ? 'ข้อมูลจากรายชื่อนักศึกษาที่ผูกได้' : 'ข้อมูลตัวอย่างรอเชื่อม MJU'),
        },
        credits: {
            current: currentCredits,
            required: requiredCredits,
            details: normalizeCreditDetails(academic.creditDetails || academic.credits?.details || claims.creditDetails, currentCredits, requiredCredits),
            source: firstNumber(academic.earnedCredits, academic.totalCredits, user.earnedCredits, claims.earnedCredits, null) != null
                ? 'ข้อมูลจาก MJU SSO/REG'
                : (student ? 'ประเมินจากรายชื่อนักศึกษาที่ผูกได้' : 'ข้อมูลตัวอย่างรอเชื่อม MJU'),
        },
        activity: {
            ...SCIENCE_ACTIVITY_REQUIREMENT,
            completedHours,
            targetHours,
            completedEvents: firstNumber(activity.completedEvents, claims.completedActivityEvents, SCIENCE_ACTIVITY_REQUIREMENT.completedEvents),
            requiredEvents: firstNumber(activity.requiredEvents, claims.requiredActivityEvents, SCIENCE_ACTIVITY_REQUIREMENT.requiredEvents),
            categoryTargets: normalizeActivityCategories(activity.categoryTargets || activity.categories || claims.activityCategories, completedHours, targetHours),
            source: firstNumber(activity.completedHours, activity.completed, user.activityHoursCompleted, claims.activityHoursCompleted, claims.activityHours, null) != null
                ? 'ข้อมูลกิจกรรมจาก MJU SSO'
                : 'ใช้เกณฑ์กิจกรรมคณะเป็นค่าเริ่มต้น',
        },
    };
}
