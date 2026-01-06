import { useState, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useRateLimit } from '../hooks/useRateLimit'
import QueueStatus from './QueueStatus'

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

export default function ColorPanel({ isOpen, onClose }) {
  const [color, setColor] = useState('#6366f1')
  const [colorName, setColorName] = useState('Indigo')
  const [queueDepth, setQueueDepth] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { canSubmit, remainingTime, recordSubmit } = useRateLimit(queueDepth)

  // Fetch color name from meodai's API
  useEffect(() => {
    const fetchColorName = async () => {
      try {
        const hex = color.replace('#', '')
        const res = await fetch(`https://api.color.pizza/v1/${hex}`)
        const data = await res.json()
        if (data.colors?.[0]?.name) {
          setColorName(data.colors[0].name)
        }
      } catch (err) {
        setColorName(color.toUpperCase())
      }
    }

    const debounce = setTimeout(fetchColorName, 300)
    return () => clearTimeout(debounce)
  }, [color])

  // Fetch queue depth periodically when panel is open
  useEffect(() => {
    if (!isOpen) return

    const fetchQueue = async () => {
      try {
        const res = await fetch('/queue')
        const data = await res.json()
        setQueueDepth(data.queueDepth || 0)
      } catch (err) {
        console.error('Failed to fetch queue:', err)
      }
    }

    fetchQueue()
    const interval = setInterval(fetchQueue, 2000)
    return () => clearInterval(interval)
  }, [isOpen])

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    const rgb = hexToRgb(color)
    if (!rgb) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/led', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rgb)
      })

      if (res.ok) {
        const data = await res.json()
        setQueueDepth(data.queueDepth || 0)
        recordSubmit()
      }
    } catch (err) {
      console.error('Failed to submit color:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`color-panel ${isOpen ? 'open' : ''}`}>
      <div className="picker-container">
        <HexColorPicker color={color} onChange={setColor} />
      </div>

      <div className="color-info">
        <div
          className="color-preview"
          style={{ backgroundColor: color }}
        />
        <div>
          <div className="color-name">{colorName}</div>
          <div className="color-hex">{color.toUpperCase()}</div>
        </div>
      </div>

      <button
        className="submit"
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? 'Sending...' : 'Set Color'}
      </button>

      <QueueStatus
        queueDepth={queueDepth}
        remainingTime={remainingTime}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
