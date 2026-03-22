/**
 * Inspector Component
 *
 * Level 2: Metadata inspection panel with tabbed interface.
 *
 * @module file-browser/components/Inspector
 */

import { memo, useState, useEffect, useRef, type ReactNode } from 'react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import { BriefingTab } from './BriefingTab'
import { MetaTab, type FileMeta } from './MetaTab'
import { SpecTab, type FileRelation } from './SpecTab'
import type { FileEntry } from '../../schemas'
import type { FileMetadata } from '../../schemas/file-metadata'

// =============================================================================
// Types
// =============================================================================

export type InspectorTab = 'BRIEFING' | 'META' | 'SPEC'

export interface InspectorProps {
  /** Override the inspected file (otherwise uses focused file from context) */
  entry?: FileEntry
  /** Extended metadata */
  metadata?: FileMetadata
  /** User metadata (for META tab) */
  fileMeta?: FileMeta
  /** File flags (for SPEC tab) */
  flags?: string[]
  /** File relations (for SPEC tab) */
  relations?: FileRelation[]
  /** Is file locked/encrypted */
  isLocked?: boolean
  /** Called when file meta changes */
  onMetaChange?: (meta: FileMeta) => void
  /** Default active tab */
  defaultTab?: InspectorTab
  /** Override children (render custom content) */
  children?: ReactNode
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Tab Button Component
// =============================================================================

const TabButton = memo(function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: InspectorTab
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: `${DARK_SIDE.spacing['3']} 0`,
        fontSize: '10px',
        fontWeight: DARK_SIDE.typography.weight.bold,
        fontFamily: DARK_SIDE.typography.family.mono,
        letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
        background: isActive
          ? 'rgba(0, 255, 65, 0.1)'
          : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${
          isActive ? DARK_SIDE.colors.accent.green : 'transparent'
        }`,
        color: isActive
          ? DARK_SIDE.colors.accent.green
          : DARK_SIDE.colors.text.tertiary,
        cursor: 'pointer',
        transition: `all ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = DARK_SIDE.colors.text.secondary
          e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.color = DARK_SIDE.colors.text.tertiary
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {tab}
    </button>
  )
})

// =============================================================================
// Main Component
// =============================================================================

const InspectorRoot = memo(function Inspector({
  entry: entryOverride,
  metadata,
  fileMeta,
  flags = [],
  relations = [],
  isLocked = false,
  onMetaChange,
  defaultTab = 'BRIEFING',
  children,
  className = '',
}: InspectorProps) {
  const { entries, focusedFile } = useFileBrowserContext()
  const [activeTab, setActiveTab] = useState<InspectorTab>(defaultTab)
  const panelRef = useRef<HTMLDivElement>(null)

  // Get the entry to inspect (override or focused)
  const entry = entryOverride ?? entries.find((e) => e.id === focusedFile)

  // Reset scroll when file changes
  useEffect(() => {
    if (panelRef.current && entry) {
      panelRef.current.scrollTop = 0
    }
  }, [entry?.id])

  // No file selected
  if (!entry) {
    return (
      <aside
        className={`inspector ${className}`}
        style={{
          width: DARK_SIDE.dimensions.panelWidth.inspector,
          background: DARK_SIDE.colors.surface,
          borderLeft: `1px solid ${DARK_SIDE.colors.border.default}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: DARK_SIDE.colors.text.muted,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
        }}
      >
        SELECT_FILE_TO_INSPECT
      </aside>
    )
  }

  const tabs: InspectorTab[] = ['BRIEFING', 'META', 'SPEC']

  return (
    <aside
      className={`inspector ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: DARK_SIDE.dimensions.panelWidth.inspector,
        height: '100%',
        background: DARK_SIDE.colors.surface,
        borderLeft: `1px solid ${DARK_SIDE.colors.border.default}`,
      }}
      data-file-browser-inspector
    >
      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${DARK_SIDE.colors.border.default}`,
          background: DARK_SIDE.colors.surfaceAlt,
          flexShrink: 0,
        }}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab}
            tab={tab}
            isActive={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          />
        ))}
      </div>

      {/* Panel Content */}
      <div
        ref={panelRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {children ?? (
          <>
            {activeTab === 'BRIEFING' && (
              <BriefingTab
                entry={entry}
                metadata={metadata}
                isLocked={isLocked}
              />
            )}
            {activeTab === 'META' && (
              <MetaTab
                entry={entry}
                meta={fileMeta}
                onMetaChange={onMetaChange}
              />
            )}
            {activeTab === 'SPEC' && (
              <SpecTab
                entry={entry}
                metadata={metadata}
                flags={flags}
                relations={relations}
                isLocked={isLocked}
              />
            )}
          </>
        )}
      </div>

      {/* Scrollbar styles */}
      <style>{`
        .inspector::-webkit-scrollbar {
          width: 6px;
        }
        .inspector::-webkit-scrollbar-track {
          background: ${DARK_SIDE.colors.surfaceAlt};
        }
        .inspector::-webkit-scrollbar-thumb {
          background: ${DARK_SIDE.colors.border.default};
        }
        .inspector::-webkit-scrollbar-thumb:hover {
          background: ${DARK_SIDE.colors.accent.green};
          box-shadow: 0 0 5px ${DARK_SIDE.colors.accent.greenGlow};
        }
      `}</style>
    </aside>
  )
})

// =============================================================================
// Compound Export
// =============================================================================

export const Inspector = Object.assign(InspectorRoot, {
  Briefing: BriefingTab,
  Meta: MetaTab,
  Spec: SpecTab,
})
