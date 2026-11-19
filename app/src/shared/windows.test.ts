// Unit tests for window-kind parsing (src/shared/windows.ts, D-034).

import { describe, expect, it } from 'vitest'
import { WINDOW_KINDS, isWindowKind, windowKindFromSearch } from './windows'

describe('windowKindFromSearch', () => {
  // Every known kind round-trips through the query string main builds.
  it.each(WINDOW_KINDS)('reads ?window=%s', (kind) => {
    expect(windowKindFromSearch(`?window=${kind}`)).toBe(kind)
  })

  // Other query parameters don't get in the way.
  it('ignores unrelated query parameters', () => {
    expect(windowKindFromSearch('?debug=1&window=answer-panel')).toBe('answer-panel')
  })

  // Missing, empty, or unknown values are rejected instead of guessed.
  it('returns null for missing or unknown kinds', () => {
    expect(windowKindFromSearch('')).toBeNull()
    expect(windowKindFromSearch('?window=')).toBeNull()
    expect(windowKindFromSearch('?window=main')).toBeNull()
    expect(windowKindFromSearch('?window=CONTROL-BAR')).toBeNull()
  })
})

describe('isWindowKind', () => {
  // Non-strings (e.g. from untrusted input) are never window kinds.
  it('rejects non-string values', () => {
    expect(isWindowKind(undefined)).toBe(false)
    expect(isWindowKind(42)).toBe(false)
    expect(isWindowKind(null)).toBe(false)
  })
})
