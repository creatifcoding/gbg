/**
 * RVN Components
 *
 * Dark-themed "contrast island" components for AI chat interfaces.
 * Used for tool calls, thinking sections, and system UI elements.
 */

// =============================================================================
// Tokens
// =============================================================================

export {
  // Dark theme tokens
  RVN_DARK,
  // Shared styles
  darkContainerStyle,
  darkHeaderStyle,
  darkLabelStyle,
  darkCodeBlockStyle,
  darkChevronStyle,
  darkButtonStyle,
  darkApplyButtonStyle,
  darkStatusStyles,
  // Base RVN tokens (re-exported for convenience)
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_SPACING,
  RVN_BORDERS,
} from './rvn-tokens'

// =============================================================================
// Components
// =============================================================================

export { CopyButton, type CopyButtonProps } from './CopyButton'
export { ThinkingSection, type ThinkingSectionProps } from './ThinkingSection'
export { SideBySideDiff, type SideBySideDiffProps } from './SideBySideDiff'
export { ToolArgsFormatted, type ToolArgsFormattedProps } from './ToolArgsFormatted'
export { ToolResultFormatted, type ToolResultFormattedProps } from './ToolResultFormatted'
export { RvnErrorDisplay, type RvnErrorDisplayProps } from './RvnErrorDisplay'
export { ToolCallBlock, type ToolCallBlockProps } from './ToolCallBlock'
