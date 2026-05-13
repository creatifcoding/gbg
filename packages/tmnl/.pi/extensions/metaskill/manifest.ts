/**
 * ToolManifest — compiled tool guide from contributed sections.
 *
 * Each module registers a section into a fixed slot. On compile(), sections
 * are ordered by slot → priority, concatenated, and cached. Dirty flags
 * track which sections need recompilation.
 *
 * Slots define the structure of the compiled guide:
 *   DISCIPLINE → SHAPES → API → PATTERNS → AVOID
 *
 * Sections can be static strings or lazy providers (functions) for
 * runtime-computed content. Providers are called on compile when dirty.
 *
 * Integration: ToolManifest produces the `guide` string consumed by
 * `createToolGuide`. It owns the content; tool-guide owns the injection.
 *
 * @module
 */

// ─── Slot ordering ───────────────────────────────────────

/**
 * Fixed slot identifiers. Order here defines order in compiled output.
 * Sections register into a slot; multiple sections per slot allowed
 * (ordered by priority within slot).
 */
export const SLOTS = ['discipline', 'shapes', 'api', 'patterns', 'avoid'] as const
export type Slot = (typeof SLOTS)[number]

/** Slot index for ordering (lower = earlier in output) */
const SLOT_ORDER: Record<Slot, number> = {
  discipline: 0,
  shapes: 1,
  api: 2,
  patterns: 3,
  avoid: 4,
}

// ─── Types ───────────────────────────────────────────────

/** Static content or lazy provider. Providers are called on compile(). */
export type SectionContent = string | (() => string)

export interface SectionConfig {
  /** Unique section identifier (e.g., 'store-api', 'tui-primitives') */
  id: string
  /** Which slot this section belongs to */
  slot: Slot
  /** Priority within slot (lower = earlier). Default: 50 */
  priority?: number
  /** The content — string or function that returns string */
  content: SectionContent
  /** Optional: section IDs this must come after (cross-slot dependency) */
  after?: string[]
}

interface RegisteredSection {
  id: string
  slot: Slot
  priority: number
  content: SectionContent
  after: string[]
  dirty: boolean
  /** Cached resolved content (from last compile) */
  resolved: string
}

export interface ManifestStats {
  sections: number
  slots: Record<Slot, number>
  compiledChars: number
  compiledLines: number
  dirtyCount: number
  lastCompiled: number
}

// ─── Manifest ────────────────────────────────────────────

export class ToolManifest {
  private sections: Map<string, RegisteredSection> = new Map()
  private compiled: string = ''
  private lastCompiled: number = 0
  private needsFullRecompile: boolean = true

  /**
   * Register a section. Replaces existing section with same id.
   * Marks manifest as needing recompilation.
   */
  register(config: SectionConfig): this {
    const section: RegisteredSection = {
      id: config.id,
      slot: config.slot,
      priority: config.priority ?? 50,
      content: config.content,
      after: config.after ?? [],
      dirty: true,
      resolved: '',
    }
    this.sections.set(config.id, section)
    this.needsFullRecompile = true
    return this
  }

  /**
   * Unregister a section by id. Marks manifest for recompilation.
   */
  unregister(id: string): boolean {
    const removed = this.sections.delete(id)
    if (removed) this.needsFullRecompile = true
    return removed
  }

  /**
   * Mark a section as dirty — its provider will be re-called on next compile().
   * If id doesn't exist, no-op.
   */
  markDirty(id: string): void {
    const section = this.sections.get(id)
    if (section) {
      section.dirty = true
    }
  }

  /**
   * Update section content at runtime. Marks dirty automatically.
   */
  update(id: string, content: SectionContent): void {
    const section = this.sections.get(id)
    if (section) {
      section.content = content
      section.dirty = true
      // Content change might affect slot composition
      this.needsFullRecompile = true
    }
  }

