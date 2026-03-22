import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Atom } from '@effect-atom/atom'
import { RegistryContext, useAtomSet, useAtomValue } from '@effect-atom/atom-react'
import { HashMap, HashSet, Option } from 'effect'

export type HitboxDebugMode =
  | boolean
  | {
      polygonFill?: boolean
      polygonStroke?: boolean
      boundsBox?: boolean
      stateBadge?: boolean
      timingMs?: boolean
    }

interface HitboxBounds {
  x: number
  y: number
  width: number
  height: number
}

const refsAtom = Atom.make(HashMap.empty<string, HTMLElement>())
const refByIdAtomFamily = Atom.family((id: string) =>
  Atom.make((get) => Option.getOrUndefined(HashMap.get(get(refsAtom), id))),
)
const refCountAtom = Atom.make((get) => HashMap.size(get(refsAtom)))
const refIdsAtom = Atom.make((get) => Array.from(HashMap.keys(get(refsAtom))))
const metricsAtom = Atom.make((get) => {
  const ids = get(refIdsAtom)
  let hovered = 0
  let armed = 0
  let open = 0
  let conflict = 0

  for (const id of ids) {
    if (get(hoveredAtomFamily(id))) hovered += 1
    if (get(armedAtomFamily(id))) armed += 1
    if (get(openAtomFamily(id))) open += 1
    if (get(conflictAtomFamily(id))) conflict += 1
  }

  return {
    count: ids.length,
    hovered,
    armed,
    open,
    conflict,
  }
})

const topHoveredIdAtom = Atom.make<string | null>(null)
const overlapIdsAtom = Atom.make(HashSet.empty<string>())

const hoveredAtomFamily = Atom.family((id: string) => Atom.make(false))
const conflictAtomFamily = Atom.family((id: string) => Atom.make(false))
const armedAtomFamily = Atom.family((id: string) => Atom.make(false))
const openAtomFamily = Atom.family((id: string) => Atom.make(false))
const hoverStartMsAtomFamily = Atom.family((id: string) => Atom.make<number | null>(null))
const hoverElapsedMsAtomFamily = Atom.family((id: string) => Atom.make(0))
const boundsAtomFamily = Atom.family((id: string) => Atom.make<HitboxBounds | null>(null))

interface RootContextValue {
  id: string
  label: string
  dwellMs: number
  hoverLeaveGraceMs: number
  priority: number
  polygon: string
  inset: string
  debug: {
    polygonFill: boolean
    polygonStroke: boolean
    boundsBox: boolean
    stateBadge: boolean
    timingMs: boolean
  }
  setHovered: (value: boolean) => void
  setArmed: (value: boolean) => void
  setOpen: (value: boolean) => void
}

const RootContext = createContext<RootContextValue | null>(null)

function useRootContext() {
  const ctx = useContext(RootContext)
  if (!ctx) {
    throw new Error('MicrointeractionHitbox compound components must be used inside MicrointeractionHitbox.Root')
  }
  return ctx
}

function normalizeDebug(debug: HitboxDebugMode | undefined) {
  if (debug === true) {
    return {
      polygonFill: true,
      polygonStroke: true,
      boundsBox: true,
      stateBadge: true,
      timingMs: true,
    }
  }
  if (debug === false || debug == null) {
    return {
      polygonFill: false,
      polygonStroke: false,
      boundsBox: false,
      stateBadge: false,
      timingMs: false,
    }
  }
  return {
    polygonFill: !!debug.polygonFill,
    polygonStroke: !!debug.polygonStroke,
    boundsBox: !!debug.boundsBox,
    stateBadge: !!debug.stateBadge,
    timingMs: !!debug.timingMs,
  }
}

