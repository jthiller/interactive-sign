# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive sign system that streams live webcam video from a Raspberry Pi to a web page, with visitors able to control an LED light color via LoRaWAN. The system uses Cloudflare Workers, Cloudflare Realtime SFU (WebRTC), and ChirpStack for LoRaWAN control.

**Live site:** https://joeyhiller.com
**API endpoint:** https://api.joeyhiller.com

## Architecture

```
┌─────────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│  Raspberry Pi   │      │     Cloudflare Workers       │      │   Web Viewer    │
│                 │      │                              │      │                 │
│ ┌─────────────┐ │      │  ┌────────────────────────┐  │      │ ┌─────────────┐ │
│ │   Webcam    │ │      │  │      router.js         │  │      │ │VideoPlayer  │ │
│ └──────┬──────┘ │      │  │  - /partytracks/*      │  │      │ │(PartyTracks)│ │
│        │        │      │  │  - /track/*            │  │      │ └──────┬──────┘ │
│ ┌──────▼──────┐ │      │  │  - /led (GET/POST)     │  │      │        │        │
│ │   FFmpeg    │ │      │  │  - /led/command (POST) │  │      │ ┌──────▼──────┐ │
│ │ H.264 RTP   │ │      │  │  - /queue (GET)        │  │      │ │  HSBFrame   │ │
│ └──────┬──────┘ │      │  │  - /uplink (POST)      │  │      │ │(color picker│ │
│        │        │      │  └────────────────────────┘  │      │ └─────────────┘ │
│ ┌──────▼──────┐ │      │             │                │      └─────────────────┘
│ │   Werift    │─┼──────┼─▶ ┌─────────▼──────────┐    │
│ │  WebRTC TX  │ │      │   │  TrackRegistry DO  │    │
│ └─────────────┘ │      │   │  - track state     │    │
└─────────────────┘      │   │  - rate limiting   │    │
                         │   │  - busylight state │    │
                         │   └────────────────────┘    │
                         │                              │
                         │  ┌────────────────────────┐  │      ┌─────────────────┐
                         │  │    ledHandler.js       │──┼─────▶│   ChirpStack    │
                         │  │  - color downlinks     │  │      │   (LoRaWAN NS)  │
                         │  │  - device commands     │  │      └────────┬────────┘
                         │  │  - uplink parsing      │  │               │
                         │  └────────────────────────┘  │               ▼
                         └──────────────────────────────┘      ┌─────────────────┐
                                                               │ Kuando Busylight│
                                  ▲                            │  (LoRaWAN LED)  │
                                  │                            └─────────────────┘
                                  │
                         ┌────────┴────────┐
                         │   ChirpStack    │
                         │ Uplink Webhook  │
                         │ POST /uplink    │
                         └─────────────────┘
```

## Three Main Components

| Component | Directory | Purpose | Deployment |
|-----------|-----------|---------|------------|
| **Cloudflare Worker** | `src/` | API backend, WebRTC signaling, LED control | `npm run deploy` |
| **React Frontend** | `pages/` | Video player, color picker UI | Cloudflare Pages |
| **Pi Publisher** | `pi-publisher/` | H.264 video capture and WebRTC streaming | systemd service |

## Quick Start Commands

### Worker (root directory)
```bash
npm run dev              # Local development (port 8787)
npm run deploy           # Deploy to Cloudflare
wrangler tail            # View live logs
wrangler secret put <NAME>  # Set secrets
```

### Frontend (pages/ directory)
```bash
cd pages
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build
npx wrangler pages deploy dist  # Deploy to Pages
```

