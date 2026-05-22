import {
  NAVIGATION_CATEGORIES,
  getNavigationRouteItems,
  getVisibleNavigationCategories,
} from '../src/config/navigationConfig.js';
import { routeLoaders } from '../src/utils/routePrefetch.js';

const issues = [];

function expect(label, condition) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    issues.push(label);
  }
}

function visibleItemIds(role) {
  return new Set(
    getVisibleNavigationCategories({ role, name: role }, { includeFeatured: true })
      .flatMap(category => category.items.map(item => item.id)),
  );
}

function hiddenFor(role, itemId) {
  return !visibleItemIds(role).has(itemId);
}

expect('navigation has exactly 5 main categories', NAVIGATION_CATEGORIES.length === 5);
expect('empty categories are filtered for low-permission users',
  getVisibleNavigationCategories({ role: 'general' }).every(category => category.items.length > 0));

const routePaths = Object.keys(routeLoaders);
const configuredPaths = new Set(getNavigationRouteItems().map(item => item.path));
for (const path of routePaths) {
  expect(`route ${path} has navigation permission mapping`, configuredPaths.has(path));
}

for (const item of getNavigationRouteItems()) {
  expect(`route item ${item.id} has permissionKey`, Boolean(item.permissionKey));
}

const adminItems = visibleItemIds('admin');
expect('admin sees admin panel', adminItems.has('admin_panel'));
expect('admin sees dashboard', adminItems.has('dashboard'));

const deanItems = visibleItemIds('dean');
expect('dean sees AI chat', deanItems.has('ai_chat'));
expect('dean sees strategic dashboard', deanItems.has('strategic_overview'));
expect('dean sees admin panel by default', deanItems.has('admin_panel'));

const instructorItems = visibleItemIds('instructor');
expect('lecturer/instructor sees course analytics', instructorItems.has('course_analytics'));
expect('lecturer/instructor does not see student roster by default', hiddenFor('instructor', 'student_list'));
expect('lecturer/instructor does not see alert center without advisor scope', hiddenFor('instructor', 'alert_center'));

const staffItems = visibleItemIds('staff');
expect('staff sees operational student stats', staffItems.has('student_stats'));
expect('staff does not see admin panel', hiddenFor('staff', 'admin_panel'));

const studentItems = visibleItemIds('student');
expect('student sees student-safe academic pages', [
  'dashboard',
  'ai_chat',
  'student_stats',
  'course_analytics',
  'student_life',
  'graduation_check',
  'academic_rules',
].every(item => studentItems.has(item)));
expect('student does not see locked management pages', [
  'admin_panel',
  'financial',
  'budget_forecast',
  'hr_overview',
  'student_list',
].every(item => !studentItems.has(item)));

const generalItems = visibleItemIds('general');
expect('general only sees public/low-risk navigation', [
  'dashboard',
  'ai_chat',
  'tuition',
  'academic_rules',
  'settings',
].every(item => generalItems.has(item)));
expect('general does not see internal navigation', [
  'student_list',
  'financial',
  'hr_overview',
  'strategic_overview',
  'alert_center',
].every(item => !generalItems.has(item)));

if (issues.length) {
  console.error(`\nNavigation audit failed: ${issues.length} issue(s)`);
  process.exit(1);
}

console.log(`\nNavigation audit passed: ${NAVIGATION_CATEGORIES.length} categories, ${getNavigationRouteItems().length} route items`);
