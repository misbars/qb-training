/* ================= كلمات المرور وتأكيد الإيقاف ================= */
function miniModal(title,body,actions){
  $('#layer').innerHTML=`<div class="mask" role="dialog" aria-modal="true"><div class="modal"><div class="m-h"><div class="pattern"></div><h3>${esc(title)}</h3><button class="m-x" data-act="mm-close" aria-label="إغلاق">${ico('x')}</button></div><div class="m-b">${body}</div><div class="m-f">${actions||'<button class="btn sec" data-act="mm-close">إغلاق</button>'}</div></div></div>`;
}
function pwChangeForm(forced){
  return `${forced?'<div class="note warn" style="margin-bottom:14px">هذه كلمة مرور مؤقتة. اختر كلمة مرور خاصة بك قبل المتابعة.</div>':''}
  <div class="field"><label for="pw_cur">كلمة المرور الحالية</label><input class="inp" id="pw_cur" type="password" dir="ltr" autocomplete="current-password"></div>
  <div class="field"><label for="pw_new">كلمة المرور الجديدة</label><input class="inp" id="pw_new" type="password" dir="ltr" autocomplete="new-password"><span class="ins">8 أحرف على الأقل، وتضم حروفًا وأرقامًا.</span></div>
  <div class="field"><label for="pw_new2">تأكيد كلمة المرور الجديدة</label><input class="inp" id="pw_new2" type="password" dir="ltr" autocomplete="new-password"></div>
  <p class="small" id="pw_err" role="alert" style="color:var(--bad)"></p>`;
}
function askPwChange(forced){
  miniModal(forced?'اختر كلمة مرور جديدة':'تغيير كلمة المرور',pwChangeForm(forced),`${forced?'':'<button class="btn sec" data-act="mm-close">إلغاء</button>'}<button class="btn" data-act="pw-change">حفظ كلمة المرور</button>`);
  if(forced){const x=$('#layer .m-x');if(x)x.remove()}
}
/* ===== تسليم كلمة المرور المؤقتة =====
   الكلمة تُعرض مرة واحدة ثم تُسلَّم. فيكون التسليم بزرٍّ لا بنسخٍ باليد:
   كل حقلٍ يُنسخ وحده فلا يلتصق به ما جاوره، ورسالةٌ جاهزة بنصّها، وزرٌّ
   يفتح واتساب على رقم صاحبها مكتوبةً فيه. */
const waNum=p=>{let d=String(p||'').replace(/\D/g,'');
  if(!d)return '';
  if(d.startsWith('00'))d=d.slice(2);
  if(d.startsWith('966'))return d;
  if(d.startsWith('0'))return '966'+d.slice(1);
  if(d.length===9&&d[0]==='5')return '966'+d;
  return d};
/* النداء بالاسم الأول واسم العائلة: «أحمد الحميد» لا «أحمد علي» —
   فالثاني اسمُ الرجل واسمُ أبيه، ولا يُنادى به أحد. */
const shortName=n=>{const w=String(n||'').trim().split(/\s+/).filter(Boolean);
  return w.length>2?w[0]+' '+w[w.length-1]:w.join(' ')};
const pwMsg=(name,email,pw)=>`السلام عليكم ${shortName(name)}، حسابك في منصة دال جاهز.

الرابط: ${location.origin}
اسم الدخول: ${email}
كلمة المرور المؤقتة: ${pw}

تُغيَّر عند أول دخول.`;
let PW_N=0;
function pwBlock(r,phone){
  const i=++PW_N, msg=pwMsg(r.name,r.email,r.password), w=waNum(phone);
  return `<div class="field"><label for="pw_e${i}">اسم الدخول</label>
    <div style="display:flex;gap:8px"><input class="inp" id="pw_e${i}" dir="ltr" readonly value="${esc(r.email)}" onclick="this.select()">
    <button class="btn sec sm" data-act="copy-val" data-t="pw_e${i}" style="white-space:nowrap">نسخ</button></div></div>
  <div class="field"><label for="pw_tmp">كلمة المرور المؤقتة</label>
    <div style="display:flex;gap:8px"><input class="inp num" id="pw_tmp" dir="ltr" readonly value="${esc(r.password)}" onclick="this.select()" style="font-size:18px;letter-spacing:.05em">
    <button class="btn sec sm" data-act="copy-val" data-t="pw_tmp" style="white-space:nowrap">نسخ</button></div></div>
  <textarea id="pw_m${i}" readonly style="position:absolute;left:-9999px">${esc(msg)}</textarea>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
    <button class="btn sec" data-act="copy-msg" data-t="pw_m${i}">نسخ الرسالة كاملة</button>
    ${w?`<a class="btn" href="https://wa.me/${w}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">إرسال عبر واتساب</a>`
       :`<span class="small muted" style="align-self:center">لا جوّال في ملفه — أضفه ليظهر زرّ واتساب</span>`}
  </div>`;
}

