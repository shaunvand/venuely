/* Venuely welcome explainer — timeline engine + four animated scenes (vanilla JS) */
(function(){
  const NS='http://www.w3.org/2000/svg';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const eout=t=>1-Math.pow(1-t,3);
  const eio=t=>(t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1);
  const back=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
  const money=v=>'R\u00A0'+Math.round(v).toLocaleString('en-ZA');
  const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
  const checkSVG='<svg viewBox="0 0 24 24"><path d="M5 13l4 4 10-11"/></svg>';

  const canvas=document.getElementById('canvas');
  const capEb=document.getElementById('cap-eb'), capTitle=document.getElementById('cap-title'), capDesc=document.getElementById('cap-desc');
  const pips=[...document.querySelectorAll('#pips .pip i')];

  // typed field helper: field el contains <span class="val"></span><span class="caret"></span>
  function mkField(parent, labelText){
    const wrap=el('div','', '');
    const lab=el('div','lbl'); lab.textContent=labelText; lab.style.marginBottom='10px';
    const f=el('div','field');
    const val=el('span','val'); const caret=el('span','caret'); caret.style.opacity='0';
    f.appendChild(val); f.appendChild(caret);
    wrap.appendChild(lab); wrap.appendChild(f);
    parent.appendChild(wrap);
    return {wrap, val, caret, full:''};
  }
  function typeField(o, full, p){
    const n=Math.round(full.length*clamp(p,0,1));
    o.val.textContent=full.slice(0,n);
    o.caret.style.opacity=(p>0&&p<1)?(Math.floor(performance.now()/400)%2?0.3:1):0;
  }

  /* ============================ SCENE 1 — Build the page ============================ */
  function buildScene1(){
    const s=el('div','scene'); const inner=el('div','scene-inner'); s.appendChild(inner);
    const hero=el('div','grad'); hero.style.cssText+='position:absolute;left:40px;top:30px;width:1100px;height:206px;border-radius:16px;';
    hero.appendChild(el('div','ic','<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M20 16l-5-5L6 18"/></svg>'));
    const heroChip=el('div','chip', '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg> Stellenbosch');
    heroChip.style.cssText+='position:absolute;left:18px;bottom:16px;background:rgba(255,255,255,.92);color:#2A2622;backdrop-filter:blur(4px);';
    hero.appendChild(heroChip);
    inner.appendChild(hero);

    const title=el('div','ph'); title.style.cssText='position:absolute;left:40px;top:256px;font-size:40px;';
    const tval=el('span','val'); const tcaret=el('span','caret');
    title.appendChild(tval); title.appendChild(tcaret); inner.appendChild(title);
    const sub=el('div','',''); sub.textContent='Your spaces'; sub.style.cssText='position:absolute;left:40px;top:316px;font-size:18px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B8AFA8;white-space:nowrap;';
    inner.appendChild(sub);

    const spaces=[['Ceremony Lawn','grad'],['The Barn Hall','grad alt'],['Garden Terrace','grad alt2']];
    const cards=spaces.map((sp,i)=>{
      const c=el('div','panel'); c.style.cssText+='left:'+(40+i*373)+'px;top:352px;width:347px;height:208px;padding:0;overflow:hidden;';
      const th=el('div','grad'+(sp[1]==='grad'?'':' '+sp[1].split(' ')[1])); th.style.cssText+='height:128px;border-radius:0;';
      th.className='grad '+(i===1?'alt':i===2?'alt2':''); th.style.height='128px';
      const meta=el('div','',''); meta.style.cssText='padding:16px 18px;';
      meta.innerHTML='<div style="font-family:Playfair Display,serif;font-weight:700;font-size:24px;color:#2A2622">'+sp[0]+'</div><div style="font-size:17px;color:#8A817A;margin-top:4px;font-weight:600">'+(i===0?'Up to 180 guests':i===1?'Up to 220 guests':'Up to 90 guests')+'</div>';
      c.appendChild(th); c.appendChild(meta); inner.appendChild(c);
      return c;
    });
    const tval2=tval; const FULL='The Old Vineyard Estate';
    function anim(lt){
      const hp=eout(clamp(lt/0.5,0,1));
      hero.style.opacity=hp; hero.style.transform='translateY('+(22*(1-hp))+'px) scale('+lerp(0.98,1,hp)+')';
      const tp=clamp((lt-0.5)/0.7,0,1);
      tval2.textContent=FULL.slice(0,Math.round(FULL.length*tp));
      tcaret.style.opacity=(tp>0&&tp<1)?(Math.floor(performance.now()/400)%2?0.3:1):0;
      const sp2=eout(clamp((lt-0.95)/0.4,0,1)); sub.style.opacity=sp2;
      cards.forEach((c,i)=>{ const p=eout(clamp((lt-1.15-i*0.2)/0.5,0,1)); c.style.opacity=p; c.style.transform='translateY('+(26*(1-p))+'px)'; });
    }
    return {s, anim};
  }

  /* ============================ SCENE 2 — Get paid ============================ */
  function buildScene2(){
    const s=el('div','scene'); const inner=el('div','scene-inner'); s.appendChild(inner);
    // bank card
    const bank=el('div','panel'); bank.style.cssText+='left:40px;top:30px;width:516px;height:540px;padding:30px 30px;';
    bank.appendChild(el('div','ph','Bank details')).style.cssText='font-size:30px;';
    const bankSub=el('div','',''); bankSub.textContent='So couples can pay you directly'; bankSub.style.cssText='font-size:18px;color:#8A817A;font-weight:600;margin:6px 0 26px;';
    bank.appendChild(bankSub);
    const fieldsWrap=el('div',''); fieldsWrap.style.cssText='display:flex;flex-direction:column;gap:20px;'; bank.appendChild(fieldsWrap);
    const f0=mkField(fieldsWrap,'Account name'); const f1=mkField(fieldsWrap,'Account number'); const f2=mkField(fieldsWrap,'Branch code');
    const ver=el('div','chip ok', checkSVG.replace('viewBox','width="18" height="18" viewBox').replace('stroke-width','').replace('<path','<path stroke="currentColor" stroke-width="3" fill="none"')+' Verified');
    ver.style.cssText+='position:absolute;left:30px;bottom:28px;opacity:0;'; bank.appendChild(ver);
    inner.appendChild(bank);

    // invoice card
    const inv=el('div','panel'); inv.style.cssText+='left:620px;top:30px;width:520px;height:540px;padding:30px 32px;';
    inv.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="lbl">Invoice</div><div class="ph" style="font-size:28px;margin-top:4px">#1042</div></div><div style="text-align:right;flex-shrink:0"><div class="nw" style="font-weight:700;font-size:19px;color:#2A2622">Sarah &amp; James</div><div class="nw" style="font-size:16px;color:#8A817A;font-weight:600;margin-top:2px">14 Feb 2027</div></div></div>';
    const items=[['Venue hire · Barn Hall',28000],['Catering · 120 guests',14400],['Coordination',2600]];
    const rowEls=items.map((it,i)=>{ const r=el('div',''); r.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid #EFE7E0;opacity:0;font-size:20px;'; r.innerHTML='<span class="nw" style="color:#2A2622;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+it[0]+'</span><span class="nw" style="font-weight:800;color:#2A2622;flex-shrink:0">'+money(it[1])+'</span>'; inv.appendChild(r); return r; });
    const totalRow=el('div',''); totalRow.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-top:22px;'; 
    totalRow.innerHTML='<span class="nw" style="font-weight:800;font-size:22px;color:#8A817A">Total due</span>'; const totVal=el('span','ph'); totVal.style.cssText='font-size:34px;color:#FA523C;'; totVal.textContent=money(0); totalRow.appendChild(totVal); inv.appendChild(totalRow);
    const paid=el('div','chip ok'); paid.innerHTML='<span class="tick">'+checkSVG+'</span> PAID'; paid.style.cssText+='position:absolute;right:32px;bottom:28px;font-size:20px;height:46px;opacity:0;transform:scale(.5) rotate(-12deg);'; inv.appendChild(paid);
    inner.appendChild(inv);

    const total=items.reduce((a,b)=>a+b[1],0);
    function anim(lt){
      const fp=eout(clamp(lt/0.4,0,1)); bank.style.opacity=fp; bank.style.transform='translateY('+(18*(1-fp))+'px)'; inv.style.opacity=fp; inv.style.transform='translateY('+(18*(1-fp))+'px)';
      typeField(f0,'The Old Vineyard Estate',(lt-0.3)/0.45);
      typeField(f1,'62 0148 5573',(lt-0.7)/0.4);
      typeField(f2,'250 655',(lt-1.05)/0.35);
      ver.style.opacity=eout(clamp((lt-1.45)/0.3,0,1));
      rowEls.forEach((r,i)=>{ const p=eout(clamp((lt-0.4-i*0.18)/0.4,0,1)); r.style.opacity=p; r.style.transform='translateX('+(18*(1-p))+'px)'; });
      const cp=clamp((lt-1.0)/0.55,0,1); totVal.textContent=money(total*eio(cp));
      const pp=clamp((lt-1.6)/0.4,0,1); paid.style.opacity=pp; paid.style.transform='scale('+lerp(0.5,1,back(pp))+') rotate('+lerp(-12,-4,pp)+'deg)';
    }
    return {s, anim};
  }

  /* ============================ SCENE 3 — Marketplace ============================ */
  function buildScene3(){
    const s=el('div','scene'); const inner=el('div','scene-inner'); s.appendChild(inner);
    const panel=el('div','panel'); panel.style.cssText+='left:40px;top:30px;width:1100px;height:540px;padding:28px 34px;';
    panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div class="ph" style="font-size:30px">Your catalogue</div><div style="font-size:18px;color:#8A817A;font-weight:700">Rentals &amp; suppliers</div></div>';
    const head=el('div',''); head.style.cssText='display:grid;grid-template-columns:1fr 220px 200px 60px;gap:20px;margin:22px 0 6px;'; head.innerHTML='<span class="lbl">Item</span><span class="lbl" style="text-align:right">Price</span><span class="lbl" style="text-align:center">Commission</span><span></span>'; panel.appendChild(head);
    const rows=[['Chiavari Chairs · 120',3600,'10%'],['Round Tables · 15',2250,'10%'],['Draping & florals',8000,'12%'],['Sound & lighting',4500,'10%']];
    const rEls=rows.map((it)=>{
      const r=el('div',''); r.style.cssText='display:grid;grid-template-columns:1fr 220px 200px 60px;gap:20px;align-items:center;padding:18px 0;border-bottom:1px solid #EFE7E0;opacity:0;';
      const name=el('span','',''); name.innerHTML='<span style="font-size:22px;font-weight:700;color:#2A2622">'+it[0]+'</span>';
      const price=el('span','ph'); price.style.cssText='font-size:23px;text-align:right;'; price.textContent=money(0);
      const com=el('span',''); com.style.cssText='text-align:center;opacity:0;'; com.innerHTML='<span class="chip com">'+it[2]+'</span>';
      const tk=el('span',''); tk.style.cssText='display:flex;justify-content:flex-end;opacity:0;transform:scale(.4);'; tk.innerHTML='<span class="tick">'+checkSVG+'</span>';
      r.appendChild(name); r.appendChild(price); r.appendChild(com); r.appendChild(tk);
      panel.appendChild(r); return {r,price,com,tk,target:it[1]};
    });
    const foot=el('div','chip ok'); foot.innerHTML='<span class="tick">'+checkSVG+'</span> All items listed with the right price &amp; commission';
    foot.style.cssText+='position:absolute;left:34px;bottom:26px;font-size:19px;height:46px;opacity:0;'; panel.appendChild(foot);
    inner.appendChild(panel);
    function anim(lt){
      const fp=eout(clamp(lt/0.3,0,1)); panel.style.opacity=fp; panel.style.transform='translateY('+(18*(1-fp))+'px)';
      rEls.forEach((o,i)=>{ const st=0.3+i*0.22; const p=eout(clamp((lt-st)/0.4,0,1)); o.r.style.opacity=p; o.r.style.transform='translateX('+(20*(1-p))+'px)';
        const cp=clamp((lt-st)/0.45,0,1); o.price.textContent=money(o.target*eio(cp));
        o.com.style.opacity=eout(clamp((lt-st-0.2)/0.3,0,1));
        const tp=clamp((lt-st-0.35)/0.3,0,1); o.tk.style.opacity=tp; o.tk.style.transform='scale('+lerp(0.4,1,back(tp))+')';
      });
      foot.style.opacity=eout(clamp((lt-1.55)/0.35,0,1));
    }
    return {s, anim};
  }

  /* ============================ SCENE 4 — Create a wedding ============================ */
  function buildScene4(){
    const s=el('div','scene'); const inner=el('div','scene-inner'); s.appendChild(inner);
    // form
    const form=el('div','panel'); form.style.cssText+='left:40px;top:30px;width:556px;height:540px;padding:30px 30px;';
    form.appendChild(el('div','ph','New wedding')).style.cssText='font-size:30px;margin-bottom:24px;';
    const fw=el('div',''); fw.style.cssText='display:flex;flex-direction:column;gap:20px;'; form.appendChild(fw);
    const cf=mkField(fw,'Couple');
    // date field with mini calendar
    const dlab=el('div','lbl'); dlab.textContent='Wedding date'; dlab.style.margin='0 0 10px';
    const dwrap=el('div',''); const dfield=el('div','field'); const dval=el('span','val'); dval.style.opacity='0'; dval.textContent='14 February 2027'; dfield.appendChild(dval);
    dfield.insertAdjacentHTML('beforeend','<span style="margin-left:auto"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8AFA8" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg></span>');
    dwrap.appendChild(dlab); dwrap.appendChild(dfield);
    // tiny calendar grid
    const cal=el('div',''); cal.style.cssText='margin-top:14px;display:grid;grid-template-columns:repeat(7,1fr);gap:7px;opacity:0;';
    const days=['S','M','T','W','T','F','S']; days.forEach(d=>{const h=el('div','');h.textContent=d;h.style.cssText='text-align:center;font-size:14px;font-weight:800;color:#B8AFA8';cal.appendChild(h);});
    // Feb 2027 starts on Monday; pad 1 blank (Sun). day 14 highlight.
    let dayCells=[]; cal.appendChild(el('div','')); for(let d=1; d<=28; d++){ const c=el('div',''); c.textContent=d; c.style.cssText='text-align:center;font-size:16px;font-weight:700;color:#2A2622;height:34px;line-height:34px;border-radius:9px;'; cal.appendChild(c); dayCells.push(c); }
    dwrap.appendChild(cal); fw.appendChild(dwrap);
    const vf=mkField(fw,'Venue'); 
    const btn=el('div','btn','Create portal →'); btn.style.cssText+='position:absolute;left:30px;right:30px;bottom:28px;opacity:0;'; form.appendChild(btn);
    inner.appendChild(form);

    // portal preview
    const portal=el('div','panel'); portal.style.cssText+='left:640px;top:30px;width:500px;height:540px;padding:0;overflow:hidden;opacity:0;';
    const phero=el('div','grad'); phero.style.cssText+='height:230px;border-radius:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;';
    phero.innerHTML='<svg viewBox="0 0 240 240" width="58" height="58" style="margin-bottom:14px"><rect width="240" height="240" rx="56" fill="rgba(255,255,255,.22)"/><text x="124" y="168" text-anchor="middle" font-family="Playfair Display,serif" font-weight="700" font-size="120" fill="#fff">V</text><circle cx="160" cy="159" r="10" fill="#fff"/></svg>'
      +'<div style="font-family:Playfair Display,serif;font-weight:800;font-size:38px;color:#fff;text-shadow:0 2px 12px rgba(180,60,30,.3)">Sarah &amp; James</div>'
      +'<div style="font-weight:700;font-size:18px;color:#fff;opacity:.92;margin-top:4px;letter-spacing:.04em">14 FEB 2027 · THE OLD VINEYARD</div>';
    portal.appendChild(phero);
    const pbody=el('div',''); pbody.style.cssText='padding:26px 28px;';
    const count=el('div','ph'); count.style.cssText='font-size:30px;color:#FA523C;'; count.textContent='248 days to go';
    pbody.appendChild(count);
    const navs=el('div',''); navs.style.cssText='display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;';
    ['Schedule','Guests','Payments','Spaces'].forEach(n=>{const c=el('div','');c.textContent=n;c.style.cssText='padding:9px 16px;background:#F6F0EA;border-radius:999px;font-weight:700;font-size:17px;color:#2A2622';navs.appendChild(c);});
    pbody.appendChild(navs);
    const created=el('div','chip ok'); created.innerHTML='<span class="tick">'+checkSVG+'</span> Private portal created'; created.style.cssText+='margin-top:24px;font-size:18px;height:46px;'; pbody.appendChild(created);
    portal.appendChild(pbody);
    inner.appendChild(portal);

    function anim(lt){
      const fp=eout(clamp(lt/0.3,0,1)); form.style.opacity=fp; form.style.transform='translateY('+(16*(1-fp))+'px)';
      typeField(cf,'Sarah & James',(lt-0.2)/0.45);
      const calp=eout(clamp((lt-0.7)/0.35,0,1)); cal.style.opacity=calp;
      const selp=clamp((lt-1.05)/0.25,0,1);
      dayCells.forEach((c,idx)=>{ if(idx===13){ c.style.background='rgba(250,82,60,'+(0.12*selp)+')'; c.style.color=selp>0.5?'#E5412B':'#2A2622'; c.style.transform='scale('+lerp(1,1.08,selp)+')'; }});
      dval.style.opacity=clamp((lt-1.15)/0.2,0,1);
      typeField(vf,'The Old Vineyard Estate',(lt-1.25)/0.35);
      const bp=eout(clamp((lt-1.5)/0.25,0,1)); btn.style.opacity=bp;
      const press=clamp((lt-1.75)/0.12,0,1); const rel=clamp((lt-1.87)/0.12,0,1);
      btn.style.transform='scale('+(1-0.05*press+0.05*rel)+')';
      const pp=eout(clamp((lt-1.9)/0.45,0,1)); portal.style.opacity=pp; portal.style.transform='translateX('+(40*(1-pp))+'px) scale('+lerp(0.96,1,pp)+')';
      const cc=clamp((lt-2.1)/0.5,0,1); count.textContent=Math.round(lerp(0,248,eio(cc)))+' days to go';
    }
    return {s, anim};
  }

  /* ============================ OUTRO ============================ */
  function buildOutro(){
    const s=el('div','scene'); const inner=el('div','scene-inner'); s.appendChild(inner);
    const box=el('div',''); box.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    const mark=el('div',''); mark.innerHTML='<svg viewBox="0 0 240 240" width="120" height="120"><rect width="240" height="240" rx="56" fill="#FA523C"/><text x="124" y="168" text-anchor="middle" font-family="Playfair Display,serif" font-weight="700" font-size="120" fill="#FFFDFB">V</text><circle cx="160" cy="159" r="10" fill="#FFFDFB"/></svg>';
    box.appendChild(mark);
    const h=el('div','ph'); h.textContent='Four steps done'; h.style.cssText='font-family:Playfair Display,serif;font-size:46px;margin-top:24px;color:#2A2622;';
    box.appendChild(h);
    const row=el('div',''); row.style.cssText='display:flex;gap:14px;margin-top:26px;';
    ['Page','Payments','Catalogue','Wedding'].forEach(n=>{const c=el('div','chip ok');c.innerHTML='<span class="tick">'+checkSVG+'</span> '+n;c.style.cssText+='font-size:18px;height:46px;opacity:0;';row.appendChild(c);});
    box.appendChild(row); inner.appendChild(box);
    const chips=[...row.children];
    function anim(lt){
      const mp=clamp(lt/0.4,0,1); mark.style.opacity=mp; mark.style.transform='scale('+lerp(0.6,1,back(mp))+')';
      const hp=eout(clamp((lt-0.3)/0.4,0,1)); h.style.opacity=hp; h.style.transform='translateY('+(16*(1-hp))+'px)';
      chips.forEach((c,i)=>{ const p=eout(clamp((lt-0.45-i*0.1)/0.3,0,1)); c.style.opacity=p; c.style.transform='translateY('+(14*(1-p))+'px) scale('+lerp(0.8,1,p)+')'; });
    }
    return {s, anim};
  }

  /* ============================ TIMELINE ============================ */
  const CAPS=[
    {eb:'Welcome to Venuely', t:"Let's get you set up", d:'Four quick steps to your first wedding portal.'},
    {eb:'Step 01 · Couple Experience', t:'Build their page', d:'Add your spaces, photos and venue story — the page couples actually see.'},
    {eb:'Step 02 · Invoicing & Banking', t:'Get paid', d:'Add your bank details and pick an invoice so couples can pay you directly.'},
    {eb:'Step 03 · Your Marketplace', t:'Check your catalogue', d:'Confirm every rental and supplier is listed with the right price and commission.'},
    {eb:'Step 04 · First Wedding', t:'Create the portal', d:'Add the couple and date — Venuely builds their private planning portal instantly.'},
    {eb:'All done', t:"You're ready to host", d:'Create a wedding whenever you are — their portal is one click away.'},
  ];

  const s1=buildScene1(), s2=buildScene2(), s3=buildScene3(), s4=buildScene4(), so=buildOutro();
  [s1,s2,s3,s4,so].forEach(o=>canvas.appendChild(o.s));

  // scene schedule: [startTime, dur, sceneObj, capIndex, pipIndex(or -1)]
  const INTRO=0.9;
  const SCENES=[
    [INTRO,      2.05, s1, 1, 0],
    [INTRO+2.05, 2.20, s2, 2, 1],
    [INTRO+4.25, 2.10, s3, 3, 2],
    [INTRO+6.35, 2.75, s4, 4, 3],
  ];
  const T_OUTRO=INTRO+9.10;     // ~10.0
  const OUTRO_DUR=1.70;
  const END=T_OUTRO+OUTRO_DUR;  // ~11.7 total, then loop
  const XF=0.34;

  function fadeOpacity(t,start,dur){ const fi=clamp((t-start)/XF,0,1); const fo=clamp((start+dur-t)/XF,0,1); return Math.min(fi,fo); }

  let lastCap=-1;
  function setCap(i,op){
    if(i!==lastCap){ capEb.textContent=CAPS[i].eb; capTitle.textContent=CAPS[i].t; capDesc.textContent=CAPS[i].d; lastCap=i; }
    const o=clamp(op,0,1); capEb.style.opacity=o; capTitle.style.opacity=o; capDesc.style.opacity=o;
    const ty=(1-o)*10; capTitle.style.transform='translateY('+ty+'px)';
  }

  function render(t){
    // intro caption
    let bestCap=0, bestOp=0;
    const introOp=fadeOpacity(t,0,INTRO+XF);
    if(t<INTRO){ bestCap=0; bestOp=Math.min(eout(clamp(t/0.5,0,1)), clamp((INTRO-t)/XF,0,1)); }

    // scenes
    SCENES.forEach(([start,dur,obj,capI])=>{
      const op=fadeOpacity(t,start,dur);
      obj.s.style.opacity=op;
      if(op>0) obj.anim(t-start);
      // caption pick
      const capOp=fadeOpacity(t,start,dur);
      if(capOp>bestOp){ bestOp=capOp; bestCap=capI; }
    });

    // outro
    const oOp=fadeOpacity(t,T_OUTRO,OUTRO_DUR+XF);
    so.s.style.opacity=clamp((t-T_OUTRO)/XF,0,1)*(t<END?1:1);
    so.s.style.opacity=Math.min(clamp((t-T_OUTRO)/XF,0,1), 1);
    if(t>=T_OUTRO){ so.anim(t-T_OUTRO); }
    else so.s.style.opacity=0;
    const outroCapOp=Math.min(clamp((t-T_OUTRO)/XF,0,1),1);
    if(t>=T_OUTRO && outroCapOp>bestOp){ bestOp=outroCapOp; bestCap=5; }

    if(t<INTRO && introOp>bestOp){ bestOp=introOp; bestCap=0; }
    setCap(bestCap,bestOp);

    // pips
    SCENES.forEach(([start,dur,,,pipI])=>{ const f=clamp((t-start)/dur,0,1); pips[pipI].style.width=(f*64)+'px'; });
    if(t>=T_OUTRO) pips.forEach(p=>p.style.width='64px');
  }

  // scaling — contain, never crop
  const stage=document.getElementById('stage');
  function fit(){ const s=Math.min(window.innerWidth/1920, window.innerHeight/1080); stage.style.transform='scale('+s+')'; }
  window.addEventListener('resize',fit); fit();

  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let startT=null, raf=null;
  function tick(now){
    if(startT===null) startT=now;
    let t=(now-startT)/1000;
    if(t>=END){ render(END); raf=null; return; }   // play ONCE, hold last frame
    render(t);
    raf=requestAnimationFrame(tick);
  }
  function play(){ cancelAnimationFrame(raf); startT=null; if(reduce){ render(T_OUTRO+0.5); return; } raf=requestAnimationFrame(tick); }
  document.getElementById('replay').addEventListener('click',play);
  play();

  window.__render=t=>{ cancelAnimationFrame(raf); render(t); };
  window.__play=play;
})();
