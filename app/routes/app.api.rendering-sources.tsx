import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
export async function action({request}:ActionFunctionArgs) {
  const {admin}=await authenticate.admin(request);
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return json({error:{message:'POST required.'}},405);
  try {
    const raw=await request.text();if(raw.length>2048)throw new Error('Request too large.');
    const {sku}=JSON.parse(raw);
    if(typeof sku!=='string'|| !/^[A-Za-z0-9_-]{1,200}$/.test(sku))throw new Error('Invalid SKU.');
    const result=await admin.graphql(`#graphql
      query RenderingVariant($query: String!) {
        productVariants(first: 100, query: $query) {
          nodes { id sku title product { id } selectedOptions { name value } }
          pageInfo { hasNextPage }
        }
      }`,{variables:{query:`sku:"${sku}"`}});
    const data=await result.json() as {errors?:unknown;data?:{productVariants:{nodes:{id:string;sku:string;title:string;product:{id:string};selectedOptions:{name:string;value:string}[]}[];pageInfo:{hasNextPage:boolean}}}};
    if(data.errors || !data.data?.productVariants) return json({error:{message:'Shopify variant lookup failed. Retry lookup.'}},502);
    const connection=data.data.productVariants;
    const variants=connection.nodes.filter((v:{sku:string})=>v.sku===sku);
    if(variants.length!==1 || connection.pageInfo.hasNextPage)return json({error:{message:'SKU must match exactly one Shopify variant in this store.'}},422);
    return json({variant:variants[0]});
  } catch {return json({error:{message:'Unable to look up this SKU. Check service configuration and retry.'}},502);}
}
