/* ================= لوحة مسؤول النظام: بحث وفلترة، استيراد من Excel، سجل مقروء، حماية التفريغ ================= */

/* ---------- حالة الشاشات ---------- */
S.uf = { q: '', dept: '', role: '', status: 'active' };
S.umenu = null;
S.imp = null;
S. af2 = null;
S.af2 = { cat: '', user: '', days: '30', logins: false };

/* ---------- ١) المستخدمون: بحث وفلترة وقائمة إجراءات مطويّة ---------- */
function admUserList() {
  const f = S.uf, q = f.q.trim().toLowerCase();
  return DB.users.slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .filter(u =>
      (!q || (u.name + ' ' + u.email + ' ' + (u.title || '')).toLowerCase().includes(q)) &&
      (!f.dept || u.deptId === f.dept) &&
      (!f.role || u.roles.includes(f.role)) &&
      (!f.status || (f.status === 'active') === (u.active !== false)));
}
VIEWS['adm-users'] = function () {
  const L = admUserList(), all = DB.users, nOn = all.filter(u => u.active !== false).length;
  const n = (x, one, two, few) => x === 1 ? one : x === 2 ? two : `${num(x)} ${few}`;
  const row = u => `<tr><td><b>${esc(u.name)}</b> ${demoTag(u)}<div class="small muted">${esc(u.title || '')}</div></td>
    <td class="num small">${esc(u.email)}</td>
    <td class="small">${u.roles.map(r => ROLES[r]).join('، ')}</td>
    <td class="small">${esc(deptName(u.deptId))}</td>
    <td class="small">${esc((U(u.managerId) || {}).name || '—')}</td>
    <td><span class="tag ${u.active !== false ? 'ok' : 'bad'}">${u.active !== false ? 'نشط' : 'موقوف'}</span></td>
    <td style="white-space:nowrap;text-align:end;position:relative">
      <button data-act="edituser" data-id="${u.id}" class="btn ghost sm">تحرير</button>
      <button class="btn sec sm" data-act="urow" data-id="${u.id}" aria-label="إجراءات أخرى" aria-expanded="${S.umenu === u.id}" style="padding:5px 10px;line-height:1">⋯</button>
      ${S.umenu === u.id ? `<div class="urow-menu">
        <button data-act="pw-reset" data-id="${u.id}">إصدار كلمة مرور مؤقتة</button>
        <button data-act="user-toggle" data-id="${u.id}">${u.active !== false ? 'إيقاف الحساب' : 'تفعيل الحساب'}</button>
      </div>` : ''}</td></tr>`;
  return `${pg('المستخدمون والصلاحيات', 'كل حساب مرتبط ببريده الرسمي. الصفات تحدد ما يظهر للمستخدم من وظائف.', `<button class="btn" data-act="newuser">${ico('plus')}مستخدم جديد</button>`)}
  <div class="note" style="margin-bottom:14px">الصلاحيات تُطبَّق على الخادم: كل حساب يرى وينفّذ ما تسمح به صفته فقط.</div>
  <div class="adm-bar">
    <div class="adm-search">
      <input class="inp" id="uq" value="${esc(S.uf.q)}" placeholder="ابحث بالاسم أو البريد أو المسمى…" aria-label="بحث في المستخدمين">
    </div>
    <select class="inp" data-act="uf-set" data-k="dept" aria-label="القسم">${options(DB.depts.map(d => [d.id, (d.parent ? '— ' : '') + d.name]), S.uf.dept, 'كل الأقسام')}</select>
    <select class="inp" data-act="uf-set" data-k="role" aria-label="الصفة">${options(Object.entries(ROLES), S.uf.role, 'كل الصفات')}</select>
    <select class="inp" data-act="uf-set" data-k="status" aria-label="الحالة">${options([['active', 'النشطون'], ['off', 'الموقوفون']], S.uf.status, 'الكل')}</select>
    <button class="btn sec" data-act="imp-open">${ico('download')}استيراد من Excel</button>
  </div>
  <div class="small muted" style="margin:10px 0 2px">${L.length === all.length
      ? `${n(all.length, 'حساب واحد', 'حسابان', 'حسابًا')} · ${n(nOn, 'نشط واحد', 'نشطان', 'نشطًا')} · ${n(all.length - nOn, 'موقوف واحد', 'موقوفان', 'موقوفًا')}`
      : `${n(L.length, 'نتيجة واحدة', 'نتيجتان', 'نتيجة')} من ${num(all.length)}`}</div>
  <div class="card tbl-wrap"><table class="sm-t"><thead><tr><th>المستخدم</th><th>البريد</th><th>الصفات</th><th>القسم</th><th>الرئيس</th><th>الحالة</th><th></th></tr></thead>
  <tbody>${L.map(row).join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:26px">لا نتائج مطابقة</td></tr>'}</tbody></table></div>`;
};

