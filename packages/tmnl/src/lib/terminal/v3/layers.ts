/**
 * Terminal v3 Layer Composition
 *
 * Provides fully composed layers for BlockTerminalService.
 * Consumers can use blockTerminalRuntimeAtom for Effect operations.
 */

import { Layer } from 'effect'
import { Atom } from '@effect-atom/atom'
import {
  AICoreService,
  SSEAdapter,
  ToolBridge,
} from '@/lib/ai-core'
import { MCPClientRegistry } from '@/lib/mcp/services'
import { TauriPtyService } from '../v2/services/TauriPtyService'
import { BlockTerminalService } from './services'

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Full BlockTerminalService layer with all dependencies.
 *
 * Composition:
 *   BlockTerminalService
 *   ├── AICoreService
 *   │   ├── SSEAdapter
 *   │   └── ToolBridge
 *   │       └── MCPClientRegistry
 *   └── TauriPtyService
 */
export const BlockTerminalLive = BlockTerminalService.Live.pipe(
  Layer.provide(
    Layer.mergeAll(
      // AICoreService with its dependencies
      AICoreService.Live.pipe(
        Layer.provide(SSEAdapter.Live),
        Layer.provide(
          ToolBridge.Live.pipe(Layer.provide(MCPClientRegistry.Live))
        )
      ),
      // PTY service
      TauriPtyService.Live
    )
  )
)

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Runtime atom for BlockTerminalService operations.
 *
 * @example
 * const executeAI = blockTerminalRuntimeAtom.fn<{ prompt: string }>()((args, ctx) =>
 *   Effect.gen(function* () {
 *     const service = yield* BlockTerminalService
 *     return yield* service.executeAIQuery(args)
 *   })
 * )
 */
export const blockTerminalRuntimeAtom = Atom.runtime(BlockTerminalLive)
