import type {StoragePolicy} from '../lib/storage-policy';
export function deploymentConfig(env:Record<string,string|undefined>=process.env):{staging:boolean;storage:StoragePolicy} {
  if(env.APP_ENV && !['production','staging','development'].includes(env.APP_ENV))throw new Error('APP_ENV must be production, staging or development.');
  const staging=env.APP_ENV==='staging';
  if(staging&&(!env.RENDERING_STORAGE_ORIGIN||!env.RENDERING_STORAGE_CONTAINER))throw new Error('Staging requires an explicit storage origin and container.');
  const origin=env.RENDERING_STORAGE_ORIGIN||'https://uploads.blob.core.windows.net';
  const container=env.RENDERING_STORAGE_CONTAINER||'renderes';
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname.endsWith('.blob.core.windows.net')||url.port)throw new Error('Configure an HTTPS Azure Blob account origin.');
  if(!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(container)||container.includes('--'))throw new Error('Invalid Azure container name.');
  if(staging){
    if(url.origin==='https://uploads.blob.core.windows.net'&&container==='renderes')throw new Error('Staging cannot use production image storage.');
    const api=new URL(env.RENDERING_API_URL||'');
    if(api.hostname==='order-api.studiomcgee.com')throw new Error('Staging cannot use the production rendering API.');
    const app=new URL(env.SHOPIFY_APP_URL||'');
    if(app.hostname==='renderer-app-eu9fw.ondigitalocean.app')throw new Error('Staging cannot use the production app URL.');
    if(env.SHOPIFY_API_KEY==='26e27f9b11b515bf3263c44b8086b253')throw new Error('Staging requires separate Shopify app credentials.');
    const db=new URL(env.DATABASE_URL||'');
    if(decodeURIComponent(db.pathname)==='/furniture_renderer')throw new Error('Staging requires a separate session database.');
    if(!env.STAGING_ALLOWED_SHOPS)throw new Error('Staging requires STAGING_ALLOWED_SHOPS.');
  }
  return {staging,storage:{origin:url.origin,container}};
}
export function assertDeploymentShop(shop:string){
  const {staging}=deploymentConfig();
  if(staging&&!process.env.STAGING_ALLOWED_SHOPS!.split(',').map(s=>s.trim()).includes(shop))throw new Response('This store is not enabled for staging.',{status:403});
}
