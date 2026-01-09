import { useState, useEffect, useRef, useCallback } from 'react'
import 'webrtc-adapter'
import { PartyTracks } from 'partytracks/client'
import { of } from 'rxjs'
import { API_BASE } from '../config'
import TVStatic from './TVStatic'

export default function VideoPlayer({
  onConnectionChange,
  onStatusChange,
  lowPowerMode = false,
  playRequested = false,
}) {
  const videoRef = useRef(null)
  const partyTracksRef = useRef(null)
  const pullSubscriptionRef = useRef(null)
  const sessionSubscriptionRef = useRef(null)
  const isConnectingRef = useRef(false)
  const [status, setStatus] = useState(lowPowerMode ? 'idle' : 'initializing')
  const [error, setError] = useState(null)

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

  // Handle low power mode changes
  useEffect(() => {
    if (lowPowerMode) {
      // Reset to idle when entering low power mode
      cleanup()
      setStatus('idle')
    }
  }, [lowPowerMode, cleanup])

  useEffect(() => {
    // Don't auto-connect in low power mode
    if (lowPowerMode) return

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
  }, [connectToStream, cleanup, lowPowerMode])

  const tryPlay = useCallback(() => {
    if (videoRef.current && status === 'paused') {
      videoRef.current.play()
        .then(() => setStatus('connected'))
        .catch(() => {})
    }
  }, [status])

  // Handle external play request (e.g., from StartStreamButton)
  useEffect(() => {
    if (playRequested) {
      tryPlay()
    }
  }, [playRequested, tryPlay])

  const handleVideoClick = useCallback(() => {
    tryPlay()
  }, [tryPlay])

  const showStatic = status !== 'connected'

  return (
    <div className="video-container">
      {showStatic && <TVStatic />}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        onClick={handleVideoClick}
        className={`video-player ${status === 'connected' ? 'connected' : ''}`}
      />
    </div>
  )
}
