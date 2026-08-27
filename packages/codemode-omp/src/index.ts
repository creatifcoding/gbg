/**
 * @tmnl/codemode-omp — OMP host renderer for codemode tools.
 *
 * The rendering stack lifted out of the agentstore extension: framed
 * status blocks, structured-result grid, primitive registry, steer
 * annotations, and the Pi-compat wrapper. Consumers bind a title via
 * createOmpToolRenderer and spread the result onto their tool definition.
 *
 * Consumers: agentstore ("as"), digishell_codemode ("digishell").
 */

export {
  createOmpToolRenderer,
  renderCall,
  renderResult,
  ompMsToolRenderer,
  type OmpToolRendererOptions,
  type MsToolDetails,
} from "./render-omp.ts"

export { gridLines } from "./grid.ts"
export { steer, renderAnnotations, type Annotation } from "./steer.ts"
export { tryParseJSON, typeLabel, type RenderContext, type RendererTheme } from "./render-core.ts"
export { isPrimitive, type Primitive } from "./primitives/types.ts"
export {
  createPrimitiveRegistry,
  registerAllPrimitives,
  type PrimitiveRegistry,
} from "./primitives/index.ts"
