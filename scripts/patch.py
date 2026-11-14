import re, sys, os
src, dst = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()

# 1) طبقة الحفظ: الخادم بدل التخزين المحلي
a = h.index('/* ================= الاستمرارية')
b = h.index('/* ================= التدقيق والصلاحيات')
PERSIST = r"""/* ================= الاستمرارية: الخادم (حفظ على مستوى السجل + كشف التعارض + مزامنة حية) ================= */
const P={mode:'server',msg:'متصل بالخادم',dirty:new Set(),t:null,busy:false,failed:false,base:{},vers:{},seq:0,online:true};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}};
async function api(path,opts={}){
  const r=await fetch(path,{credentials:'same-origin',...opts,headers:{'Content-Type':'application/json','X-Role':S.role||'',...(opts.headers||{})}});
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&!['/api/login','/api/me'].includes(path)&&S.me){S.me=null;S.role=null;closeLayer();draw();toast('انتهت الجلسة','سجّل الدخول من جديد')}
  if(!r.ok)throw Object.assign(new Error(j.error||('HTTP '+r.status)),{status:r.status,body:j});
  return j;
}
async function persistInit(){}
const rowsOf=c=>c==='settings'?[{...DB.settings,id:'settings'}]:DB[c];
const ALLC=()=>[...COLS,'settings'];
function setBase(c,id,obj,ver){(P.base[c]||(P.base[c]={}))[id]=obj?JSON.stringify(obj):null;(P.vers[c]||(P.vers[c]={}))[id]=ver}
async function loadAll(){
  const d=await api('/api/data');
  P.base={};P.vers=d.vers||{};
  for(const c of COLS){DB[c]=d[c]||[];P.base[c]={};for(const r of DB[c])P.base[c][r.id]=JSON.stringify(r)}
  const st=d.settings||{};delete st.id;
  for(const k of Object.keys(DB.settings))delete DB.settings[k];
  Object.assign(DB.settings,clone(SETTINGS_DEFAULT),st);
  P.base.settings={settings:JSON.stringify(st&&Object.keys(st).length?{...st,id:'settings'}:null)};
  P.base.settings.settings=JSON.stringify({...DB.settings,id:'settings'});
  P.seq=d.seq;P.loaded=true;return false;
}
function diffCol(c){
  const ops=[],base=P.base[c]||{},vers=P.vers[c]||{},seen=new Set();
  for(const r of rowsOf(c)){if(!r||!r.id)continue;seen.add(r.id);const s=JSON.stringify(r);if(base[r.id]!==s)ops.push({col:c,id:r.id,base:vers[r.id]||0,data:JSON.parse(s)})}
  for(const id in base){if(base[id]!=null&&!seen.has(id))ops.push({col:c,id,base:vers[id]||0,delete:true})}
  return ops;
}
function applyServerRow(c,id,data,ver,deleted){
  if(c==='settings'){if(data){const st={...data};delete st.id;Object.assign(DB.settings,st)}setBase(c,id,data?{...DB.settings,id:'settings'}:null,ver);return}
  const arr=DB[c];const i=arr.findIndex(r=>r&&r.id===id);
  if(deleted||!data){if(i>=0)arr.splice(i,1);setBase(c,id,null,ver);return}
  if(i>=0)arr[i]=data;else arr.push(data);setBase(c,id,data,ver);
}
function commit(...cols){cols.forEach(c=>P.dirty.add(c));clearTimeout(P.t);P.t=setTimeout(flush,250)}
async function flush(){
  if(!S.me||!P.loaded)return;
  if(P.busy){clearTimeout(P.t);P.t=setTimeout(flush,250);return}
  P.busy=true;P.dirty.clear();
  let reverted=[],sent=0;
  try{
    const ops=ALLC().flatMap(diffCol);
    if(!ops.length)return;
    sent=ops.length;
    const r=await api('/api/sync',{method:'POST',body:JSON.stringify({ops})});
    r.results.forEach((x,i)=>{
      const op=ops[i];
      if(x.ok)setBase(op.col,op.id,op.delete?null:op.data,x.ver);
      else{applyServerRow(op.col,op.id,x.data,x.ver,x.deleted||!x.data);if(op.col!=='audit')reverted.push(x)}
    });
    P.failed=false;P.online=true;P.msg='محفوظ في الخادم · '+new Date().toLocaleTimeString('ar-SA-u-nu-latn',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    P.failed=true;P.online=false;P.msg='تعذّر الحفظ في الخادم — سيُعاد المحاولة ('+e.message+')';
    clearTimeout(P.t);P.t=setTimeout(flush,3000);
  }finally{P.busy=false}
  const el=$('#savest');if(el)el.innerHTML=saveStHtml();
  if(reverted.length){
    const c=reverted.find(x=>x.conflict),d=reverted.find(x=>x.denied);
    if(c)toast('تعارض في الحفظ',c.reason+'. عُرضت أحدث نسخة.');
    if(d)toast('رفض الخادم الحفظ',d.reason);
    if(!$('#layer').innerHTML)draw();
  }
}
async function poll(){
  if(!S.me||!P.loaded||P.busy)return;
  try{
    const r=await api('/api/changes?since='+P.seq);
    let n=0;
    for(const x of r.rows){
      const known=(P.vers[x.col]||{})[x.id];
      if(known===x.ver)continue;
      const local=x.col==='settings'?JSON.stringify({...DB.settings,id:'settings'}):JSON.stringify((DB[x.col]||[]).find(o=>o&&o.id===x.id)||null);
      const base=(P.base[x.col]||{})[x.id];
      if(base!==undefined&&base!==null&&local!==base)continue; // تعديل محلي معلّق: يُحسم عند الحفظ
      applyServerRow(x.col,x.id,x.data,x.ver,x.deleted);if(x.col!=='audit')n++;
    }
    P.seq=r.seq;
    if(!P.online){P.online=true;P.failed=false;P.msg='متصل بالخادم';const el=$('#savest');if(el)el.innerHTML=saveStHtml()}
    const ae=document.activeElement,typing=ae&&ae.matches&&ae.matches('input,textarea,select');
    if(n&&!$('#layer').innerHTML&&!typing&&S.view!=='player'&&S.view!=='reader'){const y=window.scrollY;draw();window.scrollTo(0,y)}
  }catch(e){if(P.online){P.online=false;P.msg='انقطع الاتصال بالخادم';const el=$('#savest');if(el)el.innerHTML=saveStHtml()}}
}
const saveStHtml=()=>`<i class="${P.failed||!P.online?'b':''}"></i>${esc(P.msg)}`;
const saveAll=()=>{commit('settings',...COLS)};

"""
h = h[:a] + PERSIST + h[b:]

