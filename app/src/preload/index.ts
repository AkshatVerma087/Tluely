// Preload: the only bridge between a window (web page) and the main process.
// Exposes `window.tluely`, built from the typed IPC contract (D-021). Nothing else is exposed.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { COMMAND_CHANNELS, EVENT_CHANNELS, type TluelyApi } from '@shared/ipc'

// Hardened renderers require context isolation (D-011). Without it, the page would share
// this privileged context, so refuse to expose anything.
if (!process.contextIsolated) {
  throw new Error('tluely preload: contextIsolation must be enabled')
}

const allowedCommands = new Set<string>(COMMAND_CHANNELS)
const allowedEvents = new Set<string>(EVENT_CHANNELS)

const api: TluelyApi = {
  invoke(channel, ...args) {
    // Runtime allow-list check, in case the page calls with an untyped string.
    if (!allowedCommands.has(channel)) {
      return Promise.reject(new Error(`Unknown IPC command: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  on(channel, listener) {
    if (!allowedEvents.has(channel)) {
      throw new Error(`Unknown IPC event: ${String(channel)}`)
    }
    // Pass only the payload; never hand the page Electron's event object (it carries `sender`).
    const handler = (_event: IpcRendererEvent, payload: Parameters<typeof listener>[0]): void =>
      listener(payload)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('tluely', api)
