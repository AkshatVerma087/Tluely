// Main-process side of the typed IPC contract (D-021).
//
// - handleCommands(): registers handlers for renderer -> main commands. The handler types come from
//   IpcCommands, so a handler for 'invisible:set' must accept a boolean and return void, and so on.
// - broadcast(): sends a main -> renderer event to every open window.
// - Only messages from our own pages are accepted (D-011): pages inside the app's renderer
//   folder, or the Vite dev server in development (see security/trust.ts).

import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { isTrustedUrl } from './security'
import type {
  CommandArgs,
  CommandChannel,
  CommandResult,
  EventChannel,
  EventPayload
} from '@shared/ipc'

/** A handler for one command: receives the command's arguments and returns its result. */
export type CommandHandler<C extends CommandChannel> = (
  ...args: CommandArgs<C>
) => CommandResult<C> | Promise<CommandResult<C>>

/** Any subset of commands with their handlers. Unhandled commands reject in the renderer. */
export type CommandHandlers = { [C in CommandChannel]?: CommandHandler<C> }

/** True if the message came from one of our own pages, not from some navigated-to website. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return isTrustedUrl(event.senderFrame?.url)
}

/**
 * Registers command handlers with ipcMain.handle.
 * Returns a function that removes them again (useful for tests and shutdown).
 */
export function handleCommands(handlers: CommandHandlers): () => void {
  const channels = Object.keys(handlers) as CommandChannel[]

  for (const channel of channels) {
    // The mapped type guarantees the handler matches its channel; TypeScript can't see that
    // through the loop variable, so it's widened here once.
    const handler = handlers[channel] as (...args: unknown[]) => unknown

    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isTrustedSender(event)) {
        throw new Error(`Rejected IPC '${channel}' from untrusted sender`)
      }
      return handler(...args)
    })
  }

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel)
  }
}

/** Sends an event to every open window that is still alive. */
export function broadcast<E extends EventChannel>(channel: E, payload: EventPayload<E>): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}
