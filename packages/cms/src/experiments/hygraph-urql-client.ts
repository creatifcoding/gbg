import { Client, cacheExchange, fetchExchange } from 'urql';
import 'dotenv/config';

/**
 * Hygraph Content API urql Client
 * 
 * This client is used for read-only queries against the Hygraph Content API
 * to check schema existence via GraphQL introspection.
 * 
 * Required environment variables:
 * - HYGRAPH_CONTENT_ENDPOINT: The Content API endpoint (e.g., https://<region>.cdn.hygraph.com/content/<project-id>/<stage>)
 * - HYGRAPH_CONTENT_TOKEN: Optional auth token for authenticated queries
 */
const endpoint = process.env['HYGRAPH_CONTENT_ENDPOINT'];
const token = process.env['HYGRAPH_CONTENT_TOKEN'];

if (!endpoint) {
  throw new Error('HYGRAPH_CONTENT_ENDPOINT must be set');
}

export const hygraphContentClient = new Client({
  url: endpoint,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => ({
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }),
});

