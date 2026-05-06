import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { INPUT_DEBOUNCE } from "./types";
import { BookOpen, History } from "lucide-react";

interface Suggestion {
  text: string;
  label: string;
  source: "glossary" | "memory";
}

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  glossaryMatches?: { term: string; translation: string }[];
  translationMemory?: { key: string; translation: string }[];
}

const AutocompleteInput = memo(({
  value,
  onChange,
  placeholder,
  className,
  glossaryMatches = [],
  translationMemory = [],
}: AutocompleteInputProps) => {
  const [localValue, setLocalValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Build suggestions list from glossary + translation memory
  const suggestions = useMemo<Suggestion[]>(() => {
    const results: Suggestion[] = [];
    const query = localValue.trim().toLowerCase();

    // Glossary suggestions — show matching terms' Arabic translations
    for (const m of glossaryMatches) {
      if (results.length >= 8) break;
      // Show if input is empty or the Arabic translation partially matches what's typed
      if (!query || m.translation.includes(query) || !localValue.trim()) {
        // Don't suggest if already in the text
        if (localValue.includes(m.translation)) continue;
        results.push({
          text: m.translation,
          label: `${m.term} → ${m.translation}`,
          source: "glossary",
        });
      }
    }

    // Translation memory suggestions
    for (const tm of translationMemory) {
      if (results.length >= 10) break;
      if (!tm.translation?.trim()) continue;
      if (tm.translation === localValue) continue;
      // Show TM if input is empty or TM starts with same words
      if (!query || tm.translation.includes(query)) {
        results.push({
          text: tm.translation,
          label: tm.translation.length > 50 ? tm.translation.slice(0, 50) + '…' : tm.translation,
          source: "memory",
        });
      }
    }

    return results;
  }, [localValue, glossaryMatches, translationMemory]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    setShowSuggestions(true);
    setSelectedIndex(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(newVal), INPUT_DEBOUNCE);
  }, [onChange]);

  const applySuggestion = useCallback((suggestion: Suggestion) => {
    let newVal: string;
    if (suggestion.source === "memory") {
      // For TM, replace entire value
      newVal = suggestion.text;
    } else {
      // For glossary, append the term if not already present
      const current = localValue.trim();
      newVal = current ? `${current} ${suggestion.text}` : suggestion.text;
    }
    setLocalValue(newVal);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(newVal);
    inputRef.current?.focus();
  }, [localValue, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, selectedIndex, applySuggestion]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const hasSuggestions = showSuggestions && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1 w-full">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        dir="rtl"
        style={{ unicodeBidi: 'plaintext' }}
      />
      {hasSuggestions && (
        <div className="absolute z-40 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={`${s.source}-${i}`}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-body text-right hover:bg-accent/10 transition-colors ${
                i === selectedIndex ? 'bg-accent/15' : ''
              }`}
              dir="rtl"
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(s);
              }}
            >
              {s.source === "glossary" ? (
                <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <History className="w-3.5 h-3.5 text-secondary shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
              <span className="text-[10px] text-muted-foreground mr-auto shrink-0">
                {s.source === "glossary" ? "قاموس" : "ذاكرة"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

AutocompleteInput.displayName = "AutocompleteInput";

export default AutocompleteInput;
