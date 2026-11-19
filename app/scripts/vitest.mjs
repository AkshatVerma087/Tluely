// Runs Vitest with an uppercase drive letter in the working directory.
//
// Why: on Windows, a shell started with a lowercase drive (`d:\...`, as VS Code often does) makes
// Vitest load its own module twice under two path casings, and every test fails with
// "Vitest failed to find the current suite". Fixing the casing before Vitest starts avoids that.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const cwd = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const require = createRequire(join(cwd, 'package.json'))
const vitestBin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(process.execPath, [vitestBin, ...process.argv.slice(2)], {
  cwd,
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
