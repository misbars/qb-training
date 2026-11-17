# -*- coding: utf-8 -*-
"""تجهيز قاعدة الإنتاج للإطلاق: إخراج SQL يُنفَّذ بـwrangler.

    python3 scripts/launch.py clean              > /tmp/clean.sql
    python3 scripts/launch.py org roster.json    > /tmp/org.sql
    python3 scripts/launch.py roster-template    > roster.json

    npx wrangler d1 execute qb-training-db --remote --file /tmp/clean.sql

لماذا حذفٌ لا إخفاء: في البذرة 733 صفًّا من 760 موسومةً «تجريبي»، ومنها
**الإدارات والأقسام والوظائف كلها** — وهي أسماءٌ متخيَّلة لا تطابق
الجمعية. وإعداد «إخفاء البيانات التجريبية» مُرشِّحُ عرضٍ لا حدٌّ: في
الشفرة 241 موضعًا يمرّ على المجموعات بلا `inc()`، فتظهر الصفوف
التجريبية في تقريرٍ أو تصديرٍ ولو أُخفيت. ومع بياناتٍ حقيقية في الجدول
نفسه، هذا خطرٌ لا يُحتمل. والبذرة محفوظة في migrations/0002_seed.sql
فيبقى العرض التجريبي متاحًا على نسخةٍ أخرى.
"""
import json, sys, os

Q = lambda s: "'" + str(s).replace("'", "''") + "'"
# كل إدراج يأخذ seq أكبر ممّا قبله: الدالة تُحسب بعد الإدراج السابق
SEQ = "(SELECT COALESCE(MAX(seq),0)+1 FROM rows)"


def row(col, obj):
    """صفٌّ في جدول rows بشكله الذي يتوقّعه الخادم."""
    return (f"INSERT INTO rows(col,id,data,ver,seq,deleted,at,by) VALUES("
            f"{Q(col)},{Q(obj['id'])},{Q(json.dumps(obj, ensure_ascii=False))},"
            f"1,{SEQ},0,datetime('now'),'launch');")


def clean():
    out = ["-- تنظيف البيانات التجريبية. نفّذه قبل أول دخول حقيقي.",
           "-- وبعده أعد تحميل الصفحة في أي جلسة مفتوحة.",
           "DELETE FROM rows WHERE json_extract(data,'$.demo')=1;",
           "-- صفوفٌ من تجاربك تشير إلى مستخدمٍ لم يبقَ: تظهر «مستخدم غير",
           "-- معروف» في الشاشات والتقارير",
           *[f"DELETE FROM rows WHERE col<>'users' AND json_extract(data,'$.{k}') IS NOT NULL "
             f"AND json_extract(data,'$.{k}')<>'' AND json_extract(data,'$.{k}') NOT IN "
             f"(SELECT id FROM rows WHERE col='users' AND deleted=0);" for k in ('userId', 'to', 'by')],
           "-- إعداد العرض التجريبي لم يبقَ له ما يعرضه",
           "UPDATE rows SET data=json_set(json_set(data,'$.showDemo',json('false')),"
           "'$.demoLoaded',json('false')), ver=ver+1 WHERE col='settings';",
           "-- حسابات ومواعيد وسجلّ من لم يبقَ له صفُّ مستخدم",
           "DELETE FROM auth     WHERE user_id NOT IN (SELECT id FROM rows WHERE col='users' AND deleted=0);",
           "DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM rows WHERE col='users' AND deleted=0);",
           "DELETE FROM events   WHERE user_id<>'' AND user_id NOT IN (SELECT id FROM rows WHERE col='users' AND deleted=0);",
           "UPDATE meta SET v=(SELECT COALESCE(MAX(seq),0) FROM rows) WHERE k='seq';"]
    return "\n".join(out)


ROLES = {'mgr': ['employee', 'linemgr'], 'head': ['employee', 'linemgr'], 'staff': ['employee']}
LVL_AR = {'mgr': 'مدير إدارة', 'head': 'رئيس قسم', 'staff': 'موظف'}


def check(r):
    """البريد مفتاحٌ فريد في جدول الحسابات، فبريدان متشابهان يعني أن
    حسابًا يحلّ محلّ حساب بلا إشعار. وكذلك المعرّف المكرَّر والرئيس
    المفقود: كلها تمرّ صامتةً وتُكتشف يوم الإطلاق."""
    users = r.get('users', [])
    ids, mails, bad = set(), {}, []
    for u in users:
        for k in ('id', 'name', 'email', 'dept'):
            if not u.get(k): bad.append(f"ناقص «{k}» عند {u.get('name') or u.get('id') or '؟'}")
        i, m = u.get('id'), (u.get('email') or '').lower()
        if i in ids: bad.append(f"المعرّف «{i}» مكرَّر")
        ids.add(i)
        if m in mails: bad.append(f"البريد «{m}» مكرَّر بين {mails[m]} و{i}")
        mails[m] = i
    for u in users:
        if u.get('manager') and u['manager'] not in ids:
            bad.append(f"رئيس «{u['name']}» ({u['manager']}) ليس في القائمة")
    dids = [d.get('id') for d in r.get('departments', [])]
    dids += [s.get('id') for d in r.get('departments', []) for s in d.get('sections', [])]
    if len(set(dids)) != len(dids): bad.append("معرّف إدارةٍ أو قسمٍ مكرَّر")
    known = set(dids)
    for u in users:
        if u.get('dept') and u['dept'] not in known:
            bad.append(f"قسم «{u['name']}» ({u['dept']}) غير معرّف")
        if u.get('level') not in ROLES:
            bad.append(f"مستوى «{u.get('name')}» غير محدَّد (mgr أو head أو staff)")
    if bad: sys.exit("في ملف الأسماء:\n- " + "\n- ".join(bad))


