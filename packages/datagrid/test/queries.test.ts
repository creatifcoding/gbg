/**
 * Tests for store/queries.ts — SQL query builders.
 */

import { describe, it, expect } from "vitest"
import {
  cellQueries, columnQueries, namedRangeQueries, opsLogQueries,
  type RangeRect,
} from "../src/index"

describe("cellQueries", () => {
  it("get generates correct SQL and params", () => {
    const q = cellQueries.get("s1", 2, 5)
    expect(q.sql).toContain("SELECT")
    expect(q.sql).toContain("sheet_id = ?")
    expect(q.params).toEqual(["s1", 2, 5])
  })

  it("upsert generates ON CONFLICT", () => {
    const q = cellQueries.upsert("s1", 0, 0, '{"_tag":"Number","value":42}', 1, "agent-a")
    expect(q.sql).toContain("INSERT INTO cells")
    expect(q.sql).toContain("ON CONFLICT")
    expect(q.params).toEqual(["s1", 0, 0, '{"_tag":"Number","value":42}', 1, "agent-a"])
  })

  it("range generates boundary conditions", () => {
    const range: RangeRect = { start: { col: 0, row: 0 }, end: { col: 5, row: 10 } }
    const q = cellQueries.range("s1", range)
    expect(q.sql).toContain("col >= ?")
    expect(q.sql).toContain("row <= ?")
    expect(q.params).toEqual(["s1", 0, 5, 0, 10])
  })

  it("byTag uses json_extract", () => {
    const q = cellQueries.byTag("s1", "Number")
    expect(q.sql).toContain("json_extract(payload, '$._tag')")
    expect(q.params).toEqual(["s1", "Number"])
  })

  it("delete generates correct params", () => {
    const q = cellQueries.delete("s1", 3, 7)
    expect(q.sql).toContain("DELETE FROM cells")
    expect(q.params).toEqual(["s1", 3, 7])
  })
})

describe("columnQueries", () => {
  it("upsert generates ON CONFLICT", () => {
    const q = columnQueries.upsert("s1", 0, "Price", "number", null, 150)
    expect(q.sql).toContain("INSERT INTO columns")
    expect(q.sql).toContain("ON CONFLICT")
    expect(q.params).toEqual(["s1", 0, "Price", "number", null, 150])
  })

  it("allForSheet orders by col", () => {
    const q = columnQueries.allForSheet("s1")
    expect(q.sql).toContain("ORDER BY col")
  })
})

describe("namedRangeQueries", () => {
  it("upsert maps RangeRect fields", () => {
    const range: RangeRect = { start: { col: 0, row: 0 }, end: { col: 3, row: 99 } }
    const q = namedRangeQueries.upsert("s1", "prices", range)
    expect(q.params).toEqual(["s1", "prices", 0, 0, 3, 99])
  })

  it("toRangeRect converts row to RangeRect", () => {
    const row = { sheet_id: "s1", name: "x", start_col: 1, start_row: 2, end_col: 3, end_row: 4 }
    const rect = namedRangeQueries.toRangeRect(row)
    expect(rect).toEqual({ start: { col: 1, row: 2 }, end: { col: 3, row: 4 } })
  })
})

describe("opsLogQueries", () => {
  it("insert generates correct params", () => {
    const q = opsLogQueries.insert("s1", 0, 0, '{"_tag":"Number","value":1}', 5, "agent-a", "applied")
    expect(q.sql).toContain("INSERT INTO ops_log")
    expect(q.params).toHaveLength(7)
  })

  it("prune keeps last N", () => {
    const q = opsLogQueries.prune("s1", 100)
    expect(q.sql).toContain("DELETE FROM ops_log")
    expect(q.sql).toContain("NOT IN")
    expect(q.params).toEqual(["s1", "s1", 100])
  })
})
