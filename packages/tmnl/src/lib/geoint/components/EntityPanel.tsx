/**
 * GEOINT Entity Panel
 *
 * Floating panel for entity-centric views with:
 * - Tabbed multi-entity display
 * - Diff view for comparing entities
 * - Linked brushing (hover/select sync)
 * - Integration with card DI system
 *
 * Uses existing FloatingPanel infrastructure from lib/floating.
 *
 * @module geoint/components/EntityPanel
 */

import { FC, useMemo, useState, createContext, useContext } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom'
import { registerPanelType, openRegisteredPanel, getPanelProps } from '@/lib/floating/PanelRegistry'
import type { SearchResultItem } from '../schemas'
import type { ComposedEntity } from '../cards/traits'
import { searchResultToEntity, type RenderContext } from '../cards/registry'
import { useCardSlots, useEntityActions, useActionExecutor } from '../cards/hooks'
import { getTrait } from '../cards/traits'
import { selectedResultAtom, hoveredResultAtom } from '../atoms'
import { SOURCE_COLORS, CLASSIFICATION_COLORS } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export type EntityPanelMode = 'single' | 'tabbed' | 'diff' | 'spatial'

export interface EntityPanelState {
  /** Current display mode */
  mode: EntityPanelMode
  /** Entity IDs currently in panel */
  entityIds: readonly string[]
  /** Active tab index (for tabbed mode) */
  activeTab: number
  /** Linked brushing enabled */
  linkedBrushing: boolean
  /** Show diff overlay (for diff mode) */
  showDiff: boolean
}

export interface EntityPanelContextValue {
  state: EntityPanelState
  setMode: (mode: EntityPanelMode) => void
  addEntity: (entity: ComposedEntity) => void
  removeEntity: (entityId: string) => void
  setActiveTab: (index: number) => void
  toggleLinkedBrushing: () => void
  toggleDiff: () => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const EntityPanelContext = createContext<EntityPanelContextValue | null>(null)

export const useEntityPanel = () => {
  const ctx = useContext(EntityPanelContext)
  if (!ctx) throw new Error('useEntityPanel must be used within EntityPanelProvider')
  return ctx
}

// =============================================================================
// ATOMS
// =============================================================================

/** Entity panel state atom */
export const entityPanelStateAtom = Atom.make<EntityPanelState>({
  mode: 'single',
  entityIds: [],
  activeTab: 0,
  linkedBrushing: true,
  showDiff: false,
})

/** Entities map - keyed by entityId */
export const panelEntitiesAtom = Atom.make<Map<string, ComposedEntity>>(new Map())

// =============================================================================
// PANEL COMPONENTS
// =============================================================================

/**
 * Tab button for tabbed mode.
 */
const TabButton: FC<{
  entity: ComposedEntity
  isActive: boolean
  onClick: () => void
  onClose: () => void
}> = ({ entity, isActive, onClick, onClose }) => {
  const nameTrait = getTrait(entity, 'Nameable')
  const identTrait = getTrait(entity, 'Identifiable')
  const sourceTrait = getTrait(entity, 'Sourceable')

  const label = nameTrait?.name ?? identTrait?.primaryId ?? entity.entityId.split(':')[1]
  const sourceColor = sourceTrait ? SOURCE_COLORS[sourceTrait.source]?.primary : '#6b7280'

  return (
    <button
      className={`
        flex items-center gap-2 px-3 py-1.5 text-xs font-mono
        border-b-2 transition-colors
        ${isActive
          ? 'border-accent-cyan text-foreground-primary bg-surface-2'
          : 'border-transparent text-foreground-tertiary hover:text-foreground-secondary hover:bg-surface-2/50'
        }
      `}
      onClick={onClick}
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: sourceColor }}
      />
      <span className="truncate max-w-[120px]">{label}</span>
      <button
        className="p-0.5 hover:bg-surface-3 rounded"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </button>
  )
}

/**
 * Entity card view using the DI card system.
 */
