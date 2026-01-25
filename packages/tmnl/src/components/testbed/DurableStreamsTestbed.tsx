/**
 * Durable Streams Testbed - Event Streaming Vertical Slice
 *
 * Demonstrates integration of DurableStreams for real-time event streaming:
 *
 * 1. **NativeStreamClient** - Browser-safe HTTP client for durable streams
 * 2. **Effect-atom** - Reactive state management via Registry
 * 3. **Stream Handle** - append(), read(), metadata() operations
 * 4. **Event Subscription** - Polling-based subscription pattern
 * 5. **GEOINT Integration** - Stream entity events to/from search results
 *
 * Data Flow:
 * ```
 * User Action → Stream.append() → Server → Persist
 *                                      ↓
 * Poll Timer → Stream.read() → entriesAtom → UI
 *                                      ↓
 * GEOINT Integration: Entity events streamed across system
 * ```
 *
 * Route: /testbed/durable-streams
 *
 * @module testbed/DurableStreamsTestbed
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react';
import { Atom, Registry } from '@effect-atom/atom';
import { Effect, pipe } from 'effect';

import {
  Radio,
  Send,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  Zap,
  Server,
  ArrowRight,
  Eye,
  Database,
  Activity,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Settings,
  MessageSquare,
} from 'lucide-react';

// DurableStreams Native Client
import {
  NativeStreamClient,
  NativeStreamClientConfigured,
  type StreamEntry,
} from '@/lib/durable-streams';

// Shared testbed components
import { TestbedHeader } from './shared';

// =============================================================================
// TESTBED REGISTRY
// =============================================================================

/**
 * Dedicated registry for this testbed.
 * Isolates state from other testbeds/components.
 */
const testbedRegistry = Registry.make();

// =============================================================================
// TESTBED-LOCAL ATOMS
// =============================================================================

/** Stream server URL */
const serverUrlAtom = Atom.make('http://127.0.0.1:3030');

/** Current stream ID */
const streamIdAtom = Atom.make('geoint-events');

/** Connection status */
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
const connectionStatusAtom = Atom.make<ConnectionStatus>('disconnected');

/** Server health */
const serverHealthAtom = Atom.make<boolean>(false);

/** Stream exists */
const streamExistsAtom = Atom.make<boolean>(false);

/** Current offset for reading */
const currentOffsetAtom = Atom.make<string>('');

/** Stream entries */
interface GeointEvent {
  type:
    | 'search'
    | 'entity_created'
    | 'entity_updated'
    | 'entity_deleted'
    | 'selection'
    | 'viewport_change';
  entityId?: string;
  entityType?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const entriesAtom = Atom.make<readonly StreamEntry<GeointEvent>[]>([]);

/** Is polling for updates */
const isPollingAtom = Atom.make(false);

/** Polling interval (ms) */
const pollIntervalAtom = Atom.make(2000);

/** Last error */
const lastErrorAtom = Atom.make<string | null>(null);

/** Event log for debugging */
interface EventLogEntry {
  id: string;
  timestamp: Date;
  source: 'client' | 'server' | 'poll' | 'ui';
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}
const eventLogAtom = Atom.make<readonly EventLogEntry[]>([]);

/** Message input for sending */
const messageInputAtom = Atom.make('');

/** Selected event type for sending */
const eventTypeAtom = Atom.make<GeointEvent['type']>('entity_updated');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function addEvent(
  source: EventLogEntry['source'],
  message: string,
  level: EventLogEntry['level'] = 'info'
) {
  const entry: EventLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    source,
    message,
    level,
  };
  testbedRegistry.update(eventLogAtom, (log) => [entry, ...log.slice(0, 49)]);
}

/**
 * Run an Effect with the NativeStreamClient layer
 */
function runWithClient<A, E>(
  effect: Effect.Effect<A, E, NativeStreamClient>
): Promise<A> {
  const serverUrl = testbedRegistry.get(serverUrlAtom);
  const layer = NativeStreamClientConfigured(serverUrl);
  return Effect.runPromise(pipe(effect, Effect.provide(layer)));
}

// =============================================================================
// STATUS INDICATOR COMPONENT
// =============================================================================

interface StatusIndicatorProps {
  status: ConnectionStatus;
  label: string;
}

