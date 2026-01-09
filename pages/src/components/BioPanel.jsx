/**
 * Slide-in panel from left containing bio/resume content
 * Matches joeyhiller.com design with brush stroke backgrounds
 */
export default function BioPanel({ isOpen, onClose }) {
  return (
    <>
      {/* Dark overlay */}
      <div
        className={`bio-overlay ${isOpen ? 'bio-overlay--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`bio-panel ${isOpen ? 'bio-panel--open' : ''}`}
        aria-label="About Joey Hiller"
        role="dialog"
        aria-modal="true"
      >
        <button
          className="bio-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          &times;
        </button>

        <div className="bio-panel__content">
          <h1>Hey, I'm Joey Hiller.</h1>

          <div className="bio-panel__intro">
            <p>
              I'm a technologist and builder living in the San Francisco
              Bay Area. Currently supporting decentralized communication networks
              at Helium.
            </p>
          </div>

          <div className="bio-panel__section">
            <div className="bio-panel__row">
              <div className="bio-panel__label">Now</div>
              <div className="bio-panel__value">
                <strong>Director, Network Product</strong>
                <span className="bio-panel__company">Helium</span>
              </div>
            </div>

            <div className="bio-panel__row">
              <div className="bio-panel__label">Then</div>
              <div className="bio-panel__value">
                <strong>Advisor, Lead Product Designer</strong>
                <span className="bio-panel__company">Lumanu</span>
              </div>
            </div>

            <div className="bio-panel__row bio-panel__row--compact">
              <div className="bio-panel__label"></div>
              <div className="bio-panel__value">
                <strong>Product Designer</strong>
                <span className="bio-panel__company-line">
                  <span className="bio-panel__company">Ravel</span>
                  <span className="bio-panel__note">(Acquired by Lexis Nexis)</span>
                </span>
              </div>
            </div>

            <div className="bio-panel__row bio-panel__row--compact">
              <div className="bio-panel__label"></div>
              <div className="bio-panel__value">
                <strong>Web Designer</strong>
                <span className="bio-panel__company-line">
                  <span className="bio-panel__company">Joby</span>
                  <span className="bio-panel__note">(Acquired by Vitec Group)</span>
                </span>
              </div>
            </div>

            <div className="bio-panel__row">
              <div className="bio-panel__label">Edu</div>
              <div className="bio-panel__value">
                <strong>iOS for Designers</strong>
                <span className="bio-panel__company">CodePath</span>
              </div>
            </div>

            <div className="bio-panel__row bio-panel__row--compact">
              <div className="bio-panel__label"></div>
              <div className="bio-panel__value">
                <strong>Studio Art</strong>
                <span className="bio-panel__company">Humboldt State University</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
