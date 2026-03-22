# Kraken Handoff: Design Tools for Cursor Server

## Task
Implement Phase 5 of the ComponentBox Design System plan: Create Design Tools for Cursor Server.

## Requirements
1. Create `src/lib/cursor/tools/design-tools.ts` - Design manipulation tools
2. Create `src/lib/cursor/tools/file-tools.ts` - Codebase editing tools
3. Modify `src/lib/cursor/api/server.ts` - Register new tools

## Tools to Implement
- updateStylesTool - Update inline styles on a component
- setTokenTool - Set a design token value
- toggleVariantTool - Toggle component variant
- setPropTool - Set a prop value on a component
- resetPropsTool - Reset component to default props
- getTreeTool - Get the component hierarchy tree
- listPropsTool - List available props for a component
- exportCodeTool - Export component source code
- editFileTool - Edit a file in the codebase

## Checkpoints
<!-- Resumable state for kraken agent -->
**Task:** Design Tools for Cursor Server
**Started:** 2026-01-31T15:00:00Z
**Last Updated:** 2026-01-31T15:30:00Z

### Phase Status
- Phase 1 (Tests Written): VALIDATED (60 tests created)
- Phase 2 (Implementation): VALIDATED (all tests green)
- Phase 3 (Server Integration): VALIDATED (tools exported from server.ts)
- Phase 4 (Refactoring): VALIDATED (code clean, no issues)

### Validation State
```json
{
  "test_count": 60,
  "tests_passing": 60,
  "files_modified": [
    "src/lib/cursor/tools/design-tools.ts",
    "src/lib/cursor/tools/file-tools.ts",
    "src/lib/cursor/tools/index.ts",
    "src/lib/cursor/api/server.ts",
    "src/lib/cursor/tools/__tests__/design-tools.test.ts",
    "src/lib/cursor/tools/__tests__/file-tools.test.ts"
  ],
  "last_test_command": "bun test src/lib/cursor/tools/__tests__/",
  "last_test_exit_code": 0
}
```

### Resume Context
- Current focus: Implementation complete
- Next action: None - task finished
- Blockers: None
