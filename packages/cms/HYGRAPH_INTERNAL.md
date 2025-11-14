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

**Last Updated**: Based on Hygraph documentation review
**Status**: Ready for implementation with corrected understanding

