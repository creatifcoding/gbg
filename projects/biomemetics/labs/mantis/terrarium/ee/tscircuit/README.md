# @tmnl/mantis-terrarium-tscircuit

TypeScript is the EE authoring source. Leftover KiCad under `ee/kicad/**` is emit only.

The package compiles one indexed coupon through `@tscircuit/core` and returns Circuit JSON. Gerber is later. Catalog can file the run as an entity later. Maturity is DRAFT.

Admitted balloons are B19, B27, B44, B48, and B50. `manufacturerPartNumber` is left blank. Header footprints are generic pinrow study placeholders, not a selected series. The 80 x 40 mm board outline is an unverified study envelope, not a locked PCB size. B19 V-dock pads are omitted because the stack-up is unverified. Branch enable is S1 AND S2. P08 is not safety authority.

`@tscircuit/core` rejects `+`, `-`, and `/` in net identifiers. The typed table keeps the bus.json names (`VIN-A`, `GMSL+`, `FAULT_N/IRQ`). The compiler uses underscore tokens and a named alias table.
