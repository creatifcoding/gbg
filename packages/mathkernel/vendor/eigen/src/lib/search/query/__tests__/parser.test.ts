/**
 * QueryDSL Parser Tests
 *
 * Tests for parseQuery(), isValidRegex(), validateRegexPatterns(), formatQuery().
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import {
  parseQuery,
  isValidRegex,
  validateRegexPatterns,
  formatQuery,
} from "../parser"
import type { ParsedQuery } from "../schemas"

// =============================================================================
// Test Helpers
// =============================================================================

const runParse = (input: string): ParsedQuery =>
  Effect.runSync(parseQuery(input))

// =============================================================================
// parseQuery Tests
// =============================================================================

describe("parseQuery", () => {
  describe("empty and simple queries", () => {
    it("parses empty string", () => {
      const result = runParse("")
      expect(result.text).toBe("")
      expect(result.fieldOperators).toHaveLength(0)
      expect(result.regexOperators).toHaveLength(0)
      expect(result.phraseOperators).toHaveLength(0)
    })

    it("parses plain text", () => {
      const result = runParse("hello world")
      expect(result.text).toBe("hello world")
      expect(result.fieldOperators).toHaveLength(0)
    })

    it("trims whitespace", () => {
      const result = runParse("  spaced   out  ")
      expect(result.text).toBe("spaced out")
    })
  })

  describe("field operators", () => {
    it("parses category:value", () => {
      const result = runParse("category:grid")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0]).toEqual({
        _tag: "FieldOperator",
        field: "category",
        value: "grid",
        exclude: false,
      })
      expect(result.text).toBe("")
    })

    it("parses scope:value", () => {
      const result = runParse("scope:global")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("scope")
      expect(result.fieldOperators[0].value).toBe("global")
    })

    it("parses name:value", () => {
      const result = runParse("name:save")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("name")
    })

    it("parses desc:value", () => {
      const result = runParse("desc:buffer")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("desc")
    })

    it("parses keys:value", () => {
      const result = runParse("keys:ctrl")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("keys")
    })

    it("parses field:value alias", () => {
      const result = runParse("field:runtime")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("field")
      expect(result.fieldOperators[0].value).toBe("runtime")
    })

    it("parses exclusion -field:value", () => {
      const result = runParse("-scope:debug")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0]).toEqual({
        _tag: "FieldOperator",
        field: "scope",
        value: "debug",
        exclude: true,
      })
    })

    it("parses multiple field operators", () => {
      const result = runParse("category:grid -scope:debug name:add")
      expect(result.fieldOperators).toHaveLength(3)
      expect(result.fieldOperators[0].field).toBe("category")
      expect(result.fieldOperators[0].exclude).toBe(false)
      expect(result.fieldOperators[1].field).toBe("scope")
      expect(result.fieldOperators[1].exclude).toBe(true)
      expect(result.fieldOperators[2].field).toBe("name")
    })

    it("ignores invalid field names", () => {
      const result = runParse("invalid:foo category:grid")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].field).toBe("category")
      expect(result.text).toBe("invalid:foo")
    })
  })

  describe("quoted phrases", () => {
    it("parses single quoted phrase", () => {
      const result = runParse('"add row"')
      expect(result.phraseOperators).toHaveLength(1)
      expect(result.phraseOperators[0]).toEqual({
        _tag: "PhraseOperator",
        phrase: "add row",
      })
      expect(result.text).toBe("")
    })

    it("parses multiple quoted phrases", () => {
      const result = runParse('"add row" "delete column"')
      expect(result.phraseOperators).toHaveLength(2)
      expect(result.phraseOperators[0].phrase).toBe("add row")
      expect(result.phraseOperators[1].phrase).toBe("delete column")
    })

    it("preserves spaces inside quotes", () => {
      const result = runParse('"multi word phrase with spaces"')
      expect(result.phraseOperators[0].phrase).toBe(
        "multi word phrase with spaces"
      )
    })

    it("mixes phrases with plain text", () => {
      const result = runParse('search "exact phrase" more text')
      expect(result.phraseOperators).toHaveLength(1)
      expect(result.phraseOperators[0].phrase).toBe("exact phrase")
      expect(result.text).toBe("search more text")
    })
  })

  describe("regex operators", () => {
    it("parses regex:pattern", () => {
      const result = runParse("regex:^nav.*")
      expect(result.regexOperators).toHaveLength(1)
      expect(result.regexOperators[0]).toEqual({
        _tag: "RegexOperator",
        pattern: "^nav.*",
      })
    })

    it("parses multiple regex patterns", () => {
      const result = runParse("regex:^start regex:end$")
      expect(result.regexOperators).toHaveLength(2)
      expect(result.regexOperators[0].pattern).toBe("^start")
      expect(result.regexOperators[1].pattern).toBe("end$")
    })

    it("handles complex regex patterns", () => {
      const result = runParse("regex:[a-z]+\\d{2,4}")
      expect(result.regexOperators[0].pattern).toBe("[a-z]+\\d{2,4}")
    })
  })

  describe("search params", () => {
    it("parses case:sensitive", () => {
      const result = runParse("case:sensitive")
      expect(result.caseSensitive).toBe(true)
      expect(result.text).toBe("")
    })

    it("parses case:insensitive", () => {
      const result = runParse("case:insensitive")
      expect(result.caseSensitive).toBe(false)
    })

    it("parses exact: match mode", () => {
      const result = runParse("exact:")
      expect(result.matchMode).toBe("exact")
    })

    it("parses prefix: match mode", () => {
      const result = runParse("prefix:")
      expect(result.matchMode).toBe("prefix")
    })

    it("parses fuzzy: match mode", () => {
      const result = runParse("fuzzy:")
      expect(result.matchMode).toBe("fuzzy")
    })

    it("parses exact:text and keeps text", () => {
      const result = runParse("exact:save")
      expect(result.matchMode).toBe("exact")
      expect(result.text).toBe("save")
    })

    it("parses limit:N", () => {
      const result = runParse("limit:10")
      expect(result.limit).toBe(10)
    })

    it("parses limit:0", () => {
      const result = runParse("limit:0")
      expect(result.limit).toBe(0)
    })

    it("parses sort:score", () => {
      const result = runParse("sort:score")
      expect(result.sort).toBe("score")
    })

    it("parses sort:name", () => {
      const result = runParse("sort:name")
      expect(result.sort).toBe("name")
    })
  })

  describe("combined queries", () => {
    it("parses full complex query", () => {
      const result = runParse(
        'category:grid -scope:debug "add row" regex:^nav.* limit:10 sort:name case:sensitive'
      )

      expect(result.fieldOperators).toHaveLength(2)
      expect(result.fieldOperators[0].field).toBe("category")
      expect(result.fieldOperators[0].value).toBe("grid")
      expect(result.fieldOperators[1].field).toBe("scope")
      expect(result.fieldOperators[1].exclude).toBe(true)

      expect(result.phraseOperators).toHaveLength(1)
      expect(result.phraseOperators[0].phrase).toBe("add row")

      expect(result.regexOperators).toHaveLength(1)
      expect(result.regexOperators[0].pattern).toBe("^nav.*")

      expect(result.limit).toBe(10)
      expect(result.sort).toBe("name")
      expect(result.caseSensitive).toBe(true)
      expect(result.text).toBe("")
    })

    it("parses mixed text and operators", () => {
      const result = runParse("grid category:nav commands")
      expect(result.text).toBe("grid commands")
      expect(result.fieldOperators).toHaveLength(1)
      expect(result.fieldOperators[0].value).toBe("nav")
    })

    it("handles operators in any order", () => {
      const result = runParse("sort:score limit:5 category:grid")
      expect(result.sort).toBe("score")
      expect(result.limit).toBe(5)
      expect(result.fieldOperators[0].field).toBe("category")
    })
  })
})

// =============================================================================
// isValidRegex Tests
// =============================================================================

describe("isValidRegex", () => {
  it("returns true for valid patterns", () => {
    expect(isValidRegex("^nav.*")).toBe(true)
    expect(isValidRegex("[a-z]+")).toBe(true)
    expect(isValidRegex("\\d{2,4}")).toBe(true)
    expect(isValidRegex("hello")).toBe(true)
  })

  it("returns false for invalid patterns", () => {
    expect(isValidRegex("[")).toBe(false)
    expect(isValidRegex("(unclosed")).toBe(false)
    expect(isValidRegex("*invalid")).toBe(false)
    expect(isValidRegex("\\")).toBe(false)
  })
})

// =============================================================================
// validateRegexPatterns Tests
// =============================================================================

describe("validateRegexPatterns", () => {
  it("returns empty array for valid patterns", () => {
    const query = runParse("regex:^valid regex:[a-z]+")
    const invalid = Effect.runSync(validateRegexPatterns(query))
    expect(invalid).toHaveLength(0)
  })

  it("returns invalid patterns", () => {
    // Manually construct a query with invalid regex
    const query: ParsedQuery = {
      text: "",
      fieldOperators: [],
      regexOperators: [
        { _tag: "RegexOperator", pattern: "[invalid" },
        { _tag: "RegexOperator", pattern: "^valid" },
        { _tag: "RegexOperator", pattern: "(unclosed" },
      ],
      phraseOperators: [],
      matchMode: undefined,
      caseSensitive: undefined,
      limit: undefined,
      sort: undefined,
    }
    const invalid = Effect.runSync(validateRegexPatterns(query))
    expect(invalid).toHaveLength(2)
    expect(invalid).toContain("[invalid")
    expect(invalid).toContain("(unclosed")
  })
})

// =============================================================================
// formatQuery Tests
// =============================================================================

describe("formatQuery", () => {
  it("formats empty query", () => {
    const query = runParse("")
    expect(formatQuery(query)).toBe("")
  })

  it("formats field operators", () => {
    const query = runParse("category:grid -scope:debug")
    const formatted = formatQuery(query)
    expect(formatted).toContain("category:grid")
    expect(formatted).toContain("-scope:debug")
  })

  it("formats regex operators", () => {
    const query = runParse("regex:^nav.*")
    expect(formatQuery(query)).toContain("regex:^nav.*")
  })

  it("formats phrase operators", () => {
    const query = runParse('"add row"')
    expect(formatQuery(query)).toContain('"add row"')
  })

  it("formats params", () => {
    const query = runParse("limit:10 sort:name case:sensitive")
    const formatted = formatQuery(query)
    expect(formatted).toContain("limit:10")
    expect(formatted).toContain("sort:name")
    expect(formatted).toContain("case:sensitive")
  })

  it("formats free text", () => {
    const query = runParse("hello world")
    expect(formatQuery(query)).toContain("hello world")
  })

  it("round-trips complex query (preserves semantics)", () => {
    const original = 'category:grid "add row" regex:^nav limit:10'
    const parsed = runParse(original)
    const formatted = formatQuery(parsed)
    const reparsed = runParse(formatted)

    // Semantic equivalence
    expect(reparsed.fieldOperators).toEqual(parsed.fieldOperators)
    expect(reparsed.phraseOperators).toEqual(parsed.phraseOperators)
    expect(reparsed.regexOperators).toEqual(parsed.regexOperators)
    expect(reparsed.limit).toEqual(parsed.limit)
  })
})
