# RVN Layout Migration to Base UI

## Task
Migrate RVN layout components (Modal, Drawer) to wrap Base UI components while maintaining brutalist styling.

## Checkpoints
<!-- Resumable state for kraken agent -->
**Task:** Migrate RVN layout components to Base UI patterns
**Started:** 2026-01-31T12:00:00Z
**Last Updated:** 2026-01-31T12:40:00Z

### Phase Status
- Phase 1 (Tests Written): VALIDATED (30 tests passing)
- Phase 2 (Implementation): VALIDATED (all tests green)
- Phase 3 (Integration): VALIDATED (exports updated, TypeScript compiles)
- Phase 4 (Documentation): PENDING

### Validation State
```json
{
  "test_count": 30,
  "tests_passing": 30,
  "files_modified": [
    "src/lib/rvn/layout/RvnModal.tsx",
    "src/lib/rvn/layout/RvnDrawer.tsx",
    "src/lib/rvn/layout/index.ts",
    "src/lib/rvn/layout/__tests__/RvnModal.test.tsx",
    "src/lib/rvn/layout/__tests__/RvnDrawer.test.tsx"
  ],
  "last_test_command": "bun run test src/lib/rvn/layout/__tests__/",
  "last_test_exit_code": 0
}
```

### Resume Context
- Current focus: Implementation complete
- Next action: Create output report
- Blockers: None

## Components Migrated

### RvnModal
- Now wraps `@base-ui-components/react/dialog`
- Compound pattern: Root, Trigger, Portal, Backdrop, Content, Header, Title, Description, Close, Body, Footer
- 3px black border, no border-radius
- Dark backdrop (rgba(0, 0, 0, 0.8))
- Accessibility: aria-labelledby links to title

### RvnDrawer
- Now wraps `@base-ui-components/react/dialog` with drawer positioning
- Compound pattern: Root, Trigger, Portal, Backdrop, Content, Header, Title, Description, Close, Body, Footer
- Position variants: left, right, top, bottom
- 3px border on visible edge only
- Black header background
- Customizable width/height

### Kept as Styled Divs (No Migration Needed)
- RvnPanel - Already pure compound component
- RvnCard - Already simple styled component

### Already in baseui/layout (No Changes)
- RvnCollapsible - Uses Base UI Collapsible
- RvnScrollArea - Uses Base UI ScrollArea
- RvnSeparator - Uses Base UI Separator
- RvnToolbar - Uses Base UI Toolbar

## API Changes (Breaking)

### Old API (RvnModal)
```tsx
<RvnModal open={isOpen} onClose={() => setIsOpen(false)}>
  <RvnModal.Content>
    <RvnModal.Header>
      <RvnModal.Title>Title</RvnModal.Title>
    </RvnModal.Header>
    <RvnModal.Body>Content</RvnModal.Body>
  </RvnModal.Content>
</RvnModal>
```

### New API (RvnModal)
```tsx
<RvnModal.Root open={isOpen} onOpenChange={setIsOpen}>
  <RvnModal.Trigger>Open</RvnModal.Trigger>
  <RvnModal.Portal>
    <RvnModal.Backdrop />
    <RvnModal.Content>
      <RvnModal.Header>
        <RvnModal.Title>Title</RvnModal.Title>
        <RvnModal.Close>X</RvnModal.Close>
      </RvnModal.Header>
      <RvnModal.Body>Content</RvnModal.Body>
    </RvnModal.Content>
  </RvnModal.Portal>
</RvnModal.Root>
```

### Key Changes
1. `onClose` -> `onOpenChange` (Base UI standard)
2. Explicit `Portal` and `Backdrop` components
3. `Trigger` and `Close` components for built-in behavior
4. `Description` component for accessibility
