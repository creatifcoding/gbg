/**
 * Pi host adapter for metatool rendering.
 *
 * This is the only place the shared ms renderer should learn how Pi measures
 * ANSI text or highlights code. OMP gets its own adapter instead of inheriting
 * Pi package imports through shared render helpers.
 *
 * @module
 */

import { visibleWidth, truncateToWidth } from '@mariozechner/pi-tui'
import { highlightCode, type Theme } from '@mariozechner/pi-coding-agent'
import {
  createPrimitiveRegistry,
  registerAllPrimitives,
  type PrimitiveRegistry,
} from './primitives/index.ts'
import type { RenderContext, RendererTheme } from './render-core.ts'

export function createPiRenderContext(theme: Theme): RenderContext {
  return {
    theme: theme as unknown as RendererTheme,
    text: { visibleWidth, truncateToWidth },
    code: { highlight: highlightCode },
    keys: undefined,
  }
}

export function createPiPrimitiveRegistry(): PrimitiveRegistry {
  const registry = createPrimitiveRegistry()
  registerAllPrimitives(registry)
  return registry
}
