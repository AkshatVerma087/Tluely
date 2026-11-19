// Window kinds shared by main and renderer (D-034).
//
// Main opens every window with `?window=<kind>`; the renderer reads it back to choose its UI.
// Keeping the list here means both sides agree, and the renderer can reject unknown values.

/** Every window the app can open. */
export const WINDOW_KINDS = ['control-bar', 'answer-panel', 'settings', 'audio-worker'] as const

export type WindowKind = (typeof WINDOW_KINDS)[number]

/** True if `value` is one of the known window kinds (narrows the type). */
export function isWindowKind(value: unknown): value is WindowKind {
  return typeof value === 'string' && (WINDOW_KINDS as readonly string[]).includes(value)
}

/** Reads the window kind from a page's query string (e.g. '?window=control-bar'), or null. */
export function windowKindFromSearch(search: string): WindowKind | null {
  const value = new URLSearchParams(search).get('window')
  return isWindowKind(value) ? value : null
}
