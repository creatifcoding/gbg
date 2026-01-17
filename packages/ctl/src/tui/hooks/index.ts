/**
 * CTL TUI Hooks
 *
 * Re-export of OpenTUI React hooks for TUI development.
 */

// Re-export all OpenTUI hooks
export {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
  useTimeline,
} from "@opentui/react"

// Re-export hook option types
export type { UseKeyboardOptions } from "@opentui/react"

// Re-export useful types from core
export type { KeyEvent } from "@opentui/core"
