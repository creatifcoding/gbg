/**
 * SPIKE S4 — VariantSchema SQLite
 *
 * Prove heterogeneous cell data round-trips through SQLite
 * with per-cell Schema validation and JSON payload encoding.
 *
 * H10: 100K mixed-type cells insert in < 500ms
 * H11: Schema.decodeUnknownSync validates CellValue round-trip
 * H12: Full-text search across cell payloads (in-memory index)
 */

import { describe, it, expect } from "vitest"
import { Schema } from "effect-v4"
import {
  CellValue,
  CellValueFromString,
  num, str, bool, date, json, empty, error, formula,
  extractNumber, extractDisplay,
  type ColRow, cellKey,
} from "../src/index.js"
import { DatabaseSync } from "node:sqlite"

// ─── SQLite helper (direct, no Effect overhead) ─────

function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE cells (
      sheet_id  TEXT    NOT NULL,
      col       INTEGER NOT NULL,
      row       INTEGER NOT NULL,
      payload   TEXT    NOT NULL DEFAULT '{"_tag":"Empty"}',
      clock     INTEGER NOT NULL DEFAULT 0,
      agent_id  TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (sheet_id, col, row)
    ) WITHOUT ROWID
  `)
  return db
}

// ─── Tests ──────────────────────────────────────────

describe("S4: VariantSchema SQLite", () => {

  describe("CellValue Schema round-trip", () => {
    const decode = Schema.decodeUnknownSync(CellValue)

    it("decodes all 8 variants", () => {
      expect(decode({ _tag: "Empty" })).toEqual(empty())
      expect(decode({ _tag: "Number", value: 42 })).toEqual(num(42))
      expect(decode({ _tag: "String", value: "hi" })).toEqual(str("hi"))
      expect(decode({ _tag: "Boolean", value: true })).toEqual(bool(true))
      expect(decode({ _tag: "Date", value: "2025-01-01" })).toEqual(date("2025-01-01"))
      expect(decode({ _tag: "Json", value: [1, 2, 3] })).toEqual(json([1, 2, 3]))
      expect(decode({ _tag: "Error", error: "boom" })).toEqual(error("boom"))
      expect(decode({ _tag: "Formula", src: "=A1+B1", deps: ["0:0", "1:0"], cached: null }))
        .toEqual(formula("=A1+B1", ["0:0", "1:0"], null))
    })

    it("rejects invalid _tag", () => {
      expect(() => decode({ _tag: "Nope" })).toThrow()
    })

    it("rejects missing fields", () => {
      expect(() => decode({ _tag: "Number" })).toThrow()
    })
  })

  describe("CellValueFromString (JSON codec)", () => {
    const decodeFromString = Schema.decodeUnknownSync(CellValueFromString)
    const encodeToString = Schema.encodeSync(CellValueFromString)

    it("round-trips all variants through JSON string", () => {
      const variants: CellValue[] = [
        empty(),
        num(42),
        str("hello"),
        bool(false),
        date("2025-06-15T12:00:00Z"),
        json({ nested: { a: 1 } }),
        error("test error"),
        formula("=SUM(A1:A10)", ["0:0", "0:9"], null),
      ]

      for (const value of variants) {
        const jsonStr = encodeToString(value)
        expect(typeof jsonStr).toBe("string")
        const decoded = decodeFromString(jsonStr)
        expect(decoded).toEqual(value)
      }
    })

    it("perf: 100K encode/decode cycles in < 500ms", () => {
      const value = num(42)

      const start = performance.now()
      for (let i = 0; i < 100_000; i++) {
        const s = encodeToString(value)
        decodeFromString(s)
      }
      const elapsed = performance.now() - start

      console.log(`  S4/codec-perf: 100K encode/decode cycles in ${elapsed.toFixed(2)}ms (${(100_000 / elapsed * 1000).toFixed(0)} cycles/sec)`)
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe("SQLite round-trip", () => {

    it("inserts and reads back all cell types", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload) VALUES (?, ?, ?, ?)"
      )
      const select = db.prepare(
        "SELECT payload FROM cells WHERE sheet_id = ? AND col = ? AND row = ?"
      )

      const variants: [ColRow, CellValue][] = [
        [{ col: 0, row: 0 }, num(42)],
        [{ col: 1, row: 0 }, str("hello")],
        [{ col: 2, row: 0 }, bool(true)],
        [{ col: 3, row: 0 }, date("2025-01-01")],
        [{ col: 4, row: 0 }, json({ a: [1, 2] })],
        [{ col: 5, row: 0 }, error("test")],
        [{ col: 6, row: 0 }, formula("=A1", ["0:0"], null)],
        [{ col: 7, row: 0 }, empty()],
      ]

      for (const [addr, value] of variants) {
        insert.run("default", addr.col, addr.row, JSON.stringify(value))
      }

      const decode = Schema.decodeUnknownSync(CellValue)
      for (const [addr, expected] of variants) {
        const row = select.get("default", addr.col, addr.row) as any
        const decoded = decode(JSON.parse(row.payload))
        expect(decoded).toEqual(expected)
      }

      db.close()
    })

    it("H10: 100K mixed-type inserts in < 500ms", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload) VALUES (?, ?, ?, ?)"
      )

      const types: CellValue[] = [
        num(42), str("hello"), bool(true), date("2025-01-01"),
        json({ key: "val" }), empty(), error("err"), formula("=1+1", [], null),
      ]

      const start = performance.now()
      db.exec("BEGIN")
      for (let i = 0; i < 100_000; i++) {
        const value = types[i % types.length]
        insert.run("default", i % 1000, Math.floor(i / 1000), JSON.stringify(value))
      }
      db.exec("COMMIT")
      const elapsed = performance.now() - start

      // Verify count
      const count = db.prepare("SELECT COUNT(*) as cnt FROM cells").get() as any
      expect(count.cnt).toBe(100_000)

      console.log(`  S4/H10: 100K inserts in ${elapsed.toFixed(2)}ms (${(100_000 / elapsed * 1000).toFixed(0)} inserts/sec)`)
      expect(elapsed).toBeLessThan(500)

      db.close()
    })

    it("H10-read: 100K reads in < 200ms", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload) VALUES (?, ?, ?, ?)"
      )

      // Seed 100K rows
      db.exec("BEGIN")
      for (let i = 0; i < 100_000; i++) {
        insert.run("default", i % 1000, Math.floor(i / 1000), JSON.stringify(num(i)))
      }
      db.exec("COMMIT")

      // Read all 100K
      const start = performance.now()
      const rows = db.prepare("SELECT payload FROM cells WHERE sheet_id = 'default'").all() as any[]
      const elapsed = performance.now() - start

      expect(rows.length).toBe(100_000)
      console.log(`  S4/H10-read: 100K rows read in ${elapsed.toFixed(2)}ms (${(100_000 / elapsed * 1000).toFixed(0)} reads/sec)`)
      expect(elapsed).toBeLessThan(200)

      db.close()
    })

    it("json_extract queries by cell type", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload) VALUES (?, ?, ?, ?)"
      )

      // Insert mixed types
      insert.run("default", 0, 0, JSON.stringify(num(42)))
      insert.run("default", 1, 0, JSON.stringify(str("hello")))
      insert.run("default", 2, 0, JSON.stringify(formula("=A1", [], null)))
      insert.run("default", 3, 0, JSON.stringify(num(100)))

      // Query only Number cells
      const numbers = db.prepare(
        "SELECT col, row, payload FROM cells WHERE json_extract(payload, '$._tag') = 'Number'"
      ).all() as any[]

      expect(numbers.length).toBe(2)

      // Query only Formula cells
      const formulas = db.prepare(
        "SELECT col, row, json_extract(payload, '$.src') as src FROM cells WHERE json_extract(payload, '$._tag') = 'Formula'"
      ).all() as any[]

      expect(formulas.length).toBe(1)
      expect(formulas[0].src).toBe("=A1")

      db.close()
    })

    it("H10-update: 10K cell updates in < 100ms", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload, clock) VALUES (?, ?, ?, ?, ?)"
      )
      const update = db.prepare(
        "UPDATE cells SET payload = ?, clock = clock + 1, updated_at = datetime('now') WHERE sheet_id = ? AND col = ? AND row = ?"
      )

      // Seed 10K rows
      db.exec("BEGIN")
      for (let i = 0; i < 10_000; i++) {
        insert.run("default", i % 100, Math.floor(i / 100), JSON.stringify(num(i)), 0)
      }
      db.exec("COMMIT")

      // Update all 10K
      const start = performance.now()
      db.exec("BEGIN")
      for (let i = 0; i < 10_000; i++) {
        update.run(
          JSON.stringify(num(i * 2)),
          "default", i % 100, Math.floor(i / 100),
        )
      }
      db.exec("COMMIT")
      const elapsed = performance.now() - start

      console.log(`  S4/H10-update: 10K updates in ${elapsed.toFixed(2)}ms (${(10_000 / elapsed * 1000).toFixed(0)} updates/sec)`)
      expect(elapsed).toBeLessThan(100)

      // Verify
      const row = db.prepare(
        "SELECT payload FROM cells WHERE sheet_id = 'default' AND col = 50 AND row = 0"
      ).get() as any
      expect(JSON.parse(row.payload).value).toBe(100)

      db.close()
    })

    it("range query perf: select 10K cells from 100K", () => {
      const db = createDb()
      const insert = db.prepare(
        "INSERT INTO cells (sheet_id, col, row, payload) VALUES (?, ?, ?, ?)"
      )

      // Seed 100K rows: 1000 cols × 100 rows
      db.exec("BEGIN")
      for (let i = 0; i < 100_000; i++) {
        insert.run("default", i % 1000, Math.floor(i / 1000), JSON.stringify(num(i)))
      }
      db.exec("COMMIT")

      // Range query: cols 0-99, rows 0-99 = 10K cells
      const start = performance.now()
      const rows = db.prepare(
        "SELECT payload FROM cells WHERE sheet_id = 'default' AND col BETWEEN 0 AND 99 AND row BETWEEN 0 AND 99"
      ).all() as any[]
      const elapsed = performance.now() - start

      expect(rows.length).toBe(10_000)
      console.log(`  S4/range-perf: 10K cell range query in ${elapsed.toFixed(2)}ms`)
      expect(elapsed).toBeLessThan(50)

      db.close()
    })
  })
})
