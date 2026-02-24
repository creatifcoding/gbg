/**
 * ECS Vertical Slice Testbed
 *
 * End-to-end integration of GEOINT subsystems with REAL infrastructure:
 * - FlightRepository → Postgres (real database queries)
 * - IngestionOrchestrator → Start/stop real data polling
 * - DurableStreams → Real event streaming
 * - Electric → Real-time Postgres sync
 * - Effect atoms → Reactive state
 *
 * NO MOCKS. This testbed demonstrates actual data flow:
 * API → Ingester → Postgres → Electric/DurableStream → Atoms → UI
 *
 * Route: /testbed/ecs-vertical-slice
 *
 * @module
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAtom, useAtomValue } from '@effect-atom/atom-react';
import { motion, AnimatePresence } from 'framer-motion';
// NOTE: Effect/Layer removed - browser only uses Electric sync, not direct PostgreSQL
import {
  Plane,
  RefreshCw,
  Layers,
  X,
  Clock,
  Database,
  Radio,
  Power,
  PowerOff,
  Activity,
} from 'lucide-react';
import { Atom } from '@effect-atom/atom';
import { TestbedHeader, SectionLabel } from './shared';

// ============================================================================
// GEOINT Schemas & Types
// ============================================================================

// SearchResultFlight type used for filtering in legend
// (Type checking uses string literal comparison, not runtime type)

// ============================================================================
// GEOINT Atoms (reactive state) - Using existing infrastructure
// ============================================================================

import {
  geointRegistry,
  resultsAtom,
  filteredResultsAtom,
  timelinePlaybackAtom,
  timelineFilteredResultsAtom,
  setSearchStatus,
  setTimelineEnabled,
  setTimelinePlayhead,
  initTimelineFromResults,
  type TimelinePlaybackState,
} from '@/lib/geoint/atoms';

// ============================================================================
// GEOINT Persistence - Types only (actual queries run server-side)
// ============================================================================

// NOTE: Browser does NOT connect to PostgreSQL directly.
// Data flows: Ingester (Node) → PostgreSQL → Electric Sync → Browser
// The browser only subscribes to Electric and DurableStreams.

// ============================================================================
// GEOINT Ingestion - Real data polling via Effect operations
// NOTE: Types imported from ingestion-operations (browser-safe) NOT from
// IngestionOrchestrator directly (which pulls in @effect/sql-pg)
// ============================================================================

import {
  // Types re-exported for browser safety
  type OrchestratorStatus,
  type IngesterName,
  // Atoms and operations
  ingestionStatusAtom,
  ingestionLoadingAtom,
  ingestionErrorAtom,
  startIngestion as startIngestionOp,
  stopIngestion as stopIngestionOp,
  toggleIngester as toggleIngesterOp,
  initializeIngestionStatus,
  streamConnectionStatusAtom,
  streamEventsCountAtom,
  subscribeToFlightStream,
  unsubscribeFromFlightStream,
  // Materializer
  materializerStatsAtom,
  materializerRunningAtom,
  materializerErrorAtom,
  startMaterializer as startMaterializerOp,
  stopMaterializer as stopMaterializerOp,
  type PgConfig,
  type MaterializerStats,
} from '@/lib/geoint/atoms/ingestion-operations';

// ============================================================================
// DurableStreams - Real event streaming (TODO: Wire real subscription)
// ============================================================================

// DurableStreams will be connected in next iteration
// From Holonet.

// ============================================================================
// ECS Electric Integration
// ============================================================================

import {
  useFlightEntitiesWithTraits,
  type FlightEntityWithTraits,
} from '@/lib/ecs/electric';

import {
  SearchResultFlight,
  Icao24,
  SearchResultId,
} from '@/lib/geoint/schemas';

// ============================================================================
// GEOINT Map Components
// ============================================================================

import {
  GeointMapPositioned,
  createGeointInstanceAtoms,
} from '@/lib/geoint/components';

// ============================================================================
// Constants
// ============================================================================

const INSTANCE_ID = 'ecs-vertical-slice-testbed';
const DURABLE_STREAMS_URL =
  import.meta.env['VITE_DURABLE_STREAMS_URL'] ?? 'http://localhost:8787';

// ============================================================================
// Testbed-local Atoms (ingestionStatusAtom is imported from ingestion-operations)
// ============================================================================

// NOTE: currentFlightsAtom removed - we use Electric sync (electricFlights) instead of direct DB queries

/** Last database query time */
const lastDbQueryAtom = Atom.make<Date | null>(null);

