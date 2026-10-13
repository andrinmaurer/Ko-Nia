const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5186/');await page.waitForFunction(()=>window.__konia);await page.evaluate(()=>window.__konia.scene.getEngine().stopRenderLoop());
 const assert=(x,m)=>{if(!x)throw Error(m)};
 const images=await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('.start-backdrops img')];await Promise.all(imgs.map(x=>x.decode()));return imgs.map(x=>[x.naturalWidth,x.naturalHeight]);});assert(images.length===5&&images.every(x=>x[0]>1500),'Five full-size backdrops');
 const rotation=await page.evaluate(()=>{const g=window.__konia,c=g.titleBackdrops;const result=[];for(let i=0;i<5;i++){for(let n=0;n<20;n++)c.update(1,true);result.push(c.index)}const before=c.index;for(let n=0;n<50;n++)c.update(1,false);return {result,stopped:c.index===before,transition:getComputedStyle(document.querySelector('.start-backdrops img')).transitionDuration};});assert(rotation.result.join(',')==='1,2,3,4,0'&&rotation.stopped&&rotation.transition==='6s','Rotation/blend '+JSON.stringify(rotation));
 await page.click('[data-action=logbook]');assert(await page.evaluate(()=>window.__konia.state())==='logbook','Title logbook');await page.keyboard.press('Escape');await page.evaluate(()=>window.__konia.tick(.01));await page.waitForFunction(()=>window.__konia.state()==='start');assert(await page.locator('#start').isVisible(),'Logbook return');
 await page.focus('[data-action=play]');await page.keyboard.press('ArrowDown');assert(await page.evaluate(()=>document.activeElement.dataset.action)==='logbook','Menu arrow navigation');
 await page.click('#start-controls summary');assert(await page.locator('.start-keys').isVisible(),'Controls guide');await page.click('#start-controls summary');
 await page.click('[data-action=settings]');await page.locator('[name=textSize]').selectOption('130');await page.locator('[name=textSize]').dispatchEvent('input');
 for(const viewport of [{width:1440,height:900},{width:320,height:700},{width:900,height:500}]){await page.setViewportSize(viewport);const fit=await page.evaluate(()=>{const r=document.querySelector('.settings').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&document.querySelector('#start').scrollWidth<=innerWidth+1;});assert(fit,'Settings overflow '+JSON.stringify(viewport));}
 await page.locator('[data-settings=back]').click();await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:'/private/tmp/konia-title-screen.png'});
 await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.evaluate(()=>{const c=window.__konia.titleBackdrops,b=c.index;for(let n=0;n<40;n++)c.update(1,true);return c.index===b});assert(reduced,'System reduced motion');
 await page.click('[data-action=play]');await page.waitForFunction(()=>window.__konia.state()==='playing');await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__konia.state()==='paused');assert(await page.locator('.start-backdrops').evaluate(x=>getComputedStyle(x).display)==='none','Pause art obscures gameplay');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({backdrops:5,rotation,menu:'working',settings:'responsive',reducedMotion:true}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
