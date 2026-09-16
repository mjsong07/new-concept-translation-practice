import { afterEach, describe, expect, it, vi } from "vitest";
import { speakEnglishSequence, stopSpeech } from "./speech";

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
