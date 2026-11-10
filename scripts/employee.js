/* ================= شاشة الموظف المبسّطة: 4 أقسام + الرئيسية قائمة مهام ================= */
// الأقسام: الرئيسية · تعلّم · سجلي · حسابي. الصفحات القديمة تبقى، وتُعرض داخل قسمها مع شريط تبويب.
const EMP_GROUPS={
  learn:{label:'تعلّم',icon:'book',subs:[['opportunities','الدورات الحضورية'],['library','الدورات المسجّلة والمواد'],['my-learning','دوراتي']]},
  myrec:{label:'سجلي',icon:'award',subs:[['record','ساعاتي وشهاداتي'],['devp','الدورات الخارجية والزيارات']]},
  account:{label:'حسابي',icon:'user',subs:[['profile','ملفي'],['selfassess','مهاراتي'],['inbox','الإشعارات'],['trainers','المدربون']]}
};
const EMP_GROUP_OF={};Object.entries(EMP_GROUPS).forEach(([g,o])=>o.subs.forEach(([v])=>EMP_GROUP_OF[v]=g));EMP_GROUP_OF.player='learn';EMP_GROUP_OF.reader='learn';
NAV.employee=[['home','الرئيسية','home'],['learn','تعلّم','book'],['myrec','سجلي','award'],['account','حسابي','user']];
NAV_TITLE.employee='';

function navOn(k){
  if(S.view===k)return true;
  if(S.role==='employee')return EMP_GROUP_OF[S.view]===k;
  return k==='library'&&S.view==='player';
}
// موجّه الصفحات: يسمح للموظف بصفحات أقسامه الداخلية
function view(){
  const ok=NAV[S.role].map(x=>x[0]);
  if(S.role==='employee'){ok.push('player','reader');Object.keys(EMP_GROUP_OF).forEach(v=>ok.push(v))}
  if(!ok.includes(S.view))S.view=HOME_OF[S.role];
  try{return VIEWS[S.view]()}catch(e){console.error(e);return `<div class="card empty">${ico('alert')}<div>حدث خطأ أثناء عرض الصفحة: ${esc(e.message)}</div></div>`}
}
S.empLast=S.empLast||{};
function empGroupBar(g,cur){
  const o=EMP_GROUPS[g];
  return `<div class="emp-sub" role="tablist" aria-label="${esc(o.label)}">${o.subs.map(([v,l])=>`<button role="tab" class="${v===cur?'on':''}" aria-selected="${v===cur}" data-act="go" data-v="${v}">${l}${v==='inbox'&&unreadN()?` <span class="badge" style="display:inline-grid;margin-inline-start:6px">${unreadN()}</span>`:''}</button>`).join('')}</div>`;
}
Object.entries(EMP_GROUPS).forEach(([g,o])=>{
  VIEWS[g]=()=>{const v=S.empLast[g]||o.subs[0][0];S.view=v;return VIEWS[v]()};
  o.subs.forEach(([v])=>{const orig=VIEWS[v];if(!orig)return;VIEWS[v]=()=>{if(S.role!=='employee')return orig();S.empLast[g]=v;return empGroupBar(g,v)+orig()}});
});

