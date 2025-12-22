/**
 * usePtyConnection — WebSocket hook for PTY relay
 *
 * Connects GhosttyTerminal to the PTY WebSocket relay server.
 * Handles connection lifecycle, message encoding/decoding, and reconnection.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type { GhosttyTerminalRef } from './GhosttyTerminal'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrors server schemas)
// ─────────────────────────────────────────────────────────────────────────────

interface ClientData {
  _tag: 'ClientData'
  data: string
}

interface ClientResize {
  _tag: 'ClientResize'
  cols: number
  rows: number
}

interface ClientPing {
  _tag: 'ClientPing'
  timestamp: number
}

type ClientMessage = ClientData | ClientResize | ClientPing

interface ServerReady {
  _tag: 'ServerReady'
  sessionId: string
  pid: number
  cols: number
  rows: number
}

interface ServerData {
  _tag: 'ServerData'
  data: string
}

interface ServerExit {
  _tag: 'ServerExit'
  exitCode: number
  signal?: number | string
}

interface ServerError {
  _tag: 'ServerError'
  message: string
  code?: string
}

interface ServerPong {
  _tag: 'ServerPong'
  timestamp: number
  serverTime: number
}

type ServerMessage = ServerReady | ServerData | ServerExit | ServerError | ServerPong

// ─────────────────────────────────────────────────────────────────────────────
// Hook Options
// ─────────────────────────────────────────────────────────────────────────────

export interface UsePtyConnectionOptions {
  /** WebSocket URL (default: ws://localhost:7681/ws) */
  url?: string
  /** Shell to spawn (default: bash) */
  shell?: string
  /** Initial columns */
  cols?: number
  /** Initial rows */
  rows?: number
  /** Working directory */
  cwd?: string
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean
  /** Reconnect on disconnect (default: true) */
  reconnect?: boolean
  /** Reconnect delay in ms (default: 1000) */
  reconnectDelay?: number
  /** Max reconnect attempts (default: 5) */
  maxReconnectAttempts?: number

  // Callbacks
  onReady?: (session: { sessionId: string; pid: number }) => void
  onData?: (data: string) => void
  onExit?: (exitCode: number, signal?: number | string) => void
  onError?: (error: string) => void
  onConnectionChange?: (connected: boolean) => void
}

export interface UsePtyConnectionReturn {
  /** Connection status */
  connected: boolean
  /** Session ID (after ServerReady) */
  sessionId: string | null
  /** PTY process ID */
  pid: number | null
  /** Last error message */
  error: string | null
  /** Send data to PTY */
  write: (data: string) => void
  /** Resize PTY */
  resize: (cols: number, rows: number) => void
  /** Connect to PTY relay */
  connect: () => void
  /** Disconnect from PTY relay */
  disconnect: () => void
  /** Attach to terminal ref (wires onData) */
  attachTerminal: (termRef: React.RefObject<GhosttyTerminalRef>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function usePtyConnection(options: UsePtyConnectionOptions = {}): UsePtyConnectionReturn {
  const {
    url: baseUrl = 'ws://localhost:7681/ws',
    shell = 'bash',
    cols = 80,
    rows = 24,
    cwd,
    autoConnect = true,
    reconnect = true,
    reconnectDelay = 1000,
    maxReconnectAttempts = 5,
    onReady,
    onData,
    onExit,
    onError,
    onConnectionChange,
  } = options

  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pid, setPid] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const termRefInternal = useRef<React.RefObject<GhosttyTerminalRef> | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build URL with query params
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (shell) params.set('shell', shell)
    if (cols) params.set('cols', String(cols))
    if (rows) params.set('rows', String(rows))
    if (cwd) params.set('cwd', cwd)
    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [baseUrl, shell, cols, rows, cwd])

  // Send message
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Public write
  const write = useCallback(
    (data: string) => {
      send({ _tag: 'ClientData', data })
    },
    [send]
  )

  // Public resize
  const resize = useCallback(
    (cols: number, rows: number) => {
      send({ _tag: 'ClientResize', cols, rows })
    },
    [send]
  )

  // Connect
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = buildUrl()
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      reconnectAttempts.current = 0
      onConnectionChange?.(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage

        switch (msg._tag) {
          case 'ServerReady':
            setSessionId(msg.sessionId)
            setPid(msg.pid)
            onReady?.({ sessionId: msg.sessionId, pid: msg.pid })
            break

          case 'ServerData':
            // Write to attached terminal
            termRefInternal.current?.current?.write(msg.data)
            onData?.(msg.data)
            break

          case 'ServerExit':
            onExit?.(msg.exitCode, msg.signal)
            break

          case 'ServerError':
            setError(msg.message)
            onError?.(msg.message)
            break

          case 'ServerPong':
            // Could track latency here
            break
        }
      } catch (e) {
        console.error('[usePtyConnection] Failed to parse message:', e)
      }
    }

    ws.onerror = () => {
      setError('WebSocket error')
      onError?.('WebSocket error')
    }

    ws.onclose = () => {
      setConnected(false)
      onConnectionChange?.(false)
      wsRef.current = null

      // Attempt reconnect
      if (reconnect && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        reconnectTimeout.current = setTimeout(() => {
          connect()
        }, reconnectDelay)
      }
    }
  }, [
    buildUrl,
    reconnect,
    reconnectDelay,
    maxReconnectAttempts,
    onReady,
    onData,
    onExit,
    onError,
    onConnectionChange,
  ])

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current)
      reconnectTimeout.current = null
    }
    reconnectAttempts.current = maxReconnectAttempts // Prevent reconnect
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
    setSessionId(null)
    setPid(null)
  }, [maxReconnectAttempts])

  // Attach terminal
  const attachTerminal = useCallback(
    (termRef: React.RefObject<GhosttyTerminalRef>) => {
      termRefInternal.current = termRef
    },
    []
  )

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connected,
    sessionId,
    pid,
    error,
    write,
    resize,
    connect,
    disconnect,
    attachTerminal,
  }
}
