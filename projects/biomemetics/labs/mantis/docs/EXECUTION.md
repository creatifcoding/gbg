# Mantis lab execution program

GitHub epic: [creatifcoding/gbg#15](https://github.com/creatifcoding/gbg/issues/15)

This document is the durable workspace map for the engineering program. GitHub
issues own live status and review discussion. `.agents/control/workstreams.json`
owns machine-readable dependencies, write sets, models, and concurrency.

## Outcome

Advance the first terrarium project through:

`DRAFT -> PROTO-FAB -> QUALIFIED -> INTEGRATION PROTOTYPE -> SHOP-RELEASE`

The current repository is `DRAFT`. The schematic sheets and OpenSCAD assembly
are theoretical inputs. There is no native KiCad board, released STEP
authority, or physical qualification yet.

## Active architecture lock

- The camera carriage is untethered.
- P01-P08 are guarded continuous power/control/identity/diagnostic lands.
- P09-P12 are an indexed stationary serialized-video dock.
- Raw MIPI remains local to the camera/serializer and receiver/Tachyon.
- B50 is a second keyed binder-to-carriage interface.
- S1/S2/Q1 enforce break-before-move and break-before-binder-release.
- B20 continuously separates every conductor from the animal and wet volumes.
- Video and carriage-load power are unavailable while rolling.

## Issue topology

| Workstream | Issue | Depends on |
| --- | ---: | --- |
| Workspace bootstrap | #20 | — |
| Nix runtime and doctor | #21 | #20 |
| Contracts/task packets/evidence | #22 | #20 |
| SpecimenDB bridge | #16 | #22, PR #12 |
| EE coordination umbrella | #18 | #21, #22 |
| Sourced interfaces/KiCad library | #23 | #21, #22 |
| Power/interlock KiCad + ngspice | #24 | #23 |
| Complete channel/native boards | #25 | #24, #28, #29 |
| Fixture and PROTO-FAB | #26 | #25 |
| Physical EE qualification | #27 | #26 + hardware |
| MCAD coordination umbrella | #17 | #21, #22 |
| OCCT frame/rail/B20 | #28 | #21, #22, #23 |
| Pinch carriage/B50 binder | #29 | #24, #28 |
| Observation/analog pipeline | #19 | real media; #16 for projection |
| Integrated terrarium | #30 | #27, #28, #29 |
| First article/shop release | #31 | #30 + all gates |

#17 and #18 are umbrellas. They get no implementation agent or direct write
set.

## Swarm operating rule

Each leaf is one Cursor Goal, one worktree/branch, one Grok 4.5 non-fast
implementer, and one hard write set. A reviewer starts from the final SHA and
remains read-only. Electrical safety, animal-boundary, and final release gates
receive a second decorrelated reviewer. Grok 4.6 xhigh/non-fast is reserved for
locks, cross-domain arbitration, and evidence admission. Sol, Auto model
routing, Fast Mode, and silent fallback are forbidden.

Maximum concurrent writers:

1. one EE/KiCad leaf;
2. one MCAD leaf; and
3. one foundation/evidence/integration leaf.

The root owns `BOM.md`, `params.json`, `bus.json`, the workstream graph, the
system KiCad schematic, and the master CAD assembly. Workers propose changes to
those files; they do not overwrite or merge one another.

## Relative intelligence budget

| Work | Units |
| --- | ---: |
| Deterministic export/check/solver run | 0.05 |
| Focused script/notebook | 0.20 |
| Grok 4.5 implementation pass | 1.00 |
| Grok 4.5 review pass | 0.75 |
| Grok 4.6 xhigh arbitration pass | 3.00 |

Allocate a milestone approximately 15% to root architecture, 45% to bounded
implementation, 20% to independent review, and 20% to deterministic tools and
solvers. Keep Grok 4.6 at no more than roughly 10-12% of agent tokens. Do not
spend model turns on conversion, rendering, hashing, repetitive sweeps, or
solver iteration.

## Leaf packet and stop conditions

A leaf receives only its issue, base SHA, model/mode, read/write sets,
dependencies, locked decisions, relevant source/model manifest, acceptance
commands, output paths, evidence class, and stop conditions. It reports at
25/50/75% with an artifact or test delta.

Stop and return to the root on a repeated deterministic failure, more than 15%
write-set growth, an unavailable pinout/model/limit, or a new cross-domain
decision. One declared solver simplification retry is allowed; a second failure
is `INCONCLUSIVE`.

## Evidence boundary

Runs live under
`evidence/runs/<workstream>/<git-sha>/<run-id>/` with exact commands, Nix
derivation, tool or instrument version, hardware/fixture revision, inputs,
digests, raw output, reductions, units, uncertainty, sample count, deviations,
and limits. A verifier never generates the baseline it certifies.

Before #16, reviewed evidence remains local. After #16, TypeScript/Effect may
use only the governed SpecimenDB attach operation for the exact reviewed,
claim-bound payload. The lab is not a Specimen and direct PGlite writes remain
forbidden.
