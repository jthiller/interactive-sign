import { useState, useEffect, useRef, useCallback } from 'react'
import 'webrtc-adapter'
import { PartyTracks } from 'partytracks/client'
import { of } from 'rxjs'
import { API_BASE } from '../config'

// Brightness threshold (0-255) - below this is "dark"
const BRIGHTNESS_THRESHOLD = 100
// How often to sample brightness (ms)
const SAMPLE_INTERVAL = 2000
// Size of the sample canvas (small for performance)
const SAMPLE_SIZE = 32

export default function VideoPlayer({ onConnectionChange, onStatusChange, onThemeChange }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const partyTracksRef = useRef(null)
  const pullSubscriptionRef = useRef(null)
  const sessionSubscriptionRef = useRef(null)
  const brightnessIntervalRef = useRef(null)
  const isConnectingRef = useRef(false)
  const [status, setStatus] = useState('initializing')
  const [error, setError] = useState(null)

  // Sample brightness from the left side of the video
  const sampleBrightness = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Draw left third of video to canvas
    const sourceWidth = video.videoWidth / 3
    ctx.drawImage(
      video,
      0, 0, sourceWidth, video.videoHeight,  // source (left third)
      0, 0, SAMPLE_SIZE, SAMPLE_SIZE          // destination (small canvas)
    )

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    const pixels = imageData.data

    // Calculate average luminance
    let totalLuminance = 0
    const pixelCount = pixels.length / 4

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      // Standard luminance formula
      totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b
    }

    const avgBrightness = totalLuminance / pixelCount
    const isDark = avgBrightness < BRIGHTNESS_THRESHOLD

    if (onThemeChange) {
      onThemeChange(isDark ? 'dark' : 'light')
    }
  }, [onThemeChange])

  // Start/stop brightness sampling based on connection status
  useEffect(() => {
    if (status === 'connected') {
      // Initial sample after a short delay
      const initialTimeout = setTimeout(sampleBrightness, 500)
      // Then sample periodically
      brightnessIntervalRef.current = setInterval(sampleBrightness, SAMPLE_INTERVAL)

      return () => {
        clearTimeout(initialTimeout)
        if (brightnessIntervalRef.current) {
          clearInterval(brightnessIntervalRef.current)
        }
      }
    }
  }, [status, sampleBrightness])

  // Notify parent of connection status
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(status === 'connected')
    }
    if (onStatusChange) {
      onStatusChange(status)
    }
  }, [status, onConnectionChange, onStatusChange])

  const cleanup = useCallback(() => {
    if (pullSubscriptionRef.current) {
      pullSubscriptionRef.current.unsubscribe()
      pullSubscriptionRef.current = null
    }
    if (sessionSubscriptionRef.current) {
      sessionSubscriptionRef.current.unsubscribe()
      sessionSubscriptionRef.current = null
    }
    if (brightnessIntervalRef.current) {
      clearInterval(brightnessIntervalRef.current)
      brightnessIntervalRef.current = null
    }
    isConnectingRef.current = false
  }, [])

  const connectToStream = useCallback(async () => {
    if (isConnectingRef.current) return
    isConnectingRef.current = true

    try {
      setStatus('fetching')
      setError(null)

      const trackRes = await fetch(`${API_BASE}/track/current`)
      if (!trackRes.ok) {
        if (trackRes.status === 404) {
          throw new Error('No stream available')
        }
        throw new Error('Failed to get track info')
      }

      const trackInfo = await trackRes.json()
      setStatus('connecting')

      // Create PartyTracks if needed
      if (!partyTracksRef.current) {
        partyTracksRef.current = new PartyTracks({
          prefix: `${API_BASE}/partytracks`,
        })
      }

      sessionSubscriptionRef.current = partyTracksRef.current.session$.subscribe({
        next: (session) => {
          const trackMetadata$ = of({
            sessionId: trackInfo.sessionId,
            trackName: trackInfo.trackName,
            location: 'remote',
          })

          const pulledTrack$ = partyTracksRef.current.pull(trackMetadata$)

          pullSubscriptionRef.current = pulledTrack$.subscribe({
            next: (track) => {
              if (track && videoRef.current) {
                const stream = new MediaStream([track])
                videoRef.current.srcObject = stream
                // Only show connected state when video actually plays
                videoRef.current.play()
                  .then(() => setStatus('connected'))
                  .catch(() => {
                    // Autoplay blocked - keep background, show play button
                    setStatus('paused')
                  })
              }
            },
            error: (err) => {
              console.error('Video stream error:', err)
              setError(err.message)
              setStatus('error')
              isConnectingRef.current = false
            },
            complete: () => {
              setStatus('disconnected')
              isConnectingRef.current = false
            },
          })
        },
        error: (err) => {
          console.error('Session error:', err)
          setError(err.message)
          setStatus('error')
          isConnectingRef.current = false
        },
      })

    } catch (err) {
      console.error('Connection error:', err)
      setError(err.message)
      setStatus('error')
      isConnectingRef.current = false
    }
  }, [])

  useEffect(() => {
    let pollInterval
    let mounted = true

    const tryConnect = async () => {
      if (!mounted || isConnectingRef.current) return

      try {
        const res = await fetch(`${API_BASE}/track/current`)
        if (res.ok && mounted) {
          connectToStream()
        }
      } catch (e) {
        // Ignore, keep polling
      }
    }

    const initialTimeout = setTimeout(tryConnect, 500)

    pollInterval = setInterval(() => {
      if (!isConnectingRef.current) {
        tryConnect()
      }
    }, 5000)

    return () => {
      mounted = false
      clearTimeout(initialTimeout)
      clearInterval(pollInterval)
      cleanup()
    }
  }, [connectToStream, cleanup])

  const handleVideoClick = useCallback(() => {
    if (videoRef.current && status === 'paused') {
      videoRef.current.play()
        .then(() => setStatus('connected'))
        .catch(() => {})
    }
  }, [status])

  return (
    <div className="video-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        onClick={handleVideoClick}
        className={`video-player ${status === 'connected' ? 'connected' : ''}`}
      />
      {/* Hidden canvas for brightness sampling */}
      <canvas
        ref={canvasRef}
        width={SAMPLE_SIZE}
        height={SAMPLE_SIZE}
        style={{ display: 'none' }}
      />
    </div>
  )
}
