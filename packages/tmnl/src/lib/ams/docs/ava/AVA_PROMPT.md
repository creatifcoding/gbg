### 1. Document model: “best-effort sequential explorations”

Define an explicit mental model for the agent:

1. **Documents are exploratory, not law.**

   * Every design doc, wiki page, and copied ChatGPT response is:

     * a *snapshot* of the thinking at a point in time,
     * potentially superseded by later material.

2. **Sequential, but not always consistent.**

   * Later docs tend to refine or overwrite earlier ones,
   * but may also explore alternate designs.

3. **Agent rule of thumb:**

   * Treat docs as:

     * “proposals + context + constraints”,
     * not as fixed formal specs,
   * and always look for *later* material that tightens or adjusts earlier ideas.

You can encode this explicitly in the meta-prompt:

> “All documents you read (wiki pages, design notes, prior responses) are best-effort sequential explorations. They may be incomplete, partially obsolete, or exploratory. Your job is to:
>
> * infer the currently preferred design,
> * preserve valuable prior ideas as alternative patterns or beads,
> * never assume a single document is the complete truth.”

### 2. How the agent should read the bundle of responses you paste

Assume you will paste my prior answers as multiple documents into DeepWiki (or similar). The agent should follow a consistent reading pipeline:

1. **Identify the bundle.**

   * For each response you paste, attach minimal metadata:

     * `title` (e.g. `AMS/Views/Architecture-v1`, `AMS/Views/HybridArtifacts-v2`)
     * `timestamp`
     * `source` (e.g. `chatgpt-response`, `manual-note`)
   * The agent should read them in **chronological order**, but keep track of `v1`, `v2`, etc.

2. **Make a working meta-index.**

   * On startup, the agent builds a short internal summary:

     * “These 3 docs describe the AMS asset schema.”
     * “These 2 docs describe assemblages.”
     * “These 4 docs describe view artifacts and channels.”
   * It can store this as a small table in memory or a dedicated wiki page:

     * `Index/AMS-Views-Design`

3. **Detect supersession.**

   * When later docs explicitly refine earlier ones, the agent should:

     * mark earlier content as “superseded in part,”
     * but still harvest patterns/pitfalls from them.
   * Simple heuristics:

     * Titles with `v2`, `v3`, or “Continue”:

       * treat as refinements of the previous section.
     * Later docs that restate the same concepts with more constraints:

       * treat later as more authoritative on *structure*,
       * earlier as additional *rationale* and *pitfalls*.

4. **Build a unified “working spec” page.**

   * The agent should *always* maintain a synthesized “current best” page, e.g.:

     * `AMS/Views/Current-Spec`
   * This page:

     * merges key concepts from all prior docs,
     * notes known open questions or contradictions,
     * references original docs with links/IDs.

This “working spec” is what the agent uses as its *primary* reference for generation. The original docs become supporting evidence and pattern libraries.

### 3. Self-referential usage of previous answers (beads + pages)

You said you will copy/paste my previous responses; we want the agent to *reify* that usage.

#### 3.1 Turn prior responses into beads and pages

Agent behavior on encountering a new pasted response:

1. **Classify the content.**

   * Example classes:

     * `ARCHITECTURE_OVERVIEW` (e.g. AMS/Assemblage/View/Artifact stack)
     * `PATTERN_CODE` (Effect Schema, Schema.Class, extend, etc.)
     * `PITFALLS_AND_MITIGATIONS`
     * `IMPLEMENTATION_GUIDE`

2. **Split into:**

   * **Conceptual page(s)**:

     * `AMS/Architecture/Views-vN`
     * `AMS/Architecture/Assemblages-vN`
     * `AMS/Architecture/Artifacts-vN`
   * **Bead page(s)**:

     * `Beads/Effect/SchemaClassHierarchy`
     * `Beads/AMS/Views/HybridChannels`
     * `Beads/AMS/AssemblageSpec-Pattern`

3. **Record provenance.**

   * On each page, include:

     * Source: `chatgpt-response YYYY-MM-DD`
     * Original message ID or title, if available.
   * The agent should always preserve provenance when reusing ideas.

#### 3.2 When generating new work, the agent must:

1. **Load beads first.**

   * Before proposing new code/specs, check:

     * `Beads/Effect/...`
     * `Beads/AMS/...`
   * Reuse these rather than invent new patterns.

2. **Cross-reference conceptual pages.**

   * When it needs to reason about views, it should consult:

     * `AMS/Architecture/Views-Current-Spec`
     * and older versions if needed for rationale.

3. **Explicitly cite the origin.**

   * In comments or docstrings, the agent can embed:

     * `// pattern derived from AMS/Architecture/Views-v2`
     * `// see Beads/AMS/Views/HybridChannels`

