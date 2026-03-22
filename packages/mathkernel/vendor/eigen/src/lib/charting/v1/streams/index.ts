/**
 * TMNL Charting v1 - Streams
 *
 * Re-export streaming primitives.
 */

export { RingBuffer } from "./RingBuffer"
export {
  RealtimeSignalGenerator,
  generateSignal,
  generateDualSignal,
  sineWave,
  noiseSignal,
  stepSignal,
  type GeneratorFunction,
  type SignalConfig,
} from "./SignalGenerator"
