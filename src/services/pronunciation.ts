export type PronunciationWordStatus = "correct" | "close" | "wrong" | "missing" | "extra";

export interface PronunciationWordResult {
  expected: string | null;
  recognized: string | null;
  status: PronunciationWordStatus;
}

export interface PronunciationEvaluation {
  overall_score: number;
  completeness_score: number;
  fluency_score: number;
  transcription: string;
  word_results: PronunciationWordResult[];
  fluency: {
    words_per_minute: number;
    long_pauses: number;
    audio_duration_seconds: number;
  };
}

export class PronunciationApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PronunciationApiError";
  }
}

function isEvaluation(value: unknown): value is PronunciationEvaluation {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PronunciationEvaluation>;
  return Number.isFinite(result.overall_score)
    && Number.isFinite(result.completeness_score)
    && Number.isFinite(result.fluency_score)
    && typeof result.transcription === "string"
    && Array.isArray(result.word_results)
    && result.word_results.every(isWordResult)
    && !!result.fluency
    && Number.isFinite(result.fluency.words_per_minute)
    && Number.isFinite(result.fluency.long_pauses)
    && Number.isFinite(result.fluency.audio_duration_seconds);
}

function isWordResult(value: unknown): value is PronunciationWordResult {
  if (!value || typeof value !== "object") return false;
  const word = value as Partial<PronunciationWordResult>;
  return (word.expected === null || typeof word.expected === "string")
    && (word.recognized === null || typeof word.recognized === "string")
    && ["correct", "close", "wrong", "missing", "extra"].includes(word.status ?? "");
}

export async function evaluatePronunciation(
  audio: Blob,
  referenceText: string,
  signal?: AbortSignal
): Promise<PronunciationEvaluation> {
  const baseUrl = import.meta.env.VITE_PRONUNCIATION_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new PronunciationApiError("pronunciation.notConfigured");
  }

  try {
    const formData = new FormData();
    formData.append("audio", audio, "recording");
    formData.append("reference_text", referenceText);
    const response = await fetch(`${baseUrl}/api/pronunciation/eval`, {
      method: "POST",
      body: formData,
      signal
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      if (response.status === 413 || getErrorCode(payload) === "audio_too_large") {
        throw new PronunciationApiError("pronunciation.audioTooLarge", response.status);
      }
      if (response.status === 429 || getErrorCode(payload) === "quota_exceeded") {
        throw new PronunciationApiError("pronunciation.quotaExceeded", response.status);
      }
      if (response.status === 400) {
        throw new PronunciationApiError(getErrorCode(payload) === "invalid_reference"
          ? "pronunciation.invalidReference"
          : "pronunciation.invalidAudio", response.status);
      }
      if (response.status === 422 && getErrorCode(payload) === "no_speech") {
        throw new PronunciationApiError("pronunciation.noSpeech", response.status);
      }
      if (response.status === 504) {
        throw new PronunciationApiError("pronunciation.timeout", response.status);
      }
      throw new PronunciationApiError("pronunciation.networkError", response.status);
    }
    if (!isEvaluation(payload)) throw new PronunciationApiError("pronunciation.invalidResponse");
    return payload;
  } catch (error) {
    if (error instanceof PronunciationApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PronunciationApiError("pronunciation.networkError");
  }
}

function getErrorCode(value: unknown): string | undefined {
  return value && typeof value === "object" && "code" in value && typeof value.code === "string"
    ? value.code
    : undefined;
}
