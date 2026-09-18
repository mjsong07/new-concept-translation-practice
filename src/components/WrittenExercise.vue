<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Histogram, RefreshRight, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, ExerciseItem, MistakeHistoryEntry, SpeechSegment, WrittenSectionMeta } from "../types/practice";

interface PracticeSection {
  key: string;
  titleEn: string;
  titleZh: string;
  examplePrompt: string;
  exampleAnswer: string;
  items: ExerciseItem[];
}

interface PromptPart {
  type: "text" | "blank";
  text: string;
  blankIndex: number;
}

const props = defineProps<{
  lessonNumber: number;
  lessonTitle: string;
  lessonTitleZh: string;
  sections: WrittenSectionMeta[];
  items: ExerciseItem[];
  answers: Record<string, string>;
  results: Record<string, AnswerFeedback>;
  completedIds: string[];
  mistakeHistory: MistakeHistoryEntry[];
  autoAdvanceErrors: boolean;
  characterMatchPercent: number;
  speechActive: boolean;
  speechPaused: boolean;
  activeSpeechItemId: string;
}>();

const emit = defineEmits<{
  "update:answer": [id: string, value: string];
  submit: [id: string];
  clear: [id: string];
  speak: [segments: SpeechSegment[]];
  "speak-word": [wordId: string, wordText: string];
  "toggle-speech": [];
}>();

const { locale, t } = useI18n();

const editedIds = new Set<string>();
const errorAnchors = new Map<string, number>();

type InputRef = { focus: () => void; input?: HTMLInputElement; textarea?: HTMLTextAreaElement };
const inputRefs = ref<Record<string, InputRef | null>>({});
const historyVisible = ref(false);
const historyFocusItemId = ref("");
const activeSection = ref(sectionKeyOf(props.items[0]));
let blurSubmitSuppressed = false;

function sectionKeyOf(item?: ExerciseItem) {
  return item ? (item.section || item.speakerEn || "") : "";
}

const completedSet = computed(() => new Set(props.completedIds));

const structure = computed(() => {
  const metaByKey = new Map(props.sections.map((meta) => [meta.key, meta]));
  const order: string[] = [];
  const grouped = new Map<string, ExerciseItem[]>();
  props.items.forEach((item) => {
    const key = item.section || item.speakerEn || "";
    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)!.push(item);
  });
  const labelById = new Map<string, string>();
  const sections: PracticeSection[] = order.map((key) => {
    const items = grouped.get(key)!;
    items.forEach((item, index) => labelById.set(item.id, String(index + 1)));
    const meta = metaByKey.get(key);
    return {
      key,
      titleEn: meta?.titleEn || "",
      titleZh: meta?.titleZh || "",
      examplePrompt: meta?.examplePrompt || "",
      exampleAnswer: meta?.exampleAnswer || "",
      items
    };
  });
  const lastSectionItems = sections.length ? sections[sections.length - 1].items : [];
  const lastItemId = lastSectionItems.length ? lastSectionItems[lastSectionItems.length - 1].id : "";
  return { sections, labelById, lastItemId };
});

const historyGroups = computed(() => {
  const entriesByItem = new Map<string, MistakeHistoryEntry[]>();
  props.mistakeHistory.forEach((entry) => {
    if (historyFocusItemId.value && entry.itemId !== historyFocusItemId.value) return;
    const entries = entriesByItem.get(entry.itemId) || [];
    entries.push(entry);
    entriesByItem.set(entry.itemId, entries);
  });
  return props.items.flatMap((item) => {
    const entries = entriesByItem.get(item.id);
    if (!entries?.length) return [];
    const label = structure.value.labelById.get(item.id) || "";
    return [{ item, label, entries: [...entries].sort((left, right) => left.createdAt - right.createdAt) }];
  });
});

function shouldAutoFocus() {
  return !window.matchMedia("(max-width: 640px)").matches;
}

watch(() => props.lessonNumber, async () => {
  editedIds.clear();
  errorAnchors.clear();
  activeSection.value = sectionKeyOf(props.items[0]);
  if (!shouldAutoFocus()) return;
  await nextTick();
  focusItem(props.items[0]?.id);
});

function inputKey(id: string, blankIndex = 0) {
  return `${id}#${blankIndex}`;
}