const EntityCardView: FC<{
  entity: ComposedEntity
  renderContext: RenderContext
  isSelected: boolean
  isHovered: boolean
}> = ({ entity, renderContext, isSelected, isHovered }) => {
  const slots = useCardSlots(entity, renderContext, isSelected, isHovered)
  const actions = useEntityActions(entity)
  const executeAction = useActionExecutor()

  const sourceTrait = getTrait(entity, 'Sourceable')
  const classTrait = getTrait(entity, 'Classifiable')

  const sourceColor = sourceTrait ? SOURCE_COLORS[sourceTrait.source] : null
  const classColor = classTrait ? CLASSIFICATION_COLORS[classTrait.classification] : null

  return (
    <div
      className={`
        flex flex-col h-full
        ${isSelected ? 'ring-2 ring-accent-cyan' : ''}
      `}
      style={{
        borderLeft: sourceColor ? `3px solid ${sourceColor.primary}` : undefined,
      }}
    >
      {/* Header with source indicator */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-3 bg-surface-2">
        {slots.header}
        <div className="flex-1 min-w-0">
          {slots.title || (
            <span className="text-sm font-medium text-foreground-secondary">
              {entity.entityId}
            </span>
          )}
          {slots.subtitle && (
            <div className="text-xs text-foreground-tertiary">{slots.subtitle}</div>
          )}
        </div>
        {slots.badge}
      </div>

      {/* Classification badge */}
      {classColor && (
        <div
          className="px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: classColor.muted, color: classColor.primary }}
        >
          {classTrait?.classification.toUpperCase()}
        </div>
      )}

      {/* Preview/Image */}
      {slots.preview && (
        <div className="border-b border-surface-3">
          {slots.preview}
        </div>
      )}

      {/* Mini-map */}
      {slots.minimap && (
        <div className="border-b border-surface-3">
          {slots.minimap}
        </div>
      )}

      {/* Metadata */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-1">
        {slots.metadata}
        {slots.content}
      </div>

      {/* Timeline */}
      {slots.timeline && (
        <div className="border-t border-surface-3 px-3 py-2">
          {slots.timeline}
        </div>
      )}

      {/* Footer/Tags */}
      {slots.footer && (
        <div className="border-t border-surface-3 px-3 py-2">
          {slots.footer}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-surface-3 bg-surface-2">
        {actions.slice(0, 5).map((action) => (
          <button
            key={action.id}
            className={`
              px-2 py-1 text-xs rounded transition-colors
              ${action.group === 'danger'
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-surface-3 text-foreground-secondary hover:bg-surface-4'
              }
            `}
            onClick={() => executeAction(action, entity)}
            disabled={action.isEnabled && !action.isEnabled(entity)}
            title={action.description}
          >
            {action.hotkey && (
              <span className="opacity-50 mr-1">{action.hotkey}</span>
            )}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Diff view comparing two entities.
 */
const DiffView: FC<{
  entityA: ComposedEntity
  entityB: ComposedEntity
}> = ({ entityA, entityB }) => {
  const traitsA = Array.from(entityA.traits.entries())
  const traitsB = Array.from(entityB.traits.entries())

  const allTraitNames = new Set([
    ...traitsA.map(([k]) => k),
    ...traitsB.map(([k]) => k),
  ])

  return (
    <div className="grid grid-cols-2 gap-px bg-surface-3 h-full overflow-auto">
      {/* Entity A */}
      <div className="bg-surface-1">
        <div className="px-3 py-2 bg-surface-2 border-b border-surface-3 font-mono text-xs">
          {entityA.entityId}
        </div>
        <div className="p-3 space-y-2">
          {Array.from(allTraitNames).map((traitName) => {
            const traitA = entityA.traits.get(traitName)
            const traitB = entityB.traits.get(traitName)
            const isDifferent = JSON.stringify(traitA) !== JSON.stringify(traitB)
            const hasA = traitA !== undefined
            const hasB = traitB !== undefined

            return (
              <div
                key={traitName}
                className={`
                  p-2 rounded text-xs
                  ${!hasA ? 'bg-red-500/10 text-foreground-tertiary' : ''}
                  ${hasA && !hasB ? 'bg-green-500/10' : ''}
                  ${isDifferent && hasA && hasB ? 'bg-yellow-500/10' : ''}
                `}
              >
                <div className="font-medium text-foreground-secondary mb-1">
                  {traitName}
                  {!hasA && <span className="ml-2 text-red-400">(missing)</span>}
                  {hasA && !hasB && <span className="ml-2 text-green-400">(unique)</span>}
                </div>
                {hasA && (
                  <pre className="text-foreground-tertiary overflow-x-auto">
                    {JSON.stringify(traitA, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Entity B */}
      <div className="bg-surface-1">
        <div className="px-3 py-2 bg-surface-2 border-b border-surface-3 font-mono text-xs">
          {entityB.entityId}
        </div>
        <div className="p-3 space-y-2">
          {Array.from(allTraitNames).map((traitName) => {
            const traitA = entityA.traits.get(traitName)
            const traitB = entityB.traits.get(traitName)
            const isDifferent = JSON.stringify(traitA) !== JSON.stringify(traitB)
            const hasA = traitA !== undefined
            const hasB = traitB !== undefined

            return (
              <div
                key={traitName}
                className={`
                  p-2 rounded text-xs
                  ${!hasB ? 'bg-red-500/10 text-foreground-tertiary' : ''}
                  ${hasB && !hasA ? 'bg-green-500/10' : ''}
                  ${isDifferent && hasA && hasB ? 'bg-yellow-500/10' : ''}
                `}
              >
                <div className="font-medium text-foreground-secondary mb-1">
                  {traitName}
                  {!hasB && <span className="ml-2 text-red-400">(missing)</span>}
                  {hasB && !hasA && <span className="ml-2 text-green-400">(unique)</span>}
                </div>
                {hasB && (
                  <pre className="text-foreground-tertiary overflow-x-auto">
                    {JSON.stringify(traitB, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Spatial arrangement view - grid layout.
 */
const SpatialView: FC<{
  entities: readonly ComposedEntity[]
  selectedId: string | null
  hoveredId: string | null
}> = ({ entities, selectedId, hoveredId }) => {
  const cols = Math.ceil(Math.sqrt(entities.length))

  return (
    <div
      className="grid gap-2 p-2 h-full overflow-auto"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(200px, 1fr))`,
      }}
    >
      {entities.map((entity) => (
        <div
          key={entity.entityId}
          className="border border-surface-3 rounded overflow-hidden min-h-[200px]"
        >
          <EntityCardView
            entity={entity}
            renderContext="panel"
            isSelected={entity.entityId === selectedId}
            isHovered={entity.entityId === hoveredId}
          />
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// MAIN PANEL CONTENT
// =============================================================================

interface EntityPanelContentProps {
  panelId: string
}

/**
 * Entity panel content - registered with FloatingPanel system.
 */
export const EntityPanelContent: FC<EntityPanelContentProps> = ({ panelId }) => {
  const [state, setState] = useState<EntityPanelState>({
    mode: 'single',
    entityIds: [],
    activeTab: 0,
    linkedBrushing: true,
    showDiff: false,
  })

  const [entities, setEntities] = useState<Map<string, ComposedEntity>>(new Map())

  // Get selected/hovered from global state for linked brushing
  const selectedResult = useAtomValue(selectedResultAtom)
  const hoveredResult = useAtomValue(hoveredResultAtom)

  const selectedEntity = selectedResult ? searchResultToEntity(selectedResult) : null
  const hoveredEntity = hoveredResult ? searchResultToEntity(hoveredResult) : null

  const selectedId = selectedEntity?.entityId ?? null
  const hoveredId = hoveredEntity?.entityId ?? null

  // Initialize with props if provided
  const props = getPanelProps<{ entities?: ComposedEntity[] }>(panelId)
  useMemo(() => {
    if (props?.entities) {
      const newEntities = new Map<string, ComposedEntity>()
      props.entities.forEach((e) => newEntities.set(e.entityId, e))
      setEntities(newEntities)
      setState((s) => ({
        ...s,
        entityIds: props.entities!.map((e) => e.entityId),
      }))
    }
  }, [props?.entities])

  // Context value
  const contextValue: EntityPanelContextValue = {
    state,
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    addEntity: (entity) => {
      setEntities((prev) => new Map(prev).set(entity.entityId, entity))
      setState((s) => ({
        ...s,
        entityIds: [...s.entityIds, entity.entityId],
      }))
    },
    removeEntity: (entityId) => {
      setEntities((prev) => {
        const next = new Map(prev)
        next.delete(entityId)
        return next
      })
      setState((s) => ({
        ...s,
        entityIds: s.entityIds.filter((id) => id !== entityId),
        activeTab: Math.min(s.activeTab, s.entityIds.length - 2),
      }))
    },
    setActiveTab: (index) => setState((s) => ({ ...s, activeTab: index })),
    toggleLinkedBrushing: () => setState((s) => ({ ...s, linkedBrushing: !s.linkedBrushing })),
    toggleDiff: () => setState((s) => ({ ...s, showDiff: !s.showDiff })),
  }

  const entityList = state.entityIds.map((id) => entities.get(id)).filter(Boolean) as ComposedEntity[]
  const activeEntity = entityList[state.activeTab]

  return (
    <EntityPanelContext.Provider value={contextValue}>
      <div className="flex flex-col h-full bg-surface-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1 bg-surface-2 border-b border-surface-3">
          <div className="flex items-center gap-1">
            {/* Mode buttons */}
            {(['single', 'tabbed', 'diff', 'spatial'] as EntityPanelMode[]).map((mode) => (
              <button
                key={mode}
                className={`
                  px-2 py-1 text-xs rounded transition-colors
                  ${state.mode === mode
                    ? 'bg-accent-cyan/20 text-accent-cyan'
                    : 'text-foreground-tertiary hover:bg-surface-3'
                  }
                `}
                onClick={() => contextValue.setMode(mode)}
                disabled={mode === 'diff' && entityList.length < 2}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Linked brushing toggle */}
            <button
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${state.linkedBrushing
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-foreground-tertiary hover:bg-surface-3'
                }
              `}
              onClick={contextValue.toggleLinkedBrushing}
              title="Toggle linked brushing"
            >
              🔗
            </button>

            {/* Entity count */}
            <span className="text-xs text-foreground-tertiary">
              {entityList.length} entities
            </span>
          </div>
        </div>

        {/* Tabs (for tabbed mode) */}
        {state.mode === 'tabbed' && entityList.length > 0 && (
          <div className="flex overflow-x-auto bg-surface-2 border-b border-surface-3">
            {entityList.map((entity, i) => (
              <TabButton
                key={entity.entityId}
                entity={entity}
                isActive={i === state.activeTab}
                onClick={() => contextValue.setActiveTab(i)}
                onClose={() => contextValue.removeEntity(entity.entityId)}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {state.mode === 'single' && activeEntity && (
            <EntityCardView
              entity={activeEntity}
              renderContext="panel"
              isSelected={state.linkedBrushing && activeEntity.entityId === selectedId}
              isHovered={state.linkedBrushing && activeEntity.entityId === hoveredId}
            />
          )}

          {state.mode === 'tabbed' && activeEntity && (
            <EntityCardView
              entity={activeEntity}
              renderContext="panel"
              isSelected={state.linkedBrushing && activeEntity.entityId === selectedId}
              isHovered={state.linkedBrushing && activeEntity.entityId === hoveredId}
            />
          )}

          {state.mode === 'diff' && entityList.length >= 2 && (
            <DiffView
              entityA={entityList[0]}
              entityB={entityList[1]}
            />
          )}

          {state.mode === 'spatial' && entityList.length > 0 && (
            <SpatialView
              entities={entityList}
              selectedId={state.linkedBrushing ? selectedId : null}
              hoveredId={state.linkedBrushing ? hoveredId : null}
            />
          )}

          {entityList.length === 0 && (
            <div className="flex items-center justify-center h-full text-foreground-tertiary text-sm">
              No entities selected. Ctrl+Click on map entities to add them.
            </div>
          )}
        </div>
      </div>
    </EntityPanelContext.Provider>
  )
}

// =============================================================================
// REGISTRATION
// =============================================================================

// Register with FloatingPanel system
registerPanelType({
  id: 'geoint-entity',
  title: 'Entity Details',
  component: EntityPanelContent,
  defaultDimensions: { width: 400, height: 600 },
  minDimensions: { width: 300, height: 400 },
  resizable: true,
  closable: true,
  minimizable: true,
})

/**
 * Open entity panel with initial entities.
 */
export const openEntityPanel = (entities?: ComposedEntity[]): string | null => {
  return openRegisteredPanel('geoint-entity', { entities })
}

/**
 * Open entity panel from search results.
 */
export const openEntityPanelFromResults = (results: readonly SearchResultItem[]): string | null => {
  const entities = results.map(searchResultToEntity)
  return openEntityPanel(entities)
}

export default EntityPanelContent
