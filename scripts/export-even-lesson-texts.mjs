// 导出所有偶数课原文到根目录 Markdown 文件。
// 数据来源：src/data/lessonTeacherOriginalLines.ts（已对照老师笔记校对）与 src/data/lessons.ts（课次标题）。
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const outFile = join(
  root,
  "New-Concept-English-Book-1-Even-Lessons-Texts.md",
);

function loadExportedJson(filePath, exportName) {
  const source = readFileSync(filePath, "utf8");
  const marker = new RegExp(`export const ${exportName}[^=]*=`);
  const match = source.match(marker);
  if (!match) throw new Error(`在 ${filePath} 中找不到 export const ${exportName}`);
  // 从 "=" 后第一个括号起做括号配对（跳过字符串字面量），取出完整结构体按 JSON 解析
  let start = source.indexOf("=", match.index) + 1;
  while (/\s/.test(source[start])) start += 1;
  const open = source[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error(`在 ${filePath} 中未能定位 ${exportName} 的完整结构体`);
}

const originalLines = loadExportedJson(
  join(root, "src/data/lessonTeacherOriginalLines.ts"),
  "lessonTeacherOriginalLines",
);
// 偶数课标题来自 writtenExercises.ts（该文件键名无引号，不能按 JSON 解析，用正则提取）。
const writtenSource = readFileSync(
  join(root, "src/data/writtenExercises.ts"),
  "utf8",
);
const titleByNumber = new Map();
for (const [, number, title] of writtenSource.matchAll(
  /^ {4}number: (\d+),\n {4}title: "(.*)",$/gm,
)) {
  titleByNumber.set(Number(number), title);
}
const numbers = Object.keys(originalLines).map(Number).sort((a, b) => a - b);

const parts = [
  "> Original work: New Concept English Book 1 by L. G. Alexander. The even-numbered lesson texts below were extracted from the user's local teacher-notes images (OCR) and proofread line by line against those notes. This structured extract is intended for personal study only and is not a substitute for the original work. All rights remain with the author and relevant rights holders. Please obtain and support the original work through authorized channels.",
  "",
  "# Even-Numbered Lesson Texts",
  "",
  `> Coverage: all ${numbers.length} even-numbered lessons from Lesson ${numbers[0]} through Lesson ${numbers[numbers.length - 1]}. Lines prefixed with "T:" / "S:" mark teacher / student speakers in the pattern drills.`,
  "",
];

for (const number of numbers) {
  const title = titleByNumber.get(number) ?? "";
  parts.push(`## Lesson ${number} · ${title}`, "");
  for (const line of originalLines[number]) {
    parts.push(line);
  }
  parts.push("");
}

writeFileSync(outFile, parts.join("\n") + "\n", "utf8");
console.log(`已导出 ${numbers.length} 课偶数课原文到 ${outFile}`);
