# Utils — Conceptual Reference

> up: INDEX.md
> prereqs: ../references/anatomy.md
> provides: utils-pattern, util-authoring, co-location-strategy
> children: none

## What Utils Are

Utils are executable verification scripts that live alongside the docs they validate. They are the **enforcement arm** of the skill — docs declare structure, utils verify it.

A util is a leaf doc containing one bash script with frontmatter. Nothing else. No prose explanations, no conceptual background — that's what REF.md is for. A util is a tool, not a lesson.

## Where Utils Live

```
.pi/skills/<skill>/
├── SKILL.md
├── utils/              ← metaskill's utils (governance-level verification)
│   ├── INDEX.md
│   ├── REF.md
│   └── <util>.md       ← one script per file
└── references/
    └── <topic>/
        └── utils/      ← topic-specific utils (domain-level verification)
            ├── INDEX.md
            └── <util>.md
```

**metaskill utils** verify structural governance: frontmatter, orphans, dead links, changelog coverage. They work on ANY skill.

**Skill-local utils** verify domain-specific concerns. An nx-workspace skill might have utils that check NX plugin registration matches the docs, or that version strings are consistent. These only make sense for that skill.

## Co-Location Principle

A util lives as close as possible to what it verifies:

| What it verifies | Where it lives |
|---|---|
| Skill-wide governance (frontmatter, structure) | `metaskill/utils/` |
| Topic-specific domain concerns | `<skill>/references/<topic>/utils/` |
| Skill-level domain concerns | `<skill>/utils/` |

If a reference doc says "verify → run `util:X`", the util should be findable by walking up from that doc to the nearest `utils/` directory. Not across the skill tree. Not in a global bin. Co-located.

## Util Shape

```markdown
# util:<name>

> up: INDEX.md
> prereqs: <what the agent should understand before running this>
> provides: <what this verifies>
> children: none

<One-line description.>

\```bash
<The script. Self-contained. Copy-paste-run.>
\```

## Output

<What success looks like. What failure looks like.>
```

**Rules:**
- One script per file. If a util needs two scripts, it's two utils.
- The script must be copy-pasteable into a terminal and work. No setup steps buried in prose.
- `SKILL=.pi/skills/<name>` is the parameterization convention. Agent substitutes `<name>`.
- Output section tells the agent what to expect — so it can judge pass/fail without human review.

## How Docs Reference Utils

Docs never inline scripts. They reference by name:

```markdown
**Verify** → run `util:full-health` from `utils/INDEX.md`.
```

Or for co-located utils in the same skill:

```markdown
**Verify** → run `util:version-sync` from `references/effect-v4/utils/INDEX.md`.
```

The pattern is always: `util:<name>` from `<path-to-utils>/INDEX.md`. The agent reads the INDEX, finds the util, reads its file, runs the script.

## Writing a New Util

1. Identify what needs verifying (structural? domain? topic-specific?)
2. Decide where it lives (metaskill? skill-local? topic-local?)
3. Create the file using the Util Shape above
4. Add to the nearest `utils/INDEX.md` inventory table
5. Update docs that should reference it ("verify → run util:X")
6. Log in CHANGELOG

## Re-Acquisition Protocol

Utils are scripts, not research — they don't go stale the way REF.md does. But they can break if:
- Frontmatter field names change (update the grep patterns)
- Skill directory structure changes (update find paths)
- New file types are introduced (update the checks)

When a util fails unexpectedly, check the metaskill CHANGELOG for structural changes, then update the script.
