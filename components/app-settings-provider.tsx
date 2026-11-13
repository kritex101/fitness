'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

export type VoicePreferences = {
  enabled: boolean
  voiceURI: string
  voiceName: string
  voiceLang: string
  pitch: number
  rate: number
  volume: number
}

export type AppPreferences = {
  theme: ThemePreference
  voice: VoicePreferences
}

const STORAGE_KEY = 'fitpilot-settings-v1'
const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  voice: { enabled: true, voiceURI: '', voiceName: '', voiceLang: '', pitch: 1, rate: 1, volume: 100 },
}

const SettingsContext = createContext<{
  preferences: AppPreferences
  voices: SpeechSynthesisVoice[]
  speechSupported: boolean
  setTheme: (theme: ThemePreference) => void
  updateVoice: (updates: Partial<VoicePreferences>) => void
} | null>(null)

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function readPreferences(): AppPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFERENCES
    const value = parsed as Partial<AppPreferences>
    const voice = value.voice && typeof value.voice === 'object' ? value.voice : DEFAULT_PREFERENCES.voice
    return {
      theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : 'system',
      voice: {
        enabled: typeof voice.enabled === 'boolean' ? voice.enabled : true,
        voiceURI: typeof voice.voiceURI === 'string' ? voice.voiceURI.slice(0, 512) : '',
        voiceName: typeof voice.voiceName === 'string' ? voice.voiceName.slice(0, 256) : '',
        voiceLang: typeof voice.voiceLang === 'string' ? voice.voiceLang.slice(0, 64) : '',
        pitch: clamp(voice.pitch, 0.5, 1.5, 1),
        rate: clamp(voice.rate, 0.5, 2, 1),
        volume: clamp(voice.volume, 0, 100, 100),
      },
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [speechSupported, setSpeechSupported] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setPreferences(readPreferences())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark', 'theme-system')
    root.classList.add(`theme-${preferences.theme}`)
    root.style.colorScheme = preferences.theme === 'system' ? 'light dark' : preferences.theme
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Preferences remain available for the current session if storage is blocked.
    }
  }, [hydrated, preferences])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synthesis = window.speechSynthesis
    setSpeechSupported(typeof synthesis.speak === 'function' && typeof synthesis.cancel === 'function' && typeof SpeechSynthesisUtterance !== 'undefined')
    const updateVoices = () => {
      try {
        setVoices(synthesis.getVoices())
      } catch {
        setVoices([])
      }
    }
    updateVoices()
    const previousHandler = synthesis.onvoiceschanged
    synthesis.onvoiceschanged = updateVoices
    return () => {
      if (synthesis.onvoiceschanged === updateVoices) synthesis.onvoiceschanged = previousHandler
    }
  }, [])

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreferences((current) => ({ ...current, theme }))
  }, [])

  const updateVoice = useCallback((updates: Partial<VoicePreferences>) => {
    setPreferences((current) => ({ ...current, voice: { ...current.voice, ...updates } }))
  }, [])

  const contextValue = useMemo(() => ({ preferences, voices, speechSupported, setTheme, updateVoice }), [preferences, voices, speechSupported, setTheme, updateVoice])
  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>
}

export function useAppSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useAppSettings must be used inside AppSettingsProvider')
  return context
}
