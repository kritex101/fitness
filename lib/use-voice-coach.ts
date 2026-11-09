'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

type VoiceCoachOptions = {
  gender: ExerciseVisualGender
  announcementId: string
  exerciseName: string
  targetGroup: string
  repCount: number
  shouldAnnounce: boolean
}

const voiceNameMatchers: Record<ExerciseVisualGender, RegExp> = {
  female: /\b(female|woman|samantha|zira|victoria|karen|moira|tessa|susan|ava|aria)\b/i,
  male: /\b(male|man|david|daniel|mark|alex|fred|jorge|rishi|liam)\b/i,
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

export function useVoiceCoach({ gender, announcementId, exerciseName, targetGroup, repCount, shouldAnnounce }: VoiceCoachOptions) {
  const [enabled, setEnabled] = useState(true)
  const [supported, setSupported] = useState(false)
  const lastAnnouncement = useRef('')

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const toggle = useCallback(() => {
    if (enabled) stop()
    else lastAnnouncement.current = ''
    setEnabled(!enabled)
  }, [enabled, stop])

  useEffect(() => {
    setSupported(typeof window.speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined')
  }, [])

  useEffect(() => {
    if (!shouldAnnounce) {
      stop()
      lastAnnouncement.current = ''
      return
    }
    if (!enabled || !supported || !announcementId || !exerciseName || repCount < 1) return

    const key = `${announcementId}:${gender}`
    if (lastAnnouncement.current === key) return

    const synthesis = window.speechSynthesis
    const voice = preferredVoice(synthesis.getVoices(), gender)
    const target = targetGroup.replace(/\s*[·•]\s*/g, ', ').trim() || 'the listed muscle group'
    const utterance = new SpeechSynthesisUtterance(`Starting ${Math.round(repCount)} reps of ${exerciseName}. Target muscle group: ${target}. Get ready... 3... 2... 1... Go!`)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = navigator.language || 'en-US'
    }
    utterance.rate = gender === 'female' ? 1.03 : 0.96
    utterance.pitch = gender === 'female' ? 1.08 : 0.92
    utterance.volume = 1

    try {
      synthesis.cancel()
      synthesis.speak(utterance)
      lastAnnouncement.current = key
    } catch {
      lastAnnouncement.current = ''
    }
  }, [announcementId, enabled, exerciseName, gender, repCount, shouldAnnounce, stop, supported, targetGroup])

  useEffect(() => () => stop(), [stop])

  return { enabled, supported, toggle, stop }
}
