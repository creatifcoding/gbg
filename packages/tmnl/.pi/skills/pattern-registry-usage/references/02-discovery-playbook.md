# Discovery Playbook

## Goal
Produce reliable, auditable evidence of pattern usage in code.

## Steps

1. **Define scope**
   - Prefer focused roots over full repo scans.
   - Example: `src/lib/slider`, `src/lib/layers`, `src/components/testbed`.

2. **Run extraction with persistence**
   - `persist: true`
   - Set `sourceId` per run (e.g., `audit:layers:2026-02-07`)
   - Set `discoveredBy` to actor/session label.

3. **Check coverage summary in details**
   - Validate each signature has logged coverage if expected.
   - If sparse: raise `maxOccurrences` or narrow roots.

4. **Query by signature tags**
   - `effect-atom`, `effect`, `schema`, `observability`

5. **Annotate critical findings**
   - Add approval/reject/debt notes on high-signal events.

## Common Pitfalls

- Broad roots + low cap can hide low-frequency signatures.
- Querying without `sourceType` mixes manual/ast/tool events.
- Not setting `sourceId` makes runs harder to replay.

## Good Run Metadata

- `sourceId`: stable and scoped (`audit:<surface>:<date>`)
- `discoveredBy`: explicit actor (`prime`, `agent`, `review-bot`)
- `tags`: include domain (`effect-atom`, `runtime`, `schema`)