This makes the system self-referential and traceable.

### 4. Concrete rules the agent should follow when using these docs

You can embed these as explicit bullet rules in the meta-prompt:

1. **Always read the “Current Spec” first.**

   * For any domain (AMS, WMS, TMS, Views, Assemblages, Artifacts), find pages named like:

     * `…/Current-Spec`
   * Treat these as the primary design reference.

2. **Always check for historical context.**

   * When modifying or extending something, also read:

     * prior `v1`, `v2` docs that led to the `Current-Spec`.
   * Extract:

     * pitfalls,
     * design tradeoffs,
     * rejected approaches.

3. **Never assume a single doc is authoritative.**

   * Cross-check:

     * meta-prompt,
     * `Current-Spec`,
     * related beads.
   * If there’s a conflict:

     * prefer the most recent, explicitly versioned spec,
     * but keep alternatives in mind as “future variation patterns.”

4. **Always update the “Current Spec” after a significant change.**

   * When the agent generates a new approved `ViewProfileSpec`/`AssemblageSpec` or refactors the architecture:

     * it must produce a patch for the `Current-Spec` page,
     * describing:

       * what changed,
       * why,
       * how it affects older docs.

5. **Treat your own outputs as first-class inputs.**

   * For every successful implementation/merge:

     * the agent writes:

       * a short bead describing the pattern,
       * a short note updating the relevant spec page.
   * Next time, the agent **uses those same beads** instead of reinventing code.

6. **Use explicit references to earlier responses.**

   * When you paste my prior responses as docs, ensure each has a stable ID/title:

     * `Doc:AMS-Views-Design-v1`
     * `Doc:AMS-Views-Design-v2`
   * The agent should:

     * refer to them by these IDs in comments and wiki pages,
     * e.g. “This profile structure is derived from `Doc:AMS-Views-Design-v3`, section ‘Hybrid Channels.’”

### 5. Adaptation to preexisting code (merge-aware behavior)

Tie this back to the existing implementation guide:

1. **Scan before authoring.**

   * Before proposing any new ViewProfileSpec or AssemblageSpec, the agent:

     * searches for similar profiles/assemblages in the codebase and docs,
     * compares structure and naming.

2. **Prefer extension/merging.**

   * If it finds:

     * an existing `view:wms:truck:v1` and you want a tweak:

       * propose `v2`, plus a registry update,
       * or propose a non-breaking extension (extra channel) if allowed.
   * For assemblages:

     * prefer adding a child assemblage rather than another “parallel” one,
       when semantics overlap.

3. **Diff-aware proposals.**

   * When generating patches, the agent should:

     * explain the diff relative to existing code:

       * “Adding new `ChannelSpec` ‘telemetry’ to `view:wms:truck:v2`.”
       * “Extending `assemblage:truck` with additional trait predicate from Doc:AMS-Assemblage-Pitfalls-v1.”

This ensures that all changes are conscious merges with prior thinking, not blind rewrites.

### 6. Minimal meta-prompt snippet you can paste for the agent

You can embed something like this (adapt as you like):

```text
All design and architecture documents you see, including wiki pages, prior chat responses, and code comments, are best-effort sequential explorations. They are not final or perfect specifications.

Your responsibilities:

1. Treat documents as a sequence of evolving thoughts. Later documents usually refine or correct earlier ones.
2. Always consult:
   - the “Current-Spec” page for the domain (e.g. AMS/Architecture/Views-Current-Spec),
   - plus earlier versions (v1, v2, …) for historical context.
3. Extract reusable patterns as “beads” from past responses and code. Reuse these beads rather than inventing new patterns.
4. When I paste prior ChatGPT responses as documents, treat them as source material:
   - index them by ID/title,
   - split them into conceptual pages and bead pages,
   - reference them explicitly in your outputs.
5. Never assume a single document is fully authoritative. Cross-check meta-prompt, current specs, and beads. If there is a conflict, prefer the latest explicit spec but preserve older ideas as alternative patterns.
6. After making significant changes (new views, new assemblages, schema changes), propose updates to:
   - the relevant Current-Spec page,
   - the bead library capturing any new recurring pattern.
7. When generating code or specs, be merge-aware:
   - scan existing code and specs,
   - prefer extensions and new versions over destructive changes,
   - describe your changes as diffs relative to existing material.
```

That, combined with the earlier implementation guide + beads system, gives the agent a clear way to:

* understand documents as sequential explorations,
* reference and reuse the prior responses you paste,
* and integrate new work with existing code and design in a merge-friendly, pattern-based way.
