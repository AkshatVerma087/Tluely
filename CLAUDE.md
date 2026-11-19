# tluely

## Read first, every session
1. [PROJECT.md](PROJECT.md): what tluely is, the architecture, and the concepts.
2. [decision.md](decision.md): every architecture, system-design, and design-pattern decision. Follow them.
3. [task.md](task.md): the phased checklist. Find the first unchecked task; that is where work resumes.

Technique reference (stealth, overlay windows, audio pipeline): [analysis/FINDINGS.md](analysis/FINDINGS.md), section 7.
Use it instead of re-analyzing Cluely.

## Workflow rules
- Work through task.md in order, one sub-phase at a time. Don't start a new sub-phase until the
  previous sub-phase's ✅ check passes.
- Tick a box in task.md only when the task is done **and** verified. When you tick one, say how it was verified.
- Before implementing something that needs a new architecture, design, or library choice, add it to
  decision.md, then ask the user to confirm it. Never silently contradict an existing decision. To change one,
  add a new entry and mark the old one Superseded.
- New tasks discovered along the way go into task.md under the right sub-phase.
- Keep PROJECT.md in sync when the architecture or roadmap changes.

## Code rules
- Always write explanatory comments in code, including tests: a header comment per file saying what it is
  and why, plus comments on each non-obvious block or test explaining what it does. The user is learning from the code.
- All code lives in `app/`, and npm commands run there. Docs stay at the repo root (D-031).
- Windows only, Electron + React + TypeScript (D-001, D-002).
- Run `npm run check` (lint + format check + typecheck + tests) before ticking any code task.
  Run tests with `npm test`, never a bare `npx vitest` (drive-letter casing bug, D-032).
- When launching the app from a Claude Code / VS Code shell, unset `ELECTRON_RUN_AS_NODE` first
  (`env -u ELECTRON_RUN_AS_NODE npm run dev`). VS Code sets it to 1, which makes Electron run as plain Node and crash on `app.isPackaged`.
- API keys are used only in the main process and never sent to a renderer (D-010).
- All IPC goes through the typed contract in `src/shared/ipc.ts` (D-021).
- Never commit `analysis/cluely-src/`, which is Cluely's proprietary code (D-003).

- Inspect real windows with `powershell -ExecutionPolicy Bypass -File app/scripts/windows.ps1` while the app runs
  (position, size, capture affinity, topmost).
- When the app is launched in the background from this shell, the first normal `show()` window can start minimized
  (Windows applies the launcher's show mode). For visual checks, launch Electron directly:
  `Start-Process .\node_modules\electron\dist\electron.exe -ArgumentList . -WindowStyle Normal` (in `app/`,
  with `ELECTRON_RUN_AS_NODE` cleared, after `npx electron-vite build`).

## Working with the user
- The user is new to desktop app architecture, so explain new concepts briefly when introducing them.
