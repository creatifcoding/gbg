# Agent operating contract

These instructions apply to every agent working inside
`projects/biomemetics/labs/mantis`.

## 1. Orient before editing

Read, in order:

1. `workspace.json`
2. `GOAL.md`
3. `docs/ARCHITECTURE.md`
4. the relevant JSON schemas in `contracts/`
5. the issue, acceptance test, and files in the assigned write-set

Discover existing repository and Nix conventions before adding a new tool or
command. Preserve unrelated work. Do not rewrite another agent's files to make
your local task easier.

## 2. Source-of-truth order

1. Measured evidence with provenance
2. Cited vendor or primary-source documentation
3. Locked lab contracts and accepted decisions
4. Simulated or calculated evidence with declared models
5. Targets, references, and unverified assumptions

JSON contracts define cross-language meaning. They do not replace domain
authority: CAD owns geometry, EE owns circuits/channel topology, and evidence
records own what was actually observed. Generated artifacts never outrank their
inputs.

If sources conflict, stop promotion and record the conflict. Never silently
choose the more convenient value.

## 3. Non-negotiable workspace locks

- This is a biomemetics lab workspace, not a catalog Specimen.
- The workspace includes observations, morphology, mechanisms, analogs,
  datasets, simulations, and engineered projects. Do not equate it with the
  first `terrarium/` project.
- Do not invent GPS, locality, taxon, Particle SKU, connector pinout, part
  number, biological structure/function, dimension, measured value, or
  validation result.
- Mark uncited or unavailable data `unverified`; mark design dimensions `ref` or
  `target` until measured or locked.

For `terrarium/` and any evidence that directly supports it:

- the carriage is untethered;
- power and low-speed control may use protected continuous contacts;
- serialized video may cross only an indexed high-speed pogo dock while
  stationary;
- raw MIPI CSI does not ride the rail;
- pinch-to-reposition is break-before-move; video and the local carriage load
  branch are turned off before contacts lift; protected VIN lands may remain
  energized only inside the guarded external channel behind the wet-side barrier;
- the removable binder is a second separable interface with its own normally
  open S2 mate interlock and cannot release until the carriage is pinch-safe;
- no metal, copper, pogo, or electrode-strip intrusion into animal or wet volume.

Changing a lock requires an explicit decision record, updated contracts, a new
revision, and an independent review. An implementation agent cannot waive one.

## 4. Workspace boundaries

This is a coordinated workspace, not one polyglot super-library. It has two
orthogonal organizations:

- knowledge lanes: `observations/`, `morphology/`, `mechanisms/`, `analogs/`,
  `datasets/`, `simulations/`, and engineered projects such as `terrarium/`;
- technical members: the language, CAD, EE, simulation, documentation, and
  artifact roots below.

- `tooling/python/`: scientific computation, generation, and analysis
- `tooling/rust/`: deterministic verification, provenance, artifact inspection
- `tooling/typescript/`: Effect orchestration and the SpecimenDB adapter
- project `cad/`: parametric geometry and manufacturing geometry sources
- project `ee/`: circuit, PCB, and channel authority
- project `simulations/`: reproducible simulation cases and runners
- `docs/`: explanatory architecture and decisions
- `evidence/` and project releases: derived outputs and evidence payloads
- `contracts/`: language-neutral semantics shared by every member

Cross a member boundary through a versioned contract, manifest, or explicit
command. Do not import an implementation's private representation as a shared
model.

## 5. Model and concurrency policy

For Cursor agents, use Grok only:

- root architecture, high-risk system decisions, and arbitration:
  **Grok 4.6 xhigh, non-fast**;
- implementation, domain analysis, and independent review:
  **Grok 4.5, non-fast**;
- do not use Sol, Auto routing, or Fast Mode.

Use expensive reasoning for boundaries, failure modes, and contested evidence;
use deterministic tools for generation, checking, conversion, and sweeps.

Assign exactly one implementer to an issue/write-set. Parallel agents must own
disjoint write-sets. Read-only reviewers may inspect broadly, but may not "help"
by editing the implementer's files. A failed check returns to the owning
implementer or becomes a new issue.

## 6. Work protocol

Use this sequence:

1. **Discover** — inspect contracts, dependencies, sources, and current state.
2. **Derive** — state the claim, assumptions, failure modes, and acceptance test.
3. **Delegate** — allocate one bounded write-set to one implementer.
4. **Integrate** — connect members only through declared interfaces.
5. **Verify** — run deterministic checks and attach evidence independently.

Every task must name:

- files it may edit;
- claims or parameters it changes;
- deterministic commands it must pass;
- evidence it must produce; and
- conditions under which it must stop instead of guessing.

## 7. Evidence discipline

Evidence records conform to `contracts/evidence.schema.json` and include:

- the claim tested;
- whether the source was measured, simulated, calculated, observed, or external;
- method and environment;
- inputs and their provenance;
- observations or measurements with units/status;
- result and limitations;
- artifact digests; and
- independent review state.

A tool report is not automatically an `EvidenceRecord`. In particular, the
Rust verifier emits `specimendb.mantis.verification-report.v1`; preserve that
report as a digested artifact/input of a separately authored and reviewed
evidence record.

Do not relabel simulated data as measured. Do not use a pretty render as proof of
fit, clearance, signal integrity, airflow, or husbandry safety. Absence of a
failure in one run is not proof of a safe envelope.

## 8. Definition of done

An agent is done only when its bounded acceptance tests pass, its contracts and
derived artifacts agree, its evidence is reviewable, and it reports remaining
unknowns. "Generated files" without verification is unfinished work.
