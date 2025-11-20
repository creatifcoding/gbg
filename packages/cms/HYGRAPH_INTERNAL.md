# Internal Documentation: Hygraph Schema Understanding

This document captures our understanding of Hygraph's schema system to ensure correct implementation of the Archetype API.

## Table of Contents

1. [Models](#models)
2. [System Fields](#system-fields)
3. [Field Types](#field-types)
4. [Field Configuration](#field-configuration)
5. [Enumerations](#enumerations)
6. [Variants](#variants)
7. [References vs Components](#references-vs-components)
8. [Mapping Strategy](#mapping-strategy)

---

## Models

### Model Structure

Every Hygraph model has:

- **Display Name**: Human-readable name shown in UI (e.g., "Post")
- **API ID**: Singular identifier for GraphQL queries (e.g., "Post")
- **Plural API ID**: Plural identifier for list queries (e.g., "Posts")
- **Description**: Optional hint for content editors

*Source: [Hygraph Models Documentation](https://hygraph.com/docs/api-reference/schema/models#create-a-model)*

### Auto-Generated GraphQL Operations

For a model `Post`, Hygraph automatically generates:

- **Queries**: `post`, `posts`, `postVersion`, `postsConnection`
- **Mutations**: `createPost`, `updatePost`, `deletePost`, `upsertPost`, `publishPost`, `unpublishPost`
- **Batch Operations**: `updateManyPostsConnection`, `deleteManyPostsConnection`, `publishManyPostsConnection`, `unpublishManyPostsConnection`

*Source: [Hygraph Models Documentation](https://hygraph.com/docs/api-reference/schema/models#create-a-model)*

### Key Insight

**Models are just containers for fields.** The model itself doesn't have behavior - it's the fields that define the structure.

*Source: [Hygraph Models Documentation](https://hygraph.com/docs/api-reference/schema/models#adding-fields)*

---

## System Fields

### Critical Understanding

**ALL models automatically include system fields. We should NOT duplicate these in BaseHyGraphModel.**

*Source: [Hygraph System Fields Documentation](https://hygraph.com/docs/api-reference/schema/system-fields#default-model-fields)*

### Default Model Fields (Automatic)

Every content model gets these fields automatically:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID!` | Unique identifier for each entry |
| `createdAt` | `DateTime!` | Timestamp for when the content entry was created |
| `createdBy` | `User` | The user who created the content entry |
| `updatedAt` | `DateTime!` | Timestamp for when the content entry was updated |
| `updatedBy` | `User` | The user who last updated the content entry |
| `publishedAt` | `DateTime!` | Timestamp for when the content entry was published |
| `publishedBy` | `User` | The user who last published the content entry |
| `documentInStages` | `[model]` | Query the current document in other stages |

*Source: [Hygraph System Fields Documentation](https://hygraph.com/docs/api-reference/schema/system-fields#default-model-fields)*

### Implications for BaseArchetype

**BaseArchetype should NOT include these fields in the schema definition.** They exist automatically in Hygraph. Our TypeScript types can reference them, but we don't create them via Management SDK.

### BaseHyGraphModel Correction

The existing `BaseHyGraphModel` includes:

```typescript
{
  id: Schema.String,
  name: Schema.String,        // ❌ NOT a system field
  description: Schema.String, // ❌ NOT a system field
  createdAt: Schema.String,
  updatedAt: Schema.String,
}
```

**Correction**: Only `id`, `createdAt`, `updatedAt` are system fields. `name` and `description` are NOT automatic - they must be explicitly created if needed.

---

## Field Types

*Source: [Hygraph Field Types Documentation](https://hygraph.com/docs/api-reference/schema/field-types)*

*All Management SDK examples below are from: [Hygraph Management SDK Field Examples](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples)*

### Important Note: Management SDK Field Type Classification

**The Hygraph Management SDK groups many field types under `SimpleFieldType` enum**, even though they represent distinct GraphQL types. This is a design decision in the SDK - fields that don't require complex relationships or external entities are classified as "simple" fields.

**All of the following GraphQL field types use `createSimpleField()` with different `SimpleFieldType` enum values:**
- `String` → `SimpleFieldType.String`
- `RichText` → `SimpleFieldType.Richtext`
- `Int` → `SimpleFieldType.Int`
- `Float` → `SimpleFieldType.Float`
- `Boolean` → `SimpleFieldType.Boolean`
- `Date` → `SimpleFieldType.Date`
- `DateTime` → `SimpleFieldType.Datetime`
- `Json` → `SimpleFieldType.Json`
- `Color` → `SimpleFieldType.Color`
- `Location` → `SimpleFieldType.Location`

**Field types that use separate SDK methods:**
- `Asset` → `createRelationalField()` with `RelationalFieldType.Asset`
- `Relation` → `createRelationalField()` with `RelationalFieldType.Relation`
- Enum fields → `createEnumerableField()` (requires `createEnumeration()` first)
- Component fields → `createComponentField()` (requires `createComponent()` first)
- Component union fields → `createComponentUnionField()` (requires components first)
- Union fields → `createUnionField()` (requires referenced models first)
- Remote fields → `createRemoteField()` (requires remote source first)

**Creation Order Dependencies:**
Some fields must be created in a specific order due to dependencies:
1. **Enumerations**: Must create enumeration via `createEnumeration()` before creating enumerable fields
2. **Components**: Must create component via `createComponent()` before creating component fields
3. **Component Unions**: All referenced components must exist before creating component union field
4. **Union Fields**: All referenced models must exist before creating union field
5. **Remote Fields**: Remote source must be configured before creating remote field
6. **Relations**: Referenced models must exist before creating relational fields

*Future Work: A reordering algorithm will be needed to support declarative field definitions that automatically resolve dependencies.*

### Advanced Management SDK Methods

The Management SDK provides several powerful methods for schema introspection and migration management:

**`dryRun(): Migrations[]`**
- Returns all migrations that would have been sent on submit
- Useful for inspecting what changes would be made without executing them
- Can be used to validate migration plans before execution

**`getEnvironmentDiff(targetEnvironment: string): Promise<Migrations[]>`**
- Returns the schema difference between the current environment and target environment as migrations
- Useful for comparing environments and generating migration scripts
- **Potential use case**: Could be used for more robust existence checks by comparing desired state vs current state

**`applySchemaChanges(data: Migrations[]): void`**
- Apply custom schema changes (e.g., output from `getEnvironmentDiff`)
- Allows programmatic application of migration sets
- Useful for syncing environments or applying pre-computed migrations

**Improved Existence Check Strategy (Future):**
Instead of using GraphQL introspection queries (current approach), we could:
1. Use `getEnvironmentDiff` to compare desired schema state with current state
2. Use `dryRun` to validate that proposed migrations would succeed
3. This would provide more reliable existence checks and better error handling

*Note: Current implementation uses GraphQL introspection via urql for read-only existence checks. The Management SDK methods above require Management API access and could provide a more robust alternative.*

---

## Batch Migrations: Understanding the True Nature

### Critical Understanding: Batch Migrations REPLACE, Not Merge

**Source**: [Hygraph Batch Migration Documentation](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration)

Batch migrations in Hygraph have a critical behavior that must be understood: **they REPLACE schemas, they do not MERGE them**. This fundamental characteristic has significant implications for how migrations work and how they can cause data loss if not handled carefully.

### How Batch Migrations Work

#### 1. Environment Comparison with `getEnvironmentDiff`

When using batch migrations, the SDK compares two environments:

```typescript
const diff = client.getEnvironmentDiff("development");
```

This method:
- Takes the **source environment** (e.g., "development") as a parameter
- Compares it against the **target environment** (the one associated with the Management SDK token, typically "master")
- Generates a diff representing **all operations needed** to make the target schema match the source schema exactly

#### 2. Schema Replacement, Not Merging

**Key Point**: The diff lists operations that will **replace** the target schema with the source schema. It does NOT merge changes.

**What this means:**
- If the target environment has schema changes that don't exist in the source, the diff will suggest **deleting** those changes
- Any models, fields, components, or other schema elements in target but not in source will be marked for deletion
- The migration either succeeds completely or fails entirely (atomic operation)

### Implications and Risks

#### Data Loss Risk

**Example Scenario:**
1. You clone `master` environment to create `development` environment
2. You work on `development` for a week, making schema changes
3. During that week, you also make schema changes directly to `master` (not mirrored in `development`)
4. When you use `getEnvironmentDiff("development")` and apply it to `master`:
   - The diff will find differences between `master` and `development`
   - It will suggest **deleting** the changes you made to `master` during the week
   - If applied, those changes will be **permanently lost**

#### Schema Conflicts

Conflicting or unsynchronized schema changes can cause migration failures:
- If target has changes not in source, deletions may be proposed
- If migrations conflict with existing content, errors may occur
- The error "Could not apply schema changes" often indicates environment synchronization issues

### Best Practices

#### 1. Environment Synchronization

**Before applying batch migrations:**
- Ensure source and target environments are synchronized
- Mirror all schema changes from target to source (or vice versa)
- Consider implementing a content freeze during migration periods

#### 2. Review Diffs Before Applying

**Always review the diff before applying:**
- Use `dryRun()` to inspect what migrations would be executed
- Check for DELETE operations that might cause data loss
- Manually edit the diff if necessary to remove unwanted deletions
- Double-check deletions to prevent content loss

#### 3. Coordinate Schema Changes

**During development:**
- Every time you make a schema change in `master`, also add it to `development`
- Keep environments in sync to avoid conflicts
- Use version control or documentation to track schema changes

#### 4. Handle Deletions with Caution

**When deletions are detected:**
- Review each deletion carefully
- Understand what data will be lost
- Consider alternative approaches (e.g., deprecating instead of deleting)
- Remove deletion operations from the diff if they're not intended

### Supported Schema Elements

Batch migrations support the following schema elements:
- Models
- Components
- Locales
- Simple fields
- Conditional visibility in fields
- Relational fields
- Enumerations
- Enumerable fields
- Initial values in enumeration fields
- Stages
- Union fields
- Apps
- Custom renderers and app fields
- Sidebar elements
- Remote fields
- Remote type definitions
- Remote sources

**Not supported:** UI extensions

### Error Handling

When batch migrations fail with errors like "Could not apply schema changes":

1. **Check environment synchronization** - Ensure environments are in sync
2. **Review dry run output** - Look for DELETE operations or conflicts
3. **Inspect error details** - Check error codes, messages, and paths
4. **Compare environments** - Use `getEnvironmentDiff()` to see what differs
5. **Review diff manually** - Edit the diff to remove problematic operations

### Implementation in Our Codebase

Our `hygraph-hello-world.ts` script includes:
- **Dry run analysis** - Detects DELETE operations before execution
- **Warning system** - Alerts when deletions are detected
- **Detailed error logging** - Shows full error structure with codes and messages
- **Troubleshooting tips** - Provides context about batch migration limitations
- **Reference links** - Points to official documentation

### Future Improvements

Consider implementing:
1. **Automatic diff review** - Flag potentially dangerous operations
2. **Environment sync validation** - Check if environments are synchronized before migration
3. **Diff editing utilities** - Help remove unwanted deletions programmatically
4. **Migration rollback** - Track migrations for potential rollback scenarios

### References

- [Hygraph Batch Migration Documentation](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-batchmigration)
- [Management SDK Overview](https://hygraph.com/docs/api-reference/management-sdk)

### Simple Field Types

#### String

- **Variants**:
   - Single line text (default)
   - Multi line text
   - Markdown
   - Slug (with template support)

- **GraphQL Type**: `String`
- **Management SDK**: `SimpleFieldType.String`

*Source: [Hygraph Field Types - String](https://hygraph.com/docs/api-reference/schema/field-types#string)*

##### Example: Title Field of Type String

```typescript
// Required title field of type string
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.String,
  apiId: 'title',
  displayName: 'Title',
  isTitle: true,
  isRequired: true,
  visibility: VisibilityTypes.ReadWrite,
});
```

*Source: [Hygraph Management SDK - Title Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#title-field-of-type-string)*

##### Example: Simple Field of Type String

```typescript
// Simple field of type string
client.createSimpleField({
  parentApiId: 'Author',
  type: SimpleFieldType.String,
  apiId: 'favouritePastime',
  displayName: 'Author Favourite Pastime',
  isRequired: true,
  visibility: VisibilityTypes.ReadWrite,
});
```

*Source: [Hygraph Management SDK - Simple Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#simple-field-of-type-string)*

##### Example: Slug Field

```typescript
// Slug field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.String,
  apiId: 'slug',
  displayName: 'Slug',
  description: 'Enter the slug for this page, such as about, blog, or contact',
  isRequired: true,
  isUnique: true,
  tableRenderer: 'GCMS_SLUG',
  formRenderer: 'GCMS_SLUG',
});
```

*Source: [Hygraph Management SDK - Slug Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#slug-field)*

##### Example: Required & Unique String Field with Regex Validation

```typescript
// Required + unique string field with custom regex validation for emails
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.String,
  apiId: 'email',
  displayName: 'Email',
  isRequired: true,
  isUnique: true,
  validations: {
    String: {
      matches: {
        regex: '^([a-z0-9_\\.\\+-]+)@([\\da-z\\.-]+)\\.([a-z\\.]{2,6})$',
      },
    },
  },
});
```

*Source: [Hygraph Management SDK - Email Validation Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#required--unique-string-field-with-custom-regex-validation-for-emails)*

#### Rich Text

- **GraphQL Type**: `RichText`
- **Management SDK**: `SimpleFieldType.Richtext`
- **Features**: Embeds, formatting, can embed other models
- **Special**: Can enable embeds for specific models

*Source: [Hygraph Field Types - Rich Text](https://hygraph.com/docs/api-reference/schema/field-types#rich-text)*

##### Example: Basic Richtext Field

```typescript
// Basic richtext field
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Richtext,
  apiId: 'content',
  displayName: 'Content',
  description: 'Enter the content for this page. The content uses the rich-text editor, giving you a better visual representation.',
  isRequired: true,
});
```

*Source: [Hygraph Management SDK - Richtext Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#richtext-field)*

##### Example: Richtext with Embeds

```typescript
// Richtext with embeds and single allowed embeddable model
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Richtext,
  apiId: 'contentExtended',
  displayName: 'Content Extended',
  embedsEnabled: true,
  embeddableModels: ['Author'],
});
```

*Source: [Hygraph Management SDK - Richtext with Embeds Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#richtext-with-embeds-and-single-allowed-embeddable-model)*

#### Integer

- **GraphQL Type**: `Int`
- **Management SDK**: `SimpleFieldType.Int`
- **Use Case**: Whole numbers

*Source: [Hygraph Field Types - Integer](https://hygraph.com/docs/api-reference/schema/field-types#integer)*

##### Example: Hidden Integer Field with Custom Validation

```typescript
// Hidden integer field with custom field validation
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Int,
  apiId: 'count',
  displayName: 'Count',
  visibility: VisibilityTypes.Hidden,
  validations: {
    Int: {
      range: {
        max: 1000,
        min: 0,
        errorMessage: 'Counter has to be between 0 and 1000',
      },
    },
  },
});
```

*Source: [Hygraph Management SDK - Hidden Integer Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#hidden-integer-field-with-custom-field-validation)*

#### Float

- **GraphQL Type**: `Float`
- **Management SDK**: `SimpleFieldType.Float`
- **Use Case**: Decimal numbers

*Source: [Hygraph Field Types - Float](https://hygraph.com/docs/api-reference/schema/field-types#float)*

#### Boolean

- **GraphQL Type**: `Boolean`
- **Management SDK**: `SimpleFieldType.Boolean`

*Source: [Hygraph Field Types - Boolean](https://hygraph.com/docs/api-reference/schema/field-types#boolean)*

#### Date

- **GraphQL Type**: `Date`
- **Management SDK**: `SimpleFieldType.Date`
- **Format**: Date only (no time)

*Source: [Hygraph Field Types - Date](https://hygraph.com/docs/api-reference/schema/field-types#date)*

#### Date and Time

- **GraphQL Type**: `DateTime`
- **Management SDK**: `SimpleFieldType.Datetime`
- **Format**: Full timestamp

*Source: [Hygraph Field Types - Date and Time](https://hygraph.com/docs/api-reference/schema/field-types#date-and-time)*

##### Example: List of Date Times

```typescript
// List of date times
client.createSimpleField({
  parentApiId: 'Page',
  type: SimpleFieldType.Datetime,
  apiId: 'lastSeen',
  displayName: 'Last Seen',
  isRequired: true,
  isList: true,
});
```

*Source: [Hygraph Management SDK - List of Date Times Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#list-of-date-times)*

#### JSON

- **GraphQL Type**: `Json`
- **Management SDK**: `SimpleFieldType.Json`
- **Use Case**: Flexible structured data

*Source: [Hygraph Field Types - JSON](https://hygraph.com/docs/api-reference/schema/field-types#json)*

#### Color

- **GraphQL Type**: `Color`
- **Management SDK**: `SimpleFieldType.Color`
- **Format**: Hex color codes

*Source: [Hygraph Field Types - Color](https://hygraph.com/docs/api-reference/schema/field-types#color)*

#### Location

- **GraphQL Type**: `Location`
- **Management SDK**: `SimpleFieldType.Location`
- **Contains**: Latitude, longitude, address

*Source: [Hygraph Field Types - Location](https://hygraph.com/docs/api-reference/schema/field-types#location)*

### Complex Field Types

#### Asset

- **GraphQL Type**: `Asset`
- **Management SDK**: `RelationalFieldType.Asset`
- **System Model**: Asset model exists automatically
- **Fields**: url, handle, fileName, height, width, size, mimeType, locale, localizations

*Source: [Hygraph System Fields - Asset Fields](https://hygraph.com/docs/api-reference/schema/system-fields#asset-fields)*

##### Example: Required Uni-directional Asset Field

```typescript
// Required uni-directional asset field
client.createRelationalField({
  parentApiId: 'Page',
  apiId: 'preview',
  displayName: 'Preview',
  type: RelationalFieldType.Asset,
  isRequired: true,
  reverseField: {
    isUnidirectional: true,
    apiId: 'page',
    displayName: 'Page',
    modelApiId: 'Asset',
  },
});
```

*Source: [Hygraph Management SDK - Required Uni-directional Asset Field Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#required-uni-directional-asset-field)*

#### Enumerations

- **GraphQL Type**: Custom enum type
- **Management SDK**: `EnumerableFieldType` + `createEnumeration()`
- **Use Case**: Fixed set of values
- **Example**: Status enum with values ["DRAFT", "PUBLISHED", "ARCHIVED"]

*Source: [Hygraph Enumerations Documentation](https://hygraph.com/docs/api-reference/schema/enumerations)*

##### Example: Create Enumeration

```typescript
// Create enumeration
client.createEnumeration({
  apiId: 'PostStatus',
  displayName: 'Post Status',
  values: [
    { apiId: 'draft', displayName: 'Draft' },
    { apiId: 'published', displayName: 'Published' },
    { apiId: 'archived', displayName: 'Archived' }
  ]
});

