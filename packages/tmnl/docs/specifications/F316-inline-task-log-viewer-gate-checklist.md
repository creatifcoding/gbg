# F316 Gate Checklist — InlineTask Log Viewer Rebuild

Scope: **#F316** with subfeatures **#F317–#F321**  
Purpose: strict acceptance gate with explicit pass/fail checkboxes and required evidence blobs per criterion.

---

## Gate Protocol

For every criterion row:
1. Check **exactly one** outcome: Pass or Fail.
2. Attach all required evidence blobs.
3. If failed, include remediation note + follow-up task id.

> Evidence naming convention: `F<feature>-<criterion>-<artifact>.<ext>`

---

## #F317 — Tail-Follow Semantics

| ID | Criterion | Pass | Fail | Required evidence blobs | Citations |
|---|---|---|---|---|---|
| F317-A1 | Auto-follow only when user is at/near bottom (thresholded, e.g. <=24px). | - [ ] | - [ ] | `F317-A1-near-bottom-threshold-test.md`, `F317-A1-tail-follow-demo.mp4` | Grafana Logs Explore semantics ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); paused-on-scroll UX expectation ([exa](https://github.com/grafana/grafana/issues/29505)) |
| F317-A2 | Manual upward scroll pauses tailing; incoming entries do not yank viewport. | - [ ] | - [ ] | `F317-A2-scroll-pause-demo.mp4`, `F317-A2-state-transitions.ndjson` | Pause-on-scroll behavior ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); explicit user request pattern in log viewers ([exa](https://github.com/orbstack/orbstack/issues/914)) |
| F317-A3 | Resume/Jump-to-latest re-enters tail mode and lands at newest entry. | - [ ] | - [ ] | `F317-A3-resume-jump-demo.mp4`, `F317-A3-tail-mode-assertions.md` | Resume model ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); stream-live/stop model ([exa](https://www.elastic.co/guide/en/observability/7.17/tail-logs.html)) |
| F317-A4 | LIVE vs PAUSED state is unambiguous in UI (no “looks broken” ambiguity). | - [ ] | - [ ] | `F317-A4-ui-states.png`, `F317-A4-copy-review.md` | UX ambiguity risk documented by Grafana team ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); UX issue reference ([exa](https://github.com/grafana/grafana/issues/29505)) |

---

## #F318 — Smooth Append Scrolling UX

| ID | Criterion | Pass | Fail | Required evidence blobs | Citations |
|---|---|---|---|---|---|
| F318-B1 | Append scroll updates are repaint-synced (RAF-coalesced), not per-line layout thrash. | - [ ] | - [ ] | `F318-B1-raf-implementation.diff`, `F318-B1-profiler-trace.json` | RAF model ([web_search](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)); animation/frame-rate guidance ([exa](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)) |
| F318-B2 | Jump/resume uses smooth scrolling where motion is allowed. | - [ ] | - [ ] | `F318-B2-jump-smooth-demo.mp4`, `F318-B2-scroll-behavior-assertions.md` | `Window.scroll({behavior:'smooth'})` ([web_search](https://developer.mozilla.org/en-US/docs/Web/API/Window/scroll)); CSS/JS animation performance tradeoffs ([exa](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)) |
| F318-B3 | Reduced-motion mode disables smooth animation and uses instant positioning. | - [ ] | - [ ] | `F318-B3-reduced-motion-demo.mp4`, `F318-B3-accessibility-checklist.md` | Motion/perf guidance baseline ([web_search](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)); user responsiveness/jank considerations ([exa](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)) |
| F318-B4 | Sustained streaming shows no visible jank under target rate (document target explicitly). | - [ ] | - [ ] | `F318-B4-load-profile.md`, `F318-B4-long-frame-report.json` | Smoothness responsiveness baseline ([web_search](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)); long animation frame diagnostics ([exa](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing)) |

---

## #F319 — Query Dork/Filter DSL (Logs)

| ID | Criterion | Pass | Fail | Required evidence blobs | Citations |
|---|---|---|---|---|---|
| F319-C1 | DSL supports field ops, exclusion, phrase, regex, case, limit, sort in one query path. | - [ ] | - [ ] | `F319-C1-parser-executor-tests.txt`, `F319-C1-query-fixtures.json` | LogQL operators/reference ([web_search](https://grafana.com/docs/loki/latest/query/query_reference/)); KQL field/phrase/wildcard model ([exa](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)) |
| F319-C2 | Invalid regex is handled safely (no crash; deterministic error/no-op policy). | - [ ] | - [ ] | `F319-C2-invalid-regex-tests.txt`, `F319-C2-error-policy.md` | Regex semantics in log query systems ([web_search](https://grafana.com/docs/loki/latest/query/log_queries/)); SPL/KQL regex handling context ([exa](https://docs.splunk.com/Documentation/Splunk/9.4.2/SearchReference/UnderstandingSPLsyntax)) |
| F319-C3 | Operator-only queries (no free text) still return valid filtered result sets. | - [ ] | - [ ] | `F319-C3-operator-only-tests.txt`, `F319-C3-result-snapshots.json` | KQL structured filters without free text ([web_search](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)); LogQL operator-first patterns ([exa](https://grafana.com/docs/loki/latest/query/query_reference/)) |
| F319-C4 | Query output ordering/limits are deterministic and test-asserted. | - [ ] | - [ ] | `F319-C4-ordering-limit-tests.txt`, `F319-C4-determinism-proof.md` | KQL terms/range/wildcard semantics ([web_search](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)); LogQL filter/ordering discipline ([exa](https://grafana.com/docs/loki/latest/query/query_reference/)) |

---

## #F320 — Structured Per-Row Log UI (Compound)

| ID | Criterion | Pass | Fail | Required evidence blobs | Citations |
|---|---|---|---|---|---|
| F320-D1 | Row baseline includes ts/level/source/message; expandable detail renders typed payload/metadata/trace fields. | - [ ] | - [ ] | `F320-D1-row-detail-demo.mp4`, `F320-D1-component-contract.md` | Explore line-level + details expectation ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); Logs Stream tail + inspect model ([exa](https://www.elastic.co/guide/en/observability/7.17/tail-logs.html)) |
| F320-D2 | Detail compound exposes copy actions for trace/span/tool/payload data with feedback states. | - [ ] | - [ ] | `F320-D2-copy-actions-demo.mp4`, `F320-D2-a11y-aria-audit.md` | Log details workflow context ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); operational log inspection expectations ([exa](https://docs.aws.amazon.com/grafana/latest/userguide/v10-explore-logs.html)) |
| F320-D3 | High-volume readability constraints hold (document render strategy for 2k+ entries). | - [ ] | - [ ] | `F320-D3-high-volume-benchmark.md`, `F320-D3-render-strategy.md` | Grafana log volume constraints context ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); Logs direction/control evolution in Explore ([exa](https://grafana.com/whats-new/2025-04-09-new-controls-for-logs-in-explore/)) |

---

## #F321 — Integration, Reliability, and Accessibility

| ID | Criterion | Pass | Fail | Required evidence blobs | Citations |
|---|---|---|---|---|---|
| F321-E1 | Faker/mock stream is continuous (does not terminate after template exhaustion unless explicitly stopped). | - [ ] | - [ ] | `F321-E1-continuous-stream-run.log`, `F321-E1-5min-demo.mp4` | Live tail concept baseline ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); stream-live/stop controls ([exa](https://www.elastic.co/guide/en/observability/7.17/tail-logs.html)) |
| F321-E2 | Transport parity: mock and NATS paths produce equivalent AssembledLogEntry shape at view boundary. | - [ ] | - [ ] | `F321-E2-transport-parity-tests.txt`, `F321-E2-shape-comparison.json` | Log stream query/render pipeline context ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); KQL/structured field filtering assumptions ([exa](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)) |
| F321-E3 | Keyboard + reduced-motion accessibility pass for all tail/search/detail controls. | - [ ] | - [ ] | `F321-E3-keyboard-walkthrough.mp4`, `F321-E3-reduced-motion-checklist.md` | Interaction smoothness & user responsiveness ([web_search](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)); animation/jank accessibility implications ([exa](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Animation_performance_and_frame_rate)) |
| F321-E4 | Non-regression suite passes for task-switch, remount, and stream restart semantics. | - [ ] | - [ ] | `F321-E4-ci-report-url.txt`, `F321-E4-regression-matrix.md` | Pause/resume/stream lifecycle model ([web_search](https://grafana.com/docs/grafana/latest/visualizations/explore/logs-integration/)); operational tail lifecycle (stream/stop) ([exa](https://www.elastic.co/guide/en/observability/7.17/tail-logs.html)) |

---

## Decision Block

- Gate outcome for **#F316**:  
  - [ ] PASS — all criteria rows passed with complete evidence blobs  
  - [ ] FAIL — one or more criteria failed or missing evidence

- Sign-off:
  - Engineering: `____________________` Date: `__________`
  - QA/Validation: `____________________` Date: `__________`
  - Architecture (Prime/Delegate): `____________________` Date: `__________`
