# pages/CLAUDE.md

Frontend React application for the interactive sign. Displays live video stream and provides color picker interface.

## Tech Stack

- **React 18** with functional components and hooks
- **Vite** for development and building
- **PartyTracks** client for WebRTC video streaming
- **Custom HSB color picker** (not using any color picker library)

## Key Components

### Component Hierarchy

```
App.jsx
├── HSBFrame.jsx          # Main layout with video + controls
│   ├── VideoPlayer.jsx   # WebRTC video with PartyTracks
│   ├── SiteHeader.jsx    # Navigation header
│   ├── ColorArea.jsx     # 2D hue/saturation picker
│   ├── BrightnessSlider.jsx  # Vertical brightness slider
│   └── QueueStatus.jsx   # LED queue feedback
└── BioPanel.jsx          # Slideover info panel
    └── (architecture diagram)
```

### VideoPlayer.jsx
Handles WebRTC connection to Cloudflare Realtime SFU via PartyTracks.

**Key behaviors:**
- Fetches track info from `/track/current`
- Creates PartyTracks session and pulls video track
- Shows TVStatic loading effect while connecting
- Auto-reconnects on connection loss
- Supports low-power mode (doesn't auto-connect)

**Props:**
- `onConnectionChange(boolean)` - Video connected/disconnected
- `onStatusChange(string)` - Status updates for UI
- `lowPowerMode` - Don't auto-connect, wait for user action
- `playRequested` - User clicked play button

### HSBFrame.jsx
Main color picker using HSB (Hue, Saturation, Brightness) color model.

**State:**
- `hue` (0-360), `saturation` (0-100), `brightness` (0-100)
- Converts to RGB for API submission
- Display color shown at 100% brightness for swatch

**API calls:**
- `POST /led` with `{r, g, b}` payload
- `GET /queue` polled every 3 seconds

### ColorArea.jsx
2D gradient picker for hue (x-axis) and saturation (y-axis).

**Implementation:**
- Canvas-based gradient rendering
- Touch and mouse drag support via `useSliderDrag` hook
- Hue: 0-360 degrees mapped to width
- Saturation: 0-100% mapped to height (inverted)

### BrightnessSlider.jsx
Vertical slider for brightness control.

**Features:**
- Gradient from black to full-saturation color
- Responsive: horizontal on mobile, vertical on desktop
- Uses same `useSliderDrag` hook

## Custom Hooks

### useColorName.js
Fetches human-readable color names from external API.

```javascript
const colorName = useColorName('#ff5500')
// Returns: "Orange" (or similar)
```

- Debounced API calls (300ms)
- Uses color.pizza API for name lookup
- Caches results to reduce API calls

### useSliderDrag.js
Unified touch/mouse drag handling for color controls.

```javascript
const { containerRef, handleStart } = useSliderDrag({
  onDrag: (x, y, rect) => { /* update state */ },
  onClick: (x, y, rect) => { /* handle click */ }
})
```

## Styling

### CSS Architecture
- Single `App.css` file with all styles
- BEM-ish naming: `.component__element--modifier`
- CSS custom properties for theming
- Mobile-first responsive design

### Key CSS Variables
```css
--color-surface: #ffffff
--color-text: #1a1a1a
--color-text-muted: #666666
--radius-full: 9999px
--spacing-md: 16px
--transition-fast: 150ms ease
```

### Blur Frame Effect
`.blur-frame` creates frosted glass effect around floating UI elements:
- Semi-transparent background
- `backdrop-filter: blur()`
- Soft shadow for depth

## API Integration

### Config (src/config.js)
```javascript
// Development: proxied through Vite
// Production: direct to API
export const API_BASE = isDev ? '' : 'https://api.joeyhiller.com'
```

### Vite Proxy (vite.config.js)
Dev server proxies API requests to local worker:
```javascript
proxy: {
  '/led': 'http://localhost:8787',
  '/queue': 'http://localhost:8787',
  '/track': 'http://localhost:8787',
  '/partytracks': 'http://localhost:8787'
}
```

## Development

```bash
npm run dev      # Start Vite dev server (port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

**Note:** Run worker locally (`npm run dev` in root) for full functionality.

## Deployment

```bash
npm run build
npx wrangler pages deploy dist
```

Deployed to Cloudflare Pages at `joeyhillercom.pages.dev` (aliased to `joeyhiller.com`).

## Common Tasks

### Adding a new color control
1. Add state in `HSBFrame.jsx`
2. Create component in `components/sliders/`
3. Use `useSliderDrag` for interaction
4. Update CSS in `App.css`

### Changing video behavior
- Connection logic in `VideoPlayer.jsx`
- PartyTracks API: see partytracks npm package docs
- Track info comes from `/track/current` endpoint

### Updating header/navigation
- `SiteHeader.jsx` for the top bar
- `BioPanel.jsx` for the slideover panel
- Tab state managed in `App.jsx`
