import { useCallback, useRef } from 'react'

/**
 * Custom hook for slider drag interactions
 * Handles mouse and touch events for both horizontal and vertical sliders
 *
 * @param {Object} options
 * @param {'horizontal' | 'vertical'} options.orientation - Slider orientation
 * @param {function} options.onChange - Callback with value in [min, max] range (default 0-100)
 * @param {number} options.min - Minimum value (default 0)
 * @param {number} options.max - Maximum value (default 100)
 * @returns {Object} Event handlers and ref
 */
export function useSliderDrag({ orientation = 'horizontal', onChange, min = 0, max = 100 }) {
  const railRef = useRef(null)
  const isDragging = useRef(false)

  const calculateValue = useCallback((clientX, clientY) => {
    if (!railRef.current) return null

    const rect = railRef.current.getBoundingClientRect()
    let ratio

    if (orientation === 'horizontal') {
      ratio = (clientX - rect.left) / rect.width
    } else {
      // For vertical, 0 is at bottom, 1 is at top (inverted)
      ratio = 1 - (clientY - rect.top) / rect.height
    }

    // Clamp between 0 and 1
    ratio = Math.max(0, Math.min(1, ratio))

    // Convert to value range
    const value = min + ratio * (max - min)
    return Math.round(value)
  }, [orientation, min, max])

  const updateValue = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const value = calculateValue(clientX, clientY)
    if (value !== null) {
      onChange(value)
    }
  }, [calculateValue, onChange])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true

    // Capture pointer for smooth dragging
    if (e.target.setPointerCapture && e.pointerId !== undefined) {
      e.target.setPointerCapture(e.pointerId)
    }

    updateValue(e)
  }, [updateValue])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return
    e.preventDefault()
    updateValue(e)
  }, [updateValue])

  const handlePointerUp = useCallback((e) => {
    isDragging.current = false
    if (e.target.releasePointerCapture && e.pointerId !== undefined) {
      e.target.releasePointerCapture(e.pointerId)
    }
  }, [])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e) => {
    isDragging.current = true
    updateValue(e)
  }, [updateValue])

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return
    e.preventDefault()
    updateValue(e)
  }, [updateValue])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
  }, [])

  // Keyboard support for accessibility
  const handleKeyDown = useCallback((e, currentValue) => {
    const step = (max - min) / 100 // 1% steps
    let newValue

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        newValue = Math.min(max, currentValue + step)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        newValue = Math.max(min, currentValue - step)
        break
      case 'Home':
        e.preventDefault()
        newValue = min
        break
      case 'End':
        e.preventDefault()
        newValue = max
        break
      default:
        return
    }

    onChange(Math.round(newValue))
  }, [onChange, min, max])

  return {
    railRef,
    railProps: {
      ref: railRef,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    handleKeyDown,
  }
}
