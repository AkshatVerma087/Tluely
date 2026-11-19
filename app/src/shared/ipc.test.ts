import { describe, expect, it } from 'vitest'
import { COMMAND_CHANNELS, EVENT_CHANNELS } from '@shared/ipc'

describe('IPC channel allow-lists', () => {
  it('has no duplicate channel names across commands and events', () => {
    const all = [...COMMAND_CHANNELS, ...EVENT_CHANNELS]
    expect(new Set(all).size).toBe(all.length)
  })

  it('includes the ping health check', () => {
    expect(COMMAND_CHANNELS).toContain('ping')
  })
})
