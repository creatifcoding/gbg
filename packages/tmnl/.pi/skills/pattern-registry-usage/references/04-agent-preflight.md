# Agent Preflight Checklist (Pattern Registry)

Before touching implementation code:

1. Search relevant patterns:
   - `pattern_registry_search(query, tags)`

2. Apply policy default for state shape:
   - If state may require derivations/shared projections, choose **Atoms-as-State** (`Atom.make` + `useAtomValue` / `useAtomSet`).
   - Use `useState` only for strictly ephemeral UI microstate.

3. If confidence is low, run focused discovery:
   - `pattern_registry_extract_ast(roots, persist:true)`

4. Verify discoveries for your target pattern family:
   - `pattern_registry_query_discoveries(sourceType:"ast", tags:[...])`

5. Record decision annotation for chosen pattern:
   - `pattern_registry_add_annotation(...)`

6. If duplicates/noise appear, run merge preview:
   - `pattern_registry_merge_preview`

## Response style when using this skill

When reporting back to user, include:

- Pattern chosen
- Why chosen (source + evidence)
- Example discovery paths
- Any conflict/open risk

## Anti-Patterns

- Implementing before querying registry
- Defaulting to `useState` for data likely to need derivations/shared consumers
- Ignoring conflict queue after merge apply
- Using stale `sourceId` across unrelated audits
