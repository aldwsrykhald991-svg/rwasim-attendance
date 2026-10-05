// @ts-nocheck
/* الهوية العائمة: JS خام بلا مكتبات. مطابق لـ Rawasim.Motion في نظام التصميم. */
var MKEY='rw-motion';
function reduced(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function stored(){try{return window.localStorage.getItem(MKEY);}catch(e){return null;}}
var SKIP='input,textarea,select,dialog,[role="dialog"],[data-fx="off"]';
var HOT='a,button,[role="button"],[role="radio"],[role="switch"],summary,select,input,textarea,label';
var Motion={
 _stop:null,_root:null,
 isOn:function(){return true;}, /* الحركة دائمة بطلب صاحب المنصة: بلا مفتاح إيقاف */
 set:function(on){try{window.localStorage.setItem(MKEY,on?'on':'off');}catch(e){} Motion.init(Motion._root);},
 init:function(root){
  root=root||document; Motion._root=root;
  if(Motion._stop){Motion._stop();Motion._stop=null;}
  var de=document.documentElement; de.classList.remove('rw-motion');
  if(!Motion.isOn()||!('IntersectionObserver' in window))return;
  de.classList.add('rw-motion');
  var q=function(s){return Array.prototype.slice.call(root.querySelectorAll(s));};
  var ok=function(el){return !el.closest(SKIP);};
  var floats=q('.rw-fx-float').filter(function(el){return ok(el)&&!(el.parentElement&&el.parentElement.closest('.rw-fx-float'));});
  var tilts=q('.rw-fx-tilt').filter(ok);
  var glass=q('.rw-fx-glass');
  var reveals=q('.rw-fx-reveal').filter(ok);
  var pars=q('.rw-fx-parallax').filter(ok);
  /* موجة: المدة واحدة والتأخير يتدرج بين البطاقات المتجاورة، فتتحرك كموجة واضحة دون أن تتراكب */
  floats.forEach(function(el,i){var big=el.offsetHeight>420||!!el.querySelector('input,textarea,select,table');el.style.setProperty('--fx-dur','5.2s');el.style.setProperty('--fx-delay',(-(i*0.65)).toFixed(2)+'s');el.style.setProperty('--fx-amp',big?'6px':'11px');el.style.setProperty('--fx-rot',big?'0deg':(i%2?'0.7deg':'-0.7deg'));el.style.setProperty('--fx-enter',Math.min(i,8)*0.07+'s');});
  reveals.forEach(function(el,i){el.style.setProperty('--fx-stagger',((i%6)*0.06).toFixed(2)+'s');});
  var vis=new Set(),raf=0,pend=new Map(),cleanups=[];
  function active(list,n){return list.filter(function(e){return vis.has(e);}).slice(0,n);}
  function refresh(){
   var t3=active(tilts,3);tilts.forEach(function(e){e._rwOn=t3.indexOf(e)>-1;});
   var g2=active(glass,2);glass.forEach(function(e){e.classList.toggle('rw-fx-glass-off',vis.has(e)?g2.indexOf(e)<0:false);});
  }
  var io=new IntersectionObserver(function(es){es.forEach(function(en){
   var el=en.target;if(en.isIntersecting)vis.add(el);else vis.delete(el);
   el.classList.toggle('is-offscreen',!en.isIntersecting);
   if(el.classList.contains('rw-fx-reveal'))el.classList.toggle('is-in',en.isIntersecting);
  });refresh();pschedule();},{threshold:0.12});
  floats.concat(tilts,glass,reveals,pars).forEach(function(el){io.observe(el);});
  var praf=0;
  function pframe(){praf=0;var h=window.innerHeight;pars.forEach(function(el){if(!vis.has(el))return;var r=el.getBoundingClientRect(),d=parseFloat(el.getAttribute('data-depth')||'0.12');var off=(r.top+r.height/2-h/2)*d*-1;off=Math.max(-70,Math.min(70,off));el.style.setProperty('--py',off.toFixed(1)+'px');});}
  function pschedule(){if(pars.length&&!praf)praf=requestAnimationFrame(pframe);}
  if(pars.length){window.addEventListener('scroll',pschedule,{passive:true});window.addEventListener('resize',pschedule);cleanups.push(function(){window.removeEventListener('scroll',pschedule);window.removeEventListener('resize',pschedule);if(praf)cancelAnimationFrame(praf);pars.forEach(function(el){el.style.removeProperty('--py');});});}
  function frame(){raf=0;pend.forEach(function(p,el){
   if(p.leave){el.style.removeProperty('--rx');el.style.removeProperty('--ry');el.classList.remove('is-tilting');return;}
   var r=el.getBoundingClientRect(),px=(p.x-r.left)/r.width,py=(p.y-r.top)/r.height,mx=el.querySelector('button,.rw-btn')?3:6;
   px=Math.max(0,Math.min(1,px));py=Math.max(0,Math.min(1,py));
   el.style.setProperty('--rx',(-(py-0.5)*2*mx).toFixed(2)+'deg');el.style.setProperty('--ry',((px-0.5)*2*mx).toFixed(2)+'deg');
   el.style.setProperty('--gx',(px*100).toFixed(1)+'%');el.style.setProperty('--gy',(py*100).toFixed(1)+'%');el.classList.add('is-tilting');
  });pend.clear();}
  function sched(){if(!raf)raf=requestAnimationFrame(frame);}
  tilts.forEach(function(el){
   var mv=function(e){if(e.pointerType!=='mouse'||!el._rwOn)return;pend.set(el,{x:e.clientX,y:e.clientY});sched();};
   var lv=function(e){if(e.pointerType!=='mouse')return;pend.set(el,{leave:true});sched();};
   el.addEventListener('pointermove',mv);el.addEventListener('pointerleave',lv);
   cleanups.push(function(){el.removeEventListener('pointermove',mv);el.removeEventListener('pointerleave',lv);['--rx','--ry','--gx','--gy'].forEach(function(k){el.style.removeProperty(k);});el.classList.remove('is-tilting');});
  });
  /* المؤشر الزجاجي: اختياري عبر data-rw-cursor على <html>، للماوس فقط، ولا يحجب المؤشر الأصلي */
  var fine=false;try{fine=window.matchMedia('(pointer: fine)').matches;}catch(e){}
  if(de.hasAttribute('data-rw-cursor')&&fine){
   var cur=document.createElement('div');cur.className='rw-cursor';cur.setAttribute('aria-hidden','true');document.body.appendChild(cur);
   var cx=0,cy=0,cs=1,craf=0,state='';
   var cframe=function(){craf=0;cur.style.transform='translate3d('+(cx-20).toFixed(1)+'px,'+(cy-20).toFixed(1)+'px,0) scale('+cs.toFixed(2)+')';};
   var cmove=function(e){if(e.pointerType&&e.pointerType!=='mouse')return;var t=e.target&&e.target.closest?e.target:null;
    if(t&&t.closest('[data-fx="off"]')){cur.classList.remove('is-on');return;}
    var hot=t&&t.closest(HOT);cx=e.clientX;cy=e.clientY;cs=1;
    if(hot&&!hot.disabled){var r=hot.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;cs=Math.max(1.4,Math.min(5,Math.max(r.width,r.height)/36));cur.classList.add('is-engulf');}else cur.classList.remove('is-engulf');
    cur.classList.add('is-on');if(!craf)craf=requestAnimationFrame(cframe);};
   var cleave=function(){cur.classList.remove('is-on');};
   document.addEventListener('pointermove',cmove,{passive:true});document.documentElement.addEventListener('pointerleave',cleave);
   cleanups.push(function(){document.removeEventListener('pointermove',cmove);document.documentElement.removeEventListener('pointerleave',cleave);if(craf)cancelAnimationFrame(craf);cur.remove();});
  }
  Motion._stop=function(){io.disconnect();if(raf)cancelAnimationFrame(raf);cleanups.forEach(function(f){f();});
   floats.forEach(function(el){['--fx-dur','--fx-delay','--fx-amp','--fx-rot','--fx-enter'].forEach(function(k){el.style.removeProperty(k);});el.classList.remove('is-offscreen');});
   reveals.forEach(function(el){el.style.removeProperty('--fx-stagger');el.classList.remove('is-in');});
   glass.forEach(function(el){el.classList.remove('rw-fx-glass-off');});};
 }
};

export { Motion, reduced };