# 2) الدخول الحقيقي + الخروج + الإقلاع
OVR = r"""
/* ================= الدخول الحقيقي (خادم) ================= */
function loginView(){
  if(S.booting)return `<div class="lg-boot"><div class="d"><i></i><i></i><i></i></div><div>جارٍ الاتصال بالخادم…</div></div>`;
  const trainer=S.portal==='trainer';
  let hij='';
  try{hij=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())}catch(e){}
  return `<div class="login lg2">
 <div class="lg-bg">
  <span class="lg-aur a"></span><span class="lg-aur b"></span>
  <span class="lg-mesh"></span>
  <span class="lg-rose two"></span>
  <span class="lg-grain"></span><span class="lg-band"></span>
 </div>
 <main class="lg-wrap">
  <header class="lg-head">
   <div class="lg-logo">
    <img src="/dal.svg" alt="شعار منصة دال">
    <div class="dal-w"><b>منصة دال</b><span>تعلّم مستمر</span></div>
   </div>
   <span class="lg-kicker">أهلًا وسهلًا بك في</span>
   <h1>منصة التطوير والتدريب</h1>
   <p class="lg-org">الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</p>
   ${hij?`<span class="lg-date"><i></i>${esc(hij)}</span>`:''}
  </header>

  <form class="lg-card" id="lg_form" novalidate>
   <div class="field"><label for="lg_email">البريد الرسمي</label><input class="inp" id="lg_email" type="email" dir="ltr" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="name@qb.org.sa" autocomplete="username"></div>
   <div class="field"><label for="lg_pw">كلمة المرور</label><div class="pw-wrap"><input class="inp" id="lg_pw" type="password" dir="ltr" enterkeyhint="go" autocomplete="current-password"><button type="button" class="pw-eye" data-act="pw-eye" aria-label="إظهار كلمة المرور" aria-pressed="false">${ico('eye')}<svg class="i eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.5 2.6-3.1 4M6.1 6.3C4 7.8 2.4 9.9 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button></div></div>
   <p class="lg-err" id="lg_err" role="alert"></p>
   <button class="lg-go" type="submit" id="lg_btn"><span class="t">تسجيل الدخول</span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg></button>
   <button type="button" class="lg-help" data-act="lg-help">نسيت كلمة المرور؟</button>
   <p class="lg-hint">الموظفون والمدربون يدخلون من هنا بالبريد الرسمي نفسه.</p>
  </form>

  <footer class="lg-foot"><b>الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</b>إدارة التطوير والتدريب · جميع الحقوق محفوظة ${new Date().getFullYear()}</footer>
 </main></div>`;
}
Object.assign(ACT,{
  async 'login-email'(){
    const em=fieldVal('lg_email').toLowerCase(),pw=($('#lg_pw')||{}).value||'',err=$('#lg_err'),btn=$('#lg_btn');
    if(!btn||btn.disabled)return;
    const fail=m=>{
      err.textContent=m;err.classList.remove('on');err.offsetWidth;err.classList.add('on');
      const f=!pw?$('#lg_pw'):$('#lg_email');
      if(f){f.classList.add('bad');setTimeout(()=>f.classList.remove('bad'),1400);f.focus()}
    };
    err.classList.remove('on');
    if(!emailOk(em)){fail('أدخل بريدًا صالحًا');return}
    if(!pw){fail('أدخل كلمة المرور');return}
    const lab=btn.querySelector('.t')||btn;const lab0=lab.textContent;btn.disabled=true;lab.textContent='جارٍ التحقق…';
    try{
      const r=await api('/api/login',{method:'POST',body:JSON.stringify({email:em,password:pw})});
      if(S.portal==='trainer'&&!r.user.roles.includes('trainer')){await api('/api/logout');fail('هذه البوابة للمدربين فقط');btn.disabled=false;lab.textContent=lab0;return}
      S.role=ROLE_PRI.find(x=>r.user.roles.includes(x));
      S.mustChange=!!r.mustChange;await loadAll();
      const lg=document.querySelector('.lg2');
      if(lg&&!matchMedia('(prefers-reduced-motion: reduce)').matches){lg.classList.add('out');await new Promise(r2=>setTimeout(r2,240))}
      doLogin(r.user.id);if(S.mustChange)askPwChange(true);
    }catch(e){fail(e.message);btn.disabled=false;lab.textContent=lab0}
  },
  'pw-eye'(t){
    const w=t.closest('.pw-wrap'),i=w.querySelector('input'),on=i.type==='password';
    i.type=on?'text':'password';w.classList.toggle('show',on);
    t.setAttribute('aria-pressed',on?'true':'false');
    t.setAttribute('aria-label',on?'إخفاء كلمة المرور':'إظهار كلمة المرور');
    i.focus();try{i.setSelectionRange(i.value.length,i.value.length)}catch(e){}
  },
  'lg-help'(){toast('كلمة المرور يصدرها مسؤول النظام','راسل admin@qb.org.sa ليرسل لك كلمة مرور مؤقتة')},
  login(){},
  async logout(){audit('logout','session','');detachPlayer();await flush();try{await api('/api/logout')}catch(e){}S.me=null;S.role=null;P.loaded=false;COLS.forEach(c=>DB[c]=[]);draw()},
});
document.addEventListener('submit',e=>{if(e.target&&e.target.id==='lg_form'){e.preventDefault();ACT['login-email']()}});
"""+"".join(open(os.path.join(os.path.dirname(__file__),n),encoding="utf-8").read()+"\n" for n in ("client-extra.js","reports.js","employee.js","tracks.js","nav.js","navpill.js","admplus.js"))+r"""
"""
boot_a = h.index('(async function boot(){')
boot_b = h.index('})();', boot_a) + len('})();')
BOOT = r"""(async function boot(){
  S.booting=true;draw();
  try{const m=await api('/api/me');S.role=m.role;S.mustChange=!!m.mustChange;await loadAll();S.booting=false;doLogin(m.user.id);if(S.mustChange)askPwChange(true)}
  catch(e){S.booting=false;draw()}
  setInterval(poll,3000);
  window.addEventListener('beforeunload',()=>{if(ALLC().some(c=>diffCol(c).length))flush()});
})();"""
h = h[:boot_a] + OVR + BOOT + h[boot_b:]
h = h.replace(' (Copy)</title>', '</title>')
# 3) نصوص وأزرار تتوافق مع الخادم الحقيقي
REPL = [
 ("${P.mode==='db'?'قاعدة بيانات مشتركة':'تخزين محلي في هذا المتصفح'}", "${P.mode!=='local'?'قاعدة بيانات الخادم (مشتركة)':'تخزين محلي في هذا المتصفح'}"),
 ("${P.mode!=='db'?'<div class=\"note warn\"", "${P.mode==='local'?'<div class=\"note warn\""),
 ("قاعدة بيانات المنصة المشتركة عند توفرها لحسابك، وإلا التخزين المحلي للمتصفح. الحالة تظهر أسفل الشاشة.", "قاعدة بيانات الخادم المشتركة. حالة الحفظ تظهر أسفل القائمة الجانبية."),
 ("الدخول بالبريد فقط (لا كلمة مرور، انظر حدود الأمان أدناه).", "الدخول بالبريد وكلمة المرور. يصدر مسؤول النظام كلمة مرور مؤقتة لكل حساب جديد."),
 ("<td>تُطبَّق داخل الواجهة؛ الدخول بالبريد دون كلمة مرور</td><td>ربط Microsoft Entra ID وطبقة خادم (API) تتحقق من الدور في كل طلب.</td>", "<td>الخادم يتحقق من الدور في كل طلب؛ الدخول بالبريد وكلمة المرور</td><td>ربط Microsoft Entra ID للدخول الموحّد (اختياري).</td>"),
 ('<button class="btn ghost sm" data-act="edituser" data-id="${u.id}">تحرير</button>', '<button class="btn ghost sm" data-act="pw-reset" data-id="${u.id}">كلمة المرور</button> <button class="btn ghost sm" data-act="edituser" data-id="${u.id}">تحرير</button>'),
]

# 4) مزامنة مدة فيديو يوتيوب: تُحفظ في الدورة لمدير التدريب فقط، وللموظف في تقدّمه
_a="les.dur=d;PL.p.dur=d;commit('libs');commit('progress');"
assert _a in h; h=h.replace(_a,"PL.p.dur=d;commit('progress');if(S.role==='trainmgr'){les.dur=d;commit('libs')}")

# 5) فحص التضمين يحدّث مدة درس يوتيوب الفعلية (لمدير التدريب)
_b="events:{onReady:()=>{if(!settled){settled=true;clearTimeout(to);fin(true)}}"
assert _b in h
h=h.replace(_b,"events:{onReady:ev=>{if(!settled){settled=true;clearTimeout(to);const sync=()=>{try{const d=Math.ceil(ev.target.getDuration()||0);if(d>0&&Math.abs(d-les.dur)>1){const old=les.dur;les.dur=d;commit('libs');audit('lesson.dur.sync','lesson',les.id,'المدة من '+old+' إلى '+d+' ث وفق فحص التضمين');toast('حُدّثت مدة الدرس','وفق يوتيوب: '+mmss(d));return true}}catch(e){}return false};if(!sync()){try{ev.target.mute();ev.target.playVideo()}catch(e){}let k=0;const iv=setInterval(()=>{if(sync()||++k>16){clearInterval(iv);try{ev.target.stopVideo()}catch(e){}fin(true)}},500);return}fin(true)}}")
h=h.replace("const fin=(ok,msg,code)=>{try{box.remove()}catch(e){}","const fin=(ok,msg,code)=>{if(box._done)return;box._done=1;try{box.remove()}catch(e){}",1)

