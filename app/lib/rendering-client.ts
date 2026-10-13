export class RenderingClientError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function renderingCall<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  // App Bridge normally intercepts fetch. Explicitly await its token here so
  // resource requests do not depend on implicit interception timing.
  const bridge = typeof window === 'undefined' ? undefined
    : (window as Window & { shopify?: { idToken: () => Promise<string> } }).shopify;
  if (!bridge?.idToken) {
    throw new Error('Shopify authentication is not ready. Open Furniture Renderer from Shopify Admin and retry.');
  }
  let token: string;
  try { token = await bridge.idToken(); }
  catch { throw new Error('Could not obtain a Shopify session token. Reopen Furniture Renderer from Shopify Admin.'); }
  let response: Response;
  try {
    response = await fetch('/app/api/rendering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input), signal,
    });
  } catch { throw new Error('Request interrupted. Retry to resume the same action.'); }
  if (response.redirected || response.status === 401) {
    throw new RenderingClientError(401, 'Shopify authentication was redirected or rejected. Reopen Furniture Renderer from Shopify Admin and retry.');
  }
  const contentType = response.headers.get('content-type') ?? 'missing';
  if (!contentType.toLowerCase().includes('application/json')) {
    // Never display returned HTML, URLs or authentication query strings.
    const hint = response.status === 404 ? 'The rendering API route is missing from the deployed app.'
      : response.status === 405 ? 'The deployed rendering route does not accept this request.'
      : response.status >= 500 ? 'Check the Shopify web app runtime logs for this request.'
      : 'Check the request status and Content-Type in browser Network tools.';
    throw new RenderingClientError(response.status, `Rendering endpoint returned a non-JSON response (HTTP ${response.status}). ${hint}`);
  }
  let data;
  try { data = await response.json(); }
  catch { throw new RenderingClientError(response.status, `Rendering endpoint returned invalid JSON (HTTP ${response.status}). Check the Shopify web app runtime logs.`); }
  if (!response.ok) throw new RenderingClientError(response.status, data?.error?.message ?? `Rendering request failed (HTTP ${response.status}).`);
  return data as T;
}
