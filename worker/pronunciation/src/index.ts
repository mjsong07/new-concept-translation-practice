interface WorkersAI {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface Env {
  AI: WorkersAI;
  ALLOWED_ORIGINS: string;
}

interface WordResult {
  expected: string | null;
  recognized: string | null;
  status: "correct" | "wrong" | "missing" | "extra";
}

interface TimedWord {
  start: number;
  end: number;
}

const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_REFERENCE_CHARS = 500;
const MIN_PAUSE_SECONDS = 0.6;

function jsonResponse(body: unknown, status: number, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?|[0-9]+/g) ?? [];
}

function alignWords(expected: string[], actual: string[]): WordResult[] {
  const columns = actual.length + 1;
  const costs = new Uint16Array((expected.length + 1) * columns);
  for (let i = 0; i <= expected.length; i++) costs[i * columns] = i;
  for (let j = 0; j <= actual.length; j++) costs[j] = j;

  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= actual.length; j++) {
      const diagonal = costs[(i - 1) * columns + j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1);
      const deletion = costs[(i - 1) * columns + j] + 1;
      const insertion = costs[i * columns + j - 1] + 1;
      costs[i * columns + j] = Math.min(diagonal, deletion, insertion);
    }
  }

  const rows: WordResult[] = [];
  let i = expected.length;
  let j = actual.length;
  while (i > 0 || j > 0) {
    const current = costs[i * columns + j];
    if (i > 0 && j > 0) {
      const isMatch = expected[i - 1] === actual[j - 1];
      if (current === costs[(i - 1) * columns + j - 1] + (isMatch ? 0 : 1)) {
        rows.push({
          expected: expected[i - 1],
          recognized: actual[j - 1],
          status: isMatch ? "correct" : "wrong"
        });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && current === costs[(i - 1) * columns + j] + 1) {
      rows.push({ expected: expected[i - 1], recognized: null, status: "missing" });
      i--;
    } else {
      rows.push({ expected: null, recognized: actual[j - 1], status: "extra" });
      j--;
    }
  }
  return rows.reverse();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function timedWordsFrom(segments: unknown): TimedWord[] {
  if (!Array.isArray(segments)) return [];
  const words: TimedWord[] = [];
  for (const segment of segments) {
    if (!isRecord(segment)) continue;
    if (Array.isArray(segment.words)) {
      for (const word of segment.words) {
        if (!isRecord(word) || typeof word.start !== "number" || typeof word.end !== "number") continue;
        words.push({ start: word.start, end: word.end });
      }
    } else if (typeof segment.start === "number" && typeof segment.end === "number") {
      words.push({ start: segment.start, end: segment.end });
    }
  }
  return words.sort((left, right) => left.start - right.start);
}

function scoreFluency(
  recognizedWordCount: number,
  totalDuration: number,
  speechDuration: number,
  timedWords: TimedWord[]
) {
  const pauses = timedWords.reduce((count, word, index) => {
    if (index === 0) return count;
    return count + (word.start - timedWords[index - 1].end >= MIN_PAUSE_SECONDS ? 1 : 0);
  }, 0);
  const wordsPerMinute = Math.round(recognizedWordCount / Math.max(speechDuration, 1) * 60);
  const rateScore = Math.max(0, 100 - Math.abs(wordsPerMinute - 120) * 0.5);
  const silenceRatio = Math.max(0, totalDuration - speechDuration) / Math.max(totalDuration, 1);
  const pauseScore = Math.max(0, 100 - pauses * 12 - silenceRatio * 45);
  return {
    score: Math.round(rateScore * 0.55 + pauseScore * 0.45),
    words_per_minute: wordsPerMinute,
    long_pauses: pauses,
    audio_duration_seconds: Math.round(totalDuration * 100) / 100
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function evaluate(request: Request, env: Env, origin?: string): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ code: "invalid_audio" }, 400, origin);
  }
  const audio = form.get("audio");
  const referenceText = form.get("reference_text");
  if (!(audio instanceof File) || audio.size === 0) {
    return jsonResponse({ code: "invalid_audio" }, 400, origin);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonResponse({ code: "audio_too_large" }, 413, origin);
  }
  if (typeof referenceText !== "string" || referenceText.trim().length === 0
    || referenceText.length > MAX_REFERENCE_CHARS || tokenize(referenceText).length === 0) {
    return jsonResponse({ code: "invalid_reference" }, 400, origin);
  }

  let transcription: unknown;
  try {
    const audioBytes = new Uint8Array(await audio.arrayBuffer());
    transcription = await env.AI.run(MODEL, {
      audio: bytesToBase64(audioBytes),
      task: "transcribe",
      language: "english",
      vad_filter: true,
      condition_on_previous_text: false
    });
  } catch (error) {
    const details = error instanceof Error
      ? [error.name, error.message, ...Object.getOwnPropertyNames(error)
        .filter((name) => name !== "stack")
        .map((name) => `${name}=${String(Reflect.get(error, name))}`)]
        .filter(Boolean)
        .join(" ")
      : String(error);
    console.error("Workers AI Whisper request failed.", details.slice(0, 500));
    const quotaExceeded = /quota|neurons|free tier|daily limit|rate.?limit|429|billing plan/i.test(details);
    return jsonResponse(
      { code: quotaExceeded ? "quota_exceeded" : "transcription_failed" },
      quotaExceeded ? 429 : 502,
      origin
    );
  }

  if (!isRecord(transcription) || typeof transcription.text !== "string") {
    return jsonResponse({ code: "invalid_transcription" }, 502, origin);
  }
  const recognized = tokenize(transcription.text);
  if (!recognized.length) return jsonResponse({ code: "no_speech" }, 422, origin);

  const info = isRecord(transcription.transcription_info) ? transcription.transcription_info : {};
  const lastTimedWord = timedWordsFrom(transcription.segments);
  const segmentEnd = Array.isArray(transcription.segments)
    ? transcription.segments.reduce((end: number, segment) =>
      isRecord(segment) && typeof segment.end === "number" ? Math.max(end, segment.end) : end, 0)
    : 0;
  const totalDuration = typeof info.duration === "number" && info.duration > 0
    ? info.duration
    : segmentEnd;
  const speechDuration = typeof info.duration_after_vad === "number" && info.duration_after_vad > 0
    ? Math.min(info.duration_after_vad, totalDuration || info.duration_after_vad)
    : lastTimedWord.length
      ? lastTimedWord.reduce((sum, word) => sum + Math.max(0, word.end - word.start), 0)
      : totalDuration;
  if (!totalDuration || !speechDuration) {
    return jsonResponse({ code: "invalid_transcription" }, 502, origin);
  }

  const expected = tokenize(referenceText);
  const wordResults = alignWords(expected, recognized);
  const completeness = Math.round(
    wordResults.filter((word) => word.expected !== null && word.recognized !== null).length
    / expected.length * 100
  );
  const fluency = scoreFluency(recognized.length, totalDuration, speechDuration, lastTimedWord);
  return jsonResponse({
    overall_score: Math.round(completeness * 0.7 + fluency.score * 0.3),
    completeness_score: completeness,
    fluency_score: fluency.score,
    transcription: transcription.text,
    word_results: wordResults,
    fluency
  }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? undefined;
    const allowedOrigins = new Set(env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean));
    if (origin && !allowedOrigins.has(origin)) {
      return jsonResponse({ code: "origin_not_allowed" }, 403);
    }
    if (request.method === "OPTIONS") {
      return jsonResponse(null, 204, origin);
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ status: "ok", model: MODEL }, 200, origin);
    }
    if (request.method === "POST" && url.pathname === "/api/pronunciation/eval") {
      return evaluate(request, env, origin);
    }
    return jsonResponse({ code: "not_found" }, 404, origin);
  }
};
