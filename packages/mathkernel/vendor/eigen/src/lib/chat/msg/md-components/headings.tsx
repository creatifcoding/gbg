/**
 * TMNL Markdown Headings — h1 through h6.
 *
 * Design: Monospace, neutral-100, with a subtle left accent border on h1/h2.
 * All sizes respect the TMNL typography floor (12px minimum).
 *
 * @module chat/msg/md-components/headings
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { sameClassAndNode, type WithNode, type MarkdownNode } from './types'

// ─── Heading types ──────────────────────────────────────────────────────────

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
type HeadingProps = WithNode<JSX.IntrinsicElements[HeadingTag]>

// ─── Heading config ─────────────────────────────────────────────────────────

interface HeadingConfig {
  tag: HeadingTag
  /** CSS variable with fallback */
  fontSize: string
  /** Tailwind weight class */
  weight: string
  /** Top margin */
  mt: string
  /** Bottom margin */
  mb: string
  /** Optional left accent */
  accent?: boolean
}

const HEADING_CONFIGS: Record<HeadingTag, HeadingConfig> = {
  h1: { tag: 'h1', fontSize: 'var(--tmnl-heading-1, 18px)', weight: 'font-bold', mt: 'mt-5', mb: 'mb-2', accent: true },
  h2: { tag: 'h2', fontSize: 'var(--tmnl-heading-2, 15px)', weight: 'font-bold', mt: 'mt-4', mb: 'mb-1.5', accent: true },
  h3: { tag: 'h3', fontSize: 'var(--tmnl-heading-3, 13px)', weight: 'font-semibold', mt: 'mt-3', mb: 'mb-1' },
  h4: { tag: 'h4', fontSize: 'var(--tmnl-heading-4, 12px)', weight: 'font-semibold', mt: 'mt-2.5', mb: 'mb-1' },
  h5: { tag: 'h5', fontSize: 'var(--tmnl-heading-5, 12px)', weight: 'font-semibold', mt: 'mt-2', mb: 'mb-0.5' },
  h6: { tag: 'h6', fontSize: 'var(--tmnl-heading-6, 12px)', weight: 'font-medium', mt: 'mt-2', mb: 'mb-0.5' },
}

// ─── Factory ────────────────────────────────────────────────────────────────

function createHeading(config: HeadingConfig) {
  const Tag = config.tag

  const Component = memo<HeadingProps>(
    ({ children, className, node, ...props }) => (
      <Tag
        className={cn(
          config.weight,
          config.mt,
          config.mb,
          'text-neutral-100 font-heading leading-tight',
          config.accent && 'pl-2.5 border-l-2 border-cyan-500/40',
          className,
        )}
        style={{ fontSize: config.fontSize }}
        data-tmnl-md={config.tag}
        {...props}
      >
        {children}
      </Tag>
    ),
    sameClassAndNode,
  )
  Component.displayName = `TmnlMd.${Tag.toUpperCase()}`
  return Component
}

// ─── Exports ────────────────────────────────────────────────────────────────

export const MdH1 = createHeading(HEADING_CONFIGS.h1)
export const MdH2 = createHeading(HEADING_CONFIGS.h2)
export const MdH3 = createHeading(HEADING_CONFIGS.h3)
export const MdH4 = createHeading(HEADING_CONFIGS.h4)
export const MdH5 = createHeading(HEADING_CONFIGS.h5)
export const MdH6 = createHeading(HEADING_CONFIGS.h6)
