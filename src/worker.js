// منصة التطوير والتدريب — خادم Cloudflare Workers + D1
// دخول حقيقي، صلاحيات تُفحص في الخادم، حفظ على مستوى السجل مع كشف التعارض، ومزامنة حية.
import { authorize, changed, readFilter } from './rules.js';
import SCHEMA from '../migrations/0001_init.sql';
import SEED from '../migrations/0002_seed.sql';

// تهيئة ذاتية: إن لم تكن الجداول موجودة تُنشأ وتُعبّأ بالبيانات الأولية (آمنة للتكرار)
let READY = false;
async function ensureReady(db) {
  if (READY) return;
  const t = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").first();
  if (!t) {
    const stmts = s => s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
    await db.batch(stmts(SCHEMA).map(q => db.prepare(q)));
    const seed = stmts(SEED);
    for (let i = 0; i < seed.length; i += 80) await db.batch(seed.slice(i, i + 80).map(q => db.prepare(q)));
  }
  READY = true;
}

const COLS = ['users','depts','jobs','comps','assess','courses','libs','enrolls','completions','surveys','attempts','progress','tests','mgrEvals','kpis','kpiMeas','kpiLinks','programs','plans','trainers','mails','audit','nominations','libenr','readings','readprog','comments','extreq','visits','retakes','files','tracks','trackprog','settings'];
const ROLE_PRI = ['sysadmin','trainmgr','linemgr','trainer','employee'];
const SESSION_DAYS = 14;
const enc = new TextEncoder();
const now = () => new Date().toISOString();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}
const tempPassword = () => 'Qb-' + rand(4);

