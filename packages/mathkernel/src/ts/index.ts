/**
 * @tmnl/mathkernel — TypeScript API
 *
 * Re-exports the WASM bridge, marshalling utilities, and type-safe domain accessors.
 */

export {
  loadMathKernel,
  getMathKernel,
  isMathKernelLoaded,
  toF64,
  fromF64,
  flattenMatrix,
  unflattenMatrix,
  WASM_FUNCTIONS,
  OPCODE_TO_WASM,
  type WasmFunctionName,
  type MainModule,
} from './wasm-bridge';
