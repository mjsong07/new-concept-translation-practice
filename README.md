# 译句工坊

基于《新概念英语》第一册奇数课课文与参考译文制作的中译英练习网页。项目沿用 `learn english` 的 Vue 3 + Vite + TypeScript + Element Plus 分层结构，并增加逐句判分、错词提示、发音、错题筛选和本地学习进度。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 数据更新

练习数据由上级工作目录中的 `output/新概念英语第一册-奇数课课文与参考译文.md` 生成：

```bash
pnpm generate:data
```

## 构建与发布

```bash
pnpm build
pnpm preview
```

仓库已配置 GitHub Pages 工作流。推送到 `main` 后，在 GitHub 仓库 Settings → Pages 中将 Source 设为 GitHub Actions，即可自动发布。Vite 使用相对资源路径，因此无需按仓库名修改 `base`。

## 版权与来源

学习内容来自用户提供的本地 PDF《新概念英语》第1册+pdf课文.pdf，仅用于个人学习。原作名称：《新概念英语》第一册；原作者：L. G. Alexander；出版方、已知版权方与官方原作地址暂未核实。原作内容及相关权利归原作者和权利人所有，请通过正规渠道访问并支持原作。本项目不能替代原作。
