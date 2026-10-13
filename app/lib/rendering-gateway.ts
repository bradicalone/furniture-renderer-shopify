// Fixed operation-to-route mapping: no caller-supplied hosts, shops or raw paths.
export function renderingOperation(input: Record<string, unknown>) {
  const uuid = (value: unknown) => {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid resource ID.');
    return value;
  };
  const job = () => `/jobs/${uuid(input.jobId)}`;
  const combo = () => `${job()}/combinations/${uuid(input.combinationId)}`;
  const payload = input.body ?? {};
  switch (input.operation) {
    case 'upload': return { path: '/uploads', body: payload, mutation: true };
    case 'verify': return { path: `/uploads/${uuid(input.uploadId)}/verify`, body: {}, mutation: false };
    case 'create': return { path: '/jobs', body: payload, mutation: true };
    case 'list': return { path: `/jobs?limit=25${input.cursor ? `&cursor=${uuid(input.cursor)}` : ''}`, body: undefined, mutation: false };
    case 'detail': return { path: job(), body: undefined, mutation: false };
    case 'download': return { path: `${job()}/outputs/${uuid(input.outputId)}/download`, body: undefined, mutation: false };
    case 'source': return { path: `/uploads/${uuid(input.uploadId)}/download`, body: undefined, mutation: false };
    case 'adjust': return { path: `${combo()}/adjustments`, body: payload, mutation: true };
    case 'approve': return { path: `${combo()}/approve`, body: payload, mutation: true };
    case 'retry': return { path: `${job()}/retry`, body: payload, mutation: true };
    case 'cancel': return { path: `${job()}/cancel`, body: {}, mutation: true };
    default: throw new Error('Unknown rendering operation.');
  }
}
