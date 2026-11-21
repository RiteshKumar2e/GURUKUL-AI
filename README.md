# GURUKUL AI — the last-mile learning companion

A Hindi-first maths tutor for Class 9 students in Jharkhand (JAC board). It was built for ACE Builders Global Hackathon 2026, Problem Statement 3: *The Last-Mile Tutor*.

- **AI tutor.** Gives a hint first, then a step-by-step solution, then a follow-up question. It explains at three levels and replies in Hindi or English.
- **Answer checking.** When the tutor gives a numeric final answer, a separate calculator re-checks it and the app shows whether the two agree.
- **Voice tutor in Hindi, English and Telugu.** The student speaks, checks the transcript, then hears the reply. Speech-to-text uses Sarvam AI, Groq Whisper or the browser. Read-aloud uses Sarvam AI or the device's own voice. Spoken replies are cached in IndexedDB, so replaying one costs no data.
- **Photo questions.** The photo is compressed on the phone and checked on the server. A vision model extracts the question, and the student can edit the text before asking.
- **Adaptive practice.** Mastery is tracked per topic and the question level moves up or down. Weak topics are detected, recommendations are generated, and every mistake comes with an explanation.
- **Offline learning.** The app is an installable PWA. Students can download chapter packs to IndexedDB, practise offline, and queued answers sync (and are re-graded on the server) when the connection returns.
- **Parent and teacher dashboard.** A guardian links to a student with a 6-character code the student shares. Guardians see progress, weak areas and activity, but not the content of tutor chats.

## Structure

```
.
├── frontend/          React 18 + Vite + TypeScript + Tailwind (PWA)
│   ├── public/        favicon, icons, manifest, sw.js (service worker), og-image
│   └── src/           pages/, layouts/, components/, features/, context/, hooks/, services/, lib/, types/, utils/, styles/
├── backend/           Node.js + Express + TypeScript + Prisma
│   ├── src/           config/, routes/, controllers/, services/{ai,tutor,vision,voice,adaptive-learning,sync}, repositories/, middleware/, validators/, utils/, types/
│   ├── prisma/        schema.prisma, migrations/, seed.ts
│   ├── content/       class9-maths.json  ← editable lessons and questions, with source notes
│   ├── tests/         unit and API integration tests (Vitest + Supertest)
│   └── uploads/       temporary upload folder (files are deleted after processing)
├── docker-compose.yml local PostgreSQL
├── .gitignore
└── README.md
```

## Run it locally

You need Node.js 20+ (tested on 22.12) and Docker. If you don't have Docker, any PostgreSQL 14+ server works.

Run the backend and the frontend in two separate terminals.

```bash
# from the project root: start PostgreSQL 16 on localhost:5433
docker compose up -d db

# terminal 1 — backend (API on :5000)
cd backend
npm install
npm run db:migrate           # create the tables
npm run db:seed              # lessons, questions and synthetic demo accounts
npm run dev

# terminal 2 — frontend (web app on :5173)
cd frontend
npm install
npm run dev
```

`npm install`, `db:migrate` and `db:seed` are only needed the first time. After that, `npm run dev` in each folder is enough. Stop a server with Ctrl + C.

Open http://localhost:5173. Demo accounts hold **synthetic** data only. The password for all three is `Demo@1234`:

| Username | Role |
|---|---|
| `demo.student` | Student with about 6 days of generated practice history |
| `demo.parent` | Parent linked to the demo student |
| `demo.teacher` | Teacher linked to the demo student |

Other commands:

Run these inside `backend/` or `frontend/`:

```bash
npm run build    # production build (stop the backend dev server first on Windows)
npm run lint     # TypeScript check
npm run test     # backend: unit + API tests (needs the database); frontend: unit tests
npm run preview  # frontend only: serve the production build (service worker active) on :4173
```

## Environment

Each app has its own `.env` file, created from `.env.example`. Real `.env` files are git-ignored.

**backend/.env**
| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | At least 32 characters each, and they must differ. The local `.env` was generated with random values. |
| `AI_API_KEY` | Your Groq key. **If this is empty, the server runs in a clearly labelled demo mode** (see below). |
| `AI_MODEL`, `AI_VISION_MODEL`, `AI_STT_MODEL`, `AI_BASE_URL` | Defaults point to Groq. Any OpenAI-compatible endpoint works. |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | Use `true` and `none` when the API and web app are on different sites over HTTPS |
| `ENFORCE_HTTPS`, `TRUST_PROXY` | Set both to `true` behind a TLS-terminating proxy. HTTP is then redirected and HSTS is sent. |