/* ---------- ٢) الاستيراد من Excel ---------- */
const IMP_COLS = ['الاسم الكامل', 'البريد الرسمي', 'المسمى', 'الرقم الوظيفي', 'القسم', 'الوصف الوظيفي', 'الرئيس المباشر', 'الصفات'];
const roleKey = label => (Object.entries(ROLES).find(([, v]) => v === String(label).trim()) || [])[0];

async function impTemplate() {
  const dom = DB.settings.emailDomain || 'qb.org.sa';
  const example = ['محمد بن عبدالله الحربي', 'mohammed.alharbi@' + dom, 'منسق حلقات', '', (DB.depts[0] || {}).name || '', (DB.jobs[0] || {}).title || '', (DB.users.find(u => u.active !== false) || {}).name || '', ROLES.employee];
  await exportTable('نموذج-استيراد-الموظفين', [
    { name: 'الموظفون', rows: [IMP_COLS, example] },
    {
      name: 'القوائم المسموحة', rows: [['الأقسام والإدارات', 'الأوصاف الوظيفية', 'الرؤساء المتاحون', 'الصفات'],
      ...Array.from({ length: Math.max(DB.depts.length, DB.jobs.length, DB.users.length, Object.keys(ROLES).length) }, (_, i) => [
        (DB.depts[i] || {}).name || '', (DB.jobs[i] || {}).title || '',
        (DB.users.filter(u => u.active !== false)[i] || {}).name || '', Object.values(ROLES)[i] || ''])]
    },
    {
      name: 'التعليمات', rows: [['الحقل', 'إلزامي', 'ملاحظات'],
      ['الاسم الكامل', 'نعم', 'ثلاثة أحرف فأكثر'],
      ['البريد الرسمي', 'نعم', 'ينتهي بـ @' + dom + ' ولا يتكرر'],
      ['المسمى', 'لا', 'المسمى الوظيفي كما في العقد'],
      ['الرقم الوظيفي', 'لا', 'يُولَّد تلقائيًا إذا تُرك فارغًا'],
      ['القسم', 'لا', 'انسخه كما هو من ورقة «القوائم المسموحة»'],
      ['الوصف الوظيفي', 'لا', 'انسخه كما هو من ورقة «القوائم المسموحة»'],
      ['الرئيس المباشر', 'لا', 'اسم موظف موجود في المنصة'],
      ['الصفات', 'لا', 'افتراضيًا «موظف». للجمع بين صفتين افصل بفاصلة: موظف، رئيس مباشر'],
      [], ['احذف صف المثال قبل الرفع.'], ['لن يُنشأ أي حساب قبل تأكيدك في المنصة.']]
    }], 'xlsx');
}

