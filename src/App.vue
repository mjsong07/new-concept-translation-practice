<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { TrophyBase, CircleCheck, EditPen } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import PracticeControls from "./components/PracticeControls.vue";
import MobileSettings from "./components/MobileSettings.vue";
import TranslationExercise from "./components/TranslationExercise.vue";
import { useColorScheme } from "./composables/useColorScheme";
import { useI18n } from "./composables/useI18n";
import { useTranslationPractice } from "./composables/useTranslationPractice";
import { getEnglishVoices, speakEnglish, stopSpeech, toggleSpeechPause } from "./services/speech";

const { locale, t } = useI18n();
const practice = useTranslationPractice();
const colorScheme = useColorScheme();
const elementLocale = computed(() => locale.value === "en" ? en : zhCn);
const emptyMessage = computed(() => practice.filter.value === "mistakes" ? t("empty.noMistakes") : t("empty.completed"));
const voices = ref<SpeechSynthesisVoice[]>([]);
const voiceUri = ref(localStorage.getItem("new-concept-speech-voice") || "");
const speechRate = ref(Number(localStorage.getItem("new-concept-speech-rate")) || 0.82);
const savedSpeechVolume = Number(localStorage.getItem("new-concept-speech-volume"));
const speechVolume = ref(Number.isFinite(savedSpeechVolume) && savedSpeechVolume >= 0 ? savedSpeechVolume : 1);
const speechActive = ref(false);
const speechPaused = ref(false);
let speechRun = 0;
const currentLessonSpeechText = computed(() => [
  practice.lesson.value.title,
  practice.lesson.value.questionEn,
  ...practice.lesson.value.items.map((item) => item.speakerEn ? `${item.speakerEn}. ${item.answer}` : item.answer)
].filter(Boolean).join(" "));

function refreshVoices() {
  voices.value = getEnglishVoices();
}

function speak(text: string) {
  const run = ++speechRun;
  speechPaused.value = false;
  speakEnglish(text, { voiceURI: voiceUri.value, rate: speechRate.value, volume: speechVolume.value }, {
    onStart: () => {
      if (run === speechRun) speechActive.value = true;
    },
    onEnd: () => {
      if (run === speechRun) {
        speechActive.value = false;
        speechPaused.value = false;
      }
    }
  });
}

function toggleSpeech() {
  speechPaused.value = toggleSpeechPause();
}

function previewSpeechSetting() {
  speak(currentLessonSpeechText.value);
}

async function resetCurrentLesson() {
  try {
    await ElMessageBox.confirm(
      t("reset.message", { lesson: practice.lesson.value.number }),
      t("reset.title"),
      { confirmButtonText: t("reset.confirm"), cancelButtonText: t("reset.cancel"), type: "warning" }
    );
    practice.resetLesson();
    ElMessage.success(t("reset.success"));
  } catch {
    // 用户取消重做。
  }
}

watch(voiceUri, (value) => localStorage.setItem("new-concept-speech-voice", value));
watch(speechRate, (value) => localStorage.setItem("new-concept-speech-rate", String(value)));
watch(speechVolume, (value) => localStorage.setItem("new-concept-speech-volume", String(value)));
watch([voiceUri, speechRate, speechVolume], previewSpeechSetting);
onMounted(() => {
  refreshVoices();
  window.speechSynthesis?.addEventListener("voiceschanged", refreshVoices);
});
onUnmounted(() => {
  window.speechSynthesis?.removeEventListener("voiceschanged", refreshVoices);
  stopSpeech();
});

</script>

<template>
  <el-config-provider :locale="elementLocale">
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
      :speech-volume="speechVolume"
      :voices="voices"
      @update:lesson-number="practice.selectedLesson.value = $event"
      @update:filter="practice.filter.value = $event"
      @update:color-scheme="colorScheme.mode.value = $event"
      @update:voice-uri="voiceUri = $event"
      @update:speech-rate="speechRate = $event"
      @update:speech-volume="speechVolume = $event"
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
        :speech-volume="speechVolume"
        :voices="voices"
        @update:lesson-number="practice.selectedLesson.value = $event"
        @update:filter="practice.filter.value = $event"
        @update:color-scheme="colorScheme.mode.value = $event"
        @update:voice-uri="voiceUri = $event"
        @update:speech-rate="speechRate = $event"
        @update:speech-volume="speechVolume = $event"
        @reset="resetCurrentLesson"
      />

      <header class="workspace-header">
        <div>
          <span class="eyebrow">{{ t('header.eyebrow') }}</span>
          <h2>{{ t('header.title') }}</h2>
        </div>
        <div class="stats-strip">
          <div><el-icon><CircleCheck /></el-icon><span>{{ t('stats.mastered') }}<strong>{{ practice.totalCompleted.value }}</strong></span></div>
          <div><el-icon><TrophyBase /></el-icon><span>{{ t('stats.accuracy') }}<strong>{{ practice.accuracy.value }}%</strong></span></div>
          <div><el-icon><EditPen /></el-icon><span>{{ t('stats.total') }}<strong>{{ practice.totalItems }}</strong></span></div>
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
        :speech-active="speechActive"
        :speech-paused="speechPaused"
        @update:display-mode="practice.displayMode.value = $event"
        @update:answer="practice.updateAnswer"
        @submit="practice.submit"
        @clear="practice.clearAnswer"
        @speak="speak"
        @toggle-speech="toggleSpeech"
      />
      <el-empty v-else :description="emptyMessage" class="empty-state">
        <el-button type="primary" @click="practice.filter.value = 'all'">{{ t('empty.showAll') }}</el-button>
      </el-empty>

      <footer>{{ t('footer.source') }}</footer>
    </div>
  </div>
  </el-config-provider>
</template>
