# Spike Methodology

**EPOCH**: 2025-12-10
**Context**: AMS v2 Phase 5 - Debugging @effect/sql SQLite Integration

---

## What is a Spike?

A **spike** is a time-boxed, throwaway investigation designed to answer a specific technical question or prove/disprove a hypothesis. Unlike production code, spikes are:

- **Isolated** — Self-contained files with minimal dependencies
- **Ephemeral** — Can be deleted after learning is extracted
- **Verbose** — Heavy logging to expose internal state
- **Progressive** — Builds incrementally from simple to complex

---

## When to Spike

| Signal | Action |
|--------|--------|
| "Binding expected string, actual Option" | Spike: What does encoding actually produce? |
| "Works in PostgreSQL, fails in SQLite" | Spike: What are the binding type constraints? |
| "Schema error: missing _tag" | Spike: What is the encoded form at each layer? |
| "Tests pass individually, fail together" | Spike: Is there shared state pollution? |
| Documentation is unclear or absent | Spike: Empirical observation > guessing |

---

## Spike Structure

### Pattern: Progressive Isolation

Start with the smallest possible reproduction, then add layers until the bug manifests.

```typescript
// Test 1: Schema alone (no DB)
const test1 = Effect.gen(function* () {
  const encoded = yield* Schema.encode(MySchema)(value)
  console.log(`Encoded: ${JSON.stringify(encoded)} (type: ${typeof encoded})`)
})

// Test 2: Schema + Model (no DB)
const test2 = Effect.gen(function* () {
  const payload = MyModel.insert.make({ ... })
  const encoded = yield* Schema.encode(MyModel.insert)(payload)
  console.log(`Insert encoded: ${JSON.stringify(encoded)}`)
})

// Test 3: Schema + Model + Repository (no Layer)
const test3 = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const repo = yield* Model.makeRepository(MyModel, { ... })
  const result = yield* repo.insert(payload)
  console.log(`Insert result: ${JSON.stringify(result)}`)
})

// Test 4: Full integration with Layer
const test4 = Effect.gen(function* () {
  // Full stack test
}).pipe(Effect.provide(SqliteTestLayer))
```

### Pattern: Hypothesis Tagging

Name tests by hypothesis:

```typescript
// Test 3a: Custom NullableJsonFromString (WRONG approach)
const NullableJsonFromString_WRONG = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.Option(Schema.Unknown), // <-- Problem: OptionEncoded layer
  { ... }
)

// Test 3b: Custom NullableJsonFromString (CORRECT approach)
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.OptionFromSelf(Schema.Unknown), // <-- Option IS encoded form
  { ... }
)
```

---

## Spike Output Requirements

A spike must produce:

1. **Console output** showing actual values and types at each stage
2. **Pass/Fail conclusion** for each hypothesis
3. **Root cause identification** when bug is found
4. **Canonical fix** that can be extracted to production code

### Example Output Analysis

```
=== Test 1: Schema.OptionFromNullOr(parseJson) ===
Option.none() encodes to: "null" (type: string)     <-- BUG: string "null", not null

=== Test 3: Custom NullableJsonFromString ===
Option.none() encodes to: null (type: object)       <-- CORRECT: actual null
Option.some({foo:"bar"}) encodes to: "{\"foo\":\"bar\"}" (type: string)

=== Test 4: Full SQLite Integration ===
Insert successful! Result: {"id":"test-1","jsonField":{"_id":"Option","_tag":"None"}}

=== Test 5: SQLite with DateTime fields ===
Encoded createdAt type: [object Date]               <-- BUG: Date object
Test 5 failed: Binding expected string...           <-- CRASH: SQLite can't bind Date
```

---

## Spike Ethos

### 1. Don't Trust Documentation Alone

Documentation describes intent, not implementation. When behavior is unexpected:

```
WRONG: "The docs say it should work, so the bug must be elsewhere"
RIGHT: "Let me observe what actually happens with a spike"
```

### 2. Isolate Before You Integrate

Integration tests are for verification, not debugging. When debugging:

```
WRONG: Add console.logs to 500-line integration test
RIGHT: Extract minimal reproduction to spike file
```

