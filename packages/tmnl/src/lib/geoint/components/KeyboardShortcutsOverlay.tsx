/**
 * KeyboardShortcutsOverlay - Which-Key Style Shortcut Display
 *
 * Displays available keyboard shortcuts in a contextual overlay:
 * - Shows available shortcuts based on current context
 * - Groups shortcuts by category
 * - Animates in after a brief delay
 * - Supports nested key sequences (Emacs-style)
 *
 * Inspired by which-key.nvim and Emacs which-key.
 *
 * Compound component architecture:
 * - KeyboardShortcutsOverlay.Root - Main overlay container
 * - KeyboardShortcutsOverlay.Header - Category header
 * - KeyboardShortcutsOverlay.Group - Shortcut group
 * - KeyboardShortcutsOverlay.Shortcut - Individual shortcut entry
 * - KeyboardShortcutsOverlay.Prefix - Current prefix display
 *
 * @module geoint/components/KeyboardShortcutsOverlay
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate, stagger } from 'animejs'
import {
  Keyboard,
  X,
  ChevronRight,
  Search,
  Layers,
  HelpCircle,
  Navigation,
  Filter,
  Eye,
  Crosshair,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface ShortcutBinding {
  /** Key sequence (e.g., "g", "Ctrl+f", "Meta+k") */
  keys: string
  /** Display label */
  label: string
  /** Description */
  description?: string
  /** Category */
  category?: string
  /** Action to execute */
  action?: () => void
  /** Sub-bindings (for prefix keys) */
  children?: readonly ShortcutBinding[]
  /** Icon */
  icon?: typeof Search
  /** Is this a prefix key */
  isPrefix?: boolean
}

export interface ShortcutCategory {
  /** Category ID */
  id: string
  /** Display name */
  name: string
  /** Icon */
  icon: typeof Search
  /** Bindings in this category */
  bindings: readonly ShortcutBinding[]
}

export interface KeyboardShortcutsContextValue {
  /** Whether overlay is visible */
  isVisible: boolean
  /** Current prefix (for nested shortcuts) */
  prefix: string | null
  /** Available shortcuts at current level */
  shortcuts: readonly ShortcutBinding[]
  /** Navigate to prefix */
  setPrefix: (prefix: string | null) => void
  /** Execute shortcut */
  executeShortcut: (binding: ShortcutBinding) => void
  /** Close overlay */
  close: () => void
  /** Search filter */
  searchFilter: string
  /** Set search filter */
  setSearchFilter: (filter: string) => void
  /** Compact mode */
  compact: boolean
}

export interface KeyboardShortcutsOverlayRootProps {
  /** Whether to show the overlay */
  isVisible: boolean
  /** Close handler */
  onClose: () => void
  /** Shortcut bindings */
  bindings: readonly ShortcutBinding[]
  /** Current prefix (for nested shortcuts) */
  currentPrefix?: string | null
  /** Compact mode */
  compact?: boolean
  /** Show search */
  showSearch?: boolean
  /** Delay before showing (ms) */
  showDelay?: number
  /** Children */
  children?: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

export const useKeyboardShortcuts = () => {
  const ctx = useContext(KeyboardShortcutsContext)
  if (!ctx) throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsOverlay.Root')
  return ctx
}

// =============================================================================
// DEFAULT GEOINT SHORTCUTS
// =============================================================================

export const GEOINT_SHORTCUTS: ShortcutBinding[] = [
  {
    keys: 'g',
    label: 'Go to...',
    isPrefix: true,
    icon: Navigation,
    children: [
      { keys: 'h', label: 'Home view', description: 'Reset map to default position' },
      { keys: 'e', label: 'Entity', description: 'Go to selected entity' },
      { keys: 'c', label: 'Coordinates', description: 'Go to coordinates' },
    ],
  },
  {
    keys: 's',
    label: 'Search...',
    isPrefix: true,
    icon: Search,
    children: [
      { keys: 's', label: 'Search entities', description: 'Open entity search' },
      { keys: 'a', label: 'Search area', description: 'Draw search area' },
      { keys: 'r', label: 'Search radius', description: 'Search by radius' },
    ],
  },
  {
    keys: 'l',
    label: 'Layers...',
    isPrefix: true,
    icon: Layers,
    children: [
      { keys: 't', label: 'Toggle tracks', description: 'Show/hide track layer' },
      { keys: 'o', label: 'Toggle OSM', description: 'Show/hide OSM layer' },
      { keys: 'a', label: 'Toggle all', description: 'Toggle all layers' },
      { keys: 'p', label: 'Layer palette', description: 'Open layer palette' },
    ],
  },
  {
    keys: 'f',
    label: 'Filter...',
    isPrefix: true,
    icon: Filter,
    children: [
      { keys: 'c', label: 'By classification', description: 'Filter by classification' },
      { keys: 's', label: 'By source', description: 'Filter by intel source' },
      { keys: 't', label: 'By time', description: 'Filter by time range' },
      { keys: 'x', label: 'Clear filters', description: 'Clear all filters' },
    ],
  },
  {
    keys: 'v',
    label: 'View...',
    isPrefix: true,
    icon: Eye,
    children: [
      { keys: 'z', label: 'Zoom in', description: 'Zoom map in' },
      { keys: 'Z', label: 'Zoom out', description: 'Zoom map out' },
      { keys: 'f', label: 'Fit bounds', description: 'Fit to entity bounds' },
      { keys: 'm', label: 'Toggle minimap', description: 'Show/hide minimap' },
    ],
  },
  {
    keys: 'e',
    label: 'Entity...',
    isPrefix: true,
    icon: Crosshair,
    children: [
      { keys: 'd', label: 'Details', description: 'Show entity details' },
      { keys: 't', label: 'Track', description: 'Track entity' },
      { keys: 'a', label: 'Set alert', description: 'Set entity alert' },
      { keys: 'r', label: 'Relations', description: 'Show entity relations' },
    ],
  },
  { keys: '/', label: 'Quick search', icon: Search, description: 'Focus search input' },
  { keys: '?', label: 'Help', icon: HelpCircle, description: 'Show this overlay' },
  { keys: 'Escape', label: 'Close', description: 'Close current panel' },
]

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<KeyboardShortcutsOverlayRootProps> = ({
  isVisible,
  onClose,
  bindings,
  currentPrefix = null,
  compact = false,
  showSearch = true,
  showDelay = 300,
  children,
  className,
}) => {
  const [shouldShow, setShouldShow] = useState(false)
  const [prefix, setPrefix] = useState<string | null>(currentPrefix)
  const [searchFilter, setSearchFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Delay before showing
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShouldShow(true), showDelay)
      return () => clearTimeout(timer)
    }

