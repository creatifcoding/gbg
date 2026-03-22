/**
 * MorphChat Skin Interface & Slot Contracts
 *
 * Skins provide visual appearance without changing structure.
 * Inherited from MorphCard's skin pattern — slot components
 * that the topology resolver inserts at rendering time.
 *
 * Each slot is a React component type with typed props.
 * Skins are passed to `<MorphChat.Surface skin={...} />`.
 *
 * @module morphchat/schemas/skin-types
 */

import type { ComponentType, ReactNode } from 'react'
import type { ChatRole, MessageStatus, ConnectionPhase } from './message-types'
import type { FrameChromeLevel, ComposerVariant } from './surface-spec'

// =============================================================================
// Slot Prop Contracts
// =============================================================================

/**
 * Shell slot — outermost container for the entire surface.
 */
export interface ShellSlotProps {
  /** Frame chrome level from spec */
  readonly frameChrome: FrameChromeLevel
  /** Whether surface is focused */
  readonly isFocused: boolean
  /** Surface label from spec */
  readonly label: string
  /** Children to render inside the shell */
  readonly children: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Message bubble slot — wraps each message in the thread.
 */
export interface MessageSlotProps {
  /** Author role */
  readonly role: ChatRole
  /** Message status */
  readonly status: MessageStatus
  /** Whether this message is currently streaming */
  readonly isStreaming: boolean
  /** Whether this is the latest message */
  readonly isLatest: boolean
  /** Children: message content */
  readonly children: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Composer frame slot — wraps the composer area.
 */
export interface ComposerSlotProps {
  /** Composer variant from spec */
  readonly variant: ComposerVariant
  /** Whether composer is focused */
  readonly isFocused: boolean
  /** Whether a message is currently streaming */
  readonly isStreaming: boolean
  /** Children: composer content */
  readonly children: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Header bar slot — rendered at top of surface (when frame chrome allows).
 */
export interface HeaderSlotProps {
  /** Surface label */
  readonly label: string
  /** Connection phase */
  readonly connectionPhase: ConnectionPhase
  /** Morph target selector (when morphing is available) */
  readonly onMorphRequest?: (presetTag: string) => void
  /** Children: header actions/buttons */
  readonly children?: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Badge/chip slot — generic badge styling for connection, status, etc.
 */
export interface BadgeSlotProps {
  /** Badge variant */
  readonly variant: 'connection' | 'status' | 'role' | 'count' | 'custom'
  /** Visual tone */
  readonly tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'
  /** Whether badge pulses/animates */
  readonly animated?: boolean
  /** Children: badge content */
  readonly children: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Thread container slot — wraps the message list area.
 */
export interface ThreadSlotProps {
  /** Whether thread is currently auto-scrolling */
  readonly isAutoScrolling: boolean
  /** Whether content is streaming */
  readonly isStreaming: boolean
  /** Children: message list */
  readonly children: ReactNode
  /** Additional CSS classes */
  readonly className?: string
}

/**
 * Empty state slot — shown when thread has no messages.
 */
export interface EmptyStateSlotProps {
  /** Surface label */
  readonly label: string
  /** Whether connection is active */
  readonly isConnected: boolean
  /** Additional CSS classes */
  readonly className?: string
}

// =============================================================================
// Skin Interface
// =============================================================================

/**
 * MorphChatSkin — the visual identity of a surface.
 *
 * Each slot is a React component that receives typed props.
 * The topology resolver uses these to wrap structural content.
 *
 * Skins are composable — you can spread a base skin and override
 * individual slots:
 *
 * ```ts
 * const mySkin: MorphChatSkin = {
 *   ...tmnlChatSkin,
 *   MessageBubble: MyCustomBubble,
 * }
 * ```
 */
export interface MorphChatSkin {
  /** Shell frame — outermost container */
  readonly Shell: ComponentType<ShellSlotProps>

  /** Message bubble — wraps each message */
  readonly MessageBubble: ComponentType<MessageSlotProps>

  /** Composer frame — wraps the input area */
  readonly ComposerFrame: ComponentType<ComposerSlotProps>

  /** Header bar — surface title + controls */
  readonly HeaderBar: ComponentType<HeaderSlotProps>

  /** Badge — generic chip/badge */
  readonly Badge: ComponentType<BadgeSlotProps>

  /** Thread container — wraps message list */
  readonly ThreadContainer: ComponentType<ThreadSlotProps>

  /** Empty state — no messages yet */
  readonly EmptyState: ComponentType<EmptyStateSlotProps>
}

// =============================================================================
// Skin Defaults
// =============================================================================

/**
 * Placeholder for skins that don't need a custom slot —
 * just renders children with optional className.
 */
export interface PassthroughSlotProps {
  readonly children?: ReactNode
  readonly className?: string
}
