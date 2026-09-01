import { ref, watch } from "vue";
import type { AppLocale } from "../types/practice";

const storageKey = "new-concept-interface-language";

const messages: Record<AppLocale, Record<string, string>> = {
  "zh-CN": {
    "settings.open": "打开练习设置",
    "settings.title": "练习设置",
    "settings.language": "界面语言",
    "settings.selectLesson": "选择课程",
    "settings.practiceRange": "练习范围",
    "settings.appearance": "外观",
    "settings.pronunciation": "发音设置",
    "settings.voice": "发音人",
    "settings.systemVoice": "系统默认发音人",
    "settings.rate": "语速 {rate}×",
    "settings.progress": "本课进度",
    "settings.progressHint": "答对后自动计入完成进度，保存在本机浏览器中。",
    "settings.redo": "重做本课",
    "settings.redoLong": "重做本课（清空本课记录）",
    "settings.shortcuts": "快捷键",
    "settings.enterHint": "校验并跳到下一句",
    "settings.done": "完成设置",
    "filter.all": "全部",
    "filter.unfinished": "未完成",
    "filter.mistakes": "错题",
    "theme.system": "跟随系统",
    "theme.light": "浅色",
    "theme.dark": "深色",
    "stats.mastered": "已掌握",
    "stats.accuracy": "正确率",
    "stats.total": "总题数",
    "header.eyebrow": "新概念英语第一册 · 奇数课",
    "header.title": "中译英句子训练",
    "footer.source": "学习内容来自用户提供的《新概念英语》第一册本地资料，仅用于个人学习。",
    "exercise.count": "共 {count} 题",
    "exercise.translation": "译文",
    "exercise.original": "原文",
    "exercise.bilingual": "译文+原文",
    "exercise.scopeHint": "标题、问题和正文均参与练习",
    "exercise.history": "错误历史",
    "exercise.fullText": "全文",
    "exercise.titleShort": "标",
    "exercise.questionShort": "问",
    "exercise.title": "标题",
    "exercise.question": "问题",
    "exercise.sentence": "第 {number} 句",
    "exercise.answerLabel": "{item}英文译文",
    "exercise.correct": "正确",
    "exercise.incorrect": "有误",
    "exercise.errorHint": "错误提示",
    "exercise.viewError": "查看错误原因",
    "exercise.clearRow": "清空当前行",
    "exercise.openActions": "打开当前行操作菜单",
    "exercise.speakTitle": "朗读课程标题",
    "exercise.speakQuestion": "朗读课文问题",
    "exercise.speakText": "朗读英语原文",
    "history.title": "本课错误历史",
    "history.empty": "本课还没有错误记录",
    "history.summary": "错词汇总",
    "history.attempts": "共 {count} 次错误作答",
    "history.missingGroup": "漏词：{words}",
    "history.extraGroup": "多余：{words}",
    "history.orderOnly": "主要是语序问题，请看明细。",
    "history.details": "作答明细",
    "history.latest": "最新记录在前",
    "history.yourInput": "你的输入",
    "history.answer": "参考答案",
    "empty.noMistakes": "本课还没有错题，继续保持！",
    "empty.completed": "本课题目已经全部完成。",
    "empty.showAll": "查看全部题目",
    "reset.message": "将清空 Lesson {lesson} 的输入、完成状态和错误历史，是否继续？",
    "reset.title": "重做本课",
    "reset.confirm": "确认重做",
    "reset.cancel": "取消",
    "reset.success": "本课记录已清空，可以重新练习了",
    "feedback.idleTitle": "先写下你的译文",
    "feedback.idleMessage": "输入英文后再检查答案。",
    "feedback.idleExplanation": "请先输入英文译文。",
    "feedback.correctTitle": "完全正确",
    "feedback.correctMessage": "大小写、标点和缩写形式不会影响判定。",
    "feedback.correctExplanation": "单词、语序和语法均匹配。",
    "feedback.closeTitle": "很接近了",
    "feedback.closeMissing": "检查遗漏的词、时态或语序。",
    "feedback.closeOrder": "单词基本齐全，再检查一下语序。",
    "feedback.wrongTitle": "还需要调整",
    "feedback.wrongMessage": "对照参考答案，先找主语、谓语，再补充其余成分。",
    "feedback.missing": "少了：{words}",
    "feedback.extra": "多了：{words}",
    "feedback.order": "检查单词顺序。",
    "feedback.fallback": "检查单词和顺序。"
  },
  en: {
    "settings.open": "Open practice settings",
    "settings.title": "Practice Settings",
    "settings.language": "Interface Language",
    "settings.selectLesson": "Select Lesson",
    "settings.practiceRange": "Practice Range",
    "settings.appearance": "Appearance",
    "settings.pronunciation": "Pronunciation",
    "settings.voice": "Voice",
    "settings.systemVoice": "System Default Voice",
    "settings.rate": "Speed {rate}×",
    "settings.progress": "Lesson Progress",
    "settings.progressHint": "Correct answers count toward progress and are saved in this browser.",
    "settings.redo": "Redo Lesson",
    "settings.redoLong": "Redo Lesson (clear lesson records)",
    "settings.shortcuts": "Shortcut",
    "settings.enterHint": "Check and move to the next sentence",
    "settings.done": "Done",
    "filter.all": "All",
    "filter.unfinished": "Unfinished",
    "filter.mistakes": "Mistakes",
    "theme.system": "System",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "stats.mastered": "Mastered",
    "stats.accuracy": "Accuracy",
    "stats.total": "Total Items",
    "header.eyebrow": "NEW CONCEPT ENGLISH · BOOK 1 · ODD LESSONS",
    "header.title": "Chinese-to-English Sentence Practice",
    "footer.source": "Based on the user-provided New Concept English Book 1 materials. For personal study only.",
    "exercise.count": "{count} items",
    "exercise.translation": "Translation",
    "exercise.original": "Original",
    "exercise.bilingual": "Translation + Original",
    "exercise.scopeHint": "Title, question, and lesson text are included in practice",
    "exercise.history": "Mistake History",
    "exercise.fullText": "Read All",
    "exercise.titleShort": "T",
    "exercise.questionShort": "Q",
    "exercise.title": "Title",
    "exercise.question": "Question",
    "exercise.sentence": "Sentence {number}",
    "exercise.answerLabel": "English translation for {item}",
    "exercise.correct": "Correct",
    "exercise.incorrect": "Incorrect",
    "exercise.errorHint": "Error Hint",
    "exercise.viewError": "View error details",
    "exercise.clearRow": "Clear This Row",
    "exercise.openActions": "Open row actions",
    "exercise.speakTitle": "Read lesson title",
    "exercise.speakQuestion": "Read lesson question",
    "exercise.speakText": "Read English text",
    "history.title": "Lesson Mistake History",
    "history.empty": "No mistake history for this lesson yet",
    "history.summary": "Mistake Summary",
    "history.attempts": "{count} incorrect attempts",
    "history.missingGroup": "Missing: {words}",
    "history.extraGroup": "Extra: {words}",
    "history.orderOnly": "Mostly word-order issues. See details.",
    "history.details": "Attempt Details",
    "history.latest": "Newest first",
    "history.yourInput": "Your answer",
    "history.answer": "Reference",
    "empty.noMistakes": "No mistakes in this lesson yet. Keep it up!",
    "empty.completed": "You have completed every item in this lesson.",
    "empty.showAll": "Show All Items",
    "reset.message": "This will clear your answers, completion status, and mistake history for Lesson {lesson}. Continue?",
    "reset.title": "Redo Lesson",
    "reset.confirm": "Redo",
    "reset.cancel": "Cancel",
    "reset.success": "Lesson records cleared. You can start again.",
    "feedback.idleTitle": "Enter your translation first",
    "feedback.idleMessage": "Enter an English answer before checking it.",
    "feedback.idleExplanation": "Please enter your English translation first.",
    "feedback.correctTitle": "Correct",
    "feedback.correctMessage": "Capitalization, punctuation, and contraction style do not affect grading.",
    "feedback.correctExplanation": "The words, word order, and grammar all match.",
    "feedback.closeTitle": "Almost there",
    "feedback.closeMissing": "Check for missing words, tense, or word order.",
    "feedback.closeOrder": "The words are mostly correct. Check the order once more.",
    "feedback.wrongTitle": "Needs revision",
    "feedback.wrongMessage": "Compare with the reference answer, then check the subject, verb, and remaining details.",
    "feedback.missing": "Missing: {words}",
    "feedback.extra": "Extra: {words}",
    "feedback.order": "Check the word order.",
    "feedback.fallback": "Check the words and their order."
  }
};

function loadLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "en" || saved === "zh-CN" ? saved : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

const locale = ref<AppLocale>(loadLocale());

export function translate(currentLocale: AppLocale, key: string, params: Record<string, string | number> = {}) {
  const template = messages[currentLocale][key] || messages["zh-CN"][key] || key;
  return Object.entries(params).reduce((result, [name, value]) => result.split(`{${name}}`).join(String(value)), template);
}

export function useI18n() {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale.value, key, params);
  return { locale, t };
}

watch(locale, (value) => {
  if (typeof document !== "undefined") document.documentElement.lang = value;
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // 浏览器禁用本地存储时仍允许本次会话切换语言。
  }
}, { immediate: true });
