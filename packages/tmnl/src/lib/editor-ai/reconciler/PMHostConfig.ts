/**
 * ProseMirror HostConfig for react-reconciler
 *
 * This module bridges React's reconciliation algorithm to ProseMirror's
 * document model. Instead of mutating DOM nodes, we build PM nodes and
 * queue operations that get applied as a single transaction in commit phase.
 *
 * Architecture:
 * - Render phase: Create Instance wrappers, queue operations
 * - Commit phase: Build PM transaction, apply atomically
 *
 * Key insight: We DON'T mutate the PM document during render. We build
 * a parallel tree of Instance wrappers, then diff and apply in commit.
 *
 * @module editor-ai/reconciler/PMHostConfig
 */

import type { HostConfig, OpaqueHandle } from 'react-reconciler'
import type { Node as PMNode, Mark, Schema as PMSchema } from '@tiptap/pm/model'
import type {
  Type,
  Props,
  Container,
  Instance,
  TextInstance,
  HostContext,
  PendingOperation,
} from './types'

// =============================================================================
// Operation Queue
// =============================================================================

/**
 * Operations queued during render phase, applied in commit.
 * This is module-level state (reset per reconciliation cycle).
 */
let pendingOperations: PendingOperation[] = []

/**
 * Clear pending operations (called at start of commit)
 */
const clearPendingOperations = (): PendingOperation[] => {
  const ops = pendingOperations
  pendingOperations = []
  return ops
}

/**
 * Queue an operation for commit phase
 */
const queueOperation = (op: PendingOperation): void => {
  pendingOperations.push(op)
}

// =============================================================================
// Node Creation Helpers
// =============================================================================

/**
 * Create a ProseMirror node from type and props.
 * Uses the schema from host context to ensure valid nodes.
 */
const createPMNode = (
  schema: PMSchema,
  type: Type,
  props: Props
): PMNode | null => {
  const nodeType = schema.nodes[type]
  if (!nodeType) {
    console.warn(`[PMHostConfig] Unknown node type: ${type}`)
    return null
  }

  // Text nodes are special - they have text content, not children
  if (type === 'text' && props.text) {
    return schema.text(props.text, props.marks ?? undefined)
  }

  // For container nodes, create with attrs (children added later)
  try {
    return nodeType.createAndFill(props.attrs ?? {})
  } catch (err) {
    console.warn(`[PMHostConfig] Failed to create node: ${type}`, err)
    return null
  }
}

/**
 * Create an Instance wrapper around a PM node
 */
const createInstance_ = (
  type: Type,
  props: Props,
  schema: PMSchema
): Instance | null => {
  const node = createPMNode(schema, type, props)
  if (!node) return null

  return {
    node,
    type,
    props,
    position: 0,
    children: [],
    parent: null,
  }
}

// =============================================================================
// HostConfig Implementation
// =============================================================================

/**
 * The HostConfig object defines how React interacts with ProseMirror.
 * This is a mutation-based renderer (supportsMutation: true).
 */
export const PMHostConfig: HostConfig<
  Type,           // Type
  Props,          // Props
  Container,      // Container
  Instance,       // Instance
  TextInstance,   // TextInstance
  unknown,        // SuspenseInstance
  unknown,        // HydratableInstance
  Instance,       // FormInstance
  Instance,       // PublicInstance
  HostContext,    // HostContext
  unknown,        // ChildSet (not used in mutation mode)
  number,         // TimeoutHandle
  number,         // NoTimeout
  null            // TransitionStatus
