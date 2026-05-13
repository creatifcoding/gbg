/**
 * Quick-and-dirty RPC smoke for remote pi orchestrator.
 *
 * Purpose:
 * - verify websocket transport reachability
 * - verify remote:get_for_node -> remote:prompt -> remote:get_messages
 * - prove assistant text can be retrieved for Conductor AgentChat vertical slice
 */

const WS_URL = 'ws://localhost:8787/api/pi-orchestrator/ws'

const waitOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (event) => reject(event)
    setTimeout(() => reject(new Error('open timeout')), 5000)
  })

const request = (
  ws: WebSocket,
  command: Record<string, unknown>,
  timeoutMs = 120000,
) =>
  new Promise<any>((resolve, reject) => {
    const requestId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const onMessage = (event: MessageEvent) => {
      const payload = JSON.parse(String(event.data)) as {
        _tag?: string
        requestId?: string
        response?: unknown
      }

      if (payload._tag !== 'remote:ws_response' || payload.requestId !== requestId) {
        return
      }

      ws.removeEventListener('message', onMessage)
      resolve(payload.response)
    }

    ws.addEventListener('message', onMessage)
    ws.send(
      JSON.stringify({
        _tag: 'remote:ws_request',
        requestId,
        command,
      }),
    )

    setTimeout(() => {
      ws.removeEventListener('message', onMessage)
      reject(new Error(`request timeout ${String(command._tag ?? 'command')}`))
    }, timeoutMs)
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const readAssistantText = (messages: ReadonlyArray<any>): string => {
  const lastAssistant = [...messages].reverse().find((entry) => entry?.role === 'assistant')
  if (!lastAssistant || !Array.isArray(lastAssistant.content)) return ''

  return lastAssistant.content
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => String(part.text ?? ''))
    .join('')
    .trim()
}

async function main() {
  const ws = new WebSocket(WS_URL)
  await waitOpen(ws)
  console.log('[quick-smoke] ws open')

  const acquire = await request(ws, {
    _tag: 'remote:get_for_node',
    nodeId: 'conductor-quick-smoke-node',
    role: 'general',
  }, 30000)

  if (!acquire.ok) {
    throw new Error(`acquire failed: ${acquire.message}`)
  }

  const agentId = acquire.data?.agent?.agentId
  if (!agentId) {
    throw new Error('missing agent id from acquire response')
  }

  console.log(`[quick-smoke] agent=${agentId}`)

  const prompt = await request(ws, {
    _tag: 'remote:prompt',
    agentId,
    message: 'Say PONG and one short status line.',
  }, 120000)

  if (!prompt.ok) {
    throw new Error(`prompt failed: ${prompt.message}`)
  }

  console.log('[quick-smoke] prompt accepted')

  let assistantText = ''
  for (let poll = 0; poll < 18; poll += 1) {
    await sleep(5000)

    const messagesResponse = await request(ws, {
      _tag: 'remote:get_messages',
      agentId,
    }, 30000)

    if (!messagesResponse.ok) {
      throw new Error(`get_messages failed: ${messagesResponse.message}`)
    }

    const messages = messagesResponse.data?.messages ?? []
    assistantText = readAssistantText(messages)
    console.log(`[quick-smoke] poll=${poll + 1} messages=${messages.length} assistantLen=${assistantText.length}`)

    if (assistantText.length > 0) break
  }

  console.log(`[quick-smoke] assistant=${assistantText.slice(0, 220)}`)
  ws.close()

  if (assistantText.length === 0) {
    throw new Error('assistant text remained empty')
  }
}

main().catch((error) => {
  console.error('[quick-smoke] failed', error)
  process.exitCode = 1
})
