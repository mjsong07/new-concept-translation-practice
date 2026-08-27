<script setup lang="ts">
import { CircleCheckFilled, WarningFilled, CircleCloseFilled } from "@element-plus/icons-vue";
import type { AnswerFeedback } from "../types/practice";

defineProps<{ feedback: AnswerFeedback }>();
</script>

<template>
  <div class="feedback-panel" :class="`is-${feedback.level}`">
    <div class="feedback-title-row">
      <el-icon class="feedback-icon">
        <component :is="feedback.level === 'correct' ? CircleCheckFilled : feedback.level === 'close' ? WarningFilled : CircleCloseFilled" />
      </el-icon>
      <div>
        <h3>{{ feedback.title }}</h3>
        <p>{{ feedback.message }}</p>
      </div>
      <span v-if="feedback.level !== 'correct'" class="similarity">相似度 {{ Math.round(feedback.similarity * 100) }}%</span>
    </div>

    <div v-if="feedback.missing.length || feedback.extra.length" class="word-diff">
      <div v-if="feedback.missing.length"><span>可能遗漏</span><b v-for="word in feedback.missing" :key="`m-${word}`">{{ word }}</b></div>
      <div v-if="feedback.extra.length"><span>多出/不同</span><b v-for="word in feedback.extra" :key="`e-${word}`">{{ word }}</b></div>
    </div>
  </div>
</template>
