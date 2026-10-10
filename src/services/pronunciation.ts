import { Client, handle_file } from "@gradio/client";

export type PronunciationAccent = "en-US" | "en-GB";
export type PronunciationWordStatus = "correct" | "close" | "wrong" | "missing" | "extra";

export interface PronunciationWordResult {
  expected: string | null;
  recognized: string | null;
  status: PronunciationWordStatus;
  pronunciation_score?: number;
  phonemes?: { expected: string; heard: string }[];
}

export interface PronunciationEvaluation {
  overall_score: number;
  pronunciation_score: number;
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

let connectedClient: { url: string; promise: Promise<Client> } | undefined;

async function getClient(url: string): Promise<Client> {
  if (connectedClient?.url === url) return connectedClient.promise;
  const connection = { url, promise: Client.connect(url) };
  connectedClient = connection;
  try {
    return await connection.promise;
  } catch (error) {
    if (connectedClient === connection) connectedClient = undefined;
    throw error;
  }
}

function isEvaluation(value: unknown): value is PronunciationEvaluation {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<PronunciationEvaluation>;
  return Number.isFinite(result.overall_score)
    && Number.isFinite(result.pronunciation_score)
    && Number.isFinite(result.completeness_score)
    && Number.isFinite(result.fluency_score)
    && typeof result.transcription === "string"
    && Array.isArray(result.word_results)
    && !!result.fluency
    && Number.isFinite(result.fluency.words_per_minute)
    && Number.isFinite(result.fluency.long_pauses)
    && Number.isFinite(result.fluency.audio_duration_seconds);
}

export async function evaluatePronunciation(
  audio: Blob,
  referenceText: string,
  accent: PronunciationAccent
): Promise<PronunciationEvaluation> {
  const baseUrl = import.meta.env.VITE_PRONUNCIATION_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new PronunciationApiError("pronunciation.notConfigured");
  }

  try {
    const client = await getClient(baseUrl);
    const response = await client.predict("/evaluate_pronunciation", [
      handle_file(audio),
      referenceText,
      accent
    ]);
    if (!Array.isArray(response.data)) {
      throw new PronunciationApiError("pronunciation.invalidResponse");
    }
    const payload: unknown = response.data[0];
    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      if (/queue|quota|daily limit/i.test(payload.error)) {
        throw new PronunciationApiError("pronunciation.quotaOrQueue");
      }
      throw new PronunciationApiError(payload.error, 503);
    }
    if (!isEvaluation(payload)) throw new PronunciationApiError("pronunciation.invalidResponse");
    return payload;
  } catch (error) {
    if (error instanceof PronunciationApiError) throw error;
    if (error instanceof Error && /queue|quota|daily limit/i.test(error.message)) {
      throw new PronunciationApiError("pronunciation.quotaOrQueue");
    }
    throw new PronunciationApiError("pronunciation.networkError");
  }
}
