import { useEffect, useRef, useState } from 'react';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { Link } from 'react-router';
import { authenticate } from '../shopify.server';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { RenderingClientError, renderingCall } from '../lib/rendering-client';
import type { ListResponse } from '../lib/rendering-types';
import styles from '../styles/render-workspace.module.css';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
export default function Index() {
  const [data,setData] = useState<ListResponse | null>(null);
  const [error,setError] = useState('');
  const [actionError,setActionError] = useState('');
  const [archived,setArchived] = useState(false);
  const [busy,setBusy] = useState(false);
  const [version,setVersion] = useState(0);
  const pending = useRef<{jobId:string; operation:string; key:string} | null>(null);
  const active = useRef(false);
  const [cursor,setCursor] = useState<string | undefined>();
  useEffect(() => {
    let stopped=false;
    let timer:ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const result=await renderingCall<ListResponse>({operation:'list',cursor,archived});
        if (!stopped) { setData(result); setError(''); }
      } catch(error) { if (!stopped) setError(error instanceof Error ? error.message : 'Jobs unavailable.'); }
      if (!stopped) timer=setTimeout(load,10000);
    }
    void load();
    return () => { stopped=true; clearTimeout(timer); };
  },[cursor,archived,version]);
  async function changeArchive(jobId:string, operation:'archive' | 'restore') {
    if (active.current) return;
    if (pending.current && (pending.current.jobId !== jobId || pending.current.operation !== operation)) { setActionError('Retry the previous archive or restore action first.'); return; }
    pending.current ??= {jobId,operation,key:crypto.randomUUID()};
    active.current=true; setBusy(true); setActionError('');
    try {
      await renderingCall({...pending.current,body:{}});
      pending.current=null; setData(null); setVersion(v=>v+1);
    } catch (error) {
      if (error instanceof RenderingClientError && error.status >= 400 && error.status < 500) pending.current=null;
      setActionError(error instanceof Error ? error.message : 'Action failed.');
    }
    finally {active.current=false; setBusy(false);}
  }
  return <s-page heading="Rendering jobs">
    <s-button slot="primary-action" href="/app/render" variant="primary">New rendering job</s-button>
    <s-section heading="Job activity">
      <label><input type="checkbox" checked={archived} disabled={busy} onChange={event => {setArchived(event.target.checked);setCursor(undefined);setData(null);}} /> Show archived jobs</label>
      {error && <p role="alert">{error}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      {!data && !error && <p>Loading jobs…</p>}
      {data && !data.items.length && <p>No jobs in this view.</p>}
      <div className={styles.jobList}>
        {data?.items.map(job => <article key={job.id} className={styles.jobCard} aria-labelledby={`job-${job.id}`}>
          <div className={styles.jobCardHeader}>
            <h3 id={`job-${job.id}`}><Link to={`/app/jobs/${job.id}`}>{job.name}</Link></h3>
            <span className={styles.jobStatus}>{job.status.replaceAll('_', ' ')}</span>
          </div>
          <p>{job.progress.completed}/{job.progress.planned} outputs · {job.progress.failed} failed</p>
          <p>Created by: {job.createdBy?.displayName ?? 'Unknown'}</p>
          <div className={styles.jobDates}>
            <span>Created <time dateTime={job.createdAt}>{new Date(job.createdAt).toLocaleString()}</time></span>
            {job.completedAt && <span>Completed <time dateTime={job.completedAt}>{new Date(job.completedAt).toLocaleString()}</time></span>}
          </div>
          <Link to={`/app/jobs/${job.id}`}>View job and actions →</Link>
          {(job.archivedAt || job.status === 'completed' || job.status === 'cancelled') && <button disabled={busy} onClick={() => changeArchive(job.id, job.archivedAt ? 'restore' : 'archive')}>{job.archivedAt ? 'Restore job' : 'Archive job'}</button>}
        </article>)}
      </div>
      {cursor && <button onClick={() => { setData(null); setCursor(undefined); }}>Newest jobs</button>}
      {data?.nextCursor && <button onClick={() => { setData(null); setCursor(data.nextCursor!); }}>Older jobs</button>}
    </s-section>
  </s-page>;
}
export const headers: HeadersFunction = args => boundary.headers(args);
