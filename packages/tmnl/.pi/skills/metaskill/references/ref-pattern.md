# REF.md — Deep Conceptual References

> up: INDEX.md
> prereqs: anatomy.md
> provides: ref-pattern, re-acquisition-protocol, compiled-research-pattern
> children: none

## What REF.md Is

A REF.md is compiled research about a topic — the **conceptual understanding** that an agent needs to work with the domain, not just follow procedures.

Every directory in a skill can have one. INDEX.md routes. REF.md teaches.

| File | Role | Content |
|---|---|---|
| INDEX.md | Router | "Here's what's in this directory. Pick one." |
| REF.md | Brain | "Here's how this whole thing works, end-to-end." |
| `<leaf>.md` | Specific | "Here's the details on this one entity/procedure." |

## When to Create a REF.md

Create one when:
- The topic has conceptual depth that an agent needs to work effectively (not just API signatures)
- The knowledge could go stale (library versions, external tool behavior, upstream API changes)
- An agent coming to this topic cold would otherwise need to research it from scratch
- You find yourself explaining the same "how it works" to multiple agents/sessions

Don't create one when:
- The topic is purely procedural (step 1, step 2, step 3)
- The knowledge is stable and self-evident from the leaf docs
- The directory only has 1-2 leaf docs that already explain everything

## REF.md Shape

```markdown
# <Topic> — Conceptual Reference

> up: INDEX.md
> prereqs: <related REF.md files, or none>
> provides: <deep-knowledge-keywords>
> children: none
> cross: <related REF.md files if bidirectional>

## What <Topic> Is
<Mental model. Not API docs — conceptual understanding. Why it exists,
what problem it solves, how to think about it.>

## How It Works
<End-to-end flow. Numbered steps, diagrams, or code showing the full lifecycle.
An agent reading this should understand the machinery, not just the interface.>

## <Key Concept 1>
<Deep section per important concept. Tables, code blocks, before/after examples.>

## <Key Concept N>
...

---

## Re-Acquisition Protocol
<Exact commands to re-research this topic.>

## Update Triggers
<Observable events that signal staleness.>

## Suggestions
<Actionable improvements.>
```

## Re-Acquisition Protocol

This is the most important section. It tells a future agent: "If this doc is wrong or stale, here's exactly how to fix it."

**Rules:**
- Commands must be **copy-pasteable**. Not prose. Not "look it up."
- Include both **research commands** (deepwiki, web search, source reading) and **validation commands** (CLI checks, grep, test runs).
- Include **source URLs** for the canonical truth.

**Example:**
```markdown
## Re-Acquisition Protocol

\```
# Research
deepwiki_ask_question("nrwl/nx", "How does createNodesV2 work?")

# Validate
bunx nx show project @tmnl/stx          # verify metadata injection
bunx nx list ./tools/nx-effect           # verify generator discovery

# Source of truth
https://nx.dev/extending-nx/creating-plugins
submodules/effect-smol/packages/effect/src/unstable/reactivity/
\```
```

## Update Triggers

Observable events. Not "when things change" — **specific, detectable signals.**

**Good triggers:**
- NX major version bump (check `bunx nx --version`)
- Effect v4 beta version changes
- A lint rule starts failing that didn't before
- New subpath exports added to a dependency

**Bad triggers:**
- "When the API changes" (how would you know?)
- "When things feel stale" (not actionable)
- "Periodically" (no signal)

## Suggestions

Actionable items the next agent should consider. Not wishes — concrete changes with enough detail to execute.

**Good:**
- "Add `notDependOnLibsWithTags: ['effect:v3']` to prevent reverse contamination"
- "Write a `createDependencies` function that adds graph edges from v4 packages to the alias node"

**Bad:**
- "Consider improving the architecture"
- "Look into better patterns"

## How REF.md Relates to Other Files

```
INDEX.md ──[routes to]──→ leaf docs (specific entities)
    │
    └──[routes to]──→ REF.md (deep understanding)
                         │
                         ├── Re-Acquisition Protocol (how to refresh)
                         ├── Update Triggers (when to refresh)
                         └── Suggestions (what to improve)
```

An agent working on a task reads the leaf doc. An agent trying to understand the domain reads REF.md. An agent noticing stale info reads the Re-Acquisition Protocol.
