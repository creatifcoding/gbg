---
name: mantis-lab
description: Govern work inside the durable mantis biomemetics workspace, including observations, mechanisms, analogs, terrarium engineering, simulations, and SpecimenDB evidence projection.
---

# Mantis lab mode

## Boundary

`projects/biomemetics/labs/mantis` is the workspace. `terrarium` is its first
engineered project, not the identity of the workspace. SpecimenDB is the
evidence/catalog bridge and does not turn the workspace into a Specimen.

## Evidence grammar

Use exactly one basis for each material statement:

- `observed` — directly visible in supplied evidence;
- `measured` — instrument or dimension record exists;
- `calculated` — deterministic consequence of stated inputs;
- `simulated` — result of a declared model and boundary conditions;
- `ref` — provisional reference geometry;
- `target` — design/test goal;
- `typ` — repeated nominal pattern, not a measurement;
- `unverified` — plausible but lacking source or bench evidence.

Never silently upgrade a basis. Never invent GPS, locality, taxon, specimen id,
Particle SKU, connector pinout, or a physical test result.

## Tool authority

- JSON contracts own cross-language identity, status, and provenance.
- FreeCAD/OCCT or CadQuery/build123d owns released STEP geometry.
- OpenSCAD owns fast parametric printable studies, not the STEP requirement.
- KiCad owns schematic and PCB source.
- Python owns scientific generation, analysis, and orchestration.
- Rust owns deterministic verification, hashing, path confinement, and evidence
  emission.
- TypeScript owns Effect/SpecimenDB projections and operator-facing types.
- Blender owns visual inspection only; it is never dimensional authority.

## Agent topology

Cursor agents use Grok only. Root and high-risk arbitration use Grok 4.6,
`xhigh`, Fast Mode off. Bounded implementation and independent review use Grok
4.5, Fast Mode off. No Sol, Auto, or silent model fallback. One implementer owns
one issue/branch/write set; reviewers remain read-only.

## Terrarium rail lock

The camera carriage is untethered. Power/control use continuous protected
lands. Serialized video uses indexed point-to-point high-speed pogo docks.
Pinch performs break-before-move; working draft B admits no local carriage-load
power or video while rolling, though protected VIN lands may remain energized
inside the sealed channel. Raw MIPI stays within the camera binder or
Tachyon-side brick. The removable binder is a separate B50 interface with a
normally-open S2 mate interlock and cannot release unless the carriage is
pinch-safe.

Stop instead of guessing when an exact module revision, pinout, connector,
contact model, biological identification, or measured result is absent. Record
the blocker and the evidence needed to resume.
