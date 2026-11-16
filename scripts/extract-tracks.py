# -*- coding: utf-8 -*-
"""استخراج محاور أدلة المسارات من ملفات PDF إلى tracks/*.json.

الاستعمال:
    python3 scripts/extract-tracks.py <مجلد الأدلة> [<مجلد الخَرج>]

لماذا سكربت لا عملٌ يدوي: الأدلة الستة ٢٢٨ صفحة، و٨١ محورًا، وكل محور
فيه دورة وحلقة وبطاقة تطبيق وروابط. والنصّ العربي في طبقة نصّ الـPDF
مكسور أصلًا — «لا» تخرج «ال»، والحركات تنزاح موضعًا — فالتصحيح قاعدةٌ
تُراجَع لا تصحيحٌ بالفأرة.
"""
import re, sys, json, os, subprocess
from pypdf import PdfReader

BIDI = re.compile(r'[‪-‮‎‏⁦-⁩]')
HARA = 'ً-ْٰ'
DIAC = re.compile('[' + HARA + 'ٓ-ٕـ]')

# «لا» تخرج من طبقة النصّ مقلوبةً «ال»، فيلتصق المقلوب بما قبله
LAM = [('اإل', 'الإ'), ('األ', 'الأ'), ('اآل', 'الآ'), ('اال', 'الا')]

# كلمات تحقّقتُ من كلٍّ منها في سياقها قبل إضافتها
WORDS = [
    # لفظ الجلالة
    ('هللا', 'الله'), ('عبدالله', 'عبد الله'),
    # «لا» داخل الكلمة
    ('المشكالت', 'المشكلات'), ('مشكالت', 'مشكلات'),
    ('الحمالت', 'الحملات'), ('حمالت', 'حملات'),
    ('اإلعالم', 'الإعلام'), ('الإعالم', 'الإعلام'), ('إعالم', 'إعلام'),
    ('إعالن', 'إعلان'), ('إعالنات', 'إعلانات'), ('إعالني', 'إعلاني'),
    ('العالقات', 'العلاقات'), ('عالقات', 'علاقات'),
    ('التالوة', 'التلاوة'), ('تالوة', 'تلاوة'),
    ('األفالم', 'الأفلام'), ('أفالم', 'أفلام'),
    ('مالحظة', 'ملاحظة'), ('مالحظات', 'ملاحظات'),
    ('إبالغ', 'إبلاغ'), ('الوالء', 'الولاء'), ('والء', 'ولاء'),
    ('العالوة', 'العلاوة'), ('كالمه', 'كلامه'), ('كالم', 'كلام'),
    ('بسالسة', 'بسلاسة'), ('خالل', 'خلال'), ('إطالق', 'إطلاق'),
    ('استقالل', 'استقلال'), ('اختالف', 'اختلاف'),
    ('غالف', 'غلاف'),            # اسم برنامج «غلاف» في ثمانية
    ('أضالع', 'أضلاع'), ('سالمة', 'سلامة'), ('أخالق', 'أخلاق'),
    ('انطالق', 'انطلاق'), ('مجاالت', 'مجالات'), ('حاالت', 'حالات'),
    # «ثلاث» تخرج «ثالث» فيختلف المعنى بلا أن يَبين
    ('ثالثة', 'ثلاثة'), ('وثالثة', 'وثلاثة'), ('لثالثة', 'لثلاثة'),
    ('بثالثة', 'بثلاثة'), ('ثالث', 'ثلاث'), ('لثالث', 'لثلاث'),
    ('بثالث', 'بثلاث'), ('ثالثاء', 'ثلاثاء'),
    # «لأ» تخرج «أل»
    ('ألسبوع', 'لأسبوع'), ('ألن', 'لأن'), ('ألعمال', 'لأعمال'),
    ('ألنماط', 'لأنماط'), ('ألنها', 'لأنها'), ('ألداة', 'لأداة'),
    ('ألنه', 'لأنه'), ('ألدوات', 'لأدوات'),
    ('لألعمال', 'للأعمال'), ('لالحتفاظ', 'للاحتفاظ'), ('الستقبال', 'لاستقبال'),
    ('الحتفاظ', 'للاحتفاظ'),
    # كلمات انكسرت بمسافة في طبقة النصّ
    ('الفع ال', 'الفعال'), ('الفع الة', 'الفعالة'), ('الفّع ال', 'الفعال'),
    ('قد متها', 'قدمتها'), ('ك ل ف', 'كلف'), ('ج ر بت', 'جربت'),
    ('ح د ث', 'حدث'), ('تنف ذ', 'تنفذ'), ('اخت صر', 'اختصر'),
    ('فعل ا', 'فعلا'), ('غد ا', 'غدا'), ('كبير ا', 'كبيرا'),
    ('وقت ا', 'وقتا'), ('طويل ا', 'طويلا'), ('لتتحك في', 'لتتحكم في'),
    ('تجّر بها', 'تجربها'), ('تجر بها', 'تجربها'),
]

