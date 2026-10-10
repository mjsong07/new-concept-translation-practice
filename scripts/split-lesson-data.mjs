// 将单文件课程数据拆分为按课懒加载的 payload（src/data/lesson-payloads/<课号>.ts），
// 并生成首屏摘要（src/data/lessonSummaries.ts）与教师原文词表（src/data/teacherWordLexicon.ts）。
//
// 源数据文件（lessons.ts / writtenExercises.ts / lessonTeacherTranslations.ts /
// lessonTeacherOriginalLines.ts / lessonContent.ts）仍是唯一数据源，由各生成脚本维护。
// 重新生成源数据后必须重跑本脚本：pnpm sync:lesson-data（已挂在 predev/prebuild/pretest 上）。
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(root, "src/data");
const outDir = resolve(dataDir, "lesson-payloads");

const { lessons } = await import(resolve(dataDir, "lessons.ts"));
const { writtenExercises } = await import(resolve(dataDir, "writtenExercises.ts"));
const { getLessonTeacherTranslationPairs } = await import(resolve(dataDir, "lessonTeacherTranslations.ts"));
const { lessonTeacherOriginalLines } = await import(resolve(dataDir, "lessonTeacherOriginalLines.ts"));
const { lessonContent } = await import(resolve(dataDir, "lessonContent.ts"));

/** JSON 序列化并转义行分隔符，保证生成的 .ts 可安全解析。 */
function serialize(value) {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const header = "// 本文件由 scripts/split-lesson-data.mjs 生成，请勿手工修改；源数据变更后请重跑 pnpm sync:lesson-data。\n";

const summaries = [];
const lessonNumbers = new Set();

for (const lesson of [...lessons, ...writtenExercises]) {
  if (lessonNumbers.has(lesson.number)) throw new Error(`第 ${lesson.number} 课数据重复`);
  lessonNumbers.add(lesson.number);

  const payload = {
    items: lesson.items,
    questionEn: lesson.questionEn,
    questionZh: lesson.questionZh
  };
  const pairs = getLessonTeacherTranslationPairs(lesson.number);
  if (pairs.length) payload.teacherTranslationPairs = pairs;
  const originalLines = lessonTeacherOriginalLines[lesson.number];
  if (originalLines?.length) payload.teacherOriginalLines = originalLines;
  const content = lessonContent[lesson.number];
  if (content?.length) payload.content = content;

  const body = `${header}import type { LessonPayload } from "../../types/practice";\n\nconst payload: LessonPayload = ${serialize(payload)};\n\nexport default payload;\n`;
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, `${lesson.number}.ts`), body, "utf8");

  const summary = {
    number: lesson.number,
    title: lesson.title,
    titleZh: lesson.titleZh,
    kind: lesson.kind ?? "translation"
  };
  if (lesson.sections?.length) summary.sections = lesson.sections;
  summaries.push(summary);
}

summaries.sort((a, b) => a.number - b.number);
await writeFile(
  resolve(dataDir, "lessonSummaries.ts"),
  `${header}import type { LessonSummary } from "../types/practice";\n\nexport const lessonSummaries: LessonSummary[] = ${serialize(summaries)};\n`,
  "utf8"
);

// 教师原文词表：与 WrittenExercise.vue 的 buildTeacherWordLexicon 逻辑保持一致，
// 拆分到此处是为了让组件不再全量引入 lessonTeacherOriginalLines。
const speakerPrefixPattern = /^\s*(?:(?:\d+|[A-Z]{1,3})\s+)*(?:T|S)\s*[:：]\s*/i;
const baseWords = ["our", "blue", "colour", "blouse", "blouses", "yellow", "black", "brown", "grey", "green", "orange", "white"];
const lexicon = new Set(baseWords);
const normalizeOriginalLine = (line) => line
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\s+/g, " ")
  .replace(/\s*([?.!,:;])\s*/g, "$1 ")
  .replace(/\s+/g, " ")
  .trim();
for (const lines of Object.values(lessonTeacherOriginalLines)) {
  for (const line of lines) {
    const normalized = normalizeOriginalLine(line)
      .replace(/\bQur\b/gi, "our")
      .replace(speakerPrefixPattern, "");
    for (const word of normalized.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) {
      lexicon.add(word);
    }
  }
}
await writeFile(
  resolve(dataDir, "teacherWordLexicon.ts"),
  `${header}// 词表逻辑须与 WrittenExercise.vue 中 OCR 断词合并（mergeSplitWords）保持一致。\nexport const teacherWordLexicon: string[] = ${serialize([...lexicon].sort())};\n`,
  "utf8"
);

const leftovers = (await readdir(outDir)).filter((name) => !lessonNumbers.has(Number(name.replace(/\.ts$/, ""))));
for (const name of leftovers) await rm(resolve(outDir, name));

console.log(`已生成 ${lessonNumbers.size} 个课程 payload、课程摘要与教师词表。`);
