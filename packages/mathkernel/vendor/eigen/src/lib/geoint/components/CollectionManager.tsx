/**
 * CollectionManager - Entity Watchlists and Groups
 *
 * Allows users to organize entities into collections for monitoring:
 * - Create/edit/delete collections (watchlists, groups, favorites)
 * - Add/remove entities from collections
 * - Collection sharing and export
 * - Visual indicators for collection membership
 *
 * Compound component architecture:
 * - CollectionManager.Root - Container with collection state
 * - CollectionManager.Header - Title and create button
 * - CollectionManager.CollectionList - List of collections
 * - CollectionManager.CollectionItem - Individual collection row
 * - CollectionManager.EntityList - Entities in selected collection
 * - CollectionManager.EntityItem - Individual entity row
 * - CollectionManager.CreateDialog - New collection creation
 *
 * @module geoint/components/CollectionManager
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
import { Atom, Registry, RegistryContext } from '@effect-atom/atom-react'
import React from 'react'

// NOTE: Atoms are defined for external integration. Internal state uses
// useState for now - refactor to full atom-based state in follow-up.
import { animate } from 'animejs'
import {
  FolderPlus,
  Folder,
  FolderOpen,
  Star,
  Eye,
  Users,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
  Share2,
  Download,
  X,
  Check,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import type { SearchResultItem } from '../schemas/search'

// =============================================================================
// TYPES
// =============================================================================

export type CollectionType = 'watchlist' | 'group' | 'favorites' | 'custom'

export interface Collection {
  /** Unique ID */
  id: string
  /** Collection name */
  name: string
  /** Description */
  description?: string
  /** Collection type */
  type: CollectionType
  /** Entity IDs in this collection */
  entityIds: readonly string[]
  /** Color for visual identification */
  color?: string
  /** Icon override */
  icon?: string
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
  /** Is shared */
  isShared?: boolean
  /** Creator ID */
  creatorId?: string
}

export interface CollectionContextValue {
  /** All collections */
  collections: readonly Collection[]
  /** Selected collection ID */
  selectedCollectionId: string | null
  /** Select a collection */
  selectCollection: (id: string | null) => void
  /** Selected collection */
  selectedCollection: Collection | null
  /** Create a new collection */
  createCollection: (data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** Update a collection */
  updateCollection: (id: string, data: Partial<Collection>) => void
  /** Delete a collection */
  deleteCollection: (id: string) => void
  /** Add entity to collection */
  addToCollection: (collectionId: string, entityId: string) => void
  /** Remove entity from collection */
  removeFromCollection: (collectionId: string, entityId: string) => void
  /** Add multiple entities */
  addManyToCollection: (collectionId: string, entityIds: readonly string[]) => void
  /** Check if entity is in collection */
  isInCollection: (collectionId: string, entityId: string) => boolean
  /** Get collections containing entity */
  getCollectionsForEntity: (entityId: string) => readonly Collection[]
  /** Search filter */
  searchFilter: string
  /** Set search filter */
  setSearchFilter: (filter: string) => void
  /** Compact mode */
  compact: boolean
  /** Entity lookup (optional) */
  entityLookup?: (entityId: string) => SearchResultItem | undefined
}

export interface CollectionManagerRootProps {
  /** Initial collections */
  initialCollections?: readonly Collection[]
  /** Entity lookup function */
  entityLookup?: (entityId: string) => SearchResultItem | undefined
  /** Collection changed callback */
  onCollectionChange?: (collections: readonly Collection[]) => void
  /** Entity clicked callback */
  onEntityClick?: (entityId: string) => void
  /** Close handler */
  onClose?: () => void
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

const CollectionContext = createContext<CollectionContextValue | null>(null)

export const useCollectionManager = () => {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollectionManager must be used within CollectionManager.Root')
  return ctx
}

// =============================================================================
// ATOMS - Module-level state following Atom-as-State doctrine
// =============================================================================

/** Registry for collection manager atoms */
export const collectionRegistry = Registry.make()

/** Atom holding all collections */
export const collectionsAtom = Atom.make<readonly Collection[]>([])

/** Atom for the selected collection ID */
export const selectedCollectionIdAtom = Atom.make<string | null>(null)

/** Atom for search filter */
export const collectionSearchFilterAtom = Atom.make<string>('')

/** Derived atom for selected collection */
export const selectedCollectionAtom = Atom.make((get) => {
  const collections = get(collectionsAtom)
  const selectedId = get(selectedCollectionIdAtom)
  return collections.find(c => c.id === selectedId) ?? null
})

/** Registry Provider for collection manager */
export function CollectionRegistryProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(RegistryContext.Provider, { value: collectionRegistry as any }, children)
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLLECTION_TYPE_CONFIG: Record<CollectionType, { label: string; icon: typeof Folder; color: string }> = {
  watchlist: { label: 'Watchlist', icon: Eye, color: SOURCE_COLORS.track.primary },
  group: { label: 'Group', icon: Users, color: SOURCE_COLORS.osm.primary },
  favorites: { label: 'Favorites', icon: Star, color: SOURCE_COLORS.opensky.primary },
  custom: { label: 'Custom', icon: Folder, color: SOURCE_COLORS.sentinel.primary },
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<CollectionManagerRootProps> = ({
  initialCollections = [],
  entityLookup,
  onCollectionChange,
  onEntityClick: _onEntityClick,
  onClose,
  compact = false,
  children,
  className,
}) => {
  const [collections, setCollections] = useState<Collection[]>([...initialCollections])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync to atoms for external integration
  useEffect(() => {
    collectionRegistry.set(collectionsAtom, collections)
  }, [collections])

  useEffect(() => {
    collectionRegistry.set(selectedCollectionIdAtom, selectedCollectionId)
  }, [selectedCollectionId])

  useEffect(() => {
    collectionRegistry.set(collectionSearchFilterAtom, searchFilter)
  }, [searchFilter])

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
    onCollectionChange?.(collections)
  }, [collections, onCollectionChange])

