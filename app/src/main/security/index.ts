// Renderer hardening (D-011). Applies to every window the app creates.
//
// - secureWebPreferences(): contextIsolation, sandbox and no Node.js for every BrowserWindow.
// - applySecurityPolicies(): app-wide rules:
//     * windows can't navigate away from our pages,
//     * window.open is blocked; only https:// links open, in the user's default browser,
//     * <webview> tags are forbidden,
//     * permissions are denied except the microphone for our own pages (needed in Phase 3).
// - isTrustedUrl(): "is this one of our pages?", shared with the IPC sender check.

import { app, session, shell, type WebPreferences } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createUrlTrust } from './trust'

// Our pages: the built renderer folder, plus the Vite dev server in development.
export const isTrustedUrl = createUrlTrust({
  rendererFileUrl: pathToFileURL(join(__dirname, '../renderer')).href,
  devServerUrl: app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
})

/** webPreferences every window must use. */
export function secureWebPreferences(): WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true, // page JS can't reach the preload's privileged context
    nodeIntegration: false, // page can't use Node.js (files, processes)
    sandbox: true, // renderer runs in Chromium's OS-level sandbox
    webSecurity: true, // keep same-origin policy on (Electron default, stated explicitly)
    webviewTag: false // no embedded <webview> pages
  }
}

/** Opens a link in the user's default browser, but only for https:// URLs. */
function openExternalSafely(url: string): void {
  try {
    if (new URL(url).protocol === 'https:') void shell.openExternal(url)
  } catch {
    // Invalid URL: ignore.
  }
}

/** Permissions a page may request. The microphone is used for live transcription (Phase 3). */
const ALLOWED_PERMISSIONS = new Set(['media'])

/** Installs the app-wide security rules. Call once, before creating any window. */
export function applySecurityPolicies(): void {
  // Runs for every web page the app creates (windows, and anything else).
  app.on('web-contents-created', (_event, contents) => {
    // Block navigation to anything that isn't one of our pages.
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedUrl(url)) {
        event.preventDefault()
        openExternalSafely(url)
      }
    })

    // Block popups / window.open; hand https links to the default browser instead.
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafely(url)
      return { action: 'deny' }
    })

    // Forbid embedding other pages via <webview>.
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  // Permission requests (e.g. getUserMedia): allow only listed ones, only for our pages.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(contents.getURL()))
  })

  // Synchronous permission checks follow the same rule.
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isTrustedUrl(requestingOrigin)
  })
}
