<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { CircleCheckFilled, Headset } from "@element-plus/icons-vue";
import type { AnswerFeedback, DisplayMode, ExerciseItem } from "../types/practice";

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
}>();

const emit = defineEmits<{
  "update:displayMode": [value: DisplayMode];
  "update:answer": [id: string, value: string];
  submit: [id: string];
  speak: [text: string];
}>();

const inputRefs = ref<Record<string, { focus: () => void } | null>>({});
const completedSet = computed(() => new Set(props.completedIds));
const visibleTitle = computed(() => {
  if (props.displayMode === "translation") return props.lessonTitleZh;
  if (props.displayMode === "original") return props.lessonTitle;
  return `${props.lessonTitleZh} · ${props.lessonTitle}`;
});
const lessonSpeechText = computed(() => [
  props.lessonTitle,
  props.questionEn,
  ...props.allItems.map((item) => item.speakerEn ? `${item.speakerEn}. ${item.answer}` : item.answer)
].filter(Boolean).join(" "));

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
  const nextItem = props.items[currentIndex + 1];
  nextTick(() => focusItem(nextItem?.id));
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
</script>

<template>
  <main class="exercise-card lesson-practice">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ lessonNumber }}</span>
        <div class="lesson-title-row">
          <h1>{{ visibleTitle }}</h1>
          <el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" />
        </div>
      </div>
      <div class="lesson-sentence-count">共 {{ items.length }} 句</div>
    </div>

    <el-tabs
      class="display-tabs"
      :model-value="displayMode"
      stretch
      @update:model-value="emit('update:displayMode', $event as DisplayMode)"
    >
      <el-tab-pane label="译文" name="translation">
        <section class="lesson-question">
          <div class="lesson-question-copy">
            <strong class="mobile-lesson-title">{{ lessonTitleZh }}</strong>
            <p>{{ questionZh }}</p>
          </div>
          <div class="lesson-speech-actions">
            <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
          </div>
        </section>
        <div class="sentence-list translation-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row" :class="rowState(item)">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content">
              <div class="sentence-prompt-row">
                <p class="sentence-chinese">
                  <strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}
                </p>
                <el-icon v-if="rowState(item) === 'is-correct'" class="row-status-icon"><CircleCheckFilled /></el-icon>
                <el-tooltip v-else-if="rowState(item) === 'is-wrong'" trigger="click" placement="left" :show-after="0">
                  <template #content>
                    <div class="error-tooltip">
                      <strong>错误提示</strong>
                      <p>{{ results[item.id].explanation }}</p>
                    </div>
                  </template>
                  <button class="error-info-button" type="button" aria-label="查看错误原因">!</button>
                </el-tooltip>
              </div>

              <div v-if="rowState(item) === 'is-wrong'" class="wrong-reference">
                <p>
                  <strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>
                  <span
                    v-for="(part, partIndex) in results[item.id].referenceParts"
                    :key="`${item.id}-part-${partIndex}`"
                    class="diff-word"
                    :class="`is-${part.state}`"
                  >{{ part.text }}</span>
                </p>
              </div>

              <div class="sentence-answer-row">
                <el-input
                  :ref="(instance: unknown) => setInputRef(item.id, instance)"
                  :model-value="answers[item.id] || ''"
                  :class="{ 'has-result': Boolean(results[item.id]) }"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 5 }"
                  resize="none"
                  autocomplete="off"
                  :enterkeyhint="index < items.length - 1 && shouldAutoFocus() ? 'next' : 'done'"
                  :aria-label="`第 ${index + 1} 句英文译文`"
                  @update:model-value="emit('update:answer', item.id, $event)"
                  @keydown="onKeydown($event, item)"
                />
                <span v-if="results[item.id]" class="input-result-label">
                  {{ results[item.id].level === 'correct' ? '正确' : '有误' }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane label="原文" name="original">
        <section class="lesson-question is-english">
          <div class="lesson-question-copy">
            <div class="mobile-title-with-speech">
              <strong class="mobile-lesson-title">{{ lessonTitle }}</strong>
              <el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" />
            </div>
            <div class="question-with-speech">
              <p>{{ questionEn }}</p>
              <el-button circle text :icon="Headset" aria-label="朗读课文问题" @click="emit('speak', questionEn)" />
            </div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
        </section>
        <div class="sentence-list reading-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content reading-sentence">
              <p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p>
              <el-button circle text :icon="Headset" aria-label="朗读英语原文" @click="emit('speak', item.answer)" />
            </div>
          </article>
        </div>
      </el-tab-pane>

      <el-tab-pane label="译文+原文" name="bilingual">
        <section class="lesson-question is-bilingual">
          <div class="bilingual-question-copy">
            <div class="mobile-title-with-speech">
              <strong class="mobile-lesson-title">{{ lessonTitleZh }} · {{ lessonTitle }}</strong>
              <el-button circle text :icon="Headset" aria-label="朗读课程标题" @click="emit('speak', lessonTitle)" />
            </div>
            <div><p>{{ questionZh }}</p></div>
            <div class="question-with-speech">
              <p>{{ questionEn }}</p>
              <el-button circle text :icon="Headset" aria-label="朗读课文问题" @click="emit('speak', questionEn)" />
            </div>
          </div>
          <el-button class="speak-full-button" plain :icon="Headset" @click="emit('speak', lessonSpeechText)">全文</el-button>
        </section>
        <div class="sentence-list reading-list bilingual-list">
          <article v-for="(item, index) in items" :key="item.id" class="sentence-row">
            <div class="sentence-number">{{ index + 1 }}</div>
            <div class="sentence-content">
              <p class="sentence-chinese"><strong v-if="item.speakerZh">{{ item.speakerZh }}：</strong>{{ item.prompt }}</p>
              <div class="reading-sentence">
                <p class="sentence-english"><strong v-if="item.speakerEn">{{ item.speakerEn }}: </strong>{{ item.answer }}</p>
                <el-button circle text :icon="Headset" aria-label="朗读英语原文" @click="emit('speak', item.answer)" />
              </div>
            </div>
          </article>
        </div>
      </el-tab-pane>
    </el-tabs>
  </main>
</template>
