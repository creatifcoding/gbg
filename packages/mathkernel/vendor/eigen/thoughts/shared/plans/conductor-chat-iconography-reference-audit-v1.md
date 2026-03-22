# Conductor Chat Iconography Reference Audit v1

Date: 2026-02-11  
Owner: Val

## Reference source

`src/lib/conductor/integrate/react-app.js`

## Relevant findings

1. Message role glyph treatment exists for user and agent message bubbles.
2. Icon scales in the source cluster around:
   - ~16px role glyphs (`w-4 h-4`)
   - ~12px utility/status glyphs (`w-3 h-3`)
3. Stroke rendering pattern is visually equivalent to `strokeWidth={2}` in Lucide.
4. StatusIndicator style implies icon + label pairing, not icon-only semantics.

## RVN normalization decision

For deterministic implementation:
- Role identity icons are standardized to Lucide mapping in contract.
- Utility/status icons remain compact and consistent with 12px floor typography.
- All role/icon semantics must be recoverable without relying on shape recognition alone.

## Gaps still present in TMNL

- Role icon mapping is not yet fully enforced in message lane compounds.
- Streaming-only animation policy for agent icon is not yet implemented in dedicated badge compounds.
- HeaderCluster and SeverityRails do not yet share a formalized icon contract component.
