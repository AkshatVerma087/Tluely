// Answer panel UI (shown in the `?window=answer-panel` overlay).
//
// Placeholder for Phase 1.1: explains what will appear here and lists the planned hotkeys.
// The real streaming answer and the question input come in Phase 2.5.
// The panel's natural height is reported to main, which sizes the window to fit (140-500 px).

import { useReportHeight } from './useReportHeight'

export function AnswerPanel(): React.JSX.Element {
  // The measured element is the content box itself (natural height), not the full window.
  const contentRef = useReportHeight<HTMLDivElement>()

  return (
    <div className="answer-panel" ref={contentRef}>
      <h2>Answer</h2>
      <p>
        Answers will stream in here after you ask. tluely uses what&apos;s on your screen and
        what&apos;s been said in the meeting.
      </p>
      {/* Planned default hotkeys (Phase 1.3); shown as a hint until they work. */}
      <ul className="hints">
        <li>
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ask
        </li>
        <li>
          <kbd>Ctrl</kbd>+<kbd>\</kbd> hide / show
        </li>
        <li>
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> start / stop listening
        </li>
      </ul>
    </div>
  )
}
