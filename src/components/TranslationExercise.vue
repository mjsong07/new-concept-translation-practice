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
  speak: [segments: SpeechSegment[]];
  "toggle-speech": [];
}>();

type TextareaInput = { focus: () => void; textarea?: HTMLTextAreaElement };
const inputRefs = ref<Record<string, TextareaInput | null>>({});
const rootRef = ref<HTMLElement | null>(null);
const inputFocused = ref(false);
const isEdgeIOS = /EdgiOS/i.test(navigator.userAgent);
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
const lessonSpeechSegments = computed<SpeechSegment[]>(() => [
  { text: props.lessonTitle },
  { text: props.questionEn },
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

watch(() => props.activeSpeechItemId, async (itemId) => {
  if (!itemId) return;
  await nextTick();
  rootRef.value?.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`)
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
});

function setInputRef(id: string, instance: unknown) {
  inputRefs.value[id] = instance as TextareaInput | null;
}

function focusItem(id?: string, controlScroll = false) {
  if (!id) return;
  const input = inputRefs.value[id];
  if (!controlScroll || !input?.textarea) {
    input?.focus();
    return;
  }
  const textarea = input.textarea;
  textarea.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    const row = textarea.closest<HTMLElement>(".sentence-row");
    if (!row) return;
    const viewportTop = window.visualViewport?.offsetTop || 0;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const rowRect = row.getBoundingClientRect();
    const desiredTop = viewportTop + Math.max(16, (viewportHeight - rowRect.height) / 2);
    window.scrollBy({ top: rowRect.top - desiredTop, behavior: "auto" });
  });
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

function onFocusIn(event: FocusEvent) {
  if (event.target instanceof HTMLTextAreaElement) inputFocused.value = true;
}

function onFocusOut() {
  const updateFocusState = () => {
    inputFocused.value = Boolean(
      rootRef.value?.contains(document.activeElement)
      && document.activeElement instanceof HTMLTextAreaElement
    );
  };
  if (isEdgeIOS) window.setTimeout(updateFocusState, 450);
  else requestAnimationFrame(updateFocusState);
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

function historyFeedback(entry: MistakeHistoryEntry) {
  return evaluateAnswer(entry.input, entry.answer, locale.value);
}
</script>

<template>
  <main
    ref="rootRef"
    class="exercise-card lesson-practice"
    :class="{ 'is-edgios': isEdgeIOS, 'has-active-input': inputFocused }"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
  >
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row">
          <h1>{{ visibleTitle }}</h1>
          <el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle }])" />
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
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :data-item-id="item.id" :class="[rowState(item), { 'is-speaking': activeSpeechItemId === item.id }]">
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
                <p class="comparison-line"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-reference-${partIndex}`" class="diff-word" :class="`is-${part.state}`">{{ part.text }}</span></p>
                <p v-if="rowState(item) === 'is-wrong'" class="comparison-line"><span v-for="(part, partIndex) in results[item.id].inputParts" :key="`${item.id}-input-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></p>
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
                  <el-button class="row-speech-button" text circle :icon="Headset" :aria-label="t('exercise.speakText')" @click="emit('speak', [{ text: item.answer, itemId: item.id, speaker: item.speakerEn }])" />
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
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle }])" /></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', [{ text: questionEn }])" /></div>
          </div>
          <div class="lesson-speech-actions">
            <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </section>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row" :data-item-id="item.id" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="emit('speak', [{ text: item.answer, itemId: item.id, speaker: item.speakerEn }])" /></div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('exercise.bilingual')" name="bilingual">
        <section class="lesson-question is-bilingual">
          <div class="bilingual-question-copy">
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitleZh }} · {{ lessonTitle }}</strong><el-button circle text :icon="Headset" :aria-label="t('exercise.speakTitle')" @click="emit('speak', [{ text: lessonTitle }])" /></div>
            <div><p>{{ questionZh }}</p></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakQuestion')" @click="emit('speak', [{ text: questionEn }])" /></div>
          </div>
          <div class="lesson-speech-actions">
            <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </section>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row" :data-item-id="item.id" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content"><p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p><div class="reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" :aria-label="t('exercise.speakText')" @click="emit('speak', [{ text: item.answer, itemId: item.id, speaker: item.speakerEn }])" /></div></div>
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
