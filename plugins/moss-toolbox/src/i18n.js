/**
 * Moss Toolbox — Lightweight i18n hook
 *
 * Reads `userLanguage` from localStorage (same key as CloudCLI).
 * Reactively updates when the language changes.
 * Falls back to English for missing keys.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   t('panel.header')          → "🧰 Toolbox"
 *   t('panel.my_skills', { count: 3 }) → "⭐ My Skills (3)"
 */

import { useState, useEffect } from 'react';

// --- Locale dictionaries (source of truth: i18n/*.json) ---

const locales = {
  en: {
    loading: 'Loading toolbox...',
    share_submitted: 'Skill submitted for review. Once approved by admin, it will be available company-wide.',
    panel: {
      header: '🧰 Toolbox',
      refresh: 'Refresh',
      search_placeholder: '🔍 Search tools...',
      my_skills: '⭐ My Skills ({{count}})',
      create_btn: '+ Create',
      create_title: 'Create new skill',
      use_skill: 'Use my "{{name}}" skill to process',
      share_title: 'Share with team',
      delete_title: 'Delete',
      empty_personal: '💡 Tell AI "Help me turn this analysis workflow into a reusable tool" to create your own skills',
      auto_trigger: 'Can be auto-triggered',
    },
    suggestion: {
      label: '💡 You might want:',
    },
    welcome: {
      hero_title: '🤖 Hello! I\'m your AI Analysis Assistant',
      hero_subtitle: 'Tell me what you want to do, or choose a quick task:',
      my_skills: '⭐ My Skills ({{count}})',
      use_skill: 'Use my "{{name}}" skill',
      hint: '🛠 Tell me about your repetitive workflows, I\'ll turn them into one-click personal tools',
      example_intro: '💡 Or just tell me:',
      example_prompt: 'Help me analyze last month\'s sales data and find the product lines with the biggest decline',
    },
    dialog: {
      title: '🛠 Create New Skill',
      close: '✕',
      subtitle: 'Choose a creation method:',
      hint: '💡 Created skills will appear under "⭐ My Skills" in the toolbox and can be used anytime',
      describe: {
        title: 'Describe my needs',
        description: 'Tell AI about your repetitive workflow and AI will turn it into a skill',
        prompt: 'I want to create a new skill. Please use /skill-creator to guide me through the creation process. I\'ll describe my repetitive workflow and you\'ll help me turn it into a reusable skill.',
      },
      community: {
        title: 'Install community skill',
        description: 'Search and install ready-made skills from the community library',
        prompt: 'Please help me search and install community skills. I want to browse available skill lists, please list some recommended data analysis related skills.',
      },
      from_chat: {
        title: 'Create from current conversation',
        description: 'Save the recent analysis workflow as a reusable skill',
        prompt: 'Please save the analysis workflow from our conversation as a reusable skill. Use /skill-creator to create it. Save to my personal skill library (~/.claude/skills/) so I can use it in future conversations.',
      },
    },
    save: {
      success: '✅ Skill created: 「{{skillName}}」',
      save_as: 'Save as:',
      permanent: '⭐ Frequent Skill (Recommended)',
      permanent_desc: 'Available anytime, persisted across sessions',
      temp: '📂 This task only',
      temp_desc: 'Only for this analysis, cleared when session ends',
    },
    share_btn: {
      submitted: '✅ Submitted',
      share_title: 'Share with team',
      share: '📤 Share',
    },
    progress: {
      running_default: 'Running',
      skills_used: '⚙ Skills used this time ({{count}})',
      auto_triggered: '— Auto triggered',
      user_selected: '— User selected',
    },
  },

  'zh-CN': {
    loading: '加载工具箱...',
    share_submitted: '技能已提交审核，管理员审核通过后将对全公司开放。',
    panel: {
      header: '🧰 工具箱',
      refresh: '刷新',
      search_placeholder: '🔍 搜索工具...',
      my_skills: '⭐ 我的技能 ({{count}})',
      create_btn: '+ 创建',
      create_title: '创建新技能',
      use_skill: '使用我的"{{name}}"技能来处理',
      share_title: '分享给团队',
      delete_title: '删除',
      empty_personal: '💡 告诉 AI "帮我把这个分析流程做成一个可重复的工具" 就能创建你自己的技能',
      auto_trigger: '可自动触发',
    },
    suggestion: {
      label: '💡 你可能想要:',
    },
    welcome: {
      hero_title: '🤖 你好！我是你的 AI 分析助手',
      hero_subtitle: '告诉我你想做什么，或者选择一个快速任务：',
      my_skills: '⭐ 我的技能 ({{count}}个)',
      use_skill: '使用我的"{{name}}"技能',
      hint: '🛠 把你经常重复的工作告诉我，我帮你做成一键触发的专属工具',
      example_intro: '💡 或者直接告诉我：',
      example_prompt: '帮我分析上个月的销售数据，找出下降最多的产品线',
    },
    dialog: {
      title: '🛠 创建新技能',
      close: '✕',
      subtitle: '选择创建方式：',
      hint: '💡 创建后的技能会出现在工具箱的「⭐ 我的技能」中，可以随时使用',
      describe: {
        title: '描述我的需求',
        description: '告诉AI你经常重复做的工作流程，AI帮你做成技能',
        prompt: '我想创建一个新的技能。请使用 /skill-creator 引导我完成创建过程。我会描述我经常重复做的工作流程，请帮我把它做成一个可重复使用的技能。',
      },
      community: {
        title: '安装社区技能',
        description: '从社区技能库中搜索并安装现成技能',
        prompt: '请帮我搜索和安装社区技能。我想浏览可用的技能列表，请列出一些推荐的数据分析相关技能。',
      },
      from_chat: {
        title: '基于当前对话创建',
        description: '把刚才的分析流程保存为可重复技能',
        prompt: '请把我们刚才的对话中的分析流程保存为一个可重复使用的技能。使用 /skill-creator 来创建。保存到我的个人技能库（~/.claude/skills/）中，这样下次新对话我也能用。',
      },
    },
    save: {
      success: '✅ 技能创建成功: 「{{skillName}}」',
      save_as: '保存为：',
      permanent: '⭐ 常用技能（推荐）',
      permanent_desc: '以后随时可以用，跨会话持久保存',
      temp: '📂 仅本次任务',
      temp_desc: '只在当前分析中使用，会话结束后清理',
    },
    share_btn: {
      submitted: '✅ 已提交',
      share_title: '分享给团队',
      share: '📤 分享',
    },
    progress: {
      running_default: '正在执行',
      skills_used: '⚙ 本次使用的技能 ({{count}})',
      auto_triggered: '— 自动触发',
      user_selected: '— 用户选择',
    },
  },

  'zh-TW': {
    loading: '載入工具箱...',
    share_submitted: '技能已提交審核，管理員審核通過後將對全公司開放。',
    panel: {
      header: '🧰 工具箱',
      refresh: '重新整理',
      search_placeholder: '🔍 搜尋工具...',
      my_skills: '⭐ 我的技能 ({{count}})',
      create_btn: '+ 建立',
      create_title: '建立新技能',
      use_skill: '使用我的"{{name}}"技能來處理',
      share_title: '分享給團隊',
      delete_title: '刪除',
      empty_personal: '💡 告訴 AI "幫我把這個分析流程做成一個可重複的工具" 就能建立你自己的技能',
      auto_trigger: '可自動觸發',
    },
    suggestion: {
      label: '💡 你可能想要：',
    },
    welcome: {
      hero_title: '🤖 你好！我是你的 AI 分析助手',
      hero_subtitle: '告訴我你想做什麼，或者選擇一個快速任務：',
      my_skills: '⭐ 我的技能 ({{count}}個)',
      use_skill: '使用我的"{{name}}"技能',
      hint: '🛠 把你經常重複的工作告訴我，我幫你做成一鍵觸發的專屬工具',
      example_intro: '💡 或者直接告訴我：',
      example_prompt: '幫我分析上個月的銷售資料，找出下降最多的產品線',
    },
    dialog: {
      title: '🛠 建立新技能',
      close: '✕',
      subtitle: '選擇建立方式：',
      hint: '💡 建立後的技能會出現在工具箱的「⭐ 我的技能」中，可以隨時使用',
      describe: {
        title: '描述我的需求',
        description: '告訴AI你經常重複做的工作流程，AI幫你做成技能',
        prompt: '我想建立一個新的技能。請使用 /skill-creator 引導我完成建立過程。我會描述我經常重複做的工作流程，請幫我把它做成一個可重複使用的技能。',
      },
      community: {
        title: '安裝社群技能',
        description: '從社群技能庫中搜尋並安裝現成技能',
        prompt: '請幫我搜尋和安裝社群技能。我想瀏覽可用的技能清單，請列出一些推薦的資料分析相關技能。',
      },
      from_chat: {
        title: '基於目前對話建立',
        description: '把剛才的分析流程儲存為可重複技能',
        prompt: '請把我們剛才的對話中的分析流程儲存為一個可重複使用的技能。使用 /skill-creator 來建立。儲存到我的個人技能庫（~/.claude/skills/）中，這樣下次新對話我也能用。',
      },
    },
    save: {
      success: '✅ 技能建立成功：「{{skillName}}」',
      save_as: '儲存為：',
      permanent: '⭐ 常用技能（推薦）',
      permanent_desc: '以後隨時可以用，跨會話持久儲存',
      temp: '📂 僅本次任務',
      temp_desc: '只在目前分析中使用，會話結束後清除',
    },
    share_btn: {
      submitted: '✅ 已提交',
      share_title: '分享給團隊',
      share: '📤 分享',
    },
    progress: {
      running_default: '正在執行',
      skills_used: '⚙ 本次使用的技能 ({{count}})',
      auto_triggered: '— 自動觸發',
      user_selected: '— 使用者選擇',
    },
  },

  th: {
    loading: 'กำลังโหลดกล่องเครื่องมือ...',
    share_submitted: 'ทักษะถูกส่งเพื่อตรวจสอบ เมื่อผู้ดูแลระบบอนุมัติแล้วจะเปิดให้ทั้งบริษัทใช้งาน',
    panel: {
      header: '🧰 กล่องเครื่องมือ',
      refresh: 'รีเฟรช',
      search_placeholder: '🔍 ค้นหาเครื่องมือ...',
      my_skills: '⭐ ทักษะของฉัน ({{count}})',
      create_btn: '+ สร้าง',
      create_title: 'สร้างทักษะใหม่',
      use_skill: 'ใช้ทักษะ "{{name}}" ของฉันเพื่อประมวลผล',
      share_title: 'แชร์กับทีม',
      delete_title: 'ลบ',
      empty_personal: '💡 บอก AI ว่า "ช่วยทำให้ขั้นตอนการวิเคราะห์นี้เป็นเครื่องมือที่ใช้ซ้ำได้" เพื่อสร้างทักษะของคุณเอง',
      auto_trigger: 'สามารถเรียกใช้อัตโนมัติได้',
    },
    suggestion: {
      label: '💡 คุณอาจต้องการ:',
    },
    welcome: {
      hero_title: '🤖 สวัสดี! ฉันคือผู้ช่วย AI วิเคราะห์ข้อมูลของคุณ',
      hero_subtitle: 'บอกฉันว่าคุณต้องการทำอะไร หรือเลือกงานด่วน:',
      my_skills: '⭐ ทักษะของฉัน ({{count}} รายการ)',
      use_skill: 'ใช้ทักษะ "{{name}}" ของฉัน',
      hint: '🛠 บอกฉันเกี่ยวกับงานที่คุณทำซ้ำๆ ฉันจะเปลี่ยนเป็นเครื่องมือส่วนตัวที่ใช้ได้ด้วยคลิกเดียว',
      example_intro: '💡 หรือบอกฉันตรงๆ ว่า:',
      example_prompt: 'ช่วยวิเคราะห์ข้อมูลยอดขายเดือนที่แล้ว และหาสายผลิตภัณฑ์ที่ลดลงมากที่สุด',
    },
    dialog: {
      title: '🛠 สร้างทักษะใหม่',
      close: '✕',
      subtitle: 'เลือกวิธีสร้าง:',
      hint: '💡 ทักษะที่สร้างแล้วจะปรากฏใน "⭐ ทักษะของฉัน" ในกล่องเครื่องมือ และสามารถใช้ได้ทุกเมื่อ',
      describe: {
        title: 'อธิบายความต้องการของฉัน',
        description: 'บอก AI เกี่ยวกับขั้นตอนการทำงานที่ทำซ้ำบ่อยๆ AI จะเปลี่ยนเป็นทักษะให้',
        prompt: 'ฉันต้องการสร้างทักษะใหม่ โปรดใช้ /skill-creator เพื่อแนะนำฉันตลอดกระบวนการสร้าง ฉันจะอธิบายขั้นตอนการทำงานที่ทำซ้ำบ่อยๆ และคุณจะช่วยเปลี่ยนให้เป็นทักษะที่ใช้ซ้ำได้',
      },
      community: {
        title: 'ติดตั้งทักษะจากชุมชน',
        description: 'ค้นหาและติดตั้งทักษะสำเร็จรูปจากคลังทักษะชุมชน',
        prompt: 'โปรดช่วยฉันค้นหาและติดตั้งทักษะจากชุมชน ฉันต้องการเรียกดูรายการทักษะที่มีอยู่ โปรดแสดงทักษะที่เกี่ยวกับการวิเคราะห์ข้อมูลที่แนะนำบางส่วน',
      },
      from_chat: {
        title: 'สร้างจากการสนทนาปัจจุบัน',
        description: 'บันทึกขั้นตอนการวิเคราะห์ล่าสุดเป็นทักษะที่ใช้ซ้ำได้',
        prompt: 'โปรดบันทึกขั้นตอนการวิเคราะห์จากการสนทนาของเราเป็นทักษะที่ใช้ซ้ำได้ ใช้ /skill-creator เพื่อสร้าง บันทึกลงในคลังทักษะส่วนตัวของฉัน (~/.claude/skills/) เพื่อให้ฉันใช้ได้ในการสนทนาครั้งต่อไป',
      },
    },
    save: {
      success: '✅ สร้างทักษะสำเร็จ: 「{{skillName}}」',
      save_as: 'บันทึกเป็น:',
      permanent: '⭐ ทักษะที่ใช้บ่อย (แนะนำ)',
      permanent_desc: 'ใช้ได้ทุกเมื่อ บันทึกถาวรข้ามเซสชัน',
      temp: '📂 เฉพาะงานนี้เท่านั้น',
      temp_desc: 'ใช้เฉพาะในการวิเคราะห์ปัจจุบัน ลบเมื่อเซสชันสิ้นสุด',
    },
    share_btn: {
      submitted: '✅ ส่งแล้ว',
      share_title: 'แชร์กับทีม',
      share: '📤 แชร์',
    },
    progress: {
      running_default: 'กำลังดำเนินการ',
      skills_used: '⚙ ทักษะที่ใช้ในครั้งนี้ ({{count}})',
      auto_triggered: '— เรียกใช้อัตโนมัติ',
      user_selected: '— ผู้ใช้เลือก',
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
      // Fallback to English
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
