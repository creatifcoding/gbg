# getbymonitor Graph Legibility Checklist

Status: design/research checkpoint for the RCA graph and right DIIKW sidebar.

Source ledger artifact: `GRAPH_LEGIBILITY_SOURCES.json`.

## Intent

The graph is not the product. The graph is an intelligence consumption surface. It should help a tired operator answer, quickly:

1. What is happening?
2. Where is the pressure?
3. What is upstream/downstream?
4. What evidence supports this?
5. What should I do next?
6. What would change my mind?

Current failure mode: too much graph variety is rendered at once, without enough visual grammar, ranking, grouping, or progressive disclosure. The result is a hairball.

## References

### Microsoft / enterprise graph precedents

1. **NodeXL — Network Overview, Discovery and Exploration in Excel**  
   Microsoft Research describes NodeXL as an interactive network visualization and analysis tool using Excel for graph data, advanced network analysis, and visual exploration.  
   Use for: overview-first exploration, adjacency/table backup, computed network metrics.  
   URL: https://www.microsoft.com/en-us/research/project/nodexl-network-overview-discovery-and-exploration-in-excel/

2. **Argo Lite — Open-Source Interactive Graph Exploration and Visualization in Browsers**  
   Microsoft Research describes Argo Lite as an in-browser interactive graph exploration tool that enables publishing/sharing graph visualizations and incremental exploration by adding related nodes.  
   Use for: progressive expansion instead of rendering the whole graph at once.  
   URL: https://www.microsoft.com/en-us/research/publication/argo-lite-open-source-interactive-graph-exploration-and-visualization-in-browsers/

3. **Microsoft Research — Visualizing Networks**  
   Includes work such as MultiPiles and Refinery. Refinery explores heterogeneous multivariate graphs through associative browsing and degree-of-interest scoring.  
   Use for: promote/demote nodes, degree-of-interest ranking, bottom-up graph exploration.  
   URL: https://www.microsoft.com/en-us/research/project/visualizing-networks/

4. **Measuring and improving the readability of network visualizations / GraphTrail**  
   Microsoft Research references readability work and GraphTrail, a technique for analyzing networks through node/edge aggregates while preserving exploration history.  
   Use for: breadcrumbs, trail, recall, sharing investigation path.  
   URL: https://www.microsoft.com/en-us/research/video/measuring-and-improving-the-readability-of-network-visualizations/

5. **Microsoft Office Add-ins data visualization guidelines**  
   Microsoft guidance: do not use color as the only information channel; use shape, size, and texture; optimize legends; maximize data ink; avoid decorative noise that competes with data.  
   Use for: graph visual encoding, legend design, chart/data-ink discipline.  
   URL: https://learn.microsoft.com/en-us/office/dev/add-ins/design/data-visualization-guidelines

6. **Fluent 2 accessibility**  
   Fluent 2 emphasizes WCAG AA contrast, keyboard focus, semantic structure, focus management, and accessible interaction design.  
   Use for: graph controls, selected state, tab semantics, high-contrast support, keyboard navigation.  
   URL: https://fluent2.microsoft.design/accessibility

### General network visualization references

7. **Cambridge Intelligence — graph visualization UX / intuitive data experiences**  
   Search result summary emphasized progressive disclosure, detail on demand, zooming, filtering, clustering, smart truncation, and tooltips for unclear labels.  
   URL: https://cambridge-intelligence.com/blog/designing-intuitive-data-experiences-with-graph-visualizations/

8. **Cytoscape.js**  
   Open source graph theory / network visualization library for complex networks and attribute data.  
   Use for: graph rendering, layouts, selection, pan/zoom, styling, network analysis-oriented interaction model.  
   URL: https://js.cytoscape.org/

9. **Cytoscape platform**  
   Describes Cytoscape as an open source software platform for visualizing complex networks and integrating networks with attribute data.  
   URL: https://cytoscape.org/

10. **Focus-plus-context visualization**  
    Useful concept: preserve overview context while showing detail for the focus region.  
    URL: https://infovis-wiki.net/wiki/Focus-plus-Context

### Conceptual lenses

11. **DIKW / DIIKW hierarchy**  
    Data becomes useful only when transformed into information, knowledge, and action/wisdom. For this app, use the expanded ladder: Data → Information → Intelligence → Knowledge → Wisdom/action.  
    URL: https://www.ontotext.com/knowledgehub/fundamentals/dikw-pyramid/

12. **Ashby's Law of Requisite Variety**  
    A controller must have enough variety to regulate the variety of the system it controls. For getbymonitor, the UI must preserve meaningful distinctions across thermal, power, PSI, process, firmware, battery, charger, evidence, hypothesis, and action states — but reveal them progressively.  
    URL: https://www.businessballs.com/strategy-innovation/ashbys-law-of-requisite-variety/

### Motion, polish, and interaction grammar references

13. **Internal craft reference — `skill://make-interfaces-feel-better`**  
    Use for: interruptible state transitions, split/staggered enters, subtle exits, exact-property transitions, 40×40px hit areas, tabular numbers, optical alignment, and press feedback.  
    Relevant rules: animations must be interruptible; enter motion should be split by semantic chunks; exits should be softer than enters; never use `transition: all`; use 40×40px hit targets.

14. **Internal motion reference — `skill://emilkowal-animations`**  
    Use for: easing, duration, transform/opacity-only animation, reduced motion, no keyboard-triggered animation, immediate feedback, tooltip delays, and purpose-driven motion.  
    Relevant rules: UI animation should normally stay under 300ms; animate transform/opacity; every animation must have a purpose; respect `prefers-reduced-motion`; do not animate keyboard-initiated actions.

15. **Internal design methodology — `skill://refero-design`**  
    Use for: reference-locked decisions, avoiding generic design averaging, tracing major choices to sources, and preserving token/component roles.  
    Relevant rule: every major visual/layout/interaction decision needs a source, user constraint, or craft rule.

16. **Cytoscape.js expand/collapse extension**  
    Provides expand/collapse interactions for compound graphs and complexity management.  
    Use for: progressive disclosure, collapsed subsystem clusters, meta edges, and local neighborhood expansion.  
    URL: https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse

