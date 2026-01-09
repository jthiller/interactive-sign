import { useState, useEffect, useRef } from 'react'

/**
 * Hook to fetch color name from color.pizza API
 * Debounces requests to avoid hammering the API during drag
 *
 * @param {string} hex - Hex color string (with or without #)
 * @param {number} debounceMs - Debounce delay in milliseconds (default 150)
 * @returns {string} Color name or fallback
 */
export function useColorName(hex, debounceMs = 150) {
  const [colorName, setColorName] = useState('')
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (!hex) {
      setColorName('')
      return
    }

    // Remove # if present
    const cleanHex = hex.replace(/^#/, '')

    const timeoutId = setTimeout(async () => {
      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      try {
        const res = await fetch(
          `https://api.color.pizza/v1/?values=${cleanHex}`,
          { signal: abortControllerRef.current.signal }
        )

        if (res.ok) {
          const data = await res.json()
          if (data.colors?.[0]?.name) {
            setColorName(data.colors[0].name)
          }
        }
      } catch (e) {
        // Ignore abort errors and network failures
        if (e.name !== 'AbortError') {
          console.error('Failed to fetch color name:', e)
        }
      }
    }, debounceMs)

    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [hex, debounceMs])

  return colorName
}