# 6) قاعدة الساعات المعتمدة للدورات المسجلة (معتمدة 2026-11-09)
_c='<label>الساعات المعتمدة عند الإتمام</label><input class="inp" type="number" min="0" step="0.5" data-num data-ed="creditHours" value="${e.creditHours}"></div>'
assert _c in h
h=h.replace(_c,'<label>الساعات المعتمدة عند الإتمام</label><input class="inp" type="number" min="0" step="0.5" data-num data-ed="creditHours" value="${e.creditHours}"><span class="ins">القاعدة المعتمدة: المدة الفعلية للدورة مقرّبة لأقرب نصف ساعة للأسفل، ولا تُحتسب إلا بعد اجتياز الاختبار النهائي.</span></div>')

# 7) تنبيه واضح: المشاهدة تُحتسب داخل المنصة فقط
_d="function ytPrivacyNote(){return `"
assert _d in h
h=h.replace(_d,"function ytPrivacyNote(){return `<div class=\"note warn\" style=\"margin-top:10px\"><b>شاهد الفيديو هنا داخل المنصة.</b> لا تُحتسب إلا المشاهدة في هذه الصفحة. الضغط على شعار يوتيوب أو عنوان الفيديو يفتحه في موقع يوتيوب، وما تشاهده هناك لا يُضاف لتقدّمك.</div>",1)

# 8) خط ثمانية: الواجهة بثمانية Sans، والعناوين الكبيرة والأرقام البارزة بثمانية Serif Display
_t='<title>منصة التطوير والتدريب — جمعية تحفيظ بريدة</title>'
assert _t in h
h=h.replace(_t,_t+'\n<script src="/app-fonts.js" async></script>',1)
_css='td.num,th.num{display:table-cell;text-align:right}'
assert _css in h
h=h.replace(_css,_css+"""
/* ===== خط ثمانية ===== */
:root{--font:"Thmanyah Sans","IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;--display:"Thmanyah Serif Display","Thmanyah Sans","IBM Plex Sans Arabic",serif}
body{font-feature-settings:"kern" 1}
.page-h h1,.hero h1,.login-art h1,.login-box h2,.login-art .brand-l b,.m-h h3,.kpi .v,.kpi-c .v,.ring b,.stats-row b{font-family:var(--display);font-weight:700;letter-spacing:0}
.page-h h1{font-size:30px}.hero h1{font-size:30px}
""",1)

# 9) توازن الخطوط (مراجعة الطباعة): الأرقام والوحدات والاتجاه والالتفاف والأحجام
R9=[
 # بطاقات كيركباتريك في لوحة التحكم: فصل العنوان عن القيمة، وحدة بخط عادي، رقم بخط العرض
 ("['1','رد الفعل',K.sat,k=>num(k.v,0)+'%'],['2','التعلّم',K.learn,k=>(k.v>=0?'+':'')+num(k.v,1)+' نقطة'],['3','السلوك',K.apply,k=>num(k.v,0)+'% تطبيق جيد'],['4','النتائج',null,null]",
  "['1','رد الفعل',K.sat,k=>'<bdi class=\"num\">'+num(k.v,0)+'%</bdi>'],['2','التعلّم',K.learn,k=>'<bdi class=\"num\">'+(k.v>=0?'+':'')+num(k.v,1)+'</bdi> <small class=\"unit\">نقطة</small>'],['3','السلوك',K.apply,k=>'<bdi class=\"num\">'+num(k.v,0)+'%</bdi> <small class=\"unit\">تطبيق جيد</small>'],['4','النتائج',null,null]"),
 ("<b style=\"color:var(--navy);font-weight:600\">${t}</b><div style=\"font-size:${ok?22:15}px;font-weight:600;color:${ok?'var(--teal)':'var(--ink-3)'};margin:6px 0\" class=\"num\">${ok?(n==='4'?l4+' مؤشر مرتبط':f(k)):'بيانات غير كافية'}</div>",
  "<b style=\"display:block;color:var(--navy);font-weight:700\">${t}</b><div class=\"kv-val\" style=\"font-size:${ok?26:15}px;font-weight:700;font-family:${ok?'var(--display)':'var(--font)'};color:${ok?'var(--navy)':'var(--ink-3)'};margin:6px 0\">${ok?(n==='4'?'<bdi class=\"num\">'+l4+'</bdi> <small class=\"unit\">مؤشر مرتبط</small>':f(k)):'بيانات غير كافية'}</div>"),
 # بطاقات مستويات الأثر: نفس أسلوب المؤشرات
 ("${ok?`<span class=\"num\" style=\"font-size:28px;font-weight:600;color:var(--teal)\">${val}</span>`:insufficient('')}",
  "${ok?`<span class=\"kv-val\" style=\"font-size:30px;font-weight:700;font-family:var(--display);color:var(--navy)\">${val}</span>`:insufficient('')}"),
 ("num(avg(s1.map(surveyPct)),0)+'%',`${N(s1.length)} استبيانًا", "'<bdi class=\"num\">'+num(avg(s1.map(surveyPct)),0)+'%</bdi>',`${N(s1.length)} استبيانًا"),
 ("(avg(pairs.map(p=>p.gain))>=0?'+':'')+num(avg(pairs.map(p=>p.gain)),1)+' نقطة',", "'<bdi class=\"num\">'+(avg(pairs.map(p=>p.gain))>=0?'+':'')+num(avg(pairs.map(p=>p.gain)),1)+'</bdi> <small class=\"unit\">نقطة</small>',"),
 ("num(l3.avg,1)+' / 5',", "'<bdi class=\"num\">'+num(l3.avg,1)+'</bdi> <small class=\"unit\">من 5</small>',"),
 ("N(links.length)+' مؤشر',", "'<bdi class=\"num\">'+N(links.length)+'</bdi> <small class=\"unit\">مؤشر</small>',"),
 # صيغة قيم المؤشرات: الوحدة خارج اتجاه الرقم
 ("const kpiFmt=k=>k.unit==='%'?num(k.v,0)+'%':k.unit==='ر.س'?num(k.v,0)+' <small>ر.س</small>':k.unit==='نقطة'?(k.v>=0?'+':'')+num(k.v,1)+' <small>نقطة</small>':num(k.v,1)+' <small>'+k.unit+'</small>';",
  "const kpiFmt=k=>k.unit==='%'?'<bdi class=\"num\">'+num(k.v,0)+'%</bdi>':k.unit==='ر.س'?'<bdi class=\"num\">'+num(k.v,0)+'</bdi> <small class=\"unit\">ر.س</small>':k.unit==='نقطة'?'<bdi class=\"num\">'+(k.v>=0?'+':'')+num(k.v,1)+'</bdi> <small class=\"unit\">نقطة</small>':'<bdi class=\"num\">'+num(k.v,1)+'</bdi> <small class=\"unit\">'+k.unit+'</small>';"),
 ("<span class=\"v num\">${kpiFmt(k)}</span>", "<span class=\"v\">${kpiFmt(k)}</span>"),
 # جدول التحسن والاختبار والحجم
 ("<td><b class=\"num\">${r.gain>=0?'+':''}${num(r.gain,1)}</b> نقطة</td>", "<td style=\"white-space:nowrap\"><bdi class=\"num\"><b>${r.gain>=0?'+':''}${num(r.gain,1)}</b></bdi> نقطة</td>"),
 ("`<b class=\"num\">${r.best}%</b> <span class=\"small muted\">(${r.att} محاولة)</span>`", "`<span style=\"white-space:nowrap\"><b class=\"num\">${r.best}%</b> <span class=\"small muted\">(${r.att} ${r.att===1?'محاولة':r.att===2?'محاولتان':'محاولات'})</span></span>`"),
 ("<dd class=\"num\">${num(tot/1024,1)} ك.بايت</dd>", "<dd><bdi class=\"num\">${num(tot/1024,1)}</bdi> ك.بايت</dd>"),
]
for a_,b_ in R9:
    assert a_ in h, 'R9 missing: '+a_[:70]
    h=h.replace(a_,b_)
