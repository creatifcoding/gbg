import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { lookupCareAdvice, lookupSupplyTransit, type SupplyHit } from '../adapters/care';
import type { LocationGrant } from '../contracts/types';
import {
  createCareSubject,
  draftInterpretation,
  draftObservation,
  ingestMedia,
  logCareEvent,
  offerAdvice,
  setReminder,
} from '../kernel/actions';
import { buildExport, importExport, parseExport, serializeExport } from '../kernel/export-import';
import { IndexedDbStore, KeeperLog, MemoryStore, type EventStore } from '../kernel/log';
import { foldEvents, type ReadModel } from '../kernel/model';
import type { CareAct, CareAdvice } from '../contracts/types';

export interface KeeperApi {
  readonly ready: boolean;
  readonly model: ReadModel;
  readonly online: boolean;
  readonly lastAdvice: CareAdvice | null;
  readonly supplyHits: readonly SupplyHit[];
  readonly supplyStatus: string;
  readonly locationMode: 'idle' | 'granted' | 'declined' | 'manual';
  refresh: () => Promise<void>;
  ensureSubject: (housing?: 'temporary-cup') => Promise<string>;
  capturePhoto: (file: File) => Promise<void>;
  addObservation: (text: string, mediaDigest?: string) => Promise<void>;
  addHypothesis: (observationId: string, text: string) => Promise<void>;
  logAct: (act: CareAct, note?: string) => Promise<void>;
  remind: (text: string, dueAt: string) => Promise<void>;
  askNow: () => Promise<CareAdvice | null>;
  requestLocation: () => Promise<void>;
  declineLocation: () => void;
  setManualPlace: (place: string) => Promise<void>;
  lookupSupplies: () => Promise<void>;
  exportJson: () => Promise<string>;
  importJson: (text: string) => Promise<void>;
}

const Ctx = createContext<KeeperApi | null>(null);

const nowIso = (): string => new Date().toISOString();

