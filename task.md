# Tasks

Check a box (`[x]`) only once the task is done **and** verified. Work top to bottom, one sub-phase at a time.
Each sub-phase ends with a ✅ check that must pass before moving on. Decision IDs (D-xxx) refer to [decision.md](decision.md).
All code paths (`src/...`) are inside `app/`, and npm commands run in `app/` (D-031).

---

## Phase 0: Project foundation

### 0.1 Docs and repo
- [x] Write PROJECT.md (overview, concepts, architecture)
- [x] Write decision.md (decision log)
- [x] Write task.md (this file)
- [x] Write CLAUDE.md (working rules)
- [x] Create `app/` folder for all code (D-031)
- [x] `git init` at the project root on `main` branch
- [x] Root `.gitignore`: node_modules, build output, env files, `analysis/cluely-src/`, `analysis/rea-main.json`, `analysis/capture-test/`
- [x] Add MIT `LICENSE` (D-003)
- [x] ✅ `git status` shows no Cluely source files (verified 2026-11-19: only docs, FINDINGS.md and scripts listed)

### 0.2 Scaffold the app
- [x] Create electron-vite React + TS project inside `app/` (D-001, D-031). Verified 2026-11-19: `npm run build` passes (typecheck + build) and `electron-vite preview` opens a window. Versions: Electron 44, Vite 8, React 19, TS 5.9
- [x] Remove the template demo code. Verified 2026-11-19: build and lint pass, no demo references remain, and the app opens a window titled "tluely". macOS/Linux build config and files were removed as well (D-002)
- [x] Set up the folder layout from PROJECT.md section 5 (placeholder `index.ts` per service, `src/shared/` with `@shared` alias in vite + both tsconfigs)
- [x] ✅ `npm run dev` opens a blank window (verified 2026-11-19: window "tluely" appeared within 5 s; build + lint pass)