function resolveHitboxStack(event: MouseEvent | FocusEvent | PointerEvent): {
  topId: string | null
  overlapIds: HashSet.HashSet<string>
} {
  const target = event.target as HTMLElement | null
  if (!target) return { topId: null, overlapIds: HashSet.empty() }

  const hitboxElement = target.closest('[data-micro-hitbox-id]') as HTMLElement | null
  if (!hitboxElement) return { topId: null, overlapIds: HashSet.empty() }

  if ('clientX' in event && 'clientY' in event) {
    const stack = document.elementsFromPoint(event.clientX, event.clientY)
    let overlapIds = HashSet.empty<string>()
    const contenders = new Map<string, { priority: number; stackIndex: number }>()

    for (let i = 0; i < stack.length; i++) {
      const el = stack[i]
      const hitbox = el.closest('[data-micro-hitbox-id]') as HTMLElement | null
      if (!hitbox) continue

      const id = hitbox.dataset.microHitboxId
      if (!id) continue

      const parsed = Number(hitbox.dataset.microHitboxPriority ?? '0')
      const priority = Number.isFinite(parsed) ? parsed : 0

      overlapIds = HashSet.add(overlapIds, id)

      const current = contenders.get(id)
      if (!current) {
        contenders.set(id, { priority, stackIndex: i })
        continue
      }

      // Keep strongest priority; for equal priority keep topmost (lowest stack index)
      if (priority > current.priority || (priority === current.priority && i < current.stackIndex)) {
        contenders.set(id, { priority, stackIndex: i })
      }
    }

    let topId: string | null = null
    let topPriority = Number.NEGATIVE_INFINITY
    let topStackIndex = Number.POSITIVE_INFINITY

    for (const [id, contender] of contenders) {
      if (
        contender.priority > topPriority ||
        (contender.priority === topPriority && contender.stackIndex < topStackIndex)
      ) {
        topId = id
        topPriority = contender.priority
        topStackIndex = contender.stackIndex
      }
    }

    return { topId, overlapIds }
  }

  const id = hitboxElement.dataset.microHitboxId
  return {
    topId: id ?? null,
    overlapIds: id ? HashSet.make(id) : HashSet.empty(),
  }
}

export interface MicrointeractionHitboxRootProps {
  id: string
  label: string
  children: ReactNode
  dwellMs?: number
  hoverLeaveGraceMs?: number
  priority?: number
  polygon?: string
  inset?: string
  debug?: HitboxDebugMode
  armed?: boolean
  defaultArmed?: boolean
  onArmedChange?: (armed: boolean) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  onHoverChange?: (hovered: boolean) => void
}

function Root({
  id,
  label,
  children,
  dwellMs = 400,
  hoverLeaveGraceMs = 120,
  priority = 0,
  polygon = 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
  inset = '-5px -10px',
  debug,
  armed,
  defaultArmed = false,
  onArmedChange,
  open,
  defaultOpen = false,
  onOpenChange,
  onHoverChange,
}: MicrointeractionHitboxRootProps) {
  const debugOptions = useMemo(() => normalizeDebug(debug), [debug])

  const setHoveredAtom = useAtomSet(hoveredAtomFamily(id))
  const setArmedAtom = useAtomSet(armedAtomFamily(id))
  const setOpenAtom = useAtomSet(openAtomFamily(id))

  // initialize uncontrolled defaults once per id
  useEffect(() => {
    setArmedAtom(defaultArmed)
  }, [defaultArmed, setArmedAtom])

  useEffect(() => {
    setOpenAtom(defaultOpen)
  }, [defaultOpen, setOpenAtom])

  // controlled sync
  useEffect(() => {
    if (armed !== undefined) setArmedAtom(armed)
  }, [armed, setArmedAtom])

  useEffect(() => {
    if (open !== undefined) setOpenAtom(open)
  }, [open, setOpenAtom])

  const setHovered = useCallback(
    (value: boolean) => {
      setHoveredAtom(value)
      onHoverChange?.(value)
    },
    [onHoverChange, setHoveredAtom]
  )

  const setArmed = useCallback(
    (value: boolean) => {
      if (armed === undefined) {
        setArmedAtom(value)
      }
      onArmedChange?.(value)
    },
    [armed, onArmedChange, setArmedAtom]
  )

  const setOpen = useCallback(
    (value: boolean) => {
      if (open === undefined) {
        setOpenAtom(value)
      }
      onOpenChange?.(value)
    },
    [onOpenChange, open, setOpenAtom]
  )

  const ctx = useMemo<RootContextValue>(
    () => ({
      id,
      label,
      dwellMs,
      hoverLeaveGraceMs,
      priority,
      polygon,
      inset,
      debug: debugOptions,
      setHovered,
      setArmed,
      setOpen,
    }),
    [debugOptions, dwellMs, hoverLeaveGraceMs, id, inset, label, polygon, priority, setArmed, setHovered, setOpen]
  )

  return <RootContext.Provider value={ctx}>{children}</RootContext.Provider>
}

