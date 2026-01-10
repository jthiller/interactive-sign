# pi-publisher/CLAUDE.md

Raspberry Pi application that captures webcam video and streams it via WebRTC to Cloudflare Realtime SFU.

## Overview

This Node.js application runs on a Raspberry Pi and:
1. Captures video from a USB webcam using FFmpeg
2. Receives H.264 RTP packets via UDP
3. Forwards them to Cloudflare Realtime SFU using Werift WebRTC library
4. Registers the track with the worker API so viewers can find it

## Dependencies

- **werift** - Pure TypeScript WebRTC implementation (no native dependencies)
- **Node.js 18+** - Required for fetch API

Why Werift instead of native WebRTC?
- No compilation needed on Pi
- H.264 passthrough without transcoding
- Works with FFmpeg RTP output directly

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Raspberry Pi                            │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Webcam  │───▶│ FFmpeg  │───▶│  UDP    │───▶│ Werift  │  │
│  │/dev/vid │    │ H.264   │    │ :5004   │    │ WebRTC  │──┼──▶ Cloudflare
│  └─────────┘    │ RTP out │    └─────────┘    └─────────┘  │    Realtime SFU
│                 └─────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

### index.js
Main application with these responsibilities:

1. **FFmpeg Management** - Spawns FFmpeg to capture and encode video
2. **RTP Reception** - UDP server receives H.264 packets from FFmpeg
3. **WebRTC Session** - Creates session with Cloudflare Realtime
4. **Track Registration** - Registers track with worker API
5. **Heartbeat Loop** - Keeps track alive, handles reconnection

### start.sh.example
Template for environment variables. Copy to `start.sh` (gitignored):

```bash
export WORKER_URL=https://api.joeyhiller.com
export CLOUDFLARE_CALLS_APP_ID=your-app-id
export CLOUDFLARE_CALLS_API_TOKEN=your-api-token
export PI_PUBLISHER_SECRET=your-secret
# Optional: export WEBCAM_DEVICE=/dev/video1
```

## FFmpeg Configuration

```bash
ffmpeg -f v4l2 -video_size 1280x720 -framerate 8 \
       -i /dev/video0 \
       -c:v h264_v4l2m2m \        # Hardware encoder
       -b:v 800k \                 # Bitrate
       -f rtp rtp://127.0.0.1:5004 # Output to local UDP
```

**Important settings:**
- `h264_v4l2m2m` - Pi's hardware H.264 encoder (much faster than software)
- `800k` bitrate - Balance of quality vs bandwidth
- `8 fps` - Low framerate to reduce bandwidth
- RTP output sends raw H.264 NAL units

## WebRTC Flow

### 1. Session Creation
```javascript
// Create session with Cloudflare Realtime
const session = await fetch(`${CLOUDFLARE_API}/sessions/new`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### 2. Track Publishing
```javascript
// Add local track to session
const track = await fetch(`${CLOUDFLARE_API}/sessions/${id}/tracks/new`, {
  method: 'POST',
  body: JSON.stringify({
    trackName: 'video',
    // ... SDP offer
  })
})
```

### 3. RTP Forwarding
```javascript
// Werift receives RTP packets and forwards to SFU
rtpSocket.on('message', (packet) => {
  videoTrack.writeRtp(packet)
})
```

### 4. Track Registration
```javascript
// Tell the worker about our track so viewers can find it
await fetch(`${WORKER_URL}/track/register`, {
  method: 'POST',
  headers: { 'X-Publisher-Secret': secret },
  body: JSON.stringify({ sessionId, trackName: 'video' })
})
```

## Heartbeat System

The publisher sends heartbeats every 30 seconds:
- Keeps track registration alive (expires after 60s without heartbeat)
- Detects connection issues and triggers reconnection
- Logs connection status for monitoring

## Error Handling

### FFmpeg Crashes
- Detected via `spawn.on('close')`
- Automatic restart after 5 second delay
- Logs exit code for debugging

### WebRTC Disconnection
- Detected via ICE connection state changes
- Triggers full reconnection flow
- Creates new session and re-registers track

### Network Issues
- Heartbeat failures trigger reconnection
- Exponential backoff on repeated failures
- Graceful shutdown on SIGTERM/SIGINT

## Deployment

### systemd Service
Located at `/etc/systemd/system/webcam-publisher.service`:

```ini
[Unit]
Description=Webcam Publisher
After=network.target

[Service]
Type=simple
User=jthiller
WorkingDirectory=/home/jthiller/pi-publisher
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=WORKER_URL=https://api.joeyhiller.com
# ... other env vars

[Install]
WantedBy=multi-user.target
```

**Note:** Environment variables are in the service file, NOT loaded from start.sh when running as a service.

### Deploy Commands
```bash
# Copy files to Pi
scp -r pi-publisher/* jthiller@ledsign.local:~/pi-publisher/

# Restart service
ssh jthiller@ledsign.local 'sudo systemctl restart webcam-publisher'

# View logs
ssh jthiller@ledsign.local 'journalctl -u webcam-publisher -f'

# Check status
ssh jthiller@ledsign.local 'sudo systemctl status webcam-publisher'
```

## Troubleshooting

### Video not appearing
1. Check FFmpeg is running: `ps aux | grep ffmpeg`
2. Check UDP packets: `tcpdump -i lo port 5004`
3. Check track registered: `curl https://api.joeyhiller.com/track/current`
4. Check worker logs: `wrangler tail`

### Poor video quality
- Increase bitrate in FFmpeg command
- Check webcam supports requested resolution
- Monitor CPU usage (software encoding = high CPU)

### Reconnection loops
- Check network connectivity
- Verify API tokens are valid
- Check Cloudflare Realtime service status

### Hardware encoder not working
- Ensure `/dev/video0` exists
- Check v4l2 modules loaded: `lsmod | grep v4l2`
- Try software encoder: replace `h264_v4l2m2m` with `libx264`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKER_URL` | Yes | API endpoint (https://api.joeyhiller.com) |
| `CLOUDFLARE_CALLS_APP_ID` | Yes | Realtime SFU App ID |
| `CLOUDFLARE_CALLS_API_TOKEN` | Yes | Realtime SFU API token |
| `PI_PUBLISHER_SECRET` | Yes | Auth for track registration |
| `WEBCAM_DEVICE` | No | Override webcam (default: /dev/video0) |
