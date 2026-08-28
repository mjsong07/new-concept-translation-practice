import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "../output/新概念英语第一册-奇数课课文与参考译文.md");
const targetPath = resolve(root, "src/data/lessons.ts");

const source = await readFile(sourcePath, "utf8");
const lessonPattern = /^## Lesson (\d+) · (.+)$/gm;
const matches = [...source.matchAll(lessonPattern)];
const lessons = [];
const reports = [];

for (let index = 0; index < matches.length; index += 1) {
  const current = matches[index];
  const next = matches[index + 1];
  const number = Number(current[1]);
  const title = current[2].trim();
  const block = source.slice(current.index, next?.index ?? source.length);
  let english = block.match(/### English\s*\n([\s\S]*?)\n### 参考译文/)?.[1].trim() ?? "";
  let chinese = block.match(/### 参考译文\s*\n([\s\S]*)$/)?.[1].trim() ?? "";
  const questionEn = english.match(/^\*\*Question:\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  const titleZh = chinese.match(/^\*\*标题：\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  const questionZh = chinese.match(/^\*\*问题：\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  if (!questionEn || !titleZh || !questionZh) {
    throw new Error(`第 ${number} 课缺少英文问题、中文标题或中文问题`);
  }
  english = english.replace(/^\*\*Question:\*\*.*(?:\r?\n)?/gm, "").trim();
  chinese = chinese.replace(/^\*\*(?:标题|问题)：\*\*.*(?:\r?\n)?/gm, "").trim();
  english = repairKnownOcrGaps(number, english);
  const englishTurns = parseTurns(english);
  const chineseTurns = parseTurns(chinese);
  let pairs;

  if (englishTurns.some((turn) => turn.speaker)) {
    pairs = alignDialogue(englishTurns, chineseTurns);
  } else {
    pairs = alignNarrative(splitEnglishSentences(english), splitChineseSentences(chinese));
  }

  const items = pairs
    .filter((pair) => pair.english.text && pair.chinese.text)
    .map((pair, itemIndex) => ({
      id: `lesson-${number}-${itemIndex + 1}`,
      lesson: number,
      lessonTitle: title,
      speakerZh: cleanSpeaker(pair.chinese.speaker),
      speakerEn: cleanSpeaker(pair.english.speaker),
      prompt: cleanChinese(pair.chinese.text),
      answer: cleanEnglish(pair.english.text)
    }));

  lessons.push({ number, title, titleZh, questionEn, questionZh, items });
  reports.push({ number, englishTurns: englishTurns.length, chineseTurns: chineseTurns.length, items: items.length });
}

const output = `import type { Lesson } from "../types/practice";\n\n// 由 scripts/generate-lessons.mjs 根据本地 Markdown 学习资料生成，请勿手工修改。\nexport const lessons: Lesson[] = ${JSON.stringify(lessons, null, 2)};\n`;
await writeFile(targetPath, output, "utf8");

console.log(`已生成 ${lessons.length} 课、${lessons.reduce((sum, lesson) => sum + lesson.items.length, 0)} 道练习。`);
for (const report of reports.filter((item) => item.englishTurns !== item.chineseTurns)) {
  console.log(`第 ${report.number} 课：英文 ${report.englishTurns} 段，中文 ${report.chineseTurns} 段，生成 ${report.items} 题。`);
}

function parseTurns(value) {
  const turns = [];
  let current = null;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([^:：]{1,45})\s*[:：]\s*(.*)$/);
    if (match && isSpeakerPrefix(match[1])) {
      if (current?.text) turns.push(current);
      current = { speaker: match[1].trim(), text: match[2].trim() };
    } else if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else {
      turns.push({ speaker: "", text: line });
    }
  }
  if (current?.text) turns.push(current);
  return turns;
}

function isSpeakerPrefix(value) {
  const prefix = value.trim();
  if (!prefix || prefix.length > 32) return false;
  if (/^[A-Za-z0-9 .'-]+$/.test(prefix)) return true;
  return /^[\u3400-\u9fff\d]+$/.test(prefix);
}

function alignDialogue(englishTurns, chineseTurns) {
  const english = englishTurns.filter((turn) => turn.speaker);
  const chinese = chineseTurns.filter((turn) => turn.speaker);
  if (english.length === chinese.length) {
    return english.map((turn, index) => ({ english: turn, chinese: chinese[index] }));
  }
  return alignChunks(english, chinese);
}

function alignNarrative(englishSentences, chineseSentences) {
  const english = englishSentences.map((text) => ({ speaker: "", text }));
  const chinese = chineseSentences.map((text) => ({ speaker: "", text }));
  if (english.length === chinese.length) {
    return english.map((turn, index) => ({ english: turn, chinese: chinese[index] }));
  }
  return alignChunks(english, chinese, 4);
}

function alignChunks(left, right, maxGroup = 3) {
  const leftScale = averageLength(right) / Math.max(averageLength(left), 1);
  const memo = new Map();

  function solve(i, j) {
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    if (i === left.length && j === right.length) return { score: 0, pairs: [] };
    if (i === left.length || j === right.length) return { score: Number.POSITIVE_INFINITY, pairs: [] };

    let best = { score: Number.POSITIVE_INFINITY, pairs: [] };
    for (let leftCount = 1; leftCount <= maxGroup && i + leftCount <= left.length; leftCount += 1) {
      for (let rightCount = 1; rightCount <= maxGroup && j + rightCount <= right.length; rightCount += 1) {
        const leftGroup = mergeTurns(left.slice(i, i + leftCount));
        const rightGroup = mergeTurns(right.slice(j, j + rightCount));
        const rest = solve(i + leftCount, j + rightCount);
        const lengthCost = Math.abs(leftGroup.text.length * leftScale - rightGroup.text.length) / Math.max(rightGroup.text.length, 12);
        // 长度只用于解决确实存在的句段数差异，优先维持原文顺序的一一对应。
        const groupingCost = (leftCount + rightCount - 2) * 2.5;
        const score = lengthCost + groupingCost + rest.score;
        if (score < best.score) {
          best = { score, pairs: [{ english: leftGroup, chinese: rightGroup }, ...rest.pairs] };
        }
      }
    }
    memo.set(key, best);
    return best;
  }

  return solve(0, 0).pairs;
}

function mergeTurns(turns) {
  return {
    speaker: [...new Set(turns.map((turn) => turn.speaker).filter(Boolean))].join(" / "),
    text: turns.map((turn) => turn.text).join(" ")
  };
}

function splitEnglishSentences(value) {
  return (value.replace(/\s*\n\s*/g, " ").match(/[^.!?]+(?:[.!?]+[\"']?|$)/g) ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitChineseSentences(value) {
  return (value.replace(/\s*\n\s*/g, "").match(/[^。！？]+[。！？”’“']*|[^。！？]+$/g) ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
}

function averageLength(items) {
  if (!items.length) return 1;
  return items.reduce((sum, item) => sum + item.text.length, 0) / items.length;
}

function cleanSpeaker(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanChinese(value) {
  return value.replace(/[“”」]/g, "").replace(/\s+/g, " ").trim();
}

function cleanEnglish(value) {
  return value
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^\.\s*/, "")
    .trim();
}

function repairKnownOcrGaps(number, value) {
  if (number === 89) {
    return value.replace(/IAN\s*：\s*\nNIGEL/, "IAN : £68,500.\nNIGEL");
  }
  if (number === 119) {
    return value.replace(/^Do you like stories\?[\s\S]*?a year ago\.\s*/, "");
  }
  if (number === 141) {
    return value
      .replace(/·\s*After/, "After")
      .replace(/\*To make myself beautiful, the lady answered\./, "'To make myself beautiful,' the lady answered.\nShe put away her compact and smiled kindly.");
  }
  return value;
}
