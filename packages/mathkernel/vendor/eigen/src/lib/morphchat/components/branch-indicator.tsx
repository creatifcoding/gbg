/**
 * BranchIndicator — Visual fork marker on messages.
 *
 * Rendered inside message rows when the message corresponds to a
 * branch point in the v2 session tree. Shows a fork icon + branch count.
 * Clicking opens the branch navigator popover.
 *
 * @module morphchat/components/branch-indicator
 */

import { useState, useRef, useCallback } from 'react'
import { GitFork, ChevronRight } from 'lucide-react'
import type { BranchInfo, BranchOption } from '@/lib/harness/session/v2/useSessionBranch'

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'

// =============================================================================
// BranchIndicator
// =============================================================================

export interface BranchIndicatorProps {
  /** Branch info for this message */
  readonly branchInfo: BranchInfo
  /** Available branches from this fork point */
  readonly branches: ReadonlyArray<BranchOption>
  /** Called when user selects a branch */
  readonly onSelectBranch: (firstEntryId: string) => void
}

export function BranchIndicator({
  branchInfo,
  branches,
  onSelectBranch,
}: BranchIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen((prev) => !prev)
  }, [])

  const handleSelect = useCallback((firstEntryId: string) => {
    onSelectBranch(firstEntryId)
    setIsOpen(false)
  }, [onSelectBranch])

  // Find the active branch index for the "2/3" display
  const activeIndex = branches.findIndex((b) => b.isActive)
  const displayIndex = activeIndex >= 0 ? activeIndex + 1 : 1

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label={`${branchInfo.branchCount} branches from this message`}
        title={`${branchInfo.branchCount} branches — click to navigate`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid oklch(0.2 0.05 195)',
          background: isOpen
            ? 'oklch(0.12 0.03 195)'
            : 'oklch(0.08 0.02 195)',
          color: 'oklch(0.7 0.1 195)',
          cursor: 'pointer',
          fontFamily: MONO,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          lineHeight: 1,
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <GitFork size={12} />
        <span>{displayIndex}/{branchInfo.branchCount}</span>
      </button>

      {/* Popover */}
      {isOpen && branches.length > 0 && (
        <BranchPopover
          branches={branches}
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// =============================================================================
// BranchPopover — dropdown showing available branches
// =============================================================================

function BranchPopover({
  branches,
  onSelect,
  onClose,
}: {
  branches: ReadonlyArray<BranchOption>
  onSelect: (firstEntryId: string) => void
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
        }}
      />

      {/* Popover body */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          zIndex: 1000,
          minWidth: 240,
          maxWidth: 320,
          background: 'oklch(0.08 0 0)',
          border: '1px solid oklch(0.18 0 0)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid oklch(0.14 0 0)',
            fontFamily: MONO,
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: 'oklch(0.55 0 0)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Branches ({branches.length})
        </div>

        {/* Branch list */}
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {branches.map((branch, idx) => (
            <BranchRow
              key={branch.firstEntryId}
              branch={branch}
              index={idx}
              onSelect={() => onSelect(branch.firstEntryId)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

// =============================================================================
// BranchRow — single branch option
// =============================================================================

function BranchRow({
  branch,
  index,
  onSelect,
}: {
  branch: BranchOption
  index: number
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        border: 'none',
        borderBottom: '1px solid oklch(0.12 0 0)',
        background: hovered
          ? 'oklch(0.12 0.02 195)'
          : branch.isActive
            ? 'oklch(0.1 0.01 195)'
            : 'transparent',
        color: branch.isActive ? 'oklch(0.85 0.08 195)' : 'oklch(0.7 0 0)',
        cursor: 'pointer',
        fontFamily: MONO,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        textAlign: 'left',
        transition: 'background 0.1s ease',
      }}
    >
      {/* Branch indicator */}
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `1.5px solid ${branch.isActive ? 'oklch(0.6 0.12 195)' : 'oklch(0.25 0 0)'}`,
          background: branch.isActive ? 'oklch(0.15 0.05 195)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: branch.isActive ? 'oklch(0.7 0.1 195)' : 'oklch(0.4 0 0)',
        }}
      >
        {index + 1}
      </span>

      {/* Preview */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {branch.preview}
        </div>
        <div
          style={{
            color: 'oklch(0.45 0 0)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            marginTop: 2,
          }}
        >
          {branch.entryCount} message{branch.entryCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Active marker */}
      {branch.isActive && (
        <ChevronRight size={14} style={{ color: 'oklch(0.6 0.12 195)', flexShrink: 0 }} />
      )}
    </button>
  )
}

BranchIndicator.displayName = 'MorphChat.BranchIndicator'
