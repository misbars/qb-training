/* ================= مؤشّر منزلق للقوائم والتبويبات ================= */
// بدل ما يقفز التظليل من عنصر لعنصر، ينزلق بينها.
// العنصر المنزلق يُعاد بناؤه مع كل رسم، فنحفظ موضعه السابق ونبدأ منه ثم ننتقل للجديد.
(function () {
  // box: المؤشّر يغطي الزر كامل · line: خط رفيع تحت الزر
  const TARGETS = [
    ['.nav', 'box'],        // القائمة الجانبية
    ['.emp-tabs', 'line'],  // شريط تبويبات الجوال
    ['.emp-sub', 'box'],    // تبويبات داخل أقسام الموظف
    ['.tabs', 'line']       // تبويبات داخل صفحات الإدارة
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
    view.classList.remove('view-in');
    view.offsetWidth;
    view.classList.add('view-in');
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
