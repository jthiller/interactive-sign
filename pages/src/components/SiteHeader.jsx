/**
 * Site header with name
 * Entire pill is clickable to open bio panel
 */
export default function SiteHeader({ onNameClick }) {
  return (
    <button className="site-header" onClick={onNameClick}>
      <span className="site-header__name">Joey Hiller</span>
    </button>
  )
}
