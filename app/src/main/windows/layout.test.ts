// Unit tests for overlay positioning (src/main/windows/layout.ts).

import { describe, expect, it } from 'vitest'
import { PANEL_GAP, TOP_MARGIN, below, topCenter } from './layout'

describe('topCenter', () => {
  // A 1920-wide screen: the 200-wide bar starts at (1920 - 200) / 2 = 860.
  it('centres horizontally and sits TOP_MARGIN below the top', () => {
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 }
    expect(topCenter(workArea, { width: 200, height: 50 })).toEqual({ x: 860, y: TOP_MARGIN })
  })

  // Secondary monitors or a taskbar at the top/left give a work area that doesn't start at 0,0.
  it('respects a work area offset', () => {
    const workArea = { x: 1920, y: 40, width: 1280, height: 984 }
    expect(topCenter(workArea, { width: 200, height: 50 })).toEqual({
      x: 1920 + 540,
      y: 40 + TOP_MARGIN
    })
  })

  // Odd sizes produce half pixels, which must be rounded to whole pixels.
  it('rounds to whole pixels', () => {
    const workArea = { x: 0, y: 0, width: 1365, height: 728 }
    const { x, y } = topCenter(workArea, { width: 200, height: 50 })
    expect(Number.isInteger(x)).toBe(true)
    expect(Number.isInteger(y)).toBe(true)
  })
})

describe('below', () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1032 }
  const panel = { width: 540, height: 140 }

  // The panel is centred under the bar: bar centre 960 -> panel x = 960 - 270 = 690.
  it('centres the panel under the anchor with a gap', () => {
    const bar = { x: 860, y: 12, width: 200, height: 50 }
    expect(below(bar, panel, workArea)).toEqual({ x: 690, y: 12 + 50 + PANEL_GAP })
  })

  // Bar moved to the left edge: the wider panel is pushed right to stay on screen.
  it('keeps the panel inside the left edge', () => {
    const bar = { x: 0, y: 12, width: 200, height: 50 }
    expect(below(bar, panel, workArea).x).toBe(0)
  })

  // Bar moved to the right edge: the panel stops at the right edge.
  it('keeps the panel inside the right edge', () => {
    const bar = { x: 1720, y: 12, width: 200, height: 50 }
    expect(below(bar, panel, workArea).x).toBe(1920 - 540)
  })
})
