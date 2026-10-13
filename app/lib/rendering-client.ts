export class RenderingClientError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function renderingCall<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/app/api/rendering', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  } catch { throw new Error('Request interrupted. Retry to resume the same action.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('Session expired or server unavailable. Reopen the app and retry.'); }
  if (!response.ok) throw new RenderingClientError(response.status, data?.error?.message ?? 'Rendering request failed.');
  return data as T;
}
