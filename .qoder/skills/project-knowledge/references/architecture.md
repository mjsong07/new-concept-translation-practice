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
- 目录：worker/pronunciation
- 目录：src
- 文件：tsconfig.json
- 文件：vite.config.ts
- 目录：worker/pronunciation（Cloudflare Workers AI 发音练习 API）

## 发音评测

- `src/services/pronunciation.ts` 将录音以 multipart 请求发往构建时配置的 `VITE_PRONUNCIATION_API_URL`；服务地址不写入 `localStorage`。
- `src/components/PronunciationRecorder.vue` 提供录音、ASR 逐词对照、完成度/流利度参考分和返听；句子练习及单词音标面板复用此组件。Cloudflare Whisper 不提供音素级发音评分。
- `worker/pronunciation/src/index.ts` 通过 Workers AI binding 调用 Whisper large-v3-turbo；不持久化录音或评测结果。`worker/pronunciation/wrangler.jsonc` 配置 AI binding 和 CORS 来源。
- `.github/workflows/deploy-pronunciation-worker.yml` 通过 `CLOUDFLARE_API_TOKEN` Secret 和 `CLOUDFLARE_ACCOUNT_ID` Variable 自动部署 Worker。GitHub Pages 构建需设置 `VITE_PRONUNCIATION_API_URL` 为 `workers.dev` URL。Workers AI 免费额度按每日 Neurons 计；参见 README。

## 维护要求

架构结论必须以当前源码、构建清单和运行结果为准。项目结构发生实质变化时，同步更新本文与根目录 AGENTS.md 的索引。
