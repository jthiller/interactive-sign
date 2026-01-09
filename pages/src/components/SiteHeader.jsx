/**
 * Site header with name
 * Entire pill is clickable to open bio panel
 * Wrapped in blur frame for frosted glass perimeter effect
 */
export default function SiteHeader({ onNameClick }) {
  return (
    <div className="blur-frame blur-frame--header">
      <button className="site-header" onClick={onNameClick}>
        <span className="site-header__name">Joey Hiller</span>
      </button>
    </div>
  )
}
