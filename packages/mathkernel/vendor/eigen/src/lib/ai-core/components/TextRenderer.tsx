/**
 * TextRenderer
 *
 * Renders text content with brutalist scanline reveal animation.
 * Uses ScanlineDeclassify for streaming text with redacted-to-revealed effect.
 *
 * @example
 * ```tsx
 * <TextRenderer text="Hello world" isStreaming={false} />
 * ```
 */

import * as React from 'react'
import { ScanlineDeclassify } from '@/lib/testbed/ScanlineDeclassify'

// =============================================================================
// Types
// =============================================================================

export interface TextRendererProps {
  /** The text content to render (supports markdown) */
  text: string
  /** Whether the content is still streaming */
  isStreaming?: boolean
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Component
// =============================================================================

export const TextRenderer = React.memo(function TextRenderer({
  text,
  isStreaming = false,
  className,
  style,
}: TextRendererProps) {
  if (!text) {
    return null
  }

  return (
    <ScanlineDeclassify
      text={text}
      isStreaming={isStreaming}
      className={className}
      style={style}
    />
  )
})

export default TextRenderer
