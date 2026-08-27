<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { TrophyBase, CircleCheck, EditPen } from "@element-plus/icons-vue";
import PracticeControls from "./components/PracticeControls.vue";
import TranslationExercise from "./components/TranslationExercise.vue";
import { useTranslationPractice } from "./composables/useTranslationPractice";
import { speakEnglish } from "./services/speech";

const practice = useTranslationPractice();
const emptyMessage = computed(() => practice.filter.value === "mistakes" ? "本课还没有错题，继续保持！" : "本课题目已经全部完成。" );

function handleKeydown(event: KeyboardEvent) {
  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    practice.previous();
  }
  if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    practice.next();
  }
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div class="app-shell">
    <PracticeControls
      :lessons="practice.lessons"
      :lesson-number="practice.selectedLesson.value"
      :filter="practice.filter.value"
      :order="practice.order.value"
      :lesson-completed="practice.lessonCompleted.value"
      :lesson-count="practice.lesson.value.items.length"
      :lesson-percent="practice.lessonPercent.value"
      @update:lesson-number="practice.selectedLesson.value = $event"
      @update:filter="practice.filter.value = $event"
      @update:order="practice.order.value = $event"
    />

    <div class="workspace">
      <header class="workspace-header">
        <div>
          <span class="eyebrow">新概念英语第一册 · 奇数课</span>
          <h2>中译英句子训练</h2>
        </div>
        <div class="stats-strip">
          <div><el-icon><CircleCheck /></el-icon><span>已掌握<strong>{{ practice.totalCompleted.value }}</strong></span></div>
          <div><el-icon><TrophyBase /></el-icon><span>正确率<strong>{{ practice.accuracy.value }}%</strong></span></div>
          <div><el-icon><EditPen /></el-icon><span>总题数<strong>{{ practice.totalItems }}</strong></span></div>
        </div>
      </header>

      <TranslationExercise
        v-if="practice.filteredItems.value.length"
        :item="practice.currentItem.value"
        :position="practice.itemIndex.value"
        :count="practice.filteredItems.value.length"
        :answer="practice.answer.value"
        :submitted="practice.submitted.value"
        :feedback="practice.feedback.value"
        @update:answer="practice.answer.value = $event"
        @submit="practice.submit"
        @next="practice.next"
        @previous="practice.previous"
        @retry="practice.retry"
        @speak="speakEnglish(practice.currentItem.value.answer)"
      />
      <el-empty v-else :description="emptyMessage" class="empty-state">
        <el-button type="primary" @click="practice.filter.value = 'all'">查看全部题目</el-button>
      </el-empty>

      <footer>学习内容来自用户提供的《新概念英语》第一册本地资料，仅用于个人学习。</footer>
    </div>
  </div>
</template>