# عباراتٌ انكسرت في طبقة النصّ بحيث لا تردّها قاعدة عامّة؛ كلٌّ منها
# مُقابَلٌ بصفحته في الدليل
PHRASES = [
    ('صف ثا يجعل المؤسسة أقوى ن', 'صف ثان يجعل المؤسسة أقوى'),
    ('صف ثا يجعل المؤسسة أقوىن', 'صف ثان يجعل المؤسسة أقوى'),
]

def norm(s, drop_diac=True):
    s = BIDI.sub('', s)
    for a, b in LAM:
        s = s.replace(a, b)
    # الحركة تخرج سابقةً حرفها بموضع واحد. تُردّ مرةً واحدة فقط: تكرار
    # الإزاحة يدفعها إلى الكلمة التالية فتلتصق الكلمتان.
    s = re.sub('([ء-ي])([' + HARA + '])([ء-ي])', r'\1\3\2', s)
    # حركةٌ في آخر مقطعٍ وبقيةُ الكلمة بعد مسافة: تُوصل حين تكون البقية
    # حرفًا واحدًا أو لاحقةً معروفة، ولا تُوصل حين تكون كلمةً قائمة بذاتها
    s = re.sub('([' + HARA + ']) (?=[ء-ي](?:\\s|$))', r'\1', s)
    s = re.sub('([' + HARA + ']) (ون|ين|ان|ات|ها|هم|نا|كم|هن|ية|تي)(?=\\s|$)', r'\1\2', s)
    # النقطتان والترقيم ينزاحان في الاستخراج العربي
    s = re.sub(r'(\S+) :(?=\S)', r'\1: ', s)
    s = re.sub(r'المدة (\d[\d:]*):\s*', r'المدة: \1 ', s)   # «المدة 49: د»
    s = re.sub(r' ([،.؛؟!])', r'\1', s)
    s = re.sub('([،.؛؟!])(?=[ء-ي])', r'\1 ', s)
    if drop_diac:
        # ما بقي من حركاتٍ بعد الردّ مشكوكٌ فيه، وإبقاؤه إبقاءٌ للخطأ.
        # والنصّ غير المشكول عربيةٌ سليمة يقرؤها الموظف بلا عثرة.
        s = DIAC.sub('', s)
    s = s.replace('هللا', 'الله')          # تلتصق بما قبلها: «عبدهللا»
    # جذورٌ لا تأتي في العربية إلا مقلوبة، فتُصحَّح بلا حدود كلمة لتلحقها
    # اللواحق: «الإعالمي» و«إعالنية» و«للعالقات»
    for a, b in (('الإعالم', 'الإعلام'), ('إعالن', 'إعلان'), ('إعالم', 'إعلام'),
                 ('عالقات', 'علاقات'), ('مشكالت', 'مشكلات'), ('حمالت', 'حملات'),
                 ('الصالحية', 'الصلاحية'), ('صالحيات', 'صلاحيات')):
        s = s.replace(a, b)
    for a, b in PHRASES:
        s = s.replace(a, b)
    for a, b in WORDS:
        s = re.sub(r'(?<![ء-ي])' + re.escape(a) + r'(?![ء-ي])', b, s)
    # «ال» لا تقوم وحدها في العربية: كل «ال» منفردة هي «لا» مقلوبة
    s = re.sub(r'(?<![ء-ي])ال(?![ء-ي])', 'لا', s)
    s = re.sub(r'(?<![ء-ي])بال(?=\s)', 'بلا', s)
    s = re.sub(r'(\d)(?=[ء-ي])', r'\1 ', s)   # «1000ريال»
    return re.sub(r'[ \t]+', ' ', s).strip()

