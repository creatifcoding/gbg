# 2026-08-23 authoring, packet, and parts quest

This note records the 23 August 2026 lab latents for the terrarium CAD and EE packet and the open parts quest. It sits next to `metaprompts/` in the existing `terrarium/docs` folder. Leftover S00 through S11 and CAD-01 stay Used extract. Their titles are not this cut.

The work sits under the [gbg#15](https://github.com/creatifcoding/gbg/issues/15) workspace epic. MCAD coordination remains [gbg#17](https://github.com/creatifcoding/gbg/issues/17). EE coordination remains [gbg#18](https://github.com/creatifcoding/gbg/issues/18). Shop-release remains [gbg#31](https://github.com/creatifcoding/gbg/issues/31) and comes later. The live CAD and EE packet is [PR 112](https://github.com/creatifcoding/gbg/pull/112).

## Authoring

Authoring is TypeScript. JSCAD lives at `terrarium/cad/jscad`. tscircuit is at `terrarium/ee/tscircuit`. A `mantis/authoring` tree was rejected. Leftover FreeCAD, OCCT, and KiCad stay emit.

## Skills

Proctors write skills. Writers only run them. Fleet skills for this cut are `jscad-solids` and `mantis-tscircuit`. The official `tscircuit/skill` is extract.

## Composite packet

The CAD and EE packet is one composite entity. Sheets S00 through S11 and CAD-01 remain Used extract. New media comes only from a system that wrote a file.

## CAD now

CAD now is a 250 mm by 250 mm by 500 mm envelope, a bbox, and tests. Render uses `extrusions.project` plus `@jscad/svg-serializer`. That serializer writes front, side, and top SVG. PNG and isometric views are deferred. There is no STL written just to have a file. There is no cuboid shop drawing. S01 stays extract.

## EE now

EE now lives on PR 112 under `packet/`. That directory holds Circuit JSON, schematic SVG, PCB SVG, a 3D snap, glTF, GLB, a netlist, and check stdout. S1, S2, and Q1 have no pin traces. B44 pin2 is `NOT_CONNECTED`. B19 is omitted. MPNs are blank. There is no Gerber.

## Parts quest

The parts quest is open. DigiKey and Octopart were a start, not a limit. Hits land in one procurement PGlite book. sqlite is not that book. A balloon is not a buy. Do not invent manufacturer part numbers. `UNVERIFIED` cannot become an order.

## Print and shop

CAD can do whatever it needs. A local person has Bambu printers. Develop in-house FDM requirements. Do not invent a printer model. Shop outreach is Tuesday 2026-08-25. The packet shown to shops stays DRAFT. Shop-release is [gbg#31](https://github.com/creatifcoding/gbg/issues/31), later.

## Hold merge

Hold merge on [PR 112](https://github.com/creatifcoding/gbg/pull/112) and [PR 108](https://github.com/creatifcoding/gbg/pull/108). No orders.
