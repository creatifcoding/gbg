# Conductor Chat UX v1 — Implementation Traceability Matrix

Owner: Val  
Date: 2026-02-10  
Feature: #F208 / #F209

## Purpose

Bind the locked UX artifact set to executable implementation tasks and PR checkpoints.

## Canonical Artifact Inputs

- `conductor-chat-ux-canonical-spec-v1.md`
- `conductor-chat-layout-state-spec-v1.md`
- `conductor-chat-component-contract-map-v1.md`
- `conductor-chat-interaction-precedence-matrix-v1.md`
- `conductor-chat-failure-copy-severity-matrix-v1.md`
- `conductor-chat-motion-expansion-spec-v1.md`

## Artifact → Task Mapping

| Artifact Contract | Implementation Tasks | PR Checkpoint |
|---|---|---|
| L3 sticky shell + hidden inspector | #755 | #759 (PR-01) |
| Thread base + role extensions + stream collapse + status/error/breakout rows | #756 #757 #758 | #759 (PR-01) |
| Contenteditable composer (no textarea) + arbitration + send↔pause + reconnect placement | #760 #761 #762 | #763 (PR-02) |
| Node-scoped atoms + draft/scroll persistence + node-local dispatch | #764 #765 #766 | #767 (PR-03) |
| Failure severity/copy matrix + motion contract + keyboard/live-region a11y | #768 #769 #770 | #771 (PR-04) |
| Governed runtime event binding + observability + reconnect/replay validation | #772 #773 #774 | #775 (PR-05) |
| Regression matrix + handoff/runbook evidence | #776 #777 | #778 (PR-06) |

## Governance Coupling

- Runtime integration scope is blocked behind #754.
- #754 is blocked on completion of P0 hard-cut tasks: #726 #727 #728 #729 #730 #731 #732.

## Evidence Rules

Every checkpoint PR must include:
1. task status updates + indexes
2. test evidence
3. gate note against #F208
4. rollback note in PR description
