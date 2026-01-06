/**
 * Send a color downlink to the Busylight
 * Payload format: [R, B, G, onDuration, offDuration] (note: R, B, G order per device spec)
 */
export async function sendDownlink(env, red, green, blue) {
	const apiUrl = env.CHIRPSTACK_API_URL;
	const deviceId = env.CHIRPSTACK_BUSYLIGHT_DEVICE_ID;
	const apiToken = env.CHIRPSTACK_API;

	if (!apiToken) {
		return jsonResponse({ error: 'CHIRPSTACK_API secret not configured' }, 500);
	}

	try {
		// Clamp values to 0-255
		const r = Math.max(0, Math.min(255, parseInt(red, 10)));
		const g = Math.max(0, Math.min(255, parseInt(green, 10)));
		const b = Math.max(0, Math.min(255, parseInt(blue, 10)));

		// Prepare payload: [R, B, G, onDuration, offDuration]
		// Note: The Kuando Busylight expects R, B, G order (not R, G, B)
		const payloadBytes = new Uint8Array([
			r,
			b,    // Blue comes before Green in this device's protocol
			g,
			255,  // On duration (0-255, value is 1/10 seconds) - 255 = always on
			0,    // Off duration (0 = steady light, no blinking)
		]);

		const base64Payload = btoa(String.fromCharCode(...payloadBytes));

		console.log(`Sending downlink: RGB(${r}, ${g}, ${b}) -> payload: ${base64Payload}`);

		const downlinkPayload = {
			queueItem: {
				confirmed: false,  // Unconfirmed - no ACK needed, no retries
				data: base64Payload,
				fPort: 15,
			},
		};

		const response = await fetch(`${apiUrl}/devices/${deviceId}/queue`, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Grpc-Metadata-Authorization': `Bearer ${apiToken}`,
			},
			body: JSON.stringify(downlinkPayload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('ChirpStack API error:', response.status, errorText);
			return jsonResponse({
				error: 'Failed to queue downlink',
				status: response.status,
				details: errorText,
			}, 500);
		}

		const result = await response.json();
		console.log('Downlink queued:', JSON.stringify(result));

		// Get queue depth after adding
		const queueResponse = await getQueueDepthInternal(env);

		return jsonResponse({
			success: true,
			color: { r, g, b },
			hex: rgbToHex(r, g, b),
			payload: base64Payload,
			queueDepth: queueResponse.queueDepth,
			downlinkId: result.id,
		});

	} catch (error) {
		console.error('Downlink error:', error);
		return jsonResponse({ error: error.message }, 500);
	}
}

/**
 * Get current queue depth from ChirpStack
 */
export async function getQueueDepth(env) {
	const result = await getQueueDepthInternal(env);
	return jsonResponse(result);
}

async function getQueueDepthInternal(env) {
	const apiUrl = env.CHIRPSTACK_API_URL;
	const deviceId = env.CHIRPSTACK_BUSYLIGHT_DEVICE_ID;
	const apiToken = env.CHIRPSTACK_API;

	if (!apiToken) {
		return { error: 'CHIRPSTACK_API secret not configured', queueDepth: 0 };
	}

	try {
		const response = await fetch(`${apiUrl}/devices/${deviceId}/queue`, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Grpc-Metadata-Authorization': `Bearer ${apiToken}`,
			},
		});

		if (!response.ok) {
			console.error('Failed to get queue:', response.status);
			return { queueDepth: 0, error: 'Failed to fetch queue' };
		}

		const data = await response.json();
		const items = data.result || [];

		return {
			queueDepth: items.length,
			items: items.map(item => ({
				id: item.id,
				confirmed: item.confirmed,
				fPort: item.fPort,
				pending: item.isPending,
			})),
		};

	} catch (error) {
		console.error('Queue fetch error:', error);
		return { queueDepth: 0, error: error.message };
	}
}

/**
 * Get the current/last set color (stored in KV if available)
 */
export async function getCurrentColor(env) {
	// For now, just return queue status since we don't have KV set up yet
	const queue = await getQueueDepthInternal(env);
	return jsonResponse({
		color: null, // Would come from KV storage
		queue,
	});
}

function rgbToHex(r, g, b) {
	return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
