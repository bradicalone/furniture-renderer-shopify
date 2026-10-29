import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvManifest,csvUploadFiles} from '../app/lib/csv-submission.ts';
const file=new File(['image'],'angle.jpg',{type:'image/jpeg'});
const item={row:{productName:'Bed',sku:'TARGET',sourceVariantSku:'SOURCE',color:'ALA',fabricFolder:'ALA',instructions:''},variant:{id:'gid://shopify/ProductVariant/2',product:{id:'gid://shopify/Product/1'}},resolved:{sourceVariantSku:'SOURCE',sources:[{sourceId:'saved',sourceVersion:'version',frame:17,relativePath:'cylindo/SOURCE/frame-17.png',url:'must-not-persist'}]},frames:[17,5],firstFrame:5,files:{5:file},bed:false};
const fabrics=[{name:'ALA',files:[{file,relativePath:'review/fabrics/ALA/ref.jpg'}]}];
const settings={background:'white',shadows:true,instructions:''};
test('mixed manifest preserves order and explicit uploaded proof with no signed URLs',()=>{
 const files=csvUploadFiles([item],fabrics);assert.equal(files.length,2);
 const uploads=new Map(files.map((f,i)=>[f.relativePath,`upload-${i}`]));
 const manifest=csvManifest([item],fabrics,uploads,settings);
 assert.deepEqual(manifest.furniture[0].sources.map(s=>s.frame),[17,5]);
 assert.equal(manifest.furniture[0].firstProofSourceId,'upload-0');
 assert.deepEqual(manifest.furniture[0].sources[0],{sourceId:'saved',sourceVersion:'version',frame:17,relativePath:'cylindo/SOURCE/frame-17.png'});
 assert.equal(manifest.combinations[0].target.variantSku,'TARGET');
 assert.equal(manifest.combinations[0].target.colorCode,'ALA');
 assert.equal(JSON.stringify(manifest).includes('must-not-persist'),false);
 assert.throws(()=>csvManifest([item],fabrics,new Map(),settings),/Unverified/);
});
test('missing and duplicate frames cannot create a manifest',()=>{
 assert.throws(()=>csvManifest([{...item,frames:[1],firstFrame:1}],fabrics,new Map(),settings),/Missing frame/);
 assert.throws(()=>csvManifest([{...item,frames:[17,17]}],fabrics,new Map(),settings),/unique frames/);
});
test('saved proof can differ from first displayed angle',()=>{
 const other={...item,firstFrame:17,frames:[5,17]};
 const files=csvUploadFiles([other],fabrics);const manifest=csvManifest([other],fabrics,new Map(files.map((f,i)=>[f.relativePath,`u${i}`])),settings);
 assert.equal(manifest.furniture[0].firstProofSourceId,'saved');
 assert.deepEqual(manifest.furniture[0].sources.map(s=>s.frame),[5,17]);
});