### 0.3 Code quality tooling
- [x] ESLint + Prettier configs, `npm run lint`, `npm run format`, `npm run format:check`
- [x] `npm run typecheck` (main + preload + renderer tsconfigs; `vitest.config.mts` and `src/shared` included)
- [x] Vitest set up with one sample test, `npm test` (D-030). Runs through `scripts/vitest.mjs` to work around the Windows drive-letter casing bug (D-032)
- [x] ✅ lint, typecheck and test all pass. Verified 2026-11-19: `npm run check` exits 0 from a lowercase `d:\` cwd

### 0.4 Core skeleton (patterns)
- [x] `src/shared/types.ts`: `AppState`, `LLMProvider`, `STTProvider`, `Settings`, `Session` types (plus `TranscriptLine`, `Exchange`, `SessionSummary`, `KeyStatus`, `AnswerRequest`, `AudioClip`; rules in D-033). Verified 2026-11-19: `npm run check` passes
- [x] `src/shared/ipc.ts`: typed channel map (D-021): 19 commands, 4 events, runtime allow-lists, and the `TluelyApi` type for `window.tluely`. Verified 2026-11-19: `npm run check` passes, 2 tests in `ipc.test.ts`
- [x] `src/preload/index.ts`: expose `window.tluely` from the channel map (runtime allow-list, payload-only events, refuses to run without contextIsolation). `window.electron` and `@electron-toolkit/preload` removed. Verified 2026-11-19: `npm run check` and the build pass. Runtime round-trip is covered by the 0.4 ✅ ping check
- [x] `src/main/store/state.ts`: `AppState` store with `update()` + `subscribe()` (D-022). Immutable updates, no notification on no-op, listener errors isolated. Verified 2026-11-19: 6 unit tests in `state.test.ts`, `npm run check` passes (8 tests total)
- [x] `src/main/index.ts`: wire services with `createXService(deps)` (D-023). Includes the composition root, `main/ipc.ts` (`handleCommands` with trusted-sender check, `broadcast`), `windows/` service pushing `state:changed`, `store/defaults.ts`, and the commands `ping`, `state:get`, `invisible:set`. Verified 2026-11-19: `npm run check` passes (11 tests) and the app launches with no errors
- [x] Harden renderers: contextIsolation, sandbox, CSP, block navigation (D-011). Also: `https`-only external links, no `<webview>`, permission policy (mic only), and a precise trusted-URL check shared with IPC. Verified 2026-11-19: `npm run check` passes (19 tests, 8 new in `trust.test.ts`), and both preview and dev launch sandboxed with no preload errors or CSP violations in the Chromium log
- [x] ✅ A test IPC `ping` round-trips; a state change reaches the renderer. Verified 2026-11-19 with an automatic self-check in `App.tsx`, in both `preview` (file://) and `dev` (Vite server), sandboxed. Log: `PASSED ping round trip reply: pong`, `PASSED state change reaches renderer invisible: true -> false`. No CSP or preload errors. The self-check UI is temporary; Phase 1.1 replaces it

---

## Phase 1: Stealth overlay and hotkeys

### 1.1 Overlay windows
- [x] `windows/factory.ts`: `createOverlayWindow(kind)` with shared options (D-025). Pure `overlay-options.ts` + Electron `factory.ts`; pages load with `?window=<kind>` (D-034, Proposed). Verified 2026-11-19: `npm run check` passes (26 tests, 7 new). Not yet run in the app; the first real use is the control bar window, next
- [x] Control bar window (~200×50, top-centre of the primary screen). Built by the factory, single instance, shown with `showInactive`, positioned by the pure `layout.ts#topCenter` on the primary work area (3 unit tests). Verified 2026-11-19 with `scripts/windows.ps1`: `rect=860,12 200x50`, `centerOffsetX=0`, `topmost=True` on a 1920×1032 work area. Taskbar: user confirmed one icon only (the temporary window). Alt+Tab: excluded, because `focusable:false` gives `WS_EX_NOACTIVATE` (`windows.ps1` → `altTab=False`)
- [x] Answer panel window (~540×140–500, below the bar, grows with content). **Create it with `parent: controlBar`** (owned window): it is focusable, so `skipTaskbar` alone would leave it in Alt+Tab. Done: positioned by `layout.ts#below` (8 px gap, clamped to the work area); `useReportHeight` (ResizeObserver) → `window:resizePanel` IPC → `clampOverlayHeight` (140–500). Verified 2026-11-19: `rect=690,70 540x167` (grew past 140 to fit the placeholder), `owned=True`, screenshot shows it under the bar
- [x] `windows.ps1` reports `altTab=False` for every overlay window. Verified 2026-11-19: control bar `altTab=False (noactivate)`, answer panel `altTab=False (owned)`
- [x] Renderer routes/entries for control-bar and answer-panel (remove the temporary IPC self-check from `App.tsx`). Done: `shared/windows.ts` (`WindowKind`, `windowKindFromSearch`; 6 tests), `routes.tsx` (typed `Record<WindowKind, lazy>`, one code chunk per window), `Root.tsx` (Suspense + error for unknown kind). Removed `App.tsx`, the temporary main window and its CSS; added the `app:quit` command. Verified 2026-11-19: `npm run check` passes (45 tests), the build emits separate chunks per window, both overlays render (screenshot), the panel resizes via IPC (`540x167`), and the log is clean. Note: until the tray exists (1.4), quit with Ctrl+C in the `npm run dev` terminal
- [x] Minimal UI: bar shows status + invisible toggle; panel shows placeholder text. Done: `hooks/useAppState` (`state:get` + `state:changed`), control bar = status dot/label (`control-bar/status.ts`, 6 tests) + eye toggle + quit; panel = placeholder text + hotkey hints. Fixed: quit was refused because overlays are `closable:false`, so they are now destroyed on `before-quit`. Verified 2026-11-20 with a simulated-click test: the eye click flipped the icon (invisible → visible via IPC round trip, without focus), the ✕ click left 0 processes, the log is clean, and screenshots look right
- [x] ✅ Both windows appear transparent, frameless, on top, not in the taskbar or Alt+Tab. Verified 2026-11-20 on the current build:
  - `windows.ps1`: both overlays `frameless=True topmost=True altTab=False`.
  - Taskbar via UI Automation: 21 buttons scanned, no tluely/Electron button. Positive control: a plain Electron window WAS detected ("Electron - 1 running window"), so the scan works.
  - Transparency: pixels outside the rounded shapes are identical to the baseline screenshot (bar corner, panel corner); pixels inside the shapes changed.

