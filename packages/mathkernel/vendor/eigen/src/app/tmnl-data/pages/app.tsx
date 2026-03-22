import { useEffect, useState } from 'react'
import '../assets/loading'
import '../assets/error'
import '../assets/no-ava'
import { DataPage } from './data'
import { isSSR, getWebSocketURL, createAvaClient } from '../../lib/ava-client-v2/ssr-detection'

export default function App() {
  const [client, setClient] = useState<any>(null)
  const [error, setError] = useState<string>(null)

  useEffect(() => {
    if (isSSR()) {
      // Client-side: Already rendered with static data
      return
    }

    // Client-side: Initialize AVA client
    const initializeClient = async () => {
      try {
        const avaClient = createAvaClient()
        setClient(avaClient)
        setError(null)
      } catch (err) {
        console.error('Failed to initialize AVA client:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    initializeClient()
  }, [])

  // Render different pages based on state
  if (client) {
    return <DataPage />
  } else if (error) {
    return <ErrorPage />
  } else {
    return <NoAvaPage />
  }
}