17. **Cytoscape.js paper — graph theory library for visualisation and analysis**  
    Describes layouts, compound nodes, gestures, animated graph elements, and animation for salience/visual continuity when graph state changes.  
    Use for: preserving continuity during programmatic graph changes and representing clustered systems with compound nodes.  
    URL: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4708103/

18. **Cytoscape.js layouts guide**  
    Notes that animated layouts can provide smooth transitions between highlighted and unhighlighted states.  
    Use for: constrained, intentional layout transitions rather than full hairball reshuffles.  
    URL: https://blog.js.cytoscape.org/2020/05/11/layouts/

19. **Graph visualization interaction taxonomy / DIVI**  
    Search result summary: visualization interaction techniques can be grouped as Select, Explore, Reconfigure, Encode, Abstract/Elaborate, Filter, and Connect.  
    Use for: making sure interactions have named cognitive jobs instead of decorative motion.  
    URL: https://arxiv.org/pdf/2310.17814

20. **Responsive Matrix Cells / focus+context graph exploration**  
    Search result summary: focus+context can be geometric or semantic; semantic zoom can change layout/encoding in focused regions while preserving context.  
    Use for: semantic zoom, neighborhood focus, cluster-to-node expansion, and local detail without losing global orientation.  
    URL: https://arxiv.org/pdf/2009.03385

21. **Brushing and linking / coordinated views**  
    Search result summary: selection/highlight in one view propagates to related elements in complementary views; graph examples include adjacent-node highlighting.  
    Use for: graph ↔ sidebar ↔ session list coupling.  
    URL: https://arxiv.org/pdf/2602.02023

22. **Interaction techniques for selecting and manipulating subgraphs in network visualizations**  
    Describes rectangle/lasso selection and neighborhood selection by radius.  
    Use for: multi-node selection, subsystem scoping, and radius-based exploration.  
    URL: https://pubmed.ncbi.nlm.nih.gov/19834157/

## Core principle

Represent enough variety. Reveal it progressively.

The system has many state classes:

- thermal zones,
- fan behavior,
- CPU governor,
- package power,
- charger / USB-C / PD behavior,
- battery health and charge rate,
- PSI CPU/memory/IO pressure,
- runaway processes,
- kernel/firmware/ACPI signals,
- user-reported symptoms,
- probes,
- hypotheses,
- planned actions.

The graph must not flatten these into same-size dots with arbitrary colors. But it must also not expose every distinction at once.

## Consumption model

### 1. Overview mode

Purpose: answer “what kind of RCA graph is this?”

Default view should show:

- grouped clusters,
- category counts,
- only important labels,
- strongest causal links,
- current incident / active symptom,
- visible legend.

Checklist:

- [ ] Graph opens in stable fit-to-view layout.
- [ ] No more than 5–9 labels visible by default.
- [ ] Labels are chosen by importance, not arbitrary node order.
- [ ] Weak edges are hidden or muted by default.
- [ ] Edge direction is visible but not dominant.
- [ ] Node type is encoded by shape + color + stroke, not color alone.
- [ ] Critical nodes are larger and more strongly outlined.
- [ ] Unknown/unclassified nodes are visibly unknown, not silent grey.
- [ ] Legend explains every visible encoding.
- [ ] User can immediately distinguish incident, symptom, hazard, hypothesis, probe, evidence, action.

### 2. Focus mode

Purpose: answer “what matters around the thing I clicked?”

When a node is selected:

- selected node becomes anchor,
- 1-hop neighbors stay bright,
- 2-hop neighbors are faint,
- unrelated graph fades,
- right sidebar switches to relevant DIIKW content,
- graph shows full labels for selected neighborhood only.

Checklist:

- [ ] Clicking a node creates obvious selected state.
- [ ] Selected node has halo/ring, not just stroke color.
- [ ] Neighbor edges become brighter/thicker.
- [ ] Non-neighborhood nodes fade to 10–20% opacity.
- [ ] Full label appears for selected node.
- [ ] Neighbor labels appear if they fit.
- [ ] Right sidebar title matches selected node.
- [ ] Sidebar says why this node matters.
- [ ] User can jump upstream/downstream from sidebar.
- [ ] Escape or background click clears focus.

### 3. Expansion mode

Purpose: answer “show me more like this / what supports this / what caused this.”

Borrow from Argo Lite: do not always show all nodes. Let the user expand from a point of interest.

Expansion controls:

- show evidence,
- show upstream causes,
- show downstream symptoms,
- show probes,
- show actions,
- show hidden weak links,
- show same category,
- collapse neighborhood.

Checklist:

- [ ] User can start with a small graph and expand.
- [ ] Expansion adds nodes with animation and stable layout.
- [ ] Newly added nodes are temporarily marked.
- [ ] Collapse restores prior view.
- [ ] Expansion history is visible.
- [ ] User can undo one expansion.
- [ ] The graph never full-reloads/re-layouts for tiny changes.

## Visual encoding checklist

### Node categories

| Category | Shape | Color role | Meaning |
|---|---:|---|---|
| Incident | hexagon | red/pink | User-visible failure state |
| Symptom | circle | orange | Observed complaint / behavior |
| Hazard | triangle | amber | Risk or dangerous condition |
| Hypothesis | rounded rectangle | violet | Candidate explanation |
| Root cause | diamond | red | Confirmed/leading cause |
| Bottleneck | octagon or thick circle | orange/red | Resource constraint |
| Evidence | small square | blue/gray | Measurement/log/probe output |
| Probe | circle-outline | cyan | Test to run |
| Script | rectangle | green | Executable diagnostic |
| Action | flag / chevron | white/green | Next step / intervention |
| Unknown | hollow grey circle | grey | Unclassified, needs mapping |

Checklist:

- [ ] Every node type has a shape.
- [ ] Every node type has a color.
- [ ] Every node type has a legend entry.
- [ ] Unknown types are not hidden.
- [ ] Node size maps to confidence/severity/degree, not random kind.
- [ ] Selected state is independent of type color.
- [ ] Hover state is independent of selected state.
- [ ] Disabled/faded state remains legible.

