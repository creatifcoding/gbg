# F324 — LogFilterBar Compound Contract + Slot Composition Map

## Scope

Decompose `LogFilterBar` into context-backed compound slots while preserving current behavior and class contracts.

## Root Contract

- Component: `LogFilterBar`
- Props:
  - `compact?: boolean`
  - `atoms?: AgentTaskLogAtomSurfaceAtoms`
  - `children?: ReactNode` (optional slot override)
- Responsibilities:
  - Owns filter atom read/write
  - Owns dork commit semantics (comma commit + Enter/blur)
  - Provides context for slot compounds
  - Preserves default layout when `children` is omitted

## Slot Map

- `LogFilterBar.Severity`
  - Contains severity button rail
  - Default render emits 5 level buttons (DEBUG→FATAL)
- `LogFilterBar.SeverityButton`
  - Single button contract for custom severity compositions
- `LogFilterBar.Query`
  - Query stack container
- `LogFilterBar.SearchInput`
  - Search/dork input
  - Keyboard contract: Enter commits dorks
  - Blur contract: commits dorks
- `LogFilterBar.DorkChips`
  - Active dork chip renderer
- `LogFilterBar.SourceInput`
  - Narrow source filter input
- `LogFilterBar.RegexInput`
  - Narrow regex filter input
- `LogFilterBar.ClearButton`
  - Visible only when filters are active

## Data-slot Contract

- `data-slot="log-filter-root"`
- `data-slot="log-filter-severity"`
- `data-slot="log-filter-severity-button"`
- `data-slot="log-filter-query"`
- `data-slot="log-filter-search-input"`
- `data-slot="log-filter-dork-chips"`
- `data-slot="log-filter-source-input"`
- `data-slot="log-filter-regex-input"`
- `data-slot="log-filter-clear"`

## Accessibility / Keyboard Contract

- Severity buttons expose `aria-pressed`
- Search input supports Enter commit and blur commit
- Dork chips support keyboard delete via Backspace/Delete (existing behavior retained)
- Clear button remains focusable and discoverable via title/label

## Compatibility

- Keep existing CSS class names (`at-log-filter-bar__*`)
- Keep default compact behavior and source/regex visibility rules
- Keep parse/merge semantics unchanged
