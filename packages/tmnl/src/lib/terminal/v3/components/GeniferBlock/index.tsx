/**
 * GeniferBlock Component
 *
 * Terminal block component for rendering rich UI via the genifer system.
 * Implements compound component pattern for flexible composition.
 *
 * @module terminal/v3/components/GeniferBlock
 */

'use client'

import {
  createContext,
  useContext,
  memo,
  type ReactNode,
  type ComponentType,
} from 'react'
import { cn } from '@/lib/utils'
import { Loader2, Layers, Box } from 'lucide-react'
import { Renderer, type ComponentRegistry } from '@/lib/genifer/react/renderer'
import type { UITree, Action } from '@/lib/genifer/core/schemas'
import type {
  GeniferBlockV3,
  SemanticRegionEntry,
} from '../../schemas/genifer-block'

// =============================================================================
// Context
// =============================================================================

interface GeniferBlockContextValue {
  block: GeniferBlockV3
  registry?: ComponentRegistry
  disableAnimations?: boolean
  onAction?: (action: Action) => void
}

const GeniferBlockContext = createContext<GeniferBlockContextValue | null>(null)

const useGeniferBlockContext = () => {
  const ctx = useContext(GeniferBlockContext)
  if (!ctx) {
    throw new Error('GeniferBlock.* components must be used within <GeniferBlock>')
  }
  return ctx
}

// =============================================================================
// Root Component
// =============================================================================

export interface GeniferBlockProps {
  /** The block to render */
  block: GeniferBlockV3
  /** Custom component registry (merged with catalog) */
  registry?: ComponentRegistry
  /** Disable entrance animations */
  disableAnimations?: boolean
  /** Action handler */
  onAction?: (action: Action) => void
  /** Additional CSS classes */
  className?: string
  /** Child compound components (optional - renders default if omitted) */
  children?: ReactNode
}

function GeniferBlockRoot({
  block,
  registry,
  disableAnimations = false,
  onAction,
  className,
  children,
}: GeniferBlockProps) {
  const hasTree = block.uiTree !== null
  const isStreaming = block.isStreaming

  return (
    <GeniferBlockContext.Provider
      value={{ block, registry, disableAnimations, onAction }}
    >
      <div
        data-testid="genifer-block"
        data-block-id={block.id}
        className={cn(
          'rounded-lg border border-cyan-500/20 bg-cyan-500/5',
          'transition-colors',
          isStreaming && 'border-cyan-500/30 bg-cyan-500/10',
          className
        )}
      >
        {children ?? (
          <>
            <Header />
            {isStreaming && !hasTree && <LoadingState />}
            {!isStreaming && !hasTree && <EmptyState />}
            {hasTree && <Content />}
            {block.semanticRegions.length > 0 && <SemanticRegions />}
          </>
        )}
      </div>
    </GeniferBlockContext.Provider>
  )
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  className?: string
  showStatus?: boolean
}

