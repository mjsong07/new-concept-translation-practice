import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MobileSettings from "./MobileSettings.vue";

const global = {
  stubs: {
    "el-dialog": { template: "<div><slot /><slot name='header' /></div>" },
    "el-button": { template: "<button><slot /></button>" },
    "el-icon": { template: "<i><slot /></i>" },
    "el-progress": true,
    "el-segmented": true,
    "el-select": true,
    "el-option": true,
    "el-slider": true,
    "el-switch": true
  }
};

function mountSettings() {
  return mount(MobileSettings, {
    props: {
      lessons: [{ number: 1, title: "Excuse me!", titleZh: "对不起！", questionZh: "", questionEn: "", items: [], notes: "" }],
      lessonNumber: 1,
      lessonTitle: "Excuse me!",
      lessonCompleted: 0,
      lessonCount: 3,
      lessonPercent: 0,
      colorScheme: "system",
      voiceUri: "",
      speechRate: 0.82,
      speechVolume: 1,
      voices: [],
      characterMatchPercent: 50,
      autoAdvanceErrors: true
    },
    global
  });
}

describe("MobileSettings reset", () => {
  it("closes settings before requesting a lesson reset", async () => {
    const wrapper = mountSettings();
    const viewModel = wrapper.vm as unknown as { visible: boolean };

    await wrapper.find(".mobile-nav-button.is-settings").trigger("click");
    expect(viewModel.visible).toBe(true);

    await wrapper.find(".mobile-reset-button").trigger("click");

    expect(wrapper.emitted("reset")).toEqual([[]]);
    expect(viewModel.visible).toBe(false);
  });
});