export interface MicrointeractionHitboxTargetProps {
  children: ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onMouseMove?: (event: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  style?: CSSProperties
}

function Target({ children, onClick, onMouseEnter, onMouseMove, className, style }: MicrointeractionHitboxTargetProps) {
  const ctx = useRootContext()
  const id = ctx.id
  const atomReg = useContext(RegistryContext)

  const topHoveredId = useAtomValue(topHoveredIdAtom)
  const overlapIds = useAtomValue(overlapIdsAtom)
  const hovered = useAtomValue(hoveredAtomFamily(id))
  const conflict = useAtomValue(conflictAtomFamily(id))
  const armed = useAtomValue(armedAtomFamily(id))
  const open = useAtomValue(openAtomFamily(id))
  const hoverElapsedMs = useAtomValue(hoverElapsedMsAtomFamily(id))

  const setTopHoveredId = useAtomSet(topHoveredIdAtom)
  const setOverlapIds = useAtomSet(overlapIdsAtom)
  const setConflict = useAtomSet(conflictAtomFamily(id))
  const setHoverStartMs = useAtomSet(hoverStartMsAtomFamily(id))
  const setHoverElapsedMs = useAtomSet(hoverElapsedMsAtomFamily(id))
  const setBounds = useAtomSet(boundsAtomFamily(id))

  const hoverLeaveTimerRef = useRef<number | null>(null)
  const elementRef = useRef<HTMLButtonElement | null>(null)

  // reflect arbitration winner into local hover state (with configurable leave grace)
  useEffect(() => {
    const shouldHover = topHoveredId === id

    if (shouldHover) {
      if (hoverLeaveTimerRef.current !== null) {
        window.clearTimeout(hoverLeaveTimerRef.current)
        hoverLeaveTimerRef.current = null
      }
      if (!hovered) {
        ctx.setHovered(true)
      }
      return
    }

    if (hoverLeaveTimerRef.current !== null) {
      window.clearTimeout(hoverLeaveTimerRef.current)
    }

    hoverLeaveTimerRef.current = window.setTimeout(() => {
      if (hovered) {
        ctx.setHovered(false)
      }
      hoverLeaveTimerRef.current = null
    }, ctx.hoverLeaveGraceMs)

    return () => {
      if (hoverLeaveTimerRef.current !== null) {
        window.clearTimeout(hoverLeaveTimerRef.current)
      }
    }
  }, [ctx, hovered, id, topHoveredId])

  useEffect(() => {
    const nextConflict = HashSet.has(overlapIds, id) && HashSet.size(overlapIds) > 1
    if (nextConflict !== conflict) {
      setConflict(nextConflict)
    }
  }, [conflict, id, overlapIds, setConflict])

  // dwell schedule (atom-backed)
  useEffect(() => {
    if (!hovered) {
      setHoverStartMs(null)
      setHoverElapsedMs(0)
      if (armed) {
        ctx.setArmed(false)
      }
      return
    }

    const startedAt = performance.now()
    setHoverStartMs(startedAt)

    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - startedAt
      setHoverElapsedMs(elapsed)
      if (elapsed >= ctx.dwellMs) {
        ctx.setArmed(true)
        return
      }
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      setHoverStartMs(null)
      setHoverElapsedMs(0)
    }
  }, [armed, ctx, hovered, setHoverElapsedMs, setHoverStartMs])

