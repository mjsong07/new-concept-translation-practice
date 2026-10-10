# 项目架构

## 基本信息

- 项目名称：new-concept-translation-practice
- 项目类型：Vue/Node.js 前端项目
- 项目根目录：/Users/jason.yang/Desktop/my-workspace/codex/new-concept-translation-practice
- Git：是，当前分支为 main
- 关键清单：package.json、pnpm-lock.yaml、README.md
- 包名称：new-concept-translation-practice
- 包管理器：pnpm@10.14.0
- 主要依赖：@element-plus/icons-vue、element-plus、vue、@vitejs/plugin-vue、typescript、vite、vue-tsc

## 顶层结构

- 文件：New-Concept-English-Book-1-Odd-Lessons-Chinese-Reference-Translations.md
- 文件：New-Concept-English-Book-1-Odd-Lessons-Texts-and-Reference-Translations.md
- 文件：README.md
- 文件：index.html
- 文件：package.json
- 文件：pnpm-lock.yaml
- 目录：scripts
- 目录：server/pronunciation
- 目录：src
- 文件：tsconfig.json
- 文件：vite.config.ts
- 文件：requirements.txt、packages.txt（Hugging Face Gradio Space 依赖）

## 发音评测

- `src/services/pronunciation.ts` 将录音发至构建时配置的 `VITE_PRONUNCIATION_API_URL`；服务地址不写入 `localStorage`。
- `src/components/PronunciationRecorder.vue` 提供录音、评测结果、返听与英音/美音切换；句子练习及单词音标面板复用此组件。
- `server/pronunciation/app.py` 提供 Gradio `evaluate_pronunciation` 队列 API，推理使用 Whisper 与 wav2vec2；输入音频仅由 Gradio 在临时处理期间解码，不持久化录音或评分结果。
- 根目录 `README.md` frontmatter 声明 Gradio Space 入口；Python/系统依赖分别在 `requirements.txt`、`packages.txt`。`.github/workflows/deploy-pronunciation-space.yml` 通过 GitHub Actions secret `HF_TOKEN` 与变量 `HF_SPACE_REPO` 同步部署，仅上传评测服务文件。
- GitHub Pages 构建需设置仓库 Actions 变量 `VITE_PRONUNCIATION_API_URL` 为 Space App URL。免费 ZeroGPU 使用有每日 GPU 配额和队列限制；参见 README。

## 维护要求

架构结论必须以当前源码、构建清单和运行结果为准。项目结构发生实质变化时，同步更新本文与根目录 AGENTS.md 的索引。
