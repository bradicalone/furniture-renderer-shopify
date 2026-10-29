import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { UploadSource, BulkDraft } from '../lib/bulk-submission';
import { createManifest, draftFiles } from '../lib/bulk-submission';
import { renderingCall } from '../lib/rendering-client';
import type { CreateRequest, CreateResponse, UploadResponse, VerifyResponse } from '../lib/rendering-types';

type SubmissionProps = { draft: BulkDraft; files?: never; buildManifest?: never } | { draft?: never; files: UploadSource[]; buildManifest: (uploads: Map<string,string>) => CreateRequest };
export function BulkSubmission({ draft, files: customFiles, buildManifest }: SubmissionProps) {
  const uploads = useRef(new Map<string, string>());
  const keys = useRef(new Map<string, string>());
  const jobKey = useRef(crypto.randomUUID());
  const active = useRef(false);
  const abort = useRef(new AbortController());
  const [state, setState] = useState<'ready' | 'uploading' | 'verified' | 'creating' | 'created'>('ready');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [job, setJob] = useState('');
  const [paid, setPaid] = useState(false);
  useEffect(() => { const controller = new AbortController(); abort.current = controller; return () => controller.abort(); }, []);
  async function upload() {
    if (active.current) return;
    active.current = true; setError(''); setState('uploading');
    try {
      const files = customFiles ?? draftFiles(draft!);
      for (const source of files) {
        if (source.file.size <= 0 || source.file.size > 20 * 1024 * 1024) throw new Error(`${source.relativePath}: images must be between 1 byte and 20 MiB.`);
      }
      for (let index = 0; index < files.length; index++) {
        const source = files[index];
        setProgress(`${index + 1} of ${files.length}: ${source.relativePath}`);
        if (uploads.current.has(source.relativePath)) continue;
        const digest = await crypto.subtle.digest('SHA-256', await source.file.arrayBuffer());
        const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        const contentType = source.file.type || ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'} as Record<string,string>)[source.file.name.split('.').at(-1)!.toLowerCase()];
        let key = keys.current.get(source.relativePath);
        if (!key) { key = crypto.randomUUID(); keys.current.set(source.relativePath, key); }
        const signed = await renderingCall<UploadResponse>({operation:'upload', key, body:{relativePath:source.relativePath, role:source.role, size:source.file.size, contentType, sha256}}, abort.current.signal);
        const url = new URL(signed.upload.url);
        if (url.protocol !== 'https:' || url.hostname !== 'uploads.blob.core.windows.net' || !url.pathname.startsWith('/renderes/')) throw new Error('Unexpected storage destination returned by server.');
        const result = await fetch(url, {method:'PUT', headers:signed.upload.headers, body:source.file, credentials:'omit', referrerPolicy:'no-referrer', signal:abort.current.signal});
        if (!result.ok) throw new Error(`Azure upload failed (${result.status}) for ${source.relativePath}. Retry uploads to refresh the signed URL.`);
        const verified = await renderingCall<VerifyResponse>({operation:'verify', uploadId:signed.uploadId}, abort.current.signal);
        if (!verified.verified || verified.relativePath !== source.relativePath || verified.role !== source.role) throw new Error('Upload verification mismatch.');
        uploads.current.set(source.relativePath, signed.uploadId);
      }
      setState('verified'); setProgress('All images uploaded and verified. No rendering job has been created.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Upload failed.'); setState('ready'); }
    finally { active.current = false; }
  }
  async function create() {
    if (active.current || !paid) return;
    active.current = true; setState('creating'); setError('');
    try {
      const result = await renderingCall<CreateResponse>({operation:'create', key:jobKey.current, body:buildManifest ? buildManifest(uploads.current) : createManifest(draft!, uploads.current)}, abort.current.signal);
      setJob(result.id); setState('created');
    } catch (error) { setError(error instanceof Error ? error.message : 'Job creation failed.'); setState('verified'); }
    finally { active.current = false; }
  }
  return <s-section heading="Upload and submit">
    <p>Selections are locked for this confirmed draft. Keep this page open until submission completes. Retrying here reuses completed uploads and the same action keys.</p>
    <p role="status">{progress}</p>
    {error && <p role="alert">{error}</p>}
    {state === 'ready' && <button onClick={upload}>Upload and verify images only</button>}
    {state === 'uploading' && <p>Uploading…</p>}
    {state === 'verified' && <>
      <label><input type="checkbox" checked={paid} onChange={event => setPaid(event.target.checked)} /> Start rendering proofs. This may incur image-generation charges.</label>
      <button disabled={!paid} onClick={create}>Create job and generate proofs</button>
    </>}
    {state === 'creating' && <p>Submitting job… If the response is interrupted, retry here before starting another job.</p>}
    {state === 'created' && <Link to={`/app/jobs/${job}`}>Open job and review proofs</Link>}
  </s-section>;
}