### 1.2 Stealth
- [x] `stealth/`: apply `setContentProtection(state.isInvisible || state.isCapturing)` on every state change. Done: pure `stealth/protection.ts#shouldProtect` (`invisible || capturing`); `createStealthService({ store })` with `protect(window)`, called by the window service on each overlay before its first show; re-evaluated on every state change, Win32 call only when the value flips; closed windows forgotten. Verified 2026-11-20: `npm run check` passes (62 tests, 11 new in `stealth.test.ts`). In the built app, `windows.ps1` shows both overlays `affinity=WDA_EXCLUDEFROMCAPTURE` at startup (invisible by default). After a simulated click on the eye toggle they show `WDA_NONE`, and after a second click `WDA_EXCLUDEFROMCAPTURE` again. Quit via ✕ left 0 processes
- [x] Opacity-0 → show → opacity-1 after 30 ms show trick. Done: `stealth.show(window)`: protect → `setOpacity(0)` → `showInactive()` → `setOpacity(1)` after `SHOW_REVEAL_DELAY_MS` (30). Re-showing restarts the timer; close/dispose cancel it. The window service now shows both overlays through it on `ready-to-show`. Verified 2026-11-21: `npm run check` passes (67 tests, 5 new). A Win32 trace of the real launch (polling `IsWindowVisible` + `GetLayeredWindowAttributes`) showed both overlays hidden → `visible alpha=0` at 368 ms → `alpha=255` at 399 ms (31 ms later). `windows.ps1` afterwards: both `WDA_EXCLUDEFROMCAPTURE`, not in the taskbar or Alt+Tab. VS Code kept the foreground (no focus stolen). Quit via ✕ left 0 processes
- [ ] Optional "don't take focus" setting (`focusable: false`, re-apply `skipTaskbar`)
- [x] Copy `analysis/scripts/affinity.ps1` → `app/scripts/windows.ps1` targeting tluely (also reports work area, centre offset, topmost and toolwindow flags). Done 2026-11-19 during 1.1
- [ ] ✅ affinity.ps1 reports `WDA_EXCLUDEFROMCAPTURE` (0x11) when invisible is on, `WDA_NONE` when off
- [ ] ✅ Google Meet screen share: overlay not visible on the other side

### 1.3 Hotkeys
- [ ] `hotkeys/`: register defaults (Ctrl+Enter ask, Ctrl+\ hide/show, Ctrl+arrows move, Ctrl+R clear, Ctrl+Shift+S start/stop)
- [ ] Unregister on quit; log conflicts when a key is already taken
- [ ] Move commands clamp the windows to the screen work area
- [ ] ✅ Every hotkey works while another app (browser) has focus

### 1.4 Tray and settings window
- [ ] Tray icon with Show/Hide, Settings, Quit (hidden while invisible mode is on)
- [ ] Normal (non-overlay) Settings window shell
- [ ] ✅ Quit from the tray exits cleanly with no leftover processes

---

## Phase 2: Ask → streaming answer

### 2.1 Settings and key storage
- [ ] `store/settings.ts`: load/save `settings.json` atomically (D-009)
- [ ] `store/keys.ts`: safeStorage encrypt/decrypt; IPC only exposes `hasKey` (D-010)
- [ ] Settings UI: provider select, model select, API key fields, invisible default, focus option
- [ ] ✅ Restarting the app keeps settings; the key file is not readable as plain text

### 2.2 Provider layer
- [ ] `ai/registry.ts`: `ProviderRegistry` (D-020)
- [ ] `ai/groq.ts`: list models, streaming chat with image + text (D-007)
- [ ] `ai/anthropic.ts`: `@anthropic-ai/sdk` `messages.stream`, default `claude-opus-5-5`, adaptive thinking, low effort, refusal handling (D-007)
- [ ] "Test key" button in Settings calls a tiny request
- [ ] Unit tests with mocked HTTP for both adapters
- [ ] ✅ Test key succeeds for valid keys and shows a clear error for invalid ones

