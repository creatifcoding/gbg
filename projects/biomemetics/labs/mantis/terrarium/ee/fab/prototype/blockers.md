# PROTO-FAB blockers (issue 26)

None of these may be silently closed by this leaf.

| Blocker | Why it stops release |
| --- | --- |
| #23 unadmitted | IMX519 SKU, MAX96717/MAX96724 suffix/pad map, B27/B50 series, S1/S2/Q1 MPNs missing |
| analog.com PDF timeout | SerDes pad map not sourced; courtyard-only refplanes |
| Fabricator stackup UNVERIFIED | Impedance/net classes not tied to a selected shop |
| `kicad-cli` absent | ERC/DRC/Gerber X2/Excellon/position/PDF/netlist/STEP not executed |
| IPC-2581 / ODB++ / IPC-D-356 | Pinned tool/fabricator path not verified; formats not claimed |
| 3D models empty | #23 retrieved no vendor STEP/WRL |
| RF adapter MPN UNVERIFIED | SOLT blocked |
| F1 / eFuse I²t | #24 TARGET only; no melting-time coordination |
| #28/#29 draft/read-only | Compression travel and B19 mechanical datums not locked |
| Independent CAM/DFM/safety review | Not started from this SHA |
| Human approval | Ordering / assembly / energize / fault / ESD still gated |

This package remains `PROTO-FAB` / UNQUALIFIED until every row is closed by a
later admitted leaf plus reviewers. #27 is out of scope.
