/**
 * DevDocOverlay - Development Documentation Overlay System
 *
 * A toggle-able documentation layer that shows expected behavior
 * for interactive elements when dev-mode is active.
 *
 * Architecture:
 * - DevDocProvider: Context provider for dev-mode state
 * - DocTarget: Wrapper for interactive elements with colocated docs
 * - DevDocToggle: Toggle button for enabling/disabling doc mode
 *
 * Usage:
 * ```tsx
 * <DevDocProvider>
 *   <DevDocToggle />
 *   <DocTarget doc={{
 *     title: "Reset Trigger",
 *     description: "Resets the trigger counter",
 *     expectedBehavior: "Increments trigger atom by 1",
 *     interactions: [{ trigger: "Click", result: "Counter +1" }]
 *   }}>
 *     <Button onClick={reset}>Reset</Button>
 *   </DocTarget>
 * </DevDocProvider>
 * ```
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
  type ReactElement,
  useCallback,
} from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
  useRole,
  arrow,
  FloatingArrow,
} from '@floating-ui/react'

// =============================================================================
// TYPES
// =============================================================================

export interface InteractionDoc {
  trigger: string // e.g., "Click", "Hover", "Focus"
  result: string // Expected outcome
}

export interface BehaviorDoc {
  /** Short title for the element */
  title: string
  /** Description of what this element does */
  description: string
  /** Expected behavior when interacted with */
  expectedBehavior: string
  /** Optional list of specific interactions */
  interactions?: InteractionDoc[]
  /** Optional findings/notes discovered during testing */
  findings?: string[]
  /** Optional related hypothesis IDs */
  relatedHypotheses?: string[]
}

interface DevDocContextValue {
  isEnabled: boolean
  toggle: () => void
  enable: () => void
  disable: () => void
  activeDocId: string | null
  setActiveDocId: (id: string | null) => void
  portalRoot: HTMLElement | null
}

// =============================================================================
// CONTEXT
// =============================================================================

const DevDocContext = createContext<DevDocContextValue | null>(null)

export function useDevDoc() {
  const ctx = useContext(DevDocContext)
  if (!ctx) {
    throw new Error('useDevDoc must be used within DevDocProvider')
  }
  return ctx
}

// =============================================================================
// PROVIDER
// =============================================================================

export function DevDocProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  const toggle = useCallback(() => setIsEnabled((v) => !v), [])
  const enable = useCallback(() => setIsEnabled(true), [])
  const disable = useCallback(() => {
    setIsEnabled(false)
    setActiveDocId(null)
  }, [])

  return (
    <DevDocContext.Provider
      value={{ isEnabled, toggle, enable, disable, activeDocId, setActiveDocId, portalRoot }}
    >
      {children}
      {/* Portal root inside provider tree to preserve context */}
      <div ref={setPortalRoot} id="devdoc-portal-root" />
    </DevDocContext.Provider>
  )
}

// =============================================================================
// DOC TARGET - Wrapper for documented elements
// =============================================================================

let docIdCounter = 0
function generateDocId() {
  return `doc-target-${++docIdCounter}`
}

interface DocTargetProps {
  doc: BehaviorDoc
  children: ReactElement
  /** Optional custom ID for the doc target */
  id?: string
}

export function DocTarget({ doc, children, id }: DocTargetProps) {
  const { isEnabled, activeDocId, setActiveDocId, portalRoot } = useDevDoc()
  const docIdRef = useRef(id ?? generateDocId())
  const docId = docIdRef.current
  const arrowRef = useRef(null)

  const isOpen = isEnabled && activeDocId === docId

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (open) {
        setActiveDocId(docId)
      } else {
        setActiveDocId(null)
      }
    },
    placement: 'top',
    middleware: [
      offset(12),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  })

  const click = useClick(context, { enabled: isEnabled })
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'dialog' })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ])

  // Reference wrapper - must have a bounding box for Floating UI positioning
  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        className={`relative inline-block ${isEnabled ? 'cursor-help' : ''}`}
      >
        {children}
        {/* Doc mode indicator badge */}
        {isEnabled && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full border-2 border-neutral-950 z-50 animate-pulse"
            title={doc.title}
          />
        )}
      </div>

      {isOpen && portalRoot && (
        <FloatingPortal root={portalRoot}>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[9999] max-w-sm"
          >
            <DocPopover doc={doc} onClose={() => setActiveDocId(null)} />
            <FloatingArrow
              ref={arrowRef}
              context={context}
              className="fill-neutral-800"
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

// =============================================================================
// DOC POPOVER - The floating documentation panel
// =============================================================================

function DocPopover({
  doc,
  onClose,
}: {
  doc: BehaviorDoc
  onClose: () => void
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-violet-900/30 border-b border-neutral-700">
        <span className="text-violet-300 font-semibold text-xs uppercase tracking-wider">
          {doc.title}
        </span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Description */}
        <div>
          <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Description
          </div>
          <p className="text-neutral-300 text-xs">{doc.description}</p>
        </div>

        {/* Expected Behavior */}
        <div>
          <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Expected Behavior
          </div>
          <p className="text-cyan-400 text-xs">{doc.expectedBehavior}</p>
        </div>

        {/* Interactions */}
        {doc.interactions && doc.interactions.length > 0 && (
          <div>
            <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Interactions
            </div>
            <div className="space-y-1">
              {doc.interactions.map((interaction, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="px-1.5 py-0.5 bg-neutral-800 text-amber-400 rounded uppercase" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    {interaction.trigger}
                  </span>
                  <span className="text-neutral-400">→</span>
                  <span className="text-neutral-300">{interaction.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Findings */}
        {doc.findings && doc.findings.length > 0 && (
          <div>
            <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Findings
            </div>
            <ul className="space-y-1">
              {doc.findings.map((finding, i) => (
                <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1">
                  <span className="text-amber-500">•</span>
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Related Hypotheses */}
        {doc.relatedHypotheses && doc.relatedHypotheses.length > 0 && (
          <div className="pt-2 border-t border-neutral-800">
            <div className="flex flex-wrap gap-1">
              {doc.relatedHypotheses.map((h) => (
                <span
                  key={h}
                  className="px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// DEV DOC TOGGLE - Toggle button for dev-mode
// =============================================================================

export function DevDocToggle({ className = '' }: { className?: string }) {
  const { isEnabled, toggle } = useDevDoc()

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded border font-mono text-xs uppercase tracking-wider transition-colors ${
        isEnabled
          ? 'bg-violet-900/50 border-violet-700/50 text-violet-300'
          : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:text-neutral-300'
      } ${className}`}
      title={isEnabled ? 'Disable documentation overlay' : 'Enable documentation overlay'}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isEnabled ? 'bg-violet-400 animate-pulse' : 'bg-neutral-600'
        }`}
      />
      <span>Doc Mode</span>
      <span className="text-neutral-600">{isEnabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { BehaviorDoc, InteractionDoc }
