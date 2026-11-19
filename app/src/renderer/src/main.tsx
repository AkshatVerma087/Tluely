// Renderer entry point. Every window loads this same page with `?window=<kind>` (D-034);
// Root.tsx renders the matching route from routes.tsx.

import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { windowKindFromSearch } from '@shared/windows'
import { Root } from './Root'

// Which window this page is running in, or null if the query is missing/unknown.
const windowKind = windowKindFromSearch(window.location.search)

// Overlay windows are transparent: mark the page so CSS drops the opaque background.
if (windowKind === 'control-bar' || windowKind === 'answer-panel') {
  document.documentElement.classList.add('overlay')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root windowKind={windowKind} />
  </StrictMode>
)
