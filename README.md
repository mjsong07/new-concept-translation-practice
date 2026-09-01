# Sentence Workshop

A Chinese-to-English translation practice app based on the odd-numbered lessons and reference translations from New Concept English Book 1. It uses the Vue 3 + Vite + TypeScript + Element Plus architecture from `learn english`, with sentence-level checking, error highlighting, pronunciation, mistake filtering, and locally persisted progress.

## Local Development

```bash
pnpm install
pnpm dev
```

## Updating Lesson Data

Lesson data is generated from `New-Concept-English-Book-1-Odd-Lessons-Texts-and-Reference-Translations.md`:

```bash
pnpm generate:data
```

## Build and Deployment

```bash
pnpm build
pnpm preview
```

The repository includes a GitHub Pages workflow. After pushing to `main`, set Source to GitHub Actions under Settings → Pages. Vite uses relative asset paths, so no repository-specific `base` setting is required.

## Copyright and Source

The learning material comes from a user-provided local PDF of New Concept English Book 1 and is intended for personal study only. The original work is New Concept English Book 1 by L. G. Alexander. Publisher, current rights holder, and official source have not been verified. All rights remain with the author and relevant rights holders. Please obtain the original work through authorized channels; this project is not a substitute for it.
