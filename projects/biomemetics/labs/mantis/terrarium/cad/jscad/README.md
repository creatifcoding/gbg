# @tmnl/mantis-terrarium-jscad

TypeScript is the CAD authoring source. Leftover FreeCAD under `cad/src/**/export_freecad.py` is emit only.

The model is one axis-aligned 250 x 250 x 500 mm cuboid, origin at front-left-bottom. X right, Y back, Z up. The 202 x 202 x 427 mm animal-clear box is a keep-out record, not a subtracted void. PARAMS does not lock that void's Z origin.

`npm run generate` projects that solid with `@jscad/modeling` `extrusions.project({axis, origin}, solid)` and writes front, side, and top SVG under `generated/` with `@jscad/svg-serializer` `serialize({unit: 'mm'}, geom2)`. Those files are class generated, not shop-release. Leftover S01 stays the extract view.

| file | view | axis | origin | plane |
| --- | --- | --- | --- | --- |
| `generated/front.svg` | front | `[0, 1, 0]` | `[0, 0, 0]` | XZ |
| `generated/side.svg` | side | `[1, 0, 0]` | `[0, 0, 0]` | YZ |
| `generated/top.svg` | top | `[0, 0, 1]` | `[0, 0, 0]` | XY |

`axis` is the official `project()` plane normal. Front is the Y-normal plane. Side is the X-normal plane. Top is the Z-normal plane, the library default.

STL and STEP emit throw. PNG/iso stay blank. `gl` created a context on this coupon. Official `@jscad/regl-renderer` `demo-cli.js` then failed with `Cannot find module '@jscad/img-utils'`. No PNG was written. Maturity is DRAFT.

## Draft in-house print

A local person has Bambu printers. Path is FDM on Bambu. Printer model is UNVERIFIED. Nozzle and bed size stay unnamed until that person names them.

Printed candidates are REF printed solids. Acrylic B05 and B06, screen B11, and bought Particle/ADI parts are not printed.

Filament (PETG/ASA on B01) stays REF until the local person names it.

Shop outreach is Tuesday 2026-08-25. This packet is DRAFT, not shop-release.

Leftover FreeCAD/OCCT stay emit. The SVG generate path above stays. No STL just to have a file. No cuboid shop drawing.
