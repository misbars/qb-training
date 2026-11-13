// قواعد الصلاحيات في الخادم — مشتركة
const OWNER = { users: 'id', assess: 'empId', enrolls: 'userId', completions: 'userId', surveys: 'userId', attempts: 'userId', progress: 'userId', tests: 'userId', libenr: 'userId', readprog: 'userId', comments: 'userId', extreq: 'userId', visits: 'userId', retakes: 'userId', files: 'by', mgrEvals: 'by', mails: 'to', trackprog: 'userId' };
const TM_COLS = ['jobs','comps','courses','libs','programs','plans','trainers','kpis','kpiMeas','kpiLinks','readings','enrolls','completions','surveys','attempts','progress','tests','mgrEvals','nominations','libenr','readprog','comments','extreq','visits','retakes','files','assess','tracks','trackprog'];
const ADM_COLS = ['users','depts','jobs','comps'];
export const changed = (a, b) => { const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); return [...ks].filter(k => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])) };

export function authorize(ses, col, oldO, newO, del, ctx) {
  if (col === 'watch') return 'احتساب المشاهدة من الخادم وحده';
  const team = ctx.team;
  const me = ses.user.id, role = ses.role, row = newO || oldO;
  const diff = changed(oldO, newO);
  const ownerF = OWNER[col], isOwn = ownerF && row && row[ownerF] === me && (!oldO || oldO[ownerF] === me);
  const only = (...ks) => diff.every(k => ks.includes(k));
  // سجل التدقيق والإشعارات: إضافة فقط
  if (col === 'audit') { if (oldO) return del ? 'skip' : 'لا يُعدَّل سجل التدقيق'; return newO.by === me ? true : 'لا يُكتب التدقيق باسم مستخدم آخر' }
  if (col === 'mails') { if (!oldO) return true; if (oldO.to === me && (del || only('unread'))) return true; return 'لا يمكن تعديل إشعارات مستخدم آخر' }
  // حالة تضمين فيديو يوتيوب يسجّلها مشغّل أي مستخدم؛ لا يُسمح بغيرها
  if (col === 'libs' && oldO && diff.length && only('embed')) return true;
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
    if (col === 'trackprog' && oldO && T.includes(oldO.userId) && only('acks')) return true;
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
    // الدرجات والشهادات يصدرها الخادم بعد تصحيحه هو؛ لا يكتبها المتدرّب
    case 'completions': return 'الإنجاز والشهادة يصدرهما الخادم بعد اجتياز الاختبار';
    case 'attempts': case 'tests': return 'نتيجة الاختبار يسجّلها الخادم بعد تصحيحه';
    case 'mgrEvals': return 'تقييم الأثر للرئيس المباشر فقط';
    case 'trackprog': return diff.includes('acks') ? 'اطلاع الرئيس يكتبه الرئيس المباشر' : true;
    default: return true;
  }
}


/* ============ ترشيح القراءة ============
   الكتابة كانت محميّة، أما القراءة فكانت مفتوحة: كل من يسجّل دخوله
   يتسلّم كل الصفوف. هنا نقرّر لكل صف: يُرسل كاملًا، أم مختصرًا، أم لا يُرسل.

   المبدأ: الموظف يرى سجلاته، والرئيس المباشر يرى فريقه، ومدير التدريب
   يرى سجلات التدريب لأنه مسؤول عنها، ومسؤول النظام يرى الكل لأن النسخ
   الاحتياطي والاستعادة من مهامه. */

// سجلات شخصية لا يراها غير صاحبها ورؤسائه
const PRIVATE = ['assess','mgrEvals','surveys','attempts','tests','progress','readprog',
                 'libenr','extreq','visits','retakes','trackprog','files','nominations'];

// سجلات يحتاج الجميع مجاميعها: تُختصر لغير أصحابها بدل أن تُحجب
// (عدّاد المقاعد يَعُدّ تسجيلات الجميع، وترقيم الشهادات يعتمد على عدد الإنجازات)
const PROJECT = { enrolls: ['id','courseId','status'], completions: ['id','kind','refId'] };

// حقول في ملف المستخدم لا تخصّ زملاءه
const USER_HIDE = ['phone','prefs'];

// جسم الإشعار يُعرض كـHTML، فلا يُقبل إلا بوسوم عرض بسيطة بلا خصائص عدا class
const MAIL_TAGS = /<\/?(?:p|br|b|strong|em|i|u|ul|ol|li|span|small|h4|h5)(?:\s+class="[A-Za-z0-9 _-]{0,40}")?\s*\/?>/gi;
const bodyOk = v => !/[<>]/.test(String(v == null ? '' : v).replace(MAIL_TAGS, ''));

// المعرّفات الحقيقية تحمل هوية صاحبها (en_u_fahad_c1)، فتُستبدل في الصفوف المختصرة
const opaque = s2 => { let h = 2166136261; const t = String(s2); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) } return 'x' + (h >>> 0).toString(36) };

const strip = qs => Array.isArray(qs) ? qs.map(q => { const { ans, ...rest } = q; return rest }) : qs;
const pick = (o, ks) => { const r = {}; for (const k of ks) if (k in o) r[k] = o[k]; return r };
const omit = (o, ks) => { const r = { ...o }; for (const k of ks) delete r[k]; return r };

