/**
 * Werift-based Video Publisher for Cloudflare Realtime SFU
 *
 * Uses Werift for pure TypeScript WebRTC with H.264 passthrough.
 * FFmpeg outputs H.264-encoded RTP packets directly to Werift,
 * avoiding transcoding overhead.
 */

import { createSocket } from 'dgram';
import { spawn } from 'child_process';
import {
  RTCPeerConnection,
  RTCRtpCodecParameters,
  MediaStreamTrack,
  RtpPacket,
} from 'werift';

// Configuration
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CLOUDFLARE_APP_ID = process.env.CLOUDFLARE_CALLS_APP_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_CALLS_API_TOKEN;
const PI_PUBLISHER_SECRET = process.env.PI_PUBLISHER_SECRET;
const CLOUDFLARE_API_BASE = `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}`;

const TRACK_NAME = 'webcam-video';
const HEARTBEAT_INTERVAL = 30000;

// Video settings
const WIDTH = 1280;
const HEIGHT = 720;
const FRAME_RATE = 10;
const BITRATE = '800k'; // Adjusted for 720p @ 10fps
const WEBCAM_DEVICE = process.env.WEBCAM_DEVICE || '/dev/video0';

// H.264 RTP payload type (dynamic, typically 96-127)
const H264_PAYLOAD_TYPE = 96;

class WeriftPublisher {
  constructor() {
    this.pc = null;
    this.sessionId = null;
    this.track = null;
    this.ffmpeg = null;
    this.udpSocket = null;
    this.heartbeatTimer = null;
    this.rtpPort = null;
    this.packetCount = 0;
  }

