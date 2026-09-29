import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { parseFolder, readEntry } from "../lib/bulk-folders";
import type { FolderManifest, SourceFile } from "../lib/bulk-folders";
import styles from "../styles/render-workspace.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function RenderWorkspace() {
  const [manifest, setManifest] = useState<FolderManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [background, setBackground] = useState('white');
  const [shadows, setShadows] = useState(true);
  const [beds, setBeds] = useState<string[]>([]);
  const [jobInstructions, setJobInstructions] = useState('');
  const [furnitureInstructions, setFurnitureInstructions] = useState<Record<string, string>>({});
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [comparisons, setComparisons] = useState<Record<string, File[]>>({});
  const [comparisonErrors, setComparisonErrors] = useState<Record<string, string>>({});
  const sequence = useRef(0);

  function reset() {
    sequence.current += 1;
    setManifest(null); setConfirmed(false); setError(''); setAssignments({}); setBeds([]); setBusy(false);
    setFurnitureInstructions({}); setAdjustments({}); setComparisons({}); setComparisonErrors({});
  }
  function accept(files: SourceFile[]) {
    const next = parseFolder(files);
    setManifest(next);
    setAssignments(Object.fromEntries(next.furniture.map(group => [group.name, []])));
  }
  async function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const entries = Array.from(event.dataTransfer.items).filter(item => item.kind === 'file')
      .map(item => item.webkitGetAsEntry?.());
    reset();
    const current = sequence.current;
    if (entries.length !== 1 || !entries[0]?.isDirectory) {
      setError('Drop one parent folder, or use Choose folder if folder dragging is unavailable.'); return;
    }
    setBusy(true);
    try {
      const files = await readEntry(entries[0]);
      if (sequence.current === current) accept(files);
    } catch {
      if (sequence.current === current) setError('Could not read the whole folder. Check file permissions and choose the folder again.');
    } finally {
      if (sequence.current === current) setBusy(false);
    }
  }
  const valid = Boolean(manifest && !manifest.errors.length && !manifest.rejected.length);
  const combinations = Object.values(assignments).reduce((sum, fabrics) => sum + fabrics.length, 0);
  const ready = valid && manifest!.furniture.every(item => assignments[item.name]?.length);

  return (
    <s-page heading="New rendering job" inlineSize="large">
      <s-button slot="secondary-actions" href="/app">Back to jobs</s-button>
      <s-section heading="1. Choose a parent folder">
        <p>Choose a folder containing furniture/item-name/ images and fabrics/fabric-name/ references. Files stay on your device during review.</p>
        <div className={styles.dropArea} onDragOver={event => event.preventDefault()} onDrop={drop}>
          <strong>Drop your rendering-job folder here</strong>
          <label htmlFor="job-folder">Choose folder</label>
          <input id="job-folder" type="file" multiple
            ref={element => { element?.setAttribute('webkitdirectory', ''); }}
            onChange={event => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              if (!files.length) return;
              reset();
              accept(files.map(file => ({ file, relativePath: file.webkitRelativePath })));
            }} />
          <span>JPG, PNG and WEBP. Nested paths are preserved.</span>
        </div>
        <div role="status" aria-live="polite">{busy ? 'Reading folder…' : ''}</div>
        {error && <p role="alert">{error}</p>}
      </s-section>
      {manifest && <>
        <s-section heading="2. Confirm detected structure">
          <p><strong>{manifest.root || 'No parent folder detected'}</strong> · {manifest.furniture.length} furniture items · {manifest.fabrics.length} fabrics</p>
          {manifest.errors.map(message => <p role="alert" key={message}>{message}</p>)}
          {(['furniture', 'fabrics'] as const).map(category => <div key={category}>
            <h3>{category}/</h3>
            {manifest[category].map(group => <details key={group.name} open>
              <summary>{group.name} — {group.files.length} images</summary>
              <ul>{group.files.map(source => <li key={source.relativePath}>{source.relativePath} ({Math.ceil(source.file.size / 1024)} KB)</li>)}</ul>
            </details>)}
          </div>)}
          {manifest.ignored.length > 0 && <details><summary>{manifest.ignored.length} system files ignored</summary><ul>{manifest.ignored.map((path, index) => <li key={index}>{path}</li>)}</ul></details>}
          {manifest.rejected.length > 0 && <div role="alert"><p>Remove these rejected files and choose the folder again before confirming:</p><ul>{manifest.rejected.map((item, index) => <li key={index}>{item.path}: {item.reason}</li>)}</ul></div>}
        </s-section>
        {valid && <s-section heading="3. Assign fabrics and output settings">
          <fieldset disabled={confirmed} className={styles.uploadCard}>
            <legend>Job settings</legend>
            <p>All renders preserve furniture geometry, proportions, seams, piping, camera angle and product identity. Your instructions supplement these protected requirements.</p>
            <label className={styles.option}>Batch instructions (optional)
              <textarea className={styles.instructions} maxLength={4000} rows={4} value={jobInstructions} onChange={event => setJobInstructions(event.target.value)} placeholder="Instructions applied to every furniture and fabric combination" />
            </label>
            <label>Background <select value={background} onChange={event => setBackground(event.target.value)}><option value="white">White</option><option value="transparent">Transparent</option></select></label>
            <label><input type="checkbox" checked={shadows} onChange={event => setShadows(event.target.checked)} /> Realistic contact shadows</label>
            {manifest.furniture.map(item => <fieldset key={item.name}>
              <legend>{item.name}</legend>
              <label className={styles.option}>Furniture instructions (optional)
                <textarea className={styles.instructions} maxLength={4000} rows={3} value={furnitureInstructions[item.name] ?? ''} onChange={event => setFurnitureInstructions(previous => ({ ...previous, [item.name]: event.target.value }))} placeholder="Additional instructions for this furniture item across its fabrics" />
              </label>
              <label className={styles.option}>Cylindo comparison images (optional)
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (!files.length) return;
                  const invalid = files.some(file => !/\.(jpe?g|png|webp)$/i.test(file.name) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size);
                  setComparisonErrors(previous => ({ ...previous, [item.name]: invalid ? 'Choose nonempty JPG, PNG or WEBP comparison images.' : '' }));
                  if (!invalid) setComparisons(previous => ({ ...previous, [item.name]: files }));
                }} />
              </label>
              {comparisonErrors[item.name] && <p role="alert">{comparisonErrors[item.name]}</p>}
              <p>Comparison only; these files stay local until uploads are connected.</p>
              <ul>{comparisons[item.name]?.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
              {!!comparisons[item.name]?.length && <button type="button" onClick={() => setComparisons(previous => ({ ...previous, [item.name]: [] }))}>Remove comparison images</button>}
              <p>Choose the fabrics to render for this furniture item:</p>
              {manifest.fabrics.map(fabric => <label className={styles.option} key={fabric.name}>
                <input type="checkbox" checked={assignments[item.name]?.includes(fabric.name) ?? false} onChange={event => {
                  const checked = event.target.checked;
                  setAssignments(previous => ({ ...previous, [item.name]: checked ? [...previous[item.name], fabric.name] : previous[item.name].filter(name => name !== fabric.name) }));
                }} /> {fabric.name}
              </label>)}
              <label className={styles.option}><input type="checkbox" checked={beds.includes(item.name)} onChange={event => setBeds(event.target.checked ? [...beds, item.name] : beds.filter(name => name !== item.name))} /> This is a bed: add mattress, white sheets and pillows</label>
              <p>Shopify product: not matched yet. A confirmed product match will be required before publishing.</p>
            </fieldset>)}
          </fieldset>
          <p>{combinations} furniture-and-fabric combinations · one initial proof per combination.</p>
          {!ready && <p>Select at least one fabric for every furniture item.</p>}
          <s-button disabled={!ready || confirmed} onClick={() => setConfirmed(true)}>Confirm folder and selections</s-button>
          {confirmed && <s-button onClick={() => setConfirmed(false)}>Edit selections</s-button>}
        </s-section>}
        {confirmed && <s-section heading="Folder confirmed">
          <p role="status">Your folder and selections are confirmed locally. No files have been uploaded and no rendering job has been created.</p>
          <p>Next: connect product matching and signed uploads to submit this bulk job. This draft is cleared when you leave or reload the page.</p>
        </s-section>}
        {confirmed && <s-section heading="Proofs and outputs">
          <p>Each combination receives its own proof. Rendering is not connected yet; controls become available when the backend supplies proofs and approved outputs.</p>
          {manifest.furniture.flatMap(item => (assignments[item.name] ?? []).map(fabric => {
            const key = JSON.stringify([item.name, fabric]);
            return <div className={styles.uploadCard} key={key}>
              <h3>{item.name} / {fabric}</h3>
              <p>Awaiting job submission — no proof generated.</p>
              <details><summary>Instructions for this combination</summary>
                <p>Protected rendering requirements → batch instructions → furniture instructions → proof adjustment.</p>
                <p>Batch: {jobInstructions || 'None'}</p>
                <p>Furniture: {furnitureInstructions[item.name] || 'None'}</p>
              </details>
              <div className={styles.proofPlaceholder}>Proof and completed output previews will appear here.</div>
              <label className={styles.option}>Written proof adjustment (optional)
                <textarea className={styles.instructions} rows={3} maxLength={4000} value={adjustments[key] ?? ''} onChange={event => setAdjustments(previous => ({ ...previous, [key]: event.target.value }))} placeholder="Describe changes for this furniture/fabric proof" />
              </label>
              <s-button-group>
                <s-button disabled>Request adjustment / re-render proof</s-button>
                <s-button disabled>Approve proof and render remaining angles</s-button>
                <s-button disabled>Download outputs</s-button>
                <s-button disabled>Publish to Shopify</s-button>
              </s-button-group>
              <p>Publishing requires a confirmed product match and approval of the current output revision.</p>
            </div>;
          }))}
        </s-section>}
      </>}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
