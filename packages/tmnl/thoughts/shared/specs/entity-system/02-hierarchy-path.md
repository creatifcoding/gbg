# HierarchyPath Specification

**Status:** DRAFT
**Date:** 2026-01-30
**Author:** architect-agent (Val)
**Scope:** ISA-95 Equipment Hierarchy Path Data Structure

---

## Overview

`HierarchyPath` is a typed data structure representing a position within the ISA-95 equipment hierarchy. It provides efficient traversal, membership testing, and validation operations with documented algorithmic characteristics.

**Key Properties:**
- Immutable after construction
- O(1) depth comparison
- O(d) traversal operations where d = depth
- Runtime-validated ISA-95 hierarchy rules

---

## ISA-95 Hierarchy Model

```
Level 4 (Enterprise)
    └── Level 3 (Site)
            └── Level 2 (Area)
                    └── Level 3* (Plant - functional within Site)
                            └── Level 1 (Line)
                                    └── Level 1 (WorkCell)
                                            └── Level 1 (Machine)
                                                    └── Level 0 (Sensor/Device)
```

*Plant is functionally L3 (MES/MOM) but exists within a geographic Site.

### Valid Parent-Child Relationships

| Child Level | Valid Parent Levels |
|-------------|---------------------|
| Site | Enterprise |
| Area | Site |
| Plant | Area, Site |
| Line | Plant, Area |
| WorkCell | Line |
| Machine | WorkCell, Line |
| Sensor/Device | Machine, WorkCell |

---

## Schema Definition

