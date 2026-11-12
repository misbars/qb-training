/* ================= المسارات التدريبية: مسار القيادات ================= */
// المحتوى من «دليل المسار التدريبي للقيادات ١٤٤٨هـ». كل محور: دورة مجانية خارجية (معرفة) + حلقة صوتية (اتجاه) + بطاقة تطبيق (مهارة).
// الساعات: مدة الدورة مقرّبة لأقرب نصف ساعة للأسفل، وتُحتسب بعد اعتماد مدير التدريب لشهادة الإتمام.
const TRACK = {
  id: 'leaders', title: 'مسار القيادات', cat: 'lead',
  audience: 'المدير العام ومساعده، ومديرو الإدارات، ورؤساء الأقسام والوحدات، وعميدة المعهد ووكيلاتها',
  intro: 'عشرة محاور في القيادة والاستراتيجية والأداء والحوكمة والموارد البشرية والمال والقرار والشراكات والجودة والبيانات. لكل محور دورة مجانية، وحلقة صوتية، وتطبيق عملي قصير يُنجز في جلسة واحدة على عمل قائم في إدارتكم.',
  start: { q: 'حين تتأملون واقع إدارتكم اليوم، أين يظهر أثر قيادتكم بوضوح؟ وما التغيير الذي لو حققتموه لكان أنفع لفرقكم وللمستفيدين؟', f: ['ممارسة أعتز بها', 'جانب أريد تطويره', 'علامة سأعرف بها أني تقدمت'] },
  axes: [
    { n: 1, t: 'قيادة الفريق', s: 'وتوزيع الصلاحيات وتفويض المهام', q: 'هل يعرف كل من يرتبط بكم ما المطلوب منه، وما يقرره بنفسه، ومتى يرجع إليكم؟',
      c: { name: 'مهارات القيادة', pf: 'منصة دروب', url: 'https://lms.doroob.sa/courses/Doroob/DRB-EL-W02-027-LSPM-00-AR-2nd-03/2017/about', dur: 'ساعتان', h: 2, note: 'التسجيل للسعوديين، والدخول عبر نفاذ.', tip: 'ركّزوا على أساليب القيادة وبناء الفرق والتواصل لتوجيه الأعضاء، وسجّلوا ما يناسب مستوى مسؤوليتكم الحالية.' },
      p: { src: 'إذاعة بوصلة', t: 'كيف تكون إداري ناجح؟', dur: 'ساعة و58 دقيقة', why: 'لتتبنّوا القناعة بأن الإدارة صنعة تُتعلَّم وتُمارس.', yt: 'jdTscR0DDlY' },
      k: { t: 'مصفوفة تفويض لقرار متكرر', intro: 'اختاروا قرارًا أو مهمة تتكرر في عملكم، ووزّعوا أدوارها بين من يرتبط بكم، مع تحديد ما يُفوَّض وما يبقى لاعتمادكم.',
        steps: ['اكتبوا القرار أو المهمة المتكررة، ومن يشارك فيها اليوم.', 'حددوا ما يُفوَّض كاملًا، وما يُنفَّذ ثم يُعرض عليكم، وما يبقى لكم.', 'اكتبوا جملة التكليف: المطلوب والموعد ومتى يرجع إليكم صاحب المهمة.'],
        ex: 'المهمة: اعتماد طلبات الإجازات الاعتيادية. تُفوَّض إلى رئيس القسم كاملة ضمن الأنظمة، ويُرفع إليكم ما يتجاوز الحد المعتمد. صيغة التكليف: «أرجو اعتماد الطلبات الاعتيادية خلال يوم عمل، وإبلاغي بما يخرج عن الحد المعتمد».',
        f: ['النتيجة المطلوبة والموعد', 'ما أفوّضه ولمن', 'ما يبقى لاعتمادي', 'جملة التكليف'] } },
    { n: 2, t: 'التخطيط الاستراتيجي', s: 'وربط أولويات الإدارة بأهداف الجمعية', q: 'ما أولويات إدارتكم هذه السنة، وهل يعرف فريقكم أي هدف استراتيجي يخدمه كل نشاط؟',
      c: { name: 'التخطيط الاستراتيجي', pf: 'منصة سديم', url: 'https://sdeem.org/courses/10', dur: 'ساعة و52 دقيقة', h: 1.5, tip: 'انتبهوا إلى مراحل بناء الخطة وطريقة تحويل الرؤية إلى أهداف ومبادرات، وقارنوها بخطة إدارتكم الحالية.' },
      p: { src: 'إذاعة مختلف', t: 'كيف تكتب استراتيجية ناجحة', dur: 'ساعة و22 دقيقة', why: 'لتروا كيف تُصاغ الاستراتيجية وتُترجم إلى عمل.', yt: 'gmJGA3DJLkM' },
      k: { t: 'خريطة ربط الأولويات بالأهداف', intro: 'اختاروا ثلاث أولويات لإدارتكم أو معهدكم وصلوا كل واحدة بهدف استراتيجي ومبادرة قائمة.',
        steps: ['اكتبوا أولويات إدارتكم الثلاث لهذا العام.', 'اربطوا كل أولوية بهدف من أهداف الجمعية أو بهدف الإدارة المعتمد.', 'حددوا المبادرة القائمة التي تخدم الأولوية، أو اكتبوا الفجوة إن لم توجد.'],
        ex: 'الأولوية: رفع انتظام الطلاب في الحلقات. الهدف المرتبط: جودة المخرجات التعليمية. المبادرة: برنامج متابعة الغياب الأسبوعي. الفجوة: لا يوجد مؤشر شهري يقيس الانتظام.',
        f: ['الأولوية الأولى والهدف', 'الأولوية الثانية والهدف', 'الأولوية الثالثة والهدف', 'فجوة أحتاج إلى سدّها'] } },
    { n: 3, t: 'إدارة الأداء والتخطيط', s: 'ومؤشرات القياس التي تقود القرار', q: 'ما المؤشر الذي تنظرون إليه كل شهر ليقول لكم إن إدارتكم تسير في الاتجاه الصحيح؟',
      c: { name: 'إدارة الأداء والتخطيط', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2494', dur: '4 ساعات و56 دقيقة', h: 4.5, tip: 'ركّزوا على الفرق بين مؤشر المخرجات ومؤشر النتائج، وعلى دورة المتابعة والمراجعة الدورية.' },
      p: { src: 'إذاعة ثمانية', t: 'مع مدير المركز الوطني لقياس أداء الأجهزة العامة «أداء»', dur: 'ساعة و22 دقيقة', why: 'لتروا قياس الأداء من تجربة جهة وطنية.', yt: 'orqMFrHPmFM' },
      k: { t: 'لوحة ثلاثة مؤشرات', intro: 'اختاروا ثلاثة مؤشرات تعكس عمل إدارتكم، وحددوا لكل مؤشر مصدر بياناته ومن يتابعه وكم مرة يُراجع.',
        steps: ['اختاروا ثلاثة مؤشرات: واحد للجودة وواحد للإنجاز وواحد للمستفيد.', 'اكتبوا لكل مؤشر: المصدر، والمسؤول، ووتيرة المراجعة.', 'حددوا قيمة مستهدفة معقولة لكل مؤشر خلال الربع القادم.'],
        ex: 'المؤشر: نسبة الطلاب المنتظمين شهريًا. المصدر: سجل الحضور. المسؤول: رئيس قسم الشؤون التعليمية. المراجعة: شهريًا. المستهدف: ارتفاع نقطتين مئويتين.',
        f: ['المؤشر الأول ومصدره', 'المؤشر الثاني ومصدره', 'المؤشر الثالث ومصدره', 'المستهدف ووتيرة المراجعة'] } },
    { n: 4, t: 'الحوكمة والمساءلة', s: 'وضبط الصلاحيات والالتزام بالأنظمة', q: 'لو سُئلتم الآن من يملك قرار كل أمر مهم في إدارتكم، هل تتطابق الإجابة مع الصلاحيات المعتمدة؟',
      c: { name: 'الحوكمة في القطاع غير الربحي', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2495', dur: '55 دقيقة', h: 0.5, tip: 'دوّنوا مبادئ الحوكمة والفرق بين دور المجلس ودور الإدارة التنفيذية، وما يخص موقعكم منها.' },
      p: { src: 'ذا ستيج', t: 'الحوكمة بين المفهوم والواقع', dur: '51 دقيقة', why: 'لتفهموا الفجوة بين النص والتطبيق في الحوكمة.', yt: 'h5dAUWCOVho' },
      k: { t: 'فحص سريع للصلاحيات', intro: 'اختاروا ثلاثة قرارات متكررة وطابقوا بين من يتخذها فعليًا ومن تنص عليه اللوائح المعتمدة.',
        steps: ['اكتبوا ثلاثة قرارات متكررة في إدارتكم.', 'اكتبوا من يتخذ كل قرار فعليًا، ومن تنص عليه اللائحة.', 'حددوا أي اختلاف، وكيف تعالجونه: توضيح، أو تعديل، أو رفع للجهة المختصة.'],
        ex: 'القرار: التعاقد على خدمة صغيرة. الفعلي: رئيس الوحدة. المعتمد: صلاحية ضمن سقف محدد لمدير الإدارة. المعالجة: توضيح السقف لرؤساء الوحدات كتابيًا.',
        f: ['القرار الأول: الفعلي والمعتمد', 'القرار الثاني: الفعلي والمعتمد', 'القرار الثالث: الفعلي والمعتمد', 'معالجة الاختلاف'] } },
    { n: 5, t: 'قيادة الموارد البشرية', s: 'وتنمية الأفراد وتقدير الأداء', q: 'من في فريقكم يحتاج إلى فرصة تطوير أو تقدير هذا الشهر؟ وهل تعرفون ما يحتاجه كل واحد منهم؟',
      c: { name: 'الموارد البشرية للمدير التنفيذي', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2496', dur: '4 ساعات و34 دقيقة', h: 4.5, tip: 'انتبهوا إلى دور القيادة في الاستقطاب والتطوير وتقييم الأداء، وما هو من مهامكم وما هو من مهام إدارة الموارد البشرية.' },
      p: { src: 'ذا ستيج', t: 'الممارسات الحديثة في تقييم الأداء الوظيفي', dur: '40 دقيقة', why: 'لتروا كيف يُقيَّم الأفراد بإنصاف ويُطوَّرون.', yt: 'nKhGZJHJNe0' },
      k: { t: 'خطة تطوير لعضو واحد في فريقكم', intro: 'اختاروا عضوًا من فريقكم، واكتبوا له هدف تطوير واحدًا وإجراءً محددًا وموعدًا للمراجعة.',
        steps: ['اختاروا عضوًا في الفريق، واكتبوا نقطة قوته وما يحتاج تطويره.', 'حددوا هدفًا واحدًا واقعيًا خلال ثلاثة أشهر.', 'حددوا الإجراء: دورة، أو مهمة جديدة، أو مرافقة، وموعد المراجعة.'],
        ex: 'العضو: رئيس وحدة جديد. الهدف: تحسين متابعة التقارير. الإجراء: دورة في إعداد التقارير ومراجعة تقريره الأول معه بعد شهر.',
        f: ['العضو ونقطة قوته', 'هدف التطوير', 'الإجراء المقترح', 'موعد المراجعة'] } },
    { n: 6, t: 'الإدارة المالية للقيادات', s: 'وقراءة الأداء المالي واتخاذ القرار', q: 'هل تقرؤون تقريرًا ماليًا فتعرفون منه أين يذهب كل ريال، وماذا يعني ذلك لقراراتكم؟',
      c: { name: 'إدارة الأداء المالي للمدير التنفيذي', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2498', dur: 'ساعة و15 دقيقة', h: 1, tip: 'ركّزوا على قراءة المؤشرات المالية الأساسية وعلاقة الميزانية بالخطة التشغيلية.' },
      p: { src: 'إذاعة مختلف', t: 'مهارة فهم لغة المال', dur: 'ساعة ودقيقة', why: 'لتتبنّوا ألفة مع لغة الأرقام المالية.', yt: 'mpKCotn_d24' },
      k: { t: 'ثلاثة أسئلة على تقريركم المالي', intro: 'خذوا آخر تقرير مالي لإدارتكم أو معهدكم واكتبوا ثلاثة أسئلة تكشف ما وراء الأرقام، ومن يجيب عنها.',
        steps: ['افتحوا آخر تقرير مالي يخص إدارتكم.', 'اكتبوا ثلاثة أسئلة: أين الانحراف؟ ولماذا؟ وما الأثر على الأولويات؟', 'حددوا من يجيب عن كل سؤال وموعد الإجابة.'],
        ex: 'السؤال: لماذا ارتفع بند الصيانة عن الموازنة؟ المجيب: مشرف الصيانة. الموعد: خلال أسبوع. الأثر: تأجيل بند أقل أولوية.',
        f: ['السؤال الأول ومن يجيب', 'السؤال الثاني ومن يجيب', 'السؤال الثالث ومن يجيب', 'القرار المترتب'] } },
    { n: 7, t: 'اتخاذ القرارات وحل المشكلات', s: 'وتقليب الأمر من زوايا متعددة', q: 'ما القرار المعلّق عندكم الآن، وما الزاوية التي لم يُنظر منها إليه بعد؟',
      c: { name: 'اتخاذ القرارات باستخدام القبعات الست', pf: 'منصة سديم', url: 'https://sdeem.org/courses/24', dur: 'ساعة و41 دقيقة', h: 1.5, tip: 'تدرّبوا على النظر إلى مسألة واحدة من زوايا الحقائق والمشاعر والمخاطر والفرص والبدائل، ثم عزّزوها بالدورة الداعمة في حل المشكلات.',
        extra: { name: 'المهارات الإبداعية في حل المشاكل في مجال الأعمال', pf: 'منصة إدراك', url: 'https://www.edraak.org/programs/course/ps01-v1/' } },
      p: { src: 'إذاعة ثمانية', t: 'كيف ننجو من ورطة القرارات', dur: '33 دقيقة', why: 'لتعرفوا فخاخ القرار وكيف تتجنبونها.', yt: 'gYUMxnSsYao' },
      k: { t: 'قرار معلّق بست زوايا', intro: 'اختاروا قرارًا معلقًا واكتبوا لكل قبعة جملة واحدة، ثم قرروا موعد الحسم.',
        steps: ['اكتبوا القرار المعلّق في سطر واحد.', 'اكتبوا جملة لكل قبعة: الحقائق، المشاعر، المخاطر، الفرص، البدائل، الخطوة التالية.', 'حددوا موعد الحسم ومن سيُبلَّغ بالقرار.'],
        ex: 'القرار: تغيير موعد حلقات المساء. الحقائق: الحضور ينخفض بعد المغرب. المخاطر: تعارض مع الأسر. البدائل: تجربة شهر. الحسم: بعد التجربة.',
        f: ['القرار والحقائق', 'المخاطر والفرص', 'البدائل المتاحة', 'موعد الحسم'] } },
    { n: 8, t: 'بناء الشراكات', s: 'وصناعة علاقات تخدم رسالة الجمعية', q: 'من الجهات التي لو شاركتكم لتضاعف أثر إدارتكم؟ وهل لكم معها علاقة منظمة أم اتصال عابر؟',
      c: { name: 'بناء الشراكات الفاعلة', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2497', dur: 'ساعتان و21 دقيقة', h: 2, tip: 'دوّنوا مراحل بناء الشراكة وما يجعلها قائمة على منفعة متبادلة وليست طلبًا من طرف واحد.' },
      p: { src: 'إذاعة مختلف', t: 'لا تدخل شراكة إلا إذا فشلت كل الحلول الأخرى', dur: 'ساعة و56 دقيقة', why: 'لتناقشوا متى تكون الشراكة قرارًا صائبًا.', yt: 'dsY0_D3u4-c' },
      k: { t: 'خريطة ثلاثة شركاء محتملين', intro: 'اختاروا ثلاث جهات يمكن أن تدعم عملكم، واكتبوا ما تقدمونه لكل جهة وما تطلبونه منها.',
        steps: ['اكتبوا ثلاث جهات: واحدة قائمة، وواحدة قريبة، وواحدة جديدة.', 'اكتبوا لكل جهة: ما نقدمه وما نطلبه.', 'حددوا الخطوة الأولى وموعدها ومن يتولاها.'],
        ex: 'الجهة: مدرسة قريبة. نقدم: ورشة تعريفية بالحلقات. نطلب: قاعة لحلقات المساء. الخطوة: زيارة تعريفية خلال أسبوعين.',
        f: ['الجهة الأولى وما نتبادله', 'الجهة الثانية وما نتبادله', 'الجهة الثالثة وما نتبادله', 'الخطوة الأولى وموعدها'] } },
    { n: 9, t: 'الجودة والتحسين المستمر', s: 'وتحويل الهدر والتكرار إلى إجراءات أفضل', q: 'ما الإجراء الذي يتكرر في إدارتكم وتكثر فيه الأخطاء أو إعادة العمل؟ ومن يملك تحسينه؟',
      c: { name: 'إدارة عمليات الأعمال (BPM)', pf: 'منصة إدراك', url: 'https://www.edraak.org/programs/course/business-process-management-v1/', dur: 'مبيّنة في صفحة الدورة', h: null, tip: 'لاحظوا كيف تُرسم العملية وتُقاس ويُحدَّد موضع الهدر فيها قبل اقتراح التحسين.' },
      p: { src: 'إذاعة مختلف', t: 'إدارة الأداء: كيف تقضي على الهدر في عملك', dur: 'ساعة و9 دقائق', why: 'لتقتنعوا بأن تقليل الهدر مسؤولية قيادية.', yt: 'VI6Fpg2TZj4' },
      k: { t: 'تحسين إجراء واحد خلال شهر', intro: 'اختاروا إجراءً متكررًا في إدارتكم، وارسموا خطواته، وحددوا موضع الهدر وتحسينًا واحدًا قابلًا للتجربة.',
        steps: ['اكتبوا الإجراء وخطواته الحالية من البداية إلى النهاية.', 'حددوا الخطوة التي تتكرر فيها الأخطاء أو يضيع فيها الوقت.', 'اقترحوا تحسينًا واحدًا، وحددوا من يجربه ومتى تقيسون أثره.'],
        ex: 'الإجراء: استلام طلبات الصيانة. الهدر: الطلب يُكتب ثلاث مرات في ثلاثة أماكن. التحسين: نموذج واحد يصل إلى مشرف الصيانة. القياس: عدد الطلبات المعادة بعد شهر.',
        f: ['الإجراء وخطواته', 'موضع الهدر', 'التحسين المقترح', 'كيف سأقيس الأثر'] } },
    { n: 10, t: 'تحليل البيانات والتقارير', s: 'وقراءة الأرقام قبل اتخاذ القرار', q: 'حين يصلكم تقرير، هل تسألون عن المصدر والفترة والمقارنة، أم تكتفون بالرقم الأخير؟',
      c: { name: 'تحليل البيانات في القطاع غير الربحي', pf: 'منصة سديم', url: 'https://sdeem.org/courses/2514', dur: 'ساعتان و35 دقيقة', h: 2.5, tip: 'انتبهوا إلى كيفية قراءة الرسوم والمؤشرات، وإلى الأسئلة التي تكشف ما وراء الرقم.' },
      p: { src: 'ذا ستيج', t: 'كيف يؤثر تحليل البيانات على قرارات المستقبل', dur: '54 دقيقة', why: 'لتروا أثر البيانات في توجيه القرار.', yt: 'yq176Jl3M2I' },
      k: { t: 'خمسة أسئلة على تقرير بين أيديكم', intro: 'اختاروا تقريرًا دوريًا يصلكم، واكتبوا خمسة أسئلة تكشف ما وراء أرقامه، ومن يجيب عنها.',
        steps: ['اختاروا تقريرًا دوريًا يصلكم هذا الشهر.', 'اكتبوا خمسة أسئلة: المصدر، الفترة، المقارنة، السبب، القرار المترتب.', 'أرسلوا الأسئلة لصاحب التقرير، وحددوا موعد الإجابة.'],
        ex: 'التقرير: انتظام الطلاب الشهري. الأسئلة: ما المصدر؟ هل الفترة مقارنة بنفس الشهر من العام الماضي؟ لماذا انخفض فرع دون آخر؟ ما القرار المقترح؟',
        f: ['التقرير ومصدره', 'أهم سؤالين', 'من يجيب وموعده', 'القرار المتوقع'] } }
  ],
  bonus: { t: 'الذكاء الاصطناعي في عملكم', s: 'أداة تيسّر العمل ولا تحل محل الإنسان',
    p: { src: 'إذاعة مختلف', t: 'كيف تستفيد من الذكاء الاصطناعي في وظيفتك؟', dur: '54 دقيقة', why: 'لتتعلموا كيف ييسّر الذكاء الاصطناعي عملكم بدل أن تخشوه.', yt: 's_xLA8ab-oU' },
    tryIt: 'إعداد ملخص لتقرير طويل قبل اجتماع، وصياغة مسودة أولى لرسالة أو قرار، وطرح أسئلة تختبرون بها رأيكم قبل اعتماده. واحتفظوا بالنتيجة لمقارنتها بما كتبتموه بأنفسكم.',
    rules: ['لا تُدخلوا في أي أداة عامة بيانات شخصية أو معلومات سرية أو غير منشورة تخص الجمعية.', 'راجعوا كل ناتج قبل الاعتماد عليه؛ فالأداة قد تخطئ بثقة.', 'اسألوا إدارتكم عن الأدوات المعتمدة في الجمعية قبل استخدام أي أداة جديدة.'],
    f: ['المهمة التي جرّبت فيها', 'ما وفّره عليّ', 'ما صحّحته أو غيّرته في الناتج'] }
};
const TR_AX = n => TRACK.axes.find(a => a.n === +n);

/* ---------- البيانات ---------- */
function trConf() { return DB.tracks.find(t => t.id === TRACK.id) || { id: TRACK.id, extra: [], off: [] } }
function isLeader(u) {
  if (!u || u.active === false) return false;
  const c = trConf();
  if ((c.off || []).includes(u.id)) return false;
  return (u.roles || []).includes('linemgr') || (c.extra || []).includes(u.id);
}
const trLeaders = () => DB.users.filter(u => inc(u) && isLeader(u));
const trProg = uid => DB.trackprog.find(p => p.userId === uid && p.track === TRACK.id);
function trMine() {
  let p = trProg(S.me);
  if (!p) { p = { id: 'tp_' + S.me + '_' + TRACK.id, userId: S.me, track: TRACK.id, at: nowISO(), start: {}, axes: {}, bonus: {}, final: null }; DB.trackprog.push(p) }
  p.axes = p.axes || {}; p.start = p.start || {}; p.bonus = p.bonus || {};
  return p;
}
function trCert(uid, n) {
  return DB.extreq.filter(x => x.userId === uid && x.track === TRACK.id && +x.axis === +n).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0] || null;
}
function trAxisState(uid, n) {
  const p = trProg(uid) || { axes: {} }, a = Object.assign({}, (p.axes || {})[n] || {}, (p.acks || {})[n] ? { ack: p.acks[n] } : {});
  const cert = trCert(uid, n);
  const course = cert ? (cert.status === 'approved' ? 'done' : cert.status === 'rejected' ? 'rejected' : 'pending') : 'todo';
  const pod = a.pod ? 'done' : 'todo', card = a.card && a.card.at ? 'done' : 'todo';
  const done = course === 'done' && pod === 'done' && card === 'done';
  const started = course !== 'todo' || pod === 'done' || card === 'done' || !!(a.reflect || '').trim();
  return { course, pod, card, done, started, cert, a };
}
function trSummary(uid) {
  const st = TRACK.axes.map(x => trAxisState(uid, x.n));
  const done = st.filter(s => s.done).length;
  const hours = st.reduce((s, x) => s + (x.course === 'done' ? (+x.cert.hours || 0) : 0), 0);
  const cards = st.filter(s => s.card === 'done').length, pending = st.filter(s => s.course === 'pending').length;
  const next = TRACK.axes.find((x, i) => !st[i].done);
  const p = trProg(uid);
  return { st, done, hours, cards, pending, next, final: p && p.final, started: st.some(s => s.started) || !!(p && Object.values(p.start || {}).some(v => (v || '').trim())) };
}
function trSave(p, what) { commit('trackprog'); if (what) audit('track.' + what, 'trackprog', p.id, TRACK.title) }
function trNotifyUp(subj, body) {
  const u = ME(), m = u && u.managerId && U(u.managerId);
  if (m) notify(m.id, subj, 'مسار القيادات', body, 'عرض البطاقة', 'track');
  tmUsers().forEach(t => { if (!m || t.id !== m.id) notify(t.id, subj, 'مسار القيادات', body, 'متابعة المسار', 'trackadm') });
}

/* ---------- عناصر العرض ---------- */
const TR_ST = { done: ['تم', 'tr-ok'], pending: ['بانتظار الاعتماد', 'tr-wait'], rejected: ['مرفوضة، أعد الرفع', 'tr-bad'], todo: ['لم يبدأ', 'tr-todo'] };
const trPill = (label, s) => `<span class="tr-pill ${TR_ST[s][1]}">${s === 'done' ? ico('check') : ''}${label}</span>`;
function trRing(done, total) {
  const pct = Math.round(done / total * 100);
  return `<div class="tr-ring" style="background:conic-gradient(var(--sky) ${pct}%,rgba(255,255,255,.16) 0)"><div><b class="num">${done}</b><span>من ${total}</span></div></div>`;
}
function trPodcast(p, key) {
  const loaded = S._trPlay === key;
  return `<div class="tr-pod">${loaded
    ? `<div class="tr-yt"><iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&rel=0" title="${esc(p.t)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<button class="tr-yt tr-yt-off" data-act="tr-play" data-k="${key}" aria-label="تشغيل الحلقة: ${esc(p.t)}" style="background-image:url(https://i.ytimg.com/vi/${p.yt}/hqdefault.jpg)"><span>${ico('play')}</span></button>`}
   <div class="tr-pod-meta"><span class="small muted">حلقة صوتية · ${esc(p.src)} · ${esc(p.dur)}</span><b>${esc(p.t)}</b><span class="small">${esc(p.why)}</span>
   <a class="linkbtn" href="https://www.youtube.com/watch?v=${p.yt}" target="_blank" rel="noopener">اسمعها في تطبيق يوتيوب ${ico('ext')}</a></div></div>`;
}

/* ---------- صفحة القائد: خريطة المسار ---------- */
function vTrackMap() {
  const u = ME(), sm = trSummary(S.me), p = trProg(S.me) || { start: {} };
  const startDone = Object.values(p.start || {}).some(v => (v || '').trim());
  const all = sm.done === TRACK.axes.length;
  return `${pg(TRACK.title, TRACK.audience)}
  <div class="card tr-hero"><div class="tr-hero-t"><h2>عشرة محاور، لكل محور ثلاث خطوات</h2><p>${esc(TRACK.intro)}</p>
    <div class="tr-legend"><span><b>الدورة</b> = المعرفة</span><span><b>الحلقة الصوتية</b> = القناعة</span><span><b>بطاقة التطبيق</b> = المهارة</span></div></div>
    <div class="tr-hero-s">${trRing(sm.done, TRACK.axes.length)}<div><b>محاور مكتملة</b><span class="num">${num(sm.hours)} ساعة معتمدة</span>${sm.pending ? `<span>${sm.pending} شهادة بانتظار الاعتماد</span>` : ''}</div></div></div>
  ${startDone ? '' : `<div class="card pad tr-start"><h3>${ico('flag')} قبل ما تبدأ: وقفة مع واقع عملكم</h3><p>${esc(TRACK.start.q)}</p>
    <div class="fgrid">${TRACK.start.f.map((l, i) => `<div class="field"><label for="trs_${i}">${l}</label><textarea class="inp" id="trs_${i}" rows="2" maxlength="400">${esc((p.start || {})[i] || '')}</textarea></div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="tr-start">احفظ وابدأ المسار</button></div></div>`}
  <div class="tr-grid">${TRACK.axes.map((a, i) => { const s = sm.st[i];
    return `<button class="card tr-ax ${s.done ? 'is-done' : ''} ${sm.next && sm.next.n === a.n && !s.done ? 'is-next' : ''}" data-act="tr-axis" data-n="${a.n}">
      <span class="tr-n num">${String(a.n).padStart(2, '0')}</span><span class="tr-ax-t"><b>${esc(a.t)}</b><span>${esc(a.s)}</span></span>
      <span class="tr-ax-st">${trPill('الدورة', s.course)}${trPill('الحلقة', s.pod)}${trPill('التطبيق', s.card)}</span></button>` }).join('')}</div>
  <div class="grid g2" style="margin-top:16px">
   <button class="card pad tr-bonus" data-act="tr-axis" data-n="ai"><span class="small muted">حلقة إضافية</span><b>${esc(TRACK.bonus.t)}</b><span class="small">${esc(TRACK.bonus.s)}</span></button>
   <div class="card pad tr-final ${all ? 'ready' : ''}"><b>${ico('award')} بطاقة الإنجاز</b>
    ${sm.final ? `<span>أرسلتها ${fmt(sm.final.at.slice(0, 10))}. جزاكم الله خيرًا على ما بذلتم.</span>`
      : all ? `<span>أكملتم المحاور العشرة. أرسلوا بطاقة الإنجاز لرئيسكم وإدارة التدريب.</span><button class="btn" data-act="tr-final">أرسل بطاقة الإنجاز</button>`
      : `<span>تنفتح بعد إكمال المحاور العشرة. باقي ${TRACK.axes.length - sm.done}.</span>`}</div></div>`;
}

/* ---------- صفحة المحور ---------- */
function vTrackAxis(n) {
  if (n === 'ai') return vTrackBonus();
  const a = TR_AX(n); if (!a) { S.trackAxis = null; return vTrackMap() }
  const st = trAxisState(S.me, a.n), card = (st.a.card || {}), c = a.c;
  const prev = TR_AX(a.n - 1), next = TR_AX(a.n + 1);
  const certBlock = st.course === 'done' ? `<div class="note ok">${ico('check')} اعتُمدت شهادتك وأُضيفت <b class="num">${num(st.cert.hours)}</b> ساعة لسجلك.</div>`
    : st.course === 'pending' ? `<div class="note">${ico('clock')} شهادتك عند إدارة التدريب للاعتماد.</div>`
    : `${st.course === 'rejected' ? `<div class="note warn">لم تُعتمد الشهادة: ${esc((st.cert.decisions || []).filter(d => d.action === 'reject').slice(-1).map(d => d.note)[0] || '')}</div>` : ''}<button class="btn" data-act="tr-cert" data-n="${a.n}">${ico('upload')} ارفع شهادة الإتمام</button>`;
  return `<div class="tr-back"><button class="linkbtn" data-act="tr-axis" data-n="">${ico('menu')} خريطة المسار</button></div>
  <div class="tr-axhead"><span class="tr-n num">${String(a.n).padStart(2, '0')}</span><div><h1>${esc(a.t)}</h1><p>${esc(a.s)}</p></div>
   <span class="tr-ax-st">${trPill('الدورة', st.course)}${trPill('الحلقة', st.pod)}${trPill('التطبيق', st.card)}</span></div>
  <div class="card pad tr-reflect"><h3>وقفة مع واقع عملكم</h3><p>${esc(a.q)}</p><textarea class="inp" id="tr_ref" rows="2" maxlength="600" placeholder="اكتبوا ملاحظتكم (اختياري)">${esc(st.a.reflect || '')}</textarea>
   <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sec" data-act="tr-ref" data-n="${a.n}">حفظ</button></div></div>
  <section class="card pad tr-step"><div class="tr-step-h"><span class="tr-sn">1</span><div><h3>الدورة: المعرفة</h3><span class="small muted">${esc(c.pf)} · ${esc(c.dur)} · مجانية</span></div></div>
   <b class="tr-cname">${esc(c.name)}</b>
   <p class="small">${ico('spark')} أثناء التعلم: ${esc(c.tip)}</p>${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ''}
   <ol class="tr-howto"><li>افتح الدورة في ${esc(c.pf)} وسجّل مجانًا.</li><li>أكمل الدورة ونزّل شهادة الإتمام.</li><li>ارفع الشهادة هنا، وتنحسب ساعاتها بعد اعتماد إدارة التدريب.</li></ol>
   <div class="row wrap" style="gap:8px"><a class="btn sec" href="${c.url}" target="_blank" rel="noopener">${ico('ext')} افتح الدورة</a>${certBlock}</div>
   ${c.extra ? `<p class="small" style="margin-top:10px">دورة داعمة (اختيارية): <a href="${c.extra.url}" target="_blank" rel="noopener">${esc(c.extra.name)} — ${esc(c.extra.pf)}</a></p>` : ''}</section>
  <section class="card pad tr-step"><div class="tr-step-h"><span class="tr-sn">2</span><div><h3>الحلقة الصوتية: القناعة</h3><span class="small muted">اسمعها هنا أو في الطريق</span></div></div>
   ${trPodcast(a.p, 'ax' + a.n)}
   <div class="row" style="justify-content:flex-end;margin-top:10px">${st.pod === 'done' ? `<span class="tr-pill tr-ok">${ico('check')} استمعت ${fmt(st.a.pod.slice(0, 10))}</span>` : `<button class="btn" data-act="tr-pod" data-n="${a.n}">${ico('check')} استمعت للحلقة</button>`}</div></section>
  <section class="card pad tr-step"><div class="tr-step-h"><span class="tr-sn">3</span><div><h3>بطاقة التطبيق: المهارة</h3><span class="small muted">20 دقيقة في جلسة واحدة</span></div></div>
   <b class="tr-cname">${esc(a.k.t)}</b><p>${esc(a.k.intro)} إن لم يتوفر عمل قائم، اعتبروا البطاقة تمرينًا على المثال.</p>
   <ol class="tr-howto">${a.k.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
   <details class="tr-ex"><summary>مثال تدريبي للتوضيح</summary><p>${esc(a.k.ex)}</p></details>
   <div class="fgrid" style="margin-top:12px">${a.k.f.map((l, i) => `<div class="field"><label for="trk_${i}">${esc(l)}</label><textarea class="inp" id="trk_${i}" rows="2" maxlength="600">${esc((card.f || [])[i] || '')}</textarea></div>`).join('')}</div>
   ${card.at ? `<p class="small muted" style="margin-top:6px">أرسلتها ${fmt(card.at.slice(0, 10))}. تقدر تعدّلها وتعيد إرسالها.</p>` : ''}
   ${(st.a.ack) ? `<div class="note ok" style="margin-top:8px">${ico('msg')} ${esc((U(st.a.ack.by) || {}).name || 'رئيسك')}: ${esc(st.a.ack.note || 'اطّلع على البطاقة')}</div>` : ''}
   <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="tr-card" data-n="${a.n}">${card.at ? 'تحديث البطاقة' : 'أرسل البطاقة'}</button></div></section>
  <div class="row tr-pn">${prev ? `<button class="btn ghost" data-act="tr-axis" data-n="${prev.n}">→ ${esc(prev.t)}</button>` : '<span></span>'}${next ? `<button class="btn ghost" data-act="tr-axis" data-n="${next.n}">${esc(next.t)} ←</button>` : ''}</div>`;
}
function vTrackBonus() {
  const b = TRACK.bonus, p = trProg(S.me) || { bonus: {} }, bo = p.bonus || {};
  return `<div class="tr-back"><button class="linkbtn" data-act="tr-axis" data-n="">${ico('menu')} خريطة المسار</button></div>
  <div class="tr-axhead"><span class="tr-n">${ico('spark')}</span><div><h1>${esc(b.t)}</h1><p>${esc(b.s)}</p></div></div>
  <section class="card pad tr-step">${trPodcast(b.p, 'ai')}
   <div class="row" style="justify-content:flex-end;margin-top:10px">${bo.pod ? `<span class="tr-pill tr-ok">${ico('check')} استمعت</span>` : `<button class="btn" data-act="tr-pod" data-n="ai">${ico('check')} استمعت للحلقة</button>`}</div></section>
  <section class="card pad tr-step"><h3>جرّبوا تجربة صغيرة هذا الأسبوع</h3><p>${esc(b.tryIt)}</p>
   <h3 style="margin-top:10px">قواعد الاستخدام الآمن</h3><ul class="tr-rules">${b.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
   <h3 style="margin-top:12px">بطاقة التجربة <span class="small muted">(اختيارية)</span></h3>
   <div class="fgrid">${b.f.map((l, i) => `<div class="field"><label for="trb_${i}">${esc(l)}</label><textarea class="inp" id="trb_${i}" rows="2" maxlength="600">${esc((bo.f || [])[i] || '')}</textarea></div>`).join('')}</div>
   <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" data-act="tr-bonus">حفظ البطاقة</button></div></section>`;
}
VIEWS.track = () => {
  const u = ME();
  if (S.role === 'linemgr' && S.trTab === 'team') return trTabs() + vTrackTeam();
  if (!isLeader(u)) return `${pg(TRACK.title, '')}<div class="card empty">${ico('flag')}<div>هذا المسار مخصص للقيادات. إذا تشوف إنه يخصك، تواصل مع إدارة التدريب.</div></div>`;
  return (S.role === 'linemgr' ? trTabs() : '') + (S.trackAxis ? vTrackAxis(S.trackAxis) : vTrackMap());
};
function trTabs() {
  const n = trTeamCards().filter(x => !x.ack).length;
  return `<div class="emp-sub" role="tablist"><button role="tab" class="${S.trTab !== 'team' ? 'on' : ''}" data-act="tr-tab" data-t="mine">مساري</button><button role="tab" class="${S.trTab === 'team' ? 'on' : ''}" data-act="tr-tab" data-t="team">بطاقات فريقي${n ? ` <span class="badge num">${n}</span>` : ''}</button></div>`;
}

/* ---------- الرئيس: بطاقات فريقه ---------- */
function trTeamCards() {
  const team = DB.users.filter(u => inc(u) && u.managerId === S.me && isLeader(u));
  const out = [];
  team.forEach(u => { const p = trProg(u.id); if (!p) return; Object.entries(p.axes || {}).forEach(([n, a]) => { if (a.card && a.card.at) out.push({ u, n: +n, a, card: a.card, ack: (p.acks || {})[n], p }) }) });
  return out.sort((x, y) => (x.ack ? 1 : 0) - (y.ack ? 1 : 0) || y.card.at.localeCompare(x.card.at));
}
function vTrackTeam() {
  const team = DB.users.filter(u => inc(u) && u.managerId === S.me && isLeader(u));
  const cards = trTeamCards();
  return `${pg('بطاقات التطبيق لفريقك', 'بطاقات التطبيق اللي أرسلها القادة المرتبطون بك في مسار القيادات. اطّلع عليها واكتب ملاحظة إذا حبيت.')}
  ${team.length ? `<div class="card tbl-wrap" style="margin-bottom:16px"><table><thead><tr><th>القائد</th><th>محاور مكتملة</th><th>بطاقات مرسلة</th><th>ساعات معتمدة</th></tr></thead><tbody>${team.map(u => { const s = trSummary(u.id); return `<tr><td><b>${esc(u.name)}</b></td><td class="num">${s.done} / 10</td><td class="num">${s.cards}</td><td class="num">${num(s.hours)}</td></tr>` }).join('')}</tbody></table></div>` : ''}
  ${cards.length ? cards.map(x => trCardView(x, true)).join('') : `<div class="card empty">${ico('inbox')}<div>${team.length ? 'ما وصلت بطاقات للحين.' : 'ما عندك قادة مرتبطين بك في المسار.'}</div></div>`}`;
}
function trCardView(x, canAck) {
  const a = TR_AX(x.n);
  return `<article class="card pad tr-cardv"><div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${esc(x.u.name)}</b> · <span class="small muted">المحور ${x.n}: ${esc(a.t)} · ${fmt(x.card.at.slice(0, 10))}</span></div>
   ${x.ack ? `<span class="tr-pill tr-ok">${ico('check')} اطّلعت</span>` : ''}</div>
   <b class="tr-cname">${esc(a.k.t)}</b>
   <dl class="tr-dl">${a.k.f.map((l, i) => `<dt>${esc(l)}</dt><dd>${esc((x.card.f || [])[i] || '—')}</dd>`).join('')}</dl>
   ${x.ack ? (x.ack.note ? `<div class="small muted">ملاحظتك: ${esc(x.ack.note)}</div>` : '')
    : canAck ? `<div class="row" style="gap:8px;margin-top:8px"><input class="inp" id="tra_${x.u.id}_${x.n}" placeholder="ملاحظة قصيرة للقائد (اختياري)" maxlength="300" style="flex:1"><button class="btn sec" data-act="tr-ack" data-u="${x.u.id}" data-n="${x.n}">اطّلعت</button></div>` : ''}</article>`;
}

/* ---------- مدير التدريب: متابعة المسار ---------- */
function vTrackAdm() {
  const L = trLeaders(), sums = L.map(u => ({ u, s: trSummary(u.id) }));
  const started = sums.filter(x => x.s.started).length, finished = sums.filter(x => x.s.done === 10).length;
  const cards = sums.reduce((t, x) => t + x.s.cards, 0), pend = sums.reduce((t, x) => t + x.s.pending, 0);
  const conf = trConf();
  const dot = s => `<span class="tr-dot ${s.done ? 'd' : s.started ? 'p' : ''}" title="${s.done ? 'مكتمل' : s.started ? 'بدأ' : 'لم يبدأ'}"></span>`;
  const others = DB.users.filter(u => inc(u) && u.active !== false && !isLeader(u) && !(u.roles || []).every(r => r === 'sysadmin' || r === 'trainer'));
  return `${pg(TRACK.title, 'متابعة القادة في المسار: من بدأ، ووين وصل، وبطاقات التطبيق اللي أرسلوها.')}
  <div class="grid g4" style="margin-bottom:16px">${kpiTile('users', 'var(--sky-2)', 'var(--teal)', L.length, 'قادة في المسار')}${kpiTile('play', 'var(--sky-2)', 'var(--teal)', started, 'بدؤوا')}${kpiTile('award', 'var(--sky-2)', 'var(--teal)', finished, 'أكملوا المحاور العشرة')}${kpiTile('clock', 'var(--sky-2)', 'var(--teal)', pend, 'شهادات بانتظار اعتمادك')}</div>
  ${pend ? `<div class="note" style="margin-bottom:12px">${ico('clock')} شهادات الدورات تصلك في «الطلبات والمتابعة ← الدورات الخارجية»، ومكتوب فيها رقم المحور. <button class="linkbtn" data-act="go" data-v="requests">افتح الطلبات</button></div>` : ''}
  <div class="card tbl-wrap"><table class="tr-mx"><thead><tr><th>القائد</th>${TRACK.axes.map(a => `<th title="${esc(a.t)}" class="num">${a.n}</th>`).join('')}<th>البطاقات</th><th>الساعات</th><th></th></tr></thead>
  <tbody>${sums.map(({ u, s }) => `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(u.title || '')}</div></td>${s.st.map(dot).join('')}<td class="num">${s.cards}</td><td class="num">${num(s.hours)}</td><td>${s.cards ? `<button class="btn ghost sm" data-act="tr-who" data-u="${u.id}">البطاقات</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="14" class="muted">لا يوجد قادة. القادة هم من لهم صفة «رئيس مباشر»، وتقدر تضيف غيرهم من تحت.</td></tr>`}</tbody></table></div>
  <div class="small muted" style="margin:6px 2px 16px"><span class="tr-dot d"></span> مكتمل (دورة معتمدة + حلقة + بطاقة) · <span class="tr-dot p"></span> بدأ · <span class="tr-dot"></span> لم يبدأ</div>
  <div class="card pad"><h3>المشاركون</h3><div class="h-sub">كل من له صفة «رئيس مباشر» داخل المسار تلقائيًا. أضف هنا من يُعتبر من القيادات بدون هذه الصفة، مثل عميدة المعهد أو وكيلاتها.</div>
   <div class="row wrap" style="gap:8px;margin:10px 0"><select class="inp" id="tr_add" style="max-width:320px">${options(others.map(u => [u.id, u.name]), '', 'اختر موظفًا…')}</select><button class="btn sec" data-act="tr-add">أضف للمسار</button></div>
   ${(conf.extra || []).length ? `<div class="row wrap" style="gap:6px">${conf.extra.map(id => `<span class="tag">${esc((U(id) || {}).name || id)} <button class="linkbtn" data-act="tr-rm" data-u="${id}" aria-label="إزالة">✕</button></span>`).join('')}</div>` : ''}</div>`;
}
VIEWS.trackadm = vTrackAdm;

/* ---------- الإجراءات ---------- */
Object.assign(ACT, {
  'tr-tab'(t) { S.trTab = t.dataset.t; draw() },
  'tr-axis'(t) { S.trackAxis = t.dataset.n || null; S._trPlay = null; if (S.view !== 'track') go('track'); else draw(); scrollTo(0, 0) },
  'tr-play'(t) { S._trPlay = t.dataset.k; draw() },
  'tr-start'() { const p = trMine(); TRACK.start.f.forEach((_, i) => p.start[i] = fieldVal('trs_' + i)); if (!Object.values(p.start).some(v => v)) { toast('اكتب سطر واحد على الأقل'); return } trSave(p, 'start'); toast('حُفظت وقفتك. بالتوفيق في المسار'); draw() },
  'tr-ref'(t) { const p = trMine(), n = t.dataset.n; p.axes[n] = p.axes[n] || {}; p.axes[n].reflect = fieldVal('tr_ref'); trSave(p); toast('حُفظت') },
  'tr-pod'(t) {
    const p = trMine(), n = t.dataset.n;
    if (n === 'ai') { p.bonus.pod = nowISO() } else { p.axes[n] = p.axes[n] || {}; p.axes[n].pod = nowISO() }
    trSave(p, 'podcast'); toast('سُجّل استماعك للحلقة'); draw();
  },
  'tr-bonus'() { const p = trMine(); p.bonus.f = TRACK.bonus.f.map((_, i) => fieldVal('trb_' + i)); p.bonus.at = nowISO(); trSave(p, 'bonus'); toast('حُفظت بطاقة التجربة') },
  'tr-card'(t) {
    const a = TR_AX(t.dataset.n), f = a.k.f.map((_, i) => fieldVal('trk_' + i));
    if (f.filter(Boolean).length < 2) { toast('عبّ البطاقة', 'اكتب إجابة موجزة في خانتين على الأقل'); return }
    const p = trMine(), x = p.axes[a.n] = p.axes[a.n] || {}, first = !(x.card && x.card.at);
    x.card = { f, at: nowISO() }; if (!first && p.acks) delete p.acks[a.n];
    trSave(p, 'card');
    trNotifyUp(`${(ME() || {}).name} أرسل بطاقة تطبيق: ${a.k.t}`, `<p>المحور ${a.n}: <b>${esc(a.t)}</b>.</p>${a.k.f.map((l, i) => `<p><b>${esc(l)}:</b> ${esc(f[i] || '—')}</p>`).join('')}`);
    toast(first ? 'أُرسلت البطاقة لرئيسك وإدارة التدريب' : 'حُدّثت البطاقة'); draw();
  },
  'tr-cert'(t) {
    const a = TR_AX(t.dataset.n), c = a.c;
    S._trc = a.n;
    mask(`${mHead('شهادة إتمام الدورة', `المحور ${a.n}: ${esc(a.t)}`)}<div class="m-b">
     <div class="note" style="margin-bottom:12px"><b>${esc(c.name)}</b> — ${esc(c.pf)}. تروح الشهادة لإدارة التدريب، وتنحسب ساعاتها في سجلك بعد الاعتماد.</div>
     <div class="fgrid"><div class="field"><label for="trc_date">تاريخ الإتمام *</label><input class="inp" id="trc_date" type="date" max="${TODAY()}" value="${TODAY()}"></div>
      <div class="field"><label for="trc_h">عدد الساعات${c.h ? '' : ' * (كما في الشهادة)'}</label><input class="inp" id="trc_h" type="number" min="0.5" max="60" step="0.5" ${c.h ? `value="${c.h}" readonly style="background:var(--sky-3)"` : ''}></div>
      <div class="field full"><label for="trc_f">ملف الشهادة * (PDF/JPG/PNG حتى ${(FILE_MAX / 1e6).toFixed(1)} م.ب)</label><input class="inp" id="trc_f" type="file" accept=".pdf,.jpg,.jpeg,.png"></div></div>
     ${c.h ? `<p class="small muted" style="margin-top:8px">مدة الدورة ${esc(c.dur)}، وتنحسب ${num(c.h)} ساعة (مقرّبة لأقرب نصف ساعة للأسفل).</p>` : ''}</div>
    <div class="m-f"><button class="btn sec" data-act="close">إلغاء</button><button class="btn" data-act="tr-cert-go">أرسل للاعتماد</button></div>`);
  },
  'tr-cert-go': safe(async () => {
    const a = TR_AX(S._trc), c = a.c, cf = document.getElementById('trc_f').files[0];
    const hours = c.h || +fieldVal('trc_h');
    if (!fieldVal('trc_date')) { toast('اختر تاريخ الإتمام'); return }
    if (!hours || hours <= 0) { toast('اكتب عدد الساعات كما في الشهادة'); return }
    if (!cf) { toast('ارفع ملف الشهادة'); return }
    const bad = fileCheck(cf); if (bad) { toast('ملف الشهادة غير مقبول', bad); return }
    const sf = await storeFile(cf); if (!sf.ok) { toast('ملف الشهادة غير مقبول', sf.msg); return }
    const r = submitExt(S.me, { title: c.name, provider: c.pf, trainer: '', date: fieldVal('trc_date'), hours, field: TRACK.cat, desc: `${TRACK.title} — المحور ${a.n}: ${a.t}`, skills: '', certFile: sf.id, attach: [] });
    if (!r.ok) { DB.files = DB.files.filter(x => x.id !== sf.id); commit('files'); toast('تعذّر الإرسال', r.msg); return }
    r.req.track = TRACK.id; r.req.axis = a.n; commit('extreq');
    closeLayer(); toast('أُرسلت الشهادة لإدارة التدريب'); draw();
  }),
  'tr-final'() {
    const sm = trSummary(S.me); if (sm.done < TRACK.axes.length) { toast('أكمل المحاور العشرة أول'); return }
    const p = trMine(); p.final = { at: nowISO(), hours: sm.hours }; trSave(p, 'final');
    trNotifyUp(`${(ME() || {}).name} أكمل ${TRACK.title}`, `<p>أكمل المحاور العشرة: ${TRACK.axes.map(a => esc(a.t)).join('، ')}.</p><p>الساعات المعتمدة: <b>${num(sm.hours)}</b>. وبطاقات التطبيق العشر موجودة في صفحة المسار.</p>`);
    toast('أُرسلت بطاقة الإنجاز. جزاكم الله خيرًا'); draw();
  },
  'tr-ack'(t) {
    const p = trProg(t.dataset.u), n = t.dataset.n; if (!p || !p.axes[n]) return;
    const note = fieldVal(`tra_${t.dataset.u}_${n}`);
    p.acks = p.acks || {}; p.acks[n] = { by: S.me, at: nowISO(), note };
    trSave(p, 'ack');
    notify(t.dataset.u, `اطّلع ${(ME() || {}).name} على بطاقتك: ${TR_AX(n).k.t}`, 'مسار القيادات', note ? `<p>${esc(note)}</p>` : '<p>اطّلع رئيسك على بطاقة التطبيق.</p>', 'افتح المسار', 'track');
    toast('تم'); draw();
  },
  'tr-who'(t) {
    const u = U(t.dataset.u), p = trProg(u.id); if (!p) return;
    const list = Object.entries(p.axes || {}).filter(([, a]) => a.card && a.card.at).map(([n, a]) => ({ u, n: +n, a, card: a.card, ack: (p.acks || {})[n] }));
    mask(`${mHead('بطاقات التطبيق', esc(u.name))}<div class="m-b">${Object.values(p.start || {}).some(Boolean) ? `<div class="card pad" style="margin-bottom:10px"><b>وقفة البداية</b><dl class="tr-dl">${TRACK.start.f.map((l, i) => `<dt>${l}</dt><dd>${esc((p.start || {})[i] || '—')}</dd>`).join('')}</dl></div>` : ''}${list.map(x => trCardView(x, false)).join('')}</div><div class="m-f"><button class="btn sec" data-act="close">إغلاق</button></div>`, 'wide');
  },
  'tr-add'() {
    const id = fieldVal('tr_add'); if (!id) return;
    let c = DB.tracks.find(t => t.id === TRACK.id); if (!c) { c = { id: TRACK.id, extra: [], off: [] }; DB.tracks.push(c) }
    c.extra = [...new Set([...(c.extra || []), id])]; c.off = (c.off || []).filter(x => x !== id);
    commit('tracks'); audit('track.add', 'tracks', id, (U(id) || {}).name || ''); toast('أُضيف للمسار'); draw();
  },
  'tr-rm'(t) { const c = DB.tracks.find(x => x.id === TRACK.id); if (!c) return; c.extra = (c.extra || []).filter(x => x !== t.dataset.u); commit('tracks'); draw() },
});
/* ---------- الربط مع القوائم والرئيسية ---------- */
NAV.linemgr.splice(1, 0, ['track', 'مسار القيادات', 'flag']);
NAV.trainmgr.splice(Math.max(1, NAV.trainmgr.findIndex(x => x[0] === 'library' || x[0] === 'libadmin') + 1), 0, ['trackadm', 'مسار القيادات', 'flag']);
EMP_GROUPS.learn.subs.push(['track', 'مسار القيادات']); EMP_GROUP_OF.track = 'learn';
{ const orig = VIEWS.track; VIEWS.track = () => (S.role === 'employee' ? (S.empLast.learn = 'track', empGroupBar('learn', 'track')) : '') + orig() }
const _empGroupBar = empGroupBar;
empGroupBar = function (g, cur) { const o = EMP_GROUPS[g], keep = o.subs; if (g === 'learn' && !isLeader(ME())) o.subs = keep.filter(s => s[0] !== 'track'); const h = _empGroupBar(g, cur); o.subs = keep; return h };
TASK_ICON.track = ['flag', '#072C49', '#9DDAE5'];
const _empTasks = empTasks;
empTasks = function (u) {
  const T = _empTasks(u);
  if (isLeader(u)) { const s = trSummary(u.id); if (!s.final && s.next) T.splice(Math.min(1, T.length), 0, { kind: 'track', title: `مسار القيادات: ${s.next.t}`, sub: `المحور ${s.next.n} من 10 · أكملت ${s.done}`, pct: Math.round(s.done * 10), btn: s.started ? 'كمّل' : 'ابدأ', primary: true, act: 'tr-axis', v: '' }) }
  return T;
};

/* ---------- التنسيق ---------- */
(() => { const st = document.createElement('style'); st.textContent = `
.tr-hero{display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;padding:22px;background:var(--navy);color:#fff;border:0;margin-bottom:16px}
.tr-hero h2{font-family:var(--display);font-size:22px;color:#fff;margin-bottom:6px}.tr-hero p{color:#D5E5EE;font-size:14.5px;line-height:1.8;max-width:640px}
.tr-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.tr-legend span{background:rgba(157,218,229,.14);color:#D5E5EE;border-radius:99px;padding:4px 12px;font-size:13px}.tr-legend b{color:#fff}
.tr-hero-t{flex:999 1 420px}.tr-hero-s{flex:1 1 200px;display:flex;gap:14px;align-items:center}.tr-hero-s>div:last-child{display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:#C4D8E5}.tr-hero-s b{color:#fff;font-size:16px}
.tr-ring{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;flex:none}.tr-ring>div{width:66px;height:66px;border-radius:50%;background:var(--navy);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}.tr-ring b{font-size:22px;font-family:var(--display);color:#fff}.tr-ring span{font-size:11px;color:#C4D8E5}
.tr-start{margin-bottom:16px;border-color:var(--teal)}.tr-start h3{display:flex;gap:6px;align-items:center}.tr-start p{color:var(--ink-2);margin:4px 0 10px}
.tr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px}
.tr-ax{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:center;text-align:start;padding:16px;cursor:pointer;transition:border-color .15s}
.tr-ax:hover{border-color:var(--teal)}.tr-ax.is-next{border:2px solid var(--teal)}.tr-ax.is-done{background:var(--sky-3,#F2F9FB)}
.tr-n{width:44px;height:44px;border-radius:12px;background:var(--navy);color:var(--sky);display:grid;place-items:center;font-weight:700;font-size:16px;flex:none}
.tr-ax-t{display:flex;flex-direction:column;min-width:0}.tr-ax-t b{color:var(--navy);font-size:15.5px}.tr-ax-t span{font-size:13px;color:var(--ink-2)}
.tr-ax-st{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.tr-pill{display:inline-flex;align-items:center;gap:4px;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap}.tr-pill .i{width:13px;height:13px}
.tr-ok{background:#E2F3EB;color:#1E6B4E}.tr-wait{background:#FBEFD9;color:#8A5C12}.tr-bad{background:#F8E4DF;color:#8F3B2B}.tr-todo{background:var(--sand);color:var(--ink-2)}
.tr-bonus{display:flex;flex-direction:column;gap:2px;text-align:start;cursor:pointer}.tr-bonus b{color:var(--navy);font-size:15.5px}
.tr-final{display:flex;flex-direction:column;gap:6px;align-items:flex-start}.tr-final b{display:flex;gap:6px;align-items:center;color:var(--navy)}.tr-final span{font-size:14px;color:var(--ink-2)}.tr-final.ready{border-color:var(--teal)}
.tr-back{margin-bottom:6px}.tr-axhead{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:16px}.tr-axhead h1{font-family:var(--display);font-size:26px;color:var(--navy)}.tr-axhead p{color:var(--ink-2)}.tr-axhead .tr-ax-st{grid-column:auto;margin:0}
.tr-reflect{margin-bottom:12px;background:var(--paper);box-shadow:none}.tr-reflect p{color:var(--ink-2);margin:4px 0 8px}
.tr-step{margin-bottom:12px}.tr-step-h{display:flex;gap:12px;align-items:center;margin-bottom:10px}.tr-sn{width:34px;height:34px;border-radius:50%;background:var(--sky);color:var(--navy);display:grid;place-items:center;font-weight:700;flex:none}
.tr-cname{display:block;font-size:17px;color:var(--navy);margin-bottom:6px}
.tr-howto{margin:8px 20px 12px 0;color:var(--ink-2);font-size:14px;line-height:1.9}
.tr-ex{background:var(--paper);border-radius:10px;padding:10px 12px;margin-top:8px}.tr-ex summary{cursor:pointer;font-weight:600;color:var(--teal)}.tr-ex p{margin-top:6px;font-size:14px;color:var(--ink-2);line-height:1.9}
.tr-pod{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:start}
.tr-yt{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;border:0}.tr-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.tr-yt-off{background-size:cover;background-position:center;cursor:pointer}.tr-yt-off span{position:absolute;inset:0;display:grid;place-items:center;background:rgba(7,44,73,.35)}.tr-yt-off .i{width:54px;height:54px;color:#fff}
.tr-pod-meta{display:flex;flex-direction:column;gap:4px}.tr-pod-meta b{font-size:16px;color:var(--navy)}
.tr-pn{justify-content:space-between;margin-top:8px;gap:8px;flex-wrap:wrap}
.tr-rules{margin:6px 20px 0 0;line-height:1.9;color:var(--ink-2)}
.tr-dl{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:6px 14px;margin:8px 0}.tr-dl dt{font-weight:600;color:var(--navy);font-size:13.5px}.tr-dl dd{margin:0;font-size:14px;line-height:1.8;white-space:pre-wrap}
.tr-cardv{margin-bottom:10px}
.tr-mx th,.tr-mx td{text-align:center}.tr-mx td:first-child,.tr-mx th:first-child{text-align:start}
.tr-dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--sand);vertical-align:middle}.tr-dot.p{background:#F2C77B}.tr-dot.d{background:var(--teal)}
@media(max-width:700px){.tr-pod{grid-template-columns:1fr}.tr-dl{grid-template-columns:1fr}.tr-axhead h1{font-size:22px}}
`; document.head.appendChild(st) })();
