import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnglishVoices, speakEnglishSequence, stopSpeech } from "./speech";

class MockUtterance {
  lang = "";
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;

  constructor(readonly text: string) {}
}

afterEach(() => {
  stopSpeech();
  vi.unstubAllGlobals();
});

describe("speakEnglishSequence", () => {
  it("reports the character offset for each spoken word boundary", () => {
    const speak = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
      speak
    });
    const onWordStart = vi.fn();
    const segment = { text: "Excuse me!", itemId: "lesson-1-1" };

    speakEnglishSequence([segment], { voiceURI: "", rate: 0.82, volume: 1 }, { onWordStart });
    const utterance = speak.mock.calls[0][0] as MockUtterance;
    utterance.onstart?.();
    utterance.onboundary?.({ charIndex: 7, name: "word" } as SpeechSynthesisEvent);

    expect(onWordStart).toHaveBeenCalledWith(segment, 0, 7);
  });
});

describe("getEnglishVoices (非 Apple / Android 分支)", () => {
  function stubVoices(voices: SpeechSynthesisVoice[]) {
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => voices,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn()
    });
  }

  it("在 Android 上识别 Google TTS 英语音色（不依赖 Apple 音色名）", () => {
    const female = { name: "Google UK English Female", lang: "en-GB", voiceURI: "com.google.android.tts:eng-gbr-f00" } as SpeechSynthesisVoice;
    const us = { name: "Google US English", lang: "en-US", voiceURI: "com.google.android.tts:eng-usa" } as SpeechSynthesisVoice;
    stubVoices([female, us]);
    expect(getEnglishVoices().map((v) => v.name)).toEqual(["Google UK English Female", "Google US English"]);
  });

  it("无 Google 音色时回退到任意英语音色，避免语音列表为空", () => {
    const generic = { name: "English (United States)", lang: "en-US", voiceURI: "com.foo.tts:eng" } as SpeechSynthesisVoice;
    stubVoices([generic]);
    expect(getEnglishVoices().map((v) => v.name)).toEqual(["English (United States)"]);
  });

  it("非英语音色不进入列表", () => {
    const zh = { name: "Google 普通話", lang: "zh-CN", voiceURI: "com.google.android.tts:zho-cmn" } as SpeechSynthesisVoice;
    stubVoices([zh]);
    expect(getEnglishVoices()).toEqual([]);
  });
});
