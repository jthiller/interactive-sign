/**
 * Node.js Video Publisher for Cloudflare Realtime SFU
 *
 * Uses wrtc package for WebRTC in Node.js
 * Captures webcam via FFmpeg and pushes to Cloudflare
 */

import wrtc from '@roamhq/wrtc';
import { spawn } from 'child_process';

const { RTCPeerConnection, nonstandard } = wrtc;
const { RTCVideoSource } = nonstandard;

// Configuration
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const CLOUDFLARE_APP_ID = process.env.CLOUDFLARE_CALLS_APP_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_CALLS_API_TOKEN;
const PI_PUBLISHER_SECRET = process.env.PI_PUBLISHER_SECRET; // For authenticating with worker
const CLOUDFLARE_API_BASE = `https://rtc.live.cloudflare.com/v1/apps/${CLOUDFLARE_APP_ID}`;

const TRACK_NAME = 'webcam-video';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const FRAME_RATE = 2;
const WIDTH = 1024;
const HEIGHT = 576;
const WEBCAM_DEVICE = process.env.WEBCAM_DEVICE || '/dev/video0';

class Publisher {
  constructor() {
    this.pc = null;
    this.sessionId = null;
    this.videoSource = null;
    this.videoTrack = null;
    this.heartbeatTimer = null;
    this.ffmpeg = null;
    this.frameCount = 0;
  }

  async fetchIceServers() {
    // Get TURN credentials from our worker proxy
    try {
      const res = await fetch(`${WORKER_URL}/partytracks/generate-ice-servers`);
      if (res.ok) {
        const data = await res.json();
        console.log('Got ICE servers from worker');
        return data.iceServers || [];
      }
    } catch (e) {
      console.warn('Failed to get TURN credentials:', e.message);
    }

    // Fallback to STUN only
    return [{ urls: 'stun:stun.cloudflare.com:3478' }];
  }

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

  async sendHeartbeat() {
    // Re-register the track to update timestamp
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

  createVideoSource() {
    // Create a video source that captures from webcam via FFmpeg
    this.videoSource = new RTCVideoSource();
    this.videoTrack = this.videoSource.createTrack();

    // Calculate frame size for I420 format
    const ySize = WIDTH * HEIGHT;
    const uvSize = (WIDTH / 2) * (HEIGHT / 2);
    const frameSize = ySize + uvSize * 2;

    console.log(`Starting webcam capture: ${WEBCAM_DEVICE} at ${WIDTH}x${HEIGHT}@${FRAME_RATE}fps`);

    // Spawn FFmpeg to capture webcam and output raw I420 frames
    this.ffmpeg = spawn('ffmpeg', [
      '-f', 'v4l2',
      '-input_format', 'mjpeg',
      '-framerate', String(FRAME_RATE),
      '-video_size', `${WIDTH}x${HEIGHT}`,
      '-i', WEBCAM_DEVICE,
      '-pix_fmt', 'yuv420p',
      '-f', 'rawvideo',
      '-an',
      'pipe:1'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Buffer to accumulate frame data
    let buffer = Buffer.alloc(0);

    this.ffmpeg.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Process complete frames
      while (buffer.length >= frameSize) {
        const frameData = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);

        const frame = {
          width: WIDTH,
          height: HEIGHT,
          data: new Uint8ClampedArray(frameData),
        };

        this.videoSource.onFrame(frame);
        this.frameCount++;

        if (this.frameCount % (FRAME_RATE * 5) === 0) {
          console.log(`Sent ${this.frameCount} frames`);
        }
      }
    });

    this.ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs status to stderr - only log errors
      const msg = data.toString();
      if (msg.includes('Error') || msg.includes('error')) {
        console.error('FFmpeg error:', msg);
      }
    });

    this.ffmpeg.on('close', (code) => {
      console.log(`FFmpeg exited with code ${code}`);
      if (code !== 0) {
        console.error('FFmpeg crashed, restarting publisher...');
        this.restart();
      }
    });

    this.ffmpeg.on('error', (err) => {
      console.error('FFmpeg spawn error:', err);
    });

    console.log(`Video source created: ${WIDTH}x${HEIGHT}@${FRAME_RATE}fps`);
    return this.videoTrack;
  }

  async start() {
    console.log('Starting publisher...');
    console.log(`Worker URL: ${WORKER_URL}`);
    console.log(`Cloudflare App ID: ${CLOUDFLARE_APP_ID}`);

    if (!CLOUDFLARE_APP_ID || !CLOUDFLARE_API_TOKEN) {
      throw new Error('Missing CLOUDFLARE_CALLS_APP_ID or CLOUDFLARE_CALLS_API_TOKEN');
    }

    // Get ICE servers
    const iceServers = await this.fetchIceServers();
    console.log('ICE servers:', iceServers.length);

    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers });

    // Create and add video track
    const videoTrack = this.createVideoSource();
    this.pc.addTrack(videoTrack);

    // Set up connection handlers
    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.pc.iceConnectionState);
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        console.log('🎥 WebRTC connected! Streaming...');
      } else if (this.pc.connectionState === 'failed') {
        console.error('Connection failed, will restart...');
        this.restart();
      }
    };

    // Create Cloudflare session
    await this.createSession();

    // Create offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
        // Timeout after 10 seconds
        setTimeout(resolve, 10000);
      }
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

    // Register track with worker
    await this.registerTrack();

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);

    console.log('Publisher running');
  }

  async restart() {
    console.log('Restarting publisher...');
    this.stop();
    await new Promise(r => setTimeout(r, 5000));
    await this.start();
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.sessionId = null;
    console.log('Publisher stopped');
  }
}

// Main
const publisher = new Publisher();

process.on('SIGINT', () => {
  console.log('Shutting down...');
  publisher.stop();
  process.exit(0);
});

publisher.start().catch((err) => {
  console.error('Publisher error:', err);
  process.exit(1);
});