export function readFilter(ses, col, row, ctx) {
  const me = ses.user.id, role = ses.role;
  if (role === 'sysadmin') return row;              // الاستعادة والنسخ الاحتياطي تحتاج الكل
  if (col === 'audit') return null;                 // سجل التدقيق لمسؤول النظام وحده
  if (col === 'mails') return row.to === me ? row : null;
  if (col === 'users') return row.id === me ? row : omit(row, USER_HIDE);
  // التعليق المجهول يحمل هوية كاتبه في بياناته؛ تُزال عن الآخرين
  if (col === 'comments') return (row.anon && row.userId !== me) ? omit(row, ['userId']) : row;

  // إجابات الاختبارات لا تغادر الخادم إلا لمن يحرّرها
  if (col === 'libs') {
    const editor = role === 'trainmgr' || (role === 'trainer' && ses.user.trainerId && ses.user.trainerId === row.trainerId);
    return editor ? row : { ...row, quiz: strip(row.quiz), preQuiz: strip(row.preQuiz) };
  }
  if (col === 'readings') {
    if (role === 'trainmgr') return row;
    return { ...row, sections: (row.sections || []).map(x => ({ ...x, quiz: strip(x.quiz) })) };
  }

  const ownerF = OWNER[col];
  if (!ownerF) return row;                          // الفهارس والإعدادات: مشتركة
  const subject = row[ownerF] || row.userId || row.empId;
  const mine = subject === me || row.by === me;
  if (mine) return row;
  if (role === 'trainmgr' && TM_COLS.includes(col)) return row;
  if (role === 'linemgr' && ctx.team().includes(subject)) return row;
  if (PRIVATE.includes(col)) return null;
  if (PROJECT[col]) { const o = pick(row, PROJECT[col]); o.id = opaque(row.id); return o }
  return row;
}

/* ============ فحص القيم ============
   القواعد أعلاه تفحص «من يملك تعديل ماذا»، لا «هل القيمة معقولة». وكان
   كل تحقق من القيم في المتصفح، فيكفي تجاوزه بنداء مباشر: ساعات سالبة
   تُنقص رصيد الموظف، وتواريخ سنة 2030، ونصوص بعشرين ألف حرف. */

// حدود الحقول المعروفة: القيمة بين صفر والحد
const CAP = { hours: 500, score: 100, passScore: 100, requiredPct: 100, pct: 100, maxAttempts: 20,
              seats: 5000, creditHours: 200, estMin: 20000, exp: 70, dur: 86400, n: 1000,
              round: 100, days: 400, pages: 5000, maxRate: 4, best: 100 };
const MAX_STR = 8000;        // أطول نص مقبول في حقل واحد
const MAX_DOC = 200000;      // أكبر حجم لسجل واحد
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// الدورات والخطط تُجدول مستقبلًا؛ وما عداها لا يُسجَّل بتاريخ آتٍ
const AHEAD_DAYS = { courses: 1095, plans: 1095, programs: 1095, kpis: 1095, kpiMeas: 1095, tracks: 1095 };

const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5);

// الملفات تُخزَّن كـdata URL؛ النوع والبصمة يُفحصان في الخادم لا في المتصفح وحده
const FILE_OK = [
  [/^data:application\/pdf;base64,JVBER/, 'application/pdf'],
  [/^data:image\/jpeg;base64,\/9j\//, 'image/jpeg'],
  [/^data:image\/png;base64,iVBOR/, 'image/png']
];

export function validate(col, obj) {
  if (obj == null) return true;
  if (col === 'mails' && !bodyOk(obj.body)) return 'نص الإشعار يحتوي وسومًا غير مسموحة';
  if (col === 'files') {
    const d = String(obj.data || '');
    const hit = FILE_OK.find(([re]) => re.test(d));
    if (!hit) return 'نوع الملف غير مسموح أو لا يطابق محتواه';
    if (obj.type && obj.type !== hit[1]) return 'نوع الملف المعلن لا يطابق محتواه';
    if (d.length > 180000) return 'الملف أكبر من الحد المسموح';
  }
  if (JSON.stringify(obj).length > MAX_DOC) return 'السجل أكبر من الحد المسموح';
  const today = dayNum(new Date().toISOString().slice(0, 10));
  const ahead = AHEAD_DAYS[col] ?? 2;        // يومان هامشًا لفروق المناطق الزمنية
  let bad = null;
  const walk = (v, key, depth) => {
    if (bad || depth > 8) return;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return void (bad = `قيمة غير رقمية في «${key}»`);
      if (Math.abs(v) > 1e7) return void (bad = `قيمة خارج المدى في «${key}»`);
      const cap = CAP[key];
      if (cap !== undefined && (v < 0 || v > cap)) bad = `قيمة «${key}» يجب أن تكون بين 0 و${cap}`;
      return;
    }
    if (typeof v === 'string') {
      if (v.length > MAX_STR) return void (bad = `نص «${key}» أطول من ${MAX_STR} حرفًا`);
      if ((key === 'date' || key.endsWith('Date')) && v) {
        if (!DATE_RE.test(v)) return void (bad = `تاريخ «${key}» غير صالح`);
        const d = dayNum(v);
        if (!Number.isFinite(d)) return void (bad = `تاريخ «${key}» غير صالح`);
        if (d > today + ahead) bad = `تاريخ «${key}» في المستقبل`;
        else if (d < today - 36500) bad = `تاريخ «${key}» قديم بصورة غير معقولة`;
      }
      return;
    }
    if (Array.isArray(v)) { if (v.length > 5000) return void (bad = `قائمة «${key}» أطول من الحد`); v.forEach(x => walk(x, key, depth + 1)); return }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) {
      const x = v[k];
      // حقل عددي وصلته قيمة ليست رقمًا (نص أو كائن) — يُرفض بدل أن يُخزَّن ويُفسد الحسابات
      if (CAP[k] !== undefined && x !== null && x !== undefined && typeof x !== 'number') { bad = `قيمة «${k}» يجب أن تكون رقمًا`; return }
      walk(x, k, depth + 1);
    }
  };
  walk(obj, col, 0);
  return bad || true;
}
