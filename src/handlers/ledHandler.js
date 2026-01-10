/**
 * Parse uplink telemetry from Busylight (24-byte payload)
 * Returns device status including current color, signal quality, and firmware info
 */
export function parseUplinkPayload(base64Data) {
	let bytes;
	try {
		bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
	} catch (e) {
		return { error: 'Invalid base64 payload', details: e.message };
	}

	if (bytes.length !== 24) {
		return { error: 'Invalid payload length', length: bytes.length };
	}

	// Helper to read signed/unsigned 32-bit little-endian integers
	const readInt32 = (offset) => {
		const val = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
		return val;
	};
	const readUint32 = (offset) => {
		return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
	};

	// Note: Device sends R, B, G order
	const red = bytes[16];
	const blue = bytes[17];
	const green = bytes[18];

	return {
		rssi: readInt32(0),           // dBm
		snr: readInt32(4),            // dB
		downlinksReceived: readUint32(8),
		uplinksSent: readUint32(12),
		color: {
			r: red,
			g: green,
			b: blue,
			hex: rgbToHex(red, green, blue),
		},
		timing: {
			onDuration: bytes[19],    // 1/10 seconds
			offDuration: bytes[20],   // 0 = steady
		},
		firmware: {
			sw: bytes[21],
			hw: bytes[22],
		},
		adrEnabled: bytes[23] === 1,
		timestamp: Date.now(),
	};
}

/**
 * Send a command to the Busylight (2-byte commands)
 * Commands: 0x04=set uplink interval, 0x05=request uplink, 0x06=auto-uplink toggle
 */
export async function sendCommand(env, commandByte, paramByte) {
	const apiUrl = env.CHIRPSTACK_API_URL;
	const deviceId = env.CHIRPSTACK_BUSYLIGHT_DEVICE_ID;
	const apiToken = env.CHIRPSTACK_API;

	if (!apiUrl) {
		return { error: 'CHIRPSTACK_API_URL not configured', status: 500 };
	}

	if (!deviceId) {
		return { error: 'CHIRPSTACK_BUSYLIGHT_DEVICE_ID not configured', status: 500 };
	}

	if (!apiToken) {
		return { error: 'CHIRPSTACK_API secret not configured', status: 500 };
	}

	const payloadBytes = new Uint8Array([commandByte, paramByte]);
	const base64Payload = btoa(String.fromCharCode(...payloadBytes));

	console.log(`Sending command: 0x${commandByte.toString(16).padStart(2, '0')} 0x${paramByte.toString(16).padStart(2, '0')}`);

	const response = await fetch(`${apiUrl}/devices/${deviceId}/queue`, {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Grpc-Metadata-Authorization': `Bearer ${apiToken}`,
		},
		body: JSON.stringify({
			queueItem: {
				confirmed: false,
				data: base64Payload,
				fPort: 15,
			},
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		return { error: 'Failed to send command', status: response.status, details: errorText };
	}

	return { success: true, command: commandByte, param: paramByte };
}

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

function rgbToHex(r, g, b) {
	return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
