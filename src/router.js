import { sendDownlink, getQueueDepth, getCurrentColor } from './handlers/ledHandler.js';

export async function handleRequest(request, env, ctx) {
	const url = new URL(request.url);
	const pathname = url.pathname;
	const method = request.method;

	// CORS preflight
	if (method === 'OPTIONS') {
		return corsResponse(new Response(null, { status: 204 }));
	}

	try {
		// POST /led - Send color downlink
		if (method === 'POST' && pathname === '/led') {
			const body = await request.json();
			const { r, g, b } = body;

			if (r === undefined || g === undefined || b === undefined) {
				return corsResponse(jsonResponse({ error: 'Missing r, g, or b values' }, 400));
			}

			return corsResponse(await sendDownlink(env, r, g, b));
		}

		// GET /led - Get current color
		if (method === 'GET' && pathname === '/led') {
			return corsResponse(await getCurrentColor(env));
		}

		// GET /queue - Get ChirpStack queue depth
		if (method === 'GET' && pathname === '/queue') {
			return corsResponse(await getQueueDepth(env));
		}

		// POST /uplink - Webhook from ChirpStack for uplink/ACK events
		if (method === 'POST' && pathname === '/uplink') {
			const payload = await request.json();
			console.log('Uplink received:', JSON.stringify(payload, null, 2));

			// Log the event type and any confirmation data
			const eventType = payload.type || 'unknown';
			const deviceEUI = payload.deviceInfo?.devEui || 'unknown';
			const fCnt = payload.fCnt || payload.txInfo?.fCnt || 'unknown';

			console.log(`Event: ${eventType}, DevEUI: ${deviceEUI}, FCnt: ${fCnt}`);

			// If this is an ACK/confirmation, log it
			if (payload.confirmed || payload.acknowledged) {
				console.log('Downlink confirmed/acknowledged!');
			}

			return corsResponse(jsonResponse({ received: true, eventType }));
		}

		// Not found
		return corsResponse(jsonResponse({ error: 'Not found' }, 404));

	} catch (error) {
		console.error('Request error:', error);
		return corsResponse(jsonResponse({ error: error.message }, 500));
	}
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function corsResponse(response) {
	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
