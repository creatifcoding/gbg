/**
 * JsonRenderBlock Component
 *
 * Terminal block component for rendering rich UI via the json-render system.
 * Implements compound component pattern for flexible composition.
 *
 * @module terminal/v3/components/JsonRenderBlock
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
import { Renderer, type ComponentRegistry } from '@/lib/json-render/react/renderer'
import type { UITree, Action } from '@/lib/json-render/core/schemas'
import type {
  JsonRenderBlockV3,
  SemanticRegionEntry,
} from '../../schemas/json-render-block'

// =============================================================================
// Context
// =============================================================================

interface JsonRenderBlockContextValue {
  block: JsonRenderBlockV3
  registry?: ComponentRegistry
  disableAnimations?: boolean
  onAction?: (action: Action) => void
}

const JsonRenderBlockContext = createContext<JsonRenderBlockContextValue | null>(null)

const useJsonRenderBlockContext = () => {
  const ctx = useContext(JsonRenderBlockContext)
  if (!ctx) {
    throw new Error('JsonRenderBlock.* components must be used within <JsonRenderBlock>')
  }
  return ctx
}

// =============================================================================
// Root Component
// =============================================================================

export interface JsonRenderBlockProps {
  /** The block to render */
  block: JsonRenderBlockV3
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

function JsonRenderBlockRoot({
  block,
  registry,
  disableAnimations = false,
  onAction,
  className,
  children,
}: JsonRenderBlockProps) {
  const hasTree = block.uiTree !== null
  const isStreaming = block.isStreaming

  return (
    <JsonRenderBlockContext.Provider
      value={{ block, registry, disableAnimations, onAction }}
    >
      <div
        data-testid="json-render-block"
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
    </JsonRenderBlockContext.Provider>
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
  const { block } = useJsonRenderBlockContext()

  return (
    <div
      data-testid="json-render-header"
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
            data-testid="json-render-streaming"
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
  const { block, registry, disableAnimations, onAction } = useJsonRenderBlockContext()

  // Cast uiTree back to UITree (stored as unknown in schema)
  const tree = block.uiTree as UITree | null

  if (!tree) {
    return null
  }

  return (
    <div
      data-testid="json-render-content"
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
      data-testid="json-render-loading"
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
      data-testid="json-render-empty"
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
  const { block } = useJsonRenderBlockContext()
  const regions = block.semanticRegions

  if (regions.length === 0) {
    return null
  }

  return (
    <div
      data-testid="json-render-regions"
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
  const { block } = useJsonRenderBlockContext()

  return (
    <div
      data-testid="json-render-meta"
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

export const JsonRenderBlock = Object.assign(memo(JsonRenderBlockRoot), {
  Header: memo(Header),
  Content: memo(Content),
  LoadingState: memo(LoadingState),
  EmptyState: memo(EmptyState),
  SemanticRegions: memo(SemanticRegions),
  Meta: memo(Meta),
})

// Named exports for tree-shaking
export { Header as JsonRenderBlockHeader }
export { Content as JsonRenderBlockContent }
export { LoadingState as JsonRenderBlockLoadingState }
export { EmptyState as JsonRenderBlockEmptyState }
export { SemanticRegions as JsonRenderBlockSemanticRegions }
export { Meta as JsonRenderBlockMeta }
