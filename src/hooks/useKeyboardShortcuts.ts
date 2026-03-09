import { useEffect, useCallback } from "react";

interface ShortcutActions {
  onNextEntry?: () => void;
  onPrevEntry?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onSave?: () => void;
  onTranslate?: () => void;
  onSearch?: () => void;
  onFindReplace?: () => void;
  onQuickReview?: () => void;
  onBuild?: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions, enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger in input/textarea unless modifier is pressed
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Ctrl+S: Save
    if (ctrl && e.key === 's') {
      e.preventDefault();
      actions.onSave?.();
      return;
    }

    // Ctrl+F: Search
    if (ctrl && e.key === 'f' && !shift) {
      e.preventDefault();
      actions.onSearch?.();
      return;
    }

    // Ctrl+H: Find & Replace
    if (ctrl && e.key === 'h') {
      e.preventDefault();
      actions.onFindReplace?.();
      return;
    }

    // Ctrl+Enter: Translate
    if (ctrl && e.key === 'Enter') {
      e.preventDefault();
      actions.onTranslate?.();
      return;
    }

    // Ctrl+B: Build
    if (ctrl && e.key === 'b') {
      e.preventDefault();
      actions.onBuild?.();
      return;
    }

    // Ctrl+Q: Quick Review
    if (ctrl && e.key === 'q') {
      e.preventDefault();
      actions.onQuickReview?.();
      return;
    }

    // Skip navigation shortcuts when in input fields
    if (isInput) return;

    // Arrow Down / J: Next entry (only outside inputs)
    if (e.key === 'ArrowDown' || e.key === 'j') {
      // Don't prevent default for normal scrolling
    }

    // Page navigation
    if (e.key === 'ArrowRight' || (ctrl && e.key === 'ArrowLeft')) {
      e.preventDefault();
      actions.onPrevPage?.();
    }
    if (e.key === 'ArrowLeft' || (ctrl && e.key === 'ArrowRight')) {
      e.preventDefault();
      actions.onNextPage?.();
    }
  }, [enabled, actions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUT_LIST = [
  { keys: 'Ctrl+S', description: 'حفظ في السحابة', category: 'عام' },
  { keys: 'Ctrl+F', description: 'بحث', category: 'عام' },
  { keys: 'Ctrl+H', description: 'بحث واستبدال', category: 'عام' },
  { keys: 'Ctrl+Enter', description: 'ترجمة تلقائية', category: 'ترجمة' },
  { keys: 'Ctrl+B', description: 'بناء الملف', category: 'بناء' },
  { keys: 'Ctrl+Q', description: 'المراجعة السريعة', category: 'مراجعة' },
  { keys: '← →', description: 'تنقل بين الصفحات', category: 'تنقل' },
];
