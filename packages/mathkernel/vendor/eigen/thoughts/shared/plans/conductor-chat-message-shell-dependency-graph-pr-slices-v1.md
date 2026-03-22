# Conductor Chat Message+Shell Dependency Graph + PR Slice Map v1

Date: 2026-02-11  
Owner: Val

Scope: `#F234` (Message second-order compounds) + `#F238` (Shell absorbs frame)

## 1) One-page dependency graph (focused)

```mermaid
flowchart TD
  subgraph MSG[#F234 Message second-order]
    T850[#850 HeaderCluster]
    T851[#851 BodyContent]
    T852[#852 FooterActions]
    T853[#853 SeverityRails]
    T854[#854 AttachmentLane root]
    T855[#855 Attachment: InlineTaskThread slot]
    T856[#856 Attachment: ArtifactCard slot]
    T857[#857 Attachment: Status badges]
    T858[#858 Attachment: Collapse controls]
    T859[#859 Enforce messageAnchorId binding]
    T860[#860 Sync message docs]
    T861[#861 Message slice validation]

    T850 --> T851
    T851 --> T852
    T851 --> T853
    T850 --> T854
    T854 --> T855
    T854 --> T856
    T854 --> T857
    T854 --> T858
    T855 --> T859
    T856 --> T859
    T859 --> T860
    T860 --> T861
    T852 --> T861
    T853 --> T861
    T857 --> T861
    T858 --> T861
  end

  subgraph SH[#F238 Shell second-order absorption]
    T862[#862 Shell OverlayLayer]
    T863[#863 Shell OrnamentLayer]
    T864[#864 Shell GeometryContract]
    T865[#865 Shell ScrollContract]
    T866[#866 Shell SlotGuards]
    T867[#867 Align Header.Controls]
    T868[#868 Align Header.AgentSelector]
    T869[#869 Align Header.SessionCluster]
    T870[#870 Align interactive ConnectionBadge]
    T871[#871 Sync shell boundary docs]
    T872[#872 Shell slice validation]
    T873[#873 Non-adoption guard]

    T862 --> T863
    T862 --> T864
    T862 --> T865
    T862 --> T866
    T866 --> T867
    T866 --> T868
    T866 --> T869
    T867 --> T870
    T868 --> T870
    T869 --> T870
    T870 --> T871
    T863 --> T871
    T864 --> T871
    T865 --> T871
    T872 --> T873
  end

  T861 --> T862
  T861 --> T872
```

## 2) PR slice map (execution order)

### PR-MSG-01 — Message lanes skeleton
- Tasks: `#850 #851 #852 #853 #854`
- Goal: lock second-order message lane contracts (no adoption).
- Exit: lane APIs compile and export cleanly.

### PR-MSG-02 — AttachmentLane required surfaces
- Tasks: `#855 #856 #857 #858 #859`
- Goal: attachment lane contract complete + `messageAnchorId` binding rule enforced.
- Exit: attachment mounts + controls present; binding policy documented in code comments/types.

### PR-MSG-03 — Message docs + validation
- Tasks: `#860 #861`
- Goal: docs synced and message slice validated.
- Exit: focused compile/tests pass for message slice.

Execution status:
- PR-MSG-01 ✅
- PR-MSG-02 ✅
- PR-MSG-03 ⏳ active

### PR-SHELL-01 — Shell second-order layer contracts
- Tasks: `#862 #863 #864 #865 #866`
- Depends on: `PR-MSG-03`
- Goal: shell absorbs frame responsibilities in explicit contracts.

### PR-SHELL-02 — Header semantic alignment under shell
- Tasks: `#867 #868 #869 #870`
- Depends on: `PR-SHELL-01`
- Goal: header semantic compounds + interactive connection badge alignment under shell ownership.

### PR-SHELL-03 — Docs/validation/guard
- Tasks: `#871 #872 #873`
- Depends on: `PR-SHELL-02` and message validation gate
- Goal: boundary docs finalized, validation run, and explicit no-big-bang guard verified.

Execution status:
- PR-SHELL-01 ✅
- PR-SHELL-02 ✅
- PR-SHELL-03 ✅

## 3) Guardrails

- Big-bang adoption in `ConductorAgentChat.tsx` stays blocked until explicit user unlock.
- This sequence is contract-first and non-invasive to runtime behavior.
