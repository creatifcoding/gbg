# ERC waivers (issue 24)

Status: `UNVERIFIED`. `kicad-cli` is not in this runtime, so ERC was not
executed. Same gap as EE-01.

| Item | Disposition |
| --- | --- |
| `kicad-cli` ERC not run | Waiver: tool absent. Re-run ERC when a pinned KiCad is present. |
| GMSL_P / GMSL_N unpowered on this project | Expected. #25 owns the channel. Not MIPI. |
| UNVERIFIED footprints on S1/S2/Q1/B27/B50 | Expected. #23 envelopes; do not fabricate. |
| Generic F1/R/C/TVS/ISO/discharge have empty footprints | Expected. MPN UNVERIFIED. |
| Power-flag / pin-type mismatches on envelope pins | Expected until a sourced Q1/S1/S2 MPN exists. |
| Hierarchical sheet pins unused (global labels used instead) | Intentional so sheets connect by net name without inventing a sheet-pin contract. |

No waiver converts P08 into a safety interlock. No waiver places MIPI on pogos.
