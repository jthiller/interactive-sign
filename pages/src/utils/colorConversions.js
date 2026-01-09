/**
 * Color conversion utilities for HSB color picker
 */

/**
 * Convert HSB (Hue, Saturation, Brightness) to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} b - Brightness (0-100)
 * @returns {{r: number, g: number, b: number}} RGB values (0-255)
 */
export function hsbToRgb(h, s, b) {
  const saturation = s / 100
  const brightness = b / 100
  const hue = h / 60

  const c = brightness * saturation
  const x = c * (1 - Math.abs((hue % 2) - 1))
  const m = brightness - c

  let r = 0, g = 0, blue = 0

  if (hue >= 0 && hue < 1) {
    r = c; g = x; blue = 0
  } else if (hue >= 1 && hue < 2) {
    r = x; g = c; blue = 0
  } else if (hue >= 2 && hue < 3) {
    r = 0; g = c; blue = x
  } else if (hue >= 3 && hue < 4) {
    r = 0; g = x; blue = c
  } else if (hue >= 4 && hue < 5) {
    r = x; g = 0; blue = c
  } else {
    r = c; g = 0; blue = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((blue + m) * 255)
  }
}

/**
 * Convert RGB to hex string
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} Hex color string (e.g., "#FF6B4A")
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Convert hex string to HSB
 * @param {string} hex - Hex color string (e.g., "#FF6B4A" or "FF6B4A")
 * @returns {{h: number, s: number, b: number}} HSB values
 */
export function hexToHsb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  let s = max === 0 ? 0 : (delta / max) * 100
  let brightness = max * 100

  if (delta !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6)
    } else if (max === g) {
      h = 60 * (((b - r) / delta) + 2)
    } else {
      h = 60 * (((r - g) / delta) + 4)
    }
  }

  if (h < 0) h += 360

  return {
    h: Math.round(h),
    s: Math.round(s),
    b: Math.round(brightness)
  }
}

/**
 * Get HSL string for CSS (useful for slider gradients)
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} HSL CSS string
 */
export function hslString(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * Convert HSB to HSL (for CSS usage)
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} b - Brightness (0-100)
 * @returns {{h: number, s: number, l: number}} HSL values
 */
export function hsbToHsl(h, s, b) {
  const saturation = s / 100
  const brightness = b / 100

  const l = brightness * (1 - saturation / 2)
  const sl = l === 0 || l === 1 ? 0 : (brightness - l) / Math.min(l, 1 - l)

  return {
    h: h,
    s: Math.round(sl * 100),
    l: Math.round(l * 100)
  }
}