### 3. Observe, Don't Assume

The spike's job is to reveal truth, not confirm beliefs:

```
WRONG: "I think the issue is X, let me write code assuming X"
RIGHT: "I think the issue is X. Let me write code that exposes whether X is true"
```

### 4. Name the Hypothesis

Every test in a spike should answer a specific question:

```
WRONG: test1, test2, test3
RIGHT:
- test1_optionFromNullOr_encodes_to_string_null
- test2_fieldOption_jsonFromString_produces_wrong_encoding
- test3_custom_transform_with_optionFromSelf_produces_correct_encoding
```

### 5. Preserve the Learning

After the spike reveals the fix:

1. Extract the fix to production code
2. Write documentation (like this file)
3. Keep the spike file as a reference (or delete if trivial)
4. Create a test that would have caught the bug

---

## Case Study: Nullable JSON + SQLite

### Initial Symptom
```
Error: Binding expected string, TypedArray, boolean, number, bigint or null
```

### Hypotheses
1. Option object is being passed to SQLite instead of being encoded
2. Model.FieldOption doesn't work with SQLite
3. Model.JsonFromString encodes null incorrectly
4. Schema.Option vs Schema.OptionFromSelf encoding differs

### Spike Tests

| Test | Hypothesis | Result |
|------|------------|--------|
| Test 1 | OptionFromNullOr(parseJson) encodes None to null | FAIL: Encodes to "null" string |
| Test 2 | FieldOption(JsonFromString) encodes None to null | FAIL: Encodes to "null" string |
| Test 3a | Custom transform with Schema.Option | FAIL: _tag missing on decode |
| Test 3b | Custom transform with Schema.OptionFromSelf | PASS: Correct encoding |
| Test 4 | Full SQLite with simple model | PASS: Insert works |
| Test 5 | Full SQLite with DateTime fields | FAIL: Date object binding |
| Test 6 | findById debugging | PASS: Returns Option<T> |

### Root Causes Discovered
1. `Schema.Option` vs `Schema.OptionFromSelf` encoding difference
2. `Model.DateTimeInsertFromDate` produces Date, not string
3. `repo.findById()` returns `Option<T>`, not `T`

### Extracted Fixes
- `NullableJsonFromString` schema with `Schema.OptionFromSelf`
- Use `Model.DateTimeInsert` instead of `Model.DateTimeInsertFromDate`
- Use `Option.getOrThrow()` when accessing findById results

---

## File Naming Convention

```
src/lib/{domain}/__tests__/spike-{topic}.ts
src/lib/{domain}/spikes/spike-{N}-{description}.ts
```

Examples:
- `spike-nullable-json.ts` — JSON encoding investigation
- `spike-5-server.ts` — Server integration spike #5
- `spike-datetime-sqlite.ts` — DateTime + SQLite binding spike

---

## Spike Lifecycle

```
Problem Detected
     │
     ▼
Create Spike File (isolated)
     │
     ▼
Progressive Tests (simple → complex)
     │
     ▼
Observe Output (don't assume)
     │
     ▼
Identify Root Cause
     │
     ▼
Extract Fix to Production
     │
     ▼
Document Learning (.edin/)
     │
     ▼
Decide: Keep or Delete Spike
```

---

## Spike vs Test vs Documentation

| Artifact | Purpose | Lifetime | Rigor |
|----------|---------|----------|-------|
| **Spike** | Discover truth | Ephemeral | Verbose, exploratory |
| **Test** | Verify behavior | Permanent | Precise, minimal |
| **Docs** | Transfer knowledge | Permanent | Clear, actionable |

A spike is neither a test nor documentation. It's a **conversation with the system** to expose hidden behavior.

---

## Summary

Spikes are the scalpel for debugging complex integrations. They:

1. **Isolate** — Remove variables until the bug is naked
2. **Observe** — Expose actual values, not assumed values
3. **Hypothesize** — Name what you're testing
4. **Progress** — Build from simple to complex
5. **Document** — Extract learning for future reference

When facing "it should work but doesn't," reach for a spike before reaching for Stack Overflow.
