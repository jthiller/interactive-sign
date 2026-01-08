# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive sign system that streams live webcam video from a Raspberry Pi to a web page, with visitors able to control an LED light color via LoRaWAN. The system uses Cloudflare Workers, Cloudflare Realtime SFU (WebRTC), and ChirpStack for LoRaWAN control.

## Architecture

```
┌─────────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│  Raspberry Pi   │      │     Cloudflare Workers       │      │   Web Viewer    │
│                 │      │                              │      │                 │
│ ┌─────────────┐ │      │  ┌────────────────────────┐  │      │ ┌─────────────┐ │
│ │   Webcam    │ │      │  │      router.js         │  │      │ │VideoPlayer  │ │
│ └──────┬──────┘ │      │  │  - /partytracks/*      │  │      │ │(PartyTracks)│ │
│        │        │      │  │  - /track/*            │  │      │ └──────┬──────┘ │
│ ┌──────▼──────┐ │      │  │  - /led (POST)         │  │      │        │        │
│ │   FFmpeg    │ │      │  │  - /queue (GET)        │  │      │ ┌──────▼──────┐ │
│ │ H.264 RTP   │ │      │  └────────────────────────┘  │      │ │ ColorPanel  │ │
│ └──────┬──────┘ │      │             │                │      │ │ (picker)    │ │
│        │        │      │  ┌──────────▼─────────────┐  │      │ └─────────────┘ │
│ ┌──────▼──────┐ │      │  │    TrackRegistry DO    │  │      └─────────────────┘
│ │   Werift    │─┼──────┼─▶│  (Durable Object)      │  │
│ │  WebRTC TX  │ │      │  └────────────────────────┘  │
│ └─────────────┘ │      │                              │
└─────────────────┘      │  ┌────────────────────────┐  │      ┌─────────────────┐
                         │  │     ledHandler.js      │──┼─────▶│   ChirpStack    │
                         │  │  (LoRaWAN downlink)    │  │      │   (LoRaWAN)     │
                         │  └────────────────────────┘  │      └────────┬────────┘
                         └──────────────────────────────┘               │
                                                                        ▼
                                                               ┌─────────────────┐
                                                               │   Busylight     │
                                                               │   (LoRaWAN LED) │
                                                               └─────────────────┘
```

**Three main components:**

1. **Cloudflare Worker** (`src/`) - API backend with Durable Object for track coordination
2. **React Frontend** (`pages/`) - Vite-based viewer with WebRTC video player and color picker
3. **Pi Publisher** (`pi-publisher/`) - H.264 video streaming from Raspberry Pi using Werift

## Common Commands

### Worker (root directory)
```bash
npm run dev          # Local development (port 8787)
npm run deploy       # Deploy to Cloudflare
wrangler secret put <SECRET_NAME>  # Set secrets
```

### Frontend (pages/ directory)
```bash
cd pages
npm run dev          # Vite dev server (port 3000, proxies to worker)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx wrangler pages deploy dist  # Deploy to Cloudflare Pages
```

### Pi Publisher (pi-publisher/ directory)
```bash
cd pi-publisher
npm start            # Run locally (uses env vars for config)
```

Deploy to Pi:
```bash
sshpass -p 'connect' scp -r pi-publisher/* jthiller@ledsign.local:~/pi-publisher/
ssh jthiller@ledsign.local 'sudo systemctl restart webcam-publisher'
```

## Key Technical Details

### WebRTC Video Flow
- Pi uses **Werift** library for pure TypeScript WebRTC with H.264 passthrough
- FFmpeg captures from `/dev/video0`, encodes H.264 via `h264_v4l2m2m` hardware encoder
- RTP packets sent via UDP to Werift, which forwards to Cloudflare Realtime SFU
- Frontend uses **PartyTracks** library to pull video stream from SFU

### Video Settings (pi-publisher/index.js)
- Resolution: 1280x720
- Framerate: 8fps
- Bitrate: 800kbps
- Codec: H.264 (payload type 96)

### LoRaWAN LED Control
- ChirpStack API for queueing downlinks to Busylight device
- Payload format: `[R, B, G, onDuration, offDuration]` (note: R, B, G order per device spec)
- Rate limited: 10 requests/minute per IP via Durable Object

### Required Secrets (via wrangler secret put)
- `CLOUDFLARE_CALLS_API_TOKEN` - Realtime SFU API access
- `CLOUDFLARE_TURN_KEY_ID` / `CLOUDFLARE_TURN_API_TOKEN` - TURN server for NAT traversal
- `CHIRPSTACK_API` - ChirpStack API token
- `CHIRPSTACK_BUSYLIGHT_DEVICE_ID` - Target LoRaWAN device
- `PI_PUBLISHER_SECRET` - Authenticates Pi for track registration
- `CHIRPSTACK_WEBHOOK_SECRET` - Authenticates ChirpStack uplink webhooks

### Pi systemd Service
Located at `/etc/systemd/system/webcam-publisher.service`:
- Runs `node index.js` from `~/pi-publisher/`
- Environment variables set in `start.sh` (gitignored)
- Commands: `sudo systemctl {start|stop|restart|status} webcam-publisher`
