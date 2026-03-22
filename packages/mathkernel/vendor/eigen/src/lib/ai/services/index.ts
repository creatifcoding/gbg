/**
 * AI Services
 */

export { AIService, type AIServiceShape, type StreamHandle } from './AIService'
export {
  fromVercelAIStream,
  fromClaudeAgentStream,
  fromAsyncCallback,
  accumulateStreamState,
} from './stream-adapter'
