<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Headset, Histogram, MoreFilled, RefreshRight, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, DisplayMode, ExerciseItem, MistakeHistoryEntry, SpeechSegment } from "../types/practice";

const props = defineProps<{
  lessonNumber: number;
  lessonTitle: string;
  lessonTitleZh: string;
  items: ExerciseItem[];
  answers: Record<string, string>;
  results: Record<string, AnswerFeedback>;
  completedIds: string[];
  displayMode: DisplayMode;
  mistakeHistory: MistakeHistoryEntry[];
  speechActive: boolean;
  speechPaused: boolean;
  activeSpeechItemId: string;
  activeWordId: string;
  characterMatchPercent: number;
}>();

const { locale, t } = useI18n();

const emit = defineEmits<{
  "update:displayMode": [value: DisplayMode];
  "update:answer": [id: string, value: string];
  submit: [id: string];
  clear: [id: string];
  speak: [segments: SpeechSegment[], pauseAfterFirst?: boolean];
  "toggle-speech": [];
  "speak-word": [wordId: string, wordText: string];
}>();

const editedIds = new Set<string>();
const errorAnchors = new Map<string, number>();

type TextareaInput = { focus: () => void; textarea?: HTMLTextAreaElement };
const inputRefs = ref<Record<string, TextareaInput | null>>({});
const isEdgeIOS = /EdgiOS/i.test(navigator.userAgent);
const historyVisible = ref(false);
const historyFocusItemId = ref("");
let blurSubmitSuppressed = false;
const completedSet = computed(() => new Set(props.completedIds));
const titleItemId = computed(() => `lesson-${props.lessonNumber}-title`);
const lessonSpeechSegments = computed<SpeechSegment[]>(() =>
  props.items.map((item) => ({ text: item.answer, itemId: item.id, speaker: item.speakerEn }))
);

const historyGroups = computed(() => {
  const entriesByItem = new Map<string, MistakeHistoryEntry[]>();
  props.mistakeHistory.forEach((entry) => {
    if (historyFocusItemId.value && entry.itemId !== historyFocusItemId.value) return;
    const entries = entriesByItem.get(entry.itemId) || [];
    entries.push(entry);
    entriesByItem.set(entry.itemId, entries);
  });
  return props.items.flatMap((item, index) => {
    const entries = entriesByItem.get(item.id);
    if (!entries?.length) return [];
    return [{ item, label: itemLabel(item, index), entries: [...entries].sort((left, right) => left.createdAt - right.createdAt) }];
  });
});
const historyEntryCount = computed(() => historyGroups.value.reduce((sum, group) => sum + group.entries.length, 0));

function shouldAutoFocus() {
  return !window.matchMedia("(max-width: 640px)").matches;
}

