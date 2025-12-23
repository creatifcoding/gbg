/**
 * KORI Testbed stx Integration Test
 *
 * Verifies the critical fix: spawn/query uses the same KoriWorld instance
 * via the singleton koriRuntimeAtom.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { koriOps, koriRuntimeAtom } from "../kori-testbed-stx"
import type { TraitId } from "@/lib/kori"

describe("KORI Testbed - Singleton Runtime", () => {
  // Note: Each test shares the same singleton runtime.
  // We'll spawn unique entities to avoid conflicts.

  describe("koriOps.spawnWithTraits + koriOps.queryAll", () => {
    it("should persist entities across spawn/query operations", async () => {
      // This is the critical test that was failing before the fix.
      // Before: Each operation got a new KoriWorld (entities vanished)
      // After: All operations share the same KoriWorld via koriRuntimeAtom

      const initialEntities = await koriOps.queryAll()
      const initialCount = initialEntities.length

      // Spawn an entity
      const traits = [
        {
          id: "Position2D" as TraitId,
          data: { _tag: "Position2D", x: 42, y: 42 },
        },
        {
          id: "Health" as TraitId,
          data: { _tag: "Health", current: 100, max: 100 },
        },
      ]

      const spawned = await koriOps.spawnWithTraits(traits)
      expect(spawned).toBeDefined()
      expect(spawned.id).toBeDefined()

      // Query should now include the spawned entity
      const afterSpawn = await koriOps.queryAll()
      expect(afterSpawn.length).toBe(initialCount + 1)

      // Verify the entity has our traits
      const found = afterSpawn.find((e) => e.id === spawned.id)
      expect(found).toBeDefined()
      expect(found?.traits.has("Position2D" as TraitId)).toBe(true)
      expect(found?.traits.has("Health" as TraitId)).toBe(true)
    })

    it("should persist multiple entities", async () => {
      const before = await koriOps.queryAll()
      const beforeCount = before.length

      // Spawn 3 entities
      const spawns = await Promise.all([
        koriOps.spawnWithTraits([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 1, y: 1 } },
        ]),
        koriOps.spawnWithTraits([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 2, y: 2 } },
        ]),
        koriOps.spawnWithTraits([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 3, y: 3 } },
        ]),
      ])

      expect(spawns).toHaveLength(3)
      expect(spawns.every((s) => s.id)).toBe(true)

      const after = await koriOps.queryAll()
      expect(after.length).toBe(beforeCount + 3)
    })
  })

  describe("koriOps.destroy", () => {
    it("should remove entity from world", async () => {
      // Spawn an entity
      const spawned = await koriOps.spawnWithTraits([
        { id: "Name" as TraitId, data: { _tag: "Name", value: "ToDestroy" } },
      ])

      const beforeDestroy = await koriOps.queryAll()
      const hasEntity = beforeDestroy.some((e) => e.id === spawned.id)
      expect(hasEntity).toBe(true)

      // Destroy it
      await koriOps.destroy(spawned.id)

      // Query should no longer include it
      const afterDestroy = await koriOps.queryAll()
      const stillHasEntity = afterDestroy.some((e) => e.id === spawned.id)
      expect(stillHasEntity).toBe(false)
    })
  })

  describe("koriOps.addTrait", () => {
    it("should add trait to existing entity", async () => {
      // Spawn entity without Name trait
      const spawned = await koriOps.spawnWithTraits([
        { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 0, y: 0 } },
      ])

      // Verify no Name trait initially
      const beforeAdd = await koriOps.queryAll()
      const entityBefore = beforeAdd.find((e) => e.id === spawned.id)
      expect(entityBefore?.traits.has("Name" as TraitId)).toBe(false)

      // Add Name trait
      await koriOps.addTrait({
        entityId: spawned.id,
        traitId: "Name" as TraitId,
        data: { _tag: "Name", value: "TestEntity" },
      })

      // Verify Name trait was added
      const afterAdd = await koriOps.queryAll()
      const entityAfter = afterAdd.find((e) => e.id === spawned.id)
      expect(entityAfter?.traits.has("Name" as TraitId)).toBe(true)

      const nameData = entityAfter?.traits.get("Name" as TraitId)
      expect(nameData).toEqual({ _tag: "Name", value: "TestEntity" })
    })
  })
})
