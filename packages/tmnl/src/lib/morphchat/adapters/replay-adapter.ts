/**
 * Replay Adapter — HarnessSnapshot playback with transport controls
 *
 * Takes a HarnessSnapshot (array of HarnessEvents) and replays them
 * at configurable speed. Supports play, pause, seek, and speed control.
 *
 * Uses the same event→atom mapping as harness-adapter, but driven by
 * a local timer instead of a WebSocket stream.
 *
 * @module morphchat/adapters/replay-adapter
 */

import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import type { MorphChatAdapter, TransferSurfaceConfig } from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
} from '../schemas/message-types'
import { CONNECTED, DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'
import type { HarnessEvent, HarnessSnapshot } from '@/lib/harness/schemas'

// =============================================================================
// Config
// =============================================================================

export interface ReplayAdapterConfig {
  /** Snapshot to replay */
  readonly snapshot: HarnessSnapshot
  /** Adapter ID override */
  readonly adapterId?: string
  /** Human label */
  readonly label?: string
  /** Playback speed multiplier (1 = real-time, 2 = 2x, 0.5 = half) */
  readonly speed?: number
  /** Auto-play on creation */
  readonly autoPlay?: boolean
  /** Agent display name */
  readonly agentName?: string
  /** Transfer config */
  readonly transferConfig?: TransferSurfaceConfig
}

// =============================================================================
// Replay State
// =============================================================================

export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'complete'

export interface ReplayControls {
  /** Current playback status */
  readonly status$: Atom.Atom<ReplayStatus>
  /** Current event index (0-based) */
  readonly cursor$: Atom.Atom<number>
  /** Total event count */
  readonly totalEvents: number
  /** Playback speed */
  readonly speed$: Atom.Atom<number>
  /** Play from current cursor */
  play(): void
  /** Pause playback */
  pause(): void
  /** Seek to specific event index */
  seek(index: number): void
  /** Set playback speed */
  setSpeed(speed: number): void
  /** Reset to beginning */
  reset(): void
}

// =============================================================================
// Factory
// =============================================================================

let replayCounter = 0

export function createReplayAdapter(
  config: ReplayAdapterConfig,
): MorphChatAdapter & { controls: ReplayControls } {
  const {
    snapshot,
    agentName = 'Agent',
    speed: initialSpeed = 1,
    autoPlay = false,
  } = config

  const adapterId = config.adapterId ?? `replay-adapter-${++replayCounter}`
  const label = config.label ?? `Replay (${snapshot.sessionId})`
  const events = snapshot.events

  // ── Atoms ───────────────────────────────────────────────

  const messages$ = Atom.make<ReadonlyArray<ChatMessage>>([])
  morphChatRegistry.mount(messages$)

  const connection$ = Atom.make<ConnectionState>(DISCONNECTED)
  morphChatRegistry.mount(connection$)

  const streaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
  morphChatRegistry.mount(streaming$)

  const agents$ = Atom.make<ReadonlyArray<AgentInfo>>([])
  morphChatRegistry.mount(agents$)

  // Control atoms
  const status$ = Atom.make<ReplayStatus>('idle')
  morphChatRegistry.mount(status$)

  const cursor$ = Atom.make(0)
  morphChatRegistry.mount(cursor$)

  const speed$ = Atom.make(initialSpeed)
  morphChatRegistry.mount(speed$)

  // ── Playback Timer ──────────────────────────────────────

  let playTimer: ReturnType<typeof setTimeout> | null = null

  function processEvent(event: HarnessEvent): void {
    switch (event._tag) {
      case 'chat:v2/session_opened':
        morphChatRegistry.set(connection$, CONNECTED)
        morphChatRegistry.set(agents$, [{
          id: event.agentId,
          name: agentName,
          isActive: true,
        }])
        break

      case 'chat:v2/assistant_start': {
        const msg: ChatMessage = {
          id: event.messageId as string,
          role: 'agent',
          authorName: agentName,
          content: '',
          timestamp: new Date(event.at).toISOString(),
          status: 'streaming',
        }
        morphChatRegistry.update(messages$, (prev) => [...prev, msg])
        morphChatRegistry.set(streaming$, {
          isStreaming: true,
          buffer: '',
          messageId: event.messageId as string,
        })
        break
      }

      case 'chat:v2/assistant_delta':
        morphChatRegistry.update(streaming$, (prev) => ({
          ...prev,
          buffer: prev.buffer + event.delta,
        }))
        morphChatRegistry.update(messages$, (prev) =>
          prev.map((msg) =>
            msg.id === (event.messageId as string) && msg.status === 'streaming'
              ? { ...msg, content: msg.content + event.delta }
              : msg,
          ),
        )
        break

      case 'chat:v2/assistant_final':
        morphChatRegistry.update(messages$, (prev) =>
          prev.map((msg) =>
            msg.id === (event.messageId as string)
              ? { ...msg, content: event.text, status: 'complete' as const }
              : msg,
          ),
        )
        morphChatRegistry.set(streaming$, STREAMING_IDLE)
        break

      case 'chat:v2/send_accepted': {
        // Replay inserts user messages as sent
        const userMsg: ChatMessage = {
          id: event.clientMessageId as string,
          role: 'operator',
          content: `[user message ${event.clientMessageId}]`,
          timestamp: new Date(event.at).toISOString(),
          status: 'sent',
        }
        morphChatRegistry.update(messages$, (prev) => [...prev, userMsg])
        break
      }

      case 'chat:v2/usage':
        morphChatRegistry.update(messages$, (prev) =>
          prev.map((msg) =>
            msg.id === (event.messageId as string)
              ? {
                  ...msg,
                  model: event.model,
                  tokenUsage: {
                    prompt: event.usage.input,
                    completion: event.usage.output,
                    total: event.usage.totalTokens,
                  },
                }
              : msg,
          ),
        )
        break

      case 'chat:v2/error':
        morphChatRegistry.set(connection$, { phase: 'error', error: event.message })
        break

      default:
        break
    }
  }

  function scheduleNext(): void {
    const cursorVal = morphChatRegistry.get(cursor$)
    const speedVal = morphChatRegistry.get(speed$)

    if (cursorVal >= events.length) {
      morphChatRegistry.set(status$, 'complete')
      return
    }

    const currentEvent = events[cursorVal]
    const nextEvent = events[cursorVal + 1]

    // Process current event
    processEvent(currentEvent)
    morphChatRegistry.set(cursor$, cursorVal + 1)

    // Schedule next event
    if (nextEvent && cursorVal + 1 < events.length) {
      const delay = Math.max(1, (nextEvent.at - currentEvent.at) / speedVal)
      playTimer = setTimeout(scheduleNext, delay)
    } else {
      morphChatRegistry.set(status$, 'complete')
    }
  }

  // ── Controls ────────────────────────────────────────────

  const controls: ReplayControls = {
    status$,
    cursor$,
    totalEvents: events.length,
    speed$,

    play() {
      if (morphChatRegistry.get(status$) === 'complete') {
        // Reset if already complete
        controls.reset()
      }
      morphChatRegistry.set(status$, 'playing')
      scheduleNext()
    },

    pause() {
      if (playTimer) {
        clearTimeout(playTimer)
        playTimer = null
      }
      morphChatRegistry.set(status$, 'paused')
    },

    seek(index: number) {
      const wasPlaying = morphChatRegistry.get(status$) === 'playing'
      controls.pause()

      // Reset state
      morphChatRegistry.set(messages$, [])
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
      morphChatRegistry.set(connection$, DISCONNECTED)
      morphChatRegistry.set(agents$, [])
      morphChatRegistry.set(cursor$, 0)

      // Replay events up to index synchronously
      const target = Math.min(index, events.length)
      for (let i = 0; i < target; i++) {
        processEvent(events[i])
      }
      morphChatRegistry.set(cursor$, target)

      if (wasPlaying) controls.play()
    },

    setSpeed(speed: number) {
      morphChatRegistry.set(speed$, Math.max(0.1, speed))
    },

    reset() {
      controls.pause()
      morphChatRegistry.set(messages$, [])
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
      morphChatRegistry.set(connection$, DISCONNECTED)
      morphChatRegistry.set(agents$, [])
      morphChatRegistry.set(cursor$, 0)
      morphChatRegistry.set(status$, 'idle')
    },
  }

  // ── Adapter Interface ───────────────────────────────────

  const adapter: MorphChatAdapter & { controls: ReplayControls } = {
    adapterId,
    label,
    messages$,
    connection$,
    streaming$,
    agents$,
    transferConfig: config.transferConfig,
    send: () => Effect.void, // Read-only
    cancel: () => Effect.sync(() => controls.pause()),
    reconnect: () => Effect.sync(() => controls.play()),
    clear: () => Effect.sync(() => controls.reset()),
    dispose: () => Effect.sync(() => controls.pause()),
    controls,
  }

  // Auto-play if configured
  if (autoPlay && events.length > 0) {
    controls.play()
  }

  return adapter
}
