# 项目工作流

## 已检测命令

- `pnpm@10.14.0 run dev`：`vite --host 127.0.0.1`
- `pnpm@10.14.0 run build`：`vue-tsc --noEmit && vite build`
- `pnpm@10.14.0 run preview`：`vite preview --host 127.0.0.1`
- `pnpm@10.14.0 run generate:data`：`node scripts/generate-lessons.mjs`

## 通用流程

1. 先阅读根目录 AGENTS.md，并按任务匹配项目 skill。
2. 修改前确认当前分支、未提交文件和实际影响范围。
3. 使用项目已有命令进行最小充分验证。
4. 不自动提交、发布或部署；涉及网页登录态时使用 Chrome。
5. 结论被重复使用时，更新 project-knowledge 中对应参考文档。 
