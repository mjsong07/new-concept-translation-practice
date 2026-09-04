<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Headset, Histogram, MoreFilled, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, DisplayMode, ExerciseItem, MistakeHistoryEntry, SpeechSegment } from "../types/practice";

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
  speechActive: boolean;
  speechPaused: boolean;
  activeSpeechItemId: string;
}>();

const { locale, t } = useI18n();

const emit = defineEmits<{
  "update:displayMode": [value: DisplayMode];
  "update:answer": [id: string, value: string];
  submit: [id: string];
  clear: [id: string];
  speak: [segments: SpeechSegment[], pauseAfterFirst?: boolean];
  "toggle-speech": [];
}>();

type TextareaInput = { focus: () => void; textarea?: HTMLTextAreaElement };
const inputRefs = ref<Record<string, TextareaInput | null>>({});
const isEdgeIOS = /EdgiOS/i.test(navigator.userAgent);
const historyVisible = ref(false);
const historyFocusItemId = ref("");
const completedSet = computed(() => new Set(props.completedIds));
const sentenceItems = computed(() => props.items.filter((item) => item.kind === "sentence" || !item.kind));
const titleItemId = computed(() => `lesson-${props.lessonNumber}-title`);
const questionItemId = computed(() => `lesson-${props.lessonNumber}-question`);
const visibleTitle = computed(() => {
  if (props.displayMode === "translation") return props.lessonTitleZh;
  if (props.displayMode === "original") return props.lessonTitle;
  return `${props.lessonTitleZh} · ${props.lessonTitle}`;
});
const lessonSpeechSegments = computed<SpeechSegment[]>(() => [
  { text: props.lessonTitle, itemId: titleItemId.value },
  { text: props.questionEn, itemId: questionItemId.value },
  ...props.allItems.filter((item) => item.kind === "sentence" || !item.kind)
    .map((item) => ({ text: item.answer, itemId: item.id, speaker: item.speakerEn }))
]);

