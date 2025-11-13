# Hygraph CMS Setup Guide

## Overview

This guide documents the setup of Hygraph (formerly GraphCMS) integration in your GBG NX workspace within the `experiments` directory.

## What We Fixed

### Issue: Submodules Interference with NX

**Problem:** The workspace has many submodules in `/submodules` that were interfering with NX project discovery and generation commands, causing slowdowns and conflicts.

**Solution:** We implemented multi-layered exclusions:

1. **`.nxignore` file** - Tells NX which directories to completely ignore during project discovery
2. **Plugin-level exclusions in `nx.json`** - Each plugin now explicitly excludes `submodules/**`, `receipts/**`, and `node_modules/**`
3. **`tsconfig.base.json` updates** - Added `submodules` and `receipts` to the TypeScript exclude patterns

**Files Modified:**
- `.nxignore` (created)
- `nx.json` (updated all plugins with exclude patterns)
- `tsconfig.base.json` (added exclusions)

## Now NX Commands Will Work Properly

You can now safely use NX generators and commands without interference:

```bash
# Generate new apps/libs in the experiments directory
nx generate @nx/next:app hygraph-cms --directory=experiments

# Run NX commands
nx build hygraph-cms
nx serve hygraph-cms
nx lint hygraph-cms
```

## Hygraph Integration

### Prerequisites

Before setting up Hygraph integration, you'll need:

1. **Hygraph Account** - Sign up at https://hygraph.com
2. **Hygraph Project** - Create a new project in your Hygraph workspace
3. **API Endpoint** - Copy your Content API endpoint from Hygraph project settings

### Setting Up a Hygraph Experiment

#### Step 1: Generate the Experiment App

```bash
# From the workspace root
nx generate @nx/next:app hygraph-cms --directory=experiments
```

#### Step 2: Configure Environment Variables

Create `.env.local` in your new experiment app:

```bash
# experiments/hygraph-cms/.env.local
NEXT_PUBLIC_HYGRAPH_ENDPOINT=https://<region>.cdn.hygraph.com/content/<project-id>/<stage>
HYGRAPH_TOKEN=<optional-auth-token>
```

#### Step 3: Install Dependencies

```bash
cd experiments/hygraph-cms
npm install graphql-request graphql
# or
pnpm add graphql-request graphql
```

#### Step 4: Use the Hygraph MCP Client

The Hygraph MCP (Model Context Protocol) provides direct access to your Hygraph content. Available operations:

- `mcp_hygraph_list_entity_types` - Discover all content models in your project
- `mcp_hygraph_discover_entities` - Find sample entities across types
- `mcp_hygraph_get_entities_by_id` - Fetch specific entities
- `mcp_hygraph_list_entities` - List entities of a specific type
- `mcp_hygraph_search_content` - Search content globally
- `mcp_hygraph_create_entry` - Create new content
- `mcp_hygraph_update_entry` - Modify existing content
- `mcp_hygraph_publish_entry` - Publish content

**Note:** The Hygraph MCP requires authentication via environment variables. Ensure your Hygraph credentials are properly configured in your environment.

### Example: Fetch Data from Hygraph

#### Using graphql-request (JavaScript/TypeScript):

```typescript
import { GraphQLClient, gql } from 'graphql-request';

const endpoint = process.env.NEXT_PUBLIC_HYGRAPH_ENDPOINT!;
const client = new GraphQLClient(endpoint);

const query = gql`
  query GetPosts {
    posts {
      id
      title
      slug
      content
      publishedAt
    }
  }
`;

export async function getPosts() {
  const data = await client.request(query);
  return data.posts;
}
```

#### In a Next.js Server Component:

```typescript
import { getPosts } from '@/lib/hygraph';

export default async function Blog() {
  const posts = await getPosts();
  
  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}
```

## Project Structure

```
experiments/
├── hygraph-cms/              # Your Hygraph experiment app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── hygraph.ts     # Hygraph client setup
│   │   │   └── queries/       # GraphQL queries
│   │   ├── app/
│   │   └── components/
│   ├── .env.local            # Environment variables (local)
│   ├── project.json          # NX project configuration
│   └── package.json
```

## Using the Hygraph MCP

The Hygraph MCP allows direct programmatic access to your content without needing to manually write GraphQL queries:

### Authentication

The MCP uses environment variables for authentication:

```bash
HYGRAPH_ENDPOINT=https://<region>.cdn.hygraph.com/content/<project-id>/<stage>
HYGRAPH_TOKEN=<your-auth-token>  # Optional, for mutations
```

### Common Tasks

#### Discover Your Content Schema

```javascript
// Discover available entity types and sample data
const entities = await hygraph_discover_entities({
  limit_per_type: 3,
  stage: 'PUBLISHED'
});
```

#### Search Global Content

```javascript
// Find all content matching a search term
const results = await hygraph_search_content({
  term: 'react',
  first: 20
});
```

#### Fetch Specific Entities

```javascript
// Get entities by their IDs
const entities = await hygraph_get_entities_by_id({
  items: [
    { id: 'post-123', typename: 'Post' },
    { id: 'author-456', typename: 'Author' }
  ]
});
```

## Troubleshooting

### NX Project Discovery Issues

If NX still picks up submodule projects:

1. Clear NX cache: `nx reset`
2. Verify `.nxignore` is at workspace root
3. Check `nx.json` plugin excludes are in place
4. Run: `nx list` to see only workspace projects

### Hygraph Connection Issues

- Verify `HYGRAPH_ENDPOINT` is correct
- Check network access to Hygraph CDN
- Ensure API token has required permissions
- Check Hygraph project is in the correct stage (DRAFT/PUBLISHED)

## Resources

- [Hygraph Documentation](https://hygraph.com/docs)
- [Hygraph API Reference](https://hygraph.com/docs/developers/api-reference)
- [graphql-request Library](https://github.com/prisma-labs/graphql-request)
- [Hygraph Examples](https://github.com/hygraph/hygraph-examples)

## Next Steps

1. ✅ Fixed NX configuration (done)
2. Generate your first Hygraph experiment app
3. Set up your Hygraph project and get credentials
4. Create your content models in Hygraph
5. Connect and fetch data in your app
6. Build amazing experiences with Hygraph!

