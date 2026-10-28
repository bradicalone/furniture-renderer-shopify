import {useEffect,useState} from 'react';
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
function VariantReview({row,fabrics}:{row:ManifestRow;fabrics:FolderGroup[]}) {
  const [result,setResult]=useState<AngleLookup>();
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [frames,setFrames]=useState([1,3,5,9,17]);
  const [files,setFiles]=useState<Record<number,File>>({});
  const [confirmed,setConfirmed]=useState(false);
  const fabric=fabrics.find(f=>f.name===row.fabricFolder);
  async function lookup(){setBusy(true);setError('');setConfirmed(false);setResult(undefined);
    try{setResult(await renderingCall<AngleLookup>({sku:row.sku},undefined,'/app/api/rendering-sources'));}
    catch(e){setError(e instanceof Error?e.message:'Lookup failed.');}finally{setBusy(false);}}
  const ready=!!result&&!!fabric?.files.length&&frames.length>0&&frames.every(frame=>files[frame]||result.images.some(i=>i.frame===frame));
  return <article className={styles.jobCard}>
    <h3>{row.productName} — {row.sku}</h3>
    <p>Color code: {row.color} · Fabric folder: {row.fabricFolder} · {fabric ? `${fabric.files.length} reference photos` : 'Fabric folder missing'}</p>
    {row.sourceProductCode && <p>Source product code (for review): {row.sourceProductCode}. Lookup uses the complete target variant SKU.</p>}
    {row.instructions && <p>Instructions: {row.instructions}</p>}
    <button disabled={busy} onClick={lookup}>{busy?'Looking up…':'Look up / refresh saved angles'}</button>
    {error&&<p role="alert">{error}</p>}
    {result&&<>
      <p>Shopify variant: {result.variant.title} · {result.variant.selectedOptions.map(o=>`${o.name}: ${o.value}`).join(' · ')}</p>
      <p>Confirm the color code against these Shopify options and your fabric photos. Codes are not inferred from SKU segments.</p>
      <fieldset><legend>Requested frames — select only the angles you need</legend>
        <div className={styles.jobCardHeader}>{Array.from({length:32},(_,i)=>i+1).map(frame=><label key={frame}><input type="checkbox" checked={frames.includes(frame)} onChange={e=>{setConfirmed(false);setFrames(v=>e.target.checked?[...v,frame].sort((a,b)=>a-b):v.filter(f=>f!==frame));}}/> {frame}{frame===1?' (Front)':frame===17?' (Back)':''}</label>)}</div>
      </fieldset>
      <div className={styles.uploadGrid}>{frames.map(frame=>{
        const saved=result.images.find(i=>i.frame===frame);
        return <div className={styles.uploadCard} key={frame}><strong>Frame {frame} — {files[frame]?'Local replacement':saved?'Found':'Missing'}</strong>
          {files[frame]?<LocalPreview file={files[frame]}/>:saved?<><img src={saved.url} referrerPolicy="no-referrer" alt={`Saved frame ${frame} for ${row.sku}`} style={{maxWidth:200,maxHeight:200}}/><span>Preview links expire; use refresh above if unavailable. Stored color: {saved.color}</span></>:<span>Upload this requested angle.</span>}
          <label>{saved?'Replace angle (optional)':'Upload missing angle'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{
            const file=e.target.files?.[0];e.target.value='';if(!file)return;
            if(!/\.(jpe?g|png|webp)$/i.test(file.name)||!['','image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>20*1024*1024){setError('Choose a JPEG, PNG or WebP between 1 byte and 20 MiB.');return;}
            setError('');setConfirmed(false);setFiles(v=>({...v,[frame]:file}));
          }}/></label>
          {files[frame]&&<button onClick={()=>{setConfirmed(false);setFiles(v=>{const next={...v};delete next[frame];return next;});}}>Remove local image</button>}
        </div>;
      })}</div>
    </>}
    {fabric&&<details><summary>Review fabric reference photos</summary>{fabric.files.map(source=><LocalPreview key={source.relativePath} file={source.file}/>)}</details>}
    <label><input type="checkbox" disabled={!ready} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm the target variant, fabric/color and selected source angles match.</label>
    {confirmed&&<p role="status">Review confirmed locally. CSV submission is waiting for backend saved-source support; nothing has been uploaded or rendered.</p>}
  </article>;
}
export function ManifestReview(){
  const [rows,setRows]=useState<ManifestRow[]>([]);const [error,setError]=useState('');
  const [fabrics,setFabrics]=useState<FolderGroup[]>([]);const [version,setVersion]=useState(0);
  return <s-section heading="CSV variant review">
    <p>Review a rendering-manifest.csv with one row per target variant. This review does not upload files or create rendering jobs. Use the original folder workflow for submissions until saved-source job support is connected.</p>
    <p>Required columns: Product Name, Target Variant SKU, Color Code, Fabric Folder. Optional: Source Product Code, Furniture Folder, Rendering Instructions. Any CSV filename is accepted.</p>
    <label>Choose manifest CSV<input type="file" accept=".csv,text/csv" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;setRows([]);setError('');
      try{if(file.size>1024*1024)throw new Error('CSV must be under 1 MiB.');setRows(parseRenderingManifest(await file.text()));setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Invalid CSV.');}
    }}/></label>
    <label>Choose the fabrics folder (containing ALA, BSQ, etc.)<input type="file" multiple ref={e=>e?.setAttribute('webkitdirectory','')} onChange={e=>{
      const files=Array.from(e.target.files??[]);e.target.value='';setFabrics([]);setVersion(v=>v+1);setError('');
      const parsed=parseFolder(files.map(file=>({file,relativePath:`review/fabrics/${file.webkitRelativePath.split('/').slice(1).join('/')}`})));
      if(parsed.rejected.length){setError(parsed.rejected.map(r=>`${r.path}: ${r.reason}`).join('; '));return;}
      if(!parsed.fabrics.length){setError('Choose a folder containing fabric-code subfolders and reference images.');return;}setFabrics(parsed.fabrics);
    }}/></label>
    {error&&<p role="alert">{error}</p>}
    <div className={styles.jobList}>{rows.map(row=><VariantReview key={`${version}:${row.sku}`} row={row} fabrics={fabrics}/>)}</div>
  </s-section>;
}
