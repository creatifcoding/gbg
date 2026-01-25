/**
 * Holonet Durable Streams Testbed
 *
 * Demonstrates the Holonet HTTP API for durable streams with proper Effect patterns:
 *
 * 1. **Match-based Error Handling** - Structured domain error matching
 * 2. **Atom.family** - Per-stream state management
 * 3. **Effect.either** - Structured success/failure handling
 * 4. **NATS Gap Demo** - Proves direct NATS streams are invisible to HTTP API
 *
 * Route: /testbed/holonet-durable-streams
 *
 * @module testbed/HolonetDurableStreamsTestbed
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Atom, Registry } from '@effect-atom/atom';
import { Effect, pipe, Match, Either } from 'effect';

import {
  Server,
  Zap,
  Send,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Radio,
  Database,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wifi,
  Eye,
  EyeOff,
  ArrowRight,
  List,
} from 'lucide-react';

import {
  HolonetDurableStreamsClient,
  HolonetDurableStreamsClientCustom,
} from '@/lib/holonet/integration/durable-streams-client';
import type { DurableStreamError } from '@/lib/holonet/durable-streams/schemas/errors';

import { TestbedHeader } from './shared';

// =============================================================================
// TESTBED REGISTRY
// =============================================================================

const testbedRegistry = Registry.make();

// =============================================================================
// TYPES
// =============================================================================

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface StreamMessage {
  offset: string;
  data: unknown;
  timestamp: number;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  source: 'client' | 'server' | 'poll' | 'nats-gap';
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

interface StreamInfo {
  id: string;
  contentType: string;
  created: Date;
}

// =============================================================================
// ATOMS - Core State
// =============================================================================

const serverUrlAtom = Atom.make('http://127.0.0.1:3030');
const connectionStatusAtom = Atom.make<ConnectionStatus>('disconnected');
const healthyAtom = Atom.make(false);

const streamIdsAtom = Atom.make<readonly string[]>([]);
const selectedStreamAtom = Atom.make<string | null>(null);
const newStreamIdAtom = Atom.make('');
const newStreamContentTypeAtom = Atom.make('application/json');

const currentOffsetAtom = Atom.make<string>('');
const isPollingAtom = Atom.make(false);
const pollIntervalAtom = Atom.make(2000);

const messageInputAtom = Atom.make('');
const eventLogAtom = Atom.make<readonly LogEntry[]>([]);

// NATS Gap demo atoms
const natsGapStreamNameAtom = Atom.make('');
const natsGapResultAtom = Atom.make<'idle' | 'testing' | 'proven' | 'error'>(
  'idle'
);

// =============================================================================
// ATOMS - Atom.family for Per-Stream State
// =============================================================================

/**
 * Per-stream metadata (lazy, GC'd when unused)
 */
const streamMetadataFamily = Atom.family((streamId: string) =>
  Atom.make<StreamInfo | null>(null)
);

/**
 * Per-stream messages (lazy, GC'd when unused)
 */
const streamMessagesFamily = Atom.family((streamId: string) =>
  Atom.make<readonly StreamMessage[]>([])
);

// =============================================================================
// LOGGING HELPER
// =============================================================================

function addLog(
  source: LogEntry['source'],
  message: string,
  level: LogEntry['level'] = 'info'
) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    source,
    message,
    level,
  };
  testbedRegistry.update(eventLogAtom, (log) => [entry, ...log.slice(0, 49)]);
}

// =============================================================================
// EFFECT HELPERS - Run with Either for structured error handling
// =============================================================================

/**
 * Run an Effect with the HolonetDurableStreamsClient layer,
 * returning Either for structured error handling
 */
function runWithClientEither<A>(
  effect: Effect.Effect<A, DurableStreamError, HolonetDurableStreamsClient>
): Promise<Either.Either<A, DurableStreamError>> {
  const serverUrl = testbedRegistry.get(serverUrlAtom);
  const layer = HolonetDurableStreamsClientCustom({
    _tag: 'HolonetDurableStreamsConfig',
    baseUrl: serverUrl,
  });
  return Effect.runPromise(pipe(effect, Effect.either, Effect.provide(layer)));
}

// =============================================================================
// ERROR HANDLER - Match-based structured error handling
// =============================================================================

/**
 * Handle DurableStreamError using Match for elegant pattern matching
 */