function Header({ className, showStatus = true }: HeaderProps) {
  const { block } = useGeniferBlockContext()

  return (
    <div
      data-testid="genifer-header"
      className={cn(
        'flex items-center justify-between px-4 py-2 border-b border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-cyan-400" />
        <span className="font-mono text-cyan-400" style={{ fontSize: '12px' }}>
          UI Component
        </span>
        {showStatus && block.isStreaming && (
          <span
            className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 animate-pulse flex items-center gap-1"
            style={{ fontSize: '10px' }}
            data-testid="genifer-streaming"
          >
            <Loader2 size={10} className="animate-spin" />
            streaming
          </span>
        )}
      </div>
      <span className="font-mono text-white/30" style={{ fontSize: '10px' }}>
        {block.id.slice(0, 12)}
      </span>
    </div>
  )
}

// =============================================================================
// Content Component
// =============================================================================

interface ContentProps {
  className?: string
  /** Custom fallback for unknown component types */
  fallback?: ComponentType<any>
}

function Content({ className, fallback }: ContentProps) {
  const { block, registry, disableAnimations, onAction } = useGeniferBlockContext()

  // Cast uiTree back to UITree (stored as unknown in schema)
  const tree = block.uiTree as UITree | null

  if (!tree) {
    return null
  }

  return (
    <div
      data-testid="genifer-content"
      className={cn('p-4', className)}
    >
      <Renderer
        tree={tree}
        registry={registry}
        loading={block.isStreaming}
        fallback={fallback}
        onAction={onAction}
        disableAnimations={disableAnimations}
      />
    </div>
  )
}

// =============================================================================
// Loading State Component
// =============================================================================

interface LoadingStateProps {
  className?: string
  message?: string
}

function LoadingState({ className, message = 'Generating UI...' }: LoadingStateProps) {
  return (
    <div
      data-testid="genifer-loading"
      className={cn(
        'p-6 flex flex-col items-center justify-center gap-3 text-cyan-400/70',
        className
      )}
    >
      <Loader2 size={24} className="animate-spin" />
      <span style={{ fontSize: '12px' }}>{message}</span>
    </div>
  )
}

// =============================================================================
// Empty State Component
// =============================================================================

interface EmptyStateProps {
  className?: string
  message?: string
}

function EmptyState({ className, message = 'No UI content' }: EmptyStateProps) {
  return (
    <div
      data-testid="genifer-empty"
      className={cn(
        'p-6 flex flex-col items-center justify-center gap-3 text-white/30',
        className
      )}
    >
      <Box size={24} />
      <span style={{ fontSize: '12px' }}>{message}</span>
    </div>
  )
}

// =============================================================================
// Semantic Regions Component
// =============================================================================

interface SemanticRegionsProps {
  className?: string
  defaultOpen?: boolean
}

function SemanticRegions({ className, defaultOpen = false }: SemanticRegionsProps) {
  const { block } = useGeniferBlockContext()
  const regions = block.semanticRegions

  if (regions.length === 0) {
    return null
  }

  return (
    <div
      data-testid="genifer-regions"
      className={cn(
        'px-4 py-2 border-t border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-white/50" style={{ fontSize: '10px' }}>
          Semantic Regions ({regions.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {regions.map((region: SemanticRegionEntry) => (
          <span
            key={region.id}
            className="px-2 py-0.5 rounded bg-white/5 text-white/60 font-mono"
            style={{ fontSize: '10px' }}
            title={`ID: ${region.id}${region.type ? ` | Type: ${region.type}` : ''}`}
          >
            {region.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Meta Component
// =============================================================================

interface MetaProps {
  className?: string
  showPatches?: boolean
  showTimestamp?: boolean
}

function Meta({
  className,
  showPatches = true,
  showTimestamp = true,
}: MetaProps) {
  const { block } = useGeniferBlockContext()

  return (
    <div
      data-testid="genifer-meta"
      className={cn(
        'px-4 py-2 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1',
        className
      )}
      style={{ fontSize: '10px' }}
    >
      {showTimestamp && (
        <span className="text-white/30 font-mono">
          {block.timestamp.toLocaleTimeString()}
        </span>
      )}
      {showPatches && (
        <span className="text-white/30 font-mono">
          patches: {block.patches.length}
        </span>
      )}
      <span
        className={cn(
          'font-mono',
          block.isStreaming ? 'text-cyan-400/70' : 'text-green-400/70'
        )}
      >
        {block.isStreaming ? 'streaming' : 'complete'}
      </span>
    </div>
  )
}

// =============================================================================
// Compound Component Export
// =============================================================================

export const GeniferBlock = Object.assign(memo(GeniferBlockRoot), {
  Header: memo(Header),
  Content: memo(Content),
  LoadingState: memo(LoadingState),
  EmptyState: memo(EmptyState),
  SemanticRegions: memo(SemanticRegions),
  Meta: memo(Meta),
})

// Named exports for tree-shaking
export { Header as GeniferBlockHeader }
export { Content as GeniferBlockContent }
export { LoadingState as GeniferBlockLoadingState }
export { EmptyState as GeniferBlockEmptyState }
export { SemanticRegions as GeniferBlockSemanticRegions }
export { Meta as GeniferBlockMeta }
