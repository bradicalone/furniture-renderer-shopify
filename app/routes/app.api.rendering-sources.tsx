import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
export async function action({request}:ActionFunctionArgs) {
  const {admin}=await authenticate.admin(request);
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return json({error:{message:'POST required.'}},405);
  try {
    const raw=await request.text();if(raw.length>2048)throw new Error('Request too large.');
    const {sku}=JSON.parse(raw);
    if(typeof sku!=='string'|| !/^[A-Za-z0-9._-]{1,120}$/.test(sku))throw new Error('Invalid SKU.');
    const result=await admin.graphql(`#graphql
      query RenderingVariant($query: String!) {
        productVariants(first: 100, query: $query) {
          nodes { id sku title selectedOptions { name value } }
          pageInfo { hasNextPage }
        }
      }`,{variables:{query:`sku:"${sku}"`}});
    const data=await result.json() as {errors?:unknown;data?:{productVariants:{nodes:{id:string;sku:string;title:string;selectedOptions:{name:string;value:string}[]}[];pageInfo:{hasNextPage:boolean}}}};
    if(data.errors || !data.data?.productVariants) return json({error:{message:'Shopify variant lookup failed. Retry lookup.'}},502);
    const connection=data.data.productVariants;
    const variants=connection.nodes.filter((v:{sku:string})=>v.sku===sku);
    if(variants.length!==1 || connection.pageInfo.hasNextPage)return json({error:{message:'SKU must match exactly one Shopify variant in this store.'}},422);
    const base=new URL(process.env.RENDERING_API_URL ?? '');
    if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!['/','/api/rendering/v1','/api/rendering/v1/'].includes(base.pathname))throw new Error('Invalid rendering service configuration.');
    base.pathname=`/api/cylindo-images/${encodeURIComponent(sku)}`;
    // This existing read-only endpoint is separate from the service-token rendering API.
    // Do not send rendering credentials to a different endpoint.
    const response=await fetch(base,{redirect:'error',signal:AbortSignal.timeout(20000)});
    if(response.status===404)return json({variant:variants[0],images:[]});
    if(!response.ok)return json({error:{message:'Saved-image lookup unavailable. Retry lookup; this is not a missing-angle result.'}},502);
    const body=await response.json();
    if(body.variantSku!==sku || !Array.isArray(body.images))throw new Error('Invalid saved-image response.');
    const images=body.images.map((item:{frame:number;url:string;expiresAt:string;color:string})=>{
      const url=new URL(item.url);
      if(!Number.isInteger(item.frame)||item.frame<1||item.frame>32||url.protocol!=='https:'||url.hostname!=='uploads.blob.core.windows.net'||!url.pathname.startsWith('/renderes/cylindo/'))throw new Error('Invalid saved-image response.');
      return {frame:item.frame,url:item.url,expiresAt:item.expiresAt,color:item.color};
    });
    return json({variant:variants[0],images});
  } catch {return json({error:{message:'Unable to look up this SKU. Check service configuration and retry.'}},502);}
}
