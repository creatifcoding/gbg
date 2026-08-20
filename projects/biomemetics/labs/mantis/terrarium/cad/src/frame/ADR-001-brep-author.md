# ADR-001: BRep author for CAD-01

Status: accepted for working draft B. Maturity DRAFT. Not a shop release.

## Decision

Scripted FreeCAD `Part` (OCCT) is the single released mechanical authority for frame, rail, B20, B51, and B52.

OpenSCAD `terrarium/cad/mantis_terrarium.scad` stays a study envelope. It must not emit released STEP.

## Why FreeCAD Part, not CadQuery/build123d

The lab fabrication shell already lists FreeCAD. This leaf cannot edit `flake.nix` (#21). CadQuery/build123d is not in that shell. Authoring in FreeCAD Part keeps one OCCT pipeline and leaves FreeCADCmd as the STEP re-import inspector.

## What this does not decide

B27/B50 connector series, KiCad envelopes, and pinch-carriage solids stay UNVERIFIED or belong to #23/#29. B21 is an explicit separate-route declaration, not a corner electrical solid.

## Revisit

If #21 pins CadQuery/OCP in `mantis-cad` and drops FreeCAD, rewrite the exporter against that kernel. Do not run two BRep authors at once.