def org(path):
    r = json.load(open(path, encoding='utf-8'))
    check(r)
    deps = {d['id']: d for d in r.get('departments', [])}
    out = ["-- الإدارات والأقسام والوظائف والمستخدمون الحقيقيون."]

    for d in r.get('departments', []):
        out.append(row('depts', {'id': d['id'], 'name': d['name'],
                                 'parent': d.get('parent'), 'type': d.get('type', 'dir'),
                                 'demo': False}))
        # الأقسام تحت إدارتها: الموظف يُسجَّل في قسمه، والمسار والتفويض
        # يُحسبان بالإدارة الحاضنة
        for sec in d.get('sections', []):
            deps[sec['id']] = {**d, **sec, 'parent': d['id']}
            out.append(row('depts', {'id': sec['id'], 'name': sec['name'],
                                     'parent': d['id'], 'type': 'sec', 'demo': False}))
    for j in r.get('jobs', []):
        out.append(row('jobs', {'id': j['id'], 'title': j['title'],
                                'summary': j.get('summary', ''), 'comps': j.get('comps', []),
                                'demo': False}))

    tracks = {}
    out.append("-- المستخدمون. لا كلمات مرور هنا: يُصدرها مسؤول النظام من")
    out.append("-- شاشة المستخدمين، فتُسلَّم للموظف وتُجبَر على التغيير أول دخول.")
    for u in r.get('users', []):
        lvl = u.get('level', 'staff')
        if lvl not in ROLES:
            sys.exit(f"المستوى «{lvl}» غير معروف عند {u.get('name')}؛ المتاح: mgr أو head أو staff")
        d = deps.get(u.get('dept'))
        if not d:
            sys.exit(f"الإدارة أو القسم «{u.get('dept')}» غير معرّف عند {u.get('name')}")
        o = {'id': u['id'], 'name': u['name'], 'email': u['email'],
             'roles': u.get('roles') or ROLES[lvl], 'deptId': u['dept'],
             'jobId': u.get('job'), 'managerId': u.get('manager'),
             'title': u.get('title') or LVL_AR[lvl], 'empNo': u.get('empNo', ''),
             'active': True, 'demo': False}
        if u.get('phone'): o['phone'] = u['phone']
        if u.get('commApprover'):
            o['commApprover'] = True
        out.append(row('users', o))
        out.append(f"INSERT OR REPLACE INTO auth(user_id,email,salt,hash,fails,locked_until,must_change) "
                   f"VALUES({Q(u['id'])},{Q(u['email'].lower())},NULL,NULL,0,0,1);")
        tid = u.get('track') or f"{d.get('trackPrefix', '')}_{lvl}"
        tracks.setdefault(tid, []).append(u['id'])

    out.append("-- عضوية المسارات: الإسناد بالقسم والمستوى، لا بالصفة.")
    out.append("-- (استورد تعريفات المسارات من شاشة المسارات قبل تنفيذ هذا.)")
    for tid, ids in sorted(tracks.items()):
        out.append(f"UPDATE rows SET data=json_set(data,'$.extra',json({Q(json.dumps(ids))})), "
                   f"ver=ver+1, seq={SEQ} WHERE col='tracks' AND id={Q(tid)} AND deleted=0;")
        out.append(f"-- تحقّق: إن لم يتغيّر صفٌّ هنا فالمسار «{tid}» لم يُستورد بعد.")
    out.append("UPDATE meta SET v=(SELECT COALESCE(MAX(seq),0) FROM rows) WHERE k='seq';")
    return "\n".join(out)


TEMPLATE = {
    "departments": [
        {"id": "D_EDU", "name": "إدارة الشؤون التعليمية", "type": "dir", "trackPrefix": "edu",
         "sections": [{"id": "S_EDU_1", "name": "اسم القسم"}]},
        {"id": "D_COMM", "name": "إدارة الاتصال المؤسسي", "type": "dir", "trackPrefix": "comm",
         "sections": [{"id": "S_COMM_1", "name": "اسم القسم"}]}
    ],
    "jobs": [{"id": "J_EDU", "title": "أخصائي شؤون تعليمية"}],
    "users": [
        {"id": "u_x", "name": "الاسم الثلاثي", "email": "name@qb.org.sa", "phone": "05xxxxxxxx",
         "dept": "S_EDU_1", "level": "staff", "job": "J_EDU", "empNo": "QB-2001"}
    ]
}

HELP = """الاستعمال:
  python3 scripts/launch.py clean            -- حذف البيانات التجريبية
  python3 scripts/launch.py org roster.json  -- إنشاء الإدارات والمستخدمين
  python3 scripts/launch.py roster-template  -- قالب ملف الأسماء

المستوى (level): mgr لمدير الإدارة، head لرئيس القسم، staff للموظف —
وهو ما يحدّد أي المسارات الستة يستلم الشخص.
commApprover: true لمن يعتمد الزيارات في الاتصال المؤسسي."""

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'clean':
        print(clean())
    elif cmd == 'org' and len(sys.argv) > 2:
        print(org(sys.argv[2]))
    elif cmd == 'roster-template':
        print(json.dumps(TEMPLATE, ensure_ascii=False, indent=1))
    else:
        sys.exit(HELP)
