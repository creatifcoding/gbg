/**
 * RPC Group Surface Area Contract Tests
 *
 * These tests lock down the surface area of the IIoTRpcs group to catch
 * accidental removals, renames, or structural changes.
 *
 * The combined IIoTRpcs group composes 16 sub-groups:
 * - 14 entity-derived groups (via EntityProxy.toRpcGroup)
 * - 2 stateless query groups (SensorRpcs, AssetRpcs)
 *
 * @module
 */

import { describe, it, expect } from 'vitest'

// Combined group
import { IIoTRpcs } from '../../../rpc'

// Individual sub-groups for verification
import { PlantRpcs } from '../../../rpc/PlantRpcs'
import { LineRpcs } from '../../../rpc/LineRpcs'
import { WorkCellRpcs } from '../../../rpc/WorkCellRpcs'
import { MachineAssetRpcs } from '../../../rpc/MachineAssetRpcs'
import { DeviceRpcs } from '../../../rpc/DeviceRpcs'
import { SensorAssetRpcs } from '../../../rpc/SensorAssetRpcs'
import { EnterpriseRpcs } from '../../../rpc/EnterpriseRpcs'
import { SiteRpcs } from '../../../rpc/SiteRpcs'
import { AreaRpcs } from '../../../rpc/AreaRpcs'
import { AlarmRpcs } from '../../../rpc/AlarmRpcs'
import { WorkOrderRpcs } from '../../../rpc/WorkOrderRpcs'
import { EquipmentStateRpcs } from '../../../rpc/EquipmentStateRpcs'
import { AssetEntityRpcs } from '../../../rpc/AssetEntityRpcs'
import { SensorEntityRpcs } from '../../../rpc/SensorEntityRpcs'
import { SensorRpcs } from '../../../rpc/SensorRpcs'
import { AssetRpcs } from '../../../rpc/AssetRpcs'

// Helper: extract tags from an RpcGroup
const getTags = (group: { requests: ReadonlyMap<string, unknown> }): string[] =>
  Array.from(group.requests.keys())

// All 16 sub-groups in composition order
const ALL_SUB_GROUPS = [
  { name: 'SensorRpcs', group: SensorRpcs, kind: 'stateless' as const },
  { name: 'AssetRpcs', group: AssetRpcs, kind: 'stateless' as const },
  { name: 'AlarmRpcs', group: AlarmRpcs, kind: 'mixed' as const },
  { name: 'WorkOrderRpcs', group: WorkOrderRpcs, kind: 'entity' as const },
  { name: 'EquipmentStateRpcs', group: EquipmentStateRpcs, kind: 'entity' as const },
  { name: 'PlantRpcs', group: PlantRpcs, kind: 'entity' as const },
  { name: 'LineRpcs', group: LineRpcs, kind: 'entity' as const },
  { name: 'WorkCellRpcs', group: WorkCellRpcs, kind: 'entity' as const },
  { name: 'MachineAssetRpcs', group: MachineAssetRpcs, kind: 'entity' as const },
  { name: 'DeviceRpcs', group: DeviceRpcs, kind: 'entity' as const },
  { name: 'SensorAssetRpcs', group: SensorAssetRpcs, kind: 'entity' as const },
  { name: 'EnterpriseRpcs', group: EnterpriseRpcs, kind: 'entity' as const },
  { name: 'SiteRpcs', group: SiteRpcs, kind: 'entity' as const },
  { name: 'AreaRpcs', group: AreaRpcs, kind: 'entity' as const },
  { name: 'AssetEntityRpcs', group: AssetEntityRpcs, kind: 'entity' as const },
  { name: 'SensorEntityRpcs', group: SensorEntityRpcs, kind: 'entity' as const },
] as const

// =============================================================================
// Combined IIoTRpcs
// =============================================================================

