/**
 * Get a human-readable color name based on HSB values
 */

const COLOR_NAMES = [
  { hue: 0, name: 'Red' },
  { hue: 15, name: 'Vermillion' },
  { hue: 30, name: 'Orange' },
  { hue: 45, name: 'Amber' },
  { hue: 60, name: 'Yellow' },
  { hue: 75, name: 'Lime' },
  { hue: 90, name: 'Chartreuse' },
  { hue: 120, name: 'Green' },
  { hue: 150, name: 'Spring Green' },
  { hue: 180, name: 'Cyan' },
  { hue: 195, name: 'Sky Blue' },
  { hue: 210, name: 'Azure' },
  { hue: 220, name: 'Nila Blue' },
  { hue: 240, name: 'Blue' },
  { hue: 270, name: 'Violet' },
  { hue: 285, name: 'Purple' },
  { hue: 300, name: 'Magenta' },
  { hue: 315, name: 'Rose' },
  { hue: 330, name: 'Crimson' },
  { hue: 345, name: 'Scarlet' },
  { hue: 360, name: 'Red' },
]

export function getColorName(hue, saturation, brightness) {
  // Handle achromatic colors
  if (saturation < 10) {
    if (brightness < 20) return 'Black'
    if (brightness < 40) return 'Dark Gray'
    if (brightness < 60) return 'Gray'
    if (brightness < 80) return 'Light Gray'
    return 'White'
  }

  // Handle very dark colors
  if (brightness < 15) {
    return 'Black'
  }

  // Find the closest hue name
  let closestName = COLOR_NAMES[0].name
  let closestDiff = 360

  for (const color of COLOR_NAMES) {
    const diff = Math.abs(hue - color.hue)
    const wrappedDiff = Math.min(diff, 360 - diff)
    if (wrappedDiff < closestDiff) {
      closestDiff = wrappedDiff
      closestName = color.name
    }
  }

  // Add modifiers based on saturation and brightness
  if (saturation < 30) {
    return `Pale ${closestName}`
  }
  if (brightness < 40) {
    return `Dark ${closestName}`
  }
  if (brightness > 90 && saturation > 80) {
    return `Bright ${closestName}`
  }

  return closestName
}
