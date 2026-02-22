import type { BreakdownRequest, BreakdownRunState, TemplateBundle } from '../schema.ts'
import { getState, setState } from './atoms.ts'

const now = () => new Date().toISOString()

const withoutLastError = (state: BreakdownRunState): BreakdownRunState => {
  const { lastError: _ignored, ...rest } = state
  return rest
}

export function beginRun(request: BreakdownRequest): void {
  const prev = withoutLastError(getState())

  setState({
    ...prev,
    status: 'running',
    lastRequest: request,
    updatedAt: now(),
  })
}

export function completeRun(request: BreakdownRequest, bundle: TemplateBundle): void {
  const prev = withoutLastError(getState())

  setState({
    ...prev,
    status: 'done',
    runs: prev.runs + 1,
    lastRequest: request,
    lastBundle: bundle,
    updatedAt: now(),
  })
}

export function failRun(request: BreakdownRequest, error: string): void {
  const prev = getState()

  setState({
    ...prev,
    status: 'error',
    lastRequest: request,
    lastError: error,
    updatedAt: now(),
  })
}

export function snapshot(): BreakdownRunState {
  return getState()
}