// Create enumerable field
client.createEnumerableField({
  parentApiId: 'Post',
  apiId: 'status',
  displayName: 'Status',
  enumerationApiId: 'PostStatus',
  isRequired: true,
  visibility: VisibilityTypes.ReadWrite,
});
```

*Source: [Hygraph Management SDK - Enumerations Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#enumerations)*

#### Taxonomies

- **GraphQL Type**: Custom taxonomy type
- **Management SDK**: Taxonomy-specific APIs
- **Use Case**: Hierarchical categorization (like WordPress categories/tags)

*Source: [Hygraph Taxonomies Documentation](https://hygraph.com/docs/api-reference/schema/taxonomies)*

#### References

- **GraphQL Type**: Model type or `[Model]`
- **Management SDK**: `RelationalFieldType.Relation`
- **Types**:
   - One-way (unidirectional)
   - Two-way (bidirectional)
   - One-to-one, One-to-many, Many-to-one, Many-to-many

*Source: [Hygraph References Documentation](https://hygraph.com/docs/developer-guides/schema/references)*

##### Example: Regular Bi-directional M-1 Relation

```typescript
// Regular bi-directional m-1 relation
client.createRelationalField({
  parentApiId: 'Page',
  apiId: 'writtenBy',
  displayName: 'Written By',
  type: RelationalFieldType.Relation,
  reverseField: {
    modelApiId: 'Author',
    apiId: 'pages',
    displayName: 'pages',
    isList: true,
  },
});
```

*Source: [Hygraph Management SDK - Relational Fields Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#relational-fields)*

##### Example: M-N Relation

```typescript
// M-n relation
client.createRelationalField({
  parentApiId: 'Author',
  apiId: 'favouriteBooks',
  displayName: 'Favourite Books',
  type: RelationalFieldType.Relation,
  isList: true,
  reverseField: {
    modelApiId: 'Page',
    apiId: 'favouriteOf',
    displayName: 'Favourite of',
    isList: true,
  },
});
```

*Source: [Hygraph Management SDK - M-N Relation Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#m-n-relation)*

#### Union Fields

- **GraphQL Type**: Union type
- **Management SDK**: `UnionFieldType`
- **Use Case**: Reference to multiple model types

*Source: [Hygraph Field Types - Union Fields](https://hygraph.com/docs/api-reference/schema/field-types#union-fields)*

##### Example: Create Union Field

```typescript
// Create union field
client.createUnionField({
  parentApiId: 'Author',
  apiId: 'favourites',
  displayName: 'Author Favourite Books',
  reverseField: {
    apiId: 'authorFavouriteBook',
    displayName: 'author favourite book',
    modelApiIds: ['Book'],
  },
});

