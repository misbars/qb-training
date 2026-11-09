// قواعد الصلاحيات في الخادم — مشتركة
const OWNER = { users: 'id', assess: 'empId', enrolls: 'userId', completions: 'userId', surveys: 'userId', attempts: 'userId', progress: 'userId', tests: 'userId', libenr: 'userId', readprog: 'userId', comments: 'userId', extreq: 'userId', visits: 'userId', retakes: 'userId', files: 'by', mgrEvals: 'by', mails: 'to' };
const TM_COLS = ['jobs','comps','courses','libs','programs','plans','trainers','kpis','kpiMeas','kpiLinks','readings','enrolls','completions','surveys','attempts','progress','tests','mgrEvals','nominations','libenr','readprog','comments','extreq','visits','retakes','files','assess'];
const ADM_COLS = ['users','depts','jobs','comps'];
export const changed = (a, b) => { const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); return [...ks].filter(k => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])) };

export function authorize(ses, col, oldO, newO, del, ctx) {
  const team = ctx.team;
  const me = ses.user.id, role = ses.role, row = newO || oldO;
  const diff = changed(oldO, newO);
  const ownerF = OWNER[col], isOwn = ownerF && row && row[ownerF] === me && (!oldO || oldO[ownerF] === me);
  const only = (...ks) => diff.every(k => ks.includes(k));
  // سجل التدقيق والإشعارات: إضافة فقط
  if (col === 'audit') { if (oldO) return del ? 'skip' : 'لا يُعدَّل سجل التدقيق'; return newO.by === me ? true : 'لا يُكتب التدقيق باسم مستخدم آخر' }
  if (col === 'mails') { if (!oldO) return true; if (oldO.to === me && (del || only('unread'))) return true; return 'لا يمكن تعديل إشعارات مستخدم آخر' }
  if (col === 'settings') {
    if (role === 'sysadmin') return true;
    if (role === 'trainmgr' && only('showDemo')) return true;
    return 'الإعدادات العامة لمسؤول النظام فقط';
  }
  if (role === 'trainmgr') {
    if (TM_COLS.includes(col)) return true;
    if (col === 'users' && isOwn && only('phone','bio','title','photo','prefs','lastSeen')) return true;
    return `مدير التدريب لا يملك صلاحية الكتابة في «${col}»`;
  }
  if (role === 'sysadmin') {
    if (col === 'users' && oldO && oldO.id === me && diff.some(k => ['roles','active'].includes(k))) return 'لا يغيّر مسؤول النظام أدوار حسابه أو حالته بنفسه';
    if (ADM_COLS.includes(col)) return true;
    return `مسؤول النظام لا يكتب في سجلات التدريب «${col}»`;
  }
  if (role === 'linemgr') {
    const T = team(me), target = row && (row.userId || row.empId);
    if (col === 'assess' && T.includes(target) && only('mgr','mgrAt','causes','note','history')) return true;
    if (col === 'mgrEvals' && row.by === me && T.includes(row.userId)) return true;
    if (col === 'nominations' && (!row.userId || T.includes(row.userId) || row.by === me)) return true;
    if (col === 'enrolls' && T.includes(target) && (!oldO ? true : only('status','note','lmBy','lmAt','decidedAt','decisions','statusLog'))) return true;
    if (['visits','extreq'].includes(col) && T.includes(target) && only('status','decisions','decidedAt','mgrNote','statusLog')) return true;
    if (col === 'comments' && only('replies','status','statusLog')) return 'الرئيس المباشر لا يدير التعليقات';
    // يقع للأسفل: تصرفاته على سجلاته الشخصية كموظف
  }
  if (role === 'trainer') {
    if (col === 'comments' && oldO && only('replies','status','statusLog')) return true;
    if (col === 'trainers' && oldO && ses.user.trainerId === oldO.id && only('bio','quals','phone','email','cats')) return true;
  }
  // السجلات الشخصية (أي دور، على سجلاته فقط)
  if (!isOwn) return `لا يملك دور «${role}» تعديل سجل يخص مستخدمًا آخر في «${col}»`;
  if (del && !['progress','readprog','files','comments','mails'].includes(col)) return 'الحذف غير مسموح لهذا السجل';
  switch (col) {
    case 'users': return only('phone','bio','photo','prefs','lastSeen') ? true : 'لا يعدّل الموظف دوره أو إدارته أو حالته';
    case 'assess': return only('self','selfAt','history','selfNote') ? true : 'تقييم الرئيس لا يكتبه الموظف';
    case 'enrolls': {
      if (!oldO) return ['registered','waitlist','pending_lm','pending'].includes(newO.status) ? true : 'لا يسجّل الموظف نفسه بحالة «' + newO.status + '»';
      if (diff.some(k => ['att','pre','post'].includes(k))) return 'الحضور والدرجات يسجّلها مدير التدريب';
      if (diff.includes('status') && !['cancelled','withdrawn','canceled'].includes(newO.status)) return 'لا يغيّر الموظف حالة تسجيله إلى «' + newO.status + '»';
      return true;
    }
    case 'extreq': case 'visits': case 'retakes':
      if (!oldO) { // طلب جديد: يُقبل ما دام غير محسوم (الحقول الفارغة مسموحة)
        const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
        if (['approved', 'rejected', 'returned'].includes(newO.status) || !empty(newO.decidedAt) || !empty(newO.decidedBy) || (Array.isArray(newO.decisions) && newO.decisions.some(d => d && ['approve','reject','return','approved','rejected','returned'].includes(d.action || d.decision)))) return 'لا يعتمد الموظف طلبه بنفسه';
        return true;
      }
      { // تعديل طلب قائم: يسمح بإعادة الإرسال أو السحب، ويمنع أي قرار
        const od = oldO.decisions || [], nd = newO.decisions || [];
        const decOk = !diff.includes('decisions') || (nd.length >= od.length && JSON.stringify(nd.slice(0, od.length)) === JSON.stringify(od) && nd.slice(od.length).every(d => d && d.by === me && !['approve','reject','return','approved','rejected','returned'].includes(d.action)));
        if (!decOk || diff.some(k => ['decidedAt','decidedBy'].includes(k)) || (diff.includes('status') && ['approved','rejected','returned'].includes(newO.status))) return 'لا يعتمد الموظف طلبه بنفسه';
      }
      return true;
    case 'completions': return ['l','r','lib','reading','read'].includes(newO.kind) ? true : 'إنجاز الدورات الحضورية يصدره مدير التدريب';
    case 'mgrEvals': return 'تقييم الأثر للرئيس المباشر فقط';
    default: return true;
  }
}

