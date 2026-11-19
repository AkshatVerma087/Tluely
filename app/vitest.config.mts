import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run in Node (no Electron). Test files sit next to the code as *.test.ts(x).
// Always run through `npm test`, which uses scripts/vitest.mjs to fix Windows drive-letter casing.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node'
  }
})