    setShouldShow(false)
    setPrefix(null)
    setSearchFilter('')
  }, [isVisible, showDelay])

  // Enter animation
  useEffect(() => {
    if (shouldShow && containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.fast,
        ease: EASING.anime.out,
      })

      // Animate shortcut items
      const items = containerRef.current.querySelectorAll('[data-shortcut-item]')
      animate(items, {
        opacity: [0, 1],
        translateY: [5, 0],
        delay: stagger(20, { start: 50 }),
        duration: TIMING.fast,
        ease: EASING.anime.out,
      })
    }
  }, [shouldShow])

  // Get shortcuts at current prefix level
  const shortcuts = prefix
    ? bindings.find(b => b.keys === prefix)?.children ?? []
    : bindings

  // Filter by search
  const filteredShortcuts = searchFilter
    ? shortcuts.filter(s =>
        s.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.keys.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : shortcuts

  const executeShortcut = useCallback((binding: ShortcutBinding) => {
    if (binding.isPrefix && binding.children) {
      setPrefix(binding.keys)
    } else if (binding.action) {
      binding.action()
      onClose()
    }
  }, [onClose])

  const close = useCallback(() => {
    if (prefix) {
      setPrefix(null)
    } else {
      onClose()
    }
  }, [prefix, onClose])

  // Handle keyboard navigation
  useEffect(() => {
    if (!shouldShow) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }

      // Find matching shortcut
      const key = e.key
      const shortcut = filteredShortcuts.find(s => {
        const shortcutKey = s.keys.toLowerCase()
        const pressedKey = key.toLowerCase()
        return shortcutKey === pressedKey ||
          (e.ctrlKey && shortcutKey === `ctrl+${pressedKey}`) ||
          (e.metaKey && shortcutKey === `meta+${pressedKey}`) ||
          (e.altKey && shortcutKey === `alt+${pressedKey}`)
      })

      if (shortcut) {
        e.preventDefault()
        executeShortcut(shortcut)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shouldShow, filteredShortcuts, executeShortcut, close])

  if (!shouldShow) return null

  const contextValue: KeyboardShortcutsContextValue = {
    isVisible: shouldShow,
    prefix,
    shortcuts: filteredShortcuts,
    setPrefix,
    executeShortcut,
    close,
    searchFilter,
    setSearchFilter,
    compact,
  }

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={close}
      />

      {/* Overlay */}
      <div
        ref={containerRef}
        className={cn(
          'fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-[480px] max-w-[90vw] max-h-[60vh]',
          'bg-surface-1 border border-border-subtle rounded-xl shadow-2xl overflow-hidden',
          className
        )}
      >
        {children ?? (
          <>
            <Header />
            {showSearch && <SearchInput />}
            <ShortcutList />
          </>
        )}
      </div>
    </KeyboardShortcutsContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({ className }) {
  const { prefix, close, compact } = useKeyboardShortcuts()

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 border-b border-border-subtle',
      className
    )}>
      <div className="flex items-center gap-2">
        <Keyboard className="w-5 h-5 text-accent-primary" />
        <span className={cn(
          'font-medium text-text-primary',
          compact ? 'text-sm' : 'text-base'
        )}>
          Keyboard Shortcuts
        </span>
        {prefix && (
          <span className="flex items-center gap-1 text-text-tertiary">
            <ChevronRight className="w-4 h-4" />
            <kbd className="px-1.5 py-0.5 bg-surface-3 rounded text-xs font-mono">{prefix}</kbd>
          </span>
        )}
      </div>
      <button
        onClick={close}
        className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
})

