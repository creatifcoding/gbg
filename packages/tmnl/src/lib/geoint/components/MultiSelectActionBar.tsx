/**
 * MultiSelectActionBar - Batch Operations for Selected Entities
 *
 * A floating action bar that appears when multiple entities are selected,
 * providing batch operations like:
 * - Track all selected
 * - Export selection
 * - Compare entities
 * - Create collection
 * - Clear selection
 *
 * Compound component architecture:
 * - MultiSelectActionBar.Root - Container with selection count
 * - MultiSelectActionBar.Actions - Action button group
 * - MultiSelectActionBar.Action - Individual action button
 * - MultiSelectActionBar.Divider - Visual separator
 * - MultiSelectActionBar.Badge - Selection count badge
 *
 * @module geoint/components/MultiSelectActionBar
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  X,
  Crosshair,
  Download,
  GitCompare,
  FolderPlus,
  Trash2,
  Bell,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface MultiSelectContextValue {
  /** Selected entity IDs */
  selectedIds: readonly string[]
  /** Total entity count available */
  totalCount?: number
  /** Clear all selections */
  onClearSelection: () => void
  /** Select all entities */
  onSelectAll?: () => void
  /** Compact mode */
  compact: boolean
}

export interface MultiSelectActionBarRootProps {
  /** Selected entity IDs */
  selectedIds: readonly string[]
  /** Total available entities */
  totalCount?: number
  /** Clear selection handler */
  onClearSelection: () => void
  /** Select all handler */
  onSelectAll?: () => void
  /** Compact mode */
  compact?: boolean
  /** Position variant */
  position?: 'bottom' | 'top' | 'floating'
  /** Children (action buttons) */
  children: ReactNode
  /** Additional class */
  className?: string
}

export interface ActionProps {
  /** Action identifier */
  id: string
  /** Display label */
  label: string
  /** Icon component */
  icon: typeof Crosshair
  /** Click handler */
  onClick: () => void
  /** Button variant */
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  /** Disabled state */
  disabled?: boolean
  /** Show loading spinner */
  loading?: boolean
  /** Tooltip text (defaults to label) */
  tooltip?: string
  /** Additional class */
  className?: string
}

export interface ActionsProps {
  /** Children (Action components) */
  children: ReactNode
  /** Additional class */
  className?: string
}

export interface DividerProps {
  /** Additional class */
  className?: string
}

