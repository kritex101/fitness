'use client'

import { Headphones, Play, Sun } from 'lucide-react'
import { useVoiceCoach } from '@/lib/use-voice-coach'
import { useAppSettings, type ThemePreference } from '@/components/app-settings-provider'

function getVoiceAccent(lang: string) {
  if (!lang) return 'Accent not reported'
  try {
    const region = new Intl.Locale(lang).region
    return region ? new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? lang : new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) ?? lang
  } catch {
    return lang
  }
}

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System Default' },
]

export function SettingsControls({ idPrefix }: { idPrefix: string }) {
  const { preferences, voices, speechSupported, setTheme, updateVoice } = useAppSettings()
  const { testVoice } = useVoiceCoach({ gender: 'female' })
  const selectedVoice = voices.find((voice) => (
    (preferences.voice.voiceURI && voice.voiceURI === preferences.voice.voiceURI)
    || (preferences.voice.voiceName === voice.name && preferences.voice.voiceLang === voice.lang)
  ))
  const selectedVoiceIndex = selectedVoice ? voices.indexOf(selectedVoice) : -1

  return <div className="settings-controls">
    <section className="settings-group" aria-labelledby={`${idPrefix}-appearance-heading`}>
      <div className="settings-group-heading"><span className="settings-group-icon"><Sun size={17} aria-hidden="true" /></span><div><h2 id={`${idPrefix}-appearance-heading`}>Appearance</h2><p>Choose how FitPilot looks on this device.</p></div></div>
      <label className="settings-field" htmlFor={`${idPrefix}-theme`}><span><strong>Theme</strong><small>System default follows your device&apos;s appearance.</small></span><select id={`${idPrefix}-theme`} value={preferences.theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
        {themeOptions.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
      </select></label>
    </section>

    <section className="settings-group" aria-labelledby={`${idPrefix}-voice-heading`}>
      <div className="settings-group-heading"><span className="settings-group-icon"><Headphones size={17} aria-hidden="true" /></span><div><h2 id={`${idPrefix}-voice-heading`}>Voice Coach</h2><p>Set the voice and delivery used during guided workouts.</p></div></div>
      <label className="settings-switch" htmlFor={`${idPrefix}-voice-enabled`}><span><strong>Voice Coach</strong><small>Read countdowns and exercise instructions aloud.</small></span><input id={`${idPrefix}-voice-enabled`} type="checkbox" role="switch" checked={preferences.voice.enabled} onChange={(event) => updateVoice({ enabled: event.target.checked })} disabled={!speechSupported} /></label>
      {!speechSupported && <p className="settings-note" role="status">Speech synthesis is not available in this browser.</p>}
      {speechSupported && voices.length === 0 && <p className="settings-note" role="status">No system voice list is available yet. Automatic voice will use your browser&apos;s default.</p>}
      <label className="settings-field" htmlFor={`${idPrefix}-voice`}><span><strong>Voice</strong><small>Only voices currently provided by this browser are listed.</small></span><select id={`${idPrefix}-voice`} value={selectedVoiceIndex < 0 ? '' : String(selectedVoiceIndex)} onChange={(event) => {
        const voice = voices[Number(event.target.value)]
        updateVoice({ voiceURI: voice?.voiceURI ?? '', voiceName: voice?.name ?? '', voiceLang: voice?.lang ?? '' })
      }} disabled={!speechSupported}>
        <option value="">Automatic voice</option>
        {voices.map((voice, index) => <option key={`${voice.voiceURI}-${index}`} value={String(index)}>{voice.name} · {voice.lang || 'Language not reported'} · {getVoiceAccent(voice.lang)}{voice.localService ? '' : ' · online'}</option>)}
      </select></label>

      <div className="settings-range-list">
        <label className="settings-range" htmlFor={`${idPrefix}-pitch`}>
          <span className="settings-range-heading"><span><strong>Pitch</strong><small>Adjust how high or low the voice sounds.</small></span><output htmlFor={`${idPrefix}-pitch`}>{preferences.voice.pitch.toFixed(1)}</output></span>
          <input id={`${idPrefix}-pitch`} type="range" min="0.5" max="1.5" step="0.1" value={preferences.voice.pitch} onChange={(event) => updateVoice({ pitch: Number(event.target.value) })} disabled={!speechSupported} />
          <span className="settings-range-ends"><small>Lower</small><small>Higher</small></span>
        </label>
        <label className="settings-range" htmlFor={`${idPrefix}-rate`}>
          <span className="settings-range-heading"><span><strong>Speed</strong><small>Control the pace of spoken guidance.</small></span><output htmlFor={`${idPrefix}-rate`}>{preferences.voice.rate.toFixed(1)}×</output></span>
          <input id={`${idPrefix}-rate`} type="range" min="0.5" max="2" step="0.1" value={preferences.voice.rate} onChange={(event) => updateVoice({ rate: Number(event.target.value) })} disabled={!speechSupported} />
          <span className="settings-range-ends"><small>Slower</small><small>Faster</small></span>
        </label>
        <label className="settings-range" htmlFor={`${idPrefix}-volume`}>
          <span className="settings-range-heading"><span><strong>Volume</strong><small>Set the Voice Coach&apos;s output level.</small></span><output htmlFor={`${idPrefix}-volume`}>{preferences.voice.volume}%</output></span>
          <input id={`${idPrefix}-volume`} type="range" min="0" max="100" step="1" value={preferences.voice.volume} onChange={(event) => updateVoice({ volume: Number(event.target.value) })} disabled={!speechSupported} />
          <span className="settings-range-ends"><small>Quiet</small><small>Loud</small></span>
        </label>
      </div>
      <div className="settings-test-row"><p className="settings-note">Preview your current voice settings before starting a workout.</p><button className="secondary-button settings-test-button" type="button" onClick={testVoice} disabled={!speechSupported}><Play size={14} aria-hidden="true" /> Test voice</button></div>
    </section>
  </div>
}
