// Unit tests for the "is this one of our pages?" check (src/main/security/trust.ts, D-011).

import { describe, expect, it } from 'vitest'
import { createUrlTrust } from './trust'

const rendererFileUrl = 'file:///D:/apps/tluely/out/renderer/'

describe('createUrlTrust (production)', () => {
  const isTrusted = createUrlTrust({ rendererFileUrl })

  // Our own built page must be trusted.
  it('trusts pages inside the renderer folder', () => {
    expect(isTrusted('file:///D:/apps/tluely/out/renderer/index.html')).toBe(true)
  })

  // Windows paths ignore case, so a different drive-letter case is still our page.
  it('ignores path case on Windows', () => {
    expect(isTrusted('file:///d:/apps/tluely/out/renderer/index.html')).toBe(true)
  })

  // Any other local file (e.g. a downloaded .html) must not be trusted.
  it('rejects other local files', () => {
    expect(isTrusted('file:///C:/Users/me/Downloads/evil.html')).toBe(false)
  })

  // A sibling folder that merely starts with the same name must not pass.
  it('rejects look-alike sibling folders', () => {
    expect(isTrusted('file:///D:/apps/tluely/out/renderer-evil/index.html')).toBe(false)
  })

  // Without a dev server configured, web URLs are never trusted.
  it('rejects websites', () => {
    expect(isTrusted('https://example.com')).toBe(false)
    expect(isTrusted('http://localhost:5173/')).toBe(false)
  })

  // Missing or broken URLs are rejected rather than crashing.
  it('rejects empty and invalid input', () => {
    expect(isTrusted(undefined)).toBe(false)
    expect(isTrusted('')).toBe(false)
    expect(isTrusted('not a url')).toBe(false)
  })
})

describe('createUrlTrust (development)', () => {
  const isTrusted = createUrlTrust({ rendererFileUrl, devServerUrl: 'http://localhost:5173' })

  // Pages from the Vite dev server are ours during development.
  it('trusts the dev server origin', () => {
    expect(isTrusted('http://localhost:5173/')).toBe(true)
    expect(isTrusted('http://localhost:5173/settings.html')).toBe(true)
  })

  // A different port or host is a different site.
  it('rejects other ports and hosts', () => {
    expect(isTrusted('http://localhost:5174/')).toBe(false)
    expect(isTrusted('http://evil.localhost:5173/')).toBe(false)
  })
})
