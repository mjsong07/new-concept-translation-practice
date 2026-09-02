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
  const unsupportedWords = input.match(/[\u3400-\u9fff]+/g) || [];
  if (!input.trim()) {
    return {
      level: "idle", title: t("feedback.idleTitle"), message: t("feedback.idleMessage"), similarity: 0,
      missing: [], extra: [], referenceParts: [], inputParts: [], firstErrorOffset: 0, explanation: t("feedback.idleExplanation")
    };
  }
  if (!unsupportedWords.length && actualVariants.some((variant) => expectedVariants.includes(variant))) {
    return {
      level: "correct", title: t("feedback.correctTitle"), message: t("feedback.correctMessage"), similarity: 1,
      missing: [], extra: [], ...buildDiffParts(answer, input), explanation: t("feedback.correctExplanation")
    };
  }

  const actualWords = actual.split(" ").filter(Boolean);
  const expectedWords = expected.split(" ").filter(Boolean);
  const distance = levenshtein(actualWords, expectedWords);
  const similarity = Math.max(0, 1 - distance / Math.max(actualWords.length, expectedWords.length, 1));
  const missing = subtractWords(expectedWords, actualWords);
  const extra = [...subtractWords(actualWords, expectedWords), ...unsupportedWords];
  const diff = buildDiffParts(answer, input);
  const explanation = explainDifference(missing, extra, locale);
  if (similarity >= 0.78) {
    return {
      level: "close",
      title: t("feedback.closeTitle"),
      message: missing.length ? t("feedback.closeMissing") : t("feedback.closeOrder"),
      similarity,
      missing,
      extra,
      ...diff,
      explanation
    };
  }
  return {
    level: "wrong", title: t("feedback.wrongTitle"), message: t("feedback.wrongMessage"),
    similarity, missing, extra, ...diff, explanation
  };
}

function buildDiffParts(answer: string, input: string) {
  const expected = tokenizeDisplay(answer);
  const actual = tokenizeDisplay(input);
  const expectedComponents = expected.words.flatMap((word, wordIndex) => word.normalizedParts.map((value) => ({ value, wordIndex })));
  const actualComponents = actual.words.flatMap((word, wordIndex) => word.normalizedParts.map((value) => ({ value, wordIndex })));
  const operations = alignWords(expectedComponents.map((item) => item.value), actualComponents.map((item) => item.value));
  const wrongExpectedWords = new Set<number>();
  const wrongActualWords = new Set<number>();
  const placeholdersBeforeWord = new Map<number, number>();
  let firstErrorOffset = input.length;

  operations.forEach((operation, operationIndex) => {
    if (operation.type === "equal") return;
    if (operation.expectedIndex !== undefined) wrongExpectedWords.add(expectedComponents[operation.expectedIndex].wordIndex);
    if (operation.actualIndex !== undefined) {
      const actualWordIndex = actualComponents[operation.actualIndex].wordIndex;
      wrongActualWords.add(actualWordIndex);
      firstErrorOffset = Math.min(firstErrorOffset, actual.words[actualWordIndex].start);
    }
    if (operation.type === "delete") {
      const nextActualOperation = operations.slice(operationIndex + 1).find((item) => item.actualIndex !== undefined);
      const nextWordIndex = nextActualOperation?.actualIndex === undefined
        ? actual.words.length
        : actualComponents[nextActualOperation.actualIndex].wordIndex;
      placeholdersBeforeWord.set(nextWordIndex, (placeholdersBeforeWord.get(nextWordIndex) || 0) + 1);
      firstErrorOffset = Math.min(firstErrorOffset, actual.words[nextWordIndex]?.start ?? input.length);
    }
  });

  const referenceState = new Map(expected.words.map((word, wordIndex) => [word.tokenIndex, wrongExpectedWords.has(wordIndex) ? "wrong" as const : "correct" as const]));
  const inputState = new Map(actual.words.map((word, wordIndex) => [word.tokenIndex, wrongActualWords.has(wordIndex) ? "wrong" as const : "correct" as const]));
  const inputParts: AnswerDiffPart[] = [];
  const unsupportedOffset = input.search(/[\u3400-\u9fff]/);
  if (unsupportedOffset >= 0) firstErrorOffset = Math.min(firstErrorOffset, unsupportedOffset);
  actual.tokens.forEach((text, tokenIndex) => {
    const wordIndex = actual.wordIndexByToken.get(tokenIndex);
    if (wordIndex !== undefined && placeholdersBeforeWord.has(wordIndex)) {
      inputParts.push({ text: `${Array(placeholdersBeforeWord.get(wordIndex) || 0).fill("xx").join(" ")} `, state: "wrong", placeholder: true });
    }
    inputParts.push({ text, state: inputState.get(tokenIndex) || (/[\u3400-\u9fff]/.test(text) ? "wrong" : "neutral") });
  });
  if (placeholdersBeforeWord.has(actual.words.length)) {
    inputParts.push({ text: `${input.trim() ? " " : ""}${Array(placeholdersBeforeWord.get(actual.words.length) || 0).fill("xx").join(" ")}`, state: "wrong", placeholder: true });
  }

  return {
    referenceParts: expected.tokens.map((text, tokenIndex): AnswerDiffPart => ({ text, state: referenceState.get(tokenIndex) || "neutral" })),
    inputParts,
    firstErrorOffset: Number.isFinite(firstErrorOffset) ? firstErrorOffset : 0
  };
}

function tokenizeDisplay(value: string) {
  const tokens = value.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?|\s+|[^A-Za-z0-9\s]+/g) || [];
  let offset = 0;
  const words: Array<{ tokenIndex: number; normalizedParts: string[]; start: number }> = [];
  const wordIndexByToken = new Map<number, number>();
  tokens.forEach((text, tokenIndex) => {
    const normalizedParts = normalizeText(text).split(" ").filter(Boolean);
    if (normalizedParts.length) {
      wordIndexByToken.set(tokenIndex, words.length);
      words.push({ tokenIndex, normalizedParts, start: offset });
    }
    offset += text.length;
  });
  return { tokens, words, wordIndexByToken };
}

function alignWords(expected: string[], actual: string[]) {
  const rows = Array.from({ length: expected.length + 1 }, () => Array(actual.length + 1).fill(0));
  for (let i = 0; i <= expected.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= actual.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= expected.length; i += 1) {
    for (let j = 1; j <= actual.length; j += 1) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1));
    }
  }
  const operations: Array<{ type: "equal" | "replace" | "delete" | "insert"; expectedIndex?: number; actualIndex?: number }> = [];
  let i = expected.length;
  let j = actual.length;
  while (i || j) {
    if (i && j && rows[i][j] === rows[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1)) {
      operations.push({ type: expected[i - 1] === actual[j - 1] ? "equal" : "replace", expectedIndex: i - 1, actualIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i && rows[i][j] === rows[i - 1][j] + 1) {
      operations.push({ type: "delete", expectedIndex: i - 1 });
      i -= 1;
    } else {
      operations.push({ type: "insert", actualIndex: j - 1 });
      j -= 1;
    }
  }
  return operations.reverse();
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
