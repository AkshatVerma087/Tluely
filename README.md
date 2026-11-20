# tluely

An open-source (MIT), Windows-only desktop AI assistant for meetings. It runs as a small always-on-top
overlay that is hidden from screen sharing. It transcribes the meeting live and, when you press a hotkey,
sends a screenshot plus the transcript to an LLM and streams the answer into the overlay.

There is no tluely server: each user brings their own API keys (Groq by default, Anthropic Claude optional),
and the app calls the providers directly from their PC.

> **Status: early development.** Phase 0 (foundation) and Phase 1.1 (overlay windows) are done, and
> Phase 1.2 (stealth) is in progress. There is no AI, audio or settings UI yet. See [task.md](task.md) for the
> exact checklist.

---

## Getting started

### Prerequisites
- **Windows 10 version 2004 or newer** (screen-capture exclusion needs 2004+). macOS and Linux are not supported.
- **Node.js 22** and npm.
- Git.

### Setup
```bash
git clone https://github.com/AkshatVerma087/Tluely.git
cd Tluely/app          # all code and npm commands live in app/
npm install
npm run dev            # starts the app with hot reload
```

You should see a small pill-shaped control bar at the top centre of your screen, with an answer panel below
it. To quit, click the ✕ on the bar (or press Ctrl+C in the terminal).

> **Running from a VS Code terminal?** VS Code sets `ELECTRON_RUN_AS_NODE=1`, which makes Electron run as
> plain Node and crash on startup. Unset it first:
> `env -u ELECTRON_RUN_AS_NODE npm run dev` (Git Bash) or `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell).

### npm scripts (run inside `app/`)
| Command | What it does |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm run check` | Lint + format check + typecheck + tests. **Run before every commit** |
| `npm test` | Unit tests (Vitest). Always use this, never a bare `npx vitest` (see D-032) |
| `npm run test:watch` | Tests in watch mode |
| `npm run format` | Auto-format with Prettier |
| `npm run build:win` | Build the Windows installer |

---

## Docs: read these first

| File | What's in it |
|---|---|
| [PROJECT.md](PROJECT.md) | What tluely is, the architecture diagram, and desktop-app concepts (main/renderer process, IPC, DWM, content protection, ...) |
| [decision.md](decision.md) | Every architecture and design decision (D-xxx), with reasons and rejected alternatives |
| [task.md](task.md) | The phased checklist. The first unchecked box is where work resumes |
| [CLAUDE.md](CLAUDE.md) | Working rules for the project (also used by the Claude Code AI assistant) |
| [analysis/FINDINGS.md](analysis/FINDINGS.md) | Technical teardown of how Cluely's overlay hides from screen share. Section 7 is the technique reference we build from |

---

## Architecture in one minute

tluely is an Electron app with two kinds of processes:

- **Main process** (`app/src/main/`, Node.js): owns the app state, creates windows, and will handle hotkeys,
  screenshots, audio and AI calls. API keys live **only** here.
- **Renderer processes** (`app/src/renderer/`, React): one per window (control bar, answer panel, later
  settings and a hidden audio worker). They only display state and send requests ("intents") to main.

```
app/src/
  main/        index.ts = composition root; one folder per service:
               windows/  stealth/  hotkeys/  capture/  audio/  ai/  store/  session/  security/
  preload/     exposes the typed window.tluely API to pages
  renderer/    React UI; the page reads ?window=<kind> to pick which window to render
  shared/      types.ts (data shapes) and ipc.ts (the typed IPC contract), imported as @shared/...
```

Key patterns (details in decision.md):
- **Single state store in main** (D-022): change state only with `store.update(fn)`. Windows receive
  `state:changed` and re-render.
- **Services wired in one place** (D-023): each folder exports `createXService(deps)`, and `main/index.ts`
  connects them. No hidden singletons, so services are easy to test with fakes.
- **Typed IPC** (D-021): every channel is declared once in `src/shared/ipc.ts`. Don't add ad-hoc IPC.
- **Hardened renderers** (D-011): `contextIsolation`, `sandbox`, strict CSP, no navigation.
- **Stealth** (D-025): overlays use `setContentProtection(invisible || capturing)`, which on Windows is
  `WDA_EXCLUDEFROMCAPTURE`. Windows keeps them off screen shares and screenshots but still draws them on your monitor.

---

## Contributing workflow

1. Open [task.md](task.md) and take the first unchecked task in the current sub-phase. Finish a sub-phase,
   including its ✅ check, before starting the next one.
2. If the task needs a new architecture, library or design choice, add an entry to
   [decision.md](decision.md) first and agree on it. Don't silently contradict an existing decision; to change one,
   add a new entry and mark the old one *Superseded*.
3. Write code with **explanatory comments**: a header comment per file (what and why) and comments on
   non-obvious blocks and tests. Many contributors are learning from this code.
4. Run `npm run check`. Tick the box in task.md only when the task is done **and** verified, and note how you verified it.
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:` ...).

### Hard rules
- **API keys never leave the main process** and are never sent to a renderer (D-010).
- **Never commit `analysis/cluely-src/`**, which is Cluely's proprietary code. It is git-ignored; keep it that way (D-003).
- Windows only for v1. OS-specific code goes in `app/src/main/platform/win32/` (D-002).

### Handy debugging tools
- `powershell -ExecutionPolicy Bypass -File app/scripts/windows.ps1`: while the app is running, lists the tluely
  windows with position, size, capture affinity (`WDA_EXCLUDEFROMCAPTURE` / `WDA_NONE`), topmost and Alt+Tab state.
- Press F12 in a window during `npm run dev` to open DevTools.

---

## Responsible use

tluely is a general-purpose assistant. Don't use it where it breaks the rules you've agreed to, such as exams,
interviews or meetings that forbid AI assistance, or where recording others needs their consent.

## License

[MIT](LICENSE)
