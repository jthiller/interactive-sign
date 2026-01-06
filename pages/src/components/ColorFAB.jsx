export default function ColorFAB({ isOpen, onClick }) {
  return (
    <button
      className={`color-fab ${isOpen ? 'open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close color picker' : 'Open color picker'}
    />
  )
}
