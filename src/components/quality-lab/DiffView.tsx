import { useMemo } from "react";
import { diffWords } from "@/lib/diff-words";

interface DiffViewProps {
  before: string;
  after: string;
  className?: string;
}

const DiffView = ({ before, after, className }: DiffViewProps) => {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <div
      className={`text-sm leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap ${className ?? ""}`}
      dir="auto"
    >
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <span
            key={i}
            className="bg-destructive/15 text-destructive line-through rounded px-0.5 mx-px"
          >
            {p.text}
          </span>
        ) : (
          <span
            key={i}
            className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded px-0.5 mx-px"
          >
            {p.text}
          </span>
        ),
      )}
    </div>
  );
};

export default DiffView;
