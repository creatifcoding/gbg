import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../../../..')

const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), 'utf8')

describe('Conductor chat v2 hard cut', () => {
  it('keeps conductor inspector send flow on stream-first chat-v2 path', () => {
    const source = read('src/components/testbed/ConductorTestbed.tsx')

    expect(source).not.toContain('awaitChatPromptWithConnectivityGuard')
    expect(source).not.toContain('settleDelayMs')
    expect(source).not.toContain('pollForAssistant')
    expect(source).not.toContain('/api/pi-orchestrator/health')
  })

  it('retires legacy gateway runPrompt path explicitly', () => {
    const source = read('src/components/testbed/conductor/ConductorAgentChatService.ts')
    expect(source).toContain('Legacy runPrompt pathway is retired')
  })

  it('keeps node chat state on chat-v2 session/snapshot/resume operations', () => {
    const source = read('src/components/testbed/conductor/agent-chat-stx.ts')

    expect(source).toContain('client.openSession')
    expect(source).toContain('resumeSession')
    expect(source).toContain('getSnapshot')
    expect(source).toContain('HarnessRuntimeBrowserWebSocketDefault')
    expect(source).not.toContain('PiRemoteChatV2Client')
    expect(source).not.toContain('settleDelayMs')
  })
})