def pages_text(path):
    raw = subprocess.run(['pdftotext', '-enc', 'UTF-8', path, '-'],
                         capture_output=True, text=True).stdout
    return [norm(p) for p in raw.split('\f')]

def pages_urls(path):
    out = []
    for pg in PdfReader(path).pages:
        u = []
        for a in (pg.get('/Annots') or []):
            try:
                act = a.get_object().get('/A')
                if act and act.get('/URI'):
                    v = str(act['/URI'])
                    if v not in u: u.append(v)
            except Exception:
                pass
        out.append(u)
    return out

HOST = {'edraak.org': 'منصة إدراك', 'sdeem.org': 'منصة سديم', 'rwaq.org': 'منصة رواق',
        'lms.doroob.sa': 'منصة دروب', 'niepd.futurex.sa': 'FutureX — المعهد الوطني',
        'youtube.com': 'يوتيوب', 'youtu.be': 'يوتيوب', 'rf.org.sa': 'مؤسسة الملك فيصل'}

def host_of(u):
    m = re.match(r'https?://(?:www\.)?([^/]+)', u)
    h = m.group(1) if m else ''
    for k, v in HOST.items():
        if k in h: return v
    return h

def yt_id(u):
    m = re.search(r'(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})', u)
    return m.group(1) if m else ''

AXHEAD = re.compile(r'(\d+)\s*من\s*\|\s*(\d+)\s*المحور')
# ===== العنوان والعنوان الفرعي من هندسة الصفحة =====
# نصّ pdftotext المسطّح يفتّت السطر المرئي إلى أسطر: حرفٌ مشكولٌ يخرج
# وحده، والعنوان الطويل يلتف. فكان العنوان الفرعي يُقرأ ناقصًا في نحو
# نصف المحاور. والحلّ أن نقرأ صناديق الكلمات: نجمع ما استوى عرضه وموضعه
# الرأسي سطرًا واحدًا، ونفرّق العنوان من الفرعي بعلوّ السطر (حجم الخط).
import unicodedata
from xml.etree import ElementTree as ET
XH = '{http://www.w3.org/1999/xhtml}'
LATIN = re.compile(r'[0-9A-Za-z:\-/_.]+')

def _rev(w):
    """الكلمة تخرج بترتيب بصري معكوس؛ تُقلب مع إبقاء الحركة لاصقةً بحرفها،
    وتُترك الأرقام واللاتينية كما هي لأنها غير معكوسة."""
    if LATIN.fullmatch(w or ''): return w
    out, buf = [], ''
    for ch in (w or ''):
        if unicodedata.combining(ch): buf = ch + buf
        else:
            out.append(ch + buf); buf = ''
    if buf: out.append(buf)
    return ''.join(reversed(out))

