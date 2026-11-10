/* ================= منشئ التقارير: الفترة × النطاق × التصدير ================= */
// مدير التدريب: الجمعية كاملة أو أي إدارة أو قسم أو موظف.
// الرئيس المباشر (مدير الإدارة/القسم): قسمه ومن يتبعونه فقط.
(function(){
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parseD=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
function presetRange(p){
  const t=parseD(TODAY()),y=t.getFullYear(),m=t.getMonth();
  const wkStart=new Date(t);wkStart.setDate(t.getDate()-t.getDay()); // الأسبوع يبدأ الأحد
  switch(p){
    case 'week':return [isoD(wkStart),isoD(t)];
    case 'lastweek':{const e=new Date(wkStart);e.setDate(e.getDate()-1);const s=new Date(e);s.setDate(e.getDate()-6);return [isoD(s),isoD(e)]}
    case 'month':return [isoD(new Date(y,m,1)),isoD(t)];
    case 'lastmonth':return [isoD(new Date(y,m-1,1)),isoD(new Date(y,m,0))];
    case 'quarter':return [isoD(new Date(y,Math.floor(m/3)*3,1)),isoD(t)];
    case 'year':return [y+'-01-01',isoD(t)];
    case 'lastyear':return [(y-1)+'-01-01',(y-1)+'-12-31'];
    default:return null;
  }
}
const PRESETS=[['week','هذا الأسبوع'],['lastweek','الأسبوع الماضي'],['month','هذا الشهر'],['lastmonth','الشهر الماضي'],['quarter','هذا الربع'],['year','هذا العام'],['lastyear','العام الماضي'],['custom','فترة مخصّصة']];
const SCOPES=[['org','الجمعية كاملة'],['dir','إدارة'],['sec','قسم'],['user','موظف']];

// من يحق للمستخدم الحالي رؤية تقاريرهم
function allowedEmps(){
  const all=allEmployees();
  if(S.role==='trainmgr')return all;
  const me=ME();if(!me)return [];
  const reports=new Set([me.id]);let grew=true;
  while(grew){grew=false;for(const u of DB.users)if(u.managerId&&reports.has(u.managerId)&&!reports.has(u.id)){reports.add(u.id);grew=true}}
  return all.filter(u=>reports.has(u.id)||(u.deptId&&u.deptId===me.deptId));
}
function scopeOptions(){
  const emps=allowedEmps(),secIds=new Set(emps.map(u=>u.deptId).filter(Boolean));
  const secs=DB.depts.filter(d=>inc(d)&&d.type!=='dir'&&secIds.has(d.id));
  const dirs=DB.depts.filter(d=>inc(d)&&d.type==='dir'&&(S.role==='trainmgr'||secs.some(s=>s.parent===d.id&&DB.depts.filter(x=>x.parent===d.id).every(x=>secIds.has(x.id)))));
  const scopes=S.role==='trainmgr'?SCOPES:SCOPES.filter(([k])=>k!=='org'&&(k!=='dir'||dirs.length));
  return {emps,secs,dirs,scopes};
}
function rbState(){
  if(!S.rb){
    const o=scopeOptions(),r=presetRange('month');
    S.rb={preset:'month',from:r[0],to:r[1],scope:S.role==='trainmgr'?'org':'sec',dir:(o.dirs[0]||{}).id||'',sec:(o.secs[0]||{}).id||'',user:(o.emps[0]||{}).id||''};
  }
  return S.rb;
}
function scopeEmpsRb(f){
  const emps=allowedEmps();
  if(f.scope==='org')return emps;
  if(f.scope==='dir')return emps.filter(u=>dirOfDept(u.deptId)===f.dir||u.deptId===f.dir);
  if(f.scope==='sec')return emps.filter(u=>u.deptId===f.sec);
  return emps.filter(u=>u.id===f.user);
}
const scopeLabel=f=>f.scope==='org'?'الجمعية كاملة':f.scope==='dir'?deptName(f.dir):f.scope==='sec'?deptName(f.sec):((U(f.user)||{}).name||'—');
const inR=(d,f)=>d&&d.slice(0,10)>=f.from&&d.slice(0,10)<=f.to;
const refTitle=c=>((c.kind==='c'?DB.courses.find(x=>x.id===c.refId)||DB.programs.find(x=>x.id===c.refId):c.kind==='l'?DB.libs.find(x=>x.id===c.refId):DB.readings.find(x=>x.id===c.refId))||{}).title||'—';
const KIND={c:'دورة حضورية',l:'المكتبة الإلكترونية',r:'مادة مقروءة'};

function compute(f){
  const emps=scopeEmpsRb(f),ids=new Set(emps.map(u=>u.id));
  const rows=[],acts=[];
  for(const u of emps){
    const cs=DB.completions.filter(c=>c.userId===u.id&&inc(c)&&inR(c.date,f));
    const ex=DB.extreq.filter(x=>x.userId===u.id&&x.status==='approved'&&inc(x)&&inR(x.date,f));
    const vs=DB.visits.filter(v=>v.userId===u.id&&v.status==='approved'&&inc(v)&&inR(v.date,f));
    const en=DB.enrolls.filter(e=>e.userId===u.id&&inc(e)&&!['cancelled','canceled','withdrawn','rejected'].includes(e.status)).map(e=>({e,c:DB.courses.find(c=>c.id===e.courseId)})).filter(x=>x.c&&inR(x.c.date,f)&&x.c.date<=TODAY());
    const pre=DB.tests.filter(t=>t.userId===u.id&&inc(t)&&t.kind==='pre'&&inR(t.at,f)),post=DB.tests.filter(t=>t.userId===u.id&&inc(t)&&t.kind==='post'&&inR(t.at,f));
    const sv=DB.surveys.filter(s=>s.userId===u.id&&inc(s)&&inR(s.at,f));
    const me=DB.mgrEvals.filter(m=>m.userId===u.id&&inc(m)&&inR(m.at,f));
    const h={c:sum(cs.filter(c=>c.kind==='c').map(c=>c.hours)),l:sum(cs.filter(c=>c.kind==='l').map(c=>c.hours)),r:sum(cs.filter(c=>c.kind!=='c'&&c.kind!=='l').map(c=>c.hours)),x:sum(ex.map(x=>x.hours))};
    const att=en.filter(x=>x.e.att===true||x.e.status==='completed').length;
    rows.push({u,h,total:h.c+h.l+h.r+h.x,courses:cs.filter(c=>c.kind==='c').length,libs:cs.filter(c=>c.kind==='l').length,ext:ex.length,visits:vs.length,
      enr:en.length,att,pre:pre.length?avg(pre.map(t=>t.score)):null,post:post.length?avg(post.map(t=>t.score)):null,postN:post.length,
      sat:sv.length?avg(sv.map(surveyPct)):null,satN:sv.length,imp:me.length?avg(me.map(m=>m.rating)):null,impN:me.length,certs:cs.filter(c=>c.cert).length});
    cs.forEach(c=>acts.push({date:c.date,u,type:KIND[c.kind]||'إنجاز',title:refTitle(c),hours:c.hours}));
    ex.forEach(x=>acts.push({date:x.date,u,type:'دورة خارجية معتمدة',title:x.title+(x.provider?' — '+x.provider:''),hours:x.hours}));
    vs.forEach(v=>acts.push({date:v.date,u,type:'زيارة ميدانية معتمدة',title:v.org||'—',hours:null}));
  }
  rows.sort((a,b)=>b.total-a.total);acts.sort((a,b)=>b.date.localeCompare(a.date));
  const T=k=>sum(rows.map(r=>r[k])),H=k=>sum(rows.map(r=>r.h[k]));
  const allPre=rows.filter(r=>r.pre!=null),allPost=rows.filter(r=>r.post!=null);
  const wAvg=(arr,v,n)=>{const tot=sum(arr.map(r=>r[n]||1));return tot?sum(arr.map(r=>r[v]*(r[n]||1)))/tot:null};
  const sum_={emps:rows.length,total:T('total'),hc:H('c'),hl:H('l'),hr:H('r'),hx:H('x'),courses:T('courses'),libs:T('libs'),ext:T('ext'),visits:T('visits'),enr:T('enr'),att:T('att'),certs:T('certs'),
    active:rows.filter(r=>r.total>0).length,
    pre:allPre.length?avg(allPre.map(r=>r.pre)):null,post:allPost.length?wAvg(allPost,'post','postN'):null,postN:T('postN'),
    sat:rows.some(r=>r.sat!=null)?wAvg(rows.filter(r=>r.sat!=null),'sat','satN'):null,satN:T('satN'),
    imp:rows.some(r=>r.imp!=null)?wAvg(rows.filter(r=>r.imp!=null),'imp','impN'):null,impN:T('impN')};
  // تجميع حسب القسم
  const bySec={};
  for(const r of rows){const k=r.u.deptId||'—';(bySec[k]=bySec[k]||{id:k,n:0,total:0,courses:0,ext:0,active:0,sat:[],}).n++;const g=bySec[k];g.total+=r.total;g.courses+=r.courses+r.libs;g.ext+=r.ext;if(r.total>0)g.active++;if(r.sat!=null)g.sat.push(r.sat)}
  const secs=Object.values(bySec).map(g=>({...g,name:deptName(g.id),dir:deptName(dirOfDept(g.id)),avgH:g.n?g.total/g.n:0,sat:g.sat.length?avg(g.sat):null})).sort((a,b)=>b.total-a.total);
  return {rows,acts,sum:sum_,secs,ids};
}

const empN=n=>n===1?'موظف واحد':n===2?'موظفان':(n%100>=3&&n%100<=10)?N(n)+' موظفين':N(n)+' موظفًا';
const actN=n=>n===1?'نشاط واحد':n===2?'نشاطان':(n%100>=3&&n%100<=10)?N(n)+' أنشطة':N(n)+' نشاطًا';
const pct=(a,b)=>b?Math.round(a/b*100):null;
const nOr=(v,d=0,suf='')=>v==null?'—':num(v,d)+suf;
function tile(label,value,sub){return `<div class="card kpi-c"><span class="t">${esc(label)}</span><span class="v num">${value}</span>${sub?`<span class="ins">${sub}</span>`:''}</div>`}

function vReportBuilder(){
  const f=rbState(),o=scopeOptions(),R=compute(f),s=R.sum;
  const sel=(k,opts,v,label)=>`<label class="field" style="margin:0;min-width:150px"><span class="small muted">${label}</span><select class="inp" data-rb="${k}" id="rb_${k}">${opts.map(([a,b])=>`<option value="${esc(a)}"${a===v?' selected':''}>${esc(b)}</option>`).join('')}</select></label>`;
  const scopeVal=f.scope==='dir'?sel('dir',o.dirs.map(d=>[d.id,d.name]),f.dir,'الإدارة'):f.scope==='sec'?sel('sec',o.secs.map(d=>[d.id,d.name]),f.sec,'القسم'):f.scope==='user'?sel('user',o.emps.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(u=>[u.id,u.name+' — '+deptName(u.deptId)]),f.user,'الموظف'):'';
  const period=fmt(f.from)+' – '+fmt(f.to);
  const single=f.scope==='user',r0=R.rows[0];
  const attRate=pct(s.att,s.enr);
  return `${pg(S.role==='trainmgr'?'التقارير والمؤشرات':'تقارير إدارتي',S.role==='trainmgr'?'اختر الفترة والنطاق ثم صدّر التقرير.':'تقارير الإنجاز التدريبي لقسمك ومن يتبعونك، لأي فترة تختارها.')}
  ${S.role==='trainmgr'?tabsHtml('reports',RB_TABS):''}
  <div class="card pad" style="margin-bottom:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:14px">
    <div><div class="small muted" style="margin-bottom:6px">الفترة</div><div class="pills" role="group" aria-label="الفترة">${PRESETS.map(([k,l])=>`<button class="pill${f.preset===k?' on':''}" data-act="rb-preset" data-p="${k}" aria-pressed="${f.preset===k}">${l}</button>`).join('')}</div></div>
    <div class="sel-bar" style="align-items:flex-end">
      <label class="field" style="margin:0"><span class="small muted">من</span><input class="inp" type="date" data-rb="from" id="rb_from" value="${f.from}" max="${f.to}" style="width:auto"></label>
      <label class="field" style="margin:0"><span class="small muted">إلى</span><input class="inp" type="date" data-rb="to" id="rb_to" value="${f.to}" min="${f.from}" style="width:auto"></label>
      ${sel('scope',o.scopes,f.scope,'النطاق')}${scopeVal}
      <span style="flex:1"></span>
      <button class="btn sm" data-act="rb-export" data-fmt="xlsx">${ico('file')} Excel</button>
      <button class="btn ghost sm" data-act="rb-export" data-fmt="pdf">PDF</button>
      <button class="btn ghost sm" data-act="rb-export" data-fmt="csv">CSV</button>
    </div>
  </div>
  <div id="rbrep" style="display:grid;grid-template-columns:minmax(0,1fr);gap:16px;background:var(--sand-2)">
    <div class="card pad"><h3>تقرير الإنجاز التدريبي — ${esc(scopeLabel(f))}</h3><div class="h-sub">الفترة ${esc(period)} · ${empN(s.emps)}${single&&r0?' · '+esc(deptName(r0.u.deptId)):''} · أُعدّ في ${fmt(TODAY())} بواسطة ${esc((ME()||{}).name||'')}${hasDemo()&&S.showDemo?' · <span class="tag demo mini">يتضمن بيانات تجريبية</span>':''}</div></div>
    ${s.emps?`
    <div class="grid g4">
      ${tile('إجمالي الساعات التدريبية',num(s.total),`حضوري ${num(s.hc)} · مكتبة ${num(s.hl+s.hr)} · خارجي ${num(s.hx)}`)}
      ${single?tile('نسبة المستهدف السنوي',nOr(pct(hoursOf(r0.u.id,TODAY().slice(0,4)+'-01-01'),TARGET_H),0,'%'),`المستهدف ${TARGET_H} ساعة في العام`):tile('متوسط الساعات للموظف',num(s.emps?s.total/s.emps:0,1),`${N(s.active)} من ${N(s.emps)} أنجز تدريبًا في الفترة`)}
      ${tile('الدورات المنجزة',num(s.courses+s.libs+s.ext),`حضوري ${s.courses} · مكتبة ${s.libs} · خارجي ${s.ext}`)}
      ${tile('نسبة الحضور',nOr(attRate,0,'%'),s.enr?`حضر ${s.att} من ${s.enr} تسجيلًا في دورات الفترة`:'لا دورات حضورية منفّذة في الفترة')}
      ${tile('متوسط الاختبار البعدي',nOr(s.post,0,'%'),s.postN?`ن=${s.postN}${s.pre!=null?' · القبلي '+num(s.pre,0)+'%':''}`:'لا اختبارات في الفترة')}
      ${tile('رضا المتدربين',nOr(s.sat,0,'%'),s.satN?`ن=${s.satN} استبيانًا`:'لا استبيانات في الفترة')}
      ${tile('تقييم الأثر من الرئيس',s.imp==null?'—':num(s.imp,1)+' <small>من 5</small>',s.impN?`ن=${s.impN} تقييمًا`:'لا تقييمات في الفترة')}
      ${tile('الشهادات والزيارات',`${num(s.certs)} <small>شهادة</small>`,`${s.visits} زيارة ميدانية معتمدة`)}
    </div>
    ${!single&&R.secs.length>1?`<div class="card"><div class="pad" style="padding-bottom:4px"><h3>حسب القسم</h3></div><div class="tbl-wrap"><table class="sm-t"><thead><tr><th>القسم</th><th>الإدارة</th><th class="num">الموظفون</th><th class="num">أنجزوا تدريبًا</th><th class="num">الساعات</th><th class="num">متوسط الساعات</th><th class="num">الدورات</th><th class="num">الرضا</th></tr></thead><tbody>${R.secs.map(g=>`<tr><td><b>${esc(g.name)}</b></td><td class="small">${esc(g.dir)}</td><td class="num">${g.n}</td><td class="num">${g.active}</td><td class="num"><b>${num(g.total)}</b></td><td class="num">${num(g.avgH,1)}</td><td class="num">${g.courses+g.ext}</td><td class="num">${nOr(g.sat,0,'%')}</td></tr>`).join('')}</tbody></table></div></div>`:''}
    ${!single?`<div class="card"><div class="pad" style="padding-bottom:4px"><h3>حسب الموظف</h3></div><div class="tbl-wrap"><table class="sm-t"><thead><tr><th>الموظف</th><th>القسم</th><th class="num">حضوري</th><th class="num">مكتبة</th><th class="num">خارجي</th><th class="num">الساعات</th><th class="num">الحضور</th><th class="num">البعدي</th><th class="num">الرضا</th><th class="num">الأثر</th></tr></thead><tbody>${R.rows.map(r=>`<tr><td>${esc(r.u.name)}</td><td class="small">${esc(deptName(r.u.deptId))}</td><td class="num">${num(r.h.c)}</td><td class="num">${num(r.h.l+r.h.r)}</td><td class="num">${num(r.h.x)}</td><td class="num"><b>${num(r.total)}</b></td><td class="num">${r.enr?r.att+'/'+r.enr:'—'}</td><td class="num">${nOr(r.post,0,'%')}</td><td class="num">${nOr(r.sat,0,'%')}</td><td class="num">${nOr(r.imp,1)}</td></tr>`).join('')}</tbody></table></div></div>`:''}
    <div class="card"><div class="pad" style="padding-bottom:4px"><h3>الأنشطة المنجزة في الفترة</h3><div class="h-sub">${R.acts.length?actN(R.acts.length):''}</div></div>${R.acts.length?`<div class="tbl-wrap"><table class="sm-t"><thead><tr><th>التاريخ</th>${single?'':'<th>الموظف</th>'}<th>النوع</th><th>النشاط</th><th class="num">الساعات</th></tr></thead><tbody>${R.acts.slice(0,single?500:200).map(a=>`<tr><td class="small num">${fmtS(a.date)}</td>${single?'':`<td>${esc(a.u.name)}</td>`}<td class="small">${esc(a.type)}</td><td>${esc(a.title)}</td><td class="num">${a.hours==null?'—':num(a.hours)}</td></tr>`).join('')}</tbody></table></div>${!single&&R.acts.length>200?`<p class="ins pad" style="padding-top:8px">يعرض أحدث 200 نشاط؛ ملف Excel يتضمنها كلها.</p>`:''}`:`<div class="empty">لا أنشطة منجزة في هذه الفترة.</div>`}</div>
    <p class="ins">الساعات = الدورات الحضورية المكتملة + المكتبة الإلكترونية والمواد المقروءة + الدورات الخارجية المعتمدة، حسب تاريخ الإنجاز داخل الفترة. الزيارات الميدانية تُعدّ ولا تُحتسب ساعات.</p>
    `:`<div class="card empty">لا يوجد موظفون في هذا النطاق.</div>`}
  </div>`;
}

const RB_TABS=[['builder','منشئ التقارير'],['kpi','المؤشرات الاثنا عشر'],['dict','قاموس المؤشرات']];
const _vReports=VIEWS.reports;
VIEWS.reports=function(){
  if(S.role!=='trainmgr')return vReportBuilder();
  const t=curTab('reports',RB_TABS);
  if(t==='builder')return vReportBuilder();
  return `${pg('التقارير والمؤشرات','مؤشرات محسوبة من سجلات المنصة، مع تعريف كل مؤشر ومعادلته ومصدره.')}${tabsHtml('reports',RB_TABS)}${t==='kpi'?repKpi():repDict()}`;
};
// الرئيس المباشر يحصل على تقارير إدارته
if(!NAV.linemgr.some(x=>x[0]==='reports'))NAV.linemgr.splice(NAV.linemgr.length-1,0,['reports','تقارير إدارتي','file']);

function safeName(s){return String(s).replace(/[\\/:*?"<>|]+/g,'-').slice(0,80)}
Object.assign(ACT,{
  'rb-preset'(t){const f=rbState(),p=t.dataset.p;f.preset=p;const r=presetRange(p);if(r){f.from=r[0];f.to=r[1]}draw()},
  async 'rb-export'(t){
    const f=rbState(),R=compute(f),s=R.sum,base=safeName('تقرير التدريب — '+scopeLabel(f)+' — '+f.from+' إلى '+f.to),fmtx=t.dataset.fmt;
    if(fmtx==='pdf'){await exportPdfEl('#rbrep',base+'.pdf');return}
    const summary=[['البند','القيمة'],['النطاق',scopeLabel(f)],['الفترة',f.from+' إلى '+f.to],['عدد الموظفين',s.emps],['أنجزوا تدريبًا',s.active],['إجمالي الساعات',s.total],['ساعات الدورات الحضورية',s.hc],['ساعات المكتبة والمواد المقروءة',s.hl+s.hr],['ساعات الدورات الخارجية المعتمدة',s.hx],['متوسط الساعات للموظف',s.emps?+(s.total/s.emps).toFixed(1):0],['الدورات الحضورية المنجزة',s.courses],['دورات المكتبة المنجزة',s.libs],['الدورات الخارجية المعتمدة',s.ext],['نسبة الحضور %',pct(s.att,s.enr)??''],['متوسط الاختبار القبلي %',s.pre==null?'':Math.round(s.pre)],['متوسط الاختبار البعدي %',s.post==null?'':Math.round(s.post)],['رضا المتدربين %',s.sat==null?'':Math.round(s.sat)],['عدد الاستبيانات',s.satN],['متوسط تقييم الأثر (من 5)',s.imp==null?'':+s.imp.toFixed(1)],['عدد تقييمات الأثر',s.impN],['الشهادات',s.certs],['الزيارات الميدانية المعتمدة',s.visits],['أُعدّ بواسطة',(ME()||{}).name||''],['تاريخ الإعداد',TODAY()]];
    const emps=[['الموظف','الرقم الوظيفي','القسم','الإدارة','ساعات حضوري','ساعات مكتبة','ساعات خارجي','إجمالي الساعات','دورات حضورية','دورات مكتبة','دورات خارجية','الحضور','التسجيلات','البعدي %','الرضا %','الأثر (من 5)','زيارات']].concat(R.rows.map(r=>[r.u.name,r.u.empNo||'',deptName(r.u.deptId),deptName(dirOfDept(r.u.deptId)),r.h.c,r.h.l+r.h.r,r.h.x,r.total,r.courses,r.libs,r.ext,r.att,r.enr,r.post==null?'':Math.round(r.post),r.sat==null?'':Math.round(r.sat),r.imp==null?'':+r.imp.toFixed(1),r.visits]));
    const secs=[['القسم','الإدارة','الموظفون','أنجزوا تدريبًا','الساعات','متوسط الساعات','الدورات','الرضا %']].concat(R.secs.map(g=>[g.name,g.dir,g.n,g.active,g.total,+g.avgH.toFixed(1),g.courses+g.ext,g.sat==null?'':Math.round(g.sat)]));
    const acts=[['التاريخ','الموظف','القسم','النوع','النشاط','الساعات']].concat(R.acts.map(a=>[a.date,a.u.name,deptName(a.u.deptId),a.type,a.title,a.hours??'']));
    if(fmtx==='csv'){await exportTable(base,[{name:'الموظفون',rows:emps}],'csv');return}
    await exportTable(base,[{name:'الملخص',rows:summary},{name:'الموظفون',rows:emps},{name:'الأقسام',rows:secs},{name:'الأنشطة',rows:acts}],'xlsx');
  }
});
document.addEventListener('change',e=>{
  const k=e.target&&e.target.dataset&&e.target.dataset.rb;if(!k)return;
  const f=rbState();f[k]=e.target.value;
  if(k==='from'||k==='to'){f.preset='custom';if(f.from>f.to){if(k==='from')f.to=f.from;else f.from=f.to}}
  draw();
});
})();
