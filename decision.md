# Decision log

Every architecture, system-design, design-pattern, and tooling decision for tluely is recorded here.

**Rules**
- Add a new entry before implementing anything that depends on a new decision.
- Never delete an entry. To change one, add a new entry and mark the old one `Superseded by D-xxx`.
- Status values:
  - **Accepted**: agreed with the user
  - **Proposed**: Claude's default; open to change until the user confirms
  - **Superseded**: replaced by a later entry

Entry format:
```
## D-xxx: Title
Status · Date · Area
Decision: what we chose
Why: reasons
Alternatives: what we rejected and why
Consequences: what this means for the code
```

---

## Product and platform

## D-001: Build with Electron + React + TypeScript
Accepted · 2026-11-19 · Stack
**Decision:** Electron for the desktop shell, React for the UI, TypeScript everywhere, scaffolded with electron-vite.
**Why:** Every Cluely technique in FINDINGS.md section 7 maps directly to Electron APIs. It has the largest ecosystem and is beginner-friendly.
**Alternatives:** Tauri (small installer, but stealth and loopback audio would need custom Rust); C#/WPF (Windows-only UI, no reuse of web VAD or Markdown libraries).
**Consequences:** About 150 MB installer and higher RAM use.

## D-002: Windows only for v1
Accepted · 2026-11-19 · Platform
**Decision:** Target Windows 10 2004 and later only.
**Why:** `WDA_EXCLUDEFROMCAPTURE` needs 2004+. Focusing on one OS keeps the MVP small.
**Consequences:** OS-specific code lives in `src/main/platform/win32/` so macOS can be added later without touching the rest.

