import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderingCall} from '../app/lib/rendering-client.ts';

test('rendering client authenticates and distinguishes failed response types', async () => {
  const savedWindow=global.window, savedFetch=global.fetch;
  let tokens=0;
  global.window={shopify:{idToken:async()=>{tokens++; return 'test-session-token';}}};
  try {
    global.fetch=async(path,options)=>{
      assert.equal(path,'/app/api/rendering');
      assert.equal(options.headers.Authorization,'Bearer test-session-token');
      assert.equal(options.headers.Accept,'application/json');
      assert.deepEqual(JSON.parse(options.body),{operation:'list'});
      return Response.json({items:[]});
    };
    assert.deepEqual(await renderingCall({operation:'list'}),{items:[]});
    global.fetch=async()=>new Response('<html>private diagnostics</html>',{status:404,headers:{'Content-Type':'text/html'}});
    await assert.rejects(renderingCall({operation:'list'}),e=>e.message.includes('HTTP 404') && !e.message.includes('private diagnostics'));
    global.fetch=async()=>new Response(null,{status:401});
    await assert.rejects(renderingCall({operation:'list'}),/authentication.*rejected/);
    global.fetch=async()=>Response.json({error:{message:'Shop not allowlisted'}},{status:403});
    await assert.rejects(renderingCall({operation:'list'}),/Shop not allowlisted/);
    assert.equal(tokens,4);
    global.window={};
    await assert.rejects(renderingCall({operation:'list'}),/authentication is not ready/);
  } finally {global.fetch=savedFetch; if(savedWindow===undefined) delete global.window; else global.window=savedWindow;}
});