function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const colors: Record<ConnectionStatus, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-neutral-500',
    error: 'bg-red-500',
  };

  const icons: Record<ConnectionStatus, React.ReactNode> = {
    connected: <Wifi className="w-3 h-3" />,
    connecting: <RefreshCw className="w-3 h-3 animate-spin" />,
    disconnected: <WifiOff className="w-3 h-3" />,
    error: <WifiOff className="w-3 h-3" />,
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`p-1 rounded ${colors[status]}`}>{icons[status]}</div>
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="text-xs text-neutral-600 capitalize">({status})</span>
    </div>
  );
}

// =============================================================================
// CONNECTION PANEL
// =============================================================================

function ConnectionPanel() {
  const serverUrl = useAtomValue(serverUrlAtom);
  const streamId = useAtomValue(streamIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const streamExists = useAtomValue(streamExistsAtom);

  const checkHealth = useCallback(async () => {
    testbedRegistry.set(connectionStatusAtom, 'connecting');
    addEvent('client', 'Checking server health...', 'info');

    try {
      const healthy = await runWithClient(
        Effect.gen(function* () {
          const client = yield* NativeStreamClient;
          return yield* client.health();
        })
      );

      testbedRegistry.set(serverHealthAtom, healthy);
      testbedRegistry.set(
        connectionStatusAtom,
        healthy ? 'connected' : 'error'
      );
      addEvent(
        'server',
        `Health check: ${healthy ? 'OK' : 'FAILED'}`,
        healthy ? 'success' : 'error'
      );

      if (healthy) {
        // Check if stream exists
        const exists = await runWithClient(
          Effect.gen(function* () {
            const client = yield* NativeStreamClient;
            return yield* client.exists(testbedRegistry.get(streamIdAtom));
          })
        );
        testbedRegistry.set(streamExistsAtom, exists);
        addEvent(
          'server',
          `Stream "${testbedRegistry.get(streamIdAtom)}" exists: ${exists}`,
          'info'
        );
      }
    } catch (error) {
      testbedRegistry.set(connectionStatusAtom, 'error');
      testbedRegistry.set(lastErrorAtom, String(error));
      addEvent('client', `Health check error: ${error}`, 'error');
    }
  }, []);

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

        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Stream ID
          </label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => testbedRegistry.set(streamIdAtom, e.target.value)}
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

        <div className="pt-2 border-t border-neutral-800 space-y-2">
          <StatusIndicator status={connectionStatus} label="Server" />
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                streamExists ? 'bg-green-500' : 'bg-neutral-500'
              }`}
            />
            <span className="text-neutral-400">
              Stream: {streamExists ? 'exists' : 'not found'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SEND EVENT PANEL
// =============================================================================

function SendEventPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const messageInput = useAtomValue(messageInputAtom);
  const eventType = useAtomValue(eventTypeAtom);
  const streamId = useAtomValue(streamIdAtom);
  const [isSending, setIsSending] = useState(false);

  const eventTypes: GeointEvent['type'][] = [
    'search',
    'entity_created',
    'entity_updated',
    'entity_deleted',
    'selection',
    'viewport_change',
  ];

  const sendEvent = useCallback(async () => {
    if (connectionStatus !== 'connected') {
      addEvent('ui', 'Not connected to server', 'warning');
      return;
    }

    setIsSending(true);
    addEvent('client', `Sending ${eventType} event...`, 'info');

    try {
      const event: GeointEvent = {
        type: eventType,
        entityId: `entity-${Date.now()}`,
        entityType: eventType.includes('entity') ? 'flight' : undefined,
        data: messageInput ? { message: messageInput } : undefined,
        timestamp: Date.now(),
      };

      const result = await runWithClient(
        Effect.gen(function* () {
          const client = yield* NativeStreamClient;
          const handle = client.getOrCreate<GeointEvent>(streamId);
          return yield* handle.append(event);
        })
      );

      addEvent(
        'server',
        `Event appended at offset: ${result.offset}`,
        'success'
      );
      testbedRegistry.set(messageInputAtom, '');
      testbedRegistry.set(streamExistsAtom, true);
    } catch (error) {
      addEvent('client', `Send error: ${error}`, 'error');
      testbedRegistry.set(lastErrorAtom, String(error));
    } finally {
      setIsSending(false);
    }
  }, [connectionStatus, eventType, messageInput, streamId]);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-4 h-4 text-emerald-400" />
        <span className="font-mono text-sm text-white">SEND EVENT</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={(e) =>
              testbedRegistry.set(
                eventTypeAtom,
                e.target.value as GeointEvent['type']
              )
            }
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Message (optional)
          </label>
          <input
            type="text"
            value={messageInput}
            onChange={(e) =>
              testbedRegistry.set(messageInputAtom, e.target.value)
            }
            placeholder="Additional data..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          onClick={sendEvent}
          disabled={isSending || connectionStatus !== 'connected'}
          className="w-full px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isSending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send Event
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// POLLING PANEL
// =============================================================================

function PollingPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const isPolling = useAtomValue(isPollingAtom);
  const pollInterval = useAtomValue(pollIntervalAtom);
  const entries = useAtomValue(entriesAtom);
  const currentOffset = useAtomValue(currentOffsetAtom);
  const streamId = useAtomValue(streamIdAtom);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const readStream = useCallback(async () => {
    if (connectionStatus !== 'connected') return;

    try {
      const offset = testbedRegistry.get(currentOffsetAtom);
      const response = await runWithClient(
        Effect.gen(function* () {
          const client = yield* NativeStreamClient;
          const handle = client.getOrCreate<GeointEvent>(streamId);
          return yield* handle.read({ offset: offset || undefined, limit: 50 });
        })
      );

      if (response.entries.length > 0) {
        testbedRegistry.update(entriesAtom, (existing) => {
          const existingOffsets = new Set(existing.map((e) => e.offset));
          const newEntries = response.entries.filter(
            (e) => !existingOffsets.has(e.offset)
          );
          return [...newEntries, ...existing].slice(0, 100);
        });
        testbedRegistry.set(currentOffsetAtom, response.lastOffset);
        addEvent(
          'poll',
          `Read ${response.entries.length} entries (offset: ${response.lastOffset})`,
          'success'
        );
      }
    } catch (error) {
      addEvent('poll', `Read error: ${error}`, 'error');
    }
  }, [connectionStatus, streamId]);

  const togglePolling = useCallback(() => {
    const currentPolling = testbedRegistry.get(isPollingAtom);

    if (currentPolling) {
      // Stop polling
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      testbedRegistry.set(isPollingAtom, false);
      addEvent('poll', 'Polling stopped', 'info');
    } else {
      // Start polling
      testbedRegistry.set(isPollingAtom, true);
      addEvent('poll', `Polling started (${pollInterval}ms interval)`, 'info');
      readStream(); // Initial read

      pollTimerRef.current = setInterval(() => {
        readStream();
      }, pollInterval);
    }
  }, [pollInterval, readStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Restart polling if interval changes
  useEffect(() => {
    if (isPolling && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        readStream();
      }, pollInterval);
    }
  }, [pollInterval, isPolling, readStream]);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">POLLING</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-neutral-400 block mb-1">
            Interval (ms)
          </label>
          <input
            type="number"
            value={pollInterval}
            onChange={(e) =>
              testbedRegistry.set(
                pollIntervalAtom,
                Math.max(500, parseInt(e.target.value) || 2000)
              )
            }
            min={500}
            step={500}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={togglePolling}
            disabled={connectionStatus !== 'connected'}
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
            {isPolling ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={readStream}
            disabled={connectionStatus !== 'connected'}
            className="px-4 py-2 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-neutral-500 space-y-1">
          <div className="flex justify-between">
            <span>Entries loaded:</span>
            <span className="text-white font-mono">{entries.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Current offset:</span>
            <span className="text-white font-mono truncate max-w-[120px]">
              {currentOffset || 'none'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STREAM ACTIONS PANEL
// =============================================================================

function StreamActionsPanel() {
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const streamId = useAtomValue(streamIdAtom);
  const streamExists = useAtomValue(streamExistsAtom);

  const deleteStream = useCallback(async () => {
    if (!confirm(`Delete stream "${streamId}"?`)) return;

    addEvent('client', `Deleting stream "${streamId}"...`, 'warning');

    try {
      await runWithClient(
        Effect.gen(function* () {
          const client = yield* NativeStreamClient;
          return yield* client.delete(streamId);
        })
      );

      testbedRegistry.set(streamExistsAtom, false);
      testbedRegistry.set(entriesAtom, []);
      testbedRegistry.set(currentOffsetAtom, '');
      addEvent('server', `Stream "${streamId}" deleted`, 'success');
    } catch (error) {
      addEvent('client', `Delete error: ${error}`, 'error');
    }
  }, [streamId]);

  const clearEntries = useCallback(() => {
    testbedRegistry.set(entriesAtom, []);
    testbedRegistry.set(currentOffsetAtom, '');
    addEvent('ui', 'Local entries cleared', 'info');
  }, []);

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-4 h-4 text-orange-400" />
        <span className="font-mono text-sm text-white">ACTIONS</span>
      </div>

      <div className="space-y-2">
        <button
          onClick={clearEntries}
          className="w-full px-4 py-2 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear Local
        </button>
        <button
          onClick={deleteStream}
          disabled={connectionStatus !== 'connected' || !streamExists}
          className="w-full px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Stream
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ENTRIES LIST
// =============================================================================

function EntriesList() {
  const entries = useAtomValue(entriesAtom);

  const eventTypeColors: Record<GeointEvent['type'], string> = {
    search: 'bg-cyan-500/20 text-cyan-400',
    entity_created: 'bg-green-500/20 text-green-400',
    entity_updated: 'bg-yellow-500/20 text-yellow-400',
    entity_deleted: 'bg-red-500/20 text-red-400',
    selection: 'bg-purple-500/20 text-purple-400',
    viewport_change: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4 flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-white" />
        <span className="font-mono text-sm text-white">STREAM ENTRIES</span>
        <span className="text-xs text-neutral-500 ml-auto">
          {entries.length} entries
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.offset}
            className="p-3 bg-neutral-900 border border-neutral-800 rounded"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  eventTypeColors[entry.data.type]
                }`}
              >
                {entry.data.type.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-[10px] text-neutral-600 font-mono ml-auto truncate max-w-[100px]">
                {entry.offset}
              </span>
            </div>
            {entry.data.entityId && (
              <div className="text-xs text-neutral-400">
                Entity:{' '}
                <span className="text-white font-mono">
                  {entry.data.entityId}
                </span>
                {entry.data.entityType && (
                  <span className="text-neutral-500">
                    {' '}
                    ({entry.data.entityType})
                  </span>
                )}
              </div>
            )}
            {entry.data.data?.['message'] && (
              <div className="text-xs text-neutral-300 mt-1">
                "{String(entry.data.data['message'])}"
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <div className="text-center text-neutral-500 text-sm py-8">
            No entries. Send an event or start polling.
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
    ui: 'bg-neutral-500/20 text-neutral-400',
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
        <span className="font-mono text-sm text-white">DATA FLOW</span>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs">
        <NodeBox
          label="UI Event"
          icon={Send}
          color="border-emerald-500/30 text-emerald-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="append()"
          icon={Zap}
          color="border-cyan-500/30 text-cyan-400"
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Server"
          icon={Server}
          color="border-purple-500/30 text-purple-400"
          active={connectionStatus === 'connected'}
        />
        <ArrowRight className="w-3 h-3 text-neutral-600" />
        <NodeBox
          label="Persist"
          icon={Database}
          color="border-orange-500/30 text-orange-400"
        />
      </div>

      <div className="flex items-center justify-center gap-2 text-xs mt-3">
        <NodeBox
          label="Timer"
          icon={Clock}
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
        <NodeBox label="UI" icon={Eye} color="border-white/30 text-white" />
      </div>
    </div>
  );
}

// =============================================================================
// MAIN TESTBED COMPONENT
// =============================================================================

export function DurableStreamsTestbed() {
  // Initialize on mount
  useEffect(() => {
    addEvent('ui', 'Durable Streams Testbed initialized', 'success');

    return () => {
      // Cleanup
      testbedRegistry.set(isPollingAtom, false);
    };
  }, []);

  return (
    <RegistryContext.Provider value={testbedRegistry as any}>
      <div className="min-h-screen bg-neutral-950 text-white p-6">
        <TestbedHeader
          title="Durable Streams Testbed"
          subtitle="Event streaming vertical slice: NativeStreamClient → append()/read() → Effect-atom → UI | Polling subscription pattern"
        />

        <div className="mt-6 grid grid-cols-12 gap-4">
          {/* Left Column - Controls */}
          <div className="col-span-3 space-y-4">
            <ConnectionPanel />
            <SendEventPanel />
            <PollingPanel />
            <StreamActionsPanel />
          </div>

          {/* Center Column - Entries */}
          <div className="col-span-6 flex flex-col gap-4">
            <DataFlowDiagram />
            <EntriesList />
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

export default DurableStreamsTestbed;
