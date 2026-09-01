<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Headset, Histogram, MoreFilled } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { explainDifference } from "../services/text";
import type { AnswerFeedback, DisplayMode, ExerciseItem, MistakeHistoryEntry } from "../types/practice";

const props = defineProps<{
  lessonNumber: number;
  lessonTitle: string;
  lessonTitleZh: string;
  questionEn: string;
  questionZh: string;
  items: ExerciseItem[];
  allItems: ExerciseItem[];
  answers: Record<string, string>;
  results: Record<string, AnswerFeedback>;
  completedIds: string[];
  displayMode: DisplayMode;
  mistakeHistory: MistakeHistoryEntry[];
}>();

const { locale, t } = useI18n();

const emit = defineEmits<{
  "update:displayMode": [value: DisplayMode];
  "update:answer": [id: string, value: string];
  submit: [id: string];
  clear: [id: string];
  speak: [text: string];
}>();

const inputRefs = ref<Record<string, { focus: () => void } | null>>({});
const historyVisible = ref(false);
const historyFocusItemId = ref("");
const swipeStart = ref<{ x: number; y: number } | null>(null);
const completedSet = computed(() => new Set(props.completedIds));
const sentenceItems = computed(() => props.items.filter((item) => item.kind === "sentence" || !item.kind));
const visibleTitle = computed(() => {
  if (props.displayMode === "translation") return props.lessonTitleZh;
  if (props.displayMode === "original") return props.lessonTitle;
  return `${props.lessonTitleZh} · ${props.lessonTitle}`;
});
const lessonSpeechText = computed(() => [
  props.lessonTitle,
  props.questionEn,
  ...props.allItems.filter((item) => item.kind === "sentence" || !item.kind)
    .map((item) => item.speakerEn ? `${item.speakerEn}. ${item.answer}` : item.answer)
].filter(Boolean).join(" "));

function summarizeWords(words: string[]) {
  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const visible = sorted.slice(0, 4).map(([word, count]) => count > 1 ? `${word} ×${count}` : word);
  const hiddenCount = sorted.length - visible.length;
  if (hiddenCount > 0) visible.push(`+${hiddenCount}`);
  return visible.join(locale.value === "en" ? ", " : "、");
}

const historySummary = computed(() => {
  const missing = props.mistakeHistory.flatMap((entry) => entry.missing);
  const extra = props.mistakeHistory.flatMap((entry) => entry.extra);
  return [
    missing.length ? t("history.missingGroup", { words: summarizeWords(missing) }) : "",
    extra.length ? t("history.extraGroup", { words: summarizeWords(extra) }) : ""
  ].filter(Boolean);
});
const orderedHistory = computed(() => {
  if (!historyFocusItemId.value) return props.mistakeHistory;
  return [...props.mistakeHistory].sort((a, b) => Number(b.itemId === historyFocusItemId.value) - Number(a.itemId === historyFocusItemId.value));
});

function shouldAutoFocus() {
  return !window.matchMedia("(max-width: 640px)").matches;
}

watch(() => props.lessonNumber, async () => {
  if (!shouldAutoFocus()) return;
  await nextTick();
  focusItem(props.items[0]?.id);
});

watch(() => props.displayMode, async (mode) => {
  if (mode !== "translation" || !shouldAutoFocus()) return;
  await nextTick();
  const firstPending = props.items.find((item) => !props.results[item.id]);
  focusItem(firstPending?.id);
});

function setInputRef(id: string, instance: unknown) {
  inputRefs.value[id] = instance as { focus: () => void } | null;
}

function focusItem(id?: string) {
  if (id) inputRefs.value[id]?.focus();
}

function submitAndAdvance(item: ExerciseItem, input: HTMLTextAreaElement) {
  if (!(props.answers[item.id] || "").trim()) return;
  emit("submit", item.id);
  if (!shouldAutoFocus()) {
    input.blur();
    return;
  }
  const currentIndex = props.items.findIndex((candidate) => candidate.id === item.id);
  nextTick(() => focusItem(props.items[currentIndex + 1]?.id));
}

function onKeydown(event: KeyboardEvent, item: ExerciseItem) {
  if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
  event.preventDefault();
  submitAndAdvance(item, event.currentTarget as HTMLTextAreaElement);
}

function rowState(item: ExerciseItem) {
  const result = props.results[item.id];
  if (result?.level === "correct" || (!result && completedSet.value.has(item.id))) return "is-correct";
  if (result && result.level !== "idle") return "is-wrong";
  return "";
}

function itemLabel(item: ExerciseItem, index: number) {
  if (item.kind === "title") return t("exercise.titleShort");
  if (item.kind === "question") return t("exercise.questionShort");
  return String(index - props.items.filter((candidate) => candidate.kind !== "sentence" && candidate.kind).length + 1);
}

function itemAriaLabel(item: ExerciseItem, index: number) {
  if (item.kind === "title") return t("exercise.title");
  if (item.kind === "question") return t("exercise.question");
  return t("exercise.sentence", { number: itemLabel(item, index) });
}

function openHistory(itemId = "") {
  historyFocusItemId.value = itemId;
  historyVisible.value = true;
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement;
  if (target.closest("textarea, input, button, .el-slider, .el-select")) return;
  swipeStart.value = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event: PointerEvent) {
  if (!swipeStart.value) return;
  const deltaX = event.clientX - swipeStart.value.x;
  const deltaY = event.clientY - swipeStart.value.y;
  swipeStart.value = null;
  if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
  const modes: DisplayMode[] = ["translation", "original", "bilingual"];
  const currentIndex = modes.indexOf(props.displayMode);
  const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
  if (modes[nextIndex]) emit("update:displayMode", modes[nextIndex]);
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}
</script>

