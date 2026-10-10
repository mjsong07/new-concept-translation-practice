import { describe, it, expect, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import LessonNotesDialog from "./LessonNotesDialog.vue";

// 注册真实 Element Plus，验证「各类别内容 tab + Homework」结构与交互；
// el-dialog 带 append-to-body，内容渲染进 document.body。
describe("LessonNotesDialog 多 tab", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  let current: any = null;
  async function mountDialog(lessonNumber = 71, initialGroup = "study") {
    current?.unmount();
    const wrapper = mount(LessonNotesDialog, {
      global: { plugins: [ElementPlus] },
      props: { visible: true, lessonNumber, lessonTitle: "He's awful!", initialGroup },
    });
    current = wrapper;
    await flushPromises();
    await new Promise((r) => setTimeout(r, 0));
    return wrapper;
  }

  function tabs() {
    return Array.from(document.body.querySelectorAll<HTMLElement>(".el-tabs__item"));
  }
  function tabNames() {
    return tabs().map((i) => (i.textContent || "").trim());
  }

  it("三个分组：学习=Words/Grammar/笔记/原文，练习=操练类，笔记总结=Homework（我的笔记已合并移除）", async () => {
    await mountDialog(71, "study");
    expect(tabNames()).toContain("Grammar");
    expect(tabNames()).toContain("Words");
    expect(tabNames()).toContain("笔记");
    expect(tabNames()).not.toContain("老师笔记");
    expect(tabNames()).not.toContain("Homework");
    await mountDialog(71, "practice");
    expect(tabNames()).toContain("Comprehension");
    expect(tabNames()).toContain("Asking questions");
    expect(tabNames()).not.toContain("Words");
    await mountDialog(71, "summary");
    expect(tabNames()).toEqual(["Homework"]);
  });

  it("偶数课学习分组：在“笔记”右侧显示“老师笔记”tab", async () => {
    await mountDialog(122, "study");
    const names = tabNames();
    const notesIdx = names.indexOf("笔记");
    const teacherIdx = names.indexOf("老师笔记");
    expect(notesIdx).toBeGreaterThanOrEqual(0);
    expect(teacherIdx).toBeGreaterThan(notesIdx);
  });

  it("Grammar 内容 tab：展示提取的课堂笔记文字（只读）", async () => {
    await mountDialog(71);
    const g = tabs().find((i) => (i.textContent || "").trim() === "Grammar");
    await g!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    // tab 顺序统一为 Words 在前，需取当前可见面板的内容而非 DOM 中第一个。
    const content = Array.from(document.body.querySelectorAll<HTMLElement>(".lesson-content"))
      .find((el) => el.closest(".el-tab-pane")?.style.display !== "none")!;
    expect(content.textContent || "").toContain("⼀般过去时");
    expect(content.textContent || "").toContain("I loved you.");
  });

  it("Homework Tab：Questions 与 Summary & Recap 两个输入框（原 Homework 输入框已移除），保存后写入 localStorage", async () => {
    await mountDialog(71, "summary");
    const hwTab = tabs().find((i) => (i.textContent || "").trim() === "Homework");
    await hwTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const tasks = document.body.querySelector(".homework-tasks");
    expect(tasks).toBeTruthy();

    const inputs = document.body.querySelectorAll<HTMLTextAreaElement>(".homework-input textarea");
    expect(inputs.length).toBe(2);
    inputs[0].value = "为什么用过去时？";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "核心：一般过去时";
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    const saveBtn = Array.from(document.body.querySelectorAll<HTMLElement>(".el-button")).find(
      (b) => (b.textContent || "").trim() === "保存",
    );
    await saveBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const saved = JSON.parse(localStorage.getItem("new-concept-lesson-homework-71") || "{}");
    expect(saved.questions).toBe("为什么用过去时？");
    expect(saved.summary).toBe("核心：一般过去时");
    expect(saved.homework).toBeUndefined();
  });

  it("我的笔记内容迁移：Summary & Recap 为空时，原我的笔记内容并入其中", async () => {
    localStorage.setItem("new-concept-lesson-notes-71", "**awful** 糟糕的\n核心：一般过去时");
    await mountDialog(71, "summary");
    const hwTab = tabs().find((i) => (i.textContent || "").trim() === "Homework");
    await hwTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const inputs = document.body.querySelectorAll<HTMLTextAreaElement>(".homework-input textarea");
    // inputs[0] = Questions, inputs[1] = Summary & Recap
    expect(inputs[1].value).toContain("**awful** 糟糕的");
    expect(inputs[1].value).toContain("核心：一般过去时");
  });
  it("剑桥语法 tab：练习页点“显示答案”，浮动面板展示该 Unit 答案裁剪区（Lesson 125 → Unit 33 两个区域），关闭后移除", async () => {
    await mountDialog(125, "study");
    const cambridgeTab = tabs().find((i) => (i.textContent || "").trim() === "剑桥语法");
    await cambridgeTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    // 练习页（每单元第二页）上的“显示答案”按钮
    const showBtn = document.body.querySelector<HTMLElement>(".exercise-answer-toolbar .el-button");
    expect(showBtn).toBeTruthy();
    await showBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const panel = document.body.querySelector<HTMLElement>(".floating-answer-panel");
    expect(panel).toBeTruthy();
    expect(panel!.textContent || "").toContain("Unit 33");
    expect(panel!.querySelectorAll(".cambridge-answer-crop").length).toBe(2);

    const closeBtn = panel!.querySelector<HTMLElement>(".fap-close");
    await closeBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.querySelector(".floating-answer-panel")).toBeFalsy();
  });

  it("语法练习 tab：点“显示答案”弹出非模态浮动面板，展示答案图片并支持缩放（Lesson 71）", async () => {
    await mountDialog(71, "practice");
    const showBtn = document.body.querySelector<HTMLElement>(".exercise-answer-toolbar .el-button");
    expect(showBtn).toBeTruthy();
    await showBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const panel = document.body.querySelector<HTMLElement>(".floating-answer-panel");
    expect(panel).toBeTruthy();
    expect(panel!.querySelectorAll(".grammar-answer-image").length).toBe(2);

    const percent = panel!.querySelector<HTMLElement>(".fap-zoom-percent");
    expect(percent!.textContent).toBe("100%");
    const zoomInBtn = Array.from(panel!.querySelectorAll<HTMLElement>(".fap-btn")).find(
      (b) => b.getAttribute("aria-label") === "放大",
    );
    await zoomInBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(percent!.textContent).toBe("120%");
  });

});