```typescript
import { Schema, Effect, Data } from 'effect'
import { EquipmentLevel, AssetId } from '../identifiers'

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
  /** Asset identifier at this segment */
  id: AssetId,
  /** Human-readable name (optional, for display) */
  name: Schema.optional(Schema.NonEmptyString),
}) {}

export type PathSegmentType = typeof PathSegment.Type

// =============================================================================
// HierarchyPath
// =============================================================================

/**
 * A complete path through the ISA-95 equipment hierarchy.
 * 
 * @example
 * ```typescript
 * const path = HierarchyPath.make({
 *   segments: [
 *     { level: 'enterprise', id: AssetId.make('ENT-acme') },
 *     { level: 'site', id: AssetId.make('SIT-chicago') },
 *     { level: 'plant', id: AssetId.make('PLT-main') },
 *   ],
 * })
 * 
 * path.materialized // '/ENT-acme/SIT-chicago/PLT-main'
 * path.depth        // 3
 * path.leaf         // { level: 'plant', id: 'PLT-main' }
 * ```
 */
export class HierarchyPath extends Schema.TaggedClass<HierarchyPath>()('HierarchyPath', {
  /** Ordered segments from root to leaf */
  segments: Schema.Array(PathSegment),
  
  /** Materialized string for display/URLs (computed on construction) */
  materialized: Schema.String,
  
  /** Number of segments (0 = empty path) */
  depth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {
  // =========================================================================
  // Accessors
  // =========================================================================

  /**
   * Get the root (first) segment.
   * @returns PathSegment | undefined
   * @complexity O(1)
   */
  get root(): PathSegment | undefined {
    return this.segments[0]
  }

  /**
   * Get the leaf (last) segment.
   * @returns PathSegment | undefined
   * @complexity O(1)
   */
  get leaf(): PathSegment | undefined {
    return this.segments[this.segments.length - 1]
  }

  /**
   * Check if path is empty.
   * @returns boolean
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
   * @complexity O(d) where d = depth (due to materialized recomputation)
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
   * @returns ReadonlyArray<AssetId>
   * @complexity O(d)
   */
  getAncestorIds(): ReadonlyArray<AssetId> {
    return this.segments.slice(0, -1).map(s => s.id)
  }

  // =========================================================================
  // Membership Operations
  // =========================================================================

  /**
   * Check if this path is an ancestor of another.
   * @param other - The potential descendant path
   * @returns boolean
   * @complexity O(min(d1, d2)) where d1, d2 = depths
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
   * @param other - The potential ancestor path
   * @returns boolean
   * @complexity O(min(d1, d2))
   */
  isDescendantOf(other: HierarchyPath): boolean {
    return other.isAncestorOf(this)
  }

  /**
   * Check if this path contains a specific asset ID.
   * @param assetId - The asset ID to search for
   * @returns boolean
   * @complexity O(d)
   */
  contains(assetId: AssetId): boolean {
    return this.segments.some(s => s.id === assetId)
  }

  /**
   * Find the lowest common ancestor with another path.
   * @param other - The other path
   * @returns HierarchyPath | null (null if no common ancestor)
   * @complexity O(min(d1, d2))
   */
  getCommonAncestor(other: HierarchyPath): HierarchyPath | null {
    const commonSegments: PathSegment[] = []
    const minLength = Math.min(this.depth, other.depth)
    
    for (let i = 0; i < minLength; i++) {
      if (this.segments[i].id === other.segments[i].id) {
        commonSegments.push(this.segments[i])
      } else {
        break
      }
    }
    
    if (commonSegments.length === 0) return null
    return HierarchyPath.fromSegments(commonSegments)
  }

  /**
   * Get the asset ID at a specific equipment level.
   * @param level - The equipment level to query
   * @returns AssetId | null
   * @complexity O(d)
   */
  getAncestorAtLevel(level: EquipmentLevel): AssetId | null {
    const segment = this.segments.find(s => s.level === level)
    return segment?.id ?? null
  }

  /**
   * Get the segment at a specific depth index.
   * @param index - Zero-based depth index
   * @returns PathSegment | undefined
   * @complexity O(1)
   */
  getSegmentAt(index: number): PathSegment | undefined {
    return this.segments[index]
  }

  // =========================================================================
  // Validation Operations
  // =========================================================================

  /**
   * Validate the path against ISA-95 hierarchy rules.
   * @returns Effect<void, HierarchyValidationError, never>
   * @complexity O(d)
   */
  validate(): Effect.Effect<void, HierarchyValidationError, never> {
    return Effect.gen(function* (this: HierarchyPath) {
      // Rule 1: Non-empty paths must start with Enterprise
      if (this.depth > 0 && this.segments[0].level !== 'enterprise') {
        return yield* Effect.fail(new HierarchyValidationError({
          code: 'INVALID_ROOT',
          message: `Path must start with enterprise, got: ${this.segments[0].level}`,
          path: this,
        }))
      }

      // Rule 2: Each segment must be a valid child of its parent
      for (let i = 1; i < this.depth; i++) {
        const parent = this.segments[i - 1]
        const child = this.segments[i]
        
        if (!isValidParentChild(parent.level, child.level)) {
          return yield* Effect.fail(new HierarchyValidationError({
            code: 'INVALID_PARENT_CHILD',
            message: `Invalid hierarchy: ${child.level} cannot be child of ${parent.level}`,
            path: this,
            parentLevel: parent.level,
            childLevel: child.level,
          }))
        }
      }

      // Rule 3: No duplicate IDs in path
      const ids = new Set<string>()
      for (const segment of this.segments) {
        if (ids.has(segment.id)) {
          return yield* Effect.fail(new HierarchyValidationError({
            code: 'DUPLICATE_ID',
            message: `Duplicate asset ID in path: ${segment.id}`,
            path: this,
          }))
        }
        ids.add(segment.id)
      }

      return yield* Effect.void
    }.bind(this))
  }

  /**
   * Check if another path could be a valid child of this path.
   * @param childLevel - The equipment level of the potential child
   * @returns boolean
   * @complexity O(1)
   */
  canHaveChild(childLevel: EquipmentLevel): boolean {
    if (this.isEmpty) return childLevel === 'enterprise'
    const parentLevel = this.leaf!.level
    return isValidParentChild(parentLevel, childLevel)
  }

  // =========================================================================
  // Transformation Operations
  // =========================================================================

  /**
   * Append a child segment to create a new path.
   * @param segment - The child segment to append
   * @returns Effect<HierarchyPath, HierarchyValidationError, never>
   * @complexity O(d)
   */
  append(segment: PathSegment): Effect.Effect<HierarchyPath, HierarchyValidationError, never> {
    return Effect.gen(function* (this: HierarchyPath) {
      if (!this.canHaveChild(segment.level)) {
        return yield* Effect.fail(new HierarchyValidationError({
          code: 'INVALID_PARENT_CHILD',
          message: `Cannot append ${segment.level} to path ending with ${this.leaf?.level ?? 'empty'}`,
          path: this,
          childLevel: segment.level,
        }))
      }
      
      const newSegments = [...this.segments, segment]
      const newPath = HierarchyPath.fromSegments(newSegments)
      yield* newPath.validate()
      return newPath
    }.bind(this))
  }

  /**
   * Create a subpath from start to end indices.
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive)
   * @returns HierarchyPath
   * @complexity O(end - start)
   */
  slice(start: number, end?: number): HierarchyPath {
    return HierarchyPath.fromSegments(this.segments.slice(start, end))
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Convert to string representation (same as materialized).
   * @returns string
   * @complexity O(1)
   */
  toString(): string {
    return this.materialized
  }

  /**
   * Convert to array of asset IDs.
   * @returns ReadonlyArray<AssetId>
   * @complexity O(d)
   */
  toIdArray(): ReadonlyArray<AssetId> {
    return this.segments.map(s => s.id)
  }

  /**
   * Convert to URL-safe path component.
   * @returns string
   * @complexity O(d)
   */
  toUrlPath(): string {
    return this.segments.map(s => encodeURIComponent(s.id)).join('/')
  }

  // =========================================================================
  // Static Constructors
  // =========================================================================

  /**
   * Create a HierarchyPath from an array of segments.
   * @param segments - Ordered segments from root to leaf
   * @returns HierarchyPath
   * @complexity O(d)
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
   * Create a HierarchyPath from a materialized string.
   * @param path - Materialized path string (e.g., '/ENT-acme/SIT-chicago')
   * @param levelMap - Mapping of ID prefixes to equipment levels
   * @returns Effect<HierarchyPath, HierarchyParseError, never>
   * @complexity O(d)
   */
  static fromMaterialized(
    path: string,
    levelMap: Map<string, EquipmentLevel>
  ): Effect.Effect<HierarchyPath, HierarchyParseError, never> {
    return Effect.gen(function* () {
      if (path === '' || path === '/') {
        return HierarchyPath.fromSegments([])
      }

      const parts = path.startsWith('/') ? path.slice(1).split('/') : path.split('/')
      const segments: PathSegment[] = []

      for (const part of parts) {
        const prefix = part.split('-')[0]
        const level = levelMap.get(prefix)
        
        if (!level) {
          return yield* Effect.fail(new HierarchyParseError({
            message: `Unknown level prefix: ${prefix} in segment: ${part}`,
            input: path,
          }))
        }

        segments.push(new PathSegment({
          level,
          id: part as AssetId,
        }))
      }

      return HierarchyPath.fromSegments(segments)
    })
  }

  /**
   * Create an empty HierarchyPath.
   * @returns HierarchyPath
   * @complexity O(1)
   */
  static empty(): HierarchyPath {
    return new HierarchyPath({
      segments: [],
      materialized: '',
      depth: 0,
    })
  }

  /**
   * Create a single-segment path (root).
   * @param segment - The root segment
   * @returns Effect<HierarchyPath, HierarchyValidationError, never>
   * @complexity O(1)
   */
  static root(segment: PathSegment): Effect.Effect<HierarchyPath, HierarchyValidationError, never> {
    return Effect.gen(function* () {
      if (segment.level !== 'enterprise') {
        return yield* Effect.fail(new HierarchyValidationError({
          code: 'INVALID_ROOT',
          message: `Root must be enterprise level, got: ${segment.level}`,
          path: HierarchyPath.empty(),
        }))
      }
      return HierarchyPath.fromSegments([segment])
    })
  }
}

export type HierarchyPathType = typeof HierarchyPath.Type
```

