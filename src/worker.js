// منصة التطوير والتدريب — خادم Cloudflare Workers + D1
// دخول حقيقي، صلاحيات تُفحص في الخادم، حفظ على مستوى السجل مع كشف التعارض، ومزامنة حية.
import { authorize, changed, readFilter, validate } from './rules.js';
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


/* ===== ترويسات الأمان =====
   المنصة كانت تُقدَّم بلا أي ترويسة حماية: قابلة للوضع داخل إطار في موقع
   آخر، وبلا سياسة محتوى تمنع تحميل نص برمجي من مصدر غريب لو حُقِن. */
const CSP = [
  "default-src 'self'",
  // الصفحة نص برمجي داخلي واحد، فيبقى unsafe-inline؛ والمصادر الخارجية محصورة
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://cdnjs.cloudflare.com",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join('; ');

const SEC_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

function secure(res) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SEC_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
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
  // المعرّف المبهم كان قابلًا للعكس بجدول (فضاء المعرّفات صغير ومعروف)؛ يُملَّح بسرّ الخادم
  return { team: () => teamIds, salt: await vSecret(S) };
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
    out.vers[r.col][o.id || r.id] = r.ver;
  }
  return out;
}

async function changes(ses, S, since) {
  const { results } = await S.db.prepare('SELECT col,id,data,ver,deleted,seq,by FROM rows WHERE seq>? ORDER BY seq LIMIT 2000').bind(since).all();
  const ctx = await readCtx(ses, S);
  const rows = [];
  for (const r of results) {
    if (!COLS.includes(r.col)) continue;
    // الصف المحذوف يحتفظ ببياناته القديمة، فيُرشَّح مثل الحيّ: من لم يكن يراه لا يُعلَم بحذفه
    const o = readFilter(ses, r.col, JSON.parse(r.data), ctx);
    if (!o) continue;
    if (r.deleted) { rows.push({ col: r.col, id: o.id || r.id, ver: r.ver, deleted: true, by: r.by, data: null }); continue }
    rows.push({ col: r.col, id: o.id || r.id, ver: r.ver, deleted: false, by: r.by, data: o });
  }
  return { seq: results.length ? results[results.length - 1].seq : Math.max(since, await S.seq()), rows };
}

/* ===== التصحيح وإصدار الشهادة في الخادم =====
   كان العميل يصحّح الاختبار بنفسه ويكتب الدرجة والشهادة والساعات، وإجابات
   الأسئلة تصله ضمن بيانات الدورة. الآن: الإجابات لا تغادر الخادم (readFilter
   يحذفها)، والتصحيح والساعات ورقم الشهادة من الخادم وحده. */
const today = () => new Date().toISOString().slice(0, 10);
const covered = p => Array.isArray(p && p.watched) ? p.watched.reduce((s, w) => s + (w[1] - w[0]), 0) : 0;
const reqLessons = lib => (lib.modules || []).flatMap(m => m.lessons || []).filter(l => l.required !== false);

async function setts(S) { const r = await S.row('settings', 'settings'); return (r && !r.deleted) ? r.obj : {} }
async function rowsOf(S, col) { return S.all(col) }

// كتابة صف من الخادم بنفس آلية المزامنة: عدّاد يتقدّم وإصدار يزيد
async function put(S, col, id, obj, by) {
  const cur = await S.row(col, id), curVer = cur ? cur.ver : 0;
  // شرط rows.ver يجعل الكتابة ذرّية: طلبان متوازيان لا ينجح منهما إلا واحد
  const res = await S.db.batch([
    S.db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k='seq'"),
    S.db.prepare(`INSERT INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES(?,?,?,?,(SELECT CAST(v AS INTEGER) FROM meta WHERE k='seq'),0,?,?)
      ON CONFLICT(col,id) DO UPDATE SET data=excluded.data, ver=excluded.ver, seq=excluded.seq, deleted=0, at=excluded.at, by=excluded.by WHERE rows.ver=?`)
      .bind(col, id, JSON.stringify(obj), curVer + 1, now(), by, curVer)
  ]);
  return res[1].meta.changes ? obj : null;
}

// إدراج لا يدهس صفًّا قائمًا: يُرجِع false إن كان المعرّف محجوزًا
async function putNew(S, col, id, obj, by) {
  const res = await S.db.batch([
    S.db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k='seq'"),
    S.db.prepare(`INSERT INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES(?,?,?,1,(SELECT CAST(v AS INTEGER) FROM meta WHERE k='seq'),0,?,?)
      ON CONFLICT(col,id) DO NOTHING`).bind(col, id, JSON.stringify(obj), now(), by)
  ]);
  return !!res[1].meta.changes;
}

