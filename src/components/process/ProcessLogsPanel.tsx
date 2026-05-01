import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Download, RotateCcw } from "lucide-react";
import hyruleWorld from "@/assets/hyrule-world.jpg";
import linkHero from "@/assets/link-hero.png";

interface Props {
  logs: string[];
  hasError: boolean;
  busy: boolean;
  onRetry?: () => void;
}

/**
 * 📜 Adventure log shown during file open in /process page.
 * Auto-opens on error or while extracting; collapsed otherwise.
 */
export default function ProcessLogsPanel({ logs, hasError, busy, onRetry }: Props) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (hasError || busy) setOpen(true);
  }, [hasError, busy]);

  if (logs.length === 0) return null;

  const handleExport = () => {
    const text = logs.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `سجل-المغامرة-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`relative rounded-lg border-2 mb-6 overflow-hidden transition-colors ${
        hasError ? "border-red-500/40" : "border-amber-500/40"
      }`}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] bg-cover bg-center"
        style={{ backgroundImage: `url(${hyruleWorld})` }}
        aria-hidden
      />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-amber-500/5 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={linkHero}
              alt=""
              className="w-8 h-8 rounded-full ring-2 ring-amber-500/40 object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm">
                {hasError ? "⚠️ سجل المغامرة — حدث خطأ" : busy ? "📜 سجل المغامرة — جارٍ..." : "📜 سجل المغامرة"}
              </p>
              <p className="text-[11px] text-muted-foreground font-body truncate">
                {logs.length} حدث • اضغط لـ {open ? "إخفاء" : "عرض"} التفاصيل
              </p>
            </div>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {open && (
          <div className="px-4 pb-3 space-y-2">
            <div
              className="rounded bg-background/70 border border-border/50 p-3 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap"
              dir="ltr"
            >
              {logs.join("\n")}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={handleExport} className="h-7 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" /> تصدير .txt
              </Button>
              {hasError && onRetry && (
                <Button size="sm" onClick={onRetry} className="h-7 text-xs gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> إعادة محاولة
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