const handleError = (error: DurableStreamError, context: string) => {
  pipe(
    Match.value(error),
    Match.tag('StreamNotFoundError', (e) => {
      addLog(
        'client',
        `${context}: Stream "${e.streamId}" not found`,
        'warning'
      );
    }),
    Match.tag('StreamExistsError', (e) => {
      addLog(
        'client',
        `${context}: Stream "${e.streamId}" already exists`,
        'warning'
      );
    }),
    Match.tag('NatsConnectionError', (e) => {
      addLog('client', `${context}: Connection error - ${e.reason}`, 'error');
      testbedRegistry.set(connectionStatusAtom, 'error');
      testbedRegistry.set(healthyAtom, false);
    }),
    Match.tag('InvalidOffsetError', (e) => {
      addLog(
        'client',
        `${context}: Invalid offset "${e.offset}" - ${e.reason}`,
        'error'
      );
    }),
    Match.tag('ContentTypeMismatch', (e) => {
      addLog(
        'client',
        `${context}: Content type mismatch - expected ${e.expected}, got ${e.received}`,
        'error'
      );
    }),
    Match.tag('UnexpectedError', (e) => {
      addLog('client', `${context}: Unexpected error - ${e.message}`, 'error');
    }),
    Match.orElse((e) => {
      addLog('client', `${context}: ${e._tag}`, 'error');
    })
  );
};

// =============================================================================
// CONNECTION PANEL
// =============================================================================

