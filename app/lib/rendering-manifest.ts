export type ManifestRow = { productName:string; sourceProductCode:string; sku:string; color:string; fabricFolder:string; furnitureFolder:string; instructions:string };
// RFC-style quoted fields, escaped quotes, CRLF and multiline values.
export function parseRenderingManifest(text:string): ManifestRow[] {
  if (text.length > 1024 * 1024) throw new Error('CSV must be under 1 MiB.');
  text=text.replace(/^\uFEFF/,'');
  const records:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false; let closed=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"') {if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}} else cell+=c; continue; }
    if(c==='"' && !cell && !closed){quoted=true;continue;}
    if(c===',' || c==='\n' || c==='\r') {
      row.push(cell.trim());cell='';closed=false;
      if(c!==','){if(row.some(Boolean))records.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;} continue;
    }
    if(closed || c==='"')throw new Error('Invalid CSV quoting.');
    cell+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quote.');
  row.push(cell.trim());if(row.some(Boolean))records.push(row);
  const headers=records.shift()?.map(x=>x.toLowerCase().replace(/[ _-]/g,'')) ?? [];
  if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV columns.');
  for(const h of ['productname','targetvariantsku','colorcode','fabricfolder'])if(!headers.includes(h))throw new Error(`Missing column: ${h}`);
  if(!records.length || records.length>250)throw new Error('Include between 1 and 250 variant rows.');
  const seen=new Set<string>();
  return records.map((r,index)=>{
    if(r.length!==headers.length)throw new Error(`Row ${index+2}: column count does not match header.`);
    const get=(h:string)=>r[headers.indexOf(h)]??'';
    const value={productName:get('productname'),sourceProductCode:get('sourceproductcode'),sku:get('targetvariantsku'),color:get('colorcode'),fabricFolder:get('fabricfolder'),furnitureFolder:get('furniturefolder'),instructions:get('renderinginstructions')};
    if(!value.productName || !value.color || !value.fabricFolder || !/^[A-Za-z0-9._-]{1,120}$/.test(value.sku))throw new Error(`Row ${index+2}: product, exact variant SKU, color and fabric folder are required.`);
    for(const folder of [value.fabricFolder,value.furnitureFolder])if(folder && (/[\\/]/.test(folder)||folder==='.'||folder==='..'))throw new Error(`Row ${index+2}: use a folder name, not a path.`);
    if(value.instructions.length>4000)throw new Error(`Row ${index+2}: instructions exceed 4000 characters.`);
    if(seen.has(value.sku))throw new Error(`Duplicate target SKU: ${value.sku}`);seen.add(value.sku);
    return value;
  });
}
export type AngleLookup = {variant:{id:string;sku:string;title:string;selectedOptions:{name:string;value:string}[]}; images:{frame:number;url:string;expiresAt:string;color:string}[]};
