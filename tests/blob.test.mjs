import {test} from 'node:test';import assert from 'node:assert/strict';import {blobTransaction} from '../lib/store.mjs';import {seed} from '../lib/engine.mjs';
test('private Blob uncached reads and conditional writes preserve competing updates',async()=>{let state=seed(),etag='one',attempts=0;const sdk={get:async(_path,opts)=>{assert.equal(opts.access,'private');assert.equal(opts.useCache,false);return {statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag}};},put:async(_path,body,opts)=>{assert.equal(opts.access,'private');assert.equal(opts.addRandomSuffix,false);attempts++;if(attempts===1){state.stock=7;etag='two';const e=Error('conflict');e.name='BlobPreconditionFailedError';throw e;}assert.equal(opts.ifMatch,'two');state=JSON.parse(body);}};const fn=s=>{s.stock+=2;return s.stock;};fn.mutate=true;assert.equal(await blobTransaction(fn,sdk),9);assert.equal(state.stock,9);assert.equal(attempts,2);});
test('initial Blob creation never overwrites a concurrent creator',async()=>{let state=null,reads=0;const sdk={get:async()=>{reads++;return state?{statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag:'created'}}:null;},put:async(_path,body,opts)=>{if(!state){assert.equal(opts.allowOverwrite,false);state=seed();state.stock=4;const e=Error('already exists');e.name='BlobAlreadyExistsError';throw e;}assert.equal(opts.ifMatch,'created');state=JSON.parse(body);}};const fn=s=>{s.stock++;return s.stock;};fn.mutate=true;assert.equal(await blobTransaction(fn,sdk),5);assert.equal(reads,2);});

test('SDK errors inherit the name Error: retry using exported class identity',async()=>{
 class BlobPreconditionFailedError extends Error {}
 let reads=0,writes=0;const sdk={BlobPreconditionFailedError,get:async()=>({statusCode:200,stream:new Response(JSON.stringify({stock:++reads})).body,blob:{etag:String(reads)}}),put:async()=>{if(++writes===1)throw new BlobPreconditionFailedError('Vercel Blob: Precondition failed: ETag mismatch.');}};
 const fn=s=>s.stock;fn.mutate=true;assert.equal(await blobTransaction(fn,sdk),2);assert.equal(writes,2);
});
test('permission and pathname errors are never retried',async()=>{
 let writes=0;const sdk={get:async()=>({statusCode:200,stream:new Response(JSON.stringify(seed())).body,blob:{etag:'a'}}),put:async()=>{writes++;const error=Error('Access denied');error.name='BlobPathnameMismatchError';throw error;}};
 const fn=s=>s;fn.mutate=true;await assert.rejects(()=>blobTransaction(fn,sdk),/Access denied/);assert.equal(writes,1);
});