watch(() => props.lessonNumber, async () => {
  editedIds.clear();
  errorAnchors.clear();
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
  editedIds.delete(item.id);
  if (!answer.trim()) return;
  const anticipatedResult = evaluateAnswer(answer, item.answer, locale.value, props.characterMatchPercent / 100);
  const currentIndex = props.items.findIndex((candidate) => candidate.id === item.id);
  const nextItemId = props.items[currentIndex + 1]?.id;
  if (!shouldAutoFocus() && anticipatedResult.level === "correct" && nextItemId) {
    focusItem(nextItemId, true);
  }
  emit("submit", item.id);
  await nextTick();
  speakIfCorrect(item);
  const result = props.results[item.id];
  if (result?.level === "correct") errorAnchors.delete(item.id);
  if (!shouldAutoFocus()) {
    if (isEdgeIOS) return;
    if (result?.level !== "correct") selectError(item.id, input, result);
    else if (!nextItemId) input.blur();
    return;
  }
  if (result?.level !== "correct") {
    const target = inputRefs.value[item.id]?.textarea || input;
    target.focus();
    selectError(item.id, target, result);
    return;
  }
  focusItem(nextItemId);
}

function speakIfCorrect(item: ExerciseItem) {
  if (props.results[item.id]?.level === "correct") {
    emit("speak", [{ text: item.answer, itemId: item.id, speaker: item.speakerEn }], false);
  }
}

function selectError(itemId: string, input: HTMLTextAreaElement, result?: AnswerFeedback) {
  const start = result?.firstErrorOffset || 0;
  const end = Math.max(start, result?.firstErrorEnd || start);
  input.setSelectionRange(start, end);
  errorAnchors.set(itemId, start);
}

function onKeydown(event: KeyboardEvent, item: ExerciseItem) {
  if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
  event.preventDefault();
  submitAndAdvance(item, event.currentTarget as HTMLTextAreaElement);
}

function onAnswerInput(id: string, value: string) {
  editedIds.add(id);
  emit("update:answer", id, value);
  selectNextError(id, value);
}

// 修完一处错误并键入词边界后，把选区推进到下一处错误，避免逐词重新校验。
function selectNextError(id: string, value: string) {
  const anchor = errorAnchors.get(id);
  if (anchor === undefined) return;
  const item = props.items.find((candidate) => candidate.id === id);
  const input = inputRefs.value[id]?.textarea;
  if (!item || !input) return;
  const caret = input.selectionStart ?? value.length;
  if (!/\s/.test(value.slice(caret - 1, caret))) return;
  const result = evaluateAnswer(value, item.answer, locale.value, props.characterMatchPercent / 100);
  if (result.level === "correct") {
    errorAnchors.delete(id);
    return;
  }
  const start = result.firstErrorOffset;
  const end = Math.max(start, result.firstErrorEnd);
  if (start === anchor || (caret >= start && caret <= end)) return;
  errorAnchors.set(id, start);
  nextTick(() => input.setSelectionRange(start, end));
}

function suppressBlurSubmit() {
  blurSubmitSuppressed = true;
}

async function onBlurSubmit(item: ExerciseItem) {
  if (blurSubmitSuppressed) {
    blurSubmitSuppressed = false;
    return;
  }
  if (!editedIds.has(item.id)) return;
  editedIds.delete(item.id);
  if (!(props.answers[item.id] || "").trim()) return;
  emit("submit", item.id);
  await nextTick();
  speakIfCorrect(item);
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

async function redoFromHistory(itemId: string) {
  historyVisible.value = false;
  emit("clear", itemId);
  await nextTick();
  focusItem(itemId);
}

function speakFromSentence(item: ExerciseItem) {
  blurSubmitSuppressed = false;
  const startIndex = lessonSpeechSegments.value.findIndex((segment) => segment.itemId === item.id);
  if (startIndex < 0) return;
  emit("speak", lessonSpeechSegments.value.slice(startIndex), true);
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function historyFeedback(entry: MistakeHistoryEntry) {
  return evaluateAnswer(entry.input, entry.answer, locale.value, props.characterMatchPercent / 100);
}

function groupSummary(entries: MistakeHistoryEntry[]) {
  const separator = locale.value === "en" ? ", " : "、";
  const missing = [...new Set(entries.flatMap((entry) => entry.missing))];
  const extra = [...new Set(entries.flatMap((entry) => entry.extra))];
  const parts: string[] = [];
  if (missing.length) parts.push(t("history.missingGroup", { words: missing.join(separator) }));
  if (extra.length) parts.push(t("history.extraGroup", { words: extra.join(separator) }));
  return parts.length ? parts.join(locale.value === "en" ? "; " : "；") : t("history.orderOnly");
}

function clickableWords(text: string, itemId: string) {
  const tokens = text.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?|\s+|[^A-Za-z0-9\s]+/g) || [];
  return tokens.map((token, index) => ({
    text: token,
    wordId: `${itemId}:${index}`,
    clickable: /^[A-Za-z0-9]/.test(token)
  }));
}

function isWordToken(text: string) {
  return /^[A-Za-z0-9]/.test(text);
}

function onTextClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-word-id]");
  if (!target) return;
  const wordId = target.dataset.wordId;
  if (wordId) emit("speak-word", wordId, target.textContent || "");
}
</script>

