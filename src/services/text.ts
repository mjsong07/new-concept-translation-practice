import { translate } from "../composables/useI18n";
import type { AnswerDiffPart, AnswerFeedback, AppLocale } from "../types/practice";

function normalizeBase(value: string) {
  const result = value
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/\b([a-z]+)n't\b/g, "$1 not")
    .replace(/\b([a-z]+)'m\b/g, "$1 am")
    .replace(/\b([a-z]+)'re\b/g, "$1 are")
    .replace(/\b([a-z]+)'ve\b/g, "$1 have")
    .replace(/\b([a-z]+)'ll\b/g, "$1 will");
  return result
    // 判题只比较单词与数字：中英文引号、感叹号等所有符号均等价并忽略。
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandAmbiguousContractions(value: string) {
  const source = String(value || "").toLowerCase().replace(/[’‘`]/g, "'");
  let variants = [source];
  const rules: Array<[RegExp, string[]]> = [
    [/\b([a-z0-9]+)'s\b/, ["$1 is", "$1 has"]],
    [/\b([a-z0-9]+)'d\b/, ["$1 would", "$1 had"]]
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

export function evaluateAnswer(input: string, answer: string, locale: AppLocale = "zh-CN"): AnswerFeedback {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
  const actualVariants = expandAmbiguousContractions(input);
  const expectedVariants = expandAmbiguousContractions(answer);
  const actual = actualVariants[0] || "";
  const expected = expectedVariants[0] || "";
  if (!actual) {
    return {
      level: "idle", title: t("feedback.idleTitle"), message: t("feedback.idleMessage"), similarity: 0,
      missing: [], extra: [], referenceParts: [], explanation: t("feedback.idleExplanation")
    };
  }
  if (actualVariants.some((variant) => expectedVariants.includes(variant))) {
    return {
      level: "correct", title: t("feedback.correctTitle"), message: t("feedback.correctMessage"), similarity: 1,
      missing: [], extra: [], referenceParts: buildReferenceParts(answer, input), explanation: t("feedback.correctExplanation")
    };
  }

  const actualWords = actual.split(" ");
  const expectedWords = expected.split(" ");
  const distance = levenshtein(actualWords, expectedWords);
  const similarity = Math.max(0, 1 - distance / Math.max(actualWords.length, expectedWords.length, 1));
  const missing = subtractWords(expectedWords, actualWords);
  const extra = subtractWords(actualWords, expectedWords);
  const referenceParts = buildReferenceParts(answer, input);
  const explanation = explainDifference(missing, extra, locale);
  if (similarity >= 0.78) {
    return {
      level: "close",
      title: t("feedback.closeTitle"),
      message: missing.length ? t("feedback.closeMissing") : t("feedback.closeOrder"),
      similarity,
      missing,
      extra,
      referenceParts,
      explanation
    };
  }
  return {
    level: "wrong", title: t("feedback.wrongTitle"), message: t("feedback.wrongMessage"),
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

export function explainDifference(missing: string[], extra: string[], locale: AppLocale = "zh-CN") {
  const t = (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
  const issues: string[] = [];
  if (missing.length) issues.push(t("feedback.missing", { words: summarizeWords(missing, locale) }));
  if (extra.length) issues.push(t("feedback.extra", { words: summarizeWords(extra, locale) }));
  if (!missing.length && !extra.length) issues.push(t("feedback.order"));
  return issues.join(locale === "en" ? "; " : "；") || t("feedback.fallback");
}

function summarizeWords(words: string[], locale: AppLocale) {
  const uniqueWords = [...new Set(words)];
  const visible = uniqueWords.slice(0, 5);
  const hiddenCount = uniqueWords.length - visible.length;
  if (hiddenCount > 0) visible.push(`+${hiddenCount}`);
  return visible.join(locale === "en" ? ", " : "、");
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