/* ===== احتساب المشاهدة في الخادم =====
   صفوف progress يكتبها المشغّل في المتصفح، فمن يرسل watched:[[0,dur]] مباشرة
   «يُكمل» الدورة بلا مشاهدة. لذلك تُحتسب المشاهدة في مجموعة «watch» التي لا
   يكتبها العميل إطلاقًا (خارج COLS)، ولا يُضاف فيها إلا ما يسمح به الزمن
   الحقيقي المنقضي بين نبضة وأخرى. */
const TICK_RATE = 1.6;   // هامش للتسريع المسموح وفروق التوقيت
const TICK_GRACE = 3;    // ثوانٍ تسامحًا مرة واحدة منذ فتح الدرس

async function watchRow(S, me, lessonId) {
  const r = await S.row('watch', me + '|' + lessonId);
  return (r && !r.deleted) ? r.obj : null;
}

async function watchDone(S, me, lib) {
  const need = reqLessons(lib);
  if (!need.length) return false;
  const pct = (lib.settings && lib.settings.requiredPct) || (await setts(S)).requiredPct || 100;
  for (const l of need) {
    if (!l.dur) return false;
    const w = await watchRow(S, me, l.id);
    if (!w) return false;
    if (w.attest) continue;                       // إقرار ذاتي مسموح به في هذه الدورة
    if ((w.sec || 0) / Math.ceil(l.dur) * 100 < pct - 1e-9) return false;
  }
  return true;
}

// نبضة المشغّل: الخادم يمنح من الثواني بقدر ما مضى من زمن حقيقي، لا بقدر ما يدّعي العميل
async function watchTick(ses, S, body) {
  const me = ses.user.id;
  const r = await S.row('libs', String(body.libId || ''));
  if (!r || r.deleted) return json({ error: 'الدورة غير موجودة' }, 404);
  const lib = r.obj;
  const les = (lib.modules || []).flatMap(m => m.lessons || []).find(l => l.id === body.lessonId);
  if (!les) return json({ error: 'الدرس غير موجود في هذه الدورة' }, 404);
  const dur = Math.ceil(+les.dur || 0);
  if (!dur) return json({ error: 'مدة الدرس غير محدّدة' }, 400);

  const id = me + '|' + les.id;
  const prev = await watchRow(S, me, les.id) || { id, userId: me, lessonId: les.id, libId: lib.id, sec: 0, open: now(), tick: null, attest: false };
  const t = Date.now();
  const openMs = Date.parse(prev.open || now());

  if (body.attest) {
    if (!(lib.settings && lib.settings.allowAttest)) return json({ error: 'الإقرار الذاتي غير مفعّل لهذه الدورة' }, 403);
    if (t - openMs < 0.9 * dur * 1000) return json({ error: 'لم يمضِ الوقت الكافي على فتح الدرس' }, 403);
    const w = { ...prev, sec: dur, attest: true, tick: now() };
    await put(S, 'watch', id, w, me);
    return json({ ok: true, sec: w.sec, dur, attest: true });
  }

  const claim = Math.max(0, Math.min(dur, Math.floor(+body.sec || 0)));
  const ceiling = Math.max(0, (t - openMs) / 1000) * TICK_RATE + TICK_GRACE;
  const sec = Math.min(dur, Math.max(prev.sec || 0, Math.min(claim, ceiling)));
  const w = { ...prev, sec: Math.floor(sec), tick: now() };
  await put(S, 'watch', id, w, me);
  return json({ ok: true, sec: w.sec, dur, done: w.sec >= dur });
}

async function certNo(S, kind) {
  const r = await S.db.prepare("SELECT COUNT(*) c FROM rows WHERE col='completions' AND deleted=0").first();
  return `QB-${new Date().getFullYear()}-${String(kind).toUpperCase()}${String((r ? r.c : 0) + 1).padStart(4, '0')}`;
}

async function notifyRow(S, to, subj, title, body, cta, go) {
  const id = 'm_' + rand(6);
  return put(S, 'mails', id, { id, to, subj, title, body, cta: cta || '', go: go || '', date: today(), at: now(), unread: true, from: 'منصة التطوير والتدريب', demo: false }, to);
}

