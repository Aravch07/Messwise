import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLiveSync} from '../public/live-sync.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('polls do not overlap and a late old read cannot undo an action',async()=>{
 const old=deferred();let reads=0;const seen=[];
 const sync=createLiveSync({read:()=>{reads++;return old.promise;},write:async()=>({tickets:[],version:2}),onState:s=>seen.push(s.version)});
 const first=sync.refresh();const second=sync.refresh();assert.equal(reads,1);
 await sync.mutate('join');assert.deepEqual(seen,[2]);
 old.resolve({tickets:[],version:1});await Promise.all([first,second]);assert.deepEqual(seen,[2]);
 await sync.refresh();assert.equal(reads,1,'successful writes need no immediate duplicate GET');
});
test('errors do not wedge future refreshes',async()=>{
 let calls=0,errors=0,applied=0;const sync=createLiveSync({read:async()=>{if(++calls===1)throw Error('offline');return {tickets:[]};},write:async()=>({}),onState:()=>applied++,onError:()=>errors++});
 await sync.refresh();await sync.refresh();assert.equal(errors,1);assert.equal(applied,1);
});
