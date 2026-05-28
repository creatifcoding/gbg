# Plant Ops Namespace Migration

Status: planned migration, no broad schema implementation

## 1. Decision

Use **Plant Ops Platform** for the product/domain namespace.

Do not continue expanding the broad `industrial` implementation namespace.

Rationale:

- `industrial` is too large and vague;
- the product center is plant operations, maintenance, alarms, production context, supervisory governance, and ISA-95 Level 3 coordination;
- standards remain industrial standards, but implementation folders should describe the product boundary;
- tighter names make import boundaries easier to police.

## 2. Naming policy

| Concept | Preferred name | Avoid |
| --- | --- | --- |
| Product/docs pack | Plant Ops Platform | Industrial Agentic Platform |
| Code namespace | `plant-ops` | `industrial` |
| Docs path | `src/lib/iiot/docs/plant-ops-platform` | `src/lib/iiot/docs/industrial-platform` |
| Schema path | `src/lib/iiot/schemas/plant-ops` | `src/lib/iiot/schemas/industrial` |
| Service path | `src/lib/iiot/services/plant-ops` | `src/lib/iiot/services/industrial` |
| Runtime/adapters | `src/lib/iiot/plant-ops/adapters/*` | one adapter mega-folder |
| Reader artifact | `plant-ops-platform-rfc-reader.html` | `industrial-agentic-platform-rfc-reader.html` |

## 3. Physical path migration map

Planned path moves:

| Current | Target | Notes |
| --- | --- | --- |
| `src/lib/iiot/docs/industrial-platform` | `src/lib/iiot/docs/plant-ops-platform` | Dedicated commit; no schema implementation mixed in. |
| `scripts/industrial-platform-rfc-reader.ts` | `scripts/plant-ops-platform-rfc-reader.ts` | Keep compatibility wrapper or package script alias for one migration window. |
| `scripts/industrial-platform-standards-check.ts` | `scripts/plant-ops-platform-standards-check.ts` | Same behavior; rename only. |
| `/home/getbygenius/.agent/diagrams/industrial-agentic-platform-rfc-reader.html` | `/home/getbygenius/.agent/diagrams/plant-ops-platform-rfc-reader.html` | Regenerate after docs rename. |
| `RFC-0006-INDUSTRIAL-SCHEMAS.md` | `RFC-0006-PLANT-OPS-SCHEMAS.md` | File rename plus README/reader references. |

Potential compatibility aliases:

```text
bun run industrial-platform:rfc-reader  -> wrapper around plant-ops-platform:rfc-reader
bun run industrial-platform:standards   -> wrapper around plant-ops-platform:standards
```

Compatibility aliases should be temporary and documented.

## 4. Code namespace map

Planned future code paths:

```text
src/lib/iiot/schemas/plant-ops/
  standards.ts
  identity.ts
  telemetry.ts
  dmn.ts
  protocols/
    opcua.ts
    sparkplug.ts
  overlays/
    alarms-isa18.ts
    packml.ts
    kpi-iso22400.ts
  commands.ts
  simulation.ts
  deployment.ts
  index.ts

src/lib/iiot/plant-ops/
  ports/
  adapters/
    opcua/
      sim/
      live/
    sparkplug/
      sim/
      live/
  dmn/
  simulation/
  golden-traces/
  agent-context/
  command-authority/
  deployment/
```

No future code should be added under:

```text
src/lib/iiot/schemas/industrial
src/lib/iiot/services/industrial
src/lib/iiot/industrial
```

## 5. Migration phases

### Phase 0 — Stop the spike

Status: complete.

- Removed premature `src/lib/iiot/schemas/industrial` spike.
- Removed `export * from './industrial'` from `src/lib/iiot/schemas/index.ts`.
- Preserved research/docs only.

### Phase 1 — Update language and reader contents

Scope:

- README language: Plant Ops Platform first, historical industrial language only where describing standards.
- Add `EFFECT-V3-GROUNDING-LEDGER.md`, `RFC-0011-PLANT-OPS-DECOMPOSITION.md`, `NAMESPACE-MIGRATION.md`, and `BOUNDARY-RULES.md` to the reader.
- Generate reader artifact with Plant Ops title/output path.

### Phase 2 — Dedicated docs path rename

Scope:

- move docs directory;
- update reader and standards scripts;
- update package/project scripts if present;
- update internal doc links;
- regenerate reader;
- run standards check.

No schema/code implementation in this commit.

### Phase 3 — Schema nucleus under `plant-ops`

Scope:

- create only pure Schema modules;
- add focused tests;
- update standards conformance proof rows;
- keep adapters/services out of schema commit.

### Phase 4 — Port/interface and simulator tracks

Scope:

- add service interfaces and simulator layers;
- keep live adapters opt-in and contract-tested.

## 6. Commit discipline

Use explicit paths only.

Expected dedicated rename commit staging shape:

```bash
git add \
  packages/tmnl/src/lib/iiot/docs/industrial-platform/...deleted-or-moved... \
  packages/tmnl/src/lib/iiot/docs/plant-ops-platform/... \
  packages/tmnl/scripts/plant-ops-platform-rfc-reader.ts \
  packages/tmnl/scripts/plant-ops-platform-standards-check.ts \
  packages/tmnl/scripts/industrial-platform-rfc-reader.ts \
  packages/tmnl/scripts/industrial-platform-standards-check.ts \
  packages/tmnl/package.json \
  packages/tmnl/project.json
```

Then verify:

```bash
git diff --cached --name-only
```

Prime, no `git add -A`. We are not adopting chaos as a staging strategy.

## 7. Done criteria

The naming migration is done when:

- docs live under `plant-ops-platform`;
- future code paths use `plant-ops`;
- compatibility scripts are either removed or clearly marked temporary;
- reader output uses Plant Ops naming;
- standards traceability gate passes;
- no `src/lib/iiot/schemas/industrial` directory exists;
- grep for implementation-path `industrial` only finds standards prose, compatibility wrappers, or historical notes.
