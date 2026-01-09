import { sendDownlink, getQueueDepth, getCurrentColor, parseUplinkPayload, sendCommand } from './handlers/ledHandler.js';
import { routePartyTracksRequest } from 'partytracks/server';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
	'https://joeyhiller.com',
	'https://www.joeyhiller.com',
	'https://interactive-sign.jthiller.workers.dev',
	'https://interactive-sign-pages.pages.dev',
	'http://localhost:5173', // Vite dev server
	'http://localhost:4173', // Vite preview
];

// Rate limiting config
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

export async function handleRequest(request, env, ctx) {
	const url = new URL(request.url);
	const pathname = url.pathname;
	const method = request.method;
	const origin = request.headers.get('Origin');

	// CORS preflight
	if (method === 'OPTIONS') {
		return corsResponse(new Response(null, { status: 204 }), origin);
	}

	try {
		// PartyTracks proxy - handles all WebRTC session/track management
		if (pathname.startsWith('/partytracks/')) {
			const response = await routePartyTracksRequest({
				appId: env.CLOUDFLARE_CALLS_APP_ID,
				token: env.CLOUDFLARE_CALLS_API_TOKEN,
				prefix: '/partytracks',
				// Disable session locking - we don't need cookie-based auth
				lockSessionToInitiator: false,
				// TURN server configuration for NAT traversal
				turnServerAppId: env.CLOUDFLARE_TURN_KEY_ID,
				turnServerAppToken: env.CLOUDFLARE_TURN_API_TOKEN,
				turnServerCredentialTTL: 86400, // 24 hours
				request,
			});
			return corsResponse(response, origin);
		}

		// Track registry - Pi registers track, viewers query it
		if (pathname.startsWith('/track/')) {
			const trackPath = pathname.replace('/track', '');

			// Authenticate write operations (register, heartbeat, unregister)
			if (method === 'POST' || method === 'DELETE') {
				const publisherSecret = request.headers.get('X-Publisher-Secret');
				const expectedSecret = env.PI_PUBLISHER_SECRET;

				if (expectedSecret && publisherSecret !== expectedSecret) {
					console.warn('Unauthorized track registry write attempt');
					return jsonResponse({ error: 'Unauthorized' }, 401);
				}
			}

			const id = env.TRACK_REGISTRY.idFromName('global');
			const stub = env.TRACK_REGISTRY.get(id);
			const response = await stub.fetch(new Request(
				new URL(trackPath, request.url).toString(),
				request
			));
			return corsResponse(response, origin);
		}

		// POST /led - Send color downlink (rate limited)
		if (method === 'POST' && pathname === '/led') {
			// Server-side rate limiting by IP
			const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
			const rateLimitKey = `led:${clientIP}`;

			// Use Durable Object for rate limiting
			const id = env.TRACK_REGISTRY.idFromName('ratelimit');
			const rateLimiter = env.TRACK_REGISTRY.get(id);
			const rateLimitCheck = await rateLimiter.fetch(new Request(
				`https://internal/ratelimit?key=${encodeURIComponent(rateLimitKey)}&window=${RATE_LIMIT_WINDOW_MS}&max=${RATE_LIMIT_MAX_REQUESTS}`,
				{ method: 'POST' }
			));

			if (rateLimitCheck.status === 429) {
				const retryAfter = await rateLimitCheck.text();
				return corsResponse(jsonResponse({
					error: 'Rate limit exceeded',
					retryAfter: parseInt(retryAfter, 10)
				}, 429), origin);
			}

			const body = await request.json();
			const { r, g, b } = body;

			if (r === undefined || g === undefined || b === undefined) {
				return corsResponse(jsonResponse({ error: 'Missing r, g, or b values' }, 400), origin);
			}

			// Validate inputs are numbers
			const rNum = Number(r);
			const gNum = Number(g);
			const bNum = Number(b);
			if (isNaN(rNum) || isNaN(gNum) || isNaN(bNum)) {
				return corsResponse(jsonResponse({ error: 'Invalid color values' }, 400), origin);
			}

			return corsResponse(await sendDownlink(env, rNum, gNum, bNum), origin);
		}

		// GET /led - Get current device state from last uplink
		if (method === 'GET' && pathname === '/led') {
			const id = env.TRACK_REGISTRY.idFromName('busylight-state');
			const stub = env.TRACK_REGISTRY.get(id);
			const stateResponse = await stub.fetch(new Request('https://internal/busylight-state'));

			if (!stateResponse.ok) {
				return corsResponse(jsonResponse({ color: null, message: 'No uplink received yet' }), origin);
			}

			const deviceState = await stateResponse.json();

			// Also get queue depth
			const queueResult = await getQueueDepth(env);
			const queueData = await queueResult.json();

			return corsResponse(jsonResponse({
				...deviceState,
				queue: queueData,
			}), origin);
		}

		// GET /queue - Get ChirpStack queue depth
		if (method === 'GET' && pathname === '/queue') {
			return corsResponse(await getQueueDepth(env), origin);
		}

		// POST /led/command - Send device command (admin only)
		if (method === 'POST' && pathname === '/led/command') {
			// Authenticate admin operations
			const publisherSecret = request.headers.get('X-Publisher-Secret');
			const expectedSecret = env.PI_PUBLISHER_SECRET;

			if (expectedSecret && publisherSecret !== expectedSecret) {
				return corsResponse(jsonResponse({ error: 'Unauthorized' }, 401), origin);
			}

			const body = await request.json();
			const { command, param } = body;

			if (command === undefined || param === undefined) {
				return corsResponse(jsonResponse({ error: 'Missing command or param' }, 400), origin);
			}

			const result = await sendCommand(env, Number(command), Number(param));
			return corsResponse(jsonResponse(result), origin);
		}

		// POST /uplink - Webhook from ChirpStack for uplink/ACK events
		if (method === 'POST' && pathname === '/uplink') {
			// Verify webhook secret (set via wrangler secret put CHIRPSTACK_WEBHOOK_SECRET)
			const authHeader = request.headers.get('Authorization');
			const expectedToken = env.CHIRPSTACK_WEBHOOK_SECRET;

			if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
				console.warn('Unauthorized uplink webhook attempt');
				return jsonResponse({ error: 'Unauthorized' }, 401);
			}

			const payload = await request.json();
			const eventType = payload.type || 'unknown';
			const deviceEUI = payload.deviceInfo?.devEui || 'unknown';

			console.log(`Uplink event: ${eventType}, DevEUI: ${deviceEUI}`);

			// Parse telemetry from the data field (base64 encoded)
			let deviceState = null;
			if (payload.data) {
				deviceState = parseUplinkPayload(payload.data);
				if (deviceState.error) {
					console.log('Uplink parse note:', deviceState.error, deviceState.length);
				} else {
					console.log('Device state:', JSON.stringify(deviceState));

					// Store in Durable Object
					const id = env.TRACK_REGISTRY.idFromName('busylight-state');
					const stub = env.TRACK_REGISTRY.get(id);
					await stub.fetch(new Request('https://internal/busylight-state', {
						method: 'POST',
						body: JSON.stringify(deviceState),
					}));
				}
			}

			return jsonResponse({
				received: true,
				eventType,
				deviceState: deviceState?.error ? null : deviceState,
			});
		}

		// Not found
		return corsResponse(jsonResponse({ error: 'Not found' }, 404), origin);

	} catch (error) {
		console.error('Request error:', error);
		return corsResponse(jsonResponse({ error: 'Internal server error' }, 500), origin);
	}
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function corsResponse(response, origin) {
	const headers = new Headers(response.headers);

	// Only allow specific origins
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Vary', 'Origin');
	} else if (!origin) {
		// No origin header (same-origin request or non-browser client)
		// Allow but don't set CORS headers
	}
	// If origin is set but not allowed, don't set Access-Control-Allow-Origin
	// This will cause the browser to block the response

	headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Publisher-Secret');
	headers.set('Access-Control-Max-Age', '86400');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
