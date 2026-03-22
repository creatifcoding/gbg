/**
 * BookmarksPanel - Saved Views and Locations
 *
 * Manages saved map states and quick navigation:
 * - Save current view (position, zoom, layers)
 * - Organize bookmarks into folders
 * - Quick navigation via keyboard shortcuts
 * - Import/export bookmark sets
 * - Recently visited locations
 *
 * Compound component architecture:
 * - BookmarksPanel.Root - Container with bookmark state
 * - BookmarksPanel.Header - Title and add button
 * - BookmarksPanel.FolderList - List of folders
 * - BookmarksPanel.BookmarkList - List of bookmarks
 * - BookmarksPanel.BookmarkItem - Individual bookmark row
 * - BookmarksPanel.RecentLocations - Recently visited list
 * - BookmarksPanel.CreateDialog - New bookmark creation
 *
 * @module geoint/components/BookmarksPanel
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
import { animate } from 'animejs'
import {
  Bookmark,
  BookmarkPlus,
  Folder,
  FolderPlus,
  MapPin,
  Navigation,
  Clock,
  Star,
  Trash2,
  Edit2,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Upload,
  X,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export interface ViewState {
  /** Center longitude */
  longitude: number
  /** Center latitude */
  latitude: number
  /** Zoom level */
  zoom: number
  /** Pitch (tilt) in degrees */
  pitch?: number
  /** Bearing (rotation) in degrees */
  bearing?: number
}

export interface LayerState {
  /** Layer ID */
  id: string
  /** Layer name */
  name: string
  /** Is visible */
  visible: boolean
  /** Opacity (0-1) */
  opacity?: number
}

export interface MapBookmark {
  /** Unique ID */
  id: string
  /** Bookmark name */
  name: string
  /** Description */
  description?: string
  /** View state */
  viewState: ViewState
  /** Layer states (optional) */
  layerStates?: readonly LayerState[]
  /** Folder ID */
  folderId?: string
  /** Created timestamp */
  createdAt: Date
  /** Is favorite */
  isFavorite?: boolean
  /** Thumbnail URL */
  thumbnail?: string
  /** Keyboard shortcut */
  shortcut?: string
}

export interface BookmarkFolder {
  /** Unique ID */
  id: string
  /** Folder name */
  name: string
  /** Color */
  color?: string
  /** Is expanded */
  isExpanded?: boolean
}

export interface RecentLocation {
  /** ID */
  id: string
  /** Name/label */
  name: string
  /** Position */
  position: readonly [number, number]
  /** Visit timestamp */
  visitedAt: Date
}

export interface BookmarksContextValue {
  /** All bookmarks */
  bookmarks: readonly MapBookmark[]
  /** All folders */
  folders: readonly BookmarkFolder[]
  /** Recent locations */
  recentLocations: readonly RecentLocation[]
  /** Selected bookmark ID */
  selectedBookmarkId: string | null
  /** Select a bookmark */
  selectBookmark: (id: string | null) => void
  /** Create bookmark */
  createBookmark: (data: Omit<MapBookmark, 'id' | 'createdAt'>) => void
  /** Update bookmark */
  updateBookmark: (id: string, data: Partial<MapBookmark>) => void
  /** Delete bookmark */
  deleteBookmark: (id: string) => void
  /** Create folder */
  createFolder: (name: string, color?: string) => void
  /** Delete folder */
  deleteFolder: (id: string) => void
  /** Toggle folder expanded */
  toggleFolder: (id: string) => void
  /** Toggle favorite */
  toggleFavorite: (id: string) => void
  /** Navigate to bookmark */
  navigateTo: (bookmark: MapBookmark) => void
  /** Add recent location */
  addRecentLocation: (location: Omit<RecentLocation, 'id' | 'visitedAt'>) => void
  /** Clear recent locations */
  clearRecentLocations: () => void
  /** Search filter */
  searchFilter: string
  /** Set search filter */
  setSearchFilter: (filter: string) => void
  /** Compact mode */
  compact: boolean
}

