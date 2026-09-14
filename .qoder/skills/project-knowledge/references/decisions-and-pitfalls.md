# 决策与踩坑

## 已确认约束

- 项目名称：new-concept-translation-practice。
- AGENTS.md 保存稳定且始终适用的项目规则。
- 可重复执行的专项流程放在 .qoder/skills，并通过 .agents/skills 链接兼容 Codex。
- 历史结论必须能追溯到会话 ID 或项目文件；未经验证的推测不沉淀为强制规则。
- 不在文档中保存 Token、Cookie、密码、API Key 或其他认证信息。

## 维护方式

新增决策时写明日期、背景、最终选择、验证证据和适用范围。失效结论应删除或明确标记为已废弃，避免与当前实现冲突。

## 2026-09-08 练习交互反馈行为约定

背景：用户提出 7 项交互改进（发音预览、'd 缩写判定展示、错误重做、空输入下划线、失焦校验、播放高亮、错误反馈保留），实现后经 `pnpm build` 与 Chrome 实测验证。适用范围：src/App.vue、src/components/TranslationExercise.vue、src/composables/useTranslationPractice.ts、src/services/text.ts、src/styles/main.css。

最终选择与验证证据：

- 发音设置（发音人/音量/语速）变更后 300ms debounce 播放固定英文预览句；播放中（speechActive）不预览。无头环境无法听声，仅逻辑验证。
- 缩写判定：`'d` 按 would/had 双变体交叉比较（`expandAmbiguousContractions`）；判对时 `buildCorrectParts` 输出全绿 diff，不再出现"判对但 had 标红"。浏览器导入模块实测 "I had like a cigarette, too." 对 "I'd like a cigarette, too." 返回 correct、similarity 1、全绿。
- 失焦立即校验：仅当该行被编辑过（组件内 `editedIds`）且输入非空时提交；Enter 提交会先删除编辑标记，避免 blur 造成重复提交/重复错误历史。程序化触发需用 `dispatchEvent(new FocusEvent('blur'))`，`ta.blur()` 在无头环境不触发 Vue 监听。
- 错误反馈保留：`updateAnswer` 仅在现有结果为 correct 时清除，wrong/close 反馈保留到下次校验覆盖；`restoreLessonResults` 仅恢复 mistakes>0 且非 correct 的行，刷新后不重建整课绿色反馈。
- 历史弹窗"重做"：清空该行（保留错误历史）、关闭弹窗、聚焦目标行；若行被筛选隐藏则先 `emit('show-all')` 让父级切回 all。
- 样式约定：空输入行下划线用 var(--gold)（深色 #c9a13f）；播放中当前行英文文本 #2f80ed（深色 #5b9cf5），说话者前缀颜色必须显式固定（亮 #c9d2cf/深 #c9d2cf）——`.speaker-prefix { color: currentColor }` 会随行内变色被连带，这是曾踩的继承陷阱。
- 数据维护：中文分句源文件（New-Concept-English-Book-1-Odd-Lessons-Chinese-Reference-Translations.md）中引文类前缀（如 Lesson 133"你听这段："）只保留在引文首句，后续行省略说话人前缀让其并入当前 turn；逐行重复前缀会透传到每道题的 prompt。改完跑 `pnpm generate:data` 并用 `git diff src/data/lessons.ts` 确认只有目标课变化。
- 错误选中：buildDiffParts 的 firstErrorOffset/End 默认只覆盖首段错误（配合精确选中阈值）；当输入混入不支持的中文时扩展到最后一个错误结尾（`hasUnsupportedText`），使中文与英文错误同时被选中。验证用例：`你们 have just made a film` 提交后 selection 为 [0, 全长)。
