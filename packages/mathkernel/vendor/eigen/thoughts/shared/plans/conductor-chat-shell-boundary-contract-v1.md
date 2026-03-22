# Conductor Chat Shell Boundary Contract v1

Date: 2026-02-11  
Owner: Val  
Decision source: questionnaire `conductor-shell-vs-frame-boundary-v1`

## ALIGNED MODEL (locked)

- **Boundary model:** `shell-absorbs-frame`
- Shell is the top-level owner for:
  - layout band orchestration,
  - visual shell responsibility,
  - geometry/transition contract,
  - overlay + ornament layers,
  - slot guards and scroll isolation.
- Separate `frame` concern is treated as transitional/back-compat only, not primary architecture.

---

## Shell second-order contract

`RvnChatShell`
- `Root`
- `HeaderBand`
- `CommandBand`
- `ThreadBand`
- `ComposerBand`

Second-order shell responsibilities (required):
1. **OverlayLayer**
   - focus shell and geometry transition layer.
2. **OrnamentLayer**
   - corner caps / brutalist trim policy.
3. **GeometryContract**
   - L2/L3 sizing and transition invariants.
4. **ScrollContract**
   - thread/composer scroll isolation.
5. **SlotGuards**
   - anti-overfill constraints for slot providers.

---

## Header alignment (inside shell)

Header remains extended semantic compound:
- structural slots: Left/Center/Right + Title/Subtitle/Badges
- semantic compounds: Controls/AgentSelector/SessionCluster

---

## Non-goals

- No big-bang `ConductorAgentChat` adoption without explicit user unlock.
- No breakpoint constant freeze in this contract pass.

---

## Acceptance criteria

- Shell second-order responsibilities are documented and represented in component contracts.
- No design docs imply conflicting shell-vs-frame ownership.
- All downstream plans reference shell as primary ownership layer.

---

## Addendum v1.1 — Shell contract implementation status

Implemented (library-level contracts):
- `RvnChatShell.OverlayLayer`
- `RvnChatShell.OrnamentLayer`
- `RvnChatShell.GeometryContract`
- `RvnChatShell.ScrollContract`
- `RvnChatShell.SlotGuards`

Header semantic ownership alignment completed:
- `RvnChatHeaderBand.Controls`
- `RvnChatHeaderBand.AgentSelector`
- `RvnChatHeaderBand.SessionCluster`
- `RvnChatHeaderBand.ConnectionBadge` (interactive, visible-only expanded detail resolver path)

Guardrail remains unchanged:
- big-bang adoption in `ConductorAgentChat` remains deferred pending explicit user unlock.
