/**
 * Start stream button for low power mode
 * Shows centered over video area when stream hasn't been started
 */
export default function StartStreamButton({ onClick }) {
  return (
    <div className="start-stream" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="start-stream__button-wrapper">
        <button className="start-stream__button">
          <svg
            className="start-stream__icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="32"
            height="32"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
      <p className="start-stream__text">
        Your device is in low power or data saver mode.
        Video stream not started.
        <br />
        <span className="start-stream__action">Tap to start</span>
      </p>
    </div>
  );
}
