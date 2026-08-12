import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'

const sourceRoot = resolve('src')
const extensions = ['.ts', '.tsx']
const files = []

function collect(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) collect(path)
    else if (extensions.includes(extname(path)) && !path.endsWith('.d.ts')) files.push(path)
  }
}

function resolveImport(source, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
  const base = specifier.startsWith('@/')
    ? join(sourceRoot, specifier.slice(2))
    : resolve(dirname(source), specifier)
  const candidates = [
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => join(base, `index${extension}`)),
  ]
  return candidates.find(existsSync) ?? null
}

collect(sourceRoot)
const graph = new Map(files.map((file) => [file, []]))
const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveImport(file, match[1])
    if (dependency) graph.get(file).push(dependency)
  }
}

const visiting = new Set()
const visited = new Set()
const path = []
function visit(file) {
  if (visiting.has(file)) {
    const start = path.indexOf(file)
    const cycle = [...path.slice(start), file].map((item) => item.slice(sourceRoot.length + 1))
    throw new Error(`Import cycle detected:\n${cycle.join(' -> ')}`)
  }
  if (visited.has(file)) return
  visiting.add(file)
  path.push(file)
  for (const dependency of graph.get(file) ?? []) visit(dependency)
  path.pop()
  visiting.delete(file)
  visited.add(file)
}

for (const file of files) visit(file)
console.log(`Import cycle check passed (${files.length} modules).`)
