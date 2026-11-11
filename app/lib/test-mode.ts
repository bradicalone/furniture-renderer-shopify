import type {StoragePolicy} from './storage-policy';
export function modeStorage(base:StoragePolicy,testMode:boolean):StoragePolicy {
  return testMode?{origin:base.origin,container:'renderes-test'}:base;
}
export function assertMode(response:{testMode?:boolean;storageDestination?:string},testMode:boolean){
  // Legacy production replies may omit both fields. Never accept missing test provenance.
  if(testMode ? response.testMode!==true||response.storageDestination!=='test' : response.testMode===true||(response.storageDestination!==undefined&&response.storageDestination!=='production'))throw new Error('Storage mode mismatch. Stop and check backend configuration.');
}
