import { canAccess, canManageUsers } from '../src/utils/accessControl.js';
import { canAIUseInternalDomain, isAIUnrestrictedRole } from '../src/utils/aiAccessPolicy.js';

const checks = [];

function expect(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}

function user(role, extra = {}) {
  return { role, ...extra };
}

function can(role, section) {
  return canAccess(role, section);
}

const nonAdminRoles = ['chair', 'staff', 'student', 'general', 'pending_staff', 'pending_chair'];

expect('admin can open user-management sections only', [
  'admin_panel',
].every(section => can('admin', section)));
expect('admin cannot open protected dashboard data sections', [
  'student_list',
  'student_stats',
  'financial',
  'budget_forecast',
  'hr_overview',
  'research_overview',
  'strategic_overview',
  'alert_center',
  'tcas_admissions',
  'course_analytics',
  'graduation_check',
  'graduation_stats',
  'student_life',
  'academic_rules',
  'ai_chat',
].every(section => !can('admin', section)));
expect('admin can manage users by default', canManageUsers(user('admin')));

expect('dean cannot open admin panel by default', !can('dean', 'admin_panel'));
expect('dean cannot manage users by default', !canManageUsers(user('dean')));

for (const role of nonAdminRoles) {
  expect(`${role} cannot open admin panel`, !can(role, 'admin_panel'), `${role} should not have admin_panel section.`);
  expect(`${role} cannot manage users by default`, !canManageUsers(user(role)), `${role} should need explicit canManageUsers/systemAdmin.`);
}

expect('explicit system admin flag can manage users', canManageUsers(user('staff', { canManageUsers: true })));

expect('dean sees broad management dashboards', [
  'dashboard',
  'student_stats',
  'budget_forecast',
  'strategic_overview',
  'hr_overview',
  'research_overview',
  'alert_center',
  'ai_chat',
].every(section => can('dean', section)));

expect('chair sees program/student planning areas', [
  'dashboard',
  'student_list',
  'graduation_check',
  'student_stats',
  'tcas_admissions',
  'course_analytics',
  'strategic_overview',
  'ai_chat',
].every(section => can('chair', section)));

expect('legacy instructor maps to general/public access', [
  'dashboard',
  'tuition',
  'tcas_admissions',
  'academic_rules',
  'ai_chat',
].every(section => can('instructor', section)));
expect('legacy instructor cannot see alert center until advisor scope exists', !can('instructor', 'alert_center'));
expect('legacy instructor cannot see student list by default', !can('instructor', 'student_list'));

expect('staff sees operational dashboards but not admin', [
  'dashboard',
  'financial',
  'student_stats',
  'budget_forecast',
  'tcas_admissions',
  'course_analytics',
  'hr_overview',
  'alert_center',
  'ai_chat',
].every(section => can('staff', section)));

expect('student sees self-service academic areas', [
  'dashboard',
  'tuition',
  'student_life',
  'graduation_check',
  'student_stats',
  'course_analytics',
  'academic_rules',
  'ai_chat',
].every(section => can('student', section)));
expect('student cannot see roster or finance operations', !can('student', 'student_list') && !can('student', 'financial'));

expect('general has public/low-risk sections only', [
  'dashboard',
  'tuition',
  'tcas_admissions',
  'academic_rules',
  'ai_chat',
].every(section => can('general', section)));
expect('general cannot see locked internal sections', [
  'student_list',
  'student_stats',
  'budget_forecast',
  'hr_overview',
  'strategic_overview',
].every(section => !can('general', section)));

expect('pending roles fall back to general access', [
  'dashboard',
  'tuition',
  'tcas_admissions',
  'academic_rules',
  'ai_chat',
].every(section => can('pending_staff', section) && can('pending_chair', section)));

expect('dean is the only canonical AI unrestricted role',
  isAIUnrestrictedRole('dean') && !isAIUnrestrictedRole('admin'));
expect('chair/staff/student/general are not AI unrestricted', [
  'chair',
  'staff',
  'student',
  'general',
].every(role => !isAIUnrestrictedRole(role)));

expect('dean AI can use management domains', [
  'budget',
  'strategic',
  'hr',
  'tcas',
  'students',
  'alerts',
].every(domain => canAIUseInternalDomain('dean', domain)));

expect('student AI can use student-safe domains', [
  'dashboard',
  'course_analytics',
  'student_life',
  'graduation',
  'academic_rules',
  'tuition',
].every(domain => canAIUseInternalDomain('student', domain)));

expect('student AI cannot use locked management domains', [
  'budget',
  'finance',
  'hr',
  'strategic',
  'student_list',
  'alerts',
].every(domain => !canAIUseInternalDomain('student', domain)));

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  const prefix = item.ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${item.name}`);
  if (!item.ok && item.detail) console.log(`  ${item.detail}`);
}

if (failed.length > 0) {
  console.error(`\nRole access audit failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\nRole access audit passed: ${checks.length}/${checks.length}`);
