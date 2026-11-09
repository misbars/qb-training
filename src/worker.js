// منصة التطوير والتدريب — خادم Cloudflare Workers + D1
// دخول حقيقي، صلاحيات تُفحص في الخادم، حفظ على مستوى السجل مع كشف التعارض، ومزامنة حية.
import { authorize, changed } from './rules.js';

const COLS = ['users','depts','jobs','comps','assess','courses','libs','enrolls','completions','surveys','attempts','progress','tests','mgrEvals','kpis','kpiMeas','kpiLinks','programs','plans','trainers','mails','audit','nominations','libenr','readings','readprog','comments','extreq','visits','retakes','files','settings'];
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

async function snapshot(ses, S) {
  const { results } = await S.db.prepare('SELECT col,id,data,ver FROM rows WHERE deleted=0').all();
  const out = { seq: await S.seq(), vers: {} };
  for (const c of COLS) { out[c] = c === 'settings' ? {} : []; out.vers[c] = {} }
  for (const r of results) {
    if (!COLS.includes(r.col)) continue;
    if (r.col === 'audit' && ses.role !== 'sysadmin') continue;
    const o = JSON.parse(r.data);
    if (r.col === 'settings') out.settings = o; else out[r.col].push(o);
    out.vers[r.col][r.id] = r.ver;
  }
  return out;
}

async function changes(ses, S, since) {
  const { results } = await S.db.prepare('SELECT col,id,data,ver,deleted,seq,by FROM rows WHERE seq>? ORDER BY seq LIMIT 2000').bind(since).all();
  return {
    seq: results.length ? results[results.length - 1].seq : Math.max(since, await S.seq()),
    rows: results.filter(r => !(r.col === 'audit' && ses.role !== 'sysadmin')).map(r => ({ col: r.col, id: r.id, ver: r.ver, deleted: !!r.deleted, by: r.by, data: r.deleted ? null : JSON.parse(r.data) }))
  };
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
  if (p === '/api/events') {
    if (ses.role !== 'sysadmin') return json({ error: 'غير مصرّح' }, 403);
    const { results } = await S.db.prepare('SELECT * FROM events WHERE seq>? ORDER BY seq LIMIT 500').bind(+url.searchParams.get('since') || 0).all();
    return json(results);
  }
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url) }
      catch (e) { console.error(e); return json({ error: 'خطأ في الخادم' }, 500) }
    }
    return env.ASSETS.fetch(req);
  }
};
