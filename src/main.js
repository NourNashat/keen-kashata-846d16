import manifest from "virtual:content-manifest";
import "./style.css";
import { loadLesson } from "./content.js";
import { ICO } from "./icons.js";

const BOOKS=manifest.books;
const LESSONS=BOOKS.flatMap(b=>b.lessons);
const bookOf=id=>BOOKS.find(b=>b.id===id);

const state={book:null,lesson:null,period:0,test:false,term:"",answers:{},saved:false,wrong:false,exam:null,gx:null,gxv:false};
const LET=["أ","ب","ج","د"];
/* ---------- v6: تقدم الطالب + الاختبارات ---------- */
const SEEN=new Set(),WRONG=new Set();
const fmt=s=>{s=Math.max(0,Math.round(s));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
function loadExtra(){try{state.gx=JSON.parse(LS.get("cq-gx")||"null");}catch(_){}try{JSON.parse(LS.get("cq-seen")||"[]").forEach(k=>SEEN.add(k));JSON.parse(LS.get("cq-wrong")||"[]").forEach(k=>WRONG.add(k))}catch(_){}}
const seenOf=l=>{let n=0;SEEN.forEach(k=>{if(k.startsWith(l.id+"-"))n++});return n};
const lpct=l=>{const c=counts(l),t=c.e+c.m;return t?Math.min(100,Math.round(seenOf(l)/t*100)):0};
function bstat(b){let q=0,s=0;b.lessons.forEach(l=>{const c=counts(l);q+=c.e+c.m;s+=Math.min(seenOf(l),c.e+c.m)});return{q,s,p:q?Math.round(s/q*100):0}}
const pbar=p=>`<div class="pbw"><div class="pb" role="img" aria-label="الإنجاز ${p}%"><i style="width:${p}%"></i></div><span class="pp">${p}%</span></div>`;
const stOf=p=>p>=100?["done","✓ مكتمل"]:p===0?["","جديد"]:["prog","قيد الدراسة"];
const XMARK=`<svg class="m" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
function visOf(l){const v=[];l.secs.forEach((s,si)=>{if(state.period&&s.p!==state.period)return;s.m.forEach((m,i)=>v.push({k:`${l.id}-${si}-${i}`,c:m.c,q:m.q,o:m.o,n:v.length+1}))});return v}
const examLive=()=>!!(state.test&&state.exam&&!state.exam.finished);
const examDone=()=>!!(state.test&&state.exam&&state.exam.finished);
const limitFor=n=>Math.max(5,Math.ceil(n*.8))*60;
function initExam(l){const n=visOf(l).length,on=LS.get("cq-timer")!=="0";
  state.exam={l:l.id,start:Date.now(),limit:on?limitFor(n):0,finished:false,warn:false,rv:"all"};saveState()}
function finishExam(){
  const X=state.exam,l=lessonOf(state.lesson);if(!X||X.finished||!l)return;
  X.finished=true;X.end=Date.now();X.warn=false;
  visOf(l).forEach(v=>{const a=state.answers[v.k],sk=v.k.replace(/-(\d+)$/,"-m$1");
    if(a===v.c)WRONG.delete(sk);else if(a!==undefined){WRONG.add(sk);STAR.add(sk)}});
  saveStars();LS.set("cq-wrong",JSON.stringify([...WRONG]));saveState();render();scrollTo({top:0,behavior:"instant"})}
function toast(t){const o=document.querySelector(".toast");if(o)o.remove();const d=document.createElement("div");d.className="toast";d.setAttribute("role","status");d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),6000)}
function safePrint(done){let ok=false;const mark=()=>{ok=true};addEventListener("beforeprint",mark,{once:true});
  try{window.print()}catch(_){}
  setTimeout(()=>{removeEventListener("beforeprint",mark);if(!ok){toast("الطباعة محجوبة في وضع المعاينة. افتح الملف في المتصفح مباشرة ثم اضغط الزر، أو استخدم Ctrl+P.");if(done)done()}},700)}
function printResult(){document.body.classList.add("print-result");const un=()=>document.body.classList.remove("print-result");addEventListener("afterprint",un,{once:true});setTimeout(()=>safePrint(un),80)}
function startExam(){
  const p=(LS.get("cq-last")||"").split("/");let b=bookOf(p[0]),l=b&&b.lessons.find(x=>x.id===p[1]);
  if(!l){b=BOOKS.find(x=>x.lessons.length);l=b.lessons[0]}
  Object.keys(state.answers).forEach(k=>{if(k.startsWith(l.id+"-"))delete state.answers[k]});
  state.test=true;state.exam=null;saveState();applyMode();go(b.id,l.id)}

/* ---------- اختبار عام عشوائي ---------- */
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function gxPick(n){
  const nM=Math.round(n*2/3),nE=n-nM;
  const pools=LESSONS.map(l=>{const m=[],e=[];l.meta.forEach((s,si)=>{for(let i=0;i<s.m;i++)m.push(`${l.id}-${si}-m${i}`);for(let i=0;i<s.e;i++)e.push(`${l.id}-${si}-e${i}`)});return{m:shuf(m),e:shuf(e)}});
  const take=(t,k)=>{const out=[];let any=true;while(out.length<k&&any){any=false;for(const p of shuf(pools)){if(out.length>=k)break;if(p[t].length){out.push(p[t].pop());any=true}}}return out};
  return shuf([...take("m",nM),...take("e",nE)]);
}
function gxQ(k,n){const m=k.match(/^(.+?)-(\d+)-([me])(\d+)$/),l=lessonOf(m[1]),s=l.secs[+m[2]];
  return{k,n,t:m[3],it:(m[3]==="m"?s.m:s.e)[+m[4]],l,b:BOOKS.find(b=>b.lessons.includes(l))}}
const gxAll=()=>state.gx.keys.map((k,i)=>gxQ(k,i+1));
const gxAnswered=q=>{const g=state.gx;return q.t==="m"?g.ans[q.n]!==undefined:!!(g.txt[q.n]||"").trim()};
function gxStat(q){const g=state.gx;if(q.t==="m"){const a=g.ans[q.n];return a===undefined?"un":a===q.it.c?"ok":"wrong"}const s=g.self[q.n];return s===undefined?"un":s?"ok":"wrong"}
const saveGX=()=>LS.set("cq-gx",state.gx?JSON.stringify(state.gx):"");
function saveRev(){saveStars();LS.set("cq-wrong",JSON.stringify([...WRONG]))}
function startGX(n){
  const keys=gxPick(n),limit=keys.reduce((s,k)=>s+(/-m\d+$/.test(k)?60:120),0);
  state.gx={keys,ans:{},txt:{},self:{},start:Date.now(),limit,finished:false,warn:false,rv:"all"};saveGX();render();scrollTo({top:0,behavior:"instant"})}
function finishGX(){
  const g=state.gx;if(!g||g.finished)return;g.finished=true;g.end=Date.now();g.warn=false;
  gxAll().forEach(q=>{if(q.t!=="m")return;const s=gxStat(q),sk=q.k;if(s==="ok")WRONG.delete(sk);else if(s==="wrong"){WRONG.add(sk);STAR.add(sk)}});
  saveRev();saveGX();render();scrollTo({top:0,behavior:"instant"})}
function goGX(){state.book=null;state.lesson=null;state.period=0;state.saved=false;state.gxv=true;resetSearch();
  try{history.replaceState(null,"","#gx")}catch(_){}render();animate();scrollTo({top:0,behavior:"instant"})}
function gxCard(q){
  const g=state.gx,fin=g.finished,n=q.n,need=!fin&&g.warn&&!gxAnswered(q)?" need":"";
  const tag=`<span class="tag">${q.t==="m"?"اختيار من متعدد":"سؤال مقالي"}</span>`,src=fin?`<div class="where"><span>${q.b.no} › ${q.l.title}</span></div>`:"";
  if(q.t==="m"){
    const pk=g.ans[n];
    const opts=q.it.o.map((t,oi)=>{let cls="opt",mk=CHECK;
      if(fin){if(oi===q.it.c)cls+=" ok";else if(pk===oi){cls+=" bad";mk=XMARK}}else if(pk===oi)cls+=" sel";
      return `<button type="button" class="${cls}" data-gk="${n}" data-o="${oi}"${fin?" disabled":""}><span class="l">${LET[oi]}</span><span>${hl(t)}</span>${mk}</button>`}).join("");
    return `<article class="card${need}" id="g-${n}">${tag}${src}${qHead(n,q.it.q,q.k)}<div class="opts">${opts}</div>${fin&&q.it.w?`<div class="why"><b>التفسير:</b> ${hl(q.it.w)}</div>`:""}</article>`}
  const sf=g.self[n];
  return `<article class="card${need}" id="g-${n}">${tag}${src}${qHead(n,q.it.q,q.k)}<textarea class="gx-ta" data-gt="${n}" placeholder="اكتب إجابتك هنا (اختياري)…"${fin?" readonly":""}>${esc(g.txt[n]||"")}</textarea>`+
   (fin?`<details class="ans" open style="margin-top:var(--s-3)"><summary>الإجابة النموذجية</summary><div class="ans-body">${renderAns(q.it.a)}</div></details><div class="gx-self"><span>قيّم إجابتك:</span><button type="button" class="btn sm${sf===1?" primary":""}" data-self="${n}|1">✓ جاوبت صح</button><button type="button" class="btn sm${sf===0?" primary":""}" data-self="${n}|0">✗ محتاجة مراجعة</button></div>`:"")+`</article>`}
function renderGX(){
  renderNav();
  const cr=`<nav class="crumb" aria-label="مسار التنقل"><button type="button" data-home="1">كل الأبواب</button><span>›</span><b>اختبار عام</b></nav>`,g=state.gx;
  if(!g){
    const tm=LESSONS.reduce((n,l)=>n+counts(l).m,0),te=LESSONS.reduce((n,l)=>n+counts(l).e,0);
    const bt=[20,30,40].map(n=>{const nM=Math.round(n*2/3);return `<button type="button" class="btn gx-opt${n===30?" primary":""}" data-gxn="${n}"><b>${n} سؤال</b><span>${nM} اختيار من متعدد + ${n-nM} مقالي</span><span>⏱ ${nM+(n-nM)*2} دقيقة</span>${n===30?"<i>الأنسب</i>":""}</button>`}).join("");
    $("#main").innerHTML=`${cr}<header class="hero big"><div class="k">Mock Exam</div><h2>اختبار عام عشوائي</h2><p>أسئلة بتتسحب عشوائيًا من كل الدروس في كل الأبواب، ثلثها اختيار من متعدد والباقي مقالي، مع عداد وقت. كل مرة هتاخد اختبار مختلف.</p><div class="kpis"><div class="kpi"><b>${tm}</b><span>سؤال موضوعي في البنك</span></div><div class="kpi"><b>${te}</b><span>سؤال مقالي في البنك</span></div><div class="kpi"><b>${LESSONS.length}</b><span>درس ممثَّل</span></div></div></header><div class="sub">اختار حجم الاختبار</div><p class="more" style="margin:0 0 var(--s-3);text-align:start">الوقت بيتحسب تلقائيًا: دقيقة لكل سؤال اختيار من متعدد، ودقيقتين لكل سؤال مقالي.</p><div class="qa">${bt}</div><p class="more">الإجابات النموذجية بتظهر بعد الإنهاء، والأسئلة المقالية بتقيّمها بنفسك.</p>`;return}
  const qs=gxAll(),fin=g.finished,un=qs.filter(q=>!gxAnswered(q)),done=qs.length-un.length,st=qs.map(gxStat);
  let head="",res="";
  if(!fin){
    const r=g.limit-Math.floor((Date.now()-g.start)/1000);
    head=`<section class="exam" aria-label="لوحة الاختبار العام"><div class="ex-row"><b>اختبار عام · تم حل ${done} من ${qs.length}</b><span class="ex-timer${r<300?" low":""}" id="gxTimer">${fmt(r)}</span></div><div class="pr-bar"><i style="width:${done/qs.length*100}%"></i></div><div class="qnav" role="group" aria-label="التنقل بين الأسئلة">${qs.map(q=>`<button type="button" class="qn${gxAnswered(q)?" done":""}" data-gg="${q.n}" aria-label="السؤال ${q.n}">${q.n}</button>`).join("")}</div>${g.warn?`<div class="ex-warn"><b>باقي ${un.length} سؤال بدون إجابة.</b><button type="button" class="btn sm" data-gxnext="1">راجعهم الأول</button><button type="button" class="btn sm" data-gxforce="1">أنهِ على أي حال</button></div>`:`<div class="ex-row"><button type="button" class="btn sm" data-gxnext="1"${un.length?"":" disabled"}>التالي غير المجاب (${un.length})</button><button type="button" class="btn primary sm" data-gxfin="1">إنهاء الاختبار</button></div>`}</section>`;
  }else{
    const c=s=>st.filter(x=>x===s).length,ok=c("ok"),wr=c("wrong"),u2=c("un"),pct=Math.round(ok/qs.length*100),secs=Math.round(((g.end||Date.now())-g.start)/1000);
    const mT=qs.filter(q=>q.t==="m").length,mOk=qs.filter((q,i)=>q.t==="m"&&st[i]==="ok").length,eT=qs.length-mT,eOk=qs.filter((q,i)=>q.t==="e"&&st[i]==="ok").length,eUn=qs.filter((q,i)=>q.t==="e"&&st[i]==="un").length;
    const gr=pct>=90?["ممتاز","أداء رائع، أنت جاهز."]:pct>=75?["جيد جدًا","مستواك جيد جدًا، راجع الأخطاء."]:pct>=60?["جيد","محتاج مراجعة بسيطة."]:["تحتاج إلى مراجعة","راجع الحلول النموذجية وجرّب اختبار جديد."];
    const rvC=[["all","الكل",qs.length],["wrong","الخاطئة",wr],["un","غير المجابة/المُقيَّمة",u2],["ok","الصحيحة",ok]].map(([v,t,n])=>`<button type="button" class="chip" data-gxrv="${v}" aria-pressed="${g.rv===v}">${t} (${n})</button>`).join("");
    const sum=qs.filter((q,i)=>st[i]!=="ok").map(q=>q.t==="m"?`<li><b>${q.n}. ${esc(q.it.q)}</b><br>إجابتك: ${g.ans[q.n]===undefined?"لم تُجب":esc(q.it.o[g.ans[q.n]])} — الصحيحة: ${esc(q.it.o[q.it.c])}</li>`:`<li><b>${q.n}. ${esc(q.it.q)}</b> (مقالي — راجع الإجابة النموذجية)</li>`).join("");
    res=`<section class="result" id="result"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div><div class="res-t"><h3>${gr[0]}</h3><p>${gr[1]}</p><div class="rs"><div><b>${ok}</b><span>صحيحة</span></div><div><b>${wr}</b><span>خاطئة</span></div><div><b>${u2}</b><span>بدون إجابة/تقييم</span></div><div><b>${fmt(secs)}</b><span>الوقت</span></div></div><p class="res-n">اختيار: ${mOk}/${mT} · مقالي: ${eOk}/${eT} (تقييم ذاتي)</p>${eUn?`<p>قيّم ${eUn} سؤال مقالي بنفسك علشان النتيجة تكتمل.</p>`:""}</div><div class="res-a"><button type="button" class="btn primary" data-gxnew="1">اختبار عام جديد</button><button type="button" class="btn" data-export="1">تصدير النتيجة PDF</button></div></section><div class="chips rv" role="group" aria-label="مراجعة الاختبار">${rvC}</div><section class="print-sum"><h3>اختبار عام — أسئلة تحتاج مراجعة</h3><ol>${sum||"<li>إجابات صحيحة بالكامل</li>"}</ol></section>`;
  }
  const cards=qs.filter((q,i)=>!fin||g.rv==="all"||st[i]===g.rv).map(gxCard).join("");
  $("#main").innerHTML=`${cr}<header class="hero"><div><div class="k">اختبار عام</div><h2>${qs.length} سؤال عشوائي من كل الأبواب</h2></div><div class="stats"><div class="stat"><b>${qs.filter(q=>q.t==="m").length}</b><span>اختيار</span></div><div class="stat"><b>${qs.filter(q=>q.t==="e").length}</b><span>مقالي</span></div></div></header>${res}${head}<div class="cards" style="margin-top:var(--s-4)">${cards}</div>`;
}
setInterval(()=>{const g=state.gx,el=$("#gxTimer");if(!el||!g||g.finished)return;const r=g.limit-Math.floor((Date.now()-g.start)/1000);if(r<=0){finishGX();return}el.textContent=fmt(r);el.classList.toggle("low",r<300)},1000);
document.addEventListener("input",e=>{const t=e.target.closest&&e.target.closest("[data-gt]");if(t&&state.gx&&!state.gx.finished){state.gx.txt[t.dataset.gt]=t.value;saveGX()}});
let IO;
function observeCards(){
  if(!("IntersectionObserver" in window))return;
  if(!IO)IO=new IntersectionObserver(es=>{let ch=0;es.forEach(en=>{if(!en.isIntersecting)return;
    const s=en.target.querySelector("[data-star]");if(s&&!SEEN.has(s.dataset.star)){SEEN.add(s.dataset.star);ch=1}IO.unobserve(en.target)});
    if(ch)LS.set("cq-seen",JSON.stringify([...SEEN]))},{rootMargin:"-35% 0px -35% 0px"});
  IO.disconnect();document.querySelectorAll("#main .card").forEach(c=>IO.observe(c))}
setInterval(()=>{const X=state.exam,el=$("#examTimer");if(!el||!X||X.finished)return;
  const s=Math.floor((Date.now()-X.start)/1000);
  if(X.limit){const r=X.limit-s;if(r<=0){finishExam();return}el.textContent=fmt(r);el.classList.toggle("low",r<60)}else el.textContent=fmt(s)},1000);

const PNAME={1:"الفترة الأولى",2:"الفترة الثانية",3:"الفترة الثالثة"};
const TITLE="البرمجة مع نور نشأت";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const LS={get(k){try{return localStorage.getItem(k)}catch(_){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(_){}}};

/* ---------- text helpers ---------- */
function hl(s){
  let h=esc(s);
  if(state.term){const t=esc(state.term).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");h=h.replace(new RegExp("("+t+")","gi"),"<mark>$1</mark>")}
  return h;
}
function inline(s){return hl(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")}
/* markdown-lite renderer for model answers */
function renderAns(txt){
  const lines=txt.split("\n");let out="",i=0;
  const flush=(t,items)=>{if(items.length)out+=`<${t}>`+items.map(x=>`<li>${inline(x)}</li>`).join("")+`</${t}>`};
  while(i<lines.length){
    const L=lines[i];
    if(L.startsWith("|")){
      const rows=[];while(i<lines.length&&lines[i].startsWith("|")){rows.push(lines[i].slice(1).split("|"));i++}
      out+=`<div class="tbl"><table><thead><tr>${rows[0].map(c=>`<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;continue}
    if(L.startsWith("=")){out+=`<div class="eq">${inline(L.slice(1))}</div>`;i++;continue}
    if(/^- /.test(L)){const it=[];while(i<lines.length&&/^- /.test(lines[i])){it.push(lines[i].slice(2));i++}flush("ul",it);continue}
    if(/^\d+\. /.test(L)){
      /* numbered list; nested "- " bullets after an item attach to that item */
      const it=[];
      while(i<lines.length&&/^\d+\. /.test(lines[i])){
        let t=lines[i].replace(/^\d+\. /,"");i++;
        let sub=[];while(i<lines.length&&/^- /.test(lines[i])){sub.push(lines[i].slice(2));i++}
        it.push({t,sub});
      }
      out+="<ol>"+it.map(x=>`<li>${inline(x.t)}${x.sub.length?"<ul>"+x.sub.map(s=>`<li>${inline(s)}</li>`).join("")+"</ul>":""}</li>`).join("")+"</ol>";continue}
    if(L.trim()){out+=`<p>${inline(L)}</p>`}
    i++;
  }
  return out;
}
const CHECK=`<svg class="m" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

function matches(item){
  if(!state.term)return true;
  const t=state.term.toLowerCase();
  const hay=item.m?[item.q,...item.o,item.w].join(" "):item.q+" "+item.a.replace(/[|*=]/g," ");
  return hay.toLowerCase().includes(t);
}
const lessonOf=id=>LESSONS.find(l=>l.id===id);
const counts=l=>l.counts;
const secTitle=s=>s.p===3?`التقييمات الأسبوعية · ${s.t}`:s.t;
function tileCount(b){const n=b.lessons.length;return n?n+" دروس":"قريبًا"}

/* ---------- saved questions (⭐) ---------- */
/* key: <lessonId>-<sectionIndex>-e<i> للمقالي  |  <lessonId>-<sectionIndex>-m<i> للموضوعي */
const STAR=new Set();
function loadStars(){try{JSON.parse(LS.get("cq-stars")||"[]").forEach(k=>STAR.add(k))}catch(_){}}
function saveStars(){LS.set("cq-stars",JSON.stringify([...STAR]))}
const STAR_SVG=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.6z"/></svg>`;
const starLabel=on=>on?"إزالة السؤال من المحفوظة":"حفظ السؤال للمراجعة لاحقًا";
const starBtn=k=>{const on=STAR.has(k);return `<button type="button" class="star" data-star="${k}" aria-pressed="${on}" aria-label="${starLabel(on)}">${STAR_SVG}</button>`};
function toggleStar(k){
  STAR.has(k)?STAR.delete(k):STAR.add(k);saveStars();
  const on=STAR.has(k);
  document.querySelectorAll(`[data-star="${CSS.escape(k)}"]`).forEach(b=>{b.setAttribute("aria-pressed",on);b.setAttribute("aria-label",starLabel(on))});
  const sn=document.getElementById("savedN");if(sn)sn.textContent=STAR.size;
  updateBadges();
}
function updateBadges(){document.querySelectorAll("[data-badge]").forEach(b=>{b.textContent=STAR.size;b.hidden=!STAR.size})}

/* ---------- question cards (مشتركة بين الدرس والبحث والمحفوظة) ---------- */
const qHead=(num,text,k)=>`<div class="q">${num?`<span class="num">${num}</span>`:""}<p>${hl(text)}</p>${starBtn(k)}</div>`;
const whereRow=c=>`<div class="where"><span>${esc(c.text)}</span><button type="button" class="link" data-gl="${c.b}|${c.l}">فتح الدرس</button></div>`;
const cardOpen=(c,id,x)=>`<article class="card${x?" "+x:""}"${id?` id="q-${id}"`:""}${c?` data-bk="${c.b}"`:""}>${c?whereRow(c):""}`;
function essayCard(e,k,num,ctx){
  return `${cardOpen(ctx)}${qHead(num,e.q,k)}<details class="ans"${ctx||!state.test||examDone()?" open":""}><summary>الإجابة النموذجية</summary><div class="ans-body">${renderAns(e.a)}</div></details></article>`;
}
function mcqCard(m,o){
  let opts,reveal=true;
  const pk=o.ak?state.answers[o.ak]:undefined;
  if(o.ctx){
    opts=m.o.map((t,oi)=>`<div class="opt${oi===m.c?" ok":""}"><span class="l">${LET[oi]}</span><span>${hl(t)}</span>${oi===m.c?CHECK:""}</div>`).join("");
  }else{
    reveal=!state.test||examDone();
    opts=m.o.map((t,oi)=>{
      let cls="opt",mk=CHECK;
      if(reveal){if(oi===m.c)cls+=" ok";else if(pk===oi){cls+=" bad";mk=XMARK}}
      else if(pk===oi)cls+=" sel";
      return `<button type="button" class="${cls}" data-k="${o.ak}" data-o="${oi}"${reveal?" disabled":""} aria-pressed="${!reveal&&pk===oi}"><span class="l">${LET[oi]}</span><span>${hl(t)}</span>${mk}</button>`}).join("");
  }
  const need=examLive()&&state.exam.warn&&pk===undefined?"need":"";
  return `${cardOpen(o.ctx,o.ak,need)}${qHead(o.num,m.q,o.k)}<div class="opts">${opts}</div>${reveal&&m.w?`<div class="why"><b>التفسير:</b> ${hl(m.w)}</div>`:""}</article>`;
}

/* ---------- navigation chrome ---------- */
function renderNav(){
  const bk=bookOf(state.book);let html;
  if(!bk){
    html=BOOKS.map(b=>`<button type="button" class="lesson-btn" data-b="${b.id}" data-bk="${b.id}"><span class="n">${b.no}</span>${b.title?`<span class="t">${b.title}</span>`:""}<span class="c">${tileCount(b)}</span></button>`).join("");
    $("#railh").textContent="الأبواب";
  }else{
    html=`<button type="button" class="lesson-btn" data-home="1"><span class="t">→ كل الأبواب</span></button>`+
      `<button type="button" class="lesson-btn" data-b="${bk.id}" aria-current="${!state.lesson}"><span class="n">${bk.no}</span><span class="t">${bk.title||"كل الدروس"}</span></button>`+
      bk.lessons.map(l=>{const c=counts(l);return `<button type="button" class="lesson-btn" data-l="${l.id}" aria-current="${l.id===state.lesson}"><span class="n">${l.no}</span><span class="t">${l.title}</span><span class="c">${c.e} مقالي · ${c.m} موضوعي</span></button>`}).join("");
    $("#railh").textContent=bk.no;
  }
  $("#rail").innerHTML=html;$("#mnav").innerHTML=html;
}
function crumb(){
  const bk=bookOf(state.book);
  let h=`<nav class="crumb" aria-label="مسار التنقل"><button type="button" data-home="1">كل الأبواب</button>`;
  if(bk)h+=`<span>›</span><button type="button" data-b="${bk.id}">${bk.no}</button>`;
  if(state.lesson)h+=`<span>›</span><b>${lessonOf(state.lesson).title}</b>`;
  return h+`</nav>`;
}
const setAttr=(el,a,v)=>el&&el.setAttribute(a,v);
function syncChrome(){
  const bn=k=>document.querySelector(`#bnav [data-bn="${k}"]`);
  setAttr(bn("home"),"aria-current",!state.saved&&!state.term&&!state.gxv?"page":"false");
  setAttr(bn("saved"),"aria-current",state.saved?"page":"false");
  setAttr(bn("search"),"aria-pressed",!!state.term||document.body.classList.contains("search-open"));
  setAttr(bn("test"),"aria-pressed",state.gxv);
}

/* ---------- state persistence, mode ---------- */
function saveState(){LS.set("cq-state",JSON.stringify({test:state.test,answers:state.answers,exam:state.exam}))}
function loadState(){try{const o=JSON.parse(LS.get("cq-state")||"null");if(o&&o.answers&&typeof o.answers==="object"){state.answers=o.answers;state.test=!!o.test;state.exam=o.exam||null}}catch(_){}}
function applyMode(){const b=$("#mode");b.setAttribute("aria-pressed",state.test);b.querySelector(".lbl").textContent=state.test?"مراجعة":"اختبار"}
function toggleTest(){state.test=!state.test;state.answers={};state.exam=null;saveState();applyMode();render()}
function animate(){const m=$("#main");m.classList.remove("anim");void m.offsetWidth;m.classList.add("anim");setTimeout(()=>m.classList.remove("anim"),600)}
function setSearchOpen(on){document.body.classList.toggle("search-open",on);if(on)$("#q").focus();syncChrome()}
function resetSearch(){state.term="";$("#q").value="";document.body.classList.remove("search-open")}
function go(b,l){
  state.book=b;state.lesson=l;state.period=0;state.saved=false;state.gxv=false;resetSearch();
  try{history.replaceState(null,"","#"+(b?b+(l?"/"+l:""):""))}catch(_){}
  if(b&&l)LS.set("cq-last",b+"/"+l);
  render();animate();window.scrollTo({top:0,behavior:"instant"});
}
function goSaved(w){
  state.book=null;state.lesson=null;state.period=0;state.saved=true;state.gxv=false;state.wrong=!!w;resetSearch();
  try{history.replaceState(null,"",w?"#wrong":"#saved")}catch(_){}
  render();animate();window.scrollTo({top:0,behavior:"instant"});
}

/* ---------- المظهر وحجم الخط ---------- */
const PREFS=["auto","light","dark"];
const PREF_NAME={auto:"تلقائي (حسب الجهاز)",light:"فاتح",dark:"داكن"};
function setPref(p){
  const r=document.documentElement;r.dataset.pref=p;
  if(p==="auto")r.removeAttribute("data-theme");else r.dataset.theme=p;
  LS.set("cq-theme",p);
  const t=PREFS[(PREFS.indexOf(p)+1)%3];
  $("#theme").setAttribute("aria-label",`المظهر: ${PREF_NAME[p]}. اضغط للتغيير إلى ${PREF_NAME[t]}`);
  $("#theme").title=`المظهر: ${PREF_NAME[p]}`;
}
const FS=[1,1.15,1.3];let fsi=0;
function setFS(i){
  fsi=i;document.documentElement.style.setProperty("--fs",FS[i]);LS.set("cq-fs",FS[i]);
  $("#fontBtn").setAttribute("aria-label",`حجم الخط ${Math.round(FS[i]*100)}٪. اضغط للتغيير`);
  $("#fontBtn").title=`حجم الخط ${Math.round(FS[i]*100)}٪`;
}

/* ---------- views ---------- */
function renderLesson(){
  const l=lessonOf(state.lesson),c=counts(l);
  if(state.test&&(!state.exam||state.exam.l!==l.id))initExam(l);
  const vis=visOf(l),gmap={};vis.forEach(v=>gmap[v.k]=v.n);
  const X=state.test?state.exam:null,rv=X&&X.finished?X.rv:"all";
  let body="";
  l.secs.forEach((s,si)=>{
    if(state.period&&s.p!==state.period)return;
    const es=s.e.map((e,i)=>({e,i})).filter(x=>matches(x.e)&&rv==="all");
    const ms=s.m.map((m,i)=>({m:{...m,m:1},i})).filter(x=>matches(x.m)).filter(x=>{if(rv==="all")return true;const a=state.answers[`${l.id}-${si}-${x.i}`];return rv==="ok"?a===x.m.c:rv==="un"?a===undefined:(a!==undefined&&a!==x.m.c)});
    if(!es.length&&!ms.length)return;
    body+=`<section class="sec"><div class="sec-h"><span class="tag">${PNAME[s.p]}</span><h3>${secTitle(s)}</h3></div>`;
    if(es.length)body+=`<div class="sub">الأسئلة المقالية</div><div class="cards">`+es.map(x=>essayCard(x.e,`${l.id}-${si}-e${x.i}`,x.i+1)).join("")+`</div>`;
    if(ms.length)body+=`<div class="sub">الأسئلة الموضوعية (اختيار من متعدد)</div><div class="cards">`+ms.map(x=>mcqCard(x.m,{k:`${l.id}-${si}-m${x.i}`,ak:`${l.id}-${si}-${x.i}`,num:state.test?(gmap[`${l.id}-${si}-${x.i}`]||x.i+1):x.i+1})).join("")+`</div>`;
    body+=`</section>`;
  });
  if(!body)body=`<div class="empty">لا توجد نتائج مطابقة لبحثك.</div>`;
  /* review table after last lesson */
  let review="";
  const RV=l.review||null;
  if(RV&&!state.term&&!state.period){
    review=`<section class="sec"><div class="sec-h"><span class="tag">مراجعة</span><h3>ملاحظات علمية مهمة للمراجعة</h3></div>
    <p style="margin:0 0 var(--s-3);color:var(--muted)">تفرق هذه النقاط بين المفاهيم المتشابهة التي تكررت في التقييمات.</p>
    <div class="tbl plain"><table><thead><tr>${RV.split("\n")[0].slice(1).split("|").map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${RV.split("\n").slice(1).map(r=>`<tr>${r.slice(1).split("|").map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  }
  const chips=[[0,"الكل"],[1,"الفترة الأولى"],[2,"الفترة الثانية"],[3,"الفترة الثالثة"]].map(([v,t])=>`<button type="button" class="chip" data-p="${v}" aria-pressed="${state.period===v}">${t}</button>`).join("");
  const un=vis.filter(v=>state.answers[v.k]===undefined),done=vis.length-un.length,okc=vis.filter(v=>state.answers[v.k]===v.c).length,pct=vis.length?Math.round(okc/vis.length*100):0;
  let progressHTML="";
  if(X&&!X.finished&&vis.length){
    const el=Math.floor((Date.now()-X.start)/1000);
    progressHTML=`<section class="exam" id="exam" aria-label="لوحة الاختبار"><div class="ex-row"><b>وضع الاختبار · تم حل ${done} من ${vis.length}</b><span class="ex-row"><span class="ex-timer${X.limit&&X.limit-el<60?" low":""}" id="examTimer">${fmt(X.limit?X.limit-el:el)}</span><button type="button" class="btn sm" data-timer="1">${X.limit?"إيقاف العداد":"تشغيل العداد"}</button></span></div>
    <div class="pr-bar"><i style="width:${done/vis.length*100}%"></i></div>
    <div class="qnav" role="group" aria-label="التنقل بين الأسئلة">${vis.map(v=>`<button type="button" class="qn${state.answers[v.k]!==undefined?" done":""}" data-go="${v.k}" aria-label="السؤال ${v.n}">${v.n}</button>`).join("")}</div>
    ${X.warn?`<div class="ex-warn"><b>باقي ${un.length} سؤال بدون إجابة.</b><button type="button" class="btn sm" data-nextun="1">راجعهم الأول</button><button type="button" class="btn sm" data-finish-force="1">أنهِ على أي حال</button></div>`:`<div class="ex-row"><button type="button" class="btn sm" data-nextun="1"${un.length?"":" disabled"}>التالي غير المجاب (${un.length})</button><button type="button" class="btn primary sm" data-finish="1">إنهاء الاختبار</button></div>`}</section>`;
  }
  const actionsHTML=`<div class="actions"><button type="button" class="btn" data-print="1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg><span>طباعة / حفظ PDF</span></button></div>`;
  let resultHTML="";
  if(X&&X.finished&&vis.length){
    const wr=done-okc,secs=Math.round(((X.end||Date.now())-X.start)/1000);
    const g=pct>=90?["ممتاز","أداء رائع، أنت متمكن من هذا الدرس."]:pct>=75?["جيد جدًا","مستواك جيد جدًا، راجع الأسئلة التي أخطأت فيها."]:pct>=60?["جيد","مستواك جيد، يحتاج إلى مراجعة بسيطة."]:["تحتاج إلى مراجعة","راجع الحل النموذجي ثم أعد المحاولة."];
    const rvC=[["all","الكل",vis.length],["wrong","الخاطئة",wr],["un","غير المجابة",un.length],["ok","الصحيحة",okc]].map(([v,t,n])=>`<button type="button" class="chip" data-rv="${v}" aria-pressed="${X.rv===v}">${t} (${n})</button>`).join("");
    const sum=vis.filter(v=>state.answers[v.k]!==v.c).map(v=>{const a=state.answers[v.k];return `<li><b>${v.n}. ${esc(v.q)}</b><br>إجابتك: ${a===undefined?"لم تُجب":esc(v.o[a])} — الصحيحة: ${esc(v.o[v.c])}</li>`}).join("");
    resultHTML=`<section class="result" id="result"><div class="ring" style="--p:${pct}"><b>${pct}%</b></div><div class="res-t"><h3>${g[0]}</h3><p>${g[1]}</p><div class="rs"><div><b>${okc}</b><span>صحيحة</span></div><div><b>${wr}</b><span>خاطئة</span></div><div><b>${un.length}</b><span>بدون إجابة</span></div><div><b>${fmt(secs)}</b><span>الوقت</span></div></div><p class="res-n">الأسئلة الخاطئة اتضافت تلقائيًا لقائمة المراجعة.</p></div><div class="res-a"><button type="button" class="btn primary" data-retry="1">إعادة المحاولة</button><button type="button" class="btn" data-export="1">تصدير النتيجة PDF</button></div></section><div class="chips rv" role="group" aria-label="مراجعة الاختبار">${rvC}</div><section class="print-sum"><h3>أسئلة تحتاج مراجعة — ${esc(l.title)}</h3><ol>${sum||"<li>أجبت عن كل الأسئلة بشكل صحيح</li>"}</ol></section>`;
  }
  const bkx=bookOf(state.book),idx=bkx.lessons.findIndex(x=>x.id===l.id),nx=bkx.lessons[idx+1],pv=bkx.lessons[idx-1];
  const navHTML=`<nav class="lesson-nav" aria-label="التنقل بين الدروس">${pv?`<button type="button" class="btn" data-l="${pv.id}">→ الدرس السابق: ${pv.title}</button>`:"<span></span>"}${nx?`<button type="button" class="btn primary" data-l="${nx.id}">الدرس التالي: ${nx.title} ←</button>`:`<button type="button" class="btn" data-b="${bkx.id}">العودة إلى دروس ${bkx.no}</button>`}</nav>`;
  $("#main").innerHTML=`${crumb()}<header class="hero"><div><div class="k">${bkx.no} · ${l.no}</div><h2>${l.title}</h2></div>
    <div class="stats"><div class="stat"><b>${c.e}</b><span>مقالي</span></div><div class="stat"><b>${c.m}</b><span>موضوعي</span></div><div class="stat"><b>${lpct(l)}%</b><span>إنجاز</span></div></div></header>
    <div class="chips" role="group" aria-label="تصفية حسب الفترة">${chips}</div>${resultHTML}${progressHTML}${actionsHTML}${body}${review}${navHTML}`;
  renderNav();
}

function tileBook(b){
  const s=bstat(b),soon=!b.lessons.length,st=soon?["soon","قريبًا"]:stOf(s.p);
  return `<button type="button" class="tile has-ico${soon?" soon":""}" data-b="${b.id}" data-bk="${b.id}"><span class="ico">${ICO[b.id]}</span><span class="tn">${b.no}</span><span class="st ${st[0]}">${st[1]}</span>${b.title?`<span class="tt">${b.title}</span>`:""}<span class="tc">${soon?"سيتم إضافة الحلول قريبًا":`${b.lessons.length} دروس · ${s.q} سؤال`}</span>${soon?"":pbar(s.p)}</button>`}
function renderHome(){
  renderNav();
  const bk=bookOf(state.book);
  if(!bk){
    const nl=BOOKS.reduce((n,b)=>n+b.lessons.length,0),tq=BOOKS.reduce((n,b)=>n+bstat(b).q,0),ts=BOOKS.reduce((n,b)=>n+bstat(b).s,0),p=tq?Math.round(ts/tq*100):0;
    const lp=(LS.get("cq-last")||"").split("/"),lb=bookOf(lp[0]),ll=lb&&lb.lessons.find(x=>x.id===lp[1]),fb=BOOKS.find(x=>x.lessons.length);
    const tb=ll?lb:fb,tl=ll?ll:fb.lessons[0];
    $("#main").innerHTML=`<header class="hero big"><div class="k">منصة تعليمية</div><h2>أهلاً بيك في منصة البرمجة مع نور نشأت</h2><p>كل التقييمات والحلول في مكان واحد، ذاكر وراجع واختبر نفسك.</p>
      <div class="kpis"><div class="kpi"><b>${tq}</b><span>إجمالي الأسئلة</span></div><div class="kpi"><b>${nl}</b><span>الدروس المتاحة</span></div><div class="kpi"><b>${STAR.size}</b><span>الأسئلة المحفوظة</span></div></div></header>
      <div class="dash"><section class="panel cont"><div class="k">${ll?"أكمل التعلّم من حيث توقفت":"ابدأ رحلتك"}</div><div class="ct">${tl.title}</div><div class="k">${tb.no} · ${tl.no}</div>${pbar(lpct(tl))}<button type="button" class="btn primary" style="margin-top:var(--s-3)" data-gl="${tb.id}|${tl.id}">${ll?"أكمل الدرس":"ابدأ أول درس"} ←</button></section>
      <section class="panel ovw"><div class="ring sm" style="--p:${p}"><b>${p}%</b></div><div><h3>نسبة الإنجاز الإجمالية</h3><div class="k">شاهدت ${ts} من ${tq} سؤال</div></div></section></div>
      <section class="panel promo"><div><div class="k">جديد</div><h3>اختبار عام عشوائي</h3><p>30 سؤال مختلطين من كل الدروس والأبواب (اختيار من متعدد + مقالي) بعداد وقت، وكل مرة اختبار مختلف.</p></div><button type="button" class="btn primary" data-qa="gx">${state.gx&&!state.gx.finished?"تابع الاختبار العام":"ابدأ الاختبار العام"} ←</button></section>
      <div class="sub">إجراءات سريعة</div>
      <div class="qa"><button type="button" class="btn" data-qa="exam">بدء اختبار على درس</button><button type="button" class="btn" data-qa="gx">اختبار عام عشوائي</button><button type="button" class="btn" data-qa="saved">الأسئلة المحفوظة (${STAR.size})</button><button type="button" class="btn" data-qa="wrong">مراجعة الأخطاء (${WRONG.size})</button></div>
      <div class="sub">الأبواب</div>
      <div class="grid">${BOOKS.map(tileBook).join("")}</div>`;
    return;
  }
  const tq=bk.lessons.reduce((n,l)=>{const c=counts(l);return n+c.e+c.m},0);
  let body;
  if(bk.lessons.length){
    body=`<div class="sub">اختر الدرس</div><div class="grid">${bk.lessons.map(l=>{const c=counts(l),p=lpct(l),st=stOf(p);return `<button type="button" class="tile" data-l="${l.id}"><span class="tn">${l.no}</span><span class="st ${st[0]}">${st[1]}</span><span class="tt">${l.title}</span><span class="tc">${c.e} مقالي · ${c.m} موضوعي</span>${pbar(p)}</button>`}).join("")}</div>`;
  }else body=`<div class="soon-box">قريبًا — سيتم إضافة حلول هذا الباب</div>`;
  $("#main").innerHTML=`${crumb()}<header class="hero"><div class="hl"><span class="hico">${ICO[bk.id]}</span><div><div class="k">${bk.no}</div><h2>${bk.title||bk.no}</h2></div></div>
    <div class="stats"><div class="stat"><b>${bk.lessons.length}</b><span>دروس</span></div><div class="stat"><b>${tq}</b><span>سؤال</span></div><div class="stat"><b>${bstat(bk).p}%</b><span>إنجاز</span></div></div></header>${body}`;
}

function renderSearch(){
  renderNav();
  const MAX=60;let n=0,shown=0,html="";
  BOOKS.forEach(b=>b.lessons.forEach(l=>(l.secs||[]).forEach((sec,si)=>{
    const items=[
      ...sec.e.map((e,i)=>({it:e,k:`${l.id}-${si}-e${i}`})),
      ...sec.m.map((m,i)=>({it:{...m,m:1},k:`${l.id}-${si}-m${i}`}))
    ].filter(x=>matches(x.it));
    items.forEach(({it,k})=>{
      n++;if(shown>=MAX)return;shown++;
      const ctx={b:b.id,l:l.id,text:`${b.no} › ${l.title} · ${PNAME[sec.p]} · ${secTitle(sec)}`};
      html+=it.m?mcqCard(it,{k,ctx}):essayCard(it,k,0,ctx);
    });
  })));
  $("#main").innerHTML=`<nav class="crumb"><button type="button" data-home="1">كل الأبواب</button><span>›</span><b>نتائج البحث</b></nav>
    <header class="hero"><div><h2>«<bdi>${esc(state.term)}</bdi>»</h2></div><div class="stats"><div class="stat"><b>${n}</b><span>نتيجة</span></div></div></header>
    ${n?`<div class="cards" style="margin-top:var(--s-5)">${html}</div>${n>MAX?`<p class="more">يتم عرض أول ${MAX} نتيجة. اكتب كلمات أدق لتضييق البحث.</p>`:""}`:`<div class="soon-box">لا توجد نتائج مطابقة لبحثك.</div>`}`;
}

function renderSaved(){
  renderNav();
  let n=0,html="";
  BOOKS.forEach(b=>b.lessons.forEach(l=>{
    let part="";
    (l.secs||[]).forEach((s,si)=>{
      const ctx={b:b.id,l:l.id,text:`${PNAME[s.p]} · ${secTitle(s)}`};
      s.e.forEach((e,i)=>{const k=`${l.id}-${si}-e${i}`;if(STAR.has(k)&&(!state.wrong||WRONG.has(k))){n++;part+=essayCard(e,k,0,ctx)}});
      s.m.forEach((m,i)=>{const k=`${l.id}-${si}-m${i}`;if(STAR.has(k)&&(!state.wrong||WRONG.has(k))){n++;part+=mcqCard({...m,m:1},{k,ctx})}});
    });
    if(part)html+=`<section class="sec" data-bk="${b.id}"><div class="sec-h"><span class="tag">${b.no}</span><h3>${l.title}</h3></div><div class="cards">${part}</div></section>`;
  }));
  const star=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.6z"/></svg>`;
  $("#main").innerHTML=`<nav class="crumb"><button type="button" data-home="1">كل الأبواب</button><span>›</span><b>${state.wrong?"مراجعة الأخطاء":"الأسئلة المحفوظة"}</b></nav>
    <header class="hero"><div><h2>${state.wrong?"مراجعة الأخطاء":"الأسئلة المحفوظة"}</h2></div><div class="stats"><div class="stat"><b id="savedN">${n}</b><span>سؤال</span></div></div></header>`+
    (n?`<div class="actions"><button type="button" class="btn" data-clearstars="1">إزالة الكل</button></div>${html}`
      :`<div class="soon-box">لا توجد أسئلة محفوظة بعد.<br>اضغط على علامة النجمة ${star} بجوار أي سؤال لتجده هنا وقت المراجعة.</div>`);
}

function layout(){const solo=!!state.term||state.saved||!state.lesson;$(".shell").classList.toggle("solo",solo);$("#mnav").hidden=solo}
function draw(){
  layout();
  if(state.term)return renderSearch();
  if(state.gxv)return renderGX();
  if(state.saved)return renderSaved();
  if(state.lesson)return renderLesson();
  renderHome();
}
/* ---------- تحميل كسول للدروس ---------- */
const KEY=/^(.+?)-\d+-[me]\d+$/;
const lessonsOfKeys=ks=>[...new Set(ks.map(k=>(k.match(KEY)||[])[1]))].map(lessonOf).filter(Boolean);
function needed(){
  if(state.term)return LESSONS;
  if(state.gxv)return state.gx?lessonsOfKeys(state.gx.keys):[];
  if(state.saved)return lessonsOfKeys([...STAR]);
  if(state.lesson)return[lessonOf(state.lesson)];
  return[];
}
const fill=l=>loadLesson(l).then(d=>{l.secs=d.secs;l.review=d.review});
let loadErr=false,renderTok=0;
function render(){
  const tok=++renderTok;
  if(state.book)document.body.dataset.bk=state.book;else delete document.body.dataset.bk;
  const miss=needed().filter(l=>!l.secs);
  if(miss.length){
    layout();renderNav();syncChrome();updateBadges();
    $("#main").innerHTML=loadErr?`<div class="soon-box">تعذّر التحميل. تأكد من الاتصال بالإنترنت.<br><button type="button" class="btn primary" data-reload="1" style="margin-top:var(--s-3)">إعادة المحاولة</button></div>`:`<div class="soon-box" role="status">جارٍ التحميل…</div>`;
    if(!loadErr)Promise.all(miss.map(fill)).then(()=>{if(tok===renderTok){loadErr=false;render()}},()=>{if(tok===renderTok){loadErr=true;render()}});
    return;
  }
  draw();observeCards();document.title=TITLE;syncChrome();updateBadges();
}
function printLesson(){
  const was=state.test;
  if(was){state.test=false;render()}
  let r=false;const restore=()=>{if(r)return;r=true;removeEventListener("afterprint",restore);if(was){state.test=true;render()}};
  addEventListener("afterprint",restore);
  setTimeout(()=>safePrint(restore),80);
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const t=e.target;
  const st=t.closest("[data-star]");
  if(st){toggleStar(st.dataset.star);return}
  if(t.closest("[data-clearstars]")){if(confirm("إزالة كل الأسئلة المحفوظة؟")){STAR.clear();saveStars();render()}return}
  if(t.closest("[data-reload]")){loadErr=false;render();return}
  if(t.closest("[data-home],#homeBtn")){go(null,null);return}
  const bb=t.closest("[data-b]");
  if(bb){go(bb.dataset.b,null);return}
  const lb=t.closest("[data-l]");
  if(lb){go(state.book,lb.dataset.l);return}
  const ch=t.closest("[data-p]");
  if(ch){state.period=+ch.dataset.p;render();return}
  const gl=t.closest("[data-gl]");
  if(gl){const [b,l]=gl.dataset.gl.split("|");go(b,l);return}
  if(t.closest("[data-print]")){printLesson();return}
  const gn=t.closest("[data-gxn]");if(gn){startGX(+gn.dataset.gxn);return}
  const gg=t.closest("[data-gg]");if(gg){const el=document.getElementById("g-"+gg.dataset.gg);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});return}
  if(t.closest("[data-gxnext]")){const q=gxAll().find(q=>!gxAnswered(q)),el=q&&document.getElementById("g-"+q.n);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});return}
  if(t.closest("[data-gxforce]")){finishGX();return}
  if(t.closest("[data-gxfin]")){const n=gxAll().filter(q=>!gxAnswered(q)).length;if(n&&!state.gx.warn){state.gx.warn=true;saveGX();render()}else finishGX();return}
  const gv=t.closest("[data-gxrv]");if(gv){state.gx.rv=gv.dataset.gxrv;saveGX();render();return}
  if(t.closest("[data-gxnew]")){state.gx=null;saveGX();render();scrollTo({top:0,behavior:"instant"});return}
  const gs=t.closest("[data-self]");
  if(gs){const [n,v]=gs.dataset.self.split("|"),q=gxAll().find(q=>q.n===+n),y=scrollY;state.gx.self[n]=+v;
    if(+v){WRONG.delete(q.k)}else{WRONG.add(q.k);STAR.add(q.k)}saveRev();saveGX();render();scrollTo({top:y,behavior:"instant"});return}
  const go2=t.closest(".opt[data-gk]");
  if(go2&&!go2.disabled){const y=scrollY,n=go2.dataset.gk,v=+go2.dataset.o,a=state.gx.ans;if(a[n]===v)delete a[n];else a[n]=v;saveGX();render();scrollTo({top:y,behavior:"instant"});return}
  const qa=t.closest("[data-qa]");
  if(qa){const v=qa.dataset.qa;if(v==="exam")startExam();else if(v==="gx")goGX();else goSaved(v==="wrong");return}
  const X=state.exam;
  if(t.closest("[data-retry]")){Object.keys(state.answers).forEach(k=>{if(k.startsWith(state.lesson+"-"))delete state.answers[k]});state.exam=null;saveState();render();scrollTo({top:0,behavior:"instant"});return}
  const gq=t.closest("[data-go]");
  if(gq){const el=document.getElementById("q-"+gq.dataset.go);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});return}
  if(t.closest("[data-nextun]")){const u=visOf(lessonOf(state.lesson)).find(v=>state.answers[v.k]===undefined),el=u&&document.getElementById("q-"+u.k);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});return}
  if(t.closest("[data-finish-force]")){finishExam();return}
  if(t.closest("[data-finish]")){const n=visOf(lessonOf(state.lesson)).filter(v=>state.answers[v.k]===undefined).length;if(n&&X&&!X.warn){X.warn=true;saveState();render()}else finishExam();return}
  if(t.closest("[data-timer]")&&X){const n=visOf(lessonOf(state.lesson)).length;if(X.limit)X.limit=0;else{X.limit=limitFor(n);X.start=Date.now()}LS.set("cq-timer",X.limit?"1":"0");saveState();render();return}
  const rb=t.closest("[data-rv]");if(rb&&X){X.rv=rb.dataset.rv;saveState();render();return}
  if(t.closest("[data-export]")){printResult();return}
  const op=t.closest(".opt[data-k]");
  if(op&&!op.disabled){
    const y=window.scrollY,k=op.dataset.k,v=+op.dataset.o;
    if(state.answers[k]===v)delete state.answers[k];else state.answers[k]=v;
    saveState();render();window.scrollTo({top:y,behavior:"instant"});return}
});
$("#mode").addEventListener("click",toggleTest);
$("#savedBtn").addEventListener("click",()=>goSaved());
$("#bnav").addEventListener("click",e=>{
  const b=e.target.closest("[data-bn]");if(!b)return;
  const k=b.dataset.bn;
  if(k==="search")setSearchOpen(!document.body.classList.contains("search-open"));
  else if(k==="test")goGX();
  else if(k==="saved")goSaved();
  else{setSearchOpen(false);go(null,null)}
});
$("#theme").addEventListener("click",()=>setPref(PREFS[(PREFS.indexOf(document.documentElement.dataset.pref)+1)%3]));
$("#fontBtn").addEventListener("click",()=>setFS((fsi+1)%FS.length));
$("#toTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
addEventListener("scroll",()=>{$("#toTop").hidden=window.scrollY<500},{passive:true});
addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("search-open"))setSearchOpen(false)});
$("#homeBtn").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go(null,null)}});
let tm;$("#q").addEventListener("input",e=>{clearTimeout(tm);tm=setTimeout(()=>{state.term=e.target.value.trim();state.saved=false;render()},150)});
function route(){
  let h=location.hash.slice(1);
  state.gxv=h==="gx";state.wrong=h==="wrong";state.saved=h==="saved"||state.wrong;if(state.gxv){state.book=null;state.lesson=null;state.saved=false;return}
  if(state.saved){state.book=null;state.lesson=null;return}
  const [b,l]=h.split("/");const bk=bookOf(b);
  if(bk){state.book=b;state.lesson=bk.lessons.some(x=>x.id===l)?l:null}else{state.book=null;state.lesson=null}
}
addEventListener("hashchange",()=>{route();render()});

/* ---------- init ---------- */
loadState();loadStars();loadExtra();
{const p=document.documentElement.dataset.pref;setPref(PREFS.includes(p)?p:"auto")}
setFS(Math.max(0,FS.indexOf(parseFloat(LS.get("cq-fs")))));
applyMode();route();render();animate();

