import { useState, useEffect } from 'react'
import VideoPlayer from './VideoPlayer'
import ColorArea from './sliders/ColorArea'
import BrightnessSlider from './sliders/BrightnessSlider'
import SiteHeader from './SiteHeader'
import StartStreamButton from './StartStreamButton'
import QueueStatus from './QueueStatus'
import { hsbToRgb, rgbToHex } from '../utils/colorConversions'
import { getColorName } from '../utils/colorNames'
import { API_BASE } from '../config'

// Default color: blue (#0055FF) - H=220, S=100, B=50
const DEFAULT_HUE = 220
const DEFAULT_SATURATION = 100
const DEFAULT_BRIGHTNESS = 50

/**
 * Main HSB color picker with fullscreen video and floating toolbar
 */
export default function HSBFrame({ onBioClick, lowPowerMode, onStartStream }) {
  const [hue, setHue] = useState(DEFAULT_HUE)
  const [saturation, setSaturation] = useState(DEFAULT_SATURATION)
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS)
  const [isVideoConnected, setIsVideoConnected] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [queueDepth, setQueueDepth] = useState(0)
  const [remainingTime, setRemainingTime] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Display color (always at 100% brightness for swatch/name)
  const displayRgb = hsbToRgb(hue, saturation, 100)
  const displayHex = rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b)
  const colorName = getColorName(hue, saturation, 100)

  // Actual color with brightness for API submission
  const rgb = hsbToRgb(hue, saturation, brightness)

  // Fetch queue status
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch(`${API_BASE}/queue`)
        if (res.ok) {
          const data = await res.json()
          setQueueDepth(data.queueDepth || 0)
          setRemainingTime(data.remainingTime || 0)
        }
      } catch (e) {
        // Ignore errors
      }
    }

    fetchQueue()
    const interval = setInterval(fetchQueue, 3000)
    return () => clearInterval(interval)
  }, [])

  // Countdown timer for remaining time
  useEffect(() => {
    if (remainingTime <= 0) return

    const timer = setInterval(() => {
      setRemainingTime((t) => Math.max(0, t - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [remainingTime])

  const handleConnectionChange = (connected) => {
    setIsVideoConnected(connected)
  }

  const canSubmit = remainingTime === 0

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/led`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r: rgb.r, g: rgb.g, b: rgb.b }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.remainingTime) {
          setRemainingTime(data.remainingTime)
        }
        if (data.queueDepth !== undefined) {
          setQueueDepth(data.queueDepth)
        }
      }
    } catch (e) {
      console.error('Failed to set color:', e)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="hsb-frame">
      {/* Fullscreen video */}
      <div className="hsb-frame__video-area">
        <VideoPlayer
          onConnectionChange={handleConnectionChange}
          lowPowerMode={lowPowerMode}
        />

        {lowPowerMode && !isVideoConnected && (
          <StartStreamButton onClick={onStartStream} />
        )}
      </div>

      {/* Floating header */}
      <SiteHeader onNameClick={onBioClick} />

      {/* Floating bottom toolbar */}
      <div className="blur-frame blur-frame--toolbar">
        <div className="hsb-frame__toolbar">
          {/* Left: Info panel */}
          <div className="hsb-frame__info-panel">
            <div className="hsb-frame__color-row">
              <div
                className="hsb-frame__swatch"
                style={{ backgroundColor: displayHex }}
              />
              <div className="hsb-frame__color-details">
                <div className="hsb-frame__color-name">{colorName}</div>
                <div className="hsb-frame__color-hex">{displayHex}</div>
                <div className="hsb-frame__color-brightness">Brightness: {brightness}%</div>
              </div>
            </div>

            <button
              className="hsb-frame__submit"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Set Color'}
            </button>

            <div className="hsb-frame__status">
              <QueueStatus
                queueDepth={queueDepth}
                remainingTime={remainingTime}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>

          {/* Right: Brightness + 2D Color area */}
          <div className="hsb-frame__color-picker">
            <BrightnessSlider
              value={brightness}
              hue={hue}
              saturation={saturation}
              onChange={setBrightness}
              orientation={isMobile ? 'horizontal' : 'vertical'}
            />
            <ColorArea
              hue={hue}
              saturation={saturation}
              brightness={brightness}
              onHueChange={setHue}
              onSaturationChange={setSaturation}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
