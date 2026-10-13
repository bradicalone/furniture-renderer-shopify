import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
import { renderingOperation } from '../lib/rendering-gateway';
import { RenderingApiError, renderingRequest } from '../services/rendering-api.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return json({ error: { message: 'POST required.' } }, 405);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: { message: 'JSON required.' } }, 415);
  // Session authentication plus same-origin mutations; absent Origin is permitted
  // for authenticated clients. Never trust a browser-provided shop header.
  const origin = request.headers.get('origin');
  const expected = process.env.SHOPIFY_APP_URL;
  if (origin && expected && origin !== new URL(expected).origin) return json({ error: { message: 'Invalid request origin.' } }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2 * 1024 * 1024) return json({ error: { message: 'Split this batch into smaller jobs.' } }, 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request.');
    const operation = renderingOperation(input);
    if (operation.mutation && (typeof input.key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.key))) throw new Error('Idempotency key required.');
    return json(await renderingRequest(session.shop, operation.path, operation.body, operation.mutation ? input.key : undefined));
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof RenderingApiError) return json({ error: { code: error.code, message: error.message } }, error.status);
    return json({ error: { message: 'Invalid rendering request.' } }, 400);
  }
};