// Add a union member to the previous union field
client.updateUnionField({
  parentApiId: 'Author',
  apiId: 'favourites',
  displayName: 'Favourite Pastime',
  reverseField: {
    modelApiIds: ['Book', 'Movie'],
  },
});
```

*Source: [Hygraph Management SDK - Union Fields Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#union-fields)*

#### Components

- **GraphQL Type**: Component type
- **Management SDK**: `ComponentFieldType` + `createComponent()`
- **Use Case**: Reusable field groups
- **Difference from References**: Components are embedded, References are linked

*Source: [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)*

##### Example: Create Component and Component Field

```typescript
// Create a component
client.createComponent({
  apiId: 'Address',
  apiIdPlural: 'Adresses',
  displayName: 'Address',
});

// Add a field to the component
client.createSimpleField({
  parentApiId: 'Address',
  type: SimpleFieldType.String,
  apiId: 'city',
  displayName: 'City',
});

// Create basic component field
client.createComponentField({
  parentApiId: 'Author',
  apiId: 'address',
  displayName: 'Address',
  description: 'Address of the author',
  componentApiId: 'Address',
});

// Create a component union field
client.createComponentUnionField({
  parentApiId: 'Page',
  apiId: 'section',
  displayName: 'Section',
  componentApiIds: ['Contributor', 'VideoBlock'],
});
```

*Source: [Hygraph Management SDK - Components Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#components)*

#### Remote Fields

- **GraphQL Type**: Custom type based on remote source
- **Management SDK**: `createRemoteField()`
- **Types**: GraphQL remote source, REST remote source
- **Use Case**: Fetch data from external APIs

*Source: [Hygraph Field Types - Remote Fields](https://hygraph.com/docs/api-reference/schema/field-types#remote-fields)*

##### Example: Create Remote Field (REST)

```typescript
// Create remote field
client.createRemoteField({
  environmentId: '<your-environment-id>',
  parentApiId: 'Product',
  apiId: 'externalReviews',
  displayName: 'External Reviews',
  description: 'Fetches reviews from external API',
  remoteSourceId: '<remote-source-id>',
  method: 'GET',
  path: '/api/reviews/product/{{doc.productId}}',
  returnType: 'ReviewMeta',
  inputArguments: [
    {
      apiId: 'productId',
      type: 'STRING',
      isRequired: true
    }
  ],
  visibility: 'READ_WRITE',
  isList: false,
  isLocalized: false,
  isRequired: false,
  isUnique: false,
  isHidden: false,
  position: 5
});
```

*Source: [Hygraph Management SDK - Remote Fields Example](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#remote-fields)*

---

## Field Configuration

*Source: [Hygraph Field Configuration Documentation](https://hygraph.com/docs/api-reference/schema/field-configuration)*

### Field Properties

Every field can have:

#### Basic Properties

- `apiId`: Field identifier (camelCase)
- `displayName`: Human-readable name
- `description`: Help text for editors
- `isRequired`: Required field validation
- `isUnique`: Unique constraint
- `isList`: Array/multiple values
- `isLocalized`: Multi-language support
- `isHidden`: Hidden from UI (but available in API)
- `isTitle`: Designates title field
- `isVariantEnabled`: Support for variants

*Source: [Hygraph Management SDK - Simple Fields](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#simple-fields)*

#### Visibility Options

- `Read/Write`: Default, editable in UI
- `Read Only`: Visible but not editable in UI
- `Hidden`: Not shown in UI, available in API
- `API Only`: Not in UI, API access only

*Source: [Hygraph Field Configuration - Visibility](https://hygraph.com/docs/api-reference/schema/field-configuration#visibility)*

#### Validations

- **String**: Regex patterns, length constraints
- **Number**: Range (min/max), whole number constraints
- **Date/DateTime**: Date range constraints

*Source: [Hygraph Field Configuration - Validations](https://hygraph.com/docs/api-reference/schema/field-configuration#validations)*

#### Renderers

- `formRenderer`: UI component for editing (e.g., "GCMS_SLUG")
- `tableRenderer`: UI component for table view
- `formConfig`: JSON configuration for form
- `tableConfig`: JSON configuration for table

*Source: [Hygraph Management SDK - Simple Fields](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#simple-fields)*

#### Advanced

- `embedsEnabled`: Enable embeds (for RichText)
- `embeddableModels`: Which models can be embedded
- `migrationValue`: Default value for existing entries
- `position`: Field order

*Source: [Hygraph Management SDK - Simple Fields](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#simple-fields)*

---

## Enumerations

*Source: [Hygraph Enumerations Documentation](https://hygraph.com/docs/api-reference/schema/enumerations)*

### Structure

Enumerations are:

1. **Created separately** via `createEnumeration()`
2. **Referenced** in fields via `EnumerableFieldType`

*Source: [Hygraph Enumerations Documentation](https://hygraph.com/docs/api-reference/schema/enumerations)*

### Example

```typescript
// Create enumeration
client.createEnumeration({
  apiId: "PostStatus",
  displayName: "Post Status",
  values: [
    { apiId: "draft", displayName: "Draft" },
    { apiId: "published", displayName: "Published" },
    { apiId: "archived", displayName: "Archived" }
  ]
});

