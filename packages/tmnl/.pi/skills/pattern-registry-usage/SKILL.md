---
name: pattern-registry-usage
description: Operational playbooks for using the Pattern Registry extension (discovery, audit, merge, annotations). Use when agents should query allowed patterns before implementation.
---

# Pattern Registry Usage

Use this skill to operate the Pattern Registry as an **architecture memory + evidence system**.

This is a **usage skill**, not an implementation guide.

## Read First (Required)

Before using tools, read these references in order:

1. `references/01-quickstart.md`
2. `references/02-discovery-playbook.md`
3. `references/03-merge-conflict-playbook.md`
4. `references/04-agent-preflight.md`
5. `references/05-atom-as-state-default.md`

If you skip these, you will misuse caps/filters and get misleading results.

## When to Use

- Before coding: query allowed patterns for the target domain
- During audit: prove what patterns are actually used in code
- During review: annotate discoveries and decisions
- During consolidation: merge duplicate patterns and inspect conflicts

## Available Tools

| Tool | Purpose |
|---|---|
| `pattern_registry_upsert_pattern` | Create/update canonical pattern entries |
| `pattern_registry_ingest_curated` | Import curated JSON/Markdown pattern docs |
| `pattern_registry_extract_ast` | Discover patterns from code signatures |
| `pattern_registry_search` | Query registry patterns by text/tags/kind/lifecycle |
| `pattern_registry_log_discovery` | Manually log discovered pattern events |
| `pattern_registry_add_annotation` | Attach notes/labels to discovery events |
| `pattern_registry_query_discoveries` | Query discovery ledger by metadata/filters |
| `pattern_registry_merge_preview` | Preview merge winners/conflicts |
| `pattern_registry_merge_apply` | Persist merge run + decisions + conflicts |
| `pattern_registry_list_conflicts` | Inspect unresolved merge conflicts |

## Non-Negotiable Usage Rules

1. **Search before implementation** (`pattern_registry_search` first).
2. **Default to Atoms-as-State for derivable state** (`Atom.make` + `useAtomValue` / `useAtomSet`), unless state is strictly ephemeral UI microstate.
3. **Discovery must be persisted** for audits (`pattern_registry_extract_ast` with `persist: true`).
4. **Always annotate material decisions** (`pattern_registry_add_annotation`).
5. **Never apply merge blind** — run preview first, then apply.
6. **Treat discovery caps as sampling controls**; tune `maxOccurrences` intentionally.

## Fast Start (30s)

1. Search existing policy: `pattern_registry_search`
2. Run focused AST discovery for your scope: `pattern_registry_extract_ast`
3. Query discoveries with tags/source filters: `pattern_registry_query_discoveries`
4. Add annotation on accepted/rejected evidence

For exact command payload patterns, see `references/01-quickstart.md`.
