---
up: ../SKILL.md
prereqs: none
provides: effect-sui-reference-router, topic-index
children: grounding.md, package-map.md, ontology.md, ptb-flow-query.md, nix-localnet-move.md, testing-release.md, sui-research.md, sui/INDEX.md, editing-protocol.md
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Effect-Sui References

> up: ../SKILL.md
> prereqs: none
> provides: effect-sui-reference-router, topic-index
> children: grounding.md, package-map.md, ontology.md, ptb-flow-query.md, nix-localnet-move.md, testing-release.md, sui-research.md, sui/INDEX.md, editing-protocol.md

## Contents

| File | When to read |
|---|---|
| `grounding.md` | Before any implementation; path anchors, source precedence, and research discipline. |
| `package-map.md` | When locating ownership of a feature or deciding where new code belongs. |
| `ontology.md` | When touching public nouns, yield semantics, Effectable facades, or BCS boundaries. |
| `ptb-flow-query.md` | When editing PTB AST/compiler, Query reads, Flow lifecycle, reservations, publish, finality, wallet auth. |
| `nix-localnet-move.md` | When editing package devshell, Nix modules, mission-control, Docker localnet, or `sui move` commands. |
| `testing-release.md` | When choosing validation gates, running localnet, or preparing release proof. |
| `sui-research.md` | When you need upstream Sui / Mysten SDK source paths, grep commands, or CLI reality checks. |
| `sui/INDEX.md` | When you need the deeper Sui dossier: object model, lifecycle, PTBs, gas/auth, Move packages, SDK, and localnet. |
| `editing-protocol.md` | Before commits, risky refactors, or when root package files are dirty. |

## Cross-References

- Project docs: `../../packages/effect-sui/docs/*.md` from `packages/tmnl`.
- Effect skills: `effect-v4-schema`, `effect-v4-services`, `effect-v4-atom`.
- Workspace skills: `nx-workspace`, `git-commits`, `commit`.
