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
  const timeout = AbortSignal.timeout(25000);
  let response: Response;
  try {
    response = await fetch(base, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${process.env.RENDERING_API_TOKEN}`, 'X-Rendering-Shop': shop,
        'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout, redirect: 'error',
    });
  } catch {
    if (timeout.aborted) throw new RenderingApiError(504, 'backend_timeout', 'The rendering API did not respond within 25 seconds. Check the Express server logs and retry the same action.');
    throw new RenderingApiError(503, 'unavailable', 'Rendering service could not be reached. Check API connectivity and retry the same action.');
  }
  if (!response.ok) {
    let code = 'backend_error';
    let detail = '';
    const safeUploadMessages = new Set([
      'Image exceeds the size limit or is empty.',
      'Uploaded bytes do not match the declared size and checksum.',
      'Upload a single-frame JPEG, PNG or WebP with matching content type.',
      'Decoded image is too large. Reduce its dimensions.',
      'Image could not be decoded safely. Upload a valid JPEG, PNG or WebP.',
      'Image is too large.',
    ]);
    try {
      const error = await response.json();
      if (/^[a-z_]{1,80}$/.test(error?.error?.code)) code = error.error.code;
      if (response.status === 422 && code === 'invalid_upload' && safeUploadMessages.has(error?.error?.message)) detail = ` ${error.error.message}`;
    } catch { /* Do not expose proxy/provider bodies. */ }
    const sourceHints:Record<string,string> = {
      source_forbidden:' Ask an operator to review source and target catalog grants for this shop.',
      source_version_changed:' Resolve fresh versions, review the images again and start a new confirmed submission.',
      invalid_target_mapping:' Check target variant IDs, color code and source geometry against the reviewed catalog.',
      source_lookup_failed:' Source lookup is unavailable; this does not mean angles are missing.',
      source_unavailable:' A saved source cannot be read; do not substitute it as a missing angle.',
      source_integrity_failed:' Saved source integrity check failed. Contact the service administrator.',
    };
    detail ||= sourceHints[code] ?? '';
    throw new RenderingApiError(response.status, code, `Rendering request failed (${response.status}, ${code}).${detail}`);
  }
  try { return await response.json() as T; }
  catch {
    if (timeout.aborted) throw new RenderingApiError(504, 'backend_timeout', 'The rendering API response timed out. Retry the same action.');
    throw new RenderingApiError(502, 'invalid_response', 'Rendering service returned an invalid response.');
  }
}
