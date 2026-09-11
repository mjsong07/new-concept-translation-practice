<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../composables/useI18n";
import { lessonNotes } from "../data/lessonNotes";
import { renderMarkdown } from "../services/markdown";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  lessonNumber: number;
  lessonTitle: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const notesHtml = computed(() => renderMarkdown(lessonNotes[props.lessonNumber] || ""));
</script>

<template>
  <el-dialog
    :model-value="visible"
    class="lesson-notes-dialog"
    :title="`${t('notes.title')} · Lesson ${lessonNumber} ${lessonTitle}`"
    width="min(680px, calc(100% - 24px))"
    append-to-body
    @update:model-value="emit('update:visible', $event as boolean)"
  >
    <!-- 笔记为本地静态数据，renderMarkdown 已先转义再生成标记。 -->
    <div v-if="notesHtml" class="lesson-notes-body" v-html="notesHtml"></div>
    <el-empty v-else :description="t('notes.empty')" :image-size="80" />
  </el-dialog>
</template>
