import { computed, ref, watch } from "vue";
import { lessons } from "../data/lessons";
import { evaluateAnswer } from "../services/text";
import type { PracticeFilter, PracticeOrder, StoredProgress } from "../types/practice";

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
  const itemIndex = ref(0);
  const answer = ref("");
  const submitted = ref(false);
  const filter = ref<PracticeFilter>("all");
  const order = ref<PracticeOrder>("sequential");
  const progress = ref(loadProgress());

  const lesson = computed(() => lessons.find((item) => item.number === selectedLesson.value) || lessons[0]);
  const filteredItems = computed(() => {
    const items = lesson.value.items;
    if (filter.value === "unfinished") return items.filter((item) => !progress.value.completed.includes(item.id));
    if (filter.value === "mistakes") return items.filter((item) => (progress.value.mistakes[item.id] || 0) > 0);
    return items;
  });
  const currentItem = computed(() => filteredItems.value[itemIndex.value] || lesson.value.items[0]);
  const feedback = computed(() => evaluateAnswer(answer.value, currentItem.value.answer));
  const lessonCompleted = computed(() => lesson.value.items.filter((item) => progress.value.completed.includes(item.id)).length);
  const totalCompleted = computed(() => progress.value.completed.length);
  const totalItems = lessons.reduce((sum, item) => sum + item.items.length, 0);
  const accuracy = computed(() => progress.value.attempts ? Math.round((progress.value.correct / progress.value.attempts) * 100) : 0);
  const lessonPercent = computed(() => Math.round((lessonCompleted.value / Math.max(lesson.value.items.length, 1)) * 100));

  watch([selectedLesson, filter], resetQuestion);
  watch(progress, (value) => localStorage.setItem(storageKey, JSON.stringify(value)), { deep: true });

  function submit() {
    if (!answer.value.trim() || submitted.value) return;
    submitted.value = true;
    const result = evaluateAnswer(answer.value, currentItem.value.answer);
    const item = currentItem.value;
    progress.value.attempts += 1;
    if (result.level === "correct") {
      progress.value.correct += 1;
      if (!progress.value.completed.includes(item.id)) progress.value.completed.push(item.id);
      delete progress.value.mistakes[item.id];
    } else {
      progress.value.mistakes[item.id] = (progress.value.mistakes[item.id] || 0) + 1;
    }
  }

  function next() {
    const count = filteredItems.value.length;
    if (!count) return;
    if (order.value === "random" && count > 1) {
      let nextIndex = itemIndex.value;
      while (nextIndex === itemIndex.value) nextIndex = Math.floor(Math.random() * count);
      itemIndex.value = nextIndex;
    } else {
      itemIndex.value = (itemIndex.value + 1) % count;
    }
    clearAnswer();
  }

  function previous() {
    const count = filteredItems.value.length;
    if (!count) return;
    itemIndex.value = (itemIndex.value - 1 + count) % count;
    clearAnswer();
  }

  function retry() {
    answer.value = "";
    submitted.value = false;
  }

  function resetQuestion() {
    itemIndex.value = 0;
    clearAnswer();
  }

  function clearAnswer() {
    answer.value = "";
    submitted.value = false;
  }

  return {
    lessons, selectedLesson, lesson, filteredItems, currentItem, itemIndex, answer, submitted, feedback,
    filter, order, progress, lessonCompleted, totalCompleted, totalItems, accuracy, lessonPercent,
    submit, next, previous, retry
  };
}
