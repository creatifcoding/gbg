/**
 * CopyButton
 *
 * Simple clipboard copy button with success feedback.
 * Dark-themed for contrast islands.
 */

import * as React from 'react'
import { useState, useCallback, memo } from 'react'
import { darkButtonStyle, RVN_DARK } from './rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string
  /** Custom label (default: "COPY") */
  label?: string
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  button: {
    ...darkButtonStyle,
  },
  buttonSuccess: {
    color: RVN_DARK.success,
    borderColor: RVN_DARK.success,
  },
} as const

// =============================================================================
// Component
// =============================================================================

export const CopyButton = memo(function CopyButton({
  text,
  label = 'COPY',
  className,
  style,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={className}
      style={{
        ...styles.button,
        ...(copied ? styles.buttonSuccess : {}),
        ...style,
      }}
    >
      {copied ? '\u2713 COPIED' : label}
    </button>
  )
})

export default CopyButton
