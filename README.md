# Ace Studio

Eli Ace's in-house AI media studio: video (LTX-2.5 with synced audio, text or photo-to-video, 3–12 s),
images, music (ACE-Step), and storyboards. No personal accounts: one shared studio behind a team passphrase.

Live: https://ace-studio-aiaceteam.viktor.space
GitHub Pages (static build of this repo, same backend): https://ilya7-eng.github.io/ace-studio-/

## Stack
- React 19 + Vite + Tailwind v4 + shadcn/ui (`src/`)
- Convex backend (`convex/`) — jobs queue, file storage, private Hugging Face Space engines
- Bun for scripts

## Studio passphrase (required)
Public mode is gated by one shared passphrase (Cloudflare audit 2026-10-04, C1). Without it,
anonymous callers could list, rate and delete everything and spend the GPU budget. Set it
before deploying this branch, or nobody can get in (it fails closed if unset or shorter than 16 chars):
```bash
bunx convex env set STUDIO_PASSPHRASE '<long passphrase>'        # or, where env vars can't be set:
curl -X POST "$CONVEX_SITE_URL/admin/secret" -H "Authorization: Bearer $VIKTOR_SPACES_PROJECT_SECRET" \
  -d '{"name":"STUDIO_PASSPHRASE","value":"<long passphrase>"}'
```
Convex Auth also needs `JWT_PRIVATE_KEY` + `JWKS` on the deployment (the Viktor Space template sets them).

## Run locally
```bash
bun install
bunx convex dev          # needs a Convex deployment (CONVEX_DEPLOY_KEY in .env.local)
bun run dev
```
Backend env vars: `HF_TOKEN` (private HF Spaces), `VIKTOR_SPACES_API_URL` / `_PROJECT_NAME` /
`_PROJECT_SECRET` (image + prompt-coach tool gateway).

## Static build (GitHub Pages)
Built with `--base=/ace-studio-/`, pushed to the `gh-pages` branch (`404.html` = SPA fallback). Pushing a `gh-pages` branch auto-enabled Pages.
```bash
VITE_CONVEX_URL=https://reliable-scorpion-586.convex.cloud VITE_VIKTOR_SPACES_ACCESS_MODE=public \
  bun run build
```
