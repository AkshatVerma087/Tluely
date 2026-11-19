// Unit tests for the shared overlay window options (src/main/windows/overlay-options.ts, D-025).
// They guarantee every overlay kind gets every stealth flag, so no window can leak into
// the taskbar, Alt+Tab, or show a frame/shadow.

import { describe, expect, it } from 'vitest'
import {
  OVERLAY_SPECS,
  clampOverlayHeight,
  overlayWindowOptions,
  type OverlayKind
} from './overlay-options'

const kinds = Object.keys(OVERLAY_SPECS) as OverlayKind[]

describe('overlayWindowOptions', () => {
  // Run the same stealth checks for every overlay kind.
  it.each(kinds)('%s gets every stealth flag', (kind) => {
    const options = overlayWindowOptions(kind, { preventFocus: false })

    expect(options).toMatchObject({
      frame: false,
      thickFrame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      closable: false,
      show: false // must start hidden so the stealth service controls the first paint
    })
  })

  // Each kind uses the size from its spec.
  it.each(kinds)('%s uses the size from its spec', (kind) => {
    const options = overlayWindowOptions(kind, { preventFocus: false })
    expect(options.width).toBe(OVERLAY_SPECS[kind].width)
    expect(options.height).toBe(OVERLAY_SPECS[kind].height)
  })

  // The control bar is click-only and must never take focus.
  it('never makes the control bar focusable', () => {
    expect(overlayWindowOptions('control-bar', { preventFocus: false }).focusable).toBe(false)
  })

  // Overlays must stay out of Alt+Tab. A non-focusable window is excluded automatically;
  // a focusable one (the answer panel) relies on being an owned window (parent: controlBar).
  it('keeps the answer panel the only focusable overlay kind', () => {
    const focusable = kinds.filter((k) => OVERLAY_SPECS[k].focusable)
    expect(focusable).toEqual(['answer-panel'])
  })

  // The answer panel needs focus for typing, unless the user chose "don't take focus".
  it('makes the answer panel focusable unless focus is prevented', () => {
    expect(overlayWindowOptions('answer-panel', { preventFocus: false }).focusable).toBe(true)
    expect(overlayWindowOptions('answer-panel', { preventFocus: true }).focusable).toBe(false)
  })
})

describe('clampOverlayHeight', () => {
  // Short content never shrinks the panel below its starting height.
  it('keeps the minimum height for short content', () => {
    expect(clampOverlayHeight('answer-panel', 60)).toBe(140)
  })

  // Content between min and max: the panel matches it (rounded up to whole pixels).
  it('follows the content height in between', () => {
    expect(clampOverlayHeight('answer-panel', 263.2)).toBe(264)
  })

  // Long content stops at maxHeight; beyond that the panel scrolls.
  it('caps tall content at maxHeight', () => {
    expect(clampOverlayHeight('answer-panel', 2000)).toBe(500)
  })

  // The control bar is fixed size whatever is reported.
  it('keeps fixed-size windows fixed', () => {
    expect(clampOverlayHeight('control-bar', 300)).toBe(50)
  })

  // Garbage from the renderer must not produce a broken window size.
  it('falls back to the starting height for invalid input', () => {
    expect(clampOverlayHeight('answer-panel', Number.NaN)).toBe(140)
    expect(clampOverlayHeight('answer-panel', Number.POSITIVE_INFINITY)).toBe(140)
    expect(clampOverlayHeight('answer-panel', -5)).toBe(140)
  })
})