### Edge categories

| Edge type | Visual treatment | Meaning |
|---|---|---|
| causes / can lead to | solid arrow | causal link |
| supports | dotted or thin solid | evidence supports hypothesis |
| contradicts | dashed red/orange | weakens hypothesis |
| requires probe | dashed cyan | action needed |
| derived from | thin grey | provenance |
| temporal before/after | curved grey | sequence |

Checklist:

- [ ] Edge direction is visible.
- [ ] Edge labels are hidden by default and visible in focus mode.
- [ ] Edge weight/confidence maps to opacity or width.
- [ ] Contradictory evidence has distinct style.
- [ ] Weak evidence can be filtered.
- [ ] No edge crosses the selected node halo if avoidable.
- [ ] Parallel edges are bundled or curved.
- [ ] Long labels never sit directly on dense lines.

## Label strategy checklist

### Default labels

- [ ] Show labels only for high-priority nodes in overview.
- [ ] Priority = selected, incident, root cause, top hypotheses, highest severity, highest degree.
- [ ] Truncate only in overview.
- [ ] Full label is available on hover/focus/selection.
- [ ] Labels have background pills or text halo for contrast.
- [ ] Labels do not overlap selected node.
- [ ] Labels do not overlap each other in focus mode.
- [ ] Label density responds to zoom.

### Semantic zoom

Low zoom:

```text
Thermal
Power
Swap
USB-C
PSI
```

Medium zoom:

```text
Thermal envelope
Weak charge intake
Swap pressure
Runaway browser load
```

High zoom / selected:

```text
High thermals + weak charging under active cooling
```

Checklist:

- [ ] Low zoom shows category labels.
- [ ] Medium zoom shows short finding labels.
- [ ] High zoom shows full labels.
- [ ] Selected node always shows full label.
- [ ] Neighbor nodes show medium labels.
- [ ] Non-neighbor labels disappear in focus mode.

## Layout checklist

### Stable layout

- [ ] Same graph data yields same layout.
- [ ] Refresh preserves node positions.
- [ ] Selecting a node does not re-layout.
- [ ] Opening/closing sidebar does not re-layout.
- [ ] Expanding graph adds local layout only.
- [ ] User can manually pin/drag nodes.
- [ ] Pinned nodes remain pinned across refresh.
- [ ] Reset layout is explicit, never accidental.

### Layout presets

1. **Causal flow**
   - Left → right: evidence/probes → hypotheses → symptoms/actions.
   - Best for RCA.

2. **Cluster map**
   - Communities by category: thermal, power, memory, process, firmware.
   - Best for overview.

3. **Timeline**
   - Time left → right.
   - Best for freezes/charge events.

4. **Evidence stack**
   - Hypothesis centered; evidence arranged around it.
   - Best for confidence review.

Checklist:

- [ ] User can switch layout mode.
- [ ] Layout mode is visible.
- [ ] Current layout has short explanation.
- [ ] Layout switch animates, not teleports.
- [ ] Layout choice persists for session.

## Interaction checklist

### Basic graph controls

- [ ] Pan.
- [ ] Zoom.
- [ ] Fit.
- [ ] Reset view.
- [ ] Refresh graph.
- [ ] Toggle labels.
- [ ] Toggle edge labels.
- [ ] Toggle focus mode.
- [ ] Toggle weak edges.
- [ ] Toggle unknown nodes.
- [ ] Search nodes.
- [ ] Filter by category.
- [ ] Filter by confidence/severity.
- [ ] Pin/unpin node.
- [ ] Expand/collapse neighborhood.

### Selection

- [ ] Click node selects.
- [ ] Click label selects.
- [ ] Click edge selects edge and shows relationship details.
- [ ] Click background clears selection.
- [ ] Keyboard can move selection.
- [ ] Enter/Space activates selection.
- [ ] Selected node is announced/accessibly named.
- [ ] Selected node is visible in sidebar header.
- [ ] Selected node can be copied/bookmarked.

### Details on demand

- [ ] Hover gives tooltip.
- [ ] Selection opens detail panel.
- [ ] Edge selection shows why nodes are linked.
- [ ] Evidence nodes show source/time/value.
- [ ] Probe/action nodes show command and expected result.
- [ ] Hypothesis nodes show supporting/contradicting evidence counts.

## Right-sidebar DIIKW checklist

The sidebar is the graph decoder. It must not dump JSON.

### Data

Raw-ish, but cleaned.

- [ ] IDs.
- [ ] timestamps.
- [ ] source.
- [ ] node kind.
- [ ] raw measurement values as chips.
- [ ] no raw JSON blob unless explicitly expanded.

### Information

Context.

- [ ] What this node represents.
- [ ] Where it sits in the graph.
- [ ] Incoming/outgoing relationship count.
- [ ] Neighbor list.
- [ ] category.
- [ ] severity/confidence.
- [ ] freshness.

### Intelligence

Interpretation.

- [ ] Why this node matters.
- [ ] What hypothesis it supports.
- [ ] What hypothesis it contradicts.
- [ ] Whether it is leading, weak, stale, or unresolved.
- [ ] Confidence explanation.
- [ ] “If true, expect X.”

### Knowledge

Retained model.

- [ ] What has been learned.
- [ ] user answers.
- [ ] prior observations.
- [ ] causal model view.
- [ ] known constraints.
- [ ] what has already been ruled out.

### Wisdom / action

Next move.

- [ ] Best next probe.
- [ ] Best intervention.
- [ ] Risk of action.
- [ ] What to monitor after action.
- [ ] What result would confirm/refute hypothesis.
- [ ] “Do not do this yet” warnings.

## Microsoft / Fluent-inspired UI checklist

### Accessibility and clarity

- [ ] Text contrast meets WCAG AA.
- [ ] Non-text graph marks have at least 3:1 contrast against adjacent marks.
- [ ] Color is never the only encoding.
- [ ] Focus order is predictable.
- [ ] Graph controls are keyboard reachable.
- [ ] Active toggles use `aria-pressed`.
- [ ] Sidebar tabs use tab semantics.
- [ ] High-contrast mode remains usable.
- [ ] Touch/click targets are at least 40px where possible.
- [ ] Dense tiny nodes get invisible hit targets.

