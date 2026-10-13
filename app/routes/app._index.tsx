import { useEffect, useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';
import { authenticate } from '../shopify.server';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { renderingCall } from '../lib/rendering-client';
import type { ListResponse } from '../lib/rendering-types';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
export default function Index() {
  const [data,setData] = useState<ListResponse | null>(null);
  const [error,setError] = useState('');
  const [cursor,setCursor] = useState<string | undefined>();
  useEffect(() => {
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result=await renderingCall<ListResponse>({operation:'list',cursor});
        if (!stopped) { setData(result); setError(''); }
      } catch(error) { if (!stopped) setError(error instanceof Error ? error.message : 'Jobs unavailable.'); }
      if (!stopped) timer=setTimeout(load,10000);
    }
    void load();
    return () => { stopped=true; clearTimeout(timer); };
  },[cursor]);
  return <s-page heading="Rendering jobs">
    <s-button slot="primary-action" href="/app/render" variant="primary">New rendering job</s-button>
    <s-section heading="Job activity">
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading jobs…</p>}
      {data && !data.items.length && <p>No jobs on this page. Create a rendering job to start.</p>}
      {data?.items.map(job => <div key={job.id}>
        <h3><Link to={`/app/jobs/${job.id}`}>{job.name}</Link></h3>
        <p>{job.status} · {job.progress.completed}/{job.progress.planned} outputs · {job.progress.failed} failed</p>
        <p>Created {new Date(job.createdAt).toLocaleString()}{job.completedAt ? ` · Completed ${new Date(job.completedAt).toLocaleString()}` : ''}</p>
      </div>)}
      {cursor && <button onClick={() => { setData(null); setCursor(undefined); }}>Newest jobs</button>}
      {data?.nextCursor && <button onClick={() => { setData(null); setCursor(data.nextCursor!); }}>Older jobs</button>}
    </s-section>
  </s-page>;
}
export const headers: HeadersFunction = args => boundary.headers(args);
