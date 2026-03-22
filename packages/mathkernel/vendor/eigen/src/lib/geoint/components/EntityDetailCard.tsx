/**
 * EntityDetailCard - Comprehensive Entity Detail View
 *
 * Full-featured entity detail card with:
 * - Tabbed sections (Overview, History, Relations, Raw)
 * - Action toolbar with quick operations
 * - Minimap showing entity location
 * - Timeline integration for temporal context
 * - anime.js v4 animations throughout
 *
 * Compound component architecture:
 * - EntityDetailCard.Root - Main container with tabs
 * - EntityDetailCard.Header - Title, source, classification badges
 * - EntityDetailCard.Overview - Summary view with key attributes
 * - EntityDetailCard.History - Temporal event timeline
 * - EntityDetailCard.Relations - Entity relationship graph
 * - EntityDetailCard.RawData - JSON viewer
 * - EntityDetailCard.ActionBar - Quick action buttons
 *
 * @module geoint/components/EntityDetailCard
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import { useMachine } from '@xstate/react'
import { animate, stagger } from 'animejs'
import { entityDetailMachine } from '../machines/entityDetailMachine'
import {
  X,
  MapPin,
  Clock,
  GitBranch,
  Code2,
  Bell,
  Download,
  Crosshair,
  GitCompare,
  Share2,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Copy,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SOURCE_COLORS,
  CLASSIFICATION_COLORS,
  TIMING,
  EASING,
  SPACING,
} from '../tokens'
import type { IntelSource, Classification } from '../schemas'
import type { ComposedEntity } from '../cards/traits'
import { getTrait } from '../cards/traits'

// =============================================================================
// TYPES
// =============================================================================

export type DetailTab = 'overview' | 'history' | 'relations' | 'raw'

export interface EntityDetailContextValue {
  /** The entity being displayed */
  entity: ComposedEntity
  /** Active tab */
  activeTab: DetailTab
  /** Set active tab */
  setActiveTab: (tab: DetailTab) => void
  /** Close the detail card */
  onClose?: () => void
  /** Is expanded mode */
  isExpanded: boolean
  /** Toggle expanded mode */
  toggleExpanded: () => void
  /** Compact mode */
  compact: boolean
}

export interface EntityDetailCardRootProps {
  /** Entity to display */
  entity: ComposedEntity
  /** Initial active tab */
  initialTab?: DetailTab
  /** Close handler */
  onClose?: () => void
  /** Compact mode */
  compact?: boolean
  /** Children (tab content) */
  children: ReactNode
  /** Additional class */
  className?: string
}

export interface EntityAttribute {
  label: string
  value: string | number | boolean
  type?: 'text' | 'number' | 'date' | 'coordinate' | 'badge'
  copyable?: boolean
}

export interface EntityEvent {
  id: string
  timestamp: Date
  type: 'created' | 'updated' | 'moved' | 'alert' | 'linked'
  description: string
  details?: Record<string, unknown>
}

export interface EntityRelation {
  id: string
  entityId: string
  entityLabel: string
  relationType: 'parent' | 'child' | 'sibling' | 'linked' | 'proximity'
  confidence?: number
}

// =============================================================================
// CONTEXT
// =============================================================================

const EntityDetailContext = createContext<EntityDetailContextValue | null>(null)

export const useEntityDetail = () => {
  const ctx = useContext(EntityDetailContext)
  if (!ctx) throw new Error('useEntityDetail must be used within EntityDetailCard.Root')
  return ctx
}

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

