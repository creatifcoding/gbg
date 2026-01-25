import { Html } from '@next/html'

export default function DataPage() {
  return (
    <Html>
      <head>
        <title>TMNL Data Server</title>
      </head>
      <body className="min-h-screen bg-black text-green-400 font-mono">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-8 h-8 border-2 border-green-400 animate-spin"></div>
          </div>
          <p className="text-xl">TMNL Data API Server</p>
          <p className="text-sm opacity-75">Real-time AVA data streaming</p>
        </div>
      </body>
    </Html>
  )
}
