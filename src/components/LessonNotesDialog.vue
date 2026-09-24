<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Edit, View, Hide } from "@element-plus/icons-vue";
import { useI18n } from "../composables/useI18n";
import { lessonNotes } from "../data/lessonNotes";
import { lessonContent } from "../data/lessonContent";
import { lessonNotesPages } from "../data/lessonNotesPages";
import { lessonHomework } from "../data/lessonHomework";
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

// ============ 我的笔记：默认只读，点击“编辑”后支持修改并保存到本机 ============
const activeTab = ref("mine");
const savedText = ref("");
const draft = ref("");
const editing = ref(false);

function notesStorageKey(number: number) {
  return `new-concept-lesson-notes-${number}`;
}

function loadNotes(number: number): string {
  try {
    const saved = localStorage.getItem(notesStorageKey(number));
    if (saved != null) return saved;
  } catch {
    // 浏览器禁用本地存储时退回静态数据。
  }
  return lessonNotes[number] || "";
}

function startEdit() {
  draft.value = savedText.value;
  editing.value = true;
}

function cancelEdit() {
  draft.value = savedText.value;
  editing.value = false;
}

function saveNotes() {
  savedText.value = draft.value;
  try {
    localStorage.setItem(notesStorageKey(props.lessonNumber), savedText.value);
  } catch {
    // 保存失败时仍保留本次会话中的编辑。
  }
  editing.value = false;
}

// ============ Homework：Questions / Homework / Summary & Recap 三个独立输入框 ============
interface HomeworkDraft {
  questions: string;
  homework: string;
  summary: string;
}

const emptyHomework = (): HomeworkDraft => ({ questions: "", homework: "", summary: "" });

function homeworkStorageKey(number: number) {
  return `new-concept-lesson-homework-${number}`;
}

function loadHomework(number: number): HomeworkDraft {
  try {
    const raw = localStorage.getItem(homeworkStorageKey(number));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HomeworkDraft>;
      return {
        questions: parsed.questions || "",
        homework: parsed.homework || "",
        summary: parsed.summary || "",
      };
    }
  } catch {
    // 忽略损坏数据，按空草稿处理。
  }
  return emptyHomework();
}

const homework = ref<HomeworkDraft>(emptyHomework());

function saveHomework() {
  try {
    localStorage.setItem(homeworkStorageKey(props.lessonNumber), JSON.stringify(homework.value));
  } catch {
    // 保存失败时仍保留本次会话中的输入。
  }
}

// ============ 切课时重载 ============
function reload() {
  savedText.value = loadNotes(props.lessonNumber);
  draft.value = savedText.value;
  editing.value = false;
  homework.value = loadHomework(props.lessonNumber);
  activeTab.value = "mine";
  hideAll.value = false;
  hiddenGroups.value = new Set();
}

watch(() => props.lessonNumber, reload, { immediate: true });

const notesHtml = computed(() => renderMarkdown(savedText.value));

// 课堂笔记正文：按类别（Words/Grammar/Comprehension/Asking questions/Story）切分，每类一个 tab，只读。
const contentBlocks = computed(() => lessonContent[props.lessonNumber] || []);

// 原书课堂笔记截图：保留图片版，方便与提取文字对照。
const classNotesImages = computed(() => lessonNotesPages[props.lessonNumber] || []);

// Q§ 提问 / A§ 回答 / § 单词头词，做字体与颜色区分（原始 T:/S:/音标已在提取时剔除）。
const DRILL = new Set(["Comprehension", "Asking questions", "Practices"]);
function lineClass(line: string) {
  if (line.startsWith("Q§")) return "lesson-content-t";
  if (line.startsWith("A§")) return "lesson-content-s";
  if (line.startsWith("§")) return "lesson-content-word";
  return "";
}

// 显示前去掉内部标记。
function displayLine(line: string) {
  return line.replace(/^(Q§|A§|§)/, "");
}

