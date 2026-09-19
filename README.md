# Ace Studio

Eli Ace's in-house AI media studio: video (LTX-2.5 with synced audio, text or photo-to-video, 3–12 s),
images, music (ACE-Step), and storyboards. No login — one shared studio.

Live: https://ace-studio-nexen-construction.viktor.space

## Stack
- React 19 + Vite + Tailwind v4 + shadcn/ui (`src/`)
- Convex backend (`convex/`) — jobs queue, file storage, private Hugging Face Space engines
- Bun for scripts

## Run locally
```bash
bun install
bunx convex dev          # needs a Convex deployment (CONVEX_DEPLOY_KEY in .env.local)
bun run dev
```
Backend env vars: `HF_TOKEN` (private HF Spaces), `VIKTOR_SPACES_API_URL` / `_PROJECT_NAME` /
`_PROJECT_SECRET` (image + prompt-coach tool gateway).

## Static build (GitHub Pages)
```bash
VITE_CONVEX_URL=https://reliable-scorpion-586.convex.cloud VITE_VIKTOR_SPACES_ACCESS_MODE=public \
  bun run build
```
