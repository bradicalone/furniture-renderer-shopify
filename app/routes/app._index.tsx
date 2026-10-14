import { useEffect, useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';
import { authenticate } from '../shopify.server';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { renderingCall } from '../lib/rendering-client';
import type { ListResponse } from '../lib/rendering-types';
import styles from '../styles/render-workspace.module.css';

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
      <div className={styles.jobList}>
        {data?.items.map(job => <article key={job.id} className={styles.jobCard} aria-labelledby={`job-${job.id}`}>
          <div className={styles.jobCardHeader}>
            <h3 id={`job-${job.id}`}><Link to={`/app/jobs/${job.id}`}>{job.name}</Link></h3>
            <span className={styles.jobStatus}>{job.status.replaceAll('_', ' ')}</span>
          </div>
          <p>{job.progress.completed}/{job.progress.planned} outputs · {job.progress.failed} failed</p>
          <div className={styles.jobDates}>
            <span>Created <time dateTime={job.createdAt}>{new Date(job.createdAt).toLocaleString()}</time></span>
            {job.completedAt && <span>Completed <time dateTime={job.completedAt}>{new Date(job.completedAt).toLocaleString()}</time></span>}
          </div>
          <Link to={`/app/jobs/${job.id}`}>View job and actions →</Link>
        </article>)}
      </div>
      {cursor && <button onClick={() => { setData(null); setCursor(undefined); }}>Newest jobs</button>}
      {data?.nextCursor && <button onClick={() => { setData(null); setCursor(data.nextCursor!); }}>Older jobs</button>}
    </s-section>
  </s-page>;
}
export const headers: HeadersFunction = args => boundary.headers(args);
