#!/usr/bin/env bun

/**
 * spawn_panel harness eval
 *
 * Opens a real harness WS session, prompts the MorphChat/Pi harness agent to call
 * spawn_panel, then asserts that the server relays panel lifecycle events:
 *   1. panel:spawned with a streaming surface
 *   2. panel:surface_updated with a UITree patch/snapshot
 *   3. preferably panel:surface_updated with status:complete + treeSnapshot
 *
 * This is intentionally an integration/eval probe, not a deterministic unit test:
 * it exercises the same tool-calling path a user hits from MorphChat.
 */

const WS_URL = process.env.HARNESS_WS_URL ?? 'ws://127.0.0.1:8787/api/harness/ws'
const TIMEOUT_MS = Number(process.env.SPAWN_PANEL_EVAL_TIMEOUT_MS ?? 180_000)
const REQUIRE_COMPLETE = process.env.SPAWN_PANEL_EVAL_REQUIRE_COMPLETE === '1'

interface WsRequest {
  _tag: 'remote:ws_request'
  requestId: string
  command: Record<string, unknown>
}

interface PanelObservation {
  tag: string
  atMs: number
  surfaceId?: string
  panelId?: string
  surfaceIncluded: boolean
  surfaceStatus?: string
  patchSeq?: number
  hasTreePatch: boolean
  hasTreeSnapshot: boolean
  elementCount?: number
}

const startedAt = Date.now()
const nowMs = () => Date.now() - startedAt
const rid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function makeRequest(command: Record<string, unknown>): WsRequest {
  return {
    _tag: 'remote:ws_request',
    requestId: rid('req'),
    command,
  }
}

function summarizePanelEvent(event: any): PanelObservation {
  const surface = event?.surface
  return {
    tag: event?._tag ?? 'unknown',
    atMs: nowMs(),
    surfaceId: typeof event?.surfaceId === 'string' ? event.surfaceId : undefined,
    panelId: typeof event?.panelId === 'string' ? event.panelId : undefined,
    surfaceIncluded: surface != null,
    surfaceStatus: typeof surface?.status === 'string' ? surface.status : undefined,
    patchSeq: typeof surface?.patchSeq === 'number' ? surface.patchSeq : undefined,
    hasTreePatch: surface?.treePatch != null,
    hasTreeSnapshot: surface?.treeSnapshot != null,
    elementCount: typeof surface?.quality?.elementCount === 'number'
      ? surface.quality.elementCount
      : undefined,
  }
}

function textForObservation(obs: PanelObservation): string {
  return [
    `${obs.atMs}ms`,
    obs.tag,
    `surface=${obs.surfaceId ?? 'none'}`,
    `panel=${obs.panelId ?? 'none'}`,
    `included=${obs.surfaceIncluded}`,
    `status=${obs.surfaceStatus ?? 'n/a'}`,
    `patchSeq=${obs.patchSeq ?? 'n/a'}`,
    `treePatch=${obs.hasTreePatch}`,
    `treeSnapshot=${obs.hasTreeSnapshot}`,
    `elements=${obs.elementCount ?? 'n/a'}`,
  ].join(' ')
}

