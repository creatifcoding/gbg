/**
 * Static Adapter — Pre-loaded messages, no send capability
 *
 * For embedding chat transcripts, documentation examples, or
 * read-only previews. Messages are provided at creation time.
 * Send/cancel/reconnect are all no-ops.
 *
 * @module morphchat/adapters/static-adapter
 */

import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import type { MorphChatAdapter, TransferSurfaceConfig } from '../schemas/adapter-types'
import type { ChatMessage, AgentInfo } from '../schemas/message-types'
import { CONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'

// =============================================================================
// Config
// =============================================================================

export interface StaticAdapterConfig {
  /** Pre-loaded messages */
  readonly messages: ReadonlyArray<ChatMessage>
  /** Adapter ID override */
  readonly adapterId?: string
  /** Human label */
  readonly label?: string
  /** Agent info to display */
  readonly agents?: ReadonlyArray<AgentInfo>
  /** Transfer config */
  readonly transferConfig?: TransferSurfaceConfig
}

// =============================================================================
// Factory
// =============================================================================

let staticCounter = 0

export function createStaticAdapter(config: StaticAdapterConfig): MorphChatAdapter {
  const adapterId = config.adapterId ?? `static-adapter-${++staticCounter}`
  const label = config.label ?? 'Static'

  const messages$ = Atom.make<ReadonlyArray<ChatMessage>>(config.messages)
  morphChatRegistry.mount(messages$)

  const connection$ = Atom.make(CONNECTED)
  morphChatRegistry.mount(connection$)

  const streaming$ = Atom.make(STREAMING_IDLE)
  morphChatRegistry.mount(streaming$)

  const agents$ = Atom.make<ReadonlyArray<AgentInfo>>(config.agents ?? [])
  morphChatRegistry.mount(agents$)

  // All operations are no-ops for static adapter
  const noop = () => Effect.void

  return {
    adapterId,
    label,
    messages$,
    connection$,
    streaming$,
    agents$,
    transferConfig: config.transferConfig,
    send: noop,
    cancel: noop,
    reconnect: noop,
    clear: () => Effect.sync(() => morphChatRegistry.set(messages$, [])),
    dispose: noop,
  }
}
