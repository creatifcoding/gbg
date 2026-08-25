# Generated orthographic views

class: generated. Not shop-release.
Leftover S01 stays the extract view.

Command: `npm run generate`
Each still is `extrusions.project({axis, origin}, solid)`, then `geom2.toOutlines`, closed `path2.fromPoints`, `colors.colorize([0, 0, 0, 1], path)`, then `svgSerializer.serialize({unit: 'mm'}, ...paths)`.
Official `@jscad/svg-serializer` fills geom2 black. path2 is stroke. Generate never passes geom2 to serialize.

B01 is one 24 mm cube. The eight instance origins are recorded below. Pocket cuts are omitted.
B05 and B06 are the local 202 x 3 x 427 mm plates. World face and gasket Z stay unverified.

| instance | origin mm |
| --- | --- |
| B01-corner-01 | [0, 0, 0] |
| B01-corner-02 | [226, 0, 0] |
| B01-corner-03 | [0, 226, 0] |
| B01-corner-04 | [226, 226, 0] |
| B01-corner-05 | [0, 0, 476] |
| B01-corner-06 | [226, 0, 476] |
| B01-corner-07 | [0, 226, 476] |
| B01-corner-08 | [226, 226, 476] |

| file | solid | view | axis | origin | plane |
| --- | --- | --- | --- | --- | --- |
| envelope-front.svg | envelope | front | [0, 1, 0] | [0, 0, 0] | XZ |
| front.svg | envelope | front | [0, 1, 0] | [0, 0, 0] | XZ |
| envelope-side.svg | envelope | side | [1, 0, 0] | [0, 0, 0] | YZ |
| side.svg | envelope | side | [1, 0, 0] | [0, 0, 0] | YZ |
| envelope-top.svg | envelope | top | [0, 0, 1] | [0, 0, 0] | XY |
| top.svg | envelope | top | [0, 0, 1] | [0, 0, 0] | XY |
| B01-corner-block-front.svg | B01-corner-block | front | [0, 1, 0] | [0, 0, 0] | XZ |
| B01-corner-block-side.svg | B01-corner-block | side | [1, 0, 0] | [0, 0, 0] | YZ |
| B01-corner-block-top.svg | B01-corner-block | top | [0, 0, 1] | [0, 0, 0] | XY |
| B05-view-cassette-front.svg | B05-view-cassette | front | [0, 1, 0] | [0, 0, 0] | XZ |
| B05-view-cassette-side.svg | B05-view-cassette | side | [1, 0, 0] | [0, 0, 0] | YZ |
| B05-view-cassette-top.svg | B05-view-cassette | top | [0, 0, 1] | [0, 0, 0] | XY |
| B06-front-door-front.svg | B06-front-door | front | [0, 1, 0] | [0, 0, 0] | XZ |
| B06-front-door-side.svg | B06-front-door | side | [1, 0, 0] | [0, 0, 0] | YZ |
| B06-front-door-top.svg | B06-front-door | top | [0, 0, 1] | [0, 0, 0] | XY |

PNG/iso: blank. `require("gl")(64, 64)` created a context. Official `@jscad/regl-renderer` `demo-cli.js` then failed with `Cannot find module '@jscad/img-utils'`. No PNG was written.

