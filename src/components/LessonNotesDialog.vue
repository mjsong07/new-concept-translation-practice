<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from "vue";
import { Check, Edit, View, Hide, ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import { ElDialog } from "element-plus";
import Viewer from "viewerjs";
import "viewerjs/dist/viewer.css";
import { useI18n } from "../composables/useI18n";
import { lessonNotes } from "../data/lessonNotes";
import { lessonContent } from "../data/lessonContent";
import { lessonNotesPages } from "../data/lessonNotesPages";
import { lessonTeacherNotesPages } from "../data/lessonTeacherNotesPages";
import { lessonTextPages } from "../data/lessonTextPages";
import { lessonHomework } from "../data/lessonHomework";
import { lessonGrammarPages, lessonGrammarAnswerPages } from "../data/lessonGrammarPages";
import { lessonGrammarCambridgePages } from "../data/lessonGrammarCambridgePages";
import { lessonGrammarCambridgeAnswerPages, lessonGrammarCambridgeUnits } from "../data/lessonGrammarCambridgeAnswers";
import { renderMarkdown } from "../services/markdown";
import FloatingAnswerPanel from "./FloatingAnswerPanel.vue";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  lessonNumber: number;
  lessonTitle: string;
  initialGroup?: "study" | "practice" | "summary";
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  "prev-lesson": [];
  "next-lesson": [];
}>();

const groupLabel = computed(() => {
  if (props.initialGroup === "practice") return t("notes.groupPractice");
  if (props.initialGroup === "summary") return t("notes.groupSummary");
  return t("notes.groupStudy");
});

// ============ 我的笔记：默认只读，点击“编辑”后支持修改并保存到本机 ============
const activeTab = ref("lesson-text");
let lastStudyTab = "lesson-text";

// ============ 分组：学习 / 练习 / 笔记总结，每组下面挂若干子 tab ============
type NotesGroup = "study" | "practice" | "summary";
const activeGroup = ref<NotesGroup>("study");

function contentIndexOf(category: string): number {
  return contentBlocks.value.findIndex(b => b.category === category);
}
function categoryGroup(cat: string): NotesGroup {
  return cat === "Words" || cat === "Grammar" ? "study" : "practice";
}

function applyGroup(g: NotesGroup) {
  if (activeGroup.value === "study") lastStudyTab = activeTab.value;
  activeGroup.value = g;
  if (g === "study") {
    activeTab.value = availableTabs.value.includes(lastStudyTab) ? lastStudyTab : availableTabs.value[0];
  } else if (g === "practice") {
    // 练习组第一个 tab 是「语法练习」截图，默认选中它。
    activeTab.value = "grammar";
  } else {
    // 笔记总结组（我的笔记已合并移除）：默认选中 Homework tab。
    activeTab.value = "homework";
  }
}
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

// ============ Homework：Questions / Summary & Recap 两个输入框（原 Homework 输入框已移除） ============
interface HomeworkDraft {
  questions: string;
  summary: string;
}

const emptyHomework = (): HomeworkDraft => ({ questions: "", summary: "" });

function homeworkStorageKey(number: number) {
  return `new-concept-lesson-homework-${number}`;
}

function loadHomework(number: number): HomeworkDraft {
  let questions = "";
  let summary = "";
  try {
    const raw = localStorage.getItem(homeworkStorageKey(number));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HomeworkDraft>;
      questions = parsed.questions || "";
      summary = parsed.summary || "";
    }
  } catch {
    // 忽略损坏数据，按空草稿处理。
  }
  // 迁移：原「我的笔记」内容并入 Summary & Recap（仅当总结为空且笔记非空时）。
  if (!summary.trim()) {
    const notes = loadNotes(number);
    if (notes.trim()) summary = notes;
  }
  return { questions, summary };
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
// 问答回答显隐状态（须在 reload 之前声明，因为下面 immediate watch 会立即调用 reload）。
const hideAll = ref(false);
const hiddenGroups = ref<Set<string>>(new Set());
// 全部隐藏时，被单独点开“显示回答”的分组（blockIndex-groupIndex[-sub]）。
const revealedGroups = ref<Set<string>>(new Set());