_css9='/* ===== خط ثمانية ===== */'
h=h.replace(_css9,_css9+"""
.kpi .v small,.kpi-c .v small,.kv-val small,.v .unit,.kv-val .unit{font-family:var(--font);font-weight:500;font-size:.48em;color:var(--ink-3);margin-inline-start:4px;letter-spacing:0}
.kpi .v small{font-size:.5em}
.tag,.pill,.rec,.badge{white-space:nowrap;line-height:1.5}
td .tag{margin-inline-start:6px}td .tag:first-child{margin-inline-start:0}
td b{font-weight:600}
.tbl-wrap td:first-child{min-width:170px}
td.small.num,td .small.num{white-space:nowrap}
.nav-h,.switch-l,.save-st{font-size:12.5px}
.ring span{font-size:12px;line-height:1.3;display:block;max-width:84px;margin-inline:auto}
.chart text{font-size:13px}
.mini{font-size:12px}
.tabs{position:relative}.tabs button{position:relative;z-index:1}.tabs button.on{border-bottom-color:transparent}.tabs>.ui-pill{height:3px;background:var(--teal);border-radius:3px 3px 0 0}.tabs{scrollbar-width:thin;-webkit-mask-image:linear-gradient(to left,#000 92%,transparent);mask-image:linear-gradient(to left,#000 92%,transparent)}
@media(max-width:900px){.tbl-wrap table{min-width:680px}.tbl-wrap td{min-width:110px}.tabs button{padding:10px 12px;font-size:14px}.ring{width:104px;height:104px}.ring div{width:82px;height:82px}.ring b{font-size:22px}}
""",1)

# 10) أرقام لاتينية موحّدة في تبويبات مستويات الأثر
for _a,_b in (("'١ · ","'1 · "),("'٢ · ","'2 · "),("'٣ · ","'3 · "),("'٤ · ","'4 · ")):
    h=h.replace(_a,_b)

# 11) شاشة الموظف المبسّطة
R11=[
 ("class=\"${S.view===k||(k==='library'&&S.view==='player')?'on':''}\" ${S.view===k?'aria-current=\"page\"':''}","class=\"${navOn(k)?'on':''}\" ${navOn(k)?'aria-current=\"page\"':''}"),
 ("  if((f.desc||'').trim().length<10)e.push('الوصف المختصر مطلوب (10 أحرف على الأقل)');\n  if((f.skills||'').trim().length<5)e.push('اذكر المهارات أو المعارف المكتسبة');\n",""),
 ("${a&&a.mgr!=null?`<div class=\"small\" style=\"color:var(--teal)\">تقييم رئيسك:","${a&&a.mgr!=null&&a.self!=null?`<div class=\"small\" style=\"color:var(--teal)\">تقييم رئيسك:"),
 ("'<div class=\"small muted\">لم يقيّمك رئيسك بعد</div>'}","(a&&a.mgr!=null?'<div class=\"small muted\">يظهر تقييم رئيسك بعد ما تحفظ تقييمك</div>':'<div class=\"small muted\">لم يقيّمك رئيسك بعد</div>')}"),
 ("  </header><main class=\"content\" id=\"view\">","  </header>${empTabsHtml()}<main class=\"content\" id=\"view\">"),
 ("<button class=\"hamb\" data-act=\"navopen\" aria-label=\"القائمة\">","<button class=\"icon-btn side-toggle\" data-act=\"sidetoggle\" aria-label=\"طيّ القائمة الجانبية\" title=\"طيّ القائمة الجانبية\">${ico('menu')}</button><button class=\"hamb\" data-act=\"navopen\" aria-label=\"القائمة\">"),
 ('<div class="note warn" style="margin-bottom:14px">تنبيه: الصلاحيات هنا تُطبَّق داخل الواجهة فقط. لا يوجد خادم مصادقة؛ فالفصل الأمني الحقيقي بين الأدوار يتطلب ربطًا بـ Microsoft Entra ID وطبقة خادم.</div>','<div class="note" style="margin-bottom:14px">الصلاحيات تُطبَّق على الخادم: كل حساب يرى وينفّذ ما تسمح به صفته فقط. لإصدار كلمة مرور مؤقتة لأي مستخدم استخدم زر «كلمة المرور».</div>'),
 ("'extreq','visits','retakes','files'];","'extreq','visits','retakes','files','tracks','trackprog'];"),
 ('وصف مختصر *</label>','وصف مختصر <span class="muted">(اختياري)</span></label>'),
 ('المهارات أو المعارف المكتسبة *</label>','المهارات المكتسبة <span class="muted">(اختياري)</span></label>'),
 ("قيّم مستواك الحالي بصدق في كل كفاية. تقييمك الذاتي يُقارَن بتقييم رئيسك المباشر، والفجوة تحدد احتياجك التدريبي.","اختر مستواك الحالي في كل مهارة بصدق. نقارنه بتقييم رئيسك، ومنه نقترح لك الدورات المناسبة."),
 ("  }else if(status==='pending_lm'&&u.managerId){\n","  }else if(status==='pending_lm'&&u.managerId){\n    notify(userId,`استلمنا طلبك: ${c.title}`,'ننتظر موافقة رئيسك',`<p>وصل طلب تسجيلك في دورة <b>${esc(c.title)}</b> إلى <b>${esc((U(u.managerId)||{}).name||'رئيسك')}</b>. بيوصلك إشعار أول ما يعتمده.</p>`,'عرض دوراتي','my-learning');\n"),

 (".pattern{position:absolute;inset:0;opacity:.13;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 60 60' fill='none' stroke='%239DDAE5' stroke-width='1'%3E%3Crect x='10' y='10' width='40' height='40'/%3E%3Cpath d='M30 1.7L58.3 30 30 58.3 1.7 30z'/%3E%3Ccircle cx='30' cy='30' r='9'/%3E%3Ccircle cx='30' cy='30' r='3'/%3E%3C/svg%3E\");}",
  ".pattern{position:absolute;inset:0;opacity:.13;background-image:url(\"/brand-pattern.svg\");background-size:142px}"),
 (".side .pattern{opacity:.07;background-size:72px;", ".side .pattern{opacity:.1;background-size:132px;"),
 (".opp .top-s .pattern{opacity:.18;background-size:56px}", ".opp .top-s .pattern{opacity:.2;background-size:104px}"),
]
for a_,b_ in R11:
    assert a_ in h, 'R11 missing: '+a_[:80]
    h=h.replace(a_,b_,1)
h=h.replace("${pg('تقييم كفاياتي',","${pg('تقييم مهاراتي',")

