# @tmnl/mantis-terrarium-tscircuit

TypeScript is the EE authoring source. Leftover KiCad under `ee/kicad/**` is emit only.

The first artifact is `tsci build` on `index.circuit.tsx`. That writes Circuit JSON to `dist/index/circuit.json`. `tsci snapshot --update --3d` writes schematic SVG, PCB SVG, and the 3D snap under `__snapshots__/`. `tsci export` writes the readable netlist, glTF, and GLB under `dist/`. `tsci check` stdout is captured next to those files as `dist/check-*.txt`. Gerber, PnP, and KiCad are later. Do not `tsci push`. Leftover S08 and `ee/kicad/**` are used extract, not generated here. Maturity is DRAFT.

B19, B27, B44, B48, and B50 are BOM balloons compiled on this coupon. They stay UNVERIFIED. There is no admit-list. `tsci search` did not select a series, so `manufacturerPartNumber` stays blank. The parts engine is off so it cannot write a JLCPCB SKU. Header footprints are generic pinrow study placeholders. The 80 x 40 mm board outline is an unverified study envelope. B19 V-dock pads are omitted. S1, S2, and Q1 have no datasheet, so their pins are not traced. Branch enable is S1 AND S2. P08 is not safety authority.

`@tscircuit/core` rejects `+`, `-`, and `/` in net identifiers. The typed table keeps the bus.json names (`VIN-A`, `GMSL+`, `FAULT_N/IRQ`). The compiler uses underscore tokens and a named alias table.
