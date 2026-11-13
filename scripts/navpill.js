/* ================= مؤشّر منزلق للقوائم والتبويبات ================= */
// بدل ما يقفز التظليل من عنصر لعنصر، ينزلق بينها.
// العنصر المنزلق يُعاد بناؤه مع كل رسم، فنحفظ موضعه السابق ونبدأ منه ثم ننتقل للجديد.
(function () {
  // box: المؤشّر يغطي الزر كامل · line: خط رفيع تحت الزر
  const TARGETS = [
    ['.nav', 'box'],        // القائمة الجانبية
    ['.emp-tabs', 'line'],  // شريط تبويبات الجوال
    ['.emp-sub', 'box'],    // تبويبات داخل أقسام الموظف
    ['.tabs', 'line'],     // تبويبات داخل صفحات الإدارة
    ['.lg-seg', 'box']      // مفتاح البوابة في شاشة الدخول
  ];
  const LINE = 3;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prev = new Map();

  function slide(box, mode, key) {
    if (!box || !box.offsetWidth) { prev.delete(key); return }
    const on = box.querySelector(':scope > button.on');
    let pill = box.querySelector(':scope > .ui-pill');
    if (!on) { if (pill) pill.remove(); prev.delete(key); return }
    if (!pill) { pill = document.createElement('span'); pill.className = 'ui-pill'; box.prepend(pill) }
    const br = box.getBoundingClientRect(), ar = on.getBoundingClientRect();
    const to = {
      x: ar.left - br.left + box.scrollLeft,
      y: ar.top - br.top + box.scrollTop + (mode === 'line' ? ar.height - LINE : 0),
      w: ar.width,
      h: ar.height
    };
    const put = p => {
      pill.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      pill.style.width = p.w + 'px';
      if (mode === 'box') pill.style.height = p.h + 'px';
    };
    const from = prev.get(key);
    put(from && !reduce() ? from : to);
    pill.style.transition = 'none';
    pill.getBoundingClientRect();
    pill.style.transition = '';
    put(to);
    prev.set(key, to);
  }

  function place() {
    for (const [sel, mode] of TARGETS)
      document.querySelectorAll(sel).forEach((box, i) => slide(box, mode, sel + '#' + i));
    if (document.documentElement.classList.contains('side-off'))
      document.querySelectorAll('.nav button').forEach(b => {
        const s = b.querySelector('span');
        if (s && !b.title) b.title = s.textContent.trim();
      });
  }

  // ظهور المحتوى: ينزل بهدوء عند تغيّر الصفحة فقط، لا مع كل حفظ أو مزامنة
  let sig = null;
  function fadeView() {
    const view = document.getElementById('view');
    if (!view) { sig = null; return }
    let now;
    try { now = [S.role, S.view, S.trackAxis || '', S.trTab || '', JSON.stringify(S.tab || {})].join('|') }
    catch (e) { return }
    if (now === sig) return;
    const first = sig === null;
    sig = now;
    if (first) return;
    openView(view);
  }

  // فتح الصفحة: البطاقات تظهر واحدة ورا الثانية، والأشرطة والحلقات والأرقام تبدأ من الصفر
  function openView(view) {
    if (reduce()) return;
    let nodes = [...view.querySelectorAll('.card')];
    if (nodes.length < 2) nodes = [...view.children];
    nodes = nodes.filter(n => n.offsetWidth).slice(0, 14);
    nodes.forEach((n, i) => { n.style.setProperty('--d', i * 45 + 'ms'); n.classList.add('in-up') });

    view.querySelectorAll('.pbar > i').forEach(el => {
      const w = el.style.width; if (!w || w === '0%') return;
      el.style.transition = 'none'; el.style.width = '0%';
      el.getBoundingClientRect();
      el.style.transition = 'width .9s cubic-bezier(.22,.8,.3,1) .15s';
      el.style.width = w;
    });

    view.querySelectorAll('.ring').forEach(el => {
      const p = getComputedStyle(el).getPropertyValue('--p').trim();
      if (!p || p === '0') return;
      const had = el.style.getPropertyValue('--p');
      el.style.setProperty('--p', '0'); el.getBoundingClientRect();
      requestAnimationFrame(() => { had ? el.style.setProperty('--p', had) : el.style.removeProperty('--p') });
    });

    view.querySelectorAll('.kpi .v, .ring b').forEach(countUp);
  }

  // عدّ تصاعدي لأول رقم داخل العنصر، مع الحفاظ على بقية النص وعلى العناصر الداخلية
  function countUp(el) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!node) return;
    const txt = node.nodeValue, m = txt.match(/\d[\d,]*(\.\d+)?/);
    if (!m) return;
    const target = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(target) || target <= 0 || target >= 1e9) return;
    const dec = (m[0].split('.')[1] || '').length, grp = m[0].includes(',');
    const pre = txt.slice(0, m.index), post = txt.slice(m.index + m[0].length);
    const fmtN = v => (grp ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
                           : v.toFixed(dec));
    const t0 = performance.now(), dur = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.nodeValue = pre + fmtN(target * e) + post;
      if (k < 1) requestAnimationFrame(step);
    };
    node.nodeValue = pre + fmtN(0) + post;
    requestAnimationFrame(step);
  }

  // الرسم يستبدل الصفحة كاملة، والنوافذ المنبثقة ترسم نفسها، فنراقب التغيّر بدل ربطه بدالة واحدة
  let busy = false, queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false; busy = true;
      try { place(); fadeView() } finally { requestAnimationFrame(() => { busy = false }) }
    });
  }
  new MutationObserver(() => { if (!busy) schedule() })
    .observe(document.body, { childList: true, subtree: true });
  // طيّ القائمة الجانبية: الصنف على <html> فيبقى بعد إعادة رسم الصفحة
  const SIDE_KEY = 'qb.sideOff';
  try { if (localStorage.getItem(SIDE_KEY) === '1') document.documentElement.classList.add('side-off') } catch (e) { }
  ACT.sidetoggle = function () {
    const off = document.documentElement.classList.toggle('side-off');
    try { localStorage.setItem(SIDE_KEY, off ? '1' : '0') } catch (e) { }
    setTimeout(() => { prev.clear(); schedule() }, 320);
  };

  addEventListener('resize', () => { prev.clear(); schedule() });
  schedule();
})();

/* ================= رمز التحقق على الشهادة ================= */
// الرمز يفتح صفحة تحقّق عامة؛ الرابط يُطلب من الخادم لأنه يحمل توقيعًا لا يمكن توقّعه.
async function certQr(id) {
  const box = document.getElementById('certqr'), cap = document.getElementById('certqrcap');
  if (!box) return;
  try {
    const r = await fetch('/api/cert/link?id=' + encodeURIComponent(id));
    const d = await r.json();
    if (!d || !d.url) return;
    await loadScript(CDN.qr);
    if (!document.getElementById('certqr')) return;
    box.innerHTML = '';
    new QRCode(box, { text: d.url, width: 54, height: 54, colorDark: '#072C49', colorLight: '#FBFAF7', correctLevel: QRCode.CorrectLevel.M });
    box.title = d.url;
    if (cap) cap.style.display = '';
  } catch (e) { /* الشهادة تبقى صالحة بدون الرمز */ }
}