async function main() {
  console.log(`[eval] connecting ${WS_URL}`)
  const ws = new WebSocket(WS_URL)

  const pending = new Map<string, (msg: any) => void>()
  const observations: PanelObservation[] = []
  const chatEvents: string[] = []

  const waitForOpen = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout opening websocket')), 10_000)
    ws.onopen = () => {
      clearTimeout(timeout)
      resolve()
    }
    ws.onerror = (event) => {
      clearTimeout(timeout)
      reject(new Error(`websocket error: ${String(event)}`))
    }
  })

  ws.onmessage = (event) => {
    let msg: any
    try {
      msg = JSON.parse(String(event.data))
    } catch {
      return
    }

    if (msg?._tag === 'remote:ws_response' && typeof msg.requestId === 'string') {
      pending.get(msg.requestId)?.(msg)
      return
    }

    if (msg?._tag !== 'remote:ws_event') return

    const envelope = msg.event
    if (envelope?._tag === 'remote:panel_event') {
      const obs = summarizePanelEvent(envelope.event)
      observations.push(obs)
      console.log(`[panel] ${textForObservation(obs)}`)
      return
    }

    if (envelope?._tag === 'remote:chat_v2_event') {
      const inner = envelope.event
      const label = `${nowMs()}ms ${inner?._tag ?? 'unknown'}${typeof inner?.seq === 'number' ? `#${inner.seq}` : ''}`
      chatEvents.push(label)
      if (
        inner?._tag === 'chat:v2/tool_event'
        || inner?._tag === 'chat:v2/message_delta'
        || inner?._tag === 'chat:v2/message_complete'
      ) {
        console.log(`[chat] ${label}`)
      }
    }
  }

  function request(command: Record<string, unknown>, timeoutMs = 20_000): Promise<any> {
    const payload = makeRequest(command)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(payload.requestId)
        reject(new Error(`timeout waiting for ${command._tag}`))
      }, timeoutMs)
      pending.set(payload.requestId, (msg) => {
        clearTimeout(timeout)
        pending.delete(payload.requestId)
        resolve(msg)
      })
      ws.send(JSON.stringify(payload))
    })
  }

  await waitForOpen

  const open = await request({
    _tag: 'remote:chat_v2_open_session',
    nodeId: `spawn-panel-eval-${Date.now()}`,
    role: 'general',
    forceNew: true,
  })

  if (!open.response?.ok) {
    throw new Error(`[open_session] ${open.response?.message ?? 'failed'}`)
  }

  const sessionId = open.response.data.sessionId
  console.log(`[eval] session=${sessionId}`)

  const prompt = [
    'You are validating the TMNL MorphChat harness spawn_panel integration.',
    'Call the spawn_panel tool exactly once now.',
    'Use this tool payload intent: prompt = "Create a compact TMNL diagnostics panel with a title, three status rows, and one cyan action button. Keep it static and simple."; title = "Spawn Panel Eval"; mode = "floating".',
    'After the tool call returns, reply with one short sentence containing the surfaceId if available.',
    'Do not merely describe the panel; the validation requires the actual tool call.',
  ].join('\n')

  const send = await request({
    _tag: 'remote:chat_v2_send',
    sessionId,
    clientMessageId: rid('cmid'),
    text: prompt,
  }, 30_000)

  if (!send.response?.ok) {
    throw new Error(`[send] ${send.response?.message ?? 'failed'}`)
  }

  const promptAcceptedAtMs = nowMs()
  console.log(`[eval] prompt accepted; waiting up to ${TIMEOUT_MS}ms for panel events`)

  const currentSpawn = () => observations.find((o) => o.atMs >= promptAcceptedAtMs && o.tag === 'panel:spawned')
  const currentSpawnWithSurface = () => observations.find((o) => o.atMs >= promptAcceptedAtMs && o.tag === 'panel:spawned' && o.surfaceIncluded)
  const currentUpdates = () => {
    const surfaceId = currentSpawn()?.surfaceId
    return observations.filter((o) => o.atMs >= promptAcceptedAtMs && o.tag === 'panel:surface_updated' && o.surfaceId === surfaceId)
  }
  const currentStreamedTree = () => currentUpdates().find((o) => o.hasTreePatch || o.hasTreeSnapshot)
  const currentComplete = () => currentUpdates().find((o) => o.surfaceStatus === 'complete' && o.hasTreeSnapshot)

  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    const spawned = currentSpawnWithSurface()
    const streamedTree = currentStreamedTree()
    const complete = currentComplete()

    if (spawned && streamedTree && (!REQUIRE_COMPLETE || complete)) break
    await Bun.sleep(500)
  }

  const spawned = currentSpawn()
  const spawnedWithSurface = currentSpawnWithSurface()
  const streamedTree = currentStreamedTree()
  const complete = currentComplete()

  console.log('\n[eval] summary')
  console.log(`  observations=${observations.length}`)
  console.log(`  chatEvents=${chatEvents.length}`)
  console.log(`  spawned=${spawned ? textForObservation(spawned) : 'NO'}`)
  console.log(`  spawnedWithSurface=${spawnedWithSurface ? 'YES' : 'NO'}`)
  console.log(`  streamedTree=${streamedTree ? textForObservation(streamedTree) : 'NO'}`)
  console.log(`  complete=${complete ? textForObservation(complete) : 'NO'}`)

  const failures: string[] = []
  if (!spawned) failures.push('no panel:spawned event observed')
  if (!spawnedWithSurface) failures.push('panel:spawned did not include a surface payload')
  if (!streamedTree) failures.push('no panel:surface_updated event with UITree patch/snapshot observed')
  if (REQUIRE_COMPLETE && !complete) failures.push('no complete surface update with treeSnapshot observed')

  ws.close()

  if (failures.length > 0) {
    console.error('\n[eval] FAIL')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
    return
  }

  console.log('\n[eval] PASS')
}

main().catch((err) => {
  console.error('[eval] CRASH', err instanceof Error ? err.stack ?? err.message : err)
  process.exitCode = 1
})
