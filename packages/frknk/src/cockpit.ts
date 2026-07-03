import { Schema } from "effect"

/**
 * TMNL SDR cockpit contracts.
 *
 * These schemas describe the FRKNK/TMNL seam for a profile-driven SDR cockpit:
 * profiles place compound islands into a three-column tiling layout; controls
 * emit typed operator commands; capability decisions decide whether commands
 * are live, simulated, locked, or unavailable.
 */

export const SdrHardwareKind = Schema.Literals([
  "unknown",
  "hermes_lite",
  "openhpsdr",
  "quisk_audio",
  "emulator",
] as const)
export type SdrHardwareKind = typeof SdrHardwareKind.Type

export const CockpitColumn = Schema.Literals([
  "header",
  "left",
  "center",
  "right",
  "drawer",
] as const)
export type CockpitColumn = typeof CockpitColumn.Type

export const CockpitTileSizeHint = Schema.Literals([
  "compact",
  "standard",
  "wide",
  "hero",
] as const)
export type CockpitTileSizeHint = typeof CockpitTileSizeHint.Type

export const CockpitIslandKind = Schema.Literals([
  "vfo_header",
  "signal_workbench",
  "selection_detail",
  "rf_frontend",
  "dsp_cleanup",
  "metering",
  "mode_filter",
  "capture_transport",
  "bookmarks",
  "hermes_diagnostics",
  "safe_tx",
  "command_island",
] as const)
export type CockpitIslandKind = typeof CockpitIslandKind.Type

export const DisplaySurface = Schema.Literals([
  "graph",
  "waterfall",
  "scope",
  "bandscope",
  "filter_response",
  "audio_fft",
  "config",
  "help",
  "diagnostics",
] as const)
export type DisplaySurface = typeof DisplaySurface.Type

export const DemodMode = Schema.Literals([
  "CWL",
  "CWU",
  "LSB",
  "USB",
  "AM",
  "FM",
  "DGT_U",
  "DGT_L",
  "DGT_FM",
  "DGT_IQ",
  "FDV_U",
  "FDV_L",
  "IMD",
] as const)
export type DemodMode = typeof DemodMode.Type

export const FilterPreset = Schema.Literals([
  "2000",
  "2200",
  "2500",
  "2800",
  "3000",
  "custom",
] as const)
export type FilterPreset = typeof FilterPreset.Type

export const SdrConnectionStatus = Schema.Literals([
  "disconnected",
  "discovering",
  "connected",
  "streaming",
  "error",
] as const)
export type SdrConnectionStatus = typeof SdrConnectionStatus.Type

export const CapabilityMode = Schema.Literals([
  "live",
  "simulated",
  "locked",
  "unavailable",
] as const)
export type CapabilityMode = typeof CapabilityMode.Type

export const ConfirmationLevel = Schema.Literals([
  "none",
  "confirm",
  "hold_to_arm",
  "external_approval",
] as const)
export type ConfirmationLevel = typeof ConfirmationLevel.Type

export const CaptureStatus = Schema.Literals([
  "idle",
  "recording",
  "playing",
  "paused",
  "error",
] as const)
export type CaptureStatus = typeof CaptureStatus.Type

export const CommandDraftStatus = Schema.Literals([
  "idle",
  "drafting",
  "awaiting_confirmation",
  "executing",
  "succeeded",
  "failed",
] as const)
export type CommandDraftStatus = typeof CommandDraftStatus.Type

export const CapabilityDecision = Schema.Struct({
  visible: Schema.Boolean,
  enabled: Schema.Boolean,
  mode: CapabilityMode,
  reason: Schema.optional(Schema.String),
  requiredTelemetry: Schema.optional(Schema.Array(Schema.String)),
  confirmationLevel: ConfirmationLevel,
  commandGuards: Schema.optional(Schema.Array(Schema.String)),
})
export type CapabilityDecision = typeof CapabilityDecision.Type

export const CockpitCapabilityMap = Schema.Record(Schema.String, CapabilityDecision)
export type CockpitCapabilityMap = typeof CockpitCapabilityMap.Type

export const CockpitCapabilities = Schema.Struct({
  receive: Schema.Boolean,
  transmit: Schema.Boolean,
  fullDuplex: Schema.Boolean,
  atu: Schema.Boolean,
  predistortion: Schema.Boolean,
  capture: Schema.Boolean,
  diagnostics: Schema.Boolean,
  agentCommands: Schema.Boolean,
})
export type CockpitCapabilities = typeof CockpitCapabilities.Type

