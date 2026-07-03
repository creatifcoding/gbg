import { describe, expect, it } from 'vitest'

import { piWorkflowsExtension } from '../src/index'

describe('Pi extension edge', () => {
  it('registers workflow tool and executes through ManagedRuntime', async () => {
    const tools: Array<any> = []
    const commands = new Map<string, any>()
    const events = new Map<string, any>()
    const statuses: Array<[string, string | undefined]> = []
    const notifications: Array<{ message: string; level: string }> = []
    const confirmations: Array<{ title: string; message: string }> = []
    const pi = {
      registerTool: (tool: any) => tools.push(tool),
      registerCommand: (name: string, command: any) => commands.set(name, command),
      on: (event: string, handler: any) => events.set(event, handler),
    }
    const ctx = {
      ui: {
        setStatus: (key: string, value: string | undefined) => statuses.push([key, value]),
        notify: (message: string, level: string) => notifications.push({ message, level }),
        confirm: (title: string, message: string) => {
          confirmations.push({ title, message })
          return true
        },
      },
    }

    piWorkflowsExtension(pi as never)

    expect(tools.map((tool) => tool.name)).toContain('workflow')
    expect(commands.has('workflows')).toBe(true)

    await events.get('session_start')?.({}, ctx)
    const result = await tools[0].execute(
      'tool-1',
      {
        dryRun: true,
        script: `export const meta = { name: "edge", description: "Edge smoke" } as const\nexport default async function workflow() {}`,
      },
      undefined,
      undefined,
      ctx,
    )

    expect(result.content[0].text).toContain('dry-run ok: edge')
    expect(result.details.valid).toBe(true)

    const runResult = await tools[0].execute(
      'tool-2',
      {
        script: `export const meta = { name: "edge-run", description: "Edge run" } as const\nexport default async function workflow() { return await agent('edge', { label: 'edge-agent' }) }`,
      },
      undefined,
      undefined,
      ctx,
    )
    const runId = runResult.details.result.run.id
    expect(confirmations.at(-1)?.title).toBe('Launch Pi workflow?')
    await commands.get('workflows').handler(`inspect ${runId}`, ctx)
    expect(notifications.at(-1)?.message).toContain('Workflow run')

    await commands.get('workflows').handler(`resume ${runId}`, ctx)

    expect(notifications.at(-1)?.message).toContain('Resume candidate found')

    await events.get('session_shutdown')?.({}, ctx)
    expect(statuses).toContainEqual(['pi-workflows', 'workflow runtime loaded'])
    expect(statuses).toContainEqual(['pi-workflows', undefined])
  })
})
