<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Histogram, RefreshRight } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, ExerciseItem, MistakeHistoryEntry, SpeechSegment } from "../types/practice";

type WrittenView = "practice" | "reading";

const props = defineProps<{
  lessonNumber: number;
  lessonTitle: string;
  lessonTitleZh: string;
  items: ExerciseItem[];
  answers: Record<string, string>;
  results: Record<string, AnswerFeedback>;
  completedIds: string[];
  mistakeHistory: MistakeHistoryEntry[];
  autoAdvanceErrors: boolean;
  characterMatchPercent: number;
}>();

const emit = defineEmits<{
  "update:answer": [id: string, value: string];
  submit: [id: string];
  clear: [id: string];
  speak: [segments: SpeechSegment[]];
  "speak-word": [wordId: string, wordText: string];
}>();

const { locale, t } = useI18n();

const editedIds = new Set<string>();
const errorAnchors = new Map<string, number>();

type InputRef = { focus: () => void; input?: HTMLInputElement; textarea?: HTMLTextAreaElement };
const inputRefs = ref<Record<string, InputRef | null>>({});
const historyVisible = ref(false);
const historyFocusItemId = ref("");
const view = ref<WrittenView>("practice");
let blurSubmitSuppressed = false;

const completedSet = computed(() => new Set(props.completedIds));
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
    return [{ item, label: String(index + 1), entries: [...entries].sort((left, right) => left.createdAt - right.createdAt) }];
  });
});

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

function setInputRef(id: string, instance: unknown) {
  inputRefs.value[id] = instance as InputRef | null;
}

function focusItem(id?: string, preventScroll = false) {
  if (!id) return;
  const input = inputRefs.value[id];
  if (!preventScroll || !input?.input) {
    input?.focus();
    return;
  }
  input.input.focus({ preventScroll: true });
}

async function submitAndAdvance(item: ExerciseItem, element: HTMLInputElement | HTMLTextAreaElement) {
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
    if (result?.level !== "correct") selectError(item.id, element, result);
    else if (!nextItemId) element.blur();
    return;
  }
  if (result?.level !== "correct") {
    const target = getInputElement(item.id) || element;
    target.focus();
    selectError(item.id, target, result);
    return;
  }
  focusItem(nextItemId);
}

function speakIfCorrect(item: ExerciseItem) {
  if (props.results[item.id]?.level === "correct") {
    emit("speak", [{ text: item.answer, itemId: item.id, speaker: item.speakerEn }]);
  }
}

function getInputElement(id: string): HTMLInputElement | HTMLTextAreaElement | undefined {
  const instance = inputRefs.value[id];
  return instance?.input || instance?.textarea;
}

function selectError(itemId: string, element: HTMLInputElement | HTMLTextAreaElement, result?: AnswerFeedback) {
  const start = result?.firstErrorOffset || 0;
  const end = Math.max(start, result?.firstErrorEnd || start);
  element.setSelectionRange(start, end);
  errorAnchors.set(itemId, start);
}

function onKeydown(event: KeyboardEvent, item: ExerciseItem) {
  if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
  event.preventDefault();
  submitAndAdvance(item, event.currentTarget as HTMLInputElement | HTMLTextAreaElement);
}

function onAnswerInput(id: string, value: string) {
  editedIds.add(id);
  emit("update:answer", id, value);
  if (props.autoAdvanceErrors) selectNextError(id, value);
}

function selectNextError(id: string, value: string) {
  const anchor = errorAnchors.get(id);
  if (anchor === undefined) return;
  const item = props.items.find((candidate) => candidate.id === id);
  const element = getInputElement(id);
  if (!item || !element) return;
  const caret = element.selectionStart ?? value.length;
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
  nextTick(() => element.setSelectionRange(start, end));
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

function itemLabel(_item: ExerciseItem, index: number) {
  return String(index + 1);
}

function openHistory(itemId = "") {
  historyFocusItemId.value = itemId;
  historyVisible.value = true;
}

async function clearAndFocus(itemId: string) {
  emit("clear", itemId);
  await nextTick();
  focusItem(itemId);
}

async function redoFromHistory(itemId: string) {
  historyVisible.value = false;
  await clearAndFocus(itemId);
}

function speakFromSentence(item: ExerciseItem) {
  blurSubmitSuppressed = false;
  const startIndex = lessonSpeechSegments.value.findIndex((segment) => segment.itemId === item.id);
  if (startIndex < 0) return;
  emit("speak", lessonSpeechSegments.value.slice(startIndex));
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

function renderFillPrompt(prompt: string) {
  return prompt.split("_____").map((segment, index, array) => {
    const nodes = [segment];
    if (index < array.length - 1) nodes.push("__");
    return nodes;
  }).flat();
}

function isFillMode(item: ExerciseItem) {
  return item.mode === "fill";
}

type ClickableToken = {
  text: string;
  wordId: string;
  clickable: boolean;
  start: number;
};

function clickableWords(text: string, itemId: string): ClickableToken[] {
  const tokens = text.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?|\s+|[^A-Za-z0-9\s]+/g) || [];
  let start = 0;
  return tokens.map((token, index) => {
    const result = {
      text: token,
      wordId: `${itemId}:${index}`,
      clickable: /^[A-Za-z0-9]/.test(token),
      start
    };
    start += token.length;
    return result;
  });
}

function onTextClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-word-id]");
  if (!target) return;
  const wordId = target.dataset.wordId;
  const word = target.textContent || "";
  if (!wordId) return;
  emit("speak-word", wordId, word);
}
</script>

