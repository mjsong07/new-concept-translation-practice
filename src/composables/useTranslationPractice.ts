import { computed, ref, watch, type Ref } from "vue";
import { lessons } from "../data/lessons";
import { evaluateAnswer } from "../services/text";
import { useI18n } from "./useI18n";
import type { AnswerFeedback, DisplayMode, ExerciseItem, MistakeHistoryEntry, StoredProgress } from "../types/practice";

const storageKey = "new-concept-translation-progress-v2";
const selectedLessonStorageKey = "new-concept-translation-selected-lesson";

function getLessonItems(lesson: (typeof lessons)[number]): ExerciseItem[] {
  return [
    {
      id: `lesson-${lesson.number}-title`, lesson: lesson.number, lessonTitle: lesson.title,
      kind: "title", speakerZh: "", speakerEn: "", prompt: lesson.titleZh, answer: lesson.title
    },
    {
      id: `lesson-${lesson.number}-question`, lesson: lesson.number, lessonTitle: lesson.title,
      kind: "question", speakerZh: "", speakerEn: "", prompt: lesson.questionZh, answer: lesson.questionEn
    },
    ...lesson.items.map((item) => ({ ...item, kind: "sentence" as const }))
  ];
}

function loadSelectedLesson() {
  try {
    const savedLesson = Number(localStorage.getItem(selectedLessonStorageKey));
    return lessons.some((item) => item.number === savedLesson) ? savedLesson : lessons[0].number;
  } catch {
    return lessons[0].number;
  }
}

function loadProgress(): StoredProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return {
      completed: saved.completed || [], mistakes: saved.mistakes || {}, attempts: saved.attempts || 0,
      correct: saved.correct || 0, answers: saved.answers || {}, lastCorrectAt: saved.lastCorrectAt || {},
      mistakeHistory: saved.mistakeHistory || []
    };
  } catch {
    return { completed: [], mistakes: {}, attempts: 0, correct: 0, answers: {}, lastCorrectAt: {}, mistakeHistory: [] };
  }
}

export function useTranslationPractice(characterMatchPercent: Ref<number>) {
  const { locale } = useI18n();
  const selectedLesson = ref(loadSelectedLesson());
  const displayMode = ref<DisplayMode>("translation");
  const progress = ref(loadProgress());
  const answers = ref<Record<string, string>>({ ...progress.value.answers });
  const results = ref<Record<string, AnswerFeedback>>({});

  const lesson = computed(() => lessons.find((item) => item.number === selectedLesson.value) || lessons[0]);
  const lessonItems = computed(() => getLessonItems(lesson.value));
  const lessonCompleted = computed(() => lessonItems.value.filter((item) => progress.value.completed.includes(item.id)).length);
  const lessonPercent = computed(() => Math.round((lessonCompleted.value / Math.max(lessonItems.value.length, 1)) * 100));
  const lessonMistakeHistory = computed(() => progress.value.mistakeHistory.filter((entry) => entry.lesson === lesson.value.number));

  restoreLessonResults();

  watch(selectedLesson, (value) => {
    restoreLessonResults();
    try {
      localStorage.setItem(selectedLessonStorageKey, String(value));
    } catch {
      // 浏览器禁用本地存储时仍允许继续练习。
    }
  });
  watch([locale, characterMatchPercent], restoreLessonResults);
  watch(progress, (value) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // 本地存储空间不足时不打断当前练习。
    }
  }, { deep: true });

  function restoreLessonResults() {
    const restored: Record<string, AnswerFeedback> = {};
    getLessonItems(lessons.find((item) => item.number === selectedLesson.value) || lessons[0]).forEach((item) => {
      const value = answers.value[item.id];
      if (value && (progress.value.mistakes[item.id] || 0) > 0) {
        const result = evaluateAnswer(value, item.answer, locale.value, characterMatchPercent.value / 100);
        if (result.level !== "correct") restored[item.id] = result;
      }
    });
    results.value = restored;
  }

  function updateAnswer(id: string, value: string) {
    answers.value[id] = value;
    progress.value.answers[id] = value;
    if (results.value[id]?.level === "correct") {
      const nextResults = { ...results.value };
      delete nextResults[id];
      results.value = nextResults;
    }
  }

  function clearAnswer(id: string) {
    delete answers.value[id];
    delete progress.value.answers[id];
    progress.value.completed = progress.value.completed.filter((itemId) => itemId !== id);
    const nextResults = { ...results.value };
    delete nextResults[id];
    results.value = nextResults;
  }

  function submit(id: string) {
    const item = lessonItems.value.find((candidate) => candidate.id === id);
    const value = answers.value[id] || "";
    if (!item || !value.trim()) return;
    const result = evaluateAnswer(value, item.answer, locale.value, characterMatchPercent.value / 100);
    const timestamp = Date.now();
    results.value = { ...results.value, [id]: result };
    progress.value.attempts += 1;
    if (result.level === "correct") {
      progress.value.correct += 1;
      progress.value.lastCorrectAt[item.id] = timestamp;
      if (!progress.value.completed.includes(item.id)) progress.value.completed.push(item.id);
    } else {
      progress.value.completed = progress.value.completed.filter((itemId) => itemId !== item.id);
      progress.value.mistakes[item.id] = (progress.value.mistakes[item.id] || 0) + 1;
      const lastCorrectAt = progress.value.lastCorrectAt[item.id] || 0;
      const existingEntry = progress.value.mistakeHistory.find((entry) => entry.itemId === item.id && entry.createdAt > lastCorrectAt);
      if (existingEntry) {
        existingEntry.input = value;
        existingEntry.missing = result.missing;
        existingEntry.extra = result.extra;
        existingEntry.explanation = result.explanation;
        existingEntry.createdAt = timestamp;
        return;
      }
      const historyEntry: MistakeHistoryEntry = {
        id: `${item.id}-${timestamp}-${progress.value.attempts}`,
        itemId: item.id, lesson: item.lesson, prompt: item.prompt, input: value, answer: item.answer,
        missing: result.missing, extra: result.extra, explanation: result.explanation, createdAt: timestamp
      };
      progress.value.mistakeHistory.unshift(historyEntry);
    }
  }

  function resetLesson() {
    const ids = new Set(lessonItems.value.map((item) => item.id));
    ids.forEach((id) => {
      delete answers.value[id];
      delete progress.value.answers[id];
      delete progress.value.mistakes[id];
      delete progress.value.lastCorrectAt[id];
    });
    progress.value.completed = progress.value.completed.filter((id) => !ids.has(id));
    progress.value.mistakeHistory = progress.value.mistakeHistory.filter((entry) => entry.lesson !== lesson.value.number);
    results.value = {};
  }

  return {
    lessons, selectedLesson, lesson, lessonItems, answers, results,
    displayMode, progress, lessonCompleted, lessonPercent, lessonMistakeHistory,
    updateAnswer, clearAnswer, submit, resetLesson
  };
}
