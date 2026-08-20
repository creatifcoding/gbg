# Environment fixtures

These files prove the **engineering runtime**, not terrarium geometry, circuits,
husbandry, or assistant product behavior.

They are intentionally tiny, deterministic, and labeled as environment fixtures.
A passing OpenSCAD cube or ngspice divider is not CAD or EE authority. Domain
reference sources remain owned by their issues:

| Missing domain fixture | Typed blocker | Owner |
| --- | --- | ---: |
| Native KiCad library/schematics | `BLOCKED_MISSING_FIXTURE` | #23 |
| Authoritative OCCT frame/rail | environment cube only; domain solids | #28 |
| Mastra/CopilotKit lock and compat fixture | `BLOCKED_MISSING_FIXTURE` | #50 |
| Assistant eval/golden browser fixture | `BLOCKED_MISSING_FIXTURE` | #50 |
| Rust edge simulator crate | `BLOCKED_MISSING_FIXTURE` | #54 |

`openEMS` is omitted until a headless smoke test qualifies it (`UNSUPPORTED_TOOL`).
