/**
 * ToolRegistryService Tests
 *
 * Validates tool registration, execution, lifecycle, and error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Registry from '@effect-atom/atom/Registry'
import {
  createToolRegistryService,
  registeredToolsAtom,
  activeCallsAtom,
  toolResultsAtom,
  type ToolRegistryServiceShape,
} from '../react/tool-registry.js'
import {
  GeniferToolDefinition,
  type GeniferToolHandler,
} from '../core/tools.js'

function makeDef(name: string, opts?: { requiresApproval?: boolean }) {
  return new GeniferToolDefinition({
    name,
    description: `Test tool: ${name}`,
    label: name,
    requiresApproval: opts?.requiresApproval,
  })
}

const echoHandler: GeniferToolHandler = async (_callId, args) => ({
  content: `echo: ${JSON.stringify(args)}`,
  data: args,
})

const failHandler: GeniferToolHandler = async () => {
  throw new Error('intentional failure')
}

describe('ToolRegistryService', () => {
  let service: ToolRegistryServiceShape
  let r: Registry.Registry

  beforeEach(() => {
    r = Registry.make()
    service = createToolRegistryService(r)
    service.reset()
  })

  // ─────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────

  it('registers a tool', () => {
    service.register(makeDef('echo'), echoHandler)

    const tools = service.list()
    expect(tools).toHaveLength(1)
    expect(tools[0].name).toBe('echo')
  })

  it('unregisters a tool', () => {
    service.register(makeDef('echo'), echoHandler)
    service.unregister('echo')

    expect(service.list()).toHaveLength(0)
  })

  it('registers multiple tools', () => {
    service.register(makeDef('echo'), echoHandler)
    service.register(makeDef('fail'), failHandler)

    expect(service.list()).toHaveLength(2)
  })

  // ─────────────────────────────────────────────────────────
  // Execution — success
  // ─────────────────────────────────────────────────────────

  it('executes a tool and returns result', async () => {
    service.register(makeDef('echo'), echoHandler)

    const result = await service.execute('echo', { message: 'hello' })

    expect(result.isError).toBe(false)
    expect(result.content).toContain('hello')
    expect(result.toolName).toBe('echo')
    expect(result.data).toEqual({ message: 'hello' })
  })

  it('result appears in toolResultsAtom', async () => {
    service.register(makeDef('echo'), echoHandler)
    await service.execute('echo', { x: 1 })

    const results = r.get(toolResultsAtom)
    expect(results).toHaveLength(1)
    expect(results[0].toolName).toBe('echo')
  })

  it('active calls are cleaned up after execution', async () => {
    service.register(makeDef('echo'), echoHandler)
    await service.execute('echo', {})

    const active = r.get(activeCallsAtom)
    expect(active.size).toBe(0)
  })

  // ─────────────────────────────────────────────────────────
  // Execution — errors
  // ─────────────────────────────────────────────────────────

  it('returns error result for unknown tool', async () => {
    const result = await service.execute('nope', {})

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('catches handler exceptions and returns error result', async () => {
    service.register(makeDef('fail'), failHandler)

    const result = await service.execute('fail', {})

    expect(result.isError).toBe(true)
    expect(result.content).toContain('intentional failure')
  })

  // ─────────────────────────────────────────────────────────
  // getResults filtering
  // ─────────────────────────────────────────────────────────

  it('getResults filters by tool name', async () => {
    service.register(makeDef('echo'), echoHandler)
    service.register(makeDef('fail'), failHandler)

    await service.execute('echo', { a: 1 })
    await service.execute('fail', {})
    await service.execute('echo', { a: 2 })

    expect(service.getResults('echo')).toHaveLength(2)
    expect(service.getResults('fail')).toHaveLength(1)
    expect(service.getResults()).toHaveLength(3) // all
  })

  // ─────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────

  it('reset clears everything', async () => {
    service.register(makeDef('echo'), echoHandler)
    await service.execute('echo', {})

    service.reset()

    expect(service.list()).toHaveLength(0)
    expect(r.get(toolResultsAtom)).toEqual([])
    expect(r.get(activeCallsAtom).size).toBe(0)
  })

  // ─────────────────────────────────────────────────────────
  // Custom callId + source
  // ─────────────────────────────────────────────────────────

  it('uses custom callId when provided', async () => {
    service.register(makeDef('echo'), echoHandler)

    const result = await service.execute('echo', {}, { callId: 'custom-123', source: 'llm' })

    expect(result.callId).toBe('custom-123')
  })
})
