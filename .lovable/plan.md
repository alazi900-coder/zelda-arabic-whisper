## الهدف
تحويل صفحة `Dubbing.tsx` من مولّد TTS بسيط إلى **استوديو دبلجة سينمائي** يركّز على ثراء الأصوات والنبرات لكل شخصية من شخصيات Tears of the Kingdom، مع محرّر مشاهد Timeline ومكتبة Takes ومعاينة بنمط زيلدا واستيراد من المحرّر وتصدير ZIP+SRT.

---

## 1) توسيع كتالوج الشخصيات والنبرات (الأهم)

ملف جديد: `src/lib/dubbing/character-catalog.ts`

- **+30 شخصية** كاملة من TotK (إضافة على الـ 19 الحاليين): Kass, Beedle, Robbie, Josha, Hudson, Karson, Bolson, Jiahto, Penn, Traysi, Pikango, Kilton, Hetsu المضافون مسبقًا، Cado, Pelison, Rola, Calip, Granté, Estan, Cima, Reede, Tasseren, Jerrin, Pruce, Mattison, Paya, Dorian, Cottla, Symin, Olkin, Wabbin, إلخ.
- لكل شخصية **5-7 نبرات (Tones)** بدل أسلوب واحد:
  - `neutral`, `happy`, `sad`, `lament` (رثاء)، `angry`, `evil`, `fearful`, `commanding`, `whisper`, `battle-cry`، إلخ.
- كل نبرة فيها:
  ```ts
  { id, labelAr, prefix, voiceOverride?, stability?, similarity? }
  ```
  مثل: `lament-zelda`: «بصوت زيلدا حزين متهدّج كأنها تودّع لينك للمرة الأخيرة، نَفَسُها مكسور والكلمات تخرج ببطء شديد:».
- الأشرار يأخذون نبرات `evil`, `menacing`, `mocking`. الحكماء يأخذون `wise`, `solemn`, `prophetic`. الأطفال يأخذون `excited`, `scared`, `playful`.

اختبار: `src/test/dubbing-catalog.test.ts` يتحقّق أن كل شخصية لها ≥4 نبرات وأن كل نبرة تحوي بادئة عربية صحيحة.

## 2) محرّر مشاهد Timeline

مكوّن جديد: `src/components/dubbing/SceneTimeline.tsx`

- جدول/قائمة عمودية لـ«أسطر السكريبت» — كل سطر: شخصية + نبرة + نص + معاينة + سحب-وإفلات لإعادة الترتيب (`@dnd-kit/sortable` المتوفّر).
- زر **«تشغيل المشهد كاملاً»** يدمج كل الـ WAV بالترتيب مع توقّفات قابلة للتعديل بين السطور.
- زر **«تصدير المشهد»** ينتج WAV واحدًا مدموجًا + SRT بمواقيت السطور.
- دمج WAV في المتصفّح عبر `AudioContext.decodeAudioData` ثم إعادة ترميز إلى WAV واحد (بدون مكتبة جديدة).

## 3) مكتبة Takes ومقارنة A/B

مكوّن: `src/components/dubbing/TakesLibrary.tsx`

- لكل سطر يمكن توليد **عدّة محاولات** (Takes) بنفس النص ونبرات مختلفة.
- بطاقة لكل Take فيها: تشغيل/توقّف، تقييم نجمي، اختيار Take كافتراضي للسطر.
- **مقارنة A/B**: زرّان جنبًا إلى جنب لتشغيل سريع ومتعاقب بين Take ١ وTake ٢.
- التخزين في IndexedDB عبر `idb-storage.ts` (مفتاح `dubbing/takes/<sceneId>`).

## 4) موسيقى خلفية ومؤثّرات

مكوّن: `src/components/dubbing/AmbienceLayer.tsx`

- مكتبة موسيقى خلفية صغيرة من 6-8 مقاطع جاهزة (Hyrule Field, Castle, Battle, Sad, Mystery…) تُستضاف في `public/dubbing-ambience/`.
- شريط منزلق لمستوى الموسيقى بالنسبة للحوار (0-100%).
- خلط نهائي: الحوار على قناة + الموسيقى مخفّضة ٣٠٪ تلقائيًا أثناء الكلام (sidechain ducking مبسّط).

## 5) تحكّم متقدّم بالأداء لكل سطر

