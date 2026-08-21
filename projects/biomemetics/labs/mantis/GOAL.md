# Mantis biomemetics workspace goal

## North star

Create a reproducible, reviewable workspace that accumulates mantis observations,
morphology, mechanism hypotheses, biological analogs, datasets, simulations,
and engineered projects without collapsing uncertainty into fact.

The result is successful only when a claim, source, model, artifact, and its
limits are understandable from the repository alone. The first engineered
project is `terrarium/`: a safe modular enclosure with an untethered
powered-video carriage.

## Workspace outcomes

- Preserve observations separately from interpretations.
- Relate morphology to candidate mechanisms without inventing unseen structure.
- Make biological analog mappings explicit, directional, and falsifiable.
- Keep datasets licensed, versioned, and traceable to transforms.
- Make simulations reproducible and clearly distinct from measurements.
- Let engineered projects consume reviewed claims without converting them into
  biological facts.
- Bridge reviewed evidence and catalog entities through SpecimenDB without
  making this workspace a catalog entity.

## First engineered hypothesis: terrarium rail

An untethered camera carriage can share a modular external rail when:

1. continuous conductors provide protected power and low-speed control;
2. a camera-local serializer converts raw MIPI CSI into a robust serialized
   link;
3. that link crosses a controlled, indexed high-speed pogo dock only while the
   carriage is stationary;
4. pinch-to-reposition enforces break-before-move; and
5. release performs deterministic power-up and link training before video is
   declared available.

This is a hypothesis until the channel, contact system, and sequencing survive
instrumented tests. "Not done before" is not a rejection, but novelty is not
evidence either.

## Terrarium staged objective

### T0 — Reproducible laboratory

- A pinned Nix environment can run each workspace member and its validators.
- Shared JSON contracts validate identically from Python, Rust, and TypeScript.
- Every generated artifact has source inputs, tool identity, and a digest.

### T1 — Powered-video interface coupon

- Build a short representative rail, indexed pogo dock, and separate keyed
  carriage-to-binder handoff so the complete channel is exercised.
- Exercise nominal supply, inrush, short-circuit, ESD strategy, and hot-plug
  sequencing.
- Measure link training, eye/BER behavior, contact bounce, loss, and repeatability
  at the intended serialized data rate.
- Record cable/contact/vendor models as sourced inputs, not invented values.

### T2 — Break-before-move mechanism

- Demonstrate the complete state sequence under normal, slow, partial, and
  interrupted pinches.
- Mechanically prevent high-speed contact wipe during rolling.
- Ensure a failed or bent contact becomes a safe unavailable state rather than
  an energized ambiguous state.

### T3 — Carriage and universal binder

- Validate clamp force, pogo travel, roller/dovetail clearances, wear, and
  repeatable docking.
- Validate load path and CSI strain relief inside the camera binder.
- Prove S2 opens and the local branch discharges before binder contacts move;
  prevent binder release unless the carriage is already pinch-safe.
- Keep the carriage one-handed and tool-free without exposing the animal to a
  rail opening.

### T4 — Terrarium integration

- Integrate the 250 mm module / 500 mm span perimeter.
- Preserve hang-molt clearance, nymph-proof gaps, non-metal screen, cross-flow,
  front access, drainage, and removable perches.
- Prove through sections and inspection that conductors never enter the animal
  or wet volume.

### T5 — Shop release

- Emit reviewed STEP/STL and SVG/DXF from authoritative sources.
- Emit coherent schematics, drawings, BOM, assembly instructions, and evidence
  index with stable identifiers.
- Rebuild and verify the release from a clean environment.

## Terrarium release gates

| Gate | Required evidence |
| --- | --- |
| Interface feasibility | Representative channel measurement and documented limits |
| Electrical safety | Sequencing, current limiting, fault, and thermal results |
| Mechanical safety | Tolerance stack, failure states, wear, and retention results |
| Husbandry safety | Physical keep-out, gap, ventilation, and molt-zone inspection |
| Fabrication readiness | Clean reproducible exports and independent verification |

A simulation can justify a prototype. It cannot, by itself, satisfy a gate that
requires measurement. A target can guide design. It cannot be reported as a
result.

## Explicit non-goals

- Cataloging a live specimen without a real intake and evidence.
- Treating a guessed taxon, locality, GPS position, SKU, pinout, or vendor claim
  as fact.
- Carrying raw MIPI CSI over sliding or continuous rail conductors.
- Maintaining video while the carriage rolls in the first implementation.
- Allowing copper, metal mesh, pogos, or rail contacts into the wet/animal volume.
- Producing photoreal renders in place of engineering evidence.
- Requiring one programming language or one monolithic package to own the lab.
- Treating the terrarium as the identity or limit of the mantis workspace.
- Inventing biological structure, function, behavior, or taxonomic certainty
  that is not visible in or supported by a cited source.