const TAB_CONFIG: { id: DetailTab; label: string; icon: typeof MapPin }[] = [
  { id: 'overview', label: 'Overview', icon: MapPin },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'relations', label: 'Relations', icon: GitBranch },
  { id: 'raw', label: 'Raw Data', icon: Code2 },
]

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<EntityDetailCardRootProps> = ({
  entity,
  initialTab = 'overview',
  onClose,
  compact = false,
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabContentRef = useRef<HTMLDivElement>(null)

  // XState machine for tab management
  const [state, send] = useMachine(entityDetailMachine, {
    input: {
      initialTab,
      entityId: entity.entityId,
    },
  })

  const { activeTab, isExpanded, animationPhase, isLoading } = state.context

  // Update entity ID when entity changes
  useEffect(() => {
    send({ type: 'SET_ENTITY', entityId: entity.entityId })
  }, [entity.entityId, send])

  // Enter animation on mount
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [])

  // Tab content animation based on animation phase
  useEffect(() => {
    if (!tabContentRef.current) return

    if (animationPhase === 'exit') {
      animate(tabContentRef.current, {
        opacity: [1, 0],
        translateX: [0, -10],
        duration: 150,
        easing: EASING.anime.out,
      })
    } else if (animationPhase === 'enter') {
      animate(tabContentRef.current, {
        opacity: [0, 1],
        translateX: [10, 0],
        duration: 200,
        easing: EASING.anime.out,
      })
    }
  }, [animationPhase])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        send({ type: 'KEYBOARD', key: e.key as 'ArrowLeft' | 'ArrowRight' })
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        send({ type: 'KEYBOARD', key: e.key as '1' | '2' | '3' | '4' })
      } else if (e.key === 'Escape' && isExpanded) {
        send({ type: 'TOGGLE_EXPAND' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send, isExpanded])

  // Setters that dispatch to machine
  const setActiveTab = useCallback(
    (tab: DetailTab) => {
      send({ type: 'TAB_CHANGE', tab })
    },
    [send]
  )

  const toggleExpanded = useCallback(() => {
    send({ type: 'TOGGLE_EXPAND' })
  }, [send])

  const handleClose = useCallback(() => {
    send({ type: 'CLOSE' })
    onClose?.()
  }, [send, onClose])

  const contextValue: EntityDetailContextValue = useMemo(
    () => ({
      entity,
      activeTab,
      setActiveTab,
      onClose: handleClose,
      isExpanded,
      toggleExpanded,
      compact,
    }),
    [entity, activeTab, setActiveTab, handleClose, isExpanded, toggleExpanded, compact]
  )

  return (
    <EntityDetailContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          isExpanded && 'fixed inset-4 z-50 shadow-2xl',
          className
        )}
        data-loading={isLoading || undefined}
        data-animation-phase={animationPhase}
      >
        <div ref={tabContentRef} className="flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </div>
    </EntityDetailContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Show expand button */
  showExpand?: boolean
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({
  showExpand = true,
  className,
}) {
  const { entity, onClose, isExpanded, toggleExpanded, compact } = useEntityDetail()
  const headerRef = useRef<HTMLDivElement>(null)

  const nameTrait = getTrait(entity, 'Nameable')
  const identTrait = getTrait(entity, 'Identifiable')
  const sourceTrait = getTrait(entity, 'Sourceable')
  const classTrait = getTrait(entity, 'Classifiable')

  const name = nameTrait?.name ?? identTrait?.primaryId ?? entity.entityId
  const source = sourceTrait?.source as IntelSource | undefined
  const classification = classTrait?.classification as Classification | undefined

  const sourceColors = source ? SOURCE_COLORS[source] : null
  const classColors = classification ? CLASSIFICATION_COLORS[classification] : null

  return (
    <div
      ref={headerRef}
      className={cn(
        'flex items-start justify-between gap-3 p-4 border-b border-border-subtle',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        {/* Source badge */}
        {source && sourceColors && (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono uppercase mb-2',
              sourceColors.tailwind.bg,
              sourceColors.tailwind.primary
            )}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: sourceColors.primary }}
            />
            {source}
          </div>
        )}

        {/* Entity name */}
        <h2 className={cn(
          'font-semibold text-text-primary truncate',
          compact ? 'text-base' : 'text-lg'
        )}>
          {name}
        </h2>

        {/* Secondary identifiers */}
        {identTrait?.secondaryIds && Object.keys(identTrait.secondaryIds).length > 0 && (
          <p className="text-xs text-text-tertiary font-mono mt-0.5 truncate">
            {Object.values(identTrait.secondaryIds).join(' | ')}
          </p>
        )}

        {/* Classification badge */}
        {classification && classColors && (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium uppercase mt-2',
              classColors.tailwind.bg,
              classColors.tailwind.text
            )}
          >
            {classification === 'hostile' ? (
              <AlertTriangle className="w-3 h-3" />
            ) : classification === 'friendly' ? (
              <CheckCircle className="w-3 h-3" />
            ) : null}
            {classification}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {showExpand && (
          <button
            onClick={toggleExpanded}
            className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// TAB NAV COMPONENT
// =============================================================================

export interface TabNavProps {
  /** Additional class */
  className?: string
}

const TabNav: FC<TabNavProps> = memo(function TabNav({ className }) {
  const { activeTab, setActiveTab, compact } = useEntityDetail()
  const navRef = useRef<HTMLDivElement>(null)

  // Animate tab indicator
  useEffect(() => {
    if (navRef.current) {
      const activeButton = navRef.current.querySelector(`[data-tab="${activeTab}"]`)
      const indicator = navRef.current.querySelector('[data-indicator]') as HTMLElement
      if (activeButton && indicator) {
        const rect = activeButton.getBoundingClientRect()
        const navRect = navRef.current.getBoundingClientRect()
        animate(indicator, {
          left: rect.left - navRect.left,
          width: rect.width,
          duration: TIMING.fast,
          easing: EASING.anime.out,
        })
      }
    }
  }, [activeTab])

  return (
    <div
      ref={navRef}
      className={cn(
        'relative flex border-b border-border-subtle',
        className
      )}
    >
      {/* Animated indicator */}
      <div
        data-indicator
        className="absolute bottom-0 h-0.5 bg-accent-primary transition-none"
        style={{ left: 0, width: 0 }}
      />

      {TAB_CONFIG.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'text-accent-primary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2/50'
            )}
          >
            <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            {!compact && <span>{tab.label}</span>}
          </button>
        )
      })}
    </div>
  )
})

