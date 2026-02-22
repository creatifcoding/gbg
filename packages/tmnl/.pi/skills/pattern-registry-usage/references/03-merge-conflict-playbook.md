# Merge + Conflict Playbook

## Why
Curated and discovered patterns can overlap. Merge creates canonical entries while preserving evidence.

## Protocol

1. **Preview always**
   - Run `pattern_registry_merge_preview`
   - Inspect winner, candidate scores, conflict count.

2. **Apply conservatively**
   - Run `pattern_registry_merge_apply` with `stopOnConflict: true`
   - This logs run/decisions/conflicts and avoids blind overwrite for conflicted groups.

3. **Review open conflicts**
   - `pattern_registry_list_conflicts status=open`

4. **Annotate conflict context**
   - Use `pattern_registry_add_annotation` on related discovery events.

## Interpretation

- `winner_curated`: curated source outranked others.
- `winner_score`: score/rank winner selected.
- `conflict`: high-priority candidates diverged materially.

## Safety Defaults

- Use small `maxGroups` initially (e.g., 100–300).
- Keep `dryRun: true` for first pass in unfamiliar domains.
- Never treat merge as data deletion; provenance and discoveries remain auditable.