// Use in field
client.createEnumerableField({
  parentApiId: "Post",
  apiId: "status",
  enumerationApiId: "PostStatus"
});
```

*Source: [Hygraph Management SDK - Enumerations](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#enumerations)*

### Mapping Strategy

Effect Schema doesn't have native enums in the same way. We'll need to:

- Use `Schema.Literal` union for enum-like behavior
- Detect `Schema.Union` of `Schema.Literal` values
- Generate enumeration creation + enumerable field

---

## Variants

*Source: [Hygraph Variants Documentation](https://hygraph.com/docs/api-reference/schema/variants)*

### Purpose

Variants allow A/B testing or multi-variant content (e.g., different versions for different audiences).

*Source: [Hygraph Variants Documentation](https://hygraph.com/docs/api-reference/schema/variants)*

### How It Works

- Models can have `isVariantEnabled: true` on fields
- Each entry can have multiple variants
- Variants are managed separately from main content

*Source: [Hygraph Variants Documentation](https://hygraph.com/docs/api-reference/schema/variants)*

### Implementation Note

**For Phase 1 (Simple Fields), we'll skip variants.** This is advanced functionality that can be added later.

---

## References vs Components

*Source: [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)*

### References

**Purpose**: Link to other content entries (relationships)

**Characteristics**:

- Separate entries in database
- Can be queried independently
- Supports one-way or two-way relationships
- GraphQL returns reference (ID or full object)

**Use Cases**:

- Author → Posts (one-to-many)
- Post → Category (many-to-one)
- Post ↔ Tags (many-to-many)

*Source: [Hygraph References Documentation](https://hygraph.com/docs/developer-guides/schema/references)*

**Management SDK**:

```typescript
client.createRelationalField({
  parentApiId: "Post",
  apiId: "author",
  type: RelationalFieldType.Relation,
  reverseField: {
    modelApiId: "Author",
    apiId: "posts",
    isList: true
  }
});
```

*Source: [Hygraph Management SDK - Relational Fields](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#relational-fields)*

### Components

**Purpose**: Reusable field groups (embedded data)

**Characteristics**:

- Embedded in parent entry
- Not queryable independently
- Data stored with parent
- GraphQL returns nested object

**Use Cases**:

- Address component (street, city, zip)
- SEO component (title, description, keywords)
- Reusable content blocks

*Source: [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)*

**Management SDK**:

```typescript
// Create component
client.createComponent({
  apiId: "Address",
  displayName: "Address"
});

// Add fields to component
client.createSimpleField({
  parentApiId: "Address",
  apiId: "street",
  type: SimpleFieldType.String
});

// Use component in model
client.createComponentField({
  parentApiId: "Post",
  apiId: "address",
  componentApiId: "Address"
});
```

*Source: [Hygraph Management SDK - Components](https://hygraph.com/docs/api-reference/management-sdk/management-sdk-field-examples#components)*

### Decision Guide

**Use Reference when**:

- Content can exist independently
- Need to query/reuse across multiple entries
- Relationship is "has a" (Post has an Author)

**Use Component when**:

- Data only makes sense within parent context
- Reusable field group
- Relationship is "contains" (Post contains Address)

*Source: [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)*

### Implementation Note

**For Phase 1, we'll focus on simple fields only.** References and Components will be Phase 2+.

---

## Mapping Strategy

### Effect Schema → Hygraph Simple Fields

| Effect Schema | Hygraph Type | Notes |
|---------------|--------------|-------|
| `Schema.String` | `SimpleFieldType.String` | Default: single line |
| `Schema.Number` | `SimpleFieldType.Float` | Use annotation for Int |
| `Schema.Boolean` | `SimpleFieldType.Boolean` | |
| `Schema.Date` | `SimpleFieldType.Date` | Date only |
| `Schema.Date` (with time) | `SimpleFieldType.Datetime` | Via annotation hint |
| `Schema.optional(T)` | `T` with `isRequired: false` | |
| `Schema.Array(T)` | `T` with `isList: true` | |
| `Schema.filter(T, fn)` | `T` with validations | Extract filter logic |

### Special Cases

#### Slug Fields

```typescript
Schema.String.pipe(
  hygraph({ 
    type: "Slug",
    formRenderer: "GCMS_SLUG",
    tableRenderer: "GCMS_SLUG"
  })
)
```

#### RichText Fields

```typescript
Schema.String.pipe(
  hygraph({ 
    type: "Richtext",
    embedsEnabled: true,
    embeddableModels: ["Author"]
  })
)
```

#### Integer vs Float

```typescript
// Float (default)
Schema.Number.pipe(hygraph({ type: "Float" }))

