import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(testDir, '..')

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js'])
const ignoredSegments = new Set(['dist', 'node_modules', '.git'])

const walk = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else if (sourceExtensions.has(path.slice(path.lastIndexOf('.')))) {
      files.push(path)
    }
  }
  return files
}

const bannedImport =
  /^\s*(?:import(?:\s+type)?\s+.*\s+from\s+['"](?:effect-v[34]|@gbg\/tmnl|effect-v3)(?:\/|['"])|import\s*\(\s*['"](?:effect-v[34]|@gbg\/tmnl))/

describe('Effect v4 package guardrails', () => {
  it('does not import Effect v3, the retired effect-v4 alias, or @gbg/tmnl', async () => {
    const files = await walk(packageRoot)
    const violations: string[] = []
    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n')
      for (let index = 0; index < lines.length; index += 1) {
        if (bannedImport.test(lines[index])) {
          violations.push(
            `${relative(packageRoot, file)}:${index + 1}: ${lines[index].trim()}`,
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('uses Context.Service rather than Effect.Service', async () => {
    const files = await walk(join(packageRoot, 'src'))
    const violations: string[] = []
    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n')
      for (let index = 0; index < lines.length; index += 1) {
        if (/\bEffect\.Service\b/.test(lines[index])) {
          violations.push(
            `${relative(packageRoot, file)}:${index + 1}: ${lines[index].trim()}`,
          )
        }
      }
    }
    expect(violations).toEqual([])
  })
})
