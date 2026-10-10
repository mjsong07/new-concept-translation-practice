# Sentence Workshop
2026
A Chinese-to-English translation practice app based on the odd-numbered lessons and reference translations from New Concept English Book 1. It uses the Vue 3 + Vite + TypeScript + Element Plus architecture from `learn english`, with sentence-level checking, error highlighting, pronunciation, mistake filtering, and locally persisted progress.

## Local Development

```bash
pnpm install
pnpm dev
```

## Practice Windows

The practice group opens in the regular notes dialog, without zoom controls. Click an individual grammar question image or Cambridge exercise image to open it in a separate non-modal window. Grammar and Cambridge answers open in their own windows, so questions and answers can be positioned and resized independently.

Image windows show only three small toolbar icons: zoom out, zoom in, and close. Drag the toolbar's padding to move a window, or use Ctrl/Cmd + mouse wheel or a two-finger pinch to zoom. When zooming out, the content area shrinks to fit the image without leaving a wide blank background.

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

### Speech Practice with Cloudflare Workers AI

In original and bilingual reading views, use the microphone immediately after each English sentence to practice speaking. Clicking a word opens a light-themed phonetic tooltip with its own microphone (adapted to the selected color theme). Recording status and results appear in an opaque floating panel that may cover the following text.

Pronunciation recording is sent directly from the browser to a Cloudflare Worker, which calls the hosted `@cf/openai/whisper-large-v3-turbo` model through a Workers AI binding. The Worker compares the transcript with the reference sentence and estimates speaking rate and pauses. It does **not** perform phoneme-level grading or measure actual pronunciation accuracy; the on-screen total is only a practice reference score based on completeness and fluency.

Workers AI currently includes 10,000 Neurons per day at no charge. The allowance is shared across the account and resets daily; requests can fail after it is exhausted. Model usage is also priced per audio minute, so check the [current Workers AI pricing and limits](https://developers.cloudflare.com/workers-ai/platform/pricing/) before enabling paid overage. The Whisper model's current unit price is listed on its [model page](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/). Anyone can call the public Worker endpoint directly; CORS only controls browser origins and is not authentication. Do not put secrets in the frontend.

To deploy:

1. In Cloudflare, create an API token using the **Edit Cloudflare Workers** template, scoped to the account where the Worker will run. Find the account ID in the Cloudflare dashboard.
2. In this GitHub repository, add the token as the Actions secret `CLOUDFLARE_API_TOKEN` and the account ID as the Actions variable `CLOUDFLARE_ACCOUNT_ID`.
3. Check `ALLOWED_ORIGINS` in [`worker/pronunciation/wrangler.jsonc`](./worker/pronunciation/wrangler.jsonc). Add the exact origin of the deployed GitHub Pages site (and local development origin if needed); origins contain only scheme and host, not paths.
4. Run **Deploy pronunciation Worker** from GitHub Actions. The Worker name is `new-concept-pronunciation`; after deployment, use the `workers.dev` URL shown by Cloudflare, for example `https://new-concept-pronunciation.<your-subdomain>.workers.dev`.
5. Set the GitHub Actions variable `VITE_PRONUNCIATION_API_URL` to that Worker URL, then manually run **Deploy to GitHub Pages** once so the frontend is rebuilt with it. Subsequent changes under `worker/pronunciation/` deploy automatically.

The Worker exposes `GET /health` and `POST /api/pronunciation/eval` (multipart fields: `audio`, `reference_text`). Recordings are limited to 18 seconds in the UI and 2 MB at the Worker. Audio is forwarded to Workers AI for inference and is not written to persistent storage by this app. For local Worker development, use `npx wrangler dev` from `worker/pronunciation/`.

## Copyright and Source

The learning material comes from a user-provided local PDF of New Concept English Book 1 and is intended for personal study only. The original work is New Concept English Book 1 by L. G. Alexander. Publisher, current rights holder, and official source have not been verified. All rights remain with the author and relevant rights holders. Please obtain the original work through authorized channels; this project is not a substitute for it.