export interface BookmarksPanelRootProps {
  /** Initial bookmarks */
  initialBookmarks?: readonly MapBookmark[]
  /** Initial folders */
  initialFolders?: readonly BookmarkFolder[]
  /** Navigate callback */
  onNavigate?: (viewState: ViewState, layerStates?: readonly LayerState[]) => void
  /** Bookmark change callback */
  onBookmarkChange?: (bookmarks: readonly MapBookmark[]) => void
  /** Close handler */
  onClose?: () => void
  /** Current view state (for creating bookmarks) */
  currentViewState?: ViewState
  /** Current layer states */
  currentLayerStates?: readonly LayerState[]
  /** Compact mode */
  compact?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const BookmarksContext = createContext<BookmarksContextValue | null>(null)

export const useBookmarks = () => {
  const ctx = useContext(BookmarksContext)
  if (!ctx) throw new Error('useBookmarks must be used within BookmarksPanel.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_FOLDER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
]

const MAX_RECENT_LOCATIONS = 10

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<BookmarksPanelRootProps> = ({
  initialBookmarks = [],
  initialFolders = [],
  onNavigate,
  onBookmarkChange,
  onClose,
  currentViewState,
  currentLayerStates,
  compact = false,
  children,
  className,
}) => {
  const [bookmarks, setBookmarks] = useState<MapBookmark[]>([...initialBookmarks])
  const [folders, setFolders] = useState<BookmarkFolder[]>([...initialFolders])
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([])
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Store current view for creating bookmarks
  const currentViewRef = useRef(currentViewState)
  const currentLayersRef = useRef(currentLayerStates)
  useEffect(() => {
    currentViewRef.current = currentViewState
    currentLayersRef.current = currentLayerStates
  }, [currentViewState, currentLayerStates])

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [])

  // Notify on change
  useEffect(() => {
    onBookmarkChange?.(bookmarks)
  }, [bookmarks, onBookmarkChange])

  const createBookmark = useCallback((data: Omit<MapBookmark, 'id' | 'createdAt'>) => {
    const newBookmark: MapBookmark = {
      ...data,
      id: `bookmark-${Date.now()}`,
      createdAt: new Date(),
    }
    setBookmarks(prev => [...prev, newBookmark])
  }, [])

  const updateBookmark = useCallback((id: string, data: Partial<MapBookmark>) => {
    setBookmarks(prev =>
      prev.map(b => b.id === id ? { ...b, ...data } : b)
    )
  }, [])

  const deleteBookmark = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id))
    if (selectedBookmarkId === id) {
      setSelectedBookmarkId(null)
    }
  }, [selectedBookmarkId])

  const createFolder = useCallback((name: string, color?: string) => {
    const newFolder: BookmarkFolder = {
      id: `folder-${Date.now()}`,
      name,
      color: color ?? DEFAULT_FOLDER_COLORS[folders.length % DEFAULT_FOLDER_COLORS.length],
      isExpanded: true,
    }
    setFolders(prev => [...prev, newFolder])
  }, [folders.length])

  const deleteFolder = useCallback((id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id))
    // Move bookmarks in this folder to no folder
    setBookmarks(prev =>
      prev.map(b => b.folderId === id ? { ...b, folderId: undefined } : b)
    )
  }, [])

  const toggleFolder = useCallback((id: string) => {
    setFolders(prev =>
      prev.map(f => f.id === id ? { ...f, isExpanded: !f.isExpanded } : f)
    )
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setBookmarks(prev =>
      prev.map(b => b.id === id ? { ...b, isFavorite: !b.isFavorite } : b)
    )
  }, [])

  const navigateTo = useCallback((bookmark: MapBookmark) => {
    onNavigate?.(bookmark.viewState, bookmark.layerStates)
    setSelectedBookmarkId(bookmark.id)
  }, [onNavigate])

  const addRecentLocation = useCallback((location: Omit<RecentLocation, 'id' | 'visitedAt'>) => {
    setRecentLocations(prev => {
      const newLocation: RecentLocation = {
        ...location,
        id: `recent-${Date.now()}`,
        visitedAt: new Date(),
      }
      // Add to front, limit size
      const updated = [newLocation, ...prev.filter(l => l.name !== location.name)]
      return updated.slice(0, MAX_RECENT_LOCATIONS)
    })
  }, [])

  const clearRecentLocations = useCallback(() => {
    setRecentLocations([])
  }, [])

  const contextValue: BookmarksContextValue = {
    bookmarks,
    folders,
    recentLocations,
    selectedBookmarkId,
    selectBookmark: setSelectedBookmarkId,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    createFolder,
    deleteFolder,
    toggleFolder,
    toggleFavorite,
    navigateTo,
    addRecentLocation,
    clearRecentLocations,
    searchFilter,
    setSearchFilter,
    compact,
  }

  return (
    <BookmarksContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Bookmarks
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {children}
      </div>
    </BookmarksContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Show create button */
  showCreate?: boolean
  /** Create clicked */
  onCreateClick?: () => void
  /** Show folder create */
  showFolderCreate?: boolean
  /** Folder create clicked */
  onFolderCreateClick?: () => void
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({
  showCreate = true,
  onCreateClick,
  showFolderCreate = true,
  onFolderCreateClick,
  className,
}) {
  const { bookmarks, searchFilter, setSearchFilter, compact } = useBookmarks()

  return (
    <div className={cn('p-3 space-y-2', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search bookmarks..."
          className={cn(
            'w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg',
            'text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-1 focus:ring-accent-primary',
            compact ? 'text-xs' : 'text-sm'
          )}
        />
      </div>

      {/* Stats and actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">
          {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          {showFolderCreate && (
            <button
              onClick={onFolderCreateClick}
              className="p-1.5 hover:bg-surface-2 rounded text-text-tertiary hover:text-text-secondary transition-colors"
              title="New folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          )}
          {showCreate && (
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1 px-2 py-1 bg-accent-primary/10 text-accent-primary rounded text-xs font-medium hover:bg-accent-primary/20 transition-colors"
            >
              <BookmarkPlus className="w-3 h-3" />
              Save View
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// FOLDER LIST COMPONENT
// =============================================================================

export interface FolderListProps {
  /** Additional class */
  className?: string
}

const FolderList: FC<FolderListProps> = memo(function FolderList({ className }) {
  const { folders, bookmarks, searchFilter, toggleFolder, deleteFolder, compact } = useBookmarks()

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    bookmarks.some(b =>
      b.folderId === f.id &&
      b.name.toLowerCase().includes(searchFilter.toLowerCase())
    )
  )

  if (filteredFolders.length === 0) return null

  return (
    <div className={cn('px-3 space-y-1', className)}>
      {filteredFolders.map(folder => {
        const folderBookmarks = bookmarks.filter(b => b.folderId === folder.id)
        return (
          <div key={folder.id} className="space-y-1">
            <button
              onClick={() => toggleFolder(folder.id)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors group"
            >
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: folder.color }}
              />
              {folder.isExpanded ? (
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-tertiary" />
              )}
              <Folder className="w-4 h-4 text-text-secondary" />
              <span className={cn(
                'flex-1 text-left text-text-secondary truncate',
                compact ? 'text-xs' : 'text-sm'
              )}>
                {folder.name}
              </span>
              <span className="text-xs text-text-tertiary">
                {folderBookmarks.length}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteFolder(folder.id)
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-3 rounded text-text-tertiary hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>

            {folder.isExpanded && (
              <div className="pl-6 space-y-1">
                {folderBookmarks.map(bookmark => (
                  <BookmarkItem key={bookmark.id} bookmark={bookmark} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

// =============================================================================
// BOOKMARK LIST COMPONENT
// =============================================================================

export interface BookmarkListProps {
  /** Show only unfiled bookmarks */
  showOnlyUnfiled?: boolean
  /** Show favorites first */
  showFavoritesFirst?: boolean
  /** Additional class */
  className?: string
}

const BookmarkList: FC<BookmarkListProps> = memo(function BookmarkList({
  showOnlyUnfiled = true,
  showFavoritesFirst = true,
  className,
}) {
  const { bookmarks, searchFilter } = useBookmarks()

  let displayBookmarks = showOnlyUnfiled
    ? bookmarks.filter(b => !b.folderId)
    : bookmarks

  // Filter by search
  if (searchFilter) {
    displayBookmarks = displayBookmarks.filter(b =>
      b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchFilter.toLowerCase())
    )
  }

  // Sort - favorites first
  if (showFavoritesFirst) {
    displayBookmarks = [...displayBookmarks].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1
      if (!a.isFavorite && b.isFavorite) return 1
      return 0
    })
  }

  if (displayBookmarks.length === 0) {
    return (
      <div className={cn('px-3 pb-3', className)}>
        <div className="flex flex-col items-center justify-center py-6 text-center bg-surface-2/50 rounded-lg border border-dashed border-border-subtle">
          <Bookmark className="w-6 h-6 text-text-tertiary/50 mb-2" />
          <p className="text-xs text-text-tertiary">
            {searchFilter ? 'No matching bookmarks' : 'No bookmarks yet'}
          </p>
          <p className="text-xs text-text-tertiary/70 mt-1">
            Save a view to create your first bookmark
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('px-3 pb-3 space-y-1', className)}>
      {displayBookmarks.map(bookmark => (
        <BookmarkItem key={bookmark.id} bookmark={bookmark} />
      ))}
    </div>
  )
})

// =============================================================================
// BOOKMARK ITEM COMPONENT
// =============================================================================

export interface BookmarkItemProps {
  /** Bookmark data */
  bookmark: MapBookmark
  /** Additional class */
  className?: string
}

const BookmarkItem: FC<BookmarkItemProps> = memo(function BookmarkItem({
  bookmark,
  className,
}) {
  const { navigateTo, toggleFavorite, deleteBookmark, selectedBookmarkId, compact } = useBookmarks()
  const [showMenu, setShowMenu] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  const isSelected = bookmark.id === selectedBookmarkId

  return (
    <div
      ref={itemRef}
      className={cn(
        'group flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer',
        isSelected
          ? 'bg-accent-primary/10 border border-accent-primary/30'
          : 'bg-surface-2 border border-transparent hover:bg-surface-3',
        className
      )}
      onClick={() => navigateTo(bookmark)}
    >
      {/* Favorite star */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(bookmark.id)
        }}
        className={cn(
          'p-1 rounded transition-colors',
          bookmark.isFavorite
            ? 'text-yellow-400'
            : 'text-text-tertiary/30 hover:text-yellow-400'
        )}
      >
        <Star className={cn('w-4 h-4', bookmark.isFavorite && 'fill-current')} />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            compact ? 'text-xs' : 'text-sm',
            isSelected ? 'text-text-primary' : 'text-text-secondary'
          )}>
            {bookmark.name}
          </span>
          {bookmark.shortcut && (
            <span className="px-1 py-0.5 text-xs bg-surface-3 text-text-tertiary rounded font-mono">
              {bookmark.shortcut}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {bookmark.viewState.latitude.toFixed(2)}, {bookmark.viewState.longitude.toFixed(2)}
          </span>
          {bookmark.layerStates && (
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {bookmark.layerStates.filter(l => l.visible).length} layers
            </span>
          )}
        </div>
      </div>

      {/* Navigate icon */}
      <Navigation className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Actions menu */}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-3 rounded transition-all text-text-tertiary"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-border-subtle rounded-lg shadow-lg overflow-hidden z-20 min-w-[100px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteBookmark(bookmark.id)
                setShowMenu(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// RECENT LOCATIONS COMPONENT
// =============================================================================

export interface RecentLocationsProps {
  /** Max items to show */
  maxItems?: number
  /** Additional class */
  className?: string
}

const RecentLocations: FC<RecentLocationsProps> = memo(function RecentLocations({
  maxItems = 5,
  className,
}) {
  const { recentLocations, clearRecentLocations, compact } = useBookmarks()
  const [isExpanded, setIsExpanded] = useState(true)

  if (recentLocations.length === 0) return null

  return (
    <div className={cn('px-3 pb-3 space-y-2', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-text-tertiary uppercase font-mono"
      >
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Recent ({recentLocations.length})
        </span>
        <div className="flex items-center gap-1">
          {recentLocations.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearRecentLocations()
              }}
              className="p-0.5 hover:text-text-secondary"
              title="Clear recent"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 transition-transform',
            !isExpanded && '-rotate-90'
          )} />
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-1">
          {recentLocations.slice(0, maxItems).map(location => (
            <div
              key={location.id}
              className="flex items-center gap-2 p-2 bg-surface-2 rounded text-xs cursor-pointer hover:bg-surface-3 transition-colors"
            >
              <MapPin className="w-3 h-3 text-text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'block truncate text-text-secondary',
                  compact && 'text-xs'
                )}>
                  {location.name}
                </span>
                <span className="text-xs text-text-tertiary">
                  {new Date(location.visitedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// CREATE DIALOG COMPONENT
// =============================================================================

export interface CreateDialogProps {
  /** Is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Current view state */
  currentViewState?: ViewState
  /** Current layer states */
  currentLayerStates?: readonly LayerState[]
  /** Additional class */
  className?: string
}

const CreateDialog: FC<CreateDialogProps> = memo(function CreateDialog({
  isOpen,
  onClose,
  currentViewState,
  currentLayerStates,
  className,
}) {
  const { createBookmark, folders } = useBookmarks()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [folderId, setFolderId] = useState<string | undefined>(undefined)
  const [saveLayers, setSaveLayers] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      animate(dialogRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [isOpen])

  const handleCreate = () => {
    if (!name.trim() || !currentViewState) return
    createBookmark({
      name: name.trim(),
      description: description.trim() || undefined,
      viewState: currentViewState,
      layerStates: saveLayers ? currentLayerStates : undefined,
      folderId,
    })
    setName('')
    setDescription('')
    setFolderId(undefined)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        className={cn(
          'w-full max-w-sm bg-surface-1 border border-border-subtle rounded-lg shadow-xl overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="font-medium text-text-primary">Save View</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 rounded text-text-tertiary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Name input */}
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-mono">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Bookmark name..."
              className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              autoFocus
            />
          </div>

          {/* Description input */}
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-mono">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>

          {/* Folder selector */}
          {folders.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-text-tertiary uppercase font-mono">Folder</label>
              <select
                value={folderId ?? ''}
                onChange={e => setFolderId(e.target.value || undefined)}
                className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                <option value="">No folder</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Layer state toggle */}
          {currentLayerStates && currentLayerStates.length > 0 && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={saveLayers}
                onChange={e => setSaveLayers(e.target.checked)}
                className="w-4 h-4 rounded border-border-subtle bg-surface-2 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
              />
              <span className="text-sm text-text-secondary">
                Save layer states ({currentLayerStates.length} layers)
              </span>
            </label>
          )}

          {/* View state preview */}
          {currentViewState && (
            <div className="p-2 bg-surface-2 rounded-lg text-xs font-mono text-text-tertiary">
              <div>Lat: {currentViewState.latitude.toFixed(4)}</div>
              <div>Lon: {currentViewState.longitude.toFixed(4)}</div>
              <div>Zoom: {currentViewState.zoom.toFixed(1)}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || !currentViewState}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              name.trim() && currentViewState
                ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
                : 'bg-surface-2 text-text-tertiary cursor-not-allowed'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// IMPORT/EXPORT COMPONENT
// =============================================================================

export interface ImportExportProps {
  /** Export handler */
  onExport?: (bookmarks: readonly MapBookmark[], folders: readonly BookmarkFolder[]) => void
  /** Import handler */
  onImport?: (data: { bookmarks: MapBookmark[]; folders: BookmarkFolder[] }) => void
  /** Additional class */
  className?: string
}

const ImportExport: FC<ImportExportProps> = memo(function ImportExport({
  onExport,
  onImport: _onImport,
  className,
}) {
  const { bookmarks, folders, compact } = useBookmarks()

  return (
    <div className={cn('px-3 py-2 border-t border-border-subtle flex items-center gap-2', className)}>
      <button
        onClick={() => onExport?.(bookmarks, folders)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:bg-surface-2 transition-colors',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
      <button
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-text-secondary hover:bg-surface-2 transition-colors',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <Upload className="w-3.5 h-3.5" />
        Import
      </button>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const BookmarksPanel = Object.assign(Root, {
  Root,
  Header,
  FolderList,
  BookmarkList,
  BookmarkItem,
  RecentLocations,
  CreateDialog,
  ImportExport,
})

// Named exports
export {
  Root as BookmarksPanelRoot,
  Header as BookmarksPanelHeader,
  FolderList as BookmarksPanelFolderList,
  BookmarkList as BookmarksPanelBookmarkList,
  BookmarkItem as BookmarksPanelBookmarkItem,
  RecentLocations as BookmarksPanelRecentLocations,
  CreateDialog as BookmarksPanelCreateDialog,
  ImportExport as BookmarksPanelImportExport,
}

export default BookmarksPanel
