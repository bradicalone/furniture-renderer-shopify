export type StoragePolicy = {origin:string;container:string};
export function validateStorageUrl(value:string,policy:StoragePolicy):URL {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.origin!==policy.origin||url.username||url.password||url.hash||!url.pathname.startsWith(`/${policy.container}/`))throw new Error('Unexpected storage destination returned by server.');
  const path=decodeURIComponent(url.pathname);
  if(path.includes('\\')||path.split('/').some(segment=>segment==='.'||segment==='..')||!path.startsWith(`/${policy.container}/`))throw new Error('Invalid storage path.');
  return url;
}