// ===== رمز التحقق من الشهادة =====
// الرقم المتسلسل وحده يسهل تخمينه، فيُشتق لكل شهادة رمز من سرّ الخادم لا يمكن توقّعه.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const b32 = bytes => [...bytes].map(b => B32[b >> 3] + B32[((b & 7) << 2) | 0]).join('').slice(0, 16);
async function vSecret(S) {
  let r = await S.db.prepare("SELECT v FROM meta WHERE k='vsecret'").first();
  if (!r) {
    await S.db.prepare("INSERT OR IGNORE INTO meta(k,v) VALUES('vsecret',?)").bind(rand(24)).run();
    r = await S.db.prepare("SELECT v FROM meta WHERE k='vsecret'").first();
  }
  return r.v;
}
async function vCode(S, id) {
  const key = await crypto.subtle.importKey('raw', enc.encode(await vSecret(S)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('cert:' + id));
  return b32(new Uint8Array(sig).slice(0, 6)).slice(0, 10);
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

class Store {
  constructor(db) { this.db = db }
  async row(col, id) { const r = await this.db.prepare('SELECT * FROM rows WHERE col=? AND id=?').bind(col, id).first(); return r ? { ...r, obj: JSON.parse(r.data) } : null }
  async all(col) { const { results } = await this.db.prepare('SELECT data FROM rows WHERE col=? AND deleted=0').bind(col).all(); return results.map(r => JSON.parse(r.data)) }
  async user(id) { const r = await this.row('users', id); return r && !r.deleted ? r.obj : null }
  async log(uid, role, kind, col, rowId, ok, detail) {
    await this.db.prepare('INSERT INTO events(at,user_id,role,kind,col,row_id,ok,detail) VALUES(?,?,?,?,?,?,?,?)').bind(now(), uid || '', role || '', kind, col || '', rowId || '', ok ? 1 : 0, String(detail || '').slice(0, 500)).run();
  }
  async seq() { const r = await this.db.prepare("SELECT v FROM meta WHERE k='seq'").first(); return r ? +r.v : 0 }
}

async function session(req, S) {
  const m = /(?:^|;\s*)qbs=([a-f0-9]+)/.exec(req.headers.get('Cookie') || ''); if (!m) return null;
  const s = await S.db.prepare('SELECT * FROM sessions WHERE token=?').bind(m[1]).first(); if (!s) return null;
  if (Date.now() - s.created > SESSION_DAYS * 864e5) { await S.db.prepare('DELETE FROM sessions WHERE token=?').bind(s.token).run(); return null }
  const u = await S.user(s.user_id); if (!u || u.active === false) return null;
  let role = req.headers.get('X-Role');
  if (!role || !u.roles.includes(role)) role = ROLE_PRI.find(r => u.roles.includes(r));
  return { token: s.token, user: u, role };
}

// سياق الترشيح: فريق الرئيس المباشر يُحسب مرة واحدة لكل طلب
async function readCtx(ses, S) {
  const teamIds = ses.role === 'linemgr'
    ? (await S.all('users')).filter(u => u.managerId === ses.user.id).map(u => u.id) : [];
  return { team: () => teamIds };
}

async function snapshot(ses, S) {
  const { results } = await S.db.prepare('SELECT col,id,data,ver FROM rows WHERE deleted=0').all();
  const ctx = await readCtx(ses, S);
  const out = { seq: await S.seq(), vers: {} };
  for (const c of COLS) { out[c] = c === 'settings' ? {} : []; out.vers[c] = {} }
  for (const r of results) {
    if (!COLS.includes(r.col)) continue;
    const o = readFilter(ses, r.col, JSON.parse(r.data), ctx);
    if (!o) continue;
    if (r.col === 'settings') out.settings = o; else out[r.col].push(o);
    out.vers[r.col][r.id] = r.ver;
  }
  return out;
}

async function changes(ses, S, since) {
  const { results } = await S.db.prepare('SELECT col,id,data,ver,deleted,seq,by FROM rows WHERE seq>? ORDER BY seq LIMIT 2000').bind(since).all();
  const ctx = await readCtx(ses, S);
  const rows = [];
  for (const r of results) {
    if (!COLS.includes(r.col)) continue;
    // الحذف يُمرَّر بلا بيانات ليُسقط العميل الصف إن كان عنده؛ سجل التدقيق وحده محجوب
    if (r.deleted) { if (!(r.col === 'audit' && ses.role !== 'sysadmin')) rows.push({ col: r.col, id: r.id, ver: r.ver, deleted: true, by: r.by, data: null }); continue }
    const o = readFilter(ses, r.col, JSON.parse(r.data), ctx);
    if (!o) continue;
    rows.push({ col: r.col, id: r.id, ver: r.ver, deleted: false, by: r.by, data: o });
  }
  return { seq: results.length ? results[results.length - 1].seq : Math.max(since, await S.seq()), rows };
}

async function sync(ses, S, ops) {
  const teamIds = ses.role === 'linemgr' ? (await S.all('users')).filter(u => u.managerId === ses.user.id).map(u => u.id) : [];
  const ctx = { team: () => teamIds };
  const results = [];
  for (const op of (ops || []).slice(0, 500)) {
    const { col, id } = op;
    if (!COLS.includes(col) || !id) { results.push({ col, id, ok: false, reason: 'مجموعة غير معروفة' }); continue }
    const cur = await S.row(col, id), curObj = cur && !cur.deleted ? cur.obj : null, curVer = cur ? cur.ver : 0;
    if ((op.base || 0) !== curVer && !(col === 'audit' && !curObj)) {
      results.push({ col, id, ok: false, conflict: true, reason: 'تم تعديل هذا السجل من مستخدم آخر قبل حفظك', ver: curVer, data: curObj, deleted: !!(cur && cur.deleted) });
      await S.log(ses.user.id, ses.role, 'conflict', col, id, 0, 'base ' + (op.base || 0) + ' ≠ ' + curVer);
      continue;
    }
    const del = !!op.delete;
    if (del && !curObj) { results.push({ col, id, ok: true, ver: curVer }); continue }
    const newObj = del ? null : op.data;
    if (!del && (!newObj || typeof newObj !== 'object' || (newObj.id !== id && col !== 'settings'))) { results.push({ col, id, ok: false, reason: 'بيانات غير صالحة' }); continue }
    const verdict = authorize(ses, col, curObj, newObj, del, ctx);
    if (verdict === 'skip') { results.push({ col, id, ok: true, ver: curVer }); continue }
    if (verdict !== true) {
      results.push({ col, id, ok: false, denied: true, reason: verdict, ver: curVer, data: curObj });
      await S.log(ses.user.id, ses.role, 'denied', col, id, 0, verdict + ' | الحقول: ' + changed(curObj, newObj).join(','));
      continue;
    }
    // كتابة ذرّية: زيادة العدّاد ثم الكتابة بشرط أن الإصدار لم يتغيّر منذ القراءة
    const ver = curVer + 1, data = JSON.stringify(del ? curObj : newObj);
    const res = await S.db.batch([
      S.db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k='seq'"),
      S.db.prepare(`INSERT INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES(?,?,?,?,(SELECT CAST(v AS INTEGER) FROM meta WHERE k='seq'),?,?,?)
        ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, ver=excluded.ver, seq=excluded.seq, deleted=excluded.deleted, at=excluded.at, by=excluded.by WHERE rows.ver=?`)
        .bind(col, id, data, ver, del ? 1 : 0, now(), ses.user.id, curVer)
    ]);
    if (!res[1].meta.changes) {
      const fresh = await S.row(col, id);
      results.push({ col, id, ok: false, conflict: true, reason: 'تم تعديل هذا السجل من مستخدم آخر قبل حفظك', ver: fresh ? fresh.ver : 0, data: fresh && !fresh.deleted ? fresh.obj : null, deleted: !!(fresh && fresh.deleted) });
      continue;
    }
    if (col !== 'audit') await S.log(ses.user.id, ses.role, del ? 'delete' : (curObj ? 'update' : 'insert'), col, id, 1, changed(curObj, newObj).slice(0, 8).join(','));
    if (col === 'users' && !del && newObj.email) await ensureAuth(S, newObj);
    results.push({ col, id, ok: true, ver });
  }
  return { seq: await S.seq(), results };
}

// كل مستخدم جديد يحصل على سجل دخول بلا كلمة مرور؛ يصدر له مسؤول النظام كلمة مرور مؤقتة
async function ensureAuth(S, u) {
  const e = await S.db.prepare('SELECT user_id FROM auth WHERE user_id=?').bind(u.id).first();
  if (e) { await S.db.prepare('UPDATE auth SET email=? WHERE user_id=?').bind(u.email.toLowerCase(), u.id).run().catch(() => {}); return }
  await S.db.prepare('INSERT OR IGNORE INTO auth(user_id,email,salt,hash) VALUES(?,?,?,?)').bind(u.id, u.email.toLowerCase(), '', '').run();
}

// حساب تجريبي جاهز لشخص يجرّب المنصة كموظف حقيقي (يُعاد ضبطه كل مرة)
async function seedGuest(S, ses) {
  const G = 'u_guest', day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const put = async (col, o) => {
    const cur = await S.row(col, o.id), ver = (cur ? cur.ver : 0) + 1;
    await S.db.batch([
      S.db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k='seq'"),
      S.db.prepare(`INSERT INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES(?,?,?,?,(SELECT CAST(v AS INTEGER) FROM meta WHERE k='seq'),0,?,?)
        ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, ver=excluded.ver, seq=excluded.seq, deleted=0, at=excluded.at, by=excluded.by`).bind(col, o.id, JSON.stringify(o), ver, now(), ses.user.id)
    ]);
  };
  // امسح أي سجلات سابقة للحساب (إعادة ضبط)
  const { results: old } = await S.db.prepare("SELECT col,id,data FROM rows WHERE deleted=0 AND col<>'users'").all();
  for (const r of old) { const o = JSON.parse(r.data); if (o.userId === G || o.empId === G || o.to === G || o.by === G) await S.db.batch([S.db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k='seq'"), S.db.prepare("UPDATE rows SET deleted=1, ver=ver+1, seq=(SELECT CAST(v AS INTEGER) FROM meta WHERE k='seq') WHERE col=? AND id=?").bind(r.col, r.id)]) }
  const u = { id: G, name: 'ضيف المنصة', email: 'guest@qb.org.sa', roles: ['employee'], deptId: 'S11', jobId: 'J1', managerId: 'u_abdulaziz', title: 'منسق حلقات', empNo: 'QB-9001', active: true };
  await put('users', u);
  const t = new Date().toISOString();
  // 1) دورة حضورية قريبة مسجّل فيها
  await put('enrolls', { id: 'en_guest_c1', userId: G, courseId: 'c1', status: 'registered', at: day(-5), by: G, att: null, pre: null, post: null });
  // 2) دورة مكتملة تنتظر تقييمه + شهادتها
  await put('enrolls', { id: 'en_guest_p4', userId: G, courseId: 'p4', status: 'completed', at: '2026-08-10', by: G, att: true, pre: null, post: null });
  await put('completions', { id: 'cp_guest_p4', userId: G, kind: 'c', refId: 'p4', date: '2026-08-22', hours: 6, cert: 'QB-2026-G0001' });
  // 3) دورة مسجّلة بدأها ووقف في الدرس الثاني
  await put('libenr', { id: 'le_guestL1', userId: G, libId: 'L1', at: day(-3) + 'T08:00:00Z', status: 'registered' });
  await put('progress', { id: G + '|L1a', userId: G, lessonId: 'L1a', watched: [[0, 15]], pos: 15, max: 15, dur: 15, plays: 1, updated: t });
  await put('progress', { id: G + '|L1b', userId: G, lessonId: 'L1b', watched: [[0, 6]], pos: 6, max: 6, dur: 15, plays: 1, updated: t });
  // 4) زيارة ميدانية رجّعها رئيسه للتعديل
  await put('visits', { id: 'vs_guest', userId: G, mgrId: 'u_abdulaziz', org: 'جمعية تحفيظ القرآن بعنيزة', people: 'أ. سعد المحمد — مشرف الحلقات', date: day(-12), goals: 'الاطلاع على آلية متابعة الحلقات.', start: '09:00', end: '11:00', durMin: 120, topics: 'آلية المتابعة الأسبوعية.', results: 'استفدنا.', recs: '', attach: [], status: 'returned', at: day(-11) + 'T09:00:00Z', submittedAt: day(-11) + 'T09:00:00Z', mgrNote: 'اكتب النتائج بتفصيل أكثر: وش الشي اللي بنطبقه عندنا؟', decisions: [{ at: day(-11) + 'T09:00:00Z', by: G, action: 'submit', note: '' }, { at: day(-9) + 'T10:00:00Z', by: 'u_abdulaziz', action: 'return', note: 'اكتب النتائج بتفصيل أكثر: وش الشي اللي بنطبقه عندنا؟' }], decidedAt: day(-9) + 'T10:00:00Z' });
  // 5) دورة خارجية معتمدة (تحسب في ساعاته)
  await put('extreq', { id: 'ex_guest', userId: G, title: 'مهارات التعليم عن بعد لمعلمي القرآن', provider: 'أكاديمية تبيان', trainer: '', date: '2026-10-05', hours: 8, field: 'quran', desc: '', skills: '', certFile: '', attach: [], status: 'approved', at: '2026-10-06T09:00:00Z', decidedAt: '2026-10-08T09:00:00Z', decisions: [{ at: '2026-10-06T09:00:00Z', by: G, action: 'submit', note: '' }, { at: '2026-10-08T09:00:00Z', by: 'u_noura', action: 'approve', note: '' }] });
  // 6) رسالة ترحيب
  await put('mails', { id: 'ml_guest_welcome', to: G, subj: 'هلا فيك في منصة التطوير والتدريب', title: 'حسابك جاهز', body: '<p>هذا حساب تجريبي كموظف في قسم الحلقات. في الرئيسية بتلقى اللي يحتاجك: دورة قريبة، دورة مسجّلة تكمّلها، تقييم، وزيارة رجّعها رئيسك. جرّب كل شي براحتك.</p>', cta: 'الرئيسية', go: 'home', date: day(0), at: t, unread: true, from: 'منصة التطوير والتدريب' });
  // كلمة مرور مؤقتة
  const pw = tempPassword(), salt = rand(8);
  await S.db.prepare('INSERT INTO auth(user_id,email,salt,hash,fails,locked_until,must_change) VALUES(?,?,?,?,0,0,1) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, salt=excluded.salt, hash=excluded.hash, fails=0, locked_until=0, must_change=1')
    .bind(G, u.email, salt, await hashPw(pw, salt)).run();
  await S.db.prepare('DELETE FROM sessions WHERE user_id=?').bind(G).run();
  await S.log(ses.user.id, ses.role, 'demo.guest', 'users', G, 1, 'reset guest');
  return { email: u.email, password: pw };
}

async function api(req, env, url) {
  const S = new Store(env.DB);
  const body = async () => { try { return await req.json() } catch (e) { return {} } };
  const p = url.pathname;

  if (p === '/api/login' && req.method === 'POST') {
    const { email, password } = await body();
    const a = await S.db.prepare('SELECT * FROM auth WHERE email=?').bind(String(email || '').toLowerCase().trim()).first();
    const bad = () => json({ error: 'البريد أو كلمة المرور غير صحيحة' }, 401);
    if (!a) { await S.log('', '', 'login.fail', '', '', 0, 'unknown ' + String(email).slice(0, 80)); return bad() }
    if (a.locked_until > Date.now()) return json({ error: 'الحساب مقفل مؤقتًا بعد محاولات فاشلة. حاول بعد دقائق.' }, 429);
    if (!a.hash) return json({ error: 'لم تُفعَّل كلمة مرور لهذا الحساب بعد. اطلب من مسؤول النظام إصدار كلمة مرور مؤقتة.' }, 401);
    if (await hashPw(String(password || ''), a.salt) !== a.hash) {
      const f = a.fails + 1;
      await S.db.prepare('UPDATE auth SET fails=?, locked_until=? WHERE user_id=?').bind(f, f >= 5 ? Date.now() + 5 * 60e3 : 0, a.user_id).run();
      await S.log(a.user_id, '', 'login.fail', '', '', 0, 'bad password #' + f); return bad();
    }
    const u = await S.user(a.user_id); if (!u || u.active === false) return json({ error: 'الحساب موقوف' }, 403);
    await S.db.prepare('UPDATE auth SET fails=0, locked_until=0 WHERE user_id=?').bind(a.user_id).run();
    const token = rand(24);
    await S.db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(token, u.id, Date.now()).run();
    await S.log(u.id, '', 'login', '', '', 1, '');
    return json({ user: u, mustChange: !!a.must_change }, 200, { 'Set-Cookie': `qbs=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}` });
  }
  if (p === '/api/logout') {
    const s = await session(req, S);
    if (s) { await S.db.prepare('DELETE FROM sessions WHERE token=?').bind(s.token).run(); await S.log(s.user.id, s.role, 'logout', '', '', 1, '') }
    return json({ ok: true }, 200, { 'Set-Cookie': 'qbs=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict' });
  }
  const ses = await session(req, S);
  if (!ses) return json({ error: 'انتهت الجلسة، سجّل الدخول من جديد' }, 401);
  if (p === '/api/me') { const a = await S.db.prepare('SELECT must_change FROM auth WHERE user_id=?').bind(ses.user.id).first(); return json({ user: ses.user, role: ses.role, mustChange: !!(a && a.must_change) }) }
  if (p === '/api/data') return json(await snapshot(ses, S));
  if (p === '/api/changes') return json(await changes(ses, S, +url.searchParams.get('since') || 0));
  if (p === '/api/sync' && req.method === 'POST') { const b = await body(); return json(await sync(ses, S, b.ops)) }
  if (p === '/api/cert/link') {
    const id = url.searchParams.get('id') || '';
    const r = await S.row('completions', id);
    if (!r || r.deleted) return json({ error: 'الشهادة غير موجودة' }, 404);
    const own = r.obj.userId === ses.user.id;
    const mgr = ses.role === 'trainmgr' || ses.role === 'sysadmin';
    const line = ses.role === 'linemgr' && ((await S.user(r.obj.userId)) || {}).managerId === ses.user.id;
    if (!own && !mgr && !line) return json({ error: 'غير مصرّح' }, 403);
    return json({ url: url.origin + '/v/' + id + '.' + (await vCode(S, id)) });
  }
  if (p === '/api/password/reset' && req.method === 'POST') {
    const b = await body();
    if (ses.role !== 'sysadmin') { await S.log(ses.user.id, ses.role, 'denied', 'auth', b.userId, 0, 'reset password'); return json({ error: 'إصدار كلمات المرور لمسؤول النظام فقط' }, 403) }
    const u = await S.user(b.userId); if (!u) return json({ error: 'مستخدم غير موجود' }, 404);
    if (u.id === ses.user.id) return json({ error: 'غيّر كلمة مرورك من «ملفي الشخصي»' }, 400);
    const pw = tempPassword(), salt = rand(8);
    await S.db.prepare('INSERT INTO auth(user_id,email,salt,hash,fails,locked_until,must_change) VALUES(?,?,?,?,0,0,1) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, salt=excluded.salt, hash=excluded.hash, fails=0, locked_until=0, must_change=1')
      .bind(u.id, u.email.toLowerCase(), salt, await hashPw(pw, salt)).run();
    await S.db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run();
    await S.log(ses.user.id, ses.role, 'password.reset', 'auth', u.id, 1, u.name);
    return json({ password: pw, name: u.name, email: u.email });
  }
  if (p === '/api/password/change' && req.method === 'POST') {
    const b = await body();
    const a = await S.db.prepare('SELECT * FROM auth WHERE user_id=?').bind(ses.user.id).first();
    if (!a || await hashPw(String(b.current || ''), a.salt) !== a.hash) return json({ error: 'كلمة المرور الحالية غير صحيحة' }, 400);
    const np = String(b.next || '');
    if (np.length < 8 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) return json({ error: 'كلمة المرور الجديدة: 8 أحرف على الأقل، وتضم حروفًا وأرقامًا' }, 400);
    const salt = rand(8);
    await S.db.prepare('UPDATE auth SET salt=?, hash=?, must_change=0 WHERE user_id=?').bind(salt, await hashPw(np, salt), ses.user.id).run();
    await S.db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').bind(ses.user.id, ses.token).run();
    await S.log(ses.user.id, ses.role, 'password.change', 'auth', ses.user.id, 1, '');
    return json({ ok: true });
  }
  if (p === '/api/demo/guest' && req.method === 'POST') {
    if (ses.role !== 'sysadmin') return json({ error: 'لمسؤول النظام فقط' }, 403);
    return json(await seedGuest(S, ses));
  }
  if (p === '/api/events') {
    if (ses.role !== 'sysadmin') return json({ error: 'غير مصرّح' }, 403);
    const { results } = await S.db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT 500').bind(+url.searchParams.get('since') || 0).all();
    return json(results);
  }
  return json({ error: 'not found' }, 404);
}

// ===== صفحة تحقّق عامة من شهادة: /v/<id>.<code> =====
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AR_DATE = d => { try { return new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) } catch (e) { return d } };

function vShell(body, title) {
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} — منصة التطوير والتدريب</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<style>
:root{--navy:#072C49;--teal:#007497;--sand:#ECE6DD;--sand2:#F6F3EE;--paper:#FBFAF7;--ink:#14263A;--ink2:#5A6B7C;--ok:#17603A;--okbg:#DDF1E4;--no:#8E2A1F;--nobg:#F7E1DE}
*{box-sizing:border-box}
body{margin:0;background:var(--sand);color:var(--ink);font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;line-height:1.8;
 display:grid;place-items:center;min-height:100vh;padding:24px 16px}
.card{background:var(--paper);border-radius:16px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 18px 50px rgba(7,44,73,.12)}
.band{height:14px;background:var(--navy) url('/brand-pattern.svg') repeat;background-size:52px}
.in{padding:26px 26px 22px}
.tag{display:inline-flex;align-items:center;gap:7px;border-radius:99px;padding:6px 14px;font-size:13px;font-weight:600}
.ok{background:var(--okbg);color:var(--ok)}.no{background:var(--nobg);color:var(--no)}
h1{font-size:19px;margin:16px 0 2px;color:var(--navy);font-weight:700;line-height:1.5}
.sub{color:var(--ink2);font-size:13px;margin:0}
dl{display:grid;grid-template-columns:auto 1fr;gap:10px 16px;margin:20px 0 0;font-size:14px}
dt{color:var(--ink2);font-size:12.5px}
dd{margin:0;font-weight:600;color:var(--navy)}
.no-wrap{font-variant-numeric:tabular-nums;letter-spacing:.05em}
footer{border-top:1px solid var(--sand);background:var(--sand2);padding:12px 26px;font-size:11.5px;color:var(--ink2);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.demo{background:#FBEFD9;color:#7A5410;font-size:12px;padding:8px 26px}
</style></head><body><div class="card"><div class="band"></div>${body}<div class="band"></div></div></body></html>`,
   { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

async function verifyPage(env, url) {
  const S = new Store(env.DB);
  const tok = decodeURIComponent(url.pathname.slice(3));
  const dot = tok.lastIndexOf('.');
  const bad = () => vShell(`<div class="in"><span class="tag no">تعذّر التحقق</span>
    <h1>لم نعثر على شهادة بهذا الرمز</h1>
    <p class="sub">تأكد من مسح الرمز كاملًا من الشهادة الأصلية. إن استمرت المشكلة فراجع إدارة التدريب في الجمعية.</p></div>
    <footer><span>الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</span><span>منصة التطوير والتدريب</span></footer>`, 'تعذّر التحقق');
  if (dot < 1) return bad();
  const id = tok.slice(0, dot), code = tok.slice(dot + 1).toUpperCase();
  const r = await S.row('completions', id);
  if (!r || r.deleted) return bad();
  if (code !== await vCode(S, id)) return bad();
  const c = r.obj, u = await S.user(c.userId);
  const ref = await S.row(c.kind === 'l' ? 'libs' : 'courses', c.refId);
  const course = ref && !ref.deleted ? (ref.obj.title || '—') : '—';
  return vShell(`<div class="in"><span class="tag ok">شهادة صحيحة</span>
    <h1>${esc(course)}</h1>
    <p class="sub">صادرة من الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</p>
    <dl>
      <dt>اسم المتدرّب</dt><dd>${esc(u ? u.name : '—')}</dd>
      <dt>تاريخ الإتمام</dt><dd>${esc(AR_DATE(c.date))}</dd>
      <dt>الساعات التدريبية</dt><dd>${esc(c.hours)} ساعات</dd>
      <dt>رقم الشهادة</dt><dd class="no-wrap">${esc(c.cert)}</dd>
    </dl></div>
    ${c.demo ? '<div class="demo">هذه شهادة تجريبية من نسخة الاختبار، وبياناتها غير حقيقية.</div>' : ''}
    <footer><span>الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</span><span>منصة التطوير والتدريب</span></footer>`, 'تحقّق من شهادة');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/v/')) {
      try { await ensureReady(env.DB); return await verifyPage(env, url) }
      catch (e) { console.error(e); return new Response('خطأ في الخادم', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) }
    }
    if (url.pathname.startsWith('/api/')) {
      try { await ensureReady(env.DB); return await api(req, env, url) }
      catch (e) { console.error(e); return json({ error: 'خطأ في الخادم: ' + String(e && e.message || e).slice(0, 200) }, 500) }
    }
    return env.ASSETS.fetch(req);
  }
};
