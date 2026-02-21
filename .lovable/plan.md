
# تقسيم الفئات بشكل أدق بناءً على ملف PDF

## المشكلة الجذرية
دالة `categorizeFile` تستقبل فقط اسم الملف (مثل "PouchContent") لكن جميع الأسلحة والطعام والدروع وغيرها موجودة **داخل** ملف PouchContent.msbt واسم كل عنصر (label) هو الذي يحدد نوعه (مثل `Weapon_Sword_001`, `Item_Cook_002`). لذلك السيوف والأقواس لا تظهر أبداً.

## الحل
تعديل `categorizeFile` لتستقبل أيضاً `label` العنصر وتصنّف بناءً عليه.

## الفئات الجديدة (بناءً على PDF)

| الفئة | الرمز | نمط Label | المحتوى |
|---|---|---|---|
| السيوف | سيوف | `Weapon_Sword_`, `Weapon_Lsword_` | سيوف صغيرة وكبيرة (245 عنصر) |
| الرماح | رماح | `Weapon_Spear_` | الرماح (102 عنصر) |
| الأقواس | أقواس | `Weapon_Bow_` | الأقواس (60 عنصر) |
| الدروع/التروس | دروع | `Weapon_Shield_` | التروس (99 عنصر) |
| الملابس | ملابس | `Obj_SubstituteCloth_`, `Armor` | الملابس والدروع (105 عنصر) |
| الطعام والطبخ | طعام | `Item_Cook_`, `Item_Fruit_`, `Item_Mushroom_`, `Item_Fish`, `Item_Meat_`, `Item_PlantGet_`, `Item_Vegetable`, `Item_Boiled_` | جميع المأكولات (417 عنصر) |
| الحشرات والمخلوقات | حشرات | `Animal_Insect_` | الحشرات (27 عنصر) |
| أجزاء الوحوش | أجزاء وحوش | `Item_Enemy_` | قرون وأنياب ومخالب (186 عنصر) |
| المعادن والأحجار | معادن | `Item_Ore_` | أحجار كريمة ومعادن (30 عنصر) |
| المواد والموارد | مواد | `Item_Material_`, `Item_LumberjackTree_` | مواد خام وأخشاب |
| أدوات زوناي | زوناي | `SpObj_` | أدوات البناء (48 عنصر) |
| أسهم وأدوات خاصة | أدوات | `NormalArrow_`, `Obj_UltraHand`, `PutRupee_`, `Obj_TreasureMap_` | أسهم وقدرات وعملات |
| الوحوش والأعداء | وحوش | `Enemy_` (في PictureBook/Boss) | الوحوش والزعماء (~400 عنصر) |
| الشخصيات (NPC) | شخصيات | ملف `Npc.msbt` | أسماء الشخصيات (737 عنصر) |
| المرفقات (Fuse) | دمج | ملف `Attachment.msbt` | مواد الدمج (481 عنصر) |
| المواقع والخرائط | خرائط | `LocationMsg/` | المواقع الجغرافية (1709 عنصر) |
| حوارات القصة | قصة | `EventFlowMsg/` | الحوارات (~32,704 نص) |
| المهام والتحديات | تحديات | `ChallengeMsg/` | المهام (1097 نص) |
| واجهة المستخدم | واجهة | `LayoutMsg/` | القوائم والأزرار |
| النصائح | نصائح | `StaticMsg/` | تأثيرات ونصائح |

## التفاصيل التقنية

### الملفات المتأثرة:

**1. `src/components/editor/types.tsx`**
- تعديل `categorizeFile(filePath, label?)` لتقبل معامل ثاني اختياري هو `label`
- تحديث `FILE_CATEGORIES` بالفئات الجديدة (~20 فئة بدل 17)
- منطق التصنيف الجديد: فحص `label` أولاً (للتمييز داخل PouchContent)، ثم `filePath` (للملفات المستقلة)

**2. `src/hooks/useEditorState.ts`**
- تعديل جميع استدعاءات `categorizeFile(e.msbtFile)` لتصبح `categorizeFile(e.msbtFile, e.label)`

**3. `src/hooks/useEditorQuality.ts`**
- نفس التعديل: تمرير `entry.label` كمعامل ثاني

**4. `src/hooks/useEditorTranslation.ts`**
- نفس التعديل: تمرير `e.label` كمعامل ثاني

**5. `src/components/editor/CategoryProgress.tsx`**
- تعديل تخطيط الشبكة لاستيعاب العدد الأكبر من البطاقات

### ترتيب أولوية التصنيف في الكود:
```text
1. فحص label أولاً (لمحتويات PouchContent):
   Weapon_Sword_ / Weapon_Lsword_ --> سيوف
   Weapon_Spear_ --> رماح
   Weapon_Bow_ --> أقواس  
   Weapon_Shield_ --> تروس
   Obj_SubstituteCloth_ / Armor --> ملابس
   Item_Cook_ / Item_Fruit_ / ... --> طعام
   Animal_Insect_ --> حشرات
   Item_Enemy_ --> أجزاء وحوش
   Item_Ore_ --> معادن
   Item_Material_ / LumberjackTree --> مواد
   SpObj_ --> زوناي
   NormalArrow_ / PutRupee_ / Obj_ --> أدوات خاصة

2. فحص اسم الملف (msbtFile):
   PictureBook / Boss --> وحوش
   Npc --> شخصيات
   Attachment --> مواد دمج
   Horse / Nickname / ... --> فئات فرعية
   LayoutMsg/ --> واجهة
   EventFlowMsg/ --> قصة
   ChallengeMsg/ --> تحديات
   LocationMsg/ --> خرائط
   StaticMsg/ --> نصائح
   
3. "أخرى" لكل ما لا يتطابق
```
