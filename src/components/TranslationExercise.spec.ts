import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import TranslationExercise from "./TranslationExercise.vue";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback, ExerciseItem } from "../types/practice";

const item: ExerciseItem = {
  id: "lesson-1-1",
  lesson: 1,
  lessonTitle: "Excuse me!",
  kind: "sentence",
  speakerZh: "",
  speakerEn: "",
  prompt: "对不起。",
  answer: "Excuse me!"
};

const baseProps = {
  lessonNumber: 1,
  lessonTitle: "Excuse me!",
  lessonTitleZh: "对不起！",
  items: [item],
  answers: {},
  results: {},
  completedIds: [],
  displayMode: "translation" as const,
  mistakeHistory: [],
  speechActive: false,
  speechPaused: false,
  activeSpeechItemId: "",
  activeWordId: "",
  characterMatchPercent: 50
};

const global = {
  stubs: {
    "el-tabs": { template: "<div><slot /></div>" },
    "el-tab-pane": { template: "<div><slot /></div>" },
    "el-button": { template: "<button><slot /></button>" },
    "el-icon": { template: "<i><slot /></i>" },
    "el-tooltip": { template: "<div><slot /><slot name='content' /></div>" },
    "el-dropdown": { template: "<div><slot /><slot name='dropdown' /></div>" },
    "el-dropdown-menu": { template: "<div><slot /></div>" },
    "el-dropdown-item": { template: "<div><slot /></div>" },
    "el-dialog": { template: "<div><slot /></div>" },
    "el-empty": true,
    "el-input": {
      props: ["modelValue"],
      emits: ["update:modelValue", "keydown", "blur"],
      template: "<textarea :value='modelValue' @input='$emit(\"update:modelValue\", $event.target.value)' @keydown='$emit(\"keydown\", $event)' @blur='$emit(\"blur\")' />"
    }
  }
};

function mountExercise(props = {}) {
  return mount(TranslationExercise, { props: { ...baseProps, ...props }, global });
}

describe("TranslationExercise speech interaction", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("reads the sentence after a fully correct submission", async () => {
    const results = reactive<Record<string, AnswerFeedback>>({});
    const wrapper = mountExercise({
      answers: { [item.id]: "Excuse me!" },
      results,
      onSubmit: (id: string) => { results[id] = evaluateAnswer("Excuse me!", item.answer, "zh-CN", 0.5); }
    });
    const input = wrapper.find("textarea");

    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.emitted("speak")).toEqual([[
      [{ text: "Excuse me!", itemId: item.id, speaker: "" }],
      false
    ]]);
  });

  it("does not read a sentence after an incorrect submission", async () => {
    const results = reactive<Record<string, AnswerFeedback>>({});
    const wrapper = mountExercise({
      answers: { [item.id]: "Excuse you!" },
      results,
      onSubmit: (id: string) => { results[id] = evaluateAnswer("Excuse you!", item.answer, "zh-CN", 0.5); }
    });
    const input = wrapper.find("textarea");

    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(wrapper.emitted("speak")).toBeUndefined();
  });

  it("reads a clicked non-input English word", async () => {
    const wrapper = mountExercise({ displayMode: "original" });

    await wrapper.find('[data-word-id="lesson-1-1:2"]').trigger("click");

    expect(wrapper.emitted("speak-word")).toEqual([["lesson-1-1:2", "me"]]);
  });

  it("does not validate the row when the row head is used for pronunciation while typing", async () => {
    const wrapper = mountExercise({ answers: { [item.id]: "Excuse" } });
    const input = wrapper.find("textarea");
    const rowHead = wrapper.find(".translation-list button.sentence-number");

    await input.setValue("Excuse me");
    await rowHead.trigger("pointerdown");
    await input.trigger("blur");
    await rowHead.trigger("click");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.emitted("speak")).toBeTruthy();
  });

  it("lists mistake history from the first sentence to the last", () => {
    const second: ExerciseItem = { ...item, id: "lesson-1-2", prompt: "谢谢。", answer: "Thank you." };
    const wrapper = mountExercise({
      items: [item, second],
      mistakeHistory: [
        { id: "h-2", itemId: second.id, lesson: 1, prompt: second.prompt, input: "Thanks", answer: second.answer, missing: ["you"], extra: ["Thanks"], explanation: "", createdAt: 200 },
        { id: "h-1", itemId: item.id, lesson: 1, prompt: item.prompt, input: "Excuse you!", answer: item.answer, missing: ["me"], extra: ["you"], explanation: "", createdAt: 100 }
      ]
    });

    expect(wrapper.findAll(".mistake-line-index").map((node) => node.text())).toEqual(["1", "2"]);
  });
});
