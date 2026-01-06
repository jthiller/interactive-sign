import { useState } from 'react'
import ColorFAB from './components/ColorFAB'
import ColorPanel from './components/ColorPanel'

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  return (
    <div className="b">
      <main className="c">
        <h1>Hey, I'm Joey Hiller.</h1>
        <p className="pp">
          <span className="p">
            I'm a technologist and builder currently living in the San Francisco Bay Area.
            Currently supporting decentralized communication networks at Helium.
          </span>
        </p>

        <div className="r">
          <div className="rl">Now</div>
          <div className="rc">
            Director, Network Product<br />
            <span className="co">Helium</span>
          </div>
        </div>

        <div className="r x">
          <div className="rl">Then</div>
          <div className="rc">
            Advisor, Lead Product Designer<br />
            <span className="co">Lumanu</span>
          </div>
        </div>
        <div className="r x">
          <div className="rl"></div>
          <div className="rc">
            Product Designer<br />
            <span className="co">Ravel </span>
            <span className="acq">(Acquired by Lexis Nexis)</span>
          </div>
        </div>
        <div className="r">
          <div className="rl"></div>
          <div className="rc">
            Web Designer<br />
            <span className="co">Joby </span>
            <span className="acq">(Acquired by Vitec Group)</span>
          </div>
        </div>

        <div className="r x">
          <div className="rl">Edu</div>
          <div className="rc">
            iOS for Designers<br />
            <span className="co">CodePath</span>
          </div>
        </div>
        <div className="r">
          <div className="rl"></div>
          <div className="rc">
            Studio Art<br />
            <span className="co">Humboldt State University</span>
          </div>
        </div>
      </main>

      <ColorFAB
        isOpen={isPanelOpen}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      />
      <ColorPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  )
}

export default App
