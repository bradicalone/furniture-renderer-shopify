import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderingOperation } from '../app/lib/rendering-gateway.ts';
import { renderingRequest } from '../app/services/rendering-api.server.ts';
import { draftFiles, createManifest } from '../app/lib/bulk-submission.ts';
const id='11111111-1111-4111-8111-111111111111';
test('gateway rejects arbitrary paths and malformed resource identifiers', () => {
  assert.throws(() => renderingOperation({operation:'https://attacker.test'}));
  assert.throws(() => renderingOperation({operation:'detail',jobId:'../../uploads'}));
  assert.equal(renderingOperation({operation:'approve',jobId:id,combinationId:id,body:{revision:2},shop:'evil'}).path,`/jobs/${id}/combinations/${id}/approve`);
  assert.equal(renderingOperation({operation:'list',cursor:id}).path,`/jobs?limit=25&cursor=${id}`);
});
test('server adapter keeps credentials on fixed backend origin and preserves paging', async () => {
  const savedFetch=global.fetch;
  const savedUrl=process.env.RENDERING_API_URL;
  const savedToken=process.env.RENDERING_API_TOKEN;
  process.env.RENDERING_API_URL='https://api.example.com/api/rendering/v1';
  process.env.RENDERING_API_TOKEN='test-only-token';
  try {
    global.fetch=async (url,options) => {
      assert.equal(String(url),`https://api.example.com/api/rendering/v1/jobs?limit=25&cursor=${id}`);
      assert.equal(options.headers['X-Rendering-Shop'],'store.myshopify.com');
      assert.equal(options.headers.Authorization,'Bearer test-only-token');
      assert.equal(options.redirect,'error');
      return Response.json({items:[],nextCursor:null});
    };
    await renderingRequest('store.myshopify.com',`/jobs?limit=25&cursor=${id}`);
    global.fetch=async () => new Response('private provider diagnostics', {status:500});
    await assert.rejects(renderingRequest('store.myshopify.com','/jobs'), error => !error.message.includes('private provider'));
    global.fetch=async () => Response.json({error:{code:'invalid_upload',message:'Decoded image is too large. Reduce its dimensions.'}}, {status:422});
    await assert.rejects(renderingRequest('store.myshopify.com','/jobs'), /Decoded image is too large/);
    global.fetch=async () => Response.json({error:{code:'invalid_upload',message:'secret unexpected diagnostics'}}, {status:422});
    await assert.rejects(renderingRequest('store.myshopify.com','/jobs'), error => !error.message.includes('secret'));
    process.env.RENDERING_API_URL='https://api.example.com/wrong';
    await assert.rejects(renderingRequest('store.myshopify.com','/jobs'), /HTTPS origin/);
  } finally {
    global.fetch=savedFetch;
    if(savedUrl===undefined) delete process.env.RENDERING_API_URL; else process.env.RENDERING_API_URL=savedUrl;
    if(savedToken===undefined) delete process.env.RENDERING_API_TOKEN; else process.env.RENDERING_API_TOKEN=savedToken;
  }
});
test('bulk manifest uses verified IDs, chosen angle, explicit pairs and comparison roles', () => {
  const source=path=>({relativePath:path,file:new File(['x'],path.split('/').at(-1),{type:'image/jpeg'})});
  const draft={manifest:{root:'job', furniture:[{name:'bed',files:[source('job/furniture/bed/front.jpg'),source('job/furniture/bed/side.jpg')]}],fabrics:[{name:'fawn',files:[source('job/fabrics/fawn/ref.jpg')]},{name:'unused',files:[source('job/fabrics/unused/ref.jpg')]}],ignored:[],rejected:[],errors:[]},assignments:{bed:['fawn']},comparisons:{bed:[new File(['x'],'compare.jpg')]},firstProofs:{bed:'job/furniture/bed/side.jpg'},jobInstructions:'batch',furnitureInstructions:{bed:'item'},background:'white',shadows:true,beds:['bed']};
  const files=draftFiles(draft);
  assert.equal(files.length,4);
  assert.equal(files[3].role,'comparison');
  assert.throws(()=>createManifest(draft,new Map()),/not verified/);
  const uploaded=new Map(files.map((file,index)=>[file.relativePath,`upload-${index}`]));
  const result=createManifest(draft,uploaded);
  assert.equal(result.furniture[0].firstProofSourceId,'upload-1');
  assert.deepEqual(result.combinations,[{furnitureId:'bed',fabricId:'fawn'}]);
  assert.equal(result.fabrics.length,1);
  assert.equal(result.furniture[0].options.addBedding,true);
  assert.equal(result.furniture[0].comparisons.length,1);
  assert.equal('shop' in result,false);
  assert.equal('renderingInstructions' in result,false);
});
