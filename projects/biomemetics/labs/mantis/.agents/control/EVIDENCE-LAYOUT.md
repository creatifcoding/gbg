# Evidence run layout

```text
evidence/runs/<workstream-id>/<git-sha>/<run-id>/
  run.json
  inputs/
  raw/
  derived/
  report.json
  evidence-record.json
```

Rules:

- Each run records exact command, Nix closure (when available), tool/instrument
  version, hardware/fixture revision, source/input digests, raw outputs,
  interpretation, deviations, and limits.
- Rust verification output is an artifact input, not self-certifying evidence.
- Before gbg#16, records remain local and reviewable.
- After PR 12 + #16, TypeScript/Effect may call only the governed attach API.
- No direct PGlite. Lab is not a Specimen. No invented GPS/taxon.
- Verifiers never mint `terrarium/MANIFEST.sha256` or any immutable baseline.
- `evidence/fixtures/` may hold theoretical layout examples; do not present
  them as measured results.
