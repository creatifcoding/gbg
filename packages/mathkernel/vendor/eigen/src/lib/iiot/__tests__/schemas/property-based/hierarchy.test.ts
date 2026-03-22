/**
 * Mode 4: Hierarchy Invariant Tests
 *
 * Tests ISA-95 equipment hierarchy relationships and HierarchyPath operations.
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/hierarchy
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'
import { fc, generateValidHierarchyPath } from './helpers'

// =============================================================================
// Imports: Hierarchy
// =============================================================================
import {
  HierarchyPath,
  PathSegment,
  isValidParentChild,
  VALID_PARENTS,
} from '../../../schemas/hierarchy'

// =============================================================================
// MODE 4: Hierarchy Invariant Tests (~22 tests)
// =============================================================================

describe('Mode 4: Hierarchy Invariant Tests', () => {
  describe('Feature: ISA-95 Hierarchy Invariants', () => {
    describe('Scenario: Valid parent-child relationships', () => {
      it('enterprise has no valid parents (root level)', () => {
        expect(VALID_PARENTS.enterprise).toHaveLength(0)
      })

      it('site can only have enterprise as parent', () => {
        expect(VALID_PARENTS.site).toEqual(['enterprise'])
        expect(isValidParentChild('enterprise', 'site')).toBe(true)
        expect(isValidParentChild('site', 'site')).toBe(false)
      })

      it('area can only have site as parent', () => {
        expect(VALID_PARENTS.area).toEqual(['site'])
        expect(isValidParentChild('site', 'area')).toBe(true)
      })

      it('plant can have area or site as parent', () => {
        expect(VALID_PARENTS.plant).toContain('area')
        expect(VALID_PARENTS.plant).toContain('site')
        expect(isValidParentChild('area', 'plant')).toBe(true)
        expect(isValidParentChild('site', 'plant')).toBe(true)
      })

      it('line can have plant or area as parent', () => {
        expect(VALID_PARENTS.line).toContain('plant')
        expect(VALID_PARENTS.line).toContain('area')
      })

      it('machine can have workcell or line as parent', () => {
        expect(VALID_PARENTS.machine).toContain('workcell')
        expect(VALID_PARENTS.machine).toContain('line')
      })

      it('sensor can have machine or workcell as parent', () => {
        expect(VALID_PARENTS.sensor).toContain('machine')
        expect(VALID_PARENTS.sensor).toContain('workcell')
      })

      it('device can have machine or workcell as parent', () => {
        expect(VALID_PARENTS.device).toContain('machine')
        expect(VALID_PARENTS.device).toContain('workcell')
      })
    })

    describe('Scenario: HierarchyPath operations', () => {
      it('empty path is valid', () => {
        const empty = HierarchyPath.empty()
        expect(empty.isEmpty).toBe(true)
        expect(empty.depth).toBe(0)
        expect(empty.root).toBeUndefined()
        expect(empty.leaf).toBeUndefined()
      })

      it('root path has enterprise level', () => {
        const root = HierarchyPath.root('ENT-acme', 'ACME Corp')
        expect(root.depth).toBe(1)
        expect(root.root?.level).toBe('enterprise')
        expect(root.leaf?.level).toBe('enterprise')
      })

      it('getParent returns null for root path', () => {
        const root = HierarchyPath.root('ENT-acme')
        expect(root.getParent()).toBeNull()
      })

      it('getParent returns parent for non-root paths', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const path = HierarchyPath.fromSegments([enterprise, site])

        const parent = path.getParent()
        expect(parent).not.toBeNull()
        expect(parent?.depth).toBe(1)
        expect(parent?.leaf?.id).toBe('ENT-acme')
      })

      it('isAncestorOf works correctly', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const path1 = HierarchyPath.fromSegments([enterprise])
        const path2 = HierarchyPath.fromSegments([enterprise, site])

        expect(path1.isAncestorOf(path2)).toBe(true)
        expect(path2.isAncestorOf(path1)).toBe(false)
        expect(path1.isAncestorOf(path1)).toBe(false) // Not ancestor of itself
      })

      it('isDescendantOf is inverse of isAncestorOf', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const path1 = HierarchyPath.fromSegments([enterprise])
        const path2 = HierarchyPath.fromSegments([enterprise, site])

        expect(path2.isDescendantOf(path1)).toBe(true)
        expect(path1.isDescendantOf(path2)).toBe(false)
      })

      it('contains finds asset IDs in path', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const path = HierarchyPath.fromSegments([enterprise, site])

        expect(path.contains('ENT-acme')).toBe(true)
        expect(path.contains('SIT-chicago')).toBe(true)
        expect(path.contains('SIT-newYork')).toBe(false)
      })

      it('materialized path has correct format', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const path = HierarchyPath.fromSegments([enterprise, site])

        expect(path.materialized).toBe('/ENT-acme/SIT-chicago')
        expect(path.toString()).toBe('/ENT-acme/SIT-chicago')
      })

      it('slice truncates path to depth', () => {
        const enterprise = new PathSegment({
          level: 'enterprise',
          id: 'ENT-acme',
          name: Option.none(),
        })
        const site = new PathSegment({
          level: 'site',
          id: 'SIT-chicago',
          name: Option.none(),
        })
        const area = new PathSegment({
          level: 'area',
          id: 'ARA-north',
          name: Option.none(),
        })
        const path = HierarchyPath.fromSegments([enterprise, site, area])

        const sliced = path.slice(2)
        expect(sliced.depth).toBe(2)
        expect(sliced.leaf?.id).toBe('SIT-chicago')
      })
    })

    describe('Scenario: Hierarchy depth constraints', () => {
      it('generated paths have depth <= maxDepth', () => {
        fc.assert(
          fc.property(generateValidHierarchyPath(4), (path) => {
            return path.depth <= 4
          }),
          { numRuns: 50 }
        )
      })

      it('paths with depth >= 8 are possible (equipment hierarchy depth)', () => {
        // Build a max-depth path
        const segments = [
          new PathSegment({ level: 'enterprise', id: 'ENT-1', name: Option.none() }),
          new PathSegment({ level: 'site', id: 'SIT-1', name: Option.none() }),
          new PathSegment({ level: 'area', id: 'ARA-1', name: Option.none() }),
          new PathSegment({ level: 'plant', id: 'PLT-1', name: Option.none() }),
          new PathSegment({ level: 'line', id: 'LIN-1', name: Option.none() }),
          new PathSegment({ level: 'workcell', id: 'WCL-1', name: Option.none() }),
          new PathSegment({ level: 'machine', id: 'MCH-1', name: Option.none() }),
          new PathSegment({ level: 'sensor', id: 'SNS-1', name: Option.none() }),
        ]
        const path = HierarchyPath.fromSegments(segments)
        expect(path.depth).toBe(8)
      })
    })
  })
})
