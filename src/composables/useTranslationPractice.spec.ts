import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useTranslationPractice } from "./useTranslationPractice";

describe("useTranslationPractice mistake history", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
  });

  it("merges consecutive mistakes for the same item and uses latest time", () => {
    const practice = useTranslationPractice(ref(50));

    practice.updateAnswer("lesson-1-1", "Excuse you!");
    practice.submit("lesson-1-1");
    vi.advanceTimersByTime(1000);
    practice.updateAnswer("lesson-1-1", "Excuse him!");
    practice.submit("lesson-1-1");

    const history = practice.lessonMistakeHistory.value;
    expect(history).toHaveLength(1);
    expect(history[0].input).toBe("Excuse him!");
    expect(history[0].createdAt).toBe(Date.parse("2026-09-10T10:00:01Z"));
  });

  it("starts a new mistake record after the same item becomes correct", () => {
    const practice = useTranslationPractice(ref(50));

    practice.updateAnswer("lesson-1-1", "Excuse you!");
    practice.submit("lesson-1-1");
    vi.advanceTimersByTime(1000);
    practice.updateAnswer("lesson-1-1", "Excuse me!");
    practice.submit("lesson-1-1");
    vi.advanceTimersByTime(1000);
    practice.updateAnswer("lesson-1-1", "Excuse him!");
    practice.submit("lesson-1-1");

    const history = practice.lessonMistakeHistory.value;
    expect(history).toHaveLength(2);
    expect(history[0].input).toBe("Excuse him!");
    expect(history[1].input).toBe("Excuse you!");
  });
});
