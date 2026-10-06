'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const noop={addListener(){}};
const context=vm.createContext({chrome:{runtime:{onMessage:noop,onInstalled:noop,onStartup:noop},action:{onClicked:noop},tabs:{onRemoved:noop,onUpdated:noop},storage:{local:{set:()=>new Promise(()=>{}),get:async()=>({})}}}});
vm.runInContext(fs.readFileSync(require.resolve('./background.js'),'utf8'),context);
vm.runInContext(`
 let complete=true, boardReady=true, count=8, writes=0, startingCount=8;
 getBoundLiveTab=async()=>({id:7});
 tabStatus=async()=>({connected:true,assignedFound:true,assignedCount:count});
 syncLedgerContext=async()=>({ledgerSavedAt:'round-a',baselineAssignedCount:startingCount});
 preflight=async()=>({ready:true});
 finishReconciledScan=async()=>{};
 appJson=async(path)=>{
   if(path==='/api/health') return {connector:{boardReady,activeAssignments:0}};
   if(path==='/api/connector/reconcile') {writes++;return {deliveredCount:1};}
 };
 chrome.storage.local.set=async()=>{};
 chrome.tabs.sendMessage=async(_id,m)=> m.type==='breaksuite:scan-now'
   ? {scanComplete:complete,ledgerSavedAt:'round-a',assignedCount:count,allCandidates:[{number:1,buyer:'alice'}]}
   : {ok:true};
`,context);
(async()=>{
 const ready=await vm.runInContext('showAction(false)',context);
 assert.equal(ready.data.prepared,true);
 assert.equal(vm.runInContext('writes',context),1);
 vm.runInContext('complete=false',context);
 await assert.rejects(vm.runInContext('showAction(true)',context),/full list/);
 assert.equal(vm.runInContext('writes',context),1,'Incomplete recovery cannot change assignments');
 vm.runInContext('complete=true;count=9',context);
 await assert.rejects(vm.runInContext('showAction(false)',context),/Sales already/);
 await vm.runInContext('showAction(true)',context);
 assert.equal(vm.runInContext('startingCount',context),8,'Recovery preserves the initial round boundary');
 vm.runInContext('boardReady=false',context);
 await assert.rejects(vm.runInContext('showAction(false)',context),/Save your Break Board/);
 console.log('Prepare Show readiness, incomplete recovery, late startup and preserved recovery boundary checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