## D-003: Open source under MIT
Accepted · 2026-11-19 · Distribution
**Decision:** Public GitHub repo under the MIT license.
**Why:** Anyone can use, fork, and contribute.
**Consequences:** Never commit `analysis/cluely-src/` (Cluely's proprietary code). The README carries a responsible-use note.

## D-004: No backend; users bring their own keys
Accepted · 2026-11-19 · System design
**Decision:** The app calls AI providers directly with keys the user enters in Settings. There is no tluely server.
**Why:** No hosting cost and no accounts, so it's free to run for anyone.
**Alternatives:** Own backend (required for billing and accounts; much more work).
**Consequences:** Keys are stored on the user's PC (D-010). Providers sit behind interfaces (D-020), so a backend could be added as just another provider later.

## D-005: Answers are triggered by hotkey only
Accepted · 2026-11-19 · Product
**Decision:** The LLM is called only when the user presses the ask hotkey or submits a typed question.
**Why:** Predictable behaviour and low API usage.
**Alternatives:** Auto-answer when the other side asks a question (noisy, costly).

## D-006: MVP includes all four core features
Accepted · 2026-11-19 · Product
**Decision:** Stealth overlay + hotkeys, screenshot → answer, live transcript, typed questions + history.

---

## AI providers

## D-007: Groq is the default LLM; Claude is optional
Accepted · 2026-11-19 · AI
**Decision:** Ship two LLM providers.
- Groq: default; has a free tier; OpenAI-compatible streaming chat completions; models listed from `/models`.
- Anthropic Claude: official `@anthropic-ai/sdk`, `messages.stream`, default model `claude-opus-5-5` (changeable in Settings), adaptive thinking, low effort for speed.

**Why:** Free to start, with a high-quality paid option.
**Consequences:** The Claude adapter must check `stop_reason === "refusal"`. Screenshot questions need a vision-capable model on Groq.

## D-008: Speech-to-text with Groq Whisper
Accepted · 2026-11-19 · AI
**Decision:** `whisper-large-v3-turbo` through Groq's OpenAI-compatible `/audio/transcriptions`.
**Why:** Fast and has a free tier. Cluely transcribes on its own paid server (`api.v2.cluely.com`), so we can't use what it uses.
**Alternatives:** Deepgram streaming (paid); local Whisper (heavy).

---

## Data and security

## D-009: Session history is stored as JSON files
Accepted · 2026-11-19 · Data
**Decision:** One file per session at `userData/sessions/<id>.json`. Settings go in `userData/settings.json`.
**Why:** No native modules, easy to debug, and contributor-friendly.
**Alternatives:** SQLite (needs native rebuilds for Electron).
**Consequences:** Writes are atomic (write a temp file, then rename). Load the list lazily.

## D-010: API keys are encrypted with safeStorage and stay in the main process
Accepted · 2026-11-19 · Security
**Decision:** Keys are encrypted with Electron `safeStorage` (Windows DPAPI) and decrypted only in the main process.
**Consequences:** Renderers only learn whether a key is set (`hasKey: boolean`); they never receive the key itself.

## D-011: Hardened renderers
Accepted · 2026-11-19 · Security
**Decision:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, block navigation and `window.open`.
**Why:** Renderers show model output (untrusted Markdown), so they must not be able to reach Node.
**Implementation (2026-11-19):**
- `main/security/index.ts`: `secureWebPreferences()` for every window, and `applySecurityPolicies()` app-wide:
  - navigation is blocked to anything except our pages,
  - `window.open` is denied, and only `https:` links open in the default browser,
  - `<webview>` is forbidden,
  - permissions are denied except `media` (microphone, Phase 3) for our pages.
- `main/security/trust.ts`: "our page" means inside the app's `renderer/` folder (case-insensitive) or on the dev-server origin. Any other `file://` page is NOT trusted. It is shared by the IPC sender check and navigation blocking.
- CSP in `renderer/index.html`: `default-src 'self'`, `script-src 'self'`, `object-src/base-uri/form-action 'none'`. Phase 3 must add `'wasm-unsafe-eval'` for the VAD.

---

## Architecture and design patterns

## D-020: Providers behind Strategy / Adapter interfaces
Accepted · 2026-11-19 · Pattern
**Decision:** Define `LLMProvider` and `STTProvider` interfaces in `src/shared/types.ts`, with one adapter per vendor in `src/main/ai/`. A `ProviderRegistry` maps an id to an instance.
**Why:** Contributors add a provider by writing one file, and the rest of the app never imports vendor SDKs.

## D-021: Typed IPC contract
Accepted · 2026-11-19 · Pattern
**Decision:** One file, `src/shared/ipc.ts`, declares every channel with its request and response types. The preload exposes `window.tluely` built from that file, and the main process registers handlers against the same types.
**Why:** The compiler catches channel or payload mismatches; there are no stringly-typed channels.
**Consequences:** Use `invoke` for request/response and `send`/`on` for events from main to renderer. No other IPC is allowed.
The preload only forwards channels in the runtime allow-lists `COMMAND_CHANNELS` / `EVENT_CHANNELS`; `satisfies` keeps those lists in sync with the types. Streaming answer chunks use their own `answer:token` event instead of re-sending the full `AppState` for every token.

## D-022: Single state store in the main process (observer pattern)
Accepted · 2026-11-19 · Pattern
**Decision:** The main process owns one `AppState`: invisible flag, session status, transcript, current answer, settings. Changes go through `store.update(fn)`, which notifies subscribers. Windows subscribe and receive a `state:changed` event.
**Why:** Same as Cluely (`ye(state)` recomputed on every change). There is one source of truth, and windows stay simple views.
**Consequences:** Renderers never hold authoritative state; they send intents such as `ask` or `toggleInvisible`.

## D-023: Service modules wired at startup
Accepted · 2026-11-19 · Pattern
**Decision:** Each main-process folder (`windows/`, `stealth/`, `hotkeys/`, `capture/`, `audio/`, `ai/`, `store/`, `session/`) exports a `createXService(deps)` factory. `main/index.ts` wires them together in one place.
**Why:** Dependencies are explicit, services are testable with fakes, and there are no hidden singletons.

## D-024: The session is a state machine
Accepted · 2026-11-19 · Pattern
**Decision:** The session status is `idle → starting → live → answering ↔ live → ending → idle`. Transitions happen only through `session.dispatch(event)`.
**Why:** Prevents impossible states, such as asking while not live, and makes the 10-minute idle auto-end easy to add.

## D-025: Window factory with shared overlay options
Accepted · 2026-11-19 · Pattern
**Decision:** `createOverlayWindow(kind)` applies the shared overlay options: transparent, frameless, no shadow, always on top, `skipTaskbar`, `show: false`. Content protection is driven by state (D-022), and windows are shown with the opacity-0 trick.
**Why:** Keeps stealth behaviour consistent across windows. Matches FINDINGS.md section 4.

## D-026: Audio processing in the renderer, network calls in main
Accepted · 2026-11-19 · System design
**Decision:** Mic and loopback capture plus Silero VAD run in a hidden renderer (Web Audio + onnxruntime-web). Finished 16 kHz WAV clips go to the main process over IPC, and the main process calls STT with at most 4 requests in flight.
**Why:** VAD needs web APIs (WASM), and keys must stay in the main process (D-010).

## D-027: Abortable streaming everywhere
Accepted · 2026-11-19 · Pattern
**Decision:** Every LLM call takes an `AbortSignal`. A new ask cancels the previous one, and tokens are streamed over IPC as `answer:token` events.

---

## Tooling

## D-031: Repo layout: docs at the root, all code in `app/`
Accepted · 2026-11-19 · Repo
**Decision:** The git repo is the project root (`tluely/`) on branch `main`. All app code (package.json, src, configs) lives in `app/`. Docs (PROJECT.md, decision.md, task.md, CLAUDE.md, README, LICENSE), `analysis/` and `.github/` stay at the root.
**Why:** The user asked for a dedicated code folder. Keeping git at the root means the docs and the decision log are versioned and published together with the code.
**Consequences:**
- npm commands run inside `app/`.
- The CI workflow uses `working-directory: app`.
- Code paths in the docs (`src/...`) mean `app/src/...`.
- One root `.gitignore` covers everything; it ignores `analysis/cluely-src/`, `analysis/rea-main.json` and `analysis/capture-test/`.

## D-032: Run Vitest through a launcher that fixes the drive-letter casing
Accepted · 2026-11-19 · Tooling
**Decision:** `npm test` runs `node scripts/vitest.mjs`, which uppercases the drive letter of the working directory and then starts Vitest.
**Why:** When the shell's working directory is `d:\...` (lowercase, as VS Code often sets it), Vitest 5 loads its own module twice under two path casings, and every test fails with "Vitest failed to find the current suite". Changing the directory inside `vitest.config` is too late, because Vitest has already resolved its paths by then.
**Alternatives:** Telling contributors to always open the folder as `D:\` (fragile; fails silently).
**Consequences:** Always use `npm test` / `npm run test:watch` (or `npm run check`), never a bare `npx vitest`. The electron-vite warning "outDir ... is not inside project root" has the same cause; it doesn't affect anything yet.

## D-033: Data model rules (`src/shared/types.ts`)
Accepted · 2026-11-19 · Data
**Decision:**
- `types.ts` holds types only: no logic and no defaults.
- Data that crosses IPC or is saved to disk is plain JSON-friendly data. Times are epoch ms (`number`), and ids are UUID strings.
- Persisted shapes (`Settings`, `Session`) carry `version: 1` for future migrations.
- API keys never appear in shared types; renderers see `KeyStatus` (has key: yes/no) only.
- Audio is a `Uint8Array` (works in both main and renderer), not a Node `Buffer`.
- `Settings.models` remembers one model per provider.
- `Exchange.question` is null when only the ask hotkey was pressed.
- `LLMProvider.listModels()` doubles as the "test key" check. `streamAnswer` returns a `stopReason`, so "refused" (D-007) and "hit the length limit" can be shown to the user.

**Why:** Plain data survives IPC and JSON unchanged, version fields make later format changes safe, and one shared definition stops main and the windows from disagreeing.

## D-030: Tooling and releases
Accepted · 2026-11-19 · Tooling
**Decision:**
- npm, ESLint + Prettier, Vitest for unit tests
- electron-builder NSIS for the installer
- GitHub Actions builds a release on each `v*` tag
- `electron-updater` updates from GitHub Releases
- Conventional commit messages
