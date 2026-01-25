import { useEffect, useState } from 'react'
import '../assets/loading'
import '../assets/error'
import '../assets/no-ava'
import { DataPage } from './data'
import { isSSR, getWebSocketURL, createAvaClient } from '../../lib/ava-client-v2/ssr-detection'

export default function DataStreamPage() {
  const [client, setClient] = useState<any>(null)
  const [error, setError] = useState<string>(null)
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (isSSR()) {
      // Server-side: Already rendered with static data
      return
    }

    // Client-side: Initialize AVA client
    const initializeClient = async () => {
      try {
        const avaClient = createAvaClient()
        setClient(avaClient)
        setError(null)

        // Subscribe to AVA data stream
        const subscription = await avaClient.subscribeView({
          viewId: 'tmnl-data-demo',
          spec: {
            id: 'tmnl-data-demo',
            name: 'TMNL Data Demo',
            assemblageId: 'demo',
            version: 1,
            channels: [
              {
                id: 'data',
                role: 'state',
                source: { id: 'demo-data', kind: 'memory' },
                pipeline: []
              }
            ]
          }
        })

        // Handle incoming data
        for await (const delta of subscription) {
          setData(prev => [...prev, delta])
        }

        // Update stats
        setStats({
          connected: true,
          messagesReceived: data.length,
          lastUpdate: new Date().toISOString()
        })

      } catch (err) {
        console.error('Failed to initialize AVA client:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    initializeClient()
  }, [])

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-4">TMNL Data Stream</h1>
          <p className="text-sm opacity-75">Real-time AVA data streaming demo</p>
        </div>

        {client && (
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-gray-900 rounded p-6">
              <h2 className="text-xl font-bold mb-4">Connection Status</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Connected:</span>
                  <span className={stats?.connected ? 'text-green-400' : 'text-red-400'}>
                    {stats?.connected ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages:</span>
                  <span>{stats?.messagesReceived || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Update:</span>
                  <span>{stats?.lastUpdate || 'Never'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (client) {
                      client.subscribeView({
                        viewId: 'tmnl-data-demo-refresh',
                        spec: {
                          id: 'tmnl-data-demo-refresh',
                          name: 'TMNL Data Demo Refresh',
                          assemblageId: 'demo',
                          version: 1,
                          channels: [
                            {
                              id: 'refresh-trigger',
                              role: 'state',
                              source: { id: 'refresh', kind: 'memory' },
                              pipeline: []
                            }
                          ]
                        }
                      })
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  Trigger Refresh
                </button>
              </div>
            </div>

            <div className="bg-gray-900 rounded p-6">
              <h2 className="text-xl font-bold mb-4">Live Data</h2>
              <div className="space-y-2">
                {data.length === 0 ? (
                  <p className="text-gray-400">Waiting for data...</p>
                ) : (
                  <div className="space-y-2">
                    {data.slice(-10).map((item, index) => (
                      <div key={index} className="bg-gray-800 p-3 rounded">
                        <pre className="text-xs text-green-400">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900 rounded p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Connection Error</h2>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!client && !error && (
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-green-400 animate-spin"></div>
            <p className="text-xl">Initializing AVA Client...</p>
          </div>
        )}
      </div>
    </div>
  )
}
