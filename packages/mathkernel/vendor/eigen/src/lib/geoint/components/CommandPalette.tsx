/**
 * CommandPalette - Global Command Search
 *
 * M-x style command palette for GEOINT dashboard:
 * - Fuzzy search across all registered commands
 * - Keyboard navigation (arrows, enter, escape)
 * - Recent commands tracking
 * - Category grouping
 * - XState machine for state management
 * - anime.js animations
 *
 * @module geoint/components/CommandPalette
 */

import {
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { useMachine } from '@xstate/react'
import { setup, assign, type ActorRefFrom } from 'xstate'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { RegistryContext } from '@effect-atom/atom-react'
import { animate, stagger } from 'animejs'
import {
  Search,
  Command,
  Layers,
  MapPin,
  Settings,
  Clock,
  Keyboard,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export type CommandCategory =
  | 'navigation'
  | 'search'
  | 'layers'
  | 'entity'
  | 'view'
  | 'export'
  | 'settings'
  | 'recent'

export interface CommandItem {
  id: string
  label: string
  description?: string
  category: CommandCategory
  icon?: LucideIcon
  shortcut?: string
  action: () => void | Promise<void>
  keywords?: string[]
  disabled?: boolean
}

export interface CommandGroup {
  category: CommandCategory
  label: string
  icon: LucideIcon
  commands: CommandItem[]
}

// =============================================================================
// XSTATE MACHINE
// =============================================================================

interface CommandPaletteContext {
  query: string
  selectedIndex: number
  filteredCommands: CommandItem[]
  recentCommandIds: string[]
}

type CommandPaletteEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SELECT_NEXT' }
  | { type: 'SELECT_PREV' }
  | { type: 'EXECUTE' }
  | { type: 'EXECUTE_AT'; index: number }
  | { type: 'RESET' }

const commandPaletteMachine = setup({
  types: {
    context: {} as CommandPaletteContext,
    events: {} as CommandPaletteEvent,
  },
  actions: {
    resetQuery: assign({ query: '', selectedIndex: 0 }),
    setQuery: assign({
      query: (_, params: { query: string }) => params.query,
      selectedIndex: 0,
    }),
    selectNext: assign({
      selectedIndex: ({ context }) =>
        Math.min(context.selectedIndex + 1, context.filteredCommands.length - 1),
    }),
    selectPrev: assign({
      selectedIndex: ({ context }) => Math.max(context.selectedIndex - 1, 0),
    }),
    selectAt: assign({
      selectedIndex: (_, params: { index: number }) => params.index,
    }),
    addToRecent: assign({
      recentCommandIds: ({ context }) => {
        const currentId = context.filteredCommands[context.selectedIndex]?.id
        if (!currentId) return context.recentCommandIds
        const filtered = context.recentCommandIds.filter((id) => id !== currentId)
        return [currentId, ...filtered].slice(0, 5)
      },
    }),
  },
}).createMachine({
  id: 'commandPalette',
  initial: 'closed',
  context: {
    query: '',
    selectedIndex: 0,
    filteredCommands: [],
    recentCommandIds: [],
  },
  states: {
    closed: {
      on: {
        OPEN: {
          target: 'open',
          actions: ['resetQuery'],
        },
      },
    },
    open: {
      on: {
        CLOSE: 'closed',
        SET_QUERY: {
          actions: [
            {
              type: 'setQuery',
              params: ({ event }) => ({ query: event.query }),
            },
          ],
        },
        SELECT_NEXT: { actions: ['selectNext'] },
        SELECT_PREV: { actions: ['selectPrev'] },
        EXECUTE: {
          target: 'closed',
          actions: ['addToRecent'],
        },
        EXECUTE_AT: {
          target: 'closed',
          actions: [
            {
              type: 'selectAt',
              params: ({ event }) => ({ index: event.index }),
            },
            'addToRecent',
          ],
        },
        RESET: { actions: ['resetQuery'] },
      },
    },
  },
})

export type CommandPaletteMachine = typeof commandPaletteMachine
export type CommandPaletteActor = ActorRefFrom<CommandPaletteMachine>

// =============================================================================
// ATOMS
// =============================================================================

/** Registered commands */
export const registeredCommandsAtom = Atom.make<CommandItem[]>([])

/** Command palette open state */
export const paletteOpenAtom = Atom.make(false)

/** Current query */
export const paletteQueryAtom = Atom.make('')

/** Recent command IDs */
export const recentCommandIdsAtom = Atom.make<string[]>([])

// =============================================================================
// REGISTRY
// =============================================================================

export const commandPaletteRegistry = Registry.make()

// =============================================================================
// FUZZY SEARCH
// =============================================================================

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Simple fuzzy: all query chars must appear in order
  let textIndex = 0
  for (const char of lowerQuery) {
    const found = lowerText.indexOf(char, textIndex)
    if (found === -1) return false
    textIndex = found + 1
  }
  return true
}

function searchCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return commands

  return commands.filter((cmd) => {
    // Match against label, description, and keywords
    if (fuzzyMatch(cmd.label, query)) return true
    if (cmd.description && fuzzyMatch(cmd.description, query)) return true
    if (cmd.keywords?.some((kw) => fuzzyMatch(kw, query))) return true
    return false
  })
}

