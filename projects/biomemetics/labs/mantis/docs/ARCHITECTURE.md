# Mantis biomemetics workspace architecture

## 1. System boundary

`projects/biomemetics/labs/mantis` is a durable research-and-fabrication
workspace. Its subject is broader than a single enclosure: it can accumulate
observations, morphology, candidate mechanisms, analog mappings, datasets,
simulations, and multiple engineered projects over time.

`terrarium/` is its first engineered project. SpecimenDB sits across the
workspace boundary as an evidence/catalog bridge. Neither the root directory nor
the terrarium is implicitly a catalog Specimen.

The architecture separates three concerns:

1. **Knowledge lanes** organize what is being claimed.
2. **Technical members** provide tools and domain authorities.
3. **Contracts and evidence** let lanes and members communicate without erasing
   provenance or uncertainty.

## 2. Top-down model

### 2.1 Knowledge lanes

| Lane | Input | Output | Prohibited collapse |
| --- | --- | --- | --- |
| Observations | Photos, records, experiments, cited sources | Bounded statements about what was observed | Observation → taxonomic fact |
| Morphology | Reviewed observations and measurements | Structures, geometry, uncertainty | Inference → visible structure |
| Mechanisms | Morphology plus motion/function evidence | Falsifiable mechanism claims | Plausibility → demonstrated function |
| Analogs | Reviewed biological mechanism and engineering need | Directional mapping with limits | Inspiration → biological equivalence |
| Datasets | Licensed sources and transforms | Versioned manifests and derived data | File possession → usage rights |
| Simulations | Declared models, parameters, and solvers | Reproducible outputs and interpreted evidence | Simulation → measurement |
| Projects | Accepted requirements and usable evidence | Prototypes and fabrication releases | Render/export → verification |

A relation may cross lanes only when it retains its source class and review
state. For example, a photographed limb feature may support a morphology claim;
that claim may motivate a latch analog; the latch still requires independent
mechanical evidence.

### 2.2 Cross-language contracts

The JSON schemas in `contracts/` are the semantic boundary:

- `lab.schema.json` validates the root `workspace.json` declaration;
- `params.schema.json` represents values together with status such as
  `measured`, `simulated`, `target`, `ref`, or `unverified`;
- `evidence.schema.json` records claim tests, source class, provenance,
  artifacts, results, limitations, and review.

Python, Rust, and TypeScript consume the same contracts. They may generate local
types or validators, but a generated representation may not broaden the schema
or reinterpret an epistemic status.

### 2.3 Domain authority

Contracts carry shared identifiers and statuses; they do not centralize every
domain model.

| Authority | Owns | Does not own |
| --- | --- | --- |
| CAD | Nominal geometry, assemblies, fit interfaces, neutral exports | Whether a physical fit passed |
| EE | Schematics, PCB/channel topology, net classes, protection | Whether a channel met BER or eye limits |
| Simulation case | Model, mesh, boundary conditions, solver inputs | Physical truth outside declared assumptions |
| Evidence record | What was observed/calculated, how, and with what limits | A broader claim than the test supports |
| Docs | Rationale and navigation | Machine-readable truth duplicated from contracts |

## 3. Technical member architecture

The workspace is not one polyglot package. It is a set of coordinated members:

### Python (`tooling/python/`)

- scientific models and parameter sweeps;
- geometry/drawing generation where Python is appropriate;
- dataset ingestion and reduction;
- production of contract-valid intermediate data.

Python does not certify its own outputs. It emits manifests and evidence inputs
for deterministic inspection.

### Rust (`tooling/rust/`)

- deterministic operational invariants, path confinement, and digest checks;
- digest and provenance generation;
- neutral artifact inspection, dimensional checks, and release gates;
- stable command-line surfaces for CI and other agents.

Rust verification checks declared operational invariants; it does not replace
the shared Draft 2020-12 JSON Schema gate or silently repair source models.

### TypeScript (`tooling/typescript/`)

- Effect-based orchestration across members;
- typed workflow state and failure channels;
- review/admission flows;
- SpecimenDB mapping for evidence, claims, sources, artifacts, and explicitly
  admitted catalog relationships.

The adapter does not fabricate taxonomy or create a Specimen merely because an
artifact mentions a mantis.

### Project CAD, EE, and simulation

- CAD keeps parametric mechanical source and emits STEP/STL/SVG/DXF as derived
  artifacts.
- EE keeps KiCad or equivalent source for power, control, and high-speed channel
  work; exported PDFs are not circuit authority.
- Simulation keeps cases separate from generated results. Every result names the
  solver, version/environment, input digest, and boundary conditions.
- Blender may inspect motion envelopes or produce explanatory views, but it is
  never dimensional authority.

### Nix and orchestration

Nix defines reproducible tool environments. A focused fabrication environment
may include FreeCAD/OCCT, OpenSCAD, KiCad, Blender, meshing/FEA, SPICE, and
high-speed analysis tools, but availability must be demonstrated by a shell
smoke test rather than asserted in documentation.

The repository task graph should order contract validation, domain checks,
generation, artifact inspection, evidence assembly, and review. It must not
encode success as "the export command returned zero."

