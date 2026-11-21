// Window service: creates the app's windows and keeps them in sync with the AppState.
//
// - Overlay windows (control bar, answer panel) come from the shared factory (D-025).
// - The answer panel is owned by the control bar (parent), which keeps it out of Alt+Tab.
// - Every state change is pushed to all windows as 'state:changed' (D-022).
// - Every overlay is handed to the stealth service right after creation, before it is shown, so
//   content protection is in place from its first frame (D-025).
// - The Settings window (a normal window) is added in Phase 1.4.

import { BrowserWindow, screen } from 'electron'
import type { StateStore } from '../store'
import type { StealthService } from '../stealth'
import { broadcast } from '../ipc'
import { createOverlayWindow } from './factory'
import { OVERLAY_SPECS, clampOverlayHeight } from './overlay-options'
import { below, topCenter } from './layout'

export interface WindowServiceDeps {
  store: StateStore
  /** Keeps content protection on the overlays in sync with the state. */
  stealth: StealthService
}

export interface WindowService {
  /** Creates the control bar (once) at the top centre of the primary screen and shows it. */
  openControlBar(): BrowserWindow
  /** Creates the answer panel (once) below the control bar, owned by it, and shows it. */
  openAnswerPanel(): BrowserWindow
  /** Resizes the answer panel to fit content of the given height (clamped 140-500 px). */
  resizeAnswerPanel(contentHeight: number): void
  /**
   * Destroys the overlay windows. Called when the app quits: overlays are closable:false, so
   * app.quit()'s normal "close every window" step is refused and would cancel the quit.
   * destroy() bypasses that.
   */
  destroyOverlays(): void
  /** Stops pushing state to windows (called on shutdown). */
  dispose(): void
}

/** True if the window exists and hasn't been destroyed. */
function isAlive(window: BrowserWindow | null): window is BrowserWindow {
  return window !== null && !window.isDestroyed()
}

export function createWindowService({ store, stealth }: WindowServiceDeps): WindowService {
  // Push every state change to all windows as 'state:changed' (D-022).
  const unsubscribe = store.subscribe((next) => broadcast('state:changed', next))

  // At most one of each overlay; null when not created (or destroyed).
  let controlBar: BrowserWindow | null = null
  let answerPanel: BrowserWindow | null = null

  /** "Don't take focus" applies only while invisible (FINDINGS.md section 4). */
  function preventFocus(): boolean {
    const { invisible, settings } = store.get()
    return invisible && settings.noFocusWhenInvisible
  }

  function openControlBar(): BrowserWindow {
    // Only one control bar may exist; reuse it if it's still alive.
    if (isAlive(controlBar)) return controlBar

    const window = createOverlayWindow('control-bar', { preventFocus: preventFocus() })
    // Content protection before the first show, so the bar is never captured (FINDINGS.md 3).
    stealth.protect(window)

    // Top centre of the primary screen's work area (the screen minus the taskbar).
    const { workArea } = screen.getPrimaryDisplay()
    const { x, y } = topCenter(workArea, OVERLAY_SPECS['control-bar'])
    window.setPosition(x, y)

    // Once the page has painted, show it with the stealth trick (opacity 0 -> show -> opacity 1),
    // without activating, so the meeting window keeps keyboard focus.
    window.once('ready-to-show', () => stealth.show(window))

    window.on('closed', () => {
      controlBar = null
    })
    controlBar = window
    return window
  }

  function openAnswerPanel(): BrowserWindow {
    if (isAlive(answerPanel)) return answerPanel

    // The panel is owned by the control bar: that keeps it out of Alt+Tab and the taskbar
    // even though it's focusable, and keeps it above the bar's z-order (D-025).
    const bar = openControlBar()
    const window = createOverlayWindow('answer-panel', {
      preventFocus: preventFocus(),
      parent: bar
    })
    stealth.protect(window)

    // Directly below the control bar, centred under it, kept inside the work area.
    const { workArea } = screen.getDisplayMatching(bar.getBounds())
    const { x, y } = below(bar.getBounds(), OVERLAY_SPECS['answer-panel'], workArea)
    window.setPosition(x, y)

    // Stealth show without activating; it only takes focus when the user wants to type (Phase 2.5).
    window.once('ready-to-show', () => stealth.show(window))

    window.on('closed', () => {
      answerPanel = null
    })
    answerPanel = window
    return window
  }

  function resizeAnswerPanel(contentHeight: number): void {
    if (!isAlive(answerPanel)) return
    const height = clampOverlayHeight('answer-panel', contentHeight)
    const bounds = answerPanel.getBounds()
    // Grow or shrink downwards: keep the top-left corner and width, change only the height.
    if (bounds.height !== height) answerPanel.setBounds({ ...bounds, height })
  }

  function destroyOverlays(): void {
    // Child (answer panel) first, then its owner (control bar).
    if (isAlive(answerPanel)) answerPanel.destroy()
    if (isAlive(controlBar)) controlBar.destroy()
  }

  return {
    openControlBar,
    openAnswerPanel,
    resizeAnswerPanel,
    destroyOverlays,
    dispose: unsubscribe
  }
}
