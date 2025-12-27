/**
 * Document Completion Provider
 *
 * Provides document completions for the minibuffer system.
 * Searches recent documents from localStorage registry.
 *
 * @module editor/v3/providers/DocumentProvider
 */

import { Effect } from 'effect';
import {
  createProviderId,
  providerRegistry,
  type CompletionProvider,
  type Completion,
} from '@/lib/minibuffer/v2';
import { FileText } from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

export const DOCUMENT_PROVIDER_ID = createProviderId('documents');

const STORAGE_KEY_RECENT_DOCS = 'tmnl:collab:recentDocs';

// ============================================================================
// TYPES
// ============================================================================

interface RecentDoc {
  docId: string;
  petName: string;
  lastAccessed: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function loadRecentDocs(): RecentDoc[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_RECENT_DOCS);
    if (!stored) return [];
    return JSON.parse(stored) as RecentDoc[];
  } catch {
    return [];
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

// ============================================================================
// PROVIDER CALLBACKS
// ============================================================================

/**
 * Callback when a document is selected.
 * Set this before opening the document picker.
 */
let onDocumentSelect: ((docId: string, petName: string) => void) | null = null;

/**
 * Set the callback for document selection.
 */
export function setDocumentSelectCallback(
  callback: (docId: string, petName: string) => void
): void {
  onDocumentSelect = callback;
}

/**
 * Clear the document selection callback.
 */
export function clearDocumentSelectCallback(): void {
  onDocumentSelect = null;
}

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * Document completion provider.
 * Searches recent documents by petName and docId.
 */
export const documentProvider: CompletionProvider = {
  id: DOCUMENT_PROVIDER_ID,
  label: 'Documents',
  icon: FileText,
  placeholder: 'Search documents or enter ID...',

  complete: (
    query: string
  ): Effect.Effect<readonly Completion[], never, never> =>
    Effect.sync(() => {
      const recentDocs = loadRecentDocs();
      const q = query.toLowerCase().trim();

      // Filter by query
      const filtered = q
        ? recentDocs.filter(
            (doc) =>
              doc.petName.toLowerCase().includes(q) ||
              doc.docId.toLowerCase().includes(q)
          )
        : recentDocs;

      // Sort by most recent first
      const sorted = [...filtered].sort(
        (a, b) => b.lastAccessed - a.lastAccessed
      );

      // Convert to completions
      const completions: Completion[] = sorted.map((doc) => ({
        value: doc.docId,
        label: doc.petName,
        description: `${doc.docId.slice(-12)} · ${formatTimeAgo(
          doc.lastAccessed
        )}`,
        category: 'Recent Documents',
      }));

      // If query looks like a doc ID (and not found in recents), offer to connect
      if (q && q.length > 4 && !filtered.some((d) => d.docId === q)) {
        completions.push({
          value: `new:${q}`,
          label: `Connect to "${q}"`,
          description: 'Connect to document by ID',
          category: 'Actions',
        });
      }

      // Always offer "new document" action
      completions.push({
        value: 'new:',
        label: 'Create new document',
        description: 'Start a fresh collaborative document',
        category: 'Actions',
      });

      return completions;
    }),

  onSelect: (completion: Completion): Effect.Effect<void, never, never> =>
    Effect.sync(() => {
      if (!onDocumentSelect) {
        console.warn('[DocumentProvider] No onSelect callback registered');
        return;
      }

      const { value } = completion;

      if (value === 'new:') {
        // Create new document
        const newDocId = `testbed-${Date.now()}`;
        const newPetName = generatePetName();
        onDocumentSelect(newDocId, newPetName);
      } else if (value.startsWith('new:')) {
        // Connect to specific ID
        const docId = value.slice(4);
        const petName = generatePetName();
        onDocumentSelect(docId, petName);
      } else {
        // Connect to existing doc
        const recentDocs = loadRecentDocs();
        const doc = recentDocs.find((d) => d.docId === value);
        if (doc) {
          onDocumentSelect(doc.docId, doc.petName);
        } else {
          // Fallback: use value as docId
          onDocumentSelect(value, generatePetName());
        }
      }
    }),
};

// ============================================================================
// PET NAME GENERATOR
// ============================================================================

const ADJECTIVES = [
  'swift',
  'calm',
  'bold',
  'bright',
  'deep',
  'quick',
  'warm',
  'cool',
  'sharp',
  'soft',
];

const NOUNS = [
  'fox',
  'owl',
  'river',
  'peak',
  'wave',
  'spark',
  'cloud',
  'stone',
  'leaf',
  'wind',
];

function generatePetName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register the document provider with the minibuffer.
 * Call this once at app initialization.
 */
export function registerDocumentProvider(): void {
  providerRegistry.register(documentProvider);
}

/**
 * Unregister the document provider.
 */
export function unregisterDocumentProvider(): void {
  providerRegistry.unregister(DOCUMENT_PROVIDER_ID);
}
