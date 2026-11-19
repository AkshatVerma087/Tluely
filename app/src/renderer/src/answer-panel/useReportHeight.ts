// Hook: measures an element's natural height and reports it to main, so the answer panel window
// grows and shrinks with its content (main clamps it to 140-500 px).
//
// Uses ResizeObserver, which fires whenever the element's size changes: new answer text,
// fonts loading, and so on. Reports are sent at most once per animation frame.

import { useEffect, useRef } from 'react'

export function useReportHeight<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let frame = 0
    let lastReported = -1

    const report = (): void => {
      // Coalesce bursts of changes (e.g. streaming tokens) into one report per frame.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const height = Math.ceil(element.getBoundingClientRect().height)
        if (height === lastReported) return // unchanged: no IPC round trip
        lastReported = height
        void window.tluely.invoke('window:resizePanel', height)
      })
    }

    const observer = new ResizeObserver(report)
    observer.observe(element)
    report() // initial size

    // Stop observing when the component unmounts.
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}
