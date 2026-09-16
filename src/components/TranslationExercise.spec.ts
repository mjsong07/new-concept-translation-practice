import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, reactive, ref } from "vue";
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
  activeSpeechCharacterOffset: -1,
  activeWordId: "",
  autoAdvanceErrors: true,
  characterMatchPercent: 50
};

const ElInputStub = {
  props: ["modelValue"],
  emits: ["update:modelValue", "keydown", "blur"],
  setup(props: { modelValue: string }, { emit, expose }: { emit: (event: string, value?: unknown) => void; expose: (instance: object) => void }) {
    const textarea = ref<HTMLTextAreaElement>();
    expose({
      focus: () => textarea.value?.focus(),
      get textarea() { return textarea.value; }
    });
    return () => h("textarea", {
      ref: textarea,
      value: props.modelValue,
      onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLTextAreaElement).value),
      onKeydown: (event: KeyboardEvent) => emit("keydown", event),
      onBlur: () => emit("blur")
    });
  }
};

const global = {
  stubs: {
    "el-tabs": { template: "<div><slot /></div>" },
    "el-tab-pane": { template: "<div><slot /></div>" },
    "el-button": { template: "<button><slot /></button>" },
    "el-icon": { template: "<i><slot /></i>" },
    "el-tooltip": { template: "<div><slot /><slot name='content' /></div>" },
    "el-dialog": { template: "<div><slot /></div>" },
    "el-empty": true,
    "el-input": ElInputStub
  }
};

function mountExercise(props = {}) {
  return mount(TranslationExercise, { attachTo: document.body, props: { ...baseProps, ...props }, global });
}

describe("TranslationExercise speech interaction", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
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

  it("shows an IPA tooltip after reading a clicked word", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ word: "me", tags: ["n", "pron:M IY1 "] }]
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mountExercise({ displayMode: "original" });

    await wrapper.find('[data-word-id="lesson-1-1:2"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("https://api.datamuse.com/words?sp=me&md=pr&max=1");
    expect(wrapper.find(".pronunciation-tooltip").text()).toBe("/miː/");
  });

  it("focuses the current input after clearing its row", async () => {
    const wrapper = mountExercise({ answers: { [item.id]: "Excuse me!" } });
    const clearAction = wrapper.find('button[aria-label="清空当前行"]');

    await clearAction.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("clear")).toEqual([[item.id]]);
    expect(document.activeElement).toBe(wrapper.find("textarea").element);
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

  it("keeps mistake history headers compact and places the summary last", () => {
    const wrapper = mountExercise({
      mistakeHistory: [
        { id: "h-1", itemId: item.id, lesson: 1, prompt: item.prompt, input: "Excuse you!", answer: item.answer, missing: ["me"], extra: ["you"], explanation: "", createdAt: 100 }
      ]
    });
    const group = wrapper.find(".mistake-line-group");

    expect(wrapper.find(".history-dialog-heading").exists()).toBe(false);
    expect(group.find(".mistake-line-prompt .history-redo-button").exists()).toBe(true);
    expect(Array.from(group.element.children).map((child) => child.className)).toEqual([
      "mistake-line-source",
      "mistake-attempt-list",
      "mistake-line-summary"
    ]);
  });

  it("underlines the word currently being spoken", () => {
    const wrapper = mountExercise({
      displayMode: "original",
      activeSpeechItemId: item.id,
      activeSpeechCharacterOffset: 7
    });

    expect(wrapper.find('[data-word-id="lesson-1-1:2"]').classes()).toContain("is-speaking-word");
  });

  it("does not select the next error when automatic error navigation is disabled", async () => {
    const answer = "This is a book.";
    const testItem: ExerciseItem = { ...item, answer };
    const answers = reactive<Record<string, string>>({ [item.id]: "This cat " });
    const results = reactive<Record<string, AnswerFeedback>>({});
    const wrapper = mountExercise({
      items: [testItem],
      answers,
      results,
      autoAdvanceErrors: false,
      "onUpdate:answer": (id: string, value: string) => { answers[id] = value; },
      onSubmit: (id: string) => { results[id] = evaluateAnswer(answers[id], answer, "zh-CN", 0.5); }
    });
    const input = wrapper.find("textarea");

    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();
    await input.setValue("This is cat ");
    await flushPromises();

    expect(input.element.selectionStart).toBe("This is cat ".length);
    expect(input.element.selectionEnd).toBe("This is cat ".length);
  });
});
