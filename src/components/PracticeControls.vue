<script setup lang="ts">
import type { Lesson, PracticeFilter } from "../types/practice";

defineProps<{
  lessons: Lesson[];
  lessonNumber: number;
  filter: PracticeFilter;
  lessonCompleted: number;
  lessonCount: number;
  lessonPercent: number;
}>();

const emit = defineEmits<{
  "update:lessonNumber": [value: number];
  "update:filter": [value: PracticeFilter];
}>();
</script>

<template>
  <aside class="control-panel">
    <div class="brand-lockup">
      <div class="brand-mark">译</div>
      <div>
        <div class="brand-name">译句工坊</div>
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

    <section class="lesson-progress">
      <div class="progress-heading">
        <span>本课进度</span>
        <strong>{{ lessonCompleted }} / {{ lessonCount }}</strong>
      </div>
      <el-progress :percentage="lessonPercent" :show-text="false" :stroke-width="8" />
      <p>答对后自动计入完成进度，保存在本机浏览器中。</p>
    </section>

    <div class="keyboard-hint">
      <span>快捷键</span>
      <div><kbd>Enter</kbd> 校验并跳到下一句</div>
    </div>
  </aside>
</template>
