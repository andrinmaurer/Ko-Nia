const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const photoIds=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../docs/art/logbook-photos/manifest.json'),'utf8')).map(x=>x.id);
(async()=>{
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5184/');await page.waitForFunction(()=>window.__konia);
const result=await page.evaluate(async(photoIds)=>{
const {ENTRIES}=await import('/src/discovery/entries.ts');const {LogbookView}=await import('/src/ui/logbookView.ts');const {logbookPhoto}=await import('/src/discovery/photos.ts');const g=window.__konia;
const view=new LogbookView(g.logbook,g.time,()=>{});
for(const e of ENTRIES){g.logbook.recordScan(e.id,'bio',true,{day:1,hour:12},e.category==='locations'?e.id:'loc-shrine-street');}
view.open();const categories={flora:'biology',fungi:'biology',fauna:'biology',locations:'locations',artifacts:'artifacts',origin:'origin'};
for(const e of ENTRIES){
 if(logbookPhoto(e.id,false)!==undefined)throw Error('Undiscovered photo revealed '+e.id);
 view.setTab(categories[e.category]);view.sub=e.category;view.select(e.id);
 const img=document.querySelector('.lb-image img');await img.decode();
 if(!img.src.endsWith('/logbook/'+e.id+'.webp')||img.naturalWidth!==960||img.naturalHeight!==640)throw Error('Invalid photo '+e.id);
}
const liveIds=new Set(ENTRIES.map(x=>x.id));let prepared=0;
for(const id of photoIds.filter(id=>!liveIds.has(id))){
 if(logbookPhoto(id,false)!==undefined)throw Error('Prepared image revealed before discovery '+id);
 const img=new Image();img.src=logbookPhoto(id,true);await img.decode();
 if(img.naturalWidth!==960||img.naturalHeight!==640)throw Error('Invalid prepared photo '+id);prepared++;
}
return {photosDecoded:ENTRIES.length,preparedPhotosDecoded:prepared,allEntryDetailImages:true,categories:Object.keys(categories).length};
},photoIds);if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
