// Pure positioning math for overlay windows. No Electron imports, so it is unit-testable.
// Coordinates are Electron "DIPs" (device-independent pixels), the same units as screen.workArea.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Gap between the top of the work area and the control bar. */
export const TOP_MARGIN = 12

/**
 * Position that centres a window horizontally near the top of a work area.
 * The work area is the screen minus the taskbar, so the window never sits under it.
 * Results are rounded, because window positions must be whole pixels.
 */
export function topCenter(
  workArea: Rect,
  size: Size,
  marginTop = TOP_MARGIN
): { x: number; y: number } {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + marginTop)
  }
}

/** Gap between the control bar and the answer panel below it. */
export const PANEL_GAP = 8

/**
 * Position that places a window directly below an anchor window, centred under it.
 * The x position is kept inside the work area, so a bar near a screen edge doesn't push
 * the wider panel off-screen.
 */
export function below(
  anchor: Rect,
  size: Size,
  workArea: Rect,
  gap = PANEL_GAP
): { x: number; y: number } {
  const centredX = anchor.x + (anchor.width - size.width) / 2
  const minX = workArea.x
  const maxX = workArea.x + workArea.width - size.width
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, centredX))),
    y: Math.round(anchor.y + anchor.height + gap)
  }
}
