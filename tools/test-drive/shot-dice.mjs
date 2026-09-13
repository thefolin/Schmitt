import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const b = await chromium.launch({args:['--force-device-scale-factor=3']});
const p = await b.newPage({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
await p.click('#startGameBtn'); await p.waitForTimeout(2200);
const box = await p.evaluate(()=>{
  const d=document.querySelector('.dice-cube');
  const r=d.getBoundingClientRect();
  return {x:r.x,y:r.y,w:r.width,h:r.height};});
// Zoom serré autour du dé
await p.screenshot({path:'./out/dice-zoom.png',
  clip:{x:Math.max(0,box.x-40), y:Math.max(0,box.y-40), width:box.w+80, height:box.h+80}});
await b.close();
console.log(JSON.stringify(box));
