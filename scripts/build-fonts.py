# يحزم ملفات خط ثمانية الأصلية (دون أي تعديل) داخل حزمة سكربت للمنصة، بدل إتاحتها ملفات مستقلة للتنزيل.
# الاستخدام: python3 scripts/build-fonts.py <مجلد الخطوط الأصلية> public/app-fonts.js
# ملفات الخطوط الأصلية لا تُرفع إلى المستودع.
import base64, sys, os, json
src, out = sys.argv[1], sys.argv[2]
FACES = [  # (اسم العائلة, الوزن, اسم الملف الأصلي)
 ("Thmanyah Sans", 400, "thmanyahsans-Regular.otf"),
 ("Thmanyah Sans", 500, "thmanyahsans-Medium.otf"),
 ("Thmanyah Sans", 700, "thmanyahsans-Bold.otf"),
 ("Thmanyah Serif Display", 700, "thmanyahserifdisplay-Bold.otf"),
]
def find(name):
    for f in os.listdir(src):
        if f.endswith(name): return os.path.join(src, f)
    raise SystemExit("missing " + name)
css = []
for fam, w, name in FACES:
    b = base64.b64encode(open(find(name), 'rb').read()).decode()
    css.append("@font-face{font-family:'%s';font-weight:%d;font-style:normal;font-display:swap;src:url(data:font/otf;base64,%s) format('opentype')}" % (fam, w, b))
js = ("/* خط ثمانية © ثمانية للنشر والتوزيع — مستخدم وفق ترخيص خط ثمانية ضمن هذه المنصة فقط. لا يجوز استخراجه أو إعادة توزيعه. */\n"
      "(function(){var s=document.createElement('style');s.textContent=%s;document.head.appendChild(s);})();\n") % json.dumps("".join(css))
open(out, 'w').write(js)
print(out, round(len(js)/1024), 'KB')