function impParse(rows) {
  const dom = (DB.settings.emailDomain || '').toLowerCase();
  const deptBy = new Map(DB.depts.map(d => [d.name.trim(), d.id]));
  const jobBy = new Map(DB.jobs.map(j => [j.title.trim(), j.id]));
  const userBy = new Map(DB.users.map(u => [u.name.trim(), u.id]));
  const mailBy = new Map(DB.users.map(u => [u.email.toLowerCase(), u]));
  const seen = new Set(), out = { add: [], upd: [], bad: [] };
  rows.forEach((r, i) => {
    const line = i + 2, g = k => String(r[k] ?? '').trim();
    const name = g('الاسم الكامل'), email = g('البريد الرسمي').toLowerCase();
    if (!name && !email) return;
    const bad = m => out.bad.push({ line, name: name || email, msg: m });
    if (name.length < 3) return bad('الاسم ناقص أو أقل من ثلاثة أحرف');
    if (!emailOk(email)) return bad('البريد غير صالح');
    if (dom && !email.endsWith('@' + dom)) return bad('البريد خارج نطاق @' + dom);
    if (seen.has(email)) return bad('البريد مكرر داخل الملف نفسه');
    seen.add(email);
    const dName = g('القسم'), jName = g('الوصف الوظيفي'), mName = g('الرئيس المباشر');
    if (dName && !deptBy.has(dName)) return bad(`القسم «${dName}» غير موجود في الهيكل التنظيمي`);
    if (jName && !jobBy.has(jName)) return bad(`الوصف الوظيفي «${jName}» غير معرّف`);
    if (mName && !userBy.has(mName)) return bad(`الرئيس «${mName}» غير موجود في المنصة`);
    const rawRoles = g('الصفات').split(/[،,]/).map(x => x.trim()).filter(Boolean);
    const roles = rawRoles.map(roleKey);
    if (roles.some(x => !x)) return bad('صفة غير معروفة: ' + rawRoles[roles.findIndex(x => !x)]);
    const rec = {
      name, email, title: g('المسمى'), empNo: g('الرقم الوظيفي'),
      deptId: dName ? deptBy.get(dName) : null, jobId: jName ? jobBy.get(jName) : null,
      managerId: mName ? userBy.get(mName) : null, roles: roles.length ? roles : ['employee'], line
    };
    if (roles.includes('trainer')) return bad('صفة «مدرب» تحتاج ربط ملف مدرب — أضفه من المنصة');
    (mailBy.has(email) ? out.upd : out.add).push(rec);
  });
  return out;
}

function impBody() {
  const d = S.imp;
  if (!d || !d.parsed) return `<div class="m-b"><div class="ins" style="margin-bottom:14px">
      ارفع ملف Excel بأعمدة النموذج. لن يُنشأ أي حساب قبل مراجعتك للمعاينة وتأكيدك.</div>
    <div class="row wrap" style="gap:10px">
      <button class="btn sec" data-act="imp-tpl">${ico('download')}تنزيل النموذج</button>
      <label class="btn" style="cursor:pointer">اختيار ملف Excel<input type="file" id="imp_file" accept=".xlsx,.xls" style="display:none"></label>
    </div>
    <div class="small muted" style="margin-top:10px">النموذج يُبنى من بيانات منصتك: أقسامك وأوصافك الوظيفية ورؤساؤك مدرجة في ورقة «القوائم المسموحة» لتنسخ منها.</div></div>`;
  const { add, upd, bad } = d.parsed;
  const tile = (n, l, bg, fg) => `<div style="background:${bg};color:${fg};border-radius:10px;padding:11px 13px">
      <div style="font-size:21px;font-weight:700;line-height:1.2" class="num">${num(n)}</div><div style="font-size:12px">${l}</div></div>`;
  return `<div class="m-b">
    <div class="ins" style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <b style="flex:1">${esc(d.fileName)}</b>
      <span class="small muted">${num(add.length + upd.length + bad.length)} صفًا</span>
      <button class="btn sec sm" data-act="imp-reset">تغيير الملف</button></div>
    <div class="grid g3" style="gap:10px;margin-bottom:14px">
      ${tile(add.length, 'جاهز للإضافة', 'var(--ok-bg,#DDF1E4)', '#17603A')}
      ${tile(upd.length, 'موجود مسبقًا — سيُحدَّث', '#FBEFD9', '#7A5410')}
      ${tile(bad.length, 'صف فيه خطأ', '#F7E1DE', '#8E2A1F')}</div>
    ${bad.length ? `<div class="card pad" style="margin-bottom:12px;max-height:190px;overflow:auto">
      ${bad.map(b => `<div class="small" style="color:#8E2A1F;padding:3px 0">الصف ${num(b.line)} — ${esc(b.name)}: ${esc(b.msg)}</div>`).join('')}</div>` : ''}
    <div class="small muted">بعد التأكيد تُصدَر كلمات المرور المؤقتة للحسابات الجديدة في ملف واحد.</div></div>`;
}
function impModal() {
  const d = S.imp, ready = d && d.parsed && d.parsed.add.length + d.parsed.upd.length > 0;
  mask(`${mHead('استيراد المستخدمين من Excel')}${impBody()}<div class="m-f">
    <button class="btn sec" data-act="close">إلغاء</button>
    ${ready ? `<button class="btn" data-act="imp-go">تأكيد الاستيراد · ${num(d.parsed.add.length + d.parsed.upd.length)} حساب</button>` : ''}
  </div>`, 'wide');
}

