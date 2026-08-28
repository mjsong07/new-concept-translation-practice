import { computed, ref, watch } from "vue";
import { lessons } from "../data/lessons";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, DisplayMode, PracticeFilter, StoredProgress } from "../types/practice";

const storageKey = "new-concept-translation-progress-v1";

function loadProgress(): StoredProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return { completed: saved.completed || [], mistakes: saved.mistakes || {}, attempts: saved.attempts || 0, correct: saved.correct || 0 };
  } catch {
    return { completed: [], mistakes: {}, attempts: 0, correct: 0 };
  }
}

export function useTranslationPractice() {
  const selectedLesson = ref(lessons[0].number);
  const filter = ref<PracticeFilter>("all");
  const displayMode = ref<DisplayMode>("translation");
  const answers = ref<Record<string, string>>({});
  const results = ref<Record<string, AnswerFeedback>>({});
  const progress = ref(loadProgress());

  const lesson = computed(() => lessons.find((item) => item.number === selectedLesson.value) || lessons[0]);
  const filteredItems = computed(() => {
    const items = lesson.value.items;
    if (filter.value === "unfinished") return items.filter((item) => !progress.value.completed.includes(item.id));
    if (filter.value === "mistakes") return items.filter((item) => (progress.value.mistakes[item.id] || 0) > 0);
    return items;
  });
  const lessonCompleted = computed(() => lesson.value.items.filter((item) => progress.value.completed.includes(item.id)).length);
  const totalCompleted = computed(() => progress.value.completed.length);
  const totalItems = lessons.reduce((sum, item) => sum + item.items.length, 0);
  const accuracy = computed(() => progress.value.attempts ? Math.round((progress.value.correct / progress.value.attempts) * 100) : 0);
  const lessonPercent = computed(() => Math.round((lessonCompleted.value / Math.max(lesson.value.items.length, 1)) * 100));

  watch(selectedLesson, resetLessonSession);
  watch(progress, (value) => localStorage.setItem(storageKey, JSON.stringify(value)), { deep: true });

  function updateAnswer(id: string, value: string) {
    answers.value[id] = value;
    if (results.value[id]) {
      const nextResults = { ...results.value };
      delete nextResults[id];
      results.value = nextResults;
    }
  }

  function submit(id: string) {
    const item = lesson.value.items.find((candidate) => candidate.id === id);
    const value = answers.value[id] || "";
    if (!item || !value.trim()) return;
    const result = evaluateAnswer(value, item.answer);
    results.value = { ...results.value, [id]: result };
    progress.value.attempts += 1;
    if (result.level === "correct") {
      progress.value.correct += 1;
      if (!progress.value.completed.includes(item.id)) progress.value.completed.push(item.id);
      delete progress.value.mistakes[item.id];
    } else {
      progress.value.mistakes[item.id] = (progress.value.mistakes[item.id] || 0) + 1;
    }
  }

  function resetLessonSession() {
    answers.value = {};
    results.value = {};
  }

  return {
    lessons, selectedLesson, lesson, filteredItems, answers, results,
    filter, displayMode, progress, lessonCompleted, totalCompleted, totalItems, accuracy, lessonPercent,
    updateAnswer, submit
  };
}