> = {
  // ===========================================================================
  // Configuration
  // ===========================================================================

  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,

  isPrimaryRenderer: false,
  warnsIfNotActing: false,

  // Scheduling
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,

  // Microtasks (React 18+)
  supportsMicrotasks: true,
  scheduleMicrotask:
    typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn) => Promise.resolve().then(fn),

  // ===========================================================================
  // Context
  // ===========================================================================

  getRootHostContext(rootContainer: Container): HostContext | null {
    return {
      schema: rootContainer.schema,
      parentType: 'doc',
      depth: 0,
    }
  },

  getChildHostContext(
    parentHostContext: HostContext,
    type: Type,
    _rootContainer: Container
  ): HostContext {
    return {
      schema: parentHostContext.schema,
      parentType: type,
      depth: parentHostContext.depth + 1,
    }
  },

  // ===========================================================================
  // Instance Creation (Render Phase)
  // ===========================================================================

  createInstance(
    type: Type,
    props: Props,
    rootContainer: Container,
    hostContext: HostContext,
    _internalHandle: OpaqueHandle
  ): Instance {
    const instance = createInstance_(type, props, hostContext.schema)
    if (!instance) {
      // Return a placeholder for invalid types
      return {
        node: rootContainer.schema.nodes.paragraph!.create(),
        type: 'paragraph',
        props: {},
        position: 0,
        children: [],
        parent: null,
      }
    }
    return instance
  },

  createTextInstance(
    text: string,
    _rootContainer: Container,
    _hostContext: HostContext,
    _internalHandle: OpaqueHandle
  ): TextInstance {
    return {
      text,
      position: 0,
      parent: null,
    }
  },

  appendInitialChild(parentInstance: Instance, child: Instance | TextInstance): void {
    // During initial render, just track parent-child relationship
    if ('node' in child) {
      child.parent = parentInstance
      parentInstance.children.push(child)
    } else {
      // TextInstance
      child.parent = parentInstance
    }
  },

  finalizeInitialChildren(
    _instance: Instance,
    _type: Type,
    _props: Props,
    _rootContainer: Container,
    _hostContext: HostContext
  ): boolean {
    // Return false - we don't need commitMount
    return false
  },

  shouldSetTextContent(_type: Type, _props: Props): boolean {
    // ProseMirror text nodes are explicit, not implicit
    return false
  },

  // ===========================================================================
  // Mutation Methods (Commit Phase)
  // ===========================================================================

  appendChild(parentInstance: Instance, child: Instance | TextInstance): void {
    queueOperation({
      type: 'appendChild',
      parent: parentInstance,
      child,
    })
  },

  appendChildToContainer(container: Container, child: Instance | TextInstance): void {
    // For root container, we queue a special operation
    // The commit phase will handle this by replacing doc content
    if ('node' in child) {
      queueOperation({
        type: 'appendChild',
        parent: {
          node: container.state.doc,
          type: 'doc',
          props: {},
          position: 0,
          children: [],
          parent: null,
        },
        child,
      })
    }
  },

  insertBefore(
    parentInstance: Instance,
    child: Instance | TextInstance,
    beforeChild: Instance | TextInstance
  ): void {
    queueOperation({
      type: 'insertBefore',
      parent: parentInstance,
      child,
      before: beforeChild,
    })
  },

  removeChild(parentInstance: Instance, child: Instance | TextInstance): void {
    queueOperation({
      type: 'removeChild',
      parent: parentInstance,
      child,
    })
  },

  removeChildFromContainer(container: Container, child: Instance | TextInstance): void {
    if ('node' in child) {
      queueOperation({
        type: 'removeChild',
        parent: {
          node: container.state.doc,
          type: 'doc',
          props: {},
          position: 0,
          children: [],
          parent: null,
        },
        child,
      })
    }
  },

  commitUpdate(
    instance: Instance,
    _type: Type,
    oldProps: Props,
    newProps: Props,
    _internalHandle: OpaqueHandle
  ): void {
    // Compare props to determine what changed
    const attrsChanged = !shallowEqual(oldProps.attrs, newProps.attrs)

    if (attrsChanged && newProps.attrs) {
      queueOperation({
        type: 'setNodeMarkup',
        instance,
        attrs: newProps.attrs,
      })
    }
  },

  commitTextUpdate(
    textInstance: TextInstance,
    _prevText: string,
    nextText: string
  ): void {
    queueOperation({
      type: 'updateText',
      instance: textInstance,
      text: nextText,
    })
  },

  // ===========================================================================
  // Commit Phase Lifecycle
  // ===========================================================================

  prepareForCommit(containerInfo: Container): Record<string, unknown> | null {
    // Start a new transaction
    containerInfo.transaction = containerInfo.state.tr
    return null
  },

  resetAfterCommit(containerInfo: Container): void {
    // Get queued operations
    const ops = clearPendingOperations()

    if (ops.length === 0) {
      containerInfo.transaction = null
      return
    }

    // Apply operations to transaction
    const tr = containerInfo.transaction
    if (!tr) {
      console.warn('[PMHostConfig] No transaction in resetAfterCommit')
      return
    }

    // Process operations and build the new document structure
    // This is where we'd apply the smart merge algorithm
    applyOperations(containerInfo, ops)

    // Dispatch the transaction
    if (tr.docChanged) {
      containerInfo.view.dispatch(tr)
    }

    containerInfo.transaction = null
  },

  clearContainer(container: Container): void {
    // Replace entire doc with empty content
    const tr = container.state.tr
    tr.delete(0, container.state.doc.content.size)
    container.view.dispatch(tr)
  },

  // ===========================================================================
  // Miscellaneous (mostly no-ops for our use case)
  // ===========================================================================

  getPublicInstance(instance: Instance): Instance {
    return instance
  },

  preparePortalMount(_containerInfo: Container): void {
    // No-op
  },

  beforeActiveInstanceBlur(): void {
    // No-op
  },

  afterActiveInstanceBlur(): void {
    // No-op
  },

  prepareScopeUpdate(_scopeInstance: unknown, _instance: Instance): void {
    // No-op
  },

  getInstanceFromScope(_scopeInstance: unknown): Instance | null {
    return null
  },

  detachDeletedInstance(_instance: Instance): void {
    // No-op - GC handles cleanup
  },

  // Hidden instance methods (for Suspense, not used)
  hideInstance(_instance: Instance): void {},
  hideTextInstance(_textInstance: TextInstance): void {},
  unhideInstance(_instance: Instance, _props: Props): void {},
  unhideTextInstance(_textInstance: TextInstance, _text: string): void {},

  // Resource methods (React 19+)
  requestPostPaintCallback(_callback: (time: number) => void): void {},
  maySuspendCommit(_type: Type, _props: Props): boolean {
    return false
  },
  preloadInstance(_type: Type, _props: Props): boolean {
    return true
  },
  startSuspendingCommit(): void {},
  suspendInstance(_type: Type, _props: Props): void {},
  waitForCommitToBeReady(): null {
    return null
  },

  // Set current update priority (React 18+)
  setCurrentUpdatePriority(_newPriority: number): void {},
  getCurrentUpdatePriority(): number {
    return 0
  },
  resolveUpdatePriority(): number {
    return 0
  },
  NotPendingTransition: null as unknown as null,
  resetFormInstance(_form: Instance): void {},

  // React 19 transition/scheduler methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getInstanceFromNode(_node: unknown): any {
    return undefined
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HostTransitionContext: null as any,
  shouldAttemptEagerTransition(): boolean {
    return false
  },
  trackSchedulerEvent(): void {},
  resolveEventType(): null | string {
    return null
  },
  resolveEventTimeStamp(): number {
    return -1.1
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Shallow equality check for objects
 */
function shallowEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return false

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (a[key] !== b[key]) return false
  }

  return true
}

