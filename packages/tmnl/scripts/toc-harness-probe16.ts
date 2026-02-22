/**
 * TOC Probe 16: Check what type event.data actually is in Bun WebSocket.
 */
const ws = new WebSocket('ws://127.0.0.1:8787/api/harness/ws')
ws.onopen = () => {
  ws.send(JSON.stringify({
    _tag: 'remote:ws_request',
    requestId: 'type-check',
    command: { _tag: 'remote:chat_v2_open_session', nodeId: 'typecheck', role: 'general' },
  }))
}
ws.onmessage = (event) => {
  console.log('type:', typeof event.data)
  console.log('instanceof String:', event.data instanceof String)
  console.log('instanceof Blob:', event.data instanceof Blob)
  console.log('instanceof ArrayBuffer:', event.data instanceof ArrayBuffer)
  console.log('instanceof Buffer:', event.data instanceof Buffer)
  console.log('constructor:', event.data?.constructor?.name)
  console.log('value preview:', String(event.data).slice(0, 80))
  ws.close()
  process.exit(0)
}
setTimeout(() => process.exit(1), 5000)
