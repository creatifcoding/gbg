/**
 * TMNL DataManager v2 - Kernels
 *
 * Kernel implementations for the Universal DAQ system.
 *
 * @experimental v2 API - Universal DAQ pattern
 */

// ─────────────────────────────────────────────────────────────────────────────
// Search Kernel
// ─────────────────────────────────────────────────────────────────────────────

export {
  createSearchKernel,
  SearchKernel,
  type SearchKernelShape,
  type DriverInstance,
} from "./SearchKernel"

// ─────────────────────────────────────────────────────────────────────────────
// Future Kernels (Stubs)
// ─────────────────────────────────────────────────────────────────────────────

// TODO: WebSocketKernel - network:* namespace
// TODO: SSEKernel - network:* namespace
// TODO: FileWatchKernel - filesystem:* namespace
// TODO: SerialKernel - serial:* namespace
// TODO: USBKernel - hardware:* namespace
// TODO: HIDKernel - hardware:* namespace