The server validates every variable at startup and refuses to start if a required one is missing or invalid.

**frontend/.env** contains only public values: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_SITE_URL` (used for the sitemap, robots.txt and social image URLs) and `VITE_CONTACT_EMAIL` (the footer mailto link, hidden when empty). Never put secrets here, because everything in this file ends up in the browser.

### Enabling the AI (Groq)

1. Create a key at https://console.groq.com/keys.
2. Set `AI_API_KEY=...` in `backend/.env` and restart. `/api/health` then reports `"ai": {"mode": "live"}`.
3. Check that the model IDs in `.env` are still listed at https://console.groq.com/docs/models.

**Demo mode** (no key) does not imitate an AI. In demo mode the tutor reply is labelled *"Demo mode — not an AI answer"* and contains only:
- a deterministic calculator result, when the question contains arithmetic or a linear equation;
- the summary of the linked lesson.

Photo reading and server speech-to-text return a clear "not configured" message. Lessons, practice, quizzes, progress, offline and the guardian dashboards work fully without a key.

## Voice tutor (Hindi, English, Telugu)

The voice page (`/app/voice`) has:
- a language switch (हिंदी / English / తెలుగు);
- a microphone with a recording timer, and an editable transcript;
- hint, solution and explain modes;
- the full conversation transcript, with play, pause, replay and stop on every reply;
- a typing fallback.

Every reply is labelled with its language, so it is read aloud in the right voice.

| Step | Provider (chosen automatically from the keys in `backend/.env`) |
|---|---|
| Speech → text | `SARVAM_API_KEY` → Sarvam Saarika (best for Telugu). Otherwise `AI_API_KEY` → Groq Whisper. Otherwise the browser's speech recognition (Chrome/Edge). |
| Tutor reply | `AI_API_KEY` → Groq. Otherwise `GEMINI_API_KEY` → Gemini. Otherwise demo mode. Force one with `LLM_PROVIDER=groq\|gemini`. |
| Text → speech | `SARVAM_API_KEY` → Sarvam Bulbul (natural Telugu/Hindi voices), returned as one WAV file. Otherwise the device's `speechSynthesis`. |

**How it works:**
- **Recording:** the browser re-encodes each recording to 16 kHz mono WAV before upload, a format every provider accepts. With Sarvam, recordings stop at 30 seconds, because the synchronous API takes short clips.
- **Audio cache:** spoken replies are stored in IndexedDB. The newest 40 clips are kept, and the cache is cleared on logout.
- **Privacy:** recordings are deleted from the server right after transcription.

**Endpoints:**
- `GET /api/voice/capabilities` reports which providers are active.
- `POST /api/voice/transcribe?language=hi|en|te` takes multipart `audio`.
- `POST /api/voice/speak {text, language}` returns `audio/wav`.

**Testing it:**
1. Add a key to `backend/.env`:
   - `SARVAM_API_KEY` from https://dashboard.sarvam.ai for voice;
   - or `GEMINI_API_KEY` from https://aistudio.google.com/apikey for the tutor.
2. Restart the backend.
3. Check `GET /api/voice/capabilities`.
4. Open the voice page in Chrome on Android, choose తెలుగు, and ask a question.

Without a Sarvam key, Telugu read-aloud only works if the phone has a Telugu voice installed. The page tells you when it doesn't.

**Verification status:**
- The Groq tutor was tested live in Telugu on 2026-11-21, using `openai/gpt-oss-120b`.
- The Sarvam and Gemini request formats follow their public docs. They are covered by mocked tests (`backend/tests/voice.test.ts`) but **were not tested against the live APIs** (no keys).
- The Telugu UI strings written by the server should be reviewed by a native speaker.

**Groq models:** Groq retires models over time. In November 2026, `llama-3.3-70b-versatile` and `llama-4-scout` were no longer available on the development key, so the defaults are now:
- `AI_MODEL=openai/gpt-oss-120b` (tutor);
- `AI_VISION_MODEL=qwen/qwen3.8-27b` (photo questions; checked to accept images);
- `AI_STT_MODEL=whisper-large-v3`.

To see what your key can use, check `GET https://api.groq.com/openai/v1/models`.

