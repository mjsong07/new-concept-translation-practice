export type ResultLevel = "idle" | "correct" | "close" | "wrong";
export type PracticeFilter = "all" | "unfinished" | "mistakes";
export type PracticeOrder = "sequential" | "random";

export interface ExerciseItem {
  id: string;
  lesson: number;
  lessonTitle: string;
  speakerZh: string;
  speakerEn: string;
  prompt: string;
  answer: string;
}

export interface Lesson {
  number: number;
  title: string;
  items: ExerciseItem[];
}

export interface AnswerFeedback {
  level: ResultLevel;
  title: string;
  message: string;
  similarity: number;
  missing: string[];
  extra: string[];
}

export interface StoredProgress {
  completed: string[];
  mistakes: Record<string, number>;
  attempts: number;
  correct: number;
}
