# Kraken Handoff: RVN Forms Migration to Base UI

## Task
Migrate existing RVN form components (`RvnSelect`, `RvnRadio`, `RvnSwitch`, `RvnSlider`) in `src/lib/rvn/forms/` to use Base UI (`@base-ui-components/react`) as the foundation while preserving brutalist styling.

## Checkpoints
<!-- Resumable state for kraken agent -->
**Task:** RVN Form Components Migration to Base UI
**Started:** 2026-01-31T12:00:00Z
**Last Updated:** 2026-01-31T12:05:00Z

### Phase Status
- Phase 1 (Tests Written): VALIDATED (4 test files created)
- Phase 2 (Implementation): VALIDATED (all 66 tests passing)
- Phase 3 (Refactoring): VALIDATED (code clean, follows existing patterns)
- Phase 4 (Documentation): VALIDATED (updated exports)

### Validation State
```json
{
  "test_count": 66,
  "test_files": [
    "src/lib/rvn/forms/__tests__/RvnSelect.test.tsx",
    "src/lib/rvn/forms/__tests__/RvnRadio.test.tsx",
    "src/lib/rvn/forms/__tests__/RvnSwitch.test.tsx",
    "src/lib/rvn/forms/__tests__/RvnSlider.test.tsx"
  ],
  "tests_passing": 66,
  "tests_failing": 0,
  "last_test_command": "bun run test:run -- src/lib/rvn/forms/__tests__/*.test.tsx",
  "last_test_exit_code": 0
}
```

### Resume Context
- Current focus: Task complete
- Next action: None - migration finished
- Blockers: None

## Components Migrated

| Component | Old API | New API (Base UI) | Status |
|-----------|---------|-------------------|--------|
| RvnSelect | native select, onChange | Select.Root/Trigger/Portal, onValueChange | COMPLETE |
| RvnRadio | native radio, options array | RadioGroup + Radio.Root, children pattern | COMPLETE |
| RvnSwitch | native checkbox, onChange(bool) | Switch.Root/Thumb, onCheckedChange | COMPLETE |
| RvnSlider | native range, onChange | Slider.Root/Control/Track/Thumb, onValueChange | COMPLETE |

## Styling Requirements

All components must follow RVN brutalist design:
- 3px solid black borders
- No border-radius (0px)
- Monospace font for labels (12px minimum - THE FLOOR)
- Black/white high contrast
- 4px 4px box-shadow (default)
- Focus: 2px offset outline