---

## Error Types

```typescript
import { Data } from 'effect'
import type { EquipmentLevel } from '../identifiers'

/**
 * Error codes for hierarchy validation failures.
 */
export type HierarchyValidationCode =
  | 'INVALID_ROOT'        // Path doesn't start with enterprise
  | 'INVALID_PARENT_CHILD' // Child level invalid for parent
  | 'DUPLICATE_ID'         // Same asset ID appears twice
  | 'ORPHAN_PATH'          // Path doesn't connect to root
  | 'CYCLE_DETECTED'       // Path contains a cycle

/**
 * Validation error for hierarchy path operations.
 */
export class HierarchyValidationError extends Data.TaggedError('HierarchyValidationError')<{
  readonly code: HierarchyValidationCode
  readonly message: string
  readonly path: HierarchyPath
  readonly parentLevel?: EquipmentLevel
  readonly childLevel?: EquipmentLevel
}> {}

/**
 * Parse error when constructing path from string.
 */
export class HierarchyParseError extends Data.TaggedError('HierarchyParseError')<{
  readonly message: string
  readonly input: string
}> {}
```

---

## Validation Rules

### Rule 1: Root Must Be Enterprise

```typescript
// Valid
[enterprise] -> [site] -> [plant]

// Invalid - Missing enterprise root
[site] -> [plant]
// Error: INVALID_ROOT
```

