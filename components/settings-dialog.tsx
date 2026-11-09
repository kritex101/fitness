'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { SettingsControls } from '@/components/settings-controls'

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return <dialog ref={dialogRef} className="settings-dialog" aria-labelledby="settings-modal-title" onClose={onClose} onClick={(event) => {
    if (event.target === event.currentTarget) event.currentTarget.close()
  }}>
    <header className="settings-dialog-header"><div><p className="eyebrow">QUICK PREFERENCES</p><h2 id="settings-modal-title">Settings</h2></div><button type="button" className="modal-close" onClick={() => dialogRef.current?.close()} aria-label="Close settings"><X size={18} /></button></header>
    <SettingsControls idPrefix="settings-modal" />
  </dialog>
}
