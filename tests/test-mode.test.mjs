import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modeStorage,assertMode} from '../app/lib/test-mode.ts';
import {validateStorageUrl} from '../app/lib/storage-policy.ts';
const production={origin:'https://uploads.blob.core.windows.net',container:'renderes'};
test('test writes and outputs cannot use production storage or another account',()=>{
 const target=modeStorage(production,true);
 assert.equal(target.container,'renderes-test');
 assert.throws(()=>validateStorageUrl(production.origin+'/renderes/image.png',target));
 assert.throws(()=>validateStorageUrl('https://other.blob.core.windows.net/renderes-test/image.png',target));
 assert.equal(validateStorageUrl(production.origin+'/renderes-test/image.png',target).pathname,'/renderes-test/image.png');
 assert.throws(()=>validateStorageUrl(production.origin+'/renderes-test/image.png',production));
});
test('test upload and verification require matching backend provenance',()=>{
 assertMode({testMode:true,storageDestination:'test'},true);
 assertMode({},false);
 assertMode({testMode:false,storageDestination:'production'},false);
 for(const response of [{},{testMode:true},{testMode:false,storageDestination:'test'},{testMode:true,storageDestination:'production'}])assert.throws(()=>assertMode(response,true));
 assert.throws(()=>assertMode({testMode:true,storageDestination:'test'},false));
});
