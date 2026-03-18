/**
 * TransactionCollector — Coalesces cell mutations into
 * batched AG-Grid applyTransaction calls.
 *
 * Multiple writes to the same row within a single frame
 * are coalesced into one RowUpdate. Uses requestAnimationFrame
 * (or microtask in test/SSR) for flush scheduling.
 *
 * @module
 */

// ─── Types ──────────────────────────────────────────

export interface RowUpdate {
  /** Row identifier: "sheetId:rowIndex" */
  readonly id: string
  /** Column index → display value */
  readonly data: Record<string, string>
}

export interface GridTransaction {
  readonly update?: RowUpdate[]
  readonly add?: RowUpdate[]
  readonly remove?: Array<{ id: string }>
}

export interface TransactionStats {
  readonly totalTransactions: number
  readonly totalRowUpdates: number
  readonly totalCoalesced: number
}

// ─── TransactionCollector ───────────────────────────

export class TransactionCollector {
  private pending: Map<string, RowUpdate> = new Map()
  private scheduled = false
  private _totalTransactions = 0
  private _totalRowUpdates = 0
  private _totalCoalesced = 0
  private readonly onFlush: (tx: GridTransaction) => void
  private readonly scheduleFlush: (cb: () => void) => void

  constructor(opts: {
    /** Called when a transaction is ready to apply */
    onFlush: (tx: GridTransaction) => void
    /**
     * Custom flush scheduler. Defaults to requestAnimationFrame
     * if available, otherwise queueMicrotask.
     */
    scheduleFlush?: (cb: () => void) => void
  }) {
    this.onFlush = opts.onFlush
    this.scheduleFlush = opts.scheduleFlush ??
      (typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : queueMicrotask)
  }

  /**
   * Queue a cell update. Multiple writes to the same row
   * within a frame are coalesced into a single RowUpdate.
   */
  queueUpdate(sheetId: string, row: number, col: number, displayValue: string): void {
    const rowId = `${sheetId}:${row}`
    const existing = this.pending.get(rowId)

    if (existing) {
      // Coalesce into existing row update
      ;(existing.data as Record<string, string>)[String(col)] = displayValue
      this._totalCoalesced++
    } else {
      this.pending.set(rowId, {
        id: rowId,
        data: { [String(col)]: displayValue },
      })
    }

    if (!this.scheduled) {
      this.scheduled = true
      this.scheduleFlush(() => this.flush())
    }
  }

  /**
   * Queue a row addition.
   */
  queueAdd(sheetId: string, row: number, data: Record<string, string>): void {
    // For adds, flush immediately via a separate transaction
    this.flush()
    const tx: GridTransaction = {
      add: [{ id: `${sheetId}:${row}`, data }],
    }
    this.onFlush(tx)
    this._totalTransactions++
    this._totalRowUpdates++
  }

  /**
   * Queue a row removal.
   */
  queueRemove(sheetId: string, row: number): void {
    this.flush()
    const tx: GridTransaction = {
      remove: [{ id: `${sheetId}:${row}` }],
    }
    this.onFlush(tx)
    this._totalTransactions++
  }

  /**
   * Flush all pending updates as a single transaction.
   * Safe to call multiple times — no-ops if nothing pending.
   */
  flush(): void {
    this.scheduled = false
    if (this.pending.size === 0) return

    const update = Array.from(this.pending.values())
    this.pending.clear()

    const tx: GridTransaction = { update }
    this.onFlush(tx)

    this._totalTransactions++
    this._totalRowUpdates += update.length
  }

  /** Get stats */
  get stats(): TransactionStats {
    return {
      totalTransactions: this._totalTransactions,
      totalRowUpdates: this._totalRowUpdates,
      totalCoalesced: this._totalCoalesced,
    }
  }

  /** Reset stats */
  resetStats(): void {
    this._totalTransactions = 0
    this._totalRowUpdates = 0
    this._totalCoalesced = 0
  }

  /** Number of pending row updates not yet flushed */
  get pendingCount(): number {
    return this.pending.size
  }
}
