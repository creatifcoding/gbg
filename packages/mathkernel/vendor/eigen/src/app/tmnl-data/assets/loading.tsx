import { Html } from '@next/html'

export default function LoadingPage() {
  return (
    <Html>
      <head>
        <title>TMNL Data Loading</title>
      </head>
      <body className="min-h-screen bg-black text-green-400 flex items-center justify-center font-mono">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-8 h-8 border-2 border-green-400 animate-spin"></div>
          </div>
          <p className="text-xl">Connecting to AVA Backend...</p>
          <p className="text-sm opacity-75">Establishing secure WebSocket connection</p>
        </div>
      </body>
    </Html>
  )
}
