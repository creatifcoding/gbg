/**
 * TMNL Markdown Render Context.
 *
 * Provides streaming state to md-components so they can gate
 * Framer Motion animations (no entrance re-fires during streaming).
 *
 * @module chat/msg/md-components/md-context
 */

import { createContext, useContext } from 'react'

interface MdRenderContext {
  /** True when Streamdown is in streaming mode */
  streaming: boolean
}

const MdCtx = createContext<MdRenderContext>({ streaming: false })

export const MdProvider = MdCtx.Provider
export const useMdContext = () => useContext(MdCtx)
