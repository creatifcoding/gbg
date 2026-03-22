import { Html } from '@next/html'

export default function NoAvaPage() {
  return (
    <Html>
      <head>
        <title>TMNL Data - AVA Unavailable</title>
      </head>
      <body className="min-h-screen bg-black text-yellow-400 flex items-center justify-center font-mono">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 border-2 border-yellow-400 bg-yellow-900/20 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M10 6l-4 14M4 10h16" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">AVA Backend Unavailable</h1>
          </div>
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl">
            <p className="text-lg mb-4">Unable to connect to AVA Backend</p>
            <div className="space-y-2">
              <p><span className="text-gray-400">Status:</span> Service not running or misconfigured</p>
              <p><span className="text-gray-400">Environment:</span> {typeof window !== 'undefined' ? 'Client' : 'Server'}</p>
              <p><span className="text-gray-400">URL:</span> {typeof window !== 'undefined' ? ((window as any).__TMNL_CONFIG__?.AVA_BACKEND_URL || 'Not configured') : (process.env.AVA_BACKEND_URL || 'Not configured'))}</p>
            </div>
          </div>
        </div>
      </body>
    </Html>
  )
}
