import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, reactive, ref } from "vue";
import WrittenExercise from "./WrittenExercise.vue";
import { writtenExercises } from "../data/writtenExercises";
import { evaluateAnswer } from "../services/text";
import type { AnswerFeedback } from "../types/practice";

const lesson66 = writtenExercises.find((lesson) => lesson.number === 66)!;
const lesson8 = writtenExercises.find((lesson) => lesson.number === 8)!;
const lesson16 = writtenExercises.find((lesson) => lesson.number === 16)!;

const baseProps = {
  lessonNumber: lesson66.number,
  lessonTitle: lesson66.title,
  lessonTitleZh: lesson66.titleZh,
  sections: lesson66.sections || [],
  items: lesson66.items,
  answers: {},
  results: {},
  completedIds: [],
  displayMode: "translation" as const,
  mistakeHistory: [],
  autoAdvanceErrors: false,
  characterMatchPercent: 50,
  speechActive: false,
  speechPaused: false,
  activeSpeechItemId: "",
  activeSpeechCharacterOffset: -1,
  activeWordId: ""
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
  return mount(WrittenExercise, { attachTo: document.body, props: { ...baseProps, ...props }, global });
}

describe("WrittenExercise sections and inline blanks", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    document.body.innerHTML = "";
  });

  it("renders sections A and B with numbering restarting inside each section", () => {
    const wrapper = mountExercise();
    const sections = wrapper.findAll(".written-section");

    expect(sections).toHaveLength(2);
    expect(sections[0].find(".written-section-badge").text()).toBe("A");
    expect(sections[1].find(".written-section-badge").text()).toBe("B");
    expect(sections[0].find(".written-section-title-en").text()).toContain("Complete these sentences");
    expect(sections[0].findAll(".sentence-number").map((node) => node.text())).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(sections[1].findAll(".sentence-number").map((node) => node.text())).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"
    ]);
  });

  it("shows the example block before the input rows in section B", () => {
    const wrapper = mountExercise();
    const sectionB = wrapper.findAll(".written-section")[1];
    const example = sectionB.find(".written-example");

    expect(example.exists()).toBe(true);
    expect(example.find(".written-example-prompt").text()).toBe("When must you come home? (1.00)");
    expect(example.find(".written-example-answer").text()).toBe("I must come home at one o'clock.");
    expect(sectionB.find(".written-example").element.compareDocumentPosition(sectionB.find(".sentence-row").element))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders multi-blank fill items as inline inputs without a separate answer row", () => {
    const wrapper = mountExercise();
    const sectionA = wrapper.findAll(".written-section")[0];
    const rows = sectionA.findAll(".sentence-row");
    const multiBlankRow = rows[2];

    expect(multiBlankRow.findAll("textarea")).toHaveLength(2);
    expect(multiBlankRow.findAll("textarea").map((node) => node.attributes("data-blank-index"))).toEqual(["0", "1"]);
    expect(multiBlankRow.findAll("textarea")[0].attributes("style")).toContain("calc(4ch + 8px)");
    expect(rows[0].findAll("textarea")).toHaveLength(1);
    expect(rows[0].findAll("textarea")[0].attributes("style")).toContain("calc(2ch + 8px)");
    expect(multiBlankRow.find(".sentence-answer-row").exists()).toBe(false);
    expect(rows[0].find(".sentence-answer-row").exists()).toBe(false);
    expect(rows[0].find(".row-action-button").exists()).toBe(false);
  });

  it("emits a comma-joined answer when typing into each blank", async () => {
    const answers = reactive<Record<string, string>>({});
    const wrapper = mountExercise({
      answers,
      "onUpdate:answer": (id: string, value: string) => { answers[id] = value; }
    });
    const multiBlankRow = wrapper.findAll(".written-section")[0].findAll(".sentence-row")[2];
    const blanks = multiBlankRow.findAll("textarea");

    await blanks[0].setValue("from");
    await blanks[1].setValue("from");
    await flushPromises();

    expect(wrapper.emitted("update:answer")).toEqual([
      ["lesson-66-A3", "from"],
      ["lesson-66-A3", "from, from"]
    ]);
  });

  it("hides the reference comparison for a correct fill row but keeps it for a wrong one", () => {
    const itemById = new Map(lesson66.items.map((item) => [item.id, item]));
    const answers = { "lesson-66-A1": "at", "lesson-66-A2": "on" };
    const results = Object.fromEntries(
      Object.entries(answers).map(([id, input]) => [id, evaluateAnswer(input, itemById.get(id)!.answer, "zh-CN", 0.5)])
    );
    const wrapper = mountExercise({ answers, results });
    const rows = wrapper.findAll(".written-section")[0].findAll(".sentence-row");

    expect(rows[0].find(".answer-comparison").exists()).toBe(false);
    expect(rows[1].find(".answer-comparison").exists()).toBe(true);
  });

  it("speaks only the current row with its blanks filled in", async () => {
    const wrapper = mountExercise();
    const rows = wrapper.findAll(".written-section")[0].findAll(".sentence-row");

    await rows[0].find(".sentence-number").trigger("click");
    await rows[2].find(".sentence-number").trigger("click");

    expect(wrapper.emitted("speak")).toEqual([
      [[{ text: "I am going to see him at ten o'clock.", itemId: "lesson-66-A1", speaker: "A" }]],
      [[{ text: "Where do you come from? I come from France.", itemId: "lesson-66-A3", speaker: "A" }]]
    ]);
  });

  it("stays on the current section after a correct last answer instead of switching tabs", async () => {
    const answers = reactive<Record<string, string>>({ "lesson-66-A6": "in, in" });
    const results = reactive<Record<string, AnswerFeedback>>({});
    const itemById = new Map(lesson66.items.map((item) => [item.id, item]));
    const wrapper = mountExercise({
      answers,
      results,
      onSubmit: (id: string) => { results[id] = evaluateAnswer(answers[id], itemById.get(id)!.answer, "zh-CN", 0.5); }
    });

    const lastRow = wrapper.findAll(".written-section")[0].findAll(".sentence-row")[5];
    await lastRow.findAll("textarea")[1].trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(document.activeElement).not.toBe(wrapper.findAll(".written-section")[1].find("textarea").element);
    expect(wrapper.emitted("submit")).toEqual([["lesson-66-A6"]]);
  });

  it("renders pipe-joined examples as adjacent question-answer pairs", () => {
    const wrapper = mountExercise({
      sections: [
        {
          key: "C",
          titleEn: "Answer these questions.",
          titleZh: "模仿例句回答以下问题。",
          examplePrompt: "Hasn't anyone opened the window yet? | Hasn't anyone opened the windows yet?",
          exampleAnswer: "It hasn't been opened yet. It will be opened tomorrow. | They haven't been opened yet. They will be opened tomorrow."
        }
      ],
      items: [
        {
          id: "lesson-66-C1",
          lesson: 66,
          lessonTitle: lesson66.title,
          kind: "sentence",
          mode: "sentence",
          section: "C",
          speakerZh: "",
          speakerEn: "C",
          prompt: "Hasn't anyone aired this room yet?",
          answer: "It hasn't been aired yet. It will be aired tomorrow."
        }
      ]
    });

    const pairs = wrapper.findAll(".written-example-pair");
    expect(pairs).toHaveLength(2);
    expect(pairs[0].find(".written-example-prompt").text()).toBe("Hasn't anyone opened the window yet?");
    expect(pairs[0].find(".written-example-answer").text()).toBe("It hasn't been opened yet.\nIt will be opened tomorrow.");
    expect(pairs[1].find(".written-example-prompt").text()).toBe("Hasn't anyone opened the windows yet?");
    expect(pairs[1].find(".written-example-answer").text()).toBe("They haven't been opened yet.\nThey will be opened tomorrow.");
  });

  it("偶数课显示“原文”页签内容，且每行可点击发音", async () => {
    const wrapper = mountExercise({
      lessonNumber: lesson8.number,
      lessonTitle: lesson8.title,
      lessonTitleZh: lesson8.titleZh,
      sections: lesson8.sections || [],
      items: lesson8.items,
      displayMode: "original"
    });

    const lineRow = wrapper.find(".written-original .sentence-row");
    const lineButton = lineRow.find(".sentence-number");
    const lineTextNode = lineRow.find(".sentence-english");
    expect(lineRow.exists()).toBe(true);
    expect(lineButton.exists()).toBe(true);
    expect(lineTextNode.exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Words");
    expect(wrapper.text()).not.toContain("Grammar");

    const lineText = lineTextNode.text().trim();
    await lineButton.trigger("click");

    const speakEvents = wrapper.emitted("speak");
    expect(speakEvents?.length).toBe(1);
    const segment = speakEvents?.[0]?.[0]?.[0] as { text: string; itemId: string; speaker: string };
    expect(segment.text).toBe(lineText);
    expect(segment.itemId).toBe("lesson-8-original-0");
    expect(segment.speaker).toBe("ORIGINAL");
  });

  it("偶数课的译文+原文与原文分别呈现整课视图", () => {
    const bilingualWrapper = mountExercise({
      lessonNumber: lesson8.number,
      lessonTitle: lesson8.title,
      lessonTitleZh: lesson8.titleZh,
      sections: lesson8.sections || [],
      items: lesson8.items,
      displayMode: "bilingual"
    });
    const originalWrapper = mountExercise({
      lessonNumber: lesson8.number,
      lessonTitle: lesson8.title,
      lessonTitleZh: lesson8.titleZh,
      sections: lesson8.sections || [],
      items: lesson8.items,
      displayMode: "original"
    });

    expect(originalWrapper.find(".written-original").exists()).toBe(true);
    expect(bilingualWrapper.find(".bilingual-list").exists()).toBe(true);
  });

  it("偶数课译文页支持全文发音", async () => {
    const wrapper = mountExercise();
    const fullTextButton = wrapper.findAll("button").find((node) => node.text() === "全文");

    expect(fullTextButton).toBeTruthy();
    await fullTextButton!.trigger("click");

    const speakEvents = wrapper.emitted("speak");
    expect(speakEvents?.length).toBe(1);
    const segments = speakEvents?.[0]?.[0] as { text: string; itemId: string; speaker: string }[];
    expect(segments.length).toBe(lesson66.items.length);
    expect(segments[0]).toEqual({ text: "I am going to see him at ten o'clock.", itemId: "lesson-66-A1", speaker: "A" });
    expect(segments[2]).toEqual({ text: "Where do you come from? I come from France.", itemId: "lesson-66-A3", speaker: "A" });
  });

  it("偶数课原文会清理 OCR：去掉 S/T 前缀、Qur->our、以及单词断裂空格", () => {
    const wrapper = mountExercise({
      lessonNumber: lesson16.number,
      lessonTitle: lesson16.title,
      lessonTitleZh: lesson16.titleZh,
      sections: lesson16.sections || [],
      items: lesson16.items,
      displayMode: "original"
    });

    const lines = wrapper.findAll(".written-original .sentence-english").map((node) => node.text().trim());
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line) => /^\s*[ST]\s*:/i.test(line))).toBe(false);
    expect(lines.some((line) => /\bQur\b/.test(line))).toBe(false);
    expect(lines.some((line) => /\bbl\s+ue\b/i.test(line))).toBe(false);
    expect(lines).toContain("our tickets are not white.");
  });
});