/**
 * Equality check for marks arrays.
 * Marks are compared by type and attrs.
 */
function marksEqual(
  a: readonly Mark[] | undefined,
  b: readonly Mark[] | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const markA = a[i]
    const markB = b[i]
    if (!markA || !markB) return false
    if (markA.type !== markB.type) return false
    if (!markA.eq(markB)) return false
  }

  return true
}

/**
 * Apply queued operations to the transaction.
 * This is a simplified version - Phase R.2 will add smart merge.
 */
function applyOperations(
  container: Container,
  ops: PendingOperation[]
): void {
  const tr = container.transaction
  if (!tr) return

  // Group operations by type for efficient processing
  const appends = ops.filter((op) => op.type === 'appendChild')
  const removes = ops.filter((op) => op.type === 'removeChild')
  const updates = ops.filter((op) => op.type === 'setNodeMarkup')
  const textUpdates = ops.filter((op) => op.type === 'updateText')

  // Process removes first (to avoid position shifts)
  for (const op of removes) {
    if (op.type !== 'removeChild') continue
    const { child } = op

    if ('node' in child) {
      // Find position and delete
      const pos = findNodePosition(container.state.doc, child.node)
      if (pos !== null) {
        tr.delete(pos, pos + child.node.nodeSize)
      }
    }
  }

  // Process updates
  for (const op of updates) {
    if (op.type !== 'setNodeMarkup') continue
    const { instance, attrs } = op

    const pos = findNodePosition(container.state.doc, instance.node)
    if (pos !== null) {
      tr.setNodeMarkup(pos, undefined, { ...instance.node.attrs, ...attrs })
    }
  }

  // Process text updates
  for (const op of textUpdates) {
    if (op.type !== 'updateText') continue
    // Text updates are handled by replacing the text node
    // This will be more sophisticated in Phase R.2
  }

  // Process appends
  for (const op of appends) {
    if (op.type !== 'appendChild') continue
    const { parent, child } = op

    if ('node' in child) {
      // Find parent position and insert at end
      const parentPos = findNodePosition(container.state.doc, parent.node)
      if (parentPos !== null) {
        const insertPos = parentPos + parent.node.nodeSize - 1
        tr.insert(insertPos, child.node)
      }
    }
  }
}

/**
 * Find the position of a node in the document.
 * Returns null if not found.
 */
function findNodePosition(doc: PMNode, target: PMNode): number | null {
  let foundPos: number | null = null

  doc.descendants((node, pos) => {
    if (foundPos !== null) return false
    if (node === target) {
      foundPos = pos
      return false
    }
    return true
  })

  return foundPos
}

// =============================================================================
// Exports
// =============================================================================

export { clearPendingOperations, queueOperation, marksEqual }
