# ERC waivers (issue 26 fixture)

Status: `UNVERIFIED`. `kicad-cli` is not in this runtime, so ERC/DRC were not
executed. Same gap as EE-01/EE-02/EE-03.

| Item | Disposition |
| --- | --- |
| kicad-cli ERC/DRC not run | Waiver: tool absent. Re-run when a pinned KiCad exists. |
| MAX96717/MAX96724 footprints have no pads | Expected. analog.com PDF timed out in #23. Do not invent a pad map. Courtyard is the declared reference plane. |
| IMX519 / Tachyon CSI not stuffed | Intentional. Coupon replaces active-device pins. MIPI stays local and off pogos. |
| Generic R/C/F1/TP/jumper empty footprints | Expected. MPN UNVERIFIED. DNP. |
| UNVERIFIED B27/B50/S1/S2/Q1 | #23 envelopes; do not fabricate without sourced series. |
| Hierarchical sheet pins unused (global labels) | Intentional, same as #24/#25. |
| Fault jumpers default DNP | Safe default is branch-off. Nominal series links are stuffed only after human approval. |
| LINK_LOCK_OBS unconnected to a SerDes pin | Expected. Lock pin map UNVERIFIED. Probe reserved only. |
| GMSL 100 ohm geometry TARGET | Width/gap/stackup UNVERIFIED. Not measured SI. |

No waiver converts P08 into a safety interlock. No waiver places MIPI on pogos.
No waiver marks the package QUALIFIED or shop-released.