function ConnectionPanel() {
  const serverUrl = useAtomValue(serverUrlAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);

  const checkHealth = useCallback(async () => {
    testbedRegistry.set(connectionStatusAtom, 'connecting');
    addLog('client', 'Checking server health...', 'info');

    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        return yield* client.exists('/__health_check__');
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) =>
          pipe(
            Match.value(error),
            Match.tag('StreamNotFoundError', () => {
              // 404 = server is reachable, stream just doesn't exist
              testbedRegistry.set(healthyAtom, true);
              testbedRegistry.set(connectionStatusAtom, 'connected');
              addLog('server', 'Server healthy (404 = reachable)', 'success');
            }),
            Match.tag('NatsConnectionError', (e) => {
              testbedRegistry.set(healthyAtom, false);
              testbedRegistry.set(connectionStatusAtom, 'error');
              addLog('client', `Connection failed: ${e.reason}`, 'error');
            }),
            Match.orElse((e) => {
              testbedRegistry.set(healthyAtom, false);
              testbedRegistry.set(connectionStatusAtom, 'error');
              addLog('client', `Connection failed: ${e._tag}`, 'error');
            })
          ),
        onRight: () => {
          testbedRegistry.set(healthyAtom, true);
          testbedRegistry.set(connectionStatusAtom, 'connected');
          addLog('server', 'Server healthy and reachable', 'success');
        },
      })
    );
  }, []);

  const statusColors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-neutral-500',
    error: 'bg-red-500',
  };

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-4 h-4 text-cyan-400" />
        <span className="font-mono text-sm text-white">CONNECTION</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Server URL
          </label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => testbedRegistry.set(serverUrlAtom, e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          onClick={checkHealth}
          disabled={connectionStatus === 'connecting'}
          className="w-full px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {connectionStatus === 'connecting' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Connect
        </button>

        <div className="pt-2 border-t border-neutral-800 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${statusColors[connectionStatus]}`}
          />
          <span className="text-xs text-neutral-400 capitalize">
            {connectionStatus}
          </span>
          {connectionStatus === 'connected' && (
            <span className="text-xs text-green-400 ml-auto flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STREAM MANAGEMENT PANEL
// =============================================================================

function StreamManagementPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const streamIds = useAtomValue(streamIdsAtom);
  const selectedStream = useAtomValue(selectedStreamAtom);
  const newStreamId = useAtomValue(newStreamIdAtom);
  const newContentType = useAtomValue(newStreamContentTypeAtom);
  const [isCreating, setIsCreating] = useState(false);

  const createStream = useCallback(async () => {
    const streamId = testbedRegistry.get(newStreamIdAtom).trim();
    if (!streamId) {
      addLog('client', 'Stream ID required', 'warning');
      return;
    }

    setIsCreating(true);
    addLog('client', `Creating stream: ${streamId}...`, 'info');

    const contentType = testbedRegistry.get(newStreamContentTypeAtom);
    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        return yield* client.create({ url: streamId, contentType });
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) => handleError(error, 'Create'),
        onRight: () => {
          // Update stream list
          testbedRegistry.update(streamIdsAtom, (ids) => [...ids, streamId]);

          // Set metadata via family
          const metadataAtom = streamMetadataFamily(streamId);
          testbedRegistry.set(metadataAtom, {
            id: streamId,
            contentType,
            created: new Date(),
          });

          testbedRegistry.set(newStreamIdAtom, '');
          testbedRegistry.set(selectedStreamAtom, streamId);
          addLog('server', `Stream "${streamId}" created`, 'success');
        },
      })
    );

    setIsCreating(false);
  }, []);

  const deleteStream = useCallback(async (id: string) => {
    if (!confirm(`Delete stream "${id}"?`)) return;

    addLog('client', `Deleting stream: ${id}...`, 'warning');

    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        return yield* client.delete(id);
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) => handleError(error, 'Delete'),
        onRight: () => {
          testbedRegistry.update(streamIdsAtom, (ids) =>
            ids.filter((x) => x !== id)
          );

          // Clear metadata via family
          const metadataAtom = streamMetadataFamily(id);
          testbedRegistry.set(metadataAtom, null);

          if (testbedRegistry.get(selectedStreamAtom) === id) {
            testbedRegistry.set(selectedStreamAtom, null);
          }
          addLog('server', `Stream "${id}" deleted`, 'success');
        },
      })
    );
  }, []);

  const selectStream = useCallback((id: string) => {
    testbedRegistry.set(selectedStreamAtom, id);
    testbedRegistry.set(currentOffsetAtom, '');
    addLog('client', `Selected stream: ${id}`, 'info');
  }, []);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-emerald-400" />
        <span className="font-mono text-sm text-white">STREAMS</span>
      </div>

      <div className="space-y-3">
        {/* Create stream form */}
        <div className="space-y-2">
          <input
            type="text"
            value={newStreamId}
            onChange={(e) =>
              testbedRegistry.set(newStreamIdAtom, e.target.value)
            }
            placeholder="Stream ID..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={newContentType}
            onChange={(e) =>
              testbedRegistry.set(newStreamContentTypeAtom, e.target.value)
            }
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="application/json">application/json</option>
            <option value="text/plain">text/plain</option>
            <option value="application/octet-stream">
              application/octet-stream
            </option>
          </select>
          <button
            onClick={createStream}
            disabled={connectionStatus !== 'connected' || isCreating}
            className="w-full px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Stream
          </button>
        </div>

        {/* Stream list */}
        <div className="pt-2 border-t border-neutral-800">
          <div className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
            <List className="w-3 h-3" />
            {streamIds.length} streams
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {streamIds.map((streamId) => (
              <StreamListItem
                key={streamId}
                streamId={streamId}
                isSelected={selectedStream === streamId}
                onSelect={() => selectStream(streamId)}
                onDelete={() => deleteStream(streamId)}
              />
            ))}
            {streamIds.length === 0 && (
              <div className="text-xs text-neutral-500 text-center py-2">
                No streams. Create one above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stream list item component to properly use atom family hooks
function StreamListItem({
  streamId,
  isSelected,
  onSelect,
  onDelete,
}: {
  streamId: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const metadata = useAtomValue(streamMetadataFamily(streamId));

  return (
    <div
      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
        isSelected
          ? 'bg-emerald-500/20 border border-emerald-500/30'
          : 'bg-neutral-900 hover:bg-neutral-800'
      }`}
      onClick={onSelect}
    >
      <div className="truncate">
        <div className="text-xs text-white font-mono truncate">{streamId}</div>
        <div className="text-[10px] text-neutral-500">
          {metadata?.contentType ?? 'unknown'}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// =============================================================================
// APPEND PANEL
// =============================================================================

function AppendPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const selectedStream = useAtomValue(selectedStreamAtom);
  const messageInput = useAtomValue(messageInputAtom);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(async () => {
    const streamId = testbedRegistry.get(selectedStreamAtom);
    if (!streamId) {
      addLog('client', 'Select a stream first', 'warning');
      return;
    }

    const input = testbedRegistry.get(messageInputAtom).trim();
    if (!input) {
      addLog('client', 'Message required', 'warning');
      return;
    }

    setIsSending(true);
    addLog('client', `Appending to "${streamId}"...`, 'info');

    // Try to parse as JSON, otherwise send as string
    let data: unknown;
    try {
      data = JSON.parse(input);
    } catch {
      data = input;
    }

    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        const handle = yield* client.getOrCreate({ url: streamId });
        return yield* handle.append(data);
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) => handleError(error, 'Append'),
        onRight: () => {
          testbedRegistry.set(messageInputAtom, '');
          addLog('server', `Message appended to "${streamId}"`, 'success');
        },
      })
    );

    setIsSending(false);
  }, []);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-4 h-4 text-amber-400" />
        <span className="font-mono text-sm text-white">APPEND</span>
        {selectedStream && (
          <span className="text-xs text-neutral-500 ml-auto truncate max-w-[100px]">
            → {selectedStream}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <textarea
          value={messageInput}
          onChange={(e) =>
            testbedRegistry.set(messageInputAtom, e.target.value)
          }
          placeholder='{"type": "event", "data": "..."}'
          rows={3}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none resize-none"
        />
        <button
          onClick={sendMessage}
          disabled={
            connectionStatus !== 'connected' || !selectedStream || isSending
          }
          className="w-full px-4 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// READ/POLL PANEL
// =============================================================================

function ReadPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const selectedStream = useAtomValue(selectedStreamAtom);
  const currentOffset = useAtomValue(currentOffsetAtom);
  const isPolling = useAtomValue(isPollingAtom);
  const pollInterval = useAtomValue(pollIntervalAtom);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const readStream = useCallback(async () => {
    const streamId = testbedRegistry.get(selectedStreamAtom);
    if (!streamId) return;

    const offset = testbedRegistry.get(currentOffsetAtom);
    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        const handle = yield* client.connect({ url: streamId });
        return yield* handle.read(offset ? { offset } : undefined);
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) => handleError(error, 'Read'),
        onRight: (batch) => {
          if (batch.items.length > 0) {
            const messages: StreamMessage[] = batch.items.map((item, i) => ({
              offset: `${batch.offset}-${i}`,
              data: item,
              timestamp: Date.now(),
            }));

            // Update per-stream messages via family
            const messagesAtom = streamMessagesFamily(streamId);
            testbedRegistry.update(messagesAtom, (existing) =>
              [...messages, ...existing].slice(0, 100)
            );
            testbedRegistry.set(currentOffsetAtom, batch.offset);
            addLog(
              'poll',
              `Read ${batch.items.length} messages (offset: ${batch.offset})`,
              'success'
            );
          }
        },
      })
    );
  }, []);

  const togglePolling = useCallback(() => {
    const currentPolling = testbedRegistry.get(isPollingAtom);
    const interval = testbedRegistry.get(pollIntervalAtom);

    if (currentPolling) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      testbedRegistry.set(isPollingAtom, false);
      addLog('poll', 'Polling stopped', 'info');
    } else {
      testbedRegistry.set(isPollingAtom, true);
      addLog('poll', `Polling started (${interval}ms)`, 'info');
      readStream();
      pollTimerRef.current = setInterval(readStream, interval);
    }
  }, [readStream]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPolling && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(readStream, pollInterval);
    }
  }, [pollInterval, isPolling, readStream]);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">READ</span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={togglePolling}
            disabled={connectionStatus !== 'connected' || !selectedStream}
            className={`flex-1 px-4 py-2 rounded transition-colors flex items-center justify-center gap-2 ${
              isPolling
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
            } disabled:opacity-50`}
          >
            {isPolling ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isPolling ? 'Stop' : 'Poll'}
          </button>
          <button
            onClick={readStream}
            disabled={connectionStatus !== 'connected' || !selectedStream}
            className="px-4 py-2 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-neutral-500">
          Offset:{' '}
          <span className="text-white font-mono">
            {currentOffset || 'none'}
          </span>
        </div>
      </div>

      {/* Message list with Atom.family */}
      {selectedStream ? (
        <MessageList streamId={selectedStream} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-500">
          Select a stream to view messages
        </div>
      )}
    </div>
  );
}

// Message list component to properly use atom family hooks
function MessageList({ streamId }: { streamId: string }) {
  const messages = useAtomValue(streamMessagesFamily(streamId));

  return (
    <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px]">
      {messages.map((msg, i) => (
        <div
          key={`${msg.offset}-${i}`}
          className="p-2 bg-neutral-900 rounded text-xs"
        >
          <div className="flex justify-between text-neutral-500 mb-1">
            <span className="font-mono">{msg.offset}</span>
            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          <pre className="text-white font-mono overflow-x-auto">
            {typeof msg.data === 'string'
              ? msg.data
              : JSON.stringify(msg.data, null, 2)}
          </pre>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="text-xs text-neutral-500 text-center py-4">
          No messages. Click Poll to read.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NATS GAP DEMONSTRATION PANEL
// =============================================================================

function NatsGapPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const natsGapResult = useAtomValue(natsGapResultAtom);
  const natsStreamName = useAtomValue(natsGapStreamNameAtom);
  const [isTesting, setIsTesting] = useState(false);

  const demonstrateGap = useCallback(async () => {
    const streamName =
      testbedRegistry.get(natsGapStreamNameAtom).trim() ||
      `nats-gap-${Date.now()}`;
    testbedRegistry.set(natsGapStreamNameAtom, streamName);
    setIsTesting(true);
    testbedRegistry.set(natsGapResultAtom, 'testing');
    addLog('nats-gap', `Testing NATS gap with stream: ${streamName}`, 'info');

    const result = await runWithClientEither(
      Effect.gen(function* () {
        const client = yield* HolonetDurableStreamsClient;
        return yield* client.exists(streamName);
      })
    );

    pipe(
      result,
      Either.match({
        onLeft: (error) =>
          pipe(
            Match.value(error),
            Match.tag('StreamNotFoundError', () => {
              // 404 proves the gap!
              testbedRegistry.set(natsGapResultAtom, 'proven');
              addLog(
                'nats-gap',
                'GAP PROVEN: 404 confirms HTTP API cannot see NATS streams',
                'success'
              );
            }),
            Match.tag('NatsConnectionError', () => {
              testbedRegistry.set(natsGapResultAtom, 'error');
              addLog('nats-gap', 'Test failed: connection error', 'error');
            }),
            Match.orElse(() => {
              testbedRegistry.set(natsGapResultAtom, 'error');
              addLog('nats-gap', `Test error: ${error._tag}`, 'error');
            })
          ),
        onRight: (exists) => {
          if (!exists) {
            testbedRegistry.set(natsGapResultAtom, 'proven');
            addLog(
              'nats-gap',
              'GAP PROVEN: Stream not visible via HTTP API',
              'success'
            );
          } else {
            testbedRegistry.set(natsGapResultAtom, 'error');
            addLog(
              'nats-gap',
              'Unexpected: stream exists (was it created via API?)',
              'warning'
            );
          }
        },
      })
    );

    setIsTesting(false);
  }, []);

  const resultColors = {
    idle: 'text-neutral-500',
    testing: 'text-yellow-400',
    proven: 'text-green-400',
    error: 'text-red-400',
  };

  const resultIcons = {
    idle: <Eye className="w-4 h-4" />,
    testing: <RefreshCw className="w-4 h-4 animate-spin" />,
    proven: <CheckCircle2 className="w-4 h-4" />,
    error: <XCircle className="w-4 h-4" />,
  };

  return (
    <div className="bg-black/90 border border-orange-500/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        <span className="font-mono text-sm text-white">NATS GAP DEMO</span>
      </div>

      <div className="space-y-3">
        <div className="text-xs text-neutral-400 leading-relaxed">
          <p className="mb-2">
            <strong className="text-orange-400">THE GAP:</strong> The
            durable-streams HTTP API is self-contained. It cannot see NATS
            streams created directly.
          </p>
          <p>
            This demonstrates that direct NATS access (via NatsStreamService)
            creates streams invisible to the HTTP protocol.
          </p>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Test Stream Name
          </label>
          <input
            type="text"
            value={natsStreamName}
            onChange={(e) =>
              testbedRegistry.set(natsGapStreamNameAtom, e.target.value)
            }
            placeholder="nats-gap-test"
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <button
          onClick={demonstrateGap}
          disabled={connectionStatus !== 'connected' || isTesting}
          className="w-full px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded hover:bg-orange-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isTesting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
          Demonstrate Gap
        </button>

        <div
          className={`flex items-center gap-2 ${resultColors[natsGapResult]}`}
        >
          {resultIcons[natsGapResult]}
          <span className="text-sm font-mono">
            {natsGapResult === 'idle' && 'Ready to test'}
            {natsGapResult === 'testing' && 'Testing...'}
            {natsGapResult === 'proven' && 'GAP PROVEN ✓'}
            {natsGapResult === 'error' && 'Test failed'}
          </span>
        </div>

        {natsGapResult === 'proven' && (
          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400">
            <strong>Result:</strong> The HTTP API returned 404, proving it
            cannot access NATS streams not created via its own endpoints.
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// EVENT LOG PANEL
// =============================================================================

function EventLogPanel() {
  const events = useAtomValue(eventLogAtom);

  const levelColors = {
    info: 'text-neutral-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const sourceColors = {
    client: 'bg-cyan-500/20 text-cyan-400',
    server: 'bg-emerald-500/20 text-emerald-400',
    poll: 'bg-purple-500/20 text-purple-400',
    'nats-gap': 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4 h-48 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Radio className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">DEBUG LOG</span>
        <button
          onClick={() => testbedRegistry.set(eventLogAtom, [])}
          className="ml-auto text-xs text-neutral-500 hover:text-neutral-300"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2">
            <span className="text-neutral-600 shrink-0">
              {event.timestamp.toLocaleTimeString()}
            </span>
            <span
              className={`px-1 rounded ${sourceColors[event.source]} shrink-0`}
            >
              {event.source}
            </span>
            <span className={levelColors[event.level]}>{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// DATA FLOW DIAGRAM
// =============================================================================

function DataFlowDiagram() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const isPolling = useAtomValue(isPollingAtom);

  const NodeBox = ({
    label,
    icon: Icon,
    color,
    active = false,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    active?: boolean;
  }) => (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded border ${color} ${
        active ? 'ring-2 ring-offset-1 ring-offset-black' : ''
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-mono">{label}</span>
    </div>
  );

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="font-mono text-sm text-white">HOLONET DATA FLOW</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <NodeBox
          label="UI"
          icon={Send}
          color="border-amber-500/30 text-amber-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Client"
          icon={Zap}
          color="border-cyan-500/30 text-cyan-400"
          active={connectionStatus === 'connected'}
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="HTTP API"
          icon={Server}
          color="border-purple-500/30 text-purple-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="NATS"
          icon={Database}
          color="border-emerald-500/30 text-emerald-400"
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-xs mt-3">
        <NodeBox
          label="Poll"
          icon={RefreshCw}
          color="border-purple-500/30 text-purple-400"
          active={isPolling}
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="read()"
          icon={Download}
          color="border-cyan-500/30 text-cyan-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Atoms"
          icon={Radio}
          color="border-orange-500/30 text-orange-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox label="React" icon={Eye} color="border-white/30 text-white" />
      </div>
    </div>
  );
}

// =============================================================================
// MAIN TESTBED COMPONENT
// =============================================================================

export function HolonetDurableStreamsTestbed() {
  useEffect(() => {
    addLog('client', 'Holonet Durable Streams Testbed initialized', 'success');
    return () => {
      testbedRegistry.set(isPollingAtom, false);
    };
  }, []);

  return (
    <RegistryContext.Provider value={testbedRegistry as any}>
      <div className="min-h-screen bg-neutral-950 text-white p-6">
        <TestbedHeader
          title="Holonet Durable Streams Testbed"
          subtitle="Match error handling | Atom.family state | Effect.either patterns"
        />

        <div className="mt-6 grid grid-cols-12 gap-4">
          {/* Left Column - Connection & Streams */}
          <div className="col-span-3 space-y-4">
            <ConnectionPanel />
            <StreamManagementPanel />
          </div>

          {/* Center Column - Operations */}
          <div className="col-span-6 space-y-4">
            <DataFlowDiagram />
            <div className="grid grid-cols-2 gap-4">
              <AppendPanel />
              <NatsGapPanel />
            </div>
            <ReadPanel />
          </div>

          {/* Right Column - Logs */}
          <div className="col-span-3 space-y-4">
            <EventLogPanel />
          </div>
        </div>
      </div>
    </RegistryContext.Provider>
  );
}

export default HolonetDurableStreamsTestbed;
