سأصلح الخطأ المحدد فقط:

1. تعديل السطر في `src/pages/Editor.tsx` الذي يستدعي `resolveModelId` بثلاثة معاملات.
2. إبقاء الاستدعاء مطابقاً لتعريف الدالة الحالي في `src/lib/cost-estimator.ts`، لأنها تقبل فقط:
   - `engine`
   - `geminiModel` اختياري
3. التغيير المتوقع:

```ts
resolveModelId(editor.translationEngine, editor.geminiModel)
```

بدلاً من تمرير `editor.translationQuality` كمعامل ثالث.

لن أغيّر أخطاء الأنواع الأخرى الآن لأن طلبك محدد فقط بـ TS2554.