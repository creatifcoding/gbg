/**
 * Server-Side Rendering (SSR) detection utilities
 */

import { AvaClientV2 } from '../session-client'

/**
 * Detect if we're running in SSR mode
 */
export function isSSR(): boolean {
  return typeof window === 'undefined'
}

/**
 * Get WebSocket URL based on environment
 */
export function getWebSocketURL(): string {
  if (isSSR()) {
    // Server-side: use environment variable
    return process.env.AVA_BACKEND_URL || 'ws://localhost:4222'
  } else {
    // Client-side: use runtime config
    return (window as any).__TMNL_CONFIG__?.AVA_BACKEND_URL || 'ws://localhost:4222'
  }
}

/**
 * Initialize AVA client with proper configuration for current environment
 */
export function createAvaClient(): AvaClientV2 {
  const url = getWebSocketURL()
  
  if (isSSR()) {
    // Server-side: Create client with Node.js WebSocket
    const WebSocket = require('ws')
    return new AvaClientV2(url, WebSocket, {
      // Server-side specific options
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
    })
  } else {
    // Client-side: Use browser WebSocket with existing config
    return new AvaClientV2(url)
  }
}
