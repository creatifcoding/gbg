/**
 * Flex Layout Engine — yoga-like width distribution
 *
 * 3-pass algorithm:
 *   1. Measure natural widths (content-aware)
 *   2. Assign flex-proportional widths with clamps
 *   3. Redistribute over/underflow
 *
 * Returns null when totalWidth < COLLAPSE_THRESHOLD → caller falls back to stk.
 *
 * @module
 */

// ─── Constants ───────────────────────────────────────────

/** Minimum column width before content is unreadable */
export const MIN_COL = 8

/** Below this total width, row collapses to vertical stack */
export const COLLAPSE_THRESHOLD = 40

/** Default gutter between row children */
export const DEFAULT_GAP = 2

// ─── Interface ───────────────────────────────────────────

export interface FlexChild {
  /** Flex weight (default 1) */
  flex?: number
  /** Minimum width (default MIN_COL) */
  minW?: number
  /** Maximum width (default: no maximum) */
  maxW?: number
  /** Measured natural content width */
  natural?: number
}

// ─── Algorithm ───────────────────────────────────────────

/**
 * Distribute width across flex children.
 *
 * @param children - Array of flex children with optional constraints
 * @param totalWidth - Total available width including gaps
 * @param gap - Gap between children (default DEFAULT_GAP)
 * @returns Array of allocated widths, or null if should collapse to stk
 *
 * Guarantees:
 * - sum(widths) + (n-1) * gap === totalWidth (conservation)
 * - All widths >= 0 (non-negative)
 * - Deterministic (same input → same output)
 */
export function flexLayout(
  children: FlexChild[],
  totalWidth: number,
  gap: number = DEFAULT_GAP,
): number[] | null {
  const n = children.length

  // ── Edge cases ──
  if (n === 0) return []
  if (totalWidth < COLLAPSE_THRESHOLD) return null
  if (n === 1) return [totalWidth]

  // ── Available width after gaps ──
  const gapTotal = (n - 1) * gap
  const available = totalWidth - gapTotal

  // If gaps alone exhaust the width, proportional shrink
  if (available <= 0) {
    // Distribute what we have equally (may be zero/negative per child)
    const each = Math.max(0, Math.floor(available / n))
    const widths = new Array(n).fill(each)
    // Distribute remainder to fill exactly
    let remaining = available - each * n
    for (let i = 0; remaining > 0 && i < n; i++) {
      widths[i]++
      remaining--
    }
    return widths
  }

  // ── Pass 1: Resolve flex weights ──
  const flexWeights = children.map(c => c.flex ?? 1)
  const totalFlex = flexWeights.reduce((s, f) => s + f, 0)

  // ── Pass 2: Initial proportional allocation with clamps ──
  const minWidths = children.map(c => c.minW ?? MIN_COL)
  const maxWidths = children.map(c => c.maxW ?? Infinity)
  const widths = new Array<number>(n)

  for (let i = 0; i < n; i++) {
    const raw = totalFlex > 0
      ? (flexWeights[i] / totalFlex) * available
      : available / n

    widths[i] = Math.max(minWidths[i], Math.min(maxWidths[i], Math.floor(raw)))
  }

  // ── Pass 3: Redistribute over/underflow ──
  // Loop until conservation holds or no more adjustable children
  for (let iter = 0; iter < 10; iter++) {
    const allocated = widths.reduce((s, w) => s + w, 0)
    const delta = available - allocated

    if (delta === 0) break

    if (delta > 0) {
      // Underflow: distribute surplus to children not at max
      const expandable = widths
        .map((w, i) => ({ i, w, canGrow: w < maxWidths[i] }))
        .filter(c => c.canGrow)

      if (expandable.length === 0) break

      const expandFlex = expandable.reduce((s, c) => s + flexWeights[c.i], 0)
      let remaining = delta

      for (const c of expandable) {
        const share = expandFlex > 0
          ? Math.floor((flexWeights[c.i] / expandFlex) * delta)
          : Math.floor(delta / expandable.length)
        const add = Math.min(share, maxWidths[c.i] - widths[c.i])
        widths[c.i] += add
        remaining -= add
      }

      // Distribute leftover 1px at a time
      for (const c of expandable) {
        if (remaining <= 0) break
        const add = Math.min(1, maxWidths[c.i] - widths[c.i])
        widths[c.i] += add
        remaining -= add
      }
    } else {
      // Overflow: shrink children not at min
      const shrinkable = widths
        .map((w, i) => ({ i, w, canShrink: w > Math.max(0, minWidths[i]) }))
        .filter(c => c.canShrink)

      if (shrinkable.length === 0) {
        // Even at min widths we overflow — proportional shrink below min
        const totalMin = widths.reduce((s, w) => s + w, 0)
        if (totalMin > 0) {
          for (let i = 0; i < n; i++) {
            widths[i] = Math.max(0, Math.floor((widths[i] / totalMin) * available))
          }
          // Fix rounding
          let sum = widths.reduce((s, w) => s + w, 0)
          let idx = 0
          while (sum < available && idx < n) {
            widths[idx]++
            sum++
            idx++
          }
          while (sum > available && idx < n) {
            if (widths[idx] > 0) { widths[idx]--; sum-- }
            idx++
          }
        }
        break
      }

      const shrinkFlex = shrinkable.reduce((s, c) => s + flexWeights[c.i], 0)
      let remaining = -delta

      for (const c of shrinkable) {
        const share = shrinkFlex > 0
          ? Math.floor((flexWeights[c.i] / shrinkFlex) * (-delta))
          : Math.floor((-delta) / shrinkable.length)
        const sub = Math.min(share, widths[c.i] - Math.max(0, minWidths[c.i]))
        widths[c.i] -= sub
        remaining -= sub
      }

      // Distribute leftover 1px at a time
      for (const c of shrinkable) {
        if (remaining <= 0) break
        const sub = Math.min(1, widths[c.i] - Math.max(0, minWidths[c.i]))
        widths[c.i] -= sub
        remaining -= sub
      }
    }
  }

  // ── Final conservation fix (rounding errors) ──
  let sum = widths.reduce((s, w) => s + w, 0)
  let idx = n - 1
  while (sum !== available && idx >= 0) {
    const diff = available - sum
    if (diff > 0) {
      widths[idx]++
      sum++
    } else if (diff < 0 && widths[idx] > 0) {
      widths[idx]--
      sum--
    }
    idx--
    if (idx < 0) idx = n - 1
    // Safety: prevent infinite loop
    if (Math.abs(available - sum) === Math.abs(diff) && idx === n - 1) break
  }

  return widths
}