let didInit = false;
function reload() {
  savedText.value = loadNotes(props.lessonNumber);
  draft.value = savedText.value;
  editing.value = false;
  homework.value = loadHomework(props.lessonNumber);
  // 首次打开按顶栏图标选的分组定位；之后（弹窗 header 左右切课）保留上一次选中的 tab。
  if (!didInit) {
    applyGroup(props.initialGroup || "study");
    didInit = true;
  }
  hideAll.value = false;
  hiddenGroups.value = new Set();
  revealedGroups.value = new Set();
  // 切课后当前 tab 若在新课中不存在（如老师笔记、某类别正文缺失），回退到该分组第一个 tab；存在则保持选中。
  if (!availableTabs.value.includes(activeTab.value)) {
    activeTab.value = availableTabs.value[0];
  }
  // 切课后内容滚动条回到顶部
  nextTick(() => {
    const tabsContent = document.querySelector(".lesson-notes-dialog .el-tabs__content") as HTMLElement | null;
    if (!tabsContent) return;
    if (typeof tabsContent.scrollTo === "function") tabsContent.scrollTo({ top: 0 });
    else tabsContent.scrollTop = 0;
  });
}

const notesHtml = computed(() => renderMarkdown(savedText.value));

// 课堂笔记正文：按类别（Words/Grammar/Comprehension/Asking questions/Story）切分，每类一个 tab，只读。
const contentBlocks = computed(() => lessonContent[props.lessonNumber] || []);
// 当前分组下显示的文字类 tab（Words/Grammar 归学习，其余操练类归练习）
// 该分组下、且确实有内容可渲染的文字块（Practices 等没有 Q§/A§ 时渲染为空，直接去掉）
function blockHasContent(b: { category: string; lines: string[] }) {
  if (DRILL.has(b.category)) return drillGroups(b.lines).length > 0;
  return b.lines.some(l => l.trim() !== "");
}
// 统一 content 类 tab 顺序：先 Words 再 Grammar，其余操练类按固定顺序（数据源里各课块存储顺序不一致）。
const categoryOrder: Record<string, number> = { Words: 0, Grammar: 1, Comprehension: 2, "Asking questions": 3, Practices: 4, Story: 5 };
const visibleContentBlocks = computed(() =>
  contentBlocks.value
    .filter(b => categoryGroup(b.category) === activeGroup.value && blockHasContent(b))
    .sort((a, b) => (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99))
);

// 当前分组 + 当前课下实际存在的 tab（与模板中 el-tab-pane 的渲染条件保持一致，顺序即显示顺序）。
const availableTabs = computed<string[]>(() => {
  if (activeGroup.value === "summary") return ["homework"];
  const tabs = activeGroup.value === "study" ? ["lesson-text", "original"] : ["grammar"];
  if (activeGroup.value === "study") tabs.push("cambridge");
  if (activeGroup.value === "study" && props.lessonNumber % 2 === 1 && teacherNotesImages.value.length) tabs.push("teacher-notes");
  visibleContentBlocks.value.forEach(b => tabs.push(b.category));
  return tabs;
});

// 原书课堂笔记截图：保留图片版，方便与提取文字对照。
const classNotesImages = computed(() => lessonNotesPages[props.lessonNumber] || []);
const teacherNotesImages = computed(() => lessonTeacherNotesPages[props.lessonNumber] || []);

// 课文原文：教材 PDF 渲染的课文页（对话 + 生词/注释/参考译文），与“原书”一致支持点击放大。
const lessonTextImages = computed(() => lessonTextPages[props.lessonNumber] || []);
const grammarImages = computed(() => lessonGrammarPages(props.lessonNumber));
const grammarAnswerImages = computed(() => lessonGrammarAnswerPages(props.lessonNumber));
const grammarAnswerVisible = ref(false);
const questionImage = ref<{ src: string; title: string }>();

function showQuestionImage(src: string, title: string) {
  questionImage.value = { src, title };
}

function onQuestionImageVisibility(visible: boolean) {
  if (!visible) questionImage.value = undefined;
}