Object.assign(ACT,{
  'mm-close'(){if(S.mustChange)return;closeLayer()},
  'pw-reset'(t){
    const u=U(t.dataset.id);if(!u)return;
    miniModal('إصدار كلمة مرور مؤقتة',`<p>ستُصدر كلمة مرور مؤقتة لـ <b>${esc(u.name)}</b> (<span class="num">${esc(u.email)}</span>). تُلغى كلمة مروره الحالية وتُغلق جلساته المفتوحة، وسيُطلب منه اختيار كلمة مرور جديدة عند أول دخول.</p>`,`<button class="btn sec" data-act="mm-close">إلغاء</button><button class="btn" data-act="pw-reset-go" data-id="${u.id}">إصدار كلمة المرور</button>`);
  },
  async 'pw-reset-go'(t){
    try{
      const r=await api('/api/password/reset',{method:'POST',body:JSON.stringify({userId:t.dataset.id})});
      audit('password.reset','user',r.name);
      const u=U(t.dataset.id)||{};
      miniModal('كلمة المرور المؤقتة',
        `<p>سلّمها لـ <b>${esc(r.name)}</b> بنفسك أو برسالة خاصة. لن تظهر مرة أخرى.</p>${pwBlock(r,u.phone)}`,
        `<button class="btn" data-act="mm-close">تم</button>`);
    }catch(e){toast('تعذّر إصدار كلمة المرور',e.message)}
  },
  'pw-copy'(){const i=$('#pw_tmp');if(!i)return;navigator.clipboard.writeText(i.value).then(()=>toast('نُسخت كلمة المرور')).catch(()=>{i.select();toast('حدّد النص وانسخه')})},
  /* النسخ لحقلٍ بعينه: الضغط على الزرّ ينسخ قيمته وحدها، فلا يلتصق بها
     ما جاورها من نصّ الشاشة */
  'copy-val'(t){
    const i=$('#'+t.dataset.t);if(!i)return;
    const done=()=>{const o=t.textContent;t.textContent='نُسخ ✓';setTimeout(()=>t.textContent=o,1600)};
    navigator.clipboard.writeText(i.value).then(done).catch(()=>{i.select();toast('حدّد النص وانسخه')});
  },
  'copy-msg'(t){
    const i=$('#'+t.dataset.t);if(!i)return;
    const done=()=>{const o=t.textContent;t.textContent='نُسخت الرسالة ✓';setTimeout(()=>t.textContent=o,1800)};
    navigator.clipboard.writeText(i.value).then(done).catch(()=>{i.select();toast('حدّد النص وانسخه')});
  },
  'pw-ask'(){askPwChange(false)},
  async 'pw-change'(){
    const cur=$('#pw_cur').value,n=$('#pw_new').value,n2=$('#pw_new2').value,err=$('#pw_err');
    if(n!==n2){err.textContent='كلمتا المرور الجديدتان غير متطابقتين';return}
    try{await api('/api/password/change',{method:'POST',body:JSON.stringify({current:cur,next:n})});S.mustChange=false;closeLayer();toast('تم تغيير كلمة المرور','سُجّل خروجك من الأجهزة الأخرى')}
    catch(e){err.textContent=e.message}
  },
  'user-toggle'(t){
    const u=U(t.dataset.id);if(!u)return;const off=u.active!==false;
    if(u.id===S.me){toast('لا يمكنك إيقاف حسابك بنفسك');return}
    miniModal(off?'إيقاف حساب':'تفعيل حساب',`<p>${off?`سيُمنع <b>${esc(u.name)}</b> من الدخول فورًا، وتبقى سجلاته التدريبية محفوظة.`:`سيتمكن <b>${esc(u.name)}</b> من الدخول مجددًا.`}</p>`,`<button class="btn sec" data-act="mm-close">إلغاء</button><button class="btn" data-act="user-toggle-go" data-id="${u.id}" style="${off?'background:var(--bad)':''}">${off?'إيقاف الحساب':'تفعيل الحساب'}</button>`);
  },
  'user-toggle-go'(t){closeLayer();toggleUser(t.dataset.id)},
});
{const _vp=VIEWS.profile;VIEWS.profile=()=>_vp()+`<div class="card pad" style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h3>كلمة المرور</h3><p class="muted small">غيّرها دوريًا، ولا تشاركها مع أحد.</p></div><button class="btn sec" data-act="pw-ask">تغيير كلمة المرور</button></div>`}

/* تنبيه عند مغادرة صفحة المشاهدة (مثل فتح الفيديو في يوتيوب) */
{let leftAt=0;document.addEventListener('visibilitychange',()=>{
  const onYt=S.view==='player'&&document.querySelector('#view iframe[src*="youtube"]');
  if(document.hidden){if(onYt)leftAt=Date.now();return}
  if(leftAt&&onYt&&Date.now()-leftAt>3000)toast('المشاهدة تُحتسب داخل المنصة فقط','ما شوهد خارج هذه الصفحة لا يُضاف لتقدّمك. أكمل الفيديو هنا.');
  leftAt=0;
});}
