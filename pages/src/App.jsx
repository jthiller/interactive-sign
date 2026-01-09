import { useState, useCallback } from 'react'
import HSBFrame from './components/HSBFrame'
import BioPanel from './components/BioPanel'

function App() {
  const [isBioOpen, setIsBioOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('about')
  const [lowPowerMode, setLowPowerMode] = useState(false)

  const handleStartStream = useCallback(() => {
    setLowPowerMode(false)
  }, [])

  const handleTabClick = useCallback((tab) => {
    setActiveTab(tab)
    setIsBioOpen(true)
  }, [])

  return (
    <div className="page">
      <HSBFrame
        activeTab={activeTab}
        onTabClick={handleTabClick}
        lowPowerMode={lowPowerMode}
        onStartStream={handleStartStream}
      />

      <BioPanel
        isOpen={isBioOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => setIsBioOpen(false)}
      />
    </div>
  )
}

export default App
