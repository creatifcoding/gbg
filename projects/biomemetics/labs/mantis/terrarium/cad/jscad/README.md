# @tmnl/mantis-terrarium-jscad

TypeScript is the CAD authoring source. Leftover FreeCAD/OCCT under `cad/src/**` is emit only. PR 34 and PR 36 stay emit. Do not copy leftover OCCT as authority.

The tree still has one envelope cuboid: 250 x 250 x 500 mm, origin front-left-bottom. X right, Y back, Z up. The 202 x 202 x 427 mm animal-clear box is a keep-out record, not a subtracted void. PARAMS does not lock that void's Z origin.

B20 is the continuous animal/wet barrier. These solids are nonmetal. No animal-side copper, pogo, or metal mesh is authored here.

## Named solids

| solid | balloon | PARAMS rows | what is modeled | omitted |
| --- | --- | --- | --- | --- |
| enclosure envelope | — | `frame.exterior.width/depth/height` LOCK | one cuboid `[0,0,0]→[250,250,500]` | animal-clear void Z |
| `B01-corner-block` | B01 | `frame.band` REF; instances also use exterior 250/250/500 and pitch/span 250/500 | unique 24 mm cube; eight instances at the envelope corners | leftover pocket/inset cuts |
| `B05-view-cassette` | B05 | `panel.stock_thickness` 3.00 mm LOCK; `animal.clear.width/height` 202 x 427 CALCULATED | local plate 202 x 3 x 427 mm | world face and gasket Z; seat pocket |
| `B06-front-door` | B06 | `panel.stock_thickness` 3.00 mm LOCK; `animal.clear.width/height` 202 x 427 CALCULATED | local plate 202 x 3 x 427 mm | world face, swing, nymph-gap cut |

Cassette seat is `stock + 0.20 mm` TARGET (3.20 mm). It is recorded, not a pocket. Screen aperture `<=0.80 mm` nonmetal is LOCK on B11, not a cut in these plates. In-plane plate size is CALCULATED before gasket closure.

`npm run generate` projects the envelope with `@jscad/modeling` `extrusions.project({axis, origin}, solid)` and writes front, side, and top SVG under `generated/` with `@jscad/svg-serializer` `serialize({unit: 'mm'}, geom2)`. Those files are class generated, not shop-release. Leftover S01 stays the extract view.

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
