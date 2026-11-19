// Decides whether a URL is one of tluely's own pages (D-011).
//
// Pure function with no Electron imports, so it is unit-testable.
// Used by the IPC sender check (main/ipc.ts) and by navigation blocking (main/security/index.ts).

export interface TrustedOrigins {
  /** file:// URL of the built renderer folder, e.g. 'file:///C:/.../out/renderer/'. */
  rendererFileUrl: string
  /** electron-vite dev server URL in development (e.g. 'http://localhost:5173'), otherwise undefined. */
  devServerUrl?: string
}

/** Returns a checker that is true only for URLs inside our renderer folder or on the dev server. */
export function createUrlTrust(origins: TrustedOrigins): (url: string | undefined) => boolean {
  // Ensure the folder URL ends with '/', so '.../renderer-evil/' can't pass as '.../renderer/'.
  const rendererPrefix = withTrailingSlash(normalizeFileUrl(origins.rendererFileUrl))
  const devOrigin = origins.devServerUrl ? safeOrigin(origins.devServerUrl) : null

  return (url) => {
    if (!url) return false

    // Production: a file inside the app's own renderer folder.
    if (url.startsWith('file:')) {
      return normalizeFileUrl(url).startsWith(rendererPrefix)
    }

    // Development: same origin (scheme + host + port) as the Vite dev server.
    return devOrigin !== null && safeOrigin(url) === devOrigin
  }
}

/** Windows paths are case-insensitive, and URL encoding may differ, so compare a decoded lowercase form. */
function normalizeFileUrl(url: string): string {
  try {
    return decodeURI(url).replace(/\\/g, '/').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

/** The origin of a URL ('http://localhost:5173'), or null if it isn't a valid URL. */
function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}
