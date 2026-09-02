import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "New-Concept-English-Book-1-Odd-Lessons-Texts-and-Reference-Translations.md");
const chineseSourcePath = resolve(root, "New-Concept-English-Book-1-Odd-Lessons-Chinese-Reference-Translations.md");
const targetPath = resolve(root, "src/data/lessons.ts");

const source = await readFile(sourcePath, "utf8");
const chineseSource = await readFile(chineseSourcePath, "utf8");
const lessonPattern = /^## Lesson (\d+) · (.+)$/gm;
const matches = [...source.matchAll(lessonPattern)];
const chineseLessonPattern = /^## Lesson (\d+)$/gm;
const chineseMatches = [...chineseSource.matchAll(chineseLessonPattern)];
const chineseBlocks = new Map(chineseMatches.map((match, index) => [
  Number(match[1]),
  chineseSource.slice(match.index, chineseMatches[index + 1]?.index ?? chineseSource.length)
]));
const lessons = [];
const reports = [];

for (let index = 0; index < matches.length; index += 1) {
  const current = matches[index];
  const next = matches[index + 1];
  const number = Number(current[1]);
  const title = current[2].trim();
  const block = source.slice(current.index, next?.index ?? source.length);
  const chineseBlock = chineseBlocks.get(number) ?? "";
  let english = block.match(/### English\s*\n([\s\S]*?)\n### Reference Translation/)?.[1].trim() ?? "";
  let referenceChinese = block.match(/### Reference Translation\s*\n([\s\S]*)$/)?.[1].trim() ?? "";
  const questionEn = english.match(/^\*\*Question:\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  const titleZh = chineseBlock.match(/^\*\*Title:\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  const questionZh = chineseBlock.match(/^\*\*Question:\*\*\s*(.+)$/m)?.[1].trim() ?? "";
  if (!questionEn || !titleZh || !questionZh) {
    throw new Error(`第 ${number} 课缺少英文问题、中文标题或中文问题`);
  }
  english = english.replace(/^\*\*Question:\*\*.*(?:\r?\n)?/gm, "").trim();
  let chinese = chineseBlock.replace(/^## Lesson \d+\s*/m, "").replace(/^\*\*(?:Title|Question):\*\*.*(?:\r?\n)?/gm, "").trim();
  referenceChinese = referenceChinese.replace(/^\*\*(?:Title|Question):\*\*.*(?:\r?\n)?/gm, "").trim();
  english = repairKnownOcrGaps(number, english);
  chinese = repairKnownChineseOcr(chinese);
  referenceChinese = repairKnownChineseOcr(referenceChinese);
  const englishTurns = collapseConsecutiveTurns(parseTurns(english));
  let chineseTurns = collapseConsecutiveTurns(normalizeChineseTurns(parseTurns(chinese)));
  const englishSentences = splitTurnsIntoSentences(englishTurns, splitEnglishSentences);
  let chineseSentences = splitTurnsIntoSentences(chineseTurns, splitChineseSentences);
  const referenceChineseTurns = collapseConsecutiveTurns(normalizeChineseTurns(parseTurns(referenceChinese)));
  const referenceChineseSentences = splitTurnsIntoSentences(referenceChineseTurns, splitChineseSentences);
  const usesReferenceText = referenceChineseSentences.length === chineseSentences.length;
  if (usesReferenceText) {
    chineseSentences = chineseSentences.map((sentence, sentenceIndex) => ({
      ...sentence,
      text: referenceChineseSentences[sentenceIndex].text
    }));
    chineseTurns = collapseConsecutiveTurns(chineseSentences.map(({ speaker, text }) => ({ speaker, text })));
  }
  const pairs = englishTurns.length === chineseTurns.length
    ? englishTurns.flatMap((turn, turnIndex) => alignSentencePairs(
        splitTurnsIntoSentences([turn], splitEnglishSentences),
        splitTurnsIntoSentences([chineseTurns[turnIndex]], splitChineseSentences)
      ))
    : alignSentencePairs(englishSentences, chineseSentences);

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
  reports.push({
    number,
    englishTurns: englishTurns.length,
    chineseTurns: chineseTurns.length,
    englishSentences: englishSentences.length,
    chineseSentences: chineseSentences.length,
    englishGroups: englishTurns.length,
    chineseGroups: chineseTurns.length,
    usesReferenceText,
    items: items.length
  });
}

const expectedNumbers = Array.from({ length: 72 }, (_, index) => index * 2 + 1);
const actualNumbers = lessons.map((lesson) => lesson.number);
const missingLessons = expectedNumbers.filter((number) => !actualNumbers.includes(number));
const emptyLessons = lessons.filter((lesson) => lesson.items.length === 0).map((lesson) => lesson.number);
const incompleteLessons = reports.filter((report) => report.items !== report.chineseSentences).map((report) => report.number);
const misalignedGroups = reports.filter((report) => report.englishGroups !== report.chineseGroups).map((report) => report.number);
const combinedPrompts = lessons.flatMap((lesson) => lesson.items.filter((item) => splitChineseSentences(item.prompt).length > 1).map((item) => item.id));
const allItems = lessons.flatMap((lesson) => lesson.items);
const duplicateIds = allItems.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
const invalidItems = allItems.filter((item) => !item.prompt.trim() || !item.answer.trim()).map((item) => item.id);
if (missingLessons.length || emptyLessons.length || incompleteLessons.length || misalignedGroups.length || combinedPrompts.length || duplicateIds.length || invalidItems.length) {
  for (const report of reports.filter((item) => item.englishSentences !== item.chineseSentences)) {
    console.error(`第 ${report.number} 课：英文 ${report.englishSentences} 句，中文 ${report.chineseSentences} 句，生成 ${report.items} 题。`);
  }
  throw new Error([
    missingLessons.length ? `缺少课程：${missingLessons.join("、")}` : "",
    emptyLessons.length ? `空课程：${emptyLessons.join("、")}` : "",
    incompleteLessons.length ? `句子未完整生成：${incompleteLessons.join("、")}` : "",
    misalignedGroups.length ? `说话段未对齐：${misalignedGroups.join("、")}` : "",
    combinedPrompts.length ? `仍含多句中文：${combinedPrompts.slice(0, 20).join("、")}` : "",
    duplicateIds.length ? `重复 ID：${duplicateIds.slice(0, 20).join("、")}` : "",
    invalidItems.length ? `空题目或答案：${invalidItems.slice(0, 20).join("、")}` : ""
  ].filter(Boolean).join("；"));
}

const output = `import type { Lesson } from "../types/practice";\n\n// 由 scripts/generate-lessons.mjs 根据本地 Markdown 学习资料生成，请勿手工修改。\nexport const lessons: Lesson[] = ${JSON.stringify(lessons, null, 2)};\n`;
await writeFile(targetPath, output, "utf8");

console.log(`已生成 ${lessons.length} 课、${lessons.reduce((sum, lesson) => sum + lesson.items.length, 0)} 道单句练习。`);
const referenceTextCount = reports.filter((item) => item.usesReferenceText).length;
console.log(`全量校验通过；${referenceTextCount} 课已结合课文参考译文校正文案，其余按中文单句逐条对齐。`);
const structuredOnlyLessons = reports.filter((item) => !item.usesReferenceText).map((item) => item.number);
if (structuredOnlyLessons.length) console.log(`仅使用分句版中文的课程：${structuredOnlyLessons.join("、")}。`);

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

function normalizeChineseTurns(turns) {
  let lastSpeaker = "";
  return turns.flatMap((turn) => {
    if (!turn.text.replace(/[“”"'\s]/g, "")) return [];
    let speaker = turn.speaker;
    let text = turn.text;
    if (/^你听/.test(speaker)) {
      text = `${speaker}：${text}`;
      speaker = lastSpeaker;
    }
    if (speaker) lastSpeaker = speaker;
    return [{ speaker, text }];
  });
}

function collapseConsecutiveTurns(turns) {
  return turns.reduce((result, turn) => {
    const previous = result.at(-1);
    if (previous && previous.speaker === turn.speaker) {
      previous.text = `${previous.text} ${turn.text}`.trim();
    } else {
      result.push({ ...turn });
    }
    return result;
  }, []);
}

function isSpeakerPrefix(value) {
  const prefix = value.trim();
  if (!prefix || prefix.length > 32) return false;
  if (/^[A-Z0-9 .'-]+$/.test(prefix)) return true;
  return /^[\u3400-\u9fff\d·•・.\s]+$/.test(prefix);
}

function splitTurnsIntoSentences(turns, splitter) {
  return turns.flatMap((turn) => splitter(turn.text).map((segment) => typeof segment === "string"
    ? { speaker: turn.speaker, text: segment, startsSentence: true, endsSentence: true }
    : { speaker: turn.speaker, ...segment }
  ));
}

function alignSentencePairs(left, right, maxEnglishGroup = 12) {
  if (left.length === right.length) {
    return left.map((turn, index) => ({ english: turn, chinese: right[index] }));
  }
  const leftScale = averageLength(right) / Math.max(averageLength(left), 1);
  const memo = new Map();

  function solve(i, j) {
    const key = `${i}:${j}`;
    if (memo.has(key)) return memo.get(key);
    if (i === left.length && j === right.length) return { score: 0, pairs: [] };
    if (i === left.length || j === right.length) return { score: Number.POSITIVE_INFINITY, pairs: [] };

    let best = { score: Number.POSITIVE_INFINITY, pairs: [] };
    for (let leftCount = 1; leftCount <= maxEnglishGroup && i + leftCount <= left.length; leftCount += 1) {
      const leftGroup = mergeTurns(left.slice(i, i + leftCount));
      const rightGroup = right[j];
      const rest = solve(i + leftCount, j + 1);
      const lengthCost = Math.abs(leftGroup.text.length * leftScale - rightGroup.text.length) / Math.max(rightGroup.text.length, 12);
      const speakerCost = leftGroup.speaker.includes(" / ") ? 4 : 0;
      const boundaryCost = (leftGroup.startsSentence ? 0 : 4) + (leftGroup.endsSentence ? 0 : 4);
      const groupingCost = (leftCount - 1) * 0.05;
      const score = lengthCost + speakerCost + boundaryCost + groupingCost + rest.score;
      if (score < best.score) {
        best = { score, pairs: [{ english: leftGroup, chinese: rightGroup }, ...rest.pairs] };
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
    text: turns.map((turn) => turn.text).join(" "),
    startsSentence: turns[0]?.startsSentence ?? true,
    endsSentence: turns.at(-1)?.endsSentence ?? true
  };
}

function splitEnglishSentences(value) {
  const normalized = value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  return [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(normalized)]
    .flatMap((item) => {
      const clauses = (item.segment.match(/[^,;:]+(?:[,;:]+|$)/g) ?? [item.segment]).map((clause) => clause.trim()).filter(Boolean);
      return clauses.map((text, index) => ({
        text,
        startsSentence: index === 0,
        endsSentence: index === clauses.length - 1
      }));
    });
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
  return value.replace(/肉肉商/g, "肉商").replace(/\s+/g, " ").trim();
}

function cleanChinese(value) {
  return value
    .replace(/[“”」]/g, "")
    .replace(/^[.，。；：]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEnglish(value) {
  return value
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^\.\s*/, "")
    .trim();
}

function repairKnownOcrGaps(number, value) {
  if (number === 15) {
    return value.replace(/CUSTOMS OFFiCER/g, "CUSTOMS OFFICER");
  }
  if (number === 75) {
    return value.replace(/No\. she bought/, "No. She bought");
  }
  if (number === 89) {
    return value.replace(/IAN\s*：\s*\nNIGEL/, "IAN : £68,500.\nNIGEL");
  }
  if (number === 113) {
    return value.replace(/^([I1-4](?:st|nd|rd|th)) (PASSENGER|TRAMP)\s*:/gm, (_, ordinal, role) => {
      const normalizedOrdinal = ordinal.replace(/^I/, "1").toUpperCase();
      return `${normalizedOrdinal} ${role} :`;
    });
  }
  if (number === 141) {
    return value
      .replace(/·\s*After/, "After")
      .replace(/\*To make myself beautiful, the lady answered\./, "'To make myself beautiful,' the lady answered.\nShe put away her compact and smiled kindly.");
  }
  return value;
}

function repairKnownChineseOcr(value) {
  return value
    .replace(/米旅游/g, "来旅游")
    .replace(/怎么川事/g, "怎么回事")
    .replace(/进米吧/g, "进来吧")
    .replace(/没行/g, "没有")
    .replace(/我的乍/g, "我的车")
    .replace(/时间罚不短/g, "时间可不短")
    .replace(/明天卜个/g, "明天下午")
    .replace(/乌什小姐/g, "马什小姐")
    .replace(/得间一下/g, "得问一下")
    .replace(/从米/g, "从来")
    .replace(/在楼上：。/g, "在楼上。");
}
