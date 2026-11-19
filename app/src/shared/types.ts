// Shared data shapes and contracts, used by the main process, preload and renderer.
//
// Rules (D-033):
// - Types only: no logic and no default values here.
// - Everything that crosses IPC or goes into a JSON file is plain data: strings, numbers, booleans,
//   arrays and objects. Times are epoch milliseconds (`number`); ids are UUID strings.
// - Persisted shapes carry a `version` so later releases can migrate old files.
// - API keys never appear in these types; renderers only see whether a key is set (D-010).

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** AI vendors we support. Add a new id here when adding an adapter (D-020). */
export type ProviderId = 'groq' | 'anthropic'

/** Who said a transcript line: the user (mic) or the other side (system audio). */
export type Speaker = 'me' | 'them'

/** Epoch milliseconds, e.g. `Date.now()`. */
export type Timestamp = number

// ---------------------------------------------------------------------------
// Transcript and Q&A
// ---------------------------------------------------------------------------

/** One spoken phrase, as cut by voice detection and sent for transcription. */
export interface TranscriptLine {
  id: string
  speaker: Speaker
  /** Empty while `status` is 'transcribing'. */
  text: string
  /** When the phrase started being spoken. */
  startedAt: Timestamp
  status: 'transcribing' | 'done' | 'error'
}

/** One question and its streamed answer. */
export interface Exchange {
  id: string
  /** Text the user typed, or null when only the ask hotkey was pressed. */
  question: string | null
  /** Whether a screenshot was sent with the question. */
  hadScreenshot: boolean
  /** Grows token by token while `status` is 'streaming'. */
  answer: string
  provider: ProviderId
  model: string
  askedAt: Timestamp
  finishedAt: Timestamp | null
  status: 'streaming' | 'done' | 'refused' | 'aborted' | 'error'
  /** Readable error message when `status` is 'error'. */
  error?: string
}

// ---------------------------------------------------------------------------
// Session (one meeting); saved as userData/sessions/<id>.json (D-009)
// ---------------------------------------------------------------------------

/** Session lifecycle (D-024). */
export type SessionStatus = 'idle' | 'starting' | 'live' | 'answering' | 'ending'

export interface Session {
  version: 1
  id: string
  /** Optional user-editable name; the history list falls back to the start time. */
  title: string | null
  startedAt: Timestamp
  endedAt: Timestamp | null
  transcript: TranscriptLine[]
  exchanges: Exchange[]
}

/** Lightweight row for the history list, so all sessions don't have to be loaded. */
export interface SessionSummary {
  id: string
  title: string | null
  startedAt: Timestamp
  endedAt: Timestamp | null
  lineCount: number
  exchangeCount: number
}

// ---------------------------------------------------------------------------
// Settings; saved as userData/settings.json
// ---------------------------------------------------------------------------

/** Everything a global hotkey can trigger (Phase 1.3). */
export type HotkeyAction =
  | 'ask'
  | 'toggleVisibility'
  | 'focusInput'
  | 'clear'
  | 'toggleSession'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'scrollUp'
  | 'scrollDown'

/** Electron accelerator strings, e.g. 'CommandOrControl+Enter'. */
export type Hotkeys = Record<HotkeyAction, string>

export interface Settings {
  version: 1
  /** Provider used for answers. */
  provider: ProviderId
  /** Chosen model per provider, so switching providers remembers each choice. */
  models: Record<ProviderId, string>
  /** Speech-to-text language hint (ISO 639-1, e.g. 'en'), or null for auto-detect. */
  language: string | null
  /** Extra context sent with every question, e.g. résumé or job description. */
  customPrompt: string
  /** Start with content protection on (hidden from screen share). */
  invisibleByDefault: boolean
  /** While invisible, overlay windows don't take keyboard focus. */
  noFocusWhenInvisible: boolean
  /** Microphone deviceId, or null for the system default. */
  micDeviceId: string | null
  hotkeys: Hotkeys
  openAtLogin: boolean
}

/** Whether each provider has a key saved. The keys themselves stay in main (D-010). */
export type KeyStatus = Record<ProviderId, boolean>

// ---------------------------------------------------------------------------
// App state; single source of truth in main, pushed to windows (D-022)
// ---------------------------------------------------------------------------

export interface AppState {
  /** Content protection requested by the user. */
  invisible: boolean
  /** True for the moment a screenshot is being taken (overlay forced hidden from capture). */
  capturing: boolean
  session: {
    status: SessionStatus
    /** Id of the running session, or null when idle. */
    id: string | null
    transcript: TranscriptLine[]
    exchanges: Exchange[]
  }
  settings: Settings
  keys: KeyStatus
}

// ---------------------------------------------------------------------------
// Provider contracts (D-020). Implemented in main only; never sent over IPC.
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string
  /** Human-readable name for the model picker. */
  label: string
  /** Can accept screenshots. */
  vision: boolean
}

export interface Screenshot {
  mimeType: 'image/png'
  /** Base64-encoded image bytes. */
  base64: string
}

export interface AnswerRequest {
  model: string
  /** Built-in instructions plus the user's custom prompt. */
  systemPrompt: string
  /** Finished transcript lines, oldest first. */
  transcript: TranscriptLine[]
  /** Typed question, or null for "answer based on what's on screen and being discussed". */
  question: string | null
  screenshot: Screenshot | null
}

export interface AnswerResult {
  /** 'refused' = the model declined; 'length' = hit the output limit. */
  stopReason: 'done' | 'refused' | 'length'
}

/** An AI chat vendor. Each adapter is created with its API key in main. */
export interface LLMProvider {
  readonly id: ProviderId
  /** Lists available models. Also used by Settings' "Test key" button. */
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>
  /** Streams an answer, calling `onToken` for each text chunk. Rejects on errors; stops on abort (D-027). */
  streamAnswer(
    request: AnswerRequest,
    onToken: (text: string) => void,
    signal: AbortSignal
  ): Promise<AnswerResult>
}

export interface AudioClip {
  /** 16 kHz mono 16-bit WAV file bytes. */
  wav: Uint8Array
  speaker: Speaker
  startedAt: Timestamp
}

/** A speech-to-text vendor (D-008). */
export interface STTProvider {
  readonly id: ProviderId
  /** Returns the transcribed text (may be empty for noise). */
  transcribe(
    clip: AudioClip,
    options: { language: string | null; signal?: AbortSignal }
  ): Promise<string>
}