### Rule 2: Valid Parent-Child Relationships

| Parent Level | Valid Child Levels |
|--------------|-------------------|
| enterprise | site |
| site | area, plant |
| area | plant, line |
| plant | line |
| line | workcell, machine |
| workcell | machine, sensor |
| machine | sensor |
| sensor | (none - leaf only) |

```typescript
// Valid transitions
enterprise -> site -> area -> plant -> line -> machine -> sensor

// Invalid
enterprise -> machine  // Error: INVALID_PARENT_CHILD
line -> enterprise     // Error: INVALID_PARENT_CHILD
```

### Rule 3: No Duplicate IDs

```typescript
// Invalid
[ENT-acme] -> [SIT-chicago] -> [SIT-chicago]
// Error: DUPLICATE_ID
```

### Rule 4: No Cycles (Implicit)

Since IDs must be unique and paths are acyclic by construction, cycles are prevented.

---

## Helper Functions

```typescript
/**
 * Check if a parent-child relationship is valid per ISA-95.
 * @param parent - Parent equipment level
 * @param child - Child equipment level
 * @returns boolean
 * @complexity O(1)
 */
export function isValidParentChild(
  parent: EquipmentLevel,
  child: EquipmentLevel
): boolean {
  const validChildren: Record<EquipmentLevel, ReadonlyArray<EquipmentLevel>> = {
    enterprise: ['site'],
    site: ['area', 'plant'],
    area: ['plant', 'line'],
    plant: ['line'],
    line: ['workcell', 'machine'],
    workcell: ['machine', 'sensor'],
    machine: ['sensor'],
    sensor: [],
  }
  
  return validChildren[parent].includes(child)
}

/**
 * Get the ISA-95 automation level for an equipment level.
 * @param level - Equipment level
 * @returns 0 | 1 | 2 | 3 | 4
 * @complexity O(1)
 */
export function getAutomationLevel(level: EquipmentLevel): 0 | 1 | 2 | 3 | 4 {
  const levels: Record<EquipmentLevel, 0 | 1 | 2 | 3 | 4> = {
    enterprise: 4,
    site: 3,
    area: 2,
    plant: 3, // Functional L3 within Site
    line: 1,
    workcell: 1,
    machine: 1,
    sensor: 0,
  }
  return levels[level]
}

/**
 * Standard prefix-to-level mapping for materialized path parsing.
 */
export const STANDARD_LEVEL_MAP = new Map<string, EquipmentLevel>([
  ['ENT', 'enterprise'],
  ['SIT', 'site'],
  ['ARE', 'area'],
  ['PLT', 'plant'],
  ['LIN', 'line'],
  ['WCL', 'workcell'],
  ['MCH', 'machine'],
  ['SEN', 'sensor'],
  ['DEV', 'sensor'], // Alias for sensor/device
])
```

