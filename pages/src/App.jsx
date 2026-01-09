import { useState, useCallback } from 'react'
import HSBFrame from './components/HSBFrame'
import BioPanel from './components/BioPanel'

function App() {
  const [isBioOpen, setIsBioOpen] = useState(false)
  const [lowPowerMode, setLowPowerMode] = useState(false)

  const handleStartStream = useCallback(() => {
    setLowPowerMode(false)
  }, [])

  return (
    <div className="page">
      <HSBFrame
        onBioClick={() => setIsBioOpen(true)}
        lowPowerMode={lowPowerMode}
        onStartStream={handleStartStream}
      />

      <BioPanel
        isOpen={isBioOpen}
        onClose={() => setIsBioOpen(false)}
      />
    </div>
  )
}

export default App
