# Hygraph Schema Deletion Guide

This guide explains how to delete different types of schema resources in Hygraph using the Management SDK.

## Available Delete Methods

The Management SDK provides the following delete methods:

- `deleteModel({ apiId })` - Delete a model
- `deleteComponent({ apiId })` - Delete a component
- `deleteEnumeration({ apiId })` - Delete an enumeration
- `deleteTaxonomy({ apiId })` - Delete a taxonomy
- `deleteTaxonomyNode({ apiId })` - Delete a taxonomy node
- `deleteField({ parentApiId, apiId })` - Delete any field
- `deleteRemoteSource({ prefix })` - Delete a remote source (GraphQL or REST)
- `deleteStage({ apiId })` - Delete a stage
- `deleteLocale({ apiId })` - Delete a locale
- `deleteWebhook({ id })` - Delete a webhook
- `deleteWorkflow({ id })` - Delete a workflow
- `deleteAppInstallation({ id })` - Delete an app installation
- `deleteCustomSidebarElement({ id })` - Delete a custom sidebar element

## Usage Pattern

All delete operations follow the same pattern:

1. **Queue the deletion** - Call the delete method on the Management SDK client
2. **Execute the migration** - Call `client.run(true)` to apply the changes

```typescript
import { Client } from '@hygraph/management-sdk';

const client = new Client({
  authToken: process.env.HYGRAPH_MGMT_TOKEN!,
  endpoint: process.env.HYGRAPH_MGMT_ENDPOINT!,
});

// Queue deletion
client.deleteComponent({ apiId: 'MyComponent' });

// Execute
const result = await client.run(true);
```

## Deleting Components

**Method**: `client.deleteComponent({ apiId })`

**Parameters**:
- `apiId` (string, required) - The API ID of the component to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteComponent({ apiId: 'YadaMetadata' });
const result = await client.run(true);
```

**Notes**:
- Deleting a component will also delete all fields that use this component
- Components must not be referenced by any fields before deletion

## Deleting Enumerations

**Method**: `client.deleteEnumeration({ apiId })`

**Parameters**:
- `apiId` (string, required) - The API ID of the enumeration to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteEnumeration({ apiId: 'YadaStatus' });
const result = await client.run(true);
```

**Notes**:
- Deleting an enumeration will fail if any fields still reference it
- You must delete all fields using the enumeration first

## Deleting Taxonomies

**Method**: `client.deleteTaxonomy({ apiId })`

**Parameters**:
- `apiId` (string, required) - The API ID of the taxonomy to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteTaxonomy({ apiId: 'Category' });
const result = await client.run(true);
```

**Notes**:
- Deleting a taxonomy will also delete all taxonomy nodes within it
- You must delete all taxonomy fields that reference this taxonomy first

### Deleting Taxonomy Nodes

**Method**: `client.deleteTaxonomyNode({ apiId })`

**Parameters**:
- `apiId` (string, required) - The API ID of the taxonomy node to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteTaxonomyNode({ apiId: 'CategoryNode1' });
const result = await client.run(true);
```

**Notes**:
- Deleting a taxonomy node will also delete all child nodes
- The taxonomy node API ID format is: `{taxonomyApiId}_{nodeApiId}` (e.g., `Category_Technology`)

## Deleting Remote Sources

**Method**: `client.deleteRemoteSource({ prefix })`

**Parameters**:
- `prefix` (string, required) - The prefix of the remote source to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteRemoteSource({ prefix: 'Jsonplaceholder' });
const result = await client.run(true);
```

**Notes**:
- Deleting a remote source will also delete all remote fields that depend on it
- The prefix must match exactly (case-sensitive, must start with uppercase)

## Deleting Fields

**Method**: `client.deleteField({ parentApiId, apiId })`

**Parameters**:
- `parentApiId` (string, required) - The API ID of the model or component containing the field
- `apiId` (string, required) - The API ID of the field to delete

**Example**:
```typescript
const client = new Client({ authToken, endpoint });
client.deleteField({ parentApiId: 'Post', apiId: 'title' });
const result = await client.run(true);
```

**Notes**:
- Works for all field types (simple, relational, component, union, remote, taxonomy, etc.)
- Deleting a field will remove it from the schema permanently

## Batch Deletions

You can queue multiple deletions before executing:

```typescript
const client = new Client({ authToken, endpoint });

