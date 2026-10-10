<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Microphone, VideoPlay } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { evaluatePronunciation, PronunciationApiError } from "../services/pronunciation";
import type { PronunciationEvaluation, PronunciationWordResult } from "../services/pronunciation";

const props = withDefaults(defineProps<{
  text: string;
  suppressBlurOnPointer?: boolean;
}>(), {
  suppressBlurOnPointer: false
});
const emit = defineEmits<{ interact: [] }>();
const { t } = useI18n();
const recording = ref(false);
const evaluating = ref(false);
const result = ref<PronunciationEvaluation>();
const errorMessage = ref("");
const panelDismissed = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const mediaSupported = typeof navigator !== "undefined"
  && !!navigator.mediaDevices?.getUserMedia
  && typeof MediaRecorder !== "undefined";
const busy = computed(() => recording.value || evaluating.value);
let recorder: MediaRecorder | undefined;
let stream: MediaStream | undefined;
let chunks: BlobPart[] = [];
let stopTimer: number | undefined;
let recordingUrl = "";
let evaluationController: AbortController | undefined;
let starting = false;
let disposed = false;

function releaseStream() {
  if (stopTimer !== undefined) window.clearTimeout(stopTimer);
  stopTimer = undefined;
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
}

function dismissPanel() {
  panelDismissed.value = true;
}

function onDocumentClick(event: MouseEvent) {
  if (rootEl.value?.contains(event.target as Node)) return;
  dismissPanel();
}

function cancelEvaluation() {
  evaluationController?.abort();
  evaluationController = undefined;
  evaluating.value = false;
}

function handleMicClick() {
  if (recording.value) {
    stopRecording();
    return;
  }
  if (evaluating.value) cancelEvaluation();
  void startRecording();
}

async function startRecording() {
  if (starting || recording.value) return;
  starting = true;
  errorMessage.value = "";
  result.value = undefined;
  panelDismissed.value = false;
  if (!mediaSupported) {
    starting = false;
    errorMessage.value = t("pronunciation.noMicrophoneSupport");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      errorMessage.value = t("pronunciation.recordingError");
      releaseStream();
      recording.value = false;
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
      chunks = [];
      releaseStream();
      if (disposed) return;
      if (!blob.size) {
        errorMessage.value = t("pronunciation.emptyRecording");
        recording.value = false;
        return;
      }
      void submitRecording(blob);
    };
    recorder.start();
    recording.value = true;
    stopTimer = window.setTimeout(stopRecording, 18_000);
  } catch (error) {
    releaseStream();
    recording.value = false;
    errorMessage.value = error instanceof DOMException && error.name === "NotAllowedError"
      ? t("pronunciation.microphonePermission")
      : t("pronunciation.recordingError");
  } finally {
    starting = false;
  }
}

function stopRecording() {
  if (recorder?.state === "recording") recorder.stop();
}

async function submitRecording(blob: Blob) {
  recording.value = false;
  evaluating.value = true;
  errorMessage.value = "";
  const controller = new AbortController();
  evaluationController = controller;
  try {
    result.value = await evaluatePronunciation(blob, props.text, controller.signal);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = URL.createObjectURL(blob);
  } catch (error) {
    if (controller.signal.aborted) return;
    errorMessage.value = error instanceof PronunciationApiError
      ? error.message.startsWith("pronunciation.")
        ? t(error.message)
        : error.message
      : t("pronunciation.networkError");
  } finally {
    evaluating.value = false;
    panelDismissed.value = false;
    if (evaluationController === controller) evaluationController = undefined;
  }
}

function playRecording() {
  if (recordingUrl) {
    const audio = new Audio(recordingUrl);
    void audio.play().catch(() => {
      errorMessage.value = t("pronunciation.playbackError");
    });
  }
}

function wordClass(word: PronunciationWordResult) {
  return `is-${word.status}`;
}

onMounted(() => {
  window.addEventListener("click", onDocumentClick, true);
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener("click", onDocumentClick, true);
  evaluationController?.abort();
  if (recorder?.state === "recording") recorder.stop();
  releaseStream();
  if (recordingUrl) URL.revokeObjectURL(recordingUrl);
});
</script>