# ===== الشهادة: تصميم على دليل الهوية =====
import re as _re
_cert_old = _re.search(r"^  mask\(`\$\{mHead\('شهادة إتمام تدريبي'\)\}.*$", h, _re.M)
assert _cert_old, 'cert line not found'
_CERT = r"""  const line=[`بواقع <b style="color:var(--navy);font-weight:600">${num(x.hours)} ساعات تدريبية</b>`,
              `بتاريخ <b style="color:var(--navy);font-weight:600">${fmt(x.date)}</b>`]
             .concat(t?[`بإشراف <b style="color:var(--navy);font-weight:600">${esc(t.name)}</b>`]:[]).join('<span style="color:var(--sand);margin:0 9px">◆</span>');
  mask(`${mHead('شهادة إتمام تدريبي')}<div class="m-b" style="background:var(--sand)">
   <div id="certbox" style="width:100%;max-width:780px;margin:0 auto;aspect-ratio:297/210;display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--sand);border-radius:12px;overflow:hidden">
    <div style="height:13px;flex:none;background:var(--navy);background-image:url('/brand-pattern.svg');background-size:48px"></div>
    <div style="position:relative;flex:1;min-height:0;overflow:hidden;padding:20px 38px 18px;display:flex;flex-direction:column">
     <div style="position:absolute;inset:0;background-image:url('/brand-pattern.svg');background-size:180px;opacity:.05"></div>
     <div style="position:absolute;top:18px;inset-inline-start:30px;text-align:center">
      <div id="certqr" style="width:54px;height:54px"></div>
      <div class="num" style="font-size:8.5px;color:var(--ink-3);letter-spacing:.03em;margin-top:4px;line-height:1.2">${esc(x.cert)}</div>
     </div>
     <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;text-align:center">
      <img src="${LOGO}" alt="" style="height:58px;width:auto;align-self:center;flex:none">
      <div style="margin-top:6px;font-size:13px;color:var(--ink-2);flex:none">الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</div>
      <div style="font-size:14.5px;font-weight:600;color:var(--navy);letter-spacing:.1em;margin-top:12px;flex:none">شهادة إتمام تدريبي</div>
      <div style="display:flex;align-items:center;gap:9px;margin:9px auto 0;max-width:360px;width:100%;flex:none">
       <i style="flex:1;height:1px;background:var(--sand)"></i>
       <i style="width:6px;height:6px;background:var(--teal);transform:rotate(45deg)"></i>
       <i style="flex:1;height:1px;background:var(--sand)"></i>
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:6px 0">
       <div style="font-size:14px;color:var(--teal);letter-spacing:.04em">تشهد الجمعية بأن</div>
       <div style="font-size:42px;font-weight:600;color:var(--navy);margin:10px 0;line-height:1.3">${esc(u.name)}</div>
       <div style="font-size:14px;color:var(--ink-2)">قد أتمّ بنجاح متطلبات</div>
       <div style="font-size:27px;font-weight:600;color:var(--teal);margin:9px 0 16px;line-height:1.45">${esc(titleOf(x.kind,x.refId))}</div>
       <div style="font-size:13.5px;color:var(--ink-2);line-height:2">${line}</div>
      </div>
      <div style="flex:none;display:flex;justify-content:space-between;align-items:flex-end;gap:30px">
       ${['مدير التدريب','ختم الجمعية'].map(l=>`<div style="width:170px"><i style="display:block;height:1px;background:var(--navy);opacity:.28;margin-bottom:7px"></i><span style="font-size:11px;color:var(--ink-3)">${l}</span></div>`).join('')}
      </div>
     </div>
     ${x.demo?`<div style="position:absolute;top:22px;inset-inline-end:30px;font-size:10px;color:#7A5410;background:#FBEFD9;border-radius:99px;padding:3px 11px">شهادة تجريبية</div>`:''}
    </div>
    <div style="height:13px;flex:none;background:var(--navy);background-image:url('/brand-pattern.svg');background-size:48px"></div>
   </div></div>
   <div class="m-f"><button class="btn sec" data-act="close">إغلاق</button><button class="btn" data-act="cert-pdf" data-id="${x.id}">تنزيل PDF</button></div>`,'wide');
  certQr(x.id);"""
h = h[:_cert_old.start()] + _CERT + h[_cert_old.end():]
_qa = "pdfjs:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'"
assert _qa in h, 'CDN list not found'
h = h.replace(_qa, "qr:'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'," + _qa, 1)

h=h.replace('/* ===== خط ثمانية ===== */','/* ===== خط ثمانية ===== */'+"""
/* ===== شاشة الموظف ===== */
.adm-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0 2px}.adm-bar .inp{width:auto;min-width:140px}.adm-search{position:relative;flex:1;min-width:230px}.adm-search .inp{width:100%}.urow-menu{position:absolute;inset-inline-end:0;top:calc(100% - 4px);z-index:40;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(7,44,73,.16);padding:5px;display:flex;flex-direction:column;min-width:190px;text-align:start}.urow-menu button{padding:9px 12px;border-radius:7px;font-size:13.5px;color:var(--navy);text-align:start;white-space:nowrap}.urow-menu button:hover{background:var(--sand-2)}@media(max-width:700px){.adm-bar .inp,.adm-search{width:100%;flex:1 1 100%}}.ui-pill{position:absolute;left:0;top:0;pointer-events:none;z-index:0;transition:transform .34s cubic-bezier(.4,0,.2,1),height .34s cubic-bezier(.4,0,.2,1),width .34s cubic-bezier(.4,0,.2,1)}.nav>.ui-pill{border-radius:10px;background:rgba(157,218,229,.16)}.nav>.ui-pill:before{content:"";position:absolute;inset-inline-start:-12px;top:10px;bottom:10px;width:4px;background:var(--sky);border-radius:4px}.nav button{z-index:1}.nav button.on{background:transparent}.nav button.on:before{display:none}@media(prefers-reduced-motion:reduce){.ui-pill{transition:none}}@property --p{syntax:"<number>";inherits:false;initial-value:0}@keyframes inUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.in-up{animation:inUp .4s cubic-bezier(.22,.8,.3,1) both;animation-delay:var(--d,0ms)}.ring{transition:--p .9s cubic-bezier(.22,.8,.3,1) .15s}.side-toggle{display:none}@media(min-width:901px){.app{grid-template-columns:var(--sidew,268px) 1fr;transition:grid-template-columns .3s cubic-bezier(.4,0,.2,1)}.side-toggle{display:grid}html.side-off{--sidew:76px}html.side-off .brand{padding:22px 0 16px;justify-content:center}html.side-off .brand img{height:40px}html.side-off .brand div,html.side-off .nav-h,html.side-off .nav button span,html.side-off .save-st,html.side-off .switch-l,html.side-off .switch{display:none}html.side-off .nav{padding:8px 14px}html.side-off .nav button{justify-content:center;padding:11px 0}html.side-off .nav .badge{position:absolute;top:5px;inset-inline-end:7px;min-width:8px;width:8px;height:8px;padding:0;border-radius:50%;font-size:0;overflow:hidden}html.side-off .nav>.ui-pill:before{display:none}html.side-off .side-foot{padding:10px 14px}html.side-off .ev-btn{font-size:0;gap:0;padding:11px 0}}@media(prefers-reduced-motion:reduce){.in-up{animation:none}.app,.ring,.pbar i{transition:none}}.emp-tabs{display:none}
@media(max-width:900px){.emp-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:var(--navy);padding:0 8px;position:sticky;top:0;z-index:20}.emp-tabs button{min-height:46px;color:#CFE0EA;font-size:14.5px;font-weight:500;border-bottom:3px solid transparent}.emp-tabs button.on{color:#fff;font-weight:700;border-bottom-color:transparent}.emp-tabs button{position:relative;z-index:1}.emp-tabs .badge{display:inline-grid;margin-inline-start:5px;vertical-align:middle;min-width:20px;height:20px;border-radius:10px;font-size:11.5px}.emp-tabs>.ui-pill{height:3px;background:var(--sky);border-radius:3px 3px 0 0}}
.emp-sub{display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 18px}
.emp-sub button{min-height:40px;padding:0 16px;border-radius:99px;border:1.5px solid var(--line);background:#fff;color:var(--ink-2);font-weight:500;font-size:14px}
.emp-sub button.on{background:transparent;border-color:transparent;color:#fff;font-weight:600}.emp-sub{position:relative}.emp-sub button{position:relative;z-index:1}.emp-sub>.ui-pill{border-radius:99px;background:var(--navy)}
.emp-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:18px}
.emp-head h1{font-family:var(--display);font-size:30px;color:var(--navy);line-height:1.3}
.emp-head p{color:var(--ink-2);font-size:16px;margin-top:2px}.emp-head p b{color:var(--navy)}
.emp-cols{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.emp-tasks{flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:12px}
.emp-side{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:16px}
.emp-h2{font-size:15px;color:var(--ink-2);font-weight:600;margin:10px 2px 0}
.tk{display:flex;align-items:center;gap:14px;padding:16px 18px;flex-wrap:wrap}
.tk-alert{border-color:#E9B8AC}.tk-wait{background:var(--paper);box-shadow:none}
.tk-ic,.tk-date{width:52px;height:52px;border-radius:13px;display:grid;place-items:center;flex:none}
.tk-ic .i{width:24px;height:24px}
.tk-date{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15}.tk-date span{font-size:11.5px;opacity:.85}.tk-date b{font-size:20px;font-family:var(--display)}
.tk-body{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:3px}
.tk-body b{font-size:16px;color:var(--navy);font-weight:700}.tk-body>span{font-size:14px;color:var(--ink-2)}
.tk-bar{height:8px;border-radius:6px;background:var(--sand);overflow:hidden;max-width:320px;margin-top:4px}.tk-bar i{display:block;height:100%;background:var(--teal)}
.tk-btn{min-height:44px;padding:0 20px}
.emp-prog{background:var(--navy);color:#fff;border:0;padding:20px;display:flex;align-items:center;gap:18px}
.emp-prog .ring div{background:var(--navy)}
.emp-prog-t{display:block;font-size:16px;font-weight:700}.emp-prog span{display:block;font-size:13.5px;color:#C4D8E5;margin-top:2px}
.linkbtn{color:var(--sky);font-size:14px;font-weight:600;padding:6px 0;text-decoration:underline;text-underline-offset:3px}
.emp-rec .linkbtn{color:var(--teal)}
.emp-rec-i{display:flex;flex-direction:column;gap:2px;text-align:start;width:100%;padding:10px 12px;border-radius:12px;background:var(--sand-2);margin-bottom:8px}
.emp-rec-i b{font-size:14.5px;color:var(--navy)}.emp-rec-i span{font-size:13px;color:var(--ink-2)}
.emp-choice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.emp-choice button{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:start;padding:18px;border:1.5px solid var(--line);border-radius:14px;background:#fff}
.emp-choice button:hover{border-color:var(--teal)}.emp-choice .i{width:28px;height:28px;color:var(--teal)}.emp-choice b{font-size:16px;color:var(--navy)}.emp-choice span{font-size:13.5px;color:var(--ink-2)}
@media(max-width:620px){.emp-choice{grid-template-columns:1fr}.emp-head h1{font-size:26px}.tk{padding:14px}.tk-btn{width:100%}}
""",1)

