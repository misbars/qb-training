/* ================= قائمة موحّدة حسب الصلاحيات (بدون تبديل يدوي بين الأدوار) ================= */
// كل مستخدم يشوف قائمة وحدة: أقسام الموظف، وتنضاف لها أقسام القيادة أو إدارة التدريب أو إدارة النظام حسب صفاته.
// الخادم ما تغيّر: كل طلب يحمل الدور المناسب للصفحة المفتوحة، فالصلاحيات تُفحص كما هي.
const ROLE_ORDER = ['employee', 'linemgr', 'trainmgr', 'sysadmin', 'trainer'];
function navSections(u) {
  const R = (u && u.roles) || [], emp = R.includes('employee'), out = [];
  const noInbox = items => emp ? items.filter(x => x[0] !== 'inbox') : items;
  if (emp) out.push({ h: '', role: 'employee', items: NAV.employee });
  if (R.includes('linemgr')) out.push({ h: 'فريقي', role: 'linemgr', items: [['team', 'فريقي', 'users'], ['lmvisits', 'اعتماد الزيارات', 'pin'], ['track', 'بطاقات مسار القيادات', 'flag'], ['reports', 'تقارير إدارتي', 'file']] });
  if (R.includes('trainmgr')) out.push({ h: 'إدارة التدريب', role: 'trainmgr', items: noInbox(NAV.trainmgr) });
  if (R.includes('sysadmin')) out.push({ h: 'إدارة النظام', role: 'sysadmin', items: noInbox(NAV.sysadmin) });
  if (R.includes('trainer')) out.push({ h: emp ? 'المدرب' : '', role: 'trainer', items: noInbox(NAV.trainer) });
  return out;
}
function viewsOfRole(r) {
  const v = (NAV[r] || []).map(x => x[0]);
  if (r === 'employee') v.push('player', 'reader', ...Object.keys(EMP_GROUP_OF));
  if (r === 'linemgr') v.push('track', 'reports');
  return v;
}
function roleForView(v) {
  const u = ME(); if (!u) return S.role;
  if (viewsOfRole(S.role).includes(v)) return S.role;
  return ROLE_ORDER.find(r => u.roles.includes(r) && viewsOfRole(r).includes(v)) || S.role;
}
// الانتقال: يغيّر الدور بصمت إذا الصفحة تتبع صفة ثانية للمستخدم (يدعم أيضًا "دور:صفحة" في الإشعارات)
const _goBase = go;
go = function (v) {
  if (typeof v === 'string' && v.includes(':')) { const [r, x] = v.split(':'); if ((ME() || { roles: [] }).roles.includes(r)) setRole(r); v = x }
  const r = roleForView(v); if (r !== S.role) setRole(r);
  return _goBase(v);
};
function setRole(r) { if (S.role === r) return; try { detachPlayer() } catch (e) { } S.role = r }

// شارات الأعداد على عناصر القائمة
function navBadge(role, k) {
  const me = S.me;
  if (role === 'employee' && k === 'account') return unreadN();
  if (role === 'linemgr' && k === 'team') return DB.enrolls.filter(e => e.status === 'pending_lm' && (U(e.userId) || {}).managerId === me).length;
  if (role === 'linemgr' && k === 'lmvisits') return DB.visits.filter(v => v.status === 'submitted' && (U(v.userId) || {}).managerId === me).length;
  if (role === 'linemgr' && k === 'track') return trTeamCards().filter(x => !x.ack).length;
  if (role === 'trainmgr' && k === 'requests') return DB.extreq.filter(x => inc(x) && x.status === 'pending').length + DB.retakes.filter(x => inc(x) && x.status === 'pending').length;
  if (k === 'inbox') return unreadN();
  return 0;
}
function unifiedNavHtml() {
  const u = ME();
  return `<nav class="nav" aria-label="القائمة الرئيسية">${navSections(u).map(sec => `${sec.h ? `<div class="nav-h">${sec.h}</div>` : ''}${sec.items.map(([k, l, i]) => {
    const on = S.role === sec.role && navOn(k), b = navBadge(sec.role, k);
    return `<button data-act="nav" data-r="${sec.role}" data-v="${k}" class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''}>${ico(i)}<span>${l}</span>${b ? `<span class="badge num">${b}</span>` : ''}</button>`;
  }).join('')}`).join('')}</nav>`;
}
// شريط الجوال: أقسام الموظف الأربعة، ويُضاف «فريقي» لمن عنده فريق
function empTabsHtml() {
  const u = ME(); if (!u || !u.roles.includes('employee')) return '';
  const items = NAV.employee.map(([k, l]) => ['employee', k, l]);
  if (u.roles.includes('linemgr')) items.push(['linemgr', 'team', 'فريقي']);
  return `<nav class="emp-tabs" aria-label="الأقسام" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items.map(([r, k, l]) => {
    const on = (r === 'linemgr' ? S.role === 'linemgr' : S.role === 'employee' && navOn(k)), b = navBadge(r, k === 'account' ? 'account' : k);
    return `<button data-act="nav" data-r="${r}" data-v="${k}" class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''}>${l}${b ? ` <span class="badge num">${b}</span>` : ''}</button>`;
  }).join('')}</nav>`;
}
ACT.nav = function (t) { const r = t.dataset.r, v = t.dataset.v; setRole(r); S.nav = false; if (v === 'track' && r === 'employee') S.trackAxis = null; _goBase(v) };

