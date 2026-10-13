import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { RenderingClientError, renderingCall } from '../lib/rendering-client';
import type { DetailResponse, DownloadResponse, UploadedFileResponse } from '../lib/rendering-types';
import styles from '../styles/render-workspace.module.css';

export const loader = async ({request, params}: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {jobId:params.jobId!};
};
function OutputPreview({jobId, outputId, label, uploadId}: {jobId: string; outputId?: string; uploadId?: string; label: string}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await renderingCall<DownloadResponse | UploadedFileResponse>(uploadId ? {operation:'source', uploadId} : {operation:'download', jobId, outputId});
      const parsed = new URL(response.url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'uploads.blob.core.windows.net') throw new Error('Unexpected preview URL.');
      setUrl(response.url); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Preview unavailable.'); }
  }, [jobId, outputId, uploadId]);
  useEffect(() => { const first = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 10 * 60 * 1000); return () => { clearTimeout(first); clearInterval(timer); }; }, [refresh]);
  return <figure>
    {url && <><img src={url} alt={label} referrerPolicy="no-referrer" style={{maxWidth:'100%', maxHeight:400}} onError={() => setError('Preview expired or unavailable. Refresh the image.')} /><p><a href={url} target="_blank" rel="noreferrer">Open / download image</a></p></>}
    <figcaption>{label}</figcaption>
    {error && <p role="alert">{error}</p>}
    <button onClick={refresh}>Refresh image link</button>
  </figure>;
}
export default function JobDetail() {
  const {jobId} = useLoaderData<typeof loader>();
  const [job, setJob] = useState<DetailResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const pending = useRef<{signature:string; key:string} | null>(null);
  const active = useRef(false);
  const refresh = useCallback(async () => {
    const next = await renderingCall<DetailResponse>({operation:'detail', jobId});
    setJob(next);
  }, [jobId]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await refresh(); } catch (error) { if (!stopped) setError(error instanceof Error ? error.message : 'Unable to load job.'); }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [refresh]);
  async function mutate(operation: string, body: unknown, combinationId?: string) {
    if (active.current) return;
    const input = {operation, body, jobId, ...(combinationId ? {combinationId} : {})};
    const signature = JSON.stringify(input);
    if (pending.current && pending.current.signature !== signature) {
      setError('Retry the previous action unchanged before starting another mutation. Its result is uncertain.'); return;
    }
    pending.current ??= {signature, key:crypto.randomUUID()};
    active.current = true; setBusy(true); setError('');
    try {
      await renderingCall({...input, key:pending.current.key});
      pending.current = null;
      await refresh();
    } catch (error) {
      if (error instanceof RenderingClientError && error.status >= 400 && error.status < 500) pending.current = null;
      setError(error instanceof Error ? error.message : 'Action failed.');
      void refresh().catch(() => {});
    }
    finally { active.current = false; setBusy(false); }
  }
  return <s-page heading={job?.name ?? 'Rendering job'} inlineSize="large">
    <s-button slot="secondary-actions" href="/app">Back to jobs</s-button>
    {error && <p role="alert">{error}</p>}
    {!job && <p role="status">Loading job…</p>}
    {job && <>
      <s-section heading="Progress">
        <p role="status">{job.status} · {job.progress.completed}/{job.progress.planned} outputs · {job.progress.failed} failed · {job.progress.running} running</p>
        <progress max={Math.max(1,job.progress.planned)} value={job.progress.completed} />
        {job.completedAt && <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>}
        {!job.cancelled && job.status !== 'completed' && <button disabled={busy} onClick={() => { if (window.confirm('Cancel this job? Pending work will stop; already dispatched renders may still incur charges.')) void mutate('cancel', {}); }}>Cancel job</button>}
        <p>Approval renders remaining angles. Adjustments and retries may incur image-generation charges.</p>
      </s-section>
      {job.combinations.map(combination => {
        const revision = combination.revisions.find(r => r.number === combination.currentRevision);
        const proof = revision?.outputs.find(output => output.kind === 'proof');
        const furniture = job.furniture.find(item => item.id === combination.furnitureId);
        const fabric = job.fabrics.find(item => item.id === combination.fabricId);
        const currentTasks = job.tasks.filter(task => task.combinationId === combination.id && task.revision === combination.currentRevision);
        const failureIds = currentTasks.filter(task => task.state === 'failed').map(task => task.id);
        const field = `${combination.id}:${combination.currentRevision}`;
        return <s-section key={combination.id} heading={`${furniture?.name ?? combination.furnitureId} / ${fabric?.name ?? combination.fabricId}`}>
          <p>Revision {combination.currentRevision} · {combination.approvedRevision === combination.currentRevision ? 'Approved' : 'Awaiting proof approval'}</p>
          <details><summary>Rendering instructions and settings</summary><p>Batch: {job.jobInstructions || 'None'}</p><p>Furniture: {furniture?.furnitureInstructions || 'None'}</p><p>{furniture?.options?.background} background · contact shadows: {furniture?.options?.addContactShadow ? 'yes' : 'no'} · bedding: {furniture?.options?.addBedding ? 'yes' : 'no'}</p><ul>{revision?.adjustments.map((text,index) => <li key={index}>{text || 'Re-render'}</li>)}</ul></details>
          {!proof && <p>Proof pending. Rendering progress is refreshed every five seconds.</p>}
          {revision?.outputs.map(output => <OutputPreview key={output.id} jobId={jobId} outputId={output.id} label={`${output.kind}: ${output.relativePath}`} />)}
          {!!furniture?.comparisons?.length && <details><summary>Cylindo comparisons (not rendering inputs)</summary>{furniture.comparisons.map(source => <OutputPreview key={source.uploadId} jobId={jobId} uploadId={source.uploadId} label={source.relativePath} />)}</details>}
          {!!proof && !job.cancelled && <fieldset disabled={busy}>
            <legend>Review current proof</legend>
            <label>Adjustment instructions<textarea className={styles.instructions} maxLength={4000} rows={3} value={adjustments[field] ?? ''} onChange={event => setAdjustments(previous => ({...previous,[field]:event.target.value}))} /></label>
            <button onClick={() => mutate('adjust', {revision:combination.currentRevision, instructions:adjustments[field] ?? ''}, combination.id)}>Request adjustment / re-render</button>
            <button disabled={combination.approvedRevision === combination.currentRevision} onClick={() => mutate('approve',{revision:combination.currentRevision},combination.id)}>Approve proof and render remaining angles</button>
          </fieldset>}
          {currentTasks.filter(task => task.state === 'failed').map(task => <p role="alert" key={task.id}>{task.kind}: {task.error?.message ?? 'Rendering failed'} (attempts: {task.totalAttempts})</p>)}
          {!!failureIds.length && !job.cancelled && <button disabled={busy} onClick={() => mutate('retry',{taskIds:failureIds})}>Retry failed renders</button>}
          <p>Shopify publishing is not connected yet. Product matches must be confirmed before publishing.</p>
        </s-section>;
      })}
    </>}
  </s-page>;
}
export const headers: HeadersFunction = args => boundary.headers(args);
