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
    P.failed=false;P.online=true;P.msg='محفوظ في الخادم · '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
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
"""+"".join(open(os.path.join(os.path.dirname(__file__),n),encoding="utf-8").read()+"\n" for n in ("client-extra.js","reports.js"))+r"""
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

for a_, b_ in REPL:
    assert a_ in h, 'missing: ' + a_[:60]
    h = h.replace(a_, b_)

open(dst, 'w', encoding='utf-8').write(h)
print('ok', len(h))
