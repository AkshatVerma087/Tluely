# tluely: project overview

This is the single source of truth for what tluely is, what has been decided, and how it is built.
Update it whenever a decision changes.

## 1. What tluely is

tluely is an open-source (MIT), Windows-only desktop AI assistant for meetings. It runs as a small
always-on-top overlay that:

- is hidden from screen sharing and screenshots,
- listens to the meeting (your microphone and the system audio) and transcribes it live,
- and, when you press a hotkey, sends a screenshot plus the transcript to an LLM and streams the answer
  into the overlay.

There is no tluely server. Each user brings their own API keys (BYOK), and the app calls the AI providers
directly from their PC.

The design is based on our teardown of Cluely, in [analysis/FINDINGS.md](analysis/FINDINGS.md). Section 7
of that file, "Build-it-yourself recipe", is the technique reference.

## 2. Decisions

The full decision log, with reasons and alternatives, is in [decision.md](decision.md). Summary:

| Topic | Decision |
|---|---|
| Stack | Electron + React + TypeScript, scaffolded with electron-vite |
| OS | Windows 10 version 2004 or newer only. Platform-specific code is kept separate so macOS can be added later |
| Backend | None. Keys are entered in Settings, encrypted with Electron `safeStorage` (Windows DPAPI), and used only in the main process |
| LLM | **Groq** (default, has a free tier, OpenAI-compatible streaming API) and **Anthropic Claude** (`@anthropic-ai/sdk`, streaming, default model `claude-opus-5-5`, selectable in Settings) |
| Speech-to-text | Groq Whisper, model `whisper-large-v3-turbo` (Cluely transcribes on its own paid server) |
| Answer trigger | Hotkey only (no automatic answers) |
| History | One JSON file per session in `%APPDATA%/tluely/sessions/` |
| License | MIT |
| Releases | A GitHub Actions workflow builds an NSIS `.exe` on each version tag and publishes it to GitHub Releases. `electron-updater` updates from there |
| MVP features | Stealth overlay + hotkeys, screenshot → AI answer, live transcript, typed questions + history |

## 3. Concepts for Windows desktop apps

| Term | Meaning |
|---|---|
| **Electron** | Builds desktop apps from Chromium (to show web pages) plus Node.js (to access the OS). VS Code, Discord, and Cluely are built with it |
| **Main process** | The single Node.js process that owns the app. It creates windows, registers hotkeys, captures audio and screenshots, reads and writes files, and holds API keys |
| **Renderer process** | Each window is a separate web page (here, a React app) running in its own process. It draws the UI and has no direct OS access |
| **Preload script** | A small script that runs before each page loads. It exposes a safe, limited API such as `window.tluely.ask()` from the main process to the page |
| **IPC** | Inter-process communication: the messages exchanged between main and renderer processes. `invoke` is a request that gets a reply; `send` and `on` are one-way events |
| **DWM** | Desktop Window Manager, the part of Windows that combines all windows into the image you see. It also produces a separate copy of the screen image for screen-capture apps |
| **Content protection** | `win.setContentProtection(true)` calls `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`. DWM leaves the window out of the copy given to capture apps, so Zoom, Meet, Teams, and OBS can't see it |
| **WASAPI loopback** | A Windows audio API that records whatever is playing through your speakers. We use it to capture the other people in a meeting |
| **VAD** | Voice activity detection: a small local model (Silero) that detects when someone starts and stops speaking, so only speech is sent for transcription |
| **safeStorage / DPAPI** | Windows encryption tied to the logged-in user account, used to store API keys on disk |
| **NSIS** | The installer format used to produce `tluely-Setup.exe` |
| **Code signing / SmartScreen** | Unsigned installers trigger a "Windows protected your PC" warning. Signing requires a paid certificate, so it's deferred |

## 4. Architecture

