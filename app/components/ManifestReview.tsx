import {BulkSubmission} from './BulkSubmission';
import {csvManifest,csvUploadFiles} from '../lib/csv-submission';
import type {ReviewedVariant} from '../lib/csv-submission';
import type {ResolveSourcesResponse,SourceDownloadResponse} from '../lib/rendering-types';
import {useCallback,useEffect,useRef,useState} from 'react';
import {parseRenderingManifest} from '../lib/rendering-manifest';
import type {ManifestRow,AngleLookup} from '../lib/rendering-manifest';
import {renderingCall} from '../lib/rendering-client';
import {parseFolder} from '../lib/bulk-folders';
import type {FolderGroup} from '../lib/bulk-folders';
import styles from '../styles/render-workspace.module.css';
function LocalPreview({file}:{file:File}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(file);const timer=setTimeout(()=>setUrl(next),0);return()=>{clearTimeout(timer);URL.revokeObjectURL(next);};},[file]);
  return <img src={url || undefined} alt={file.name} style={{maxWidth:200,maxHeight:200}}/>;
}
function SavedPreview({sourceId}:{sourceId:string}) {
  const [url,setUrl]=useState('');const [error,setError]=useState('');
  const refresh=useCallback(async ()=>{try{const value=await renderingCall<SourceDownloadResponse>({operation:'savedSource',sourceId});const u=new URL(value.url);if(u.protocol!=='https:'||u.hostname!=='uploads.blob.core.windows.net'||!u.pathname.startsWith('/renderes/'))throw new Error('Invalid preview destination.');setUrl(value.url);setError('');}catch(e){setError(e instanceof Error?e.message:'Preview unavailable.');}},[sourceId]);
  useEffect(()=>{const t=setTimeout(()=>void refresh(),0);return()=>clearTimeout(t);},[refresh]); // Preview URLs live only in component state.
  return <>{url&&<img src={url} referrerPolicy="no-referrer" alt="Resolved furniture source" style={{maxWidth:200,maxHeight:200}} onError={()=>setError('Preview expired. Refresh the link.')}/>}<button onClick={refresh}>Refresh source preview</button>{error&&<p role="alert">{error}</p>}</>;
}
function VariantReview({row,fabrics,onReview}:{row:ManifestRow;fabrics:FolderGroup[];onReview:(sku:string,value:ReviewedVariant|null)=>void}) {
  const [result,setResult]=useState<AngleLookup>();
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [frames,setFrames]=useState([1,3,5,9,17]);
  const [files,setFiles]=useState<Record<number,File>>({});
  const [confirmed,setConfirmed]=useState(false);
  const [resolved,setResolved]=useState<ResolveSourcesResponse>();
  const [firstFrame,setFirstFrame]=useState(1);const [bed,setBed]=useState(false);
  const resolver=useRef<{body:string;key:string}|null>(null);
  function invalidate(){setConfirmed(false);onReview(row.sku,null);}
  const fabric=fabrics.find(f=>f.name===row.fabricFolder);
  async function lookup(fresh=false){if(busy)return;setBusy(true);setError('');invalidate();setResult(undefined);setResolved(undefined);
    const body={sourceVariantSku:row.sourceVariantSku||row.sku,frames};const signature=JSON.stringify(body);
    if(fresh||resolver.current?.body!==signature)resolver.current={body:signature,key:crypto.randomUUID()};
    try{
      const match=await renderingCall<AngleLookup>({sku:row.sku},undefined,'/app/api/rendering-sources');
      const source=await renderingCall<ResolveSourcesResponse>({operation:'resolveSources',key:resolver.current!.key,body});
      setResult(match);setResolved(source);
    }catch(e){setError(e instanceof Error?e.message:'Lookup failed.');}finally{setBusy(false);}}
  const ready=!!result&&!!resolved&&!!fabric?.files.length&&frames.length>0&&frames.includes(firstFrame)&&frames.every(frame=>files[frame]||resolved.sources.some(i=>i.frame===frame));
  return <article className={styles.jobCard}>
    <h3>{row.productName} — {row.sku}</h3>
    <p>Color code: {row.color} · Fabric folder: {row.fabricFolder} · {fabric ? `${fabric.files.length} reference photos` : 'Fabric folder missing'}</p>
    {row.sourceProductCode && <p>Source product code (for review): {row.sourceProductCode}. Lookup uses the complete target variant SKU.</p>}
    {row.instructions && <p>Instructions: {row.instructions}</p>}
    <button disabled={busy} onClick={()=>lookup()}>{busy?'Looking up…':'Resolve / retry selected angles'}</button><button disabled={busy} onClick={()=>lookup(true)}>Resolve fresh versions after catalog changes</button>
    {error&&<p role="alert">{error}</p>}
    <fieldset disabled={busy}><legend>Frame order and first proof</legend>
      <label>Frame order (comma-separated)<input defaultValue="1,3,5,9,17" onBlur={e=>{const next=e.target.value.split(',').map(v=>Number(v.trim()));invalidate();setResolved(undefined);if(!next.length||next.length>32||next.some(f=>!Number.isInteger(f)||f<1||f>32)||new Set(next).size!==next.length){setFrames([]);setError('Enter unique frame numbers 1–32.');return;}setFrames(next);if(!next.includes(firstFrame))setFirstFrame(next[0]);setError('');}}/></label>
      <label>First proof<select value={firstFrame} onChange={e=>{invalidate();setFirstFrame(Number(e.target.value));}}>{frames.map(f=><option key={f} value={f}>Frame {f}</option>)}</select></label>
      <label><input type="checkbox" checked={bed} onChange={e=>{invalidate();setBed(e.target.checked);}}/> This is a bed: add mattress, white sheets and pillows</label>
    </fieldset>
    {result&&resolved&&<>
      <p>Shopify variant: {result.variant.title} · {result.variant.selectedOptions.map(o=>`${o.name}: ${o.value}`).join(' · ')}</p>
      <p>Confirm the color code against these Shopify options and your fabric photos. Codes are not inferred from SKU segments.</p>
      <div className={styles.uploadGrid}>{frames.map(frame=>{
        const saved=resolved.sources.find(i=>i.frame===frame);
        return <div className={styles.uploadCard} key={frame}><strong>Frame {frame} — {files[frame]?'Local replacement':saved?'Found':'Missing'}</strong>
          {files[frame]?<LocalPreview file={files[frame]}/>:saved?<SavedPreview sourceId={saved.sourceId}/>:<span>Upload this requested angle.</span>}
          <label>{saved?'Replace angle (optional)':'Upload missing angle'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
            const file=e.target.files?.[0];e.target.value='';if(!file)return;
            if(!/\.(jpe?g|png|webp)$/i.test(file.name)||!['','image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>20*1024*1024){setError('Choose a JPEG, PNG or WebP between 1 byte and 20 MiB.');return;}
            setError('');invalidate();setFiles(v=>({...v,[frame]:file}));
          }}/></label>
          {files[frame]&&<button onClick={()=>{invalidate();setFiles(v=>{const next={...v};delete next[frame];return next;});}}>Remove local image</button>}
        </div>;
      })}</div>
    </>}
    {fabric&&<details><summary>Review fabric reference photos</summary>{fabric.files.map(source=><LocalPreview key={source.relativePath} file={source.file}/>)}</details>}
    <label><input type="checkbox" disabled={!ready} checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);onReview(row.sku,e.target.checked&&result&&resolved?{row,variant:result.variant,resolved,frames:[...frames],firstFrame,files:{...files},bed}:null);}}/> I confirm the target variant, fabric/color and selected source angles match.</label>
    {confirmed&&<p role="status">Review confirmed. No uploads or rendering have started.</p>}
  </article>;
}
export function ManifestReview({enabled=false}:{enabled?:boolean}){
  const [reviews,setReviews]=useState<Record<string,ReviewedVariant>>({});
  const [csvName,setCsvName]=useState('');
  const [locked,setLocked]=useState(false);
  const [background,setBackground]=useState<'white'|'transparent'>('white');const [shadows,setShadows]=useState(true);const [instructions,setInstructions]=useState('');
  const onReview=(sku:string,value:ReviewedVariant|null)=>setReviews(v=>{const next={...v};if(value)next[sku]=value;else delete next[sku];return next;});
  const [rows,setRows]=useState<ManifestRow[]>([]);const [error,setError]=useState('');
  const [fabrics,setFabrics]=useState<FolderGroup[]>([]);const [version,setVersion]=useState(0);
  return <s-section heading="CSV variant review">
    <p>Choose your variant spreadsheet and fabric photos, then review the matches below. Files stay on your device until you confirm and start uploading.</p>
    {!enabled&&<p role="status">CSV submission is not enabled for this deployment yet. You can prepare and review your files.</p>}
    <fieldset disabled={locked} className={styles.manifestFieldset}><legend>1. Select your files</legend>
    <div className={styles.uploadGrid}>
    <div className={styles.uploadCard}>
      <h3>Variant spreadsheet</h3>
      <p>One row per product variant and color. Choose a CSV exported from Excel or Numbers.</p>
      <p className={styles.fileSummary} role="status">{csvName ? `${csvName} · ${rows.length} variants` : 'No spreadsheet selected'}</p>
    <label className={styles.filePicker}>Choose CSV<input type="file" accept=".csv,text/csv" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;setCsvName('');setReviews({});setRows([]);setError('');
      try{if(file.size>1024*1024)throw new Error('CSV must be under 1 MiB.');setRows(parseRenderingManifest(await file.text()));setCsvName(file.name);setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Invalid CSV.');}
    }}/></label>
    <details><summary>Spreadsheet column guide</summary>
      <div className={styles.columnGuide}><table><thead><tr><th scope="col">Required column</th><th scope="col">Example</th></tr></thead><tbody>
        <tr><td>Product Name</td><td>Mabel King Bed</td></tr>
        <tr><td>Target Variant SKU</td><td>MFRN3456-ALA-K</td></tr>
        <tr><td>Color Code</td><td>ALA</td></tr>
        <tr><td>Fabric Folder</td><td>ALA</td></tr>
      </tbody></table></div>
      <p>Optional: Source Variant SKU (defaults to target SKU), Source Product Code, Furniture Folder, Rendering Instructions. Any CSV filename is accepted.</p>
    </details>
    </div>
    <div className={styles.uploadCard}>
      <h3>Fabric reference photos</h3>
      <p>Choose the fabrics folder containing one subfolder per material/color. Match each subfolder name to the spreadsheet’s Fabric Folder value.</p>
      <pre className={styles.folderExample}>{`fabrics/
├── ALA/reference-01.jpg
└── BSQ/reference-01.jpg`}</pre>
      <p className={styles.fileSummary} role="status">{fabrics.length ? `${fabrics.length} fabric folders · ${fabrics.reduce((count,f)=>count+f.files.length,0)} reference photos` : 'No fabric folder selected'}</p>
    <label className={styles.filePicker}>Choose fabrics folder<input type="file" multiple ref={e=>e?.setAttribute('webkitdirectory','')} onChange={e=>{
      const files=Array.from(e.target.files??[]);e.target.value='';setReviews({});setFabrics([]);setVersion(v=>v+1);setError('');
      const parsed=parseFolder(files.map(file=>({file,relativePath:`review/fabrics/${file.webkitRelativePath.split('/').slice(1).join('/')}`})));
      if(parsed.rejected.length){setError(parsed.rejected.map(r=>`${r.path}: ${r.reason}`).join('; '));return;}
      if(!parsed.fabrics.length){setError('Choose a folder containing fabric-code subfolders and reference images.');return;}setFabrics(parsed.fabrics);
    }}/></label>
    </div>
    </div>
    {error&&<p role="alert" className={styles.requestError}>{error}</p>}
    <div className={styles.uploadCard}>
      <h3>2. Batch rendering settings</h3>
      <label>Background <select value={background} onChange={e=>setBackground(e.target.value as 'white'|'transparent')}><option value="white">White</option><option value="transparent">Transparent</option></select></label>
      <label><input type="checkbox" checked={shadows} onChange={e=>setShadows(e.target.checked)}/> Realistic contact shadows</label>
      <label>Batch instructions (optional)<textarea className={styles.instructions} rows={3} maxLength={4000} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
    </div>
    {!!rows.length&&<h3>3. Review variants and source angles</h3>}
    <div className={styles.jobList}>{rows.map(row=><VariantReview key={`${version}:${row.sku}`} row={row} fabrics={fabrics} onReview={onReview}/>)}</div>
    </fieldset>
    {!locked&&<button disabled={!enabled||!rows.length||rows.some(r=>!reviews[r.sku])} onClick={()=>setLocked(true)}>Confirm batch and continue to uploads</button>}
    {locked&&<BulkSubmission files={csvUploadFiles(rows.map(r=>reviews[r.sku]),fabrics)} buildManifest={uploads=>csvManifest(rows.map(r=>reviews[r.sku]),fabrics,uploads,{background,shadows,instructions})}/>}
  </s-section>;
}
