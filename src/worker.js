import { handleRequest } from './router.js';

// Export the Track Registry Durable Object
export { TrackRegistry } from './trackRegistry.js';

export default {
	async fetch(request, env, ctx) {
		return handleRequest(request, env, ctx);
	},
};
