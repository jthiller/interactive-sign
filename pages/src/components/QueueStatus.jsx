export default function QueueStatus({ queueDepth, remainingTime, isSubmitting }) {
  if (isSubmitting) {
    return <div className="queue-status">Sending...</div>
  }

  if (remainingTime > 0) {
    return (
      <div className="queue-status waiting">
        Wait {remainingTime}s to submit again
      </div>
    )
  }

  if (queueDepth > 0) {
    return (
      <div className="queue-status waiting">
        {queueDepth === 1 ? '1 color in queue' : `${queueDepth} colors in queue`}
      </div>
    )
  }

  return null
}
