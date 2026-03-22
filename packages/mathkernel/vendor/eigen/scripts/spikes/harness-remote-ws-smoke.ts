#!/usr/bin/env bun

/**
 * Harness Remote WS smoke check
 *
 * Verifies:
 *  1) WS upgrade/connect works
 *  2) remote:get_available_models responds
 *  3) remote:chat_v2_open_session responds
 */

const WS_URL = process.env.HARNESS_WS_URL ?? 'ws://localhost:8787/api/harness/ws'

type Envelope = {
  _tag: 'remote:ws_request'
  requestId: string
  command: any
}

function makeRequest(requestId: string, command: any): Envelope {
  return {
    _tag: 'remote:ws_request',
    requestId,
    command,
  }
}

async function main() {
  console.log(`[smoke] connecting to ${WS_URL}`)

  const ws = new WebSocket(WS_URL)

  const pending = new Map<string, (msg: any) => void>()

  const waitForResponse = (requestId: string, timeoutMs = 10_000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error(`timeout waiting for response to ${requestId}`))
      }, timeoutMs)

      pending.set(requestId, (msg) => {
        clearTimeout(timeout)
        pending.delete(requestId)
        resolve(msg)
      })
    })
  }

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(new Error(`websocket open failed: ${String(e)}`))
  })

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(String(event.data))
      if (msg?._tag === 'remote:ws_response' && typeof msg.requestId === 'string') {
        const cb = pending.get(msg.requestId)
        if (cb) cb(msg)
      }
    } catch {
      // ignore non-json frames
    }
  }

  // 1) get_available_models
  {
    const requestId = `req-models-${Date.now()}`
    ws.send(
      JSON.stringify(
        makeRequest(requestId, {
          _tag: 'remote:get_available_models',
        }),
      ),
    )
    const response = await waitForResponse(requestId)
    if (!response.response?.ok) {
      throw new Error(`[models] failed: ${response.response?.message ?? 'unknown'}`)
    }
    const models = response.response?.data?.models
    console.log(`[smoke] models response ok (${Array.isArray(models) ? models.length : 0} models)`)
  }

  // 2) open_session
  {
    const requestId = `req-open-${Date.now()}`
    ws.send(
      JSON.stringify(
        makeRequest(requestId, {
          _tag: 'remote:chat_v2_open_session',
          nodeId: `smoke-${Date.now()}`,
          role: 'general',
        }),
      ),
    )
    const response = await waitForResponse(requestId)
    if (!response.response?.ok) {
      throw new Error(`[open_session] failed: ${response.response?.message ?? 'unknown'}`)
    }
    console.log(`[smoke] open_session ok: ${JSON.stringify(response.response.data)}`)
  }

  ws.close()
  console.log('[smoke] PASS')
}

main().catch((err) => {
  console.error('[smoke] FAIL', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