const visibleHistory = computed(() => {
  const entries = historyFocusItemId.value
    ? props.mistakeHistory.filter((entry) => entry.itemId === historyFocusItemId.value)
    : props.mistakeHistory;
  return [...entries].sort((left, right) => left.createdAt - right.createdAt);
});
const historyGroups = computed(() => {
  const groups: Array<{ item: ExerciseItem; entries: MistakeHistoryEntry[] }> = [];
  visibleHistory.value.forEach((entry) => {
    const item = props.allItems.find((candidate) => candidate.id === entry.itemId);
    if (!item) return;
    const previousGroup = groups[groups.length - 1];
    if (previousGroup?.item.id === entry.itemId) previousGroup.entries.push(entry);
    else groups.push({ item, entries: [entry] });
  });
  return groups;
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
  inputRefs.value[id] = instance as TextareaInput | null;
}

function focusItem(id?: string, preventScroll = false) {
  if (!id) return;
  const input = inputRefs.value[id];
  if (!preventScroll || !input?.textarea) {
    input?.focus();
    return;
  }
  input.textarea.focus({ preventScroll: true });
}

async function submitAndAdvance(item: ExerciseItem, input: HTMLTextAreaElement) {
  const answer = props.answers[item.id] || "";
  if (!answer.trim()) return;
  const anticipatedResult = evaluateAnswer(answer, item.answer, locale.value);
  const currentIndex = props.items.findIndex((candidate) => candidate.id === item.id);
  const nextItemId = props.items[currentIndex + 1]?.id;
  if (!shouldAutoFocus() && anticipatedResult.level === "correct" && nextItemId) {
    focusItem(nextItemId, true);
  }
  emit("submit", item.id);
  await nextTick();
  const result = props.results[item.id];
  if (!shouldAutoFocus()) {
    if (isEdgeIOS) return;
    if (result?.level !== "correct") selectError(input, result);
    else if (!nextItemId) input.blur();
    return;
  }
  if (result?.level !== "correct") {
    const target = inputRefs.value[item.id]?.textarea || input;
    target.focus();
    selectError(target, result);
    return;
  }
  focusItem(nextItemId);
}

function selectError(input: HTMLTextAreaElement, result?: AnswerFeedback) {
  const start = result?.firstErrorOffset || 0;
  const end = Math.max(start, result?.firstErrorEnd || start);
  input.setSelectionRange(start, end);
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

function speakFromSentence(item: ExerciseItem) {
  const startIndex = lessonSpeechSegments.value.findIndex((segment) => segment.itemId === item.id);
  if (startIndex < 0) return;
  emit("speak", lessonSpeechSegments.value.slice(startIndex), true);
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function historyFeedback(entry: MistakeHistoryEntry) {
  return evaluateAnswer(entry.input, entry.answer, locale.value);
}
</script>

<template>
  <main class="exercise-card lesson-practice">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row" :class="{ 'is-speaking': activeSpeechItemId === titleItemId }">
          <h1>{{ visibleTitle }}</h1>
          <el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle, itemId: titleItemId }])" />
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
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </div>
        <div class="sentence-list translation-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="[rowState(item), { 'is-speaking': activeSpeechItemId === item.id }]">
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

              <div v-if="results[item.id]" class="answer-comparison" :class="{ 'is-wrong': rowState(item) === 'is-wrong' }">
                <p class="comparison-line" :class="{ 'has-speaker': item.speakerEn }"><strong v-if="item.speakerEn" class="speaker-prefix">{{ item.speakerEn }}:</strong><span class="comparison-text"><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-reference-${partIndex}`" class="diff-word" :class="`is-${part.state}`">{{ part.text }}</span></span></p>
                <p v-if="rowState(item) === 'is-wrong'" class="comparison-line" :class="{ 'has-speaker': item.speakerEn }"><strong v-if="item.speakerEn" class="speaker-prefix">{{ item.speakerEn }}:</strong><span class="comparison-text"><span v-for="(part, partIndex) in results[item.id].inputParts" :key="`${item.id}-input-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></span></p>
              </div>

              <div class="sentence-answer-row" :class="{ 'has-speaker': item.speakerEn }">
                <span v-if="item.speakerEn" class="input-speaker" aria-hidden="true">{{ item.speakerEn }}:</span>
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  :class="{ 'has-result': Boolean(results[item.id]) }"
                  type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" autocomplete="off"
                  :enterkeyhint="index < items.length - 1 ? 'next' : 'done'"
                  :aria-label="t('exercise.answerLabel', { item: itemAriaLabel(item, index) })"
                  @update:model-value="emit('update:answer', item.id, $event)"
                  @keydown="onKeydown($event, item)"
                />
                <div class="input-row-actions">
                  <span v-if="results[item.id]" class="input-result-label">{{ results[item.id].level === 'correct' ? t('exercise.correct') : t('exercise.incorrect') }}</span>
                  <el-button class="row-speech-button" text circle :icon="Headset" :aria-label="t('exercise.speakText')" @click="speakFromSentence(item)" />
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
        <div class="translation-toolbar reading-toolbar">
          <span></span>
          <div>
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </div>
        <section class="lesson-question is-english">
          <div class="lesson-question-copy">
            <div class="mobile-title-with-speech" :class="{ 'is-speaking': activeSpeechItemId === titleItemId }"><strong class="mobile-lesson-title">{{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle, itemId: titleItemId }])" /></div>
            <div class="question-with-speech" :class="{ 'is-speaking': activeSpeechItemId === questionItemId }"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', [{ text: questionEn, itemId: questionItemId }])" /></div>
          </div>
        </section>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn" class="speaker-inline">{{ item.speakerEn }}:</strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="speakFromSentence(item)" /></div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('exercise.bilingual')" name="bilingual">
        <div class="translation-toolbar reading-toolbar">
          <span></span>
          <div>
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </div>
        <section class="lesson-question is-bilingual">
          <div class="bilingual-question-copy">
            <div class="mobile-title-with-speech" :class="{ 'is-speaking': activeSpeechItemId === titleItemId }"><strong class="mobile-lesson-title">{{ lessonTitleZh }} · {{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle, itemId: titleItemId }])" /></div>
            <div><p>{{ questionZh }}</p></div>
            <div class="question-with-speech" :class="{ 'is-speaking': activeSpeechItemId === questionItemId }"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', [{ text: questionEn, itemId: questionItemId }])" /></div>
          </div>
        </section>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content"><p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p><div class="reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn" class="speaker-inline">{{ item.speakerEn }}:</strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="speakFromSentence(item)" /></div></div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyVisible" class="mistake-history-dialog" :title="t('history.title')" width="min(680px, calc(100% - 24px))" append-to-body>
      <el-empty v-if="!visibleHistory.length" :description="t('history.empty')" :image-size="80" />
      <template v-else>
        <div class="history-dialog-heading">{{ t('history.attempts', { count: visibleHistory.length }) }}</div>
        <section v-for="(group, groupIndex) in historyGroups" :key="`${group.item.id}-${groupIndex}`" class="mistake-line-group">
          <header class="mistake-line-source">
            <p><strong v-if="group.item.speakerZh">{{ group.item.speakerZh }}：</strong>{{ group.item.prompt }}</p>
            <p><strong v-if="group.item.speakerEn">{{ group.item.speakerEn }}: </strong>{{ group.item.answer }}</p>
          </header>
          <div class="mistake-attempt-list">
            <article v-for="entry in group.entries" :key="entry.id" class="mistake-attempt-row">
              <p><span v-for="(part, partIndex) in historyFeedback(entry).inputParts" :key="`${entry.id}-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></p>
              <time>{{ formatTime(entry.createdAt) }}</time>
            </article>
          </div>
        </section>
      </template>
    </el-dialog>
  </main>
</template>
