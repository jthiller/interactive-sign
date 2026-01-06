import { useState, useEffect, useCallback } from 'react'

const COOLDOWN_MS = 15000 // 15 seconds
const STORAGE_KEY = 'lastColorSubmit'
const QUEUE_THRESHOLD = 3 // Only enforce rate limit if queue >= 3

export function useRateLimit(queueDepth = 0) {
  const [canSubmit, setCanSubmit] = useState(true)
  const [remainingTime, setRemainingTime] = useState(0)

  // Check if rate limit should be enforced based on queue depth
  const shouldEnforceLimit = queueDepth >= QUEUE_THRESHOLD

  // Check initial state from localStorage
  useEffect(() => {
    if (!shouldEnforceLimit) {
      setCanSubmit(true)
      setRemainingTime(0)
      return
    }

    const lastSubmit = localStorage.getItem(STORAGE_KEY)
    if (lastSubmit) {
      const elapsed = Date.now() - parseInt(lastSubmit, 10)
      if (elapsed < COOLDOWN_MS) {
        setCanSubmit(false)
        setRemainingTime(Math.ceil((COOLDOWN_MS - elapsed) / 1000))
      }
    }
  }, [shouldEnforceLimit])

  // Countdown timer
  useEffect(() => {
    if (remainingTime > 0 && shouldEnforceLimit) {
      const timer = setTimeout(() => {
        setRemainingTime(remainingTime - 1)
        if (remainingTime - 1 <= 0) {
          setCanSubmit(true)
        }
      }, 1000)
      return () => clearTimeout(timer)
    } else if (!shouldEnforceLimit) {
      setCanSubmit(true)
    }
  }, [remainingTime, shouldEnforceLimit])

  const recordSubmit = useCallback(() => {
    const now = Date.now()
    localStorage.setItem(STORAGE_KEY, now.toString())
    // Only apply cooldown if queue is above threshold
    if (shouldEnforceLimit) {
      setCanSubmit(false)
      setRemainingTime(Math.ceil(COOLDOWN_MS / 1000))
    }
  }, [shouldEnforceLimit])

  return { canSubmit, remainingTime, recordSubmit }
}
