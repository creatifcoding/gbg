/**
 * ADRReviewSection
 *
 * Collapsible section containing related units.
 */
import React, { createContext, useContext } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAtomValue } from 'effect-atom'
import { cn } from '@/lib/utils'
import { reviewRegistry, expandedSectionsAtom } from '../atoms'
import { toggleSection } from '../atoms/operations'

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface SectionContextValue {
  name: string
  isExpanded: boolean
  toggle: () => void
}

const SectionContext = createContext<SectionContextValue | null>(null)

export function useSectionContext() {
  const ctx = useContext(SectionContext)
  if (!ctx) throw new Error('useSectionContext must be used within ADRReviewSection')
  return ctx
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewSectionProps {
  /**
   * Section name (context, decision, rationale, implementation).
   */
  name: string

  /**
   * Section title for display.
   */
  title?: string

  /**
   * Unit count for display (e.g., "3/5").
   */
  unitCount?: { accepted: number; total: number }

  /**
   * Children to render.
   */
  children: React.ReactNode

  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Section Icon
// -----------------------------------------------------------------------------

function getSectionIcon(name: string): string {
  const icons: Record<string, string> = {
    context: '📋',
    decision: '⚡',
    rationale: '🤔',
    implementation: '🔧',
  }
  return icons[name.toLowerCase()] || '📄'
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewSection({
  name,
  title,
  unitCount,
  children,
  className,
}: ADRReviewSectionProps) {
  const expandedSections = useAtomValue(expandedSectionsAtom)
  const isExpanded = expandedSections.has(name.toLowerCase())

  const toggle = () => toggleSection(name.toLowerCase())

  const displayTitle = title || name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <SectionContext.Provider value={{ name, isExpanded, toggle }}>
      <div className={cn('border border-neutral-700 rounded-lg overflow-hidden', className)}>
        {/* Section Header */}
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-center justify-between p-4 bg-neutral-800 hover:bg-neutral-750 transition-colors"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            )}
            <span className="text-lg">{getSectionIcon(name)}</span>
            <span className="font-semibold text-neutral-200 uppercase tracking-wide text-sm">
              {displayTitle}
            </span>
          </div>

          {unitCount && (
            <span className="text-sm text-neutral-400">
              <span className="text-emerald-400">{unitCount.accepted}</span>
              <span className="mx-1">/</span>
              <span>{unitCount.total}</span>
            </span>
          )}
        </button>

        {/* Section Content */}
        {isExpanded && <div className="p-4 space-y-4 bg-neutral-900/50">{children}</div>}
      </div>
    </SectionContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

export function ADRReviewSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h3 className={cn('font-semibold text-neutral-200', className)}>{children}</h3>
}

export function ADRReviewSectionContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}
