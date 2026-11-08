'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) {
      setHelpOpen((open) => !open)
      return
    }
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    else setHelpOpen(true)
    setInstallEvent(null)
  }

  if (installed) {
    return <span className="installed-label"><span aria-hidden="true" className="status-dot" /> App installed</span>
  }

  return (
    <div className="install-wrap">
      <button className="install-button" type="button" onClick={install} aria-expanded={helpOpen} aria-describedby={helpOpen ? 'install-help' : undefined}>
        <Download size={17} strokeWidth={2.2} aria-hidden="true" />
        <span>Install app</span>
      </button>
      {helpOpen && (
        <div className="install-help" id="install-help" role="status">
          <button className="help-close" type="button" aria-label="Close install instructions" onClick={() => setHelpOpen(false)}><X size={16} /></button>
          <strong>Get FitPilot on this device</strong>
          <p>In Chrome, open the browser menu and choose <b>Install FitPilot</b> or <b>Add to Home screen</b>.</p>
        </div>
      )}
    </div>
  )
}
