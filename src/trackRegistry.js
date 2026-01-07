/**
 * Durable Object for track registry and rate limiting
 * Pi publisher registers its track, viewers query to get it
 */

export class TrackRegistry {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Rate limiting endpoint
    if (request.method === 'POST' && url.pathname === '/ratelimit') {
      const key = url.searchParams.get('key');
      const windowMs = parseInt(url.searchParams.get('window'), 10) || 60000;
      const maxRequests = parseInt(url.searchParams.get('max'), 10) || 10;

      const now = Date.now();
      const windowKey = `ratelimit:${key}`;

      // Get current window data
      let windowData = await this.state.storage.get(windowKey);
      if (!windowData || now - windowData.start > windowMs) {
        // Start new window
        windowData = { start: now, count: 0 };
      }

      windowData.count++;

      if (windowData.count > maxRequests) {
        const retryAfter = Math.ceil((windowData.start + windowMs - now) / 1000);
        return new Response(String(retryAfter), { status: 429 });
      }

      await this.state.storage.put(windowKey, windowData);
      return new Response('OK', { status: 200 });
    }

    // POST /register - Pi registers its track
    if (request.method === 'POST' && url.pathname === '/register') {
      const body = await request.json();
      const { sessionId, trackName } = body;

      if (!sessionId || !trackName) {
        return this.json({ error: 'Missing sessionId or trackName' }, 400);
      }

      // Store track info
      await this.state.storage.put('currentTrack', {
        sessionId,
        trackName,
        timestamp: Date.now(),
      });

      console.log(`Track registered: ${sessionId}/${trackName}`);
      return this.json({ success: true });
    }

    // GET /current - Get current track info
    if (request.method === 'GET' && url.pathname === '/current') {
      const track = await this.state.storage.get('currentTrack');

      if (!track) {
        return this.json({ error: 'No track available' }, 404);
      }

      // Check if track is stale (older than 60 seconds)
      if (Date.now() - track.timestamp > 60000) {
        return this.json({ error: 'Track stale' }, 404);
      }

      return this.json(track);
    }

    // POST /heartbeat - Keep track alive
    if (request.method === 'POST' && url.pathname === '/heartbeat') {
      const track = await this.state.storage.get('currentTrack');
      if (track) {
        track.timestamp = Date.now();
        await this.state.storage.put('currentTrack', track);
        return this.json({ success: true });
      }
      return this.json({ error: 'No track to heartbeat' }, 404);
    }

    // DELETE /unregister - Remove track
    if (request.method === 'DELETE' && url.pathname === '/unregister') {
      await this.state.storage.delete('currentTrack');
      return this.json({ success: true });
    }

    return new Response('Not found', { status: 404 });
  }

  json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
