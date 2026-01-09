import { useSliderDrag } from '../../hooks/useSliderDrag'
import { hsbToRgb, rgbToHex } from '../../utils/colorConversions'

/**
 * Brightness slider styled as a dimmer control
 * Shows gradient from black to current color (at full brightness)
 * Supports horizontal or vertical orientation
 */
export default function BrightnessSlider({ value, hue = 0, saturation = 100, onChange, orientation = 'horizontal' }) {
  const isVertical = orientation === 'vertical'

  const { railProps, handleKeyDown } = useSliderDrag({
    orientation,
    onChange,
    min: 0,
    max: 100,
  })

  // Calculate handle position
  const position = (value / 100) * 100

  // For vertical: 100% at top, 0% at bottom (inverted)
  const handleStyle = isVertical
    ? { top: `${100 - position}%`, left: '50%' }
    : { left: `${position}%`, top: '50%' }

  // Get the full brightness color for gradient end
  const fullBrightnessRgb = hsbToRgb(hue, saturation, 100)
  const fullBrightnessHex = rgbToHex(fullBrightnessRgb.r, fullBrightnessRgb.g, fullBrightnessRgb.b)

  // Dynamic gradient based on current hue/saturation
  const gradientStyle = isVertical
    ? { background: `linear-gradient(to top, #000000, ${fullBrightnessHex})` }
    : { background: `linear-gradient(to right, #000000, ${fullBrightnessHex})` }

  return (
    <div
      className={`slider-rail slider-rail--brightness slider-rail--brightness-${orientation}`}
      style={gradientStyle}
      {...railProps}
      role="slider"
      aria-label="Brightness"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-orientation={orientation}
      tabIndex={0}
      onKeyDown={(e) => handleKeyDown(e, value)}
    >
      <div
        className="slider-handle"
        style={handleStyle}
      />
    </div>
  )
}
