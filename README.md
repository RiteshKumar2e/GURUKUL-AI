# GURUKUL AI — the last-mile learning companion

A Hindi-first maths tutor for Class 9 students in Jharkhand (JAC board), built for the ACE Builders Global Hackathon 2026, Problem Statement 3: *The Last-Mile Tutor*.

**Status:** prototype. The lesson content is original sample material, not the official JAC syllabus. See [Known limitations](#known-limitations).

## What it does

- **AI tutor.** Gives a hint first, then a step-by-step solution, then a follow-up question. Replies in Hindi or English.
- **Answer checking.** When the tutor gives a numeric final answer, a deterministic calculator re-checks it and the app shows whether the two agree. The check covers final numbers only, not reasoning.
- **Voice tutor (Hindi, English, Telugu).** The student speaks, checks the transcript, then hears the reply. Speech-to-text uses Sarvam AI, Groq Whisper, or the browser. Read-aloud uses Sarvam AI or the device voice. Spoken replies are cached in IndexedDB.
- **Photo questions.** The photo is compressed on the phone and checked on the server. A vision model extracts the question; the student can edit the text before asking.
- **Adaptive practice.** Mastery is tracked per topic and difficulty moves up or down. Weak topics are detected and recommendations are generated from stored results. Each mistake comes with an explanation.
- **Offline learning.** The app is an installable PWA. Students can download chapter packs to IndexedDB, practise offline, and queued answers are sent to the server when the connection returns. The server re-grades them.
- **Parent and teacher dashboard.** A guardian links to a student with a 6-character code the student shares. Guardians see progress, weak areas and activity, not the content of tutor chats.

## Project structure

```
frontend/   React 18 + Vite + TypeScript + Tailwind (PWA), deployed on Vercel (vercel.json)
backend/    Node.js + Express + TypeScript + Drizzle ORM + Turso (libSQL)
  src/        config/, db/ (schema.ts, client.ts), routes/, controllers/, services/, repositories/, middleware/, validators/, utils/
  drizzle/    SQL migrations generated from src/db/schema.ts
  scripts/    migrate.ts, seed.ts, db-check.ts
  content/    class9-maths.json  (editable lessons and questions, with source notes)
  tests/      Vitest + Supertest tests (run on a throwaway database)
```

There is no root `package.json`. Install and run each app from its own folder.

## Requirements

- Node.js 20 or newer (tested on 22.12).
- A [Turso](https://turso.tech) database. There is no local database: the backend always talks to Turso.

## Database: Turso setup

1. Install the CLI and sign in: `npm i -g @tursodatabase/cli` (or see turso.tech/docs), then `turso auth login`.
2. Create a database close to your users: `turso db create gurukul-ai --location aws-ap-south-1`.
3. Get the URL: `turso db show gurukul-ai --url` (looks like `libsql://gurukul-ai-<org>.turso.io`).
4. Create a token: `turso db tokens create gurukul-ai`.
5. Put both in `backend/.env` as `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. They stay on the server: the browser never sees them.
6. Check the connection (read-only): `npm run db:check`.
7. Create the tables: `npm run db:migrate`.
8. Load curriculum and the synthetic demo accounts: `npm run db:seed` (`SEED_DEMO=false` skips the demo accounts).

**Migrations are safe by design.** `db:migrate` applies only migrations that are not yet recorded in `__drizzle_migrations`. It refuses to run any migration that contains `DROP TABLE`, `DROP COLUMN`, `DELETE FROM` or a table rebuild unless you set `ALLOW_DESTRUCTIVE_MIGRATION=true` after taking a backup (`turso db shell gurukul-ai .dump > backup.sql`). Nothing in the project resets the database.

**Changing the schema:** edit `src/db/schema.ts`, run `npm run db:generate` to create a new SQL file in `drizzle/`, review it, then `npm run db:migrate`.

## Local setup

Use two terminals.

```bash
# Terminal 1: backend (API on http://localhost:5000)
cd backend
cp .env.example .env          # Windows: copy .env.example .env
# fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT secrets (see Environment below)
npm install
npm run db:migrate            # first time only
npm run db:seed               # first time only
npm run dev

# Terminal 2: frontend (web app on http://localhost:5173)
cd frontend
cp .env.example .env          # Windows: copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

Demo accounts hold **synthetic** data only. The password is `Demo@1234` for all three:

| Username | Role |
|---|---|
| `demo.student` | Student with generated practice history |
| `demo.parent` | Parent linked to the demo student |
| `demo.teacher` | Teacher linked to the demo student |

## Scripts

Run these inside `backend/` or `frontend/`.

| Command | Backend | Frontend |
|---|---|---|
| `npm run dev` | `tsx watch src/server.ts` | `vite` |
| `npm run build` | `tsc` | `tsc -b` + `vite build` |
| `npm run lint` | `tsc --noEmit` (src, scripts and tests) | `tsc -b --noEmit` |
| `npm run test` | `vitest run` on a throwaway temp database | `vitest run` |
| `npm start` | `node dist/server.js` | — |
| `npm run preview` | — | `vite preview` (service worker active, port 4173) |
| `npm run db:check` | Read-only connection and table check | — |
| `npm run db:migrate` | Apply pending migrations (non-destructive) | — |
| `npm run db:seed` | Upsert curriculum + replace the 3 demo accounts | — |
| `npm run db:generate` | Create a migration from `src/db/schema.ts` | — |
| `npm run db:studio` | Drizzle Studio (browse data) | — |

Backend tests never use the Turso database in `.env`: `tests/globalSetup.ts` creates a temporary libSQL file in the OS temp folder, migrates and seeds it, and deletes it afterwards.

## Environment

Each app has its own `.env`, created from its `.env.example`. Real `.env` files are git-ignored. The server checks every variable at startup and refuses to start if a required one is missing or invalid.

### backend/.env

| Variable | Required | Default | Notes |
|---|---|---|---|
| `TURSO_DATABASE_URL` | yes | — | `libsql://<db>-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | yes | — | From `turso db tokens create <db>`. Server-side only |
| `JWT_SECRET` | yes | — | At least 32 characters |
| `JWT_REFRESH_SECRET` | yes | — | At least 32 characters; must differ from `JWT_SECRET` |
| `ACCESS_TOKEN_TTL` | no | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | Refresh token lifetime |
| `PORT` | no | `5000` | |
| `FRONTEND_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated, e.g. `http://localhost:5173,https://gurukul-ai.vercel.app` |
| `UPLOAD_DIR` | no | `uploads` | Temporary upload folder; files are deleted after processing |
| `MAX_UPLOAD_MB` | no | `6` | Upload size limit |
| `COOKIE_SECURE` | no | off | `true` in production over HTTPS |
| `COOKIE_SAMESITE` | no | `lax` | `none` when the API and web app are on different sites |
| `ENFORCE_HTTPS` | no | off | Set with `TRUST_PROXY=true` behind a TLS proxy; adds HSTS |
| `TRUST_PROXY` | no | off | |

**AI tutor and vision (Groq by default):**

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `groq` | `groq` or `openai-compatible` |
| `AI_API_KEY` | empty | Groq key. Empty means no Groq tutor, Whisper or vision. |
| `AI_MODEL` | `openai/gpt-oss-120b` | Tutor model |
| `AI_VISION_MODEL` | `qwen/qwen3.8-27b` | Photo question model |
| `AI_STT_MODEL` | `whisper-large-v3` | Groq Whisper model |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | Any OpenAI-compatible endpoint |
| `AI_TIMEOUT_MS` | `30000` | |

**Tutor LLM selection:**

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `auto` | `auto` uses Groq if `AI_API_KEY` is set, else Gemini if `GEMINI_API_KEY` is set, else demo mode. Force with `groq` or `gemini`. |
| `GEMINI_API_KEY` | empty | From https://aistudio.google.com/apikey |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | |
| `GEMINI_MODEL` | `gemini-2.5-flash` | |

**Voice:**

| Variable | Default | Notes |
|---|---|---|
| `STT_PROVIDER` | `auto` | `auto` uses Sarvam if `SARVAM_API_KEY` is set, else Groq Whisper, else browser only. `sarvam`, `groq`, `none` to force. |
| `TTS_PROVIDER` | `auto` | `auto` uses Sarvam if `SARVAM_API_KEY` is set, else the browser. `sarvam` or `browser`. |
| `SARVAM_API_KEY` | empty | From https://dashboard.sarvam.ai |
| `SARVAM_BASE_URL` | `https://api.sarvam.ai` | |
| `SARVAM_STT_MODEL` | `saarika:v2.5` | |
| `SARVAM_TTS_MODEL` | `bulbul:v2` | |
| `SARVAM_TTS_SPEAKER` | `anushka` | |
| `VOICE_TIMEOUT_MS` | `30000` | |

### frontend/.env

Only public values. Everything here ends up in the browser, so never put secrets in this file.

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_APP_NAME` | Display name |
| `VITE_SITE_URL` | Used for sitemap, robots.txt and social image URLs |
| `VITE_CONTACT_EMAIL` | Footer mailto link; hidden when empty |

### Demo mode

With no `AI_API_KEY` and no `GEMINI_API_KEY`, the server runs in demo mode and says so. The tutor reply is labelled *"Demo mode — not an AI answer"* and contains only a deterministic calculator result (when the question has arithmetic or a linear equation) and the summary of the linked lesson. Photo reading and server speech-to-text return a "not configured" message. Lessons, practice, quizzes, progress, offline use and the guardian dashboard work without any key.

`GET /api/health` reports the AI mode (`"ai": {"mode": "live"}` or demo).

## Voice tutor

The voice page (`/app/voice`) has a language switch (हिंदी / English / తెలుగు), a microphone with a recording timer, an editable transcript, hint, solution and explain modes, play/pause/replay/stop on each reply, and a typing fallback. Each reply is labelled with its language so it is read in the right voice.

**How it works**
- The browser re-encodes each recording to 16 kHz mono WAV before upload.
- With Sarvam, recordings stop at 30 seconds, because the synchronous API takes short clips.
- Recordings are deleted from the server right after transcription.
- Spoken replies are cached in IndexedDB: the newest 40 clips are kept and the cache is cleared on logout.

**Endpoints**
- `GET /api/voice/capabilities`: which providers are active.
- `POST /api/voice/transcribe?language=hi|en|te`: multipart field `audio`.
- `POST /api/voice/speak` with JSON `{ "text", "language" }`: returns `audio/wav`.

Without a Sarvam key, Telugu read-aloud works only if the device has a Telugu voice installed. The page says so when it doesn't.

## Verification status

Be precise about what has and has not been run. Results are recorded here as they were observed, and none are assumed.

- **Groq tutor:** the author's development notes record a live Telugu test on 2026-11-21 using `openai/gpt-oss-120b`. This README revision did not re-run it.
- **Sarvam and Gemini:** request formats follow their public documentation. They are covered only by mocked tests (`backend/tests/voice.test.ts`). **They have not been tested against the live APIs**, because no keys were available.
- **Telugu UI strings** written by the server should be reviewed by a native speaker.
- **Browser journeys** were checked with a headless-browser script during development. That script is not in the repository.
- **Real low-end Android devices** have not been tested.

To verify on your own machine, run `npm run lint`, `npm run test` and `npm run build` in each folder, then follow the voice testing steps above with your own keys.

## Groq models

Groq retires models over time. The defaults above were chosen because the older ones were no longer available on the development key. To see what your key can use, call `GET https://api.groq.com/openai/v1/models` with your key. Check the IDs at https://console.groq.com/docs/models.

## Deployment

**Frontend (Vercel).** Import the repository, set **Root Directory** to `frontend`. `frontend/vercel.json` sets the build (`npm run build`, output `dist`), the SPA fallback to `index.html`, long caching for hashed assets, no caching for `sw.js` and `index.html`, and security headers. In Vercel → Settings → Environment Variables set:

| Variable | Value |
|---|---|
| `VITE_API_URL` | Your **deployed** backend, e.g. `https://<backend-host>/api` (not `localhost`) |
| `VITE_SITE_URL` | `https://gurukul-ai.vercel.app` |
| `VITE_APP_NAME` | `GURUKUL AI` |

Redeploy after changing them: Vite bakes these values in at build time.

**Backend (any Node host, e.g. Render, Railway, Fly.io).** Root directory `backend`, build `npm ci && npm run build`, start `npm run db:migrate && npm start`. Set the variables from `backend/.env.example`, plus:

- `NODE_ENV=production`, `TRUST_PROXY=true`, `ENFORCE_HTTPS=true`, `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`, because the frontend (vercel.app) and the API are on different sites; without it the login refresh cookie is not sent
- `FRONTEND_URL=https://gurukul-ai.vercel.app`

`GET /api/health` reports `db` (`up`/`down`), whether migrations are applied and the AI mode. It never includes credentials.

Serve everything over HTTPS. Browsers allow service workers, microphone access and camera capture only on secure origins.

## API

All routes are under `/api`. Protected routes need `Authorization: Bearer <access token>`. The refresh token is an httpOnly cookie scoped to `/api/auth`, rotated on every use. If an old refresh token is reused, all of that user's sessions are revoked.

| Module | Endpoints |
|---|---|
| health | `GET /health` |
| auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| users | `GET/PATCH/DELETE /users/me`, `POST /users/me/password` |
| students | `GET/PATCH /students/me`, `GET /students/me/dashboard`, `POST /students/me/link-code` |
| parents / teachers | `POST /parents/link`, `GET /parents/students`, `GET /parents/students/:id/report`, `DELETE /parents/students/:id` |
| curriculum | `GET /curriculum`, `GET /curriculum/sources`, `GET /chapters`, `GET /chapters/:slug`, `GET /chapters/:slug/offline-pack`, `GET /topics/:slug`, `POST /topics/:slug/complete` |
| tutor | `GET/POST /tutor/conversations`, `GET/DELETE /tutor/conversations/:id`, `POST /tutor/conversations/:id/messages` |
| voice / vision | `GET /voice/capabilities`, `POST /voice/transcribe`, `POST /voice/speak`, `POST /vision/extract` (multipart `image`) |
| practice | `GET /practice/next?topic=`, `POST /practice/answer`, `POST /practice/sessions`, `POST /practice/sessions/:id/end` |
| assessments | `GET /assessments`, `GET /assessments/:slug`, `POST /assessments/:slug/start`, `POST /assessments/sessions/:id/submit` |
| adaptive | `GET /adaptive/recommendations`, `POST /adaptive/recommendations/recompute`, `POST /adaptive/recommendations/:id/dismiss`, `GET /adaptive/weak-topics` |
| progress | `GET /progress/me`, `GET /progress/me/activity` |
| sync | `POST /sync` (idempotent batch of offline records) |
| analytics | `POST /analytics/pageview` (anonymous; sent only after consent) |

## Known limitations

- **Curriculum alignment.** The chapter list was checked against secondary sources only, not the official JAC notified syllabus (see `backend/content/class9-maths.json`, `meta`). All lessons are original *sample* content and too few for a full course.
- **Telugu content.** Lessons and questions are in Hindi and English only. Telugu is supported in the voice and text tutor replies, not in lesson content.
- **Password reset.** Students give no email address, so there is no password reset.
- **Answer checking.** The calculator confirms only the final number of arithmetic or one-variable linear answers. It does not check reasoning or geometry proofs.
- **Device voices.** Without a Sarvam key, read-aloud depends on the device having a Hindi or Telugu voice. Browser speech recognition needs internet and works best in Chrome on Android.
- **Background sync.** It runs in open tabs. With no tab open, the queue syncs on the next visit. iOS Safari has no Background Sync API, so syncing happens on reconnect or app open.
- **Tests.** Tests cover logic and APIs. Browser journeys are not in the test suite.
- **Legal review.** The privacy policy and terms need legal review (for example against India's DPDP Act 2023) before public use.
- **No licence yet.** A licence will be chosen after the organisers' ownership terms are reviewed.
