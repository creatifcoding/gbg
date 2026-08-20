# Mantis 00B control plane

gbg#22 hardens prose locks into digested, enforceable contracts.

## Owned artifacts

| Path | Role |
| --- | --- |
| `contracts/interfaces.json` | Root interface/ADR registry (B20/B27/B48/B50/S1/S2/Q1, frames, camera path, state machine, maturity) |
| `contracts/*.schema.json` | Draft 2020-12 schemas including task packets, evidence runs, manifests |
| `.agents/control/packets/` | Deterministic per-issue task packets |
| `.agents/field-guides/` | Per-issue guides; `INDEX.md` capped at 200 lines |
| `.agents/control/proposed-deltas/` | Integration-owned hot-file proposals |
| `evidence/fixtures/corpus/` | Shared positive/negative Draft 2020-12 corpus |

## Manifest roles (ADR-003)

1. **generate** → `lifecycle=generated` (never `MANIFEST.sha256`)
2. **review** → promotes digests with reviewer metadata; does not re-hash as a new baseline mint
3. **verify** → checks digests; `--certify` rejects generated lifecycles
4. Verifier never writes manifests

## SpecimenDB boundary (ADR-004)

Projection payloads bind only through `admissions[].projectionBinding` on an
accepted evidence record. URI artifacts require digests. gbg#16 owns
`packages/specimendb` and the TypeScript attach adapter files. Records stay
local until then.
