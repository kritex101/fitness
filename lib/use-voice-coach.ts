'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import { useAppSettings } from '@/components/app-settings-provider'

type VoiceCoachOptions = {
  gender: ExerciseVisualGender
}

const MAX_REMOTE_TEXT_LENGTH = 1200
const REMOTE_TIMEOUT_MS = 6_000
const MAX_CACHED_CLIPS = 40
const TEST_PHRASE = 'Your next set starts now. Keep your movement steady and breathe.'

let remoteVoiceUnavailable = false
const remoteClipCache = new Map<string, string>()

const voiceNameMatchers: Record<ExerciseVisualGender, RegExp> = {
  female: /\b(female|woman|samantha|zira|victoria|karen|moira|tessa|susan|ava|aria)\b/i,
  male: /\b(male|man|david|daniel|mark|alex|fred|jorge|rishi|liam)\b/i,
}

function selectedVoice(voices: SpeechSynthesisVoice[], preferences: { voiceURI: string; voiceName: string; voiceLang: string }) {
  return voices.find((voice) => (
    (preferences.voiceURI && voice.voiceURI === preferences.voiceURI)
    || (preferences.voiceName && voice.name === preferences.voiceName && voice.lang === preferences.voiceLang)
  ))
}

function preferredVoice(voices: SpeechSynthesisVoice[], gender: ExerciseVisualGender) {
  if (voices.length === 0) return undefined

  const language = navigator.language.toLowerCase()
  const languageCode = language.split('-')[0]
  const matchingLanguage = voices.filter((voice) => voice.lang.toLowerCase() === language || voice.lang.toLowerCase().split('-')[0] === languageCode)
  const matcher = voiceNameMatchers[gender]

  return matchingLanguage.find((voice) => matcher.test(voice.name))
    ?? voices.find((voice) => matcher.test(voice.name))
    ?? matchingLanguage[0]
    ?? voices[0]
}

function cleanSpeechText(text: string) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/&quot;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;|&gt;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitIntoSentences(text: string) {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? []
}

function cacheRemoteClip(key: string, url: string) {
  remoteClipCache.set(key, url)
  if (remoteClipCache.size <= MAX_CACHED_CLIPS) return
  const oldestKey = remoteClipCache.keys().next().value
  if (oldestKey === undefined) return
  const oldestUrl = remoteClipCache.get(oldestKey)
  if (oldestUrl) URL.revokeObjectURL(oldestUrl)
  remoteClipCache.delete(oldestKey)
}

export function useVoiceCoach({ gender }: VoiceCoachOptions) {
  const { preferences, voices, speechSupported, updateVoice } = useAppSettings()
  const enabled = preferences.voice.enabled
  const [supported, setSupported] = useState(false)
  const activeUtterances = useRef<SpeechSynthesisUtterance[]>([])
  const pendingSpeechStart = useRef<number | null>(null)
  const speechGeneration = useRef(0)
  const remoteRequest = useRef<AbortController | null>(null)
  const remoteAudio = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    speechGeneration.current += 1
    if (pendingSpeechStart.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(pendingSpeechStart.current)
      pendingSpeechStart.current = null
    }
    remoteRequest.current?.abort()
    remoteRequest.current = null
    remoteAudio.current?.pause()
    activeUtterances.current = []
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const toggle = useCallback(() => {
    if (enabled) stop()
    updateVoice({ enabled: !enabled })
  }, [enabled, stop, updateVoice])

  const playRemoteSpeech = useCallback(async (text: string, generation: number) => {
    if (remoteVoiceUnavailable || text.length > MAX_REMOTE_TEXT_LENGTH || typeof Audio === 'undefined') return false

    const cacheKey = `${gender}:${text}`
    let clipUrl = remoteClipCache.get(cacheKey)
    if (!clipUrl) {
      const controller = new AbortController()
      remoteRequest.current = controller
      const timeoutId = window.setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)
      try {
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, gender }),
          signal: controller.signal,
        })
        if (!response.ok) {
          if (response.status === 503) remoteVoiceUnavailable = true
          return false
        }
        const clip = await response.blob()
        if (clip.size === 0) return false
        clipUrl = URL.createObjectURL(clip)
        cacheRemoteClip(cacheKey, clipUrl)
      } catch {
        return false
      } finally {
        window.clearTimeout(timeoutId)
        if (remoteRequest.current === controller) remoteRequest.current = null
      }
    }

    if (generation !== speechGeneration.current) return false
    const audio = remoteAudio.current ?? new Audio()
    remoteAudio.current = audio
    audio.src = clipUrl
    audio.volume = Math.min(1, Math.max(0, preferences.voice.volume / 100))
    audio.defaultPlaybackRate = preferences.voice.rate
    audio.playbackRate = preferences.voice.rate
    try {
      await audio.play()
      return true
    } catch {
      return false
    }
  }, [gender, preferences.voice.rate, preferences.voice.volume])

  const speakWithBrowser = useCallback((sentences: string[], generation: number) => {
    if (!supported || typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return

    pendingSpeechStart.current = window.setTimeout(() => {
      pendingSpeechStart.current = null
      if (generation !== speechGeneration.current || document.visibilityState === 'hidden') return

      const synthesis = window.speechSynthesis
      if (!synthesis || typeof synthesis.cancel !== 'function' || typeof synthesis.speak !== 'function' || typeof synthesis.getVoices !== 'function') return
      const availableVoices = synthesis.getVoices()
      const voice = selectedVoice(availableVoices, preferences.voice) ?? selectedVoice(voices, preferences.voice) ?? preferredVoice(availableVoices.length ? availableVoices : voices, gender)
      const utterances = sentences.map((sentence) => {
        const utterance = new SpeechSynthesisUtterance(sentence)
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        } else {
          utterance.lang = navigator.language || 'en-US'
        }
        utterance.rate = preferences.voice.rate
        utterance.pitch = preferences.voice.pitch
        utterance.volume = preferences.voice.volume / 100
        return utterance
      })
      activeUtterances.current = utterances

      const speakNextSentence = (index: number) => {
        if (generation !== speechGeneration.current) return
        if (index >= utterances.length) {
          activeUtterances.current = []
          return
        }

        const utterance = utterances[index]
        utterance.onend = () => speakNextSentence(index + 1)
        utterance.onerror = () => {
          if (generation === speechGeneration.current) speakNextSentence(index + 1)
        }
        try {
          synthesis.speak(utterance)
        } catch {
          activeUtterances.current = []
        }
      }

      speakNextSentence(0)
    }, 50)
  }, [gender, preferences.voice, supported, voices])

  const speak = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return
    const cleanedText = cleanSpeechText(text)
    const sentences = splitIntoSentences(cleanedText)
    if (sentences.length === 0) return

    stop()
    const generation = speechGeneration.current
    const playedRemotely = await playRemoteSpeech(cleanedText, generation)
    if (playedRemotely || generation !== speechGeneration.current) return
    speakWithBrowser(sentences, generation)
  }, [playRemoteSpeech, speakWithBrowser, stop])

  const speakText = useCallback((text: string) => {
    if (!enabled) return
    void speak(text)
  }, [enabled, speak])

  const testVoice = useCallback(() => {
    void speak(TEST_PHRASE)
  }, [speak])

  useEffect(() => {
    setSupported(speechSupported && typeof SpeechSynthesisUtterance !== 'undefined')
  }, [speechSupported])

  useEffect(() => () => stop(), [stop])

  return { enabled, supported, toggle, speakText, stop, testVoice }
}