  const selectedCollection = collections.find(c => c.id === selectedCollectionId) ?? null

  const createCollection = useCallback((data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date()
    const newCollection: Collection = {
      ...data,
      id: `collection-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    }
    setCollections(prev => [...prev, newCollection])
  }, [])

  const updateCollection = useCallback((id: string, data: Partial<Collection>) => {
    setCollections(prev =>
      prev.map(c =>
        c.id === id ? { ...c, ...data, updatedAt: new Date() } : c
      )
    )
  }, [])

  const deleteCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id))
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null)
    }
  }, [selectedCollectionId])

  const addToCollection = useCallback((collectionId: string, entityId: string) => {
    setCollections(prev =>
      prev.map(c =>
        c.id === collectionId && !c.entityIds.includes(entityId)
          ? { ...c, entityIds: [...c.entityIds, entityId], updatedAt: new Date() }
          : c
      )
    )
  }, [])

  const removeFromCollection = useCallback((collectionId: string, entityId: string) => {
    setCollections(prev =>
      prev.map(c =>
        c.id === collectionId
          ? { ...c, entityIds: c.entityIds.filter(id => id !== entityId), updatedAt: new Date() }
          : c
      )
    )
  }, [])

  const addManyToCollection = useCallback((collectionId: string, entityIds: readonly string[]) => {
    setCollections(prev =>
      prev.map(c => {
        if (c.id !== collectionId) return c
        const newIds = entityIds.filter(id => !c.entityIds.includes(id))
        if (newIds.length === 0) return c
        return { ...c, entityIds: [...c.entityIds, ...newIds], updatedAt: new Date() }
      })
    )
  }, [])

  const isInCollection = useCallback((collectionId: string, entityId: string) => {
    const collection = collections.find(c => c.id === collectionId)
    return collection?.entityIds.includes(entityId) ?? false
  }, [collections])

  const getCollectionsForEntity = useCallback((entityId: string) => {
    return collections.filter(c => c.entityIds.includes(entityId))
  }, [collections])

  const contextValue: CollectionContextValue = {
    collections,
    selectedCollectionId,
    selectCollection: setSelectedCollectionId,
    selectedCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    addManyToCollection,
    isInCollection,
    getCollectionsForEntity,
    searchFilter,
    setSearchFilter,
    compact,
    entityLookup,
  }

  return (
    <CollectionContext.Provider value={contextValue}>
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
            <FolderPlus className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Collections
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
    </CollectionContext.Provider>
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
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({
  showCreate = true,
  onCreateClick,
  className,
}) {
  const { collections, searchFilter, setSearchFilter, compact } = useCollectionManager()

  return (
    <div className={cn('p-3 space-y-2', className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search collections..."
          className={cn(
            'w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg',
            'text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:ring-1 focus:ring-accent-primary',
            compact ? 'text-xs' : 'text-sm'
          )}
        />
      </div>

      {/* Stats and create */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">
          {collections.length} collection{collections.length !== 1 ? 's' : ''}
        </span>
        {showCreate && (
          <button
            onClick={onCreateClick}
            className="flex items-center gap-1 px-2 py-1 bg-accent-primary/10 text-accent-primary rounded text-xs font-medium hover:bg-accent-primary/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// COLLECTION LIST COMPONENT
// =============================================================================

export interface CollectionListProps {
  /** Additional class */
  className?: string
}

const CollectionList: FC<CollectionListProps> = memo(function CollectionList({ className }) {
  const { collections, searchFilter, selectedCollectionId, selectCollection } = useCollectionManager()

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchFilter.toLowerCase())
  )

  if (filteredCollections.length === 0) {
    return (
      <div className={cn('px-3 pb-3', className)}>
        <div className="flex flex-col items-center justify-center py-6 text-center bg-surface-2/50 rounded-lg border border-dashed border-border-subtle">
          <Folder className="w-6 h-6 text-text-tertiary/50 mb-2" />
          <p className="text-xs text-text-tertiary">
            {searchFilter ? 'No matching collections' : 'No collections yet'}
          </p>
          <p className="text-xs text-text-tertiary/70 mt-1">
            Create one to start organizing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('px-3 pb-3 space-y-1', className)}>
      {filteredCollections.map(collection => (
        <CollectionItem
          key={collection.id}
          collection={collection}
          isSelected={collection.id === selectedCollectionId}
          onSelect={() => selectCollection(collection.id)}
        />
      ))}
    </div>
  )
})

// =============================================================================
// COLLECTION ITEM COMPONENT
// =============================================================================

export interface CollectionItemProps {
  /** Collection data */
  collection: Collection
  /** Is selected */
  isSelected?: boolean
  /** Select handler */
  onSelect?: () => void
  /** Additional class */
  className?: string
}

const CollectionItem: FC<CollectionItemProps> = memo(function CollectionItem({
  collection,
  isSelected = false,
  onSelect,
  className,
}) {
  const { deleteCollection, compact } = useCollectionManager()
  const [showMenu, setShowMenu] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  const typeConfig = COLLECTION_TYPE_CONFIG[collection.type]
  const Icon = isSelected ? FolderOpen : typeConfig.icon
  const color = collection.color ?? typeConfig.color

  // Animate on mount
  useEffect(() => {
    if (itemRef.current) {
      animate(itemRef.current, {
        opacity: [0, 1],
        translateX: [-5, 0],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [])

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
      onClick={onSelect}
    >
      {/* Color indicator */}
      <div
        className="w-1 h-6 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* Icon */}
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: isSelected ? color : undefined }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            compact ? 'text-xs' : 'text-sm',
            isSelected ? 'text-text-primary' : 'text-text-secondary'
          )}>
            {collection.name}
          </span>
          {collection.isShared && (
            <Share2 className="w-3 h-3 text-text-tertiary flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary">
            {collection.entityIds.length} entities
          </span>
          <span className="text-xs text-text-tertiary/50">
            {typeConfig.label}
          </span>
        </div>
      </div>

      {/* Actions */}
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
          <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-border-subtle rounded-lg shadow-lg overflow-hidden z-20 min-w-[120px]">
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
                setShowMenu(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteCollection(collection.id)
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

      {/* Expand arrow */}
      <ChevronRight className={cn(
        'w-4 h-4 text-text-tertiary transition-transform',
        isSelected && 'rotate-90'
      )} />
    </div>
  )
})

// =============================================================================
// ENTITY LIST COMPONENT
// =============================================================================

export interface EntityListProps {
  /** Entity click handler */
  onEntityClick?: (entityId: string) => void
  /** Additional class */
  className?: string
}

const EntityList: FC<EntityListProps> = memo(function EntityList({
  onEntityClick,
  className,
}) {
  const { selectedCollection, removeFromCollection, entityLookup, compact } = useCollectionManager()

  if (!selectedCollection) {
    return (
      <div className={cn('px-3 pb-3', className)}>
        <div className="flex items-center justify-center py-4 text-xs text-text-tertiary">
          Select a collection to view entities
        </div>
      </div>
    )
  }

  if (selectedCollection.entityIds.length === 0) {
    return (
      <div className={cn('px-3 pb-3', className)}>
        <div className="flex flex-col items-center justify-center py-6 text-center bg-surface-2/50 rounded-lg border border-dashed border-border-subtle">
          <Filter className="w-6 h-6 text-text-tertiary/50 mb-2" />
          <p className="text-xs text-text-tertiary">
            No entities in this collection
          </p>
          <p className="text-xs text-text-tertiary/70 mt-1">
            Add entities from search results
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('px-3 pb-3 space-y-1', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-text-tertiary uppercase font-mono">
          Entities ({selectedCollection.entityIds.length})
        </span>
      </div>

      {selectedCollection.entityIds.map(entityId => {
        const entity = entityLookup?.(entityId)
        return (
          <EntityItem
            key={entityId}
            entityId={entityId}
            entity={entity}
            collectionId={selectedCollection.id}
            onClick={() => onEntityClick?.(entityId)}
            onRemove={() => removeFromCollection(selectedCollection.id, entityId)}
            compact={compact}
          />
        )
      })}
    </div>
  )
})

// =============================================================================
// ENTITY ITEM COMPONENT
// =============================================================================

export interface EntityItemProps {
  /** Entity ID */
  entityId: string
  /** Entity data (from lookup) */
  entity?: SearchResultItem
  /** Collection ID */
  collectionId: string
  /** Click handler */
  onClick?: () => void
  /** Remove handler */
  onRemove?: () => void
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

/** Get display name from SearchResultItem union */
const getEntityDisplayName = (entity: SearchResultItem): string => {
  switch (entity._tag) {
    case 'SearchResultPoi':
      return entity.name
    case 'SearchResultTrack':
      return entity.label || entity.trackId
    case 'SearchResultFlight':
      return entity.callsign || entity.icao24
    case 'SearchResultFeature':
      return entity.label || entity.featureId
    case 'SearchResultWeather':
      return entity.locationName
    case 'SearchResultImagery':
      return entity.itemId
  }
}

/** Get entity type label from SearchResultItem union */
const getEntityTypeLabel = (entity: SearchResultItem): string => {
  switch (entity._tag) {
    case 'SearchResultPoi':
      return entity.category
    case 'SearchResultTrack':
      return entity.objectType
    case 'SearchResultFlight':
      return entity.category
    case 'SearchResultFeature':
      return entity.geometryType
    case 'SearchResultWeather':
      return 'Weather'
    case 'SearchResultImagery':
      return entity.provider
  }
}

const EntityItem: FC<EntityItemProps> = memo(function EntityItem({
  entityId,
  entity,
  collectionId: _collectionId,
  onClick,
  onRemove,
  compact = false,
  className,
}) {
  // Get source color - use the entity's source field which maps to SOURCE_COLORS keys
  const sourceColor = entity?.source
    ? SOURCE_COLORS[entity.source as keyof typeof SOURCE_COLORS]?.primary ?? SOURCE_COLORS.custom.primary
    : SOURCE_COLORS.custom.primary

  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 bg-surface-2 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Source color */}
      <div
        className="w-1 h-5 rounded-full"
        style={{ backgroundColor: sourceColor }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          'block truncate text-text-secondary',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {entity ? getEntityDisplayName(entity) : entityId}
        </span>
        {entity && (
          <span className="text-xs text-text-tertiary">
            {getEntityTypeLabel(entity)}
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove?.()
        }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-surface-3 rounded transition-all text-text-tertiary hover:text-red-400"
      >
        <X className="w-3 h-3" />
      </button>
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
  /** Additional class */
  className?: string
}

const CreateDialog: FC<CreateDialogProps> = memo(function CreateDialog({
  isOpen,
  onClose,
  className,
}) {
  const { createCollection } = useCollectionManager()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CollectionType>('watchlist')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
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
    if (!name.trim()) return
    createCollection({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      color,
      entityIds: [],
    })
    setName('')
    setDescription('')
    setType('watchlist')
    setColor(DEFAULT_COLORS[0])
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
          <span className="font-medium text-text-primary">New Collection</span>
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
              placeholder="Collection name..."
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

          {/* Type selector */}
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-mono">Type</label>
            <div className="grid grid-cols-4 gap-1">
              {(Object.entries(COLLECTION_TYPE_CONFIG) as [CollectionType, typeof COLLECTION_TYPE_CONFIG.watchlist][]).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                      type === key
                        ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                        : 'bg-surface-2 border-transparent text-text-secondary hover:bg-surface-3'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color selector */}
          <div className="space-y-1">
            <label className="text-xs text-text-tertiary uppercase font-mono">Color</label>
            <div className="flex items-center gap-1.5">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-6 h-6 rounded-full transition-all',
                    color === c && 'ring-2 ring-white ring-offset-2 ring-offset-surface-1'
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3 h-3 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>
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
            disabled={!name.trim()}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              name.trim()
                ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
                : 'bg-surface-2 text-text-tertiary cursor-not-allowed'
            )}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// ADD TO COLLECTION BUTTON (for use elsewhere)
// =============================================================================

export interface AddToCollectionButtonProps {
  /** Entity ID to add */
  entityId: string
  /** Additional class */
  className?: string
}

const AddToCollectionButton: FC<AddToCollectionButtonProps> = memo(function AddToCollectionButton({
  entityId,
  className,
}) {
  const { collections, addToCollection, isInCollection } = useCollectionManager()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary bg-surface-2 rounded hover:bg-surface-3 transition-colors"
      >
        <FolderPlus className="w-3 h-3" />
        Add to...
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-surface-1 border border-border-subtle rounded-lg shadow-lg overflow-hidden z-20 min-w-[150px]">
          {collections.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-tertiary">
              No collections
            </div>
          ) : (
            collections.map(collection => {
              const inCollection = isInCollection(collection.id, entityId)
              return (
                <button
                  key={collection.id}
                  onClick={() => {
                    if (!inCollection) {
                      addToCollection(collection.id, entityId)
                    }
                    setIsOpen(false)
                  }}
                  disabled={inCollection}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs',
                    inCollection
                      ? 'text-text-tertiary bg-surface-2'
                      : 'text-text-secondary hover:bg-surface-2'
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: collection.color }}
                  />
                  <span className="truncate">{collection.name}</span>
                  {inCollection && <Check className="w-3 h-3 ml-auto" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const CollectionManager = Object.assign(Root, {
  Root,
  Header,
  CollectionList,
  CollectionItem,
  EntityList,
  EntityItem,
  CreateDialog,
  AddToCollectionButton,
})

// Named exports
export {
  Root as CollectionManagerRoot,
  Header as CollectionManagerHeader,
  CollectionList as CollectionManagerCollectionList,
  CollectionItem as CollectionManagerCollectionItem,
  EntityList as CollectionManagerEntityList,
  EntityItem as CollectionManagerEntityItem,
  CreateDialog as CollectionManagerCreateDialog,
  AddToCollectionButton as CollectionManagerAddToCollectionButton,
}

export default CollectionManager