// =============================================================================
// CONTEXT
// =============================================================================

export interface CommandPaletteContextValue {
  isOpen: boolean
  query: string
  selectedIndex: number
  filteredCommands: CommandItem[]
  recentCommands: CommandItem[]

  open: () => void
  close: () => void
  setQuery: (query: string) => void
  selectNext: () => void
  selectPrev: () => void
  execute: () => void
  executeAt: (index: number) => void

  registerCommand: (command: CommandItem) => void
  unregisterCommand: (id: string) => void
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export const useCommandPalette = () => {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return ctx
}

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

const CATEGORY_CONFIG: Record<CommandCategory, { label: string; icon: LucideIcon }> = {
  navigation: { label: 'Navigation', icon: MapPin },
  search: { label: 'Search', icon: Search },
  layers: { label: 'Layers', icon: Layers },
  entity: { label: 'Entity', icon: Command },
  view: { label: 'View', icon: Command },
  export: { label: 'Export', icon: Command },
  settings: { label: 'Settings', icon: Settings },
  recent: { label: 'Recent', icon: Clock },
}

// =============================================================================
// PROVIDER
// =============================================================================

export interface CommandPaletteProviderProps {
  children: ReactNode
  initialCommands?: CommandItem[]
}

export const CommandPaletteProvider: FC<CommandPaletteProviderProps> = ({
  children,
  initialCommands = [],
}) => {
  const [state, send] = useMachine(commandPaletteMachine)
  const [commands, setCommands] = useState<CommandItem[]>(initialCommands)

  // Compute filtered commands
  const filteredCommands = useMemo(
    () => searchCommands(commands, state.context.query),
    [commands, state.context.query]
  )

  // Get recent commands
  const recentCommands = useMemo(
    () =>
      state.context.recentCommandIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is CommandItem => !!c),
    [commands, state.context.recentCommandIds]
  )

  // Sync to atoms
  useEffect(() => {
    commandPaletteRegistry.set(paletteOpenAtom, state.matches('open'))
    commandPaletteRegistry.set(paletteQueryAtom, state.context.query)
    commandPaletteRegistry.set(recentCommandIdsAtom, state.context.recentCommandIds)
  }, [state])

  // Actions
  const open = useCallback(() => send({ type: 'OPEN' }), [send])
  const close = useCallback(() => send({ type: 'CLOSE' }), [send])
  const setQuery = useCallback((query: string) => send({ type: 'SET_QUERY', query }), [send])
  const selectNext = useCallback(() => send({ type: 'SELECT_NEXT' }), [send])
  const selectPrev = useCallback(() => send({ type: 'SELECT_PREV' }), [send])

  const execute = useCallback(() => {
    const cmd = filteredCommands[state.context.selectedIndex]
    if (cmd && !cmd.disabled) {
      cmd.action()
      send({ type: 'EXECUTE' })
    }
  }, [filteredCommands, state.context.selectedIndex, send])

