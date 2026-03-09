import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('wardrobe suggest worker', () => {
	it('returns 404 for unknown route (unit style)', async () => {
		const request = new IncomingRequest('http://example.com/unknown');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Not found' });
	});

	it('returns 405 for GET on /suggest-wardrobe (integration style)', async () => {
		const response = await SELF.fetch('https://example.com/suggest-wardrobe');
		expect(response.status).toBe(405);
		expect(await response.json()).toEqual({ error: 'Method not allowed' });
	});

	it('returns 400 when imageBase64 is missing', async () => {
		const response = await SELF.fetch('https://example.com/suggest-wardrobe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ mimeType: 'image/jpeg' }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'imageBase64 is required.' });
	});
});
