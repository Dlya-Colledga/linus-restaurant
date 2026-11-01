'use strict';
const I18n=window.LinusI18n;
const T=text=>I18n.t(text);
const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const numberFmt={
  format:value=>I18n.number(value)
};
const STORAGE='linus.orders.v1';
const ACTIVE='linus.order.active';
let readyParticleEngine=null;
const stageLabels=[
{
  name:'Заказ принят',detail:'Заявка создана и сохранена'
},
{
  name:'Передан на кухню',detail:'Команда получила список блюд'
},
{
  name:'Готовим блюда',detail:'Ингредиенты проходят приготовление'
},
{
  name:'Сервируем',detail:'Собираем и проверяем заказ'
},
{
  name:'Готов к выдаче',detail:'Можно забирать заказ'
}
];
const STAGE_SECONDS=5;
const TOTAL_SECONDS=stageLabels.length*STAGE_SECONDS;
function readOrders(){
  try{
    const raw=localStorage.getItem(STORAGE);
    const value=JSON.parse(raw||'[]');
    return Array.isArray(value)?value:[];
  }
  catch{
    return [];
  }
}
const PICKUP_WORDS=[
'wayland','pacman','kernel','penguin','terminal','bash','zsh','fish',
'tux','flatpak','pipewire','plasma','dolphin','hyprland','starship',
'neofetch','fastfetch','grub','sudo','vim','emacs','fedora','debian',
'archlinux','openbox','xorg','gnome','kitty','konsole','grep','git',
'systemd','nix','mint','shell','sway','kde','manjaro','alacritty',
'inxi','foot','tmux','btrfs','ext4','kubuntu'
];
function randomPickupWord(){
  const used=new Set(readOrders().map(x=>x?.pickupWord).filter(Boolean));
  const pool=PICKUP_WORDS.filter(word=>!used.has(word));
  const options=pool.length?pool:PICKUP_WORDS;
  const bytes=new Uint32Array(1);
  if(globalThis.crypto?.getRandomValues){
    crypto.getRandomValues(bytes);
  }
  else{
    bytes[0]=Math.floor(Math.random()*4294967296);
  }
  return options[bytes[0]%options.length];
}
const params=new URLSearchParams(location.search);
const requested=params.get('id');
let orders=readOrders();
let currentId=requested;
try{
  if(!currentId)currentId=localStorage.getItem(ACTIVE);
}
catch{
}
let order=orders.find(x=>String(x?.id)===String(currentId)&&Array.isArray(x.items)&&Number.isFinite(x.createdAt));
if(!order){
  $('#empty').hidden=false;
  $('#backLink').textContent=T('В МЕНЮ ↗');
}
else{
  const locationId=order.locationId||'chuy';
  const menuUrl=`menu.html?location=${encodeURIComponent(locationId)}`;
  $('#backLink').href=menuUrl;
  $('#branch').removeAttribute('data-i18n');
  $('#branch').textContent=T(order.locationName||locationId);
  $('#heroBranch').textContent=T(order.locationName||locationId);
  $('#emptyLink').href=menuUrl;
  $('#heroTotal').textContent=I18n.currency(order.total);
  $('#receiptTotal').textContent=I18n.currency(order.total);
  $('#accessibleNumber').textContent=`${T('Номер')} ${order.id}`;
  const stageIndex=Math.min(stageLabels.length-1,Math.floor(Math.max(0,(Date.now()-order.createdAt)/1000)/STAGE_SECONDS));
  $('#mobileStageName').textContent=T(stageLabels[stageIndex].name);
  $('#mobileReceiptCount').textContent=I18n.number(order.items.reduce((sum,item)=>sum+item.qty,0))+' ×';
  $('#mobileReceiptTotal').textContent=I18n.currency(order.total);
  $('#mobileProgress').setAttribute('aria-label',T('Процесс приготовления'));

  $('#createdTime').textContent=new Intl.DateTimeFormat('ru-RU',{
    hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bishkek'
  }).format(new Date(order.createdAt));
  $('#itemCounter').textContent=`${order.items.reduce((sum,x)=>sum+x.qty,0)} ${T('ПОРЦИИ')}`;
  const list=$('#receiptList');
  order.items.forEach(item=>{
    const row=document.createElement('div');row.className='receipt-row';
    const dish=document.createElement('span');dish.className='dish-name';dish.textContent=`${item.name} `;
    const qty=document.createElement('span');qty.className='dish-qty mono';qty.textContent=`×${item.qty}`;dish.append(qty);
    const price=document.createElement('span');price.className='cost mono';price.textContent=I18n.currency(item.price*item.qty);
    row.append(dish,price);list.appendChild(row);
  });
  const mobileStageLabel=$('#mobileStageLabel');
  const mobileStageName=$('#mobileStageName');
  const mobileProgress=$('#mobileProgress');
  const mobileProgressFills=[...mobileProgress.querySelectorAll('.mobile-progress-fill')];
  const receiptToggle=$('#receiptToggle');
  const panel=$('.panel');
  const mobileQuery=matchMedia('(max-width:700px)');
  const portions=order.items.reduce((sum,item)=>sum+item.qty,0);
  $('#mobileReceiptCount').textContent=I18n.number(portions)+' ×';
  $('#mobileReceiptTotal').textContent=I18n.currency(order.total);
  let receiptOpen=false;
  receiptToggle.addEventListener('click',()=>{
    receiptOpen=!receiptOpen;
    panel.classList.toggle('receipt-expanded',receiptOpen);
    receiptToggle.setAttribute('aria-expanded',String(receiptOpen));
  });
  const trace=$('#trace');
  stageLabels.forEach((stage,i)=>{
    const row=document.createElement('li');row.className='step';row.dataset.state='waiting';
    const icon=document.createElement('span');icon.className='step-icon';icon.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.className='step-text';text.textContent=T(stage.name);
    const detail=document.createElement('small');detail.textContent=T(stage.detail);text.append(detail);
    const status=document.createElement('span');status.className='step-status mono';status.textContent='';
    row.append(icon,text,status);trace.append(row);
  });
  $('#orderContent').hidden=false;
  requestAnimationFrame(rollOrderNumber);
  let open=!mobileQuery.matches;
  $('#thought').dataset.open=String(open);
  $('#thoughtToggle').setAttribute('aria-expanded',String(open));
  $('#thoughtToggle').addEventListener('click',()=>{
    open=!open;$('#thought').dataset.open=String(open);$('#thoughtToggle').setAttribute('aria-expanded',String(open));
  });
  let readyShown=false;
  let readyQueued=false;
  function ensurePickupWord(){
    if(!order.pickupWord || !PICKUP_WORDS.includes(order.pickupWord)){
      order.pickupWord=randomPickupWord();
      saveOrder();
    }
    $('#pickupWord').textContent='«'+order.pickupWord+'»';
  }
  function enterReadyScreen(instant=false){
    if(readyShown||readyQueued)return;
    readyQueued=true;
    ensurePickupWord();
    const app=$('#app');
    const finish=()=>{
      if(readyShown)return;
      readyShown=true;
      readyQueued=false;
      const number=$('.number');
      const before=number.getBoundingClientRect();
      app.classList.add('order-ready');
      const after=number.getBoundingClientRect();
      if(!instant&&!reduced.matches&&before.width>0&&after.width>0){
        const shiftX=(before.left+before.width/2)-(after.left+after.width/2);
        const shiftY=(before.top+before.height/2)-(after.top+after.height/2);
        const scale=before.width/after.width;
        number.animate([
        {
          transform:`translate(${shiftX}px,${shiftY}px) scale(${scale})`
        },
        {
          transform:'translate(0,0) scale(1)'
        }
        ],{
          duration:850,easing:'cubic-bezier(.22,1,.36,1)'
        });
      }
      startReadyParticles();
      requestAnimationFrame(()=>requestAnimationFrame(()=>app.classList.add('ready-visible')));
    };
    if(instant){
      finish();
    }
    else{
      app.classList.add('order-exiting');
      setTimeout(finish,reduced.matches?0:610);
    }
  }
  function saveOrder(){
    try{
      const latest=readOrders();
      const at=latest.findIndex(x=>String(x.id)===String(order.id));
      if(at!==-1){
        latest[at]={
          ...latest[at],finishedAt:order.finishedAt||null,pickupWord:order.pickupWord||null
        };
        localStorage.setItem(STORAGE,JSON.stringify(latest));
      }
    }
    catch(err){
      console.warn('Не удалось сохранить прогресс заказа',err);
    }
  }
  function secondsElapsed(){
    return Math.max(0,(Date.now()-order.createdAt)/1000);
  }
  function currentStage(){
    return Math.min(stageLabels.length-1,Math.floor(secondsElapsed()/STAGE_SECONDS));
  }
  function clock(seconds){
    const m=Math.floor(seconds/60);
    const s=Math.floor(seconds%60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  let lastStage=-1;
  let lastDone=false;
  function updateStatus(){
    const elapsed=secondsElapsed();
    const step=currentStage();
    const done=Boolean(order.finishedAt)||elapsed>=TOTAL_SECONDS;
    if(done&&!order.finishedAt){
      order.finishedAt=order.createdAt+TOTAL_SECONDS*1000;
      saveOrder();
    }
    const shownSeconds=Math.min(TOTAL_SECONDS,
    Math.max(0,((order.finishedAt||Date.now())-order.createdAt)/1000));
    $('#thoughtTimer').textContent=clock(shownSeconds);
    const elapsedInStage=elapsed%STAGE_SECONDS;
    mobileProgress.setAttribute('aria-valuenow',String(Math.min(TOTAL_SECONDS,Math.floor(elapsed))));
    mobileProgressFills.forEach((fill,i)=>{
      fill.style.width=(done||i<step?'100%':i===step?`${Math.min(100,elapsedInStage/STAGE_SECONDS*100)}%`:'0%');
    });
    mobileStageLabel.textContent=`${String(step+1).padStart(2,'0')} / ${String(stageLabels.length).padStart(2,'0')}`;
    mobileStageName.textContent=T(stageLabels[step].name);

    if(step===lastStage&&done===lastDone)return;
    lastStage=step;
    lastDone=done;
    $('#thought').dataset.done=String(done);
    $('#thoughtLabel').textContent=T(done?'Заказ готов':'Готовим ваш заказ');
    $('#heroSubtitle').textContent=T(done?'Заказ готов к выдаче.':'Следите за этапами приготовления вашего заказа.');
    [...trace.children].forEach((row,i)=>{
      const state=done||i<step?'done':i===step?'active':'waiting';
      row.dataset.state=state;
      row.querySelector('.step-icon').textContent=state==='done'?'✓':'';
      row.querySelector('.step-status').textContent=state==='active'?T('СЕЙЧАС'):state==='done'?T('ГОТОВО'):'';
    });
    if(done)enterReadyScreen(orderReadyOnLoad);
  }
  const orderReadyOnLoad=Boolean(order.finishedAt)||secondsElapsed()>=TOTAL_SECONDS;
  updateStatus();
  setInterval(updateStatus,250);
}
function startReadyParticles(){
  if(readyParticleEngine)return;
  const canvas=$('#readyParticles');
  const root=canvas?.parentElement;
  const ctx=canvas?.getContext('2d',{
    alpha:true
  });
  if(!root||!ctx)return;
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const mobile=matchMedia('(max-width:700px)').matches;
  const count=reduce?70:(mobile?135:230);
  const palette=['#c9ad70','#e7d4ac','#eee9dd','#a98b51'];
  const rnd=(a,b)=>a+(b-a)*Math.random();
  const stars=Array.from({
    length:count
  },()=>({
    x:Math.random(),y:Math.random(),z:rnd(.45,1.8),
    radius:rnd(.65,2.0),speed:rnd(.15,.55),phase:rnd(0,Math.PI*2),
    tint:palette[Math.floor(Math.random()*palette.length)],
    flicker:rnd(.3,.9)
  }));
  const bursts=[];
  const pointer={
    x:.5,y:.5,active:false
  };
  let w=0,h=0,dpr=1,raf=0,last=0;
  function resize(){
    w=Math.max(1,root.clientWidth);
    h=Math.max(1,root.clientHeight);
    dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);
    canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function draw(now){
    raf=0;
    if(document.hidden)return;
    const dt=Math.min(last?(now-last)/1000:1/60,.05);
    last=now;
    ctx.clearRect(0,0,w,h);
    const t=now*.001;
    const focusX=pointer.active?(pointer.x-.5)*11:0;
    const focusY=pointer.active?(pointer.y-.5)*11:0;
    for(const p of stars){
      if(!reduce)p.y=(p.y-dt*p.speed*.018+1)%1;
      const depth=1/p.z;
      const x=(p.x-.5)*w*(.75+.40*depth)+w*.5-focusX*depth;
      const y=(p.y-.5)*h*(.80+.25*depth)+h*.5-focusY*depth;
      const edge=Math.min(1,x/(w*.11),(w-x)/(w*.11),y/(h*.11),(h-y)/(h*.11));
      if(edge<=0)continue;
      const glow=(.6+.4*Math.sin(t*(1.0+p.flicker)+p.phase));
      const alpha=Math.min(1,Math.max(0,edge))*glow*(.26+.28*depth);
      const radius=p.radius*(.8+.60*depth);
      ctx.globalAlpha=alpha;
      ctx.fillStyle=p.tint;
      ctx.shadowBlur=radius*7;
      ctx.shadowColor=p.tint;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.fill();
    }
    for(let i=bursts.length-1;i>=0;i--){
      const b=bursts[i];
      b.age+=dt;
      if(b.age>1.1){
        bursts.splice(i,1);
        continue;
      }
      for(let j=0;j<12;j++){
        const angle=j*Math.PI/6+b.seed;
        const dist=16+b.age*190;
        const x=b.x+Math.cos(angle)*dist;
        const y=b.y+Math.sin(angle)*dist;
        ctx.globalAlpha=(1-b.age/1.1)*.65;
        ctx.shadowBlur=12;
        ctx.shadowColor='#c9ad70';
        ctx.fillStyle='#e9d9b8';
        ctx.beginPath();
        ctx.arc(x,y,1.4,0,Math.PI*2);
        ctx.fill();
      }
    }
    ctx.globalAlpha=1;
    ctx.shadowBlur=0;
    if(!reduce)raf=requestAnimationFrame(draw);
  }
  function move(e){
    const r=root.getBoundingClientRect();
    pointer.x=(e.clientX-r.left)/Math.max(r.width,1);
    pointer.y=(e.clientY-r.top)/Math.max(r.height,1);
    pointer.active=true;
  }
  function leave(){
    pointer.active=false;
  }
  function burst(e){
    if(reduce)return;
    const r=root.getBoundingClientRect();
    bursts.push({
      x:e.clientX-r.left,y:e.clientY-r.top,age:0,seed:Math.random()*6.28
    });
    if(bursts.length>3)bursts.shift();
  }
  const observer=new ResizeObserver(resize);
  observer.observe(root);
  root.addEventListener('pointermove',move,{
    passive:true
  });
  root.addEventListener('pointerleave',leave,{
    passive:true
  });
  root.addEventListener('pointerdown',burst,{
    passive:true
  });
  function visibility(){
    if(!document.hidden&&!raf&&!reduce){
      last=0;
      raf=requestAnimationFrame(draw);
    }
  }
  document.addEventListener('visibilitychange',visibility);
  resize();
  raf=requestAnimationFrame(draw);
  readyParticleEngine={
    destroy(){
      cancelAnimationFrame(raf);
      observer.disconnect();
      root.removeEventListener('pointermove',move);
      root.removeEventListener('pointerleave',leave);
      root.removeEventListener('pointerdown',burst);
      document.removeEventListener('visibilitychange',visibility);
    }
  };
}
function rollOrderNumber(){
  const id=String(order.id);
  const mount=$('#roll');
  mount.replaceChildren();
  let longest=0;
  for(const [index,digit] of [...id].entries()){
    if(!/\d/.test(digit))continue;
    const viewport=document.createElement('span');
    viewport.className='roll-window';
    const strip=document.createElement('span');
    strip.className='roll-strip';
    for(let repeat=0;repeat<4;repeat++)for(let n=0;n<10;n++){
      const cell=document.createElement('span');
      cell.className='roll-cell';
      cell.textContent=String(n);
      strip.append(cell);
    }
    viewport.append(strip);
    mount.append(viewport);
    const dest=(20+Number(digit))*1.13;
    const delay=index*85;
    const duration=1450;
    longest=Math.max(longest,delay+duration);
    if(reduced.matches){
      strip.style.transform=`translateY(-${dest}em)`;
      continue;
    }
    const anim=strip.animate([
    {
      transform:'translateY(0em)',offset:0
    },
    {
      transform:`translateY(-${dest+.13}em)`,offset:.89
    },
    {
      transform:`translateY(-${dest}em)`,offset:1
    }
    ],{
      duration,delay,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'
    });
    anim.onfinish=()=>{
      strip.style.transform=`translateY(-${dest}em)`;
      anim.cancel();
    };
  }
  setTimeout(()=>$('#app').classList.add('revealed'),reduced.matches?0:Math.max(500,longest-150));
}
I18n.subscribe(()=>{
  if(!order){
    $('#backLink').textContent=T('В МЕНЮ ↗');return;
  }
  const locationId=order.locationId||'chuy';
  $('#branch').textContent=T(order.locationName||locationId);
  $('#heroBranch').textContent=T(order.locationName||locationId);
  $('#heroTotal').textContent=I18n.currency(order.total);
  $('#receiptTotal').textContent=I18n.currency(order.total);
  $('#accessibleNumber').textContent=`${T('Номер')} ${order.id}`;
  const stageIndex=Math.min(stageLabels.length-1,Math.floor(Math.max(0,(Date.now()-order.createdAt)/1000)/STAGE_SECONDS));
  $('#mobileStageName').textContent=T(stageLabels[stageIndex].name);
  $('#mobileReceiptCount').textContent=I18n.number(order.items.reduce((sum,item)=>sum+item.qty,0))+' ×';
  $('#mobileReceiptTotal').textContent=I18n.currency(order.total);
  $('#mobileProgress').setAttribute('aria-label',T('Процесс приготовления'));

  $('#itemCounter').textContent=`${order.items.reduce((sum,item)=>sum+item.qty,0)} ${T('ПОРЦИИ')}`;
  $('#thoughtLabel').textContent=T($('#thought').dataset.done==='true'?'Заказ готов':'Готовим ваш заказ');
  $('#heroSubtitle').textContent=T($('#thought').dataset.done==='true'?'Заказ готов к выдаче.':'Следите за этапами приготовления вашего заказа.');
  [...$('#trace').children].forEach((node,i)=>{
    node.querySelector('.step-text').firstChild.textContent=T(stageLabels[i].name);
    node.querySelector('small').textContent=T(stageLabels[i].detail);
    node.querySelector('.step-status').textContent=node.dataset.state==='active'?T('СЕЙЧАС'):node.dataset.state==='done'?T('ГОТОВО'):'';
  });
  [...$('#receiptList').children].forEach((row,i)=>{
    row.querySelector('.cost').textContent=I18n.currency(order.items[i].price*order.items[i].qty);
  });
});