def _page_lines(pdf, page):
    xml = subprocess.run(['pdftotext', '-enc', 'UTF-8', '-bbox-layout',
                          '-f', str(page), '-l', str(page), pdf, '-'],
                         capture_output=True, text=True).stdout
    try: root = ET.fromstring(xml)
    except ET.ParseError: return []
    raw = []
    for ln in root.iter(XH + 'line'):
        ws = [(float(w.get('xMin')), (w.text or '')) for w in ln.iter(XH + 'word')]
        if not ws: continue
        ws.sort(key=lambda t: -t[0])
        # الترتيب من اليمين صحيحٌ للعربية، أمّا تتابعُ كلماتٍ لاتينية فهو
        # وحدةٌ تُقرأ من اليسار: تُعاد إلى اتجاهها («BI Power» ← «Power BI»)
        seq = [_rev(w[1]) for w in ws]; fixed = []; run = []
        for w in seq:
            if LATIN.fullmatch(w): run.append(w)
            else:
                fixed += reversed(run); run = []; fixed.append(w)
        fixed += reversed(run)
        raw.append({'y': float(ln.get('yMin')), 'h': float(ln.get('yMax')) - float(ln.get('yMin')),
                    'x': float(ln.get('xMax')), 'txt': ' '.join(fixed)})
    # ما استوى في الموضع الرأسي والعلوّ سطرٌ مرئي واحد، يُرتَّب من اليمين
    groups = {}
    for r in raw:
        groups.setdefault((round(r['y'], 0), round(r['h'], 0)), []).append(r)
    out = []
    for (y, h), g in groups.items():
        g.sort(key=lambda r: -r['x'])
        out.append((y, h, ' '.join(r['txt'] for r in g)))
    out.sort(key=lambda t: t[0])
    return out

STOP = ('مهارة ←', 'اتجاه ←', 'معرفة ←', 'وقفة مع', 'تطبيق قصير')
# ترويسة المحور في بناء الصناديق «2 من 16 | المحور الثاني»، وفي النصّ
# المسطّح «2من | 16المحور الثاني»: ترتيب مختلف، فلها نمطٌ أوسع هنا
AXHEAD_BB = re.compile(r'\d+\s*من\s*\|?\s*\d+\s*\|?\s*المحور')

def _join_frag(L):
    """الحرف المشكول يخرج سطرًا وحده تحت سطره. ما تداخل رأسيًا مع ما قبله
    وكان حرفًا أو حرفين فهو بقيةُ كلمةٍ منه: يُلحق بأول كلمةٍ قصيرة فيه."""
    out = []
    for y, h, t in L:
        bare = DIAC.sub('', t).strip()
        if out and len(bare) <= 2 and y < out[-1][0] + out[-1][1]:
            py, ph, pt = out[-1]
            w = pt.split(' ')
            if w and len(DIAC.sub('', w[0])) <= 2:
                w[0] = w[0] + t.strip()
                out[-1] = (py, ph, ' '.join(w))
            else:
                out[-1] = (py, ph, pt + t.strip())
            continue
        out.append((y, h, t))
    return out

def heads_of(pdf, pages):
    """لكل صفحة محور: عنوانه وعنوانه الفرعي، بعلوّ السطر لا بموضعه."""
    out = {}
    for i in pages:
        L = _join_frag(_page_lines(pdf, i + 1))
        try: k = next(j for j, (y, h, t) in enumerate(L) if AXHEAD_BB.search(t))
        except StopIteration: continue
        rest = [(h, norm(t)) for y, h, t in L[k + 1:] if t.strip()]
        rest = [(h, t) for h, t in rest if t and not re.fullmatch(r'\d{1,3}', t)]
        cut = next((j for j, (h, t) in enumerate(rest) if t.startswith(STOP)), len(rest))
        rest = rest[:cut]
        if not rest: continue
        top = max(h for h, _ in rest)
        title = ' '.join(t for h, t in rest if h >= top - 1.5)
        sub = [t for h, t in rest if h < top - 1.5]
        t2, s2 = title.strip(), ' '.join(sub).strip()
        for a, b in PHRASES:            # الوصل يقع بعد norm فتُعاد هنا
            t2, s2 = t2.replace(a, b), s2.replace(a, b)
        out[i] = (t2, s2)
    return out

NOISE  = re.compile(r'^(?:\d{1,3}|\d+\s*من\s*\d+|جمعية تحفيظ بريدة.*|دليل المسار التدريبي|'
                    r'مهارة ← التطبيق.*|امسح للفتح|افتح الدورة|افتح|استمع للحلقة)$')

def clean(lines):
    """يحذف أرقام الصفحات والترويسات والأزرار، فما بقي نصُّ المحور وحده."""
    return [x for x in lines if x and not NOISE.match(x)]

