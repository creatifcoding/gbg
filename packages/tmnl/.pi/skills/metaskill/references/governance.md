# Governance — How metaskill Governs Skills

> up: INDEX.md
> prereqs: anatomy.md, frontmatter.md
> provides: governance-contract, self-referential-mechanics, agent-behavior
> children: none

## The Contract

A governed skill declares in its SKILL.md frontmatter:

```markdown
> governed-by: metaskill
```

This tells any agent: **before modifying this skill's structure, load metaskill and follow its protocols.**

## What metaskill Owns vs What It Doesn't

| metaskill owns | The skill owns |
|---|---|
| File shapes (SKILL.md, INDEX.md, REF.md structure) | Content (what the docs say about the domain) |
| Frontmatter protocol (which fields, how paths resolve) | Which topics exist and how they're organized |
| Changelog format (granular per-file) | What gets logged and version semantics |
| REF.md pattern (re-acquisition, triggers, suggestions) | Which REF.md files exist and what research they compile |
| Router rules (every file reachable, routes to files not concepts) | What the routes are and how the tree is shaped |
| Governance line in frontmatter | Whether to adopt governance (until mandated) |

metaskill is the **shape**. The skill is the **content**.

## How an Agent Uses Governance

### Scenario: Agent wants to add a doc to a skill

```
1. Agent is working with skill X
2. Agent decides skill X needs a new doc
3. Agent sees: > governed-by: metaskill
4. Agent loads metaskill/SKILL.md
5. Agent reads the router → "Adding a new doc node → references/anatomy.md"
6. Agent follows anatomy.md → learns the INDEX.md shape, frontmatter protocol
7. Agent creates the doc, updates INDEX, updates SKILL.md router, logs in CHANGELOG
```

### Scenario: Agent finds stale knowledge in a REF.md

```
1. Agent reads a REF.md and something doesn't match reality
2. Agent sees: > governed-by: metaskill
3. Agent loads metaskill → router → "Refreshing stale knowledge → references/ref-pattern.md"
4. Agent reads ref-pattern.md → learns the Re-Acquisition Protocol pattern
5. Agent runs the Re-Acquisition Protocol commands in the stale REF.md
6. Agent updates the REF.md with new findings
7. Agent logs the change in CHANGELOG
```

### Scenario: User says "overhaul skill X"

```
1. User invokes metaskill (or agent recognizes the intent)
2. Agent loads metaskill/SKILL.md → § Protocol: Overhaul
3. Agent audits skill X against metaskill's standards
4. Agent executes the overhaul protocol step by step
5. Agent logs everything in CHANGELOG
```

### Scenario: Agent wants to update metaskill itself

```
1. metaskill is self-governed (governed-by: metaskill)
2. Agent follows the same protocols it would for any other skill
3. But reads TEMPLATE.md and GRAPH.md at metaskill's own root
4. Changes are logged in metaskill's own CHANGELOG
```

## What "Ungoverned" Means

A skill without `governed-by: metaskill` is ungoverned. This means:
- No guarantee of frontmatter on its docs
- No guarantee of a changelog
- No guarantee the router covers all files
- An agent modifying it has no structural guidance

Ungoverned skills work — they just don't self-maintain. They drift. They accumulate dead nodes and stale knowledge without a protocol to detect or fix it.

## Adopting Governance

To bring an existing skill under governance:

```
1. Add > governed-by: metaskill to SKILL.md frontmatter
2. Run § Protocol: Audit from metaskill/SKILL.md
3. Fix gaps found by the audit
4. Log the adoption as a new version in CHANGELOG
```

## Bulk Governance Audit

Check all skills in the workspace:

```bash
cd packages/tmnl
for skill in .pi/skills/*/SKILL.md; do
  dir=$(dirname "$skill")
  name=$(basename "$dir")
  gov=$(grep -q 'governed-by: metaskill' "$skill" 2>/dev/null && echo "✓" || echo "✗")
  files=$(find "$dir" -name '*.md' | wc -l)
  cl=$(test -f "$dir/CHANGELOG.md" && echo "✓" || echo "✗")
  fm_miss=$(for f in $(find "$dir" -name '*.md'); do head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || echo 1; done | wc -l)
  printf "%-35s GOV:%s  FILES:%3d  CL:%s  FM_MISS:%d\n" "$name" "$gov" "$files" "$cl" "$fm_miss"
done
```
