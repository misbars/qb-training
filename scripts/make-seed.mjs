// يولّد migrations/0002_seed.sql من scripts/seed.json، وكلمات مرور مؤقتة لكل مستخدم في credentials.json (لا يُرفع إلى المستودع)
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir = new URL('..', import.meta.url).pathname;
const seed = JSON.parse(fs.readFileSync(dir + 'scripts/seed.json', 'utf8'));
const COLS = ['users','depts','jobs','comps','assess','courses','libs','enrolls','completions','surveys','attempts','progress','tests','mgrEvals','kpis','kpiMeas','kpiLinks','programs','plans','trainers','mails','audit','nominations','libenr','readings','readprog','comments','extreq','visits','retakes','files'];
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const at = new Date().toISOString();
let seq = 0;
const out = ['-- بيانات أولية (تجريبية) — مولَّدة آليًا'];
const push = (col, id, obj) => { seq++; out.push(`INSERT OR IGNORE INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES(${q(col)},${q(id)},${q(JSON.stringify(obj))},1,${seq},0,${q(at)},'seed');`) };
for (const c of COLS) for (const r of seed[c] || []) push(c, r.id, r);
push('settings', 'settings', { ...seed.settings, demoLoaded: true });
out.push(`UPDATE meta SET v=${q(seq)} WHERE k='seq' AND CAST(v AS INTEGER) < ${seq};`);
const creds = {};
for (const u of seed.users) {
  const pw = 'Qb-' + crypto.randomBytes(4).toString('hex'), salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.pbkdf2Sync(pw, salt, 100000, 32, 'sha256').toString('hex');
  out.push(`INSERT OR IGNORE INTO auth(user_id,email,salt,hash,fails,locked_until,must_change) VALUES(${q(u.id)},${q(u.email.toLowerCase())},${q(salt)},${q(hash)},0,0,1);`);
  creds[u.email] = { name: u.name, roles: u.roles, password: pw };
}
fs.writeFileSync(dir + 'migrations/0002_seed.sql', out.join('\n') + '\n');
fs.writeFileSync(dir + 'credentials.json', JSON.stringify(creds, null, 1));
console.log('rows', seq, 'users', seed.users.length);
