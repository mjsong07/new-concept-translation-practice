<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ArrowLeft, ArrowRight, Check, RefreshLeft, Headset } from "@element-plus/icons-vue";
import type { AnswerFeedback, ExerciseItem } from "../types/practice";
import FeedbackPanel from "./FeedbackPanel.vue";

const props = defineProps<{
  item: ExerciseItem;
  position: number;
  count: number;
  answer: string;
  submitted: boolean;
  feedback: AnswerFeedback;
}>();

const emit = defineEmits<{
  "update:answer": [value: string];
  submit: [];
  next: [];
  previous: [];
  retry: [];
  speak: [];
}>();

const inputRef = ref<{ focus: () => void } | null>(null);
const progress = computed(() => Math.round(((props.position + 1) / Math.max(props.count, 1)) * 100));

watch(() => props.item.id, async () => {
  await nextTick();
  inputRef.value?.focus();
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (props.submitted) emit("next");
    else emit("submit");
  }
}
</script>

<template>
  <main class="exercise-card">
    <div class="exercise-topline">
      <div>
        <span class="lesson-kicker">LESSON {{ item.lesson }}</span>
        <h1>{{ item.lessonTitle }}</h1>
      </div>
      <div class="question-index"><strong>{{ position + 1 }}</strong><span>/ {{ count }}</span></div>
    </div>
    <el-progress :percentage="progress" :show-text="false" :stroke-width="5" />

    <section class="prompt-area">
      <div class="prompt-label">
        <span>把下面这句话译成英文</span>
        <el-tag v-if="item.speakerZh" round effect="plain">{{ item.speakerZh }}</el-tag>
      </div>
      <p class="chinese-prompt">{{ item.prompt }}</p>
      <p v-if="item.speakerEn" class="speaker-tip">英文角色：{{ item.speakerEn }}（无需输入角色名）</p>
    </section>

    <section class="answer-area">
      <el-input
        ref="inputRef"
        :model-value="answer"
        type="textarea"
        :rows="4"
        resize="none"
        :disabled="submitted"
        placeholder="在这里输入英文译文…"
        aria-label="英文译文"
        @update:model-value="emit('update:answer', $event)"
        @keydown="onKeydown"
      />
      <div class="input-caption"><span>忽略大小写和标点，常见缩写与完整形式均可</span><span>{{ answer.length }} 字符</span></div>
    </section>

    <FeedbackPanel v-if="submitted" :feedback="feedback" :reference="item.answer" @speak="emit('speak')" />

    <div class="exercise-actions">
      <el-button :icon="ArrowLeft" @click="emit('previous')">上一题</el-button>
      <div class="primary-actions">
        <el-button v-if="submitted" :icon="RefreshLeft" @click="emit('retry')">再答一次</el-button>
        <el-button v-if="submitted" :icon="Headset" @click="emit('speak')">听原句</el-button>
        <el-button v-if="!submitted" type="primary" :icon="Check" :disabled="!answer.trim()" @click="emit('submit')">检查答案</el-button>
        <el-button v-else type="primary" :icon="ArrowRight" @click="emit('next')">下一题</el-button>
      </div>
    </div>
  </main>
</template>
