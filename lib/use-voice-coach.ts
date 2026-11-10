'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import { useAppSettings } from '@/components/app-settings-provider'

type VoiceCoachOptions = {
  gender: ExerciseVisualGender
}

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

export function useVoiceCoach({ gender }: VoiceCoachOptions) {
  const { preferences, voices, speechSupported, updateVoice } = useAppSettings()
  const enabled = preferences.voice.enabled
  const [supported, setSupported] = useState(false)
  const activeUtterances = useRef<SpeechSynthesisUtterance[]>([])
  const pendingSpeechStart = useRef<number | null>(null)
  const speechGeneration = useRef(0)

  const stop = useCallback(() => {
    speechGeneration.current += 1
    if (pendingSpeechStart.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(pendingSpeechStart.current)
      pendingSpeechStart.current = null
    }
    activeUtterances.current = []
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const toggle = useCallback(() => {
    if (enabled) stop()
    updateVoice({ enabled: !enabled })
  }, [enabled, stop, updateVoice])

  const speakText = useCallback((text: string) => {
    if (!enabled || !supported || typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return

    const synthesis = window.speechSynthesis
    if (!synthesis || typeof synthesis.cancel !== 'function' || typeof synthesis.speak !== 'function') return

    const sentences = splitIntoSentences(cleanSpeechText(text))
    if (sentences.length === 0) return

    stop()
    const requestGeneration = speechGeneration.current
    pendingSpeechStart.current = window.setTimeout(() => {
      pendingSpeechStart.current = null
      if (requestGeneration !== speechGeneration.current || !enabled || document.visibilityState === 'hidden') return

      const readySynthesis = window.speechSynthesis
      if (!readySynthesis || typeof readySynthesis.cancel !== 'function' || typeof readySynthesis.speak !== 'function' || typeof readySynthesis.getVoices !== 'function') return
      const availableVoices = readySynthesis.getVoices()
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
        if (requestGeneration !== speechGeneration.current) return
        if (index >= utterances.length) {
          activeUtterances.current = []
          return
        }

        const utterance = utterances[index]
        utterance.onend = () => speakNextSentence(index + 1)
        utterance.onerror = () => {
          if (requestGeneration === speechGeneration.current) speakNextSentence(index + 1)
        }
        try {
          readySynthesis.speak(utterance)
        } catch {
          activeUtterances.current = []
        }
      }

      speakNextSentence(0)
    }, 50)
  }, [enabled, gender, preferences.voice, stop, supported, voices])

  const testVoice = useCallback(() => {
    if (!supported || typeof window === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return
    const synthesis = window.speechSynthesis
    if (!synthesis || typeof synthesis.cancel !== 'function' || typeof synthesis.speak !== 'function') return
    stop()
    const availableVoices = synthesis.getVoices()
    const voice = selectedVoice(availableVoices, preferences.voice) ?? selectedVoice(voices, preferences.voice) ?? preferredVoice(availableVoices.length ? availableVoices : voices, gender)
    const utterance = new SpeechSynthesisUtterance('Your next set starts now. Keep your movement steady and breathe.')
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = navigator.language || 'en-US'
    }
    utterance.rate = preferences.voice.rate
    utterance.pitch = preferences.voice.pitch
    utterance.volume = preferences.voice.volume / 100
    activeUtterances.current = [utterance]
    utterance.onend = () => { activeUtterances.current = [] }
    utterance.onerror = () => { activeUtterances.current = [] }
    try {
      synthesis.speak(utterance)
    } catch {
      activeUtterances.current = []
    }
  }, [gender, preferences.voice, stop, supported, voices])

  useEffect(() => {
    setSupported(speechSupported && typeof SpeechSynthesisUtterance !== 'undefined')
  }, [speechSupported])

  useEffect(() => () => stop(), [stop])

  return { enabled, supported, toggle, speakText, stop, testVoice }
}
