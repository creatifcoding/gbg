import { beforeEach, describe, expect, it } from 'vitest'
import extension from '../index.ts'
import { resetState } from '../state/atoms.ts'

interface RegisteredTool {
  name: string
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<any>
}

describe('extension wiring', () => {
  beforeEach(() => {
    resetState()
  })

  it('registers expected tools and command', async () => {
    const tools: RegisteredTool[] = []
    const commands = new Map<string, any>()

    extension({
      registerTool: (tool: RegisteredTool) => tools.push(tool),
      registerCommand: (name: string, command: unknown) => commands.set(name, command),
    } as any)

    expect(tools.map((t) => t.name)).toEqual([
      'component_breakdown_templates',
      'component_breakdown_state',
    ])
    expect(commands.has('component-breakdown')).toBe(true)

    const templateTool = tools.find((t) => t.name === 'component_breakdown_templates')!
    const stateTool = tools.find((t) => t.name === 'component_breakdown_state')!

    const result = await templateTool.execute('call-1', { componentName: 'WidgetSurface' })
    expect(result.isError).toBeUndefined()
    expect(String(result.content[0]?.text ?? '')).toContain('Component Breakdown Template Pack: WidgetSurface')

    const state = await stateTool.execute('call-2', {})
    const json = String(state.content[0]?.text ?? '')
    expect(json).toContain('"status": "done"')
    expect(json).toContain('"runs": 1')
    expect(json).toContain('"hasBundle": true')

    const fullState = await stateTool.execute('call-3', { view: 'full' })
    expect(String(fullState.content[0]?.text ?? '')).toContain('"lastBundle"')
  })

  it('handles command direct mode without UI', async () => {
    const tools: RegisteredTool[] = []
    const commands = new Map<string, any>()

    extension({
      registerTool: (tool: RegisteredTool) => tools.push(tool),
      registerCommand: (name: string, command: unknown) => commands.set(name, command),
    } as any)

    const command = commands.get('component-breakdown')
    await expect(
      command.handler('NoUIComponent', { hasUI: false }),
    ).resolves.toBeUndefined()

    const stateTool = tools.find((t) => t.name === 'component_breakdown_state')!
    const state = await stateTool.execute('call-2', {})
    expect(String(state.content[0]?.text ?? '')).toContain('"status": "done"')
  })
})
