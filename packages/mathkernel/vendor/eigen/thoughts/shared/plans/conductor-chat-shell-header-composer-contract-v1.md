# Conductor Chat Shell/Header/Composer Contract v1

Date: 2026-02-11  
Owner: Val  
Decision source: questionnaire `conductor-shell-header-composer-contract-v1` + follow-up `conductor-badge-adoption-followup-v1`

## Locked Decisions

1. **Shell ownership model**: `bands-semantic`
   - Bands are not dumb wrappers; they own semantic APIs and behavior contracts.
2. **Header depth**: `header-extended`
   - Header includes Basic regions + Controls + AgentSelector + SessionCluster compounds.
3. **Composer depth**: `composer-deep`
   - Second-order compounding is required.
4. **Connection badge behavior**:
   - icon + state-driven visual language
   - hover expansion micro-layout
   - latency + probe action in expanded state
   - expensive detail computation only while expanded/visible
5. **Adoption strategy**: `adopt-big-bang`
   - direct replacement in `ConductorAgentChat` once compounds are complete.
6. **Breakpoints**: intentionally deferred
   - user directive: finalize through implementation pass, not pre-frozen now.

---

## Compound Contract

## 1) Shell (4-band, semantic)

`RvnChatShell`
- `Root`
- `HeaderBand`
- `CommandBand`
- `ThreadBand`
- `ComposerBand`

Behavior contract:
- header and composer bands remain sticky participants in frame rhythm.
- thread band is primary scroll zone.
- command band behavior stays explicit (not merged into random header controls).

## 2) Header (extended)

`RvnChatHeaderBand`
- structural slots:
  - `Left`
  - `Center`
  - `Right`
  - `Title`
  - `Subtitle`
  - `Badges`
- semantic sub-compounds (new required layer):
  - `Controls`
  - `AgentSelector`
  - `SessionCluster`

Contract intent:
- Layout slots define placement.
- Semantic sub-compounds define behavior + interaction states.

## 3) Connection badge (interactive)

`RvnChatConnectionBadge`

Minimum contract:
- `state: offline|connecting|online|reconnecting|resyncing`
- compact view: icon + state affordance
- hover/expanded view: latency + probe action
- compute policy: expanded details computed only while visible

Implementation note:
- must respect reduced motion and 12px floor.

## 4) Composer (second-order deep compound)

`RvnChatComposer`
- `Root`
- `Input`
  - `Field` (contenteditable)
  - `Placeholder`
  - `Counter` (new)
- `Suggestions`
  - `Root`
  - `Item`
- `Toolbar`
  - `ModeGroup`
  - `InsertGroup`
  - `VoiceGroup` (new)
  - `TransportGroup`
  - `ToolBtn`
- `Transport` (new semantic layer)
  - `Primary` (send/pause stateful)
  - `Reconnect`
- `RecordingBanner`

Contract intent:
- preserve explicit ownership of micro-interactions at leaf level.
- keep contenteditable path canonical (no textarea fallback).

---

## Non-goals (this contract)

- inline task thread implementation details (covered by dedicated inline task thread contract doc)
- final breakpoint token values (deferred to implementation validation pass)

---

## Acceptance for Contract Completion

- All listed compounds exist with stable exports under `src/lib/rvn/chat/*`.
- `ConductorAgentChat` can be composed using shell/header/composer compounds without ad-hoc structural divs.
- Connection badge supports compact + hover-expanded behavior and probe affordance.
- Composer controls map to second-order compound boundaries (no mixed ownership).

---

## Addendum v1.1 — Deep composer completion status

Implemented at library/component contract level:
- `RvnChatComposer.Input.Counter`
- `RvnChatComposer.Toolbar.VoiceGroup`
- `RvnChatComposer.Transport`
  - `RvnChatComposer.Transport.Primary`
  - `RvnChatComposer.Transport.Reconnect`

Execution mode in current lane:
- contract-first completion with no big-bang `ConductorAgentChat` adoption.