## Production notes

- **Database:** run `npm --prefix backend run db:deploy` (applies migrations), then `npm --prefix backend run db:seed`. Set `SEED_DEMO=false` to skip the demo accounts.
- **Backend:** run `npm --prefix backend run build && npm --prefix backend start`. Behind a proxy, set `NODE_ENV=production`, `TRUST_PROXY=true`, `ENFORCE_HTTPS=true` and `COOKIE_SECURE=true`.
- **Frontend:** `npm --prefix frontend run build` produces `frontend/dist`. Deploy it as a static site with SPA fallback to `index.html`, and set `VITE_SITE_URL` and `VITE_API_URL` before building. The build writes `sitemap.xml`, `robots.txt` and the service worker precache list.
- Serve the frontend over HTTPS. Browsers only allow service workers, microphone access and camera capture on secure origins.

## API

All routes are under `/api`. Protected routes need `Authorization: Bearer <access token>`. The refresh token is an httpOnly cookie scoped to `/api/auth`, and it is rotated on every use; if an old token is reused, all of that user's sessions are revoked.

| Module | Endpoints |
|---|---|
| health | `GET /health` — reports database and AI mode |
| auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| users | `GET/PATCH/DELETE /users/me`, `POST /users/me/password` |
| students | `GET/PATCH /students/me`, `GET /students/me/dashboard`, `POST /students/me/link-code` |
| parents (parents and teachers) | `POST /parents/link`, `GET /parents/students`, `GET /parents/students/:id/report`, `DELETE /parents/students/:id` |
| curriculum / chapters / topics | `GET /curriculum`, `GET /curriculum/sources`, `GET /chapters`, `GET /chapters/:slug`, `GET /chapters/:slug/offline-pack`, `GET /topics/:slug`, `POST /topics/:slug/complete` |
| tutor | `GET/POST /tutor/conversations`, `GET/DELETE /tutor/conversations/:id`, `POST /tutor/conversations/:id/messages` |
| voice / vision | `GET /voice/capabilities`, `POST /voice/transcribe` (multipart `audio`), `POST /vision/extract` (multipart `image`) |
| practice | `GET /practice/next?topic=`, `POST /practice/answer`, `POST /practice/sessions`, `POST /practice/sessions/:id/end` |
| assessments | `GET /assessments`, `GET /assessments/:slug`, `POST /assessments/:slug/start`, `POST /assessments/sessions/:id/submit` |
| adaptive | `GET /adaptive/recommendations`, `POST /adaptive/recommendations/recompute`, `POST /adaptive/recommendations/:id/dismiss`, `GET /adaptive/weak-topics` |
| progress | `GET /progress/me`, `GET /progress/me/activity` |
| sync | `POST /sync` — idempotent batch of offline records |
| analytics | `POST /analytics/pageview` — anonymous, sent only after the user consents |

## Known limitations

- **Curriculum alignment.** The chapter list was checked against secondary sources only, not the official JAC notified syllabus (see `backend/content/class9-maths.json` → `meta`). All lessons are original *sample* content: 24 short lessons and 72 questions, which is too few for a full course.
- **Password reset.** Students do not give an email address, so there is no password reset.
- **Answer checking.** The calculator check confirms only the final number of arithmetic or one-variable linear answers. It does not check the reasoning, and it does not cover geometry proofs.
- **Device voices.** Without a Sarvam key, read-aloud depends on the device having a Hindi or Telugu voice. Browser speech recognition needs internet and works best in Chrome on Android.
- **Telugu content.** Lessons and questions are written in Hindi and English only. Telugu is supported in the voice/text tutor's replies, not in the lesson content.
- **Background sync.** It wakes open tabs; with no tab open, the queue syncs on the next visit. iOS Safari does not support the Background Sync API, so syncing there happens on reconnect or app open.
- **Tests.** The tests cover logic and APIs. Browser journeys were checked with a headless-browser script during development, which is not checked in. Real low-end Android devices have not been tested.
- **Legal review.** The privacy policy and terms need a legal review (e.g. against India's DPDP Act 2023) before public use.
- **No project licence yet.** The licence will be chosen after the organisers' ownership terms are reviewed.
