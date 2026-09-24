import { describe, it, expect, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ElementPlus from "element-plus";
import LessonNotesDialog from "./LessonNotesDialog.vue";

// 注册真实 Element Plus，验证「我的笔记 + 各类别内容 tab + Homework」结构与交互；
// el-dialog 带 append-to-body，内容渲染进 document.body。
describe("LessonNotesDialog 多 tab", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  async function mountDialog(lessonNumber = 71) {
    const wrapper = mount(LessonNotesDialog, {
      global: { plugins: [ElementPlus] },
      props: { visible: true, lessonNumber, lessonTitle: "He's awful!" },
    });
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

  it("我的笔记在前、Homework 在后，中间按类别生成内容 tab", async () => {
    await mountDialog(71);
    const names = tabNames();
    expect(names[0]).toBe("我的笔记");
    expect(names[names.length - 1]).toBe("Homework");
    expect(names).toContain("Grammar");
    expect(names).toContain("Words");
    expect(names).toContain("Comprehension");
    expect(names).toContain("Asking questions");
  });

  it("我的笔记：编辑后保存并渲染 Markdown，写入 localStorage", async () => {
    await mountDialog(71);
    const editBtn = Array.from(document.body.querySelectorAll<HTMLElement>(".el-button")).find(
      (b) => (b.textContent || "").trim() === "编辑",
    );
    await editBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const textarea = document.body.querySelector<HTMLTextAreaElement>(".lesson-notes-editor textarea")!;
    textarea.value = "**awful** 糟糕的";
    await textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    const saveBtn = Array.from(document.body.querySelectorAll<HTMLElement>(".el-button")).find(
      (b) => (b.textContent || "").trim() === "保存",
    );
    await saveBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const body = document.body.querySelector(".lesson-notes-body")!;
    expect(body.innerHTML).toContain("<strong>awful</strong>");
    expect(localStorage.getItem("new-concept-lesson-notes-71")).toContain("糟糕的");
  });

  it("Grammar 内容 tab：展示提取的课堂笔记文字（只读）", async () => {
    await mountDialog(71);
    const g = tabs().find((i) => (i.textContent || "").trim() === "Grammar");
    await g!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    const content = document.body.querySelector(".lesson-content")!;
    expect(content.textContent || "").toContain("⼀般过去时");
    expect(content.textContent || "").toContain("I loved you.");
  });

  it("Homework Tab：三个独立输入框，保存后写入 localStorage", async () => {
    await mountDialog(71);
    const hwTab = tabs().find((i) => (i.textContent || "").trim() === "Homework");
    await hwTab!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const tasks = document.body.querySelector(".homework-tasks");
    expect(tasks).toBeTruthy();

    const inputs = document.body.querySelectorAll<HTMLTextAreaElement>(".homework-input textarea");
    expect(inputs.length).toBe(3);
    inputs[0].value = "为什么用过去时？";
    inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1].value = "单词造句*3";
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[2].value = "核心：一般过去时";
    inputs[2].dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    const saveBtn = Array.from(document.body.querySelectorAll<HTMLElement>(".el-button")).find(
      (b) => (b.textContent || "").trim() === "保存",
    );
    await saveBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    const saved = JSON.parse(localStorage.getItem("new-concept-lesson-homework-71") || "{}");
    expect(saved.questions).toBe("为什么用过去时？");
    expect(saved.homework).toBe("单词造句*3");
    expect(saved.summary).toBe("核心：一般过去时");
  });
});