def axes_of(path):
    T = pages_text(path); U = pages_urls(path); out = []
    H = heads_of(path, [i for i, p in enumerate(T) if AXHEAD.search(p)])
    for i, p in enumerate(T):
        m = AXHEAD.search(p)
        if not m: continue
        raw = [x.strip() for x in p.split('\n') if x.strip()]
        try: hi = next(j for j, x in enumerate(raw) if AXHEAD.search(x))
        except StopIteration: continue
        # العنوان والفرعي من هندسة الصفحة، والنصّ المسطّح بديلٌ عند تعذّرها
        after = clean(raw[hi + 1:])
        n = int(m.group(1))
        ht, hs = H.get(i, ('', ''))
        a = {'n': n, 't': ht or (after[0] if after else ''),
             's': hs or (after[1] if len(after) > 1 else '')}
        L = clean(raw)

        def follow(label, lines, off=1):
            for j, x in enumerate(lines):
                if x.startswith(label):
                    return lines[j + off] if j + off < len(lines) else ''
            return ''

        a['q'] = follow('وقفة مع واقع عملك', L)
        try: ci = next(j for j, x in enumerate(L) if x.startswith('وقفة مع واقع عملك')) + 2
        except StopIteration: ci = 3
        a['c'] = {'name': L[ci] if ci < len(L) else '', 'pf': L[ci + 1] if ci + 1 < len(L) else ''}
        dur = next((x for x in L[ci:ci + 6] if x.startswith('المدة')), '')
        a['c']['dur'] = re.sub(r'^المدة:?\s*', '', dur).strip()
        a['c']['tip'] = next((x.split(':', 1)[1].strip() for x in L if x.startswith('أثناء التعلم:')), '')
        a['c']['free'] = any('مجانية' in x for x in L[ci:ci + 8])

        # الحلقة الصوتية: العنوان قد يلتف على سطرين، وكان الثاني يُفقد
        try: pi = next(j for j, x in enumerate(L) if x.startswith('حلقة صوتية'))
        except StopIteration: pi = None
        if pi is not None:
            title = L[pi + 1] if pi + 1 < len(L) else ''
            j = pi + 2
            while j < len(L) and not L[j].startswith(('المدة', 'حلقة صوتية', 'أثناء التعلم')):
                title += ' ' + L[j]; j += 1
            a['p'] = {'src': L[pi].split('·')[-1].strip(), 't': title.strip()}
            d2 = L[j] if j < len(L) else ''
            a['p']['dur'] = (re.search(r'المدة:?\s*([^—-]*)', d2) or [None, ''])[1].strip()
            a['p']['why'] = d2.split('—')[-1].strip() if '—' in d2 else ''
        else:
            a['p'] = {}

        urls = U[i] if i < len(U) else []
        a['c']['url'] = next((u for u in urls if not yt_id(u)), '')
        if a['c']['url']: a['c']['pf'] = host_of(a['c']['url']) or a['c']['pf']
        yt = next((u for u in urls if yt_id(u)), '')
        if yt and a['p'] is not None: a['p']['yt'] = yt_id(yt)
        sup = [u for u in urls if u != a['c']['url'] and u != yt]
        if sup:
            nm = next((x.split(':', 1)[1].strip() for x in L if x.startswith('داعم:')), '')
            a['c']['extra'] = {'url': sup[0], 'pf': host_of(sup[0]),
                               'name': (nm.split('—')[0].strip() or 'دورة داعمة')}

        if i + 1 < len(T) and 'تطبيق قصير' in T[i + 1]:
            M0 = [x.strip() for x in T[i + 1].split('\n') if x.strip()]
            M = clean(M0)
            try: ti = next(j for j, x in enumerate(M) if 'تطبيق قصير' in x)
            except StopIteration: ti = 0
            k2 = {'t': M[ti + 1] if ti + 1 < len(M) else ''}
            k2['intro'] = follow('ابدأ بهذه المادة', M)
            k2['steps'] = [M0[j + 1] for j, x in enumerate(M0)
                           if re.fullmatch(r'[1-9]', x) and j + 1 < len(M0)]
            k2['ex'] = follow('مثال تدريبي للتوضيح', M)
            k2['f'] = ['ما اخترته', 'ما أنجزته', 'ما سأغيره']
            tm = next((x for x in M if 'الوقت المقترح' in x), '')
            k2['mins'] = (re.search(r'(\d+)', tm) or [None, ''])[1]
            a['k'] = k2
        else:
            a['k'] = {}
        out.append(a)
    out.sort(key=lambda x: x['n'])
    return out

