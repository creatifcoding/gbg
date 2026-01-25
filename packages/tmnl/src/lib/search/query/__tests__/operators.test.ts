/**
 * QueryDSL Stream Operators Tests
 *
 * Tests for withFieldMatch, withCategory, withScope, withRegexFilter,
 * withPhraseMatch, sortedBy, sortedByScore, sortedByName, withFieldOperators.
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect, Stream, Chunk } from "effect"
import {
  withFieldMatch,
  withCategory,
  withScope,
  withRegexFilter,
  withRegexFieldFilter,
  withPhraseMatch,
  withPhraseFieldMatch,
  sortedBy,
  sortedByScore,
  sortedByName,
  withFieldOperators,
} from "../operators"
import type { SearchResult } from "../../types"
import type { SearchableItem } from "../executor"
import type { FieldOperator } from "../schemas"

// =============================================================================
// Test Fixtures
// =============================================================================

interface TestItem extends SearchableItem {
  id: string
  name: string
  description?: string
  category?: string
  scope?: string
}

const testItems: TestItem[] = [
  { id: "1", name: "Add Row", description: "Add a new row", category: "grid", scope: "editor" },
  { id: "2", name: "Delete Row", description: "Delete selected row", category: "grid", scope: "editor" },
  { id: "3", name: "Save Buffer", description: "Save to disk", category: "buffer", scope: "global" },
  { id: "4", name: "Navigation", description: "Open nav menu", category: "nav", scope: "global" },
  { id: "5", name: "Debug Panel", description: "Toggle debug", category: "debug", scope: "debug" },
]

const toResults = (items: TestItem[]): SearchResult<TestItem>[] =>
  items.map((item, i) => ({ item, score: 1 - i * 0.1 }))

const runStream = <T extends SearchableItem>(
  stream: Stream.Stream<SearchResult<T>, never>
): SearchResult<T>[] =>
  Effect.runSync(
    stream.pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
  ) as SearchResult<T>[]

// =============================================================================
// withFieldMatch Tests
// =============================================================================

describe("withFieldMatch", () => {
  it("filters by category (include)", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldMatch("category", "grid")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.item.category === "grid")).toBe(true)
  })

  it("filters by category (exclude)", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldMatch("category", "grid", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.item.category !== "grid")).toBe(true)
  })

  it("is case insensitive", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldMatch("category", "GRID")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
  })

  it("filters by desc field", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldMatch("desc", "row")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
  })

  it("handles missing field (exclude keeps)", () => {
    const items: TestItem[] = [
      { id: "1", name: "No Category" },
      { id: "2", name: "Has Category", category: "grid" },
    ]
    const stream = Stream.fromIterable(toResults(items)).pipe(
      withFieldMatch("category", "grid", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("1")
  })
})

// =============================================================================
// withCategory & withScope Tests
// =============================================================================

describe("withCategory", () => {
  it("is shorthand for withFieldMatch category", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withCategory("grid")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.item.category === "grid")).toBe(true)
  })

  it("supports exclude", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withCategory("debug", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(4)
  })
})

describe("withScope", () => {
  it("is shorthand for withFieldMatch scope", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withScope("global")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.item.scope === "global")).toBe(true)
  })

  it("supports exclude", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withScope("debug", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(4)
  })
})

// =============================================================================
// withRegexFilter Tests
// =============================================================================

describe("withRegexFilter", () => {
  it("filters by regex on name", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFilter("^Add")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Add Row")
  })

  it("filters by regex on description", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFilter("menu$")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Navigation")
  })

  it("is case insensitive by default", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFilter("^add")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
  })

  it("respects case sensitivity", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFilter("^add", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(0)
  })

  it("passes through on invalid regex", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFilter("[invalid")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(5) // All pass through
  })
})

describe("withRegexFieldFilter", () => {
  it("filters by regex on specific field", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withRegexFieldFilter("category", "^g")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.item.category === "grid")).toBe(true)
  })

  it("handles missing field", () => {
    const items: TestItem[] = [
      { id: "1", name: "No Category" },
      { id: "2", name: "Has Category", category: "grid" },
    ]
    const stream = Stream.fromIterable(toResults(items)).pipe(
      withRegexFieldFilter("category", "grid")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("2")
  })
})

// =============================================================================
// withPhraseMatch Tests
// =============================================================================

describe("withPhraseMatch", () => {
  it("filters by exact phrase in name", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withPhraseMatch("Add Row")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Add Row")
  })

  it("filters by exact phrase in description", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withPhraseMatch("new row")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("1")
  })

  it("is case insensitive by default", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withPhraseMatch("add row")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
  })

  it("respects case sensitivity", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withPhraseMatch("add row", true)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(0)
  })
})

describe("withPhraseFieldMatch", () => {
  it("filters by phrase on specific field", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withPhraseFieldMatch("name", "Row")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
  })

  it("handles missing field", () => {
    const items: TestItem[] = [
      { id: "1", name: "No Desc" },
      { id: "2", name: "Has Desc", description: "Hello" },
    ]
    const stream = Stream.fromIterable(toResults(items)).pipe(
      withPhraseFieldMatch("desc", "Hello")
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("2")
  })
})

// =============================================================================
// Sort Operators Tests
// =============================================================================

describe("sortedByScore", () => {
  it("sorts by score descending", () => {
    const items = toResults(testItems) // Scores: 1, 0.9, 0.8, 0.7, 0.6
    const stream = Stream.fromIterable(items).pipe(sortedByScore())
    const results = runStream(stream)

    expect(results[0].score).toBe(1)
    expect(results[1].score).toBe(0.9)
    expect(results[4].score).toBe(0.6)
  })
})

describe("sortedByName", () => {
  it("sorts by name alphabetically", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(sortedByName())
    const results = runStream(stream)

    expect(results[0].item.name).toBe("Add Row")
    expect(results[1].item.name).toBe("Debug Panel")
    expect(results[2].item.name).toBe("Delete Row")
    expect(results[3].item.name).toBe("Navigation")
    expect(results[4].item.name).toBe("Save Buffer")
  })
})

describe("sortedBy", () => {
  it("sorts by score when specified", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(sortedBy("score"))
    const results = runStream(stream)

    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
  })

  it("sorts by name when specified", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(sortedBy("name"))
    const results = runStream(stream)

    expect(results[0].item.name).toBe("Add Row")
  })
})

// =============================================================================
// withFieldOperators Tests
// =============================================================================

describe("withFieldOperators", () => {
  it("applies multiple field operators", () => {
    const ops: readonly FieldOperator[] = [
      { _tag: "FieldOperator", field: "category", value: "grid", exclude: false },
      { _tag: "FieldOperator", field: "scope", value: "editor", exclude: false },
    ]
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldOperators(ops)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.item.category === "grid")).toBe(true)
    expect(results.every((r) => r.item.scope === "editor")).toBe(true)
  })

  it("applies mix of include and exclude", () => {
    const ops: readonly FieldOperator[] = [
      { _tag: "FieldOperator", field: "scope", value: "global", exclude: false },
      { _tag: "FieldOperator", field: "category", value: "nav", exclude: true },
    ]
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldOperators(ops)
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("3") // Save Buffer
  })

  it("returns all on empty operators", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withFieldOperators([])
    )
    const results = runStream(stream)

    expect(results).toHaveLength(5)
  })
})

// =============================================================================
// Composition Tests
// =============================================================================

describe("operator composition", () => {
  it("chains multiple operators", () => {
    const stream = Stream.fromIterable(toResults(testItems)).pipe(
      withCategory("grid"),
      withRegexFilter("^Add"),
      sortedByName()
    )
    const results = runStream(stream)

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Add Row")
  })

  it("maintains scores through filters", () => {
    const items = toResults(testItems)
    const stream = Stream.fromIterable(items).pipe(
      withCategory("grid"),
      withPhraseMatch("Row")
    )
    const results = runStream(stream)

    // Original scores preserved
    expect(results[0].score).toBe(1)
    expect(results[1].score).toBe(0.9)
  })
})
