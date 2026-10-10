import { computed, ref, watch, type Ref } from "vue";
import { lessonSummaries } from "../data/lessonSummaries";
import { getLessonTeacherTranslationItems } from "../data/lessonTeacherTranslations";
import { loadLessonPayload } from "../data/lessonPayloadLoader";
import { evaluateAnswer } from "../services/text";
import { useI18n } from "./useI18n";
import type { AnswerFeedback, DisplayMode, ExerciseItem, LessonPayload, LessonSummary, MistakeHistoryEntry, StoredProgress } from "../types/practice";

const storageKey = "new-concept-translation-progress-v2";
const selectedLessonStorageKey = "new-concept-translation-selected-lesson";

// 首屏只带轻量摘要（number/title/titleZh/kind/sections），课文数据按课懒加载。
const allLessons: LessonSummary[] = [...lessonSummaries].sort((left, right) => left.number - right.number);

function buildLessonItems(lesson: LessonSummary, payload: LessonPayload | null): ExerciseItem[] {
  if (!payload) return [];
  if (lesson.kind === "written") {
    return payload.items.map((item) => ({ ...item, kind: "sentence" as const }));
  }
  return [
    {
      id: `lesson-${lesson.number}-title`, lesson: lesson.number, lessonTitle: lesson.title,
      kind: "title", speakerZh: "", speakerEn: "", prompt: lesson.titleZh, answer: lesson.title
    },
    {
      id: `lesson-${lesson.number}-question`, lesson: lesson.number, lessonTitle: lesson.title,
      kind: "question", speakerZh: "", speakerEn: "", prompt: payload.questionZh || "", answer: payload.questionEn || ""
    },
    ...payload.items.map((item) => ({ ...item, kind: "sentence" as const }))
  ];
}

function loadSelectedLesson() {
  try {
    const savedLesson = Number(localStorage.getItem(selectedLessonStorageKey));
    return allLessons.some((item) => item.number === savedLesson) ? savedLesson : allLessons[0].number;
  } catch {
    return allLessons[0].number;
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
  const payload = ref<LessonPayload | null>(null);

  const lesson = computed(() => allLessons.find((item) => item.number === selectedLesson.value) || allLessons[0]);
  const lessonItems = computed(() => buildLessonItems(lesson.value, payload.value));
  const lessonTeacherTranslationItems = computed(() => lesson.value.kind === "written" && payload.value
    ? getLessonTeacherTranslationItems(lesson.value.number, lesson.value.title, payload.value.teacherTranslationPairs || [])
    : []);
  const teacherOriginalLines = computed(() => payload.value?.teacherOriginalLines || []);
  const allLessonItems = computed(() => [...lessonItems.value, ...lessonTeacherTranslationItems.value]);
  const lessonCompleted = computed(() => lessonItems.value.filter((item) => progress.value.completed.includes(item.id)).length);
  const lessonPercent = computed(() => Math.round((lessonCompleted.value / Math.max(lessonItems.value.length, 1)) * 100));
  const lessonMistakeHistory = computed(() => progress.value.mistakeHistory.filter((entry) => entry.lesson === lesson.value.number));

  let payloadToken = 0;
  async function reloadPayload(number: number) {
    const token = ++payloadToken;
    payload.value = null;
    const data = await loadLessonPayload(number);
    if (token === payloadToken) payload.value = data;
  }
  void reloadPayload(selectedLesson.value);

  watch(selectedLesson, (value) => {
    void reloadPayload(value);
    restoreLessonResults();
    try {
      localStorage.setItem(selectedLessonStorageKey, String(value));
    } catch {
      // 浏览器禁用本地存储时仍允许继续练习。
    }
  });
  watch(payload, restoreLessonResults);
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
    const activeLesson = allLessons.find((item) => item.number === selectedLesson.value) || allLessons[0];
    [...buildLessonItems(activeLesson, payload.value), ...(activeLesson.kind === "written" ? getLessonTeacherTranslationItems(activeLesson.number, activeLesson.title, payload.value?.teacherTranslationPairs || []) : [])].forEach((item) => {
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
    const item = allLessonItems.value.find((candidate) => candidate.id === id);
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
      progress.value.completed = progress.value.completed.filter((itemId) => itemId !== id);
      progress.value.mistakes[item.id] = (progress.value.mistakes[item.id] || 0) + 1;
      const latestEntry = progress.value.mistakeHistory[0];
      const lastCorrectAt = progress.value.lastCorrectAt[item.id] || 0;
      const canMergeLatest =
        latestEntry?.itemId === item.id
        && lastCorrectAt <= latestEntry.createdAt;

      if (canMergeLatest && latestEntry) {
        const merged: MistakeHistoryEntry = {
          ...latestEntry,
          id: `${item.id}-${timestamp}-${progress.value.attempts}`,
          prompt: item.prompt,
          input: value,
          answer: item.answer,
          missing: result.missing,
          extra: result.extra,
          explanation: result.explanation,
          createdAt: timestamp
        };
        progress.value.mistakeHistory = [merged, ...progress.value.mistakeHistory.slice(1)];
      } else {
        const historyEntry: MistakeHistoryEntry = {
          id: `${item.id}-${timestamp}-${progress.value.attempts}`,
          itemId: item.id, lesson: item.lesson, prompt: item.prompt, input: value, answer: item.answer,
          missing: result.missing, extra: result.extra, explanation: result.explanation, createdAt: timestamp
        };
        progress.value.mistakeHistory.unshift(historyEntry);
      }
    }
  }

  function resetLesson() {
    const ids = new Set(allLessonItems.value.map((item) => item.id));
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
    lessons: allLessons, selectedLesson, lesson, lessonItems, lessonTeacherTranslationItems, teacherOriginalLines,
    answers, results, displayMode, progress, lessonCompleted, lessonPercent, lessonMistakeHistory,
    updateAnswer, clearAnswer, submit, resetLesson
  };
}