### Data-ink discipline

- [ ] Lines are thin by default.
- [ ] Grid/background is quiet.
- [ ] No heavy glow everywhere.
- [ ] Highlight only the current task.
- [ ] Remove decorative noise.
- [ ] Use light grey for structure.
- [ ] Reserve bright colors for meaning.
- [ ] Legend markers match graph shapes.

### Enterprise dashboard feel

- [ ] Top-left graph controls.
- [ ] Bottom-left graph summary.
- [ ] Right sidebar explains selected item.
- [ ] Left rail selects session/run.
- [ ] Main canvas maximizes graph.
- [ ] Search/filter bar appears near graph, not hidden in sidebar.
- [ ] State is explicit: live, stale, loading, filtered, focus mode.

## Hairball reduction checklist

If it looks bad, ask which of these is failing.

### Density

- [ ] Too many nodes visible?
- [ ] Too many edges visible?
- [ ] Too many labels visible?
- [ ] Weak links shown by default?
- [ ] Unknown/low-value nodes crowding critical nodes?

### Grouping

- [ ] Are thermal/power/memory/process categories visually grouped?
- [ ] Are hypotheses separated from evidence?
- [ ] Are actions/probes separated from observations?
- [ ] Is there a dominant cluster or just soup?

### Ranking

- [ ] Are important nodes bigger/brighter?
- [ ] Is confidence/severity visible?
- [ ] Is evidence strength visible?
- [ ] Can the user see the top three things first?

### Navigation

- [ ] Can user zoom/pan smoothly?
- [ ] Can user fit/reset?
- [ ] Can user search?
- [ ] Can user focus a neighborhood?
- [ ] Can user expand progressively?

### Explanation

- [ ] Does selection explain why node exists?
- [ ] Does edge selection explain relationship?
- [ ] Does sidebar say what changed?
- [ ] Does graph tell user what to do next?

## Specific design directions for getbymonitor

### Direction A — RCA causal map

Best for diagnosis.

```text
Evidence / probes → hypotheses → root cause / action → symptom
```

Graph behavior:

- left-to-right causal flow,
- selected hypothesis highlights supporting evidence,
- root-cause candidates ranked,
- edge labels hidden until focus.

Use this if the user wants a debugging cockpit.

### Direction B — System pressure map

Best for machine-health diagnosis.

Clusters:

```text
Thermal
Power / charging
Memory / swap / PSI
Processes
Firmware / kernel
User symptoms
```

Graph behavior:

- each cluster gets a boundary/group label,
- edges show cross-pressure,
- current pressure node pulses,
- sidebar shows DIIKW summary.

Use this if the user wants situational awareness.

### Direction C — Evidence courtroom

Best for hypothesis evaluation.

```text
                Supporting evidence
                       ↑
Contradictions ← Hypothesis → Expected probes
                       ↓
                 Action / risk
```

Graph behavior:

- one hypothesis selected at a time,
- evidence grouped by supports/contradicts/unknown,
- confidence score explained.

Use this if the user wants root-cause confidence.

### Direction D — Exploration trail

Borrowed from GraphTrail / Argo Lite.

```text
Start symptom → expanded node → expanded hypothesis → probe result → next action
```

Graph behavior:

- graph shows exploration path,
- history trail is visible,
- user can backtrack,
- expansion is incremental.

Use this if the user wants guided investigation.

## Recommended sequence

Do not try to make the whole graph beautiful at once.

1. **System pressure map as default overview**
   - thermal / power / PSI / process / firmware clusters;
   - count badges and top pressure nodes;
   - no full labels except top findings.

2. **RCA causal map as selected-node focus**
   - selected node becomes center;
   - upstream/downstream bands;
   - evidence/action nodes arranged around it.

3. **Evidence courtroom inside right sidebar**
   - selected hypothesis gets supports / contradicts / probes / actions;
   - no JSON dumps.

4. **Exploration trail later**
   - track investigation path once the graph becomes an ongoing diagnostic workspace.

## Humanistic microinteraction grammar

This graph needs a grammar of association, not just animation. A microinteraction is successful only if it helps the operator form a correct association:

- this thing belongs with that thing;
- this thing caused, supports, contradicts, or follows that thing;
- this thing changed just now;
- this thing matters more than the surrounding noise;
- this thing is safe to act on, unsafe, stale, unknown, or unresolved.

Motion is not decoration. Motion is evidence choreography.

### What an interaction is intending to convey

| Interaction intention | Human question | Association being created | Primary means | Anti-pattern |
|---|---|---|---|---|
| Attend | “What changed or needs me?” | object → salience | brief pulse, contrast, badge, local glow | global flashing / alarm soup |
| Orient | “Where am I in the system?” | object → subsystem / map position | cluster boundary, breadcrumb, minimap, stable layout | full re-layout on refresh |
| Select | “What am I inspecting?” | pointer/focus → one object | halo, sidebar title, persistent selected state | color-only selection |
| Relate | “What is connected?” | object → neighbors | neighbor highlight, faded non-neighbors, edge emphasis | highlight every edge equally |
| Trace | “How did we get here?” | object → causal/path sequence | animated path reveal, breadcrumb trail, numbered hops | disconnected details panel |
| Compare | “Which is worse / stronger / newer?” | object ↔ object | aligned metrics, tabular numbers, consistent scale | different scales with same color |
| Explain | “Why should I believe this?” | claim → evidence | supports/contradicts groups, confidence chips | raw JSON dump |
| Expand | “What else is nearby?” | focus → hidden neighborhood | local reveal from anchor, semantic zoom | replacing the whole graph |
| Commit | “What should I do?” | evidence → action | action affordance, risk label, expected result | ambiguous CTA |
| Monitor | “Did the action work?” | action → observed response | before/after delta, changed-node pulse | spinner with no retained context |
| Recover | “How do I undo / backtrack?” | current view → prior state | trail, undo, reset view, collapse | one-way exploration |

### Human association primitives

A human will associate graph objects through several overlapping channels. The UI should intentionally choose the channel that matches the relationship.

