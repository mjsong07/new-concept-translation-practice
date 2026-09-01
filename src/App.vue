<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { TrophyBase, CircleCheck, EditPen } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import PracticeControls from "./components/PracticeControls.vue";
import MobileSettings from "./components/MobileSettings.vue";
import TranslationExercise from "./components/TranslationExercise.vue";
import { useColorScheme } from "./composables/useColorScheme";
import { useTranslationPractice } from "./composables/useTranslationPractice";
import { getEnglishVoices, speakEnglish } from "./services/speech";

const practice = useTranslationPractice();
const colorScheme = useColorScheme();
const emptyMessage = computed(() => practice.filter.value === "mistakes" ? "本课还没有错题，继续保持！" : "本课题目已经全部完成。" );
const voices = ref<SpeechSynthesisVoice[]>([]);
const voiceUri = ref(localStorage.getItem("new-concept-speech-voice") || "");
const speechRate = ref(Number(localStorage.getItem("new-concept-speech-rate")) || 0.82);

function refreshVoices() {
  voices.value = getEnglishVoices();
}

function speak(text: string) {
  speakEnglish(text, { voiceURI: voiceUri.value, rate: speechRate.value });
}

async function resetCurrentLesson() {
  try {
    await ElMessageBox.confirm(
      `将清空 Lesson ${practice.lesson.value.number} 的输入、完成状态和错误历史，是否继续？`,
      "重做本课",
      { confirmButtonText: "确认重做", cancelButtonText: "取消", type: "warning" }
    );
    practice.resetLesson();
    ElMessage.success("本课记录已清空，可以重新练习了");
  } catch {
    // 用户取消重做。
  }
}

watch(voiceUri, (value) => localStorage.setItem("new-concept-speech-voice", value));
watch(speechRate, (value) => localStorage.setItem("new-concept-speech-rate", String(value)));
onMounted(() => {
  refreshVoices();
  window.speechSynthesis?.addEventListener("voiceschanged", refreshVoices);
});
onUnmounted(() => window.speechSynthesis?.removeEventListener("voiceschanged", refreshVoices));

</script>

<template>
  <div class="app-shell">
    <PracticeControls
      :lessons="practice.lessons"
      :lesson-number="practice.selectedLesson.value"
      :filter="practice.filter.value"
      :lesson-completed="practice.lessonCompleted.value"
      :lesson-count="practice.lessonItems.value.length"
      :lesson-percent="practice.lessonPercent.value"
      :color-scheme="colorScheme.mode.value"
      :voice-uri="voiceUri"
      :speech-rate="speechRate"
      :voices="voices"
      @update:lesson-number="practice.selectedLesson.value = $event"
      @update:filter="practice.filter.value = $event"
      @update:color-scheme="colorScheme.mode.value = $event"
      @update:voice-uri="voiceUri = $event"
      @update:speech-rate="speechRate = $event"
      @reset="resetCurrentLesson"
    />

    <div class="workspace">
      <MobileSettings
        :lessons="practice.lessons"
        :lesson-number="practice.selectedLesson.value"
        :lesson-title="practice.lesson.value.title"
        :filter="practice.filter.value"
        :lesson-completed="practice.lessonCompleted.value"
        :lesson-count="practice.lessonItems.value.length"
        :lesson-percent="practice.lessonPercent.value"
        :total-completed="practice.totalCompleted.value"
        :accuracy="practice.accuracy.value"
        :total-items="practice.totalItems"
        :color-scheme="colorScheme.mode.value"
        :voice-uri="voiceUri"
        :speech-rate="speechRate"
        :voices="voices"
        @update:lesson-number="practice.selectedLesson.value = $event"
        @update:filter="practice.filter.value = $event"
        @update:color-scheme="colorScheme.mode.value = $event"
        @update:voice-uri="voiceUri = $event"
        @update:speech-rate="speechRate = $event"
        @reset="resetCurrentLesson"
      />

      <header class="workspace-header">
        <div>
          <span class="eyebrow">NEW CONCEPT ENGLISH · BOOK 1 · ODD LESSONS</span>
          <h2>Chinese-to-English Sentence Practice</h2>
        </div>
        <div class="stats-strip">
          <div><el-icon><CircleCheck /></el-icon><span>已掌握<strong>{{ practice.totalCompleted.value }}</strong></span></div>
          <div><el-icon><TrophyBase /></el-icon><span>正确率<strong>{{ practice.accuracy.value }}%</strong></span></div>
          <div><el-icon><EditPen /></el-icon><span>总题数<strong>{{ practice.totalItems }}</strong></span></div>
        </div>
      </header>

      <TranslationExercise
        v-if="practice.filteredItems.value.length"
        :lesson-number="practice.lesson.value.number"
        :lesson-title="practice.lesson.value.title"
        :lesson-title-zh="practice.lesson.value.titleZh"
        :question-en="practice.lesson.value.questionEn"
        :question-zh="practice.lesson.value.questionZh"
        :items="practice.filteredItems.value"
        :all-items="practice.lessonItems.value"
        :answers="practice.answers.value"
        :results="practice.results.value"
        :completed-ids="practice.progress.value.completed"
        :display-mode="practice.displayMode.value"
        :mistake-history="practice.lessonMistakeHistory.value"
        @update:display-mode="practice.displayMode.value = $event"
        @update:answer="practice.updateAnswer"
        @submit="practice.submit"
        @clear="practice.clearAnswer"
        @speak="speak"
      />
      <el-empty v-else :description="emptyMessage" class="empty-state">
        <el-button type="primary" @click="practice.filter.value = 'all'">查看全部题目</el-button>
      </el-empty>

      <footer>Based on the user-provided New Concept English Book 1 materials. For personal study only.</footer>
    </div>
  </div>
</template>
