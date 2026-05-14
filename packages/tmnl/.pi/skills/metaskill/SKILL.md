---
name: metaskill
description: Skill governance codemod — create, inspect, update, delete, adopt, and dogfood skills. The meta-skill that governs all skills with CRUD protocols, verification utils, and self-referential governance.
---

# metaskill

> prereqs: none
> provides: skill-governance, CRUD-protocols, dogfood-protocol
> children: GRAPH.md, CHANGELOG.md, references/INDEX.md, utils/INDEX.md
> governed-by: metaskill

The skill that governs all skills. CRUD on skills, nodes, and utils — plus dogfood.

## When to Load

- Creating, inspecting, updating, or deleting a skill
- Adding, refreshing, or removing a doc node
- Writing or running a verification util
- Dogfooding — verifying a skill with its own tools
- Bulk auditing the workspace

## Entities & Operations

```
Entity      Create   Inspect   Update    Delete   Special
──────────  ───────  ────────  ────────  ───────  ──────────────
Skill       ✓        ✓         ✓         ✓        adopt, dogfood
Node        ✓        ✓         ✓         ✓        refresh (re-acquire)
Util        ✓        —         ✓         ✓        run
Workspace   —        ✓         —         —        bulk-adopt
```

## Router

```
What are you doing?
│
├─ SKILL operations
│  ├─ Create a new skill ───────────── § skill:create
│  ├─ Inspect / audit a skill ──────── § skill:inspect
│  ├─ Update / overhaul a skill ────── § skill:update
│  ├─ Delete a skill ───────────────── § skill:delete
│  ├─ Adopt governance ─────────────── § skill:adopt
│  └─ Dogfood (self-verify) ────────── § skill:dogfood
│
├─ NODE operations
│  ├─ Add a doc to a skill ─────────── § node:create
│  ├─ Inspect a doc ────────────────── § node:inspect
│  ├─ Update / fix a doc ──────────── § node:update
│  ├─ Delete a doc ─────────────────── § node:delete
│  └─ Refresh stale REF.md ─────────── § node:refresh
│
├─ UTIL operations
│  ├─ Write a new util ─────────────── § util:create
│  ├─ Run a util ───────────────────── § util:run
│  ├─ Update a util ────────────────── § util:update
│  └─ Delete a util ────────────────── § util:delete
│
├─ WORKSPACE operations
│  ├─ Audit all skills ─────────────── § workspace:inspect
│  └─ Bulk adopt governance ────────── § workspace:adopt
│
└─ Understanding the system
   ├─ Skill file shapes ────────────── references/anatomy.md
   ├─ Frontmatter fields ──────────── references/frontmatter.md
   ├─ REF.md pattern ───────────────── references/ref-pattern.md
   ├─ Changelog format ─────────────── references/changelog.md
   ├─ Governance contract ──────────── references/governance.md
   └─ Utils pattern ────────────────── utils/REF.md
```

---

## § skill:create

Scaffold a new skill from zero.

```
1. Name: lowercase, hyphenated. Location: .pi/skills/<name>/
2. mkdir -p .pi/skills/<name>/references
3. Write SKILL.md — use shape from references/anatomy.md
   - Router must cover every user intent
   - "When to Load" must be specific
4. Add frontmatter: > governed-by: metaskill
5. If deep topics → create references/ with INDEX.md, leaf docs, REF.md per topic
6. Add frontmatter to every .md — see references/frontmatter.md
7. Write CHANGELOG.md — v0.1.0 per-file granular format
8. If >6 nodes → add GRAPH.md
9. Verify → util:full-health
```

## § skill:inspect

Audit a skill's structural health.

```
1. Run util:full-health against the target skill
2. Optionally run individual utils for specific concerns:
   - util:children-sync — INDEX children vs actual files
   - util:cross-symmetry — bidirectional cross refs
   - util:router-coverage — leaf docs reachable from SKILL.md
3. Report findings. Each ✗ is actionable.
```

## § skill:update

Modify or overhaul an existing skill.

```
1. Run § skill:inspect first — know what you're working with
2. Read metaskill references for the relevant shapes:
   - references/anatomy.md — what files should exist
   - references/frontmatter.md — what headers should look like
   - references/ref-pattern.md — should there be REF.md files?
3. Execute changes:
   a. Add frontmatter to docs missing it
   b. Create missing structural files (CHANGELOG, GRAPH, INDEX)
   c. Create REF.md files for topics that need deep context
   d. Rewrite SKILL.md router to cover everything
   e. Add governance if missing: > governed-by: metaskill
4. Bump version in CHANGELOG.md — per-file granular
5. Verify → util:full-health
```

## § skill:delete

Remove a skill entirely.

