import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateStorageUrl} from '../app/lib/storage-policy.ts';
import {deploymentConfig} from '../app/services/deployment.server.ts';
const storage={origin:'https://testaccount.blob.core.windows.net',container:'renderes-staging'};
test('storage URLs require exact account and container',()=>{
 assert.equal(validateStorageUrl(storage.origin+'/renderes-staging/file.png?sig=test',storage).hostname,'testaccount.blob.core.windows.net');
 for(const url of ['http://testaccount.blob.core.windows.net/renderes-staging/x',storage.origin+'/renderes/x',storage.origin+'/renderes-staging-other/x','https://evil.test/renderes-staging/x',storage.origin+'/renderes-staging/%2e%2e%2frenderes/x'])assert.throws(()=>validateStorageUrl(url,storage));
});
const env={APP_ENV:'staging',RENDERING_STORAGE_ORIGIN:storage.origin,RENDERING_STORAGE_CONTAINER:storage.container,RENDERING_API_URL:'https://staging.example.com',SHOPIFY_APP_URL:'https://staging-app.example.com',DATABASE_URL:'postgresql://user:password@localhost/furniture_renderer_staging',STAGING_ALLOWED_SHOPS:'test.myshopify.com'};
test('production retains storage defaults; staging requires explicit isolated settings',()=>{
 assert.deepEqual(deploymentConfig({}).storage,{origin:'https://uploads.blob.core.windows.net',container:'renderes'});
 assert.equal(deploymentConfig(env).staging,true);
 assert.throws(()=>deploymentConfig({APP_ENV:'staging'}));
 for(const change of [{RENDERING_API_URL:'https://order-api.studiomcgee.com/api/rendering/v1'},{RENDERING_STORAGE_ORIGIN:'https://uploads.blob.core.windows.net',RENDERING_STORAGE_CONTAINER:'renderes'},{DATABASE_URL:'postgresql://user:pass@localhost/furniture_renderer'},{STAGING_ALLOWED_SHOPS:''}])assert.throws(()=>deploymentConfig({...env,...change}));
});
