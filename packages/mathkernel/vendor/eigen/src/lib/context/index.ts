/**
 * Recontextualization System
 *
 * Dynamic context injection for agentic workflows using ZON (Zero Overhead Notation)
 * for token-efficient, machine-parseable metadata embedded in org-mode documents.
 *
 * @example React Provider Usage
 * ```tsx
 * import { RecontextProvider, useRecontext, useContextIndex } from '@/lib/context'
 *
 * function App() {
 *   return (
 *     <RecontextProvider indexPath="assets/documents/IDEA-MILL.org">
 *       <MyComponent />
 *     </RecontextProvider>
 *   )
 * }
 *
 * function MyComponent() {
 *   const { ops } = useRecontext()
 *   const index = useContextIndex()
 *
 *   useEffect(() => {
 *     ops.loadDomain('data-manager')
 *   }, [ops])
 *
 *   return <div>{index.map(entry => entry.id)}</div>
 * }
 * ```
 *
 * @example Effect-Atom Usage
 * ```tsx
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import { contextIndexAtom, recontextOpsAtom } from '@/lib/context'
 * import * as Result from 'effect/Result'
 *
 * function MyComponent() {
 *   const indexResult = useAtomValue(contextIndexAtom)
 *   const load = recontextOpsAtom.load
 *
 *   if (Result.isSuccess(indexResult)) {
 *     const index = indexResult.value
 *     // ...
 *   }
 * }
 * ```
 *
 * @module
 */

// ---------------------------------------------------------------------------
// ZON Parser
// ---------------------------------------------------------------------------

export {
  parseZonBlock,
  extractZonBlocks,
  extractContextEntries,
  serializeContextEntry,
  serializeContextTable,
  type ZonTable,
  type ZonBlock,
  type ContextEntry,
} from './zon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  LoadedContext,
  RecontextState,
  RecontextOps,
  SearchResult,
  RecontextConfig,
} from './types'

// ---------------------------------------------------------------------------
// React Provider & Hooks
// ---------------------------------------------------------------------------

export {
  RecontextProvider,
  useRecontext,
  useContextIndex,
  useLoadedContexts,
  useLoadedContext,
  useRecontextOps,
} from './ContextProvider'

// ---------------------------------------------------------------------------
// Effect-Atom Bindings
// ---------------------------------------------------------------------------

export {
  RecontextService,
  RecontextServiceLive,
  recontextRuntimeAtom,
  contextIndexAtom,
  loadedContextsAtom,
  lastRefreshAtom,
  recontextOpsAtom,
} from './atoms'
