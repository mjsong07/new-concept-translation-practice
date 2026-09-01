<script setup lang="ts">
import type { ColorSchemeMode, Lesson, PracticeFilter } from "../types/practice";

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
  voices: SpeechSynthesisVoice[];
}>();

const emit = defineEmits<{
  "update:lessonNumber": [value: number];
  "update:filter": [value: PracticeFilter];
  "update:colorScheme": [value: ColorSchemeMode];
  "update:voiceUri": [value: string];
  "update:speechRate": [value: number];
  reset: [];
}>();
</script>

<template>
  <aside class="control-panel">
    <div class="brand-lockup">
      <div class="brand-mark">译</div>
      <div>
        <div class="brand-name">Sentence Workshop</div>
        <div class="brand-subtitle">NEW CONCEPT ENGLISH</div>
      </div>
    </div>

    <section class="control-section">
      <label class="control-label">选择课程</label>
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
      <label class="control-label">练习范围</label>
      <el-segmented
        :model-value="filter"
        :options="[
          { label: '全部', value: 'all' },
          { label: '未完成', value: 'unfinished' },
          { label: '错题', value: 'mistakes' }
        ]"
        @update:model-value="emit('update:filter', $event as PracticeFilter)"
      />
    </section>

    <section class="control-section">
      <label class="control-label">外观</label>
      <el-segmented
        :model-value="colorScheme"
        :options="[
          { label: '自动', value: 'system' },
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' }
        ]"
        @update:model-value="emit('update:colorScheme', $event as ColorSchemeMode)"
      />
    </section>

    <section class="control-section speech-settings">
      <label class="control-label">发音设置</label>
      <el-select :model-value="voiceUri" placeholder="系统默认发音人" @update:model-value="emit('update:voiceUri', String($event))">
        <el-option label="系统默认发音人" value="" />
        <el-option v-for="voice in voices" :key="voice.voiceURI" :label="`${voice.name} · ${voice.lang}`" :value="voice.voiceURI" />
      </el-select>
      <div class="speech-rate-row">
        <span>语速 {{ speechRate.toFixed(2) }}×</span>
        <el-slider :model-value="speechRate" :min="0.5" :max="1.5" :step="0.05" @update:model-value="emit('update:speechRate', Number($event))" />
      </div>
    </section>

    <section class="lesson-progress">
      <div class="progress-heading">
        <span>本课进度</span>
        <strong>{{ lessonCompleted }} / {{ lessonCount }}</strong>
      </div>
      <el-progress :percentage="lessonPercent" :show-text="false" :stroke-width="8" />
      <p>答对后自动计入完成进度，保存在本机浏览器中。</p>
    </section>

    <el-button class="reset-lesson-button" plain @click="emit('reset')">重做本课</el-button>

    <div class="keyboard-hint">
      <span>快捷键</span>
      <div><kbd>Enter</kbd> 校验并跳到下一句</div>
    </div>
  </aside>
</template>
