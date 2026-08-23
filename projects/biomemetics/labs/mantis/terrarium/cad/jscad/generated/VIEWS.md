# Generated orthographic views

class: generated. Not shop-release.
Leftover S01 stays the extract view.

Command: `npm run generate`
Solid: `extrusions.project({axis, origin}, solid)` then `svgSerializer.serialize({unit: 'mm'}, geom2)`.

| file | view | axis | origin | plane |
| --- | --- | --- | --- | --- |
| front.svg | front | [0, 1, 0] | [0, 0, 0] | XZ |
| side.svg | side | [1, 0, 0] | [0, 0, 0] | YZ |
| top.svg | top | [0, 0, 1] | [0, 0, 0] | XY |

PNG/iso: blank. `require("gl")(64, 64)` created a context. Official `@jscad/regl-renderer` `demo-cli.js` then failed with `Cannot find module '@jscad/img-utils'`. No PNG was written.

