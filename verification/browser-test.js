const puppeteer=require('puppeteer-core');
const path=require('path');
(async()=>{
  const browser=await puppeteer.launch({
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',
    args:['--no-sandbox','--disable-gpu','--force-color-profile=srgb','--hide-scrollbars'],
    defaultViewport:{width:1280,height:2400,deviceScaleFactor:1}
  });
  const page=await browser.newPage();
  const errors=[],logs=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  const url='file:///'+path.resolve(__dirname,'..','index.html').replace(/\\/g,'/');
  await page.goto(url,{waitUntil:'load'});
  await page.click('#run');
  // harness paints per-test with 50ms sleeps; wait for completion
  await page.waitForFunction(()=>document.querySelector('#run').disabled===false,{timeout:60000});
  await new Promise(r=>setTimeout(r,300));
  const score=await page.$eval('#score',el=>el.textContent);
  const tests=await page.$$eval('#tests .test',els=>els.map(e=>({cls:e.className,name:e.querySelector('span').textContent,pts:e.querySelector('b').textContent})));
  console.log('SCORE:',score);
  for(const t of tests)console.log(`  ${t.cls.includes('pass')?'PASS':'FAIL'} ${t.name} ${t.pts}`);
  // wait for atlas render to finish (status says done)
  try{
    await page.waitForFunction(()=>document.querySelector('#atlas-status')&&document.querySelector('#atlas-status').textContent.startsWith('done'),{timeout:30000});
    const st=await page.$eval('#atlas-status',el=>el.textContent);
    console.log('ATLAS STATUS:',st);
    const poly=await page.$eval('#atlas-poly',el=>el.textContent);
    console.log('POLY:',poly.slice(0,120));
    // canvas has non-blank pixels?
    const nonblank=await page.evaluate(()=>{
      const c=document.querySelector('#atlas-canvas'),x=c.getContext('2d');
      const d=x.getImageData(0,0,c.width,c.height).data;let n=0;
      for(let i=0;i<d.length;i+=4)if(d[i]||d[i+1]||d[i+2])n++;
      return n;
    });
    console.log('CANVAS NON-BLANK PX:',nonblank);
    // switch preset to degree-12 ring, verify re-render
    await page.select('#atlas-preset','4');
    await page.waitForFunction(()=>document.querySelector('#atlas-status').textContent.startsWith('done'),{timeout:30000});
    console.log('PRESET12 STATUS:',await page.$eval('#atlas-status',el=>el.textContent));
    // keyboard zoom via canvas
    await page.focus('#atlas-canvas');
    await page.keyboard.press('+');
    await new Promise(r=>setTimeout(r,400));
    console.log('KB ZOOM OK');
    // export button exists and is clickable (don't actually download in headless file://)
    const exportBtn=await page.$('#atlas-export');
    console.log('EXPORT BUTTON:',!!exportBtn);
    // rerun deterministic checks after atlas is alive (call-order robustness)
    await page.click('#run');
    await page.waitForFunction(()=>document.querySelector('#run').disabled===false,{timeout:60000});
    console.log('SCORE RERUN:',await page.$eval('#score',el=>el.textContent));
    await page.screenshot({path:'screenshot-final.png',fullPage:true});
    console.log('SCREENSHOT saved');
  }catch(e){console.log('ATLAS PHASE FAIL:',e.message);}
  console.log('CONSOLE ERRORS:',errors.length?JSON.stringify(errors,null,1):'none');
  await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
