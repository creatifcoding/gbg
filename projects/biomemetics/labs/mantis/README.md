# Mantis biomemetics workspace

`projects/biomemetics/labs/mantis` is the durable workspace for designing and
studying mantis-related observations, morphology, mechanisms, biological
analogs, datasets, simulations, and engineered projects.

This is a **lab workspace**, not a catalog Specimen. SpecimenDB is an
evidence/catalog bridge: it may link sourced observations and artifacts without
making the directory itself a Specimen or turning an uncited taxon guess into an
identification. Never invent a specimen record, locality, GPS coordinate,
Particle SKU, connector pinout, structure, or measured result.

The first engineered project is `terrarium/`. It contains the modular enclosure,
untethered instrument carriage, and their electrical/mechanical interfaces. The
workspace identity remains broader than that project.

## Terrarium project locks

- The carriage is untethered; no cable trails behind it while repositioning.
- Power and low-speed control use continuous, guarded external rail contacts
  separated from the animal/wet volume; no environmental ingress rating is claimed.
- Video is serialized near the camera and crosses the rail only at indexed,
  controlled-impedance high-speed pogo docks.
- Pinching initiates break-before-move: quiesce video, turn off and discharge
  the local carriage load branch, release the high-speed dock, lift the remaining contacts, then
  roll. Protected rail lands may remain energized only inside the guarded
  external channel behind the continuous wet-side barrier; the carriage branch
  is off and its contacts are clear while moving.
- The removable binder is a second keyed electrical interface with a local S2
  mate interlock; it cannot release unless the carriage is already pinch-safe.
- Raw MIPI CSI stays local to the camera/serializer and receiver/Tachyon ends.
  Raw MIPI is never a rail signal.
- A moving carriage carries no active video link. Releasing at an indexed dock
  establishes contact, restores power, and retrains the serialized link.
- Metal, copper, pogos, and electrode strips remain outside the animal and wet
  volumes. The animal sees sealed plastic, glazing, or non-metal screen.

Everything beyond those locks remains a hypothesis, target, reference
dimension, or unverified selection until evidence says otherwise.

## Workspace lanes

Scientific knowledge is organized by lane; tooling is organized by coordinated
member. Both communicate through shared JSON contracts and evidence records.

| Scientific lane | Contents |
| --- | --- |
| `observations/` | Sourced field, image, behavioral, and experimental observations |
| `morphology/` | Described structures, geometry, measurements, and uncertainty |
| `mechanisms/` | Structure-to-motion/function hypotheses and tests |
| `analogs/` | Explicit biological-to-engineering mappings and limits |
| `datasets/` | Versioned dataset manifests, licenses, lineage, and transforms |
| `simulations/` | Scientific models, cases, sweeps, and interpreted results |
| `terrarium/` | First engineered project; enclosure, powered-video rail, and validation |

| Member | Authority |
| --- | --- |
| `contracts/` | Cross-language lab, parameter, and evidence contracts |
| `tooling/python/` | Scientific models, geometry generation, data reduction |
| `tooling/rust/` | Deterministic verification, provenance, artifact inspection |
| `tooling/typescript/` | Effect-based orchestration and SpecimenDB adapter |
| `terrarium/cad/` | Project parametric source and neutral manufacturing exports |
| `terrarium/ee/` | Project schematics, PCB/channel definitions, and electrical checks |
| `terrarium/simulations/` | Project simulation inputs, runners, and result manifests |
| `docs/` | Architecture, decisions, protocols, and human-readable findings |
| `evidence/` | Reviewed evidence records own exactly what they record; derived payloads do not own broader claims |

No member silently owns another member's truth. A reviewed evidence record is
authoritative only for the observation, measurement, calculation, or simulation
result it records—not for a broader biological or engineering claim. Shared
identifiers, parameter status, and evidence semantics come from `contracts/`;
geometry remains CAD authority, circuits remain EE authority, and generated
drawings and catalog projections remain derived.

## Start here

1. Read [`GOAL.md`](GOAL.md) for the workspace objective and first project gates.
2. Read [`docs/EXECUTION.md`](docs/EXECUTION.md) for the live issue DAG,
   maturity ladder, swarm topology, and release frontier.
3. Read [`AGENTS.md`](AGENTS.md) before assigning an issue or write-set.
4. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for boundaries and
   dependency direction.
5. Read [`docs/AGENT-ALLOCATION.md`](docs/AGENT-ALLOCATION.md) before starting
   a Cursor swarm or assigning CAD/EE/simulation tools.
6. Validate changes against the schemas in `contracts/`.
7. Attach evidence to claims; never promote a target or simulation to a
   measurement.

`workspace.json` is the machine-readable workspace declaration. It records the
lanes, current terrarium locks, and integration policy without pretending a
hypothesis has passed physical validation.

## Work sequence

Each study or project advances top-down, then bottom-up:

1. Lock requirements, interfaces, claims, and acceptance tests.
2. Prove the riskiest interface on a short powered-video rail coupon.
3. Prove break-before-move and contact sequencing.
4. Prove the mechanical carriage and universal latch.
5. Integrate the 250/500 perimeter and husbandry envelope.
6. Release fabrication artifacts only from reproducible, reviewed sources.

For `terrarium/`, the first meaningful hardware milestone is therefore a
dock/channel coupon, not a complete enclosure render.