- **سرعة** (slider 0.7-1.4)، **توقّفات** (إدراج `...` تلقائيًا عند نقاط محدّدة)، **تأكيد كلمات** (تحديد كلمة → wrap بعلامات `*كلمة*` مع تعليمة في الـ prompt)، **الانفعال** (اختيار من نبرات الشخصية).
- كل هذه الإعدادات تُمرَّر إلى edge function `tts-dubbing` كـ `controls` وتُترجم إلى prefix أكثر دقة.

## 6) استيراد من المحرّر

- في `src/lib/editor-bridge.ts` نضيف دالة `exportSelectedToDubbing(entries)` تحفظ في `localStorage` تحت `dubbing-import`.
- في `Dubbing.tsx` زر **«استيراد من المحرّر»** يقرأ المفتاح ويحوّل كل entry إلى سطر سكريبت بشخصية افتراضية «الراوي» (يمكن للمستخدم تغييرها).
- في `Editor.tsx` يُضاف زر صغير «إرسال إلى الدبلجة» ضمن قائمة actions الموجودة.

## 7) معاينة بنمط زيلدا

مكوّن: `src/components/dubbing/ZeldaDubPreview.tsx`

- يعيد استخدام `ZeldaDialoguePreview.tsx` الموجود، يُضاف عرض اسم الشخصية + emoji + تشغيل الصوت متزامنًا مع ظهور النص حرفًا حرفًا.

## 8) تصدير ZIP + SRT

- مكتبة `jszip` (موجودة في المشروع — تُتأكَّد، وإلا تُضاف).
- زر **«تصدير الكل»** ينتج:
  ```
  scene_01.zip
  ├─ 001_zelda_lament.wav
  ├─ 002_link_battle.wav
  ├─ scene.wav   (mixdown)
  ├─ scene.srt
  └─ script.txt
  ```

## 9) واجهة سينمائية داكنة

- خلفية `#0a0e1a` متدرّجة إلى `#1a1f2e`.
- لمسات ذهبية `#d4af37` للأزرار الأساسية وحواف البطاقات النشطة.
- أخضر زلدا `#10b981` للحالات الناجحة.
- استخدام `motion` (موجود) لحركات هادئة على البطاقات والـ Timeline.
- **متجاوب للهاتف**: Timeline عمودي + drawer جانبي للنبرات + أزرار `h-10` + `overscroll-contain` و`touch-pan-y`.

## 10) تحديث edge function

`supabase/functions/tts-dubbing/index.ts`:
- يقبل: `{ text, voice, style, controls: { speed, emphasis, pauses, tone }, apiKey }`.
- يبني prompt متقدّمًا من النبرة + التوقّفات + التأكيدات قبل إرساله إلى Gemini TTS.
- يبقى استخدام مفتاح Gemini الخاص بالمستخدم (الافتراضي الحالي).

---

## الملفات الجديدة
- `src/lib/dubbing/character-catalog.ts`
- `src/lib/dubbing/scene-mixer.ts` (دمج WAV + SRT)
- `src/lib/dubbing/takes-store.ts` (IndexedDB)
- `src/components/dubbing/SceneTimeline.tsx`
- `src/components/dubbing/TakesLibrary.tsx`
- `src/components/dubbing/AmbienceLayer.tsx`
- `src/components/dubbing/ZeldaDubPreview.tsx`
- `src/components/dubbing/ToneSelector.tsx`
- `src/test/dubbing-catalog.test.ts`
- `src/test/scene-mixer.test.ts`

## الملفات المعدّلة
- `src/pages/Dubbing.tsx` (إعادة هيكلة كاملة، استبدال CHARACTERS بالكتالوج الموسّع)
- `src/lib/editor-bridge.ts` (دالة الاستيراد)
- `src/pages/Editor.tsx` (زر إرسال إلى الدبلجة)
- `supabase/functions/tts-dubbing/index.ts` (دعم controls)
- `mem://index.md` + ملف ذاكرة جديد للاستوديو

## ترتيب التنفيذ (مقترح على دفعات)

1. **الكتالوج الموسّع + النبرات** (الأساس — أهم نقطة لك)
2. **محرّر Timeline + التحكّم بالأداء**
3. **مكتبة Takes + A/B**
4. **استيراد من المحرّر + معاينة زيلدا**
5. **موسيقى خلفية + تصدير ZIP/SRT**
6. **التلميع البصري النهائي**

العمل كبير لكنه قابل للتنفيذ على مراحل. هل أبدأ بالدفعة الأولى (الكتالوج + النبرات) فورًا، أم تريد تعديل الخطّة أوّلًا؟