/** Connection status for database and electric (stream status from operations module) */
const connectionStatusAtom = Atom.make<{
  database: 'connected' | 'disconnected' | 'error';
  electric: 'connected' | 'disconnected' | 'error';
}>({
  database: 'disconnected',
  electric: 'disconnected',
});

// ============================================================================
// ECS Entity → SearchResult Converter
// ============================================================================

/**
 * Convert FlightEntityWithTraits to SearchResultFlight for map display.
 * This bridges the ECS entity system with the GEOINT search result format.
 */
function ecsFlightToSearchResult(
  entity: FlightEntityWithTraits
): typeof SearchResultFlight.Type {
  return SearchResultFlight.make({
    // Base fields (from SearchResultBase)
    id: SearchResultId.make(entity.entityId),
    source: 'adsb-lol', // ECS entities come from ingestion pipeline
    score: Math.max(0, Math.min(1, entity.confidence)), // Clamp to 0-1
    retrievedAt: new Date(),
    // Flight-specific fields
    icao24: Icao24.make(entity.icao24),
    callsign: entity.callsign ?? '',
    position: entity.position, // [lon, lat, alt] in meters
    velocity: Math.max(0, entity.speed), // m/s, ensure non-negative
    heading: ((entity.heading % 360) + 360) % 360, // Normalize to 0-360
    verticalRate: entity.verticalRate,
    onGround: entity.position[2] < 100, // Simple heuristic: < 100m altitude
    category: 'unknown', // Default category for ingested flights
    originCountry: 'Unknown', // Not available from ECS traits
    lastContact: entity.updatedAt,
  });
}

// ============================================================================
// Ingestion Status Panel
// ============================================================================

interface IngestionPanelProps {
  status: OrchestratorStatus | null;
  onStartAll: () => void;
  onStopAll: () => void;
  onToggleIngester: (name: IngesterName) => void;
  isStarting: boolean;
}

