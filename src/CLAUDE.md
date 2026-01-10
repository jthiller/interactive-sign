# src/CLAUDE.md

Cloudflare Worker backend that handles API requests, WebRTC signaling, and LoRaWAN LED control.

## Architecture

```
worker.js (entry point)
    │
    ▼
router.js (request routing)
    │
    ├──▶ PartyTracks proxy (/partytracks/*)
    │
    ├──▶ Track registry (/track/*)
    │         │
    │         ▼
    │    TrackRegistry DO (trackRegistry.js)
    │
    ├──▶ LED control (/led, /led/command, /queue)
    │         │
    │         ▼
    │    ledHandler.js ──▶ ChirpStack API
    │
    └──▶ Uplink webhook (/uplink)
              │
              ▼
         parseUplinkPayload() ──▶ TrackRegistry DO
```

## Key Files

### worker.js
Entry point that exports the Worker and Durable Object:

```javascript
export default { fetch: handleRequest }
export { TrackRegistry }
```

### router.js
Main request routing with CORS handling. Key responsibilities:

1. **CORS preflight** - Handles OPTIONS requests
2. **PartyTracks proxy** - Forwards WebRTC signaling to Cloudflare Realtime
3. **Track management** - Pi registration, viewer queries
4. **Rate limiting** - Uses Durable Object for distributed rate limiting
5. **LED endpoints** - Color control and device commands
6. **Uplink webhook** - Receives telemetry from ChirpStack

### trackRegistry.js
Durable Object for stateful operations:

- **Track registration** - Stores current video track info
- **Rate limiting** - Per-IP request counting
- **Busylight state** - Stores last uplink telemetry

### handlers/ledHandler.js
ChirpStack integration for LED control:

- `sendDownlink()` - Queue color change
- `sendCommand()` - Send device commands
- `parseUplinkPayload()` - Decode 24-byte telemetry
- `getQueueDepth()` - Check pending downlinks

## API Endpoints

### WebRTC Signaling
```
/partytracks/* → Cloudflare Realtime API
```
Proxied directly using PartyTracks server library.

### Track Management
```
POST /track/register   - Pi registers track (auth required)
GET  /track/current    - Get current track for viewers
POST /track/heartbeat  - Keep track alive (auth required)
DELETE /track/unregister - Remove track (auth required)
```

### LED Control
```
GET  /led              - Get device state from last uplink
POST /led              - Send color {r, g, b} (rate limited)
POST /led/command      - Send device command (auth required)
GET  /queue            - Get ChirpStack queue depth
```

### Webhooks
```
POST /uplink           - ChirpStack uplink webhook
```

## Authentication

Three auth patterns in use:

### 1. X-Publisher-Secret Header
Used by Pi and admin endpoints:
```javascript
const secret = request.headers.get('X-Publisher-Secret')
if (!expectedSecret || secret !== expectedSecret) {
  return 401
}
```
**Fail-closed** on `/led/command` (denies if secret not configured)
**Fail-open** on `/track/*` (allows if secret not configured)

### 2. Authorization Bearer Token
Used by ChirpStack webhook:
```javascript
const auth = request.headers.get('Authorization')
if (expectedToken && auth !== `Bearer ${expectedToken}`) {
  return 401
}
```

### 3. Rate Limiting
Public `/led` POST endpoint:
- 10 requests/minute per IP
- Uses Durable Object for distributed counting
- Returns 429 with `retryAfter` seconds

## Durable Object (TrackRegistry)

Single class handles multiple concerns via URL routing:

```javascript
// Rate limiting
POST /ratelimit?key=led:1.2.3.4&window=60000&max=10

// Track management
POST /register    - {sessionId, trackName}
GET  /current     - Returns track info
POST /heartbeat   - Updates timestamp
DELETE /unregister

// Busylight state
POST /busylight-state - Store uplink telemetry
GET  /busylight-state - Retrieve last state
```

**Instance naming:**
- `idFromName('global')` - Track registration
- `idFromName('ratelimit')` - Rate limiting
- `idFromName('busylight-state')` - Device telemetry

## ChirpStack Integration

### Sending Downlinks
```javascript
POST ${CHIRPSTACK_API_URL}/devices/${deviceId}/queue
Headers: Grpc-Metadata-Authorization: Bearer ${token}
Body: {
  queueItem: {
    confirmed: false,
    data: base64Payload,
    fPort: 15
  }
}
```

### Payload Format (Kuando Busylight)

**CRITICAL: Byte order is R, B, G (not RGB)**

```javascript
// Color downlink (5 bytes)
[Red, Blue, Green, OnDuration, OffDuration]

// Device command (2 bytes)
[CommandByte, ParamByte]

// Commands:
// 0x04, N = Set uplink interval to N minutes
// 0x05, 0 = Request immediate uplink
// 0x06, 1 = Enable auto-uplink after downlinks
```

### Uplink Telemetry (24 bytes)
```javascript
parseUplinkPayload(base64) → {
  rssi: number,           // Signal strength (dBm)
  snr: number,            // Signal-to-noise (dB)
  downlinksReceived: number,
  uplinksSent: number,
  color: { r, g, b, hex },
  timing: { onDuration, offDuration },
  firmware: { sw, hw },
  adrEnabled: boolean,
  timestamp: number
}
```

## CORS Configuration

```javascript
const ALLOWED_ORIGINS = [
  'https://joeyhiller.com',
  'https://www.joeyhiller.com',
  'https://joeyhillercom.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173'
]
```

Update this array when adding new frontend domains.

## Environment Variables

### Public (in wrangler.toml)
- `CLOUDFLARE_CALLS_APP_ID` - Realtime SFU app ID
- `CHIRPSTACK_API_URL` - ChirpStack API base URL

### Secrets (via wrangler secret put)
- `CLOUDFLARE_CALLS_API_TOKEN` - Realtime SFU auth
- `CLOUDFLARE_TURN_KEY_ID` - TURN server key
- `CLOUDFLARE_TURN_API_TOKEN` - TURN server auth
- `CHIRPSTACK_API` - ChirpStack API token
- `CHIRPSTACK_BUSYLIGHT_DEVICE_ID` - Target device EUI
- `PI_PUBLISHER_SECRET` - Pi and admin auth
- `CHIRPSTACK_WEBHOOK_SECRET` - Webhook auth

## Development

```bash
npm run dev      # Start local worker on port 8787
wrangler tail    # Stream production logs
```

Local development uses `.dev.vars` for secrets (gitignored).

## Deployment

```bash
npm run deploy   # Deploy to Cloudflare
```

Worker deployed as `joeyhillerapi` at `api.joeyhiller.com`.

## Common Tasks

### Adding a new endpoint
1. Add route in `router.js` `handleRequest()`
2. Implement handler (inline or in `handlers/`)
3. Add to `ALLOWED_ORIGINS` if needed by frontend
4. Update CORS headers if new methods needed

### Adding a new secret
1. `wrangler secret put SECRET_NAME`
2. Access via `env.SECRET_NAME` in handlers
3. Document in root CLAUDE.md

### Debugging webhooks
1. `wrangler tail` for live logs
2. Check ChirpStack integration settings
3. Verify webhook URL and Authorization header