# 13) الجوال: إلغاء التقريب بالضغطتين، حجم الحقول، المنطقة الآمنة، أيقونة الشاشة الرئيسية
_vp='<meta name="viewport" content="width=device-width, initial-scale=1">'
assert _vp in h, 'viewport meta not found'
h=h.replace(_vp,r"""<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F6F3EE">
<meta name="color-scheme" content="light">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="دال">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png">
<link rel="manifest" href="/manifest.webmanifest">""",1)

# ارتفاع الشاشة الحقيقي على iOS: شريط سفاري يتحرك، فـ dvh بدل vh مع إبقاء البديل
h=h.replace('min-height:100vh','min-height:100vh;min-height:100dvh')

_m13='/* ===== شاشة الموظف ===== */'
assert _m13 in h
h=h.replace(_m13,r"""/* ===== الجوال ===== */
/* الضغطتان كانتا تقرّبان الصفحة؛ manipulation تلغي إيماءة التقريب وتبقي التكبير بالأصبعين */
html{touch-action:manipulation;-webkit-text-size-adjust:100%}
/* سفاري يقرّب الصفحة تلقائيًا عند الكتابة في حقل أصغر من 16px */
@media(max-width:900px){.inp,input,select,textarea,.gsearch input{font-size:16px}}
body .content{padding-bottom:calc(34px + env(safe-area-inset-bottom,0px))}
body .login-card{padding-bottom:calc(36px + env(safe-area-inset-bottom,0px))}
/* ===== شاشة الدخول ===== */
.pw-wrap{position:relative}
.pw-wrap .inp{padding-inline-end:48px}
.pw-eye{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:40px;height:40px;display:grid;place-items:center;color:var(--ink-3);border-radius:9px}
.pw-eye:hover{color:var(--teal);background:var(--sand-2)}
.pw-eye .eye-off{display:none}
.pw-wrap.show .pw-eye{color:var(--teal)}
.pw-wrap.show .pw-eye .i:not(.eye-off){display:none}
.pw-wrap.show .pw-eye .eye-off{display:block}
.lg-err{display:none;margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#8E2A1F;background:#FBEAE6;border-radius:10px;padding:10px 13px}
.lg-err.on{display:block}
.lg-help{display:block;margin:16px auto 0;font-size:13.5px;color:var(--teal);font-weight:500;text-decoration:underline;text-underline-offset:3px}
@media(max-width:900px){
 .login-art{padding:18px 20px 22px;gap:12px}
 .login-art .brand-l{gap:8px!important}
 .login-art .brand-l img{height:54px!important}
 .login-art .brand-l b{font-size:21px!important;line-height:1.35!important}
 .login-art .brand-l span{font-size:12px!important}
 .login-art h1{font-size:15.5px;line-height:1.65}
 .login-card{padding-top:22px;border-radius:22px 22px 0 0;margin-top:-10px}
 .login-box h2{font-size:22px}
 .login-box .sub{margin-bottom:16px;font-size:14px}
 .login-box .field{margin-bottom:12px}
 .login-box .btn{min-height:50px}
}
@media(max-width:900px) and (max-height:700px){.login-art h1{display:none}.login-art .brand-l img{height:46px!important}}
/* ===== حركة شاشة الدخول ===== */
/* الخلفية الكحلية تمتد تحت شريط سفاري أيضًا */
html:has(.login),body:has(.login){background:var(--sand-2)}
.login-art::before,.login-art::after{content:"";position:absolute;border-radius:50%;pointer-events:none;filter:blur(64px)}
.login-art::before{width:52vmin;height:52vmin;background:#0E7C9B;opacity:.55;top:-14%;inset-inline-start:-14%}
.login-art::after{width:44vmin;height:44vmin;background:var(--sky);opacity:.2;bottom:-16%;inset-inline-end:-12%}
.login-art .brand-l{position:relative}
.login-box .inp{transition:border-color .2s,box-shadow .25s}
.login-box .inp:focus{outline:2px solid transparent;outline-offset:0;border-color:var(--teal);box-shadow:0 0 0 4px rgba(0,116,151,.14)}
.login-box .field:focus-within label{color:var(--teal)}
.login-box .field label{transition:color .2s}
.login-box .btn{transition:transform .14s cubic-bezier(.4,0,.2,1),box-shadow .22s,filter .2s}
.login-box .btn:active{transform:scale(.985)}
.login-box .btn:not(.sec):not(.sec):hover{box-shadow:0 10px 24px -10px rgba(0,116,151,.7)}
.login-box .btn[disabled]{position:relative;overflow:hidden;opacity:1}
.pw-eye{transition:color .18s,background .18s,transform .18s}
.pw-eye:active{transform:translateY(-50%) scale(.9)}
.lg-help{transition:color .18s,opacity .18s}
.lg-help:active{opacity:.6}
.inp.bad{border-color:#C36F61!important;box-shadow:0 0 0 4px rgba(195,111,97,.16)!important}

@media(prefers-reduced-motion:no-preference){
 @keyframes lgPop{from{opacity:0;transform:scale(.84)}to{opacity:1;transform:scale(1)}}
 @keyframes lgUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
 @keyframes lgSheet{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
 @keyframes lgSide{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}
 @keyframes lgDrift{from{background-position:0 0}to{background-position:142px 82px}}
 @keyframes lgAur1{0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(14%,12%,0) scale(1.18)}}
 @keyframes lgAur2{0%{transform:translate3d(0,0,0) scale(1.1)}100%{transform:translate3d(-12%,-14%,0) scale(1)}}
 @keyframes lgFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
 @keyframes lgSheen{0%{transform:translateX(-130%);opacity:1}92%{opacity:1}100%{transform:translateX(130%);opacity:0}}
 @keyframes lgSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
 @keyframes lgErr{0%{opacity:0;transform:translateY(-8px)}60%{opacity:1;transform:translateY(0)}70%{transform:translateX(5px)}80%{transform:translateX(-4px)}90%{transform:translateX(2px)}100%{transform:none}}

 /* الزخرفة تنساب ببطء، والهالتان تتنفّسان */
 .login-art .pattern{animation:lgDrift 64s linear infinite}
 .login-art::before{animation:lgAur1 19s ease-in-out infinite alternate}
 .login-art::after{animation:lgAur2 24s ease-in-out infinite alternate}

 /* دخول المشهد: الشعار ثم الاسم ثم الجملة، والبطاقة تطلع من تحت */
 .login-art .brand-l img{animation:lgPop .72s cubic-bezier(.2,.9,.3,1.25) both,lgFloat 7s ease-in-out 1.2s infinite}
 .login-art .brand-l>div{animation:lgUp .6s cubic-bezier(.22,.8,.3,1) .14s both}
 .login-art h1{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .26s both}
 .login-art p{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .36s both}
 .login-art .stats-row{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .44s both}
 /* لمعة تمرّ على الشعار مرة واحدة */
 .login-art .brand-l::after{content:"";position:absolute;inset:-6% -14%;background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%);animation:lgSheen 1.45s cubic-bezier(.4,0,.2,1) .55s 1 both;pointer-events:none}
 .login-card{animation:lgSide .66s cubic-bezier(.2,.8,.25,1) .1s both}
 @media(max-width:900px){.login-card{animation-name:lgSheet;animation-delay:.18s}}
 /* عناصر النموذج واحدة ورا الثانية */
 .login-box>*{animation:lgUp .52s cubic-bezier(.22,.8,.3,1) both}
 .login-box>*:nth-child(1){animation-delay:.30s}
 .login-box>*:nth-child(2){animation-delay:.37s}
 .login-box>*:nth-child(3){animation-delay:.42s}
 .login-box>*:nth-child(4){animation-delay:.47s}
 .login-box>*:nth-child(5){animation-delay:.52s}
 .login-box>*:nth-child(6){animation-delay:.52s}
 .login-box>*:nth-child(7){animation-delay:.57s}
 .login-box>*:nth-child(8){animation-delay:.62s}
 .lg-err{animation:none}
 .lg-err.on{animation:lgErr .52s cubic-bezier(.3,.8,.3,1) both}
 /* شريط ضوئي يمرّ على الزر أثناء التحقق */
 .login-box .btn[disabled]::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:lgSweep 1.05s linear infinite}
 /* نجاح الدخول: المشهد ينسحب قبل ما تُرسم المنصة */
 .login.out .login-card{opacity:0;transform:translateY(16px);transition:opacity .26s ease-in,transform .26s ease-in}
 .login.out .login-art{opacity:.45;transition:opacity .26s ease-in}
 .login.out .login-art .brand-l img{transform:scale(.94);transition:transform .26s ease-in}
}
/* ===== شاشة الدخول: نهار، وزخرفة الهوية =====
   الألوان من دليل الهوية ص١٤: نيلي #072C49 · غامق #007497 · فاتح #9DDAE5 · بني #ECE6DD */
.lg2{
 --lg-ink:#072C49; --lg-mut:#6D8394; --lg-acc:#007497; --lg-acc-2:#005B78; --lg-acc-3:#9DDAE5;
 --lg-edge:rgba(7,44,73,.1);
 position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;color:var(--lg-ink);
 background:var(--sand-2);
 display:flex;flex-direction:column;
}
.lg-bg{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.lg-bg::before{content:"";position:absolute;inset:0;
 background:radial-gradient(130% 78% at 50% -8%,#FFFFFF 0%,#FBF9F5 32%,#F4EFE7 66%,#ECE6DD 100%)}
/* هالتان ضوئيتان */
.lg-aur{position:absolute;border-radius:50%;filter:blur(70px)}
.lg-aur.a{width:62vmin;height:62vmin;background:var(--sky);opacity:.45;top:-18%;inset-inline-start:-18%}
.lg-aur.b{width:46vmin;height:46vmin;background:var(--sand);opacity:.6;bottom:-14%;inset-inline-end:-16%}
/* زخرفة الهوية: واحدة كبيرة خلف الشعار، وشبكة خافتة تغطي الخلفية */
.lg-rose{position:absolute;background:url("/brand-motif-l.svg") center/contain no-repeat;opacity:.1}
.lg-rose.two{width:min(66vw,300px);aspect-ratio:84/96;bottom:-12%;inset-inline-start:-18%;opacity:.055}
.lg-mesh{position:absolute;inset:0;background:url("/brand-mesh-l.svg") 0 0/172px;opacity:.06}
.lg-bg::after{content:"";position:absolute;inset:0;background:radial-gradient(124% 82% at 50% 36%,transparent 54%,rgba(7,44,73,.09) 100%)}
/* حُبيبات تكسر نعومة التدرّج */
.lg-grain{position:absolute;inset:0;opacity:.035;mix-blend-mode:multiply;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}
/* شريط زخرفي أعلى الصفحة */
.lg-band{position:absolute;top:0;inset-inline:0;height:40px;
 background:url("/brand-band-l.svg") center/auto 40px repeat-x;opacity:.26;
 border-bottom:1px solid rgba(7,44,73,.07);
 -webkit-mask-image:linear-gradient(to left,transparent,#000 14%,#000 86%,transparent);
 mask-image:linear-gradient(to left,transparent,#000 14%,#000 86%,transparent)}

.lg-wrap{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(18px,4vh,34px);
 width:100%;max-width:440px;margin:0 auto;
 padding:calc(40px + env(safe-area-inset-top,0px)) max(20px,env(safe-area-inset-left,0px)) calc(26px + env(safe-area-inset-bottom,0px)) max(20px,env(safe-area-inset-right,0px))}

/* ===== الترويسة ===== */
.lg-head{text-align:center;display:flex;flex-direction:column;align-items:center}
.dal-w{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.dal-w b{font-family:'Noto Kufi Arabic','Readex Pro',Tahoma,sans-serif;font-size:40px;font-weight:700;line-height:1;color:#007497;letter-spacing:-1px;white-space:nowrap}
.dal-w span{font-family:'Noto Kufi Arabic','Readex Pro',Tahoma,sans-serif;font-size:14px;font-weight:400;color:#007497;letter-spacing:.5px}
.lg-logo{position:relative;display:flex;flex-direction:row;align-items:center;gap:16px;margin-bottom:6px}
.lg-logo img{height:76px;width:auto;transform:translateY(-9.8%)}
/* شعار الجمعية في الرأسين الداكنين: العلامة بيضاء بحجم مناسب */
.logo-w.dal{height:30px!important;width:auto}
.lg-kicker{font-size:13.5px;color:var(--lg-mut);letter-spacing:.06em;margin-top:2px}
.lg2 h1{font-family:var(--display);font-size:clamp(27px,7.4vw,34px);font-weight:700;line-height:1.35;margin-top:4px;
 background:linear-gradient(180deg,#072C49 28%,#13456B 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.lg-org{font-size:14.5px;color:var(--lg-acc);font-weight:600;margin-top:6px}
.lg-date{margin-top:14px;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--lg-mut);
 border:1px solid rgba(0,116,151,.22);border-radius:99px;padding:5px 14px;background:rgba(255,255,255,.65)}
.lg-date i{width:5px;height:5px;background:var(--lg-acc);transform:rotate(45deg);flex:none}

/* ===== البطاقة الزجاجية ===== */
.lg-card{position:relative;width:100%;border-radius:20px;padding:18px;overflow:hidden;
 background:linear-gradient(165deg,rgba(255,255,255,.95),rgba(255,255,255,.8));
 border:1px solid var(--lg-edge);
 box-shadow:0 22px 52px -34px rgba(7,44,73,.42),inset 0 1px 0 rgba(255,255,255,.9);
 -webkit-backdrop-filter:blur(14px) saturate(130%);backdrop-filter:blur(14px) saturate(130%)}
.lg-card::before{content:"";position:absolute;inset:0;border-radius:20px;pointer-events:none;
 background:linear-gradient(140deg,rgba(255,255,255,.8),transparent 44%)}
.lg-card>*{position:relative}

/* مفتاح البوابة */

.lg-card .field{display:grid;gap:7px;margin-bottom:13px}
.lg-card .field label{font-size:13px;font-weight:600;color:var(--lg-mut);transition:color .2s}
.lg-card .field:focus-within label{color:var(--lg-acc)}
.lg-card .inp{width:100%;min-height:50px;padding:10px 14px;border-radius:12px;color:var(--lg-ink);
 background:#fff;border:1px solid rgba(7,44,73,.14);
 transition:border-color .2s,box-shadow .25s,background .2s}
.lg-card .inp::placeholder{color:rgba(109,131,148,.6)}
.lg-card .inp:focus{outline:2px solid transparent;border-color:var(--lg-acc);
 box-shadow:0 0 0 4px rgba(0,116,151,.13)}
.lg-card .inp.bad{border-color:#C36F61!important;box-shadow:0 0 0 4px rgba(195,111,97,.16)!important}
.lg-card .inp:-webkit-autofill{-webkit-text-fill-color:var(--lg-ink);-webkit-box-shadow:0 0 0 1000px #fff inset;caret-color:var(--lg-ink)}
.lg-card .pw-eye{color:var(--lg-mut)}
.lg-card .pw-eye:hover,.lg-card .pw-wrap.show .pw-eye{color:var(--lg-acc);background:rgba(7,44,73,.05)}

.lg-err{display:none;margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#A4473A;
 background:rgba(195,111,97,.1);border:1px solid rgba(195,111,97,.32);border-radius:11px;padding:10px 13px}
.lg-err.on{display:block}

.lg-go{position:relative;width:100%;min-height:52px;border-radius:13px;overflow:hidden;
 display:flex;align-items:center;justify-content:center;gap:10px;
 font-size:16px;font-weight:700;color:#fff;
 background:linear-gradient(135deg,#0E8FB5 0%,var(--lg-acc) 52%,var(--lg-acc-2) 100%);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.22);
 transition:transform .14s cubic-bezier(.4,0,.2,1),filter .2s}
.lg-go:hover{filter:brightness(1.06)}
.lg-go:active{transform:scale(.985)}
.lg-go .i{width:19px;height:19px;stroke-width:2.1}
.lg-go[disabled]{opacity:1}

.lg-hint{margin:14px 0 0;text-align:center;font-size:12px;line-height:1.7;color:var(--ink-3)}
.lg-help{display:block;margin:15px auto 2px;font-size:13.5px;color:var(--lg-mut);font-weight:500;
 text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(0,116,151,.35);transition:color .2s}
.lg-help:hover{color:var(--lg-acc)}

.lg-foot{text-align:center;font-size:11.5px;line-height:1.9;color:var(--ink-3)}
.lg-foot b{display:block;font-weight:600;color:var(--ink-2);font-size:12.5px}

/* شاشة الإقلاع بنفس الجو */
.lg-boot{min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:var(--sand-2);color:var(--ink-3);gap:14px}
.lg-boot .d{display:flex;gap:6px}
.lg-boot .d i{width:7px;height:7px;border-radius:50%;background:var(--teal,#007497);opacity:.4}

/* شاشات أقصر: نختصر الترويسة */
@media(max-height:760px){
 .lg-wrap{gap:16px;padding-top:calc(26px + env(safe-area-inset-top,0px))}
 .lg-logo{gap:12px}.lg-logo img{height:62px}.dal-w b{font-size:30px}.dal-w span{font-size:12px}
 .lg-date{margin-top:10px}
}
@media(max-height:680px){
 .lg-kicker,.lg-date,.lg-foot{display:none}
 .lg-logo{gap:10px}.lg-logo img{height:54px}.dal-w b{font-size:27px}.dal-w span{font-size:11px}
}
@media(max-height:620px){
 .lg-wrap{gap:12px;padding-top:calc(16px + env(safe-area-inset-top,0px))}
 .lg-logo{gap:9px}.lg-logo img{height:46px}.dal-w b{font-size:23px}.dal-w span{font-size:10px}
 .lg2 h1{font-size:24px}.lg-org{font-size:13px;margin-top:4px}
 .lg-card{padding:15px}
 .lg-card .field{margin-bottom:11px;gap:5px}
 .lg-card .inp{min-height:46px}
 .lg-go{min-height:48px}.lg-help{margin-top:11px}
}
@media(min-width:901px){
 .lg-wrap{max-width:470px;gap:30px}
 .lg-card{padding:24px}
 }

@media(prefers-reduced-motion:no-preference){
 @keyframes lgRose{from{transform:rotate(0)}to{transform:rotate(360deg)}}
 @keyframes lgRose2{from{transform:rotate(360deg)}to{transform:rotate(0)}}
 @keyframes lgMesh{from{background-position:0 0}to{background-position:168px 97px}}
 @keyframes lgAurA{0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(16%,13%,0) scale(1.2)}}
 @keyframes lgAurB{0%{transform:translate3d(0,0,0) scale(1.12)}100%{transform:translate3d(-14%,-16%,0) scale(1)}}
 @keyframes lgSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
 @keyframes lgDraw{from{stroke-dashoffset:470}to{stroke-dashoffset:0}}
 @keyframes lgPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
 @keyframes lgUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
 @keyframes lgCard{from{opacity:0;transform:translateY(34px) scale(.98)}to{opacity:1;transform:none}}
 @keyframes lgSheen{0%{transform:translateX(-130%);opacity:1}92%{opacity:1}100%{transform:translateX(130%);opacity:0}}
 @keyframes lgSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
 @keyframes lgErr{0%{opacity:0;transform:translateY(-8px)}60%{opacity:1;transform:translateY(0)}70%{transform:translateX(5px)}80%{transform:translateX(-4px)}90%{transform:translateX(2px)}100%{transform:none}}
 @keyframes lgDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-5px)}}

  .lg-rose.two{animation:lgRose2 190s linear infinite}
 .lg-mesh{animation:lgMesh 70s linear infinite}
 .lg-aur.a{animation:lgAurA 20s ease-in-out infinite alternate}
 .lg-aur.b{animation:lgAurB 26s ease-in-out infinite alternate}

 .lg-logo{animation:lgPop .8s cubic-bezier(.2,.9,.3,1.25) both}
   .lg-kicker{animation:lgUp .6s cubic-bezier(.22,.8,.3,1) .22s both}
 .lg2 h1{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .3s both}
 .lg-org{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .4s both}
 .lg-date{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .5s both}
 .lg-card{animation:lgCard .74s cubic-bezier(.2,.8,.25,1) .42s both}
 .lg-foot{animation:lgUp .7s cubic-bezier(.22,.8,.3,1) .8s both}
 .lg-card .field,.lg-go,.lg-help{animation:lgUp .5s cubic-bezier(.22,.8,.3,1) both}
 .lg-card .field:nth-of-type(1){animation-delay:.64s}
 .lg-card .field:nth-of-type(2){animation-delay:.7s}
 .lg-go{animation-delay:.76s}
 .lg-help{animation-delay:.82s}
 .lg-err.on{animation:lgErr .52s cubic-bezier(.3,.8,.3,1) both}
 /* بريق يمرّ على البطاقة مرة */
 .lg-card::after{content:"";position:absolute;inset:0;border-radius:20px;overflow:hidden;pointer-events:none;
  background:linear-gradient(104deg,transparent 42%,rgba(157,218,229,.3) 50%,transparent 58%);
  animation:lgSheen 1.9s cubic-bezier(.4,0,.2,1) 1s 1 both}
 .lg-go[disabled]::after{content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:lgSweep 1s linear infinite}
 .lg-boot .d i{animation:lgDot 1.1s ease-in-out infinite}
 .lg-boot .d i:nth-child(2){animation-delay:.14s}
 .lg-boot .d i:nth-child(3){animation-delay:.28s}
 /* انسحاب المشهد عند النجاح */
 .lg2.out .lg-card{opacity:0;transform:translateY(20px) scale(.985);transition:opacity .3s ease-in,transform .3s ease-in}
 .lg2.out .lg-head{opacity:0;transform:translateY(-14px);transition:opacity .3s ease-in .04s,transform .3s ease-in .04s}
 .lg2.out .lg-bg{opacity:.5;transition:opacity .3s ease-in}
}
/* ===== شاشة الموظف ===== */""",1)

# 12) قائمة موحّدة حسب الصلاحيات
_s=h.index('<nav class="nav" aria-label="القائمة الرئيسية">');_e=h.index('</nav>',_s)+len('</nav>')
h=h[:_s]+'${unifiedNavHtml()}'+h[_e:]
_a="""    ${u.roles.length>1?`<div class="switch-l">الصفة الحالية</div><div class="switch" style="flex-wrap:wrap">${u.roles.map(r=>`<button data-act="role" data-role="${r}" class="${S.role===r?'on':''}">${ROLES[r]}</button>`).join('')}</div>`:''}\n"""
assert _a in h, 'switch block';h=h.replace(_a,'',1)

for a_, b_ in REPL:
    assert a_ in h, 'missing: ' + a_[:60]
    h = h.replace(a_, b_)

open(dst, 'w', encoding='utf-8').write(h)
print('ok', len(h))
