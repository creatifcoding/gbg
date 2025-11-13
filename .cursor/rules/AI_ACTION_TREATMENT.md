# AI Action Treatment Rule

## Core Principle

**When performing actions on behalf of the user (without explicit slash command invocation), treat it as if the user triggered the command directly.**

## Requirements

- ✅ Use the same enriched format, backlinks, and context as if the command was explicitly called
- ✅ Provide full command output with all contextual information
- ✅ Include all navigation links and recommendations
- ✅ Follow the same documentation standards
- ✅ Show confirmation with all details
- ✅ Maintain consistency with explicit command usage

## Implementation Guidance

### Think Through Implementation

**Examples in commands are illustrative, not literal.** You must:

1. **Analyze the actual situation** - What's the real state of the system?
2. **Determine the correct approach** - What actually needs to be done?
3. **Implement thoughtfully** - Consider edge cases, dependencies, and context
4. **Provide real value** - Don't just follow examples, solve the actual problem

### Example Interpretation

**Bad (Literal):**
```
User: "create phase 2"
AI: [Follows example exactly, creates "metadata-annotations" because example says so]
```

**Good (Thoughtful):**
```
User: "create phase 2"
AI: [Analyzes INTERNAL.md priorities, determines "advanced-simple-fields" is correct, 
     creates with proper structure, validates against existing phases, 
     creates appropriate tasks based on actual requirements]
```

### When User Says "Do X"

Treat it as if they ran `/command-x`:
- Same output format
- Same backlinks
- Same recommendations
- Same validation
- Same confirmation

But **think through** what X actually means in context, don't just follow examples.

## Examples

### Creating a Phase

**User says:** "Create phase 2 for advanced simple fields"

**You should:**
1. Check existing phases (via actual system state)
2. Determine next phase number (from actual state, not example)
3. Validate phase name against naming conventions
4. Check dependencies (Phase 1 must exist and be in correct state)
5. Create phase structure based on templates
6. Create tasks based on INTERNAL.md priorities (not example tasks)
7. Provide enriched output with real backlinks
8. Suggest next steps based on actual state

**Don't:**
- Copy example phase name literally
- Use example task IDs without checking
- Follow example structure without considering actual needs

### Creating Tasks

**User says:** "Create tasks for phase 2"

**You should:**
1. Read INTERNAL.md to understand actual priorities
2. Analyze what tasks are actually needed
3. Create tasks that match real requirements
4. Use proper naming based on actual task content
5. Set correct dependencies based on real relationships
6. Provide output as if `/task-create` was called for each

**Don't:**
- Create example tasks from command file
- Use placeholder names
- Ignore actual requirements

## Key Principle

**Examples illustrate the format and style, not the content. You must determine the actual content based on real system state and requirements.**