function IngestionPanel({
  status,
  onStartAll,
  onStopAll,
  onToggleIngester,
  isStarting,
}: IngestionPanelProps) {
  const running = status?.running ?? false;

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <span className="font-mono text-sm text-white">INGESTION</span>
        </div>
        <button
          onClick={running ? onStopAll : onStartAll}
          disabled={isStarting}
          className={`px-3 py-1.5 rounded text-xs flex items-center gap-1 border transition-colors ${
            running
              ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
          } ${isStarting ? 'opacity-50 cursor-wait' : ''}`}
        >
          {running ? (
            <>
              <PowerOff className="w-3 h-3" /> Stop
            </>
          ) : (
            <>
              <Power className="w-3 h-3" /> Start
            </>
          )}
        </button>
      </div>

      {status && (
        <div className="space-y-2">
          {/* Ingesters */}
          {status.ingesters.map((ingester) => (
            <div
              key={ingester.name}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-neutral-400 capitalize">
                {ingester.name}
              </span>
              <button
                onClick={() => onToggleIngester(ingester.name as IngesterName)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  ingester.running
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                }`}
              >
                {ingester.running ? 'Running' : 'Stopped'}
              </button>
            </div>
          ))}

          {/* Materializers Status */}
          <div className="border-t border-neutral-800 pt-2 mt-2 space-y-2">
            {/* Flight Materializer */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">Flight Materializer</span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    status.materializers.flight.running
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {status.materializers.flight.running ? 'Active' : 'Inactive'}
                </span>
              </div>
              {status.materializers.flight.running && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-cyan-400 font-mono">
                      {status.materializers.flight.eventsProcessed}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-mono">
                      {status.materializers.flight.entitiesCreated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-mono">
                      {status.materializers.flight.entitiesUpdated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Updated</div>
                  </div>
                </div>
              )}
            </div>

            {/* OSM Materializer */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">OSM Materializer</span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    status.materializers.osm.running
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {status.materializers.osm.running ? 'Active' : 'Inactive'}
                </span>
              </div>
              {status.materializers.osm.running && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-emerald-400 font-mono">
                      {status.materializers.osm.eventsProcessed}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-mono">
                      {status.materializers.osm.entitiesCreated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-mono">
                      {status.materializers.osm.entitiesUpdated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Updated</div>
                  </div>
                </div>
              )}
            </div>

            {/* Weather Materializer */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">Weather Materializer</span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    status.materializers.weather.running
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  {status.materializers.weather.running ? 'Active' : 'Inactive'}
                </span>
              </div>
              {status.materializers.weather.running && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-orange-400 font-mono">
                      {status.materializers.weather.eventsProcessed}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-mono">
                      {status.materializers.weather.entitiesCreated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-mono">
                      {status.materializers.weather.entitiesUpdated}
                    </div>
                    <div className="text-neutral-500 text-[10px]">Updated</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!status && (
        <div className="text-xs text-neutral-500 text-center py-2">
          Loading status...
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Database Status Panel
// ============================================================================

interface DatabasePanelProps {
  flightCount: number;
  lastQuery: Date | null;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  onRefresh: () => void;
  isLoading: boolean;
}

function DatabasePanel({
  flightCount,
  lastQuery,
  connectionStatus,
  onRefresh,
  isLoading,
}: DatabasePanelProps) {
  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-sm text-white">DATABASE</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded border border-neutral-700 hover:bg-neutral-800 transition-colors"
        >
          <RefreshCw
            className={`w-3 h-3 text-neutral-400 ${
              isLoading ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Status</span>
          <span
            className={`flex items-center gap-1 ${
              connectionStatus === 'connected'
                ? 'text-green-400'
                : connectionStatus === 'error'
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-green-400'
                  : connectionStatus === 'error'
                  ? 'bg-red-400'
                  : 'bg-yellow-400'
              }`}
            />
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400 flex items-center gap-1">
            <Plane className="w-3 h-3 text-yellow-400" /> Current Flights
          </span>
          <span className="text-white font-mono">{flightCount}</span>
        </div>

        {lastQuery && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Last Query</span>
            <span className="text-neutral-500 font-mono">
              {lastQuery.toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Stream Status Panel
// ============================================================================

interface StreamPanelProps {
  eventsCount: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  streamUrl: string;
}

function StreamPanel({
  eventsCount,
  connectionStatus,
  streamUrl,
}: StreamPanelProps) {
  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-4 h-4 text-purple-400" />
        <span className="font-mono text-sm text-white">DURABLE STREAM</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Status</span>
          <span
            className={`flex items-center gap-1 ${
              connectionStatus === 'connected'
                ? 'text-green-400'
                : connectionStatus === 'error'
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-green-400 animate-pulse'
                  : connectionStatus === 'error'
                  ? 'bg-red-400'
                  : 'bg-yellow-400'
              }`}
            />
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Events Received</span>
          <span className="text-white font-mono">{eventsCount}</span>
        </div>

        <div className="text-neutral-600 font-mono text-[10px] truncate">
          {streamUrl}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Materializer Panel
// ============================================================================

interface MaterializerPanelProps {
  stats: MaterializerStats;
  running: boolean;
  error: string | null;
  durableStreamsUrl: string;
  onStart: () => void;
  onStop: () => void;
}

function MaterializerPanel({
  stats,
  running,
  error,
  durableStreamsUrl,
  onStart,
  onStop,
}: MaterializerPanelProps) {
  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-sm text-white">ECS MATERIALIZER</span>
        </div>
        <button
          onClick={running ? onStop : onStart}
          className={`px-2 py-1 text-xs rounded ${
            running
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
          }`}
        >
          {running ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Status</span>
          <span
            className={`flex items-center gap-1 ${
              running ? 'text-green-400' : 'text-neutral-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                running ? 'bg-green-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            {running ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Events Processed</span>
          <span className="text-white font-mono">{stats.eventsProcessed}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Entities Created</span>
          <span className="text-cyan-400 font-mono">
            {stats.entitiesCreated}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Entities Updated</span>
          <span className="text-white font-mono">{stats.entitiesUpdated}</span>
        </div>

        {stats.lastEventAt && (
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">Last Event</span>
            <span className="text-white font-mono text-[10px]">
              {stats.lastEventAt.toLocaleTimeString()}
            </span>
          </div>
        )}

        {error && (
          <div className="text-red-400 font-mono text-[10px] mt-2">{error}</div>
        )}

        <div className="text-neutral-600 font-mono text-[10px] truncate mt-2">
          {durableStreamsUrl}/flights → entity.* tables
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Timeline Panel
// ============================================================================

interface TimelinePanelProps {
  timeline: TimelinePlaybackState;
  totalResults: number;
  filteredCount: number;
  onToggle: () => void;
  onPlayheadChange: (date: Date) => void;
}

function TimelinePanel({
  timeline,
  totalResults,
  filteredCount,
  onToggle,
  onPlayheadChange,
}: TimelinePanelProps) {
  const rangeMs = timeline.range.end.getTime() - timeline.range.start.getTime();
  const playheadPosition =
    ((timeline.playhead.getTime() - timeline.range.start.getTime()) / rangeMs) *
    100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value);
    const newTime = timeline.range.start.getTime() + (rangeMs * percent) / 100;
    onPlayheadChange(new Date(newTime));
  };

  return (
    <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="font-mono text-sm text-white">TIMELINE</span>
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-1 rounded text-xs border transition-colors ${
            timeline.enabled
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}
        >
          {timeline.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {timeline.enabled && (
        <div className="space-y-3">
          <input
            type="range"
            min={0}
            max={100}
            value={playheadPosition}
            onChange={handleSliderChange}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
          />

          <div className="flex justify-between text-xs text-neutral-500">
            <span>{timeline.range.start.toLocaleTimeString()}</span>
            <span className="text-purple-400 font-mono">
              {timeline.playhead.toLocaleTimeString()}
            </span>
            <span>{timeline.range.end.toLocaleTimeString()}</span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Visible</span>
            <span className="text-white font-mono">
              {filteredCount} / {totalResults}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Testbed Component
// ============================================================================

export function ECSVerticalSliceTestbed() {
  // Instance atoms for map (used by GeointMapPositioned)
  useMemo(() => createGeointInstanceAtoms(INSTANCE_ID), []);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ============================================================================
  // Postgres Config (from env vars)
  // ============================================================================

  const pgConfig: PgConfig = useMemo(
    () => ({
      host: import.meta.env['VITE_PG_HOST'] ?? 'localhost',
      port: parseInt(import.meta.env['VITE_PG_PORT'] ?? '5432'),
      database: import.meta.env['VITE_PG_DATABASE'] ?? 'tmnl',
      username: import.meta.env['VITE_PG_USER'] ?? 'tmnl',
      password: import.meta.env['VITE_PG_PASSWORD'] ?? 'tmnl_dev_password',
    }),
    []
  );

  // ============================================================================
  // Ingestion Atom Subscriptions (from ingestion-operations module)
  // ============================================================================

  const ingestionStatus = useAtomValue(ingestionStatusAtom);
  const ingestionLoading = useAtomValue(ingestionLoadingAtom);
  const ingestionError = useAtomValue(ingestionErrorAtom);

  // ============================================================================
  // Materializer Atom Subscriptions
  // ============================================================================

  const materializerStats = useAtomValue(materializerStatsAtom);
  const materializerRunning = useAtomValue(materializerRunningAtom);
  const materializerError = useAtomValue(materializerErrorAtom);

  // ============================================================================
  // Local Atom Subscriptions
  // ============================================================================

  // NOTE: currentFlights removed - using electricFlights from useFlightEntities hook
  const [lastDbQuery, setLastDbQuery] = useAtom(lastDbQueryAtom);
  const [connectionStatus, setConnectionStatus] = useAtom(connectionStatusAtom);
  const [streamEventsCount] = useAtom(streamEventsCountAtom);
  const streamConnectionStatus = useAtomValue(streamConnectionStatusAtom);

  // ============================================================================
  // GEOINT Atom Subscriptions
  // ============================================================================

  const results = useAtomValue(resultsAtom);
  const filteredResults = useAtomValue(filteredResultsAtom);
  const timelinePlayback = useAtomValue(timelinePlaybackAtom);
  const timelineResults = useAtomValue(timelineFilteredResultsAtom);

  // ============================================================================
  // Electric Hook (real-time sync with traits joined)
  // ============================================================================

  // Use the composite hook that joins entities with spatial/kinetic/identifiable traits
  const { data: electricFlights, isLoading: electricLoading } =
    useFlightEntitiesWithTraits();

  // Track Electric connection status
  useEffect(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      electric:
        electricFlights.length > 0 || !electricLoading
          ? 'connected'
          : 'disconnected',
    }));
  }, [electricFlights, electricLoading, setConnectionStatus]);

  // ============================================================================
  // Electric → GEOINT Results Bridge
  // ============================================================================

  // Convert Electric entities to SearchResultFlight and update geoint atoms
  useEffect(() => {
    if (electricFlights.length === 0) return;

    console.log(
      '[ECSVerticalSlice] Bridging',
      electricFlights.length,
      'Electric entities to GEOINT results'
    );

    // Convert ECS entities to SearchResultFlight format
    const searchResults = electricFlights.map(ecsFlightToSearchResult);

    // Update the geoint results atom (sync mutation via registry)
    geointRegistry.set(resultsAtom, searchResults);

    // Initialize timeline if we have results
    if (searchResults.length > 0) {
      initTimelineFromResults();
    }
  }, [electricFlights]);

  // ============================================================================
  // Database Query Effect
  // ============================================================================

  // NOTE: Browser does NOT query PostgreSQL directly.
  // Data comes via Electric sync (useFlightEntities hook).
  // This function just updates UI state based on Electric data.
  const refreshFromElectric = useCallback(() => {
    console.log('[ECSVerticalSlice] Refreshing from Electric sync...');
    setSearchStatus('searching');

    // Electric data is already subscribed via useFlightEntities hook
    // Update connection status based on Electric state
    if (electricFlights.length > 0) {
      setLastDbQuery(new Date());
      setConnectionStatus((prev) => ({ ...prev, database: 'connected' }));
      setSearchStatus('completed');
      console.log(
        '[ECSVerticalSlice] Electric sync has',
        electricFlights.length,
        'entities'
      );
    } else {
      setConnectionStatus((prev) => ({
        ...prev,
        database: electricLoading ? 'disconnected' : 'connected',
      }));
      setSearchStatus('completed');
      console.log(
        '[ECSVerticalSlice] No Electric entities yet (loading:',
        electricLoading,
        ')'
      );
    }
  }, [electricFlights, electricLoading, setLastDbQuery, setConnectionStatus]);

  // ============================================================================
  // Ingestion Control Effects (using real IngestionOrchestrator)
  // ============================================================================

  const startIngestion = useCallback(async () => {
    console.log('[ECSVerticalSlice] Starting real ingestion...');
    await startIngestionOp(pgConfig);
  }, [pgConfig]);

  const stopIngestion = useCallback(async () => {
    console.log('[ECSVerticalSlice] Stopping real ingestion...');
    await stopIngestionOp(pgConfig);
  }, [pgConfig]);

  const toggleIngester = useCallback(
    async (name: IngesterName) => {
      console.log('[ECSVerticalSlice] Toggling ingester:', name);
      await toggleIngesterOp(name, pgConfig);
    },
    [pgConfig]
  );

  // ============================================================================
  // Materializer Control Callbacks
  // ============================================================================

  const startMaterializer = useCallback(async () => {
    console.log('[ECSVerticalSlice] Starting materializer...');
    await startMaterializerOp(pgConfig, DURABLE_STREAMS_URL);
  }, [pgConfig]);

  const stopMaterializer = useCallback(async () => {
    console.log('[ECSVerticalSlice] Stopping materializer...');
    await stopMaterializerOp();
  }, []);

  // ============================================================================
  // Timeline Handlers
  // ============================================================================

  const handleToggleTimeline = useCallback(() => {
    const current = geointRegistry.get(timelinePlaybackAtom);
    if (!current.enabled) {
      initTimelineFromResults();
    } else {
      setTimelineEnabled(false);
    }
  }, []);

  // ============================================================================
  // Initial Load
  // ============================================================================

  useEffect(() => {
    // Refresh from Electric on mount
    refreshFromElectric();

    // Initialize ingestion status via operations module
    initializeIngestionStatus();

    // Subscribe to flight stream for real-time events
    subscribeToFlightStream(DURABLE_STREAMS_URL);

    // Cleanup: unsubscribe on unmount
    return () => {
      unsubscribeFromFlightStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Display Results
  // ============================================================================

  const displayResults = timelinePlayback.enabled
    ? timelineResults
    : filteredResults;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <TestbedHeader
        title="ECS Vertical Slice"
        subtitle="Real Database • Real Ingestion • Real Events"
        backLink="/"
      />

      {/* Main Content */}
      <div className="relative h-[calc(100vh-80px)] flex">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="w-80 bg-black/95 border-r border-neutral-800 z-20 flex flex-col overflow-y-auto"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-sm text-white">
                    CONTROL PANEL
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 space-y-4">
                {/* Ingestion Control */}
                <IngestionPanel
                  status={ingestionStatus}
                  onStartAll={startIngestion}
                  onStopAll={stopIngestion}
                  onToggleIngester={toggleIngester}
                  isStarting={
                    ingestionLoading.starting || ingestionLoading.stopping
                  }
                />

                {/* Show ingestion error if any */}
                {ingestionError && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                    <div className="font-mono mb-1">INGESTION ERROR</div>
                    <div className="text-red-300">{ingestionError}</div>
                  </div>
                )}

                {/* Database Status */}
                <DatabasePanel
                  flightCount={electricFlights.length}
                  lastQuery={lastDbQuery}
                  connectionStatus={connectionStatus.database}
                  onRefresh={refreshFromElectric}
                  isLoading={electricLoading}
                />

                {/* DurableStream Status */}
                <StreamPanel
                  eventsCount={streamEventsCount}
                  connectionStatus={streamConnectionStatus}
                  streamUrl={`${DURABLE_STREAMS_URL}/flights`}
                />

                {/* ECS Materializer Status */}
                <MaterializerPanel
                  stats={materializerStats}
                  running={materializerRunning}
                  error={materializerError}
                  durableStreamsUrl={DURABLE_STREAMS_URL}
                  onStart={startMaterializer}
                  onStop={stopMaterializer}
                />

                {/* Results Summary */}
                <div className="bg-black/90 border border-neutral-800 rounded-lg p-4">
                  <SectionLabel>Results</SectionLabel>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">
                        ECS Entities (Electric)
                      </span>
                      <span className="text-cyan-400 font-mono">
                        {electricFlights.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Displayed on Map</span>
                      <span className="text-white font-mono">
                        {displayResults.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <TimelinePanel
                  timeline={timelinePlayback}
                  totalResults={results.length}
                  filteredCount={timelineResults.length}
                  onToggle={handleToggleTimeline}
                  onPlayheadChange={setTimelinePlayhead}
                />

                {/* Architecture Info */}
                <div className="text-xs text-neutral-600 p-3 bg-neutral-900/50 rounded border border-neutral-800">
                  <div className="font-mono mb-2 text-neutral-500">
                    DATA FLOW
                  </div>
                  <div className="space-y-1">
                    <div>API → Ingester → Postgres</div>
                    <div>Postgres → Electric → React</div>
                    <div>Postgres → DurableStream → Atoms</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map */}
        <div className="flex-1 relative">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-30 p-2.5 rounded-lg bg-black/80 border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              <Layers className="w-5 h-5" />
            </button>
          )}

          <GeointMapPositioned
            instanceId={INSTANCE_ID}
            tracks={[]}
            threats={[]}
            initialViewState={{
              longitude: -122.42,
              latitude: 37.78,
              zoom: 11,
            }}
            height="100%"
            interactive={true}
            debug={true}
          />

          {/* Results come from Electric sync and are stored in geoint atoms */}
          {/* The VirtualizedResultsList or SearchPanel components would render them */}

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-black/90 border border-neutral-800 rounded-lg p-3 z-10">
            <div className="text-xs font-mono text-neutral-400 mb-2">
              LEGEND
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-neutral-300">
                  Flights (
                  {
                    displayResults.filter(
                      (r) => r._tag === 'SearchResultFlight'
                    ).length
                  }
                  )
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ECSVerticalSliceTestbed;
