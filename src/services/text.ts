import type { AnswerDiffPart, AnswerFeedback } from "../types/practice";

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
  [/\bi'll\b/g, "i will"],
  [/\byou'll\b/g, "you will"],
  [/\bwe'll\b/g, "we will"],
  [/\bthey'll\b/g, "they will"],
  [/\bi'd\b/g, "i would"],
  [/\byou'd\b/g, "you would"]
];

function normalizeBase(value: string) {
  let result = value
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

function expandAmbiguousContractions(value: string) {
  const source = String(value || "").toLowerCase().replace(/[’‘`]/g, "'");
  let variants = [source];
  const rules: Array<[RegExp, string[]]> = [
    [/\b([a-z0-9]+)'s\b/, ["$1 is", "$1 has"]],
    [/\b([a-z0-9]+)'ve\b/, ["$1 have"]]
  ];
  for (const [pattern, replacements] of rules) {
    let pending = variants;
    variants = [];
    while (pending.length) {
      const current = pending.shift()!;
      if (!pattern.test(current)) {
        variants.push(current);
        continue;
      }
      pattern.lastIndex = 0;
      replacements.forEach((replacement) => pending.push(current.replace(pattern, replacement)));
    }
  }
  return [...new Set(variants.map(normalizeBase))];
}

export function normalizeText(value: string) {
  return expandAmbiguousContractions(value)[0] || "";
}

export function evaluateAnswer(input: string, answer: string): AnswerFeedback {
  const actualVariants = expandAmbiguousContractions(input);
  const expectedVariants = expandAmbiguousContractions(answer);
  const actual = actualVariants[0] || "";
  const expected = expectedVariants[0] || "";
  if (!actual) {
    return {
      level: "idle", title: "先写下你的译文", message: "输入英文后再检查答案。", similarity: 0,
      missing: [], extra: [], referenceParts: [], explanation: "请先输入英文译文。"
    };
  }
  if (actualVariants.some((variant) => expectedVariants.includes(variant))) {
    return {
      level: "correct", title: "完全正确", message: "大小写、标点和缩写形式不会影响判定。", similarity: 1,
      missing: [], extra: [], referenceParts: buildReferenceParts(answer, input), explanation: "单词、语序和语法均匹配。"
    };
  }

  const actualWords = actual.split(" ");
  const expectedWords = expected.split(" ");
  const distance = levenshtein(actualWords, expectedWords);
  const similarity = Math.max(0, 1 - distance / Math.max(actualWords.length, expectedWords.length, 1));
  const missing = subtractWords(expectedWords, actualWords);
  const extra = subtractWords(actualWords, expectedWords);
  const referenceParts = buildReferenceParts(answer, input);
  const explanation = explainDifference(missing, extra);
  if (similarity >= 0.78) {
    return {
      level: "close",
      title: "很接近了",
      message: missing.length ? "检查遗漏的词、时态或语序。" : "单词基本齐全，再检查一下语序。",
      similarity,
      missing,
      extra,
      referenceParts,
      explanation
    };
  }
  return {
    level: "wrong", title: "还需要调整", message: "对照参考答案，先找主语、谓语，再补充其余成分。",
    similarity, missing, extra, referenceParts, explanation
  };
}

function buildReferenceParts(answer: string, input: string): AnswerDiffPart[] {
  const displayTokens = answer.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?|\s+|[^A-Za-z0-9\s]+/g) || [];
  const expectedWords = displayTokens
    .map((text, tokenIndex) => ({ text, tokenIndex, normalizedParts: normalizeText(text).split(" ").filter(Boolean) }))
    .filter((token) => token.normalizedParts.length);
  const expectedComponents = expectedWords.flatMap((token, wordIndex) => token.normalizedParts.map((value) => ({ value, wordIndex })));
  const actualWords = normalizeText(input).split(" ").filter(Boolean);
  const matchedExpected = longestCommonWordIndexes(expectedComponents.map((token) => token.value), actualWords);
  const expectedStateByToken = new Map(expectedWords.map((token, wordIndex) => {
    const componentIndexes = expectedComponents
      .map((component, componentIndex) => component.wordIndex === wordIndex ? componentIndex : -1)
      .filter((componentIndex) => componentIndex >= 0);
    return [token.tokenIndex, componentIndexes.every((componentIndex) => matchedExpected.has(componentIndex)) ? "correct" as const : "wrong" as const];
  }));
  const parts: AnswerDiffPart[] = displayTokens.map((text, tokenIndex) => ({
    text,
    state: expectedStateByToken.get(tokenIndex) || "neutral"
  }));
  return parts;
}

function longestCommonWordIndexes(expected: string[], actual: string[]) {
  const rows = Array.from({ length: expected.length + 1 }, () => Array(actual.length + 1).fill(0));
  for (let i = 1; i <= expected.length; i += 1) {
    for (let j = 1; j <= actual.length; j += 1) {
      rows[i][j] = expected[i - 1] === actual[j - 1]
        ? rows[i - 1][j - 1] + 1
        : Math.max(rows[i - 1][j], rows[i][j - 1]);
    }
  }
  const matched = new Set<number>();
  let i = expected.length;
  let j = actual.length;
  while (i > 0 && j > 0) {
    if (expected[i - 1] === actual[j - 1]) {
      matched.add(i - 1);
      i -= 1;
      j -= 1;
    } else if (rows[i - 1][j] >= rows[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return matched;
}

function explainDifference(missing: string[], extra: string[]) {
  const issues: string[] = [];
  const articles = ["a", "an", "the"];
  const auxiliaries = ["am", "is", "are", "was", "were", "do", "does", "did", "have", "has", "had", "will", "would", "can", "could", "must"];
  const prepositions = ["in", "on", "at", "to", "for", "from", "with", "of", "about", "into", "over", "under"];
  const pronouns = ["i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"];
  const grammarWords = new Set([...articles, ...auxiliaries, ...prepositions, ...pronouns]);
  if (missing.some((word) => articles.includes(word))) issues.push("检查冠词 a、an 或 the");
  if (missing.some((word) => auxiliaries.includes(word))) {
    issues.push("检查系动词、助动词或时态");
  }
  if (missing.some((word) => prepositions.includes(word))) {
    issues.push("检查介词搭配");
  }
  if (missing.some((word) => pronouns.includes(word))) {
    issues.push("检查人称或代词");
  }
  const genericMissing = missing.filter((word) => !grammarWords.has(word));
  if (genericMissing.length) issues.push(`缺少或需要替换：${[...new Set(genericMissing)].join("、")}`);
  if (extra.length) issues.push(`输入中多余或不匹配：${[...new Set(extra)].join("、")}`);
  if (!missing.length && !extra.length) issues.push("单词基本正确，请检查语序");
  return issues.join("；") || "请对照红色单词检查用词和语法。";
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
