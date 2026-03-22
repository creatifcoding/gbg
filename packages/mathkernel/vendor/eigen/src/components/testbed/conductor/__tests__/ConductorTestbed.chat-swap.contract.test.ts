import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../../../..')

const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), 'utf8')

describe('ConductorTestbed chat swap contract', () => {
  it('removes all ConductorAgentChat import/render usage from ConductorTestbed', () => {
    const source = read('src/components/testbed/ConductorTestbed.tsx')

    expect(source).not.toMatch(/from ['\"]@\/components\/testbed\/conductor\/ConductorAgentChat['\"]/)
    expect(source).not.toContain('<ConductorAgentChat')
    expect(source).not.toContain('ConductorAgentChat.Root')
  })

  it('imports and mounts RvnHarnessChatSurface in ConductorTestbed', () => {
    const source = read('src/components/testbed/ConductorTestbed.tsx')

    expect(source).toMatch(/import\s+\{\s*RvnHarnessChatSurface\s*\}\s+from\s+['\"]@\/components\/testbed\/conductor\/RvnHarnessChatSurface['\"]/)
    expect(source).toContain('<RvnHarnessChatSurface')
  })
})