const cambridgeImages = computed(() => {
  const units = lessonGrammarCambridgeUnits(props.lessonNumber);
  // 渲染脚本按单元顺序依次生成讲解页、Exercises 页。
  return lessonGrammarCambridgePages(props.lessonNumber).map((src, index) => ({
    src,
    unit: units[Math.floor(index / 2)],
    isExercise: index % 2 === 1,
  }));
});
const cambridgeAnswerImages = computed(() => lessonGrammarCambridgeAnswerPages(props.lessonNumber));
const cambridgeAnswerVisible = ref(false);
const selectedCambridgeUnit = ref<number | null>(null);
const cambridgeAnswerCrops = computed(() => cambridgeAnswerImages.value.flatMap((page) =>
  page.regions.filter((region) => region.unit === selectedCambridgeUnit.value)
    .map((region) => ({ ...region, src: page.src, page: page.page }))
));
// 同一 Unit 的裁剪区来自同一比例尺原图，按最高区域归一化，保证各区域同比例显示。
const cambridgeAnswerMaxHeight = computed(() =>
  Math.max(0, ...cambridgeAnswerCrops.value.map((crop) => crop.height))
);
const viewportWidth = ref(window.innerWidth);
function onViewportResize() {
  viewportWidth.value = window.innerWidth;
}
window.addEventListener("resize", onViewportResize);
onBeforeUnmount(() => window.removeEventListener("resize", onViewportResize));
// 未缩放裁剪区按统一高度显示，浮窗按实际内容尺寸缩放。
const cambridgeFitVh = computed(() => (viewportWidth.value <= 640 ? 36 : 60));
function cambridgeCropStyle(crop: { width: number; height: number }) {
  const fitWidth = (crop.width / Math.max(cambridgeAnswerMaxHeight.value, 1)) * cambridgeFitVh.value;
  return { width: `min(${crop.width}px, ${fitWidth}vh)` };
}

function showCambridgeAnswers(unit: number) {
  selectedCambridgeUnit.value = unit;
  cambridgeAnswerVisible.value = true;
}

watch(() => [props.visible, props.lessonNumber, activeTab.value, activeGroup.value], () => {
  grammarAnswerVisible.value = false;
  cambridgeAnswerVisible.value = false;
  questionImage.value = undefined;
});

// 用 viewerjs 接管原书截图点击预览，原生支持鼠标滚轮 / 触控双指捏合放大缩小、拖动、旋转。
const notesPagesEl = ref<HTMLElement | null>(null);
let notesViewer: Viewer | null = null;
function destroyViewer() {
  notesViewer?.destroy();
  notesViewer = null;
}
function setupViewer() {
  destroyViewer();
  if (!notesPagesEl.value || !notesPagesEl.value.querySelector("img")) return;
  notesViewer = new Viewer(notesPagesEl.value, {
    inline: false,
    navbar: false,
    toolbar: {
      zoomIn: 1, zoomOut: 1, reset: 1,
      prev: 1, next: 1,
    },
    movable: true,
    zoomable: true,
    scalable: false,
    keyboard: false,
    transition: false,
    // 切课时销毁，避免残留旧实例
    hide: destroyViewer,
  });
}

// 老师版 Repetition drill(a) 截图，同样支持点击放大。
const teacherNotesPagesEl = ref<HTMLElement | null>(null);
let teacherNotesViewer: Viewer | null = null;
function destroyTeacherNotesViewer() {
  teacherNotesViewer?.destroy();
  teacherNotesViewer = null;
}
function setupTeacherNotesViewer() {
  destroyTeacherNotesViewer();
  if (!teacherNotesPagesEl.value || !teacherNotesPagesEl.value.querySelector("img")) return;
  teacherNotesViewer = new Viewer(teacherNotesPagesEl.value, {
    inline: false,
    navbar: false,
    toolbar: {
      zoomIn: 1, zoomOut: 1, reset: 1,
      prev: 1, next: 1,
    },
    movable: true,
    zoomable: true,
    scalable: false,
    keyboard: false,
    transition: false,
    hide: destroyTeacherNotesViewer,
  });
}

// 课文原文页同样用 viewerjs 点击放大。
const lessonTextPagesEl = ref<HTMLElement | null>(null);
let lessonTextViewer: Viewer | null = null;
function destroyLessonTextViewer() {
  lessonTextViewer?.destroy();
  lessonTextViewer = null;
}
function setupLessonTextViewer() {
  destroyLessonTextViewer();
  if (!lessonTextPagesEl.value || !lessonTextPagesEl.value.querySelector("img")) return;
  lessonTextViewer = new Viewer(lessonTextPagesEl.value, {
    inline: false,
    navbar: false,
    toolbar: {
      zoomIn: 1, zoomOut: 1, reset: 1,
      prev: 1, next: 1,
    },
    movable: true,
    zoomable: true,
    scalable: false,
    keyboard: false,
    transition: false,
    hide: destroyLessonTextViewer,
  });
}
watch(
  () => [props.visible, classNotesImages.value, teacherNotesImages.value, lessonTextImages.value, grammarImages.value] as const,
  async ([visible]) => {
    if (!visible) { destroyViewer(); destroyTeacherNotesViewer(); destroyLessonTextViewer(); return; }
    await nextTick();
    setupViewer();
    setupTeacherNotesViewer();
    setupLessonTextViewer();
  },
  { immediate: true }
);
onBeforeUnmount(() => { destroyViewer(); destroyTeacherNotesViewer(); destroyLessonTextViewer(); });

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

