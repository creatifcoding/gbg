# RVN BaseUI Expansion Plan

Based on BaseUI component inventory, these components should be added to RVN.

## Phase 1: Form Enhancements (Priority)

| Component | BaseUI Equivalent | RVN Styling |
|-----------|-------------------|-------------|
| `RvnAutocomplete` | Autocomplete | Dropdown with search, 3px borders |
| `RvnCombobox` | Select + search | Searchable dropdown |
| `RvnNumberInput` | Number Input | Stepper buttons, monospace |
| `RvnDateInput` | (custom) | Calendar picker, brutalist |
| `RvnTimeInput` | (custom) | Time picker, 24h format |
| `RvnFileUpload` | (custom) | Drag-drop zone, progress |
| `RvnFormControl` | Form Control | Label + input + error wrapper |
| `RvnFormGroup` | (custom) | Fieldset styling |
| `RvnTextareaAutosize` | Textarea Autosize | Auto-growing textarea |

## Phase 2: Interaction Utilities

| Component | BaseUI Equivalent | Purpose |
|-----------|-------------------|---------|
| `RvnClickAwayListener` | Click-Away Listener | Detect outside clicks |
| `RvnFocusTrap` | Focus Trap | Trap focus in modals |
| `RvnPortal` | Portal | Render to document.body |
| `RvnPopper` | Popper | Positioning utility |

## Phase 3: Data Display

| Component | BaseUI Equivalent | RVN Styling |
|-----------|-------------------|-------------|
| `RvnSnackbar` | Snackbar | Bottom notification bar |
| `RvnTablePagination` | Table Pagination | Page controls, monospace |
| `RvnDataList` | (custom) | Key-value display |
| `RvnTree` | (custom) | Expandable tree view |
| `RvnAccordion` | (custom) | Collapsible sections |
| `RvnSkeleton` | (custom) | Loading placeholder |
| `RvnAvatar` | (custom) | User avatar, black border |
| `RvnChip` | (custom) | Dismissible tag |

## Phase 4: Navigation Enhancements

| Component | BaseUI Equivalent | RVN Styling |
|-----------|-------------------|-------------|
| `RvnMenu` | Menu | Dropdown menu |
| `RvnMenuItem` | Menu Item | Menu item with icon |
| `RvnMenuDivider` | (custom) | Menu separator |
| `RvnPagination` | (custom) | Page navigation |
| `RvnStepper` | (custom) | Multi-step wizard |

## Phase 5: Overlays & Dialogs

| Component | BaseUI Equivalent | RVN Styling |
|-----------|-------------------|-------------|
| `RvnDialog` | Modal variant | Confirmation dialog |
| `RvnSheet` | (custom) | Bottom sheet mobile |
| `RvnContextMenu` | (custom) | Right-click menu |

## Design Token Additions

```css
/* New tokens for expanded components */
--rvn-autocomplete-max-height: 300px;
--rvn-chip-height: 28px;
--rvn-avatar-size-sm: 32px;
--rvn-avatar-size-md: 40px;
--rvn-avatar-size-lg: 56px;
--rvn-stepper-connector-width: 2px;
--rvn-skeleton-bg: #e0e0e0;
--rvn-skeleton-highlight: #f0f0f0;
```

## Implementation Order

1. **FormControl** (wraps all form inputs)
2. **Autocomplete** (most requested)
3. **NumberInput** (common form field)
4. **Menu** (dropdown navigation)
5. **Snackbar** (notifications)
6. **Accordion** (collapsible content)
7. **Pagination** (data tables)
8. Remaining components...

## Brutalist Styling Rules (Apply to All)

- 3px solid black borders
- 4px 4px box-shadow (removed on press)
- NO border-radius
- Monospace for data/numbers
- Helvetica Neue for labels
- 12px minimum font size
- High contrast black/white
- Diagonal stripes for critical states
