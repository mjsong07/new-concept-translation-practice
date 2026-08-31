<script setup lang="ts">
import { ref } from "vue";
import { ArrowRight, Setting } from "@element-plus/icons-vue";
import type { Lesson, PracticeFilter } from "../types/practice";

defineProps<{
  lessons: Lesson[];
  lessonNumber: number;
  lessonTitle: string;
  filter: PracticeFilter;
  lessonCompleted: number;
  lessonCount: number;
  lessonPercent: number;
  totalCompleted: number;
  accuracy: number;
  totalItems: number;
}>();

const emit = defineEmits<{
  "update:lessonNumber": [value: number];
  "update:filter": [value: PracticeFilter];
}>();

const visible = ref(false);

const filterLabels: Record<PracticeFilter, string> = {
  all: "全部",
  unfinished: "未完成",
  mistakes: "错题"
};

</script>

<template>
  <div class="mobile-settings">
    <button class="mobile-settings-launch" type="button" aria-label="打开练习设置" @click="visible = true">
      <span class="mobile-settings-icon"><el-icon><Setting /></el-icon></span>
      <span class="mobile-settings-copy">
        <strong>Lesson {{ lessonNumber }} · {{ lessonTitle }}</strong>
        <small>已掌握 {{ lessonCompleted }}/{{ lessonCount }} · {{ filterLabels[filter] }}</small>
      </span>
      <el-icon class="mobile-settings-arrow"><ArrowRight /></el-icon>
    </button>

    <el-dialog
      v-model="visible"
      class="mobile-settings-dialog"
      title="练习设置"
      width="calc(100% - 28px)"
      append-to-body
      align-center
    >
      <div class="mobile-settings-form">
        <section>
          <label>选择课程</label>
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

        <section>
          <label>练习范围</label>
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

        <section class="mobile-dialog-progress">
          <div><span>本课进度</span><strong>{{ lessonCompleted }} / {{ lessonCount }}</strong></div>
          <el-progress :percentage="lessonPercent" :show-text="false" :stroke-width="8" />
        </section>

        <div class="mobile-dialog-stats">
          <div><span>已掌握</span><strong>{{ totalCompleted }}</strong></div>
          <div><span>正确率</span><strong>{{ accuracy }}%</strong></div>
          <div><span>总题数</span><strong>{{ totalItems }}</strong></div>
        </div>
      </div>

      <template #footer>
        <el-button class="mobile-settings-done" type="primary" size="large" @click="visible = false">完成设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>
