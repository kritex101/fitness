'use client'

import { Headphones, Play, Sun } from 'lucide-react'
import { useVoiceCoach } from '@/lib/use-voice-coach'
import { useAppSettings, type ThemePreference } from '@/components/app-settings-provider'

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System Default' },
]

export function SettingsControls({ idPrefix }: { idPrefix: string }) {
  const { preferences, voices, speechSupported, setTheme, updateVoice } = useAppSettings()
  const { testVoice } = useVoiceCoach({ gender: 'female' })
  const selectedVoiceAvailable = voices.some((voice) => voice.voiceURI === preferences.voice.voiceURI)

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
      <label className="settings-field" htmlFor={`${idPrefix}-voice`}><span><strong>Voice</strong><small>Available voices depend on your browser and device.</small></span><select id={`${idPrefix}-voice`} value={preferences.voice.voiceURI} onChange={(event) => updateVoice({ voiceURI: event.target.value })} disabled={!speechSupported}>
        <option value="">Automatic voice</option>
        {preferences.voice.voiceURI && !selectedVoiceAvailable && <option value={preferences.voice.voiceURI} disabled>Saved voice unavailable on this device</option>}
        {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.localService ? '' : ' · online'}</option>)}
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
