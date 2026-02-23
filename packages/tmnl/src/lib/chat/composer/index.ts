/**
 * TMNL Chat Composer — Compound Component
 *
 * Usage:
 * ```tsx
 * <Composer onSubmit={handleSubmit}>
 *   <Composer.ContextChips />
 *   <Composer.TextArea placeholder="Message..." />
 *   <Composer.Toolbar>
 *     <Composer.ToolbarGroup>
 *       <Composer.ModeToggle />
 *       <Composer.Divider />
 *       <Composer.ThinkingLevel />
 *     </Composer.ToolbarGroup>
 *     <Composer.ToolbarGroup>
 *       <Composer.ActionButton icon={<Paperclip size={14} />} title="Attach" />
 *       <Composer.SendButton />
 *     </Composer.ToolbarGroup>
 *   </Composer.Toolbar>
 * </Composer>
 * ```
 */

import { ComposerRoot, type ComposerProps } from './composer-root'
import { ComposerTextArea } from './composer-textarea'
import {
  ComposerToolbar,
  ComposerToolbarGroup,
  ComposerDivider,
} from './composer-toolbar'
import { ComposerModeToggle } from './composer-mode-toggle'
import { ComposerThinkingLevel } from './composer-thinking-level'
import { ComposerSendButton } from './composer-send-button'
import { ComposerActionButton } from './composer-action-button'
import { ComposerContextChips } from './composer-context-chips'
import { ComposerTerminal } from './composer-terminal'
import { ComposerTerminalSlot } from './composer-terminal-slot'

// Re-export context hook for advanced consumers
export { useComposer } from './composer-context'
export type { ComposerContextValue } from './composer-context'

// Re-export types
export type {
  ComposerProps,
  ChatMode,
  ThinkingLevel,
  ContextChip,
  ComposerSubmitParams,
  ThinkingAnimationPreset,
  ThinkingLevelOption,
  ShadowLayer,
} from './types'
export type { ComposerProps as ComposerRootProps } from './composer-root'
export type { ComposerTerminalProps } from './composer-terminal'
export type { ComposerTerminalSlotProps } from './composer-terminal-slot'

// =============================================================================
// Compound Component Assembly
// =============================================================================

interface ComposerComponent {
  (props: ComposerProps & { ref?: React.Ref<HTMLDivElement> }): React.ReactElement | null
  displayName?: string

  // Sub-components
  TextArea: typeof ComposerTextArea
  Toolbar: typeof ComposerToolbar
  ToolbarGroup: typeof ComposerToolbarGroup
  Divider: typeof ComposerDivider
  ModeToggle: typeof ComposerModeToggle
  ThinkingLevel: typeof ComposerThinkingLevel
  SendButton: typeof ComposerSendButton
  ActionButton: typeof ComposerActionButton
  ContextChips: typeof ComposerContextChips
  Terminal: typeof ComposerTerminal
  TerminalSlot: typeof ComposerTerminalSlot
}

const Composer = ComposerRoot as unknown as ComposerComponent

Composer.TextArea = ComposerTextArea
Composer.Toolbar = ComposerToolbar
Composer.ToolbarGroup = ComposerToolbarGroup
Composer.Divider = ComposerDivider
Composer.ModeToggle = ComposerModeToggle
Composer.ThinkingLevel = ComposerThinkingLevel
Composer.SendButton = ComposerSendButton
Composer.ActionButton = ComposerActionButton
Composer.ContextChips = ComposerContextChips
Composer.Terminal = ComposerTerminal
Composer.TerminalSlot = ComposerTerminalSlot

export { Composer }