<template>
  <main class="exercise-card lesson-practice" @pointerdown="onPointerDown" @pointerup="onPointerUp">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row">
          <h1>{{ visibleTitle }}</h1>
          <el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', lessonTitle)" />
        </div>
      </div>
      <div class="lesson-sentence-count">{{ t('exercise.count', { count: items.length }) }}</div>
    </div>

    <el-tabs class="display-tabs" :model-value="displayMode" stretch @update:model-value="emit('update:displayMode', $event as DisplayMode)">
      <el-tab-pane :label="t('exercise.translation')" name="translation">
        <div class="translation-toolbar">
          <span>{{ t('exercise.scopeHint') }}</span>
          <div>
            <el-button text :icon="Histogram" @click="openHistory()">{{ t('exercise.history') }}</el-button>
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechText)">{{ t('exercise.fullText') }}</el-button>
          </div>
        </div>
        <div class="sentence-list translation-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="rowState(item)">
            <div class="sentence-number" :class="{ 'is-text-label': item.kind !== 'sentence' }">{{ itemLabel(item, index) }}</div>
            <div class="sentence-content">
              <div class="sentence-prompt-row">
                <p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p>
                <el-icon v-if="rowState(item) === 'is-correct'" class="row-status-icon"><CircleCheckFilled /></el-icon>
                <el-tooltip v-else-if="rowState(item) === 'is-wrong'" trigger="click" placement="left" :show-after="0">
                  <template #content><div class="error-tooltip"><strong>{{ t('exercise.errorHint') }}</strong><p>{{ results[item.id].explanation }}</p></div></template>
                  <button class="error-info-button" type="button" :aria-label="t('exercise.viewError')">!</button>
                </el-tooltip>
              </div>

              <div v-if="rowState(item) === 'is-wrong'" class="wrong-reference">
                <p><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-part-${partIndex}`" class="diff-word" :class="`is-${part.state}`">{{ part.text }}</span></p>
              </div>

              <div class="sentence-answer-row">
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  :class="{ 'has-result': Boolean(results[item.id]) }"
                  type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" autocomplete="off"
                  :enterkeyhint="index < items.length - 1 && shouldAutoFocus() ? 'next' : 'done'"
                  :aria-label="t('exercise.answerLabel', { item: itemAriaLabel(item, index) })"
                  @update:model-value="emit('update:answer', item.id, $event)"
                  @keydown="onKeydown($event, item)"
                />
                <div class="input-row-actions">
                  <span v-if="results[item.id]" class="input-result-label">{{ results[item.id].level === 'correct' ? t('exercise.correct') : t('exercise.incorrect') }}</span>
                  <el-dropdown trigger="click" placement="bottom-end">
                    <el-button class="row-more-button" text circle :icon="MoreFilled" :aria-label="t('exercise.openActions')" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item :icon="Delete" :disabled="!answers[item.id]" @click="emit('clear', item.id)">{{ t('exercise.clearRow') }}</el-dropdown-item>
                        <el-dropdown-item :icon="Histogram" @click="openHistory(item.id)">{{ t('exercise.history') }}</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('exercise.original')" name="original">
        <section class="lesson-question is-english">
          <div class="lesson-question-copy">
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', lessonTitle)" /></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', questionEn)" /></div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">{{ t('exercise.fullText') }}</el-button>
        </section>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="emit('speak', item.answer)" /></div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('exercise.bilingual')" name="bilingual">
        <section class="lesson-question is-bilingual">
          <div class="bilingual-question-copy">
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitleZh }} · {{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', lessonTitle)" /></div>
            <div><p>{{ questionZh }}</p></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', questionEn)" /></div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">{{ t('exercise.fullText') }}</el-button>
        </section>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content"><p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p><div class="reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="emit('speak', item.answer)" /></div></div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyVisible" class="mistake-history-dialog" :title="t('history.title')" width="min(680px, calc(100% - 24px))" append-to-body>
      <el-empty v-if="!mistakeHistory.length" :description="t('history.empty')" :image-size="80" />
      <template v-else>
        <section class="mistake-summary">
          <div class="history-section-title"><strong>{{ t('history.summary') }}</strong><span>{{ t('history.attempts', { count: mistakeHistory.length }) }}</span></div>
          <div v-if="historySummary.length" class="mistake-chips"><span v-for="label in historySummary" :key="label">{{ label }}</span></div>
          <p v-else class="history-empty-copy">{{ t('history.orderOnly') }}</p>
        </section>
        <section class="mistake-details">
          <div class="history-section-title"><strong>{{ t('history.details') }}</strong><span>{{ t('history.latest') }}</span></div>
          <article v-for="entry in orderedHistory" :key="entry.id" class="mistake-detail-card" :class="{ 'is-focused': entry.itemId === historyFocusItemId }">
            <header><strong>{{ entry.prompt }}</strong><time>{{ formatTime(entry.createdAt) }}</time></header>
            <p><span>{{ t('history.yourInput') }}</span><del>{{ entry.input }}</del></p>
            <p><span>{{ t('history.answer') }}</span><ins>{{ entry.answer }}</ins></p>
            <small>{{ explainDifference(entry.missing, entry.extra, locale) }}</small>
          </article>
        </section>
      </template>
    </el-dialog>
  </main>
</template>