### Pi Publisher
```bash
# Deploy to Pi
scp -r pi-publisher/* jthiller@ledsign.local:~/pi-publisher/
ssh jthiller@ledsign.local 'sudo systemctl restart webcam-publisher'

# View logs on Pi
ssh jthiller@ledsign.local 'journalctl -u webcam-publisher -f'
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/partytracks/*` | * | None | WebRTC signaling proxy (PartyTracks) |
| `/track/register` | POST | `X-Publisher-Secret` | Pi registers video track |
| `/track/current` | GET | None | Get current track info for viewers |
| `/track/heartbeat` | POST | `X-Publisher-Secret` | Keep track alive |
| `/led` | GET | None | Get device state from last uplink |
| `/led` | POST | None (rate limited) | Send color to LED `{r, g, b}` |
| `/led/command` | POST | `X-Publisher-Secret` | Send device command (admin) |
| `/queue` | GET | None | Get ChirpStack downlink queue |
| `/uplink` | POST | `Authorization: Bearer` | ChirpStack webhook for uplinks |

## Key Technical Details

### WebRTC Video Flow
1. Pi captures from USB webcam via FFmpeg with H.264 hardware encoding
2. RTP packets sent to Werift (TypeScript WebRTC library)
3. Werift publishes to Cloudflare Realtime SFU via PartyTracks
4. Frontend pulls stream using PartyTracks client library

### Video Settings
- Resolution: 1280x720
- Framerate: 8fps (low for bandwidth)
- Bitrate: 800kbps
- Codec: H.264 (payload type 96)

### LoRaWAN LED Control (Kuando Busylight)

**IMPORTANT: Color byte order is R, B, G (not RGB!)**

```javascript
// Downlink payload format (5 bytes)
[Red, Blue, Green, OnDuration, OffDuration]
// OnDuration/OffDuration in 1/10 seconds, 0 = steady

// Uplink telemetry format (24 bytes) - parsed by parseUplinkPayload()
// Bytes 0-3:   RSSI (signed int32 LE)
// Bytes 4-7:   SNR (signed int32 LE)
// Bytes 8-11:  Downlinks received (uint32 LE)
// Bytes 12-15: Uplinks sent (uint32 LE)
// Byte 16:     Last Red
// Byte 17:     Last Blue (not green!)
// Byte 18:     Last Green
// Bytes 19-20: On/Off duration
// Byte 21:     SW revision
// Byte 22:     HW revision
// Byte 23:     ADR state
```

**Device Commands (2 bytes via /led/command):**
- `{command: 4, param: 5}` - Set uplink interval to 5 minutes
- `{command: 5, param: 0}` - Request immediate uplink
- `{command: 6, param: 1}` - Enable auto-uplink after downlinks

### Rate Limiting
- 10 requests/minute per IP for POST /led
- Implemented via Durable Object (not in-memory)
- Returns 429 with `retryAfter` seconds

## Required Secrets