| Association primitive | What the human infers | UI means | RCA graph use |
|---|---|---|---|
| Proximity | “these belong together” | cluster boundaries, spatial grouping, compound nodes | thermal/power/PSI/process clusters |
| Similarity | “these are the same kind” | shape, icon, stroke, label grammar | all evidence nodes read as evidence, not hypotheses |
| Continuity | “this flows into that” | directed edge, animated path, left-to-right causal flow | evidence → hypothesis → action → symptom |
| Common fate | “these changed together” | synchronized highlight or delta pulse | temp spike + fan max + charge drop |
| Temporal order | “this happened before that” | timeline band, event ticks, ordered breadcrumb | workload spike before thermal rise before freeze |
| Contrast | “this is abnormal” | threshold line, redline chip, outlier size | 93°C against expected idle range |
| Containment | “this is inside that” | compound node / hull / nested group | process load inside workload pressure |
| Agency | “this can be acted on” | button shape, command chip, affordance | probe/action/script nodes |
| Provenance | “this came from a source” | source badge, timestamp, raw-expand affordance | PSI sample vs user report vs journal line |
| Confidence | “how sure are we?” | opacity, meter, confidence chip, evidence counts | leading hypothesis vs weak speculation |
| Reversibility | “I can safely explore” | undo, collapse, trail, non-destructive preview | expand/collapse neighborhoods |

Rule: do not reuse the same visual behavior for different cognitive meanings. If pulse means “fresh data,” it must not also mean “critical alarm.” If violet means “hypothesis,” it must not become “selected.”

### Human reasoning model for this problem space

The operator is not calmly admiring a topology diagram. They are likely stressed, physically experiencing a hot/noisy machine, and trying to decide whether the laptop is sick, misconfigured, overloaded, or physically failing.

Likely reasoning path:

1. **Start from lived symptoms.**
   - “It freezes.”
   - “Fans sound like a jet.”
   - “Charging is terrible.”
   - “Diagnostics feel useless.”

2. **Search for a unifying explanation.**
   - Is this one root cause or multiple correlated failures?
   - Is the machine protecting itself from heat?
   - Is the charger/cable/port weak?
   - Is software load creating fake hardware symptoms?

3. **Separate controllable from non-controllable causes.**
   - Controllable: browser/headless load, CPU governor, thermal profile, swap pressure, runaway dev servers.
   - Semi-controllable: charger/cable/port choice, workload timing, cooling surface.
   - Less controllable: EC/firmware, battery wear, USB-C PD negotiation, hardware thermal path.

4. **Look for temporal coupling.**
   - Did CPU/load rise before fans?
   - Did charge rate recover after heat dropped?
   - Did PSI pressure correlate with UI freezes?
   - Did changing governor/profile change thermals?

5. **Ask what would falsify the story.**
   - If idle/cool but charge remains ~1W, suspect charger/cable/port/EC/battery path.
   - If cool + low load removes freezes, software pressure was dominant.
   - If fans stay max at low temps, suspect firmware/thermal daemon/sensor path.
   - If NVMe/journal/MCE errors appear, hardware suspicion rises.

6. **Want action, but not reckless action.**
   - The UI should say: what to try, why, expected result, risk, and what evidence would change the diagnosis.

Design implication: the graph should begin at the user symptom cluster, then reveal evidence and hypotheses as a guided sensemaking path. Do not make the user start by interpreting node kinds.

### Decision branch awareness and the attention Pareto frontier

The operator is not merely “looking at data.” They are inside several live decision branches. The interface should conserve attention by showing interactions that move those branches forward and suppressing interactions that only decorate the canvas.

#### Current decision branches in this RCA problem

| Branch | Question the human is carrying | Evidence that moves it | Likely action if true | Interaction implication |
|---|---|---|---|---|
| Workload pressure | “Is software load making hardware look broken?” | CPU %, PSI CPU/memory/IO, process list, swap growth, thermal response after killing load | cap/kill offenders, lower governor, close browser/dev servers | process/PSI/load nodes should be near symptoms and show before/after deltas |
| Thermal envelope | “Is the laptop thermally saturated?” | package temp, max core temp, fan RPM, profile/governor, sustained high temp under low load | quiet/balanced profile, clean cooling path, inspect firmware/thermal daemon | thermal nodes need threshold context and calm urgency |
| Weak charging path | “Is the charger/cable/port/EC/battery path failing?” | charge watts under cool idle, USB-C port state, PD/PPS negotiation, battery health, capacity trend | try known-good charger/cable/port, firmware/EC/battery path diagnosis | charge nodes should show controlled-test status, not just raw watts |
| Firmware / EC / policy | “Is platform policy mismanaging fans, thermals, or charging?” | ACPI/thermal policy, fan behavior at low temp, kernel logs, firmware version, thermal daemon status | firmware check, kernel/daemon investigation, vendor/EC escalation | policy nodes should sit between hardware observations and interventions |
| Battery degradation | “Is the battery itself the main issue?” | health %, cycle count, full/design Wh, sudden drops, charge acceptance while cool | battery health monitoring/replacement planning | battery nodes should be de-emphasized if not current leading cause |
| Storage / kernel fault | “Are freezes from deeper I/O/kernel/hardware errors?” | NVMe smart/logs, journal/MCE/I/O errors, hard lock evidence | collect privileged logs, hardware escalation | hidden until evidence appears; then strong salience |
| Tooling reliability | “Can I trust the diagnostics?” | missing tools, timed-out journal reads, unavailable sensors, stale samples | install tools, retry under low load, mark evidence unavailable | unavailable evidence must be explicit, not invisible |

#### Attention Pareto frontier

Attention is the scarce resource. A node or interaction earns screen space only if it is high-value on at least one axis and low-cost enough not to crowd the rest.

Value axes:

- **Uncertainty reduction** — changes which branch is most likely.
- **Risk reduction** — prevents unsafe or destructive action.
- **Actionability** — points to a concrete next probe/intervention.
- **Freshness** — changed recently or after user action.
- **Contradiction** — weakens the current leading story.
- **User salience** — maps to the pain the user actually reported.
- **Coupling** — connects two branches, e.g. heat ↔ charge ↔ workload.
- **Reversibility** — safe to explore/collapse without losing context.

