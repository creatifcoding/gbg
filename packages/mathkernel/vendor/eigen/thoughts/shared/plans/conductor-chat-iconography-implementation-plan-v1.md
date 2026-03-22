# Conductor Chat Iconography Implementation Plan v1

Date: 2026-02-11  
Owner: Val

## Goal

Implement role/icon badge surfaces in message compounds per locked Lucide mapping and precision policy, without triggering big-bang adoption.

## Sequence

### ICON-01 — Shared role icon contract utilities
Deliverables:
- Role enum → Lucide component mapping helper
- Precision helpers for role vs utility icons

Exit criteria:
- All icon consumers can import one canonical mapping.

### ICON-02 — HeaderCluster icon surfaces
Deliverables:
- `HeaderCluster.RoleBadge`
- `HeaderCluster.StreamingBadge`

Rules:
- RoleBadge uses role icon + text label.
- StreamingBadge supports state marker and agent-stream animation hook.

### ICON-03 — SeverityRails icon surfaces
Deliverables:
- `SeverityRails.RoleIconRail`

Rules:
- Mirrors role mapping from HeaderCluster.
- Visual rail contract remains role/severity-driven.

### ICON-04 — AttachmentLane telemetry badge
Deliverables:
- `AttachmentLane.TelemetryBadge`

Rules:
- Utility icon precision (12/2)
- Must compose with status/collapse controls.

### ICON-05 — Policy enforcement + docs sync
Deliverables:
- apply precision policy (`16/2` role, `12/2` utility)
- agent-only streaming icon animation
- update alignment docs and execution note

### ICON-06 — Focused validation
Commands:
1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`

Guard:
- big-bang adoption remains deferred.
