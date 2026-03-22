/**
 * IIoT Adapters
 *
 * Protocol-agnostic ingestion adapters for industrial sensor data.
 *
 * @module @gbg/tmnl/iiot/adapters
 */

export {
  IngestedReading,
  IngestionError,
  IngestionHealth,
  IngestionAdapter,
  type IngestionAdapterShape,
} from './ingestion'

export {
  MockAdapterConfig,
  MockAdapterLive,
} from './mock-adapter'

export {
  TopicRoute,
  TopicRouter,
  TopicRouterLive,
  matchGlob,
  type TopicRouterShape,
} from './device-routing'

export {
  mapQuality,
  mapOpcUaStatusCode,
  mapSparkplugQuality,
  qualityToScore,
} from './quality-mapping'

export {
  BatchConfig,
  ReadingProcessor,
  ReadingProcessorLive,
  type ReadingProcessorShape,
  type RoutedReading,
} from './reading-processor'

export {
  ThresholdStatus,
  SensorThresholds,
  ThresholdViolation,
  AlarmDetector,
  AlarmDetectorLive,
  checkThresholds,
  type AlarmDetectorShape,
} from './alarm-detection'

export {
  IngestionService,
  IngestionServiceLive,
  IngestionPipelineDevLayer,
  SparkplugPipelineLayer,
  setupPipeline,
  type IngestionServiceShape,
  type ProcessedBatch,
} from './ingestion-service'

export {
  IngestionChannelConfig,
  IngestionChannelBinding,
  createIngestionChannel,
  attachIngestionPipeline,
  type IngestionChannelConfig as IngestionChannelConfigType,
  type IngestionChannelBinding as IngestionChannelBindingType,
} from './ingestion-channel'

export {
  SparkplugAdapterConfig,
  SparkplugAdapterLive,
} from './sparkplug-adapter'

export {
  runPublisher,
  defaultPublisherConfig,
  type SparkplugPublisherConfig,
} from './sparkplug-publisher'

export { OpcUaAdapterStub } from './opcua-adapter-stub'
export { ModbusAdapterStub } from './modbus-adapter-stub'
