import { readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const assetsDirectory = resolve('dist/assets')
const limits = { '.js': 600 * 1024, '.css': 180 * 1024 }
const totals = new Map()

for (const name of readdirSync(assetsDirectory)) {
  const extension = extname(name)
  const size = statSync(join(assetsDirectory, name)).size
  totals.set(extension, (totals.get(extension) ?? 0) + size)
  console.log(`${name.padEnd(36)} ${(size / 1024).toFixed(1)} KiB`)
}

for (const [extension, limit] of Object.entries(limits)) {
  const total = totals.get(extension) ?? 0
  console.log(`${extension} total: ${(total / 1024).toFixed(1)} KiB (limit ${(limit / 1024).toFixed(0)} KiB)`)
  if (total > limit) process.exitCode = 1
}