  const executeAt = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index]
      if (cmd && !cmd.disabled) {
        cmd.action()
        send({ type: 'EXECUTE_AT', index })
      }
    },
    [filteredCommands, send]
  )

  const registerCommand = useCallback((command: CommandItem) => {
    setCommands((prev) => {
      const exists = prev.some((c) => c.id === command.id)
      if (exists) return prev.map((c) => (c.id === command.id ? command : c))
      return [...prev, command]
    })
  }, [])

  const unregisterCommand = useCallback((id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (state.matches('open')) {
          close()
        } else {
          open()
        }
      }
      // Escape to close
      if (e.key === 'Escape' && state.matches('open')) {
        e.preventDefault()
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state, open, close])

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      isOpen: state.matches('open'),
      query: state.context.query,
      selectedIndex: state.context.selectedIndex,
      filteredCommands,
      recentCommands,
      open,
      close,
      setQuery,
      selectNext,
      selectPrev,
      execute,
      executeAt,
      registerCommand,
      unregisterCommand,
    }),
    [
      state,
      filteredCommands,
      recentCommands,
      open,
      close,
      setQuery,
      selectNext,
      selectPrev,
      execute,
      executeAt,
      registerCommand,
      unregisterCommand,
    ]
  )

  return (
    <RegistryContext.Provider value={commandPaletteRegistry as any}>
      <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
    </RegistryContext.Provider>
  )
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface CommandPaletteRootProps {
  className?: string
}

const CommandPaletteRoot: FC<CommandPaletteRootProps> = ({ className }) => {
  const { isOpen, close } = useCommandPalette()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Animate on open/close
  useEffect(() => {
    if (isOpen && overlayRef.current && dialogRef.current) {
      // Overlay fade in
      animate(overlayRef.current, {
        opacity: [0, 1],
        duration: TIMING.fast,
        easing: EASING.out,
      })
      // Dialog slide + scale in
      animate(dialogRef.current, {
        translateY: [-20, 0],
        scale: [0.95, 1],
        opacity: [0, 1],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center pt-[15vh]',
        'bg-black/50 backdrop-blur-sm',
        className
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        className={cn(
          'w-full max-w-xl',
          'bg-surface-1 border border-border-subtle rounded-xl',
          'shadow-xl overflow-hidden'
        )}
      >
        <CommandPaletteInput />
        <CommandPaletteList />
        <CommandPaletteFooter />
      </div>
    </div>
  )
}

// =============================================================================
// INPUT
// =============================================================================

export interface CommandPaletteInputProps {
  placeholder?: string
  className?: string
}

const CommandPaletteInput: FC<CommandPaletteInputProps> = ({
  placeholder = 'Search commands...',
  className,
}) => {
  const { query, setQuery, selectNext, selectPrev, execute, close } = useCommandPalette()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectNext()
        break
      case 'ArrowUp':
        e.preventDefault()
        selectPrev()
        break
      case 'Enter':
        e.preventDefault()
        execute()
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border-subtle',
        className
      )}
    >
      <Search className="h-5 w-5 text-text-tertiary flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent text-text-primary placeholder:text-text-quaternary',
          'text-base outline-none'
        )}
      />
      <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary bg-surface-2 rounded">
        esc
      </kbd>
    </div>
  )
}

// =============================================================================
// LIST
// =============================================================================

export interface CommandPaletteListProps {
  maxHeight?: number
  className?: string
}

