# AVA Projection Profile Baseline

## Purpose

Records a local baseline for projection-path timing in `ava-elixir` using:

1. projection read lookup by `(view_id, projection_type)`
2. replay fold checksum over a deterministic synthetic event list (`AvaElixir.Projections.Replay.fold_events/1`)
3. checksum verify path (`AvaElixir.Projections.Replay.verify_projection_checksum/2`)

---

## Environment assumptions

- Elixir app boots in `MIX_ENV=dev`.
- PostgreSQL is reachable via `config/runtime.exs` envs (`AVA_POSTGRES_*` / defaults).
- `ava_projections` table exists (`mix ecto.migrate` already run).
- Script is executed from `ava-elixir/`.
- Baseline run captured below was taken with:
  - Elixir `1.18.4`
  - OTP `27`
  - dataset seeds:
    - projection seed `{2787, 8141, 5159}`
    - events seed `{2787, 3321, 9733}`

---

## Command

```bash
cd ava-elixir && mix run scripts/projection_profile_baseline.exs
```

Optional knobs (all positive integers):

- `AVA_PROFILE_PROJECTION_ROWS`
- `AVA_PROFILE_EVENT_COUNT`
- `AVA_PROFILE_LOOKUP_ITERATIONS`
- `AVA_PROFILE_FOLD_ITERATIONS`
- `AVA_PROFILE_VERIFY_ITERATIONS`

---

## Captured baseline (single local run)

| benchmark | iterations | loop total (µs) | avg / iter (µs) | p50 (µs) | p95 (µs) | min (µs) | max (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|
| projection read lookup (view_id, projection_type) | 4000 | 4687651 | 1171.91 | 1793 | 2927 | 255 | 7229 |
| replay fold checksum | 500 | 3160629 | 6321.26 | 5817 | 9453 | 3667 | 26557 |
| checksum verify path | 500 | 2883925 | 5767.85 | 5632 | 11045 | 3593 | 18215 |