<template>
  <main class="exercise-card lesson-practice written-practice">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <h1 class="lesson-title-row">{{ lessonTitleZh }} · {{ lessonTitle }}</h1>
      </div>
      <div class="lesson-sentence-count">{{ t('exercise.count', { count: items.length }) }}</div>
    </div>

    <el-tabs class="display-tabs" :model-value="view" stretch @update:model-value="view = ($event as WrittenView)">
      <el-tab-pane :label="t('exercise.practice')" name="practice">
        <div class="translation-toolbar">
          <span>{{ t('exercise.scopeHintWritten') }}</span>
          <div>
            <el-button text :icon="Histogram" @click="openHistory()">{{ t('exercise.history') }}</el-button>
            <el-button plain :icon="Histogram" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
          </div>
        </div>
        <div class="sentence-list translation-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="[rowState(item)]">
            <button
              class="sentence-number" type="button"
              :aria-label="t('exercise.speakItem', { item: itemLabel(item, index) })"
              @mousedown.prevent @pointerdown="suppressBlurSubmit" @click="speakFromSentence(item)"
            >{{ itemLabel(item, index) }}</button>
            <div class="sentence-content">
              <div class="sentence-prompt-row">
                <p class="sentence-chinese"><strong v-if="item.speakerEn">{{ item.speakerEn }}：</strong><template v-if="isFillMode(item)"><template v-for="(token, tokenIndex) in renderFillPrompt(item.prompt)" :key="tokenIndex"><span v-if="token === '__'" class="fill-blank">{{ t('exercise.fillPlaceholder') }}</span><template v-else>{{ token }}</template></template></template><template v-else>{{ item.prompt }}</template></p>
                <el-button
                  class="row-action-button" text circle size="small" :icon="Delete"
                  :disabled="!answers[item.id]" :aria-label="t('exercise.clearRow')"
                  @mousedown.prevent @pointerdown="suppressBlurSubmit" @click="clearAndFocus(item.id)"
                />
                <el-button
                  class="row-action-button" text circle size="small" :icon="Histogram"
                  :aria-label="t('exercise.history')" @click="openHistory(item.id)"
                />
                <span v-if="results[item.id]" class="input-result-label">{{ results[item.id].level === 'correct' ? t('exercise.correct') : t('exercise.incorrect') }}</span>
                <el-icon v-if="rowState(item) === 'is-correct'" class="row-status-icon"><CircleCheckFilled /></el-icon>
                <el-tooltip v-else-if="rowState(item) === 'is-wrong'" trigger="click" placement="left" :show-after="0">
                  <template #content><div class="error-tooltip"><strong>{{ t('exercise.errorHint') }}</strong><p>{{ results[item.id].explanation }}</p></div></template>
                  <button class="error-info-button" type="button" :aria-label="t('exercise.viewError')">!</button>
                </el-tooltip>
              </div>

              <div v-if="results[item.id]" class="answer-comparison" :class="{ 'is-wrong': rowState(item) === 'is-wrong' }">
                <p class="comparison-line"><span class="comparison-text" @click="onTextClick"><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-reference-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'clickable-word': /^[A-Za-z0-9]/.test(part.text) }]" :data-word-id="/^[A-Za-z0-9]/.test(part.text) ? `${item.id}-ref:${partIndex}` : undefined">{{ part.text }}</span></span></p>
                <p v-if="rowState(item) === 'is-wrong'" class="comparison-line"><span class="comparison-text"><span v-for="(part, partIndex) in results[item.id].inputParts" :key="`${item.id}-input-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></span></p>
              </div>

              <div v-if="isFillMode(item)" class="sentence-answer-row written-fill-row">
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  class="written-fill-input"
                  :class="{ 'is-empty': !(answers[item.id] || '').trim() }"
                  :placeholder="t('exercise.fillPlaceholder')"
                  autocomplete="off"
                  :enterkeyhint="index < items.length - 1 ? 'next' : 'done'"
                  :aria-label="t('exercise.answerLabel', { item: itemLabel(item, index) })"
                  @update:model-value="onAnswerInput(item.id, $event)"
                  @keydown="onKeydown($event, item)"
                  @blur="onBlurSubmit(item)"
                />
              </div>
              <div v-else class="sentence-answer-row">
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  :class="{ 'is-empty': !(answers[item.id] || '').trim() }"
                  type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" autocomplete="off"
                  :enterkeyhint="index < items.length - 1 ? 'next' : 'done'"
                  :aria-label="t('exercise.answerLabel', { item: itemLabel(item, index) })"
                  @update:model-value="onAnswerInput(item.id, $event)"
                  @keydown="onKeydown($event, item)"
                  @blur="onBlurSubmit(item)"
                />
              </div>
            </div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('exercise.reading')" name="reading">
        <div class="translation-toolbar reading-toolbar">
          <span></span>
          <div>
            <el-button plain :icon="Histogram" @click="emit('speak', lessonSpeechSegments)">{{ t('exercise.fullText') }}</el-button>
          </div>
        </div>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row">
            <button
              class="sentence-number" type="button"
              :aria-label="t('exercise.speakItem', { item: itemLabel(item, index) })"
              @click="speakFromSentence(item)"
            >{{ itemLabel(item, index) }}</button>
            <div class="sentence-content">
              <p class="sentence-chinese"><strong v-if="item.speakerEn">{{ item.speakerEn }}：</strong>{{ item.prompt }}</p>
              <p class="sentence-english" @click="onTextClick"><span v-for="tok in clickableWords(item.answer, item.id)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'clickable-word': tok.clickable }">{{ tok.text }}</span></p>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyVisible" class="mistake-history-dialog" :title="t('history.title')" width="min(680px, calc(100% - 24px))" append-to-body>
      <el-empty v-if="!historyGroups.length" :description="t('history.empty')" :image-size="80" />
      <template v-else>
        <section v-for="group in historyGroups" :key="group.item.id" class="mistake-line-group">
          <header class="mistake-line-source">
            <div class="mistake-line-prompt">
              <p><strong class="mistake-line-index">{{ group.label }}</strong><strong v-if="group.item.speakerEn">{{ group.item.speakerEn }}：</strong>{{ group.item.prompt }}</p>
              <el-button class="history-redo-button" text size="small" :icon="RefreshRight" @click="redoFromHistory(group.item.id)">{{ t('exercise.redoLine') }}</el-button>
            </div>
            <p class="mistake-line-reference" @click="onTextClick"><span v-for="tok in clickableWords(group.item.answer, group.item.id)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'clickable-word': tok.clickable }">{{ tok.text }}</span></p>
          </header>
          <div class="mistake-attempt-list">
            <article v-for="entry in group.entries" :key="entry.id" class="mistake-attempt-row">
              <p><span v-for="(part, partIndex) in historyFeedback(entry).inputParts" :key="`${entry.id}-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'is-placeholder': part.placeholder }]">{{ part.text }}</span></p>
              <time>{{ formatTime(entry.createdAt) }}</time>
            </article>
          </div>
          <p class="mistake-line-summary">{{ groupSummary(group.entries) }}</p>
        </section>
      </template>
    </el-dialog>
  </main>
</template>

<style scoped>
.written-fill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.written-fill-input {
  width: 220px;
  max-width: 100%;
}

:deep(.written-fill-input .el-input__wrapper) {
  padding: 4px 10px;
  border: 0;
  border-bottom: 1px solid #bfc9c4;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

:deep(.written-fill-input .el-input__wrapper:hover) {
  border-bottom-color: #879892;
}

:deep(.written-fill-input .el-input__wrapper.is-focus) {
  border-bottom: 2px solid var(--green);
  box-shadow: none;
}

:deep(.written-fill-input .el-input__inner) {
  font-size: 14px;
  line-height: 1.5;
}

.written-fill-input.is-empty :deep(.el-input__wrapper) {
  border-bottom-color: var(--gold);
}

.written-fill-input.is-empty:hover :deep(.el-input__wrapper) {
  border-bottom-color: #b8892c;
}

.written-fill-input.is-empty :deep(.el-input__wrapper.is-focus) {
  border-bottom: 2px solid #c39a2f;
}

.fill-blank {
  display: inline-block;
  padding: 0 6px;
  margin: 0 2px;
  border-bottom: 2px solid var(--green);
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .05em;
}
</style>
