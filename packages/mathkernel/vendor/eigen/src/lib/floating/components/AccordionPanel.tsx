/**
 * AccordionPanel — sub-panel sections that expand/collapse inside a host panel
 *
 * A floating panel can contain multiple accordion sections stacked vertically.
 * Each section has a title bar that collapses/expands the content to full
 * container width. Multiple sections can be open simultaneously.
 *
 * Usage:
 *   <FloatingPanel id="tools" title="Tools">
 *     <AccordionPanel>
 *       <AccordionPanel.Section title="Search" defaultOpen>
 *         <SearchContent />
 *       </AccordionPanel.Section>
 *       <AccordionPanel.Section title="Replace">
 *         <ReplaceContent />
 *       </AccordionPanel.Section>
 *       <AccordionPanel.Section title="Files">
 *         <FileListContent />
 *       </AccordionPanel.Section>
 *     </AccordionPanel>
 *   </FloatingPanel>
 *
 * @module
 */

import {
  memo,
  useCallback,
  useState,
  createContext,
  useContext,
  type ReactNode,
  type MouseEvent,
} from 'react'
import { PANEL } from '../tokens'

// =============================================================================
// Accordion Context — tracks open sections
// =============================================================================

interface AccordionContextValue {
  openSections: Set<string>
  toggle: (id: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

function useAccordionContext(): AccordionContextValue {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error('AccordionPanel.Section must be used within <AccordionPanel>')
  return ctx
}

import { SectionHeader, SECTION_HEADER_HEIGHT } from './AccordionSectionHeader'

// =============================================================================
// Section — one accordion slice
// =============================================================================

export interface AccordionSectionProps {
  /** Unique section ID (auto-generated from title if omitted) */
  id?: string
  /** Section title shown in header */
  title: string
  /** Whether section starts expanded */
  defaultOpen?: boolean
  /** Content to show when expanded */
  children: ReactNode
}

const AccordionSection = memo(function AccordionSection({
  id,
  title,
  children,
}: AccordionSectionProps) {
  const sectionId = id ?? title
  const { openSections, toggle } = useAccordionContext()
  const isOpen = openSections.has(sectionId)

  return (
    <div data-slot="accordion-section" data-state={isOpen ? 'open' : 'closed'}>
      <SectionHeader title={title} isOpen={isOpen} onToggle={() => toggle(sectionId)} />
      {isOpen && (
        <div
          data-slot="accordion-section-content"
          style={{
            overflow: 'auto',
            borderBottom: `1px solid ${PANEL.border}`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// Root — wraps sections with accordion context
// =============================================================================

export interface AccordionPanelProps {
  /** Sections to render */
  children: ReactNode
  /** Default open section IDs */
  defaultOpen?: string[]
}

const AccordionPanelRoot = memo(function AccordionPanelRoot({
  children,
  defaultOpen,
}: AccordionPanelProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    // Collect defaultOpen from props + section defaultOpen props
    const initial = new Set<string>(defaultOpen ?? [])

    // Walk children to find sections with defaultOpen
    if (children && typeof children === 'object') {
      const arr = Array.isArray(children) ? children : [children]
      for (const child of arr) {
        if (
          child &&
          typeof child === 'object' &&
          'type' in child &&
          child.type === AccordionSection &&
          child.props?.defaultOpen
        ) {
          initial.add(child.props.id ?? child.props.title)
        }
      }
    }

    return initial
  })

  const toggle = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <AccordionContext.Provider value={{ openSections, toggle }}>
      <div
        data-slot="accordion-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
})

// =============================================================================
// Compound Namespace
// =============================================================================

export const AccordionPanel = Object.assign(AccordionPanelRoot, {
  Section: AccordionSection,
})

export default AccordionPanel