```
1. Confirm with user — deletion is permanent
2. Check for cross: references from other skills pointing here
3. rm -rf .pi/skills/<name>
4. Update any skills that referenced this one
```

## § skill:adopt

Bring an ungoverned skill under governance.

```
1. Run util:governance-adopt — injects the frontmatter line
2. Run util:full-health — find structural gaps
3. Fix gaps (missing frontmatter, missing CHANGELOG, broken links)
4. Log adoption as new version in CHANGELOG
```

## § skill:dogfood

Verify a skill using its own tools and protocols, then verify the verification caught real issues.

```
1. Run § skill:inspect — full-health + extended checks
2. If the skill has its own utils/ directory:
   a. Run the skill's own domain-specific utils against itself
   b. Check: do the utils actually test what they claim?
3. Deliberately look for what the automated checks MISS:
   - Router branches that are technically reachable but misleading
   - Frontmatter that parses but has wrong values (wrong up: path, stale prereqs)
   - REF.md re-acquisition protocols that reference dead URLs or tools
   - Changelog that mentions files but describes the wrong change
4. Log new util ideas for any gap found in step 3
5. If new utils written → re-run § skill:inspect to confirm they integrate cleanly
```

---

## § node:create

Add a new doc to an existing skill.

```
1. Decide placement — which directory? (references/<topic>/, utils/, skill root?)
2. See references/anatomy.md for the right file shape
3. Write the file with full frontmatter (up, prereqs, provides, children)
4. Add to the nearest INDEX.md children
5. Add to SKILL.md router if directly routable
6. If the skill has GRAPH.md → add the node
7. Log in CHANGELOG
8. Verify → util:children-sync
```

## § node:inspect

Check a specific doc's integrity.

```
1. Check frontmatter completeness — util:frontmatter-check scoped to that file
2. Check that up: path resolves
3. Check that prereqs: all exist
4. Check that children: all exist (if declared)
5. Check that cross: is bidirectional — util:cross-symmetry
```

## § node:update

Modify an existing doc.

```
1. Make the content change
2. If paths changed → update frontmatter (up, prereqs, children) in affected files
3. If file renamed → update all references (INDEX children, SKILL.md router, GRAPH.md)
4. Log in CHANGELOG
5. Verify → util:dead-link-check
```

## § node:delete

Remove a doc from a skill.

```
1. Remove the file
2. Remove from nearest INDEX.md children
3. Remove from SKILL.md router
4. Remove from GRAPH.md
5. Check for prereqs: and cross: refs from other docs → update them
6. Log in CHANGELOG
7. Verify → util:orphan-check + util:dead-link-check
```

## § node:refresh

Re-acquire stale knowledge in a REF.md.

```
1. Read the REF.md's Re-Acquisition Protocol section
2. Run the listed commands (deepwiki, effect-docs, etc.)
3. Update the REF.md content with new findings
4. Update the "last verified" or version references
5. Log in CHANGELOG with what changed
```

---

## § util:create

Write a new verification script.

```
1. Decide scope — governance-level (metaskill/utils/) or domain-specific (<skill>/utils/)
2. Write the file using the shape in utils/REF.md
3. Add to the nearest utils/INDEX.md children + inventory table
4. Update docs that should reference it ("verify → run util:X")
5. Log in CHANGELOG
```

## § util:run

Execute a util against a target skill.

```
1. Read the util file from utils/INDEX.md → find the right one
2. Adapt the script to context (substitute SKILL path, adjust cwd)
3. Run it
4. Interpret output using the util's ## Output section
```

## § util:update

Modify an existing util's script.

```
1. Update the script
2. Log in CHANGELOG
3. Run the util against a known-good skill to verify it still passes
```

## § util:delete

Remove a util.

```
1. Remove the file
2. Remove from utils/INDEX.md children + inventory table
3. Update docs that referenced it
4. Log in CHANGELOG
```

---

## § workspace:inspect

Bulk audit all skills in the workspace.

```
1. Run util:audit-all — one-line summary per skill
2. Triage: focus on skills with ✗ GOV, high FM_MISS, or missing CL
3. For each failing skill → § skill:inspect for detail
```

## § workspace:adopt

Bring all ungoverned skills under governance.

```
1. Run util:audit-all — identify ✗ GOV skills
2. For each ungoverned skill → § skill:adopt
```

---

## Governance Contract

Every governed skill declares in SKILL.md frontmatter:

```markdown
> governed-by: metaskill
```

metaskill owns the **shape** (file structure, frontmatter protocol, changelog format, REF.md pattern). The skill owns its **content** (what topics exist, what the docs say, how the tree is shaped).

See `references/governance.md` for the full contract, agent scenarios, and adoption mechanics.