// إصدار إنجاز الدورة المسجّلة: مرة واحدة، بساعات الدورة ورقم شهادة من الخادم
async function issueLibCompletion(S, me, lib) {
  const all = await rowsOf(S, 'completions');
  const had = all.find(c => c.userId === me && c.kind === 'l' && c.refId === lib.id);
  if (had) return had;
  const id = 'cp_' + me + '_l_' + lib.id;          // حتمي: المفتاح نفسه لا يُدرَج مرتين
  const cp = { id, userId: me, kind: 'l', refId: lib.id, date: today(), hours: +lib.creditHours || 0, cert: await certNo(S, 'l'), demo: false };
  if (!await putNew(S, 'completions', id, cp, me)) {
    const ex = await S.row('completions', id);
    return ex && !ex.deleted ? ex.obj : cp;
  }
  await S.log(me, 'employee', 'insert', 'completions', id, 1, 'إصدار شهادة: ' + lib.title);
  await notifyRow(S, me, 'تم إصدار شهادة: ' + lib.title, 'تهانينا على إتمام الدورة',
    `<p>أُصدرت شهادتك رقم <b class="num">${cp.cert}</b>.</p>`, 'سجل الإنجاز', 'record');
  return cp;
}

// اختبار المكتبة: الخادم يتحقق من الأهلية ثم يصحّح ويكتب المحاولة والدرجة
async function examSubmit(ses, S, body) {
  const me = ses.user.id;
  const r = await S.row('libs', String(body.libId || ''));
  if (!r || r.deleted) return json({ error: 'الدورة غير موجودة' }, 404);
  const lib = r.obj;
  if (lib.status !== 'published') return json({ error: 'الدورة غير منشورة' }, 403);
  const kind = body.kind === 'pre' ? 'pre' : 'post';
  const quiz = (kind === 'pre' ? lib.preQuiz : lib.quiz) || [];
  if (!quiz.length) return json({ error: 'لا يوجد اختبار لهذه الدورة' }, 400);
  const ans = Array.isArray(body.answers) ? body.answers : [];
  if (ans.length !== quiz.length || ans.some(a => !Number.isInteger(a) || a < 0 || a > 9))
    return json({ error: 'أجب عن جميع الأسئلة' }, 400);

  const st = await setts(S);
  const q = lib.settings || {};
  const score = Math.round(quiz.filter((x, i) => ans[i] === x.ans).length / quiz.length * 100);

  if (kind === 'pre') {
    const tests = (await rowsOf(S, 'tests')).filter(t => t.userId === me && t.ref === 'l' && t.refId === lib.id && t.kind === 'pre');
    if (tests.length) return json({ error: 'الاختبار القبلي يُؤدّى مرة واحدة' }, 409);
    const id = `t_${me}_l_${lib.id}_pre`;
    if (!await putNew(S, 'tests', id, { id, userId: me, ref: 'l', refId: lib.id, kind: 'pre', score, at: today(), demo: false }, me))
      return json({ error: 'الاختبار القبلي يُؤدّى مرة واحدة' }, 409);
    return json({ ok: true, score });
  }

  const comps = await rowsOf(S, 'completions');
  if (comps.some(c => c.userId === me && c.kind === 'l' && c.refId === lib.id))
    return json({ error: 'اجتزت هذا الاختبار سابقًا' }, 409);
  if (!await watchDone(S, me, lib))
    return json({ error: 'يجب إكمال مشاهدة جميع الدروس الإلزامية أولًا' }, 403);

  const retakes = (await rowsOf(S, 'retakes')).filter(x => x.userId === me && (x.libId === lib.id || x.refId === lib.id));
  const round = retakes.filter(x => x.status === 'approved').length;
  const mine = (await rowsOf(S, 'attempts')).filter(a => a.userId === me && a.libId === lib.id && a.kind === 'post');
  const inRound = mine.filter(a => (a.round || 0) === round);
  const maxA = q.maxAttempts ?? st.maxAttempts ?? 2;
  const passScore = q.passScore ?? st.passScore ?? 70;
  const retake = q.allowRetake ?? st.allowRetake ?? true;
  if (inRound.length >= maxA) return json({ error: 'استُنفدت المحاولات المسموحة' }, 403);
  if (inRound.length > 0 && !retake) return json({ error: 'إعادة الاختبار غير مسموحة' }, 403);

  const passed = score >= passScore;
  const n = inRound.length + 1;
  const aid = `at_${me}_${lib.id}_${round}_${n}`;   // رقم المحاولة محجوز بالمعرّف نفسه
  if (!await putNew(S, 'attempts', aid, { id: aid, userId: me, libId: lib.id, kind: 'post', n, round, score, passed, at: now(), answers: ans, demo: false }, me))
    return json({ error: 'محاولة أخرى تُسجَّل الآن، أعد المحاولة بعد لحظات' }, 409);
  const tid = `t_${me}_l_${lib.id}_post_${round}_${n}`;
  await putNew(S, 'tests', tid, { id: tid, userId: me, ref: 'l', refId: lib.id, kind: 'post', score, at: today(), demo: false }, me);
  await S.log(me, ses.role, 'exam', 'attempts', aid, 1, `${lib.title}: ${score}%`);
  const completion = passed ? await issueLibCompletion(S, me, lib) : null;
  return json({ ok: true, score, passed, passScore, attempts: inRound.length + 1, maxA, completion });
}

