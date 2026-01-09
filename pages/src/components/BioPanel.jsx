/**
 * Slide-in panel from left containing bio/resume content and site info
 * Matches joeyhiller.com design with brush stroke backgrounds
 */
export default function BioPanel({ isOpen, activeTab, onTabChange, onClose }) {
  return (
    <>
      {/* Dark overlay */}
      <div
        className={`bio-overlay ${isOpen ? "bio-overlay--visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`bio-panel ${isOpen ? "bio-panel--open" : ""} ${
          activeTab === "site" ? "bio-panel--site" : ""
        }`}
        aria-label="About Joey Hiller"
        role="dialog"
        aria-modal="true"
      >
        <button
          className="bio-panel__close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          &times;
        </button>

        <div className="bio-panel__content">
          {/* Tab navigation */}
          <div className="bio-panel__tabs">
            <button
              className={`bio-panel__tab ${
                activeTab === "about" ? "bio-panel__tab--active" : ""
              }`}
              onClick={() => onTabChange("about")}
            >
              About me
            </button>
            <button
              className={`bio-panel__tab ${
                activeTab === "site" ? "bio-panel__tab--active" : ""
              }`}
              onClick={() => onTabChange("site")}
            >
              This site
            </button>
          </div>

          {/* About me tab */}
          {activeTab === "about" && (
            <>
              <h1>Hey, I'm Joey Hiller.</h1>

              <div className="bio-panel__intro">
                <p>
                  I'm a technologist and builder living in the San Francisco Bay
                  Area. Currently supporting decentralized communication
                  networks at Helium.
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
                      <span className="bio-panel__note">
                        (Acquired by Lexis Nexis)
                      </span>
                    </span>
                  </div>
                </div>

                <div className="bio-panel__row bio-panel__row--compact">
                  <div className="bio-panel__label"></div>
                  <div className="bio-panel__value">
                    <strong>Web Designer</strong>
                    <span className="bio-panel__company-line">
                      <span className="bio-panel__company">Joby</span>
                      <span className="bio-panel__note">
                        (Acquired by Vitec Group)
                      </span>
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
                    <span className="bio-panel__company">
                      Humboldt State University
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* This site tab */}
          {activeTab === "site" && (
            <>
              <h1>How this works</h1>

              <div className="bio-panel__intro">
                <p>
                  This interactive sign lets you control a physical LED light in
                  my home office using the Helium Network. <br />
                  <br />
                </p>
                <p>
                  These types of devices are typically used for IoT applications
                  like environmental sensors, asset trackers, and smart city
                  infrastructure; but this demonstration is just a fun way to
                  show how one of these devices can be used creatively.
                </p>
              </div>

              <div className="bio-panel__diagram">
                <img
                  src="/images/architecture.svg"
                  alt="System architecture diagram showing video stream from Raspberry Pi through Cloudflare to browser, and color commands through Helium Network to LED light"
                />
              </div>

              <div className="bio-panel__section">
                <div className="bio-panel__row">
                  <div className="bio-panel__label">Video</div>
                  <div className="bio-panel__value">
                    <strong>Live WebRTC Stream</strong>
                    <span className="bio-panel__company">
                      A Raspberry Pi captures video from a webcam and streams it
                      through Cloudflare's real-time infrastructure directly to
                      your browser.
                    </span>
                  </div>
                </div>

                <div className="bio-panel__row">
                  <div className="bio-panel__label">Color</div>
                  <div className="bio-panel__value">
                    <strong>LoRaWAN over Helium</strong>
                    <span className="bio-panel__company">
                      When you pick a color, it's sent to a LoRaWAN device via
                      the <a href="https://helium.com">Helium Network</a>—a
                      global, decentralized IoT network. The signal travels
                      through nearby hotspots operated by everyday people.
                    </span>
                  </div>
                </div>

                <div className="bio-panel__row">
                  <div className="bio-panel__label">Light</div>
                  <div className="bio-panel__value">
                    <strong>Kuando Busylight</strong>
                    <span className="bio-panel__company">
                      The LED light is a LoRaWAN Kuando Busylight provisioned on{" "}
                      <a href="https://meteoscientific.com">Meteoscientific</a>.
                      It receives color commands wirelessly and updates in
                      real-time.
                    </span>
                  </div>
                </div>

                <div className="bio-panel__row">
                  <div className="bio-panel__label">Stack</div>
                  <div className="bio-panel__value">
                    <strong>React + Cloudflare Workers</strong>
                    <span className="bio-panel__company">
                      The frontend is React with Vite, hosted on Cloudflare
                      Pages. The backend runs on Cloudflare Workers with Durable
                      Objects for rate limiting and queue management.
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