// =============================================================================
// SEARCH INPUT COMPONENT
// =============================================================================

export interface SearchInputProps {
  /** Additional class */
  className?: string
}

const SearchInput: FC<SearchInputProps> = memo(function SearchInput({ className }) {
  const { searchFilter, setSearchFilter } = useKeyboardShortcuts()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus search on open
    inputRef.current?.focus()
  }, [])

  return (
    <div className={cn('px-4 py-2 border-b border-border-subtle', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          ref={inputRef}
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Type to filter..."
          className={cn(
            'w-full pl-9 pr-3 py-2 bg-surface-2 border border-border-subtle rounded-lg',
            'text-sm text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20'
          )}
        />
      </div>
    </div>
  )
})

// =============================================================================
// SHORTCUT LIST COMPONENT
// =============================================================================

export interface ShortcutListProps {
  /** Additional class */
  className?: string
}

const ShortcutList: FC<ShortcutListProps> = memo(function ShortcutList({ className }) {
  const { shortcuts } = useKeyboardShortcuts()

  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category ?? 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, ShortcutBinding[]>)

  if (shortcuts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Keyboard className="w-8 h-8 text-text-tertiary/50 mb-2" />
        <p className="text-sm text-text-secondary">No shortcuts found</p>
      </div>
    )
  }

  // If no categories, render flat list
  if (Object.keys(grouped).length === 1) {
    return (
      <div className={cn('p-2 overflow-y-auto max-h-[50vh]', className)}>
        <div className="grid grid-cols-2 gap-1">
          {shortcuts.map(shortcut => (
            <ShortcutItem key={shortcut.keys} binding={shortcut} />
          ))}
        </div>
      </div>
    )
  }

  // Render grouped list
  return (
    <div className={cn('p-2 overflow-y-auto max-h-[50vh] space-y-3', className)}>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs text-text-tertiary uppercase font-mono px-2 mb-1">
            {category}
          </h3>
          <div className="grid grid-cols-2 gap-1">
            {items.map(shortcut => (
              <ShortcutItem key={shortcut.keys} binding={shortcut} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})

// =============================================================================
// SHORTCUT ITEM COMPONENT
// =============================================================================

export interface ShortcutItemProps {
  /** Shortcut binding */
  binding: ShortcutBinding
  /** Additional class */
  className?: string
}

const ShortcutItem: FC<ShortcutItemProps> = memo(function ShortcutItem({
  binding,
  className,
}) {
  const { executeShortcut, compact } = useKeyboardShortcuts()
  const Icon = binding.icon

  return (
    <button
      data-shortcut-item
      onClick={() => executeShortcut(binding)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
        'hover:bg-surface-2',
        className
      )}
    >
      {/* Key badge */}
      <kbd className={cn(
        'inline-flex items-center justify-center min-w-[24px] h-6 px-1.5',
        'bg-surface-3 border border-border-subtle rounded text-xs font-mono text-text-primary',
        'shadow-[0_1px_0_rgba(0,0,0,0.2)]'
      )}>
        {formatKey(binding.keys)}
      </kbd>

      {/* Icon */}
      {Icon && <Icon className="w-3.5 h-3.5 text-text-tertiary" />}

      {/* Label */}
      <span className={cn(
        'flex-1 text-text-secondary truncate',
        compact ? 'text-xs' : 'text-sm'
      )}>
        {binding.label}
      </span>

      {/* Prefix indicator */}
      {binding.isPrefix && (
        <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
      )}
    </button>
  )
})

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format key for display
 */
const formatKey = (key: string): string => {
  return key
    .replace('Ctrl+', '⌃')
    .replace('Meta+', '⌘')
    .replace('Alt+', '⌥')
    .replace('Shift+', '⇧')
    .replace('Escape', 'Esc')
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const KeyboardShortcutsOverlay = Object.assign(Root, {
  Root,
  Header,
  SearchInput,
  ShortcutList,
  ShortcutItem,
  GEOINT_SHORTCUTS,
})

// Named exports
export {
  Root as KeyboardShortcutsOverlayRoot,
  Header as KeyboardShortcutsOverlayHeader,
  SearchInput as KeyboardShortcutsOverlaySearchInput,
  ShortcutList as KeyboardShortcutsOverlayShortcutList,
  ShortcutItem as KeyboardShortcutsOverlayShortcutItem,
}

export default KeyboardShortcutsOverlay
