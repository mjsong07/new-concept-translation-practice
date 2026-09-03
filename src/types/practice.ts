export type ResultLevel = "idle" | "correct" | "close" | "wrong";
export type PracticeFilter = "all" | "unfinished" | "mistakes";
export type DisplayMode = "translation" | "original" | "bilingual";
export type ColorSchemeMode = "system" | "light" | "dark";
export type AppLocale = "zh-CN" | "en";

export interface ExerciseItem {
  id: string;
  lesson: number;
  lessonTitle: string;
  kind?: "title" | "question" | "sentence";
  speakerZh: string;
  speakerEn: string;
  prompt: string;
  answer: string;
}

export interface Lesson {
  number: number;
  title: string;
  titleZh: string;
  questionEn: string;
  questionZh: string;
  items: ExerciseItem[];
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