// 操练块按“提问 -> 紧随其后的回答”分组；每个提问后面放小眼睛单独切换回答。
// Asking questions 里无编号提示词（When...?/Why...?）作为副问题内联在编号提问后面，排版更紧凑。
interface DrillGroup {
  q: string;
  subQ: string | null;
  answers: string[];
  subAnswers: string[];
}
function drillGroups(lines: string[]): DrillGroup[] {
  const groups: DrillGroup[] = [];
  let cur: DrillGroup | null = null;
  for (const line of lines) {
    if (line.startsWith("Q§")) {
      if (/^Q§\d/.test(line)) {
        cur = { q: line, subQ: null, answers: [], subAnswers: [] };
        groups.push(cur);
      } else if (cur && !cur.subQ) {
        cur.subQ = line; // 无编号提示词，并入本题
      }
    } else if (line.startsWith("A§") && cur) {
      if (cur.subQ) cur.subAnswers.push(line);
      else cur.answers.push(line);
    }
  }
  return groups;
}

// 已隐藏回答的分组 key（blockIndex-groupIndex）。
const hiddenGroups = ref<Set<string>>(new Set());
function toggleGroup(key: string) {
  const next = new Set(hiddenGroups.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  hiddenGroups.value = next;
}
// 全局“全部隐藏/显示”开关：开启后隐藏本 tab 全部回答。
const hideAll = ref(false);
function groupShown(key: string) {
  return !hideAll.value && !hiddenGroups.value.has(key);
}

// Homework tab 顶部的作业要求（从 PDF homework 虚线框提取）。
const homeworkTasks = computed(() => lessonHomework[props.lessonNumber] || []);
</script>

<template>
  <el-dialog
    :model-value="visible"
    class="lesson-notes-dialog"
    :title="`${t('notes.title')} · Lesson ${lessonNumber} ${lessonTitle}`"
    width="min(720px, calc(100% - 24px))"
    append-to-body
    @update:model-value="emit('update:visible', $event as boolean)"
  >
    <el-tabs v-model="activeTab" class="lesson-notes-tabs">
      <!-- 我的笔记：默认只读，点击“编辑”后支持修改并保存到本机。 -->
      <el-tab-pane :label="t('notes.tabMine')" name="mine">
        <div class="lesson-notes-toolbar">
          <el-button
            v-if="!editing"
            size="small"
            type="primary"
            plain
            :icon="Edit"
            @click="startEdit"
          >
            {{ t("notes.edit") }}
          </el-button>
          <template v-else>
            <el-button size="small" type="primary" :icon="Check" @click="saveNotes">
              {{ t("notes.save") }}
            </el-button>
            <el-button size="small" @click="cancelEdit">{{ t("notes.cancel") }}</el-button>
          </template>
        </div>

        <!-- 编辑态：文本区。内容先经 renderMarkdown 转义，保存后再渲染，避免注入。 -->
        <el-input
          v-if="editing"
          v-model="draft"
          class="lesson-notes-editor"
          type="textarea"
          :rows="12"
          :placeholder="t('notes.editHint')"
        />
        <div v-else-if="notesHtml" class="lesson-notes-body" v-html="notesHtml"></div>
        <el-empty v-else :description="t('notes.empty')" :image-size="80">
          <el-button size="small" type="primary" :icon="Edit" @click="startEdit">
            {{ t("notes.edit") }}
          </el-button>
        </el-empty>
      </el-tab-pane>

      <!-- 课堂笔记正文：按类别 Words/Grammar/Practices/Story 各一个 tab，只读文字内容。 -->
      <el-tab-pane
        v-for="(block, i) in contentBlocks"
        :key="i"
        :label="block.category"
        :name="`content-${i}`"
      >
        <!-- 问答操练：顶部全部显示/隐藏按钮，每题后小眼睛单独切换。 -->
        <div v-if="DRILL.has(block.category)" class="lesson-content" :class="{ 'all-hidden': hideAll }">
          <div class="lesson-content-toolbar">
            <el-button size="small" plain @click="hideAll = !hideAll">
              {{ hideAll ? t("notes.showAnswersAll") : t("notes.hideAnswersAll") }}
            </el-button>
          </div>
          <template v-for="(g, gi) in drillGroups(block.lines)" :key="gi">
            <p :class="lineClass(g.q)">
              {{ displayLine(g.q) }}
              <el-icon
                class="answer-toggle"
                :title="groupShown(i + '-' + gi) ? '隐藏回答' : '显示回答'"
                @click="toggleGroup(i + '-' + gi)"
              >
                <View v-if="groupShown(i + '-' + gi)" />
                <Hide v-else />
              </el-icon>
              <span v-if="g.subQ" class="inline-subq">
                {{ displayLine(g.subQ) }}
                <el-icon
                  class="answer-toggle"
                  :title="groupShown(i + '-' + gi + '-sub') ? '隐藏回答' : '显示回答'"
                  @click="toggleGroup(i + '-' + gi + '-sub')"
                >
                  <View v-if="groupShown(i + '-' + gi + '-sub')" />
                  <Hide v-else />
                </el-icon>
              </span>
            </p>
            <p
              v-for="(a, ai) in g.answers"
              v-show="groupShown(i + '-' + gi)"
              :key="ai"
              :class="lineClass(a)"
            >{{ displayLine(a) }}</p>
            <p
              v-for="(a, ai) in g.subAnswers"
              v-show="groupShown(i + '-' + gi + '-sub')"
              :key="'s' + ai"
              :class="lineClass(a)"
            >{{ displayLine(a) }}</p>
          </template>
        </div>
        <!-- 非问答类（Words/Grammar/Story）：直接列出行。 -->
        <div v-else class="lesson-content">
          <p
            v-for="(line, j) in block.lines"
            :key="j"
            :class="lineClass(line)"
          >{{ displayLine(line) }}</p>
        </div>
      </el-tab-pane>

      <!-- 原书截图：保留 PDF 原图，点击可放大，方便与上面提取的文字内容对照。 -->
      <el-tab-pane :label="t('notes.tabOriginal')" name="original">
        <div v-if="classNotesImages.length" class="class-notes-pages">
          <el-image
            v-for="(src, i) in classNotesImages"
            :key="i"
            :src="src"
            :preview-src-list="classNotesImages"
            :initial-index="i"
            :preview-teleported="true"
            :loading="i === 0 ? 'eager' : 'lazy'"
            fit="contain"
            class="class-notes-page"
          />
        </div>
        <el-empty v-else :description="t('notes.classNotesEmpty')" :image-size="80" />
      </el-tab-pane>

      <!-- Homework：康奈尔笔记三栏，Questions / Homework / Summary & Recap。 -->
      <el-tab-pane :label="t('notes.tabHomework')" name="homework">
        <div v-if="homeworkTasks.length" class="homework-tasks">
          <div class="homework-tasks-title">{{ t("notes.homeworkTasks") }}</div>
          <ul class="homework-tasks-list">
            <li v-for="(task, i) in homeworkTasks" :key="i">{{ task }}</li>
          </ul>
        </div>
        <div class="homework-grid">
          <div class="homework-cell homework-questions">
            <label class="homework-label">{{ t("notes.homeworkQuestions") }}</label>
            <el-input
              v-model="homework.questions"
              class="homework-input"
              type="textarea"
              :rows="3"
              :autosize="{ minRows: 3, maxRows: 5 }"
              :placeholder="t('notes.homeworkQuestionsHint')"
            />
          </div>
          <div class="homework-cell homework-main">
            <label class="homework-label">{{ t("notes.homeworkHomework") }}</label>
            <el-input
              v-model="homework.homework"
              class="homework-input"
              type="textarea"
              :rows="4"
              :autosize="{ minRows: 4, maxRows: 6 }"
              :placeholder="t('notes.homeworkHomeworkHint')"
            />
          </div>
          <div class="homework-cell homework-summary">
            <label class="homework-label">{{ t("notes.homeworkSummary") }}</label>
            <el-input
              v-model="homework.summary"
              class="homework-input"
              type="textarea"
              :rows="3"
              :autosize="{ minRows: 3, maxRows: 5 }"
              :placeholder="t('notes.homeworkSummaryHint')"
            />
          </div>
        </div>
        <div class="homework-actions">
          <el-button size="small" type="primary" :icon="Check" @click="saveHomework">
            {{ t("notes.save") }}
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>
