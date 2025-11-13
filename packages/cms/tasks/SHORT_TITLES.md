# Short Titles Guide

Short titles provide quick, memorable references for addressing tasks in conversation and commands.

## Format

**Kebab-case, 3 words or less, max 30 characters**

```
pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*$
```

## Rules

1. **Lowercase only** - no uppercase letters
2. **Kebab-case** - words separated by hyphens
3. **3 words maximum** - typically 2-3 words
4. **Alphanumeric + hyphens** - no special characters
5. **Max 30 characters** - keep it concise

## Examples

### Good Short Titles

| Task Title | Short Title |
|------------|------------|
| Complete BaseArchetype | `complete-base-archetype` |
| Implement BaseArchetype class structure | `implement-archetype-class` |
| Add TypeScript types and exports | `add-typescript-types` |
| Install Management SDK | `install-management-sdk` |
| Create model schema | `create-model-schema` |
| Fix validation errors | `fix-validation-errors` |
| Review documentation | `review-documentation` |
| Deploy to production | `deploy-production` |

### Bad Short Titles ❌

| Example | Problem |
|---------|---------|
| `CompleteBaseArchetype` | Uses camelCase instead of kebab-case |
| `complete base archetype` | Uses spaces instead of hyphens |
| `complete-base-archetype-with-all-fields` | Too many words (4+) |
| `complete_base_archetype` | Uses underscores instead of hyphens |
| `complete-base-archetype!!!` | Contains special characters |
| `COMPLETE-BASE-ARCHETYPE` | Uses uppercase |

## Referencing by Short Title

Once set, you can reference tasks by short title:

```bash
# Instead of typing full task ID:
/task-show 01-001

# You could say in conversation:
"Let me check the status of /complete-base-archetype"
```

## Implementation

### In Task Front Matter

```yaml
---
id: "01-001"
title: "Complete BaseArchetype"
shortTitle: "complete-base-archetype"
---
```

### Generating from Title

Use the `toShortTitle()` helper function from `types.ts`:

```typescript
import { toShortTitle } from './types';

const fullTitle = "Complete BaseArchetype";
const shortTitle = toShortTitle(fullTitle);
// Result: "complete-base-archetype"
```

### Validation

Use the validation function to ensure format:

```typescript
import { isValidShortTitle, createShortTitle } from './types';

// Check if valid
if (isValidShortTitle("complete-base-archetype")) {
  console.log("Valid!");
}

// Create with validation
try {
  const short = createShortTitle("complete-base-archetype");
  console.log(short);
} catch (e) {
  console.error("Invalid short title:", e.message);
}
```

## Strategy

### Choosing Short Titles

1. **Start with key words** - What's the core action/noun?
2. **Keep it concise** - 2-3 words usually
3. **Make it memorable** - Easy to recall in conversation
4. **Avoid redundancy** - Don't repeat phase or task type
5. **Be consistent** - Use similar patterns across related tasks

### Examples by Category

**Implementation Tasks:**
- `implement-feature-name`
- `add-component-type`
- `create-module-name`
- `build-system-part`

**Documentation Tasks:**
- `document-feature-name`
- `write-guide-topic`
- `update-readme-section`
- `add-examples`

**Testing Tasks:**
- `test-feature-name`
- `add-unit-tests`
- `fix-failing-tests`
- `increase-coverage`

**Maintenance Tasks:**
- `refactor-module-name`
- `fix-bug-type`
- `update-dependencies`
- `clean-code`

## Integration

Short titles are used in:

1. **Task files** - Required front matter field
2. **Commands** - Can be used in `/task` command suggestions
3. **Reports** - Shown in quick references
4. **Documentation** - Used in task lists and navigation
5. **Comments** - Reference tasks in code comments

## Validation Rules

From `schema.json`:

```json
{
  "shortTitle": {
    "type": "string",
    "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    "minLength": 1,
    "maxLength": 30,
    "description": "Short title in kebab-case (3 words or less)"
  }
}
```

From `.tasklintrc.json`:

```json
{
  "short-title-format": {
    "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    "maxLength": 30,
    "message": "Short title must be kebab-case with 3 words or less"
  }
}
```

## Related

- See `types.ts` for helper functions
- See `schema.json` for validation rules
- See `template.md` for template usage

