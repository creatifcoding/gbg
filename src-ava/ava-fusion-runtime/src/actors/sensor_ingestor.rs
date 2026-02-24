//! SensorIngestor — GenServer for NATS sensor ingestion.
//!
//! Pattern: `handle_info` receives NATS subscription messages; `handle_cast`
//! receives backpressure signals. Uses `CastOverflowPolicy::DropOldest` so
//! stale sensor readings are shed under load (latest-value-wins).
//!
//! Each SensorIngestor is per-source (one per NATS subject / feed type).
//! Supervised under `OneForOne` — individual feed failures don't affect others.

use std::future::Future;
use std::pin::Pin;

use ava_fusion::{SignalKind, SignalSourceId};
use asupersync::cx::Cx;
use asupersync::gen_server::{CastOverflowPolicy, GenServer, Reply};
use asupersync::types::Budget;

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/// Calls to the sensor ingestor (diagnostic / admin).
#[derive(Debug)]
pub enum IngestorCall {
    /// Request current buffer statistics.
    GetStats,
    /// Request the source identifier.
    GetSourceId,
}

/// Reply to ingestor calls.
#[derive(Debug)]
pub enum IngestorReply {
    /// Buffer statistics: (buffered_count, total_ingested, total_dropped).
    Stats {
        buffered: usize,
        total_ingested: u64,
        total_dropped: u64,
    },
    /// The source identifier.
    SourceId(SignalSourceId),
}

/// Cast messages for backpressure signaling.
#[derive(Debug)]
pub enum IngestorCast {
    /// Downstream is overwhelmed — shed load.
    BackpressureOn,
    /// Downstream recovered — resume normal ingestion.
    BackpressureOff,
}

/// Info messages: NATS subscription data + system messages.
#[derive(Debug)]
pub enum IngestorInfo {
    /// Raw sensor reading from NATS subscription.
    NatsMessage {
        /// NATS subject the message arrived on.
        subject: String,
        /// Raw payload bytes (deserialized downstream by FusionEngine).
        payload: Vec<u8>,
        /// Timestamp in epoch milliseconds from the NATS message header.
        timestamp_ms: f64,
    },
    /// Wrapped system message (Down/Exit/Timeout).
    System(asupersync::gen_server::SystemMsg),
}

// ---------------------------------------------------------------------------
// Actor state
// ---------------------------------------------------------------------------

/// Per-source sensor ingestion actor.
///
/// Buffers incoming NATS messages and forwards them to the fusion pipeline.
/// Under backpressure, incoming messages are dropped (DropOldest policy on
/// the cast mailbox) rather than blocking the NATS subscription.
pub struct SensorIngestor {
    /// Identifier for this sensor source.
    source_id: SignalSourceId,
    /// The kind of signal this ingestor handles.
    signal_kind: SignalKind,
    /// Internal buffer of pending readings awaiting downstream consumption.
    buffer: Vec<BufferedReading>,
    /// Maximum buffer capacity before internal shedding.
    max_buffer_size: usize,
    /// Whether downstream backpressure is active.
    backpressure_active: bool,
    /// Counters for observability.
    total_ingested: u64,
    total_dropped: u64,
}

/// A buffered sensor reading awaiting downstream dispatch.
#[derive(Debug, Clone)]
pub struct BufferedReading {
    pub subject: String,
    pub payload: Vec<u8>,
    pub timestamp_ms: f64,
}

impl SensorIngestor {
    /// Create a new sensor ingestor for the given source.
    pub fn new(source_id: SignalSourceId, signal_kind: SignalKind, max_buffer_size: usize) -> Self {
        Self {
            source_id,
            signal_kind,
            buffer: Vec::with_capacity(max_buffer_size),
            max_buffer_size,
            backpressure_active: false,
            total_ingested: 0,
            total_dropped: 0,
        }
    }

    /// Drain all buffered readings (called by downstream consumers).
    pub fn drain_buffer(&mut self) -> Vec<BufferedReading> {
        std::mem::take(&mut self.buffer)
    }

    /// Current buffer occupancy.
    pub fn buffer_len(&self) -> usize {
        self.buffer.len()
    }
}

// ---------------------------------------------------------------------------
// GenServer implementation
// ---------------------------------------------------------------------------

impl GenServer for SensorIngestor {
    type Call = IngestorCall;
    type Reply = IngestorReply;
    type Cast = IngestorCast;
    type Info = IngestorInfo;

    fn handle_call(
        &mut self,
        _cx: &Cx,
        request: Self::Call,
        reply: Reply<Self::Reply>,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            let response = match request {
                IngestorCall::GetStats => IngestorReply::Stats {
                    buffered: self.buffer.len(),
                    total_ingested: self.total_ingested,
                    total_dropped: self.total_dropped,
                },
                IngestorCall::GetSourceId => {
                    IngestorReply::SourceId(self.source_id.clone())
                }
            };
            let _ = reply.send(response);
        })
    }

    fn handle_cast(
        &mut self,
        cx: &Cx,
        msg: Self::Cast,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("sensor_ingestor::handle_cast");
        Box::pin(async move {
            match msg {
                IngestorCast::BackpressureOn => {
                    self.backpressure_active = true;
                }
                IngestorCast::BackpressureOff => {
                    self.backpressure_active = false;
                }
            }
        })
    }

    fn handle_info(
        &mut self,
        cx: &Cx,
        msg: Self::Info,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("sensor_ingestor::handle_info");
        Box::pin(async move {
            match msg {
                IngestorInfo::NatsMessage { subject, payload, timestamp_ms } => {
                    self.total_ingested += 1;

                    if self.backpressure_active || self.buffer.len() >= self.max_buffer_size {
                        // Shed load: drop oldest if buffer full, or skip entirely
                        // under backpressure.
                        if self.buffer.len() >= self.max_buffer_size && !self.buffer.is_empty() {
                            self.buffer.remove(0);
                        }
                        self.total_dropped += 1;
                    }

                    self.buffer.push(BufferedReading {
                        subject,
                        payload,
                        timestamp_ms,
                    });
                }
                IngestorInfo::System(_sys_msg) => {
                    // System messages (Down/Exit/Timeout) handled by supervision.
                }
            }
        })
    }

    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("sensor_ingestor::started");
        Box::pin(async move {
            tracing::info!(
                source_id = %self.source_id,
                signal_kind = ?self.signal_kind,
                max_buffer = self.max_buffer_size,
                "SensorIngestor started"
            );
        })
    }

    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        cx.trace("sensor_ingestor::stopped");
        Box::pin(async move {
            tracing::info!(
                source_id = %self.source_id,
                total_ingested = self.total_ingested,
                total_dropped = self.total_dropped,
                buffered_at_stop = self.buffer.len(),
                "SensorIngestor stopped"
            );
        })
    }

    fn on_stop_budget(&self) -> Budget {
        Budget::MINIMAL
    }

    fn cast_overflow_policy(&self) -> CastOverflowPolicy {
        // Latest-value-wins for sensor readings under load.
        CastOverflowPolicy::DropOldest
    }
}