/* ---------- الرئيسية: وش المطلوب منك الحين ---------- */
const relDay=d=>{const t=new Date(TODAY()+'T00:00:00'),x=new Date(d+'T00:00:00');const n=Math.round((x-t)/864e5);return n===0?'اليوم':n===1?'بكرة':n===2?'بعد بكرة':n<=10?`بعد ${n} أيام`:`بعد ${n} يومًا`};
function empTasks(u){
  const T=[];
  // دورات قريبة (خلال 7 أيام)
  DB.enrolls.filter(e=>e.userId===u.id&&e.status==='registered').map(e=>({e,c:courseById(e.courseId)})).filter(x=>x.c&&x.c.date>=TODAY()&&x.c.fmt!=='ذاتي'&&(new Date(x.c.date)-new Date(TODAY()))/864e5<=7).sort((a,b)=>a.c.date.localeCompare(b.c.date))
    .forEach(({c})=>T.push({kind:'course',date:c.date,title:c.title,sub:`${dow(c.date)} ${fmt(c.date)}${c.time?' · '+c.time:''}${c.loc?' · '+c.loc:''}`,btn:'التفاصيل',act:'go',v:'my-learning'}));
  // طلبات ردّها الرئيس أو مدير التدريب
  DB.visits.filter(v=>v.userId===u.id&&v.status==='returned'&&inc(v)).forEach(v=>T.push({kind:'returned',title:`${(U(u.managerId)||{name:'رئيسك'}).name.split(' ')[0]} رجّع زيارتك`,sub:v.mgrNote?`«${v.mgrNote}»`:'افتحها وعدّلها حسب الملاحظة',btn:'عدّلها',act:'go',v:'devp'}));
  DB.extreq.filter(x=>x.userId===u.id&&x.status==='returned'&&inc(x)).forEach(x=>T.push({kind:'returned',title:'رجّعت إدارة التدريب دورتك الخارجية',sub:x.title,btn:'عدّلها',act:'go',v:'devp'}));
  // كمّل دورة مسجّلة
  DB.libs.filter(l=>l.status==='published'&&inc(l)&&DB.progress.some(p=>p.userId===u.id&&allLessons(l).some(x=>x.id===p.lessonId))&&!libPassed(u.id,l.id)).forEach(l=>{
    const pc=libPct(u.id,l);const att=attemptsOf(u.id,l.id,'post').length,max=(l.settings||{}).maxAttempts||3;
    const pendRetake=DB.retakes.some(r=>r.userId===u.id&&r.libId===l.id&&['pending','pending_tm'].includes(r.status));
    if(pc>=100&&att>=max){T.push({kind:'retake',title:`خلصت محاولات اختبار «${l.title}»`,sub:pendRetake?'طلب الإعادة عند إدارة التدريب، وبيوصلك إشعار بالقرار':'تقدر تطلب إعادة الدورة',btn:pendRetake?null:'اطلب إعادة',act:'openlib',id:l.id})}
    else if(pc>=100){T.push({kind:'exam',title:`اختبار «${l.title}» جاهز`,sub:`خلصت الدروس، باقي الاختبار (${max-att} ${max-att===1?'محاولة متبقية':'محاولات متبقية'})`,btn:'ابدأ',act:'openlib',id:l.id,primary:true})}
    else T.push({kind:'continue',title:`كمّل «${l.title}»`,sub:`وصلت ${pc}%`,pct:pc,btn:'كمّل',act:'openlib',id:l.id,primary:true});
  });
  // تقييم الدورات المكتملة
  DB.completions.filter(c=>c.userId===u.id&&!surveyOf(u.id,c.kind,c.refId)).slice(0,2).forEach(c=>T.push({kind:'survey',title:`قيّم «${titleOf(c.kind,c.refId)}»`,sub:'دقيقتين، ورأيك يحسّن الدورات',btn:'قيّم',act:'rate',dkind:c.kind,id:c.refId}));
  // تقييم المهارات
  const nGap=gapsOfEmp(u).filter(g=>g.state==='unrated'||(g.a&&g.a.self==null)).length;
  if(nGap)T.push({kind:'skills',title:'قيّم مهاراتك',sub:`${nGap} ${nGap===1?'مهارة':nGap===2?'مهارتان':nGap<=10?'مهارات':'مهارة'} تنتظر تقييمك، وعليها نقترح لك الدورات`,btn:'قيّم',act:'go',v:'selfassess'});
  // طلبات تنتظر غيرك (للعلم فقط)
  DB.enrolls.filter(e=>e.userId===u.id&&['pending_lm','pending_tm'].includes(e.status)).forEach(e=>{const c=courseById(e.courseId);if(!c)return;const who=e.status==='pending_lm'?(U(u.managerId)||{name:'رئيسك'}).name.split(' ')[0]:'إدارة التدريب';T.push({kind:'wait',title:`ننتظر موافقة ${who}`,sub:`على تسجيلك في «${c.title}». بيوصلك إشعار بالقرار.`})});
  DB.extreq.filter(x=>x.userId===u.id&&['pending','submitted'].includes(x.status)&&inc(x)).forEach(x=>T.push({kind:'wait',title:'ننتظر اعتماد إدارة التدريب',sub:`لدورتك الخارجية «${x.title}»`}));
  DB.visits.filter(v=>v.userId===u.id&&['pending','pending_lm','submitted'].includes(v.status)&&inc(v)).forEach(v=>T.push({kind:'wait',title:`ننتظر موافقة ${(U(u.managerId)||{name:'رئيسك'}).name.split(' ')[0]}`,sub:`على زيارتك لـ «${v.org||'جهة'}»`}));
  return T;
}
const TASK_ICON={course:['cal','#072C49','#fff'],returned:['rotate','#F8E4DF','#8F3B2B'],continue:['play','#D3EEF3','#007497'],exam:['check','#D3EEF3','#007497'],retake:['rotate','#FBEFD9','#8A5C12'],survey:['smile','#F7E7D4','#7A4A18'],skills:['target','#EAF6F9','#007497'],wait:['clock','#F0ECE4','#47596A']};
function taskCard(t){
  const [ic,bg,fg]=TASK_ICON[t.kind]||TASK_ICON.wait;
  const badge=t.kind==='course'?`<div class="tk-date" style="background:${bg};color:${fg}"><span>${relDay(t.date)}</span><b class="num">${+t.date.slice(8,10)}</b></div>`:`<div class="tk-ic" style="background:${bg};color:${fg}">${ico(ic)}</div>`;
  const btn=t.btn?`<button class="btn ${t.primary?'':'ghost'} tk-btn" data-act="${t.act}"${t.v?` data-v="${t.v}"`:''}${t.id?` data-id="${t.id}"`:''}${t.dkind?` data-kind="${t.dkind}"`:''}>${t.btn}</button>`:'';
  return `<article class="card tk ${t.kind==='returned'?'tk-alert':''} ${t.kind==='wait'?'tk-wait':''}">${badge}<div class="tk-body"><b>${esc(t.title)}</b><span>${esc(t.sub||'')}</span>${t.pct!=null?`<div class="tk-bar"><i style="width:${t.pct}%"></i></div>`:''}</div>${btn}</article>`;
}
VIEWS.home=function(){
  const u=ME();if(!u)return '';
  const h=hoursOf(u.id,TODAY().slice(0,4)+'-01-01'),p=Math.round(h/TARGET_H*100);
  const T=empTasks(u),act=T.filter(t=>t.kind!=='wait'),wait=T.filter(t=>t.kind==='wait');
  const rec=recommendedFor(u).slice(0,3);
  const certs=DB.completions.filter(c=>c.userId===u.id&&inc(c)).length;
  const n=act.length;
  return `<div class="emp-home">
  <div class="emp-head"><div><h1>هلا ${esc(u.name.split(' ')[0])}</h1><p>${n?`عندك <b>${n===1?'شي واحد':n===2?'شيئين':n+' أشياء'}</b> ${n===1?'يحتاجك':'تحتاجك'}`:'ما عندك شي مطلوب الحين'}</p></div>
   <button class="btn gold" data-act="emp-add">${ico('plus')}أضف إنجاز</button></div>
  <div class="emp-cols">
   <section class="emp-tasks" aria-label="المطلوب منك">
    ${act.length?act.map(taskCard).join(''):`<div class="card empty" style="padding:32px">${ico('check')}<div><b style="color:var(--navy)">كل شي تمام</b><div class="small muted" style="margin-top:4px">تصفح الدورات المتاحة لو تبي تتعلّم شي جديد.</div></div><button class="btn" style="margin-top:12px" data-act="go" data-v="opportunities">تصفح الدورات</button></div>`}
    ${wait.length?`<h2 class="emp-h2">ننتظر غيرك</h2>${wait.map(taskCard).join('')}`:''}
   </section>
   <aside class="emp-side">
    <section class="card emp-prog" aria-label="تقدّمك هذا العام">
     <div class="ring" style="--p:${Math.min(100,p)}"><div><div><b class="num">${p}%</b></div></div></div>
     <div><b class="emp-prog-t">${h>=TARGET_H?'حققت مستهدفك السنوي':`باقي ${num(Math.max(0,TARGET_H-h))} ساعة على مستهدفك`}</b><span><bdi class="num">${num(h)}</bdi> من ${TARGET_H} ساعة هذا العام · ${certs} ${certs===1?'شهادة':certs===2?'شهادتان':certs<=10?'شهادات':'شهادة'}</span><button class="linkbtn" data-act="go" data-v="record">عرض سجلي</button></div>
    </section>
    ${rec.length?`<section class="card pad emp-rec"><h2 class="emp-h2" style="margin:0 0 8px">مقترح لك</h2>${rec.map(({c})=>`<button class="emp-rec-i" data-act="go" data-v="opportunities"><b>${esc(c.title)}</b><span>${dow(c.date)} ${fmt(c.date)} · ${esc(c.fmt||'')} · <bdi class="num">${num(c.hours)}</bdi> ${c.hours>2&&c.hours<11?'ساعات':'ساعة'}</span></button>`).join('')}<button class="linkbtn" data-act="go" data-v="opportunities">كل الدورات</button></section>`:''}
   </aside>
  </div></div>`;
};

/* ---------- أضف إنجاز: يختار النوع ثم النموذج ---------- */
ACT['emp-add']=function(){
  miniModal('أضف إنجاز',`<p class="muted" style="margin-bottom:14px">وش تبي تضيف؟</p><div class="emp-choice"><button data-act="emp-add-go" data-k="ext">${ico('award')}<b>دورة خارجية</b><span>حضرتها خارج الجمعية وعندك شهادتها</span></button><button data-act="emp-add-go" data-k="visit">${ico('pin')}<b>زيارة ميدانية</b><span>زرت جمعية أو جهة واستفدت منها</span></button></div>`,'<button class="btn sec" data-act="mm-close">إلغاء</button>');
};
ACT['emp-add-go']=function(t){closeLayer();S.tab.devp=t.dataset.k==='ext'?'ext':'visits';go('devp');setTimeout(()=>{const a=ACT[t.dataset.k==='ext'?'ext-new':'visit-new'];if(a)a(t)},60)};

/* ---------- كلام أبسط للحالات ---------- */
STATUS_AR.pending_lm='ننتظر موافقة رئيسك';STATUS_AR.pending_tm='ننتظر موافقة إدارة التدريب';STATUS_AR.waitlist='في قائمة الانتظار';