### 2.3 Screenshot capture
- [ ] `capture/`: set `isCapturing`, `desktopCapturer` grab of the overlay's screen, downscale ≤1920 px PNG, clear flag
- [ ] 3 retries, 500 ms apart
- [ ] ✅ The saved debug screenshot does not contain the overlay

### 2.4 Ask flow
- [ ] `ai/prompt.ts`: build the prompt (system + transcript + screenshot + question)
- [ ] Ask hotkey → screenshot → `streamAnswer` → `answer:token` events (D-027)
- [ ] A new ask aborts the previous one; Esc/clear aborts
- [ ] ✅ Tokens appear live within ~1–2 s of pressing the hotkey

### 2.5 Answer panel UI
- [ ] Streaming Markdown rendering with code highlighting
- [ ] Typed question input (focus via hotkey), Enter sends
- [ ] Scroll hotkeys, copy button, loading and error states
- [ ] ✅ A code-heavy answer renders correctly while streaming

---

## Phase 3: Live transcript

### 3.1 Session state machine
- [ ] `session/`: states idle → starting → live → answering ↔ live → ending (D-024)
- [ ] Start/stop from hotkey and control bar; 10-min idle auto-end
- [ ] ✅ Unit tests cover every transition, including invalid ones

### 3.2 Audio capture
- [ ] Hidden audio-worker renderer window (D-026)
- [ ] Mic via `getUserMedia`
- [ ] System audio via `setDisplayMediaRequestHandler` → `{ video, audio: 'loopback' }` + `getDisplayMedia`
- [ ] Mic device picker in Settings
- [ ] ✅ Level meters show activity for both "me" and "them"

### 3.3 Voice activity detection
- [ ] Bundle Silero VAD + onnxruntime-web into `resources/vad/` (no CDN)
- [ ] Add `'wasm-unsafe-eval'` to the CSP `script-src` (only the audio-worker page if possible) (D-011)
- [ ] One VAD per speaker; 300 ms silence ends a phrase, 300 ms pre-pad, 20 s max
- [ ] Mute mic input while "them" is speaking (echo trick)
- [ ] Resample to 16 kHz and encode WAV; queue cap of 16 per speaker
- [ ] ✅ Speaking produces one clip per phrase; silence produces none

### 3.4 Transcription
- [ ] `ai/groq-whisper.ts`: `STTProvider` (D-008)
- [ ] Main-process queue with at most 4 in flight; placeholder lines with "transcribing…" status
- [ ] Transcript view in the panel, with "me" and "them" labels
- [ ] Feed the transcript into the ask prompt
- [ ] ✅ YouTube video + talking: both speakers transcribed within ~1–2 s of each pause

---

## Phase 4: History and polish

### 4.1 Session history
- [ ] Save each session (transcript + Q&A) to `sessions/<id>.json` on end
- [ ] History list + detail view in the Settings window; delete session
- [ ] ✅ Past sessions survive restarts and open correctly

### 4.2 Polish
- [ ] Hotkey customisation in Settings
- [ ] Auto-start at login option
- [ ] Custom system prompt / "context" field (e.g. résumé, job description)
- [ ] Error toasts for network/key/rate-limit failures
- [ ] ✅ Pull the network cable mid-answer: clear error, app recovers

---

## Phase 5: Release

### 5.1 Packaging
- [ ] `electron-builder.yml`: NSIS installer, app icon, appId
- [ ] ✅ `npm run build:win` produces an installer that installs and runs on a clean user profile

### 5.2 CI and updates
- [ ] GitHub Actions: lint + typecheck + test on PRs
- [ ] GitHub Actions: build + publish to GitHub Releases on `v*` tags (D-030)
- [ ] `electron-updater` checks GitHub Releases
- [ ] ✅ Install v0.1.0, publish v0.1.1, app updates itself

### 5.3 Open-source readiness
- [ ] README: features, screenshots/GIF, install, getting free Groq key, hotkeys, SmartScreen note, responsible-use note
- [ ] CONTRIBUTING.md (setup, adding a provider, commit style)
- [ ] Issue + PR templates
- [ ] ✅ A fresh clone following only the README reaches a working app