# المسارات الستة: المعرّف والعنوان والجمهور، ورقم الدليل في اسم ملفه
TRACKS = [
    ('edu_mgr',    'مدير إدارة الشؤون التعليمية',          'مدير إدارة الشؤون التعليمية'),
    ('edu_head',   'رؤساء الأقسام — الشؤون التعليمية',     'رؤساء الأقسام ومدراء الوحدات – الشؤون التعليمية'),
    ('edu_staff',  'موظفو الشؤون التعليمية',               'موظفو إدارة الشؤون التعليمية من أخصائيين ومنفذين'),
    ('comm_mgr',   'مدير إدارة الاتصال المؤسسي',           'مدير إدارة الاتصال المؤسسي'),
    ('comm_head',  'رؤساء الأقسام — الاتصال المؤسسي',      'رؤساء الأقسام ومدراء الوحدات – الاتصال المؤسسي والإعلام والشراكات'),
    ('comm_staff', 'موظفو الاتصال المؤسسي',                'موظفو إدارة الاتصال المؤسسي'),
]

def pick(files, *needles):
    """يختار الدليل بأول صفحته لا باسم ملفه؛ أسماء الملفات تَصل ممسوخة."""
    for f in files:
        head = norm(subprocess.run(['pdftotext', '-enc', 'UTF-8', '-f', '1', '-l', '1', f, '-'],
                                   capture_output=True, text=True).stdout)
        flat = ' '.join(head.split())
        if all(x in flat for x in needles): return f
    return None

MATCH = {
    'edu_mgr':    ('مدير إدارة الشؤون',),
    'edu_head':   ('رؤساء الأقسام', 'الشؤون التعليمية'),
    'edu_staff':  ('موظفو الشؤون التعليمية',),
    'comm_mgr':   ('مدير إدارة الاتصال',),
    'comm_head':  ('رؤساء الأقسام', 'الاتصال المؤسسي'),
    'comm_staff': ('موظفو الاتصال المؤسسي',),
}

def main(src, dst):
    files = sorted(os.path.join(src, f) for f in os.listdir(src) if f.lower().endswith('.pdf'))
    os.makedirs(dst, exist_ok=True)
    for tid, title, audience in TRACKS:
        f = pick(files, *MATCH[tid])
        if not f:
            print(f'  ✗ {tid}: لم أجد دليله'); continue
        ax = axes_of(f)
        d = {'id': tid, 'title': title, 'cat': 'lead', 'audience': audience,
             'intro': '', 'roles': [], 'start': '', 'axes': ax}
        prev = os.path.join(dst, tid + '.json')
        if os.path.exists(prev):          # نحفظ ما كتبه بشر: المقدّمة والصفات
            old = json.load(open(prev, encoding='utf-8'))
            for key in ('intro', 'roles', 'start', 'extra', 'off', 'cat'):
                if old.get(key): d[key] = old[key]
            # النثر المُستبقى كُتب باستخراجٍ أقدم، فيمرّ على المصحّح نفسه
            if isinstance(d.get('intro'), str): d['intro'] = norm(d['intro'])
            st = d.get('start')
            if isinstance(st, dict):
                if isinstance(st.get('q'), str): st['q'] = norm(st['q'])
                if isinstance(st.get('f'), list):
                    st['f'] = [norm(x) if isinstance(x, str) else x for x in st['f']]
        json.dump(d, open(prev, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        nos = [a['n'] for a in ax if not a['s']]
        print(f'  ✓ {tid:11} {len(ax):2} محورًا' + (f' — بلا عنوان فرعي: {nos}' if nos else ''))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'tracks')
