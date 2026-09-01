import { computed, ref, watch } from "vue";
import { lessons } from "../data/lessons";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, DisplayMode, ExerciseItem, MistakeHistoryEntry, PracticeFilter, StoredProgress } from "../types/practice";

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
      correct: saved.correct || 0, answers: saved.answers || {}, mistakeHistory: saved.mistakeHistory || []
    };
  } catch {
    return { completed: [], mistakes: {}, attempts: 0, correct: 0, answers: {}, mistakeHistory: [] };
  }
}

export function useTranslationPractice() {
  const selectedLesson = ref(loadSelectedLesson());
  const filter = ref<PracticeFilter>("all");
  const displayMode = ref<DisplayMode>("translation");
  const progress = ref(loadProgress());
  const answers = ref<Record<string, string>>({ ...progress.value.answers });
  const results = ref<Record<string, AnswerFeedback>>({});

  const lesson = computed(() => lessons.find((item) => item.number === selectedLesson.value) || lessons[0]);
  const lessonItems = computed(() => getLessonItems(lesson.value));
  const filteredItems = computed(() => {
    if (filter.value === "unfinished") return lessonItems.value.filter((item) => !progress.value.completed.includes(item.id));
    if (filter.value === "mistakes") return lessonItems.value.filter((item) => (progress.value.mistakes[item.id] || 0) > 0);
    return lessonItems.value;
  });
  const lessonCompleted = computed(() => lessonItems.value.filter((item) => progress.value.completed.includes(item.id)).length);
  const totalCompleted = computed(() => progress.value.completed.length);
  const totalItems = lessons.reduce((sum, item) => sum + getLessonItems(item).length, 0);
  const accuracy = computed(() => progress.value.attempts ? Math.round((progress.value.correct / progress.value.attempts) * 100) : 0);
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
      if (value && ((progress.value.mistakes[item.id] || 0) > 0 || progress.value.completed.includes(item.id))) {
        restored[item.id] = evaluateAnswer(value, item.answer);
      }
    });
    results.value = restored;
  }

  function updateAnswer(id: string, value: string) {
    answers.value[id] = value;
    progress.value.answers[id] = value;
    if (results.value[id]) {
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
    const result = evaluateAnswer(value, item.answer);
    results.value = { ...results.value, [id]: result };
    progress.value.attempts += 1;
    if (result.level === "correct") {
      progress.value.correct += 1;
      if (!progress.value.completed.includes(item.id)) progress.value.completed.push(item.id);
    } else {
      progress.value.completed = progress.value.completed.filter((itemId) => itemId !== item.id);
      progress.value.mistakes[item.id] = (progress.value.mistakes[item.id] || 0) + 1;
      const historyEntry: MistakeHistoryEntry = {
        id: `${item.id}-${Date.now()}-${progress.value.attempts}`,
        itemId: item.id, lesson: item.lesson, prompt: item.prompt, input: value, answer: item.answer,
        missing: result.missing, extra: result.extra, explanation: result.explanation, createdAt: Date.now()
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
    });
    progress.value.completed = progress.value.completed.filter((id) => !ids.has(id));
    progress.value.mistakeHistory = progress.value.mistakeHistory.filter((entry) => entry.lesson !== lesson.value.number);
    results.value = {};
    filter.value = "all";
  }

  return {
    lessons, selectedLesson, lesson, lessonItems, filteredItems, answers, results,
    filter, displayMode, progress, lessonCompleted, totalCompleted, totalItems, accuracy, lessonPercent, lessonMistakeHistory,
    updateAnswer, clearAnswer, submit, resetLesson
  };
}
