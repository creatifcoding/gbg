/**
 * EPOCH-0003: Section generator tests
 */

import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { makeIdentitySection } from '../sections/identity'
import { makeToolManifestSection } from '../sections/tool-manifest'
import { makeGuidelinesSection } from '../sections/guidelines'
import { makeRuntimeStampSection } from '../sections/runtime-stamp'
import type { Tool as PiAiTool } from '@mariozechner/pi-ai'

const mockTools: PiAiTool[] = [
  { name: 'read', description: 'Read file contents', parameters: {} },
  { name: 'bash', description: 'Execute bash commands', parameters: {} },
  { name: 'edit', description: 'Edit files surgically', parameters: {} },
  { name: 'write', description: 'Write files', parameters: {} },
  { name: 'grep', description: 'Search code', parameters: {} },
] as any

describe('identity section', () => {
  it('has correct key and priority', () => {
    const section = makeIdentitySection()
    expect(section.key).toBe('identity')
    expect(section.priority).toBe(0)
  })

  it('includes default name', () => {
    const section = makeIdentitySection()
    expect(section.content).toContain('TMNL Harness')
  })

  it('accepts custom name', () => {
    const section = makeIdentitySection({ name: 'Val' })
    expect(section.content).toContain('You are Val')
    expect(section.content).not.toContain('You are TMNL Harness')
  })

  it('sizeBytes matches content', () => {
    const section = makeIdentitySection()
    expect(section.sizeBytes).toBe(new TextEncoder().encode(section.content).byteLength)
  })
})

describe('tool-manifest section', () => {
  it('has correct key and priority', () => {
    const section = makeToolManifestSection(mockTools)
    expect(section.key).toBe('tool-manifest')
    expect(section.priority).toBe(100)
  })

  it('lists all tools', () => {
    const section = makeToolManifestSection(mockTools)
    for (const tool of mockTools) {
      expect(section.content).toContain(tool.name)
    }
  })

  it('includes prompt context docs when provided', () => {
    const section = makeToolManifestSection(mockTools, {
      promptContextDocs: '## prompt_context Tool\n\nSome docs here.',
    })
    expect(section.content).toContain('prompt_context Tool')
  })

  it('handles empty tool array', () => {
    const section = makeToolManifestSection([])
    expect(section.content).toBeDefined()
    expect(section.sizeBytes).toBeGreaterThan(0)
  })
})

describe('guidelines section', () => {
  it('has correct key and priority', () => {
    const section = makeGuidelinesSection(mockTools)
    expect(section.key).toBe('guidelines')
    expect(section.priority).toBe(200)
  })

  it('includes conditional rules for available tools', () => {
    const section = makeGuidelinesSection(mockTools)
    expect(section.content).toContain('read') // conditional on read tool
    expect(section.content).toContain('edit') // conditional on edit tool
    expect(section.content).toContain('bash') // conditional on bash tool
    expect(section.content).toContain('Grep before cutting') // conditional on grep
  })

  it('omits rules for missing tools', () => {
    const minimalTools: PiAiTool[] = [
      { name: 'read', description: 'Read', parameters: {} },
    ] as any
    const section = makeGuidelinesSection(minimalTools)
    expect(section.content).not.toContain('Grep before cutting')
    expect(section.content).not.toContain('ripgrep')
  })
})

describe('runtime-stamp section', () => {
  it('has correct key and priority', () => {
    const section = makeRuntimeStampSection('/tmp/test')
    expect(section.key).toBe('runtime-stamp')
    expect(section.priority).toBe(900)
  })

  it('includes cwd', () => {
    const section = makeRuntimeStampSection('/home/user/project')
    expect(section.content).toContain('/home/user/project')
  })

  it('includes date information', () => {
    const section = makeRuntimeStampSection('/tmp')
    expect(section.content).toContain('Current date and time:')
    expect(section.content).toContain('Current working directory: /tmp')
  })
})
