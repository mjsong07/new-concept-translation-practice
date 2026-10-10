---
title: Pronunciation Evaluation
emoji: 🎙️
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 5.50.0
python_version: 3.12
app_file: server/pronunciation/app.py
---

# Sentence Workshop
2026
A Chinese-to-English translation practice app based on the odd-numbered lessons and reference translations from New Concept English Book 1. It uses the Vue 3 + Vite + TypeScript + Element Plus architecture from `learn english`, with sentence-level checking, error highlighting, pronunciation, mistake filtering, and locally persisted progress.

## Local Development

```bash
pnpm install
pnpm dev
```

## Practice Windows

The practice group opens in a non-modal window. Drag its header to position the questions, and use the zoom controls, Ctrl/Cmd + mouse wheel, or a two-finger pinch to resize the content. Grammar and Cambridge answers open in separate windows with independent positions and zoom levels.

Window borders follow the scaled content instead of keeping a fixed-size frame. Large windows can extend beyond the screen: drag the whole window to see another portion, while the toolbar stays accessible. Click a window to bring it forward; Esc closes the frontmost window. Study and summary dialogs keep their existing behavior.

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

### Pronunciation Evaluation Space

The pronunciation service uses the Hugging Face Gradio SDK with ZeroGPU, rather than Docker/FastAPI, so it can run on an eligible free personal account. In Hugging Face, create an **empty Gradio Space** (do not add a template README). This repository's README metadata points it to `server/pronunciation/app.py`, with Python dependencies in the root `requirements.txt` and system packages in `packages.txt`. Select ZeroGPU in the Space hardware settings.

The free ZeroGPU option is not an unlimited always-on API. Hugging Face currently documents a 5-minute daily GPU quota for free signed-in users and 2 minutes for unauthenticated users, with lower queue priority when unauthenticated. The GitHub Pages app does not pass users' Hugging Face login or token, so callers must expect the unauthenticated limits. Evaluations can queue or fail after quota is exhausted. Free Space eligibility also requires an account in good standing, verified email, and an account older than 30 days. Review the [ZeroGPU limits](https://huggingface.co/docs/hub/spaces-zerogpu#usage-tiers) before sharing the public endpoint. Do not switch to paid hardware unless you explicitly accept its costs.

To deploy files from this GitHub repository, create a Hugging Face write token scoped only to the new Space, then add it as the GitHub Actions secret `HF_TOKEN`; set the Actions variable `HF_SPACE_REPO` to `<account>/<space-name>`. Run the **Deploy pronunciation Space** workflow once. It uploads only the Space README and its two dependency manifests and app file; subsequent relevant pushes redeploy automatically. Never put the token in source or Actions variables.

Set the GitHub repository Actions variable `VITE_PRONUNCIATION_API_URL` to the Space's app URL, such as `https://<account>-<space-name>.hf.space`. The Pages workflow embeds this public URL at build time; it is not a secret and is not stored in browser `localStorage`. The app uses `@gradio/client` to upload audio and call the `evaluate_pronunciation` Gradio API endpoint.

The Space downloads and caches Whisper and wav2vec2 weights in its temporary filesystem. It does not retain recordings or evaluation results. If a restart loses the cache, weights need to be downloaded again. Persistent storage is not configured or required.

## Copyright and Source

The learning material comes from a user-provided local PDF of New Concept English Book 1 and is intended for personal study only. The original work is New Concept English Book 1 by L. G. Alexander. Publisher, current rights holder, and official source have not been verified. All rights remain with the author and relevant rights holders. Please obtain the original work through authorized channels; this project is not a substitute for it.
