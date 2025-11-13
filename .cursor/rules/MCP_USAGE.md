# MCP Usage Rules

## Core Principle

**MCPs (Model Context Protocol) MUST be used when available and relevant.**

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

## MCP Usage Pattern

```
1. Check MCP availability (list_mcp_resources)
2. Determine which MCPs are relevant to the task
3. Use Hygraph MCP to validate/check existing state
4. Use Exa/Docfork for documentation if needed
5. Perform action with MCP-validated context
6. Verify results via MCP if applicable
7. Cite all MCP sources
```

## Usage by Command Type

### Phase Commands

**Before creating phases:**
1. Use `mcp_hygraph_list_entity_types` to check existing models
2. Validate phase doesn't conflict with existing schema
3. Use `mcp_Exa_Search_get_code_context_exa` for phase documentation
4. Use `mcp_Docfork_docfork_search_docs` for framework docs

**When showing phases:**
1. Use `mcp_hygraph_get_entity_schema` to show related models
2. Validate phase tasks against live schema

### Task Commands

**Before creating tasks:**
1. Use `mcp_hygraph_get_entity_schema` to validate field types
2. Check existing models for conflicts
3. Use `mcp_Exa_Search_get_code_context_exa` for code examples
4. Use `mcp_Docfork_docfork_search_docs` for documentation

**When showing tasks:**
1. Use `mcp_hygraph_get_entity_schema` to show related models
2. Validate task references against live schema

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

## Best Practices

✅ **Do:**
- Always check MCP availability first
- Use MCPs for validation before actions
- Cite MCP sources in output
- Use MCPs for up-to-date information
- Combine multiple MCPs when needed
- Think through which MCP is appropriate

❌ **Don't:**
- Assume MCPs are always available
- Skip MCP validation when creating
- Use stale information when MCPs available
- Forget to cite MCP sources
- Ignore MCP errors silently
- Use MCPs without understanding why

## Implementation Guidance

**Think through MCP usage:**
- What information do I actually need?
- Which MCP provides that information?
- How do I validate the information?
- What if the MCP fails?

**Don't just follow patterns - understand the purpose.**