  /**
   * Find an available UDP port for RTP
   */
  async findAvailablePort() {
    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.bind(0, '127.0.0.1', () => {
        const port = socket.address().port;
        socket.close(() => resolve(port));
      });
      socket.on('error', reject);
    });
  }

  /**
   * Create Cloudflare session
   */
  async createSession() {
    console.log('Creating Cloudflare session...');
    const res = await fetch(`${CLOUDFLARE_API_BASE}/sessions/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    this.sessionId = data.sessionId;
    console.log('Session created:', this.sessionId);
    return this.sessionId;
  }

  /**
   * Push track to Cloudflare
   */
  async pushTrack(sdpOffer) {
    console.log('Pushing track to Cloudflare...');
    const res = await fetch(`${CLOUDFLARE_API_BASE}/sessions/${this.sessionId}/tracks/new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionDescription: {
          type: 'offer',
          sdp: sdpOffer,
        },
        tracks: [{
          location: 'local',
          trackName: TRACK_NAME,
          mid: '0',
        }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to push track: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    console.log('Track pushed successfully');
    return data.sessionDescription?.sdp;
  }

  /**
   * Register track with worker
   */
  async registerTrack() {
    console.log('Registering track with worker...');
    const headers = { 'Content-Type': 'application/json' };
    if (PI_PUBLISHER_SECRET) {
      headers['X-Publisher-Secret'] = PI_PUBLISHER_SECRET;
    }

    const res = await fetch(`${WORKER_URL}/track/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: this.sessionId,
        trackName: TRACK_NAME,
      }),
    });

    if (!res.ok) {
      console.warn('Failed to register track:', await res.text());
    } else {
      console.log('Track registered');
    }
  }

  /**
   * Send heartbeat to keep track registered
   */
  async sendHeartbeat() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (PI_PUBLISHER_SECRET) {
        headers['X-Publisher-Secret'] = PI_PUBLISHER_SECRET;
      }

      const res = await fetch(`${WORKER_URL}/track/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: this.sessionId,
          trackName: TRACK_NAME,
        }),
      });
      if (res.ok) {
        console.log('Heartbeat sent');
      }
    } catch (e) {
      console.warn('Heartbeat failed:', e.message);
    }
  }

  /**
   * Start FFmpeg with H.264 hardware encoding, output RTP to UDP
   */
  startFFmpeg(port) {
    console.log(`Starting FFmpeg H.264 encoder, RTP output to port ${port}...`);

    // Check if we're on Pi (Linux with hardware encoder) or dev machine
    const isLinux = process.platform === 'linux';

    // FFmpeg args for H.264 RTP output
    // On Pi: use h264_v4l2m2m for hardware encoding
    // On macOS/other: use libx264 software encoder for dev
    const ffmpegArgs = isLinux ? [
      // Input: V4L2 webcam
      '-f', 'v4l2',
      '-input_format', 'mjpeg',
      '-framerate', String(FRAME_RATE),
      '-video_size', `${WIDTH}x${HEIGHT}`,
      '-i', WEBCAM_DEVICE,
      // Convert to yuv420p (required by h264_v4l2m2m)
      '-pix_fmt', 'yuv420p',
      // H.264 hardware encoder on Pi
      '-c:v', 'h264_v4l2m2m',
      '-b:v', BITRATE,
      // RTP output
      '-an', // No audio
      '-f', 'rtp',
      '-payload_type', String(H264_PAYLOAD_TYPE),
      `rtp://127.0.0.1:${port}?pkt_size=1200`,
    ] : [
      // Dev machine: use test source or webcam with software encoder
      '-f', 'avfoundation',
      '-framerate', String(FRAME_RATE),
      '-video_size', `${WIDTH}x${HEIGHT}`,
      '-i', '0', // Default webcam on macOS
      // Software H.264 encoder
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-b:v', BITRATE,
      '-g', String(FRAME_RATE * 2),
      // RTP output
      '-an',
      '-f', 'rtp',
      '-payload_type', String(H264_PAYLOAD_TYPE),
      `rtp://127.0.0.1:${port}?pkt_size=1200`,
    ];

    console.log('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

    this.ffmpeg = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      // Only log errors, not status messages
      if (msg.includes('Error') || msg.includes('error') || msg.includes('failed')) {
        console.error('FFmpeg error:', msg);
      }
    });

    this.ffmpeg.on('close', (code) => {
      console.log(`FFmpeg exited with code ${code}`);
      if (code !== 0 && code !== null) {
        console.error('FFmpeg crashed, restarting...');
        setTimeout(() => this.restart(), 5000);
      }
    });

    this.ffmpeg.on('error', (err) => {
      console.error('FFmpeg spawn error:', err);
    });
  }

  /**
   * Start publishing
   */
  async start() {
    console.log('Starting Werift H.264 publisher...');
    console.log(`Worker URL: ${WORKER_URL}`);
    console.log(`Cloudflare App ID: ${CLOUDFLARE_APP_ID}`);
    console.log(`Video: ${WIDTH}x${HEIGHT}@${FRAME_RATE}fps, ${BITRATE}`);

    if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Missing CLOUDFLARE_CALLS_APP_ID or CLOUDFLARE_CALLS_API_TOKEN');
    }

    // Find available port for RTP
    this.rtpPort = await this.findAvailablePort();
    console.log(`RTP port: ${this.rtpPort}`);

    // Create UDP socket to receive RTP from FFmpeg
    this.udpSocket = createSocket('udp4');
    this.udpSocket.bind(this.rtpPort, '127.0.0.1');

    // Create video track
    this.track = new MediaStreamTrack({ kind: 'video' });

    // Handle incoming RTP packets from FFmpeg
    this.udpSocket.on('message', (data) => {
      try {
        const rtp = RtpPacket.deSerialize(data);
        // Ensure correct payload type
        rtp.header.payloadType = H264_PAYLOAD_TYPE;
        this.track.writeRtp(rtp);

        this.packetCount++;
        if (this.packetCount % 100 === 0) {
          console.log(`RTP packets sent: ${this.packetCount}`);
        }
      } catch (e) {
        // Skip malformed packets
      }
    });

    // Create peer connection with H.264 codec
    this.pc = new RTCPeerConnection({
      codecs: {
        audio: [],
        video: [
          new RTCRtpCodecParameters({
            mimeType: 'video/H264',
            clockRate: 90000,
            payloadType: H264_PAYLOAD_TYPE,
            // Baseline profile, level 3.1 (common for WebRTC)
            parameters: 'profile-level-id=42e01f;packetization-mode=1',
          }),
        ],
      },
    });

    // Add track to peer connection
    this.pc.addTransceiver(this.track, { direction: 'sendonly' });

    // Connection state monitoring
    this.pc.iceConnectionStateChange.subscribe((state) => {
      console.log('ICE connection state:', state);
    });

    this.pc.connectionStateChange.subscribe((state) => {
      console.log('Connection state:', state);
      if (state === 'connected') {
        console.log('🎥 WebRTC connected! Streaming H.264...');
      } else if (state === 'failed') {
        console.error('Connection failed, restarting...');
        this.restart();
      }
    });

    // Create Cloudflare session
    await this.createSession();

    // Create and set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await new Promise((resolve) => {
      const checkState = () => {
        if (this.pc.iceGatheringState === 'complete') {
          resolve();
        }
      };
      this.pc.iceGatheringStateChange.subscribe(checkState);
      checkState();
      // Timeout after 10 seconds
      setTimeout(resolve, 10000);
    });

    console.log('ICE gathering complete');

    // Push track to Cloudflare
    const answerSdp = await this.pushTrack(this.pc.localDescription.sdp);

    // Set remote description
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    });

    console.log('Remote description set');

    // Start FFmpeg
    this.startFFmpeg(this.rtpPort);

    // Register track with worker
    await this.registerTrack();

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);

    console.log('Werift H.264 publisher running');
  }

  /**
   * Restart the publisher
   */
  async restart() {
    console.log('Restarting publisher...');
    this.stop();
    await new Promise((r) => setTimeout(r, 5000));
    await this.start();
  }

  /**
   * Stop the publisher
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    if (this.udpSocket) {
      this.udpSocket.close();
      this.udpSocket = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.sessionId = null;
    this.track = null;
    console.log('Publisher stopped');
  }
}

// Main
const publisher = new WeriftPublisher();

process.on('SIGINT', () => {
  console.log('Shutting down...');
  publisher.stop();
  process.exit(0);
});

publisher.start().catch((err) => {
  console.error('Publisher error:', err);
  process.exit(1);
});
