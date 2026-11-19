// Renders the UI for the window this page runs in (`?window=<kind>`, D-034).
//
// - Known kind: its lazy route from routes.tsx, inside Suspense (nothing is drawn while its code loads,
//   which avoids a flash on transparent overlays).
// - Unknown or missing kind: an error message instead of guessing. Main always sets a valid kind,
//   so this only shows if something is misconfigured.

import { Suspense } from 'react'
import type { WindowKind } from '@shared/windows'
import { ROUTES } from './routes'

export function Root({ windowKind }: { windowKind: WindowKind | null }): React.JSX.Element {
  if (!windowKind) {
    console.error('[root] missing or unknown ?window= kind:', window.location.search)
    return <p className="route-error">Unknown window. Expected ?window=&lt;kind&gt;.</p>
  }

  const Page = ROUTES[windowKind]
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  )
}
