// Run with jsdom installed (or supplied through NODE_PATH). No cloud calls are made.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const root=require('node:path').join(__dirname,'../public/');
const pause=()=>new Promise(r=>setTimeout(r,15));
async function setup(role,record){
 const dom=new JSDOM(fs.readFileSync(root+'index.html','utf8'),{runScripts:'outside-only',url:'https://example.test',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];
 w.firebase={auth:()=>({currentUser:{getIdToken:async()=> 'token'}})};
 w.fetch=async(url,options)=>{calls.push({url,options});const response=url.endsWith('/api/purchases')?{success:true,role,data:[record]}:{success:true,data:record,documents:[],activities:[]};return {ok:true,json:async()=>structuredClone(response)}};
 w.eval(fs.readFileSync(root+'purchase-management-patch.js','utf8'));w.showPurchaseManagement();await pause();
 return {w,d,calls,close:()=>w.close()};
}
const record={id:'sample',reference:'PO-1',project:'Project',item:'Steel',qty:'1 MT',vendor:'Vendor',amount:20000,currency:'INR',priority:'normal',requiredBy:'2026-09-23',specification:'Steel',paymentReference:'',stage:'rfq',approval:{status:'approved'},version:7,updatedAt:'2026-09-22T12:00:00Z'};
(async()=>{
 for(const role of ['coo','director']){
  for(const status of ['draft','pending']){
   const r={...record,approval:{status},pendingChange:{kind:'edit',data:{amount:25000},stage:'quote',note:'Budget revision'}};
   const {d,calls,close}=await setup(role,r);
   assert.ok(d.querySelector('[data-mode="approve"]'));assert.ok(d.querySelector('[data-mode="reject"]'));assert.ok(!d.querySelector('[data-mode="edit"]'));
   d.querySelector('[data-mode="approve"]').click();await pause();
   assert.match(d.getElementById('pmDetail').textContent,/Current.*Proposed/s);assert.match(d.getElementById('pmDetail').textContent,/25000/);
   assert.ok(d.querySelector('#pmForm fieldset').disabled);
   await d.querySelector('[data-action="rejected"]').onclick();assert.match(d.getElementById('pmDecisionStatus').textContent,/reason/);
   d.getElementById('pmDecisionNote').value='Reviewed';await d.querySelector('[data-action="approved"]').onclick();
   const req=calls.find(c=>c.url.endsWith('/decision'));assert.equal(JSON.parse(req.options.body).version,7);assert.equal(JSON.parse(req.options.body).decision,'approved');
   close();
  }
 }
 for(const mode of ['edit','delete','quotation','po','other']){
  const {d,w,calls,close}=await setup('purchase',record);
  for(const action of ['edit','delete','quotation','po','other'])assert.ok(d.querySelector(`[data-mode="${action}"]`));
  assert.ok(!d.querySelector('[data-mode="approve"]'));
  d.querySelector(`[data-mode="${mode}"]`).click();await pause();
  if(mode==='edit'){
   assert.ok(!d.querySelector('#pmForm fieldset').disabled);d.getElementById('pm-amount').value='25000';d.getElementById('pm-note').value='Revised budget';
   const form=d.getElementById('pmForm');await form.onsubmit({preventDefault(){},target:form});
   const req=calls.find(c=>c.options.method==='PUT');assert.equal(JSON.parse(req.options.body).amount,25000);assert.equal(JSON.parse(req.options.body).version,7);
  }else if(mode==='delete'){
   await d.querySelector('[data-action="delete-request"]').onclick();assert.ok(!calls.find(c=>c.url.endsWith('/delete-request')));
   d.getElementById('pmDeleteNote').value='Duplicate';await d.querySelector('[data-action="delete-request"]').onclick();
   assert.equal(JSON.parse(calls.find(c=>c.url.endsWith('/delete-request')).options.body).note,'Duplicate');
  }else{
   const form=d.getElementById('pmUpload');assert.equal(form.elements.type.value,mode);
   Object.defineProperty(form.elements.file,'files',{value:[new w.File(['%PDF-1.7'],'quote.pdf',{type:'application/pdf'})]});
   await form.onsubmit({preventDefault(){}});
   const req=calls.find(c=>c.url.endsWith('/documents'));assert.equal(req.options.body.get('version'),'7');assert.equal(req.options.body.get('type'),mode);
  }
  close();
 }
 const {d,close}=await setup('purchase',{...record,approval:{status:'pending'},pendingChange:{kind:'delete',note:'Duplicate'}});
 for(const mode of ['edit','delete','quotation','po','other'])assert.ok(!d.querySelector(`[data-mode="${mode}"]`));
 d.querySelector('[data-mode="view"]').click();await pause();assert.ok(!d.getElementById('pmUpload'));assert.ok(d.querySelector('[data-action="withdraw"]'));close();
 console.log('Passed: COO/Director legacy draft and pending review, before/after preview, rejection validation, Purchase edit/delete/upload actions and payloads, pending locks.');
})().catch(e=>{console.error(e);process.exit(1)});