  /**
   * Compile all sections into a single guide string.
   *
   * Full recompile when structure changed (register/unregister/update).
   * Incremental recompile when only dirty flags set (re-resolve providers,
   * splice into cached output).
   */
  compile(): string {
    if (this.sections.size === 0) {
      this.compiled = ''
      this.lastCompiled = Date.now()
      return this.compiled
    }

    const ordered = this.sortedSections()

    if (this.needsFullRecompile) {
      // Resolve all sections
      for (const s of ordered) {
        s.resolved = this.resolve(s)
        s.dirty = false
      }
      this.needsFullRecompile = false
    } else {
      // Incremental: only re-resolve dirty sections
      let anyDirty = false
      for (const s of ordered) {
        if (s.dirty) {
          s.resolved = this.resolve(s)
          s.dirty = false
          anyDirty = true
        }
      }
      if (!anyDirty) return this.compiled
    }

    // Concatenate resolved sections
    this.compiled = ordered
      .map(s => s.resolved)
      .filter(s => s.length > 0)
      .join('\n\n')

    this.lastCompiled = Date.now()
    return this.compiled
  }

  /**
   * Get the last compiled output without recompiling.
   * Call compile() first if you need fresh output.
   */
  get output(): string {
    return this.compiled
  }

  /** Whether any section is dirty or structure changed */
  get isDirty(): boolean {
    if (this.needsFullRecompile) return true
    for (const s of this.sections.values()) {
      if (s.dirty) return true
    }
    return false
  }

  /** Stats snapshot */
  stats(): ManifestStats {
    const slotCounts: Record<Slot, number> = {
      discipline: 0, shapes: 0, api: 0, patterns: 0, avoid: 0,
    }
    let dirtyCount = 0
    for (const s of this.sections.values()) {
      slotCounts[s.slot]++
      if (s.dirty) dirtyCount++
    }
    return {
      sections: this.sections.size,
      slots: slotCounts,
      compiledChars: this.compiled.length,
      compiledLines: this.compiled ? this.compiled.split('\n').length : 0,
      dirtyCount: this.needsFullRecompile ? this.sections.size : dirtyCount,
      lastCompiled: this.lastCompiled,
    }
  }

  /** List registered section IDs grouped by slot */
  inventory(): Record<Slot, string[]> {
    const result: Record<Slot, string[]> = {
      discipline: [], shapes: [], api: [], patterns: [], avoid: [],
    }
    for (const s of this.sortedSections()) {
      result[s.slot].push(s.id)
    }
    return result
  }

  // ── Private ────────────────────────────────────────────

  /** Resolve section content (call provider if function, else return string) */
  private resolve(section: RegisteredSection): string {
    if (typeof section.content === 'function') {
      try {
        return section.content()
      } catch {
        return `<!-- ${section.id}: provider error -->`
      }
    }
    return section.content
  }

  /**
   * Sort sections: slot order first, then priority within slot,
   * then apply `after` constraints via stable topological adjustment.
   */
  private sortedSections(): RegisteredSection[] {
    const all = Array.from(this.sections.values())

    // Primary sort: slot order, then priority
    all.sort((a, b) => {
      const slotDiff = SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]
      if (slotDiff !== 0) return slotDiff
      return a.priority - b.priority
    })

    // Apply `after` constraints — simple stable fixup.
    // If A must come after B, and A is currently before B, swap A to just after B.
    // Single pass is sufficient for non-pathological dependency chains.
    if (all.some(s => s.after.length > 0)) {
      const idxMap = new Map<string, number>()
      all.forEach((s, i) => idxMap.set(s.id, i))

      for (let i = 0; i < all.length; i++) {
        const section = all[i]
        for (const depId of section.after) {
          const depIdx = idxMap.get(depId)
          if (depIdx !== undefined && depIdx > i) {
            // Section is before its dependency — move it after
            all.splice(i, 1)
            all.splice(depIdx, 0, section)
            // Rebuild index map
            all.forEach((s, j) => idxMap.set(s.id, j))
            i-- // Re-check this position
            break
          }
        }
      }
    }

    return all
  }
}
