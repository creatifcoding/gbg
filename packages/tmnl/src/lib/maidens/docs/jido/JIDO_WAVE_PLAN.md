# JIDO_WAVE_PLAN

Selected rollout: **Tiered waves**.

## Objective

Promote scaffold and partial lanes to full Jido runtime depth with strict evidence gating between waves.

## Wave structure

## Wave 1 (highest leverage)

- enterprise
- site
- line

Goal:
- Establish template parity in organization/topology lanes.
- Resolve enterprise missing runtime-agent preflight surface.

Exit gate:
- each lane 6/6 strict
- no skipped gates
- no runtime preflight parity warnings

## Wave 2 (mid-structure lanes)

- plant
- area
- machine-asset

Goal:
- Promote core hierarchy + machine identity lanes.
- Reuse Wave 1 template with minimal divergence.

Exit gate:
- each lane 6/6 strict
- no skipped gates

## Wave 3 (asset/device edge lanes)

- device
- sensor-asset
- asset
- sensor

Goal:
- Converge leaf/edge telemetry lanes to same orchestration depth.

Exit gate:
- each lane 6/6 strict
- no skipped gates

## Parallelization policy

- Max concurrent lane workers: **8**
- Recommended: 3-4 lanes per wave for cleaner isolation and review
- Validate lane evidence before opening next wave

## Evidence after each wave

Per lane:
- `reports/latest.json`
- timestamped e2e report JSON
- step JSONL trace
- gate log directory

Cross-wave snapshot:
- matrix update in `JIDO_DEEPENING_MATRIX.md`
- checklist tick-off in `JIDO_ACCEPTANCE_CHECKLIST.md`

## Command pattern

Use bun scripts from `packages/tmnl`:

```bash
bun run contracts:e2e:<lane>
```

If orchestrated by Nx where available:

```bash
bunx nx run tmnl:contracts:e2e:<lane>
```
