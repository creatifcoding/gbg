import { Html } from '@next/html'

export default function ErrorPage() {
  return (
    <Html>
      <head>
        <title>TMNL Data - Connection Error</title>
      </head>
      <body className="min-h-screen bg-black text-red-400 flex items-center justify-center font-mono">
        <div className="text-center max-w-2xl mx-auto p-8">
          <div className="mb-8">
            <div className="w-16 h-16 border-4 border-red-500 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4M8 8v4M16 12h4M4 12h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold">Connection Error</h1>
          </div>
          <div className="bg-gray-900 rounded-lg p-6 mb-6">
            <p className="text-lg mb-4">Unable to connect to AVA Backend</p>
            <div className="text-sm space-y-2">
              <p><span className="text-gray-400">Status:</span> Connection failed</p>
              <p><span className="text-gray-400">URL:</span> {typeof window !== 'undefined' ? (window as any).__TMNL_CONFIG__?.AVA_BACKEND_URL : 'N/A'}</p>
              <p><span className="text-gray-400">Time:</span> {new Date().toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Retry Connection
            </button>
            <button 
              onClick={() => {
                if (typeof window !== 'undefined') {
                  (window as any).__TMNL_CONFIG__ = undefined;
                }
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Reset Configuration
            </button>
          </div>
        </div>
      </body>
    </Html>
  )
}
