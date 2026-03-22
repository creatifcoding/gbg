/**
 * InlineUIRenderer — renders genifer UITree inline in the chat thread.
 *
 * Two modes:
 *   1. Streaming (ndjsonSource): Progressively parses NDJSON lines into a
 *      growing UITree. Each completed line adds an element. Re-renders as
 *      the tree grows — elements appear one-by-one as the model emits them.
 *   2. Completed (tree): Renders a pre-parsed UITree directly.
 *
 * Outputs bare UI components via BehaviorProvider + Renderer.
 * No card wrapper, no chrome, no header — just the actual UI inline.
 *
 * NDJSON wire format inside ```ui fence:
 *   {"root":"login-form"}
 *   {"key":"login-form","type":"form","props":{...},"children":["email-field"]}
 *   {"key":"email-field","type":"input","props":{"label":"Email"}}
 *
 * @module chat/msg/inline-ui-tree-card
 */

'use client'

import { memo, useMemo, type FC } from 'react'
import type { UITree } from '@/lib/genifer/core/schemas'
import { UIElement, UITree as UITreeClass } from '@/lib/genifer/core/schemas'
import { Renderer, DefaultFallback } from '@/lib/genifer/react/renderer'
import { BehaviorProvider } from '@/lib/genifer/react/BehaviorBridge'
import { getCatalogRenderers } from '@/lib/genifer/react/atoms/catalog'
import { SurfaceProvider } from '@/lib/genifer/catalog/context'

// =============================================================================
// NDJSON → UITree progressive parser
// =============================================================================

/**
 * Parse completed NDJSON lines into a UITree.
 * Skips unparseable/incomplete lines silently.
 * First object with `root` field sets the root key.
 * Objects with `key` + `type` are treated as element additions.
 */
function parseNdjsonToTree(source: string): UITree | null {
  const lines = source.split('\n')
  let root = ''
  const elements: Record<string, InstanceType<typeof UIElement>> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('{')) continue
    try {
      const obj = JSON.parse(trimmed)

      // Root declaration: { "root": "key" }
      if (typeof obj.root === 'string' && !obj.type) {
        root = obj.root
        continue
      }

      // Element addition: { "key": "x", "type": "y", "props": {...}, ... }
      if (typeof obj.type === 'string') {
        const key = typeof obj.key === 'string' ? obj.key : ''
        if (!key) continue
        elements[key] = new UIElement({
          type: obj.type,
          key,
          props: (obj.props && typeof obj.props === 'object' ? obj.props : {}) as Record<string, unknown>,
          children: Array.isArray(obj.children) ? obj.children.filter((c: unknown) => typeof c === 'string') : [],
          parentKey: typeof obj.parentKey === 'string' ? obj.parentKey : undefined,
          className: typeof obj.className === 'string' ? obj.className : undefined,
        })
      }
    } catch {
      // Incomplete line — skip, will complete on next delta
    }
  }

  if (!root || Object.keys(elements).length === 0) return null
  return UITreeClass.fromRecord(root, elements)
}

// =============================================================================
// Props
// =============================================================================

export interface InlineUITreeCardProps {
  /** Pre-parsed tree (completed UITreePart) */
  tree?: UITree
  /** Raw NDJSON source being streamed (from CodePart with language='ui') */
  ndjsonSource?: string
  /** Whether content is still streaming */
  isStreaming?: boolean
}

// =============================================================================
// Component
// =============================================================================

export const InlineUITreeCard: FC<InlineUITreeCardProps> = memo(({
  tree: completedTree,
  ndjsonSource,
  isStreaming,
}) => {
  // Progressive parse: recompute tree from NDJSON on each render (source grows with each delta)
  const streamingTree = useMemo(
    () => ndjsonSource ? parseNdjsonToTree(ndjsonSource) : null,
    [ndjsonSource],
  )

  const tree = completedTree ?? streamingTree
  if (!tree) return null

  // Use explicit registry from module-level catalog (not atom context).
  // InlineUITreeCard renders inside the morphchat registry scope, which
  // doesn't have the genifer CatalogComponents layer. The module-level
  // catalogRegistry is always initialized with coreDomainCatalog.
  const registry = getCatalogRenderers() as Record<string, any>

  return (
    <SurfaceProvider tier="inline">
      <BehaviorProvider tree={tree}>
        <Renderer
          tree={tree}
          registry={registry}
          loading={isStreaming}
          fallback={DefaultFallback}
          disableAnimations={isStreaming}
        />
      </BehaviorProvider>
    </SurfaceProvider>
  )
})

InlineUITreeCard.displayName = 'InlineUITreeCard'