// =============================================================================
// OVERVIEW TAB
// =============================================================================

export interface OverviewProps {
  /** Attributes to display */
  attributes?: readonly EntityAttribute[]
  /** Show minimap */
  showMinimap?: boolean
  /** Additional class */
  className?: string
}

const Overview: FC<OverviewProps> = memo(function Overview({
  attributes = [],
  showMinimap = true,
  className,
}) {
  const { entity, activeTab, compact } = useEntityDetail()
  const contentRef = useRef<HTMLDivElement>(null)

  // Get location from entity
  const posTrait = getTrait(entity, 'Positionable')
  const hasLocation = posTrait?._trait === 'Positionable' && posTrait.position != null

  // Animate content on tab change
  useEffect(() => {
    if (activeTab === 'overview' && contentRef.current) {
      const children = Array.from(contentRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          translateY: [10, 0],
          delay: i * 50,
          duration: TIMING.normal,
          easing: EASING.anime.out,
        })
      })
    }
  }, [activeTab])

  if (activeTab !== 'overview') return null

  return (
    <div
      ref={contentRef}
      className={cn('flex-1 p-4 space-y-4 overflow-y-auto', className)}
    >
      {/* Location minimap placeholder */}
      {showMinimap && hasLocation && (
        <div className="bg-surface-2 rounded-lg p-3 border border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-tertiary uppercase font-mono">Location</span>
            <button className="text-xs text-accent-primary hover:underline">
              Fly to
            </button>
          </div>
          <div className="h-24 bg-surface-3 rounded flex items-center justify-center text-text-tertiary text-sm">
            {/* Minimap would render here */}
            <MapPin className="w-6 h-6 mr-2" />
            {posTrait?.position?.[1].toFixed(4)}, {posTrait?.position?.[0].toFixed(4)}
          </div>
        </div>
      )}

      {/* Attributes grid */}
      {attributes.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-text-tertiary uppercase font-mono">Attributes</span>
          <div className={cn(
            'grid gap-2',
            compact ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {attributes.map((attr, i) => (
              <AttributeRow key={i} attribute={attr} />
            ))}
          </div>
        </div>
      )}

      {/* Default attributes from traits */}
      <TraitAttributes entity={entity} />
    </div>
  )
})

// =============================================================================
// ATTRIBUTE ROW COMPONENT
// =============================================================================

