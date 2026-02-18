/**
 * Shared Data Atoms — ADAPTER-BRIDGE LAYER
 *
 * These are NOT standalone state. They exist as optional convenience
 * for use cases where you have an adapterId but not the adapter reference.
 *
 * For most component code, read directly from adapter atoms:
 *   adapter.messages$, adapter.connection$, adapter.streaming$
 *
 * These family atoms are populated by the Surface provider when it
 * registers an adapter. They're a lookup index, not a source of truth.
 *
 * @module morphchat/atoms/data-atoms
 */

import { Atom } from '@effect-atom/atom'
import type { ChatMessage, ConnectionState, StreamingState, AgentInfo } from '../schemas/message-types'
import { DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import { morphChatRegistry } from './registry'

// =============================================================================
// Adapter Registry (adapterId → adapter reference)
// =============================================================================

/** Global adapter lookup — set by Surface provider on mount */
const adapterMap = new Map<string, MorphChatAdapter>()

export function registerAdapter(adapter: MorphChatAdapter): void {
  adapterMap.set(adapter.adapterId, adapter)
}

export function unregisterAdapter(adapterId: string): void {
  adapterMap.delete(adapterId)
}

export function getAdapter(adapterId: string): MorphChatAdapter | undefined {
  return adapterMap.get(adapterId)
}
