# Cluely teardown: how it stays invisible and answers in real time

Everything found while reverse engineering Cluely on this PC (Windows 11 build 26300), in one place.

| | |
| --- | --- |
| App | Cluely v2, version **2.0.200** |
| Installed at | `%LOCALAPPDATA%\Programs\cluely-v2\` |
| Built with | **Electron 40.8.0** (Chrome 144) |
| Code analyzed | `resources\app.asar` (29 MB), extracted to `analysis/cluely-src/` |
| Main process | `analysis/cluely-src/dist-electron/main.js` (17,081 lines, original file names kept as `//#region` markers) |
| UI (renderer) | `analysis/cluely-src/dist/assets/*.js` |
| REA output | `analysis/rea-main.json` |

All line numbers below refer to `dist-electron/main.js` unless another file is named.

---

## Contents

1. [Tools and method](#1-tools-and-method)
2. [What is inside the app](#2-what-is-inside-the-app)
3. [How it is invisible on screen sharing](#3-how-it-is-invisible-on-screen-sharing)
4. [Other ways it hides](#4-other-ways-it-hides)
5. [How it answers in real time](#5-how-it-answers-in-real-time)
6. [What can still detect it](#6-what-can-still-detect-it)
7. [Build-it-yourself recipe](#7-build-it-yourself-recipe)
8. [Reproduce this analysis](#8-reproduce-this-analysis)

---

## 1. Tools and method

- **REA** (`rea-agents` 6.7.0, from github.com/morluto/rea) installed globally with
  `npm install --global rea-agents`. It's also registered as an MCP server in Claude Code
  (`rea setup --client claude_code --yes`), with its skill in `~/.claude/skills/reverse-engineer-anything`.
- Cluely is an Electron app, so no native disassembler (Ghidra/IDA/Hopper) was needed.
  The JavaScript ships inside `app.asar` and is bundled but readable.
- Steps:
  1. Extracted `app.asar` with `npx @electron/asar extract`.
  2. Ran `rea analyze-javascript-application` on the main process for its module/IPC map.
  3. Searched the code for window, capture, audio and network APIs, and read each hit.
  4. Checked the live running app's windows with the Windows API.
  5. Reproduced the hiding trick with a test window and screenshots (section 3.4).

---

## 2. What is inside the app

```
resources/
  app.asar                      the app's JavaScript
    dist-electron/main.js       main process: windows, audio, screenshots, hotkeys
    dist-electron/preload.mjs   exposes ipcRenderer + platform to the UI
    dist/                       React UI (control bar, chat, dashboard)
  app.asar.unpacked/            native protocol-handler module (deep links)
  extra-resources/
    sox-14.4.1-win32/sox.exe    microphone recorder (Windows)
    sox-14.4.2-macosx/sox       microphone recorder (macOS)
    audiotee-0.0.7/audiotee     system-audio capture (macOS)
    vad/                        Silero voice-activity model + onnxruntime-web
  app-update.yml                updates from a Cloudflare R2 bucket
```

Servers it talks to: `api.v2.cluely.com` (API), `renderer.v2.cluely.com` (UI origin),
`ph.cluely.com` (PostHog analytics). Login uses Clerk.

Windows it creates (one region each in `main.js`):

| Window | Created at | Size | Purpose | Hidden from capture? |
| --- | --- | --- | --- | --- |
| Control bar | 15449 | 163×50 | small pill at top of screen | yes, when invisible mode is on |
| Chat | 15528 | 540×140–500 | answers panel under the bar | yes, when invisible mode is on |
| Dashboard | 15583 | 1050×700 | normal settings/history window | yes, when invisible mode is on |
| Meeting popup | 15638 | 360×300 | "upcoming meeting" toast | yes, when invisible mode is on |
| Onboarding, Splash, Auth | 15676, 15718, 15758 | — | setup and login | **no** |

---

## 3. How it is invisible on screen sharing

### 3.1 The one line that does it

`main.js:15822`
```js
function ye(state) {
  return state.isInvisible || state.isCapturingScreenshot;
}
```
Every time the app's state changes, each window runs:
```js
win.setContentProtection(ye(state));   // 15403, 15499, 15572, 15631
```
- `isInvisible` is the user's "Undetectability" setting (the v1 app stored it in a file
  called `undetectability.enabled`, migrated at `main.js:16383`).
- `isCapturingScreenshot` is set to true for the moment Cluely screenshots your screen for
  the AI (`main.js:16782`), so the overlay is never in its own screenshot, even with invisible mode off.

### 3.2 What `setContentProtection` does on Windows

Electron's `setContentProtection(true)` calls the Windows API:

```c
SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);   // value 0x11
```

How that hides the window:

1. On Windows, every app draws into its own off-screen buffer. The **Desktop Window Manager
   (DWM)** composites all those buffers into the final image.
2. DWM produces **two** results: the one sent to your monitor, and the one handed to any
   program that asks for "what's on the screen".
3. A window marked `WDA_EXCLUDEFROMCAPTURE` is drawn into the monitor image but **left out of
   the capture image**. Whatever is behind it shows through instead, so there's no black box
   or outline.
4. Every screen-capture path reads from DWM's capture image:
   - `BitBlt` / `CopyFromScreen` (classic screenshots, Print Screen, Snipping Tool)
   - DXGI Desktop Duplication (OBS "Display Capture", many recorders)
   - `Windows.Graphics.Capture` (Chrome/Edge `getDisplayMedia`, so Google Meet and any web
     meeting app, plus Teams, Zoom and Discord)

   So in a Zoom/Meet/Teams screen share, the other side sees your screen without Cluely on it.
5. It needs Windows 10 version 2004 or newer. On older Windows, the protected window
   shows up in captures as a solid black rectangle.

macOS equivalent: `NSWindow.sharingType = .none`, which ScreenCaptureKit and the older
capture APIs respect.

### 3.3 Why the window still looks normal to you

Content protection only affects the capture image. The monitor image is untouched, so on
your own display the window looks like any other window.

### 3.4 Proof on this PC

I ran a test script that opens a bright red always-on-top window and screenshots that screen
area with `CopyFromScreen` three times. Screenshots are in `analysis/capture-test/`.

| Screenshot | Window flag | Result |
| --- | --- | --- |
| `1-normal.png` | none | red box clearly visible |
| `2-excludefromcapture.png` | `WDA_EXCLUDEFROMCAPTURE` (0x11, what Electron uses) | red box **gone**; the content behind it is captured instead |
| `3-monitor.png` | `WDA_MONITOR` (0x1, older flag) | also gone on this Windows build |

The window stayed on screen the whole time. `GetWindowDisplayAffinity` confirmed the flag read back as 17 (0x11).

### 3.5 The live Cluely process

I enumerated Cluely's windows with `EnumWindows` + `GetWindowDisplayAffinity`. Cluely was
still on its **onboarding** screen (the visible 1100×720 window), and every window reported
`WDA_NONE`. That matches the code: onboarding/splash/auth windows never call
`setContentProtection`, and the overlays are only created after login, once a session starts.

To confirm on the overlays: finish login, turn on Undetectability, start a session, then run
`analysis/scripts/affinity.ps1`. The control bar and chat windows should report
`WDA_EXCLUDEFROMCAPTURE`.

### 3.6 No unprotected flash when it appears (Windows)

`main.js:15826`
```js
function showWindow(win) {
  if (process.platform === "darwin") { win.show(); return; }
  win.setOpacity(0);
  win.show();
  setTimeout(() => win.setOpacity(1), 30);
}
```
The window is shown fully transparent and made visible 30 ms later. This avoids a frame where
the window is painted before its protection has taken effect.

---

## 4. Other ways it hides

Control bar (`main.js:15449`) and chat (`main.js:15528`) are created with:
```js
new BrowserWindow({
  alwaysOnTop: true,          // floats above the meeting / browser
  frame: false,               // no title bar or borders
  transparent: true,          // only the rounded UI is painted
  hasShadow: false,           // no drop shadow outline
  skipTaskbar: true,          // no taskbar button, not in Alt+Tab
  type: "panel",              // floating panel (macOS)
  hiddenInMissionControl: true,
  focusable: !(isInvisible && noFocusWhenInvisible),
  acceptFirstMouse: true,     // clicks work without activating the window first
  closable: false, minimizable: false, fullscreenable: false, resizable: false,
  show: false,
})
```

- **Doesn't steal focus.** With the optional "no focus when invisible" setting, the overlay
  is `focusable: false`. Clicking it doesn't take focus away from the meeting or exam page,
  so "you switched tabs/windows" detection there doesn't trigger. `skipTaskbar` is re-applied
  whenever focusability changes (`15407`, `15503`).
- **No tray icon** while invisible (`main.js:16285`) and **no dock icon** on macOS (`main.js:15862`).
- **Global hotkeys** (`globalShortcut`, `main.js:16176`) for ask, hide/show, clear, move
  up/down/left/right, scroll and start/stop session, so you never need to click or alt-tab to it.
- **Kept on screen.** It clamps its position to the screen's work area (`15483`) and logs an
  error if a visible window ends up off-screen (`15360`).
- **Auto-starts** at login (`main.js:15878`, `openAtLogin: true`).

---

## 5. How it answers in real time

The pipeline, from the person speaking to text on screen:

```
 mic (sox.exe) ──┐                         ┌─ Silero VAD "me" ──┐
                 ├─ IPC chat-audio-data ──►│                    ├─► WAV clip ─► transcribe RPC ─► transcript
 system audio  ──┘   (48 kHz PCM chunks)   └─ Silero VAD "them"─┘   (16 kHz)    (api.v2.cluely.com)
 (loopback)

 hotkey "ask" ─► screenshot + unfinished audio + question ─► WebSocket agent ─► streamed answer tokens ─► chat window
```

### 5.1 Audio capture (main process), `main.js:16011` (`native-audio.ts`)

- **Your microphone ("me").** `node-record-lpcm16` runs the bundled `sox.exe`: 48 kHz,
  mono, raw PCM chunks (`16074`). A health timer logs if no audio arrives for 30 s.
- **The other person ("them"):**
  - **Windows:** `session.setDisplayMediaRequestHandler` (`16039`) answers the UI's
    `getDisplayMedia()` with `{ video: firstScreen, audio: "loopback" }`. This grabs everything
    playing through your speakers (WASAPI loopback) with no "choose what to share" dialog.
  - **macOS:** the bundled `audiotee` binary (Core Audio process tap), in 50 ms chunks (`16112`).
- Chunks go to the UI over IPC `chat-audio-data`, tagged `role: "me"` or `"them"`.

### 5.2 Speech detection on your PC, `dist/assets/transcription-*.js`

- Runs **Silero VAD**, a small speech-detection neural net (`@ricky0123/vad-web` +
  onnxruntime-web), locally, with **one instance per speaker**.
- Resamples 48 kHz to 16 kHz.
- `redemptionMs: 300`, `preSpeechPadMs: 300`: a phrase counts as finished after only
  **300 ms of silence**, and keeps 300 ms of audio before speech starts so the first word isn't cut.
- A phrase longer than **20 s** is force-cut, so long answers from an interviewer still flow.
- **Echo trick:** while "them" is speaking, your mic audio is replaced with silence
  (`themHasVoiceActivity → new Float32Array(...)`), so their voice leaking from your speakers
  into your mic isn't transcribed a second time as you.
- Backpressure: at most 16 chunks are queued per speaker. If the queue keeps overflowing,
  audio is dropped and reported.

### 5.3 Transcription

- Each finished phrase is encoded as a 16-bit mono WAV, base64-encoded and sent with
  `transcription.transcribe({ wavBase64, language })` to `api.v2.cluely.com` (oRPC).
- Up to **4 transcriptions in flight** at once.
- A placeholder line with `status: "transcribing"` is added to the transcript immediately,
  then filled in when the text returns, or removed if the result is empty.

Why this is fast: only actual speech is uploaded, as short clips (usually 1–5 s), in parallel.
Text for a phrase arrives about a second after the speaker pauses.

### 5.4 Asking the AI, `dist/assets/streamdown-text-*.js`

- Chat uses the **Cloudflare Agents SDK** (`useAgentChat` over a `PartySocket` WebSocket,
  with message types such as `cf_agent_use_chat_request`, `cf_agent_use_chat_response` and
  `cf_agent_stream_resume_*`). On the server side this is a Durable Object agent.
- The WebSocket is opened when the session starts and **stays connected**, so pressing
  "ask" costs no connection setup. If it disconnects, the UI reconnects and can **resume a
  half-finished answer stream**.
- When you ask, it sends over the same socket:
  1. **`uploadScreenshot`**: the main process grabs the screen the chat window is on
     (`desktopCapturer.getSources`, `main.js:16794`), downscaled to at most 1920 px,
     as PNG, with retries (3 tries, 500 ms apart).
  2. **`uploadPartialAudio`**: the speech segments **still in progress** for both speakers.
     The answer can include the last words the interviewer said, even if their transcription
     hasn't come back yet.
  3. The question, with the running transcript already on the server.
- The answer streams back token by token and is drawn as it arrives with `streamdown`
  (streaming Markdown, with code highlighting via Shiki and diagrams via Mermaid).
- **The AI model is chosen on the server and doesn't appear anywhere in the app.**

### 5.5 Other details

- A session ends itself after **10 minutes** with no new transcript or messages (`main.js:16161`).
- The UI is loaded from `renderer.v2.cluely.com` but served from local files inside the app
  (`main.js:15788`), so the UI loads instantly and works offline until it needs the API.
- The VAD model, requested from `cdn.jsdelivr.net`, is also served from the local copy (`15804`).

---

## 6. What can still detect it

Content protection only hides the window from **software screen capture**. It doesn't make Cluely undetectable:

- **The physical screen.** A camera pointed at the monitor, or an HDMI capture card
  recording the display signal, sees the overlay.
- **Window and process checks.** Any program can list windows and read their capture flag,
  exactly as `analysis/scripts/affinity.ps1` does here. Proctoring software can also look for `Cluely.exe`,
  windows of class `Chrome_WidgetWin_1` titled "Cluely" that are top-most and transparent,
  or a running `sox.exe`.
- **Network.** Traffic to `*.cluely.com` is visible to anyone monitoring the network.
- **Behavior.** Eye movement toward the overlay and long pauses before polished answers.
- **Older Windows** (before 10 version 2004) captures it as a black rectangle instead of hiding it.

---

## 7. Build-it-yourself recipe

| Feature | How |
| --- | --- |
| Hide from screen share | `win.setContentProtection(true)` (Win: `WDA_EXCLUDEFROMCAPTURE`; mac: `sharingType = .none`) |
| Overlay look | `transparent`, `frame: false`, `hasShadow: false`, `alwaysOnTop`, `skipTaskbar`, `type: "panel"` |
| Don't steal focus | `focusable: false`, `acceptFirstMouse: true` |
| No flash on show (Win) | `setOpacity(0)` → `show()` → `setOpacity(1)` after 30 ms |
| Control without clicking | `globalShortcut.register(...)` |
| Hide in own screenshots | Turn protection on while calling `desktopCapturer.getSources` |
| System audio (Win) | `session.setDisplayMediaRequestHandler(cb({ video, audio: "loopback" }))` + `getDisplayMedia` in the UI |
| System audio (mac) | Core Audio process tap (e.g. `audiotee`) |
| Mic | `getUserMedia`, or `sox` via `node-record-lpcm16` |
| Phrase detection | Silero VAD (`@ricky0123/vad-web`), 300 ms silence end, 20 s max |
| Transcription | Upload WAV clips in parallel to any speech-to-text API (Whisper, Groq, Deepgram, …) |
| Answers | Persistent WebSocket + streamed LLM tokens; send screenshot + transcript + unfinished audio |
| Render | Streaming Markdown renderer (e.g. `streamdown`) |

---

## 8. Reproduce this analysis

```bash
npm install --global rea-agents
npx --yes @electron/asar extract "%LOCALAPPDATA%/Programs/cluely-v2/resources/app.asar" analysis/cluely-src
rea analyze-javascript-application "D:/project/tluely/analysis/cluely-src/dist-electron" --json > analysis/rea-main.json
grep -n "setContentProtection\|transparent: !0\|setDisplayMediaRequestHandler\|desktopCapturer" analysis/cluely-src/dist-electron/main.js
```

Helper scripts in `analysis/scripts/`:
- `affinity.ps1`: lists every Cluely window with its title, size and capture flag.
  `powershell -ExecutionPolicy Bypass -File analysis/scripts/affinity.ps1`
- `captest.ps1`: the red-window screenshot test in section 3.4.
  `powershell -STA -ExecutionPolicy Bypass -File analysis/scripts/captest.ps1 -OutDir analysis/capture-test`