const AttributeRow: FC<{ attribute: EntityAttribute }> = ({ attribute }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(String(attribute.value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatValue = () => {
    switch (attribute.type) {
      case 'date':
        return new Date(attribute.value as string).toLocaleString()
      case 'coordinate':
        return typeof attribute.value === 'number'
          ? attribute.value.toFixed(6)
          : attribute.value
      case 'number':
        return typeof attribute.value === 'number'
          ? attribute.value.toLocaleString()
          : attribute.value
      default:
        return String(attribute.value)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-surface-2 rounded text-sm">
      <span className="text-text-tertiary truncate">{attribute.label}</span>
      <div className="flex items-center gap-1">
        <span className="text-text-primary font-mono truncate max-w-[150px]">
          {formatValue()}
        </span>
        {attribute.copyable && (
          <button
            onClick={handleCopy}
            className="p-0.5 hover:bg-surface-3 rounded"
            title="Copy"
          >
            {copied ? (
              <CheckCircle className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-text-tertiary" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// TRAIT ATTRIBUTES
// =============================================================================

const TraitAttributes: FC<{ entity: ComposedEntity }> = ({ entity }) => {
  const attributes: EntityAttribute[] = []

  // Extract attributes from various traits
  const temporal = getTrait(entity, 'Temporal')
  if (temporal?.timestamp != null) {
    attributes.push({
      label: 'Observed',
      value: new Date(temporal.timestamp).toISOString(),
      type: 'date',
    })
  }

  const positionable = getTrait(entity, 'Positionable')
  if (positionable?.position) {
    attributes.push({
      label: 'Latitude',
      value: positionable.position[1],
      type: 'coordinate',
      copyable: true,
    })
    attributes.push({
      label: 'Longitude',
      value: positionable.position[0],
      type: 'coordinate',
      copyable: true,
    })
    if (positionable.altitude != null) {
      attributes.push({
        label: 'Altitude',
        value: `${positionable.altitude}m`,
        type: 'text',
      })
    }
  }

  const trackable = getTrait(entity, 'Trackable')
  if (trackable?.speed != null) {
    attributes.push({
      label: 'Speed',
      value: `${trackable.speed.toFixed(1)} m/s`,
      type: 'text',
    })
  }
  if (trackable?.heading != null) {
    attributes.push({
      label: 'Heading',
      value: `${trackable.heading.toFixed(0)}°`,
      type: 'text',
    })
  }

  if (attributes.length === 0) return null

  return (
    <div className="space-y-2">
      <span className="text-xs text-text-tertiary uppercase font-mono">Properties</span>
      <div className="grid grid-cols-2 gap-2">
        {attributes.map((attr, i) => (
          <AttributeRow key={i} attribute={attr} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// HISTORY TAB
// =============================================================================

export interface HistoryProps {
  /** Events to display */
  events?: readonly EntityEvent[]
  /** Additional class */
  className?: string
}

const History: FC<HistoryProps> = memo(function History({
  events = [],
  className,
}) {
  const { activeTab } = useEntityDetail()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'history' && listRef.current) {
      const children = Array.from(listRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          translateX: [-10, 0],
          delay: i * 30,
          duration: TIMING.normal,
          easing: EASING.anime.out,
        })
      })
    }
  }, [activeTab])

  if (activeTab !== 'history') return null

  const eventTypeConfig: Record<EntityEvent['type'], { icon: typeof Clock; color: string }> = {
    created: { icon: CheckCircle, color: 'text-green-500' },
    updated: { icon: Clock, color: 'text-blue-500' },
    moved: { icon: MapPin, color: 'text-cyan-500' },
    alert: { icon: AlertTriangle, color: 'text-yellow-500' },
    linked: { icon: GitBranch, color: 'text-purple-500' },
  }

  return (
    <div className={cn('flex-1 p-4 overflow-y-auto', className)}>
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
          <Clock className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No history available</p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-1">
          {events.map((event) => {
            const config = eventTypeConfig[event.type]
            const Icon = config.icon

            return (
              <div
                key={event.id}
                className="flex gap-3 p-2 hover:bg-surface-2 rounded transition-colors"
              >
                <div className={cn('p-1 rounded', config.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{event.description}</p>
                  <p className="text-xs text-text-tertiary">
                    {event.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// RELATIONS TAB
// =============================================================================

export interface RelationsProps {
  /** Relations to display */
  relations?: readonly EntityRelation[]
  /** Click handler */
  onRelationClick?: (relation: EntityRelation) => void
  /** Additional class */
  className?: string
}

const Relations: FC<RelationsProps> = memo(function Relations({
  relations = [],
  onRelationClick,
  className,
}) {
  const { activeTab } = useEntityDetail()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'relations' && listRef.current) {
      const children = Array.from(listRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          scale: [0.95, 1],
          delay: i * 40,
          duration: TIMING.normal,
          easing: EASING.anime.out,
        })
      })
    }
  }, [activeTab])

  if (activeTab !== 'relations') return null

  const relationTypeConfig: Record<EntityRelation['relationType'], { color: string; label: string }> = {
    parent: { color: 'border-blue-500', label: 'Parent' },
    child: { color: 'border-green-500', label: 'Child' },
    sibling: { color: 'border-cyan-500', label: 'Sibling' },
    linked: { color: 'border-purple-500', label: 'Linked' },
    proximity: { color: 'border-yellow-500', label: 'Proximity' },
  }

  return (
    <div className={cn('flex-1 p-4 overflow-y-auto', className)}>
      {relations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-text-tertiary">
          <GitBranch className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No relations found</p>
        </div>
      ) : (
        <div ref={listRef} className="grid gap-2">
          {relations.map((relation) => {
            const config = relationTypeConfig[relation.relationType]

            return (
              <button
                key={relation.id}
                onClick={() => onRelationClick?.(relation)}
                className={cn(
                  'flex items-center gap-3 p-3 bg-surface-2 rounded-lg border-l-2 text-left',
                  'hover:bg-surface-3 transition-colors',
                  config.color
                )}
              >
                <GitBranch className="w-4 h-4 text-text-tertiary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {relation.entityLabel}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {config.label}
                    {relation.confidence != null && (
                      <span className="ml-2">
                        ({(relation.confidence * 100).toFixed(0)}% confidence)
                      </span>
                    )}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-text-tertiary -rotate-90" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// RAW DATA TAB
// =============================================================================

export interface RawDataProps {
  /** Additional data to include */
  additionalData?: Record<string, unknown>
  /** Additional class */
  className?: string
}

const RawData: FC<RawDataProps> = memo(function RawData({
  additionalData,
  className,
}) {
  const { entity, activeTab } = useEntityDetail()
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLPreElement>(null)

  // Combine entity with additional data
  const data = {
    entityId: entity.entityId,
    traits: entity.traits,
    ...additionalData,
  }

  const jsonString = JSON.stringify(data, null, 2)

  useEffect(() => {
    if (activeTab === 'raw' && codeRef.current) {
      animate(codeRef.current, {
        opacity: [0, 1],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [activeTab])

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (activeTab !== 'raw') return null

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
        <span className="text-xs text-text-tertiary font-mono">JSON</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-surface-2 transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-text-tertiary" />
              <span className="text-text-tertiary">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre
        ref={codeRef}
        className="flex-1 p-4 overflow-auto text-xs font-mono text-text-secondary bg-surface-2/50"
      >
        {jsonString}
      </pre>
    </div>
  )
})

// =============================================================================
// ACTION BAR COMPONENT
// =============================================================================

export interface ActionBarProps {
  /** Custom actions */
  actions?: readonly ActionConfig[]
  /** Additional class */
  className?: string
}

interface ActionConfig {
  id: string
  label: string
  icon: typeof Bell
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}

const ActionBar: FC<ActionBarProps> = memo(function ActionBar({
  actions = [],
  className,
}) {
  const { entity, compact } = useEntityDetail()
  const barRef = useRef<HTMLDivElement>(null)

  // Default actions
  const defaultActions: ActionConfig[] = [
    {
      id: 'track',
      label: 'Track',
      icon: Crosshair,
      onClick: () => console.log('Track:', entity.entityId),
      variant: 'primary',
    },
    {
      id: 'alert',
      label: 'Alert',
      icon: Bell,
      onClick: () => console.log('Alert:', entity.entityId),
    },
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => console.log('Export:', entity.entityId),
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      onClick: () => console.log('Compare:', entity.entityId),
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      onClick: () => console.log('Share:', entity.entityId),
    },
  ]

  const allActions = actions.length > 0 ? actions : defaultActions

  useEffect(() => {
    if (barRef.current) {
      const buttons = Array.from(barRef.current.querySelectorAll('button'))
      buttons.forEach((btn, i) => {
        animate(btn, {
          opacity: [0, 1],
          translateY: [5, 0],
          delay: i * 30,
          duration: TIMING.fast,
          easing: EASING.anime.out,
        })
      })
    }
  }, [])

  const variantStyles = {
    default: 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
    primary: 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
  }

  return (
    <div
      ref={barRef}
      className={cn(
        'flex items-center gap-1 p-3 border-t border-border-subtle bg-surface-0',
        className
      )}
    >
      {allActions.slice(0, compact ? 3 : 5).map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              variantStyles[action.variant ?? 'default'],
              action.disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={action.label}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span>{action.label}</span>}
          </button>
        )
      })}

      {allActions.length > (compact ? 3 : 5) && (
        <button
          className="p-1.5 rounded hover:bg-surface-2 text-text-tertiary"
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const EntityDetailCard = Object.assign(Root, {
  Root,
  Header,
  TabNav,
  Overview,
  History,
  Relations,
  RawData,
  ActionBar,
})

// Named exports
export {
  Root as EntityDetailCardRoot,
  Header as EntityDetailCardHeader,
  TabNav as EntityDetailCardTabNav,
  Overview as EntityDetailCardOverview,
  History as EntityDetailCardHistory,
  Relations as EntityDetailCardRelations,
  RawData as EntityDetailCardRawData,
  ActionBar as EntityDetailCardActionBar,
}

export default EntityDetailCard
