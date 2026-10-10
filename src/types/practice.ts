export type ResultLevel = "idle" | "correct" | "close" | "wrong";
export type DisplayMode = "translation" | "original" | "bilingual";
export type ColorSchemeMode = "system" | "light" | "dark";
export type AppLocale = "zh-CN" | "en";
export type LessonFilter = "all" | "odd" | "even";

export interface ExerciseItem {
  id: string;
  lesson: number;
  lessonTitle: string;
  kind?: "title" | "question" | "sentence";
  mode?: "translate" | "fill" | "sentence";
  section?: string;
  speakerZh: string;
  speakerEn: string;
  prompt: string;
  answer: string;
}

// 偶数课书面练习的分区（对应教材 Written exercises 下的 A、B、C…）。
export interface WrittenSectionMeta {
  key: string;
  titleEn: string;
  titleZh: string;
  examplePrompt?: string;
  exampleAnswer?: string;
}

export interface Lesson {
  number: number;
  title: string;
  titleZh: string;
  questionEn: string;
  questionZh: string;
  kind?: "translation" | "written";
  sections?: WrittenSectionMeta[];
  items: ExerciseItem[];
}

// 首屏课程列表所需的轻量摘要；items 等大字段经 scripts/split-lesson-data.mjs
// 拆分至 src/data/lesson-payloads/<课号>.ts，进入课程时再懒加载。
export interface LessonSummary {
  number: number;
  title: string;
  titleZh: string;
  kind?: "translation" | "written";
  sections?: WrittenSectionMeta[];
}

// 按课拆分的完整课程数据（src/data/lesson-payloads/<课号>.ts 的默认导出）。
export interface LessonPayload {
  items: ExerciseItem[];
  questionEn?: string;
  questionZh?: string;
  teacherTranslationPairs?: { original: string; translation: string }[];
  teacherOriginalLines?: string[];
  content?: LessonContentBlock[];
}

// 课堂笔记正文块（与 src/data/lessonContent.ts 中的定义保持一致）。
export interface LessonContentBlock {
  category: "Words" | "Grammar" | "Practices" | "Comprehension" | "Asking questions" | "Story";
  lines: string[];
}

export interface AnswerFeedback {
  level: ResultLevel;
  title: string;
  message: string;
  similarity: number;
  missing: string[];
  extra: string[];
  referenceParts: AnswerDiffPart[];
  inputParts: AnswerDiffPart[];
  firstErrorOffset: number;
  firstErrorEnd: number;
  explanation: string;
}

export interface AnswerDiffPart {
  text: string;
  state: "correct" | "wrong" | "neutral";
  placeholder?: boolean;
}

export interface StoredProgress {
  completed: string[];
  mistakes: Record<string, number>;
  attempts: number;
  correct: number;
  answers: Record<string, string>;
  lastCorrectAt: Record<string, number>;
  mistakeHistory: MistakeHistoryEntry[];
}

export interface MistakeHistoryEntry {
  id: string;
  itemId: string;
  lesson: number;
  prompt: string;
  input: string;
  answer: string;
  missing: string[];
  extra: string[];
  explanation: string;
  createdAt: number;
}

export interface SpeechSettings {
  voiceURI: string;
  rate: number;
  volume: number;
}

export interface SpeechSegment {
  text: string;
  itemId?: string;
  speaker?: string;
}
