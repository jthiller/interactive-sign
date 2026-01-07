import { useState, useCallback } from 'react'
import ColorFAB from './components/ColorFAB'
import ColorPanel from './components/ColorPanel'
import VideoPlayer from './components/VideoPlayer'

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isVideoConnected, setIsVideoConnected] = useState(false)
  const [theme, setTheme] = useState('light')

  const handleVideoConnection = useCallback((connected) => {
    setIsVideoConnected(connected)
  }, [])

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme)
  }, [])

  const pageClasses = [
    'page',
    isVideoConnected && 'page--video-active',
    isVideoConnected && theme === 'dark' && 'page--dark',
  ].filter(Boolean).join(' ')

  return (
    <div className={pageClasses}>
      <VideoPlayer
        onConnectionChange={handleVideoConnection}
        onThemeChange={handleThemeChange}
      />

      <main className="card">
        <h1>Hey, I'm Joey Hiller.</h1>

        <div className="intro">
          <p>
            I'm a technologist and builder currently living in the San Francisco Bay Area.
            Currently supporting decentralized communication networks at Helium.
          </p>
        </div>

        <div className="resume-row">
          <div className="resume-row__label">Now</div>
          <div className="resume-row__content">
            Director, Network Product<br />
            <span className="company">Helium</span>
          </div>
        </div>

        <div className="resume-row resume-row--compact">
          <div className="resume-row__label">Then</div>
          <div className="resume-row__content">
            Advisor, Lead Product Designer<br />
            <span className="company">Lumanu</span>
          </div>
        </div>

        <div className="resume-row resume-row--compact">
          <div className="resume-row__label"></div>
          <div className="resume-row__content">
            Product Designer<br />
            <span className="company">Ravel</span>
            <span className="acquisition-note">(Acquired by Lexis Nexis)</span>
          </div>
        </div>

        <div className="resume-row">
          <div className="resume-row__label"></div>
          <div className="resume-row__content">
            Web Designer<br />
            <span className="company">Joby</span>
            <span className="acquisition-note">(Acquired by Vitec Group)</span>
          </div>
        </div>

        <div className="resume-row resume-row--compact">
          <div className="resume-row__label">Edu</div>
          <div className="resume-row__content">
            iOS for Designers<br />
            <span className="company">CodePath</span>
          </div>
        </div>

        <div className="resume-row">
          <div className="resume-row__label"></div>
          <div className="resume-row__content">
            Studio Art<br />
            <span className="company">Humboldt State University</span>
          </div>
        </div>
      </main>

      {isVideoConnected && (
        <>
          <ColorFAB
            isOpen={isPanelOpen}
            onClick={() => setIsPanelOpen(!isPanelOpen)}
          />
          <ColorPanel
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
          />
        </>
      )}
    </div>
  )
}

export default App