---

## Time Complexity Summary

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `root`, `leaf`, `isEmpty` | O(1) | Direct array access |
| `getSegmentAt(i)` | O(1) | Array index |
| `depth` comparison | O(1) | Stored field |
| `getParent()` | O(d) | Recomputes materialized |
| `getAncestors()` | O(d^2) | Creates d paths |
| `getAncestorIds()` | O(d) | Array slice + map |
| `isAncestorOf()` | O(min(d1,d2)) | Segment comparison |
| `isDescendantOf()` | O(min(d1,d2)) | Delegates to isAncestorOf |
| `contains(id)` | O(d) | Linear search |
| `getCommonAncestor()` | O(min(d1,d2)) | Prefix comparison |
| `getAncestorAtLevel()` | O(d) | Linear search |
| `validate()` | O(d) | Single pass |
| `canHaveChild()` | O(1) | Lookup table |
| `append()` | O(d) | Validation + construction |
| `slice()` | O(end-start) | Array slice |
| `toString()` | O(1) | Returns stored field |
| `toIdArray()` | O(d) | Map operation |
| `toUrlPath()` | O(d) | Map + join |
| `fromSegments()` | O(d) | Materialized computation |
| `fromMaterialized()` | O(d) | String parsing |

Where d = depth (number of segments in path).

---

## Example Paths by Entity Type

### Enterprise (Root)

```typescript
const acmeCorp = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
])
// materialized: '/ENT-acme'
// depth: 1
```

### Site

```typescript
const chicagoSite = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago'
// depth: 2
```

### Area

```typescript
const assemblyArea = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'area', id: 'ARE-assembly' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/ARE-assembly'
// depth: 3
```

### Plant

```typescript
const mainPlant = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'area', id: 'ARE-assembly' as AssetId }),
  new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/ARE-assembly/PLT-main'
// depth: 4
```

### Line

```typescript
const lineAlpha = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId }),
  new PathSegment({ level: 'line', id: 'LIN-alpha' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/PLT-main/LIN-alpha'
// depth: 4
```

### WorkCell

```typescript
const weldCell = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId }),
  new PathSegment({ level: 'line', id: 'LIN-alpha' as AssetId }),
  new PathSegment({ level: 'workcell', id: 'WCL-weld-01' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/PLT-main/LIN-alpha/WCL-weld-01'
// depth: 5
```

### Machine

```typescript
const welderRobot = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId }),
  new PathSegment({ level: 'line', id: 'LIN-alpha' as AssetId }),
  new PathSegment({ level: 'workcell', id: 'WCL-weld-01' as AssetId }),
  new PathSegment({ level: 'machine', id: 'MCH-welder-001' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/PLT-main/LIN-alpha/WCL-weld-01/MCH-welder-001'
// depth: 6
```

### Sensor

```typescript
const tempSensor = HierarchyPath.fromSegments([
  new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId }),
  new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId }),
  new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId }),
  new PathSegment({ level: 'line', id: 'LIN-alpha' as AssetId }),
  new PathSegment({ level: 'workcell', id: 'WCL-weld-01' as AssetId }),
  new PathSegment({ level: 'machine', id: 'MCH-welder-001' as AssetId }),
  new PathSegment({ level: 'sensor', id: 'SEN-temp-001' as AssetId }),
])
// materialized: '/ENT-acme/SIT-chicago/PLT-main/LIN-alpha/WCL-weld-01/MCH-welder-001/SEN-temp-001'
// depth: 7
```

