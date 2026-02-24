import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../../..')

describe('Harness hard-cut prune', () => {
  it('removes legacy pi-orchestrator source tree', () => {
    const legacyPath = resolve(root, 'src/lib/pi-orchestrator')
    expect(existsSync(legacyPath)).toBe(false)
  })

  it('keeps browser transport defaults on harness endpoint only', () => {
    const source = readFileSync(resolve(root, 'src/lib/harness/HarnessBrowserTransport.ts'), 'utf8')

    expect(source).toContain('/api/harness/ws')
    expect(source).not.toContain('/api/pi-orchestrator/ws')
  })
})
