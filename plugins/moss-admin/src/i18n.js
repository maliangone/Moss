/**
 * Moss Admin — Lightweight i18n hook
 *
 * Reads `userLanguage` from localStorage (same key as CloudCLI).
 * Reactively updates when the language changes.
 * Falls back to English for missing keys.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   t('tabs.dashboard')                    → "Dashboard"
 *   t('review.header', { count: 3 })       → "📋 Skill Review Queue (3 pending)"
 */

import { useState, useEffect } from 'react';

// --- Locale dictionaries (source of truth: i18n/*.json) ---

const locales = {
  en: {
    tabs: {
      dashboard: 'Dashboard',
      users: 'Users',
      skills: 'Skills',
      review: 'Review',
      policy: 'Policy',
      health: 'System',
    },
    refresh: 'Refresh',
    loading: 'Loading...',
    dashboard: {
      header: '📊 Platform Overview',
      active_users: 'Active Users',
      shared_skills: 'Shared Skills',
      pending_review: 'Pending Review',
    },
    users: {
      header: '👥 User Management',
      username_placeholder: 'Username',
      dept_general: 'General',
      dept_it: 'IT',
      dept_marketing: 'Marketing',
      dept_finance: 'Finance',
      dept_legal: 'Legal',
      dept_operations: 'Operations',
      dept_production: 'Production',
      create_btn: '+ Create User',
      col_username: 'Username',
      col_department: 'Department',
      col_skills: 'Personal Skills',
      col_last_active: 'Last Active',
      col_actions: 'Actions',
      archive_btn: 'Archive',
      confirm_archive: 'Archive workspace for user "{{username}}"?',
      error_create: 'Creation failed',
      error_create_msg: 'Failed to create user: {{message}}',
      error_action: 'Action failed: {{message}}',
    },
    skills: {
      header: '🧰 Skill Management',
      col_id: 'Skill ID',
      col_name: 'Name',
      col_description: 'Description',
      col_actions: 'Actions',
      delete_btn: 'Delete',
      confirm_delete: 'Delete shared skill "{{skillId}}"?',
      error_delete: 'Delete failed: {{message}}',
      empty: 'No shared skills',
    },
    review: {
      header: '📋 Skill Review Queue ({{count}} pending)',
      empty: 'No skills pending review',
      submitted_by: 'Submitted by: {{username}}',
      approve_btn: '✅ Approve',
      reject_btn: '❌ Reject',
      reject_reason: 'Reason for rejection (optional):',
      error_action: 'Action failed: {{message}}',
    },
    policy: {
      header: '🔒 Skill Policy Settings',
      group_user_creation: 'User-created Skills',
      allow_user_creation: 'Allow users to create personal skills',
      group_community: 'Community Installation',
      allow_community: 'Allow installing skills from community',
      group_sharing: 'Sharing Mechanism',
      allow_sharing: 'Allow users to share skills with team',
      require_review: 'Require admin review before sharing',
      save_btn: 'Save Policy',
      saved: 'Policy saved',
      error_save: 'Save failed: {{message}}',
    },
    health: {
      header: '💚 System Status',
      label_status: 'Status',
      status_ok: '✅ Normal',
      status_error: '❌ Error',
      label_disk: 'Disk Usage',
      label_time: 'Time',
    },
  },

  'zh-CN': {
    tabs: {
      dashboard: '概览',
      users: '用户',
      skills: '技能',
      review: '审核',
      policy: '策略',
      health: '系统',
    },
    refresh: '刷新',
    loading: '加载中...',
    dashboard: {
      header: '📊 平台概览',
      active_users: '活跃用户',
      shared_skills: '共享技能',
      pending_review: '待审核',
    },
    users: {
      header: '👥 用户管理',
      username_placeholder: '用户名',
      dept_general: '通用',
      dept_it: 'IT',
      dept_marketing: '市场',
      dept_finance: '财务',
      dept_legal: '法务',
      dept_operations: '运营',
      dept_production: '生产',
      create_btn: '+ 创建用户',
      col_username: '用户名',
      col_department: '部门',
      col_skills: '个人技能',
      col_last_active: '最后活跃',
      col_actions: '操作',
      archive_btn: '归档',
      confirm_archive: '确定要归档用户 "{{username}}" 的工作区吗？',
      error_create: '创建失败',
      error_create_msg: '创建用户失败: {{message}}',
      error_action: '操作失败: {{message}}',
    },
    skills: {
      header: '🧰 技能管理',
      col_id: '技能ID',
      col_name: '名称',
      col_description: '描述',
      col_actions: '操作',
      delete_btn: '删除',
      confirm_delete: '确定要删除共享技能 "{{skillId}}" 吗？',
      error_delete: '删除失败: {{message}}',
      empty: '暂无共享技能',
    },
    review: {
      header: '📋 技能审核队列 ({{count}} 待审核)',
      empty: '暂无待审核技能',
      submitted_by: '提交者: {{username}}',
      approve_btn: '✅ 批准',
      reject_btn: '❌ 拒绝',
      reject_reason: '拒绝原因（可选）:',
      error_action: '操作失败: {{message}}',
    },
    policy: {
      header: '🔒 技能策略设置',
      group_user_creation: '用户自创技能',
      allow_user_creation: '允许用户创建个人技能',
      group_community: '社区安装',
      allow_community: '允许从社区安装技能',
      group_sharing: '分享机制',
      allow_sharing: '允许用户分享技能给团队',
      require_review: '分享前需要管理员审核',
      save_btn: '保存策略',
      saved: '策略已保存',
      error_save: '保存失败: {{message}}',
    },
    health: {
      header: '💚 系统状态',
      label_status: '状态',
      status_ok: '✅ 正常',
      status_error: '❌ 异常',
      label_disk: '磁盘使用',
      label_time: '时间',
    },
  },

  'zh-TW': {
    tabs: {
      dashboard: '概覽',
      users: '使用者',
      skills: '技能',
      review: '審核',
      policy: '策略',
      health: '系統',
    },
    refresh: '重新整理',
    loading: '載入中...',
    dashboard: {
      header: '📊 平台概覽',
      active_users: '活躍使用者',
      shared_skills: '共享技能',
      pending_review: '待審核',
    },
    users: {
      header: '👥 使用者管理',
      username_placeholder: '使用者名稱',
      dept_general: '通用',
      dept_it: 'IT',
      dept_marketing: '行銷',
      dept_finance: '財務',
      dept_legal: '法務',
      dept_operations: '營運',
      dept_production: '生產',
      create_btn: '+ 建立使用者',
      col_username: '使用者名稱',
      col_department: '部門',
      col_skills: '個人技能',
      col_last_active: '最後活躍',
      col_actions: '操作',
      archive_btn: '封存',
      confirm_archive: '確定要封存使用者 "{{username}}" 的工作區嗎？',
      error_create: '建立失敗',
      error_create_msg: '建立使用者失敗: {{message}}',
      error_action: '操作失敗: {{message}}',
    },
    skills: {
      header: '🧰 技能管理',
      col_id: '技能ID',
      col_name: '名稱',
      col_description: '描述',
      col_actions: '操作',
      delete_btn: '刪除',
      confirm_delete: '確定要刪除共享技能 "{{skillId}}" 嗎？',
      error_delete: '刪除失敗: {{message}}',
      empty: '目前無共享技能',
    },
    review: {
      header: '📋 技能審核佇列 ({{count}} 待審核)',
      empty: '目前無待審核技能',
      submitted_by: '提交者: {{username}}',
      approve_btn: '✅ 批准',
      reject_btn: '❌ 拒絕',
      reject_reason: '拒絕原因（選填）:',
      error_action: '操作失敗: {{message}}',
    },
    policy: {
      header: '🔒 技能策略設定',
      group_user_creation: '使用者自建技能',
      allow_user_creation: '允許使用者建立個人技能',
      group_community: '社群安裝',
      allow_community: '允許從社群安裝技能',
      group_sharing: '分享機制',
      allow_sharing: '允許使用者分享技能給團隊',
      require_review: '分享前需要管理員審核',
      save_btn: '儲存策略',
      saved: '策略已儲存',
      error_save: '儲存失敗: {{message}}',
    },
    health: {
      header: '💚 系統狀態',
      label_status: '狀態',
      status_ok: '✅ 正常',
      status_error: '❌ 異常',
      label_disk: '磁碟使用',
      label_time: '時間',
    },
  },

  th: {
    tabs: {
      dashboard: 'ภาพรวม',
      users: 'ผู้ใช้',
      skills: 'ทักษะ',
      review: 'ตรวจสอบ',
      policy: 'นโยบาย',
      health: 'ระบบ',
    },
    refresh: 'รีเฟรช',
    loading: 'กำลังโหลด...',
    dashboard: {
      header: '📊 ภาพรวมแพลตฟอร์ม',
      active_users: 'ผู้ใช้ที่ใช้งานอยู่',
      shared_skills: 'ทักษะที่แชร์',
      pending_review: 'รอการตรวจสอบ',
    },
    users: {
      header: '👥 จัดการผู้ใช้',
      username_placeholder: 'ชื่อผู้ใช้',
      dept_general: 'ทั่วไป',
      dept_it: 'IT',
      dept_marketing: 'การตลาด',
      dept_finance: 'การเงิน',
      dept_legal: 'กฎหมาย',
      dept_operations: 'ปฏิบัติการ',
      dept_production: 'การผลิต',
      create_btn: '+ สร้างผู้ใช้',
      col_username: 'ชื่อผู้ใช้',
      col_department: 'แผนก',
      col_skills: 'ทักษะส่วนตัว',
      col_last_active: 'ใช้งานล่าสุด',
      col_actions: 'การดำเนินการ',
      archive_btn: 'เก็บถาวร',
      confirm_archive: 'เก็บถาวรพื้นที่ทำงานของผู้ใช้ "{{username}}"?',
      error_create: 'การสร้างล้มเหลว',
      error_create_msg: 'ไม่สามารถสร้างผู้ใช้: {{message}}',
      error_action: 'การดำเนินการล้มเหลว: {{message}}',
    },
    skills: {
      header: '🧰 จัดการทักษะ',
      col_id: 'ID ทักษะ',
      col_name: 'ชื่อ',
      col_description: 'คำอธิบาย',
      col_actions: 'การดำเนินการ',
      delete_btn: 'ลบ',
      confirm_delete: 'ลบทักษะที่แชร์ "{{skillId}}"?',
      error_delete: 'การลบล้มเหลว: {{message}}',
      empty: 'ไม่มีทักษะที่แชร์',
    },
    review: {
      header: '📋 คิวตรวจสอบทักษะ ({{count}} รอดำเนินการ)',
      empty: 'ไม่มีทักษะที่รอตรวจสอบ',
      submitted_by: 'ส่งโดย: {{username}}',
      approve_btn: '✅ อนุมัติ',
      reject_btn: '❌ ปฏิเสธ',
      reject_reason: 'เหตุผลในการปฏิเสธ (ไม่บังคับ):',
      error_action: 'การดำเนินการล้มเหลว: {{message}}',
    },
    policy: {
      header: '🔒 การตั้งค่านโยบายทักษะ',
      group_user_creation: 'ทักษะที่ผู้ใช้สร้าง',
      allow_user_creation: 'อนุญาตให้ผู้ใช้สร้างทักษะส่วนตัว',
      group_community: 'การติดตั้งจากชุมชน',
      allow_community: 'อนุญาตให้ติดตั้งทักษะจากชุมชน',
      group_sharing: 'กลไกการแชร์',
      allow_sharing: 'อนุญาตให้ผู้ใช้แชร์ทักษะกับทีม',
      require_review: 'ต้องให้ผู้ดูแลระบบตรวจสอบก่อนแชร์',
      save_btn: 'บันทึกนโยบาย',
      saved: 'บันทึกนโยบายแล้ว',
      error_save: 'การบันทึกล้มเหลว: {{message}}',
    },
    health: {
      header: '💚 สถานะระบบ',
      label_status: 'สถานะ',
      status_ok: '✅ ปกติ',
      status_error: '❌ ผิดปกติ',
      label_disk: 'การใช้ดิสก์',
      label_time: 'เวลา',
    },
  },
};

// --- Helper: resolve dot-path key in dict ---

function resolve(dict, key) {
  return key.split('.').reduce((obj, k) => (obj && typeof obj === 'object' ? obj[k] : undefined), dict);
}

// --- Helper: interpolate {{var}} placeholders ---

function interpolate(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

// --- Translation function factory ---

function makeTFn(dict) {
  return (key, vars) => {
    const val = resolve(dict, key);
    if (val === undefined) {
      const fallback = resolve(locales.en, key);
      return interpolate(typeof fallback === 'string' ? fallback : key, vars);
    }
    return interpolate(typeof val === 'string' ? val : key, vars);
  };
}

// --- React hook ---

export function useTranslation() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('userLanguage') || 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'userLanguage') {
        setLang(e.newValue || 'en');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dict = locales[lang] || locales.en;
  return { t: makeTFn(dict) };
}
