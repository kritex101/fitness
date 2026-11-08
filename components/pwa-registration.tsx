'use client'

import { useEffect } from 'react'

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => {
      console.error('[pwa] service worker registration failed', error)
    })
  }, [])

  return null
}