// دورة بلا اختبار: الشهادة تُمنح عند إتمام الدروس الإلزامية، والخادم هو من يتحقق
async function libClaim(ses, S, body) {
  const me = ses.user.id;
  const r = await S.row('libs', String(body.libId || ''));
  if (!r || r.deleted) return json({ error: 'الدورة غير موجودة' }, 404);
  const lib = r.obj;
  if (lib.status !== 'published') return json({ error: 'الدورة غير منشورة' }, 403);
  if ((lib.quiz || []).length) return json({ error: 'هذه الدورة تتطلّب اجتياز الاختبار' }, 403);
  if (!await watchDone(S, me, lib)) return json({ error: 'لم تكتمل مشاهدة الدروس الإلزامية' }, 403);
  return json({ ok: true, completion: await issueLibCompletion(S, me, lib) });
}

async function sync(ses, S, ops) {
  const ctx = await readCtx(ses, S);
  // ردود التعارض والرفض كانت تُعيد الصف كاملًا، فتلتف على ترشيح القراءة:
  // يكفي إرسال عملية بإصدار خاطئ على أي معرّف لاستخراج محتواه. تُرشَّح الآن.
  const vis = (col, o) => (o ? readFilter(ses, col, o, ctx) : null) || null;
  const results = [];
  for (const op of (ops || []).slice(0, 500)) {
    const { col, id } = op;
    if (!COLS.includes(col) || !id) { results.push({ col, id, ok: false, reason: 'مجموعة غير معروفة' }); continue }
    const cur = await S.row(col, id), curObj = cur && !cur.deleted ? cur.obj : null, curVer = cur ? cur.ver : 0;
    if ((op.base || 0) !== curVer && !(col === 'audit' && !curObj)) {
      results.push({ col, id, ok: false, conflict: true, reason: 'تم تعديل هذا السجل من مستخدم آخر قبل حفظك', ver: curVer, data: vis(col, curObj), deleted: !!(cur && cur.deleted) });
      await S.log(ses.user.id, ses.role, 'conflict', col, id, 0, 'base ' + (op.base || 0) + ' ≠ ' + curVer);
      continue;
    }
    const del = !!op.delete;
    if (del && !curObj) { results.push({ col, id, ok: true, ver: curVer }); continue }
    const newObj = del ? null : op.data;
    if (!del && (!newObj || typeof newObj !== 'object' || (newObj.id !== id && col !== 'settings'))) { results.push({ col, id, ok: false, reason: 'بيانات غير صالحة' }); continue }
    const sane = del ? true : validate(col, newObj);
    if (sane !== true) {
      results.push({ col, id, ok: false, denied: true, reason: sane, ver: curVer, data: vis(col, curObj) });
      await S.log(ses.user.id, ses.role, 'invalid', col, id, 0, sane);
      continue;
    }
    const verdict = authorize(ses, col, curObj, newObj, del, ctx);
    if (verdict === 'skip') { results.push({ col, id, ok: true, ver: curVer }); continue }
    if (verdict !== true) {
      results.push({ col, id, ok: false, denied: true, reason: verdict, ver: curVer, data: vis(col, curObj) });
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
      results.push({ col, id, ok: false, conflict: true, reason: 'تم تعديل هذا السجل من مستخدم آخر قبل حفظك', ver: fresh ? fresh.ver : 0, data: fresh && !fresh.deleted ? vis(col, fresh.obj) : null, deleted: !!(fresh && fresh.deleted) });
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
  if (p === '/api/progress' && req.method === 'POST') return watchTick(ses, S, await req.json().catch(() => ({})));
  if (p === '/api/exam' && req.method === 'POST') return examSubmit(ses, S, await req.json().catch(() => ({})));
  if (p === '/api/lib/claim' && req.method === 'POST') return libClaim(ses, S, await req.json().catch(() => ({})));
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
      try { await ensureReady(env.DB); return secure(await verifyPage(env, url)) }
      catch (e) { console.error(e); return secure(new Response('خطأ في الخادم', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })) }
    }
    if (url.pathname.startsWith('/api/')) {
      try { await ensureReady(env.DB); return secure(await api(req, env, url)) }
      catch (e) { console.error(e); return secure(json({ error: 'خطأ في الخادم: ' + String(e && e.message || e).slice(0, 200) }, 500)) }
    }
    return secure(await env.ASSETS.fetch(req));
  }
};