watch(() => props.lessonNumber, reload, { immediate: true });

// 弹窗每次打开时，按顶栏图标选中的分组定位（切课时已在 reload 里处理）。
let wasVisible = false;
watch(() => props.visible, (v) => {
  if (v && !wasVisible) applyGroup(props.initialGroup || "study");
  wasVisible = v;
});

// 单个分组的显隐 key（blockIndex-groupIndex[-sub]）。
// 默认模式：显示所有回答，点眼睛=单独隐藏；全部隐藏模式：默认全藏，点眼睛=单独点开。
function toggleGroup(key: string) {
  const target = hideAll.value ? revealedGroups.value : hiddenGroups.value;
  const next = new Set(target);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  if (hideAll.value) revealedGroups.value = next;
  else hiddenGroups.value = next;
}
// 切到“全部隐藏/显示”时清空单行记录，从头开始。
function toggleHideAll() {
  hideAll.value = !hideAll.value;
  hiddenGroups.value = new Set();
  revealedGroups.value = new Set();
}
function groupShown(key: string) {
  return hideAll.value ? revealedGroups.value.has(key) : !hiddenGroups.value.has(key);
}

// Homework tab 顶部的作业要求（从 PDF homework 虚线框提取）。
const homeworkTasks = computed(() => lessonHomework[props.lessonNumber] || []);
</script>

