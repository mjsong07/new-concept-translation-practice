import type { AnswerFeedback } from "../types/practice";

const contractionRules: Array<[RegExp, string]> = [
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\baren't\b/g, "are not"],
  [/\bisn't\b/g, "is not"],
  [/\bwasn't\b/g, "was not"],
  [/\bweren't\b/g, "were not"],
  [/\bhaven't\b/g, "have not"],
  [/\bhasn't\b/g, "has not"],
  [/\bhadn't\b/g, "had not"],
  [/\bdidn't\b/g, "did not"],
  [/\bdoesn't\b/g, "does not"],
  [/\bdon't\b/g, "do not"],
  [/\bi'm\b/g, "i am"],
  [/\byou're\b/g, "you are"],
  [/\bwe're\b/g, "we are"],
  [/\bthey're\b/g, "they are"],
  [/\bhe's\b/g, "he is"],
  [/\bshe's\b/g, "she is"],
  [/\bit's\b/g, "it is"],
  [/\bthat's\b/g, "that is"],
  [/\bthere's\b/g, "there is"],
  [/\bi've\b/g, "i have"],
  [/\byou've\b/g, "you have"],
  [/\bwe've\b/g, "we have"],
  [/\bthey've\b/g, "they have"],
  [/\bi'll\b/g, "i will"],
  [/\byou'll\b/g, "you will"],
  [/\bwe'll\b/g, "we will"],
  [/\bthey'll\b/g, "they will"],
  [/\bi'd\b/g, "i would"],
  [/\byou'd\b/g, "you would"]
];

export function normalizeText(value: string) {
  let result = String(value || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/£/g, " pounds ");
  for (const [pattern, replacement] of contractionRules) result = result.replace(pattern, replacement);
  return result
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\b(?:pounds)\s+([0-9])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateAnswer(input: string, answer: string): AnswerFeedback {
  const actual = normalizeText(input);
  const expected = normalizeText(answer);
  if (!actual) {
    return { level: "idle", title: "先写下你的译文", message: "输入英文后再检查答案。", similarity: 0, missing: [], extra: [] };
  }
  if (actual === expected) {
    return { level: "correct", title: "完全正确", message: "大小写、标点和缩写形式不会影响判定。", similarity: 1, missing: [], extra: [] };
  }

  const actualWords = actual.split(" ");
  const expectedWords = expected.split(" ");
  const distance = levenshtein(actualWords, expectedWords);
  const similarity = Math.max(0, 1 - distance / Math.max(actualWords.length, expectedWords.length, 1));
  const missing = subtractWords(expectedWords, actualWords);
  const extra = subtractWords(actualWords, expectedWords);
  if (similarity >= 0.78) {
    return {
      level: "close",
      title: "很接近了",
      message: missing.length ? "检查遗漏的词、时态或语序。" : "单词基本齐全，再检查一下语序。",
      similarity,
      missing,
      extra
    };
  }
  return { level: "wrong", title: "还需要调整", message: "对照参考答案，先找主语、谓语，再补充其余成分。", similarity, missing, extra };
}

function levenshtein(left: string[], right: string[]) {
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
  }
  return rows[left.length][right.length];
}

function subtractWords(source: string[], comparison: string[]) {
  const counts = new Map<string, number>();
  comparison.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return source.filter((word) => {
    const count = counts.get(word) || 0;
    if (count > 0) {
      counts.set(word, count - 1);
      return false;
    }
    return true;
  });
}