---

## Usage Patterns

### Building Paths Incrementally

```typescript
import { Effect, pipe } from 'effect'

const buildPath = Effect.gen(function* () {
  // Start with enterprise root
  const enterprise = yield* HierarchyPath.root(
    new PathSegment({ level: 'enterprise', id: 'ENT-acme' as AssetId })
  )
  
  // Append site
  const site = yield* enterprise.append(
    new PathSegment({ level: 'site', id: 'SIT-chicago' as AssetId })
  )
  
  // Append plant
  const plant = yield* site.append(
    new PathSegment({ level: 'plant', id: 'PLT-main' as AssetId })
  )
  
  return plant
})
```

### Finding Common Ancestors

```typescript
const sensorA = HierarchyPath.fromSegments([...enterpriseToMachine, sensorA])
const sensorB = HierarchyPath.fromSegments([...enterpriseToMachine, sensorB])

const commonAncestor = sensorA.getCommonAncestor(sensorB)
// Returns: machine path (last common segment)
```

### Validating Paths from External Input

```typescript
import { Effect } from 'effect'

const validateExternalPath = (input: string) =>
  Effect.gen(function* () {
    const path = yield* HierarchyPath.fromMaterialized(input, STANDARD_LEVEL_MAP)
    yield* path.validate()
    return path
  })
```

### Querying Ancestors

```typescript
// Get specific level
const siteId = sensorPath.getAncestorAtLevel('site')
// Returns: 'SIT-chicago' as AssetId

// Check membership
const belongsToPlant = sensorPath.contains('PLT-main' as AssetId)
// Returns: true

// Get all ancestor IDs
const ancestorIds = sensorPath.getAncestorIds()
// Returns: ['ENT-acme', 'SIT-chicago', 'PLT-main', 'LIN-alpha', 'WCL-weld-01', 'MCH-welder-001']
```

---

## Integration Points

### With Asset Schema

```typescript
// Asset now has optional hierarchyPath
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  name: Schema.NonEmptyString,
  kind: EquipmentLevel,
  status: AssetStatus,
  // ... existing fields ...
  
  /** Full hierarchy path (computed from parentId chain) */
  hierarchyPath: Schema.optional(HierarchyPath),
}) {}
```

### With Graph Queries

```typescript
// Cypher query to build path from asset
const getAssetPath = (assetId: AssetId) =>
  Effect.gen(function* () {
    const graph = yield* GraphClient
    const result = yield* graph.query(`
      MATCH path = (root:Asset {kind: 'enterprise'})-[:PARENT_OF*]->(a:Asset {id: $id})
      RETURN [n in nodes(path) | {level: n.kind, id: n.id}] as segments
    `, { id: assetId })
    
    return HierarchyPath.fromSegments(result.segments.map(s => new PathSegment(s)))
  })
```

### With EventLog

```typescript
// Include hierarchy path in events for context
export class AlarmTriggered extends Event.Event('AlarmTriggered', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  hierarchyPath: HierarchyPath,  // Full context of where alarm occurred
  // ... other fields ...
}) {}
```

---

## Success Criteria

- [ ] HierarchyPath can represent any valid ISA-95 equipment path
- [ ] All traversal operations have documented time complexity
- [ ] Validation prevents invalid hierarchy structures
- [ ] Materialized string enables efficient display and URL routing
- [ ] Integration with existing Asset schema is seamless
- [ ] Parse/serialize round-trips without data loss

---

## References

- ISA-95 / IEC 62264 Equipment Hierarchy Standard
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/schemas/identifiers.ts`
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/schemas/assets.ts`
- `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/thoughts/shared/specs/2026-01-29-extensible-fact-system-spec.md`
