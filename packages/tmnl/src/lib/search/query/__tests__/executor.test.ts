/**
 * QueryDSL Executor Tests
 *
 * Tests for applyFilters(), hasOperatorsOnly(), applyFieldFilter(),
 * applyRegexFilter(), applyPhraseFilter().
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import {
  applyFilters,
  hasOperatorsOnly,
  applyFieldFilter,
  applyRegexFilter,
  applyPhraseFilter,
  type SearchableItem,
} from "../executor"
import type { ParsedQuery, FieldOperator } from "../schemas"
import { parseQuery } from "../parser"

// =============================================================================
// Test Fixtures
// =============================================================================

interface TestItem extends SearchableItem {
  id: string
  name: string
  description?: string
  category?: string
  scope?: string
  keys?: string
}

const testItems: TestItem[] = [
  {
    id: "cmd-1",
    name: "Add Row",
    description: "Add a new row to the grid",
    category: "grid",
    scope: "editor",
    keys: "Ctrl+A",
  },
  {
    id: "cmd-2",
    name: "Delete Row",
    description: "Delete the selected row",
    category: "grid",
    scope: "editor",
  },
  {
    id: "cmd-3",
    name: "Save Buffer",
    description: "Save the current buffer to disk",
    category: "buffer",
    scope: "global",
    keys: "Ctrl+S",
  },
  {
    id: "cmd-4",
    name: "Navigation Menu",
    description: "Open the navigation menu",
    category: "nav",
    scope: "global",
  },
  {
    id: "cmd-5",
    name: "Debug Panel",
    description: "Toggle debug panel visibility",
    category: "debug",
    scope: "debug",
  },
]

const runParse = (input: string): ParsedQuery =>
  Effect.runSync(parseQuery(input))

// =============================================================================
// hasOperatorsOnly Tests
// =============================================================================

describe("hasOperatorsOnly", () => {
  it("returns false for empty query", () => {
    const query = runParse("")
    expect(hasOperatorsOnly(query)).toBe(false)
  })

  it("returns false for text-only query", () => {
    const query = runParse("hello world")
    expect(hasOperatorsOnly(query)).toBe(false)
  })

  it("returns true for field operator only", () => {
    const query = runParse("category:grid")
    expect(hasOperatorsOnly(query)).toBe(true)
  })

  it("returns true for exclusion only", () => {
    const query = runParse("-scope:debug")
    expect(hasOperatorsOnly(query)).toBe(true)
  })

  it("returns true for regex only", () => {
    const query = runParse("regex:^nav")
    expect(hasOperatorsOnly(query)).toBe(true)
  })

  it("returns true for phrase only", () => {
    const query = runParse('"add row"')
    expect(hasOperatorsOnly(query)).toBe(true)
  })

  it("returns true for multiple operators without text", () => {
    const query = runParse('category:grid -scope:debug "add"')
    expect(hasOperatorsOnly(query)).toBe(true)
  })

  it("returns false for mixed query (text + operators)", () => {
    const query = runParse("search category:grid")
    expect(hasOperatorsOnly(query)).toBe(false)
  })
})

// =============================================================================
// applyFilters Tests
// =============================================================================

describe("applyFilters", () => {
  describe("field operators (include)", () => {
    it("filters by category", () => {
      const query = runParse("category:grid")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.item.id)).toEqual(["cmd-1", "cmd-2"])
    })

    it("filters by scope", () => {
      const query = runParse("scope:global")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.item.id)).toEqual(["cmd-3", "cmd-4"])
    })

    it("filters by name (partial match)", () => {
      const query = runParse("name:row")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.item.name)).toEqual(["Add Row", "Delete Row"])
    })

    it("filters by desc", () => {
      const query = runParse("desc:buffer")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.id).toBe("cmd-3")
    })

    it("filters by keys", () => {
      const query = runParse("keys:ctrl")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.item.id)).toEqual(["cmd-1", "cmd-3"])
    })

    it("is case insensitive", () => {
      const query = runParse("category:GRID")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
    })

    it("applies multiple field filters (AND)", () => {
      const query = runParse("category:grid scope:editor")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results.map((r) => r.item.category)).toEqual(["grid", "grid"])
    })
  })

  describe("field operators (exclude)", () => {
    it("excludes by category", () => {
      const query = runParse("-category:debug")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(4)
      expect(results.every((r) => r.item.category !== "debug")).toBe(true)
    })

    it("excludes by scope", () => {
      const query = runParse("-scope:debug")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(4)
      expect(results.every((r) => r.item.scope !== "debug")).toBe(true)
    })

    it("combines include and exclude", () => {
      const query = runParse("scope:global -category:nav")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.id).toBe("cmd-3")
    })

    it("keeps items when excluded field is missing", () => {
      const items: TestItem[] = [
        { id: "1", name: "No Category" },
        { id: "2", name: "Has Category", category: "grid" },
      ]
      const query = runParse("-category:grid")
      const results = applyFilters(items, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.id).toBe("1")
    })
  })

  describe("regex operators", () => {
    it("filters by regex on name", () => {
      const query = runParse("regex:^Add")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.name).toBe("Add Row")
    })

    it("filters by regex on description", () => {
      const query = runParse("regex:grid$")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.description).toContain("grid")
    })

    it("is case insensitive by default", () => {
      const query = runParse("regex:^add")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
    })

    it("respects case sensitivity when set", () => {
      const query = runParse("regex:^add case:sensitive")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(0) // "Add Row" doesn't match ^add
    })

    it("skips invalid regex patterns", () => {
      // Manually construct a query with invalid regex
      const query: ParsedQuery = {
        text: "",
        fieldOperators: [],
        regexOperators: [{ _tag: "RegexOperator", pattern: "[invalid" }],
        phraseOperators: [],
      }
      const results = applyFilters(testItems, query)

      // Should return all items (invalid regex is skipped)
      expect(results).toHaveLength(5)
    })
  })

  describe("phrase operators", () => {
    it("filters by exact phrase in name", () => {
      const query = runParse('"Add Row"')
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.name).toBe("Add Row")
    })

    it("filters by exact phrase in description", () => {
      const query = runParse('"new row"')
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.id).toBe("cmd-1")
    })

    it("is case insensitive by default", () => {
      const query = runParse('"add row"')
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
    })

    it("respects case sensitivity", () => {
      const query = runParse('"add row" case:sensitive')
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(0) // "Add Row" doesn't match "add row"
    })
  })

  describe("sorting", () => {
    it("sorts by score (highest first)", () => {
      const query = runParse("category:grid sort:score")
      const results = applyFilters(testItems, query)

      // All have score=1 from applyFilters, but verify sorting doesn't break
      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    })

    it("sorts by name (alphabetical)", () => {
      const query = runParse("category:grid sort:name")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
      expect(results[0].item.name).toBe("Add Row")
      expect(results[1].item.name).toBe("Delete Row")
    })
  })

  describe("limit", () => {
    it("limits results", () => {
      const query = runParse("limit:2")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
    })

    it("limits after sorting", () => {
      const query = runParse("sort:name limit:3")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(3)
      // Should be first 3 alphabetically
      expect(results[0].item.name).toBe("Add Row")
    })

    it("handles limit larger than results", () => {
      const query = runParse("category:grid limit:100")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(2)
    })
  })

  describe("combined", () => {
    it("applies all filters together", () => {
      const query = runParse("category:grid -name:delete sort:name limit:1")
      const results = applyFilters(testItems, query)

      expect(results).toHaveLength(1)
      expect(results[0].item.name).toBe("Add Row")
    })

    it("sets score=1 for all results", () => {
      const query = runParse("category:grid")
      const results = applyFilters(testItems, query)

      expect(results.every((r) => r.score === 1)).toBe(true)
    })
  })
})

// =============================================================================
// Individual Filter Function Tests
// =============================================================================

describe("applyFieldFilter", () => {
  const toResults = (items: TestItem[]) =>
    items.map((item) => ({ item, score: 1 }))

  it("filters include", () => {
    const op: FieldOperator = {
      _tag: "FieldOperator",
      field: "category",
      value: "grid",
      exclude: false,
    }
    const results = applyFieldFilter(toResults(testItems), op)

    expect(results).toHaveLength(2)
  })

  it("filters exclude", () => {
    const op: FieldOperator = {
      _tag: "FieldOperator",
      field: "category",
      value: "grid",
      exclude: true,
    }
    const results = applyFieldFilter(toResults(testItems), op)

    expect(results).toHaveLength(3)
    expect(results.every((r) => r.item.category !== "grid")).toBe(true)
  })

  it("keeps items with missing field on exclude", () => {
    const items: TestItem[] = [
      { id: "1", name: "No Category" },
      { id: "2", name: "Has Category", category: "grid" },
    ]
    const op: FieldOperator = {
      _tag: "FieldOperator",
      field: "category",
      value: "grid",
      exclude: true,
    }
    const results = applyFieldFilter(toResults(items), op)

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("1")
  })
})

describe("applyRegexFilter", () => {
  const toResults = (items: TestItem[]) =>
    items.map((item) => ({ item, score: 1 }))

  it("filters by regex", () => {
    const results = applyRegexFilter(toResults(testItems), "^Nav")

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Navigation Menu")
  })

  it("is case insensitive by default", () => {
    const results = applyRegexFilter(toResults(testItems), "^nav")

    expect(results).toHaveLength(1)
  })

  it("respects case sensitivity", () => {
    const results = applyRegexFilter(toResults(testItems), "^nav", true)

    expect(results).toHaveLength(0)
  })

  it("returns unchanged for invalid regex", () => {
    const results = applyRegexFilter(toResults(testItems), "[invalid")

    expect(results).toHaveLength(5)
  })
})

describe("applyPhraseFilter", () => {
  const toResults = (items: TestItem[]) =>
    items.map((item) => ({ item, score: 1 }))

  it("filters by phrase", () => {
    const results = applyPhraseFilter(toResults(testItems), "Add Row")

    expect(results).toHaveLength(1)
    expect(results[0].item.name).toBe("Add Row")
  })

  it("is case insensitive by default", () => {
    const results = applyPhraseFilter(toResults(testItems), "add row")

    expect(results).toHaveLength(1)
  })

  it("respects case sensitivity", () => {
    const results = applyPhraseFilter(toResults(testItems), "add row", true)

    expect(results).toHaveLength(0)
  })

  it("matches in description", () => {
    const results = applyPhraseFilter(toResults(testItems), "new row")

    expect(results).toHaveLength(1)
    expect(results[0].item.id).toBe("cmd-1")
  })
})
