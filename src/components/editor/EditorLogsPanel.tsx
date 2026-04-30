import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react";
import linkHero from "@/assets/link-hero.png";
import hyruleWorld from "@/assets/hyrule-world.jpg";

/**
 * 📜 Adventure log: Zelda-themed log panel for the editor.
 * Displays per-stage progress when loading the file from IndexedDB,
 * plus errors with troubleshooting tips when loading fails.
 *
 * Visual style: gold (Triforce) borders, parchment background using
 * hyrule-world.jpg at low opacity, link-hero.png as the title icon.
 */
export default function EditorLogsPanel({
  logs,
  hasError,
}: {
  logs: string[];
  hasError: boolean;
}) {
  // Auto-open when there's an error, collapsed by default on success.
  const [open, setOpen] = React.useState(hasError);
  React.useEffect(() => {
    if (hasError) setOpen(true);
  }, [hasError]);

  if (logs.length === 0) return null;

  const exportLog = () => {
    const text = logs.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zelda-editor-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      className={`mb-4 relative overflow-hidden ${
        hasError
          ? "border-destructive/50 bg-destructive/5"
          : "border-amber-500/40 bg-gradient-to-br from-amber-50/40 to-amber-100/20 dark:from-amber-950/20 dark:to-amber-900/10"
      }`}
    >
      {/* Hyrule parchment background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] bg-cover bg-center"
        style={{ backgroundImage: `url(${hyruleWorld})` }}
        aria-hidden
      />
      <CardHeader className="relative pb-2 pt-3 px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="font-display text-sm sm:text-base flex items-center gap-2">
            <img
              src={linkHero}
              alt=""
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full ring-1 ring-amber-500/40 object-cover"
            />
            <span>📜 سجل المغامرة</span>
            {hasError ? (
              <span className="text-xs font-body text-destructive">— حدث خطأ</span>
            ) : (
              <span className="text-xs font-body text-muted-foreground">
                ({logs.length} مرحلة)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {hasError && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-3.5 h-3.5" /> إعادة محاولة
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={exportLog}
            >
              <Download className="w-3.5 h-3.5" /> تصدير
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
            >
              {open ? (
                <><ChevronUp className="w-3.5 h-3.5" /> طيّ</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> فتح</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="relative pt-0 px-3 sm:px-4 pb-3">
          <div
            className="bg-background/80 backdrop-blur-sm rounded-md p-2 sm:p-3 max-h-72 overflow-y-auto font-mono text-[11px] sm:text-xs space-y-1 border border-amber-500/20"
            dir="ltr"
          >
            {logs.map((log, i) => (
              <div
                key={i}
                className="text-foreground/80 whitespace-pre-wrap break-words leading-relaxed"
              >
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