export interface BadgeProps {
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const MultiSelectContext = createContext<MultiSelectContextValue | null>(null)

export const useMultiSelect = () => {
  const ctx = useContext(MultiSelectContext)
  if (!ctx) throw new Error('useMultiSelect must be used within MultiSelectActionBar.Root')
  return ctx
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<MultiSelectActionBarRootProps> = ({
  selectedIds,
  totalCount,
  onClearSelection,
  onSelectAll,
  compact = false,
  position = 'bottom',
  children,
  className,
}) => {
  const barRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  // Animate on mount and selection changes
  useEffect(() => {
    if (barRef.current && selectedIds.length > 0) {
      const isNewSelection = prevCountRef.current === 0

      if (isNewSelection) {
        // Slide in animation
        animate(barRef.current, {
          translateY: position === 'bottom' ? [20, 0] : position === 'top' ? [-20, 0] : [0, 0],
          opacity: [0, 1],
          scale: [0.95, 1],
          duration: TIMING.normal,
          easing: EASING.anime.bounce,
        })
      } else {
        // Pulse animation on count change
        animate(barRef.current, {
          scale: [1, 1.02, 1],
          duration: TIMING.fast,
          easing: EASING.anime.out,
        })
      }
    }
    prevCountRef.current = selectedIds.length
  }, [selectedIds.length, position])

  // Don't render if no selection
  if (selectedIds.length === 0) return null

  const contextValue: MultiSelectContextValue = {
    selectedIds,
    totalCount,
    onClearSelection,
    onSelectAll,
    compact,
  }

  const positionClasses = {
    bottom: 'fixed bottom-4 left-1/2 -translate-x-1/2',
    top: 'fixed top-4 left-1/2 -translate-x-1/2',
    floating: 'absolute bottom-4 left-1/2 -translate-x-1/2',
  }

  return (
    <MultiSelectContext.Provider value={contextValue}>
      <div
        ref={barRef}
        className={cn(
          'z-50 flex items-center gap-2 px-3 py-2',
          'bg-surface-1/95 backdrop-blur-md border border-border-subtle rounded-lg shadow-xl',
          positionClasses[position],
          className
        )}
        role="toolbar"
        aria-label="Selection actions"
      >
        {children}
      </div>
    </MultiSelectContext.Provider>
  )
}

// =============================================================================
// BADGE COMPONENT
// =============================================================================

const Badge: FC<BadgeProps> = memo(function Badge({ className }) {
  const { selectedIds, totalCount, compact } = useMultiSelect()
  const badgeRef = useRef<HTMLDivElement>(null)

  // Animate count changes
  useEffect(() => {
    if (badgeRef.current) {
      animate(badgeRef.current, {
        scale: [0.8, 1.1, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
      })
    }
  }, [selectedIds.length])

  return (
    <div
      ref={badgeRef}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/20 rounded-md',
        className
      )}
    >
      <CheckSquare className="w-4 h-4 text-accent-primary" />
      <span className="font-mono text-sm font-medium text-accent-primary tabular-nums">
        {selectedIds.length}
        {totalCount != null && !compact && (
          <span className="text-text-tertiary">/{totalCount}</span>
        )}
      </span>
      {!compact && (
        <span className="text-xs text-text-secondary">selected</span>
      )}
    </div>
  )
})

// =============================================================================
// ACTIONS COMPONENT
// =============================================================================

const Actions: FC<ActionsProps> = ({ children, className }) => {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="group"
      aria-label="Batch actions"
    >
      {children}
    </div>
  )
}

// =============================================================================
// ACTION COMPONENT
// =============================================================================

