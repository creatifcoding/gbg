# Particle-base mantis terrarium - working draft B

This package is a theory drawing set for a 250 x 250 x 500 mm modular mantis terrarium. No live-mantis or commercial-frame photo was supplied, so taxonomy is intentionally unset and all custom geometry that is not a source lock is marked `REF`, `TARGET`, or `UNVERIFIED`.

Working draft B incorporates a tetherless camera-carriage architecture: raw
MIPI CSI-2 remains inside the camera binder, a MAX96717 serializer converts it
to GMSL2, and power plus serialized video cross an indexed high-speed rail dock.
A MAX96724 outside the animal volume converts up to four point-to-point dock
links back to CSI-2 for Tachyon. The removable binder adds a second, separately
keyed B50 electrical interface and S2 mate interlock; neither its connector nor
its high-speed geometry is selected.

The high-speed rail is theoretical and is not released for fabrication or
animal use. It requires signal-integrity coupons across both separable
interfaces, eye/BER testing, contact-bounce testing, ESD validation, thermal
testing, and mechanically interlocked break-before-move sequencing.

All current schematic views are marked `NTS - DO NOT SCALE`. Their dimensions
are design annotations, not permission to measure the page. True-scale
orthographic and section sheets must be regenerated from released CAD before a
shop release. The immutable pre-workspace Release A capture remains under
`releases/rA/`; it is historical evidence, not the editable working set.

## Files

- `cad/mantis_terrarium.scad` - portable parametric source; OpenSCAD was not available in the authoring environment, so regenerate and inspect it before fabrication.
- `schematics/S00-cover.svg` through `schematics/S11-details.svg` - A3 vector source sheets.
- `schematics/schematics.pdf` - ordered combined set.
- `BOM.md`, `PARAMS.md`, and `BUS.md` - balloon identities, locked/provisional dimensions, and interface definition.
- `SOURCES.md` - primary vendor and husbandry provenance plus explicit limits.

## Status vocabulary

- `LOCK` - explicitly required by the supplied source prompt.
- `CALCULATED` - arithmetic consequence of stated inputs.
- `REF` - provisional geometry, not measured.
- `TARGET` - test goal, not verified performance.
- `UNVERIFIED` - vendor drawing, selected part, or bench evidence is still required.
