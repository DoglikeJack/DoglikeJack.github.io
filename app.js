
const $ = s=>document.querySelector(s);
let ctx=null; const BUF={}; let playing=[];
function ensureCtx(){ try{ if(!ctx) ctx=new (window.AudioContext||window.webkitAudioContext)(); if(ctx.state==='suspended') ctx.resume(); }catch(e){} return ctx; }
document.addEventListener('pointerdown',()=>{ensureCtx();},{passive:true});
document.addEventListener('touchstart',()=>{ensureCtx();},{passive:true});
function b64ToBuf(d){const s=atob(d.split(',')[1]);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u.buffer;}
function decode(ab){ return new Promise((res,rej)=>{ const p=ctx.decodeAudioData(ab,res,rej); if(p&&p.then) p.then(res,rej); }); }
async function getBuf(id){ if(BUF[id]) return BUF[id]; const src=SND[id];
  const ab = src.startsWith('data:') ? b64ToBuf(src) : await (await fetch(src)).arrayBuffer();
  BUF[id]=await decode(ab); return BUF[id]; }
function playClip(id){ return new Promise(async res=>{ let done=false; const fin=()=>{if(!done){done=true;res();}};
  try{ ensureCtx(); const buf=await getBuf(id); const s=ctx.createBufferSource(); s.buffer=buf; const g=ctx.createGain(); g.gain.value=1.0;
    s.connect(g); g.connect(ctx.destination); playing.push(s); s.onended=fin; s.start(0); setTimeout(fin,buf.duration*1000+200); }
  catch(e){ try{ const a=new Audio(SND[id]); a.onended=fin; a.onerror=fin; a.play().catch(fin); }catch(_){fin();} setTimeout(fin,1500); } }); }
function stopClips(){ playing.forEach(s=>{try{s.stop()}catch(e){}}); playing=[]; }
let voices=[], voice=null;
function loadVoices(){
  voices = speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
  const sel=$('#voice'); sel.innerHTML='';
  voices.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v.name+' ('+v.lang+')';sel.appendChild(o)});
  let pref = voices.findIndex(v=>/en-GB/i.test(v.lang)); if(pref<0) pref = voices.findIndex(v=>/en-US/i.test(v.lang));
  sel.value = pref>=0?pref:0; voice = voices[sel.value]||null;
}
speechSynthesis.onvoiceschanged = loadVoices; loadVoices();
$('#voice').onchange = e=>voice=voices[e.target.value];
let seq=0;
function stop(){seq++;speechSynthesis.cancel();stopClips();document.querySelectorAll('.on,.speaking').forEach(e=>e.classList.remove('on','speaking'))}
$('#stop').onclick=stop;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function speak(text, rate){return new Promise(res=>{
  const u=new SpeechSynthesisUtterance(text); if(voice)u.voice=voice; u.lang=(voice&&voice.lang)||'en-US';
  u.rate=rate??parseFloat($('#rate').value); u.onend=u.onerror=()=>res(); speechSynthesis.speak(u); setTimeout(res,4000);})}
async function run(el, steps){ stop(); const my=seq; el&&el.classList.add('speaking');
  for(const s of steps){ if(my!==seq)return; if(s.clip) await playClip(s.clip); else if(s.word) await speak(s.word,s.rate); if(s.wait) await sleep(s.wait);} 
  el&&el.classList.remove('speaking'); }
async function soundOut(card,c){
  stop(); const my=seq; const gap=parseInt($('#gap').value);
  const boxes=[...card.querySelectorAll('.box')], bw=card.querySelector('.bw');
  for(const b of boxes){ if(my!==seq)return; b.classList.add('on');
    if(b.dataset.clip) await playClip(b.dataset.clip); else await sleep(250); await sleep(gap); b.classList.remove('on');}
  if(my!==seq)return; bw.classList.add('on'); await speak(bw.textContent,0.85); await sleep(300); bw.classList.remove('on');
}
function markWord(m){return m.replace(/\[([^\]]*)\]/g,'<span>$1</span>')}
function render(){
  const main=$('#main'); main.innerHTML='';
  CARDS.forEach(c=>{
    const d=document.createElement('div'); d.className='card'; d.dataset.g=c.grp;
    const isL=c.grp==='letters';
    const bigHtml = isL ? c.big[0]+'<span class="lc">'+c.big[1]+'</span>' : c.big;
    const sndHtml = c.sounds.map((s,i)=>`<span class="snd ${i?'alt':''}" data-clip="${s[1]}">▶ ${s[0]}</span>`).join(' ');
    const lower = isL ? c.big[1] : c.big;
    d.innerHTML=`<div class="head"><div class="num">${c.n}</div>
      <div class="big ${isL?'':'pat'}" title="hear the sound">${bigHtml}</div>
      <div><div class="t">${c.title} ${sndHtml}</div>
      <div style="font-family:Sarabun;font-size:12px;color:var(--mute)">กดตัวใหญ่ = เสียง · กดคำ = อ่านคำ</div></div></div>
      <div class="words">${c.marked.map(m=>`<div class="w" data-w="${m.replace(/[\[\]]/g,'')}">${markWord(m)}</div>`).join('')}</div>
      <div class="btns"><button class="b o say">▶ Say it: ${lower}-${lower}-${lower} ${c.words[0]}</button>
      <button class="b out">▶ Sound it out</button><button class="b all">▶ All words</button></div>
      <div class="blend">${c.blend.map((t,i)=>`<div class="box ${t.silent?'silent':''}" data-clip="${t.clip}">${t.t}</div>${i<c.blend.length-1?'<span class="arrow">·</span>':''}`).join('')}
      <span class="arrow">→</span><span class="bw">${c.blend.map(t=>t.t).join('')}</span></div>
      ${c.note?`<div class="note">✎ ${c.note}</div>`:''}`;
    const main1=c.sounds[0][1];
    d.querySelector('.big').onclick=e=>run(e.currentTarget,[{clip:main1}]);
    d.querySelectorAll('.snd').forEach(s=>s.onclick=e=>run(d.querySelector('.big'),[{clip:e.currentTarget.dataset.clip}]));
    d.querySelectorAll('.w').forEach(w=>w.onclick=e=>run(e.currentTarget,[{word:e.currentTarget.dataset.w}]));
    d.querySelector('.say').onclick=()=>run(d.querySelector('.big'),[{clip:main1,wait:350},{clip:main1,wait:350},{clip:main1,wait:450},{word:c.words[0]}]);
    d.querySelector('.out').onclick=()=>soundOut(d,c);
    d.querySelector('.all').onclick=()=>run(null,c.words.map(w=>({word:w,wait:300})));
    d.querySelectorAll('.box').forEach(b=>b.onclick=e=>{ if(e.currentTarget.dataset.clip) run(e.currentTarget,[{clip:e.currentTarget.dataset.clip}]); else run(e.currentTarget,[{word:'silent e',rate:0.9}]); });
    main.appendChild(d);
  });
}
render();
$('#tabs').onclick=e=>{const t=e.target.closest('.tab'); if(!t)return;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on')); t.classList.add('on');
  document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hide', t.dataset.g!=='all'&&c.dataset.g!==t.dataset.g)); window.scrollTo(0,0)};