export function KeeperProvider({
  children,
  store: injected,
}: {
  children: ReactNode;
  store?: EventStore;
}) {
  const [log, setLog] = useState<KeeperLog | null>(null);
  const [model, setModel] = useState<ReadModel>(foldEvents([]));
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? false : navigator.onLine,
  );
  const [lastAdvice, setLastAdvice] = useState<CareAdvice | null>(null);
  const [supplyHits, setSupplyHits] = useState<readonly SupplyHit[]>([]);
  const [supplyStatus, setSupplyStatus] = useState('Current lookup not requested.');
  const [locationMode, setLocationMode] = useState<KeeperApi['locationMode']>('idle');
  const [grant, setGrant] = useState<LocationGrant | null>(null);
  const [manualPlace, setManualPlaceState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const store = injected ?? (typeof indexedDB === 'undefined' ? new MemoryStore() : await IndexedDbStore.open());
      if (cancelled) return;
      const next = new KeeperLog(store);
      setLog(next);
      setModel(foldEvents(await next.events()));
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [injected]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!log) return;
    setModel(foldEvents(await log.events()));
  }, [log]);

  const ensureSubject = useCallback(
    async (housing: 'temporary-cup' = 'temporary-cup') => {
      if (!log) throw new Error('log not ready');
      const existing = foldEvents(await log.events()).subjects[0];
      if (existing) return existing.careSubjectId;
      const created = await createCareSubject(log, {
        housing,
        occurredAt: nowIso(),
        idempotencyKey: 'care-subject:primary',
      });
      await refresh();
      return created.careSubjectId;
    },
    [log, refresh],
  );

  const capturePhoto = useCallback(
    async (file: File) => {
      if (!log) throw new Error('log not ready');
      const careSubjectId = await ensureSubject();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const key = `media:${file.name}:${file.size}:${file.lastModified}`;
      await ingestMedia(log, {
        bytes,
        mediaType: file.type || 'image/jpeg',
        careSubjectId,
        idempotencyKey: key,
        occurredAt: nowIso(),
        origin: 'import',
      });
      await refresh();
    },
    [ensureSubject, log, refresh],
  );

  const addObservation = useCallback(
    async (text: string, mediaDigest?: string) => {
      if (!log) throw new Error('log not ready');
      const careSubjectId = await ensureSubject();
      await draftObservation(log, {
        careSubjectId,
        statements: [{ text, status: 'observed' }],
        ...(mediaDigest ? { mediaDigest } : {}),
        occurredAt: nowIso(),
        idempotencyKey: `obs:${text}:${mediaDigest ?? 'none'}`,
      });
      await refresh();
    },
    [ensureSubject, log, refresh],
  );

  const addHypothesis = useCallback(
    async (observationId: string, text: string) => {
      if (!log) throw new Error('log not ready');
      const careSubjectId = await ensureSubject();
      await draftInterpretation(log, {
        careSubjectId,
        observationId,
        statements: [{ text, status: 'interpreted' }],
        taxonHypothesis: {
          status: 'cited-guess',
          name: 'Mantodea (order-level guess only)',
          rank: 'order',
          confidence: 0.4,
          citation: 'Visible raptorial forelegs; not a species confirmation.',
          confirmed: false,
        },
        occurredAt: nowIso(),
        idempotencyKey: `hyp:${observationId}:${text}`,
      });
      await refresh();
    },
    [ensureSubject, log, refresh],
  );

  const logAct = useCallback(
    async (act: CareAct, note?: string) => {
      if (!log) throw new Error('log not ready');
      const careSubjectId = await ensureSubject();
      await logCareEvent(log, {
        careSubjectId,
        act,
        occurredAt: nowIso(),
        idempotencyKey: `act:${act}:${nowIso()}`,
        ...(note ? { note } : {}),
      });
      await refresh();
    },
    [ensureSubject, log, refresh],
  );

  const remind = useCallback(
    async (text: string, dueAt: string) => {
      if (!log) throw new Error('log not ready');
      const careSubjectId = await ensureSubject();
      await setReminder(log, {
        careSubjectId,
        text,
        dueAt,
        occurredAt: nowIso(),
        idempotencyKey: `rem:${text}:${dueAt}`,
      });
      await refresh();
    },
    [ensureSubject, log, refresh],
  );

  const askNow = useCallback(async () => {
    if (!log) throw new Error('log not ready');
    const careSubjectId = await ensureSubject();
    const envelope = lookupCareAdvice({ careSubjectId, now: nowIso(), online });
    const advice = envelope.value;
    if (!advice) return null;
    await offerAdvice(log, {
      careSubjectId,
      occurredAt: nowIso(),
      idempotencyKey: `adv:${advice.adviceId}`,
      advice: advice as unknown as Record<string, unknown>,
    });
    setLastAdvice(advice);
    await refresh();
    return advice;
  }, [ensureSubject, log, online, refresh]);

  const requestLocation = useCallback(async () => {
    const { locationGrant } = await import('../adapters/care');
    const next = locationGrant(nowIso());
    setGrant(next);
    setLocationMode('granted');
  }, []);

  const declineLocation = useCallback(() => {
    setGrant(null);
    setLocationMode('declined');
  }, []);

  const setManualPlace = useCallback(async (place: string) => {
    setManualPlaceState(place);
    setLocationMode('manual');
  }, []);

  const lookupSupplies = useCallback(async () => {
    const envelope = lookupSupplyTransit({
      now: nowIso(),
      grant,
      manualPlace,
      online,
    });
    setSupplyHits(envelope.value?.hits ?? []);
    setSupplyStatus(
      envelope.offline === 'unavailable'
        ? 'Current supply/transit lookup is unavailable offline. Local care logging still works.'
        : `Fixture lookup (${envelope.value?.locationMode ?? 'declined'}). No purchase, call, or navigation is launched.`,
    );
  }, [grant, manualPlace, online]);

  const exportJson = useCallback(async () => {
    if (!log) throw new Error('log not ready');
    const envelope = await buildExport(log.store, nowIso());
    return serializeExport(envelope);
  }, [log]);

  const importJson = useCallback(
    async (text: string) => {
      if (!log) throw new Error('log not ready');
      await importExport(log.store, parseExport(text));
      await refresh();
    },
    [log, refresh],
  );

  const api = useMemo<KeeperApi>(
    () => ({
      ready: Boolean(log),
      model,
      online,
      lastAdvice,
      supplyHits,
      supplyStatus,
      locationMode,
      refresh,
      ensureSubject,
      capturePhoto,
      addObservation,
      addHypothesis,
      logAct,
      remind,
      askNow,
      requestLocation,
      declineLocation,
      setManualPlace,
      lookupSupplies,
      exportJson,
      importJson,
    }),
    [
      addHypothesis,
      addObservation,
      askNow,
      capturePhoto,
      declineLocation,
      ensureSubject,
      exportJson,
      importJson,
      lastAdvice,
      locationMode,
      log,
      logAct,
      lookupSupplies,
      model,
      online,
      refresh,
      remind,
      requestLocation,
      setManualPlace,
      supplyHits,
      supplyStatus,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useKeeper = (): KeeperApi => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('KeeperProvider required');
  return ctx;
};
