// Typed IPC contract between main, preload and renderer (D-021).
//
// Two directions:
// - Commands: renderer -> main via ipcRenderer.invoke / ipcMain.handle. Like an async function call.
// - Events:   main -> renderer via webContents.send / ipcRenderer.on. One-way notifications.
//
// Every channel used anywhere in the app must be declared here. The preload only forwards
// channels listed in COMMAND_CHANNELS / EVENT_CHANNELS, so an undeclared channel cannot be used.
//
// API keys only flow renderer -> main ('keys:set'). Main never sends a key back (D-010).

import type {
  AppState,
  AudioClip,
  HotkeyAction,
  KeyStatus,
  ModelInfo,
  ProviderId,
  Session,
  SessionSummary,
  Settings
} from './types'

// ---------------------------------------------------------------------------
// Commands: renderer -> main
// ---------------------------------------------------------------------------

/** `args` is the argument list (a tuple); `result` is what the promise resolves to. */
export interface IpcCommands {
  /** Health check used by tests. */
  ping: { args: []; result: 'pong' }

  // App state
  'state:get': { args: []; result: AppState }
  'invisible:set': { args: [invisible: boolean]; result: void }

  // Session (D-024)
  'session:start': { args: []; result: void }
  'session:stop': { args: []; result: void }

  // Asking. The answer arrives via 'answer:token' events and 'state:changed'.
  'answer:ask': { args: [question: string | null]; result: void }
  'answer:abort': { args: []; result: void }
  'answer:clear': { args: []; result: void }

  // Settings
  'settings:update': { args: [patch: Partial<Omit<Settings, 'version'>>]; result: Settings }
  'models:list': { args: [provider: ProviderId]; result: ModelInfo[] }

  // API keys: the key goes in, only yes/no comes out (D-010)
  'keys:set': { args: [provider: ProviderId, apiKey: string]; result: KeyStatus }
  'keys:clear': { args: [provider: ProviderId]; result: KeyStatus }
  'keys:test': {
    args: [provider: ProviderId]
    result: { ok: true; modelCount: number } | { ok: false; error: string }
  }

  // History (D-009)
  'history:list': { args: []; result: SessionSummary[] }
  'history:get': { args: [id: string]; result: Session | null }
  'history:delete': { args: [id: string]; result: void }

  // Audio worker -> main: a finished speech clip to transcribe (D-026)
  'audio:clip': { args: [clip: AudioClip]; result: void }

  // Windows and app
  'window:openSettings': { args: []; result: void }
  'app:quit': { args: []; result: void }
}

export type CommandChannel = keyof IpcCommands
export type CommandArgs<C extends CommandChannel> = IpcCommands[C]['args']
export type CommandResult<C extends CommandChannel> = IpcCommands[C]['result']

// ---------------------------------------------------------------------------
// Events: main -> renderer
// ---------------------------------------------------------------------------

/** Each value is the event's payload. */
export interface IpcEvents {
  /** Full app state after any change (D-022). */
  'state:changed': AppState
  /** Next chunk of a streaming answer. Sent separately so the whole state isn't re-sent per token. */
  'answer:token': { exchangeId: string; text: string }
  /** Hotkey actions the UI handles itself (focus input, scroll). */
  hotkey: { action: HotkeyAction }
  /** Tells the hidden audio worker to start or stop capturing. */
  'audio:control': { type: 'start'; micDeviceId: string | null } | { type: 'stop' }
}

export type EventChannel = keyof IpcEvents
export type EventPayload<E extends EventChannel> = IpcEvents[E]

// ---------------------------------------------------------------------------
// Runtime allow-lists, used by the preload to reject unknown channels.
// `satisfies` makes the compiler fail if a channel is missing here or misspelled.
// ---------------------------------------------------------------------------

const commandChannelMap = {
  ping: true,
  'state:get': true,
  'invisible:set': true,
  'session:start': true,
  'session:stop': true,
  'answer:ask': true,
  'answer:abort': true,
  'answer:clear': true,
  'settings:update': true,
  'models:list': true,
  'keys:set': true,
  'keys:clear': true,
  'keys:test': true,
  'history:list': true,
  'history:get': true,
  'history:delete': true,
  'audio:clip': true,
  'window:openSettings': true,
  'app:quit': true
} as const satisfies Record<CommandChannel, true>

const eventChannelMap = {
  'state:changed': true,
  'answer:token': true,
  hotkey: true,
  'audio:control': true
} as const satisfies Record<EventChannel, true>

export const COMMAND_CHANNELS = Object.keys(commandChannelMap) as CommandChannel[]
export const EVENT_CHANNELS = Object.keys(eventChannelMap) as EventChannel[]

// ---------------------------------------------------------------------------
// The API the preload exposes as `window.tluely`
// ---------------------------------------------------------------------------

export interface TluelyApi {
  /** Send a command to main and await its result. */
  invoke<C extends CommandChannel>(channel: C, ...args: CommandArgs<C>): Promise<CommandResult<C>>
  /** Listen for an event from main. Returns a function that removes the listener. */
  on<E extends EventChannel>(channel: E, listener: (payload: EventPayload<E>) => void): () => void
}