  const registerRef = useCallback(
    (el: HTMLButtonElement | null) => {
      elementRef.current = el

      if (atomReg) {
        const currentRefs = atomReg.get(refsAtom)
        const maybeCurrent = HashMap.get(currentRefs, id)
        const currentEl = Option.getOrUndefined(maybeCurrent)

        if (currentEl !== el) {
          const nextRefs = el
            ? HashMap.set(currentRefs, id, el)
            : HashMap.remove(currentRefs, id)
          atomReg.set(refsAtom, nextRefs)
        }
      }

      if (el) {
        const rect = el.getBoundingClientRect()
        setBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      } else {
        setBounds(null)
      }
    },
    [atomReg, id, setBounds]
  )

  useEffect(() => {
    const el = elementRef.current
    if (!el) return

    const updateBounds = () => {
      const rect = el.getBoundingClientRect()
      setBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
    }

    updateBounds()
    const ro = new ResizeObserver(() => updateBounds())
    ro.observe(el)
    window.addEventListener('scroll', updateBounds, true)
    window.addEventListener('resize', updateBounds)

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', updateBounds, true)
      window.removeEventListener('resize', updateBounds)
    }
  }, [setBounds])

  return (
    <button
      ref={registerRef}
      type="button"
      data-micro-hitbox-id={id}
      data-micro-hitbox-priority={ctx.priority}
      aria-label={ctx.label}
      className={className}
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        ...style,
      }}
      onMouseEnter={(event) => {
        const stack = resolveHitboxStack(event.nativeEvent)
        setTopHoveredId(stack.topId)
        setOverlapIds(stack.overlapIds)
        onMouseEnter?.(event)
      }}
      onMouseMove={(event) => {
        const stack = resolveHitboxStack(event.nativeEvent)
        setTopHoveredId(stack.topId)
        setOverlapIds(stack.overlapIds)
        onMouseMove?.(event)
      }}
      onMouseLeave={() => {
        setTopHoveredId(null)
        setOverlapIds(HashSet.empty())
      }}
      onFocus={(event) => {
        const stack = resolveHitboxStack(event.nativeEvent)
        setTopHoveredId(stack.topId)
        setOverlapIds(stack.overlapIds)
      }}
      onBlur={() => {
        setTopHoveredId(null)
        setOverlapIds(HashSet.empty())
      }}
      onClick={(event) => {
        ctx.setOpen(!open)
        onClick(event)
      }}
    >
      <Overlay />
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
      <DebugOverlayPortal elapsedMs={hoverElapsedMs} armed={armed} hovered={hovered} open={open} />
    </button>
  )
}

interface PolygonProps {
  armed?: boolean
  style?: CSSProperties
}

function Polygon({ armed, style }: PolygonProps) {
  const ctx = useRootContext()
  const localArmed = useAtomValue(armedAtomFamily(ctx.id))
  const effectiveArmed = armed ?? localArmed

  if (!effectiveArmed) return null

  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: ctx.inset,
        clipPath: ctx.polygon,
        border: '1px solid rgba(125, 211, 252, 0.6)',
        background: 'rgba(125, 211, 252, 0.08)',
        transition: 'all 120ms ease-out',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    />
  )
}

function Overlay() {
  return <Polygon />
}

interface DebugLabelProps {
  elapsedMs: number
  armed: boolean
  hovered: boolean
  open: boolean
}

