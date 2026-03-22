/**
 * AccordionSectionHeader — collapsible section header.
 *
 * @module floating/components/AccordionSectionHeader
 */

import { memo, useCallback } from 'react'
import { PANEL } from '../tokens'

export const SECTION_HEADER_HEIGHT = 26

interface SectionHeaderProps {
  title: string
  isOpen: boolean
  onToggle: () => void
}

export const SectionHeader = memo(function SectionHeader({ title, isOpen, onToggle }: SectionHeaderProps) {
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }, [onToggle])

  return (
    <button
      type="button"
      onClick={handleClick}
      data-slot="accordion-section-header"
      data-state={isOpen ? 'open' : 'closed'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        height: SECTION_HEADER_HEIGHT,
        padding: '0 10px',
        background: PANEL.headerBg,
        border: 'none',
        borderBottom: `1px solid ${PANEL.border}`,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <svg
        width={10}
        height={10}
        viewBox="0 0 10 10"
        style={{
          color: PANEL.btnIdle,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'none',
          flexShrink: 0,
        }}
      >
        <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--tmnl-font-mono, ui-monospace, "SF Mono", monospace)',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: isOpen ? PANEL.textStrong : PANEL.text,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
    </button>
  )
})
