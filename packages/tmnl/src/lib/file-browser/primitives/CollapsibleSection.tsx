/**
 * CollapsibleSection Primitive
 *
 * Expandable/collapsible section with icon and title.
 *
 * @module file-browser/primitives
 */

import { memo, useState, type ReactNode, type ComponentType } from 'react'
import { ChevronDown, ChevronRight, type LucideProps } from 'lucide-react'

import { DARK_SIDE } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export interface CollapsibleSectionProps {
  /** Section title */
  title: string
  /** Icon component */
  icon?: ComponentType<LucideProps>
  /** Default open state */
  defaultOpen?: boolean
  /** Children content */
  children: ReactNode
  /** Title color (for status highlighting) */
  color?: string
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const CollapsibleSection = memo(function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
  color = DARK_SIDE.colors.text.secondary,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      className={`collapsible-section ${className}`}
      style={{
        borderBottom: `1px solid ${DARK_SIDE.colors.border.subtle}`,
      }}
    >
      {/* Header button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: DARK_SIDE.spacing['2'],
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color,
          fontSize: DARK_SIDE.typography.size.xs,
          textTransform: 'uppercase',
          letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
          fontWeight: DARK_SIDE.typography.weight.bold,
          fontFamily: DARK_SIDE.typography.family.mono,
          transition: `background ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: DARK_SIDE.spacing['2'] }}>
          {Icon && <Icon size={12} />}
          {title}
        </div>
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Content */}
      {isOpen && (
        <div
          style={{
            padding: DARK_SIDE.spacing['3'],
            background: DARK_SIDE.colors.surfaceAlt,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
})
