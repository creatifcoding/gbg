# Conductor Chat Shell/Header/Composer PR Checkpoints v1

Date: 2026-02-11  
Owner: Val

## PR-SHC-01 — Header semantic compounds

Scope:
- header-band semantic sub-compounds (`Controls`, `AgentSelector`, `SessionCluster`)
- export integration
- no behavior change

Evidence:
- typecheck + targeted regression test pass
- screenshot/DOM evidence for slot structure

---

## PR-SHC-02 — Connection badge interactive contract

Scope:
- `RvnChatConnectionBadge` expanded hover contract
- probe action affordance
- lazy visible-only detail compute path
- replace ad-hoc connection chip usage in header

Evidence:
- typecheck + regression tests
- short GIF or screenshot sequence showing compact -> expanded -> probe action

---

## PR-SHC-03 — Composer deep compounding

Scope:
- Input.Counter + Toolbar.VoiceGroup + Transport semantic sub-layer
- recompose `ConductorAgentChatComposer`
- preserve keyboard precedence and streaming transport semantics

Evidence:
- typecheck + regression tests
- keyboard precedence smoke (Esc, Tab, Enter) log

---

## PR-SHC-04 — Big-bang shell adoption

Scope:
- top-level `ConductorAgentChat` composed by `RvnChatShell` bands end-to-end
- remove remaining structural ad-hoc wrappers

Evidence:
- typecheck + regression tests
- manual L2/L3 flow check
- header/command/thread/composer band DOM proof

---

## Post-checkpoint freeze

After PR-SHC-04:
- freeze breakpoint constants and spacing clamps in a follow-up doc,
- then proceed to inline task thread full implementation lane.
