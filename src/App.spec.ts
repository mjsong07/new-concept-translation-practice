import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";
import type { SpeechSegment } from "./types/practice";

type SpeechCallbacks = {
  onStart?: () => void;
  onSegmentStart?: (segment: SpeechSegment, index: number) => void;
  onEnd?: () => void;
};

const speakEnglishSequence = vi.fn();

vi.mock("./services/speech", () => ({
  getEnglishVoices: () => [],
  speakEnglish: (text: string, settings: unknown, callbacks?: SpeechCallbacks) => speakEnglishSequence([{ text }], settings, callbacks),
  speakEnglishSequence: (...args: [SpeechSegment[], unknown, SpeechCallbacks]) => speakEnglishSequence(...args),
  stopSpeech: vi.fn(),
  toggleSpeechPause: vi.fn((shouldPause: boolean) => shouldPause)
}));

const global = {
  stubs: {
    "el-config-provider": { template: "<div><slot /></div>" },
    PracticeControls: true,
    MobileSettings: true,
    TranslationExercise: true,
    "el-empty": true,
    "el-button": { template: "<button><slot /></button>" },
    "el-icon": { template: "<i><slot /></i>" }
  }
};

describe("App speech behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    speakEnglishSequence.mockReset();
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    window.speechSynthesis = {
      getVoices: () => [],
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      speaking: false,
      paused: false
    } as unknown as SpeechSynthesis;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  });

  it("keeps the last spoken line highlighted while continuation is pending", async () => {
    const wrapper = mount(App, { global });
    let callbacks: SpeechCallbacks = {};
    speakEnglishSequence.mockImplementation((_segments: SpeechSegment[], _settings: unknown, options?: SpeechCallbacks) => {
      callbacks = options || {};
    });

    await wrapper.vm.speak([{ text: "Excuse me!", itemId: "lesson-1-1" }, { text: "Yes?", itemId: "lesson-1-2" }], true);
    callbacks.onSegmentStart?.({ text: "Excuse me!", itemId: "lesson-1-1" }, 0);
    callbacks.onEnd?.();

    expect(wrapper.vm.activeSpeechItemId).toBe("lesson-1-1");
    expect(wrapper.vm.speechContinuationReady).toBe(true);
  });

  it("previews speech settings while main speech is paused", async () => {
    const wrapper = mount(App, { global });
    wrapper.vm.speechActive = true;
    wrapper.vm.speechPaused = true;

    wrapper.vm.speechRate = 1.1;
    await vi.advanceTimersByTimeAsync(300);

    expect(speakEnglishSequence).toHaveBeenCalledTimes(1);
    expect(speakEnglishSequence.mock.calls[0][0]).toEqual([{
      text: "This is a preview of the current voice, speed and volume."
    }]);
  });

  it("does not preview speech settings while main speech is actively playing", async () => {
    const wrapper = mount(App, { global });
    wrapper.vm.speechActive = true;
    wrapper.vm.speechPaused = false;

    wrapper.vm.speechRate = 1.1;
    await vi.advanceTimersByTimeAsync(300);

    expect(speakEnglishSequence).not.toHaveBeenCalled();
  });
});