function setInputRef(id: string, blankIndex: number, instance: unknown) {
  inputRefs.value[inputKey(id, blankIndex)] = instance as InputRef | null;
}

function focusItem(id?: string, blankIndex = 0, preventScroll = false) {
  if (!id) return;
  const input = inputRefs.value[inputKey(id, blankIndex)];
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
  const nextItem = props.items[currentIndex + 1];
  const nextInTab = nextItem && sectionKeyOf(nextItem) === activeSection.value ? nextItem : undefined;
  if (!shouldAutoFocus() && anticipatedResult.level === "correct" && nextItem) {
    if (nextInTab) focusItem(nextItem.id, 0, true);
    else element.blur();
  }
  emit("submit", item.id);
  await nextTick();
  speakIfCorrect(item);
  const result = props.results[item.id];
  if (result?.level === "correct") clearErrorAnchors(item.id);
  if (!shouldAutoFocus()) {
    if (result?.level !== "correct") selectError(item.id, element, result);
    else if (!nextInTab) element.blur();
    return;
  }
  if (result?.level !== "correct") {
    const target = getInputElement(item.id) || element;
    target.focus();
    selectError(item.id, target, result, true);
    return;
  }
  if (nextInTab) {
    await nextTick();
    focusItem(nextInTab.id);
  } else {
    element.blur();
  }
}

function switchToSection(item: ExerciseItem) {
  const key = sectionKeyOf(item);
  if (key && key !== activeSection.value) activeSection.value = key;
}

function speakIfCorrect(item: ExerciseItem) {
  if (props.results[item.id]?.level === "correct") {
    emit("speak", [rowSpeechSegment(item)]);
  }
}

function getInputElement(id: string, blankIndex = 0): HTMLInputElement | HTMLTextAreaElement | undefined {
  const instance = inputRefs.value[inputKey(id, blankIndex)];
  return instance?.input || instance?.textarea;
}

function clearErrorAnchors(itemId: string) {
  const item = props.items.find((candidate) => candidate.id === itemId);
  const count = item ? Math.max(blankCount(item), 1) : 1;
  for (let blankIndex = 0; blankIndex < count; blankIndex += 1) errorAnchors.delete(inputKey(itemId, blankIndex));
  errorAnchors.delete(itemId);
}

function selectError(itemId: string, element: HTMLInputElement | HTMLTextAreaElement, result?: AnswerFeedback, allowFocus = false) {
  const item = props.items.find((candidate) => candidate.id === itemId);
  if (item && isFillMode(item) && result) {
    const located = locateBlankError(item, result, props.answers[itemId] || "");
    if (located) {
      const target = getInputElement(itemId, located.blankIndex) || element;
      if (allowFocus) target.focus();
      target.setSelectionRange(located.start, located.end);
      errorAnchors.set(inputKey(itemId, located.blankIndex), located.start);
      return;
    }
  }
  const start = result?.firstErrorOffset || 0;
  const end = Math.max(start, result?.firstErrorEnd || start);
  element.setSelectionRange(start, end);
  errorAnchors.set(itemId, start);
}

function onKeydown(event: KeyboardEvent, item: ExerciseItem) {
  if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
  event.preventDefault();
  if (isFillMode(item)) {
    const host = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-blank-index]");
    const blankIndex = host ? Number(host.dataset.blankIndex) : 0;
    const count = blankCount(item);
    if (blankIndex < count - 1 && !blankValue(item, blankIndex + 1).trim()) {
      focusItem(item.id, blankIndex + 1);
      return;
    }
  }
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