describe('RPC Group Surface Area', () => {
  describe('Combined IIoTRpcs', () => {
    it('should contain all sub-group requests', () => {
      const expectedTotal = ALL_SUB_GROUPS.reduce(
        (sum, { group }) => sum + group.requests.size,
        0
      )
      expect(IIoTRpcs.requests.size).toBe(expectedTotal)
    })

    it('should have no duplicate RPC tags', () => {
      const tags = getTags(IIoTRpcs)
      const uniqueTags = new Set(tags)
      expect(tags.length).toBe(uniqueTags.size)
    })

    it('should compose exactly 16 sub-groups', () => {
      expect(ALL_SUB_GROUPS).toHaveLength(16)
      for (const { group, name } of ALL_SUB_GROUPS) {
        expect(group.requests.size, `${name} should have requests`).toBeGreaterThan(0)
      }
    })

    it('should have all tags as non-empty strings', () => {
      const tags = getTags(IIoTRpcs)
      for (const tag of tags) {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
      }
    })

    it('should list all RPC tags sorted for diagnostic output', () => {
      const allTags = getTags(IIoTRpcs).sort()
      // Diagnostic: if this test fails, the sorted list helps identify changes
      expect(allTags.length).toBeGreaterThan(0)
      // Snapshot the count for stability tracking
      expect(allTags.length).toMatchSnapshot()
    })
  })

  // =============================================================================
  // Entity-Derived Sub-Groups
  // =============================================================================

  describe('Entity-derived sub-groups', () => {
    const entityGroups = ALL_SUB_GROUPS.filter(
      (g) => g.kind === 'entity' || g.kind === 'mixed'
    )

    for (const { name, group } of entityGroups) {
      describe(name, () => {
        it('should have at least one request', () => {
          expect(group.requests.size).toBeGreaterThan(0)
        })

        it('should have an even number of entity-derived RPCs or include stateless RPCs', () => {
          // Entity-derived RPCs come in pairs (standard + Discard)
          // Mixed groups (AlarmRpcs) add stateless RPCs on top
          // Pure entity groups should have even counts
          const tags = getTags(group)
          if (name !== 'AlarmRpcs') {
            // Pure entity groups: should have pairs (standard + Discard)
            expect(
              tags.length % 2,
              `${name} should have even count (standard + Discard pairs)`
            ).toBe(0)
          }
        })

        it('should have at least 2 operations (one standard + one discard)', () => {
          expect(group.requests.size).toBeGreaterThanOrEqual(2)
        })

        it('should have tags that are non-empty strings', () => {
          const tags = getTags(group)
          for (const tag of tags) {
            expect(typeof tag).toBe('string')
            expect(tag.length).toBeGreaterThan(0)
          }
        })

        it('should snapshot tag list for surface stability', () => {
          const tags = getTags(group).sort()
          expect(tags).toMatchSnapshot()
        })
      })
    }
  })

  // =============================================================================
  // Entity-Derived Tag Convention
  // =============================================================================

  describe('Entity-derived tag naming convention', () => {
    // Entity RPCs generated by EntityProxy.toRpcGroup follow the pattern:
    // ${EntityType}.${Operation} and ${EntityType}.${Operation}Discard
    const pureEntityGroups = ALL_SUB_GROUPS.filter((g) => g.kind === 'entity')

    for (const { name, group } of pureEntityGroups) {
      it(`${name}: all tags should follow EntityType.Operation pattern`, () => {
        const tags = getTags(group)
        for (const tag of tags) {
          // Entity-derived tags always contain a dot separator
          expect(tag, `Tag "${tag}" in ${name} should contain a dot separator`).toContain(
            '.'
          )
        }
      })

      it(`${name}: Discard variants should exist for each standard RPC`, () => {
        const tags = getTags(group)
        const standardTags = tags.filter((t) => !t.endsWith('Discard'))
        const discardTags = tags.filter((t) => t.endsWith('Discard'))

        expect(standardTags.length).toBe(discardTags.length)

        for (const stdTag of standardTags) {
          expect(
            discardTags,
            `Missing Discard variant for "${stdTag}"`
          ).toContain(`${stdTag}Discard`)
        }
      })
    }
  })

  // =============================================================================
  // Stateless Query Sub-Groups
  // =============================================================================

  describe('Stateless query sub-groups', () => {
    describe('SensorRpcs', () => {
      it('should have exactly 4 time-series query operations', () => {
        expect(SensorRpcs.requests.size).toBe(4)
      })

      it('should contain expected sensor query tags', () => {
        const tags = getTags(SensorRpcs)
        expect(tags).toMatchSnapshot()
      })
    })

    describe('AssetRpcs', () => {
      it('should have exactly 8 hierarchy query operations', () => {
        expect(AssetRpcs.requests.size).toBe(8)
      })

      it('should contain expected asset hierarchy tags', () => {
        const tags = getTags(AssetRpcs)
        expect(tags).toMatchSnapshot()
      })
    })
  })

  // =============================================================================
  // AlarmRpcs (Mixed: Entity + Stateless)
  // =============================================================================

  describe('AlarmRpcs (mixed entity + stateless)', () => {
    it('should have entity-derived RPCs (standard + Discard pairs)', () => {
      const tags = getTags(AlarmRpcs)
      const discardTags = tags.filter((t) => t.endsWith('Discard'))
      expect(discardTags.length).toBeGreaterThan(0)
    })

    it('should have stateless query RPCs (no Discard counterpart)', () => {
      const tags = getTags(AlarmRpcs)
      const discardTags = tags.filter((t) => t.endsWith('Discard'))
      const standardTags = tags.filter((t) => !t.endsWith('Discard'))
      // Stateless RPCs are the standard tags that don't have a matching Discard
      const statelessTags = standardTags.filter(
        (t) => !discardTags.includes(`${t}Discard`)
      )
      expect(statelessTags.length).toBeGreaterThan(0)
    })

    it('should have more requests than a pure entity group would', () => {
      // AlarmRpcs has entity RPCs + 3 stateless query RPCs
      // A pure entity group has only standard + Discard pairs
      const tags = getTags(AlarmRpcs)
      const discardTags = tags.filter((t) => t.endsWith('Discard'))
      // Pure entity groups have exactly N standard + N discard = 2N
      // AlarmRpcs has 2N + 3 stateless = more than 2N
      expect(tags.length).toBeGreaterThan(discardTags.length * 2)
    })

    it('should snapshot full tag list', () => {
      const tags = getTags(AlarmRpcs).sort()
      expect(tags).toMatchSnapshot()
    })
  })

  // =============================================================================
  // Cross-Group Uniqueness
  // =============================================================================

  describe('Cross-group uniqueness', () => {
    it('no two sub-groups should share the same tag', () => {
      const seenTags = new Map<string, string>()
      const duplicates: Array<{ tag: string; groups: string[] }> = []

      for (const { name, group } of ALL_SUB_GROUPS) {
        const tags = getTags(group)
        for (const tag of tags) {
          if (seenTags.has(tag)) {
            duplicates.push({
              tag,
              groups: [seenTags.get(tag)!, name],
            })
          } else {
            seenTags.set(tag, name)
          }
        }
      }

      expect(
        duplicates,
        `Found duplicate tags across sub-groups: ${JSON.stringify(duplicates, null, 2)}`
      ).toHaveLength(0)
    })
  })

  // =============================================================================
  // Per-Group Request Count Stability
  // =============================================================================

  describe('Per-group request counts', () => {
    for (const { name, group } of ALL_SUB_GROUPS) {
      it(`${name} request count should be stable`, () => {
        // Snapshot the count so any addition/removal is caught
        expect(group.requests.size).toMatchSnapshot()
      })
    }
  })
})
