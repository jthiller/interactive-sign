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
    const ahead = queueDepth
    return (
      <div className="queue-status waiting">
        {ahead === 1 ? '1 color ahead of you' : `${ahead} colors ahead of you`}
      </div>
    )
  }

  return null
}
