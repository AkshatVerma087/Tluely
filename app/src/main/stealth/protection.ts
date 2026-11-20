// The content-protection rule (FINDINGS.md section 3.1), kept pure so it is unit-testable.
//
// Content protection = Electron's setContentProtection(true), which on Windows calls
// SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE). Protected windows stay visible on your monitor
// but are left out of every screen capture (screen share, screenshots, recorders).

import type { AppState } from '@shared/types'

/**
 * Whether overlay windows must be hidden from capture right now:
 * - `invisible`: the user turned invisible mode on, or
 * - `capturing`: we are taking our own screenshot for the AI (Phase 2.3), so the overlay must not
 *   appear in it, even while invisible mode is off.
 */
export function shouldProtect(state: Pick<AppState, 'invisible' | 'capturing'>): boolean {
  return state.invisible || state.capturing
}
