import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  GraduationCap,
  Home,
  Microscope,
  ScrollText,
  Settings,
  Target,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { canAccess, canManageUsers } from '../utils/accessControl.js';

export const NAVIGATION_CATEGORIES = [
  {
    id: 'overview_ai',
    label: 'ภาพรวมและ AI',
    items: [
      {
        id: 'dashboard',
        label: 'ภาพรวม',
        path: '/dashboard',
        icon: Home,
        permissionKey: 'dashboard',
        exactMatch: true,
      },
      {
        id: 'ai_chat',
        label: 'แชทกับ AI',
        subtitle: 'ผู้ช่วยวิเคราะห์ข้อมูลของคณะ',
        path: '/dashboard/ai-chat',
        icon: Bot,
        permissionKey: 'ai_chat',
        featured: true,
        badge: 'หลัก',
      },
      {
        id: 'alert_center',
        label: 'ศูนย์แจ้งเตือน',
        path: '/dashboard/alerts',
        icon: Bell,
        permissionKey: 'alert_center',
      },
      {
        id: 'strategic_overview',
        label: 'เป้าหมายยุทธศาสตร์',
        path: '/dashboard/strategic',
        icon: Target,
        permissionKey: 'strategic_overview',
      },
    ],
  },
  {
    id: 'student_learning',
    label: 'นักศึกษาและการเรียน',
    items: [
      {
        id: 'student_stats',
        label: 'สถิตินักศึกษาปัจจุบัน',
        path: '/dashboard/student-stats',
        icon: BarChart3,
        permissionKey: 'student_stats',
      },
      {
        id: 'student_list',
        label: 'รายชื่อนักศึกษา',
        path: '/dashboard/students',
        icon: GraduationCap,
        permissionKey: 'student_list',
      },
      {
        id: 'course_analytics',
        label: 'รายวิชา/เกรด',
        path: '/dashboard/course-analytics',
        icon: BookOpen,
        permissionKey: 'course_analytics',
      },
      {
        id: 'graduation_stats',
        label: 'สถิติสำเร็จการศึกษา',
        path: '/dashboard/graduation-stats',
        icon: Award,
        permissionKey: 'graduation_stats',
      },
      {
        id: 'graduation_check',
        label: 'ตรวจสอบการจบ',
        path: '/dashboard/graduation',
        icon: CheckCircle,
        permissionKey: 'graduation_check',
      },
      {
        id: 'student_life',
        label: 'กิจกรรมคณะวิทยาศาสตร์',
        path: '/dashboard/student-life',
        icon: CalendarDays,
        permissionKey: 'student_life',
      },
    ],
  },
  {
    id: 'admissions_curriculum',
    label: 'รับเข้าและหลักสูตร',
    items: [
      {
        id: 'tcas_admissions',
        label: 'แผนรับ TCAS',
        path: '/dashboard/tcas',
        icon: ClipboardList,
        permissionKey: 'tcas_admissions',
      },
      {
        id: 'academic_rules',
        label: 'กฎระเบียบ/เกียรตินิยม',
        path: '/dashboard/academic-rules',
        icon: ScrollText,
        permissionKey: 'academic_rules',
      },
    ],
  },
  {
    id: 'operations_management',
    label: 'บริหารจัดการ',
    items: [
      {
        id: 'hr_overview',
        label: 'ภาพรวมบุคลากร',
        path: '/dashboard/hr',
        icon: UserCheck,
        permissionKey: 'hr_overview',
      },
      {
        id: 'financial',
        label: 'รายรับ-รายจ่าย',
        path: '/dashboard/financial',
        icon: DollarSign,
        permissionKey: 'financial',
      },
      {
        id: 'tuition',
        label: 'ค่าธรรมเนียมการศึกษา',
        path: '/dashboard/tuition',
        icon: CreditCard,
        permissionKey: 'tuition',
      },
      {
        id: 'budget_forecast',
        label: 'พยากรณ์งบประมาณ',
        path: '/dashboard/budget',
        icon: FileText,
        permissionKey: 'budget_forecast',
      },
      {
        id: 'research_overview',
        label: 'ภาพรวมงานวิจัย',
        path: '/dashboard/research',
        icon: Microscope,
        permissionKey: 'research_overview',
      },
      {
        id: 'admin_panel',
        label: 'จัดการผู้ใช้/สิทธิ์',
        path: '/dashboard/admin',
        icon: UserCog,
        permissionKey: 'admin_panel',
      },
    ],
  },
  {
    id: 'tools_settings',
    label: 'เครื่องมือและตั้งค่า',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        permissionKey: 'authenticated',
        action: 'settings',
      },
      {
        id: 'ai_runtime',
        label: 'AI token / model',
        icon: Activity,
        permissionKey: 'ai_chat',
        action: 'settings',
      },
    ],
  },
];

export function getAllNavigationItems() {
  return NAVIGATION_CATEGORIES.flatMap(category => (
    category.items.map(item => ({ ...item, categoryId: category.id, categoryLabel: category.label }))
  ));
}

export function getNavigationRouteItems() {
  return getAllNavigationItems().filter(item => item.path);
}

export function getFeaturedNavigationItem() {
  return getAllNavigationItems().find(item => item.featured) || null;
}

export function canAccessNavigationItem(user, item) {
  if (!item) return false;
  if (item.permissionKey === 'authenticated') return Boolean(user);
  if (item.permissionKey === 'admin_panel') return canManageUsers(user);
  return canAccess(user?.role, item.permissionKey);
}

export function getVisibleNavigationCategories(user, { includeFeatured = false } = {}) {
  return NAVIGATION_CATEGORIES
    .map(category => ({
      ...category,
      items: category.items.filter(item => (
        (includeFeatured || !item.featured) && canAccessNavigationItem(user, item)
      )),
    }))
    .filter(category => category.items.length > 0);
}