export const CockpitIsland = Schema.Struct({
  islandId: Schema.String,
  kind: CockpitIslandKind,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  capabilityKeys: Schema.optional(Schema.Array(Schema.String)),
  defaultCollapsed: Schema.optional(Schema.Boolean),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
export type CockpitIsland = typeof CockpitIsland.Type

export const CockpitTile = Schema.Struct({
  tileId: Schema.String,
  islandId: Schema.String,
  preferredColumn: CockpitColumn,
  priority: Schema.Number,
  sizeHint: CockpitTileSizeHint,
  rowSpan: Schema.optional(Schema.Number),
  columnSpan: Schema.optional(Schema.Number),
  minHeightPx: Schema.optional(Schema.Number),
  maxHeightPx: Schema.optional(Schema.Number),
  capabilityKeys: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
export type CockpitTile = typeof CockpitTile.Type

export const CockpitLayoutProfile = Schema.Struct({
  columns: Schema.Array(CockpitColumn),
  tiles: Schema.Array(CockpitTile),
  drawerTileIds: Schema.optional(Schema.Array(Schema.String)),
  userDeltaId: Schema.optional(Schema.String),
})
export type CockpitLayoutProfile = typeof CockpitLayoutProfile.Type

export const CockpitCommandPolicy = Schema.Struct({
  dryRunRequired: Schema.Boolean,
  agentCommandsEnabled: Schema.Boolean,
  defaultConfirmationLevel: ConfirmationLevel,
  txRequiresExternalApproval: Schema.Boolean,
})
export type CockpitCommandPolicy = typeof CockpitCommandPolicy.Type

export const CockpitSafetyPolicy = Schema.Struct({
  txEnabled: Schema.Boolean,
  pttLockedReason: Schema.optional(Schema.String),
  unsafeControlKeys: Schema.Array(Schema.String),
  requireTelemetryBeforeTx: Schema.Array(Schema.String),
})
export type CockpitSafetyPolicy = typeof CockpitSafetyPolicy.Type

export class CockpitProfile extends Schema.TaggedClass<CockpitProfile>()(
  "CockpitProfile",
  {
    profileId: Schema.String,
    label: Schema.String,
    description: Schema.optional(Schema.String),
    hardwareKind: SdrHardwareKind,
    defaultReceiverId: Schema.String,
    capabilities: CockpitCapabilities,
    capabilityDecisions: CockpitCapabilityMap,
    islands: Schema.Array(CockpitIsland),
    layout: CockpitLayoutProfile,
    commandPolicy: CockpitCommandPolicy,
    safetyPolicy: CockpitSafetyPolicy,
    themeHints: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  },
) {}
export type CockpitProfileShape = typeof CockpitProfile.Type

export const SdrConnectionState = Schema.Struct({
  status: SdrConnectionStatus,
  hardwareKind: SdrHardwareKind,
  boardId: Schema.optional(Schema.Number),
  codeVersion: Schema.optional(Schema.String),
  macAddress: Schema.optional(Schema.String),
  ipAddress: Schema.optional(Schema.String),
  sampleRateHz: Schema.optional(Schema.Number),
  errorMessage: Schema.optional(Schema.String),
})
export type SdrConnectionState = typeof SdrConnectionState.Type

export const HermesDiscoveryState = Schema.Struct({
  discoveryCount: Schema.Number,
  lastDiscoveryUnixMs: Schema.optional(Schema.Number),
  boardId: Schema.optional(Schema.Number),
  codeVersion: Schema.optional(Schema.String),
  macAddress: Schema.optional(Schema.String),
  ipAddress: Schema.optional(Schema.String),
})
export type HermesDiscoveryState = typeof HermesDiscoveryState.Type

export const HermesControlState = Schema.Struct({
  sampleRateHz: Schema.Number,
  receiverCount: Schema.Number,
  rxFrequencyHz: Schema.Number,
  txFrequencyHz: Schema.Number,
  lnaDb: Schema.Number,
  mox: Schema.Boolean,
  lastControlSequence: Schema.optional(Schema.Number),
  lastUpdatedUnixMs: Schema.optional(Schema.Number),
})
export type HermesControlState = typeof HermesControlState.Type

export const HermesStreamStats = Schema.Struct({
  endpoint6Frames: Schema.Number,
  droppedFrames: Schema.Number,
  lastSequence: Schema.optional(Schema.Number),
  bytesReceived: Schema.Number,
  framesPerSecond: Schema.optional(Schema.Number),
  jitterMs: Schema.optional(Schema.Number),
})
export type HermesStreamStats = typeof HermesStreamStats.Type

export const FilterState = Schema.Struct({
  preset: FilterPreset,
  lowCutHz: Schema.Number,
  highCutHz: Schema.Number,
  bandwidthHz: Schema.Number,
  offsetHz: Schema.optional(Schema.Number),
})
export type FilterState = typeof FilterState.Type

export const ReceiverState = Schema.Struct({
  receiverId: Schema.String,
  vfoFrequencyHz: Schema.Number,
  txFrequencyHz: Schema.optional(Schema.Number),
  ritHz: Schema.Number,
  mode: DemodMode,
  filter: FilterState,
  muted: Schema.Boolean,
})
export type ReceiverState = typeof ReceiverState.Type

export const DisplayState = Schema.Struct({
  surface: DisplaySurface,
  centerFrequencyHz: Schema.Number,
  spanHz: Schema.Number,
  yScale: Schema.Number,
  yZero: Schema.Number,
  zoom: Schema.Number,
  selectedCandidateId: Schema.optional(Schema.String),
})
export type DisplayState = typeof DisplayState.Type

export const DspState = Schema.Struct({
  agcEnabled: Schema.Boolean,
  agcLevel: Schema.optional(Schema.Number),
  squelchEnabled: Schema.Boolean,
  squelchLevel: Schema.optional(Schema.Number),
  noiseReductionEnabled: Schema.Boolean,
  noiseReductionMode: Schema.optional(Schema.String),
  noiseBlankerEnabled: Schema.Boolean,
  noiseBlankerLevel: Schema.optional(Schema.Number),
  notchEnabled: Schema.Boolean,
  muted: Schema.Boolean,
})
export type DspState = typeof DspState.Type

export const RfFrontendState = Schema.Struct({
  lnaDb: Schema.Number,
  antenna: Schema.String,
  rfGainDb: Schema.optional(Schema.Number),
  attenuatorDb: Schema.optional(Schema.Number),
  preampEnabled: Schema.optional(Schema.Boolean),
})
export type RfFrontendState = typeof RfFrontendState.Type

export const CaptureTransportState = Schema.Struct({
  status: CaptureStatus,
  captureId: Schema.optional(Schema.String),
  targetUri: Schema.optional(Schema.String),
  durationSeconds: Schema.Number,
  sampleCount: Schema.Number,
  droppedFrames: Schema.Number,
  label: Schema.optional(Schema.String),
})
export type CaptureTransportState = typeof CaptureTransportState.Type

export const TxSafetyState = Schema.Struct({
  txEnabled: Schema.Boolean,
  pttLockedReason: Schema.optional(Schema.String),
  unsafeControlKeys: Schema.Array(Schema.String),
  activeLocks: Schema.Array(Schema.String),
})
export type TxSafetyState = typeof TxSafetyState.Type

export const CommandIslandState = Schema.Struct({
  status: CommandDraftStatus,
  prompt: Schema.optional(Schema.String),
  draftCommandIds: Schema.Array(Schema.String),
  lastResult: Schema.optional(Schema.String),
  errorMessage: Schema.optional(Schema.String),
})
export type CommandIslandState = typeof CommandIslandState.Type

export const HermesDiagnosticsState = Schema.Struct({
  discovery: HermesDiscoveryState,
  control: HermesControlState,
  stream: HermesStreamStats,
})
export type HermesDiagnosticsState = typeof HermesDiagnosticsState.Type

export class CockpitRuntimeSnapshot extends Schema.TaggedClass<CockpitRuntimeSnapshot>()(
  "CockpitRuntimeSnapshot",
  {
    snapshotId: Schema.String,
    profileId: Schema.String,
    capturedAtUnixMs: Schema.Number,
    connection: SdrConnectionState,
    receiver: ReceiverState,
    display: DisplayState,
    dsp: DspState,
    rfFrontend: RfFrontendState,
    capture: CaptureTransportState,
    txSafety: TxSafetyState,
    commandIsland: CommandIslandState,
    hermes: Schema.optional(HermesDiagnosticsState),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  },
) {}
export type CockpitRuntimeSnapshotShape = typeof CockpitRuntimeSnapshot.Type

export const OperatorCommandEnvelope = Schema.Struct({
  commandId: Schema.String,
  issuedAtUnixMs: Schema.Number,
  source: Schema.Literals(["ui", "profile", "agent", "automation"] as const),
  dryRun: Schema.Boolean,
  reason: Schema.optional(Schema.String),
})
export type OperatorCommandEnvelope = typeof OperatorCommandEnvelope.Type

export class RequestHermesDiscoveryCommand extends Schema.TaggedClass<RequestHermesDiscoveryCommand>()(
  "RequestHermesDiscoveryCommand",
  {
    envelope: OperatorCommandEnvelope,
  },
) {}
export type RequestHermesDiscoveryCommandShape = typeof RequestHermesDiscoveryCommand.Type

export class SetHermesStreamCommand extends Schema.TaggedClass<SetHermesStreamCommand>()(
  "SetHermesStreamCommand",
  {
    envelope: OperatorCommandEnvelope,
    streaming: Schema.Boolean,
  },
) {}
export type SetHermesStreamCommandShape = typeof SetHermesStreamCommand.Type

export class TuneReceiverCommand extends Schema.TaggedClass<TuneReceiverCommand>()(
  "TuneReceiverCommand",
  {
    envelope: OperatorCommandEnvelope,
    receiverId: Schema.String,
    frequencyHz: Schema.Number,
  },
) {}
export type TuneReceiverCommandShape = typeof TuneReceiverCommand.Type

export class SetDemodModeCommand extends Schema.TaggedClass<SetDemodModeCommand>()(
  "SetDemodModeCommand",
  {
    envelope: OperatorCommandEnvelope,
    receiverId: Schema.String,
    mode: DemodMode,
  },
) {}
export type SetDemodModeCommandShape = typeof SetDemodModeCommand.Type

export class SetFilterCommand extends Schema.TaggedClass<SetFilterCommand>()(
  "SetFilterCommand",
  {
    envelope: OperatorCommandEnvelope,
    receiverId: Schema.String,
    filter: FilterState,
  },
) {}
export type SetFilterCommandShape = typeof SetFilterCommand.Type

export class SetRfLnaCommand extends Schema.TaggedClass<SetRfLnaCommand>()(
  "SetRfLnaCommand",
  {
    envelope: OperatorCommandEnvelope,
    lnaDb: Schema.Number,
  },
) {}
export type SetRfLnaCommandShape = typeof SetRfLnaCommand.Type

export class SetDisplaySurfaceCommand extends Schema.TaggedClass<SetDisplaySurfaceCommand>()(
  "SetDisplaySurfaceCommand",
  {
    envelope: OperatorCommandEnvelope,
    surface: DisplaySurface,
  },
) {}
export type SetDisplaySurfaceCommandShape = typeof SetDisplaySurfaceCommand.Type

export class StartIqCaptureCommand extends Schema.TaggedClass<StartIqCaptureCommand>()(
  "StartIqCaptureCommand",
  {
    envelope: OperatorCommandEnvelope,
    targetUri: Schema.String,
    label: Schema.optional(Schema.String),
  },
) {}
export type StartIqCaptureCommandShape = typeof StartIqCaptureCommand.Type

export class StopIqCaptureCommand extends Schema.TaggedClass<StopIqCaptureCommand>()(
  "StopIqCaptureCommand",
  {
    envelope: OperatorCommandEnvelope,
    captureId: Schema.String,
  },
) {}
export type StopIqCaptureCommandShape = typeof StopIqCaptureCommand.Type

export class MarkSignalCandidateCommand extends Schema.TaggedClass<MarkSignalCandidateCommand>()(
  "MarkSignalCandidateCommand",
  {
    envelope: OperatorCommandEnvelope,
    candidateId: Schema.String,
    label: Schema.optional(Schema.String),
  },
) {}
export type MarkSignalCandidateCommandShape = typeof MarkSignalCandidateCommand.Type

export const SdrOperatorCommand = Schema.Union([
  RequestHermesDiscoveryCommand,
  SetHermesStreamCommand,
  TuneReceiverCommand,
  SetDemodModeCommand,
  SetFilterCommand,
  SetRfLnaCommand,
  SetDisplaySurfaceCommand,
  StartIqCaptureCommand,
  StopIqCaptureCommand,
  MarkSignalCandidateCommand,
])
export type SdrOperatorCommand = typeof SdrOperatorCommand.Type

export const decodeCockpitProfile = Schema.decodeUnknownSync(CockpitProfile)
export const decodeCockpitRuntimeSnapshot = Schema.decodeUnknownSync(CockpitRuntimeSnapshot)
export const decodeSdrOperatorCommand = Schema.decodeUnknownSync(SdrOperatorCommand)
