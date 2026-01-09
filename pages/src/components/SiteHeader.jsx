/**
 * Site header with tabbed navigation
 * Tabs open bio panel to corresponding section
 * Wrapped in blur frame for frosted glass perimeter effect
 */
export default function SiteHeader({ activeTab, onTabClick }) {
  return (
    <div className="blur-frame blur-frame--header">
      <nav className="site-header">
        <span className="site-header__name">Joey Hiller</span>
        <div className="site-header__nav">
          <button
            className={`site-header__tab ${activeTab === 'about' ? 'site-header__tab--active' : ''}`}
            onClick={() => onTabClick('about')}
          >
            About me
          </button>
          <button
            className={`site-header__tab ${activeTab === 'site' ? 'site-header__tab--active' : ''}`}
            onClick={() => onTabClick('site')}
          >
            This site
          </button>
        </div>
      </nav>
    </div>
  )
}
