<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Delete, Headset, Histogram, MoreFilled } from "@element-plus/icons-vue";
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
const historySummary = computed(() => {
  const counts = new Map<string, number>();
  props.mistakeHistory.forEach((entry) => {
    entry.missing.forEach((word) => counts.set(`遗漏 · ${word}`, (counts.get(`遗漏 · ${word}`) || 0) + 1));
    entry.extra.forEach((word) => counts.set(`多余/错误 · ${word}`, (counts.get(`多余/错误 · ${word}`) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
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
  if (item.kind === "title") return "标";
  if (item.kind === "question") return "问";
  return String(index - props.items.filter((candidate) => candidate.kind !== "sentence" && candidate.kind).length + 1);
}

function itemAriaLabel(item: ExerciseItem, index: number) {
  if (item.kind === "title") return "标题";
  if (item.kind === "question") return "问题";
  return `第 ${itemLabel(item, index)} 句`;
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
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}
</script>

<template>
  <main class="exercise-card lesson-practice" @pointerdown="onPointerDown" @pointerup="onPointerUp">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row">
          <h1>{{ visibleTitle }}</h1>
          <el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" />
        </div>
      </div>
      <div class="lesson-sentence-count">共 {{ items.length }} 题</div>
    </div>

    <el-tabs class="display-tabs" :model-value="displayMode" stretch @update:model-value="emit('update:displayMode', $event as DisplayMode)">
      <el-tab-pane label="译文" name="translation">
        <div class="translation-toolbar">
          <span>标题、问题和正文均参与练习</span>
          <div>
            <el-button text :icon="Histogram" @click="openHistory()">错误历史</el-button>
            <el-button plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
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
                  <template #content><div class="error-tooltip"><strong>错误提示</strong><p>{{ results[item.id].explanation }}</p></div></template>
                  <button class="error-info-button" type="button" aria-label="查看错误原因">!</button>
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
                  :aria-label="`${itemAriaLabel(item, index)}英文译文`"
                  @update:model-value="emit('update:answer', item.id, $event)"
                  @keydown="onKeydown($event, item)"
                />
                <div class="input-row-actions">
                  <span v-if="results[item.id]" class="input-result-label">{{ results[item.id].level === 'correct' ? '正确' : '有误' }}</span>
                  <el-dropdown trigger="click" placement="bottom-end">
                    <el-button class="row-more-button" text circle :icon="MoreFilled" aria-label="打开当前行操作菜单" />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item :icon="Delete" :disabled="!answers[item.id]" @click="emit('clear', item.id)">清空当前行</el-dropdown-item>
                        <el-dropdown-item :icon="Histogram" @click="openHistory(item.id)">错误历史</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>
            </div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane label="原文" name="original">
        <section class="lesson-question is-english">
          <div class="lesson-question-copy">
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitle }}</strong><el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" /></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" aria-label="朗读课文问题" @click="emit('speak', questionEn)" /></div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
        </section>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" aria-label="朗读英语原文" @click="emit('speak', item.answer)" /></div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane label="译文+原文" name="bilingual">
        <section class="lesson-question is-bilingual">
          <div class="bilingual-question-copy">
            <div class="mobile-title-with-speech"><strong class="mobile-lesson-title">{{ lessonTitleZh }} · {{ lessonTitle }}</strong><el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" /></div>
            <div><p>{{ questionZh }}</p></div>
            <div class="question-with-speech"><p>{{ questionEn }}</p><el-button circle text :icon="Headset" aria-label="朗读课文问题" @click="emit('speak', questionEn)" /></div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
        </section>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in sentenceItems" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content"><p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p><div class="reading-sentence"><p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p><el-button circle text :icon="Headset" aria-label="朗读英语原文" @click="emit('speak', item.answer)" /></div></div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyVisible" class="mistake-history-dialog" title="本课错误历史" width="min(680px, calc(100% - 24px))" append-to-body>
      <el-empty v-if="!mistakeHistory.length" description="本课还没有错误记录" :image-size="80" />
      <template v-else>
        <section class="mistake-summary">
          <div class="history-section-title"><strong>错词汇总</strong><span>共 {{ mistakeHistory.length }} 次错误作答</span></div>
          <div v-if="historySummary.length" class="mistake-chips"><span v-for="([label, count]) in historySummary" :key="label">{{ label }} <b>×{{ count }}</b></span></div>
          <p v-else class="history-empty-copy">错误主要来自语序，请查看下方明细。</p>
        </section>
        <section class="mistake-details">
          <div class="history-section-title"><strong>作答明细</strong><span>最新记录在前</span></div>
          <article v-for="entry in orderedHistory" :key="entry.id" class="mistake-detail-card" :class="{ 'is-focused': entry.itemId === historyFocusItemId }">
            <header><strong>{{ entry.prompt }}</strong><time>{{ formatTime(entry.createdAt) }}</time></header>
            <p><span>你的输入</span><del>{{ entry.input }}</del></p>
            <p><span>参考答案</span><ins>{{ entry.answer }}</ins></p>
            <small>{{ entry.explanation }}</small>
          </article>
        </section>
      </template>
    </el-dialog>
  </main>
</template>
