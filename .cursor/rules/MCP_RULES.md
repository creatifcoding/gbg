# MCP Usage Rules

Comprehensive rules for using Model Context Protocol (MCP) tools in all commands.

## Overview

All Cursor commands MUST use MCPs when available and relevant. This ensures:
- Up-to-date information
- Validation against live systems
- Accurate documentation references
- Real-time schema introspection

## Required MCPs

### 1. Hygraph MCP

**Purpose**: Schema introspection, entity discovery, validation

**Available Tools:**
- `mcp_hygraph_list_entity_types` - List all entity types
- `mcp_hygraph_get_entity_schema` - Get schema for specific entity
- `mcp_hygraph_list_entities` - List entities of a type
- `mcp_hygraph_get_entities_by_id` - Get specific entities
- `mcp_hygraph_discover_entities` - Discover sample entities
- `mcp_hygraph_search_content` - Search across content
- `mcp_hygraph_create_entry` - Create new entries
- `mcp_hygraph_update_entry` - Update entries
- `mcp_hygraph_publish_entry` - Publish entries

**When to Use:**
- ✅ Before creating phases/tasks (validate against existing schema)
- ✅ When referencing Hygraph models
- ✅ When validating field types
- ✅ When checking entity structure
- ✅ When creating/updating Hygraph content

**Usage Pattern:**
```typescript
// 1. Check existing entity types
const types = await mcp_hygraph_list_entity_types();

// 2. Get schema for validation
const schema = await mcp_hygraph_get_entity_schema({ typename: "Post" });

// 3. Validate before creating
// ... create task/phase with validated context
```

### 2. Exa MCP

**Purpose**: Code context and documentation lookup

**Available Tools:**
- `mcp_Exa_Search_get_code_context_exa` - Get code/API context
- `mcp_Exa_Search_web_search_exa` - Web search

**When to Use:**
- ✅ For API/library documentation
- ✅ For code examples
- ✅ For current best practices
- ✅ When Hygraph docs are needed
- ✅ For framework-specific information

**Usage Pattern:**
```typescript
// Get code context for Hygraph Management SDK
const context = await mcp_Exa_Search_get_code_context_exa({
  query: "Hygraph Management SDK createSimpleField",
  tokensNum: 5000
});
```

### 3. Docfork MCP

**Purpose**: Documentation search and reading

**Available Tools:**
- `mcp_Docfork_docfork_search_docs` - Search documentation
- `mcp_Docfork_docfork_read_url` - Read specific documentation URL

**When to Use:**
- ✅ For framework documentation
- ✅ For library reference docs
- ✅ When specific documentation pages needed
- ✅ For version-specific information

**Usage Pattern:**
```typescript
// Search for documentation
const docs = await mcp_Docfork_docfork_search_docs({
  query: "Hygraph Management SDK field types",
  tokens: "dynamic"
});

// Read specific URL
const content = await mcp_Docfork_docfork_read_url({
  url: "https://hygraph.com/docs/api-reference/management-sdk"
});
```

## MCP Usage Rules by Command Type

### Phase Commands

**Before creating phases:**
1. Use Hygraph MCP to check existing models
2. Validate phase doesn't conflict
3. Use Exa/Docfork for phase documentation

**When showing phases:**
1. Use Hygraph MCP to show related models
2. Validate phase tasks against schema

**When reporting:**
1. Use Hygraph MCP to check model status
2. Validate completion against live schema

### Task Commands

**Before creating tasks:**
1. Use Hygraph MCP to validate field types
2. Check existing models for conflicts
3. Use Exa for code examples
4. Use Docfork for documentation

**When showing tasks:**
1. Use Hygraph MCP to show related models
2. Validate task references

**When validating:**
1. Use Hygraph MCP to check schema consistency
2. Validate against live Hygraph state

## MCP Usage Checklist

Before any action, check:

- [ ] Are MCPs available? (Check `list_mcp_resources`)
- [ ] Does this relate to Hygraph? → Use Hygraph MCP
- [ ] Do I need documentation? → Use Exa/Docfork MCP
- [ ] Do I need code examples? → Use Exa MCP
- [ ] Am I creating/updating? → Validate with Hygraph MCP first
- [ ] Am I referencing docs? → Fetch via MCP, don't assume

## Error Handling

**If MCP unavailable:**
- Note that MCP validation was skipped
- Proceed with caution
- Suggest manual validation
- Use static documentation as fallback

**If MCP fails:**
- Log the error
- Use fallback information
- Suggest retry
- Continue with available information

## Citation Requirements

**Always cite MCP sources:**
- "Source: Hygraph MCP - `mcp_hygraph_get_entity_schema`"
- "Source: Exa MCP - `mcp_Exa_Search_get_code_context_exa`"
- "Source: Docfork MCP - `mcp_Docfork_docfork_search_docs`"

## Examples

### Example 1: Creating a Phase

```typescript
// 1. Check existing Hygraph models
const entityTypes = await mcp_hygraph_list_entity_types();

// 2. Validate phase doesn't conflict
if (entityTypes.includes("NewModel")) {
  // Handle conflict
}

// 3. Get documentation
const docs = await mcp_Exa_Search_get_code_context_exa({
  query: "Hygraph phase structure",
  tokensNum: 3000
});

// 4. Create phase with validated context
// ... create phase
```

### Example 2: Creating a Task

```typescript
// 1. Get entity schema for validation
const schema = await mcp_hygraph_get_entity_schema({
  typename: "Post"
});

// 2. Check field types exist
const fieldTypes = schema.fields.map(f => f.type);

// 3. Get code examples
const examples = await mcp_Exa_Search_get_code_context_exa({
  query: "Hygraph createSimpleField example",
  tokensNum: 2000
});

// 4. Create task with validated context
// ... create task
```

## Integration with Commands

All commands should:
1. Check MCP availability at start
2. Use MCPs for validation
3. Use MCPs for documentation
4. Cite MCP sources
5. Handle MCP failures gracefully

## Best Practices

✅ **Do:**
- Always check MCP availability first
- Use MCPs for validation before actions
- Cite MCP sources in output
- Use MCPs for up-to-date information
- Combine multiple MCPs when needed

❌ **Don't:**
- Assume MCPs are always available
- Skip MCP validation when creating
- Use stale information when MCPs available
- Forget to cite MCP sources
- Ignore MCP errors silently

---

**Remember**: MCPs provide real-time, validated information. Always prefer MCP data over assumptions!

