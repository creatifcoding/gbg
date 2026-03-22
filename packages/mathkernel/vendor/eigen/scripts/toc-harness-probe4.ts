/**
 * TOC Probe 4: Raw WebSocket — does the server actually send two responses?
 */
const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'
const ws = new WebSocket(WS_URL)
let msgCount = 0

ws.onopen = () => {
  console.log('[ws] connected')
  
  // Request 1
  const r1 = {
    _tag: 'remote:ws_request',
    requestId: 'req-001',
    command: { _tag: 'remote:chat_v2_open_session', nodeId: 'raw-a', role: 'general' },
  }
  console.log('[ws] sending req-001')
  ws.send(JSON.stringify(r1))
}

ws.onmessage = (event) => {
  msgCount++
  const data = JSON.parse(event.data)
  console.log(`[ws] message #${msgCount}:`, data._tag, data.requestId ?? '', 
    data._tag === 'remote:ws_response' ? `ok=${data.response?.ok}` : `event=${data.event?._tag}`)
  
  // After first response, send request 2
  if (msgCount === 1 || (data._tag === 'remote:ws_response' && data.requestId === 'req-001')) {
    setTimeout(() => {
      const r2 = {
        _tag: 'remote:ws_request',
        requestId: 'req-002',
        command: { _tag: 'remote:chat_v2_open_session', nodeId: 'raw-b', role: 'general' },
      }
      console.log('[ws] sending req-002')
      ws.send(JSON.stringify(r2))
    }, 100)
  }
  
  if (data._tag === 'remote:ws_response' && data.requestId === 'req-002') {
    console.log('[ws] ✓ BOTH RESPONSES RECEIVED')
    ws.close()
    process.exit(0)
  }
}

ws.onerror = (e) => { console.error('[ws] error'); process.exit(1) }

setTimeout(() => {
  console.error(`[ws] TIMEOUT — received ${msgCount} messages total`)
  ws.close()
  process.exit(1)
}, 5000)
