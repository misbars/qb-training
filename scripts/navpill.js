/* ================= مؤشّر منزلق للقائمة الجانبية وشريط تبويبات الجوال ================= */
// بدل ما يقفز التظليل من قسم لقسم، ينزلق بينها. العنصر المنزلق يُعاد بناؤه مع كل رسم،
// فنحفظ موضعه السابق ونبدأ منه ثم ننتقل للموضع الجديد حتى تظهر الحركة.
(function () {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let prevNav = null, prevTabs = null;

  function slide(box, vertical, prev) {
    if (!box || !box.offsetWidth) return null;
    const on = box.querySelector('button.on');
    let pill = box.querySelector(':scope > .ui-pill');
    if (!on) { if (pill) pill.remove(); return null }
    if (!pill) { pill = document.createElement('span'); pill.className = 'ui-pill'; box.prepend(pill) }
    const br = box.getBoundingClientRect(), ar = on.getBoundingClientRect();
    const to = vertical
      ? { a: ar.top - br.top + box.scrollTop, b: ar.height }
      : { a: ar.left - br.left + box.scrollLeft, b: ar.width };
    const put = p => {
      pill.style.transform = vertical ? 'translateY(' + p.a + 'px)' : 'translateX(' + p.a + 'px)';
      pill.style[vertical ? 'height' : 'width'] = p.b + 'px';
    };
    put(prev && !reduce() ? prev : to);
    pill.style.transition = 'none';
    pill.getBoundingClientRect();
    pill.style.transition = '';
    put(to);
    return to;
  }

  function place() {
    prevNav = slide(document.querySelector('.nav'), true, prevNav);
    prevTabs = slide(document.querySelector('.emp-tabs'), false, prevTabs);
  }

  const _drawPill = draw;
  draw = function () { const r = _drawPill.apply(this, arguments); requestAnimationFrame(place); return r };
  addEventListener('resize', () => { prevNav = prevTabs = null; place() });
})();
