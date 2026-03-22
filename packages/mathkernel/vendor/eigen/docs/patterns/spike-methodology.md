# Spike Methodology

> **Canonical Source**: `.edin/SPIKE_METHODOLOGY.md`
> **Consolidated**: 2026-02-09

Time-boxed, throwaway investigation methodology for answering technical questions and debugging complex integrations.

---

## What is a Spike?

A **spike** is a time-boxed, throwaway investigation designed to answer a specific technical question. Unlike production code, spikes are:

- **Isolated** -- Self-contained files with minimal dependencies
- **Ephemeral** -- Can be deleted after learning is extracted
- **Verbose** -- Heavy logging to expose internal state
- **Progressive** -- Builds incrementally from simple to complex

---

## When to Spike

| Signal | Action |
|--------|--------|
| "Works in PostgreSQL, fails in SQLite" | Spike: What are the binding constraints? |
| "Schema error: missing _tag" | Spike: What is the encoded form at each layer? |
| "Tests pass individually, fail together" | Spike: Is there shared state pollution? |
| Documentation is unclear or absent | Spike: Empirical observation > guessing |

---

## Progressive Isolation Pattern

Start with the smallest reproduction, then add layers:

```
Test 1: Schema alone (no DB)
Test 2: Schema + Model (no DB)
Test 3: Schema + Model + Repository (no Layer)
Test 4: Full integration with Layer
```

---

## Spike Ethos

1. **Don't trust documentation alone** -- Observe what actually happens
2. **Isolate before integrating** -- Extract minimal reproduction
3. **Observe, don't assume** -- Expose truth, don't confirm beliefs
4. **Name the hypothesis** -- Every test answers a specific question
5. **Preserve the learning** -- Extract fix, write docs, create regression test

---

## Spike Lifecycle

```
Problem Detected
     |
Create Spike File (isolated)
     |
Progressive Tests (simple -> complex)
     |
Observe Output (don't assume)
     |
Identify Root Cause
     |
Extract Fix to Production
     |
Document Learning (.edin/)
     |
Decide: Keep or Delete Spike
```

---

## File Naming Convention

```
src/lib/{domain}/__tests__/spike-{topic}.ts
src/lib/{domain}/spikes/spike-{N}-{description}.ts
```

---

## CLI Commands

```bash
bun spike list              # Find existing spikes
bun spike new <name>        # Generate template
bun spike run <file>        # Execute spike
```

See the full original at `.edin/SPIKE_METHODOLOGY.md` for the complete case study (Nullable JSON + SQLite).