<template>
  <main class="exercise-card lesson-practice">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row" :class="{ 'is-speaking': activeSpeechItemId === titleItemId }">
          <h1 @click="onTextClick"><template v-if="displayMode === 'translation'">{{ lessonTitleZh }}</template><template v-else-if="displayMode === 'original'"><span v-for="tok in clickableWords(lessonTitle, titleItemId)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'is-word-active': activeWordId === tok.wordId, 'clickable-word': tok.clickable }">{{ tok.text }}</span></template><template v-else>{{ lessonTitleZh }} · <span v-for="tok in clickableWords(lessonTitle, titleItemId)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'is-word-active': activeWordId === tok.wordId, 'clickable-word': tok.clickable }">{{ tok.text }}</span></template></h1>
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
            <button
              class="sentence-number" :class="{ 'is-text-label': item.kind !== 'sentence' }" type="button"
              :aria-label="t('exercise.speakItem', { item: itemAriaLabel(item, index) })"
              @mousedown.prevent @pointerdown="suppressBlurSubmit" @click="speakFromSentence(item)"
            >{{ itemLabel(item, index) }}</button>
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
                <p class="comparison-line" :class="{ 'has-speaker': item.speakerEn }"><strong v-if="item.speakerEn" class="speaker-prefix">{{ item.speakerEn }}:</strong><span class="comparison-text" @click="onTextClick"><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-reference-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'clickable-word': isWordToken(part.text), 'is-word-active': activeWordId === `${item.id}-ref:${partIndex}` }]" :data-word-id="isWordToken(part.text) ? `${item.id}-ref:${partIndex}` : undefined">{{ part.text }}</span></span></p>
                <p v-if="rowState(item) === 'is-wrong'" class="comparison-line" :class="{ 'has-speaker': item.speakerEn }"><strong v-if="item.speakerEn" class="speaker-prefix">{{ item.speakerEn }}:</strong><span class="comparison-text"><span v-for="(part, partIndex) in results[item.id].inputParts" :key="`${item.id}-input-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></span></p>
              </div>

              <div class="sentence-answer-row" :class="{ 'has-speaker': item.speakerEn }">
                <span v-if="item.speakerEn" class="input-speaker" aria-hidden="true">{{ item.speakerEn }}:</span>
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  :class="{ 'has-result': Boolean(results[item.id]), 'is-empty': !(answers[item.id] || '').trim() }"
                  type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" autocomplete="off"
                  :enterkeyhint="index < items.length - 1 ? 'next' : 'done'"
                  :aria-label="t('exercise.answerLabel', { item: itemAriaLabel(item, index) })"
                  @update:model-value="onAnswerInput(item.id, $event)"
                  @keydown="onKeydown($event, item)"
                  @blur="onBlurSubmit(item)"
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

      <el-tab-pane :label="t('exercise.bilingual')" name="bilingual">
        <div class="translation-toolbar reading-toolbar">
          <span></span>
          <div>
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </div>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <button
              class="sentence-number" :class="{ 'is-text-label': item.kind !== 'sentence' }" type="button"
              :aria-label="t('exercise.speakItem', { item: itemAriaLabel(item, index) })"
              @click="speakFromSentence(item)"
            >{{ itemLabel(item, index) }}</button>
            <div class="sentence-content"><p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p><p class="sentence-english" @click="onTextClick"><strong v-if="item.speakerEn" class="speaker-inline">{{ item.speakerEn }}:</strong><span v-for="tok in clickableWords(item.answer, item.id)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'is-word-active': activeWordId === tok.wordId, 'clickable-word': tok.clickable }">{{ tok.text }}</span></p></div>
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
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="{ 'is-speaking': activeSpeechItemId === item.id }">
            <button
              class="sentence-number" :class="{ 'is-text-label': item.kind !== 'sentence' }" type="button"
              :aria-label="t('exercise.speakItem', { item: itemAriaLabel(item, index) })"
              @click="speakFromSentence(item)"
            >{{ itemLabel(item, index) }}</button>
            <div class="sentence-content"><p class="sentence-english" @click="onTextClick"><strong v-if="item.speakerEn" class="speaker-inline">{{ item.speakerEn }}:</strong><span v-for="tok in clickableWords(item.answer, item.id)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'is-word-active': activeWordId === tok.wordId, 'clickable-word': tok.clickable }">{{ tok.text }}</span></p></div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyVisible" class="mistake-history-dialog" :title="t('history.title')" width="min(680px, calc(100% - 24px))" append-to-body>
      <el-empty v-if="!historyGroups.length" :description="t('history.empty')" :image-size="80" />
      <template v-else>
        <div class="history-dialog-heading">{{ t('history.attempts', { count: historyEntryCount }) }}</div>
        <section v-for="group in historyGroups" :key="group.item.id" class="mistake-line-group">
          <header class="mistake-line-source">
            <p><strong class="mistake-line-index">{{ group.label }}</strong><strong v-if="group.item.speakerZh">{{ group.item.speakerZh }}：</strong>{{ group.item.prompt }}</p>
            <p @click="onTextClick"><strong v-if="group.item.speakerEn">{{ group.item.speakerEn }}: </strong><span v-for="tok in clickableWords(group.item.answer, group.item.id)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'is-word-active': activeWordId === tok.wordId, 'clickable-word': tok.clickable }">{{ tok.text }}</span></p>
            <el-button class="history-redo-button" text size="small" :icon="RefreshRight" @click="redoFromHistory(group.item.id)">{{ t('exercise.redoLine') }}</el-button>
          </header>
          <p class="mistake-line-summary">{{ groupSummary(group.entries) }}</p>
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