// Integer (via annotation)
Schema.Number.pipe(hygraph({ type: "Int" }))
```

### Field Metadata Extraction

1. **From Schema AST**: Extract base type, optionality, arrays
2. **From Annotations**: Extract Hygraph-specific metadata
3. **From Filters**: Extract validation logic
4. **Combine**: Merge all information into field definition

---

## Key Corrections to Plan

### 1. BaseHyGraphModel

**WRONG**: Including `name` and `description` as if they're system fields
**CORRECT**: Only `id`, `createdAt`, `updatedAt` are system fields. Others must be explicitly created.

*Source: [Hygraph System Fields](https://hygraph.com/docs/api-reference/schema/system-fields#default-model-fields)*

### 2. System Fields

**WRONG**: Creating system fields via Management SDK
**CORRECT**: System fields are automatic. We only create custom fields.

*Source: [Hygraph System Fields](https://hygraph.com/docs/api-reference/schema/system-fields#default-model-fields)*

### 3. Field Types

**WRONG**: Assuming all fields are simple
**CORRECT**: Many field types exist (String variants, RichText, JSON, Color, Location, etc.)

*Source: [Hygraph Field Types](https://hygraph.com/docs/api-reference/schema/field-types)*

### 4. Field Configuration

**WRONG**: Not accounting for all configuration options
**CORRECT**: Must support visibility, validations, renderers, embeds, etc.

*Source: [Hygraph Field Configuration](https://hygraph.com/docs/api-reference/schema/field-configuration)*

### 5. Enumerations

**WRONG**: Not mentioned in original plan
**CORRECT**: Enumerations are separate entities that must be created before use.

*Source: [Hygraph Enumerations](https://hygraph.com/docs/api-reference/schema/enumerations)*

### 6. References vs Components

**WRONG**: Not distinguishing between them
**CORRECT**: References are relationships, Components are embedded field groups.

*Source: [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)*

---

## Implementation Priorities

### Phase 1: Simple Fields (Current Focus)

1. ✅ String (single line, multi line, markdown, slug)
2. ✅ Number (Int, Float)
3. ✅ Boolean
4. ✅ Date, DateTime
5. ✅ Optional fields
6. ✅ Array fields
7. ✅ Basic validations from Schema.filter

### Phase 2: Advanced Simple Fields

1. RichText with embeds
2. JSON fields
3. Color fields
4. Location fields
5. Full validation support

### Phase 3: Complex Types

1. Enumerations
2. References (Relations)
3. Components
4. Union fields
5. Remote fields

---

## References

- [Hygraph Models Documentation](https://hygraph.com/docs/api-reference/schema/models)
- [Hygraph System Fields](https://hygraph.com/docs/api-reference/schema/system-fields)
- [Hygraph Field Types](https://hygraph.com/docs/api-reference/schema/field-types)
- [Hygraph Field Configuration](https://hygraph.com/docs/api-reference/schema/field-configuration)
- [Hygraph Enumerations](https://hygraph.com/docs/api-reference/schema/enumerations)
- [Hygraph Variants](https://hygraph.com/docs/api-reference/schema/variants)
- [Hygraph References](https://hygraph.com/docs/developer-guides/schema/references)
- [Hygraph Components vs References](https://hygraph.com/docs/developer-guides/schema/components-or-references)

---

## Field Type Coverage Checklist

This checklist ensures exhaustive coverage of all Hygraph field types in our ensure utilities.

### Simple Field Types (via `createSimpleField`)

- [x] **String** (`SimpleFieldType.String`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.String, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `String`
  - [x] Single line text (default)
  - [x] Multi line text
  - [x] Markdown variant
  - [x] Slug variant (with template support)
  - [x] Validation support (regex, length)
  - [x] Unique constraint
  - [x] Title field designation

- [x] **RichText** (`SimpleFieldType.Richtext`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Richtext, ... })`
  - **Read**: GraphQL query `{ model { fieldName { raw html markdown text json } } }` → returns `RichText` type
  - [x] Basic richtext field
  - [x] With embeds enabled
  - [x] With embeddable models specified

