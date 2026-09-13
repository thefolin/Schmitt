import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 915, height: 412 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
await p.click('#addPlayerBtn'); await p.waitForTimeout(200);
await p.click('#startGameBtn'); await p.waitForTimeout(1500);
const st=()=>p.evaluate(()=>({
  eff:document.getElementById('effectTitle')?.textContent||null,
  effOpen:['flex','block'].includes(getComputedStyle(document.getElementById('effectModal')).display),
  selOpen:document.getElementById('playerSelectorModal')?.style.display==='flex',
  rule:!!document.querySelector('.rule-prompt'),
  vic:['flex','block'].includes(getComputedStyle(document.getElementById('victoryScreen')).display)}));
let vic=false; const seen=new Set();
for(let i=0;i<200 && !vic;i++){
  const s=await st(); if(s.eff) seen.add(s.eff);
  if(s.vic){vic=true;break;}
  if(s.rule){await p.fill('.rule-prompt-input','R');await p.click('.rule-prompt-ok');await p.waitForTimeout(1100);continue;}
  if(s.selOpen){
    // cliquer des cartes NON encore selectionnees jusqu'a fermeture
    for(let k=0;k<4;k++){
      const c=await p.$('.player-selector-card:not(.selected)');
      if(!c) break;
      await c.click().catch(()=>{}); await p.waitForTimeout(500);
      if(!(await st()).selOpen) break;
    }
    if((await st()).selOpen){ await p.click('#confirmSelection',{force:true}).catch(()=>{}); await p.waitForTimeout(1000); }
    await p.waitForTimeout(900); continue;
  }
  if(s.effOpen){await p.click('#effectOkBtn',{force:true}).catch(()=>{});await p.waitForTimeout(800);continue;}
  await p.click('#rollDiceBtn',{force:true}).catch(()=>{});await p.waitForTimeout(2400);
}
const h=await p.evaluate(()=>[...document.querySelectorAll('#historyList li')].map(l=>l.textContent.trim()));
await b.close();
console.log(JSON.stringify({vic,cases:[...seen],errs,hist:h.slice(0,8),histLen:h.length},null,2));
