import type { BreakdownRequest } from './schema.ts'

const line = '─'.repeat(88)

export function compactStateDiagramTemplate(input: BreakdownRequest): string {
  return [
    `# (1) COMPACT ASCII STATE DIAGRAM TEMPLATE — ${input.componentName}`,
    line,
    '[Idle] --(focus|hover|entry)--> [Active]',
    '[Active] --(open|expand)-------> [Expanded]',
    '[Expanded] --(submit|commit)--> [Committed]',
    '[Expanded] --(escape|cancel)--> [Active]',
    '[Active] --(blur|leave)-------> [Idle]',
    '[any] --(error|timeout|panic)--> [Error] --(recover)--> [Idle]',
    '',
    'Legend:',
    '- [State] = durable UI mode',
    '- (event) = trigger',
    '- Use this when discussing behavior in standup / PR review',
  ].join('\n')
}

export function expandedStateDiagramTemplate(input: BreakdownRequest): string {
  return [
    `# (1) EXPANDED ASCII STATE DIAGRAM TEMPLATE — ${input.componentName}`,
    line,
    '┌────────────────────────────────────────────────────────────────────────────────────┐',
    '│ BOOTSTRAP                                                                         │',
    '│  [Uninitialized] --(mount)--> [Idle]                                              │',
    '└────────────────────────────────────────────────────────────────────────────────────┘',
    '                 │',
    '                 ▼',
    '┌────────────────────────────────────────────────────────────────────────────────────┐',
    '│ INTERACTION LOOP                                                                  │',
    '│  [Idle] --(focus/hover/pointerenter)--> [Active]                                  │',
    '│  [Active] --(drag-start)--------------> [Dragging]                                │',
    '│  [Dragging] --(drag-end)---------------> [Active]                                 │',
    '│  [Active] --(open/details)-------------> [Expanded]                               │',
    '│  [Expanded] --(submit)-----------------> [Committed]                              │',
    '│  [Expanded] --(cancel/escape)----------> [Active]                                 │',
    '│  [Committed] --(ack/reset)-------------> [Idle]                                   │',
    '└────────────────────────────────────────────────────────────────────────────────────┘',
    '                 │',
    '                 ▼',
    '┌────────────────────────────────────────────────────────────────────────────────────┐',
    '│ FAULT & RECOVERY                                                                  │',
    '│  [any] --(network/validation/runtime-fault)--> [Error]                            │',
    '│  [Error] --(retry|recover)---------------------> [Idle]                           │',
    '│  [Error] --(fatal)-----------------------------> [Disabled]                        │',
    '└────────────────────────────────────────────────────────────────────────────────────┘',
    '',
    'Annotations (fill in):',
    '- Guard conditions:',
    '- Side effects per transition:',
    '- Telemetry spans per transition:',
  ].join('\n')
}

export function petNameLexiconTemplate(input: BreakdownRequest): string {
  return [
    `# (2) INDEXED PET-NAME LEXICON TEMPLATE — ${input.componentName}`,
    line,
    '| # | Pet Name | Canonical Token | Category | Owner | Intent | Notes |',
    '|---|----------|-----------------|----------|-------|--------|-------|',
    '| 01 | Anchor | state.idle | state | ui-core | safe baseline | |',
    '| 02 | Pulse | state.active | state | ui-core | user engaged | |',
    '| 03 | Bloom | state.expanded | state | ui-core | detail reveal | |',
    '| 04 | Glide | event.pointer.move | event | input | hover/drag motion | |',
    '| 05 | Lock | guard.interaction.blocked | guard | policy | suppress unsafe action | |',
    '| 06 | Drift | state.error.recoverable | fault | runtime | degraded but alive | |',
    '',
    'Rules:',
    '- Index is immutable once published in docs.',
    '- Pet Name is human shorthand; Canonical Token is code/API truth.',
    '- If two pet names map to one token, collapse and deprecate the weaker alias.',
  ].join('\n')
}

export function interactionPrecedenceMatrixTemplate(input: BreakdownRequest): string {
  const modes = input.interactionModes.join(', ')

  return [
    `# (3) INTERACTION PRECEDENCE MATRIX TEMPLATE — ${input.componentName}`,
    line,
    `Interaction modes in scope: ${modes}`,
    '',
    '| Priority (1=highest) | Interaction Source | Condition | Winning Handler | Loses To | Resulting State | Span Name |',
    '|---|---|---|---|---|---|---|',
    '| 1 | keyboard.escape | modal open | dismissModal() | none | Active | ui.dismiss.modal |',
    '| 2 | pointer.down | dragEnabled && notLocked | beginDrag() | keyboard.escape | Dragging | ui.drag.begin |',
    '| 3 | touch.tap | touchEnabled && !dragging | activateCell() | priority 1-2 | Active | ui.touch.tap |',
    '| 4 | keyboard.enter | focused && valid | commitSelection() | priority 1-3 | Committed | ui.commit.selection |',
    '| 5 | programmatic.setState | maintenance mode | setIdle() | priority 1-4 | Idle | ui.state.sync |',
    '',
    'Conflict protocol:',
    '1) Sort by priority.',
    '2) Re-evaluate guard condition at event time.',
    '3) Emit losing handlers to debug trace (do not silently drop).',
  ].join('\n')
}

export function perPhaseSmokeTestTemplate(input: BreakdownRequest): string {
  const phases = input.phaseLabels

  return [
    `# (4) PER-PHASE SMOKE-TEST TEMPLATE — ${input.componentName}`,
    line,
    '| Phase | Goal | 60-second Smoke Check | Expected | Fallback if Fails |',
    '|---|---|---|---|---|',
    `| ${phases[0]} | Prove assumptions | Can we enumerate states + transitions in < 10 lines? | Single coherent flow exists | Trim scope; remove speculative states |`,
    `| ${phases[1]} | Freeze structure | Does precedence matrix resolve every conflict row? | No ambiguous winner | Add explicit guard + priority |`,
    `| ${phases[2]} | Verify wiring | Does tool output include all 4 templates without missing sections? | Deterministic, complete payload | Fail fast + return schema violation |`,
    `| ${phases[3]} | Validate adaptation | Can we revise one row and regenerate cleanly? | Diff is local and intentional | Re-run from prior stable request |`,
    '',
    'Execution notes:',
    '- Run smoke checks before visual polish.',
    '- Keep checks deterministic and scriptable.',
  ].join('\n')
}