<template>
  <div ref="rootEl" class="pronunciation-recorder">
    <button
      class="pronunciation-mic-button"
      type="button"
      :class="{ 'is-recording': recording, 'is-busy': evaluating }"
      :aria-label="recording ? t('pronunciation.stop') : t('pronunciation.record')"
      :title="recording ? t('pronunciation.stop') : t('pronunciation.record')"
      @pointerdown="props.suppressBlurOnPointer && emit('interact')"
      @click="handleMicClick"
    >
      <el-icon><Microphone /></el-icon>
    </button>
    <section
      v-if="(busy || result || errorMessage) && !panelDismissed"
      class="pronunciation-panel"
      aria-live="polite"
      @click="dismissPanel"
    >
      <div class="pronunciation-panel-heading">
        <span v-if="recording">{{ t("pronunciation.recording") }}</span>
        <span v-else-if="evaluating">{{ t("pronunciation.waking") }}</span>
        <span v-else>{{ t("pronunciation.result") }}</span>
      </div>
      <p v-if="evaluating" class="pronunciation-hint">{{ t("pronunciation.wakingHint") }}</p>
      <p v-if="errorMessage" class="pronunciation-error">{{ errorMessage }}</p>
      <template v-if="result">
        <div class="pronunciation-scores">
          <strong class="pronunciation-total">{{ result.overall_score }}</strong>
          <span>{{ t("pronunciation.total") }}</span>
          <span>{{ t("pronunciation.completeness") }} {{ result.completeness_score }}</span>
          <span>{{ t("pronunciation.fluency") }} {{ result.fluency_score }}</span>
          <button class="pronunciation-replay" type="button" :aria-label="t('pronunciation.replay')" @click.stop="playRecording">
            <el-icon><VideoPlay /></el-icon>
          </button>
        </div>
        <p class="pronunciation-hint">{{ t("pronunciation.accuracyUnavailable") }}</p>
        <p class="pronunciation-transcript">{{ t("pronunciation.heard") }} {{ result.transcription }}</p>
        <div class="pronunciation-word-results">
          <span
            v-for="(word, index) in result.word_results"
            :key="`${word.expected || word.recognized}-${index}`"
            :class="wordClass(word)"
          >{{ word.expected || `+${word.recognized}` }}</span>
        </div>
        <p class="pronunciation-hint">
          {{ result.fluency.words_per_minute }} {{ t("pronunciation.wpm") }}
          · {{ t("pronunciation.pauses", { count: result.fluency.long_pauses }) }}
        </p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.pronunciation-recorder { position: relative; display: inline-flex; align-items: flex-start; gap: 5px; vertical-align: middle; }
.pronunciation-mic-button, .pronunciation-replay {
  display: inline-grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--line);
  border-radius: 7px; color: var(--green); background: var(--paper); cursor: pointer;
}
.pronunciation-mic-button:hover, .pronunciation-replay:hover { color: #fff; border-color: var(--green); background: var(--green); }
.pronunciation-mic-button:disabled { opacity: .55; cursor: not-allowed; }
.pronunciation-mic-button.is-recording { color: #fff; border-color: #d65042; background: #d65042; animation: mic-pulse 1.2s infinite; }
.pronunciation-panel {
  position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; width: min(380px, calc(100vw - 60px)); padding: 9px 11px;
  border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: var(--paper);
  box-shadow: 0 8px 24px rgba(20, 35, 30, .14); font-size: 12px; text-align: left;
}
.pronunciation-panel-heading, .pronunciation-scores { display: flex; align-items: center; gap: 8px; }
.pronunciation-panel-heading { justify-content: space-between; font-weight: 650; }
.pronunciation-scores { flex-wrap: wrap; margin-top: 6px; color: var(--muted); font-size: 11px; }
.pronunciation-total { color: var(--green); font-size: 22px; line-height: 1; }
.pronunciation-replay { width: 22px; height: 22px; margin-left: auto; }
.pronunciation-transcript { margin: 7px 0 4px; color: var(--ink); }
.pronunciation-word-results { display: flex; flex-wrap: wrap; gap: 4px; }
.pronunciation-word-results span { padding: 2px 5px; border-radius: 5px; background: #edf3ed; }
.pronunciation-word-results .is-correct { color: #21804d; background: #e7f5ec; }
.pronunciation-word-results .is-close { color: #986400; background: #fff4d8; }
.pronunciation-word-results .is-wrong, .pronunciation-word-results .is-missing { color: #b7352c; background: #ffebe8; }
.pronunciation-word-results .is-extra { color: #7045a0; background: #f1eafd; }
.pronunciation-hint { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.pronunciation-error { margin: 6px 0 0; color: #b7352c; overflow-wrap: anywhere; }
@keyframes mic-pulse { 50% { box-shadow: 0 0 0 4px rgba(214, 80, 66, .18); } }
@media (max-width: 640px) { .pronunciation-panel { width: min(310px, calc(100vw - 50px)); } }
</style>
