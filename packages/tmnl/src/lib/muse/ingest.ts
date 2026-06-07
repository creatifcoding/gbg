import { batch, stx } from '@/lib/stx'
import {
  parseMuseNdjsonLine,
  type MuseEvent,
  type MuseFrameEvent,
  type MuseSummaryEvent,
} from './schemas'

export type MuseConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'

export interface MuseIngestData {
  url: string
  status: MuseConnectionStatus
  events: MuseEvent[]
  lastSummary: MuseSummaryEvent | null
  lastFrame: MuseFrameEvent | null
  countsByType: Record<string, number>
  countsByChannel: Record<string, number>
  error: string | null
  connectedAt: number | null
  lastEventAt: number | null
  lastKeepaliveAt: number | null
  uiDroppedEvents: number
}

export interface MuseIngestOptions {
  url?: string
  maxEvents?: number
}

export interface MuseIngestController {
  readonly id: string
  readonly maxEvents: number
  readonly state: ReturnType<typeof createMuseIngestState>
  connect: (url?: string) => void
  disconnect: () => void
  appendLine: (line: string) => void
  dispose: () => void
}

const DEFAULT_URL = 'ws://127.0.0.1:8765'
const DEFAULT_MAX_EVENTS = 1_000

function createMuseIngestState(url: string) {
  return stx({
    data: {
      url,
      status: 'idle' as MuseConnectionStatus,
      events: [] as MuseEvent[],
      lastSummary: null as MuseSummaryEvent | null,
      lastFrame: null as MuseFrameEvent | null,
      countsByType: {} as Record<string, number>,
      countsByChannel: {} as Record<string, number>,
      error: null as string | null,
      connectedAt: null as number | null,
      lastEventAt: null as number | null,
      lastKeepaliveAt: null as number | null,
      uiDroppedEvents: 0,
    } satisfies MuseIngestData,
  })
}

function eventChannel(event: MuseEvent): string | null {
  if ('channel' in event && typeof event.channel === 'string') return event.channel
  return null
}

function decodeSocketData(data: unknown): Promise<string> {
  if (typeof data === 'string') return Promise.resolve(data)
  if (data instanceof ArrayBuffer) return Promise.resolve(new TextDecoder().decode(data))
  if (data instanceof Blob) return data.text()
  return Promise.reject(new Error(`Unsupported Muse WebSocket payload: ${Object.prototype.toString.call(data)}`))
}

export function createMuseIngestController(
  id: string,
  options: MuseIngestOptions = {},
): MuseIngestController {
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS
  const state = createMuseIngestState(options.url ?? DEFAULT_URL)
  let socket: WebSocket | null = null
  let disposed = false

  const appendEvent = (event: MuseEvent) => {
    const type = event.type
    const channel = eventChannel(event)

    batch(() => {
      const events = state.data.events.peek()
      const overflow = Math.max(0, events.length + 1 - maxEvents)
      const nextEvents = overflow > 0 ? [...events.slice(overflow), event] : [...events, event]

      state.data.events.set(nextEvents)
      if (overflow > 0) {
        state.data.uiDroppedEvents.set(state.data.uiDroppedEvents.peek() + overflow)
      }

      state.data.lastEventAt.set(Date.now())
      state.data.countsByType.set({
        ...state.data.countsByType.peek(),
        [type]: (state.data.countsByType.peek()[type] ?? 0) + 1,
      })

      if (channel) {
        state.data.countsByChannel.set({
          ...state.data.countsByChannel.peek(),
          [channel]: (state.data.countsByChannel.peek()[channel] ?? 0) + 1,
        })
      }

      switch (event.type) {
        case 'muse.summary':
          state.data.lastSummary.set(event)
          break
        case 'muse.frame':
          state.data.lastFrame.set(event)
          break
        case 'muse.keepalive':
          state.data.lastKeepaliveAt.set(Date.now())
          break
      }
    })
  }

  const appendLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const event = parseMuseNdjsonLine(trimmed)
      appendEvent(event)
    } catch (error) {
      batch(() => {
        state.data.status.set('error')
        state.data.error.set(error instanceof Error ? error.message : String(error))
      })
    }
  }

  const disconnect = () => {
    const current = socket
    socket = null
    if (current && current.readyState !== WebSocket.CLOSED) {
      current.close(1000, 'muse panel disconnect')
    }
    batch(() => {
      if (!disposed) state.data.status.set('closed')
    })
  }

  const connect = (url = state.data.url.peek()) => {
    if (disposed) return
    disconnect()

    batch(() => {
      state.data.url.set(url)
      state.data.status.set('connecting')
      state.data.error.set(null)
    })

    try {
      const next = new WebSocket(url)
      next.binaryType = 'arraybuffer'
      socket = next

      next.onopen = () => {
        if (socket !== next || disposed) return
        batch(() => {
          state.data.status.set('connected')
          state.data.connectedAt.set(Date.now())
          state.data.error.set(null)
        })
      }

      next.onmessage = (message) => {
        decodeSocketData(message.data)
          .then((text) => {
            for (const line of text.split(/\r?\n/)) appendLine(line)
          })
          .catch((error) => {
            batch(() => {
              state.data.status.set('error')
              state.data.error.set(error instanceof Error ? error.message : String(error))
            })
          })
      }

      next.onerror = () => {
        if (socket !== next || disposed) return
        batch(() => {
          state.data.status.set('error')
          state.data.error.set('Muse WebSocket error')
        })
      }

      next.onclose = () => {
        if (socket !== next || disposed) return
        socket = null
        batch(() => {
          state.data.status.set('closed')
        })
      }
    } catch (error) {
      batch(() => {
        state.data.status.set('error')
        state.data.error.set(error instanceof Error ? error.message : String(error))
      })
    }
  }

  const dispose = () => {
    disposed = true
    disconnect()
    void state.dispose()
  }

  return {
    id,
    maxEvents,
    state,
    connect,
    disconnect,
    appendLine,
    dispose,
  }
}
