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
  if(S.booting)return `<div style="min-height:100vh;display:grid;place-items:center;color:var(--ink-2)">جارٍ الاتصال بالخادم…</div>`;
  const trainer=S.portal==='trainer';
  return `<div class="login">
 <section class="login-art"><div class="pattern"></div>
  <div class="brand-l" style="display:flex;flex-direction:column;align-items:center;gap:12px"><img class="logo-w" src="${LOGO}" alt="شعار تحفيظ بريدة" style="height:84px"><div><b style="font-size:30px;font-weight:600;display:block;line-height:1.4">منصة التطوير والتدريب</b><span style="color:#9FB8CA;font-size:14px">الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</span></div></div>
  <div><h1>نبني <em>كفاءة</em> من يخدمون كتاب الله، خطوة تدريبية بعد أخرى.</h1><p>احتياج مُحلَّل، وخطة منفّذة، وتعلّم مُتتبَّع فعليًا، وأثر مقيس بأدلة موثّقة.</p></div><div></div>
 </section>
 <section class="login-card"><div class="login-box">
  <div class="row" style="gap:8px;margin-bottom:10px" role="tablist"><button class="btn ${trainer?'sec':''} sm" role="tab" data-act="portal" data-p="staff" aria-selected="${!trainer}">الموظفون والإدارة</button><button class="btn ${trainer?'':'sec'} sm" role="tab" data-act="portal" data-p="trainer" aria-selected="${trainer}">بوابة المدربين</button></div>
  <h2>${trainer?'بوابة المدربين':'تسجيل الدخول'}</h2><p class="sub">ادخل ببريدك الرسمي وكلمة المرور.</p>
  <div class="field"><label for="lg_email">البريد الرسمي</label><input class="inp" id="lg_email" type="email" dir="ltr" placeholder="name@qb.org.sa" autocomplete="username"></div>
  <div class="field"><label for="lg_pw">كلمة المرور</label><input class="inp" id="lg_pw" type="password" dir="ltr" autocomplete="current-password"></div>
  <button class="btn" style="width:100%" data-act="login-email" id="lg_btn">تسجيل الدخول</button>
  <p class="login-note" id="lg_err" role="alert" style="color:var(--bad)"></p>
 </div></section></div>`;
}
Object.assign(ACT,{
  async 'login-email'(){
    const em=fieldVal('lg_email').toLowerCase(),pw=($('#lg_pw')||{}).value||'',err=$('#lg_err'),btn=$('#lg_btn');
    if(!emailOk(em)){err.textContent='أدخل بريدًا صالحًا';return}
    if(!pw){err.textContent='أدخل كلمة المرور';return}
    btn.disabled=true;btn.textContent='جارٍ التحقق…';
    try{
      const r=await api('/api/login',{method:'POST',body:JSON.stringify({email:em,password:pw})});
      if(S.portal==='trainer'&&!r.user.roles.includes('trainer')){await api('/api/logout');err.textContent='هذه البوابة للمدربين فقط';btn.disabled=false;btn.textContent='تسجيل الدخول';return}
      S.role=ROLE_PRI.find(x=>r.user.roles.includes(x));
      S.mustChange=!!r.mustChange;await loadAll();doLogin(r.user.id);if(S.mustChange)askPwChange(true);
    }catch(e){err.textContent=e.message;btn.disabled=false;btn.textContent='تسجيل الدخول'}
  },
  login(){},
  async logout(){audit('logout','session','');detachPlayer();await flush();try{await api('/api/logout')}catch(e){}S.me=null;S.role=null;P.loaded=false;COLS.forEach(c=>DB[c]=[]);draw()},
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='lg_pw')ACT['login-email']()});
"""+"".join(open(os.path.join(os.path.dirname(__file__),n),encoding="utf-8").read()+"\n" for n in ("client-extra.js","reports.js","employee.js","tracks.js","nav.js"))+r"""
"""
boot_a = h.index('(async function boot(){')
boot_b = h.index('})();', boot_a) + len('})();')
BOOT = r"""(async function boot(){
  S.booting=true;draw();
  if(location.hash==='#trainers')S.portal='trainer';
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
.tabs{scrollbar-width:thin;-webkit-mask-image:linear-gradient(to left,#000 92%,transparent);mask-image:linear-gradient(to left,#000 92%,transparent)}
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
 ('<div class="note warn" style="margin-bottom:14px">تنبيه: الصلاحيات هنا تُطبَّق داخل الواجهة فقط. لا يوجد خادم مصادقة؛ فالفصل الأمني الحقيقي بين الأدوار يتطلب ربطًا بـ Microsoft Entra ID وطبقة خادم.</div>','<div class="note" style="margin-bottom:14px">الصلاحيات تُطبَّق على الخادم: كل حساب يرى وينفّذ ما تسمح به صفته فقط. لإصدار كلمة مرور مؤقتة لأي مستخدم استخدم زر «كلمة المرور».</div>'),
 ("'extreq','visits','retakes','files'];","'extreq','visits','retakes','files','tracks','trackprog'];"),
 ('وصف مختصر *</label>','وصف مختصر <span class="muted">(اختياري)</span></label>'),
 ('المهارات أو المعارف المكتسبة *</label>','المهارات المكتسبة <span class="muted">(اختياري)</span></label>'),
 ("قيّم مستواك الحالي بصدق في كل كفاية. تقييمك الذاتي يُقارَن بتقييم رئيسك المباشر، والفجوة تحدد احتياجك التدريبي.","اختر مستواك الحالي في كل مهارة بصدق. نقارنه بتقييم رئيسك، ومنه نقترح لك الدورات المناسبة."),
 ("  }else if(status==='pending_lm'&&u.managerId){\n","  }else if(status==='pending_lm'&&u.managerId){\n    notify(userId,`استلمنا طلبك: ${c.title}`,'ننتظر موافقة رئيسك',`<p>وصل طلب تسجيلك في دورة <b>${esc(c.title)}</b> إلى <b>${esc((U(u.managerId)||{}).name||'رئيسك')}</b>. بيوصلك إشعار أول ما يعتمده.</p>`,'عرض دوراتي','my-learning');\n"),
]
for a_,b_ in R11:
    assert a_ in h, 'R11 missing: '+a_[:80]
    h=h.replace(a_,b_,1)
h=h.replace("${pg('تقييم كفاياتي',","${pg('تقييم مهاراتي',")
h=h.replace('/* ===== خط ثمانية ===== */','/* ===== خط ثمانية ===== */'+"""
/* ===== شاشة الموظف ===== */
.emp-tabs{display:none}
@media(max-width:900px){.emp-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:var(--navy);padding:0 8px;position:sticky;top:0;z-index:20}.emp-tabs button{min-height:46px;color:#CFE0EA;font-size:14.5px;font-weight:500;border-bottom:3px solid transparent}.emp-tabs button.on{color:#fff;font-weight:700;border-bottom-color:var(--sky)}}
.emp-sub{display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 18px}
.emp-sub button{min-height:40px;padding:0 16px;border-radius:99px;border:1.5px solid var(--line);background:#fff;color:var(--ink-2);font-weight:500;font-size:14px}
.emp-sub button.on{background:var(--navy);border-color:var(--navy);color:#fff;font-weight:600}
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
