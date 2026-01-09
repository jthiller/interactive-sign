import { useRef, useCallback } from 'react'
import { hsbToRgb, rgbToHex } from '../../utils/colorConversions'

/**
 * 2D color picker area
 * X-axis: Hue (0-360°)
 * Y-axis: Saturation (100% at top, 0% at bottom)
 */
export default function ColorArea({ hue, saturation, brightness = 100, onHueChange, onSaturationChange }) {
  const areaRef = useRef(null)
  const isDragging = useRef(false)

  const updateFromPosition = useCallback((clientX, clientY) => {
    const rect = areaRef.current.getBoundingClientRect()

    // Calculate position as percentage (0-100)
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

    // X maps to hue (0-360)
    const newHue = (x / 100) * 360
    // Y maps to saturation (100 at top, 0 at bottom)
    const newSaturation = 100 - y

    onHueChange(newHue)
    onSaturationChange(newSaturation)
  }, [onHueChange, onSaturationChange])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    areaRef.current.setPointerCapture(e.pointerId)
    updateFromPosition(e.clientX, e.clientY)
  }, [updateFromPosition])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return
    e.preventDefault()
    updateFromPosition(e.clientX, e.clientY)
  }, [updateFromPosition])

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false
    areaRef.current.releasePointerCapture(e.pointerId)
  }, [])

  // Handle position (percentage) - let CSS overflow:hidden clip at edges
  const handleX = (hue / 360) * 100
  const handleY = 100 - saturation

  // Current color for handle border
  const currentRgb = hsbToRgb(hue, saturation, brightness)
  const handleColor = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const hueStep = 5
    const satStep = 5

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        onHueChange(Math.max(0, hue - hueStep))
        break
      case 'ArrowRight':
        e.preventDefault()
        onHueChange(Math.min(360, hue + hueStep))
        break
      case 'ArrowUp':
        e.preventDefault()
        onSaturationChange(Math.min(100, saturation + satStep))
        break
      case 'ArrowDown':
        e.preventDefault()
        onSaturationChange(Math.max(0, saturation - satStep))
        break
    }
  }

  return (
    <div
      ref={areaRef}
      className="color-area"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Color picker"
      aria-valuetext={`Hue ${Math.round(hue)}°, Saturation ${Math.round(saturation)}%`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Hue gradient layer (horizontal rainbow) */}
      <div className="color-area__hue" />
      {/* Saturation gradient layer (vertical white fade) */}
      <div className="color-area__saturation" />
      {/* Handle */}
      <div
        className="color-area__handle"
        style={{
          left: `${handleX}%`,
          top: `${handleY}%`,
          borderColor: handleColor,
        }}
      />
    </div>
  )
}
