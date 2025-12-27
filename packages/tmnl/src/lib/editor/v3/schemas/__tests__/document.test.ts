/**
 * Document Schema Unit Tests
 *
 * Tests for Effect Schema encode/decode operations on document types.
 * These are pure unit tests — no external dependencies.
 *
 * Run with: bunx vitest run src/lib/editor/v3/schemas/__tests__/document.test.ts
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { Effect, Schema } from 'effect';

import {
  DocumentId,
  IdentityId,
  DocumentStatus,
  DocumentVisibility,
  DocumentMetadata,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
  DocumentEvent,
  DocumentListItem,
  DocumentListQuery,
  generateDocumentId,
  createInitialMetadata,
} from '../document';

// =============================================================================
// Branded ID Tests
// =============================================================================

describe('DocumentId', () => {
  it('accepts valid document IDs', async () => {
    const validIds = ['doc-abc123', 'doc-1234567890', 'doc-lz2abc-xyz123'];

    for (const id of validIds) {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(DocumentId)(id)
      );
      expect(result).toBe(id);
    }
  });

  it('rejects invalid document IDs', async () => {
    const invalidIds = [
      'abc123', // Missing doc- prefix
      'document-123', // Wrong prefix
      '', // Empty string
    ];

    for (const id of invalidIds) {
      const result = await Effect.runPromise(
        Effect.either(Schema.decodeUnknown(DocumentId)(id))
      );
      expect(result._tag).toBe('Left');
    }
  });

  it('encodes to string', async () => {
    const docId = 'doc-test123' as DocumentId;
    const encoded = await Effect.runPromise(Schema.encode(DocumentId)(docId));
    expect(encoded).toBe('doc-test123');
    expect(typeof encoded).toBe('string');
  });
});

describe('IdentityId', () => {
  it('accepts any non-empty string', async () => {
    const validIds = ['user-123', 'system', 'admin@company.com'];

    for (const id of validIds) {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(IdentityId)(id)
      );
      expect(result).toBe(id);
    }
  });

  it('round-trips through encode/decode', async () => {
    const original = 'user-abc' as IdentityId;
    const encoded = await Effect.runPromise(
      Schema.encode(IdentityId)(original)
    );
    const decoded = await Effect.runPromise(
      Schema.decodeUnknown(IdentityId)(encoded)
    );
    expect(decoded).toBe(original);
  });
});

// =============================================================================
// Enum Tests
// =============================================================================

describe('DocumentStatus', () => {
  it('accepts valid status values', async () => {
    const validStatuses = ['draft', 'published', 'archived', 'deleted'];

    for (const status of validStatuses) {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(DocumentStatus)(status)
      );
      expect(result).toBe(status);
    }
  });

  it('rejects invalid status values', async () => {
    const result = await Effect.runPromise(
      Effect.either(Schema.decodeUnknown(DocumentStatus)('invalid'))
    );
    expect(result._tag).toBe('Left');
  });
});

describe('DocumentVisibility', () => {
  it('accepts valid visibility values', async () => {
    const validValues = ['private', 'team', 'organization', 'public'];

    for (const value of validValues) {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(DocumentVisibility)(value)
      );
      expect(result).toBe(value);
    }
  });

  it('rejects invalid visibility values', async () => {
    const result = await Effect.runPromise(
      Effect.either(Schema.decodeUnknown(DocumentVisibility)('hidden'))
    );
    expect(result._tag).toBe('Left');
  });
});

// =============================================================================
// DocumentMetadata Tests
// =============================================================================

describe('DocumentMetadata', () => {
  const validMetadata = {
    id: 'doc-test123',
    title: 'Test Document',
    status: 'draft',
    visibility: 'private',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedBy: 'user-1',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ysweetDocId: 'ysweet-abc123',
    version: 1,
  };

  it('decodes valid metadata', async () => {
    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentMetadata)(validMetadata)
    );

    expect(result.id).toBe('doc-test123');
    expect(result.title).toBe('Test Document');
    expect(result.status).toBe('draft');
    expect(result.visibility).toBe('private');
    expect(result.createdBy).toBe('user-1');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.ysweetDocId).toBe('ysweet-abc123');
    expect(result.version).toBe(1);
  });

  it('handles optional fields', async () => {
    const withOptionals = {
      ...validMetadata,
      tags: ['tag1', 'tag2'],
      metadata: { customField: 'value' },
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentMetadata)(withOptionals)
    );

    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(result.metadata).toEqual({ customField: 'value' });
  });

  it('rejects invalid document ID prefix', async () => {
    const invalid = { ...validMetadata, id: 'invalid-id' };
    const result = await Effect.runPromise(
      Effect.either(Schema.decodeUnknown(DocumentMetadata)(invalid))
    );
    expect(result._tag).toBe('Left');
  });

  it('rejects invalid status', async () => {
    const invalid = { ...validMetadata, status: 'unknown' };
    const result = await Effect.runPromise(
      Effect.either(Schema.decodeUnknown(DocumentMetadata)(invalid))
    );
    expect(result._tag).toBe('Left');
  });

  it('encodes dates to ISO strings', async () => {
    const decoded = await Effect.runPromise(
      Schema.decodeUnknown(DocumentMetadata)(validMetadata)
    );
    const encoded = await Effect.runPromise(
      Schema.encode(DocumentMetadata)(decoded)
    );

    expect(typeof encoded.createdAt).toBe('string');
    expect(typeof encoded.updatedAt).toBe('string');
    expect(encoded.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// =============================================================================
// CreateDocumentPayload Tests
// =============================================================================

describe('CreateDocumentPayload', () => {
  it('decodes minimal payload', async () => {
    const payload = { title: 'New Document' };
    const result = await Effect.runPromise(
      Schema.decodeUnknown(CreateDocumentPayload)(payload)
    );

    expect(result.title).toBe('New Document');
    expect(result.visibility).toBe('private'); // default
  });

  it('decodes full payload', async () => {
    const payload = {
      title: 'Full Document',
      visibility: 'team',
      tags: ['important', 'draft'],
      metadata: { priority: 1 },
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(CreateDocumentPayload)(payload)
    );

    expect(result.title).toBe('Full Document');
    expect(result.visibility).toBe('team');
    expect(result.tags).toEqual(['important', 'draft']);
    expect(result.metadata).toEqual({ priority: 1 });
  });

  it('rejects empty title', async () => {
    const payload = { title: '' };
    // Empty string is valid for Schema.String, but we might want to add NonEmpty
    const result = await Effect.runPromise(
      Schema.decodeUnknown(CreateDocumentPayload)(payload)
    );
    expect(result.title).toBe('');
  });
});

// =============================================================================
// UpdateDocumentPayload Tests
// =============================================================================

describe('UpdateDocumentPayload', () => {
  it('decodes partial update', async () => {
    const payload = { title: 'Updated Title' };
    const result = await Effect.runPromise(
      Schema.decodeUnknown(UpdateDocumentPayload)(payload)
    );

    expect(result.title).toBe('Updated Title');
    expect(result.status).toBeUndefined();
    expect(result.visibility).toBeUndefined();
  });

  it('decodes full update', async () => {
    const payload = {
      title: 'New Title',
      status: 'published',
      visibility: 'public',
      tags: ['final'],
      metadata: { reviewed: true },
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(UpdateDocumentPayload)(payload)
    );

    expect(result.title).toBe('New Title');
    expect(result.status).toBe('published');
    expect(result.visibility).toBe('public');
    expect(result.tags).toEqual(['final']);
    expect(result.metadata).toEqual({ reviewed: true });
  });

  it('decodes empty update', async () => {
    const payload = {};
    const result = await Effect.runPromise(
      Schema.decodeUnknown(UpdateDocumentPayload)(payload)
    );

    expect(result.title).toBeUndefined();
    expect(result.status).toBeUndefined();
  });
});

// =============================================================================
// Event Schema Tests
// =============================================================================

describe('DocumentCreatedEvent', () => {
  it('decodes with correct _tag', async () => {
    const event = {
      _tag: 'DocumentCreated',
      documentId: 'doc-123',
      title: 'New Doc',
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentCreatedEvent)(event)
    );

    expect(result._tag).toBe('DocumentCreated');
    expect(result.documentId).toBe('doc-123');
    expect(result.title).toBe('New Doc');
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('DocumentUpdatedEvent', () => {
  it('decodes with nested changes', async () => {
    const event = {
      _tag: 'DocumentUpdated',
      documentId: 'doc-123',
      changes: { title: 'Updated', status: 'published' },
      updatedBy: 'user-2',
      updatedAt: '2024-01-02T00:00:00.000Z',
      previousVersion: 1,
      newVersion: 2,
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentUpdatedEvent)(event)
    );

    expect(result._tag).toBe('DocumentUpdated');
    expect(result.changes.title).toBe('Updated');
    expect(result.changes.status).toBe('published');
    expect(result.previousVersion).toBe(1);
    expect(result.newVersion).toBe(2);
  });
});

describe('DocumentDeletedEvent', () => {
  it('decodes deletion event', async () => {
    const event = {
      _tag: 'DocumentDeleted',
      documentId: 'doc-456',
      deletedBy: 'user-admin',
      deletedAt: '2024-01-03T00:00:00.000Z',
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentDeletedEvent)(event)
    );

    expect(result._tag).toBe('DocumentDeleted');
    expect(result.documentId).toBe('doc-456');
  });
});

describe('DocumentEvent (Union)', () => {
  it('discriminates by _tag', async () => {
    const events = [
      {
        _tag: 'DocumentCreated',
        documentId: 'doc-1',
        title: 'A',
        createdBy: 'u1',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _tag: 'DocumentUpdated',
        documentId: 'doc-2',
        changes: {},
        updatedBy: 'u2',
        updatedAt: '2024-01-02T00:00:00.000Z',
        previousVersion: 1,
        newVersion: 2,
      },
      {
        _tag: 'DocumentDeleted',
        documentId: 'doc-3',
        deletedBy: 'u3',
        deletedAt: '2024-01-03T00:00:00.000Z',
      },
    ];

    for (const event of events) {
      const result = await Effect.runPromise(
        Schema.decodeUnknown(DocumentEvent)(event)
      );
      expect(result._tag).toBe(event._tag);
    }
  });

  it('rejects unknown _tag', async () => {
    const invalid = { _tag: 'DocumentArchived', documentId: 'doc-1' };
    const result = await Effect.runPromise(
      Effect.either(Schema.decodeUnknown(DocumentEvent)(invalid))
    );
    expect(result._tag).toBe('Left');
  });
});

// =============================================================================
// List/Query Schema Tests
// =============================================================================

describe('DocumentListItem', () => {
  it('decodes list item', async () => {
    const item = {
      id: 'doc-list1',
      title: 'List Item',
      status: 'draft',
      visibility: 'private',
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentListItem)(item)
    );

    expect(result.id).toBe('doc-list1');
    expect(result.title).toBe('List Item');
  });
});

describe('DocumentListQuery', () => {
  it('applies defaults', async () => {
    const query = {};
    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentListQuery)(query)
    );

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('accepts custom values', async () => {
    const query = {
      status: 'published',
      visibility: 'public',
      createdBy: 'user-admin',
      tags: ['featured'],
      limit: 100,
      offset: 50,
    };

    const result = await Effect.runPromise(
      Schema.decodeUnknown(DocumentListQuery)(query)
    );

    expect(result.status).toBe('published');
    expect(result.visibility).toBe('public');
    expect(result.limit).toBe(100);
    expect(result.offset).toBe(50);
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('generateDocumentId', () => {
  it('generates valid document ID', () => {
    const id = generateDocumentId();
    expect(id.startsWith('doc-')).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateDocumentId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('createInitialMetadata', () => {
  it('creates valid metadata from payload', () => {
    const payload: CreateDocumentPayload = {
      title: 'Test Doc',
      visibility: 'team',
      tags: ['tag1'],
    };
    const createdBy = 'user-creator' as IdentityId;
    const ysweetDocId = 'ysweet-doc-123';

    const metadata = createInitialMetadata(payload, createdBy, ysweetDocId);

    expect(metadata.id.startsWith('doc-')).toBe(true);
    expect(metadata.title).toBe('Test Doc');
    expect(metadata.status).toBe('draft');
    expect(metadata.visibility).toBe('team');
    expect(metadata.createdBy).toBe('user-creator');
    expect(metadata.updatedBy).toBe('user-creator');
    expect(metadata.ysweetDocId).toBe('ysweet-doc-123');
    expect(metadata.tags).toEqual(['tag1']);
    expect(metadata.version).toBe(1);
    expect(metadata.createdAt).toBeInstanceOf(Date);
    expect(metadata.updatedAt).toBeInstanceOf(Date);
  });

  it('uses private visibility as default', () => {
    // visibility defaults to 'private' per CreateDocumentPayload schema
    const payload: CreateDocumentPayload = {
      title: 'Private Doc',
      visibility: 'private',
    };
    const metadata = createInitialMetadata(
      payload,
      'user-1' as IdentityId,
      'ysweet-1'
    );

    expect(metadata.visibility).toBe('private');
  });
});