## 4. Evidence flow

The allowed dependency direction is:

```text
source / observation
        |
        v
bounded claim -----> parameter with epistemic status
        |                         |
        +------------+------------+
                     v
             model or prototype
                     |
                     v
              test / simulation
                     |
                     v
              evidence record
                     |
                     v
          independent review/admission
                     |
          +----------+-----------+
          v                      v
  project decision       SpecimenDB bridge
```

There is no reverse edge from an attractive engineered mechanism to a claim that
a mantis has the same structure or function. There is no edge from a generated
render to a measured clearance. Admission changes review state; it does not
change a simulated source class into a measured one.

## 5. Terrarium project architecture

### 5.1 Physical partition

The terrarium has three explicitly separated volumes:

1. **Animal/wet volume** — sealed non-metal interior surfaces and non-metal
   screen; no rail conductors or contacts.
2. **External instrument perimeter** — protected rail, carriage, binders, power,
   control, and indexed high-speed docks.
3. **Compute/receiver volume** — external Particle compute brick, protection,
   deserializer/receiver, and local CSI connection.

Sections and inspection evidence must prove the boundaries. A declaration in a
CAD feature name is not proof.

### 5.2 Signal partition

```text
camera module
    |
    | raw MIPI CSI (short, binder-local)
    v
camera-local serializer
    |
    | serialized video
    v
separate keyed B50 binder handoff
    |
    | serialized video + protected power/control
    v
indexed B27 controlled-impedance pogo dock
    |
    | stationary high-speed rail/channel segment
    v
receiver/deserializer
    |
    | raw MIPI CSI (short, compute-local)
    v
Tachyon CSI

continuous guarded external rail strips: power + low-speed control only
```

GMSL2 is a candidate serialized transport already represented in the theoretical
drawings, not a validated channel result. Serializer, deserializer, contacts,
pin order, impedance implementation, and data rate remain sourced selections or
`unverified` until their datasheets and test evidence enter the workspace.
The complete channel includes both separable interfaces, their launches, and
carriage routing. S1 supervises the rail mate and S2 supervises the binder mate;
neither is replaceable by P08, software, or successful link training.

### 5.3 Carriage state machine

The break-before-move sequence is a safety and signal-integrity invariant:

| State | Video | Guarded rail supply | Local carriage branch | Contacts | Motion permitted |
| --- | --- | --- | --- | --- | --- |
| `ABSENT` | Off | May remain protected/on | Off | Open | N/A |
| `MECHANICALLY-SEATED` | Off | May remain protected/on | Off | Settling; S1/S2 open | No |
| `POWER-MATED` | Off | On | Current-limited enable | Fully seated; S1/S2 closed | No |
| `TRAINING-WINDOW` | Training | On | On for bounded timeout | B27 + B50 seated | No |
| `LINK-TRAINED` | Trained | On | On | B27 + B50 seated | No |
| `FAULT-LATCHED` | Off | May remain protected/on | Off | Seated or ambiguous | No |
| `PINCH-SAFE` | Off | May remain protected/on | Off and discharged | S1 open; not yet lifted | No |
| `LIFTED/ROLLING` | Off | May remain protected/on | Off | All moving contacts physically clear | Yes |

Only successful training and health checks permit the transition to
`LINK-TRAINED`. An interrupted pinch moves toward a local-branch-off safe state;
it must not restore video or carriage-load power on ambiguous contact geometry.
Protected VIN lands may remain energized inside the guarded external channel so
other loads are not disrupted; no moving contact is permitted to touch them
while the carriage translates. The channel is separated from the animal/wet
volume, but no environmental ingress rating is claimed.

### 5.4 Risk-first validation

The first prototype is a short representative powered-video coupon. It precedes
the complete 250/500 enclosure because the novel interface dominates system
risk. Its evidence should cover at least:

- insertion loss/return loss or an equivalent channel characterization;
- eye/BER behavior at the intended link mode;
- training success and recovery;
- contact bounce during make/break;
- power inrush, current limiting, short circuit, and thermal behavior;
- contamination, wear, and repeated docking; and
- mechanical prevention of high-speed wipe while moving.

Simulation narrows the prototype space. A representative fixture and instruments
decide whether the physical gate passes.

## 6. Release and admission gates

A project artifact advances only when:

1. its authoritative source is identified;
2. parameters expose their epistemic status;
3. generation is reproducible in the declared environment;
4. deterministic checks pass;
5. an evidence record captures result and limitations; and
6. an independent reviewer admits or rejects the claim.

Fabrication releases additionally require coherent BOM identifiers across CAD,
EE, drawings, and instructions. SpecimenDB publication is a separate admission
decision and cannot be implied by a fabrication release.

## 7. Agent topology

Use one root architect for contracts and contested boundaries, one implementer
per disjoint issue/write-set, deterministic tool workers, and independent
reviewers. Expensive intelligence is reserved for integration decisions and
failure analysis; generation and sweeps belong to tools. Cursor model allocation
is fixed in `AGENTS.md` and excludes Sol, Auto routing, and Fast Mode.
