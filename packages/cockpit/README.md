# @tmnl/cockpit

TMNL React Native migration cockpit spine.

This package proves the first vertical slice loop before extracting smaller packages:

```txt
SurfaceActor
→ access decision
→ UI branch / approval / proxy / degrade
→ session/runtime action
```

## Boundary

`@tmnl/cockpit` is intentionally the first package because it is the system integrator for the React Native cockpit slice. It may temporarily contain inline access decision logic until behavior stabilizes.

Do **not** start by extracting `@tmnl/capability-access`, `@tmnl/surfaces`, or `@tmnl/platform-runtime`. Those packages should earn their existence after this loop runs under Expo Go/dev-build constraints.

## Dependencies

- `@tmnl/stx` — canonical STX/XState/Atom runtime
- `effect-v4` — Schema + Effect contracts during the v4 migration window
- `xstate` — state machine definitions consumed by `@tmnl/stx`

## Current status

Package shell + unit-tested core loop only. No Expo UI code yet.