Attention costs:

- visual clutter,
- label competition,
- motion fatigue,
- anxiety amplification,
- false authority,
- distraction from current branch,
- hiding contrary evidence behind excessive simplification.

Rule:

```text
Show / animate / label an object only if it improves branch choice, branch confidence, action safety, or user orientation more than it costs attention.
```

#### Adversarial critique of the attention frontier

This idea is useful but dangerous.

| Risk | Failure mode | Countermeasure |
|---|---|---|
| Over-optimization | The UI hides weak signals because they are low-ranked today. | Keep a “suppressed evidence” affordance with reasons and counts. |
| Paternalism | The UI steers the user into the model’s preferred branch. | Always show alternative active branches and what would change ranking. |
| Evidence laundering | Ranking makes speculative nodes look objective. | Separate confidence, severity, freshness, and actionability; never collapse them into one magic score. |
| Anxiety design | Critical motion increases stress instead of clarity. | Use calm urgency: threshold badge, slow pulse, prose explanation, no strobe. |
| Model lock-in | Once a leading hypothesis exists, contradictory evidence becomes visually quiet. | Contradictions get reserved salience; contradiction beats confidence when fresh. |
| Black-box hiding | Conservation of attention becomes “trust me.” | Every hidden/collapsed object has “why hidden?” and “show anyway.” |
| Expertise mismatch | Novice and expert users need different detail density. | Let user switch density: guided / operator / raw. |
| Animation manipulation | Motion can make a claim feel more true than evidence supports. | Motion communicates state/change, not truth. Truth requires evidence chips and sources. |

#### Branch-aware interaction particulars

- [ ] Hovering a node shows branch membership chips: `thermal`, `charging`, `workload`, `firmware`, `evidence`, `action`.
- [ ] Selecting a node shows “branches this affects” in the sidebar.
- [ ] Evidence nodes display whether they support, contradict, or are neutral for each active branch.
- [ ] Fresh contradictory evidence gets stronger salience than stale supporting evidence.
- [ ] Nodes with low attention value collapse into cluster counts, but remain discoverable.
- [ ] A “why am I seeing this?” affordance explains ranking.
- [ ] A “why is this hidden?” affordance explains suppression.
- [ ] Branch confidence changes are shown as before/after deltas, not just a new score.
- [ ] Actions state the branch they test: “Tests charging-path branch under cool idle.”
- [ ] Probe results attach to the branch they were meant to confirm/refute.
- [ ] Search can search by branch, not only node label.
- [ ] The graph can pin a branch, keeping related evidence visible while other branches fade.

#### Branch model shape

Minimum domain object for implementation:

```text
DecisionBranch {
  id
  label
  question
  status: active | leading | weakened | falsified | resolved | parked
  affectedSubsystems[]
  userSymptoms[]
  evidenceFor[]
  evidenceAgainst[]
  missingEvidence[]
  nextProbe
  expectedIfTrue
  expectedIfFalse
  riskIfIgnored
  confidence
  severity
  freshness
  attentionScore
  hiddenReason?
}
```

Do not ship a single undifferentiated “score.” The UI needs at least confidence, severity, freshness, and actionability as separate concepts.

#### Attention scoring sketch

Use a transparent score only for ordering, never as truth:

```text
attention =
  uncertaintyReduction
  + riskReduction
  + actionability
  + freshness
  + contradictionBonus
  + userSalience
  + couplingValue
  - clutterCost
  - motionCost
  - alreadyKnownPenalty
```

Display the explanation, not the formula:

```text
Shown because: fresh contradictory charge sample; affects charging-path and thermal-envelope branches; next probe available.
```

### Comprehensive implementation goal

Goal: implement every facet of this document as the product target for getbymonitor’s graph experience. The document is now the design contract, not a mood board.

Implementation means:

- [ ] every reference-backed concept is either implemented or explicitly rejected with a reason;
- [ ] every checklist item is mapped to a code task, test, or documented non-goal;
- [ ] the graph lifecycle supports stable identity and local reconciliation before motion work begins;
- [ ] node taxonomy, edge taxonomy, branch model, attention ranking, semantic zoom, microinteraction tokens, DIIKW sidebar, and accessibility are treated as one system;
- [ ] no “pretty graph” pass is accepted unless it improves branch choice, evidence understanding, action safety, or orientation;
- [ ] final verification covers behavior, not just build success.

Suggested implementation phases:

1. **Graph lifecycle foundation**
   - create Cytoscape once;
   - reconcile elements;
   - preserve pan/zoom/selection/positions;
   - support pinned nodes and changed/new node classes.

2. **Semantic data model**
   - canonical node kinds;
   - canonical edge kinds;
   - decision branches;
   - evidence support/contradiction mapping;
   - attention metadata.

3. **Overview and focus modes**
   - system pressure overview;
   - selected-node focus;
   - 1-hop/2-hop neighborhood treatment;
   - semantic labels.

4. **DIIKW sidebar**
   - Data / Information / Intelligence / Knowledge / Wisdom/action tabs;
   - branch membership;
   - evidence for/against;
   - next probe/action.

5. **Microinteraction grammar**
   - motion tokens;
   - branch-aware selection;
   - local expansion;
   - changed evidence pulses;
   - calm critical state;
   - reduced-motion path.

6. **Attention frontier**
   - transparent attention ordering;
   - hidden/suppressed evidence affordances;
   - alternative branch view;
   - contradiction salience.

7. **Accessibility and operator trust**
   - keyboard navigation;
   - focus semantics;
   - non-color encodings;
   - high contrast;
   - “why shown/hidden” explanations.

8. **Verification**
   - unit tests for branch/attention scoring;
   - interaction tests for selection/focus/refresh preservation;
   - browser smoke for graph/sidebar behavior;
   - reduced-motion and keyboard checks;
   - visual regression or screenshot review for hairball reduction.


### Abstract graph grammar

The graph should behave like a thinking partner with a spatial memory.