```
┌──────────────────────── Main process (Node, TS) ────────────────────────┐
│ windows/   ControlBar, AnswerPanel, Settings (BrowserWindow factory)     │
│ stealth/   setContentProtection(isInvisible || isCapturing), opacity-0   │
│            show trick, focusable toggle, skipTaskbar                     │
│ hotkeys/   globalShortcut: ask, toggle-hide, move, clear, start/stop      │
│ capture/   desktopCapturer screenshot (≤1920px PNG, protection forced on) │
│ audio/     setDisplayMediaRequestHandler → {video, audio:'loopback'}      │
│ ai/        LLMProvider (groq.ts, anthropic.ts), STTProvider (groq-whisper)│
│ store/     settings.json, keys (safeStorage), sessions/*.json             │
│ session/   state machine + transcript, 10-min idle auto-end              │
└──────────────▲───────────── typed IPC via preload ─────────────▲─────────┘
               │ invoke / events                                  │
┌──────────────┴────────────── Renderers (React) ─────────────────┴────────┐
│ ControlBar · AnswerPanel (streaming markdown) · Settings/History         │
│ audio worker: getUserMedia(mic) + getDisplayMedia(loopback)              │
│   → Silero VAD per speaker (@ricky0123/vad-web, bundled locally)         │
│   → 16 kHz WAV clips → IPC → main → Groq Whisper (max 4 in flight)       │
└──────────────────────────────────────────────────────────────────────────┘
```

### What happens when you press the "ask" hotkey

1. The main process turns capture protection on and screenshots the screen the overlay is on.
2. It builds a prompt from the system instructions, the transcript so far, the screenshot, and any typed question.
3. It calls `LLMProvider.streamAnswer(request, onToken, abortSignal)` for the selected provider.
4. Each token is sent over IPC to the AnswerPanel, which renders it as Markdown as it arrives.

### Key interfaces (`src/shared/types.ts`)

- `LLMProvider { id; listModels(); streamAnswer(req, onToken, signal): Promise<void> }`
- `STTProvider { transcribe(wav: Buffer, lang?): Promise<string> }`
- `IpcApi`: one typed map of IPC channels to their payloads, shared by the main process, preload, and renderer

To add a new AI provider, implement `LLMProvider` in `src/main/ai/` and register it.

### Security rules

- API keys never reach a renderer. Only the main process reads or uses them.
- Renderers run with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`.

## 5. Repo layout

The git repo is the project root (branch `main`). All code lives in `app/` (D-031).
```
tluely/                     ← git repo root
  PROJECT.md  decision.md  task.md  CLAUDE.md  README.md  LICENSE  CONTRIBUTING.md  .gitignore
  .github/workflows/        CI + release (working-directory: app)
  analysis/                 Cluely teardown. Only FINDINGS.md and scripts/ are committed;
                            cluely-src/ is Cluely's proprietary code and is git-ignored
  app/                      ← all code; run npm commands here
    package.json  electron.vite.config.ts  electron-builder.yml  tsconfig*.json
    src/main/{index.ts, windows/, stealth/, hotkeys/, capture/, audio/, ai/, store/, session/, platform/win32/}
    src/preload/index.ts
    src/renderer/{control-bar/, answer-panel/, settings/, audio-worker/}
    src/shared/{types.ts, ipc.ts}   imported as `@shared/...` from main, preload and renderer
    resources/vad/          Silero model + onnx wasm, bundled locally
```

## 6. Roadmap

The detailed checklist is in [task.md](task.md). Phases:

| Phase | Scope |
|---|---|
| 0 Foundation | Docs, git, scaffold, tooling, core skeleton (typed IPC, state store) |
| 1 Overlay | Overlay windows, stealth, hotkeys, tray |
| 2 Ask | Settings + keys, Groq/Claude providers, screenshot, streaming answer |
| 3 Transcript | Session state machine, audio capture, VAD, Groq Whisper |
| 4 Polish | History, customisation, error handling |
| 5 Release | Installer, CI, auto-update, open-source docs |

## 7. How to verify

- Every milestone: `npm run dev`, try the feature by hand, then run `npm run typecheck` and `npm run lint`.
- Stealth: `analysis/scripts/affinity.ps1` (pointed at the tluely process) should report `WDA_EXCLUDEFROMCAPTURE`.
  Then share your screen in Google Meet and confirm the overlay isn't visible to the other side.
- AI: ask with a Groq key and with a Claude key, and check that tokens stream in and that abort works.
- Transcript: play a video (system audio) and speak (mic), and check that both speakers appear, labelled correctly.
- Release: tag `v0.1.0`, install the built `.exe`, and check that the update check runs.
