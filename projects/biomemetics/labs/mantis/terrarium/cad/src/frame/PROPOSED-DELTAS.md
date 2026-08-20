# Proposed deltas (not applied)

Issue #28 does not own `params.json`, `bus.json`, `BOM.md`, `workstreams.json`, `cad/assembly`, or KiCad. These are integration-owned. Apply only after the root merges them.

## params.json

Add study-backed REF/TARGET/UNVERIFIED records. Do not promote them to measured.

| Name | Value | Status | Source |
| --- | ---: | --- | --- |
| rail.offset_from_frame | 5 | ref | OpenSCAD study `rail_offset` |
| rail.guard_lip_thickness | 1.5 | ref | OpenSCAD study `guard_t` |
| carriage.envelope.width | 60 | ref | PARAMS.md |
| carriage.envelope.depth | 42 | ref | PARAMS.md |
| carriage.envelope.height | 28 | ref | PARAMS.md |
| cassette.pocket_inset | 10 | ref | OpenSCAD cassette pocket |
| cassette.pocket_height | 10 | ref | OpenSCAD cassette pocket |
| cassette.pocket_z | 8 | ref | OpenSCAD cassette pocket |
| cassette.seat_clearance | 0.20 | target | PARAMS.md |
| b03.coupler_length | 22 | ref | S03 annotation "22 REF COUPLER" |
| b51.end_stop_length | 8 | ref | OpenSCAD `rail_end_stop` |
| b51.service_bore_diameter | 3.4 | unverified | OpenSCAD M3 clearance; PN absent |
| b19.land_thickness | 0.2 | ref | OpenSCAD strip thickness |
| b19.dock_pad_length | 18 | ref | OpenSCAD dock pad |
| b52.slot_clearance | 0.4 | ref | OpenSCAD guard lips |
| cut.kerf | 0.15 | ref | metaprompt default |
| husbandry.upper_third_clear | 142 | calculated | PARAMS.md |

## BOM.md

No quantity change. Annotate B21 as "routes separate; no corner electrical solid in CAD-01". Keep B20 as the animal/wet barrier, not a contact film.

## bus.json

No net or state change. Optional geometry pointer: `mechanicalRef: terrarium/cad/src/frame`.

## evidence/runs/

Copy `simulations/mechanical/frame/reports/` to `evidence/runs/mantis-cad-01/<git-sha>/<run-id>/` after #22 lands the run layout. This leaf does not write `evidence/runs/`.

## cad/assembly

Named assembly STEP lives at `cad/src/frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step` after FreeCADCmd. Do not duplicate it under integration-owned `cad/assembly` until the root copies it.
