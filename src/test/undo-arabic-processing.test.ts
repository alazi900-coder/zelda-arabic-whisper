import { describe, it, expect } from 'vitest';
import {
  processArabicText,
  reverseBidi,
  removeArabicPresentationForms,
  hasArabicPresentationForms,
  hasArabicChars,
} from '@/lib/arabic-processing';

/**
 * Verifies the "تراجع عن المعالجة العربية" undo logic.
 * The undo is reverseBidi → expandLamAlefLigatures → removeArabicPresentationForms,
 * the exact inverse of processArabicText for typical Arabic inputs.
 *
 * Mirrors the helper defined in src/hooks/useEditorBuild.ts.
 */

const LAM = 0x0644;
const LAM_ALEF_LIGATURE_REVERSE: Record<number, number> = {
  0xFEF5: 0x0622, 0xFEF6: 0x0622,
  0xFEF7: 0x0623, 0xFEF8: 0x0623,
  0xFEF9: 0x0625, 0xFEFA: 0x0625,
  0xFEFB: 0x0627, 0xFEFC: 0x0627,
};
function expandLamAlefLigatures(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const alef = LAM_ALEF_LIGATURE_REVERSE[code];
    if (alef !== undefined) {
      out += String.fromCharCode(LAM) + String.fromCharCode(alef);
    } else {
      out += ch;
    }
  }
  return out;
}

function undoArabicProcessing(text: string): string {
  return removeArabicPresentationForms(expandLamAlefLigatures(reverseBidi(text)));
}

describe('Undo Arabic Processing', () => {
  it('round-trip: process then undo returns the original Arabic text', () => {
    const inputs = [
      'مرحبا',
      'متابعة اللعب',
      'لعبة جديدة',
      'حفظ',
      'إعدادات',
      'السلام عليكم',
      'هل تريد الخروج؟',
    ];
    for (const input of inputs) {
      const processed = processArabicText(input);
      const restored = undoArabicProcessing(processed);
      expect(restored, `failed round-trip for: ${input}`).toBe(input);
    }
  });

  it('processed text has presentation forms; undone text does not', () => {
    const input = 'بداية اللعبة';
    const processed = processArabicText(input);
    expect(hasArabicPresentationForms(processed)).toBe(true);
    const restored = undoArabicProcessing(processed);
    expect(hasArabicPresentationForms(restored)).toBe(false);
    expect(hasArabicChars(restored)).toBe(true);
  });

  it('preserves PUA technical markers across round-trip', () => {
    const input = 'كلمة\uE000\uE001 ثانية';
    const processed = processArabicText(input);
    const restored = undoArabicProcessing(processed);
    expect(restored).toBe(input);
  });

  it('preserves display markers (FFF9-FFFC) across round-trip', () => {
    const input = 'نص\uFFF9\uFFFA\uFFFBمتداخل';
    const processed = processArabicText(input);
    const restored = undoArabicProcessing(processed);
    expect(restored).toBe(input);
  });

  it('preserves multi-line Arabic across round-trip', () => {
    const input = 'سطر أول\nسطر ثاني\nسطر ثالث';
    const processed = processArabicText(input);
    const restored = undoArabicProcessing(processed);
    expect(restored).toBe(input);
  });

  it('leaves non-Arabic / already-restored text untouched', () => {
    // No presentation forms → the editor's guard skips these entirely,
    // but the underlying transforms should still be safe no-ops here.
    expect(undoArabicProcessing('Hello world')).toBe('Hello world');
    expect(undoArabicProcessing('')).toBe('');
  });

  it('hasArabicPresentationForms correctly gates the editor undo loop', () => {
    // Untouched standard Arabic must NOT trigger undo (would otherwise be a no-op anyway).
    expect(hasArabicPresentationForms('مرحبا')).toBe(false);
    // Processed Arabic must trigger undo.
    expect(hasArabicPresentationForms(processArabicText('مرحبا'))).toBe(true);
  });
});
