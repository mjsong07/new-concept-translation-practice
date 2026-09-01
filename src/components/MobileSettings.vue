<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowRight, Setting } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import type { AppLocale, ColorSchemeMode, Lesson, PracticeFilter } from "../types/practice";

const { locale, t } = useI18n();

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

const visible = ref(false);

const filterLabels = computed<Record<PracticeFilter, string>>(() => ({
  all: t("filter.all"), unfinished: t("filter.unfinished"), mistakes: t("filter.mistakes")
}));

</script>

<template>
  <div class="mobile-settings">
    <button class="mobile-settings-launch" type="button" :aria-label="t('settings.open')" @click="visible = true">
      <span class="mobile-settings-icon"><el-icon><Setting /></el-icon></span>
      <span class="mobile-settings-copy">
        <strong>Lesson {{ lessonNumber }} · {{ lessonTitle }}</strong>
        <small>{{ t('stats.mastered') }} {{ lessonCompleted }}/{{ lessonCount }} · {{ filterLabels[filter] }}</small>
      </span>
      <el-icon class="mobile-settings-arrow"><ArrowRight /></el-icon>
    </button>

    <el-dialog
      v-model="visible"
      class="mobile-settings-dialog"
      :title="t('settings.title')"
      width="calc(100% - 28px)"
      append-to-body
      align-center
    >
      <div class="mobile-settings-form">
        <section>
          <label>{{ t('settings.language') }}</label>
          <el-segmented
            :model-value="locale"
            :options="[{ label: '中文', value: 'zh-CN' }, { label: 'English', value: 'en' }]"
            @update:model-value="locale = $event as AppLocale"
          />
        </section>

        <section>
          <label>{{ t('settings.selectLesson') }}</label>
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
          <label>{{ t('settings.practiceRange') }}</label>
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

        <section>
          <label>{{ t('settings.appearance') }}</label>
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

        <section>
          <label>{{ t('settings.voice') }}</label>
          <el-select :model-value="voiceUri" size="large" :placeholder="t('settings.systemVoice')" @update:model-value="emit('update:voiceUri', String($event))">
            <el-option :label="t('settings.systemVoice')" value="" />
            <el-option v-for="voice in voices" :key="voice.voiceURI" :label="`${voice.name} · ${voice.lang}`" :value="voice.voiceURI" />
          </el-select>
        </section>

        <section>
          <label>{{ t('settings.rate', { rate: speechRate.toFixed(2) }) }}</label>
          <el-slider :model-value="speechRate" :min="0.5" :max="1.5" :step="0.05" show-stops @update:model-value="emit('update:speechRate', Number($event))" />
        </section>

        <section class="mobile-dialog-progress">
          <div><span>{{ t('settings.progress') }}</span><strong>{{ lessonCompleted }} / {{ lessonCount }}</strong></div>
          <el-progress :percentage="lessonPercent" :show-text="false" :stroke-width="8" />
        </section>

        <div class="mobile-dialog-stats">
          <div><span>{{ t('stats.mastered') }}</span><strong>{{ totalCompleted }}</strong></div>
          <div><span>{{ t('stats.accuracy') }}</span><strong>{{ accuracy }}%</strong></div>
          <div><span>{{ t('stats.total') }}</span><strong>{{ totalItems }}</strong></div>
        </div>

        <el-button class="mobile-reset-button" plain type="danger" @click="emit('reset')">{{ t('settings.redoLong') }}</el-button>
      </div>

      <template #footer>
        <el-button class="mobile-settings-done" type="primary" size="large" @click="visible = false">{{ t('settings.done') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