Object.assign(ACT, {
  'uf-set'(t) { S.uf[t.dataset.k] = t.value; S.umenu = null; draw() },
  'urow'(t) { S.umenu = S.umenu === t.dataset.id ? null : t.dataset.id; draw() },
  'imp-open'() { if (!guard('user.write')) return; S.imp = {}; impModal() },
  'imp-reset'() { S.imp = {}; impModal() },
  async 'imp-tpl'() { try { await impTemplate(); toast('نُزّل النموذج') } catch (e) { toast('تعذّر توليد النموذج', e.message) } },
  async 'imp-go'() {
    if (!guard('user.write')) return;
    const { add, upd } = S.imp.parsed, created = [];
    upd.forEach(r => {
      const u = DB.users.find(x => x.email.toLowerCase() === r.email);
      Object.assign(u, { name: r.name, title: r.title || u.title, deptId: r.deptId || u.deptId, jobId: r.jobId || u.jobId, managerId: r.managerId || u.managerId, roles: r.roles });
    });
    add.forEach(r => {
      const u = { id: uid('u'), name: r.name, email: r.email, title: r.title, empNo: r.empNo || 'QB-' + (1001 + DB.users.length), deptId: r.deptId, jobId: r.jobId, managerId: r.managerId, roles: r.roles, active: true, demo: false };
      DB.users.push(u); created.push(u);
    });
    commit('users');
    audit('user.import', 'user', '', `${add.length} إضافة · ${upd.length} تحديث`);
    closeLayer(); S.imp = null; draw();
    toast(`تم الاستيراد`, `${num(add.length)} حساب جديد · ${num(upd.length)} محدَّث`);
    if (created.length) await impPasswords(created);
  },
});

async function impPasswords(users) {
  const rows = [['الاسم', 'البريد', 'كلمة المرور المؤقتة']], failed = [];
  for (const u of users) {
    try { const r = await api('/api/password/reset', { method: 'POST', body: JSON.stringify({ userId: u.id }) }); rows.push([r.name, r.email, r.password]) }
    catch (e) { failed.push(u.name) }
  }
  if (rows.length > 1) {
    await exportTable('كلمات-المرور-المؤقتة-' + TODAY(), [{ name: 'كلمات المرور', rows }], 'xlsx');
    toast('نُزّل ملف كلمات المرور', 'سلّم كل موظف كلمته بنفسك');
  }
  if (failed.length) toast('تعذّر إصدار كلمة المرور لـ ' + num(failed.length), failed.slice(0, 3).join('، '));
}

