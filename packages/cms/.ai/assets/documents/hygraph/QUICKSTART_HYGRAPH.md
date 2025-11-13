# Quick Start: Hygraph + NX Experiments

Get started with Hygraph in your NX workspace in 5 minutes!

---

## ⚡ TL;DR

```bash
# 1. Generate experiment
nx generate @nx/next:app hygraph-cms --directory=experiments

# 2. Install dependencies
cd experiments/hygraph-cms
pnpm add graphql-request graphql

# 3. Create .env.local
echo "NEXT_PUBLIC_HYGRAPH_ENDPOINT=<your-hygraph-endpoint>" > .env.local

# 4. Start coding!
nx serve experiments-hygraph-cms
```

---

## Step-by-Step Setup

### 1️⃣ Get Your Hygraph Credentials

1. Sign up at https://hygraph.com
2. Create a new project
3. Go to **Settings → API Access**
4. Copy your **Content API** endpoint (looks like: `https://us-west-2.cdn.hygraph.com/content/...`)

### 2️⃣ Create Your Experiment App

```bash
# From workspace root
nx generate @nx/next:app hygraph-cms --directory=experiments
```

### 3️⃣ Set Up Environment

```bash
cd experiments/hygraph-cms

# Create env file
cat > .env.local << EOF
NEXT_PUBLIC_HYGRAPH_ENDPOINT=https://us-west-2.cdn.hygraph.com/content/YOUR_PROJECT_ID/master
HYGRAPH_TOKEN=optional_auth_token_here
EOF

# Install dependencies
pnpm add graphql-request graphql
```

### 4️⃣ Create a Hygraph Client

Create `experiments/hygraph-cms/lib/hygraph.ts`:

```typescript
import { GraphQLClient } from 'graphql-request';

const endpoint = process.env.NEXT_PUBLIC_HYGRAPH_ENDPOINT;

if (!endpoint) {
  throw new Error('NEXT_PUBLIC_HYGRAPH_ENDPOINT is not set');
}

export const hygraphClient = new GraphQLClient(endpoint);

export async function hygraphQuery<T>(query: string, variables?: any): Promise<T> {
  return hygraphClient.request<T>(query, variables);
}
```

### 5️⃣ Fetch Data in a Component

Create `experiments/hygraph-cms/app/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { gql } from 'graphql-request';
import { hygraphQuery } from '@/lib/hygraph';

const QUERY = gql`
  query {
    posts {
      id
      title
      slug
      content
    }
  }
`;

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hygraphQuery(QUERY).then((data: any) => {
      setPosts(data.posts);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {posts.map((post: any) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

### 6️⃣ Run It!

```bash
nx serve experiments-hygraph-cms
# Opens on http://localhost:4200
```

---

## Common Tasks

### Query Content

```typescript
import { gql } from 'graphql-request';
import { hygraphClient } from '@/lib/hygraph';

const query = gql`
  query GetPosts($limit: Int) {
    posts(first: $limit) {
      id
      title
      publishedAt
    }
  }
`;

const data = await hygraphClient.request(query, { limit: 10 });
```

### Create Content (with token)

```typescript
const mutation = gql`
  mutation CreatePost($title: String!) {
    createPost(data: { title: $title }) {
      id
      title
    }
  }
`;

const data = await hygraphClient.request(mutation, { title: 'My Post' });
```

### Use in Server Components (Next.js 13+)

```typescript
import { hygraphQuery } from '@/lib/hygraph';
import { gql } from 'graphql-request';

const QUERY = gql`query { posts { id title } }`;

export default async function BlogPage() {
  const data = await hygraphQuery(QUERY);
  
  return (
    <div>
      {data.posts.map((post: any) => (
        <h2 key={post.id}>{post.title}</h2>
      ))}
    </div>
  );
}
```

---

## Useful Resources

| Resource | Link |
|----------|------|
| Hygraph Docs | https://hygraph.com/docs |
| GraphQL Request | https://github.com/prisma-labs/graphql-request |
| Content API | https://hygraph.com/docs/api-reference/content-api |
| Examples | https://github.com/hygraph/hygraph-examples |

---

## Troubleshooting

### ❌ "NEXT_PUBLIC_HYGRAPH_ENDPOINT is not set"

Make sure `.env.local` exists in `experiments/hygraph-cms/` with your endpoint:

```bash
ls experiments/hygraph-cms/.env.local
cat experiments/hygraph-cms/.env.local
```

### ❌ "Project not found" error

Check your endpoint URL is correct. Should be:
```
https://<region>.cdn.hygraph.com/content/<project-id>/<stage>
```

### ❌ Empty query results

Verify you have content published in your Hygraph project:
1. Go to Hygraph dashboard
2. Create a content model (e.g., Post)
3. Add some entries
4. **Publish them** (IMPORTANT!)
5. Query should now return data

---

## Next Steps

- ✅ Set up Hygraph
- ✅ Create experiment app
- ✅ Connect to Hygraph
- 🔄 Build your features!
- 📦 Move to production when ready

---

## Need Help?

- Check `HYGRAPH_SETUP.md` for comprehensive guide
- Check `experiments/README.md` for experiments guidelines
- See `SETUP_SUMMARY.md` for what was fixed

---

**You're ready! 🚀 Start building with Hygraph!**