function DebugLabel({ elapsedMs, armed, hovered, open }: DebugLabelProps) {
  const ctx = useRootContext()
  const bounds = useAtomValue(boundsAtomFamily(ctx.id))
  const conflict = useAtomValue(conflictAtomFamily(ctx.id))

  if (!bounds) return null
  if (!ctx.debug.stateBadge && !ctx.debug.timingMs) return null

  return (
    <span
      aria-hidden
      style={{
        position: 'fixed',
        left: bounds.x,
        top: bounds.y - 18,
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'var(--rvn-font-mono)',
        color: conflict ? '#f43f5e' : '#ec4899',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 30001,
      }}
    >
      {ctx.debug.stateBadge ? `${ctx.id} h:${hovered ? 1 : 0} a:${armed ? 1 : 0} o:${open ? 1 : 0} c:${conflict ? 1 : 0}` : ''}
      {ctx.debug.stateBadge && ctx.debug.timingMs ? ' | ' : ''}
      {ctx.debug.timingMs ? `${Math.round(elapsedMs)}ms/${ctx.dwellMs}` : ''}
    </span>
  )
}

function DebugOverlayPortal({ elapsedMs, armed, hovered, open }: DebugLabelProps) {
  const ctx = useRootContext()
  const bounds = useAtomValue(boundsAtomFamily(ctx.id))
  const conflict = useAtomValue(conflictAtomFamily(ctx.id))

  const debugEnabled =
    ctx.debug.polygonFill ||
    ctx.debug.polygonStroke ||
    ctx.debug.boundsBox ||
    ctx.debug.stateBadge ||
    ctx.debug.timingMs

  if (!debugEnabled) return null
  if (!bounds) return null
  if (typeof document === 'undefined') return null

  const showPolygon = ctx.debug.polygonFill || ctx.debug.polygonStroke || conflict

  return createPortal(
    <>
      {showPolygon && (
        <span
          aria-hidden
          style={{
            position: 'fixed',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: 30000,
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: ctx.inset,
              clipPath: ctx.polygon,
              border: conflict
                ? '1px solid rgba(244, 63, 94, 0.95)'
                : (ctx.debug.polygonStroke ? '1px solid rgba(236,72,153,0.9)' : '1px solid transparent'),
              background: conflict
                ? 'rgba(244, 63, 94, 0.18)'
                : (ctx.debug.polygonFill ? 'rgba(236, 72, 153, 0.14)' : 'transparent'),
              pointerEvents: 'none',
            }}
          />
        </span>
      )}

      {ctx.debug.boundsBox && (
        <span
          aria-hidden
          style={{
            position: 'fixed',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
            border: '1px dashed rgba(236,72,153,0.9)',
            pointerEvents: 'none',
            zIndex: 30000,
          }}
        />
      )}

      <DebugLabel elapsedMs={elapsedMs} armed={armed} hovered={hovered} open={open} />
    </>,
    document.body,
  )
}

export const microinteractionHitboxAtoms = {
  refsAtom,
  refByIdAtomFamily,
  refCountAtom,
  refIdsAtom,
  metricsAtom,
  topHoveredIdAtom,
  overlapIdsAtom,
  hoveredAtomFamily,
  armedAtomFamily,
  openAtomFamily,
  conflictAtomFamily,
  boundsAtomFamily,
}

const MicrointeractionHitboxAtomsContext = createContext(microinteractionHitboxAtoms)

export function MicrointeractionHitboxProvider({ children }: { children: ReactNode }) {
  return (
    <MicrointeractionHitboxAtomsContext.Provider value={microinteractionHitboxAtoms}>
      {children}
    </MicrointeractionHitboxAtomsContext.Provider>
  )
}

export function useMicrointeractionHitboxAtoms() {
  return useContext(MicrointeractionHitboxAtomsContext)
}

export const MicrointeractionHitbox = {
  Provider: MicrointeractionHitboxProvider,
  Root,
  Target,
  Overlay,
  DebugLabel,
  Polygon,
}