- [x] **Integer** (`SimpleFieldType.Int`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Int, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `Int`
  - [x] Basic integer field
  - [x] Range validation (min/max)
  - [x] Hidden visibility option

- [x] **Float** (`SimpleFieldType.Float`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Float, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `Float`
  - [x] Basic float field
  - [x] Range validation (min/max)

- [x] **Boolean** (`SimpleFieldType.Boolean`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Boolean, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `Boolean`
  - [x] Basic boolean field

- [x] **Date** (`SimpleFieldType.Date`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Date, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `Date` (ISO 8601 format: YYYY-MM-DD)
  - [x] Date-only field (ISO 8601)

- [x] **DateTime** (`SimpleFieldType.Datetime`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Datetime, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `DateTime` (ISO 8601 format)
  - [x] Full timestamp field (ISO 8601)
  - [x] List of date times (`isList: true`)

- [x] **JSON** (`SimpleFieldType.Json`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Json, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns `Json` (parsed JSON object)
  - [x] Basic JSON field

- [x] **Color** (`SimpleFieldType.Color`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Color, ... })`
  - **Read**: GraphQL query `{ model { fieldName { hex rgba { r g b a } css } } }` → returns `Color` type
  - [x] Basic color field (HEX, RGBA, CSS formats)

- [x] **Location** (`SimpleFieldType.Location`)
  - **Creation**: `client.createSimpleField({ type: SimpleFieldType.Location, ... })`
  - **Read**: GraphQL query `{ model { fieldName { latitude longitude distance(from: {...}) } } }` → returns `Location` type
  - [x] Basic location field (latitude, longitude, distance)

### Complex Field Types

- [x] **Asset** (via `createRelationalField` with `RelationalFieldType.Asset`)
  - **Creation**: `client.createRelationalField({ type: RelationalFieldType.Asset, ... })`
  - **Read**: GraphQL query `{ model { fieldName { url handle fileName height width size mimeType } } }` → returns `Asset` type
  - [x] Unidirectional asset field
  - [x] Bidirectional asset field
  - [x] Required asset field

- [x] **Relations** (via `createRelationalField` with `RelationalFieldType.Relation`)
  - **Creation**: `client.createRelationalField({ type: RelationalFieldType.Relation, ... })`
  - **Read**: GraphQL query `{ model { fieldName { id ...otherFields } } }` → returns referenced model type or `[Model]` for lists
  - [x] One-way references (unidirectional)
    - [x] To one
    - [x] To many
  - [x] Two-way references (bidirectional)
    - [x] One to one
    - [x] One to many
    - [x] Many to one
    - [x] Many to many

- [x] **Enumerations** (via `createEnumeration` + `createEnumerableField`)
  - **Creation**: 
    - Entity: `client.createEnumeration({ apiId, displayName, values: [...] })`
    - Field: `client.createEnumerableField({ enumerationApiId, ... })`
  - **Read**: GraphQL query `{ model { fieldName } }` → returns enum value (e.g., `"DRAFT"`, `"PUBLISHED"`)
  - [x] Enumeration entity creation
  - [x] Enumerable field creation
  - [x] Multiple enum values support

- [x] **Components** (via `createComponent` + `createComponentField`)
  - **Creation**:
    - Entity: `client.createComponent({ apiId, apiIdPlural, displayName })`
    - Field: `client.createComponentField({ componentApiId, ... })`
  - **Read**: GraphQL query `{ model { fieldName { nestedField1 nestedField2 } } }` → returns component type (nested object)
  - [x] Component entity creation
  - [x] Component field creation
  - [x] Nested component fields (component → component)

- [x] **Component Union Fields** (via `createComponentUnionField`)
  - **Creation**: `client.createComponentUnionField({ componentApiIds: [...], ... })`
  - **Read**: GraphQL query `{ model { fieldName { __typename ... on Component1 { ... } ... on Component2 { ... } } } }` → returns union type
  - [x] Component union field creation
  - [x] Multiple component types support
  - [x] Update to remove component types

- [x] **Union Fields** (via `createUnionField`)
  - **Creation**: `client.createUnionField({ reverseField: { modelApiIds: [...] }, ... })`
  - **Read**: GraphQL query `{ model { fieldName { __typename ... on Model1 { ... } ... on Model2 { ... } } } }` → returns union type
  - [x] Union field creation
  - [x] Multiple model types support
  - [x] Update to add/remove union members

- [x] **Remote Fields** (via `createRemoteField`)
  - **Creation**: `client.createRemoteField({ remoteSourceId, method, path, returnType, ... })`
  - **Read**: GraphQL query `{ model { fieldName { ...remoteTypeFields } } }` → returns custom remote type
  - [x] GraphQL remote field
  - [x] REST remote field
  - [x] Field variable casting (`{{!cast=<type>}}`)

### Not Yet Covered

- [ ] **Taxonomies** (via `createTaxonomy` + `createTaxonomyField`)
  - **Creation**:
    - Entity: `client.createTaxonomy({ apiId, displayName })`
    - Nodes: `client.createTaxonomyNode({ taxonomyApiId, parentApiId?, ... })`
    - Field: `client.createTaxonomyField({ taxonomyApiId, ... })`
  - **Read**: GraphQL query `{ model { fieldName { value { id name } path { id name } } } }` → returns taxonomy type with `value` and `path` array
  - [ ] Taxonomy entity creation
  - [ ] Taxonomy field creation
  - [ ] Hierarchical taxonomy nodes
  - [ ] Multiple taxonomy values support

### Implementation Status

**Ensure Utilities Implemented (21 total - Complete API Coverage):**

**Schema Operations (10):**
- ✅ `ensureModel` - Model creation (`createModel`)
- ✅ `ensureSimpleField` - All SimpleFieldType variants (`createSimpleField`)
- ✅ `ensureRelationalField` - Relations and Assets (`createRelationalField`)
- ✅ `ensureEnumeration` - Enumeration entities (`createEnumeration`)
- ✅ `ensureEnumerableField` - Enum fields (`createEnumerableField`)
- ✅ `ensureComponent` - Component entities (`createComponent`)
- ✅ `ensureComponentField` - Component fields (`createComponentField`)
- ✅ `ensureComponentUnionField` - Component union fields (`createComponentUnionField`)
- ✅ `ensureUnionField` - Union fields (`createUnionField`)
- ✅ `ensureRemoteField` - Remote fields (`createRemoteField`)

**Taxonomy Operations (3):**
- ✅ `ensureTaxonomy` - Taxonomy entity (`createTaxonomy`)
- ✅ `ensureTaxonomyNode` - Taxonomy node (`createTaxonomyNode`)
- ✅ `ensureTaxonomyField` - Taxonomy field (`createTaxonomyField`)

**Remote Source Operations (2):**
- ✅ `ensureGraphQLRemoteSource` - GraphQL remote source (`createGraphQLRemoteSource`)
- ✅ `ensureRESTRemoteSource` - REST remote source (`createRESTRemoteSource`)

**Infrastructure Operations (6):**
- ✅ `ensureStage` - Content stage (`createStage`)
- ✅ `ensureLocale` - Locale (`createLocale`)
- ✅ `ensureWebhook` - Webhook (`createWebhook`)
- ✅ `ensureWorkflow` - Workflow (`createWorkflow`)
- ✅ `ensureAppInstallation` - App installation (`createAppInstallation`)
- ✅ `ensureCustomSidebarElement` - Custom sidebar element (`createCustomSidebarElement`)

**Note**: All Management SDK Client create operations now have corresponding ensure utilities. Infrastructure operations (stages, locales, webhooks, workflows, app installations, custom sidebar elements) and remote sources use a "create and let Management SDK validate" approach since they're not queryable via Content API GraphQL introspection. Future improvements could use `getEnvironmentDiff` or Management API introspection for better existence checks.

## Missing Ensure Utilities Analysis

Based on `Client.js` analysis, all Management SDK operations follow this pattern:
1. Operations push to `scheduledMigrations` array (queued, not executed)
2. `dryRun()` returns the array without executing
3. `run(foreground?)` executes all queued migrations
4. `getEnvironmentDiff()` can compare environments and return migrations

**Missing Ensure Utilities (Schema-Related):**

The following schema-related operations still need ensure utilities. Based on `Client.js` analysis, all operations queue migrations to `scheduledMigrations` array and require `run()` to execute.

1. **Taxonomies** (3-step creation process):
   - [x] `ensureTaxonomy` - Taxonomy entity creation ✅ IMPLEMENTED
     - **Existence Check**: Taxonomies appear as GraphQL types - can use `__type(name: "TaxonomyApiId")` introspection
     - **Creation**: `client.createTaxonomy({ apiId, displayName })` → queues to `scheduledMigrations`
     - **Pattern**: Similar to `ensureModel` - check if taxonomy type exists in schema via GraphQL introspection
     - **Input Type**: `BatchMigrationCreateTaxonomyInput`
   
   - [x] `ensureTaxonomyNode` - Taxonomy node creation (hierarchical) ✅ IMPLEMENTED
     - **Existence Check**: Nodes are part of taxonomy structure - query taxonomy type to check for nodes
     - **Creation**: `client.createTaxonomyNode({ taxonomyApiId, parentApiId?, ... })` → queues to `scheduledMigrations`
     - **Dependency**: Taxonomy must exist first (use `ensureTaxonomy` first)
     - **Note**: Nodes can be created in batch via `createTaxonomy` with `taxonomyNodes` array (alternative approach)
     - **Input Type**: `BatchMigrationCreateTaxonomyNodeInput`
   
   - [x] `ensureTaxonomyField` - Taxonomy field creation ✅ IMPLEMENTED
     - **Existence Check**: Use `fieldExists` on parent model (same as other field types)
     - **Creation**: `client.createTaxonomyField({ taxonomyApiId, ... })` → queues to `scheduledMigrations`
     - **Dependency**: Taxonomy must exist first (use `ensureTaxonomy` first)
     - **Pattern**: Similar to `ensureEnumerableField` - field-level check + taxonomy dependency
     - **Input Type**: `BatchMigrationCreateTaxonomyFieldInput`
     - **Special**: Requires `initialValue` or `migrationValue` (JSON stringified apiId of taxonomy node)

2. **Remote Sources** (required before remote fields):
   - [x] `ensureGraphQLRemoteSource` - GraphQL remote source creation ✅ IMPLEMENTED
     - **Existence Check**: Remote sources are infrastructure-level - NOT queryable via Content API
     - **Challenge**: May require Management API introspection or `getEnvironmentDiff` approach
     - **Creation**: `client.createGraphQLRemoteSource({ prefix, introspectionUrl, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateGraphQlRemoteSourceInput`
     - **Note**: `prefix` cannot be changed after creation - must be unique
   
   - [x] `ensureRESTRemoteSource` - REST remote source creation ✅ IMPLEMENTED
     - **Existence Check**: Same challenge as GraphQL remote sources - infrastructure-level
     - **Creation**: `client.createRESTRemoteSource({ prefix, remoteTypeDefinitions, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateRestRemoteSourceInput`
     - **Note**: `prefix` cannot be changed after creation - must be unique

3. **Infrastructure Operations** (all require Management API access for existence checks):
   - [x] `ensureStage` - Content stage creation ✅ IMPLEMENTED
     - **Existence Check**: Stages are infrastructure-level - may require Management API
     - **Creation**: `client.createStage({ apiId, displayName, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateStageInput`
     - **Note**: Used for content workflows and publishing stages
   
   - [x] `ensureLocale` - Locale creation ✅ IMPLEMENTED
     - **Existence Check**: Locales are infrastructure-level - may require Management API
     - **Creation**: `client.createLocale({ code, displayName, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateLocaleInput`
     - **Note**: Required for multi-language content
   
   - [x] `ensureWebhook` - Webhook creation ✅ IMPLEMENTED
     - **Existence Check**: Webhooks are infrastructure-level - may require Management API
     - **Creation**: `client.createWebhook({ url, models, stages, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateWebhookInput`
     - **Note**: Pass empty arrays for `models`/`stages` to include all existing and future ones
   
   - [x] `ensureWorkflow` - Workflow creation ✅ IMPLEMENTED
     - **Existence Check**: Workflows are infrastructure-level - may require Management API
     - **Creation**: `client.createWorkflow({ apiId, displayName, steps, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateWorkflowInput`
     - **Note**: Steps are created in order provided (unless position specified)
   
   - [x] `ensureAppInstallation` - App installation creation ✅ IMPLEMENTED
     - **Existence Check**: App installations are infrastructure-level - may require Management API
     - **Creation**: `client.createAppInstallation({ appApiId, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateAppInstallationInput`
     - **Note**: App-specific functionality
   
   - [x] `ensureCustomSidebarElement` - Custom sidebar element creation ✅ IMPLEMENTED
     - **Existence Check**: Custom sidebar elements are infrastructure-level - may require Management API
     - **Creation**: `client.createCustomSidebarElement({ modelApiId, appApiId, appElementApiId, ... })` → queues to `scheduledMigrations`
     - **Input Type**: `BatchMigrationCreateCustomSidebarElementInput`
     - **Note**: App-specific UI customization

**Future Work (Utilities & Algorithms):**
- [ ] Dependency resolution/reordering algorithm for declarative field definitions
- [ ] Improved existence checks using `getEnvironmentDiff` + `dryRun` instead of GraphQL introspection
- [ ] Update utilities (`updateSimpleField`, `updateRelationalField`, etc.)
- [ ] Delete utilities (`deleteField`, `deleteModel`, etc.)

## Complete Management SDK CUD Operations Reference

This section documents all Create, Update, and Delete operations available in the Management SDK Client.

### Schema Operations

#### Models
- ✅ `createModel(data: CreateModelParams)` - Create a new model
- ⏳ `updateModel(data: UpdateModelParams)` - Update existing model
- ⏳ `deleteModel(data: DeleteModelParams)` - Delete a model

#### Components
- ✅ `createComponent(data: CreateComponentParams)` - Create a component entity
- ⏳ `updateComponent(data: UpdateComponentParams)` - Update component
- ⏳ `deleteComponent(data: DeleteComponentParams)` - Delete component

#### Enumerations
- ✅ `createEnumeration(data: CreateEnumerationParams)` - Create enumeration entity
- ⏳ `updateEnumeration(data: UpdateEnumerationParams)` - Update enumeration
- ⏳ `deleteEnumeration(data: DeleteEnumerationParams)` - Delete enumeration

#### Taxonomies
- ⏳ `createTaxonomy(data: CreateTaxonomyParams)` - Create taxonomy entity
- ⏳ `updateTaxonomy(data: UpdateTaxonomyParams)` - Update taxonomy
- ⏳ `deleteTaxonomy(data: DeleteTaxonomyParams)` - Delete taxonomy
- ⏳ `createTaxonomyNode(data: CreateTaxonomyNodeParams)` - Create taxonomy node
- ⏳ `updateTaxonomyNode(data: UpdateTaxonomyNodeParams)` - Update taxonomy node
- ⏳ `deleteTaxonomyNode(data: DeleteTaxonomyNodeParams)` - Delete taxonomy node
- **Ensure Utilities Needed**: `ensureTaxonomy`, `ensureTaxonomyNode`
- **Existence Check Strategy**: Taxonomies appear as GraphQL types - can use `__type(name: "TaxonomyApiId")` introspection
- **Input Types**: `BatchMigrationCreateTaxonomyInput`, `BatchMigrationCreateTaxonomyNodeInput`
- **Note**: Nodes can be created in batch via `createTaxonomy` with `taxonomyNodes` array (alternative approach)

### Field Operations

#### Simple Fields
- ✅ `createSimpleField(data: CreateSimpleFieldParams)` - Create simple field (String, Int, Float, Boolean, Date, DateTime, Json, Color, Location, RichText)
- ⏳ `updateSimpleField(data: UpdateSimpleFieldParams)` - Update simple field

#### Relational Fields
- ✅ `createRelationalField(data: CreateRelationalFieldParams)` - Create relational field (Asset, Relation)
- ⏳ `updateRelationalField(data: UpdateRelationalFieldParams)` - Update relational field

#### Enumerable Fields
- ✅ `createEnumerableField(data: CreateEnumerableFieldParams)` - Create enumerable field
- ⏳ `updateEnumerableField(data: UpdateEnumerableFieldParams)` - Update enumerable field

#### Component Fields
- ✅ `createComponentField(data: CreateComponentFieldParams)` - Create component field
- ⏳ `updateComponentField(data: UpdateComponentFieldParams)` - Update component field

#### Component Union Fields
- ✅ `createComponentUnionField(data: CreateComponentUnionFieldParams)` - Create component union field
- ⏳ `updateComponentUnionField(data: UpdateComponentUnionFieldParams)` - Update component union field

#### Union Fields
- ✅ `createUnionField(data: CreateUnionFieldParams)` - Create union field
- ⏳ `updateUnionField(data: UpdateUnionFieldParams)` - Update union field

#### Remote Fields
- ✅ `createRemoteField(data: CreateRemoteFieldParams)` - Create remote field (GraphQL or REST)
- ⏳ `updateRemoteField(data: UpdateRemoteFieldParams)` - Update remote field

#### Taxonomy Fields
- ⏳ `createTaxonomyField(data: CreateTaxonomyFieldParams)` - Create taxonomy field
- ⏳ `updateTaxonomyField(data: UpdateTaxonomyFieldParams)` - Update taxonomy field
- **Ensure Utility Needed**: `ensureTaxonomyField`
- **Existence Check Strategy**: Use `fieldExists` on parent model (same as other field types)
- **Input Type**: `BatchMigrationCreateTaxonomyFieldInput`
- **Dependency**: Taxonomy must exist first (use `ensureTaxonomy` first)
- **Special**: Requires `initialValue` or `migrationValue` (JSON stringified apiId of taxonomy node)

#### Generic Field Deletion
- ⏳ `deleteField(data: DeleteFieldParams)` - Delete any field type

### Remote Source Operations

**Note**: Remote sources are infrastructure-level and NOT queryable via Content API GraphQL introspection. Existence checks will likely need to use `getEnvironmentDiff` or Management API introspection.

#### GraphQL Remote Sources
- ⏳ `createGraphQLRemoteSource(data: CreateGraphQLRemoteSourceParams)` - Create GraphQL remote source
- ⏳ `updateGraphQLRemoteSource(data: UpdateGraphQLRemoteSourceParams)` - Update GraphQL remote source
- ⏳ `refreshGraphQLRemoteSourceSchema(data: RefreshGraphQLRemoteSourceSchemaParams)` - Refresh remote schema
- **Ensure Utility Needed**: `ensureGraphQLRemoteSource`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateGraphQlRemoteSourceInput`
- **Note**: `prefix` cannot be changed after creation - must be unique

#### REST Remote Sources
- ⏳ `createRESTRemoteSource(data: CreateRESTRemoteSourceParams)` - Create REST remote source
- ⏳ `updateRESTRemoteSource(data: UpdateRESTRemoteSourceParams)` - Update REST remote source
- ⏳ `deleteRemoteSource(data: DeleteRemoteSourceParams)` - Delete remote source (GraphQL or REST)
- **Ensure Utility Needed**: `ensureRESTRemoteSource`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateRestRemoteSourceInput`
- **Note**: `prefix` cannot be changed after creation - must be unique

### Infrastructure Operations

**Note**: All infrastructure operations require Management API access for existence checks. They are NOT queryable via Content API GraphQL introspection. Existence checks will likely need to use `getEnvironmentDiff` or Management API introspection.

#### Stages
- ⏳ `createStage(data: CreateStageParams)` - Create content stage
- ⏳ `updateStage(data: UpdateStageParams)` - Update stage
- ⏳ `deleteStage(data: DeleteStageParams)` - Delete stage
- **Ensure Utility Needed**: `ensureStage`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateStageInput`

#### Locales
- ⏳ `createLocale(data: CreateLocaleParams)` - Create locale
- ⏳ `updateLocale(data: UpdateLocaleParams)` - Update locale
- ⏳ `deleteLocale(data: DeleteLocaleParams)` - Delete locale
- **Ensure Utility Needed**: `ensureLocale`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateLocaleInput`

#### Webhooks
- ⏳ `createWebhook(data: CreateWebhookParams)` - Create webhook
- ⏳ `updateWebhook(data: UpdateWebhookParams)` - Update webhook
- ⏳ `deleteWebhook(data: DeleteWebhookParams)` - Delete webhook
- **Ensure Utility Needed**: `ensureWebhook`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateWebhookInput`
- **Special**: Empty `models`/`stages` arrays include all existing and future items

#### Workflows
- ⏳ `createWorkflow(data: CreateWorkflowParams)` - Create workflow
- ⏳ `updateWorkflow(data: UpdateWorkflowParams)` - Update workflow
- ⏳ `deleteWorkflow(data: DeleteWorkflowParams)` - Delete workflow
- **Ensure Utility Needed**: `ensureWorkflow`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateWorkflowInput`
- **Special**: Steps created in order provided (unless position specified)

#### App Installations
- ⏳ `createAppInstallation(data: CreateAppInstallationParams)` - Create app installation
- ⏳ `updateAppInstallation(data: UpdateAppInstallationParams)` - Update app installation
- ⏳ `deleteAppInstallation(data: DeleteAppInstallationParams)` - Delete app installation
- **Ensure Utility Needed**: `ensureAppInstallation`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateAppInstallationInput`
- **Note**: App-specific functionality

#### Custom Sidebar Elements
- ⏳ `createCustomSidebarElement(data: CreateCustomSidebarElementParams)` - Create custom sidebar element
- ⏳ `deleteCustomSidebarElement(data: DeleteCustomSidebarElementParams)` - Delete custom sidebar element
- **Ensure Utility Needed**: `ensureCustomSidebarElement`
- **Existence Check Strategy**: Management API introspection or `getEnvironmentDiff`
- **Input Type**: `BatchMigrationCreateCustomSidebarElementInput`
- **Note**: App-specific UI customization

### Migration Management Operations

- ✅ `run(foreground?: boolean): Promise<MigrationInfo>` - Execute all queued migrations
- ⏳ `dryRun(): Migrations[]` - Get migrations that would be sent (without executing)
- ⏳ `applySchemaChanges(data: Migrations[]): void` - Apply pre-computed migrations
- ⏳ `getEnvironmentDiff(targetEnvironment: string): Promise<Migrations[]>` - Get diff between environments

**Legend:**
- ✅ Implemented (ensure utilities exist)
- ⏳ Not yet implemented (future work)

---

**Last Updated**: Based on Hygraph documentation review and Management SDK source analysis
**Status**: Ready for implementation with corrected understanding

---

## Reserved Terms

Hygraph has reserved words that cannot be used as API IDs for fields, models, enumerations, or other schema elements. Attempting to use these will result in validation errors.

### Documentation

**Source**: [Hygraph Reserved Terms Documentation](https://hygraph.com/docs/developer-guides/schema/reserved-terms)

Hygraph organizes reserved terms into categories:
- **GraphQL type names**: Reserved GraphQL keywords and type names
- **Reserved non-system type names**: Type names that cannot be used for custom types
- **Reserved non-system field names**: Field names that cannot be used for custom fields

### Known Reserved Field Names

The following field names are known to be reserved (non-exhaustive list):

- `status` - Reserved non-system field name

### Validation Utility

A utility function `validateApiId()` is available in `hygraph-existence-utils.ts` to check if an API ID is reserved before attempting to create schema elements:

```typescript
import { validateApiId } from './hygraph-existence-utils';

// Validate before creating a field
validateApiId('status', 'field'); // Throws error: "status" is reserved
validateApiId('myStatus', 'field'); // OK - passes validation
```

### Best Practices

1. **Always validate API IDs** before creating schema elements to avoid runtime errors
2. **Use descriptive prefixes** for fields that might conflict (e.g., `yadaStatus` instead of `status`)
3. **Consult the official documentation** for the complete list: https://hygraph.com/docs/developer-guides/schema/reserved-terms
4. **Handle validation errors gracefully** - provide helpful error messages that reference the documentation

### Implementation Note

The `isReservedWord()` and `validateApiId()` functions in `hygraph-existence-utils.ts` maintain a list of known reserved words. This list may be incomplete - always refer to Hygraph's official documentation for the authoritative list.

---

## API ID Naming Requirements and Marshalling

Different Hygraph resources have specific naming requirements for their API IDs. The `hygraph-existence-utils.ts` module provides marshalling utilities to convert user-friendly names to valid Hygraph API IDs.

### Naming Requirements by Resource Type

| Resource Type | Requirements | Example |
|--------------|--------------|---------|
| **TaxonomyNode** | Must start with uppercase letter, alphanumeric + underscores only | `"tech"` → `"Tech"` |
| **Model** | PascalCase recommended | `"blog post"` → `"BlogPost"` |
| **Enumeration** | PascalCase recommended | `"post status"` → `"PostStatus"` |
| **Enumeration Value** | camelCase or UPPER_CASE | `"in active"` → `"inActive"` |
| **Component** | PascalCase recommended | `"address metadata"` → `"AddressMetadata"` |
| **Field** | camelCase recommended | `"post title"` → `"postTitle"` |
| **Stage** | lowercase recommended | `"Draft"` → `"draft"` |
| **Locale** | lowercase ISO codes | `"en-US"` → `"en-us"` |

### Marshalling Utilities

All marshalling utilities are available in `hygraph-existence-utils.ts`:

```typescript
import {
  marshalTaxonomyNodeApiId,
  marshalModelApiId,
  marshalEnumerationApiId,
  marshalComponentApiId,
  marshalFieldApiId,
  marshalEnumerationValueApiId,
  marshalStageApiId,
  marshalLocaleApiId,
} from './hygraph-existence-utils';

// TaxonomyNode: Must start with uppercase
const nodeId = marshalTaxonomyNodeApiId('tech'); // "Tech"
const nodeId2 = marshalTaxonomyNodeApiId('tech-category'); // "TechCategory"

// Model: PascalCase
const modelId = marshalModelApiId('blog post'); // "BlogPost"

// Enumeration: PascalCase
const enumId = marshalEnumerationApiId('post status'); // "PostStatus"

// Component: PascalCase
const componentId = marshalComponentApiId('address metadata'); // "AddressMetadata"

// Field: camelCase
const fieldId = marshalFieldApiId('post title'); // "postTitle"

// Enumeration Value: camelCase
const enumValueId = marshalEnumerationValueApiId('in active'); // "inActive"

// Stage: lowercase
const stageId = marshalStageApiId('Draft'); // "draft"

// Locale: lowercase ISO codes
const localeId = marshalLocaleApiId('en-US'); // "en-us"
```

### Best Practices

1. **Always use marshalling utilities** when creating schema elements to ensure compliance with Hygraph's naming requirements
2. **Use descriptive names** - the marshalling utilities will convert them to the correct format
3. **Be consistent** - use the same naming convention throughout your codebase
4. **Validate after marshalling** - consider calling `validateApiId()` after marshalling to check for reserved words

### Example Usage

```typescript
// Create a taxonomy node with proper API ID formatting
const nodeApiId = marshalTaxonomyNodeApiId('tech'); // "Tech"
const nodeParams: BatchMigrationCreateTaxonomyNodeInput = {
  taxonomyApiId: 'Category',
  apiId: nodeApiId, // Uses marshalled value
  displayName: 'Technology',
};

// Create a taxonomy field that references the node
const taxonomyFieldParams: BatchMigrationCreateTaxonomyFieldInput = {
  parentApiId: 'Post',
  apiId: marshalFieldApiId('category'), // "category" (already camelCase)
  displayName: 'Category',
  taxonomyApiId: 'Category',
  initialValue: JSON.stringify(nodeApiId), // Must match marshalled node API ID
};
```

