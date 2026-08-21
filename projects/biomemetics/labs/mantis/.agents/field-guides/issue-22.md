# Field guide — gbg#22 (mantis-00b-control-plane)

## Write set

- `contracts/**`, `.agents/**` except `workstreams.json`
- `tooling/python/**`, `tooling/rust/**`
- `tooling/typescript/**` except `src/specimendb.ts` and `test/specimendb.test.ts`
- `evidence/fixtures/**`

## Surprising environment facts

- Host may lack Nix; `jsonschema` is optional via `mantis-lab[contracts]`.
- Rust toolchain here is 1.83 — keep clap/tempfile/sha2 pinned for edition2024-free deps.
- `scripts/verify-core.sh` still smoke-generates manifests under `evidence/generated/`; that path is not a baseline.
- TypeScript evidence validator pins `contracts/evidence.schema.json` by SHA-256; contract edits must update the pin together.

## Acceptance

```bash
PYTHONPATH=tooling/python/mantis-lab/src python3 -m mantis_lab.cli --workspace . run-corpus
PYTHONPATH=tooling/python/mantis-lab/src python3 -m mantis_lab.cli --workspace . check-terrarium
PYTHONPATH=tooling/python/mantis-lab/src python3 -m mantis_lab.cli --workspace . generate-task-packets --base-sha 1e6683272e4e15d50dd90b60fd3f7c0f3dd5bbb3
node --test tooling/typescript/mantis-lab/test/corpus.test.ts
cargo test --manifest-path tooling/rust/mantis-lab-verifier/Cargo.toml
```

## Stop conditions

Second identical failure; >15% write-set growth; missing source; new cross-domain decision.
