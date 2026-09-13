import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 915, height: 412 } });
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
await p.click('#startGameBtn'); await p.waitForTimeout(1800);
for(let i=0;i<12;i++){
  const m=await p.evaluate(()=>['flex','block'].includes(getComputedStyle(document.getElementById('effectModal')).display));
  if(m){await p.screenshot({path:'./out/effect-landscape.png'});console.log('capture');break;}
  await p.click('#rollDiceBtn',{force:true}).catch(()=>{});
  await p.waitForTimeout(2800);
}
await b.close();