/* ---------- ٣) سجل التدقيق: إخفاء الدخول، فلترة، أسماء عربية ---------- */
const AUD_ONE = {
  login: 'تسجيل دخول', logout: 'تسجيل خروج', 'login.fail': 'محاولة دخول فاشلة', denied: 'عملية مرفوضة',
  conflict: 'تعارض في الحفظ', backup: 'تنزيل نسخة احتياطية', restore: 'استعادة نسخة', export: 'تصدير تقرير',
  integrity: 'فحص سلامة البيانات', 'integrity.fix': 'إصلاح سجلات', 'reset.all': 'تفريغ كل البيانات',
  'load.demo': 'تحميل بيانات تجريبية', 'purge.demo': 'حذف البيانات التجريبية', 'demo.guest': 'إنشاء حساب تجربة',
  'password.reset': 'إصدار كلمة مرور مؤقتة', 'password.change': 'تغيير كلمة المرور', nudge: 'إرسال تذكير',
  'role.switch': 'تبديل الدور', 'seek.blocked': 'منع التقديم في الفيديو', 'user.import': 'استيراد مستخدمين',
  'settings.update': 'تعديل الإعدادات', 'enroll.promote': 'ترقية من قائمة الانتظار'
};
const AUD_SUBJ = {
  user: 'حساب', dept: 'إدارة أو قسم', job: 'وصف وظيفي', comp: 'كفاية', course: 'دورة', lib: 'مادة في المكتبة',
  enroll: 'تسجيل', plan: 'خطة تدريبية', kpi: 'مؤشر', program: 'برنامج', reading: 'مادة قراءة', comment: 'تعليق',
  assess: 'تقييم مهارات', exam: 'اختبار', ext: 'طلب خارجي', retake: 'إعادة اختبار', lesson: 'درس',
  attend: 'حضور', pretest: 'اختبار قبلي', course_close: 'إغلاق دورة'
};
const AUD_VERB = {
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', status: 'تغيير حالة', submit: 'إرسال', approve: 'اعتماد',
  complete: 'إكمال', request: 'طلب', register: 'تسجيل', open: 'فتح', measure: 'قياس', link: 'ربط',
  self: 'تقييم ذاتي', mgr: 'تقييم الرئيس', close: 'إغلاق', set: 'تسجيل', attest: 'إقرار', denied: 'رفض صلاحية',
  reply: 'رد', add: 'إضافة', quiz: 'اختبار قصير', sync: 'مزامنة', promote: 'ترقية'
};
function audAr(a) {
  if (AUD_ONE[a]) return AUD_ONE[a];
  const p = a.split('.');
  if (p.length >= 2 && AUD_SUBJ[p[0]] && AUD_VERB[p[1]]) return AUD_VERB[p[1]] + ' ' + AUD_SUBJ[p[0]];
  return a;
}
const AUD_CATS = [
  ['accounts', 'الحسابات والدخول', a => /^(user|password|login|logout|demo\.guest|role\.switch)/.test(a)],
  ['content', 'المحتوى التدريبي', a => /^(course|lib|reading|program|comp|job|dept|kpi)/.test(a)],
  ['enroll', 'التسجيلات والطلبات', a => /^(enroll|ext|retake|nudge|attend|plan)/.test(a)],
  ['assess', 'التقييم والاختبارات', a => /^(assess|exam|pretest|lesson|seek)/.test(a)],
  ['system', 'النظام والبيانات', a => /^(settings|backup|restore|reset|integrity|export|load\.demo|purge|denied|conflict)/.test(a)]
];
function audFiltered() {
  const f = S.af2, q = S.af.q.trim();
  const since = f.days ? Date.now() - (+f.days) * 86400e3 : 0;
  const cat = AUD_CATS.find(c => c[0] === f.cat);
  return DB.audit.slice().reverse().filter(a =>
    (f.logins || !/^(login|logout)/.test(a.action)) &&
    (!cat || cat[2](a.action)) &&
    (!f.user || a.by === f.user) &&
    (!since || new Date(a.at).getTime() >= since) &&
    (!q || (audAr(a.action) + a.action + a.byName + a.detail + a.type).includes(q)));
}
VIEWS['adm-audit'] = function () {
  const L = audFiltered(), f = S.af2;
  const who = [...new Map(DB.audit.map(a => [a.by, a.byName])).entries()].filter(([k, v]) => k && v);
  return `${pg('سجل التدقيق', `يسجّل العمليات المؤثرة: من فعل ماذا ومتى. السجل محدود بآخر ${N(3000)} عملية.`,
    `<button class="btn ghost sm" data-act="exp-audit" data-fmt="xlsx">Excel</button><button class="btn ghost sm" data-act="exp-audit" data-fmt="csv">CSV</button>`)}
  <div class="adm-bar">
    <div class="adm-search"><input class="inp" id="aq" value="${esc(S.af.q)}" placeholder="بحث في الإجراء أو المستخدم أو التفاصيل" aria-label="بحث"></div>
    <select class="inp" data-act="af2-set" data-k="cat" aria-label="نوع العملية">${options(AUD_CATS.map(c => [c[0], c[1]]), f.cat, 'كل أنواع العمليات')}</select>
    <select class="inp" data-act="af2-set" data-k="user" aria-label="المستخدم">${options(who, f.user, 'كل المستخدمين')}</select>
    <select class="inp" data-act="af2-set" data-k="days" aria-label="المدة">${options([['7', 'آخر ٧ أيام'], ['30', 'آخر ٣٠ يومًا'], ['90', 'آخر ٣ أشهر']], f.days, 'كل المدة')}</select>
    <label class="chk" style="white-space:nowrap"><input type="checkbox" data-act="af2-logins" ${f.logins ? 'checked' : ''}> إظهار عمليات الدخول</label>
  </div>
  <div class="small muted" style="margin:10px 0 2px">${f.logins ? '' : 'عمليات الدخول والخروج مخفية · '}يُعرض ${num(Math.min(300, L.length))} من ${num(L.length)}</div>
  <div class="card tbl-wrap"><table class="sm-t"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>على</th><th>التفاصيل</th></tr></thead><tbody>${L.slice(0, 300).map(a => `<tr>
    <td class="small num" style="white-space:nowrap">${esc(a.at.replace('T', ' ').slice(0, 16))}</td>
    <td class="small">${esc(a.byName)}<div class="muted" style="font-size:11px">${esc(ROLES[a.role] || '')}</div></td>
    <td class="small"><span class="tag ${/denied|fail/.test(a.action) ? 'bad' : ''} mini">${esc(audAr(a.action))}</span></td>
    <td class="small muted">${esc(AUD_SUBJ[a.type] || a.type || '—')}</td>
    <td class="small">${esc(a.detail)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:26px">لا عمليات مطابقة${!S.af2.logins && DB.audit.some(a => /^(login|logout)/.test(a.action)) ? ' — عمليات الدخول مخفية، فعّل الخيار أعلاه لعرضها' : ''}</td></tr>`}</tbody></table></div>`;
};
Object.assign(ACT, {
  'af2-set'(t) { S.af2[t.dataset.k] = t.value; draw() },
  'af2-logins'(t) { S.af2.logins = t.checked; draw() }
});

/* ---------- ٤) البيانات: أسماء عربية وحماية التفريغ ---------- */
const COL_AR = {
  users: 'المستخدمون', depts: 'الإدارات والأقسام', jobs: 'الأوصاف الوظيفية', comps: 'الكفايات', assess: 'تقييم المهارات',
  courses: 'الدورات', libs: 'المكتبة', enrolls: 'التسجيلات', completions: 'الشهادات', surveys: 'استبانات الرضا',
  attempts: 'محاولات الاختبار', progress: 'تقدّم المشاهدة', tests: 'الاختبارات', mgrEvals: 'تقييم الرؤساء',
  kpis: 'المؤشرات', kpiMeas: 'قياسات المؤشرات', kpiLinks: 'روابط المؤشرات', programs: 'البرامج', plans: 'الخطط',
  trainers: 'المدربون', mails: 'الرسائل', audit: 'سجل التدقيق', nominations: 'الترشيحات', libenr: 'تسجيلات المكتبة',
  readings: 'مواد القراءة', readprog: 'تقدّم القراءة', comments: 'التعليقات', extreq: 'الطلبات الخارجية',
  visits: 'الزيارات الميدانية', retakes: 'طلبات الإعادة', files: 'الملفات', tracks: 'المسارات',
  trackprog: 'تقدّم المسارات', settings: 'الإعدادات'
};
{
  const orig = VIEWS['adm-data'];
  VIEWS['adm-data'] = () => orig().replace(/<span class="small muted">([A-Za-z]+)<\/span>/g,
    (m, c) => COL_AR[c] ? `<span class="small muted">${COL_AR[c]}</span>` : m);
}
ACT['reset-all'] = function () {
  if (!guard('backup')) return;
  const tot = COLS.reduce((n, c) => n + DB[c].length, 0);
  const big = [['users', 'حسابًا'], ['courses', 'دورة'], ['completions', 'شهادة'], ['enrolls', 'تسجيلًا']]
    .filter(([c]) => DB[c].length).map(([c, w]) => `${num(DB[c].length)} ${w}`).join('، ');
  const last = lsGet('qb.lastBackup');
  const ago = last ? Math.round((Date.now() - +last) / 86400e3) : null;
  mask(`${mHead('تفريغ كل البيانات')}<div class="m-b">
   <div class="note warn" style="margin-bottom:12px">سيُحذف <b class="num">${num(tot)} سجلًا</b>: ${esc(big)}، وكل ما بُني عليها. لا يمكن التراجع عن هذه العملية إلا باستعادة نسخة احتياطية.</div>
   <div class="small muted" style="margin-bottom:12px">آخر نسخة احتياطية: <b>${last ? (ago === 0 ? 'اليوم' : ago === 1 ? 'أمس' : 'قبل ' + num(ago) + ' يومًا') : 'لا توجد نسخة من هذا المتصفح'}</b></div>
   <div class="field"><label for="rs_word">للتأكيد اكتب كلمة <b>تفريغ</b> في الحقل</label>
     <input class="inp" id="rs_word" autocomplete="off" placeholder="اكتب الكلمة هنا"></div></div>
   <div class="m-f"><button class="btn sec" data-act="close">إلغاء</button>
    <button class="btn" id="rs_go" data-act="reset-ok" disabled style="background:var(--bad,#C0392B);opacity:.45;pointer-events:none">تفريغ كل البيانات</button>
    <button class="btn sec" data-act="backup" style="margin-inline-start:auto">تنزيل نسخة احتياطية أولًا</button></div>`);
};
{
  const origBackup = ACT.backup;
  ACT.backup = function (t, e) { try { lsSet('qb.lastBackup', String(Date.now())) } catch (x) { } return origBackup.call(this, t, e) };
}

/* ---------- ربط حقول البحث والتأكيد ---------- */
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'uq') { S.uf.q = t.value; S.umenu = null; draw() }
  else if (t.id === 'rs_word') {
    const b = document.getElementById('rs_go'), ok = t.value.trim() === 'تفريغ';
    if (b) { b.disabled = !ok; b.style.opacity = ok ? '1' : '.45'; b.style.pointerEvents = ok ? '' : 'none' }
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'imp_file' && e.target.files[0]) {
    const f = e.target.files[0];
    (async () => {
      try {
        await loadScript(CDN.xlsx);
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const ws = wb.Sheets['الموظفون'] || wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        S.imp = { fileName: f.name, parsed: impParse(rows) };
        impModal();
      } catch (err) { toast('تعذّر قراءة الملف', err.message) }
    })();
  }
});