async function onBlurSubmit(item: ExerciseItem, event?: FocusEvent) {
  if (blurSubmitSuppressed) {
    blurSubmitSuppressed = false;
    return;
  }
  if (!editedIds.has(item.id)) return;
  if (isFillMode(item) && blankCount(item) > 1) {
    const relatedRow = (event?.relatedTarget as HTMLElement | null)?.closest<HTMLElement>("[data-item-id]");
    if (relatedRow?.dataset.itemId === item.id) return;
  }
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

function itemLabel(item: ExerciseItem) {
  return structure.value.labelById.get(item.id) || "";
}

function examplePairs(section: PracticeSection) {
  const prompts = section.examplePrompt.split(" | ");
  const answers = section.exampleAnswer.split(" | ");
  if (prompts.length > 1 && prompts.length === answers.length) {
    return prompts.map((prompt, index) => ({ prompt, answer: answers[index] }));
  }
  return [{ prompt: section.examplePrompt, answer: section.exampleAnswer }];
}

function withSentenceBreaks(text: string) {
  return text.replace(/([.?!]) (?=[A-Z"'“])/g, "$1\n");
}

function showComparison(item: ExerciseItem) {
  if (!props.results[item.id]) return false;
  return !(isFillMode(item) && rowState(item) === "is-correct");
}

function openHistory(itemId = "") {
  historyFocusItemId.value = itemId;
  historyVisible.value = true;
}

async function clearAndFocus(itemId: string) {
  emit("clear", itemId);
  await nextTick();
  focusItem(itemId);
  scrollToItem(itemId);
}

function scrollToItem(itemId: string) {
  const element = getInputElement(itemId);
  const target = element?.closest(".sentence-row") || element;
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function redoFromHistory(itemId: string) {
  historyVisible.value = false;
  const item = props.items.find((candidate) => candidate.id === itemId);
  if (item) switchToSection(item);
  await nextTick();
  await clearAndFocus(itemId);
}

function speakFromSentence(item: ExerciseItem) {
  blurSubmitSuppressed = false;
  emit("speak", [rowSpeechSegment(item)]);
}

function rowSpeechSegment(item: ExerciseItem): SpeechSegment {
  return { text: rowSpeechText(item), itemId: item.id, speaker: item.speakerEn };
}

function rowSpeechText(item: ExerciseItem) {
  if (!isFillMode(item)) return item.answer;
  const words = splitBlanks(item.answer);
  let blankIndex = 0;
  return item.prompt.replace(/_____/g, () => words[blankIndex++] || "");
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

function isFillMode(item: ExerciseItem) {
  return item.mode === "fill";
}

function splitBlanks(value: string) {
  return value.split(",").map((part) => part.trim());
}

function promptParts(prompt: string): PromptPart[] {
  const segments = prompt.split("_____");
  return segments.flatMap((text, index) => {
    const parts: PromptPart[] = [{ type: "text", text, blankIndex: index }];
    if (index < segments.length - 1) parts.push({ type: "blank", text: "", blankIndex: index });
    return parts;
  });
}

function blankCount(item: ExerciseItem) {
  return promptParts(item.prompt).filter((part) => part.type === "blank").length;
}

function blankValue(item: ExerciseItem, blankIndex: number) {
  return splitBlanks(props.answers[item.id] || "")[blankIndex] || "";
}

function blankWidth(item: ExerciseItem, blankIndex: number) {
  const word = (splitBlanks(item.answer)[blankIndex] || "").trim();
  return `calc(${Math.max(word.length, 2)}ch + 8px)`;
}

function blankStartOffset(parts: string[], blankIndex: number) {
  let offset = 0;
  for (let index = 0; index < blankIndex; index += 1) offset += parts[index].length + 2; // ", "
  return offset;
}

function locateBlankError(item: ExerciseItem, result: AnswerFeedback, joined: string) {
  const parts = splitBlanks(joined);
  if (!parts.length) return null;
  for (let blankIndex = 0; blankIndex < parts.length; blankIndex += 1) {
    const begin = blankStartOffset(parts, blankIndex);
    const end = begin + parts[blankIndex].length;
    if (result.firstErrorOffset <= end || blankIndex === parts.length - 1) {
      const start = Math.max(0, Math.min(result.firstErrorOffset - begin, parts[blankIndex].length));
      const stop = Math.max(start, Math.min(result.firstErrorEnd - begin, parts[blankIndex].length));
      return { blankIndex, start, end: stop };
    }
  }
  return null;
}

function onBlankInput(item: ExerciseItem, blankIndex: number, value: string) {
  const count = blankCount(item);
  const current = splitBlanks(props.answers[item.id] || "");
  const next = Array.from({ length: count }, (_, index) => (index === blankIndex ? value : current[index] || ""));
  while (next.length > 1 && !next[next.length - 1].trim()) next.pop();
  const joined = next.join(", ");
  editedIds.add(item.id);
  emit("update:answer", item.id, joined);
  if (props.autoAdvanceErrors) selectNextBlankError(item, blankIndex, joined);
}

function selectNextBlankError(item: ExerciseItem, blankIndex: number, joined: string) {
  const element = getInputElement(item.id, blankIndex);
  if (!element) return;
  const anchor = errorAnchors.get(inputKey(item.id, blankIndex));
  if (anchor === undefined) return;
  const caret = element.selectionStart ?? 0;
  if (caret > 0 && !/\s/.test((element.value || "").slice(caret - 1, caret))) return;
  const result = evaluateAnswer(joined, item.answer, locale.value, props.characterMatchPercent / 100);
  if (result.level === "correct") {
    clearErrorAnchors(item.id);
    return;
  }
  const located = locateBlankError(item, result, joined);
  if (!located) return;
  if (located.blankIndex === blankIndex && located.start === anchor) return;
  errorAnchors.set(inputKey(item.id, located.blankIndex), located.start);
  nextTick(() => {
    const target = getInputElement(item.id, located.blankIndex);
    if (!target) return;
    target.focus();
    target.setSelectionRange(located.start, located.end);
  });
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
        <h1 class="lesson-title-row">{{ lessonTitle }}</h1>
      </div>
      <div class="lesson-sentence-count">{{ t('exercise.count', { count: items.length }) }}</div>
    </div>

    <el-tabs class="display-tabs" :model-value="activeSection" stretch @update:model-value="activeSection = ($event as string)">
      <el-tab-pane v-for="section in structure.sections" :key="section.key" :label="section.key || t('exercise.practice')" :name="section.key">
        <div class="translation-toolbar">
          <span>{{ t('exercise.scopeHintWritten') }}</span>
          <div>
            <el-button text :icon="Histogram" @click="openHistory()">{{ t('exercise.history') }}</el-button>
            <el-button v-if="speechActive" plain :icon="speechPaused ? VideoPlay : VideoPause" @click="emit('toggle-speech')">{{ speechPaused ? t('exercise.resume') : t('exercise.pause') }}</el-button>
          </div>
        </div>
        <section class="written-section">
          <header v-if="section.key || section.titleEn || section.titleZh" class="written-section-header">
            <span v-if="section.key" class="written-section-badge">{{ section.key }}</span>
            <div class="written-section-titles">
              <p v-if="section.titleEn" class="written-section-title-en">{{ section.titleEn }}</p>
              <p v-if="section.titleZh" class="written-section-title-zh">{{ section.titleZh }}</p>
            </div>
          </header>
          <div v-if="section.examplePrompt" class="written-example">
            <div v-for="(pair, pairIndex) in examplePairs(section)" :key="`${section.key}-${pairIndex}`" class="written-example-pair">
              <p class="written-example-prompt sentence-chinese">{{ withSentenceBreaks(pair.prompt) }}</p>
              <p class="written-example-answer sentence-chinese" @click="onTextClick"><span v-for="tok in clickableWords(withSentenceBreaks(pair.answer), `example-${section.key}-${pairIndex}`)" :key="tok.wordId" :data-word-id="tok.clickable ? tok.wordId : undefined" :class="{ 'clickable-word': tok.clickable }">{{ tok.text }}</span></p>
            </div>
          </div>
          <div class="sentence-list translation-list">
            <article v-for="item in section.items" :key="item.id" class="sentence-row" :class="[rowState(item), { 'is-speaking': activeSpeechItemId === item.id }]">
              <button
                class="sentence-number" type="button"
                :aria-label="t('exercise.speakItem', { item: itemLabel(item) })"
                @mousedown.prevent @pointerdown="suppressBlurSubmit" @click="speakFromSentence(item)"
              >{{ itemLabel(item) }}</button>
              <div class="sentence-content">
                <div class="sentence-prompt-row">
                  <div v-if="isFillMode(item)" class="sentence-chinese written-fill-prompt">
                    <template v-for="(part, partIndex) in promptParts(item.prompt)" :key="`${item.id}-part-${partIndex}`">
                      <span v-if="part.type === 'text'">{{ part.text }}</span>
                      <el-input
                        v-else
                        :ref="(instance: unknown) => setInputRef(item.id, part.blankIndex, instance)"
                        :model-value="blankValue(item, part.blankIndex)"
                        class="written-fill-input written-blank-input"
                        :class="{ 'is-empty': !blankValue(item, part.blankIndex).trim() }"
                        :style="{ width: blankWidth(item, part.blankIndex) }"
                        autocomplete="off"
                        :data-item-id="item.id"
                        :data-blank-index="part.blankIndex"
                        :enterkeyhint="item.id === structure.lastItemId ? 'done' : 'next'"
                        :aria-label="t('exercise.answerLabel', { item: itemLabel(item) })"
                        @update:model-value="onBlankInput(item, part.blankIndex, $event)"
                        @keydown="onKeydown($event, item)"
                        @blur="onBlurSubmit(item, $event)"
                      />
                    </template>
                  </div>
                  <p v-else class="sentence-chinese">{{ item.prompt }}</p>
                  <el-button
                    v-if="!isFillMode(item)"
                    class="row-action-button" text circle size="small" :icon="Delete"
                    :disabled="!answers[item.id]" :aria-label="t('exercise.clearRow')"
                    @mousedown.prevent @pointerdown="suppressBlurSubmit" @click="clearAndFocus(item.id)"
                  />
                  <el-button
                    v-if="!isFillMode(item)"
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

                <div v-if="showComparison(item)" class="answer-comparison" :class="{ 'is-wrong': rowState(item) === 'is-wrong' }">
                  <p class="comparison-line"><span class="comparison-text" @click="onTextClick"><span v-for="(part, partIndex) in results[item.id].referenceParts" :key="`${item.id}-reference-${partIndex}`" class="diff-word" :class="[`is-${part.state}`, { 'clickable-word': /^[A-Za-z0-9]/.test(part.text) }]" :data-word-id="/^[A-Za-z0-9]/.test(part.text) ? `${item.id}-ref:${partIndex}` : undefined">{{ part.text }}</span></span></p>
                </div>

                <div v-if="!isFillMode(item)" class="sentence-answer-row">
                  <el-input
                    :ref="(instance: unknown) => setInputRef(item.id, 0, instance)"
                    :model-value="answers[item.id] || ''"
                    :class="{ 'is-empty': !(answers[item.id] || '').trim() }"
                    type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" resize="none" autocomplete="off"
                    :enterkeyhint="item.id === structure.lastItemId ? 'done' : 'next'"
                    :aria-label="t('exercise.answerLabel', { item: itemLabel(item) })"
                    @update:model-value="onAnswerInput(item.id, $event)"
                    @keydown="onKeydown($event, item)"
                    @blur="onBlurSubmit(item)"
                  />
                </div>
              </div>
            </article>
          </div>
        </section>
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
.written-section {
  margin-bottom: 0;
}

.written-section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}

.written-section-badge {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.written-section-titles {
  min-width: 0;
}

.written-section-title-en {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.written-section-title-zh {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.written-example {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 23;
  margin: 0 0 8px;
  padding: 6px 10px;
  border-left: 3px solid var(--gold);
  border-radius: 0 8px 8px 0;
  background: linear-gradient(rgba(211, 169, 58, .12), rgba(211, 169, 58, .12)), rgba(255, 253, 248, .97);
  backdrop-filter: blur(10px);
}

.sentence-row {
  scroll-margin-top: 140px;
}

@media (max-width: 640px) {
  .written-example {
    top: calc(env(safe-area-inset-top) + 168px);
  }

  .sentence-row {
    scroll-margin-top: calc(env(safe-area-inset-top) + 260px);
  }
}

.written-example-pair + .written-example-pair {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(168, 135, 31, .35);
}

.written-example-prompt {
  margin: 0;
  white-space: pre-line;
}

.written-example-answer {
  margin: 2px 0 0;
  color: var(--green-dark);
  white-space: pre-line;
}

.written-fill-prompt {
  display: block;
  min-width: 0;
  line-height: 1.6;
}

.written-fill-input {
  max-width: 100%;
}

.written-blank-input {
  --el-input-height: 22px;
  margin: 0 1px;
  vertical-align: baseline;
}

.written-fill-input.written-blank-input :deep(.el-input__wrapper) {
  padding: 0;
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
</style>