| Grammar concept | Meaning | UI behavior |
|---|---|---|
| Object permanence | “the thing I saw is still the same thing” | preserve node identity, position, selection, and labels across refresh |
| Causal humility | “this might be true, but why?” | hypothesis nodes require supports/contradicts/probes, never naked confidence |
| Locality of surprise | “only the changed area moved” | changed/new nodes animate locally; stable nodes stay still |
| Friction before danger | “dangerous actions require cognition” | action nodes show risk/expected outcome before execution |
| Calm urgency | “this matters, but don’t panic” | critical nodes pulse slowly or badge strongly; no jitter/strobe |
| Reversible curiosity | “I can explore without losing place” | expand/collapse, breadcrumbs, undo, persistent focus |
| Progressive truth | “raw data exists, but interpretation comes first” | sidebar opens on interpretation; raw payload is expandable |
| Evidential gravity | “strong evidence pulls attention” | evidence count/quality affects node weight and label priority |
| Narrative continuity | “I can retell what happened” | exploration trail and ordered causal path survive view changes |

### Motion tokens

Use these as defaults unless testing shows they feel wrong.

| Token | Value | Use |
|---|---:|---|
| `motion.instant` | 60–90ms | press acknowledgement, small hover off |
| `motion.fast` | 120–160ms | hover on, label fade, chip reveal |
| `motion.base` | 180–220ms | selection, neighbor highlight, sidebar section change |
| `motion.slow` | 260–300ms | local layout adjustment, expansion settle |
| `motion.panel` | 320–500ms | drawer-like sidebar movement only; avoid for frequent graph actions |
| `ease.out` | `cubic-bezier(0.2, 0, 0, 1)` | default UI state changes |
| `ease.spatial` | `cubic-bezier(0.32, 0.72, 0, 1)` | panel/drawer movement, large spatial shifts |
| `ease.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | on-screen reposition where both start/end are visible |
| `scale.press` | `0.96` | buttons and command chips |
| `scale.nodeEnter` | `0.95 → 1` | new node entry; never from scale 0 |
| `fade.context` | `0.10–0.20` | non-neighborhood graph in focus mode |
| `stagger.node` | `16–28ms`, capped at `160ms` total | small batches of newly revealed nodes |
| `pulse.critical` | `1200–1800ms` loop, opacity/stroke only | sustained critical condition; stop when no longer critical |

Performance rules:

- [ ] Animate only transform, opacity, filter, stroke opacity/width where the renderer supports it cheaply.
- [ ] Do not animate layout properties in React DOM.
- [ ] Do not use `transition: all`.
- [ ] Do not run looping motion except for sustained critical/live states.
- [ ] Respect `prefers-reduced-motion`: keep opacity/status changes, remove travel/scale/path drawing.
- [ ] Do not animate keyboard-initiated focus movement; move focus immediately and update highlight calmly.

### Graph state transition grammar

#### Idle → hover

Intent: “this object can be inspected.”

- [ ] Node brightens within `motion.fast`.
- [ ] Cursor/hit target confirms interactivity.
- [ ] Immediate 1-hop edge hint may appear if graph is sparse.
- [ ] Tooltip waits before first appearance; subsequent nearby tooltips are faster.
- [ ] No layout change.

#### Hover → idle

Intent: “attention released.”

- [ ] Highlight fades faster than it entered.
- [ ] Tooltip exits with opacity only.
- [ ] Selection state, if any, is untouched.

#### Idle/hover → selected

Intent: “this is now the object of thought.”

- [ ] Selected node gets persistent halo/ring.
- [ ] Selected label expands to full readable label.
- [ ] Sidebar title changes to the selected object.
- [ ] 1-hop neighbors brighten; unrelated nodes stay visible but quieter.
- [ ] No graph re-layout.

#### Selected → focus mode

Intent: “show the diagnostic neighborhood.”

- [ ] Non-neighborhood graph fades to `fade.context`.
- [ ] Neighbor edges become stronger and directional.
- [ ] Neighbor labels use medium-length semantic labels.
- [ ] Sidebar shows supports/contradicts/probes/actions.
- [ ] Focus mode badge appears in graph chrome.

#### Selected → expand evidence

Intent: “reveal why this claim exists.”

- [ ] Evidence nodes appear from near the selected node or cluster boundary.
- [ ] New nodes enter with opacity + `scale.nodeEnter`; no scale-from-zero.
- [ ] Existing nodes mostly stay fixed.
- [ ] New evidence is grouped by supports / contradicts / unknown.
- [ ] A short microcopy line says what was added, e.g. “Added 4 supporting samples.”

#### Selected → trace path

Intent: “show causal reasoning.”

- [ ] Path edges reveal in sequence from source to target.
- [ ] Each hop gets a temporary numbered marker.
- [ ] Non-path graph dims but does not disappear.
- [ ] Sidebar explains the path in prose: “Load pressure raised heat; heat constrained charge; charge stayed weak.”

#### Refresh with same graph

Intent: “data updated; your mental map is safe.”

- [ ] Preserve viewport, selected node, pinned nodes, and layout positions.
- [ ] Changed nodes pulse once.
- [ ] New values animate numerically only if they are visible.
- [ ] Graph chrome says “updated now” or shows timestamp.
- [ ] No spinner over the graph.

#### Refresh with new nodes

Intent: “new evidence arrived.”

- [ ] Old nodes keep position.
- [ ] New nodes appear close to parent/source cluster.
- [ ] Local layout settles only the affected neighborhood.
- [ ] The session list/sidebar also marks the same new evidence via brushing/linking.

#### Collapse cluster

Intent: “reduce complexity without losing truth.”

- [ ] Child nodes fold into a compound/meta node.
- [ ] Meta node badge shows child count and strongest status.
- [ ] Meta edges preserve strongest external relationships.
- [ ] Expanding restores prior child positions when possible.

#### Drag/pin node

Intent: “the user is shaping their memory palace.”

- [ ] Dragged node feels immediate, no lagging spring.
- [ ] On drop, node becomes pinned unless user cancels.
- [ ] Pin marker appears.
- [ ] Refresh respects pinned position.

#### Error / unavailable evidence

Intent: “the system failed honestly.”

- [ ] Keep the last good graph visible.
- [ ] Mark stale/unavailable sources in chrome and sidebar.
- [ ] Do not shake the whole graph.
- [ ] Error node/link can explain missing source and next recovery step.

### Brushing and linking grammar

The graph should not act alone. It should coordinate with the session list and right sidebar.

- [ ] Selecting a session highlights its graph root and clears unrelated selection.
- [ ] Selecting a graph node updates the right sidebar and, if relevant, highlights the originating session/event row.
- [ ] Hovering an evidence row highlights the corresponding evidence node.
- [ ] Filtering by subsystem in sidebar dims non-matching graph clusters.
- [ ] Search results highlight nodes and list matching detail rows.
- [ ] Changed nodes after refresh are also summarized as a sidebar “what changed” strip.

### Semantic zoom grammar

Zoom should change meaning density, not merely pixel size.

| Zoom band | Graph should show | Human read |
|---|---|---|
| Far | subsystem clusters, incident/root/hazard labels, counts | “what regions exist?” |
| Medium | top findings, leading hypotheses, strongest causal links | “what matters?” |
| Near | full selected-neighborhood labels, edge labels, evidence chips | “why does this matter?” |
| Inspect | raw values, timestamps, source snippets in sidebar | “can I verify it?” |

Checklist:

- [ ] Far zoom hides raw evidence nodes or collapses them into cluster counts.
- [ ] Medium zoom shows leading hypothesis labels.
- [ ] Near zoom reveals edge labels only around selection.
- [ ] Inspect happens in sidebar, not by spraying text across the canvas.

### Emotional pacing

The interface should feel humane under stress.

- [ ] Use calm but explicit language: “charge weak under heat/load” beats “CRITICAL FAILURE.”
- [ ] Avoid alarm red unless risk is immediate or threshold-backed.
- [ ] Let the user pause: exploration state is persistent, not constantly wiped by live updates.
- [ ] Show what is known, unknown, and next — not just what is bad.
- [ ] Prefer “evidence changed” over “screen changed.”
- [ ] Make safe actions feel available and risky actions feel deliberate.

### Implementation blocker: current Cytoscape lifecycle

Current code in `packages/monitor/frontend/src/components/GraphCanvas.tsx` recreates and destroys the Cytoscape instance whenever `elements` changes:

```text
useEffect(... create cytoscape({ elements }) ... runLayout(cy) ... stop + destroy cleanup, [elements, graph, setSelectedNodeId])
```

Observed source: `GraphCanvas.tsx` around the Cytoscape mount effect.

That lifecycle makes several parts of this grammar impossible:

- stable layout across refresh,
- pinned nodes,
- object permanence,
- local new-node entry,
- changed-node pulses,
- expansion/collapse continuity,
- preserving selection and viewport during refresh.

Before implementing this grammar, split the graph lifecycle:

1. **Create Cytoscape once on mount.**
   - Dependency should be container/lifecycle only.
   - Register event handlers once.

2. **Reconcile elements separately.**
   - Use `cy.json({ elements })`, or explicit add/remove/update operations.
   - Diff previous and next graph IDs.
   - Mark added/changed/removed elements.

3. **Preserve spatial memory.**
   - Keep existing node positions.
   - Apply positions from saved layout/pins where available.
   - Run targeted layout only for new/affected nodes.

4. **Animate meaning, not reinitialization.**
   - New nodes enter.
   - Changed nodes pulse.
   - Removed nodes fade/collapse.
   - Stable nodes do not move.

5. **Persist interaction state.**
   - selected node,
   - focus mode,
   - viewport/pan/zoom,
   - pinned nodes,
   - collapsed clusters.

If this lifecycle is not fixed first, the microinteraction grammar will become ornamental copy rather than implementable behavior.

### Microinteraction acceptance checklist

- [ ] Every animation has a named cognitive job: attend, orient, select, relate, trace, compare, explain, expand, commit, monitor, or recover.
- [ ] Every animated object preserves identity across refresh.
- [ ] The graph never loses selected state during normal data refresh.
- [ ] New evidence appears locally, not through global graph reset.
- [ ] Color, motion, shape, and text do not encode conflicting meanings.
- [ ] Reduced-motion mode still communicates state changes.
- [ ] Keyboard use is immediate and not motion-dependent.
- [ ] Critical states are calm, threshold-backed, and non-strobing.
- [ ] The user can retell the diagnosis from the interaction trail.

## Implementation gate checklist

Before coding the next graph pass, answer these in order:

1. **Default consumption mode**
   - [ ] Is this primarily a system pressure map, RCA causal map, or evidence courtroom?

2. **Node taxonomy**
   - [ ] What are the canonical node categories?
   - [ ] Which backend kinds map into each?

3. **Edge taxonomy**
   - [ ] What edge types exist?
   - [ ] Which ones are visible by default?

4. **Importance scoring**
   - [ ] What decides label visibility?
   - [ ] severity?
   - [ ] confidence?
   - [ ] node degree?
   - [ ] freshness?
   - [ ] selected neighborhood?

5. **Default filters**
   - [ ] Hide weak edges?
   - [ ] Hide raw evidence?
   - [ ] Collapse probes?
   - [ ] Group unknowns?

6. **Sidebar contract**
   - [ ] What must the sidebar explain for node selection?
   - [ ] What must it explain for edge selection?

7. **Ashby check**
   - [ ] Did we preserve enough diagnostic variety?
   - [ ] Did we hide it progressively instead of flattening or flooding?

8. **Fluent/Microsoft check**
   - [ ] Does it work without color?
   - [ ] Is focus visible?
   - [ ] Are labels readable?
   - [ ] Is there a legend?
   - [ ] Can it be keyboard navigated?

## Short version

Move from:

```text
all nodes + all edges + all meanings at once
```

to:

```text
overview → focus → expand → explain → act
```

Use Microsoft Research patterns:

- NodeXL for overview/exploration,
- Argo Lite for incremental expansion,
- Refinery for degree-of-interest ranking,
- GraphTrail for exploration history.

Use Fluent-style visualization rules:

- not color-only,
- strong contrast,
- clear legend,
- minimal visual noise,
- keyboard-reachable controls.
