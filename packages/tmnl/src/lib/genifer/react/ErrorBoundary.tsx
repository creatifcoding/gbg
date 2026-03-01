/**
 * ComponentErrorBoundary — per-element error isolation for genifer renderer
 *
 * Wraps each ElementRenderer to prevent a single broken component from
 * crashing the entire generated tree.
 *
 * @module genifer/react/ErrorBoundary
 */

'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

export interface ComponentErrorBoundaryProps {
  /** Component type for error display */
  componentType: string
  /** Element key for debugging */
  elementKey: string
  /** Custom fallback renderer */
  fallback?: (error: Error, componentType: string, elementKey: string) => ReactNode
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Error boundary that catches render errors in a single genifer component
 * without crashing siblings or the parent tree.
 */
export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[genifer] Component error in ${this.props.componentType} (key: ${this.props.elementKey}):`,
      error,
      errorInfo.componentStack,
    )
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.props.componentType,
          this.props.elementKey,
        )
      }

      return (
        <div
          className="p-2 border border-dashed border-red-500/40 rounded my-1 bg-red-500/5"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-red-400"
              style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
            >
              ⚠ {this.props.componentType}
            </span>
            <span
              className="font-mono text-red-500/60"
              style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
            >
              {this.state.error.message}
            </span>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
