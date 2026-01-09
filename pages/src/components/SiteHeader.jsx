/**
 * Site header with tabbed navigation
 * Tabs open bio panel to corresponding section
 * Wrapped in blur frame for frosted glass perimeter effect
 */
export default function SiteHeader({ activeTab, onTabClick }) {
  return (
    <div className="blur-frame blur-frame--header">
      <nav className="site-header">
        <button
          className={`site-header__tab ${activeTab === 'about' ? 'site-header__tab--active' : ''}`}
          onClick={() => onTabClick('about')}
        >
          Joey Hiller
        </button>
        <span className="site-header__divider">/</span>
        <button
          className={`site-header__tab ${activeTab === 'site' ? 'site-header__tab--active' : ''}`}
          onClick={() => onTabClick('site')}
        >
          This site
        </button>
      </nav>
    </div>
  )
}
