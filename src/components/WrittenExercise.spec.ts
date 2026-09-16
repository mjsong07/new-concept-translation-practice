import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, reactive, ref } from "vue";
import WrittenExercise from "./WrittenExercise.vue";
import { writtenExercises } from "../data/writtenExercises";

const lesson66 = writtenExercises.find((lesson) => lesson.number === 66)!;

const baseProps = {
  lessonNumber: lesson66.number,
  lessonTitle: lesson66.title,
  lessonTitleZh: lesson66.titleZh,
  sections: lesson66.sections || [],
  items: lesson66.items,
  answers: {},
  results: {},
  completedIds: [],
  mistakeHistory: [],
  autoAdvanceErrors: false,
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
    expect(multiBlankRow.find(".sentence-answer-row").exists()).toBe(false);
    expect(rows[0].findAll("textarea")).toHaveLength(1);
    expect(rows[0].find(".sentence-answer-row").exists()).toBe(false);
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
});
