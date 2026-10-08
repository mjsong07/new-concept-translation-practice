import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const assetsRoot = join(root, "src/assets/teacher-notes");
const outFile = join(root, "src/data/lessonTeacherOriginalLines.ts");

const playExamplesLine = /play\s+the\s+ex\w*\s+on\s+the\s+tape/i;
const nowYouAnswerLine = /now\s+you\s+answer\s+the\s+questions?.*ready\??/i;
const asInLine = /^\d+\s*as\s+in\s*\(\d+\)\s*above\.?$/i;

function normalizeLine(line) {
  return line
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s*([?.!,:;])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(raw) {
  let line = raw
    .replace(/^[*•]+\s*/, "")
    .replace(/^\(\d+\)\s*T\s*[:：]\s*/i, "T: ")
    .replace(/^\d+\s*T\s*[:：]\s*/i, "T: ")
    .replace(/^\d+\s*S\s*[:：]\s*/i, "S: ")
    .replace(/^S\$\s*[:：]\s*/i, "S: ")
    .replace(/^\(\d+\)\s*S\s*[:：]\s*/i, "S: ")
    .replace(/^T\s*[:：]\s*/i, "T: ")
    .replace(/^S\s*[:：]\s*/i, "S: ")
    .replace(/^\d+\s*[:：]\s*Number\b/i, "T: Number")
    .replace(/^\d+\s*[:：]\s*Nunber\b/i, "T: Number")
    .replace(/^\d+\s*[:：]\s*W\w*\b/i, "T: Whose")
    .replace(/\bj\s+ob\b/gi, "job")
    .replace(/\bnunber\b/gi, "number")
    .replace(/\bwaat\b/gi, "what")
    .replace(/\s*\|\s*/g, "l");

  line = normalizeLine(line);
  if (!line) return "";
  if (playExamplesLine.test(line)) return "";
  if (nowYouAnswerLine.test(line)) return "";
  if (asInLine.test(line)) return "";
  if (/^\d+\s*as\s+in\s*\(\d+\)/i.test(line)) return "";
  if (/^[#\p{Script=Han}]+$/u.test(line)) return "";
  if (/^\(b\)/i.test(line)) return "";
  return line;
}

function splitSentences(line) {
  if (!line) return [];
  const speaker = line.match(/^(T:|S:)\s*/i)?.[0] || "";
  const body = speaker ? line.slice(speaker.length) : line;
  const rawParts = body
    .split(/(?<=[?.!])\s+(?=[A-Z(])/)
    .map((part) => normalizeLine(part))
    .filter(Boolean);

  if (!rawParts.length) return [];
  if (!speaker) return rawParts;
  return rawParts.map((part, index) => (index === 0 ? `${speaker}${part}` : part));
}

function runOcr(filePath) {
  return execFileSync("tesseract", [filePath, "stdout", "--psm", "6"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function lessonDirs() {
  return readdirSync(assetsRoot)
    .filter((name) => /^\d+$/.test(name))
    .map((name) => Number(name))
    .sort((a, b) => a - b);
}

const result = {};

for (const lesson of lessonDirs()) {
  const dir = join(assetsRoot, String(lesson));
  if (!statSync(dir).isDirectory()) continue;
  const pages = readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0));

  const sentences = [];
  for (const page of pages) {
    const text = runOcr(join(dir, page));
    const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
    for (const line of lines) {
      const parts = splitSentences(line);
      for (const part of parts) {
        if (!part) continue;
        if (nowYouAnswerLine.test(part)) continue;
        if (asInLine.test(part)) continue;
        sentences.push(part);
      }
    }
  }

  const deduped = [];
  for (const line of sentences) {
    const prev = deduped[deduped.length - 1];
    if (line === prev) continue;
    deduped.push(line);
  }

  result[lesson] = deduped;
}

const generatedAt = new Date().toISOString();
const fileText = `// 由 scripts/extract-teacher-original-lines.mjs 自动生成，请勿手工修改。\n// 数据来源：src/assets/teacher-notes/<课号>/page-*.png（Tesseract OCR）\n// 生成时间：${generatedAt}\nexport const lessonTeacherOriginalLines: Record<number, string[]> = ${JSON.stringify(result, null, 2)};\n`;

writeFileSync(outFile, fileText, "utf8");
console.log(`Wrote ${outFile}`);