const CommandPaletteList: FC<CommandPaletteListProps> = ({
  maxHeight = 400,
  className,
}) => {
  const { filteredCommands, recentCommands, selectedIndex, executeAt, query } =
    useCommandPalette()
  const listRef = useRef<HTMLDivElement>(null)

  // Group commands by category
  const groups = useMemo(() => {
    const groupMap = new Map<CommandCategory, CommandItem[]>()

    // Add recent commands first if no query
    if (!query && recentCommands.length > 0) {
      groupMap.set('recent', recentCommands)
    }

    // Group filtered commands
    for (const cmd of filteredCommands) {
      if (query || !recentCommands.some((r) => r.id === cmd.id)) {
        const group = groupMap.get(cmd.category) ?? []
        group.push(cmd)
        groupMap.set(cmd.category, group)
      }
    }

    return Array.from(groupMap.entries()).map(([category, commands]) => ({
      ...CATEGORY_CONFIG[category],
      category,
      commands,
    }))
  }, [filteredCommands, recentCommands, query])

  // Animate items on filter change
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-command-item]')
      if (items.length > 0) {
        animate(items, {
          opacity: [0, 1],
          translateX: [-10, 0],
          duration: TIMING.fast,
          easing: EASING.out,
          delay: stagger(30),
        })
      }
    }
  }, [groups])

  // Scroll selected into view
  useEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Calculate flat index for keyboard navigation
  let flatIndex = 0

  if (groups.length === 0) {
    return (
      <div className={cn('py-12 text-center text-text-tertiary', className)}>
        No commands found
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className={cn('overflow-auto', className)}
      style={{ maxHeight }}
    >
      {groups.map((group) => (
        <div key={group.category} className="py-2">
          {/* Group Header */}
          <div className="px-4 py-1 flex items-center gap-2 text-xs font-medium text-text-tertiary">
            <group.icon className="h-3.5 w-3.5" />
            <span>{group.label}</span>
          </div>

          {/* Commands */}
          {group.commands.map((cmd) => {
            const index = flatIndex++
            const isSelected = index === selectedIndex

            return (
              <CommandPaletteItem
                key={cmd.id}
                command={cmd}
                isSelected={isSelected}
                onClick={() => executeAt(index)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// ITEM
// =============================================================================

interface CommandPaletteItemProps {
  command: CommandItem
  isSelected: boolean
  onClick: () => void
}

const CommandPaletteItem: FC<CommandPaletteItemProps> = memo(function CommandPaletteItem({
  command,
  isSelected,
  onClick,
}) {
  const Icon = command.icon ?? Command
  const itemRef = useRef<HTMLDivElement>(null)

  // Highlight animation on selection
  useEffect(() => {
    if (isSelected && itemRef.current) {
      animate(itemRef.current, {
        backgroundColor: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.05)'],
        duration: TIMING.fast,
        easing: EASING.out,
      })
    }
  }, [isSelected])

  return (
    <div
      ref={itemRef}
      data-command-item
      data-selected={isSelected}
      onClick={onClick}
      className={cn(
        'mx-2 px-3 py-2 rounded-lg cursor-pointer',
        'flex items-center gap-3 transition-colors',
        isSelected
          ? 'bg-accent-primary/10 text-text-primary'
          : 'text-text-secondary hover:bg-surface-2',
        command.disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          isSelected ? 'text-accent-primary' : 'text-text-tertiary'
        )}
      />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-text-tertiary truncate">{command.description}</div>
        )}
      </div>

      {command.shortcut && (
        <kbd
          className={cn(
            'px-1.5 py-0.5 text-xs rounded',
            isSelected ? 'bg-accent-primary/20 text-accent-primary' : 'bg-surface-2 text-text-tertiary'
          )}
        >
          {command.shortcut}
        </kbd>
      )}

      <ChevronRight
        className={cn(
          'h-4 w-4 flex-shrink-0 opacity-0 transition-opacity',
          isSelected && 'opacity-100 text-accent-primary'
        )}
      />
    </div>
  )
})

// =============================================================================
// FOOTER
// =============================================================================

export interface CommandPaletteFooterProps {
  className?: string
}

const CommandPaletteFooter: FC<CommandPaletteFooterProps> = ({ className }) => {
  const { filteredCommands } = useCommandPalette()

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2',
        'border-t border-border-subtle bg-surface-0',
        className
      )}
    >
      <div className="flex items-center gap-4 text-xs text-text-quaternary">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface-2 rounded">↑↓</kbd>
          <span>navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface-2 rounded">↵</kbd>
          <span>execute</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface-2 rounded">esc</kbd>
          <span>close</span>
        </span>
      </div>
      <div className="text-xs text-text-quaternary">
        {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

// =============================================================================
// TRIGGER BUTTON
// =============================================================================

export interface CommandPaletteTriggerProps {
  className?: string
}

const CommandPaletteTrigger: FC<CommandPaletteTriggerProps> = ({ className }) => {
  const { open } = useCommandPalette()

  return (
    <button
      onClick={open}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'bg-surface-2 border border-border-subtle',
        'text-text-tertiary hover:text-text-secondary hover:border-border-default',
        'transition-colors',
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="text-sm">Search commands...</span>
      <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-surface-3 rounded">
        ⌘K
      </kbd>
    </button>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const CommandPalette = Object.assign(CommandPaletteRoot, {
  Provider: CommandPaletteProvider,
  Input: CommandPaletteInput,
  List: CommandPaletteList,
  Footer: CommandPaletteFooter,
  Trigger: CommandPaletteTrigger,
})

// =============================================================================
// DEFAULT GEOINT COMMANDS
// =============================================================================

export const createGeointCommands = (handlers: {
  onSearch?: () => void
  onFlyTo?: (location: string) => void
  onToggleLayer?: (layer: string) => void
  onExport?: (format: string) => void
  onSetLayout?: (layout: 'command' | 'focus' | 'grid') => void
}): CommandItem[] => [
  // Navigation
  {
    id: 'nav-fly-to-sf',
    label: 'Fly to San Francisco',
    description: 'Navigate map to San Francisco',
    category: 'navigation',
    icon: MapPin,
    action: () => handlers.onFlyTo?.('san-francisco'),
    keywords: ['sf', 'california', 'bay area'],
  },
  {
    id: 'nav-fly-to-dc',
    label: 'Fly to Washington DC',
    description: 'Navigate map to Washington DC',
    category: 'navigation',
    icon: MapPin,
    action: () => handlers.onFlyTo?.('washington-dc'),
    keywords: ['dc', 'capital', 'east coast'],
  },
  // Search
  {
    id: 'search-all-sources',
    label: 'Search All Sources',
    description: 'Execute search across all intel sources',
    category: 'search',
    icon: Search,
    shortcut: '⌘⇧S',
    action: () => handlers.onSearch?.(),
  },
  // Layers
  {
    id: 'layer-toggle-tracks',
    label: 'Toggle Track Layer',
    description: 'Show/hide track entities',
    category: 'layers',
    icon: Layers,
    action: () => handlers.onToggleLayer?.('tracks'),
    keywords: ['tracks', 'vehicle', 'vessels'],
  },
  {
    id: 'layer-toggle-flights',
    label: 'Toggle Flight Layer',
    description: 'Show/hide aircraft positions',
    category: 'layers',
    icon: Layers,
    action: () => handlers.onToggleLayer?.('flights'),
    keywords: ['aircraft', 'planes', 'adsb', 'opensky'],
  },
  // View
  {
    id: 'view-command-layout',
    label: 'Command Center Layout',
    description: 'Switch to three-column command layout',
    category: 'view',
    icon: Command,
    shortcut: '⌘1',
    action: () => handlers.onSetLayout?.('command'),
  },
  {
    id: 'view-focus-layout',
    label: 'Focus Mode Layout',
    description: 'Switch to map-centric focus layout',
    category: 'view',
    icon: Command,
    shortcut: '⌘2',
    action: () => handlers.onSetLayout?.('focus'),
  },
  {
    id: 'view-grid-layout',
    label: 'Dashboard Grid Layout',
    description: 'Switch to multi-pane analytics layout',
    category: 'view',
    icon: Command,
    shortcut: '⌘3',
    action: () => handlers.onSetLayout?.('grid'),
  },
  // Export
  {
    id: 'export-geojson',
    label: 'Export as GeoJSON',
    description: 'Export current view as GeoJSON file',
    category: 'export',
    icon: Command,
    action: () => handlers.onExport?.('geojson'),
    keywords: ['download', 'save', 'json'],
  },
  {
    id: 'export-kml',
    label: 'Export as KML',
    description: 'Export current view as KML for Google Earth',
    category: 'export',
    icon: Command,
    action: () => handlers.onExport?.('kml'),
    keywords: ['download', 'save', 'google earth'],
  },
  // Settings
  {
    id: 'settings-keyboard',
    label: 'Keyboard Shortcuts',
    description: 'View all keyboard shortcuts',
    category: 'settings',
    icon: Keyboard,
    shortcut: '?',
    action: () => console.log('Show keyboard shortcuts'),
  },
]

export default CommandPalette