const Action: FC<ActionProps> = memo(function Action({
  id: _id,
  label,
  icon: Icon,
  onClick,
  variant = 'default',
  disabled = false,
  loading = false,
  tooltip,
  className,
}) {
  const { compact } = useMultiSelect()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const variantStyles = {
    default: 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
    primary: 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    ghost: 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2',
  }

  const handleClick = () => {
    if (disabled || loading) return

    // Click feedback animation
    if (buttonRef.current) {
      animate(buttonRef.current, {
        scale: [1, 0.95, 1],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }

    onClick()
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
        variantStyles[variant],
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={tooltip ?? label}
      aria-label={label}
    >
      {loading ? (
        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {!compact && <span>{label}</span>}
    </button>
  )
})

// =============================================================================
// DIVIDER COMPONENT
// =============================================================================

const Divider: FC<DividerProps> = ({ className }) => {
  return (
    <div
      className={cn('w-px h-6 bg-border-subtle', className)}
      role="separator"
      aria-orientation="vertical"
    />
  )
}

// =============================================================================
// CLEAR BUTTON COMPONENT
// =============================================================================

interface ClearButtonProps {
  /** Additional class */
  className?: string
}

const ClearButton: FC<ClearButtonProps> = memo(function ClearButton({ className }) {
  const { onClearSelection, compact } = useMultiSelect()

  return (
    <button
      onClick={onClearSelection}
      className={cn(
        'flex items-center gap-1 p-1.5 rounded-md text-text-tertiary',
        'hover:text-text-secondary hover:bg-surface-2 transition-colors',
        className
      )}
      title="Clear selection"
      aria-label="Clear selection"
    >
      <X className="w-4 h-4" />
      {!compact && <span className="text-xs">Clear</span>}
    </button>
  )
})

// =============================================================================
// SELECT ALL BUTTON COMPONENT
// =============================================================================

interface SelectAllButtonProps {
  /** Additional class */
  className?: string
}

const SelectAllButton: FC<SelectAllButtonProps> = memo(function SelectAllButton({ className }) {
  const { onSelectAll, selectedIds, totalCount, compact } = useMultiSelect()

  if (!onSelectAll) return null

  const isAllSelected = totalCount != null && selectedIds.length === totalCount

  return (
    <button
      onClick={onSelectAll}
      disabled={isAllSelected}
      className={cn(
        'flex items-center gap-1 p-1.5 rounded-md text-text-tertiary',
        'hover:text-text-secondary hover:bg-surface-2 transition-colors',
        isAllSelected && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isAllSelected ? 'All selected' : 'Select all'}
      aria-label="Select all"
    >
      {isAllSelected ? (
        <CheckSquare className="w-4 h-4" />
      ) : (
        <Square className="w-4 h-4" />
      )}
      {!compact && <span className="text-xs">All</span>}
    </button>
  )
})

// =============================================================================
// MORE ACTIONS COMPONENT (overflow menu)
// =============================================================================

interface MoreActionsProps {
  /** Actions to show in overflow */
  actions: readonly ActionProps[]
  /** Additional class */
  className?: string
}

const MoreActions: FC<MoreActionsProps> = ({ actions: _actions, className }) => {
  // TODO: Implement dropdown menu with remaining actions
  // For now, just show the button
  return (
    <button
      className={cn(
        'p-1.5 rounded-md text-text-tertiary',
        'hover:text-text-secondary hover:bg-surface-2 transition-colors',
        className
      )}
      title="More actions"
      aria-label="More actions"
    >
      <MoreHorizontal className="w-4 h-4" />
    </button>
  )
}

// =============================================================================
// DEFAULT ACTION PRESETS
// =============================================================================

export interface DefaultActionsConfig {
  onTrackAll?: () => void
  onExport?: () => void
  onCompare?: () => void
  onCreateCollection?: () => void
  onDelete?: () => void
  onSetAlert?: () => void
  onShowOnMap?: () => void
  onHideFromMap?: () => void
}

/**
 * Pre-configured default actions based on common GEOINT operations
 */
export const createDefaultActions = (config: DefaultActionsConfig): ActionProps[] => {
  const actions: ActionProps[] = []

  if (config.onTrackAll) {
    actions.push({
      id: 'track-all',
      label: 'Track All',
      icon: Crosshair,
      onClick: config.onTrackAll,
      variant: 'primary',
    })
  }

  if (config.onShowOnMap) {
    actions.push({
      id: 'show-on-map',
      label: 'Show on Map',
      icon: Eye,
      onClick: config.onShowOnMap,
    })
  }

  if (config.onHideFromMap) {
    actions.push({
      id: 'hide-from-map',
      label: 'Hide from Map',
      icon: EyeOff,
      onClick: config.onHideFromMap,
    })
  }

  if (config.onCompare) {
    actions.push({
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      onClick: config.onCompare,
    })
  }

  if (config.onCreateCollection) {
    actions.push({
      id: 'create-collection',
      label: 'Add to Collection',
      icon: FolderPlus,
      onClick: config.onCreateCollection,
    })
  }

  if (config.onSetAlert) {
    actions.push({
      id: 'set-alert',
      label: 'Set Alert',
      icon: Bell,
      onClick: config.onSetAlert,
    })
  }

  if (config.onExport) {
    actions.push({
      id: 'export',
      label: 'Export',
      icon: Download,
      onClick: config.onExport,
    })
  }

  if (config.onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: config.onDelete,
      variant: 'danger',
    })
  }

  return actions
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const MultiSelectActionBar = Object.assign(Root, {
  Root,
  Badge,
  Actions,
  Action,
  Divider,
  ClearButton,
  SelectAllButton,
  MoreActions,
})

// Named exports
export {
  Root as MultiSelectActionBarRoot,
  Badge as MultiSelectActionBarBadge,
  Actions as MultiSelectActionBarActions,
  Action as MultiSelectActionBarAction,
  Divider as MultiSelectActionBarDivider,
  ClearButton as MultiSelectActionBarClearButton,
  SelectAllButton as MultiSelectActionBarSelectAllButton,
  MoreActions as MultiSelectActionBarMoreActions,
}

export default MultiSelectActionBar
