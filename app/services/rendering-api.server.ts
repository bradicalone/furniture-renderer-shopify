// Only authenticated route handlers may call this adapter. No browser imports.
export class RenderingApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status=status; this.code=code; }
}
export function renderingConfigured() {
  return Boolean(process.env.RENDERING_API_URL && process.env.RENDERING_API_TOKEN);
}
export async function renderingRequest<T>(shop: string, path: string, body?: unknown, key?: string): Promise<T> {
  if (!renderingConfigured()) throw new RenderingApiError(503, 'not_configured', 'Rendering service is not configured.');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) throw new RenderingApiError(400, 'invalid_shop', 'Invalid authenticated shop.');
  const base = new URL(process.env.RENDERING_API_URL!);
  // Accept either an origin or the full API base, never an arbitrary route prefix.
  if (!['', '/', '/api/rendering/v1', '/api/rendering/v1/'].includes(base.pathname) || base.search || base.hash || base.username || base.password || base.protocol !== 'https:') {
    throw new RenderingApiError(503, 'invalid_configuration', 'Rendering API URL must be an HTTPS origin or end in /api/rendering/v1.');
  }

  // Query strings are constructed by the gateway, not interpreted as path text.
  const [pathname, query] = path.split('?');
  base.pathname = `/api/rendering/v1${pathname}`;
  base.search = query ?? '';
  let response: Response;
  try {
    response = await fetch(base, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${process.env.RENDERING_API_TOKEN}`, 'X-Rendering-Shop': shop,
        'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(120000), redirect: 'error',
    });
  } catch { throw new RenderingApiError(503, 'unavailable', 'Rendering service could not be reached. Retry the same action.'); }
  if (!response.ok) {
    let code = 'backend_error';
    try { const error = await response.json(); if (/^[a-z_]{1,80}$/.test(error?.error?.code)) code = error.error.code; } catch { /* Do not expose proxy/provider bodies. */ }
    throw new RenderingApiError(response.status, code, `Rendering request failed (${response.status}, ${code}).`);
  }
  try { return await response.json() as T; }
  catch { throw new RenderingApiError(502, 'invalid_response', 'Rendering service returned an invalid response.'); }
}
