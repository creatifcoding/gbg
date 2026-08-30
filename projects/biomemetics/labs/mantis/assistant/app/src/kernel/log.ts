import type { CanonicalEvent, EventType, MediaBlob } from '../contracts/types';
import { ASSISTANT_EVENT_SCHEMA_VERSION } from '../contracts/types';
import { canonicalJson, randomId, sha256Json } from './crypto';

export const CURRENT_SCHEMA_VERSION = ASSISTANT_EVENT_SCHEMA_VERSION;

export interface AppendInput {
  readonly type: EventType;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly careSubjectId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly schemaVersion?: number;
  readonly supersedesEventId?: string;
}

export const eventFingerprint = (input: AppendInput): Omit<CanonicalEvent, 'eventId' | 'digest'> => ({
  schemaVersion: input.schemaVersion ?? CURRENT_SCHEMA_VERSION,
  idempotencyKey: input.idempotencyKey,
  type: input.type,
  occurredAt: input.occurredAt,
  careSubjectId: input.careSubjectId,
  payload: input.payload,
  ...(input.supersedesEventId ? { supersedesEventId: input.supersedesEventId } : {}),
});

export const materializeEvent = async (input: AppendInput): Promise<CanonicalEvent> => {
  const body = eventFingerprint(input);
  const digest = await sha256Json(body);
  return {
    ...body,
    eventId: randomId('evt'),
    digest,
  };
};

export const digestMatches = async (event: CanonicalEvent): Promise<boolean> => {
  const { eventId: _id, digest: claimed, ...body } = event;
  void _id;
  const actual = await sha256Json(body);
  return actual === claimed;
};

export const isUnknownSchema = (event: CanonicalEvent): boolean =>
  event.schemaVersion > CURRENT_SCHEMA_VERSION;

export interface EventStore {
  getByIdempotency(key: string): Promise<CanonicalEvent | undefined>;
  getById(eventId: string): Promise<CanonicalEvent | undefined>;
  append(event: CanonicalEvent): Promise<void>;
  list(): Promise<readonly CanonicalEvent[]>;
  putBlob(blob: MediaBlob): Promise<void>;
  getBlob(digest: string): Promise<MediaBlob | undefined>;
  listBlobs(): Promise<readonly MediaBlob[]>;
  replaceAll(events: readonly CanonicalEvent[], blobs: readonly MediaBlob[]): Promise<void>;
}

export class MemoryStore implements EventStore {
  private events: CanonicalEvent[] = [];
  private blobs = new Map<string, MediaBlob>();

  async getByIdempotency(key: string): Promise<CanonicalEvent | undefined> {
    return this.events.find((e) => e.idempotencyKey === key);
  }

  async getById(eventId: string): Promise<CanonicalEvent | undefined> {
    return this.events.find((e) => e.eventId === eventId);
  }

  async append(event: CanonicalEvent): Promise<void> {
    this.events.push(event);
  }

  async list(): Promise<readonly CanonicalEvent[]> {
    return this.events.slice();
  }

  async putBlob(blob: MediaBlob): Promise<void> {
    this.blobs.set(blob.digest, blob);
  }

  async getBlob(digest: string): Promise<MediaBlob | undefined> {
    return this.blobs.get(digest);
  }

  async listBlobs(): Promise<readonly MediaBlob[]> {
    return [...this.blobs.values()];
  }

  async replaceAll(events: readonly CanonicalEvent[], blobs: readonly MediaBlob[]): Promise<void> {
    this.events = events.slice();
    this.blobs = new Map(blobs.map((b) => [b.digest, b]));
  }
}

const DB_NAME = 'mantis-keeper-a1';
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('events')) {
        const events = db.createObjectStore('events', { keyPath: 'eventId' });
        events.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'digest' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const reqAs = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export class IndexedDbStore implements EventStore {
  static async open(): Promise<IndexedDbStore> {
    const db = await openDb();
    return new IndexedDbStore(db);
  }

  private constructor(private readonly db: IDBDatabase) {}

  async getByIdempotency(key: string): Promise<CanonicalEvent | undefined> {
    const tx = this.db.transaction('events', 'readonly');
    const index = tx.objectStore('events').index('idempotencyKey');
    const value = await reqAs(index.get(key));
    return value as CanonicalEvent | undefined;
  }

  async getById(eventId: string): Promise<CanonicalEvent | undefined> {
    const tx = this.db.transaction('events', 'readonly');
    const value = await reqAs(tx.objectStore('events').get(eventId));
    return value as CanonicalEvent | undefined;
  }

  async append(event: CanonicalEvent): Promise<void> {
    const tx = this.db.transaction('events', 'readwrite');
    await reqAs(tx.objectStore('events').add(event));
  }

  async list(): Promise<readonly CanonicalEvent[]> {
    const tx = this.db.transaction('events', 'readonly');
    const value = await reqAs(tx.objectStore('events').getAll());
    return (value as CanonicalEvent[]).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  async putBlob(blob: MediaBlob): Promise<void> {
    const tx = this.db.transaction('blobs', 'readwrite');
    await reqAs(
      tx.objectStore('blobs').put({
        ...blob,
        bytes: blob.bytes,
      }),
    );
  }

  async getBlob(digest: string): Promise<MediaBlob | undefined> {
    const tx = this.db.transaction('blobs', 'readonly');
    const value = await reqAs(tx.objectStore('blobs').get(digest));
    return value as MediaBlob | undefined;
  }

  async listBlobs(): Promise<readonly MediaBlob[]> {
    const tx = this.db.transaction('blobs', 'readonly');
    return (await reqAs(tx.objectStore('blobs').getAll())) as MediaBlob[];
  }

  async replaceAll(events: readonly CanonicalEvent[], blobs: readonly MediaBlob[]): Promise<void> {
    const tx = this.db.transaction(['events', 'blobs'], 'readwrite');
    tx.objectStore('events').clear();
    tx.objectStore('blobs').clear();
    for (const event of events) tx.objectStore('events').put(event);
    for (const blob of blobs) tx.objectStore('blobs').put(blob);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export class KeeperLog {
  constructor(readonly store: EventStore) {}

  async append(input: AppendInput): Promise<{ event: CanonicalEvent; duplicate: boolean }> {
    const existing = await this.store.getByIdempotency(input.idempotencyKey);
    if (existing) return { event: existing, duplicate: true };
    const event = await materializeEvent(input);
    await this.store.append(event);
    return { event, duplicate: false };
  }

  async events(): Promise<readonly CanonicalEvent[]> {
    return this.store.list();
  }

  async putBlob(blob: MediaBlob): Promise<MediaBlob> {
    const existing = await this.store.getBlob(blob.digest);
    if (existing) return existing;
    await this.store.putBlob(blob);
    return blob;
  }

  snapshotJson(): string {
    return canonicalJson({ store: 'append-only', schema: CURRENT_SCHEMA_VERSION });
  }
}
