import type {ManifestRow,AngleLookup} from './rendering-manifest';
import type {ResolveSourcesResponse,CreateRequest} from './rendering-types';
import type {UploadSource} from './bulk-submission';
import type {FolderGroup} from './bulk-folders';
export type ReviewedVariant = {row:ManifestRow;variant:AngleLookup['variant'];resolved:ResolveSourcesResponse;frames:number[];firstFrame:number;files:Record<number,File>;bed:boolean};
export function csvUploadFiles(items:ReviewedVariant[],fabrics:FolderGroup[]):UploadSource[]{
  const used=new Set(items.map(i=>i.row.fabricFolder));
  return [...items.flatMap((item,index)=>item.frames.filter(f=>item.files[f]).map(frame=>({file:item.files[frame],relativePath:`csv/furniture/item-${index}/frame-${frame}.${item.files[frame].name.split('.').at(-1)!.toLowerCase()}`,role:'furniture' as const}))),
    ...fabrics.filter(f=>used.has(f.name)).flatMap(f=>f.files.map(file=>({...file,role:'fabric' as const})))];
}
export function csvManifest(items:ReviewedVariant[],fabrics:FolderGroup[],uploads:Map<string,string>,settings:{background:'white'|'transparent';shadows:boolean;instructions:string}):CreateRequest{
  const files=csvUploadFiles(items,fabrics);
  const ref=(path:string)=>{const uploadId=uploads.get(path);if(!uploadId)throw new Error(`Unverified file: ${path}`);return {uploadId,relativePath:path};};
  const colors=new Map<string,string>();
  const furniture:CreateRequest['furniture']=[];const combinations:CreateRequest['combinations']=[];
  const groups=new Map<string,string>();
  items.forEach((item,index)=>{
    if(colors.has(item.row.fabricFolder)&&colors.get(item.row.fabricFolder)!==item.row.color)throw new Error('A fabric folder must map to one color code.');
    colors.set(item.row.fabricFolder,item.row.color);
    if(!item.frames.length||new Set(item.frames).size!==item.frames.length||!item.frames.includes(item.firstFrame))throw new Error('Select unique frames and an included first proof.');
    const sources=item.frames.map(frame=>{
      if(item.files[frame]){const file=files.find(f=>f.relativePath.startsWith(`csv/furniture/item-${index}/frame-${frame}.`))!;return {...ref(file.relativePath),frame};}
      const source=item.resolved.sources.find(s=>s.frame===frame);if(!source)throw new Error(`Missing frame ${frame}`);
      return {sourceId:source.sourceId,sourceVersion:source.sourceVersion,frame,relativePath:source.relativePath};
    });
    const proof=sources[item.frames.indexOf(item.firstFrame)];
    const firstProofSourceId='sourceId' in proof?proof.sourceId!:proof.uploadId!;
    const options={background:settings.background,addContactShadow:settings.shadows,addBedding:item.bed};
    const signature=JSON.stringify({sources,firstProofSourceId,options,instructions:item.row.instructions,sku:item.resolved.sourceVariantSku});
    let id=groups.get(signature);
    if(!id){id=`item-${index}`;groups.set(signature,id);furniture.push({id,name:item.row.productName,folder:`csv/furniture/${id}`,sourceVariantSku:item.resolved.sourceVariantSku,sources,firstProofSourceId,comparisons:[],furnitureInstructions:item.row.instructions,options});}
    combinations.push({furnitureId:id,fabricId:item.row.fabricFolder,target:{variantSku:item.row.sku,variantId:item.variant.id,productId:item.variant.product.id,colorCode:item.row.color}});
  });
  return {name:'CSV furniture batch',jobInstructions:settings.instructions,furniture,combinations,fabrics:fabrics.filter(f=>colors.has(f.name)).map(f=>({id:f.name,name:f.name,folder:`review/fabrics/${f.name}`,references:f.files.map(file=>ref(file.relativePath))}))};
}