Set via `wrangler secret put <NAME>`:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_CALLS_API_TOKEN` | Realtime SFU API access |
| `CLOUDFLARE_TURN_KEY_ID` | TURN server key ID |
| `CLOUDFLARE_TURN_API_TOKEN` | TURN server API token |
| `CHIRPSTACK_API` | ChirpStack API token |
| `CHIRPSTACK_BUSYLIGHT_DEVICE_ID` | Target LoRaWAN device EUI |
| `PI_PUBLISHER_SECRET` | Authenticates Pi and admin commands |
| `CHIRPSTACK_WEBHOOK_SECRET` | Authenticates ChirpStack webhooks |

## Common Gotchas

### 1. Color Byte Order
The Busylight uses **R, B, G** order, not RGB. This is handled in `ledHandler.js` but easy to forget.

### 2. Authentication Patterns
- `/led/command` uses **fail-closed** auth (denies if secret not configured)
- `/track/*` and `/uplink` use **fail-open** auth (allows if secret not configured) - this is intentional for backwards compatibility

### 3. Uplink Data Availability
`GET /led` returns `null` until a ChirpStack uplink webhook is received. Default uplink interval is 30 minutes.

### 4. Pi Service Configuration
The systemd service at `/etc/systemd/system/webcam-publisher.service` has `WORKER_URL` hardcoded. If you change domains, update it there (not just in start.sh).

### 5. CORS Origins
Update `ALLOWED_ORIGINS` in `src/router.js` when adding new frontend domains.

### 6. WebRTC Stale Sessions
The Pi's WebRTC connection can silently degrade while RTP packets continue to be sent locally. Symptoms: video shows static, Pi logs show "RTP packets sent" incrementing but no "WebRTC connected!" on restart. The Pi handles `'disconnected'` and `'failed'` states with automatic restart after 10-second timeout. If the stream stops working, restart the service: `sudo systemctl restart webcam-publisher`

## Troubleshooting

### Video stream not working (showing static)

1. **Check API track status:**
   ```bash
   curl -s https://api.joeyhiller.com/track/current | jq .
   ```
   Should return `sessionId`, `trackName`, and recent `timestamp` (within 60 seconds).

2. **Check track health:**
   ```bash
   curl -s https://api.joeyhiller.com/track/health | jq .
   ```
   Should return `healthy: true`. If `reason: "new-session"`, no viewers have pulled recently.

3. **Check Pi publisher logs:**
   ```bash
   ssh jthiller@ledsign.local 'journalctl -u webcam-publisher -n 50 --no-pager'
   ```
   Look for:
   - "🎥 WebRTC connected!" - connection is good
   - "RTP packets sent: X" - FFmpeg is capturing and sending
   - "Heartbeat sent" - registration is working
   - Any errors about connection state

4. **Check FFmpeg is running:**
   ```bash
   ssh jthiller@ledsign.local 'ps aux | grep ffmpeg'
   ```

5. **Restart the publisher (fixes most issues):**
   ```bash
   ssh jthiller@ledsign.local 'sudo systemctl restart webcam-publisher'
   ```
   Then check logs to confirm "WebRTC connected!" appears.

6. **Check browser console** for WebRTC or PartyTracks errors.

### Common causes
- **Stale WebRTC session**: Pi was running but connection degraded. Restart fixes it.
- **Network change**: Pi switched networks or got new IP. Restart needed.
- **Cloudflare session expired**: Sessions can timeout. Restart creates new session.

## File Structure

```
├── CLAUDE.md                 # This file (root guidance)
├── wrangler.toml             # Worker configuration
├── package.json              # Worker dependencies
├── src/                      # Cloudflare Worker
│   ├── worker.js             # Entry point
│   ├── router.js             # Request routing, CORS, auth
│   ├── trackRegistry.js      # Durable Object for state
│   └── handlers/
│       └── ledHandler.js     # LED/ChirpStack integration
├── pages/                    # React Frontend
│   ├── CLAUDE.md             # Frontend-specific guidance
│   ├── src/
│   │   ├── App.jsx           # Root component
│   │   ├── components/       # React components
│   │   └── hooks/            # Custom hooks
│   └── vite.config.js        # Vite configuration
└── pi-publisher/             # Raspberry Pi
    ├── CLAUDE.md             # Pi-specific guidance
    ├── index.js              # Main publisher script
    └── start.sh.example      # Environment template
```

## Deployment Checklist

### Worker
1. `npm run deploy`
2. Verify at https://api.joeyhiller.com/queue

### Frontend
1. `cd pages && npm run build`
2. `npx wrangler pages deploy dist`
3. Verify at https://joeyhiller.com

### Pi Publisher
1. SSH to Pi: `ssh jthiller@ledsign.local`
2. Copy files: `scp -r pi-publisher/* jthiller@ledsign.local:~/pi-publisher/`
3. Restart: `sudo systemctl restart webcam-publisher`
4. Check logs: `journalctl -u webcam-publisher -f`

## External Services

| Service | URL | Purpose |
|---------|-----|---------|
| Cloudflare Workers | dash.cloudflare.com | API hosting |
| Cloudflare Pages | dash.cloudflare.com | Frontend hosting |
| Cloudflare Realtime | Calls API | WebRTC SFU |
| ChirpStack (MeteoScientific) | console.meteoscientific.com | LoRaWAN network server |
| Helium Network | - | LoRaWAN coverage |