<template>
  <ElDialog
    class="lesson-notes-dialog"
    :title="`${groupLabel} · Lesson ${lessonNumber} ${lessonTitle}`"
    :model-value="visible"
    width="min(720px, calc(100% - 24px))"
    append-to-body
    :close-on-press-escape="!grammarAnswerVisible && !cambridgeAnswerVisible && !questionImage"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="lesson-notes-header">
        <span class="lesson-notes-header-title">{{ groupLabel }} · Lesson {{ lessonNumber }} {{ lessonTitle }}</span>
        <div class="lesson-notes-header-navs">
          <button class="lesson-notes-header-nav" type="button" :title="t('settings.previousLesson')" @click="emit('prev-lesson')"><el-icon><ArrowLeft /></el-icon></button>
          <button class="lesson-notes-header-nav" type="button" :title="t('settings.nextLesson')" @click="emit('next-lesson')"><el-icon><ArrowRight /></el-icon></button>
        </div>
      </div>
    </template>
    <el-tabs
      v-model="activeTab"
      class="lesson-notes-tabs"
    >
      <!-- 课文原文：教材 PDF 渲染的课文页，效果与“原书”一致，点击可放大。 -->
      <el-tab-pane v-if="activeGroup === 'study'" :label="t('notes.tabLessonText')" name="lesson-text">
        <div v-if="lessonTextImages.length" ref="lessonTextPagesEl" class="class-notes-pages">
          <img
            v-for="(src, i) in lessonTextImages"
            :key="i"
            :src="src"
            :alt="`lesson text ${i + 1}`"
            :loading="i === 0 ? 'eager' : 'lazy'"
            class="class-notes-page"
          />
        </div>
        <el-empty v-else :description="t('notes.lessonTextEmpty')" :image-size="80" />
      </el-tab-pane>

      <!-- 原书截图：保留 PDF 原图，点击可放大，方便与上面提取的文字内容对照。 -->
      <el-tab-pane v-if="activeGroup === 'study'" :label="t('notes.tabOriginal')" name="original">
        <div v-if="classNotesImages.length" ref="notesPagesEl" class="class-notes-pages">
          <img
            v-for="(src, i) in classNotesImages"
            :key="i"
            :src="src"
            :alt="`page ${i + 1}`"
            :loading="i === 0 ? 'eager' : 'lazy'"
            class="class-notes-page"
          />
        </div>
        <el-empty v-else :description="t('notes.classNotesEmpty')" :image-size="80" />
      </el-tab-pane>

      <!-- 剑桥初级英语语法：学习组，紧跟笔记（original）之后。 -->
      <el-tab-pane v-if="activeGroup === 'study'" :label="t('notes.tabCambridge')" name="cambridge">
        <div v-if="cambridgeImages.length" class="class-notes-pages">
          <div v-for="(page, i) in cambridgeImages" :key="page.src" class="cambridge-study-page">
            <div v-if="page.isExercise" class="exercise-answer-toolbar">
              <el-button
                size="small"
                plain
                :icon="View"
                :aria-label="`Unit ${page.unit} · ${t('exercise.showAnswers')}`"
                @click="showCambridgeAnswers(page.unit)"
              >{{ t("exercise.showAnswers") }}</el-button>
            </div>
            <img
              :src="page.src"
              :alt="`cambridge ${i + 1}`"
              :loading="i === 0 ? 'eager' : 'lazy'"
              class="class-notes-page"
              :class="{ 'question-image-trigger': page.isExercise }"
              :role="page.isExercise ? 'button' : undefined"
              :tabindex="page.isExercise ? 0 : undefined"
              @click="page.isExercise && showQuestionImage(page.src, `Unit ${page.unit} · ${t('notes.tabCambridge')}`)"
              @keydown.enter.prevent="page.isExercise && showQuestionImage(page.src, `Unit ${page.unit} · ${t('notes.tabCambridge')}`)"
              @keydown.space.prevent="page.isExercise && showQuestionImage(page.src, `Unit ${page.unit} · ${t('notes.tabCambridge')}`)"
            />
          </div>
        </div>
        <el-empty v-else :description="t('notes.classNotesEmpty')" :image-size="80" />
      </el-tab-pane>

      <!-- 老师版 repetition drill(a)：偶数课从 Play the examples... 到 (b) 前的截图，仅奇数课展示。 -->
      <el-tab-pane v-if="activeGroup === 'study' && teacherNotesImages.length && lessonNumber % 2 === 1" :label="t('notes.tabTeacherNotes')" name="teacher-notes">
        <div ref="teacherNotesPagesEl" class="class-notes-pages">
          <img
            v-for="(src, i) in teacherNotesImages"
            :key="i"
            :src="src"
            :alt="`teacher notes ${i + 1}`"
            :loading="i === 0 ? 'eager' : 'lazy'"
            class="class-notes-page"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="activeGroup === 'practice'" :label="t('notes.tabGrammar')" name="grammar">
        <div v-if="grammarImages.length" class="class-notes-pages">
          <div v-for="(src, i) in grammarImages" :key="src" class="grammar-study-page">
            <div v-if="grammarAnswerImages.length" class="exercise-answer-toolbar">
              <el-button
                size="small"
                plain
                :icon="View"
                :aria-label="`Lesson ${lessonNumber} · ${t('exercise.showAnswers')} ${i + 1}`"
                @click.stop="grammarAnswerVisible = true"
              >{{ t("exercise.showAnswers") }}</el-button>
            </div>
            <img
              :src="src"
              :alt="`grammar ${i + 1}`"
              :loading="i === 0 ? 'eager' : 'lazy'"
              class="class-notes-page question-image-trigger"
              role="button"
              tabindex="0"
              @click="showQuestionImage(src, `Lesson ${lessonNumber} · ${t('notes.tabGrammar')} ${i + 1}`)"
              @keydown.enter.prevent="showQuestionImage(src, `Lesson ${lessonNumber} · ${t('notes.tabGrammar')} ${i + 1}`)"
              @keydown.space.prevent="showQuestionImage(src, `Lesson ${lessonNumber} · ${t('notes.tabGrammar')} ${i + 1}`)"
            />
          </div>
        </div>
        <el-empty v-else :description="t('notes.noPractice')" :image-size="80" />
      </el-tab-pane>

      <!-- 课堂笔记正文：按类别 Words/Grammar/Practices/Story 各一个 tab，只读文字内容。 -->
      <el-tab-pane
        v-for="(block, i) in visibleContentBlocks"
        :key="block.category"
        :label="block.category"
        :name="block.category"
      >
        <!-- 问答操练：顶部全部显示/隐藏按钮，每题后小眼睛单独切换。 -->
        <div v-if="DRILL.has(block.category)" class="lesson-content" :class="{ 'all-hidden': hideAll }">
          <div class="lesson-content-toolbar">
            <el-button size="small" plain @click="toggleHideAll">
              {{ hideAll ? t("notes.showAnswersAll") : t("notes.hideAnswersAll") }}
            </el-button>
          </div>
          <template v-for="(g, gi) in drillGroups(block.lines)" :key="gi">
            <p :class="lineClass(g.q)">
              {{ displayLine(g.q) }}
              <el-icon
                class="answer-toggle"
                :title="groupShown(contentIndexOf(block.category) + '-' + gi) ? '隐藏回答' : '显示回答'"
                @click="toggleGroup(contentIndexOf(block.category) + '-' + gi)"
              >
                <View v-if="groupShown(contentIndexOf(block.category) + '-' + gi)" />
                <Hide v-else />
              </el-icon>
              <span v-if="g.subQ" class="inline-subq">
                {{ displayLine(g.subQ) }}
                <el-icon
                  class="answer-toggle"
                  :title="groupShown(contentIndexOf(block.category) + '-' + gi + '-sub') ? '隐藏回答' : '显示回答'"
                  @click="toggleGroup(contentIndexOf(block.category) + '-' + gi + '-sub')"
                >
                  <View v-if="groupShown(contentIndexOf(block.category) + '-' + gi + '-sub')" />
                  <Hide v-else />
                </el-icon>
              </span>
            </p>
            <p
              v-for="(a, ai) in g.answers"
              v-show="groupShown(contentIndexOf(block.category) + '-' + gi)"
              :key="ai"
              :class="lineClass(a)"
            >{{ displayLine(a) }}</p>
            <p
              v-for="(a, ai) in g.subAnswers"
              v-show="groupShown(contentIndexOf(block.category) + '-' + gi + '-sub')"
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
      <!-- Homework：康奈尔笔记三栏，Questions / Homework / Summary & Recap。 -->
      <el-tab-pane v-if="activeGroup === 'summary'" :label="t('notes.tabHomework')" name="homework">
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
    <el-empty
      v-if="activeGroup === 'practice' && !grammarImages.length && visibleContentBlocks.length === 0"
      :description="t('notes.noPractice')"
      :image-size="100"
      class="lesson-notes-empty"
    />
  </ElDialog>
  <FloatingAnswerPanel
    :visible="!!questionImage"
    :title="questionImage?.title || ''"
    placement="left"
    @update:visible="onQuestionImageVisibility"
  >
    <img v-if="questionImage" :src="questionImage.src" :alt="questionImage.title" class="grammar-answer-image" />
  </FloatingAnswerPanel>
  <FloatingAnswerPanel
    :visible="grammarAnswerVisible"
    :title="`Lesson ${lessonNumber} · ${t('notes.cambridgeAnswers')}`"
    @update:visible="grammarAnswerVisible = $event"
  >
    <div class="grammar-answer-images">
      <img
        v-for="(src, i) in grammarAnswerImages"
        :key="src"
        :src="src"
        :alt="`Lesson ${lessonNumber} · ${t('notes.cambridgeAnswers')} ${i + 1}`"
        class="grammar-answer-image"
      />
    </div>
  </FloatingAnswerPanel>
  <FloatingAnswerPanel
    :visible="cambridgeAnswerVisible"
    :title="`Unit ${selectedCambridgeUnit} · ${t('notes.cambridgeAnswers')}`"
    @update:visible="cambridgeAnswerVisible = $event"
  >
    <div class="cambridge-answer-crops">
      <svg
        v-for="(crop, i) in cambridgeAnswerCrops"
        :key="`${crop.page}-${i}`"
        :viewBox="`${crop.x} ${crop.y} ${crop.width} ${crop.height}`"
        :width="crop.width"
        :height="crop.height"
        :style="cambridgeCropStyle(crop)"
        role="img"
        :aria-label="`Unit ${crop.unit} · ${t('notes.cambridgeAnswers')} ${i + 1}`"
        class="cambridge-answer-crop"
      >
        <image :href="crop.src" width="908" height="1366" />
      </svg>
    </div>
  </FloatingAnswerPanel>
</template>

<style scoped>
.question-image-trigger {
  cursor: zoom-in;
}

.question-image-trigger:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

.exercise-answer-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.cambridge-study-page > img,
.grammar-study-page > img {
  display: block;
}

/* 语法答案使用稳定的未缩放宽度，避免浮窗尺寸反向影响内容测量。 */
.grammar-answer-images {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.grammar-answer-image {
  display: block;
  width: 436px;
  max-width: none;
  height: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

/* 剑桥答案多区域按相同比例横向排列。 */
.cambridge-answer-crops {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cambridge-answer-crop {
  display: block;
  flex: 0 0 auto;
  min-width: 0;
  height: auto;
  overflow: hidden;
  border: 2px solid #e53935;
  border-radius: 4px;
}

@media (max-width: 640px) {
  .grammar-answer-image {
    width: calc(100vw - 48px);
  }
}
</style>
