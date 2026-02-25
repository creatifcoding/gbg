# AVA Contract Artifacts (v1)

This directory is the canonical contract lane for AVA subject and payload shape rules in TypeScript.

## Files

- `ava_contract_v1.json` — machine-readable artifact for tooling and cross-runtime consumers.
- `index.ts` — static typed mirror + stable accessors/constants for TS callers.

## Purpose

These artifacts define one source of truth for:

- command subject templates (`invalidate`, `subscribe`, `unsubscribe`)
- stream templates (`artifacts`, `deltas`, `status`; single + wildcard)
- payload key expectations (`requiredKeys`, `optionalKeys`)
- casing contract (`view_id` only; `viewId` forbidden)

## Drift Gate Usage

Use a CI drift gate that compares `ava_contract_v1.json` against the `AVA_CONTRACT_V1` object in `index.ts`.

Recommended policy:

1. Any contract change must update both files in the same PR.
2. CI fails if JSON and TS mirror diverge.
3. Version bumps happen in the JSON artifact (`version`) and are reflected in TS exports.
