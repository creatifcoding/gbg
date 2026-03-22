# Conductor Chat Iconography Contract v1

Date: 2026-02-11  
Owner: Val

## Scope

Message-surface iconography only (operator vs agent vs system vs tool), including badge pairing and Lucide precision requirements.

## Locked role mapping

- `operator` → `CircleUser`
- `agent` → `Bot`
- `system` → `Terminal`
- `tool` → `Hammer`

## Where icons must appear

1. `HeaderCluster.RoleBadge` (compact icon + role label)
2. `SeverityRails.RoleIconRail` (rail icon treatment)
3. `AttachmentLane.TelemetryBadge` (utility icon surface)
4. `HeaderCluster.StreamingBadge` (state icon marker)

## Badge surface policy

Required badge set on message shell:
- role badge
- streaming badge
- per-message status badge
- severity badge
- telemetry badge

Density policy: **full** (no default hiding policy in contract layer).

## Motion policy

- Animate role icon only for **streaming agent** messages.
- No role-icon animation for operator/system/tool.
- Leaf-owned micro-motion only; no root-wide icon choreography.

## Precision policy

Derived from `react-app.js` visual cues and normalized for RVN:
- role icons: `size={16}`, `strokeWidth={2}`
- utility/status icons: `size={12}`, `strokeWidth={2}`
- labels use `var(--tmnl-text-xs, 12px)` minimum

## Accessibility

- Icons are decorative when paired with text labels: `aria-hidden="true"`
- Role/status meaning must remain available in text label
- Streaming badge must expose state via text/attribute (not icon-only)

## Non-goals

- No big-bang `ConductorAgentChat` adoption in this contract.
- No shell/frame boundary changes in this icon pass.
