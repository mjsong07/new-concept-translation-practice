<script setup lang="ts">
import { useI18n } from "../composables/useI18n";
import type { AppLocale, ColorSchemeMode, Lesson, PracticeFilter } from "../types/practice";

const { locale, t } = useI18n();

defineProps<{
  lessons: Lesson[];
  lessonNumber: number;
  filter: PracticeFilter;
  lessonCompleted: number;
  lessonCount: number;
  lessonPercent: number;
  colorScheme: ColorSchemeMode;
  voiceUri: string;
  speechRate: number;
  speechVolume: number;
  voices: SpeechSynthesisVoice[];
}>();

const emit = defineEmits<{
  "update:lessonNumber": [value: number];
  "update:filter": [value: PracticeFilter];
  "update:colorScheme": [value: ColorSchemeMode];
  "update:voiceUri": [value: string];
  "update:speechRate": [value: number];
  "update:speechVolume": [value: number];
  reset: [];
}>();
</script>

<template>
  <aside class="control-panel">
    <div class="brand-lockup">
      <div class="brand-mark">{{ locale === 'en' ? 'EN' : '译' }}</div>
      <div>
        <div class="brand-name">Sentence Workshop</div>
        <div class="brand-subtitle">NEW CONCEPT ENGLISH</div>
      </div>
    </div>

    <section class="control-section">
      <label class="control-label">{{ t('settings.language') }}</label>
      <el-segmented
        :model-value="locale"
        :options="[{ label: '中文', value: 'zh-CN' }, { label: 'English', value: 'en' }]"
        @update:model-value="locale = $event as AppLocale"
      />
    </section>

    <section class="control-section">
      <label class="control-label">{{ t('settings.selectLesson') }}</label>
      <el-select
        :model-value="lessonNumber"
        size="large"
        @update:model-value="emit('update:lessonNumber', Number($event))"
      >
        <el-option
          v-for="lesson in lessons"
          :key="lesson.number"
          :label="`Lesson ${lesson.number} · ${lesson.title}`"
          :value="lesson.number"
        />
      </el-select>
    </section>

    <section class="control-section">
      <label class="control-label">{{ t('settings.practiceRange') }}</label>
      <el-segmented
        :model-value="filter"
        :options="[
          { label: t('filter.all'), value: 'all' },
          { label: t('filter.unfinished'), value: 'unfinished' },
          { label: t('filter.mistakes'), value: 'mistakes' }
        ]"
        @update:model-value="emit('update:filter', $event as PracticeFilter)"
      />
    </section>

    <section class="control-section">
      <label class="control-label">{{ t('settings.appearance') }}</label>
      <el-segmented
        :model-value="colorScheme"
        :options="[
          { label: t('theme.system'), value: 'system' },
          { label: t('theme.light'), value: 'light' },
          { label: t('theme.dark'), value: 'dark' }
        ]"
        @update:model-value="emit('update:colorScheme', $event as ColorSchemeMode)"
      />
    </section>

    <section class="control-section speech-settings">
      <label class="control-label">{{ t('settings.pronunciation') }}</label>
      <el-select :model-value="voiceUri" :placeholder="t('settings.systemVoice')" @update:model-value="emit('update:voiceUri', String($event))">
        <el-option v-for="voice in voices" :key="voice.voiceURI" :label="`${voice.name} · ${voice.lang}`" :value="voice.voiceURI" />
      </el-select>
      <div class="speech-rate-row">
        <span>{{ t('settings.rate', { rate: speechRate.toFixed(2) }) }}</span>
        <el-slider :model-value="speechRate" :min="0.1" :max="1.5" :step="0.05" @update:model-value="emit('update:speechRate', Number($event))" />
      </div>
      <div class="speech-rate-row">
        <span>{{ t('settings.volume', { volume: Math.round(speechVolume * 100) }) }}</span>
        <el-slider :model-value="speechVolume" :min="0" :max="1" :step="0.05" @update:model-value="emit('update:speechVolume', Number($event))" />
      </div>
    </section>

    <section class="lesson-progress">
      <div class="progress-heading">
        <span>{{ t('settings.progress') }}</span>
        <strong>{{ lessonCompleted }} / {{ lessonCount }}</strong>
      </div>
      <el-progress :percentage="lessonPercent" :show-text="false" :stroke-width="8" />
      <p>{{ t('settings.progressHint') }}</p>
    </section>

    <el-button class="reset-lesson-button" plain @click="emit('reset')">{{ t('settings.redo') }}</el-button>

    <div class="keyboard-hint">
      <span>{{ t('settings.shortcuts') }}</span>
      <div><kbd>Enter</kbd> {{ t('settings.enterHint') }}</div>
    </div>
  </aside>
</template>
