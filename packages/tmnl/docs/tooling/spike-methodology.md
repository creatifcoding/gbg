---
title: "Spike Methodology"
date: 2026-02-09
status: Active
source: .edin/SPIKE_METHODOLOGY.md
---

# Spike Methodology

A **spike** is a time-boxed, throwaway investigation designed to answer a specific technical question or prove/disprove a hypothesis.

## Properties

| Property | Description |
|----------|-------------|
| **Isolated** | Self-contained files with minimal dependencies |
| **Ephemeral** | Can be deleted after learning is extracted |
| **Verbose** | Heavy logging to expose internal state |
| **Progressive** | Builds incrementally from simple to complex |

## When to Spike

| Signal | Spike Question |
|--------|----------------|
| "Binding expected string, actual Option" | What does encoding actually produce? |
| "Works in PostgreSQL, fails in SQLite" | What are the binding type constraints? |
| "Schema error: missing _tag" | What is the encoded form at each layer? |
| "Tests pass individually, fail together" | Is there shared state pollution? |
| Documentation is unclear or absent | Empirical observation over guessing |

## Progressive Isolation Pattern

Start with the smallest possible reproduction, then add layers until the bug manifests:

```
Test 1: Schema alone (no DB)
  → Encode/decode roundtrip, log types and values

Test 2: Schema + Model (no DB)
  → Model.insert.make(), encode, inspect bindings

Test 3: Schema + Model + Repository (no Layer)
  → Manual SqlClient, repo operations, log results

Test 4: Full integration with Layer
  → Complete stack with service layers provided
```

Each test isolates one additional layer. When the bug first appears between Test N and Test N+1, the problematic layer is identified.

## Hypothesis Tagging

Name tests by what they're testing, not by number:

```
test1_optionFromNullOr_encodes_to_string_null
test2_fieldOption_jsonFromString_produces_wrong_encoding
test3_custom_transform_with_optionFromSelf_produces_correct_encoding
```

Mark wrong approaches explicitly:

```typescript
// Test 3a: Custom NullableJsonFromString (WRONG approach)
//   Uses Schema.Option — produces OptionEncoded layer
// Test 3b: Custom NullableJsonFromString (CORRECT approach)
//   Uses Schema.OptionFromSelf — Option IS the encoded form
```

## Spike Output Requirements

Every spike must produce:

1. **Console output** showing actual values and types at each stage
2. **Pass/Fail conclusion** for each hypothesis
3. **Root cause identification** when bug is found
4. **Canonical fix** that can be extracted to production code

## Spike Ethos

### 1. Don't Trust Documentation Alone

Documentation describes intent, not implementation. When behavior is unexpected, observe what actually happens.

### 2. Isolate Before You Integrate

Integration tests verify; spikes debug. Extract minimal reproduction before adding console.logs to 500-line files.

### 3. Observe, Don't Assume

The spike's job is to reveal truth, not confirm beliefs. Write code that **exposes** whether your hypothesis is true.

### 4. Preserve the Learning

After the spike reveals the fix:
1. Extract the fix to production code
2. Write documentation
3. Keep the spike file as a reference (or delete if trivial)
4. Create a test that would have caught the bug

## Spike Lifecycle

```
Problem Detected
     |
     v
Create Spike File (isolated)
     |
     v
Progressive Tests (simple -> complex)
     |
     v
Observe Output (don't assume)
     |
     v
Identify Root Cause
     |
     v
Extract Fix to Production
     |
     v
Document Learning
     |
     v
Decide: Keep or Delete Spike
```

## File Naming

```
src/lib/{domain}/__tests__/spike-{topic}.ts
src/lib/{domain}/spikes/spike-{N}-{description}.ts
```

Examples:
- `spike-nullable-json.ts` -- JSON encoding investigation
- `spike-5-server.ts` -- Server integration spike #5
- `spike-datetime-sqlite.ts` -- DateTime + SQLite binding spike

## Spike vs Test vs Documentation

| Artifact | Purpose | Lifetime | Rigor |
|----------|---------|----------|-------|
| **Spike** | Discover truth | Ephemeral | Verbose, exploratory |
| **Test** | Verify behavior | Permanent | Precise, minimal |
| **Docs** | Transfer knowledge | Permanent | Clear, actionable |

A spike is neither a test nor documentation. It is a **conversation with the system** to expose hidden behavior.

## Case Study: Nullable JSON + SQLite

### Symptom
```
Error: Binding expected string, TypedArray, boolean, number, bigint or null
```

### Hypotheses Tested

| Test | Hypothesis | Result |
|------|------------|--------|
| Test 1 | `OptionFromNullOr(parseJson)` encodes None to null | FAIL: Encodes to `"null"` string |
| Test 2 | `FieldOption(JsonFromString)` encodes None to null | FAIL: Encodes to `"null"` string |
| Test 3a | Custom transform with `Schema.Option` | FAIL: `_tag` missing on decode |
| Test 3b | Custom transform with `Schema.OptionFromSelf` | PASS: Correct encoding |
| Test 4 | Full SQLite with simple model | PASS: Insert works |
| Test 5 | Full SQLite with DateTime fields | FAIL: Date object binding |

### Root Causes

1. `Schema.Option` vs `Schema.OptionFromSelf` encoding difference
2. `Model.DateTimeInsertFromDate` produces Date objects, not strings
3. `repo.findById()` returns `Option<T>`, not `T`

### Extracted Fixes

- `NullableJsonFromString` schema with `Schema.OptionFromSelf`
- Use `Model.DateTimeInsert` instead of `Model.DateTimeInsertFromDate`
- Use `Option.getOrThrow()` when accessing `findById` results

## CLI Integration

```bash
bun spike list              # Find existing spikes
bun spike new <name>        # Generate template
bun spike run <file>        # Execute spike
```

## Related Documents

- [Pi Hypothesis Lab](pi-hypothesis-lab.md) -- Structured hypothesis testing framework
- Source: `.edin/SPIKE_METHODOLOGY.md` (271 lines)