// Queue multiple deletions
client.deleteComponent({ apiId: 'Component1' });
client.deleteComponent({ apiId: 'Component2' });
client.deleteEnumeration({ apiId: 'Status' });

// Execute all at once
const result = await client.run(true);
```

**Important**: If any deletion in the batch fails, the entire batch will fail. For more resilient deletion, delete resources individually.

## Error Handling

The `run()` method returns a result object with a `status` field:

```typescript
const result = await client.run(true);

if (result.status === 'SUCCESS' || result.status === 'APPLIED') {
  console.log('Deletion successful');
} else {
  console.error('Deletion failed:', result.errors);
}
```

Common error scenarios:
- **Resource doesn't exist**: "Could not find [resource type] with apiId: [id]"
- **Resource is referenced**: "Cannot delete [resource] because it is referenced by [other resource]"
- **Invalid API ID**: "Validation Error: ApiId invalid: [reason]"

## Helper Scripts

We provide helper scripts for bulk deletion:

### Delete All Models
```bash
pnpm run dev:hygraph:delete-models
```

This script:
- Enumerates all models via Hygraph MCP
- Deletes them individually (handles non-existent models gracefully)
- Provides a summary of successes and failures

### Delete Components, Enumerations, Taxonomies, and Remote Sources
```bash
pnpm run dev:hygraph:delete-schema
```

This script:
- Deletes components, enumerations, taxonomies, and remote sources
- Uses hardcoded lists (update the arrays in the script)
- Provides a summary of successes and failures

## Best Practices

1. **Delete in reverse dependency order**:
   - Delete fields before deleting models/components
   - Delete fields using enumerations before deleting enumerations
   - Delete remote fields before deleting remote sources
   - Delete taxonomy fields before deleting taxonomies

2. **Use individual deletions for resilience**:
   - If one resource fails, others can still succeed
   - Easier to identify which specific resource caused the failure

3. **Check existence before deletion**:
   - Use GraphQL introspection for schema elements (models, components, enumerations, taxonomies)
   - Use `dryRun()` to check if a deletion would be queued

4. **Handle errors gracefully**:
   - Catch and log errors for each deletion attempt
   - Continue with remaining deletions even if some fail

## Example: Complete Cleanup Script

```typescript
import { Client } from '@hygraph/management-sdk';

const client = new Client({
  authToken: process.env.HYGRAPH_MGMT_TOKEN!,
  endpoint: process.env.HYGRAPH_MGMT_ENDPOINT!,
});

async function deleteResource(
  resourceType: string,
  apiId: string,
  deleteFn: (params: any) => void,
  params: any,
): Promise<boolean> {
  try {
    deleteFn.call(client, params);
    const result = await client.run(true);
    return result.status === 'SUCCESS' || result.status === 'APPLIED';
  } catch (error) {
    console.error(`Failed to delete ${resourceType} ${apiId}:`, error);
    return false;
  }
}

// Delete components
await deleteResource('component', 'MyComponent', client.deleteComponent, { apiId: 'MyComponent' });

// Delete enumerations
await deleteResource('enumeration', 'MyEnum', client.deleteEnumeration, { apiId: 'MyEnum' });

// Delete taxonomies
await deleteResource('taxonomy', 'MyTaxonomy', client.deleteTaxonomy, { apiId: 'MyTaxonomy' });

// Delete remote sources
await deleteResource('remoteSource', 'MyPrefix', client.deleteRemoteSource, { prefix: 'MyPrefix' });
```

## Related Documentation

- [Hygraph Management SDK Documentation](https://hygraph.com/docs/api-reference/management-sdk)
- [Hygraph Schema Documentation](https://hygraph.com/docs/api-reference/schema)
- [Internal Documentation](./HYGRAPH_INTERNAL.md)