// عند الدخول: من له صفة موظف يبدأ من «الرئيسية»
const _doLoginBase = doLogin;
doLogin = function (id) { _doLoginBase(id); const u = ME(); if (u && u.roles.includes('employee') && S.role !== 'employee') { S.role = 'employee'; S.view = 'home'; draw() } };

// مهام القيادة وإدارة التدريب تظهر في الرئيسية مع مهام الموظف
TASK_ICON.mgr = ['inbox', '#FBEFD9', '#8A5C12'];
const _empTasksNav = empTasks;
empTasks = function (u) {
  const T = _empTasksNav(u), add = [];
  const n = (x, one, many) => x === 1 ? one : x === 2 ? many[0] : x <= 10 ? `${x} ${many[1]}` : `${x} ${many[2]}`;
  if (u.roles.includes('linemgr')) {
    const en = navBadge('linemgr', 'team'), vs = navBadge('linemgr', 'lmvisits'), cd = navBadge('linemgr', 'track');
    if (en) add.push({ kind: 'mgr', title: `${n(en, 'طلب تسجيل', ['طلبا تسجيل', 'طلبات تسجيل', 'طلب تسجيل'])} من فريقك ينتظر موافقتك`, sub: 'دورات طلبها موظفوك', btn: 'راجع', primary: true, act: 'navgo', v: 'linemgr:team' });
    if (vs) add.push({ kind: 'mgr', title: `${n(vs, 'زيارة ميدانية', ['زيارتان ميدانيتان', 'زيارات ميدانية', 'زيارة ميدانية'])} تنتظر اعتمادك`, sub: 'زيارات أرسلها موظفوك', btn: 'راجع', primary: true, act: 'navgo', v: 'linemgr:lmvisits' });
    if (cd) add.push({ kind: 'mgr', title: `${n(cd, 'بطاقة تطبيق جديدة', ['بطاقتا تطبيق جديدتان', 'بطاقات تطبيق جديدة', 'بطاقة تطبيق جديدة'])} من فريقك`, sub: 'مسار القيادات', btn: 'اطّلع', act: 'navgo', v: 'linemgr:track' });
  }
  if (u.roles.includes('trainmgr')) {
    const rq = navBadge('trainmgr', 'requests');
    if (rq) add.push({ kind: 'mgr', title: `${n(rq, 'طلب ينتظر قرارك', ['طلبان ينتظران قرارك', 'طلبات تنتظر قرارك', 'طلبًا ينتظر قرارك'])}`, sub: 'دورات خارجية وشهادات مسار وطلبات إعادة', btn: 'راجع', primary: true, act: 'navgo', v: 'trainmgr:requests' });
  }
  return add.concat(T);
};
ACT.navgo = function (t) { go(t.dataset.v) };
// صفحة «بطاقات مسار القيادات» للرئيس: بطاقات فريقه فقط (مساره هو في «تعلّم»)
{ const orig = VIEWS.track; VIEWS.track = () => S.role === 'linemgr' ? vTrackTeam() : orig() }
