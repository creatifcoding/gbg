/**
 * HierarchyPath — ISA-95 Equipment Hierarchy Path
 *
 * A typed data structure representing a position within the ISA-95 equipment hierarchy.
 * Provides efficient traversal, membership testing, and validation operations.
 *
 * @module @gbg/tmnl/iiot/schemas/hierarchy/path
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see thoughts/shared/specs/entity-system/02-hierarchy-path.md
 */

import { Schema, Effect, Data, Option, pipe } from 'effect'
import { EquipmentLevel } from '../identifiers'

// =============================================================================
// Errors
// =============================================================================

export class HierarchyError extends Data.TaggedError('HierarchyError')<{
  readonly message: string
  readonly code: 'INVALID_ROOT' | 'INVALID_PARENT_CHILD' | 'DUPLICATE_ID' | 'EMPTY_PATH'
}> {}

// =============================================================================
// Path Segment
// =============================================================================

/**
 * A single segment in the hierarchy path.
 * Represents one level with its equipment type and unique identifier.
 */
export class PathSegment extends Schema.TaggedClass<PathSegment>()('PathSegment', {
  /** Equipment level at this segment */
  level: EquipmentLevel,
  /** Asset identifier at this segment (e.g., 'ENT-acme', 'PLT-main') */
  id: Schema.String,
  /** Human-readable name (optional, for display) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
}) {}

export type PathSegmentType = typeof PathSegment.Type

// =============================================================================
// Valid Parent-Child Relationships
// =============================================================================

/**
 * ISA-95 valid parent-child relationships.
 * Key = child level, Value = array of valid parent levels.
 */
const VALID_PARENTS: Record<EquipmentLevel, ReadonlyArray<EquipmentLevel>> = {
  enterprise: [], // Root - no parent
  site: ['enterprise'],
  area: ['site'],
  plant: ['area', 'site'],
  line: ['plant', 'area'],
  workcell: ['line'],
  machine: ['workcell', 'line'],
  sensor: ['machine', 'workcell'],
  device: ['machine', 'workcell'],
}

/**
 * Check if a parent-child relationship is valid per ISA-95.
 */
export const isValidParentChild = (
  parentLevel: EquipmentLevel,
  childLevel: EquipmentLevel
): boolean => {
  const validParents = VALID_PARENTS[childLevel]
  return validParents.includes(parentLevel)
}

// =============================================================================
// HierarchyPath
// =============================================================================

/**
 * A complete path through the ISA-95 equipment hierarchy.
 *
 * @example
 * ```typescript
 * const path = HierarchyPath.fromSegments([
 *   new PathSegment({ level: 'enterprise', id: 'ENT-acme' }),
 *   new PathSegment({ level: 'site', id: 'SIT-chicago' }),
 *   new PathSegment({ level: 'plant', id: 'PLT-main' }),
 * ])
 *
 * path.materialized // '/ENT-acme/SIT-chicago/PLT-main'
 * path.depth        // 3
 * path.leaf         // PathSegment { level: 'plant', id: 'PLT-main' }
 * ```
 */
export class HierarchyPath extends Schema.TaggedClass<HierarchyPath>()('HierarchyPath', {
  /** Ordered segments from root to leaf */
  segments: Schema.Array(PathSegment),

  /** Materialized string for display/URLs */
  materialized: Schema.String,

  /** Number of segments (0 = empty path) */
  depth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {
  // =========================================================================
  // Static Constructors
  // =========================================================================

  /**
   * Create a HierarchyPath from an array of segments.
   * Computes materialized string and depth automatically.
   */
  static fromSegments(segments: ReadonlyArray<PathSegment>): HierarchyPath {
    const materialized = segments.length === 0
      ? ''
      : '/' + segments.map(s => s.id).join('/')
    return new HierarchyPath({
      segments: [...segments],
      materialized,
      depth: segments.length,
    })
  }

  /**
   * Create an empty HierarchyPath.
   */
  static empty(): HierarchyPath {
    return new HierarchyPath({
      segments: [],
      materialized: '',
      depth: 0,
    })
  }

  /**
   * Create a root path (Enterprise only).
   */
  static root(enterpriseId: string, name?: string): HierarchyPath {
    const segment = new PathSegment({
      level: 'enterprise',
      id: enterpriseId,
      name: name ? Option.some(name as Schema.Schema.Type<typeof Schema.NonEmptyString>) : Option.none(),
    })
    return HierarchyPath.fromSegments([segment])
  }

  /**
   * Parse a materialized path string back to HierarchyPath.
   * Requires level information to be embedded in ID prefix.
   */
  static fromMaterialized(path: string): Effect.Effect<HierarchyPath, HierarchyError> {
    if (!path || path === '') {
      return Effect.succeed(HierarchyPath.empty())
    }

    const parts = path.split('/').filter(p => p.length > 0)

    return pipe(
      Effect.forEach(parts, (part) => {
        const level = inferLevelFromId(part)
        if (!level) {
          return Effect.fail(new HierarchyError({
            message: `Cannot infer level from ID: ${part}`,
            code: 'INVALID_ROOT',
          }))
        }
        return Effect.succeed(new PathSegment({
          level,
          id: part,
          name: Option.none(),
        }))
      }),
      Effect.map((segments) => HierarchyPath.fromSegments(segments))
    )
  }

  // =========================================================================
  // Accessors
  // =========================================================================

  /**
   * Get the root (first) segment.
   * @complexity O(1)
   */
  get root(): PathSegment | undefined {
    return this.segments[0]
  }

  /**
   * Get the leaf (last) segment.
   * @complexity O(1)
   */
  get leaf(): PathSegment | undefined {
    return this.segments[this.segments.length - 1]
  }

  /**
   * Check if path is empty.
   * @complexity O(1)
   */
  get isEmpty(): boolean {
    return this.depth === 0
  }

  // =========================================================================
  // Traversal Operations
  // =========================================================================

  /**
   * Get the parent path (all segments except leaf).
   * @returns HierarchyPath | null (null if root or empty)
   * @complexity O(d) where d = depth
   */
  getParent(): HierarchyPath | null {
    if (this.depth <= 1) return null
    const parentSegments = this.segments.slice(0, -1)
    return HierarchyPath.fromSegments(parentSegments)
  }

  /**
   * Get all ancestor paths from immediate parent to root.
   * @returns ReadonlyArray<HierarchyPath> (ordered parent-first)
   * @complexity O(d^2) where d = depth
   */
  getAncestors(): ReadonlyArray<HierarchyPath> {
    const ancestors: HierarchyPath[] = []
    let current: HierarchyPath | null = this.getParent()
    while (current !== null) {
      ancestors.push(current)
      current = current.getParent()
    }
    return ancestors
  }

  /**
   * Get all ancestor asset IDs from root to immediate parent.
   * @complexity O(d)
   */
  getAncestorIds(): ReadonlyArray<string> {
    return this.segments.slice(0, -1).map(s => s.id)
  }

  /**
   * Get the segment at a specific level.
   * @complexity O(d)
   */
  getAncestorAtLevel(level: EquipmentLevel): PathSegment | null {
    return this.segments.find(s => s.level === level) ?? null
  }

  // =========================================================================
  // Membership Operations
  // =========================================================================

  /**
   * Check if this path is an ancestor of another.
   * @complexity O(min(d1, d2))
   */
  isAncestorOf(other: HierarchyPath): boolean {
    if (this.depth >= other.depth) return false
    for (let i = 0; i < this.depth; i++) {
      if (this.segments[i].id !== other.segments[i].id) return false
    }
    return true
  }

  /**
   * Check if this path is a descendant of another.
   * @complexity O(min(d1, d2))
   */
  isDescendantOf(other: HierarchyPath): boolean {
    return other.isAncestorOf(this)
  }

  /**
   * Check if this path contains a specific asset ID.
   * @complexity O(d)
   */
  contains(assetId: string): boolean {
    return this.segments.some(s => s.id === assetId)
  }

  /**
   * Find the common ancestor with another path.
   * @complexity O(min(d1, d2))
   */
  getCommonAncestor(other: HierarchyPath): HierarchyPath | null {
    const commonSegments: PathSegment[] = []
    const minDepth = Math.min(this.depth, other.depth)

    for (let i = 0; i < minDepth; i++) {
      if (this.segments[i].id === other.segments[i].id) {
        commonSegments.push(this.segments[i])
      } else {
        break
      }
    }

    if (commonSegments.length === 0) return null
    return HierarchyPath.fromSegments(commonSegments)
  }

  // =========================================================================
  // Transformation Operations
  // =========================================================================

  /**
   * Append a new segment to create a child path.
   * Does NOT validate - use validate() after.
   * @complexity O(d)
   */
  append(segment: PathSegment): HierarchyPath {
    return HierarchyPath.fromSegments([...this.segments, segment])
  }

  /**
   * Slice the path to a specific depth.
   * @complexity O(d)
   */
  slice(depth: number): HierarchyPath {
    if (depth <= 0) return HierarchyPath.empty()
    if (depth >= this.depth) return this
    return HierarchyPath.fromSegments(this.segments.slice(0, depth))
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Get the materialized path string.
   * @complexity O(1) (pre-computed)
   */
  override toString(): string {
    return this.materialized
  }

  /**
   * Get array of IDs only.
   * @complexity O(d)
   */
  toIdArray(): ReadonlyArray<string> {
    return this.segments.map(s => s.id)
  }

  /**
   * Get URL-safe path (for routing).
   * @complexity O(d)
   */
  toUrlPath(): string {
    return this.segments.map(s => encodeURIComponent(s.id)).join('/')
  }

  // =========================================================================
  // Validation
  // =========================================================================

  /**
   * Validate the path against ISA-95 hierarchy rules.
   *
   * Rules:
   * 1. Root must be Enterprise (if non-empty)
   * 2. Each parent-child relationship must be valid
   * 3. No duplicate IDs
   *
   * @complexity O(d^2) due to duplicate check
   */
  validate(): Effect.Effect<void, HierarchyError> {
    // Rule: Empty path is valid
    if (this.isEmpty) {
      return Effect.void
    }

    // Rule 1: Root must be Enterprise
    const root = this.root!
    if (root.level !== 'enterprise') {
      return Effect.fail(new HierarchyError({
        message: `Path root must be 'enterprise', got '${root.level}'`,
        code: 'INVALID_ROOT',
      }))
    }

    // Rule 2: Valid parent-child relationships
    for (let i = 1; i < this.depth; i++) {
      const parent = this.segments[i - 1]
      const child = this.segments[i]
      if (!isValidParentChild(parent.level, child.level)) {
        return Effect.fail(new HierarchyError({
          message: `Invalid parent-child: '${parent.level}' cannot be parent of '${child.level}'`,
          code: 'INVALID_PARENT_CHILD',
        }))
      }
    }

    // Rule 3: No duplicate IDs
    const ids = new Set<string>()
    for (const segment of this.segments) {
      if (ids.has(segment.id)) {
        return Effect.fail(new HierarchyError({
          message: `Duplicate ID in path: '${segment.id}'`,
          code: 'DUPLICATE_ID',
        }))
      }
      ids.add(segment.id)
    }

    return Effect.void
  }

  /**
   * Check if a segment can be added as a child.
   * @complexity O(1)
   */
  canHaveChild(childLevel: EquipmentLevel): boolean {
    if (this.isEmpty) {
      return childLevel === 'enterprise'
    }
    return isValidParentChild(this.leaf!.level, childLevel)
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Infer equipment level from ID prefix.
 * Returns null if prefix is not recognized.
 */
function inferLevelFromId(id: string): EquipmentLevel | null {
  const prefixMap: Record<string, EquipmentLevel> = {
    'ENT-': 'enterprise',
    'SIT-': 'site',
    'ARA-': 'area',
    'PLT-': 'plant',
    'LIN-': 'line',
    'WCL-': 'workcell',
    'MCH-': 'machine',
    'SNS-': 'sensor',
    'DEV-': 'device',
  }

  for (const [prefix, level] of Object.entries(prefixMap)) {
    if (id.startsWith(prefix)) {
      return level
    }
  }
  return null
}

// =============================================================================
// Exports
// =============================================================================

export { VALID_PARENTS }
